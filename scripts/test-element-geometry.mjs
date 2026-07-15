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
  })
  return mod.exports
}

const { parseElementGenerationMetadata, parseGetElementGeometryResponse } = loadTypeScriptModule(
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

console.log('element geometry parser tests passed')
