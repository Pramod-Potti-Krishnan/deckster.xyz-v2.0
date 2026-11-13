import { describe, expect, it } from "vitest";
import { BARGE_IN_MIN_SPEECH_MS, BARGE_IN_SCALE, EnergyVad, mouthFromLevel, rmsByteTimeDomain, rmsFloat, smoothLevel, type VadEvent } from "../../../lib/studio/voice/vad";
import { formatCallDuration, isEditableTarget, pickRecorderMime, worthSending } from "../../../lib/studio/voice/format";

/** Run a level pattern through the VAD at 40 ms per frame; returns [event, atMs][] */
function run(vad: EnergyVad, frames: number[], start = 0, scale = 1, minSpeechMs?: number): [VadEvent, number][] {
  const out: [VadEvent, number][] = [];
  frames.forEach((lvl, i) => {
    const now = start + i * 40;
    const e = vad.process(lvl, now, scale, minSpeechMs);
    if (e) out.push([e, now]);
  });
  return out;
}
const rep = (lvl: number, ms: number) => Array.from({ length: Math.round(ms / 40) }, () => lvl);

describe("energy VAD", () => {
  it("stays quiet in a quiet room and learns the noise floor", () => {
    const vad = new EnergyVad();
    expect(run(vad, rep(0.006, 4000))).toEqual([]);
    expect(vad.speaking).toBe(false);
    expect(vad.noiseFloor).toBeGreaterThan(0.004);
    expect(vad.noiseFloor).toBeLessThan(0.0085);
  });

  it("starts speech only after sustained loudness, not on a click", () => {
    const vad = new EnergyVad();
    expect(run(vad, [...rep(0.005, 800), 0.6, ...rep(0.005, 400)])).toEqual([]); // one 40 ms click
    const events = run(new EnergyVad(), [...rep(0.005, 800), ...rep(0.12, 400)]);
    expect(events).toHaveLength(1);
    expect(events[0]![0]).toBe("speech_start");
    // 160 ms of sustained loudness after the quiet lead-in
    expect(events[0]![1]).toBeGreaterThanOrEqual(800 + 120);
    expect(events[0]![1]).toBeLessThanOrEqual(800 + 240);
  });

  it("ends speech after the hangover of silence and not before", () => {
    const vad = new EnergyVad({ hangoverMs: 800 });
    const frames = [...rep(0.005, 800), ...rep(0.15, 1000), ...rep(0.005, 2000)];
    const events = run(vad, frames);
    expect(events.map((e) => e[0])).toEqual(["speech_start", "speech_end"]);
    const speechEndsAt = events[1]![1];
    const lastLoudAt = 800 + 1000 - 40;
    expect(speechEndsAt - lastLoudAt).toBeGreaterThanOrEqual(800);
    expect(speechEndsAt - lastLoudAt).toBeLessThanOrEqual(880);
  });

  it("bridges short pauses between words (no flapping)", () => {
    const vad = new EnergyVad({ hangoverMs: 900 });
    const word = rep(0.15, 400);
    const pause = rep(0.004, 400);
    const frames = [...rep(0.004, 800), ...word, ...pause, ...word, ...pause, ...word, ...rep(0.004, 1600)];
    const events = run(vad, frames);
    expect(events.map((e) => e[0])).toEqual(["speech_start", "speech_end"]);
  });

  it("hysteresis: a level between the stop and start thresholds keeps speech going but cannot start it", () => {
    const quiet = () => {
      const v = new EnergyVad();
      run(v, rep(0.004, 800));
      return v;
    };
    const probe = quiet();
    const between = (probe.startThreshold() + probe.stopThreshold()) / 2;
    expect(between).toBeGreaterThan(probe.stopThreshold());
    expect(between).toBeLessThan(probe.startThreshold());

    expect(run(quiet(), rep(between, 400), 800)).toEqual([]); // cannot start speech

    const vad = quiet();
    const events = run(vad, [...rep(0.2, 400), ...rep(between, 3000)], 800); // but keeps it going
    expect(events.map((e) => e[0])).toEqual(["speech_start"]);
    expect(vad.speaking).toBe(true);
  });

  it("a hum that is already there when hands-free starts is learned as noise, not taken for speech", () => {
    const vad = new EnergyVad();
    expect(run(vad, rep(0.03, 6000))).toEqual([]); // 0.03 is above minLevel (0.02) but is the room
    expect(vad.noiseFloor).toBeGreaterThan(0.025);
    // a voice well above the hum still starts speech
    expect(run(vad, rep(0.25, 600), 6000).map((e) => e[0])).toEqual(["speech_start"]);
  });

  it("does not detect speech while it is still measuring the room", () => {
    const vad = new EnergyVad({ warmupMs: 500 });
    expect(run(vad, rep(0.3, 440))).toEqual([]); // 11 frames = 400 ms, all inside warm-up
  });

  it("scale raises the thresholds (barge-in while the Director speaks)", () => {
    const lead = rep(0.004, 800);
    const level = 0.04; // above the normal start threshold (0.02)
    expect(run(new EnergyVad(), [...lead, ...rep(level, 800)]).map((e) => e[0])).toEqual(["speech_start"]);
    // while the Director speaks the bar is 2.2x higher and needs longer: the same level is ignored...
    const vad = new EnergyVad();
    run(vad, lead);
    expect(run(vad, rep(level, 800), 800, BARGE_IN_SCALE, BARGE_IN_MIN_SPEECH_MS)).toEqual([]);
    // ...but a clearly louder voice still barges in
    const loud = new EnergyVad();
    run(loud, lead);
    expect(run(loud, rep(0.2, 800), 800, BARGE_IN_SCALE, BARGE_IN_MIN_SPEECH_MS).map((e) => e[0])).toEqual(["speech_start"]);
  });

  it("forces an end after maxSpeechMs", () => {
    const vad = new EnergyVad({ maxSpeechMs: 2000 });
    const events = run(vad, [...rep(0.004, 800), ...rep(0.2, 4000)]);
    expect(events.slice(0, 2).map((e) => e[0])).toEqual(["speech_start", "speech_end"]);
    const [start, end] = [events[0]![1], events[1]![1]];
    expect(end - start).toBeGreaterThanOrEqual(2000);
    expect(end - start).toBeLessThanOrEqual(2080);
  });

  it("ignores garbage readings and reset() clears the state", () => {
    const vad = new EnergyVad();
    expect(vad.process(NaN, 0)).toBeNull();
    expect(vad.process(-1, 40)).toBeNull();
    run(vad, [...rep(0.004, 800), ...rep(0.2, 400)]);
    expect(vad.speaking).toBe(true);
    vad.reset();
    expect(vad.speaking).toBe(false);
  });
});

describe("level math", () => {
  it("rms of float samples and of analyser bytes", () => {
    expect(rmsFloat([])).toBe(0);
    expect(rmsFloat([0, 0, 0])).toBe(0);
    expect(rmsFloat([1, -1, 1, -1])).toBeCloseTo(1, 6);
    expect(rmsFloat([0.5, -0.5])).toBeCloseTo(0.5, 6);
    expect(rmsByteTimeDomain(new Uint8Array(64).fill(128))).toBe(0);
    expect(rmsByteTimeDomain(Uint8Array.from([255, 1, 255, 1]))).toBeCloseTo(127 / 128, 3);
  });

  it("mouth opening: closed below the gate, wide for loud speech, monotonic", () => {
    expect(mouthFromLevel(0)).toBe(0);
    expect(mouthFromLevel(0.01)).toBe(0);
    expect(mouthFromLevel(0.5)).toBe(1);
    expect(mouthFromLevel(Number.NaN)).toBe(0);
    let prev = 0;
    for (let l = 0.01; l < 0.3; l += 0.01) {
      const m = mouthFromLevel(l);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });

  it("smoothing rises faster than it falls", () => {
    const up = smoothLevel(0, 1, 33);
    const down = 1 - smoothLevel(1, 0, 33);
    expect(up).toBeGreaterThan(down);
    expect(smoothLevel(0.5, 0.5, 33)).toBeCloseTo(0.5, 9);
  });
});

describe("call screen helpers", () => {
  it("formats the timer", () => {
    expect(formatCallDuration(0)).toBe("0:00");
    expect(formatCallDuration(75.9)).toBe("1:15");
    expect(formatCallDuration(3725)).toBe("1:02:05");
    expect(formatCallDuration(-5)).toBe("0:00");
    expect(formatCallDuration(Number.NaN)).toBe("0:00");
  });

  it("picks the first recorder type the browser supports", () => {
    expect(pickRecorderMime((m) => m === "audio/webm;codecs=opus")).toBe("audio/webm;codecs=opus");
    expect(pickRecorderMime((m) => m === "audio/mp4")).toBe("audio/mp4"); // Safari
    expect(pickRecorderMime(() => false)).toBeUndefined();
    expect(pickRecorderMime(() => { throw new Error("nope"); })).toBeUndefined();
  });

  it("push-to-talk ignores keys typed in text fields", () => {
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableTarget({ tagName: "textarea" })).toBe(true);
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isEditableTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it("only sends recordings that are long enough and not silent", () => {
    expect(worthSending({ durationMs: 120, peakLevel: 0.3 })).toEqual({ ok: false, reason: "too_short" });
    expect(worthSending({ durationMs: 2000, peakLevel: 0.001 })).toEqual({ ok: false, reason: "silent" });
    expect(worthSending({ durationMs: 2000, peakLevel: 0.2 })).toEqual({ ok: true });
  });
});
