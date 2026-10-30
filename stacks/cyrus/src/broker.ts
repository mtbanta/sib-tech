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
  | "cancelOrder"
  | "closePosition"
  | "closeAllPositions"
>;

// Only the order gate is handed this wider type, because only the gate may send an entry.
export type GateBroker = Broker & Pick<AlpacaTrading, "submitEntry">;
