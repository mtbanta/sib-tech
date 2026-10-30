// Checks the bot against the real server: finds the channels, confirms the command channel, reads the newest
// command message (to see whether message text is visible), and posts one line to `trading`.
// Run from stacks/cyrus:  node src/tools/discord-check.ts
import { loadLocalEnv } from "../local-env.ts";
import { loadSettings, secretValues } from "../config.ts";
import { makeRedactor } from "../redact.ts";
import { DiscordBot } from "../discord-bot.ts";

loadLocalEnv();
const settings = loadSettings();
const bot = new DiscordBot(settings, makeRedactor(secretValues(settings)));
await bot.start();
console.log("channels found; command channel belongs to the configured server");
const latest = await bot.latestCommandMessageId();
if (latest) {
  const [m] = await bot.commandMessagesAfter(String(BigInt(latest) - 1n));
  console.log("newest command message:", m ? `from owner: ${m.authorId === settings.discord.ownerUserId}, bot: ${m.authorIsBot}, text visible: ${m.content.length > 0}` : "none");
} else {
  console.log("command channel is empty");
}
console.log("posted to trading:", await bot.post("trading", "Stack C bot check: this bot can post here. Paper trading only. Research input for a human decision, never an instruction to act."));
