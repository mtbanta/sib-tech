// THE MOVED TAKE-PROFIT (Michael's decision of 2026-11-18, with his answers in the session: "moves first", "one bracket only").
//
// In a sale of the whole account (the close-outs, `flatten`, the loss stop's sale, the carried-position sale) and a close-out's retry of
// named symbols, a position whose bracket still rests at Alpaca is sold by moving its take-profit to a selling price (the bid less 1 cent)
// instead of cancelling the exits and selling at market. Alpaca then cancels the stop itself when the take-profit fills, so the position
// keeps its stop until it is sold. Paper tests of 2026-11-17 and 2026-11-18: 11 of 11 such moves sold, 0.27 to 1.41 s after the move, with
// the stop cancelled by Alpaca about 2 ms after each fill; Alpaca refuses a take-profit at or below the stop (422).
//
// A position qualifies only when (Michael's scope):
//   - a single bracket's take-profit covers the symbol's whole holding and no other sell is open on the symbol (his answer "one bracket only");
//   - the take-profit has filled nothing (partly filled legs keep today's path) and is plainly working (new or accepted);
//   - its stop price is known (the order sync's copy of the entry, or the stored entry rounded as it was sent);
//   - a fresh quote gives a selling limit (bid less 1 cent) at least 3 cents above the stop, and below the take-profit's own limit.
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
// A quote older than this is not used (the position takes today's path).
export const MOVE_QUOTE_MAX_AGE_MS = 5_000;
// Bounds on the phase (the advisor's point: one hung replace is 10 s): at most this many replaces in one sale, and none sent once this
// long has passed since the phase began. What is not moved takes today's path.
export const MOVE_MAX_PER_SALE = 30;
export const MOVE_SEND_WINDOW_MS = 3_000;
// The client id a replacement carries, when Alpaca keeps it (the 1-share test of 2026-11-18). Never `cyrus-x-`: every whole-account sale
// treats an open cyrus-x- sell as its own market sale still working (the close-out then waits for it to its deadline, and the 2 second
// fallback would never run).
export const MOVE_CLIENT_ID_PREFIX = "cyrus-m-";
export const MOVE_SETS_CLIENT_ID = { on: false };

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
}
export type Skip = { symbol: string; why: string };

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
    if (s !== undefined && s > 0 && Number.isFinite(s)) out.push({ ...c, stopPrice: s });
    else skipped.push({ symbol: c.symbol, why: "stop price unknown" });
  }
  return { candidates: out, skipped };
}

// Step 2, with the quote: the selling limit and the 3 cent rule.
export function pricedMoves(candidates: MoveCandidate[], quotes: ReadonlyMap<string, { bid: number; ask: number; atMs: number }>, nowMs: number): { moves: MovePlan[]; skipped: Skip[] } {
  const moves: MovePlan[] = [];
  const skipped: Skip[] = [];
  for (const c of candidates) {
    const q = quotes.get(c.symbol);
    if (!q) {
      skipped.push({ symbol: c.symbol, why: "no quote" });
      continue;
    }
    const age = nowMs - q.atMs;
    if (age > MOVE_QUOTE_MAX_AGE_MS) {
      skipped.push({ symbol: c.symbol, why: `quote ${Math.round(age / 1000)} s old` });
      continue;
    }
    const limit = floorCents(q.bid - MOVE_BELOW_BID);
    if (!(limit >= c.stopPrice + MOVE_MIN_ABOVE_STOP - EPS)) {
      skipped.push({ symbol: c.symbol, why: "price within 3 cents of the stop" });
      continue;
    }
    if (!(limit < c.oldLimit - EPS)) {
      skipped.push({ symbol: c.symbol, why: "take-profit already at or below the price" });
      continue;
    }
    moves.push({ ...c, limit, bid: q.bid, ask: q.ask, quoteAgeMs: Math.max(0, age) });
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
  sentAtMs: number;
  answerMs: number;
  accepted: boolean;
  // Alpaca's answer when not accepted (its status code and message), or "unclear" (no answer: the replace may have happened).
  answer: string | null;
  httpStatus: number | null;
  clientId: string | null;
  // From the live updates: the replacement's fill (time from the send), and the stop's cancel.
  filledAtMs: number | null;
  timeToFillMs: number | null;
  stopCancelledByAlpaca: boolean | null;
  // True when the shares were still held after MOVE_FILL_WAIT_MS (or the move was refused), so today's path sold them.
  fallback: boolean;
}

// Told about the live updates for the moves of the running sale (the worker connects it to the order stream). It never sends anything.
export class MoveWatch {
  private readonly byNew = new Map<string, { groupId: string; filledAtMs: number | null; filledQty: number; qty: number; canceledAtMs: number | null }>();
  private readonly oldOf = new Map<string, string>();
  private readonly stopCancelAt = new Map<string, number>();
  private readonly now: () => number;
  constructor(now: () => number) {
    this.now = now;
  }
  // A replace was accepted: the new order's id, the old one, the bracket's group, and its shares.
  register(newId: string, oldId: string, groupId: string, qty: number): void {
    this.byNew.set(newId, { groupId, filledAtMs: null, filledQty: 0, qty, canceledAtMs: null });
    this.oldOf.set(newId, oldId);
  }
  // The order this one replaced, when the stack replaced it (the live updates' fill tally uses it so a replaced leg is never counted twice).
  replacedOf(newId: string): string | null {
    return this.oldOf.get(newId) ?? null;
  }
  onUpdate(u: TradeUpdate): void {
    const o = u.order;
    const at = u.atMs ?? this.now();
    const m = this.byNew.get(o.id);
    if (m) {
      if (u.event === "fill" || u.event === "partial_fill") {
        m.filledQty = Math.max(m.filledQty, o.filledQty);
        if (o.filledQty >= m.qty - EPS && m.filledAtMs === null) m.filledAtMs = at;
      } else if (u.event === "canceled" || u.event === "expired" || u.event === "rejected") m.canceledAtMs ??= at;
      return;
    }
    if (o.side === "sell" && o.groupId && (o.type === "stop" || o.stopPrice !== null) && u.event === "canceled") {
      for (const x of this.byNew.values()) if (x.groupId === o.groupId && !this.stopCancelAt.has(o.groupId)) this.stopCancelAt.set(o.groupId, at);
    }
  }
  filled(newId: string): boolean {
    return this.byNew.get(newId)?.filledAtMs != null;
  }
  // What the live updates said about one move so far.
  seen(newId: string, groupId: string): { filledAtMs: number | null; stopCanceledAtMs: number | null; canceledAtMs: number | null } {
    const m = this.byNew.get(newId);
    return { filledAtMs: m?.filledAtMs ?? null, stopCanceledAtMs: this.stopCancelAt.get(groupId) ?? null, canceledAtMs: m?.canceledAtMs ?? null };
  }
  // Forget moves older than the memory (called at the start of each sale): bounded memory.
  prune(keep: ReadonlySet<string>): void {
    for (const id of [...this.byNew.keys()]) {
      if (keep.has(id)) continue;
      const g = this.byNew.get(id)!.groupId;
      this.byNew.delete(id);
      this.stopCancelAt.delete(g);
    }
    // The old-to-new map is kept longer (the fill tally may meet a late update): at most 2,000 entries.
    while (this.oldOf.size > 2_000) this.oldOf.delete(this.oldOf.keys().next().value!);
  }
}

// The row's verdict on the stop: cancelled by Alpaca when the take-profit filled and the live updates showed the stop cancelled; false when
// today's path cancelled the exits (fallback) and the take-profit did not fill; null when the updates did not say.
export function stopVerdict(filled: boolean, stopCanceledAtMs: number | null, fallback: boolean): boolean | null {
  if (filled && stopCanceledAtMs !== null) return true;
  if (fallback && !filled) return false;
  return null;
}
