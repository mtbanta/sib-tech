// THE SHARED REQUEST BUDGET (the redesign of 2026-11-14, part 1; Michael's approval of the same day, decisions 1 to 6 with his changes A
// and B; builds/c2-redesign-2026-11-14.md, sections 3 and 10). One budget that every retry, recheck and status check draws from, in place
// of the separate allowances (the stuck-retry allowance, the loss stop's and the mid-day close-out's budgets, the recheck charge and its
// give-back).
//
//  - Budgeted work (class P1: sales of shares without a confirmed stop, the timed-out stop's tries, checks and cancels, the close-out
//    retries, the loss stop's re-sells, an unclear fresh stop's lookup since Michael's ruling 2 of 2026-11-14; class P2: the list-lag rechecks
//    and a confirmed fresh stop's periodic lookup; ordinary stuck retries stop at STUCK_RETRY_MINUTE_CAP, 60 of the 75 since 2026-11-17 (45 of 60 before), `minuteCap`) shares at most BUDGET_PER_MINUTE
//    requests in any 60 seconds and BUDGET_PER_5S in any 5 seconds. P2 may draw only while it leaves P1_KEEP of the minute for P1.
//  - A budgeted try asks for its whole room before it starts (`tryReserve`, its most requests). It starts only when the minute (and,
//    unless it is a close-out retry, the 5 seconds) has room, its class leaves P1 its share, and Alpaca's remaining requests stay at or
//    above its floor after it: P1_FLOOR (20) for P1, P2_FLOOR (the governor's reserve, 80) for P2 (Michael's change A). The room is held
//    as a reservation until the try ends; what it did not use is then released. A try is never stopped halfway for lack of room: requests
//    beyond its reservation are still sent and counted (`budget_overdraft`), and later tries wait for them.
//  - Every request is counted at the moment it is sent, in the scope of whoever asked (request-scope.ts), never before and never after:
//    nothing is charged for a request that never ran, nothing runs uncharged, and the Alpaca client's own retries are counted too.
//  - First tries of safety work are counted (per tag, for the statistics) but never refused (decision 4); they are not part of the
//    budgeted minute. Entries keep the governor's reserve and their ceilings (unchanged). Routine work is counted, not limited.
//  - Entries give way while a P2 try has room in the minute but waits on its floor of 80 (decision 5 with change A), and, since Michael's
//    ruling of 2026-11-17, while a stuck sale waits for Alpaca's room (STUCK_SALE_GIVE_WAY, below): the governor refuses an entry then
//    (`givingWay`). A P1 try's floor of 20 is below the entries' reserve of 80, so entries rarely hold one back; the stuck-sale give-way
//    covers the rest (room reserved unsent can bring a sale short of its floor while the estimate is above 80).
// Nothing here sends, cancels or sizes an order; it only says whether a budgeted try may start, and counts.
import { SAFETY_RESERVE, ALPACA_REQUESTS_PER_MINUTE } from "./governor.ts";
import { currentTag, requestScope, separateBucket, type ScopeReservation, type Scope, type Tag } from "./request-scope.ts";

export type BudgetClass = "P1" | "P2";
// Michael's decision 2 of 2026-11-17 (about 8:25 AM): "raise stuck sales to 60 a minute ... only in the version where urgent work keeps its 15
// (shared budget 75)". So the shared minute is 75 (60 until then): ordinary stuck retries stop at 60 of it (STUCK_RETRY_MINUTE_CAP in risk.ts),
// urgent P1 work (unclear fresh-stop lookups, the 15 second limit's sale, timed-out stop checks and tries) keeps the last 15, and P2 keeps
// its share of 40. Close-out retries and the loss stop's re-sells keep their own 60 (RULED_MINUTE_CAP, below), so they never draw on the 15;
// a close-out still gets up to 60 because stuck retries stand aside while a close-out owns selling (P1_KEEP is 35, was 20, so 75 - 35 = 40 as before). The 15 in any 5 seconds is unchanged.
export const BUDGET_PER_MINUTE = 75;
export const BUDGET_PER_5S = 15;
export const P1_KEEP = 35;
// A close-out's retry (the regular, mid-day, afternoon or carried-position close-out) and the daily loss stop's re-sell keep Michael's ruling
// of 2026-11-09 ("Keep trying every 20 seconds, but only within 60 Alpaca requests a minute (like the loss stop's retry)"): each starts only
// while the shared minute's use plus its own stays at or below 60, though the minute is now 75 (decision 2 of 2026-11-17). Without this, a
// close-out retry may start in the 15 above 60 and its unreserved extra requests (a try is never stopped halfway) reached 104 in 60 s in the
// mid-day test, and the loss stop's re-sells reached 52 in a minute in the round 8 test where they had reached 39 (group 2, round 1).
// Stuck retries stand aside while a close-out owns selling, so the two do not compete for the 60. Refused between 60 and 75 it counts as
// `refused.class` (within the minute, above its own share), not `minute`.
export const RULED_MINUTE_CAP = 60;
export const CLOSEOUT_MINUTE_CAP = RULED_MINUTE_CAP;
export const P1_FLOOR = 20;
// Protect-first: when a P2 try refused because P2 gives way may look again (a local check; the try's own window and schedule bound it).
export const PROTECT_FIRST_RECHECK_MS = 250;
export const P2_FLOOR = SAFETY_RESERVE;
// A P2 try refused on its floor counts as waiting (entries give way) until it is granted, or this long after its last refusal unless its
// caller extends the wait to its next try (`extendWait`: the list-lag recheck, bounded by its 30 s window; the unclear fresh-stop lookup is P1
// since Michael's ruling 2 of 2026-11-14, night).
export const GIVE_WAY_MAX_MS = 2_000;
// Michael's answer of 2026-11-14 (night, after group 1's rulings round 2): while an ordinary stuck retry waits for room under its ceiling
// (STUCK_RETRY_MINUTE_CAP: 60 since 2026-11-17, 45 before), and P2's use is what keeps it out, P2 (list-lag rechecks, a confirmed fresh stop's periodic lookup) may draw only while it leaves room
// for that retry (its share is in effect the retry's ceiling less its size: 60 - 10 = 50 since 2026-11-17, so in the minute P2 keeps its 40 and the hold acts in the 5 seconds; 45 - 10 = 35 before), until the retry looks again (when room may return)
// and at least this long; each refused look of the retry renews it.
export const RETRY_WAIT_HOLD_MS = 2_500;
// Item 3 of the night build (Michael's request of 2026-11-16, about 8:50 PM, decision 4 changed: "First tries: paced, not exempt; they wait
// only for Alpaca's requests to refill, at most about 3 s"). A first try waits before it starts, sending nothing, while Alpaca's remaining
// requests less the room budgeted tries hold unsent less what the try can send are below the urgent floor of 20 (P1_FLOOR, the floor every
// P1 try already keeps): 0.25 s doubling to 1 s, at most FIRST_TRY_WAIT_MAX_MS in all, then it goes ahead whatever the room. A one-entry
// first try's wait ends at once when a sale of the whole account is asked (`wakeFirstWaiters`). It is still counted, never refused.
export const FIRST_TRY_WAIT_MAX_MS = 3_000;
// THE SWITCH for item 3 (Michael's answer of 2026-11-16, about 10:25 PM: "Ship the rest with item 3 switched off; item 3 joins only if it
// passes the bar in time"): OFF. While off, `paceFirst` returns at once (no wait, no `first_try_paced`, `firstPaced` stays 0), so every first
// try goes ahead at once as on v24. An object so the tests can switch it on; nothing in the worker changes it.
export const FIRST_TRY_PACING = { on: false };
// Item 5 (b) of the night build (Michael: "close-out retries go ahead of stuck retries"): when a close-out's retry is refused for room, ordinary
// stuck retries (the tries capped at STUCK_RETRY_MINUTE_CAP) are refused as "class" until that retry is granted, and at most this long after
// its refusal (it asks again on the next 5 second pass), or until the moment it said room would return, plus a moment. Nothing else waits.
// Group 1, night build round 1 (finding 2: each refused close-out retry renewed the hold, so stuck retries could be refused without limit):
//  - the hold is set only when the stuck retries' own use is what keeps the close-out retry out: the minute is what refuses it, and without
//    the ordinary stuck retries' requests (sent in the last minute, and reserved unsent) it would fit, with Alpaca's remaining above its floor
//    (the same test `holdForRetry` uses for P2). Refused for anything else, it holds nothing, since holding the stuck retries would not help;
//  - in one waiting spell the hold lasts at most CLOSEOUT_HOLD_TOTAL_MS in all. After that there is no hold until the close-out retry is
//    granted, or has not been refused for CLOSEOUT_SPELL_GAP_MS (it stopped asking), so an unprotected position's sale never waits more than
//    10 s for it (Michael's overnight instructions of 2026-11-16, item 1, saved verbatim in the C2 log: "fastest protection of positions
//    without a stop first"). Even so it is switched off (CLOSEOUT_HOLD, above).
// THE SWITCH for item 5 (b) (night build, after group 1 round 1): OFF. When it engages it holds an unprotected position's stuck retry for up
// to 10 s where v24 grants it at once, worse than v24 on Michael's time measure and against his first priority (his overnight instructions
// of 2026-11-16, saved verbatim in the C2 log: "fastest protection of positions without a stop first"), so under his pre-approved split
// it ships switched off: no close-out retry sets a hold, so stuck retries are never held for one (as on v24). Item 5 (a), the logging
// counter, stays on. An object so the tests can switch it on; nothing in the worker changes it.
export const CLOSEOUT_HOLD = { on: false };
export const CLOSEOUT_FIRST_HOLD_MS = 5_500;
export const CLOSEOUT_HOLD_TOTAL_MS = 10_000;
export const CLOSEOUT_SPELL_GAP_MS = 15_000;
// What a one-entry first try can send: a missing-exit or remainder sale's 3 rounds (measured on 2026-11-16: 25), and the fast sale.
// The close-outs' first tries are not paced (night-a2 tuning): measured on 2026-11-16 (simulator, the worker's own regular (then at 2:55) and mid-day close-outs
// with Alpaca's remaining at 60), a wait of 1.8 to 3 s before the close-out delayed its sales by as much against v24.
export const FIRST_TRY_MOST = 25;
const REFILL_PER_MS = ALPACA_REQUESTS_PER_MINUTE / 60_000;

// `floorShort`: Alpaca's remaining requests (as the governor estimates them) would fall below the try's floor, and `floorAt` when the floor
// alone would have room again at Alpaca's refill rate (Michael's ruling of 2026-11-17 on stuck sales reads them: only Alpaca's room is what an
// entry giving way can give the sale, so the hold lasts no longer than that shortfall).
export type Refusal = { ok: false; at: number; why: "minute" | "five" | "class" | "floor"; floorShort?: boolean; floorAt?: number };
// MICHAEL'S RULING OF 2026-11-17 (morning, his words: "while a stuck sale is waiting for room, new entries give way (the governor holds entries
// back) so Alpaca's room goes to the sale"). A stuck sale (an ordinary stuck retry, a timed-out stop's try, or the 15 second limit's sale)
// refused while Alpaca's remaining requests (the governor's estimate, less the room reserved unsent and the look's reads) are short of its
// floor of 20 marks the budget as giving way until the earlier of the moment that shortfall would end at Alpaca's refill rate (`floorAt`) and
// the sale's next look, plus STUCK_SALE_GIVE_WAY_MARGIN_MS; while marked, the governor refuses every new entry (`givingWay`). Each further
// refusal of a stuck sale on the floor (at its look, or the protection loop's local room check) renews it; it ends on its own when no stuck
// sale has been refused for room since. Nothing is sent or cancelled here; entries already working are untouched. A refusal for the budgeted
// minute or the 5 seconds alone holds nothing, and a sale short on both holds entries only for the floor's part (entries do not use the
// budgeted minute, so their giving way would not help with it; group 2, round 1). An object so the tests can switch it off; nothing in the
// worker changes it.
export const STUCK_SALE_GIVE_WAY = { on: true };
export const STUCK_SALE_GIVE_WAY_MARGIN_MS = 500;

export interface ReserveOptions {
  // False for the close-out retries (they cannot fit 15 in 5 seconds; their burst is bounded by their own single round). Default true.
  fiveSec?: boolean;
  // Michael's change B: the regular close-out's retry (at the set time, 2:55 by default) from 2:58 PM Central: counted, never refused.
  force?: boolean;
  // What the try is, for the log.
  label: string;
  // A P2 try that will be tried again when room returns (the list-lag recheck): while it waits on its floor, entries give way.
  waitKey?: string;
  // Michael's answer of 2026-11-14 (night) on rulings 1 and 2: a lower ceiling on the budgeted minute for this try (an ordinary stuck retry:
  // STUCK_RETRY_MINUTE_CAP, 60 of 75 since 2026-11-17, 45 of 60 before), so the rest of the minute stays for urgent work (unclear fresh-stop lookups, the 15 second limit's try, timed-out
  // stop checks; close-out retries and the loss stop's re-sells until 2026-11-17, which now keep their own 60). Refused above it as "class".
  minuteCap?: number;
  // The Alpaca client's own retries inside this try stop when its reservation has no room left (only a timed-out stop's tries, checks and
  // cancels, Michael's item 2 of 2026-11-13). Any other try is never stopped halfway (design 3.2): its extra requests are counted.
  limitRetries?: boolean;
  // The daily loss stop's re-sell (and, through `closeOut`, every close-out retry): starts only within RULED_MINUTE_CAP (60) of the minute.
  ruledCap?: boolean;
  // Item 5 (b) of the night build: a close-out's retry (the regular close-out at the set time, 2:55 by default, or the mid-day, afternoon or carried-position close-out). While one waits for
  // room and the ordinary stuck retries' own use is what keeps it out, they are refused so it gets the room first (`closeOutWaitUntil`),
  // at most 10 s in all in one waiting spell (CLOSEOUT_HOLD_TOTAL_MS).
  closeOut?: boolean;
}

export class Reservation implements ScopeReservation {
  used = 0;
  // An ordinary stuck retry's reservation (reserved with `minuteCap`): item 5 (b) counts its use (group 1, night build round 1).
  stuckRetry = false;
  ended = false;
  overdraft = 0;
  readonly startedAt: number;
  private readonly budget: RequestBudget;
  readonly cls: BudgetClass | null; // null: a first try's counter (never limited, not in the budgeted minute)
  readonly size: number;
  readonly label: string;
  readonly fiveSec: boolean;
  readonly limitRetries: boolean;
  constructor(budget: RequestBudget, cls: BudgetClass | null, size: number, label: string, fiveSec: boolean, limitRetries = false) {
    this.limitRetries = limitRetries;
    this.budget = budget;
    this.cls = cls;
    this.size = size;
    this.label = label;
    this.fiveSec = fiveSec;
    this.startedAt = budget.nowMs();
  }
  charge(path: string): void {
    this.used++;
    this.budget.recordSend(this, path);
  }
  roomLeft(): number {
    return this.cls === null ? Infinity : Math.max(0, this.size - this.used);
  }
  retryRoomLeft(): number {
    return this.limitRetries ? this.roomLeft() : Infinity;
  }
  // Room reserved and not yet used (counted against the budget while the try runs).
  unsent(): number {
    return this.cls === null || this.ended ? 0 : Math.max(0, this.size - this.used);
  }
  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.budget.release(this);
  }
  // The scope to run the try in.
  scope(tag?: Tag): Scope {
    return { tag: tag ?? (this.cls ?? "first"), reservation: this };
  }
}

export interface BudgetMinute {
  sent: Record<Tag | "clock", number>;
  granted: number;
  refused: { minute: number; five: number; class: number; floor: number };
  forced: number;
  overdrafts: number;
  sentAfterEnd: number;
  mostBudgetedInMinute: number;
  mostBudgetedIn5s: number;
  // Group 2, round 1 of the redesign: the most in any 5 seconds sent by tries capped by the 5 seconds (close-out retries left out; they
  // reserve against the minute only, design 3.2). Above 15 only if a try overdrew, or a request came after its try ended.
  mostCappedIn5s: number;
  // Entries the governor refused because they give way: to a P2 try waiting on its floor of 80 (a list-lag recheck) or, since Michael's
  // ruling of 2026-11-17, to a stuck sale waiting for Alpaca's room (those also in `stuckSaleEntriesRefused`).
  givingWayRefusals: number;
  // Michael's approval of 2026-11-15 (logging only): P2's hold for a waiting ordinary stuck retry ("rechecks leave room"), this minute.
  // `started`: refused looks or tries of such a retry that set the hold while it was not in force; `renewed`: those that renewed it while
  // in force (both counted where the hold is set, so `roomFor` looks count as well as `tryReserve` tries). `inForceMs`: the milliseconds of
  // the minute the hold was in force, up to its end (not up to the read). `p2Refused`: P2 tries (`tryReserve` only, as `refused` counts them)
  // refused that would have been granted without the hold; each is also counted once in `refused.class` or `refused.five`.
  retryHold: { started: number; renewed: number; inForceMs: number; p2Refused: number };
  // Item 3 of the night build (logging only): first tries that waited for room this minute, and their total wait in ms. (Switched off: see
  // the constant, FIRST_TRY_PACING; both stay 0.)
  firstPaced: number;
  firstPacedMs: number;
  // Item 5 (a) of the night build (logging only): the most in any 5 seconds sent by urgent (P1) tries that reserve against the 5 seconds,
  // so the 15 in 5 seconds can be judged for urgent work in every minute, close-out minutes included (close-out retries, which reserve
  // against the minute only, are left out; `mostCappedIn5s` counts P1 and P2 together).
  mostUrgentCappedIn5s: number;
  // Item 5 (b) (logging only): close-out retries refused for room that set or renewed the stuck retries' hold, and the stuck retries' tries or
  // looks refused because of it. (Switched off: see the constant, CLOSEOUT_HOLD; both stay 0.)
  closeOutHolds: number;
  closeOutHeldRetries: number;
  // Michael's ruling of 2026-11-17 on stuck sales (logging only): spells in which entries gave way to a stuck sale waiting for Alpaca's room
  // (started this minute), and the entries refused for it (each also counted in `givingWayRefusals`).
  stuckSaleHolds: number;
  stuckSaleEntriesRefused: number;
}

const emptyMinute = (): BudgetMinute => ({ sent: { entry: 0, first: 0, P1: 0, P2: 0, routine: 0, clock: 0 }, granted: 0, refused: { minute: 0, five: 0, class: 0, floor: 0 }, forced: 0, overdrafts: 0, sentAfterEnd: 0, mostBudgetedInMinute: 0, mostBudgetedIn5s: 0, mostCappedIn5s: 0, givingWayRefusals: 0, retryHold: { started: 0, renewed: 0, inForceMs: 0, p2Refused: 0 }, firstPaced: 0, firstPacedMs: 0, mostUrgentCappedIn5s: 0, closeOutHolds: 0, closeOutHeldRetries: 0, stuckSaleHolds: 0, stuckSaleEntriesRefused: 0 });

export class RequestBudget {
  readonly nowMs: () => number;
  private readonly remaining: () => number;
  private readonly log: ((event: string, data?: Record<string, unknown>) => void) | undefined;
  // Every budgeted request sent in the last 60 seconds, oldest first (its time and class).
  // `capped`: sent by a try that reserved against the 5 seconds too (every budgeted try but a close-out retry).
  // `stuck`: sent by an ordinary stuck retry (item 5 (b), group 1, night build round 1).
  private sent: Array<{ t: number; cls: BudgetClass; capped: boolean; stuck: boolean }> = [];
  // Michael's answer after group 1's rulings round 2: until when a capped retry is waiting that P2 holding back would let in, and the
  // ceiling P2 must then leave the minute at (the retry's ceiling less its size).
  private retryWaitUntil = 0;
  private retryWaitRoom = Infinity;
  private retryWaitFive = Infinity;
  // Statistics only (Michael's approval of 2026-11-15): the time up to which the hold's time in force has been counted, and whether the
  // last refusal `refusal` returned was a P2 refusal that only the hold caused. Neither is read by any decision.
  private holdCountedTo = 0;
  private lastRefusalHeldOnly = false;
  private readonly open = new Set<Reservation>();
  private readonly floorWaits = new Map<string, number>();
  private minute = emptyMinute();
  // Since the start (statistics and tests): budgeted requests sent per class, and the most budgeted requests seen in any minute and any 5
  // seconds (forced and overdrawn requests included).
  readonly totals = { P1: 0, P2: 0, overdraft: 0 };
  // Protect-first (Michael's night build request of 2026-11-16, item 2): true while low-priority work gives way because a held position
  // lacks a confirmed stop (protect-first.ts, its first 30 s). Every P2 try is refused then; P1 is never affected. Unset: never.
  // (Switched off: see the constant, PROTECT_FIRST.)
  p2GivesWay: (() => boolean) | null = null;
  readonly peak = { minute: 0, five: 0 };
  // When each request beyond its try's reservation was sent (the last 10 minutes; statistics and tests).
  readonly overdraftAt: number[] = [];

  constructor(opts: { now?: () => number; remaining?: () => number; log?: (event: string, data?: Record<string, unknown>) => void } = {}) {
    this.nowMs = opts.now ?? Date.now;
    // Alpaca's remaining requests as the governor estimates them (the last figure Alpaca gave, plus the refill since).
    this.remaining = opts.remaining ?? (() => ALPACA_REQUESTS_PER_MINUTE);
    this.log = opts.log;
  }

  private prune(now: number): void {
    let i = 0;
    while (i < this.sent.length && now - this.sent[i]!.t >= 60_000) i++;
    if (i > 0) this.sent.splice(0, i);
  }

  // Budgeted requests sent in the window (all classes), and the room reserved but not yet used.
  private usage(now: number): { minute: number; five: number; unsentMinute: number; unsentFive: number } {
    this.prune(now);
    let five = 0;
    for (let i = this.sent.length - 1; i >= 0 && now - this.sent[i]!.t < 5_000; i--) five++;
    let unsentMinute = 0;
    let unsentFive = 0;
    for (const r of this.open) {
      unsentMinute += r.unsent();
      if (r.fiveSec) unsentFive += r.unsent();
    }
    return { minute: this.sent.length, five, unsentMinute, unsentFive };
  }

  // May a budgeted try of class `cls` needing at most `n` requests start now? Granted: a reservation (end it when the try ends). Refused:
  // the earliest moment room may return, and why.
  tryReserve(cls: BudgetClass, n: number, opts: ReserveOptions): Reservation | Refusal {
    const now = this.nowMs();
    const size = Math.max(0, Math.ceil(n));
    const fiveSec = opts.fiveSec !== false;
    if (!opts.force) {
      const refusal = this.refusal(cls, size, fiveSec, now, 0, opts.minuteCap, opts.closeOut || opts.ruledCap ? RULED_MINUTE_CAP : undefined);
      // Item 5 (b): a close-out's retry kept out by the stuck retries' own use holds them back until it gets in, at most 10 s in all in one
      // waiting spell (see CLOSEOUT_FIRST_HOLD_MS and CLOSEOUT_HOLD_TOTAL_MS).
      if (refusal && opts.closeOut && CLOSEOUT_HOLD.on) this.closeOutRefused(refusal, size, now);
      if (refusal) {
        this.minute.refused[refusal.why]++;
        if (this.lastRefusalHeldOnly) this.minute.retryHold.p2Refused++; // statistics only
        if (cls === "P2" && refusal.why === "floor" && opts.waitKey) this.floorWaits.set(opts.waitKey, now + GIVE_WAY_MAX_MS);
        // Group 2, round 4 of the redesign: refused for another reason (the minute, the 5 seconds, P2's share), entries giving way would not
        // help, so a floor wait it had is dropped (decision 5: entries give way only while a P2 try waits on the 80).
        else if (opts.waitKey) this.floorWaits.delete(opts.waitKey);
        this.log?.("budget_refused", { cls, n: size, label: opts.label, why: refusal.why, roomInMs: refusal.at - now });
        return refusal;
      }
    } else this.minute.forced++;
    if (opts.closeOut) {
      // item 5 (b): it got in; the stuck retries may draw again, and its next wait is a new spell
      this.closeOutWaitUntil = 0;
      this.closeOutSpellStart = null;
    }
    if (opts.waitKey) this.floorWaits.delete(opts.waitKey);
    const r = new Reservation(this, cls, size, opts.label, fiveSec, opts.limitRetries === true);
    if (opts.minuteCap !== undefined) r.stuckRetry = true;
    this.open.add(r);
    this.minute.granted++;
    return r;
  }

  // Would `tryReserve` grant this now? (For scheduling; it reserves nothing. A capped retry's look that is refused with P2 in the way sets or
  // renews P2's hold for it, as `tryReserve` would, Michael's answer of 2026-11-14 night.) `routineAhead`: routine requests that will be sent first from the same
  // Alpaca bucket (the reads of the sync that comes for the try), counted against the floor only (group 2, round 2 of the redesign).
  roomFor(cls: BudgetClass, n: number, fiveSec = true, routineAhead = 0, minuteCap?: number): { ok: true } | Refusal {
    return this.refusal(cls, Math.max(0, Math.ceil(n)), fiveSec, this.nowMs(), routineAhead, minuteCap) ?? { ok: true };
  }

  // Item 5 (b) of the night build: until when ordinary stuck retries give way to a close-out's retry that is waiting for room.
  private closeOutWaitUntil = 0;
  // Group 1, night build round 1: when the current waiting spell's first hold was set (null: no spell), when a close-out retry was last
  // refused, and whether the spell's cap was logged.
  private closeOutSpellStart: number | null = null;
  private closeOutLastRefusal = -Infinity;
  private closeOutCapLogged = false;

  // A close-out's retry was refused. The stuck retries are held back only if their own use is what keeps it out, and only up to the spell's
  // cap (CLOSEOUT_HOLD_TOTAL_MS); a spell ends when the retry is granted or has not been refused for CLOSEOUT_SPELL_GAP_MS.
  private closeOutRefused(refusal: Refusal, n: number, now: number): void {
    if (now - this.closeOutLastRefusal >= CLOSEOUT_SPELL_GAP_MS) this.closeOutSpellStart = null; // it had stopped asking
    this.closeOutLastRefusal = now;
    if (!this.stuckUseKeepsOut(n, now)) return;
    if (this.closeOutSpellStart === null) {
      this.closeOutSpellStart = now;
      this.closeOutCapLogged = false;
    }
    const capEnd = this.closeOutSpellStart + CLOSEOUT_HOLD_TOTAL_MS;
    if (now >= capEnd) {
      if (!this.closeOutCapLogged) this.log?.("closeout_hold_capped", { heldMs: CLOSEOUT_HOLD_TOTAL_MS }); // Fly's log, once a spell
      this.closeOutCapLogged = true;
      return;
    }
    this.closeOutWaitUntil = Math.min(capEnd, Math.max(this.closeOutWaitUntil, Math.min(now + CLOSEOUT_FIRST_HOLD_MS, refusal.at + 500)));
    this.minute.closeOutHolds++;
  }

  // Whether a close-out retry of `n` (it reserves against the minute only) is kept out by the ordinary stuck retries' use: the minute refuses
  // it, it would fit without their requests (sent in the last minute, and reserved unsent), and Alpaca's remaining stays above its floor.
  private stuckUseKeepsOut(n: number, now: number): boolean {
    const u = this.usage(now);
    const total = u.minute + u.unsentMinute + n;
    // A close-out retry's own ceiling (CLOSEOUT_MINUTE_CAP, 60 of the shared 75 since decision 2 of 2026-11-17) is what refuses it on the minute.
    if (total <= CLOSEOUT_MINUTE_CAP) return false;
    let stuck = 0;
    for (const x of this.sent) if (x.stuck && now - x.t < 60_000) stuck++;
    for (const r of this.open) if (r.stuckRetry) stuck += r.unsent();
    return total - stuck <= CLOSEOUT_MINUTE_CAP && this.remaining() - u.unsentMinute - n >= P1_FLOOR;
  }

  // `ceiling`: a lower ceiling on the shared minute that is not a stuck retry's (a close-out retry's CLOSEOUT_MINUTE_CAP); it never sets the
  // stuck retries' holds.
  private refusal(cls: BudgetClass, n: number, fiveSec: boolean, now: number, routineAhead = 0, minuteCap?: number, ceiling?: number): Refusal | null {
    // Item 5 (b): an ordinary stuck retry (capped) gives way while a close-out's retry waits for room; it looks again when that wait ends.
    // Neither early refusal below is one the retry's hold alone caused, so each clears that flag (statistics only; group 2, night build of
    // 2026-11-16, round 1: a stale flag counted these refusals into `retryHold.p2Refused`).
    if (cls === "P1" && minuteCap !== undefined && now < this.closeOutWaitUntil) {
      this.lastRefusalHeldOnly = false;
      this.minute.closeOutHeldRetries++;
      return { ok: false, at: this.closeOutWaitUntil, why: "class" };
    }
    // Protect-first: P2 gives way (looked at again a quarter second later, a local check with no request).
    if (cls === "P2" && this.p2GivesWay?.()) {
      this.lastRefusalHeldOnly = false;
      return { ok: false, at: now + PROTECT_FIRST_RECHECK_MS, why: "class" };
    }
    const u = this.usage(now);
    // P2 leaves room, in the minute and in the 5 seconds, for a waiting capped retry (Michael's answer after group 1's rulings round 2).
    const holding = now < this.retryWaitUntil;
    const p2Cap = holding ? Math.min(BUDGET_PER_MINUTE - P1_KEEP, this.retryWaitRoom) : BUDGET_PER_MINUTE - P1_KEEP;
    const cap = Math.min(cls === "P1" ? BUDGET_PER_MINUTE : p2Cap, minuteCap ?? Infinity, ceiling ?? Infinity);
    const fiveCap = cls === "P2" && holding ? Math.min(BUDGET_PER_5S, this.retryWaitFive) : BUDGET_PER_5S;
    const at: number[] = [];
    let why: Refusal["why"] | null = null;
    const minuteShort = u.minute + u.unsentMinute + n > cap;
    const fiveShort = fiveSec && u.five + u.unsentFive + n > fiveCap;
    if (minuteShort) {
      why = u.minute + u.unsentMinute + n <= BUDGET_PER_MINUTE ? "class" : "minute";
      at.push(this.agedOutAt(u.minute + u.unsentMinute + n - cap, 60_000, now, u.unsentMinute));
    }
    if (fiveShort) {
      why ??= "five";
      at.push(this.agedOutAt(u.five + u.unsentFive + n - fiveCap, 5_000, now, u.unsentFive));
    }
    // A capped retry (an ordinary stuck retry, under its ceiling, STUCK_RETRY_MINUTE_CAP) kept out by the minute or the 5 seconds: if the urgent work alone (P1,
    // sent and reserved) leaves it room in both, P2's use is what keeps it out, so P2 holds back for it until it looks again. If P1 alone already
    // fills either, holding P2 back would not help, and P2 keeps its share.
    const holdForRetry = cls === "P1" && minuteCap !== undefined && (minuteShort || fiveShort) && (!minuteShort || (cap === minuteCap && this.p1Use(now, 60_000) + n <= minuteCap)) && (!fiveShort || this.p1Use(now, 5_000, true) + n <= BUDGET_PER_5S);
    const floor = cls === "P1" ? P1_FLOOR : P2_FLOOR;
    const left = this.remaining() - u.unsentMinute - n - routineAhead;
    if (left < floor) {
      why ??= "floor";
      at.push(now + Math.ceil((floor - left) / REFILL_PER_MS));
    }
    if (why === null) return null;
    const when = Math.max(now + 1, ...at);
    // Statistics only: a P2 refusal the hold alone caused (P2's usual share, the 15 in 5 seconds and the floor would all have let it in).
    this.lastRefusalHeldOnly = cls === "P2" && holding && u.minute + u.unsentMinute + n <= Math.min(BUDGET_PER_MINUTE - P1_KEEP, minuteCap ?? Infinity) && (!fiveSec || u.five + u.unsentFive + n <= BUDGET_PER_5S) && left >= floor;
    // The hold lasts until the retry looks again (when room may return, plus a moment), and at least RETRY_WAIT_HOLD_MS; each look renews it.
    if (holdForRetry && minuteCap !== undefined) {
      this.countHold(now); // statistics only
      if (holding) this.minute.retryHold.renewed++;
      else this.minute.retryHold.started++;
      this.retryWaitUntil = Math.max(this.retryWaitUntil, now + RETRY_WAIT_HOLD_MS, when + 500);
      this.retryWaitRoom = minuteCap - n;
      this.retryWaitFive = BUDGET_PER_5S - n;
    }
    return { ok: false, at: when, why, ...(left < floor ? { floorShort: true, floorAt: now + Math.ceil((floor - left) / REFILL_PER_MS) } : {}) };
  }

  // Statistics only: adds the time the hold was in force since it was last counted, up to `now` or the hold's end, whichever is first.
  private countHold(now: number): void {
    const end = Math.min(now, this.retryWaitUntil);
    if (end > this.holdCountedTo) this.minute.retryHold.inForceMs += end - this.holdCountedTo;
    if (now > this.holdCountedTo) this.holdCountedTo = now;
  }


  // When `excess` budgeted requests will have left the window (oldest first). Room reserved by a try still running is released only when
  // that try ends, which cannot be known: then a quarter of a second from now, the earliest a look is worth it.
  private agedOutAt(excess: number, windowMs: number, now: number, unsent: number): number {
    const inWindow = this.sent.filter((s) => now - s.t < windowMs);
    if (excess > inWindow.length) return now + Math.max(250, unsent > 0 ? 250 : windowMs);
    return Math.max(now + (unsent > 0 ? 250 : 1), inWindow[excess - 1]!.t + windowMs);
  }

  // Budgeted P1 requests in the last minute (or 5 seconds), sent and reserved but not yet sent (for the 5 seconds, reservations it caps), as
  // `usage` counts them.
  private p1Use(now: number, windowMs: number, fiveSecOnly = false): number {
    let n = 0;
    for (const x of this.sent) if (x.cls === "P1" && now - x.t < windowMs) n++; // as `usage` counts the window
    for (const r of this.open) if (r.cls === "P1" && (!fiveSecOnly || r.fiveSec)) n += r.unsent();
    return n;
  }

  // A first try's counter: never refused, not part of the budgeted minute; `used` says what the try sent (the mid-day close-out's next
  // retry is sized from it).
  first(label: string): Reservation {
    return new Reservation(this, null, Infinity, label, false);
  }

  // Item 3 of the night build: room for a first try of `n` requests above the urgent floor (no request; the governor's estimate).
  firstRoom(n: number): boolean {
    return this.urgentRoom(n);
  }

  // Room for `n` requests above the urgent floor of 20: Alpaca's remaining as the governor estimates it, less the room reserved unsent, less
  // `n` (no request). Item 1's cancel-result lookup asks it for 1 (night build round 1 follow-up).
  urgentRoom(n: number): boolean {
    return this.remaining() - this.usage(this.nowMs()).unsentMinute - n >= P1_FLOOR;
  }

  // Item 3 of the night build: waits (sending nothing) until `firstRoom(n)`, at most FIRST_TRY_WAIT_MAX_MS, 0.25 s doubling to 1 s; a
  // `wakeable` wait also ends when a sale of the whole account is asked. Returns how long it waited (ms). Logged when it waited.
  async paceFirst(n: number, label: string, sleep: (ms: number) => Promise<void>, wakeable: boolean): Promise<number> {
    if (!FIRST_TRY_PACING.on) return 0; // item 3 switched off: as on v24
    const start = this.nowMs();
    let wait = 250;
    let woke = false;
    while (!this.firstRoom(n) && this.nowMs() - start < FIRST_TRY_WAIT_MAX_MS && !woke) {
      const step = Math.min(wait, FIRST_TRY_WAIT_MAX_MS - (this.nowMs() - start));
      if (wakeable) {
        let wake: () => void = () => {};
        const woken = new Promise<boolean>((res) => (wake = () => res(true)));
        this.firstWaiters.add(wake);
        woke = await Promise.race([sleep(step).then(() => false), woken]);
        this.firstWaiters.delete(wake);
      } else await sleep(step);
      wait = Math.min(wait * 2, 1_000);
    }
    const waited = this.nowMs() - start;
    if (waited > 0) {
      this.minute.firstPaced++;
      this.minute.firstPacedMs += waited;
      this.log?.("first_try_paced", { label, n, waitedMs: waited, room: this.firstRoom(n), woke });
    }
    return waited;
  }

  // Item 3 of the night build: a sale of the whole account was asked; one-entry first tries waiting for room go ahead now (they then stand
  // aside at their turn in the sale queue, as before).
  wakeFirstWaiters(): void {
    for (const w of [...this.firstWaiters]) w();
  }
  private readonly firstWaiters = new Set<() => void>();

  recordSend(r: Reservation, path: string): void {
    if (separateBucket(path)) return;
    const now = this.nowMs();
    if (r.cls !== null) {
      this.sent.push({ t: now, cls: r.cls, capped: r.fiveSec, stuck: r.stuckRetry });
      const u = this.usage(now);
      let capped5 = 0;
      let urgentCapped5 = 0; // item 5 (a), logging only
      for (let i = this.sent.length - 1; i >= 0 && now - this.sent[i]!.t < 5_000; i--) {
        if (!this.sent[i]!.capped) continue;
        capped5++;
        if (this.sent[i]!.cls === "P1") urgentCapped5++;
      }
      this.minute.mostCappedIn5s = Math.max(this.minute.mostCappedIn5s, capped5);
      this.minute.mostUrgentCappedIn5s = Math.max(this.minute.mostUrgentCappedIn5s, urgentCapped5);
      this.minute.mostBudgetedInMinute = Math.max(this.minute.mostBudgetedInMinute, u.minute);
      this.minute.mostBudgetedIn5s = Math.max(this.minute.mostBudgetedIn5s, u.five);
      this.totals[r.cls]++;
      this.peak.minute = Math.max(this.peak.minute, u.minute);
      this.peak.five = Math.max(this.peak.five, u.five);
      if (r.used > r.size) {
        r.overdraft++;
        this.minute.overdrafts++;
        this.totals.overdraft++;
        this.overdraftAt.push(now);
        while (this.overdraftAt.length > 0 && now - this.overdraftAt[0]! >= 10 * 60_000) this.overdraftAt.shift();
        if (r.overdraft === 1) this.log?.("budget_overdraft", { cls: r.cls, label: r.label, reserved: r.size, path });
      }
      if (r.ended) {
        this.minute.sentAfterEnd++;
        this.log?.("budget_sent_after_end", { cls: r.cls, label: r.label, path });
      }
    }
  }

  release(r: Reservation): void {
    this.open.delete(r);
  }

  // Statistics only: every request sent, by the tag of the scope it was made in (wired to the Alpaca client's `onSend`).
  onSend(path: string): void {
    if (separateBucket(path)) this.minute.sent.clock++;
    else this.minute.sent[currentTag()]++;
  }

  // Michael's ruling of 2026-11-17: until when entries give way to a stuck sale waiting for Alpaca's room (see STUCK_SALE_GIVE_WAY).
  private stuckSaleWaitUntil = 0;
  // What a give-way refusal is for, read once by the governor (group 2, round 1: one clock read, so the text and the counts agree).
  // A stuck sale was refused (`refusal`) and will look again at `nextLookMs`. Only a refusal on the floor (Alpaca's room) holds entries back,
  // until the earlier of the floor's own return (`floorAt`) and the next look, plus the margin.
  noteStuckSaleWaiting(refusal: Refusal, nextLookMs: number, label: string): void {
    if (!STUCK_SALE_GIVE_WAY.on || !refusal.floorShort) return;
    const now = this.nowMs();
    const until = Math.min(refusal.floorAt ?? refusal.at, nextLookMs) + STUCK_SALE_GIVE_WAY_MARGIN_MS;
    if (until <= this.stuckSaleWaitUntil) return;
    if (now >= this.stuckSaleWaitUntil) {
      this.minute.stuckSaleHolds++;
      this.log?.("stuck_sale_give_way", { label, untilInMs: until - now }); // Fly's log, once a spell
    }
    this.stuckSaleWaitUntil = until;
  }
  stuckSaleWaiting(): boolean {
    return STUCK_SALE_GIVE_WAY.on && this.nowMs() < this.stuckSaleWaitUntil;
  }
  // Whether entries give way now, and to what (a stuck sale first); null: they do not.
  givingWayReason(): "stuck sale" | "recheck" | null {
    if (this.stuckSaleWaiting()) return "stuck sale";
    return this.p2FloorWaiting() ? "recheck" : null;
  }

  // True while a P2 try waits on its floor of 80, or (Michael's ruling of 2026-11-17) a stuck sale waits for Alpaca's room: entries give way then.
  givingWay(): boolean {
    return this.givingWayReason() !== null;
  }

  private p2FloorWaiting(): boolean {
    const now = this.nowMs();
    for (const [k, until] of this.floorWaits) if (until <= now) this.floorWaits.delete(k);
    return this.floorWaits.size > 0;
  }
  noteGiveWayRefusal(reason: "stuck sale" | "recheck" | null = this.givingWayReason()): void {
    this.minute.givingWayRefusals++;
    if (reason === "stuck sale") this.minute.stuckSaleEntriesRefused++;
  }
  // Group 1, round 3 of the redesign (decision 5 with change A: entries give way *while* a P2 try waits on its floor): a try whose next attempt
  // is scheduled later than GIVE_WAY_MAX_MS keeps its wait until then (`untilMs`, which its caller bounds). Only a wait already recorded (a
  // refusal on the floor) is extended.
  extendWait(waitKey: string, untilMs: number): void {
    const cur = this.floorWaits.get(waitKey);
    if (cur !== undefined && untilMs > cur) this.floorWaits.set(waitKey, untilMs);
  }

  // Drops a P2 try's wait (it gave up: its window ended).
  stopWaiting(waitKey: string): void {
    this.floorWaits.delete(waitKey);
  }

  // Budgeted requests in the last minute and the last 5 seconds (sent, and reserved but not yet sent), for the statistics and tests.
  inUse(): { minute: number; five: number; reservedUnsent: number; open: number } {
    const u = this.usage(this.nowMs());
    return { minute: u.minute, five: u.five, reservedUnsent: u.unsentMinute, open: this.open.size };
  }

  // The statistics since the last call (the worker's per-minute `governor_stats`).
  takeMinute(): BudgetMinute & { inUseNow: ReturnType<RequestBudget["inUse"]> } {
    this.countHold(this.nowMs()); // statistics only
    const out = { ...this.minute, inUseNow: this.inUse() };
    this.minute = emptyMinute();
    return out;
  }
}

// Runs `fn` with a reservation and ends the reservation when `fn` settles (whatever happens).
export async function withReservation<T>(r: Reservation, fn: () => Promise<T>, tag?: Tag): Promise<T> {
  try {
    return await requestScope.run(r.scope(tag), fn);
  } finally {
    r.end();
  }
}
