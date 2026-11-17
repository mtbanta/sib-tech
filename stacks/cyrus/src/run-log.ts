// What goes into the database's run log (the `events` table). On 2026-11-02 the table stayed empty all day because
// only warnings and errors were stored and the day logged none (the close-out failure was logged at info level).
// Now the info events that tell the story of a day are stored too: commands, limit decisions, the stream start,
// unprotected positions, sale problems, the start and stop of the worker. Per-trade events (signals, each entry
// sent) are NOT stored here: the orders table already holds every entry, and a busy day would bury this log.
import type { Logger } from "./log.ts";
import type { Redactor } from "./redact.ts";
import type { Store } from "./store.ts";

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
  // The live order updates connecting (every day since the speed release).
  "order_stream",
  "order_stream_reconnect_sync",
  "lost_exit_fast_ended",
  // Item 3 of 2026-11-16 (group 2, round 1): a missing-exit sale (the fast sale's too) that stood aside for a sale of the whole account or
  // the close-out, with its symbol (the stored `liquidation_result` row has none).
  "unprotected_position_yielded",
  "order_stream_started",
  // Michael's decision of 2026-11-09 (logging only): why a sale is blocked, and the remainder sales with the age of the order list.
  "sale_blocked",
  "bare_remainder",
  // Michael's approval of 2026-11-10: a sale noticed late (logging only), and a remainder sale recounted because its take-profit filled
  // more shares while its cancel landed (fix A).
  "late_notice",
  "remainder_recount",
  // Group 2 review, round 1: a "not filled yet" sale whose closing line was dropped (ended unfilled, or not seen filled in 2 minutes).
  "awaiting_fill_dropped",
  // Michael, 2026-11-12 (afternoon, logging only): the fast sale for lost exits (A5) and the fresh stop for remainders (A4), so their
  // timing is kept in the run log and not only in Fly's short log.
  "lost_exit_fast_start",
  "lost_exit_fast",
  "lost_exit_fast_skipped",
  "lost_exit_fast_failed",
  "cleanup_covered_by_own_sale",
  "fresh_stop",
  "fresh_stop_gone",
  "fresh_stop_ended",
  "fresh_stop_recovered",
  "fresh_stop_unclear",
  "fresh_stop_refused",
  "fresh_stop_lookup_failed",
  // The same release: the afternoon load window's start and its 30 minute close-out, and symbols the screen dropped as not tradable.
  "load_afternoon",
  "afternoon_closeout",
  "screen_not_tradable",
  // Item 2 of 2026-11-13 (group 2, round 1 of the weekend build): the timed-out stop's status checks and end, a try that waited for room in
  // the shared request budget (since the redesign of 2026-11-14: a timed-out stop's try, the 15 second limit, or the list-lag recheck's own
  // timer, at most once per refusal, and the recheck at most until its 30 second window ends), and the start-up protection check.
  "fresh_stop_timeout_check",
  "fresh_stop_timeout_ended",
  "timed_out_try_out_of_room",
  "startup_protection_check",
  "startup_protection_check_failed",
  "startup_fresh_stop_confirmed",
  "startup_fresh_stop_unconfirmed",
  "timed_out_stops_save_failed",
  // Item 3 of 2026-11-13: the loss stop's retry pausing (after a rate limit, or a check whose sales were all refused).
  "loss_stop_retry_backoff",
  // Item 3 of 2026-11-13 (group 2, round 3 of the weekend build): a failed lookup of an entry missing from the listing, with its wait.
  "order_lookup_failed",
  // Michael's item 4 of 2026-11-13 (afternoon): a sync of 2 seconds or more, with the time of each step.
  "sync_slow",
  // Michael's item 1 of 2026-11-13 (afternoon): the order list still showing a stop open that the live update reported cancelled.
  "stop_cancel_list_lag",
  "stop_cancel_list_cleared",
  // Item 4 of 2026-11-13: the morning screen's duration (now at 8:15 AM, 10 minutes before "Armed").
  "screen_done",
  // Group 2, round 1 (rare, part of the day's story): the afternoon window's failures and cancels.
  "load_afternoon_failed",
  "load_afternoon_refused",
  "load_afternoon_cancelled",
  "load_afternoon_not_switched",
  // Michael's ruling B of 2026-11-12: every fresh stop's time to confirm, and the 15 second limit.
  "fresh_stop_confirmed",
  "fresh_stop_timeout",
  "fresh_stop_timeout_cancel",
  "fresh_stop_timeout_cancel_failed",
  // Group 2, round 4 of the night release: a cancel of a timed-out stop the sale never sent, and a try that found that stop still open.
  "fresh_stop_timeout_cancel_not_sent",
  "fresh_stop_timeout_still_open",
  "fresh_stop_unclear_end",
  // The redesign of 2026-11-14, part 1 (for the reviews): a budgeted try that sent more than it reserved (at most once per try), a request
  // sent after its try ended, a fresh-stop lookup skipped for lack of room (once per wait: the first refusal in a row), and a list-lag recheck
  // dropped at the end of its window (at most once per window). Every refusal (`budget_refused`) stays in Fly's log only; the per-minute
  // statistics (`governor_stats`, stored) count them.
  "budget_overdraft",
  "budget_sent_after_end",
  "fresh_stop_lookup_skipped",
  "list_lag_recheck_window_over",
  // The redesign of 2026-11-14, part 2 (rare): an action of the protection loop that threw, when no worker reports it (the worker logs it at
  // error level and alerts; that entry's next action waits 5 s, doubling to 30 s).
  "protection_action_failed",
  // Night build of 2026-11-16 (group 2, round 1; logging only). Protect-first's episodes (item 2): they fire only while it is switched on
  // (`PROTECT_FIRST.on`), about one started and one ended row an episode, and one when it reaches its 30 s limit. Item 1: a cancel still
  // shown working after its last re-send and lookup (rare, at most once an order per 60 s cancel memory). Its re-sends
  // (`cancel_resent`) and failed lookups (`cancel_lookup_failed`) stay in Fly's log only.
  "protect_first_started",
  "protect_first_limit_reached",
  "protect_first_ended",
  "cancel_not_confirmed",
]);

export function shouldStoreEvent(level: "info" | "warn" | "error", event: string): boolean {
  return level !== "info" || STORED_INFO_EVENTS.has(event);
}

export type LogAndStore = (level: "info" | "warn" | "error", event: string, fields?: Record<string, unknown>) => void;

// Every line goes to Fly's log; the ones `shouldStoreEvent` picks also go into the run log, already redacted. A failed write is dropped
// (the line is still in Fly's log). Moved here from main.ts unchanged (group 2, night build of 2026-11-16, round 1) so it can be tested.
export function makeLogAndStore(log: Logger, store: Pick<Store, "addEvent">, redact: Redactor): LogAndStore {
  return (level, event, fields) => {
    log(level, event, fields);
    if (shouldStoreEvent(level, event)) void store.addEvent(level, event, JSON.parse(redact(JSON.stringify(fields ?? {})))).catch(() => undefined);
  };
}
