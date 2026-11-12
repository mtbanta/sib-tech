// The daily summary's bounded-window read of the day's orders (fix of 2026-11-11). Read only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { listDaySliced, summaryWindows, SUMMARY_MAX_FAILED_WINDOWS } from "../src/summary-listing.ts";
import type { Order } from "../src/alpaca-trading.ts";
import { order } from "./helpers.ts";

const MIDNIGHT = new Date("2026-11-11T05:00:00Z"); // midnight Eastern
const OPEN = new Date("2026-11-11T14:30:00Z");
const CLOSE_PLUS = new Date("2026-11-11T21:10:00Z");
const noPace = async () => undefined;

// A fake Alpaca that holds orders and answers bounded windows like the real one (`after` and `until` exclusive, 500 a page), with
// hooks to make a window fail or to drop some orders from a window's answer (a partial list).
function alpaca(orders: Order[], o: { fail?: (a: string, b: string) => boolean; drop?: (a: string, b: string) => Set<string> } = {}) {
  const calls: Array<[string, string]> = [];
  return {
    calls,
    async listOrdersWindow(a: string, b: string) {
      calls.push([a, b]);
      if (o.fail?.(a, b)) throw new Error("The operation was aborted due to timeout");
      const drop = o.drop?.(a, b) ?? new Set<string>();
      const rows = orders.filter((x) => (x.submittedAt ?? x.createdAt)! > a && (x.submittedAt ?? x.createdAt)! < b && !drop.has(x.id));
      return { orders: rows.map((x) => structuredClone(x)), complete: true, pages: 1 };
    },
  };
}

const at = (iso: string, i: number) => order({ id: `id-${i}`, clientOrderId: `c-${i}`, createdAt: iso, submittedAt: iso });

test("summary windows: one window before the open, then 5 minute windows to the end, each overlapping the last by 1 ms", () => {
  const w = summaryWindows(MIDNIGHT, OPEN, CLOSE_PLUS);
  assert.equal(w[0]![0].toISOString(), MIDNIGHT.toISOString());
  assert.equal(w[0]![1].toISOString(), "2026-11-11T14:00:00.000Z", "the quiet window ends 30 minutes before the open");
  assert.equal(w[1]![0].toISOString(), "2026-11-11T13:59:59.999Z");
  assert.equal(w[1]![1].toISOString(), "2026-11-11T14:05:00.000Z");
  assert.equal(w.at(-1)![1].toISOString(), CLOSE_PLUS.toISOString());
  assert.equal(w.length, 1 + 86, "a full day is 87 windows (7 hours 10 minutes of 5 minute windows plus one)");
  for (let i = 1; i < w.length; i++) assert.equal(w[i]![0].getTime(), w[i - 1]![1].getTime() - 1);
  assert.equal(summaryWindows(MIDNIGHT, null, new Date(MIDNIGHT.getTime() + 3_600_000)).length, 12, "no open time: 5 minute windows from midnight");
});

test("summary listing: every order of the day is read once, including one submitted exactly on a window boundary", async () => {
  const orders = [at("2026-11-11T13:00:00.000Z", 1), at("2026-11-11T14:05:00.000Z", 2), at("2026-11-11T15:31:12.345Z", 3), at("2026-11-11T20:55:29.360Z", 4)];
  const b = alpaca(orders);
  const r = await listDaySliced(b, summaryWindows(MIDNIGHT, OPEN, CLOSE_PLUS), [], noPace);
  assert.deepEqual(r.orders.map((o) => o.id).sort(), ["id-1", "id-2", "id-3", "id-4"]);
  assert.equal(r.complete, true);
  assert.equal(r.failedWindows, 0);
  assert.equal(r.requests, 87);
});

test("summary listing: a window that times out is split in half and read again; only a 1 minute window that still fails is counted", async () => {
  const orders = [at("2026-11-11T15:01:00.000Z", 1), at("2026-11-11T15:03:30.000Z", 2)];
  // Any window longer than 2 minutes covering 15:00 to 15:05 fails; shorter ones answer.
  const b = alpaca(orders, { fail: (a, z) => a < "2026-11-11T15:05" && z > "2026-11-11T15:00" && Date.parse(z) - Date.parse(a) > 120_001 });
  const r = await listDaySliced(b, summaryWindows(MIDNIGHT, OPEN, CLOSE_PLUS), [], noPace);
  assert.deepEqual(r.orders.map((o) => o.id).sort(), ["id-1", "id-2"]);
  assert.equal(r.failedWindows, 0);
  assert.equal(r.complete, true, "the split windows read everything");

  const c = alpaca(orders, { fail: (a, z) => a < "2026-11-11T15:02" && z > "2026-11-11T15:01:30" });
  const r2 = await listDaySliced(c, summaryWindows(MIDNIGHT, OPEN, CLOSE_PLUS), [], noPace);
  assert.ok(r2.failedWindows >= 1 && r2.failedWindows < SUMMARY_MAX_FAILED_WINDOWS);
  assert.equal(r2.complete, false, "a window that could not be read marks the listing incomplete");
  assert.ok(r2.orders.some((o) => o.id === "id-2"), "the rest of the day is still read");
});

test("summary listing: Alpaca failing throughout gives up after 3 one-minute windows, so the step fails fast and is tried again", async () => {
  const b = alpaca([], { fail: () => true });
  await assert.rejects(listDaySliced(b, summaryWindows(MIDNIGHT, OPEN, CLOSE_PLUS), [], noPace), /failed in 3 one-minute windows/);
  assert.ok(b.calls.length <= 3 * 15, `${b.calls.length} calls`);
});

test("summary listing: a partial list (a window missing 3 or more stored entries) is read again in 1 minute pieces", async () => {
  const orders = Array.from({ length: 6 }, (_, i) => at(`2026-11-11T15:0${i}:30.000Z`, i));
  // The 15:00 to 15:05 window's first answer leaves out 4 orders, as the open-ended listing did on 2026-11-11; shorter windows are whole.
  const b = alpaca(orders, { drop: (a, z) => (Date.parse(z) - Date.parse(a) > 120_001 ? new Set(["id-0", "id-1", "id-2", "id-3"]) : new Set()) });
  const stored = orders.map((o) => ({ clientOrderId: o.clientOrderId, createdAt: new Date(Date.parse(o.createdAt!) - 300).toISOString() }));
  const r = await listDaySliced(b, summaryWindows(MIDNIGHT, OPEN, CLOSE_PLUS), stored, noPace);
  assert.equal(r.rereadWindows, 1);
  assert.deepEqual(r.orders.map((o) => o.id).sort(), ["id-0", "id-1", "id-2", "id-3", "id-4", "id-5"]);

  // Two missing in a window are left to the summary's one-by-one lookup (no re-read).
  const c = alpaca(orders, { drop: () => new Set(["id-0", "id-1"]) });
  const r2 = await listDaySliced(c, summaryWindows(MIDNIGHT, OPEN, CLOSE_PLUS), stored, noPace);
  assert.equal(r2.rereadWindows, 0);
  assert.equal(r2.orders.length, 4);
});

test("summary listing: each window waits for the summary's pacing first", async () => {
  let paced = 0;
  const b = alpaca([]);
  await listDaySliced(b, summaryWindows(MIDNIGHT, OPEN, CLOSE_PLUS), [], async () => void paced++);
  assert.equal(paced, b.calls.length);
});

test("the summary step alerts once per trading day: a second failure that day is quiet; the next day's failure alerts even under 24 hours later", async () => {
  const { rig } = await import("./rig.ts");
  const { FakeBroker } = await import("./helpers.ts");
  const { MemoryStore } = await import("../src/store.ts");
  const r = rig<InstanceType<typeof FakeBroker>, InstanceType<typeof MemoryStore>>();
  const w = r.worker as unknown as { background(name: string, fn: () => Promise<void>): void };
  const fail = () => w.background("summary", async () => { throw new Error("The operation was aborted due to timeout"); });
  const alerts = () => r.said("alerts").filter((t) => t.startsWith('Step "summary" failed')).length;
  await r.at("2026-11-03T03:45:00Z"); // 10:45 PM Eastern on Monday 11-02
  fail();
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(alerts(), 1);
  await r.at("2026-11-03T04:30:00Z"); // 11:30 PM Eastern, still 11-02
  fail();
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(alerts(), 1, "the same trading day: no second alert");
  await r.at("2026-11-03T20:10:00Z"); // 3:10 PM Eastern on Tuesday 11-03, about 16 hours later
  fail();
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(alerts(), 2, "the next trading day's failure alerts");
});
