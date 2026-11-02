// P4-19: register this additive voice port with the existing Studio proof registry.
export const VOICE_CORE_ENV_BLOCK = "# Director companion calls: opt in only (P4-19).\nNEXT_PUBLIC_STUDIO_VOICE_CALL=false\n";
export const VOICE_CORE_SCOPE_FILES = new Set([
  ".env.example",
  "docs/p4-19/RESULT.md",
  "docs/p4-19/VOICE-CORE.md",
  "docs/p4-19/source-inventory.json",
  "docs/p4-19/studio-comparison.json",
  "lib/studio/voice/avatar-rig.ts",
  "lib/studio/voice/bird-motion.ts",
  "lib/studio/voice/call-state.ts",
  "lib/studio/voice/flag.ts",
  "lib/studio/voice/format.ts",
  "lib/studio/voice/gestures.ts",
  "lib/studio/voice/index.ts",
  "lib/studio/voice/mic-errors.ts",
  "lib/studio/voice/sentences.ts",
  "lib/studio/voice/tone.ts",
  "lib/studio/voice/turns.ts",
  "lib/studio/voice/vad.ts",
  "package.json",
  "pnpm-lock.yaml",
  "scripts/fixtures/studio-voice-core/bird-motion.test.ts",
  "scripts/fixtures/studio-voice-core/voice-avatar-rig.test.ts",
  "scripts/fixtures/studio-voice-core/voice-call-state.test.ts",
  "scripts/fixtures/studio-voice-core/voice-flag.test.ts",
  "scripts/fixtures/studio-voice-core/voice-format.test.ts",
  "scripts/fixtures/studio-voice-core/voice-mic-errors.test.ts",
  "scripts/fixtures/studio-voice-core/voice-sentences.test.ts",
  "scripts/fixtures/studio-voice-core/voice-tone.test.ts",
  "scripts/fixtures/studio-voice-core/voice-turns.test.ts",
  "scripts/fixtures/studio-voice-core/voice-vad.test.ts",
  "scripts/studio-later-changes.mjs",
  "scripts/studio-voice-core-strip.mjs",
  "scripts/fixtures/studio-voice-core/voice-proof-registry.test.ts",
  "scripts/studio-voice-vitest.config.mjs",
  "scripts/test-studio-deck-sync-truth.mjs"
]);
export const VOICE_CORE_SCOPE_PIN = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^(?:Port pure Director voice core and fixture tests behind opt-in flag$|Add safe companion gesture hints and legacy clip fallbacks$|Document final Director voice fields and sentence-gap gesture wiring$|Voice core:)/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): the pure voice port owns these later commits; this proof still checks its original files\n";
/** Remove only our exact compatibility pin and test manifest additions; preserve every older assertion. */
export function stripVoiceCore(rel, text) {
  if (rel === "scripts/test-studio-deck-sync-truth.mjs") return text.replace(VOICE_CORE_SCOPE_PIN, "");
  if (rel === "package.json") return text
    .replace('"test:studio-launch-wording": "node scripts/test-studio-launch-wording.mjs",\n    "test:studio-voice-core": "vitest run --config scripts/studio-voice-vitest.config.mjs"', '"test:studio-launch-wording": "node scripts/test-studio-launch-wording.mjs"')
    .replace('    "vitest": "5.0.3",\n', '');
  return text;
}
