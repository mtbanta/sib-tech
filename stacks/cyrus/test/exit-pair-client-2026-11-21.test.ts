// The exit pair (Michael's approval of 2026-11-21): the Alpaca client's OCO body, as Alpaca's documentation gives it (read 2026-11-21):
// order_class "oco", type "limit", take_profit.limit_price, stop_loss.stop_price; exit orders only; the stop at least 1 cent below the limit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AlpacaTrading } from "../src/alpaca-trading.ts";
import { loadSettings } from "../src/config.ts";
import { FAKE_ENV } from "./fakes.ts";

const settings = loadSettings({ ...FAKE_ENV });
function fake(replies: Response[]) {
  const calls: Array<{ method: string; path: string; body: any }> = [];
  const impl = (async (url: URL | string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? "GET", path: new URL(String(url)).pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const next = replies.shift();
    if (!next) throw new Error("unexpected extra call");
    return next;
  }) as typeof fetch;
  return { calls, client: new AlpacaTrading(settings, { fetchImpl: impl, retryDelayMs: 0 }) };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const pairJson = { id: "p1", client_order_id: "cyrus-p-20261123-AAPL-abc-s1", symbol: "AAPL", side: "sell", qty: "4", filled_qty: "0", filled_avg_price: null, status: "new", order_class: "oco", type: "limit", limit_price: "101.08", legs: [{ id: "p2", client_order_id: "leg", symbol: "AAPL", side: "sell", qty: "4", filled_qty: "0", status: "held", type: "stop", stop_price: "99.87" }] };
const pair = { symbol: "AAPL", qty: 4, clientOrderId: "cyrus-p-20261123-AAPL-abc-s1", stopPrice: 99.874, takeProfitPrice: 101.089 };

test("exit pair: one OCO order, prices rounded down to the cent, time in force day, the client id kept; parsed with its stop leg", async () => {
  const { client, calls } = fake([json(pairJson)]);
  const o = await client.submitSell(pair);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.path, "/v2/orders");
  assert.deepEqual(calls[0]!.body, { symbol: "AAPL", qty: "4", side: "sell", type: "limit", time_in_force: "day", order_class: "oco", client_order_id: pair.clientOrderId, take_profit: { limit_price: "101.08" }, stop_loss: { stop_price: "99.87" } });
  assert.equal(o.orderClass, "oco");
  assert.equal(o.legs[0]!.stopPrice, 99.87);
  assert.deepEqual(AlpacaTrading.exitPairBody(pair, "101.08", "99.87"), calls[0]!.body, "the trial runner sends the same body");
});

test("exit pair: refused before sending without a stop, with the stop not at least 1 cent below the limit after rounding, or a bad price", async () => {
  const { client, calls } = fake([]);
  await assert.rejects(client.submitSell({ ...pair, stopPrice: undefined }), /needs a stop price/);
  await assert.rejects(client.submitSell({ ...pair, takeProfitPrice: 99.879 }), /at least 1 cent below/);
  await assert.rejects(client.submitSell({ ...pair, takeProfitPrice: 99.889, stopPrice: 99.885 }), /at least 1 cent below/, "99.88 and 99.88 after rounding down");
  await assert.rejects(client.submitSell({ ...pair, takeProfitPrice: 0 }), /positive/);
  await assert.rejects(client.submitSell({ ...pair, takeProfitPrice: Number.NaN }), /positive/);
  assert.equal(calls.length, 0);
});

test("a plain stop and a market sell are unchanged (no take-profit given)", async () => {
  const { client, calls } = fake([json({ ...pairJson, order_class: "", type: "stop", legs: [] }), json({ ...pairJson, order_class: "", type: "market", legs: [] })]);
  await client.submitSell({ symbol: "AAPL", qty: 4, clientOrderId: pair.clientOrderId, stopPrice: 99.87 });
  await client.submitSell({ symbol: "AAPL", qty: 4, clientOrderId: "cyrus-x-20261123-AAPL-abc-1" });
  assert.deepEqual(calls[0]!.body, { symbol: "AAPL", qty: "4", side: "sell", type: "stop", time_in_force: "day", client_order_id: pair.clientOrderId, stop_price: "99.87" });
  assert.deepEqual(calls[1]!.body, { symbol: "AAPL", qty: "4", side: "sell", type: "market", time_in_force: "day", client_order_id: "cyrus-x-20261123-AAPL-abc-1" });
});
