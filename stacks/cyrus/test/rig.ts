// A worker wired to fakes with a movable clock, shared by the day and limits-flow tests.
import { Worker, type StreamLike } from "../src/worker.ts";
import { Governor } from "../src/governor.ts";
import { MemoryStore, type Store } from "../src/store.ts";
import type { Trade } from "../src/stream.ts";
import type { FullBroker } from "../src/broker.ts";
import { FakeBroker, FakeBot, settings } from "./helpers.ts";

export const D = "2026-11-02";
// "HH:MM:SS" means that time (UTC) on D; a full ISO string is taken as it is.
export const z = (t: string) => new Date(t.includes("T") ? t : `${D}T${t}Z`);
export const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

export function rig<B extends FullBroker = FakeBroker, S extends Store = MemoryStore>(opts: { store?: S; bot?: FakeBot; broker?: B; sleep?: (ms: number) => Promise<void>; governor?: Governor; liveList?: string[] } = {}) {
  const store = (opts.store ?? new MemoryStore()) as S;
  const broker = (opts.broker ?? new FakeBroker()) as B;
  const bot = opts.bot ?? new FakeBot();
  let now = z("12:00:00");
  const governor = opts.governor ?? new Governor(() => now.getTime());
  const pings: string[] = [];
  let onTrade: (t: Trade) => void = () => undefined;
  let streamStarts = 0;
  let streamStops = 0;
  let screens = 0;
  const worker = new Worker({
    settings, broker, store, bot, governor,
    now: () => now,
    ping: async (k) => (pings.push(k), true),
    buildLiveList: async () => (screens++, opts.liveList ? { symbols: opts.liveList, names: {} as Record<string, string> } : { symbols: ["AAA", "BBB"], names: { AAA: "Alpha Corp", BBB: "Beta" } as Record<string, string> }),
    makeStream: (_symbols, cb): StreamLike => {
      onTrade = cb;
      return { start: () => void streamStarts++, stop: () => void streamStops++, status: () => "live" };
    },
    sleep: opts.sleep ?? (async () => undefined),
  });
  return {
    store, broker, bot, worker, pings, governor,
    at: async (t: string) => { now = z(t); await worker.tick(); await settle(); },
    trade: async (symbol: string, price: number, t: string) => { now = z(t); onTrade({ symbol, price, size: 100, time: z(t).toISOString() }); await settle(); },
    // Feeds a run of trades for one symbol, one per second from a start time: enough for the busy placeholder to signal.
    ramp: async (symbol: string, prices: number[], startT: string) => { for (let i = 0; i < prices.length; i++) { now = new Date(z(startT).getTime() + i * 1000); onTrade({ symbol, price: prices[i]!, size: 100, time: now.toISOString() }); await settle(); } },
    counts: () => ({ streamStarts, streamStops, screens }),
    said: (ch: string) => bot.posts.filter((p) => p.channel === ch).map((p) => p.text),
    ownerSays: (text: string, t: string) => bot.say(text, z(t)),
  };
}

