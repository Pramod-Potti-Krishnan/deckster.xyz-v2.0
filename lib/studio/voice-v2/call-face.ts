/**
 * Deckster glue between Studio's voice call and Garud's v2 modules (ported from Garud feature/companion-v2-player b3a812e). Pure: no React, no DOM.
 * - What expression each call scene wears (companion_state -> scene is lib/studio-voice-call-ui.ts; scene -> recipe is here).
 * - The mouth the call can drive: a speech timeline when one exists (sampleCompanionSpeech on the audio clock), else Garud's loudness fallback
 *   (companionLoudnessMouth, the same thresholds and 20 Hz shape variety as the bird method), with Garud's 70 ms patch crossfade between shapes.
 */
import type { FaceExpression, FaceMouth, SpeechTimeline } from "../voice/companion-face";
import { COMPANION_MOUTH_FADE, companionLoudnessMouth, sampleCompanionSpeech, type CompanionMouthSample, type PreparedCompanionSpeech } from "./companion-speech";

/** Studio's call scenes (lib/studio-voice-call-ui.ts CompanionScene) to the pack's recipes. Anything not listed is the plain neutral face. */
const SCENE_EXPRESSIONS: Readonly<Record<string, FaceExpression>> = Object.freeze({
  thinking: "thinking", working: "thinking", pleased: "happy", celebrating: "happy", concerned: "concerned", sorry: "sorry",
});
export function sceneExpression(scene: string): FaceExpression | "neutral" {
  return Object.prototype.hasOwnProperty.call(SCENE_EXPRESSIONS, scene) ? SCENE_EXPRESSIONS[scene]! : "neutral";
}

/** The mouth carried between frames for the loudness path (a timeline needs no memory: it is sampled from the audio clock alone). */
export interface CallMouthMemory { mouth: FaceMouth; previousMouth: FaceMouth; changedAt: number }
export const CALL_MOUTH_REST: CallMouthMemory = Object.freeze({ mouth: "closed", previousMouth: "closed", changedAt: 0 }) as CallMouthMemory;

/**
 * One frame's mouth. `speaking` false (or reduced motion) closes it. With a timeline, Garud's sampler decides from `audioTime`.
 * Without one, the loudness shape for (level, audioTime); a change of shape starts a COMPANION_MOUTH_FADE crossfade from the shape before.
 */
export function callMouth(input: { speaking: boolean; level: number; audioTime: number; timeline?: SpeechTimeline | PreparedCompanionSpeech; reduced?: boolean }, memory: CallMouthMemory = CALL_MOUTH_REST): { sample: CompanionMouthSample; memory: CallMouthMemory } {
  const t = Number.isFinite(input.audioTime) ? Math.max(0, input.audioTime) : 0;
  if (!input.speaking || input.reduced) {
    const shut: CompanionMouthSample = { mouth: "closed", previousMouth: "closed", mouthMix: 1 };
    return { sample: shut, memory: { mouth: "closed", previousMouth: "closed", changedAt: t } };
  }
  if (input.timeline) return { sample: sampleCompanionSpeech(input.timeline, t), memory };
  const shape = companionLoudnessMouth(input.level, t);
  // A clock that went backward (a new segment) starts over without a stale blend.
  const next = shape === memory.mouth && t >= memory.changedAt ? memory : { mouth: shape, previousMouth: t >= memory.changedAt ? memory.mouth : shape, changedAt: t };
  const mouthMix = Math.max(0, Math.min(1, (t - next.changedAt) / COMPANION_MOUTH_FADE));
  return { sample: { mouth: next.mouth, previousMouth: next.previousMouth, mouthMix: next.previousMouth === next.mouth ? 1 : mouthMix }, memory: next };
}
