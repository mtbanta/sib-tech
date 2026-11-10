// The mid-day deploy (Michael's ruling of 2026-11-09, written in CLAUDE.md): a deploy during market hours is allowed only while the
// account is flat and entries are paused for the mid-day cycle. This script checks every condition right before the deploy and
// refuses if any fails; only then it pauses the Healthchecks check (the worker's next ping un-pauses it) and runs the Fly deploy.
//
// Usage (from any folder; the key file is read from the main checkout and never printed):
//   node stacks/cyrus/tools/midday-deploy.mjs --dir <clean checkout>/stacks/cyrus --reviewed <commit> [--after-130] [--check-only]
//
// Reads only (paper Alpaca, the database in a read-only transaction) until every check has passed. Paper only.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { deployRefusals, middayKey } from "../src/midday.ts";

const KEY_FILE = "/Users/mtbanta/Projects/sib-tech/stacks/cyrus/.env.local";
const PAPER = "https://paper-api.alpaca.markets"; // paper only, never anything else
const APP = "sib-tech-cyrus";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};
const dir = value("--dir");
const reviewed = value("--reviewed");
if (!dir) {
  console.log("refused: --dir <clean checkout>/stacks/cyrus is required");
  process.exit(2);
}
if (existsSync(`${dir}/.env.local`)) {
  console.log("refused: the checkout holds a key file (.env.local); deploy from a clean checkout");
  process.exit(2);
}
process.loadEnvFile(KEY_FILE);
const secrets = [process.env.FLY_API_TOKEN, process.env.ALPACA_PAPER_API_SECRET_KEY, process.env.ALPACA_PAPER_API_KEY_ID, process.env.HEALTHCHECKS_API_KEY, process.env.SUPABASE_DB_URL].filter((x) => x && x.length >= 8).map((x) => x.trim());
const scrub = (s) => secrets.reduce((t, k) => t.split(k).join("<redacted>"), String(s));

// Today's New York date (the day record's key).
const now = new Date();
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

// 1. The checkout's commit.
const rev = spawnSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" });
const checkedOut = (rev.stdout || "").trim();

// 2. The day record and the pause, read only.
const pg = createRequire("/Users/mtbanta/Projects/sib-tech/stacks/cyrus/package.json")("pg");
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
let day = null;
let pause = null;
try {
  await db.connect();
  await db.query("begin transaction read only");
  const d = (await db.query("select is_trading_day, open_at, close_at, phases from trading_days where trade_date = $1", [date])).rows[0];
  if (d) day = { isTradingDay: d.is_trading_day, openAt: d.open_at ? new Date(d.open_at) : null, closeAt: d.close_at ? new Date(d.close_at) : null, phases: d.phases ?? {} };
  const c = (await db.query("select value from control where key = $1", [middayKey(date)])).rows[0];
  pause = c ? c.value : null;
  await db.query("rollback");
} catch (err) {
  console.log("refused: could not read the database:", scrub(err.message).slice(0, 200));
  process.exit(2);
} finally {
  await db.end().catch(() => undefined);
}

// 3. Alpaca (paper): positions and open orders.
const H = { "APCA-API-KEY-ID": process.env.ALPACA_PAPER_API_KEY_ID, "APCA-API-SECRET-KEY": process.env.ALPACA_PAPER_API_SECRET_KEY };
let positions = -1;
let openOrders = -1;
try {
  const p = await fetch(`${PAPER}/v2/positions`, { headers: H, redirect: "error" });
  const o = await fetch(`${PAPER}/v2/orders?status=open&limit=500&nested=true`, { headers: H, redirect: "error" });
  if (!p.ok || !o.ok) throw new Error(`Alpaca answered ${p.status} / ${o.status}`);
  positions = (await p.json()).length;
  openOrders = (await o.json()).length;
} catch (err) {
  console.log("refused: could not read Alpaca:", scrub(err.message).slice(0, 200));
  process.exit(2);
}

const refusals = deployRefusals({ now, day, pause, positions, openOrders, afterOneThirtyAllowed: flag("--after-130"), reviewedCommit: reviewed, checkedOutCommit: checkedOut });
console.log(`date ${date}; checkout ${checkedOut.slice(0, 7)}; positions ${positions}; open orders ${openOrders}; pause ${pause?.on ? "on" : "off"}; mid-day flat ${day?.phases?.middayFlat === "yes" ? "yes" : "no"}`);
if (refusals.length > 0) {
  console.log("refused:");
  for (const r of refusals) console.log(`  - ${r}`);
  process.exit(1);
}
console.log("all checks passed");
if (flag("--check-only")) process.exit(0);

// 4. Pause the Healthchecks check (a deploy takes 1 to 2 minutes; the worker's first ping after the start un-pauses it).
const uuid = (process.env.HEALTHCHECKS_PING_URL || "").replace(/\/+$/, "").split("/").pop();
const hc = await fetch(`https://healthchecks.io/api/v3/checks/${uuid}/pause`, { method: "POST", headers: { "X-Api-Key": process.env.HEALTHCHECKS_API_KEY } }).catch(() => null);
console.log("healthchecks pause:", hc ? hc.status : "no answer");

// 5. The deploy, from the clean checkout.
const tok = (process.env.FLY_API_TOKEN || "").trim();
const r = spawnSync(process.env.HOME + "/.fly/bin/fly", ["deploy", "--ha=false", "-a", APP], { cwd: dir, env: { ...process.env, FLY_ACCESS_TOKEN: tok, FLY_API_TOKEN: "" }, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
console.log(scrub(r.stdout).split("\n").slice(-30).join("\n"));
console.log(scrub(r.stderr).split("\n").slice(-15).join("\n"));
console.log("exit", r.status);
process.exit(r.status ?? 1);
