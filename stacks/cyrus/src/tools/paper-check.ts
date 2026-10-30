// Checks the paper plumbing against Alpaca's paper server. Run from stacks/cyrus:
//   node src/tools/paper-check.ts           read only, plus tightening the paper account's safety switches
//   node src/tools/paper-check.ts --trade   also buys 1 share of SPY with a protective stop, then closes everything
// Paper only. It prints no keys and no account numbers.
import { loadLocalEnv } from "../local-env.ts";
import { loadSettings } from "../config.ts";
import { AlpacaTrading } from "../alpaca-trading.ts";
import { AlpacaData } from "../alpaca-data.ts";

loadLocalEnv();
const settings = loadSettings();
const trading = new AlpacaTrading(settings);
const data = new AlpacaData(settings);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const account = await trading.getAccount();
console.log("account", { status: account.status, equity: account.equity, cash: account.cash, multiplier: account.multiplier, tradingBlocked: account.tradingBlocked });
if (account.equity !== 20000) console.log("NOTE: equity is not 20000 (a trade may have changed it, or this is not the 20,000 dollar account)");

// Tighten only: long only, borrowing cap 1 (the lowest). Raising the cap needs the owner's approval.
const before = await trading.getAccountConfig();
console.log("config before", before);
const after = await trading.setAccountConfig({ noShorting: true, maxMarginMultiplier: 1 });
console.log("config after ", after, after.maxMarginMultiplier === 1 && after.noShorting ? "(paper honours both settings)" : "(NOT honoured)");
const reread = await trading.getAccountConfig();
console.log("config reread", reread);

const clock = await trading.getClock();
console.log("clock", { isOpen: clock.isOpen, now: clock.timestamp, nextClose: clock.nextClose });
console.log("feed", data.feed);

if (process.argv.includes("--trade")) {
  if (!clock.isOpen) {
    console.log("market is closed, skipping the trade check");
  } else {
    const last = await data.latestTrade("SPY");
    console.log("SPY last (", data.feed, ")", last.price, last.time);
    const stop = Math.floor(last.price * 0.95 * 100) / 100;
    const clientOrderId = `cyrus-plumbing-${Date.now()}`;
    try {
    const order = await trading.submitEntry({ symbol: "SPY", qty: 1, stopPrice: stop, referencePrice: last.price, clientOrderId });
    console.log("submitted", { status: order.status, class: order.orderClass, legs: order.legs.map((l) => ({ type: l.type, status: l.status, stop: l.stopPrice })) });
    // Same id again must not create a second order.
    const again = await trading.submitEntry({ symbol: "SPY", qty: 1, stopPrice: stop, referencePrice: last.price, clientOrderId }).catch((e: Error) => ({ error: e.message }));
    console.log("resubmit with same id", "id" in again ? { sameOrder: again.id === order.id } : again);
    let filled = order;
    for (let i = 0; i < 15 && filled.status !== "filled"; i++) {
      await sleep(2000);
      filled = (await trading.findOrderByClientId(clientOrderId)) ?? filled;
    }
    console.log("entry", { status: filled.status, filledQty: filled.filledQty, avg: filled.filledAvgPrice, legs: filled.legs.map((l) => ({ type: l.type, status: l.status, stop: l.stopPrice })) });
    console.log("positions", (await trading.listPositions()).map((p) => ({ symbol: p.symbol, qty: p.qty })));
    console.log("open orders", (await trading.listOrders("open")).map((o) => ({ symbol: o.symbol, type: o.type, status: o.status })));
    } finally {
      // Whatever happened above, leave the paper account flat.
      await trading.closeAllPositions();
      await sleep(3000);
      console.log("after close: positions", (await trading.listPositions()).length, "open orders", (await trading.listOrders("open")).length);
    }
  }
}
