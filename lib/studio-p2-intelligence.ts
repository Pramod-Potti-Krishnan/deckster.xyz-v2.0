/**
 * PASS2-PAGES Intelligence (streams/ops/PASS2-PAGES/intelligence.md), the "move to mock" rows that need no contract, in Design preview only:
 *   INT-03  a fifth row, Voice & Narration, with the real narration voices (lib/narration/voices.ts) in a draft select like the other rows.
 *   INT-04  row anatomy: the current model in bold with "provider · Recommended / Your choice" between the task and its select; the select's
 *           first option reads "Recommended — <model>".
 *   INT-07  no permanently disabled "Apply to Deckster"; choices apply to the draft on change, and "Reset to recommendations" sits in the list
 *           header only while something is changed.
 * Not built: INT-05 presets (the model-router registry presets name models that are not in this page's catalog snapshot, so a preset could
 * not be shown honestly without a catalog decision), INT-15 (shared shell row, own PR), INT-01 (third option).
 *
 * Flag NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE: exact "true" and the literal Studio shell. Off: every rendered byte is unchanged.
 * Import-free on purpose, so scripts/test-studio-p2-intelligence.mjs can run the real file in a bare vm.
 */
export const STUDIO_P2_INTELLIGENCE_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === 'true'

/** INT-04: the select's first option. */
export function recommendedOptionLabel(modelName: string): string {
  return `Recommended — ${modelName}`
}

/** INT-04: where the shown model comes from. */
export function choiceOriginLabel(isDefault: boolean): 'Recommended' | 'Your choice' {
  return isDefault ? 'Recommended' : 'Your choice'
}

const VOICE_PROVIDERS: Record<string, string> = { 'fish-audio': 'Fish Audio', microsoft: 'Microsoft', hexgrad: 'Hexgrad', google: 'Google', openai: 'OpenAI' }
const VOICE_MODELS: Record<string, string> = {
  'fish-audio/s2.1-pro': 'Fish Audio S2.1 Pro',
  'microsoft/mai-voice-2-flash': 'MAI Voice 2 Flash',
  'hexgrad/kokoro-82m': 'Kokoro 82M',
  'google/gemini-3.1-flash-tts-preview': 'Gemini 3.1 Flash TTS',
}

/** INT-03: the provider of a narration voice's model id ("fish-audio/s2.1-pro" -> "Fish Audio"). */
export function voiceProvider(modelId: string): string {
  return VOICE_PROVIDERS[modelId.split('/')[0]] ?? 'Narration service'
}

/** INT-03: the model's display name; an id this build does not know shows as its last path part. */
export function voiceModelName(modelId: string): string {
  return VOICE_MODELS[modelId] ?? (modelId.split('/').pop() || modelId)
}

/** INT-03: one voice option, "Ava · MAI Voice 2 Flash". */
export function voiceOptionLabel(voice: { name: string; model: string }): string {
  return `${voice.name} · ${voiceModelName(voice.model)}`
}
