// The daily summary posted after the close: trades, profit or loss, borrowing used, refused orders.
import type { Account, Order } from "./alpaca-trading.ts";
import { describeLimits } from "./limits.ts";
import type { DayRecord, OrderRecord, RefusalRecord, StopFlag } from "./store.ts";
import { NOT_ADVICE } from "./discord.ts";

export interface TradeLine {
  symbol: string;
  qty: number;
  entry: number | null;
  exit: number | null;
  pnl: number | null;
  state: string;
}

export interface SummaryInput {
  day: DayRecord;
  stored: OrderRecord[];
  refusals: RefusalRecord[];
  alpacaOrders: Order[];
  account: Account;
  peak: { exposureUsd: number; equity: number; ratio: number } | null;
  stop: StopFlag | null;
  flat: boolean | null; // null = not known
}

const flatten = (orders: Order[]): Order[] => orders.flatMap((o) => [o, ...flatten(o.legs)]);
const money = (x: number) => `${x >= 0 ? "+" : "-"}${Math.abs(x).toFixed(2)}`;

export function tradeLines(stored: OrderRecord[], alpacaOrders: Order[]): TradeLine[] {
  const all = flatten(alpacaOrders);
  const lines: TradeLine[] = [];
  for (const s of stored) {
    if (s.status === "failed" || s.status === "rejected" || s.status === "canceled" || !s.filledQty || s.filledAvgPrice === null) {
      lines.push({ symbol: s.symbol, qty: s.qty, entry: s.filledAvgPrice, exit: null, pnl: null, state: s.status });
      continue;
    }
    const sells = all.filter((o) => o.side === "sell" && o.symbol === s.symbol && o.filledQty > 0 && o.filledAvgPrice !== null);
    const sold = sells.reduce((n, o) => n + o.filledQty, 0);
    const exit = sold > 0 ? sells.reduce((n, o) => n + o.filledQty * o.filledAvgPrice!, 0) / sold : null;
    const closedQty = Math.min(sold, s.filledQty);
    lines.push({
      symbol: s.symbol,
      qty: s.filledQty,
      entry: s.filledAvgPrice,
      exit,
      pnl: exit === null ? null : (exit - s.filledAvgPrice) * closedQty,
      state: sold >= s.filledQty ? "closed" : "STILL OPEN",
    });
  }
  return lines;
}

export function formatSummary(i: SummaryInput): string {
  const head = `**Daily summary for ${i.day.tradeDate}**`;
  if (!i.day.isTradingDay) return `${head}\nNot a trading day.\n${NOT_ADVICE}`;
  if (i.day.status !== "approved") {
    return `${head}\nNo trading today: the limits were not all decided before the open. Equity ${i.account.equity.toFixed(2)}.\n${NOT_ADVICE}`;
  }
  const trades = tradeLines(i.stored, i.alpacaOrders);
  const realized = trades.reduce((n, t) => n + (t.pnl ?? 0), 0);
  const change = i.day.dayStartEquity === null ? null : i.account.equity - i.day.dayStartEquity;
  const reasons = new Map<string, number>();
  for (const r of i.refusals) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
  const lines = [
    head,
    `Limits: ${describeLimits(i.day.limits)}`,
    `Entries: ${trades.length}`,
    ...trades.map((t) => `- ${t.symbol} ${t.qty} shares, in ${t.entry?.toFixed(2) ?? "?"}, out ${t.exit?.toFixed(2) ?? "?"}, ${t.pnl === null ? t.state : `${money(t.pnl)} (${t.state})`}`),
    `Profit or loss: ${money(realized)} from closed trades${change === null ? "" : `; account equity ${i.day.dayStartEquity!.toFixed(2)} to ${i.account.equity.toFixed(2)} (${money(change)})`}`,
    i.peak ? `Borrowing used: peak exposure ${i.peak.exposureUsd.toFixed(0)} dollars, ${i.peak.ratio.toFixed(2)} times equity (approved cap ${i.day.limits.borrowingCap})` : "Borrowing used: no entries, none",
    `Refused entries: ${i.refusals.length}${i.refusals.length ? ` (${[...reasons].map(([r, n]) => `${r}: ${n}`).join("; ")})` : ""}`,
    `Stop flag: ${i.stop?.on ? `ON (${i.stop.reason})` : "off"}. End of day: ${i.flat === null ? "flat status not checked" : i.flat ? "flat" : "**NOT FLAT**"}.`,
    NOT_ADVICE,
  ];
  return lines.join("\n");
}
