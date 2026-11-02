/**
 * The call's state machine (client-safe, pure): idle -> listening -> thinking -> speaking -> idle.
 *
 * `reduceCall(state, event)` returns the next state plus the side effects the browser must run (start/stop the recorder,
 * stop playback, abort the in-flight request). It never touches the browser itself, so every transition, including barge-in,
 * is covered by unit tests.
 *
 *  idle       ready; the founder can talk
 *  listening  the founder is talking (push-to-talk held, or hands-free speech detected)
 *  thinking   the recording was sent; waiting for the Director (transcribing, then Director), nothing is playing yet
 *  speaking   the Director's voice is playing
 *
 * Barge-in: `talk_start` while thinking or speaking cancels the pending turn and the playback, and starts a fresh recording.
 * Events that carry a `turn` are ignored when that turn is no longer the current one (a slow reply to a cancelled turn).
 */

export type CallPhase = "idle" | "listening" | "thinking" | "speaking";
export type TalkSource = "ptt" | "vad";

export interface CallState {
  phase: CallPhase;
  ended: boolean;
  /** Microphone muted: no push-to-talk, no hands-free detection. */
  muted: boolean;
  handsFree: boolean;
  /** Id of the current (or last) user turn; incremented each time a recording is sent. */
  turn: number;
  /** Who started the utterance being recorded (only while listening). */
  source: TalkSource | null;
  /** The reply stream of `turn` has finished. */
  replyDone: boolean;
  /** Speech audio of `turn` has started playing. */
  playing: boolean;
  /** How many times the founder talked over the Director or over a pending turn. */
  bargeIns: number;
}

export type CallEvent =
  | { type: "talk_start"; source: TalkSource }
  /** `keep: false`: the recording was too short or silent; discard it instead of sending. */
  | { type: "talk_end"; source: TalkSource; keep: boolean }
  /** Nothing to answer (empty transcript, or the turn failed before any speech). */
  | { type: "turn_failed"; turn: number }
  | { type: "audio_started"; turn: number }
  | { type: "reply_done"; turn: number }
  /** Every queued speech clip of the reply has finished (and the reply is done). */
  | { type: "audio_drained"; turn: number }
  /** The founder pressed "Skip" (stop speaking / cancel the pending reply). */
  | { type: "skip" }
  | { type: "mute"; muted: boolean }
  | { type: "hands_free"; on: boolean }
  | { type: "end" };

export type CallEffect =
  /** `fresh`: start a new recording now (push-to-talk, or barge-in). Otherwise keep the rolling hands-free recorder. */
  | { type: "start_recording"; source: TalkSource; fresh: boolean }
  /** Stop the recorder and send the audio as turn `state.turn`. */
  | { type: "send_recording" }
  | { type: "discard_recording" }
  | { type: "cancel_speech" }
  | { type: "cancel_turn" }
  | { type: "teardown" };

export interface CallStep {
  state: CallState;
  effects: CallEffect[];
}

export const initialCallState = (init: Partial<Pick<CallState, "handsFree" | "muted">> = {}): CallState => ({
  phase: "idle",
  ended: false,
  muted: init.muted ?? false,
  handsFree: init.handsFree ?? false,
  turn: 0,
  source: null,
  replyDone: false,
  playing: false,
  bargeIns: 0,
});

/** True when the founder can start talking now (also true while the Director speaks: that is a barge-in). */
export const canTalk = (s: CallState): boolean => !s.ended && !s.muted;

const none = (state: CallState): CallStep => ({ state, effects: [] });

export function reduceCall(s: CallState, e: CallEvent): CallStep {
  if (s.ended) return none(s);

  switch (e.type) {
    case "talk_start": {
      if (s.muted) return none(s);
      if (e.source === "vad" && !s.handsFree) return none(s);
      if (s.phase === "listening") {
        // Push-to-talk pressed while a hands-free utterance is being recorded: it takes over (keep recording).
        return s.source === e.source ? none(s) : none({ ...s, source: e.source === "ptt" ? "ptt" : s.source });
      }
      if (s.phase === "idle") {
        return {
          state: { ...s, phase: "listening", source: e.source },
          effects: [{ type: "start_recording", source: e.source, fresh: e.source === "ptt" }],
        };
      }
      // thinking | speaking: barge-in.
      return {
        state: { ...s, phase: "listening", source: e.source, replyDone: false, playing: false, bargeIns: s.bargeIns + 1 },
        effects: [{ type: "cancel_speech" }, { type: "cancel_turn" }, { type: "start_recording", source: e.source, fresh: true }],
      };
    }

    case "talk_end": {
      if (s.phase !== "listening" || s.source !== e.source) return none(s);
      if (!e.keep) return { state: { ...s, phase: "idle", source: null }, effects: [{ type: "discard_recording" }] };
      return {
        state: { ...s, phase: "thinking", source: null, turn: s.turn + 1, replyDone: false, playing: false },
        effects: [{ type: "send_recording" }],
      };
    }

    case "turn_failed": {
      if (e.turn !== s.turn) return none(s);
      if (s.phase === "thinking") return none({ ...s, phase: "idle", replyDone: true, playing: false });
      if (s.phase === "speaking") return none({ ...s, replyDone: true }); // let what is already queued finish
      return none(s);
    }

    case "audio_started": {
      if (e.turn !== s.turn || s.phase !== "thinking") return none(s);
      return none({ ...s, phase: "speaking", playing: true });
    }

    case "reply_done": {
      if (e.turn !== s.turn) return none(s);
      return none({ ...s, replyDone: true });
    }

    case "audio_drained": {
      if (e.turn !== s.turn || !s.replyDone) return none(s);
      if (s.phase === "thinking" || s.phase === "speaking") return none({ ...s, phase: "idle", playing: false });
      return none(s);
    }

    case "skip": {
      if (s.phase !== "speaking" && s.phase !== "thinking") return none(s);
      return {
        state: { ...s, phase: "idle", replyDone: true, playing: false },
        effects: [{ type: "cancel_speech" }, { type: "cancel_turn" }],
      };
    }

    case "mute": {
      if (e.muted === s.muted) return none(s);
      if (e.muted && s.phase === "listening") {
        return {
          state: { ...s, muted: true, phase: "idle", source: null },
          effects: [{ type: "discard_recording" }],
        };
      }
      return none({ ...s, muted: e.muted });
    }

    case "hands_free": {
      if (e.on === s.handsFree) return none(s);
      if (!e.on && s.phase === "listening" && s.source === "vad") {
        return { state: { ...s, handsFree: false, phase: "idle", source: null }, effects: [{ type: "discard_recording" }] };
      }
      return none({ ...s, handsFree: e.on });
    }

    case "end": {
      return {
        state: { ...s, ended: true, phase: "idle", source: null, replyDone: true, playing: false },
        effects: [{ type: "discard_recording" }, { type: "cancel_speech" }, { type: "cancel_turn" }, { type: "teardown" }],
      };
    }
  }
}

/** Plain words for each phase (captions, screen readers, the status line). */
export function phaseLabel(phase: CallPhase, opts: { muted?: boolean; handsFree?: boolean } = {}): string {
  if (phase === "listening") return "Listening…";
  if (phase === "thinking") return "Thinking…";
  if (phase === "speaking") return "Speaking";
  if (opts.muted) return "Microphone is muted";
  return opts.handsFree ? "Listening for you — just talk" : "Ready — hold Space or the button to talk";
}
