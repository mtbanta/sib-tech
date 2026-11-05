// What goes into the database's run log (the `events` table). On 2026-11-02 the table stayed empty all day because
// only warnings and errors were stored and the day logged none (the close-out failure was logged at info level).
// Now the info events that tell the story of a day are stored too: commands, limit decisions, the stream start,
// unprotected positions, sale problems, the start and stop of the worker. Per-trade events (signals, each entry
// sent) are NOT stored here: the orders table already holds every entry, and a busy day would bury this log.
export const STORED_INFO_EVENTS = new Set([
  "command",
  "limits_decision",
  "stream_started",
  "worker_started",
  "worker_stopping",
  "unprotected_position",
  "loss_stop_sale_retried",
  "future_days_reset",
  "sell_refused",
  "sell_failed",
  "liquidation_result",
  "unprotected_position_already_gone",
  "order_list_incomplete",
  "entries_swept_while_stopped",
  "order_record_update_failed",
  // Release B (load days): the live order updates connecting, and the 60 second limit's outcomes.
  "order_stream",
  "order_stream_started",
  "time_limit",
  "time_limit_stalled",
  "time_limit_refused",
]);

export function shouldStoreEvent(level: "info" | "warn" | "error", event: string): boolean {
  return level !== "info" || STORED_INFO_EVENTS.has(event);
}
