// Types for offhours-window.mjs (the tests import it).
export const CUTOFF_BEFORE_OPEN_MS: number;
export function offhoursWindowProblems(now: Date, clock: { is_open?: boolean; next_open?: string } | null, today: { is_trading_day?: boolean; open_at?: string | Date | null; close_at?: string | Date | null } | null): string[];
