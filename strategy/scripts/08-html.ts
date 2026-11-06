// Step 8: build runs/strategy-run-1-deliverable.html, a single file that opens with a double-click.
// Data comes from runs/strategy-run-1-data/summary.json (embedded). The overview's findings and the
// sources tab are taken from the markdown deliverable itself, so the page holds no claim the markdown lacks.
// No network calls; no external libraries (charts are plain SVG).
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { OUT, RUN } from "./common.ts";

const summary = JSON.parse(readFileSync(join(OUT, "summary.json"), "utf8"));
const mdText = readFileSync(join(RUN, "strategy-run-1-deliverable.md"), "utf8");

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
const coverageHtml = mdToHtml(section(3));
const termsHtml = (() => { const a = mdText.indexOf("**Terms used.**"), b = mdText.indexOf("## 1. "); return a >= 0 && b > a ? mdToHtml(mdText.slice(a + "**Terms used.**".length, b)) : ""; })();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Strategy run 1: how bull market winners behaved, day by day</title>
<style>
:root { color-scheme: light;
  --surface: #fcfcfb; --surface-2: #f3f2ef; --border: #dddcd7; --text: #0b0b0b; --text-2: #52514e; --muted: #7a7974;
  --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --bench1: #52514e; --bench2: #a3a29c; --grid: #e7e6e2; --mark: #6250d6; }
@media (prefers-color-scheme: dark) { :root { color-scheme: dark;
  --surface: #1a1a19; --surface-2: #242423; --border: #3a3a38; --text: #f0efec; --text-2: #c3c2b7; --muted: #9a998f;
  --s1: #3987e5; --s2: #d95926; --s3: #199e70; --bench1: #c3c2b7; --bench2: #7a7974; --grid: #2e2e2c; --mark: #9085e9; } }
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
@media (max-width: 640px) { main { padding: 12px; } .charts { grid-template-columns: 1fr; } header, nav { padding-left: 12px; padding-right: 12px; } .tile .v { font-size: 18px; } }
</style>
</head>
<body>
<header>
<h1>Strategy run 1: how past bull market winners behaved, day by day</h1>
<p class="notice">Research input for a human decision, never an instruction to act. Not financial advice. Winners are picked with hindsight. The markdown deliverable (<code>strategy-run-1-deliverable.md</code>) is the source of record and wins any disagreement with this page.</p>
</header>
<nav role="tablist" id="tabs"></nav>
<main id="panels"></main>
<div id="tip" role="tooltip"></div>
<script type="application/json" id="data">${JSON.stringify(summary).replace(/</g, "\\u003c")}</script>
<script type="text/html" id="findings">${findingsHtml.replace(/<\/script/gi, "<\\/script")}</script>
<script type="text/html" id="sources">${sourcesHtml.replace(/<\/script/gi, "<\\/script")}</script>
<script type="text/html" id="terms">${termsHtml.replace(/<\/script/gi, "<\\/script")}</script>
<script type="text/html" id="coverage">${coverageHtml.replace(/<\/script/gi, "<\\/script")}</script>
<script>
const D = JSON.parse(document.getElementById("data").textContent);
const GROUPS = ["4x", "5x", "6x+"], GC = { "4x": "var(--s1)", "5x": "var(--s2)", "6x+": "var(--s3)" };
const BANDS = ["below -10%", "-10 to -5", "-5 to -3", "-3 to -2", "-2 to -1", "-1 to -0.5", "-0.5 to 0", "0 to 0.5", "0.5 to 1", "1 to 2", "2 to 3", "3 to 5", "5 to 10", "10% and up"];
const FLAGS = [["any", "Any"], ["nonstd", "Non-standard start or end"], ["new listing", "New listing"], ["shell merger", "Shell (SPAC) merger"], ["moved exchange", "Moved exchange"], ["starts late", "History starts late in data"], ["new shares", "New shares after bankruptcy"], ["missing earnings date", "Missing earnings date"], ["ADR", "ADR"], ["delisted", "Delisted"], ["acquired", "Acquired"], ["partnership units", "Partnership units"]];
const pct = (x, d = 1) => x == null || !isFinite(x) ? "n/a" : (x * 100).toFixed(d) + "%";
const fmtCap = x => x == null ? "" : x >= 1e9 ? (x / 1e9).toFixed(2) + "B" : (x / 1e6).toFixed(0) + "M";
const median = a => { const b = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const isNonStd = w => w.f.some(f => /new listing|missing earnings|moved exchange|new shares|starts late|^delisted$|^acquired$/.test(f));
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
  const max = opts.max ?? nice(raw / 4) * 4;
  const cw = (W - L - R) / cats.length, bw = Math.max(3, Math.min(22, (cw - 6) / series.length - 2));
  const y = v => T + (H - T - B) * (1 - v / max);
  let g = "";
  for (let k = 0; k <= 4; k++) { const v = max * k / 4, yy = y(v); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--grid)"/><text x="' + (L - 4) + '" y="' + (yy + 4) + '" text-anchor="end">' + (opts.fmt ? opts.fmt(v) : v.toFixed(0)) + "</text>"; }
  cats.forEach((c, i) => {
    const x0 = L + i * cw + (cw - series.length * (bw + 2)) / 2;
    series.forEach((s, j) => { const v = s.values[i]; if (v == null) return; const x = x0 + j * (bw + 2), yy = y(v), h = Math.max(0, H - B - yy);
      g += '<rect x="' + (x - 3) + '" y="' + T + '" width="' + (bw + 6) + '" height="' + (H - B - T) + '" fill="transparent" data-tip="' + esc("<b>" + s.name + "</b><br>" + c + ": " + (opts.fmt ? opts.fmt(v) : v)) + '"/>';
      g += '<path d="M' + x + "," + (H - B) + "V" + (yy + Math.min(4, h)) + "q0,-" + Math.min(4, h) + " " + Math.min(4, h) + ",-" + Math.min(4, h) + "H" + (x + bw - Math.min(4, h)) + "q" + Math.min(4, h) + ",0 " + Math.min(4, h) + "," + Math.min(4, h) + "V" + (H - B) + 'Z" fill="' + s.color + '" pointer-events="none"/>'; });
    const lx = L + i * cw + cw / 2;
    g += opts.rotate ? '<text transform="translate(' + lx + "," + (H - B + 10) + ') rotate(-40)" text-anchor="end">' + esc(c) + "</text>" : '<text x="' + lx + '" y="' + (H - B + 16) + '" text-anchor="middle">' + esc(c) + "</text>";
  });
  g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="var(--muted)"/>';
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

const tabs = [["overview", "Overview"], ...Object.keys(D.periods).sort().map(p => [p, p === "A" ? "A (2016 to 2020 stand-in)" : "Period " + p]), ["sources", "Sources"]];
const nav = document.getElementById("tabs"), panels = document.getElementById("panels");
tabs.forEach(([id, label], i) => {
  const b = document.createElement("button"); b.textContent = label; b.setAttribute("role", "tab"); b.id = "tab-" + id; b.setAttribute("aria-controls", "panel-" + id); b.setAttribute("aria-selected", i === 0 ? "true" : "false");
  b.onclick = () => { nav.querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", "false")); b.setAttribute("aria-selected", "true"); panels.querySelectorAll("section").forEach(s => s.classList.toggle("active", s.id === "panel-" + id)); b.scrollIntoView({ block: "nearest", inline: "nearest" }); if (location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id); };
  nav.appendChild(b);
  const s = document.createElement("section"); s.id = "panel-" + id; s.setAttribute("role", "tabpanel"); s.setAttribute("aria-labelledby", b.id); if (i === 0) s.classList.add("active"); panels.appendChild(s);
});

// ---- overview
{
  const P = Object.keys(D.periods).sort();
  let h = "<h2>Winners by period and gain group</h2><p class=notice>Counts of Nasdaq and NYSE company stocks that ended at 4 times their starting price or more. Period A is a stand-in window (January 2016 to January 2020), because free data starts in 2016; its counts are not comparable with B, C and D.</p>";
  h += '<div class="tablewrap"><table><thead><tr><th>Period</th><th>Window</th><th class=num>4x</th><th class=num>5x</th><th class=num>6x+</th><th class=num>Total</th><th class=num>Possible winners, exchange not confirmed</th></tr></thead><tbody>';
  for (const p of P) { const c = D.periods[p].counts; h += "<tr><td>" + p + "</td><td>" + esc(D.periods[p].first + " to " + D.periods[p].last) + "</td><td class=num>" + c["4x"] + "</td><td class=num>" + c["5x"] + "</td><td class=num>" + c["6x+"] + "</td><td class=num>" + (c["4x"] + c["5x"] + c["6x+"]) + "</td><td class=num>" + D.periods[p].unknown_exchange.length + "</td></tr>"; }
  h += "</tbody></table></div>";
  h += '<div class="chart" style="max-width:680px"><h4>Winners per period, by gain group</h4>' + barChart(P.map(p => p === "A" ? "A (stand-in)" : p), GROUPS.map(g => ({ name: g, color: GC[g], values: P.map(p => D.periods[p].counts[g]) })), { label: "winners per period by gain group" }) + "</div>";
  h += "<details><summary>Terms used (from the deliverable)</summary>" + document.getElementById("terms").textContent + "</details>";
  h += "<h2>Findings (from the deliverable, section 1)</h2>" + document.getElementById("findings").textContent;
  h += "<h2>Data coverage (from the deliverable, section 3)</h2>" + document.getElementById("coverage").textContent;
  document.getElementById("panel-overview").innerHTML = h; bindTips(document.getElementById("panel-overview"));
}
// ---- sources
document.getElementById("panel-sources").innerHTML = "<h2>Sources (from the deliverable, section 9)</h2>" + document.getElementById("sources").textContent;

// ---- period tabs
for (const p of Object.keys(D.periods)) {
  const P = D.periods[p], root = document.getElementById("panel-" + p);
  const inds = [...new Set(P.winners.map(w => w.i || "(missing)"))].sort();
  root.innerHTML = "<h2>" + (p === "A" ? "Stand-in for period A: " : "Period " + p + ": ") + esc(P.label) + "</h2><p class=notice>Measured trading days " + P.first + " to " + P.last + ". Rows marked with a purple bar and a badge were measured from a non-standard start or to a non-standard end. Full daily rows: <code>strategy-run-1-data/period-" + p + "-daily.csv" + (D.compressed_files?.includes("period-" + p + "-daily.csv.gz") ? ".gz" : "") + "</code>.</p>" +
    '<div class="filters" role="group" aria-label="filters">' + GROUPS.map(g => '<label><input type="checkbox" data-g="' + g + '" checked> ' + g + "</label>").join("") +
    '<label>Industry <select data-f="ind"><option value="">All</option>' + inds.map(i => "<option>" + esc(i) + "</option>").join("") + "</select></label>" +
    '<label>Flag <select data-f="flag">' + FLAGS.map(([v, l]) => '<option value="' + v + '">' + l + "</option>").join("") + "</select></label>" +
    '<label>Ticker or name <input type="search" data-f="q" placeholder="e.g. NVDA"></label></div>' +
    '<div class="tiles" data-out="tiles"></div><div class="charts" data-out="charts"></div><h3>Winners</h3><div class="tablewrap" data-out="table"></div>';
  const st = { sort: "m", dir: -1 };
  const cols = [["t", "Ticker"], ["n", "Company"], ["g", "Group"], ["m", "Multiple", 1], ["s", "Start"], ["e", "End"], ["x", "Exchange"], ["i", "Industry"], ["d", "Days", 1], ["upoc", "Up days, close above open", 1], ["upcc", "Up days, close above prior close", 1], ["on", "Overnight share of gain", 1], ["ao", "Mean daily move", 1], ["ri", "Mean rise from open", 1], ["dr", "Mean drop from open", 1], ["usd", "Rose when SPY fell or flat", 1], ["cs", "Market cap start", 1], ["ce", "Market cap end", 1], ["f", "Flags"]];
  const val = (w, k) => k === "upoc" ? w.uo / w.d : k === "upcc" ? w.uc / (w.uc + w.dc + w.fc) : k === "f" ? w.f.join(" ") : w[k];
  function filtered() {
    const gs = [...root.querySelectorAll("[data-g]")].filter(c => c.checked).map(c => c.dataset.g);
    const ind = root.querySelector('[data-f="ind"]').value, flag = root.querySelector('[data-f="flag"]').value, q = root.querySelector('[data-f="q"]').value.trim().toLowerCase();
    return P.winners.filter(w => gs.includes(w.g) && (!ind || (w.i || "(missing)") === ind) && (flag === "any" || (flag === "nonstd" ? isNonStd(w) : w.f.some(f => f.toLowerCase().includes(flag.toLowerCase())))) && (!q || w.t.toLowerCase().includes(q) || String(w.n).toLowerCase().includes(q)));
  }
  function render() {
    const W = filtered();
    const spy = P.benchmarks.find(b => b.symbol === "SPY"), qqq = P.benchmarks.find(b => b.symbol === "QQQ");
    root.querySelector('[data-out="tiles"]').innerHTML = [["Winners shown", W.length], ["Median multiple", median(W.map(w => w.m))?.toFixed(2) ?? "n/a"], ["Median share of days up (close above open)", pct(median(W.map(w => w.uo / w.d)))], ["Median overnight share of gain", pct(median(W.map(w => w.on)), 0)], ["SPY multiple, same window", spy.multiple.toFixed(2)], ["QQQ multiple, same window", qqq.multiple.toFixed(2)]].map(([k, v]) => '<div class="tile"><div class="v">' + v + '</div><div class="k">' + k + "</div></div>").join("");
    const gsShown = GROUPS.filter(g => W.some(w => w.g === g));
    const histFor = g => { const c = new Array(14).fill(0); let t = 0; for (const w of W.filter(w => w.g === g)) w.h.forEach((v, i) => { c[i] += v; t += v; }); return c.map(v => t ? v / t : null); };
    let ch = '<div class="chart"><h4>Daily moves from open to close</h4><p class="sub">Share of winner-days in each band, pooled by gain group</p>' + barChart(BANDS, gsShown.map(g => ({ name: g, color: GC[g], values: histFor(g) })), { fmt: v => pct(v, v < 0.1 ? 1 : 0), rotate: true, h: 260, label: "distribution of daily open to close moves" }) + "</div>";
    const upoc = median(W.map(w => w.uo / w.d)), upcc = median(W.map(w => w.uc / (w.uc + w.dc + w.fc)));
    ch += '<div class="chart"><h4>How often the stock rose</h4><p class="sub">Median share of trading days up, winners shown against SPY and QQQ</p>' + barChart(["Close above open", "Close above prior close"], [{ name: "Winners shown (median)", color: "var(--s1)", values: [upoc, upcc] }, { name: "SPY", color: "var(--bench1)", values: [spy.share_up_oc, spy.share_up_cc] }, { name: "QQQ", color: "var(--bench2)", values: [qqq.share_up_oc, qqq.share_up_cc] }], { fmt: v => pct(v, 0), max: 1, label: "share of up days" }) + "</div>";
    ch += '<div class="chart"><h4>Where each winner\\'s gain came from</h4><p class="sub">Overnight share of the gain (log returns; the intraday share is 100% minus this). Values beyond the axis are pinned to its edge.</p>' + dotStrip(gsShown.map(g => ({ name: g, color: GC[g], points: W.filter(w => w.g === g).map(w => ({ v: w.on, tip: "<b>" + esc(w.t) + "</b> " + esc(w.n) + "<br>Overnight " + pct(w.on, 0) + ", intraday " + pct(w.id, 0) + "<br>Multiple " + w.m.toFixed(2) })) })), { domain: [-1, 2], ticks: [-1, -0.5, 0, 0.5, 1, 1.5, 2], fmt: v => v == null ? "n/a" : (v * 100).toFixed(0) + "%", label: "overnight share of gain per winner" }) + "</div>";
    const pool = (a, b) => { const d = W.reduce((x, w) => x + (w[a] || 0), 0); return d ? W.reduce((x, w) => x + (w[b] || 0), 0) / d : null; };
    ch += '<div class="chart"><h4>Rising against the market</h4><p class="sub">Share of benchmark down-or-flat days (close to close) on which the winner closed above its prior close, pooled</p>' + barChart(["SPY fell or flat", "QQQ fell or flat"], [{ name: "Winners shown", color: "var(--s1)", values: [pool("sd", "su"), pool("qd", "qu")] }], { fmt: v => pct(v, 0), max: 1, label: "winner up on benchmark down days" }) + "</div>";
    root.querySelector('[data-out="charts"]').innerHTML = ch;
    const S = [...W].sort((a, b) => { const x = val(a, st.sort), y = val(b, st.sort); return (x == null) - (y == null) || (typeof x === "string" ? String(x).localeCompare(String(y)) : x - y) * st.dir; });
    const cell = (w, k) => { const v = val(w, k);
      if (k === "f") return w.f.map(f => '<span class="badge' + (/new listing|missing earnings|moved exchange|new shares|starts late|^delisted$|^acquired$/.test(f) ? " ns" : "") + '">' + esc(f) + "</span>").join("");
      if (k === "m") return v.toFixed(2); if (["upoc", "upcc", "ao", "ri", "dr", "usd"].includes(k)) return pct(v, 1); if (k === "on") return pct(v, 0); if (k === "cs" || k === "ce") return fmtCap(v); return esc(v); };
    root.querySelector('[data-out="table"]').innerHTML = "<table><thead><tr>" + cols.map(([k, l, n]) => '<th class="sortable' + (n ? " num" : "") + '" data-k="' + k + '"' + (st.sort === k ? ' aria-sort="' + (st.dir > 0 ? "ascending" : "descending") + '"' : "") + ' tabindex="0">' + l + "</th>").join("") + "</tr></thead><tbody>" +
      S.map(w => '<tr class="' + (isNonStd(w) ? "nonstd" : "") + '">' + cols.map(([k, , n]) => "<td" + (n ? ' class="num"' : "") + ">" + cell(w, k) + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
    root.querySelectorAll("th.sortable").forEach(th => { const go = () => { if (st.sort === th.dataset.k) st.dir *= -1; else { st.sort = th.dataset.k; st.dir = ["t", "n", "g", "s", "e", "x", "i", "f"].includes(th.dataset.k) ? 1 : -1; } render(); }; th.onclick = go; th.onkeydown = e => { if (e.key === "Enter") go(); }; });
    bindTips(root);
  }
  root.querySelectorAll("input,select").forEach(el => el.addEventListener("input", render));
  render();
}
const h0 = location.hash.slice(1); if (h0) document.getElementById("tab-" + h0)?.click();
addEventListener("hashchange", () => { const h = location.hash.slice(1); const b = document.getElementById("tab-" + h); if (b && b.getAttribute("aria-selected") !== "true") b.click(); });
</script>
</body>
</html>
`;
writeFileSync(join(RUN, "strategy-run-1-deliverable.html"), html);
console.log("wrote strategy-run-1-deliverable.html", (html.length / 1024).toFixed(0), "KB");
