// Garud feature/companion-v2-player b3a812e packages/core/test/companion-compositor.test.ts, run by scripts/test-studio-voice-v2.mjs (a vitest-shaped shim). Adapted: imports point at lib/studio/voice-v2.
import { describe, expect, it } from "vitest";
import type { BirdMotionManifest } from "@/lib/studio/voice-v2/companion-compositor";
import { FACE_BROWS, FACE_EYES, FACE_EXPRESSIONS, FACE_MOUTHS, type CompanionFace, type FaceMouth } from "@/lib/studio/voice-v2/companion-face";
import { COMPANION_BREATH_PERIOD, COMPANION_BREATH_RISE, COMPANION_GESTURE_EASE, companionBlink, companionBreathY, companionHeadDrift, composeCompanionFace, type CompanionCompositionInput } from "@/lib/studio/voice-v2/companion-compositor";
function manifest(): BirdMotionManifest {
  const box = { x: 0, y: 0, width: 100, height: 100 };
  const ids = ["neutral", "point_in", "point_hold", "point_out", "talk_ah", "blink_half", "breathe", "shift"];
  const map = (names: readonly string[]) => Object.fromEntries(names.map(n => [n, `${n}.webp`]));
  const face: CompanionFace = {
    angles: ["front", "left"], pieces: {
      mouth: { front: map(FACE_MOUTHS), left: Object.fromEntries(FACE_MOUTHS.map(n => [n, `left_${n}.webp`])) },
      eyes: { front: map(FACE_EYES), left: map(FACE_EYES) },
      brows: { front: map(FACE_BROWS), left: map(FACE_BROWS) },
    } as CompanionFace["pieces"],
    patch: Object.fromEntries(["front", "left"].map(a => [a, { mouth: {x:10,y:40,w:40,h:20}, eyes:{x:0,y:15,w:60,h:20},brows:{x:0,y:4,w:60,h:12} }])),
    heads: Object.fromEntries(ids.map((id, index) => [id, {x:index*10,y:index,scale:1+index*.01,rot:index*.01,angle:id==="point_hold"?"left":"front"}])),
    recipes: Object.fromEntries(FACE_EXPRESSIONS.map(e => [e,{brows:e==="thinking"?"focused":"neutral",eyes:e==="laugh"?"closed":"open",mouthSet:"plain"}])) as CompanionFace["recipes"],
  };
  return {version:1,bird:"fake",size:{width:100,height:100},anchor:{x:50,y:100},bbox:box,neutral:"neutral",totalBytes:1000,uniqueFrames:ids.length,visemes:[...FACE_MOUTHS],talking:{neutral:"talk_neutral",left:"talk_left",right:"talk_right"},frames:Object.fromEntries(ids.map(id=>[id,{src:`${id}.webp`,bbox:box,sourceHash:id}])),clips:{point_left:{frames:["point_in","point_hold","point_out"],fps:4,hold:1},talk_neutral:{frames:["neutral","talk_ah"],fps:8},blink:{frames:["neutral","blink_half"],fps:8},idle_breathe:{frames:["neutral","breathe"],fps:4},shift_weight:{frames:["neutral","shift"],fps:4}},face};
}
function input(extra: Partial<CompanionCompositionInput> = {}): CompanionCompositionInput {return {manifest:manifest(),bodyFrame:"neutral",time:0,state:"speaking",mouth:{mouth:"closed"},...extra};}
function mouthSources(i: CompanionCompositionInput) { return composeCompanionFace(i)!.bodies.flatMap(b=>b.layers.filter(l=>l.kind==="mouth").map(l=>[l.src,l.opacity])); }
describe("pure layered companion compositor",()=>{
  it("returns null for v1 and its existing native Face reference",()=>{
    const m=manifest(); delete m.face; expect(composeCompanionFace(input({manifest:m}))).toBeNull();
    m.face={manifest:"face/manifest.json",totalBytes:123}; expect(composeCompanionFace(input({manifest:m}))).toBeNull();
  });
  it("holds the body while every mouth changes",()=>{
    const m=manifest();
    for(const mouth of FACE_MOUTHS) {
      const p=composeCompanionFace(input({manifest:m,time:.4,mouth:{mouth}}))!;
      expect(p.bodies.map(b=>[b.frame,b.opacity])).toEqual([["neutral",1]]);
      expect(p.bodies[0]!.layers.find(l=>l.kind==="mouth")!.src).toBe(`${mouth}.webp`);
    }
  });
  it("uses independent weighted mouth patches during the 70ms speech sample blend",()=>{
    expect(mouthSources(input({mouth:{mouth:"ah",previousMouth:"mbp",mouthMix:.25}}))).toEqual([["mbp.webp",.75],["ah.webp",.25]]);
    expect(mouthSources(input({mouth:{mouth:"ah",previousMouth:"ah",mouthMix:.25}}))).toEqual([["ah.webp",1]]);
  });
  it("refuses legacy full-frame talk, blink, breath and shift drawings",()=>{
    for(const frame of ["talk_ah","blink_half","breathe","shift","missing"]) expect(composeCompanionFace(input({bodyFrame:frame}))!.bodies[0]!.frame).toBe("neutral");
  });
  it("breathes on a 4.5 second transform cycle below 1 percent shoulder rise",()=>{
    for(let t=0;t<=18;t+=.031) {
      const y=companionBreathY(t,768);
      expect(y).toBeLessThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(-768*.01);
      expect(companionBreathY(t+COMPANION_BREATH_PERIOD,768)).toBeCloseTo(y,10);
    }
    expect(companionBreathY(COMPANION_BREATH_PERIOD/2,768)).toBeCloseTo(-768*COMPANION_BREATH_RISE,10);
  });
  it("does not couple breathing or body choice to mouth or expression",()=>{
    const first=composeCompanionFace(input({motionTime:2,time:.1,mouth:{mouth:"ah"}}))!;
    const second=composeCompanionFace(input({motionTime:2,time:9,mouth:{mouth:"mbp"},expression:"concerned"}))!;
    expect(second.breathY).toBe(first.breathY); expect(second.bodies[0]!.frame).toBe(first.bodies[0]!.frame);
  });
  it("keeps head drift vector below 2 pixels",()=>{
    for(let t=0;t<100;t+=.077) {const d=companionHeadDrift(t);expect(Math.hypot(d.x,d.y)).toBeLessThanOrEqual(2);}
  });
  it("blinks only eye patches every 4.6 seconds without opening a laughing closed eye",()=>{
    expect(companionBlink(3.81)).toBe("half");expect(companionBlink(3.87)).toBe("closed");expect(companionBlink(3.95)).toBe("half");expect(companionBlink(4.01)).toBe("open");
    expect(companionBlink(3.87+4.6)).toBe("closed");
    const p=composeCompanionFace(input({time:3.87}))!;expect(p.bodies[0]!.frame).toBe("neutral");expect(p.bodies[0]!.layers.find(l=>l.kind==="eyes")!.src).toBe("closed.webp");
    expect(composeCompanionFace(input({time:3.81,expression:"laugh"}))!.bodies[0]!.layers.find(l=>l.kind==="eyes")!.src).toBe("closed.webp");
  });
  it("uses the same audio clock for seeking into and out of a pointing gesture while the mouth talks",()=>{
    const i=input({timeline:{cues:[],gestures:[{t:1,clip:"point_left"}]},time:1.06,mouth:{mouth:"ah"}});
    const entry=composeCompanionFace(i)!; expect(entry.gestureActive).toBe(true);expect(entry.bodies.map(b=>b.frame)).toEqual(["neutral","point_in"]);expect(entry.bodies[0]!.opacity).toBeCloseTo(.5);
    expect(entry.bodies.flatMap(b=>b.layers.filter(l=>l.kind==="mouth").map(l=>l.src))).toEqual(["ah.webp","ah.webp"]);
    const hold=composeCompanionFace({...i,time:1.8})!;expect(hold.bodies[0]!.frame).toBe("point_hold");expect(hold.bodies[0]!.head.angle).toBe("left");expect(hold.bodies[0]!.layers.find(l=>l.kind==="mouth")!.src).toBe("left_ah.webp");
    expect(composeCompanionFace({...i,time:1.06})).toEqual(entry);
    expect(composeCompanionFace({...i,time:.5})!.bodies[0]!.frame).toBe("neutral");
    expect(composeCompanionFace({...i,time:4})!.gestureActive).toBe(false);
  });
  it("settles breathing to zero during the gesture and eases back at exit",()=>{
    const i=input({gesture:{clip:"point_left",startedAt:1},time:1.4});
    const first=composeCompanionFace(i)!;
    expect(first.breathY).toBe(0);
    for (const motionTime of [1,2,3]) expect(composeCompanionFace({...i,motionTime})!.breathY).toBe(0);
    expect(composeCompanionFace({...i,time:2})!.breathY).toBe(first.breathY);
    const end=1+COMPANION_GESTURE_EASE*2+.75+.6;
    const exit=composeCompanionFace({...i,time:end-.06})!;
    expect(exit.bodies.map(b=>b.frame)).toEqual(["point_out","neutral"]);
    expect(exit.bodies[0]!.opacity).toBeCloseTo(.5);
    expect(exit.breathY).toBeCloseTo((first.breathY+companionBreathY(end-.06,100))/2);
  });
  it("keeps each crossfaded body’s actual head anchor and soft patch rectangle",()=>{
    const m=manifest();const p=composeCompanionFace(input({manifest:m,time:1.06,motionTime:0,gesture:{clip:"point_left",startedAt:1}}))!;
    expect(p.bodies.map(b=>b.head.x)).toEqual([0,10]);
    for(const b of p.bodies) for(const l of b.layers){ expect(l.patch.w).toBeGreaterThan(0);expect(l.feather).toBeGreaterThan(0);expect(l.feather).toBeLessThanOrEqual(2); }
    expect(p.bodies.reduce((n,b)=>n+b.opacity,0)).toBeCloseTo(1);
  });
  it("ignores forbidden gestures and returns a reduced-motion peak with closed mouth and no life",()=>{
    for(const clip of ["shift_weight","talk_neutral","blink","idle_breathe","missing"]) expect(composeCompanionFace(input({time:1.1,gesture:{clip,startedAt:1}}))!.gestureActive).toBe(false);
    const p=composeCompanionFace(input({time:1.5,reduced:true,gesture:{clip:"point_left",startedAt:1},mouth:{mouth:"ah"}}))!;
    expect(p.bodies.map(b=>b.frame)).toEqual(["point_hold"]);expect(p.breathY).toBe(0);expect(p.headDrift).toEqual({x:0,y:0});expect(p.bodies[0]!.layers.find(l=>l.kind==="mouth")!.src).toBe("left_closed.webp");
  });
  it("chooses recipes without swapping the full body and supports smiling speech",()=>{
    const m=manifest();const f=m.face as CompanionFace;
    for(const angle of f.angles) for(const mouth of FACE_MOUTHS) f.pieces.mouth[angle]![`smile_${mouth}`]=`${angle}_smile_${mouth}.webp`;
    f.recipes.happy={brows:"happy",eyes:"half",mouthSet:"smile"};
    const p=composeCompanionFace(input({manifest:m,state:"slide_built",mouth:{mouth:"ee"}}))!;
    expect(p.bodies[0]!.frame).toBe("neutral");expect(p.bodies[0]!.layers.find(l=>l.kind==="mouth")!.src).toBe("front_smile_ee.webp");expect(p.bodies[0]!.layers.find(l=>l.kind==="brows")!.src).toBe("happy.webp");
  });
  it("handles invalid clocks by sampling the closed start instead of propagating NaN",()=>{
    const p=composeCompanionFace(input({time:NaN,motionTime:Infinity}))!;expect(p.breathY).toBe(0);expect(p.headDrift).toEqual({x:0,y:0});
  });
});
