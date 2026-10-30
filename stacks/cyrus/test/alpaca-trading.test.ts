import { test } from "node:test";
import assert from "node:assert/strict";
import { AlpacaTrading, AlpacaError } from "../src/alpaca-trading.ts";
import { loadSettings } from "../src/config.ts";

const settings = loadSettings({
  ALPACA_PAPER_API_KEY_ID: "PKTESTTESTTESTTESTTEST1234", // scan-allow-fake
  ALPACA_PAPER_API_SECRET_KEY: "fakeSecretFakeSecretFakeSecretFakeSecret12",
  DISCORD_BOT_TOKEN: "fakeBotTokenFakeBotTokenFakeBotTokenFakeBotTokenFakeBotToken1",
  DISCORD_GUILD_ID: "123456789012345678",
  DISCORD_COMMAND_CHANNEL_ID: "223456789012345678",
  DISCORD_OWNER_USER_ID: "323456789012345678",
  DISCORD_ALERTS_WEBHOOK_URL: "https://discord.com/api/webhooks/123456789012345678/fakeWebhookTokenFake", // scan-allow-fake
  HEALTHCHECKS_PING_URL: "https://hc-ping.com/12345678-1234-1234-1234-123456789012", // scan-allow-fake
});

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
  assert.ok(!calls[0]!.url.toString().includes("fakeSecret"));
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

test("a 207 bulk answer with a failed item is an error", async () => {
  const { client } = fake([json([{ symbol: "AAPL", status: 200 }, { symbol: "MSFT", status: 500 }], 207)]);
  await assert.rejects(client.closeAllPositions(), /MSFT/);
  const ok = fake([json([{ symbol: "AAPL", status: 200 }], 207)]);
  await ok.client.closeAllPositions();
  assert.equal(ok.calls[0]!.url.searchParams.get("cancel_orders"), "true");
});

test("error text carries no key", async () => {
  const { client } = fake([json({ message: "forbidden" }, 403)]);
  await assert.rejects(client.getAccount(), (e: Error) => !e.message.includes("fakeSecret") && !e.message.includes("PKTEST"));
});
