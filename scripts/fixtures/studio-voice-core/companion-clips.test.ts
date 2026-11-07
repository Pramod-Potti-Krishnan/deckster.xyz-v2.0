import { describe, expect, it } from "vitest";
import { COMPANION_MOTION_CLIPS, COMPANION_STATES, COMPANION_SLIDE_BUILT_COOLDOWN, companionClipFor, type CompanionState, BIRD_MOTION_CLIPS, BIRD_MOTION_CORE_CLIPS, BIRD_MOTION_DECODE_GRACE, BIRD_MOTION_GESTURE_CLIPS, BIRD_MOTION_IDLE_CLIPS, BIRD_VISEMES, BIRD_EXPRESSIONS, BIRD_FACE_ANGLES, BIRD_DANCE_CLIPS, MOTION_MOMENTS, BirdMotionLedger, BirdMotionRig, isOptionalMotionClip, parseBirdMotionManifest, type BirdMotionManifest } from "../../../lib/studio/voice/bird-motion";

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

function companionPack(): BirdMotionManifest {
  const m = reactions();
  for (const name of COMPANION_MOTION_CLIPS) {
    const frames = Array.from({ length: 8 }, (_, i) => `${name}_${i}`);
    m.clips[name] = { frames, fps: 8, hold: 3, ...(name === "work_loop" ? { loop: [1, 7] as [number, number] } : {}) };
    for (const id of frames) m.frames[id] = { src: `${id}.webp`, bbox: m.bbox, sourceHash: "generated-companion" };
  }
  m.uniqueFrames = Object.keys(m.frames).length;
  return m;
}

describe("Director companion clip plans", () => {
  const directorCases: [CompanionState, string[]][] = [
    ["idle", ["idle_breathe"]],
    ["listening", ["lean_in"]],
    ["thinking", ["expr_thinking_front"]],
    ["working", ["work_loop"]],
    ["one_moment", ["one_moment"]],
    ["reporting", ["present", "talk_neutral"]],
    ["slide_built", ["expr_happy_front"]],
    ["build_done", ["expr_happy_front", "wave_both"]],
    ["concerned", ["expr_concerned_front"]],
    ["sorry", ["expr_sorry_front", "shrug"]],
    ["waiting", ["invite", "lean_in"]],
    ["paused", ["hold"]],
    ["reading", ["look_down"]],
    ["surprised", ["expr_surprised_front"]],
    ["speaking", ["talk_neutral"]],
    ["present_open", ["welcome", "expr_happy_front"]],
    ["present_slide", ["turn_body_left", "point_left", "talk_neutral"]],
    ["present_emphasis", ["emphasis"]],
    ["present_list", ["count"]],
    ["present_qa", ["invite", "lean_in"]],
    ["good_question", ["expr_curious_front", "expr_happy_front"]],
    ["present_close", ["thank_you"]],
    ["present_reading", ["look_left"]],
  ];
  it.each(directorCases)("maps %s through the complete ordered Director sequence", (state, expected) => {
    const plan = companionClipFor(state, { manifest: companionPack(), now: 100 });
    expect(plan.steps.map(({ clip }) => clip)).toEqual(expected);
  });
  it("covers every exported state, keeps angle/slide direction explicit and returns to front talk after pointing", () => {
    expect(directorCases.map(([state]) => state)).toEqual([...COMPANION_STATES]);
    const manifest = companionPack();
    expect(companionClipFor("thinking", { manifest, angle: "right" }).steps[0]!.clip).toBe("expr_thinking_right");
    expect(companionClipFor("present_slide", { manifest, slideSide: "right", angle: "left" }).steps.map(s => s.clip)).toEqual(["turn_body_right", "point_right", "talk_neutral"]);
    expect(companionClipFor("present_reading", { manifest, slideSide: "right" }).steps[0]!.clip).toBe("look_right");
    expect(companionClipFor("speaking", { manifest, angle: "left" }).steps).toEqual([{ clip: "talk_left", mode: "talk" }]);
  });
  it("describes periodic nods and reversed working glances, with no scheduler or unbounded loop rate", () => {
    const manifest = companionPack();
    expect(companionClipFor("listening", { manifest }).repeat).toEqual({ every: [3.5, 6], steps: [{ clip: "nod", mode: "once" }] });
    expect(companionClipFor("working", { manifest, workRate: 0.7 })).toMatchObject({ steps: [{ clip: "work_loop", mode: "loop", rate: 0.7 }], repeat: { every: [8, 12], steps: [{ clip: "look_down", reverse: true }] } });
    for (const [workRate, expected] of [[NaN, 1], [Infinity, 1], [0, 0.5], [5, 1]]) expect(companionClipFor("working", { manifest, workRate }).steps[0]!.rate).toBe(expected);
    expect(companionClipFor("build_done", { manifest }).moment).toBe("congrats");
    expect(companionClipFor("build_done", { manifest }).steps.some(s => s.clip.startsWith("dance_"))).toBe(false);
  });
  const fallbackCases: [CompanionState, string, string][] = [
    ["listening", "lean_in", "head_tilt"], ["working", "work_loop", "look_down"],
    ["reading", "look_down", "look_up"], ["one_moment", "one_moment", "welcome"],
    ["waiting", "invite", "welcome"], ["paused", "hold", "idle_breathe"],
    ["present_slide", "point_left", "point"], ["present_slide", "point_right", "point"],
    ["present_emphasis", "emphasis", "point"], ["sorry", "shrug", "present"],
    ["present_close", "thank_you", "present"], ["present_list", "count", "emphasis"],
    ["build_done", "wave_both", "welcome"],
  ];
  it.each(fallbackCases)("uses %s's legacy fallback when %s is missing or not decoded", (state, missing, expected) => {
    const manifest = companionPack(), side = missing === "point_right" ? "right" : "left";
    const undecoded = companionClipFor(state, { manifest, slideSide: side, ready: clip => clip !== missing });
    delete manifest.clips[missing];
    const absent = companionClipFor(state, { manifest, slideSide: side });
    expect(absent).toEqual(undecoded);
    expect(absent.steps.some(s => s.clip === expected)).toBe(true);
    expect(absent.steps.some(s => s.clip === missing)).toBe(false);
  });
  it("skips absent expressions and returns drawable legacy clips throughout the Director table", () => {
    const manifest = pack();
    for (const state of COMPANION_STATES) {
      const plan = companionClipFor(state, { manifest, now: 100 });
      expect(plan.steps.length).toBeGreaterThan(0);
      for (const s of [...plan.steps, ...(plan.repeat?.steps ?? [])]) expect(manifest.clips[s.clip]).toBeDefined();
    }
    expect(companionClipFor("thinking", { manifest }).steps[0]!.clip).toBe("look_up");
    expect(companionClipFor("concerned", { manifest }).steps[0]!.clip).toBe("welcome");
    expect(companionClipFor("present_list", { manifest }).steps[0]!.clip).toBe("point");
    expect(companionClipFor("working", { manifest }).repeat!.steps[0]).toEqual({ clip: "look_up", mode: "once" });
  });
  it("holds one valid still for every reduced state, including closed speech and legacy missing-clip fallbacks", () => {
    for (const manifest of [companionPack(), pack()]) for (const state of COMPANION_STATES) {
      const plan = companionClipFor(state, { manifest, now: 100, reduced: true, angle: "right" });
      expect(plan.steps).toHaveLength(1); expect(plan.repeat).toBeUndefined(); expect(plan.moment).toBeUndefined();
      const s = plan.steps[0]!;
      expect(s.mode).toBe("hold"); expect(manifest.frames[s.frame!]).toBeDefined();
      expect(s.reverse).toBeUndefined(); expect(s.rate).toBeUndefined();
      if (state === "speaking" || state === "reporting") expect(s.frame).toBe(manifest.clips.talk_right!.frames[0]);
      if (state === "idle") expect(s.frame).toBe(manifest.neutral);
    }
    const manifest = companionPack();
    expect(companionClipFor("listening", { manifest, reduced: true }).steps[0]!.frame).toBe("lean_in_3");
    expect(companionClipFor("build_done", { manifest, reduced: true }).steps[0]!.frame).toBe("expr_happy_front_key");
  });
  it("keeps the twenty-second slide beat guard in caller state across unrelated events and remounts", () => {
    const manifest = companionPack();
    const first = companionClipFor("slide_built", { manifest, now: 0 });
    expect(first.steps[0]!.clip).toBe("expr_happy_front"); expect(first.lastSlideBuiltAt).toBe(0);
    const saved = companionClipFor("working", { manifest, now: 12, lastSlideBuiltAt: first.lastSlideBuiltAt }).lastSlideBuiltAt;
    for (const now of [0, 1, 19.999]) expect(companionClipFor("slide_built", { manifest, now, lastSlideBuiltAt: saved })).toEqual({ steps: [], lastSlideBuiltAt: 0 });
    const next = companionClipFor("slide_built", { manifest: structuredClone(manifest), now: COMPANION_SLIDE_BUILT_COOLDOWN, lastSlideBuiltAt: saved, reduced: true });
    expect(next.steps).toHaveLength(1); expect(next.lastSlideBuiltAt).toBe(20);
    expect(companionClipFor("slide_built", { manifest, now: 21, lastSlideBuiltAt: next.lastSlideBuiltAt }).steps).toEqual([]);
    expect(companionClipFor("slide_built", { manifest, now: 21, lastSlideBuiltAt: next.lastSlideBuiltAt, reduced: true })).toEqual({ steps: [{ clip: "idle_breathe", mode: "hold", frame: manifest.neutral }], lastSlideBuiltAt: 20 });
    // No hidden state: independent callers see the same plan until they explicitly persist its result.
    expect(companionClipFor("slide_built", { manifest, now: 0 })).toEqual(first);
    expect(manifest).toEqual(companionPack());
  });
  it("does not spend a small happy beat with an invalid clock or bypass a saved future timestamp", () => {
    const manifest = companionPack();
    for (const now of [undefined, NaN, Infinity, -Infinity, -1, 80]) {
      expect(companionClipFor("slide_built", { manifest, now, lastSlideBuiltAt: 100 })).toEqual({ steps: [], lastSlideBuiltAt: 100 });
    }
    expect(companionClipFor("slide_built", { manifest: pack(), now: 100 }).steps[0]!.clip).toBe("nod");
  });
});
