// The speed release of 2026-11-16 (Michael's approval, saved verbatim in builds/build-c2-log.md). Ruling 1: the order sync every 6 s, and
// every 2 s only while the live updates are down, started on time by a 1-second timed pass (his answer: "Timed checks only"; the full pass
// stays every 5 s). Ruling 4: the account and positions view every 20 s while the live updates are connected.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { rig } from "./rig.ts";
import { SYNC_EVERY_MS, SYNC_EVERY_STREAM_DOWN_MS, VIEW_EVERY_MS } from "../src/worker.ts";

async function session(orderStream = true) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const r: any = rig({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  const w: any = r.worker;
  const syncs: number[] = [];
  const orig = w.startSync.bind(w);
  w.startSync = (...a: unknown[]) => {
    if (w.backgroundReady("risk")) syncs.push(sim.simMs);
    return orig(...a);
  };
  const views: number[] = [];
  const rf = w.view.refreshFast.bind(w.view);
  w.view.refreshFast = () => (views.push(sim.simMs), rf());
  const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((x) => setImmediate(x)); };
  // One second at a time, running only the timed pass (as its 1 s timer does), from `fromMs` for `seconds` seconds.
  const second = async (fromMs: number, seconds: number) => {
    for (let i = 1; i <= seconds; i++) {
      r.setNow(new Date(fromMs + i * 1_000).toISOString());
      await w.timedTick();
      await settle();
    }
  };
  return { r, sim, w, syncs, views, second };
}

test("ruling 1: the constants are 6 s, 2 s while the live updates are down, and the view every 20 s", () => {
  assert.equal(SYNC_EVERY_MS, 6_000);
  assert.equal(SYNC_EVERY_STREAM_DOWN_MS, 2_000);
  assert.equal(VIEW_EVERY_MS, 20_000);
});

test("ruling 1: with the live updates connected, the timed pass starts the order sync every 6 s (not every 10 to 15 s)", async () => {
  const s = await session();
  const t0 = s.sim.simMs;
  s.syncs.length = 0;
  await s.second(t0, 30);
  const gaps = s.syncs.slice(1).map((t, i) => t - s.syncs[i]!);
  assert.ok(s.syncs.length >= 4, `${s.syncs.length} syncs in 30 s`);
  assert.ok(gaps.every((g) => g === 6_000), `every 6 s: ${gaps.join(", ")}`);
});

test("ruling 1: while the live updates are down, every 2 s; back to 6 s once they are live again", async () => {
  const s = await session();
  const t0 = s.sim.simMs;
  await s.r.orderStreamStatus("reconnecting");
  s.syncs.length = 0;
  await s.second(t0, 10);
  const gaps = s.syncs.slice(1).map((t, i) => t - s.syncs[i]!);
  assert.ok(s.syncs.length >= 4 && gaps.every((g) => g === 2_000), `every 2 s while down: ${gaps.join(", ")}`);
  await s.r.orderStreamStatus("live"); // the reconnect brings its own sync at once (v24)
  s.syncs.length = 0;
  const t1 = s.sim.simMs;
  await s.second(t1, 20);
  const gaps2 = s.syncs.slice(1).map((t, i) => t - s.syncs[i]!);
  assert.ok(gaps2.length >= 2 && gaps2.every((g) => g === 6_000), `every 6 s again: ${gaps2.join(", ")}`);
});

test("ruling 1: the timed pass does nothing outside the session, and the full pass still starts a due sync on its own", async () => {
  const s = await session();
  await s.r.at("21:05:00"); // after the close
  s.syncs.length = 0;
  await s.second(s.sim.simMs, 10);
  assert.equal(s.syncs.length, 0, "no sync after the close");
  const t = await session();
  t.syncs.length = 0;
  await t.r.at("14:30:12"); // the full pass alone, 7 s after the last sync
  assert.equal(t.syncs.length, 1, "the full pass starts a sync that is due");
});

test("ruling 4: with the live updates connected the account and positions view is read every 20 s; while they are down every 5 s", async () => {
  const s = await session();
  const t0 = s.sim.simMs;
  s.views.length = 0;
  await s.second(t0, 61);
  const gaps = s.views.slice(1).map((t, i) => t - s.views[i]!);
  assert.ok(s.views.length >= 3 && gaps.every((g) => g >= 19_500 && g <= 20_000), `about every 20 s: ${gaps.join(", ")}`);
  await s.r.orderStreamStatus("reconnecting");
  s.views.length = 0;
  await s.second(s.sim.simMs, 21);
  const gaps2 = s.views.slice(1).map((t, i) => t - s.views[i]!);
  assert.ok(s.views.length >= 4 && gaps2.every((g) => g >= 4_500 && g <= 5_000), `about every 5 s while down: ${gaps2.join(", ")}`);
});

// Item 4 (Michael's messaging fix of 2026-11-16): his deploy approval line is acknowledged, never acted on.
import { parseCommand } from "../src/morning.ts";
import { MemoryStore } from "../src/store.ts";
import { FakeBroker } from "./helpers.ts";
import { D } from "./rig.ts";

test("item 4: 'Yes, deploy <commit> now.' is recognised; near misses are not", () => {
  assert.deepEqual(parseCommand("Yes, deploy 20ba5bd now."), { kind: "deployApproval", commit: "20ba5bd" });
  assert.deepEqual(parseCommand("  yes deploy 20BA5BD0F now  "), { kind: "deployApproval", commit: "20ba5bd0f" });
  assert.equal(parseCommand("Yes, deploy now.").kind, "unknown");
  assert.equal(parseCommand("Yes, deploy 20ba5bd").kind, "unknown", "without 'now'");
  assert.equal(parseCommand("Yes, deploy main now.").kind, "unknown", "not a commit id");
  assert.equal(parseCommand("Yes, deploy 20ba5bd now. And flatten").kind, "unknown", "nothing after it");
});

test("item 4: the bot replies with the acknowledgement and changes nothing (no stop flag, no limits, no deploy, no orders)", async () => {
  const r: any = rig<FakeBroker, MemoryStore>({ orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  const before = JSON.stringify({ day: await r.store.getDay(D), stop: await r.store.getControl("stop_flag") });
  const calls = r.broker.calls.length;
  const n = r.said("commands").length;
  r.ownerSays("Yes, deploy 20ba5bd now.", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  const replies = r.said("commands").slice(n);
  assert.ok(replies.includes("Deploy approval for 20ba5bd noted; the builder will deploy it if every check passes."), replies.join(" | "));
  assert.ok(!replies.some((t: string) => t.includes("did not understand")));
  assert.equal(JSON.stringify({ day: await r.store.getDay(D), stop: await r.store.getControl("stop_flag") }), before, "nothing stored");
  assert.equal(r.broker.calls.slice(calls).filter((c: any) => /submit|cancel|setAccount|patch/i.test(c.fn)).length, 0, "no order or account call");
});
