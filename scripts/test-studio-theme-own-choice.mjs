// FRONTEND-2 (B34, PROGRAM-1 GO 27 Oct 17:24Z): proof of NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE (exact "true", default off, build-time).
//
// THE DEFECT (E2E-2 finding, Studio dev, session 57f9e99a-8d63-4af9-90cb-68a320157b16, deck 1343a54f, 27 Oct ~17:15-17:22Z). Before a reload every user_message carried theme {"mode":"auto"}; after it they carried
// {"mode":"preset","preset_id":"corporate_light"} and the composer read "Theme locked: Corporate Light . Applied", which the user never chose.
//
// THE ROOT CAUSE (two halves that meet in Studio):
//   Director (src/handlers/websocket.py): a user_message that carries theme auto, or a set_theme with auto, runs _handle_set_theme (websocket.py ~3156-3200 / ~1393-1560). Its desired_theme_state.selection is what
//   _apply_theme_to_presentation returns, the RESOLVED selection (src/utils/theme_selection.py resolve_build_theme_selection: Auto becomes the user's standard theme, else corporate_light), under a REAL request id
//   (chat-theme-<hash of the raw selection> for a send, Studio's uuid for a set_theme). connect_theme_restore.restored_theme_payload then sends it on every connect as restore:<sid>:<that id>.
//   Studio (NEXT_PUBLIC_STUDIO_THEME_RESTORE, on at Studio dev): lib/studio-theme-restore.ts reads only restore:<sid>:none as "never picked" (isNeverPickedRestore); any other id is adopted as the user's pick
//   (app/builder/page.tsx observeThemeRestoreFrame -> setBuildThemeSelection), which raises the lock label (components/builder/chat-input.tsx, the theme chip) and goes into every later send (theme: buildThemeSelection).
//   The frame does not say whether its selection was chosen or resolved, so the fix needs a record of what the user chose: lib/studio-theme-own-choice.ts.
//
// THE FIX (flag on). A per-session record in sessionStorage (what a reload keeps), written only by a real pick (handleBuildThemeChange, the chat theme change's applyChatThemeSelection) and, at the first restore of a tab
// that leaves it on Auto, as the "no pick yet" baseline. A restore is held back as Director's resolution only when the record says Auto, the tab holds Auto, and the restore's theme is exactly corporate_light: then the tab keeps
// Auto, commits the theme-sync state applied for Auto (as restore:<sid>:none does) and sends nothing. Everything else is adopted as before. A tab with no record behaves as before (the stated limit).
//
//   1. lib/studio-theme-own-choice.ts alone: the record, the default test, the rule over every combination.
//   2. Transcripts on the PR #371 harness: the REAL Director socket hook and the REAL page regions (scripts/studio-chat-harness/theme-restore-transcript.mjs, unmodified) replay six reloads: reload with Auto stays Auto and
//      unlocked; today (flag off) it is the lock; a user-picked preset (and a deliberate Corporate Light) stays that preset, locked, either way; an explicit Auto stays Auto; another tab's pick is adopted; a fresh tab
//      with no record adopts (the limit). Flag off is byte-identical: every transcript's wire bytes and page state hash as the base tree's (baselines/flag-off.json), also with the flag set to "false", "TRUE", "1".
//   3. A theme change from chat (#475's chat-theme-export path): the page's REAL applyChatThemeSelection puts the change on record, and the next reload keeps it.
//   4. Wiring: the flag is read inline, exact "true"; the marked lines; the only two writers; no new copy; .env.example. The strip gives the base page and restore lib back byte for byte.
//   5. Mutants of the lib and the page: each must be caught.
//   6. Scope over the COMMITTED diff (BASE..HEAD; the own commits, the ones that start "Theme own choice:", are found by SUBJECT across `rev-list --no-merges`, so a change stacked after this one, a dev merge and the gate's merge do not hide them; the registry, .env.example and strip reads go past the changes registered after this one; a commit that is not this change's must touch only files a later change registered). GATE-SAFE: when HEAD is the gate's local --no-ff merge (first parent BASE, second parent this change's head) every scope query runs against HEAD^2; proved on a gate-style merge built here; a mutant with the old first-parent query finds nothing on it, and a mutant with a stray file in a "Theme own choice:" commit is caught.
//
//   node scripts/test-studio-theme-own-choice.mjs
//   node scripts/test-studio-theme-own-choice.mjs --record-baseline --root <base checkout>   (re-record the flag-off baseline from a base tree)
//
// Offline: no socket, fetch or real timer (the harness's host network guard is installed); git is read only for 6.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const recordBaseline = args.includes('--record-baseline')
const root = path.resolve(option('--root') || repo)
const FLAG = 'NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE'
const RESTORE_FLAG = 'NEXT_PUBLIC_STUDIO_THEME_RESTORE'
const PAGE = 'app/builder/page.tsx'
const RESTORE_LIB = 'lib/studio-theme-restore.ts'
const LIB = 'lib/studio-theme-own-choice.ts'
const FIXTURES = path.join(repo, 'scripts/fixtures/studio-theme-own-choice')
const baselineFile = path.join(FIXTURES, 'baselines/flag-off.json')
const read = (rel, from = root) => fs.readFileSync(path.join(from, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split('\n').join('\n       ')}`) }
}

const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-theme-own-choice-strip.mjs')
const { stripThemeOwnChoice, BASE_COMMIT, THEME_OWN_CHOICE_FILES, THEME_OWN_CHOICE_SCOPE_FILES, THEME_OWN_CHOICE_ENV_BLOCK, THEME_OWN_CHOICE_SUBJECT, THEME_OWN_CHOICE_MARKER_RE, THEME_OWN_CHOICE_PIN_EDITS } = stripModule
/** The strips of every change registered AFTER this one (below this change's strip in LATER_STRIPS), applied first: the identity checks read a file as this change left it. */
const laterStrips = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(stripThemeOwnChoice); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }

const { installHostNetworkGuard } = await import('./studio-chat-harness/fake-env.mjs')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
const { runThemeRestoreTranscript } = await import('./studio-chat-harness/theme-restore-transcript.mjs')
const extract = await import('./studio-chat-harness/page-extract.mjs')
const release = installHostNetworkGuard(net, dns)

const SRC = { [PAGE]: read(PAGE), [RESTORE_LIB]: read(RESTORE_LIB), [LIB]: read(LIB) }

// The harness (scripts/studio-chat-harness/page-extract.mjs parseSource) reads app/builder/page.tsx THROUGH the later-changes registry, which strips every registered change's marked lines so that the older
// transcripts see their own page. That would strip this change's lines too, so the proof runs the harness on a scratch tree whose page carries them under a marker the strip does not own
// (THEME-OWN-CHOICE-LIVE: the marker is matched as a whole token). Everything else in the scratch tree is the repo (symlinks); the lib is read raw by the loader.
const live = text => text.replace(new RegExp(THEME_OWN_CHOICE_MARKER_RE.source, 'g'), 'THEME-OWN-CHOICE-LIVE')
/** A scratch tree that is the repo except the mutated files (symlinks), so the loader and the AST extraction read the mutant. */
function scratchTree(overrides) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-theme-own-choice-mutant-'))
  const mirror = rel => {
    for (const entry of fs.readdirSync(path.join(repo, rel))) {
      const child = rel ? `${rel}/${entry}` : entry
      if (child in overrides) fs.writeFileSync(path.join(dir, child), overrides[child])
      else if (Object.keys(overrides).some(file => file.startsWith(`${child}/`))) { fs.mkdirSync(path.join(dir, child)); mirror(child) }
      else fs.symlinkSync(path.join(repo, child), path.join(dir, child))
    }
  }
  mirror('')
  return dir
}
const liveTree = (overrides = {}) => scratchTree({ [PAGE]: live(SRC[PAGE]), ...overrides, ...(PAGE in overrides ? { [PAGE]: live(overrides[PAGE]) } : {}) })
const LIVE = liveTree()

const fixtureNames = fs.readdirSync(FIXTURES).filter(name => name.endsWith('.json')).sort()
const fixtures = fixtureNames.map(name => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8')))

/** One transcript on the real hook + page regions of `treeRoot`. `own` leaves the flag out (today / flag off) or sets it (value). */
async function runFixture(treeRoot, fixture, flagValue) {
  const env = { ...fixture.env, ...(flagValue === undefined ? {} : { [FLAG]: flagValue }) }
  const result = await runThemeRestoreTranscript({ root: treeRoot, fixture: { ...fixture, env }, mode: flagValue === 'true' ? 'own' : 'today' })
  return result
}
const fingerprintOf = result => ({ outbound: sha(result.outbound), state: sha(JSON.stringify(result.state)), calls: sha(JSON.stringify(result.calls)), notes: sha(JSON.stringify(result.notes)), setThemes: result.setThemes.length })
const clean = (result, label) => {
  assert.deepEqual(result.failures, [], `${label}: expectations`)
  assert.deepEqual(result.diagnostics.console, [], `${label}: console errors`)
  assert.deepEqual(result.diagnostics.blockedNetwork, [], `${label}: blocked network`)
  assert.deepEqual(result.diagnostics.uncaught, [], `${label}: uncaught`)
}

if (recordBaseline) {
  const baseline = { recorded_from: `the base tree (origin/studio-v4-dev-preparation-code ${BASE_COMMIT}), ${RESTORE_FLAG} on, the own-choice flag absent: what flag off must reproduce byte for byte`, fixtures: {} }
  for (const fixture of fixtures) { const result = await runFixture(root, fixture, undefined); assert.deepEqual(result.failures, [], fixture.name); baseline.fixtures[fixture.name] = fingerprintOf(result) }
  release()
  fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 1) + '\n')
  console.log(`recorded ${Object.keys(baseline.fixtures).length} flag-off transcripts from ${root} into ${path.relative(repo, baselineFile)}`)
  process.exit(0)
}
const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'))

// ---- 1. the lib alone --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const CL = { mode: 'preset', preset_id: 'corporate_light' }
const VIB = { mode: 'preset', preset_id: 'vibrant' }
const AUTO = { mode: 'auto' }
function fakeStorage({ throws = false } = {}) {
  const map = new Map()
  const fail = () => { throw new Error('storage blocked') }
  return { map, getItem: key => (throws ? fail() : map.has(key) ? map.get(key) : null), setItem: (key, value) => (throws ? fail() : void map.set(key, String(value))), removeItem: key => map.delete(key) }
}
function loadLib(treeRoot, storage) {
  const globals = storage === undefined ? { console } : { console, sessionStorage: storage }
  return createModuleLoader({ root: treeRoot, globals }).load(LIB)
}
function libSuite(treeRoot) {
  const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
  const eq = (actual, expected, label) => assert.deepEqual(plain(actual), plain(expected), label)
  const store = fakeStorage()
  const lib = loadLib(treeRoot, store)
  const key = sid => `${lib.THEME_OWN_CHOICE_KEY_PREFIX}${sid}`

  // the record
  eq(lib.readOwnThemeChoice('s1'), null, 'nothing on record')
  lib.recordOwnThemeChoice('s1', VIB); eq(lib.readOwnThemeChoice('s1'), VIB, 'a pick is read back')
  eq(lib.readOwnThemeChoice('s2'), null, 'another session has no record (one key per session)')
  lib.recordOwnThemeChoice('s1', AUTO); eq(lib.readOwnThemeChoice('s1'), AUTO, 'a later pick replaces it')
  for (const sid of [null, undefined, '']) { lib.recordOwnThemeChoice(sid, CL); eq(lib.readOwnThemeChoice(sid), null, `no session id (${JSON.stringify(sid)}): nothing recorded or read`) }
  assert.equal(store.map.size, 1, 'only the one session was written')
  for (const raw of ['not json', '{}', '{"v":2,"own":{"mode":"auto"}}', '{"v":1}', '{"v":1,"own":"auto"}', '{"v":1,"own":{"mode":"brand"}}', '{"v":1,"own":[]}', 'null']) {
    store.map.set(key('bad'), raw); eq(lib.readOwnThemeChoice('bad'), null, `a damaged record is no record: ${raw}`)
  }
  // storage that is blocked or missing never throws and records nothing
  const blocked = loadLib(treeRoot, fakeStorage({ throws: true }))
  assert.doesNotThrow(() => blocked.recordOwnThemeChoice('s1', VIB)); eq(blocked.readOwnThemeChoice('s1'), null, 'blocked storage: no record')
  eq(blocked.themeOwnChoiceRestore('s1', AUTO, CL), null, 'blocked storage: the rule is today\'s behaviour')
  const missing = loadLib(treeRoot, undefined)
  assert.doesNotThrow(() => missing.recordOwnThemeChoice('s1', VIB)); eq(missing.readOwnThemeChoice('s1'), null, 'no sessionStorage: no record')
  eq(missing.themeOwnChoiceRestore('s1', AUTO, CL), null, 'no sessionStorage: the rule is today\'s behaviour')

  // Director's default for Auto
  assert.equal(lib.DIRECTOR_AUTO_DEFAULT_PRESET_ID, 'corporate_light')
  for (const sel of [CL, { ...CL, font_family: 'Inter' }, { ...CL, font_family: 'Inter', font_family_heading: 'Lora' }]) assert.equal(lib.isDirectorAutoDefault(sel), true, `default: ${JSON.stringify(sel)}`)
  for (const sel of [null, undefined, AUTO, VIB, { mode: 'preset' }, { mode: 'custom', primary_hex: '#0a7d4f' }, { ...CL, color_overrides: { accent: '#ffaa00' } }, { ...CL, palette_mode: 'dark' }, { mode: 'preset', preset_id: 'Corporate_Light' }, { mode: 'preset', preset_id: 'corporate_dark' }]) {
    assert.equal(lib.isDirectorAutoDefault(sel), false, `not the default: ${JSON.stringify(sel)}`)
  }

  // the rule: held back (the held Auto is returned) only for record Auto + held Auto + exactly the default
  const rule = (sid, held, adopted) => lib.themeOwnChoiceRestore(sid, held, adopted)
  const fresh = () => { const s = fakeStorage(); return { s, lib: loadLib(treeRoot, s) } }
  { // no record: today's behaviour, and the Auto baseline is written only when the restore leaves the tab on Auto
    for (const [adopted, wrote] of [[null, true], [AUTO, true], [{ mode: 'auto', font_family: 'Inter' }, true], [CL, false], [VIB, false], [{ mode: 'custom', primary_hex: '#0a7d4f' }, false]]) {
      const w = fresh()
      eq(w.lib.themeOwnChoiceRestore('s', AUTO, adopted), null, `no record, adopted ${JSON.stringify(adopted)}: today's behaviour`)
      eq(w.lib.readOwnThemeChoice('s'), wrote ? AUTO : null, `no record, adopted ${JSON.stringify(adopted)}: baseline ${wrote ? 'written' : 'not written (an adopted theme is Director\'s word, not a pick)'}`)
    }
    const w = fresh(); eq(w.lib.themeOwnChoiceRestore(null, AUTO, null), null, 'no session id: nothing'); assert.equal(w.s.map.size, 0)
  }
  { // record Auto
    const w = fresh(); w.lib.recordOwnThemeChoice('s', AUTO)
    eq(w.lib.themeOwnChoiceRestore('s', AUTO, CL), AUTO, 'record Auto + held Auto + Director\'s default: held back, Auto kept')
    const fonts = { mode: 'auto', font_family: 'Inter' }
    eq(w.lib.themeOwnChoiceRestore('s', fonts, { ...CL, font_family: 'Inter' }), fonts, 'the held Auto (with its font) is what is kept')
    eq(w.lib.themeOwnChoiceRestore('s', AUTO, VIB), null, 'another tab\'s pick (any other preset) is adopted')
    eq(w.lib.themeOwnChoiceRestore('s', AUTO, { mode: 'custom', primary_hex: '#0a7d4f' }), null, 'a brand colour is adopted')
    eq(w.lib.themeOwnChoiceRestore('s', AUTO, { ...CL, color_overrides: { accent: '#ffaa00' } }), null, 'the default with overrides is a choice: adopted')
    eq(w.lib.themeOwnChoiceRestore('s', AUTO, { ...CL, palette_mode: 'dark' }), null, 'the default in dark is a choice: adopted')
    eq(w.lib.themeOwnChoiceRestore('s', AUTO, AUTO), null, 'Auto restored: today\'s behaviour (adopt Auto)')
    eq(w.lib.themeOwnChoiceRestore('s', AUTO, null), null, 'nothing usable restored: today\'s behaviour')
    eq(w.lib.themeOwnChoiceRestore('s', VIB, CL), null, 'the tab holds a pick (record not caught up): adopted')
    eq(w.lib.themeOwnChoiceRestore('s', CL, CL), null, 'the tab holds the default as a pick: adopted')
    eq(w.lib.themeOwnChoiceRestore('other', AUTO, CL), null, 'another session has no record: adopted')
  }
  { // record a pick
    for (const own of [CL, VIB, { mode: 'custom', primary_hex: '#0a7d4f' }]) {
      const w = fresh(); w.lib.recordOwnThemeChoice('s', own)
      eq(w.lib.themeOwnChoiceRestore('s', AUTO, CL), null, `record ${JSON.stringify(own)} + held Auto (cache not yet restored) + the default: adopted, never held back`)
      eq(w.lib.themeOwnChoiceRestore('s', own, CL), null, `record ${JSON.stringify(own)} + held: adopted`)
      eq(w.lib.readOwnThemeChoice('s'), own, 'the rule never rewrites a pick')
    }
  }
  { // the rule never writes once a record exists
    const w = fresh(); w.lib.recordOwnThemeChoice('s', AUTO); const before = JSON.stringify([...w.s.map.entries()])
    w.lib.themeOwnChoiceRestore('s', AUTO, CL); w.lib.themeOwnChoiceRestore('s', AUTO, VIB); w.lib.themeOwnChoiceRestore('s', VIB, VIB)
    assert.equal(JSON.stringify([...w.s.map.entries()]), before, 'a restore, held back or adopted, writes nothing')
  }
}

// ---- 2. transcripts ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function transcriptSuite(treeRoot, { only = null } = {}) {
  const rows = []
  for (const fixture of fixtures) {
    if (only && !only.includes(fixture.name)) continue
    const today = await runFixture(treeRoot, fixture, undefined)
    clean(today, `${fixture.name} flag off`)
    assert.deepEqual(fingerprintOf(today), baseline.fixtures[fixture.name], `${fixture.name}: flag off is the base tree's wire bytes and page state`)
    const own = await runFixture(treeRoot, fixture, 'true')
    clean(own, `${fixture.name} flag on`)
    assert.equal(own.outbound, today.outbound, `${fixture.name}: the flag changes the page's state, not a byte on the socket`)
    rows.push([fixture.name, today.setThemes.length, own.setThemes.length])
  }
  return rows
}
async function strictFlagValues(treeRoot) {
  const fixture = fixtures.find(f => f.name === 'reload-auto-stays-auto')
  for (const value of ['false', 'TRUE', '1', 'yes', ' true', 'true ', '']) {
    const result = await runFixture(treeRoot, fixture, value)
    assert.deepEqual(fingerprintOf(result), baseline.fixtures[fixture.name], `flag value ${JSON.stringify(value)} is off`)
  }
}

// ---- 3. a theme change from chat (#475 chat-theme-export) --------------------------------------------------------------------------------------------------------------------------------------
/** The page's REAL applyChatThemeSelection, run in a strict scope that names exactly what it uses. */
function chatApply(treeRoot, { flagValue, session, held, next, storage }) {
  const lib = loadLib(treeRoot, storage)
  const page = extract.parseSource(path.join(treeRoot, PAGE))
  const apply = extract.compile(extract.findVariableInitializer(page, 'applyChatThemeSelection'), page, 'page.applyChatThemeSelection')
  const state = { selection: held, locally: false, profile: 'unset', saved: 0 }
  const scope = {
    process: { env: flagValue === undefined ? {} : { [FLAG]: flagValue } },
    recordOwnThemeChoice: lib.recordOwnThemeChoice,
    themeRestoreSessionRef: { current: session },
    saveSessionOnFirstAction: () => { state.saved++ },
    carryPaletteMode: (n, h) => n, // NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST is a different flag: the pick passes through
    buildThemeSelectionRef: { current: held },
    setActiveBuildThemeProfile: update => { state.profile = typeof update === 'function' ? update(null) : update },
    buildThemeProfileMatchesSelection: () => false,
    themeSelectionChangedLocallyRef: { get current() { return state.locally }, set current(value) { state.locally = value } },
    setBuildThemeSelection: value => { state.selection = value },
  }
  const result = apply(scope)(next)
  return { lib, result, state }
}
async function chatSuite(treeRoot) {
  const plain = value => JSON.parse(JSON.stringify(value))
  { // flag on: the chat change is the user's own choice, and the next reload keeps it
    const storage = fakeStorage()
    const first = chatApply(treeRoot, { flagValue: 'true', session: 'sess-chat', held: AUTO, next: CL, storage })
    assert.deepEqual(plain(first.result), CL); assert.deepEqual(plain(first.state.selection), CL); assert.equal(first.state.locally, true, 'a pick, as before')
    assert.deepEqual(plain(first.lib.readOwnThemeChoice('sess-chat')), CL, 'the chat change is on record as the user\'s own selection')
    // the reload: the tab holds Auto again until the cache is back (the record is what is read), Director restores the default under the change's request id
    assert.equal(first.lib.themeOwnChoiceRestore('sess-chat', AUTO, plain(CL)), null, 'reload: the chat-changed Corporate Light is adopted and stays locked')
    const second = chatApply(treeRoot, { flagValue: 'true', session: 'sess-chat', held: CL, next: AUTO, storage })
    assert.deepEqual(plain(second.lib.readOwnThemeChoice('sess-chat')), AUTO, 'a chat change back to Auto is on record as Auto')
    assert.deepEqual(plain(second.lib.themeOwnChoiceRestore('sess-chat', AUTO, plain(CL))), AUTO, 'reload: Auto is kept (the restore is Director\'s default)')
    const third = chatApply(treeRoot, { flagValue: 'true', session: 'sess-chat', held: AUTO, next: VIB, storage })
    assert.equal(third.lib.themeOwnChoiceRestore('sess-chat', AUTO, plain(VIB)), null, 'a chat change to another theme is adopted after a reload')
  }
  { // flag off, or no session yet: nothing is written, the pick behaves as before
    for (const [flagValue, session] of [[undefined, 'sess-chat'], ['false', 'sess-chat'], ['true', null]]) {
      const storage = fakeStorage()
      const run = chatApply(treeRoot, { flagValue, session, held: AUTO, next: VIB, storage })
      assert.deepEqual(plain(run.state.selection), VIB); assert.equal(run.state.locally, true); assert.equal(storage.map.size, 0, `flag ${flagValue} / session ${session}: nothing recorded`)
    }
  }
}

// ---- 4. wiring ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
function wiringSuite(src) {
  const page = src[PAGE], restoreLib = src[RESTORE_LIB], lib = src[LIB]
  const count = (text, needle) => text.split(needle).length - 1
  const read_ = `process.env.${FLAG} === 'true'`
  assert.equal(count(page, `process.env.${FLAG}`), 3, 'the flag is read inline in exactly three places')
  assert.equal(count(page, read_), 3, 'each read is the exact "true"')
  // every line that names the flag or the lib's names is a marked line (the strip takes exactly those out)
  for (const line of page.split('\n')) if (/NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE|recordOwnThemeChoice|themeOwnChoiceRestore/.test(line)) assert.match(line, THEME_OWN_CHOICE_MARKER_RE, `an unmarked line: ${line.slice(0, 120)}`)
  assert.equal(page.split('\n').filter(line => THEME_OWN_CHOICE_MARKER_RE.test(line)).length, 18, 'the page carries 18 marked lines: 2 import names, 1 comment, the 13-line restore branch, 2 recording lines')
  // the restore branch sits after the user-pick guard and before the never-picked rule, inside the inline flag read
  const guard = page.indexOf('if (!restore || themeSelectionChangedLocallyRef.current) return step.consumed')
  const branch = page.indexOf(`if (${read_}) { // THEME-OWN-CHOICE`)
  const never = page.indexOf('const selection = restoredAdoptedSelection(restore)')
  assert.ok(guard !== -1 && guard < branch && branch < never, 'the branch is after the "a pick wins" guard and before the never-picked rule')
  // the only writers of the record: the picker's pick and the chat theme change, each right after the pick is set
  const writers = [...page.matchAll(/recordOwnThemeChoice\(([^)]*)\)/g)].map(m => m[1])
  assert.deepEqual(writers, ['themeRestoreSessionRef.current, carried', 'themeRestoreSessionRef.current, carried'], 'two writers, nothing else (no adopted restore, no hydration)')
  for (const [from, to] of [['const handleBuildThemeChange = useCallback(', 'const handleActiveBuildThemeProfileChange'], ['const applyChatThemeSelection = (', 'themeExportDirectiveRunnerRef.current']]) {
    const start = page.indexOf(from)
    const body = page.slice(start, page.indexOf(to, start))
    assert.match(body, /themeSelectionChangedLocallyRef\.current = true\n    setBuildThemeSelection\(carried\)\n    if \(process\.env\.NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE === 'true'\) recordOwnThemeChoice\(themeRestoreSessionRef\.current, carried\)/, `${from.slice(6, 40)}: recorded right after the pick`)
  }
  const restoreBody = page.slice(page.indexOf('const observeThemeRestoreFrame'), page.indexOf('const standardThemeLoadedRef'))
  assert.equal(count(restoreBody, 'recordOwnThemeChoice'), 0, 'the restore handler never records a pick')
  assert.equal(count(page.slice(page.indexOf('const standardThemeLoadedRef'), page.indexOf('const [sessionStoreName')), 'recordOwnThemeChoice'), 0, 'the standard-theme hydration never records a pick')
  // the restore lib only re-exports; the page's sends are still `theme: buildThemeSelection`
  assert.equal(restoreLib.split('\n').filter(line => THEME_OWN_CHOICE_MARKER_RE.test(line)).length, 1)
  assert.match(restoreLib, /^export \* from '\.\/studio-theme-own-choice' \/\/ THEME-OWN-CHOICE/m)
  assert.ok(count(page, '        theme: buildThemeSelection,') >= 1, 'the send still carries the page\'s selection: Auto kept means Auto sent')
  // the lib: pure, one global, no copy
  assert.deepEqual([...lib.matchAll(/^import .*$/gm)].map(m => m[0]), ["import type { BuildThemeSelection } from '@/lib/theme-builder'"], 'the lib imports one type and nothing else')
  assert.doesNotMatch(lib.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''), /\b(fetch|XMLHttpRequest|WebSocket|localStorage|document|window|toast|Date\.now|Math\.random|setTimeout)\b/, 'no network, timer, clock or other global')
  // no new copy: this change adds no string literal that reaches the screen
  const added = [...lib.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').matchAll(/'([^']*)'/g)].map(m => m[1]).filter(text => /\s/.test(text))
  assert.deepEqual(added, [], 'no user-facing text in the lib')
  assert.match(read('.env.example'), new RegExp(`^${FLAG}="false"$`, 'm')); assert.equal((read('.env.example').match(new RegExp(`^${FLAG}=`, 'gm')) || []).length, 1)
}

// ---- 5. mutants --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const MUTANTS = [
  // the lib
  ['any restored theme is held back (the default test is gone)', LIB, 'isDirectorAutoDefault(adopted) ? held : null', 'adopted ? held : null'],
  ['the default is any preset', LIB, "selection.preset_id !== DIRECTOR_AUTO_DEFAULT_PRESET_ID", 'false'],
  ['the default tolerates overrides and a palette', LIB, "return Object.keys(selection).every(key => key === 'mode' || key === 'preset_id' || (FONT_KEYS as readonly string[]).includes(key))", 'return true'],
  ['the held selection is not checked', LIB, 'isAutoSelection(own) && isAutoSelection(held) && isDirectorAutoDefault(adopted)', 'isAutoSelection(own) && isDirectorAutoDefault(adopted)'],
  ['the record is not checked (a pick of Corporate Light is held back)', LIB, 'isAutoSelection(own) && isAutoSelection(held) && isDirectorAutoDefault(adopted)', 'isAutoSelection(held) && isDirectorAutoDefault(adopted)'],
  ['no baseline is written for a first restore', LIB, "if (!adopted || isAutoSelection(adopted)) recordOwnThemeChoice(sessionId, { mode: 'auto' })", 'void adopted'],
  ['an adopted theme is written as the baseline', LIB, "if (!adopted || isAutoSelection(adopted)) recordOwnThemeChoice(sessionId, { mode: 'auto' })", 'recordOwnThemeChoice(sessionId, adopted ?? { mode: \'auto\' })'],
  ['a tab with no record holds the default back too', LIB, "if (!own) {", "if (false) {"],
  ['one record for every session', LIB, 'storage()?.getItem(`${THEME_OWN_CHOICE_KEY_PREFIX}${sessionId}`)', 'storage()?.getItem(THEME_OWN_CHOICE_KEY_PREFIX)'],
  ['the record is written under another key than it is read from', LIB, 'storage()?.setItem(`${THEME_OWN_CHOICE_KEY_PREFIX}${sessionId}`', 'storage()?.setItem(`${THEME_OWN_CHOICE_KEY_PREFIX}x${sessionId}`'],
  ['a damaged record is trusted', LIB, "if (!isRecord(parsed) || parsed.v !== 1 || !isRecord(parsed.own)) return null", 'if (!isRecord(parsed)) return null'],
  ['blocked storage throws', LIB, "    // Browser storage can fail (private mode, quota): the restore then behaves as it does today.\n", '    throw new Error(\'blocked\')\n'],
  ['the rule keeps a different selection than the held Auto', LIB, 'isDirectorAutoDefault(adopted) ? held : null', "isDirectorAutoDefault(adopted) ? { mode: 'auto' } : null"],
  // the page
  ['the flag is read loosely (anything but "false")', PAGE, `if (process.env.${FLAG} === 'true') { // THEME-OWN-CHOICE`, `if (process.env.${FLAG} !== 'false') { // THEME-OWN-CHOICE`],
  ['the restore branch commits no state', PAGE, 'if (ownSync) { // THEME-OWN-CHOICE', 'if (false) { // THEME-OWN-CHOICE'],
  ['the restore branch falls through and adopts', PAGE, '        return step.consumed // THEME-OWN-CHOICE\n', ''],
  ['the state is committed for the default\'s fingerprint', PAGE, 'restoredThemeSync(restore, ownKept)', 'restoredThemeSync(restore, restoredAdoptedSelection(restore))'],
  ['the branch sits before the "a pick wins" guard', PAGE, "    if (!restore || themeSelectionChangedLocallyRef.current) return step.consumed\n", '    if (!restore) return step.consumed\n'],
  ['the picker does not record', PAGE, "    setBuildThemeSelection(carried)\n    if (process.env.NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE === 'true') recordOwnThemeChoice(themeRestoreSessionRef.current, carried) // THEME-OWN-CHOICE: a real pick is the user's own choice\n  }, [toast, saveSessionOnFirstAction])", '    setBuildThemeSelection(carried)\n  }, [toast, saveSessionOnFirstAction])'],
  ['the chat theme change does not record', PAGE, "    if (process.env.NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE === 'true') recordOwnThemeChoice(themeRestoreSessionRef.current, carried) // THEME-OWN-CHOICE: a chat theme change is the user's own choice too\n", ''],
  ['the picker records ignoring the flag', PAGE, "    if (process.env.NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE === 'true') recordOwnThemeChoice(themeRestoreSessionRef.current, carried) // THEME-OWN-CHOICE: a real pick", '    recordOwnThemeChoice(themeRestoreSessionRef.current, carried) // THEME-OWN-CHOICE: a real pick'],
  ['an adopted restore is recorded as the user\'s own', PAGE, '    setBuildThemeSelection(selection)\n    const sync = restoredThemeSync(restore, selection)', '    setBuildThemeSelection(selection)\n    recordOwnThemeChoice(themeRestoreSessionRef.current, selection) // THEME-OWN-CHOICE\n    const sync = restoredThemeSync(restore, selection)'],
  ['the standard-theme hydration is recorded as the user\'s own', PAGE, '          setBuildThemeSelection(profile.theme_payload)\n', '          setBuildThemeSelection(profile.theme_payload)\n          recordOwnThemeChoice(themeRestoreSessionRef.current, profile.theme_payload) // THEME-OWN-CHOICE\n'],
]

// ---- run ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('1. lib/studio-theme-own-choice.ts alone')
await check('the record, the default test and the rule over every combination', () => libSuite(LIVE))

console.log('2. the reload, on the real hook and the real page regions')
const ROWS = {}
await check(`${fixtures.length} transcripts: flag off is the base tree's bytes (baselines/flag-off.json) with today's expectations, flag on meets its own, the wire is identical, no console error`, async () => { for (const row of await transcriptSuite(LIVE)) ROWS[row[0]] = row })
await check('E2E-2\'s shape, read off the digests: today the reload ends with Corporate Light selected and applied (the lock), flag on ends on Auto, applied for the Auto fingerprint, nothing sent', async () => {
  const fixture = fixtures.find(f => f.name === 'reload-auto-stays-auto')
  const today = await runFixture(LIVE, fixture, undefined), own = await runFixture(LIVE, fixture, 'true')
  const last = result => JSON.parse(JSON.stringify(result.state.at(-1))) // values cross the vm boundary (another realm's Object)
  assert.deepEqual(last(today).buildThemeSelection, CL); assert.equal(last(today).themeSync.status, 'applied')
  assert.deepEqual(last(own).buildThemeSelection, AUTO); assert.equal(last(own).themeSync.status, 'applied'); assert.equal(last(own).themeSync.requestId, last(today).themeSync.requestId)
  assert.notEqual(last(own).themeSync.themeFingerprint, last(today).themeSync.themeFingerprint, 'applied for Auto, not for corporate_light')
  assert.equal(own.setThemes.length, 0); assert.equal(last(own).themeSelectionChangedLocally, false, 'a restore is never a pick')
})
await check('a user-picked preset, and a deliberate Corporate Light, stay locked with the flag on; an explicit Auto stays Auto; another tab\'s pick is adopted; a fresh tab adopts (the limit)', async () => {
  const sel = async (name, flag) => JSON.parse(JSON.stringify((await runFixture(LIVE, fixtures.find(f => f.name === name), flag)).state.at(-1).buildThemeSelection))
  for (const flag of [undefined, 'true']) {
    assert.deepEqual(await sel('reload-picked-preset-stays-locked', flag), VIB); assert.deepEqual(await sel('reload-picked-corporate-light-stays-locked', flag), CL)
    assert.deepEqual(await sel('reload-other-tab-pick-adopted', flag), VIB); assert.deepEqual(await sel('fresh-tab-no-record-unchanged', flag), CL)
  }
  assert.deepEqual(await sel('reload-explicit-auto-stays-auto', undefined), CL); assert.deepEqual(await sel('reload-explicit-auto-stays-auto', 'true'), AUTO)
})
await check('the flag is exactly "true": "false", "TRUE", "1", "yes", padded and empty values all behave as flag off (the base bytes)', () => strictFlagValues(LIVE))

console.log('3. a theme change from chat (#475 chat-theme-export)')
await check('the page\'s real applyChatThemeSelection records the change; the reload keeps it; flag off or without a session it records nothing', () => chatSuite(LIVE))

console.log('4. wiring and the strip')
await check('the inline flag reads, the 18 marked page lines, the only two writers, the pure lib, no new copy, .env.example', () => wiringSuite(SRC))
await check('the strip gives the base page and restore lib back byte for byte (the committed files)', () => {
  const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28 })
  for (const rel of THEME_OWN_CHOICE_FILES) assert.equal(stripThemeOwnChoice(rel, laterStrips(rel, read(rel, repo))), git('show', `${BASE_COMMIT}:${rel}`), rel)
  assert.deepEqual(THEME_OWN_CHOICE_FILES, [PAGE, RESTORE_LIB]); assert.deepEqual(Object.keys(THEME_OWN_CHOICE_PIN_EDITS), ['scripts/test-studio-chat-theme-export.mjs', 'scripts/test-studio-chat-element-edit-2.mjs', 'scripts/test-studio-theme-dark-persist.mjs'])
})

console.log('5. mutants')
const firstLine = error => String(error?.message ?? error).split('\n')[0].slice(0, 100)
const caughtBy = []
for (const [name, rel, from, to] of MUTANTS) {
  await check(`mutant caught: ${name}`, async () => {
    const source = SRC[rel]
    const at = source.indexOf(from)
    assert.ok(at !== -1 && source.indexOf(from, at + 1) === -1, `mutant "${name}": anchor not found exactly once in ${rel}`)
    const mutated = source.replace(from, () => to)
    const dir = liveTree({ [rel]: mutated })
    let by = null
    try {
      if (rel === LIB) { try { libSuite(dir) } catch (error) { by = `unit: ${firstLine(error)}` } }
      if (!by) try { await chatSuite(dir) } catch (error) { by = `chat: ${firstLine(error)}` }
      if (!by) try { await transcriptSuite(dir) } catch (error) { by = `transcripts: ${firstLine(error)}` }
      if (!by) try { wiringSuite({ ...SRC, [rel]: mutated }) } catch (error) { by = `wiring: ${firstLine(error)}` }
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
    assert.ok(by, 'MUTANT SURVIVED')
    caughtBy.push(`  ${name.slice(0, 66).padEnd(66)} ${by}`)
  })
}
await check('mutant caught: an unmarked line added to the page is not stripped (the strip gives the base back only for marked lines)', () => {
  const page = SRC[PAGE], at = page.indexOf("import { themeFontFields, themeFontsEqual } from '@/lib/theme-fonts'\n")
  assert.ok(at !== -1)
  const mutated = page.replace("import { themeFontFields, themeFontsEqual } from '@/lib/theme-fonts'\n", "import { themeFontFields, themeFontsEqual } from '@/lib/theme-fonts'\nimport { extra } from '@/lib/extra'\n")
  assert.notEqual(stripThemeOwnChoice(PAGE, mutated), stripThemeOwnChoice(PAGE, page))
})

console.log('6. scope over the committed diff (BASE..HEAD, first-parent, no merges)')
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28 })
/** GATE-SAFE head of every own-commit / scope query. In the gate, HEAD is a local --no-ff merge whose FIRST parent is BASE (dev) and whose second parent is this change's head, so `rev-list --first-parent --no-merges BASE..HEAD` is empty: the
 *  scope then runs against HEAD^2. On a branch (HEAD is this change's own tip, or a merge of dev INTO it, whose first parent is the change) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const sha = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = git('rev-list', '--parents', '-n', '1', sha).trim().split(/\s+/).slice(1)
  return gateRule && parents.length === 2 && parents[0] === BASE_COMMIT ? parents[1] : sha
}
const HEAD = scopeHead('HEAD')
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees nothing on the gate's merge, and none of this change's commits once a change is stacked after it. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(THEME_OWN_CHOICE_SUBJECT))
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  const all = git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)
  for (const c of all.filter(c => !own.includes(c))) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) assert.ok(THEME_OWN_CHOICE_SCOPE_FILES.has(rel) || registry.LATER_CHANGE_FILES.has(rel), `a commit between the base and HEAD that is not this change's (${c.slice(0, 8)}) touches ${rel}, which no later change registered`)
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
}
/** `git diff -U0` of the base file against the file at `head` with the later changes' marked lines out (one blob object is written). */
const strippedDiff = (rel, head) => { const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: repo, encoding: 'utf8', input: laterStrips(rel, git('show', `${head}:${rel}`)), maxBuffer: 1 << 28 }).trim(); return git('diff', '-U0', `${BASE_COMMIT}:${rel}`, blob) }
const scopeCommittedFiles = HEAD => {
  const changed = git('diff', '--name-only', `${BASE_COMMIT}..${HEAD}`).split('\n').filter(Boolean).filter(rel => THEME_OWN_CHOICE_SCOPE_FILES.has(rel) || !registry.LATER_CHANGE_FILES.has(rel)).sort()
  assert.deepEqual(changed, [...THEME_OWN_CHOICE_SCOPE_FILES].sort())
  for (const rel of THEME_OWN_CHOICE_FILES) {
    const diff = strippedDiff(rel, HEAD).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, THEME_OWN_CHOICE_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.equal(diff.length, rel === PAGE ? 18 : 1, `${rel}: the number of added lines`)
    assert.equal(stripThemeOwnChoice(rel, laterStrips(rel, git('show', `${HEAD}:${rel}`))), git('show', `${BASE_COMMIT}:${rel}`), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of Object.keys(THEME_OWN_CHOICE_PIN_EDITS)) { // the three older proofs this change teaches (#475's chat theme/export, #538's chat element edit 2 on dev, dark persist), FRONTEND-2's own: each read now goes past a later change's marked lines; every new line is marked and says "stacked after"; put back, the previous proof byte for byte
    const diff = strippedDiff(rel, HEAD).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    const swaps = THEME_OWN_CHOICE_PIN_EDITS[rel].filter(([, was]) => was !== '').length, additions = THEME_OWN_CHOICE_PIN_EDITS[rel].length
    assert.equal(diff.filter(line => line.startsWith('-')).length, swaps, `${rel}: ${swaps} lines swapped`); assert.equal(diff.filter(line => line.startsWith('+')).length, additions, `${rel}: ${additions} lines added`)
    for (const line of diff.filter(line => line.startsWith('+'))) assert.ok(line.includes(stripModule.THEME_OWN_CHOICE_PIN_MARK) && /stacked after/.test(line), `${rel}: a new line is marked: ${line.slice(0, 100)}`)
    assert.equal(stripThemeOwnChoice(rel, laterStrips(rel, git('show', `${HEAD}:${rel}`))), git('show', `${BASE_COMMIT}:${rel}`), `${rel}: put back, the previous proof byte for byte`)
  }
  for (const rel of stripModule.THEME_OWN_CHOICE_NEW_FILES) assert.ok(git('cat-file', '-t', `${HEAD}:${rel}`).trim() === 'blob', rel)
  assert.deepEqual(git('diff', '--name-only', `${BASE_COMMIT}..${HEAD}`, '--', 'hooks/', 'components/', 'package.json').split('\n').filter(Boolean).filter(rel => !registry.LATER_CHANGE_FILES.has(rel)), [], 'no hook, no component (the lock label is untouched), no package.json (but for the files a later change registered)')
}
const scopeEnvAndRegistry = HEAD => {
  assert.equal(registry.stripLaterEnvBlocks('.env.example', git('show', `${HEAD}:.env.example`)), registry.stripLaterEnvBlocks('.env.example', `${git('show', `${BASE_COMMIT}:.env.example`)}\n${THEME_OWN_CHOICE_ENV_BLOCK}`))
  assert.match(git('show', `${HEAD}:.env.example`), new RegExp(`\\n\\n${THEME_OWN_CHOICE_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const laterRegistry = (() => { const later = new Set(); let after = false; for (const line of git('show', `${HEAD}:scripts/studio-later-changes.mjs`).split('\n')) { if (/^export const LATER_/.test(line)) after = false; else if (line.includes('studio-theme-own-choice-strip.mjs')) after = true; else if (after && line.includes('// LATER-CHANGE:') && /-strip\.mjs/.test(line)) later.add(line) } return later })() // the registry lines of every change registered after this one (below this change's own line in each list, in the registered shape) are theirs
  const diff = git('diff', '-U0', `${BASE_COMMIT}..${HEAD}`, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line) && !(line.startsWith('+') && laterRegistry.has(line.slice(1))))
  assert.equal(diff.length, 3); for (const line of diff) assert.ok(line.startsWith('+') && line.includes('LATER-CHANGE') && line.includes('studio-theme-own-choice-strip.mjs'), line.slice(0, 140))
}
await check(`this change's own commits (subject starts "${THEME_OWN_CHOICE_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; a commit that is not one touches only files a later change registered`, () => scopeOwnCommits(HEAD))
await check('the committed files are exactly this change\'s; every line added to an existing file is a pure insertion that carries the marker; the strip gives each its base back byte for byte', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block; the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of ['scripts/test-studio-theme-own-choice.mjs', 'scripts/studio-theme-own-choice-strip.mjs', LIB]) assert.doesNotMatch(fs.readFileSync(path.join(repo, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
})
// GATE-SAFE: build the gate's merge (first parent BASE, second parent this change's head; the tree is `git merge-tree --write-tree BASE head`) and run the whole scope section against it.
const GATE_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-27T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-27T00:00:00Z' }
const gateStyleMerge = head => {
  const tree = git('merge-tree', '--write-tree', BASE_COMMIT, head).trim().split('\n')[0]
  return execFileSync('git', ['commit-tree', tree, '-p', BASE_COMMIT, '-p', head, '-m', 'gate-style merge (local, no ref)'], { cwd: repo, encoding: 'utf8', env: { ...process.env, ...GATE_IDENT } }).trim()
}
const GATE = gateStyleMerge(HEAD)
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it', () => {
  assert.deepEqual(git('rev-list', '--parents', '-n', '1', GATE).trim().split(/\s+/).slice(1), [BASE_COMMIT, HEAD], 'the gate-style merge: first parent BASE, second parent the head')
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  const head = scopeHead(GATE)
  assert.equal(head, HEAD, 'HEAD^2 is the change\'s head')
  scopeOwnCommits(head); scopeCommittedFiles(head); scopeEnvAndRegistry(head)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head (not a merge onto BASE) is used as it is')
  assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await check('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge (the scope section fails on it), and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
await check('mutant caught: a stray non-#541 file in a "Theme own choice:" commit fails the committed-files check (the own commits are found by subject, the diff names the file)', () => {
  const run = (args, input) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', input, env: { ...process.env, ...GATE_IDENT }, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  const tree = run(['mktree'], `${git('ls-tree', HEAD)}100644 blob ${run(['hash-object', '-w', '--stdin'], 'stray\n')}\tstray-theme-own-choice.txt\n`)
  const stray = run(['commit-tree', tree, '-p', HEAD, '-m', `${THEME_OWN_CHOICE_SUBJECT} a stray file\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`])
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), undefined, 'the committed-files check must fail on a stray file')
})

fs.rmSync(LIVE, { recursive: true, force: true })
release()
console.log('mutants (each caught by):'); for (const line of caughtBy) console.log(line)
console.log('transcripts (set_theme sent, flag off / on):'); for (const row of Object.values(ROWS)) console.log(`  ${row[0].padEnd(46)} ${row[1]} / ${row[2]}`)
console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
