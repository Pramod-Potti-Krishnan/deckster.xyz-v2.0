// S-03 (frontend): the builder consumes Director's deck_mutation frame (flag NEXT_PUBLIC_STUDIO_DECK_MUTATION_REFRESH_ENABLED).
// Run: node scripts/test-studio-deck-mutation-refresh.mjs   (plain node: transpile + vm, no network, no git)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
function compile(text, env) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(text, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText, { module, exports: module.exports, require: () => { throw Error('unexpected import') },
    process: { env }, Set, Map, JSON, Math, Number, Array, Object, Error })
  return module.exports
}
const LIB = 'lib/studio-deck-mutation-refresh.ts'
const lib = compile(read(LIB), { NEXT_PUBLIC_STUDIO_DECK_MUTATION_REFRESH_ENABLED: 'true' })
const plain = value => JSON.parse(JSON.stringify(value))
let checks = 0
function check(name, action) {
  try { action() } catch (error) { console.error(`FAIL ${name}`); throw error }
  checks++; console.log(`PASS ${name}`)
}

const PID = 'pres-a'
const displayed = { presentationId: PID, presentationUrl: 'http://127.0.0.1:8504/p/pres-a', slideCount: 7, refreshToken: 100 }
const frame = (mutation, extra = {}) => ({ message_id: `m-${mutation}`, payload: {
  mutation, slide_index: 2, presentation_id: PID, refresh_token: 'rt', ...extra } })
const plan = (message, over = {}) => plain(lib.planDeckMutationRefresh({
  message, ownerIsCurrent: true, ownerPresentationId: PID, displayed, now: 5000, ...over }))

check('flag: exact "true" only, default off', () => {
  assert.equal(lib.STUDIO_DECK_MUTATION_REFRESH_ENABLED, true)
  for (const value of [undefined, '', 'false', 'TRUE', '1', ' true']) {
    assert.equal(compile(read(LIB), value === undefined ? {} : { NEXT_PUBLIC_STUDIO_DECK_MUTATION_REFRESH_ENABLED: value })
      .STUDIO_DECK_MUTATION_REFRESH_ENABLED, false, String(value))
  }
})
check('the lib is import-free', () => assert.doesNotMatch(read(LIB), /^\s*import\s/m))
check('slide_added on the displayed deck: refreshToken bumped, count +1, focus the new index', () => {
  assert.deepEqual(plan(frame('slide_added')), { override: {
    presentationUrl: displayed.presentationUrl, presentationId: PID, slideCount: 8, refreshToken: 5000 }, focusSlideIndex: 2 })
})
check('slide_deleted: count -1 (never below 0), no focus', () => {
  const p = plan(frame('slide_deleted'))
  assert.equal(p.override.slideCount, 6); assert.equal(p.focusSlideIndex, null)
  assert.equal(plain(lib.planDeckMutationRefresh({ message: frame('slide_deleted'), ownerIsCurrent: true, ownerPresentationId: PID,
    displayed: { ...displayed, slideCount: 0 }, now: 1 })).override.slideCount, 0)
})
check('slide_replaced keeps the count; slide_reordered focuses new_slide_index', () => {
  assert.equal(plan(frame('slide_replaced')).override.slideCount, 7)
  const r = plan(frame('slide_reordered', { new_slide_index: 5 }))
  assert.equal(r.override.slideCount, 7); assert.equal(r.focusSlideIndex, 5)
})
check('refreshToken is monotonic even when the clock is behind the current token', () => {
  assert.equal(plan(frame('slide_added'), { now: 50 }).override.refreshToken, 101)
})
check('an unknown count stays unknown', () => {
  assert.equal(plan(frame('slide_added'), { displayed: { ...displayed, slideCount: null } }).override.slideCount, null)
})
check('presentation_url from the frame wins (the hook admitted it); otherwise the displayed URL', () => {
  assert.equal(plan(frame('slide_added', { presentation_url: 'http://127.0.0.1:8504/p/pres-a?x' })).override.presentationUrl,
    'http://127.0.0.1:8504/p/pres-a?x')
  assert.equal(plan(frame('slide_added', { presentation_url: null })).override.presentationUrl, displayed.presentationUrl)
})
check('another deck is ignored (displayed id or owner id differs)', () => {
  assert.equal(plan(frame('slide_added', { presentation_id: 'pres-b' })), null)
  assert.equal(plan(frame('slide_added'), { ownerPresentationId: 'pres-b' }), null)
  assert.equal(plan(frame('slide_added'), { displayed: { ...displayed, presentationId: 'pres-b' } }), null)
  assert.equal(plan(frame('slide_added'), { displayed: { ...displayed, presentationId: null } }), null)
})
check('a stale socket / retired owner is ignored', () => {
  assert.equal(plan(frame('slide_added'), { ownerIsCurrent: false }), null)
})
check('malformed frames are ignored', () => {
  for (const bad of [null, undefined, {}, { message_id: 'x' }, frame('slide_moved'), { ...frame('slide_added'), message_id: '' },
    frame('slide_added', { presentation_id: '' })]) assert.equal(plan(bad), null)
})
check('a duplicate message_id does not fire twice; another id or deck does', () => {
  const seen = lib.createDeckMutationSeen()
  const once = message => lib.planDeckMutationRefresh({ message, ownerIsCurrent: true, ownerPresentationId: PID, displayed, now: 1, seen })
  assert.ok(once(frame('slide_added'))); assert.equal(once(frame('slide_added')), null)
  assert.ok(once({ ...frame('slide_added'), message_id: 'm-other' }))
})
check('the seen set is bounded', () => {
  const seen = lib.createDeckMutationSeen(3)
  for (const k of ['a', 'b', 'c', 'd']) seen.add(k)
  assert.equal(seen.has('a'), false); assert.equal(seen.has('d'), true)
})
check('rail refresh requests reach subscribers, carry the id, and unsubscribe cleanly', () => {
  const got = []
  const off = lib.onSlideRailRefreshRequest(id => got.push(id))
  const offBad = lib.onSlideRailRefreshRequest(() => { throw Error('boom') })
  assert.equal(lib.requestSlideRailRefresh(PID), 1)
  off(); offBad()
  assert.equal(lib.requestSlideRailRefresh(PID), 0)
  assert.deepEqual(got, [PID])
})

// Wiring (source checks): flag off passes no handler, so the hook's `if (!callback) return` drops the frame as today.
const page = read('app/builder/page.tsx')
const viewer = read('components/presentation-viewer.tsx')
check('page: onDeckMutation is passed only behind the flag', () => {
  assert.equal((page.match(/onDeckMutation/g) ?? []).length, 1)
  assert.match(page, /\.\.\.\(STUDIO_DECK_MUTATION_REFRESH_ENABLED && \{\n      onDeckMutation: /)
})
check('page: the handler uses owner.isCurrent(), the displayed deck ref, the seen set, then bumps the override and the rail', () => {
  const body = page.slice(page.indexOf('onDeckMutation: '), page.indexOf('requestSlideRailRefresh(plan.override.presentationId)') + 60)
  assert.match(body, /ownerIsCurrent: owner\.isCurrent\(\)/)
  assert.match(body, /const displayed = slideComposerPresentationRef\.current/)
  assert.match(body, /seen: deckMutationSeenRef\.current/)
  assert.match(body, /if \(!plan\) return\n/)
  assert.match(body, /setSlideComposerOverride\(plan\.override\)\n        requestSlideRailRefresh\(plan\.override\.presentationId\)/)
})
check('viewer: subscribes only with the flag on, refreshes only its own deck through #317 refresh (immediate)', () => {
  assert.match(viewer, /if \(!STUDIO_DECK_MUTATION_REFRESH_ENABLED \|\| !presentationId\) return\n/)
  assert.match(viewer, /onSlideRailRefreshRequest\(id => \{ if \(id === presentationId\) slideRailRefreshRef\.current\(\) \}\)/)
  // #317's refresh() is the immediate path: refresh(true).
  assert.match(read('hooks/use-slide-rail-identity.ts'), /const refresh = useCallback\(\(\) => \{ controllerRef\.current\?\.refresh\(true\) \}, \[\]\)/)
})
check('.env.example documents the flag default off', () => {
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_DECK_MUTATION_REFRESH_ENABLED="false"$/m)
})

console.log(`\n${checks} checks passed`)
