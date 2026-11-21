// Parser for an SEC filing's XBRL cover page (R1.htm): share counts per class and the ADR ratio text.
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, sixteen: 16, twenty: 20, "twenty-five": 25, thirty: 30, forty: 40, fifty: 50, sixty: 60, eighty: 80, hundred: 100, "one hundred": 100, "two hundred": 200 };
export const num = (s: string) => { s = s.toLowerCase().replace(/[()]/g, "").trim(); if (/^[\d,.]+$/.test(s)) return Number(s.replace(/,/g, "")); return WORDS[s] ?? null; };
export function parseCover(html: string) {
  const text = html.replace(/<script[\s\S]*?<\/script>/g, "");
  const rows = [...text.matchAll(/<tr[\s\S]*?<\/tr>/g)].map(m => m[0].replace(/<[^>]*>/g, "|").replace(/&#160;|&nbsp;/g, " ").replace(/&amp;/g, "&").split("|").map(x => x.trim()).filter(Boolean));
  let shares = 0, nShareRows = 0; const titles: string[] = [];
  for (const r of rows) {
    if (/^Entity Common Stock,? Shares Outstanding/i.test(r[0])) { for (const c of r.slice(1)) { const v = Number(c.replace(/,/g, "")); if (/^[\d,]+$/.test(c) && v > 0) { shares += v; nShareRows++; } } }
    if (/^Title of 12\(b\) Security/i.test(r[0]) || /^Security 12b Title/i.test(r[0])) titles.push(...r.slice(1));
  }
  let ratio: number | null = null, ratioText = "";
  for (const t of titles) {
    // "each representing two ordinary shares", "each ADS represents 0.5 ordinary share", "one-fifth of one ordinary share"
    let m = t.match(/each (?:ADS |ADSs |American Depositary Share )?(?:representing|represents|represent)\s+([\w\-,.]+(?: hundred)?)\s+(?:\(\d+\)\s+)?(?:ordinary|common|class|shares|share)/i);
    if (m) { const n = num(m[1]); if (n) { ratio = n; ratioText = t; break; } }
    m = t.match(/(one|1)[- ](half|third|fourth|fifth|tenth)s? of (?:one|1|an?) (?:ordinary|common|class)/i);
    if (m) { ratio = 1 / ({ half: 2, third: 3, fourth: 4, fifth: 5, tenth: 10 } as any)[m[2].toLowerCase()]; ratioText = t; break; }
  }
  return { shares: nShareRows ? shares : null, nShareRows, ratio, ratioText, titles };
}
