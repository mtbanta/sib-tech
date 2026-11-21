#!/bin/sh
# Strategy run 3: rebuild every CSV, the summary, the summary tables and the HTML page from the cached raw data
# in strategy/data/ (git-ignored). Download steps (r3-04, r3-05's SEC and market cap lookups, r3-06, r3-07) read
# their caches and call the network only for a missing cache file. Run 1's cached data is reused as is.
# Run from the repository root:  sh strategy/scripts/r3-rebuild.sh
set -e
cd "$(dirname "$0")/.."
node scripts/r3-03-screen.ts
node scripts/r3-04-fetch-daily.ts B C D A
node scripts/r3-05-build.ts B C D A
node scripts/r3-06-caps.ts
node scripts/r3-07-fetch-minute.ts 600
node scripts/r3-08-time-of-day.ts B C D A
node scripts/r3-09-outputs.ts
node scripts/r3-10-html.ts
