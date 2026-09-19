const fs = require('node:fs')
const assert = require('node:assert/strict')
const Module = require('node:module')
const ts = require('typescript')
const crypto = require('node:crypto')
const { httpAllowed } = require('./composer-stage-network.cjs')
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const atoms = new Module('composer-atoms'); atoms._compile(compile('lib/composer-atoms.ts'), 'composer-atoms.js')
for (const [method, url, allowed] of [
  ['POST', 'http://127.0.0.1:8525/v1.2/atomic/METRICS/custom', true],
  ['GET', 'http://localhost:8526/api/presentations/clone-1', true],
  ['POST', 'http://localhost:8526/api/presentations/clone-1/slides/0/textboxes/old/recreate', true],
  ['GET', 'http://localhost:3018/api/auth/session', true],
  ['POST', 'http://localhost:8520/v1.2/atomic/METRICS/custom', false],
  ['POST', 'http://localhost:8525/v1.2/atomic/METRICS', false],
  ['GET', 'http://localhost:8525/health', false],
  ['POST', 'http://localhost:8526/api/presentations', false],
  ['DELETE', 'http://localhost:8526/api/presentations/clone-1', false],
  ['POST', 'https://example.invalid/v1.2/atomic/METRICS/custom', false],
]) assert.equal(httpAllowed(new URL(url), method), allowed, `${method} ${url}`)
assert.throws(() => require('node:net').connect(443, 'example.invalid'), /COMPOSER_STAGE/)
const slot = { id: 'delta', label: 'Metric delta', role: 'delta', path: '/content/delta' }
const request = { schema_version: 'composer-html-container-v1', render_mode: 'precise', component_type: 'METRICS', variant_id: 'custom',
  content: { delta: '+$74.2M' }, editable_slots: [slot], box: { width: 586, height: 706 },
  template: { id: 'stage1-card', html: '<div><span>{{slot:delta}}</span></div>', slots: [slot], box: { width: 586, height: 706 }, capacity: { count: 1 }, provenance: { page: 17 } },
  theme: { fonts: { body: { family: 'Carlito', weight: 400, size_px: 20 } }, colors: { 'semantic.positive': '#3F7A52', 'semantic.negative': '#A5493F', 'semantic.neutral': '#838CA3' } },
  context: { stage_model: { color_bindings: { metric_delta: { slot_id: 'delta', positive: 'semantic.positive', neutral: 'semantic.neutral', negative: 'semantic.negative' } },
    shadows: { card: { x_px: 0, y_px: 4, blur_px: 14, spread_px: 0, opacity: .16, color_role: 'shadow' } },
    font_faces: [{ family: 'Carlito', weight: 400, style: 'normal', data_base64: 'A'.repeat(2_200_000), sha256: 'f'.repeat(64) }] } } }
// This is a frontend pass-through fixture. The actual Text owner separately
// validates decoded sfnt bytes; this test verifies no browser/server truncation.
const element = { id: 'old', component_type: 'METRICS', frame_owner: 'layout', style_owner: 'text_service', content: '<div>Old</div>',
  position: { grid_row: '4/16', grid_column: '2/12' },
  element_metadata: { schema_version: 'deckster-element-source-v1', owning_family: 'METRICS', variant_id: 'custom', variant_registry_version: 'composer-taxonomy-v1', render_mode: 'precise', regeneration_mode: 'deterministic_rerender',
    source: { carrier: 'render_spec', request_pointer: '/generation/request', params_schema: request.schema_version, request_sha256: 'a'.repeat(64) } },
  render_spec: { schema_version: request.schema_version, frame: { inset_px: 7, client_width_px: 586, client_height_px: 706 }, generation: { request, request_sha256: 'a'.repeat(64) } } }
const source = atoms.exports.hydrateComposerSource(element)
const changed = atoms.exports.applyComposerEdits(source, { delta: '−$74.2M' }, 'custom')
assert.deepEqual(changed.context, request.context)
assert.deepEqual(changed.template, request.template)
assert.deepEqual(changed.theme, request.theme)
assert.equal(request.content.delta, '+$74.2M')
assert.throws(() => atoms.exports.applyComposerEdits(source, { '/context/stage_model': 'replace' }, 'custom'))
process.env.NEXT_PUBLIC_COMPOSER_DIRECT_REGENERATE = 'true'
process.env.NODE_ENV = 'test'
process.env.COMPOSER_LOCAL_ROUND = 'stage1'
process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL = 'http://127.0.0.1:8526'
process.env.COMPOSER_CUSTOM_TEXT_URL = 'http://127.0.0.1:8525'
const route = new Module('stage-regenerate')
route.require = id => id === 'next/server' ? { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } }
  : id === 'next-auth' ? { getServerSession: async () => ({ user: { id: 'stage-local' } }) }
    : id === '@/lib/auth-options' ? { authOptions: {} } : id === '@/lib/composer-atoms' ? atoms.exports : require(id)
route._compile(compile('app/api/composer/regenerate/route.ts'), 'stage-regenerate.js')
let replacement, ownerCalls = 0
global.fetch = async (url, options) => {
  assert.equal(options.redirect, 'error')
  if (url === 'http://127.0.0.1:8525/v1.2/atomic/METRICS/custom') {
    ownerCalls++
    const actual = JSON.parse(options.body)
    assert.deepEqual(actual, changed)
    const html = '<style data-composer-stage-fonts="true">trusted generated faces</style><div>−$74.2M</div>'
    const hash = crypto.createHash('sha256').update(html).digest('hex')
    return { ok: true, json: async () => ({ success: true, schema_version: request.schema_version, render_mode: 'precise', component_type: 'METRICS', variant_id: 'custom', variant_registry_version: request.schema_version,
      render_request: actual, editable_slots: [slot], request_sha256: 'b'.repeat(64), html_sha256: hash, content_sha256: hash, html, frame: element.render_spec.frame, renderer_version: 'stage-test' }) }
  }
  if (url === 'http://127.0.0.1:8526/api/presentations/clone-1/slides/0/textboxes/old/recreate') {
    replacement = JSON.parse(options.body).replacement
    return { ok: true, json: async () => ({ id: 'new', replaced_element_id: 'old' }) }
  }
  assert.equal(url, 'http://127.0.0.1:8526/api/presentations/clone-1')
  return { ok: true, json: async () => ({ slides: [{ text_boxes: [replacement ? { ...replacement, id: 'new' } : element] }] }) }
}
route.exports.POST({ nextUrl: new URL('http://localhost:3018/api/composer/regenerate'), headers: new Headers({ origin: 'http://localhost:3018' }),
  json: async () => ({ presentationId: 'clone-1', slideIndex: 0, collection: 'textboxes', elementId: 'old', expectedSourceSha256: 'a'.repeat(64), variant: 'custom', edits: { delta: '−$74.2M' } }) })
  .then(result => {
    assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(ownerCalls, 1)
    assert.deepEqual(result.body.element.render_spec.generation.request.context, request.context)
    assert.equal(result.body.element.render_spec.generation.request.content.delta, '−$74.2M')
    console.log('PASS: Stage exact local routes, network denial, >2MB immutable context/font pass-through, semantic delta edit dispatch to8525 and verified replacement on8526; all fetches mocked.')
  }).catch(error => { console.error(error); process.exitCode = 1 })
