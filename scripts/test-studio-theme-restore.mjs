// THEME-RESET-ON-RECONNECT-P1, Studio half (flag NEXT_PUBLIC_STUDIO_THEME_RESTORE, default off).
// Director (DIRECTOR_THEME_RESTORE_ON_CONNECT_ENABLED, MR !485) sends the session's stored theme once per connect as
// theme_sync {status: "restored"}. With the flag on, the Builder adopts it and stops sending the socket-ready set_theme that
// overwrote the stored theme with a tab's local Auto (a second tab, a reload with empty sessionStorage).
//
// Offline and self-contained (no network, no browser, no database, no repo writes unless --update / --record-off):
//  1. lib/studio-theme-restore.ts: the adapter (preset, custom, overrides, fonts, auto, null), the theme-sync state a restore
//     commits, the gate (waiting / restored / fallback, per socket and session, user pick, other sessions, late restores).
//  2. Transcripts (scripts/fixtures/studio-theme-restore/*.json) on the PR #371 harness: the REAL Director socket hook and
//     the REAL page regions (scripts/studio-chat-harness/theme-restore-transcript.mjs) replay THEME-2's recorded Director
//     frames. Every byte the tab puts on the socket is compared with the baselines: `off` was recorded from the base tree
//     (origin/studio-v4-dev-preparation-code b0c5a4a; the three `none` transcripts below from 282efbd, whose output for the
//     original nine equals b0c5a4a's byte for byte) and the flag-off branch must reproduce it byte for byte; `on` is the
//     branch with the flag on, and each transcript's expect steps pin its set_theme counts and the adopted theme.
//     `restore-syncing-other-tab` pins the settling rule: a restore whose apply is still in flight on another tab (Director
//     acknowledges only the socket that asked) is committed applied, with no 20 s timer or timeout banner, and Add Element's
//     theme preflight (ensureThemeReady -> waitForAuthoritativeTheme) proceeds at once (0 ms of virtual time, at the restore
//     and 25 s later). On the previous head that transcript fails: "Theme application timed out" after 20 s.
//     `new-session-default-theme`, `existing-pick-unchanged` and `explicit-auto-pick` pin the never-picked rule (fix-forward of
//     #387, same flag) on the REAL frames of Director origin/uat: a brand-new session's blank deck is auto-themed at creation
//     (corporate_light, stored only as applied state), so its restore is `restore:<sid>:none` with that theme and applied:true.
//     That is Director's default, not a pick: the selection stays Auto (no "Theme selected" chip), the state is committed
//     applied for the Auto fingerprint, nothing is sent. A real pick (the same theme, or an explicit Auto) ends in its request id
//     and is adopted exactly as before. On the previous head new-session-default-theme fails: Corporate Light, applied, as a chip.
//  3. Wiring pins: the hook change is types only (its transpiled JavaScript equals the base's), every new page path is
//     behind the inline flag read, .env.example and package.json document the flag.
//  4. Mutants: deliberately broken copies of the lib and the page must each be caught by 1 or 2.
//
//   node scripts/test-studio-theme-restore.mjs                     compare (also: pnpm test:studio-theme-restore)
//   node scripts/test-studio-theme-restore.mjs --update on         re-record the flag-on baselines from this tree
//   node scripts/test-studio-theme-restore.mjs --record-off <base> re-record the flag-off baselines from a base checkout
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FLAG = 'NEXT_PUBLIC_STUDIO_THEME_RESTORE'
const BASE_REF = 'b0c5a4aa35ef6b00dc503923fc2b96288f56a99e' // origin/studio-v4-dev-preparation-code when this change was made
const FIXTURES = path.join(repoRoot, 'scripts/fixtures/studio-theme-restore')
const BASELINES = path.join(FIXTURES, 'baselines')
const LIB = 'lib/studio-theme-restore.ts'
const PAGE = 'app/builder/page.tsx'
const HOOK = 'hooks/use-deckster-websocket-v2.ts'
const args = process.argv.slice(2)
const opt = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const updateMode = opt('--update')
const recordOffRoot = opt('--record-off')

installHostNetworkGuard(net, dns)
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
const { runThemeRestoreTranscript, themeRestoreRegions } = await import('./studio-chat-harness/theme-restore-transcript.mjs')
const { pretty } = await import('./studio-chat-harness/snapshot.mjs')

let checks = 0
const check = (fn, ...rest) => { checks++; return fn(...rest) }
const read = (rel, root = repoRoot) => fs.readFileSync(path.join(root, rel), 'utf8')
const fixtures = fs.readdirSync(FIXTURES).filter(name => name.endsWith('.json')).sort()
  .map(name => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8')))

// ------------------------------------------------------------------------------------------------ 1. the lib
function loadLib(root, env = {}) {
  return createModuleLoader({ root, globals: { process: { env: { NODE_ENV: 'production', ...env } }, console } }).load(LIB)
}
const CL = { mode: 'preset', preset_id: 'corporate_light' }
function unitSuite(root) {
  const lib = loadLib(root)
  const fontsOn = loadLib(root, { NEXT_PUBLIC_THEME_FONT_SELECTION_ENABLED: 'true' })
  // Values cross the vm boundary (another realm's Object), so compare their JSON form.
  const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
  const eq = (actual, expected, label) => check(assert.deepEqual, plain(actual), plain(expected), label)
  const same = (actual, expected, label) => check(assert.equal, JSON.stringify(actual), JSON.stringify(expected), label)

  // adapter: Director's normalize_build_theme_selection shapes
  same(lib.restoredThemeSelection(CL), CL, 'preset')
  same(lib.restoredThemeSelection({ mode: 'preset', preset_id: 'gilded_noir' }), { mode: 'preset', preset_id: 'gilded_noir' }, 'a preset id passes through as stored')
  same(lib.restoredThemeSelection({ mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#ffaa00', bad: 7, empty: '' } }),
    { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#ffaa00' } }, 'preset + overrides (string values only)')
  same(lib.restoredThemeSelection({ mode: 'custom', primary_hex: '#0a7d4f', secondary_hex: '#c2410c', tertiary_hex: '#111111', neutral_hex: '#eeeeee',
    harmony_preference: 'triadic', palette_mode: 'dark', color_overrides: { accent: '#ffaa00' } }),
  { mode: 'custom', primary_hex: '#0a7d4f', color_overrides: { accent: '#ffaa00' }, secondary_hex: '#c2410c', tertiary_hex: '#111111', neutral_hex: '#eeeeee',
    harmony_preference: 'triadic', palette_mode: 'dark' }, 'custom with every field, in Director\'s key order')
  same(lib.restoredThemeSelection({ mode: 'custom', color_overrides: { primary: '#123456' } }), { mode: 'custom', color_overrides: { primary: '#123456' } }, 'custom from overrides only')
  eq(lib.restoredThemeSelection({ mode: 'custom', secondary_hex: '#c2410c' }), null, 'custom without a primary or overrides is not a stored theme')
  same(lib.restoredThemeSelection({ mode: 'custom', primary_hex: '#0a7d4f', harmony_preference: 'wild', palette_mode: 'neon' }), { mode: 'custom', primary_hex: '#0a7d4f' }, 'unknown harmony / palette are dropped')
  same(lib.restoredThemeSelection({ mode: 'auto' }), { mode: 'auto' }, 'explicit auto is a stored choice')
  const fonts = { font_family: 'Inter', font_family_heading: 'Playfair Display' }
  same(lib.restoredThemeSelection({ ...CL, ...fonts }), CL, 'fonts flag off: no font key survives')
  same(lib.restoredThemeSelection({ mode: 'auto', ...fonts }), { mode: 'auto' }, 'fonts flag off: auto without fonts')
  same(fontsOn.restoredThemeSelection({ ...CL, ...fonts }), { ...CL, ...fonts }, 'fonts flag on: preset keeps both fonts')
  same(fontsOn.restoredThemeSelection({ mode: 'auto', font_family: 'inter' }), { mode: 'auto', font_family: 'Inter' }, 'fonts flag on: auto keeps its font, canonical spelling')
  same(fontsOn.restoredThemeSelection({ mode: 'custom', primary_hex: '#0a7d4f', color_overrides: { accent: '#ffaa00' }, font_family: 'Comic Sans', font_family_heading: 'Lora' }),
    { mode: 'custom', primary_hex: '#0a7d4f', color_overrides: { accent: '#ffaa00' }, font_family_heading: 'Lora' }, 'fonts flag on: custom + overrides + an unsupported font dropped')
  for (const value of [null, undefined, 'corporate_light', 7, [], {}, { mode: 'preset' }, { mode: 'preset', preset_id: '  ' }, { mode: 'brand' }]) {
    eq(lib.restoredThemeSelection(value), null, `nothing usable stored: ${JSON.stringify(value)}`)
  }

  // the never-picked rule: `restore:<sid>:none` is Director's default for the deck, not a pick
  const none = (theme, extra = {}) => ({ request_id: 'restore:s:none', presentation_id: 'blank-1', theme, applied: true, desired_status: null, ...extra })
  const AUTO = { mode: 'auto' }
  for (const id of ['restore:s:none', 'restore:sess-new-cl:none', 'x:none']) check(assert.equal, lib.isNeverPickedRestore({ request_id: id }), true, `never picked: ${id}`)
  for (const id of ['restore:s:req-1', 'restore:s:uuid-t1-corp', 'restore:s:none-1', 'restore:s:nonexistent', 'restore:s:req-none', 'restore:s:none:', 'restore:s:NONE', 'none', '', undefined, null, 7, {}]) {
    check(assert.equal, lib.isNeverPickedRestore({ request_id: id }), false, `a pick (or no id): ${JSON.stringify(id)}`)
  }
  check(assert.equal, lib.isNeverPickedRestore({}), false, 'no request id: not never picked')
  same(lib.restoredAdoptedSelection(none(CL)), AUTO, 'never picked + Director\'s default preset: Auto')
  same(lib.restoredAdoptedSelection(none({ mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#ffaa00' } })), AUTO, 'never picked: overrides are the default\'s, not a choice')
  same(lib.restoredAdoptedSelection(none({ mode: 'custom', primary_hex: '#0a7d4f', color_overrides: { accent: '#ffaa00' } })), AUTO, 'never picked + the user\'s standard theme applied by Director: Auto')
  same(lib.restoredAdoptedSelection(none(AUTO)), AUTO, 'never picked + Auto: Auto')
  same(fontsOn.restoredAdoptedSelection(none({ ...CL, font_family: 'Inter', font_family_heading: 'Lora' })), AUTO, 'never picked + fonts flag on: no font survives')
  same(fontsOn.restoredAdoptedSelection(none({ mode: 'auto', font_family: 'Inter' })), AUTO, 'never picked + fonts flag on, Auto with a font: plain Auto')
  eq(lib.restoredAdoptedSelection(none(null)), null, 'never picked + nothing stored: nothing (the null path)')
  eq(lib.restoredAdoptedSelection(none({ mode: 'preset' })), null, 'never picked + nothing usable: nothing')
  same(lib.restoredAdoptedSelection(none(CL, { request_id: 'restore:s:req-cl-1' })), CL, 'a real pick keeps its theme (also the same one as the default)')
  same(lib.restoredAdoptedSelection(none({ mode: 'custom', primary_hex: '#0a7d4f' }, { request_id: 'restore:s:req-9' })), { mode: 'custom', primary_hex: '#0a7d4f' }, 'a real custom pick is kept')
  same(lib.restoredAdoptedSelection(none(AUTO, { request_id: 'restore:s:req-auto-1', applied: false, desired_status: 'applied' })), AUTO, 'an explicit Auto pick: Auto, as a choice')
  same(fontsOn.restoredAdoptedSelection(none({ mode: 'auto', font_family: 'Inter' }, { request_id: 'restore:s:req-auto-2' })), { mode: 'auto', font_family: 'Inter' }, 'an explicit Auto pick keeps its font')
  same(lib.restoredAdoptedSelection(none(CL, { request_id: undefined })), CL, 'no request id: adopted as a stored theme, as before')

  // the theme-sync state a restore commits
  const { themeSelectionFingerprint: fp } = createModuleLoader({ root, globals: { process: { env: {} }, console } }).load('lib/theme-builder.ts')
  eq(lib.restoredThemeSync({ request_id: 'restore:s:req-1', presentation_id: 'deck-1', applied: true, desired_status: 'applied' }, CL),
    { status: 'applied', requestId: 'restore:s:req-1', presentationId: 'deck-1', themeFingerprint: fp(CL), error: null }, 'applied')
  eq(lib.restoredThemeSync({ request_id: 'restore:s:none', presentation_id: 'blank-1', applied: true, desired_status: null }, { mode: 'auto' }).status, 'applied',
    'a new session\'s blank deck: applied with no desired state')
  eq(lib.restoredThemeSync(none(CL), lib.restoredAdoptedSelection(none(CL))),
    { status: 'applied', requestId: 'restore:s:none', presentationId: 'blank-1', themeFingerprint: fp(AUTO), error: null }, 'a never-picked restore is applied for the AUTO fingerprint of the blank deck')
  check(assert.notEqual, lib.restoredThemeSync(none(CL), lib.restoredAdoptedSelection(none(CL))).themeFingerprint, fp(CL), 'and not for the default theme\'s')
  eq(lib.restoredThemeSync(none(CL, { request_id: 'restore:s:req-cl-1' }), lib.restoredAdoptedSelection(none(CL, { request_id: 'restore:s:req-cl-1' }))).themeFingerprint, fp(CL), 'a real pick is applied for its own fingerprint')
  eq(lib.restoredThemeSync({ request_id: 'r', presentation_id: 'deck-1', applied: true, desired_status: 'syncing' }, CL).status, 'applied', 'applied wins over a re-apply in flight')
  // the settling rule: another tab's apply in flight (Director acknowledges only the socket that asked) is committed applied
  eq(lib.restoredThemeSync({ request_id: 'r', presentation_id: 'deck-1', applied: false, desired_status: 'syncing' }, CL),
    { status: 'applied', requestId: 'r', presentationId: 'deck-1', themeFingerprint: fp(CL), error: null }, 'desired still syncing (another tab\'s apply): settled as applied, no error')
  for (const payload of [{ applied: false, desired_status: 'syncing' }, { applied: false, desired_status: 'applied' }, { applied: true, desired_status: 'syncing' }, { applied: true, desired_status: null }, { applied: false, desired_status: 'failed' }, { applied: false, desired_status: null }]) {
    check(assert.notEqual, lib.restoredThemeSync({ request_id: 'r', presentation_id: 'deck-1', ...payload }, CL)?.status, 'syncing', `a restore is never committed syncing: ${JSON.stringify(payload)}`)
  }
  eq(lib.restoredThemeSync({ request_id: 'r', presentation_id: 'deck-1', applied: false, desired_status: 'failed' }, CL),
    { status: 'failed', requestId: 'r', presentationId: 'deck-1', themeFingerprint: fp(CL), error: 'Director could not apply this theme.' }, 'desired failed')
  eq(lib.restoredThemeSync({ request_id: 'r', presentation_id: 'deck-1', applied: false, desired_status: 'applied' }, CL).status, 'applied', 'desired applied (Auto resolved on apply)')
  eq(lib.restoredThemeSync({ request_id: 'r', presentation_id: 'deck-1', applied: false, desired_status: null }, CL), null, 'no status: commit nothing')
  eq(lib.restoredThemeSync({ request_id: 'r', presentation_id: null, applied: true }, CL), null, 'no presentation: commit nothing')
  eq(lib.restoredThemeSync({ presentation_id: 'deck-1', applied: true }, CL), null, 'no request id: commit nothing')
  check(assert.notEqual, fp(CL), fp({ mode: 'auto' }), 'the fingerprint is the adopted selection\'s')

  // the gate
  const S = 'sess-1'
  const fresh = lib.themeRestoreGateFor(S)
  eq(fresh, { sessionId: S, phase: 'waiting', syncSeen: false }, 'fresh gate')
  check(assert.equal, lib.isFreshThemeRestoreGate(fresh, S), true, 'fresh for its session')
  check(assert.equal, lib.isFreshThemeRestoreGate(fresh, 'other'), false, 'not fresh for another session')
  const restored = (theme = CL, sid = S) => ({ type: 'theme_sync', session_id: sid, timestamp: 't', payload: { request_id: `restore:${sid}:none`, status: 'restored', presentation_id: 'p', theme, applied: true, desired_status: null } })
  const frame = (type, sid = S, payload = {}) => ({ type, session_id: sid, message_id: 'm', payload })
  const run = (frames, gate = lib.themeRestoreGateFor(null), sid = S) => frames.reduce((acc, f) => {
    const step = lib.advanceThemeRestoreGate(acc.gate, sid, f)
    return { gate: step.gate, steps: [...acc.steps, step] }
  }, { gate, steps: [] })
  // reconnect: sync_response, restore, history
  let r = run([frame('sync_response'), restored(), frame('chat_message'), frame('chat_message')])
  eq(r.gate, { sessionId: S, phase: 'restored', syncSeen: true }, 'reconnect: restored')
  eq(r.steps.map(s => [Boolean(s.restore), s.consumed]), [[false, false], [true, true], [false, false], [false, false]], 'reconnect: one restore, consumed')
  // new session: initial theme_sync, blank deck, restore, greeting
  r = run([frame('theme_sync', S, { request_id: 'initial:p', status: 'applied' }), frame('presentation_init'), restored({ mode: 'auto' }), frame('chat_message')])
  eq(r.gate.phase, 'restored', 'new session: restored')
  eq(r.steps[0].consumed, false, 'the initial theme_sync goes on to the page\'s ordinary handling')
  // Director off: reconnect falls back on the first non-theme_sync frame after sync_response, a new session on the greeting
  eq(run([frame('sync_response'), frame('theme_sync', S, { request_id: 'x', status: 'applied' })]).gate.phase, 'waiting', 'a theme_sync ack is not the fallback signal')
  eq(run([frame('sync_response'), frame('slide_update')]).gate.phase, 'fallback', 'reconnect: slide_update after sync_response falls back')
  eq(run([frame('sync_response'), frame('chat_message')]).gate.phase, 'fallback', 'reconnect: history replay falls back')
  eq(run([frame('theme_sync', S, { request_id: 'initial:p', status: 'applied' }), frame('presentation_init'), frame('slide_update')]).gate.phase, 'waiting', 'new session: deck frames are not the signal')
  eq(run([frame('presentation_init'), frame('chat_message')]).gate.phase, 'fallback', 'new session: the greeting falls back')
  // late and repeated restores are no-ops, but still consumed
  r = run([frame('presentation_init'), frame('chat_message'), restored()])
  eq([r.gate.phase, Boolean(r.steps[2].restore), r.steps[2].consumed], ['fallback', false, true], 'a restore after the fallback is ignored')
  r = run([frame('sync_response'), restored(), restored({ mode: 'auto' })])
  eq([Boolean(r.steps[1].restore), Boolean(r.steps[2].restore), r.steps[2].consumed], [true, false, true], 'a second restore on the socket is ignored')
  // sessions
  r = run([frame('sync_response', 'other'), restored(CL, 'other'), frame('chat_message', 'other')])
  eq([r.gate.phase, r.steps.map(s => Boolean(s.restore)).includes(true), r.steps[1].consumed], ['waiting', false, true], 'frames of another session change nothing (a restore is still consumed)')
  r = run([frame('sync_response', undefined), { ...restored(), session_id: undefined }])
  eq([r.gate.phase, Boolean(r.steps[1].restore)], ['waiting', false], 'a restore must name the session; a frame without one still counts for the fallback')
  eq(run([frame('sync_response', null), frame('chat_message', null)]).gate.phase, 'fallback', 'frames without a session id drive the fallback')
  eq(run([restored()], lib.themeRestoreGateFor(null), null).gate, lib.themeRestoreGateFor(null), 'no displayed session: the gate does not move')
  r = run([frame('sync_response'), restored()], { sessionId: 'old', phase: 'restored', syncSeen: true })
  eq(r.gate, { sessionId: S, phase: 'restored', syncSeen: true }, 'a gate of another session restarts fresh for this one')
  // a sync_response later on the socket (plan acceptance) never reopens a resolved gate
  r = run([frame('sync_response'), restored(), frame('sync_response'), frame('chat_message')])
  eq(r.gate.phase, 'restored', 'mid-session sync_response keeps the restore')
  // holds
  const fallback = { sessionId: S, phase: 'fallback', syncSeen: true }
  eq([lib.themeRestoreHoldsSocketSync(fresh, S, false), lib.themeRestoreHoldsSocketSync({ ...fresh, phase: 'restored' }, S, false),
    lib.themeRestoreHoldsSocketSync(fallback, S, false), lib.themeRestoreHoldsSocketSync(fallback, 'other', false),
    lib.themeRestoreHoldsSocketSync(fresh, S, true), lib.themeRestoreHoldsSocketSync({ ...fresh, phase: 'restored' }, S, true)],
  [true, true, false, true, false, false], 'holds: waiting and restored hold, the fallback releases (own session only), a user pick always goes')
  eq(lib.advanceThemeRestoreGate(fresh, S, frame('chat_message')).gate !== fresh, true, 'a transition returns a new gate')
  eq(lib.advanceThemeRestoreGate(r.gate, S, frame('chat_message')).gate === r.gate, true, 'no transition keeps the gate object (no render)')
}

// ------------------------------------------------------------------------------------------------ 2. transcripts
const baselineFiles = result => ({
  'outbound.ndjson': result.outbound,
  'state.json': pretty({ checkpoints: result.state, calls: result.calls, notes: result.notes, diagnostics: result.diagnostics }),
})
async function transcriptSuite(root, { modes = ['off', 'on'], only = null } = {}) {
  const summary = []
  for (const fixture of fixtures) {
    if (only && !only.includes(fixture.name)) continue
    for (const mode of modes) {
      const result = await runThemeRestoreTranscript({ root, fixture, mode })
      check(assert.deepEqual, result.failures, [], `${fixture.name} [${mode}] expect steps`)
      check(assert.deepEqual, [result.diagnostics.blockedNetwork, result.diagnostics.uncaught], [[], []], `${fixture.name} [${mode}] offline, no timer errors`)
      const files = baselineFiles(result)
      const dir = path.join(BASELINES, fixture.name, mode)
      for (const [name, text] of Object.entries(files)) {
        const file = path.join(dir, name)
        check(assert.ok, fs.existsSync(file), `${fixture.name} [${mode}] baseline ${name} exists (record it with --update on / --record-off <base>)`)
        const expected = fs.readFileSync(file, 'utf8')
        if (expected !== text) {
          const a = expected.split('\n'), b = text.split('\n')
          const at = a.findIndex((line, i) => line !== b[i])
          throw new assert.AssertionError({ message: `${fixture.name} [${mode}] ${name} differs from the baseline at line ${at + 1}:\n  baseline: ${a[at]?.slice(0, 220)}\n  actual:   ${b[at]?.slice(0, 220)}` })
        }
        checks++
      }
      summary.push({ fixture: fixture.name, mode, setTheme: result.setThemes.map(s => `${s.socket}@${s.at}:${JSON.stringify(s.theme)}`) })
    }
  }
  return summary
}

async function record(root, mode) {
  for (const fixture of fixtures) {
    const result = await runThemeRestoreTranscript({ root, fixture, mode })
    if (result.failures.length) throw new Error(`${fixture.name} [${mode}] expect steps fail on ${root}:\n  ${result.failures.join('\n  ')}`)
    const dir = path.join(BASELINES, fixture.name, mode)
    fs.mkdirSync(dir, { recursive: true })
    for (const [name, text] of Object.entries(baselineFiles(result))) fs.writeFileSync(path.join(dir, name), text)
    console.log(`recorded ${fixture.name} [${mode}] from ${root}: ${result.setThemes.length} set_theme`)
  }
}

if (updateMode) {
  assert.equal(updateMode, 'on', '--update only re-records the flag-on baselines; flag-off ones come from the base tree (--record-off <base>)')
  await record(repoRoot, 'on')
  process.exit(0)
}
if (recordOffRoot) {
  await record(path.resolve(recordOffRoot), 'off')
  process.exit(0)
}

// ------------------------------------------------------------------------------------------------ 3. wiring pins
function wiringSuite(src) {
  const page = src[PAGE]
  const count = (text, needle) => text.split(needle).length - 1
  check(assert.equal, count(page, `process.env.${FLAG} === 'true'`), 3, 'page: the flag is read inline (onMessage, the effect\'s hold and its dependency)')
  check(assert.equal, count(page, `process.env.${FLAG} !== 'true'`), 1, 'page: the reset effect returns at once with the flag off')
  check(assert.ok, page.includes(`if (process.env.${FLAG} === 'true' && observeThemeRestoreFrame(message)) return`), 'page: onMessage observes only with the flag on')
  check(assert.ok, page.includes(`process.env.${FLAG} === 'true' ? themeRestoreGate : null,`), 'page: the effect dependency is a constant with the flag off')
  const observe = page.slice(page.indexOf('const observeThemeRestoreFrame = useCallback'), page.indexOf('const standardThemeLoadedRef'))
  check(assert.ok, observe.length > 0 && !observe.includes('themeSelectionChangedLocallyRef.current ='), 'page: a restore never marks a user pick')
  check(assert.ok, !observe.includes('sendThemeSelection') && !observe.includes('requestThemeSyncForPresentation'), 'page: a restore never sends')
  check(assert.ok, observe.includes('const selection = restoredAdoptedSelection(restore)') && !observe.includes('restoredThemeSelection('), 'page: the adopted selection comes through the never-picked rule')
  check(assert.ok, observe.includes('restoredThemeSync(restore, selection)'), 'page: the committed state is fingerprinted with the adopted selection (Auto for a never-picked restore)')
  check(assert.ok, !observe.includes('setTimeout') && !observe.includes('THEME_SYNC_TIMEOUT_MS') && !observe.includes('themeSyncTimeoutRef'), 'page: a restore arms no timer (settled, see restoredThemeSync)')
  check(assert.equal, count(page, 'from \'@/lib/studio-theme-restore\''), 1, 'page imports the lib once')
  const hook = src[HOOK]
  check(assert.ok, !hook.includes('studio-theme-restore') && !hook.includes(`process.env.${FLAG}`), 'hook: no import, no flag read (types only)')
  check(assert.ok, hook.includes("debugLog('🎨 Theme sync response:', message.payload);"), 'hook: the reducer still only logs theme_sync')
  check(assert.ok, /status: 'restored';\n\s+presentation_id\?: string \| null;\n\s+theme: Record<string, unknown> \| null;\n\s+applied: boolean;\n\s+desired_status\?: 'syncing' \| 'applied' \| 'failed' \| null;/.test(hook), 'hook: the restored payload type')
  const env = src['.env.example']
  check(assert.ok, env.includes(`\n${FLAG}="false"\n`), '.env.example documents the flag, default off')
  check(assert.equal, JSON.parse(src['package.json']).scripts['test:studio-theme-restore'], 'node scripts/test-studio-theme-restore.mjs', 'package.json runs this test')
}
const SRC = Object.fromEntries([PAGE, HOOK, LIB, '.env.example', 'package.json'].map(rel => [rel, read(rel)]))
wiringSuite(SRC)

// The hook change is types only: the restored payload member adds no JavaScript, and without it the hook is the base's
// text exactly (checked while no later change has touched the hook; after one has, the member-only check still applies).
const RESTORED_MEMBER = / \| \{\n {4}\/\/ THEME-RESET-ON-RECONNECT-P1[\s\S]*?desired_status\?: 'syncing' \| 'applied' \| 'failed' \| null;\n {2}\}/
const js = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, removeComments: true } }).outputText
const hookWithoutMember = SRC[HOOK].replace(RESTORED_MEMBER, '')
check(assert.notEqual, hookWithoutMember, SRC[HOOK], 'hook: the restored payload member is present')
check(assert.equal, js(SRC[HOOK]), js(hookWithoutMember), 'hook: the restored payload member is type syntax only')
let hookVsBase = 'base not reachable in git, skipped'
try {
  const baseHook = execFileSync('git', ['show', `${BASE_REF}:${HOOK}`], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })
  if (hookWithoutMember === baseHook) {
    check(assert.equal, js(SRC[HOOK]), js(baseHook), 'hook: transpiled JavaScript identical to the base')
    hookVsBase = 'the base text plus the type member only; transpiled JS identical'
  } else {
    hookVsBase = 'the hook has other changes since the base; the member-only check applies'
  }
} catch { /* the base object is not in this clone */ }

unitSuite(repoRoot)
const summary = await transcriptSuite(repoRoot)
const mainChecks = checks

// ------------------------------------------------------------------------------------------------ 4. mutants
// A scratch tree that is the repo except the mutated files (symlinks), so the loader and the AST extraction read the mutant.
function scratchTree(overrides) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-theme-restore-mutant-'))
  const mirror = rel => {
    for (const entry of fs.readdirSync(path.join(repoRoot, rel))) {
      const child = rel ? `${rel}/${entry}` : entry
      if (child in overrides) fs.writeFileSync(path.join(dir, child), overrides[child])
      else if (Object.keys(overrides).some(file => file.startsWith(`${child}/`))) { fs.mkdirSync(path.join(dir, child)); mirror(child) }
      else fs.symlinkSync(path.join(repoRoot, child), path.join(dir, child))
    }
  }
  mirror('')
  return dir
}
const MUTANTS = [
  // the lib
  ['adapter drops a preset\'s overrides', LIB, '      ...(overrides ? { color_overrides: overrides } : {}),\n', ''],
  ['adapter reads explicit Auto as nothing stored', LIB, "if (theme.mode === 'auto') return { mode: 'auto', ...fonts }", "if (theme.mode === 'auto') return null"],
  ['adapter drops fonts', LIB, 'const fonts = themeFontFields(theme)', 'const fonts = {}'],
  ['restore ignores applied', LIB, "if (payload.applied === true) return 'applied'", "if (payload.applied === 'yes') return 'applied'"],
  // the settling rule (another tab's apply in flight): the unit rows catch the first; the second is held to the new transcript alone
  ['syncing restore left syncing', LIB, "return payload.desired_status === 'syncing' || payload.desired_status === 'applied' ? 'applied' : null", "return payload.desired_status === 'syncing' ? 'syncing' : payload.desired_status === 'applied' ? 'applied' : null"],
  ['syncing restore left syncing (transcripts only)', LIB, "return payload.desired_status === 'syncing' || payload.desired_status === 'applied' ? 'applied' : null", "return payload.desired_status === 'syncing' ? 'syncing' : payload.desired_status === 'applied' ? 'applied' : null", 'transcripts'],
  ['syncing restore not settled (null)', LIB, "return payload.desired_status === 'syncing' || payload.desired_status === 'applied' ? 'applied' : null", "return payload.desired_status === 'applied' ? 'applied' : null", 'transcripts'],
  ['failed restore settled as applied', LIB, "if (payload.desired_status === 'failed') return 'failed'", "if (payload.desired_status === 'failed') return 'applied'"],
  ['settled restore carries no fingerprint', LIB, '    themeFingerprint: themeSelectionFingerprint(selection),\n    error: status', '    themeFingerprint: null,\n    error: status', 'transcripts'],
  ['no greeting fallback on a new session', LIB, " || frame.type === 'chat_message'", ''],
  ['restored frames read as the fallback', LIB, "if (frame.type === 'theme_sync') {", "if (frame.type === 'theme_sync' && false) {"],
  ['restore of another session adopted', LIB, 'if (!sessionId || (frameSession !== null && frameSession !== sessionId)) {', 'if (!sessionId) {'],
  ['user pick held', LIB, '  if (userPicked) return false\n', ''],
  ['gate never holds', LIB, "return !(gate.sessionId === sessionId && gate.phase === 'fallback')", 'return false'],
  ['late restore adopted', LIB, "if (current.phase !== 'waiting' || frameSession !== sessionId)", 'if (frameSession !== sessionId)'],
  ['sync_response not seen', LIB, '? { ...current, syncSeen: true } : current', '? current : current'],
  // the never-picked rule (fix-forward of #387): `restore:<sid>:none` is Director's default for the deck, not a pick
  ['never-picked rule off (":none" is a pick)', LIB, "return isNeverPickedRestore(payload) ? { mode: 'auto' } : stored", 'return stored'],
  ['every restore is never picked', LIB, 'return nonEmptyString(payload.request_id) && payload.request_id.endsWith(THEME_RESTORE_NEVER_PICKED_SUFFIX)', 'return true'],
  ['":none" matched anywhere in the id', LIB, 'payload.request_id.endsWith(THEME_RESTORE_NEVER_PICKED_SUFFIX)', 'payload.request_id.includes(THEME_RESTORE_NEVER_PICKED_SUFFIX)'],
  ['"none" matched without its colon', LIB, "export const THEME_RESTORE_NEVER_PICKED_SUFFIX = ':none'", "export const THEME_RESTORE_NEVER_PICKED_SUFFIX = 'none'"],
  ['never-picked Auto keeps the default\'s fields', LIB, "return isNeverPickedRestore(payload) ? { mode: 'auto' } : stored", "return isNeverPickedRestore(payload) ? { ...stored, mode: 'auto' } : stored"],
  ['an explicit Auto pick read as never picked', LIB, 'return nonEmptyString(payload.request_id) && payload.request_id.endsWith(THEME_RESTORE_NEVER_PICKED_SUFFIX)',
    "return (nonEmptyString(payload.request_id) && payload.request_id.endsWith(THEME_RESTORE_NEVER_PICKED_SUFFIX)) || (isRecord(payload.theme) && payload.theme.mode === 'auto')"],
  ['page bypasses the never-picked rule', PAGE, 'const selection = restoredAdoptedSelection(restore)', 'const selection = restoredThemeSelection(restore.theme)'],
  ['never-picked state fingerprinted with the default theme', PAGE, 'const sync = restoredThemeSync(restore, selection)', 'const sync = restoredThemeSync(restore, restoredThemeSelection(restore.theme) ?? selection)'],
  ['never-picked restore commits nothing', PAGE, 'const sync = restoredThemeSync(restore, selection)', 'const sync = isNeverPickedRestore(restore) ? null : restoredThemeSync(restore, selection)'],
  // the page
  ['onMessage skips the gate', PAGE, `if (process.env.${FLAG} === 'true' && observeThemeRestoreFrame(message)) return`, `if (process.env.${FLAG} === 'never' && observeThemeRestoreFrame(message)) return`],
  ['flag read as anything but false', PAGE, `if (process.env.${FLAG} === 'true' && observeThemeRestoreFrame(message)) return`, `if (process.env.${FLAG} !== 'false' && observeThemeRestoreFrame(message)) return`],
  ['socket-ready send not held', PAGE, '&& themeRestoreHoldsSocketSync(themeRestoreGateRef.current, themeRestoreSessionRef.current, themeSelectionChangedLocallyRef.current)', '&& false'],
  ['restore overwrites a user pick', PAGE, 'if (!restore || themeSelectionChangedLocallyRef.current) return step.consumed', 'if (!restore) return step.consumed'],
  ['restore counts as a user pick', PAGE, '    setBuildThemeSelection(selection)\n    const sync = restoredThemeSync(restore, selection)', '    setBuildThemeSelection(selection)\n    themeSelectionChangedLocallyRef.current = true\n    const sync = restoredThemeSync(restore, selection)'],
  ['restore arms a 20 s timer again', PAGE, '      commitThemeSync(sync)\n      // No timer:', "      commitThemeSync(sync)\n      themeSyncTimeoutRef.current = setTimeout(() => commitThemeSync({ ...sync, status: 'failed', error: 'Theme application timed out. Reapply the deck theme or reconnect, then generate again.' }), THEME_SYNC_TIMEOUT_MS)\n      // No timer:"],
  ['restore commits no theme-sync state', PAGE, '      commitThemeSync(sync)\n      // No timer:', '      void sync\n      // No timer:'],
  ['gate never reset per socket', PAGE, 'commitThemeRestoreGate(themeRestoreGateFor(themeRestoreSession))', 'void themeRestoreSession'],
  ['fallback never re-runs the effect', PAGE, `process.env.${FLAG} === 'true' ? themeRestoreGate : null,`, 'null,'],
]
let caught = 0
const caughtBy = []
const firstLine = error => String(error?.message ?? error).split('\n')[0].slice(0, 110)
for (const [name, rel, from, to, only] of MUTANTS) {
  const source = SRC[rel]
  assert.ok(source.includes(from), `mutant "${name}": anchor not found in ${rel}`)
  const mutated = source.replace(from, to)
  const dir = scratchTree({ [rel]: mutated })
  let by = null
  try {
    if (only !== 'transcripts') try { unitSuite(dir) } catch (error) { by = `unit: ${firstLine(error)}` }
    if (!by) try { await transcriptSuite(dir) } catch (error) { by = `transcripts: ${firstLine(error)}` }
    if (!by) try { wiringSuite({ ...SRC, [rel]: mutated }) } catch (error) { by = `wiring: ${firstLine(error)}` }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  assert.ok(by, `MUTANT SURVIVED: ${name}`)
  caughtBy.push(`  ${name.padEnd(44)} ${by}`)
  caught++
}

console.log('mutants (each caught by):')
for (const line of caughtBy) console.log(line)
console.log('transcripts (set_theme sent: socket@virtual ms:theme):')
for (const row of summary) console.log(`  ${row.fixture.padEnd(32)} ${row.mode.padEnd(3)} ${row.setTheme.length}  ${row.setTheme.join('  ')}`)
console.log(`studio theme restore: ${mainChecks} checks passed; ${fixtures.length} transcripts x 2 modes match their baselines (off = base ${BASE_REF.slice(0, 7)}, and 282efbd for the never-picked transcripts); `
  + `hook vs base: ${hookVsBase}; ${caught}/${MUTANTS.length} mutants caught; `
  + `page regions: ${themeRestoreRegions(repoRoot).anchors.length}`)
