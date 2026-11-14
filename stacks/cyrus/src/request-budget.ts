// THE SHARED REQUEST BUDGET (the redesign of 2026-11-14, part 1; Michael's approval of the same day, decisions 1 to 6 with his changes A
// and B; builds/c2-redesign-2026-11-14.md, sections 3 and 10). One budget that every retry, recheck and status check draws from, in place
// of the separate allowances (the stuck-retry allowance, the loss stop's and the mid-day close-out's budgets, the recheck charge and its
// give-back).
//
//  - Budgeted work (class P1: sales of shares without a confirmed stop, the timed-out stop's tries, checks and cancels, the close-out
//    retries, the loss stop's re-sells; class P2: the list-lag rechecks and the fresh-stop lookups) shares at most BUDGET_PER_MINUTE
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
// A P2 try refused on its floor counts as waiting (entries give way) until it is granted, or at most this long after its last refusal.
export const GIVE_WAY_MAX_MS = 2_000;
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
  constructor(budget: RequestBudget, cls: BudgetClass | null, size: number, label: string, fiveSec: boolean) {
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
  givingWayRefusals: number;
}

const emptyMinute = (): BudgetMinute => ({ sent: { entry: 0, first: 0, P1: 0, P2: 0, routine: 0, clock: 0 }, granted: 0, refused: { minute: 0, five: 0, class: 0, floor: 0 }, forced: 0, overdrafts: 0, sentAfterEnd: 0, mostBudgetedInMinute: 0, mostBudgetedIn5s: 0, givingWayRefusals: 0 });

export class RequestBudget {
  readonly nowMs: () => number;
  private readonly remaining: () => number;
  private readonly log: ((event: string, data?: Record<string, unknown>) => void) | undefined;
  // Every budgeted request sent in the last 60 seconds, oldest first (its time and class).
  private sent: Array<{ t: number; cls: BudgetClass }> = [];
  private readonly open = new Set<Reservation>();
  private readonly floorWaits = new Map<string, number>();
  private minute = emptyMinute();
  // Since the start (statistics and tests): budgeted requests sent per class, and the most budgeted requests seen in any minute and any 5
  // seconds (forced and overdrawn requests included).
  readonly totals = { P1: 0, P2: 0, overdraft: 0 };
  readonly peak = { minute: 0, five: 0 };

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
      const refusal = this.refusal(cls, size, fiveSec, now);
      if (refusal) {
        this.minute.refused[refusal.why]++;
        if (cls === "P2" && refusal.why === "floor" && opts.waitKey) this.floorWaits.set(opts.waitKey, now + GIVE_WAY_MAX_MS);
        this.log?.("budget_refused", { cls, n: size, label: opts.label, why: refusal.why, roomInMs: refusal.at - now });
        return refusal;
      }
    } else this.minute.forced++;
    if (opts.waitKey) this.floorWaits.delete(opts.waitKey);
    const r = new Reservation(this, cls, size, opts.label, fiveSec);
    this.open.add(r);
    this.minute.granted++;
    return r;
  }

  // Looks only: would `tryReserve` grant this now? (For scheduling.)
  roomFor(cls: BudgetClass, n: number, fiveSec = true): { ok: true } | Refusal {
    return this.refusal(cls, Math.max(0, Math.ceil(n)), fiveSec, this.nowMs()) ?? { ok: true };
  }

  private refusal(cls: BudgetClass, n: number, fiveSec: boolean, now: number): Refusal | null {
    const u = this.usage(now);
    const cap = cls === "P1" ? BUDGET_PER_MINUTE : BUDGET_PER_MINUTE - P1_KEEP;
    const at: number[] = [];
    let why: Refusal["why"] | null = null;
    if (u.minute + u.unsentMinute + n > cap) {
      why = cls === "P2" && u.minute + u.unsentMinute + n <= BUDGET_PER_MINUTE ? "class" : "minute";
      at.push(this.agedOutAt(u.minute + u.unsentMinute + n - cap, 60_000, now, u.unsentMinute));
    }
    if (fiveSec && u.five + u.unsentFive + n > BUDGET_PER_5S) {
      why ??= "five";
      at.push(this.agedOutAt(u.five + u.unsentFive + n - BUDGET_PER_5S, 5_000, now, u.unsentFive));
    }
    const floor = cls === "P1" ? P1_FLOOR : P2_FLOOR;
    const left = this.remaining() - u.unsentMinute - n;
    if (left < floor) {
      why ??= "floor";
      at.push(now + Math.ceil((floor - left) / REFILL_PER_MS));
    }
    if (why === null) return null;
    return { ok: false, at: Math.max(now + 1, ...at), why };
  }

  // When `excess` budgeted requests will have left the window (oldest first). Room reserved by a try still running is released only when
  // that try ends, which cannot be known: then a quarter of a second from now, the earliest a look is worth it.
  private agedOutAt(excess: number, windowMs: number, now: number, unsent: number): number {
    const inWindow = this.sent.filter((s) => now - s.t < windowMs);
    if (excess > inWindow.length) return now + Math.max(250, unsent > 0 ? 250 : windowMs);
    return Math.max(now + (unsent > 0 ? 250 : 1), inWindow[excess - 1]!.t + windowMs);
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
      this.sent.push({ t: now, cls: r.cls });
      const u = this.usage(now);
      this.minute.mostBudgetedInMinute = Math.max(this.minute.mostBudgetedInMinute, u.minute);
      this.minute.mostBudgetedIn5s = Math.max(this.minute.mostBudgetedIn5s, u.five);
      this.totals[r.cls]++;
      this.peak.minute = Math.max(this.peak.minute, u.minute);
      this.peak.five = Math.max(this.peak.five, u.five);
      if (r.used > r.size) {
        r.overdraft++;
        this.minute.overdrafts++;
        this.totals.overdraft++;
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
