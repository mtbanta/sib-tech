# Stack C (cyrus)

Paper trading only. Option C from run 3: one always-on worker on Fly.io, a Supabase project for memory and the run log, Alpaca paper as the broker, Discord for alerts, messages and commands, Healthchecks.io for the heartbeat.

Everything this stack produces is research input for a human decision, never an instruction to act.

## Folders

- `src/` the worker's code (TypeScript, run directly by Node 24)
- `test/` automated tests
- `db/` database schema files, written here first and then applied
- `.env.local` the keys. Git-ignored, stays on the owner's Mac, never committed or pasted into chat

The record of the build is `builds/build-c-log.md`. The rules are in the root `CLAUDE.md`, section "Build override".
