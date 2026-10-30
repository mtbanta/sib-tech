import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../src/store.ts";
import { runStoreContract } from "../src/store-contract.ts";

test("the in-memory store passes the store behaviour check", async () => {
  assert.deepEqual(await runStoreContract(new MemoryStore()), []);
});

test("the in-memory store can be made to fail, for fail-closed tests", async () => {
  const s = new MemoryStore();
  s.failing = true;
  await assert.rejects(s.getControl("x"));
});
