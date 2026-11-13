/**
 * Turn-taking for a call (client-safe, pure): what the Director says while you wait, and when.
 *
 *   filler    If no reply has started about 1.2 s after your words were transcribed, say a short, personal "Mm, one sec." (once per
 *             turn). Never if the model's own short acknowledgement ("Sure, one sec.") has already started to arrive.
 *   progress  During a long wait (more than 4 s with a status such as "Checking the team…" and no new text), say that status
 *             briefly, at most every 6 s, and "Still working on it." if it is the same status 12 s later.
 *   cache     Each canned line is synthesised once per voice and kept (memory, and a store such as IndexedDB), so the next time
 *             costs nothing and arrives at once.
 * Everything here decides; the call hook plays. The timings are named constants so the tests and the docs say the same numbers.
 */
import { cleanForSpeech } from "./sentences";

/** How long after your words were transcribed to wait for the reply to start before filling the silence. */
export const FILLER_DELAY_MS = 1200;
/**
 * With reduced motion the character shows no thinking motion, so the wait looks emptier: the filler comes a little sooner.
 * (A person who asked for less motion has asked for less motion, not for a silent wait.)
 */
export const FILLER_DELAY_REDUCED_MS = 900;
/** A wait this long with a status and no new text is worth a spoken progress line. */
export const PROGRESS_AFTER_MS = 4000;
/** At most one progress line this often. */
export const PROGRESS_EVERY_MS = 6000;
/** The same status this long after it was spoken: "Still working on it." */
export const PROGRESS_STILL_AFTER_MS = 12000;
export const STILL_WORKING_LINE = "Still working on it.";
/** A progress line is short: longer statuses are cut at a word. */
export const MAX_PROGRESS_CHARS = 60;

// ------------------------------------------------------------------------------------------------ the filler

export type FillerPersonality = "calm" | "warm" | "direct" | "playful";

/** Short, in the Director's voice for its personality preset. Two to four words each, so they never talk over the answer. */
export const FILLER_PHRASES: Record<FillerPersonality, readonly string[]> = {
  calm: ["Mm, one sec.", "Let me think about that.", "One moment."],
  warm: ["Ooh, good one — one sec.", "Mm, give me a second.", "Sure, let me look."],
  direct: ["On it.", "Checking.", "One sec."],
  playful: ["Hmm, let me noodle on that.", "Ooh, let me peek.", "Hold that thought."],
};

/** The phrases for a personality preset; an unknown or missing preset sounds calm. */
export function fillerPhrases(personality: string | null | undefined): readonly string[] {
  const key = typeof personality === "string" ? personality.trim().toLowerCase() : "";
  return (FILLER_PHRASES as Record<string, readonly string[]>)[key] ?? FILLER_PHRASES.calm;
}

/**
 * Which phrase to say this turn: never the one just used, and one that is already cached when there is one (so nothing has to be
 * fetched in the middle of a wait). Deterministic: the turn number picks.
 */
export function pickFiller(personality: string | null | undefined, opts: { turn: number; last?: string | null; isCached?: (phrase: string) => boolean }): string {
  const all = fillerPhrases(personality);
  const fresh = all.filter((p) => p !== opts.last);
  const pool = fresh.length > 0 ? fresh : all;
  const ready = opts.isCached ? pool.filter((p) => opts.isCached!(p)) : [];
  const from = ready.length > 0 ? ready : pool;
  return from[Math.abs(Math.trunc(opts.turn)) % from.length]!;
}

export const fillerDelayMs = (reducedMotion: boolean): number => (reducedMotion ? FILLER_DELAY_REDUCED_MS : FILLER_DELAY_MS);

export interface FillerCheck {
  /** Time since the founder's words were transcribed. */
  elapsedMs: number;
  /** Any of the model's text has arrived (its own short acknowledgement counts: it is already on its way). */
  replyTextArrived: boolean;
  /** The reply's voice has started (or is queued to). */
  audioStarted: boolean;
  /** A filler was already played this turn. */
  alreadyUsed: boolean;
  reducedMotion: boolean;
  /** Speech is off for this call (no key, no credits, the daily limit). */
  speechOff?: boolean;
}

export type FillerVerdict =
  | { play: true }
  | { play: false; reason: "too_early"; waitMs: number }
  | { play: false; reason: "already_used" | "ack_arrived" | "audio_started" | "speech_off" };

/** Should the filler play now? Speech off, already used, the reply's voice, or the model's own acknowledgement each say no. */
export function shouldPlayFiller(c: FillerCheck): FillerVerdict {
  if (c.speechOff) return { play: false, reason: "speech_off" };
  if (c.alreadyUsed) return { play: false, reason: "already_used" };
  if (c.audioStarted) return { play: false, reason: "audio_started" };
  if (c.replyTextArrived) return { play: false, reason: "ack_arrived" };
  const delay = fillerDelayMs(c.reducedMotion);
  if (c.elapsedMs < delay) return { play: false, reason: "too_early", waitMs: delay - c.elapsedMs };
  return { play: true };
}

/**
 * A reply that opens with a short acknowledgement (six words or fewer, no more than one sentence) after the filler has already
 * played would say "Mm, one sec." and then "Sure, one sec." back to back. True when `sentence` is that kind of line, so the call can
 * hold it for a moment and drop its voice (the caption stays) if a tool call follows.
 */
export function looksLikeAcknowledgement(sentence: string): boolean {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 6 && !/[.!?…].+[.!?…]/.test(sentence.trim());
}

// ------------------------------------------------------------------------------------------------ progress lines

/** "Thinking…" and "Working…" say nothing new: the character's pose already says it. */
const GENERIC_STATUS = /^\W*(?:thinking|working|transcribing|one moment|just a moment)\b/i;

/** The status as something short to say aloud, or null when it says nothing ("Thinking…"). */
export function progressLine(status: string): string | null {
  const t = cleanForSpeech(status);
  if (!t || GENERIC_STATUS.test(t)) return null;
  if (t.length <= MAX_PROGRESS_CHARS) return t;
  const cut = t.slice(0, MAX_PROGRESS_CHARS);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 20 ? cut.slice(0, sp) : cut).replace(/[\s,;:.…-]+$/, "")}…`;
}

export interface ProgressCheck {
  nowMs: number;
  /** When the wait began: the transcript arriving, or the last text of the reply (whichever is later). */
  quietSinceMs: number;
  /** The latest status event since the last text (raw), or null. */
  status: string | null;
  /** When the last progress line was said this turn, and the status line it was for. */
  lastSpokenAtMs: number | null;
  lastStatusLine: string | null;
  /** Something is playing or queued: never talk over it. */
  busy: boolean;
  speechOff: boolean;
}

export interface ProgressSpeech {
  /** What to say. */
  say: string;
  /** The status line this stands for (kept so the same status is not said twice). */
  statusLine: string;
}

/**
 * The progress line to say now, if any: a status is showing, nothing has been said for 4 s, the last progress line was at least 6 s
 * ago, and it is a new status (or the same one 12 s on, as "Still working on it.").
 */
export function nextProgressLine(c: ProgressCheck): ProgressSpeech | null {
  if (c.speechOff || c.busy) return null;
  if (c.nowMs - c.quietSinceMs <= PROGRESS_AFTER_MS) return null;
  const line = c.status ? progressLine(c.status) : null;
  if (!line) return null;
  if (c.lastSpokenAtMs === null) return { say: line, statusLine: line };
  const since = c.nowMs - c.lastSpokenAtMs;
  if (since < PROGRESS_EVERY_MS) return null;
  if (line !== c.lastStatusLine) return { say: line, statusLine: line };
  return since >= PROGRESS_STILL_AFTER_MS ? { say: STILL_WORKING_LINE, statusLine: line } : null;
}

// ------------------------------------------------------------------------------------------------ the phrase cache

/** Where synthesised phrases outlive the page (IndexedDB in the browser). Failures are swallowed: the cache then lives in memory only. */
export interface PhraseStore {
  get(key: string): Promise<ArrayBuffer | null>;
  put(key: string, bytes: ArrayBuffer): Promise<void>;
}

/**
 * Audio bytes of short canned phrases, per voice: found in memory, then in the store, else synthesised once (concurrent askers share
 * the one request) and kept in both. Every caller gets its own copy, because decoding audio consumes the buffer it is given.
 */
export class PhraseCache {
  private readonly mem = new Map<string, ArrayBuffer>();
  private readonly inflight = new Map<string, Promise<ArrayBuffer | null>>();

  constructor(private readonly store: PhraseStore | null = null, private readonly maxEntries = 48) {}

  /** One key per voice and phrase. */
  static key(voiceModel: string, voice: string, phrase: string): string {
    return `${voiceModel}|${voice}|${phrase.trim()}`;
  }

  /** Already in memory (no waiting needed to play it). */
  has(key: string): boolean {
    return this.mem.has(key);
  }

  get size(): number {
    return this.mem.size;
  }

  private remember(key: string, bytes: ArrayBuffer): void {
    this.mem.delete(key);
    this.mem.set(key, bytes);
    while (this.mem.size > this.maxEntries) {
      const oldest = this.mem.keys().next().value;
      if (oldest === undefined) break;
      this.mem.delete(oldest);
    }
  }

  /** The audio for `key`: from memory, from the store, or from `fetcher` (called at most once at a time per key). Null when none. */
  async get(key: string, fetcher: () => Promise<ArrayBuffer | null>): Promise<ArrayBuffer | null> {
    const hit = this.mem.get(key);
    if (hit) {
      this.remember(key, hit); // most recently used
      return hit.slice(0);
    }
    const running = this.inflight.get(key);
    if (running) return running.then((b) => (b ? b.slice(0) : null));
    const job = (async (): Promise<ArrayBuffer | null> => {
      try {
        const stored = await this.store?.get(key);
        if (stored && stored.byteLength > 0) {
          this.remember(key, stored);
          return stored;
        }
      } catch { /* the store is a bonus */ }
      let bytes: ArrayBuffer | null = null;
      try { bytes = await fetcher(); } catch { bytes = null; }
      if (!bytes || bytes.byteLength === 0) return null;
      this.remember(key, bytes);
      try { await this.store?.put(key, bytes.slice(0)); } catch { /* memory only */ }
      return bytes;
    })().finally(() => { this.inflight.delete(key); });
    this.inflight.set(key, job);
    const bytes = await job;
    return bytes ? bytes.slice(0) : null;
  }
}
