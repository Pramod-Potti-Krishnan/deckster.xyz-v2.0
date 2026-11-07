import { describe, expect, it } from "vitest";
import { canTalk, initialCallState, phaseLabel, reduceCall, type CallEffect, type CallEvent, type CallState } from "../../../lib/studio/voice/call-state";

/** Apply events in order; returns the final state and every effect emitted. */
function play(events: CallEvent[], from: CallState = initialCallState()): { state: CallState; effects: CallEffect[]; trail: string[] } {
  let state = from;
  const effects: CallEffect[] = [];
  const trail: string[] = [state.phase];
  for (const e of events) {
    const step = reduceCall(state, e);
    state = step.state;
    effects.push(...step.effects);
    trail.push(state.phase);
  }
  return { state, effects, trail };
}
const types = (effects: CallEffect[]) => effects.map((e) => e.type);

describe("call state machine: the happy path", () => {
  it("idle -> listening -> thinking -> speaking -> idle", () => {
    const { state, effects, trail } = play([
      { type: "talk_start", source: "ptt" },
      { type: "talk_end", source: "ptt", keep: true },
      { type: "audio_started", turn: 1 },
      { type: "reply_done", turn: 1 },
      { type: "audio_drained", turn: 1 },
    ]);
    expect(trail).toEqual(["idle", "listening", "thinking", "speaking", "speaking", "idle"]);
    expect(types(effects)).toEqual(["start_recording", "send_recording"]);
    expect(effects[0]).toEqual({ type: "start_recording", source: "ptt", fresh: true });
    expect(state.turn).toBe(1);
    expect(state.playing).toBe(false);
  });

  it("each sent recording is a new turn", () => {
    const { state } = play([
      { type: "talk_start", source: "ptt" }, { type: "talk_end", source: "ptt", keep: true },
      { type: "reply_done", turn: 1 }, { type: "audio_drained", turn: 1 },
      { type: "talk_start", source: "ptt" }, { type: "talk_end", source: "ptt", keep: true },
    ]);
    expect(state.turn).toBe(2);
    expect(state.phase).toBe("thinking");
  });

  it("a reply that has nothing to say (or whose speech failed) returns to idle", () => {
    const { state } = play([
      { type: "talk_start", source: "ptt" }, { type: "talk_end", source: "ptt", keep: true },
      { type: "reply_done", turn: 1 }, { type: "audio_drained", turn: 1 },
    ]);
    expect(state.phase).toBe("idle");
  });

  it("the reply finishing does not end the call's speaking phase while audio is still playing", () => {
    const { state } = play([
      { type: "talk_start", source: "ptt" }, { type: "talk_end", source: "ptt", keep: true },
      { type: "audio_started", turn: 1 }, { type: "reply_done", turn: 1 },
    ]);
    expect(state.phase).toBe("speaking");
    expect(reduceCall(state, { type: "audio_drained", turn: 1 }).state.phase).toBe("idle");
  });

  it("audio_drained before the reply is done is ignored (more sentences are coming)", () => {
    const { state } = play([
      { type: "talk_start", source: "ptt" }, { type: "talk_end", source: "ptt", keep: true },
      { type: "audio_started", turn: 1 }, { type: "audio_drained", turn: 1 },
    ]);
    expect(state.phase).toBe("speaking");
  });

  it("an empty transcript or a failed turn goes back to idle while thinking", () => {
    const { state } = play([
      { type: "talk_start", source: "ptt" }, { type: "talk_end", source: "ptt", keep: true }, { type: "turn_failed", turn: 1 },
    ]);
    expect(state.phase).toBe("idle");
  });

  it("a failure mid-speech lets the queued audio finish instead of cutting it off", () => {
    const { state } = play([
      { type: "talk_start", source: "ptt" }, { type: "talk_end", source: "ptt", keep: true },
      { type: "audio_started", turn: 1 }, { type: "turn_failed", turn: 1 },
    ]);
    expect(state.phase).toBe("speaking");
    expect(state.replyDone).toBe(true);
    expect(reduceCall(state, { type: "audio_drained", turn: 1 }).state.phase).toBe("idle");
  });
});

describe("call state machine: barge-in", () => {
  const speaking = () =>
    play([
      { type: "talk_start", source: "ptt" }, { type: "talk_end", source: "ptt", keep: true }, { type: "audio_started", turn: 1 },
    ]).state;

  it("talking while the Director speaks stops playback, cancels the pending turn and starts a fresh recording", () => {
    const step = reduceCall(speaking(), { type: "talk_start", source: "ptt" });
    expect(step.state.phase).toBe("listening");
    expect(step.state.bargeIns).toBe(1);
    expect(step.state.playing).toBe(false);
    expect(types(step.effects)).toEqual(["cancel_speech", "cancel_turn", "start_recording"]);
    expect(step.effects[2]).toEqual({ type: "start_recording", source: "ptt", fresh: true });
  });

  it("talking while the Director is still thinking cancels the pending turn too", () => {
    const thinking = play([{ type: "talk_start", source: "ptt" }, { type: "talk_end", source: "ptt", keep: true }]).state;
    const step = reduceCall(thinking, { type: "talk_start", source: "ptt" });
    expect(step.state.phase).toBe("listening");
    expect(types(step.effects)).toEqual(["cancel_speech", "cancel_turn", "start_recording"]);
  });

  it("hands-free barge-in starts a fresh recording (the rolling one holds the Director's own voice)", () => {
    const hf = play(
      [{ type: "talk_start", source: "vad" }, { type: "talk_end", source: "vad", keep: true }, { type: "audio_started", turn: 1 }, { type: "talk_start", source: "vad" }],
      initialCallState({ handsFree: true }),
    );
    expect(hf.state.phase).toBe("listening");
    expect(hf.effects.at(-1)).toEqual({ type: "start_recording", source: "vad", fresh: true });
    expect(hf.effects.slice(-3, -1).map((e) => e.type)).toEqual(["cancel_speech", "cancel_turn"]);
  });

  it("starting from idle in hands-free keeps the rolling recorder (so the first word is not clipped)", () => {
    const step = reduceCall(initialCallState({ handsFree: true }), { type: "talk_start", source: "vad" });
    expect(step.effects).toEqual([{ type: "start_recording", source: "vad", fresh: false }]);
  });

  it("late events from the cancelled turn are ignored", () => {
    const barged = reduceCall(speaking(), { type: "talk_start", source: "ptt" }).state;
    const sent = reduceCall(barged, { type: "talk_end", source: "ptt", keep: true }).state; // turn 2
    expect(sent.turn).toBe(2);
    for (const stale of [
      { type: "audio_started", turn: 1 }, { type: "reply_done", turn: 1 }, { type: "audio_drained", turn: 1 }, { type: "turn_failed", turn: 1 },
    ] as CallEvent[]) {
      const step = reduceCall(sent, stale);
      expect(step.state).toEqual(sent);
      expect(step.effects).toEqual([]);
    }
  });

  it("a stale turn_failed does not drop a founder who is already talking again", () => {
    const barged = reduceCall(speaking(), { type: "talk_start", source: "ptt" }).state;
    expect(reduceCall(barged, { type: "turn_failed", turn: 1 }).state.phase).toBe("listening");
  });

  it("Skip stops the voice and the rest of the reply", () => {
    const step = reduceCall(speaking(), { type: "skip" });
    expect(step.state.phase).toBe("idle");
    expect(types(step.effects)).toEqual(["cancel_speech", "cancel_turn"]);
    expect(reduceCall(initialCallState(), { type: "skip" }).effects).toEqual([]);
  });
});

describe("call state machine: input rules", () => {
  it("a tap that is too short or silent is discarded, not sent", () => {
    const { state, effects } = play([{ type: "talk_start", source: "ptt" }, { type: "talk_end", source: "ptt", keep: false }]);
    expect(state.phase).toBe("idle");
    expect(state.turn).toBe(0);
    expect(types(effects)).toEqual(["start_recording", "discard_recording"]);
  });

  it("a hands-free speech end cannot finish a push-to-talk utterance, and push-to-talk takes over a hands-free one", () => {
    const hf = initialCallState({ handsFree: true });
    const a = play([{ type: "talk_start", source: "ptt" }, { type: "talk_end", source: "vad", keep: true }], hf);
    expect(a.state.phase).toBe("listening");
    expect(a.state.source).toBe("ptt");

    const b = play([{ type: "talk_start", source: "vad" }, { type: "talk_start", source: "ptt" }, { type: "talk_end", source: "vad", keep: true }], hf);
    expect(b.state.phase).toBe("listening");
    expect(b.state.source).toBe("ptt");
    expect(types(b.effects)).toEqual(["start_recording"]); // one recording, not two
  });

  it("hands-free speech is ignored when hands-free is off", () => {
    const step = reduceCall(initialCallState(), { type: "talk_start", source: "vad" });
    expect(step.state.phase).toBe("idle");
    expect(step.effects).toEqual([]);
  });

  it("muting ignores talking; muting while listening discards the recording; the Director keeps speaking", () => {
    const muted = play([{ type: "mute", muted: true }, { type: "talk_start", source: "ptt" }]);
    expect(muted.state.phase).toBe("idle");
    expect(muted.effects).toEqual([]);

    const mid = play([{ type: "talk_start", source: "ptt" }, { type: "mute", muted: true }]);
    expect(mid.state.phase).toBe("idle");
    expect(types(mid.effects)).toEqual(["start_recording", "discard_recording"]);

    const sp = play([{ type: "talk_start", source: "ptt" }, { type: "talk_end", source: "ptt", keep: true }, { type: "audio_started", turn: 1 }, { type: "mute", muted: true }]);
    expect(sp.state.phase).toBe("speaking");
    expect(canTalk(sp.state)).toBe(false);
    expect(canTalk(reduceCall(sp.state, { type: "mute", muted: false }).state)).toBe(true);
  });

  it("turning hands-free off while a hands-free utterance is recorded discards it", () => {
    const step = play([{ type: "talk_start", source: "vad" }, { type: "hands_free", on: false }], initialCallState({ handsFree: true }));
    expect(step.state.phase).toBe("idle");
    expect(step.state.handsFree).toBe(false);
    expect(types(step.effects)).toEqual(["start_recording", "discard_recording"]);
  });
});

describe("call state machine: ending", () => {
  it("end stops everything exactly once", () => {
    const sp = play([{ type: "talk_start", source: "ptt" }, { type: "talk_end", source: "ptt", keep: true }, { type: "audio_started", turn: 1 }]).state;
    const step = reduceCall(sp, { type: "end" });
    expect(step.state.ended).toBe(true);
    expect(step.state.phase).toBe("idle");
    expect(types(step.effects)).toEqual(["discard_recording", "cancel_speech", "cancel_turn", "teardown"]);
    expect(reduceCall(step.state, { type: "end" }).effects).toEqual([]);
  });

  it("nothing happens after the call ended", () => {
    const ended = reduceCall(initialCallState(), { type: "end" }).state;
    for (const e of [
      { type: "talk_start", source: "ptt" }, { type: "talk_end", source: "ptt", keep: true }, { type: "audio_started", turn: 0 }, { type: "mute", muted: true }, { type: "skip" },
    ] as CallEvent[]) {
      const step = reduceCall(ended, e);
      expect(step.state).toEqual(ended);
      expect(step.effects).toEqual([]);
    }
    expect(canTalk(ended)).toBe(false);
  });
});

describe("call state labels", () => {
  it("says what is happening in plain words", () => {
    expect(phaseLabel("listening")).toBe("Listening…");
    expect(phaseLabel("thinking")).toBe("Thinking…");
    expect(phaseLabel("speaking")).toBe("Speaking");
    expect(phaseLabel("idle", { muted: true })).toBe("Microphone is muted");
    expect(phaseLabel("idle", { handsFree: true })).toMatch(/just talk/);
    expect(phaseLabel("idle")).toMatch(/hold Space/i);
  });
});
