import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function compile(file, requireImplementation = () => ({})) {
  const source = fs.readFileSync(file, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module: mod,
    exports: mod.exports,
    process: { env: {} },
    require: requireImplementation,
  })
  return mod.exports
}

const researchPolicy = compile(new URL('../lib/element-research-policy.ts', import.meta.url))
assert.equal(researchPolicy.isNonResearchVisualElement('IMAGE'), true)
assert.equal(researchPolicy.isNonResearchVisualElement('ICON_LABEL'), true)
assert.equal(researchPolicy.isNonResearchVisualElement('SHAPE'), true)
assert.equal(researchPolicy.isNonResearchVisualElement('INFOGRAPHIC'), true)
assert.equal(researchPolicy.isNonResearchVisualElement('TEXT_BOX', 'accessory', 'LOGO'), true)
assert.equal(researchPolicy.isNonResearchVisualElement('TEXT_BOX', 'body', null), false)

const blankPolicy = compile(new URL('../lib/element-blank-policy.ts', import.meta.url))
assert.equal(
  blankPolicy.shouldOpenAsBlankPlaceholder({
    elementId: 'icon-1',
    componentType: 'ICON_LABEL',
    isBlank: true,
    content: '<svg viewBox="0 0 24 24"><path d="M0 0h4v4z"/></svg>',
  }),
  false,
  'an SVG with no textContent is not a placeholder',
)

const replacementPolicy = compile(new URL('../lib/blank-element-replacement.ts', import.meta.url))
const insertedRefineContext = {
  elementId: 'shape-generated-1',
  elementType: 'SHAPE',
  slideIndex: 0,
}
const replacementState = replacementPolicy.resolveBlankReplacementPanelState(
  {
    isOpen: false,
    blankElementId: null,
    editElementId: null,
    mode: 'generate',
  },
  'shape-placeholder-1',
  insertedRefineContext,
)
assert.equal(replacementState.blankElementId, null, 'successful replacement clears the deleted placeholder ID')
assert.equal(replacementState.mode, 'refine')
assert.equal(replacementState.editElementId, 'shape-generated-1')
assert.equal(replacementState.refineContext.elementId, 'shape-generated-1')
assert.equal(
  replacementPolicy.resolveBlankReplacementPanelState(
    {
      isOpen: true,
      blankElementId: 'different-placeholder',
      editElementId: null,
      mode: 'generate',
    },
    'shape-placeholder-1',
    insertedRefineContext,
  ),
  null,
  'a different panel opened during generation is not overwritten',
)
assert.equal(
  blankPolicy.shouldOpenAsBlankPlaceholder({
    elementId: 'shape-1',
    componentType: 'SHAPE',
    isBlank: true,
    content: '<div><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50"/></svg></div>',
  }),
  false,
  'a completed shape cannot be classified by empty textContent',
)
assert.equal(
  blankPolicy.shouldOpenAsBlankPlaceholder({
    elementId: 'blank-1',
    isBlank: true,
    content: '<div data-blank-element="blank-1">Click to configure</div>',
  }),
  true,
  'the explicit placeholder marker survives frontend tracking loss',
)
assert.equal(
  blankPolicy.shouldOpenAsBlankPlaceholder({ elementId: 'blank-2', isBlank: false }, 'IMAGE'),
  true,
  'live frontend placeholder tracking is authoritative',
)

const client = compile(new URL('../lib/textlabs-client.ts', import.meta.url), id => {
  if (id === '@/types/textlabs') return {
    INSERTION_METHOD_MAP: {
      TEXT_BOX: 'insertElement',
      IMAGE: 'insertImage',
      ICON_LABEL: 'insertElement',
      SHAPE: 'insertElement',
    },
    TEXT_LABS_ELEMENT_DEFAULTS: {
      TEXT_BOX: { width: 10, height: 6, zIndex: 1000 },
      IMAGE: { width: 12, height: 7, zIndex: 1000 },
      ICON_LABEL: { width: 2, height: 2, zIndex: 1000 },
      SHAPE: { width: 3, height: 3, zIndex: 1000 },
    },
  }
  if (id === '@/lib/element-semantic-type') return { semanticTypeForInsertion: value => value }
  if (id === '@/lib/textlabs-theme-metadata') {
    return { resolveElementThemeMetadata: () => ({ themeVariantId: null, themeBindings: null }) }
  }
  if (id === '@/lib/element-provenance') {
    return { parseThemeVariantSource: () => null, responseStyleOwner: () => null }
  }
  if (id === '@/lib/element-research-policy') return researchPolicy
  throw new Error(`Unexpected dependency: ${id}`)
})

const research = {
  mode: 'on',
  web: true,
  uploaded_docs: true,
  use_knowledge_graph: true,
}
const common = {
  prompt: 'Generate the visual',
  count: 1,
  layout: 'horizontal',
  advancedModified: false,
  z_index: 1000,
  research,
}
const liveImageGeometry = {
  placeholder_mode: false,
  start_col: 4,
  start_row: 5,
  width: 11,
  height: 6,
  grid_row: '5/11',
  grid_column: '4/15',
}
const imageAuto = client.buildApiPayload('session', {
  ...common,
  componentType: 'IMAGE',
  imageConfig: liveImageGeometry,
}).options
assert.equal(imageAuto.research, undefined)
assert.deepEqual(JSON.parse(JSON.stringify(imageAuto.imageConfig)), liveImageGeometry)
assert.equal(imageAuto.imageConfig.style, undefined)
assert.equal(imageAuto.imageConfig.quality, undefined)
assert.equal(imageAuto.imageConfig.aspect_ratio, undefined)
assert.ok(!Object.values(imageAuto.imageConfig).includes('auto'), 'strict enums never receive literal auto')

const imageManualStyle = client.buildApiPayload('session', {
  ...common,
  componentType: 'IMAGE',
  advancedModified: true,
  imageConfig: { ...liveImageGeometry, style: 'illustration' },
}).options
assert.equal(imageManualStyle.imageConfig.style, 'illustration')
assert.equal(imageManualStyle.imageConfig.quality, undefined, 'manual style does not force unrelated overrides')

const iconAuto = client.buildApiPayload('session', {
  ...common,
  componentType: 'ICON_LABEL',
  iconLabelConfig: { mode: 'icon' },
}).options
assert.equal(iconAuto.research, undefined)
assert.deepEqual(JSON.parse(JSON.stringify(iconAuto.iconLabelConfig)), { mode: 'icon' })

const iconManualStyle = client.buildApiPayload('session', {
  ...common,
  componentType: 'ICON_LABEL',
  advancedModified: true,
  iconLabelConfig: { mode: 'icon', style: 'circle-outline' },
}).options
assert.equal(iconManualStyle.iconLabelConfig.style, 'circle-outline')

const shapeAuto = client.buildApiPayload('session', {
  ...common,
  componentType: 'SHAPE',
  shapeConfig: {
    shape_type: null,
    prompt: 'three concentric circles',
    x: 180,
    y: 240,
    width_px: 720,
    height_px: 420,
    start_col: 4,
    start_row: 5,
    position_width: 12,
    position_height: 7,
  },
}).options
assert.equal(shapeAuto.research, undefined)
assert.equal(shapeAuto.shapeConfig.prompt, 'three concentric circles')
assert.equal(shapeAuto.shapeConfig.fill_color, undefined)

const shapeManualColors = client.buildApiPayload('session', {
  ...common,
  componentType: 'SHAPE',
  advancedModified: true,
  shapeConfig: {
    ...shapeAuto.shapeConfig,
    fill_color: '#3B82F6',
    stroke_color: '#334155',
  },
}).options
assert.equal(shapeManualColors.shapeConfig.fill_color, '#3B82F6')
assert.equal(shapeManualColors.shapeConfig.stroke_color, '#334155')

const logo = client.buildApiPayload('session', {
  ...common,
  componentType: 'IMAGE',
  slotName: 'hero_logo',
  slotKind: 'accessory',
  accessoryType: 'LOGO',
  imageConfig: { placeholder_mode: false },
}).options
assert.equal(logo.research, undefined)
assert.equal(logo.slotName, 'hero_logo')
assert.equal(logo.slotKind, 'accessory')
assert.equal(logo.accessoryType, 'LOGO')

const semanticLogo = client.buildSemanticUpsertParams({
  elementId: 'logo-new',
  imageUrl: 'https://example.test/logo.png',
  componentType: 'IMAGE',
  slotName: 'hero_logo',
  slotKind: 'accessory',
  accessoryType: 'LOGO',
  zIndex: 137,
  themeVariantSource: 'element_generation',
}, 0, 'logo-old')
assert.equal(semanticLogo.zIndex, 137, 'semantic Logo replacement preserves live stacking order')
assert.equal(semanticLogo.metadata.themeVariantSource, 'element_generation')

const panelSource = fs.readFileSync(new URL('../components/generation-panel/index.tsx', import.meta.url), 'utf8')
const inputSource = fs.readFileSync(new URL('../components/generation-panel/shared/generation-input.tsx', import.meta.url), 'utf8')
const imageFormSource = fs.readFileSync(new URL('../components/generation-panel/forms/image-form.tsx', import.meta.url), 'utf8')
const iconFormSource = fs.readFileSync(new URL('../components/generation-panel/forms/icon-label-form.tsx', import.meta.url), 'utf8')
const shapeFormSource = fs.readFileSync(new URL('../components/generation-panel/forms/shape-form.tsx', import.meta.url), 'utf8')
const textFormSource = fs.readFileSync(new URL('../components/generation-panel/forms/text-box-form.tsx', import.meta.url), 'utf8')
const generationSource = fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8')
assert.match(panelSource, /const supportsResearch = !isNonResearchVisualElement\(elementType\)/)
assert.match(
  panelSource,
  /mandatoryConfigState\.key === panelTargetKey[\s\S]{0,100}\? mandatoryConfigState\.config/,
  'prompt controls are scoped to the active panel target',
)
assert.doesNotMatch(
  panelSource,
  /mandatoryConfigRef\.current = null/,
  'panel hydration cannot erase a form control after the form registers it',
)
assert.match(
  panelSource,
  /registration\?\.key === panelTargetKey\) registration\.submit\(\)/,
  'the submit callback is scoped to the active panel target',
)
assert.doesNotMatch(
  panelSource,
  /submitFnRef\.current = null/,
  'panel hydration cannot erase the active form submit callback',
)
assert.match(inputSource, /Array\.isArray\(mandatoryConfig\)/, 'the prompt toolbar supports multiple primary controls')
assert.match(inputSource, /selectedOption\?\.color/, 'palette choices expose their swatches in the prompt toolbar')
assert.match(imageFormSource, /fieldLabel: 'Image style'/)
assert.match(imageFormSource, /group: 'Automatic'[\s\S]{0,100}value: 'auto'/)
for (const [value, label] of [
  ['realistic', 'Realistic'],
  ['photo', 'Corporate Photo'],
  ['illustration', 'Digital Illustration'],
  ['brand_graphic', 'Brand Graphic'],
  ['flat_vector', 'Flat Vector'],
  ['isometric', 'Isometric'],
  ['minimal', 'Minimalist'],
  ['abstract', 'Abstract'],
]) {
  assert.match(
    imageFormSource,
    new RegExp(`value: '${value}', label: '${label}'`),
    `the prompt-level image style selector retains ${label}`,
  )
}
for (const section of ['Style', 'Position & Size', 'Container Padding']) {
  assert.match(
    imageFormSource,
    new RegExp(`CollapsibleSection title="${section.replace(/[&]/g, '\\&')}"`),
    `the Image Advanced panel retains the ${section} section`,
  )
}
for (const control of [
  'ThemeSourceSelector',
  'Image Style',
  'Quality',
  'Corners',
  'Border',
  'Aspect Ratio',
  'Positioning',
  'Position Presets',
  'Col',
  'Row',
  'Width',
  'Height',
  'ZIndexInput',
  'PaddingControl',
]) {
  assert.match(imageFormSource, new RegExp(control), `the Image Advanced panel retains ${control}`)
}
for (const quality of ['draft', 'standard', 'high', 'ultra']) {
  assert.match(imageFormSource, new RegExp(`<option value="${quality}">`), `Image quality retains ${quality}`)
}
assert.match(iconFormSource, /registerMandatoryConfig\(configs\)/)
assert.match(iconFormSource, /fieldLabel: 'Style'[\s\S]{0,220}value: 'auto'/)
assert.match(shapeFormSource, /colorConfig\('fill', 'Fill'/)
assert.match(shapeFormSource, /colorConfig\('stroke', 'Border'/)
assert.match(shapeFormSource, /selectedValue: explicitFields\.has\(field\) \? color : 'theme'/)
assert.match(textFormSource, /\{\(isBodyText \|\| isSystemManaged\) && researchControls\}/)
assert.match(generationSource, /if \(researchPolicy\) formData\.research = researchPolicy/)
assert.match(generationSource, /else delete formData\.research/)
assert.match(generationSource, /generationPanel\.completeBlankReplacement\([\s\S]{0,180}currentBlankId/)
assert.match(generationSource, /setElementGenerationState/)
assert.match(generationSource, /fd\.imageConfig\.grid_row =/)
assert.match(generationSource, /Object\.prototype\.hasOwnProperty\.call\(fd\.imageConfig, 'aspect_ratio'\)/)
assert.ok(
  (generationSource.match(/snapshot\.zIndex !== null\) formData\.z_index = snapshot\.zIndex/g) || []).length >= 2,
  'blank and refine preflight both preserve Layout-owned z-order',
)

console.log('visual element generation contract tests passed')
