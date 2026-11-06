#!/bin/sh
# Rebuild every CSV, the summary and the HTML from the cached raw data in strategy/data/.
# Steps that download (1, 2, 4, and the SEC and market-cap lookups in 5) read their caches and only
# call the network for a missing cache file. Run from the repository root: sh strategy/scripts/rebuild.sh
set -e
cd "$(dirname "$0")/.."
node scripts/01-fetch-lists.ts
node scripts/02-fetch-monthly.ts
node scripts/03-screen.ts
node scripts/03b-ftd-index.ts
node scripts/04-fetch-daily.ts B C D A
node scripts/05-build.ts B C D A
node scripts/07-sizing-audit.ts
node scripts/06-outputs.ts
node scripts/08-html.ts
