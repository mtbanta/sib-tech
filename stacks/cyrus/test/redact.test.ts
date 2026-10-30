import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRedactor } from "../src/redact.ts";
import { makeLogger, describeError } from "../src/log.ts";

test("exact secret values are hidden, longest first", () => {
  const r = makeRedactor(["abcdefgh12345678", "abcdefgh12345678-and-more"]);
  assert.equal(r("x abcdefgh12345678-and-more y"), "x [redacted] y");
  assert.equal(r("x abcdefgh12345678 y"), "x [redacted] y");
});

test("key-shaped strings are hidden even when not on the list", () => {
  const r = makeRedactor([]);
  for (const s of [
    "https://discord.com/api/webhooks/123456789012345678/abcDEF_ghi-JKL", // scan-allow-fake
    "https://hc-ping.com/12345678-1234-1234-1234-123456789012", // scan-allow-fake
    "postgresql://postgres:hunter2pass@db.example.com:5432/postgres", // scan-allow-fake
    "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.abcdefghijk", // scan-allow-fake
    "PKABCDEFGHIJKLMNOPQRSTUV12", // scan-allow-fake
    ["MTIzNDU2Nzg5MDEyMzQ1Njc4OQ", "GabcDE", "abcdefghijklmnopqrstuvwxyz1"].join("."), // scan-allow-fake (built at run time so the file never holds a token shape)
  ]) {
    assert.ok(r(`before ${s} after`).includes("[redacted]"), s);
    assert.ok(!r(`before ${s} after`).includes(s.slice(-12)), s);
  }
});

test("ordinary text is untouched", () => {
  const r = makeRedactor(["abcdefgh12345678"]);
  assert.equal(r("bought 10 AAPL at 343.43"), "bought 10 AAPL at 343.43");
});

test("the logger redacts the whole line and writes one json object", () => {
  const lines: string[] = [];
  const log = makeLogger(makeRedactor(["supersecretvalue123"]), (l) => lines.push(l));
  log("info", "test", { note: "token supersecretvalue123 here" });
  assert.equal(lines.length, 1);
  assert.ok(!lines[0]!.includes("supersecretvalue123"));
  const parsed = JSON.parse(lines[0]!);
  assert.equal(parsed.event, "test");
  assert.equal(parsed.level, "info");
});

test("describeError hides secrets in the message and in the cause", () => {
  const r = makeRedactor(["supersecretvalue123"]);
  const err = new Error("failed calling https://x/supersecretvalue123", { cause: new Error("inner supersecretvalue123") });
  const text = describeError(err, r);
  assert.ok(!text.includes("supersecretvalue123"));
  assert.ok(text.includes("failed calling"));
});
