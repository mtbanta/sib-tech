import { test } from "node:test";
import assert from "node:assert/strict";
import { AlpacaTrading, AlpacaError } from "../src/alpaca-trading.ts";
import { loadSettings } from "../src/config.ts";
import { FAKE_ENV } from "./fakes.ts";

const settings = loadSettings({ ...FAKE_ENV });

type Call = { method: string; url: URL; headers: Record<string, string>; body: any };
type Reply = Response | Error | ((c: Call) => Response | Error);
function fake(replies: Reply[]) {
  const calls: Call[] = [];
  const impl = (async (url: URL | string, init?: RequestInit) => {
    const call: Call = { method: init?.method ?? "GET", url: new URL(String(url)), headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const next = replies.shift();
    if (!next) throw new Error("unexpected extra call");
    const r = typeof next === "function" ? next(call) : next;
    if (r instanceof Error) throw r;
    return r;
  }) as typeof fetch;
  return { calls, client: new AlpacaTrading(settings, { fetchImpl: impl, retryDelayMs: 0 }) };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const orderJson = (over: Record<string, unknown> = {}) => ({
  id: "o1", client_order_id: "cyrus-20261030-AAPL-1", symbol: "AAPL", side: "buy", qty: "3", filled_qty: "0", filled_avg_price: null,
  status: "accepted", order_class: "oto", type: "market", legs: [{ id: "o2", client_order_id: "x", symbol: "AAPL", side: "sell", qty: "3", filled_qty: "0", status: "held", type: "stop", stop_price: "95.00" }], ...over,
});
const entry = { symbol: "AAPL", qty: 3, stopPrice: 95, referencePrice: 100, clientOrderId: "cyrus-20261030-AAPL-1" };

test("every call goes to the paper host, with the keys in headers only", async () => {
  const { calls, client } = fake([json({ status: "ACTIVE", equity: "20000", cash: "20000", buying_power: "80000", multiplier: "4" })]);
  const a = await client.getAccount();
  assert.equal(a.equity, 20000);
  assert.equal(calls[0]!.url.host, "paper-api.alpaca.markets");
  assert.equal(calls[0]!.url.protocol, "https:");
  assert.ok(!calls[0]!.url.toString().includes(FAKE_ENV.ALPACA_PAPER_API_SECRET_KEY));
  assert.equal(calls[0]!.headers["APCA-API-KEY-ID"], settings.alpaca.keyId);
});

test("a hostile path cannot leave the paper host", async () => {
  const { calls, client } = fake([json({}), json({})]);
  const raw = client as unknown as { once(method: string, path: string): Promise<unknown> };
  await assert.rejects(raw.once("GET", "//evil.example/v2/x"), /outside \/v2\//);
  await assert.rejects(raw.once("GET", "https://evil.example/v2/x"), /outside \/v2\//);
  assert.equal(calls.length, 0);
  // A path that tries to smuggle a host stays a path on the paper host.
  await raw.once("GET", "/v2/@evil.example/x");
  assert.equal(calls[0]!.url.host, "paper-api.alpaca.markets");
});

test("reads retry on 500 and on a network error, then succeed", async () => {
  const { calls, client } = fake([new Response("boom", { status: 500 }), new Error("network"), json({ is_open: true, timestamp: "t", next_open: "o", next_close: "c" })]);
  assert.equal((await client.getClock()).isOpen, true);
  assert.equal(calls.length, 3);
});

test("reads do not retry a 401 or 404", async () => {
  const { calls, client } = fake([json({ message: "unauthorized" }, 401)]);
  await assert.rejects(client.getAccount(), (e: unknown) => e instanceof AlpacaError && e.status === 401);
  assert.equal(calls.length, 1);
});

test("an entry is a long market buy with a protective stop held at the broker", async () => {
  const { calls, client } = fake([json(orderJson())]);
  const o = await client.submitEntry(entry);
  const b = calls[0]!.body;
  assert.equal(b.side, "buy");
  assert.equal(b.order_class, "oto");
  assert.equal(b.type, "market");
  assert.equal(b.time_in_force, "day");
  assert.equal(b.stop_loss.stop_price, "95.00");
  assert.equal(b.client_order_id, entry.clientOrderId);
  assert.equal(o.legs[0]!.type, "stop");
});

test("bad entries are refused before anything is sent", async () => {
  const { calls, client } = fake([]);
  for (const bad of [
    { ...entry, qty: 0 }, { ...entry, qty: 1.5 }, { ...entry, qty: -2 },
    { ...entry, stopPrice: 100 }, { ...entry, stopPrice: 120 }, { ...entry, stopPrice: 0 },
    { ...entry, symbol: "aapl" }, { ...entry, symbol: "AAPL; DROP" },
    { ...entry, clientOrderId: "short" },
  ]) {
    await assert.rejects(client.submitEntry(bad), AlpacaError, JSON.stringify(bad));
  }
  assert.equal(calls.length, 0);
});

test("after a timeout the client asks Alpaca first, and does not send twice if the order landed", async () => {
  const { calls, client } = fake([new Error("timeout"), json(orderJson())]);
  const o = await client.submitEntry(entry);
  assert.equal(o.id, "o1");
  assert.deepEqual(calls.map((c) => c.method), ["POST", "GET"]);
  assert.equal(calls[1]!.url.pathname, "/v2/orders:by_client_order_id");
});

test("after a timeout where the order did not land, it sends once more with the same id", async () => {
  const { calls, client } = fake([new Error("timeout"), json({ message: "order not found" }, 404), json(orderJson())]);
  const o = await client.submitEntry(entry);
  assert.equal(o.id, "o1");
  assert.deepEqual(calls.map((c) => c.method), ["POST", "GET", "POST"]);
  assert.equal(calls[0]!.body.client_order_id, calls[2]!.body.client_order_id);
});

test("a duplicate id answer returns the existing order and sends nothing new", async () => {
  const { calls, client } = fake([json({ message: "client_order_id must be unique" }, 422), json(orderJson())]);
  const o = await client.submitEntry(entry);
  assert.equal(o.id, "o1");
  assert.equal(calls.filter((c) => c.method === "POST").length, 1);
});

test("a refused order (403, 422 other) is thrown, not retried", async () => {
  const { calls, client } = fake([json({ message: "insufficient buying power" }, 403)]);
  await assert.rejects(client.submitEntry(entry), /insufficient buying power/);
  assert.equal(calls.length, 1);
});

test("the borrowing cap setting accepts only 1, 2 or 4", async () => {
  const { calls, client } = fake([json({ max_margin_multiplier: "1", no_shorting: true, suspend_trade: false })]);
  await assert.rejects(client.setAccountConfig({ maxMarginMultiplier: 3 }), /1, 2 or 4/);
  const c = await client.setAccountConfig({ maxMarginMultiplier: 1, noShorting: true });
  assert.deepEqual(c, { maxMarginMultiplier: 1, noShorting: true, suspendTrade: false });
  assert.deepEqual(calls[0]!.body, { max_margin_multiplier: "1", no_shorting: true });
});

test("a cancel-all answer with a failed item is reported per item, not thrown, and the caller checks the orders", async () => {
  const { client, calls } = fake([json([{ id: "a", status: 200 }, { id: "b", status: 500, body: { message: "order not cancelable" } }], 207)]);
  const r = await client.cancelAllOrders();
  assert.equal(r.attempted, 2);
  assert.equal(r.failed.length, 1);
  assert.match(r.failed[0]!, /b: order not cancelable/);
  assert.equal(calls[0]!.method, "DELETE");
  assert.equal(calls[0]!.url.pathname, "/v2/orders");
});

test("cancelling waits out a 429 and treats an order that is already gone as cancelled", async () => {
  const id = "00000000-0000-0000-0000-000000000001";
  const { client, calls } = fake([json({ message: "rate limit exceeded" }, 429), new Response(null, { status: 204 })]);
  await client.cancelOrder(id);
  assert.equal(calls.length, 2);
  const gone = fake([json({ message: "order not found" }, 404)]);
  await gone.client.cancelOrder(id);
  const done = fake([json({ message: "order is already canceled" }, 422)]);
  await done.client.cancelOrder(id);
});

test("this client has no way to close positions in bulk or one by one: sells are explicit and go through submitSell", () => {
  const c = new AlpacaTrading(settings) as unknown as Record<string, unknown>;
  assert.equal(c.closeAllPositions, undefined);
  assert.equal(c.closePosition, undefined);
  assert.equal(typeof c.submitSell, "function");
});

const sellOrder = { symbol: "AAPL", qty: 3, clientOrderId: "cyrus-x-20261102-AAPL-abc-1" };
test("a sell is an explicit market sell with a client id", async () => {
  const { client, calls } = fake([json(orderJson({ side: "sell", order_class: "", legs: [] }))]);
  await client.submitSell(sellOrder);
  assert.deepEqual(calls[0]!.body, { symbol: "AAPL", qty: "3", side: "sell", type: "market", time_in_force: "day", client_order_id: sellOrder.clientOrderId });
});

test("a safety sell that meets a 429 waits and sends again with the SAME id, and never sends twice", async () => {
  const { client, calls } = fake([json({ message: "rate limit exceeded" }, 429), json({ message: "rate limit exceeded" }, 429), json(orderJson({ side: "sell", legs: [] }))]);
  const o = await client.submitSell(sellOrder);
  assert.equal(o.id, "o1");
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => c.body.client_order_id === sellOrder.clientOrderId));
  // a 429 on the entry path is NOT retried blindly: it asks Alpaca first
  const e = fake([json({ message: "rate limit exceeded" }, 429), json({ message: "not found" }, 404), json(orderJson())]);
  await e.client.submitEntry(entry);
  assert.equal(e.calls[1]!.url.pathname, "/v2/orders:by_client_order_id");
});

test("bad sells are refused before anything is sent", async () => {
  const { client, calls } = fake([]);
  await assert.rejects(client.submitSell({ ...sellOrder, qty: 0 }), /positive/);
  await assert.rejects(client.submitSell({ ...sellOrder, qty: -1 }), /positive/);
  await assert.rejects(client.submitSell({ ...sellOrder, symbol: "aapl" }), /Bad symbol/);
  await assert.rejects(client.submitSell({ ...sellOrder, clientOrderId: "x" }), /Bad client order id/);
  assert.equal(calls.length, 0);
});

test("an entry with a take-profit is a bracket: a limit sell and a protective stop, both held at the broker", async () => {
  const { client, calls } = fake([json(orderJson({ order_class: "bracket" }))]);
  await client.submitEntry({ ...entry, takeProfitPrice: 101.234 });
  assert.equal(calls[0]!.body.order_class, "bracket");
  assert.deepEqual(calls[0]!.body.take_profit, { limit_price: "101.24" }, "rounded up to the cent");
  assert.deepEqual(calls[0]!.body.stop_loss, { stop_price: "95.00" });
  await assert.rejects(fake([]).client.submitEntry({ ...entry, takeProfitPrice: 99 }), /Take-profit must be above/);
});

test("the order list is read in pages of 500 so a busy day is read in full", async () => {
  const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => orderJson({ id: `o${from + i}`, client_order_id: `cyrus-x-${from + i}`, created_at: new Date(Date.UTC(2026, 10, 2, 14, 30, 0, from + i)).toISOString() }));
  const { client, calls } = fake([json(page(0, 500)), json(page(500, 500)), json(page(1000, 120))]);
  const r = await client.listOrdersPaged("all", "2026-11-02T05:00:00.000Z");
  assert.equal(r.orders.length, 1120);
  assert.equal(r.complete, true);
  assert.equal(r.pages, 3);
  assert.equal(calls[1]!.url.searchParams.get("after"), new Date(Date.UTC(2026, 10, 2, 14, 30, 0, 499)).toISOString());
  const stuck = fake([json(page(0, 500)), json(page(0, 500))]);
  const s2 = await stuck.client.listOrdersPaged("all", "x", 2);
  assert.equal(s2.complete, false, "it never claims completeness when it stopped early");
});

test("every answer's rate-limit headers are reported to a listener, and a listener that throws changes nothing", async () => {
  const seen: unknown[] = [];
  const impl = (async () => new Response("{}", { status: 200, headers: { "x-ratelimit-limit": "200", "x-ratelimit-remaining": "150", "x-ratelimit-reset": "123" } })) as unknown as typeof fetch;
  const c = new AlpacaTrading(settings, { fetchImpl: impl, retryDelayMs: 0, onRate: (i) => { seen.push(i); throw new Error("boom"); } });
  await c.getClock();
  assert.deepEqual(seen, [{ path: "/v2/clock", status: 200, limit: 200, remaining: 150, reset: 123 }]);
});

test("error text carries no key", async () => {
  const { client } = fake([json({ message: "forbidden" }, 403)]);
  await assert.rejects(client.getAccount(), (e: Error) => !e.message.includes(FAKE_ENV.ALPACA_PAPER_API_SECRET_KEY) && !e.message.includes(FAKE_ENV.ALPACA_PAPER_API_KEY_ID));
});

test("the client can turn long only on but never allow shorting again", async () => {
  const { calls, client } = fake([]);
  await assert.rejects(client.setAccountConfig({ noShorting: false }), /long only/);
  await assert.rejects(client.setAccountConfig({ maxMarginMultiplier: 2, noShorting: false }), /long only/);
  assert.equal(calls.length, 0);
});

test("requests refuse redirects, so key headers never follow one", async () => {
  let seen: RequestInit | undefined;
  const client = new AlpacaTrading(settings, { fetchImpl: (async (_u: URL | string, init?: RequestInit) => { seen = init; return json({ status: "ACTIVE" }); }) as typeof fetch, retryDelayMs: 0 });
  await client.getAccount();
  assert.equal(seen?.redirect, "error");
});

test("after a timeout where the lookup also fails, the error is raised and nothing is sent twice", async () => {
  const { calls, client } = fake([new Error("timeout"), json({ message: "boom" }, 500), json({ message: "boom" }, 500), json({ message: "boom" }, 500)]);
  await assert.rejects(client.submitEntry(entry));
  assert.equal(calls.filter((c) => c.method === "POST").length, 1);
});

test("a second send that gets a duplicate answer raises that answer and never sends a third time", async () => {
  const { calls, client } = fake([new Error("timeout"), json({ message: "order not found" }, 404), json({ message: "client_order_id must be unique" }, 422)]);
  await assert.rejects(client.submitEntry(entry), /client_order_id/);
  assert.equal(calls.filter((c) => c.method === "POST").length, 2);
});

// After an unclear first send the order may exist, so NO later error may look like a definite refusal.
// The gate treats status 502 (and any 5xx, 429 or network error) as unclear, and a plain 4xx as a definite no.
test("after an unclear first send, a lookup that answers 403 is raised as unclear (502), not as a refusal", async () => {
  const { calls, client } = fake([new Error("timeout"), json({ message: "forbidden" }, 403)]);
  await assert.rejects(client.submitEntry(entry), (e: any) => e instanceof AlpacaError && e.status === 502 && /still unclear/.test(e.message));
  assert.equal(calls.filter((c) => c.method === "POST").length, 1, "nothing sent twice");
});

test("after an unclear first send and a clean 'not found', a second send that gets a 403 is still unclear (502)", async () => {
  const { client } = fake([new Error("timeout"), json({ message: "order not found" }, 404), json({ message: "forbidden" }, 403)]);
  await assert.rejects(client.submitEntry(entry), (e: any) => e instanceof AlpacaError && e.status === 502);
});

test("a first send refused outright (a clean 403) is still a definite refusal and is not looked up", async () => {
  const { calls, client } = fake([json({ message: "forbidden" }, 403)]);
  await assert.rejects(client.submitEntry(entry), (e: any) => e instanceof AlpacaError && e.status === 403);
  assert.equal(calls.length, 1);
});
