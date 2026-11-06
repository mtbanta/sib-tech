// The lowest SPY close before period B in the cached daily bars (deliverable, section 4.2).
import { join } from "node:path";
import { DATA, readJson } from "../common.ts";
const b = readJson<any[]>(join(DATA, "raw", "daily", "B", "SPY.json"));
const m = b.filter(x => x.t < "2020-04-01").sort((a, c) => a.c - c.c)[0];
console.log("lowest SPY close before 2020-04-01:", m.t.slice(0, 10), m.c, "(cache starts", b[0].t.slice(0, 10) + ")");
