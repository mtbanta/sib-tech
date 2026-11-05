// THE LOAD WINDOW'S 60 SECOND TIME LIMIT (release B, approved by Michael on 2026-11-04 with a guard).
//
// A load day entry made in the window (8:45 to 9:00 AM Central) that is still open 60 seconds after its fill has its take-profit
// leg's limit price lowered to a price that sells at once (load-mode.ts timeLimitPrice), through the sell gate (sells.ts
// lowerTakeProfit). On Wednesday's prints this frees slow names (an ADT-like name held one entry from 8:45 to the close) and, in
// the replay, lifted the minutes at 90 or more entries from 10 to 13 of 15.
//
// Michael's guard:
//   - one attempt per entry, remembered (also in the database, so a restart does not try again): no retry loop;
//   - if Alpaca refuses the change, or it stalls (no answer within the request's 10 second limit, or the leg still unchanged and
//     unfilled at the next order sync), the position keeps its existing stop and take-profit; it is logged and counted;
//   - only the price is sent, never a quantity, and the sell gate refuses unless the leg's unfilled shares are no more than the
//     shares held, so it cannot oversell;
//   - it never touches the stop, and it does nothing to an entry whose stop is not live (release A's bare-remainder rule sells such
//     a remainder), so it cannot leave a position without a stop.
// It reads Alpaca's view of each entry from the order sync's memory (no extra lookups) and uses 2 requests an attempt (the position
// check and the change). It holds back while Alpaca's request budget is at the safety reserve.
import type { Governor } from "./governor.ts";
import { LOAD_TIME_LIMIT_MS, isLoadDay, loadWindow, timeLimitPrice } from "./load-mode.ts";
import { stopLeg, type SyncMemory } from "./risk.ts";
import { OPEN_STATUSES, type SellGate } from "./sells.ts";
import type { DayRecord, Store } from "./store.ts";

export const timeLimitKey = (date: string) => `time_limit:${date}`;

export interface TimeLimitState {
  attempted: string[];
  attempts: number;
  changed: number;
  refused: number;
  stalled: number;
}

export interface TimeLimitDeps {
  store: Store;
  sellGate: Pick<SellGate, "lowerTakeProfit">;
  governor: Pick<Governor, "canSpend">;
  memory: SyncMemory;
  now: () => Date;
  // The last trade price seen for a symbol (from the live prices), or null.
  lastPrice: (symbol: string) => number | null;
  log?: (event: string, data?: Record<string, unknown>) => void;
}

const empty = (): TimeLimitState => ({ attempted: [], attempts: 0, changed: 0, refused: 0, stalled: 0 });

export class TimeLimit {
  private readonly d: TimeLimitDeps;
  private date: string | null = null;
  private state: TimeLimitState = empty();
  private attempted = new Set<string>();
  // Changes Alpaca accepted, waiting for the next order sync to show them: client id -> when, which leg, its old price.
  private readonly pending = new Map<string, { at: number; legId: string; oldLimit: number | null }>();

  constructor(deps: TimeLimitDeps) {
    this.d = deps;
  }

  stats(): Omit<TimeLimitState, "attempted"> {
    const { attempted: _a, ...rest } = this.state;
    return rest;
  }

  attemptedIds(): string[] {
    return [...this.attempted];
  }

  private async load(date: string): Promise<void> {
    if (this.date === date) return;
    const saved = await this.d.store.getControl<TimeLimitState>(timeLimitKey(date)).catch(() => null);
    this.state = saved ? { ...empty(), ...saved } : empty();
    this.attempted = new Set(this.state.attempted);
    this.pending.clear();
    this.date = date;
  }

  private async save(): Promise<void> {
    this.state.attempted = [...this.attempted];
    await this.d.store.setControl(timeLimitKey(this.date!), this.state).catch(() => undefined);
  }

  // One pass. `allowed` is false while a close-out or any liquidation runs, and from the close-out time on.
  async run(day: DayRecord, allowed: () => boolean): Promise<void> {
    if (!isLoadDay(day)) return;
    const w = loadWindow(day);
    if (!w) return;
    await this.load(day.tradeDate);
    const nowMs = this.d.now().getTime();
    const mem = this.d.memory;

    // A change Alpaca accepted that the next sync still shows unchanged and unfilled has stalled: counted once, nothing more.
    for (const [id, p] of [...this.pending]) {
      if (mem.lastSyncAt <= p.at) continue;
      this.pending.delete(id);
      const o = mem.lastSeen.get(id);
      const leg = o?.legs.find((l) => l.id === p.legId);
      if (leg && OPEN_STATUSES.has(leg.status) && leg.status !== "pending_replace" && leg.limitPrice === p.oldLimit && leg.filledQty < leg.qty - 1e-9) {
        this.state.stalled++;
        this.d.log?.("time_limit_stalled", { symbol: o!.symbol });
        await this.save();
      }
    }

    const rows = (await this.d.store.listOrders(day.tradeDate)).filter((r) => !r.closedAt && r.status === "filled" && r.createdAt && Date.parse(r.createdAt) >= w.start.getTime() && Date.parse(r.createdAt) < w.end.getTime());
    for (const r of rows) {
      if (this.attempted.has(r.clientOrderId)) continue;
      const o = mem.lastSeen.get(r.clientOrderId);
      if (!o || o.status !== "filled" || !o.filledAt || nowMs - Date.parse(o.filledAt) < LOAD_TIME_LIMIT_MS) continue;
      const tp = o.legs.find((l) => l.side === "sell" && l.type === "limit" && OPEN_STATUSES.has(l.status) && l.status !== "pending_cancel" && l.status !== "pending_replace");
      const stop = stopLeg(o);
      // Never without a live stop beside it: then the position is release A's bare-remainder rule's to sell, not this.
      if (!tp || !stop || !OPEN_STATUSES.has(stop.status) || stop.status === "pending_cancel") continue;
      if (!allowed()) return;
      if (!this.d.governor.canSpend()) return; // the safety reserve is for sells and cancels; try again on a later pass
      const candidates = [timeLimitPrice(this.d.lastPrice(o.symbol) ?? NaN), tp.limitPrice !== null ? timeLimitPrice(tp.limitPrice) : null].filter((x): x is number => x !== null);
      if (candidates.length === 0) continue;
      const price = Math.min(...candidates);
      this.attempted.add(r.clientOrderId);
      this.state.attempts++;
      const res = await this.d.sellGate.lowerTakeProfit({ symbol: o.symbol, legId: tp.id, legRemaining: tp.qty - tp.filledQty, currentLimit: tp.limitPrice, limitPrice: price });
      let outcome: string;
      if (res.status === "changed") {
        this.state.changed++;
        this.pending.set(r.clientOrderId, { at: this.d.now().getTime(), legId: tp.id, oldLimit: tp.limitPrice });
        outcome = "changed";
      } else if (res.status === "refused" || (res.httpStatus !== undefined && res.httpStatus >= 400 && res.httpStatus < 500 && res.httpStatus !== 429)) {
        this.state.refused++;
        outcome = "refused";
      } else {
        this.state.stalled++; // no clear answer (a time-out, a server error): the outcome is unknown, so it is not tried again
        outcome = "stalled";
      }
      this.d.log?.("time_limit", { symbol: o.symbol, outcome, price, ...(res.status !== "changed" ? { reason: res.reason.slice(0, 120) } : {}) });
      await this.save();
    }
  }
}
