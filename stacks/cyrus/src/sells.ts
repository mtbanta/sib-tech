// EVERY SELL THE STACK SENDS GOES THROUGH HERE. Two parts:
//
//  1. SellGate: the only code that may send a sell (`submitSell`). A hard check, whatever path asked for the sale
//     (close-out, flatten, loss stop, an unprotected position): a sell may not be larger than the shares held at
//     that moment minus the sells already open. If it would be, the sell is refused and Michael is told. This keeps
//     the stack long only at any borrowing cap, because a sell bigger than the position is a short sale.
//
//  2. Liquidator: sells positions reliably. It does NOT use Alpaca's bulk "close all positions" call, which on
//     2026-11-02 cancelled the protective stops and then failed on every position (a cancel takes a moment to
//     complete, and until it does the stop still holds the shares). Instead it: cancels the orders that hold the
//     shares, waits until Alpaca shows they are gone, sells each symbol with an explicit quantity through the
//     SellGate, looks again, and repeats a few times. What is still held at the end is returned so the caller can tell
//     Michael.
import type { Order, Position } from "./alpaca-trading.ts";
import { AlpacaError } from "./alpaca-trading.ts";
import type { SellBroker } from "./broker.ts";

export type Say = (channel: "commands" | "trading" | "alerts", text: string, opts?: { mentionOwner?: boolean }) => Promise<boolean>;

// Orders that can still execute. A cancel that has been asked for but not finished (pending_cancel) can still fill,
// so it counts as open.
export const OPEN_STATUSES = new Set(["new", "accepted", "pending_new", "partially_filled", "held", "pending_replace", "pending_cancel", "accepted_for_bidding", "calculated"]);
const EPS = 1e-6;

const remaining = (o: Order) => Math.max(0, o.qty - o.filledQty);

// Shares that open sell orders could still sell, for one symbol. Two linked exit orders (a bracket's take-profit and
// stop, or any order with sell legs under it) are one-cancels-other, only one can fill, so a linked group counts once
// (its largest member), not twice.
export function openSellQty(orders: Order[], symbol: string): number {
  let total = 0;
  const live = (o: Order) => o.symbol === symbol && o.side === "sell" && OPEN_STATUSES.has(o.status);
  for (const o of orders) {
    if (o.side === "buy") {
      const legs = flattenLegs(o).filter(live);
      if (legs.length > 0) total += Math.max(...legs.map(remaining));
    } else if (o.symbol === symbol) {
      const group = [o, ...flattenLegs(o)].filter(live);
      if (group.length > 0) total += Math.max(...group.map(remaining));
    }
  }
  return total;
}

export function flattenLegs(o: Order): Order[] {
  return o.legs.flatMap((l) => [l, ...flattenLegs(l)]);
}

// Every order id that is open for one of the symbols (parents and legs), parents first.
export function openOrderIds(orders: Order[], symbols: ReadonlySet<string>): string[] {
  const ids: string[] = [];
  for (const o of orders) {
    if (symbols.has(o.symbol) && OPEN_STATUSES.has(o.status)) ids.push(o.id);
    for (const l of flattenLegs(o)) if (symbols.has(l.symbol) && OPEN_STATUSES.has(l.status)) ids.push(l.id);
  }
  return [...new Set(ids)];
}

export type SellResult = { status: "sent"; order: Order } | { status: "refused"; reason: string } | { status: "error"; reason: string };

export interface SellGateDeps {
  broker: SellBroker;
  say: Say;
  log?: (event: string, data?: Record<string, unknown>) => void;
}

export class SellGate {
  private readonly d: SellGateDeps;
  constructor(deps: SellGateDeps) {
    this.d = deps;
  }

  // `view` lets a caller that has just read the positions and open orders (a liquidation round) pass them in; without
  // it the gate reads them fresh. Either way the check is against what the broker said, not against a stored guess.
  async sell(req: { symbol: string; qty: number; clientOrderId: string; reason: string }, view?: { positions: Position[]; openOrders: Order[] }): Promise<SellResult> {
    let positions: Position[];
    let openOrders: Order[];
    try {
      positions = view?.positions ?? (await this.d.broker.listPositions());
      openOrders = view?.openOrders ?? (await this.d.broker.listOrders("open"));
    } catch (err) {
      return { status: "error", reason: `could not read the position to check the sell: ${(err as Error).message.slice(0, 120)}` };
    }
    const held = positions.find((p) => p.symbol === req.symbol)?.qty ?? 0;
    const open = openSellQty(openOrders, req.symbol);
    const free = held - open;
    if (!(req.qty > 0) || req.qty > free + EPS) {
      const reason = `refused a sell of ${req.qty} ${req.symbol} (${req.reason}): ${held} held, ${open} already being sold, so ${Math.max(0, free)} can be sold`;
      this.d.log?.("sell_refused", { symbol: req.symbol, qty: req.qty, held, open, reason: req.reason });
      await this.d.say("alerts", `**Michael: ${reason}.** A sell larger than the position would be a short sale, and this stack is long only. Nothing was sent.`, { mentionOwner: true });
      return { status: "refused", reason };
    }
    try {
      const order = await this.d.broker.submitSell({ symbol: req.symbol, qty: req.qty, clientOrderId: req.clientOrderId });
      return { status: "sent", order };
    } catch (err) {
      const msg = (err as Error).message.slice(0, 200);
      this.d.log?.("sell_failed", { symbol: req.symbol, qty: req.qty, reason: req.reason, error: msg, status: err instanceof AlpacaError ? err.status : null });
      return { status: "error", reason: msg };
    }
  }
}

export interface LiquidateOptions {
  reason: string;
  tradeDate: string;
  // Only these symbols (an unprotected position). Without it: every position, and every open order.
  only?: string[];
  maxRounds?: number;
  waitCancelMs?: number;
}

export interface LiquidateResult {
  flat: boolean;
  remaining: string[];
  sold: Array<{ symbol: string; qty: number }>;
  errors: string[];
}

export interface LiquidatorDeps {
  broker: SellBroker;
  gate: SellGate;
  now: () => Date;
  sleep?: (ms: number) => Promise<void>;
  log?: (event: string, data?: Record<string, unknown>) => void;
}

export class Liquidator {
  private readonly d: LiquidatorDeps;
  private readonly sleep: (ms: number) => Promise<void>;
  constructor(deps: LiquidatorDeps) {
    this.d = deps;
    this.sleep = deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  }

  async flatten(o: LiquidateOptions): Promise<LiquidateResult> {
    const rounds = o.maxRounds ?? 4;
    const waitMs = o.waitCancelMs ?? 6_000;
    const only = o.only ? new Set(o.only) : null;
    const result: LiquidateResult = { flat: false, remaining: [], sold: [], errors: [] };
    const heldNow = async (): Promise<Position[]> => (await this.d.broker.listPositions()).filter((p) => !only || only.has(p.symbol));

    for (let round = 1; round <= rounds; round++) {
      let positions: Position[];
      try {
        positions = await heldNow();
      } catch (err) {
        result.errors.push(`round ${round}: could not read positions: ${(err as Error).message.slice(0, 100)}`);
        result.remaining = ["(could not read positions)"];
        await this.sleep(1_000 * round);
        continue;
      }
      if (positions.length === 0) {
        result.flat = true;
        result.remaining = [];
        return result;
      }
      result.remaining = positions.map((p) => p.symbol);
      const symbols = new Set(positions.map((p) => p.symbol));

      // 1. Cancel what holds the shares (the exits resting at Alpaca) and, for a whole-account sale, any open order at
      //    all. Never a sell this liquidator sent itself in an earlier round: that sale may simply be slow, and cancelling
      //    it would only start the same sale again.
      try {
        const open = await this.d.broker.listOrders("open");
        const ours = (o: Order) => o.side === "sell" && o.clientOrderId.startsWith("cyrus-x-");
        const others = open.filter((o) => !ours(o));
        const targets = only ? symbols : new Set(others.flatMap((o) => [o.symbol, ...flattenLegs(o).map((l) => l.symbol)]));
        if (!only && !open.some(ours) && others.length > 0) {
          const r = await this.d.broker.cancelAllOrders();
          if (r.failed.length > 0) result.errors.push(`round ${round}: cancel answers: ${r.failed.slice(0, 3).join("; ").slice(0, 200)}`);
        } else {
          for (const id of openOrderIds(others, targets)) await this.d.broker.cancelOrder(id);
        }
      } catch (err) {
        result.errors.push(`round ${round}: cancel failed: ${(err as Error).message.slice(0, 120)}`);
      }

      // 2. Wait until Alpaca shows no open order on those symbols: a cancel is not instant.
      let openOrders: Order[] = [];
      const t0 = this.d.now().getTime();
      let waited = 0;
      let polls = 0;
      for (;;) {
        try {
          openOrders = await this.d.broker.listOrders("open");
        } catch (err) {
          result.errors.push(`round ${round}: could not read open orders: ${(err as Error).message.slice(0, 100)}`);
          break;
        }
        const stillHolding = [...symbols].some((s) => openSellQty(openOrders, s) > EPS);
        if (!stillHolding || waited >= waitMs) break;
        // Poll gently: a cancel usually finishes in a fraction of a second, and every look costs one of Alpaca's 200 requests a minute.
        const pause = [250, 400, 600, 800][Math.min(polls++, 3)]!;
        await this.sleep(pause);
        waited += pause;
        if (this.d.now().getTime() - t0 > waitMs * 3) break; // a clock that moves much faster than the loop
      }

      // 3. Sell each symbol with an explicit quantity, through the sell gate (never more than is free).
      let freshPositions: Position[];
      try {
        freshPositions = await heldNow();
      } catch (err) {
        result.errors.push(`round ${round}: could not re-read positions: ${(err as Error).message.slice(0, 100)}`);
        continue;
      }
      for (const p of freshPositions) {
        const free = p.qty - openSellQty(openOrders, p.symbol);
        if (!(free > EPS)) continue; // something is still holding the shares; the next round cancels again
        const id = `cyrus-x-${o.tradeDate.replaceAll("-", "")}-${p.symbol}-${this.d.now().getTime().toString(36)}-${round}`;
        const r = await this.d.gate.sell({ symbol: p.symbol, qty: free, clientOrderId: id, reason: o.reason }, { positions: freshPositions, openOrders });
        if (r.status === "sent") result.sold.push({ symbol: p.symbol, qty: free });
        else result.errors.push(`round ${round}: ${p.symbol}: ${r.reason}`);
      }

      // 4. Look again after the sells have had a moment to fill.
      await this.sleep(1_000);
    }

    try {
      const left = await heldNow();
      result.flat = left.length === 0;
      result.remaining = left.map((p) => p.symbol);
    } catch {
      result.remaining = result.remaining.length > 0 ? result.remaining : ["(could not read positions)"];
    }
    return result;
  }
}
