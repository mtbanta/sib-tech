// Loads stacks/cyrus/.env.local into the process settings when the file exists (the owner's Mac).
// On Fly.io there is no such file; the same names are secrets on the app. Values already set win.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function loadLocalEnv(): boolean {
  const path = fileURLToPath(new URL("../.env.local", import.meta.url));
  if (!existsSync(path)) return false;
  const before = { ...process.env };
  process.loadEnvFile(path);
  // loadEnvFile does not override existing values, but make that explicit for anything pre-set.
  for (const [k, v] of Object.entries(before)) if (v !== undefined) process.env[k] = v;
  return true;
}
