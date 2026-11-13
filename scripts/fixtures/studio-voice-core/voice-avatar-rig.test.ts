import { describe, expect, it } from "vitest";
import {
  AVATAR_STATES, AVATAR_TONES, AvatarRig, NEUTRAL_POSE, POSE_BOUNDS, POSE_KEYS, RIG_CUES, blinkAmount, blinkClosure, createRigMemory, dotLift, dotOpacity, drift,
  ARM, CHIN, GESTURE_SHAPES, REST, aimArm, fingertipOf, followPose, gestureDuration, hash01, noteCue, noteGesture, noteSentence, observeLevel, pulse, reachArm, smoothNoise, staticPose, targetPose, wristOf,
  type AvatarPose, type AvatarState, type AvatarTone, type RigFrame,
} from "../../../lib/studio/voice/avatar-rig";
import { MOMENT_GESTURE, WING_GESTURES, type WingGesture } from "../../../lib/studio/voice/gestures";

/** Run a rig for `seconds` at `fps` with a frame supplier; returns every pose. */
function run(rig: AvatarRig, seconds: number, frame: (t: number) => RigFrame, fps = 60): AvatarPose[] {
  const out: AvatarPose[] = [];
  for (let i = 0; i < seconds * fps; i++) out.push(rig.step(1 / fps, frame(i / fps)));
  return out;
}
const range = (poses: AvatarPose[], k: keyof AvatarPose) => {
  const v = poses.map((p) => p[k]);
  return { min: Math.min(...v), max: Math.max(...v) };
};
const speech = (t: number) => Math.max(0, 0.05 + 0.08 * Math.sin(t * 9) ** 2 + (Math.sin(t * 2.3) > 0.6 ? 0.07 : 0)); // syllables with the odd stress

describe("avatar rig: noise and schedules", () => {
  it("the hash and the noise are deterministic, bounded and smooth", () => {
    expect(hash01(5, 9)).toBe(hash01(5, 9));
    expect(hash01(5, 9)).not.toBe(hash01(6, 9));
    for (let t = 0; t < 40; t += 0.013) {
      const n = smoothNoise(3, t);
      const d = drift(3, t, 0.5);
      expect(Math.abs(n)).toBeLessThanOrEqual(1);
      expect(Math.abs(d)).toBeLessThanOrEqual(1);
      expect(Math.abs(smoothNoise(3, t + 0.001) - n)).toBeLessThan(0.01); // continuous
    }
    expect(smoothNoise(1, 4.3)).not.toBe(smoothNoise(2, 4.3));
  });

  it("scheduled events are irregular and replay exactly for the same seed", () => {
    const events = (seed: number) => {
      const starts: number[] = [];
      let last = -1;
      for (let t = 0; t < 300; t += 0.05) {
        const e = pulse(seed, 5, t, 3.1, 0.82, 1.1);
        if (e && e.cell !== last) { starts.push(+(t - e.age).toFixed(2)); last = e.cell; }
      }
      return starts;
    };
    const a = events(11);
    expect(a.length).toBeGreaterThan(40);
    expect(events(11)).toEqual(a);
    expect(events(12)).not.toEqual(a);
    const gaps = a.slice(1).map((t, i) => t - a[i]!);
    expect(Math.max(...gaps)).toBeGreaterThan(Math.min(...gaps) * 2); // never on a beat
    expect(new Set(gaps.map((g) => g.toFixed(1))).size).toBeGreaterThan(10);
  });

  it("a blink closes quickly and reopens, and the schedule blinks irregularly, never constantly", () => {
    expect(blinkClosure(-1)).toBe(0);
    expect(blinkClosure(0)).toBe(0);
    expect(blinkClosure(0.07)).toBeCloseTo(1, 5);
    expect(blinkClosure(0.15)).toBeGreaterThan(0);
    expect(blinkClosure(0.15)).toBeLessThan(1);
    expect(blinkClosure(0.3)).toBe(0);
    let closed = 0;
    let blinks = 0;
    let was = false;
    for (let t = 0; t < 120; t += 0.02) {
      const v = blinkAmount(4, t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      if (v > 0.5) closed += 1;
      if (v > 0.9 && !was) blinks += 1;
      was = v > 0.9;
    }
    expect(blinks).toBeGreaterThan(20); // about one every 3.6 s
    expect(blinks).toBeLessThan(60);
    expect(closed / (120 / 0.02)).toBeLessThan(0.1); // the eyes are open nearly all the time
  });

  it("thinking dots light up in turn and bob", () => {
    expect(dotOpacity(0, 1, 0)).toBe(0);
    const frames = [0, 1, 2].map((i) => dotOpacity(i, 2, 1));
    expect(new Set(frames.map((f) => f.toFixed(3))).size).toBeGreaterThan(1);
    for (const f of frames) { expect(f).toBeGreaterThanOrEqual(0.3); expect(f).toBeLessThanOrEqual(1); }
    const lifts = [0, 1, 2].map((i) => dotLift(i, 1.7, 1));
    for (const l of lifts) { expect(l).toBeLessThanOrEqual(0); expect(l).toBeGreaterThanOrEqual(-2.5); }
    expect(dotLift(0, 1.7, 0)).toBe(0); // reduced motion: no bobbing
  });
});

describe("avatar rig: the pose per state", () => {
  it("speaking opens the beak with the loudness of the voice; silence closes it", () => {
    const quiet = targetPose({ state: "speaking", time: 3, stateTime: 1, level: 0 });
    const loud = targetPose({ state: "speaking", time: 3, stateTime: 1, level: 0.2 });
    expect(quiet.mouth).toBe(0);
    expect(loud.mouth).toBeGreaterThan(0.9);
    expect(targetPose({ state: "speaking", time: 3, stateTime: 1, level: 0.05 }).mouth).toBeGreaterThan(0);
  });

  it("only speaking moves the beak; only thinking shows the dots and the chin hand; only listening shows the ring", () => {
    for (const state of AVATAR_STATES) {
      const p = targetPose({ state, time: 5, stateTime: 3, level: 0.3, seed: 2 });
      expect(p.mouth > 0).toBe(state === "speaking");
      expect(p.dots > 0).toBe(state === "thinking");
      expect(p.ring > 0).toBe(state === "listening");
      expect(p.handR > 0.9).toBe(state === "thinking");
    }
  });

  it("each state has a distinct readable pose", () => {
    const thinking = targetPose({ state: "thinking", time: 5, stateTime: 3, level: 0, seed: 2 });
    expect(thinking.gazeY).toBeLessThan(-2); // eyes glance up
    expect(Math.abs(thinking.gazeX)).toBeGreaterThan(2); // and aside
    expect(Math.abs(thinking.yaw)).toBeGreaterThan(0.15); // the head turns with them
    expect(thinking.browL).not.toBeCloseTo(thinking.browR, 0); // one brow higher
    expect(thinking.dots).toBeGreaterThan(0.9);
    expect(Math.abs(thinking.mouthX)).toBeGreaterThan(1.5); // a sideways "hmm"
    const listening = targetPose({ state: "listening", time: 5, stateTime: 3, level: 0, seed: 2 });
    expect(listening.eyeScale).toBeGreaterThan(1);
    expect(listening.tilt).toBeGreaterThan(1);
    expect(listening.browL).toBeLessThan(-2); // raised, attentive
    expect(listening.lean).toBeGreaterThan(0.5); // leaning in
    const idle = targetPose({ state: "idle", time: 5, stateTime: 3, level: 0, seed: 2 });
    expect(idle.lean).toBe(0);
    expect(idle.dots).toBe(0);
    expect(idle.handR).toBe(0);
  });

  it("listening nods now and then, at irregular moments", () => {
    const rig = new AvatarRig({ seed: 5 });
    const poses = run(rig, 40, () => ({ state: "listening", level: 0.04 }));
    const pitch = range(poses, "pitch");
    expect(pitch.max).toBeGreaterThan(0.4);
    expect(pitch.min).toBeLessThan(0.2);
    // Count nods: upward crossings of 0.35.
    const times: number[] = [];
    poses.forEach((p, i) => { if (p.pitch > 0.35 && (poses[i - 1]?.pitch ?? 0) <= 0.35) times.push(i / 60); });
    expect(times.length).toBeGreaterThan(4);
    const gaps = times.slice(1).map((t, i) => t - times[i]!);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.8);
  });

  it("thinking looks up and aside, changes sides over a long think, and brings a hand to the chin", () => {
    const rig = new AvatarRig({ seed: 8 });
    const poses = run(rig, 20, () => ({ state: "thinking", level: 0 }));
    const late = poses.slice(60);
    expect(Math.max(...late.map((p) => p.gazeY))).toBeLessThan(-1.5);
    const gx = range(late, "gazeX");
    expect(gx.min).toBeLessThan(-2);
    expect(gx.max).toBeGreaterThan(2); // both sides
    expect(poses[poses.length - 1]!.handR).toBeGreaterThan(0.9);
    expect(poses[0]!.handR).toBeLessThan(0.6); // it takes a moment to raise
    expect(poses[poses.length - 1]!.dots).toBeGreaterThan(0.9);
  });

  it("stresses in the voice nod the head, lift the brows and beat a hand; steady loudness does not", () => {
    // The same instant of the same voice, with and without a stress that just happened.
    const quiet = createRigMemory();
    const stressed = createRigMemory();
    for (let t = 0; t < 2; t += 1 / 60) { observeLevel(quiet, t, 0.1); observeLevel(stressed, t, 0.1); }
    observeLevel(stressed, 2, 0.3);
    expect(stressed.emphCount).toBeGreaterThan(quiet.emphCount);
    const at = (mem: typeof quiet, time: number) => targetPose({ state: "speaking", time, stateTime: 3, level: 0.1, seed: 3 }, mem);
    const calm = at(quiet, 2.12);
    const accent = at(stressed, 2.12);
    expect(accent.browL).toBeLessThan(calm.browL - 1.5); // brows lift
    expect(accent.pitch).toBeGreaterThan(calm.pitch + 0.1); // the head nods
    expect(accent.headY).toBeLessThan(calm.headY - 1); // and rises a little
    expect(accent.crest).toBeGreaterThan(calm.crest + 2);
    const later = at(stressed, 4.5); // the accent has died away
    expect(Math.abs(later.pitch - at(quiet, 4.5).pitch)).toBeLessThan(0.02);
    // Over a real stretch of speech, hands beat only when the voice stresses, on one side at a time.
    const flat = run(new AvatarRig({ seed: 3 }), 8, () => ({ state: "speaking", level: 0.1 }));
    const lively = run(new AvatarRig({ seed: 3 }), 8, (t) => ({ state: "speaking", level: speech(t) }));
    expect(Math.max(...lively.map((p) => Math.max(p.handL, p.handR)))).toBeGreaterThan(0.25);
    expect(Math.max(...flat.slice(120).map((p) => Math.max(p.handL, p.handR)))).toBeLessThan(0.1);
    const both = lively.filter((p) => p.handL > 0.3 && p.handR > 0.3).length;
    expect(both).toBeLessThan(lively.length * 0.1);
  });

  it("a new sentence lifts the head, flashes the brows and turns the head a little", () => {
    const rig = new AvatarRig({ seed: 6 });
    run(rig, 3, () => ({ state: "speaking", level: 0.05 }));
    const before = rig.step(1 / 60, { state: "speaking", level: 0.05 });
    rig.sentence();
    const after = run(rig, 0.6, () => ({ state: "speaking", level: 0.05 }));
    expect(Math.min(...after.map((p) => p.browL))).toBeLessThan(before.browL - 1.5);
    expect(Math.min(...after.map((p) => p.pitch))).toBeLessThan(before.pitch - 0.08);
    expect(Math.max(...after.map((p) => Math.abs(p.yaw - before.yaw)))).toBeGreaterThan(0.1);
  });

  it("a nod cue nods, a shake cue shakes, a perk raises the brows; each ends", () => {
    const base = () => run(new AvatarRig({ seed: 2 }), 4, () => ({ state: "speaking", level: 0 }));
    const calm = base();
    const nod = new AvatarRig({ seed: 2 });
    run(nod, 2, () => ({ state: "speaking", level: 0 }));
    nod.cue("nod");
    const nods = run(nod, 1.4, () => ({ state: "speaking", level: 0 }));
    expect(Math.max(...nods.map((p) => p.pitch))).toBeGreaterThan(0.45);
    expect(Math.abs(nods[nods.length - 1]!.pitch)).toBeLessThan(0.25);
    const shake = new AvatarRig({ seed: 2 });
    run(shake, 2, () => ({ state: "speaking", level: 0 }));
    shake.cue("shake");
    const yaws = run(shake, 1.4, () => ({ state: "speaking", level: 0 })).map((p) => p.yaw);
    let crossings = 0;
    const mean = yaws.reduce((a, b) => a + b, 0) / yaws.length;
    yaws.forEach((y, i) => { if (i > 0 && (y - mean) * (yaws[i - 1]! - mean) < 0) crossings += 1; });
    expect(crossings).toBeGreaterThanOrEqual(2);
    expect(Math.max(...yaws) - Math.min(...yaws)).toBeGreaterThan(0.35);
    const perk = new AvatarRig({ seed: 2 });
    run(perk, 2, () => ({ state: "thinking", level: 0 }));
    const calmBrow = perk.step(1 / 60, { state: "thinking", level: 0 }).browL;
    perk.cue("perk");
    const perks = run(perk, 0.7, () => ({ state: "thinking", level: 0 }));
    expect(Math.min(...perks.map((p) => p.browL))).toBeLessThan(calmBrow - 1.5);
    expect(calm.length).toBeGreaterThan(0);
  });

  it("pleased smiles, squints and gestures more; concerned frowns with worried brows and a shrug", () => {
    const at = (tone: AvatarTone) => targetPose({ state: "speaking", time: 9, stateTime: 3, level: 0.1, seed: 4, tone });
    const neutral = at("neutral");
    const pleased = at("pleased");
    const concerned = at("concerned");
    expect(pleased.smile).toBeGreaterThan(0.6);
    expect(pleased.squint).toBeGreaterThan(0.3);
    expect(pleased.blush).toBeGreaterThan(neutral.blush);
    expect(neutral.smile).toBeLessThan(0.3);
    expect(concerned.smile).toBeLessThan(-0.3);
    expect(concerned.browInnerL).toBeGreaterThan(5);
    expect(concerned.browInnerR).toBeGreaterThan(5);
    expect(concerned.shrug).toBeLessThan(neutral.shrug);
    // The mood is there while idle (it lingers) and gone while listening or thinking.
    expect(targetPose({ state: "idle", time: 9, stateTime: 3, level: 0, seed: 4, tone: "pleased" }).smile).toBeGreaterThan(0.5);
    expect(targetPose({ state: "listening", time: 9, stateTime: 3, level: 0, seed: 4, tone: "concerned" }).smile).toBeGreaterThan(0);
    expect(targetPose({ state: "thinking", time: 9, stateTime: 3, level: 0, seed: 4, tone: "concerned" }).browInnerL).toBeLessThan(6);
  });

  it("idle is never frozen: it breathes, drifts, glances and blinks", () => {
    const rig = new AvatarRig({ seed: 9 });
    const poses = run(rig, 30, () => ({ state: "idle", level: 0 }));
    for (const k of ["breath", "gazeX", "tilt", "yaw", "bodyX", "crest", "lid"] as const) {
      const r = range(poses, k);
      expect(r.max - r.min).toBeGreaterThan(k === "yaw" ? 0.05 : 0.5);
    }
    expect(range(poses, "gazeX").max - range(poses, "gazeX").min).toBeGreaterThan(3); // glances
  });
});

describe("avatar rig: determinism, bounds and intensity", () => {
  it("the same seed replays exactly; another seed moves differently", () => {
    const script = (t: number): RigFrame => ({ state: AVATAR_STATES[Math.floor(t / 4) % 4]!, level: speech(t), tone: AVATAR_TONES[Math.floor(t / 7) % 3] });
    const poses = (seed: number) => {
      const r = new AvatarRig({ seed });
      return run(r, 24, (t) => { if (Math.abs(t - 6) < 0.009) r.cue("nod"); if (Math.abs(t - 13) < 0.009) r.sentence(); return script(t); });
    };
    const a = poses(21);
    expect(poses(21)).toEqual(a);
    const b = poses(22);
    expect(b).not.toEqual(a);
    expect(b.filter((p, i) => Math.abs(p.gazeX - a[i]!.gazeX) > 0.3).length).toBeGreaterThan(20); // genuinely different, not a phase nudge
  });

  it("two avatars on one page do not move in lockstep", () => {
    const a = run(new AvatarRig({ seed: 100 }), 12, () => ({ state: "idle", level: 0 }));
    const b = run(new AvatarRig({ seed: 101 }), 12, () => ({ state: "idle", level: 0 }));
    expect(a.map((p) => p.breath.toFixed(2)).join()).not.toBe(b.map((p) => p.breath.toFixed(2)).join());
  });

  it("every channel stays finite and inside its bounds, in every state, tone and cue, at any frame rate", () => {
    for (const fps of [20, 60, 144]) {
      for (const intensity of [0.5, 1, 1.3]) {
        const rig = new AvatarRig({ seed: 77, intensity });
        const cuePlan: [number, () => void][] = [[5, () => rig.cue("nod")], [11, () => rig.cue("shake")], [17, () => rig.cue("perk")], [23, () => rig.sentence()], [29, () => rig.sentence()]];
        const done = new Set<number>();
        const poses = run(rig, 90, (t) => {
          cuePlan.forEach(([at, fn], i) => { if (t >= at && !done.has(i)) { done.add(i); fn(); } });
          return { state: AVATAR_STATES[Math.floor(t / 6) % 4]!, level: Math.abs(Math.sin(t * 7)) * 0.3, tone: AVATAR_TONES[Math.floor(t / 9) % 3] };
        }, fps);
        // One plain check per value (an expect() call per value took ~30 s and over a minute under load); the first breach is reported.
        const breaches: string[] = [];
        for (const p of poses) {
          for (const k of POSE_KEYS) {
            const v = p[k];
            if (!Number.isFinite(v) || v < POSE_BOUNDS[k][0] - 1e-9 || v > POSE_BOUNDS[k][1] + 1e-9) breaches.push(`${k}=${v} at ${fps}fps, intensity ${intensity}`);
          }
        }
        expect(breaches.slice(0, 5)).toEqual([]);
      }
    }
  }, 120_000);

  it("garbage in (NaN, negative or huge loudness and time steps) never leaks out", () => {
    const rig = new AvatarRig({ seed: 1 });
    for (const level of [NaN, -3, Infinity, 7, 0]) {
      for (const dt of [NaN, -1, 0, 5, 1 / 60]) {
        const p = rig.step(dt, { state: "speaking", level });
        for (const k of POSE_KEYS) expect(Number.isFinite(p[k])).toBe(true);
      }
    }
    const m = createRigMemory();
    observeLevel(m, 1, NaN);
    expect(Number.isFinite(m.slow)).toBe(true);
    for (const s of AVATAR_STATES) for (const tone of AVATAR_TONES) for (const k of POSE_KEYS) expect(Number.isFinite(targetPose({ state: s, time: -5, stateTime: -1, level: NaN, tone })[k])).toBe(true);
  });

  it("the small calm window moves less than the stage, and has no hands", () => {
    const sd = (poses: AvatarPose[], k: keyof AvatarPose) => { const v = poses.map((p) => p[k]); const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
    const frame = (t: number): RigFrame => ({ state: "speaking", level: speech(t) });
    const stage = run(new AvatarRig({ seed: 5 }), 30, frame);
    const calm = run(new AvatarRig({ seed: 5, intensity: 0.5, gestures: false }), 30, frame);
    expect(sd(calm, "tilt")).toBeLessThan(sd(stage, "tilt") * 0.7);
    expect(sd(calm, "bodyX")).toBeLessThan(sd(stage, "bodyX") * 0.7);
    expect(Math.max(...calm.map((p) => Math.max(p.handL, p.handR)))).toBe(0);
    expect(Math.max(...stage.map((p) => Math.max(p.handL, p.handR)))).toBeGreaterThan(0.2);
    // The face is not damped: the beak and the blinks are the same.
    expect(range(calm, "mouth").max).toBeCloseTo(range(stage, "mouth").max, 1);
  });
});

describe("avatar rig: reduced motion", () => {
  const MOVING = ["breath", "headX", "headY", "tilt", "yaw", "pitch", "gazeX", "gazeY", "browL", "browR", "crest", "shrug", "bodyX", "bodyRoll", "lean", "handL", "handR", "handLX", "handRX", "handLRot", "handRRot", "mouthWide"] as const;

  it("keeps only the beak, the blinks and a still pose that shows the state", () => {
    for (const state of AVATAR_STATES) {
      const rig = new AvatarRig({ seed: 12, reduced: true });
      const poses = run(rig, 60, (t) => ({ state, level: state === "speaking" ? speech(t) * (Math.sin(t * 0.9) > -0.3 ? 1 : 0) : state === "listening" ? 0.05 : 0 }));
      for (const k of MOVING) {
        const r = range(poses, k);
        expect(r.max - r.min, `${state}.${k}`).toBeLessThan(0.01); // does not move
      }
      expect(range(poses, "lid").max).toBeGreaterThan(0.9); // blinks
      expect(range(poses, "lid").min).toBe(0);
      const mouth = range(poses, "mouth");
      expect(mouth.max > 0.5).toBe(state === "speaking"); // the beak still follows the voice
      expect(mouth.min).toBeLessThan(0.001);
      expect(poses[poses.length - 1]!.dots > 0.9).toBe(state === "thinking"); // the state cue
      expect(poses[poses.length - 1]!.ring > 0).toBe(state === "listening");
    }
  });

  it("the still poses are finite, within bounds, and tell the states apart", () => {
    expect(staticPose("idle")).toEqual(NEUTRAL_POSE);
    expect(staticPose("speaking").mouth).toBeGreaterThan(0);
    expect(staticPose("thinking").dots).toBe(1);
    expect(staticPose("thinking").gazeY).toBeLessThan(-2);
    expect(staticPose("listening").ring).toBeGreaterThan(0);
    expect(staticPose("idle").breath).toBe(0);
    expect(staticPose("speaking", "pleased").smile).toBeGreaterThan(0.5);
    expect(staticPose("speaking", "concerned").smile).toBeLessThan(-0.3);
    for (const s of AVATAR_STATES) for (const tone of AVATAR_TONES) for (const k of POSE_KEYS) {
      const v = staticPose(s as AvatarState, tone)[k];
      expect(v).toBeGreaterThanOrEqual(POSE_BOUNDS[k][0]);
      expect(v).toBeLessThanOrEqual(POSE_BOUNDS[k][1]);
    }
  });

  it("cues and sentence starts do nothing under reduced motion", () => {
    const rig = new AvatarRig({ seed: 12, reduced: true });
    run(rig, 1, () => ({ state: "speaking", level: 0 }));
    const before = rig.step(1 / 60, { state: "speaking", level: 0 });
    for (const c of RIG_CUES) rig.cue(c);
    rig.sentence();
    const after = rig.step(1 / 60, { state: "speaking", level: 0 });
    expect({ ...after, lid: 0 }).toEqual({ ...before, lid: 0 });
  });
});

describe("avatar rig: following a target", () => {
  it("is smooth, converges, and the eyelid is faster than the body", () => {
    let pose = { ...NEUTRAL_POSE };
    const target = { ...NEUTRAL_POSE, lid: 1, tilt: 10, mouth: 1 };
    pose = followPose(pose, target, 1 / 60);
    expect(pose.lid).toBeGreaterThan(pose.tilt / 10);
    expect(pose.lid).toBeLessThan(1);
    for (let i = 0; i < 240; i++) pose = followPose(pose, target, 1 / 60);
    expect(pose.tilt).toBeCloseTo(10, 2);
    expect(pose.mouth).toBeCloseTo(1, 2);
    expect(followPose(NEUTRAL_POSE, target, 0)).toEqual(NEUTRAL_POSE); // no time, no movement
  });

  it("memory: stresses need a rise above the running average, and are spaced", () => {
    const m = createRigMemory();
    let t = 0;
    for (; t < 3; t += 1 / 60) observeLevel(m, t, 0.1); // steady voice (its first onset counts once)
    const base = m.emphCount;
    expect(base).toBeLessThanOrEqual(1);
    for (t = 3; t < 5; t += 1 / 60) observeLevel(m, t, 0.1);
    expect(m.emphCount).toBe(base); // nothing happens while it is steady
    observeLevel(m, t, 0.3); // a jump
    expect(m.emphCount).toBe(base + 1);
    observeLevel(m, t + 0.1, 0.35); // too soon for another
    expect(m.emphCount).toBe(base + 1);
    noteSentence(m, t);
    noteCue(m, "nod", t);
    expect(m.sentenceCount).toBe(1);
    expect(m.cueKind).toBe("nod");
  });
});


// ------------------------------------------------------------------------------------------------ arms, hands and gestures

/** Where the wrist and the fingertips of an arm are, from its shoulder (x outward, y down). */
const wristAt = (p: AvatarPose, side: "L" | "R") => (side === "L" ? wristOf(p.armLPhi, p.armLElbow) : wristOf(p.armRPhi, p.armRElbow));
const tipAt = (p: AvatarPose, side: "L" | "R") => (side === "L" ? fingertipOf(p.armLPhi, p.armLElbow, p.armLWrist) : fingertipOf(p.armRPhi, p.armRElbow, p.armRWrist));
/** Drawing x of a wrist or fingertip (the left shoulder is at 120 - shoulderDx, and "outward" there is to the left). */
const worldX = (side: "L" | "R", x: number) => (side === "R" ? 120 + ARM.shoulderDx + x : 120 - ARM.shoulderDx - x);
const REST_WRIST = wristOf(REST.phi, REST.elbow);
const fromRest = (p: AvatarPose, side: "L" | "R") => { const w = wristAt(p, side); return Math.hypot(w.x - REST_WRIST.x, w.y - REST_WRIST.y); };
/** The arm that moved most from rest in these poses. */
const leadSide = (poses: AvatarPose[]): "L" | "R" => (Math.max(...poses.map((p) => fromRest(p, "L"))) > Math.max(...poses.map((p) => fromRest(p, "R"))) ? "L" : "R");
const GESTURES = WING_GESTURES.filter((g): g is Exclude<WingGesture, "none"> => g !== "none");
const still = (state: AvatarState = "idle", tone: AvatarTone = "neutral") => (t: number): RigFrame => ({ state, tone, level: state === "speaking" ? speech(t) : 0 });
/** The rig, with `gesture` started at 1 s, run for `seconds`; the poses begin at that moment. */
function play(gesture: WingGesture, seconds: number, opts: ConstructorParameters<typeof AvatarRig>[0] = { seed: 4 }, state: AvatarState = "idle"): AvatarPose[] {
  const rig = new AvatarRig(opts);
  run(rig, 1, still(state));
  rig.gesture(gesture);
  return run(rig, seconds, still(state));
}
const armRange = (poses: AvatarPose[], k: keyof AvatarPose) => range(poses, k);
const best = (poses: AvatarPose[], f: (p: AvatarPose) => number) => Math.min(...poses.map(f));

describe("arms: the geometry", () => {
  it("reachArm puts the wrist on any target it can reach, with the elbow on either side", () => {
    for (const [tx, ty] of [[-34, -22], [0, -90], [48, -30], [-56, 18], [60, 40], [20, -80]] as const) {
      for (const bend of [1, -1] as const) {
        const { phi, elbow } = reachArm(tx, ty, bend);
        const w = wristOf(phi, elbow);
        expect(Math.hypot(w.x - tx, w.y - ty), `${tx},${ty} bend ${bend}`).toBeLessThan(0.6);
      }
    }
    // The two bends are different arms: elbow inward and down vs outward and up.
    expect(reachArm(-34, -22, 1).phi).toBeLessThan(0);
    expect(reachArm(-34, -22, -1).phi).toBeGreaterThan(90);
  });

  it("aimArm also points the hand: the fingertips are one hand-length from the wrist in the asked direction", () => {
    for (const dir of [0, 90, 180, 225, 270]) {
      const g = aimArm(30, -40, -1, dir);
      const w = wristOf(g.phi, g.elbow);
      const t = fingertipOf(g.phi, g.elbow, g.wrist);
      expect(Math.hypot(t.x - w.x, t.y - w.y)).toBeCloseTo(ARM.hand, 4);
      expect(t.x - w.x).toBeCloseTo(ARM.hand * Math.sin((dir * Math.PI) / 180), 3);
      expect(t.y - w.y).toBeCloseTo(ARM.hand * Math.cos((dir * Math.PI) / 180), 3);
    }
  });

  it("a target out of reach is pulled in: the arm straightens toward it and never goes NaN", () => {
    const far = reachArm(500, -500, -1);
    expect(Number.isFinite(far.phi) && Number.isFinite(far.elbow)).toBe(true);
    expect(Math.abs(far.elbow)).toBeLessThan(15);
    expect(reachArm(0, 0).phi).toBeDefined();
  });

  it("at rest the hands are loosely folded in front, meeting in the middle, and the idle bird never moves them", () => {
    const poses = run(new AvatarRig({ seed: 3 }), 20, still("idle"));
    for (const k of ["armLPhi", "armRPhi", "armLElbow", "armRElbow", "armLWrist", "armRWrist", "handLOpen", "handRSpread", "handLPoint", "hop"] as const) expect(armRange(poses, k).max - armRange(poses, k).min, k).toBeLessThan(0.01);
    expect(poses[5]!.armRPhi).toBeCloseTo(REST.phi, 5);
    expect(poses[5]!.armLElbow).toBeCloseTo(REST.elbow, 5);
    expect(staticPose("idle")).toEqual(NEUTRAL_POSE);
    // The fingertips of the two hands reach (about) the middle of the body, low in front: hands, not arms, in the lower frame.
    const t = tipAt(poses[5]!, "R");
    expect(Math.abs(worldX("R", t.x) - 120)).toBeLessThan(12);
    expect(ARM.shoulderY + t.y).toBeGreaterThan(215);
    expect(REST.open).toBeGreaterThan(0.3); // not a fist
    expect(REST.open).toBeLessThan(0.8); // not rigid
  });
});

describe("arms and hands: gestures", () => {
  it("every gesture lasts between 1.2 and 2 seconds, with a rise, a hold and a fall", () => {
    for (const g of GESTURES) {
      const d = gestureDuration(g);
      expect(d, g).toBeGreaterThanOrEqual(1.2);
      expect(d, g).toBeLessThanOrEqual(2);
      const s = GESTURE_SHAPES[g];
      expect(s.rise).toBeGreaterThan(0.1);
      expect(s.fall).toBeGreaterThan(0.25);
    }
    expect(gestureDuration("none")).toBe(0);
  });

  it("each gesture moves the hands and then returns them to rest; the pose never leaves its bounds", () => {
    for (const g of GESTURES) {
      const poses = play(g, 4);
      expect(Math.max(...poses.map((p) => Math.max(fromRest(p, "L"), fromRest(p, "R")))), g).toBeGreaterThan(30);
      const end = poses[poses.length - 1]!;
      expect(Math.abs(end.armLPhi - REST.phi), `${g} settles`).toBeLessThan(1.5);
      expect(Math.abs(end.armRPhi - REST.phi), `${g} settles`).toBeLessThan(1.5);
      expect(Math.abs(end.handLSpread - REST.spread) + Math.abs(end.handRSpread - REST.spread), `${g} spread`).toBeLessThan(0.05);
      expect(end.handLPoint + end.handRPoint).toBeLessThan(0.05);
      for (const p of poses) for (const k of POSE_KEYS) {
        expect(Number.isFinite(p[k]), `${g}.${k}`).toBe(true);
        expect(p[k], `${g}.${k}`).toBeGreaterThanOrEqual(POSE_BOUNDS[k][0] - 1e-9);
        expect(p[k], `${g}.${k}`).toBeLessThanOrEqual(POSE_BOUNDS[k][1] + 1e-9);
      }
    }
  });

  it("eases in and out: the hands leave rest gradually and arrive gradually", () => {
    const poses = play("celebrate", 2.5, { seed: 4 });
    const lift = poses.map((p) => Math.max(fromRest(p, "L"), fromRest(p, "R")));
    const peak = Math.max(...lift);
    expect(lift[2]!).toBeLessThan(peak * 0.5); // the first frames barely move
    for (let i = 1; i < lift.length; i++) expect(Math.abs(lift[i]! - lift[i - 1]!), `frame ${i}`).toBeLessThan(12); // never a jump (px per frame)
  });

  it("wave: one open hand goes up beside the head and wags from side to side; the other stays down", () => {
    const poses = play("wave", 1.8);
    const up = leadSide(poses);
    const other = up === "L" ? "R" : "L";
    expect(Math.max(...poses.map((p) => -wristAt(p, up).y))).toBeGreaterThan(20); // the wrist rises above the shoulder
    expect(Math.min(...poses.map((p) => wristAt(p, other).y))).toBeGreaterThan(REST_WRIST.y - 1); // supporting arm relaxes downward
    expect(Math.max(...poses.map((p) => wristAt(p, other).y))).toBeGreaterThan(85);
    const wag = poses.slice(40, 90).map((p) => (up === "L" ? p.armLWrist : p.armRWrist));
    expect(Math.max(...wag) - Math.min(...wag)).toBeGreaterThan(25); // the hand wags
    expect(armRange(poses, up === "L" ? "handLOpen" : "handROpen").max).toBeGreaterThan(0.95); // palm open, fingers up
  });

  it("celebrate: both arms up with open, fanned hands, a bounce, chin up and a big smile", () => {
    const poses = play("celebrate", 1.8);
    for (const side of ["L", "R"] as const) {
      expect(Math.max(...poses.map((p) => -wristAt(p, side).y)), side).toBeGreaterThan(60);
      expect(armRange(poses, `hand${side}Open` as keyof AvatarPose).max).toBeGreaterThan(0.95);
      expect(armRange(poses, `hand${side}Spread` as keyof AvatarPose).max).toBeGreaterThan(0.85);
    }
    expect(armRange(poses, "hop").max).toBeGreaterThan(2);
    expect(armRange(poses, "pitch").min).toBeLessThan(-0.15);
    expect(armRange(poses, "smile").max).toBeGreaterThan(0.8);
  });

  it("think: the hand comes to the chin with the index finger extended along the cheek", () => {
    const poses = play("think", 1.8);
    const goal = fingertipOf(CHIN.phi, CHIN.elbow, CHIN.wrist);
    const near = (p: AvatarPose) => Math.min(...(["L", "R"] as const).map((s) => { const t = tipAt(p, s); return Math.hypot(t.x - goal.x, t.y - goal.y); }));
    expect(best(poses, near)).toBeLessThan(6);
    const peakR = poses.reduce((a, p) => (Math.max(p.handLPoint, p.handRPoint) > Math.max(a.handLPoint, a.handRPoint) ? p : a));
    expect(Math.max(peakR.handLPoint, peakR.handRPoint)).toBeGreaterThan(0.9);
    expect(armRange(poses, "gazeY").min).toBeLessThan(-2); // and the eyes look up
  });

  it("salute: the flat hand goes up to the brow, quickly", () => {
    const poses = play("salute", 1.3);
    const g = aimArm(0, -102, -1, 250);
    const goal = fingertipOf(g.phi, g.elbow, g.wrist);
    const near = (p: AvatarPose) => Math.min(...(["L", "R"] as const).map((s) => { const t = tipAt(p, s); return Math.hypot(t.x - goal.x, t.y - goal.y); }));
    expect(best(poses, near)).toBeLessThan(6);
    expect(goal.y + ARM.shoulderY).toBeLessThan(110); // at the height of the brow
    expect(gestureDuration("salute")).toBeLessThan(gestureDuration("wave"));
  });

  it("point: one arm out to the side with only the index finger extended, the head turns toward it", () => {
    const poses = play("point", 1.6);
    const up = leadSide(poses);
    const peak = poses.reduce((a, p) => ((up === "R" ? p.handRPoint : p.handLPoint) > (up === "R" ? a.handRPoint : a.handLPoint) ? p : a));
    const out = up === "R" ? 1 : -1;
    expect(up === "R" ? peak.handRPoint : peak.handLPoint).toBeGreaterThan(0.95);
    expect(up === "R" ? peak.handROpen : peak.handLOpen).toBeLessThan(0.05); // the other fingers curled
    expect(tipAt(peak, up).x).toBeGreaterThan(70); // well out from the shoulder
    expect(Math.sign(peak.yaw)).toBe(out);
  });

  it("shrug: both palms at shoulder height, the shoulders up, the head on one side", () => {
    const poses = play("shrug", 1.5);
    for (const side of ["L", "R"] as const) {
      expect(Math.max(...poses.map((p) => wristAt(p, side).x)), side).toBeGreaterThan(40); // hands out to the sides
      expect(armRange(poses, `hand${side}Open` as keyof AvatarPose).max).toBeGreaterThan(0.95);
    }
    expect(armRange(poses, "shrug").min).toBeLessThan(-3.5);
    expect(Math.max(...poses.map((p) => Math.abs(p.tilt)))).toBeGreaterThan(5);
  });

  it("open: palms forward at the waist; comfort: one hand over the heart and the other relaxed", () => {
    const open = play("open", 1.8);
    for (const side of ["L", "R"] as const) {
      const nearWaist = best(open, p => Math.hypot(wristAt(p, side).x - 38, wristAt(p, side).y - 60));
      expect(nearWaist, side).toBeLessThan(3);
      expect(armRange(open, `hand${side}Open`).max).toBeGreaterThan(0.95);
    }
    const comfort = play("comfort", 2);
    const peak = comfort[60]!;
    const arms = [wristAt(peak, "L"), wristAt(peak, "R")];
    expect(Math.min(...arms.map(w => Math.hypot(w.x + 45, w.y - 20)))).toBeLessThan(5);
    expect(Math.max(...arms.map(w => w.y))).toBeGreaterThan(85);
    expect(armRange(comfort, "browInnerL").max).toBeGreaterThan(8);
    expect(Math.max(...comfort.map((p) => Math.abs(p.tilt)))).toBeGreaterThan(5);
  });

  it("'none' does nothing, and playing a gesture again restarts it", () => {
    const quiet = play("none", 2);
    expect(armRange(quiet, "armRPhi").max - armRange(quiet, "armRPhi").min).toBeLessThan(0.01);
    const mem = createRigMemory();
    noteGesture(mem, "wave", 5);
    expect(mem.gestureKind).toBe("wave");
    noteGesture(mem, "none", 6);
    expect(mem.gestureKind).toBe("wave");
    noteGesture(mem, "salute", 6.5);
    expect(mem.gestureKind).toBe("salute");
    expect(mem.gestureAt).toBe(6.5);
    expect(mem.gestureCount).toBe(2);
    // Before the gesture the pose is the plain one; at the gesture's time it is not.
    const before = targetPose({ state: "idle", time: 6.4, stateTime: 3, level: 0, seed: 1 }, mem);
    const during = targetPose({ state: "idle", time: 7.0, stateTime: 3, level: 0, seed: 1 }, mem);
    expect(before.armLPhi).toBe(REST.phi);
    expect(Math.max(fromRest(during, "L"), fromRest(during, "R"))).toBeGreaterThan(40);
  });

  it("a smaller strength makes a smaller gesture", () => {
    const peak = (strength: number) => {
      const mem = createRigMemory();
      noteGesture(mem, "celebrate", 0, strength);
      let top = 0;
      for (let t = 0; t < 2; t += 0.02) top = Math.max(top, targetPose({ state: "idle", time: t, stateTime: 3, level: 0, seed: 1 }, mem).handLSpread - REST.spread);
      return top;
    };
    expect(peak(0.4)).toBeLessThan(peak(1) * 0.6);
    expect(peak(0)).toBe(0);
  });

  it("the gesture is the same for the same seed and different for another, and every moment's gesture exists", () => {
    const a = play("wave", 1.5, { seed: 11 });
    const b = play("wave", 1.5, { seed: 11 });
    expect(b).toEqual(a);
    for (const g of Object.values(MOMENT_GESTURE)) expect(WING_GESTURES).toContain(g);
    const sides = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => leadSide(play("wave", 1.5, { seed }))));
    expect(sides.size).toBe(2); // not always the same hand
  });

  it("gestures play over speaking too, and the calm window still gestures but does not beat on its own", () => {
    const speaking = play("celebrate", 1.8, { seed: 4 }, "speaking");
    expect(armRange(speaking, "handLSpread").max).toBeGreaterThan(0.85);
    const calm = play("wave", 1.8, { seed: 4, intensity: 0.5, gestures: false }, "speaking");
    expect(Math.max(...calm.map((p) => Math.max(fromRest(p, "L"), fromRest(p, "R"))))).toBeGreaterThan(40);
    const beats = run(new AvatarRig({ seed: 5, intensity: 0.5, gestures: false }), 20, still("speaking"));
    expect(Math.max(...beats.map((p) => Math.max(fromRest(p, "L"), fromRest(p, "R"))))).toBeLessThan(0.01); // no beats of its own
  });

  it("reduced motion shows no gesture", () => {
    const poses = play("celebrate", 2, { seed: 4, reduced: true });
    expect(armRange(poses, "armLPhi").max).toBeCloseTo(REST.phi, 5);
    expect(armRange(poses, "hop").max).toBe(0);
  });
});

describe("arms and hands: beats, the chin, and the tone", () => {
  it("while speaking a hand beats softly on stresses, one at a time, and the hands stay low in between", () => {
    const poses = run(new AvatarRig({ seed: 9 }), 20, still("speaking"));
    const lift = poses.map((p) => Math.max(fromRest(p, "L"), fromRest(p, "R")));
    expect(Math.max(...lift)).toBeGreaterThan(20); // a beat is visible
    expect(Math.max(...lift)).toBeLessThan(80); // but subtle: no wave-sized swing
    const flat = run(new AvatarRig({ seed: 9 }), 8, () => ({ state: "speaking", level: 0.1 }));
    expect(Math.max(...flat.slice(120).map((p) => Math.max(fromRest(p, "L"), fromRest(p, "R"))))).toBeLessThan(3);
  });

  it("while thinking the right hand comes up to the chin and the left stays down", () => {
    const poses = run(new AvatarRig({ seed: 9 }), 3, still("thinking"));
    const end = poses[poses.length - 1]!;
    const goal = fingertipOf(CHIN.phi, CHIN.elbow, CHIN.wrist);
    const tip = tipAt(end, "R");
    expect(Math.hypot(tip.x - goal.x, tip.y - goal.y)).toBeLessThan(8);
    expect(end.handRPoint).toBeGreaterThan(0.9);
    expect(end.armLPhi).toBeCloseTo(REST.phi, 1);
  });

  it("a pleased reply adds a small celebrate flutter once, a concerned one a comfort pose once, a neutral one nothing", () => {
    const flutter = (tone: AvatarTone) => {
      const rig = new AvatarRig({ seed: 6 });
      run(rig, 1, still("speaking"));
      const poses = run(rig, 6, still("speaking", tone));
      // Count separate raises of the fanned fingers over the six seconds.
      const raises = poses.reduce((n, p, i) => n + (p.handLSpread > 0.35 && (poses[i - 1]?.handLSpread ?? 0) <= 0.35 ? 1 : 0), 0);
      return { poses, raises };
    };
    const pleased = flutter("pleased");
    const concerned = flutter("concerned");
    const neutral = flutter("neutral");
    expect(armRange(pleased.poses, "handLSpread").max).toBeGreaterThan(0.3);
    expect(armRange(pleased.poses, "handLSpread").max).toBeLessThan(0.7); // smaller than a real celebrate
    expect(pleased.raises).toBeLessThanOrEqual(1);
    // Comfort: the hands rise to the chest and come toward each other.
    expect(best(concerned.poses, (p) => wristAt(p, "R").y)).toBeLessThan(REST_WRIST.y - 6);
    expect(Math.max(...neutral.poses.map((p) => Math.max(p.handLSpread, p.handRSpread)))).toBeLessThan(0.4);
  });
});

