/** Client-safe playback of generated bird frames. Time, randomness and amplitude are explicit for offline tests. */
import type { AvatarState, RigCue } from "./avatar-rig";
import type { Moment, WingGesture } from "./gestures";

export const BIRD_MOTION_CROSSFADE = 0.16;
export const BIRD_VISEMES = ["closed", "slight", "ah", "ee", "oh", "oo", "fv", "mbp", "smile"] as const;
export interface MotionBox { x: number; y: number; width: number; height: number }
export interface BirdMotionClip { frames: string[]; fps: number; loop?: [number, number]; hold?: number }
export interface BirdMotionFaceRef { manifest: string; totalBytes: number }
export interface BirdMotionManifest {
  version: 1; bird: string; size: { width: number; height: number }; anchor: { x: number; y: number }; bbox: MotionBox;
  neutral: string; totalBytes: number; uniqueFrames: number; visemes: string[];
  talking: { neutral: string; left: string; right: string };
  frames: Record<string, { src: string; bbox: MotionBox; sourceHash: string }>;
  clips: Record<string, BirdMotionClip>;
  /** Absent legacy packs retain their6MiB compressed ceiling. */
  packBudgetMiB?: number;
  face?: BirdMotionFaceRef;
  variant?: "face";
  /** Actual native crop, normalized to the registered full canvas (including pixel-flooring). */
  crop?: MotionBox;
  nativeCanvas?: { width: number; height: number };
}
export const BIRD_MOTION_CLIPS = ["idle_breathe", "blink", "look_left", "look_right", "look_up", "head_tilt", "nod", "talk_neutral", "talk_left", "talk_right", "wing_lift_left", "wing_lift_right", "wave", "present", "point", "welcome", "shift_weight", "lift_foot", "turn_body_left", "turn_body_right"] as const;

export const BIRD_EXPRESSIONS = ["happy", "laugh", "surprised", "thinking", "concerned", "sad", "proud", "curious", "sorry"] as const;
export type BirdExpression = typeof BIRD_EXPRESSIONS[number];
export const BIRD_FACE_ANGLES = ["front", "left", "right"] as const;
export type BirdFaceAngle = typeof BIRD_FACE_ANGLES[number];
export const BIRD_DANCE_CLIPS = ["dance_bounce", "dance_shimmy"] as const;
/** Additive companion clips: legacy packs may omit every one of these. */
export const COMPANION_MOTION_CLIPS = ["lean_in", "work_loop", "look_down", "one_moment", "invite", "hold", "point_left", "point_right", "emphasis", "shrug", "thank_you", "count", "celebrate"] as const;
export const BIRD_OPTIONAL_MOTION_CLIPS = [...COMPANION_MOTION_CLIPS, "wave_both", ...BIRD_EXPRESSIONS.flatMap((expression) => BIRD_FACE_ANGLES.map((angle) => `expr_${expression}_${angle}`)), ...BIRD_DANCE_CLIPS];
/** Closest legacy pose when a companion pack has not supplied a new clip yet. */
export const COMPANION_CLIP_FALLBACKS: Readonly<Record<string, string>> = {
  lean_in: "head_tilt", work_loop: "idle_breathe", look_down: "look_up", one_moment: "welcome",
  invite: "welcome", hold: "idle_breathe", point_left: "point", point_right: "point", emphasis: "nod",
  shrug: "present", thank_you: "welcome", count: "point", celebrate: "wave_both", wave_both: "welcome",
};
/** Resolve UI clip hints safely; unknown hints use a nod, and undecoded clips use their legacy fallback. */
export function resolveCompanionClip(manifest: BirdMotionManifest, name: string, ready: (clip: string) => boolean = () => true): string {
  let clip = name;
  for (let i = 0; i < 4; i++) {
    if (Object.prototype.hasOwnProperty.call(manifest.clips, clip) && ready(clip)) return clip;
    clip = Object.prototype.hasOwnProperty.call(COMPANION_CLIP_FALLBACKS, clip) ? COMPANION_CLIP_FALLBACKS[clip]! : "nod";
  }
  return "idle_breathe";
}
const OPTIONAL_CLIPS = new Set<string>(BIRD_OPTIONAL_MOTION_CLIPS);
/** Optional clips (two-wing wave, expressions, dances) may decode on demand; every other clip is part of the standard pack. */
export const isOptionalMotionClip = (name: string): boolean => OPTIONAL_CLIPS.has(name);
/** Standard clips the bird uses all the time: idle, blink, speech, listening, thinking and the cues. */
export const BIRD_MOTION_CORE_CLIPS = ["idle_breathe", "blink", "talk_neutral", "talk_left", "talk_right", "look_left", "look_right", "look_up", "head_tilt", "nod"] as const;
/** The rest of the standard clips, most visible first: event gestures, then idle filler. */
export const BIRD_MOTION_GESTURE_CLIPS = ["welcome", "wave", "present", "point"] as const;
export const BIRD_MOTION_IDLE_CLIPS = ["wing_lift_left", "wing_lift_right", "shift_weight", "lift_foot", "turn_body_left", "turn_body_right"] as const;
/** Active seconds a moment or gesture may wait for its clips to decode before the existing fallback plays. */
export const BIRD_MOTION_DECODE_GRACE = 0.6;
/** Which clips are drawable now. Without one, every clip in the manifest is. */
export interface BirdMotionClipSource {
  ready(clip: string): boolean;
  /** Ask for clips a moment needs. True when each one is ready or now decoding (worth a short wait). */
  request(clips: readonly string[]): boolean;
  /** Fetch clips a moment might use, only into free room: never releases anything and does not count as use. */
  prefetch?(clips: readonly string[]): void;
}
export const MOTION_MOMENTS: Record<Moment, { expressions: readonly BirdExpression[]; gesture: string }> = {
  congrats: { expressions: ["happy", "laugh"], gesture: "wave_both" },
  thanks: { expressions: ["happy"], gesture: "present" },
  greeting: { expressions: ["happy"], gesture: "wave" },
  goodbye: { expressions: ["happy"], gesture: "wave" },
  question: { expressions: ["thinking"], gesture: "look_up" },
  idea: { expressions: ["surprised", "happy"], gesture: "point" },
  instruction: { expressions: ["curious"], gesture: "nod" },
  bad_news: { expressions: ["concerned"], gesture: "welcome" },
  frustration: { expressions: ["sorry", "concerned"], gesture: "welcome" },
  small_talk: { expressions: ["happy"], gesture: "present" },
};
type ReactionStep = { clip: string; expression?: BirdExpression; dance?: boolean; seconds: number; held?: boolean };
type Reaction = { moment: Moment; angle: BirdFaceAngle; steps: ReactionStep[]; index: number; elapsed: number; danced: boolean; congratulation: number | null };

/** One live call owns this bounded history, shared by every full/mini avatar and pack reload.
 * The clock measures elapsed wall time (including hidden/paused time), independently of rig playback.
 * Callers can inject a monotonic seconds clock for tests; no event list or image references are retained.
 */
export class BirdMotionLedger {
  private events = { moment: -Infinity, gesture: -Infinity, cue: -Infinity };
  private congratulations = 0;
  private readonly danceOffset: number;
  private lastDance = -Infinity;
  private lastDancedCongratulations = -Infinity;
  private danceVariant = 0;
  private clockTime = 0;
  private readonly now: () => number;
  constructor(options: { seed?: number; now?: () => number } = {}) {
    this.danceOffset = ((options.seed ?? 1) >>> 0 || 1) % 3;
    this.now = options.now ?? (() => performance.now() / 1000);
  }
  /** Session event numbers increase; a high-water mark also rejects an older event after remount. */
  claim(event: keyof BirdMotionLedger["events"], at: number): boolean {
    if (!Number.isFinite(at) || at <= this.events[event]) return false;
    this.events[event] = at;
    return true;
  }
  private clock(): number {
    let value = this.clockTime;
    try { value = this.now(); } catch { /* An unavailable clock must not bypass the cooldown. */ }
    if (Number.isFinite(value)) this.clockTime = Math.max(this.clockTime, value);
    return this.clockTime;
  }
  private eligible(index: number): boolean {
    return index === this.congratulations - 1 && index > this.lastDancedCongratulations + 1 && this.clock() - this.lastDance >= 60;
  }
  congratulation(): number | null {
    const index = this.congratulations++;
    return (index + this.danceOffset) % 3 === 0 && this.eligible(index) ? index : null;
  }
  nextDance(count: number): number { return this.danceVariant++ % count; }
  /** Whether the next congratulation would dance, and with which variant, without counting it (to fetch the dance early). */
  danceDue(): boolean { const index = this.congratulations; return (index + this.danceOffset) % 3 === 0 && index > this.lastDancedCongratulations + 1 && this.clock() - this.lastDance >= 60; }
  peekDance(count: number): number { return this.danceVariant % count; }
  /** Reserve at actual playback, not when queued: another avatar may have danced in the meantime. */
  startDance(index: number): boolean {
    if (!this.eligible(index)) return false;
    this.lastDance = this.clock();
    this.lastDancedCongratulations = index;
    return true;
  }
}

/** Reject incomplete or unsafe manifests instead of presenting a partial pack as finished art. */
export function parseBirdMotionManifest(raw: unknown): BirdMotionManifest {
  const m = raw as BirdMotionManifest;
  const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  const box = (b: MotionBox | undefined) => b && [b.x, b.y, b.width, b.height].every(finite) && b.width > 0 && b.height > 0;
  if (!m || m.version !== 1 || typeof m.bird !== "string" || !m.size || !finite(m.size.width) || !finite(m.size.height) || m.size.width < 1 || m.size.height < 1 || !m.anchor || !finite(m.anchor.x) || !finite(m.anchor.y) || !box(m.bbox) || !m.frames || !m.clips || !m.frames[m.neutral] || !finite(m.totalBytes) || m.totalBytes <= 0 || m.uniqueFrames !== Object.keys(m.frames).length) throw new Error("Incomplete bird motion pack");
  const budget = m.packBudgetMiB ?? 6;
  if (!Number.isInteger(budget) || budget < 6 || budget > 8 || m.totalBytes > budget * 1024 * 1024) throw new Error("Bird motion pack exceeds download budget");
  if (m.variant !== undefined && m.variant !== "face") throw new Error("Invalid bird motion variant");
  if (m.crop && (!box(m.crop) || m.crop.x < 0 || m.crop.y < 0 || m.crop.x + m.crop.width > 1 || m.crop.y + m.crop.height > 1)) throw new Error("Invalid native Face crop");
  if (m.nativeCanvas && (![m.nativeCanvas.width, m.nativeCanvas.height].every(finite) || m.nativeCanvas.width < 1 || m.nativeCanvas.height < 1)) throw new Error("Invalid native Face canvas");
  if (m.variant === "face" ? !m.crop || !m.nativeCanvas || Math.abs(m.crop.width * m.nativeCanvas.width - m.size.width) > 1e-6 || Math.abs(m.crop.height * m.nativeCanvas.height - m.size.height) > 1e-6 : m.crop !== undefined || m.nativeCanvas !== undefined) throw new Error("Face crop does not match native source pixels");
  if (m.face && (typeof m.face.manifest !== "string" || !/^[a-zA-Z0-9_./-]+\.json$/.test(m.face.manifest) || m.face.manifest.startsWith("/") || m.face.manifest.split("/").includes("..") || !finite(m.face.totalBytes) || m.face.totalBytes <= 0)) throw new Error("Invalid bird Face pack reference");
  for (const frame of Object.values(m.frames)) {
    if (!frame || typeof frame.src !== "string" || !/^[a-zA-Z0-9_./-]+\.webp$/.test(frame.src) || frame.src.startsWith("/") || frame.src.split("/").includes("..") || !box(frame.bbox) || typeof frame.sourceHash !== "string" || !frame.sourceHash) throw new Error("Invalid bird motion frame");
  }
  const allowed = new Set<string>([...BIRD_MOTION_CLIPS, ...BIRD_OPTIONAL_MOTION_CLIPS]);
  for (const name of BIRD_MOTION_CLIPS) if (!m.clips[name]) throw new Error(`Invalid bird motion clip: ${name}`);
  for (const name of Object.keys(m.clips)) {
    if (!allowed.has(name)) throw new Error(`Unknown bird motion clip: ${name}`);
    const c = m.clips[name];
    if (!c || !Array.isArray(c.frames) || !c.frames.length || c.frames.some((id) => !m.frames[id]) || !finite(c.fps) || c.fps <= 0 || c.fps > 60 || (c.loop && (!Array.isArray(c.loop) || c.loop.length !== 2 || !c.loop.every(Number.isInteger) || c.loop[0] < 0 || c.loop[1] > c.frames.length || c.loop[0] >= c.loop[1])) || (c.hold !== undefined && (!Number.isInteger(c.hold) || c.hold < 0 || c.hold >= c.frames.length))) throw new Error(`Invalid bird motion clip: ${name}`);
  }
  if (!Array.isArray(m.visemes) || BIRD_VISEMES.some((v, i) => m.visemes[i] !== v) || !m.talking || [m.talking.neutral, m.talking.left, m.talking.right].some((name) => !m.clips[name] || m.clips[name]!.frames.length !== BIRD_VISEMES.length)) throw new Error("Invalid bird talking shapes");
  return m;
}

export interface BirdMotionPose { clip: string; frame: string; previousFrame: string | null; opacity: number; level: number; expression: BirdExpression | null; angle: BirdFaceAngle; dancing: boolean; moment: Moment | null }
export const MOTION_GESTURES: Record<Exclude<WingGesture, "none">, string> = {
  wave: "wave", celebrate: "wave_both", think: "look_up", shrug: "present", point: "point", salute: "nod", open: "present", comfort: "welcome",
};

export class BirdMotionRig {
  reduced: boolean;
  private random: number;
  private time = 0;
  private state: AvatarState | null = null;
  private clip = "idle_breathe";
  private started = 0;
  private priority = 0;
  private previousFrame: string | null = null;
  private changed = -1;
  private currentFrame: string;
  private smooth = 0;
  private displayedClip = "idle_breathe";
  private facing: BirdFaceAngle = "front";
  private reaction: Reaction | null = null;
  /** `since`/`loading` are set while the moment waits (at most BIRD_MOTION_DECODE_GRACE) for its first clips to decode. */
  private pendingMoment: { kind: Moment; eventGesture?: WingGesture; since?: number; loading?: boolean } | null | undefined;
  private readonly ledger: BirdMotionLedger;
  private readonly source: BirdMotionClipSource | undefined;
  private blinkAt = 0;
  private actionAt = 0;
  private poseAt = 0;
  private talkPose: "neutral" | "left" | "right" = "neutral";
  private nextTalkPose: "left" | "right" = "left";
  private pending: { clip: string; priority: number; since?: number; loading?: boolean } | null = null;
  constructor(readonly manifest: BirdMotionManifest, options: { seed?: number; reduced?: boolean; ledger?: BirdMotionLedger; clips?: BirdMotionClipSource } = {}) {
    this.random = (options.seed ?? 1) >>> 0 || 1;
    this.reduced = options.reduced ?? false;
    this.ledger = options.ledger ?? new BirdMotionLedger({ seed: this.random, now: () => this.time });
    this.source = options.clips;
    this.currentFrame = manifest.neutral;
    this.blinkAt = this.between(3, 6);
    this.actionAt = this.between(7, 12);
  }
  /** In the manifest and decoded. A clip that is not ready is treated exactly like one the pack lacks. */
  private has(name: string): boolean { return !!this.manifest.clips[name] && (!this.source || this.source.ready(name)); }
  private want(names: readonly string[]): boolean {
    const present = names.filter((name) => !!this.manifest.clips[name]);
    return !this.source || !present.length || this.source.request(present);
  }
  private danceAskAt = 0;
  private between(min: number, max: number): number {
    this.random = (Math.imul(this.random, 1664525) + 1013904223) >>> 0;
    return min + this.random / 4294967296 * (max - min);
  }
  /** A classified local reaction; null clears it when the caller takes the floor. */
  moment(kind: Moment | null, eventGesture?: WingGesture, at?: number): void {
    if (kind !== null && at !== undefined) {
      // The matching gesture belongs to this same consumed event, including a replay on another mount.
      if (eventGesture !== undefined) this.ledger.claim("gesture", at);
      if (!this.ledger.claim("moment", at)) return;
    }
    this.pendingMoment = kind === null ? null : { kind, eventGesture };
  }
  /** Manifest fallback only (older packs); a decoded-readiness fallback happens when the gesture would play. */
  private resolvedGesture(name: string): string { return name === "wave_both" && !this.manifest.clips.wave_both ? "welcome" : name; }
  private readyGesture(name: string): string { return name === "wave_both" && !this.has("wave_both") ? "welcome" : name; }
  /** The clips a moment shows first (its beat at the current angle, or the legacy gesture), and the rest it may use. */
  private momentClips(kind: Moment, eventGesture?: WingGesture): { first: string[]; rest: string[] } {
    const mapping = MOTION_MOMENTS[kind];
    const first = mapping.expressions.map((expression) => `expr_${expression}_${this.facing}`).filter((name) => !!this.manifest.clips[name]);
    if (!first.length) {
      const fallback = eventGesture === undefined ? this.resolvedGesture(mapping.gesture) : eventGesture === "none" ? null : this.resolvedGesture(MOTION_GESTURES[eventGesture]);
      return { first: fallback ? [fallback] : [], rest: [] };
    }
    // Speech can turn the head mid-reaction, so the other angles are fetched too, into free room only (never waited for).
    const rest = mapping.expressions.flatMap((expression) => BIRD_FACE_ANGLES.map((angle) => `expr_${expression}_${angle}`)).filter((name) => !first.includes(name) && !!this.manifest.clips[name]);
    return { first: [...first, this.resolvedGesture(mapping.gesture)], rest };
  }
  /** Begin at once when the first clips are drawable; otherwise wait briefly while they decode, then use the existing fallback. */
  private momentReady(pending: { kind: Moment; eventGesture?: WingGesture; since?: number; loading?: boolean }): boolean {
    if (!this.source) return true;
    const { first, rest } = this.momentClips(pending.kind, pending.eventGesture);
    if (pending.since === undefined) {
      pending.since = this.time;
      // Order sets priority: the first beat, then a due dance (it plays seconds later), then spare angles in the background.
      pending.loading = this.want(first);
      const dances = BIRD_DANCE_CLIPS.filter((name) => !!this.manifest.clips[name]);
      if (pending.kind === "congrats" && !this.reduced && dances.length && this.ledger.danceDue()) this.want([dances[this.ledger.peekDance(dances.length)]!]);
      if (rest.length) this.source.prefetch?.(rest);
    }
    return first.every((name) => this.has(name)) || !pending.loading || this.time - pending.since >= BIRD_MOTION_DECODE_GRACE;
  }
  private beginMoment(kind: Moment, eventGesture?: WingGesture, since?: number): void {
    const mapping = MOTION_MOMENTS[kind];
    const angle = this.facing;
    const expressions = mapping.expressions.filter((expression) => this.has(`expr_${expression}_${angle}`));
    const gesture = this.readyGesture(mapping.gesture);
    const congratulation = kind === "congrats" ? this.ledger.congratulation() : null;
    if (!expressions.length) {
      this.reaction = null;
      const fallback = eventGesture === undefined ? gesture : eventGesture === "none" ? null : this.readyGesture(MOTION_GESTURES[eventGesture]);
      // A moment that already waited for this gesture shares the same grace, rather than waiting twice.
      if (!this.reduced && fallback) this.pending = { clip: fallback, priority: 3, ...(since === undefined ? {} : { since, loading: true }) };
      return;
    }
    const steps: ReactionStep[] = [];
    const add = (expression: BirdExpression, held = false) => {
      const clip = `expr_${expression}_${angle}`, c = this.manifest.clips[clip]!;
      steps.push({ clip, expression, seconds: held ? 8 : Math.max(0.65, c.frames.length / c.fps + 0.35), held });
    };
    add(expressions[0]!);
    const action = this.has(gesture) ? this.manifest.clips[gesture] : undefined;
    if (action) steps.push({ clip: gesture, seconds: action.frames.length / action.fps });
    if (expressions.length > 1) add(expressions[1]!);
    if (congratulation !== null) {
      const dances = BIRD_DANCE_CLIPS.filter((name) => !!this.manifest.clips[name]);
      if (dances.length) {
        const clip = dances[this.ledger.nextDance(dances.length)]!, c = this.manifest.clips[clip]!;
        steps.push({ clip, dance: true, seconds: Math.min(3.2, c.frames.length / c.fps * 2) });
        // Only a congratulation that will dance fetches a dance; it plays seconds later, after the beats above.
        this.want([clip]);
      }
    }
    add(expressions.at(-1)!, true);
    this.pending = null;
    this.reaction = { moment: kind, angle, steps, index: 0, elapsed: 0, danced: false, congratulation };
  }
  private reactionPose(dt: number, speaking: boolean): { clip: string; frame: string; expression: BirdExpression | null; dancing: boolean } | null {
    const r = this.reaction;
    if (!r) return null;
    r.angle = this.facing;
    if (this.reduced) {
      // Hold the genuine key, skipping neutral/bridge, the laugh alternate and every body movement.
      const held = r.steps.findLast((step) => step.expression)!;
      const clip = `expr_${held.expression}_${r.angle}`, c = this.has(clip) ? this.manifest.clips[clip] : undefined;
      if (!c) return null;
      return { clip, frame: c.frames[c.hold ?? c.frames.length - 1]!, expression: held.expression!, dancing: false };
    }
    if (speaking) return null; // Reaction clocks freeze during voice playback; visemes keep the beak authoritative.
    r.elapsed += dt;
    while (r.index < r.steps.length && r.elapsed >= r.steps[r.index]!.seconds) {
      r.elapsed -= r.steps[r.index]!.seconds; r.index++;
    }
    const step = r.steps[r.index];
    if (!step) { this.reaction = null; return null; }
    if (step.dance && !r.danced) {
      // An undecoded dance is skipped without spending the shared minute guard.
      if (r.congratulation === null || !this.has(step.clip) || !this.ledger.startDance(r.congratulation)) { r.index++; r.elapsed = 0; return this.reactionPose(0, false); }
      r.danced = true;
    }
    const clip = step.expression ? `expr_${step.expression}_${r.angle}` : step.clip;
    const c = this.has(clip) ? this.manifest.clips[clip] : undefined;
    if (!c) { r.index++; r.elapsed = 0; return this.reactionPose(0, false); }
    let index = step.held ? c.hold ?? c.frames.length - 1 : Math.floor(r.elapsed * c.fps + 1e-7);
    if (c.loop && index >= c.loop[1] && !step.held) index = c.loop[0] + (index - c.loop[0]) % (c.loop[1] - c.loop[0]);
    else index = Math.min(index, c.frames.length - 1);
    return { clip, frame: c.frames[index]!, expression: step.expression ?? null, dancing: !!step.dance };
  }
  cue(kind: RigCue, id?: number): void {
    if (id !== undefined && !this.ledger.claim("cue", id)) return;
    if (this.reduced || this.priority >= 3 || (this.pending?.priority ?? 0) >= 3) return;
    this.pending = { clip: kind === "shake" ? "look_right" : kind === "perk" ? "look_up" : "nod", priority: 2 };
  }
  gesture(kind: WingGesture, at?: number): void {
    if (at !== undefined && !this.ledger.claim("gesture", at)) return;
    if (this.reduced || kind === "none") return;
    this.reaction = null; this.pendingMoment = undefined;
    const clip = this.resolvedGesture(MOTION_GESTURES[kind]);
    this.pending = { clip, priority: 3 };
  }
  /** Explicit companion gesture hint; fetching/decoding remains owned by the host. Unknown hints never throw. */
  gestureClip(name: string, at?: number): void {
    if (at !== undefined && !this.ledger.claim("gesture", at)) return;
    if (this.reduced) return;
    this.reaction = null; this.pendingMoment = undefined;
    const clip = Object.prototype.hasOwnProperty.call(this.manifest.clips, name) ? name : resolveCompanionClip(this.manifest, name);
    this.pending = { clip, priority: 3 };
  }
  private select(clip: string, priority = 0): void {
    if (clip === this.clip && priority === this.priority) return;
    this.clip = clip;
    this.started = this.time;
    this.priority = priority;
  }
  private base(state: AvatarState): string {
    return this.reduced ? "idle_breathe" : state === "speaking" ? this.manifest.talking[this.talkPose] : state === "listening" ? "head_tilt" : "idle_breathe";
  }
  /** dt is elapsed active time, in seconds. The host stops calling this while hidden/paused. */
  step(dt: number, input: { state: AvatarState; level?: number; speechPaused?: boolean }): BirdMotionPose {
    const elapsed = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.25)) : 0;
    this.time += elapsed;
    if (this.pendingMoment === null) { this.reaction = null; this.pendingMoment = undefined; }
    else if (this.pendingMoment && this.momentReady(this.pendingMoment)) {
      const pending = this.pendingMoment;
      this.pendingMoment = undefined;
      this.beginMoment(pending.kind, pending.eventGesture, pending.since);
    }
    const state = this.reduced ? "idle" : input.speechPaused && input.state === "speaking" ? "thinking" : input.state;
    const raw = Number.isFinite(input.level) ? Math.max(0, Math.min(1, input.level ?? 0)) : 0;
    this.smooth += ((state === "speaking" ? raw : 0) - this.smooth) * (1 - Math.exp(-elapsed / 0.055));
    if (this.reduced) {
      this.pending = null;
      if (!["idle_breathe", "blink"].includes(this.clip)) this.select("idle_breathe");
      // A just-interrupted gesture must not linger in the crossfade after the preference changes.
      this.previousFrame = null;
      this.changed = -1;
    }
    if (state !== this.state) {
      this.state = state;
      this.talkPose = "neutral";
      this.poseAt = this.time + this.between(2.6, 4.2);
      this.actionAt = this.time + this.between(state === "idle" ? 7 : 3.5, state === "idle" ? 12 : 6);
      if (this.priority < 2) this.select(state === "thinking" ? "look_up" : this.base(state), state === "thinking" ? 1 : 0);
    }
    // A clip released while this tile was paused returns to the always-decoded base pose instead of drawing a missing frame.
    if (!this.has(this.clip)) this.select(this.base(state));
    const active = this.manifest.clips[this.clip]!;
    const complete = (!active.loop || this.priority >= 2) && !(this.clip === "head_tilt" && this.priority === 0 && state === "listening") && !(state === "speaking" && this.priority === 0) && this.time - this.started >= active.frames.length / active.fps;
    if (complete) this.select(this.base(state));
    if (this.pending && !this.has(this.pending.clip)) {
      // Keep playing the current clip while the gesture decodes; after the grace, use the existing fallback or skip it.
      const pending = this.pending;
      if (pending.since === undefined) { pending.since = this.time; pending.loading = this.want([pending.clip]); }
      if (!pending.loading || this.time - pending.since >= BIRD_MOTION_DECODE_GRACE) {
        const fallback = Object.prototype.hasOwnProperty.call(COMPANION_CLIP_FALLBACKS, pending.clip) ? resolveCompanionClip(this.manifest, pending.clip, (clip) => this.has(clip)) : null;
        if (fallback) pending.clip = fallback; else this.pending = null;
      }
    }
    if (this.pending && this.has(this.pending.clip)) {
      const pending = this.pending;
      this.pending = null;
      if (pending.priority >= this.priority) {
        // Repeated explicit actions restart after their new cue even when the clip name is unchanged.
        if (pending.clip === this.clip) this.started = this.time;
        this.select(pending.clip, pending.priority);
      }
    }
    if (this.priority === 0) {
      if (this.time >= this.blinkAt && state !== "speaking") {
        this.blinkAt = this.time + this.between(3, 6);
        this.select("blink", 1);
      } else if (!this.reduced && state === "speaking" && this.time >= this.poseAt) {
        this.poseAt = this.time + this.between(2.6, 4.2);
        this.talkPose = this.talkPose === "neutral" ? this.nextTalkPose : "neutral";
        if (this.talkPose !== "neutral") this.nextTalkPose = this.talkPose === "left" ? "right" : "left";
        this.select(this.base(state));
      } else if (!this.reduced && state !== "speaking" && this.time >= this.actionAt) {
        this.actionAt = this.time + this.between(state === "idle" ? 7 : 3.5, state === "idle" ? 12 : 6);
        const actions = state === "listening" ? ["nod"] : state === "thinking" ? ["look_up", "look_left", "look_right"] : ["look_left", "look_right", "shift_weight", "lift_foot", "turn_body_left", "turn_body_right", "wing_lift_left", "wing_lift_right"];
        const pick = Math.floor(this.between(0, actions.length));
        if (this.has(actions[pick]!)) this.select(actions[pick]!, 1);
        else {
          // Idle filler never waits: fetch the chosen clip for next time and play a decoded one now.
          this.want([actions[pick]!]);
          const ready = actions.filter((name) => this.has(name));
          if (ready.length) this.select(ready[pick % ready.length]!, 1);
        }
      }
    }
    // A reply's ordinary nod/perk may arrive with its first word. Reactions yield fully to speech, including that cue.
    // Independent explicit gestures clear the reaction first and retain the legacy priority rules.
    const reactionSpeaking = !!this.reaction && state === "speaking";
    const playbackClip = reactionSpeaking ? this.manifest.talking[this.talkPose] : this.clip;
    const c = this.manifest.clips[playbackClip]!;
    let index = Math.floor((this.time - this.started) * c.fps + 1e-7);
    if (state === "speaking" && (this.priority === 0 || reactionSpeaking)) {
      // Amplitude supplies openness, a 20 Hz syllable clock varies the shape within that opening. No speech decoding is implied.
      const syllable = Math.floor(this.time * c.fps);
      index = this.smooth < 0.025 ? (syllable % 11 === 0 ? 7 : syllable % 7 === 0 ? 8 : 0)
        : this.smooth < 0.15 ? (syllable % 3 === 0 ? 6 : 1)
        : this.smooth < 0.42 ? [3, 4, 5][syllable % 3]! : [2, 4, 3][syllable % 3]!;
    } else if (c.loop && index >= c.loop[1]) index = c.loop[0] + (index - c.loop[0]) % (c.loop[1] - c.loop[0]);
    else if (c.hold !== undefined && this.clip === "head_tilt" && state === "listening" && this.priority === 0) index = Math.min(index, c.hold);
    index = Math.min(index, c.frames.length - 1);
    // A due dance that could not fit yet (another clip still on screen, a decode in flight) is asked for again until it plays.
    const r = this.reaction;
    if (r && !r.danced && !this.reduced && this.time >= this.danceAskAt) {
      for (let i = r.index; i < r.steps.length; i++) {
        const step = r.steps[i]!;
        if (step.dance && !this.has(step.clip)) { this.danceAskAt = this.time + 0.25; this.want([step.clip]); break; }
      }
    }
    const reaction = this.reactionPose(elapsed, state === "speaking");
    const outputClip = reaction?.clip ?? playbackClip;
    const frame = reaction?.frame ?? c.frames[index]!;
    if (!reaction?.expression) {
      if (outputClip === this.manifest.talking.left || outputClip === "look_left" || outputClip === "turn_body_left") this.facing = "left";
      else if (outputClip === this.manifest.talking.right || outputClip === "look_right" || outputClip === "turn_body_right") this.facing = "right";
      else this.facing = "front";
    }
    if (outputClip !== this.displayedClip) {
      this.displayedClip = outputClip; this.previousFrame = this.currentFrame; this.changed = this.time;
    }
    if (this.reduced) { this.previousFrame = null; this.changed = -1; }
    this.currentFrame = frame;
    const opacity = Math.min(1, Math.max(0, (this.time - this.changed) / BIRD_MOTION_CROSSFADE));
    if (opacity === 1) this.previousFrame = null;
    return { clip: outputClip, frame: this.currentFrame, previousFrame: this.previousFrame, opacity, level: this.reduced ? 0 : this.smooth, expression: reaction?.expression ?? null, angle: reaction ? this.reaction!.angle : this.facing, dancing: reaction?.dancing ?? false, moment: this.reaction?.moment ?? null };
  }
}
