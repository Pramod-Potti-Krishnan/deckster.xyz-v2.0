import { describe, expect, it, vi } from "vitest";
import {
  FILLER_DELAY_MS, FILLER_DELAY_REDUCED_MS, FILLER_PHRASES, MAX_PROGRESS_CHARS, PROGRESS_AFTER_MS, PROGRESS_EVERY_MS, PROGRESS_STILL_AFTER_MS, STILL_WORKING_LINE,
  PhraseCache, fillerDelayMs, fillerPhrases, looksLikeAcknowledgement, nextProgressLine, pickFiller, progressLine, shouldPlayFiller,
  type FillerCheck, type PhraseStore, type ProgressCheck,
} from "../../../lib/studio/voice/turns";

const base: FillerCheck = { elapsedMs: 1300, replyTextArrived: false, audioStarted: false, alreadyUsed: false, reducedMotion: false };

describe("filler: when to say 'Mm, one sec.'", () => {
  it("waits for about 1.2 s after the founder's words were transcribed", () => {
    expect(FILLER_DELAY_MS).toBe(1200);
    expect(shouldPlayFiller({ ...base, elapsedMs: 0 })).toEqual({ play: false, reason: "too_early", waitMs: 1200 });
    expect(shouldPlayFiller({ ...base, elapsedMs: 700 })).toEqual({ play: false, reason: "too_early", waitMs: 500 });
    expect(shouldPlayFiller({ ...base, elapsedMs: 1199 })).toMatchObject({ play: false, reason: "too_early" });
    expect(shouldPlayFiller({ ...base, elapsedMs: 1200 })).toEqual({ play: true });
    expect(shouldPlayFiller({ ...base, elapsedMs: 9000 })).toEqual({ play: true });
  });

  it("never when the model's own acknowledgement (any reply text) has started to arrive", () => {
    expect(shouldPlayFiller({ ...base, replyTextArrived: true })).toEqual({ play: false, reason: "ack_arrived" });
    expect(shouldPlayFiller({ ...base, replyTextArrived: true, elapsedMs: 5000 })).toEqual({ play: false, reason: "ack_arrived" });
  });

  it("never once the reply's voice has started", () => {
    expect(shouldPlayFiller({ ...base, audioStarted: true })).toEqual({ play: false, reason: "audio_started" });
  });

  it("at most one per turn", () => {
    expect(shouldPlayFiller({ ...base, alreadyUsed: true })).toEqual({ play: false, reason: "already_used" });
  });

  it("not when speech is off for the call", () => {
    expect(shouldPlayFiller({ ...base, speechOff: true })).toEqual({ play: false, reason: "speech_off" });
    expect(shouldPlayFiller({ ...base, speechOff: false })).toEqual({ play: true });
  });

  it("with reduced motion the avatar shows less of the wait, so the filler comes sooner", () => {
    expect(fillerDelayMs(false)).toBe(FILLER_DELAY_MS);
    expect(fillerDelayMs(true)).toBe(FILLER_DELAY_REDUCED_MS);
    expect(FILLER_DELAY_REDUCED_MS).toBeLessThan(FILLER_DELAY_MS);
    expect(shouldPlayFiller({ ...base, reducedMotion: true, elapsedMs: 900 })).toEqual({ play: true });
    expect(shouldPlayFiller({ ...base, reducedMotion: false, elapsedMs: 900 })).toMatchObject({ play: false, reason: "too_early" });
    expect(shouldPlayFiller({ ...base, reducedMotion: true, elapsedMs: 500 })).toEqual({ play: false, reason: "too_early", waitMs: 400 });
    // Reduced motion never overrides the other reasons.
    expect(shouldPlayFiller({ ...base, reducedMotion: true, replyTextArrived: true })).toMatchObject({ play: false, reason: "ack_arrived" });
    expect(shouldPlayFiller({ ...base, reducedMotion: true, alreadyUsed: true })).toMatchObject({ play: false, reason: "already_used" });
  });

  it("speech off beats everything; an audio start beats the acknowledgement", () => {
    expect(shouldPlayFiller({ ...base, speechOff: true, alreadyUsed: true, audioStarted: true })).toMatchObject({ reason: "speech_off" });
    expect(shouldPlayFiller({ ...base, audioStarted: true, replyTextArrived: true })).toMatchObject({ reason: "audio_started" });
  });
});

describe("filler: the phrase for each personality", () => {
  it("matches the personality preset", () => {
    expect(fillerPhrases("calm")).toContain("Mm, one sec.");
    expect(fillerPhrases("calm")).toContain("Let me think about that.");
    expect(fillerPhrases("warm")).toContain("Ooh, good one — one sec.");
    expect(fillerPhrases("direct")).toContain("On it.");
    expect(fillerPhrases("direct")).toContain("Checking.");
    expect(fillerPhrases("playful")).toContain("Hmm, let me noodle on that.");
  });

  it("each preset has its own lines, short enough never to talk over the answer", () => {
    const all = new Set<string>();
    for (const [name, list] of Object.entries(FILLER_PHRASES)) {
      expect(list.length, name).toBeGreaterThanOrEqual(2);
      for (const p of list) {
        expect(p.split(/\s+/).length, p).toBeLessThanOrEqual(6);
        expect(all.has(p), `${p} is shared`).toBe(false);
        all.add(p);
      }
    }
  });

  it("an unknown, empty or missing personality sounds calm; case and spaces are forgiven", () => {
    expect(fillerPhrases("grumpy")).toBe(FILLER_PHRASES.calm);
    expect(fillerPhrases("")).toBe(FILLER_PHRASES.calm);
    expect(fillerPhrases(null)).toBe(FILLER_PHRASES.calm);
    expect(fillerPhrases(undefined)).toBe(FILLER_PHRASES.calm);
    expect(fillerPhrases("  Playful ")).toBe(FILLER_PHRASES.playful);
  });

  it("never picks the phrase it just used, and varies with the turn", () => {
    for (const personality of ["calm", "warm", "direct", "playful"]) {
      let last: string | null = null;
      const seen = new Set<string>();
      for (let turn = 1; turn <= 12; turn++) {
        const p = pickFiller(personality, { turn, last });
        expect(p).not.toBe(last);
        expect(fillerPhrases(personality)).toContain(p);
        seen.add(p);
        last = p;
      }
      expect(seen.size).toBeGreaterThan(1);
    }
    expect(pickFiller("calm", { turn: 4 })).toBe(pickFiller("calm", { turn: 4 })); // deterministic
  });

  it("prefers a phrase that is already cached, so nothing is fetched mid-wait", () => {
    const cached = new Set(["Let me think about that."]);
    for (let turn = 1; turn <= 6; turn++) expect(pickFiller("calm", { turn, isCached: (p) => cached.has(p) })).toBe("Let me think about that.");
    // ...unless it is the one just used.
    expect(pickFiller("calm", { turn: 1, last: "Let me think about that.", isCached: (p) => cached.has(p) })).not.toBe("Let me think about that.");
    // Nothing cached: any phrase will do.
    expect(fillerPhrases("calm")).toContain(pickFiller("calm", { turn: 3, isCached: () => false }));
  });

  it("spots a short acknowledgement the model wrote", () => {
    for (const s of ["Sure, one sec.", "On it.", "Good question, looking now.", "Hmm, let me think."]) expect(looksLikeAcknowledgement(s), s).toBe(true);
    for (const s of ["Two things need you today and one of them is the launch.", "Yes. The deploy is ready.", "", "Maya asked about the launch date on Friday afternoon, in Slack."]) expect(looksLikeAcknowledgement(s), s).toBe(false);
  });
});

const wait: ProgressCheck = { nowMs: 5000, quietSinceMs: 0, status: "Checking your projects…", lastSpokenAtMs: null, lastStatusLine: null, busy: false, speechOff: false };

describe("progress lines: speaking the status during a long wait", () => {
  it("says the latest status after more than 4 s of waiting with a status and no new text", () => {
    expect(PROGRESS_AFTER_MS).toBe(4000);
    expect(nextProgressLine({ ...wait, nowMs: 3999 })).toBeNull();
    expect(nextProgressLine({ ...wait, nowMs: 4000 })).toBeNull(); // "more than" 4 s
    expect(nextProgressLine({ ...wait, nowMs: 4001 })).toEqual({ say: "Checking your projects…", statusLine: "Checking your projects…" });
  });

  it("the wait counts from the last text, not from the start of the turn", () => {
    expect(nextProgressLine({ ...wait, nowMs: 9000, quietSinceMs: 6000 })).toBeNull(); // new text 3 s ago
    expect(nextProgressLine({ ...wait, nowMs: 11000, quietSinceMs: 6000 })).not.toBeNull();
  });

  it("needs a status that says something: not 'Thinking…', not 'Working…', not nothing", () => {
    expect(nextProgressLine({ ...wait, status: null })).toBeNull();
    expect(nextProgressLine({ ...wait, status: "Thinking…" })).toBeNull();
    expect(nextProgressLine({ ...wait, status: "Working…" })).toBeNull();
    expect(progressLine("Transcribing…")).toBeNull();
    expect(progressLine("Checking the team…")).toBe("Checking the team…");
  });

  it("at most once every 6 s", () => {
    expect(PROGRESS_EVERY_MS).toBe(6000);
    const spoken = { lastSpokenAtMs: 5000, lastStatusLine: "Checking your projects…" };
    const next = { ...wait, ...spoken, status: "Looking at tasks…" };
    expect(nextProgressLine({ ...next, nowMs: 10999 })).toBeNull();
    expect(nextProgressLine({ ...next, nowMs: 11000 })).toEqual({ say: "Looking at tasks…", statusLine: "Looking at tasks…" });
    expect(nextProgressLine({ ...next, nowMs: 20000 })).toEqual({ say: "Looking at tasks…", statusLine: "Looking at tasks…" });
  });

  it("does not say the same status twice, until 12 s on, when it says it is still working", () => {
    const spoken = { ...wait, lastSpokenAtMs: 5000, lastStatusLine: "Checking your projects…" };
    expect(nextProgressLine({ ...spoken, nowMs: 12000 })).toBeNull();
    expect(nextProgressLine({ ...spoken, nowMs: 5000 + PROGRESS_STILL_AFTER_MS - 1 })).toBeNull();
    expect(nextProgressLine({ ...spoken, nowMs: 5000 + PROGRESS_STILL_AFTER_MS })).toEqual({ say: STILL_WORKING_LINE, statusLine: "Checking your projects…" });
    // After "still working", the same status is again silent for 12 s (the caller keeps the status line).
    const again = { ...spoken, lastSpokenAtMs: 17000 };
    expect(nextProgressLine({ ...again, nowMs: 23000 })).toBeNull();
    expect(nextProgressLine({ ...again, nowMs: 29000 })?.say).toBe(STILL_WORKING_LINE);
  });

  it("never talks over something that is playing, and not when speech is off", () => {
    expect(nextProgressLine({ ...wait, busy: true })).toBeNull();
    expect(nextProgressLine({ ...wait, speechOff: true })).toBeNull();
  });

  it("keeps a line brief", () => {
    const long = "Looking through every project, every task and every report for anything that could possibly need your attention today…";
    const line = progressLine(long)!;
    expect(line.length).toBeLessThanOrEqual(MAX_PROGRESS_CHARS + 1);
    expect(line.endsWith("…")).toBe(true);
    expect(line).not.toMatch(/\s…$/);
    expect(progressLine("  ")).toBeNull();
    expect(progressLine("**Opening** the [report](https://x.test)…")).toBe("Opening the report…");
  });
});

/** An in-memory stand-in for IndexedDB that can fail. */
function fakeStore(initial: Record<string, ArrayBuffer> = {}, fail = false): PhraseStore & { data: Map<string, ArrayBuffer>; puts: number } {
  const data = new Map(Object.entries(initial));
  const s = {
    data,
    puts: 0,
    async get(key: string) { if (fail) throw new Error("idb down"); return data.get(key) ?? null; },
    async put(key: string, bytes: ArrayBuffer) { if (fail) throw new Error("idb down"); s.puts += 1; data.set(key, bytes); },
  };
  return s;
}
const bytes = (...n: number[]) => new Uint8Array(n).buffer as ArrayBuffer;

describe("phrase cache: synthesised once per voice", () => {
  const key = PhraseCache.key("google/gemini-3.8-flash-tts", "Kore", "Mm, one sec.");

  it("keys are per voice, model and phrase", () => {
    expect(key).toBe("google/gemini-3.8-flash-tts|Kore|Mm, one sec.");
    expect(PhraseCache.key("m", "Kore", " Hi ")).toBe("m|Kore|Hi");
    expect(PhraseCache.key("m", "Puck", "Hi")).not.toBe(PhraseCache.key("m", "Kore", "Hi"));
  });

  it("fetches once, then serves from memory with a fresh copy each time", async () => {
    const cache = new PhraseCache(null);
    const fetcher = vi.fn(async () => bytes(1, 2, 3));
    expect(cache.has(key)).toBe(false);
    const a = await cache.get(key, fetcher);
    const b = await cache.get(key, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect([...new Uint8Array(a!)]).toEqual([1, 2, 3]);
    expect(a).not.toBe(b); // decoding consumes a buffer: never hand out the same one twice
    expect(cache.has(key)).toBe(true);
    new Uint8Array(a!)[0] = 99;
    expect([...new Uint8Array((await cache.get(key, fetcher))!)]).toEqual([1, 2, 3]); // a caller's changes never reach the cache
  });

  it("asks for it once when many ask at the same moment", async () => {
    const cache = new PhraseCache(null);
    let release: (b: ArrayBuffer) => void = () => {};
    const fetcher = vi.fn(() => new Promise<ArrayBuffer | null>((r) => { release = r; }));
    const all = [cache.get(key, fetcher), cache.get(key, fetcher), cache.get(key, fetcher)];
    await Promise.resolve();
    release(bytes(7));
    const got = await Promise.all(all);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(got.map((g) => [...new Uint8Array(g!)])).toEqual([[7], [7], [7]]);
  });

  it("writes to the store, and a new page (empty memory) finds it there without fetching", async () => {
    const store = fakeStore();
    const first = new PhraseCache(store);
    await first.get(key, async () => bytes(4, 5));
    expect(store.puts).toBe(1);
    expect([...new Uint8Array(store.data.get(key)!)]).toEqual([4, 5]);
    const second = new PhraseCache(store);
    const fetcher = vi.fn(async () => bytes(0));
    const got = await second.get(key, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect([...new Uint8Array(got!)]).toEqual([4, 5]);
    expect(second.has(key)).toBe(true);
  });

  it("a store that fails is ignored (memory only), and a failed fetch is not cached", async () => {
    const cache = new PhraseCache(fakeStore({}, true));
    const ok = vi.fn(async () => bytes(1));
    expect(await cache.get(key, ok)).not.toBeNull();
    expect(await cache.get(key, ok)).not.toBeNull();
    expect(ok).toHaveBeenCalledTimes(1);

    const c2 = new PhraseCache(null);
    const bad = vi.fn(async (): Promise<ArrayBuffer | null> => null);
    expect(await c2.get("k", bad)).toBeNull();
    expect(await c2.get("k", async () => new ArrayBuffer(0))).toBeNull(); // empty audio is no audio
    expect(await c2.get("k", async () => { throw new Error("boom"); })).toBeNull();
    expect(c2.has("k")).toBe(false);
    expect(await c2.get("k", async () => bytes(9))).not.toBeNull(); // and the next ask tries again
  });

  it("keeps the most recently used entries when full", async () => {
    const cache = new PhraseCache(null, 2);
    await cache.get("a", async () => bytes(1));
    await cache.get("b", async () => bytes(2));
    await cache.get("a", async () => bytes(1)); // a is now the freshest
    await cache.get("c", async () => bytes(3));
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
    expect(cache.size).toBe(2);
  });
});
