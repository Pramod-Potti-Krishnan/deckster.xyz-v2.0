import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
function compile(text, require, extras = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(text, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText, { module, exports: module.exports, require, ...extras })
  return module.exports
}
const helpers = compile(source('lib/stage-f-thumbnails.ts'), () => { throw Error('unexpected helper import') })
const plain = value => JSON.parse(JSON.stringify(value))
let checks = 0
function check(name, action) { action(); checks++; console.log(`PASS ${name}`) }

function harness(storage = new Map(), unavailable = false) {
  let cursor = 0, dirty = false, pending = [], slots = [], currentProps, api
  let writes = 0
  const react = {
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
    useState(initial) {
      const i = cursor++
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[i].value, update => {
        const next = typeof update === 'function' ? update(slots[i].value) : update
        if (next !== slots[i].value) { slots[i].value = next; dirty = true }
      }]
    },
    useCallback(callback, deps) {
      const i = cursor++, old = slots[i]
      if (!old || deps.some((dep, n) => dep !== old.deps[n])) slots[i] = { callback, deps }
      return slots[i].callback
    },
    useEffect(callback, deps) {
      const i = cursor++, old = slots[i]
      if (!old || deps.some((dep, n) => dep !== old.deps[n])) {
        const next = { deps, cleanup: old?.cleanup }; slots[i] = next
        pending.push(() => { next.cleanup?.(); next.cleanup = callback() })
      }
    },
  }
  const hook = compile(source('hooks/use-stage-f-thumbnail-cache.ts'), name => {
    if (name === 'react') return react
    if (name === '@/lib/stage-f-thumbnails') return helpers
    throw Error(`unexpected import ${name}`)
  }, { window: { sessionStorage: {
    getItem(key) { if (unavailable) throw Error('storage unavailable'); return storage.get(key) ?? null },
    setItem(key, value) { if (unavailable) throw Error('quota'); writes++; storage.set(key, value) },
    removeItem(key) { if (unavailable) throw Error('storage unavailable'); writes++; storage.delete(key) },
  } } }).useStageFThumbnailCache
  function render(props = currentProps ?? { enabled: true, ownerUserId: 'owner-a', sessionId: 'session-a' }, flush = true) {
    currentProps = props
    const once = () => { cursor = 0; dirty = false; api = hook(currentProps) }
    once()
    if (flush) {
      let turns = 0
      do {
        while (pending.length) pending.shift()()
        if (dirty) once()
        if (++turns > 20) throw Error('hook did not settle')
      } while (dirty || pending.length)
    }
    return api
  }
  return { render, storage, writes: () => writes, dispose: () => { for (const slot of slots) slot?.cleanup?.() } }
}
const live = { 'deck-a': { 0: 'https://images.example.test/one.png' } }
function seed(storage, owner = 'owner-a', session = 'session-a', urls = live) {
  storage.set(helpers.stageFThumbnailCacheKey(owner, session), JSON.stringify(helpers.createStageFThumbnailCache(urls, owner, session)))
}
check('actual hook preserves received preview on a fresh same-owned mount', () => {
  const h = harness(); h.render().setThumbnailUrls(live); h.render(); h.dispose()
  const reload = harness(h.storage); assert.deepEqual(plain(reload.render().thumbnailUrls), live)
  reload.dispose()
})
check('empty first render never overwrites the saved preview before hydration', () => {
  const storage = new Map(); seed(storage)
  const h = harness(storage); assert.deepEqual(plain(h.render(undefined, false).thumbnailUrls), {})
  assert.equal(h.writes(), 0); assert.deepEqual(plain(h.render().thumbnailUrls), live); h.dispose()
})
check('received live URL wins if it arrives before hydration settles', () => {
  const storage = new Map(); seed(storage)
  const h = harness(storage), api = h.render(undefined, false)
  const newer = { 'deck-a': { 0: 'https://images.example.test/new.png' } }
  api.setThumbnailUrls(newer); assert.deepEqual(plain(h.render().thumbnailUrls), newer); h.dispose()
})
check('session switch hides old images synchronously and refuses captured old setter', () => {
  const h = harness(); const old = h.render(); old.setThumbnailUrls(live); h.render()
  const props = { enabled: true, ownerUserId: 'owner-a', sessionId: 'session-b' }
  assert.deepEqual(plain(h.render(props, false).thumbnailUrls), {})
  old.setThumbnailUrls({ leaked: { 0: 'https://images.example.test/leak.png' } })
  assert.deepEqual(plain(h.render().thumbnailUrls), {}); h.dispose()
})
check('account mismatch cannot expose or overwrite another account snapshot', () => {
  const storage = new Map(); seed(storage)
  const h = harness(storage)
  assert.deepEqual(plain(h.render({ enabled: true, ownerUserId: 'owner-b', sessionId: 'session-a' }).thumbnailUrls), {})
  assert.ok(storage.has(helpers.stageFThumbnailCacheKey('owner-a', 'session-a'))); h.dispose()
})
check('unmounted setter cannot persist a late old acknowledgement', () => {
  const h = harness(); const old = h.render(); h.dispose(); old.setThumbnailUrls(live)
  const reload = harness(h.storage); assert.deepEqual(plain(reload.render().thumbnailUrls), {}); reload.dispose()
})
check('returning to the same session/account cannot revive a retired callback generation', () => {
  const h = harness(); const old = h.render()
  old.setThumbnailUrls(live); h.render()
  h.render({ enabled: true, ownerUserId: 'owner-a', sessionId: 'session-b' })
  h.render({ enabled: true, ownerUserId: 'owner-a', sessionId: 'session-a' })
  old.setThumbnailUrls({ leaked: { 0: 'https://images.example.test/leak.png' } })
  old.invalidateThumbnailUrls('deck-a')
  assert.deepEqual(plain(h.render().thumbnailUrls), live)
  const active = h.render()
  h.render({ enabled: true, ownerUserId: 'owner-b', sessionId: 'session-a' })
  active.setThumbnailUrls(live)
  assert.deepEqual(plain(h.render().thumbnailUrls), {}); h.dispose()
})
check('acknowledged structural invalidation removes only its presentation across reload', () => {
  const h = harness(); h.render().setThumbnailUrls({ ...live, 'deck-b': { 0: 'https://images.example.test/b.png' } })
  h.render().invalidateThumbnailUrls('deck-a'); h.render(); h.dispose()
  const reload = harness(h.storage)
  assert.deepEqual(plain(reload.render().thumbnailUrls), { 'deck-b': { 0: 'https://images.example.test/b.png' } }); reload.dispose()
})
check('invalidation arriving before hydration cannot resurrect stored stale indices', () => {
  const storage = new Map(); seed(storage)
  const h = harness(storage); h.render(undefined, false).invalidateThumbnailUrls('deck-a')
  assert.deepEqual(plain(h.render().thumbnailUrls), {}); assert.equal(storage.has(helpers.stageFThumbnailCacheKey('owner-a', 'session-a')), false); h.dispose()
})
check('stale invalidation cannot clear another session and new live previews remain accepted', () => {
  const storage = new Map(); seed(storage, 'owner-a', 'session-b')
  const h = harness(storage); const old = h.render()
  h.render({ enabled: true, ownerUserId: 'owner-a', sessionId: 'session-b' })
  old.invalidateThumbnailUrls('deck-a'); assert.deepEqual(plain(h.render().thumbnailUrls), live)
  h.render().invalidateThumbnailUrls('deck-a'); h.render().setThumbnailUrls(live)
  assert.deepEqual(plain(h.render().thumbnailUrls), live); h.dispose()
})
check('disabled cache and absent/new session retain live rendering without storage writes', () => {
  for (const props of [
    { enabled: false, ownerUserId: 'owner-a', sessionId: 'session-a' },
    { enabled: true, ownerUserId: 'owner-a', sessionId: null },
    { enabled: true, ownerUserId: 'owner-a', sessionId: 'new' },
  ]) {
    const h = harness(); h.render(props).setThumbnailUrls(live)
    assert.deepEqual(plain(h.render().thumbnailUrls), live); assert.equal(h.writes(), 0); h.dispose()
  }
})
check('storage failure does not prevent live thumbnails', () => {
  const h = harness(new Map(), true); h.render().setThumbnailUrls(live)
  assert.deepEqual(plain(h.render().thumbnailUrls), live); h.dispose()
})

// Execute actual viewer notification callbacks against synthetic native receipts.
const viewerSource = source('components/presentation-viewer.tsx')
const ast = ts.createSourceFile('viewer.tsx', viewerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function arrow(name) {
  let found
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && ts.isCallExpression(node.initializer)) found = node.initializer.arguments[0].getText(ast)
    ts.forEachChild(node, visit)
  }
  visit(ast); assert.ok(found, `actual callback ${name}`); return found
}
function callback(name, scope) {
  return compile(`export const extracted = ${arrow(name)}`, () => { throw Error('unexpected import') }, scope).extracted
}
for (const [name, args] of [
  ['handleDuplicateSlide', [0]], ['handleConfirmDelete', []],
  ['handleChangeLayout', [0, 'L02']], ['handleReorderSlides', [0, 1]],
]) {
  for (const mode of ['success', 'failure', 'retired-owner']) {
    let invalidations = [], resolve
    const owner = { presentationId: 'deck-a' }, iframe = {}
    const scope = {
      studioShell: true, renderSlideMutationOwner: owner,
      slideMutationOwnerRef: { current: owner }, iframeRef: { current: iframe },
      slideMutationMountRef: { current: { active: true, generation: 0 } },
      viewerInteractionIntentRef: { current: 0 },
      nativeSnapshotStructureEditedRef: { current: false },
      thumbnailNativeRevisionRef: { current: 0 }, setStudioCanonicalThumbnails() {},
      onThumbnailInvalidatedRef: { current: id => invalidations.push(id) },
      sendCommand: () => new Promise(done => { resolve = done }),
      slidesToDelete: [0], totalSlides: 7, currentSlide: 1,
      toast() {}, debugLog() {}, console: { error() {} },
    }
    for (const setter of ['setTotalSlides', 'setCurrentSlide', 'setSlidesModifiedByCrud', 'setIsDeleting', 'setSelectedSlideIndices', 'setShowDeleteDialog', 'setSlidesToDelete']) scope[setter] = () => {}
    scope.captureThumbnailInvalidation = callback('captureThumbnailInvalidation', scope)
    const pending = callback(name, scope)(...args)
    assert.equal(scope.viewerInteractionIntentRef.current, 1, `${name}/${mode} retires interaction before dispatch`)
    assert.equal(scope.thumbnailNativeRevisionRef.current, 1, `${name}/${mode} retires thumbnail order before dispatch`)
    assert.equal(scope.nativeSnapshotStructureEditedRef.current, true, `${name}/${mode} retires snapshot order before dispatch`)
    if (mode === 'retired-owner') scope.slideMutationOwnerRef.current = { presentationId: 'deck-b' }
    resolve({ success: mode !== 'failure', slide_count: 8, remaining_slide_count: 6, deleted_count: 1 })
    await pending
    assert.deepEqual(invalidations, mode === 'success' ? ['deck-a'] : [], `${name}/${mode}`)
    checks++; console.log(`PASS actual ${name} ${mode} thumbnail invalidation`)
  }
}
console.log(`${checks} owned thumbnail cache/lifecycle/native receipt checks passed (isolated synthetic; no connected writes).`)
