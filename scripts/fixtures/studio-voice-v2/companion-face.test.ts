// Garud feature/companion-v2-player b3a812e packages/core/test/companion-face.test.ts, run by scripts/test-studio-voice-v2.mjs (a vitest-shaped shim). Adapted: imports point at lib/studio/voice-v2.
import { describe, expect, it } from "vitest";
import { FACE_ANGLES, FACE_BROWS, FACE_EYES, FACE_EXPRESSIONS, FACE_MOUTHS, isCompanionFace, parseCompanionFace, parseSpeechTimeline } from "@/lib/studio/voice-v2/companion-face";
function fixture() {
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
