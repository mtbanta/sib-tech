// A normal deploy outside market hours (CLAUDE.md: flat, no open orders, the reviewed commit, a clean checkout). Scratchpad tool for the
// redesign deploy of 2026-11-15. Reads only (paper Alpaca, the database in a read-only transaction) until every check has passed; then
// pauses the Healthchecks check (the worker's next ping un-pauses it) and runs the Fly deploy. Never prints a key. Paper only.
// Usage: node offhours-deploy.mjs --dir <clean clone>/stacks/cyrus --reviewed <commit> [--check-only]
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const KEY_FILE = "/Users/mtbanta/Projects/sib-tech/stacks/cyrus/.env.local";
const PAPER = "https://paper-api.alpaca.markets"; // paper only
const APP = "sib-tech-cyrus";
const args = process.argv.slice(2);
const value = (n) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null; };
const dir = value("--dir");
const reviewed = value("--reviewed");
const refuse = (m) => { console.log("refused: " + m); process.exit(1); };
if (!dir || !reviewed || reviewed.length < 7) refuse("--dir and --reviewed <commit, 7+ chars> are required");
if (existsSync(`${dir}/.env.local`)) refuse("the checkout holds a key file");
process.loadEnvFile(KEY_FILE);
const secrets = Object.entries(process.env).filter(([k, v]) => /TOKEN|KEY|SECRET|URL|ID/.test(k) && v && v.length >= 8).map(([, v]) => v.trim());
const scrub = (s) => secrets.reduce((t, k) => t.split(k).join("<redacted>"), String(s ?? ""));

const problems = [];
// 1. The checkout.
const head = (spawnSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout || "").trim();
const st = spawnSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" });
if (!head.startsWith(reviewed)) problems.push(`checkout is ${head.slice(0, 7)}, not ${reviewed}`);
if (st.status !== 0 || (st.stdout || "").trim() !== "") problems.push("checkout not clean");

// 2. Alpaca paper: clock, positions, open orders.
const H = { "APCA-API-KEY-ID": process.env.ALPACA_PAPER_API_KEY_ID, "APCA-API-SECRET-KEY": process.env.ALPACA_PAPER_API_SECRET_KEY };
const get = async (p) => { const r = await fetch(PAPER + p, { headers: H, redirect: "error" }); if (!r.ok) throw new Error(`Alpaca ${p} answered ${r.status}`); return r.json(); };
let clock, positions, orders;
try { [clock, positions, orders] = await Promise.all([get("/v2/clock"), get("/v2/positions"), get("/v2/orders?status=open&limit=500&nested=true")]); }
catch (e) { refuse("could not read Alpaca: " + scrub(e.message).slice(0, 200)); }
if (clock.is_open !== false) problems.push("Alpaca's clock does not say closed");
if (positions.length !== 0) problems.push(`${positions.length} position(s)`);
if (orders.length !== 0) problems.push(`${orders.length} open order(s)`);

// 3. The database, read only: today's and the next trading day's records, the stop flag.
const pg = createRequire("/Users/mtbanta/Projects/sib-tech/stacks/cyrus/package.json")("pg");
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const ny = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
let today, next, stop;
try {
  await db.connect();
  await db.query("begin transaction read only");
  today = (await db.query("select trade_date::text, is_trading_day, status, open_at, close_at from trading_days where trade_date = $1", [ny])).rows[0] ?? null;
  next = (await db.query("select trade_date::text, status, suggested, decided from trading_days where trade_date > $1 order by trade_date limit 1", [ny])).rows[0] ?? null;
  stop = (await db.query("select value from control where key = 'stop_flag'")).rows[0]?.value ?? null;
  await db.query("rollback");
} catch (e) { refuse("could not read the database: " + scrub(e.message).slice(0, 200)); }
finally { await db.end().catch(() => undefined); }
const now = new Date();
if (today?.is_trading_day && today.open_at && today.close_at && now >= new Date(today.open_at) && now < new Date(today.close_at)) problems.push("market hours by the day record");

console.log(JSON.stringify({ nyDate: ny, checkout: head.slice(0, 7), alpacaClockOpen: clock.is_open, nextOpen: clock.next_open, positions: positions.length, openOrders: orders.length, today: today && { date: today.trade_date, tradingDay: today.is_trading_day, status: today.status }, nextDay: next && { date: next.trade_date, status: next.status, decided: next.decided, suggested: next.suggested }, stopFlag: stop ? { on: stop.on, reason: stop.reason } : null }));
if (problems.length) refuse(problems.join("; "));
console.log("all checks passed (outside market hours)");
if (args.includes("--check-only")) process.exit(0);

// 4. Pause the Healthchecks check, then deploy.
const uuid = (process.env.HEALTHCHECKS_PING_URL || "").replace(/\/+$/, "").split("/").pop();
const hc = await fetch(`https://healthchecks.io/api/v3/checks/${uuid}/pause`, { method: "POST", headers: { "X-Api-Key": process.env.HEALTHCHECKS_API_KEY } }).catch(() => null);
console.log("healthchecks pause:", hc ? hc.status : "no answer");
const tok = (process.env.FLY_API_TOKEN || "").trim();
const r = spawnSync(process.env.HOME + "/.fly/bin/fly", ["deploy", "--ha=false", "-a", APP], { cwd: dir, env: { ...process.env, FLY_ACCESS_TOKEN: tok, FLY_API_TOKEN: "" }, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
console.log(scrub(r.stdout).split("\n").slice(-25).join("\n"));
console.log(scrub(r.stderr).split("\n").slice(-12).join("\n"));
console.log("exit", r.status, "at", new Date().toISOString());
process.exit(r.status ?? 1);
