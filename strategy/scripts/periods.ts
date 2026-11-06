// The four periods (Michael's ruling). Exact first and last trading days are filled in from SPY's
// daily bars (2016 on) or, for 2009, checked separately and recorded in the deliverable.
export type PeriodId = "A" | "B" | "C" | "D";
export const PERIODS: Record<PeriodId, { from: string; to: string; label: string; asked?: string }> = {
  // Period A as asked runs from April 2009; free data starts 2016-01-04, so a stand-in window is measured.
  A: { from: "2016-01-04", to: "2020-01-31", label: "stand-in window January 4, 2016 to January 31, 2020 (period A asked: April 2009 to January 2020)", asked: "2009-04-01" },
  B: { from: "2020-04-01", to: "2022-01-31", label: "April 2020 to January 2022" },
  C: { from: "2023-01-03", to: "2025-02-28", label: "January 2023 to February 2025" },
  D: { from: "2025-04-01", to: "2026-10-01", label: "April 2025 to October 1, 2026" },
};
// Alpaca's free consolidated history starts here (measured 2026-11-05).
export const ALPACA_FLOOR = "2016-01-04";
