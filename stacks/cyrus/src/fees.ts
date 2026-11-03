// Estimated regulatory fees, from the rates Alpaca's brokerage fee schedule and the regulators' notices gave on
// 2026-11-02 (sources in builds/build-c2-log.md, "Piece 0"). The paper account IS charged these: Alpaca posted Monday
// 2026-11-02's REG fee (0.56 on 27,100.09 of sales) and CAT fee (0.01) as account activities that evening, although its
// paper-trading page says paper does not account for regulatory fees (corrected 2026-11-03, see the C2 log). This is the
// worker's own ESTIMATE of the day's charge, shown in the daily summary; Alpaca's posted figure is the real one.
//
//   SEC Section 31 fee   sells only      0.0000206 x the sale value ($20.60 per million, effective 2026-04-04)
//   FINRA TAF            sells only      0.000195 a share, at most 9.79 a trade; PAUSED to 0 for sales from 2026-10-01
//                                        through 2026-12-31 (FINRA filing SR-FINRA-2026-021), back from 2027-01-01
//   CAT fee              buys and sells  0.000003 a share (Alpaca's schedule; the CAT plan's own notice says 0.000001)
//   Each fee type is added up for the day and rounded UP to the cent, as Alpaca does.
export const SEC_RATE = 0.0000206;
export const TAF_RATE = 0.000195;
export const TAF_CAP = 9.79;
export const CAT_RATE = 0.000003;

export function tafActive(date: string): boolean {
  return !(date >= "2026-10-01" && date <= "2026-12-31");
}

export interface Fill {
  side: "buy" | "sell";
  qty: number;
  price: number;
}

export interface FeeEstimate {
  sec: number;
  taf: number;
  cat: number;
  total: number;
  sellValue: number;
}

const roundUpCent = (x: number) => (x <= 0 ? 0 : Math.ceil(x * 100 - 1e-9) / 100);

export function estimateFees(date: string, fills: Fill[]): FeeEstimate {
  let sellValue = 0;
  let taf = 0;
  let shares = 0;
  for (const f of fills) {
    shares += f.qty;
    if (f.side === "sell") {
      sellValue += f.qty * f.price;
      if (tafActive(date)) taf += Math.min(f.qty * TAF_RATE, TAF_CAP);
    }
  }
  const sec = roundUpCent(sellValue * SEC_RATE);
  const tafR = roundUpCent(taf);
  const cat = roundUpCent(shares * CAT_RATE);
  return { sec, taf: tafR, cat, total: Math.round((sec + tafR + cat) * 100) / 100, sellValue };
}

export interface FeesRunning {
  total: number;
  byDate: Record<string, number>;
}
export const CONTROL_FEES = "fees_running";

// Records a day's estimate in the running total. Safe to call twice for the same day (the day replaces itself).
export function addToRunning(prev: FeesRunning | null, date: string, dayTotal: number): FeesRunning {
  const byDate = { ...(prev?.byDate ?? {}), [date]: dayTotal };
  const total = Math.round(Object.values(byDate).reduce((s, x) => s + x, 0) * 100) / 100;
  return { total, byDate };
}
