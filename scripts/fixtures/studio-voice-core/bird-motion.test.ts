import { describe, expect, it } from "vitest";
import { resolveCompanionClip, COMPANION_MOTION_CLIPS, BIRD_MOTION_CLIPS, BIRD_MOTION_CORE_CLIPS, BIRD_MOTION_DECODE_GRACE, BIRD_MOTION_GESTURE_CLIPS, BIRD_MOTION_IDLE_CLIPS, BIRD_VISEMES, BIRD_EXPRESSIONS, BIRD_FACE_ANGLES, BIRD_DANCE_CLIPS, MOTION_MOMENTS, BirdMotionLedger, BirdMotionRig, isOptionalMotionClip, parseBirdMotionManifest, type BirdMotionManifest } from "../../../lib/studio/voice/bird-motion";

function pack(waveBoth = false): BirdMotionManifest {
  const box = { x: 10, y: 10, width: 80, height: 80 };
  const m: BirdMotionManifest = { version: 1, bird: "bob", size: { width: 100, height: 100 }, anchor: { x: 50, y: 90 }, bbox: box, neutral: "idle_breathe_0", totalBytes: 1000, uniqueFrames: 0, visemes: [...BIRD_VISEMES], talking: { neutral: "talk_neutral", left: "talk_left", right: "talk_right" }, frames: {}, clips: {} };
  for (const name of [...BIRD_MOTION_CLIPS, ...(waveBoth ? ["wave_both"] : [])]) {
    const count = name.startsWith("talk_") ? 9 : name === "blink" ? 4 : 8;
    const frames = Array.from({ length: count }, (_, i) => `${name}_${i}`);
    m.clips[name] = { frames, fps: name.startsWith("talk_") || name === "blink" ? 20 : name === "idle_breathe" ? 4 : 12, ...(name === "idle_breathe" ? { loop: [0, count] as [number, number] } : {}), ...(name === "head_tilt" ? { hold: 3 } : {}) };
    for (const frame of frames) m.frames[frame] = { src: `${frame}.webp`, bbox: box, sourceHash: "generated-source" };
  }
  m.uniqueFrames = Object.keys(m.frames).length;
  return m;
}
const step = (r: BirdMotionRig, seconds: number, state: "idle" | "listening" | "thinking" | "speaking" = "idle", level = 0) => {
  let pose = r.step(0, { state, level });
  for (let i = 0; i < Math.round(seconds * 60); i++) pose = r.step(1 / 60, { state, level });
  return pose;
};

describe("generated bird clip timing", () => {
  it("validates a complete pack, frame references, relative paths and loop bounds", () => {
    expect(parseBirdMotionManifest(pack()).bird).toBe("bob");
    for (const mutate of [
      (m: BirdMotionManifest) => { delete m.clips.wave; },
      (m: BirdMotionManifest) => { m.clips.wave!.frames[0] = "absent"; },
      (m: BirdMotionManifest) => { m.frames[m.neutral]!.src = "../unregistered.webp"; },
      (m: BirdMotionManifest) => { m.clips.idle_breathe!.loop = [4, 40]; },
      (m: BirdMotionManifest) => { m.clips.head_tilt!.hold = -1; },
      (m: BirdMotionManifest) => { m.visemes.reverse(); },
      (m: BirdMotionManifest) => { m.face = { manifest: "../private.json", totalBytes: 1000 }; },
      (m: BirdMotionManifest) => { m.variant = "face"; },
      (m: BirdMotionManifest) => { m.variant = "face"; m.crop = { x: 0.8, y: 0, width: 0.5, height: 0.5 }; m.nativeCanvas = { width: 200, height: 200 }; },
      (m: BirdMotionManifest) => { m.variant = "face"; m.crop = { x: 0, y: 0, width: 0.5, height: 0.5 }; m.nativeCanvas = { width: 100, height: 200 }; },
      (m: BirdMotionManifest) => { m.nativeCanvas = { width: NaN, height: 200 }; },
    ]) { const m = pack(); mutate(m); expect(() => parseBirdMotionManifest(m)).toThrow(); }
    const face = pack(); face.variant = "face"; face.crop = { x: 0.25, y: 0.05, width: 0.5, height: 0.5 }; face.nativeCanvas = { width: 200, height: 200 };
    expect(parseBirdMotionManifest(face).crop?.y).toBe(0.05);
  });
  it("accepts an optional two-wing wave and validates its frames and timing when supplied", () => {
    expect(parseBirdMotionManifest(pack(true)).clips.wave_both!.frames[0]).toBe("wave_both_0");
    for (const mutate of [
      (m: BirdMotionManifest) => { m.clips.wave_both!.frames[0] = "absent"; },
      (m: BirdMotionManifest) => { m.clips.wave_both!.fps = NaN; },
      (m: BirdMotionManifest) => { m.clips.wave_both!.loop = [0, 40]; },
    ]) { const m = pack(true); mutate(m); expect(() => parseBirdMotionManifest(m)).toThrow("Invalid bird motion clip: wave_both"); }
  });
  it("uses clip fps and real ordered frames rather than frame-rate dependent stepping", () => {
    const rig = new BirdMotionRig(pack());
    expect(step(rig, 0.49).frame).toBe("idle_breathe_1");
    expect(step(rig, 0.02).frame).toBe("idle_breathe_2");
    expect(step(rig, 1.5).frame).toBe("idle_breathe_0");
  });
  it("crossfades clips for 160 ms and gives explicit gestures priority over cues and state changes", () => {
    const rig = new BirdMotionRig(pack());
    const before = step(rig, 0.1).frame;
    rig.cue("nod"); rig.gesture("wave"); rig.cue("perk");
    const start = rig.step(0, { state: "speaking", level: 1 });
    expect(start).toMatchObject({ clip: "wave", previousFrame: before, opacity: 0 });
    expect(step(rig, 0.08, "thinking").opacity).toBeCloseTo(0.5, 1);
    expect(step(rig, 0.1, "listening").previousFrame).toBeNull();
    expect(step(rig, 0.6, "listening").clip).toBe("head_tilt");
  });
  it.each([false, true])("plays celebration with optional two-wing wave=%s, preserving priority, restart and completion", (waveBoth) => {
    const rig = new BirdMotionRig(parseBirdMotionManifest(pack(waveBoth)));
    const clip = waveBoth ? "wave_both" : "welcome";
    rig.cue("nod"); rig.gesture("celebrate"); rig.cue("perk");
    expect(rig.step(0, { state: "speaking", level: 1 })).toMatchObject({ clip, frame: `${clip}_0`, opacity: 0 });
    expect(step(rig, 0.1, "thinking").frame).toBe(`${clip}_1`);
    rig.gesture("celebrate");
    expect(rig.step(0, { state: "thinking" })).toMatchObject({ clip, frame: `${clip}_0` });
    expect(step(rig, 0.8, "speaking", 1).clip).toBe("talk_neutral");
  });
  it.each([false, true])("keeps comfort on welcome with optional two-wing wave=%s", (waveBoth) => {
    const rig = new BirdMotionRig(parseBirdMotionManifest(pack(waveBoth)));
    rig.gesture("comfort");
    expect(rig.step(0, { state: "speaking", level: 1 })).toMatchObject({ clip: "welcome", frame: "welcome_0" });
  });
  it("holds the generated listening tilt, nods occasionally and looks away while thinking", () => {
    const rig = new BirdMotionRig(pack());
    expect(step(rig, 1.5, "listening").frame).toBe("head_tilt_3");
    const clips = new Set<string>();
    for (let i = 0; i < 900; i++) clips.add(rig.step(1 / 60, { state: "listening" }).clip);
    expect(clips.has("nod")).toBe(true);
    expect(rig.step(0, { state: "thinking" }).clip).toBe("look_up");
    for (let i = 0; i < 1800; i++) clips.add(rig.step(1 / 60, { state: "thinking" }).clip);
    expect(clips.has("look_left") || clips.has("look_right")).toBe(true);
  });
  it("smooths existing amplitude, uses all nine visemes and changes talking head pose", () => {
    const rig = new BirdMotionRig(pack());
    const shapeIndices = new Set<number>();
    const clips = new Set<string>();
    for (const level of [0, 0.08, 0.25, 0.9]) for (let i = 0; i < 360; i++) {
      const p = rig.step(1 / 60, { state: "speaking", level });
      clips.add(p.clip); shapeIndices.add(Number(p.frame.split("_").at(-1)));
      expect(p.level).toBeGreaterThanOrEqual(0); expect(p.level).toBeLessThanOrEqual(1);
    }
    expect(shapeIndices.size).toBe(9);
    expect(clips.size).toBe(3);
    const quiet = new BirdMotionRig(pack());
    expect(quiet.step(1 / 60, { state: "speaking", level: 1 }).level).toBeLessThan(0.3);
  });
  it("rejects malformed deltas throughout the clock and amplitude smoother", () => {
    const rig = new BirdMotionRig(pack());
    for (const dt of [NaN, Infinity, -Infinity, -12, 100000, 0]) {
      const p = rig.step(dt, { state: "speaking", level: 0.8 });
      expect(Number.isFinite(p.level)).toBe(true); expect(p.level).toBeGreaterThanOrEqual(0); expect(p.level).toBeLessThanOrEqual(1); expect(p.frame).toBeTruthy();
    }
    const normal = new BirdMotionRig(pack()); const gap = new BirdMotionRig(pack());
    expect(gap.step(100000, { state: "speaking", level: 0.8 })).toEqual(normal.step(0.25, { state: "speaking", level: 0.8 }));
  });
  it("is seeded and schedules idle blinks 3–6 seconds apart", () => {
    const a = new BirdMotionRig(pack(), { seed: 42 });
    const b = new BirdMotionRig(pack(), { seed: 42 });
    const blinks: number[] = [];
    let previous = "";
    for (let i = 0; i < 3600; i++) {
      const p = a.step(1 / 60, { state: "idle" });
      expect(p).toEqual(b.step(1 / 60, { state: "idle" }));
      if (p.clip === "blink" && previous !== "blink") blinks.push(i / 60);
      previous = p.clip;
    }
    expect(blinks.length).toBeGreaterThan(8);
    // A brief body clip may postpone a due blink until the action finishes.
    for (let i = 1; i < blinks.length; i++) expect(blinks[i]! - blinks[i - 1]!).toBeGreaterThanOrEqual(3);
    expect(blinks[0]).toBeGreaterThanOrEqual(3); expect(blinks[0]).toBeLessThanOrEqual(6);
  });
  it("reduced motion only breathes and blinks even during speech, cues and gestures", () => {
    const rig = new BirdMotionRig(pack(true), { reduced: true });
    const clips = new Set<string>();
    for (let i = 0; i < 1800; i++) {
      rig.gesture(i % 2 ? "celebrate" : "wave"); rig.cue("nod");
      const p = rig.step(1 / 60, { state: "speaking", level: 1 });
      clips.add(p.clip); expect(p.level).toBe(0);
    }
    expect([...clips].sort()).toEqual(["blink", "idle_breathe"]);
    rig.reduced = false; rig.gesture("celebrate"); expect(rig.step(0, { state: "speaking" }).clip).toBe("wave_both");
    rig.reduced = true;
    expect(rig.step(0, { state: "speaking" })).toMatchObject({ clip: "idle_breathe", previousFrame: null, opacity: 1 });
  });
});

function reactions(): BirdMotionManifest {
  const m = pack(true);
  for (const expression of BIRD_EXPRESSIONS) for (const angle of BIRD_FACE_ANGLES) {
    const name = `expr_${expression}_${angle}`, key = `${name}_key`, alt = `${name}_alt`;
    for (const id of [key, alt]) m.frames[id] = { src: `${id}.webp`, bbox: m.bbox, sourceHash: "generated-reaction" };
    m.clips[name] = { frames: expression === "laugh" ? [m.neutral, m.neutral, key, alt, key, alt, key] : [m.neutral, m.neutral, key], fps: 12, hold: 2 };
  }
  for (const name of BIRD_DANCE_CLIPS) m.clips[name] = { frames: [...m.clips.wave_both!.frames], fps: 8, loop: [0, 8] };
  m.uniqueFrames = Object.keys(m.frames).length;
  return m;
}

describe("classified reaction sequences", () => {
  it("validates all supplied optional clips, rejects unknown names and bounds opt-in compressed budgets", () => {
    expect(parseBirdMotionManifest(reactions()).clips.expr_happy_front).toBeDefined();
    for (const mutate of [
      (m: BirdMotionManifest) => { m.clips.expr_happy_left!.frames[0] = "missing"; },
      (m: BirdMotionManifest) => { m.clips.dance_bounce!.fps = Infinity; },
      (m: BirdMotionManifest) => { m.clips.expr_laugh_alt_front = m.clips.blink!; },
      (m: BirdMotionManifest) => { m.packBudgetMiB = 8.1; },
      (m: BirdMotionManifest) => { m.packBudgetMiB = 9; },
      (m: BirdMotionManifest) => { m.totalBytes = 6 * 1024 * 1024 + 1; },
      (m: BirdMotionManifest) => { m.packBudgetMiB = 8; m.totalBytes = 8 * 1024 * 1024 + 1; },
    ]) { const m = reactions(); mutate(m); expect(() => parseBirdMotionManifest(m)).toThrow(); }
    const opted = reactions(); opted.packBudgetMiB = 8; opted.totalBytes = 8 * 1024 * 1024;
    expect(parseBirdMotionManifest(opted).totalBytes).toBe(opted.totalBytes);
  });
  it.each(Object.entries(MOTION_MOMENTS))("maps %s through its expression beat, gesture and final expression", (kind, mapping) => {
    const rig = new BirdMotionRig(reactions(), { seed: 1 });
    rig.moment(kind as keyof typeof MOTION_MOMENTS);
    const first = rig.step(0, { state: "thinking" });
    expect(first.expression).toBe(mapping.expressions[0]);
    const clips = new Set<string>(), expressions = new Set<string>();
    for (let i = 0; i < 300; i++) { const pose = rig.step(1 / 60, { state: "thinking" }); clips.add(pose.clip); if (pose.expression) expressions.add(pose.expression); }
    expect(clips.has(mapping.gesture)).toBe(true);
    expect([...expressions]).toEqual([...mapping.expressions]);
    expect(rig.step(0, { state: "thinking" }).expression).toBe(mapping.expressions.at(-1));
  });
  it("uses the currently faced angle and freezes the reaction clock while speaking visemes resume", () => {
    const rig = new BirdMotionRig(reactions(), { seed: 2 });
    let pose = rig.step(0, { state: "speaking", level: .7 });
    for (let i = 0; i < 600 && pose.clip !== "talk_left"; i++) pose = rig.step(1 / 60, { state: "speaking", level: .7 });
    expect(pose.clip).toBe("talk_left");
    rig.moment("bad_news");
    expect(rig.step(0, { state: "thinking" })).toMatchObject({ clip: "expr_concerned_left", expression: "concerned", angle: "left" });
    const held = rig.step(.2, { state: "thinking" });
    rig.cue("nod");
    const firstWord = rig.step(0, { state: "speaking", level: .8 });
    expect(firstWord.clip).toMatch(/^talk_/); expect(firstWord.expression).toBeNull();
    const speaking = step(rig, 3, "speaking", .8); expect(speaking.clip).toMatch(/^talk_/); expect(speaking.expression).toBeNull();
    const paused = rig.step(0, { state: "speaking", speechPaused: true });
    expect(paused.frame).toBe(`expr_concerned_${speaking.angle}_key`);
    expect(paused.angle).toBe(speaking.angle);
    expect(held.frame).toBe("expr_concerned_left_key");
    rig.moment(null); expect(rig.step(0, { state: "idle" }).expression).toBeNull();
  });
  it("skips missing angle expressions and dances, retaining the legacy gesture fallback", () => {
    const m = pack(), rig = new BirdMotionRig(m);
    rig.moment("congrats"); expect(rig.step(0, { state: "thinking" }).clip).toBe("welcome");
    const partial = reactions(); delete partial.clips.expr_happy_left;
    const side = new BirdMotionRig(partial);
    let pose = side.step(0, { state: "speaking" });
    for (let i = 0; i < 600 && pose.clip !== "talk_left"; i++) pose = side.step(1 / 60, { state: "speaking" });
    expect(pose.angle).toBe("left"); side.moment("thanks");
    expect(side.step(0, { state: "thinking" })).toMatchObject({ clip: "present", expression: null });
    // Missing optional clips never invalidate the standard pack or invent a replacement asset.
    expect(() => parseBirdMotionManifest(partial)).not.toThrow();
    const danceLess = reactions(); delete danceLess.clips.dance_bounce; delete danceLess.clips.dance_shimmy;
    const quiet = new BirdMotionRig(danceLess, { seed: 3 }); quiet.moment("congrats");
    for (let i = 0; i < 900; i++) expect(quiet.step(1 / 60, { state: "idle" }).dancing).toBe(false);
  });
  it("keeps the event's chosen gesture for legacy and missing-angle packs, including explicit none", () => {
    const legacy = new BirdMotionRig(pack());
    legacy.moment("instruction", "point");
    expect(legacy.step(0, { state: "thinking" })).toMatchObject({ clip: "point", expression: null });
    const partial = reactions(); delete partial.clips.expr_curious_left;
    const side = new BirdMotionRig(partial);
    let pose = side.step(0, { state: "speaking" });
    for (let i = 0; i < 600 && pose.angle !== "left"; i++) pose = side.step(1 / 60, { state: "speaking" });
    expect(pose.angle).toBe("left");
    side.moment("instruction", "point");
    expect(side.step(0, { state: "thinking" }).clip).toBe("point");
    const none = new BirdMotionRig(pack()); none.moment("instruction", "none");
    expect(none.step(0, { state: "idle" }).clip).toBe("idle_breathe");
    const available = new BirdMotionRig(reactions()); available.moment("instruction", "point");
    const clips = new Set<string>();
    for (let i = 0; i < 180; i++) clips.add(available.step(1 / 60, { state: "thinking" }).clip);
    expect(clips.has("nod")).toBe(true); expect(clips.has("point")).toBe(false);
  });
  it("holds a genuine expression key under reduced motion, with no laugh shake, dance, visemes or crossfade", () => {
    const animated = new BirdMotionRig(reactions()); animated.moment("congrats");
    const laughFrames = new Set<string>();
    for (let i = 0; i < 240; i++) { const p = animated.step(1 / 60, { state: "idle" }); if (p.expression === "laugh") laughFrames.add(p.frame); }
    expect(laughFrames.has("expr_laugh_front_alt")).toBe(true);
    const rig = new BirdMotionRig(reactions(), { seed: 3, reduced: true }); rig.moment("congrats");
    const frames = new Set<string>();
    for (let i = 0; i < 900; i++) {
      const pose = rig.step(1 / 60, { state: "speaking", level: 1 }); frames.add(pose.frame);
      expect(pose).toMatchObject({ expression: "laugh", dancing: false, level: 0, previousFrame: null, opacity: 1 });
    }
    expect([...frames]).toEqual(["expr_laugh_front_key"]);
    rig.moment(null); expect(rig.step(0, { state: "idle" }).clip).toBe("idle_breathe");
  });
  it("uses one-in-three congratulations, never consecutive, at most one dance per minute, and finite loops", () => {
    const rig = new BirdMotionRig(reactions(), { seed: 3 });
    const danced: number[] = [], starts: number[] = []; let now = 0;
    for (let event = 0; event < 7; event++) {
      rig.moment("congrats"); let dancing = false, previous = false;
      for (let i = 0; i < 720; i++) {
        const pose = rig.step(1 / 60, { state: "idle" }); now += 1 / 60;
        if (pose.dancing && !previous) starts.push(now);
        dancing ||= pose.dancing; previous = pose.dancing;
      }
      expect(rig.step(0, { state: "idle" }).dancing).toBe(false);
      if (dancing) danced.push(event);
      step(rig, 53); now += 53;
    }
    expect(danced).toEqual([0, 3, 6]);
    for (let i = 1; i < starts.length; i++) expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(60);
    // Back-to-back events, including the next one-in-three candidate, remain inside the minute guard.
    const close = new BirdMotionRig(reactions(), { seed: 3 }); let count = 0, previous = false;
    for (let event = 0; event < 7; event++) { close.moment("congrats"); for (let i = 0; i < 360; i++) { const pose = close.step(1 / 60, { state: "idle" }); if (pose.dancing && !previous) count++; previous = pose.dancing; } }
    expect(count).toBe(1);
  });
  it("shares cadence and its original seed across remounts, without consecutive congratulations dancing", () => {
    let now = 0;
    const ledger = new BirdMotionLedger({ seed: 3, now: () => now });
    const danced: number[] = [];
    for (let event = 0; event < 7; event++) {
      now = event * 65;
      const rig = new BirdMotionRig(reactions(), { seed: event + 1, ledger });
      rig.moment("congrats", undefined, event);
      let dancing = false;
      for (let i = 0; i < 480; i++) { now += 1 / 60; dancing = rig.step(1 / 60, { state: "idle" }).dancing || dancing; }
      if (dancing) danced.push(event);
    }
    expect(danced).toEqual([0, 3, 6]);
  });
  it("enforces the shared wall-time cooldown across fresh rigs, hidden time and malformed clocks", () => {
    let now = 100;
    const ledger = new BirdMotionLedger({ seed: 3, now: () => now });
    const event = (at: number) => {
      const rig = new BirdMotionRig(reactions(), { seed: 3, ledger }); rig.moment("congrats", undefined, at);
      let danced = false;
      // Playback time alone must never advance a shared ledger's minute guard.
      for (let i = 0; i < 480; i++) danced = rig.step(1 / 60, { state: "idle" }).dancing || danced;
      return danced;
    };
    expect(event(0)).toBe(true);
    expect(event(1)).toBe(false); expect(event(2)).toBe(false);
    now = 159.99; expect(event(3)).toBe(false);
    for (const [i, invalid] of [NaN, Infinity, -Infinity, -100].entries()) { now = invalid; expect(event(4 + i)).toBe(false); }
    // New event IDs continue increasing even after a host clock fault.
    now = 160;
    const results = [event(20), event(21), event(22)];
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it("does not start an older queued dance after another avatar handles a newer congratulation", () => {
    let now = 0;
    const ledger = new BirdMotionLedger({ seed: 3, now: () => now });
    const old = new BirdMotionRig(reactions(), { ledger }); old.moment("congrats", undefined, 0);
    step(old, 1, "speaking");
    for (const at of [1, 2]) { const rig = new BirdMotionRig(reactions(), { ledger }); rig.moment("congrats", undefined, at); rig.step(0, { state: "idle" }); }
    const newer = new BirdMotionRig(reactions(), { ledger }); newer.moment("congrats", undefined, 3);
    let danced = false;
    for (let i = 0; i < 480; i++) danced = newer.step(1 / 60, { state: "idle" }).dancing || danced;
    expect(danced).toBe(true);
    now = 90;
    for (let i = 0; i < 480; i++) expect(old.step(1 / 60, { state: "idle" }).dancing).toBe(false);
  });
  it("consumes still-set and older events once per call, including their gesture, without recounting", () => {
    let now = 0;
    const ledger = new BirdMotionLedger({ seed: 3, now: () => now });
    const first = new BirdMotionRig(reactions(), { ledger }); first.moment("congrats", "celebrate", 100);
    first.step(0, { state: "idle" });
    const remount = new BirdMotionRig(reactions(), { ledger });
    for (const at of [100, 99, NaN, Infinity]) {
      remount.moment("congrats", "celebrate", at);
      expect(remount.step(0, { state: "idle" }).moment).toBeNull();
    }
    remount.gesture("celebrate", 100); expect(remount.step(0, { state: "idle" }).clip).toBe("idle_breathe");
    remount.moment(null); remount.moment("congrats", "celebrate", 100);
    expect(remount.step(0, { state: "idle" }).moment).toBeNull();
    now = 65;
    const danced: number[] = [];
    for (const at of [101, 102, 103]) {
      remount.moment("congrats", "celebrate", at);
      let dancing = false;
      for (let i = 0; i < 480; i++) dancing = remount.step(1 / 60, { state: "idle" }).dancing || dancing;
      if (dancing) danced.push(at);
    }
    expect(danced).toEqual([103]);
    const newCall = new BirdMotionRig(reactions(), { ledger: new BirdMotionLedger({ seed: 3, now: () => now }) });
    newCall.moment("congrats", "celebrate", 100);
    expect(newCall.step(0, { state: "idle" }).moment).toBe("congrats");
  });
  it("an independent explicit gesture interrupts a reaction, and a new moment restarts it", () => {
    const rig = new BirdMotionRig(reactions()); rig.moment("bad_news"); step(rig, .2, "thinking");
    rig.gesture("point"); expect(rig.step(0, { state: "thinking" })).toMatchObject({ clip: "point", expression: null });
    rig.moment("idea"); expect(rig.step(0, { state: "thinking" }).expression).toBe("surprised");
  });
});

/** A decode store stand-in: clips listed in `ready` are drawable; `request` records asks and reports whether they can load. */
function source(initial: Iterable<string>, canLoad: boolean | ((clips: readonly string[]) => boolean) = true) {
  const ready = new Set(initial), asked: string[][] = [], prefetched: string[][] = [];
  return { ready, asked, prefetched, clips: {
    ready: (clip: string) => ready.has(clip),
    request: (clips: readonly string[]) => { asked.push([...clips]); return typeof canLoad === "function" ? canLoad(clips) : canLoad; },
    prefetch: (clips: readonly string[]) => { prefetched.push([...clips]); },
  } };
}
const standard = (m: BirdMotionManifest) => Object.keys(m.clips).filter((name) => !isOptionalMotionClip(name));

describe("clips that decode on demand", () => {
  it("splits the standard clips into core, gestures and idle filler, and marks only reaction clips optional", () => {
    expect([...BIRD_MOTION_CORE_CLIPS, ...BIRD_MOTION_GESTURE_CLIPS, ...BIRD_MOTION_IDLE_CLIPS].sort()).toEqual([...BIRD_MOTION_CLIPS].sort());
    expect(BIRD_MOTION_CLIPS.some(isOptionalMotionClip)).toBe(false);
    expect(Object.keys(reactions().clips).filter(isOptionalMotionClip)).toHaveLength(1 + 27 + 2);
  });
  it("waits briefly for an undecoded expression, then plays the full reaction once it decodes", () => {
    const m = reactions(), s = source(standard(m));
    const rig = new BirdMotionRig(m, { clips: s.clips });
    rig.moment("thanks");
    expect(rig.step(0, { state: "thinking" }).expression).toBeNull();
    expect(s.asked).toEqual([["expr_happy_front", "present"]]);
    // Spare angles go to the background, so they can never crowd out what the moment shows first.
    expect(s.prefetched).toEqual([["expr_happy_left", "expr_happy_right"]]);
    step(rig, 0.2, "thinking");
    s.ready.add("expr_happy_front"); s.ready.add("expr_happy_left"); s.ready.add("expr_happy_right");
    expect(rig.step(1 / 60, { state: "thinking" })).toMatchObject({ clip: "expr_happy_front", expression: "happy", moment: "thanks" });
  });
  it("uses the existing gesture fallback after the grace, never drawing an undecoded frame or stalling", () => {
    const m = reactions(), s = source(standard(m));
    const rig = new BirdMotionRig(m, { clips: s.clips, seed: 5 });
    rig.moment("thanks");
    const frames = new Set<string>(); let pose = rig.step(0, { state: "idle" });
    for (let t = 0; t < BIRD_MOTION_DECODE_GRACE - 0.05; t += 1 / 60) {
      pose = rig.step(1 / 60, { state: "idle" }); frames.add(pose.frame);
      expect(pose.expression).toBeNull(); expect(s.ready.has(pose.clip)).toBe(true);
    }
    expect(frames.size).toBeGreaterThan(1); // still breathing while it waits
    pose = step(rig, 0.1);
    expect(pose).toMatchObject({ clip: "present", expression: null });
    for (let i = 0; i < 600; i++) expect(s.ready.has(rig.step(1 / 60, { state: "idle" }).clip)).toBe(true);
  });
  it("does not wait at all when the clip cannot be decoded under the budget", () => {
    const m = reactions(), s = source(standard(m), false);
    const rig = new BirdMotionRig(m, { clips: s.clips });
    rig.moment("greeting");
    expect(rig.step(0, { state: "idle" })).toMatchObject({ clip: "wave", expression: null });
  });
  it("holds celebrate while its two-wing wave decodes, then falls back to welcome", () => {
    const m = reactions(), s = source(standard(m));
    const rig = new BirdMotionRig(m, { clips: s.clips });
    rig.gesture("celebrate");
    expect(rig.step(0, { state: "idle" }).clip).toBe("idle_breathe");
    expect(s.asked).toEqual([["wave_both"]]);
    expect(step(rig, 0.3).clip).toBe("idle_breathe");
    expect(step(rig, 0.35).clip).toBe("welcome");
    const ready = new BirdMotionRig(m, { clips: source([...standard(m), "wave_both"]).clips });
    ready.gesture("celebrate"); expect(ready.step(0, { state: "idle" }).clip).toBe("wave_both");
  });
  it("plays idle filler only from decoded clips, fetches the chosen one for later, and returns to the base pose if its clip is released", () => {
    const m = pack(), core: string[] = [...BIRD_MOTION_CORE_CLIPS];
    const s = source(core), rig = new BirdMotionRig(m, { clips: s.clips, seed: 9 });
    const clips = new Set<string>();
    for (let i = 0; i < 60 * 90; i++) clips.add(rig.step(1 / 60, { state: "idle" }).clip);
    expect([...clips].every((clip) => core.includes(clip))).toBe(true);
    // Undecoded filler was asked for (for next time) while a decoded look played instead.
    expect(s.asked.flat().some((clip) => !core.includes(clip))).toBe(true); expect(clips.has("look_left") || clips.has("look_right")).toBe(true);
    s.ready.add("wave"); rig.gesture("wave"); expect(rig.step(0, { state: "idle" }).clip).toBe("wave");
    s.ready.delete("wave"); expect(rig.step(1 / 60, { state: "idle" }).clip).toBe("idle_breathe");
  });
  it("asks for a due dance right after the first beat and before spare angles, and only when it is due", () => {
    let now = 0;
    const ledger = new BirdMotionLedger({ seed: 3, now: () => now });
    const m = reactions(), s = source(standard(m));
    const rig = new BirdMotionRig(m, { ledger, clips: s.clips }); rig.moment("congrats", undefined, 1);
    rig.step(0, { state: "idle" });
    expect(s.asked).toEqual([["expr_happy_front", "expr_laugh_front", "wave_both"], ["dance_bounce"]]);
    expect(s.prefetched).toEqual([["expr_happy_left", "expr_happy_right", "expr_laugh_left", "expr_laugh_right"]]);
    for (let i = 0; i < 60; i++) rig.step(1 / 60, { state: "idle" });
    // The next congratulation (one in three) is not due: no dance is fetched.
    const quiet = source(standard(m)), next = new BirdMotionRig(m, { ledger, clips: quiet.clips }); next.moment("congrats", undefined, 2);
    next.step(0, { state: "idle" });
    expect(quiet.asked.flat().some((clip) => clip.startsWith("dance_"))).toBe(false);
    const reduced = source(standard(m)), still = new BirdMotionRig(m, { ledger: new BirdMotionLedger({ seed: 3 }), clips: reduced.clips, reduced: true });
    still.moment("congrats", undefined, 1); still.step(0, { state: "idle" });
    expect(reduced.asked.flat().some((clip) => clip.startsWith("dance_"))).toBe(false);
  });
  it("keeps asking for a due dance that could not fit yet, and dances once it decodes in time", () => {
    const m = reactions(), ready = [...standard(m), ...Object.keys(m.clips).filter((name) => name.startsWith("expr_") || name === "wave_both")];
    let room = false;
    const s = source(ready, (clips) => !clips.some((clip) => clip.startsWith("dance_")) || room);
    const rig = new BirdMotionRig(m, { ledger: new BirdMotionLedger({ seed: 3, now: () => 100 }), clips: s.clips }); rig.moment("congrats", undefined, 1);
    rig.step(0, { state: "idle" });
    step(rig, 1);
    const asks = s.asked.filter((clips) => clips[0] === "dance_bounce").length;
    expect(asks).toBeGreaterThan(2); // retried while the earlier beats play
    room = true; s.ready.add("dance_bounce");
    let danced = false;
    for (let i = 0; i < 360; i++) danced = rig.step(1 / 60, { state: "idle" }).dancing || danced;
    expect(danced).toBe(true);
  });
  it("skips an undecoded dance without spending the shared minute guard", () => {
    let now = 0;
    const ledger = new BirdMotionLedger({ seed: 3, now: () => now });
    const m = reactions(), s = source(Object.keys(m.clips).filter((name) => !name.startsWith("dance_")));
    const event = (at: number) => {
      const rig = new BirdMotionRig(m, { ledger, clips: s.clips }); rig.moment("congrats", undefined, at);
      let danced = false;
      for (let i = 0; i < 480; i++) { now += 1 / 60; danced = rig.step(1 / 60, { state: "idle" }).dancing || danced; }
      return danced;
    };
    expect(event(0)).toBe(false);
    expect(s.asked.some((clips) => clips.some((clip) => clip.startsWith("dance_")))).toBe(true);
    for (const name of BIRD_DANCE_CLIPS) s.ready.add(name);
    expect([event(1), event(2), event(3)]).toEqual([false, false, true]);
  });
});

// Deckster companion additions are optional; source packs remain valid.
describe("Deckster companion clip compatibility", () => {
  it.each(COMPANION_MOTION_CLIPS)("accepts and validates optional %s", (name) => {
    const legacy = pack();
    expect(parseBirdMotionManifest(legacy).clips[name]).toBeUndefined();
    legacy.clips[name] = { ...legacy.clips.wave!, frames: [...legacy.clips.wave!.frames] };
    expect(isOptionalMotionClip(name)).toBe(true);
    expect(parseBirdMotionManifest(legacy).clips[name]).toBeDefined();
    legacy.clips[name]!.frames[0] = "absent";
    expect(() => parseBirdMotionManifest(legacy)).toThrow();
  });
});

describe("companion gesture fallback playback", () => {
  it.each(COMPANION_MOTION_CLIPS)("plays %s or its legacy fallback without throwing", (name) => {
    const m = pack();
    const fallback = resolveCompanionClip(m, name);
    expect(m.clips[fallback]).toBeDefined();
    const rig = new BirdMotionRig(m); rig.gestureClip(name);
    expect(rig.step(0, { state: "idle" }).clip).toBe(fallback);
    m.clips[name] = { ...m.clips.wave!, frames: [...m.clips.wave!.frames] };
    const supplied = new BirdMotionRig(m); supplied.gestureClip(name);
    expect(supplied.step(0, { state: "idle" }).clip).toBe(name);
  });
  it("unknown and prototype-property hints are safe, and reduced motion stays still", () => {
    const m = pack();
    for (const name of ["unknown", "toString", "__proto__"]) {
      const rig = new BirdMotionRig(m); rig.gestureClip(name);
      expect(rig.step(0, { state: "idle" }).clip).toBe("nod");
    }
    const rig = new BirdMotionRig(m, { reduced: true }); rig.gestureClip("point_left");
    expect(rig.step(0, { state: "idle" }).clip).toBe("idle_breathe");
  });
});

describe("companion clip decode fallback", () => {
  it("gives a supplied optional clip time to decode, then uses its decoded legacy gesture", () => {
    const m = pack(); m.clips.point_left = { ...m.clips.point!, frames: [...m.clips.point!.frames] };
    const requested: string[] = [];
    const rig = new BirdMotionRig(m, { clips: { ready: name => name !== "point_left", request: names => { requested.push(...names); return true; } } });
    rig.gestureClip("point_left");
    expect(rig.step(0, { state: "idle" }).clip).toBe("idle_breathe");
    expect(requested).toContain("point_left");
    rig.step(.25, { state: "idle" }); rig.step(.25, { state: "idle" });
    expect(rig.step(.15, { state: "idle" }).clip).toBe("point");
  });
});
