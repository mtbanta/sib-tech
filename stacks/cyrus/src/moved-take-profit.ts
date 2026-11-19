// THE MOVED TAKE-PROFIT (Michael's decision of 2026-11-18, with his answers in the session: "moves first", "one bracket only").
//
// In a sale of the whole account (the close-outs, `flatten`, the loss stop's sale, the carried-position sale) and a close-out's retry of
// named symbols, a position whose bracket still rests at Alpaca is sold by moving its take-profit to a selling price (the bid less 1 cent)
// instead of cancelling the exits and selling at market. Alpaca then cancels the stop itself when the take-profit fills, so the position
// keeps its stop until it is sold. Paper tests of 2026-11-17 and 2026-11-18: 11 of 11 such moves sold, 0.27 to 1.41 s after the move; in 10
// of them Alpaca cancelled the stop about 2 ms after the fill (in the partly filled one it had cancelled the whole stop at the first partial
// fill, before the move); Alpaca refuses a take-profit at or below the stop (422).
//
// A position qualifies only when (Michael's scope):
//   - a single bracket's take-profit covers the symbol's whole holding and no other sell is open on the symbol (his answer "one bracket only");
//   - the take-profit has filled nothing (partly filled legs keep today's path) and is plainly working (new or accepted);
//   - its stop price is known (the order sync's copy of the entry, or the stored entry rounded as it was sent);
//   - a quote read at the move (one snapshot request) gives a selling limit (bid less 1 cent) at least 3 cents above the stop, and below the
//     take-profit's own limit; the quote may be up to MOVE_QUOTE_MAX_AGE_MS old (30 s, Michael's decision of 2026-11-19).
// Everything else keeps today's path. The order of a sale with moves (his answer "moves first"): the replaces are sent, the sale waits up to
// MOVE_FILL_WAIT_MS for them (ending early when the live updates report every one filled), then today's path runs unchanged for whatever is
// still held: its cancel of every order (or, in a close-out's retry of named symbols, the single cancels from a fresh open list) also
// cancels a moved take-profit that did not fill, and the shares are sold at market, as today. That is the fallback.
//
// Research input for a human decision, never an instruction to act. Paper trading only.
import type { Order, Position } from "./alpaca-trading.ts";
import type { TradeUpdate } from "./order-stream.ts";
import { OPEN_STATUSES, flattenLegs } from "./sells.ts";

// The switch (one constant, so the release can ship with it off if a review stalls).
export const MOVED_TAKE_PROFIT = { on: true };
// The selling limit: the bid less this, in dollars.
export const MOVE_BELOW_BID = 0.01;
// The smallest gap between the selling limit and the stop (Michael's scope; the smallest gap Alpaca accepted on 2026-11-18 was 3 cents).
export const MOVE_MIN_ABOVE_STOP = 0.03;
// How long a move may take to fill before today's path takes over (Michael: "no fill within 2 s falls back").
export const MOVE_FILL_WAIT_MS = 2_000;
// A quote older than this is not used (the position takes today's path). Michael's decision of 2026-11-19 (about 11:20 AM CT): 30 s, was 5 s.
// The age is that of the feed's own last quote change, not of the read: on the free IEX feed, at the 10:30 close-out of 2026-11-19, 6 of 10
// brackets had quotes 5.5 to 94 s old in a read made at the move. Relying on the fallback: the stop stays live while the move waits, a limit
// at or below the real bid fills at the real bid, a limit above it rests and falls back after MOVE_FILL_WAIT_MS, and a stray low bid fails
// the 3 cent rule.
export const MOVE_QUOTE_MAX_AGE_MS = 30_000;
// Bounds on the phase (the advisor's point: one hung replace is 10 s): at most this many replaces in one sale, and none sent once this
// long has passed since the phase began. What is not moved takes today's path.
export const MOVE_MAX_PER_SALE = 30;
export const MOVE_SEND_WINDOW_MS = 3_000;
// Time limits (measured on paper on 2026-11-18: a replace answered in 50 to 244 ms, median 58; a market-data quote in 46 to 405 ms, median
// 68). A replace without an answer in this time is unclear (it may have happened); no further replace is sent in that sale.
export const MOVE_REPLACE_TIMEOUT_MS = 2_000;
export const MOVE_QUOTE_TIMEOUT_MS = 1_000;
// The sale's own read of positions and open orders may serve the replaces' check for this long (a replace adds no shares, so a read a few
// seconds old cannot let it oversell: Alpaca keeps the order's own quantity, already held against the position).
export const MOVE_VIEW_MAX_AGE_MS = MOVE_SEND_WINDOW_MS + 1_000;
// The stop prices come from what the worker holds in memory (the order sync's copy, the cached entry); one time limit for the whole lookup
// (group 1, round 1: a cache miss reaches the database, which can be slow exactly when it is in trouble). What is not found by then is unknown
// and takes today's path.
export const MOVE_STOPS_TIMEOUT_MS = 300;
// The client id a replacement carries. The 1-share paper test of 2026-11-18 (12:17 PM CT, Michael's yes) showed Alpaca keeps the client id
// asked for on a replaced take-profit (both replaces), finds the order by it, and shows it in the open list and in the entry's legs, in the
// same group. Never `cyrus-x-`: every whole-account sale treats an open cyrus-x- sell as its own market sale still working (the close-out
// then waits for it to its deadline, and the 2 second fallback would never run). The new id is also tracked (MoveWatch), whatever it is.
export const MOVE_CLIENT_ID_PREFIX = "cyrus-m-";
export const MOVE_SETS_CLIENT_ID = { on: true };

const EPS = 1e-9;
const floorCents = (x: number): number => Math.floor(x * 100 + 1e-9) / 100;

export interface MoveCandidate {
  symbol: string;
  qty: number;
  legId: string;
  groupId: string;
  oldLimit: number;
  stopPrice: number;
}
export interface MovePlan extends MoveCandidate {
  limit: number;
  bid: number;
  ask: number;
  quoteAgeMs: number;
  // The snapshot's latest trade, for the record only (null when it carried none).
  tradePrice: number | null;
  tradeAgeMs: number | null;
}
// Why a position was not moved (Michael's request of 2026-11-19: stored for every position skipped, in every move phase). The prices are
// given where the step that skipped it knew them.
export type Skip = { symbol: string; why: string; stopPrice?: number; oldLimit?: number; bid?: number; quoteAgeMs?: number; tradePrice?: number | null; tradeAgeMs?: number | null };
// A quote as the move reads it (the latest trade only when the snapshot carried one).
export type QuoteIn = { bid: number; ask: number; atMs: number; tradePrice?: number; tradeAtMs?: number };

// Step 1, from the reads the sale already makes (no request): the positions whose one bracket could be moved, before any price is known.
// Without `stopFor` the stop is not checked here (`stopPrice` is NaN): the sale then looks the stops up for these candidates (withStops).
export function structuralCandidates(positions: Position[], open: Order[], stopFor?: (leg: Order) => number | null): { candidates: MoveCandidate[]; skipped: Skip[] } {
  const candidates: MoveCandidate[] = [];
  const skipped: Skip[] = [];
  for (const p of positions) {
    if (!(p.qty > EPS)) continue;
    const sells: Order[] = [];
    for (const o of open) for (const x of [o, ...flattenLegs(o)]) if (x.symbol === p.symbol && x.side === "sell" && OPEN_STATUSES.has(x.status)) sells.push(x);
    const unique = [...new Map(sells.map((x) => [x.id, x])).values()];
    if (unique.length !== 1) {
      skipped.push({ symbol: p.symbol, why: unique.length === 0 ? "no take-profit open" : "more than one sell open" });
      continue;
    }
    const tp = unique[0]!;
    if (tp.type !== "limit" || tp.orderClass !== "bracket" || tp.limitPrice === null || !tp.groupId) {
      skipped.push({ symbol: p.symbol, why: "the open sell is not a bracket's take-profit" });
      continue;
    }
    if (!(tp.status === "new" || tp.status === "accepted") || tp.filledQty > EPS) {
      skipped.push({ symbol: p.symbol, why: tp.filledQty > EPS ? "take-profit partly filled" : `take-profit ${tp.status}` });
      continue;
    }
    if (Math.abs(tp.qty - p.qty) > EPS || (p.qtyAvailable != null && p.qtyAvailable > EPS)) {
      skipped.push({ symbol: p.symbol, why: "the take-profit does not cover the whole holding" });
      continue;
    }
    const stop = stopFor ? stopFor(tp) : NaN;
    if (stopFor && (stop === null || !(stop > 0))) {
      skipped.push({ symbol: p.symbol, why: "stop price unknown" });
      continue;
    }
    candidates.push({ symbol: p.symbol, qty: p.qty, legId: tp.id, groupId: tp.groupId, oldLimit: tp.limitPrice, stopPrice: stop ?? NaN });
  }
  return { candidates, skipped };
}

// The candidates whose stop price is known (by take-profit leg id); the others take today's path.
export function withStops(candidates: MoveCandidate[], stops: ReadonlyMap<string, number>): { candidates: MoveCandidate[]; skipped: Skip[] } {
  const out: MoveCandidate[] = [];
  const skipped: Skip[] = [];
  for (const c of candidates) {
    const s = stops.get(c.legId);
    if (!(s !== undefined && s > 0 && Number.isFinite(s))) skipped.push({ symbol: c.symbol, why: "stop price unknown", oldLimit: c.oldLimit });
    // No price can qualify unless the take-profit sits at least 4 cents above the stop (the selling limit must be at least 3 cents above
    // the stop and at least 1 cent below the take-profit). A load bracket at the defaults (1 cent up, 2 cents down) never qualifies, so a
    // sale of only such positions makes no quote read and does not wait for one. An afternoon load window given a wider stop or
    // take-profit (Michael's request of 2026-11-18) can qualify, by this same rule.
    else if (!(c.oldLimit - s >= MOVE_MIN_ABOVE_STOP + 0.01 - EPS)) skipped.push({ symbol: c.symbol, why: "take-profit within 4 cents of the stop", stopPrice: s, oldLimit: c.oldLimit });
    else out.push({ ...c, stopPrice: s });
  }
  return { candidates: out, skipped };
}

// Step 2, with the quote: the selling limit and the 3 cent rule.
export function pricedMoves(candidates: MoveCandidate[], quotes: ReadonlyMap<string, QuoteIn>, nowMs: number): { moves: MovePlan[]; skipped: Skip[] } {
  const moves: MovePlan[] = [];
  const skipped: Skip[] = [];
  for (const c of candidates) {
    const q = quotes.get(c.symbol);
    const known = { stopPrice: c.stopPrice, oldLimit: c.oldLimit };
    if (!q) {
      skipped.push({ symbol: c.symbol, why: "no quote", ...known });
      continue;
    }
    const age = nowMs - q.atMs;
    const tradePrice = typeof q.tradePrice === "number" ? q.tradePrice : null;
    const tradeAgeMs = tradePrice !== null && typeof q.tradeAtMs === "number" ? Math.max(0, nowMs - q.tradeAtMs) : null;
    const seen = { ...known, bid: q.bid, quoteAgeMs: Math.max(0, age), tradePrice, tradeAgeMs };
    if (age > MOVE_QUOTE_MAX_AGE_MS) {
      skipped.push({ symbol: c.symbol, why: `quote ${Math.round(age / 1000)} s old`, ...seen });
      continue;
    }
    const limit = floorCents(q.bid - MOVE_BELOW_BID);
    if (!(limit >= c.stopPrice + MOVE_MIN_ABOVE_STOP - EPS)) {
      skipped.push({ symbol: c.symbol, why: "price within 3 cents of the stop", ...seen });
      continue;
    }
    if (!(limit < c.oldLimit - EPS)) {
      skipped.push({ symbol: c.symbol, why: "take-profit already at or below the price", ...seen });
      continue;
    }
    moves.push({ ...c, limit, bid: q.bid, ask: q.ask, quoteAgeMs: Math.max(0, age), tradePrice, tradeAgeMs });
  }
  return { moves, skipped };
}

// One move as the sale and the live updates saw it. Stored once as `take_profit_moved` (Michael: "accepted or refused with Alpaca's answer,
// stop cancelled by Alpaca, time to fill, fallback used"). Built from the live updates only: no lookup is made for it.
export interface MoveRow {
  reason: string;
  symbol: string;
  qty: number;
  oldId: string;
  newId: string | null;
  groupId: string;
  limit: number;
  oldLimit: number;
  stopPrice: number;
  bid: number;
  quoteAgeMs: number;
  // The snapshot's latest trade at the move, for the record (Michael's request of 2026-11-19); null when it carried none.
  tradePrice: number | null;
  tradeAgeMs: number | null;
  sentAtMs: number;
  answerMs: number;
  accepted: boolean;
  // Alpaca's answer when not accepted (its status code and message), or "unclear" (no answer: the replace may have happened).
  answer: string | null;
  httpStatus: number | null;
  clientId: string | null;
  // From the live updates: the replacement's fill (Alpaca's time, less the worker's time at the send: two clocks, so a guide to within
  // the clocks' difference) and the shares it had filled (a partial fill shows fewer than `qty`), and the stop's cancel.
  filledAtMs: number | null;
  timeToFillMs: number | null;
  filledQtySeen: number | null;
  // True only when the live updates showed the moved take-profit filled BEFORE today's path sent any cancel and showed the stop cancelled
  // (then only Alpaca can have cancelled it); false only when they showed the moved take-profit cancelled with nothing filled (today's path
  // cancelled the bracket); null otherwise (not known).
  stopCancelledByAlpaca: boolean | null;
  // From the sale's first read of positions after the wait (no extra request): true when the symbol was still held, so today's path had
  // shares to cancel and sell; false when they were gone; null when that read failed. Whether the live updates were connected at the start.
  fallback: boolean | null;
  // Michael's request of 2026-11-19: whether the backup step actually sold. The shares of this symbol that today's path (the fallback's
  // market sales, `cyrus-x-`) was sent to sell in this sale after the move; 0 when it sent none (for example the move filled after the read
  // above but before the fallback's cancel, as three moves did on 2026-11-19). Sent, not filled: the close-out's own wait and the order
  // records say when it filled.
  fallbackSoldQty: number;
  liveUpdates: boolean | null;
}

// Told about the live updates for the moves of the running sale (the worker connects it to the order stream). It never sends anything.
// A move is expected BEFORE its replace is sent (by the bracket's group and the old take-profit's id): on paper a fill can come about as fast
// as an answer (fills 0.27 s and more after the send, answers up to 0.24 s), so an update about the replacement may arrive before the answer
// names it. Until then the replacement is recognised as the bracket's take-profit (a limit sell in that group) that is not the old order.
export class MoveWatch {
  private readonly byGroup = new Map<string, { oldId: string; newId: string | null; qty: number; filledAtMs: number | null; filledSeenAtMs: number | null; filledQty: number; fillHeard: boolean; canceledAtMs: number | null; canceledSeenAtMs: number | null; stopCanceledAtMs: number | null; stopCanceledSeenAtMs: number | null }>();
  private readonly oldOf = new Map<string, string>();
  private readonly now: () => number;
  constructor(now: () => number) {
    this.now = now;
  }
  // Before a replace is sent: the bracket's group, the old take-profit's id, and its shares.
  expect(groupId: string, oldId: string, qty: number): void {
    this.byGroup.set(groupId, { oldId, newId: null, qty, filledAtMs: null, filledSeenAtMs: null, filledQty: 0, fillHeard: false, canceledAtMs: null, canceledSeenAtMs: null, stopCanceledAtMs: null, stopCanceledSeenAtMs: null });
  }
  // The replace was accepted: the new order's id.
  register(groupId: string, newId: string): void {
    const m = this.byGroup.get(groupId);
    if (!m) return;
    m.newId = newId;
    this.oldOf.set(newId, m.oldId);
  }
  // The replace was refused or unclear: the group is no longer expected to change (an unclear one may still show up; it is kept for the row).
  drop(groupId: string): void {
    const m = this.byGroup.get(groupId);
    if (m && m.newId === null && m.filledAtMs === null) this.byGroup.delete(groupId);
  }
  private isReplacement(o: Order, m: { oldId: string; newId: string | null }): boolean {
    if (m.newId !== null) return o.id === m.newId;
    return o.id !== m.oldId && o.side === "sell" && (o.type === "limit" || o.limitPrice !== null) && o.stopPrice === null;
  }
  // The order this one replaced, when the stack replaced it (the live updates' fill tally drops it, so a replaced leg is never counted twice).
  replacedOf(o: Order): string | null {
    const known = this.oldOf.get(o.id);
    if (known) return known;
    const m = o.groupId ? this.byGroup.get(o.groupId) : undefined;
    return m && this.isReplacement(o, m) ? m.oldId : null;
  }
  onUpdate(u: TradeUpdate): void {
    const o = u.order;
    const m = o.groupId ? this.byGroup.get(o.groupId) : undefined;
    if (!m) return;
    const at = u.atMs ?? this.now();
    if (this.isReplacement(o, m)) {
      if (m.newId === null) {
        m.newId = o.id;
        this.oldOf.set(o.id, m.oldId);
      }
      if (u.event === "fill" || u.event === "partial_fill") {
        m.fillHeard = true;
        m.filledQty = Math.max(m.filledQty, o.filledQty);
        if (o.filledQty >= m.qty - EPS && m.filledAtMs === null) {
          m.filledAtMs = at;
          m.filledSeenAtMs = this.now(); // the worker's own clock, to compare with its own cancels
        }
      } else if (u.event === "canceled" || u.event === "expired" || u.event === "rejected") {
        // The order's own count of shares filled is taken from its cancel too (group 2, round 3: a partial fill's own update may be missed).
        if (o.filledQty > EPS) {
          m.fillHeard = true;
          m.filledQty = Math.max(m.filledQty, o.filledQty);
        }
        if (m.canceledAtMs === null) {
          m.canceledAtMs = at;
          m.canceledSeenAtMs = this.now();
        }
      }
      return;
    }
    if (o.side === "sell" && (o.type === "stop" || o.stopPrice !== null) && u.event === "canceled" && m.stopCanceledAtMs === null) {
      m.stopCanceledAtMs = at;
      m.stopCanceledSeenAtMs = this.now(); // the worker's clock, to compare with its own cancels
    }
  }
  filled(groupId: string): boolean {
    return this.byGroup.get(groupId)?.filledAtMs != null;
  }
  // What the live updates said about one move so far.
  // `filledQty` is null when no fill was heard at all (not 0: the updates may not have been connected).
  seen(groupId: string): MoveSeen {
    const m = this.byGroup.get(groupId);
    return { newId: m?.newId ?? null, filledAtMs: m?.filledAtMs ?? null, filledSeenAtMs: m?.filledSeenAtMs ?? null, filledQty: m && m.fillHeard ? m.filledQty : null, canceledAtMs: m?.canceledAtMs ?? null, canceledSeenAtMs: m?.canceledSeenAtMs ?? null, stopCanceledAtMs: m?.stopCanceledAtMs ?? null, stopCanceledSeenAtMs: m?.stopCanceledSeenAtMs ?? null };
  }
  // Forget the last sale's moves (called at the start of each move phase): bounded memory. The old-to-new map is kept longer (the fill
  // tally may meet a late update), at most 2,000 entries.
  reset(): void {
    this.byGroup.clear();
    while (this.oldOf.size > 2_000) this.oldOf.delete(this.oldOf.keys().next().value!);
  }
}

export interface MoveSeen {
  newId: string | null;
  filledAtMs: number | null;
  filledSeenAtMs: number | null;
  filledQty: number | null;
  canceledAtMs: number | null;
  canceledSeenAtMs: number | null;
  stopCanceledAtMs: number | null;
  stopCanceledSeenAtMs: number | null;
}

// The row's verdict on the stop (group 2, rounds 1 and 2 of 2026-11-18: "unknown" is never stored as "no"). Times compared are the worker's
// own (when it heard each update, and when today's path sent its first cancel, `firstCancelAtMs`, null when it sent none).
//   true:  the moved take-profit had filled some shares (all, or part: Alpaca cancels the whole stop at a take-profit's first partial fill,
//          measured 2026-11-04 and 2026-11-18) and the stop's cancel was heard before today's path sent any cancel: only Alpaca can have
//          cancelled it then.
//   false: nothing filled, and the moved take-profit was cancelled after today's path sent its cancels: today's path cancelled the bracket.
//   null:  anything else (not heard, or heard after today's cancels were sent, or the stop filled and Alpaca cancelled the take-profit).
export function stopVerdict(seen: MoveSeen, firstCancelAtMs: number | null): boolean | null {
  const filledSome = seen.filledQty !== null && seen.filledQty > 0;
  if (filledSome && seen.stopCanceledSeenAtMs !== null && (firstCancelAtMs === null || seen.stopCanceledSeenAtMs < firstCancelAtMs)) return true;
  if (!filledSome && seen.canceledSeenAtMs !== null && firstCancelAtMs !== null && seen.canceledSeenAtMs >= firstCancelAtMs) return false;
  return null;
}
