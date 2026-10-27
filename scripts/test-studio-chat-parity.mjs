// FRONTEND-1 (P3-1 A chat parity, Studio half): proof of NEXT_PUBLIC_STUDIO_CHAT_PARITY_NOTES / _THEMES / _IDENTITY / _TEMPLATES (the string "true", each default off, build-time).
//   lib/studio-chat-parity.ts (pure decisions: frames, caps, the request, the refusal, the result, notes_updated), lib/studio-chat-parity-runners.ts (owner check, executor, timeout),
//   marked lines in hooks/use-deckster-websocket-v2.ts, app/builder/page.tsx, components/slide-notes-panel.tsx and types/mdc.ts, the taught font-selection proof, and the .env.example block.
//
//   A. The lib, function by function, in THIS realm with a fake process (flag on / off / other strings).
//   B. The runners with a fake clock: unsupported, not the owner, the executor's own answer, a throw, a timeout.
//   C. The sources: every marked line is an insertion that carries the marker, stripping them gives the base's files byte for byte (and through the registry), the taught proof put back,
//      the gates, .env.example is the base plus the block, the registry gained its three lines, the committed diff is this change's files, no secrets.
//   D. MUTANTS: every one of them must be caught by A-C.
//
//   node scripts/test-studio-chat-parity.mjs
//
// Offline: no socket, fetch or timer of its own beyond fake timers in B; git is read only for C. Later changes stack on top of this one, so every source, diff and scope check reads THIS
// change's own newest commit (subject "Chat parity: ..."), not HEAD or the working tree.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let checks = 0
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const eq = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message) }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const strip = await import('./studio-chat-parity-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const plain = value => JSON.parse(JSON.stringify(value))

const LIB = 'lib/studio-chat-parity.ts'
const RUNNERS = 'lib/studio-chat-parity-runners.ts'
const HOOK = 'hooks/use-deckster-websocket-v2.ts'
const PAGE = 'app/builder/page.tsx'
const PANEL = 'components/slide-notes-panel.tsx'
const TYPES = 'types/mdc.ts'
const ENV = '.env.example'
const REGISTRY = 'scripts/studio-later-changes.mjs'
const FONT_PROOF = 'scripts/test-theme-font-selection.mjs'
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const OWN = (() => { try { return git('log', '-1', '--format=%H', '--no-merges', '-E', '--grep=^Chat parity', 'HEAD').trim() || null } catch { return null } })()
const readOwn = rel => { if (!OWN) return read(rel); try { return git('show', `${OWN}:${rel}`) } catch { return read(rel) } }
const hasBase = (() => { try { git('cat-file', '-e', `${strip.BASE_COMMIT}^{commit}`); return true } catch { return false } })()
const baseOf = rel => git('show', `${strip.BASE_COMMIT}:${rel}`)

// ---- transpile a TS file into a bare function scope ---------------------------------------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
const ALL_ON = { NEXT_PUBLIC_STUDIO_CHAT_PARITY_NOTES: 'true', NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES: 'true', NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY: 'true', NEXT_PUBLIC_STUDIO_CHAT_PARITY_TEMPLATES: 'true' }
function loadLib(text = read(LIB), env = ALL_ON) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'process', compile(text, LIB))(module, module.exports, () => { throw new Error('the lib must stay import-free') }, { env })
  return module.exports
}
function loadRunners(text = read(RUNNERS), lib = loadLib(), timers = null) {
  const module = { exports: {} }
  const require = name => { if (name === '@/lib/studio-chat-parity') return lib; throw new Error(`unexpected import ${name}`) }
  const scope = timers ? { setTimeout: timers.set, clearTimeout: timers.clear } : { setTimeout, clearTimeout }
  new Function('module', 'exports', 'require', 'process', 'setTimeout', 'clearTimeout', compile(text, RUNNERS))(module, module.exports, require, { env: {} }, scope.setTimeout, scope.clearTimeout)
  return module.exports
}
/** A fake clock for B: timers fire only when advanced. */
function fakeTimers() {
  const pending = new Map(); let id = 0
  return {
    set: (fn, ms) => { const key = ++id; pending.set(key, { fn, at: ms }); return key },
    clear: key => { pending.delete(key) },
    fire: () => { for (const [key, timer] of [...pending]) { pending.delete(key); timer.fn() } },
    get count() { return pending.size },
  }
}

// ============================================================================================================================================
// A. The lib
// ============================================================================================================================================
function libSuite(libText = read(LIB)) {
  const lib = loadLib(libText)
  // -- frames: one place -----------------------------------------------------------------------------------------------------------------
  eq({ ...lib.CHAT_PARITY_FRAMES }, { request: 'studio_action', result: 'studio_action_result' }, 'the frame names')
  ok(Object.isFrozen(lib.CHAT_PARITY_FRAMES), 'frozen')
  eq(lib.CHAT_PARITY_RESULT_ID_KEY, 'request_id', 'the result carries request_id')
  // -- flags -------------------------------------------------------------------------------------------------------------------------------
  for (const [value, want] of [[undefined, false], ['false', false], ['TRUE', false], ['1', false], [' true', false], ['true', true]]) eq(lib.chatParityFlagOn(value), want, `flag ${JSON.stringify(value)}`)
  const off = loadLib(libText, {})
  eq(off.STUDIO_CHAT_PARITY_NOTES_ENABLED, false, 'unset: notes off'); eq(off.STUDIO_CHAT_PARITY_ANY_ENABLED, false, 'unset: nothing on'); eq(off.CHAT_PARITY_CAPS, [], 'unset: no cap')
  const notes = loadLib(libText, { NEXT_PUBLIC_STUDIO_CHAT_PARITY_NOTES: 'true' })
  eq(notes.STUDIO_CHAT_PARITY_NOTES_ENABLED, true, '"true": notes on'); eq(notes.STUDIO_CHAT_PARITY_ANY_ENABLED, true, 'one on: any on'); eq(notes.CHAT_PARITY_CAPS, ['notes1'], 'notes: notes1')
  eq(loadLib(libText, { NEXT_PUBLIC_STUDIO_CHAT_PARITY_NOTES: 'yes' }).CHAT_PARITY_CAPS, [], '"yes": off')
  ok(Object.isFrozen(lib.CHAT_PARITY_FLAGS), 'the flags are frozen')
  // -- caps --------------------------------------------------------------------------------------------------------------------------------
  eq({ ...lib.CHAT_PARITY_GROUP_CAPS }, { notes: 'notes1', themes: 'themes1', identity: 'identity1', templates: 'templates1' }, 'the group caps (notes1 is Director\'s own name)')
  eq(lib.chatParityCaps({ notes: true, themes: true, identity: true, templates: true }), ['notes1', 'themes1', 'identity1', 'templates1'], 'all on: group order')
  eq(lib.chatParityCaps({ notes: false, themes: true, identity: false, templates: true }), ['themes1', 'templates1'], 'two on')
  eq(lib.chatParityCaps({ notes: 'true', themes: 1, identity: false, templates: false }), [], 'only boolean true counts')
  eq(lib.addChatParityCaps({ client_caps: ['mdc1', 'theme1'] }, ['notes1']), { client_caps: ['mdc1', 'theme1', 'notes1'] }, 'after the existing caps')
  eq(lib.addChatParityCaps({}, ['notes1', 'themes1']), { client_caps: ['notes1', 'themes1'] }, 'no caps yet')
  eq(lib.addChatParityCaps({ client_caps: ['notes1'] }, ['notes1']), { client_caps: ['notes1'] }, 'each once')
  eq(lib.addChatParityCaps({ client_caps: 'mdc1' }, ['notes1']), { client_caps: ['notes1'] }, 'a non-array is replaced')
  eq(lib.addChatParityCaps({ client_caps: ['mdc1', 7, null] }, ['notes1']), { client_caps: ['mdc1', 'notes1'] }, 'non-strings dropped')
  const data = { text: 'hi', client_caps: ['mdc1'] }; ok(lib.addChatParityCaps(data, ['notes1']) === data, 'in place'); eq(data.text, 'hi', 'other keys kept')
  // -- the request frame ------------------------------------------------------------------------------------------------------------------
  const frame = (payload, type = 'studio_action') => ({ type, message_id: 'm1', session_id: 's1', timestamp: 't', role: 'assistant', payload })
  ok(lib.isChatParityRequestFrame(frame({})), 'the type'); ok(!lib.isChatParityRequestFrame(frame({}, 'element_directive')), 'another type'); ok(!lib.isChatParityRequestFrame(null) && !lib.isChatParityRequestFrame('studio_action'), 'not an object')
  eq(lib.chatParityRequestId(frame({ request_id: 'sa_1' })), 'sa_1', 'the id'); eq(lib.chatParityRequestId(frame({ request_id: ' ' })), null, 'blank id'); eq(lib.chatParityRequestId(frame({})), null, 'no id'); eq(lib.chatParityRequestId({ type: 'studio_action' }), null, 'no payload')
  eq(lib.chatParityRequest(frame({ request_id: 'sa_1', group: 'notes', action: 'x', presentation_id: 'p1', args: { a: 1 }, label: 'L' })), { requestId: 'sa_1', group: 'notes', action: 'x', presentationId: 'p1', args: { a: 1 }, label: 'L' }, 'a full request')
  eq(lib.chatParityRequest(frame({ request_id: 'sa_2' })), { requestId: 'sa_2', group: '', action: '', presentationId: null, args: {}, label: '' }, 'a bare request still reads (answered honestly)')
  eq(lib.chatParityRequest(frame({ request_id: 'sa_3', args: [1], presentation_id: '', label: 4 })).args, {}, 'args must be an object'); eq(lib.chatParityRequest(frame({ request_id: 'sa_3', args: [1], presentation_id: '' })).presentationId, null, 'empty presentation = none')
  eq(lib.chatParityRequest(frame({})), null, 'no id: dropped'); eq(lib.chatParityRequest(frame({ request_id: 'x' }, 'deck_mutation')), null, 'another type: not ours')
  const args = { a: 1 }; ok(lib.chatParityRequest(frame({ request_id: 'sa', args })).args !== args, 'args are copied')
  // -- the refusal ------------------------------------------------------------------------------------------------------------------------
  const req = (group, action) => ({ requestId: 'r', group, action, presentationId: null, args: {}, label: '' })
  const flags = { notes: true, themes: false, identity: false, templates: false }
  eq(lib.chatParityRefusal(req('themes', 'save_theme'), flags), 'flag_off', 'group off'); eq(lib.chatParityRefusal(req('nope', 'x'), flags), 'flag_off', 'unknown group'); eq(lib.chatParityRefusal(req('', ''), flags), 'flag_off', 'no group')
  eq(lib.chatParityRefusal(req('notes', 'set_notes'), flags), 'unsupported', 'notes has no action (Director writes notes itself)')
  eq(lib.chatParityRefusal(req('notes', 'x'), { ...flags, notes: 'true' }), 'flag_off', 'only boolean true is on')
  eq(lib.chatParityRefusal(req('themes', 'nope'), { ...flags, themes: true }), 'unsupported', 'an action outside the group list')
  eq(Object.keys(lib.CHAT_PARITY_ACTIONS).sort(), ['identity', 'notes', 'templates', 'themes'], 'every group has a list'); eq(lib.CHAT_PARITY_ACTIONS.notes, [], 'notes: none')
  // -- the result -------------------------------------------------------------------------------------------------------------------------
  eq(lib.chatParityResult('sa_1', 'done'), { request_id: 'sa_1', status: 'done', error_code: null }, 'done')
  eq(lib.chatParityResult('sa_1', 'failed', 'not_owner'), { request_id: 'sa_1', status: 'failed', error_code: 'not_owner' }, 'failed + code')
  eq(lib.chatParityResult('sa_1', 'dismissed', 'not_owner'), { request_id: 'sa_1', status: 'dismissed', error_code: null }, 'a code only on failed')
  eq(lib.chatParityResult('sa_1', 'done', null, { theme_id: 't' }), { request_id: 'sa_1', status: 'done', error_code: null, detail: { theme_id: 't' } }, 'detail when given')
  eq(lib.chatParityResult('sa_1', 'done', null, {}), { request_id: 'sa_1', status: 'done', error_code: null }, 'an empty detail is left off')
  eq(lib.chatParityResultFrame(lib.chatParityResult('sa_1', 'done')), { type: 'studio_action_result', payload: { request_id: 'sa_1', status: 'done', error_code: null } }, 'the frame: data under payload')
  // -- notes_updated -----------------------------------------------------------------------------------------------------------------------
  eq(lib.CHAT_PARITY_NOTES_MUTATION, 'notes_updated'); eq(lib.CHAT_PARITY_NOTES_EVENT, 'deckster:slide-notes-updated'); eq(lib.CHAT_PARITY_NOTES_FIELDS, ['speaker_notes', 'script', 'references'])
  eq(lib.chatParityNotesUpdate({ mutation: 'notes_updated', slide_index: 2, presentation_id: 'p', refresh_token: 'r' }), { presentationId: 'p', slideIndex: 2, fields: [] }, 'without fields (today\'s Director)')
  eq(lib.chatParityNotesUpdate({ mutation: 'notes_updated', slide_index: 0, presentation_id: 'p', fields: ['script', 'bogus', 3, 'references'] }), { presentationId: 'p', slideIndex: 0, fields: ['script', 'references'] }, 'known fields kept, the rest dropped')
  for (const [bad, why] of [[{ mutation: 'slide_added', slide_index: 0, presentation_id: 'p' }, 'another mutation'], [{ mutation: 'notes_updated', slide_index: -1, presentation_id: 'p' }, 'bad index'], [{ mutation: 'notes_updated', slide_index: 1.5, presentation_id: 'p' }, 'fraction'], [{ mutation: 'notes_updated', slide_index: 1 }, 'no deck'], [{ mutation: 'notes_updated', slide_index: 1, presentation_id: '' }, 'empty deck'], [null, 'null'], ['notes_updated', 'string']]) eq(lib.chatParityNotesUpdate(bad), null, why)
  return lib
}

// ============================================================================================================================================
// B. The runners
// ============================================================================================================================================
async function runnersSuite(runnersText = read(RUNNERS), libText = read(LIB)) {
  const lib = loadLib(libText)
  const timers = fakeTimers()
  const runners = loadRunners(runnersText, lib, timers)
  eq(runners.CHAT_PARITY_DEFAULT_TIMEOUT_MS, 25_000, 'DIRECTOR-2: 25 s default')
  eq(plain(runners.CHAT_PARITY_EXECUTORS), {}, 'no executor until a group ships')
  const displayed = { sessionId: 's1', deckOwnerSessionId: 's1', presentationId: 'p1', epoch: 1 }
  const owner = { sessionId: 's1', isCurrent: () => true }
  const deps = { displayed: () => displayed }
  const req = over => ({ requestId: 'r1', group: 'themes', action: 'act', presentationId: 'p1', args: {}, label: '', ...over })
  // the owner check
  const check = runners.chatParityOwnerCheck(req({}), { session_id: 's1' }, owner, deps.displayed)
  ok(check.ok && check.owns() && check.presentationId === 'p1', 'the owner: session, deck, epoch')
  ok(!runners.chatParityOwnerCheck(req({}), { session_id: 's2' }, owner, deps.displayed).ok, 'another session on the frame')
  ok(!runners.chatParityOwnerCheck(req({}), null, { sessionId: 's2', isCurrent: () => true }, deps.displayed).ok, 'another socket session')
  ok(!runners.chatParityOwnerCheck(req({ presentationId: 'p2' }), null, owner, deps.displayed).ok, 'another deck named')
  ok(runners.chatParityOwnerCheck(req({ presentationId: null }), null, owner, deps.displayed).ok, 'no deck named: a library action')
  ok(!runners.chatParityOwnerCheck(req({}), null, owner, () => ({ ...displayed, deckOwnerSessionId: 's0' })).ok, 'a deck another session owns')
  { let now = displayed; const c = runners.chatParityOwnerCheck(req({}), null, owner, () => now); now = { ...displayed, epoch: 2 }; ok(!c.owns(), 'owns() follows the screen') }
  // run: unsupported, not the owner, pass-through, throw, timeout
  eq(await runners.runChatParityAction(req({}), owner, deps), { request_id: 'r1', status: 'failed', error_code: 'unsupported' }, 'no executor: unsupported')
  lib.CHAT_PARITY_ACTIONS.themes.push('act')
  eq(await runners.runChatParityAction(req({}), owner, deps), { request_id: 'r1', status: 'failed', error_code: 'unsupported' }, 'listed but no executor: unsupported')
  runners.CHAT_PARITY_EXECUTORS.act = async (request, _owner, _deps, c) => lib.chatParityResult(request.requestId, c.owns() ? 'done' : 'failed', null, { seen: request.args.x })
  eq(await runners.runChatParityAction(req({ args: { x: 1 } }), owner, deps), { request_id: 'r1', status: 'done', error_code: null, detail: { seen: 1 } }, 'the executor\'s own answer')
  eq(await runners.runChatParityAction(req({ presentationId: 'p9' }), owner, deps), { request_id: 'r1', status: 'failed', error_code: 'not_owner' }, 'not the owner: never run')
  eq(await runners.runChatParityAction(req({ group: 'identity' }), owner, deps), { request_id: 'r1', status: 'failed', error_code: 'unsupported' }, 'an action under the wrong group')
  runners.CHAT_PARITY_EXECUTORS.act = async () => { throw new Error('boom') }
  eq(await runners.runChatParityAction(req({}), owner, deps), { request_id: 'r1', status: 'failed', error_code: 'write_failed' }, 'a throw: write_failed')
  eq(timers.count, 0, 'every timer cleared')
  runners.CHAT_PARITY_EXECUTORS.act = () => new Promise(() => {})
  const hung = runners.runChatParityAction(req({}), owner, deps)
  eq(timers.count, 1, 'one timer armed'); timers.fire()
  eq(await hung, { request_id: 'r1', status: 'failed', error_code: 'timeout' }, 'outlived its wait: timeout')
  runners.CHAT_PARITY_TIMEOUTS_MS.act = 60_000
  let armedMs = null; const t2 = fakeTimers(); const set = t2.set; t2.set = (fn, ms) => { armedMs = ms; return set(fn, ms) }
  const runners2 = loadRunners(runnersText, lib, t2); runners2.CHAT_PARITY_EXECUTORS.act = () => new Promise(() => {}); runners2.CHAT_PARITY_TIMEOUTS_MS.act = 60_000
  const hung2 = runners2.runChatParityAction(req({}), owner, deps); eq(armedMs, 60_000, 'a per-action wait'); t2.fire(); eq((await hung2).error_code, 'timeout')
  lib.CHAT_PARITY_ACTIONS.themes.pop()
}

// ============================================================================================================================================
// C. The sources
// ============================================================================================================================================
function sourcesSuite() {
  const marker = strip.CHAT_PARITY_MARKER_RE
  // every marked line is an insertion; stripping gives the base, byte for byte, in THIS change's newest commit
  for (const rel of strip.CHAT_PARITY_FILES) {
    const now = readOwn(rel)
    const marked = now.split('\n').filter(line => marker.test(line))
    ok(marked.length > 0, `${rel}: has marked lines`)
    if (hasBase) {
      eq(strip.stripChatParity(rel, now), baseOf(rel), `${rel}: stripped is the base's file`)
      eq(registry.stripLaterChanges(rel, now), registry.stripLaterChanges(rel, baseOf(rel)), `${rel}: through the registry too`)
    }
    eq(strip.stripChatParity(rel, strip.stripChatParity(rel, now)), strip.stripChatParity(rel, now), `${rel}: stripping twice changes nothing more`)
  }
  eq(strip.stripChatParity('lib/other.ts', 'abc'), 'abc', 'another file is untouched'); eq(strip.stripChatParity(HOOK, null), null, 'a non-string is returned as it is')
  // the taught proof
  if (hasBase) eq(strip.putBackChatParityEdits(FONT_PROOF, readOwn(FONT_PROOF)), baseOf(FONT_PROOF), 'the font-selection proof put back is the base')
  for (const [rel, edits] of Object.entries(strip.CHAT_PARITY_PIN_EDITS)) for (const [has] of edits) eq(readOwn(rel).split(has).length, 2, `${rel}: the taught line occurs once`)
  // the gates: the hook
  const hook = readOwn(HOOK)
  ok(hook.includes("if (CHAT_PARITY_CAPS.length > 0) addChatParityCaps(message.data as unknown as Record<string, unknown>); // CHAT-PARITY"), 'the caps line in buildUserMessage, after the bulk-edit caps')
  ok(hook.indexOf('addBulkEditUndoCaps(message.data') < hook.indexOf('addChatParityCaps(message.data'), 'after the bulk-edit caps line')
  ok(hook.includes('if (STUDIO_CHAT_PARITY_ANY_ENABLED && isChatParityRequestFrame(parsedMessage)) { // CHAT-PARITY'), 'the request branch is gated on any flag')
  ok(hook.indexOf('isChatParityRequestFrame(parsedMessage)') < hook.indexOf('if (!isKnownDirectorMessageType(parsedMessage.type))'), 'ahead of the allowlist')
  ok(hook.includes('if (STUDIO_CHAT_PARITY_NOTES_ENABLED && chatParityNotesUpdate(payload)) { // CHAT-PARITY'), 'notes_updated is gated on the notes flag')
  ok(hook.indexOf('chatParityNotesUpdate(payload)) { // CHAT-PARITY') < hook.indexOf("|| !['slide_added', 'slide_deleted', 'slide_replaced', 'slide_reordered'].includes(payload.mutation)"), 'ahead of the mutation allowlist')
  ok(hook.includes("chatParityBus.send = sendChatParityResult // CHAT-PARITY"), 'the sender is registered on the bus')
  ok(hook.includes('chatParityBus.request?.(parsedMessage') && hook.includes('chatParityBus.notes?.(update,'), 'frames go to the bus, never to a page callback (no page line before the older proofs\' regions)')
  ok(hook.includes("JSON.stringify(chatParityResultFrame(data))"), 'the result frame is the lib\'s')
  for (const line of hook.split('\n').filter(l => marker.test(l))) ok(!/KNOWN_DIRECTOR_MESSAGE_TYPES|REPLY_FRAME_TYPES/.test(line), 'no allowlist edit: the frames stay unknown with the flags off')
  // the gates: the page
  const page = readOwn(PAGE)
  ok(page.includes('chatParityBus.request = !STUDIO_CHAT_PARITY_ANY_ENABLED ? null : (message, owner) => { // CHAT-PARITY'), 'the runner is set only with a flag on')
  ok(page.includes('chatParityBus.notes = !STUDIO_CHAT_PARITY_NOTES_ENABLED ? null : (update, owner) =>'), 'the notes handler is set only with the notes flag on')
  { const first = page.split('\n').findIndex(l => marker.test(l)); ok(first > page.slice(0, page.indexOf('void run.then(send).finally(() => { chatThemeExportInFlightRef.current[kind] = false })')).split('\n').length, 'every page line sits after the theme / export runner (the older proofs\' regions)') }
  ok(page.includes('window.dispatchEvent(new CustomEvent(CHAT_PARITY_NOTES_EVENT, { detail: update }))'), 'notes: the panel\'s event')
  ok(page.includes('update.presentationId === slideComposerPresentationRef.current.presentationId'), 'notes: the deck on screen only')
  ok(page.includes("chatParityBus.send?.(chatParityResult(request.requestId, 'failed', refusal))"), 'a refusal is answered at once')
  ok(page.includes('{ displayed: () => elementDirectiveGenerationOwnerRef.current }, message)'), 'the K5 owner record and the frame reach the runner')
  const pageImports = page.split('\n').filter(l => l.startsWith('import ') && marker.test(l))
  eq(pageImports.length, 2, 'two import lines'); ok(pageImports.every(l => page.indexOf(l) > page.indexOf("from '@/lib/studio-chat-clean' // CHAT-CLEAN")), 'placed at the end with the chat-clean import')
  // the gates: the panel and the types
  const panel = readOwn(PANEL)
  ok(panel.includes('if (!STUDIO_CHAT_PARITY_NOTES_ENABLED) return // CHAT-PARITY'), 'the panel listens only with the flag on')
  ok(panel.includes('window.addEventListener(CHAT_PARITY_NOTES_EVENT, onChatWrite) // CHAT-PARITY') && panel.includes('window.removeEventListener(CHAT_PARITY_NOTES_EVENT, onChatWrite) // CHAT-PARITY'), 'added and removed')
  ok(panel.includes('const onChatWrite = () => setReloadToken((token) => token + 1) // CHAT-PARITY'), 'the same re-read the publish dialog uses')
  ok(readOwn(TYPES).includes("| 'notes_updated' // CHAT-PARITY"), 'the mutation kind is declared')
  // the new files: the lib is import-free, the runners import the lib only
  ok(!/^import /m.test(readOwn(LIB)) && !/require\(/.test(readOwn(LIB)), 'the lib is import-free')
  eq([...readOwn(RUNNERS).matchAll(/from '([^']+)'/g)].map(m => m[1]), ['@/lib/studio-chat-parity'], 'the runners import the lib only')
  // .env.example: the base plus the block, at the end
  const env = readOwn(ENV)
  ok(env.endsWith(`\n${strip.CHAT_PARITY_ENV_BLOCK}`), 'the block ends .env.example')
  if (hasBase) eq(env.slice(0, env.length - strip.CHAT_PARITY_ENV_BLOCK.length - 1), baseOf(ENV), 'append-only')
  ok(strip.CHAT_PARITY_ENV_BLOCK.includes('NEXT_PUBLIC_STUDIO_CHAT_PARITY_NOTES="false"'), 'the notes flag, off')
  eq(registry.stripLaterEnvBlocks(ENV, env).includes('CHAT_PARITY'), false, 'the registry takes the block out')
  // the registry gained its three lines
  const reg = readOwn(REGISTRY)
  for (const name of ['CHAT_PARITY_SCOPE_FILES', 'CHAT_PARITY_ENV_BLOCK', 'stripChatParity']) eq(reg.split(`(await import('./studio-chat-parity-strip.mjs')).${name}`).length, 2, `${name}: registered once`)
  ok(registry.LATER_CHANGE_FILES.has(HOOK) && registry.LATER_CHANGE_FILES.has(LIB), 'the files are in the registry')
  ok(registry.LATER_STRIPS.includes(strip.stripChatParity), 'the strip is in the registry')
  // the committed diff is this change's files
  if (hasBase && OWN) {
    const changed = git('diff', '--name-only', strip.BASE_COMMIT, OWN).split('\n').filter(Boolean)
    ok(changed.length > 0, 'the commit changes something')
    eq(changed.filter(rel => !strip.CHAT_PARITY_SCOPE_FILES.has(rel)), [], 'every changed file is this change\'s')
    const text = git('show', OWN, '--', ...changed)
    ok(!/(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(text), 'no secret in the diff')
  }
}

// ============================================================================================================================================
// D. Mutants
// ============================================================================================================================================
async function mutantsSuite() {
  const libText = read(LIB); const runnersText = read(RUNNERS)
  const libMutants = [
    ['frame request renamed', t => t.replace("request: 'studio_action',", "request: 'studio_actions',")],
    ['result under data', t => t.replace('return { type: CHAT_PARITY_FRAMES.result, payload: data }', 'return { type: CHAT_PARITY_FRAMES.result, data }')],
    ['flag accepts TRUE', t => t.replace("return value === 'true'", "return String(value).toLowerCase() === 'true'")],
    ['notes cap renamed', t => t.replace("notes: 'notes1',", "notes: 'notes_1',")],
    ['caps always sent', t => t.replace("filter(group => flags[group] === true)", 'filter(() => true)')],
    ['caps duplicated', t => t.replace('for (const cap of caps) if (!next.includes(cap)) next.push(cap)', 'for (const cap of caps) next.push(cap)')],
    ['blank id accepted', t => t.replace("typeof id === 'string' && id.trim() ? id : null", "typeof id === 'string' ? id : null")],
    ['args not copied', t => t.replace('{ ...(payload.args as Record<string, unknown>) }', '(payload.args as Record<string, unknown>)')],
    ['off group runs', t => t.replace("flags[request.group] !== true) return 'flag_off'", "flags[request.group] === false) return 'flag_off'")],
    ['unknown action runs', t => t.replace("if (!CHAT_PARITY_ACTIONS[request.group].includes(request.action)) return 'unsupported'", '')],
    ['code on dismissed', t => t.replace("error_code: status === 'failed' ? errorCode : null", 'error_code: errorCode')],
    ['empty detail sent', t => t.replace('if (detail && Object.keys(detail).length > 0) data.detail = detail', 'if (detail) data.detail = detail')],
    ['notes: other mutation', t => t.replace('if (value.mutation !== CHAT_PARITY_NOTES_MUTATION) return null', '')],
    ['notes: unknown field kept', t => t.replace("typeof f === 'string' && CHAT_PARITY_NOTES_FIELDS.includes(f)", "typeof f === 'string'")],
    ['notes: negative index', t => t.replace('(value.slide_index as number) < 0', 'false')],
  ]
  for (const [name, mutate] of libMutants) {
    const mutated = mutate(libText); assert.notEqual(mutated, libText, `mutant applies: ${name}`)
    let caught = false; try { libSuite(mutated) } catch { caught = true }
    ok(caught, `mutant caught: ${name}`)
  }
  const runnerMutants = [
    ['default timeout', t => t.replace('CHAT_PARITY_DEFAULT_TIMEOUT_MS = 25_000', 'CHAT_PARITY_DEFAULT_TIMEOUT_MS = 20_000')],
    ['owner check skipped', t => t.replace("if (!check.ok) return fail('not_owner')", '')],
    ['throw rejects', t => t.replace("} catch {\n    return fail('write_failed')\n  }", '} catch (error) { throw error }')],
    ['timeout answers done', t => t.replace("() => fail('timeout')", "() => chatParityResult(request.requestId, 'done')")],
    ['per-action wait ignored', t => t.replace('CHAT_PARITY_TIMEOUTS_MS[request.action] ?? CHAT_PARITY_DEFAULT_TIMEOUT_MS', 'CHAT_PARITY_DEFAULT_TIMEOUT_MS')],
    ['timer not cleared', t => t.replace('if (!done) { done = true; clearTimeout(timer); resolve(value) }', 'if (!done) { done = true; resolve(value) }')],
    ['other deck accepted', t => t.replace('request.presentationId === start.presentationId && start.deckOwnerSessionId === start.sessionId', 'true')],
    ['wrong group runs', t => t.replace('CHAT_PARITY_ACTIONS[request.group]?.includes(request.action) ? CHAT_PARITY_EXECUTORS[request.action] : undefined', 'CHAT_PARITY_EXECUTORS[request.action]')],
  ]
  for (const [name, mutate] of runnerMutants) {
    const mutated = mutate(runnersText); assert.notEqual(mutated, runnersText, `mutant applies: ${name}`)
    let caught = false; try { await runnersSuite(mutated) } catch { caught = true }
    ok(caught, `mutant caught: ${name}`)
  }
  // a marked line that loses its marker is no longer a pure insertion
  if (hasBase) {
    const hook = readOwn(HOOK); const unmarked = hook.replace('chatParityBus.send = sendChatParityResult // CHAT-PARITY', 'chatParityBus.send = sendChatParityResult')
    ok(strip.stripChatParity(HOOK, unmarked) !== baseOf(HOOK), 'mutant caught: an unmarked line stays in the stripped file')
  }
  return libMutants.length + runnerMutants.length + (hasBase ? 1 : 0)
}

libSuite()
await runnersSuite()
sourcesSuite()
const mutants = await mutantsSuite()
console.log(`test-studio-chat-parity: ${checks} checks, ${mutants} mutants caught${OWN ? ` (own commit ${OWN.slice(0, 8)})` : ' (working tree)'}${hasBase ? '' : ' (base commit not in this clone: source pins skipped)'}`)
