// PASS2 INT-01/03/04/05/07 (flag NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE, default off). Import-free: the five tasks, the presets, the voices, how a choice resolves to a
// model, what each task's select offers, and how a choice is kept in this browser.
//
// The Intelligence page opens on the model chooser (the accepted v4 mockup's five rows: Planning & Strategy, Content Writing, Research & Analysis, Imagery,
// Voice & Narration). Each row names the current model and where it came from (Recommended / Your choice), and its select offers the recommendation, the
// Best / Balanced / Economy presets, the specific models and, for narration, the voices. A choice applies on change; nothing is sent anywhere.
//
// The models, task defaults and retired-model successors still come from the page's live catalog snapshot (the caller passes it in). The presets and the voices
// are the model registry's own (backend/model-router/registry/models.json, catalogue 2026-08-20.1, the same excerpt the v4 mockup carries); a preset that names a
// model the catalog has retired resolves to that model's successor, exactly as a saved draft does.

export type P2TaskId = 'planning_strategy' | 'content_writing' | 'research_analysis' | 'imagery' | 'voice_narration'
export type P2PresetId = 'best' | 'balanced' | 'economy'

/** The page's catalog snapshot, as much of it as the chooser reads. */
export interface P2Catalog {
  version: string
  tasks: Record<string, { label: string; defaultModel: string; models: readonly string[] }>
  models: Record<string, { name: string; provider: string }>
  retiredModels?: Record<string, { successor: string }>
}

/** The five tasks in the mockup's order, with the descriptors under each name. */
export const P2_TASKS: readonly { id: P2TaskId; label: string; descriptors: readonly string[] }[] = [
  { id: 'planning_strategy', label: 'Planning & Strategy', descriptors: ['Deck planning', 'Story structure', 'Narrative strategy'] },
  { id: 'content_writing', label: 'Content Writing', descriptors: ['Slide copy', 'Speaker notes', 'Writing and rewriting'] },
  { id: 'research_analysis', label: 'Research & Analysis', descriptors: ['Research planning', 'Source synthesis', 'Analysis'] },
  { id: 'imagery', label: 'Imagery', descriptors: ['Slide imagery', 'Image generation', 'Illustrations'] },
  { id: 'voice_narration', label: 'Voice & Narration', descriptors: ['Presentation narration', 'Voice selection'] },
]
export const P2_TASK_IDS: readonly P2TaskId[] = P2_TASKS.map(task => task.id)

export const P2_PRESETS: readonly { id: P2PresetId; label: string }[] = [
  { id: 'best', label: 'Best' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'economy', label: 'Economy' },
]

/** The registry's presets for the four model tasks (catalogue 2026-08-20.1). Economy names Gemini 2.5 Flash Lite, which a refreshed catalog maps to its successor. */
export const P2_PRESET_MODELS: Record<'planning_strategy' | 'content_writing' | 'research_analysis' | 'imagery', Record<P2PresetId, string>> = {
  planning_strategy: { best: 'google/gemini-3.1-pro-preview', balanced: 'google/gemini-3-flash-preview', economy: 'google/gemini-2.5-flash-lite' },
  content_writing: { best: 'google/gemini-3.5-flash', balanced: 'google/gemini-3-flash-preview', economy: 'google/gemini-2.5-flash-lite' },
  research_analysis: { best: 'google/gemini-3.1-pro-preview', balanced: 'google/gemini-3-flash-preview', economy: 'google/gemini-2.5-flash-lite' },
  imagery: { best: 'google/gemini-3.1-flash-image-preview', balanced: 'google/gemini-2.5-flash-image', economy: 'google/gemini-2.5-flash-image' },
}

export interface P2VoiceModel { id: string; name: string; provider: string; voices: readonly { id: string; name: string }[] }

/** The registry's narration models, the recommended one first, with their voices. */
export const P2_VOICE_MODELS: readonly P2VoiceModel[] = [
  { id: 'fish-audio/s2.1-pro', name: 'Fish Audio S2.1 Pro', provider: 'Fish Audio', voices: [{ id: 'alloy', name: 'Alloy' }] },
  { id: 'microsoft/mai-voice-2-flash', name: 'Microsoft MAI Voice 2 Flash', provider: 'Microsoft', voices: [{ id: 'ava', name: 'Ava' }, { id: 'andrew', name: 'Andrew' }] },
  { id: 'hexgrad/kokoro-82m', name: 'Kokoro 82M', provider: 'Hexgrad', voices: [{ id: 'heart', name: 'Heart' }] },
  { id: 'google/gemini-3.1-flash-tts-preview', name: 'Gemini 3.1 Flash TTS Preview', provider: 'Google', voices: [{ id: 'zephyr', name: 'Zephyr' }, { id: 'puck', name: 'Puck' }, { id: 'charon', name: 'Charon' }, { id: 'kore', name: 'Kore' }, { id: 'aoede', name: 'Aoede' }] },
]
export const P2_VOICE_RECOMMENDED = 'fish-audio/s2.1-pro'
export const P2_VOICE_PRESET_MODELS: Record<P2PresetId, string> = { best: 'fish-audio/s2.1-pro', balanced: 'microsoft/mai-voice-2-flash', economy: 'hexgrad/kokoro-82m' }

/** A choice: the recommendation, a preset, a specific model (`model:<id>`) or, for narration only, a voice (`voice:<model id>::<voice id>`). */
export type P2Choice = string
export type P2Choices = Record<P2TaskId, P2Choice>

export const P2_DEFAULT_CHOICE = 'default'
export const p2DefaultChoices = (): P2Choices => ({ planning_strategy: P2_DEFAULT_CHOICE, content_writing: P2_DEFAULT_CHOICE, research_analysis: P2_DEFAULT_CHOICE, imagery: P2_DEFAULT_CHOICE, voice_narration: P2_DEFAULT_CHOICE })
export const p2ChangedCount = (choices: P2Choices) => P2_TASK_IDS.filter(id => choices[id] !== P2_DEFAULT_CHOICE).length
export const p2TaskLabel = (id: P2TaskId) => P2_TASKS.find(task => task.id === id)?.label ?? id
export const P2_ONE_LINE = 'Your choices are kept on this device. Deckster does not use them to pick models yet.'
export const P2_ONE_LINE_NO_STORAGE = 'This browser cannot keep your choices, so they last only until you reload or leave. Deckster does not use them to pick models yet.'

/** A retired model id resolves to its successor; any other id passes through. The base catalog lists none, so with it this is the identity. */
export function p2ResolveRetired(catalog: P2Catalog, id: string) {
  return catalog.retiredModels?.[id]?.successor ?? id
}

const isModelTask = (task: P2TaskId): task is Exclude<P2TaskId, 'voice_narration'> => task !== 'voice_narration'
const isPreset = (value: string): value is P2PresetId => value === 'best' || value === 'balanced' || value === 'economy'
const voiceKey = (modelId: string, voiceId: string) => `voice:${modelId}::${voiceId}`

/** The model ids a model task's select offers as specific models: what the catalog lists for the task. */
export const p2ModelIds = (catalog: P2Catalog, task: Exclude<P2TaskId, 'voice_narration'>) => catalog.tasks[task].models
export const p2AllVoices = () => P2_VOICE_MODELS.flatMap(model => model.voices.map(voice => ({ key: voiceKey(model.id, voice.id), voiceName: voice.name, model })))

/** The model a preset names for a task, resolved through the catalog's retirements. Null when the result is not one the task offers. */
export function p2PresetModelId(catalog: P2Catalog, task: P2TaskId, preset: P2PresetId): string | null {
  if (!isModelTask(task)) return P2_VOICE_PRESET_MODELS[preset]
  const id = p2ResolveRetired(catalog, P2_PRESET_MODELS[task][preset])
  return p2ModelIds(catalog, task).includes(id) ? id : null
}

export function isP2Choice(catalog: P2Catalog, task: P2TaskId, value: unknown): value is P2Choice {
  if (typeof value !== 'string') return false
  if (value === P2_DEFAULT_CHOICE) return true
  if (isPreset(value)) return p2PresetModelId(catalog, task, value) !== null
  if (value.startsWith('model:')) {
    const id = value.slice(6)
    return isModelTask(task) ? p2ModelIds(catalog, task).includes(id) : P2_VOICE_MODELS.some(model => model.id === id)
  }
  if (value.startsWith('voice:')) return task === 'voice_narration' && p2AllVoices().some(voice => voice.key === value)
  return false
}

export interface P2Resolved {
  /** What the row shows in bold: the model, or for narration the voice. */
  name: string
  provider: string
  /** The model id behind the choice (narration: the voice's model). */
  modelId: string
  voiceName?: string
  /** Recommended for the catalog's own default, Your choice for everything the viewer picked. */
  origin: 'Recommended' | 'Your choice'
}

/** The catalog's starting point for a task: the catalog default for a model task, the registry's recommended model for narration. */
export function p2RecommendedModelId(catalog: P2Catalog, task: P2TaskId) {
  return isModelTask(task) ? p2ResolveRetired(catalog, catalog.tasks[task].defaultModel) : P2_VOICE_RECOMMENDED
}

function voiceModel(id: string) { return P2_VOICE_MODELS.find(model => model.id === id) ?? P2_VOICE_MODELS[0] }

/** Resolves a choice (an invalid one reads as the recommendation). */
export function p2Resolve(catalog: P2Catalog, task: P2TaskId, choice: P2Choice): P2Resolved {
  const valid = isP2Choice(catalog, task, choice) ? choice : P2_DEFAULT_CHOICE
  const origin = valid === P2_DEFAULT_CHOICE ? 'Recommended' : 'Your choice'
  if (task === 'voice_narration') {
    let modelId = P2_VOICE_RECOMMENDED
    let voiceName: string | undefined
    if (isPreset(valid)) modelId = P2_VOICE_PRESET_MODELS[valid]
    else if (valid.startsWith('model:')) modelId = valid.slice(6)
    else if (valid.startsWith('voice:')) {
      const found = p2AllVoices().find(voice => voice.key === valid)
      if (found) { modelId = found.model.id; voiceName = found.voiceName }
    }
    const model = voiceModel(modelId)
    voiceName ??= model.voices[0].name
    return { name: voiceName, provider: model.provider, modelId: model.id, voiceName, origin }
  }
  const modelId = isPreset(valid) ? (p2PresetModelId(catalog, task, valid) as string) : valid.startsWith('model:') ? valid.slice(6) : p2RecommendedModelId(catalog, task)
  const model = catalog.models[modelId]
  return { name: model.name, provider: model.provider, modelId, origin }
}

export interface P2Option { value: string; label: string }
export interface P2OptionGroups {
  recommended: P2Option
  presets: P2Option[]
  models: P2Option[]
  /** Narration only: one entry per voice, "Alloy · Fish Audio S2.1 Pro". */
  voices: P2Option[]
}

/** What a task's select offers, in the mockup's order: the recommendation, the presets, the specific models, then (narration) the voices. */
export function p2Options(catalog: P2Catalog, task: P2TaskId): P2OptionGroups {
  const recommended = p2Resolve(catalog, task, P2_DEFAULT_CHOICE)
  const presets: P2Option[] = []
  for (const preset of P2_PRESETS) {
    if (p2PresetModelId(catalog, task, preset.id) === null) continue
    // A narration preset names the model (its first voice is what plays); a model task's names the model too.
    const modelId = p2PresetModelId(catalog, task, preset.id) as string
    presets.push({ value: preset.id, label: `${preset.label} — ${task === 'voice_narration' ? voiceModel(modelId).name : catalog.models[modelId].name}` })
  }
  if (task === 'voice_narration') {
    return {
      recommended: { value: P2_DEFAULT_CHOICE, label: `Recommended — ${recommended.name} · ${voiceModel(recommended.modelId).name}` },
      presets,
      models: P2_VOICE_MODELS.map(model => ({ value: `model:${model.id}`, label: `${model.name} · ${model.provider}` })),
      voices: p2AllVoices().map(voice => ({ value: voice.key, label: `${voice.voiceName} · ${voice.model.name}` })),
    }
  }
  return {
    recommended: { value: P2_DEFAULT_CHOICE, label: `Recommended — ${recommended.name}` },
    presets,
    models: p2ModelIds(catalog, task).map(id => ({ value: `model:${id}`, label: `${catalog.models[id].name} · ${catalog.models[id].provider}` })),
    voices: [],
  }
}

/** The model "Compare with" opens on for a model task: the first one the task offers that is not the current model. */
export function p2ComparisonFor(catalog: P2Catalog, task: Exclude<P2TaskId, 'voice_narration'>, choice: P2Choice) {
  const current = p2Resolve(catalog, task, choice).modelId
  return p2ModelIds(catalog, task).find(id => id !== current) ?? current
}

/** The line under a row's current model: "Google · Recommended". */
export const p2OriginLine = (resolved: P2Resolved) => `${resolved.provider} · ${resolved.origin}`

// ---- keeping the choices in this browser ----------------------------------------------------------------------------------------------------------------

/** The key carries a format version and the catalog version, so choices made against another catalog are never read back into this one. */
export const p2StorageKey = (catalog: P2Catalog) => `deckster-studio-intelligence-p2-v1:${catalog.version}`

/** An id the catalog retired is stored as its successor; a choice the task does not offer (or of the wrong shape) is dropped to the recommendation. */
export function p2Sanitize(catalog: P2Catalog, value: unknown): P2Choices {
  const choices = p2DefaultChoices()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return choices
  const stored = value as Record<string, unknown>
  for (const task of P2_TASK_IDS) {
    const raw = Object.prototype.hasOwnProperty.call(stored, task) ? stored[task] : undefined
    if (typeof raw !== 'string') continue
    const resolved = raw.startsWith('model:') && isModelTask(task) ? `model:${p2ResolveRetired(catalog, raw.slice(6))}` : raw
    if (isP2Choice(catalog, task, resolved)) choices[task] = resolved
  }
  return choices
}

export function p2Serialize(catalog: P2Catalog, choices: P2Choices) {
  return JSON.stringify({ v: 1, catalog: catalog.version, choices })
}

/** The stored choices, or null when nothing is stored, the format or catalog differs, or nothing differs from the recommendations. */
export function p2Parse(catalog: P2Catalog, raw: string | null): P2Choices | null {
  if (!raw) return null
  let saved: { v?: unknown; catalog?: unknown; choices?: unknown } | null
  try { saved = JSON.parse(raw) } catch { return null }
  if (!saved || typeof saved !== 'object' || saved.v !== 1 || saved.catalog !== catalog.version) return null
  const choices = p2Sanitize(catalog, saved.choices)
  return p2ChangedCount(choices) ? choices : null
}

/** A draft the earlier Design preview kept (one model id per task, no presets, no voices) becomes the same choices here. */
export function p2FromLegacyDraft(catalog: P2Catalog, draft: Record<string, string> | null): P2Choices | null {
  if (!draft) return null
  const choices = p2Sanitize(catalog, Object.fromEntries(P2_TASK_IDS.filter(task => isModelTask(task) && draft[task] && draft[task] !== P2_DEFAULT_CHOICE).map(task => [task, `model:${draft[task]}`])))
  return p2ChangedCount(choices) ? choices : null
}

// ---- the status pill -------------------------------------------------------------------------------------------------------------------------------------

export type P2Storage = 'pending' | 'ok' | 'unavailable'
export function p2Status(changed: number, storage: P2Storage): { state: 'saved' | 'session' | 'clean'; label: string } {
  if (changed > 0) return storage === 'unavailable' ? { state: 'session', label: 'Session only' } : { state: 'saved', label: 'Saved on this device' }
  return { state: 'clean', label: 'Following recommendations' }
}

/** The line a live region speaks after a choice. */
export function p2ChoiceFeedback(catalog: P2Catalog, task: P2TaskId, choice: P2Choice, storage: P2Storage) {
  const resolved = p2Resolve(catalog, task, choice)
  const where = storage === 'unavailable' ? 'for this session' : 'on this device'
  return choice === P2_DEFAULT_CHOICE ? `${p2TaskLabel(task)} follows the recommendation, ${resolved.name}.` : `${p2TaskLabel(task)}: ${resolved.name} kept ${where}.`
}
export const P2_RESET_LABEL = 'Reset to recommendations'
export const P2_RESET_FEEDBACK = 'Your choices now follow Deckster’s recommendations.'
