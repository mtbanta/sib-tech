// The daily summary's read of the day's orders (fix of 2026-11-11). Read only: nothing here can send, cancel or size an order.
//
// On 2026-11-11 (about 7,900 orders) the summary asked Alpaca for every order since midnight in one open-ended listing. Alpaca took
// about 28 seconds to answer, past the worker's 10 second limit on every request, so the 3:05 PM summary never posted; and when it
// did answer it sent back a short page (172 of 500), which the old listing read as "complete". Measured the same evening: the day
// read in bounded 5 minute windows took 106 requests, the slowest 0.8 seconds, and returned every order.
//
// So the summary reads the day in bounded windows: one window from midnight Eastern to 30 minutes before the open (almost nothing
// trades then), then 5 minute windows until now. Each window is paged (500 a page). A window that fails (a timeout after the
// client's 3 tries) is split in half and read again, down to 1 minute; a 1 minute window that still fails is counted and the
// listing is marked incomplete. A partial list is caught afterwards: any window where 3 or more of the stack's stored entries are
// missing is read again in 1 minute pieces. Whatever is still missing after that is looked up one by one by the summary, as before.
import type { Order } from "./alpaca-trading.ts";

export const SUMMARY_WINDOW_MS = 5 * 60_000;
export const SUMMARY_MIN_WINDOW_MS = 60_000;
export const SUMMARY_QUIET_BEFORE_OPEN_MS = 30 * 60_000;
// A window missing at least this many stored entries is read again in 1 minute pieces.
export const SUMMARY_REREAD_MISSING = 3;
// After this many 1 minute windows fail, the listing gives up and the summary step fails (and is tried again).
export const SUMMARY_MAX_FAILED_WINDOWS = 3;

export interface WindowListing {
  listOrdersWindow(afterIso: string, untilIso: string, maxPages?: number): Promise<{ orders: Order[]; complete: boolean; pages: number }>;
}

export interface SlicedResult {
  orders: Order[];
  complete: boolean;
  windows: number;
  requests: number;
  failedWindows: number;
  rereadWindows: number;
}

// The windows for one day: [midnight, open - 30 min) as one, then 5 minute windows to `until`. Without an open time, 5 minute windows
// from midnight. Each window starts 1 ms before the previous one ends (Alpaca's `after` and `until` are both exclusive, so an order
// submitted exactly on a boundary would otherwise fall in neither); the overlap is removed by order id.
export function summaryWindows(midnight: Date, openAt: Date | null, until: Date): Array<[Date, Date]> {
  const out: Array<[Date, Date]> = [];
  let t = midnight.getTime();
  const end = until.getTime();
  const quietEnd = openAt ? openAt.getTime() - SUMMARY_QUIET_BEFORE_OPEN_MS : t;
  if (quietEnd > t) {
    const e = Math.min(quietEnd, end);
    out.push([new Date(t), new Date(e)]);
    t = e;
  }
  while (t < end) {
    const e = Math.min(t + SUMMARY_WINDOW_MS, end);
    out.push([new Date(t), new Date(e)]);
    t = e;
  }
  return out.map(([a, b], i) => [i === 0 ? a : new Date(a.getTime() - 1), b]);
}

export async function listDaySliced(
  broker: WindowListing,
  windows: Array<[Date, Date]>,
  stored: Array<{ clientOrderId: string; createdAt?: string }>,
  pace: () => Promise<void>,
): Promise<SlicedResult> {
  const seen = new Map<string, Order>();
  let requests = 0;
  let failedWindows = 0;
  let incomplete = false;

  const readWindow = async (a: Date, b: Date): Promise<void> => {
    await pace();
    try {
      const r = await broker.listOrdersWindow(a.toISOString(), b.toISOString());
      requests += r.pages;
      for (const o of r.orders) seen.set(o.id, o);
      if (!r.complete) incomplete = true;
    } catch {
      requests++;
      const len = b.getTime() - a.getTime();
      if (len <= SUMMARY_MIN_WINDOW_MS + 1) {
        failedWindows++;
        incomplete = true;
        // Alpaca is down or failing throughout: give up now (the summary step is tried again on the next pass) rather than spend
        // up to 30 seconds on each of a hundred windows.
        if (failedWindows >= SUMMARY_MAX_FAILED_WINDOWS) throw new Error(`Alpaca's order listing failed in ${failedWindows} one-minute windows`);
        return;
      }
      const mid = new Date(a.getTime() + Math.floor(len / 2));
      await readWindow(a, mid);
      await readWindow(new Date(mid.getTime() - 1), b);
    }
  };

  for (const [a, b] of windows) await readWindow(a, b);

  // A partial list: windows where several stored entries are missing are read again in 1 minute pieces (once).
  const listed = () => new Set([...seen.values()].map((o) => o.clientOrderId));
  const have = listed();
  const missingByWindow = new Map<number, number>();
  for (const s of stored) {
    if (have.has(s.clientOrderId) || !s.createdAt) continue;
    const t = Date.parse(s.createdAt);
    const i = windows.findIndex(([a, b]) => t >= a.getTime() && t < b.getTime());
    if (i >= 0) missingByWindow.set(i, (missingByWindow.get(i) ?? 0) + 1);
  }
  let rereadWindows = 0;
  for (const [i, n] of missingByWindow) {
    if (n < SUMMARY_REREAD_MISSING) continue;
    rereadWindows++;
    // The stored time is when the row was written, a moment before Alpaca submitted the order: read a minute either side too.
    const [a0, b0] = windows[i]!;
    const a = new Date(a0.getTime() - SUMMARY_MIN_WINDOW_MS);
    const b = new Date(b0.getTime() + SUMMARY_MIN_WINDOW_MS);
    for (let t = a.getTime(); t < b.getTime(); t += SUMMARY_MIN_WINDOW_MS) {
      await readWindow(new Date(t === a.getTime() ? t : t - 1), new Date(Math.min(t + SUMMARY_MIN_WINDOW_MS, b.getTime())));
    }
  }

  if (seen.size === 0 && failedWindows > 0) throw new Error(`Alpaca's order listing failed in ${failedWindows} window(s) and returned nothing`);
  return { orders: [...seen.values()], complete: !incomplete, windows: windows.length, requests, failedWindows, rereadWindows };
}
