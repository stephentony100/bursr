// One place that turns any error into words a shop owner understands: what
// happened, and what to do next. Bursr's own messages are already plain and
// pass through; technical ones (wallet objects, network failures, service
// codes, stack traces) are translated. Safe in the browser and on the server.

type Shape = { message?: unknown; error?: unknown; code?: unknown; status?: unknown; detail?: unknown; title?: unknown; cause?: unknown };

/** Pulls a message and a code out of whatever was thrown (Error, string, wallet object, API error). */
function parts(e: unknown): { text: string; code: string; status: number | null } {
  if (typeof e === "string") return { text: e, code: "", status: null };
  if (!e || typeof e !== "object") return { text: "", code: "", status: null };
  const o = e as Shape;
  const nested = o.error && typeof o.error === "object" ? parts(o.error) : null;
  const text =
    (typeof o.detail === "string" && o.detail) ||
    (typeof o.message === "string" && o.message) ||
    (typeof o.error === "string" && o.error) ||
    nested?.text ||
    (typeof o.title === "string" && o.title) ||
    "";
  return { text, code: typeof o.code === "string" ? o.code : (nested?.code ?? ""), status: typeof o.status === "number" ? o.status : (nested?.status ?? null) };
}

// What the agent account's codes mean for the owner.
const CODES: Record<string, string> = {
  insufficient_balance: "There isn't enough money in your Bursr wallet for this. Add money and try again.",
  spend_budget_exceeded: "This would go over your weekly limit. It can go out when the limit refills, or you can raise it on the Limits page.",
  policy_transaction_limit_exceeded: "This is more than your largest single payment allowed. Pay it in parts, or raise it on the Limits page.",
  policy_destination_denied: "This wallet isn't on your list of people you pay. Only you can add someone, on the People page.",
  wallet_frozen: "Payments are paused. Turn them back on on the Limits page.",
  invalid_address: "That wallet address can't receive this payment. Check the address and the network with the person.",
  policy_asset_denied: "Your spending rules don't allow paying in this currency. You can change that on the Limits page.",
  rate_limited: "Too many tries in a short time. Wait a minute and try again.",
  idempotency_conflict: "This payment was already started with different details. Bursr stopped it so nothing is paid twice.",
  validation_failed: "The payment service couldn't process this request. Nothing was sent. Bursr will try again shortly.",
  unauthorized: "Your session has ended. Please sign in again.",
};

const PLAIN: [RegExp, string][] = [
  [/user (rejected|cancel|denied)|rejected by user|request rejected|cancel(l)?ed|closed (the )?(window|popup|modal)|popup closed|window closed|user closed/i, "You closed your wallet before confirming, so nothing changed. Try again when you're ready."],
  [/no wallet|wallet not (found|installed|selected)|not installed|no (selected|connected) wallet/i, "Bursr couldn't find a wallet to connect. Install a NEAR wallet app such as HOT Wallet, then try again."],
  [/failed to fetch|fetch failed|networkerror|network error|econn|enotfound|etimedout|timed? ?out|aborted|socket hang up|load failed/i, "Bursr couldn't reach the network just now. Check your internet connection and try again."],
  [/\b429\b|too many requests|rate.?limit/i, CODES.rate_limited],
  [/\b402\b|no credits|insufficient credits|payment required/i, "The AI service used to read invoices has run out of credits. The business owner needs to top it up."],
  [/signature not accepted|invalid signature|signature.*(invalid|mismatch)/i, "Your wallet's signature couldn't be checked. Please sign in again."],
  [/\b401\b|unauthori[sz]ed|not signed in|session (has )?expired/i, CODES.unauthorized],
];

// Signs that a message was written for developers, not people.
const TECHNICAL =
  /\[object |TypeError|ReferenceError|SyntaxError|is not a function|undefined|Unexpected token|JSON|Prisma|PrismaClient|invalid input|expected .* received|stack|at \w+ \(|\{.*:.*\}|nep141:|0x[0-9a-f]{20,}|[0-9a-f]{40,}|ERR_|status code|internal server error|\b5\d\d\b/i;

const FALLBACK = "Something went wrong on our side. Please try again. If it keeps happening, tell us what you were doing when it happened.";

/** A sentence for the screen. Plain messages pass through; technical ones are translated. */
export function friendlyError(e: unknown, fallback = FALLBACK): string {
  const { text, code, status } = parts(e);
  if (code && CODES[code]) return CODES[code];
  if (status === 429) return CODES.rate_limited;
  for (const [pattern, words] of PLAIN) if (pattern.test(text)) return words;
  if (!text || TECHNICAL.test(text) || text.length > 400) return fallback;
  return text;
}
