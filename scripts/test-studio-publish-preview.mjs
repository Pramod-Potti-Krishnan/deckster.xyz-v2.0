// Actual source/leaf checks only: no browser, services, thumbnail generation or writes.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const compile = (file, source = read(file)) => ts.transpileModule(source, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
let checks = 0
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`) }
function load(file, dependencies = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile(file), { module, exports: module.exports, require: name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw new Error(`Unexpected dependency ${name}`)
  } })
  return module.exports
}
const stageF = load('lib/stage-f-thumbnails.ts')
const helper = load('lib/studio-publish-preview.ts', { './stage-f-thumbnails': stageF })
const resolve = helper.resolveStudioPublishPreview
const live = 'https://fixtures.invalid/final-first.png?v=1'
const restored = 'https://fixtures.invalid/restored-first.png'
const source = { sessionId: 'session-a', ownerSessionId: 'session-a', finalPresentationId: 'final-a', thumbnailOwnerSessionId: 'session-a', thumbnailUrlsByPresentation: { 'final-a': { 0: live, 1: 'https://fixtures.invalid/second.png' }, custom: { 0: 'https://fixtures.invalid/custom.png' } }, firstSlide: { thumbnail_presentation_id: 'final-a', thumbnail_url: restored, slide_index: 0 } }
const ready = () => resolve('session-a', source)
check('Final canonical first slide beats independently owned restored image', () => assert.equal(ready().thumbnailUrl, live))
check('Active Custom/Strawman does not replace the Final publish target', () => {
  for (const activeVersion of ['custom', 'strawman', 'blank', 'final']) assert.equal(resolve('session-a', { ...source, activeVersion }).thumbnailUrl, live)
})
check('Missing target/session/held-owner rejects even an existing live image', () => {
  for (const variant of [null, {}, { ...source, sessionId: 'other' }, { ...source, ownerSessionId: 'other' }, { ...source, ownerSessionId: null }, { ...source, finalPresentationId: null }]) assert.equal(resolve('session-a', variant).status, 'unavailable')
  assert.equal(resolve(null, source).status, 'unavailable')
})
check('Thumbnail cache lineage cannot cross sessions even with reused Final ID', () => {
  for (const thumbnailOwnerSessionId of ['session-b', null, undefined]) assert.equal(resolve('session-a', { ...source, thumbnailOwnerSessionId, firstSlide: null }).status, 'unavailable')
})
check('Independently owned restoration may survive a rejected old live cache', () => assert.equal(resolve('session-a', { ...source, thumbnailOwnerSessionId: 'old' }).thumbnailUrl, restored))
check('Restored ownership rejects an image from the visible Custom/Strawman deck', () => {
  for (const owner of ['custom', 'strawman', '', null, undefined]) assert.equal(resolve('session-a', { ...source, thumbnailUrlsByPresentation: {}, firstSlide: { thumbnail_presentation_id: owner, thumbnail_url: restored } }).status, 'unavailable')
})
check('Restored canonical nonfirst or invalid indices cannot claim first slide', () => {
  for (const field of ['actual_slide_index', 'real_slide_index', 'slide_index', 'actualSlideIndex', 'slideIndex']) {
    for (const value of [1, -1, 0.1, '2', '', ' ', null, undefined, false, 'invalid']) assert.equal(resolve('session-a', { ...source, thumbnailUrlsByPresentation: {}, firstSlide: { thumbnail_presentation_id: 'final-a', thumbnail_url: restored, [field]: value } }).status, 'unavailable')
  }
})
check('Restored index zero or unindexed first array item follows existing viewer fallback', () => {
  for (const index of [{}, { actual_slide_index: '0' }, { real_slide_index: 0 }, { slide_index: 0 }, { actualSlideIndex: 0 }]) assert.equal(resolve('session-a', { ...source, thumbnailUrlsByPresentation: {}, firstSlide: { thumbnail_presentation_id: 'final-a', thumbnailUrl: restored, ...index } }).thumbnailUrl, restored)
})
check('Conflicting explicit indices reject restored image without blocking live canonical zero', () => {
  const firstSlide = { ...source.firstSlide, actual_slide_index: 2, slide_index: 0 }
  assert.equal(resolve('session-a', { ...source, firstSlide }).thumbnailUrl, live)
  assert.equal(resolve('session-a', { ...source, firstSlide, thumbnailUrlsByPresentation: {} }).status, 'unavailable')
})
check('Only canonical map zero is used; no guessing a later slide or presentation ID from a URL', () => {
  assert.equal(resolve('session-a', { ...source, firstSlide: null, thumbnailUrlsByPresentation: { 'final-a': { 2: live }, custom: { 0: live } } }).status, 'unavailable')
  assert.equal(resolve('session-a', { ...source, finalPresentationId: null, finalPresentationUrl: '/p/final-a' }).status, 'unavailable')
})
check('Generating Final suppresses held images until its existing source settles', () => assert.equal(resolve('session-a', { ...source, loading: true }).status, 'loading'))
check('Blank returned image is missing; no synthetic URL or thumbnail work', () => assert.equal(resolve('session-a', { ...source, firstSlide: null, thumbnailUrlsByPresentation: { 'final-a': { 0: '   ' } } }).status, 'unavailable'))
check('Owner key changes on actual session, Final presentation or returned URL change', () => {
  const original = ready().ownerKey
  assert.notEqual(resolve('session-a', { ...source, thumbnailUrlsByPresentation: { 'final-a': { 0: `${live}&v=2` } } }).ownerKey, original)
  assert.notEqual(resolve('session-a', { ...source, finalPresentationId: 'final-b', thumbnailUrlsByPresentation: { 'final-b': { 0: live } } }).ownerKey, original)
  assert.notEqual(resolve('session-b', { ...source, sessionId: 'session-b', ownerSessionId: 'session-b', thumbnailOwnerSessionId: 'session-b' }).ownerKey, original)
})

// Render the actual leaf with keyed hook state, DOM refs and unmount cleanup.
function leafHarness() {
  let context, cursor, tree
  const stores = new Map(), attached = new Map()
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
  const react = {
    useState(initial) { const slot = cursor++; if (!(slot in context)) context[slot] = typeof initial === 'function' ? initial() : initial; const store = context; return [store[slot], value => { store[slot] = typeof value === 'function' ? value(store[slot]) : value }] },
    useRef(initial) { const slot = cursor++; return context[slot] ??= { current: initial } },
  }
  const exports = load('components/studio-publish-preview.tsx', { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': { ImageIcon: 'ImageIcon' }, '@/lib/studio-publish-preview': helper })
  function render(props) {
    const used = new Set(), mounted = new Set()
    function materialize(node, location = 'root') {
      if (Array.isArray(node)) return node.map((child, index) => materialize(child, `${location}/${index}`))
      if (!node || typeof node !== 'object') return node
      if (typeof node.type === 'function') {
        const key = `${location}:${node.type.name}:${node.key ?? ''}`
        mounted.add(key); context = stores.get(key) ?? []; stores.set(key, context); cursor = 0
        return materialize(node.type(node.props), key)
      }
      const children = materialize(node.props.children, `${location}/${node.type}`)
      const result = { ...node, props: { ...node.props, children } }
      if (node.type === 'img') {
        let dom = attached.get(location)?.dom
        if (!dom) dom = { getAttribute: name => dom.props[name] ?? null }
        dom.props = result.props; result.dom = dom
        node.props.ref.current = dom
        attached.set(location, { ref: node.props.ref, dom }); used.add(location)
      }
      return result
    }
    tree = materialize(jsx(exports.StudioPublishPreview, props))
    for (const key of stores.keys()) if (!mounted.has(key)) stores.delete(key)
    for (const [location, image] of attached) if (!used.has(location)) { image.ref.current = null; attached.delete(location) }
    return tree
  }
  return { render }
}
function nodes(tree, predicate) {
  const found = []
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return; if (predicate(node)) found.push(node); visit(node.props?.children) }
  visit(tree); return found
}
const imageOf = tree => nodes(tree, n => n.type === 'img')[0]
const plain = tree => JSON.stringify(tree, (key, value) => key === 'ref' || key === 'dom' ? undefined : typeof value === 'function' ? 'callback' : value)
const previewProps = { sessionId: 'session-a', source }
check('Actual leaf exposes labelled figure, Final slide alt, honest caption and loading state', () => {
  const tree = leafHarness().render(previewProps)
  assert.ok(nodes(tree, n => n.type === 'figure' && n.props['aria-label'] === 'Current deck preview').length)
  assert.equal(imageOf(tree).props.alt, 'First slide of the current Final deck')
  assert.ok(plain(tree).includes('Preview image can lag recent edits.'))
  assert.ok(nodes(tree, n => n.props['data-preview-status'] === 'loading').length)
  assert.equal(nodes(tree, n => n.type === 'button' || n.type === 'iframe').length, 0)
})
check('Current owned image load reveals its image without changing any publish action', () => {
  const h = leafHarness(); const img = imageOf(h.render(previewProps)); img.props.onLoad({ currentTarget: img.dom })
  assert.ok(nodes(h.render(previewProps), n => n.props['data-preview-status'] === 'ready').length)
})
check('Image failure removes broken image and exposes honest accessible fallback', () => {
  const h = leafHarness(); const img = imageOf(h.render(previewProps)); img.props.onError({ currentTarget: img.dom })
  const tree = h.render(previewProps)
  assert.equal(imageOf(tree), undefined); assert.ok(plain(tree).includes('The slide image could not be loaded.'))
  assert.ok(nodes(tree, n => n.props.role === 'status' && n.props['aria-busy'] === false).length)
})
check('Missing/stale-owner/generating Final never mounts an image URL', () => {
  for (const props of [{ ...previewProps, source: null }, { ...previewProps, sessionId: 'other' }, { ...previewProps, source: { ...source, loading: true } }]) assert.equal(imageOf(leafHarness().render(props)), undefined)
})
check('Wrong-node, wrong-src or wrong-owner events cannot settle the preview', () => {
  for (const bad of [{ src: live, 'data-studio-preview-owner': ready().ownerKey }, { src: 'old', 'data-studio-preview-owner': ready().ownerKey }, { src: live, 'data-studio-preview-owner': 'old' }]) {
    const h = leafHarness(); const img = imageOf(h.render(previewProps))
    const dom = { getAttribute: name => bad[name] }
    img.props.onLoad({ currentTarget: dom }); img.props.onError({ currentTarget: dom })
    assert.ok(nodes(h.render(previewProps), n => n.props['data-preview-status'] === 'loading').length)
  }
})
check('Stale old-owner load/error after target change cannot alter new image state', () => {
  const h = leafHarness(); const old = imageOf(h.render(previewProps))
  const next = { sessionId: 'session-b', source: { ...source, sessionId: 'session-b', ownerSessionId: 'session-b', thumbnailOwnerSessionId: 'session-b' } }
  const current = imageOf(h.render(next))
  old.props.onLoad({ currentTarget: old.dom }); old.props.onError({ currentTarget: old.dom })
  assert.ok(nodes(h.render(next), n => n.props['data-preview-status'] === 'loading').length)
  current.props.onLoad({ currentTarget: current.dom })
  assert.ok(nodes(h.render(next), n => n.props['data-preview-status'] === 'ready').length)
})
check('Replaced attributes on the actual image node cannot settle an obsolete URL/owner', () => {
  for (const [attribute, value] of [['src', 'old'], ['data-studio-preview-owner', 'old']]) {
    const h = leafHarness(); const img = imageOf(h.render(previewProps))
    img.dom.props = { ...img.dom.props, [attribute]: value }
    img.props.onLoad({ currentTarget: img.dom }); img.props.onError({ currentTarget: img.dom })
    assert.ok(nodes(h.render(previewProps), n => n.props['data-preview-status'] === 'loading').length)
  }
})
check('Returning after rejected ownership remounts the same image with fresh loading state', () => {
  const h = leafHarness(); const old = imageOf(h.render(previewProps)); old.props.onError({ currentTarget: old.dom }); h.render(previewProps)
  h.render({ ...previewProps, sessionId: 'other' })
  const tree = h.render(previewProps); assert.ok(imageOf(tree)); assert.ok(nodes(tree, n => n.props['data-preview-status'] === 'loading').length)
})
check('Returning from rejected owner or replacing failed URL resets loading/recovery', () => {
  const h = leafHarness(); const old = imageOf(h.render(previewProps)); old.props.onError({ currentTarget: old.dom }); h.render(previewProps)
  h.render({ ...previewProps, sessionId: 'other' })
  const next = { ...previewProps, source: { ...source, thumbnailUrlsByPresentation: { 'final-a': { 0: `${live}&new=1` } } } }
  const img = imageOf(h.render(next)); assert.ok(img); assert.equal(img.props.src, `${live}&new=1`)
  assert.ok(nodes(h.render(next), n => n.props['data-preview-status'] === 'loading').length)
})

// Default-off actual wizard/control leaves retain the accepted checkpoint's tree.
function classicLeaf(file, sourceText, flag, props, stateOverrides = {}) {
  let cursor = 0
  const slots = []
  const jsx = (type, props) => ({ type, props: props ?? {} })
  const react = { useState(initial) { const i = cursor++; return [Object.hasOwn(stateOverrides, i) ? stateOverrides[i] : typeof initial === 'function' ? initial() : initial, () => {}] }, useRef(value) { return slots[cursor++] ??= { current: value } }, useCallback: fn => fn, useMemo: fn => fn(), useEffect: () => {}, useLayoutEffect: () => {} }
  const symbols = new Proxy({}, { get: (_object, name) => name })
  const module = { exports: {} }
  vm.runInNewContext(compile(file, sourceText), { module, exports: module.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } }, require: name => {
    if (name === 'react') return { ...react, default: react }
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (name === '@/lib/narration/budget') return { resolveBudget: () => null, suggestedReserveMinutes: () => 0 }
    if (name === '@/hooks/use-toast') return { useToast: () => ({ toast: () => {} }) }
    if (name === '@/hooks/use-copy-to-clipboard') return { useCopyToClipboard: () => ({ copy: () => {}, copied: false }) }
    if (name.endsWith('.css')) return {}
    if (name === 'lucide-react' || name.startsWith('@/components/')) return symbols
    throw new Error(`Unexpected classic dependency ${name}`)
  } })
  function expand(node) { return Array.isArray(node) ? node.map(expand) : !node || typeof node !== 'object' ? node : typeof node.type === 'function' ? expand(node.type(node.props)) : { ...node, props: { ...node.props, children: expand(node.props.children) } } }
  const component = module.exports[file.includes('wizard') ? 'PublishWizard' : 'PublishControls']
  return expand(component(props))
}
const oldSource = file => execFileSync('git', ['show', `7f21998:${file}`], { cwd: root, encoding: 'utf8' })
for (const flag of [undefined, 'false', 'TRUE', '1']) check(`Classic default-off DOM remains exact with supplied preview: ${String(flag)}`, () => {
  const file = 'components/publish-wizard.tsx'
  for (let step = 0; step < 4; step++) {
    const props = { sessionId: 'session-a', slideCount: 3, deckPreview: source, record: null, busy: false, progress: null, onPublish: () => {}, onCancel: () => {} }
    assert.equal(plain(classicLeaf(file, read(file), flag, props, { 0: step })), plain(classicLeaf(file, oldSource(file), flag, props, { 0: step })))
  }
  const controls = 'components/publish-dialog.tsx', props = { sessionId: 'session-a', deckTitle: 'Deck', slideCount: 3, hasFinalDeck: true, deckPreview: source }
  assert.equal(plain(classicLeaf(controls, read(controls), flag, props)), plain(classicLeaf(controls, oldSource(controls), flag, props)))
})
check('Actual Studio wizard forwards its Publish target; classic cannot render the preview', () => {
  const file = 'components/publish-wizard.tsx', props = { sessionId: 'session-a', slideCount: 3, deckPreview: source, record: null, busy: false, progress: null, onPublish: () => {}, onCancel: () => {} }
  const node = nodes(classicLeaf(file, read(file), 'true', props), n => n.type === 'StudioPublishPreview')[0]
  assert.equal(node.props.sessionId, 'session-a'); assert.equal(node.props.source, source)
})
// Evaluate the actual shared handoff expression without mounting the shared
// viewer or running effects. This verifies which existing data enters the leaf.
function jsxAttributeExpression(file, component, attribute) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let expression
  const visit = node => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(ast) === component) {
      const attr = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(ast) === attribute)
      if (attr && ts.isJsxExpression(attr.initializer)) expression = attr.initializer.expression.getText(ast)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast); assert.ok(expression, `${component}.${attribute} actual expression`)
  return expression
}
function evaluate(expression, variables, flag = 'true') {
  return vm.runInNewContext(`(${expression})`, { ...variables, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } }, Array })
}
const area = 'components/builder/presentation-area.tsx'
const areaVariables = { publishSessionId: 'session-a', deckOwnerSessionId: 'session-a', publishFinalPresentationId: 'final-a', publishThumbnailUrlsByPresentation: source.thumbnailUrlsByPresentation, publishThumbnailOwnerSessionId: 'session-a', slideStructure: { slides: [source.firstSlide] }, isGeneratingFinal: false, presentationId: 'custom', activeVersion: 'custom' }
const handoff = jsxAttributeExpression(area, 'PublishControls', 'deckPreview')
check('Actual shared handoff selects Final, actual Publish session, held-deck owner and cache lineage', () => {
  const result = evaluate(handoff, areaVariables)
  assert.equal(result.sessionId, 'session-a'); assert.equal(result.ownerSessionId, 'session-a')
  assert.equal(result.finalPresentationId, 'final-a'); assert.equal(result.thumbnailOwnerSessionId, 'session-a')
  assert.equal(result.firstSlide, source.firstSlide); assert.equal(resolve('session-a', result).thumbnailUrl, live)
  assert.equal(evaluate(handoff, areaVariables, 'false'), undefined)
})
check('Actual root handoff passes hook Final ID and exact cache lineage without visible-version fallback', () => {
  const page = 'app/builder/page.tsx', vars = { studioShell: true, finalPresentationId: 'final-a', effectivePresentationId: 'custom', slideThumbnailUrlsByPresentation: source.thumbnailUrlsByPresentation, currentSessionIdRef: { current: 'session-a' } }
  assert.equal(evaluate(jsxAttributeExpression(page, 'PresentationArea', 'publishFinalPresentationId'), vars), 'final-a')
  assert.equal(evaluate(jsxAttributeExpression(page, 'PresentationArea', 'publishThumbnailUrlsByPresentation'), vars), source.thumbnailUrlsByPresentation)
  assert.equal(evaluate(jsxAttributeExpression(page, 'PresentationArea', 'publishThumbnailOwnerSessionId'), vars), 'session-a')
  vars.studioShell = false
  for (const attr of ['publishFinalPresentationId', 'publishThumbnailUrlsByPresentation', 'publishThumbnailOwnerSessionId']) assert.equal(evaluate(jsxAttributeExpression(page, 'PresentationArea', attr), vars), undefined)
})
check('Actual Builder hook/effect sequence remains exact; existing session ref precedes cache clear', () => {
  const file = 'app/builder/page.tsx'
  function hooks(sourceText) {
    const ast = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const result = []
    const visit = node => { if (ts.isCallExpression(node) && /^(useState|useRef|useEffect|useLayoutEffect|useMemo|useCallback)$/.test(node.expression.getText(ast))) result.push(node.getText(ast)); ts.forEachChild(node, visit) }
    visit(ast); return result
  }
  assert.deepEqual(hooks(read(file)), hooks(oldSource(file)))
  const sourceText = read(file)
  assert.ok(sourceText.indexOf('currentSessionIdRef.current = currentSessionId') < sourceText.indexOf('setSlideThumbnailUrlsByPresentation({})'))
  const ast = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const effects = []
  const visit = node => { if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && /currentSessionIdRef.current = currentSessionId|setSlideThumbnailUrlsByPresentation\(\{\}\)/.test(node.arguments[0]?.getText(ast))) effects.push(node); ts.forEachChild(node, visit) }
  visit(ast); assert.equal(effects.length, 2)
  for (const effect of effects) assert.ok(effect.arguments[1].getText(ast).includes('currentSessionId'))
})
check('Root prop forwarding stays Studio-only and wizard receives the supplied source', () => {
  const controls = evaluate(jsxAttributeExpression('components/publish-dialog.tsx', 'PublishDialog', 'deckPreview'), { STUDIO_PUBLISH: true, deckPreview: source })
  assert.equal(controls, source)
  assert.equal(evaluate(jsxAttributeExpression('components/publish-dialog.tsx', 'PublishDialog', 'deckPreview'), { STUDIO_PUBLISH: false, deckPreview: source }), undefined)
  assert.equal(evaluate(jsxAttributeExpression('components/publish-dialog.tsx', 'PublishWizard', 'deckPreview'), { deckPreview: source }), source)
})

check('Preview boundary introduces no service/iframe/thumbnail/write invocation', () => {
  for (const file of ['lib/studio-publish-preview.ts', 'components/studio-publish-preview.tsx']) {
    const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const forbidden = []
    const visit = node => { if (ts.isCallExpression(node) && /fetch|postMessage|localStorage|sessionStorage|generate|createObjectURL/i.test(node.expression.getText(ast))) forbidden.push(node.expression.getText(ast)); ts.forEachChild(node, visit) }
    visit(ast); assert.deepEqual(forbidden, [])
  }
})
console.log(`${checks} Publish preview source/leaf checks passed; no connected or browser claim.`)
