// THE PROTECTION LOOP (the redesign of 2026-11-14, part 2; Michael's approval of the same day, behaviour items 1 to 3; the design,
// builds/c2-redesign-2026-11-14.md, section 4). One loop owns when each position's protection work runs:
//
//  - The order sync's walk (risk.ts `protectEntry`) decides what an entry needs, as before, but it no longer runs a sale or a fresh stop
//    itself: it hands the action to the loop (`act`), which starts it at once in the background, one action per entry at a time, and the
//    walk carries on. A stuck sale can never hold up the sync again (Monday 2026-11-09's finding).
//  - A time the walk or an action asks for (a stuck retry's time, a timed-out stop's check, an unclear fresh stop's lookup, a list-lag
//    recheck) is a wake for that entry (`wake`), not a sync brought forward. At the earliest wake the loop runs one look for every entry due
//    then (`look`: the reads the order sync makes, for those entries only, and their decisions), coalesced. A look never resets the regular
//    10 second sync. Live updates wake the entry they are about.
//  - A wake that comes while the entry's action runs is kept, and looked at when the action ends.
//  - Rule 6 (every retry loop has a limit and a backoff): each wake comes from a schedule that has both (the stuck backoff 5, 10, 20, 30 s
//    within the shared budget; the timed-out stop's checks; the unclear stop's lookups within its 15 s; the list-lag steps 0.5, 1, 2 s within
//    30 s; the follow-ups' 3 tries within 10 s). A look that fails keeps its wakes and waits 1 s, doubling to 10 s; a look that cannot start
//    because a sync runs is put off a quarter second (no request is made meanwhile).
// It sends nothing itself and decides nothing about an order: the decisions and the actions are the walk's and the sale's, as before.

export type WakeKind = "protect" | "lag";

export interface ProtectionHooks {
  // True while the entry's action runs (its decision is left until the action ends).
  busy(entryClientOrderId: string): boolean;
  // Starts the entry's action (a sale, a fresh stop, the 15 second limit's work). Resolves when the action has been started (the loop), or
  // when it has finished (the inline loop that a sync without the worker uses).
  act(entryClientOrderId: string, label: string, run: () => Promise<{ recheckAt?: number } | void>): Promise<void>;
  // Asks for a look at the entry at `atMs`. `lag`: a list-lag recheck (`extraRequests`, a lookup by id for an entry older than the order
  // list's window; `untilMs`, the end of its 30 s window).
  wake(entryClientOrderId: string, atMs: number, kind: WakeKind, extra?: { extraRequests?: number; untilMs?: number }): void;
}

export interface LoopDeps {
  now: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  // Runs one look for these entries. "busy": a sync or look is running (put off a quarter second); "wait": no room in the shared budget for
  // a list-lag look (tried again at `retryAt`); "failed": the look's reads failed; "done": it ran.
  // "idle": outside the session, nothing read (not counted). `untilMs`: the latest end of the due list-lag wakes' windows (the look waits for
  // room while any of them can still use it; group 2, round 2 of part 2, as part 1's timer did).
  look: (ids: ReadonlySet<string>, kind: WakeKind, extraRequests: number, untilMs: number) => Promise<{ outcome: "busy" | "done" | "failed" | "idle" } | { outcome: "wait"; retryAt: number }>;
  // Told when a list-lag wake is dropped (its window ended), once the loop's other wakes are back in place: the worker ends its give-way when
  // no list-lag wake is left (`pendingWakes`).
  onLagDropped?: (id: string) => void;
  log?: (event: string, data?: Record<string, unknown>) => void;
  // Told when an action throws (the worker logs it at error level and alerts, at most once every 5 minutes; group 2, round 1).
  onActionFailed?: (id: string, label: string, err: unknown) => void;
}

export const LOOK_PUT_OFF_MS = 250;
// Rule 6 (group 2's note to group 1, round 1): an entry whose action threw is not acted on again for 5 s, doubling to 30 s while it keeps
// throwing; one that ends normally resets it.
export const ACTION_FAIL_FIRST_MS = 5_000;
export const ACTION_FAIL_MAX_MS = 30_000;
export const LOOK_FAIL_FIRST_MS = 1_000;
export const LOOK_FAIL_MAX_MS = 10_000;

export interface LoopStats {
  looks: number;
  lagLooks: number;
  failed: number;
  putOff: number;
  waitedForRoom: number;
  actions: number;
  wakes: number;
}
const emptyStats = (): LoopStats => ({ looks: 0, lagLooks: 0, failed: 0, putOff: 0, waitedForRoom: 0, actions: 0, wakes: 0 });

export class ProtectionLoop implements ProtectionHooks {
  private readonly d: LoopDeps;
  private readonly wakes = new Map<string, { at: number; kind: WakeKind; extra: number; until: number }>();
  private readonly running = new Set<string>();
  private readonly actionFail = new Map<string, { delayMs: number; until: number }>();
  private timer: unknown = null;
  private timerAt: number | null = null;
  private looking = false;
  private failDelayMs = 0;
  private failUntil = 0;
  private stopped = false;
  private minute = emptyStats();

  constructor(deps: LoopDeps) {
    this.d = deps;
  }

  busy(id: string): boolean {
    return this.running.has(id);
  }

  // Actions running now (one per entry at most).
  actionsRunning(): number {
    return this.running.size;
  }

  act(id: string, label: string, run: () => Promise<{ recheckAt?: number } | void>): Promise<void> {
    if (this.running.has(id) || this.stopped) return Promise.resolve();
    const failed = this.actionFail.get(id);
    if (failed && this.d.now() < failed.until) {
      this.wake(id, failed.until, "protect"); // decided again when its wait ends
      return Promise.resolve();
    }
    this.running.add(id);
    this.minute.actions++;
    void (async () => {
      try {
        const r = await run();
        this.actionFail.delete(id);
        if (r && r.recheckAt !== undefined) this.wake(id, r.recheckAt, "protect");
      } catch (err) {
        const prev = this.actionFail.get(id);
        const delayMs = prev ? Math.min(prev.delayMs * 2, ACTION_FAIL_MAX_MS) : ACTION_FAIL_FIRST_MS;
        this.actionFail.set(id, { delayMs, until: this.d.now() + delayMs });
        try {
          this.d.onActionFailed?.(id, label, err);
        } catch {
          /* reporting must never break the loop */
        }
        if (!this.d.onActionFailed) this.d.log?.("protection_action_failed", { clientOrderId: id, label, error: (err as Error).message.slice(0, 160), retryInMs: delayMs });
      } finally {
        this.running.delete(id);
        // A wake that came while it ran is looked at now (or at its time).
        if (this.wakes.has(id)) this.arm();
      }
    })();
    return Promise.resolve();
  }

  wake(id: string, atMs: number, kind: WakeKind, extra: { extraRequests?: number; untilMs?: number } = {}): void {
    if (this.stopped) return;
    const cur = this.wakes.get(id);
    this.minute.wakes++;
    // The earliest wake wins; a protection wake is never downgraded to a list-lag one.
    const k: WakeKind = cur && cur.kind === "protect" ? "protect" : kind;
    if (!cur || atMs < cur.at) this.wakes.set(id, { at: atMs, kind: k, extra: extra.extraRequests ?? 0, until: extra.untilMs ?? Infinity });
    else if (k !== cur.kind) cur.kind = k;
    this.arm();
  }

  // Drops an entry's wake (its entry closed).
  forget(id: string): void {
    this.wakes.delete(id);
  }

  private earliest(): number | null {
    let at: number | null = null;
    for (const [id, w] of this.wakes) {
      if (this.running.has(id)) continue;
      if (at === null || w.at < at) at = w.at;
    }
    if (at !== null && at < this.failUntil) at = this.failUntil;
    return at;
  }

  private arm(): void {
    if (this.stopped) return;
    const at = this.earliest();
    if (at === null) {
      this.clear();
      return;
    }
    if (this.timer !== null && this.timerAt !== null && this.timerAt <= at) return;
    this.clear();
    this.timerAt = at;
    this.timer = (this.d.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms)))(() => void this.fire(), Math.max(0, at - this.d.now()));
  }

  private clear(): void {
    if (this.timer !== null) (this.d.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>)))(this.timer);
    this.timer = null;
    this.timerAt = null;
  }

  private async fire(): Promise<void> {
    this.timer = null;
    this.timerAt = null;
    if (this.stopped || this.looking) return;
    const now = this.d.now();
    if (now < this.failUntil) return this.arm();
    const due = new Map<string, { at: number; kind: WakeKind; extra: number; until: number }>();
    for (const [id, w] of this.wakes) {
      if (w.at > now || this.running.has(id)) continue;
      // A list-lag wake past its window is dropped (the regular sync carries on).
      if (w.kind === "lag" && now >= w.until) {
        this.wakes.delete(id);
        this.d.log?.("list_lag_recheck_window_over", { clientOrderId: id, next: "regular sync" });
        this.d.onLagDropped?.(id);
        continue;
      }
      due.set(id, w);
    }
    if (due.size === 0) return this.arm();
    const kind: WakeKind = [...due.values()].every((w) => w.kind === "lag") ? "lag" : "protect";
    const extra = [...due.values()].reduce((n, w) => n + (w.kind === "lag" ? w.extra : 0), 0);
    const lagEnds = [...due.values()].filter((w) => w.kind === "lag").map((w) => w.until);
    const until = lagEnds.length > 0 ? Math.max(...lagEnds) : Infinity;
    const ids = new Set(due.keys());
    // Taken out before the look, so a wake asked for during it (a follow-up, a stuck retry's next time) is kept; put back (the earlier of the
    // two) if the look did not run.
    for (const id of ids) this.wakes.delete(id);
    const putBack = (at: (w: { at: number }) => number): void => {
      for (const [id, w] of due) {
        const cur = this.wakes.get(id);
        const when = at(w);
        if (!cur || when < cur.at) this.wakes.set(id, { ...w, at: when, kind: cur?.kind === "protect" ? "protect" : w.kind });
      }
    };
    this.looking = true;
    let r: Awaited<ReturnType<LoopDeps["look"]>>;
    try {
      r = await this.d.look(ids, kind, extra, until);
    } catch (err) {
      r = { outcome: "failed" };
      this.d.log?.("protection_look_failed", { error: (err as Error).message.slice(0, 160) });
    } finally {
      this.looking = false;
    }
    if (r.outcome === "busy") {
      // A sync or a look is running: a quarter second later (no request meanwhile; the running sync ends on its own).
      this.minute.putOff++;
      putBack(() => this.d.now() + LOOK_PUT_OFF_MS);
      return this.arm();
    }
    if (r.outcome === "wait") {
      // No room in the shared budget for a list-lag look: when room may return (entries give way meanwhile, decision 5 with change A).
      this.minute.waitedForRoom++;
      const retryAt = Math.max(r.retryAt, this.d.now() + 1);
      // A list-lag wake whose window ends before room returns is dropped now (the regular sync carries on); the worker is told once the
      // others are back in place, so it sees any list-lag wake still waiting (group 2, round 2 of part 2).
      const dropped: string[] = [];
      for (const [id, w] of due) {
        if (w.kind === "lag" && retryAt >= w.until) {
          due.delete(id);
          dropped.push(id);
          this.d.log?.("list_lag_recheck_window_over", { clientOrderId: id, next: "regular sync" });
        }
      }
      putBack(() => retryAt);
      for (const id of dropped) this.d.onLagDropped?.(id);
      return this.arm();
    }
    if (r.outcome === "failed") {
      // The wakes it was for are kept and looked at again after the backoff (1 s, doubling to 10 s while looks keep failing), so a stuck
      // sale's retry still comes near its time after a failed read (group 1's finding of fix (a), round 2); a list-lag wake still ends with
      // its window.
      this.minute.failed++;
      this.failDelayMs = this.failDelayMs > 0 ? Math.min(this.failDelayMs * 2, LOOK_FAIL_MAX_MS) : LOOK_FAIL_FIRST_MS;
      this.failUntil = this.d.now() + this.failDelayMs;
      putBack((w) => w.at);
      return this.arm();
    }
    // The due wakes were served (any wake asked for during the look stays). An idle look (outside the session) read nothing: not counted.
    this.failDelayMs = 0;
    this.failUntil = 0;
    if (r.outcome !== "idle") {
      this.minute.looks++;
      if (kind === "lag") this.minute.lagLooks++;
    }
    this.arm();
  }

  // When the next look is due (null when none), for the statistics and tests.
  nextLookAt(): number | null {
    return this.earliest();
  }
  pendingWakes(): ReadonlyMap<string, { at: number; kind: WakeKind }> {
    return this.wakes;
  }

  takeMinute(): LoopStats & { pendingWakes: number; actionsRunning: number } {
    const out = { ...this.minute, pendingWakes: this.wakes.size, actionsRunning: this.running.size };
    this.minute = emptyStats();
    return out;
  }

  stop(): void {
    this.stopped = true;
    this.clear();
  }
}
