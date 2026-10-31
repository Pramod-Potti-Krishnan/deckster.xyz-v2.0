// FRONTEND-2 (PROGRAM-1 SUPERCHARGE I2, chat undo v2): proof for the Studio side of DIRECTOR-2's Director !544 follow-up, behind the flag bulk edit + chat undo already has (NEXT_PUBLIC_STUDIO_CHAT_UNDO, default off, no new flag):
//   change_recorded now carries anchor_message_id (the LIVE id of the closing chat line); a frame re-sent after a reconnect adds replayed: true and, when that connect replayed the chat history, anchor_history_id (the msg_hist_* id
//   of the replayed closing line); after a later edit nothing is re-sent. Studio puts the Undo chip under the line whose id is the live anchor, else the history anchor, else v1's rule (the latest Director line seen live), draws it
//   again after a reload, REPLACES the chip of a change it already has (never two), never revives an Undone / Couldn't undo chip, and still turns older chips into "A later change replaced this".
// Plain node, no browser, no network, no services, no paid call: the REAL TypeScript is transpiled and run in a vm; the REAL MessageList is server-rendered with react-dom, and #499's own adapter and store (74aaf20c, read from
// git) are run on the same frames.
//   RECORDED  scripts/fixtures/chat-undo-v2/0*.json: DIRECTOR-2's seven offline record.py transcripts re-recorded at director_commit 18fa6604 (Director !544), copied verbatim: the real WebSocketHandler (06, and 07 through
//             handle_connection for the reconnects) and DecisionEngine over scripted model output, $0. 06 and 07 carry the new keys; 01 to 05 are the v1 scenarios re-recorded.
//   DERIVED   every other frame or state below says so: the chat lines "the DOM shows" (which ids are on screen after a reload is Studio's own state), an extra Director line placed between a closing line and its
//             change_recorded (to tell a live anchor from the heuristic), a changed label on a re-send, and every malformed value.
//   1. recorded   the seven files are what the README says (anchors, replayed, history ids, events)
//   2. v1 compat  #499's adapter and store take every frame of all seven (extra keys ignored, nothing thrown, the same chips)
//   3. wire       parseChangeAnchors / parseSyncedPresentation: valid, absent, hostile
//   4. host rule  undoHostOf: live anchor, history anchor, v1's line; the chat's lines known or not
//   5. store      live anchor beats the heuristic; skip_history re-send replaces; reload + history replay draws the chip under the history line; nothing re-sent after a later edit; never revived; older chips replaced;
//                 the displayed deck rules; flag off
//   6. hookup     the real MessageList: the chip under the right line live, after a skip_history reconnect, after a history replay, with both lines, with neither
//   7. change     strip = BASE_COMMIT byte for byte, the roots reach it, no .env.example block, the registry names the files, scope (the COMMITTED diff only), secret scan
//   8. mutants    each one must make sections 1-7 fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
const chatClean = await import('./studio-chat-clean-strip.mjs') // LATER-CHANGES: registry read (CHAT-CLEAN): the strip of the change stacked after this one, so its marked lines (chat clean's) come out first
const order = await import('./studio-chat-clean-order-strip.mjs') // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER): the strip of the change stacked after chat clean, so its marked lines in the message list come out first
import { BASE_COMMIT, CHAT_UNDO_V2_CHANGES, CHAT_UNDO_V2_FILES, CHAT_UNDO_V2_NEW_FILES, CHAT_UNDO_V2_OWN_EDITS, CHAT_UNDO_V2_MARKER } from './studio-chat-undo-v2-strip.mjs'
import { stripOpenReadOnly } from './studio-open-read-only-strip.mjs'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { STACKED_PASS3_FILES } from './studio-library-manage-harness.mjs'
import { LATER_CHANGE_FILES } from './studio-later-changes.mjs'
import { stripBulkEditUndo } from './studio-bulk-edit-undo-strip.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const BASE = process.env.CHAT_UNDO_V2_BASE || BASE_COMMIT
const OWN_SCOPE = new Set([...CHAT_UNDO_V2_FILES, ...CHAT_UNDO_V2_NEW_FILES, ...CHAT_UNDO_V2_OWN_EDITS]) // = CHAT_UNDO_V2_SCOPE_FILES of the strip module
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
// This change's OWN committed files. The first-parent line BASE..HEAD has the non-merge commits that sit directly on it. A commit there is THIS change's only if it touches at least one of this change's own files (`own`: the strip module's
// CHAT_UNDO_V2_SCOPE_FILES): a later change committed straight on top of this one (a stacked PR, before it is merged) touches none of them, so it is not this change's to answer for. What a merged-in branch brings (COMPOSER-2's first
// paint and deck cards, once they are merged under or into this one) is that branch's, whatever it registers. And a file a LATER change has registered (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES) is never a stray here.
const firstParentCommits = () => git('log', '--first-parent', '--no-merges', '--name-only', '--format=%x01%H', `${BASE}..HEAD`).split('\x01').filter(Boolean).map(block => { const [id, ...files] = block.split('\n'); return { id, files: files.filter(Boolean) } })
const firstParentDeleted = () => new Map(git('log', '--first-parent', '--no-merges', '--name-only', '--diff-filter=D', '--format=%x01%H', `${BASE}..HEAD`).split('\x01').filter(Boolean).map(block => { const [id, ...files] = block.split('\n'); return [id, files.filter(Boolean)] }))
let history = null // a made-up first-parent history [{ id, files, deleted? }], in place of git's (the scope rule's own proof and its mutant); null: git's
const commitsOf = () => history ?? firstParentCommits()
const RULE = { touchesOwn: true, skipLater: true } // the two parts of the scope rule; a mutant switches one off
const ownCommits = (own, commits = commitsOf()) => commits.filter(commit => !RULE.touchesOwn || commit.files.some(rel => own.has(rel)))
const ownCommitted = (own, commits = commitsOf()) => [...new Set(ownCommits(own, commits).flatMap(commit => commit.files))]
const ownDeleted = own => { const deleted = history ? null : firstParentDeleted(); return ownCommits(own).flatMap(commit => (deleted ? deleted.get(commit.id) : commit.deleted) ?? []).filter(rel => own.has(rel) || !LATER_CHANGE_FILES.has(rel)) } // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT): a file a LATER change registered and then retired (the fixture it replaced, deleted in a commit that also touches one of this change's files) is that change's deletion, as its additions already are (scopeStray)
/** The files of this change's own commits that are neither its files nor a registered later change's: what the scope check refuses. */
const scopeStray = (own, later, commits = commitsOf()) => ownCommitted(own, commits).filter(rel => !own.has(rel) && !(RULE.skipLater && later.has(rel)))
const showCache = new Map()
const show = (commit, rel) => { const ref = `${commit}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
const baseOf = rel => show(BASE, rel)
let overrides = {} // in-memory mutations: the suite reads every source through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const clone = value => JSON.parse(JSON.stringify(value))
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))

const WIRE = 'lib/studio-bulk-edit-wire.ts', STORE = 'lib/studio-bulk-edit-store.ts', LIST = 'components/builder/message-list.tsx', CHIP = 'components/builder/chat/studio-undo-chip.tsx'
const STRIP_MODULE = 'scripts/studio-chat-undo-v2-strip.mjs', V1_STRIP = 'scripts/studio-bulk-edit-undo-strip.mjs', ENV = '.env.example', REGISTRY = 'scripts/studio-later-changes.mjs'
const ROOTS = ['scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/studio-add-slide-status-strip.mjs']
const BULK = 'NEXT_PUBLIC_STUDIO_BULK_EDIT', UNDO = 'NEXT_PUBLIC_STUDIO_CHAT_UNDO', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const ON = { [BULK]: 'true', [UNDO]: 'true', [SHELL]: 'true' }, OFF = { [SHELL]: 'true' }
const V1 = '74aaf20c5402f76268f93b8833a0b8c3830a73cc' // #499, frozen: bulk edit + chat undo and registry v1 (the adapter and store this change must stay compatible with)
const REGISTRY_V2 = '29fecf3363f99d8bf354359618c4ce3bfefc9910' // frontend2/later-changes-v2: the base of this change (scripts-only on top of #499)

// ---------------------------------------------------------------- RECORDED
const NAMES = ['01-bulk-confirm-card', '02-bulk-run-one-failure', '03-bulk-all-skipped', '04-undo-restored', '05-undo-superseded', '06-change-recorded-anchor', '07-reconnect-replay']
const REC = Object.fromEntries(NAMES.map(name => [name, JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/chat-undo-v2', `${name}.json`), 'utf8'))]))
const out = name => REC[name].frames.filter(item => item.direction === 'out').map(item => clone(item.frame))
const outSeq = (name, seq) => clone(REC[name].frames.find(item => item.seq === seq).frame)
const R06 = out('06-change-recorded-anchor'), R07 = REC['07-reconnect-replay']
const CHANGES_06 = R06.filter(frame => frame.type === 'change_recorded'), DONE_06 = [R06[3], R06[8]] // the two closing lines of 06 (each change_recorded repeats the id of the chat_message just before it)
const SID = R06[0].session_id, PRES = 'pres-e2e'
const CTX = (extra = {}) => ({ sessionId: SID, presentationId: PRES, isCurrent: true, ...extra })
// 07, by seq: 2..6 the live turn, 7..9 reconnect 1 (skip_history), 10..15 reconnect 2 (history replayed), 16..17 reconnect 3 (after a canvas edit)
const LIVE_DONE = outSeq('07-reconnect-replay', 5), LIVE_CHANGE = outSeq('07-reconnect-replay', 6), RESEND_SKIP = outSeq('07-reconnect-replay', 9), RESEND_HIST = outSeq('07-reconnect-replay', 15)
const L = LIVE_DONE.message_id, H = RESEND_HIST.payload.anchor_history_id, CHANGE_ID = LIVE_CHANGE.payload.change_id
const HIST_LINES = [12, 13].map(seq => outSeq('07-reconnect-replay', seq)) // the replayed Director lines (seq 11 is the user's own, role "user")
let TICK = 0
const chat = (id, text = 'A Director line.') => ({ type: 'chat_message', message_id: id, session_id: SID, timestamp: new Date(Date.parse('2026-10-24T15:00:00.000Z') + (++TICK) * 1000).toISOString(), role: 'assistant', payload: { text, sub_title: null, list_items: null, format: 'markdown', ephemeral: false } }) // DERIVED
const changeFrame = (id, extra = {}, label = 'Changed a slide') => ({ type: 'change_recorded', message_id: `c_${id}`, session_id: SID, role: 'assistant', payload: { change_id: id, label, kind: 'slide_replaced', presentation_id: PRES, undoable: true, ...extra } }) // DERIVED
const syncFrame = (presentation = PRES, session = SID) => ({ type: 'sync_response', message_id: 's_sync', session_id: session, role: 'assistant', payload: { action: 'skip_history', message_count: 3, presentation_id: presentation } }) // DERIVED

// ---------------------------------------------------------------- loading: the real TypeScript in a vm, one world per flag set and commit
const compileCache = new Map()
function compile(rel, text) {
  const cacheId = `${rel}\0${text}`
  if (!compileCache.has(cacheId)) compileCache.set(cacheId, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(cacheId)
}
function world({ env = {}, commit = null } = {}) { // commit: a git commit to read the sources from (#499's own code), else this tree (with the mutants)
  const registry = new Map()
  const textOf = rel => (commit ? show(commit, rel) : rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
  const exists = rel => { try { if (commit) { show(commit, rel); return true } if (rel in overrides) return true; return fs.statSync(path.join(root, rel)).isFile() } catch { return false } }
  function load(rel) {
    if (registry.has(rel)) return registry.get(rel).exports
    const module = { exports: {} }; registry.set(rel, module)
    const resolve = (spec, from) => {
      const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(from), spec)
      for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (/\.tsx?$/.test(base + ext) && exists(base + ext)) return base + ext
      throw Error(`unresolved ${spec} from ${rel}`)
    }
    const req = spec => spec.endsWith('.css') ? {} : spec.startsWith('@/') || spec.startsWith('.') ? load(resolve(spec, rel)) : nodeRequire(spec)
    const fetchStub = () => { throw new Error('no network from this feature') }
    vm.runInThisContext(`(function(exports, require, module, __filename, process, fetch){${compile(rel, textOf(rel))}\n})`, { filename: rel })(module.exports, req, module, rel, { env: { ...env } }, fetchStub)
    return module.exports
  }
  return { load }
}
const React = nodeRequire('react'), { renderToStaticMarkup } = nodeRequire('react-dom/server')
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/&quot;|&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

const fresh = (env = ON, commit = null) => { const wd = world({ env, commit }); const store = wd.load(STORE); return { wd, store, wire: wd.load(WIRE), instance: store.createBulkEditUndoStore() } }
const feed = (instance, frames, ctx = CTX()) => { for (const frame of frames) instance.route(clone(frame), ctx) }
const hostsOf = (instance, ids) => ids.filter(id => instance.changeFor(SID, id))

// ---------------------------------------------------------------- the suite
const results = { passed: 0, failed: [] }
let STOP = false
let LAST = ''
async function check(name, fn) {
  try { await fn(); results.passed++ } catch (error) {
    if (STOP) { LAST = `${name} :: ${String(error?.message ?? error).split('\n')[0].slice(0, 110)}`; throw error }
    results.failed.push(name); console.log(`FAIL ${name}\n     ${String(error?.stack ?? error).split('\n').slice(0, 7).join('\n     ')}`)
  }
}

async function suite() {
  // ---- 1. recorded
  await check('recorded: the seven transcripts are DIRECTOR-2\'s re-recording (18fa6604); 06 anchors each change to the chat line sent right before it; 07 re-sends with replayed, and the history id only when history was replayed', () => {
    for (const name of NAMES) {
      const rec = REC[name]
      assert.equal(rec.director_commit, '18fa6604434bd633f6970afcb4d3174a6df1e6bc', name); assert.deepEqual(rec.client_caps, ['mdc1', 'bulk_edit1', 'undo1'], name)
      assert.equal(rec.frames.filter(item => item.direction === 'out').length, rec.frame_counts.out, `${name}: frame_counts.out`); assert.equal(rec.frames.filter(item => item.direction === 'in').length, rec.frame_counts.in, `${name}: frame_counts.in`)
      assert.ok(Array.isArray(rec.events), `${name}: has an events list`)
    }
    for (const name of NAMES.slice(0, 6)) assert.deepEqual(REC[name].events, [], `${name}: no reconnect events`)
    const frames06 = R06.filter(frame => frame.type === 'chat_message' || frame.type === 'change_recorded')
    const changes06 = frames06.filter(frame => frame.type === 'change_recorded')
    assert.equal(changes06.length, 2)
    for (const frame of changes06) { const before = frames06[frames06.indexOf(frame) - 1]; assert.equal(before.type, 'chat_message'); assert.equal(frame.payload.anchor_message_id, before.message_id, 'live anchor = the chat line sent right before'); assert.ok(!('replayed' in frame.payload) && !('anchor_history_id' in frame.payload), 'a live frame has neither') }
    assert.deepEqual(R07.events.map(event => [event.after_seq, event.event, event.skip_history ?? null]), [[6, 'websocket_reconnect', true], [9, 'websocket_reconnect', false], [15, 'canvas_edit', null], [15, 'websocket_reconnect', true]])
    assert.equal(LIVE_CHANGE.payload.anchor_message_id, L); assert.ok(!('replayed' in LIVE_CHANGE.payload))
    assert.deepEqual([RESEND_SKIP.payload.replayed, RESEND_SKIP.payload.anchor_message_id, 'anchor_history_id' in RESEND_SKIP.payload], [true, L, false], 'reconnect 1 (skip_history): the live id only')
    assert.deepEqual([RESEND_HIST.payload.replayed, RESEND_HIST.payload.anchor_message_id, RESEND_HIST.payload.anchor_history_id], [true, L, HIST_LINES[1].message_id], 'reconnect 2 (history replayed): both ids; the history id is the replayed "Done" line')
    assert.match(H, /^msg_hist_/); assert.match(HIST_LINES[1].payload.text, /^Done\./); assert.notEqual(H, L)
    assert.deepEqual(R07.frames.filter(item => item.seq > 15 && item.direction === 'out').map(item => item.frame.type), ['sync_response', 'slide_update'], 'after the canvas edit nothing is re-sent')
    assert.equal(RESEND_SKIP.payload.change_id, CHANGE_ID); assert.equal(RESEND_HIST.payload.change_id, CHANGE_ID); assert.notEqual(RESEND_SKIP.message_id, LIVE_CHANGE.message_id, 'a re-sent frame has a fresh frame id')
  })

  // ---- 2. v1 compatibility: #499's own adapter and store, from git
  await check('v1 compatibility: #499\'s adapter and store take every frame of all seven recordings (extra keys ignored, nothing thrown), and read the same change from 06 and 07', () => {
    const v1 = fresh(ON, V1)
    for (const name of NAMES) {
      const frames = out(name)
      for (const frame of frames) {
        for (const fn of ['parseBulkEditConfirm', 'parseBulkEditProgress', 'parseBulkEditSummary', 'parseChangeRecorded', 'parseUndoResult', 'parseDirectorChatTurn']) assert.doesNotThrow(() => v1.wire[fn](clone(frame)), `${name}: ${fn}`)
      }
      const store = v1.store.createBulkEditUndoStore()
      assert.doesNotThrow(() => feed(store, frames), `${name}: the v1 store routes every frame`)
      for (const frame of frames.filter(f => f.type === 'change_recorded')) {
        const parsed = v1.wire.parseChangeRecorded(clone(frame))
        assert.deepEqual(plain(parsed), { changeId: frame.payload.change_id, label: frame.payload.label, kind: frame.payload.kind, presentationId: frame.payload.presentation_id }, `${name}: v1 reads ${frame.payload.change_id}, the anchors are ignored`)
      }
    }
    const s06 = v1.store.createBulkEditUndoStore(); feed(s06, R06)
    assert.equal(s06.changeFor(SID, CHANGES_06[0].payload.anchor_message_id)?.state.phase, 'superseded', 'v1 on 06: the older change is replaced by the newer, as ever'); assert.equal(s06.changeFor(SID, CHANGES_06[1].payload.anchor_message_id)?.state.phase, 'idle')
    const s07 = v1.store.createBulkEditUndoStore(); feed(s07, out('07-reconnect-replay'))
    assert.equal(s07.changeFor(SID, L)?.change.changeId, CHANGE_ID, 'v1 on 07: one chip under the closing line'); assert.equal(s07.changeFor(SID, L).seq, 1, 'and the re-sends are ignored')
  })

  // ---- 3. wire
  await check('wire: parseChangeAnchors reads the three optional keys and ignores the rest; absent or hostile values are null; parseSyncedPresentation reads the deck a sync_response names', () => {
    const { wire } = fresh(ON)
    assert.deepEqual(plain(wire.parseChangeAnchors(LIVE_CHANGE)), { liveAnchorId: L, historyAnchorId: null, replayed: false })
    assert.deepEqual(plain(wire.parseChangeAnchors(RESEND_SKIP)), { liveAnchorId: L, historyAnchorId: null, replayed: true })
    assert.deepEqual(plain(wire.parseChangeAnchors(RESEND_HIST)), { liveAnchorId: L, historyAnchorId: H, replayed: true })
    assert.deepEqual(plain(wire.parseChangeAnchors(changeFrame('c1'))), { liveAnchorId: null, historyAnchorId: null, replayed: false }, 'a v1 frame')
    const none = { liveAnchorId: null, historyAnchorId: null, replayed: false }
    for (const bad of [null, undefined, 'x', 7, [], {}, { type: 'change_recorded' }, { type: 'change_recorded', payload: null }, { type: 'change_recorded', payload: [] }, chat('m1'), { type: 'sync_response', payload: { anchor_message_id: 'x' } }]) assert.deepEqual(plain(wire.parseChangeAnchors(bad)), none, JSON.stringify(bad))
    for (const value of [7, true, {}, [], 'has space', 'tab\there', '', 'x'.repeat(500)]) assert.deepEqual(plain(wire.parseChangeAnchors(changeFrame('c1', { anchor_message_id: value, anchor_history_id: value, replayed: value === true ? 'true' : value }))), none, `hostile ${JSON.stringify(value)?.slice(0, 20)}`)
    const hostile = { type: 'change_recorded', get payload() { throw new Error('boom') } }; assert.deepEqual(plain(wire.parseChangeAnchors(hostile)), none)
    assert.equal(wire.parseSyncedPresentation(RESEND_SKIP), null, 'not a sync_response')
    assert.equal(wire.parseSyncedPresentation(outSeq('07-reconnect-replay', 7)), PRES); assert.equal(wire.parseSyncedPresentation(syncFrame('')), null); assert.equal(wire.parseSyncedPresentation(null), null); assert.equal(wire.parseSyncedPresentation({ type: 'sync_response' }), null)
  })

  // ---- 4. the host rule
  await check('host rule: the live anchor if that line is in the chat, else the history anchor if that is, else v1\'s line; with the chat\'s lines unknown the live anchor stands, then the history anchor, then v1\'s line', () => {
    const { store } = fresh(ON), host = store.undoHostOf
    const rec = (live, history, fallback) => ({ liveAnchorId: live, historyAnchorId: history, anchorMessageId: fallback })
    const set = (...ids) => new Set(ids)
    assert.equal(host(rec('L', 'H', 'F'), set('L', 'H', 'F')), 'L', 'all three there: the live anchor')
    assert.equal(host(rec('L', 'H', 'F'), set('H', 'F')), 'H', 'no live line: the history line')
    assert.equal(host(rec('L', 'H', 'F'), set('F')), 'F', 'neither: v1\'s line')
    assert.equal(host(rec('L', null, 'F'), set('F', 'X')), 'F', 'a live anchor that is not in the chat does not host')
    assert.equal(host(rec(null, null, 'F'), set('F')), 'F', 'a v1 frame')
    assert.equal(host(rec('L', 'H', 'F'), set('L')), 'L'); assert.equal(host(rec('L', 'H', 'F'), set()), 'F', 'an empty chat: v1\'s line (which is not there either, so nothing is drawn)')
    assert.equal(host(rec('L', 'H', 'F'), null), 'L', 'lines unknown: the live anchor'); assert.equal(host(rec(null, 'H', 'F'), null), 'H'); assert.equal(host(rec(null, null, 'F'), null), 'F'); assert.equal(host(rec(null, null, null), set('F')), null)
  })

  // ---- 5. store
  await check('store, live: the live anchor beats the heuristic (a Director line between the closing line and change_recorded does not take the chip)', () => {
    const { instance } = fresh(ON)
    feed(instance, [chat('m_done', 'Done.'), chat('m_extra', 'Anything else?'), changeFrame('c1', { anchor_message_id: 'm_done' })])
    assert.equal(instance.changeFor(SID, 'm_done')?.change.changeId, 'c1'); assert.equal(instance.changeFor(SID, 'm_extra'), null, 'v1\'s heuristic would have chosen this line')
    const v1 = fresh(ON, V1).store.createBulkEditUndoStore(); feed(v1, [chat('m_done', 'Done.'), chat('m_extra', 'Anything else?'), changeFrame('c1', { anchor_message_id: 'm_done' })])
    assert.equal(v1.changeFor(SID, 'm_extra')?.change.changeId, 'c1', 'the v1 store (the heuristic) puts it under the later line: the difference v2 makes')
    const noAnchor = fresh(ON).instance; feed(noAnchor, [chat('m_done', 'Done.'), chat('m_extra', 'Anything else?'), changeFrame('c2')]); assert.equal(noAnchor.changeFor(SID, 'm_extra')?.change.changeId, 'c2', 'no anchor: v1\'s rule, unchanged')
    const live06 = fresh(ON).instance; feed(live06, R06)
    CHANGES_06.forEach((frame, at) => { assert.equal(frame.payload.anchor_message_id, DONE_06[at].message_id); assert.equal(live06.changeFor(SID, DONE_06[at].message_id)?.change.changeId, frame.payload.change_id, `recorded 06: change ${at + 1} sits under its own closing line`) })
  })
  await check('store, reconnect with the chat kept (skip_history): the re-send REPLACES the chip in place - one chip, the same line, the same seq - and a changed label shows', () => {
    const { instance } = fresh(ON)
    feed(instance, [chat(L, 'Done.'), LIVE_CHANGE])
    assert.equal(instance.changeFor(SID, L).seq, 1)
    feed(instance, [outSeq('07-reconnect-replay', 7), outSeq('07-reconnect-replay', 8), RESEND_SKIP])
    assert.equal(hostsOf(instance, [L, H, 'msg_x']).length, 1); assert.equal(instance.changeFor(SID, L).seq, 1, 'the same record'); assert.equal(instance.changeFor(SID, L).replayed, true)
    assert.equal(instance.changeFor(SID, L).state.phase, 'idle')
    feed(instance, [{ ...clone(RESEND_SKIP), payload: { ...clone(RESEND_SKIP.payload), label: 'Refined slide three' } }]); assert.equal(instance.changeFor(SID, L).change.label, 'Refined slide three', 'the re-send replaces the chip\'s label')
    assert.equal(hostsOf(instance, [L]).length, 1)
  })
  await check('store, after a reload (nothing in this tab\'s memory) and a history replay: the chip is drawn again, under the replayed "Done" line (recorded 07, reconnect 2)', () => {
    const { instance } = fresh(ON)
    const replay = R07.frames.filter(item => item.direction === 'out' && item.seq >= 10 && item.seq <= 15).map(item => item.frame)
    feed(instance, replay) // sync_response, the history lines, slide_update, the re-sent change_recorded
    instance.setChatLines(SID, new Set([HIST_LINES[0].message_id, H])) // the chat after the reload shows the replayed lines
    assert.equal(instance.changeFor(SID, H)?.change.changeId, CHANGE_ID, 'under the replayed closing line'); assert.equal(instance.changeFor(SID, HIST_LINES[0].message_id), null); assert.equal(instance.changeFor(SID, L), null, 'the live id is not in this chat')
    assert.equal(instance.changeFor(SID, H).state.phase, 'idle'); assert.equal(instance.changeFor(SID, H).replayed, true)
    instance.setChatLines(SID, new Set([L, H])); assert.equal(hostsOf(instance, [L, H]).join(), L, 'both lines on screen: the live line, never two chips')
    const skipOnly = fresh(ON).instance; feed(skipOnly, [outSeq('07-reconnect-replay', 7), RESEND_SKIP]); skipOnly.setChatLines(SID, new Set([L])); assert.equal(skipOnly.changeFor(SID, L)?.change.changeId, CHANGE_ID, 'a reload that kept the chat (skip_history): under the live line')
    const lines = fresh(ON).instance; feed(lines, [chat(HIST_LINES[1].message_id, 'Done.'), RESEND_HIST]); assert.equal(lines.chatLines(SID), null, 'no chat reported yet'); assert.equal(lines.changeFor(SID, L)?.change.changeId, CHANGE_ID, 'lines unknown: the live anchor stands (MessageList reports the lines before any chip draws)'); assert.equal(lines.changeFor(SID, H), null)
    const keep = fresh(ON).instance; feed(keep, [chat(HIST_LINES[1].message_id, 'Done.'), chat('m_tail', 'A line after it.'), RESEND_HIST, RESEND_SKIP]); keep.setChatLines(SID, new Set([H, 'm_tail']))
    assert.equal(keep.changeFor(SID, H)?.change.changeId, CHANGE_ID, 'a re-send without the history id keeps the one the chip had'); assert.equal(keep.changeFor(SID, 'm_tail'), null, 'v1\'s line (the later one) does not take it')
  })
  await check('store, after a later edit nothing is re-sent: the third reconnect of 07 records nothing, and what the tab already has is not touched', () => {
    const third = R07.frames.filter(item => item.direction === 'out' && item.seq >= 16).map(item => item.frame)
    const empty = fresh(ON).instance; feed(empty, third); assert.equal(empty.changeFor(SID, L), null); assert.equal(empty.changeFor(SID, H), null)
    const had = fresh(ON).instance; feed(had, [chat(L, 'Done.'), LIVE_CHANGE]); const before = plain(had.changeFor(SID, L)); feed(had, third); assert.deepEqual(plain(had.changeFor(SID, L)), before, 'the chip stays as it was')
  })
  await check('store, never revived, never doubled: an Undone / Couldn\'t undo / pending / replaced chip keeps its state on a re-send; an idle one stays idle; older chips still go to "a later change replaced this"', () => {
    const states = { restored: s => { s.beginUndo(SID, CHANGE_ID); s.route({ type: 'undo_result', session_id: SID, payload: { change_id: CHANGE_ID, status: 'restored', reason: null } }, CTX()) },
      failed: s => { s.beginUndo(SID, CHANGE_ID); s.route({ type: 'undo_result', session_id: SID, payload: { change_id: CHANGE_ID, status: 'failed', reason: 'busy' } }, CTX()) },
      pending: s => { s.beginUndo(SID, CHANGE_ID) }, idle: () => {} }
    for (const [phase, drive] of Object.entries(states)) {
      const { instance } = fresh(ON); feed(instance, [chat(L, 'Done.'), LIVE_CHANGE]); drive(instance)
      assert.equal(instance.changeFor(SID, L).state.phase, phase, `${phase}: set up`)
      feed(instance, [RESEND_SKIP, RESEND_HIST]); assert.equal(instance.changeFor(SID, L).state.phase, phase, `${phase}: a re-send does not revive or reset it`); assert.equal(hostsOf(instance, [L, H]).length, 1, `${phase}: one chip`)
    }
    const old = fresh(ON).instance
    feed(old, R06); const first = R06.find(f => f.type === 'change_recorded'), second = R06.filter(f => f.type === 'change_recorded')[1]
    assert.equal(old.changeFor(SID, first.payload.anchor_message_id).state.phase, 'superseded', 'a newer change replaced the older chip at once'); assert.equal(old.changeFor(SID, second.payload.anchor_message_id).state.phase, 'idle')
    feed(old, [{ ...clone(first), payload: { ...clone(first.payload), replayed: true } }]); assert.equal(old.changeFor(SID, first.payload.anchor_message_id).state.phase, 'superseded', 'a stale re-send of the older change does not bring it back')
    assert.equal(old.changeFor(SID, second.payload.anchor_message_id).state.phase, 'idle', 'and does not touch the newer one')
    feed(old, [{ ...clone(second), payload: { ...clone(second.payload), replayed: true } }]); assert.equal(old.changeFor(SID, first.payload.anchor_message_id).state.phase, 'superseded'); assert.equal(old.changeFor(SID, second.payload.anchor_message_id).state.phase, 'idle')
    const reload = fresh(ON).instance; feed(reload, [chat('mA', 'Done A.'), changeFrame('cA', { anchor_message_id: 'mA' }), chat('mB', 'Done B.'), changeFrame('cB', { anchor_message_id: 'mB', replayed: true })])
    assert.equal(reload.changeFor(SID, 'mA').state.phase, 'superseded', 'a NEW change_id that arrives replayed still replaces the older chips'); assert.equal(reload.changeFor(SID, 'mB').state.phase, 'idle')
  })
  await check('store, the displayed deck: a re-send before the page has re-read its deck is taken when Director\'s sync_response named it; another deck, another session\'s canvas, or no sync is not', () => {
    const unknown = CTX({ presentationId: null })
    const a = fresh(ON).instance; feed(a, [syncFrame(PRES), chat(L, 'Done.'), RESEND_SKIP], unknown); assert.equal(a.changeFor(SID, L)?.change.changeId, CHANGE_ID, 'sync named this deck, the page has not caught up')
    const b = fresh(ON).instance; feed(b, [syncFrame('pres_other'), chat(L, 'Done.'), RESEND_SKIP], unknown); assert.equal(b.changeFor(SID, L), null, 'sync named another deck')
    const c = fresh(ON).instance; feed(c, [chat(L, 'Done.'), RESEND_SKIP], unknown); assert.equal(c.changeFor(SID, L), null, 'no sync_response: v1\'s rule, nothing recorded')
    const d = fresh(ON).instance; feed(d, [syncFrame(PRES), chat(L, 'Done.'), RESEND_SKIP], CTX({ presentationId: null, ownerSessionId: 'another_session' })); assert.equal(d.changeFor(SID, L), null, 'the canvas shows another session\'s deck')
    const e = fresh(ON).instance; feed(e, [{ ...syncFrame(PRES, 'someone_else') }, chat(L, 'Done.'), RESEND_SKIP], unknown); assert.equal(e.changeFor(SID, L), null, 'another session\'s sync_response is not this tab\'s')
    const f = fresh(ON).instance; feed(f, [syncFrame(PRES), chat(L, 'Done.'), RESEND_SKIP], CTX({ presentationId: 'pres_shown' })); assert.equal(f.changeFor(SID, L), null, 'a displayed deck that is known wins over the sync')
    const g = fresh(ON).instance; feed(g, [syncFrame(PRES), chat(L, 'Done.'), RESEND_SKIP], CTX({ presentationId: null, ownerSessionId: SID })); assert.equal(g.changeFor(SID, L)?.change.changeId, CHANGE_ID, 'this session\'s own canvas, not yet read')
  })
  await check('flag off: nothing is stored, no chat line is reported, every frame passes on as before; the v1 case (no anchors) behaves as #499 did', () => {
    for (const env of [OFF, { ...OFF, [BULK]: 'true' }]) {
      const { instance, store } = fresh(env)
      assert.equal(instance.route(syncFrame(PRES), CTX()), 'pass'); assert.equal(instance.route(clone(RESEND_HIST), CTX()), 'pass'); assert.equal(instance.route(chat(L), CTX()), 'pass')
      store.noteStudioChatLines(SID, [{ messageType: 'bot', type: 'chat_message', message_id: L }], new Set(), instance); assert.equal(instance.chatLines(SID), null, 'no chat line reported')
      assert.equal(instance.changeFor(SID, L), null)
    }
    const on = fresh(ON); on.store.noteStudioChatLines(SID, [{ messageType: 'bot', type: 'chat_message', message_id: L }], new Set(), on.instance); assert.deepEqual([...on.instance.chatLines(SID)], [L], 'with the flag on it is reported')
    const parity = (frames) => { const a = fresh(ON, V1).store.createBulkEditUndoStore(), b = fresh(ON).instance; feed(a, frames); feed(b, frames); return [a, b] }
    for (const name of ['04-undo-restored', '05-undo-superseded', '02-bulk-run-one-failure']) {
      const frames = out(name), [a, b] = parity(frames), ids = frames.filter(f => f.type === 'chat_message').map(f => f.message_id)
      const view = record => record && { change: record.change, state: record.state, seq: record.seq }
      for (const id of ids) assert.deepEqual(plain(view(a.changeFor(SID, id))), plain(view(b.changeFor(SID, id))), `${name}: the same chip as #499 under ${id}`)
    }
  })
  await check('chat lines: noteStudioChatLines reports the Director chat lines that can host a chip (assistant chat_message, not removed), never a user turn, an ask or a thinking row', () => {
    const { store, instance } = fresh(ON), note = (items, removed) => { store.noteStudioChatLines(SID, items, removed, instance); return [...(instance.chatLines(SID) ?? [])].sort() }
    const line = (id, extra = {}) => ({ messageType: 'bot', type: 'chat_message', message_id: id, ...extra })
    assert.deepEqual(note([line('a'), line('b'), { messageType: 'user', type: 'chat_message', message_id: 'u' }, { messageType: 'bot', type: 'action_request', message_id: 'q' }, { messageType: 'bot', type: 'thinking_stream', message_id: 't' }, null, 7, { messageType: 'bot', type: 'chat_message' }]), ['a', 'b'])
    assert.deepEqual(note([line('a'), line('b')], new Set(['b'])), ['a'], 'a removed line hosts nothing'); assert.deepEqual(note([]), [])
    store.noteStudioChatLines(null, [line('z')], undefined, instance); store.noteStudioChatLines(SID, null, undefined, instance); assert.doesNotThrow(() => store.noteStudioChatLines(SID, { length: 1 }, undefined, instance))
  })

  // ---- 6. hookup: the real MessageList
  const asMessage = frame => ({ ...clone(frame), clientTimestamp: Date.parse(frame.timestamp) })
  const listHtml = (lw, lines) => renderToStaticMarkup(React.createElement(lw.list.MessageList, {
    sessionId: SID, userMessages: [], messages: lines.map(asMessage), userMessageIdsRef: { current: new Set() }, userMessageContentMapRef: { current: new Map() },
    hasSeenWelcomeRef: { current: true }, answeredActionsRef: { current: new Set() }, messagesEndRef: { current: null }, onActionClick() {}, onSubmitAnswers() {} }))
  const listWorld = env => { const wd = world({ env }); const store = wd.load(STORE); const list = wd.load(LIST); return { wd, store, list, instance: store.studioBulkEditUndo } }
  const chipAfter = (html, lineText, nextText) => { const from = html.indexOf(lineText), to = nextText ? html.indexOf(nextText, from + 1) : html.length; assert.ok(from >= 0, `${lineText} is drawn`); return html.slice(from, to === -1 ? html.length : to).includes('data-studio-chat-undo=') }
  await check('hookup: the real MessageList draws the chip under the change\'s own anchor line - live, after a skip_history reconnect, after a history replay - and never under a line that is not there', () => {
    const lw = listWorld(ON), live = R06.filter(f => f.type === 'chat_message'), after = (f, h) => lw.instance.route(clone(f), CTX())
    // live (06, first change only): the Done line hosts it
    lw.instance.reset(); for (const frame of R06.slice(0, 5)) after(frame)
    let html = listHtml(lw, live.slice(0, 2)); assert.equal((html.match(/data-studio-chat-undo=/g) || []).length, 1); assert.ok(chipAfter(html, 'Done. Slide 3 is refined'), 'under the Done line'); assert.ok(!chipAfter(html, 'Refining slide 3', 'Done. Slide 3'), 'not under the first line')
    // a later Director line comes before the report is drawn: the live anchor still hosts it (DERIVED line)
    lw.instance.reset(); after(chat('m_done', 'Done. First.')); after(chat('m_more', 'Anything else you want?')); after(changeFrame('c1', { anchor_message_id: 'm_done' }))
    html = listHtml(lw, [chat('m_done', 'Done. First.'), chat('m_more', 'Anything else you want?')]); assert.ok(chipAfter(html, 'Done. First.', 'Anything else'), 'live anchor beats the heuristic'); assert.ok(!chipAfter(html, 'Anything else you want?'))
    // skip_history reconnect (07, reconnect 1): the chat kept its live lines
    lw.instance.reset(); for (const f of [LIVE_DONE, LIVE_CHANGE, outSeq('07-reconnect-replay', 7), RESEND_SKIP]) after(f)
    html = listHtml(lw, [outSeq('07-reconnect-replay', 2), LIVE_DONE]); assert.equal((html.match(/data-studio-chat-undo=/g) || []).length, 1, 'one chip'); assert.ok(chipAfter(html, 'Done. Slide 3 is refined'))
    // a reload, history replayed (07, reconnect 2): a new tab, only the replayed lines on screen
    lw.instance.reset(); for (const f of R07.frames.filter(item => item.direction === 'out' && item.seq >= 10 && item.seq <= 15).map(item => item.frame)) after(f)
    html = listHtml(lw, HIST_LINES); assert.equal((html.match(/data-studio-chat-undo=/g) || []).length, 1, 'drawn again after the reload'); assert.ok(chipAfter(html, 'Done. Slide 3 is refined'), 'under the replayed Done line'); assert.ok(!chipAfter(html, 'Refining slide 3', 'Done. Slide 3'))
    assert.match(html, /aria-label="Undo: Refined slide 3"/); assert.equal(lw.instance.chatLines(SID).has(H), true)
    // both the live line and the replayed line on screen: the live one, once
    { const liveDone = { ...clone(LIVE_DONE), payload: { ...clone(LIVE_DONE.payload), text: 'Done. The live copy of the closing line.' } }
      after(chat('x', 'x')); lw.instance.reset(); for (const f of [liveDone, LIVE_CHANGE]) after(f)   // DERIVED: the live line says its own words here, to tell the two lines apart
      html = listHtml(lw, [liveDone, ...HIST_LINES]); assert.equal((html.match(/data-studio-chat-undo=/g) || []).length, 1)
      const liveAt = html.indexOf('The live copy'), histAt = html.indexOf('Done. Slide 3 is refined'), chipAt = html.indexOf('data-studio-chat-undo=')
      assert.ok(liveAt >= 0 && histAt >= 0, 'both Done lines are drawn'); const end = histAt > liveAt ? histAt : html.length
      assert.ok(chipAt > liveAt && chipAt < end, 'the chip is under the LIVE line: the live anchor wins when both lines are on screen') }
    // neither anchor is on screen and the heuristic line is not either: no chip, no throw
    html = listHtml(lw, [chat('m_unrelated', 'Something else.')]); assert.doesNotMatch(html, /data-studio-chat-undo=/)
  })
  await check('hookup, flag off: the real MessageList is the base\'s markup, byte for byte, with the chat lines reported nowhere', () => {
    const off = listWorld(OFF), base = (() => { const wd = world({ env: OFF, commit: V1 }); return { list: wd.load(LIST), instance: wd.load(STORE).studioBulkEditUndo } })()
    const lines = [outSeq('07-reconnect-replay', 2), LIVE_DONE, chat('m_x', 'More.')]
    off.instance.reset(); base.instance.reset(); for (const f of [chat(L), LIVE_CHANGE]) { off.instance.route(clone(f), CTX()); base.instance.route(clone(f), CTX()) }
    const html = renderToStaticMarkup(React.createElement(off.list.MessageList, { sessionId: SID, userMessages: [], messages: lines.map(asMessage), userMessageIdsRef: { current: new Set() }, userMessageContentMapRef: { current: new Map() }, hasSeenWelcomeRef: { current: true }, answeredActionsRef: { current: new Set() }, messagesEndRef: { current: null }, onActionClick() {}, onSubmitAnswers() {} }))
    const baseHtml = renderToStaticMarkup(React.createElement(base.list.MessageList, { sessionId: SID, userMessages: [], messages: lines.map(asMessage), userMessageIdsRef: { current: new Set() }, userMessageContentMapRef: { current: new Map() }, hasSeenWelcomeRef: { current: true }, answeredActionsRef: { current: new Set() }, messagesEndRef: { current: null }, onActionClick() {}, onSubmitAnswers() {} }))
    assert.equal(sha(html), sha(baseHtml)); assert.doesNotMatch(html, /data-studio-chat-undo/); assert.equal(off.instance.chatLines(SID), null, 'nothing reported with the flag off')
  })

  // ---- 7. change
  const stripFile = async () => import(`data:text/javascript;base64,${Buffer.from(read(STRIP_MODULE)).toString('base64')}`)
  await check('strip: stripping this change gives back the base\'s message list byte for byte; every piece occurs once and every added line carries the marker; any other file is returned as it is', async () => {
    const mod = await stripFile()
    assert.deepEqual([...mod.CHAT_UNDO_V2_FILES], [LIST]); assert.equal(mod.BASE_COMMIT, REGISTRY_V2)
    const head = (await import('./studio-strawman-chat-strip.mjs')).stripStrawmanChat(LIST, read(LIST)) // LATER-CHANGES: registry read (STRAWMAN-CHAT): the strip of the change stacked after this one, so its marked lines in the message list come out first
    assert.equal(mod.stripChatUndoV2(LIST, chatClean.stripChatClean(LIST, order.stripChatCleanOrder(LIST, head) /* LATER-CHANGES: registry read (CHAT-CLEAN-ORDER) */)), baseOf(LIST), 'stripped is the base\'s file') // LATER-CHANGES: registry read (CHAT-CLEAN): chat clean's marked lines in the message list come out first
    for (const [added, original] of mod.CHAT_UNDO_V2_CHANGES[LIST]) {
      assert.equal(head.split(added).length - 1, 1, 'a piece occurs once'); assert.ok(!baseOf(LIST).includes(added), 'the base does not hold a piece'); assert.equal(original, '')
      for (const line of added.split('\n').filter(Boolean)) assert.ok(line.includes(CHAT_UNDO_V2_MARKER), `every added line carries ${CHAT_UNDO_V2_MARKER}: ${line.slice(0, 80)}`)
    }
    assert.equal(mod.stripChatUndoV2(LIST, mod.stripChatUndoV2(LIST, chatClean.stripChatClean(LIST, order.stripChatCleanOrder(LIST, head) /* LATER-CHANGES: registry read (CHAT-CLEAN-ORDER) */))), baseOf(LIST), 'stripping twice changes nothing more'); assert.equal(mod.stripChatUndoV2('lib/other.ts', 'abc'), 'abc'); assert.equal(mod.stripChatUndoV2(LIST, baseOf(LIST)), baseOf(LIST)) // LATER-CHANGES: registry read (CHAT-CLEAN)
    assert.ok(STACKED_PASS3_FILES.includes(LIST) && STACKED_PASS3_FILES.includes(WIRE) && STACKED_PASS3_FILES.includes(STORE), 'the files this change touches are in STACKED_PASS3_FILES already (bulk edit + chat undo lists them); it adds no app file')
  })
  await check('roots: this change REGISTERS its strip (LATER_STRIPS), stripBulkEditUndo calls the registry first, innermost, so the three shared roots and every older pin that strips it take these lines out; no .env.example block', () => {
    const registry = read(REGISTRY), stripLines = registry.split('\n').filter(line => line.includes('stripChatUndoV2'))
    assert.equal(stripLines.length, 1, 'one registration line in LATER_STRIPS'); assert.match(stripLines[0], /^  \(await import\('\.\/studio-chat-undo-v2-strip\.mjs'\)\)\.stripChatUndoV2, \/\/ LATER-CHANGE: /)
    const list = registry.match(/export const LATER_STRIPS = \[([\s\S]*?)\n\]/)[1]; assert.ok(list.includes('stripChatUndoV2'), 'the line is in LATER_STRIPS')
    const v1Strip = read(V1_STRIP)
    assert.match(v1Strip, /const inner = stripLaterChanges\(rel, text\)/, 'bulk edit + chat undo\'s strip calls the registry first'); assert.match(v1Strip, /table\.reduce\(\(out, \[added, original\]\) => out\.replace\(added, \(\) => original\), inner\)/)
    for (const rel of ROOTS) assert.match(read(rel), /stripBulkEditUndo\(rel, text\)/, `${rel}: still chains bulk edit + chat undo's strip innermost`)
    assert.equal(stripBulkEditUndo(LIST, read(LIST)), stripBulkEditUndo(LIST, baseOf(LIST)), 'bulk edit + chat undo\'s strip, with this change registered, takes these lines out')
    for (const root3 of [stripOpenReadOnly, stripDarkPersist, stripAddSlideStatus]) assert.equal(typeof root3(LIST, 'x'), 'string')
    assert.equal(stripAddSlideStatus(LIST, read(LIST)), stripAddSlideStatus(LIST, baseOf(LIST)), 'the add-slide root takes this change\'s lines out as well')
    const blocks = registry.match(/export const LATER_ENV_BLOCKS = \[([\s\S]*?)\n\]/)[1]; assert.ok(!/chat-undo-v2/.test(blocks), 'no env block')
    assert.ok(!CHAT_UNDO_V2_FILES.includes(ENV) && !CHAT_UNDO_V2_OWN_EDITS.includes(ENV), 'no .env.example change')
    if (!STOP) assert.ok(!ownCommitted(OWN_SCOPE).filter(rel => !LATER_CHANGE_FILES.has(rel)).includes(ENV), 'none of this change\'s own commits touches .env.example (a later change\'s registered .env.example edit is not this change\'s)')
  })
  await check('registry: one marked line in LATER_CHANGE_FILES names this change\'s files (none in LATER_ENV_BLOCKS: no env block); scope: the COMMITTED diff BASE..HEAD holds those files only', async () => {
    const mod = await stripFile(), registry = read(REGISTRY)
    const lines = registry.split('\n').filter(line => line.includes('studio-chat-undo-v2-strip.mjs'))
    assert.equal(lines.length, 2, 'two registration lines: its files and its strip (no env block)'); assert.equal(lines.filter(line => /^  \.\.\.\(await import\('\.\/studio-chat-undo-v2-strip\.mjs'\)\)\.CHAT_UNDO_V2_SCOPE_FILES, \/\/ LATER-CHANGE: /.test(line)).length, 1, 'the files line')
    const blocks = registry.match(/export const LATER_ENV_BLOCKS = \[([\s\S]*?)\n\]/)[1]; assert.ok(!/chat-undo-v2/.test(blocks), 'no env block')
    for (const rel of mod.CHAT_UNDO_V2_SCOPE_FILES) assert.ok(LATER_CHANGE_FILES.has(rel) || rel in overrides, `${rel} is registered`)
    const own = new Set(mod.CHAT_UNDO_V2_SCOPE_FILES), changed = ownCommitted(own)
    const stray = scopeStray(own, LATER_CHANGE_FILES); assert.deepEqual(stray, [], `files outside this change: ${stray.join(', ')}`)
    for (const rel of mod.CHAT_UNDO_V2_NEW_FILES) assert.ok(fs.existsSync(path.join(root, rel)) || rel in overrides, `${rel} exists`)
    assert.deepEqual(ownDeleted(own), [], 'nothing deleted')
    if (!STOP) process.stdout.write(`     (committed diff ${BASE.slice(0, 8)}..HEAD: ${changed.length} files)\n`)
  })
  await check('scope rule (in memory, made-up histories): a commit is this change\'s only if it touches one of its files; a registered later change\'s files are never strays; a stacked PR\'s direct commits are not this change\'s', () => {
    const own = OWN_SCOPE, later = LATER_CHANGE_FILES, aFile = [...own][0], laterFile = [...later].find(rel => !own.has(rel)), unregistered = 'lib/some-unregistered-file.ts'
    assert.ok(aFile && laterFile && !later.has(unregistered) && !own.has(unregistered), 'the fixtures: an own file, a registered later file, a file nobody registered')
    const stray = commits => scopeStray(own, later, commits)
    assert.deepEqual(stray([]), [], 'no commits, no strays')
    assert.deepEqual(stray([{ id: 'a', files: [aFile] }]), [], 'a commit of this change\'s files only')
    assert.deepEqual(stray([{ id: 'b', files: [unregistered, laterFile] }]), [], 'a stacked PR\'s direct commit (it touches none of this change\'s files) is not this change\'s, whatever it adds')
    assert.deepEqual(stray([{ id: 'c', files: [aFile, laterFile] }]), [], 'a commit of this change that also carries a REGISTERED later change\'s file: not a stray')
    assert.deepEqual(stray([{ id: 'd', files: [aFile, unregistered] }]), [unregistered], 'a commit that touches this change\'s file AND an unregistered file outside it: that file is a stray')
    assert.deepEqual(stray([{ id: 'e', files: [aFile] }, { id: 'f', files: [unregistered, laterFile] }]), [], 'this change\'s commit, then a stacked PR\'s commit on top: no strays')
    assert.deepEqual(ownCommitted(own, [{ id: 'g', files: [aFile, laterFile] }, { id: 'h', files: [unregistered] }]).sort(), [aFile, laterFile].sort(), 'only the commits that touch one of its files are its own')
    const before = history
    try { history = [{ id: 'i', files: [aFile], deleted: [] }, { id: 'j', files: [unregistered], deleted: [laterFile] }]; assert.deepEqual(ownDeleted(own), [], 'a deletion in a stacked PR\'s commit is not this change\'s'); history = [{ id: 'k', files: [aFile], deleted: [aFile] }]; assert.deepEqual(ownDeleted(own), [aFile], 'a deletion in this change\'s own commit is') } finally { history = before }
    try { history = [{ id: 'l', files: [aFile], deleted: [laterFile] }]; assert.deepEqual(ownDeleted(own), [], 'a REGISTERED later change\'s file retired in a commit that also touches this change\'s file is not this change\'s deletion'); history = [{ id: 'm', files: [aFile], deleted: [unregistered] }]; assert.deepEqual(ownDeleted(own), [unregistered], 'an unregistered file deleted in this change\'s commit is') } finally { history = before } // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT)
  })
  await check('secrets: no line this change adds carries a credential-shaped literal; no request, storage or viewer call in the new store code', () => {
    const added = git('diff', '-U0', BASE, 'HEAD', '--', ...CHAT_UNDO_V2_OWN_EDITS.filter(rel => rel.startsWith('lib/')), LIST, 'scripts/studio-chat-undo-v2-strip.mjs', 'scripts/test-studio-chat-undo-v2.mjs').split('\n').filter(line => /^\+(?!\+\+)/.test(line)).join('\n')
    for (const pattern of [/AKIA[0-9A-Z]{16}/, /sk-[A-Za-z0-9]{20,}/, /xox[bap]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, /(?<![A-Za-z_])(?:password|secret|token|api[_-]?key)\s*[:=]\s*['"][^'"\s]{12,}['"]/i]) assert.ok(!pattern.test(added), `credential-shaped text: ${pattern}`)
    const code = [STORE, WIRE].map(rel => read(rel)).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')
    assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|document\.|window\.|postMessage|sendElementCommand|layout-service|\/versions/i)
  })
}

// ---------------------------------------------------------------- the mutants
const MUTANTS = [
  { name: 'wrong anchor priority: the history anchor before the live one', edits: [[STORE, "  if (record.liveAnchorId && (!present || present.has(record.liveAnchorId))) return record.liveAnchorId\n  if (record.historyAnchorId && (!present || present.has(record.historyAnchorId))) return record.historyAnchorId\n",
    "  if (record.historyAnchorId && (!present || present.has(record.historyAnchorId))) return record.historyAnchorId\n  if (record.liveAnchorId && (!present || present.has(record.liveAnchorId))) return record.liveAnchorId\n"]] },
  { name: 'the live anchor is ignored (the heuristic wins)', edits: [[STORE, 'if (record.liveAnchorId && (!present || present.has(record.liveAnchorId))) return record.liveAnchorId', 'if (false) return record.liveAnchorId']] },
  { name: 'the history anchor is ignored', edits: [[STORE, 'if (record.historyAnchorId && (!present || present.has(record.historyAnchorId))) return record.historyAnchorId', 'if (false) return record.historyAnchorId']] },
  { name: 'the live anchor hosts even when its line is not in the chat', edits: [[STORE, 'if (record.liveAnchorId && (!present || present.has(record.liveAnchorId))) return record.liveAnchorId', 'if (record.liveAnchorId) return record.liveAnchorId']] },
  { name: 'unknown chat lines are read as an empty chat', edits: [[STORE, 'if (record.liveAnchorId && (!present || present.has(record.liveAnchorId)))', 'if (record.liveAnchorId && present && present.has(record.liveAnchorId))']] },
  { name: 'a double chip: a re-send of a known change is recorded again', edits: [[STORE, '        if (known) {\n', '        if (false) {\n']] },
  { name: 'revive after done: a re-send puts the chip back to idle', edits: [[STORE, '          if (moved) changed()\n          return', "          known.state = { phase: 'idle' }; changed()\n          return"]] },
  { name: 'a re-send does not replace the chip (anchors and label stay as first drawn)', edits: [[STORE, 'known.change = change; known.liveAnchorId = liveAnchorId; known.historyAnchorId = historyAnchorId; known.replayed = known.replayed || anchors.replayed', 'known.replayed = known.replayed || anchors.replayed']] },
  { name: 'a re-send drops the anchor it does not carry', edits: [[STORE, 'const liveAnchorId = anchors.liveAnchorId ?? known.liveAnchorId, historyAnchorId = anchors.historyAnchorId ?? known.historyAnchorId', 'const liveAnchorId = anchors.liveAnchorId, historyAnchorId = anchors.historyAnchorId']] },
  { name: 'a re-send of an older change supersedes the newer chip', edits: [[STORE, '          if (moved) changed()\n          return', "          for (const record of data.changes) if (record !== known && record.state.phase === 'idle') record.state = { phase: 'superseded' }\n          if (moved) changed()\n          return"]] },
  { name: 'flag off changed: the chat lines are reported without the flag (both gates removed)', edits: [[STORE, 'if (!STUDIO_CHAT_UNDO_ENABLED || !sessionId || !Array.isArray(items)) return', 'if (!sessionId || !Array.isArray(items)) return'], [LIST, 'if (STUDIO_CHAT_UNDO_ENABLED && studio) noteStudioChatLines(', 'if (studio) noteStudioChatLines(']] },
  { name: 'the sync fallback lends another session\'s canvas the deck', edits: [[STORE, "if (!context.presentationId && (context.ownerSessionId ?? sessionId) === sessionId)", 'if (!context.presentationId)']] },
  { name: 'another session\'s sync_response is remembered', edits: [[STORE, 'if (STUDIO_CHAT_UNDO_ENABLED && !foreign) dataFor(sessionId).synced = parseSyncedPresentation(frame)', 'if (STUDIO_CHAT_UNDO_ENABLED) dataFor(sessionId).synced = parseSyncedPresentation(frame)']] },
  { name: 'the sync overrides a displayed deck that is known', edits: [[STORE, 'context = { ...context, presentationId: sessions.get(sessionId)?.synced ?? null }', 'context = { ...context, presentationId: sessions.get(sessionId)?.synced ?? context.presentationId }'], [STORE, 'if (!context.presentationId && (context.ownerSessionId', 'if ((context.ownerSessionId']] },
  { name: 'a removed line is reported as in the chat', edits: [[STORE, '&& !removedIds?.has(line.message_id)) ids.add', ') ids.add']] },
  { name: 'a user turn is reported as a Director line', edits: [[STORE, "line.messageType === 'bot' && line.type === 'chat_message'", "line.type === 'chat_message'"]] },
  { name: 'the message list never reports its lines', edits: [[LIST, '  if (STUDIO_CHAT_UNDO_ENABLED && studio) noteStudioChatLines(sessionId, processedMessages, removedIds) // CHAT-UNDO-V2\n', '']] },
  { name: 'strip: a piece of the strip is wrong', edits: [[STRIP_MODULE, "export function stripChatUndoV2(rel, text) {\n  const table = CHANGES[rel]\n  if (!table) return text\n", "export function stripChatUndoV2(rel, text) {\n  const table = CHANGES[rel]\n  if (!table || rel === 'components/builder/message-list.tsx') return text\n"]] },
  { name: 'the strip is not registered (the registry never runs it)', edits: [[REGISTRY, "  (await import('./studio-chat-undo-v2-strip.mjs')).stripChatUndoV2, // LATER-CHANGE: FRONTEND-2, chat undo v2 (NEXT_PUBLIC_STUDIO_CHAT_UNDO; no .env.example block)\n", '']] },
  { name: 'bulk edit + chat undo\'s strip no longer calls the registry first', edits: [[V1_STRIP, 'const inner = stripLaterChanges(rel, text)', 'const inner = text']] },
  { name: 'scope rule: a commit that touches this change\'s file and also an unregistered file outside it (an in-memory history)', history: () => [{ id: 'm1', files: [...OWN_SCOPE].slice(0, 1).concat('lib/some-unregistered-file.ts') }] },
  { name: 'scope rule: every commit on the line is this change\'s (the touches-one-of-its-files test is gone)', rule: { touchesOwn: false } },
  { name: 'scope rule: a registered later change\'s file is a stray (the LATER_CHANGE_FILES skip is gone)', rule: { skipLater: false } },
  { name: 'the parser reads the history anchor from the live key', edits: [[WIRE, 'historyAnchorId: cleanId(body.anchor_history_id)', 'historyAnchorId: cleanId(body.anchor_message_id)']] },
  { name: 'replayed is read from any truthy value', edits: [[WIRE, 'replayed: body.replayed === true }', 'replayed: !!body.replayed }']] },
]

console.log(`Studio chat undo v2 (${BASE.slice(0, 8)} base)`)
await suite()
console.log(`${results.passed} checks passed, ${results.failed.length} failed`)
let escaped = 0
if (results.failed.length === 0 && !process.env.CHAT_UNDO_V2_NO_MUTANTS) {
  STOP = true
  const sourceOf = rel => fs.readFileSync(path.join(root, rel), 'utf8')
  let killed = 0
  for (const mutant of MUTANTS) {
    overrides = {}
    history = mutant.history ? mutant.history() : null; Object.assign(RULE, { touchesOwn: true, skipLater: true }, mutant.rule ?? {})
    for (const [rel, from, to] of mutant.edits ?? []) {
      const source = rel in overrides ? overrides[rel] : sourceOf(rel)
      assert.equal(source.split(from).length - 1, 1, `mutant "${mutant.name}" no longer applies to ${rel}: ${from.slice(0, 70)}`)
      overrides[rel] = source.replace(from, () => to)
    }
    let caught = false
    try { await suite() } catch { caught = true }
    overrides = {}; history = null; Object.assign(RULE, { touchesOwn: true, skipLater: true })
    if (process.env.CHAT_UNDO_V2_WHY) console.log(`  ${caught ? 'killed' : 'SURVIVED'} ${mutant.name}\n     by ${LAST}`)
    if (caught) killed++; else { escaped++; console.log(`SURVIVED mutant: ${mutant.name}`) }
  }
  console.log(`${killed}/${MUTANTS.length} mutants killed`)
}
const bad = results.failed.length + escaped
console.log(bad === 0 ? 'PASS test-studio-chat-undo-v2' : `FAIL test-studio-chat-undo-v2 (${results.failed.length} checks, ${escaped} surviving mutants)`)
process.exit(bad === 0 ? 0 : 1)
