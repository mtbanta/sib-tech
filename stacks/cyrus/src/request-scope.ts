// Michael's decision of 2026-11-13 (item 2, third point: "so total requests can never exceed Alpaca's limit"), group 1 round 1 of the
// weekend build: the Alpaca client retries a failed request on its own (reads up to 3 times, cancels up to 6, a refused sell up to 8).
// Inside a try for an entry with a timed-out fresh stop, each of those extra sends must also come out of the stuck-retry allowance. This
// scope carries that allowance down the call chain (Node's AsyncLocalStorage follows the awaits of one call, not other work running at the
// same time), so the client asks it before each retry and stops retrying when it has no room. Outside such a try there is no scope, and the
// client behaves exactly as before.
import { AsyncLocalStorage } from "node:async_hooks";

export const requestScope = new AsyncLocalStorage<{ take(n: number): boolean }>();

// True when the client may send one more attempt of a request it is retrying (always true outside a scope; charged inside one).
export function retryAllowedInScope(): boolean {
  const budget = requestScope.getStore();
  return !budget || budget.take(1);
}

// Runs `fn` with `budget` as the scope (or plainly without one).
export function inRequestScope<T>(budget: { take(n: number): boolean } | undefined, fn: () => Promise<T>): Promise<T> {
  return budget ? requestScope.run(budget, fn) : fn();
}
