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
  })
  return mod.exports
}

const {
  ElementGenerationPreflightError,
  parseElementGenerationMetadata,
  parseGetElementGeometryResponse,
  readElementGenerationSnapshot,
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
  }))),
  {
    componentType: 'METRICS',
    themeVariantId: 'metric-accent-2',
    themeBindings: { background: 'accent_2' },
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
  let geometryAttempts = 0
  const snapshot = await readElementGenerationSnapshot({
    elementId: 'placeholder-retry',
    componentType: 'TEXT_BOX',
    useDeckTheme: true,
    requiresThemeVariant: true,
    retries: 1,
    retryDelayMs: 0,
    sendCommand: async (action) => {
      calls.push(action)
      if (action === 'getElementGeometry') {
        geometryAttempts += 1
        if (geometryAttempts === 1) throw new Error('Command timeout')
        return {
          success: true,
          action,
          elementId: 'placeholder-retry',
          position: { gridRow: '4/14', gridColumn: '4.4/26.2' },
          component_type: 'TEXT_BOX',
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
  })
  assert.deepEqual(calls, ['getElementGeometry', 'getElementGeometry', 'refreshElementThemeMetadata'])
}

{
  let caught = null
  try {
    await readElementGenerationSnapshot({
      elementId: 'placeholder-theme-failure',
      componentType: 'TEXT_BOX',
      useDeckTheme: true,
      requiresThemeVariant: true,
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

console.log('element geometry parser tests passed')
