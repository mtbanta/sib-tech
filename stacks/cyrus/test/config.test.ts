import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSettings, assertPaperHost, assertPaperKeyId, secretValues, ConfigError, PAPER_TRADING_BASE_URL } from "../src/config.ts";

// Fake values only. They are shaped like the real ones and are not secrets.
const good = {
  ALPACA_PAPER_API_KEY_ID: "PKTESTTESTTESTTESTTEST1234", // scan-allow-fake
  ALPACA_PAPER_API_SECRET_KEY: "fakeSecretFakeSecretFakeSecretFakeSecret12",
  DISCORD_BOT_TOKEN: "fakeBotTokenFakeBotTokenFakeBotTokenFakeBotTokenFakeBotToken1",
  DISCORD_GUILD_ID: "123456789012345678",
  DISCORD_COMMAND_CHANNEL_ID: "223456789012345678",
  DISCORD_OWNER_USER_ID: "323456789012345678",
  DISCORD_ALERTS_WEBHOOK_URL: "https://discord.com/api/webhooks/123456789012345678/fakeWebhookTokenFake", // scan-allow-fake
  HEALTHCHECKS_PING_URL: "https://hc-ping.com/12345678-1234-1234-1234-123456789012", // scan-allow-fake
};

test("loads good settings and defaults the feed to iex", () => {
  const s = loadSettings(good);
  assert.equal(s.alpaca.dataFeed, "iex");
  assert.equal(s.alpaca.tradingBaseUrl, PAPER_TRADING_BASE_URL);
  assert.equal(s.supabaseDbUrl, undefined);
});

test("the feed is a setting: sip is a configuration change", () => {
  assert.equal(loadSettings({ ...good, ALPACA_DATA_FEED: "sip" }).alpaca.dataFeed, "sip");
  assert.equal(loadSettings({ ...good, ALPACA_DATA_FEED: "SIP" }).alpaca.dataFeed, "sip");
  assert.throws(() => loadSettings({ ...good, ALPACA_DATA_FEED: "otc" }), ConfigError);
});

test("a live-shaped key id is refused", () => {
  assert.throws(() => loadSettings({ ...good, ALPACA_PAPER_API_KEY_ID: "AKTESTTESTTESTTESTTEST1234" }), ConfigError); // scan-allow-fake
  assert.throws(() => assertPaperKeyId("AKTESTTESTTESTTESTTEST1234"), ConfigError); // scan-allow-fake
  assert.throws(() => assertPaperKeyId(""), ConfigError);
});

test("no setting can change the trading host", () => {
  const s = loadSettings({ ...good, ALPACA_TRADING_BASE_URL: "https://api.alpaca.markets", ALPACA_BASE_URL: "https://api.alpaca.markets" });
  assert.equal(s.alpaca.tradingBaseUrl, "https://paper-api.alpaca.markets");
});

test("the paper host guard accepts only the exact paper host", () => {
  assertPaperHost("https://paper-api.alpaca.markets");
  assertPaperHost("https://paper-api.alpaca.markets/v2/orders");
  for (const bad of [
    "https://api.alpaca.markets",
    "https://api.alpaca.markets/v2/orders",
    "http://paper-api.alpaca.markets",
    "https://paper-api.alpaca.markets.evil.example",
    "https://evil.example/paper-api.alpaca.markets",
    "https://paper-api.alpaca.markets@api.alpaca.markets",
    "https://paper-api.alpaca.markets:8443",
    "not a url",
  ]) {
    assert.throws(() => assertPaperHost(bad), ConfigError, bad);
  }
});

test("missing and malformed settings are refused with the setting name, not the value", () => {
  assert.throws(() => loadSettings({ ...good, DISCORD_BOT_TOKEN: "" }), /DISCORD_BOT_TOKEN/);
  assert.throws(() => loadSettings({ ...good, DISCORD_GUILD_ID: "abc" }), /DISCORD_GUILD_ID/);
  assert.throws(() => loadSettings({ ...good, DISCORD_ALERTS_WEBHOOK_URL: "https://example.com/x" }), /DISCORD_ALERTS_WEBHOOK_URL/);
  assert.throws(() => loadSettings({ ...good, HEALTHCHECKS_PING_URL: "https://example.com/x" }), /HEALTHCHECKS_PING_URL/);
  assert.throws(() => loadSettings({ ...good, SUPABASE_DB_URL: "" }, { requireDatabase: true }), /SUPABASE_DB_URL/);
});

test("secretValues lists every secret and skips blanks", () => {
  const s = loadSettings({ ...good, SUPABASE_DB_URL: "postgresql://postgres:fakepassword@db.example.supabase.co:5432/postgres" }); // scan-allow-fake
  const values = secretValues(s, { HEALTHCHECKS_API_KEY: "fakeHealthchecksApiKey1234567890ab" });
  assert.ok(values.includes(good.ALPACA_PAPER_API_SECRET_KEY));
  assert.ok(values.includes(good.DISCORD_ALERTS_WEBHOOK_URL));
  assert.ok(values.includes("fakeHealthchecksApiKey1234567890ab"));
  assert.ok(values.every((v) => v.length >= 8));
});
