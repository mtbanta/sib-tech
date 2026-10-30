// The part of the Alpaca client the rest of the worker uses, as a type, so tests can supply a fake broker.
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
  | "findOrderByClientId"
  | "submitEntry"
  | "cancelOrder"
  | "closePosition"
  | "closeAllPositions"
>;
