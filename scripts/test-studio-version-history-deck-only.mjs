// FRONTEND-2: the profile menu's Version history row shows only while a deck is on stage (flag NEXT_PUBLIC_STUDIO_VERSION_HISTORY_DECK_ONLY, exact
// "true", default off, build-time). The finding (E2E-2, Studio dev, 24 Oct, finding F5): on the empty Builder (/builder?session_id=new, no deck) the profile
// menu showed "Version history" and choosing it only closed the menu. The design (#456) shows the row only while a deck is on screen.
//
// Cause. The row is shown by the bridge (lib/studio-version-history-v2.ts): the viewer registers its panel opener as soon as it has a deck URL
// (components/presentation-viewer.tsx, approvedIframeNavigationUrl). On a new session the Builder keeps that viewer mounted with a blank deck BEHIND the welcome
// stage (the canvas lifecycle's single landing decision, showLanding, puts the welcome up over it), so the opener exists while no deck is on stage; choosing the row
// opens a panel nobody can see. The viewer's own rule ("a deck URL exists") is not "a deck is on stage".
// Fix. The page already holds the on-stage decision (studioWelcome = studioShell && !studioPartialMetadata && studioCanvasLifecycle.showLanding). With the flag on it
// hands that to hooks/use-studio-version-history-deck-only.ts, which tells the bridge (setCovered) while the welcome is up: isAvailable() is false (no row) and open()
// refuses. The viewer, the profile menu and the row's own file are untouched. Off: the hook does nothing, the bridge is never told.
//
//   node scripts/test-studio-version-history-deck-only.mjs              # everything, offline, plain node (transpile + vm; no network, no build, no browser)
//   node scripts/test-studio-version-history-deck-only.mjs --no-mutants
//
// What it proves:
//  1. the REAL lib bridge, the REAL hook and the REAL menu row (components/version-history-menu-item.tsx), rendered with the repo's mini React host and driven through one
//     script of the page's states (no viewer; the viewer under the welcome; a deck on stage; a new session's welcome while the old viewer is still registered; the viewer
//     leaving; the page unmounting): flag on, the row is absent under the welcome and present with a deck, and choosing it opens the panel; the same script with the flag
//     off (unset and eight other spellings) is byte-identical (sha256 of the transcript) to the BASE code (BASE_COMMIT's lib, no hook), which still shows the row under the welcome;
//  2. the bridge on its own: setCovered hides, refuses open() without calling the opener, notifies subscribers once per change, never changes anything when it is never called;
//  3. the page's on-stage signal: the REAL classifier (lib/studio-canvas-lifecycle.ts) says "landing" for the empty Builder (a blank deck behind it) and "not landing" for a
//     generated deck, an authored one, the chosen blank canvas, a build, a loading session; the page's own studioWelcome expression is evaluated on those;
//  4. the strip module gives back BASE_COMMIT's files byte for byte, the three shared strip roots chain it, the page / .env.example / STACKED_PASS3_FILES pieces, and the
//     env block's wording does not contain a phrase FRONTEND-1's .env.example mutants replace;
//  5. a strict secret scan of every line this change adds;
//  6. mutants, each caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { Root, hostNodes, textOf } from './studio-chat-harness/mini-react.mjs'
import { createEnvironment } from './studio-chat-harness/fake-env.mjs'
import { createModuleLoader } from './studio-chat-harness/module-loader.mjs'
import { BASE_ENV } from './studio-chat-harness/profiles.mjs'
import { BASE_COMMIT, VERSION_HISTORY_DECK_ONLY_FILES, VERSION_HISTORY_DECK_ONLY_NEW_FILES, VERSION_HISTORY_DECK_ONLY_CHANGES, stripVersionHistoryDeckOnly } from './studio-version-history-deck-only-strip.mjs'
import { stripComposeEntitlement } from './studio-compose-entitlement-strip.mjs' // stacked: #494, after this change
import { stripPublishPreviewInventory } from './studio-publish-preview-inventory-strip.mjs' // stacked: #495, after this change
import { stripPaymentsOpenSoon } from './studio-payments-open-soon-strip.mjs' // stacked: payments open soon (billing), after #495 in the stack
import { stripDuplicateCopyTitle } from './studio-duplicate-copy-title-strip.mjs' // stacked: duplicate copy title (the Decks page's copy title and the copy's header), after #496 in the stack
import { stripThumbnailLastGood } from './studio-thumbnail-last-good-strip.mjs' // stacked: thumbnail last good (the Studio half of "never blank": a rail card's last good preview and the Publish preview's fallback), after duplicate copy title in the stack
import { stripBulkEditUndo } from './studio-bulk-edit-undo-strip.mjs' // stacked: bulk edit + chat undo (NEXT_PUBLIC_STUDIO_BULK_EDIT / NEXT_PUBLIC_STUDIO_CHAT_UNDO: a whole-deck edit card and an Undo chip in chat), after thumbnail last good in the stack
import { stripOpenReadOnly } from './studio-open-read-only-strip.mjs'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { STACKED_PASS3_FILES } from './studio-library-manage-harness.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
const baseFile = rel => git('show', `${BASE_COMMIT}:${rel}`)
const NO_MUTANTS = process.argv.includes('--no-mutants')

const FLAG = 'NEXT_PUBLIC_STUDIO_VERSION_HISTORY_DECK_ONLY'
const V2_FLAG = 'NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2'
const LIB = 'lib/studio-version-history-v2.ts'
const HOOK = 'hooks/use-studio-version-history-deck-only.ts'
const ITEM = 'components/version-history-menu-item.tsx'
const LIFECYCLE = 'lib/studio-canvas-lifecycle.ts'
const PAGE = 'app/builder/page.tsx'
const AREA = 'components/builder/presentation-area.tsx'
const ENV = '.env.example'

let checks = 0
const failures = []
let sink = null // a mutant run: a failing check is recorded here, quietly
async function check(label, fn) {
  if (sink) { try { await fn() } catch { sink.push(label) } return }
  try { await fn(); checks++; console.log(`PASS ${label}`) } catch (error) { failures.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 4).join(' | ') ?? error}`) }
}

/** Read the files of `texts` as given while `fn` loads modules (the harness loader reads from disk): runs a mutant, or the base lib. */
function withFileTexts(texts, fn) {
  const targets = new Map(Object.entries(texts).filter(([, text]) => typeof text === 'string').map(([rel, text]) => [path.join(root, rel), text]))
  const original = fs.readFileSync
  fs.readFileSync = function (file, ...rest) { const hit = targets.get(path.resolve(String(file))); return hit !== undefined ? hit : original.call(this, file, ...rest) }
  try { return fn() } finally { fs.readFileSync = original }
}
function mutate(rel, from, to, text = read(rel)) {
  assert.equal(text.split(from).length - 1, 1, `${rel}: the mutant's text occurs once: ${JSON.stringify(from.slice(0, 70))}`)
  return text.replace(from, () => to)
}

// ---- 1. the real bridge, hook and row, driven through one script ----------------------------------------------------------------------
const icon = name => () => React.createElement('svg', { 'data-icon': name })
const MENU_STUBS = { 'lucide-react': { ChevronRight: icon('chevron'), History: icon('history') } }
const MENU_FILE_STUBS = { 'components/ui/dropdown-menu': { DropdownMenuItem: props => React.createElement('menuitem', props) } }

/**
 * One run of the page's states. `callHook: false` is the base code (no hook, no call). Returns the transcript: for each step the rows the menu shows, whether the bridge says a
 * deck is on screen, and how many times the viewer's opener ran.
 */
async function run({ flag, texts = {}, callHook = true, v2 = 'true' } = {}) {
  const processEnv = { ...BASE_ENV, ...(v2 === undefined ? {} : { [V2_FLAG]: v2 }), ...(flag === undefined ? {} : { [FLAG]: flag }) }
  const env = createEnvironment({ processEnv })
  const loader = createModuleLoader({ root, globals: env.globals, stubs: { react: React, ...MENU_STUBS }, fileStubs: MENU_FILE_STUBS })
  const mods = withFileTexts(texts, () => ({ lib: loader.load(LIB), item: loader.load(ITEM), hook: loader.load(HOOK) }))
  const bridge = mods.lib.versionHistoryBridge
  const state = { welcome: false }
  const heard = []
  bridge.subscribe(() => heard.push(bridge.isAvailable()))
  function Unit() {
    if (callHook) mods.hook.useStudioVersionHistoryDeckOnly(state.welcome)
    return React.createElement(mods.item.VersionHistoryMenuItem, { chevron: true })
  }
  const rootNode = new Root()
  // The mini host does not subscribe a useSyncExternalStore; the real one re-renders the row when the bridge tells its subscribers (checked in the bridge checks), so each step renders twice.
  const render = async () => { for (let pass = 0; pass < 2; pass++) { rootNode.setElement(React.createElement(Unit)); rootNode.flush(); await env.macrotask() } }
  const rows = () => hostNodes(rootNode.tree).filter(node => node.type === 'menuitem')
  let opened = 0
  let unregister = null
  const transcript = []
  const snap = label => transcript.push({ label, rows: rows().map(node => ({ text: textOf(node), chevron: hostNodes(node).some(n => n.props && n.props['data-icon'] === 'chevron') })), onScreen: bridge.isAvailable(), opened })
  const choose = () => { const [row] = rows(); if (row) row.props.onSelect() }
  await render(); snap('menu opened on a page with no viewer')
  unregister = bridge.register(() => { opened++ }); state.welcome = true; await render(); snap('viewer mounted behind the welcome (the empty Builder)')
  choose(); snap('the row is chosen under the welcome')
  state.welcome = false; await render(); snap('a deck is on stage')
  choose(); snap('the row is chosen with a deck')
  state.welcome = true; await render(); snap('a new session: the welcome is up, the old viewer still registered')
  const refused = bridge.open(); transcript.push({ label: 'open() while the welcome is up', returned: refused, opened })
  state.welcome = false; await render(); snap('a deck is on stage again')
  unregister(); await render(); snap('the viewer leaves')
  unregister = bridge.register(() => { opened++ }); state.welcome = true; await render(); snap('a viewer again, behind the welcome')
  rootNode.unmount(); snap('the page unmounts')
  transcript.push({ label: 'subscribers heard', heard })
  return transcript
}
const hash = transcript => sha(JSON.stringify(plain(transcript)))
const ROW = { text: 'Version history', chevron: true }
const EXPECTED_ON = [
  { label: 'menu opened on a page with no viewer', rows: [], onScreen: false, opened: 0 },
  { label: 'viewer mounted behind the welcome (the empty Builder)', rows: [], onScreen: false, opened: 0 },
  { label: 'the row is chosen under the welcome', rows: [], onScreen: false, opened: 0 },
  { label: 'a deck is on stage', rows: [ROW], onScreen: true, opened: 0 },
  { label: 'the row is chosen with a deck', rows: [ROW], onScreen: true, opened: 1 },
  { label: 'a new session: the welcome is up, the old viewer still registered', rows: [], onScreen: false, opened: 1 },
  { label: 'open() while the welcome is up', returned: false, opened: 1 },
  { label: 'a deck is on stage again', rows: [ROW], onScreen: true, opened: 1 },
  { label: 'the viewer leaves', rows: [], onScreen: false, opened: 1 },
  { label: 'a viewer again, behind the welcome', rows: [], onScreen: false, opened: 1 },
  { label: 'the page unmounts', rows: [], onScreen: true, opened: 1 },
  // what the bridge told its subscribers (the real row re-renders from these): the viewer registers, the welcome covers it, the deck uncovers, a new session covers, a deck uncovers,
  // the viewer leaves, registers again, the welcome covers it, the page unmounts and uncovers
  { label: 'subscribers heard', heard: [true, false, true, false, true, false, true, false, true] },
]

async function scenarioChecks() {
  await check('flag on: no row behind the welcome, the row with a deck (and it opens the panel), no row when the viewer leaves, the page unmounting uncovers', async () => {
    const t = await run({ flag: 'true' })
    assert.deepEqual(plain(t), EXPECTED_ON)
  })
  await check('flag off (unset, and eight other spellings): byte-identical to the BASE code, which still shows the row behind the welcome', async () => {
    const baseLib = baseFile(LIB)
    const base = await run({ flag: undefined, callHook: false, texts: { [LIB]: baseLib } })
    assert.equal(base.find(s => s.label.startsWith('viewer mounted behind')).rows.length, 1, 'the base shows the row on the empty Builder (the finding)')
    const baseHash = hash(base)
    for (const flag of [undefined, '', 'false', 'TRUE', 'True', '1', ' true', 'true ', 'yes']) {
      const off = await run({ flag })
      assert.equal(hash(off), baseHash, `flag ${JSON.stringify(flag)}: the transcript equals the base's`)
      assert.equal(off.filter(s => 'rows' in s).length, base.filter(s => 'rows' in s).length)
    }
    console.log(`flag-off transcript sha256 ${baseHash.slice(0, 16)} == base`)
  })
  await check('flag on with the Version history flag off: the row is not there at all (the row\'s own flag decides first)', async () => {
    const t = await run({ flag: 'true', v2: '' })
    assert.ok(t.filter(s => 'rows' in s).every(s => s.rows.length === 0))
  })
  await check('hook: the flag is the exact value "true" read as a build-time literal, once, in the hook only', async () => {
    const mod = async flag => {
      const env = createEnvironment({ processEnv: { ...BASE_ENV, ...(flag === undefined ? {} : { [FLAG]: flag }) } })
      return createModuleLoader({ root, globals: env.globals, stubs: { react: React } }).load(HOOK)
    }
    assert.equal((await mod('true')).STUDIO_VERSION_HISTORY_DECK_ONLY_ENABLED, true)
    for (const flag of [undefined, '', 'false', 'TRUE', 'True', '1', ' true', 'true ', 'yes']) assert.equal((await mod(flag)).STUDIO_VERSION_HISTORY_DECK_ONLY_ENABLED, false, JSON.stringify(flag))
    assert.ok(read(HOOK).includes(`process.env.${FLAG} === 'true'`))
    const holders = git('grep', '--untracked', '-l', '-F', `process.env.${FLAG}`, '--', 'app', 'components', 'lib', 'hooks').split('\n').filter(Boolean)
    assert.deepEqual(holders, [HOOK], 'one place reads the flag')
    assert.doesNotMatch(read(LIB) + read(ITEM) + read(PAGE), new RegExp(`process\\.env\\.${FLAG}`), 'the lib, the row and the page read it through the hook')
  })
}

// ---- 2. the bridge alone ---------------------------------------------------------------------------------------------------------------
async function bridgeChecks(texts = {}) {
  const env = createEnvironment({ processEnv: { ...BASE_ENV, [V2_FLAG]: 'true' } })
  const lib = withFileTexts(texts, () => createModuleLoader({ root, globals: env.globals, stubs: { react: React } }).load(LIB))
  await check('bridge: never told, it is what it was (register, open, unregister, a stale unregister, subscribers)', () => {
    const bridge = lib.createVersionHistoryBridge()
    const heard = []
    bridge.subscribe(() => heard.push(bridge.isAvailable()))
    assert.equal(bridge.isAvailable(), false)
    assert.equal(bridge.open(), false)
    let calls = 0
    const first = bridge.register(() => { calls++ })
    assert.equal(bridge.isAvailable(), true)
    assert.equal(bridge.open(), true)
    assert.equal(calls, 1)
    const second = bridge.register(() => { calls += 10 })
    first()
    assert.equal(bridge.isAvailable(), true, 'a stale unregister leaves the newer opener')
    second()
    assert.equal(bridge.isAvailable(), false)
    assert.deepEqual(heard, [true, true, false])
  })
  await check('bridge: setCovered hides the row and refuses open() without calling the opener; uncovered, it is back; the opener is kept while covered', () => {
    const bridge = lib.createVersionHistoryBridge()
    let calls = 0
    bridge.register(() => { calls++ })
    bridge.setCovered(true)
    assert.equal(bridge.isAvailable(), false)
    assert.equal(bridge.open(), false)
    assert.equal(calls, 0, 'the panel is not opened behind the welcome')
    bridge.setCovered(false)
    assert.equal(bridge.isAvailable(), true)
    assert.equal(bridge.open(), true)
    assert.equal(calls, 1)
  })
  await check('bridge: covered with no viewer stays unavailable; a viewer that registers while covered is not on screen until it is uncovered', () => {
    const bridge = lib.createVersionHistoryBridge()
    bridge.setCovered(true)
    assert.equal(bridge.isAvailable(), false)
    const unregister = bridge.register(() => {})
    assert.equal(bridge.isAvailable(), false)
    bridge.setCovered(false)
    assert.equal(bridge.isAvailable(), true)
    unregister()
    assert.equal(bridge.isAvailable(), false)
  })
  await check('bridge: subscribers are told once per real change, not for a repeat', () => {
    const bridge = lib.createVersionHistoryBridge()
    let told = 0
    bridge.subscribe(() => { told++ })
    bridge.setCovered(false); assert.equal(told, 0)
    bridge.setCovered(true); assert.equal(told, 1)
    bridge.setCovered(true); assert.equal(told, 1)
    bridge.setCovered(false); assert.equal(told, 2)
  })
}

// ---- 3. the page's own on-stage signal ----------------------------------------------------------------------------------------------------
async function signalChecks() {
  const env = createEnvironment({ processEnv: { ...BASE_ENV } })
  const { classifyStudioCanvasLifecycle } = createModuleLoader({ root, globals: env.globals, stubs: { react: React } }).load(LIFECYCLE)
  const page = read(PAGE)
  const expression = page.match(/^  const studioWelcome = (.+)$/m)?.[1]
  assert.ok(expression, "the page's studioWelcome line")
  const welcome = (studioShell, studioPartialMetadata, studioCanvasLifecycle) => new Function('studioShell', 'studioPartialMetadata', 'studioCanvasLifecycle', `return ${expression}`)(studioShell, studioPartialMetadata, studioCanvasLifecycle)
  const base = {
    displayedSessionId: 's1', deckOwnerSessionId: 's1',
    selected: { presentationId: 'p1', presentationUrl: 'https://layout.synthetic.invalid/p/p1', activeVersion: 'blank', slideCount: null },
    finalPresentationId: null, finalPresentationUrl: null, hasAuthoredStructure: false, loading: false, generating: false, phase: 'idle', dismissed: false, connected: true, connecting: false,
  }
  const generated = { ...base, selected: { ...base.selected, activeVersion: 'final', slideCount: 7 }, finalPresentationId: 'p1', finalPresentationUrl: base.selected.presentationUrl }
  const cases = [
    ['the empty Builder: a blank deck is mounted behind the welcome', base, true],
    ['the planning phase with nothing built yet', { ...base, phase: 'planning' }, true],
    ['a generated deck', generated, false],
    ['an authored deck', { ...base, hasAuthoredStructure: true }, false],
    ['the blank canvas once it is chosen (dismissed)', { ...base, dismissed: true }, false],
    ['a build in progress', { ...base, generating: true }, false],
    ['the building phase', { ...base, phase: 'building' }, false],
    ['a session that is loading', { ...base, loading: true }, false],
    ['a deck of another session (awaiting its owner)', { ...base, deckOwnerSessionId: 's0' }, false],
  ]
  await check("signal: the page's studioWelcome is true behind the welcome and false whenever a deck, a build or the chosen blank canvas is on stage", () => {
    for (const [label, input, landing] of cases) assert.equal(welcome(true, false, classifyStudioCanvasLifecycle(input)), landing, label)
    assert.equal(welcome(true, true, classifyStudioCanvasLifecycle(base)), false, 'a partial final fill is a deck on stage')
    assert.equal(welcome(false, false, classifyStudioCanvasLifecycle(base)), false, 'outside the Studio shell it is never true')
  })
  await check("signal: the stage puts the welcome up from the same decision (presentation-area's placeholder reads lifecycle.showLanding; the page passes the same lifecycle)", () => {
    const area = read(AREA)
    assert.match(area, /\(legacyBlankPlaceholder && lifecycle\.showLanding\)/)
    assert.match(page, /studioCanvasLifecycle=\{studioShell \? studioCanvasLifecycle : undefined\}/)
    assert.match(page, /const studioWelcome = studioShell && !studioPartialMetadata && studioCanvasLifecycle\.showLanding\n/)
  })
}

// ---- 4. the page, .env.example, the strip -----------------------------------------------------------------------------------------------
function pageChecks(page) {
  const imports = page.match(/^import \{ useStudioVersionHistoryDeckOnly \} from '@\/hooks\/use-studio-version-history-deck-only'$/gm) || []
  assert.equal(imports.length, 1, 'one import')
  const calls = page.match(/^ {2}useStudioVersionHistoryDeckOnly\(studioWelcome\)$/gm) || []
  assert.equal(calls.length, 1, 'one call at the top of the component body, unconditional, fed studioWelcome')
  assert.equal((page.match(/useStudioVersionHistoryDeckOnly\(/g) || []).length, 1, 'no other call')
  const at = page.indexOf('\n  useStudioVersionHistoryDeckOnly(studioWelcome)\n')
  assert.ok(at > page.indexOf('\n  const studioWelcome = '), 'after studioWelcome is defined')
  assert.ok(at < page.indexOf('\n  const handleDismissBlankPlaceholder = '), 'right after it')
}
async function staticChecks() {
  await check('strip: stripping gives back the base files byte for byte; new files are new; every piece is a context-free insertion (one swap, the bridge\'s isAvailable); the three shared strip roots chain it', () => {
    assert.deepEqual([...VERSION_HISTORY_DECK_ONLY_FILES].sort(), [ENV, 'lib/studio-version-history-v2.ts', PAGE].sort())
    for (const rel of VERSION_HISTORY_DECK_ONLY_FILES) {
      assert.notEqual(read(rel), baseFile(rel), `${rel} is changed`)
      let later = false // a later PR's commit on this file after the base: then the stacked rule
      try { later = git('log', '--format=%s', `${BASE_COMMIT}..HEAD`, '--', rel).split('\n').filter(Boolean).some(s => !/version history deck.only|deck.only/i.test(s)) } catch { later = false }
      const stripped = stripVersionHistoryDeckOnly(rel, read(rel))
      if (!later) { assert.equal(sha(stripped), sha(baseFile(rel)), `${rel}: byte for byte`); continue }
      assert.ok(!/VERSION_HISTORY_DECK_ONLY|VersionHistoryDeckOnly|setCovered/.test(stripped), `${rel}: none of this change's text is left (stacked)`)
      let at = 0
      for (const line of baseFile(rel).split('\n')) { const i = stripped.indexOf(line, at); assert.ok(i >= 0, `${rel}: base line kept in order (stacked)`); at = i + line.length }
    }
    assert.equal(stripVersionHistoryDeckOnly('lib/other.ts', 'x'), 'x')
    for (const rel of VERSION_HISTORY_DECK_ONLY_FILES) for (const [added, original] of VERSION_HISTORY_DECK_ONLY_CHANGES[rel]) {
      assert.equal(read(rel).split(added).length, 2, `${rel}: each added piece occurs once`)
      if (rel === 'lib/studio-version-history-v2.ts' && original !== '') assert.equal(original, '    isAvailable: () => opener !== null,\n')
      else assert.equal(original, '', `${rel}: a pure insertion, context-free`)
      assert.match(added, /DECK_ONLY|setCovered|covered/, `${rel}: each piece names the flag or the bridge's cover`)
    }
    for (const rel of VERSION_HISTORY_DECK_ONLY_NEW_FILES) {
      assert.ok(fs.existsSync(path.join(root, rel)), rel)
      assert.throws(() => git('cat-file', '-e', `${BASE_COMMIT}:${rel}`), undefined, `${rel} is new`)
    }
    for (const strip of [stripOpenReadOnly, stripDarkPersist, stripAddSlideStatus]) assert.equal(sha(strip(PAGE, read(PAGE))), sha(strip(PAGE, baseFile(PAGE))), strip.name)
    for (const rootFile of ['scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/studio-add-slide-status-strip.mjs']) {
      const text = read(rootFile)
      assert.equal((text.match(/import \{ stripVersionHistoryDeckOnly \} from '\.\/studio-version-history-deck-only-strip\.mjs'/g) || []).length, 1, `${rootFile}: one import`)
      assert.equal((text.match(/stripVersionHistoryDeckOnly\(rel, (?:stripPublishPreviewInventory\(rel, )?(?:stripPaymentsOpenSoon\(rel, )?(?:stripDuplicateCopyTitle\(rel, )?(?:stripThumbnailLastGood\(rel, )?(?:stripBulkEditUndo\(rel, )?text\)/g) || []).length, 1, `${rootFile}: chained once`)
    }
    assert.ok(STACKED_PASS3_FILES.includes(HOOK) && STACKED_PASS3_FILES.includes(LIB), 'the new hook and the changed lib are in STACKED_PASS3_FILES')
  })
  await check('page: one import and one unconditional call right after studioWelcome', () => pageChecks(read(PAGE)))
  await check(".env.example: documented once, default off, right before # PASS2 ADMIN after the new-deck handoff block; no phrase FRONTEND-1's .env.example mutants replace", () => envChecks(read(ENV)))
}
function envChecks(env) {
  env = stripBulkEditUndo('.env.example', env) // stacked: bulk edit + chat undo's block (the very last in the stack) comes out first
  env = stripThumbnailLastGood('.env.example', env) // stacked: thumbnail last good's block comes out next
  env = stripDuplicateCopyTitle('.env.example', env) // stacked: duplicate copy title's block comes out next
  env = stripPaymentsOpenSoon('.env.example', env) // stacked: payments open soon's block (the last in the stack) comes out first
  env = stripPublishPreviewInventory('.env.example', env) // stacked: #495's block comes out too
  env = stripComposeEntitlement('.env.example', env) // stacked: #494's .env.example block (STUDIO_COMPOSE_ENTITLEMENT_ENABLED) sits between this block and # PASS2 ADMIN; it comes out first
  assert.equal((env.match(new RegExp(`^${FLAG}="false"$`, 'gm')) || []).length, 1)
  assert.ok(env.indexOf(`${FLAG}="false"\n\n# PASS2 ADMIN (FRONTEND-1`) > 0, 'right before # PASS2 ADMIN')
  assert.ok(env.indexOf(`${FLAG}="false"`) > env.indexOf('NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND="false"'), 'after the last FRONTEND-2 block')
  const block = env.slice(env.indexOf('# VERSION HISTORY, DECK ONLY'), env.indexOf(`${FLAG}="false"`) + FLAG.length + 8)
  const phrases = []
  for (const file of fs.readdirSync(path.join(root, 'scripts')).filter(name => /^test-studio-p2-.*\.mjs$|^test-admin-email-guard\.mjs$|^test-studio-route-params\.mjs$/.test(name))) {
    const text = read(`scripts/${file}`)
    for (const m of text.matchAll(/mutant\(ENV,\s*(['"`])((?:\\.|(?!\1).)*)\1,\s*(['"`])((?:\\.|(?!\3).)*)\3/g)) phrases.push([file, m[4]])
  }
  assert.ok(phrases.length > 20, `read ${phrases.length} mutant phrases`)
  for (const [file, phrase] of phrases) if (phrase.length > 6 && !phrase.includes('${')) assert.ok(!block.includes(phrase.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'")), `${file}: a mutant phrase is in this block: ${phrase.slice(0, 60)}`)
}

// ---- 5. a strict secret scan of every added line -----------------------------------------------------------------------------------------
async function secretScan() {
  await check('secrets: no line this change adds carries anything credential-shaped', () => {
    const added = []
    for (const rel of VERSION_HISTORY_DECK_ONLY_FILES) {
      const base = new Set(baseFile(rel).split('\n'))
      for (const line of read(rel).split('\n')) if (!base.has(line)) added.push([rel, line])
    }
    const touched = ['scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/studio-add-slide-status-strip.mjs', 'scripts/studio-library-manage-harness.mjs']
    for (const rel of touched) { const base = new Set(baseFile(rel).split('\n')); for (const line of read(rel).split('\n')) if (!base.has(line)) added.push([rel, line]) }
    for (const rel of VERSION_HISTORY_DECK_ONLY_NEW_FILES) for (const line of read(rel).split('\n')) added.push([rel, line])
    assert.ok(added.length > 100)
    const dash = '-'.repeat(5)
    const rules = [
      ['private key', new RegExp(`${dash}BEGIN [A-Z ]*PRIVATE KEY`)], ['AWS key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/], ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
      ['Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/], ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}/], ['Stripe key', /\b[rs]k_(live|test)_[A-Za-z0-9]{10,}/],
      ['OpenAI / Anthropic style key', /\bsk-[A-Za-z0-9_-]{20,}/], ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./], ['bearer', /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i],
      ['URL with a password', /[a-z]+:\/\/[^\s/:@]+:[^\s/@]+@/i],
      ['an assignment of a secret-named value', /(api[_-]?key|secret|token|passw(or)?d|credential|auth)[A-Za-z_]*["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i],
      ['a long opaque literal (mixed case and digits)', /["'`](?=[A-Za-z0-9+/_=-]*[a-z])(?=[A-Za-z0-9+/_=-]*[A-Z])(?=[A-Za-z0-9+/_=-]*\d)[A-Za-z0-9+/_-]{24,}={0,2}["'`]/],
      ['a long hex literal', /["'`][0-9a-fA-F]{32,}["'`]/],
    ]
    // The only long hex literal is this change's base commit.
    for (const [rel, line] of added) for (const [name, rule] of rules) {
      const hit = line.match(rule)
      if (hit && !hit[0].includes(BASE_COMMIT)) assert.fail(`${rel}: ${name}: ${line.slice(0, 120)}`)
    }
  })
}

// ---- 6. mutants -------------------------------------------------------------------------------------------------------------------------------
async function mutants() {
  const hook = read(HOOK), lib = read(LIB)
  const caughtBy = []
  const missed = []
  async function mutant(name, detect) {
    let caught = false
    try { const result = await detect(); caught = result === true } catch { caught = true }
    ;(caught ? caughtBy : missed).push(name)
    console.log(`${caught ? 'CAUGHT' : 'MISSED'} mutant: ${name}`)
  }
  const differsOn = async (texts, flag = 'true') => hash(await run({ flag, texts })) !== hash(EXPECTED_ON)
  const differsOff = async texts => {
    const base = await run({ flag: undefined, callHook: false, texts: { [LIB]: baseFile(LIB) } })
    return hash(await run({ flag: undefined, texts })) !== hash(base)
  }
  await mutant('the hook never covers the bridge', () => differsOn({ [HOOK]: mutate(HOOK, 'versionHistoryBridge.setCovered(true)', 'void 0', hook) }))
  await mutant('the hook covers whatever is on stage (ignores the welcome)', () => differsOn({ [HOOK]: mutate(HOOK, '!STUDIO_VERSION_HISTORY_DECK_ONLY_ENABLED || !welcomeOnStage', '!STUDIO_VERSION_HISTORY_DECK_ONLY_ENABLED', hook) }))
  await mutant('the hook never uncovers (no cleanup)', () => differsOn({ [HOOK]: mutate(HOOK, '    return () => { versionHistoryBridge.setCovered(false) }\n', '', hook) }))
  await mutant('the hook does not re-run when the welcome changes', () => differsOn({ [HOOK]: mutate(HOOK, '[welcomeOnStage])', '[])', hook) }))
  await mutant('the flag is on for any value but "false"', () => differsOff({ [HOOK]: mutate(HOOK, "=== 'true'", "!== 'false'", hook) }))
  await mutant('the hook ignores the flag (acts with it off)', () => differsOff({ [HOOK]: mutate(HOOK, '!STUDIO_VERSION_HISTORY_DECK_ONLY_ENABLED || !welcomeOnStage', '!welcomeOnStage', hook) }))
  await mutant('the bridge reports the opener while covered', () => differsOn({ [LIB]: mutate(LIB, 'isAvailable: () => opener !== null && !covered', 'isAvailable: () => opener !== null', lib) }))
  const bridgeMutant = async texts => { const bad = []; sink = bad; try { await bridgeChecks(texts) } finally { sink = null } return bad.length > 0 }
  await mutant('the bridge opens while covered', () => bridgeMutant({ [LIB]: mutate(LIB, '      if (covered) return false\n', '', lib) }))
  await mutant('setCovered does not tell the subscribers', () => differsOn({ [LIB]: mutate(LIB, '      covered = next\n      notify()\n', '      covered = next\n', lib) }))
  await mutant('setCovered stores the opposite', () => differsOn({ [LIB]: mutate(LIB, '      covered = next\n', '      covered = !next\n', lib) }))
  await mutant('setCovered tells the subscribers for a repeat', () => bridgeMutant({ [LIB]: mutate(LIB, '      if (covered === next) return\n', '', lib) }))
  const page = read(PAGE)
  await mutant('the page never calls the hook', () => { pageChecks(mutate(PAGE, '  useStudioVersionHistoryDeckOnly(studioWelcome)\n', '', page)); return false })
  await mutant('the page feeds the hook something else', () => { pageChecks(mutate(PAGE, 'useStudioVersionHistoryDeckOnly(studioWelcome)', 'useStudioVersionHistoryDeckOnly(studioShell)', page)); return false })
  await mutant('the page calls the hook conditionally', () => { pageChecks(mutate(PAGE, '  useStudioVersionHistoryDeckOnly(studioWelcome)\n', '  if (studioShell) useStudioVersionHistoryDeckOnly(studioWelcome)\n', page)); return false })
  await mutant('the page calls the hook before studioWelcome exists', () => {
    const moved = mutate(PAGE, '  useStudioVersionHistoryDeckOnly(studioWelcome)\n', '', page).replace('\n  const studioWelcome = ', '\n  useStudioVersionHistoryDeckOnly(studioWelcome)\n  const studioWelcome = ')
    pageChecks(moved); return false
  })
  await mutant('the env example turns it on by default', () => { envChecks(mutate(ENV, `${FLAG}="false"`, `${FLAG}="true"`)); return false })
  await mutant('the env example block moves after # PASS2 ADMIN', () => { const env = read(ENV); const at = env.indexOf('# VERSION HISTORY, DECK ONLY'); const end = env.indexOf('# PASS2 ADMIN'); envChecks(env.slice(0, at) + env.slice(end) + '\n' + env.slice(at, end)); return false })
  await mutant('the strip leaves a piece behind', () => {
    const [, ...rest] = VERSION_HISTORY_DECK_ONLY_CHANGES[PAGE]
    const stripped = rest.reduce((out, [added, original]) => out.replace(added, () => original), read(PAGE))
    assert.equal(sha(stripped), sha(baseFile(PAGE))); return false
  })
  await mutant('the strip drops the bridge swap (isAvailable stays changed)', () => {
    const rest = VERSION_HISTORY_DECK_ONLY_CHANGES[LIB].filter(([, original]) => original === '')
    const stripped = rest.reduce((out, [added, original]) => out.replace(added, () => original), read(LIB))
    assert.equal(sha(stripped), sha(baseFile(LIB))); return false
  })
  console.log(`  mutants: ${caughtBy.length} caught of ${caughtBy.length + missed.length}`)
  assert.equal(missed.length, 0, `mutants missed: ${missed.join('; ')}`)
}

await scenarioChecks()
await bridgeChecks()
await signalChecks()
await staticChecks()
await secretScan()
if (!NO_MUTANTS) await mutants()
if (failures.length) { console.error(`\n${failures.length} FAILED:\n- ${failures.join('\n- ')}`); process.exit(1) }
console.log(`\ntest-studio-version-history-deck-only: ${checks} checks passed${NO_MUTANTS ? ' (mutants skipped)' : ', every mutant caught'}`)
