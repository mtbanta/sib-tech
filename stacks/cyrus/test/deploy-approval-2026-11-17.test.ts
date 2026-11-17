// Michael's bug fix request of 2026-11-17 (ported from item 4 of the speed release): his deploy approval line is acknowledged, never acted on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand } from "../src/morning.ts";
import { MemoryStore } from "../src/store.ts";
import { FakeBroker } from "./helpers.ts";
import { D, rig } from "./rig.ts";

test("'Yes, deploy <commit> now.' is recognised; near misses are not", () => {
  assert.deepEqual(parseCommand("Yes, deploy dd104f7 now."), { kind: "deployApproval", commit: "dd104f7" });
  assert.deepEqual(parseCommand("  yes deploy DD104F70 now  "), { kind: "deployApproval", commit: "dd104f70" });
  assert.equal(parseCommand("Yes, deploy now.").kind, "unknown");
  assert.equal(parseCommand("Yes, deploy dd104f7").kind, "unknown", "without 'now'");
  assert.equal(parseCommand("Yes, deploy main now.").kind, "unknown", "not a commit id");
  assert.equal(parseCommand("Yes, deploy dd104f now.").kind, "unknown", "fewer than 7 characters");
  assert.equal(parseCommand("Yes, deploy dd104f7 now. And flatten").kind, "unknown", "nothing after it");
  assert.equal(parseCommand("flatten").kind, "flatten", "other commands unchanged");
});

test("the bot replies with the acknowledgement and changes nothing (no stop flag, no limits, no deploy, no orders)", async () => {
  const r: any = rig<FakeBroker, MemoryStore>({ orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  const before = JSON.stringify({ day: await r.store.getDay(D), stop: await r.store.getControl("stop_flag") });
  const calls = r.broker.calls.length;
  const n = r.said("commands").length;
  r.ownerSays("Yes, deploy dd104f7 now.", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  const replies = r.said("commands").slice(n);
  assert.ok(replies.includes("Deploy approval for dd104f7 noted; the builder will deploy it if every check passes."), replies.join(" | "));
  assert.ok(!replies.some((t: string) => t.includes("did not understand")));
  assert.equal(JSON.stringify({ day: await r.store.getDay(D), stop: await r.store.getControl("stop_flag") }), before, "nothing stored");
  assert.equal(r.broker.calls.slice(calls).filter((c: any) => /submit|cancel|setAccount|patch/i.test(c.fn)).length, 0, "no order or account call");
});
