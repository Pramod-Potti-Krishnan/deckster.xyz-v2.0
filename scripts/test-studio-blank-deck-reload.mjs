// MULTITAB J1 P1a: NEXT_PUBLIC_STUDIO_BLANK_DECK_RELOAD_FIX (default off). A reload at the outline-approval step left the canvas on
// "Loading your selected deck…": the slide-count reconcile effect saved Director's blank deck into the FINAL slots and left a page
// override the session restore could not own (lib/studio-blank-deck-reload.ts has the full story).
//
// Proves, offline (no socket, fetch or timer):
//   1. the slot helper: flag off, the PATCH fields (and their order) equal the four inline branches it replaced, for every version
//      and value shape (hash-compared); flag on, a blank deck's count goes to the blank slots, strawman/final unchanged;
//   2. the reconcile write gate: flag off the reconcile always saves (as before); on, Director's untouched blank deck (one Layout
//      slide) is never saved to the row, while slides added on the blank canvas are (blank slots); the display override is unchanged;
//   3. the restore-ownership rule: an override survives a restore only when the restore restored that same presentation;
//   4. the P1a sequence through the REAL ownership and canvas-lifecycle modules: base -> awaiting_owner (the stuck spinner); with
//      the fix -> never awaiting_owner, and with the first-message flush the restored blank deck is owned ("blank" canvas) and the
//      reconcile's display override on it is kept (it only decorates the owned deck);
//   5. the page wiring: one helper at all four sites, the write gate in the reconcile (its comparison and override untouched), the
//      restore-commit retire, the first-message-save flush (an effect: handleSendMessage itself is untouched), the flag read as
//      a literal, nothing in the WebSocket hook, .env.example and package.json;
//   6. mutants: broken copies of the module and the page must each be caught.
//
//   node scripts/test-studio-blank-deck-reload.mjs
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const FLAG = 'NEXT_PUBLIC_STUDIO_BLANK_DECK_RELOAD_FIX'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const SRC = {
  'lib/studio-blank-deck-reload.ts': read('lib/studio-blank-deck-reload.ts'),
  'lib/builder-presentation-ownership.ts': read('lib/builder-presentation-ownership.ts'),
  'lib/studio-canvas-lifecycle.ts': read('lib/studio-canvas-lifecycle.ts'),
  'app/builder/page.tsx': read('app/builder/page.tsx'),
  'hooks/use-deckster-websocket-v2.ts': read('hooks/use-deckster-websocket-v2.ts'),
  'hooks/use-session-persistence.ts': read('hooks/use-session-persistence.ts'),
  '.env.example': read('.env.example'),
  'package.json': read('package.json'),
}

/** Load a lib module (and its '@/lib/...' imports) from the given sources with the given env. */
function load(sources, rel, env) {
  const cache = new Map()
  const loadRel = file => {
    if (cache.has(file)) return cache.get(file).exports
    const out = ts.transpileModule(sources[file], { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
    const mod = { exports: {} }
    cache.set(file, mod)
    const req = spec => spec.startsWith('@/') ? loadRel(spec.slice(2) + '.ts') : nodeRequire(spec)
    vm.runInNewContext(out.outputText, { module: mod, exports: mod.exports, require: req, process: { env: { ...env } }, URL, decodeURIComponent })
    return mod.exports
  }
  return loadRel(rel)
}

const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)

/** The four inline branches as they were at the base commit (identical shape at all four sites). */
function legacyUpdates(slideCount, lastMessageAt, activeVersion, url, id) {
  const updates = { slideCount, lastMessageAt }
  if (activeVersion === 'strawman') {
    updates.strawmanPreviewUrl = url
    updates.strawmanPresentationId = id
  } else {
    updates.finalPresentationUrl = url
    updates.finalPresentationId = id
  }
  return updates
}

const VERSIONS = ['blank', 'strawman', 'final', null, undefined]
const URLS = ['https://layout.example/p/blank-1', null, undefined]
const IDS = ['blank-1', null, undefined]

function run(sources) {
  const failures = []
  let checks = 0
  const check = (fn, ...args) => {
    checks++
    try { fn(...args) } catch (error) { failures.push(String(args[args.length - 1] ?? error.message).slice(0, 200) + ' :: ' + error.message.split('\n')[0]) }
  }
  let off, on, ownership, lifecycle
  try {
    off = load(sources, 'lib/studio-blank-deck-reload.ts', {})
    on = load(sources, 'lib/studio-blank-deck-reload.ts', { [FLAG]: 'true' })
    const offFalse = load(sources, 'lib/studio-blank-deck-reload.ts', { [FLAG]: 'false' })
    const offTrueish = load(sources, 'lib/studio-blank-deck-reload.ts', { [FLAG]: '1' })
    ownership = load(sources, 'lib/builder-presentation-ownership.ts', {})
    lifecycle = load(sources, 'lib/studio-canvas-lifecycle.ts', {})
    check(assert.equal, off.STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, false, 'flag unset -> off')
    check(assert.equal, offFalse.STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, false, 'flag "false" -> off')
    check(assert.equal, offTrueish.STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, false, 'flag "1" -> off (exact "true" only)')
    check(assert.equal, on.STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, true, 'flag "true" -> on')
  } catch (error) {
    return { checks, failures: [...failures, 'module load failed: ' + error.message] }
  }

  // ---- 1. slot helper
  const now = '2026-10-13T00:00:00.000Z'
  const legacy = [], helperOff = [], helperOn = []
  for (const v of VERSIONS) for (const url of URLS) for (const id of IDS) {
    const before = legacyUpdates(3, now, v, url, id)
    const offUpdates = { slideCount: 3, lastMessageAt: now, ...off.deckSlotUpdates(off.STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, v, url, id) }
    const onUpdates = { slideCount: 3, lastMessageAt: now, ...on.deckSlotUpdates(on.STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, v, url, id) }
    legacy.push(JSON.stringify(before)); helperOff.push(JSON.stringify(offUpdates)); helperOn.push(JSON.stringify(onUpdates))
    check(assert.deepEqual, Object.keys(offUpdates), Object.keys(before), `flag off, ${v}: same keys in the same order`)
    check(assert.equal, JSON.stringify(offUpdates), JSON.stringify(before), `flag off, ${v}/${url}/${id}: PATCH body bytes identical`)
    if (v === 'blank') {
      check(assert.deepEqual, Object.keys(onUpdates), ['slideCount', 'lastMessageAt', 'blankPresentationUrl', 'blankPresentationId'], 'flag on, blank: blank slots, URL then id')
      check(assert.equal, 'finalPresentationUrl' in onUpdates || 'finalPresentationId' in onUpdates, false, 'flag on, blank: never the final slots')
      check(assert.equal, onUpdates.blankPresentationUrl, url, 'flag on, blank: the URL as given')
      check(assert.equal, onUpdates.blankPresentationId, id, 'flag on, blank: the id as given')
    } else {
      check(assert.equal, JSON.stringify(onUpdates), JSON.stringify(before), `flag on, ${v}: unchanged (strawman/final)`)
    }
  }
  check(assert.equal, hash(helperOff), hash(legacy), 'flag off: the whole matrix hashes identical to the inline branches')
  check(assert.notEqual, hash(helperOn), hash(legacy), 'flag on: the matrix differs (blank rows only)')

  // ---- 2. reconcile write gate: whether a reconcile that already decided to run saves Layout's count to the row
  for (const v of VERSIONS) for (const layout of [0, 1, 2, 7]) {
    check(assert.equal, off.shouldPersistLayoutCount(off.STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, v, layout), true, `flag off, ${v} layout ${layout}: always saved, as before`)
    const expected = !(v === 'blank' && layout <= 1)
    check(assert.equal, on.shouldPersistLayoutCount(on.STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, v, layout), expected, `flag on, ${v} layout ${layout}: ${expected ? 'saved' : 'the untouched blank deck is not saved'}`)
  }
  check(assert.equal, on.shouldPersistLayoutCount(false, 'blank', 1), true, 'the gate is inert when the flag argument is false')

  // ---- 3. restore ownership
  const ov = (id, url) => ({ presentationId: id, presentationUrl: url })
  const owns = on.restoreOwnsOverride
  check(assert.equal, owns(null, ov(null, null)), true, 'no override: nothing to retire')
  check(assert.equal, owns(ov('blank-1', 'https://l/p/blank-1'), ov(null, null)), false, 'a restore with no deck owns no override')
  check(assert.equal, owns(ov('blank-1', 'https://l/p/blank-1'), ov(undefined, undefined)), false, 'undefined restored deck: not owned')
  check(assert.equal, owns(ov('blank-1', 'https://l/p/blank-1'), ov('blank-1', 'https://l/p/blank-1')), true, 'same presentation: owned')
  check(assert.equal, owns(ov(null, 'https://l/p/blank-1?sc_refresh=1'), ov('blank-1', null)), true, 'identity by URL when the id is missing')
  check(assert.equal, owns(ov(' blank-1 ', null), ov('blank-1', null)), true, 'ids are trimmed')
  check(assert.equal, owns(ov('manual-1', null), ov('final-2', 'https://l/p/final-2')), false, 'another presentation: not owned')
  check(assert.equal, owns(ov(null, null), ov('final-2', null)), false, 'an override with no identity is never owned by a deck')

  // ---- 4. the P1a sequence through the real ownership + lifecycle modules
  const SID = 'session-1', BLANK_URL = 'https://layout.example/p/blank-1', BLANK_ID = 'blank-1'
  const canvas = (live, override, owner) => {
    const eff = ownership.resolveEffectivePresentation({ livePresentationUrl: live.url, livePresentationId: live.id, liveSlideCount: live.count, override })
    return lifecycle.classifyStudioCanvasLifecycle({
      displayedSessionId: SID, deckOwnerSessionId: owner,
      selected: { presentationId: eff.presentationId, presentationUrl: eff.presentationUrl, activeVersion: live.version, slideCount: eff.slideCount },
      finalPresentationId: live.finalId ?? null, finalPresentationUrl: live.finalUrl ?? null, hasAuthoredStructure: false,
      loading: false, generating: false, phase: 'planning', dismissed: false, connected: true, connecting: false,
    }).mode
  }
  // reload: the hook starts from the tab cache (the blank deck, owned); the reconcile reads Layout (1 slide) against slideCount null
  const cached = { url: BLANK_URL, id: BLANK_ID, count: null, version: 'blank' }
  // the page's reconcile: the comparison and override are today's; the write goes through the gate and the slot helper
  const reconcile = mod => {
    if (!(1 > Math.max(0, cached.count ?? 0))) return { override: null, write: null }
    const override = { presentationUrl: BLANK_URL, presentationId: BLANK_ID, slideCount: 1, refreshToken: 1 }
    const write = mod.shouldPersistLayoutCount(mod.STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, cached.version, 1)
      ? { slideCount: 1, ...mod.deckSlotUpdates(mod.STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, cached.version, BLANK_URL, BLANK_ID) } : null
    return { override, write }
  }
  const restoredNoDeck = { url: null, id: null, count: null, version: 'final' }  // the row read before any deck write
  const restoredBlank = { url: BLANK_URL, id: BLANK_ID, count: 1, version: 'blank' }  // the row after the first-message flush
  {
    const { override, write } = reconcile(off)
    check(assert.ok, override, 'flag off: the reconcile sets an override for the blank deck')
    check(assert.deepEqual, write, { slideCount: 1, finalPresentationUrl: BLANK_URL, finalPresentationId: BLANK_ID }, 'flag off: and saves the blank deck as the FINAL deck (the P1a write)')
    check(assert.equal, canvas(restoredNoDeck, override, null), 'awaiting_owner', 'flag off: restore with no deck + surviving override = awaiting_owner (the stuck spinner)')
  }
  {
    const { override, write } = reconcile(on)
    check(assert.ok, override, 'flag on: the display override is set exactly as before (the canvas before a reload is unchanged)')
    check(assert.equal, write, null, 'flag on: the untouched blank deck is never saved (no final slots, no write)')
    const kept = on.restoreOwnsOverride(override, { presentationId: restoredNoDeck.id, presentationUrl: restoredNoDeck.url }) ? override : null
    check(assert.equal, kept, null, 'flag on: a restore with no deck retires the override it does not own')
    check(assert.notEqual, canvas(restoredNoDeck, kept, null), 'awaiting_owner', 'flag on: never awaiting_owner after a restore with no deck')
    const keptOwned = on.restoreOwnsOverride(override, { presentationId: restoredBlank.id, presentationUrl: restoredBlank.url }) ? override : null
    check(assert.equal, keptOwned, override, 'flag on + first-message flush: the restored blank deck owns the override (kept: it only decorates it)')
    check(assert.equal, canvas(restoredBlank, keptOwned, SID), 'blank', 'flag on: the canvas is the owned blank deck (the blank canvas survives the reload)')
    check(assert.equal, canvas(restoredBlank, null, SID), 'blank', 'flag on: also when the reconcile had not run yet')
    const added = on.shouldPersistLayoutCount(true, 'blank', 3) ? { slideCount: 3, ...on.deckSlotUpdates(true, 'blank', BLANK_URL, BLANK_ID) } : null
    check(assert.deepEqual, added, { slideCount: 3, blankPresentationUrl: BLANK_URL, blankPresentationId: BLANK_ID }, 'flag on: slides added on the blank canvas are saved to the BLANK slots')
  }

  // ---- 5. page wiring
  const page = sources['app/builder/page.tsx']
  check(assert.match, sources['lib/studio-blank-deck-reload.ts'], /process\.env\.NEXT_PUBLIC_STUDIO_BLANK_DECK_RELOAD_FIX === 'true'/, 'the flag is read as the literal env name (inlined by the build), exact "true"')
  check(assert.match, page, /import \{\s*STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED,\s*deckSlotUpdates,\s*restoreOwnsOverride,\s*shouldPersistLayoutCount,\s*\} from '@\/lib\/studio-blank-deck-reload'/, 'the page imports the module')
  check(assert.equal, (page.match(/\.\.\.deckSlotUpdates\(STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, /g) || []).length, 4, 'one helper at all four slide-count sites')
  check(assert.equal, (page.match(/updates\.finalPresentationUrl = /g) || []).length, 1, 'the only inline final-slot write left is Director\'s stage-6 onSessionStateChange')
  check(assert.match, page, /updates\.finalPresentationUrl = state\.presentationUrl/, 'and that one is untouched')
  check(assert.equal, (page.match(/updates\.strawmanPreviewUrl = /g) || []).length, 1, 'the only inline strawman write left is Director\'s stage-4 onSessionStateChange')
  for (const [version, url, id] of [['latest.activeVersion', 'nextPresentationUrl', 'targetPresentationId'], ['activeVersion', 'nextPresentationUrl', 'effectivePresentationId'], ['activeVersion', 'targetPresentationUrl', 'targetPresentationId']]) {
    check(assert.ok, page.includes(`...deckSlotUpdates(STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, ${version}, ${url}, ${id}),`), `a site passes the same version/URL/id it wrote before (${version}, ${url}, ${id})`)
  }
  {
    const effectAt = page.indexOf('const reconcileKey = `${effectivePresentationId}:${localSlideCount}`')
    const effect = page.slice(effectAt, page.indexOf('const currentSlideLayout = useMemo', effectAt))
    check(assert.ok, effectAt > 0 && effect.length > 500, 'found the reconcile effect')
    check(assert.match, effect, /if \(cancelled \|\| !presentation \|\| presentation\.slideCount <= localSlideCount\) return/, 'the reconcile comparison is untouched')
    check(assert.match, effect, /setSlideComposerOverride\(nextOverride\)\s*\n\s*\n\s*\/\/ [^\n]*\n\s*if \(currentSessionIdRef\.current && persistenceRef\.current\s*\n\s*&& shouldPersistLayoutCount\(STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, activeVersion, presentation\.slideCount\)\) \{/, 'the override is set as before; only the write is gated')
    check(assert.match, effect, /\.\.\.deckSlotUpdates\(STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, activeVersion, nextPresentationUrl, effectivePresentationId\)/, 'and saves through the helper')
    check(assert.match, effect, /\n  \}, \[\s*activeVersion,/, 'activeVersion is (still) a dependency of the effect')
  }
  {
    const at = page.indexOf('const blankDeckRestoreReceiptRef = useRef<unknown>(null)')
    const block = page.slice(at, page.indexOf('// Text Labs session', at))
    check(assert.ok, at > page.indexOf('const session = useBuilderSession({'), 'the restore-commit effect sits after the session hook')
    check(assert.match, block, /if \(!STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED\) return\s*\n\s*const receipt = session\.studioFrontendTranscriptReceipt\s*\n\s*if \(!receipt \|\| blankDeckRestoreReceiptRef\.current === receipt\) return\s*\n\s*blankDeckRestoreReceiptRef\.current = receipt\s*\n\s*if \(restoreOwnsOverride\(slideComposerOverride, \{ presentationId, presentationUrl \}\)\) return\s*\n\s*setSlideComposerOverride\(null\)\s*\n\s*clearSlideComposerWork\(\)/, 'once per restore commit: retire an override the restored deck does not own (flag on only)')
    check(assert.match, block, /\}, \[clearSlideComposerWork, presentationId, presentationUrl, session\.studioFrontendTranscriptReceipt, slideComposerOverride\]\)/, 'with its full dependencies')
  }
  {
    // The flush runs when the first-message save has created the row: handleSendMessage is the only writer of createdDirectorSessionRef
    // (after the row id is verified) and is itself untouched (scripts/test-studio-blocked-send-feedback.mjs pins it textually).
    check(assert.equal, (page.match(/createdDirectorSessionRef\.current = /g) || []).length, 1, 'createdDirectorSessionRef has exactly one writer')
    const send = page.slice(page.indexOf('// For unsaved sessions, create database session first'), page.indexOf('const success = await sendTypedTurn({', page.indexOf('// For unsaved sessions, create database session first')))
    check(assert.ok, send.indexOf('createdDirectorSessionRef.current = { id: dbSession.id') > send.indexOf('if (dbSession.id !== newSessionId)'), 'and it writes only after the created row id is verified')
    check(assert.doesNotMatch, page.slice(page.indexOf('const handleSendMessage = useCallback'), page.indexOf('const handleCancelManualDeckBuild')), /BLANK_DECK_RELOAD|sendDeferredMetadata/, 'handleSendMessage itself is untouched')
    check(assert.match, page, /\n  useEffect\(\(\) => \{\n    if \(!STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED \|\| isUnsavedSession \|\| !currentSessionId\) return\n    if \(createdDirectorSessionRef\.current\?\.id !== currentSessionId\) return\n    void persistenceRef\.current\.sendDeferredMetadata\(currentSessionId\)\n  \}, \[currentSessionId, isUnsavedSession\]\)/, 'once the first-message save made the session saved, the held blank-deck metadata is sent (flag on only, that session only)')
    const at = page.indexOf('void persistenceRef.current.sendDeferredMetadata(currentSessionId)')
    check(assert.ok, at > page.indexOf('const createdDirectorSessionRef = useRef') && at > page.indexOf('persistenceRef.current = persistence'), 'declared after the ref and the persistence-ref sync effect (which runs first in the same commit)')
  }
  check(assert.doesNotMatch, sources['hooks/use-deckster-websocket-v2.ts'], /BLANK_DECK_RELOAD|studio-blank-deck-reload/, 'no WebSocket hook change')
  check(assert.match, sources['hooks/use-session-persistence.ts'], /if \(!STUDIO_SESSION_HYGIENE_ENABLED\) return;\s*\n\s*const held = takeDeferredMetadata\(deferredMetadataRef\.current, forSessionId\);/, 'the flush reuses the hygiene hook\'s send-once (inert without a held blank deck)')
  check(assert.match, sources['.env.example'], /^NEXT_PUBLIC_STUDIO_BLANK_DECK_RELOAD_FIX="false"$/m, '.env.example documents the flag, default "false"')
  check(assert.equal, JSON.parse(sources['package.json']).scripts['test:studio-blank-deck-reload'], 'node scripts/test-studio-blank-deck-reload.mjs', 'package.json runs this suite')
  return { checks, failures }
}

// ---------------------------------------------------------------- run, then mutants
const result = run(SRC)
if (result.failures.length) {
  console.error(`FAIL studio blank-deck reload: ${result.failures.length} of ${result.checks} checks failed\n  - ${result.failures.join('\n  - ')}`)
  process.exit(1)
}

const LIB = 'lib/studio-blank-deck-reload.ts', PAGE = 'app/builder/page.tsx'
const MUTANTS = [
  ['lib: blank deck still written to the final slots', LIB, "if (enabled && activeVersion === 'blank') return { blankPresentationUrl: presentationUrl, blankPresentationId: presentationId }\n", ''],
  ['lib: blank slots written with the flag off', LIB, "if (enabled && activeVersion === 'blank')", "if (activeVersion === 'blank')"],
  ['lib: slot key order changed (id before URL)', LIB, 'return { finalPresentationUrl: presentationUrl, finalPresentationId: presentationId }', 'return { finalPresentationId: presentationId, finalPresentationUrl: presentationUrl }'],
  ['lib: the gate saves the untouched blank deck', LIB, "return !(enabled && activeVersion === 'blank' && layoutSlideCount <= 1)", 'return true'],
  ['lib: the gate applies with the flag off', LIB, "return !(enabled && activeVersion === 'blank' && layoutSlideCount <= 1)", "return !(activeVersion === 'blank' && layoutSlideCount <= 1)"],
  ['lib: the gate also drops added slides', LIB, "return !(enabled && activeVersion === 'blank' && layoutSlideCount <= 1)", "return !(enabled && activeVersion === 'blank')"],
  ['lib: a restore with no deck owns every override', LIB, 'return Boolean(restoredIdentity) && identity(', 'return !restoredIdentity || identity('],
  ['lib: ownership ignores identity', LIB, 'return Boolean(restoredIdentity) && identity(override.presentationId, override.presentationUrl) === restoredIdentity', 'return Boolean(restoredIdentity)'],
  ['lib: flag read loosely', LIB, "process.env.NEXT_PUBLIC_STUDIO_BLANK_DECK_RELOAD_FIX === 'true'", "Boolean(process.env.NEXT_PUBLIC_STUDIO_BLANK_DECK_RELOAD_FIX)"],
  ['page: reconcile write gate removed', PAGE, '\n        && shouldPersistLayoutCount(STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, activeVersion, presentation.slideCount)) {', ') {'],
  ['page: the pristine blank deck gets no override (canvas before a reload changes)', PAGE, 'if (cancelled || !presentation || presentation.slideCount <= localSlideCount) return', "if (cancelled || !presentation || presentation.slideCount <= (STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED && activeVersion === 'blank' ? Math.max(localSlideCount, 1) : localSlideCount)) return"],
  ['page: one site back to the inline final write', PAGE, '...deckSlotUpdates(STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED, activeVersion, targetPresentationUrl, targetPresentationId),', 'finalPresentationUrl: targetPresentationUrl, finalPresentationId: targetPresentationId,'],
  ['page: restore commit no longer retires the override', PAGE, '    setSlideComposerOverride(null)\n    clearSlideComposerWork()\n  }, [clearSlideComposerWork, presentationId', '  }, [clearSlideComposerWork, presentationId'],
  ['page: restore-commit effect runs with the flag off', PAGE, '    if (!STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED) return\n    const receipt', '    const receipt'],
  ['page: first-message flush removed', PAGE, '    void persistenceRef.current.sendDeferredMetadata(currentSessionId)\n', ''],
  ['page: first-message flush with the flag off', PAGE, 'if (!STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED || isUnsavedSession || !currentSessionId) return', 'if (isUnsavedSession || !currentSessionId) return'],
  ['page: flush for any saved session, not the first-message one', PAGE, '    if (createdDirectorSessionRef.current?.id !== currentSessionId) return\n', ''],
  ['page: flush while the session is still unsaved', PAGE, 'if (!STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED || isUnsavedSession || !currentSessionId) return', 'if (!STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED || !currentSessionId) return'],
  ['page: handleSendMessage edited', PAGE, '            session.justCreatedSessionRef.current = dbSession.id\n', '            if (STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED) void persistence.sendDeferredMetadata(dbSession.id)\n            session.justCreatedSessionRef.current = dbSession.id\n'],
]
let caught = 0
const survivors = []
for (const [name, rel, from, to] of MUTANTS) {
  assert.ok(SRC[rel].includes(from), `mutant "${name}": anchor not found in ${rel}`)
  const mutated = run({ ...SRC, [rel]: SRC[rel].replace(from, to) })
  if (mutated.failures.length) caught++
  else survivors.push(name)
}
if (survivors.length) {
  console.error(`FAIL studio blank-deck reload: ${survivors.length} mutant(s) survived\n  - ${survivors.join('\n  - ')}`)
  process.exit(1)
}
console.log(`studio blank-deck reload: ${result.checks} checks passed; ${caught}/${MUTANTS.length} mutants caught`)
