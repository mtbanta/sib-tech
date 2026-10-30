// Hides secrets. Two layers: the exact secret values this process holds, and key-shaped patterns for
// anything that slipped through. Used by the logger and by everything that posts to Discord.

const PATTERNS: RegExp[] = [
  /discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/g,
  /hc-ping\.com\/[0-9a-f-]{20,}/g,
  /\b[MNO][\w-]{23,26}\.[\w-]{6}\.[\w-]{27,}\b/g,
  /\bpostgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@\S*/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\b(?:PK|AK|CK)[A-Z0-9]{18,}\b/g,
  /\bsbp_[a-f0-9]{30,}\b/g,
  /\bsb_secret_[A-Za-z0-9_-]{10,}\b/g,
];

export type Redactor = (text: string) => string;

export function makeRedactor(secrets: readonly string[]): Redactor {
  // Longest first, so a value that contains another value is hidden whole.
  const values = [...new Set(secrets.filter((s) => s.length >= 8))].sort((a, b) => b.length - a.length);
  return (text: string): string => {
    let out = text;
    for (const v of values) out = out.split(v).join("[redacted]");
    for (const re of PATTERNS) out = out.replace(re, "[redacted]");
    return out;
  };
}
