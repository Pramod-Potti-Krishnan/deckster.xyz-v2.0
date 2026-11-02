/**
 * Streaming sentence chunker for spoken replies (client-safe, pure).
 *
 * The Director streams text deltas; the call speaks each sentence as soon as it is complete, so the first sentence starts playing
 * while the rest is still being written. Rules:
 *  - a sentence ends at . ! ? or an ellipsis that is followed by whitespace (so "3.5", "deckster.ai" and "v2.1" never split),
 *    plus closing quotes/brackets, and always at a line break;
 *  - abbreviations do not end a sentence: titles (Dr. Mr. St.), "e.g." / "i.e.", initials ("J. Smith"), list markers
 *    ("1. Check"); "No. 5" / "Fig. 2" only when a number follows; "etc." / "a.m." / "Inc." only when a capital follows;
 *  - a punctuation mark at the very end of the buffer is not decided until the next character arrives (it could be "3" "." "5");
 *  - very short sentences ("Sure.") are held and joined to the next one so the voice does not stutter;
 *  - a run-on with no punctuation is cut at the last clause mark (, ; : dash) or space before `maxChars`;
 *  - markdown, links, emoji, code fences are removed before speech.
 * `flush()` emits whatever is held (call it when the reply ends, or when the Director goes off to use a tool).
 */

export interface ChunkerOptions {
  /** Sentences shorter than this are held and joined to the next one (unless flushed). Default 12. */
  minChars?: number;
  /** A run-on longer than this is cut at a clause mark or space. Default 240. */
  maxChars?: number;
}

const ENDERS = ".!?…";
const CLOSERS = "\"'”’)]}";

/** Titles and Latin shorthand: never end a sentence. */
const NEVER_END = new Set([
  "mr", "mrs", "ms", "mx", "dr", "prof", "sr", "jr", "st", "mt", "vs", "cf", "approx", "dept", "est", "ref", "gen", "sen", "rep",
  "gov", "lt", "col", "capt", "sgt", "rev", "hon", "e.g", "i.e", "viz", "u.s", "u.k", "ph.d", "m.d", "b.c", "a.d",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
]);
/** Abbreviations that are a number label: only continue the sentence when a digit follows ("No. 5"). */
const BEFORE_NUMBER = new Set(["no", "nos", "fig", "figs", "vol", "ch", "eq", "p", "pp"]); // not "sec": "one sec." is a sentence
/** Abbreviations that can end a sentence: split only when a capital letter follows. */
const MAYBE_END = new Set(["etc", "a.m", "p.m", "inc", "ltd", "co", "corp", "al"]);

const isSpace = (c: string | undefined) => c !== undefined && /\s/.test(c);

/** Plain text for the voice: no markdown, links, emoji or code. Empty when nothing speakable is left. */
export function cleanForSpeech(input: string): string {
  let s = input;
  s = s.replace(/^\s{0,3}#{1,6}\s+/, "");                 // heading
  s = s.replace(/^\s{0,3}>\s?/, "");                       // quote
  s = s.replace(/^\s*(?:[-*+•]|\d{1,2}[.)])\s+/, ""); // list marker
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");          // image
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");           // link -> its text
  s = s.replace(/\bhttps?:\/\/\S+/gi, "a link");           // bare URL
  s = s.replace(/`{1,3}([^`]*)`{1,3}/g, "$1");             // code
  s = s.replace(/[*`~]+/g, "");                            // emphasis marks left over
  s = s.replace(/(^|\s)_{1,2}([^_\s][^_]*?)_{1,2}(?=\s|[.,;:!?]|$)/g, "$1$2"); // _emphasis_ (not snake_case)
  s = s.replace(/\s*\|\s*/g, ", ");                        // table pipes
  s = s.replace(/\p{Extended_Pictographic}️?/gu, ""); // emoji
  s = s.replace(/[​-‏⁠﻿]/g, "");       // invisible characters
  s = s.replace(/\s+/g, " ").trim();
  return /[\p{L}\p{N}]/u.test(s) ? s : "";
}

export class SentenceChunker {
  private buf = "";
  private carry = "";
  private inFence = false;
  private readonly minChars: number;
  private readonly maxChars: number;

  constructor(opts: ChunkerOptions = {}) {
    this.minChars = opts.minChars ?? 12;
    this.maxChars = Math.max(60, opts.maxChars ?? 240);
  }

  /** Add streamed text; returns the sentences that are complete now (cleaned, ready to speak). */
  push(delta: string): string[] {
    if (!delta) return [];
    this.buf += delta;
    return this.drain(false);
  }

  /** The reply ended (or the Director paused to use a tool): emit everything held. */
  flush(): string[] {
    return this.drain(true);
  }

  /** Forget everything (barge-in, new turn). */
  reset(): void {
    this.buf = "";
    this.carry = "";
    this.inFence = false;
  }

  /** True when text is waiting to be spoken. */
  get pending(): boolean {
    return this.buf.trim().length > 0 || this.carry.length > 0;
  }

  private drain(final: boolean): string[] {
    const out: string[] = [];
    for (;;) {
      const cut = this.findCut();
      if (cut < 0) break;
      const seg = this.buf.slice(0, cut);
      this.buf = this.buf.slice(cut);
      this.accept(seg, false, out);
    }
    if (final) {
      const rest = this.buf;
      this.buf = "";
      // A final remainder may itself be a run-on: split it by length like any other.
      let remaining = rest;
      while (remaining.length > this.maxChars) {
        const at = this.forcedCut(remaining);
        this.accept(remaining.slice(0, at), false, out);
        remaining = remaining.slice(at);
      }
      this.accept(remaining, true, out);
      if (this.carry) {
        out.push(this.carry);
        this.carry = "";
      }
    }
    return out;
  }

  /** One segment (a sentence or a line): fences, cleaning, and joining short sentences. */
  private accept(seg: string, final: boolean, out: string[]): void {
    const raw = seg.trim();
    if (!raw) return;
    if (raw.startsWith("```")) {
      this.inFence = !this.inFence;
      return;
    }
    if (this.inFence) return;
    const clean = cleanForSpeech(raw);
    if (!clean) return;
    const text = this.carry ? `${this.carry} ${clean}` : clean;
    if (text.length < this.minChars && !final) {
      this.carry = text;
      return;
    }
    this.carry = "";
    out.push(text);
  }

  /** Index (exclusive end, newline consumed) of the first complete segment in `buf`, or -1. */
  private findCut(): number {
    const b = this.buf;
    let i = 0;
    while (i < b.length) {
      const c = b[i]!;
      if (c === "\n") return i + 1;
      if (ENDERS.includes(c)) {
        let j = i;
        while (j < b.length && ENDERS.includes(b[j]!)) j++;
        const run = b.slice(i, j);
        let k = j;
        while (k < b.length && CLOSERS.includes(b[k]!)) k++;
        if (k >= b.length) return -1;                  // undecided: the next character may continue the token ("3" "." "5")
        if (!isSpace(b[k])) {                          // "3.5", "deckster.ai", "e.g.," : not a boundary
          i = k;
          continue;
        }
        const verdict = this.judge(i, run, k);
        if (verdict === "pending") return -1;
        if (verdict === "end") return k;
        i = k;
        continue;
      }
      i++;
    }
    if (b.length > this.maxChars) return this.forcedCut(b);
    return -1;
  }

  /** Is the punctuation run at `i` (text before it is `buf.slice(0, i)`) the end of a sentence? */
  private judge(i: number, run: string, k: number): "end" | "continue" | "pending" {
    const b = this.buf;
    const next = (): string | null | undefined => {
      let m = k;
      while (m < b.length && isSpace(b[m])) m++;
      return m < b.length ? b[m] : null;              // null: nothing yet
    };
    const hasMore = /[!?]/.test(run);                  // "?" / "!" always end a sentence
    if (hasMore) return "end";
    if (run.length > 1 || run === "…") {          // ellipsis: only a sentence end when a capital follows
      const n = next();
      if (n === null) return "pending";
      return n !== undefined && /[\p{Lu}\p{N}"'“(]/u.test(n) ? "end" : "continue";
    }
    // A single "." : look at the word before it.
    const before = b.slice(0, i);
    const word = /([\p{L}][\p{L}.]*)$/u.exec(before)?.[1] ?? "";
    const lower = word.toLowerCase().replace(/\.$/, "");
    if (/^[\p{Lu}]$/u.test(word) && word !== "I") return "continue"; // initial: "J. Smith"
    if (!word) {
      // A bare number before the dot at the start of a segment is a list marker ("1. Check").
      const num = /(?:^|\n)\s*(\d{1,2})$/.exec(before);
      if (num) return "continue";
      return "end";
    }
    if (NEVER_END.has(lower)) return "continue";
    if (BEFORE_NUMBER.has(lower)) {
      const n = next();
      if (n === null) return "pending";
      return n !== undefined && /\d/.test(n) ? "continue" : "end";
    }
    if (MAYBE_END.has(lower)) {
      const n = next();
      if (n === null) return "pending";
      return n !== undefined && /[\p{Lu}\p{N}]/u.test(n) ? "end" : "continue";
    }
    return "end";
  }

  /** A run-on: cut at the last clause mark (or space) before `maxChars`. */
  private forcedCut(text: string): number {
    const window = text.slice(0, this.maxChars);
    const floor = Math.min(40, Math.floor(this.maxChars / 3));
    let best = -1;
    for (let p = window.length - 1; p >= floor; p--) {
      const ch = window[p]!;
      if ((ch === ";" || ch === ":" || ch === "—" || ch === "–") && (isSpace(window[p + 1]) || p === window.length - 1)) { best = p + 1; break; }
    }
    if (best < 0) {
      for (let p = window.length - 1; p >= floor; p--) {
        if (window[p] === "," && (isSpace(window[p + 1]) || p === window.length - 1)) { best = p + 1; break; }
      }
    }
    if (best < 0) {
      const sp = window.lastIndexOf(" ");
      best = sp >= floor ? sp + 1 : this.maxChars;
    }
    return best;
  }
}

/** One-shot helper: all the sentences in `text` (what a stream of the same text would speak). */
export function splitSentences(text: string, opts?: ChunkerOptions): string[] {
  const c = new SentenceChunker(opts);
  return [...c.push(text), ...c.flush()];
}
