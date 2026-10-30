import { test } from "node:test";
import { FAKE_ENV } from "./fakes.ts";
import assert from "node:assert/strict";
import { parseNasdaqListed, parseOtherListed } from "../src/universe.ts";
import { screen, liveListSize, DEFAULT_SCREEN, type Bar } from "../src/screen.ts";
import { TradeStream, type StreamStatus, type Trade } from "../src/stream.ts";
import { loadSettings } from "../src/config.ts";

const nasdaq = [
  "Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares",
  "AAPL|Apple Inc. - Common Stock|Q|N|N|100|N|N",
  "AAAP|Pacer Barings CLO Market Flex ETF|G|N|N|100|Y|N",
  "ZTST|Test Co - Common Stock|Q|Y|N|100|N|N",
  "ABCDW|Some Acquisition Corp - Warrant|G|N|N|100|N|N",
  "ABCDU|Some Acquisition Corp - Unit|G|N|N|100|N|N",
  "BRK.B|Berkshire|Q|N|N|100|N|N",
  "File Creation Time: 1030202614:01|||||||",
].join("\n");
const other = [
  "ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol",
  "A|Agilent Technologies, Inc. Common Stock|N|A|N|100|N|A",
  "AAM|American Strategic Investment Co. Common Stock|A|AAM|N|100|N|AAM",
  "SPY|SPDR S&P 500 ETF Trust|P|SPY|Y|100|N|SPY",
  "F|Ford Motor Company Common Stock|N|F|N|100|N|F",
  "FPRE|Ford 6% Preferred|N|FPRE|N|100|N|FPRE",
  "File Creation Time: 1030202614:01||||||",
].join("\n");

test("universe keeps plain common stocks, drops ETFs, tests, warrants, units, odd tickers and non-NYSE listings", () => {
  assert.deepEqual(parseNasdaqListed(nasdaq), ["AAPL"]);
  assert.deepEqual(parseOtherListed(other), ["A", "F"]);
});

const bar = (day: number, c: number, v: number): Bar => ({ t: `2026-10-${String(day).padStart(2, "0")}T04:00:00Z`, o: c, h: c, l: c, c, v });
const series = (closes: number[], vols: number[]) => closes.map((c, i) => bar(20 + i, c, vols[i]!));

test("screen filters price and liquidity and ranks by unusual volume, deterministically", () => {
  const m = new Map<string, Bar[]>([
    ["HOT", series([50, 50, 50, 50, 50], [3e6, 3e6, 3e6, 3e6, 9e6])], // ratio 3
    ["WARM", series([50, 50, 50, 50, 50], [3e6, 3e6, 3e6, 3e6, 4.5e6])], // ratio 1.5
    ["TIE1", series([50, 50, 50, 50, 50], [3e6, 3e6, 3e6, 3e6, 4.5e6])], // ratio 1.5, ties by symbol
    ["PENNY", series([2, 2, 2, 2, 2], [9e7, 9e7, 9e7, 9e7, 9e8])], // price too low
    ["PRICEY", series([900, 900, 900, 900, 900], [9e6, 9e6, 9e6, 9e6, 9e7])], // price too high
    ["THIN", series([50, 50, 50, 50, 50], [1e4, 1e4, 1e4, 1e4, 1e6])], // not liquid
    ["SHORT", series([50, 50], [3e6, 9e6])], // too few sessions
    ["ZERO", series([50, 50, 50, 50, 50], [0, 0, 0, 0, 9e6])], // earlier volume zero
  ]);
  const out = screen(m, { ...DEFAULT_SCREEN, listSize: 3 });
  assert.deepEqual(out.map((c) => c.symbol), ["HOT", "TIE1", "WARM"]);
  assert.equal(out[0]!.volumeRatio, 3);
  assert.deepEqual(screen(m, { ...DEFAULT_SCREEN, listSize: 3 }), out);
});

test("the live list is cut to the free stream's 30 symbols, and not on sip", () => {
  assert.equal(liveListSize(100, "iex"), 30);
  assert.equal(liveListSize(20, "iex"), 20);
  assert.equal(liveListSize(100, "sip"), 100);
});

// ---- stream, with a fake socket ----
const settings = (feed?: string) => loadSettings({
  ...FAKE_ENV,
  ...(feed ? { ALPACA_DATA_FEED: feed } : {}),
});

class FakeSocket {
  sent: any[] = []; closed = false;
  onopen: any = null; onmessage: any = null; onclose: any = null; onerror: any = null;
  url: string;
  constructor(url: string) { this.url = url; }
  send(d: string) { this.sent.push(JSON.parse(d)); }
  close() { this.closed = true; this.onclose?.({}); }
  push(msgs: unknown[]) { this.onmessage?.({ data: JSON.stringify(msgs) }); }
}

function setup(feed?: string, symbols = ["AAPL", "MSFT"]) {
  const sockets: FakeSocket[] = []; const timers: Array<() => void> = []; const statuses: string[] = []; const trades: Trade[] = [];
  const s = new TradeStream(settings(feed), symbols, (t) => trades.push(t), (st: StreamStatus, d?: string) => statuses.push(st + (d ? `:${d}` : "")), {
    makeSocket: (u) => { const f = new FakeSocket(u); sockets.push(f); return f; },
    setTimer: (fn) => { timers.push(fn); return 0; },
  });
  return { s, sockets, timers, statuses, trades };
}

test("stream: connects to the configured feed, authenticates, subscribes, delivers trades", () => {
  const { s, sockets, statuses, trades } = setup();
  s.start();
  assert.equal(sockets[0]!.url, "wss://stream.data.alpaca.markets/v2/iex");
  sockets[0]!.push([{ T: "success", msg: "connected" }]);
  assert.equal(sockets[0]!.sent[0].action, "auth");
  sockets[0]!.push([{ T: "success", msg: "authenticated" }]);
  assert.deepEqual(sockets[0]!.sent[1], { action: "subscribe", trades: ["AAPL", "MSFT"] });
  sockets[0]!.push([{ T: "subscription", trades: ["AAPL", "MSFT"] }]);
  sockets[0]!.push([{ T: "t", S: "AAPL", p: 343.5, s: 100, t: "2026-10-30T18:00:00Z" }, { T: "q", S: "AAPL" }]);
  assert.equal(s.status, "live");
  assert.deepEqual(trades, [{ symbol: "AAPL", price: 343.5, size: 100, time: "2026-10-30T18:00:00Z" }]);
  assert.ok(statuses.includes("live"));
});

test("stream: the feed is a setting (sip changes the address only)", () => {
  const { s, sockets } = setup("sip");
  s.start();
  assert.equal(sockets[0]!.url, "wss://stream.data.alpaca.markets/v2/sip");
});

test("stream: more than 30 symbols on iex is refused up front", () => {
  assert.throws(() => setup("iex", Array.from({ length: 31 }, (_, i) => `S${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`)), /at most 30/);
  setup("sip", Array.from({ length: 31 }, (_, i) => `T${String.fromCharCode(65 + (i % 26))}`));
});

test("stream: a dropped connection reconnects with a growing delay, and stop() prevents it", () => {
  const { s, sockets, timers } = setup();
  s.start();
  sockets[0]!.onclose({});
  assert.equal(s.status, "reconnecting");
  assert.equal(timers.length, 1);
  timers.shift()!();
  assert.equal(sockets.length, 2);
  s.stop();
  assert.equal(s.status, "stopped");
  assert.equal(timers.length, 0);
});

test("stream: a failed login is fatal and does not reconnect; a connection limit error backs off", () => {
  const a = setup();
  a.s.start();
  a.sockets[0]!.push([{ T: "error", code: 402, msg: "auth failed" }]);
  assert.equal(a.s.status, "auth_failed");
  assert.equal(a.timers.length, 0);
  const b = setup();
  b.s.start();
  b.sockets[0]!.push([{ T: "error", code: 406, msg: "connection limit exceeded" }]);
  b.sockets[0]!.onclose({});
  assert.equal(b.timers.length, 1);
});
