import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function loadTypeScriptModule(modulePath) {
  const source = fs.readFileSync(modulePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  })

  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module: mod,
    exports: mod.exports,
    setTimeout,
    require: id => {
      if (id === '@/lib/element-provenance') {
        return loadTypeScriptModule(new URL('../lib/element-provenance.ts', import.meta.url))
      }
      throw new Error(`Unexpected test import: ${id}`)
    },
  })
  return mod.exports
}

const {
  ElementGenerationPreflightError,
  parseElementGenerationMetadata,
  parseGetElementGeometryResponse,
  readElementGenerationSnapshot,
  remapElementGridPositions,
} = loadTypeScriptModule(
  new URL('../lib/element-geometry.ts', import.meta.url),
)
const { getCommandType } = loadTypeScriptModule(
  new URL('../lib/element-command-router.ts', import.meta.url),
)

assert.equal(getCommandType('getElementGeometry'), 'layout-service')
assert.equal(getCommandType('setElementGenerationState'), 'layout-service')

assert.deepEqual(
  JSON.parse(JSON.stringify(parseElementGenerationMetadata({
    componentType: 'METRICS',
    theme_variant_id: 'metric-accent-2',
    themeBindings: { background: 'accent_2', ignored: 42 },
    style_owner: 'text_service',
    theme_variant_source: 'full_deck_generation',
    metrics_color_variant: '#547ea9',
    z_index: 137,
  }))),
  {
    componentType: 'METRICS',
    themeVariantId: 'metric-accent-2',
    themeBindings: { background: 'accent_2' },
    styleOwner: 'text_service',
    themeVariantSource: 'full_deck_generation',
    metricsColorVariant: '#547ea9',
    zIndex: 137,
  },
)

const geometry = parseGetElementGeometryResponse({
  success: true,
  action: 'getElementGeometry',
  requestId: 'geometry-request',
  elementId: 'placeholder-1',
  position: {
    gridRow: '5.2/16.8',
    gridColumn: '3.2/30.8',
  },
}, 'placeholder-1')

assert.deepEqual(
  JSON.parse(JSON.stringify(geometry)),
  {
    startCol: 3.2,
    startRow: 5.2,
    width: 27.6,
    height: 11.6,
  },
)

assert.deepEqual(
  JSON.parse(JSON.stringify(parseGetElementGeometryResponse({
    success: true,
    action: 'getElementGeometry',
    elementId: 'placeholder-2',
    position: { gridRow: '4 / 12', gridColumn: '2 / 18' },
  }, 'placeholder-2'))),
  { startCol: 2, startRow: 4, width: 16, height: 8 },
)

assert.throws(
  () => parseGetElementGeometryResponse({
    success: true,
    action: 'getElementGeometry',
    elementId: 'other-placeholder',
    position: { gridRow: '4/12', gridColumn: '2/18' },
  }, 'placeholder-1'),
  /different element ID/,
)

assert.throws(
  () => parseGetElementGeometryResponse({
    success: true,
    action: 'getElementGeometry',
    elementId: 'placeholder-1',
    data: { position: { gridRow: '4/12', gridColumn: '2/18' } },
  }, 'placeholder-1'),
  /missing position/,
  'the bridge contract is top-level position, not data.position',
)

assert.throws(
  () => parseGetElementGeometryResponse({
    success: true,
    action: 'getElementGeometry',
    elementId: 'placeholder-1',
    position: { gridRow: '22/80', gridColumn: '12/150' },
  }, 'placeholder-1'),
  /outside the logical grid/,
  'physical 160x90 grid coordinates must not be accepted as logical geometry',
)

assert.throws(
  () => parseGetElementGeometryResponse({
    success: true,
    action: 'getElementGeometry',
    elementId: 'placeholder-1',
    position: { gridRow: '5.1/12', gridColumn: '2/18' },
  }, 'placeholder-1'),
  /0\.2 logical-grid increments/,
)

assert.throws(
  () => parseGetElementGeometryResponse({
    success: true,
    action: 'getElementGeometry',
    elementId: 'placeholder-1',
    position: { gridRow: '12/12', gridColumn: '2/18' },
  }, 'placeholder-1'),
  /non-positive span/,
)

assert.throws(
  () => parseGetElementGeometryResponse({
    success: false,
    action: 'getElementGeometry',
    elementId: 'placeholder-1',
    error: 'Element not found',
  }, 'placeholder-1'),
  /Invalid getElementGeometry response/,
)

{
  const calls = []
  const snapshot = await readElementGenerationSnapshot({
    elementId: 'diagram-placeholder',
    componentType: 'DIAGRAM',
    useDeckTheme: true,
    requiresThemeVariant: false,
    themeVariantSource: 'element_generation',
    sendCommand: async (action) => {
      calls.push(action)
      assert.equal(action, 'getElementGeometry')
      return {
        success: true,
        action,
        elementId: 'diagram-placeholder',
        position: { gridRow: '4/14', gridColumn: '2/30' },
        component_type: 'DIAGRAM',
        theme_bindings: {},
      }
    },
  })
  assert.deepEqual(calls, ['getElementGeometry'], 'leaf generation keeps geometry preflight but skips Layout theme refresh')
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot.themeBindings)), {})
}

{
  const calls = []
  let geometryAttempts = 0
  const snapshot = await readElementGenerationSnapshot({
    elementId: 'placeholder-retry',
    componentType: 'TEXT_BOX',
    useDeckTheme: true,
    requiresThemeVariant: true,
    themeVariantSource: 'element_generation',
    retries: 1,
    retryDelayMs: 0,
    sendCommand: async (action, params) => {
      calls.push({ action, params })
      if (action === 'getElementGeometry') {
        geometryAttempts += 1
        if (geometryAttempts === 1) throw new Error('Command timeout')
        return {
          success: true,
          action,
          elementId: 'placeholder-retry',
          position: { gridRow: '4/14', gridColumn: '4.4/26.2' },
          component_type: 'TEXT_BOX',
          z_index: 222,
        }
      }
      return {
        success: true,
        action,
        elementId: 'placeholder-retry',
        component_type: 'TEXT_BOX',
        theme_variant_id: 'textbox-accent-1',
        theme_bindings: { background: 'background' },
      }
    },
  })

  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), {
    startCol: 4.4,
    startRow: 4,
    width: 21.8,
    height: 10,
    componentType: 'TEXT_BOX',
    themeVariantId: 'textbox-accent-1',
    themeBindings: { background: 'background' },
    styleOwner: null,
    themeVariantSource: null,
    metricsColorVariant: null,
    zIndex: 222,
  })
  assert.deepEqual(calls.map(call => call.action), ['getElementGeometry', 'getElementGeometry', 'refreshElementThemeMetadata'])
  assert.equal(calls.at(-1).params.themeVariantSource, 'element_generation')
}

{
  const calls = []
  const snapshot = await readElementGenerationSnapshot({
    elementId: 'slide-builder-element',
    componentType: 'TEXT_BOX',
    useDeckTheme: true,
    requiresThemeVariant: true,
    themeVariantSource: 'full_deck_generation',
    sendCommand: async (action) => {
      calls.push(action)
      return {
        success: true,
        action,
        elementId: 'slide-builder-element',
        position: { gridRow: '4/14', gridColumn: '4/20' },
        component_type: 'TEXT_BOX',
        style_owner: 'text_service',
        theme_variant_source: 'full_deck_generation',
        z_index: 88,
      }
    },
  })
  assert.deepEqual(calls, ['getElementGeometry'])
  assert.equal(snapshot.themeVariantId, null)
  assert.equal(snapshot.styleOwner, 'text_service')
  assert.equal(snapshot.themeVariantSource, 'full_deck_generation')
  assert.equal(snapshot.zIndex, 88)
}

{
  let caught = null
  try {
    await readElementGenerationSnapshot({
      elementId: 'placeholder-theme-failure',
      componentType: 'TEXT_BOX',
      useDeckTheme: true,
      requiresThemeVariant: true,
      themeVariantSource: 'element_generation',
      retries: 0,
      retryDelayMs: 0,
      sendCommand: async (action) => {
        if (action === 'getElementGeometry') {
          return {
            success: true,
            action,
            elementId: 'placeholder-theme-failure',
            position: { gridRow: '4/14', gridColumn: '4/20' },
          }
        }
        throw new Error('Current presentation theme contract is unavailable')
      },
    })
  } catch (error) {
    caught = error
  }
  assert.ok(caught instanceof ElementGenerationPreflightError)
  assert.equal(caught.stage, 'theme_metadata')
}

{
  const remapped = remapElementGridPositions([
    { id: 'one', grid_position: { start_col: 2, start_row: 4, position_width: 9, position_height: 8 } },
    { id: 'two', grid_position: { start_col: 11, start_row: 4, position_width: 9, position_height: 8 } },
    { id: 'three', grid_position: { start_col: 20, start_row: 4, position_width: 9, position_height: 8 } },
  ], {
    start_col: 2,
    start_row: 4,
    position_width: 27,
    position_height: 8,
  }, {
    start_col: 4.4,
    start_row: 4,
    position_width: 21.8,
    position_height: 10,
  })

  assert.equal(remapped.length, 3)
  assert.equal(remapped[0].grid_position.start_col, 4.4)
  assert.equal(remapped[0].grid_position.start_row, 4)
  assert.equal(remapped[0].grid_position.position_height, 10)
  assert.equal(
    remapped[2].grid_position.start_col + remapped[2].grid_position.position_width,
    26.2,
  )
  assert.equal(
    Number((remapped[0].grid_position.start_col + remapped[0].grid_position.position_width).toFixed(1)),
    Number(remapped[1].grid_position.start_col.toFixed(1)),
  )
  assert.equal(
    Number((remapped[1].grid_position.start_col + remapped[1].grid_position.position_width).toFixed(1)),
    Number(remapped[2].grid_position.start_col.toFixed(1)),
  )
}

console.log('element geometry parser tests passed')
