// SELF-MONITORING (Michael's approval of 2026-11-11). Once a minute during the session the worker writes one `self_monitor` row to the
// run log: its own CPU use, what the machine's CPU was taken away by (Fly's throttling shows inside the machine as "steal" time in
// /proc/stat), memory, the event loop's delay, and the order gate's time per entry decision with the day's stored orders. On
// 2026-11-11 Fly's CPU burst balance ran out at 10:22 and the machine was throttled 83 to 91 percent of the time until 10:30; these
// rows show such a slowdown from the worker's own records. Measurement only: nothing here changes what the worker does. It reads no
// Fly token (Michael: the metrics token stays on his Mac); the reviews read Fly's own balance from there.
import { readFileSync } from "node:fs";
import { monitorEventLoopDelay, type ELDHistogram } from "node:perf_hooks";

// The cpu line of /proc/stat, in clock ticks (hundredths of a second on Linux).
export interface ProcCpu {
  user: number;
  nice: number;
  system: number;
  idle: number;
  iowait: number;
  irq: number;
  softirq: number;
  steal: number;
}

export function parseProcStat(text: string): ProcCpu | null {
  const line = text.split("\n").find((l) => l.startsWith("cpu "));
  if (!line) return null;
  const n = line.trim().split(/\s+/).slice(1).map(Number);
  if (n.length < 8 || n.slice(0, 8).some((x) => !Number.isFinite(x))) return null;
  const [user, nice, system, idle, iowait, irq, softirq, steal] = n as [number, number, number, number, number, number, number, number];
  return { user, nice, system, idle, iowait, irq, softirq, steal };
}

export function parseMemAvailable(text: string): number | null {
  const m = text.match(/^MemAvailable:\s+(\d+)\s+kB/m);
  return m ? Number(m[1]) * 1024 : null;
}

// The event-loop histogram's sampling interval (ms).
export const EVENT_LOOP_RESOLUTION_MS = 20;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
const q = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]! : null);
const ms1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);

export interface SelfMonitorDeps {
  // Readers for /proc (absent or failing off Linux: those fields are null).
  readProcStat?: () => string;
  readMemInfo?: () => string;
  cpuUsage?: () => NodeJS.CpuUsage;
  memoryUsage?: () => NodeJS.MemoryUsage;
  // An event-loop delay histogram (nanoseconds). Null: not measured.
  histogram?: Pick<ELDHistogram, "percentile" | "max" | "mean" | "reset" | "count"> | null;
  // The histogram's sampling interval (ms). Node records the whole gap between its timer's firings, interval included, so it is
  // taken off each figure (group 2 review, round 1: an idle loop read about 22 ms at a 20 ms resolution).
  histogramResolutionMs?: number;
  nowMs?: () => number;
}

export interface SelfMonitorRow {
  windowMs: number;
  // The worker process's own CPU, percent of one CPU over the window.
  processCpuPct: number | null;
  // The whole machine, from /proc/stat: busy (not idle, not steal), steal (Fly's throttling and the host's own use), percent.
  machineBusyPct: number | null;
  stealPct: number | null;
  rssMb: number;
  heapUsedMb: number;
  memAvailableMb: number | null;
  eventLoopDelayMs: { p50: number | null; p99: number | null; max: number | null; mean: number | null } | null;
  // The order gate: each decision's time from its start to its answer (queue wait not included), and its queue wait.
  // `dropped`: decisions not timed because the gate's list was full (only if no sample was taken for a long time).
  decisions: { n: number; medianMs: number | null; p90Ms: number | null; maxMs: number | null; queueMedianMs: number | null; queueMaxMs: number | null; storedOrders: number | null; dropped: number };
}

export class SelfMonitor {
  private readonly d: Required<Omit<SelfMonitorDeps, "histogram">> & { histogram: SelfMonitorDeps["histogram"] };
  private lastMs: number;
  private lastCpu: NodeJS.CpuUsage;
  private lastProc: ProcCpu | null;

  constructor(deps: SelfMonitorDeps = {}) {
    this.d = {
      readProcStat: deps.readProcStat ?? (() => readFileSync("/proc/stat", "utf8")),
      readMemInfo: deps.readMemInfo ?? (() => readFileSync("/proc/meminfo", "utf8")),
      cpuUsage: deps.cpuUsage ?? (() => process.cpuUsage()),
      memoryUsage: deps.memoryUsage ?? (() => process.memoryUsage()),
      nowMs: deps.nowMs ?? (() => performance.now()),
      histogram: deps.histogram === undefined ? SelfMonitor.liveHistogram() : deps.histogram,
      histogramResolutionMs: deps.histogramResolutionMs ?? EVENT_LOOP_RESOLUTION_MS,
    };
    this.lastMs = this.d.nowMs();
    this.lastCpu = this.d.cpuUsage();
    this.lastProc = this.proc();
  }

  // The live event-loop histogram (20 ms resolution). Its timer does not keep the process alive.
  static liveHistogram(): ELDHistogram | null {
    try {
      const h = monitorEventLoopDelay({ resolution: EVENT_LOOP_RESOLUTION_MS });
      h.enable();
      return h;
    } catch {
      return null;
    }
  }

  private proc(): ProcCpu | null {
    try {
      return parseProcStat(this.d.readProcStat());
    } catch {
      return null;
    }
  }

  // One row for the time since the last call, then starts the next window.
  sample(gate: { times: Array<{ runMs: number; queueMs: number }>; storedOrders: number | null; dropped?: number }): SelfMonitorRow {
    const now = this.d.nowMs();
    const windowMs = Math.max(1, now - this.lastMs);
    const cpu = this.d.cpuUsage();
    const processCpuPct = pct((cpu.user - this.lastCpu.user + cpu.system - this.lastCpu.system) / 1000, windowMs);
    const proc = this.proc();
    let machineBusyPct: number | null = null;
    let stealPct: number | null = null;
    if (proc && this.lastProc) {
      const dv = (k: keyof ProcCpu) => proc[k] - this.lastProc![k];
      const total = dv("user") + dv("nice") + dv("system") + dv("idle") + dv("iowait") + dv("irq") + dv("softirq") + dv("steal");
      machineBusyPct = pct(dv("user") + dv("nice") + dv("system") + dv("irq") + dv("softirq"), total);
      stealPct = pct(dv("steal"), total);
    }
    let memAvailable: number | null = null;
    try {
      memAvailable = parseMemAvailable(this.d.readMemInfo());
    } catch {
      memAvailable = null;
    }
    const mem = this.d.memoryUsage();
    const h = this.d.histogram;
    const delay = (ns: number) => ms1(Math.max(0, ns / 1e6 - this.d.histogramResolutionMs));
    const loop = h && h.count > 0 ? { p50: delay(h.percentile(50)), p99: delay(h.percentile(99)), max: delay(h.max), mean: delay(h.mean) } : h ? { p50: null, p99: null, max: null, mean: null } : null;
    h?.reset();
    const runs = gate.times.map((t) => t.runMs).sort((a, b) => a - b);
    const waits = gate.times.map((t) => t.queueMs).sort((a, b) => a - b);
    const row: SelfMonitorRow = {
      windowMs: Math.round(windowMs),
      processCpuPct,
      machineBusyPct,
      stealPct,
      rssMb: Math.round(mem.rss / 1e5) / 10,
      heapUsedMb: Math.round(mem.heapUsed / 1e5) / 10,
      memAvailableMb: memAvailable === null ? null : Math.round(memAvailable / 1e5) / 10,
      eventLoopDelayMs: loop,
      decisions: { n: runs.length, medianMs: ms1(q(runs, 0.5)), p90Ms: ms1(q(runs, 0.9)), maxMs: ms1(runs.length ? runs[runs.length - 1]! : null), queueMedianMs: ms1(q(waits, 0.5)), queueMaxMs: ms1(waits.length ? waits[waits.length - 1]! : null), storedOrders: gate.storedOrders, dropped: gate.dropped ?? 0 },
    };
    this.lastMs = now;
    this.lastCpu = cpu;
    this.lastProc = proc;
    return row;
  }
}
