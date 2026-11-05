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

  constructor(broker: BrokerView["broker"], now: () => number = Date.now) {
    this.broker = broker;
    this.now = now;
  }

  // Account and positions: the two things that change as the stack trades.
  async refreshFast(): Promise<void> {
    const [account, positions] = await Promise.all([this.broker.getAccount(), this.broker.listPositions()]);
    this.account = account;
    this.positions = positions;
    this.fastAt = this.now();
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
  // "already holding" clears without waiting for the next refresh). Only ever removes; the next refresh brings back what Alpaca shows.
  dropPosition(symbol: string): void {
    if (this.positions) this.positions = this.positions.filter((p) => p.symbol !== symbol);
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
