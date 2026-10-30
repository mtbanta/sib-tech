// Posts one test message to the alerts channel. Used for the Discord desktop holdback test.
// Run: node src/tools/post-test-alert.ts
import { loadLocalEnv } from "../local-env.ts";
import { loadSettings, secretValues } from "../config.ts";
import { makeRedactor } from "../redact.ts";
import { postWebhook, NOT_ADVICE } from "../discord.ts";

loadLocalEnv();
const settings = loadSettings();
const redact = makeRedactor(secretValues(settings));
const stamp = new Date().toLocaleTimeString("en-US", { timeZone: "America/Chicago" });
const result = await postWebhook(
  settings.discord.alertsWebhookUrl,
  `Stack C holdback test at ${stamp} Central. If your phone buzzed, there is no holdback. ${NOT_ADVICE}`,
  redact,
);
console.log(result.ok ? "posted" : `failed (status ${result.status})`);
process.exit(result.ok ? 0 : 1);
