// Settings for stack C. Everything comes from environment variables. On the owner's Mac they are read
// from the git-ignored file `.env.local`; on Fly.io they are secrets set on the app.
//
// PAPER ONLY. The trading host is a constant, not a setting. No variable can point this code at a live
// endpoint, and live-shaped keys are refused.

export const PAPER_TRADING_HOST = "paper-api.alpaca.markets";
export const PAPER_TRADING_BASE_URL = `https://${PAPER_TRADING_HOST}`;
export const DATA_BASE_URL = "https://data.alpaca.markets";

export type DataFeed = "iex" | "sip";

export interface Settings {
  alpaca: {
    keyId: string;
    secretKey: string;
    tradingBaseUrl: typeof PAPER_TRADING_BASE_URL;
    dataBaseUrl: string;
    // iex is the free feed. sip is the full consolidated feed and needs a live account, so it is a later
    // configuration change (ALPACA_DATA_FEED=sip), not a code change.
    dataFeed: DataFeed;
  };
  discord: {
    botToken: string;
    guildId: string;
    commandChannelId: string;
    alertsWebhookUrl: string;
    ownerUserId: string;
  };
  healthchecksPingUrl: string;
  supabaseDbUrl: string | undefined;
}

export class ConfigError extends Error {}

type Env = Record<string, string | undefined>;

function need(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new ConfigError(`Missing setting ${name}`);
  return value;
}

function needSnowflake(env: Env, name: string): string {
  const value = need(env, name);
  if (!/^\d{15,25}$/.test(value)) throw new ConfigError(`Setting ${name} is not a Discord id`);
  return value;
}

// Throws unless the address is exactly Alpaca's paper trading host over https.
export function assertPaperHost(address: string): void {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw new ConfigError("Trading address is not a valid web address");
  }
  if (url.protocol !== "https:" || url.hostname !== PAPER_TRADING_HOST || url.port !== "") {
    throw new ConfigError("Refusing a trading address that is not Alpaca's paper host");
  }
}

// Alpaca paper key ids start with PK. Live key ids start with AK. Anything else is refused too.
export function assertPaperKeyId(keyId: string): void {
  if (!/^PK[A-Z0-9]{10,}$/.test(keyId)) {
    throw new ConfigError("Refusing an Alpaca key id that does not look like a paper key (paper keys start with PK)");
  }
}

export function loadSettings(env: Env = process.env, options: { requireDatabase?: boolean } = {}): Settings {
  const keyId = need(env, "ALPACA_PAPER_API_KEY_ID");
  assertPaperKeyId(keyId);
  assertPaperHost(PAPER_TRADING_BASE_URL);

  const feedRaw = (env.ALPACA_DATA_FEED?.trim() || "iex").toLowerCase();
  if (feedRaw !== "iex" && feedRaw !== "sip") {
    throw new ConfigError("Setting ALPACA_DATA_FEED must be iex or sip");
  }

  const webhook = need(env, "DISCORD_ALERTS_WEBHOOK_URL");
  if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(webhook)) {
    throw new ConfigError("Setting DISCORD_ALERTS_WEBHOOK_URL is not a Discord webhook address");
  }
  const ping = need(env, "HEALTHCHECKS_PING_URL");
  if (!/^https:\/\/hc-ping\.com\//.test(ping)) {
    throw new ConfigError("Setting HEALTHCHECKS_PING_URL is not a Healthchecks ping address");
  }

  const supabaseDbUrl = env.SUPABASE_DB_URL?.trim() || undefined;
  if (options.requireDatabase && !supabaseDbUrl) throw new ConfigError("Missing setting SUPABASE_DB_URL");
  if (options.requireDatabase && supabaseDbUrl && !/^postgres(ql)?:\/\/[^:@/\s]+:[^@\s]+@[^/\s]+\/\S+$/.test(supabaseDbUrl)) {
    throw new ConfigError("Setting SUPABASE_DB_URL is not a Postgres connection address (use the Postgres connection string from the Connect page of the Supabase project, with the database password filled in)");
  }

  return {
    alpaca: {
      keyId,
      secretKey: need(env, "ALPACA_PAPER_API_SECRET_KEY"),
      tradingBaseUrl: PAPER_TRADING_BASE_URL,
      dataBaseUrl: DATA_BASE_URL,
      dataFeed: feedRaw,
    },
    discord: {
      botToken: need(env, "DISCORD_BOT_TOKEN"),
      guildId: needSnowflake(env, "DISCORD_GUILD_ID"),
      commandChannelId: needSnowflake(env, "DISCORD_COMMAND_CHANNEL_ID"),
      alertsWebhookUrl: webhook,
      ownerUserId: needSnowflake(env, "DISCORD_OWNER_USER_ID"),
    },
    healthchecksPingUrl: ping,
    supabaseDbUrl,
  };
}

// Every value that must never appear in a log line, a Discord message or an error.
export function secretValues(settings: Settings, env: Env = process.env): string[] {
  const values = [
    settings.alpaca.keyId,
    settings.alpaca.secretKey,
    settings.discord.botToken,
    settings.discord.alertsWebhookUrl,
    settings.healthchecksPingUrl,
    settings.supabaseDbUrl,
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.HEALTHCHECKS_API_KEY,
    env.SUPABASE_ACCESS_TOKEN,
  ];
  return values.filter((v): v is string => typeof v === "string" && v.length >= 8);
}
