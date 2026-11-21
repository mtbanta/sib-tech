// Shared paths for strategy run 3. Run 1's files and work folder are read, never written.
import { join } from "node:path";
import { DATA, RUN } from "./common.ts";
export const minuteFile = (p: string, s: string) => join(DATA, "raw", "minute", p, s.replace(/\./g, "_") + ".json.gz");
export const WORK3 = join(DATA, "work", "r3");             // run 3's intermediate files (git-ignored)
export const OUT3 = join(RUN, "strategy-run-3-data");       // run 3's committed outputs
export const MIN_MULT = 3;                                   // change 2: the 3x group (at least 3, under 4)
export const groupOf = (r: number) => r >= 6 ? "6x+" : r >= 5 ? "5x" : r >= 4 ? "4x" : "3x";
// Change 1: the flags Michael ruled out. "new shares" covers all three of run 1's new-shares forms
// (decision point in the trajectory); each removed row keeps its exact flag text.
export const REMOVE_FLAGS: [string, RegExp][] = [
  ["shell (SPAC) merger", /shell merger/],
  ["new shares after bankruptcy", /new shares/],
  ["missing earnings date", /missing earnings date/],
  ["delisted", /^delisted$/],
  ["acquired", /^acquired$/],
];
export const removalReasons = (flags: string[]) => REMOVE_FLAGS.filter(([, re]) => flags.some(f => re.test(f))).map(([k]) => k);
