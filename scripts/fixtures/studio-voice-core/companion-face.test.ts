import { describe, expect, it } from "vitest";
import { FACE_ANGLES, FACE_BROWS, FACE_EYES, FACE_EXPRESSIONS, FACE_MOUTHS, isCompanionFace, parseCompanionFace, parseSpeechTimeline } from "../../../lib/studio/voice/companion-face";
import type { CompanionFace } from "../../../lib/studio/voice/companion-face";
export function fixture() {
  const entries = (keys: readonly string[]) => Object.fromEntries(keys.map(k => [k, `${k}.webp`]));
  return { angles: [...FACE_ANGLES], pieces: { mouth: Object.fromEntries(FACE_ANGLES.map(a => [a, entries(FACE_MOUTHS)])), eyes: Object.fromEntries(FACE_ANGLES.map(a => [a, entries(FACE_EYES)])), brows: Object.fromEntries(FACE_ANGLES.map(a => [a, entries(FACE_BROWS)])) }, patch: Object.fromEntries(FACE_ANGLES.map(a => [a, Object.fromEntries(["mouth", "eyes", "brows"].map(k => [k, { x: 1, y: 2, w: 40, h: 20 }]))])), heads: { body: { x: 20, y: 30, scale: 1, rot: 0, angle: "front" } }, recipes: Object.fromEntries(FACE_EXPRESSIONS.map(e => [e, { brows: "neutral", eyes: "open", mouthSet: "plain" }])) };
}
describe("layered face contract", () => {
  it("accepts all three complete angles without changing the wire object", () => { const f = fixture(); expect(parseCompanionFace(f, ["body"])).toBe(f); });
  it("keeps native Face references distinct", () => { expect(isCompanionFace({manifest:"face/manifest.json",totalBytes:40})).toBe(false); expect(isCompanionFace(fixture())).toBe(true); });
  it.each(["mouth", "eyes", "brows"] as const)("rejects incomplete %s for a declared angle", kind => { const f = fixture(); delete f.pieces[kind].left; expect(() => parseCompanionFace(f,["body"])).toThrow(); });
  it.each(["../secret.webp", "/mouth.webp", "https://host/m.webp", "a//m.webp", "./m.webp"])("rejects unsafe source %s", src => { const f = fixture(); f.pieces.mouth.front!.ah = src; expect(() => parseCompanionFace(f,["body"])).toThrow(); });
  it("rejects missing anchors, invalid recipes, patches and mixed reference shapes", () => {
    for (const mutate of [(f:any) => {delete f.heads.body;}, (f:any)=>{f.heads.body.scale=0;}, (f:any)=>{f.patch.front.mouth.w=NaN;}, (f:any)=>{delete f.recipes.sorry;}, (f:any)=>{f.recipes.happy.mouthSet="smile";}, (f:any)=>{f.manifest="face/manifest.json";}]) { const f=fixture(); mutate(f); expect(()=>parseCompanionFace(f,["body"])).toThrow(); }
  });
  it("rejects unknown piece names rather than decoding an unbounded dictionary", () => { const f=fixture(); (f.pieces.mouth.front as any).unused="unused.webp"; expect(()=>parseCompanionFace(f,["body"])).toThrow(); });
  it("requires a complete smile set", () => { const f=fixture(); (f.pieces.mouth.front as any).smile_ah="smile_ah.webp"; expect(()=>parseCompanionFace(f,["body"])).toThrow(); });
  it("validates timeline ordering and finite seconds", () => {
    const t={cues:[{t:0,mouth:"closed"},{t:.2,mouth:"ah"}],gestures:[{t:.1,clip:"point_left"}]}; expect(parseSpeechTimeline(t)).toBe(t);
    for (const bad of [{...t,cues:[{t:NaN,mouth:"ah"}]},{...t,cues:[{t:1,mouth:"ah"},{t:.5,mouth:"ee"}]},{...t,gestures:[{t:-1,clip:"point"}]},{...t,cues:[{t:0,mouth:"th"}]}]) expect(()=>parseSpeechTimeline(bad)).toThrow();
  });
});

// A minimal complete motion pack: all rendering stays offline and no image is decoded.
import { BIRD_MOTION_CLIPS, BIRD_VISEMES, parseBirdMotionManifest, type BirdMotionManifest } from "../../../lib/studio/voice/bird-motion";
function motionPack(): BirdMotionManifest {
  const bbox = { x: 0, y: 0, width: 100, height: 100 };
  return { version: 1, bird: "director", size: { width: 100, height: 100 }, anchor: { x: 50, y: 90 }, bbox,
    neutral: "body", totalBytes: 1000, uniqueFrames: 1, visemes: [...BIRD_VISEMES],
    talking: { neutral: "talk_neutral", left: "talk_left", right: "talk_right" },
    frames: { body: { src: "body.webp", bbox, sourceHash: "fixture" } },
    clips: Object.fromEntries(BIRD_MOTION_CLIPS.map(name => [name, { frames: Array(name.startsWith("talk_") ? 9 : 1).fill("body"), fps: 12 }])) };
}
describe("motion manifest layered face integration", () => {
  it("retains v1 packs and native Face references unchanged", () => {
    for (const face of [undefined, { manifest: "face/manifest.json", totalBytes: 1000 }]) {
      const m = motionPack(); if (face) m.face = face;
      expect(parseBirdMotionManifest(m)).toBe(m); expect(m.face).toBe(face);
    }
  });
  it("accepts self-contained inline layers and validates all body anchors", () => {
    const m = motionPack(); m.face = fixture() as unknown as CompanionFace; expect(parseBirdMotionManifest(m)).toBe(m);
    m.frames.second = { ...m.frames.body! }; m.uniqueFrames++;
    expect(() => parseBirdMotionManifest(m)).toThrow("Invalid companion face section");
  });
  it("rejects null, incomplete and mixed generations before rendering", () => {
    for (const face of [null, {}, { ...fixture(), manifest: "face/manifest.json" }, { ...fixture(), totalBytes: 1000 }]) {
      const m = motionPack(); (m as any).face = face;
      expect(() => parseBirdMotionManifest(m)).toThrow();
    }
  });
  it("rejects sidecars alongside layered faces and retains the existing download budget", () => {
    const m = motionPack(); m.face = fixture() as unknown as CompanionFace; (m as any).companion = { manifest: "companion.json", totalBytes: 1000 };
    expect(() => parseBirdMotionManifest(m)).toThrow("Layered companion sidecars are unsupported");
    delete (m as any).companion; m.packBudgetMiB = 8; m.totalBytes = 8 * 1024 * 1024;
    expect(parseBirdMotionManifest(m)).toBe(m); m.totalBytes++;
    expect(() => parseBirdMotionManifest(m)).toThrow("Bird motion pack exceeds download budget");
  });
  it("rejects duplicate cue instants, unsafe gestures and excessive timeline counts", () => {
    for (const t of [
      { cues: [{ t: 0, mouth: "ah" }, { t: 0, mouth: "ee" }], gestures: [] },
      { cues: [], gestures: [{ t: 1, clip: "../point" }] },
      { cues: [], gestures: [{ t: 2, clip: "nod" }, { t: 1, clip: "point" }] },
      { cues: Array(100001).fill({ t: 0, mouth: "ah" }), gestures: [] },
      { cues: [], gestures: Array(10001).fill({ t: 0, clip: "nod" }) },
    ]) expect(() => parseSpeechTimeline(t)).toThrow();
    expect(parseSpeechTimeline({ cues: [], gestures: [{ t: 0, clip: "nod" }, { t: 0, clip: "point" }] }).gestures).toHaveLength(2);
  });
});
