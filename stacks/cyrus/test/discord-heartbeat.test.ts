import { test } from "node:test";
import { FAKE_WEBHOOK } from "./fakes.ts";
import assert from "node:assert/strict";
import { postWebhook } from "../src/discord.ts";
import { ping } from "../src/heartbeat.ts";
import { makeRedactor } from "../src/redact.ts";

const redact = makeRedactor(["supersecretvalue123"]);

function recorder(responses: Array<Response | Error>) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return { calls, impl };
}

test("postWebhook sends redacted, bounded text with mentions disabled", async () => {
  const { calls, impl } = recorder([new Response(null, { status: 204 })]);
  const res = await postWebhook(FAKE_WEBHOOK, "hello supersecretvalue123 " + "a".repeat(3000), redact, impl);
  assert.deepEqual(res, { ok: true, status: 204 });
  const body = JSON.parse(String(calls[0]!.init!.body));
  assert.ok(!body.content.includes("supersecretvalue123"));
  assert.ok(body.content.length <= 2000);
  assert.deepEqual(body.allowed_mentions, { parse: [] });
});

test("postWebhook retries once after a rate limit", async () => {
  const { calls, impl } = recorder([
    new Response(null, { status: 429, headers: { "retry-after": "0" } }),
    new Response(null, { status: 204 }),
  ]);
  const res = await postWebhook(FAKE_WEBHOOK, "hi", redact, impl);
  assert.equal(res.ok, true);
  assert.equal(calls.length, 2);
});

test("postWebhook reports failure instead of throwing", async () => {
  assert.deepEqual(await postWebhook(FAKE_WEBHOOK, "hi", redact, recorder([new Error("network down")]).impl), { ok: false, status: 0 });
  assert.deepEqual(await postWebhook(FAKE_WEBHOOK, "hi", redact, recorder([new Response(null, { status: 404 })]).impl), { ok: false, status: 404 });
});

test("ping uses the plain url, /start and /fail, and reports failure", async () => {
  const { calls, impl } = recorder([new Response("OK"), new Response("OK"), new Response("OK"), new Error("down"), new Response("no", { status: 500 })]);
  assert.equal(await ping("https://hc-ping.com/abc/", "ok", impl), true);
  assert.equal(await ping("https://hc-ping.com/abc", "start", impl), true);
  assert.equal(await ping("https://hc-ping.com/abc", "fail", impl), true);
  assert.equal(await ping("https://hc-ping.com/abc", "ok", impl), false);
  assert.equal(await ping("https://hc-ping.com/abc", "ok", impl), false);
  assert.deepEqual(calls.slice(0, 3).map((c) => c.url), ["https://hc-ping.com/abc", "https://hc-ping.com/abc/start", "https://hc-ping.com/abc/fail"]);
});
