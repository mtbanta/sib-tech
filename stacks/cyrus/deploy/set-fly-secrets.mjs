// Copies the worker's secrets from .env.local to the Fly app, without printing them and without putting
// them on a command line (they travel through standard input). Only what the worker needs is sent:
// not the Fly token, not the Supabase service key (the worker does not use the Data API), not the
// Healthchecks API key.
// Run from stacks/cyrus:  node deploy/set-fly-secrets.mjs
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const SEND = [
  "ALPACA_PAPER_API_KEY_ID", "ALPACA_PAPER_API_SECRET_KEY", "DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID",
  "DISCORD_COMMAND_CHANNEL_ID", "DISCORD_ALERTS_WEBHOOK_URL", "DISCORD_OWNER_USER_ID", "SUPABASE_DB_URL", "HEALTHCHECKS_PING_URL",
];
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const eq = line.indexOf("=");
  if (eq > 0 && !line.startsWith("#")) env[line.slice(0, eq)] = line.slice(eq + 1).trim();
}
const missing = SEND.filter((k) => !env[k]);
if (missing.length) {
  console.error("Missing in .env.local:", missing.join(", "));
  process.exit(1);
}
if (!/^postgres(ql)?:\/\//.test(env.SUPABASE_DB_URL)) {
  console.error("SUPABASE_DB_URL is not a Postgres connection string yet");
  process.exit(1);
}
if (!env.ALPACA_PAPER_API_KEY_ID.startsWith("PK")) {
  console.error("Refusing: the Alpaca key id is not a paper key");
  process.exit(1);
}
const fly = join(homedir(), ".fly/bin/fly");
const r = spawnSync(fly, ["secrets", "import", "--stage", "-a", "sib-tech-cyrus"], {
  input: SEND.map((k) => `${k}=${env[k]}`).join("\n") + "\n",
  env: { ...process.env, FLY_API_TOKEN: env.FLY_API_TOKEN },
  encoding: "utf8",
});
console.log(r.stdout.replace(/\S{30,}/g, "[hidden]").trim());
console.error(r.stderr.replace(/\S{30,}/g, "[hidden]").trim());
process.exit(r.status ?? 1);
