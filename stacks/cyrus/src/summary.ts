// The daily summary posted after the close. It has to stay readable on a day with thousands of trades, so it reports
// totals, a handful of symbols, speed, fees and request use, not one line per trade.
import type { Account, Order } from "./alpaca-trading.ts";
import { estimateFees, tafActive, type Fill, type FeeEstimate } from "./fees.ts";
import { describeLimits } from "./limits.ts";
import type { DayRecord, OrderRecord, RefusalRecord, StopFlag } from "./store.ts";
import { flattenLegs } from "./sells.ts";
import { centralClock } from "./time.ts";
import { loadWindowRules } from "./load-mode.ts";

export interface SummaryInput {
  day: DayRecord;
  stored: OrderRecord[];
  refusals: RefusalRecord[];
  alpacaOrders: Order[];
  account: Account;
  peak: { exposureUsd: number; equity: number; ratio: number } | null;
  stop: StopFlag | null;
  flat: boolean | null; // null = not known
  requests?: { requestsLastMinute: number; lowestBudget: number | null; peakTradesPerMinute: number; refusedByGovernor: number; rateLimitAnswers?: number } | null;
  feesRunning?: number | null;
  listComplete?: boolean;
  // A load day (load-mode.ts): the window is reported apart from the rest of the day.
  loadWindow?: { start: Date; end: Date } | null;
  // A load day: the window's settings and Alpaca's live order updates.
  loadExtras?: {
    orderStream: { events: number; freed: number; reconnects: number; medianFreeMs: number | null } | null;
    // The speed release: window entries that were limit buys and were cancelled unfilled after the wait.
    entryExpiry?: { scheduled: number; cancelled: number; filledFirst: number; failed: number } | null;
  } | null;
  // The speed release (Michael's decision 3): the shares sold 3 seconds after Alpaca cancelled their stop, against waiting 5 more seconds.
  stopGap?: StopGapDay | null;
}

// A load day: one line with the window's settings and one with what the live order updates did.
export function loadExtraLines(x: NonNullable<SummaryInput["loadExtras"]>): string[] {
  const s = x.orderStream;
  const e = x.entryExpiry;
  return [
    `- window settings: ${loadWindowRules()}${e ? `. Unfilled and cancelled: ${e.cancelled} of ${e.scheduled} (${e.filledFirst} filled before the cancel${e.failed ? `, ${e.failed} cancels failed` : ""})` : ""}`,
    s ? `- live order updates: ${s.events} received, ${s.freed} symbols freed${s.medianFreeMs !== null ? `, typically ${s.medianFreeMs} ms after the exit filled` : ""}, ${s.reconnects} reconnects` : "- live order updates: not connected",
  ];
}

// The speed release (Michael's decision 3): what selling 3 seconds after Alpaca cancelled a stop did, against waiting 5 more seconds.
export interface StopGapDay {
  sales: number;
  shares: number;
  // Sales whose take-profit price printed within 5 seconds after the sale (so waiting would likely have filled there).
  wouldHaveFilled: number;
  // Sales still being measured (the 5 seconds or the fill price not seen yet) when the summary was written.
  unmeasured: number;
  // Dollars the sales made against waiting 5 seconds (positive means selling at once did better).
  dollarsVsWaiting: number;
}

export function stopGapLine(g: StopGapDay): string {
  if (g.sales === 0) return "Shares left without a stop (sold 3 seconds after Alpaca cancelled the stop): none today.";
  const sign = g.dollarsVsWaiting >= 0 ? "+" : "-";
  return `Shares left without a stop, sold 3 seconds after Alpaca cancelled the stop: ${g.sales} sales, ${g.shares} shares; ${g.wouldHaveFilled} would have filled at their take-profit within the next 5 seconds; selling at once came out ${sign}${Math.abs(g.dollarsVsWaiting).toFixed(2)} dollars against waiting 5 seconds${g.unmeasured ? ` (${g.unmeasured} not measured)` : ""}. Estimate from the free feed's prints.`;
}

const money = (x: number) => `${x >= 0 ? "+" : "-"}${Math.abs(x).toFixed(2)}`;

interface Lot {
  qty: number;
  price: number;
}
export interface SymbolResult {
  symbol: string;
  bought: number;
  sold: number;
  net: number;
  trades: number;
}

export interface DayResult {
  fills: Fill[];
  symbols: SymbolResult[];
  realized: number;
  wins: number;
  losses: number;
  buys: number;
  sells: number;
  unmatchedSellShares: number;
  stillHeld: string[];
}

// Matches sells to earlier buys first-in first-out, per symbol, over the day's fills. Entries can repeat in a symbol,
// so profit is matched by quantity, not by order. A sell with no buy before it today (a carried position) is counted as
// unmatched and not given a profit.
export function computeDay(alpacaOrders: Order[]): DayResult {
  const all = alpacaOrders.flatMap((o) => [o, ...flattenLegs(o)]);
  const filled = all.filter((o) => o.filledQty > 0 && o.filledAvgPrice !== null);
  const seen = new Set<string>();
  const events = filled
    .filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)))
    .map((o) => ({ symbol: o.symbol, side: o.side as "buy" | "sell", qty: o.filledQty, price: o.filledAvgPrice!, at: o.filledAt ?? o.createdAt ?? "" }))
    .sort((a, b) => a.at.localeCompare(b.at));
  const lots = new Map<string, Lot[]>();
  const per = new Map<string, SymbolResult>();
  let realized = 0;
  let wins = 0;
  let losses = 0;
  let unmatched = 0;
  const get = (s: string) => per.get(s) ?? (per.set(s, { symbol: s, bought: 0, sold: 0, net: 0, trades: 0 }), per.get(s)!);
  for (const e of events) {
    const r = get(e.symbol);
    if (e.side === "buy") {
      (lots.get(e.symbol) ?? lots.set(e.symbol, []).get(e.symbol)!).push({ qty: e.qty, price: e.price });
      r.bought += e.qty;
      r.trades++;
    } else {
      r.sold += e.qty;
      let left = e.qty;
      let pnl = 0;
      const q = lots.get(e.symbol) ?? [];
      while (left > 1e-9 && q.length > 0) {
        const lot = q[0]!;
        const take = Math.min(lot.qty, left);
        pnl += (e.price - lot.price) * take;
        lot.qty -= take;
        left -= take;
        if (lot.qty <= 1e-9) q.shift();
      }
      unmatched += left;
      r.net += pnl;
      realized += pnl;
      if (pnl > 0) wins++;
      else if (pnl < 0) losses++;
    }
  }
  const stillHeld = [...lots.entries()].filter(([, q]) => q.reduce((s, l) => s + l.qty, 0) > 1e-9).map(([s]) => s);
  return {
    fills: events.map((e) => ({ side: e.side, qty: e.qty, price: e.price })),
    symbols: [...per.values()],
    realized,
    wins,
    losses,
    buys: events.filter((e) => e.side === "buy").length,
    sells: events.filter((e) => e.side === "sell").length,
    unmatchedSellShares: unmatched,
    stillHeld,
  };
}

// Typical (median), 95th percentile and slowest time Alpaca took to accept an order, in milliseconds.
export function speedStats(rows: OrderRecord[]): { n: number; median: number; p95: number; slowest: number } | null {
  const xs = rows.map((r) => r.acceptMs).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const at = (p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
  return { n: xs.length, median: at(0.5), p95: at(0.95), slowest: xs[xs.length - 1]! };
}

export function feeLines(date: string, fees: FeeEstimate, running: number | null | undefined): string[] {
  return [
    `Estimated regulatory fees for the day (Alpaca charges them on this paper account too, posted that evening): ${fees.total.toFixed(2)} dollars (SEC ${fees.sec.toFixed(2)}, FINRA TAF ${fees.taf.toFixed(2)}${tafActive(date) ? "" : " [paused by FINRA until 2027-01-01]"}, CAT ${fees.cat.toFixed(2)})${running === null || running === undefined ? "" : `. Running total ${running.toFixed(2)} dollars`}`,
  ];
}

// The most entries decided in any 60 seconds.
export function busiestMinute(rows: OrderRecord[]): number {
  const ts = rows.map((r) => (r.createdAt ? Date.parse(r.createdAt) : NaN)).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  let best = 0;
  for (let i = 0, j = 0; i < ts.length; i++) {
    while (ts[i]! - ts[j]! >= 60_000) j++;
    best = Math.max(best, i - j + 1);
  }
  return best;
}

// One part of a load day (the window, or the rest of the day): entries, the busiest minute, speed, and how the entries closed.
// Profit is counted for entries closed by their own take-profit or stop at Alpaca; an entry closed another way (the close-out,
// the loss stop) is counted, without profit, as closed later.
export function partLines(label: string, rows: OrderRecord[], alpacaOrders: Order[]): string[] {
  const byId = new Map(alpacaOrders.map((o) => [o.clientOrderId, o]));
  const sent = rows.filter((r) => r.status !== "failed" && !(r.status === "canceled" && !r.alpacaOrderId));
  let tp = 0;
  let stop = 0;
  let other = 0;
  let pnl = 0;
  let filled = 0;
  for (const r of sent) {
    const o = byId.get(r.clientOrderId);
    if (!o || !(o.filledQty > 0) || o.filledAvgPrice === null) continue;
    filled++;
    const legs = flattenLegs(o).filter((l) => l.side === "sell" && l.filledQty > 0 && l.filledAvgPrice !== null);
    const exitQty = legs.reduce((n, l) => n + l.filledQty, 0);
    if (exitQty >= o.filledQty - 1e-9) {
      pnl += legs.reduce((n, l) => n + l.filledQty * l.filledAvgPrice!, 0) - o.filledQty * o.filledAvgPrice;
      if (legs.some((l) => l.type === "stop")) stop++;
      else tp++;
    } else other++;
  }
  const speed = speedStats(sent);
  return [
    `**${label}:** ${sent.length} entries sent (${filled} filled), busiest minute ${busiestMinute(sent)}. Closed by take-profit ${tp}, by stop ${stop} (${money(pnl)} on those), closed later or still open ${other}.`,
    speed ? `- speed: typical ${speed.median} ms, 95th percentile ${speed.p95} ms, slowest ${speed.slowest} ms` : "- speed: no orders",
  ];
}

export function formatSummary(i: SummaryInput): string {
  const head = `**Daily summary for ${i.day.tradeDate}**`;
  if (!i.day.isTradingDay) return `${head}\nNot a trading day.`;
  if (i.day.status !== "approved") {
    return `${head}\nNo trading today: the limits were not all decided before the open. Equity ${i.account.equity.toFixed(2)}.`;
  }
  const result = computeDay(i.alpacaOrders);
  const sent = i.stored.filter((r) => r.status !== "failed" && !(r.status === "canceled" && !r.alpacaOrderId));
  const change = i.day.dayStartEquity === null ? null : i.account.equity - i.day.dayStartEquity;
  const reasons = new Map<string, number>();
  let refusedTotal = 0;
  for (const r of i.refusals) {
    const n = typeof r.detail?.count === "number" ? (r.detail.count as number) : 1;
    reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + n);
    refusedTotal += n;
  }
  const speed = speedStats(i.stored);
  const fees = estimateFees(i.day.tradeDate, result.fills);
  const bySize = [...result.symbols].sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const shown = bySize.slice(0, 8);
  const lines = [
    head,
    `Limits: ${describeLimits(i.day.limits)}`,
    `Trades: ${sent.length} entry orders sent (${result.buys} filled), ${result.sells} sells filled. Closed trades: ${result.wins} won, ${result.losses} lost.`,
    ...shown.map((s) => `- ${s.symbol}: bought ${s.bought}, sold ${s.sold}, ${money(s.net)}`),
    bySize.length > shown.length ? `- ...and ${bySize.length - shown.length} more symbols` : "",
    `Profit or loss: ${money(result.realized)} from closed trades${change === null ? "" : `; account equity ${i.day.dayStartEquity!.toFixed(2)} to ${i.account.equity.toFixed(2)} (${money(change)})`}`,
    result.unmatchedSellShares > 1e-9 ? `Note: ${result.unmatchedSellShares} shares were sold that were bought before today (a carried position), with no profit counted for them.` : "",
    speed ? `Speed (decision to Alpaca accepting the order, ${speed.n} orders): typical ${speed.median} ms, 95th percentile ${speed.p95} ms, slowest ${speed.slowest} ms` : "Speed: no orders were sent",
    ...feeLines(i.day.tradeDate, fees, i.feesRunning),
    i.peak ? `Borrowing used: peak exposure ${i.peak.exposureUsd.toFixed(0)} dollars, ${i.peak.ratio.toFixed(2)} times equity (approved cap ${i.day.limits.borrowingCap})` : "Borrowing used: no entries, none",
    i.stopGap ? stopGapLine(i.stopGap) : "",
    i.requests ? `Alpaca requests: about ${i.requests.requestsLastMinute} in the last minute at the close; lowest budget seen ${i.requests.lowestBudget === null ? "unknown" : Math.floor(i.requests.lowestBudget)} of 200; busiest minute ${i.requests.peakTradesPerMinute} orders; held back by the governor ${i.requests.refusedByGovernor} times${i.requests.rateLimitAnswers !== undefined ? `; rate-limit answers from Alpaca ${i.requests.rateLimitAnswers}` : ""}` : "",
    ...(i.loadWindow
      ? [
          "**Load day**",
          ...partLines(`Load window (${centralClock(i.loadWindow.start)} to ${centralClock(i.loadWindow.end)})`, i.stored.filter((r) => r.createdAt && Date.parse(r.createdAt) >= i.loadWindow!.start.getTime() && Date.parse(r.createdAt) < i.loadWindow!.end.getTime()), i.alpacaOrders),
          ...(i.loadExtras ? loadExtraLines(i.loadExtras) : []),
          ...partLines("Rest of the day", i.stored.filter((r) => !(r.createdAt && Date.parse(r.createdAt) >= i.loadWindow!.start.getTime() && Date.parse(r.createdAt) < i.loadWindow!.end.getTime())), i.alpacaOrders),
        ]
      : []),
    `Refused entries: ${refusedTotal}${refusedTotal ? ` (${[...reasons].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([r, n]) => `${r.slice(0, 70)}: ${n}`).join("; ")})` : ""}`,
    i.listComplete === false ? "**Warning: the day's order list was longer than I could read, so the totals above may be incomplete.**" : "",
    `Stop flag: ${i.stop?.on ? `ON (${i.stop.reason})` : "off"}. End of day: ${i.flat === null ? "flat status not checked" : i.flat ? "flat" : "**NOT FLAT**"}.`,
  ];
  return lines.filter(Boolean).join("\n");
}
