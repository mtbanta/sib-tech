// PROTECT FIRST (Michael's night build request of 2026-11-16, item 2: "Protect-first, designed properly: while any position lacks a
// confirmed stop, new entries stop and low-priority work gives way, with a time limit of about 30 s, after which entries resume at a
// reduced rate.").
//
//  - An entry is marked as lacking a confirmed stop when the live updates report both its exits lost, a remainder's stop cancelled at a
//    partial take-profit, a fresh stop of ours ended, or a load entry filled after its 5 second cancel; when the order sync's walk finds it
//    with no live exit or a bare remainder; while it is on the stuck list; and while its fresh stop's status is still unclear.
//  - A mark clears only on news newer than the mark: a live update after it that left the symbol at 0 shares, a positions read that
//    started after it and does not show the symbol (the account view's or the order sync's own), the walk finding the entry's exits live
//    with no bare remainder, or its fresh stop confirmed (any status from Alpaca other than unclear, not a stop that hit the 15 second
//    limit) while it is not stuck. An older view never clears a mark.
//  - While any mark is in force: for the first PROTECT_FIRST_LIMIT_MS (30 s) of the episode, the gate refuses every new entry and the shared
//    request budget refuses every P2 try (the list-lag rechecks and a confirmed fresh stop's periodic lookups). After that, entries resume
//    at a reduced rate (at most one every PROTECT_FIRST_REDUCED_GAP_MS, 2 s, and never above the day's approved limit, which the governor
//    still holds) and P2 resumes, until every mark has cleared. Urgent sale work (P1), first tries and routine reads are never refused here.
//  - An episode ends when no mark is left; a mark after that starts a new episode with a new 30 s. Marks that keep overlapping stay in one
//    episode, so the pause can never last longer than 30 s at a time.
// Nothing here sends, cancels or sizes an order and nothing here retries: it is a state read by the gate and the request budget. Its
// memory is bounded: one mark per open entry (at most MAX_MARKS), and the ids last cleared as sold only while their stuck or fresh-stop
// record lasts.

// THE SWITCH (night build of 2026-11-16, decision after the simulation of protect-first against v24): OFF. Measured with jittered
// runs, protect-first beat v24 when Alpaca accepts the sales, but was worse in 7 or 8 of 18 refused-sale cells at every refusal length
// tried (25, 30 and 40 s). It speeds the sales up, so their tries fall inside Alpaca's refusal and the next try lands later. The fixes
// lie in the sale queue and the stuck backoff, outside item 2, and go to Michael. While off: no mark is kept, no protect_first event is
// stored, the gate never refuses for it and P2 never gives way for it. Switching it on is this one line (the tests set it).
export const PROTECT_FIRST = { on: false };
export const PROTECT_FIRST_LIMIT_MS = 30_000;
// The reduced rate after the 30 s: one entry every 2 seconds (30 a minute). Builder's choice for Michael to confirm (night build of
// 2026-11-16): a load entry costs about 2 of Alpaca's 200 requests a minute (the order and its 5 second cancel), so 30 entries a minute
// use about 60, leaving about 140 for the sales, cancels and the order sync; half of a load day's 150 would use about 150 and leave too
// little.
export const PROTECT_FIRST_REDUCED_GAP_MS = 2_000;
export const MAX_MARKS = 500;

// The refusal reasons fit the daily summary's 70 characters (group 2, night build round 1): "protecting positions first" means a held
// position has no confirmed protective stop.
export const PROTECT_FIRST_PAUSED = "protecting positions first: no new entries for up to 30 s";
export const PROTECT_FIRST_REDUCED = "protecting positions first: entries at one every 2 s";

export type ProtectFirstPhase = "off" | "paused" | "reduced";

export interface ProtectFirstDeps {
  now: () => number;
  // Whether the symbol is held according to news newer than `sinceMs` (true held, false not held), or null when there is no such news.
  heldSince: (symbol: string, sinceMs: number) => boolean | null;
  // The order sync's memory (read only).
  stuck: ReadonlyMap<string, { symbol: string }>;
  freshStops: ReadonlyMap<string, { symbol: string; status: string; stopClientOrderId: string }>;
  timedOutStops: ReadonlyMap<string, string>;
  log?: (event: string, data?: Record<string, unknown>) => void;
}

export class ProtectFirst {
  private readonly d: ProtectFirstDeps;
  private readonly marks = new Map<string, { symbol: string; since: number; why: string }>();
  // Entries cleared because their shares were found gone, so a stuck or unclear record still in memory does not mark them again.
  private readonly soldIds = new Set<string>();
  private episodeStart: number | null = null;
  private limitLogged = false;
  private lastEntryAt = -Infinity;
  private episode = { entryRefusals: 0, p2Refusals: 0 };
  readonly totals = { episodes: 0, limitReached: 0, entryRefusals: 0, p2Refusals: 0 };

  constructor(d: ProtectFirstDeps) {
    this.d = d;
  }

  // An entry lacks a confirmed stop (`why`: what said so). A mark already in force keeps its time.
  mark(entryClientOrderId: string, symbol: string, why: string): void {
    if (!PROTECT_FIRST.on) return;
    this.soldIds.delete(entryClientOrderId);
    if (this.marks.has(entryClientOrderId)) return;
    if (this.marks.size >= MAX_MARKS) return;
    this.marks.set(entryClientOrderId, { symbol, since: this.d.now(), why });
    this.refresh();
  }

  // The walk found the entry protected (its exits live, no bare remainder).
  protectedNow(entryClientOrderId: string): void {
    if (this.marks.delete(entryClientOrderId)) this.refresh();
  }

  // The order sync's own positions read (started at `readStartedMs`): marks older than it whose symbol it does not show are sold.
  positionsRead(heldQty: ReadonlyMap<string, number>, readStartedMs: number): void {
    let changed = false;
    for (const [id, m] of [...this.marks]) {
      if (m.since < readStartedMs && !((heldQty.get(m.symbol) ?? 0) > 1e-9)) {
        this.marks.delete(id);
        this.soldIds.add(id);
        changed = true;
      }
    }
    if (changed) this.refresh();
  }

  // Re-evaluates the marks and the episode, logging its start, its 30 s limit and its end. Returns the phase.
  refresh(): ProtectFirstPhase {
    if (!PROTECT_FIRST.on) return "off";
    const now = this.d.now();
    for (const id of [...this.soldIds]) if (!this.d.stuck.has(id) && !this.d.freshStops.has(id)) this.soldIds.delete(id);
    for (const [id, st] of this.d.stuck) if (!this.soldIds.has(id) && !this.marks.has(id) && this.marks.size < MAX_MARKS) this.marks.set(id, { symbol: st.symbol, since: now, why: "on the stuck list" });
    for (const [id, f] of this.d.freshStops) if (f.status === "unclear" && !this.soldIds.has(id) && !this.marks.has(id) && this.marks.size < MAX_MARKS) this.marks.set(id, { symbol: f.symbol, since: now, why: "fresh stop unclear" });
    for (const [id, m] of [...this.marks]) {
      const held = this.d.heldSince(m.symbol, m.since);
      if (held === false) {
        this.marks.delete(id);
        this.soldIds.add(id);
        continue;
      }
      const f = this.d.freshStops.get(id);
      if (f && f.status !== "unclear" && !this.d.timedOutStops.has(f.stopClientOrderId) && !this.d.stuck.has(id)) this.marks.delete(id);
    }
    if (this.marks.size > 0) {
      if (this.episodeStart === null) {
        this.episodeStart = now;
        this.limitLogged = false;
        this.totals.episodes++;
        this.episode = { entryRefusals: 0, p2Refusals: 0 };
        this.d.log?.("protect_first_started", { symbols: this.symbols(), reasons: [...new Set([...this.marks.values()].map((m) => m.why))] });
      } else if (!this.limitLogged && now - this.episodeStart >= PROTECT_FIRST_LIMIT_MS) {
        this.limitLogged = true;
        this.totals.limitReached++;
        this.d.log?.("protect_first_limit_reached", { symbols: this.symbols(), afterMs: now - this.episodeStart, reducedGapMs: PROTECT_FIRST_REDUCED_GAP_MS });
      }
      return now - this.episodeStart >= PROTECT_FIRST_LIMIT_MS ? "reduced" : "paused";
    }
    if (this.episodeStart !== null) {
      this.d.log?.("protect_first_ended", { durationMs: now - this.episodeStart, limitReached: this.limitLogged, entriesRefused: this.episode.entryRefusals, p2Refused: this.episode.p2Refusals });
      this.episodeStart = null;
      this.limitLogged = false;
    }
    return "off";
  }

  // The gate, before an entry: the refusal reason, or null. `recheck` (just before sending): only the paused phase refuses, since the
  // reduced rate's slot was taken when the entry passed the governor.
  entryRefusal(recheck = false): string | null {
    if (!PROTECT_FIRST.on) return null;
    const phase = this.refresh();
    if (phase === "paused") {
      this.totals.entryRefusals++;
      this.episode.entryRefusals++;
      return PROTECT_FIRST_PAUSED;
    }
    if (phase === "reduced" && !recheck && this.d.now() - this.lastEntryAt < PROTECT_FIRST_REDUCED_GAP_MS) {
      this.totals.entryRefusals++;
      this.episode.entryRefusals++;
      return PROTECT_FIRST_REDUCED;
    }
    return null;
  }

  // The gate: an entry passed the governor (its slot under the reduced rate is taken).
  entryAdmitted(): void {
    this.lastEntryAt = this.d.now();
  }

  // The shared request budget, before a P2 try: true while P2 gives way (the paused phase only).
  p2GivesWay(): boolean {
    if (!PROTECT_FIRST.on) return false;
    if (this.refresh() !== "paused") return false;
    this.totals.p2Refusals++;
    this.episode.p2Refusals++;
    return true;
  }

  phase(): ProtectFirstPhase {
    return this.refresh();
  }

  marked(): string[] {
    return [...this.marks.keys()];
  }

  private symbols(): string[] {
    return [...new Set([...this.marks.values()].map((m) => m.symbol))].slice(0, 30);
  }
}
