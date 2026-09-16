const fs = require('node:fs')
const assert = require('node:assert/strict')
const Module = require('node:module')
const ts = require('typescript')
const compiled = ts.transpileModule(fs.readFileSync('lib/composer-atoms.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const loaded = new Module('composer-atoms'); loaded._compile(compiled, 'composer-atoms.js')
const { hydrateComposerSource, applyComposerEdits, validateComposerMetadata, pointerParts, buildComposerReplacement, verifyComposerReadback, composerEditableVariants } = loaded.exports
const request = { schema_version: 'composer-text-atom-v2', render_mode: 'precise', component_type: 'TEXT_BOX', variant_id: 'scenario_card',
  scene: { node: { params: { paragraphs: [{ runs: [{ text: 'Measured card' }] }] } }, geometry: { x: 10.5 } },
  editable_slots: [{ id: 'title', label: 'Heading', role: 'heading', path: '/scene/node/params/paragraphs/0/runs/0/text' }] }
const element = { id: 'old', component_type: 'TEXT_BOX', style_owner: 'text_service', frame_owner: 'layout', content: '<div>Measured card</div>',
  position: { grid_row: '1/3', grid_column: '1/9' }, style: { padding: 0 }, z_index: 5, locked: true, visible: true,
  render_spec: { schema_version: 'composer-text-atom-v2', frame: { inset_px: 7, client_width_px: 466, client_height_px: 106 }, generation: { request, request_sha256: 'a'.repeat(64) } },
  element_metadata: { schema_version: 'deckster-element-source-v1', owning_family: 'TEXT_BOX', variant_id: 'scenario_card', variant_registry_version: 'composer-taxonomy-v1', render_mode: 'precise', regeneration_mode: 'deterministic_rerender', source: { carrier: 'render_spec', request_pointer: '/generation/request', params_schema: 'composer-text-atom-v2', request_sha256: 'a'.repeat(64) } } }
const before = JSON.stringify(element), source = hydrateComposerSource(element)
const changed = applyComposerEdits(source, { title: 'Edited card' }, 'scenario_card')
assert.equal(changed.scene.node.params.paragraphs[0].runs[0].text, 'Edited card')
assert.deepEqual(changed.scene.geometry, request.scene.geometry)
assert.equal(JSON.stringify(element), before, 'Editing must not mutate accepted source')
assert.throws(() => applyComposerEdits(source, { '/scene/geometry/x': '8' }, 'scenario_card'))
assert.throws(() => applyComposerEdits(source, { title: 123 }, 'scenario_card'))
assert.throws(() => applyComposerEdits(source, {}, 'timeline.alternating_milestones'))
assert.throws(() => pointerParts('/__proto__/polluted'))
for (const key of ['schema_version', 'owning_family', 'variant_id', 'variant_registry_version', 'regeneration_mode']) {
  assert.throws(() => validateComposerMetadata({ ...element.element_metadata, [key]: 'unsupported' }))
}
const duplicate = structuredClone(element); duplicate.render_spec.generation.request.editable_slots.push(request.editable_slots[0])
assert.throws(() => hydrateComposerSource(duplicate))
const badPointer = structuredClone(element); badPointer.element_metadata.source.request_pointer = '/request'
assert.throws(() => hydrateComposerSource(badPointer))
assert.throws(() => hydrateComposerSource({ id: 'legacy', content: 'Old element' }))
const unsafeSlot = structuredClone(element); unsafeSlot.render_spec.generation.request.editable_slots[0].path = '/scene/source/text'; unsafeSlot.render_spec.generation.request.scene.source = { text: 'forged provenance' }
assert.throws(() => hydrateComposerSource(unsafeSlot))
const ownerMismatch = structuredClone(element); ownerMismatch.style_owner = 'illustrator'
assert.throws(() => hydrateComposerSource(ownerMismatch))

const hash = value => require('node:crypto').createHash('sha256').update(value).digest('hex')
function responseFor(renderRequest, frame) {
  const html = '<div>Edited card</div>'
  return { success: true, schema_version: renderRequest.schema_version, render_mode: 'precise', component_type: renderRequest.component_type,
    variant_id: renderRequest.variant_id, variant_registry_version: renderRequest.variant_id === 'custom' ? 'composer-html-container-v1' : 'composer-taxonomy-v1', render_request: structuredClone(renderRequest),
    editable_slots: structuredClone(renderRequest.editable_slots), request_sha256: 'b'.repeat(64), html_sha256: hash(html), content_sha256: hash(html), html, frame: structuredClone(frame), renderer_version: 'test-renderer' }
}
const rendered = responseFor(changed, element.render_spec.frame)
const replacement = buildComposerReplacement(source, changed, rendered)
for (const key of ['position', 'style', 'z_index', 'locked', 'visible']) assert.deepEqual(replacement[key], element[key])
assert.equal(replacement.id, undefined)
assert.equal(JSON.stringify(element), before)
for (const mutate of [r => { r.render_request.scene.geometry.x += 1 }, r => { r.render_request.scene.node.params.paragraphs[0].runs[0].text = 'Unrequested fact' }, r => { r.frame.client_width_px += 1 }, r => { r.editable_slots = [] }]) {
  const bad = structuredClone(rendered); mutate(bad)
  assert.throws(() => buildComposerReplacement(source, changed, bad))
}
const infographic = structuredClone(element)
infographic.component_type = 'INFOGRAPHIC'; infographic.style_owner = 'illustrator'; infographic.items = null; infographic.svg_content = null
infographic.element_metadata.owning_family = 'INFOGRAPHIC'; infographic.element_metadata.variant_id = 'process.connected_steps'
infographic.element_metadata.source = { ...infographic.element_metadata.source, carrier: 'generation_config', request_pointer: '/request', params_schema: 'composer-infographic-atom-v1' }
const infoRequest = structuredClone(request)
infoRequest.schema_version = 'composer-infographic-atom-v1'; infoRequest.component_type = 'INFOGRAPHIC'; infoRequest.variant_id = 'process.connected_steps'; infoRequest.scene.zone = { kind: 'process', units: [] }
infographic.generation_config = { schema_version: infoRequest.schema_version, request: infoRequest, request_sha256: 'a'.repeat(64), frame: element.render_spec.frame }
delete infographic.render_spec
const infoSource = hydrateComposerSource(infographic)
assert.equal(buildComposerReplacement(infoSource, infoRequest, responseFor(infoRequest, infographic.generation_config.frame)).items, null)
infographic.items = [{ legacy: 'preserve verbatim' }]
assert.deepEqual(buildComposerReplacement(hydrateComposerSource(infographic), infoRequest, responseFor(infoRequest, infographic.generation_config.frame)).items, infographic.items)

const priorSlide = { text_boxes: [element, { id: 'untouched', content: 'Keep' }], infographics: [] }
const nextSlide = { text_boxes: [{ ...replacement, id: 'new' }, priorSlide.text_boxes[1]], infographics: [] }
verifyComposerReadback(priorSlide, nextSlide, 'textboxes', 'old', 'new')
const extra = structuredClone(nextSlide); extra.text_boxes.push(element)
assert.throws(() => verifyComposerReadback(priorSlide, extra, 'textboxes', 'old', 'new'))
const changedOther = structuredClone(nextSlide); changedOther.text_boxes[1].content = 'Changed'
assert.throws(() => verifyComposerReadback(priorSlide, changedOther, 'textboxes', 'old', 'new'))

const customRequest = {
  schema_version: 'composer-html-container-v1', render_mode: 'precise', component_type: 'TEXT_BOX', variant_id: 'custom',
  content: { title: 'Measured container' }, editable_slots: [{ id: 'title', label: 'Container title', role: 'heading', path: '/content/title' }],
  box: { width: 466, height: 106 }, theme: { fonts: { heading: { family: 'Arial', weight: 600, size_px: 24 } }, colors: { ink: '#123456' } },
  template: { id: 'golden-container', html: '<div>{{slot:title}}</div>', slots: [{ id: 'title', label: 'Container title', role: 'heading', path: '/content/title' }], box: { width: 466, height: 106 }, capacity: { title: 80 }, provenance: { deck: 'gold', page: 2 } },
}
function customElement(family = 'TEXT_BOX') {
  const result = structuredClone(element), req = structuredClone(customRequest)
  req.component_type = family
  result.component_type = family
  result.element_metadata.owning_family = family
  result.element_metadata.variant_id = 'custom'
  result.element_metadata.source.params_schema = req.schema_version
  result.render_spec.schema_version = req.schema_version
  result.render_spec.generation.request = req
  if (family === 'INFOGRAPHIC') {
    req.editable_slots = []; req.content = {}; req.template.slots = []; req.template.html = '<div style="border-top:2px solid"></div>'
    result.style_owner = 'illustrator'; result.frame_owner = 'none'; result.infographic_type = 'custom'; result.items = null
    result.element_metadata.source.carrier = 'generation_config'; result.element_metadata.source.request_pointer = '/request'
    result.generation_config = { schema_version: req.schema_version, request: req, request_sha256: 'a'.repeat(64), frame: { ...result.render_spec.frame, inset_px: 0 } }
    delete result.render_spec
  }
  return result
}
const custom = customElement(), customSource = hydrateComposerSource(custom)
const changedCustom = applyComposerEdits(customSource, { title: 'Edited container' }, 'custom')
assert.equal(changedCustom.content.title, 'Edited container')
for (const key of ['template', 'theme', 'box', 'editable_slots']) assert.deepEqual(changedCustom[key], customRequest[key])
assert.equal(customSource.request.content.title, 'Measured container')
assert.deepEqual(composerEditableVariants(customSource.metadata), ['custom'])
assert.ok(!composerEditableVariants(source.metadata).includes('custom'))
assert.throws(() => applyComposerEdits(customSource, {}, 'card'))
assert.throws(() => applyComposerEdits(source, {}, 'custom'))
assert.throws(() => applyComposerEdits(customSource, { '/template/html': 'changed template' }, 'custom'))
for (const family of ['TEXT_BOX', 'METRICS', 'TABLE', 'INFOGRAPHIC']) {
  const saved = customElement(family), stored = hydrateComposerSource(saved)
  const carrier = saved[stored.metadata.source.carrier]
  const replaced = buildComposerReplacement(stored, stored.request, responseFor(stored.request, carrier.frame))
  assert.equal(replaced.element_metadata.source.params_schema, 'composer-html-container-v1')
  if (family === 'INFOGRAPHIC') { assert.equal(replaced.infographic_type, 'custom'); assert.deepEqual(stored.slots, []) }
}
const framedGraphic = customElement('INFOGRAPHIC'); framedGraphic.frame_owner = 'layout'
assert.throws(() => hydrateComposerSource(framedGraphic))
const framelessText = customElement(); framelessText.frame_owner = 'none'
assert.throws(() => hydrateComposerSource(framelessText))
for (const mutate of [
  req => { req.editable_slots[0].path = '/template/html' },
  req => { req.editable_slots[0].path = '/content/notTitle' },
  req => { req.template.slots[0].label = 'Forged declaration' },
  req => { req.content.undeclared = 'Uneditable fact' },
  req => { delete req.content.title },
  req => { req.editable_slots = []; req.template.slots = []; req.content = {} },
  req => { req.box.width++ },
  req => { req.editable_slots[0].id = 'constructor'; req.editable_slots[0].path = '/content/constructor'; req.content = { constructor: 'unsafe' }; req.template.slots = structuredClone(req.editable_slots) },
]) {
  const bad = customElement(); mutate(bad.render_spec.generation.request)
  assert.throws(() => hydrateComposerSource(bad))
}
const renderedCustom = responseFor(changedCustom, custom.render_spec.frame)
for (const mutate of [r => { r.render_request.template.html += '<div>forged</div>' }, r => { r.render_request.theme.colors.ink = '#ffffff' }, r => { r.frame.inset_px = 0 }, r => { r.variant_registry_version = 'composer-taxonomy-v1' }]) {
  const bad = structuredClone(renderedCustom); mutate(bad)
  assert.throws(() => buildComposerReplacement(customSource, changedCustom, bad))
}

async function apiCases() {
  process.env.NEXT_PUBLIC_COMPOSER_DIRECT_REGENERATE = 'true'; process.env.NODE_ENV = 'test'
  const route = new Module('composer-regenerate')
  route.require = id => id === 'next/server' ? { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } }
    : id === 'next-auth' ? { getServerSession: async () => ({ user: { id: 'synthetic-local-user' } }) }
      : id === '@/lib/auth-options' ? { authOptions: {} }
        : id === '@/lib/composer-atoms' ? loaded.exports : require(id)
  route._compile(ts.transpileModule(fs.readFileSync('app/api/composer/regenerate/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, 'composer-regenerate.js')
  for (const scenario of ['success', 'source-drift', 'bad-html-hash', 'timeout-after-dispatch', 'bad-readback', 'precondition']) {
    const calls = []; let committedPayload
    global.fetch = async (url, options) => {
      calls.push({ url, options }); assert.equal(options.redirect, 'error')
      if (url.includes('/v1.2/atomic/')) {
        const result = responseFor(JSON.parse(options.body), element.render_spec.frame)
        if (scenario === 'source-drift') result.render_request.scene.geometry.x++
        if (scenario === 'bad-html-hash') result.html = 'Different bytes'
        return { ok: true, json: async () => result }
      }
      if (url.endsWith('/recreate')) {
        if (scenario === 'timeout-after-dispatch') throw new Error('Synthetic lost response')
        committedPayload = JSON.parse(options.body).replacement
        return { ok: true, json: async () => ({ id: 'new', replaced_element_id: 'old' }) }
      }
      assert.match(url, /^http:\/\/(?:localhost|127\.0\.0\.1):8504\/api\/presentations\/test$/)
      const slide = committedPayload ? { text_boxes: [{ ...committedPayload, id: 'new' }, priorSlide.text_boxes[1]], infographics: [] } : priorSlide
      if (scenario === 'bad-readback' && committedPayload) slide.text_boxes[1] = { id: 'untouched', content: 'Corrupted' }
      return { ok: true, json: async () => ({ slides: [slide] }) }
    }
    const result = await route.exports.POST({ nextUrl: new URL('http://localhost:3000/api/composer/regenerate'), headers: new Headers({ origin: 'http://localhost:3000' }),
      json: async () => ({ presentationId: 'test', slideIndex: 0, collection: 'textboxes', elementId: 'old', expectedSourceSha256: (scenario === 'precondition' ? 'c' : 'a').repeat(64), variant: 'scenario_card', edits: { title: 'Edited card' } }) })
    if (scenario === 'success') { assert.equal(result.status, 200); assert.equal(result.body.element.id, 'new') }
    else if (scenario === 'timeout-after-dispatch') { assert.equal(result.body.replacementOutcome, 'unknown'); assert.equal(result.body.committed, null); assert.doesNotMatch(result.body.error, /original element is retained/) }
    else if (scenario === 'bad-readback') { assert.equal(result.body.replacementOutcome, 'committed'); assert.equal(result.body.committed, true) }
    else { assert.equal(result.body.replacementOutcome, 'not_sent'); assert.equal(calls.filter(c => c.url.endsWith('/recreate')).length, 0) }
  }
  process.env.COMPOSER_LOCAL_ROUND = 'r17'; process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL = 'http://127.0.0.1:8519'
  for (const family of ['TEXT_BOX', 'METRICS', 'TABLE', 'INFOGRAPHIC']) {
    const saved = customElement(family), graphic = family === 'INFOGRAPHIC', storage = graphic ? 'infographics' : 'text_boxes'
    const target = graphic ? 'infographics' : 'textboxes', carrier = saved[graphic ? 'generation_config' : 'render_spec']
    let committedPayload, ownerCalls = 0
    global.fetch = async (url, options) => {
      assert.equal(options.redirect, 'error')
      if (url.includes('/atomic/')) {
        assert.equal(url, graphic ? 'http://127.0.0.1:8521/v1.0/atomic/infographic/custom/render' : `http://127.0.0.1:8520/v1.2/atomic/${family}/custom`)
        ownerCalls++
        return { ok: true, json: async () => responseFor(JSON.parse(options.body), carrier.frame) }
      }
      if (url.endsWith('/recreate')) {
        assert.equal(url, `http://127.0.0.1:8519/api/presentations/test/slides/0/${target}/old/recreate`)
        committedPayload = JSON.parse(options.body).replacement
        return { ok: true, json: async () => ({ id: 'new', replaced_element_id: 'old' }) }
      }
      assert.equal(url, 'http://127.0.0.1:8519/api/presentations/test')
      return { ok: true, json: async () => ({ slides: [{ [storage]: [committedPayload ? { ...committedPayload, id: 'new' } : saved] }] }) }
    }
    const result = await route.exports.POST({ nextUrl: new URL('http://localhost:3017/api/composer/regenerate'), headers: new Headers({ origin: 'http://localhost:3017' }),
      json: async () => ({ presentationId: 'test', slideIndex: 0, collection: target, elementId: 'old', expectedSourceSha256: 'a'.repeat(64), variant: 'custom', edits: graphic ? {} : { title: 'Edited container' } }) })
    assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(ownerCalls, 1)
  }
  console.log('PASS: atom/custom source edits, immutable template/theme/frame/items, strict slot pointers, isolated custom routes, exact response binding, only edited-ID replacement, precommit failures and unknown/committed outcomes; all fetches mocked.')
}
apiCases().catch(error => { console.error(error); process.exitCode = 1 })
