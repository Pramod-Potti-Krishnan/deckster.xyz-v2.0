import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const nodeRequire = createRequire(import.meta.url)
const ts = nodeRequire('typescript')

function loadTypeScriptModule(path, stubs = {}, jsx = ts.JsxEmit.None) {
  const source = fs.readFileSync(path, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx,
      esModuleInterop: true,
    },
  })
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module: mod,
    exports: mod.exports,
    console,
    process,
    fetch,
    AbortController,
    setTimeout,
    clearTimeout,
    require: id => {
      if (id in stubs) return stubs[id]
      throw new Error(`Unexpected test import: ${id}`)
    },
  })
  return mod.exports
}

const timeoutModule = loadTypeScriptModule(
  new URL('../lib/element-generation-timeout.ts', import.meta.url),
)

const diagramTypes = [
  'CODE_DISPLAY',
  'KANBAN_BOARD',
  'GANTT_CHART',
  'CHEVRON_MATURITY',
  'IDEA_BOARD',
  'CLOUD_ARCHITECTURE',
  'LOGICAL_ARCHITECTURE',
  'DATA_ARCHITECTURE',
  'CUSTOM',
]
for (const type of diagramTypes) {
  assert.equal(
    timeoutModule.resolveElementGenerationTimeoutMs(type, 'off'),
    150_000,
    `${type} receives the structured-planning timeout without Research`,
  )
}
assert.equal(timeoutModule.resolveElementGenerationTimeoutMs('TEXT_BOX', 'off'), 30_000)
assert.equal(timeoutModule.resolveElementGenerationTimeoutMs('TEXT_BOX', 'on'), 150_000)
assert.equal(timeoutModule.resolveElementGenerationTimeoutMs('INFOGRAPHIC', 'off'), 300_000)

const promptLimitModule = loadTypeScriptModule(
  new URL('../lib/element-prompt-limit.ts', import.meta.url),
)
assert.equal(promptLimitModule.CUSTOM_DIAGRAM_PROMPT_MAX_LENGTH, 1200)
const prompt1198 = promptLimitModule.elementPromptLengthState('x'.repeat(1198), 1200)
assert.equal(prompt1198.overLimit, false)
assert.equal(prompt1198.overflow, 0)
const prompt1200 = promptLimitModule.elementPromptLengthState('x'.repeat(1200), 1200)
assert.equal(prompt1200.overLimit, false)
assert.equal(prompt1200.overflow, 0)
const prompt1201 = promptLimitModule.elementPromptLengthState('x'.repeat(1201), 1200)
assert.equal(prompt1201.overLimit, true)
assert.equal(prompt1201.overflow, 1)
const emoji1200 = promptLimitModule.elementPromptLengthState('🧪'.repeat(1200), 1200)
assert.equal(emoji1200.length, 1200)
assert.equal(emoji1200.overLimit, false)
const emoji1201 = promptLimitModule.elementPromptLengthState('🧪'.repeat(1201), 1200)
assert.equal(emoji1201.length, 1201)
assert.equal(emoji1201.overLimit, true)
assert.equal(emoji1201.overflow, 1)
assert.equal(
  promptLimitModule.elementPromptLengthState('x'.repeat(1201), null).overLimit,
  false,
  'other element types are not subject to the CUSTOM-only cap',
)

const refineGenerationConfigModule = loadTypeScriptModule(
  new URL('../lib/refine-generation-config.ts', import.meta.url),
)
const submittedCustomConfig = {
  version: 'diagram_generation_config_v1',
  diagram_type: 'CUSTOM',
  settings: { layout_hint: 'network' },
}
const returnedCustomConfig = {
  ...submittedCustomConfig,
  structured_data: {
    generated_ir: {
      title: 'Hydrogen safety interlock',
      nodes: [{ id: 'electrolyzer', label: 'Electrolyzer' }],
      edges: [],
    },
    generated_ir_source: 'generator',
  },
}
assert.equal(
  refineGenerationConfigModule.resolveRefineGenerationConfig(
    returnedCustomConfig,
    submittedCustomConfig,
  ),
  returnedCustomConfig,
  'the rendered CUSTOM IR must survive into an immediate follow-up refine',
)
assert.equal(
  refineGenerationConfigModule.resolveRefineGenerationConfig(
    returnedCustomConfig,
    submittedCustomConfig,
  ).structured_data.generated_ir.nodes[0].id,
  'electrolyzer',
)

const submittedGanttConfig = {
  version: 'diagram_generation_config_v1',
  diagram_type: 'GANTT_CHART',
  settings: { time_unit: 'weeks' },
  structured_data: {
    tasks: [{
      id: 'fat',
      name: 'Factory acceptance test',
      start_date: '2026-09-07',
      end_date: '2026-09-09',
    }],
  },
}
const returnedGanttConfig = {
  ...submittedGanttConfig,
  structured_data: {
    structured_data_source: 'generator',
    tasks: [{
      id: 'fat',
      name: 'Factory acceptance test',
      start_date: '2026-09-07',
      end_date: '2026-09-10',
    }],
  },
}
assert.equal(
  refineGenerationConfigModule.resolveRefineGenerationConfig(
    returnedGanttConfig,
    submittedGanttConfig,
  ),
  returnedGanttConfig,
  'the exact Gantt schedule returned by the renderer must beat the stale submitted schedule',
)
assert.equal(
  refineGenerationConfigModule.resolveRefineGenerationConfig(
    returnedGanttConfig,
    submittedGanttConfig,
  ).structured_data.tasks[0].end_date,
  '2026-09-10',
)
assert.equal(
  refineGenerationConfigModule.resolveRefineGenerationConfig(
    undefined,
    submittedGanttConfig,
  ),
  submittedGanttConfig,
  'legacy responses without a generation config retain the submitted fallback',
)

const catalogModule = loadTypeScriptModule(
  new URL('../lib/diagram-catalog.ts', import.meta.url),
)
assert.equal(
  catalogModule.DIAGRAM_CATALOG_FALLBACK.types
    .find(item => item.type === 'CUSTOM')
    ?.limits?.prompt_max_chars,
  promptLimitModule.CUSTOM_DIAGRAM_PROMPT_MAX_LENGTH,
  'CUSTOM UI and authoritative catalog must share the exact prompt ceiling',
)
const reactStub = {
  createElement: () => null,
  useCallback: callback => callback,
  useEffect: () => undefined,
  useMemo: callback => callback(),
  useRef: value => ({ current: value }),
  useState: value => [typeof value === 'function' ? value() : value, () => undefined],
}
const diagramFormModule = loadTypeScriptModule(
  new URL('../components/generation-panel/forms/diagram-form.tsx', import.meta.url),
  {
    react: reactStub,
    '@/types/textlabs': {
      TEXT_LABS_ELEMENT_DEFAULTS: {
        DIAGRAM: { width: 30, height: 14, zIndex: 1000 },
      },
    },
    '@/lib/diagram-catalog': catalogModule,
    '../shared/toggle-row': { ToggleRow: () => null },
    '../shared/z-index-input': { ZIndexInput: () => null },
    '../shared/theme-source-selector': { ThemeSourceSelector: () => null },
    '../shared/use-theme-source-state': {
      useThemeSourceState: () => ({
        themeSource: { mode: 'deck' },
        updateThemeSource: () => undefined,
        useDeckTheme: true,
        themeOverrides: null,
      }),
    },
    '@/lib/element-prompt-limit': promptLimitModule,
  },
  ts.JsxEmit.React,
)

const cloudHydration = diagramFormModule.resolveDiagramFormHydration(
  catalogModule.DIAGRAM_CATALOG_FALLBACK,
  {
    subtype: 'CLOUD_ARCHITECTURE',
    generationConfig: {
      version: 'diagram_generation_config_v1',
      diagram_type: 'CLOUD_ARCHITECTURE',
      settings: { show_layers: false },
      provider_selection: {
        mode: 'manual',
        provider: 'gcp',
        conflict_confirmed: true,
        confirmed_manual_provider: 'gcp',
        confirmed_prompt_provider: 'aws',
      },
    },
    zIndex: 812,
  },
  null,
)
assert.equal(cloudHydration.hasSource, true)
assert.equal(cloudHydration.subtype, 'CLOUD_ARCHITECTURE')
assert.equal(cloudHydration.provider, 'gcp')
assert.equal(cloudHydration.providerConflictConfirmed, true)
assert.equal(cloudHydration.providerConflictConfirmationKey, 'gcp:aws')
assert.equal(cloudHydration.showLayers, false)
assert.equal(cloudHydration.zIndex, 812)

const legacyBareConfirmationHydration = diagramFormModule.resolveDiagramFormHydration(
  catalogModule.DIAGRAM_CATALOG_FALLBACK,
  {
    subtype: 'CLOUD_ARCHITECTURE',
    generationConfig: {
      version: 'diagram_generation_config_v1',
      diagram_type: 'CLOUD_ARCHITECTURE',
      settings: {},
      provider_selection: {
        mode: 'manual',
        provider: 'gcp',
        conflict_confirmed: true,
      },
    },
  },
  null,
)
assert.equal(
  legacyBareConfirmationHydration.providerConflictConfirmed,
  false,
  'a legacy bare confirmation boolean must not authorize a future prompt conflict',
)
assert.equal(legacyBareConfirmationHydration.providerConflictConfirmationKey, null)
assert.equal(
  diagramFormModule.isProviderConflictConfirmationCurrent('gcp:aws', 'gcp', 'aws'),
  true,
)
assert.equal(
  diagramFormModule.isProviderConflictConfirmationCurrent('gcp:aws', 'gcp', 'azure'),
  false,
  'editing the prompt to name a different provider must invalidate confirmation synchronously',
)
assert.equal(
  diagramFormModule.isProviderConflictConfirmationCurrent('gcp:aws', 'azure', 'aws'),
  false,
  'changing the manual provider must invalidate confirmation synchronously',
)

const customHydration = diagramFormModule.resolveDiagramFormHydration(
  catalogModule.DIAGRAM_CATALOG_FALLBACK,
  null,
  {
    formData: {
      componentType: 'CUSTOM',
      prompt: 'Engineering interlock',
      count: 1,
      layout: 'horizontal',
      advancedModified: true,
      z_index: 734,
      diagramConfig: { layout_hint: 'network' },
      generationConfig: {
        version: 'diagram_generation_config_v1',
        diagram_type: 'CUSTOM',
        settings: { layout_hint: 'network' },
      },
    },
  },
)
assert.equal(customHydration.hasSource, true)
assert.equal(customHydration.subtype, 'CUSTOM')
assert.equal(customHydration.layoutHint, 'network')
assert.equal(customHydration.advancedModified, true)
assert.equal(customHydration.zIndex, 734)

const freshHydration = diagramFormModule.resolveDiagramFormHydration(
  catalogModule.DIAGRAM_CATALOG_FALLBACK,
  null,
  null,
)
assert.equal(freshHydration.hasSource, false)
assert.equal(freshHydration.subtype, 'CODE_DISPLAY')
assert.equal(freshHydration.selectionMode, 'auto')
assert.equal(freshHydration.resolvedType, null)
assert.equal(freshHydration.languageSelectionMode, 'auto')

const autoCodeHydration = diagramFormModule.resolveDiagramFormHydration(
  catalogModule.DIAGRAM_CATALOG_FALLBACK,
  null,
  {
    formData: {
      componentType: 'DIAGRAM_AUTO',
      prompt: 'Show a TypeScript retry helper',
      count: 1,
      layout: 'auto',
      generationConfig: {
        version: 'diagram_generation_config_v1',
        diagram_type: 'CODE_DISPLAY',
        selection_mode: 'auto',
        resolved_type: 'CODE_DISPLAY',
        settings: { color_theme: 'github_dark' },
        language_selection: { mode: 'auto' },
        resolved_language: 'typescript',
      },
    },
  },
)
assert.equal(autoCodeHydration.selectionMode, 'auto')
assert.equal(autoCodeHydration.resolvedType, 'CODE_DISPLAY')
assert.equal(autoCodeHydration.languageSelectionMode, 'auto')
assert.equal(autoCodeHydration.resolvedLanguage, 'typescript')

const explicitManualHydration = diagramFormModule.resolveDiagramFormHydration(
  catalogModule.DIAGRAM_CATALOG_FALLBACK,
  {
    subtype: 'GANTT_CHART',
    generationConfig: {
      version: 'diagram_generation_config_v1',
      diagram_type: 'GANTT_CHART',
      selection_mode: 'manual',
      settings: { time_unit: 'weeks' },
    },
  },
  {
    formData: {
      componentType: 'DIAGRAM_AUTO',
      prompt: 'stale draft',
      count: 1,
      layout: 'auto',
      generationConfig: null,
    },
  },
)
assert.equal(explicitManualHydration.selectionMode, 'manual')
assert.equal(explicitManualHydration.subtype, 'GANTT_CHART')

const panelSource = fs.readFileSync(
  new URL('../components/generation-panel/index.tsx', import.meta.url),
  'utf8',
)
assert.match(panelSource, /key=\{`\$\{activationId\}:\$\{elementType\}`\}/)
assert.doesNotMatch(
  panelSource,
  /key=\{`\$\{activationId\}:\$\{elementType\}:\$\{draftKey/,
  'Layout-issued ID changes must not remount the active form',
)
assert.match(panelSource, /<DiagramForm[\s\S]*initialDraft=\{initialDraft\}/)

const diagramSource = fs.readFileSync(
  new URL('../components/generation-panel/forms/diagram-form.tsx', import.meta.url),
  'utf8',
)
assert.match(
  diagramSource,
  /if \(!hydration\.hasSource \|\| controlsTouchedRef\.current\) return/,
  'late catalog hydration must not overwrite controls changed by the user',
)
assert.match(
  diagramSource,
  /selectionMode === 'manual' && subtype === 'CUSTOM'[\s\S]*CUSTOM_DIAGRAM_PROMPT_MAX_LENGTH/,
)
assert.match(
  diagramSource,
  /controlsSubtype !== 'CODE_DISPLAY'[\s\S]*<ThemeSourceSelector/,
  'Code Display uses its named code theme and must not expose deck-theme ownership',
)
assert.match(
  diagramSource,
  /language_selection: languageSelectionMode === 'auto'\s*\?\s*\{ mode: 'auto' \}/,
  'Auto language selection must not echo resolved_language into the strict selection object',
)
assert.match(
  diagramSource,
  /subtype === 'CUSTOM'[\s\S]*elementPromptLengthState\([\s\S]*CUSTOM_DIAGRAM_PROMPT_MAX_LENGTH/,
)

const generationInputSource = fs.readFileSync(
  new URL('../components/generation-panel/shared/generation-input.tsx', import.meta.url),
  'utf8',
)
assert.match(generationInputSource, /promptLengthState\.length\.toLocaleString\(\)/)
assert.match(generationInputSource, /disabled=\{submitDisabled\}/)
assert.match(generationInputSource, /aria-invalid=\{promptOverLimit\}/)
assert.doesNotMatch(
  generationInputSource,
  /<textarea[\s\S]*?\smaxLength=/,
  'CUSTOM prompts must be validated visibly, never silently truncated',
)

const typeSource = fs.readFileSync(new URL('../types/textlabs.ts', import.meta.url), 'utf8')
assert.match(typeSource, /DIAGRAM:.*description: '9 diagram types'/)

const generationHookSource = fs.readFileSync(
  new URL('../hooks/use-textlabs-generation.ts', import.meta.url),
  'utf8',
)
assert.match(generationHookSource, /resolveElementGenerationTimeoutMs\(/)
assert.match(generationHookSource, /crypto\.randomUUID\(\)/)
assert.doesNotMatch(generationHookSource, /isRetryableTextLabsRequestError\(/)
assert.match(generationHookSource, /Do not replay \/api\/chat\/message automatically/)
assert.match(
  generationHookSource,
  /resumePanelForElement\(/,
  'a failed request must preserve the in-flight subtype and controls',
)
assert.match(
  generationHookSource,
  /formData\.componentType === 'CUSTOM'[\s\S]*elementPromptLengthState\([\s\S]*CUSTOM_DIAGRAM_PROMPT_MAX_LENGTH/,
)
assert.match(
  generationHookSource,
  /resolveRefineGenerationConfig\(\s*params\.generationConfig,\s*formData\.generationConfig,\s*\)/,
  'the immediate refine context must prefer the normalized Text Labs response config',
)

console.log('diagram UAT fidelity regression tests passed')
