// Key-shaped patterns for the secret scan. Each rule is deliberately BROADER than the vendor's real token
// format, so a made-up token that "looks real" is refused here before GitHub's push protection sees it.
//
// What is known and what is not (checked 2026-10-30):
// - GitHub's supported patterns page (docs.github.com, "Supported secret scanning patterns") names: Discord Bot
//   Token (push protection on), Supabase Secret Key and Supabase Personal Access Token (push protection on),
//   Supabase scoped personal access token and Supabase OAuth access token (alerts only). It names nothing for
//   Alpaca or Healthchecks, and nothing for Fly.io's tokens that this scan covers.
// - GitHub does NOT publish its regular expressions, and says it updates them and supports more than one
//   token version. So "the same patterns as GitHub" cannot be copied; "broader than the known formats" is the
//   goal, and the check against the real values in each .env.local is the strongest rule of all.
//
// There is no way to switch a rule off for one line. The old "scan-allow-fake" marker was removed because it
// skipped exactly these rules, which is how a token-shaped test string reached GitHub's push protection.

export const PATTERNS = [
  // Alpaca key ids: PK (paper), AK (live), CK (broker). Live shaped ids are refused anywhere in the repo.
  ["alpaca key id", /\b(PK|AK|CK)[A-Z0-9]{16,}\b/],
  // Alpaca secret key, only next to the word alpaca, because a bare 40 character string is too common.
  ["alpaca secret key", /alpaca[\w .-]{0,40}secret[\w .-]{0,20}[=:]\s*["'`]?[A-Za-z0-9]{36,48}\b/i],
  // Discord webhook address (id and token).
  ["discord webhook", /discord(app)?\.com\/api\/(v\d+\/)?webhooks\/\d+\/[\w-]+/i],
  // Discord bot token, any version: three dot-separated URL-safe base64 parts. Not limited to a first letter.
  ["discord bot token", /\b[\w-]{20,}\.[\w-]{5,8}\.[\w-]{25,}\b/],
  // Discord token in an assignment next to the word discord (64 hex secrets, 32 character secrets).
  ["discord secret", /discord[\w .-]{0,30}(secret|token)[\w .-]{0,20}[=:]\s*["'`]?[A-Za-z0-9_-]{32,}/i],
  ["api key with sk- prefix", /(?<![\w-])sk-[A-Za-z0-9_-]{20,}\b/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ["database url with password", /\bpostgres(ql)?:\/\/[^\s:@/]+:[^\s@/]+@/],
  // Healthchecks ping address: by check id, or by project ping key and slug.
  ["healthchecks ping url", /hc-ping\.com\/[A-Za-z0-9_-]{16,}/],
  // Healthchecks API key, only as a header value or next to the word healthchecks.
  ["healthchecks api key", /(x-api-key["'`]?\s*[:=]\s*["'`]?|healthchecks[\w .-]{0,30}key[\w .-]{0,20}[=:]\s*["'`]?)[A-Za-z0-9_-]{28,40}\b/i],
  // Supabase: new style keys (sb_secret_), personal, scoped and OAuth access tokens (sbp_ prefixes).
  ["supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{10,}\b/],
  ["supabase access token", /\bsbp_[A-Za-z0-9_]{20,}\b/],
  // Fly.io tokens: fo1_ (access tokens) and "FlyV1" macaroons.
  ["fly.io token", /\b(fo1_[A-Za-z0-9_-]{20,}|FlyV1\s+[A-Za-z0-9_+/=,\s-]{20,})/],
  ["private key header", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

// Returns the names of the rules a piece of text trips (never the matched text).
export function rulesTripped(text) {
  return PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}
