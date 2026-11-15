// THE SHARED REQUEST BUDGET (the redesign of 2026-11-14, part 1; Michael's approval of the same day, decisions 1 to 6 with his changes A
// and B; builds/c2-redesign-2026-11-14.md, sections 3 and 10). One budget that every retry, recheck and status check draws from, in place
// of the separate allowances (the stuck-retry allowance, the loss stop's and the mid-day close-out's budgets, the recheck charge and its
// give-back).
//
//  - Budgeted work (class P1: sales of shares without a confirmed stop, the timed-out stop's tries, checks and cancels, the close-out
//    retries, the loss stop's re-sells, an unclear fresh stop's lookup since Michael's ruling 2 of 2026-11-14; class P2: the list-lag rechecks
//    and a confirmed fresh stop's periodic lookup; ordinary stuck retries stop at 45, `minuteCap`) shares at most BUDGET_PER_MINUTE
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
//  - Entries give way only while a P2 try has room in the minute but waits on its floor of 80 (decision 5 with change A): the governor
//    refuses an entry then (`givingWay`). A P1 try's floor of 20 is below the entries' 80, so entries never hold one back.
// Nothing here sends, cancels or sizes an order; it only says whether a budgeted try may start, and counts.
import { SAFETY_RESERVE, ALPACA_REQUESTS_PER_MINUTE } from "./governor.ts";
import { currentTag, requestScope, separateBucket, type ScopeReservation, type Scope, type Tag } from "./request-scope.ts";

export type BudgetClass = "P1" | "P2";
export const BUDGET_PER_MINUTE = 60;
export const BUDGET_PER_5S = 15;
export const P1_KEEP = 20;
export const P1_FLOOR = 20;
export const P2_FLOOR = SAFETY_RESERVE;
// A P2 try refused on its floor counts as waiting (entries give way) until it is granted, or this long after its last refusal unless its
// caller extends the wait to its next try (`extendWait`: the list-lag recheck, bounded by its 30 s window; the unclear fresh-stop lookup is P1
// since Michael's ruling 2 of 2026-11-14, night).
export const GIVE_WAY_MAX_MS = 2_000;
// Michael's answer of 2026-11-14 (night, after group 1's rulings round 2): while an ordinary stuck retry waits for room under its ceiling of
// 45, and P2's use is what keeps it out, P2 (list-lag rechecks, a confirmed fresh stop's periodic lookup) may draw only while it leaves room
// for that retry (its share is in effect 45 less the retry's size, 35, instead of 40), until the retry looks again (when room may return)
// and at least this long; each refused look of the retry renews it.
export const RETRY_WAIT_HOLD_MS = 2_500;
const REFILL_PER_MS = ALPACA_REQUESTS_PER_MINUTE / 60_000;

export type Refusal = { ok: false; at: number; why: "minute" | "five" | "class" | "floor" };

export interface ReserveOptions {
  // False for the close-out retries (they cannot fit 15 in 5 seconds; their burst is bounded by their own single round). Default true.
  fiveSec?: boolean;
  // Michael's change B: the 2:55 close-out's retry from 2:58 PM Central: counted, never refused.
  force?: boolean;
  // What the try is, for the log.
  label: string;
  // A P2 try that will be tried again when room returns (the list-lag recheck): while it waits on its floor, entries give way.
  waitKey?: string;
  // Michael's answer of 2026-11-14 (night) on rulings 1 and 2: a lower ceiling on the budgeted minute for this try (an ordinary stuck retry:
  // STUCK_RETRY_MINUTE_CAP, 45), so the rest of the 60 stays for urgent work (unclear fresh-stop lookups, the 15 second limit's try, timed-out
  // stop checks, close-out retries). Refused above it as "class" (its share of the minute).
  minuteCap?: number;
  // The Alpaca client's own retries inside this try stop when its reservation has no room left (only a timed-out stop's tries, checks and
  // cancels, Michael's item 2 of 2026-11-13). Any other try is never stopped halfway (design 3.2): its extra requests are counted.
  limitRetries?: boolean;
}

export class Reservation implements ScopeReservation {
  used = 0;
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
  givingWayRefusals: number;
}

const emptyMinute = (): BudgetMinute => ({ sent: { entry: 0, first: 0, P1: 0, P2: 0, routine: 0, clock: 0 }, granted: 0, refused: { minute: 0, five: 0, class: 0, floor: 0 }, forced: 0, overdrafts: 0, sentAfterEnd: 0, mostBudgetedInMinute: 0, mostBudgetedIn5s: 0, mostCappedIn5s: 0, givingWayRefusals: 0 });

export class RequestBudget {
  readonly nowMs: () => number;
  private readonly remaining: () => number;
  private readonly log: ((event: string, data?: Record<string, unknown>) => void) | undefined;
  // Every budgeted request sent in the last 60 seconds, oldest first (its time and class).
  // `capped`: sent by a try that reserved against the 5 seconds too (every budgeted try but a close-out retry).
  private sent: Array<{ t: number; cls: BudgetClass; capped: boolean }> = [];
  // Michael's answer after group 1's rulings round 2: until when a capped retry is waiting that P2 holding back would let in, and the
  // ceiling P2 must then leave the minute at (the retry's ceiling less its size).
  private retryWaitUntil = 0;
  private retryWaitRoom = Infinity;
  private retryWaitFive = Infinity;
  private readonly open = new Set<Reservation>();
  private readonly floorWaits = new Map<string, number>();
  private minute = emptyMinute();
  // Since the start (statistics and tests): budgeted requests sent per class, and the most budgeted requests seen in any minute and any 5
  // seconds (forced and overdrawn requests included).
  readonly totals = { P1: 0, P2: 0, overdraft: 0 };
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
      const refusal = this.refusal(cls, size, fiveSec, now, 0, opts.minuteCap);
      if (refusal) {
        this.minute.refused[refusal.why]++;
        if (cls === "P2" && refusal.why === "floor" && opts.waitKey) this.floorWaits.set(opts.waitKey, now + GIVE_WAY_MAX_MS);
        // Group 2, round 4 of the redesign: refused for another reason (the minute, the 5 seconds, P2's share), entries giving way would not
        // help, so a floor wait it had is dropped (decision 5: entries give way only while a P2 try waits on the 80).
        else if (opts.waitKey) this.floorWaits.delete(opts.waitKey);
        this.log?.("budget_refused", { cls, n: size, label: opts.label, why: refusal.why, roomInMs: refusal.at - now });
        return refusal;
      }
    } else this.minute.forced++;
    if (opts.waitKey) this.floorWaits.delete(opts.waitKey);
    const r = new Reservation(this, cls, size, opts.label, fiveSec, opts.limitRetries === true);
    this.open.add(r);
    this.minute.granted++;
    return r;
  }

  // Looks only: would `tryReserve` grant this now? (For scheduling.) `routineAhead`: routine requests that will be sent first from the same
  // Alpaca bucket (the reads of the sync that comes for the try), counted against the floor only (group 2, round 2 of the redesign).
  roomFor(cls: BudgetClass, n: number, fiveSec = true, routineAhead = 0, minuteCap?: number): { ok: true } | Refusal {
    return this.refusal(cls, Math.max(0, Math.ceil(n)), fiveSec, this.nowMs(), routineAhead, minuteCap) ?? { ok: true };
  }

  private refusal(cls: BudgetClass, n: number, fiveSec: boolean, now: number, routineAhead = 0, minuteCap?: number): Refusal | null {
    const u = this.usage(now);
    // P2 leaves room, in the minute and in the 5 seconds, for a waiting capped retry (Michael's answer after group 1's rulings round 2).
    const holding = now < this.retryWaitUntil;
    const p2Cap = holding ? Math.min(BUDGET_PER_MINUTE - P1_KEEP, this.retryWaitRoom) : BUDGET_PER_MINUTE - P1_KEEP;
    const cap = Math.min(cls === "P1" ? BUDGET_PER_MINUTE : p2Cap, minuteCap ?? Infinity);
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
    // A capped retry (an ordinary stuck retry, under its ceiling of 45) kept out by the minute or the 5 seconds: if the urgent work alone (P1,
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
    // The hold lasts until the retry looks again (when room may return, plus a moment), and at least RETRY_WAIT_HOLD_MS; each look renews it.
    if (holdForRetry && minuteCap !== undefined) {
      this.retryWaitUntil = Math.max(this.retryWaitUntil, now + RETRY_WAIT_HOLD_MS, when + 500);
      this.retryWaitRoom = minuteCap - n;
      this.retryWaitFive = BUDGET_PER_5S - n;
    }
    return { ok: false, at: when, why };
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

  recordSend(r: Reservation, path: string): void {
    if (separateBucket(path)) return;
    const now = this.nowMs();
    if (r.cls !== null) {
      this.sent.push({ t: now, cls: r.cls, capped: r.fiveSec });
      const u = this.usage(now);
      let capped5 = 0;
      for (let i = this.sent.length - 1; i >= 0 && now - this.sent[i]!.t < 5_000; i--) if (this.sent[i]!.capped) capped5++;
      this.minute.mostCappedIn5s = Math.max(this.minute.mostCappedIn5s, capped5);
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

  // True while a P2 try waits on its floor of 80 (entries give way then).
  givingWay(): boolean {
    const now = this.nowMs();
    for (const [k, until] of this.floorWaits) if (until <= now) this.floorWaits.delete(k);
    return this.floorWaits.size > 0;
  }
  noteGiveWayRefusal(): void {
    this.minute.givingWayRefusals++;
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
