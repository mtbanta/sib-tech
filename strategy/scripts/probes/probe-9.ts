import { submissions, nameLookup } from "../sec.ts";
const j = await submissions(1418091);
const r = j.filings.recent;
console.log(j.name, j.tickers, j.exchanges, j.sicDescription, j.entityType);
for (let i=0;i<r.form.length;i++) if (/^25/.test(r.form[i]) || r.form[i]==="15-12B" || r.form[i]==="8-A12B") console.log(r.filingDate[i], r.form[i], r.accessionNumber[i], r.primaryDocument[i]);
const l = await nameLookup("TWITTER INC");
console.log(JSON.stringify(l).slice(0,500));
