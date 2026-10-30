// Applies db/*.sql to stack C's Supabase database, in file order, each file once (recorded in
// schema_migrations). Then runs the store behaviour check inside a transaction that is rolled back.
// Run from stacks/cyrus:  node src/tools/apply-schema.ts [--check-only]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadLocalEnv } from "../local-env.ts";
import { loadSettings } from "../config.ts";
import { makePool, PgStore } from "../pg-store.ts";
import { runStoreContract } from "../store-contract.ts";

loadLocalEnv();
const settings = loadSettings(process.env, { requireDatabase: true });
const pool = makePool(settings.supabaseDbUrl!);
const checkOnly = process.argv.includes("--check-only");

try {
  const who = await pool.query("select current_database() as db, current_user as role");
  console.log("connected to database", who.rows[0].db, "as", who.rows[0].role);

  if (!checkOnly) {
    const dir = join(import.meta.dirname, "../../db");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    await pool.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
    for (const f of files) {
      const done = await pool.query("select 1 from schema_migrations where name = $1", [f]);
      if (done.rows.length) {
        console.log("already applied:", f);
        continue;
      }
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(readFileSync(join(dir, f), "utf8"));
        await client.query("insert into schema_migrations (name) values ($1)", [f]);
        await client.query("commit");
        console.log("applied:", f);
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        client.release();
      }
    }
  }

  // Behaviour check in a transaction that is always rolled back.
  const client = await pool.connect();
  try {
    await client.query("begin");
    const failures = await runStoreContract(new PgStore(client));
    console.log(failures.length ? `store check FAILED: ${failures.join("; ")}` : "store check passed (rolled back, nothing kept)");
    if (failures.length) process.exitCode = 1;
  } finally {
    await client.query("rollback");
    client.release();
  }

  const tables = await pool.query("select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1");
  console.log("tables:", tables.rows.map((r) => `${r.relname}${r.relrowsecurity ? " (rls on)" : " (RLS OFF)"}`).join(", "));
} catch (e) {
  console.error("database step failed:", (e as Error).message.replace(/postgres(ql)?:\/\/\S+/g, "[address hidden]"));
  process.exitCode = 1;
} finally {
  await pool.end();
}
