// A behaviour check any Store must pass. Run by the tests against MemoryStore, and by the schema tool against
// the real database inside a transaction that is rolled back (so it leaves nothing behind).
import { SUGGESTED_LIMITS } from "./limits.ts";
import type { DayRecord, OrderRecord, Store } from "./store.ts";

// Compares two JSON values ignoring key order (Postgres jsonb stores keys in its own order).
const same = (a: unknown, b: unknown): boolean => {
  const norm = (v: unknown): unknown => (Array.isArray(v) ? v.map(norm) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => x.localeCompare(y)).map(([k, x]) => [k, norm(x)])) : v);
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
};

export async function runStoreContract(store: Store, date = "2099-01-04"): Promise<string[]> {
  const bad: string[] = [];
  const expect = (cond: boolean, what: string) => {
    if (!cond) bad.push(what);
  };

  expect((await store.getControl("contract_missing")) === null, "a missing control key reads as null");
  await store.setControl("contract_key", { on: true, n: 1 });
  expect(same(await store.getControl("contract_key"), { on: true, n: 1 }), "a control value reads back");
  await store.setControl("contract_key", { on: false });
  expect(same(await store.getControl("contract_key"), { on: false }), "a control value is replaced");

  expect((await store.getDay(date)) === null, "an unknown day reads as null");
  const day: DayRecord = {
    tradeDate: date,
    isTradingDay: true,
    openAt: new Date("2099-01-04T14:30:00Z"),
    closeAt: new Date("2099-01-04T21:00:00Z"),
    status: "pending",
    dayStartEquity: 20000,
    suggested: SUGGESTED_LIMITS,
    limits: SUGGESTED_LIMITS,
    decided: {},
    liveList: null,
    phases: {},
  };
  const created = await store.createDay(day);
  expect(created.tradeDate === date && created.status === "pending", "a day is created");
  const again = await store.createDay({ ...day, status: "approved" });
  expect(again.status === "pending", "creating a day twice keeps the first row");
  const upd = await store.updateDay(date, { status: "approved", decided: { position: true }, liveList: ["AAA", "BBB"], phases: { morning: "t" }, limits: { ...SUGGESTED_LIMITS, maxPositionUsd: 500 } });
  expect(upd.status === "approved" && upd.decided.position === true && upd.liveList?.join() === "AAA,BBB" && upd.phases.morning === "t" && upd.limits.maxPositionUsd === 500, "a day updates");
  const reread = await store.getDay(date);
  expect(reread?.openAt?.toISOString() === "2099-01-04T14:30:00.000Z" && reread.dayStartEquity === 20000 && reread.tradeDate === date, "a day reads back with its times and its date as text");

  const order: OrderRecord = { clientOrderId: `contract-${date}-AAA`, tradeDate: date, symbol: "AAA", qty: 3, referencePrice: 10.5, stopPrice: 10.34, status: "intent", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null };
  expect((await store.insertOrder(order)) === true, "a new order inserts");
  expect((await store.insertOrder({ ...order, qty: 99 })) === false, "the same order id is refused, not overwritten");
  expect((await store.getOrder(order.clientOrderId))?.qty === 3, "the first order is the one kept");
  await store.updateOrder(order.clientOrderId, { status: "filled", alpacaOrderId: "a-1", filledQty: 3, filledAvgPrice: 10.51 });
  const o2 = await store.getOrder(order.clientOrderId);
  expect(o2?.status === "filled" && o2.filledQty === 3 && o2.filledAvgPrice === 10.51 && o2.alpacaOrderId === "a-1", "an order updates");
  expect((await store.listOrders(date)).length === 1, "orders list by day");

  await store.addRefusal({ tradeDate: date, symbol: "BBB", reason: "test refusal", detail: { price: 1 } });
  const refusals = await store.listRefusals(date);
  expect(refusals.length === 1 && refusals[0]!.reason === "test refusal", "a refusal is kept");
  await store.addEvent("info", "contract_test", { ok: true });
  return bad;
}
