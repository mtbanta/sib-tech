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
import { MAX_EARLY_WAKES } from "./early-wake.ts";
import { MOVED_TAKE_PROFIT, MOVE_CLIENT_ID_PREFIX, MOVE_FILL_WAIT_MS, MOVE_MAX_PER_SALE, MOVE_SEND_WINDOW_MS, MOVE_SETS_CLIENT_ID, type MoveRow, type MoveWatch, MOVE_REPLACE_TIMEOUT_MS, MOVE_STOPS_TIMEOUT_MS, MOVE_VIEW_MAX_AGE_MS, pricedMoves, type QuoteIn, type Skip, stopVerdict, structuralCandidates, withStops } from "./moved-take-profit.ts";
import { isExitPair, pairBroken, pairStopLeg } from "./exit-pair.ts";

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

// The open sell orders `openSellQty` counts for one symbol (logging only, Michael's decision of 2026-11-09): each with the client id of
// the order it belongs to (a bracket's leg has none of its own worth showing, so its entry's).
export function openSellOrdersFor(orders: Order[], symbol: string): Array<{ id: string; clientOrderId: string; type: string; status: string; qty: number; filledQty: number }> {
  const out: Array<{ id: string; clientOrderId: string; type: string; status: string; qty: number; filledQty: number }> = [];
  const live = (o: Order) => o.symbol === symbol && o.side === "sell" && OPEN_STATUSES.has(o.status);
  for (const o of orders) {
    const group = o.side === "buy" ? flattenLegs(o).filter(live) : o.symbol === symbol ? [o, ...flattenLegs(o)].filter(live) : [];
    for (const x of group) out.push({ id: x.id, clientOrderId: o.clientOrderId, type: x.type, status: x.status, qty: x.qty, filledQty: x.filledQty });
  }
  return out;
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
// `notSent` (logging only, group 2 round 2 of the night release): the error came before any request was sent.
// The moved take-profit (2026-11-18): what a replace through the gate did. `unclear`: no clear answer came back (a network error, a timeout,
// a 5xx), so the replace may have happened; `notSent`: stopped before any request.
export type ReplaceResult = { status: "sent"; order: Order } | { status: "refused"; reason: string } | { status: "error"; reason: string; httpStatus?: number; unclear: boolean; notSent?: true };
export type SellResult = { status: "sent"; order: Order } | { status: "refused"; reason: string } | { status: "error"; reason: string; httpStatus?: number; notSent?: true };

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
  // `stopPrice` (A4 of 2026-11-12): a stop sell instead of a market sell. The same check applies: it may not be larger than the shares
  // held minus the sells already open.
  // `time` (item 1 of 2026-11-21, logging only): the sale's timer for the gate's own reads, when this sell makes them.
  // `takeProfitPrice` (the exit pair, 2026-11-21), with `stopPrice`: one OCO order of a limit at that price and the stop; the same check.
  sell(req: { symbol: string; qty: number; clientOrderId: string; reason: string; stopPrice?: number; takeProfitPrice?: number }, time?: GateReadTimer): Promise<SellResult> {
    const run = this.chain.then(() => this.run(req, time));
    this.chain = run.catch(() => undefined);
    return run;
  }

  // The moved take-profit (Michael's decision of 2026-11-18): the only way to replace a resting sell (a take-profit leg now; the stepped stop
  // raise later). In the same one-at-a-time queue as every sell. A replace never changes the quantity (the client sends none), so it adds no
  // shares to what is being sold and is not added to this gate's memory of sells sent. The check, against the broker's view as the sells use
  // it (read again when more than a second old): the shares named are no more than the shares held, and the order, when the open list shows
  // it, is a sell of that symbol for those shares. A stop leg is not shown in Alpaca's open list (2026-11-18), so an order not shown is not
  // refused for that alone. No retry here or in the client (Michael: "no retry").
  // `view` (optional): the caller's own read of the open orders and positions, taken at `atMs` (the earlier of the two reads). Used for the
  // check only while it is younger than `maxAgeMs` (default VIEW_MAX_AGE_MS, the sells' rule; at most 10 s); else the gate reads as usual. A
  // replace adds no shares (Alpaca keeps the order's own quantity, already held against the position), so a read a few seconds old cannot let
  // it oversell. It saves the gate's reads during a sale's moves. `timeoutMs`: the replace's own time limit (unclear after it).
  replace(req: { orderId: string; symbol: string; qty: number; limitPrice?: number; stopPrice?: number; clientOrderId?: string; reason: string; timeoutMs?: number }, view?: { positions: Position[]; open: Order[]; atMs: number; maxAgeMs?: number }, time?: GateReadTimer): Promise<ReplaceResult> {
    const run = this.chain.then(() => this.runReplace(req, view, time));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async runReplace(req: { orderId: string; symbol: string; qty: number; limitPrice?: number; stopPrice?: number; clientOrderId?: string; reason: string; timeoutMs?: number }, given?: { positions: Position[]; open: Order[]; atMs: number; maxAgeMs?: number }, time?: GateReadTimer): Promise<ReplaceResult> {
    let v: { positions: Position[]; open: Order[] };
    try {
      v = given && this.nowMs() - given.atMs < Math.min(given.maxAgeMs ?? VIEW_MAX_AGE_MS, 10_000) ? given : await this.read(time);
    } catch (err) {
      this.view = null;
      return { status: "error", reason: `could not read the position to check the replace: ${(err as Error).message.slice(0, 120)}`, unclear: false, notSent: true };
    }
    const held = v.positions.find((p) => p.symbol === req.symbol)?.qty ?? 0;
    const target = v.open.flatMap((o) => [o, ...flattenLegs(o)]).find((x) => x.id === req.orderId);
    const why =
      !(req.qty > 0) || req.qty > held + EPS
        ? `${req.qty} ${req.symbol} named, ${held} held`
        : target && (target.side !== "sell" || target.symbol !== req.symbol)
          ? `the order is not a sell of ${req.symbol}`
          : target && Math.abs(remaining(target) - req.qty) > EPS
            ? `the order covers ${remaining(target)} shares, not ${req.qty}`
            : null;
    if (why) {
      this.d.log?.("replace_refused", { symbol: req.symbol, orderId: req.orderId, qty: req.qty, held, reason: req.reason, why });
      this.view = null;
      return { status: "refused", reason: `refused a replace for ${req.symbol} (${req.reason}): ${why}` };
    }
    try {
      const order = await this.d.broker.replaceOrder(req.orderId, { ...(req.limitPrice !== undefined ? { limitPrice: req.limitPrice } : {}), ...(req.stopPrice !== undefined ? { stopPrice: req.stopPrice } : {}), ...(req.clientOrderId !== undefined ? { clientOrderId: req.clientOrderId } : {}) }, req.timeoutMs);
      return { status: "sent", order };
    } catch (err) {
      this.view = null;
      const status = err instanceof AlpacaError ? err.status : undefined;
      const notSent = status === 0;
      const unclear = !notSent && (status === undefined || status >= 500);
      return { status: "error", reason: (err as Error).message.slice(0, 200), ...(status !== undefined ? { httpStatus: status } : {}), unclear, ...(notSent ? { notSent: true as const } : {}) };
    }
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

  private async read(time?: GateReadTimer): Promise<{ positions: Position[]; open: Order[] }> {
    const t = this.nowMs();
    if (this.view && t - this.view.at < VIEW_MAX_AGE_MS) return this.view;
    // Open orders FIRST, then positions: a sell that fills between the two reads then shows up in both (the shares gone
    // from the position AND the sell still counted as open), so the gate errs toward refusing, never toward overselling.
    // Item 1 of 2026-11-21 (logging only): a sale's timer, when given, times each of the two reads; it changes nothing they return or throw.
    const readOpen = () => this.d.broker.listOrdersPaged("open", FAR_PAST, 5);
    const readPositions = () => this.d.broker.listPositions();
    const listed = time ? await time("openOrders", readOpen, (l) => l.pages) : await readOpen();
    if (!listed.complete) throw new Error("the list of open orders is longer than I can read, so I cannot count the sells already open");
    const positions = time ? await time("positions", readPositions) : await readPositions();
    this.view = { positions, open: listed.orders, at: t };
    // A sell sent clearly before this read is now part of what the broker shows.
    this.sent = this.sent.filter((x) => x.at + SEEN_MARGIN_MS > t);
    return this.view;
  }

  private async run(req: { symbol: string; qty: number; clientOrderId: string; reason: string; stopPrice?: number; takeProfitPrice?: number }, time?: GateReadTimer): Promise<SellResult> {
    let v: { positions: Position[]; open: Order[] };
    try {
      v = await this.read(time);
    } catch (err) {
      this.view = null;
      return { status: "error", reason: `could not read the position to check the sell: ${(err as Error).message.slice(0, 120)}`, notSent: true };
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
      const order = await this.d.broker.submitSell({ symbol: req.symbol, qty: req.qty, clientOrderId: req.clientOrderId, ...(req.stopPrice !== undefined ? { stopPrice: req.stopPrice } : {}), ...(req.stopPrice !== undefined && req.takeProfitPrice !== undefined ? { takeProfitPrice: req.takeProfitPrice } : {}) });
      this.sent.push({ symbol: req.symbol, qty: req.qty, at: this.nowMs() });
      return { status: "sent", order };
    } catch (err) {
      const msg = (err as Error).message.slice(0, 200);
      this.view = null;
      // Michael's item 2 of 2026-11-13 (afternoon): a fresh stop the order refused is logged once, by the sale (`fresh_stop_refused` or
      // `fresh_stop_unclear`), not also as a failed sale.
      if (req.stopPrice === undefined) this.d.log?.("sell_failed", { symbol: req.symbol, qty: req.qty, reason: req.reason, error: msg, status: err instanceof AlpacaError ? err.status : null });
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
  // Michael's decision 1 of 2026-11-17 (the cheap stuck retry, CHEAP_RETRY in risk.ts): one read of open orders then positions through the
  // sell gate, reused for every look in the round; the gate's sell reuses it while it is under a second old (VIEW_MAX_AGE_MS). Honoured only
  // for a one-symbol sale with nothing to cancel.
  cheap?: boolean;
  // Ruling B (group 1, round 2 of the night release), set only for a fresh stop that hit the 15 second limit: if a cancel this round is
  // not accepted, the attempt ends at once (no waiting and polling for a cancel that was not made); the order sync tries again on the
  // stuck backoff within the shared request budget.
  endOnCancelFail?: boolean;
  // Release A, fix 2, set only by the close-out: from round 2 on, if every share still held is covered by a sell this stack
  // sent (client id cyrus-x-), stop and return those symbols as `working` instead of waiting out the remaining rounds.
  returnWhenOnlyOwnSells?: boolean;
  // The speed release, item 6 (Michael's approval of 2026-11-05): the daily loss stop's sale is marked `priority`. It is never held
  // behind a remainder sale: a sale marked `yieldToPriority` (the order sync's sales of one position left without a stop) that is
  // running or waiting while a priority sale is waiting or running stops at its next step and returns `yielded`, and the loss
  // stop's whole-account sale sells those shares as well. Before, the loss stop could wait about 20 seconds behind such a sale.
  priority?: boolean;
  yieldToPriority?: boolean;
  // Michael's decision 3 of 2026-11-06 (measurement only): told about each sell the moment Alpaca has accepted it (before any wait
  // for its fill), with its client id and that moment. It must not throw; an error in it is caught and ignored.
  onSellSent?: (s: { symbol: string; qty: number; clientOrderId: string; atMs: number }) => void;
  // Release 1 of 2026-11-09 (Michael's approval of part B, builds/c2-proposal-2026-11-09.md): a cleanup sale of ONE entry, with
  // `only`. Only `cancelIds` are cancelled (that entry's own exits), never any other order of the symbol, and at most `maxQty[symbol]`
  // shares are sold in this liquidation (that entry's own shares), so a newer position on the same symbol keeps its exits and its
  // shares. The wait after the cancels ends as soon as that many shares are free, and there is no wait when nothing was cancelled.
  ownEntryOnly?: { maxQty: Record<string, number> };
  // Part A, step 1: end the attempt after a round in which nothing was sold and every symbol still to sell was held with no open
  // order visible (Alpaca reports fewer shares free than held, and no open sell explains it). Those symbols are returned in
  // `hiddenHold`, so the caller can retry them later without holding up its other work.
  endWhenHiddenHold?: boolean;
  // A4 of the proposal of 2026-11-12 (Michael's approval), with `ownEntryOnly` only: instead of selling a symbol's remainder at market,
  // place one stop sell for it at this price (per symbol), once every share of it is free, and end the liquidation there. Only when the
  // entry's shares were the whole holding at the first look (with another position on the symbol, the remainder is sold at market, as
  // before). If Alpaca refuses the stop outright (an answer in the 400s other than 429, for example the price is already below the stop
  // price), the shares are sold at market in the same round, as before.
  protectWithStop?: Record<string, number>;
  // The exit pair (Michael's approval of 2026-11-21, exit-pair.ts), with `protectWithStop` for the same symbol: an exit pair (a limit at this
  // take-profit price and the stop at `protectWithStop`'s price, one OCO order) is placed instead of the plain stop. Answer 2: a definite
  // refusal of the pair -> the plain stop at once (its own client id); that refused too -> the market sale, as before; an unclear answer at
  // either step ends the chain (nothing more is sent on top). At most two orders are sent in this step before the market sale.
  protectWithPair?: Record<string, { takeProfitPrice: number }>;
  // The exit pair (group 1, round 1): client ids of pairs remembered broken (answer 3); never taken as a fresh stop holding the shares.
  notProtection?: string[];
  // A5 of the proposal of 2026-11-12, with `ownEntryOnly` only: the entry filled as the stack's cancel reached Alpaca, and Alpaca cancels
  // its exits itself. Nothing is cancelled here; the sale waits (up to `waitCancelMs`) for Alpaca's cancel to free the shares. If they
  // never come free (Alpaca kept the exits), nothing is sold, no blocked sale is logged, and `exitsKept` lists the symbol.
  waitForAlpacaCancel?: boolean;
}

// What a sale did and when (release A, fix 5: written to the close-out's run-log event).
// Michael's approval of 2026-11-21, item 1 (logging only): each read from Alpaca's trading interface made inside one sale (the clock, the
// positions, the open orders, a cancel's one lookup), with when it was asked for, how long it took to answer, and whether it answered.
// The time includes the Alpaca client's own retries of that read, if any; it adds no request and no wait. At most SALE_READS_STORED a sale,
// the rest counted in `readsMore` (the first 40 are kept, so the first step's reads always are). Read by the close-out's record
// (`closeout_result.timing.reads`). When the moved take-profit sends a replace, round 1 starts again from fresh reads and keeps its number,
// so the record then holds two sets of round 1 reads: the first step is the first three entries (round 1's clock, positions and open
// orders, each answered by `movePhaseStartedAt`), and a second round 1 clock read, asked at or after it, begins the set after the moves. Not included: the move step's stop lookup and quote read (market data), and the close-out's own reads outside the sale.
export interface SaleRead {
  what: "clock" | "positions" | "openOrders" | "orderLookup";
  round: number;
  at: string;
  ms: number;
  ok: boolean;
  // openOrders only: the pages of 500 read.
  pages?: number;
  // "gate": made by the sell gate to check a sell or a replace of this sale (otherwise by the sale itself).
  by?: "gate";
}
export const SALE_READS_STORED = 40;
// The sale's timer handed to the sell gate for the gate's own reads (open orders, then positions) before a sell or a replace; those are
// stored with `by: "gate"`.
export type GateReadTimer = <T>(what: "openOrders" | "positions", f: () => Promise<T>, pagesOf?: (v: T) => number) => Promise<T>;

export interface LiquidateSteps {
  cancelsSentAt: string[];
  cancelsAnsweredAt: string[];
  sells: Array<{ symbol: string; qty: number; at: string }>;
  // The moved take-profit (2026-11-18): each replace sent, with Alpaca's answer (accepted or not).
  replaces?: Array<{ symbol: string; at: string; accepted: boolean }>;
}

export interface LiquidateResult {
  flat: boolean;
  remaining: string[];
  sold: Array<{ symbol: string; qty: number }>;
  errors: string[];
  // Only with returnWhenOnlyOwnSells: the symbols still held whose every share is covered by a working sell of ours.
  working?: string[];
  steps?: LiquidateSteps;
  // Michael's decision B of 2026-11-19 (logging only): when this sale began (its turn in the one-at-a-time sale queue came, before its
  // first read) and when its move step began (the moved take-profit's phase; absent when no move phase ran). Read by the close-out's record.
  startedAt?: string;
  movePhaseStartedAt?: string;
  // Michael's approval of 2026-11-21, item 1 (logging only): the sale's reads from Alpaca (SaleRead), and how many more were not kept.
  reads?: SaleRead[];
  readsMore?: number;
  // Only with yieldToPriority: the sale stopped early because the daily loss stop's sale goes first, or (with `ownEntryOnly`) it stood
  // aside at its turn, before any request (`stoodAside`): a sale of the whole account was asked for ("whole account"), or a close-out step
  // owns selling or the close-out time has come ("close-out").
  yielded?: boolean;
  stoodAside?: "whole account" | "close-out";
  // Only with endWhenHiddenHold: the symbols held with no open order visible when the attempt ended early (part A, step 1).
  hiddenHold?: string[];
  // Ruling B (group 1, round 2 of the night release): a cancel this sale sent was not accepted (an error from Alpaca or no answer).
  cancelFailed?: boolean;
  // Group 2, round 4 of the night release (read by the caller's log and alert): the order ids this sale sent a cancel for in an `only` sale
  // (`cancelsTried`), and those Alpaca answered without an error (`cancelsAccepted`; "already filled or cancelled" counts as answered).
  cancelsTried?: string[];
  cancelsAccepted?: string[];
  // Group 2, round 4 of the night release (reported only, nothing here acts on it): at the last round's look, a fresh stop of ours
  // (cyrus-p-) still open that holds the shares of a symbol this sale could not sell, and that this sale was cancelling (named in
  // `cancelIds`) or that shows pending cancel. The caller decides (ruling B: a timed-out stop whose cancel has not cleared).
  freshStopStillOpen?: Array<{ symbol: string; clientOrderId: string; orderId: string; status: string }>;
  // Group 2, round 6 of the night release (reported only): true when the last round's look read both the open orders and the positions,
  // so `freshStopStillOpen` and `heldByFreshStop` describe what Alpaca showed then. False when that round ended before such a look (a
  // failed read, a cancel that ended the try, the market closed).
  lastLookOk?: boolean;
  // Shares held per symbol at the first look and at the last look of this liquidation (release 1 of 2026-11-09: a cleanup sale of
  // one entry judges its own shares by the change, since a newer position on the same symbol may still be held).
  heldBefore?: Record<string, number>;
  heldAfter?: Record<string, number>;
  // Fix A (Michael's approval of 2026-11-10), with `ownEntryOnly` only: the entry's own shares as recounted when its last sale was
  // sent (the original count less the shares its exits took while their cancel landed), and the symbols held at the first look that
  // are no longer held at the last look (every one of its shares is gone, whoever sold them).
  ownTarget?: Record<string, number>;
  ownGone?: string[];
  // A4: the fresh stop placed (with `protectWithStop`), when one was.
  // `sentAtMs`: when the fresh stop was sent (Michael's ruling B of 2026-11-12: its time to confirm is stored, and an unclear one is
  // timed from it).
  freshStop?: { symbol: string; qty: number; stopPrice: number; clientOrderId: string; orderId: string; sentAtMs: number; answerMs: number; pair?: { takeProfitPrice: number }; afterPairRefusedMs?: number };
  // The exit pair: Alpaca refused the pair outright (its reason); the plain stop was then tried (answer 2).
  pairRefused?: string;
  // A4: Alpaca refused the fresh stop and the shares were sold at market instead (the reason Alpaca gave).
  freshStopRefused?: string;
  // A4: the fresh stop's answer was unclear (it may exist at Alpaca); nothing else was sent.
  freshStopUnclear?: { symbol: string; qty: number; stopPrice: number; clientOrderId: string; sentAtMs: number; pair?: { takeProfitPrice: number } };
  // A5: the symbols whose shares never came free because Alpaca kept the exits (nothing was sold for them).
  exitsKept?: string[];
  // A5, with `ownEntryOnly`: the symbols whose shares a sale of ours (cyrus-x-) already covers, so this cleanup had nothing to do.
  coveredByOwnSale?: string[];
  // A4 (group 1 review, round 1): the symbols whose shares a resting fresh stop of ours (cyrus-p-) holds, so nothing was sold: the
  // position is protected. With the open fresh stop that covers them, so the caller can remember it.
  heldByFreshStop?: Array<{ symbol: string; clientOrderId: string; orderId: string; qty: number; stopPrice: number | null; status: string; takeProfitPrice?: number | null }>;
  // The exit pair (group 1, round 1 of 2026-11-21): broken pairs (answer 3) this sale's own read found holding the shares, not taken as
  // protection; the caller remembers them so its next try cancels them and sells.
  brokenPairsSeen?: Array<{ symbol: string; clientOrderId: string; orderId: string; status: string; filledQty: number }>;
  // The moved take-profit (2026-11-18): how many replaces were sent, accepted, and filled within the wait (the rest went to today's path).
  moved?: { sent: number; accepted: number; filledInWait: number };
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
  // The redesign of 2026-11-14, part 2 (group 1, round 3; design 4.3, "from the close-out time, and while the 2:55 close-out, the mid-day
  // close-out or the afternoon close-out owns selling: no selling action"): the worker's own stand-aside rule (false from the close-out
  // time, and while a close-out, mid-day or carried step owns selling), asked when a one-entry cleanup sale's turn comes.
  ownSalesMayRun?: () => boolean;
  // Item 3 of the night build: told the moment a sale of the whole account is asked (the worker wakes one-entry first tries waiting for room).
  onWholeAccountAsk?: () => void;
  // Item 1 of the night build (round 1 follow-up): whether there is room for one lookup of a cancel's result above the urgent floor (the
  // shared request budget's `urgentRoom(1)`). Unset: always (the lookup is made, as in the tests that build a liquidator alone).
  lookupRoom?: () => boolean;
  // The moved take-profit (Michael's decision of 2026-11-18): what a sale of the whole account (and a close-out's retry of named symbols)
  // needs to move take-profits. Unset: no moves (today's path for every position). `quotes`: one market-data read of the latest bid and ask
  // (short time limit). `stopsFor`: the stop price of each take-profit leg's bracket, by leg id, from what the worker already holds (no
  // request); a leg left out has an unknown stop. `watch`: the live updates about the moves.
  // `room`: whether the shared request budget has room for one more request above the urgent floor (a replace is sent only then).
  moves?: {
    quotes: (symbols: string[]) => Promise<ReadonlyMap<string, QuoteIn>>;
    stopsFor: (legs: Array<{ legId: string; groupId: string; symbol: string }>, tradeDate: string) => Promise<ReadonlyMap<string, number>>;
    watch: MoveWatch;
    room?: () => boolean;
    // Whether the live order updates are connected (stored on each row, so a reader knows whether "not seen" can mean "did not happen").
    live?: () => boolean;
  };
}

// At most MAX_EARLY_WAKES early wake-ups in one liquidation, so a burst of updates cannot turn the waits into a run of extra looks (5
// since Michael's decision of 2026-11-06, early-wake.ts; the worker's waits also ignore updates while the budget is near the reserve).

// Item 1 of the night build (Michael's request of 2026-11-16, about 8:50 PM: "a flatten or close-out sends each cancel once and then waits
// for its result (live update or one lookup) instead of re-sending every round"). In a sale of the whole account (and a close-out's retry of
// some symbols), an order already pending cancel at Alpaca is never cancelled again, and an order this liquidator cancelled in the last
// CANCEL_MEMORY_MS is not cancelled again while its result is awaited: the open list each round (which live updates bring up to date), and,
// if it still shows the order working CANCEL_RESULT_WAIT_MS after the cancel, one lookup by its id. Only if that lookup shows it still working
// (the cancel refused or lost) is the cancel sent again: the wait doubling each time (2, 4, then 8 s). Per order per 60 s cancel memory: at
// most 2 re-sends (CANCEL_RESENDS_MAX), so 3 cancels; up to 6 lookups, 3 answered (CANCEL_LOOKUPS_MAX) and 3 failed
// (CANCEL_LOOKUP_FAILS_MAX; a failed lookup sends the cancel again within the re-sends instead); and up to about 3 stored
// `cancel_not_confirmed` rows (group 2, night round 2, with failed and answered lookups mixed: 3 cancels, 5 lookups, 3 rows). The memory
// restarts at the last re-send, or at a failed lookup after the re-sends are used; 60 s after that, an order still shown working is treated
// as new and the cycle repeats, so a cancel Alpaca keeps refusing costs about 3 cancels and up to 6 lookups a minute at most (measured in a
// test with answered lookups only: a cycle every 78 s). With too little room above the urgent floor the lookup is skipped and the cancel
// re-sent directly, as v24 does; a cancel that throws is not counted (CANCEL_THROWS_MAX). "Cancel every order" is sent in round 1 as before; in a later round only for orders
// not yet asked, or, for shares held by orders the list does not show, on the same bounded schedule. On 2026-11-16 (simulator), a `flatten`
// whose second round began before Alpaca's 8 s cancels had finished re-sent 81 single cancels for orders already pending cancel.
export const CANCEL_MEMORY_MS = 60_000;
export const CANCEL_RESULT_WAIT_MS = 2_000;
export const CANCEL_RESENDS_MAX = 2;
export const CANCEL_LOOKUPS_MAX = 3;
// Group 1, night build round 1 (finding 3): lookups that failed (threw) count separately, at most this many an order within the memory; each
// falls back to re-sending the cancel (within CANCEL_RESENDS_MAX), or, with no re-send left, to a later lookup after the doubling wait.
export const CANCEL_LOOKUP_FAILS_MAX = 3;
// Group 1, night build round 1 follow-up (the reviewer's cancel-throw probe): a single cancel that threw was not sent. It is tried again in
// the next round, as on v24, without counting as a re-send or starting the memory, at most this many times an order (kept for
// CANCEL_THROWS_MEMORY_MS); after that a cancel that throws counts as sent and `cancel_not_confirmed` is stored once.
export const CANCEL_THROWS_MAX = 3;
export const CANCEL_THROWS_MEMORY_MS = 10 * 60_000;
type CancelSent = { at: number; waitMs: number; resends: number; lookups: number; lookupFails?: number };

export class Liquidator {
  private readonly d: LiquidatorDeps;
  private readonly sleep: (ms: number) => Promise<void>;
  private chain: Promise<unknown> = Promise.resolve();
  private running = 0;
  // Item 1 of the night build: the cancels sent by whole-account sales, by order id, and the last "cancel every order".
  private readonly cancelSent = new Map<string, CancelSent>();
  private cancelAll: CancelSent = { at: -Infinity, waitMs: CANCEL_RESULT_WAIT_MS, resends: 0, lookups: 0 };
  // Group 1, night build round 1 follow-up: cancels that threw (not sent), by order id, and when the last one threw.
  private readonly cancelThrows = new Map<string, { n: number; at: number }>();

  // A single cancel threw (a 5xx or a network failure after the client's own retries): Alpaca did not take it, so it is not counted as sent.
  // It is forgotten (neither a re-send nor the start of the 60 s memory) and so sent again in the next round, as on v24, at most
  // CANCEL_THROWS_MAX times an order. The next one that throws is counted as sent (the item 1 schedule and its bounds apply) and stored once
  // as not confirmed.
  private cancelThrew(id: string, reason: string): void {
    const n = (this.cancelThrows.get(id)?.n ?? 0) + 1;
    this.cancelThrows.set(id, { n, at: this.d.now().getTime() });
    if (n <= CANCEL_THROWS_MAX) {
      this.cancelSent.delete(id);
      return;
    }
    if (n === CANCEL_THROWS_MAX + 1) this.d.log?.("cancel_not_confirmed", { reason, id, thrown: n });
  }
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

  // The redesign of 2026-11-14, part 2: true while a liquidation other than a one-entry cleanup sale (`ownEntryOnly`: the protection loop's
  // sales and the fast sale) is asked for or running: a close-out, `flatten`, the loss stop's sale, a carried-position sale. One position's
  // own sale no longer keeps the loop from deciding for the others (they wait their turn in this one-at-a-time queue).
  isLiquidatingOthers(): boolean {
    return this.runningOthers > 0;
  }
  private runningOthers = 0;

  // One liquidation at a time: a second request waits for the first and then looks again (usually it finds the
  // account flat and has nothing to do), so two can never sell the same shares.
  // A priority sale still waits for the sale running ahead of it, but a remainder sale (`yieldToPriority`) gives way at its next step.
  flatten(o: LiquidateOptions): Promise<LiquidateResult> {
    this.running++;
    const other = !o.ownEntryOnly;
    if (other) this.runningOthers++;
    if (other) this.d.onWholeAccountAsk?.();
    if (o.priority) this.priorityPending++;
    const run = this.chain.then(() => this.run(o));
    this.chain = run.catch(() => undefined);
    return run.finally(() => {
      this.running--;
      if (other) this.runningOthers--;
      if (o.priority) this.priorityPending--;
    });
  }

  // True while a priority sale (the daily loss stop) is waiting or running.
  priorityWaiting(): boolean {
    return this.priorityPending > 0;
  }

  // `time`: item 1 of 2026-11-21 (logging only), the sale's timer for the listing.
  private async openOrders(time?: <T extends { pages: number }>(f: () => Promise<T>) => Promise<T>): Promise<Order[]> {
    const read = () => this.d.broker.listOrdersPaged("open", FAR_PAST, 5);
    const listed = time ? await time(read) : await read();
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
    result.startedAt = stamp(); // decision B of 2026-11-19 (logging only)
    // Item 1 of 2026-11-21 (logging only): every read from Alpaca in this sale, timed with the same clock. Recording never throws and
    // never changes what the read returns or throws.
    const reads: SaleRead[] = [];
    let readsMore = 0;
    let readRound = 0; // the round the next read belongs to (0: before the first round)
    const noteRead = (what: SaleRead["what"], startMs: number, ok: boolean, pages?: number, by?: "gate"): void => {
      try {
        if (reads.length >= SALE_READS_STORED) {
          readsMore++;
          return;
        }
        reads.push({ what, round: readRound, at: new Date(startMs).toISOString(), ms: Math.max(0, this.d.now().getTime() - startMs), ok, ...(pages !== undefined ? { pages } : {}), ...(by ? { by } : {}) });
      } catch {
        // logging only
      }
    };
    const timedRead = async <T>(what: SaleRead["what"], fn: () => Promise<T>, pagesOf?: (v: T) => number, by?: "gate"): Promise<T> => {
      const t = this.d.now().getTime();
      let v: T;
      try {
        v = await fn();
      } catch (err) {
        noteRead(what, t, false, undefined, by);
        throw err;
      }
      let pages: number | undefined;
      try {
        pages = pagesOf ? pagesOf(v) : undefined;
      } catch {
        pages = undefined;
      }
      noteRead(what, t, true, pages, by);
      return v;
    };
    const gateTimer: GateReadTimer = (what, f, pagesOf) => timedRead(what, f, pagesOf, "gate");
    const cancelIds = [...new Set(o.cancelIds ?? [])];
    // Group 1, round 1 (2026-11-17): honoured only for the one caller's shape (one symbol, one round, its own entry's shares, nothing to
    // cancel, no stop to place, no wait on Alpaca's cancel), so no other sale can take it by mistake.
    const cheapOk = o.cheap === true && cancelIds.length === 0 && !!only && only.size === 1 && o.maxRounds === 1 && !!o.ownEntryOnly && !o.protectWithStop && !o.protectWithPair && !o.waitForAlpacaCancel;
    let cheapView: { positions: Position[]; open: Order[] } | null = null;
    // Group 1, round 1: the cheap look starts from a fresh read (the gate's view is cleared first), never a read from before an earlier sale
    // of the same symbol within the last second, which would make the gate refuse the sell and post a false "short sale" alert. Still 2 reads
    // here, and the gate's sell reuses them: 3 requests.
    const cview = async () => {
      if (!cheapView) {
        this.d.gate.invalidate();
        cheapView = await this.d.gate.look();
      }
      return cheapView;
    };
    // Item 1 of 2026-11-21: the plain reads are timed (the cheap retry's one look is never a close-out's and is not timed).
    const heldNow = async (): Promise<Position[]> => (cheapOk ? (await cview()).positions : await timedRead("positions", () => this.d.broker.listPositions())).filter((p) => !only || only.has(p.symbol));
    const openOrdersR = async (): Promise<Order[]> => (cheapOk ? (await cview()).open : await this.openOrders((f) => timedRead("openOrders", f, (l) => l.pages)));
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
    let blocked = 0; // logging only: symbols skipped in step 3 because their shares were not free
    // Release 1 of 2026-11-09, part B: shares sold per symbol in this liquidation, and what is still to sell under `ownEntryOnly`.
    const soldBy = new Map<string, number>();
    const own = o.ownEntryOnly && only ? o.ownEntryOnly.maxQty : null;
    const need = (sym: string): number => (own ? Math.max(0, (own[sym] ?? 0) - (soldBy.get(sym) ?? 0)) : Infinity);
    // Fix A (Michael's approval of 2026-11-10): the entry's own shares still to sell, recounted from the holding. On 2026-11-10 the
    // take-profit filled more shares while its cancel was landing (QXO: 9 counted, 8 of them then filled at the take-profit), and the
    // sale waited its full 6 seconds for a count that could never come free. Shares that leave the holding are no longer the entry's
    // to sell: held now, less our own sells still working. Never above the original count less what this liquidation sold. No extra
    // request: it uses the reads the wait already makes.
    // Only when the entry's shares were the whole holding at the first look: with another position on the symbol, a drop in the holding
    // could be that position's exit filling, so the original count is kept there (release 1's behaviour; the cleanup sale's one extra
    // lookup still keeps a stale count from being reported stuck).
    const soleHolder = (sym: string): boolean => {
      const before = result.heldBefore?.[sym];
      return own !== null && before !== undefined && before <= (own[sym] ?? 0) + EPS;
    };
    const ownLeft = (sym: string, heldQty: number, open: Order[]): number => {
      if (!own) return Infinity;
      if (!soleHolder(sym)) return need(sym);
      return Math.min(need(sym), Math.max(0, heldQty - ownOpenSellQty(open, sym)));
    };
    // Part A, step 1: a cancel sent in this attempt explains a hold even when Alpaca's open list does not show the order (it has not
    // been seen to show a filled entry's exits), so a hold counts as unexplained only in an attempt that cancelled nothing.
    // A5: Alpaca's own cancel of the exits is what the wait is for, so the attempt counts as having cancelled something.
    let cancelledInAttempt = o.waitForAlpacaCancel === true;
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
    // The moved take-profit (Michael's decision of 2026-11-18; his answers "moves first" and "one bracket only"): in a sale that is not one
    // entry's own (a sale of the whole account, or a close-out's retry of named symbols), once, in round 1, from the positions and open orders
    // that round has just read (no extra trading request when nothing qualifies): the take-profits that qualify (moved-take-profit.ts) are
    // replaced with a selling limit, one at a time inside fixed bounds, and the sale waits up to MOVE_FILL_WAIT_MS for them (ending early once
    // the live updates report every one filled). If any replace was sent, round 1 then starts again from fresh reads, exactly as today: its
    // cancels also cancel a moved take-profit that did not fill (whatever its id), and those shares are sold at market (the fallback).
    let movePhaseDone = !(MOVED_TAKE_PROFIT.on && this.d.moves && !o.ownEntryOnly);
    const moveRows: MoveRow[] = [];
    let moveCheckPending = false;
    // Michael's request of 2026-11-19: the shares of each symbol that today's path's market sales (cyrus-x-) were sent to sell in this sale,
    // for each move row's `fallbackSoldQty` (whether the backup step actually sold). Only market sales count, never a fresh stop.
    const marketSentBy = new Map<string, number>();
    // The first read of positions after the moves (before today's path cancels anything): a moved symbol no longer held was sold by its
    // move (or its own exits) within the wait; it is counted as sold by this sale (the close-out's record, the loss stop's message), and
    // each row's `fallback` says whether today's path still had shares to sell. No request: round 1 makes this read anyway.
    const checkMovesAgainst = (held: Position[]): void => {
      if (!moveCheckPending) return;
      moveCheckPending = false;
      const still = new Set(held.map((p) => p.symbol));
      let gone = 0;
      for (const row of moveRows) {
        const tried = row.accepted || (row.answer ?? "").startsWith("unclear");
        row.fallback = !tried ? true : still.has(row.symbol);
        if (tried && !still.has(row.symbol)) {
          gone++;
          result.sold.push({ symbol: row.symbol, qty: row.qty });
          soldBy.set(row.symbol, (soldBy.get(row.symbol) ?? 0) + row.qty);
        }
      }
      if (result.moved) result.moved.filledInWait = gone;
    };
    // Returns true when at least one replace was sent (whatever its answer): round 1 then starts again from fresh reads. Never throws: any
    // error here is logged and the sale goes on with today's path (the advisor's point: a throw must not skip round 1's cancels).
    // Michael's request of 2026-11-19: why each position was not moved, stored once per move phase (`move_phase_skips`), whether or not any
    // move went out (before, only a phase with no move logged its skips). At most MOVE_SKIPS_STORED positions are listed; `more` counts the rest.
    let phaseSkips: Skip[] = [];
    const MOVE_SKIPS_STORED = 40;
    // The moves this phase planned to send, how many it tried, and whether the ones not sent are already listed: if the phase throws
    // part way (group 1 and group 2, round 1 notes), the moves never tried are listed as "move phase failed".
    let sendList: Array<{ symbol: string }> = [];
    let triedSoFar = 0;
    let unsentListed = false;
    const movePhase = async (held: Position[], open: Order[], readAtMs: number): Promise<boolean> => {
      result.movePhaseStartedAt = stamp(); // decision B of 2026-11-19 (logging only); the phase runs at most once a sale
      let sent = 0;
      phaseSkips = [];
      sendList = [];
      triedSoFar = 0;
      unsentListed = false;
      try {
        sent = await movePhaseInner(held, open, readAtMs);
      } catch (err) {
        if (!unsentListed) phaseSkips.push(...sendList.slice(triedSoFar).map((m) => ({ symbol: m.symbol, why: "move phase failed" })));
        this.d.log?.("move_phase_failed", { reason: o.reason, error: (err as Error).message.slice(0, 160), sent });
        // A replace may have gone out before the error (group 1 and group 2, round 2): round 1 then starts again and judges the moves as usual.
        sent = Math.max(sent, moveRows.some((r) => r.accepted || r.httpStatus !== null || r.answer === null || (r.answer ?? "").startsWith("unclear")) ? 1 : 0);
        if (sent > 0) moveCheckPending = true;
      }
      // Moves that were never sent (refused by the sell gate, or stopped before the send): today's path sells those shares.
      if (sent === 0) for (const row of moveRows) row.fallback ??= true;
      if (phaseSkips.length > 0) {
        // Group 1, round 1 note: this log is outside the try above, so it gets its own catch (the phase never throws into the sale, which
        // would skip round 1's cancels).
        try {
          const positions = held.filter((p) => p.qty > EPS).length;
          this.d.log?.("move_phase_skips", { reason: o.reason, positions, moved: moveRows.length, skipped: phaseSkips.slice(0, MOVE_SKIPS_STORED), ...(phaseSkips.length > MOVE_SKIPS_STORED ? { more: phaseSkips.length - MOVE_SKIPS_STORED } : {}) });
        } catch {
          /* a record must never break a sale */
        }
      }
      return sent > 0;
    };
    const movePhaseInner = async (held: Position[], open: Order[], readAtMs: number): Promise<number> => {
      const mv = this.d.moves!;
      mv.watch.reset();
      const structuralR = structuralCandidates(held, open);
      phaseSkips.push(...structuralR.skipped);
      const structural = structuralR.candidates;
      if (structural.length === 0) return 0;
      const skipAll = (list: Array<{ symbol: string; oldLimit: number }>, why: string) => phaseSkips.push(...list.map((c) => ({ symbol: c.symbol, why, oldLimit: c.oldLimit })));
      let stops: ReadonlyMap<string, number>;
      try {
        // One time limit for the whole lookup (group 1, round 1): a stop not found by then is unknown (today's path). The timer is cleared so
        // a quick answer leaves nothing running.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const limit = new Promise<"late">((res) => (timer = setTimeout(() => res("late"), MOVE_STOPS_TIMEOUT_MS)));
        const got = await Promise.race([mv.stopsFor(structural.map((c) => ({ legId: c.legId, groupId: c.groupId, symbol: c.symbol })), o.tradeDate), limit]).finally(() => clearTimeout(timer));
        if (got === "late") {
          this.d.log?.("move_phase_skipped", { reason: o.reason, why: `stop prices not found within ${MOVE_STOPS_TIMEOUT_MS} ms` });
          skipAll(structural, `stop prices not found within ${MOVE_STOPS_TIMEOUT_MS} ms`);
          return 0;
        }
        // The exit pair (2026-11-21): a pair whose stop leg was listed already carries its stop price; it is used when the lookup has none.
        const known = new Map(got);
        for (const c of structural) if (Number.isFinite(c.stopPrice) && c.stopPrice > 0 && !known.has(c.legId)) known.set(c.legId, c.stopPrice);
        stops = known;
      } catch (err) {
        this.d.log?.("move_phase_skipped", { reason: o.reason, why: "stop prices not found", error: (err as Error).message.slice(0, 120) });
        skipAll(structural, "stop prices not found");
        return 0;
      }
      const stopped = withStops(structural, stops);
      phaseSkips.push(...stopped.skipped);
      const { candidates } = stopped;
      if (candidates.length === 0) return 0; // nothing could qualify (every take-profit within 3 cents of its stop, or no stop known): no quote read, no wait
      let quotes: ReadonlyMap<string, QuoteIn>;
      try {
        quotes = await mv.quotes(candidates.map((c) => c.symbol));
      } catch (err) {
        this.d.log?.("move_phase_skipped", { reason: o.reason, why: "quote read failed", error: (err as Error).message.slice(0, 120) });
        skipAll(candidates, "quote read failed");
        return 0;
      }
      const { moves, skipped } = pricedMoves(candidates, quotes, this.d.now().getTime());
      phaseSkips.push(...skipped);
      if (moves.length === 0) {
        this.d.log?.("move_phase_none", { reason: o.reason, candidates: candidates.length, skipped: skipped.slice(0, 10) });
        return 0;
      }
      const t0 = this.d.now().getTime();
      let sent = 0;
      const accepted: Array<{ groupId: string; row: MoveRow }> = [];
      let live: boolean | null = null;
      try {
        live = mv.live ? mv.live() : null;
      } catch {
        live = null;
      }
      // Why the moves after a stop were not sent (stored with the skips).
      let notSentWhy: string | null = null;
      let tried = 0;
      sendList = moves.slice(0, MOVE_MAX_PER_SALE);
      if (moves.length > MOVE_MAX_PER_SALE) phaseSkips.push(...moves.slice(MOVE_MAX_PER_SALE).map((m) => ({ symbol: m.symbol, why: `more than ${MOVE_MAX_PER_SALE} moves in one sale` })));
      for (const m of moves.slice(0, MOVE_MAX_PER_SALE)) {
        if (this.d.now().getTime() - t0 > MOVE_SEND_WINDOW_MS) {
          notSentWhy = `send window of ${MOVE_SEND_WINDOW_MS} ms over`;
          break;
        }
        if (yieldNow()) {
          notSentWhy = "a sale that goes first was asked for";
          break;
        }
        if (mv.room && !mv.room()) {
          this.d.log?.("move_phase_no_room", { reason: o.reason, sent, left: moves.length - sent });
          notSentWhy = "no room in the request budget";
          break;
        }
        tried++;
        triedSoFar = tried;
        const sentAtMs = this.d.now().getTime();
        const cid = MOVE_SETS_CLIENT_ID.on ? `${MOVE_CLIENT_ID_PREFIX}${o.tradeDate.replaceAll("-", "")}-${m.symbol}-${sentAtMs.toString(36)}` : undefined;
        const row: MoveRow = { ...(m.pair ? { pair: true as const } : {}), reason: o.reason, symbol: m.symbol, qty: m.qty, oldId: m.legId, newId: null, groupId: m.groupId, limit: m.limit, oldLimit: m.oldLimit, stopPrice: m.stopPrice, bid: m.bid, quoteAgeMs: m.quoteAgeMs, tradePrice: m.tradePrice, tradeAgeMs: m.tradeAgeMs, sentAtMs, answerMs: 0, accepted: false, answer: null, httpStatus: null, clientId: cid ?? null, filledAtMs: null, timeToFillMs: null, filledQtySeen: null, stopCancelledByAlpaca: null, fallback: null, fallbackSoldQty: 0, liveUpdates: live };
        moveRows.push(row);
        mv.watch.expect(m.groupId, m.legId, m.qty, m.pair?.legIds ?? []); // before the send: a fill may come before the answer
        const r = await this.d.gate.replace({ orderId: m.legId, symbol: m.symbol, qty: m.qty, limitPrice: m.limit, ...(cid ? { clientOrderId: cid } : {}), reason: `${o.reason}, moved take-profit`, timeoutMs: MOVE_REPLACE_TIMEOUT_MS }, { positions: held, open, atMs: readAtMs, maxAgeMs: MOVE_VIEW_MAX_AGE_MS }, gateTimer);
        row.answerMs = this.d.now().getTime() - sentAtMs;
        if (r.status === "sent") {
          sent++;
          row.accepted = true;
          row.newId = r.order.id;
          row.clientId = r.order.clientOrderId;
          mv.watch.register(m.groupId, r.order.id, m.pair ? flattenLegs(r.order).map((l) => l.id) : []);
          accepted.push({ groupId: m.groupId, row });
        } else {
          if (r.status === "error" && !r.notSent) sent++; // a request went out (refused by Alpaca, or no clear answer)
          row.answer = r.status === "refused" ? `sell gate: ${r.reason}` : r.unclear ? `unclear: ${r.reason}` : r.reason;
          row.httpStatus = r.status === "error" ? (r.httpStatus ?? null) : null;
          if (!(r.status === "error" && r.unclear)) mv.watch.drop(m.groupId);
          // No further replace after a rate-limit answer or an unclear one: the rest take today's path.
          if (r.status === "error" && (r.unclear || r.httpStatus === 429)) {
            (steps.replaces ??= []).push({ symbol: m.symbol, at: stamp(), accepted: false });
            notSentWhy = r.httpStatus === 429 ? "no further move after a rate-limit answer" : "no further move after an unclear answer";
            break;
          }
        }
        (steps.replaces ??= []).push({ symbol: m.symbol, at: stamp(), accepted: row.accepted });
      }
      if (notSentWhy) phaseSkips.push(...moves.slice(tried, MOVE_MAX_PER_SALE).map((m) => ({ symbol: m.symbol, why: notSentWhy! })));
      unsentListed = true;
      if (accepted.length > 0) {
        // Bounded by time: until every accepted move has filled, or MOVE_FILL_WAIT_MS after the last one was sent. Each wait ends early at a
        // live update for these symbols; the count is a backstop against a burst of updates (no request is made here).
        const last = Math.max(...accepted.map((a) => a.row.sentAtMs)) + MOVE_FILL_WAIT_MS;
        const syms = new Set(accepted.map((a) => a.row.symbol));
        const maxWaits = 40 + 20 * accepted.length; // a move makes 3 or 4 updates (replaced, new, fill, the stop's cancel)
        for (let i = 0; i < maxWaits && this.d.now().getTime() < last && !accepted.every((a) => mv.watch.filled(a.groupId)); i++) {
          if (yieldNow()) break;
          const left = Math.max(1, Math.min(500, last - this.d.now().getTime()));
          if (this.d.waitEvent) await this.d.waitEvent(syms, left);
          else await this.sleep(left);
        }
      }
      // Whether each moved symbol is still held is judged by round 1's fresh read of positions, which comes next (moveCheckPending): the
      // live updates may not be connected, and an unclear replace may have happened.
      moveCheckPending = sent > 0;
      result.moved = { sent, accepted: accepted.length, filledInWait: 0 };
      return sent;
    };
    // One stored row per move (Michael: "accepted or refused with Alpaca's answer, stop cancelled by Alpaca, time to fill, fallback used"),
    // completed from the live updates seen by the end of the sale. Written once.
    const writeMoveRows = (): void => {
      const mv = this.d.moves;
      const firstCancel = steps.cancelsSentAt[0] ? Date.parse(steps.cancelsSentAt[0]) : null;
      for (const row of moveRows.splice(0)) {
        row.fallbackSoldQty = marketSentBy.get(row.symbol) ?? 0;
        if (mv) {
          const seen = mv.watch.seen(row.groupId);
          if (!row.newId && seen.newId && (row.answer ?? "").startsWith("unclear")) row.newId = seen.newId; // an unclear replace that happened
          if (row.newId) {
            row.filledAtMs = seen.filledAtMs;
            row.timeToFillMs = seen.filledAtMs !== null ? Math.max(0, seen.filledAtMs - row.sentAtMs) : null;
            row.filledQtySeen = seen.filledQty;
            row.stopCancelledByAlpaca = stopVerdict(seen, firstCancel);
          }
        }
        this.d.log?.("take_profit_moved", { ...row });
      }
    };
    const done = (): LiquidateResult => {
      writeMoveRows();
      if (reads.length > 0) result.reads = reads; // item 1 of 2026-11-21 (logging only)
      if (readsMore > 0) result.readsMore = readsMore;
      if (steps.cancelsSentAt.length > 0 || steps.sells.length > 0 || (steps.replaces?.length ?? 0) > 0) result.steps = steps;
      // Michael's decision of 2026-11-09 (logging only): an attempt that sold nothing and met no error but left shares held is logged
      // too (on 2026-11-09 such attempts left no trace), with how many times a symbol was skipped because its shares were not free.
      if (result.sold.length > 0 || result.errors.length > 0 || !result.flat) this.d.log?.("liquidation_result", { reason: o.reason, flat: result.flat, remaining: result.remaining, sold: result.sold.length, errors: result.errors.slice(0, 5), ...(result.working ? { working: result.working } : {}), ...(blocked > 0 ? { blocked } : {}) });
      return result;
    };

    // The redesign of 2026-11-14, part 2 (group 1, round 2; design 4.3, "while the 2:55 close-out, the mid-day close-out or the afternoon
    // close-out owns selling: no selling action", unchanged from v22, where the order sync stood aside while any liquidation was asked for):
    // a one-entry cleanup sale whose turn in this queue comes while a sale of the whole account (a close-out, `flatten`, the loss stop's
    // sale, a carried-position sale) is asked for or running stands aside before sending, cancelling or reading anything; that sale sells
    // these shares. A cleanup sale already running when one is asked for carries on (as in v22), except for the loss stop (item 6).
    // Group 1, round 3: also from the close-out time (the set time, 2:55 by default) and while a close-out, mid-day or carried step owns selling (the worker's rule),
    // so a sale whose turn comes between the close-out time and the close-out's own ask does not run ahead of it either (v22's sync started no
    // cleanup from 2:55:00).
    const standAside: LiquidateResult["stoodAside"] | null = !o.ownEntryOnly ? null : this.runningOthers > 0 ? "whole account" : this.d.ownSalesMayRun?.() === false ? "close-out" : null;
    if (standAside) {
      result.yielded = true;
      result.stoodAside = standAside;
      result.flat = false;
      result.errors.push(standAside === "whole account" ? "stood aside: a sale of the whole account was asked for and sells these shares" : "stood aside: the close-out owns selling (or its time has come) and sells these shares");
      this.d.log?.("liquidation_stood_aside", { reason: o.reason, only: o.only ?? null, for: standAside });
      return done();
    }
    for (let round = 1; round <= rounds; round++) {
      readRound = round; // item 1 of 2026-11-21 (logging only); a round started again after the moves keeps its number
      result.lastLookOk = false; // set true below only by this round's successful look (reported only)
      if (yieldNow()) return yielded();
      // Nothing is sent while the market is closed: a market sell then queues for the next open (and cancelling the
      // exits first would leave the position bare overnight). If the clock cannot be read, carry on.
      const clock = await timedRead("clock", () => this.d.broker.getClock()).catch(() => null);
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
      const positionsReadAt = this.d.now().getTime(); // the moved take-profit: the replaces' check may use this round's reads
      try {
        positions = await heldNow();
        if (!result.heldBefore) result.heldBefore = Object.fromEntries(positions.map((p) => [p.symbol, p.qty]));
        checkMovesAgainst(positions);
      } catch (err) {
        result.errors.push(`round ${round}: could not read positions: ${(err as Error).message.slice(0, 100)}`);
        result.remaining = ["(could not read positions)"];
        await this.sleep(1_000 * round);
        continue;
      }
      // Part B (one entry only): that entry's own shares are all sold and the holding has fallen by that much: done (a newer position on
      // the same symbol may still be held, with its own exits). Fix A of 2026-11-10: when the entry held the whole symbol, its holding at
      // 0 is enough, whoever sold the shares (our sale, or its own take-profit while its cancel landed).
      if (own && only && [...only].every((sym) => (need(sym) <= EPS || soleHolder(sym)) && (positions.find((p) => p.symbol === sym)?.qty ?? 0) <= (result.heldBefore?.[sym] ?? Infinity) - (own[sym] ?? 0) + EPS)) break;
      if (positions.length === 0) {
        // Nothing to sell. A whole-account request still clears any order left open (an entry that never filled).
        if (!only && round === 1) {
          try {
            if ((await openOrdersR()).length > 0) await this.d.broker.cancelAllOrders();
          } catch (err) {
            result.errors.push(`could not cancel the remaining open orders: ${(err as Error).message.slice(0, 100)}`);
          }
        }
        result.flat = true;
        result.remaining = [];
        // Fix A, group 1 review round 1 (note 1): one entry's sale ending here (its symbol no longer held) has had every share leave
        // the holding, so its verdict is "sold", not "not filled yet".
        if (own && only) {
          result.heldAfter = {};
          result.ownGone = [...only].filter((sym) => result.heldBefore?.[sym] !== undefined);
        }
        return done();
      }
      result.remaining = positions.map((p) => p.symbol);
      const symbols = new Set(positions.map((p) => p.symbol));

      // 1. Cancel what holds the shares (the exits resting at Alpaca) and, for a whole-account sale, any open order at
      //    all. Never a sell this liquidator sent itself in an earlier round: that sale may simply be slow, and cancelling
      //    it would only start the same sale again.
      let cancelled = false;
      let onlyOwn = false;
      // Item 1 of the night build: a round in which 20ba5bd would have cancelled again (orders still shown, pending cancel included, or
      // shares held by orders the list does not show) keeps 20ba5bd's timing, its blind half second and then the same looks, without the
      // cancel, so no sale goes out later than on 20ba5bd.
      let v24Cancelled = false;
      try {
        const open = await openOrdersR();
        // The moved take-profit (2026-11-18): once, in round 1, from this round's reads. If any replace was sent, round 1 starts again from
        // fresh reads (today's path, unchanged), with the gate's view cleared so no sell is checked against a list from before the moves.
        if (!movePhaseDone) {
          movePhaseDone = true;
          if (await movePhase(positions, open, positionsReadAt)) {
            this.d.gate.invalidate();
            round--;
            continue;
          }
        }
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
        // Item 1 of the night build (whole-account sales and close-out retries; one entry's own sale is unchanged): what still needs a
        // cancel. `fresh`: shown working and never cancelled here; `awaited`: cancelled here, shown working (or not shown at all), result
        // awaited. Orders shown pending cancel are left alone.
        const nowMs = this.d.now().getTime();
        for (const [id, c] of this.cancelSent) if (nowMs - c.at > CANCEL_MEMORY_MS) this.cancelSent.delete(id);
        for (const [id, x] of this.cancelThrows) if (nowMs - x.at > CANCEL_THROWS_MEMORY_MS) this.cancelThrows.delete(id);
        const statusOf = new Map<string, string>();
        for (const x of others) {
          statusOf.set(x.id, x.status);
          for (const l of flattenLegs(x)) statusOf.set(l.id, l.status);
        }
        const consider = own ? [] : [...new Set([...openOrderIds(others, targets), ...(only ? cancelIds : [])])].filter((id) => statusOf.get(id) !== "pending_cancel");
        const fresh = consider.filter((id) => !this.cancelSent.has(id));
        const awaited = consider.filter((id) => this.cancelSent.has(id));
        const cancelAllDue = round === 1 || fresh.length > 0 || (heldByHiddenOrders && nowMs - this.cancelAll.at >= this.cancelAll.waitMs && this.cancelAll.resends < CANCEL_RESENDS_MAX);
        // 20ba5bd's own rule for when this round cancels (a whole-account sale: "cancel every order" while no sell of ours is open and
        // anything is shown or held; otherwise every order shown, plus a close-out retry's named ids).
        v24Cancelled = !own && !onlyOwn && (!only && !open.some(ours) ? round === 1 || others.length > 0 || heldByHiddenOrders : openOrderIds(others, targets).length > 0 || (only !== null && cancelIds.length > 0));
        if (onlyOwn) {
          // nothing to cancel: see above
        } else if (!only && !open.some(ours) && cancelAllDue) {
          cancelled = true;
          steps.cancelsSentAt.push(stamp());
          const r = await this.d.broker.cancelAllOrders();
          steps.cancelsAnsweredAt.push(stamp());
          if (r.failed.length > 0) result.errors.push(`round ${round}: cancel answers: ${r.failed.slice(0, 3).join("; ").slice(0, 200)}`);
          // Every order it covered is now awaited; a later "cancel every order" for hidden holds waits 2 s, then 4 s, at most twice more.
          if (round === 1 || fresh.length > 0) this.cancelAll = { at: nowMs, waitMs: CANCEL_RESULT_WAIT_MS, resends: 0, lookups: 0 };
          else this.cancelAll = { at: nowMs, waitMs: this.cancelAll.waitMs * 2, resends: this.cancelAll.resends + 1, lookups: 0 };
          for (const id of fresh) this.cancelSent.set(id, { at: nowMs, waitMs: CANCEL_RESULT_WAIT_MS, resends: 0, lookups: 0 });
        } else if (!own) {
          // Single cancels (one of our own sells is open, or a close-out's retry of some symbols): each fresh order once.
          for (const id of fresh) {
            cancelled = true;
            cancelledInAttempt = true;
            steps.cancelsSentAt.push(stamp());
            (result.cancelsTried ??= []).push(id);
            this.cancelSent.set(id, { at: this.d.now().getTime(), waitMs: CANCEL_RESULT_WAIT_MS, resends: 0, lookups: 0 });
            try {
              await this.d.broker.cancelOrder(id);
            } catch (err) {
              this.cancelThrew(id, o.reason);
              throw err; // the round goes on as on v24 (the error is recorded below)
            }
            (result.cancelsAccepted ??= []).push(id);
            steps.cancelsAnsweredAt.push(stamp());
          }
        }
        // Item 1: an awaited cancel whose result has not shown after its wait gets one lookup; only if that shows the order still working
        // (not pending cancel, cancelled, filled or gone) is the cancel sent again (bounded, see CANCEL_RESENDS_MAX).
        if (!onlyOwn) for (const id of awaited) {
          const c = this.cancelSent.get(id)!;
          const t = this.d.now().getTime();
          if (t - c.at < c.waitMs || c.lookups >= CANCEL_LOOKUPS_MAX || (c.lookupFails ?? 0) >= CANCEL_LOOKUP_FAILS_MAX) continue;
          let still = false;
          // Night build round 1 follow-up (a judgment call under Michael's overnight instructions, item 1: "fastest protection of positions
          // without a stop first, then fewest rate-limit answers on sale, cancel or close-out steps"): when Alpaca's remaining, as the
          // governor estimates it, less the room reserved unsent, is below the urgent floor of 20 plus the lookup's 1, the lookup is skipped and
          // the cancel sent again directly, as v24 does (a lookup there cost a sale check a rate-limit answer: sold 18 s later than v24 in the
          // simulator). The re-send allowance and every other bound are unchanged.
          if (this.d.lookupRoom && !this.d.lookupRoom()) {
            if (c.resends >= CANCEL_RESENDS_MAX) continue; // nothing left to send: looked up once there is room (bounded as above)
            this.d.log?.("cancel_lookup_skipped", { reason: o.reason, id, resends: c.resends }); // Fly's log, at most once a re-send
            still = true;
          } else try {
            const x = await timedRead("orderLookup", () => this.d.broker.getOrderById(id));
            c.lookups++; // only a lookup that answered counts toward CANCEL_LOOKUPS_MAX
            still = !!x && OPEN_STATUSES.has(x.status) && x.status !== "pending_cancel";
          } catch (err) {
            // Group 1, night build round 1 (finding 3): a failed lookup does not use up the allowance; the result is unknown, so the cancel is
            // sent again within CANCEL_RESENDS_MAX (the client treats 404 and 422 on a cancel as done). Failed lookups have their own limit.
            c.lookupFails = (c.lookupFails ?? 0) + 1;
            this.d.log?.("cancel_lookup_failed", { reason: o.reason, id, fails: c.lookupFails, error: (err as Error).message.slice(0, 100) });
            if (c.resends >= CANCEL_RESENDS_MAX) {
              // Nothing left to send: looked up again after the next wait while failures allow; at the last allowed failure it is given up
              // for the memory, and stored as not confirmed (logging only).
              if (c.lookupFails >= CANCEL_LOOKUP_FAILS_MAX) this.d.log?.("cancel_not_confirmed", { reason: o.reason, id, resends: c.resends, lookupsFailed: c.lookupFails });
              c.at = this.d.now().getTime();
              c.waitMs = Math.min(c.waitMs * 2, 8_000);
              continue;
            }
            still = true;
          }
          if (!still) continue; // the cancel took (or the order ended): nothing more to send
          if (c.resends >= CANCEL_RESENDS_MAX) {
            this.d.log?.("cancel_not_confirmed", { reason: o.reason, id, resends: c.resends });
            continue;
          }
          c.resends++;
          c.at = this.d.now().getTime();
          c.waitMs = Math.min(c.waitMs * 2, 8_000);
          cancelled = true;
          cancelledInAttempt = true;
          steps.cancelsSentAt.push(stamp());
          (result.cancelsTried ??= []).push(id);
          try {
            await this.d.broker.cancelOrder(id);
          } catch (err) {
            this.cancelThrew(id, o.reason);
            throw err;
          }
          // Logged only once Alpaca took the re-send (group 2, night round 2; logging only).
          this.d.log?.("cancel_resent", { reason: o.reason, id, resends: c.resends });
          (result.cancelsAccepted ??= []).push(id);
          steps.cancelsAnsweredAt.push(stamp());
        }
        if (onlyOwn || !own) {
          // done above
        } else {
          // In an `only` sale, the ids the caller named are cancelled too (Alpaca's open list may not show a filled bracket's
          // legs). The client treats "already filled or cancelled" (404, 422) as done.
          // Part B (one entry only): just that entry's own exits; from round 2, only those still shown open.
          const ids = [...new Set(round === 1 ? cancelIds : openOrderIds(others, targets).filter((id) => cancelIds.includes(id)))];
          for (const id of ids) {
            cancelled = true;
            cancelledInAttempt = true;
            steps.cancelsSentAt.push(stamp());
            (result.cancelsTried ??= []).push(id);
            await this.d.broker.cancelOrder(id);
            (result.cancelsAccepted ??= []).push(id);
            steps.cancelsAnsweredAt.push(stamp());
          }
        }
      } catch (err) {
        result.errors.push(`round ${round}: cancel failed: ${(err as Error).message.slice(0, 120)}`);
        result.cancelFailed = true;
        if (o.endOnCancelFail) {
          result.remaining = positions.map((p) => p.symbol);
          return done();
        }
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
      let openReadAt = 0; // logging only: when `openOrders` was read
      let readOk = true;
      const t0 = this.d.now().getTime();
      let waited = 0;
      let polls = 0;
      let blindWaitDone = false;
      for (;;) {
        if (yieldNow()) return yielded();
        let held: Position[] = [];
        try {
          openOrders = await openOrdersR();
          openReadAt = this.d.now().getTime();
          held = await heldNow();
        } catch (err) {
          result.errors.push(`round ${round}: could not read open orders or positions: ${(err as Error).message.slice(0, 100)}`);
          readOk = false;
          break;
        }
        // If cancels were just asked for and nothing visible shows what they were holding, give them half a second once: a cancel
        // takes about 0.2 s, and neither the open list nor qty_available is guaranteed to show the exits.
        if ((cancelled || v24Cancelled) && polls === 0 && !blindWaitDone) {
          blindWaitDone = true;
          // A plain half second, never ended early by an update (group 1 review, round 1): Alpaca's open list may not show a filled
          // entry's exits, so this pause is what lets the cancels land before the first look.
          await this.sleep(500);
          waited += 500;
          continue;
        }
        // Part B (one entry only): waiting is over once that entry's own shares are free (a newer position's exits stay open on
        // purpose), and there is nothing to wait for when this attempt cancelled nothing.
        const freeNow = (sym: string): number => {
          const p = held.find((x) => x.symbol === sym);
          return p ? Math.min(p.qty - openSellQty(openOrders, sym), p.qtyAvailable ?? Infinity) : Infinity;
        };
        // Fix A: against the recounted shares, so a count that the take-profit made stale no longer holds the wait for 6 seconds.
        const leftNow = (sym: string): number => ownLeft(sym, held.find((x) => x.symbol === sym)?.qty ?? 0, openOrders);
        const stillHolding = own
          ? [...symbols].some((sym) => leftNow(sym) > EPS && freeNow(sym) < leftNow(sym) - EPS)
          : [...symbols].some((sym) => openSellQty(openOrders, sym) > EPS) || held.some((p) => p.qtyAvailable != null && p.qtyAvailable < p.qty - EPS);
        if (!stillHolding || waited >= waitMs || (own && !cancelledInAttempt)) break;
        // Poll gently: a cancel usually finishes in a fraction of a second, and every look costs one of Alpaca's 200 requests a minute.
        const pause = [250, 400, 600, 800][Math.min(polls++, 3)]!;
        waited += await pauseFor(symbols, pause);
        if (this.d.now().getTime() - t0 > waitMs * 3) break; // a clock that moves much faster than the loop
      }

      // 3. Sell each symbol with an explicit quantity, through the sell gate (never more than is free).
      const hiddenThisRound = new Set<string>();
      let soldThisRound = 0;
      const capThisRound = new Map<string, number>(); // fix A: the recounted shares per symbol in this round
      if (readOk) {
        result.freshStopStillOpen = undefined; // what the last round's look saw (group 2, round 4 of the night release)
        if (!cheapOk) this.d.gate.invalidate(); // the cheap retry keeps the gate's one read (nothing was cancelled this round)
        let freshPositions: Position[] = [];
        try {
          freshPositions = await heldNow();
          // Group 1 and group 2, round 7: only now has this round's look read the open orders AND the positions it acts on (reported only).
          result.lastLookOk = true;
        } catch (err) {
          result.errors.push(`round ${round}: could not re-read positions: ${(err as Error).message.slice(0, 100)}`);
        }
        for (const p of freshPositions) {
          if (yieldNow()) return yielded();
          const cap = ownLeft(p.symbol, p.qty, openOrders);
          capThisRound.set(p.symbol, cap);
          if (own && !(cap > EPS)) {
            // A5 (group 1 review, round 1): a sale of ours already covers the entry's shares (the order sync's own missing-exit sale got
            // there first): nothing to do, and not "stuck".
            if (ownOpenSellQty(openOrders, p.symbol) > EPS) (result.coveredByOwnSale ??= []).push(p.symbol);
            continue; // that entry's own shares are sold, or gone at its own exits (part B, fix A)
          }
          const free = Math.min(p.qty - openSellQty(openOrders, p.symbol), p.qtyAvailable ?? Infinity, cap);
          // A4 (group 1 review, rounds 1 and 2): a resting fresh stop of ours (cyrus-p-) holds the shares (for example after a restart, when
          // the worker's memory of it is gone). It counts as protection only when it covers the symbol's WHOLE holding (it is placed only
          // when its entry holds the whole symbol); then nothing is sold, nothing is cancelled, and it is not stuck. With another position
          // on the symbol it protects only its own shares, and this sale goes on as before.
          // Michael's ruling B of 2026-11-12: a fresh stop this sale is cancelling (named in `cancelIds`) never counts as protection.
          // The exit pair (group 1, round 1 of 2026-11-21, answer 3): a broken pair (its take-profit filled part, or its stop leg shown ended) is
          // never protection; it is reported (`brokenPairsSeen`) so the caller cancels it and sells.
          const ownP = (x: Order) => x.symbol === p.symbol && x.side === "sell" && x.clientOrderId.startsWith("cyrus-p-") && OPEN_STATUSES.has(x.status) && x.status !== "pending_cancel" && !cancelIds.includes(x.id) && remaining(x) >= p.qty - EPS;
          if (own && !(free > EPS)) for (const x of openOrders) if (ownP(x) && isExitPair(x) && pairBroken(x)) (result.brokenPairsSeen ??= []).push({ symbol: p.symbol, clientOrderId: x.clientOrderId, orderId: x.id, status: x.status, filledQty: x.filledQty });
          const freshHolding = own && !(free > EPS) ? openOrders.find((x) => ownP(x) && !(isExitPair(x) && pairBroken(x)) && !o.notProtection?.includes(x.clientOrderId)) : undefined;
          if (freshHolding) {
            const asPair = isExitPair(freshHolding);
            (result.heldByFreshStop ??= []).push({ symbol: p.symbol, clientOrderId: freshHolding.clientOrderId, orderId: freshHolding.id, qty: remaining(freshHolding), stopPrice: asPair ? (pairStopLeg(freshHolding)?.stopPrice ?? null) : freshHolding.stopPrice, status: freshHolding.status, ...(asPair ? { takeProfitPrice: freshHolding.limitPrice } : {}) });
            continue;
          }
          // Reported only (the sale goes on exactly as before): a fresh stop of ours being cancelled still holds the shares.
          const stillOpen = own && !(free > EPS) ? openOrders.find((x) => x.symbol === p.symbol && x.side === "sell" && x.clientOrderId.startsWith("cyrus-p-") && OPEN_STATUSES.has(x.status) && (x.status === "pending_cancel" || cancelIds.includes(x.id)) && remaining(x) >= p.qty - EPS) : undefined;
          if (stillOpen) (result.freshStopStillOpen ??= []).push({ symbol: p.symbol, clientOrderId: stillOpen.clientOrderId, orderId: stillOpen.id, status: stillOpen.status });
          if (o.waitForAlpacaCancel && own && !(free > EPS)) {
            // A5: Alpaca kept the exits (it refused the cancel because the entry had filled): the position is protected, nothing to do.
            (result.exitsKept ??= []).push(p.symbol);
            continue;
          }
          const stopPrice = o.protectWithStop?.[p.symbol];
          if (stopPrice !== undefined && own && soleHolder(p.symbol) && free > EPS && free < cap - EPS) {
            // A4: only part of the remainder is free yet; a stop is placed only for all of it at once, so look again next round.
            blocked++;
            this.d.log?.("sale_blocked", { symbol: p.symbol, reason: o.reason, round, qty: p.qty, qtyAvailable: p.qtyAvailable ?? null, openSellQty: openSellQty(openOrders, p.symbol), openSells: openSellOrdersFor(openOrders, p.symbol).slice(0, 5), openListAgeMs: this.d.now().getTime() - openReadAt, waitedMs: waited, hiddenHold: false, freshStopWaitsFor: cap });
            continue;
          }
          if (stopPrice !== undefined && own && soleHolder(p.symbol) && free > EPS) {
            // Its own prefix (cyrus-p-, "protect"), not cyrus-x-: every whole-account sale (the close-outs, the loss stop and its retry, `flatten`)
            // treats an open cyrus-x- sell as a sale of ours still working and leaves it alone, but must cancel a fresh stop like any exit.
            // The exit pair (Michael's approval of 2026-11-21, answer 2): with `protectWithPair`, the pair first; a definite refusal of it is
            // followed at once by the plain stop (client id ending "b"), and a definite refusal of that by the market sale below. An unclear
            // answer at either step ends the chain. The same prefix for the pair, so everything that knows a fresh stop knows the pair.
            const pairAsk = o.protectWithPair?.[p.symbol];
            const steps2: Array<"pair" | "stop"> = pairAsk ? ["pair", "stop"] : ["stop"];
            let pairSentAt: number | null = null;
            let placed = false;
            for (const kind of steps2) {
              const asPair = kind === "pair" && pairAsk !== undefined;
              const sid = `cyrus-p-${o.tradeDate.replaceAll("-", "")}-${p.symbol}-${this.d.now().getTime().toString(36)}-s${round}${kind === "stop" && pairAsk ? "b" : ""}`;
              const sentAtMs = this.d.now().getTime();
              if (asPair) pairSentAt = sentAtMs;
              const st = await this.d.gate.sell({ symbol: p.symbol, qty: free, clientOrderId: sid, reason: asPair ? `${o.reason}, as an exit pair` : `${o.reason}, as a fresh stop`, stopPrice, ...(asPair ? { takeProfitPrice: pairAsk.takeProfitPrice } : {}) }, gateTimer);
              if (st.status === "sent") {
                result.freshStop = { symbol: p.symbol, qty: free, stopPrice, clientOrderId: sid, orderId: st.order.id, sentAtMs, answerMs: this.d.now().getTime() - sentAtMs, ...(asPair ? { pair: { takeProfitPrice: pairAsk.takeProfitPrice } } : {}), ...(!asPair && pairSentAt !== null ? { afterPairRefusedMs: sentAtMs - pairSentAt } : {}) };
                steps.sells.push({ symbol: p.symbol, qty: free, at: stamp() });
                try {
                  result.heldAfter = Object.fromEntries((await heldNow()).map((x) => [x.symbol, x.qty]));
                } catch {
                  /* only for the record */
                }
                result.remaining = [p.symbol];
                placed = true;
                break;
              }
              // A definite refusal: Alpaca answered in the 400s (not 429). For the pair also our own client's refusal before sending (status 0:
              // nothing was sent, for example the stop not 1 cent below the limit), so the plain stop is tried.
              const definite = st.status === "error" && st.httpStatus !== undefined && ((st.httpStatus >= 400 && st.httpStatus < 500 && st.httpStatus !== 429) || (asPair && st.httpStatus === 0));
              if (!definite) {
                // Unclear (a network error, a timeout, a 5xx) or refused by our own sell gate: the stop (or pair) may exist, so no market sale on top
                // of it; the next order sync looks again.
                result.errors.push(`round ${round}: ${p.symbol}: ${asPair ? "exit pair" : "fresh stop"} not confirmed: ${st.reason}`);
                // `sentToAlpaca: false`: our own sell gate stopped it before any request (the briefs leave it out of the stops sent).
                this.d.log?.("fresh_stop_unclear", { symbol: p.symbol, stopClientOrderId: sid, qty: free, stopPrice, reason: st.reason.slice(0, 160), sentToAlpaca: !(st.status === "refused" || (st.status === "error" && st.notSent === true)), ...(asPair ? { pair: true, takeProfitPrice: pairAsk.takeProfitPrice } : {}) });
                result.freshStopUnclear = { symbol: p.symbol, qty: free, stopPrice, clientOrderId: sid, sentAtMs, ...(asPair ? { pair: { takeProfitPrice: pairAsk.takeProfitPrice } } : {}) };
                result.remaining = [p.symbol];
                return done();
              }
              this.d.gate.invalidate();
              if (asPair) {
                result.pairRefused = st.reason.slice(0, 160);
                this.d.log?.("exit_pair_refused", { symbol: p.symbol, pairClientOrderId: sid, qty: free, stopPrice, takeProfitPrice: pairAsk.takeProfitPrice, reason: st.reason.slice(0, 160), httpStatus: st.status === "error" ? (st.httpStatus ?? null) : null });
                continue; // answer 2: the plain stop at once
              }
              result.freshStopRefused = st.reason.slice(0, 160);
              this.d.log?.("fresh_stop_refused", { symbol: p.symbol, stopClientOrderId: sid, qty: free, stopPrice, reason: st.reason.slice(0, 160), httpStatus: st.status === "error" ? (st.httpStatus ?? null) : null, ...(pairSentAt !== null ? { afterPairRefused: true } : {}) });
              // Falls through to the market sale below, as before A4.
            }
            if (placed) return done();
          }
          if (!(free > EPS)) {
            // Part A, step 1: held, not free, and no open order visible that would explain it.
            const hidden = !cancelledInAttempt && openSellQty(openOrders, p.symbol) <= EPS && p.qtyAvailable != null && p.qtyAvailable < p.qty - EPS;
            if (hidden) hiddenThisRound.add(p.symbol);
            // Something is still holding the shares; the next round cancels again. Michael's decision of 2026-11-09 (logging only, no
            // request added): say what held them, from the reads already made.
            blocked++;
            this.d.log?.("sale_blocked", {
              symbol: p.symbol,
              reason: o.reason,
              round,
              qty: p.qty,
              qtyAvailable: p.qtyAvailable ?? null,
              openSellQty: openSellQty(openOrders, p.symbol),
              openSells: openSellOrdersFor(openOrders, p.symbol).slice(0, 5),
              openListAgeMs: this.d.now().getTime() - openReadAt,
              waitedMs: waited,
              hiddenHold: hidden,
            });
            continue;
          }
          const id = `cyrus-x-${o.tradeDate.replaceAll("-", "")}-${p.symbol}-${this.d.now().getTime().toString(36)}-${round}`;
          const r = await this.d.gate.sell({ symbol: p.symbol, qty: free, clientOrderId: id, reason: o.reason }, gateTimer);
          if (r.status === "sent") {
            if (own) (result.ownTarget ??= {})[p.symbol] = (soldBy.get(p.symbol) ?? 0) + cap; // fix A: the recount at this sale
            soldBy.set(p.symbol, (soldBy.get(p.symbol) ?? 0) + free);
            marketSentBy.set(p.symbol, (marketSentBy.get(p.symbol) ?? 0) + free);
            soldThisRound++;
            result.sold.push({ symbol: p.symbol, qty: free });
            steps.sells.push({ symbol: p.symbol, qty: free, at: stamp() });
            try {
              o.onSellSent?.({ symbol: p.symbol, qty: free, clientOrderId: id, atMs: this.d.now().getTime() });
            } catch {
              /* a measurement must never break a sale */
            }
          } else result.errors.push(`round ${round}: ${p.symbol}: ${r.reason}`);
        }
      }

      // Part A, step 1: nothing sold and every symbol still to sell held with no open order visible: end this attempt now.
      if (o.endWhenHiddenHold && soldThisRound === 0 && hiddenThisRound.size > 0 && [...symbols].every((sym) => (capThisRound.get(sym) ?? need(sym)) <= EPS || hiddenThisRound.has(sym))) {
        result.hiddenHold = [...hiddenThisRound];
        break;
      }

      // 4. Look again after the sells have had a moment to fill (sooner if a fill or cancel for these symbols arrives).
      await pauseFor(symbols, 1_000);
    }

    try {
      const left = await heldNow();
      result.flat = left.length === 0;
      result.remaining = left.map((p) => p.symbol);
      result.heldAfter = Object.fromEntries(left.map((p) => [p.symbol, p.qty]));
      // The symbol no longer held: every share gone, the entry's included (whoever held it alone or not).
      if (own && only) result.ownGone = [...only].filter((sym) => result.heldBefore?.[sym] !== undefined && (result.heldAfter?.[sym] ?? 0) <= EPS);
    } catch {
      result.remaining = result.remaining.length > 0 ? result.remaining : ["(could not read positions)"];
    }
    return done();
  }
}
