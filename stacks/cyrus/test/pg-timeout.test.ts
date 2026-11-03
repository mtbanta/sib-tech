// Review round 5, finding 1: one Postgres query that never gets an answer must not freeze the worker. The server's own
// statement limit does nothing when the network path goes silent, so the client must give up by itself, and the pool must
// not hand the stuck connection out again. This runs the real pg library against a tiny fake Postgres server on this
// machine that accepts the query and then never answers it.
import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import pg from "pg";
import { poolConfig, QUERY_TIMEOUT_MS } from "../src/pg-store.ts";

const msg = (type: string, body: Buffer) => {
  const head = Buffer.alloc(5);
  head.write(type, 0, "latin1");
  head.writeInt32BE(body.length + 4, 1);
  return Buffer.concat([head, body]);
};
const authOk = () => msg("R", Buffer.from([0, 0, 0, 0]));
const ready = () => msg("Z", Buffer.from("I", "latin1"));
const done = () => msg("C", Buffer.from("SELECT 0\0", "latin1"));

// Connection 1 answers the start-up and then goes silent for good. Every later connection answers queries.
function fakePostgres(): Promise<{ port: number; connections: () => number; close: () => void }> {
  let n = 0;
  const sockets: net.Socket[] = [];
  const server = net.createServer((sock) => {
    const id = ++n;
    sockets.push(sock);
    let started = false;
    sock.on("data", (buf) => {
      if (!started) {
        started = true;
        sock.write(Buffer.concat([authOk(), ready()]));
        return;
      }
      if (id === 1) return; // the silent connection: the query is received and never answered
      if (buf[0] === "Q".charCodeAt(0)) sock.write(Buffer.concat([done(), ready()]));
    });
    sock.on("error", () => undefined);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as net.AddressInfo).port;
      resolve({ port, connections: () => n, close: () => { for (const s of sockets) s.destroy(); server.close(); } });
    });
  });
}

test("the pool has a client-side query time limit and TCP keep-alive", () => {
  const cfg = poolConfig("postgresql://u@db.example.invalid:5432/postgres");
  assert.ok(typeof cfg.query_timeout === "number" && cfg.query_timeout > 0 && cfg.query_timeout <= 30_000, "a query with no answer gives up within 30 seconds");
  assert.equal(cfg.keepAlive, true);
  assert.ok(cfg.connectionTimeoutMillis && cfg.connectionTimeoutMillis <= 15_000);
});

test("a query the server never answers fails within the time limit, and the next query gets a fresh connection", { timeout: QUERY_TIMEOUT_MS + 20_000 }, async () => {
  const fake = await fakePostgres();
  // Only TLS is switched off (the fake server does not speak it); every time limit is the worker's own.
  const pool = new pg.Pool({ ...poolConfig(`postgresql://u@127.0.0.1:${fake.port}/postgres`), ssl: false });
  pool.on("error", () => undefined);
  try {
    const t0 = Date.now();
    const outcome = await Promise.race([
      pool.query("select 1").then(() => "answered", (e: Error) => `failed: ${e.message}`),
      new Promise<string>((r) => setTimeout(() => r("still waiting"), QUERY_TIMEOUT_MS + 8_000)),
    ]);
    const took = Date.now() - t0;
    assert.match(outcome, /^failed: Query read timeout/, `the stuck query must fail by itself (got: ${outcome})`);
    assert.ok(took >= QUERY_TIMEOUT_MS - 500 && took < QUERY_TIMEOUT_MS + 5_000, `failed after ${took} ms`);
    const r = await pool.query("select 1");
    assert.equal(r.rowCount, 0);
    assert.equal(fake.connections(), 2, "the stuck connection was thrown away, not handed out again");
  } finally {
    fake.close(); // first, so a connection still stuck (without the fix) ends and the pool can shut down
    await pool.end().catch(() => undefined);
  }
});
