// The exit pair's paper trials (Michael's approval of 2026-11-21, answers 5 and 6): after the 10:30 close-out is flat and Michael's own stop
// is on, one-share trials of an exit pair (an OCO: a limit sell and a stop sell on the same shares, one cancelling the other), plus one
// 3-share trial of a partial fill. They check what the build assumes about Alpaca before Michael switches the pair on with `pair on`.
//
//   T1 accepted: buy 1 share, place the pair exactly as the worker would (AlpacaTrading.submitSell with a take-profit), and record Alpaca's
//      answer, whether it keeps the client id, how its open list shows the pair, and what the worker's own pure functions make of that list
//      (openSellQty must count the pair once; structuralCandidates must offer it for a move).
//   T2 take-profit movable: on T1's pair, replace the limit with the bid less 1 cent (as a close-out's move does), and record whether it is
//      accepted and fills, whether Alpaca cancels the stop itself, and that no order is left open on the symbol.
//   T3 stop on a fill: a pair whose stop is 1 cent under the bid and whose limit is well above; wait up to 60 s for the stop to sell, and
//      record whether Alpaca cancels the limit. If the price never reaches the stop, try moving the stop to the bid and record the answer.
//   T4 partial fill (3 shares): a pair whose limit is 1 cent over the bid; watch up to 60 s for a partial fill and record what Alpaca does
//      to the stop leg.
//
// Guards (each checked before every trial; the runner stops at the first failure or surprise, cleans up, and says why): today's New York
// date equals --date; before 11:15 AM Central; the mid-day close-out finished flat (day phase `midday` with `middayFlat: yes`); the stop
// flag is on from Michael's own `stop` or `flatten` (never the daily loss stop); Alpaca's clock open; Alpaca flat (no position, no open
// order) before each trial and after its clean-up; symbols the stack traded today, priced 5 to 60 dollars. Client ids start `trial-`, so
// the worker never takes these orders for its own (its stop sweep cancels any unfilled buy, so buys are market orders that fill at once).
// Requests: at most 80 a rolling minute by this runner (it waits when it would exceed that); every wait bounded, its gaps growing (0.4 or 1 s, doubling to 2 s); the clean-up at most 3 rounds, 1 s then 2 s apart.
//
// Run from the clean checkout of the reviewed commit, like the deploy tools (self-check.mjs):
//   node <clean clone>/stacks/cyrus/tools/pair-trials.mjs --dir <clean clone>/stacks/cyrus --reviewed <commit> --date 2026-11-23
//        --out <file outside the repo> [--trials T1,T2,T3,T4] [--symbols A,B,C] [--check-only]
// `--symbols` (Michael's decision 3 of 2026-11-23): 1 to 3 names, in the order given (T4 on the first), each one the guards already accept
// (traded by the stack today, priced 5 to 60 dollars); any other name is refused before anything is sent, because a held symbol the stack
// has no order for today draws the worker's carried-position alert and sale. Without it, the first three accepted names, as before.
// With 1 or 2 names T1 cannot read "pass" (the criteria need three stocks) and T2 needs two judged; the runner says so before it starts.
// Never prints a key. Paper only. Research input for a human decision, never an instruction to act.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { toolSelfCheck } from "./self-check.mjs";
import { AlpacaTrading } from "../src/alpaca-trading.ts";
import { loadSettings } from "../src/config.ts";
import { openSellQty } from "../src/sells.ts";
import { structuralCandidates } from "../src/moved-take-profit.ts";
import { middayFlat } from "../src/midday.ts";

const KEY_FILE = "/Users/mtbanta/Projects/sib-tech/stacks/cyrus/.env.local";
const PAPER = "https://paper-api.alpaca.markets"; // paper only, never anything else
const DATA = "https://data.alpaca.markets";
const STOP_BY = { hour: 11, minute: 15 }; // Central
const MAX_PER_MINUTE = 80;

const args = process.argv.slice(2);
const value = (n) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};
const say = (m) => console.log(m);
const refuse = (m) => {
  say("refused: " + m);
  process.exit(2);
};
const dir = value("--dir");
const reviewed = value("--reviewed");
const date = value("--date");
const outArg = value("--out");
const out = outArg ? resolve(outArg) : null;
const which = new Set((value("--trials") ?? "T1,T2,T3,T4").split(",").map((x) => x.trim().toUpperCase()));
const symbolsArg = args.includes("--symbols") ? (value("--symbols") ?? "") : null;
const chosen = symbolsArg === null ? null : [...new Set(symbolsArg.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean))];
if (chosen !== null && (chosen.length < 1 || chosen.length > 3 || chosen.some((x) => !/^[A-Z]{1,5}$/.test(x)))) refuse("--symbols takes 1 to 3 symbols, comma separated");
if (!dir || !reviewed || reviewed.length < 7 || !date || !out) refuse("--dir, --reviewed <commit>, --date YYYY-MM-DD and --out <file> are required");
if (existsSync(`${dir}/.env.local`)) refuse("the checkout holds a key file");
if (out.startsWith(dir) || out.includes("/Projects/sib-tech/")) refuse("--out must be outside the repo");
const self = toolSelfCheck(import.meta.url, dir, "pair-trials.mjs");
say(`tool: pair-trials.mjs blob ${self.blob.slice(0, 12)} (committed at HEAD: ${self.committed.slice(0, 12)})`);
if (self.problems.length) refuse(self.problems.join("; "));
const head = (spawnSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout || "").trim();
const st = spawnSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" });
if (!head.startsWith(reviewed)) refuse(`checkout is ${head.slice(0, 7)}, not ${reviewed}`);
if (st.status !== 0 || (st.stdout || "").trim() !== "") refuse("checkout not clean");

process.loadEnvFile(KEY_FILE);
const secrets = Object.entries(process.env).filter(([k, v]) => /TOKEN|KEY|SECRET|URL|ID/.test(k) && v && v.length >= 8).map(([, v]) => v.trim());
const scrub = (s) => secrets.reduce((t, k) => t.split(k).join("<redacted>"), String(s ?? ""));
const record = (row) => appendFileSync(out, scrub(JSON.stringify({ at: new Date().toISOString(), ...row })) + "\n");

// ---- requests, paced ----
const sent = [];
const pace = async () => {
  for (let i = 0; i < 200; i++) {
    const now = Date.now();
    while (sent.length && now - sent[0] > 60_000) sent.shift();
    if (sent.length < MAX_PER_MINUTE) {
      sent.push(now);
      return;
    }
    await sleep(500);
  }
  throw new Error("request pacing did not clear in 100 s");
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = { "APCA-API-KEY-ID": process.env.ALPACA_PAPER_API_KEY_ID, "APCA-API-SECRET-KEY": process.env.ALPACA_PAPER_API_SECRET_KEY };
const raw = async (method, path, body, base = PAPER) => {
  await pace();
  const r = await fetch(base + path, { method, headers: { ...H, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: "error", signal: AbortSignal.timeout(10_000) });
  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { text: text.slice(0, 200) };
  }
  return { status: r.status, json };
};
const settings = loadSettings(process.env, { requireDatabase: false });
const alpaca = new AlpacaTrading(settings);
const timed = async (fn) => {
  await pace();
  const t = Date.now();
  try {
    return { ok: true, value: await fn(), ms: Date.now() - t };
  } catch (err) {
    return { ok: false, error: scrub(err.message).slice(0, 300), status: err.status ?? null, ms: Date.now() - t };
  }
};

// ---- guards ----
const pg = createRequire("/Users/mtbanta/Projects/sib-tech/stacks/cyrus/package.json")("pg");
async function dbRead() {
  const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    await db.query("begin transaction read only");
    const day = (await db.query("select is_trading_day, phases from trading_days where trade_date = $1", [date])).rows[0] ?? null;
    const stop = (await db.query("select value from control where key = 'stop_flag'")).rows[0]?.value ?? null;
    const traded = (await db.query("select symbol, count(*)::int as n, max(reference_price)::float as px from orders where trade_date = $1 group by symbol order by n desc limit 40", [date])).rows;
    await db.query("rollback");
    return { day, stop, traded };
  } finally {
    await db.end().catch(() => undefined);
  }
}
const central = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { hour: Number(p.hour), minute: Number(p.minute) };
};
async function guards() {
  const problems = [];
  const ny = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (ny !== date) problems.push(`today is ${ny}, not ${date}`);
  const c = central();
  // A trial takes up to about 2 minutes (T3: a 60 s wait, 15 s after a stop move, 10 s for the leg's final status, then a clean-up of up to
  // about 30 s), so none starts after 11:12 and every one ends by about 11:15 (group 1, round 1 of 2026-11-23).
  if (c.hour * 60 + c.minute >= STOP_BY.hour * 60 + STOP_BY.minute - 3) problems.push("it is 11:12 AM Central or later (a trial must end by 11:15)");
  const { day, stop, traded } = await dbRead();
  if (!day?.is_trading_day) problems.push("not a trading day by the day record");
  else if (!middayFlat({ phases: day.phases ?? {} })) problems.push("the mid-day close-out has not finished flat");
  if (!stop?.on) problems.push("the stop flag is not on");
  else if (String(stop.reason ?? "").startsWith("daily loss stop")) problems.push("the stop flag is the daily loss stop, not Michael's own stop");
  const clock = await raw("GET", "/v2/clock");
  if (clock.status !== 200 || clock.json?.is_open !== true) problems.push("Alpaca's clock does not say open");
  const pos = await raw("GET", "/v2/positions");
  const open = await raw("GET", "/v2/orders?status=open&limit=500&nested=true");
  if (pos.status !== 200 || !Array.isArray(pos.json) || pos.json.length !== 0) problems.push(`Alpaca is not flat (positions: ${Array.isArray(pos.json) ? pos.json.length : pos.status})`);
  if (open.status !== 200 || !Array.isArray(open.json) || open.json.length !== 0) problems.push(`Alpaca has open orders (${Array.isArray(open.json) ? open.json.length : open.status})`);
  const accepted = traded.filter((r) => /^[A-Z]{1,5}$/.test(r.symbol) && r.px >= 5 && r.px <= 60).map((r) => r.symbol);
  // Decision 3 of 2026-11-23: chosen symbols must each be one the guards accept; checked again before every trial.
  const notOk = chosen === null ? [] : chosen.filter((x) => !accepted.includes(x));
  if (notOk.length > 0) problems.push(`not traded by the stack today at 5 to 60 dollars: ${notOk.join(", ")}`);
  const symbols = chosen === null ? accepted : chosen.filter((x) => accepted.includes(x));
  if (chosen === null && symbols.length < 3) problems.push("fewer than 3 symbols traded today priced 5 to 60 dollars");
  return { problems, symbols };
}

// ---- helpers for a trial ----
const quote = async (symbol) => {
  const q = await raw("GET", `/v2/stocks/${symbol}/quotes/latest?feed=iex`, null, DATA);
  const bid = Number(q.json?.quote?.bp);
  const ask = Number(q.json?.quote?.ap);
  if (q.status !== 200 || !(bid > 0) || !(ask >= bid)) throw new Error(`no usable quote for ${symbol} (${q.status})`);
  return { bid, ask, at: q.json.quote.t };
};
const cents = (x) => Math.floor(x * 100 + 1e-9) / 100;
const tag = (kind, symbol) => `trial-${kind}-${date.replaceAll("-", "")}-${symbol}-${Date.now().toString(36)}`;
const openFor = async (symbol) => {
  const r = await raw("GET", "/v2/orders?status=open&limit=500&nested=true");
  if (r.status !== 200 || !Array.isArray(r.json)) throw new Error(`open orders unread (${r.status})`);
  return r.json.filter((o) => o.symbol === symbol);
};
const getOrder = async (id) => (await raw("GET", `/v2/orders/${id}?nested=true`)).json;
const heldQty = async (symbol) => {
  const r = await raw("GET", `/v2/positions/${symbol}`);
  return r.status === 404 ? 0 : Number(r.json?.qty ?? NaN);
};
// Waits (bounded) until `check` returns a truthy value: at most `limitMs` in all, the gaps growing from `firstMs` (doubling, at most 2 s; the
// standing rule of 2026-11-13: every retry loop has a limit and a backoff).
const POLL_MAX_MS = 2_000;
const until = async (check, limitMs, firstMs) => {
  const t0 = Date.now();
  let gap = firstMs;
  for (;;) {
    const v = await check();
    if (v) return { v, ms: Date.now() - t0 };
    if (Date.now() - t0 >= limitMs) return { v: null, ms: Date.now() - t0 };
    await sleep(Math.min(gap, Math.max(0, limitMs - (Date.now() - t0))));
    gap = Math.min(gap * 2, POLL_MAX_MS);
  }
};
async function buy(symbol, qty) {
  const id = tag("b", symbol);
  const r = await raw("POST", "/v2/orders", { symbol, qty: String(qty), side: "buy", type: "market", time_in_force: "day", client_order_id: id });
  if (r.status !== 200) throw new Error(`buy refused: ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  const f = await until(async () => {
    const o = await getOrder(r.json.id);
    return o?.status === "filled" ? o : null;
  }, 4_000, 400);
  if (!f.v) throw new Error("the buy did not fill within 4 s");
  return { order: f.v, fillPrice: Number(f.v.filled_avg_price) };
}
// Clean-up: cancels every open order on the symbol (this runner's own: the account was flat before), waits for them to end, sells what is
// still held at market, and checks the symbol is flat. Bounded; reports what it could not do.
// Bounded: at most 3 rounds, 1 s then 2 s between rounds; it sells only once the symbol's open list is empty (the stack's own sell rule).
async function cleanUp(symbol) {
  const notes = [];
  for (let round = 1; round <= 3; round++) {
    if (round > 1) await sleep(1_000 * 2 ** (round - 2));
    const open = await openFor(symbol).catch(() => []);
    for (const o of open) await raw("DELETE", `/v2/orders/${o.id}`);
    const cleared = await until(async () => (await openFor(symbol).catch(() => [1])).length === 0, 4_000, 400);
    if (!cleared.v) {
      notes.push(`round ${round}: orders still open after 4 s; not selling yet`);
      continue;
    }
    const q = await heldQty(symbol);
    if (q > 0) {
      const r = await raw("POST", "/v2/orders", { symbol, qty: String(q), side: "sell", type: "market", time_in_force: "day", client_order_id: tag("x", symbol) });
      notes.push(`round ${round}: sold ${q} at market (${r.status})`);
      await until(async () => (await heldQty(symbol)) === 0, 5_000, 500);
    }
    const flat = (await heldQty(symbol)) === 0 && (await openFor(symbol).catch(() => [1])).length === 0;
    if (flat) return { flat: true, notes };
  }
  return { flat: false, notes };
}
// What the worker's own pure functions make of Alpaca's open list for this symbol (parsed by the worker's own client, as the worker reads it).
async function workerView(symbol, qty) {
  await pace();
  const listed = await alpaca.listOrdersPaged("open", "2000-01-01T00:00:00Z", 2);
  await pace();
  const positions = (await alpaca.listPositions()).filter((p) => p.symbol === symbol);
  const mine = listed.orders.filter((o) => o.symbol === symbol);
  // Group 2, round 1: the group id (MoveWatch finds a bracket by it) and the parent's own stop price (the digest takes a pair's parent to be a
  // limit with no stop price) are recorded too.
  const shape = mine.map((o) => ({ id: o.id, clientOrderId: o.clientOrderId, type: o.type, orderClass: o.orderClass, status: o.status, groupId: o.groupId ?? null, limitPrice: o.limitPrice, stopPrice: o.stopPrice, legs: o.legs.map((l) => ({ id: l.id, clientOrderId: l.clientOrderId, type: l.type, status: l.status, stopPrice: l.stopPrice, groupId: l.groupId ?? null })) }));
  const sells = openSellQty(listed.orders, symbol);
  const cands = structuralCandidates(positions, listed.orders);
  return { shape, openSellQty: sells, countedOnce: Math.abs(sells - qty) < 1e-9, moveCandidate: cands.candidates.map((c) => c.symbol), moveSkipped: cands.skipped };
}
async function placePair(symbol, qty, takeProfitPrice, stopPrice) {
  const clientOrderId = tag("p", symbol);
  const r = await timed(() => alpaca.submitSell({ symbol, qty, clientOrderId, stopPrice, takeProfitPrice }));
  return { clientOrderId, ...r };
}

// ---- the trials ----
async function t1t2(symbol) {
  const b = await buy(symbol, 1);
  const tp = cents(b.fillPrice + 0.1);
  const stop = cents(b.fillPrice - 0.1);
  const p = await placePair(symbol, 1, tp, stop);
  const t1 = { trial: "T1", symbol, fillPrice: b.fillPrice, takeProfit: tp, stop, accepted: p.ok, answerMs: p.ms, error: p.ok ? null : p.error, httpStatus: p.ok ? 200 : p.status };
  if (!p.ok) return { t1, pass1: false, surprise: "the pair was refused" };
  const order = p.value;
  t1.clientIdKept = order.clientOrderId === p.clientOrderId;
  t1.answer = { id: order.id, type: order.type, orderClass: order.orderClass, status: order.status, legs: order.legs.map((l) => ({ id: l.id, type: l.type, status: l.status, stopPrice: l.stopPrice })) };
  await sleep(600);
  t1.view = await workerView(symbol, 1);
  t1.lookupByClientId = await timed(async () => {
    const x = await alpaca.findOrderByClientId(p.clientOrderId);
    return x ? { id: x.id, status: x.status, legs: x.legs.length } : null;
  });
  // The written criterion (build log, "Pass criteria"): accepted, client id kept, counted once, and offered as a move candidate.
  t1.offeredForMove = t1.view.moveCandidate.includes(symbol);
  const pass1 = t1.accepted && t1.clientIdKept && t1.view.countedOnce && t1.offeredForMove;
  record(t1);
  if (!which.has("T2") || !pass1) return { t1, pass1, surprise: pass1 ? null : "T1 did not hold up" };
  // T2: the move, as a close-out sends it (limit to the bid less 1 cent, at least 2 cents above the stop: MOVE_MIN_ABOVE_STOP).
  const q = await quote(symbol);
  const limit = cents(q.bid - 0.01);
  const t2 = { trial: "T2", symbol, bid: q.bid, quoteAt: q.at, newLimit: limit, stop };
  if (!(limit >= stop + 0.02 - 1e-9)) {
    t2.skipped = "the bid fell to the stop; no move possible";
    record(t2);
    return { t1, pass1, t2, pass2: null, skipped2: true, surprise: null };
  }
  const moveId = tag("m", symbol);
  const rp = await timed(() => alpaca.replaceOrder(order.id, { limitPrice: limit, clientOrderId: moveId }, 2_000));
  t2.accepted = rp.ok;
  t2.answerMs = rp.ms;
  if (!rp.ok) {
    t2.error = rp.error;
    record(t2);
    return { t1, pass1, t2, pass2: false, surprise: "the move was refused" };
  }
  t2.newOrder = { id: rp.value.id, clientOrderId: rp.value.clientOrderId, status: rp.value.status, legs: rp.value.legs.map((l) => ({ id: l.id, type: l.type, status: l.status })) };
  const filled = await until(async () => {
    const o = await getOrder(rp.value.id);
    return o?.status === "filled" ? o : null;
  }, 5_000, 400);
  t2.filled = !!filled.v;
  // The runner's own time (polling, so up to about 0.4 s late) and Alpaca's: the replacement's submitted_at to its filled_at.
  t2.fillMs = filled.v ? filled.ms + rp.ms : null;
  t2.alpacaSubmittedAt = filled.v?.submitted_at ?? null;
  t2.alpacaFilledAt = filled.v?.filled_at ?? null;
  t2.alpacaFillMs = filled.v && Number.isFinite(Date.parse(filled.v.filled_at)) && Number.isFinite(Date.parse(filled.v.submitted_at)) ? Date.parse(filled.v.filled_at) - Date.parse(filled.v.submitted_at) : null;
  t2.fillPrice = filled.v ? Number(filled.v.filled_avg_price) : null;
  t2.legsAfter = filled.v ? (filled.v.legs ?? []).map((l) => ({ type: l.type, status: l.status, canceled_at: l.canceled_at })) : null;
  const clear = await until(async () => (await openFor(symbol)).length === 0 && (await heldQty(symbol)) === 0, 3_000, 500);
  t2.noOrderLeftMs = clear.v ? clear.ms : null;
  // Within the move's 2 s wait, by Alpaca's own times when it gave them, else the runner's.
  const fillTime = t2.alpacaFillMs ?? t2.fillMs;
  t2.withinMoveWait = fillTime !== null && fillTime <= 2_000;
  // Read again after the wait above (Alpaca cancels the stop a moment after the fill; the clean-up has not run yet, so any cancel is Alpaca's).
  const after = filled.v ? await getOrder(rp.value.id) : null;
  t2.legsAfterWait = after ? (after.legs ?? []).map((l) => ({ type: l.type, status: l.status, canceled_at: l.canceled_at })) : null;
  // Cancelled by Alpaca: its stop leg shown cancelled, or (if the replacement shows no leg) no order left open on the symbol before any clean-up.
  const legsShown = after?.legs ?? [];
  t2.stopCancelledByAlpaca = !!after && (legsShown.some((l) => (l.type === "stop" || l.stop_price) && l.status === "canceled") || (legsShown.length === 0 && clear.v !== null));
  t2.nothingLeftOpen = clear.v !== null;
  const pass2 = t2.accepted && t2.filled && t2.withinMoveWait && t2.nothingLeftOpen;
  record(t2);
  // A slow fill is a result, not a surprise (the criterion counts fills within 2 s over the three trials); a refusal, no fill within 5 s, or
  // an order left open is a surprise and stops the run.
  const surprise = !t2.accepted ? "the move was refused" : !t2.filled ? "the moved pair did not fill within 5 s" : !t2.nothingLeftOpen ? "an order was left open after the moved pair filled" : null;
  return { t1, pass1, t2, pass2, within: t2.withinMoveWait, stopCancelled: t2.stopCancelledByAlpaca, surprise };
}

async function t3(symbol) {
  const b = await buy(symbol, 1);
  const q = await quote(symbol);
  const stop = cents(q.bid - 0.01);
  const tp = cents(Math.max(q.ask, b.fillPrice) + 0.5);
  const p = await placePair(symbol, 1, tp, stop);
  const row = { trial: "T3", symbol, fillPrice: b.fillPrice, bid: q.bid, stop, takeProfit: tp, accepted: p.ok, answerMs: p.ms, error: p.ok ? null : p.error };
  if (!p.ok) {
    record(row);
    return { row, pass: false, surprise: "the pair was refused" };
  }
  const parentId = p.value.id;
  const legOf = (o) => (o?.legs ?? []).find((l) => l.type === "stop" || l.stop_price);
  let done = await until(async () => {
    const o = await getOrder(parentId);
    const leg = legOf(o);
    return leg?.status === "filled" || o?.status === "filled" ? o : null;
  }, 60_000, 1_000);
  row.stopFilledInWait = !!done.v && legOf(done.v)?.status === "filled";
  if (!done.v) {
    // The price never reached the stop: try moving the stop to the bid (Alpaca's rule is only "1 cent below the limit").
    const o = await getOrder(parentId);
    const leg = legOf(o);
    const q2 = await quote(symbol);
    row.moveStopTo = cents(q2.bid);
    const rs = leg ? await timed(() => alpaca.replaceOrder(leg.id, { stopPrice: cents(q2.bid) }, 2_000)) : { ok: false, error: "no stop leg shown" };
    row.moveStopAccepted = rs.ok;
    row.moveStopError = rs.ok ? null : rs.error;
    if (rs.ok) {
      done = await until(async () => {
        const x = await getOrder(parentId);
        const l = legOf(x);
        return l?.status === "filled" || x?.status === "filled" || x?.status === "canceled" ? x : null;
      }, 15_000, 1_000);
      row.stopFilledAfterMove = !!done.v && legOf(done.v)?.status === "filled";
    }
  }
  // Michael's decision 3 of 2026-11-23: when the wait ended with the limit cancelled but the stop leg not yet final (a triggered stop shows
  // "new" for a moment as its market sale works; APG on 2026-11-23 filled 1.35 s after the limit's cancel), wait for the leg's final status
  // (filled, cancelled, expired or rejected), at most 10 s, gaps growing from 0.4 s, and judge "stop sold" from it.
  const FINAL = new Set(["filled", "canceled", "expired", "rejected"]);
  if (done.v && !FINAL.has(legOf(done.v)?.status ?? "")) {
    const fin = await until(async () => {
      const x = await getOrder(parentId);
      return FINAL.has(legOf(x)?.status ?? "") ? x : null;
    }, 10_000, 400);
    row.legFinalWaitMs = fin.ms;
    if (fin.v) done = fin;
    // A filled leg here is a stop that sold after its move (a 60 s wait that ended on a filled limit leaves the leg cancelled, not filled).
    if (fin.v && legOf(fin.v)?.status === "filled" && !row.stopFilledInWait) row.stopFilledAfterMove = true;
  }
  if (done.v) {
    row.parentStatusAfter = done.v.status;
    row.legStatusAfter = legOf(done.v)?.status ?? null;
    row.parentCanceledAt = done.v.canceled_at ?? null;
  }
  const clear = await until(async () => (await openFor(symbol)).length === 0 && (await heldQty(symbol)) === 0, 3_000, 500);
  row.noOrderLeft = clear.v !== null;
  record(row);
  const stopSold = row.stopFilledInWait || row.stopFilledAfterMove;
  return { row, pass: stopSold ? row.noOrderLeft : null, surprise: stopSold && !row.noOrderLeft ? "an order was left open after the stop sold" : null };
}

async function t4(symbol) {
  const b = await buy(symbol, 3);
  const q = await quote(symbol);
  const tp = cents(q.bid + 0.01);
  const stop = cents(Math.min(b.fillPrice, q.bid) - 0.1);
  const p = await placePair(symbol, 3, tp, stop);
  const row = { trial: "T4", symbol, fillPrice: b.fillPrice, bid: q.bid, takeProfit: tp, stop, accepted: p.ok, error: p.ok ? null : p.error };
  if (!p.ok) {
    record(row);
    return { row, surprise: "the pair was refused" };
  }
  const parentId = p.value.id;
  const seen = await until(async () => {
    const o = await getOrder(parentId);
    const f = Number(o?.filled_qty ?? 0);
    return f > 0 ? o : null;
  }, 60_000, 1_000);
  if (!seen.v) row.partial = "no fill in 60 s";
  else {
    const f = Number(seen.v.filled_qty);
    row.firstFillQty = f;
    row.partial = f < 3 ? "partial" : "filled whole";
    await sleep(500);
    const o = await getOrder(parentId);
    row.afterFirstFill = { parentStatus: o?.status, filledQty: Number(o?.filled_qty ?? 0), legs: (o?.legs ?? []).map((l) => ({ type: l.type, status: l.status, qty: l.qty, canceled_at: l.canceled_at })) };
  }
  record(row);
  return { row, surprise: null };
}

// ---- main ----
let g;
try {
  g = await guards();
} catch (err) {
  refuse(`could not check the guards: ${scrub(err.message).slice(0, 200)}`);
}
say(JSON.stringify({ date, checkout: head.slice(0, 7), guards: g.problems, symbols: g.symbols.slice(0, 6) }));
record({ event: "start", checkout: head.slice(0, 7), guards: g.problems, symbols: g.symbols.slice(0, 6), trials: [...which] });
if (g.problems.length) refuse(g.problems.join("; "));
if (chosen !== null && chosen.length < 3) say(`note: ${chosen.length} symbol(s) chosen, so T1 cannot read "pass" (the criteria need three stocks) and T2 needs two judged cases`);
if (args.includes("--check-only")) {
  say("all guards passed (check only; nothing sent)");
  process.exit(0);
}
const plan = [];
for (const s of g.symbols.slice(0, 3)) { // the chosen symbols (--symbols) or the first three accepted
  if (which.has("T1")) plan.push(["T1T2", s]);
  if (which.has("T3")) plan.push(["T3", s]);
}
if (which.has("T4")) plan.push(["T4", g.symbols[0]]);
const results = [];
for (const [kind, symbol] of plan) {
  let gg;
  try {
    gg = await guards();
  } catch (err) {
    say(`stopped before ${kind} ${symbol}: could not check the guards: ${scrub(err.message).slice(0, 200)}`);
    break;
  }
  if (gg.problems.length) {
    say(`stopped before ${kind} ${symbol}: ${gg.problems.join("; ")}`);
    break;
  }
  let res;
  try {
    res = kind === "T1T2" ? await t1t2(symbol) : kind === "T3" ? await t3(symbol) : await t4(symbol);
  } catch (err) {
    res = { surprise: scrub(err.message).slice(0, 200) };
  }
  const cu = await cleanUp(symbol).catch((err) => ({ flat: false, notes: [scrub(err.message).slice(0, 120)] }));
  record({ event: "cleanup", kind, symbol, ...cu });
  results.push({ kind, symbol, pass1: res.pass1 ?? null, pass2: res.pass2 ?? null, within: res.within ?? null, stopCancelled: res.stopCancelled ?? null, skipped2: res.skipped2 ?? false, pass: res.pass ?? null, surprise: res.surprise ?? null, flatAfter: cu.flat });
  say(JSON.stringify(results.at(-1)));
  if (res.surprise || !cu.flat) {
    say(`stopped at the first surprise: ${res.surprise ?? "not flat after clean-up"}`);
    break;
  }
}
// The written criteria (build log, "Pass criteria for telling Michael `pair on`"), judged from these results. "not settled" and "unchecked"
// go to Michael as such; only "pass" on T1, T2 and the clean-ups (with T3 not "fail") lets the builder name `pair on`.
const t12 = results.filter((r) => r.kind === "T1T2");
const t2judged = t12.filter((r) => r.pass1 && !r.skipped2 && r.pass2 !== null);
const t3s = results.filter((r) => r.kind === "T3");
// Group 2, round 2: a judged trial that failed is a "fail" even when the run stopped early (before, that read "not settled").
const t2failed = t2judged.some((r) => !r.stopCancelled || r.surprise !== null) || t2judged.filter((r) => !r.within).length >= 2;
const criteria = {
  T1: t12.some((r) => r.pass1 === false) ? "fail" : t12.length === 3 && t12.every((r) => r.pass1) ? "pass" : "not settled",
  T2: t2failed ? "fail" : t2judged.length < 2 ? "not settled" : t2judged.filter((r) => r.within).length >= 2 ? "pass" : "fail",
  T3: t3s.some((r) => r.pass === false) ? "fail" : t3s.some((r) => r.pass === true) ? "pass" : "unchecked (no stop sold)",
  cleanups: results.every((r) => r.flatAfter) ? "pass" : "fail",
  T4: "reported only",
};
say(JSON.stringify({ criteria }));
record({ event: "end", results, criteria });
say(`done: ${results.length} trial(s); records in ${out}`);
