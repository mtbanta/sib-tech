// Healthchecks.io heartbeat. The worker pings every minute. If pings stop, Healthchecks alerts on Discord.
export type PingKind = "ok" | "start" | "fail";

export async function ping(
  pingUrl: string,
  kind: PingKind = "ok",
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const base = pingUrl.replace(/\/+$/, "");
  const url = kind === "ok" ? base : `${base}/${kind}`;
  try {
    const res = await fetchImpl(url, { method: "GET", signal: AbortSignal.timeout(10_000) });
    return res.ok;
  } catch {
    return false;
  }
}
