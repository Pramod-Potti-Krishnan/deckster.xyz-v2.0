/** Ported from Garud feature/companion-v2-player b3a812e (packages/core/src/voice/companion-compositor.ts), unchanged except where marked "Deckster:". Pure: no React, no DOM. */
/** Pure layered companion scene selection. All clocks are supplied by the host. */
// Deckster: types come from ELEMENT-3's core (lib/studio/voice). Its v1 manifest types `face` as the native Face pointer only and has no CompanionState,
// so the manifest here is the v1 shape with `face` left open (isCompanionFace decides), and a state is any name (unknown names map to no expression).
import type { AvatarState } from "../voice/avatar-rig";
import type { BirdMotionClip, BirdMotionManifest as V1Manifest } from "../voice/bird-motion";
type CompanionState = string;
export type BirdMotionManifest = Omit<V1Manifest, "face"> & { face?: unknown };
import { isCompanionFace, type CompanionFace, type FaceExpression, type FaceHead, type FaceMouth, type FacePatch, type FaceRecipe, type SpeechTimeline } from "./companion-face";

export const COMPANION_GESTURE_EASE = .12;
export const COMPANION_BREATH_PERIOD = 4.5;
export const COMPANION_BREATH_RISE = .008;
export const COMPANION_BLINK_PERIOD = 4.6;
export interface CompanionCompositionMouth { mouth: FaceMouth; previousMouth?: FaceMouth; mouthMix?: number }
export interface CompanionGesture { clip: string; startedAt: number; holdSeconds?: number }
export interface CompanionFaceLayer {
  kind: "mouth" | "eyes" | "brows";
  src: string;
  patch: FacePatch;
  opacity: number;
  /** Extra soft-mask edge width in head-space pixels, in addition to the authored alpha. */
  feather: number;
}
export interface CompanionBodyScene {
  frame: string;
  opacity: number;
  /** Includes the bounded drift. Translate, rotate clockwise, scale, then draw each patch. */
  head: FaceHead;
  layers: CompanionFaceLayer[];
}
export interface CompanionComposition {
  /** Composite each full body+face scene before applying its opacity. */
  bodies: CompanionBodyScene[];
  /** Apply to both body and patches, independently of mouth/loudness. Nonpositive pack pixels. */
  breathY: number;
  headDrift: { x: number; y: number };
  gestureActive: boolean;
}
export interface CompanionCompositionInput {
  manifest: BirdMotionManifest;
  /** A held neutral-faced body frame. Legacy talk/blink/breath/shift frames are refused. */
  bodyFrame: string;
  /** Current audio segment seconds. May pause or seek backward. */
  time: number;
  /** Optional independent active-seconds clock for blink, breathing and tiny head life. */
  motionTime?: number;
  state?: AvatarState | CompanionState;
  expression?: FaceExpression | "neutral";
  mouth: CompanionCompositionMouth;
  timeline?: SpeechTimeline;
  /** Explicit cue overrides the latest eligible timeline cue. */
  gesture?: CompanionGesture;
  reduced?: boolean;
}
const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
const smooth = (v: number) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const clock = (v: number | undefined) => typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;
const implicitRecipe: FaceRecipe = { brows: "neutral", eyes: "open", mouthSet: "plain" };
/** The shoulder rise never exceeds 0.8% of the canvas and has no speech input. */
export function companionBreathY(seconds: number, height: number): number {
  const h = Number.isFinite(height) ? Math.max(0, height) : 0;
  return -h * COMPANION_BREATH_RISE * (1 - Math.cos(clock(seconds) * 2 * Math.PI / COMPANION_BREATH_PERIOD)) / 2 || 0;
}
export function companionHeadDrift(seconds: number): { x: number; y: number } {
  const t = clock(seconds);
  return { x: .9 * Math.sin(t * 2 * Math.PI / 8), y: .6 * Math.sin(t * 2 * Math.PI / 11) };
}
/** Eyelids replace the eye patch; body frames are never used to blink. */
export function companionBlink(seconds: number): "open" | "half" | "closed" {
  const t = clock(seconds);
  if (t < 3.8) return "open";
  const phase = (t - 3.8) % COMPANION_BLINK_PERIOD;
  return phase < .055 ? "half" : phase < .125 ? "closed" : phase < .2 ? "half" : "open";
}
const forbiddenClip = (name: string) => name === "shift_weight" || name === "idle_breathe" || name === "blink" || name.startsWith("talk_") || name.startsWith("expr_");
function safeHeldFrame(m: BirdMotionManifest, frame: string): string {
  if (frame === m.neutral) return frame;
  if (!m.frames[frame] || Object.entries(m.clips).some(([name, c]) => forbiddenClip(name) && c.frames.includes(frame))) return m.neutral;
  return frame;
}
function validGesture(m: BirdMotionManifest, cue: CompanionGesture | undefined): cue is CompanionGesture {
  return !!cue && Number.isFinite(cue.startedAt) && cue.startedAt >= 0 && !forbiddenClip(cue.clip) && !!m.clips[cue.clip] && !!m.clips[cue.clip]!.frames.length;
}
function gestureDuration(clip: BirdMotionClip, hold: number): number { return COMPANION_GESTURE_EASE * 2 + clip.frames.length / clip.fps + hold; }
function holdSeconds(cue: CompanionGesture): number { return Number.isFinite(cue.holdSeconds) ? clamp(cue.holdSeconds!, 0, 10) : .6; }
function currentGesture(input: CompanionCompositionInput, time: number): CompanionGesture | undefined {
  if (input.gesture) return validGesture(input.manifest, input.gesture) ? input.gesture : undefined;
  const cues = input.timeline?.gestures ?? [];
  // The latest valid cue wins, including when seeking backward into a prior gesture.
  for (let i = cues.length - 1; i >= 0; i--) {
    const g = cues[i]!;
    const candidate = { clip: g.clip, startedAt: g.t };
    if (candidate.startedAt <= time && validGesture(input.manifest, candidate)) return candidate;
  }
  return undefined;
}
interface WeightedFrame { frame: string; opacity: number }
function mixFrames(a: string, b: string, mix: number): WeightedFrame[] {
  if (a === b) return [{ frame: a, opacity: 1 }];
  if (mix <= 0) return [{ frame: a, opacity: 1 }];
  if (mix >= 1) return [{ frame: b, opacity: 1 }];
  return [{ frame: a, opacity: 1 - mix }, { frame: b, opacity: mix }];
}
function gestureFrames(base: string, clip: BirdMotionClip, elapsed: number, hold: number): WeightedFrame[] {
  const ease = COMPANION_GESTURE_EASE;
  if (elapsed < ease) return mixFrames(base, clip.frames[0]!, smooth(elapsed / ease));
  const duration = gestureDuration(clip, hold), exitAt = duration - ease;
  if (elapsed >= exitAt) return mixFrames(clip.frames.at(-1)!, base, smooth((elapsed - exitAt) / ease));
  let t = elapsed - ease;
  const slot = 1 / clip.fps, holdIndex = clip.hold ?? clip.frames.length - 1, holdAt = (holdIndex + 1) * slot;
  if (t >= holdAt && t < holdAt + hold) return [{ frame: clip.frames[holdIndex]!, opacity: 1 }];
  if (t >= holdAt + hold) t -= hold;
  const index = Math.min(clip.frames.length - 1, Math.floor(t / slot));
  const before = clip.frames[Math.max(0, index - 1)]!, current = clip.frames[index]!;
  // Authored frames can be closer than 120 ms; entry/exit retain the full ease duration.
  return mixFrames(before, current, smooth((t - index * slot) / Math.min(ease, slot)));
}
function recipe(face: CompanionFace, input: CompanionCompositionInput): FaceRecipe {
  if (input.expression === "neutral") return implicitRecipe;
  const expression = input.expression ?? ({ thinking: "thinking", concerned: "concerned", sorry: "sorry", surprised: "surprised", slide_built: "happy", build_done: "happy" } as Partial<Record<string, FaceExpression>>)[input.state ?? "idle"];
  return expression ? face.recipes[expression] ?? implicitRecipe : implicitRecipe;
}
/**
 * A v1 manifest returns null. A v2 result never chooses whole-picture talking,
 * blink or breathing frames. Every crossfaded body retains its own authored head.
 */
export function composeCompanionFace(input: CompanionCompositionInput): CompanionComposition | null {
  const { manifest: m } = input;
  if (!isCompanionFace(m.face)) return null;
  const face = m.face, time = clock(input.time), life = clock(input.motionTime ?? input.time);
  const held = safeHeldFrame(m, input.bodyFrame);
  const cue = currentGesture(input, time), clip = cue && m.clips[cue.clip];
  const elapsed = cue ? time - cue.startedAt : -1, hold = cue ? holdSeconds(cue) : 0;
  const duration = clip ? gestureDuration(clip, hold) : 0;
  const active = !!clip && elapsed >= 0 && elapsed < duration && !input.reduced;
  const reducedFrame = input.reduced && clip && elapsed >= 0 && elapsed < duration ? clip.frames[clip.hold ?? Math.floor(clip.frames.length / 2)]! : held;
  const frames = active ? gestureFrames(held, clip!, elapsed, hold) : [{ frame: reducedFrame, opacity: 1 }];
  const drift = input.reduced ? { x: 0, y: 0 } : companionHeadDrift(life);
  const r = recipe(face, input), blink = input.reduced ? "open" : companionBlink(life);
  const eyes = r.eyes === "closed" || blink === "open" ? r.eyes : blink;
  let breathY = input.reduced ? 0 : companionBreathY(life, m.size.height);
  if (active) {
    // A gesture can outlive an audio-clock pause while the life clock advances.
    // Settle to zero during its entry and restore the independent wave on exit;
    // the held portion is exactly motionless under either clock.
    const entry = smooth(elapsed / COMPANION_GESTURE_EASE);
    const exit = smooth((elapsed - (duration - COMPANION_GESTURE_EASE)) / COMPANION_GESTURE_EASE);
    breathY *= 1 - entry * (1 - exit);
    if (breathY === 0) breathY = 0;
  }
  const mouth = input.reduced ? "closed" : input.mouth.mouth;
  const previous = input.reduced ? "closed" : input.mouth.previousMouth ?? mouth;
  const mouthMix = Number.isFinite(input.mouth.mouthMix) ? clamp(input.mouth.mouthMix!, 0, 1) : 1;
  const bodies = frames.map(({ frame, opacity }): CompanionBodyScene => {
    const anchor = face.heads[frame] ?? face.heads[m.neutral]!;
    const head = { ...anchor, x: anchor.x + drift.x, y: anchor.y + drift.y };
    const angle = head.angle, patches = face.patch[angle]!, mouths = face.pieces.mouth[angle]!;
    const layers: CompanionFaceLayer[] = [];
    const add = (kind: CompanionFaceLayer["kind"], src: string, alpha = 1) => {
      if (alpha <= 0) return;
      const patch = patches[kind];
      layers.push({ kind, src, patch, opacity: alpha, feather: Math.min(2, Math.min(patch.w, patch.h) / 8) });
    };
    const mouthSource = (shape: FaceMouth) => r.mouthSet === "smile" ? mouths[`smile_${shape}`]! : mouths[shape];
    add("eyes", face.pieces.eyes[angle]![eyes]);
    add("brows", face.pieces.brows[angle]![r.brows]);
    if (previous !== mouth && mouthMix < 1) add("mouth", mouthSource(previous), 1 - mouthMix);
    add("mouth", mouthSource(mouth), previous === mouth ? 1 : mouthMix);
    return { frame, opacity, head, layers };
  });
  return { bodies, breathY, headDrift: drift, gestureActive: active };
}
