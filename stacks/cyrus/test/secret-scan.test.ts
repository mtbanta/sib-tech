// Proves the repo's pre-commit secret scan refuses a commit that holds a realistic-looking token.
// It runs the real hook and the real scan script inside a throwaway git repository, with a dummy identity.
// Every token is assembled at run time (see fakes.ts), so this file never holds a token shape.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { shaped } from "./fakes.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");
let dir = "";

const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
function git(...args: string[]) {
  const r = spawnSync("git", ["-c", "user.name=Scan Test", "-c", "user.email=scan-test@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: dir, env, encoding: "utf8" });
  return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}
const head = () => git("rev-parse", "--verify", "-q", "HEAD").out.trim();

before(() => {
  dir = mkdtempSync(join(tmpdir(), "secret-scan-test-"));
  mkdirSync(join(dir, "scripts"));
  mkdirSync(join(dir, ".githooks"));
  cpSync(join(repoRoot, "scripts/secret-scan.mjs"), join(dir, "scripts/secret-scan.mjs"));
  cpSync(join(repoRoot, "scripts/secret-patterns.mjs"), join(dir, "scripts/secret-patterns.mjs"));
  cpSync(join(repoRoot, ".githooks/pre-commit"), join(dir, ".githooks/pre-commit"));
  chmodSync(join(dir, ".githooks/pre-commit"), 0o755);
  git("init", "-q");
  git("config", "core.hooksPath", ".githooks");
  writeFileSync(join(dir, "README.md"), "scratch\n");
  git("add", ".");
  assert.equal(git("commit", "-q", "-m", "start").code, 0, "the starting commit must pass the hook");
});
after(() => rmSync(dir, { recursive: true, force: true }));

function tryCommit(path: string, content: string) {
  mkdirSync(join(dir, path, ".."), { recursive: true });
  writeFileSync(join(dir, path), content);
  git("add", path);
  const before = head();
  const r = git("commit", "-q", "-m", "try");
  return { ...r, moved: head() !== before };
}
function reset() {
  git("reset", "-q", "--hard");
  git("clean", "-fdq");
}

const cases: Array<[string, () => string, string]> = [
  ["a Discord bot token", shaped.discordBotToken, "discord bot token"],
  ["a Discord bot token that starts with another letter", shaped.discordBotTokenOtherStart, "discord bot token"],
  ["a Discord webhook address", shaped.discordWebhook, "discord webhook"],
  ["a paper Alpaca key id", shaped.alpacaKeyId, "alpaca key id"],
  ["a live Alpaca key id", shaped.liveAlpacaKeyId, "alpaca key id"],
  ["an Alpaca secret key", shaped.alpacaSecretLine, "alpaca secret key"],
  ["a Supabase secret key", shaped.supabaseSecretKey, "supabase secret key"],
  ["a Supabase personal access token", shaped.supabaseAccessToken, "supabase access token"],
  ["a Supabase OAuth access token", shaped.supabaseOauthToken, "supabase access token"],
  ["a Supabase service key (JWT)", shaped.jwt, "jwt"],
  ["a database address with a password", shaped.databaseUrl, "database url with password"],
  ["a Healthchecks ping address", shaped.healthchecksPing, "healthchecks ping url"],
  ["a Healthchecks API key", shaped.healthchecksKeyLine, "healthchecks api key"],
  ["a Fly.io token", shaped.flyToken, "fly.io token"],
  ["a private key header", shaped.privateKeyHeader, "private key header"],
];

for (const [label, make, rule] of cases) {
  test(`the hook refuses a commit holding ${label}`, () => {
    const token = make();
    const r = tryCommit("notes/example.txt", `some text\n${token}\nmore text\n`);
    assert.notEqual(r.code, 0, "the commit must be refused");
    assert.equal(r.moved, false, "HEAD must not move");
    assert.ok(r.out.includes(`rule "${rule}"`), `expected rule ${rule}, got: ${r.out.replace(token, "<token>")}`);
    assert.ok(!r.out.includes(token), "the scan must never print the token");
    reset();
  });
}

test("the old exemption marker no longer lets a token through, in a test folder or anywhere", () => {
  for (const path of ["stacks/cyrus/test/example.test.ts", "notes/example.txt"]) {
    const r = tryCommit(path, `const t = "${shaped.discordBotToken()}"; // scan-allow-fake\n`);
    assert.notEqual(r.code, 0, path);
    assert.equal(r.moved, false, path);
    reset();
  }
});

test("a value copied from a local .env.local file is refused, even if it has no token shape", () => {
  const value = "plain-looking-local-value-1234";
  mkdirSync(join(dir, "stacks/cyrus"), { recursive: true });
  writeFileSync(join(dir, "stacks/cyrus/.env.local"), `SOME_KEY=${value}\n`); // never staged
  const r = tryCommit("notes/leak.txt", `oops ${value}\n`);
  assert.notEqual(r.code, 0);
  assert.equal(r.moved, false);
  assert.ok(!r.out.includes(value));
  rmSync(join(dir, "stacks"), { recursive: true, force: true });
  reset();
});

test("ordinary files commit normally", () => {
  const r = tryCommit("notes/clean.txt", "bought 10 AAPL at 343.43\nhttps://discord.com/api/webhooks/FAKE-ID/FAKE-TOKEN\n");
  assert.equal(r.code, 0, r.out);
  assert.equal(r.moved, true);
});
