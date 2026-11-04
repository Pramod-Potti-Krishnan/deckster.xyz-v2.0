// Garud feature/companion-v2-player b3a812e packages/core/test/companion-speech.test.ts, run by scripts/test-studio-voice-v2.mjs (a vitest-shaped shim). Adapted: imports point at lib/studio/voice-v2.
import { describe, expect, it } from "vitest";
import { parseSpeechTimeline, type SpeechTimeline } from "@/lib/studio/voice/companion-face";
import { COMPANION_MOUTH_FADE, companionLoudnessMouth, liveCompanionTimeline, prepareCompanionSpeech, sampleCompanionSpeech, textToCompanionSounds } from "@/lib/studio/voice-v2/companion-speech";
const fixed: SpeechTimeline = { cues: [{t:0,mouth:"closed"},{t:.5,mouth:"mbp"},{t:.8,mouth:"ah"},{t:1.2,mouth:"oo"},{t:1.7,mouth:"closed"}], gestures:[{t:.6,clip:"point_left"}] };
describe("companion audio-clock timing", () => {
  it("anticipates audio by 50 ms and blends mouths over 70 ms", () => {
    const p=prepareCompanionSpeech(fixed);
    expect(sampleCompanionSpeech(p,.449).mouth).toBe("closed");
    expect(sampleCompanionSpeech(p,.45)).toMatchObject({mouth:"mbp",previousMouth:"closed",mouthMix:0});
    expect(sampleCompanionSpeech(p,.485).mouthMix).toBeCloseTo(.5);
    expect(sampleCompanionSpeech(p,.45+COMPANION_MOUTH_FADE).mouthMix).toBeCloseTo(1);
    expect(sampleCompanionSpeech(p,.82)).toMatchObject({mouth:"ah",previousMouth:"mbp"});
    expect(sampleCompanionSpeech(p,.82).mouthMix).toBeCloseTo(1);
  });
  it("finishes a 60ms shape fade before the following cue starts", () => {
    const p = prepareCompanionSpeech({cues:[{t:0,mouth:"closed"},{t:.5,mouth:"ah"},{t:.56,mouth:"ee"},{t:1,mouth:"closed"}],gestures:[]});
    expect(sampleCompanionSpeech(p,.48).mouthMix).toBeCloseTo(.5);
    const before=sampleCompanionSpeech(p,.509999);
    expect(before.mouth).toBe("ah"); expect(before.mouthMix).toBeGreaterThan(.9999);
    const next=sampleCompanionSpeech(p,.51);
    expect(next).toMatchObject({mouth:"ee",previousMouth:"ah"}); expect(next.mouthMix).toBeCloseTo(0);
    expect(sampleCompanionSpeech(p,.545).mouthMix).toBeCloseTo(.5);
  });
  it("holds exactly at a paused clock and seeks backwards without stale state", () => {
    const p=prepareCompanionSpeech(fixed), at=sampleCompanionSpeech(p,.79);
    for(let i=0;i<20;i++) expect(sampleCompanionSpeech(p,.79)).toEqual(at);
    sampleCompanionSpeech(p,1.5);
    expect(sampleCompanionSpeech(p,.3)).toEqual(sampleCompanionSpeech(fixed,.3));
    expect(sampleCompanionSpeech(p,.79)).toEqual(at);
  });
  it("drops only shapes shorter than 60 ms, holding the previous accepted mouth", () => {
    const t:SpeechTimeline={cues:[{t:0,mouth:"closed"},{t:.5,mouth:"ah"},{t:.559,mouth:"ee"},{t:.619,mouth:"oo"},{t:1,mouth:"closed"}],gestures:[]};
    const p=prepareCompanionSpeech(t);
    expect(p.cues.map(c=>c.mouth)).toEqual(["closed","ee","oo","closed"]);
    expect(sampleCompanionSpeech(p,.48).mouth).toBe("closed");
    expect(sampleCompanionSpeech(p,.53).mouth).toBe("ee");
    expect(t.cues).toHaveLength(5);
  });
  it("combines adjacent identical cues before measuring the shape duration", () => {
    const t: SpeechTimeline = { cues: [{t:0,mouth:"closed"},{t:.5,mouth:"ah"},{t:.53,mouth:"ah"},{t:.56,mouth:"ah"},{t:.6,mouth:"closed"}],gestures:[] };
    expect(prepareCompanionSpeech(t).cues).toEqual([{t:0,mouth:"closed"},{t:.5,mouth:"ah"},{t:.6,mouth:"closed"}]);
    expect(sampleCompanionSpeech(t,.52).mouth).toBe("ah");
  });
  it("known segment duration closes the mouth and removes cues/gestures beyond its end", () => {
    const p=prepareCompanionSpeech(fixed,1);
    expect(p.gestures).toEqual(fixed.gestures);
    expect(p.cues.every(c=>c.t<=1)).toBe(true);
    expect(sampleCompanionSpeech(p,1)).toEqual({mouth:"closed",previousMouth:"closed",mouthMix:1});
    expect(sampleCompanionSpeech(p,5).mouth).toBe("closed");
    expect(sampleCompanionSpeech(p,.82).mouth).toBe("ah");
  });
  it("an explicit terminal cue closes unknown-duration narration", () => { expect(sampleCompanionSpeech(fixed,100).mouth).toBe("closed"); });
  it.each([NaN,Infinity,-1])("invalid audio clock %s yields closed", n=>expect(sampleCompanionSpeech(fixed,n).mouth).toBe("closed"));
  it("rejects unparsed malformed timelines", () => { expect(()=>prepareCompanionSpeech({cues:[{t:0,mouth:"th"}],gestures:[]} as any)).toThrow(); });
  it("empty timelines have no timer-driven mouth movement",()=>{ expect(sampleCompanionSpeech({cues:[],gestures:[]},20)).toEqual({mouth:"closed",previousMouth:"closed",mouthMix:1}); });
});
describe("offline live text mapping", () => {
  it.each([["me",["mbp","ee"]],["you",["ee","oo"]],["five",["fv","ah","ee","fv"]],["three",["slight","ee"]],["mom",["mbp","oh","mbp"]]])("fixed pronunciation %s",(text,mouths)=>expect(textToCompanionSounds(text as string)).toEqual(mouths));
  it("maps the fixed caption sentence deterministically with closures, vowels and punctuation", () => {
    const text="Please show me this chart.", t=liveCompanionTimeline(text,4.5);
    expect(t).toEqual(liveCompanionTimeline(text,4.5));
    expect(t.cues[0]).toEqual({t:0,mouth:"mbp"});
    expect(new Set(t.cues.map(c=>c.mouth))).toEqual(new Set(["mbp","slight","ee","closed","oh","ah"]));
    expect(t.cues.at(-1)?.mouth).toBe("closed");
    expect(()=>parseSpeechTimeline(t)).not.toThrow();
  });
  it("spreads sounds proportionally over the real duration and always bounds its cues",()=>{
    const a=liveCompanionTimeline("me",1),b=liveCompanionTimeline("me",2);
    expect(a.cues.map(c=>c.mouth)).toEqual(["mbp","ee","closed"]);
    expect(b.cues.map(c=>c.t)).toEqual(a.cues.map(c=>c.t*2));
    expect(a.cues.at(-1)?.t).toBe(1);
  });
  it("snaps an internal closure to a quiet gap and the following vowel to a loud peak",()=>{
    const base=liveCompanionTimeline("aba",2.7), snapped=liveCompanionTimeline("aba",2.7,[{t:.96,level:.01},{t:1.02,level:.9},{t:1.66,level:.1},{t:1.74,level:.98}]);
    expect(base.cues[1]!.t).toBeCloseTo(1);
    expect(base.cues[2]!.t).toBeCloseTo(1.7);
    expect(snapped.cues[1]).toEqual({t:.96,mouth:"mbp"});
    expect(snapped.cues[2]).toEqual({t:1.74,mouth:"ah"});
    expect(()=>parseSpeechTimeline(snapped)).not.toThrow();
  });
  it("aligns realistic quiet RMS and vowel peaks without the distance penalty dominating",()=>{
    const t=liveCompanionTimeline("aba",2.7,[{t:.96,level:.01},{t:1,level:.05},{t:1.7,level:.01},{t:1.74,level:.05}]);
    expect(t.cues[1]).toEqual({t:.96,mouth:"mbp"});
    expect(t.cues[2]).toEqual({t:1.74,mouth:"ah"});
    const louder=liveCompanionTimeline("aba",2.7,[{t:.96,level:.1},{t:1,level:.5},{t:1.7,level:.1},{t:1.74,level:.5}]);
    expect(louder).toEqual(t);
  });
  it("flat or silent envelope regions choose the closest sample instead of inventing peaks",()=>{
    const flat=liveCompanionTimeline("aba",2.7,[{t:.96,level:.02},{t:1.02,level:.02},{t:1.66,level:0},{t:1.71,level:0}]);
    expect(flat.cues[1]).toEqual({t:1.02,mouth:"mbp"}); expect(flat.cues[2]).toEqual({t:1.71,mouth:"ah"});
  });
  it("sanitizes unordered invalid envelope values and preserves ordering",()=>{
    const points=[{t:1.1,level:Infinity},{t:1.02,level:2},{t:.96,level:-1},{t:NaN,level:.5},{t:-1,level:0}];
    const t=liveCompanionTimeline("aba",2.7,points);
    expect(t.cues[1]!.t).toBe(.96);expect(()=>parseSpeechTimeline(t)).not.toThrow();
  });
  it("handles unknown words locally, punctuation and contractions without network",()=>{
    const t=liveCompanionTimeline("We're testing quizzical owls; don't rush!",3);
    expect(t.cues.length).toBeGreaterThan(10);expect(t.cues.at(-1)?.mouth).toBe("closed");
    expect(()=>parseSpeechTimeline(t)).not.toThrow();
  });
  it.each([0,-1,NaN,Infinity])("invalid duration %s yields a closed timeline", duration=>expect(liveCompanionTimeline("hello",duration)).toEqual({cues:[{t:0,mouth:"closed"}],gestures:[]}));
  it("reads list digits locally",()=>{expect(textToCompanionSounds("1, 2, 3")).toEqual(textToCompanionSounds("one, two, three"));});
  it("empty or unsupported text stays closed and leaves fallback choice to the caller",()=>{expect(textToCompanionSounds(" ")).toEqual([]);expect(liveCompanionTimeline("你好",1).cues.every(c=>c.mouth==="closed")).toBe(true);});
  it("tiny durations stay valid; the sampler drops fleeting shapes",()=>{
    const timeline=liveCompanionTimeline("Please show me this chart.",.01);
    expect(()=>parseSpeechTimeline(timeline)).not.toThrow();
    expect(sampleCompanionSpeech(prepareCompanionSpeech(timeline,.01),.005).mouth).toBe("closed");
  });
});
describe("legacy loudness fallback",()=>{
  it("uses the existing thresholds and audio-second shape variety",()=>{
    expect(companionLoudnessMouth(.01,.1)).toBe("closed");
    expect(companionLoudnessMouth(.1,.1)).toBe("slight");
    expect(companionLoudnessMouth(.3,.1)).toBe("oo");
    expect(companionLoudnessMouth(.7,.1)).toBe("ee");
    expect(companionLoudnessMouth(.7,.15)).toBe("ah");
  });
  it("clamps unsafe levels and samples deterministically",()=>{expect(companionLoudnessMouth(Infinity,NaN)).toBe("mbp");expect(companionLoudnessMouth(.4,2)).toBe(companionLoudnessMouth(.4,2));});
});
