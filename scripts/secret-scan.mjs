// Secret scan. Run by the pre-commit hook. Refuses the commit if staged content holds a secret.
// Two checks: (1) every value in any stacks/*/.env.local appears in staged content, (2) key-shaped patterns
// from secret-patterns.mjs. There is no exemption marker: a rule cannot be skipped for a line or a folder.
// It never prints a matched secret, only the file, line number and rule name.
// Usage: node scripts/secret-scan.mjs          scans the staged files (the pre-commit hook)
//        node scripts/secret-scan.mjs --tree   scans every file git tracks, for a full check
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { PATTERNS } = await import(pathToFileURL(join(here, "secret-patterns.mjs")).href);

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const scanTree = process.argv.includes("--tree");

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

const files = (scanTree
  ? execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  : execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], { encoding: "utf8" })
)
  .split("\0")
  .filter(Boolean);

let hits = 0;
for (const f of files) {
  let text;
  try {
    text = scanTree
      ? readFileSync(join(root, f), "utf8")
      : execFileSync("git", ["show", `:${f}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
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
    for (const [name, re] of PATTERNS) {
      if (re.test(line)) {
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
console.log(`SECRET SCAN: clean (${files.length} files, ${secretValues.length} local secret values checked)`);
