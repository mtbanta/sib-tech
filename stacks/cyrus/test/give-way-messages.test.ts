// The speed release, group 2 round 1, item 4: the give-way texts (Michael's ruling 6 of 2026-11-16, option (a): running side-by-side
// missing-exit sales give way at their next step once a sale of the whole account is asked for). In the worker, with lost exits on held
// positions whose sales Alpaca holds, a `flatten` (or the daily loss stop's sale) is asked while the side-by-side sales run; the exact texts
// each logs are checked here. A give-way is not a failed sale.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, D } from "./rig.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { FakeBot } from "./helpers.ts";
import { shouldStoreEvent } from "../src/run-log.ts";

const iso = (ms: number) => new Date(ms).toISOString();

async function holdOne(sim: SimBroker, r: any, symbol: string, n = 1) {
  const id = clientOrderIdFor(D, symbol, n);
  await sim.submitEntry({ symbol, qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
  sim.fillEntry(id, 12);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  return id;
}

// Three held positions lose their exits at 20:40:05 UTC; their sales are held 8 s at Alpaca, then refused. `noRoom`: the worker's room rule
// says no, so later side-by-side sales wait (and log `side_by_side_waited`). The whole-account sale (`flatten`, or the loss stop's when
// `lossStop`) is asked 3 s after the exits are lost. Returns every log line.
async function giveWayRun(opts: { lossStop?: boolean; noRoom?: boolean } = {}) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const logs: Array<{ level: string; event: string; data: Record<string, any> }> = [];
  const holds: Array<{ until: number; res: () => void }> = [];
  let timed = false;
  const tsleep = (ms: number): Promise<void> => (timed ? new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res })) : sim.sleep(ms));
  const r: any = rig<SimBroker>({ broker: sim, sleep: tsleep, simClock: sim, bot: new FakeBot(), log: (level, event, data) => logs.push({ level, event, data: (data ?? {}) as Record<string, any> }) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  const wk: any = r.worker;
  await r.at("20:40:00");
  const bad = ["QXA", "QXB", "QXC"];
  for (const s of bad) await holdOne(sim, r, s);
  await r.at("20:40:01");
  if (opts.noRoom) wk.liquidator.d.sideBySideRoom = () => false;
  const loseAt = new Date(`${D}T20:40:05Z`).getTime();
  const realSell = sim.submitSell.bind(sim);
  sim.submitSell = async (x: any) => {
    if (bad.includes(x.symbol)) {
      await tsleep(8_000);
      throw new Error("held at Alpaca (test)");
    }
    return realSell(x);
  };
  const liq: any = wk.liquidator;
  timed = true;
  let nextPass = sim.simMs + 5_000;
  const askAt = loseAt + 3_000;
  let asked: Promise<unknown> | null = null;
  let lost = false;
  let peak = 0;
  while (sim.simMs < loseAt + 60_000) {
    if (!lost && sim.simMs >= loseAt) {
      lost = true;
      for (const s of bad) for (const l of sim.orders.find((o: any) => o.clientOrderId === clientOrderIdFor(D, s, 1))!.legs) await sim.cancelOrder(l.id);
    }
    peak = Math.max(peak, liq.sideBySideNow?.() ?? 0);
    if (!asked && sim.simMs >= askAt) {
      assert.ok(peak >= 1, "a side-by-side sale is running when the whole-account sale is asked for");
      asked = liq.flatten(opts.lossStop ? { reason: "daily loss stop", tradeDate: D, priority: true } : { reason: "flatten command", tradeDate: D });
    }
    if (sim.simMs >= nextPass) {
      void r.at(iso(sim.simMs));
      nextPass += 5_000;
    } else r.setNow(iso(sim.simMs + 100));
    for (const h of holds.filter((h) => h.until <= sim.simMs)) {
      holds.splice(holds.indexOf(h), 1);
      h.res();
    }
    await settle();
  }
  timed = false;
  for (const h of holds.splice(0)) h.res();
  await settle();
  wk.stop?.();
  const of = (event: string) => logs.filter((l) => l.event === event);
  console.log(`item 4 run (${opts.lossStop ? "loss stop" : "flatten"}${opts.noRoom ? ", no room" : ""}): side-by-side peak ${peak}; ${["unprotected_position_yielded", "liquidation_yielded", "liquidation_result", "side_by_side_waited"].map((e) => `${e} ${of(e).length}`).join(", ")}; yielded to: ${JSON.stringify(of("unprotected_position_yielded").map((l) => l.data.to))}`);
  return { logs, of, peak };
}

const GAVE_WAY_TO = "a sale of the whole account (gave way at its next step)";
const GAVE_WAY_ERROR = "stopped: a sale of the whole account was asked for and sells these shares";
const LOSS_STOP_TO = "the daily loss stop's sale";
const LOSS_STOP_ERROR = "stopped: the daily loss stop's sale goes first and sells these shares";

test("item 4: a side-by-side sale running when `flatten` is asked gives way at its next step, with exactly these texts (and a give-way is not a failed sale)", { timeout: 120_000 }, async () => {
  const run = await giveWayRun();
  const yielded = run.of("unprotected_position_yielded").filter((l) => l.data.to === GAVE_WAY_TO);
  assert.ok(yielded.length >= 1, `unprotected_position_yielded with "${GAVE_WAY_TO}": ${JSON.stringify(run.of("unprotected_position_yielded").map((l) => l.data))}`);
  assert.ok(yielded.every((l) => ["QXA", "QXB", "QXC"].includes(l.data.symbol)));
  assert.ok(run.of("unprotected_position_yielded").every((l) => [GAVE_WAY_TO, "a sale of the whole account (stood aside at its turn)"].includes(l.data.to)), "no other wording");
  const gaveWay = run.of("liquidation_yielded").filter((l) => l.data.to !== undefined);
  assert.ok(gaveWay.length >= 1, "liquidation_yielded with its `to`");
  assert.ok(gaveWay.every((l) => l.data.to === "a sale of the whole account"), JSON.stringify(gaveWay.map((l) => l.data)));
  const results = run.of("liquidation_result").filter((l) => (l.data.errors as string[]).includes(GAVE_WAY_ERROR));
  assert.ok(results.length >= 1, `liquidation_result with the error "${GAVE_WAY_ERROR}"`);
  assert.ok(!run.logs.some((l) => JSON.stringify(l.data).includes("loss stop's sale goes first")), "not the loss stop's wording");
  // A give-way is logged at info level, not as a failed sale.
  assert.ok([...yielded, ...gaveWay, ...results].every((l) => l.level === "info"));
  assert.equal(run.of("unprotected_position_failed").length + run.of("sell_failed").filter((l) => /whole account/.test(JSON.stringify(l.data))).length, 0);
  // The database's run log keeps the yield (with its symbol and `to`), the result (with the error), and since group 2 round 1 also
  // liquidation_yielded and side_by_side_waited (in STORED_INFO_EVENTS).
  assert.equal(shouldStoreEvent("info", "unprotected_position_yielded"), true);
  assert.equal(shouldStoreEvent("info", "liquidation_yielded"), true);
  assert.equal(shouldStoreEvent("info", "side_by_side_waited"), true);
  assert.equal(shouldStoreEvent("info", "side_by_side_lone_wait_over"), true);
  // The lone-sale rule replaced "the sale running alone always goes ahead" (group 2, round 4).
  assert.ok(!readFileSync(new URL("../src/sells.ts", import.meta.url), "utf8").includes("always goes"), "no comment says a lone sale always goes ahead");
  assert.equal(shouldStoreEvent("info", "liquidation_result"), true);
});

test("item 4: a side-by-side sale that waited for room logs side_by_side_waited (its symbol, how long, how many ran) before it gives way or stands aside", { timeout: 120_000 }, async () => {
  const run = await giveWayRun({ noRoom: true });
  const waited = run.of("side_by_side_waited");
  assert.ok(waited.length >= 1, "a later side-by-side sale waited for room");
  for (const l of waited) {
    for (const k of ["only", "running", "waitedMs"]) assert.ok(k in l.data, `${k} in side_by_side_waited`);
    assert.ok(Array.isArray(l.data.only) && l.data.only.length === 1 && ["QXA", "QXB", "QXC"].includes(l.data.only[0]));
    assert.ok(l.data.waitedMs > 0 && l.data.running >= 1);
  }
  // Whatever it waited for, its end is one of the two whole-account texts, never a failure. Here the waiting ones stand aside before
  // sending anything (their own stored texts) and the running one gives way.
  assert.ok(run.of("unprotected_position_yielded").every((l) => [GAVE_WAY_TO, "a sale of the whole account (stood aside at its turn)"].includes(l.data.to)));
  assert.ok(run.of("unprotected_position_yielded").some((l) => l.data.to === "a sale of the whole account (stood aside at its turn)"));
  assert.ok(run.of("liquidation_result").some((l) => (l.data.errors as string[]).includes("stood aside: a sale of the whole account was asked for and sells these shares")));
});

test("item 4: the same run with the daily loss stop's sale keeps the wording \"the daily loss stop's sale goes first\"", { timeout: 120_000 }, async () => {
  const run = await giveWayRun({ lossStop: true });
  const yielded = run.of("unprotected_position_yielded").filter((l) => l.data.to === LOSS_STOP_TO);
  assert.ok(yielded.length >= 1, `unprotected_position_yielded with "${LOSS_STOP_TO}": ${JSON.stringify(run.of("unprotected_position_yielded").map((l) => l.data))}`);
  assert.ok(run.of("liquidation_result").some((l) => (l.data.errors as string[]).includes(LOSS_STOP_ERROR)), `liquidation_result with "${LOSS_STOP_ERROR}"`);
  const ly = run.of("liquidation_yielded");
  assert.ok(ly.length >= 1 && ly.every((l) => l.data.to === undefined), "liquidation_yielded without a `to` (the loss stop's sale goes first)");
  assert.ok(!run.of("liquidation_result").some((l) => (l.data.errors as string[]).includes(GAVE_WAY_ERROR)), "not the whole-account wording");
});
