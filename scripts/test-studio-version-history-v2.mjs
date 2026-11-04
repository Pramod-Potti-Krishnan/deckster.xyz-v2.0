// VERSION-HISTORY-V2 (flag NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2, exact "true", default off; Pass 2 row PRO-09): the deck's Version history works in Studio, and Restore never overwrites.
// Offline and self-contained: no network, no browser, no install needed. The repo root is found from this file.
//   1. It loads the import-free lib (lib/studio-version-history-v2.ts) and the import-free slide-ops lib on their own (types stripped by node, or by `typescript` when node cannot) and drives the
//      lib's pure parts: the flag, the envelope the Layout viewer reads, the reply parser, the words, the restore rules, the profile menu's bridge.
//   2. It runs the whole restore against a small model of Layout's contract (the viewer's {action, params, requestId} handler, forceSave, Layout's restore with its backup written first, the
//      save-status messages): a pending edit is saved before the restore goes out, the safety copy holds it, any refusal stops the restore, and the OLD {command} envelope gets no answer.
//   3. It checks the lib against scripts/fixtures/studio-version-history-v2/layout-contract.json and, when the Layout source is reachable (LAYOUT_BUILDER_DIR, or ~/Software/Deckster/backend/layout-builder
//      at origin/uat), against the real viewer and storage source.
//   4. It reads the REAL panel, menu item, viewer and profile-menu sources: the panel's restore is wired through the rule, every line added to the viewer and the profile menu carries the mark and,
//      with the marked lines removed, both files are the base's; the old panel is untouched; the flag is read in one place; the env example and the script are registered.
//   5. Then every suite re-runs against deliberately broken copies (a restore that does not save first, a restore without Layout's backup, the old {command} envelope, ...): each mutant must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import * as nodeModule from 'node:module'
import { stripP2Polish } from './studio-p2-polish-strip.mjs'
import { stripLaunchWording } from './studio-launch-wording-strip.mjs' // NEXT_PUBLIC_STUDIO_LAUNCH_WORDING (launched wording): its flag-gated edits come out first, before every older change's strip
import { stripFirstPaint } from './studio-first-paint-strip.mjs' // stacked: NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED (COMPOSER-2 first paint): its flag-gated viewer lines come out first, inside read(), next to stripLaunchWording
import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (PASS3-POLISH-B)

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const FLAG = 'NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2'
const MARK = 'VERSION-HISTORY-V2'
const BASE_COMMIT = process.env.VERSION_HISTORY_V2_BASE || '55cef1d'
const FILES = {
  lib: 'lib/studio-version-history-v2.ts',
  slide: 'lib/studio-slide-ops-via-viewer.ts',
  panel: 'components/version-history-panel-v2.tsx',
  css: 'components/version-history-panel-v2.css',
  item: 'components/version-history-menu-item.tsx',
  viewer: 'components/presentation-viewer.tsx',
  menu: 'components/user-profile-menu.tsx',
  menuP2: 'components/user-profile-menu-p2.tsx',
  oldPanel: 'components/version-history-panel.tsx',
}
// the Pass 2 polish change (scripts/test-studio-p2-polish.mjs) is put back out first: this test holds the files as this feature's change left them
const read = rel => stripP2Polish(rel, stripFirstPaint(rel, stripLaunchWording(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))))) // LATER-CHANGES: registry read (PASS3-POLISH-B)
const SRC = Object.fromEntries(Object.entries(FILES).map(([key, rel]) => [key, read(rel)]))
const CONTRACT = JSON.parse(read('scripts/fixtures/studio-version-history-v2/layout-contract.json'))
const git = args => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
function baseSource(rel) {
  try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]); return git(['show', `${BASE_COMMIT}:${rel}`]) } catch { return null }
}

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ---------------------------------------------------------------- loader: strip the types, import the module (one file each, no repo imports)
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vh2-test-'))
process.on('exit', () => { try { fs.rmSync(scratch, { recursive: true, force: true }) } catch { /* ignore */ } })
async function makeStripper() {
  if (typeof nodeModule.stripTypeScriptTypes === 'function') {
    return source => {
      const emit = process.emitWarning
      process.emitWarning = () => {}
      try { return nodeModule.stripTypeScriptTypes(source) } finally { process.emitWarning = emit }
    }
  }
  const ts = (await import('typescript')).default
  return source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
}
const strip = await makeStripper()
let loaded = 0
async function load(rel, source, env = {}) {
  const importsOf = [...source.matchAll(/^import\s.*$/gm)]
  assert.equal(importsOf.length, 0, `${rel} is import-free`)
  const file = path.join(scratch, `m${++loaded}.mjs`)
  fs.writeFileSync(file, strip(source))
  const before = process.env[FLAG]
  if (FLAG in env) process.env[FLAG] = env[FLAG]; else delete process.env[FLAG]
  try { return await import(pathToFileURL(file).href) } finally { if (before === undefined) delete process.env[FLAG]; else process.env[FLAG] = before }
}

// ---------------------------------------------------------------- a fake clock and a fake channel
function createClock() {
  let now = 0
  let next = 1
  const timers = new Map()
  return {
    setTimer(callback, ms) { const id = next++; timers.set(id, { at: now + ms, callback }); return id },
    clearTimer(id) { timers.delete(id) },
    advance(ms) {
      now += ms
      for (const [id, timer] of [...timers]) if (timer.at <= now && timers.has(id)) { timers.delete(id); timer.callback() }
    },
    pending: () => timers.size,
  }
}
/** A scenario whose answer never comes (a broken restore that waits for a reply to a message the viewer ignores) must fail, not hang the run. */
function bounded(promise, label, ms = 2000) {
  let timer
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`hung: ${label}`)), ms) })
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer))
}
const tick = async (n = 6) => { for (let i = 0; i < n; i++) await Promise.resolve() }
const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)) }

/**
 * A model of what Studio relies on in Layout (scripts/fixtures/studio-version-history-v2/layout-contract.json): the viewer reads {action, params, requestId} and drops anything else, answers with
 * the action and the request id, saves the canvas on forceSave and says so with a saveStatusChanged message; Layout's restore stores the current deck as a new version BEFORE it replaces it
 * (createBackup defaults to true unless the command says false) and does not run when that cannot be written. `guard` is Layout's LAYOUT_AUTOSAVE_FLUSH_WHILE_SAVING_ENABLED save-before-restore.
 */
function createLayout(options = {}) {
  const state = {
    stored: { slides: ['A1', 'A2'] },
    canvas: { slides: ['A1', 'A2'] },
    pending: false,
    versions: [
      { version_id: 'v_old2', created_at: '2026-10-20T10:00:00Z', created_by: 'user', change_summary: 'Updated slide 1', presentation_id: 'p1', data: { slides: ['O2'] } },
      { version_id: 'v_old1', created_at: '2026-10-19T10:00:00Z', created_by: 'user', change_summary: 'Updated slide 2', presentation_id: 'p1', data: { slides: ['O1'] } },
    ],
    posted: [],
    reloaded: false,
    ignored: [],
    backupWorks: true,
    forceSaveWorks: true,
    emitCleanAfterForceSave: true,
    saveLands: true,
    historyError: null,
    swallowRestore: false,
    currentVersionId: 'current',
    onReload: null,
    answerRestore: true,
    guard: false,
    ...options,
  }
  const listeners = new Set()
  const emit = data => { for (const listener of [...listeners]) listener(data) }
  const reply = (message, payload) => setImmediate(() => emit({ ...payload, action: message.action, ...(message.requestId ? { requestId: message.requestId } : {}) }))
  let clock = 0
  const stamp = () => new Date(Date.UTC(2026, 9, 21, 12, 0, clock++)).toISOString()
  const copy = deck => JSON.parse(JSON.stringify(deck))
  state.edit = () => { state.canvas = { slides: ['A1', 'A2-edited'] }; state.pending = true; emit({ type: 'saveStatusChanged', status: 'unsaved', hasPendingChanges: true }) }
  state.saveCanvas = () => {
    state.versions.unshift({ version_id: `v_auto${clock}`, created_at: stamp(), created_by: 'user', change_summary: 'Auto-save from editor', presentation_id: 'p1', data: copy(state.stored) })
    state.stored = copy(state.canvas)
    state.pending = false
  }
  state.receive = message => { // the viewer's message handler
    state.posted.push(message)
    const { action, params, requestId } = message || {}
    if (!action) { state.ignored.push(message); return } // "postMessage received without action"
    if (action === 'forceSave') {
      if (!state.forceSaveWorks) return reply(message, { success: false, error: 'Unsaved edits could not be saved. Retry Save.' })
      setImmediate(() => { // the real viewer's save takes a request or two: the acknowledgement and the "saved" message come after it, not with the command
        if (state.pending && state.saveLands) state.saveCanvas()
        if (state.emitCleanAfterForceSave) emit({ type: 'saveStatusChanged', status: 'saved', hasPendingChanges: false })
        emit({ success: true, action, ...(requestId ? { requestId } : {}) })
      })
      return
    }
    if (action === 'getVersionHistory') {
      if (state.historyError) return reply(message, { success: false, error: state.historyError })
      return reply(message, { success: true, presentationId: 'p1', currentVersionId: state.currentVersionId, versions: state.versions.map(({ data, ...row }) => row) })
    }
    if (action === 'restoreVersion') {
      if (state.guard && state.pending) return reply(message, { success: false, error: 'Unsaved edits could not be saved, so the slide was not changed. Retry Save, then try again.' })
      if (state.swallowRestore) return // a restore that never reached Layout
      const target = state.versions.find(version => version.version_id === params?.versionId)
      if (!target) return reply(message, { success: false, error: `Version ${params?.versionId} not found for presentation p1` })
      if (params?.createBackup !== false) {
        if (!state.backupWorks) return reply(message, { success: false, error: `Version ${params?.versionId} not found for presentation p1` }) // Layout: the restore returns None, the route answers 404
        state.versions.unshift({ version_id: `v_backup${clock}`, created_at: stamp(), created_by: 'system', change_summary: `Pre-restore backup before reverting to ${params.versionId}`, presentation_id: 'p1', data: copy(state.stored) })
      }
      state.stored = copy(target.data)
      state.canvas = copy(target.data)
      state.pending = false
      state.reloaded = params?.reload !== false
      if (state.answerRestore) reply(message, { success: true, message: `Presentation restored to version ${params.versionId}` })
      if (state.reloaded && state.onReload) setImmediate(state.onReload) // the viewer reloads itself right after it asked Layout to restore
      return
    }
    reply(message, { success: false, error: `Unknown action ${action}` })
  }
  state.listen = handler => { listeners.add(handler); return () => listeners.delete(handler) }
  return state
}

/** Studio's side, wired like components/version-history-panel-v2.tsx: the tracker records every message of the viewer; one channel posts and listens. */
function createStudio({ lib, slide, layout, clock }) {
  const tracker = slide.createSaveStatusTracker(clock)
  layout.listen(data => tracker.record(data))
  let ids = 0
  const channel = {
    post: message => layout.receive(message),
    listen: handler => layout.listen(handler),
    newRequestId: () => `req-${++ids}`,
  }
  const phases = []
  const restore = versionId => bounded(lib.restoreVersionSafely({
    versionId,
    onPhase: phase => phases.push(phase),
    saveCurrent: () => slide.flushViewerBeforeRestore({
      tracker,
      forceSave: () => slide.requestViewerAck(channel, 'forceSave', {}, slide.RESTORE_FLUSH_ACK_TIMEOUT_MS, clock),
      saveTimeoutMs: slide.RESTORE_FLUSH_SAVE_TIMEOUT_MS,
    }),
    sendRestore: request => lib.restoreResultFromAck(slide.requestViewerAck(channel, request.action, request.params, lib.VERSION_RESTORE_TIMEOUT_MS, clock)),
  }), 'the restore')
  const fetchList = () => bounded((async () => {
    const request = lib.getVersionHistoryRequest()
    return lib.parseVersionHistoryReply(await slide.requestViewerAck(channel, request.action, request.params, lib.VERSION_HISTORY_FETCH_TIMEOUT_MS, clock))
  })(), 'the list')
  return { tracker, channel, phases, restore, fetchList }
}

// ---------------------------------------------------------------- suite 1: the lib's pure parts
async function libSuite(lib, slide, c) {
  // the flag
  const flagOf = async env => (await load(FILES.lib, lib.__source, env)).STUDIO_VERSION_HISTORY_V2_ENABLED
  c(assert.equal, await flagOf({}), false, 'default off')
  for (const value of ['', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'false', 'on']) c(assert.equal, await flagOf({ [FLAG]: value }), false, `flag "${value}" is off`)
  c(assert.equal, await flagOf({ [FLAG]: 'true' }), true, 'exact "true" is on')

  // the envelope the viewer reads: {action, params}, never {command}
  c(assert.deepEqual, lib.getVersionHistoryRequest(), { action: 'getVersionHistory', params: {} })
  c(assert.deepEqual, lib.restoreVersionRequest('v_1'), { action: 'restoreVersion', params: { versionId: 'v_1', createBackup: true, reload: true } })
  for (const id of ['v_20261021_120000_abcd1234', 'x', 'with space', '1']) {
    const request = lib.restoreVersionRequest(id)
    c(assert.equal, request.params.createBackup, true, `${id}: always with Layout's backup`)
    c(assert.equal, request.params.versionId, id)
    c(assert.equal, 'command' in request, false, 'no command key')
  }
  c(assert.equal, 'command' in lib.getVersionHistoryRequest(), false, 'no command key')
  for (const bad of ['', '   ', undefined, null, 5, {}]) c(assert.throws, () => lib.restoreVersionRequest(bad), /version id is required/, `a restore needs a version id (${String(bad)})`)

  // the reply parser
  const row = (id, at, by = 'user', summary = 'Updated slide 1') => ({ version_id: id, created_at: at, created_by: by, change_summary: summary, presentation_id: 'p1' })
  const parsed = lib.parseVersionHistoryReply({ success: true, action: 'getVersionHistory', presentationId: 'p1', currentVersionId: 'cur', versions: [row('a', '2026-10-01T10:00:00Z'), row('c', '2026-10-03T10:00:00Z'), row('b', '2026-10-02T10:00:00Z')] })
  c(assert.equal, parsed.ok, true)
  c(assert.deepEqual, parsed.history.versions.map(v => v.versionId), ['c', 'b', 'a'], 'newest first, whatever order Layout sent')
  c(assert.equal, parsed.history.currentVersionId, 'cur')
  c(assert.deepEqual, parsed.history.versions[0], { versionId: 'c', createdAt: '2026-10-03T10:00:00Z', createdBy: 'user', changeSummary: 'Updated slide 1' })
  const ties = lib.parseVersionHistoryReply({ success: true, versions: [row('x', '2026-10-01T10:00:00Z'), row('y', '2026-10-01T10:00:00Z'), row('z', 'not a date'), row('w', '2026-10-05T10:00:00Z')] })
  c(assert.deepEqual, ties.history.versions.map(v => v.versionId), ['w', 'x', 'y', 'z'], 'equal times keep Layout\'s order, an unreadable time goes last')
  const odd = lib.parseVersionHistoryReply({ success: true, versions: [null, 5, {}, { version_id: '' }, { version_id: 'ok' }, { version_id: 'ok2', created_at: 5, created_by: 7, change_summary: '   ' }] })
  c(assert.deepEqual, odd.history.versions, [{ versionId: 'ok', createdAt: '', createdBy: '', changeSummary: null }, { versionId: 'ok2', createdAt: '', createdBy: '', changeSummary: null }], 'rows without an id are dropped, odd fields are blanked')
  c(assert.deepEqual, lib.parseVersionHistoryReply({ success: true }), { ok: true, history: { versions: [], currentVersionId: '' } }, 'no versions yet is an empty list, not an error')
  c(assert.deepEqual, lib.parseVersionHistoryReply({ success: false, error: 'Presentation not found' }), { ok: false, message: 'Presentation not found' })
  for (const bad of [null, undefined, 'x', 5, {}, { success: 'true' }, { success: false }, { success: false, error: '  ' }, { success: false, error: 7 }]) {
    const result = lib.parseVersionHistoryReply(bad)
    c(assert.equal, result.ok, false, `not a good reply: ${JSON.stringify(bad)}`)
    c(assert.equal, result.message, bad && typeof bad === 'object' && typeof bad.error === 'string' && bad.error.trim() ? bad.error.trim() : lib.VERSION_HISTORY_FAILED_MESSAGE)
  }

  // the words
  const now = new Date(2026, 9, 21, 12, 0, 0)
  const ago = ms => new Date(now.getTime() - ms).toISOString()
  c(assert.equal, lib.formatVersionTime(ago(30_000), now), 'Just now')
  c(assert.equal, lib.formatVersionTime(ago(5 * 60_000), now), '5m ago')
  c(assert.equal, lib.formatVersionTime(ago(59 * 60_000 + 59_000), now), '59m ago')
  c(assert.equal, lib.formatVersionTime(ago(60 * 60_000), now), '1h ago')
  c(assert.equal, lib.formatVersionTime(ago(3 * 3_600_000), now), '3h ago')
  c(assert.equal, lib.formatVersionTime(ago(23 * 3_600_000 + 59 * 60_000), now), '23h ago')
  c(assert.equal, lib.formatVersionTime(ago(2 * 86_400_000), now), '2d ago')
  c(assert.equal, lib.formatVersionTime(ago(6 * 86_400_000 + 3_600_000), now), '6d ago')
  c(assert.match, lib.formatVersionTime(new Date(2026, 9, 3, 10, 5).toISOString(), now), /^Oct 3, 10:05\sAM$/, 'a week or more: the date, no year in the current year')
  c(assert.match, lib.formatVersionTime(new Date(2025, 0, 15, 10, 5).toISOString(), now), /^Jan 15, 2025.*10:05\sAM$/, 'another year: with the year')
  for (const bad of ['', 'nope']) c(assert.equal, lib.formatVersionTime(bad, now), 'Unknown time')
  c(assert.equal, lib.versionAuthorLabel('user'), 'Your edit')
  c(assert.equal, lib.versionAuthorLabel('auto-save'), 'Auto-saved')
  c(assert.equal, lib.versionAuthorLabel('system'), 'Safety copy')
  c(assert.equal, lib.versionAuthorLabel('restore'), 'Restored backup')
  c(assert.equal, lib.versionAuthorLabel(''), 'Deckster')
  c(assert.equal, lib.versionAuthorLabel('director_agent'), 'Director agent')
  c(assert.equal, lib.versionSummary({ versionId: 'v', createdAt: '', createdBy: 'system', changeSummary: 'Pre-restore backup before reverting to v_2026_abcd' }), 'Saved automatically before a restore')
  c(assert.equal, lib.versionSummary({ versionId: 'v', createdAt: '', createdBy: 'user', changeSummary: 'Updated slide 2' }), 'Updated slide 2')
  c(assert.equal, lib.versionSummary({ versionId: 'v', createdAt: '', createdBy: 'user', changeSummary: null }), null)
  const before = [{ versionId: 'a', createdAt: '', createdBy: 'user', changeSummary: 'x' }]
  const backup = { versionId: 'b', createdAt: '2026-10-21T12:00:00Z', createdBy: 'system', changeSummary: 'Pre-restore backup before reverting to a' }
  c(assert.equal, lib.findPreRestoreBackup(before, [backup, ...before], 'a'), backup, 'the new system version that names the restored one')
  c(assert.equal, lib.findPreRestoreBackup(before, [{ ...backup, versionId: 'a' }, ...before], 'a'), null, 'a version that was already there is not the safety copy')
  c(assert.equal, lib.findPreRestoreBackup(before, [{ ...backup, createdBy: 'user' }, ...before], 'a'), null, 'only Layout\'s own (system) copies count')
  c(assert.equal, lib.findPreRestoreBackup(before, [backup, ...before], 'zzz'), null, 'it must name the version that was restored')
  c(assert.equal, lib.findPreRestoreBackup(before, [backup, ...before], ''), null)
  { // a reload is checked against the list
    const known = [{ versionId: 'a', createdAt: '', createdBy: 'user', changeSummary: 'x' }]
    const listed = (...rows) => ({ success: true, versions: [...rows, { version_id: 'a', created_at: '2026-10-01T00:00:00Z', created_by: 'user', change_summary: 'x' }] })
    const safety = { version_id: 'b', created_at: '2026-10-21T12:00:00Z', created_by: 'system', change_summary: 'Pre-restore backup before reverting to a' }
    c(assert.deepEqual, lib.restoreResultFromList(known, listed(safety), 'a'), { ok: true }, 'the safety copy is there')
    c(assert.deepEqual, lib.restoreResultFromList(known, listed(), 'a'), { ok: false, unconfirmed: true, message: lib.RESTORE_UNCONFIRMED_MESSAGE }, 'no safety copy: not confirmed')
    c(assert.deepEqual, lib.restoreResultFromList(known, listed({ ...safety, change_summary: 'Pre-restore backup before reverting to zzz' }), 'a'), { ok: false, unconfirmed: true, message: lib.RESTORE_UNCONFIRMED_MESSAGE }, 'a safety copy of another restore does not count')
    c(assert.deepEqual, lib.restoreResultFromList(known, listed({ ...safety, version_id: 'a' }), 'a'), { ok: false, unconfirmed: true, message: lib.RESTORE_UNCONFIRMED_MESSAGE }, 'one that was already listed does not count')
    c(assert.deepEqual, lib.restoreResultFromList(known, listed({ ...safety, change_summary: 'Pre-restore backup before reverting to v_10' }), 'v_1'), { ok: false, unconfirmed: true, message: lib.RESTORE_UNCONFIRMED_MESSAGE }, 'v_1 is not v_10')
    c(assert.deepEqual, lib.restoreResultFromList(known, listed({ ...safety, change_summary: 'Pre-restore backup before reverting to v_1' }), 'v_1'), { ok: true }, 'v_1 is v_1')
    c(assert.deepEqual, lib.restoreResultFromList(known, { success: false, error: 'x' }, 'a'), { ok: false, unconfirmed: true, message: lib.RESTORE_UNCONFIRMED_MESSAGE }, 'an unreadable list: not confirmed')
    c(assert.deepEqual, lib.restoreResultFromList(known, undefined, 'a'), { ok: false, unconfirmed: true, message: lib.RESTORE_UNCONFIRMED_MESSAGE })
  }
  c(assert.equal, lib.RESTORED_NOTICE, 'Version restored.')
  c(assert.match, lib.RESTORED_RELOADING_NOTICE, /^Version restored\..*wait for it before editing/, 'while the old canvas is still up the notice says not to edit it')
  c(assert.equal, lib.restoredNoticeWithBackup(backup, new Date('2026-10-21T12:03:00Z')), 'Version restored. Your previous deck is saved as a version from 3m ago.')
  c(assert.equal, lib.restoreBlockedReason({ building: false }), null)
  c(assert.equal, typeof lib.restoreBlockedReason({ building: true }), 'string', 'a building deck gives a reason')
  c(assert.match, lib.restoreBlockedReason({ building: true }), /finished building/)

  // the words of a refused restore
  c(assert.equal, lib.RESTORE_SAVE_FAILED_MESSAGE, slide.RESTORE_NOT_SAVED_MESSAGE, 'one wording for "your edits could not be saved first" in both libs')
  c(assert.equal, lib.restoreFailureMessage('Version v_1 not found for presentation p1'), lib.RESTORE_NOT_FOUND_MESSAGE)
  c(assert.equal, lib.restoreFailureMessage('Unsaved edits could not be saved, so the slide was not changed. Retry Save, then try again.'), lib.RESTORE_SAVE_FAILED_MESSAGE)
  c(assert.equal, lib.restoreFailureMessage('Unsaved edits could not be saved. Retry Save.'), lib.RESTORE_SAVE_FAILED_MESSAGE)
  c(assert.equal, lib.restoreFailureMessage('Error restoring version: boom'), lib.RESTORE_FAILED_MESSAGE)
  for (const detail of [undefined, null, '', 5]) c(assert.equal, lib.restoreFailureMessage(detail), lib.RESTORE_FAILED_MESSAGE)
  c(assert.deepEqual, await lib.restoreResultFromAck(Promise.resolve({ success: true })), { ok: true })
  c(assert.deepEqual, await lib.restoreResultFromAck(Promise.reject(new Error('Command timeout'))), { ok: false, unconfirmed: true, message: lib.RESTORE_UNCONFIRMED_MESSAGE })
  c(assert.deepEqual, await lib.restoreResultFromAck(Promise.reject(new Error('Version v not found for presentation p'))), { ok: false, message: lib.RESTORE_NOT_FOUND_MESSAGE })
  c(assert.deepEqual, await lib.restoreResultFromAck(Promise.reject('plain')), { ok: false, message: lib.RESTORE_FAILED_MESSAGE })

  // restoreVersionSafely, the rule: save first, wait for it, then restore; a failed save stops everything
  const spy = (saveImpl, sendImpl) => {
    const log = []
    return {
      log,
      deps: {
        versionId: 'v_target',
        onPhase: phase => log.push(`phase:${phase}`),
        saveCurrent: async () => { log.push('save:start'); const result = await saveImpl(); log.push('save:end'); return result },
        sendRestore: async request => { log.push('restore:send'); log.request = request; return sendImpl(request) },
      },
    }
  }
  {
    const s = spy(async () => ({ ok: true }), async () => ({ ok: true }))
    c(assert.deepEqual, await lib.restoreVersionSafely(s.deps), { ok: true })
    c(assert.deepEqual, s.log.slice(), ['phase:saving', 'save:start', 'save:end', 'phase:restoring', 'restore:send'], 'save, wait for it, then restore')
    c(assert.deepEqual, s.log.request, lib.restoreVersionRequest('v_target'))
    c(assert.equal, s.log.request.params.createBackup, true)
  }
  for (const [name, impl] of [
    ['save says not ok', async () => ({ ok: false, message: 'M1' })],
    ['save rejects', async () => { throw new Error('boom') }],
    ['save returns nothing', async () => undefined],
    ['save returns null', async () => null],
    ['save returns ok as a string', async () => ({ ok: 'true' })],
    ['save returns ok 1', async () => ({ ok: 1 })],
    ['save returns an empty object', async () => ({})],
  ]) {
    const s = spy(impl, async () => ({ ok: true }))
    const outcome = await lib.restoreVersionSafely(s.deps)
    c(assert.equal, outcome.ok, false, `${name}: no restore`)
    c(assert.equal, outcome.stage, 'save', name)
    c(assert.ok, !s.log.includes('restore:send'), `${name}: the restore command is never sent`)
    c(assert.ok, !s.log.includes('phase:restoring'), `${name}: the phase never reaches restoring`)
    c(assert.equal, outcome.message, name === 'save says not ok' ? 'M1' : lib.RESTORE_SAVE_FAILED_MESSAGE, `${name}: the words`)
  }
  {
    let release
    const gate = new Promise(resolve => { release = resolve })
    const s = spy(() => gate, async () => ({ ok: true }))
    const done = lib.restoreVersionSafely(s.deps)
    await tick()
    c(assert.deepEqual, s.log.slice(), ['phase:saving', 'save:start'], 'while the save is still running, nothing is restored')
    release({ ok: true })
    c(assert.deepEqual, await done, { ok: true })
    c(assert.deepEqual, s.log.slice(), ['phase:saving', 'save:start', 'save:end', 'phase:restoring', 'restore:send'])
  }
  for (const [name, impl, expected] of [
    ['refused', async () => ({ ok: false, message: 'R1' }), { ok: false, stage: 'restore', message: 'R1' }],
    ['refused without words', async () => ({ ok: false }), { ok: false, stage: 'restore', message: lib.RESTORE_FAILED_MESSAGE }],
    ['unconfirmed', async () => ({ ok: false, unconfirmed: true, message: 'U1' }), { ok: false, stage: 'unconfirmed', message: 'U1' }],
    ['unconfirmed without words', async () => ({ ok: false, unconfirmed: true }), { ok: false, stage: 'unconfirmed', message: lib.RESTORE_UNCONFIRMED_MESSAGE }],
    ['send throws', async () => { throw new Error('boom') }, { ok: false, stage: 'unconfirmed', message: lib.RESTORE_UNCONFIRMED_MESSAGE }],
    ['send returns nothing', async () => undefined, { ok: false, stage: 'restore', message: lib.RESTORE_FAILED_MESSAGE }],
    ['send returns ok as a string', async () => ({ ok: 'true' }), { ok: false, stage: 'restore', message: lib.RESTORE_FAILED_MESSAGE }],
  ]) {
    const s = spy(async () => ({ ok: true }), impl)
    c(assert.deepEqual, await lib.restoreVersionSafely(s.deps), expected, name)
    c(assert.equal, s.log.filter(line => line === 'restore:send').length, 1, `${name}: sent once, never retried`)
    c(assert.equal, s.log.filter(line => line === 'save:start').length, 1, `${name}: saved once`)
  }
  for (const bad of ['', '  ', undefined, null]) {
    const s = spy(async () => ({ ok: true }), async () => ({ ok: true }))
    const outcome = await lib.restoreVersionSafely({ ...s.deps, versionId: bad })
    c(assert.equal, outcome.ok, false, `no version id (${String(bad)}): nothing happens`)
    c(assert.deepEqual, s.log.slice(), [], `no version id (${String(bad)}): not even a save`)
  }
  { // onPhase is optional
    const outcome = await lib.restoreVersionSafely({ versionId: 'v', saveCurrent: async () => ({ ok: true }), sendRestore: async () => ({ ok: true }) })
    c(assert.deepEqual, outcome, { ok: true })
  }

  // the profile menu's way in
  {
    const bridge = lib.createVersionHistoryBridge()
    const heard = []
    const unsubscribe = bridge.subscribe(() => heard.push(bridge.isAvailable()))
    c(assert.equal, bridge.isAvailable(), false, 'no deck, no row')
    c(assert.equal, bridge.open(), false, 'nothing to open')
    let opened = 0
    const first = () => { opened += 1 }
    const unregisterFirst = bridge.register(first)
    c(assert.equal, bridge.isAvailable(), true)
    c(assert.equal, bridge.open(), true)
    c(assert.equal, opened, 1)
    let second = 0
    const unregisterSecond = bridge.register(() => { second += 1 })
    bridge.open()
    c(assert.deepEqual, [opened, second], [1, 1], 'the newest registration wins')
    unregisterFirst() // an old registration taking itself back must not take the newer one with it
    c(assert.equal, bridge.isAvailable(), true, 'a stale unregister leaves the newer opener')
    c(assert.equal, bridge.open(), true)
    c(assert.equal, second, 2)
    unregisterSecond()
    c(assert.equal, bridge.isAvailable(), false)
    c(assert.equal, bridge.open(), false)
    c(assert.deepEqual, heard, [true, true, false], 'the menu hears every change of availability')
    unsubscribe()
    bridge.register(() => {})
    c(assert.deepEqual, heard, [true, true, false], 'an unsubscribed listener hears nothing')
    const failing = lib.createVersionHistoryBridge()
    failing.subscribe(() => { throw new Error('listener bug') })
    let reached = false
    failing.subscribe(() => { reached = true })
    c(assert.doesNotThrow, () => failing.register(() => {}), 'a broken listener never breaks the viewer')
    c(assert.equal, reached, true, 'and the next listener still hears')
    const solo = lib.createVersionHistoryBridge()
    const stable = solo.subscribe
    c(assert.equal, solo.subscribe, stable, 'subscribe is a stable function (useSyncExternalStore)')
    c(assert.equal, typeof lib.versionHistoryBridge.open, 'function', 'the shared bridge exists')
  }
}

// ---------------------------------------------------------------- suite 2: the whole restore against the model of Layout
async function flowSuite(lib, slide, c) {
  const listIds = list => list.history.versions.map(v => v.versionId)

  { // the old envelope is not answered by the viewer, the new one is
    const layout = createLayout()
    const clock = createClock()
    const studio = createStudio({ lib, slide, layout, clock })
    layout.receive({ command: 'getVersionHistory' })
    await settle()
    c(assert.equal, layout.ignored.length, 1, 'the viewer ignores {command}')
    const list = await studio.fetchList()
    c(assert.equal, list.ok, true)
    c(assert.deepEqual, listIds(list), ['v_old2', 'v_old1'])
    c(assert.equal, list.history.currentVersionId, 'current')
    c(assert.equal, layout.ignored.length, 1, 'and answers the {action, params, requestId} one')
    // a failed list is an error, not an empty list
    layout.receive = message => layout.posted.push(message) // a viewer that never answers
    const silent = studio.fetchList()
    await tick()
    clock.advance(lib.VERSION_HISTORY_FETCH_TIMEOUT_MS + 1)
    await c(assert.rejects, silent, /Command timeout/, 'no answer in time')
  }

  { // S1: an edit is pending: it is saved, the restore goes out only after the clean save, and the safety copy holds the edit
    const layout = createLayout()
    const clock = createClock()
    const studio = createStudio({ lib, slide, layout, clock })
    layout.edit()
    const beforeList = (await studio.fetchList()).history.versions
    const outcome = await studio.restore('v_old1')
    c(assert.deepEqual, outcome, { ok: true })
    c(assert.deepEqual, layout.posted.map(m => m.action), ['getVersionHistory', 'forceSave', 'restoreVersion'], 'forceSave first, then the restore')
    const restoreMessage = layout.posted.find(m => m.action === 'restoreVersion')
    c(assert.deepEqual, restoreMessage.params, { versionId: 'v_old1', createBackup: true, reload: true })
    c(assert.equal, typeof restoreMessage.requestId, 'string')
    c(assert.deepEqual, layout.stored, { slides: ['O1'] }, 'the deck is the restored one')
    const safety = layout.versions.find(v => v.created_by === 'system')
    c(assert.ok, safety, 'Layout stored the deck as a new version first')
    c(assert.deepEqual, safety.data, { slides: ['A1', 'A2-edited'] }, 'and that version holds the edit that was pending')
    c(assert.equal, layout.versions.filter(v => v.created_by === 'system').length, 1)
    c(assert.deepEqual, studio.phases, ['saving', 'restoring'])
    const after = (await studio.fetchList()).history.versions
    c(assert.equal, lib.findPreRestoreBackup(beforeList, after, 'v_old1')?.versionId, safety.version_id, 'the panel finds the safety copy afterwards')
    c(assert.equal, layout.reloaded, true)
  }

  { // S2: nothing pending: no forceSave needed, the restore still keeps a safety copy
    const layout = createLayout()
    const clock = createClock()
    const studio = createStudio({ lib, slide, layout, clock })
    const outcome = await studio.restore('v_old2')
    c(assert.deepEqual, outcome, { ok: true })
    c(assert.deepEqual, layout.posted.map(m => m.action), ['restoreVersion'], 'a clean deck needs no save first')
    c(assert.equal, layout.versions.filter(v => v.created_by === 'system').length, 1, 'the safety copy is written anyway')
    c(assert.deepEqual, layout.versions.find(v => v.created_by === 'system').data, { slides: ['A1', 'A2'] })
    c(assert.deepEqual, layout.stored, { slides: ['O2'] })
  }

  { // S2b: the last status the viewer reported was a clean save
    const layout = createLayout()
    const clock = createClock()
    const studio = createStudio({ lib, slide, layout, clock })
    layout.edit()
    layout.saveCanvas()
    studio.tracker.record({ type: 'saveStatusChanged', status: 'saved', hasPendingChanges: false })
    c(assert.deepEqual, await studio.restore('v_old1'), { ok: true })
    c(assert.deepEqual, layout.posted.map(m => m.action), ['restoreVersion'])
    c(assert.deepEqual, layout.versions.find(v => v.created_by === 'system').data, { slides: ['A1', 'A2-edited'] }, 'the safety copy holds the saved edit')
  }

  { // S3: the viewer refuses the save: nothing is restored, the deck is as it was
    const layout = createLayout({ forceSaveWorks: false })
    const clock = createClock()
    const studio = createStudio({ lib, slide, layout, clock })
    layout.edit()
    const outcome = await studio.restore('v_old1')
    c(assert.equal, outcome.ok, false)
    c(assert.equal, outcome.stage, 'save')
    c(assert.equal, outcome.message, lib.RESTORE_SAVE_FAILED_MESSAGE)
    c(assert.ok, !layout.posted.some(m => m.action === 'restoreVersion'), 'the restore command was never sent')
    c(assert.deepEqual, layout.stored, { slides: ['A1', 'A2'] }, 'the stored deck is untouched')
    c(assert.equal, layout.versions.length, 2, 'no version was written or replaced')
    c(assert.deepEqual, studio.phases, ['saving'])
  }

  { // S4: the save is acknowledged but never reported finished: no restore after the wait
    const layout = createLayout({ emitCleanAfterForceSave: false, saveLands: false }) // acknowledged, never finished
    const clock = createClock()
    const studio = createStudio({ lib, slide, layout, clock })
    layout.edit()
    const done = studio.restore('v_old1')
    await settle()
    c(assert.deepEqual, layout.posted.map(m => m.action), ['forceSave'], 'waiting for the save to finish')
    clock.advance(slide.RESTORE_FLUSH_SAVE_TIMEOUT_MS + 1)
    const outcome = await done
    c(assert.equal, outcome.ok, false)
    c(assert.equal, outcome.stage, 'save')
    c(assert.ok, !layout.posted.some(m => m.action === 'restoreVersion'))
    c(assert.deepEqual, layout.stored, { slides: ['A1', 'A2'] })
  }

  { // S4b: the forceSave itself is never answered
    const layout = createLayout()
    const answer = layout.receive
    layout.receive = message => { if (message.action === 'forceSave') { layout.posted.push(message); return } answer(message) }
    const clock = createClock()
    const studio = createStudio({ lib, slide, layout, clock })
    layout.edit()
    const done = studio.restore('v_old1')
    await settle()
    clock.advance(slide.RESTORE_FLUSH_ACK_TIMEOUT_MS + 1)
    const outcome = await done
    c(assert.equal, outcome.stage, 'save')
    c(assert.ok, !layout.posted.some(m => m.action === 'restoreVersion'))
  }

  { // S5: Layout cannot write the safety copy: the restore does not run
    const layout = createLayout({ backupWorks: false })
    const clock = createClock()
    const studio = createStudio({ lib, slide, layout, clock })
    const outcome = await studio.restore('v_old1')
    c(assert.equal, outcome.ok, false)
    c(assert.equal, outcome.stage, 'restore')
    c(assert.equal, outcome.message, lib.RESTORE_NOT_FOUND_MESSAGE)
    c(assert.deepEqual, layout.stored, { slides: ['A1', 'A2'] }, 'the deck was not replaced')
    c(assert.equal, layout.reloaded, false)
    c(assert.equal, layout.versions.length, 2)
  }

  { // S5b: a version that is gone
    const layout = createLayout()
    const clock = createClock()
    const studio = createStudio({ lib, slide, layout, clock })
    const outcome = await studio.restore('v_gone')
    c(assert.equal, outcome.stage, 'restore')
    c(assert.equal, outcome.message, lib.RESTORE_NOT_FOUND_MESSAGE)
    c(assert.deepEqual, layout.stored, { slides: ['A1', 'A2'] })
  }

  { // S6: no answer at all: the outcome is unknown and the words say so (no retry)
    const layout = createLayout({ answerRestore: false })
    const clock = createClock()
    const studio = createStudio({ lib, slide, layout, clock })
    const done = studio.restore('v_old1')
    await settle()
    clock.advance(lib.VERSION_RESTORE_TIMEOUT_MS + 1)
    const outcome = await done
    c(assert.deepEqual, outcome, { ok: false, stage: 'unconfirmed', message: lib.RESTORE_UNCONFIRMED_MESSAGE })
    c(assert.equal, layout.posted.filter(m => m.action === 'restoreVersion').length, 1, 'sent once')
  }

  { // S7: Layout's own save guard (flag on) refuses a restore with edits pending; Studio never sends it unsaved, so the guard has nothing to refuse
    const layout = createLayout({ guard: true })
    const clock = createClock()
    const studio = createStudio({ lib, slide, layout, clock })
    layout.edit()
    c(assert.deepEqual, await studio.restore('v_old1'), { ok: true })
    // and when the guard does refuse (an edit lands between the save and the restore) the words are the save words
    const second = createLayout({ guard: true })
    const studio2 = createStudio({ lib, slide, layout: second, clock: createClock() })
    const answer = second.receive
    second.receive = message => { if (message.action === 'restoreVersion') second.edit(); answer(message) }
    const outcome = await studio2.restore('v_old1')
    c(assert.equal, outcome.stage, 'restore')
    c(assert.equal, outcome.message, lib.RESTORE_SAVE_FAILED_MESSAGE)
    c(assert.deepEqual, second.stored, { slides: ['A1', 'A2'] })
  }

  { // S8: one restore, then another: each keeps its own safety copy and nothing is lost
    const layout = createLayout()
    const clock = createClock()
    const studio = createStudio({ lib, slide, layout, clock })
    c(assert.deepEqual, await studio.restore('v_old1'), { ok: true })
    c(assert.deepEqual, await studio.restore('v_old2'), { ok: true })
    const copies = layout.versions.filter(v => v.created_by === 'system')
    c(assert.equal, copies.length, 2)
    c(assert.deepEqual, copies.map(v => v.data).reverse(), [{ slides: ['A1', 'A2'] }, { slides: ['O1'] }], 'each restore stored the deck as it was just before')
  }
}

// ---------------------------------------------------------------- suite 3: the lib against the contract read from Layout
async function contractSuite(lib, c) {
  const viewerCommands = CONTRACT.viewer.commands
  const list = lib.getVersionHistoryRequest()
  const restore = lib.restoreVersionRequest('v_1')
  for (const request of [list, restore]) {
    c(assert.ok, request.action in viewerCommands, `${request.action} is a command the viewer has`)
    c(assert.deepEqual, Object.keys(request).sort(), ['action', 'params'], 'the viewer reads action and params (and requestId, added when sent)')
    for (const key of Object.keys(request.params)) c(assert.ok, viewerCommands[request.action].params_read.includes(key), `${request.action}: the viewer reads params.${key}`)
  }
  // every field the parser reads is one the viewer's reply and Layout's rows carry
  const readReply = new Set(), readRow = new Set()
  const spyOn = (target, seen) => new Proxy(target, { get(t, key) { if (typeof key === 'string') seen.add(key); return t[key] } })
  const rows = [spyOn({ version_id: 'a', created_at: '2026-10-01T10:00:00Z', created_by: 'user', change_summary: 's', presentation_id: 'p1' }, readRow)]
  lib.parseVersionHistoryReply(spyOn({ success: true, action: 'getVersionHistory', requestId: 'r', presentationId: 'p1', currentVersionId: 'c', versions: rows }, readReply))
  lib.parseVersionHistoryReply(spyOn({ success: false, error: 'x' }, readReply))
  for (const key of readReply) c(assert.ok, viewerCommands.getVersionHistory.reply_fields.includes(key), `the parser reads reply.${key}, which the viewer sends`)
  for (const key of readRow) c(assert.ok, CONTRACT.server.versions_row_fields.includes(key), `the parser reads row.${key}, which Layout's version rows carry`)
  c(assert.ok, readRow.has('version_id') && readReply.has('versions') && readReply.has('currentVersionId'), 'and it does read the ones it needs')
}

function liveLayoutChecks(c) {
  const dir = process.env.LAYOUT_BUILDER_DIR || path.join(os.homedir(), 'Software', 'Deckster', 'backend', 'layout-builder')
  const ref = process.env.LAYOUT_BUILDER_REF || CONTRACT.layout_ref
  const show = file => execFileSync('git', ['-C', dir, 'show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
  let viewer
  try { viewer = show(CONTRACT.viewer.file) } catch { console.log(`  SKIP live Layout checks: ${ref} of ${dir} is not reachable (the fixture checks above still ran)`); return }
  const storage = show(CONTRACT.server.restore.file)
  const autosave = show(CONTRACT.autosave_guard.file)
  c(assert.ok, viewer.includes(CONTRACT.viewer.message_handler_reads), 'the viewer reads {action, params, source, requestId}')
  c(assert.ok, viewer.includes(CONTRACT.viewer.drops_without_action), 'and drops a message without an action')
  for (const snippet of CONTRACT.viewer.reply_carries_action_and_request_id) c(assert.ok, viewer.includes(snippet), `the viewer's reply carries action and requestId: ${snippet.slice(0, 50)}`)
  for (const [name, spec] of Object.entries(CONTRACT.viewer.commands)) {
    const start = viewer.indexOf(spec.case)
    c(assert.ok, start > 0, `the viewer has ${name}`)
    const next = viewer.indexOf('\n          case ', start + spec.case.length)
    const body = viewer.slice(start, next > 0 ? next : start + 4000)
    for (const param of spec.params_read) c(assert.match, body, new RegExp(`params\\??\\.${param}\\b`), `${name} reads params.${param}`)
    for (const snippet of [...(spec.reply_snippets || []), spec.backup_default, spec.reload_only_after_ok, spec.awaits_only_when_defined].filter(Boolean)) c(assert.ok, body.includes(snippet), `${name}: ${snippet}`)
    for (const field of spec.reply_fields.filter(f => !['success', 'action', 'requestId', 'error'].includes(f))) c(assert.match, body, new RegExp(`result\\.${field}\\b`), `${name} replies with ${field}`)
  }
  const restoreStart = storage.indexOf('async def restore_version')
  const restoreEnd = storage.indexOf('# ==================== Storage Bucket Helper', restoreStart)
  const restoreBody = storage.slice(restoreStart, restoreEnd)
  const [flagLine, saveLine, overwriteLine] = CONTRACT.server.restore.backup_before_overwrite
  c(assert.ok, restoreBody.includes(flagLine) && restoreBody.includes(saveLine) && restoreBody.includes(overwriteLine), 'Layout\'s restore has the backup and the overwrite')
  c(assert.ok, restoreBody.indexOf(saveLine) < restoreBody.indexOf(overwriteLine), 'Layout writes the backup BEFORE it overwrites the deck')
  c(assert.ok, restoreBody.includes(CONTRACT.server.restore.backup_failure_returns_none), 'a failure (the backup included) returns None')
  c(assert.ok, restoreBody.includes(CONTRACT.server.restore.backup_summary), 'the safety copy is worded "Pre-restore backup before reverting to <id>"')
  c(assert.ok, restoreBody.slice(restoreBody.indexOf(saveLine), restoreBody.indexOf(saveLine) + 200).includes(CONTRACT.server.restore.backup_created_by), 'and made by system')
  const server = show('server.py')
  c(assert.ok, server.includes(CONTRACT.server.restore.route_status_when_none), 'and the route answers 404 for None')
  c(assert.ok, storage.includes(CONTRACT.server.versions_newest_first), 'versions come newest first')
  c(assert.ok, autosave.includes(CONTRACT.autosave_guard.restore_is_structural), 'Layout\'s autosave guard counts a restore as a structural request')
  c(assert.ok, autosave.includes(CONTRACT.autosave_guard.settles_pending_before_request), 'and saves what is pending before it')
  const emit = autosave.slice(autosave.indexOf('function emitSaveStatus'), autosave.indexOf('function emitSaveStatus') + 500)
  for (const snippet of CONTRACT.autosave_guard.save_status_message) c(assert.ok, emit.includes(snippet), `the viewer tells Studio its save status: ${snippet}`)
  console.log(`  live Layout checks passed against ${ref} of ${dir}`)
}

// ---------------------------------------------------------------- suite 4: the real sources
const markedLines = text => text.split('\n').filter(line => line.includes(MARK))
const unmarked = text => text.split('\n').filter(line => !line.includes(MARK)).join('\n')
const code = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
function wiring(sources, c, { allowBaseCheck = true } = {}) {
  const { lib, panel, item, viewer, menu, menuP2, oldPanel, css } = sources
  // the lib: one place reads the flag, exact "true", and it imports nothing
  c(assert.equal, (lib.match(/process\.env\.NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2/g) ?? []).length, 1, 'the lib reads the flag once')
  c(assert.match, lib, /STUDIO_VERSION_HISTORY_V2_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2 === 'true'/, 'exact "true"')
  c(assert.equal, (lib.match(/^import\s/gm) ?? []).length, 0, 'the lib imports nothing')
  for (const [name, text] of Object.entries({ panel, item, viewer, menuP2 })) c(assert.doesNotMatch, text, /process\.env\.NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2/, `${name} reads the flag through the lib`)
  // the profile menu reads its flags inline (its test harnesses supply process.env and stub @/components/*, not @/lib/*): one inline read, exact "true", and flag off adds no node
  c(assert.equal, (menu.match(/process\.env\.NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2/g) ?? []).length, 1, 'the profile menu reads the flag once')
  c(assert.match, menu, /const versionHistoryRow = process\.env\.NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2 === 'true' \? <VersionHistoryMenuItem key="version-history" chevron=\{p2Menu\} \/> : null \/\/ VERSION-HISTORY-V2/, 'exact "true", and the row is not even created with the flag off')
  c(assert.match, menu, /\n {8}\{versionHistoryRow\}\{\/\* VERSION-HISTORY-V2: null with the flag off, so no node \*\/\}\n/, 'the original body shows it (null with the flag off)')
  c(assert.match, menu, /onLogout=\{handleLogout\} \{\.\.\.\(versionHistoryRow \? \{ versionHistoryRow \/\* VERSION-HISTORY-V2 \*\/ \} : \{\}\)\} \/> : \(\n/, 'the mockup body gets it as a prop only when it exists (no extra prop with the flag off)')

  // the panel: the restore goes through the rule, the envelope comes from the lib, nothing posts by hand
  const panelCode = code(panel)
  c(assert.match, panelCode, /restoreVersionSafely\(\{/, 'the restore is restoreVersionSafely')
  c(assert.match, panelCode, /saveCurrent: \(\) => flushViewerBeforeRestore\(\{\s*tracker: saveTracker,\s*forceSave: \(\) => requestViewerAck\(channel, 'forceSave', \{\}, RESTORE_FLUSH_ACK_TIMEOUT_MS\),\s*saveTimeoutMs: RESTORE_FLUSH_SAVE_TIMEOUT_MS,\s*\}\)/, 'the save before the restore is the proven flush')
  c(assert.match, panelCode, /sendRestore: request => sendRestoreCommand\(iframe, viewerOrigin, channel, request, before\)/, 'the restore command is the lib\'s request')
  c(assert.match, panelCode, /finish\(restoreResultFromList\(before, reply, String\(request\.params\.versionId\)\)\)/, 'a reload is checked against the list, not trusted')
  c(assert.match, panelCode, /restoreResultFromAck\(requestViewerAck\(channel, request\.action, request\.params, VERSION_RESTORE_TIMEOUT_MS\)\)/, 'its answer is read by the lib')
  c(assert.equal, (panelCode.match(/postMessage\(/g) ?? []).length, 1, 'one postMessage: the channel\'s')
  c(assert.doesNotMatch, panelCode, /\bcommand\s*:|['"]command['"]/, 'no {command} envelope')
  c(assert.doesNotMatch, panelCode, /restoreVersion['"]|getVersionHistory['"]|createBackup|reload\s*:/, 'the actions and their params live in the lib only')
  c(assert.match, panelCode, /const request = getVersionHistoryRequest\(\)/, 'the list request is the lib\'s')
  c(assert.match, panelCode, /parseVersionHistoryReply\(reply\)/, 'the list reply is read by the lib')
  c(assert.match, panelCode, /saveTracker\.record\(event\.data\)/, 'the panel records the viewer\'s save status from the start')
  c(assert.match, panelCode, /const \[saveTracker\] = useState\(\(\) => createSaveStatusTracker\(\)\)/, 'the tracker is created at mount, not at open')
  c(assert.ok, panelCode.indexOf("reportDeckChange('slide')") > panelCode.indexOf('if (!outcome.ok) {'), 'other tabs are told only after a successful restore')
  c(assert.match, panelCode, /frameLoadsRef\.current \+= 1; setReloading\(false\)/, 'every frame load of the deck\'s iframe is counted')
  c(assert.match, panelCode, /if \(frameLoadsRef\.current === loadsAtSend\) \{/, 'a restore whose reload has not happened yet is the one that waits for it')
  c(assert.match, panelCode, /if \(STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED && studio\) studioSlideDeleteRefresh\.acknowledged\(\{ revisionAtSend: loadsAtSend, revisionNow: frameLoadsRef\.current \}\)/, 'the stale canvas is covered by PASS2D B4\'s veil (its flag, the Studio shell)')
  c(assert.match, panelCode, /setNotice\(RESTORED_RELOADING_NOTICE\)\s*setReloading\(true\)/, 'and the panel says to wait')
  c(assert.match, panelCode, /disabled=\{restoreDisabled\}/, 'Restore can be switched off')
  c(assert.match, panelCode, /restoreBlockedReason\(\{ building \}\)/, 'while the deck builds')
  c(assert.match, panelCode, /if \(restoringRef\.current\) return/, 'one restore at a time')
  c(assert.doesNotMatch, panelCode, /\bconfirm\(/, 'no browser confirm()')
  c(assert.match, css, /\[data-studio-v4-dialog="versions"\]/, 'the Studio dialog look and place')

  // the menu row: no hook without the flag, shown only while a deck is on screen
  const itemCode = code(item)
  c(assert.match, itemCode, /export function VersionHistoryMenuItem\(\{ chevron = false \}: \{ chevron\?: boolean \}\) \{\s*if \(!STUDIO_VERSION_HISTORY_V2_ENABLED\) return null\s*return <VersionHistoryMenuItemRow chevron=\{chevron\} \/>/, 'flag off: nothing rendered, no hook called')
  c(assert.equal, (itemCode.match(/useSyncExternalStore\(/g) ?? []).length, 1, 'one hook, in the row')
  c(assert.match, itemCode, /useSyncExternalStore\(versionHistoryBridge\.subscribe, versionHistoryBridge\.isAvailable, noDeckOnServer\)/)
  c(assert.match, itemCode, /if \(!available\) return null/, 'no deck on screen, no row')
  c(assert.match, itemCode, /onSelect=\{\(\) => \{ versionHistoryBridge\.open\(\) \}\}/, 'it opens the viewer\'s panel')
  c(assert.match, itemCode, /<span>Version history<\/span>/, 'sentence-case label')
  c(assert.match, itemCode, /\{chevron && <ChevronRight data-studio-p2-chevron="true" \/>\}/, 'the mockup menu\'s trailing chevron, only there')

  // the viewer and the profile menu: additions only, every added line marked, flag gated
  c(assert.match, viewer, /import \{ VersionHistoryPanelV2 \} from '\.\/version-history-panel-v2' \/\/ VERSION-HISTORY-V2/)
  c(assert.match, viewer, /import \{ STUDIO_VERSION_HISTORY_V2_ENABLED, versionHistoryBridge \} from '@\/lib\/studio-version-history-v2' \/\/ VERSION-HISTORY-V2/)
  c(assert.match, viewer, /if \(!STUDIO_VERSION_HISTORY_V2_ENABLED \|\| !VIEWER_ORIGIN \|\| LAYOUT_URL_CONFIG_ERROR\) return \/\/ VERSION-HISTORY-V2/, 'the opener is registered only with the flag on')
  c(assert.match, viewer, /if \(!approvedIframeNavigationUrl\) \{ setVersionHistoryV2Open\(false\); return \}/, 'and only while a deck is loaded')
  c(assert.match, viewer, /return versionHistoryBridge\.register\(\(\) => setVersionHistoryV2Open\(true\)\) \/\/ VERSION-HISTORY-V2/)
  c(assert.match, viewer, /\{STUDIO_VERSION_HISTORY_V2_ENABLED && VIEWER_ORIGIN && !LAYOUT_URL_CONFIG_ERROR && <VersionHistoryPanelV2 isOpen=\{versionHistoryV2Open\} onClose=\{\(\) => setVersionHistoryV2Open\(false\)\} iframeRef=\{iframeRef\} viewerOrigin=\{VIEWER_ORIGIN\} deckKey=\{approvedIframeNavigationUrl\} building=\{Boolean\(isGenerating\)\} studio=\{studioShell\} \/>\}/, 'the panel is mounted only with the flag on')
  c(assert.match, viewer, /studio=\{studioShell\} \/>\}\{\/\* VERSION-HISTORY-V2:/, 'no space between the mount and its comment: that space would be a text node in the markup with the flag off')
  c(assert.doesNotMatch, [viewer, menu, menuP2, item].join('\n'), /\} \{\/\* VERSION-HISTORY-V2/, 'no same-line space between a marked expression and its comment (a stray text node)')
  c(assert.doesNotMatch, viewer, /setShowVersionHistory\(true\)/, 'the old state is still never set: the old panel stays unreachable')
  c(assert.match, menu, /import \{ VersionHistoryMenuItem \} from "@\/components\/version-history-menu-item" \/\/ VERSION-HISTORY-V2/)
  c(assert.equal, (menu.match(/<VersionHistoryMenuItem\b/g) ?? []).length, 1, 'one row element in the profile menu')
  c(assert.ok, menu.indexOf('{versionHistoryRow}{/*') > menu.indexOf('<span>Settings</span>') && menu.indexOf('{versionHistoryRow}{/*') < menu.indexOf('onClick={toggleTheme}'), 'after Settings')
  // the mockup's account menu (NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU) has its own body: the row sits right after "Settings & preferences", as the mockup has it, and renders nothing unless the flag is on and a deck is on screen
  c(assert.match, menuP2, /return entry\.id === "settings" && versionHistoryRow \? \[row, versionHistoryRow\] : row \/\/ VERSION-HISTORY-V2/, 'right after the settings row, and only when the parent gave one')
  c(assert.match, menuP2, /^ {2}versionHistoryRow\?: ReactNode \/\/ VERSION-HISTORY-V2/m, 'an optional prop')
  c(assert.match, menuP2, /onLogout, versionHistoryRow \}: StudioProfileMenuP2Props\) \{ \/\/ VERSION-HISTORY-V2/)
  c(assert.doesNotMatch, menuP2, /VersionHistoryMenuItem/, 'the mockup body renders what it is given: no import, no flag (its test harness has neither)')
  if (allowBaseCheck) {
    const baseViewer = baseSource(FILES.viewer), baseMenu = baseSource(FILES.menu), baseOld = baseSource(FILES.oldPanel), baseP2 = baseSource(FILES.menuP2)
    if (baseViewer && baseMenu && baseOld && baseP2) {
      // the two base lines these edits change are put back: the mockup body's `return (` and its signature; the profile menu's mockup element
      const putBackP2 = text => text.split('\n').filter(line => !line.includes(MARK) || line.includes('const row = (') || line.includes('export function StudioProfileMenuP2')).map(line => line.replace('const row = ( // VERSION-HISTORY-V2', 'return (').replace(', versionHistoryRow }: StudioProfileMenuP2Props) { // VERSION-HISTORY-V2', ' }: StudioProfileMenuP2Props) {')).join('\n')
      const putBackMenu = text => text.split('\n').filter(line => !line.includes(MARK) || line.includes('<StudioProfileMenuP2 ')).map(line => line.replace(' {...(versionHistoryRow ? { versionHistoryRow /* VERSION-HISTORY-V2 */ } : {})}', '')).join('\n')
      c(assert.equal, putBackP2(menuP2), baseP2, 'mockup menu: with the marked lines removed and its two changed base lines put back it is the base\'s')
      c(assert.equal, markedLines(menuP2).length - markedLines(baseP2).length, 4, 'the mockup menu gains four marked lines')
      c(assert.equal, unmarked(viewer), baseViewer, 'viewer: with the marked lines removed it is the base\'s (flag off is today\'s code)')
      c(assert.equal, putBackMenu(menu), baseMenu, 'profile menu: with the marked lines removed (and the mockup element put back) it is the base\'s')
      c(assert.equal, oldPanel, baseOld, 'the old panel is untouched')
      c(assert.equal, markedLines(viewer).length - markedLines(baseViewer).length, 10, 'the viewer gains ten marked lines')
      c(assert.equal, markedLines(menu).length - markedLines(baseMenu).length, 4, 'the profile menu gains four marked lines')
    } else console.log(`  SKIP base-commit identity: ${BASE_COMMIT} is not in this clone (the checks above still ran)`)
  }
}
function registrationChecks(c) {
  c(assert.match, read('.env.example'), /^NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2="false"$/m, 'documented, default off')
  c(assert.equal, JSON.parse(read('package.json')).scripts['test:studio-version-history-v2'], 'node scripts/test-studio-version-history-v2.mjs', 'registered')
  const holders = git(['grep', '-l', '-F', 'process.env.NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2', '--', 'components', 'lib', 'app', 'hooks']).split('\n').filter(Boolean)
  c(assert.deepEqual, holders, ['components/user-profile-menu.tsx', 'lib/studio-version-history-v2.ts'], 'the flag is read in the lib and, inline, in the profile menu')
}

// ---------------------------------------------------------------- suite 6: the REAL panel, rendered through a small hook shim against the model of Layout (needs `typescript`, installed with the repo)
async function loadTypeScript() {
  const candidates = process.env.TS_MODULE ? [pathToFileURL(process.env.TS_MODULE).href] : ['typescript'] // TS_MODULE: a typescript.js to use instead of the repo's (no install needed)
  for (const spec of candidates) { try { const mod = await import(spec); return mod.default ?? mod } catch { /* next */ } }
  return null
}
const TS = await loadTypeScript()
const cjs = new Map()
function toCjs(rel, source) {
  const key = `${rel}\0${source}`
  if (!cjs.has(key)) {
    const out = TS.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: { module: TS.ModuleKind.CommonJS, target: TS.ScriptTarget.ES2022, jsx: TS.JsxEmit.ReactJSX, esModuleInterop: true } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === TS.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile`)
    cjs.set(key, out.outputText)
  }
  return cjs.get(key)
}
function createWindow() {
  const handlers = new Set()
  return {
    addEventListener(type, fn) { if (type === 'message') handlers.add(fn) },
    removeEventListener(type, fn) { if (type === 'message') handlers.delete(fn) },
    dispatchMessage(event) { for (const fn of [...handlers]) fn(event) },
    handlerCount: () => handlers.size,
    document: { activeElement: null },
  }
}
/** The panel and the REAL libs it imports (the messaging helper, the slide-ops lib, this lib), with the rest stubbed. Timers are the fake clock's. */
function createPanelWorld({ panelSource = SRC.panel, deleteRefreshFlag = false } = {}) {
  const clock = createClock()
  const win = createWindow()
  const calls = { deckChanges: [], veil: [] }
  const reactStub = {}
  const jsx = (type, props) => ({ type, props: props ?? {} })
  const stubs = {
    react: reactStub,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'lucide-react': new Proxy({}, { get: (_target, name) => String(name) }),
    '@/lib/utils': { cn: (...parts) => parts.filter(Boolean).join(' ') },
    '@/lib/studio-deck-changed-notice': { reportDeckChange: kind => { calls.deckChanges.push(kind) } },
    '@/lib/studio-slide-delete-refresh': { STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED: deleteRefreshFlag, studioSlideDeleteRefresh: { acknowledged: input => { calls.veil.push(input); return true } } },
  }
  const real = { '@/lib/layout-viewer-messaging': 'lib/layout-viewer-messaging.ts', '@/lib/studio-slide-ops-via-viewer': FILES.slide, '@/lib/studio-version-history-v2': FILES.lib }
  const cache = new Map()
  function load(rel, source) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec in real) return load(real[spec], read(real[spec]))
      throw new Error(`unexpected import ${spec} from ${rel}`)
    }
    new Function('module', 'exports', 'require', 'process', 'window', 'document', 'setTimeout', 'clearTimeout', toCjs(rel, source))(
      module, module.exports, require, { env: {} }, win, win.document, (fn, ms) => clock.setTimer(fn, ms), id => clock.clearTimer(id))
    return module.exports
  }
  return { panel: load(FILES.panel, panelSource), lib: load(FILES.lib, SRC.lib), slide: load(FILES.slide, SRC.slide), clock, win, calls, reactStub }
}
/** State, ref, memo, callback and effect hooks with batched synchronous renders: enough for the panel, which keeps no DOM refs of its own. */
function mount(world, Component, initialProps) {
  const slots = []
  let props = initialProps
  let cursor = 0
  let tree = null
  let dirty = false
  let flushing = false
  const sameDeps = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  let queued = []
  const hooks = {
    useState(init) {
      const i = cursor++
      if (!(i in slots)) {
        const slot = { value: typeof init === 'function' ? init() : init }
        slot.set = next => {
          const value = typeof next === 'function' ? next(slot.value) : next
          if (Object.is(value, slot.value)) return
          slot.value = value
          flush()
        }
        slots[i] = slot
      }
      return [slots[i].value, slots[i].set]
    },
    useRef(init) { const i = cursor++; if (!(i in slots)) slots[i] = { value: { current: init } }; return slots[i].value },
    useMemo(fn, deps) { const i = cursor++; const prev = slots[i]; if (prev && sameDeps(prev.deps, deps)) return prev.value; slots[i] = { value: fn(), deps }; return slots[i].value },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps) },
    useEffect(fn, deps) {
      const i = cursor++
      const prev = slots[i]
      if (prev && sameDeps(prev.deps, deps)) return
      queued.push({ i, fn, prev })
      slots[i] = { ...(prev || {}), deps }
    },
  }
  function renderOnce() {
    cursor = 0
    queued = []
    Object.assign(world.reactStub, hooks)
    tree = Component(props)
    const effects = queued
    queued = []
    for (const { i, fn, prev } of effects) {
      if (prev?.cleanup) prev.cleanup()
      const cleanup = fn()
      slots[i].cleanup = typeof cleanup === 'function' ? cleanup : null
    }
  }
  function flush() {
    if (flushing) { dirty = true; return }
    flushing = true
    try { do { dirty = false; renderOnce() } while (dirty) } finally { flushing = false }
  }
  flush()
  const textOf = node => Array.isArray(node) ? node.map(textOf).join('') : typeof node === 'string' || typeof node === 'number' ? String(node) : node && node.props ? textOf(node.props.children) : ''
  const api = {
    tree: () => tree,
    setProps(next) { props = { ...props, ...next }; flush() },
    textOf,
    find(predicate) {
      const found = []
      const walk = node => {
        if (Array.isArray(node)) return node.forEach(walk)
        if (!node || typeof node !== 'object' || !node.props) return
        if (predicate(node.props, node)) found.push(node)
        walk(node.props.children)
      }
      walk(tree)
      return found
    },
    click(node) { assert.ok(node, 'there is something to click'); if (node.props.disabled) return false; node.props.onClick(); return true },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
  }
  return api
}
function setupPanel({ panelSource, deleteRefreshFlag = false, layoutOptions = {}, props = {}, reload = true } = {}) {
  const world = createPanelWorld({ panelSource, deleteRefreshFlag })
  const layout = createLayout(layoutOptions)
  const viewerWindow = { postMessage: message => { layout.receive(message) } }
  const loadHandlers = new Set()
  const iframe = {
    src: 'https://layout.test/p/p1',
    contentWindow: viewerWindow,
    addEventListener(type, fn) { if (type === 'load') loadHandlers.add(fn) },
    removeEventListener(type, fn) { if (type === 'load') loadHandlers.delete(fn) },
    fireLoad() { for (const fn of [...loadHandlers]) fn() },
    loadHandlerCount: () => loadHandlers.size,
  }
  layout.listen(data => world.win.dispatchMessage({ data, origin: 'https://layout.test', source: viewerWindow }))
  if (reload) layout.onReload = () => iframe.fireLoad()
  const closes = []
  const view = mount(world, world.panel.VersionHistoryPanelV2, {
    isOpen: false, onClose: () => closes.push(1), iframeRef: { current: iframe }, viewerOrigin: 'https://layout.test', deckKey: 'k1', building: false, studio: true, ...props,
  })
  return { world, layout, iframe, view, closes }
}
const restoreButtons = view => view.find((p, node) => node.type === 'button' && typeof p['aria-label'] === 'string' && p['aria-label'].startsWith('Restore the version from'))
const buttonNamed = (view, text) => view.find((p, node) => node.type === 'button' && view.textOf(node) === text)[0]
const dialogOf = view => view.find(p => p.role === 'dialog')[0]
const messagesWith = (layout, action) => layout.posted.filter(m => m.action === action)

async function panelSuite(panelSource, c) {
  const open = async ctx => { ctx.view.setProps({ isOpen: true }); await settle() }
  const rowsText = view => view.find((p, node) => node.type === 'li').map(node => view.textOf(node))
  const confirmAndRestore = async (ctx, rowIndex) => {
    c(assert.ok, ctx.view.click(restoreButtons(ctx.view)[rowIndex]), 'Restore is clickable')
    c(assert.ok, buttonNamed(ctx.view, 'Restore this version'), 'the confirmation appears')
    ctx.view.click(buttonNamed(ctx.view, 'Restore this version'))
    await settle()
  }

  { // closed: nothing shown, nothing asked, but the save status is already being recorded
    const ctx = setupPanel({ panelSource })
    c(assert.equal, ctx.view.tree(), null, 'a closed panel renders nothing')
    c(assert.equal, ctx.layout.posted.length, 0, 'and asks the viewer nothing')
    c(assert.ok, ctx.world.win.handlerCount() >= 1, 'but it is listening from the start')
    ctx.view.unmount()
  }

  { // open: the list, asked with the envelope the viewer reads
    const ctx = setupPanel({ panelSource })
    await open(ctx)
    const first = ctx.layout.posted[0]
    c(assert.equal, first.action, 'getVersionHistory')
    c(assert.deepEqual, first.params, {})
    c(assert.equal, typeof first.requestId, 'string')
    c(assert.equal, 'command' in first, false, 'no {command}')
    c(assert.equal, ctx.layout.ignored.length, 0, 'the viewer ignored nothing')
    const dialog = dialogOf(ctx.view)
    c(assert.equal, dialog.props['aria-label'], 'Version history')
    c(assert.equal, dialog.props['data-studio-v4-dialog'], 'versions', 'the Studio dialog look')
    const rows = rowsText(ctx.view)
    c(assert.equal, rows.length, 2)
    c(assert.match, rows[0], /Updated slide 1/)
    c(assert.match, rows[1], /Updated slide 2/)
    c(assert.match, rows[0], /Your edit/)
    c(assert.equal, restoreButtons(ctx.view).length, 2, 'a Restore button per version')
    c(assert.match, ctx.view.textOf(ctx.view.tree()), /Restoring never overwrites your deck: it is saved as a new version first\./)
    c(assert.equal, ctx.view.find((p, node) => node.type === 'button' && p['aria-label'] === 'Close version history').length, 1)
    ctx.view.unmount()
  }

  { // the current version has a badge and no Restore
    const ctx = setupPanel({ panelSource, layoutOptions: { currentVersionId: 'v_old2' } })
    await open(ctx)
    c(assert.equal, restoreButtons(ctx.view).length, 1, 'no Restore on the current version')
    c(assert.match, rowsText(ctx.view)[0], /Current/)
    ctx.view.unmount()
  }

  { // a restore with an edit made while the panel was closed: confirm first, save first, restore with Layout's backup, cover the stale canvas, read the list again
    const ctx = setupPanel({ panelSource, deleteRefreshFlag: true, reload: false })
    ctx.layout.edit()
    await open(ctx)
    c(assert.ok, ctx.view.click(restoreButtons(ctx.view)[1]))
    c(assert.deepEqual, ctx.layout.posted.map(m => m.action), ['getVersionHistory'], 'nothing is sent by pressing Restore')
    c(assert.match, ctx.view.textOf(ctx.view.tree()), /Your current deck is saved as a new version first/, 'the confirmation says so')
    ctx.view.click(buttonNamed(ctx.view, 'Cancel'))
    c(assert.equal, buttonNamed(ctx.view, 'Restore this version'), undefined, 'Cancel closes the confirmation')
    c(assert.deepEqual, ctx.layout.posted.map(m => m.action), ['getVersionHistory'])
    await confirmAndRestore(ctx, 1)
    c(assert.deepEqual, ctx.layout.posted.map(m => m.action), ['getVersionHistory', 'forceSave', 'restoreVersion'], 'save, then restore')
    c(assert.deepEqual, messagesWith(ctx.layout, 'restoreVersion')[0].params, { versionId: 'v_old1', createBackup: true, reload: true })
    c(assert.deepEqual, ctx.layout.stored, { slides: ['O1'] })
    c(assert.deepEqual, ctx.layout.versions.find(v => v.created_by === 'system').data, { slides: ['A1', 'A2-edited'] }, 'the safety copy holds the edit made while the panel was closed')
    c(assert.deepEqual, ctx.world.calls.deckChanges, ['slide'], 'other tabs are told once')
    c(assert.deepEqual, ctx.world.calls.veil, [{ revisionAtSend: 0, revisionNow: 0 }], 'the stale canvas is covered until the reloaded frame loads')
    c(assert.equal, ctx.view.textOf(ctx.view.tree()).includes(ctx.world.lib.RESTORED_RELOADING_NOTICE), true, 'the panel says to wait')
    c(assert.ok, restoreButtons(ctx.view).every(node => node.props.disabled === true), 'Restore stays off until the viewer has reloaded')
    c(assert.equal, ctx.iframe.loadHandlerCount(), 1, 'the panel watches the frame')
    ctx.iframe.fireLoad() // the reloaded document
    await settle()
    c(assert.equal, messagesWith(ctx.layout, 'getVersionHistory').length, 2, 'the list is read again from the reloaded viewer')
    c(assert.match, ctx.view.textOf(ctx.view.tree()), /Version restored\. Your previous deck is saved as a version from /, 'and the safety copy is named')
    c(assert.ok, restoreButtons(ctx.view).every(node => node.props.disabled !== true), 'Restore is back')
    c(assert.equal, rowsText(ctx.view).length, 4, 'the list has the save of the pending edit and the safety copy')
    c(assert.match, rowsText(ctx.view)[0], /Safety copy/)
    c(assert.match, rowsText(ctx.view)[0], /Saved automatically before a restore/)
    ctx.view.unmount()
  }

  { // the viewer reloads before the acknowledgement is handled: no waiting, no veil, the list is read again by the load
    const ctx = setupPanel({ panelSource, deleteRefreshFlag: true })
    await open(ctx)
    await confirmAndRestore(ctx, 0)
    c(assert.equal, ctx.layout.reloaded, true)
    c(assert.equal, messagesWith(ctx.layout, 'getVersionHistory').length, 2, 'the frame load read the list again')
    c(assert.match, ctx.view.textOf(ctx.view.tree()), /Version restored\. Your previous deck is saved as a version from /)
    c(assert.ok, restoreButtons(ctx.view).every(node => node.props.disabled !== true), 'Restore is back')
    ctx.view.unmount()
  }

  { // flag for the veil off: no veil
    const ctx = setupPanel({ panelSource, deleteRefreshFlag: false, reload: false })
    await open(ctx)
    await confirmAndRestore(ctx, 0)
    c(assert.deepEqual, ctx.world.calls.veil, [], 'PASS2D B4 off: the canvas veil is not raised')
    c(assert.equal, ctx.view.textOf(ctx.view.tree()).includes(ctx.world.lib.RESTORED_RELOADING_NOTICE), true, 'but the panel still says to wait')
    ctx.view.unmount()
  }

  { // the viewer refuses the save: the restore is never sent, the words are shown, nothing is told to other tabs
    const ctx = setupPanel({ panelSource, layoutOptions: { forceSaveWorks: false } })
    ctx.layout.edit()
    await open(ctx)
    await confirmAndRestore(ctx, 0)
    c(assert.ok, !ctx.layout.posted.some(m => m.action === 'restoreVersion'), 'no restore command')
    const alert = ctx.view.find(p => p.role === 'alert')
    c(assert.equal, alert.length, 1)
    c(assert.equal, ctx.view.textOf(alert[0]), ctx.world.lib.RESTORE_SAVE_FAILED_MESSAGE)
    c(assert.deepEqual, ctx.layout.stored, { slides: ['A1', 'A2'] })
    c(assert.deepEqual, ctx.world.calls.deckChanges, [])
    c(assert.equal, rowsText(ctx.view).length, 2, 'the list is as it was')
    c(assert.ok, restoreButtons(ctx.view).every(node => node.props.disabled !== true), 'Restore is available again')
    ctx.view.unmount()
  }

  { // Layout cannot write its safety copy: the words are shown, the deck was not replaced
    const ctx = setupPanel({ panelSource, layoutOptions: { backupWorks: false } })
    await open(ctx)
    await confirmAndRestore(ctx, 0)
    c(assert.equal, ctx.view.textOf(ctx.view.find(p => p.role === 'alert')[0]), ctx.world.lib.RESTORE_NOT_FOUND_MESSAGE)
    c(assert.deepEqual, ctx.layout.stored, { slides: ['A1', 'A2'] })
    c(assert.deepEqual, ctx.world.calls.deckChanges, [])
    ctx.view.unmount()
  }

  { // no answer and no reload: said so, and the list is read again to show what happened
    const ctx = setupPanel({ panelSource, layoutOptions: { answerRestore: false }, reload: false })
    await open(ctx)
    await confirmAndRestore(ctx, 0)
    ctx.world.clock.advance(ctx.world.lib.VERSION_RESTORE_TIMEOUT_MS + 1)
    await settle()
    c(assert.equal, ctx.view.textOf(ctx.view.find(p => p.role === 'alert')[0]), ctx.world.lib.RESTORE_UNCONFIRMED_MESSAGE)
    c(assert.equal, messagesWith(ctx.layout, 'getVersionHistory').length, 2, 'the list is read again')
    c(assert.equal, messagesWith(ctx.layout, 'restoreVersion').length, 1, 'never retried')
    c(assert.deepEqual, ctx.world.calls.deckChanges, [], 'not told as done')
    ctx.view.unmount()
  }

  { // the answer is lost to the reload: the reloaded viewer's list shows Layout's safety copy, so it counts as restored
    const ctx = setupPanel({ panelSource, layoutOptions: { answerRestore: false } })
    await open(ctx)
    await confirmAndRestore(ctx, 0)
    c(assert.equal, ctx.view.find(p => p.role === 'alert').length, 0, 'no error')
    c(assert.deepEqual, ctx.world.calls.deckChanges, ['slide'])
    c(assert.match, ctx.view.textOf(ctx.view.tree()), /Version restored\. Your previous deck is saved as a version from /)
    c(assert.deepEqual, ctx.layout.stored, { slides: ['O2'] })
    ctx.view.unmount()
  }

  { // a frame that loads for another reason while the restore never reached Layout is not a restore
    const ctx = setupPanel({ panelSource, layoutOptions: { answerRestore: false, swallowRestore: true }, reload: false })
    await open(ctx)
    await confirmAndRestore(ctx, 0)
    ctx.iframe.fireLoad()
    await settle()
    c(assert.equal, ctx.view.textOf(ctx.view.find(p => p.role === 'alert')[0]), ctx.world.lib.RESTORE_UNCONFIRMED_MESSAGE, 'a load alone is not proof')
    c(assert.deepEqual, ctx.world.calls.deckChanges, [])
    c(assert.deepEqual, ctx.layout.stored, { slides: ['A1', 'A2'] })
    ctx.view.unmount()
  }

  { // the deck is being built: Restore is off and says why
    const ctx = setupPanel({ panelSource, props: { building: true } })
    await open(ctx)
    c(assert.ok, restoreButtons(ctx.view).length === 2 && restoreButtons(ctx.view).every(node => node.props.disabled === true), 'every Restore is off')
    c(assert.match, ctx.view.textOf(ctx.view.tree()), /finished building/)
    c(assert.equal, ctx.view.click(restoreButtons(ctx.view)[0]), false, 'pressing it does nothing')
    c(assert.deepEqual, ctx.layout.posted.map(m => m.action), ['getVersionHistory'])
    ctx.view.unmount()
  }

  { // two presses of the confirmation: one restore
    const ctx = setupPanel({ panelSource, reload: false })
    await open(ctx)
    ctx.view.click(restoreButtons(ctx.view)[0])
    const confirm = buttonNamed(ctx.view, 'Restore this version')
    confirm.props.onClick()
    confirm.props.onClick()
    await settle()
    c(assert.equal, messagesWith(ctx.layout, 'restoreVersion').length, 1, 'one restore command')
    ctx.view.unmount()
  }

  { // the list could not be read: the words, and Try again asks again
    const ctx = setupPanel({ panelSource, layoutOptions: { historyError: 'Presentation not found' } })
    await open(ctx)
    c(assert.equal, ctx.view.textOf(ctx.view.find(p => p.role === 'alert')[0]), 'Presentation not found')
    c(assert.equal, rowsText(ctx.view).length, 0)
    ctx.layout.historyError = null
    ctx.view.click(buttonNamed(ctx.view, 'Try again'))
    await settle()
    c(assert.equal, rowsText(ctx.view).length, 2, 'Try again reads it again')
    ctx.view.unmount()
  }

  { // an empty list says so; no answer in time says so
    const ctx = setupPanel({ panelSource })
    ctx.layout.versions.length = 0
    await open(ctx)
    c(assert.match, ctx.view.textOf(ctx.view.tree()), /No earlier versions yet/)
    ctx.view.unmount()
    const silent = setupPanel({ panelSource })
    silent.layout.receive = message => { silent.layout.posted.push(message) }
    silent.view.setProps({ isOpen: true })
    await settle()
    silent.world.clock.advance(silent.world.lib.VERSION_HISTORY_FETCH_TIMEOUT_MS + 1)
    await settle()
    c(assert.equal, silent.view.textOf(silent.view.find(p => p.role === 'alert')[0]), silent.world.lib.VERSION_HISTORY_FAILED_MESSAGE)
    silent.view.unmount()
  }

  { // Escape and the close button
    const ctx = setupPanel({ panelSource })
    await open(ctx)
    let stopped = 0
    dialogOf(ctx.view).props.onKeyDown({ key: 'a', stopPropagation() { stopped++ } })
    c(assert.equal, ctx.closes.length, 0, 'other keys do nothing')
    dialogOf(ctx.view).props.onKeyDown({ key: 'Escape', stopPropagation() { stopped++ } })
    c(assert.equal, ctx.closes.length, 1, 'Escape closes')
    c(assert.equal, stopped, 1)
    ctx.view.find((p, node) => node.type === 'button' && p['aria-label'] === 'Close version history')[0].props.onClick()
    c(assert.equal, ctx.closes.length, 2, 'and so does the close button')
    ctx.view.unmount()
  }

  { // another deck: the old list and any half-made choice go, the new deck's list is read
    const ctx = setupPanel({ panelSource })
    await open(ctx)
    ctx.view.click(restoreButtons(ctx.view)[0])
    c(assert.ok, buttonNamed(ctx.view, 'Restore this version'))
    ctx.view.setProps({ deckKey: 'k2' })
    await settle()
    c(assert.equal, buttonNamed(ctx.view, 'Restore this version'), undefined, 'the confirmation of the old deck is gone')
    c(assert.equal, messagesWith(ctx.layout, 'getVersionHistory').length, 2, 'the list is read again')
    c(assert.equal, rowsText(ctx.view).length, 2)
    ctx.view.unmount()
  }

  { // closing and opening again reads the list again; closing keeps listening
    const ctx = setupPanel({ panelSource })
    await open(ctx)
    ctx.view.setProps({ isOpen: false })
    c(assert.equal, ctx.view.tree(), null)
    c(assert.ok, ctx.world.win.handlerCount() >= 1, 'still listening while closed')
    await open(ctx)
    c(assert.equal, messagesWith(ctx.layout, 'getVersionHistory').length, 2)
    ctx.view.unmount()
    c(assert.equal, ctx.world.win.handlerCount(), 0, 'unmounted: no listener left')
    c(assert.equal, ctx.iframe.loadHandlerCount(), 0, 'and no frame listener')
  }

  { // a long list shows the newest first and the rest on request
    const ctx = setupPanel({ panelSource })
    for (let i = 0; i < 59; i++) ctx.layout.versions.push({ version_id: `v_more${i}`, created_at: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(), created_by: 'user', change_summary: `older ${i}`, presentation_id: 'p1', data: { slides: [] } })
    await open(ctx)
    c(assert.equal, rowsText(ctx.view).length, ctx.world.lib.VERSION_PAGE_SIZE)
    const more = ctx.view.find((p, node) => node.type === 'button' && /^Show older versions/.test(ctx.view.textOf(node)))
    c(assert.equal, more.length, 1)
    c(assert.match, ctx.view.textOf(more[0]), /\(21 more\)/)
    ctx.view.click(more[0])
    c(assert.equal, rowsText(ctx.view).length, 61)
    c(assert.equal, ctx.view.find((p, node) => node.type === 'button' && /^Show older versions/.test(ctx.view.textOf(node))).length, 0)
    ctx.view.unmount()
  }
}

// ================================================================ run
const ctx = { lib: { ...(await load(FILES.lib, SRC.lib)), __source: SRC.lib }, slide: await load(FILES.slide, SRC.slide) }
await libSuite(ctx.lib, ctx.slide, check)
console.log(`  lib suite: ${checks} checks`)
const afterLib = checks
await flowSuite(ctx.lib, ctx.slide, check)
console.log(`  restore against the Layout model: ${checks - afterLib} checks`)
const afterFlow = checks
await contractSuite(ctx.lib, check)
liveLayoutChecks(check)
console.log(`  Layout contract: ${checks - afterFlow} checks`)
const afterContract = checks
wiring(SRC, check)
registrationChecks(check)
console.log(`  wiring of the real sources: ${checks - afterContract} checks`)
const afterWiring = checks
if (TS) {
  await panelSuite(SRC.panel, check)
  console.log(`  the real panel against the Layout model: ${checks - afterWiring} checks`)
} else console.log('  SKIP the real panel against the Layout model: typescript is not installed (npm/pnpm install, or TS_MODULE=<path to typescript.js>)')

// ---------------------------------------------------------------- 5. mutants: each broken copy must be caught by the suite that guards it
const caught = []
const missed = []
async function libMutant(name, find, replace, { only } = {}) {
  if (!SRC.lib.includes(find)) { missed.push(`does not apply: ${name}`); return }
  const mutated = SRC.lib.replace(find, replace)
  try {
    const lib = { ...(await load(FILES.lib, mutated)), __source: mutated }
    const quiet = (fn, ...args) => fn(...args)
    if (!only || only === 'lib') await libSuite(lib, ctx.slide, quiet)
    if (!only || only === 'flow') await flowSuite(lib, ctx.slide, quiet)
    if (!only || only === 'contract') await contractSuite(lib, quiet)
    missed.push(`SURVIVED: ${name}`)
  } catch (error) { caught.push(name); if (process.env.VERBOSE) console.log(`    caught ${name}: ${String(error?.message ?? error).split('\n')[0].slice(0, 150)}`) }
}
function sourceMutant(name, file, find, replace, { base = false } = {}) {
  const text = SRC[file]
  if (!text.includes(find)) { missed.push(`does not apply: ${name}`); return }
  try {
    wiring({ ...SRC, [file]: text.replace(find, replace) }, (fn, ...args) => fn(...args), { allowBaseCheck: base })
    missed.push(`SURVIVED: ${name}`)
  } catch (error) { caught.push(name); if (process.env.VERBOSE) console.log(`    caught ${name}: ${String(error?.message ?? error).split('\n')[0].slice(0, 150)}`) }
}

// the rule: a restore that does not save first, or does not stop when the save fails
await libMutant('restore without saving first (the save step is skipped)', 'saved = await saveCurrent()', 'saved = { ok: true }')
await libMutant('restore without saving first (restore sent before the save is awaited)', 'saved = await saveCurrent()', 'void saveCurrent(); saved = { ok: true }')
await libMutant('a failed save does not stop the restore', "if (!saved || saved.ok !== true) {", 'if (false) {')
await libMutant('a rejected save counts as saved', 'saved = { ok: false, message: RESTORE_SAVE_FAILED_MESSAGE }\n  }', 'saved = { ok: true }\n  }')
await libMutant('a save that answers anything truthy counts as saved', 'saved.ok !== true', '!saved.ok')
await libMutant('the save failure words are dropped', 'message: (saved && saved.message) || RESTORE_SAVE_FAILED_MESSAGE', "message: 'x'")
await libMutant('restore phase announced before the save', "onPhase?.('saving')\n", "onPhase?.('restoring')\n")
await libMutant('a failed restore is retried', 'sent = await sendRestore(request)\n  } catch {', 'sent = await sendRestore(request)\n    if (!sent.ok) sent = await sendRestore(request)\n  } catch {')
await libMutant('a send that throws counts as restored', 'sent = { ok: false, unconfirmed: true, message: RESTORE_UNCONFIRMED_MESSAGE }\n  }', 'sent = { ok: true }\n  }')
await libMutant('an unconfirmed restore is reported as a plain refusal', "if (sent && sent.unconfirmed === true) return { ok: false, stage: 'unconfirmed'", "if (false) return { ok: false, stage: 'unconfirmed'")
await libMutant('a restore without a version id is attempted', "if (typeof versionId !== 'string' || versionId.trim() === '') throw new Error('A version id is required')", '')
// Layout's backup
await libMutant('restore asks Layout for no backup', 'createBackup: true, reload: true }', 'createBackup: false, reload: true }')
await libMutant('restore leaves the backup to Layout\'s default only', 'createBackup: true, reload: true }', 'reload: true }')
await libMutant('restore does not reload the viewer', 'reload: true }', 'reload: false }')
// the envelope
await libMutant('the list request uses the old {command} envelope', "{ action: 'getVersionHistory', params: {} }", "{ command: 'getVersionHistory', params: {} }")
await libMutant('the restore request uses the old {command} envelope', "{ action: 'restoreVersion', params:", "{ command: 'restoreVersion', params:")
await libMutant('the restore request names the wrong id key', 'params: { versionId, createBackup', 'params: { version_id: versionId, createBackup')
// the list
await libMutant('the list is oldest first', 'timeOf(b.row.createdAt) - timeOf(a.row.createdAt)', 'timeOf(a.row.createdAt) - timeOf(b.row.createdAt)')
await libMutant('rows are read from the wrong key', 'row.version_id', 'row.versionId')
await libMutant('an error reply is accepted as a list', 'data.success !== true', 'data.success === false')
await libMutant('the current version id is not read', "currentVersionId: typeof data.currentVersionId === 'string' ? data.currentVersionId : ''", "currentVersionId: ''")
await libMutant('relative times are off by an hour', 'if (minutes < 60) return', 'if (minutes < 61) return')
await libMutant('the safety copy is any new version', "row.createdBy !== 'system'", 'false')
await libMutant('the safety copy need not name the restored version', 'row.changeSummary.endsWith(`${PRE_RESTORE_SUMMARY_PREFIX}${restoredVersionId}`)', 'true')
await libMutant('the safety copy may merely mention the restored version', 'row.changeSummary.endsWith(`${PRE_RESTORE_SUMMARY_PREFIX}${restoredVersionId}`)', 'row.changeSummary.includes(restoredVersionId)')
await libMutant('a not-found restore is described as a generic failure', "if (/not found/i.test(text)) return RESTORE_NOT_FOUND_MESSAGE", '')
await libMutant('a save-guard refusal is described as a generic failure', "if (/unsaved edits|could not be saved/i.test(text)) return RESTORE_SAVE_FAILED_MESSAGE", '')
await libMutant('restore stays on while the deck builds', 'return input.building ?', 'return false ?')
// the bridge
await libMutant('a stale unregister removes the newer opener', 'if (opener !== open) return\n', '')
await libMutant('open() calls a missing opener', 'if (!opener) return false\n', '')
await libMutant('the menu is not told when a deck goes away', "opener = null\n        notify()", 'opener = null')
await libMutant('the flag is on by default', "=== 'true'", "!== 'false'")
await libMutant('a broken listener breaks the viewer', 'try { listener() } catch { /* a listener never breaks the viewer */ }', 'listener()')

// the same rule broken, caught by the run against the Layout model alone (a pending edit must be in the safety copy; a refused save must leave Layout untouched)
await libMutant('[model] restore without saving first (the save step is skipped)', 'saved = await saveCurrent()', 'saved = { ok: true }', { only: 'flow' })
await libMutant('[model] restore without saving first (restore sent before the save is awaited)', 'saved = await saveCurrent()', 'void saveCurrent(); saved = { ok: true }', { only: 'flow' })
await libMutant('[model] a failed save does not stop the restore', "if (!saved || saved.ok !== true) {", 'if (false) {', { only: 'flow' })
await libMutant('[model] restore asks Layout for no backup', 'createBackup: true, reload: true }', 'createBackup: false, reload: true }', { only: 'flow' })
await libMutant('[model] restore uses the old {command} envelope', "{ action: 'restoreVersion', params:", "{ command: 'restoreVersion', params:", { only: 'flow' })
await libMutant('[model] the list uses the old {command} envelope', "{ action: 'getVersionHistory', params: {} }", "{ command: 'getVersionHistory', params: {} }", { only: 'flow' })
await libMutant('[model] a restore the viewer refused is reported as done', 'if (sent && sent.ok === true) return { ok: true }', 'if (sent) return { ok: true }', { only: 'flow' })

await libMutant('a reload alone counts as a restore', 'if (parsed.ok && findPreRestoreBackup(before, parsed.history.versions, restoredVersionId)) return { ok: true }', 'return { ok: true }')
await libMutant('any safety copy proves the restore', 'parsed.ok && findPreRestoreBackup(before, parsed.history.versions, restoredVersionId)', 'parsed.ok && parsed.history.versions.length > before.length')
await libMutant('the backup notice names no time', 'formatVersionTime(backup.createdAt, now)', "''")
await libMutant('the reloading notice drops the warning', 'wait for it before editing.', 'done.')
// the real panel, menu row, viewer and profile menu
sourceMutant('the panel restores without the save step', 'panel', "saveCurrent: () => flushViewerBeforeRestore({", "saveCurrent: async () => ({ ok: true as const }), unusedSave: () => flushViewerBeforeRestore({", {})
sourceMutant('the panel skips the restore rule', 'panel', 'const outcome = await restoreVersionSafely({', 'const outcome = await skipRule({', {})
sourceMutant('the panel posts by hand', 'panel', "const before = versionsRef.current", "const before = versionsRef.current; iframe.contentWindow?.postMessage({ command: 'restoreVersion' }, '*')", {})
sourceMutant('the panel brings back the old envelope', 'panel', 'const request = getVersionHistoryRequest()', "const request = { command: 'getVersionHistory', params: {} }", {})
sourceMutant('the panel names the restore params itself', 'panel', 'const before = versionsRef.current', 'const before = versionsRef.current; const createBackup = false', {})
sourceMutant('the panel stops recording the save status', 'panel', 'saveTracker.record(event.data)', 'void event.data', {})
sourceMutant('the panel opens the tracker only on open', 'panel', 'const [saveTracker] = useState(() => createSaveStatusTracker())', 'const saveTracker = isOpen ? createSaveStatusTracker() : null', {})
sourceMutant('the panel tells other tabs before the restore is known', 'panel', 'if (!outcome.ok) {', "reportDeckChange('slide')\n    if (!outcome.ok) {", {})
sourceMutant('the panel allows two restores at once', 'panel', 'if (restoringRef.current) return', '', {})
sourceMutant('the panel ignores a building deck', 'panel', 'restoreBlockedReason({ building })', 'null', {})
sourceMutant('the panel asks with a browser confirm()', 'panel', "setConfirming(version.versionId)", "confirm('Restore?') && setConfirming(version.versionId)", {})
sourceMutant('the panel covers the canvas without PASS2D B4\'s flag', 'panel', 'STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED && studio', 'studio', {})
sourceMutant('the panel does not say to wait', 'panel', 'setNotice(RESTORED_RELOADING_NOTICE)', 'setNotice(RESTORED_NOTICE)', {})
sourceMutant('the panel stops counting frame loads', 'panel', 'frameLoadsRef.current += 1; ', '', {})
sourceMutant('the panel waits for a reload that already happened', 'panel', 'if (frameLoadsRef.current === loadsAtSend) {', 'if (true) {', {})
sourceMutant('the menu row renders without the flag', 'item', 'if (!STUDIO_VERSION_HISTORY_V2_ENABLED) return null', '', {})
sourceMutant('the menu row shows with no deck on screen', 'item', 'if (!available) return null', '', {})
sourceMutant('the menu row calls its hook with the flag off', 'item', 'if (!STUDIO_VERSION_HISTORY_V2_ENABLED) return null\n  return <VersionHistoryMenuItemRow chevron={chevron} />', 'useSyncExternalStore(versionHistoryBridge.subscribe, versionHistoryBridge.isAvailable, noDeckOnServer)\n  if (!STUDIO_VERSION_HISTORY_V2_ENABLED) return null\n  return <VersionHistoryMenuItemRow chevron={chevron} />', {})
sourceMutant('the chevron shows in the original menu too', 'item', '{chevron && <ChevronRight', '{<ChevronRight', {})
sourceMutant('the viewer registers the opener with the flag off', 'viewer', 'if (!STUDIO_VERSION_HISTORY_V2_ENABLED || !VIEWER_ORIGIN || LAYOUT_URL_CONFIG_ERROR) return // VERSION-HISTORY-V2', 'if (!VIEWER_ORIGIN || LAYOUT_URL_CONFIG_ERROR) return // VERSION-HISTORY-V2', {})
sourceMutant('the viewer mounts the panel with the flag off', 'viewer', '{STUDIO_VERSION_HISTORY_V2_ENABLED && VIEWER_ORIGIN', '{VIEWER_ORIGIN', {})
sourceMutant('the viewer mount leaves a text node with the flag off', 'viewer', 'studio={studioShell} />}{/* VERSION-HISTORY-V2:', 'studio={studioShell} />} {/* VERSION-HISTORY-V2:', { base: false })
sourceMutant('the viewer opens the old panel too', 'viewer', "const [versionHistoryV2Open, setVersionHistoryV2Open] = useState(false) // VERSION-HISTORY-V2", "const [versionHistoryV2Open, setVersionHistoryV2Open] = useState(false) // VERSION-HISTORY-V2\n  useEffect(() => { setShowVersionHistory(true) }, [])", { base: false })
sourceMutant('the viewer drops the mark from an added line', 'viewer', "const [versionHistoryV2Open, setVersionHistoryV2Open] = useState(false) // VERSION-HISTORY-V2", 'const [versionHistoryV2Open, setVersionHistoryV2Open] = useState(false)', { base: true })
sourceMutant('the viewer loses a base line', 'viewer', "  const [showThemePanel, setShowThemePanel] = useState(false)\n", '', { base: true })
sourceMutant('the profile menu loses a base line', 'menu', '          <span>Settings</span>\n', '', { base: true })
sourceMutant('the profile menu row renders without the flag', 'menu', "process.env.NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2 === 'true' ? <VersionHistoryMenuItem", "true ? <VersionHistoryMenuItem", { base: false })
sourceMutant('the profile menu flag is on unless it says false', 'menu', "=== 'true' ? <VersionHistoryMenuItem", "!== 'false' ? <VersionHistoryMenuItem", { base: false })
sourceMutant('the mockup menu row is after the wrong row', 'menuP2', 'entry.id === "settings" &&', 'entry.id === "shortcuts" &&', { base: false })
sourceMutant('the mockup menu has no row', 'menuP2', '[row, versionHistoryRow]', '[row]', { base: false })
sourceMutant('the mockup menu reads the flag itself', 'menuP2', 'const row = ( // VERSION-HISTORY-V2', 'const flagged = process.env.NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2; const row = ( // VERSION-HISTORY-V2', { base: false })
sourceMutant('the mockup menu loses a base line', 'menuP2', '            <span>{entry.label}</span>\n', '', { base: true })
sourceMutant('a second row in the profile menu', 'menu', '? <VersionHistoryMenuItem key="version-history" chevron={p2Menu} /> : null', '? <><VersionHistoryMenuItem key="a" /><VersionHistoryMenuItem key="b" /></> : null', { base: false })
sourceMutant('the mockup body gets no row from the profile menu', 'menu', ' {...(versionHistoryRow ? { versionHistoryRow /* VERSION-HISTORY-V2 */ } : {})}', '', { base: false })
sourceMutant('the mockup body always gets a prop', 'menu', '{...(versionHistoryRow ? { versionHistoryRow /* VERSION-HISTORY-V2 */ } : {})}', 'versionHistoryRow={versionHistoryRow}', { base: false })
sourceMutant('the old panel is edited', 'oldPanel', "command: 'getVersionHistory'", "action: 'getVersionHistory'", { base: true })
sourceMutant('a second file reads the flag', 'panel', 'iframeRef: RefObject<HTMLIFrameElement | null>', 'iframeRef: RefObject<HTMLIFrameElement | null>; unusedFlag?: typeof process.env.NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2', {})

async function panelMutant(name, find, replace) {
  if (!SRC.panel.includes(find)) { missed.push(`does not apply: ${name}`); return }
  try {
    await panelSuite(SRC.panel.replace(find, replace), (fn, ...args) => fn(...args))
    missed.push(`SURVIVED: ${name}`)
  } catch (error) { caught.push(name); if (process.env.VERBOSE) console.log(`    caught ${name}: ${String(error?.message ?? error).split('\n')[0].slice(0, 150)}`) }
}
if (TS) {
  // the real panel, run: each broken copy must fail a scenario
  await panelMutant('[panel] restore without the save step', 'saveCurrent: () => flushViewerBeforeRestore({', 'saveCurrent: async () => ({ ok: true as const }), unusedSave: () => flushViewerBeforeRestore({')
  await panelMutant('[panel] the save status is not recorded', 'saveTracker.record(event.data)', 'void event.data')
  await panelMutant('[panel] Restore without the confirmation', 'onClick={() => { setRestoreError(null); setConfirming(version.versionId) }}', 'onClick={() => { void runRestore(version.versionId) }}')
  await panelMutant('[panel] Restore while the deck builds', 'const blockedReason = restoreBlockedReason({ building })', 'const blockedReason = null')
  await panelMutant('[panel] other tabs told of a restore that did not happen', 'if (!outcome.ok) {', "reportDeckChange('slide')\n    if (!outcome.ok) {")
  await panelMutant('[panel] two restores at once', 'if (restoringRef.current) return\n', '')
  await panelMutant('[panel] the canvas veil without PASS2D B4\'s flag', 'STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED && studio', 'studio')
  await panelMutant('[panel] nothing resets for another deck', '    restoreCheckRef.current = null\n  }, [deckKey])', '    restoreCheckRef.current = null\n  }, [])')
  await panelMutant('[panel] Escape does not close', "if (event.key === 'Escape') { event.stopPropagation(); onClose() }", '')
  await panelMutant('[panel] the list is not read on open', 'if (isOpen) void fetchVersions()', '')
  await panelMutant('[panel] Restore stays on while the viewer reloads', 'Boolean(blockedReason) || restoring !== null || reloading', 'Boolean(blockedReason) || restoring !== null')
  await panelMutant('[panel] an unconfirmed restore does not read the list', "if (outcome.stage === 'unconfirmed') void fetchVersions()", '')
  await panelMutant('[panel] the frame load does not read the list again', 'setFrameEpoch(epoch => epoch + 1)', 'setFrameEpoch(epoch => epoch)')
  await panelMutant('[panel] no waiting for a reload that is still to come', 'if (frameLoadsRef.current === loadsAtSend) {', 'if (false) {')
  await panelMutant('[panel] a frame load counts as a restore without looking', 'reply => finish(restoreResultFromList(before, reply, String(request.params.versionId))),', 'reply => finish({ ok: true }),')
  await panelMutant('[panel] the current version can be restored', '{!isCurrent && (', '{(')
  await panelMutant('[panel] the whole list at once', 'versions.slice(0, shown)', 'versions')
  await panelMutant('[panel] the old envelope for the list', 'const request = getVersionHistoryRequest()', "const request = { action: 'x', params: { command: 'getVersionHistory' } }")
}
console.log(`  mutants: ${caught.length} caught of ${caught.length + missed.length}`)
for (const line of missed) console.log(`  MISSED: ${line}`)
assert.equal(missed.length, 0, `mutants missed: ${missed.join('; ')}`)
console.log(`test-studio-version-history-v2: ${checks} checks, ${caught.length}/${caught.length} mutants caught`)
