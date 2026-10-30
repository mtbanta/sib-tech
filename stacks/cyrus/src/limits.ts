// Trading limits and the pure check every entry must pass. No network, no clock: everything the check needs
// is passed in, so it can be tested exhaustively. The gate (gate.ts) is the only caller that may send an order.

export type BorrowingCap = 1 | 2 | 4;

export interface Limits {
  maxPositionUsd: number; // largest single position, in dollars at entry
  dailyLossStopUsd: number; // stop trading for the day when equity falls this far below the day's start
  maxTradesPerDay: number; // entries per day
  borrowingCap: BorrowingCap; // 1 = no borrowing, 2 or 4 = that multiple of equity
}

// What the stack suggests each morning. Placeholders: small on purpose for a 20,000 dollar paper account.
export const SUGGESTED_LIMITS: Limits = { maxPositionUsd: 1000, dailyLossStopUsd: 200, maxTradesPerDay: 10, borrowingCap: 1 };

export const LIMIT_NAMES = ["position", "loss", "trades", "cap"] as const;
export type LimitName = (typeof LIMIT_NAMES)[number];

// Applies one owner override. Returns the new limits or an error text. The owner may set any value inside
// sanity bounds (they exist to catch typos, not to second-guess the owner).
export function applyOverride(current: Limits, name: string, raw: string, equity: number): { limits: Limits } | { error: string } {
  const value = Number(raw.replace(/[$,]/g, ""));
  if (!Number.isFinite(value)) return { error: `"${raw}" is not a number` };
  switch (name) {
    case "position":
      if (value < 50 || value > equity) return { error: `position must be between 50 and ${equity} dollars` };
      return { limits: { ...current, maxPositionUsd: value } };
    case "loss":
      if (value < 10 || value > equity * 0.25) return { error: `loss stop must be between 10 and ${equity * 0.25} dollars` };
      return { limits: { ...current, dailyLossStopUsd: value } };
    case "trades":
      if (!Number.isInteger(value) || value < 1 || value > 100) return { error: "trades must be a whole number from 1 to 100" };
      return { limits: { ...current, maxTradesPerDay: value } };
    case "cap":
      if (value !== 1 && value !== 2 && value !== 4) return { error: "cap must be 1, 2 or 4" };
      return { limits: { ...current, borrowingCap: value } };
    default:
      return { error: `unknown limit "${name}" (use position, loss, trades or cap)` };
  }
}

export function describeLimits(l: Limits): string {
  return `largest position ${l.maxPositionUsd} dollars, daily loss stop ${l.dailyLossStopUsd} dollars, trades a day ${l.maxTradesPerDay}, borrowing cap ${l.borrowingCap}`;
}

export interface EntryContext {
  symbol: string;
  price: number; // latest trade price
  limits: Limits | null; // null = the owner has not approved today's limits
  stopFlag: boolean;
  marketOpen: boolean;
  minutesSinceOpen: number;
  minutesToClose: number;
  tradesToday: number;
  symbolsTradedToday: ReadonlySet<string>;
  heldSymbols: ReadonlySet<string>;
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
  if (c.tradesToday >= c.limits.maxTradesPerDay) return { ok: false, reason: "trades-a-day limit reached" };
  if (c.symbolsTradedToday.has(c.symbol)) return { ok: false, reason: "already traded this symbol today" };
  if (c.heldSymbols.has(c.symbol)) return { ok: false, reason: "already holding this symbol" };
  const room = c.equity * c.limits.borrowingCap - c.grossExposure;
  const notional = Math.min(c.limits.maxPositionUsd, room);
  const qty = Math.floor(notional / c.price);
  if (qty < 1) return { ok: false, reason: room < c.price ? "borrowing cap leaves no room" : "position limit smaller than one share" };
  return { ok: true, qty, notional: qty * c.price };
}
