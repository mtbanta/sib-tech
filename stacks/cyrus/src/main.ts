// The worker's entry point. Wires the real pieces together and starts the day loop.
// Run from stacks/cyrus:  node src/main.ts     (on Fly.io the same command, with secrets as environment settings)
import { AlpacaData } from "./alpaca-data.ts";
import { AlpacaTrading } from "./alpaca-trading.ts";
import { loadSettings, secretValues } from "./config.ts";
import { DiscordBot } from "./discord-bot.ts";
import { ping } from "./heartbeat.ts";
import { loadLocalEnv } from "./local-env.ts";
import { describeError, makeLogger } from "./log.ts";
import { makePool, PgStore } from "./pg-store.ts";
import { makeRedactor } from "./redact.ts";
import { DEFAULT_SCREEN, liveListSize, screen } from "./screen.ts";
import { TradeStream } from "./stream.ts";
import { fetchUniverse } from "./universe.ts";
import { FeedAlerter } from "./feed-alert.ts";
import { Worker } from "./worker.ts";

loadLocalEnv();
const settings = loadSettings(process.env, { requireDatabase: true });
const redact = makeRedactor(secretValues(settings, process.env));
const log = makeLogger(redact);

const pool = makePool(settings.supabaseDbUrl!);
const store = new PgStore(pool);
const broker = new AlpacaTrading(settings);
const data = new AlpacaData(settings);
const bot = new DiscordBot(settings, redact);

// Warnings and errors also go into the database's run log (already redacted).
const logAndStore: ConstructorParameters<typeof Worker>[0]["log"] = (level, event, fields) => {
  log(level, event, fields);
  if (level !== "info") void store.addEvent(level, event, JSON.parse(redact(JSON.stringify(fields ?? {})))).catch(() => undefined);
};

async function buildLiveList(): Promise<string[]> {
  const universe = await fetchUniverse();
  const end = new Date(Date.now() - 16 * 60_000).toISOString(); // free history must be 15 minutes old
  const start = new Date(Date.now() - 12 * 86_400_000).toISOString();
  const bars = await data.dailyBars(universe, start, end, "sip"); // history older than 15 minutes is consolidated and free
  const size = liveListSize(DEFAULT_SCREEN.listSize, data.feed);
  return screen(bars, { ...DEFAULT_SCREEN, listSize: size }).map((c) => c.symbol);
}

try {
  await store.getControl("startup_check"); // the database must answer before anything else
  await bot.start();
} catch (err) {
  log("error", "startup_failed", { error: describeError(err, redact) });
  await ping(settings.healthchecksPingUrl, "fail");
  process.exit(1);
}

const worker = new Worker({
  settings,
  broker,
  store,
  bot,
  now: () => new Date(),
  ping: (kind) => ping(settings.healthchecksPingUrl, kind),
  buildLiveList,
  makeStream: (symbols, onTrade) => {
    let status = "starting";
    const alerter = new FeedAlerter();
    const s = new TradeStream(settings, symbols, onTrade, (st, detail) => {
      status = st;
      if (st === "auth_failed" || st === "reconnecting") log("warn", "stream", { status: st, detail });
      const msg = alerter.onStatus(st, Date.now());
      if (msg) void bot.post("alerts", msg);
    });
    return { start: () => s.start(), stop: () => s.stop(), status: () => status };
  },
  log: logAndStore,
});

await ping(settings.healthchecksPingUrl, "start");
await bot.post("commands", "Stack C worker started (paper trading only). Type `help` for commands. Research input for a human decision, never an instruction to act.");
log("info", "worker_started", { feed: settings.alpaca.dataFeed });
worker.start();

const shutdown = (why: string) => {
  log("info", "worker_stopping", { why });
  worker.stop();
  void pool.end().finally(() => process.exit(0));
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  log("error", "uncaught", { error: describeError(err, redact) });
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  log("error", "unhandled_rejection", { error: describeError(err, redact) });
  process.exit(1);
});
