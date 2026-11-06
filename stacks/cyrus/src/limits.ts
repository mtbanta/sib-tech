// Trading limits and the pure check every entry must pass. No network, no clock: everything the check needs
// is passed in, so it can be tested exhaustively. The gate (gate.ts) is the only caller that may send an order.

export type BorrowingCap = 1 | 2 | 4;

// The most orders a minute the stack will ever send, whatever Michael types. Fixed ceilings in code: 100 on a normal day (half of
// Alpaca's 200 requests a minute), and 150 while a load day's window is switched on (Michael's ruling of 2026-11-06; the request
// reserve, governor.ts, keeps room for cancels, protective sales, the close-out and the stop command). RAISING EITHER IS A HARD
// STOP: it needs Michael's decision, not a builder's.
export const MAX_TRADES_PER_MINUTE = 100;
export const MAX_TRADES_PER_MINUTE_LOAD_DAY = 150;

// The ceiling in force: 150 only while the day is a load day with its window still switched on (`load on`), 100 otherwise
// (a normal day, or a load day after `load off`).
export function tradesCeiling(loadWindowOn: boolean): number {
  return loadWindowOn ? MAX_TRADES_PER_MINUTE_LOAD_DAY : MAX_TRADES_PER_MINUTE;
}

export interface Limits {
  maxPositionUsd: number; // largest single position, in dollars at entry
  dailyLossStopUsd: number; // stop trading for the day when equity falls this far below the day's start
  maxTradesPerMinute: number; // orders sent to open a position, in any 60 seconds (1 to 100, or to 150 on a load day). No daily total.
  borrowingCap: BorrowingCap; // 1 = no borrowing, 2 or 4 = that multiple of equity
}

// What the stack suggests when it has no earlier approved value for a limit (the first time). Small on purpose
// for a 20,000 dollar paper account.
export const SUGGESTED_LIMITS: Limits = { maxPositionUsd: 1000, dailyLossStopUsd: 200, maxTradesPerMinute: 20, borrowingCap: 1 };

export const LIMIT_NAMES = ["position", "loss", "trades", "cap"] as const;
export type LimitName = (typeof LIMIT_NAMES)[number];

// Reads a stored limits object of any age. Records written before build C2 had `maxTradesPerDay` and no
// `maxTradesPerMinute`: the old daily number means nothing as a per-minute cap, so it is replaced by the suggestion
// and the caller is told (`tradesPerMinuteMissing`) so it can mark that limit as undecided.
export function normalizeLimits(raw: unknown): { limits: Limits; tradesPerMinuteMissing: boolean } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const tpm = r.maxTradesPerMinute;
  const missing = !(typeof tpm === "number" && Number.isFinite(tpm));
  const cap = num(r.borrowingCap, 1);
  return {
    tradesPerMinuteMissing: missing,
    limits: {
      maxPositionUsd: num(r.maxPositionUsd, SUGGESTED_LIMITS.maxPositionUsd),
      dailyLossStopUsd: num(r.dailyLossStopUsd, SUGGESTED_LIMITS.dailyLossStopUsd),
      maxTradesPerMinute: missing ? SUGGESTED_LIMITS.maxTradesPerMinute : Math.max(1, Math.min(MAX_TRADES_PER_MINUTE_LOAD_DAY, Math.floor(tpm as number))),
      borrowingCap: (cap === 2 || cap === 4 ? cap : 1) as BorrowingCap,
    },
  };
}

// Which limits would a change make looser? After the "Armed" message only tightening is allowed.
export function loosened(current: Limits, proposed: Limits): LimitName[] {
  const out: LimitName[] = [];
  if (proposed.maxPositionUsd > current.maxPositionUsd) out.push("position");
  if (proposed.dailyLossStopUsd > current.dailyLossStopUsd) out.push("loss");
  if (proposed.maxTradesPerMinute > current.maxTradesPerMinute) out.push("trades");
  if (proposed.borrowingCap > current.borrowingCap) out.push("cap");
  return out;
}

// Applies one owner override. Returns the new limits or an error text. The owner may set any value inside
// sanity bounds (they exist to catch typos, not to second-guess the owner), except that trades a minute can never
// go above the fixed ceiling: 100, or 150 when the day is a load day (`loadDay`, Michael's ruling of 2026-11-06).
export function applyOverride(current: Limits, name: string, raw: string, equity: number, opts: { loadDay?: boolean } = {}): { limits: Limits } | { error: string } {
  const value = Number(raw.replace(/[$,]/g, ""));
  if (!Number.isFinite(value)) return { error: `"${raw}" is not a number` };
  switch (name) {
    case "position":
      if (value < 50 || value > equity) return { error: `position must be between 50 and ${equity} dollars` };
      return { limits: { ...current, maxPositionUsd: value } };
    case "loss":
      if (value < 10 || value > equity * 0.25) return { error: `loss stop must be between 10 and ${equity * 0.25} dollars` };
      return { limits: { ...current, dailyLossStopUsd: value } };
    case "trades": {
      const ceiling = tradesCeiling(opts.loadDay === true);
      if (!Number.isInteger(value) || value < 1 || value > ceiling) {
        const why = opts.loadDay ? `${ceiling} is the fixed load-day ceiling, set in the code` : `${ceiling} is the fixed ceiling, set in the code; up to ${MAX_TRADES_PER_MINUTE_LOAD_DAY} on a load day, after \`load on\``;
        return { error: `trades a minute must be a whole number from 1 to ${ceiling} (${why})` };
      }
      return { limits: { ...current, maxTradesPerMinute: value } };
    }
    case "cap":
      if (value !== 1 && value !== 2 && value !== 4) return { error: "cap must be 1, 2 or 4" };
      return { limits: { ...current, borrowingCap: value } };
    default:
      return { error: `unknown limit "${name}" (use position, loss, trades or cap)` };
  }
}

export function describeLimits(l: Limits): string {
  return `largest position ${l.maxPositionUsd} dollars, daily loss stop ${l.dailyLossStopUsd} dollars, at most ${l.maxTradesPerMinute} orders a minute (no daily total), borrowing cap ${l.borrowingCap}`;
}

export interface EntryContext {
  symbol: string;
  price: number; // latest trade price
  limits: Limits | null; // null = the owner has not approved today's limits
  stopFlag: boolean;
  marketOpen: boolean;
  minutesSinceOpen: number;
  minutesToClose: number;
  tradesLastMinute: number; // entries sent in the last 60 seconds
  // The ceiling in force (tradesCeiling): 150 while a load day's window is on, else 100 (the default when not given).
  tradesCeiling?: number;
  heldSymbols: ReadonlySet<string>; // symbols held, or with an entry still working
  inSymbolCooldown?: boolean;
  dayStartEquity: number;
  equity: number;
  grossExposure: number; // dollars currently in positions
  priceAgeSeconds: number; // how old the latest trade is
}

export type EntryDecision = { ok: true; qty: number; notional: number } | { ok: false; reason: string };

export const MIN_MINUTES_AFTER_OPEN = 5;
export const MIN_MINUTES_BEFORE_CLOSE = 60;
export const MAX_PRICE_AGE_SECONDS = 120;

// Order of checks matters: the stop flag and the morning approval come first and always win.
export function checkEntry(c: EntryContext): EntryDecision {
  if (c.stopFlag) return { ok: false, reason: "stop flag is set" };
  if (!c.limits) return { ok: false, reason: "no limits approved for today" };
  if (!c.marketOpen) return { ok: false, reason: "market is closed" };
  if (c.minutesSinceOpen < MIN_MINUTES_AFTER_OPEN) return { ok: false, reason: "first minutes of the session" };
  if (c.minutesToClose < MIN_MINUTES_BEFORE_CLOSE) return { ok: false, reason: "too close to the close for a new entry" };
  if (!(c.price > 0) || c.priceAgeSeconds > MAX_PRICE_AGE_SECONDS) return { ok: false, reason: "price is missing or stale" };
  if (c.dayStartEquity - c.equity >= c.limits.dailyLossStopUsd) return { ok: false, reason: "daily loss stop reached" };
  if (c.tradesLastMinute >= Math.min(c.limits.maxTradesPerMinute, Math.min(c.tradesCeiling ?? MAX_TRADES_PER_MINUTE, MAX_TRADES_PER_MINUTE_LOAD_DAY))) return { ok: false, reason: "trades-per-minute limit reached" };
  if (c.heldSymbols.has(c.symbol)) return { ok: false, reason: "already holding this symbol" };
  const room = c.equity * c.limits.borrowingCap - c.grossExposure;
  const notional = Math.min(c.limits.maxPositionUsd, room);
  const qty = Math.floor(notional / c.price);
  if (qty < 1) return { ok: false, reason: room < c.price ? "borrowing cap leaves no room" : "position limit smaller than one share" };
  return { ok: true, qty, notional: qty * c.price };
}
