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

// `httpStatus` is Alpaca's answer code when Alpaca refused the sell (429 means its request limit was hit).
export type SellResult = { status: "sent"; order: Order } | { status: "refused"; reason: string } | { status: "error"; reason: string; httpStatus?: number };

export interface SellGateDeps {
  broker: SellBroker;
  say: Say;
  log?: (event: string, data?: Record<string, unknown>) => void;
  // Milliseconds now. The tests use a simulated clock.
  nowMs?: () => number;
}

// What the gate reads again at most this often. Inside a burst of sells (a liquidation of many positions) one read
// serves many sells, and every sell sent since that read is remembered here and subtracted, so nothing is double sold.
const VIEW_MAX_AGE_MS = 1_000;
// A sell the gate sent stays in its memory until a read taken clearly after it shows the effect.
const SEEN_MARGIN_MS = 500;
const FAR_PAST = "2000-01-01T00:00:00Z";

export class SellGate {
  private readonly d: SellGateDeps;
  private readonly nowMs: () => number;
  private chain: Promise<unknown> = Promise.resolve();
  private view: { positions: Position[]; open: Order[]; at: number } | null = null;
  private sent: Array<{ symbol: string; qty: number; at: number }> = [];

  constructor(deps: SellGateDeps) {
    this.d = deps;
    this.nowMs = deps.nowMs ?? Date.now;
  }

  // One sell at a time, for every path (close-out, flatten, loss stop, an unprotected position, a carried position).
  // The check is made against what the broker says NOW (never against a snapshot a caller built), minus the sells this
  // gate has sent since that read, and it is also kept below the shares Alpaca itself reports as free.
  sell(req: { symbol: string; qty: number; clientOrderId: string; reason: string }): Promise<SellResult> {
    const run = this.chain.then(() => this.run(req));
    this.chain = run.catch(() => undefined);
    return run;
  }

  // True when the next sell will first read the broker again (2 requests: open orders, then positions). The loss stop's retry
  // counts those reads against its request budget.
  needsRead(): boolean {
    return !(this.view && this.nowMs() - this.view.at < VIEW_MAX_AGE_MS);
  }

  // Forget the last read (the liquidator calls this after its cancels, so the next sell checks the world as it is now).
  invalidate(): void {
    this.view = null;
  }

  // What the gate checks sells against: open orders and positions as the broker shows them (read again if the last read is
  // more than a second old). The loss stop's retry uses it to decide what is still unsold, so it checks against the same view.
  look(): Promise<{ positions: Position[]; open: Order[] }> {
    return this.read();
  }

  private async read(): Promise<{ positions: Position[]; open: Order[] }> {
    const t = this.nowMs();
    if (this.view && t - this.view.at < VIEW_MAX_AGE_MS) return this.view;
    // Open orders FIRST, then positions: a sell that fills between the two reads then shows up in both (the shares gone
    // from the position AND the sell still counted as open), so the gate errs toward refusing, never toward overselling.
    const listed = await this.d.broker.listOrdersPaged("open", FAR_PAST, 5);
    if (!listed.complete) throw new Error("the list of open orders is longer than I can read, so I cannot count the sells already open");
    const positions = await this.d.broker.listPositions();
    this.view = { positions, open: listed.orders, at: t };
    // A sell sent clearly before this read is now part of what the broker shows.
    this.sent = this.sent.filter((x) => x.at + SEEN_MARGIN_MS > t);
    return this.view;
  }

  private async run(req: { symbol: string; qty: number; clientOrderId: string; reason: string }): Promise<SellResult> {
    let v: { positions: Position[]; open: Order[] };
    try {
      v = await this.read();
    } catch (err) {
      this.view = null;
      return { status: "error", reason: `could not read the position to check the sell: ${(err as Error).message.slice(0, 120)}` };
    }
    const pos = v.positions.find((p) => p.symbol === req.symbol);
    const held = pos?.qty ?? 0;
    const open = openSellQty(v.open, req.symbol);
    const unseen = this.sent.filter((x) => x.symbol === req.symbol && x.at >= (this.view?.at ?? 0)).reduce((n, x) => n + x.qty, 0);
    const byCount = held - open - unseen;
    const free = pos?.qtyAvailable != null ? Math.min(byCount, pos.qtyAvailable - unseen) : byCount;
    if (!(req.qty > 0) || req.qty > free + EPS) {
      const reason = `refused a sell of ${req.qty} ${req.symbol} (${req.reason}): ${held} held, ${open + unseen} already being sold, so ${Math.max(0, free)} can be sold`;
      this.d.log?.("sell_refused", { symbol: req.symbol, qty: req.qty, held, open, unseen, reason: req.reason });
      this.view = null; // look again next time
      // Not awaited: Discord's own rate limit must never hold up the next sell, close-out sells included.
      void this.d.say("alerts", `**Michael: ${reason}.** A sell larger than the position would be a short sale, and this stack is long only. Nothing was sent.`, { mentionOwner: true }).catch(() => undefined);
      return { status: "refused", reason };
    }
    try {
      const order = await this.d.broker.submitSell({ symbol: req.symbol, qty: req.qty, clientOrderId: req.clientOrderId });
      this.sent.push({ symbol: req.symbol, qty: req.qty, at: this.nowMs() });
      return { status: "sent", order };
    } catch (err) {
      const msg = (err as Error).message.slice(0, 200);
      this.view = null;
      this.d.log?.("sell_failed", { symbol: req.symbol, qty: req.qty, reason: req.reason, error: msg, status: err instanceof AlpacaError ? err.status : null });
      return { status: "error", reason: msg, httpStatus: err instanceof AlpacaError ? err.status : undefined };
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
  // Release A, fix 1: order ids to cancel first in an `only` sale (a filled bracket's exit legs, which Alpaca's open list may
  // not show). An answer that the order is already filled or cancelled is not a failure.
  cancelIds?: string[];
  // Release A, fix 2, set only by the close-out: from round 2 on, if every share still held is covered by a sell this stack
  // sent (client id cyrus-x-), stop and return those symbols as `working` instead of waiting out the remaining rounds.
  returnWhenOnlyOwnSells?: boolean;
  // The speed release, item 6 (Michael's approval of 2026-11-05): the daily loss stop's sale is marked `priority`. It is never held
  // behind a remainder sale: a sale marked `yieldToPriority` (the order sync's sales of one position left without a stop) that is
  // running or waiting while a priority sale is waiting or running stops at its next step and returns `yielded`, and the loss
  // stop's whole-account sale sells those shares as well. Before, the loss stop could wait about 20 seconds behind such a sale.
  priority?: boolean;
  yieldToPriority?: boolean;
}

// What a sale did and when (release A, fix 5: written to the close-out's run-log event).
export interface LiquidateSteps {
  cancelsSentAt: string[];
  cancelsAnsweredAt: string[];
  sells: Array<{ symbol: string; qty: number; at: string }>;
}

export interface LiquidateResult {
  flat: boolean;
  remaining: string[];
  sold: Array<{ symbol: string; qty: number }>;
  errors: string[];
  // Only with returnWhenOnlyOwnSells: the symbols still held whose every share is covered by a working sell of ours.
  working?: string[];
  steps?: LiquidateSteps;
  // Only with yieldToPriority: the sale stopped early because the daily loss stop's sale goes first.
  yielded?: boolean;
}

// Shares that sells this stack sent (client id cyrus-x-) could still sell, for one symbol.
export function ownOpenSellQty(orders: Order[], symbol: string): number {
  return orders.filter((o) => o.symbol === symbol && o.side === "sell" && o.clientOrderId.startsWith("cyrus-x-") && OPEN_STATUSES.has(o.status)).reduce((n, o) => n + remaining(o), 0);
}

export interface LiquidatorDeps {
  broker: SellBroker;
  gate: SellGate;
  now: () => Date;
  sleep?: (ms: number) => Promise<void>;
  log?: (event: string, data?: Record<string, unknown>) => void;
  // The speed release, item 9: waits up to `ms`, ending early (true) when a live order update arrives for one of these symbols, so a
  // wait for a cancel or a fill ends at the event; the timed look stays as the backstop. Without it (or with the stream down) this is
  // a plain pause.
  waitEvent?: (symbols: ReadonlySet<string>, ms: number) => Promise<boolean>;
}

// At most this many early wake-ups in one wait for cancels, so a burst of updates cannot turn the wait into a run of extra looks.
const MAX_EARLY_WAKES = 20;

export class Liquidator {
  private readonly d: LiquidatorDeps;
  private readonly sleep: (ms: number) => Promise<void>;
  private chain: Promise<unknown> = Promise.resolve();
  private running = 0;
  // Priority sales (the daily loss stop) asked for and not finished yet.
  private priorityPending = 0;
  constructor(deps: LiquidatorDeps) {
    this.d = deps;
    this.sleep = deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  }

  // The one sell gate every sale goes through (the loss stop's retry uses it directly, see risk.ts retryLossStopSale).
  get sellGate(): SellGate {
    return this.d.gate;
  }

  // True from the moment a liquidation is asked for until it has finished (including while it waits its turn). The
  // order sync's missing-exit check is off for that whole time, whichever path asked: close-out, flatten, loss stop,
  // carried position, emergency.
  isLiquidating(): boolean {
    return this.running > 0;
  }

  // One liquidation at a time: a second request waits for the first and then looks again (usually it finds the
  // account flat and has nothing to do), so two can never sell the same shares.
  // A priority sale still waits for the sale running ahead of it, but a remainder sale (`yieldToPriority`) gives way at its next step.
  flatten(o: LiquidateOptions): Promise<LiquidateResult> {
    this.running++;
    if (o.priority) this.priorityPending++;
    const run = this.chain.then(() => this.run(o));
    this.chain = run.catch(() => undefined);
    return run.finally(() => {
      this.running--;
      if (o.priority) this.priorityPending--;
    });
  }

  // True while a priority sale (the daily loss stop) is waiting or running.
  priorityWaiting(): boolean {
    return this.priorityPending > 0;
  }

  private async openOrders(): Promise<Order[]> {
    const listed = await this.d.broker.listOrdersPaged("open", FAR_PAST, 5);
    if (!listed.complete) throw new Error("the list of open orders is longer than I can read");
    return listed.orders;
  }

  private async run(o: LiquidateOptions): Promise<LiquidateResult> {
    const rounds = o.maxRounds ?? 4;
    const waitMs = o.waitCancelMs ?? 6_000;
    const only = o.only ? new Set(o.only) : null;
    const result: LiquidateResult = { flat: false, remaining: [], sold: [], errors: [] };
    const steps: LiquidateSteps = { cancelsSentAt: [], cancelsAnsweredAt: [], sells: [] };
    const stamp = () => this.d.now().toISOString();
    const cancelIds = [...new Set(o.cancelIds ?? [])];
    const heldNow = async (): Promise<Position[]> => (await this.d.broker.listPositions()).filter((p) => !only || only.has(p.symbol));
    // Item 6: a remainder sale stops at its next step while the daily loss stop's sale waits or runs; that sale sells these shares too.
    const yieldNow = (): boolean => o.yieldToPriority === true && !o.priority && this.priorityPending > 0;
    const yielded = (): LiquidateResult => {
      result.yielded = true;
      result.flat = false;
      result.errors.push("stopped: the daily loss stop's sale goes first and sells these shares");
      this.d.log?.("liquidation_yielded", { reason: o.reason, only: o.only ?? null });
      return done();
    };
    let earlyWakes = 0;
    // Item 9: a pause that ends early at a live update for these symbols. Returns the time to count as waited: the full pause when it
    // ran out, the time that really passed when an update ended it (at most MAX_EARLY_WAKES times, then the full pause again).
    const pauseFor = async (symbols: ReadonlySet<string>, ms: number): Promise<number> => {
      if (!this.d.waitEvent) {
        await this.sleep(ms);
        return ms;
      }
      if (earlyWakes >= MAX_EARLY_WAKES) {
        await this.sleep(ms); // after the cap, plain pauses again (group 1 review, round 1)
        return ms;
      }
      const t = this.d.now().getTime();
      const woke = await this.d.waitEvent(symbols, ms);
      if (!woke) return ms;
      earlyWakes++;
      return Math.min(ms, Math.max(0, this.d.now().getTime() - t));
    };
    const done = (): LiquidateResult => {
      if (steps.cancelsSentAt.length > 0 || steps.sells.length > 0) result.steps = steps;
      if (result.sold.length > 0 || result.errors.length > 0) this.d.log?.("liquidation_result", { reason: o.reason, flat: result.flat, remaining: result.remaining, sold: result.sold.length, errors: result.errors.slice(0, 5), ...(result.working ? { working: result.working } : {}) });
      return result;
    };

    for (let round = 1; round <= rounds; round++) {
      if (yieldNow()) return yielded();
      // Nothing is sent while the market is closed: a market sell then queues for the next open (and cancelling the
      // exits first would leave the position bare overnight). If the clock cannot be read, carry on.
      const clock = await this.d.broker.getClock().catch(() => null);
      if (clock && !clock.isOpen) {
        result.errors.push("the market is closed, so nothing was sent");
        try {
          result.remaining = (await heldNow()).map((p) => p.symbol);
        } catch {
          result.remaining = ["(could not read positions)"];
        }
        result.flat = result.remaining.length === 0;
        return done();
      }
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
        // Nothing to sell. A whole-account request still clears any order left open (an entry that never filled).
        if (!only && round === 1) {
          try {
            if ((await this.openOrders()).length > 0) await this.d.broker.cancelAllOrders();
          } catch (err) {
            result.errors.push(`could not cancel the remaining open orders: ${(err as Error).message.slice(0, 100)}`);
          }
        }
        result.flat = true;
        result.remaining = [];
        return done();
      }
      result.remaining = positions.map((p) => p.symbol);
      const symbols = new Set(positions.map((p) => p.symbol));

      // 1. Cancel what holds the shares (the exits resting at Alpaca) and, for a whole-account sale, any open order at
      //    all. Never a sell this liquidator sent itself in an earlier round: that sale may simply be slow, and cancelling
      //    it would only start the same sale again.
      let cancelled = false;
      let onlyOwn = false;
      try {
        const open = await this.openOrders();
        // Release A, fix 2 (the close-out only): every share still held is covered by a sell of ours that is working. Waiting out
        // the remaining rounds on it does nothing useful; the close-out waits for the fills itself, gently.
        if (o.returnWhenOnlyOwnSells && round >= 2 && positions.every((p) => ownOpenSellQty(open, p.symbol) >= p.qty - EPS)) onlyOwn = true;
        const ours = (x: Order) => x.side === "sell" && x.clientOrderId.startsWith("cyrus-x-");
        const others = open.filter((x) => !ours(x));
        const targets = only ? symbols : new Set(others.flatMap((x) => [x.symbol, ...flattenLegs(x).map((l) => l.symbol)]));
        // Alpaca's own "cancel every order" reaches a filled entry's resting exits whether or not the open list shows them
        // (that listing has only been seen to show an UNFILLED bracket with its legs), so a whole-account sale asks for it in
        // round 1 whatever the list says, and again later if shares are still reported as held by orders that nothing visible
        // explains. Never while one of our own sells is open: that would cancel the sale itself.
        const heldByHiddenOrders = positions.some((p) => p.qtyAvailable != null && p.qtyAvailable < p.qty - EPS && openSellQty(open, p.symbol) < p.qty - p.qtyAvailable - EPS);
        if (onlyOwn) {
          // nothing to cancel: see above
        } else if (!only && !open.some(ours) && (round === 1 || others.length > 0 || heldByHiddenOrders)) {
          cancelled = true;
          steps.cancelsSentAt.push(stamp());
          const r = await this.d.broker.cancelAllOrders();
          steps.cancelsAnsweredAt.push(stamp());
          if (r.failed.length > 0) result.errors.push(`round ${round}: cancel answers: ${r.failed.slice(0, 3).join("; ").slice(0, 200)}`);
        } else {
          // In an `only` sale, the ids the caller named are cancelled too (Alpaca's open list may not show a filled bracket's
          // legs). The client treats "already filled or cancelled" (404, 422) as done.
          const ids = [...new Set([...openOrderIds(others, targets), ...(only ? cancelIds : [])])];
          for (const id of ids) {
            cancelled = true;
            steps.cancelsSentAt.push(stamp());
            await this.d.broker.cancelOrder(id);
            steps.cancelsAnsweredAt.push(stamp());
          }
        }
      } catch (err) {
        result.errors.push(`round ${round}: cancel failed: ${(err as Error).message.slice(0, 120)}`);
      }
      if (onlyOwn) {
        result.working = positions.map((p) => p.symbol);
        result.remaining = result.working;
        return done();
      }
      if (yieldNow()) return yielded();

      // 2. Wait until Alpaca shows nothing holding those shares (no open order, and no shares reported as held by orders):
      //    a cancel is not instant. If the open orders cannot be read, no sell is sent this round.
      let openOrders: Order[] = [];
      let readOk = true;
      const t0 = this.d.now().getTime();
      let waited = 0;
      let polls = 0;
      let blindWaitDone = false;
      for (;;) {
        if (yieldNow()) return yielded();
        let held: Position[] = [];
        try {
          openOrders = await this.openOrders();
          held = await heldNow();
        } catch (err) {
          result.errors.push(`round ${round}: could not read open orders or positions: ${(err as Error).message.slice(0, 100)}`);
          readOk = false;
          break;
        }
        // If cancels were just asked for and nothing visible shows what they were holding, give them half a second once: a cancel
        // takes about 0.2 s, and neither the open list nor qty_available is guaranteed to show the exits.
        if (cancelled && polls === 0 && !blindWaitDone) {
          blindWaitDone = true;
          // A plain half second, never ended early by an update (group 1 review, round 1): Alpaca's open list may not show a filled
          // entry's exits, so this pause is what lets the cancels land before the first look.
          await this.sleep(500);
          waited += 500;
          continue;
        }
        const stillHolding = [...symbols].some((sym) => openSellQty(openOrders, sym) > EPS) || held.some((p) => p.qtyAvailable != null && p.qtyAvailable < p.qty - EPS);
        if (!stillHolding || waited >= waitMs) break;
        // Poll gently: a cancel usually finishes in a fraction of a second, and every look costs one of Alpaca's 200 requests a minute.
        const pause = [250, 400, 600, 800][Math.min(polls++, 3)]!;
        waited += await pauseFor(symbols, pause);
        if (this.d.now().getTime() - t0 > waitMs * 3) break; // a clock that moves much faster than the loop
      }

      // 3. Sell each symbol with an explicit quantity, through the sell gate (never more than is free).
      if (readOk) {
        this.d.gate.invalidate();
        let freshPositions: Position[] = [];
        try {
          freshPositions = await heldNow();
        } catch (err) {
          result.errors.push(`round ${round}: could not re-read positions: ${(err as Error).message.slice(0, 100)}`);
        }
        for (const p of freshPositions) {
          if (yieldNow()) return yielded();
          const free = Math.min(p.qty - openSellQty(openOrders, p.symbol), p.qtyAvailable ?? Infinity);
          if (!(free > EPS)) continue; // something is still holding the shares; the next round cancels again
          const id = `cyrus-x-${o.tradeDate.replaceAll("-", "")}-${p.symbol}-${this.d.now().getTime().toString(36)}-${round}`;
          const r = await this.d.gate.sell({ symbol: p.symbol, qty: free, clientOrderId: id, reason: o.reason });
          if (r.status === "sent") (result.sold.push({ symbol: p.symbol, qty: free }), steps.sells.push({ symbol: p.symbol, qty: free, at: stamp() }));
          else result.errors.push(`round ${round}: ${p.symbol}: ${r.reason}`);
        }
      }

      // 4. Look again after the sells have had a moment to fill (sooner if a fill or cancel for these symbols arrives).
      await pauseFor(symbols, 1_000);
    }

    try {
      const left = await heldNow();
      result.flat = left.length === 0;
      result.remaining = left.map((p) => p.symbol);
    } catch {
      result.remaining = result.remaining.length > 0 ? result.remaining : ["(could not read positions)"];
    }
    return done();
  }
}
