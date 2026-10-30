// Runs the daily screen and listens to the live list for a short while. Read only. Run from stacks/cyrus:
//   node src/tools/screen-check.ts [seconds]
import { loadLocalEnv } from "../local-env.ts";
import { loadSettings } from "../config.ts";
import { AlpacaData } from "../alpaca-data.ts";
import { fetchUniverse } from "../universe.ts";
import { screen, liveListSize, DEFAULT_SCREEN } from "../screen.ts";
import { TradeStream } from "../stream.ts";

loadLocalEnv();
const settings = loadSettings();
const data = new AlpacaData(settings);
const seconds = Number(process.argv[2]) || 20;

const universe = await fetchUniverse();
console.log("universe size", universe.length);
const end = new Date(Date.now() - 16 * 60_000).toISOString(); // free history must be 15 minutes old
const start = new Date(Date.now() - 12 * 86_400_000).toISOString();
const t0 = Date.now();
const bars = await data.dailyBars(universe, start, end, "sip");
console.log("symbols with bars", bars.size, "fetched in", Math.round((Date.now() - t0) / 1000), "s");
const size = liveListSize(DEFAULT_SCREEN.listSize, data.feed);
const list = screen(bars, { ...DEFAULT_SCREEN, listSize: size });
console.log("live list", list.map((c) => `${c.symbol}(${c.volumeRatio.toFixed(1)}x)`).join(" "));

let count = 0;
const seen = new Set<string>();
const stream = new TradeStream(settings, list.map((c) => c.symbol), (t) => { count++; seen.add(t.symbol); }, (s, d) => console.log("stream", s, d ?? ""));
stream.start();
await new Promise((r) => setTimeout(r, seconds * 1000));
stream.stop();
console.log("trades received", count, "from", seen.size, "symbols");
process.exit(0);
