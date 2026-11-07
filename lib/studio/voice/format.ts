/** Small formatting and capability helpers for the call screen (client-safe, pure). */

/** 75 -> "1:15", 3725 -> "1:02:05". */
export function formatCallDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** MIME types to try with MediaRecorder, best first: webm/opus (Chrome, Edge, Firefox, Electron), then mp4 (Safari). */
export const RECORDER_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"] as const;

/** The first candidate the browser can record, or undefined to let it choose. */
export function pickRecorderMime(isSupported: (mime: string) => boolean): string | undefined {
  for (const m of RECORDER_MIME_CANDIDATES) {
    try { if (isSupported(m)) return m; } catch { /* keep looking */ }
  }
  return undefined;
}

/** Hold Space/Enter style keys: ignore key presses typed into text fields. */
export function isEditableTarget(t: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!t) return false;
  const tag = (t.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable === true;
}

/** A recording is worth sending when it lasted long enough and the microphone actually picked something up. */
export function worthSending(opts: { durationMs: number; peakLevel: number; minMs?: number; minPeak?: number }): { ok: boolean; reason?: "too_short" | "silent" } {
  const minMs = opts.minMs ?? 350;
  const minPeak = opts.minPeak ?? 0.012;
  if (opts.durationMs < minMs) return { ok: false, reason: "too_short" };
  if (opts.peakLevel < minPeak) return { ok: false, reason: "silent" };
  return { ok: true };
}

// ------------------------------------------------------------------------------------------------ what a call costs

/** "$5" for whole dollars, "$0.50" otherwise. */
export function formatUsdPlain(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** The sentence shown when the Director has used up its own daily limit (chat, voice routes and the call screen all say the same thing). */
export function dailyLimitMessage(directorName: string, limitUsd: number | null): string {
  return `I've reached today's ${limitUsd == null ? "" : `${formatUsdPlain(limitUsd)} `}limit. Raise it in Settings → ${directorName} → What it costs.`;
}

/**
 * The running cost of a call for the footer: "≈ $0.06", "< $0.01" for a fraction of a cent, "≈ $0.06+" when some of its parts had
 * no dollar figure (so the real total may be higher). Never "$0" for something unknown.
 */
export function formatCallCost(totalUsd: number, unknownCount = 0): string {
  const total = Number.isFinite(totalUsd) && totalUsd > 0 ? totalUsd : 0;
  const plus = unknownCount > 0 ? "+" : "";
  if (total > 0 && total < 0.005) return `< $0.01${plus}`;
  return `≈ $${total.toFixed(2)}${plus}`;
}

/** What a call costs at list price, from the session's rates (null where a price is unknown). */
export interface CallRates { replyUsd: number | null; hearingPerMinUsd: number | null; speakingPerMinUsd: number | null }

/** "2¢", "$1.20": a small amount the way a person says it. */
const cents = (usd: number): string => (usd < 1 ? `${Math.round(usd * 100)}¢` : `$${usd.toFixed(2)}`);

/**
 * The call screen's one cost line, in mono: "about 2¢ a minute · $0.03 so far · $5 limit" (costs always visible).
 *  - The rate is measured once a minute has passed and something was priced; before that it is the list-price estimate (half a
 *    minute heard, half spoken and one reply a minute), and it is left out when a price is unknown (never a guess).
 *  - "so far" gets a "+" when some part had no figure. The limit is the bird's own daily limit; none set says so.
 */
export function callCostLine(o: { totalUsd: number; unknownCount?: number; elapsedSeconds: number; limitUsd?: number | null; rates?: CallRates | null }): string {
  const total = Number.isFinite(o.totalUsd) && o.totalUsd > 0 ? o.totalUsd : 0;
  const plus = (o.unknownCount ?? 0) > 0 ? "+" : "";
  const r = o.rates;
  const listed = r && r.replyUsd != null && r.hearingPerMinUsd != null && r.speakingPerMinUsd != null ? r.hearingPerMinUsd / 2 + r.speakingPerMinUsd / 2 + r.replyUsd : null;
  const perMinute = o.elapsedSeconds >= 60 && total > 0 ? total / (o.elapsedSeconds / 60) : listed;
  const parts: string[] = [];
  if (perMinute != null && Number.isFinite(perMinute)) parts.push(perMinute < 0.005 ? "under 1¢ a minute" : `about ${cents(perMinute)} a minute`);
  parts.push(`${total > 0 && total < 0.005 ? "under $0.01" : `$${total.toFixed(2)}`}${plus} so far`);
  parts.push(o.limitUsd == null ? "no daily limit" : `${formatUsdPlain(o.limitUsd)} limit`);
  return parts.join(" · ");
}

/** A dollar amount from the `X-Deckster-Cost-Usd` response header (a plain decimal), or null when it is missing or odd. */
export function parseCostHeader(value: string | null | undefined): number | null {
  if (typeof value !== "string" || !/^\d{1,6}(\.\d{1,8})?$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The header the voice routes use to say what a request cost (USD, a plain decimal). Omitted when the cost is unknown. */
export const COST_HEADER = "X-Deckster-Cost-Usd";

/** Adds up what one call cost, from the pieces as they arrive. A piece with no figure counts as unknown (never as $0). */
export class CallCostMeter {
  totalUsd = 0;
  unknownCount = 0;
  add(usd: number | null | undefined): void {
    if (typeof usd === "number" && Number.isFinite(usd) && usd >= 0) this.totalUsd += usd;
    else this.unknownCount += 1;
  }
  get label(): string { return formatCallCost(this.totalUsd, this.unknownCount); }
}
