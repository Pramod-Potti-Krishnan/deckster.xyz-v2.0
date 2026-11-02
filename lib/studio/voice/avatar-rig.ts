/**
 * Expression rig for the drawn Director (client-safe, pure maths). The component writes these numbers onto the SVG every
 * frame; nothing here touches the DOM, so the motion is unit-tested.
 *
 * What it can do (every number is a "pose channel", see `AvatarPose`):
 *   head      yaw (turn), pitch (nod), tilt, sway; shoulders (shrug), body sway and lean; two arms, each with a hand
 *   face      blink, glances up / aside, wide eyes, a smiling squint; brows (lift, worry, furrow); beak open, narrow "o", wide, sideways
 *             "hmm", and a smile or a frown at the beak corners
 *   states    idle       breathing, drifting gaze, glances, brow and crest flicks, the odd smile
 *             listening  leans in, tilts its head, small nods, attentive brows, a ring that follows the microphone
 *             thinking   looks up and aside, one brow up, a "hmm" mouth, a hand to the chin, a gently bobbing thought cue
 *             speaking   the beak follows the loudness; stresses in the voice nod the head, lift the brows and beat a hand;
 *                        each new sentence lifts the head and turns it a little
 *   tone      "pleased" (smile, squint, bigger gestures) or "concerned" (worried brows, frown, a shrug, calmer) from the reply
 *   cues      one-shot gestures: a nod ("yes"), a shake ("no"), a perk of attention
 *   arms      the bird is a humanoid: a bird's head on a person's upper body. Two arms (shoulder angle, elbow bend, wrist turn) each
 *             end in a hand (open or curled fingers, fanned, or one finger pointing). They rest loosely folded in front, beat softly
 *             on stresses, come up to the chin while thinking, and play the named gestures (`noteGesture`): wave, celebrate, think,
 *             shrug, point, salute, open, comfort. A gesture lasts 1.2 to 2 s with ease-in and ease-out, then the hands settle back.
 *   beak      two mandibles: the lower one hinges at the base and drops with the voice (`mouth`), the dark mouth shows between them,
 *             and the upper one lifts a little.
 *
 * Nothing is periodic: every drift is smooth value noise, every glance, nod, blink or brow flick comes from a jittered random
 * schedule (a seeded hash), so two avatars with different seeds never move in step, and the same seed always replays the same way.
 * `prefers-reduced-motion` has its own profile: only the beak, blinks and a still pose that shows the state.
 */
import { mouthFromLevel } from "./vad";
import type { WingGesture } from "./gestures";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking";
export const AVATAR_STATES: readonly AvatarState[] = ["idle", "listening", "thinking", "speaking"];

/** How the reply sounds: from a cheap read of its words (see `replyTone` in tone.ts). */
export type AvatarTone = "neutral" | "pleased" | "concerned";
export const AVATAR_TONES: readonly AvatarTone[] = ["neutral", "pleased", "concerned"];

/** One-shot gestures: a nod ("yes"), a shake ("no", "unfortunately"), and a quick perk of attention. */
export type RigCue = "nod" | "shake" | "perk";
export const RIG_CUES: readonly RigCue[] = ["nod", "shake", "perk"];

export interface AvatarPose {
  /** Whole-body breathing offset, px (SVG units). */
  breath: number;
  headX: number;
  headY: number;
  /** Head roll, degrees (positive = clockwise). */
  tilt: number;
  /** Head turn -1..1 (positive = turns toward the viewer's right). The face slides across the head and the beak leads. */
  yaw: number;
  /** Head nod -1..1 (positive = chin down). */
  pitch: number;
  /** Pupil offset, px. */
  gazeX: number;
  gazeY: number;
  /** Eyelid closure 0 (open) .. 1 (shut). */
  lid: number;
  /** Eye size multiplier (1 = normal). */
  eyeScale: number;
  /** Lower lids pushed up by a smile, 0..1. */
  squint: number;
  /** Brow lift in px (negative = raised). */
  browL: number;
  browR: number;
  /** Brow slant in degrees: positive = the inner end is raised (worry), negative = lowered (furrow). */
  browInnerL: number;
  browInnerR: number;
  /** Beak opening 0..1. */
  mouth: number;
  /** Beak shape: -1 a narrow "o" .. +1 wide. */
  mouthWide: number;
  /** -1 a frown .. +1 a smile at the beak corners. */
  smile: number;
  /** The jaw slides sideways, px (a thoughtful "hmm"). */
  mouthX: number;
  /** Cheek blush 0..1 (0.5 is the drawing's own). */
  blush: number;
  /** Crest sway, degrees. */
  crest: number;
  /** Shoulders: negative = raised, px. */
  shrug: number;
  bodyX: number;
  /** Body roll, degrees. */
  bodyRoll: number;
  /** Leaning toward the viewer 0..1 (the figure grows a few percent). */
  lean: number;
  /** How far each hand has risen from below the frame: 0 hidden .. 1 at the chin. */
  handL: number;
  handR: number;
  handLX: number;
  handRX: number;
  handLRot: number;
  handRRot: number;
  /** Arms (hand* above are the "how far it is raised" channels the state logic uses). `Phi` is the shoulder angle in degrees: 0 hangs
   *  straight down, 90 points out to the side, 180 straight up, negative crosses the chest. `Elbow` bends the forearm on from there and
   *  `Wrist` the hand on from that (all degrees, positive = outward / up). The hand: `Open` 0 a loose fist .. 1 flat fingers, `Spread`
   *  fans the fingers 0..1, `Point` 0..1 extends the index finger and curls the others. "L" and "R" are the viewer's left and right. */
  armLPhi: number;
  armRPhi: number;
  armLElbow: number;
  armRElbow: number;
  armLWrist: number;
  armRWrist: number;
  handLOpen: number;
  handROpen: number;
  handLSpread: number;
  handRSpread: number;
  handLPoint: number;
  handRPoint: number;
  /** The whole bird hops up, px (a celebration). */
  hop: number;
  /** Thinking dots visibility 0..1. */
  dots: number;
  /** Listening ring strength 0..1. */
  ring: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/**
 * The arm's geometry in the drawing's units (the component draws with these same numbers): two links from the shoulder, the upper arm
 * and the forearm, then a hand `hand` long from the wrist to the fingertips. Shoulders sit `shoulderDx` either side of the middle of
 * the body. The hand points down at 0 degrees, out to the side at 90, straight up at 180 and across the chest at 270.
 */
export const ARM = {
  upper: 56,
  fore: 52,
  hand: 38.325,
  handScale: 1.05,
  shoulderDx: 72,
  shoulderY: 212,
} as const;

const DEG = 180 / Math.PI;
const wrap180 = (a: number) => { let v = a % 360; if (v > 180) v -= 360; if (v < -180) v += 360; return v; };

/**
 * Where the shoulder angle and elbow bend must be for the wrist to touch (tx, ty), measured from the shoulder (x outward from the
 * body, y down). `bend` picks the side the elbow points to: +1 inward and down, -1 outward and up. A target out of reach is
 * pulled in (the arm straightens as far as it can).
 */
export function reachArm(tx: number, ty: number, bend: 1 | -1 = 1): { phi: number; elbow: number } {
  const a = ARM.upper;
  const b = ARM.fore;
  const d = clamp(Math.hypot(tx, ty), Math.abs(a - b) + 1, a + b - 0.5);
  const psi = Math.atan2(tx, ty) * DEG;
  const alpha = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)) * DEG;
  // Keep the angle in -100..260 so an arm that goes up to the head swings out and over (never across the chest the long way round).
  let phi = psi + bend * alpha;
  if (phi < -100) phi += 360;
  const ex = a * Math.sin(phi / DEG);
  const ey = a * Math.cos(phi / DEG);
  const tipX = (tx / Math.max(1e-6, Math.hypot(tx, ty))) * d;
  const tipY = (ty / Math.max(1e-6, Math.hypot(tx, ty))) * d;
  const fore = Math.atan2(tipX - ex, tipY - ey) * DEG;
  return { phi, elbow: wrap180(fore - phi) };
}

/** Where the wrist is, from the shoulder (x outward, y down), for a shoulder angle and an elbow bend. */
export function wristOf(phi: number, elbow: number): { x: number; y: number } {
  const r = Math.PI / 180;
  return { x: ARM.upper * Math.sin(phi * r) + ARM.fore * Math.sin((phi + elbow) * r), y: ARM.upper * Math.cos(phi * r) + ARM.fore * Math.cos((phi + elbow) * r) };
}

/** Where the fingertips are, from the shoulder. */
export function fingertipOf(phi: number, elbow: number, wrist: number): { x: number; y: number } {
  const w = wristOf(phi, elbow);
  const r = (phi + elbow + wrist) * (Math.PI / 180);
  return { x: w.x + ARM.hand * Math.sin(r), y: w.y + ARM.hand * Math.cos(r) };
}

/** Where an arm and its hand want to be: the three joint angles and the hand's shape. */
export interface ArmGoal { phi: number; elbow: number; wrist: number; open: number; spread: number; point: number }
/**
 * An arm goal that puts the wrist at (tx, ty) from the shoulder with the hand pointing in `dir` (0 down, 90 out, 180 up, 270 across
 * the chest). `bend` picks the side the elbow points to (see `reachArm`).
 */
export function aimArm(tx: number, ty: number, bend: 1 | -1, dir: number, open = 1, spread = 0, point = 0): ArmGoal {
  const r = reachArm(tx, ty, bend);
  return { phi: r.phi, elbow: r.elbow, wrist: wrap180(dir - r.phi - r.elbow), open, spread, point };
}

/** Shared by the initial SVG and every animation frame: child pivots are exactly at their parent's endpoint. */
export function armTransforms(goal: Pick<ArmGoal, "phi" | "elbow" | "wrist">, shrug = 0) {
  const f = (n: number) => (Math.round(n * 100) / 100).toString();
  return {
    arm: `translate(${120 + ARM.shoulderDx} ${f(ARM.shoulderY + shrug)}) rotate(${f(-goal.phi)})`,
    fore: `translate(0 ${ARM.upper}) rotate(${f(-goal.elbow)})`,
    wrist: `translate(0 ${ARM.fore}) rotate(${f(-goal.wrist)})`,
  };
}

/** Resting: hands loosely folded in front of the belly, the fingers pointing across to each other. */
export const REST: ArmGoal = aimArm(-36, 40, 1, 245, 0.55, 0.08);

export const NEUTRAL_POSE: AvatarPose = {
  breath: 0, headX: 0, headY: 0, tilt: 0, yaw: 0, pitch: 0, gazeX: 0, gazeY: 0, lid: 0, eyeScale: 1, squint: 0,
  browL: 0, browR: 0, browInnerL: 0, browInnerR: 0, mouth: 0, mouthWide: 0, smile: 0, mouthX: 0, blush: 0.5, crest: 0,
  shrug: 0, bodyX: 0, bodyRoll: 0, lean: 0, handL: 0, handR: 0, handLX: 0, handRX: 0, handLRot: 0, handRRot: 0,
  armLPhi: REST.phi, armRPhi: REST.phi, armLElbow: REST.elbow, armRElbow: REST.elbow, armLWrist: REST.wrist, armRWrist: REST.wrist,
  handLOpen: REST.open, handROpen: REST.open, handLSpread: REST.spread, handRSpread: REST.spread, handLPoint: 0, handRPoint: 0, hop: 0,
  dots: 0, ring: 0,
};
export const POSE_KEYS = Object.keys(NEUTRAL_POSE) as (keyof AvatarPose)[];

/** The most each channel may ever reach (the rig clamps to this, and the tests check it). */
export const POSE_BOUNDS: Record<keyof AvatarPose, readonly [number, number]> = {
  breath: [-3, 3], headX: [-7, 7], headY: [-8, 8], tilt: [-12, 12], yaw: [-1, 1], pitch: [-1, 1], gazeX: [-5.5, 5.5], gazeY: [-5, 5],
  lid: [0, 1], eyeScale: [0.9, 1.25], squint: [0, 1], browL: [-9, 5], browR: [-9, 5], browInnerL: [-14, 16], browInnerR: [-14, 16],
  mouth: [0, 1], mouthWide: [-1, 1], smile: [-1, 1], mouthX: [-5, 5], blush: [0, 1], crest: [-14, 14], shrug: [-7, 4],
  bodyX: [-9, 9], bodyRoll: [-4, 4], lean: [0, 1], handL: [0, 1], handR: [0, 1], handLX: [-40, 40], handRX: [-40, 40],
  handLRot: [-45, 45], handRRot: [-45, 45],
  armLPhi: [-90, 180], armRPhi: [-90, 180], armLElbow: [-150, 150], armRElbow: [-150, 150], armLWrist: [-90, 90], armRWrist: [-90, 90],
  handLOpen: [0, 1], handROpen: [0, 1], handLSpread: [0, 1], handRSpread: [0, 1], handLPoint: [0, 1], handRPoint: [0, 1], hop: [-1, 9],
  dots: [0, 1], ring: [0, 1],
};

const TAU = Math.PI * 2;
const clamp01 = (v: number) => clamp(v, 0, 1);
const smoothstep = (v: number) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
/** A smooth bump: 0 before `start`, rises and falls over `duration`, 0 after. */
const bell = (t: number, start: number, duration: number) => (t < start || t > start + duration ? 0 : Math.sin((Math.PI * (t - start)) / duration) ** 2);
/** Rises over `rise`, holds for `hold`, falls over `fall`. */
const plateau = (age: number, rise: number, hold: number, fall: number) => {
  if (age < 0) return 0;
  if (age < rise) return smoothstep(age / rise);
  if (age < rise + hold) return 1;
  const f = (age - rise - hold) / fall;
  return f >= 1 ? 0 : 1 - smoothstep(f);
};

// ------------------------------------------------------------------------------------------------ noise and schedules

/** A deterministic hash of two integers into [0, 1) (integer arithmetic, so every engine agrees). */
export function hash01(a: number, b = 0): number {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Smooth 1-D value noise in [-1, 1]: cubic blends between hashed lattice values. One unit of `t` is one lattice step. */
export function smoothNoise(seed: number, t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  const a = hash01(seed, i) * 2 - 1;
  const b = hash01(seed, i + 1) * 2 - 1;
  return a + (b - a) * u;
}

/** Two octaves of smooth noise, still within [-1, 1]. `rate` is lattice steps per second. */
export function drift(seed: number, t: number, rate: number): number {
  return 0.7 * smoothNoise(seed, t * rate) + 0.3 * smoothNoise(seed + 977, t * rate * 2.3 + 11);
}

export interface Pulse {
  /** Seconds since the event began. */
  age: number;
  /** 0.5..1, random per event. */
  strength: number;
  /** Which event (changes every time, so it can seed more choices). */
  cell: number;
}

/**
 * A stateless random schedule: time is cut into cells of `period` seconds; a cell has an event with probability `chance`, placed
 * at a random time in the first 80% of the cell. So the gaps are irregular (0.2 to 1.8 periods, or longer when a cell is skipped),
 * and the same seed always gives the same events. Returns the event that began within the last `window` seconds, if any.
 */
export function pulse(seed: number, channel: number, t: number, period: number, chance: number, window: number): Pulse | null {
  const cell = Math.floor(t / period);
  for (let c = cell; c >= cell - 1; c--) {
    const s = seed + channel * 7919;
    if (hash01(s, c * 3) >= chance) continue;
    const at = c * period + hash01(s, c * 3 + 1) * period * 0.8;
    const age = t - at;
    if (age >= 0 && age <= window) return { age, strength: 0.5 + 0.5 * hash01(s, c * 3 + 2), cell: c };
  }
  return null;
}

/** Eyelid closure 0..1 for a blink that began `age` seconds ago: quick close, slightly slower reopen. */
export function blinkClosure(age: number): number {
  if (age < 0 || age > 0.22) return 0;
  return age < 0.07 ? smoothstep(age / 0.07) : 1 - smoothstep((age - 0.07) / 0.15);
}

/** Eyelid closure at `time` from the avatar's own irregular blink schedule (about every 3.6 s, sometimes a double blink). */
export function blinkAmount(seed: number, time: number, period = 3.6): number {
  const e = pulse(seed, 1, time, period, 0.92, 0.6);
  if (!e) return 0;
  let v = blinkClosure(e.age);
  if (e.strength > 0.88) v = Math.max(v, blinkClosure(e.age - 0.3));
  return v;
}

/** Opacity of thinking dot `index` (0..2) at `time`: they light up in turn. */
export function dotOpacity(index: number, time: number, visible: number): number {
  const wave = 0.5 + 0.5 * Math.sin(time * 4.2 - index * 1.1);
  return clamp01(visible) * (0.3 + 0.7 * wave);
}

/** How far thinking dot `index` has floated up (px): they bob in turn, gently. */
export function dotLift(index: number, time: number, motion: number): number {
  return 0 - Math.max(0, Math.sin(time * 3.1 - index * 0.9)) * 2.4 * clamp01(motion);
}

// ------------------------------------------------------------------------------------------------ memory (speech accents, cues)

/** What the rig remembers between frames: the voice's recent loudness, and when the last accents happened. */
export interface RigMemory {
  slow: number;
  lastTime: number;
  emphAt: number;
  emphStrength: number;
  emphCount: number;
  sentenceAt: number;
  sentenceCount: number;
  cueAt: number;
  cueKind: RigCue | null;
  cueCount: number;
  /** The gesture playing (or last played), when it began (rig seconds), how big (0..1), and how many have been started. */
  gestureAt: number;
  gestureKind: WingGesture | null;
  gestureStrength: number;
  gestureCount: number;
}

export function createRigMemory(): RigMemory {
  return { slow: 0, lastTime: 0, emphAt: -100, emphStrength: 0, emphCount: 0, sentenceAt: -100, sentenceCount: 0, cueAt: -100, cueKind: null, cueCount: 0, gestureAt: -100, gestureKind: null, gestureStrength: 1, gestureCount: 0 };
}

/**
 * Feed the voice's loudness once per frame. A stress is a rise well above the running average of the last second or so: it
 * (at most every 0.42 s) starts an accent whose strength grows with how far the voice jumped.
 */
export function observeLevel(m: RigMemory, time: number, level: number): void {
  const dt = Math.max(0, time - m.lastTime);
  m.lastTime = time;
  const lv = Number.isFinite(level) ? Math.max(0, level) : 0;
  m.slow += (lv - m.slow) * (1 - Math.exp(-dt / (lv > m.slow ? 0.35 : 0.9))); // catches up with a louder voice quickly, forgets a quieter one slowly
  const rise = lv - m.slow;
  if (lv > 0.07 && rise > Math.max(0.03, m.slow * 0.45) && time - m.emphAt > 0.42) {
    m.emphAt = time;
    m.emphStrength = clamp01(0.45 + rise * 4);
    m.emphCount += 1;
  }
}

/** A new sentence began to play: the head lifts and turns a little, the brows flash. */
export function noteSentence(m: RigMemory, time: number): void {
  m.sentenceAt = time;
  m.sentenceCount += 1;
}

/** Start a one-shot gesture. */
export function noteCue(m: RigMemory, kind: RigCue, time: number): void {
  m.cueAt = time;
  m.cueKind = kind;
  m.cueCount += 1;
}


/**
 * Start a gesture (wave, celebrate, think, shrug, point, salute, open, comfort) at rig time `time` (seconds, the rig's own clock:
 * `AvatarRig.gesture` passes it for you). Playing a gesture again restarts it. "none" does nothing. `strength` (0..1) makes a smaller
 * version (the little flutter that goes with a pleased reply).
 */
export function noteGesture(mem: RigMemory, gesture: WingGesture, time: number, strength = 1): void {
  if (gesture === "none" || !GESTURE_SHAPES[gesture]) return;
  mem.gestureAt = time;
  mem.gestureKind = gesture;
  mem.gestureStrength = clamp(Number.isFinite(strength) ? strength : 1, 0, 1);
  mem.gestureCount += 1;
}

/** How long each gesture lasts, seconds: rise, hold, fall (ease in, hold, ease out). */
export const GESTURE_SHAPES: Record<Exclude<WingGesture, "none">, { rise: number; hold: number; fall: number }> = {
  wave: { rise: 0.4, hold: 1.1, fall: 0.45 },
  celebrate: { rise: 0.45, hold: 1.1, fall: 0.45 },
  think: { rise: 0.4, hold: 1.1, fall: 0.45 },
  shrug: { rise: 0.28, hold: 0.7, fall: 0.4 },
  point: { rise: 0.26, hold: 0.8, fall: 0.4 },
  salute: { rise: 0.3, hold: 0.65, fall: 0.35 },
  open: { rise: 0.4, hold: 1.0, fall: 0.5 },
  comfort: { rise: 0.5, hold: 1.0, fall: 0.5 },
};
/** Seconds a gesture takes in all. */
export const gestureDuration = (g: WingGesture): number => { const s = g === "none" ? null : GESTURE_SHAPES[g]; return s ? s.rise + s.hold + s.fall : 0; };

/** Where the hand goes when it is beating softly on a stress: up in front of the chest, open, the palm to the viewer. */
export const EXPLAIN: ArmGoal = aimArm(-32, 12, 1, 200, 1, 0.25);
/** A relaxed supporting arm while the other hand carries a named gesture. Idle keeps its original folded pose. */
export const RELAX: ArmGoal = aimArm(-8, 96, 1, 5, 0.55, 0.08);
/** The thinking pose: the forearm across the chest, the hand at the chin, the index finger up along the cheek. */
export const CHIN: ArmGoal = aimArm(-34, -22, 1, 198, 0, 0, 1);

/** What a gesture asks of the head and the arms at `age` seconds in. Every number is already scaled by the gesture's envelope. */
interface GestureFrame {
  /** 0..1: how much of the gesture is showing (ease in, hold, ease out). */
  env: number;
  /** The arm goals; a null arm stays with the state. `wL` / `wR` are the viewer's left and right. */
  wL: ArmGoal | null;
  wR: ArmGoal | null;
  tilt: number; yaw: number; pitch: number; headX: number; headY: number; shrug: number; hop: number; lean: number; roll: number;
  brow: number; browInner: number; smile: number; squint: number; eye: number; crest: number; blush: number; gazeX: number; gazeY: number; mouthX: number;
}

function gestureFrame(mem: RigMemory, t: number, seed: number): GestureFrame | null {
  const kind = mem.gestureKind;
  if (!kind || kind === "none") return null;
  const shape = GESTURE_SHAPES[kind];
  const age = t - mem.gestureAt;
  if (age < 0 || age > shape.rise + shape.hold + shape.fall) return null;
  const env = plateau(age, shape.rise, shape.hold, shape.fall) * mem.gestureStrength;
  if (env <= 0.001) return null;
  // Which arm leads (the viewer's right or left), different each time and the same for the same seed.
  const right = hash01(seed, mem.gestureCount * 7 + 3) < 0.5;
  const sgn = right ? 1 : -1; // +1 = the viewer's right
  const live = Math.min(1, env);
  const holdT = Math.max(0, age - shape.rise);
  const f: GestureFrame = { env, wL: RELAX, wR: RELAX, tilt: 0, yaw: 0, pitch: 0, headX: 0, headY: 0, shrug: 0, hop: 0, lean: 0, roll: 0, brow: 0, browInner: 0, smile: 0, squint: 0, eye: 0, crest: 0, blush: 0, gazeX: 0, gazeY: 0, mouthX: 0 };
  const lead = (g: ArmGoal) => { if (right) f.wR = g; else f.wL = g; };
  const both = (g: ArmGoal) => { f.wL = g; f.wR = { ...g }; };
  switch (kind) {
    case "wave": {
      // The hand up beside the head, open, the wrist swinging it from side to side.
      const g = aimArm(48, -50, -1, 178, 1, 0.45);
      lead({ ...g, phi: g.phi + 3 * Math.sin(holdT * TAU * 2.3) * live, wrist: g.wrist + 24 * Math.sin(holdT * TAU * 2.3) * live });
      f.tilt = -3 * sgn * env; f.yaw = 0.14 * sgn * env; f.smile = 0.55 * env; f.brow = -1.8 * env; f.squint = 0.25 * env; f.crest = 3 * env; f.eye = 0.02 * env;
      break;
    }
    case "celebrate": {
      // Both arms up in a V, the hands open and fanned, a little bounce, chin up, a big smile.
      const flutter = Math.sin(holdT * TAU * 3.4) * 7 * live;
      const g = aimArm(50, -78, -1, 166, 1, 1);
      both({ ...g, wrist: g.wrist + flutter * 2.2 });
      f.hop = Math.abs(Math.sin(holdT * TAU * 1.5)) * 6 * live; f.pitch = -0.28 * env; f.smile = 1 * env; f.squint = 0.55 * env; f.brow = -2.6 * env;
      f.blush = 0.35 * env; f.crest = 7 * env; f.tilt = Math.sin(holdT * TAU * 1.5) * 3.2 * live; f.eye = 0.05 * env; f.lean = 0.2 * env;
      break;
    }
    case "think": {
      // The hand to the chin with the index finger along the cheek, the eyes up and away; a fingertip tap now and then.
      lead({ ...CHIN, wrist: CHIN.wrist + Math.sin(holdT * 9) * 3 * live });
      f.tilt = 5 * sgn * env; f.yaw = -0.3 * sgn * env; f.gazeX = -3.6 * sgn * env; f.gazeY = -3.2 * env; f.brow = -2.4 * env; f.browInner = 3 * env; f.mouthX = -2 * sgn * env; f.pitch = -0.08 * env;
      break;
    }
    case "shrug": {
      // Palms horizontal at shoulder height, the shoulders up, the head on one side.
      both(aimArm(70, -8, -1, 95, 1, 0.3));
      f.shrug = -5.2 * env; f.tilt = 7.5 * sgn * env; f.browInner = 10 * env; f.brow = -1.4 * env; f.smile = -0.15 * env; f.eye = 0.02 * env; f.roll = 1.2 * sgn * env;
      break;
    }
    case "point": {
      // One arm out to the side with the index finger extended, the head and eyes following it.
      lead(aimArm(80, -25, -1, 94, 0, 0, 1));
      f.yaw = 0.5 * sgn * env; f.gazeX = 4.2 * sgn * env; f.brow = -2 * env; f.tilt = -2.5 * sgn * env; f.smile = 0.3 * env; f.lean = 0.2 * env;
      break;
    }
    case "salute": {
      // The flat hand to the brow, quick, and a straight look.
      lead(aimArm(0, -102, -1, 250, 1, 0));
      f.pitch = -0.12 * env; f.smile = 0.45 * env; f.squint = 0.2 * env; f.brow = -1.2 * env; f.tilt = -2 * sgn * env;
      break;
    }
    case "open": {
      // Palms forward beside the waist, fingers open, welcoming.
      both(aimArm(38, 60, -1, 165, 1, 0.6));
      f.lean = 0.35 * env; f.smile = 0.6 * env; f.brow = -2.2 * env; f.eye = 0.03 * env; f.tilt = 2 * sgn * env; f.blush = 0.15 * env;
      break;
    }
    case "comfort": {
      // One hand on the heart, the other relaxed; the head tilts and brows soften.
      lead(aimArm(-45, 20, 1, 250, 0.85, 0.05));
      f.tilt = 7 * sgn * env; f.browInner = 11 * env; f.brow = -1.4 * env; f.smile = 0.05 * env; f.pitch = 0.12 * env; f.eye = 0.04 * env; f.gazeY = 1 * env; f.lean = 0.25 * env;
      break;
    }
  }
  return f;
}

// ------------------------------------------------------------------------------------------------ the target pose

export interface RigInput {
  state: AvatarState;
  /** Seconds since the avatar started (monotonic). */
  time: number;
  /** Seconds since the state last changed. */
  stateTime: number;
  /** Loudness 0..1: the playing voice while speaking, the microphone while listening. */
  level: number;
  /** Integer (or 0..1, scaled): a per-avatar seed so two avatars do not move in lockstep. */
  seed?: number;
  /** 0..1 alias of `seed` kept for callers that have a phase. */
  phase?: number;
  tone?: AvatarTone;
  /** `prefers-reduced-motion`: only the beak, blinks and a still pose that shows the state. */
  reduced?: boolean;
  /** 1 = the full stage; ~0.5 = the small calm window. Scales head and body motion (not the face). */
  intensity?: number;
  /** Hands can be drawn (the stage). */
  gestures?: boolean;
}

const seedOf = (i: RigInput): number => (i.seed !== undefined ? Math.trunc(i.seed) : Math.round((i.phase ?? 0) * 997));


const lerp = (a: number, b: number, w: number) => a + (b - a) * w;
/** Joints interpolate inside their anatomical range. Circular shortest-path interpolation can fold an elbow past 180°. */
const mixArm = (from: ArmGoal, to: ArmGoal, w: number): ArmGoal => ({
  phi: lerp(from.phi, to.phi, w), elbow: lerp(from.elbow, to.elbow, w), wrist: lerp(from.wrist, to.wrist, w),
  open: lerp(from.open, to.open, w), spread: lerp(from.spread, to.spread, w), point: lerp(from.point, to.point, w),
});
/** The arm for a state's own "hand" raise: at rest, beating (the explain pose) or at the chin. */
function stateArm(explain: number, chin: number): ArmGoal {
  return mixArm(mixArm(REST, EXPLAIN, clamp01(explain)), CHIN, clamp01(chin));
}

/** The tone's contribution to the face and body; `w` fades it (the afterglow while idle, none while listening or thinking). */
function applyTone(p: AvatarPose, tone: AvatarTone, w: number): void {
  if (w <= 0 || tone === "neutral") return;
  if (tone === "pleased") {
    p.smile += 0.78 * w;
    p.squint += 0.42 * w;
    p.blush += 0.4 * w;
    p.browL -= 1.1 * w;
    p.browR -= 1.1 * w;
    p.crest += 2 * w;
    p.tilt += 1.6 * w;
  } else {
    p.smile -= 0.55 * w;
    p.browInnerL += 8 * w;
    p.browInnerR += 8 * w;
    p.browL -= 0.8 * w;
    p.browR -= 0.8 * w;
    p.eyeScale += 0.03 * w;
    p.pitch += 0.12 * w;
    p.shrug -= 1.6 * w;
    p.tilt -= 2.4 * w;
    p.gazeY += 0.9 * w;
    p.blush -= 0.2 * w;
  }
}

/** The still pose each state rests in (and what `prefers-reduced-motion` shows): the state reads, nothing moves. */
export function staticPose(state: AvatarState, tone: AvatarTone = "neutral"): AvatarPose {
  const p: AvatarPose = { ...NEUTRAL_POSE };
  switch (state) {
    case "listening":
      Object.assign(p, { tilt: 3, eyeScale: 1.07, browL: -3, browR: -3.5, browInnerL: 2, browInnerR: 2, gazeY: 0.6, ring: 0.5, smile: 0.15 });
      break;
    case "thinking":
      Object.assign(p, { tilt: -3, yaw: -0.25, pitch: -0.1, gazeX: -3.4, gazeY: -3, browL: -3.2, browR: 1.2, browInnerL: 3, mouthX: -2.5, dots: 1 });
      break;
    case "speaking":
      p.mouth = 0.3;
      break;
    default:
      break;
  }
  applyTone(p, tone, state === "speaking" || state === "idle" ? 1 : 0);
  return clampPose(p);
}

/** The reduced-motion profile: the still pose, the beak following the voice, and blinks. Nothing else moves. */
function reducedPose(i: RigInput): AvatarPose {
  const p = staticPose(i.state, i.tone ?? "neutral");
  if (i.state === "speaking") p.mouth = mouthFromLevel(i.level);
  if (i.state === "listening") p.ring = clamp01(i.level * 3.2);
  p.lid = Math.max(p.lid, blinkAmount(seedOf(i), i.time, 4.4));
  return clampPose(p);
}

export function clampPose(p: AvatarPose): AvatarPose {
  const out = { ...p };
  for (const k of POSE_KEYS) {
    const [lo, hi] = POSE_BOUNDS[k];
    const v = out[k];
    out[k] = Number.isFinite(v) ? clamp(v, lo, hi) : NEUTRAL_POSE[k];
  }
  return out;
}

/**
 * The pose the character is heading for at this instant (the caller smooths toward it with `followPose`). Pure: the same input and
 * memory give the same pose. `mem` carries the stresses, sentence starts and cues that `observeLevel`, `noteSentence` and `noteCue`
 * recorded; without it the speaking pose has no accents.
 */
export function targetPose(i: RigInput, mem: RigMemory = createRigMemory()): AvatarPose {
  if (i.reduced) return reducedPose(i);
  const { state, time: t, stateTime: st, level } = i;
  const seed = seedOf(i);
  const tone = i.tone ?? "neutral";
  const k = clamp(i.intensity ?? 1, 0, 1.3);
  const hands = i.gestures !== false;
  const ph = hash01(seed, 9) * TAU;
  const p: AvatarPose = { ...NEUTRAL_POSE };

  // A slow "energy" that changes how big everything is, so no minute looks like the last.
  const energy = (0.92 + 0.23 * smoothNoise(seed + 7, t * 0.17)) * (tone === "concerned" ? 0.82 : tone === "pleased" ? 1.22 : 1);

  p.breath = Math.sin(t * 1.25 + ph) * 1.1 + Math.sin(t * 0.62 + ph) * 0.3;
  p.shrug = Math.sin(t * 1.25 + ph - 0.6) * 0.45;
  p.crest = Math.sin(t * 0.9 + ph) * 2 + Math.sin(t * 2.1 + ph) * 0.6 + drift(seed + 3, t, 0.6) * 1.5;
  p.bodyX = drift(seed + 1, t, 0.11) * 4.5;
  p.bodyRoll = drift(seed + 2, t, 0.09) * 1.6;
  p.blush = 0.5;

  // Glances: the eyes move first, the head follows a little (people turn their heads when they look far aside).
  const glanceBase = state === "speaking" ? 0.5 : state === "listening" ? 0.18 : state === "thinking" ? 0 : 0.7;
  const g = glanceBase > 0 ? pulse(seed, 2, t, state === "speaking" ? 4.6 : 4.2, glanceBase, 1.5) : null;
  let glanceX = 0;
  let glanceY = 0;
  let glanceA = 0;
  let glanceDir = 0;
  if (g) {
    const hold = 0.45 + 0.75 * hash01(seed, g.cell * 11 + 2);
    glanceA = plateau(g.age, 0.1, hold, 0.28);
    glanceDir = hash01(seed, g.cell * 11 + 3) < 0.5 ? -1 : 1;
    const kind = hash01(seed, g.cell * 11 + 4);
    glanceX = glanceDir * (2.4 + 2 * g.strength) * glanceA;
    glanceY = (kind < 0.2 ? -3 : kind < 0.32 ? 2.2 : -0.3) * glanceA;
  }
  const wanderX = drift(seed + 4, t, 0.4) * 1.3;
  const wanderY = drift(seed + 5, t, 0.33) * 0.8;

  // Brow flicks and crest flicks: a little surprise at nothing in particular.
  const bf = pulse(seed, 3, t, state === "listening" ? 5 : 6.5, state === "thinking" ? 0 : 0.55, 0.7);
  const browFlick = bf ? bell(bf.age, 0, 0.5) * (1.6 + 1.6 * bf.strength) : 0;
  const bfLeft = bf ? hash01(seed, bf.cell * 5 + 1) < 0.5 : true;

  // One-shot gestures and the stresses in the voice.
  const cueAge = t - mem.cueAt;
  let cuePitch = 0;
  let cueYaw = 0;
  let cuePerk = 0;
  if (mem.cueKind && cueAge >= 0) {
    if (mem.cueKind === "nod" && cueAge < 1.1) cuePitch = 0.62 * (bell(cueAge, 0, 0.42) + 0.7 * bell(cueAge, 0.42, 0.38));
    else if (mem.cueKind === "shake" && cueAge < 1.2) cueYaw = 0.5 * Math.sin((cueAge / 1.1) * TAU * 1.5) * (1 - cueAge / 1.2);
    else if (mem.cueKind === "perk" && cueAge < 1.0) cuePerk = bell(cueAge, 0, 1.0);
  }
  const emphAge = t - mem.emphAt;
  const emph = emphAge < 0 ? 0 : (emphAge < 0.1 ? smoothstep(emphAge / 0.1) : Math.exp(-(emphAge - 0.1) / 0.38)) * mem.emphStrength;
  const sentAge = t - mem.sentenceAt;
  const sent = sentAge >= 0 && sentAge < 1.1 ? bell(sentAge, 0, 1.1) : 0;
  const sentDir = hash01(seed, mem.sentenceCount * 13 + 1) < 0.5 ? -1 : 1;
  const handSide = hash01(seed, mem.emphCount * 17 + 5) < 0.5 ? -1 : 1; // which hand beats this time

  switch (state) {
    case "idle": {
      p.gazeX = wanderX + glanceX;
      p.gazeY = wanderY + glanceY;
      p.headX = drift(seed + 6, t, 0.15) * 3 + glanceX * 0.4;
      p.headY = Math.sin(t * 0.8 + ph) * 0.5;
      p.tilt = drift(seed + 7, t, 0.13) * 4;
      p.yaw = drift(seed + 8, t, 0.11) * 0.3 + glanceDir * 0.22 * glanceA;
      p.pitch = drift(seed + 9, t, 0.1) * 0.08 + (glanceY > 1 ? 0.1 * glanceA : 0);
      // The odd private smile.
      const sm = pulse(seed, 4, t, 11, 0.6, 2.4);
      p.smile = 0.1 + (sm ? bell(sm.age, 0, 2.4) * 0.35 * sm.strength : 0);
      p.browL -= bf && bfLeft ? browFlick : browFlick * 0.4;
      p.browR -= bf && !bfLeft ? browFlick : browFlick * 0.4;
      p.blush += (sm ? bell(sm.age, 0, 2.4) * 0.12 : 0);
      break;
    }
    case "listening": {
      const arrive = bell(st, 0, 0.9);
      // Small "mm-hm" nods, never on a beat; sometimes two.
      const n = pulse(seed, 5, t, 3.1, 0.82, 1.1);
      const nod = n ? bell(n.age, 0, 0.46) + (n.strength > 0.82 ? 0.7 * bell(n.age, 0.46, 0.4) : 0) : 0;
      p.lean = clamp01(0.72 + clamp01(level * 3) * 0.2 + arrive * 0.2);
      p.tilt = 5 + drift(seed + 10, t, 0.14) * 3 + nod * 1.6;
      p.headX = 1.6 + drift(seed + 6, t, 0.15) * 1.4;
      p.headY = 1.4 + nod * 3.4;
      p.pitch = 0.1 + nod * 0.8 + drift(seed + 9, t, 0.1) * 0.06;
      p.yaw = -0.08 + drift(seed + 8, t, 0.11) * 0.2 + glanceDir * 0.14 * glanceA;
      p.eyeScale = 1.06 + clamp01(level * 3) * 0.04 + arrive * 0.03;
      p.browL = -3 - arrive * 2 - browFlick * (bfLeft ? 1 : 0.4);
      p.browR = -3.5 - arrive * 2 - browFlick * (bfLeft ? 0.4 : 1);
      p.browInnerL = 2 + arrive * 2;
      p.browInnerR = 2 + arrive * 2;
      p.gazeX = wanderX * 0.25 + glanceX * 0.5;
      p.gazeY = 0.6 + wanderY * 0.3;
      p.smile = 0.16 + nod * 0.12;
      p.ring = clamp01(level * 3.2);
      p.crest *= 0.6;
      p.bodyX += 1.4;
      break;
    }
    case "thinking": {
      const consider = smoothstep(st / 0.45);
      // Looks up and aside, then (a few seconds on) to the other side, like someone working it out.
      const side = hash01(seed, Math.floor(st / 3.1) + 40) < 0.5 ? -1 : 1;
      const sway = Math.sin(t * 0.8 + ph) * 0.4;
      p.gazeX = side * 4.4 * consider + sway;
      p.gazeY = -3.8 * consider + drift(seed + 12, t, 0.9) * 0.5;
      p.yaw = side * 0.42 * consider;
      p.tilt = side * 5.5 * consider;
      p.pitch = -0.12 * consider;
      p.headX = side * 2.5 * consider;
      p.headY = Math.sin(t * 1.6 + ph) * 0.5;
      const rise = hash01(seed, Math.floor(st / 3.1) + 41) < 0.5; // which brow goes up
      p.browL = (rise ? -3.6 : 1.2) * consider;
      p.browR = (rise ? 1.2 : -3.6) * consider;
      p.browInnerL = (rise ? 4 : -3) * consider;
      p.browInnerR = (rise ? -3 : 4) * consider;
      p.mouthX = side * -2.6 * consider; // a sideways "hmm"
      p.smile = -0.05 * consider;
      p.bodyRoll = side * 0.9 * consider;
      p.bodyX += side * -1.5 * consider;
      p.eyeScale = 1 + 0.02 * consider;
      p.dots = consider;
      // A hand comes up to the chin, with a fingertip tap now and then.
      const tap = pulse(seed, 6, t, 2.4, 0.7, 0.9);
      p.handR = smoothstep((st - 0.55) / 0.7);
      p.handRX = -26 * p.handR;
      p.handRRot = -10 * p.handR + (tap ? Math.sin(tap.age * 26) * 1.6 * bell(tap.age, 0, 0.9) : 0);
      p.shrug -= 0.6 * consider;
      p.browL -= cuePerk * 2;
      p.browR -= cuePerk * 2;
      break;
    }
    case "speaking": {
      const mouth = mouthFromLevel(level);
      p.mouth = mouth;
      // Vowels wander: wide, narrow "o", in between; only visible when the beak is open.
      p.mouthWide = drift(seed + 11, t, 3.2) * 0.9;
      p.headY = -mouth * 2 + emph * -3 + Math.sin(t * 1.9 + ph) * 0.4;
      p.pitch = -0.04 + drift(seed + 9, t, 0.14) * 0.16 + emph * 0.65 - sent * 0.3;
      p.tilt = drift(seed + 7, t, 0.18) * 6.5 * energy + emph * (handSide * 2.5);
      p.headX = drift(seed + 6, t, 0.17) * 3.4 + sent * sentDir * 3;
      p.yaw = drift(seed + 8, t, 0.16) * 0.58 * energy + sentDir * 0.45 * sent + glanceDir * 0.2 * glanceA;
      p.browL = -mouth * 1.8 - emph * 4.2 - sent * 2.8 - (bf && bfLeft ? browFlick : 0);
      p.browR = -mouth * 1.6 - emph * 4 - sent * 2.8 - (bf && !bfLeft ? browFlick : 0);
      p.eyeScale = 1 + emph * 0.06 + sent * 0.03;
      p.crest += mouth * 2.5 + emph * 5;
      p.shrug += emph * -2.4;
      p.bodyX += drift(seed + 13, t, 0.2) * 3 * energy;
      p.bodyRoll += drift(seed + 14, t, 0.17) * 1.3 * energy + emph * handSide * 0.8;
      p.lean = clamp01(0.15 + emph * 0.45);
      p.gazeX = wanderX * 0.3 + glanceX;
      p.gazeY = wanderY * 0.3 + glanceY;
      p.smile = 0.08;
      // Hands beat on the stresses (the left or the right, never both, never in a pattern) and open up at some sentence starts.
      const open = hash01(seed, mem.sentenceCount * 19 + 7) < (tone === "pleased" ? 0.7 : tone === "concerned" ? 0.55 : 0.4) ? sent : 0;
      const beat = clamp01(emph * 1.8);
      const lift = (side: number) => (handSide === side ? 0.95 * beat : 0) + 0.75 * open * energy;
      p.handL = lift(-1);
      p.handR = lift(1);
      const flick = (side: number) => (handSide === side ? beat : 0);
      p.handLX = -8 * flick(-1) - 6 * open;
      p.handRX = 8 * flick(1) + 6 * open;
      p.handLRot = -10 * flick(-1) - 14 * open * (tone === "concerned" ? 1.4 : 1);
      p.handRRot = 10 * flick(1) + 14 * open * (tone === "concerned" ? 1.4 : 1);
      if (tone === "concerned") p.shrug -= 1.6 * open; // the "what can you do" shrug
      break;
    }
  }

  applyTone(p, tone, state === "speaking" ? 1 : state === "idle" ? 0.85 : 0);

  // Arms: the state's own (beats on stresses, the chin while thinking), then a gesture takes them over for its length.
  const thinking = state === "thinking";
  const liftL = hands ? p.handL : 0;
  const liftR = hands ? p.handR : 0;
  let wl = stateArm(thinking ? 0 : liftL, 0);
  let wr = stateArm(thinking ? 0 : liftR, thinking ? liftR : 0);
  if (hands && !thinking && emph > 0.05) {
    const flick = Math.sin(emphAge * 28) * 5 * emph * clamp01(emphAge * 8);
    if (handSide < 0) wl = { ...wl, wrist: wl.wrist + flick }; else wr = { ...wr, wrist: wr.wrist + flick };
  }
  const gf = gestureFrame(mem, t, seed);
  if (gf) {
    const w = clamp01(gf.env);
    if (gf.wL) wl = mixArm(wl, gf.wL, w);
    if (gf.wR) wr = mixArm(wr, gf.wR, w);
    p.tilt += gf.tilt; p.yaw += gf.yaw; p.pitch += gf.pitch; p.headX += gf.headX; p.headY += gf.headY; p.shrug += gf.shrug; p.lean = Math.max(p.lean, gf.lean);
    p.bodyRoll += gf.roll; p.browL += gf.brow; p.browR += gf.brow; p.browInnerL += gf.browInner; p.browInnerR += gf.browInner; p.smile += gf.smile;
    p.squint += gf.squint; p.eyeScale += gf.eye; p.crest += gf.crest; p.blush += gf.blush; p.gazeX += gf.gazeX; p.gazeY += gf.gazeY; p.mouthX += gf.mouthX;
    p.hop = gf.hop;
  }
  p.armLPhi = wl.phi; p.armLElbow = wl.elbow; p.armLWrist = wl.wrist; p.handLOpen = wl.open; p.handLSpread = wl.spread; p.handLPoint = wl.point;
  p.armRPhi = wr.phi; p.armRElbow = wr.elbow; p.armRWrist = wr.wrist; p.handROpen = wr.open; p.handRSpread = wr.spread; p.handRPoint = wr.point;

  // Cues ride on top of any state.
  p.pitch += cuePitch;
  p.headY += cuePitch * 2.6;
  p.yaw += cueYaw;
  p.tilt += cueYaw * 3;
  p.headX += cueYaw * 2;
  p.browL -= cuePerk * 2.2;
  p.browR -= cuePerk * 2.2;
  p.eyeScale += cuePerk * 0.05;
  p.lean = Math.max(p.lean, cuePerk * 0.5);

  // Blinks (and a blink with a big glance).
  p.lid = Math.max(blinkAmount(seed, t, state === "thinking" ? 2.9 : 3.6), glanceA > 0 && g && g.strength > 0.8 ? blinkClosure(g.age) * 0.9 : 0);
  p.lid = Math.max(p.lid, p.squint * 0.22);

  // Head and body motion scale with intensity (the small calm window); the face does not.
  for (const key of ["breath", "headX", "headY", "tilt", "yaw", "pitch", "bodyX", "bodyRoll", "shrug", "crest", "lean"] as const) p[key] *= k;
  if (!hands) { p.handL = 0; p.handR = 0; p.handLX = 0; p.handRX = 0; p.handLRot = 0; p.handRRot = 0; }
  return clampPose(p);
}

/** Per-channel response (1/seconds): eyelids and the beak are quick, gaze medium, nods snappy, the body slow. */
const RATE: Partial<Record<keyof AvatarPose, number>> = {
  lid: 90, mouth: 30, mouthWide: 16, mouthX: 9, smile: 7, squint: 8, gazeX: 16, gazeY: 16, headX: 9, headY: 11, tilt: 8, yaw: 9, pitch: 13,
  browL: 14, browR: 14, browInnerL: 10, browInnerR: 10, eyeScale: 10, crest: 10, breath: 20, shrug: 9, bodyX: 6, bodyRoll: 6, lean: 5,
  handL: 12, handR: 12, handLX: 12, handRX: 12, handLRot: 12, handRRot: 12, dots: 6, ring: 14, blush: 4,
  armLPhi: 12, armRPhi: 12, armLElbow: 13, armRElbow: 13, armLWrist: 14, armRWrist: 14, handLOpen: 14, handROpen: 14, handLSpread: 10, handRSpread: 10, handLPoint: 14, handRPoint: 14, hop: 16,
};

/** Move `pose` toward `target`. `dt` in seconds. */
export function followPose(pose: AvatarPose, target: AvatarPose, dt: number): AvatarPose {
  const out = { ...pose };
  const d = Math.max(0, dt);
  for (const k of POSE_KEYS) out[k] = pose[k] + (target[k] - pose[k]) * (1 - Math.exp(-(RATE[k] ?? 8) * d));
  return out;
}

// ------------------------------------------------------------------------------------------------ the rig

export interface AvatarRigOptions {
  /** Makes this avatar's drift, glances and blinks its own. */
  seed?: number;
  reduced?: boolean;
  intensity?: number;
  gestures?: boolean;
}

export interface RigFrame {
  state: AvatarState;
  tone?: AvatarTone;
  /** Loudness 0..1 now. */
  level: number;
}

/**
 * The stateful wrapper the component runs once per animation frame: it keeps time, remembers the voice's stresses and the cues, and
 * returns the smoothed pose to draw. Deterministic for a seed and a sequence of frames.
 */
export class AvatarRig {
  readonly seed: number;
  reduced: boolean;
  intensity: number;
  gestures: boolean;
  private time: number;
  private stateTime = 0;
  private lastState: AvatarState | null = null;
  private pose: AvatarPose = { ...NEUTRAL_POSE };
  private mem = createRigMemory();
  private ready = false;
  private flutterKey = "neutral";
  private flutterAt = -100;

  constructor(opts: AvatarRigOptions = {}) {
    this.seed = Math.trunc(opts.seed ?? 1);
    this.reduced = opts.reduced ?? false;
    this.intensity = opts.intensity ?? 1;
    this.gestures = opts.gestures ?? true;
    this.time = hash01(this.seed, 77) * 10; // each avatar starts somewhere else in its noise
  }

  /** A nod, a shake or a perk, starting now. */
  cue(kind: RigCue): void { noteCue(this.mem, kind, this.time); }
  /** A gesture (wave, celebrate, think, shrug, point, salute, open, comfort), starting now; "none" does nothing. */
  gesture(kind: WingGesture, strength = 1): void { noteGesture(this.mem, kind, this.time, strength); }
  /** Seconds on the rig's own clock (what `noteGesture` wants). */
  get clock(): number { return this.time; }
  /** A new sentence started playing. */
  sentence(): void { noteSentence(this.mem, this.time); }
  /** Jump straight to the pose a frame would head for (after a pause, or when reduced motion changes). */
  snap(frame: RigFrame): AvatarPose {
    this.pose = this.target(frame);
    return { ...this.pose };
  }

  private target(f: RigFrame): AvatarPose {
    return targetPose(
      { state: f.state, time: this.time, stateTime: this.stateTime, level: f.level, seed: this.seed, tone: f.tone, reduced: this.reduced, intensity: this.intensity, gestures: this.gestures },
      this.mem,
    );
  }

  /** Advance `dt` seconds (clamped to 50 ms so a slow frame never jumps) and return the pose to draw. */
  step(dt: number, f: RigFrame): AvatarPose {
    const d = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
    this.time += d;
    this.stateTime += d;
    if (f.state !== this.lastState) {
      this.lastState = f.state;
      this.stateTime = 0;
    }
    if (f.state === "speaking" && !this.reduced) observeLevel(this.mem, this.time, f.level);
    // A pleased reply gets a small celebratory flutter, a concerned one a soft comfort pose (once per change, never over a gesture that is playing).
    const key = f.state === "speaking" ? f.tone ?? "neutral" : "neutral";
    if (key !== this.flutterKey) {
      this.flutterKey = key;
      const idle = this.time - this.mem.gestureAt > 2.2 && this.time - this.flutterAt > 5;
      if (!this.reduced && idle && key === "pleased") { noteGesture(this.mem, "celebrate", this.time, 0.45); this.flutterAt = this.time; }
      else if (!this.reduced && idle && key === "concerned") { noteGesture(this.mem, "comfort", this.time, 0.6); this.flutterAt = this.time; }
    }
    const target = this.target(f);
    if (!this.ready) { this.ready = true; this.pose = target; } // the first frame starts where it is going
    else this.pose = followPose(this.pose, target, d);
    return { ...this.pose };
  }
}
