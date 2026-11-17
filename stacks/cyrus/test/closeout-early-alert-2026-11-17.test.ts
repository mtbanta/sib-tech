// Question 5 of 2026-11-16, Michael's morning decision 2 of 2026-11-17 (builds/build-c2-log.md, "Michael's morning decisions (2026-11-17)"):
// the regular close-out posts the NOT FLAT alert once, 3 minutes after it started, while it keeps waiting for Alpaca to fill its own sells
// (CLOSEOUT_EARLY_ALERT_MS in src/closeout.ts). Each test is meant to fail with the change taken out where it says so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { CLOSEOUT_EARLY_ALERT_MS, closeOut, type CloseoutPath } from "../src/closeout.ts";
import { MemoryStore } from "../src/store.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";

const CLOSE = new Date(Date.UTC(2026, 10, 2, 21, 0)); // 3:00 PM Central
const AT_245 = CLOSE.getTime() - 15 * 60_000;
const AT_255 = CLOSE.getTime() - 5 * 60_000;

// `slowSay`: a Discord post of the early alert that never finishes (the look loop must not wait for it).
function world(startMs: number, o: { slowSay?: boolean } = {}) {
  const sim = new SimBroker(startMs);
  const said: Array<{ ch: string; text: string; mention?: boolean; at: number }> = [];
  const say = (ch: string, text: string, opts?: { mentionOwner?: boolean }): Promise<boolean> => {
    said.push({ ch, text, mention: opts?.mentionOwner, at: sim.simMs });
    if (o.slowSay && text.includes("minutes into the close-out")) return new Promise<boolean>(() => undefined);
    return Promise.resolve(true);
  };
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
  const store = new MemoryStore();
  const events: Array<{ level: string; event: string; data: any }> = [];
  const origAdd = store.addEvent.bind(store);
  store.addEvent = async (level: string, event: string, data?: Record<string, unknown>) => (events.push({ level, event, data }), origAdd(level as any, event, data));
  const now = () => new Date(sim.simMs);
  return { sim, said, say, liquidator, store, events, now };
}

async function hold(w: ReturnType<typeof world>, symbol: string, qty: number, price: number) {
  const id = clientOrderIdFor(D, symbol, 1);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price - 0.06, takeProfitPrice: price + 0.01, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
}

async function run(startMs: number, fillDelayMs: number, path?: CloseoutPath, o: { slowSay?: boolean } = {}) {
  const w = world(startMs - 6 * 3600_000, o);
  await hold(w, "ADT", 7, 9.9);
  w.sim.advanceTo(startMs);
  w.sim.sellFillDelayMs = fillDelayMs;
  const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say, sleep: w.sim.sleep }, D, { closeAt: CLOSE, ...(path ? { path } : {}) });
  const notFlat = w.said.filter((m) => m.ch === "alerts" && m.text.includes("NOT FLAT"));
  return { ...w, res, notFlat };
}

test("question 5: at 2:45, sells still unfilled 3 minutes in: one early NOT FLAT alert (alerts with the mention, and commands), the wait goes on, and the account ends flat with one update line", async () => {
  assert.equal(CLOSEOUT_EARLY_ALERT_MS, 180_000);
  const w = await run(AT_245, 5 * 60_000); // Alpaca fills the close-out's sell 5 minutes after it was sent
  assert.deepEqual(w.res, { flat: true, remaining: [] });
  assert.equal(w.notFlat.length, 1, w.said.map((m) => m.text).join("\n"));
  const early = w.notFlat[0]!;
  assert.match(early.text, /NOT FLAT 3 minutes into the close-out: ADT\.\*\* 1 sell sent at .*; Alpaca has not filled it yet\. Every share still held is covered by a sell of ours, so I keep waiting until 2:58 PM.* and will post again\./);
  assert.equal(early.mention, true);
  assert.ok(early.at >= AT_245 + 180_000 && early.at < AT_245 + 185_000, `posted about 3 minutes in (${(early.at - AT_245) / 1000} s)`);
  assert.ok(w.said.some((m) => m.ch === "commands" && m.text.includes("minutes into the close-out")));
  const update = w.said.filter((m) => m.text.startsWith("Update: the close-out is now flat"));
  assert.equal(update.length, 1);
  assert.equal(update[0]!.ch, "alerts");
  assert.equal(w.said.filter((m) => m.text.includes("Close-out done")).length, 1);
  // Messages only: one closeout_result at the end (flat), one stored warning for the early alert.
  assert.deepEqual(w.events.filter((e) => e.event === "closeout_result").map((e) => e.data.flat), [true]);
  const ev = w.events.filter((e) => e.event === "closeout_waiting_alert");
  assert.equal(ev.length, 1);
  assert.equal(ev[0]!.level, "warn");
  assert.deepEqual(ev[0]!.data.remaining, ["ADT"]);
  assert.equal(w.sim.oversellAttempts, 0);
});

test("question 5: at 2:45, never filled: the early alert at 3 minutes, then the final NOT FLAT at the 2:58 deadline as before", async () => {
  const w = await run(AT_245, 30 * 60_000);
  assert.equal(w.res.flat, false);
  assert.equal(w.notFlat.length, 2, w.notFlat.map((m) => m.text).join("\n"));
  assert.match(w.notFlat[0]!.text, /minutes into the close-out/);
  assert.match(w.notFlat[1]!.text, /NOT FLAT after the close-out: ADT\.\*\* 1 sell sent at .* for ADT; Alpaca had not filled it by/);
  assert.ok(w.sim.simMs >= CLOSE.getTime() - 2 * 60_000, "it kept waiting to the deadline");
  assert.ok(!w.said.some((m) => m.text.startsWith("Update:")));
  assert.deepEqual(w.events.filter((e) => e.event === "closeout_result").map((e) => e.data.flat), [false]);
});

test("question 5: with the close-out at 2:55 (the setting at 5), the 3 minutes end at the deadline: only the final NOT FLAT, no double alert", async () => {
  const w = await run(AT_255, 30 * 60_000);
  assert.equal(w.res.flat, false);
  assert.equal(w.notFlat.length, 1, w.notFlat.map((m) => m.text).join("\n"));
  assert.match(w.notFlat[0]!.text, /NOT FLAT after the close-out/);
  assert.ok(!w.events.some((e) => e.event === "closeout_waiting_alert"));
});

test("question 5: filled within 3 minutes: no early alert, as before", async () => {
  const w = await run(AT_245, 60_000);
  assert.deepEqual(w.res, { flat: true, remaining: [] });
  assert.equal(w.notFlat.length, 0);
  assert.ok(!w.said.some((m) => m.text.startsWith("Update:")));
});

test("question 5: only the regular close-out: its retry path keeps the old behaviour (no early alert)", async () => {
  const w = await run(AT_245, 5 * 60_000, "retry");
  assert.deepEqual(w.res, { flat: true, remaining: [] });
  assert.equal(w.notFlat.length, 0, w.notFlat.map((m) => m.text).join("\n"));
  assert.ok(!w.events.some((e) => e.event === "closeout_waiting_alert"));
});

test("question 5: the early alert is not waited for: a Discord post that never finishes does not hold up the looks", async () => {
  const w = await run(AT_245, 5 * 60_000, undefined, { slowSay: true });
  assert.deepEqual(w.res, { flat: true, remaining: [] }, "the wait went on and saw the fill");
  assert.equal(w.notFlat.length, 1);
});
