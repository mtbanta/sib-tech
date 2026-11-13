// Round 9: round 8's blocking finding. While the daily loss stop is in force the missing-exit check stands aside (the loss
// stop's own retry re-sells what is held); that pause is tied to the stop flag itself, so Michael's `resume` ends it.
// Checked to fail without the fix (recorded in builds/build-c2-log.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { AlpacaError } from "../src/alpaca-trading.ts";
import { CONTROL_STOP, MemoryStore, type StopFlag } from "../src/store.ts";
import { FakeBroker, order } from "./helpers.ts";
import { D, rig, settle, z } from "./rig.ts";

const plus = (t: string, seconds: number) => new Date(z(t).getTime() + seconds * 1000).toISOString();

test("loss stop fires, its sale fails, Michael resumes: the position left without a protective stop is sold, with an alert", async () => {
  const r = rig<FakeBroker, MemoryStore>();
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("loss 200\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.broker.clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "2026-11-02T21:00:00Z" };
  await r.at("14:25:00");
  assert.ok((await r.store.getDay(D))!.phases.armed, "armed");
  // 20 AAA held, entered today, with its protective stop resting at Alpaca.
  const entryId = "cyrus-20261102-AAA-1";
  r.broker.orders = [order({ id: "00000000-0000-0000-0000-0000000000e1", clientOrderId: entryId, symbol: "AAA", side: "buy", qty: 20, filledQty: 20, filledAvgPrice: 50, status: "filled", orderClass: "bracket", legs: [order({ id: "00000000-0000-0000-0000-0000000000e2", clientOrderId: `${entryId}-sl`, symbol: "AAA", side: "sell", qty: 20, type: "stop", stopPrice: 49, status: "new" })] })];
  r.broker.positions = [{ symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 }];
  await r.store.insertOrder({ clientOrderId: entryId, tradeDate: D, symbol: "AAA", qty: 20, referencePrice: 50, stopPrice: 49, status: "filled", alpacaOrderId: "00000000-0000-0000-0000-0000000000e1", filledQty: 20, filledAvgPrice: 50, note: null, createdAt: "2026-11-02T14:40:00.000Z" });
  await r.at("14:50:00");

  // 1. The loss stop fires. Its sale cancels AAA's exits, and then Alpaca refuses the sell.
  r.broker.onSell = async () => { throw new AlpacaError("sell refused (test)", 403); };
  r.broker.account = { ...r.broker.account, equity: 19500 };
  for (let s = 5; s <= 30; s += 5) await r.at(plus("14:50:00", s));
  await settle();
  assert.equal((await r.store.getControl<StopFlag>(CONTROL_STOP))?.on, true, "the loss stop fired");
  assert.equal(r.broker.positions.length, 1, "and its sale failed: AAA is still held");
  assert.ok(r.broker.orders[0]!.legs.every((l) => l.status === "canceled"), "with no protective order left at Alpaca");

  // 2. Equity recovers above the line, Alpaca accepts sells again, and Michael sends `resume`.
  r.broker.account = { ...r.broker.account, equity: 19990 };
  r.broker.onSell = null;
  r.ownerSays("resume", plus("14:50:00", 31));
  await r.at(plus("14:50:00", 35));
  assert.equal((await r.store.getControl<StopFlag>(CONTROL_STOP))?.on, false, "resumed");

  // 3. The missing-exit check (every 30 seconds) watches again and sells the bare position, and says so.
  for (let s = 40; s <= 100; s += 5) await r.at(plus("14:50:00", s));
  await settle();
  assert.equal(r.broker.positions.length, 0, "AAA, left without a protective stop, is sold");
  assert.ok(r.said("alerts").some((t) => t.includes("AAA: I could not confirm a live protective stop, so I sold it")), "with an alert");
});
