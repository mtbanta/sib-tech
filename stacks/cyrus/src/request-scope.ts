// WHO IS ASKING (the redesign of 2026-11-14, part 1). Every request the worker sends to Alpaca's trading interface is made inside a scope
// that says who asked: an entry, a first try of safety work, a budgeted retry or check (class P1 or P2, with its reservation in the shared
// request budget, request-budget.ts), or nothing (routine work). Node's AsyncLocalStorage carries the scope down the call chain through
// every await, the sell gate's and the liquidator's one-at-a-time queues, and the Alpaca client's own retries, so the request is charged
// to whoever asked at the one place it is sent (`once()` in alpaca-trading.ts, and the test brokers).
//
// Worker tasks that start new work (the order sync, the background steps) start outside any scope (`outsideScope`), so a timer or a task
// set up inside one try never carries that try's scope into later work.
import { AsyncLocalStorage } from "node:async_hooks";

export type Tag = "entry" | "first" | "P1" | "P2" | "routine";

// What a reservation does for the code that sends requests (request-budget.ts holds the rest).
export interface ScopeReservation {
  // Called once for each request sent inside the scope (every attempt, the client's own retries included).
  charge(path: string): void;
  // Further attempts the Alpaca client may send when it retries a request inside this scope: the room left only in a try whose client
  // retries are limited (a timed-out stop's tries, checks and cancels, item 2 of 2026-11-13); Infinity in every other try (design 3.2: a try
  // is never stopped halfway; its extra requests are counted).
  retryRoomLeft(): number;
}

export interface Scope {
  tag: Tag;
  reservation?: ScopeReservation;
}

export const requestScope = new AsyncLocalStorage<Scope>();

// The clock and the calendar are in a separate Alpaca bucket: never charged, never counted against the budget.
export const separateBucket = (path: string): boolean => path === "/v2/clock" || path.startsWith("/v2/calendar");

// Called just before every request is sent: charges the reservation of the scope it was made in (if any).
export function chargeFromScope(path: string): void {
  if (separateBucket(path)) return;
  requestScope.getStore()?.reservation?.charge(path);
}

// The tag of the scope a request is made in ("routine" outside any scope).
export function currentTag(): Tag {
  return requestScope.getStore()?.tag ?? "routine";
}

// True when the Alpaca client may send one more attempt of a request it is retrying: always, except inside a try whose client retries are
// limited (a timed-out stop's work), and there only while its reservation has room (group 1, round 1 of the redesign). Every attempt is
// charged when it is sent, like any other request.
export function retryAllowedInScope(): boolean {
  const r = requestScope.getStore()?.reservation;
  return !r || r.retryRoomLeft() >= 1;
}

// Runs `fn` inside `scope` (or plainly, in whatever scope is current, when none is given).
export function inRequestScope<T>(scope: Scope | undefined, fn: () => Promise<T>): Promise<T> {
  return scope ? requestScope.run(scope, fn) : fn();
}

// Runs `fn` outside any scope (new top-level work).
export function outsideScope<T>(fn: () => T): T {
  return requestScope.exit(fn);
}
