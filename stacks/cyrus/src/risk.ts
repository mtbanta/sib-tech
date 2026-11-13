// Watching what the gate set in motion: bring the stored entries up to date from Alpaca, check that every open
// entry still has a live exit resting at Alpaca, and stop the day if the daily loss limit is reached.
import { AlpacaError, type Order } from "./alpaca-trading.ts";
import { activeOrdersOldestFirst } from "./order-index.ts";
import type { Broker } from "./broker.ts";
import { centralClock, etInstant } from "./time.ts";
import { CONTROL_STOP, type DayRecord, type OrderRecord, type StopFlag, type Store } from "./store.ts";
import { OPEN_STATUSES, flattenLegs, openOrderIds, openSellQty, type Liquidator, type Say } from "./sells.ts";
import { SAFETY_RESERVE } from "./governor.ts";

export interface RiskDeps {
  broker: Broker;
  store: Store;
  now: () => Date;
  say: Say;
  liquidator: Liquidator;
  log?: (event: string, data?: Record<string, unknown>) => void;
  // Optional: the worker passes its own, so the loss stop remembers that it fired even when the stop flag cannot be read.
  lossMemory?: LossStopMemory;
  // Optional: the order-rate governor. When given, the loss stop's retry never spends Alpaca's last requests (the reserve in force,
  // decision 7 of 2026-11-06; the fixed SAFETY_RESERVE when the governor does not say), and the first sale's requests (as Alpaca
  // counted them) are charged to the loss stop's budget.
  governor?: { budget(): number; reserve?(): number; stats?(): { requestsLastMinute: number } };
  // Optional: the worker passes its own, so the order sync remembers between runs (release A, fixes 1 and 4).
  syncMemory?: SyncMemory;
  // The speed release (Michael's decision 3): told about each sale of shares left without a stop, so the worker can measure it
  // against waiting 5 more seconds.
  // Since decision 3 of 2026-11-06 it is told when Alpaca accepts the sale (not after the sale has filled), with the sale's client id.
  onBareSale?: (sale: { symbol: string; shares: number; takeProfit: number | null; atMs: number; clientOrderId?: string }) => void;
  // The speed release, item 5 (shadow only): told about each account read of the loss stop, so the worker can log its own estimate
  // of equity beside Alpaca's. It never changes what the loss stop does.
  onAccountRead?: (account: { equity: number; cash: number }) => void;
  // Messaging only (the speed release, decision 6): a successful sale of shares left without a stop is handed here, so the worker can
  // post them as one alert a minute. Without it the sale is posted to `alerts` at once, as before. Failures are always posted at once.
  onRemainderSold?: (symbol: string, shares: number) => void;
  // Logging only (Michael's approval of 2026-11-10): what the worker knows about a symbol when a sale is noticed late (when the live
  // update reported the stop's cancel, the timed sync it set, syncs put off because one was running). Must not throw.
  lateNoticeContext?: (symbol: string) => Record<string, unknown>;
  // A4 (counting only): told about each fresh stop placed for a remainder, for the summary's stop-gap line. Must not throw.
  onFreshStop?: (x: { symbol: string; shares: number }) => void;
}

// Logging only (Michael's approval of 2026-11-10): a shares-without-a-stop case noticed this long after Alpaca's cancel is logged as
// `late_notice`, with what the order sync was doing. By design it is noticed at once since A4 of 2026-11-12 (BARE_GRACE_MS is 0; it was
// about 3 seconds before); on 2026-11-10
// HIMS-38 was noticed 14.7 seconds after, with no cause in the records.
export const LATE_NOTICE_MS = 6_000;
// Fix C (Michael's approval of 2026-11-10): a sale reported as "not filled yet" gets its closing line when it fills; after this long
// without a fill seen, it is dropped without a line (the order sync deals with the shares again if they are still held).
export const AWAITING_FILL_MAX_MS = 2 * 60_000;
export interface AwaitingFill {
  symbol: string;
  qty: number;
  kind: "missing" | "bare";
  saleIds: string[];
  since: number;
}

// Release A, fix 1. On 2026-11-04 Alpaca paper cancelled a bracket's stop 2 ms after its take-profit's first partial fill (655
// times that day; Alpaca's documentation says the stop is "adjusted to the remaining quantity" instead). Until the take-profit
// finishes, the rest of the position has no stop. If it is still like that this long after the stop was cancelled, the rest is
// sold. 604 of the 655 finished within 10 seconds, 90 took longer than 5.
// The speed release (Michael's decision 3, 2026-11-05): 3 seconds, counted from Alpaca's cancel. The live update of the stop's cancel
// brings the next sync forward to that moment (worker.ts); the 10 second sync stays the backstop. On 2026-11-05, of 1,100 such
// cancels the take-profit finished on its own within 3 seconds in 827.
// A4 of the proposal of 2026-11-12 (Michael's approval): at once. The take-profit's rest is cancelled and a fresh stop placed for the
// shares left as soon as the stop's cancel is seen (the take-profits that would have finished on their own, about two thirds, are given
// up for that; the remainder ends at its fresh stop or the close-out).
export const BARE_GRACE_MS = 0;
// A5: how long the fast sale of a lost-exit entry waits for Alpaca's own cancel of its exits to free the share (this morning's cancels
// landed 0.05 to 1.06 seconds after the fill); if the share is still held by its exits after that, Alpaca kept them and nothing is sold.
export const FAST_LOST_EXIT_WAIT_MS = 2_500;
// Release A, fix 4: at most this many entries missing from Alpaca's listing are looked up by id in one sync, and an id Alpaca
// does not know is not asked again for this long.
export const MISSING_LOOKUPS_PER_SYNC = 10;
const MISSING_RETRY_MS = 60_000;
const MISSING_INTENT_AGE_MS = 10_000;
// The speed release, item 3: while Alpaca's live order updates are connected (they free symbols and report a stop's cancel at once),
// the 10 second sync is the backstop and reads only the orders of the last 10 minutes (at most 3 pages). An open entry older than
// that is looked up by its id instead: at most OLD_LOOKUPS_PER_SYNC in one sync, each at most every OLD_LOOKUP_EVERY_MS (as often as
// the normal-day sync used to read it). While the updates are NOT connected the sync reads everything since the oldest open entry,
// as before. On 2026-11-05 one entry held from 9:33 made every sync read about 2,600 entries (6 pages) by 2:00 PM.
export const RECENT_WINDOW_MS = 10 * 60_000;
export const RECENT_MAX_PAGES = 3;
export const OLD_LOOKUPS_PER_SYNC = 4;
// Group 1 review, round 1: at least this many, and enough that every older entry is looked up at least every OLD_LOOKUP_EVERY_MS
// (no slower than the normal-day sync of v9). An entry whose exit Alpaca just reported cancelled, expired or rejected (live updates,
// `mustLook`) is looked up on the very next sync, outside this budget, so the 3 second stop-gap sale also reaches an older entry.
export const OLD_LOOKUP_EVERY_MS = 30_000;

// Release 1 of 2026-11-09 (Michael's approval of parts A and C, builds/c2-proposal-2026-11-09.md): a cleanup sale that finds the
// shares held with no open order visible is tried again after 5 seconds, then 10, 20, and at most every 30 (part A, step 1), so a
// stuck symbol no longer holds up the sync. Michael hears once when a position is first stuck, once if it is still stuck after
// 5 minutes (part A, step 4), and once when it resolves (part C).
export const STUCK_RETRY_FIRST_MS = 5_000;
export const STUCK_RETRY_MAX_MS = 30_000;
export const STUCK_ESCALATE_MS = 5 * 60_000;
// Michael's choice of 2026-11-09 (after group 1 review round 1 of release 1 found that 8 or more symbols stuck at once could drain the
// request reserve with their retries): the short retries of stuck entries share at most 40 Alpaca requests a minute and 15 in any 5
// seconds, like the loss stop's retry. Each retry is counted at STUCK_RETRY_COST requests (one lookup plus one short round of the sale;
// at most 8 were measured in the simulator, the 2 more are margin). A retry that does not fit waits for room. A position's first sale is
// never limited, and nor is a retry held by visible orders (it runs at the next sync, one full attempt at a time, as before).
export const STUCK_RETRY_PER_MINUTE = 40;
export const STUCK_RETRY_PER_5S = 15;
export const STUCK_RETRY_COST = 10;
export interface StuckEntry {
  // Messaging only (group 2 review of 2026-11-12): true when the stuck case is a remainder the stack is trying to give a fresh stop (A4),
  // so the alerts say "protect or sell", not only "sell". Read by the alert texts alone, never by the retry or the sync's decisions.
  protecting?: boolean;
  symbol: string;
  since: number;
  nextAt: number;
  delayMs: number;
  alerted: boolean;
  escalated: boolean;
  // Michael's decision of 2026-11-09 (after group 1 round 2 of release 1): when it was last tried, so the retry allowance's room goes
  // to the stuck entry that has waited longest (taking turns), and the reason given in its last alert, for the 5 minute alert.
  lastTriedAt: number;
  why: string;
  // Messaging only (group 2, round 3 of the night release): the entry's fresh stop that hit the 15 second limit was still working at
  // Alpaca at the last try (the sale's own read showed it holding the shares), and whether Alpaca accepted our cancel of it. Read by the
  // 5 minute alert alone, so it tells the truth (a stop resting at Alpaca, not "no protective stop"); never by the retry or the sale.
  restingStop?: { stopClientOrderId: string; cancel: "accepted" | "refused" | "pending" | "not sent" };
}

export class SyncMemory {
  // When this worker first saw an entry with its stop gone and shares left (used when Alpaca gives no cancel time).
  readonly bareSeen = new Map<string, number>();
  // Client ids Alpaca answered "not found" for, and until when not to ask again.
  readonly notFoundUntil = new Map<string, number>();
  // Release B: the latest copy of each open entry (with its exit legs) as Alpaca showed it to the last sync, and when that sync
  // finished. The live order updates read these instead of asking Alpaca again.
  readonly lastSeen = new Map<string, Order>();
  lastSyncAt = 0;
  // The speed release, item 3: when each open entry older than the recent window was last looked up by its id.
  readonly oldLookedAt = new Map<string, number>();
  // Entries (client ids) whose exit leg the live updates just reported cancelled, expired or rejected: looked up on the next sync.
  readonly mustLook = new Set<string>();
  // Release 1 of 2026-11-09: entries (client ids) whose cleanup sale could not sell their shares, with the retry and alert state.
  readonly stuck = new Map<string, StuckEntry>();
  // When each short retry of a stuck entry was charged against the allowance above (milliseconds).
  readonly retrySpend: number[] = [];
  // Fix C of 2026-11-10: entries whose cleanup sale was sent but not seen filled, waiting for their closing line.
  readonly awaitingFill = new Map<string, AwaitingFill>();
  // Entries already logged as `late_notice` (once per entry: a stuck entry's retries are not new late notices).
  readonly lateLogged = new Set<string>();
  // A4 of the proposal of 2026-11-12: entries (client ids) whose remainder is protected by a fresh stop the stack placed.
  readonly freshStops = new Map<string, FreshStop>();
  // Ruling B of 2026-11-12: fresh stops that were not confirmed within 15 seconds (the stop's client id to its entry's). They are never
  // taken as protection again: if one shows up working later, its entry's missing-exit sale cancels it, waits for Alpaca's cancel, sells.
  readonly timedOutStops = new Map<string, string>();
  // Group 1, round 3 of the night release (Michael's decision 1 of 2026-11-13): timed-out fresh stops (client ids) whose cancel Alpaca has
  // already accepted once. If such a stop still holds the shares at a later try, the cancel is sent again only on the stuck backoff
  // (5, 10, 20, then every 30 seconds) and charged to the retry allowance, like a refused cancel: never every second.
  readonly timedOutCancelAccepted = new Set<string>();
  // Group 1, round 5 of the night release: when the live update said a timed-out stop ended (the stop's client id to the time). A sale of
  // its entry that was running then does not back off afterwards (it would undo the update's "sell now"): it is due again at once. This
  // fires once per stop end, because only an end at or after that try's start counts.
  readonly timedOutEndedAt = new Map<string, number>();
}

// Ruling B (the worker's live update, onFreshStopUpdate): a timed-out fresh stop ended at Alpaca. Its entry's sale is due now (no new
// request), the resting-stop note is dropped, and a sale of that entry still running will not back off afterwards.
export function noteTimedOutStopEnded(mem: SyncMemory, stopClientOrderId: string, nowMs: number): void {
  const entry = mem.timedOutStops.get(stopClientOrderId);
  if (!entry) return;
  mem.timedOutEndedAt.set(stopClientOrderId, nowMs);
  const st = mem.stuck.get(entry);
  if (st) {
    st.nextAt = 0;
    delete st.restingStop; // messaging only: the 5 minute alert no longer says the stop rests at Alpaca
  }
}

// A4 of the proposal of 2026-11-12 (Michael's approval): after a partial take-profit, Alpaca cancels the bracket's stop on the first share
// sold (436 of 436 cases this week). The stack then cancels the take-profit's rest at once and places a fresh stop sell for the shares
// left, at the bracket's own stop price. The remainder ends at that stop or at the next close-out (Michael's option a): no new take-profit.
export interface FreshStop {
  symbol: string;
  entryClientOrderId: string;
  stopClientOrderId: string;
  orderId: string | null;
  qty: number;
  stopPrice: number;
  placedAt: number;
  // Alpaca's last known status of the fresh stop ("unclear" while its first answer was unclear and it has not been looked up yet).
  status: string;
  lookedAt: number;
}
// The fresh stop's status comes from the sync's own order list when it is there (any sell working on the symbol already keeps the
// missing-exit check away), else from the live order updates; this often it is also looked up by its client id (one request), and at
// every such sync while the live updates are down or its first answer was unclear.
export const FRESH_STOP_LOOKUP_MS = 30_000;
// Michael's ruling B of 2026-11-12: a fresh stop whose first answer was unclear is looked up every 5 seconds (the sync runs again that
// soon while one is unclear), and if it is still unclear 15 seconds after it was sent, the remainder is treated as unprotected: the stop
// is looked up by its client id and cancelled if Alpaca has it, the sale waits for that cancel, and the shares are sold through the
// checked sell path, with an alert to Michael at once and one line when it resolves.
export const FRESH_STOP_UNCLEAR_LOOKUP_MS = 5_000;
export const FRESH_STOP_CONFIRM_MS = 15_000;
// Michael's decision 2 of 2026-11-13 (the split, pre-approved): the one switch for ruling B's 15 second limit and 5 second lookups. Off
// (false), an unclear fresh stop is handled as on Fly release v20: looked up at each sync, never cancelled by a time limit, never sold on
// top of. The time-to-confirm logging of a confirmed stop stays (logging only). The switch is `on` below (an object so the tests can
// check both states; nothing in the worker changes it).
export const FRESH_STOP_LIMIT = { on: true };

// A fresh stop's status from the order list, a lookup or a live update. When it was "unclear", its time to confirm (from when it was
// sent) is logged, so the share confirmed after 15 seconds can be reported (ruling B). "unknown_at_alpaca": Alpaca does not have it.
export function settleFreshStop(log: ((event: string, data?: Record<string, unknown>) => void) | undefined, f: FreshStop, status: string, by: string, nowMs: number): void {
  const was = f.status;
  f.status = status;
  f.lookedAt = nowMs;
  if (was === "unclear" && status !== "unclear") log?.("fresh_stop_confirmed", { symbol: f.symbol, clientOrderId: f.entryClientOrderId, stopClientOrderId: f.stopClientOrderId, status, by, found: status !== "unknown_at_alpaca", msToConfirm: nowMs - f.placedAt, afterLimit: nowMs - f.placedAt >= FRESH_STOP_CONFIRM_MS });
}

// Forgets an entry's fresh stop. Group 2, round 1 of the night release: one that was still unclear gets its outcome logged
// (`fresh_stop_unclear_end`), so every unclear fresh stop ends in exactly one of fresh_stop_confirmed, fresh_stop_timeout or this.
function dropFreshStop(d: RiskDeps, mem: SyncMemory, entryClientOrderId: string, how: string, nowMs: number): void {
  const f = mem.freshStops.get(entryClientOrderId);
  if (!f) return;
  mem.freshStops.delete(entryClientOrderId);
  if (f.status === "unclear") d.log?.("fresh_stop_unclear_end", { symbol: f.symbol, clientOrderId: entryClientOrderId, stopClientOrderId: f.stopClientOrderId, how, msFromSent: nowMs - f.placedAt });
}

// True while the fresh stop can still protect its remainder. Its status is taken from the sync's own order list when it is there, else
// from the live updates, else looked up. A failed look keeps what was known (an unclear stop counts as live, so no sale goes on top).
async function freshStopLive(d: RiskDeps, f: FreshStop, listed: Order[], nowMs: number, streamLive: boolean): Promise<boolean> {
  const inList = listed.find((x) => x.clientOrderId === f.stopClientOrderId);
  if (inList) {
    f.orderId = inList.id;
    settleFreshStop(d.log, f, inList.status, "order list", nowMs);
  } else if (f.status === "unclear" || !streamLive || nowMs - f.lookedAt >= FRESH_STOP_LOOKUP_MS) {
    try {
      const x = await d.broker.findOrderByClientId(f.stopClientOrderId);
      if (x) f.orderId = x.id;
      settleFreshStop(d.log, f, x ? x.status : "unknown_at_alpaca", "lookup", nowMs);
    } catch (err) {
      d.log?.("fresh_stop_lookup_failed", { symbol: f.symbol, error: (err as Error).message.slice(0, 120) });
    }
  }
  return OPEN_STATUSES.has(f.status) || f.status === "unclear";
}

// Michael's choice of 2026-11-09: the earliest moment a short retry fits the allowance (now if it fits), and charge it if it does.
export function takeRetryRoom(mem: SyncMemory, nowMs: number): { ok: true } | { ok: false; at: number } {
  const recent = mem.retrySpend.filter((t) => nowMs - t < 60_000);
  mem.retrySpend.splice(0, mem.retrySpend.length, ...recent);
  const lastMinute = recent.length * STUCK_RETRY_COST;
  const last5s = recent.filter((t) => nowMs - t < 5_000);
  if (lastMinute + STUCK_RETRY_COST <= STUCK_RETRY_PER_MINUTE && last5s.length * STUCK_RETRY_COST + STUCK_RETRY_COST <= STUCK_RETRY_PER_5S) {
    mem.retrySpend.push(nowMs);
    return { ok: true };
  }
  // The next moment one more fits: when enough of the minute's charges, and of the 5 seconds' charges, have aged out.
  const minuteSlots = Math.floor(STUCK_RETRY_PER_MINUTE / STUCK_RETRY_COST);
  const fiveSlots = Math.floor(STUCK_RETRY_PER_5S / STUCK_RETRY_COST);
  const byMinute = recent.length >= minuteSlots ? recent[recent.length - minuteSlots]! + 60_000 : nowMs;
  const byFive = last5s.length >= fiveSlots ? last5s[last5s.length - fiveSlots]! + 5_000 : nowMs;
  return { ok: false, at: Math.max(byMinute, byFive, nowMs + 1) };
}
const fallbackSync = new SyncMemory();

// An entry whose stop is no longer live (cancelled or expired, not filled) while some of its shares are not sold yet: those shares
// have no stop, even if the take-profit is still open. Null when the stop is live, filled, absent, or nothing is left.
export function bareRemainder(o: Order): { shares: number; stop: Order } | null {
  const stop = stopLeg(o);
  if (!stop || OPEN_STATUSES.has(stop.status) || stop.filledQty > 0) return null;
  const left = o.filledQty - exitFilledQty(o);
  return left > 1e-9 ? { shares: left, stop } : null;
}

// A live exit leg of an entry: a sell leg that can still execute.
export const hasLiveExit = (o: Order): boolean => flattenLegs(o).some((l) => l.side === "sell" && OPEN_STATUSES.has(l.status));
const exitFilledQty = (o: Order): number => flattenLegs(o).filter((l) => l.side === "sell").reduce((n, l) => n + l.filledQty, 0);

// Kept for older callers and tests: the protective stop leg, if Alpaca shows one.
export function stopLeg(o: Order): Order | undefined {
  return o.legs.find((l) => l.side === "sell" && (l.type === "stop" || l.stopPrice !== null));
}

export interface SyncOptions {
  // False while a close-out is running or after the close-out time: the missing-exit check is skipped and NO sell is
  // placed. The close-out alone flattens the account. (On 2026-11-02 this check sold five positions the close-out had
  // just un-protected on purpose, and raised five false alarms.)
  // A function is asked again just before each sale, so a close-out that starts while the sync is running switches it off.
  protect: boolean | (() => boolean);
  // The speed release, item 3: true while Alpaca's live order updates are connected; then only the last 10 minutes are read.
  streamLive?: boolean;
  // Michael's decision of 2026-11-09 ("Mid-day owns it"): true while the mid-day close-out is selling (10:30 until flat). Its own two
  // alerts (not flat yet, and 5 minutes later) cover those positions, so the stuck-entry 5 minute alert stands aside meanwhile.
  middayOwnsSelling?: () => boolean;
}

// Updates stored entries from Alpaca by looking only at orders newer than the oldest entry still being watched
// (paged, so a day with thousands of orders is read in full). An entry is judged by its OWN order and its OWN exit
// legs, never by symbol, because a symbol can be entered again after the first position closed.
// An open entry with no live exit while its position is still held is sold at once and reported.
// Release A: `recheckAt` is the earliest moment a bare remainder (fix 1) reaches its grace time; the worker runs the next sync then.
export async function syncOrders(d: RiskDeps, day: DayRecord, opts: SyncOptions = { protect: true }): Promise<{ unprotected: string[]; incomplete: boolean; recheckAt?: number }> {
  const mem = d.syncMemory ?? fallbackSync;
  // Logging only (Michael's approval of 2026-11-10): what this sync did before it reached an entry noticed late.
  const syncStartMs = d.now().getTime();
  const prevSyncEndedAt = mem.lastSyncAt;
  const mustLookAtStart = new Set(mem.mustLook);
  const lookedUp = new Set<string>();
  let cleanupsThisSync = 0;
  let cleanupMsThisSync = 0;
  // Michael's approval C of 2026-11-12: the index's still-working set, oldest first as before (the walk keeps that order).
  const active = await activeOrdersOldestFirst(d.store, day.tradeDate);
  if (active.length === 0) {
    await settleAwaiting(d, mem, null, new Set());
    // Group 2 review, round 1: an entry reported stuck whose record was closed elsewhere (the live updates close a record when an exit
    // fill leaves the symbol flat) still gets its one resolution line.
    for (const id of [...mem.stuck.keys()]) await resolveStuck(d, mem, id, "no longer held");
    mem.bareSeen.clear();
    mem.lastSeen.clear();
    for (const id of [...mem.freshStops.keys()]) dropFreshStop(d, mem, id, "its entry is no longer open", syncStartMs);
    mem.lastSyncAt = d.now().getTime();
    return { unprotected: [], incomplete: false };
  }
  const activeIds = new Set(active.map((o) => o.clientOrderId));
  for (const id of [...mem.lastSeen.keys()]) if (!activeIds.has(id)) mem.lastSeen.delete(id);
  for (const id of [...mem.oldLookedAt.keys()]) if (!activeIds.has(id)) mem.oldLookedAt.delete(id);
  for (const id of [...mem.mustLook]) if (!activeIds.has(id)) mem.mustLook.delete(id);
  for (const id of [...mem.lateLogged]) if (!activeIds.has(id)) mem.lateLogged.delete(id);
  for (const id of [...mem.freshStops.keys()]) if (!activeIds.has(id)) dropFreshStop(d, mem, id, "its entry is no longer open", syncStartMs);
  for (const id of [...mem.stuck.keys()]) if (!activeIds.has(id)) await resolveStuck(d, mem, id, "no longer held");
  const midnight = etInstant(day.tradeDate, "00:00").getTime();
  const nowMs = d.now().getTime();
  const createdMs = (o: OrderRecord) => (o.createdAt ? new Date(o.createdAt).getTime() : midnight);
  const oldest = Math.min(...active.map(createdMs));
  const fromMs = Math.max(midnight, oldest - 60_000, opts.streamLive ? nowMs - RECENT_WINDOW_MS : midnight);
  const since = new Date(fromMs).toISOString();
  const [listed, positions] = await Promise.all([d.broker.listOrdersPaged("all", since, opts.streamLive ? RECENT_MAX_PAGES : 20), d.broker.listPositions()]);
  // Logging only (Michael's decision of 2026-11-09): how old this order list and these positions are when the sync acts on them.
  const listedAtMs = d.now().getTime();
  const listAgeMs = () => d.now().getTime() - listedAtMs;
  const byClientId = new Map(listed.orders.map((o) => [o.clientOrderId, o]));
  // Fix C of 2026-11-10: a sale reported as "not filled yet" that has now filled gets its closing line.
  await settleAwaiting(d, mem, listed.orders, activeIds);
  // Item 3: open entries made before the window read above are looked up by id, a few per sync, oldest look first.
  if (opts.streamLive) {
    const older = active.filter((s) => createdMs(s) < fromMs && !byClientId.has(s.clientOrderId));
    const must = older.filter((s) => mem.mustLook.has(s.clientOrderId));
    const due = older.filter((s) => !mem.mustLook.has(s.clientOrderId) && nowMs - (mem.oldLookedAt.get(s.clientOrderId) ?? 0) >= OLD_LOOKUP_EVERY_MS);
    due.sort((a, b) => (mem.oldLookedAt.get(a.clientOrderId) ?? 0) - (mem.oldLookedAt.get(b.clientOrderId) ?? 0) || createdMs(a) - createdMs(b));
    const budget = Math.max(OLD_LOOKUPS_PER_SYNC, Math.ceil(older.length / 3));
    for (const s of [...must, ...due.slice(0, budget)]) {
      mem.oldLookedAt.set(s.clientOrderId, nowMs);
      mem.mustLook.delete(s.clientOrderId);
      try {
        const found = await d.broker.findOrderByClientId(s.clientOrderId);
        if (found) {
          byClientId.set(s.clientOrderId, found);
          lookedUp.add(s.clientOrderId);
        }
      } catch (err) {
        d.log?.("order_lookup_failed", { clientOrderId: s.clientOrderId, error: (err as Error).message.slice(0, 120) });
      }
    }
  }
  // Release A, fix 4: on 2026-11-04 Alpaca's listing left out 2 of the day's entries. An entry that should be at Alpaca but is
  // missing from the listing is fetched by its client id, so it still gets its record update and its missing-exit check. (An entry
  // older than the window read above is not "missing": item 3's lookups above take care of it.)
  let lookups = 0;
  // Decision 1 of 2026-11-06: an entry the live updates just reported (both exits lost, or an exit ended) is looked up first, so it
  // is never left behind the other missing entries on a busy day.
  const lookupOrder = [...active].sort((a, b) => Number(mem.mustLook.has(b.clientOrderId)) - Number(mem.mustLook.has(a.clientOrderId)));
  for (const s of lookupOrder) {
    if (byClientId.has(s.clientOrderId) || lookups >= MISSING_LOOKUPS_PER_SYNC) continue;
    if (createdMs(s) < fromMs) continue;
    const age = s.createdAt ? nowMs - new Date(s.createdAt).getTime() : Infinity;
    if (!(s.status === "submitted" || s.status === "filled" || (s.status === "intent" && age > MISSING_INTENT_AGE_MS))) continue;
    if ((mem.notFoundUntil.get(s.clientOrderId) ?? 0) > nowMs) continue;
    lookups++;
    mem.mustLook.delete(s.clientOrderId);
    try {
      const found = await d.broker.findOrderByClientId(s.clientOrderId);
      if (found) {
        byClientId.set(s.clientOrderId, found);
        lookedUp.add(s.clientOrderId);
      } else mem.notFoundUntil.set(s.clientOrderId, nowMs + MISSING_RETRY_MS);
      d.log?.("order_missing_from_listing", { clientOrderId: s.clientOrderId, found: found !== null });
    } catch (err) {
      d.log?.("order_lookup_failed", { clientOrderId: s.clientOrderId, error: (err as Error).message.slice(0, 120) });
    }
  }
  const held = new Set(positions.map((p) => p.symbol));
  let recheckAt: number | undefined;
  // Logging only (Michael's approval of 2026-11-10): an entry whose stop (or both exits) Alpaca cancelled more than LATE_NOTICE_MS ago.
  const lateNotice = (s: OrderRecord, kind: "missing" | "bare", cancelledAt: string | null, extra: Record<string, unknown> = {}) => {
    // Group 2 review, round 1: once per entry, and never for an entry already reported stuck (its retries go down the missing-exit
    // path measured from the take-profit cancel our own cleanup made, which is not a late notice).
    if (mem.stuck.has(s.clientOrderId) || mem.lateLogged.has(s.clientOrderId)) return;
    const t = cancelledAt ? Date.parse(cancelledAt) : NaN;
    const at = d.now().getTime();
    if (!Number.isFinite(t) || at - t <= LATE_NOTICE_MS) return;
    mem.lateLogged.add(s.clientOrderId);
    let ctx: Record<string, unknown> = {};
    try {
      ctx = d.lateNoticeContext?.(s.symbol) ?? {};
    } catch {
      /* logging must never break the sync */
    }
    d.log?.("late_notice", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, lagMs: at - t, cancelledAt, syncStartedAgoMs: at - syncStartMs, gapSincePreviousSyncMs: prevSyncEndedAt > 0 ? syncStartMs - prevSyncEndedAt : null, cleanupsEarlierThisSync: cleanupsThisSync, cleanupMsThisSync, foundBy: lookedUp.has(s.clientOrderId) ? "lookup" : "listing", mustLook: mustLookAtStart.has(s.clientOrderId), listAgeMs: listAgeMs(), streamLive: opts.streamLive === true, ...extra, ...ctx });
  };
  const timedCleanup = async (...args: Parameters<typeof cleanupSale>) => {
    const t0 = d.now().getTime();
    try {
      return await cleanupSale(...args);
    } finally {
      cleanupsThisSync++;
      cleanupMsThisSync += d.now().getTime() - t0;
    }
  };
  const latestPerSymbol = new Map<string, OrderRecord>();
  for (const s of active) {
    const prev = latestPerSymbol.get(s.symbol);
    if (!prev || (s.createdAt ?? "") > (prev.createdAt ?? "") || ((s.createdAt ?? "") === (prev.createdAt ?? "") && s.clientOrderId > prev.clientOrderId)) latestPerSymbol.set(s.symbol, s);
  }
  // A sell already working on a symbol (a liquidation in progress) explains a missing exit: no false alarm.
  // A4 (group 1 review, round 2): a fresh stop of ours (cyrus-p-) counts only when it covers the symbol's whole holding (it is placed only
  // when its entry holds the whole symbol). With another position on the symbol it protects only its own shares, so it must not keep the
  // check away from the other position.
  const heldQty = new Map(positions.map((p) => [p.symbol, p.qty]));
  // Ruling B (group 1, round 2 of the night release): a fresh stop that hit the 15 second limit never counts here (it is not protection and
  // not a sale of ours): the walk reaches its entry, whose missing-exit sale cancels it, waits for Alpaca's cancel and sells.
  const sellingSymbols = new Set(listed.orders.filter((x) => x.side === "sell" && OPEN_STATUSES.has(x.status) && !mem.timedOutStops.has(x.clientOrderId) && (!x.clientOrderId.startsWith("cyrus-p-") || x.qty - x.filledQty >= (heldQty.get(x.symbol) ?? 0) - 1e-9)).map((x) => x.symbol));
  const unprotected: string[] = [];
  // Michael's decision of 2026-11-09: the 5 minute alert goes by the clock, for every entry reported stuck, whether or not its retry
  // has had room yet.
  // Group 2, round 1 of the night release: a symbol the position list does not show is passed as 0 held (nothing left to protect).
  if (!opts.middayOwnsSelling?.()) for (const id of [...mem.stuck.keys()]) await escalateIfDue(d, mem, id, positions.find((p) => p.symbol === mem.stuck.get(id)?.symbol)?.qty ?? 0, listed.orders);
  // Michael's decision of 2026-11-09: entries on the short retry list are walked last, longest waiting first, so the first one due
  // takes the allowance's room and the others take turns (before, the same few won every minute).
  const shortRetry = (s: OrderRecord) => (mem.stuck.get(s.clientOrderId)?.nextAt ?? 0) > 0;
  // Ruling B of 2026-11-12: an unclear fresh stop that the sync's own order list shows is confirmed here, before the walk (the walk
  // skips a symbol with a working sell, which is how a resting fresh stop appears), so its time to confirm is logged and the 15 second
  // limit never cancels a stop Alpaca visibly holds.
  if (FRESH_STOP_LIMIT.on) for (const f of mem.freshStops.values()) {
    if (f.status !== "unclear") continue;
    const shown = listed.orders.find((x) => x.clientOrderId === f.stopClientOrderId);
    if (shown) {
      f.orderId = shown.id;
      settleFreshStop(d.log, f, shown.status, "order list", nowMs);
    }
  }
  const walk = [...active.filter((s) => !shortRetry(s)), ...active.filter(shortRetry).sort((a, b) => mem.stuck.get(a.clientOrderId)!.lastTriedAt - mem.stuck.get(b.clientOrderId)!.lastTriedAt)];
  for (const s of walk) {
    const o = byClientId.get(s.clientOrderId);
    if (!o) continue;
    mem.lastSeen.set(s.clientOrderId, o);
    if (s.status === "intent" && o.status !== "filled" && o.status !== "canceled" && o.status !== "expired" && o.status !== "rejected") {
      await d.store.updateOrder(s.clientOrderId, { status: "submitted", alpacaOrderId: o.id, note: null });
    }
    if (o.status === "filled" && s.status !== "filled") {
      await d.store.updateOrder(s.clientOrderId, { status: "filled", filledQty: o.filledQty, filledAvgPrice: o.filledAvgPrice, alpacaOrderId: o.id });
    } else if ((o.status === "canceled" || o.status === "expired") && o.filledQty === 0 && s.status !== "canceled") {
      await d.store.updateOrder(s.clientOrderId, { status: "canceled", alpacaOrderId: o.id });
    } else if ((o.status === "canceled" || o.status === "expired") && o.filledQty > 0 && s.status !== "filled") {
      // cancelled after a partial fill: what filled is a real position
      await d.store.updateOrder(s.clientOrderId, { status: "filled", filledQty: o.filledQty, filledAvgPrice: o.filledAvgPrice, alpacaOrderId: o.id, note: "cancelled after a partial fill" });
    } else if (o.status === "partially_filled" && (s.filledQty ?? 0) !== o.filledQty) {
      await d.store.updateOrder(s.clientOrderId, { filledQty: o.filledQty, filledAvgPrice: o.filledAvgPrice, alpacaOrderId: o.id });
    } else if (o.status === "rejected" && s.status !== "rejected") {
      await d.store.updateOrder(s.clientOrderId, { status: "rejected", alpacaOrderId: o.id, note: "rejected by Alpaca" });
      await d.say("commands", `Alpaca rejected the entry for ${s.symbol}.`);
    }
    if (!(o.filledQty > 0)) continue;
    // Closed: its exit leg has filled for the whole quantity, or the position is no longer held at all.
    // Closed: its exit leg has filled for the whole quantity, or the position is gone. "Gone" counts only when the entry order is
    // final (not still working at Alpaca) and its fill is clearly old: the orders and positions are read at nearly the same
    // moment, and an entry that fills between the two reads would otherwise look closed. An unknown fill time is treated as
    // recent unless the entry itself is more than a minute old.
    const orderFinal = o.status === "filled" || o.status === "canceled" || o.status === "expired";
    const ageMs = (iso: string | null) => (iso ? d.now().getTime() - new Date(iso).getTime() : null);
    const fillAge = ageMs(o.filledAt) ?? ageMs(s.createdAt ?? null);
    const goneForGood = !held.has(s.symbol) && orderFinal && fillAge !== null && fillAge > (o.filledAt ? 10_000 : 60_000);
    if (exitFilledQty(o) >= o.filledQty - 1e-9 || goneForGood) {
      await d.store.updateOrder(s.clientOrderId, { closedAt: d.now().toISOString() });
      mem.bareSeen.delete(s.clientOrderId);
      mem.lastSeen.delete(s.clientOrderId);
      dropFreshStop(d, mem, s.clientOrderId, "its entry closed (its shares are gone)", nowMs);
      await resolveStuck(d, mem, s.clientOrderId, "no longer held");
      continue;
    }
    const protectNow = typeof opts.protect === "function" ? opts.protect() : opts.protect;
    // Group 1 review, round 1 (messaging): an entry reported stuck that is no longer the newest on its symbol gets its resolution line.
    if (latestPerSymbol.get(s.symbol)?.clientOrderId !== s.clientOrderId) await resolveStuck(d, mem, s.clientOrderId, `a newer ${s.symbol} position took over, and I watch that one now`);
    if (!protectNow || latestPerSymbol.get(s.symbol)?.clientOrderId !== s.clientOrderId || sellingSymbols.has(s.symbol)) continue;
    // A4: a remainder protected by its fresh stop is left alone while that stop can still execute. Once the stop is gone (cancelled,
    // expired or rejected by anyone but our own sale) and the shares are still held, the missing-exit check below sells them, as before.
    const fresh = mem.freshStops.get(s.clientOrderId);
    if (fresh) {
      // Only while it covers the whole holding (group 1 review, round 2).
      const covering = held.has(s.symbol) && fresh.qty >= (heldQty.get(s.symbol) ?? 0) - 1e-9;
      // Michael's ruling B of 2026-11-12: still unclear 15 seconds after it was sent (as known before this sync's look): unprotected. The
      // look at the limit is part of cancelling it (freshStopTimeout), not a late confirmation.
      if (FRESH_STOP_LIMIT.on && covering && fresh.status === "unclear" && nowMs - fresh.placedAt >= FRESH_STOP_CONFIRM_MS) {
        const t = await freshStopTimeout(d, day, mem, s, o, fresh, nowMs);
        if (t.attempted) unprotected.push(s.symbol);
        if (t.recheckAt !== undefined) recheckAt = recheckAt === undefined ? t.recheckAt : Math.min(recheckAt, t.recheckAt);
        continue;
      }
      if (covering && (await freshStopLive(d, fresh, listed.orders, nowMs, opts.streamLive === true))) {
        if (FRESH_STOP_LIMIT.on && fresh.status === "unclear") {
          // Still unclear: looked up again within 5 seconds, and the sync runs at the 15 second limit (the entry is looked up at that
          // sync too, even if it is older than the 10 minute list).
          const due = Math.min(nowMs + FRESH_STOP_UNCLEAR_LOOKUP_MS, fresh.placedAt + FRESH_STOP_CONFIRM_MS);
          recheckAt = recheckAt === undefined ? due : Math.min(recheckAt, due);
          mem.mustLook.add(s.clientOrderId);
        }
        continue;
      }
      dropFreshStop(d, mem, s.clientOrderId, held.has(s.symbol) ? "it no longer covers the holding" : "the shares are no longer held", nowMs);
      if (held.has(s.symbol)) d.log?.("fresh_stop_gone", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: fresh.stopClientOrderId, status: fresh.status, msFromSent: nowMs - fresh.placedAt });
    }
    if (!hasLiveExit(o)) {
      const due = retryDue(mem, s.clientOrderId, d.now().getTime());
      if (due !== null) {
        // Part A, step 1: tried moments ago and stuck; it is tried again at `due` (or when the retry allowance has room), and the sync
        // carries on with the others.
        unprotected.push(s.symbol);
        recheckAt = recheckAt === undefined ? due : Math.min(recheckAt, due);
        continue;
      }
      d.log?.("unprotected_position", { symbol: s.symbol, clientOrderId: s.clientOrderId, listAgeMs: listAgeMs() });
      const endedAt = flattenLegs(o).filter((l) => l.side === "sell" && !OPEN_STATUSES.has(l.status)).map((l) => l.canceledAt ?? l.updatedAt ?? "").filter((x) => Number.isFinite(Date.parse(x))).sort().at(-1) ?? null;
      lateNotice(s, "missing", endedAt);
      // Ruling B: a timed-out fresh stop of this entry still shown working is cancelled by this sale (which waits for Alpaca's cancel).
      const timedOutShown = listed.orders.filter((x) => mem.timedOutStops.get(x.clientOrderId) === s.clientOrderId && OPEN_STATUSES.has(x.status));
      const timedOutIds = timedOutShown.map((x) => x.id);
      // Group 2, round 3 (logging only): the cancel's outcome is logged by the sale after it was tried (cleanupSale), not here before it.
      const c = await timedCleanup(d, day, mem, s, o, "missing", undefined, timedOutIds.length > 0 ? { alsoCancel: timedOutIds, alsoCancelStops: timedOutShown.map((x) => x.clientOrderId) } : {});
      if (c.attempted) unprotected.push(s.symbol);
      if (c.recheckAt !== undefined) recheckAt = recheckAt === undefined ? c.recheckAt : Math.min(recheckAt, c.recheckAt);
      continue;
    }
    // Release A, fix 1: the take-profit is still open (so the check above passes) but the stop is gone and shares are left.
    const bare = held.has(s.symbol) ? bareRemainder(o) : null;
    if (!bare) {
      mem.bareSeen.delete(s.clientOrderId);
      continue;
    }
    const firstSeen = mem.bareSeen.get(s.clientOrderId) ?? nowMs;
    mem.bareSeen.set(s.clientOrderId, firstSeen);
    const cancelTime = bare.stop.canceledAt ?? bare.stop.updatedAt ?? null;
    const parsed = cancelTime ? Date.parse(cancelTime) : NaN;
    // Alpaca's own cancel time, never later than this worker's first sight of it (a clock that runs behind cannot add wait).
    const since = Number.isFinite(parsed) ? Math.min(parsed, firstSeen) : firstSeen;
    if (nowMs - since < BARE_GRACE_MS) {
      const due = since + BARE_GRACE_MS;
      recheckAt = recheckAt === undefined ? due : Math.min(recheckAt, due);
      // Group 1 review, round 2: the sync at the grace time must look this entry up again, even if it is older than the 10 minute read.
      mem.mustLook.add(s.clientOrderId);
      continue;
    }
    const stuckDue = retryDue(mem, s.clientOrderId, d.now().getTime());
    if (stuckDue !== null) {
      // Part A, step 1: tried moments ago and stuck; it is tried again then (or when the retry allowance has room), and the sync
      // carries on with the others.
      unprotected.push(s.symbol);
      recheckAt = recheckAt === undefined ? stuckDue : Math.min(recheckAt, stuckDue);
      continue;
    }
    d.log?.("bare_remainder", { symbol: s.symbol, clientOrderId: s.clientOrderId, shares: bare.shares, stopCancelledAt: cancelTime, listAgeMs: listAgeMs() });
    lateNotice(s, "bare", cancelTime, { firstSeenAgoMs: d.now().getTime() - firstSeen });
    const tp = flattenLegs(o).find((l) => l.side === "sell" && l.type === "limit");
    // Decision 3 of 2026-11-06: the measurement starts the moment Alpaca accepts the sale, so it sees the sale's fill and the prints
    // after it (before, it was told only after the sale had filled, and 99 of 103 sales went unmeasured).
    const onSellSent = (x: { symbol: string; qty: number; clientOrderId: string; atMs: number }) => {
      if (x.symbol !== s.symbol) return;
      try {
        d.onBareSale?.({ symbol: x.symbol, shares: x.qty, takeProfit: tp?.limitPrice ?? null, atMs: x.atMs, clientOrderId: x.clientOrderId });
      } catch {
        /* a measurement must never break the sync */
      }
    };
    const c = await timedCleanup(d, day, mem, s, o, "bare", onSellSent, { stopPrice: bare.stop.stopPrice ?? s.stopPrice, stopCancelledAt: cancelTime });
    if (c.attempted) unprotected.push(s.symbol);
    if (c.recheckAt !== undefined) recheckAt = recheckAt === undefined ? c.recheckAt : Math.min(recheckAt, c.recheckAt);
    if (!c.stuck) mem.bareSeen.delete(s.clientOrderId);
  }
  if (!listed.complete) d.log?.("order_list_incomplete", { since, pages: listed.pages });
  mem.lastSyncAt = d.now().getTime();
  return { unprotected, incomplete: !listed.complete, ...(recheckAt !== undefined ? { recheckAt } : {}) };
}

const EPS_QTY = 1e-9;

// Part A, step 1, with Michael's retry allowance: null when the entry may be tried now (a first sale, a retry held by visible orders,
// or a short retry that is due and fits the allowance, which is then charged); otherwise the moment to look again.
// The stuck record on the hidden-hold backoff (5, 10, 20, then every 30 seconds; retryDue charges the retry allowance when it is due).
function backoffStuck(mem: SyncMemory, symbol: string, clientOrderId: string, nowMs: number, why: string): StuckEntry {
  const st = mem.stuck.get(clientOrderId) ?? { symbol, since: nowMs, nextAt: 0, delayMs: 0, alerted: false, escalated: false, lastTriedAt: nowMs, why: "" };
  st.lastTriedAt = nowMs;
  st.delayMs = st.delayMs > 0 ? Math.min(st.delayMs * 2, STUCK_RETRY_MAX_MS) : STUCK_RETRY_FIRST_MS;
  st.nextAt = nowMs + st.delayMs;
  if (!st.why) st.why = why;
  mem.stuck.set(clientOrderId, st);
  return st;
}

function retryDue(mem: SyncMemory, clientOrderId: string, nowMs: number): number | null {
  const st = mem.stuck.get(clientOrderId);
  if (!st || st.nextAt === 0) return null;
  if (st.nextAt > nowMs) return st.nextAt;
  const room = takeRetryRoom(mem, nowMs);
  if (room.ok) return null;
  st.nextAt = room.at;
  return room.at;
}
const plural = (n: number, one: string, many: string = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const minutesText = (ms: number): string => (ms < 60_000 ? plural(Math.max(1, Math.round(ms / 1000)), "second") : plural(Math.round(ms / 60_000), "minute"));

// Part A, step 4: the one alert after 5 minutes stuck (mentions Michael), by the clock (Michael's decision of 2026-11-09).
// Group 2 review of 2026-11-12, rounds 1 and 2 (messaging only): not posted while the entry's remembered fresh stop protects the position:
// its known status is working, or the order list the sync has already read (`listed`, read only) shows that stop (by its client id)
// working, in either case covering the holding. This is the case of a fresh stop whose first answer was unclear and which Alpaca in fact
// holds. Nothing is written here (not the stuck record, not the fresh stop's status), so the alert can still come if that stop ends.
async function escalateIfDue(d: RiskDeps, mem: SyncMemory, clientOrderId: string, heldQty?: number, listed?: readonly Order[]): Promise<void> {
  const st = mem.stuck.get(clientOrderId);
  const now = d.now().getTime();
  if (!st || !st.alerted || st.escalated || now - st.since < STUCK_ESCALATE_MS) return;
  // Messaging only (group 2, round 1 of the night release): nothing held, nothing to escalate; the entry's closing line follows.
  if (heldQty !== undefined && heldQty <= 1e-9) return;
  const fresh = mem.freshStops.get(clientOrderId);
  const covers = (q: number) => heldQty === undefined || q >= heldQty - 1e-9;
  const working = (status: string) => OPEN_STATUSES.has(status) && status !== "pending_cancel";
  const shown = fresh ? listed?.find((x) => x.clientOrderId === fresh.stopClientOrderId && working(x.status)) : undefined;
  // A status still "unclear" holds it too: the sync's walk looks that stop up (or the list shows it) and settles it, so a real problem is
  // reported at most one sync later.
  if (fresh && (fresh.status === "unclear" || (working(fresh.status) && covers(fresh.qty)) || (shown && covers(shown.qty - shown.filledQty)))) return;
  // Group 2, round 1 of the night release (messaging only): not posted while a sale of ours (cyrus-x-) covering the holding is working
  // in the list the sync has already read (ruling B's sale after the 15 second limit, waiting for Alpaca to fill it).
  const ourSale = (listed ?? []).filter((x) => x.symbol === st.symbol && x.side === "sell" && x.clientOrderId.startsWith("cyrus-x-") && working(x.status)).reduce((n, x) => n + Math.max(0, x.qty - x.filledQty), 0);
  if (ourSale > 0 && covers(ourSale)) return;
  st.escalated = true;
  // Group 2, round 3 of the night release (messaging only): the entry's fresh stop that hit the 15 second limit is still working at
  // Alpaca, shown in the list the sync has already read or, when that list does not show it, held the shares at the last try (read only).
  // Then the alert says the truth: the stop rests at Alpaca and may still protect the shares, but the stack no longer counts on it.
  const shownStop = (listed ?? []).find((x) => mem.timedOutStops.get(x.clientOrderId) === clientOrderId && OPEN_STATUSES.has(x.status));
  // Group 2, round 5: the note from the last try is out of date when the list the sync has just read shows that stop ended (the live
  // updates were down, so nothing else cleared it). Then the shares have no stop at all: the note is dropped and the alert says so.
  const noted = st.restingStop;
  if (!shownStop && noted && (listed ?? []).some((x) => x.clientOrderId === noted.stopClientOrderId && !OPEN_STATUSES.has(x.status))) {
    delete st.restingStop;
    await d.say("alerts", `**Michael: ${st.symbol} has no protective stop: its fresh stop, not confirmed in time, has ended at Alpaca, and after ${minutesText(now - st.since)} I have not sold the shares yet.** Please close it in Alpaca's dashboard if it is still held. I keep trying.`, { mentionOwner: true });
    return;
  }
  const restingId = shownStop?.clientOrderId ?? st.restingStop?.stopClientOrderId;
  if (restingId) {
    const known = st.restingStop?.stopClientOrderId === restingId ? st.restingStop.cancel : undefined;
    const pending = shownStop?.status === "pending_cancel" || (!shownStop && known === "pending");
    if (shownStop) {
      // Shown in the list the sync has just read: present tense.
      const cancel = pending ? "Alpaca shows it pending cancel but has not finished cancelling it" : known === "refused" ? "Alpaca did not accept my last cancel of it" : known === "accepted" || mem.timedOutCancelAccepted.has(restingId) ? "Alpaca accepted my cancel of it but still shows it working" : "my cancel of it has not taken effect";
      await d.say("alerts", `**Michael: ${st.symbol}'s fresh protective stop, not confirmed in time, is still resting at Alpaca after ${minutesText(now - st.since)}; ${cancel}, so I still cannot sell the shares.** That stop may still protect them, but I no longer count on it. Please check ${st.symbol} in Alpaca's dashboard and close it there if needed. I keep trying.`, { mentionOwner: true });
    } else {
      // Known only from the last try (group 2, round 5): past tense, since it may have changed since.
      const cancel = pending ? "Alpaca showed it pending cancel" : known === "refused" ? "Alpaca did not accept my last cancel of it" : known === "accepted" || mem.timedOutCancelAccepted.has(restingId) ? "Alpaca had accepted my cancel of it but still showed it working" : "my cancel of it had not taken effect";
      await d.say("alerts", `**Michael: ${st.symbol}'s fresh protective stop, not confirmed in time, was still resting at Alpaca at my last try, ${minutesText(now - st.since)} on; ${cancel}, so I have not been able to sell the shares.** If that stop is still there it may protect them, but I no longer count on it. Please check ${st.symbol} in Alpaca's dashboard and close it there if needed. I keep trying.`, { mentionOwner: true });
    }
    return;
  }
  const what = st.protecting ? "I still cannot protect or sell it" : "I still cannot sell it";
  await d.say("alerts", `**Michael: ${st.symbol} still has no protective stop after ${minutesText(now - st.since)}, and ${what}** (${st.why || "still held"}). Please close it in Alpaca's dashboard. I keep trying.`, { mentionOwner: true });
}

// Fix C (Michael's approval of 2026-11-10): the closing line for a sale reported as "not filled yet": when every sale of the entry is seen
// filled in Alpaca's list, or the entry is no longer open (its shares are gone). A sale Alpaca ended unfilled, or one not seen filled
// within AWAITING_FILL_MAX_MS, is dropped without a line (the order sync deals with the shares if they are still held). No request.
async function settleAwaiting(d: RiskDeps, mem: SyncMemory, orders: Order[] | null, activeIds: ReadonlySet<string>): Promise<void> {
  const now = d.now().getTime();
  for (const [id, a] of [...mem.awaitingFill]) {
    const sales = orders ? a.saleIds.map((sid) => orders.find((o) => o.clientOrderId === sid) ?? null) : [];
    const ended = sales.some((o) => o !== null && (o.status === "canceled" || o.status === "expired" || o.status === "rejected") && !(o.filledQty > 0));
    const filled = sales.length > 0 && sales.every((o) => o !== null && o.status === "filled");
    if (filled || (!activeIds.has(id) && !ended)) {
      mem.awaitingFill.delete(id);
      if (a.kind === "bare" && d.onRemainderSold) d.onRemainderSold(a.symbol, a.qty);
      // Group 1 review, round 1 (note 4): not waited for, so a slow Discord can never hold up the sync's safety sales after it.
      else void Promise.resolve(d.say("alerts", a.kind === "bare" ? `**${a.symbol}: the sale of the remaining ${plural(a.qty, "share")} has filled.**` : `**${a.symbol}: the sale of its ${plural(a.qty, "share")} has filled.**`)).catch(() => undefined);
      continue;
    }
    if (ended || now - a.since > AWAITING_FILL_MAX_MS) {
      mem.awaitingFill.delete(id);
      d.log?.("awaiting_fill_dropped", { symbol: a.symbol, clientOrderId: id, ended, ageMs: now - a.since });
    }
  }
}

// Part C: the one line when a position that was reported stuck resolves (no mention). Nothing is posted for an entry never reported.
// Michael's ruling B of 2026-11-12: a fresh stop still unclear 15 seconds after it was sent. The remainder is treated as unprotected:
// the stop is looked up by its client id and, if Alpaca has it open, cancelled through the cleanup sale (which waits for Alpaca's cancel
// before it sells, and never counts that stop as protection); the shares are then sold through the checked sell path (it never sells more
// than is held counting sells already open, so a stop Alpaca did take cannot be sold on top of). Michael gets an alert at once, and the
// stuck record (already "alerted") gives the one line when it resolves (sold, or gone).
async function freshStopTimeout(d: RiskDeps, day: DayRecord, mem: SyncMemory, s: OrderRecord, o: Order, f: FreshStop, nowMs: number): Promise<{ attempted: boolean; stuck: boolean; recheckAt?: number }> {
  mem.freshStops.delete(s.clientOrderId);
  mem.timedOutStops.set(f.stopClientOrderId, s.clientOrderId);
  let cancelId: string | null = f.orderId;
  let found: string = "lookup failed";
  try {
    const x = await d.broker.findOrderByClientId(f.stopClientOrderId);
    found = x ? x.status : "unknown_at_alpaca";
    if (x) cancelId = OPEN_STATUSES.has(x.status) ? x.id : null;
    else cancelId = null;
  } catch (err) {
    d.log?.("fresh_stop_lookup_failed", { symbol: f.symbol, error: (err as Error).message.slice(0, 120) });
    // The lookup by client id failed: Alpaca's open orders are a second way to find it (one more request, only here).
    try {
      const x = (await d.broker.listOrders("open")).find((y) => y.clientOrderId === f.stopClientOrderId);
      found = x ? x.status : "not in Alpaca's open orders";
      cancelId = x ? x.id : null;
    } catch {
      /* neither read answered: the sale below still cannot sell shares a working stop holds (sells.ts) */
    }
  }
  d.log?.("fresh_stop_timeout", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: f.stopClientOrderId, msFromSent: nowMs - f.placedAt, found, cancelling: cancelId !== null });
  // The stop filled after all: its shares are sold; the next sync closes the entry. Nothing to cancel or sell.
  if (found === "filled") return { attempted: false, stuck: false };
  const left = f.qty;
  const st = mem.stuck.get(s.clientOrderId) ?? { symbol: s.symbol, since: nowMs, nextAt: 0, delayMs: 0, alerted: false, escalated: false, lastTriedAt: nowMs, why: "" };
  if (!st.alerted) {
    st.alerted = true;
    st.why = "its fresh protective stop was not confirmed within 15 seconds";
    mem.stuck.set(s.clientOrderId, st);
    const what = cancelId ? "I am cancelling that stop and selling" : found === "lookup failed" ? "Alpaca could not be asked about that stop, so I am selling" : "Alpaca does not hold that stop open, so I am selling";
    await d.say("alerts", `**Michael: ${s.symbol}'s fresh protective stop for ${plural(left, "share")} was not confirmed within 15 seconds, so I treat ${left === 1 ? "it" : "them"} as unprotected.** ${what} ${left === 1 ? "it" : "them"} now, and will post again when ${left === 1 ? "it is" : "they are"} sold or gone.`, { mentionOwner: true });
  }
  return cleanupSale(d, day, mem, s, o, "missing", undefined, cancelId ? { alsoCancel: [cancelId], alsoCancelStops: [f.stopClientOrderId], alsoCancelBy: "15 second limit" } : {});
}

async function resolveStuck(d: RiskDeps, mem: SyncMemory, clientOrderId: string, how: string): Promise<boolean> {
  const st = mem.stuck.get(clientOrderId);
  mem.stuck.delete(clientOrderId);
  if (!st?.alerted) return false;
  await d.say("alerts", `${st.symbol}: ${how} (${minutesText(d.now().getTime() - st.since)} after I reported it without a protective stop).`);
  return true;
}

// Release 1 of 2026-11-09 (Michael's approval of parts A, B and C, builds/c2-proposal-2026-11-09.md): the cleanup sale of ONE entry
// whose exits are gone ("missing") or whose stop is gone with shares left ("bare").
// - Part B, step 1 (and part A, step 2): the entry is looked up again by its client id right before acting (one request), since the
//   sync's own list can be a minute old. If its exits have sold every share, or (for "missing") it has a live exit after all, or (for
//   "bare") its stop is live, nothing is cancelled or sold.
// - Part B, steps 2 to 4: only that entry's own live exits are cancelled (by id, which also reaches exits Alpaca's open list does not
//   show), and at most that entry's own shares are sold, so a newer position on the same symbol keeps its exits and its shares.
// - Part A, step 1: a round that finds the shares held with no open order visible ends the attempt; it is retried after 5, 10, 20, then
//   every 30 seconds.
// - Part C and part A, step 4: one alert when first stuck, one after 5 minutes stuck, one line when it resolves.
// A4: `extra.stopPrice` (a "bare" remainder): a fresh stop at that price instead of the market sale (sells.ts protectWithStop).
// A5: `extra.fast` (a "missing" entry that filled as the stack's 5 second cancel reached Alpaca): sold at once, without waiting for
// Alpaca's cancel of its exits to show; the sale waits in sells.ts until that cancel frees the share, and nothing happens if Alpaca kept them.
async function cleanupSale(d: RiskDeps, day: DayRecord, mem: SyncMemory, s: OrderRecord, listedCopy: Order, kind: "missing" | "bare", onSellSent?: (x: { symbol: string; qty: number; clientOrderId: string; atMs: number }) => void, extra: { stopPrice?: number | null; stopCancelledAt?: string | null; fast?: { fillAtMs: number }; alsoCancel?: string[]; alsoCancelStops?: string[]; alsoCancelBy?: string } = {}): Promise<{ attempted: boolean; stuck: boolean; recheckAt?: number }> {
  let o = listedCopy;
  // Group 1, round 5: a live update during this try that the entry's timed-out stop ended overrides any backoff this try would set.
  const tryStartMs = d.now().getTime();
  const stopEndedDuringTry = (): boolean => [...mem.timedOutStops].some(([stop, entry]) => entry === s.clientOrderId && (mem.timedOutEndedAt.get(stop) ?? -1) >= tryStartMs);
  const dueNow = (now: number): { attempted: true; stuck: true; recheckAt: number } => {
    const st = mem.stuck.get(s.clientOrderId);
    if (st) {
      st.nextAt = 0;
      delete st.restingStop;
    }
    return { attempted: true, stuck: true, recheckAt: now };
  };
  // A5: the fast sale has just looked the entry up itself, so it is not looked up a second time here.
  if (!extra.fast) try {
    const fresh = await d.broker.findOrderByClientId(s.clientOrderId);
    if (fresh) o = fresh;
    else d.log?.("cleanup_lookup_empty", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind });
  } catch (err) {
    d.log?.("cleanup_lookup_failed", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, error: (err as Error).message.slice(0, 120) });
  }
  const ownShares = o.filledQty - exitFilledQty(o);
  // A5: at the moment the entry's fill arrives, Alpaca has not cancelled its exits yet, so they still look live: the sale goes ahead and
  // waits for that cancel in sells.ts (if Alpaca keeps the exits, nothing is sold).
  const stillNeeded = extra.fast ? true : kind === "missing" ? !hasLiveExit(o) : bareRemainder(o) !== null;
  if (!(ownShares > EPS_QTY) || !stillNeeded) {
    d.log?.("cleanup_skipped", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, ownShares, liveExit: hasLiveExit(o) });
    await resolveStuck(d, mem, s.clientOrderId, ownShares > EPS_QTY ? "it has a live exit again" : "its own exit orders sold the shares");
    return { attempted: false, stuck: false };
  }
  // A5: nothing is cancelled by the fast sale (the exits are Alpaca's to cancel, or to keep).
  // Ruling B of 2026-11-12: `alsoCancel`, a fresh stop that was not confirmed in time (cancelled here, and never counted as protection).
  const cancelIds = extra.fast ? [] : [...flattenLegs(o).filter((l) => l.side === "sell" && OPEN_STATUSES.has(l.status)).map((l) => l.id), ...(extra.alsoCancel ?? [])];
  const reason = kind === "missing" ? "no live protective stop" : "stop cancelled after a partial take-profit";
  // Fix C of 2026-11-10: the client ids of this entry's sales, for the closing line when a sale is not seen filled yet.
  const saleIds: string[] = [];
  let firstSaleAt: number | null = null;
  const sent = (x: { symbol: string; qty: number; clientOrderId: string; atMs: number }) => {
    if (x.symbol === s.symbol) {
      saleIds.push(x.clientOrderId);
      firstSaleAt ??= x.atMs;
    }
    onSellSent?.(x);
  };
  const protectAt = kind === "bare" && extra.stopPrice != null && extra.stopPrice > 0 ? extra.stopPrice : null;
  const r = await d.liquidator.flatten({
    reason,
    tradeDate: day.tradeDate,
    only: [s.symbol],
    maxRounds: extra.fast ? 1 : 3,
    cancelIds,
    yieldToPriority: true,
    ownEntryOnly: { maxQty: { [s.symbol]: ownShares } },
    endWhenHiddenHold: !extra.fast,
    onSellSent: sent,
    ...(protectAt !== null ? { protectWithStop: { [s.symbol]: protectAt } } : {}),
    ...((extra.alsoCancel?.length ?? 0) > 0 ? { endOnCancelFail: true } : {}),
    ...(extra.fast ? { waitForAlpacaCancel: true, waitCancelMs: FAST_LOST_EXIT_WAIT_MS } : {}),
  });
  const soldQty = r.sold.filter((x) => x.symbol === s.symbol).reduce((n, x) => n + x.qty, 0);
  const now = d.now().getTime();
  // Ruling B, group 2 round 3 (logging only): the outcome of the cancel of a timed-out fresh stop, logged after the sale tried it
  // (`cancelFailed`: a cancel this sale sent was not accepted, by Alpaca's answer or for lack of one).
  // Group 2, round 4: by what the sale really did with each such cancel (sent and answered, sent and not accepted, or never sent, for
  // example when the sale gave way to the loss stop's sale or the market was closed). Only a cancel Alpaca answered is remembered as
  // accepted (`timedOutCancelAccepted`, which spaces later cancels of that stop).
  const timedOutCancel = (extra.alsoCancel?.length ?? 0) > 0;
  const cancelOutcome = new Map<string, "accepted" | "refused" | "not sent">();
  if (timedOutCancel) {
    (extra.alsoCancel ?? []).forEach((orderId, i) => {
      const stopClientOrderId = extra.alsoCancelStops?.[i];
      if (!stopClientOrderId) return;
      const tried = r.cancelsTried?.includes(orderId) === true;
      const accepted = r.cancelsAccepted?.includes(orderId) === true;
      const outcome = accepted ? "accepted" : tried ? "refused" : "not sent";
      cancelOutcome.set(stopClientOrderId, outcome);
      const event = outcome === "accepted" ? "fresh_stop_timeout_cancel" : outcome === "refused" ? "fresh_stop_timeout_cancel_failed" : "fresh_stop_timeout_cancel_not_sent";
      d.log?.(event, { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId, by: extra.alsoCancelBy ?? "missing-exit sale", again: mem.timedOutCancelAccepted.has(stopClientOrderId), ...(outcome === "refused" ? { error: (r.errors.find((e) => e.includes("cancel failed")) ?? "").slice(0, 120) } : {}) });
      if (accepted) mem.timedOutCancelAccepted.add(stopClientOrderId);
    });
  }
  // Messaging only: what the last try saw of a timed-out stop the sync's list does not show is set again below (the hidden route); a stop
  // the list shows is read from the list by the 5 minute alert itself.
  // Group 2, round 5: only a try that read the account clears it (not one that gave way to the loss stop's sale, found the market closed,
  // or could not read positions).
  const stuckBefore = mem.stuck.get(s.clientOrderId);
  // Group 2, round 6: and only when that try's last look read both the open orders and the positions (`lastLookOk`); a look that failed
  // never saw the stop, so it cannot say the stop is gone.
  if (stuckBefore && !r.yielded && r.lastLookOk === true) delete stuckBefore.restingStop;
  // A4: the remainder now has a fresh stop. Nothing is sold; the entry stays open until the stop fills or the close-out sells it.
  if (r.freshStop && r.freshStop.symbol === s.symbol) {
    const f = r.freshStop;
    mem.freshStops.set(s.clientOrderId, { symbol: s.symbol, entryClientOrderId: s.clientOrderId, stopClientOrderId: f.clientOrderId, orderId: f.orderId, qty: f.qty, stopPrice: f.stopPrice, placedAt: f.sentAtMs, status: "accepted", lookedAt: now });
    const cancelled = extra.stopCancelledAt ? Date.parse(extra.stopCancelledAt) : NaN;
    // Ruling B: its time to confirm is Alpaca's answer to the order itself (`msToConfirm`).
    d.log?.("fresh_stop", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: f.clientOrderId, qty: f.qty, stopPrice: f.stopPrice, msFromStopCancel: Number.isFinite(cancelled) ? now - cancelled : null, msToConfirm: f.answerMs, confirmedBy: "answer" });
    try {
      d.onFreshStop?.({ symbol: s.symbol, shares: f.qty });
    } catch {
      /* a count must never break the sync */
    }
    await resolveStuck(d, mem, s.clientOrderId, "it has a fresh protective stop");
    return { attempted: true, stuck: false };
  }
  if (r.freshStopUnclear && r.freshStopUnclear.symbol === s.symbol) {
    const f = r.freshStopUnclear;
    // Ruling B: timed from its sending; looked up at the next sync, 2 seconds on, then every 5 seconds while still unclear. The entry
    // itself is looked up at each of those syncs too (group 1, round 1 of the night release): one older than the sync's 10 minute list
    // would otherwise be skipped by the walk and its limit would come late.
    if (FRESH_STOP_LIMIT.on) mem.mustLook.add(s.clientOrderId);
    mem.freshStops.set(s.clientOrderId, { symbol: s.symbol, entryClientOrderId: s.clientOrderId, stopClientOrderId: f.clientOrderId, orderId: null, qty: f.qty, stopPrice: f.stopPrice, placedAt: f.sentAtMs, status: "unclear", lookedAt: 0 });
    return { attempted: true, stuck: false, recheckAt: now + 2_000 };
  }
  // Group 2 round 4 and the group 1 note with it (Michael's decision 1 of 2026-11-13): at the sale's last look, the entry's timed-out
  // stop was still open and holding the shares, either named by this sale to cancel (the sync's list showed it) or pending cancel (the
  // sync's list may not show it). Nothing was sold. Its cancel has not cleared: the stuck backoff, charged to the retry allowance, never
  // the next sync (before, a stop pending cancel that the sync's list did not show was retried at every sync). The 5 minute alert says the
  // stop rests at Alpaca. A live update that the stop ended still runs the sale at once.
  const stillOpen = soldQty === 0 ? r.freshStopStillOpen?.find((x) => x.symbol === s.symbol && mem.timedOutStops.get(x.clientOrderId) === s.clientOrderId) : undefined;
  if (stillOpen) {
    if (stopEndedDuringTry()) return dueNow(now);
    const outcome = cancelOutcome.get(stillOpen.clientOrderId);
    const cancel = stillOpen.status === "pending_cancel" ? "pending" : outcome === "accepted" || (outcome === undefined && mem.timedOutCancelAccepted.has(stillOpen.clientOrderId)) ? "accepted" : outcome === "refused" ? "refused" : "not sent";
    const st = backoffStuck(mem, s.symbol, s.clientOrderId, now, "the cancel of the unconfirmed fresh stop has not cleared at Alpaca");
    st.restingStop = { stopClientOrderId: stillOpen.clientOrderId, cancel };
    d.log?.("fresh_stop_timeout_still_open", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: stillOpen.clientOrderId, status: stillOpen.status, retryInMs: st.nextAt - now });
    return { attempted: true, stuck: true, recheckAt: st.nextAt };
  }
  const heldBy = r.heldByFreshStop?.find((x) => x.symbol === s.symbol);
  if (heldBy && soldQty === 0 && mem.timedOutStops.has(heldBy.clientOrderId)) {
    // Ruling B of 2026-11-12: a fresh stop that was not confirmed in time is never taken as protection again: cancelled now.
    // Group 1, round 3 of the night release (Michael's decision 1 of 2026-11-13, and his rule that every retry loop has a limit and a
    // backoff): only the FIRST accepted cancel of a stop gets a look in a second, charged to the retry allowance (Alpaca's cancel then
    // shows, and the sale waits for it if still pending). If the stop still holds the shares after a cancel Alpaca accepted, or Alpaca refused the cancel, the entry goes on
    // the stuck backoff (5, 10, 20, then every 30 seconds), each retry charged to the retry allowance (40 requests a minute, 15 in 5
    // seconds). A live update that the stop ended still runs the sale at once (worker.ts, onFreshStopUpdate).
    if (stopEndedDuringTry()) return dueNow(now);
    const acceptedBefore = mem.timedOutCancelAccepted.has(heldBy.clientOrderId);
    d.log?.("fresh_stop_timeout_still_open", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: heldBy.clientOrderId, status: heldBy.status, by: "sale" });
    try {
      await d.broker.cancelOrder(heldBy.orderId);
      d.log?.("fresh_stop_timeout_cancel", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: heldBy.clientOrderId, by: "sale", again: acceptedBefore });
      mem.timedOutCancelAccepted.add(heldBy.clientOrderId);
      if (stopEndedDuringTry()) return dueNow(d.now().getTime());
      const stNow = mem.stuck.get(s.clientOrderId);
      if (!acceptedBefore) {
        // The look a second later is a retry like the others: due then, and charged to the retry allowance when it runs (retryDue), so
        // several such stops at once take turns instead of bursting.
        if (stNow) {
          stNow.restingStop = { stopClientOrderId: heldBy.clientOrderId, cancel: "accepted" };
          stNow.lastTriedAt = now;
          stNow.nextAt = now + 1_000;
        }
        return { attempted: true, stuck: false, recheckAt: now + 1_000 };
      }
      const st = backoffStuck(mem, s.symbol, s.clientOrderId, now, "Alpaca accepted the cancel of the unconfirmed fresh stop but still shows it working");
      st.restingStop = { stopClientOrderId: heldBy.clientOrderId, cancel: "accepted" };
      return { attempted: true, stuck: true, recheckAt: st.nextAt };
    } catch (err) {
      d.log?.("fresh_stop_timeout_cancel_failed", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: heldBy.clientOrderId, by: "sale", again: acceptedBefore, error: (err as Error).message.slice(0, 120) });
      if (stopEndedDuringTry()) return dueNow(d.now().getTime());
      // Group 1, round 2 of the night release: refused or unanswered: tried again on the stuck backoff (5, 10, 20, then every 30 seconds)
      // within the retry allowance, never every second.
      const st = backoffStuck(mem, s.symbol, s.clientOrderId, now, "Alpaca did not accept the cancel of the unconfirmed fresh stop");
      st.restingStop = { stopClientOrderId: heldBy.clientOrderId, cancel: "refused" };
      return { attempted: true, stuck: true, recheckAt: st.nextAt };
    }
  }
  if (heldBy && soldQty === 0) {
    // A4 (group 1 review, round 1): a resting fresh stop of ours protects the shares: remember it, say nothing, not stuck.
    mem.freshStops.set(s.clientOrderId, { symbol: s.symbol, entryClientOrderId: s.clientOrderId, stopClientOrderId: heldBy.clientOrderId, orderId: heldBy.orderId, qty: heldBy.qty, stopPrice: heldBy.stopPrice ?? 0, placedAt: now, status: heldBy.status, lookedAt: now });
    d.log?.("fresh_stop_recovered", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: heldBy.clientOrderId, by: "sale" });
    await resolveStuck(d, mem, s.clientOrderId, "it has a fresh protective stop");
    return { attempted: false, stuck: false };
  }
  if (soldQty === 0 && r.coveredByOwnSale?.includes(s.symbol)) {
    // A5 (group 1 review, rounds 1 and 2): another sale of ours (the fast sale, or the order sync's own) already covers the entry's
    // shares: nothing to do here, and not stuck. That sale says what happened.
    d.log?.(extra.fast ? "lost_exit_fast_skipped" : "cleanup_covered_by_own_sale", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, reason: "a sale of ours already covers it" });
    return { attempted: false, stuck: false };
  }
  if (extra.fast && soldQty === 0 && r.exitsKept?.includes(s.symbol)) {
    d.log?.("lost_exit_fast_skipped", { symbol: s.symbol, clientOrderId: s.clientOrderId, reason: "Alpaca kept the exits" });
    return { attempted: false, stuck: false };
  }
  if (extra.fast && firstSaleAt !== null) d.log?.("lost_exit_fast", { symbol: s.symbol, clientOrderId: s.clientOrderId, msFromFill: firstSaleAt - extra.fast.fillAtMs });
  if (r.yielded && soldQty === 0) {
    d.log?.(kind === "missing" ? "unprotected_position_yielded" : "bare_remainder_yielded", { symbol: s.symbol });
    return { attempted: true, stuck: false };
  }
  const before = r.heldBefore?.[s.symbol];
  const after = r.heldAfter?.[s.symbol] ?? 0;
  // Fix A (Michael's approval of 2026-11-10): every one of the entry's shares has left the holding (its take-profit filled the rest while
  // its cancel landed, and our sale, if any, filled): sold, not stuck.
  const gone = r.ownGone?.includes(s.symbol) === true;
  if (soldQty === 0 && gone) {
    d.log?.("remainder_recount", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, counted: ownShares, recounted: 0, sold: 0 });
    await resolveStuck(d, mem, s.clientOrderId, "its own exit orders sold the shares");
    return { attempted: true, stuck: false };
  }
  // Fix A: what was still the entry's to sell when its sale was sent (its exits may have taken some while their cancel landed).
  let target = r.ownTarget?.[s.symbol] ?? ownShares;
  let soldWhole = (x: number) => (before === undefined ? r.flat || !r.remaining.includes(s.symbol) : gone || after <= before - x + EPS_QTY);
  let soldMeasure = ownShares;
  if (soldQty > 0 && soldQty < target - EPS_QTY) {
    // Fix A, the narrow case: the take-profit filled more before the sale's first look at the holding, so the recount could not see it.
    // One more look at the entry (one request, only here) says what was still its own.
    try {
      const again = await d.broker.findOrderByClientId(s.clientOrderId);
      const ownNow = again ? again.filledQty - exitFilledQty(again) : null;
      if (ownNow !== null && soldQty >= ownNow - EPS_QTY) {
        target = ownNow;
        soldMeasure = soldQty; // the holding at the sale's first look already lacked what the take-profit took
        soldWhole = (x: number) => (before === undefined ? r.flat || !r.remaining.includes(s.symbol) : after <= before - x + EPS_QTY);
      }
    } catch (err) {
      d.log?.("cleanup_lookup_failed", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, error: (err as Error).message.slice(0, 120) });
    }
  }
  if (soldQty > 0 && soldQty >= target - EPS_QTY) {
    if (target < ownShares - EPS_QTY) d.log?.("remainder_recount", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, counted: ownShares, recounted: target, sold: soldQty });
    // Its own shares are gone if the symbol's holding fell by at least that much (a newer position may still be held).
    const filled = soldWhole(soldMeasure);
    if (filled) {
      if (!(await resolveStuck(d, mem, s.clientOrderId, "sold"))) {
        if (kind === "missing") await d.say("alerts", `**${s.symbol} had no live protective stop, so I sold it.**`);
        // Messaging only (speed release, decision 6): the worker gathers these into one alert a minute; without it, posted at once.
        else if (d.onRemainderSold) d.onRemainderSold(s.symbol, soldQty);
        else await d.say("alerts", `**${s.symbol}: Alpaca cancelled its stop when the take-profit partly filled, so I sold the remaining ${soldQty} shares.**`);
      }
      return { attempted: true, stuck: false };
    }
    // The sell went out and Alpaca has not filled it yet (paper has held sells 16 seconds before submitting them): not a failure.
    if (!mem.stuck.get(s.clientOrderId)?.alerted) {
      const what = kind === "missing" ? `**${s.symbol} had no live protective stop.** I sent a sell for its ${plural(soldQty, "share")}` : `**${s.symbol}: Alpaca cancelled its stop when the take-profit partly filled.** I sent a sell for the remaining ${plural(soldQty, "share")}`;
      await d.say("alerts", `${what}; Alpaca has not filled it yet. I will say when it has.`);
      // Fix C: its closing line comes from the order sync when the sale is seen filled.
      mem.awaitingFill.set(s.clientOrderId, { symbol: s.symbol, qty: soldQty, kind, saleIds: [...saleIds], since: now });
    }
    return { attempted: true, stuck: false };
  }
  if ((r.flat || gone) && soldQty === 0) {
    d.log?.(kind === "missing" ? "unprotected_position_already_gone" : "bare_remainder_already_gone", { symbol: s.symbol });
    await resolveStuck(d, mem, s.clientOrderId, "no longer held");
    return { attempted: true, stuck: false };
  }
  // Stuck: its shares are still held and not all of them could be sold.
  const st = mem.stuck.get(s.clientOrderId) ?? { symbol: s.symbol, since: now, nextAt: 0, delayMs: 0, alerted: false, escalated: false, lastTriedAt: now, why: "" };
  st.lastTriedAt = now;
  const hidden = r.hiddenHold?.includes(s.symbol) === true;
  // Ruling B: a sale that had to cancel a timed-out fresh stop and is still stuck goes on the same backoff and allowance as a hidden hold,
  // whether Alpaca refused that cancel (group 1, round 2 of the night release) or accepted it and the stop still holds the shares (group 1,
  // round 3, Michael's decision 1 of 2026-11-13: before, the second case was tried again at every sync, about 165 requests a minute for
  // one stop whose cancel stayed pending). A live update that the stop ended still runs the sale at once.
  // Group 1, round 4: and whenever this entry has a timed-out stop at all (whatever state Alpaca shows it in), so no try of ruling B's
  // ever falls back to the retry at every sync.
  const hasTimedOutStop = [...mem.timedOutStops.values()].includes(s.clientOrderId);
  const endedNow = hasTimedOutStop && stopEndedDuringTry();
  if (endedNow) {
    // Group 1, round 5: the live update said the timed-out stop ended during this try: due again at once, not on the backoff.
    st.nextAt = 0;
    delete st.restingStop;
  } else if (hidden || timedOutCancel || hasTimedOutStop) {
    st.delayMs = st.delayMs > 0 ? Math.min(st.delayMs * 2, STUCK_RETRY_MAX_MS) : STUCK_RETRY_FIRST_MS;
    st.nextAt = now + st.delayMs;
  } else {
    // Held by open orders that are visible (a cancel still landing): tried again at the next sync, as before.
    st.delayMs = 0;
    st.nextAt = 0;
  }
  mem.stuck.set(s.clientOrderId, st);
  // Messaging only (group 2, round 4): the sale ended at once because Alpaca did not accept the cancel of the timed-out stop, which the
  // sync's list showed open at the start of this try.
  const refusedStop = [...cancelOutcome].find(([, v]) => v === "refused")?.[0];
  if (refusedStop && !endedNow) st.restingStop = { stopClientOrderId: refusedStop, cancel: "refused" };
  const left = Math.max(0, target - soldQty) || ownShares - soldQty;
  const why = hidden ? "Alpaca reports the shares as not free to sell, and no open order explains it" : (r.errors.at(-1) ?? "still held").slice(0, 120);
  st.why = why;
  // Messaging only: a remainder the stack is trying to give a fresh stop (A4) is waiting to be protected, not only to be sold.
  const protecting = kind === "bare" && protectAt !== null;
  st.protecting = protecting;
  const how = kind === "missing" ? "its exits are gone" : "Alpaca cancelled the stop when the take-profit partly filled";
  if (!st.alerted) {
    st.alerted = true;
    // Group 2 review, round 1: since when. The latest cancel or expiry among the entry's own exits (as Alpaca reports it), else now.
    const endedAt = flattenLegs(o).filter((l) => l.side === "sell" && !OPEN_STATUSES.has(l.status)).map((l) => Date.parse(l.canceledAt ?? l.updatedAt ?? "")).filter((t) => Number.isFinite(t) && t <= now);
    const lostAt = new Date(endedAt.length > 0 ? Math.max(...endedAt) : now);
    const it = left === 1 ? "it" : "them";
    const tail = protecting ? `I keep trying and will post again when ${left === 1 ? "it has" : "they have"} a stop, ${left === 1 ? "is" : "are"} sold, or ${left === 1 ? "is" : "are"} gone.` : `I keep trying and will post again when ${left === 1 ? "it is" : "they are"} sold or gone.`;
    await d.say("alerts", `**Michael: ${s.symbol} has ${plural(left, "share")} with no protective stop since ${centralClock(lostAt)}, and I could not ${protecting ? "protect or sell" : "sell"} ${it} yet** (${how}; ${why}). ${tail}`, { mentionOwner: true });
    // Group 2, round 6 (messaging only): not after a try whose last look failed (it has no view of the stop); the next sync's own
    // escalation, which has the order list, decides then.
  } else if (r.lastLookOk === true) await escalateIfDue(d, mem, s.clientOrderId, r.heldAfter?.[s.symbol]); // messaging only: the holding this sale last saw, read only
  return { attempted: true, stuck: true, ...(st.nextAt > 0 ? { recheckAt: st.nextAt } : endedNow ? { recheckAt: now } : {}) };
}

// What the loss stop remembers in this process (the worker keeps one). It lets the loss stop keep selling when the stop flag
// cannot be read: without it, a database that keeps failing would make every pass fire the stop again from scratch.
export class LossStopMemory {
  firedDate: string | null = null;
  lastSaveAlert = 0;
  // The retry of a failed loss stop sale (Michael's ruling, 2026-11-03): its request budget, and the pause after a rate-limit answer.
  readonly budget = new LossStopBudget();
  backoffMs = 0;
  backoffUntil = 0;
  turn = 0; // where the next retry starts in the list of unsold symbols, so with a tight budget every symbol gets its turn
  lastRetryAlert = 0;
  awaitingFlat = false; // the first sale ended with shares still held: say so once the account is flat
}

// THE LOSS STOP'S REQUEST BUDGET: at most 60 of Alpaca's 200 requests in any minute for the loss stop's own work after a start
// (its equity check every 5 seconds, 12 a minute) and the retries of a failed sale (reads, sells, cancels), on top of which the
// retry never spends below the governor's safety reserve. Why 60: after the stop fires nothing enters, and the worker's other
// standing work (the account view every 5 seconds, settings, the order sync and the sweep) is about 35 a minute, so 60 leaves
// about 105 a minute for the close-out, Michael's flatten and stop, cancels and protective sells, more than a 40 position
// close-out asks for in its first minute (about 1 bulk cancel, 10 to 15 reads and 40 sells). The first sale when the stop fires
// is not held back (it is the stop's whole job): it is ONE round of the liquidator (cancel the exits, wait, sell each symbol),
// a bounded burst, and what Alpaca counted for it is charged to this budget afterwards, so the retries wait until it has room.
export const LOSS_STOP_REQUESTS_PER_MINUTE = 60;
export class LossStopBudget {
  private times: number[] = [];
  private readonly perMinute: number;
  constructor(perMinute = LOSS_STOP_REQUESTS_PER_MINUTE) {
    this.perMinute = perMinute;
  }
  used(nowMs: number): number {
    this.times = this.times.filter((t) => nowMs - t < 60_000);
    return this.times.length;
  }
  room(nowMs: number): number {
    return this.perMinute - this.used(nowMs);
  }
  spend(nowMs: number, n = 1): void {
    for (let i = 0; i < n; i++) this.times.push(nowMs);
  }
}
// At most this many requests in one retry check, so the minute's budget is spread over the checks instead of spent in one burst.
export const LOSS_STOP_RETRY_PER_CHECK = 15;
// From this long before the close the retry is quiet: the close-out (5 minutes before the close) sells everything still held, and
// the minute before it is left to it, so the close-out never starts on a request bucket the retry has just used.
const RETRY_QUIET_BEFORE_CLOSE_MS = 6 * 60_000;
const RETRY_BACKOFF_FIRST_MS = 10_000;
const RETRY_BACKOFF_MAX_MS = 60_000;
const is429 = (err: unknown) => err instanceof AlpacaError && err.status === 429;

export interface LossStopOptions {
  // First check after a start: also look at today's equity history at Alpaca, so a loss stop that fired (or should have) before
  // a restart is found again even if equity has since recovered and the stop flag never reached the database (round 5).
  rederive?: boolean;
}

// The lowest equity Alpaca shows for today's session after a moment (the open, or the last saved change to the stop flag,
// whichever is later, so Michael's own `resume` is respected). Null when there is no point after that moment.
export async function worstEquitySince(d: Pick<RiskDeps, "broker">, sinceMs: number): Promise<number | null> {
  const points = (await d.broker.getEquityHistoryToday()).filter((p) => p.atMs > sinceMs);
  return points.length ? Math.min(...points.map((p) => p.equity)) : null;
}

// When equity has fallen by the approved daily loss limit, stop the day: set the stop flag, sell everything.
// Runs again and again without harm (once the flag is set it does nothing new).
//
// Review round 5: the sale waits on nothing but the broker. The stop-flag write, the run-log event and every Discord post are
// started and left to finish on their own (each with its own error handling), so a database or Discord that hangs cannot hold
// the sale back, and cannot leave this task stuck so that it never runs again. The order gate still refuses entries from the
// moment the stop is decided: the caching store (caching-store.ts) believes a stop as soon as `setControl` is called, before
// its first wait, and keeps believing it until a later write succeeds. If the stop flag cannot be READ, equity is checked
// anyway and the stop fires if the line is crossed (the direction of selling).
export async function enforceDailyLoss(d: RiskDeps, day: DayRecord, opts: LossStopOptions = {}): Promise<boolean> {
  // Not before arming: until then the starting equity may be an earlier day's number.
  // (A day that is re-arming after a lowered cap counts as armed: its start equity was read at the first arming, and the loss stop
  // must not go dark while a re-arm is failing.)
  if (day.status !== "approved" || !(day.phases.armed || day.phases.rearm) || day.dayStartEquity === null) return false;
  const mem = d.lossMemory;
  let flag: StopFlag | null = null;
  let flagUnreadable = false;
  try {
    flag = await d.store.getControl<StopFlag>(CONTROL_STOP);
  } catch (err) {
    flagUnreadable = true;
    d.log?.("loss_stop_flag_unreadable", { error: (err as Error).message.slice(0, 120) });
  }
  const firedHere = mem?.firedDate === day.tradeDate;
  if (flag?.on || (flagUnreadable && firedHere)) {
    // The loss stop already fired. If its sale did not finish, try again on every pass. An owner's plain `stop` is
    // left alone: it keeps positions.
    if ((flag?.on && flag.reason.startsWith("daily loss stop")) || (flagUnreadable && firedHere)) await retryLossStopSale(d, day);
    return false;
  }
  mem?.budget.spend(d.now().getTime(), 1); // the equity check is never held back; it is counted
  const account = await d.broker.getAccount();
  try {
    d.onAccountRead?.(account);
  } catch {
    /* shadow logging must never break the loss stop */
  }
  const start = day.dayStartEquity;
  const limit = day.limits.dailyLossStopUsd;
  let loss = start - account.equity;
  let earlier: number | null = null;
  if (loss < limit && opts.rederive && day.openAt) {
    const savedAt = flag?.at ? Date.parse(flag.at) : NaN;
    const since = Math.max(day.openAt.getTime(), Number.isFinite(savedAt) ? savedAt : 0);
    const worst = await worstEquitySince(d, since);
    if (worst !== null && start - worst >= limit) {
      earlier = worst;
      loss = start - worst;
    }
  }
  if (loss < limit) return false;
  if (mem) mem.firedDate = day.tradeDate;
  const why = earlier !== null ? `daily loss stop reached earlier today (equity fell to ${earlier.toFixed(2)}, found after a restart)` : `daily loss stop reached (${loss.toFixed(2)} dollars)`;
  const flagNow: StopFlag = { on: true, at: d.now().toISOString(), reason: why };
  // Not waited on (see above). The caching store already believes the stop when this call returns.
  void d.store.setControl(CONTROL_STOP, flagNow).catch((err) => {
    const t = d.now().getTime();
    if (mem && t - mem.lastSaveAlert < 5 * 60_000) return;
    if (mem) mem.lastSaveAlert = t;
    void d.say("alerts", `**Michael: the daily loss stop was reached but the stop flag could not be saved** (${(err as Error).message.slice(0, 80)}). I sold anyway, I keep the stop in force in memory, and I keep trying to save it.`, { mentionOwner: true }).catch(() => undefined);
  });
  void d.store.addEvent("warn", "daily_loss_stop", { loss, earlier }).catch(() => undefined);
  // One round (round 8): with sells refused, the liquidator's later rounds would send every refused sell again, with fresh reads
  // each time (about 500 requests for 40 positions, more than Alpaca allows in a minute). What is still unsold after this round
  // is retried by retryLossStopSale on the next checks, every 5 seconds, inside the budget.
  const before = d.governor?.stats?.().requestsLastMinute;
  const r = await d.liquidator.flatten({ reason: "daily loss stop", tradeDate: day.tradeDate, maxRounds: 1, priority: true });
  if (mem && before !== undefined) mem.budget.spend(d.now().getTime(), Math.max(0, (d.governor!.stats!().requestsLastMinute ?? 0) - before));
  // Sells that went out but have not filled yet are not failures; only symbols with no sell sent are.
  const unsold = r.remaining.filter((sym) => !r.sold.some((x) => x.symbol === sym));
  if (mem && !r.flat) mem.awaitingFlat = true;
  const outcome = r.flat ? (r.sold.length > 0 ? "sold everything" : "nothing was held, so nothing needed selling") : unsold.length === 0 ? "sent a sell for every position (I will say when the account is flat)" : `sent sells, but could not sell ${unsold.join(", ")} yet (I retry only those, every 5 seconds)`;
  void d.say("commands", `**Daily loss stop reached** (down ${loss.toFixed(2)} of the ${limit} dollar limit${earlier !== null ? ", seen in today's equity history after a restart" : ""}). Stopped for the day and ${outcome}.`).catch(() => undefined);
  if (unsold.length > 0) void d.say("alerts", `**Michael: daily loss stop reached but I could not sell ${unsold.join(", ")} yet.** Check Alpaca now. I retry every 5 seconds.`, { mentionOwner: true }).catch(() => undefined);
  return true;
}

// Sells what the loss stop failed to sell (Michael's ruling, 2026-11-03): on every loss stop check (every 5 seconds), only the
// symbols still held, each with one sell through the sell gate, never another whole-account liquidation. Inside the loss stop's
// request budget and never below the governor's safety reserve, so it cannot crowd out the close-out, a flatten, a stop or a
// protective sell; it stands aside completely while any liquidation (close-out, flatten, carried position, the first sale) runs.
// It pauses only after a rate-limit answer from Alpaca (10 seconds, doubling to 60); any other refusal is simply tried again on
// the next check. Shares still held by an exit resting at Alpaca (an entry that filled late) have that exit cancelled first; the
// sale follows on the next check. A sell of ours that is still working is left alone.
async function retryLossStopSale(d: RiskDeps, day: DayRecord): Promise<void> {
  const mem = d.lossMemory ?? fallbackMemory;
  const nowMs = d.now().getTime();
  if (d.liquidator.isLiquidating()) return;
  if (nowMs < mem.backoffUntil) return;
  if (day.closeAt && nowMs >= day.closeAt.getTime() - RETRY_QUIET_BEFORE_CLOSE_MS) return;
  let spentHere = 0;
  const canSpend = (n: number) => spentHere + n <= LOSS_STOP_RETRY_PER_CHECK && mem.budget.room(nowMs) >= n && (!d.governor || d.governor.budget() - n >= (d.governor.reserve?.() ?? SAFETY_RESERVE));
  const spend = (n: number) => {
    spentHere += n;
    mem.budget.spend(nowMs, n);
  };
  const rateLimited = () => {
    mem.backoffMs = Math.min(RETRY_BACKOFF_MAX_MS, mem.backoffMs > 0 ? mem.backoffMs * 2 : RETRY_BACKOFF_FIRST_MS);
    mem.backoffUntil = d.now().getTime() + mem.backoffMs;
    d.log?.("loss_stop_retry_backoff", { ms: mem.backoffMs });
  };
  // The cheap look first (1 request): flat means nothing to do, which is every check of a normal afternoon after the stop.
  if (!canSpend(1)) return;
  spend(1);
  let held;
  try {
    held = await d.broker.listPositions();
  } catch (err) {
    if (is429(err)) return rateLimited();
    throw err;
  }
  if (held.length === 0) {
    mem.backoffMs = 0;
    if (mem.awaitingFlat) {
      mem.awaitingFlat = false;
      void d.say("commands", "Daily loss stop: everything is sold, the account is flat.").catch(() => undefined);
    }
    return;
  }
  const gate = d.liquidator.sellGate;
  if (!canSpend(2)) return;
  spend(2);
  let view;
  try {
    gate.invalidate();
    view = await gate.look(); // open orders, then positions, as the gate checks sells against them
  } catch (err) {
    if (is429(err)) return rateLimited();
    throw err;
  }
  // A sale already working: any open market sell (ours, or one placed by hand at Alpaca) is left alone, never cancelled; only the
  // shares no sell covers are sold again.
  const ours = (o: Order) => o.side === "sell" && (o.type === "market" || o.clientOrderId.startsWith("cyrus-x-"));
  const others = view.open.filter((o) => !ours(o));
  const mine = view.open.filter(ours);
  const n = view.positions.length;
  const first = n > 0 ? mem.turn % n : 0;
  const ordered = [...view.positions.slice(first), ...view.positions.slice(0, first)];
  let sent = 0;
  let hit429 = false;
  let looked = 0;
  const failed: string[] = [];
  for (const p of ordered) {
    looked++;
    const openMine = openSellQty(mine, p.symbol);
    const openOthers = openSellQty(others, p.symbol);
    const free = Math.min(p.qty - openMine - openOthers, p.qtyAvailable ?? Infinity);
    if (free > 1e-6) {
      const cost = gate.needsRead() ? 3 : 1; // the gate reads again (2 requests) after a refused sell
      if (!canSpend(cost)) {
        looked--;
        break;
      }
      spend(cost);
      const id = `cyrus-x-${day.tradeDate.replaceAll("-", "")}-${p.symbol}-${d.now().getTime().toString(36)}-r`;
      const r = await gate.sell({ symbol: p.symbol, qty: free, clientOrderId: id, reason: "daily loss stop (retry)" });
      if (r.status === "sent") sent++;
      else {
        failed.push(p.symbol);
        if (r.status === "error" && r.httpStatus === 429) {
          hit429 = true;
          break;
        }
      }
    } else if (openOthers > 1e-6 && openMine <= 1e-6) {
      for (const id of openOrderIds(others, new Set([p.symbol]))) {
        if (!canSpend(1)) break;
        spend(1);
        try {
          await d.broker.cancelOrder(id);
        } catch (err) {
          if (is429(err)) hit429 = true;
          break;
        }
      }
      if (hit429) break;
    }
  }
  mem.turn = n > 0 ? (first + looked) % n : 0; // the next check starts where this one stopped
  if (hit429) rateLimited();
  else mem.backoffMs = 0;
  d.log?.("loss_stop_sale_retried", { held: n, sent, failed: failed.length, backoffMs: mem.backoffMs });
  // At most one nudge every 5 minutes, not one on every check.
  if (failed.length > 0 && d.now().getTime() - mem.lastRetryAlert >= 5 * 60_000) {
    mem.lastRetryAlert = d.now().getTime();
    void d.say("alerts", `**Michael: daily loss stop: selling is still failing (${failed.slice(0, 10).join(", ")}${failed.length > 10 ? ", ..." : ""}).** I retry only those every 5 seconds, inside a fixed request budget. Check Alpaca now.`, { mentionOwner: true }).catch(() => undefined);
  }
}
const fallbackMemory = new LossStopMemory();

// While the stop flag is on, cancel any entry that has not filled. This catches an entry that passed the gate's
// last look at the flag just before a stop command and reached Alpaca after the command's own cancel pass.
// Exits resting at Alpaca (sell orders) and entries that have started to fill are left alone.
export async function sweepEntriesWhileStopped(d: RiskDeps): Promise<number> {
  const flag = await d.store.getControl<StopFlag>(CONTROL_STOP);
  if (!flag?.on) return 0;
  const open = await d.broker.listOrders("open");
  let n = 0;
  for (const o of open) {
    if (o.side === "buy" && o.filledQty === 0) {
      await d.broker.cancelOrder(o.id);
      n++;
    }
  }
  if (n > 0) {
    d.log?.("entries_swept_while_stopped", { cancelled: n });
    await d.say("commands", `The stop flag is on and ${n} unfilled entr${n === 1 ? "y" : "ies"} reached Alpaca late, so I cancelled ${n === 1 ? "it" : "them"}.`);
  }
  return n;
}

// A5 of the proposal of 2026-11-12 (Michael's approval): a load-window entry filled as the stack's 5 second cancel reached Alpaca. On
// 2026-11-11 Alpaca then cancelled both exits in 24 of 24 such cases (0.05 to 1.06 s later), and five waited 10 to 17 s for the order sync.
// The entry's share is sold at once through the checked sell path; the sale waits in sells.ts for Alpaca's cancel to free the share, and
// sells nothing if Alpaca kept the exits. Never throws.
export async function fastLostExitSale(d: RiskDeps, day: DayRecord, mem: SyncMemory, s: OrderRecord, fillAtMs: number): Promise<void> {
  try {
    const o = await d.broker.findOrderByClientId(s.clientOrderId);
    if (!o || !(o.filledQty > 0) || o.side !== "buy") return;
    if (exitFilledQty(o) > 1e-9) return; // an exit has sold shares: it was not a lost-exit case
    await cleanupSale(d, day, mem, s, o, "missing", undefined, { fast: { fillAtMs } });
  } catch (err) {
    d.log?.("lost_exit_fast_failed", { symbol: s.symbol, error: (err as Error).message.slice(0, 120) });
  }
}
