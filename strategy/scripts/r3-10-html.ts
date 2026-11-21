// Run 3 step 10: build runs/strategy-run-3-deliverable.html (a copy of run 1's page design, extended), a single file that
// opens with a double-click. Data comes from runs/strategy-run-3-data/summary.json (embedded). The overview's findings and the
// sources tab are taken from the markdown deliverable itself, so the page holds no claim the markdown lacks.
// No network calls; no external libraries (charts are plain SVG).
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { RUN } from "./common.ts";
import { OUT3 as OUT } from "./r3-common.ts";

const summary = JSON.parse(readFileSync(join(OUT, "summary.json"), "utf8"));
const mdText = readFileSync(join(RUN, "strategy-run-3-deliverable.md"), "utf8");

// --- tiny markdown to HTML (bullets, tables, bold, code, links, headings, paragraphs) ---
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) => esc(s)
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/(^|[\s(])(https?:\/\/[^\s)<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
  .replace(/\[\^(\d+)\]/g, '<sup class="fn">[$1]</sup>');
function mdToHtml(src: string): string {
  const out: string[] = []; const lines = src.split(/\r?\n/); let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\|/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i].replace(/^\||\|$/g, "").split("|").map(c => c.trim())); i++; }
      const [h, , ...body] = rows;
      out.push('<div class="tablewrap"><table><thead><tr>' + h.map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" + body.map(r => "<tr>" + r.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table></div>");
      continue;
    }
    if (/^\s*[-*] /.test(l)) {
      const items: string[] = [];
      while (i < lines.length && (/^\s*[-*] /.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        if (/^\s*[-*] /.test(lines[i])) items.push(lines[i].replace(/^\s*[-*] /, "")); else items[items.length - 1] += " " + lines[i].trim();
        i++;
      }
      out.push("<ul>" + items.map(t => `<li>${inline(t)}</li>`).join("") + "</ul>"); continue;
    }
    const hm = l.match(/^(#{2,4}) (.*)/); if (hm) { const n = hm[1].length + 1; out.push(`<h${n}>${inline(hm[2])}</h${n}>`); i++; continue; }
    if (l.trim()) { out.push(`<p>${inline(l)}</p>`); }
    i++;
  }
  return out.join("\n");
}
function section(num: number): string {
  const re = new RegExp(`^## ${num}\\. .*$`, "m"); const m = mdText.match(re); if (!m) return "";
  const start = m.index! + m[0].length; const rest = mdText.slice(start);
  const next = rest.search(/^## \d+\. /m);
  return next < 0 ? rest : rest.slice(0, next);
}
const findingsHtml = mdToHtml(section(1));
const sourcesHtml = mdToHtml(section(9));
const coverageHtml = mdToHtml(section(4));
const changesHtml = mdToHtml(section(2));
const methodHtml = mdToHtml(section(3));
const termsHtml = (() => { const a = mdText.indexOf("**Terms used.**"), b = mdText.indexOf("## 1. "); return a >= 0 && b > a ? mdToHtml(mdText.slice(a + "**Terms used.**".length, b)) : ""; })();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bull Market Winners Revised</title>
<style>
:root { color-scheme: light;
  --surface: #fcfcfb; --surface-2: #f3f2ef; --border: #dddcd7; --text: #0b0b0b; --text-2: #52514e; --muted: #7a7974;
  --s0: #8a6fd1; --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --bench1: #52514e; --bench2: #a3a29c; --grid: #e7e6e2; --mark: #6250d6; }
@media (prefers-color-scheme: dark) { :root { color-scheme: dark;
  --surface: #1a1a19; --surface-2: #242423; --border: #3a3a38; --text: #f0efec; --text-2: #c3c2b7; --muted: #9a998f;
  --s0: #a08ae6; --s1: #3987e5; --s2: #d95926; --s3: #199e70; --bench1: #c3c2b7; --bench2: #7a7974; --grid: #2e2e2c; --mark: #9085e9; } }
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--surface); color: var(--text); }
header { padding: 16px 20px 8px; border-bottom: 1px solid var(--border); }
h1 { font-size: 20px; margin: 0 0 4px; }
.notice { color: var(--text-2); font-size: 13px; margin: 0; }
nav { display: flex; gap: 4px; overflow-x: auto; padding: 8px 20px 0; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--surface); z-index: 5; }
nav button { font: inherit; padding: 8px 12px; border: 1px solid transparent; border-bottom: none; background: none; color: var(--text-2); cursor: pointer; border-radius: 6px 6px 0 0; white-space: nowrap; }
nav button[aria-selected="true"] { color: var(--text); border-color: var(--border); background: var(--surface-2); font-weight: 600; }
main { padding: 16px 20px 40px; max-width: 1280px; }
section[role="tabpanel"] { display: none; } section[role="tabpanel"].active { display: block; }
h2 { font-size: 18px; margin: 20px 0 8px; } h3 { font-size: 16px; margin: 18px 0 6px; } h4 { font-size: 15px; margin: 14px 0 4px; }
.tablewrap { overflow-x: auto; margin: 8px 0 12px; border: 1px solid var(--border); border-radius: 6px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { padding: 6px 8px; border-bottom: 1px solid var(--grid); text-align: left; vertical-align: top; }
th { background: var(--surface-2); position: sticky; top: 0; font-weight: 600; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
th.sortable { cursor: pointer; user-select: none; } th.sortable:hover { text-decoration: underline; }
th[aria-sort="ascending"]::after { content: " \\25B2"; } th[aria-sort="descending"]::after { content: " \\25BC"; }
.filters { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; padding: 10px 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; margin: 8px 0 12px; }
.filters label { font-size: 13px; color: var(--text-2); display: inline-flex; gap: 6px; align-items: center; }
.filters select, .filters input[type="search"] { font: inherit; font-size: 13px; padding: 4px 6px; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); color: var(--text); max-width: 220px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin: 8px 0 12px; }
.tile { border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; }
.tile .v { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; } .tile .k { font-size: 12px; color: var(--text-2); }
.charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 16px; }
.chart { border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; min-width: 0; }
.chart h4 { margin: 0 0 2px; } .chart .sub { font-size: 12px; color: var(--text-2); margin: 0 0 6px; }
.legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--text-2); margin: 4px 0; }
.legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; background: var(--c); vertical-align: -1px; }
svg { width: 100%; height: auto; display: block; overflow: visible; }
svg text { fill: var(--text-2); font-size: 11px; }
.badge { display: inline-block; font-size: 11px; padding: 0 5px; border-radius: 3px; border: 1px solid var(--border); margin: 1px 2px 1px 0; color: var(--text-2); white-space: nowrap; }
.badge.ns { border-color: var(--mark); color: var(--mark); font-weight: 600; }
tr.nonstd td:first-child { box-shadow: inset 3px 0 0 var(--mark); }
details { margin-top: 6px; font-size: 13px; } summary { cursor: pointer; color: var(--text-2); }
#tip { position: fixed; pointer-events: none; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 6px 8px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.15); display: none; z-index: 20; max-width: 260px; }
code { font-size: 12px; background: var(--surface-2); padding: 0 3px; border-radius: 3px; }
sup.fn { color: var(--muted); font-size: 10px; }
.statbar { margin-top: 6px; } .statbar label { margin-right: 8px; } .flagkey { color: var(--muted); font-size: 12px; } .flag { color: #c2410c; font-weight: 700; } .seg { display: inline-flex; flex-wrap: wrap; gap: 2px; } .filters label { flex-wrap: wrap; max-width: 100%; } .seg button { font: inherit; font-size: 13px; padding: 3px 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: 4px; cursor: pointer; } .seg button[aria-pressed="true"] { background: var(--text); color: var(--surface); }
@media (max-width: 640px) { main { padding: 12px; } .charts { grid-template-columns: 1fr; } header, nav { padding-left: 12px; padding-right: 12px; } .tile .v { font-size: 18px; } }
</style>
</head>
<body>
<header>
<h1>Strategy run 3: bull market winners, revised, with 1 minute detail</h1>
<p class="notice">Research input for a human decision, never an instruction to act. Nothing here is financial advice. Winners are picked with hindsight, and removing the flagged companies (shell mergers, new shares after bankruptcy, missing earnings dates, delisted, acquired) brings survivorship bias back. The markdown deliverable (<code>strategy-run-3-deliverable.md</code>) is the source of record and wins any disagreement with this page.</p>
<p class="notice statbar">Show <label><input type="radio" name="stat" value="mean" checked> mean</label> <label><input type="radio" name="stat" value="median"> median</label> <span class="flagkey">⚑ = mean and median differ a lot (gap over 25 percent of the larger and over a floor per measure; deliverable section 3.4)</span></p>
</header>
<nav role="tablist" id="tabs"></nav>
<main id="panels"></main>
<div id="tip" role="tooltip"></div>
<script type="application/json" id="data">${JSON.stringify(summary).replace(/</g, "\\u003c")}</script>
<script type="text/html" id="findings">${findingsHtml.replace(/<\/script/gi, "<\\/script")}</script>
<script type="text/html" id="sources">${sourcesHtml.replace(/<\/script/gi, "<\\/script")}</script>
<script type="text/html" id="terms">${termsHtml.replace(/<\/script/gi, "<\\/script")}</script>
<script type="text/html" id="coverage">${coverageHtml.replace(/<\/script/gi, "<\\/script")}</script>
<script type="text/html" id="changes">${changesHtml.replace(/<\/script/gi, "<\\/script")}</script>
<script type="text/html" id="method">${methodHtml.replace(/<\/script/gi, "<\\/script")}</script>
<script>
const D = JSON.parse(document.getElementById("data").textContent);
const GROUPS = ["3x", "4x", "5x", "6x+"], GC = { "3x": "var(--s0)", "4x": "var(--s1)", "5x": "var(--s2)", "6x+": "var(--s3)", all: "var(--text)" };
const BANDS = ["below -10%", "-10 to -5", "-5 to -3", "-3 to -2", "-2 to -1", "-1 to -0.5", "-0.5 to 0", "0 to 0.5", "0.5 to 1", "1 to 2", "2 to 3", "3 to 5", "5 to 10", "10% and up"];
const FLAGS = [["any", "Any"], ["nonstd", "Non-standard start"], ["new listing", "New listing"], ["moved exchange", "Moved exchange"], ["starts late", "History starts late in data"], ["earnings date from first", "Earnings date from a 10-Q or 10-K"], ["ADR", "ADR"], ["partnership units", "Partnership units"], ["check:", "Check flag (overnight price jump)"]];
const pct = (x, d = 1) => x == null || !isFinite(x) ? "n/a" : (x * 100).toFixed(d) + "%";
const fmtCap = x => x == null ? "" : x >= 1e9 ? (x / 1e9).toFixed(2) + "B" : (x / 1e6).toFixed(0) + "M";
const median = a => { const b = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const isNonStd = w => w.f.some(f => /new listing|moved exchange|starts late/.test(f));
const tip = document.getElementById("tip");
function showTip(e, html) { tip.innerHTML = html; tip.style.display = "block"; const x = Math.min(e.clientX + 12, innerWidth - 270); tip.style.left = x + "px"; tip.style.top = (e.clientY + 12) + "px"; }
function hideTip() { tip.style.display = "none"; }
function bindTips(root) { root.querySelectorAll("[data-tip]").forEach(el => { el.addEventListener("mousemove", e => showTip(e, el.getAttribute("data-tip"))); el.addEventListener("mouseleave", hideTip); el.addEventListener("touchstart", e => showTip(e.touches[0], el.getAttribute("data-tip")), { passive: true }); }); }

// Grouped bar chart: cats = labels, series = [{name, color, values[]}], values are fractions or counts.
function barChart(cats, series, opts = {}) {
  const W = 560, H = opts.h || 240, L = 44, R = 8, T = 10, B = opts.rotate ? 70 : 34;
  // Round the axis top up to a tidy step (1, 2, 2.5 or 5 times a power of ten) so the four gridlines read evenly.
  const raw = Math.max(1e-9, ...series.flatMap(s => s.values.filter(v => v != null)));
  const nice = x => { const e = Math.pow(10, Math.floor(Math.log10(x))); for (const m of [1, 2, 2.5, 5, 10]) if (m * e >= x) return m * e; return 10 * e; };
  // signed: the axis also runs below zero (run 3 addition, for returns), symmetric around zero.
  const absMax = Math.max(1e-9, ...series.flatMap(s => s.values.filter(v => v != null).map(Math.abs)));
  const max = opts.max ?? (opts.signed ? nice(absMax / 2) * 2 : nice(raw / 4) * 4), min = opts.signed ? -max : 0;
  const cw = (W - L - R) / cats.length, bw = Math.max(3, Math.min(22, (cw - 6) / series.length - 2));
  const y = v => T + (H - T - B) * (1 - (v - min) / (max - min)), y0 = y(0);
  let g = "";
  for (let k = 0; k <= 4; k++) { const v = min + (max - min) * k / 4, yy = y(v); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--grid)"/><text x="' + (L - 4) + '" y="' + (yy + 4) + '" text-anchor="end">' + (opts.fmt ? opts.fmt(v) : v.toFixed(0)) + "</text>"; }
  cats.forEach((c, i) => {
    const x0 = L + i * cw + (cw - series.length * (bw + 2)) / 2;
    series.forEach((s, j) => { const v = s.values[i]; if (v == null) return; const x = x0 + j * (bw + 2), yy = y(v), h = Math.max(0, H - B - yy);
      if (opts.signed) { g += '<rect x="' + (x - 3) + '" y="' + T + '" width="' + (bw + 6) + '" height="' + (H - B - T) + '" fill="transparent" data-tip="' + esc("<b>" + s.name + "</b><br>" + c + ": " + opts.fmt(v)) + '"/><rect x="' + x + '" y="' + Math.min(yy, y0) + '" width="' + bw + '" height="' + Math.abs(yy - y0) + '" fill="' + s.color + '" pointer-events="none"/>'; return; }
      g += '<rect x="' + (x - 3) + '" y="' + T + '" width="' + (bw + 6) + '" height="' + (H - B - T) + '" fill="transparent" data-tip="' + esc("<b>" + s.name + "</b><br>" + c + ": " + (opts.fmt ? opts.fmt(v) : v)) + '"/>';
      g += '<path d="M' + x + "," + (H - B) + "V" + (yy + Math.min(4, h)) + "q0,-" + Math.min(4, h) + " " + Math.min(4, h) + ",-" + Math.min(4, h) + "H" + (x + bw - Math.min(4, h)) + "q" + Math.min(4, h) + ",0 " + Math.min(4, h) + "," + Math.min(4, h) + "V" + (H - B) + 'Z" fill="' + s.color + '" pointer-events="none"/>'; });
    const lx = L + i * cw + cw / 2;
    g += opts.rotate ? '<text transform="translate(' + lx + "," + (H - B + 10) + ') rotate(-40)" text-anchor="end">' + esc(c) + "</text>" : '<text x="' + lx + '" y="' + (H - B + 16) + '" text-anchor="middle">' + esc(c) + "</text>";
  });
  g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y0 + '" y2="' + y0 + '" stroke="var(--muted)"/>';
  const legend = series.length > 1 ? '<div class="legend">' + series.map(s => '<span style="--c:' + s.color + '">' + esc(s.name) + "</span>").join("") + "</div>" : "";
  const table = "<details><summary>Show as table</summary><div class=\\"tablewrap\\"><table><thead><tr><th></th>" + series.map(s => "<th class=num>" + esc(s.name) + "</th>").join("") + "</tr></thead><tbody>" + cats.map((c, i) => "<tr><td>" + esc(c) + "</td>" + series.map(s => "<td class=num>" + (s.values[i] == null ? "" : opts.fmt ? opts.fmt(s.values[i]) : s.values[i]) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div></details>";
  return legend + '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(opts.label || "bar chart") + '">' + g + "</svg>" + table;
}
// Dot strip: one row per group, x = value (clamped), one dot per winner.
function dotStrip(rows, opts) {
  const W = 560, rowH = 40, L = 44, R = 12, T = 8, B = 30, H = T + rows.length * rowH + B;
  const [lo, hi] = opts.domain, x = v => L + (W - L - R) * (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo);
  let g = "";
  for (const t of opts.ticks) g += '<line x1="' + x(t) + '" x2="' + x(t) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--grid)"/><text x="' + x(t) + '" y="' + (H - B + 16) + '" text-anchor="middle">' + opts.fmt(t) + "</text>";
  rows.forEach((r, i) => { const cy = T + i * rowH + rowH / 2; g += '<text x="' + (L - 6) + '" y="' + (cy + 4) + '" text-anchor="end">' + esc(r.name) + "</text>";
    r.points.forEach((p, k) => { const jitter = ((k * 37) % 17 - 8) * 1.4; g += '<circle cx="' + x(p.v) + '" cy="' + (cy + jitter) + '" r="4.5" fill="' + r.color + '" stroke="var(--surface)" stroke-width="2" data-tip="' + esc(p.tip) + '"/>'; }); });
  const table = "<details><summary>Show as table</summary><div class=\\"tablewrap\\"><table><thead><tr><th>Group</th><th class=num>Winners</th><th class=num>Median</th></tr></thead><tbody>" + rows.map(r => "<tr><td>" + esc(r.name) + "</td><td class=num>" + r.points.length + "</td><td class=num>" + opts.fmt(median(r.points.map(p => p.v))) + "</td></tr>").join("") + "</tbody></table></div></details>";
  return '<div class="legend">' + rows.map(r => '<span style="--c:' + r.color + '">' + esc(r.name) + "</span>").join("") + '</div><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(opts.label) + '">' + g + "</svg>" + table;
}

const STAT = () => document.querySelector('input[name="stat"]:checked').value;
const mean = a => { const b = a.filter(x => x != null && isFinite(x)); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : null; };
const FLOORS = D.floors;
const bigDiff = (a, b, kind) => a != null && b != null && Math.abs(a - b) > 0.25 * Math.max(Math.abs(a), Math.abs(b)) && Math.abs(a - b) > FLOORS[kind];
const MEAS = [["ratio", "Multiple", "multiple"], ["share_up_oc", "Share of days up (close above open)", "share"], ["share_up_cc", "Share of days up (close above prior close)", "share"], ["share_overnight", "Overnight share of gain", "gainshare"], ["share_intraday", "Intraday share of gain", "gainshare"], ["avg_up_oc", "Average up-day gain (close above open)", "ret"], ["avg_down_oc", "Average down-day loss (close below open)", "ret"], ["avg_up_cc", "Average up-day gain (close above prior close)", "ret"], ["avg_down_cc", "Average down-day loss (close below prior close)", "ret"], ["mean_oc", "Mean daily open to close", "ret"], ["mean_gap", "Mean overnight gap", "ret"], ["mean_abs_oc", "Mean daily move, open to close (either way)", "ret"], ["mean_rise", "Mean rise from open (high minus open)", "ret"], ["mean_drop", "Mean drop from open (open minus low)", "ret"], ["beta", "Beta against SPY", "beta"], ["vol_daily", "Volatility, daily", "vol"], ["vol_annual", "Volatility, annualized", "vola"]];
const fmtK = (kind, v) => v == null ? "n/a" : kind === "multiple" || kind === "beta" ? v.toFixed(2) : kind === "ret" ? pct(v, 2) : kind === "gainshare" ? pct(v, 0) : pct(v, 1);
// One summary value of a measure over a set of winners, by the current switch, with the flag.
function stat(W, k, kind) { const v = W.map(w => w["_" + k]); const a = mean(v), b = median(v); const s = STAT() === "mean" ? a : b; return { v: s, txt: fmtK(kind, s), flag: bigDiff(a, b, kind), a, b }; }
const flagSpan = s => s.flag ? ' <span class="flag" data-tip="' + esc("Mean and median differ a lot: mean " + s.am + ", median " + s.bm) + '">⚑</span>' : "";
function statCell(W, k, kind) { const s = stat(W, k, kind); s.am = fmtK(kind, s.a); s.bm = fmtK(kind, s.b); return s.txt + flagSpan(s); }
const ctLabel = m => Math.floor((m - 60) / 60) + ":" + String((m - 60) % 60).padStart(2, "0");
const SL = D.slice_minutes, NS = 78, OPEN = 570;

// Line chart over the 78 five-minute slices. series = [{name, color, values[78], dash}], marks = [{m (Eastern minutes), label, color}]
function lineChart(series, opts) {
  const W = 620, H = opts.h || 260, L = 50, R = 10, T = 12, B = 34;
  const all = series.flatMap(s => s.values).filter(v => v != null && isFinite(v));
  let lo = opts.min ?? Math.min(0, ...all), hi = opts.max ?? Math.max(...all); if (hi === lo) hi = lo + 1;
  const x = i => L + (W - L - R) * (i + 0.5) / NS, y = v => T + (H - T - B) * (1 - (Math.min(hi, v) - lo) / (hi - lo));
  let g = "";
  for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4; g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--grid)"/><text x="' + (L - 4) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + opts.fmt(v) + "</text>"; }
  if (lo < 0 && hi > 0) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="var(--muted)"/>';
  for (let i = 0; i <= NS; i += 6) { const xx = L + (W - L - R) * i / NS; g += '<line x1="' + xx + '" x2="' + xx + '" y1="' + (H - B) + '" y2="' + (H - B + 4) + '" stroke="var(--muted)"/>' + (i % 12 === 0 ? '<text x="' + xx + '" y="' + (H - B + 16) + '" text-anchor="middle">' + ctLabel(OPEN + i * SL) + "</text>" : ""); }
  for (const m of opts.marks || []) { if (m.m == null) continue; const xx = L + (W - L - R) * (m.m - OPEN) / (NS * SL); g += '<line x1="' + xx + '" x2="' + xx + '" y1="' + T + '" y2="' + (H - B) + '" stroke="' + m.color + '" stroke-dasharray="4 3"/><text' + (m.m - OPEN > NS * SL / 2 ? ' text-anchor="end" x="' + (xx - 3) : ' x="' + (xx + 3)) + '" y="' + (T + 10 + (m.row || 0) * 12) + '" style="fill:' + m.color + '">' + esc(m.label) + "</text>"; }
  for (const s of series) { let d = ""; s.values.forEach((v, i) => { if (v == null) return; d += (d ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1); }); g += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2"' + (s.dash ? ' stroke-dasharray="5 3"' : "") + "/>"; }
  for (let i = 0; i < NS; i++) g += '<rect x="' + (x(i) - (W - L - R) / NS / 2) + '" y="' + T + '" width="' + ((W - L - R) / NS) + '" height="' + (H - T - B) + '" fill="transparent" data-tip="' + esc("<b>" + ctLabel(OPEN + i * SL) + " to " + ctLabel(OPEN + (i + 1) * SL) + " CT</b><br>" + series.map(s => s.name + ": " + (s.values[i] == null ? "n/a" : opts.fmt(s.values[i]))).join("<br>")) + '"/>';
  for (const s of series) s.values.forEach((v, i) => { if (v != null && v > hi && !s.dash) g += '<text x="' + (x(i) - 4) + '" y="' + (T + 10 + (s.clipRow || 0) * 12) + '" text-anchor="end" style="fill:' + s.color + '">' + esc(s.name) + " " + opts.fmt(v) + " (cut off)</text>"; });
  const legend = '<div class="legend">' + series.map(s => '<span style="--c:' + s.color + '">' + esc(s.name) + "</span>").join("") + "</div>";
  const table = '<details><summary>Show as table</summary><div class="tablewrap"><table><thead><tr><th>Slice (CT)</th>' + series.map(s => "<th class=num>" + esc(s.name) + "</th>").join("") + "</tr></thead><tbody>" + [...Array(NS).keys()].map(i => "<tr><td>" + ctLabel(OPEN + i * SL) + "</td>" + series.map(s => "<td class=num>" + (s.values[i] == null ? "" : opts.fmt(s.values[i])) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div></details>";
  return legend + '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(opts.label) + '">' + g + "</svg>" + table;
}
const parseCT = s => { if (!s) return null; const [h, m] = s.split(":").map(Number); return (h + 1) * 60 + m; }; // Central label to Eastern minutes

const PIDS = Object.keys(D.periods).sort();
const tabs = [["overview", "Overview"], ...PIDS.map(p => [p, p === "A" ? "A (2016 to 2020 stand-in)" : "Period " + p]), ["tod", "Time of day"], ["sources", "Sources"]];
const nav = document.getElementById("tabs"), panels = document.getElementById("panels");
tabs.forEach(([id, label], i) => {
  const b = document.createElement("button"); b.textContent = label; b.setAttribute("role", "tab"); b.id = "tab-" + id; b.setAttribute("aria-controls", "panel-" + id); b.setAttribute("aria-selected", i === 0 ? "true" : "false");
  b.onclick = () => { nav.querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", "false")); b.setAttribute("aria-selected", "true"); panels.querySelectorAll("section").forEach(s => s.classList.toggle("active", s.id === "panel-" + id)); b.scrollIntoView({ block: "nearest", inline: "nearest" }); if (location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id); };
  nav.appendChild(b);
  const s = document.createElement("section"); s.id = "panel-" + id; s.setAttribute("role", "tabpanel"); s.setAttribute("aria-labelledby", b.id); if (i === 0) s.classList.add("active"); panels.appendChild(s);
});
const renders = [];

// ---- overview
{
  let h = "<h2>Winners by period and gain group</h2><p class=notice>Nasdaq and NYSE company stocks that ended at 3 times their starting price or more, after removing every company flagged shell merger, new shares after bankruptcy, missing earnings date, delisted or acquired. Period A is a stand-in window (January 2016 to January 2020); its counts are not comparable with B, C and D.</p>";
  h += '<div class="tablewrap"><table><thead><tr><th>Period</th><th>Window</th>' + GROUPS.map(g => "<th class=num>" + g + "</th>").join("") + "<th class=num>Total</th><th class=num>Removed (change 1)</th></tr></thead><tbody>";
  for (const p of PIDS) { const c = D.periods[p].counts; h += "<tr><td>" + p + "</td><td>" + esc(D.periods[p].first + " to " + D.periods[p].last) + "</td>" + GROUPS.map(g => "<td class=num>" + c[g] + "</td>").join("") + "<td class=num>" + GROUPS.reduce((x, g) => x + c[g], 0) + "</td><td class=num>" + D.periods[p].removed_total + "</td></tr>"; }
  h += "</tbody></table></div>";
  h += '<div class="chart" style="max-width:680px"><h4>Winners per period, by gain group</h4>' + barChart(PIDS.map(p => p === "A" ? "A (stand-in)" : p), GROUPS.map(g => ({ name: g, color: GC[g], values: PIDS.map(p => D.periods[p].counts[g]) })), { label: "winners per period by gain group" }) + "</div>";
  h += "<details><summary>Terms used (from the deliverable)</summary>" + document.getElementById("terms").textContent + "</details>";
  h += "<h2>Findings (from the deliverable, section 1)</h2>" + document.getElementById("findings").textContent;
  h += "<h2>The nine changes (from the deliverable, section 2)</h2>" + document.getElementById("changes").textContent;
  h += "<details><summary>Definitions and method (from the deliverable, section 3)</summary>" + document.getElementById("method").textContent + "</details>";
  h += "<details><summary>Data sources and coverage (from the deliverable, section 4)</summary>" + document.getElementById("coverage").textContent + "</details>";
  document.getElementById("panel-overview").innerHTML = h; bindTips(document.getElementById("panel-overview"));
}
document.getElementById("panel-sources").innerHTML = "<h2>Sources (from the deliverable, section 9)</h2>" + document.getElementById("sources").textContent;

// ---- period tabs
for (const p of PIDS) {
  const P = D.periods[p], root = document.getElementById("panel-" + p);
  const inds = [...new Set(P.winners.map(w => w.i || "(missing)"))].sort();
  const bandSel = (f, l) => '<label>' + l + ' <select data-f="' + f + '"><option value="">All</option>' + D.bands.map(b => "<option>" + b + "</option>").join("") + "</select></label>";
  root.innerHTML = "<h2>" + (p === "A" ? "Stand-in for period A: " : "Period " + p + ": ") + esc(P.label) + "</h2><p class=notice>Measured trading days " + P.first + " to " + P.last + ". Rows with a purple bar started late (new listing, moved exchange, or history starting late in the data). Full lists: <code>strategy-run-3-data/period-" + p + "-winners.csv</code> and <code>period-" + p + "-daily.csv" + (D.compressed_files?.includes("period-" + p + "-daily.csv.gz") ? ".gz" : "") + "</code>; removed companies in <code>removed.csv</code>.</p>" +
    '<div class="filters" role="group" aria-label="filters">' + GROUPS.map(g => '<label><input type="checkbox" data-g="' + g + '" checked> ' + g + "</label>").join("") +
    '<label>Industry <select data-f="ind"><option value="">All</option>' + inds.map(i => '<option value="' + esc(i) + '">' + esc(i) + "</option>").join("") + "</select></label>" +
    '<label>Flag <select data-f="flag">' + FLAGS.map(([v, l]) => '<option value="' + v + '">' + l + "</option>").join("") + "</select></label>" +
    bandSel("bs", "Market cap at start") + bandSel("be", "Market cap at end") +
    '<label>Ticker or name <input type="search" data-f="q" placeholder="e.g. NVDA"></label></div>' +
    '<div class="tiles" data-out="tiles"></div><h3>Daily measures by group</h3><div class="tablewrap" data-out="gtable"></div><div class="charts" data-out="charts"></div><h3>Winners</h3><div class="tablewrap" data-out="table"></div>';
  const st = { sort: "m", dir: -1 };
  const cols = [["t", "Ticker"], ["n", "Company"], ["g", "Group"], ["m", "Multiple", 1], ["s", "Start"], ["e", "End"], ["x", "Exchange"], ["i", "Industry"], ["_share_up_oc", "Up days, close above open", 1], ["_share_overnight", "Overnight share of gain", 1], ["_mean_abs_oc", "Mean daily move", 1], ["b", "Beta", 1], ["v", "Volatility (annualized)", 1], ["cs", "Market cap start", 1], ["bs", "Band start"], ["ce", "Market cap end", 1], ["be", "Band end"], ["f", "Flags"]];
  const val = (w, k) => k === "f" ? w.f.join(" ") : w[k];
  function filtered() {
    const gs = [...root.querySelectorAll("[data-g]")].filter(c => c.checked).map(c => c.dataset.g);
    const q = root.querySelector('[data-f="q"]').value.trim().toLowerCase(), F = k => root.querySelector('[data-f="' + k + '"]').value;
    const ind = F("ind"), flag = F("flag"), bs = F("bs"), be = F("be");
    return P.winners.filter(w => gs.includes(w.g) && (!ind || (w.i || "(missing)") === ind) && (flag === "any" || (flag === "nonstd" ? isNonStd(w) : w.f.some(f => f.toLowerCase().includes(flag.toLowerCase())))) && (!bs || w.bs === bs) && (!be || w.be === be) && (!q || w.t.toLowerCase().includes(q) || String(w.n).toLowerCase().includes(q)));
  }
  function render() {
    const W = filtered(), sname = STAT();
    const spy = P.benchmarks.find(b => b.symbol === "SPY"), qqq = P.benchmarks.find(b => b.symbol === "QQQ");
    const tile = (k, kind, label) => { const s = stat(W, k, kind); s.am = fmtK(kind, s.a); s.bm = fmtK(kind, s.b); return [label, s.txt + flagSpan(s)]; };
    root.querySelector('[data-out="tiles"]').innerHTML = [["Winners shown", W.length], tile("ratio", "multiple", sname + " multiple"), tile("share_up_oc", "share", sname + " share of days up (close above open)"), tile("share_overnight", "gainshare", sname + " overnight share of gain"), tile("beta", "beta", sname + " beta against SPY"), tile("vol_annual", "vola", sname + " volatility, annualized"), ["SPY multiple, same window", spy.multiple.toFixed(2)], ["QQQ multiple, same window", qqq.multiple.toFixed(2)]].map(([k, v]) => '<div class="tile"><div class="v">' + v + '</div><div class="k">' + k + "</div></div>").join("");
    const gsShown = GROUPS.filter(g => W.some(w => w.g === g));
    root.querySelector('[data-out="gtable"]').innerHTML = "<table><thead><tr><th>Measure (" + sname + " across winners)</th>" + gsShown.map(g => "<th class=num>" + g + "</th>").join("") + "<th class=num>All shown</th></tr></thead><tbody>" + MEAS.map(([k, l, kind]) => "<tr><td>" + l + "</td>" + gsShown.map(g => "<td class=num>" + statCell(W.filter(w => w.g === g), k, kind) + "</td>").join("") + "<td class=num>" + statCell(W, k, kind) + "</td></tr>").join("") + "</tbody></table>";
    const histFor = g => { const c = new Array(14).fill(0); let t = 0; for (const w of W.filter(w => w.g === g)) w.h.forEach((v, i) => { c[i] += v; t += v; }); return c.map(v => t ? v / t : null); };
    let ch = '<div class="chart"><h4>Daily moves from open to close</h4><p class="sub">Share of winner-days in each band, pooled by gain group</p>' + barChart(BANDS, gsShown.map(g => ({ name: g, color: GC[g], values: histFor(g) })), { fmt: v => pct(v, v < 0.1 ? 1 : 0), rotate: true, h: 260, label: "distribution of daily open to close moves" }) + "</div>";
    const s1 = stat(W, "share_up_oc", "share"), s2 = stat(W, "share_up_cc", "share");
    ch += '<div class="chart"><h4>How often the stock rose</h4><p class="sub">Share of trading days up (' + sname + ' of the winners shown) against SPY and QQQ</p>' + barChart(["Close above open", "Close above prior close"], [{ name: "Winners shown (" + sname + ")", color: "var(--s1)", values: [s1.v, s2.v] }, { name: "SPY", color: "var(--bench1)", values: [spy.share_up_oc, spy.share_up_cc] }, { name: "QQQ", color: "var(--bench2)", values: [qqq.share_up_oc, qqq.share_up_cc] }], { fmt: v => pct(v, 0), max: 1, label: "share of up days" }) + "</div>";
    ch += '<div class="chart"><h4>Market cap bands</h4><p class="sub">Number of winners shown in each band, at the start and at the end of the measured window</p>' + barChart(D.bands, [{ name: "At start", color: "var(--s1)", values: D.bands.map(b => W.filter(w => w.bs === b).length) }, { name: "At end", color: "var(--s2)", values: D.bands.map(b => W.filter(w => w.be === b).length) }], { rotate: true, h: 260, label: "market cap bands" }) + "</div>";
    ch += '<div class="chart"><h4>Where each winner\\'s gain came from</h4><p class="sub">Overnight share of the gain (log returns; intraday is 100% minus this). Values beyond the axis are pinned to its edge.</p>' + dotStrip(gsShown.map(g => ({ name: g, color: GC[g], points: W.filter(w => w.g === g).map(w => ({ v: w._share_overnight, tip: "<b>" + esc(w.t) + "</b> " + esc(w.n) + "<br>Overnight " + pct(w._share_overnight, 0) + ", intraday " + pct(w._share_intraday, 0) + "<br>Multiple " + w.m.toFixed(2) })) })), { domain: [-1, 2], ticks: [-1, -0.5, 0, 0.5, 1, 1.5, 2], fmt: v => v == null ? "n/a" : (v * 100).toFixed(0) + "%", label: "overnight share of gain per winner" }) + "</div>";
    ch += '<div class="chart"><h4>Beta and volatility</h4><p class="sub">Beta against SPY per winner (daily close to close returns)</p>' + dotStrip(gsShown.map(g => ({ name: g, color: GC[g], points: W.filter(w => w.g === g && w.b != null).map(w => ({ v: w.b, tip: "<b>" + esc(w.t) + "</b><br>Beta " + w.b.toFixed(2) + ", volatility " + pct(w.v, 0) + " a year" })) })), { domain: [-1, 4], ticks: [-1, 0, 1, 2, 3, 4], fmt: v => v == null ? "n/a" : v.toFixed(1), label: "beta per winner" }) + "</div>";
    root.querySelector('[data-out="charts"]').innerHTML = ch;
    const S = [...W].sort((a, b) => { const x = val(a, st.sort), y = val(b, st.sort); return (x == null) - (y == null) || (typeof x === "string" ? String(x).localeCompare(String(y)) : x - y) * st.dir; });
    const cell = (w, k) => { const v = val(w, k);
      if (k === "f") return w.f.map(f => '<span class="badge' + (/new listing|moved exchange|starts late/.test(f) ? " ns" : "") + '">' + esc(f) + "</span>").join("");
      if (k === "m" || k === "b") return v == null ? "n/a" : v.toFixed(2); if (["_share_up_oc", "_mean_abs_oc", "v"].includes(k)) return pct(v, 1); if (k === "_share_overnight") return pct(v, 0); if (k === "cs" || k === "ce") return v == null ? "unknown" : fmtCap(v); return esc(v); };
    root.querySelector('[data-out="table"]').innerHTML = "<table><thead><tr>" + cols.map(([k, l, n]) => '<th class="sortable' + (n ? " num" : "") + '" data-k="' + k + '"' + (st.sort === k ? ' aria-sort="' + (st.dir > 0 ? "ascending" : "descending") + '"' : "") + ' tabindex="0">' + l + "</th>").join("") + "</tr></thead><tbody>" +
      S.map(w => '<tr class="' + (isNonStd(w) ? "nonstd" : "") + '">' + cols.map(([k, , n]) => "<td" + (n ? ' class="num"' : "") + ">" + cell(w, k) + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
    root.querySelectorAll("th.sortable").forEach(th => { const go = () => { if (st.sort === th.dataset.k) st.dir *= -1; else { st.sort = th.dataset.k; st.dir = ["t", "n", "g", "s", "e", "x", "i", "f", "bs", "be"].includes(th.dataset.k) ? 1 : -1; } render(); }; th.onclick = go; th.onkeydown = e => { if (e.key === "Enter") go(); }; });
    bindTips(root);
  }
  root.querySelectorAll("input,select").forEach(el => el.addEventListener("input", render));
  renders.push(render); render();
}

// ---- time of day
{
  const root = document.getElementById("panel-tod");
  const T = PIDS.filter(p => D.periods[p].tod);
  const WDS = [["all", "All weekdays"], ["Mon", "Monday"], ["Tue", "Tuesday"], ["Wed", "Wednesday"], ["Thu", "Thursday"], ["Fri", "Friday"]];
  const st = { p: T.includes("B") ? "B" : T[0], wd: "all", g: "all" };
  const seg = (key, opts) => '<span class="seg" role="group" data-seg="' + key + '">' + opts.map(([v, l]) => '<button type="button" data-v="' + v + '" aria-pressed="' + (st[key] === v) + '">' + l + "</button>").join("") + "</span>";
  root.innerHTML = "<h2>Time of day</h2><p class=notice>From 1 minute bars (Alpaca, consolidated feed), regular session 8:30 AM to 3:00 PM Central, full trading days only (half days excluded), in 5 minute slices. Winners count only on their measured days. The minute data itself is not in this page: it lives in <code>strategy/data/raw/minute/</code> (git ignored, rebuilt by the run's command), and every slice is in <code>strategy-run-3-data/period-&lt;P&gt;-gains-by-time.csv</code> and <code>period-&lt;P&gt;-volume-by-time.csv</code>.</p>" +
    '<div class="filters"><label>Period ' + seg("p", T.map(p => [p, p === "A" ? "A (stand-in)" : p])) + '</label><label>Weekday ' + seg("wd", WDS) + '</label><label>Winners ' + seg("g", [["all", "All"], ...GROUPS.map(g => [g, g])]) + "</label></div>" +
    '<div data-out="pd"></div><div class="charts" data-out="charts"></div><h3>Drop off and pick up by weekday, all periods</h3><div class="tablewrap" data-out="pdtable"></div>';
  root.querySelectorAll("[data-seg]").forEach(sg => sg.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; st[sg.dataset.seg] = b.dataset.v; sg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); render(); }));
  function render() {
    const P = D.periods[st.p].tod, sname = STAT(), mk = sname === "mean" ? "mc" : "dc";
    const G = P.groups[st.g][st.wd], S = P.bench.SPY[st.wd], Q = P.bench.QQQ[st.wd];
    const v = sname === "mean" ? "vm" : "vd";
    const marks = [{ m: parseCT(G[mk].drop_off_ct), label: "winners drop off " + G[mk].drop_off_ct, color: "var(--s1)" }, { m: parseCT(G[mk].pick_up_ct), label: "winners pick up " + G[mk].pick_up_ct, color: "var(--s1)" },
      { m: parseCT(S[mk].drop_off_ct), label: "SPY drop off " + S[mk].drop_off_ct, color: "var(--bench1)", row: 1 }, { m: parseCT(S[mk].pick_up_ct), label: "SPY pick up " + S[mk].pick_up_ct, color: "var(--bench1)", row: 1 }];
    root.querySelector('[data-out="pd"]').innerHTML = '<div class="tiles">' + [["Winners in this view", G.n], ["Winner-days", G.nd], ["SPY days", S.nd], ["Winners: volume drops off (CT)", G[mk].drop_off_ct ?? "n/a"], ["Winners: volume picks up (CT)", G[mk].pick_up_ct ?? "n/a"], ["SPY: drops off / picks up", (S[mk].drop_off_ct ?? "n/a") + " / " + (S[mk].pick_up_ct ?? "n/a")], ["QQQ: drops off / picks up", (Q[mk].drop_off_ct ?? "n/a") + " / " + (Q[mk].pick_up_ct ?? "n/a")]].map(([k, x]) => '<div class="tile"><div class="v">' + x + '</div><div class="k">' + k + "</div></div>").join("") + "</div><p class=notice>Each time is the middle of a window that may run up to 30 minutes either side. Method in the deliverable, section 3.</p>";
    let ch = '<div class="chart"><h4>Share of the day\\'s volume in each 5 minute slice</h4><p class="sub">' + sname + " across " + (st.g === "all" ? "all winners" : st.g + " winners") + " (per-stock average over its days) against SPY and QQQ (" + sname + " over days). The flat line is an even spread (1/78 per slice). The axis stops at 6 percent; the last slice (closing auction) is labelled where it is cut off.</p>" + lineChart([{ name: "Winners (" + (st.g === "all" ? "all" : st.g) + ")", color: "var(--s1)", values: G[v] }, { name: "SPY", color: "var(--bench1)", values: S[v], clipRow: 1 }, { name: "QQQ", color: "var(--bench2)", values: Q[v], dash: true }, { name: "Even spread", color: "var(--grid)", values: new Array(NS).fill(1 / NS), dash: true }], { fmt: x => pct(x, 1), min: 0, max: 0.06, marks: marks.map(m => ({ ...m, row: (m.row || 0) + 2 })), label: "volume share by time of day", h: 300 }) + "</div>";
    const r = sname === "mean" ? "rm" : "rd";
    const blk = arr => [...Array(13).keys()].map(b => arr.slice(b * 6, b * 6 + 6).reduce((x, y) => x + (y ?? 0), 0));
    const cats = [...Array(13).keys()].map(b => ctLabel(OPEN + b * 30));
    const grpSeries = (st.g === "all" ? ["all", ...GROUPS] : [st.g]).map(g => ({ name: g === "all" ? "All winners" : g, color: GC[g], values: blk(P.groups[g][st.wd][r]) }));
    ch += '<div class="chart"><h4>Average return in each 30 minute block</h4><p class="sub">' + sname + " across winners of each winner's average log return, summed over the six 5 minute slices of the block" + (sname === "median" ? " (an approximation for medians)" : "") + "; SPY and QQQ are the " + sname + " over days. Block start times in CT. Positive = the block tends to rise.</p>" + barChart(cats, [...grpSeries, { name: "SPY", color: "var(--bench1)", values: blk(sname === "median" ? S.rd : S.rm) }, { name: "QQQ", color: "var(--bench2)", values: blk(sname === "median" ? Q.rd : Q.rm) }], { fmt: x => (x * 100).toFixed(3) + "%", rotate: true, h: 280, signed: true, label: "return by time of day" }) + "</div>";
    ch += '<div class="chart"><h4>Where the gains and the losses happen</h4><p class="sub">Share of all intraday rises (and of all falls) across these winner-days that happened in each slice, pooled</p>' + lineChart([{ name: "Share of all gains", color: "var(--s3)", values: G.gs }, { name: "Share of all losses", color: "var(--s2)", values: G.ls }], { fmt: x => pct(x, 1), min: 0, label: "share of gains and losses by slice" }) + "</div>";
    root.querySelector('[data-out="charts"]').innerHTML = ch;
    let t = "<table><thead><tr><th>Period</th><th>Weekday</th><th>Winners: drop off</th><th>Winners: pick up</th><th>SPY: drop off</th><th>SPY: pick up</th><th>QQQ: drop off</th><th>QQQ: pick up</th></tr></thead><tbody>";
    for (const p of T) for (const [wd, wl] of WDS) { const X = D.periods[p].tod, a = X.groups[st.g][wd][mk], s = X.bench.SPY[wd][mk], q = X.bench.QQQ[wd][mk];
      t += "<tr><td>" + p + "</td><td>" + wl + "</td><td>" + (a.drop_off_ct ?? "n/a") + "</td><td>" + (a.pick_up_ct ?? "n/a") + "</td><td>" + (s.drop_off_ct ?? "n/a") + "</td><td>" + (s.pick_up_ct ?? "n/a") + "</td><td>" + (q.drop_off_ct ?? "n/a") + "</td><td>" + (q.pick_up_ct ?? "n/a") + "</td></tr>"; }
    root.querySelector('[data-out="pdtable"]').innerHTML = t + "</tbody></table>";
    bindTips(root);
  }
  if (T.length) { renders.push(render); render(); } else root.innerHTML += "<p>No minute data summarized yet.</p>";
}
document.querySelectorAll('input[name="stat"]').forEach(r => r.addEventListener("change", () => renders.forEach(f => f())));
const h0 = location.hash.slice(1); if (h0) document.getElementById("tab-" + h0)?.click();
addEventListener("hashchange", () => { const h = location.hash.slice(1); const b = document.getElementById("tab-" + h); if (b && b.getAttribute("aria-selected") !== "true") b.click(); });
</script>
</body>
</html>
`;
writeFileSync(join(RUN, "strategy-run-3-deliverable.html"), html);
console.log("wrote strategy-run-3-deliverable.html", (html.length / 1024).toFixed(0), "KB");
