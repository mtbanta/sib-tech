// The parts of the Alpaca client the rest of the worker uses, as types, so tests can supply a fake broker.
// Selling and entering are split on purpose: only the order gate (gate.ts) is handed `submitEntry`, and only the
// sell gate (sells.ts) is handed `submitSell`. Nothing in the worker can ask Alpaca to close a position in bulk:
// those calls do not exist in this client any more (they cancelled the stops and then failed; see the build C2
// log, Job 1).
import type { AlpacaTrading } from "./alpaca-trading.ts";

export type Broker = Pick<
  AlpacaTrading,
  | "getClock"
  | "getAccount"
  | "getAccountConfig"
  | "setAccountConfig"
  | "getCalendar"
  | "listPositions"
  | "listOrders"
  | "listOrdersPaged"
  | "findOrderByClientId"
  | "cancelOrder"
  | "cancelAllOrders"
>;

export type GateBroker = Broker & Pick<AlpacaTrading, "submitEntry">;
export type SellBroker = Broker & Pick<AlpacaTrading, "submitSell">;
export type FullBroker = Broker & Pick<AlpacaTrading, "submitEntry" | "submitSell">;
