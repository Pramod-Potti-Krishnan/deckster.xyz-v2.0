/** Ported from Garud feature/companion-v2-player b3a812e (packages/core/src/voice/companion-speech.ts), unchanged except where marked "Deckster:". Pure: no React, no DOM. */
/** Client-only speech timing. All samples depend on the supplied audio time, never a timer. */
import { FACE_MOUTHS, parseSpeechTimeline, type FaceMouth, type SpeechTimeline } from "./companion-face";

export const COMPANION_MOUTH_LEAD = 0.05;
export const COMPANION_MOUTH_FADE = 0.07;
export const COMPANION_SHORTEST_SHAPE = 0.06;
export interface CompanionEnvelopePoint { t: number; level: number }
/** One audio segment. Keep id stable while its audio plays; change it when replacing that segment. */
export interface CompanionSpeechPlayback {
  now: () => number;
  timeline?: SpeechTimeline;
  text?: string;
  duration?: number;
  envelope?: readonly CompanionEnvelopePoint[];
  id?: number;
}
export interface CompanionMouthSample { mouth: FaceMouth; previousMouth: FaceMouth; mouthMix: number }
export interface PreparedCompanionSpeech {
  readonly prepared: true;
  readonly cues: readonly { readonly t: number; readonly mouth: FaceMouth }[];
  readonly gestures: readonly { readonly t: number; readonly clip: string }[];
  readonly duration?: number;
}
const closed = (): CompanionMouthSample => ({ mouth: "closed", previousMouth: "closed", mouthMix: 1 });
const validDuration = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
/** Drop fleeting shapes before playback. The preceding accepted mouth simply holds across them.
 * Without a known duration the final cue holds indefinitely; supply a terminal closed cue or duration.
 */
export function prepareCompanionSpeech(timeline: SpeechTimeline, duration?: number): PreparedCompanionSpeech {
  parseSpeechTimeline(timeline);
  const end = validDuration(duration) ? duration : undefined;
  const source = timeline.cues.filter(c => end === undefined || c.t < end);
  if (end !== undefined) source.push({ t: end, mouth: "closed" });
  // Consecutive duplicate cues are one continuous visual shape, not separate fleeting sounds.
  const runs = source.filter((c, i) => i === 0 || source[i - 1]!.mouth !== c.mouth);
  const cues: { t: number; mouth: FaceMouth }[] = [];
  for (let i = 0; i < runs.length; i++) {
    const c = runs[i]!;
    const next = runs[i + 1]?.t ?? Infinity;
    if (next - c.t + 1e-9 < COMPANION_SHORTEST_SHAPE) continue;
    if (cues[cues.length - 1]?.mouth === c.mouth) continue;
    cues.push({ t: c.t, mouth: c.mouth });
  }
  return { prepared: true, cues, gestures: timeline.gestures.filter(g => end === undefined || g.t < end).map(g => ({ ...g })), ...(end === undefined ? {} : { duration: end }) };
}
/** The audio clock may stop, jump forward or seek backwards; no prior render state is consulted. */
export function sampleCompanionSpeech(timeline: SpeechTimeline | PreparedCompanionSpeech, audioTime: number): CompanionMouthSample {
  if (!Number.isFinite(audioTime) || audioTime < 0) return closed();
  const p = "prepared" in timeline ? timeline : prepareCompanionSpeech(timeline);
  if (p.duration !== undefined && audioTime >= p.duration) return closed();
  const at = audioTime + COMPANION_MOUTH_LEAD;
  let low = 0, high = p.cues.length;
  while (low < high) { const mid = (low + high) >>> 1; if (p.cues[mid]!.t <= at) low = mid + 1; else high = mid; }
  const index = low - 1, current = p.cues[index];
  if (!current) return closed();
  // A valid 60ms shape must finish its fade before the next one starts.
  const nextAt = p.cues[index + 1]?.t ?? Infinity;
  const fade = Math.min(COMPANION_MOUTH_FADE, Math.max(COMPANION_SHORTEST_SHAPE, nextAt - current.t));
  const mouthMix = Math.max(0, Math.min(1, (at - current.t) / fade));
  return { mouth: current.mouth, previousMouth: p.cues[index - 1]?.mouth ?? "closed", mouthMix };
}

// Small English pronunciation seed. Unknown words use the ordered grapheme rules below.
// This is intentionally an offline approximation, not a forced aligner or a universal dictionary.
const WORD_SOUNDS: Readonly<Record<string, string>> = Object.freeze({
  a: "AH", an: "AH N", and: "AH N D", are: "AH R", as: "AH Z", at: "AH T",
  be: "B IY", been: "B IH N", both: "B OW TH", but: "B AH T", by: "B AY",
  can: "K AH N", chart: "CH AH R T", charts: "CH AH R T S", close: "K L OW Z", could: "K UH D",
  data: "D EY T AH", do: "D UW", done: "D AH N", down: "D AW N",
  each: "IY CH", eight: "EY T", end: "EH N D", first: "F ER S T", five: "F AY V",
  for: "F AO R", four: "F AO R", from: "F R AH M", good: "G UH D", great: "G R EY T",
  have: "HH AH V", hello: "HH EH L OW", here: "HH IY R", how: "HH AW", i: "AY",
  in: "IH N", is: "IH Z", it: "IH T", just: "JH AH S T", left: "L EH F T",
  like: "L AY K", list: "L IH S T", look: "L UH K", maya: "M AY AH", me: "M IY",
  more: "M AO R", my: "M AY", next: "N EH K S T", nine: "N AY N", no: "N OW",
  now: "N AW", of: "AH V", on: "AH N", one: "W AH N", open: "OW P AH N",
  our: "AW R", out: "AW T", over: "OW V ER", please: "P L IY Z", point: "P OY N T",
  question: "K W EH S CH AH N", questions: "K W EH S CH AH N Z", right: "R AY T", said: "S EH D",
  say: "S EY", second: "S EH K AH N D", see: "S IY", seven: "S EH V AH N", she: "SH IY",
  show: "SH OW", shows: "SH OW Z", six: "S IH K S", slide: "S L AY D", slides: "S L AY D Z",
  so: "S OW", some: "S AH M", speak: "S P IY K", stop: "S T AH P", ten: "T EH N",
  thank: "TH AH NG K", thanks: "TH AH NG K S", that: "TH AH T", the: "TH AH", their: "TH EH R",
  there: "TH EH R", these: "TH IY Z", they: "TH EY", thing: "TH IH NG", this: "TH IH S",
  three: "TH R IY", through: "TH R UW", time: "T AY M", to: "T UW", two: "T UW",
  up: "AH P", us: "AH S", use: "Y UW Z", view: "V Y UW", was: "W AH Z", we: "W IY",
  welcome: "W EH L K AH M", well: "W EH L", what: "W AH T", when: "W EH N", where: "W EH R",
  which: "W IH CH", who: "HH UW", will: "W IH L", with: "W IH TH", work: "W ER K",
  would: "W UH D", yes: "Y EH S", you: "Y UW", your: "Y AO R", zero: "Z IY R OW",
});
const PHONEME_MOUTHS: Readonly<Record<string, readonly FaceMouth[]>> = {
  AH: ["ah"], AA: ["ah"], AE: ["ah"], EH: ["ee"], ER: ["slight"], IH: ["ee"], IY: ["ee"],
  OW: ["oh"], AO: ["oh"], UH: ["oo"], UW: ["oo"], AY: ["ah", "ee"], EY: ["ee"], AW: ["ah", "oo"], OY: ["oh", "ee"],
  M: ["mbp"], B: ["mbp"], P: ["mbp"], F: ["fv"], V: ["fv"], W: ["oo"], Y: ["ee"],
};
interface Sound { mouth: FaceMouth; weight: number }
const vowels = new Set<FaceMouth>(["ah", "ee", "oh", "oo"]);
function fallbackSounds(word: string): Sound[] {
  const out: Sound[] = [];
  const push = (mouth: FaceMouth, weight = 1) => out.push({ mouth, weight });
  for (let i = 0; i < word.length; i++) {
    const pair = word.slice(i, i + 2), letter = word[i]!;
    if (["ee", "ea", "ie", "ei"].includes(pair)) { push("ee"); i++; }
    else if (["oo", "ou", "ew", "ue"].includes(pair)) { push("oo"); i++; }
    else if (["oa", "ow"].includes(pair)) { push("oh"); i++; }
    else if (["ai", "ay"].includes(pair)) { push("ee"); i++; }
    else if (["ch", "sh", "th", "ng", "qu"].includes(pair)) { push(pair === "qu" ? "oo" : "slight", .55); i++; }
    else if (letter === "e" && i === word.length - 1 && word.length > 3) { /* usual silent final e */ }
    else if ("ae".includes(letter)) push(letter === "a" ? "ah" : "ee");
    else if ("iy".includes(letter)) push("ee");
    else if (letter === "o") push("oh");
    else if (letter === "u") push("oo");
    else if ("mbp".includes(letter)) push("mbp", .7);
    else if ("fv".includes(letter)) push("fv", .65);
    else if (letter === "w") push("oo", .65);
    else push("slight", .5);
  }
  return out;
}
function sentenceSounds(text: string): Sound[] {
  const digits = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const tokens = text.slice(0, 16000).toLowerCase().replace(/[’']/g, "").replace(/[0-9]/g, n => ` ${digits[Number(n)]} `).match(/[a-z]+|[.!?,;:—–-]/g) ?? [];
  const sounds: Sound[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (!/^[a-z]+$/.test(token)) { sounds.push({ mouth: "closed", weight: /[.!?]/.test(token) ? 1.5 : .75 }); continue; }
    const pronunciation = Object.prototype.hasOwnProperty.call(WORD_SOUNDS, token) ? WORD_SOUNDS[token] : undefined;
    const word = pronunciation ? pronunciation.split(" ").flatMap(p => (PHONEME_MOUTHS[p] ?? ["slight" as const]).map(mouth => ({ mouth, weight: vowels.has(mouth) ? 1 : mouth === "mbp" ? .7 : .55 }))) : fallbackSounds(token);
    sounds.push(...word);
    // A brief quiet gap between words, rather than a full punctuation pause.
    if (i + 1 < tokens.length && /^[a-z]+$/.test(tokens[i + 1]!)) sounds.push({ mouth: "closed", weight: .25 });
  }
  // Merge adjacent identical mouths and retain their combined duration weight.
  const merged: Sound[] = [];
  for (const sound of sounds) { const last = merged[merged.length - 1]; if (last?.mouth === sound.mouth) last.weight += sound.weight; else merged.push({ ...sound }); }
  return merged;
}
export function textToCompanionSounds(text: string): FaceMouth[] { return sentenceSounds(text).map(s => s.mouth); }
/** Approximate known text over the segment's actual duration. The local envelope can refine starts:
 * closures/punctuation choose nearby quiet samples, vowels nearby peaks. Ordering is preserved.
 */
export function liveCompanionTimeline(text: string, duration: number, envelope: readonly CompanionEnvelopePoint[] = []): SpeechTimeline {
  if (!validDuration(duration)) return { cues: [{ t: 0, mouth: "closed" }], gestures: [] };
  const sounds = sentenceSounds(text);
  if (!sounds.length) return { cues: [{ t: 0, mouth: "closed" }, { t: duration, mouth: "closed" }], gestures: [] };
  const points = envelope.filter(p => Number.isFinite(p.t) && p.t >= 0 && p.t <= duration && Number.isFinite(p.level)).slice(0, 20000).map(p => ({ t: p.t, level: Math.max(0, Math.min(1, p.level)) })).sort((a, b) => a.t - b.t);
  const total = sounds.reduce((sum, s) => sum + s.weight, 0), unit = duration / total;
  let elapsed = 0;
  const base = sounds.map(s => { const t = elapsed; elapsed += s.weight * unit; return t; });
  const cues: SpeechTimeline["cues"] = [];
  const epsilon = Math.min(.001, duration / (sounds.length + 2));
  for (let i = 0; i < sounds.length; i++) {
    const sound = sounds[i]!, t = base[i]!;
    const radius = Math.min(.08, duration * .04, (base[i + 1] ?? duration) - t);
    const quiet = sound.mouth === "closed" || sound.mouth === "mbp";
    let chosen = t, best = Infinity;
    if (i > 0 && radius > epsilon && (quiet || vowels.has(sound.mouth))) {
      const lower = Math.max(t - radius, (cues[cues.length - 1]?.t ?? -epsilon) + epsilon);
      const upper = Math.min(t + radius, (base[i + 1] ?? duration) - epsilon);
      let a = 0, b = points.length;
      while (a < b) { const mid = (a + b) >>> 1; if (points[mid]!.t < lower) a = mid + 1; else b = mid; }
      let finish = a, minimum = Infinity, maximum = -Infinity;
      while (finish < points.length && points[finish]!.t <= upper) {
        const level = points[finish++]!.level; minimum = Math.min(minimum, level); maximum = Math.max(maximum, level);
      }
      const spread = maximum - minimum;
      for (let j = a; j < finish; j++) {
        const p = points[j]!;
        // Real speech RMS is commonly a small fraction of1. Local normalization keeps
        // peaks/quiet gaps relevant instead of letting the distance penalty overwhelm them.
        const normalized = spread > 1e-6 ? (p.level - minimum) / spread : .5;
        const score = (quiet ? normalized : 1 - normalized) + .3 * Math.abs(p.t - t) / radius;
        if (score < best) { best = score; chosen = p.t; }
      }
    }
    chosen = Math.max(chosen, (cues[cues.length - 1]?.t ?? -epsilon) + epsilon);
    if (chosen < duration && cues[cues.length - 1]?.mouth !== sound.mouth) cues.push({ t: chosen, mouth: sound.mouth });
  }
  if (cues[cues.length - 1]?.mouth !== "closed") cues.push({ t: duration, mouth: "closed" });
  return { cues, gestures: [] };
}
/** Same openness thresholds and 20 Hz shape variety as the existing bird loudness method.
 * The renderer supplies its existing smoothed level; no text or phonetic alignment is claimed here.
 */
export function companionLoudnessMouth(level: number, audioTime: number): FaceMouth {
  const amplitude = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
  const syllable = Math.floor(Math.max(0, Number.isFinite(audioTime) ? audioTime : 0) * 20);
  const index = amplitude < .025 ? (syllable % 11 === 0 ? 7 : syllable % 7 === 0 ? 8 : 0)
    : amplitude < .15 ? (syllable % 3 === 0 ? 6 : 1)
    : amplitude < .42 ? [3, 4, 5][syllable % 3]! : [2, 4, 3][syllable % 3]!;
  return FACE_MOUTHS[index]!;
}
