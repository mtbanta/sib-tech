// Secret scan. Run by the pre-commit hook. Refuses the commit if staged content holds a secret.
// Two checks: (1) every value in any stacks/*/.env.local appears in staged content, (2) key-shaped patterns
// (skippable per line only in test files, with the marker scan-allow-fake).
// It never prints a matched secret, only the file, line number and rule name.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

// Values from every local key file. Short values (under 12 characters) are skipped to avoid false hits.
const secretValues = [];
const stacksDir = join(root, "stacks");
if (existsSync(stacksDir)) {
  for (const stack of readdirSync(stacksDir)) {
    const file = join(stacksDir, stack, ".env.local");
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const value = line.slice(eq + 1).trim();
      if (value.length >= 12) secretValues.push(value);
    }
  }
}

const patterns = [
  ["alpaca key id", /\b(PK|AK|CK)[A-Z0-9]{18,}\b/],
  ["discord webhook", /discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+/],
  ["discord bot token", /\b[MNO][\w-]{23,26}\.[\w-]{6}\.[\w-]{27,}\b/],
  ["api key with sk- prefix", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ["database url with password", /\bpostgres(ql)?:\/\/[^\s:@/]+:[^\s@/]+@/],
  ["healthchecks ping url", /hc-ping\.com\/[0-9a-f-]{20,}/],
  ["supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{10,}\b/],
  ["supabase access token", /\bsbp_[a-f0-9]{30,}\b/],
  ["private key header", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

const files = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

let hits = 0;
for (const f of files) {
  let text;
  try {
    text = execFileSync("git", ["show", `:${f}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    continue;
  }
  if (text.includes("\0")) continue; // binary
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const v of secretValues) {
      if (line.includes(v)) {
        console.error(`SECRET SCAN: ${f}:${i + 1} contains a value from a .env.local file`);
        hits++;
      }
    }
    // A line in a test file may carry the marker "scan-allow-fake" for an obviously fake, key-shaped value.
    // The marker skips only the pattern rules. The check against the real values above is never skipped.
    const markedFake = /(^|\/)test\//.test(f) && line.includes("scan-allow-fake");
    for (const [name, re] of patterns) {
      if (!markedFake && re.test(line)) {
        console.error(`SECRET SCAN: ${f}:${i + 1} matches rule "${name}"`);
        hits++;
      }
    }
  });
}
if (hits > 0) {
  console.error(`SECRET SCAN: refusing the commit (${hits} hit${hits === 1 ? "" : "s"}). Remove the secret, then commit again.`);
  process.exit(1);
}
console.log(`SECRET SCAN: clean (${files.length} staged files, ${secretValues.length} local secret values checked)`);
