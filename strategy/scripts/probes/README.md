# Probes, strategy run 1

One-off checks whose results are quoted in the deliverable and the trajectory. Each runs with `node strategy/scripts/probes/<file>` and calls only Alpaca's market data host or SEC (read-only).

| File | What it checks | Where quoted |
| :---- | :---- | :---- |
| probe-1.ts | Earliest daily and 1 minute bars, `sip` and `iex` feeds; delisted symbols served | Deliverable 3.1; trajectory step 10 |
| probe-2.ts | History filed under the current symbol (META, FB, SQ, XYZ); corporate actions depth | Trajectory steps 11 and 12 |
| probe-3.ts | Corporate actions counts by year | Trajectory step 12 |
| probe-4.ts | No over-the-counter symbols; bankrupt history under the Q symbol; pagination | Deliverable 2.2 and 3.1; trajectory step 16 |
| probe-5.ts | Daily bar is regular session with official open and close | Deliverable 2.4; trajectory step 18 |
| probe-6.ts, probe-7.ts, probe-8.ts | Symbols per request and page counts | Trajectory step 19 |
| probe-9.ts | Form 25 and EDGAR name lookup (Twitter) | Trajectory section 2 |
| probe-10.ts | Which company Alpaca's CNR and AAC bars belong to | Deliverable 2.5; trajectory step 31 |
| probe-11.ts | Bytes per 1 minute bar (110 JSON, 78 CSV) | Deliverable 6 |
| probe-12-spy-low.ts | SPY's lowest close before period B (from the cache) | Deliverable 4.2 |

The probes write nothing to the repo. Results can drift as vendors update their data.
