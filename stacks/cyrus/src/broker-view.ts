// A short-lived copy of the broker's account, positions, settings and clock, so that sending an entry does not
// cost four requests to Alpaca. Alpaca allows 200 requests a minute and a busy day must keep most of them for safety.
// The worker refreshes it every few seconds in the background; the gate asks for a snapshot no older than a limit,
// and a snapshot that is too old is refreshed first (or the entry is refused: it never trades on stale data).
import type { Account, AccountConfig, Clock, Position } from "./alpaca-trading.ts";
import type { Broker } from "./broker.ts";
import type { Governor } from "./governor.ts";

export interface Snapshot {
  account: Account;
  positions: Position[];
  config: AccountConfig;
  clock: Clock;
}

export class BrokerView {
  private readonly broker: Pick<Broker, "getAccount" | "listPositions" | "getAccountConfig" | "getClock">;
  private readonly now: () => number;
  private account: Account | null = null;
  private positions: Position[] | null = null;
  private config: AccountConfig | null = null;
  private clock: Clock | null = null;
  private fastAt = 0;
  private configAt = 0;
  private clockAt = 0;
  // The speed release, item 8: the share count Alpaca's live order updates gave last for each symbol, and when. A read of the
  // positions that STARTED before such an update is overlaid with it, so the read (which may be older than the update) cannot bring
  // back a position an exit just closed, or hide one an entry just opened. Updates older than a minute are forgotten.
  private fromUpdates = new Map<string, { qty: number; price: number | null; at: number }>();

  constructor(broker: BrokerView["broker"], now: () => number = Date.now) {
    this.broker = broker;
    this.now = now;
  }

  // Account and positions: the two things that change as the stack trades.
  async refreshFast(): Promise<void> {
    const started = this.now();
    const [account, positions] = await Promise.all([this.broker.getAccount(), this.broker.listPositions()]);
    this.account = account;
    this.positions = positions;
    for (const [symbol, u] of [...this.fromUpdates]) {
      if (started - u.at > 60_000) this.fromUpdates.delete(symbol);
      else if (u.at >= started) this.apply(symbol, u.qty, u.price);
    }
    this.fastAt = this.now();
  }

  private apply(symbol: string, qty: number, price: number | null): void {
    if (!this.positions) return;
    const rest = this.positions.filter((p) => p.symbol !== symbol);
    if (!(qty > 1e-9)) {
      this.positions = rest;
      return;
    }
    const was = this.positions.find((p) => p.symbol === symbol);
    const perShare = price ?? (was && was.qty > 0 ? was.marketValue / was.qty : 0);
    this.positions = [...rest, { symbol, qty, qtyAvailable: null, marketValue: qty * perShare, avgEntryPrice: was?.avgEntryPrice ?? perShare, unrealizedPl: was?.unrealizedPl ?? 0 }];
  }

  // Item 8: a fill's share count from the live order updates (0 drops the symbol). Remembered so the next read cannot undo it.
  setPositionFromUpdate(symbol: string, qty: number, price: number | null): void {
    this.fromUpdates.set(symbol, { qty, price, at: this.now() });
    this.apply(symbol, qty, price);
  }
  async refreshConfig(): Promise<void> {
    this.config = await this.broker.getAccountConfig();
    this.configAt = this.now();
  }
  async refreshClock(): Promise<void> {
    this.clock = await this.broker.getClock();
    this.clockAt = this.now();
  }

  // Forget what we hold, after the stack itself changed the account (a setting changed, a liquidation).
  invalidate(): void {
    this.fastAt = 0;
    this.configAt = 0;
  }

  // Release B: Alpaca's live order updates said this symbol is now 0 shares, so the cached positions drop it at once (the gate's
  // "already holding" clears without waiting for the next refresh). A read that started before the update cannot bring it back
  // (item 8); a read that started after it shows what Alpaca shows.
  dropPosition(symbol: string): void {
    this.setPositionFromUpdate(symbol, 0, null);
  }

  // The positions as last seen (with the live updates applied), or null before the first read. For the shadow loss-stop estimate.
  cachedPositions(): Position[] | null {
    return this.positions;
  }

  // The account as last read, or null before the first read. For the shadow loss-stop estimate's book (read only).
  cachedAccount(): Account | null {
    return this.account;
  }

  fastAgeMs(): number {
    return this.account && this.positions ? this.now() - this.fastAt : Infinity;
  }

  // The positions as last seen, if no older than maxAgeMs, else read fresh.
  async freshPositions(maxAgeMs: number): Promise<Position[]> {
    if (this.fastAgeMs() > maxAgeMs) await this.refreshFast();
    return this.positions!;
  }

  // Would a snapshot with these limits have to ask Alpaca for something?
  stale(limits: { fastMs: number; configMs: number; clockMs: number }): boolean {
    return this.fastAgeMs() > limits.fastMs || !this.config || this.now() - this.configAt > limits.configMs || !this.clock || this.now() - this.clockAt > limits.clockMs;
  }

  // Everything an entry decision needs, none of it older than the limits. Refreshes whichever part is too old.
  async snapshot(limits: { fastMs: number; configMs: number; clockMs: number }): Promise<Snapshot> {
    const jobs: Promise<void>[] = [];
    if (this.fastAgeMs() > limits.fastMs) jobs.push(this.refreshFast());
    if (!this.config || this.now() - this.configAt > limits.configMs) jobs.push(this.refreshConfig());
    if (!this.clock || this.now() - this.clockAt > limits.clockMs) jobs.push(this.refreshClock());
    if (jobs.length > 0) await Promise.all(jobs);
    return { account: this.account!, positions: this.positions!, config: this.config!, clock: this.clock! };
  }
}

export type { Governor };
