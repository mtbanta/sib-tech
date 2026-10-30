// THE ORDER GATE. The only code in the worker that may send an entry order. Every entry passes, in order:
//   1. the stop flag, read fresh from the database
//   2. the morning approval (no approved limits today means no entry)
//   3. the fixed limit checks in limits.ts
//   4. the broker's own switches (long only, borrowing cap no higher than approved)
//   5. a record of the intent in the database, with an id built from the date and the symbol, so a restart
//      or a retry cannot send the same entry twice
//   6. the stop flag again, immediately before sending
// and then the order is sent with a protective stop held at Alpaca. If the database or the broker cannot be
// read, the entry is refused: the stack fails closed. Calls are handled one at a time.
import type { GateBroker } from "./broker.ts";
import { checkEntry, type EntryContext } from "./limits.ts";
import { CONTROL_STOP, type OrderRecord, type StopFlag, type Store } from "./store.ts";
import type { Signal } from "./strategy.ts";
import { etDate, minutesBetween } from "./time.ts";
import { NOT_ADVICE } from "./discord.ts";

export type GateResult =
  | { status: "sent"; clientOrderId: string; qty: number }
  | { status: "refused"; reason: string }
  | { status: "error"; reason: string };

export interface GateDeps {
  broker: GateBroker;
  store: Store;
  now: () => Date;
  say: (channel: "commands" | "trading" | "alerts", text: string) => Promise<boolean>;
  log?: (event: string, data?: Record<string, unknown>) => void;
}

export const peakKey = (date: string) => `peak_exposure:${date}`;

export function clientOrderIdFor(date: string, symbol: string): string {
  return `cyrus-${date.replaceAll("-", "")}-${symbol}`;
}

export class OrderGate {
  private readonly d: GateDeps;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(deps: GateDeps) {
    this.d = deps;
  }

  // One entry at a time, so two signals cannot both pass the same trades-a-day check.
  enter(signal: Signal): Promise<GateResult> {
    const run = this.chain.then(() => this.run(signal));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async refuse(date: string, symbol: string, reason: string, detail?: Record<string, unknown>, record = true): Promise<GateResult> {
    this.d.log?.("entry_refused", { symbol, reason, ...detail });
    if (record) {
      try {
        await this.d.store.addRefusal({ tradeDate: date, symbol, reason, detail });
      } catch {
        /* the refusal still stands even if it cannot be written down */
      }
    }
    return { status: "refused", reason };
  }

  private async run(signal: Signal): Promise<GateResult> {
    const now = this.d.now();
    const date = etDate(now);
    const symbol = signal.symbol;

    let stop: StopFlag | null;
    let day;
    try {
      stop = await this.d.store.getControl<StopFlag>(CONTROL_STOP);
      day = await this.d.store.getDay(date);
    } catch {
      return this.refuse(date, symbol, "database unavailable, so no entry", undefined, false);
    }
    const limits = day && day.status === "approved" ? day.limits : null;
    if (!day || !day.openAt || !day.closeAt) {
      return this.refuse(date, symbol, limits ? "no session times for today" : "no limits approved for today");
    }

    let clock, account, positions, config, orders;
    try {
      [clock, account, positions, config, orders] = await Promise.all([
        this.d.broker.getClock(),
        this.d.broker.getAccount(),
        this.d.broker.listPositions(),
        this.d.broker.getAccountConfig(),
        this.d.store.listOrders(date),
      ]);
    } catch {
      return this.refuse(date, symbol, "broker or database unavailable, so no entry", undefined, false);
    }

    const held = new Set(positions.map((p) => p.symbol));
    const countable = orders.filter((o) => o.status !== "failed" && o.status !== "rejected");
    const pendingExposure = orders.filter((o) => (o.status === "intent" || o.status === "submitted") && !held.has(o.symbol)).reduce((s, o) => s + o.qty * o.referencePrice, 0);
    const ctx: EntryContext = {
      symbol,
      price: signal.price,
      limits,
      stopFlag: stop?.on === true,
      marketOpen: clock.isOpen,
      minutesSinceOpen: minutesBetween(day.openAt, now),
      minutesToClose: minutesBetween(now, day.closeAt),
      tradesToday: countable.length,
      symbolsTradedToday: new Set(orders.map((o) => o.symbol)),
      heldSymbols: held,
      dayStartEquity: day.dayStartEquity ?? account.lastEquity,
      equity: account.equity,
      grossExposure: positions.reduce((s, p) => s + Math.abs(p.marketValue), 0) + pendingExposure,
      priceAgeSeconds: (now.getTime() - signal.tradeTime.getTime()) / 1000,
    };
    const decision = checkEntry(ctx);
    if (!decision.ok) return this.refuse(date, symbol, decision.reason, { price: signal.price });

    // The broker's own switches must match what Michael approved: long only, cap no higher than approved.
    if (account.status !== "ACTIVE" || account.tradingBlocked || account.accountBlocked || config.suspendTrade) {
      return this.refuse(date, symbol, "the Alpaca account is not active for trading");
    }
    if (!config.noShorting || config.maxMarginMultiplier > limits!.borrowingCap) {
      try {
        await this.d.broker.setAccountConfig({ noShorting: true, maxMarginMultiplier: limits!.borrowingCap });
      } catch {
        return this.refuse(date, symbol, "could not set long only and the approved borrowing cap at Alpaca");
      }
    }
    if (!(signal.stopPrice > 0 && signal.stopPrice < signal.price)) return this.refuse(date, symbol, "protective stop is not below the price");

    const clientOrderId = clientOrderIdFor(date, symbol);
    const record: OrderRecord = { clientOrderId, tradeDate: date, symbol, qty: decision.qty, referencePrice: signal.price, stopPrice: signal.stopPrice, status: "intent", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null };
    let inserted: boolean;
    try {
      inserted = await this.d.store.insertOrder(record);
    } catch {
      return this.refuse(date, symbol, "database unavailable, so no entry", undefined, false);
    }
    if (!inserted) return this.refuse(date, symbol, "already decided this symbol today", undefined, false);

    // Last look at the stop flag before the order leaves.
    try {
      const again = await this.d.store.getControl<StopFlag>(CONTROL_STOP);
      if (again?.on) {
        await this.d.store.updateOrder(clientOrderId, { status: "canceled", note: "stop flag set before sending" });
        return this.refuse(date, symbol, "stop flag is set");
      }
    } catch {
      await this.d.store.updateOrder(clientOrderId, { status: "canceled", note: "database unavailable before sending" }).catch(() => undefined);
      return this.refuse(date, symbol, "database unavailable, so no entry", undefined, false);
    }

    try {
      const sent = await this.d.broker.submitEntry({ symbol, qty: decision.qty, stopPrice: signal.stopPrice, referencePrice: signal.price, clientOrderId });
      await this.d.store.updateOrder(clientOrderId, { status: "submitted", alpacaOrderId: sent.id });
      await this.notePeak(date, ctx.grossExposure + decision.notional, account.equity);
      this.d.log?.("entry_sent", { symbol, qty: decision.qty, stop: signal.stopPrice });
      await this.d.say("trading", `Entry sent (paper): BUY ${decision.qty} ${symbol} at about ${signal.price.toFixed(2)}, protective stop at ${signal.stopPrice.toFixed(2)} held at Alpaca. ${NOT_ADVICE}`);
      return { status: "sent", clientOrderId, qty: decision.qty };
    } catch (err) {
      const reason = (err as Error).message.slice(0, 200);
      await this.d.store.updateOrder(clientOrderId, { status: "failed", note: reason }).catch(() => undefined);
      await this.d.say("commands", `Entry for ${symbol} failed at Alpaca and was not retried: ${reason}`);
      return { status: "error", reason };
    }
  }

  // Remembers the day's highest exposure, for the daily summary's "borrowing used".
  private async notePeak(date: string, exposureUsd: number, equity: number): Promise<void> {
    try {
      const prev = await this.d.store.getControl<{ exposureUsd: number }>(peakKey(date));
      if (!prev || exposureUsd > prev.exposureUsd) await this.d.store.setControl(peakKey(date), { exposureUsd, equity, ratio: exposureUsd / equity });
    } catch {
      /* the summary just shows what it knows */
    }
  }
}
