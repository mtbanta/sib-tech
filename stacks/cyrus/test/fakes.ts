// Fake values for tests. Rules for this file:
// 1. Every fake says FAKE or TEST in it and is plainly not a real credential.
// 2. None of them has the shape of a real token (the secret scan in scripts/ has no exemption for tests, and
//    GitHub's push protection refused an earlier token-shaped fixture).
// 3. A test that needs a real-looking shape (for redaction or for the scan) builds it at run time from parts
//    with the shaped helpers below, so no source file ever holds a contiguous token.

export const FAKE_ENV = {
  ALPACA_PAPER_API_KEY_ID: "PKFAKEFIXTURE",
  ALPACA_PAPER_API_SECRET_KEY: "fake-secret-for-tests-only",
  DISCORD_BOT_TOKEN: "fake-bot-token-for-tests",
  DISCORD_GUILD_ID: "123456789012345678",
  DISCORD_COMMAND_CHANNEL_ID: "223456789012345678",
  DISCORD_OWNER_USER_ID: "323456789012345678",
  DISCORD_ALERTS_WEBHOOK_URL: "https://discord.com/api/webhooks/FAKE-ID/FAKE-TOKEN",
  HEALTHCHECKS_PING_URL: "https://hc-ping.com/fake-check",
};

export const FAKE_WEBHOOK = "https://discord.com/api/webhooks/FAKE-ID/x";
export const FAKE_LIVE_KEY_ID = "AKFAKEFIXTURE";
export const FAKE_HEALTHCHECKS_API_KEY = "fake-healthchecks-api-key";
export const FAKE_DB_URL_NO_PASSWORD = "postgresql://postgres@db.example.invalid:5432/postgres";

const join = (parts: string[], sep = "") => parts.join(sep);

// Shaped like real tokens, assembled at run time. Only for tests that prove a rule catches a shape.
// Each carries a FAKE marker inside, and none is a credential for anything.
export const shaped = {
  alpacaKeyId: () => join(["PK", "FAKETESTFAKETEST", "FAKE0123"]),
  liveAlpacaKeyId: () => join(["AK", "FAKETESTFAKETEST", "FAKE0123"]),
  discordWebhook: () => join(["https://discord.com/api/", "webhooks/", "123456789012345678", "/", "FAKEfakeFAKEfake_TEST-fake"]),
  discordBotToken: () => join(["MTIzNDU2Nzg5MDEyMzQ1Njc4", "FAKE00", "FAKEfakeFAKEfakeFAKEfake_TEST-x"], "."),
  discordBotTokenOtherStart: () => join(["xTIzNDU2Nzg5MDEyMzQ1Njc4OQ", "FAKE00", "FAKEfakeFAKEfakeFAKEfake_TEST-x"], "."),
  jwt: () => join(["eyJhbGciOiJIUzI1NiJ9", "eyJyb2xlIjoiRkFLRSJ9", "FAKEsignatureFAKEsignature"], "."),
  databaseUrl: () => join(["postgresql", "://", "postgres", ":", "FAKEpassword", "@", "db.example.invalid:5432/postgres"]),
  healthchecksPing: () => join(["https://hc-ping.com/", "12345678-1234-1234-1234-", "FAKE00000000"]),
  supabaseSecretKey: () => join(["sb_", "secret_", "FAKEfakeFAKEfake_TEST"]),
  supabaseAccessToken: () => join(["sbp", "_", "FAKEfakeFAKEfakeFAKEfakeFAKE"]),
  supabaseOauthToken: () => join(["sbp", "_oauth_", "FAKEfakeFAKEfakeFAKEfakeFAKE"]),
  flyToken: () => join(["fo1", "_", "FAKEfakeFAKEfakeFAKEfakeFAKE"]),
  alpacaSecretLine: () => join(["ALPACA_PAPER_API_", "SECRET_KEY=", "FAKEfakeFAKEfakeFAKEfakeFAKEfakeFAKE01"]),
  healthchecksKeyLine: () => join(["X-Api", "-Key: ", "FAKEfakeFAKEfakeFAKEfakeFAKE0123"]),
  privateKeyHeader: () => join(["-----BEGIN ", "PRIVATE KEY", "-----"]),
};
