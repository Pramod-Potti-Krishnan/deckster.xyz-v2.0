// FRONTEND-1: proof of Replace picture (PK mandate M10 of 15 Nov 2026: after return, decks stay editable, especially the pictures on title, section and closing slides). Flag NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE, only the exact
// string "true", default off; it acts only in the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL). The Layout half is SLIDE-4's Draft !294 (viewer command setSlideBackgroundPicture, docs/api/SLIDE_BACKGROUND_PICTURE.md).
//
//   node scripts/test-studio-replace-picture.mjs        (plain node, offline: the REAL sources transpiled and run in a vm; the REAL hook runs in the offline React host (scripts/studio-chat-harness/mini-react.mjs) against a viewer double
//                                                        that answers the way the contract says; react-dom/server for the markup; git is read for the strips, the registry and the scope; no network, no browser, no .next)
//
// What it proves (A to F), then mutants (G):
//  A. the lib: the flag (exact "true" only), the command and its 20 s budget, Layout's URL rule (a table of links that must pass and fail), the params (the contract's keys, in its order), every code of the contract
//     (the 20 Layout codes + Studio's four) has plain words, which codes offer Reload deck and Try again, the failure reader (the reply's code first; the guard's "view-only", "Unknown action", a timeout, no frame), the runner
//     (one send of {action, params, timeoutMs}, never throws, no send on a bad input), the disabled reasons and their order, the slide kind, the refine-job match, the read-only URL;
//  B. THE COMMAND, from the REAL hook in the offline React host: flag off (nothing read, nothing sent, nothing drawn); the slide kind read once per slide; for every disabled state the reason and no send; the command shape on the wire
//     (composeGetState {} then setSlideBackgroundPicture {slide_index, slide_id, url, alt} with timeoutMs 20000), the busy scaffolding (begin / release once), what each reply becomes (a reply message watched for its code: the bridge
//     rejects with text only), the slide changing under the dialog, a refused deck staying off, an untrusted reply ignored, the listener removed;
//  C. the control: the trigger's markup (enabled, disabled with its reason as a tab stop), and its source: it shows only the outcome's own words, the dialog cannot be closed while it runs;
//  D. the viewer's marked lines: the hook call, the one JSX line (at the END of the authoring strip, after Show and before Present, so no older sibling's place moves), the prop; the bridge (sendCommand) is untouched, byte for byte; and with the flag off the REAL viewer's
//     server markup is the base viewer's, byte for byte, in four environments and four decks (React's generated ids included: they move when a child is added in the middle of a list);
//  E. the sources: markers, the strip gives each touched file its base back byte for byte, the registry (three lines, at the true ends), .env.example, secrets, the css, scope (from the COMMITTED diff only), the commits;
//  F. the lib reads the flag from one literal env name and nothing else reads it.
//  G. mutants: each is one edit of the real sources, fed to the same checks, and must be caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { Root } from './studio-chat-harness/mini-react.mjs'
import * as stripModule from './studio-replace-picture-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const { BASE_COMMIT, REPLACE_PICTURE_SCOPE_FILES: SCOPE, REPLACE_PICTURE_NEW_FILES: NEW_FILES, REPLACE_PICTURE_FILES: APP_FILES, REPLACE_PICTURE_MARKER_RE: MARKER_RE, REPLACE_PICTURE_ENV_BLOCK: ENV_BLOCK, REPLACE_PICTURE_SUBJECT: SUBJECT, REPLACE_PICTURE_EDITS: EDITS, REPLACE_PICTURE_FLAGS: FLAGS } = stripModule
const STRIP_FN = stripModule.stripReplacePicture
const FLAG = FLAGS[0]

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const nodeRequire = createRequire(path.join(root, 'package.json'))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE_COMMIT}:${rel}`)); return baseCache.get(rel) }
/** The sources run in a vm, so their objects and arrays come from another realm: compare them through JSON. */
const deepEqual = (actual, expected, ...message) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual ?? null)), JSON.parse(JSON.stringify(expected ?? null)), ...message)

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${String(error?.message ?? error).split('\n').slice(0, 14).join(' | ').slice(0, 700)}`) }
}
let caught = 0
const missed = []
/** A mutant is caught only by a failed ASSERTION of a check. A mutant whose edit did not apply (SwapError) or that crashed some other way proves nothing and is reported as missed. */
class SwapError extends Error {}
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 160)})`) } else { caught++; console.log(`CAUGHT mutant ${label}`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }

// ---- the real sources in a vm ---------------------------------------------------------------------------------------------------------------------------------------------
const LIB = 'lib/studio-replace-picture.ts', HOOK = 'hooks/use-studio-replace-picture.ts', CONTROL = 'components/builder/replace-picture/replace-picture-control.tsx', CSS = 'components/builder/replace-picture/replace-picture.css'
const VIEWER = 'components/presentation-viewer.tsx', AREA = 'components/builder/presentation-area.tsx', PAGE = 'app/builder/page.tsx', REGISTRY = 'scripts/studio-later-changes.mjs'
const compileCache = new Map()
const compile = (file, text) => {
  const id = `${file}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const localFile = (spec, from) => {
  const base = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('./') ? path.posix.join(path.posix.dirname(from), spec.slice(2)) : null
  if (base === null) return null
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (fs.existsSync(path.join(root, base + ext)) && fs.statSync(path.join(root, base + ext)).isFile()) return base + ext
  throw new Error(`unexpected import ${spec} in ${from}`)
}
const textsKeys = new WeakMap(), modules = new Map()
const textsKey = texts => { if (!textsKeys.has(texts)) textsKeys.set(texts, crypto.createHash('sha1').update(JSON.stringify(texts)).digest('hex')); return textsKeys.get(texts) }
/** Load one real source in a new context. `texts` replaces the text of any file (a mutant); `env` is process.env; `globals` are extra globals (a fake window); every other import is the REAL source or package. A .css import is an empty module. */
function load(rel, { env = {}, texts = {}, globals = null, id = '', stubs = {} } = {}) {
  const key = `${rel}\0${JSON.stringify(env)}\0${textsKey(texts)}\0${id}`
  if (modules.has(key)) return modules.get(key)
  const module = { exports: {} }
  modules.set(key, module.exports)
  const req = spec => {
    if (spec in stubs) return stubs[spec]
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec.endsWith('.css')) return {}
    const local = localFile(spec, rel)
    return local ? load(local, { env, texts, globals, id, stubs }) : nodeRequire(spec)
  }
  vm.runInNewContext(compile(rel, texts[rel] ?? read(rel)), { module, exports: module.exports, require: req, process: { env: { ...env } }, URL, Promise, setTimeout, clearTimeout, console, window: globals?.window, fetch: () => assert.fail(`${rel} fetched`) }, { filename: rel })
  return module.exports
}
const ON = { [FLAG]: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
const h = React.createElement
const tick = () => new Promise(resolve => setImmediate(resolve))

// ============================================================================================================================================
// A. the lib
// ============================================================================================================================================
/** The contract's codes (docs/api/SLIDE_BACKGROUND_PICTURE.md of Layout !294, b6c34209): the viewer command's own and the route's, passed through. */
const CONTRACT_CODES = ['INVALID_SLIDE_INDEX', 'INVALID_URL', 'INVALID_ALT', 'INVALID_SLIDE_ID', 'VIEW_ONLY_PAGE', 'PRESENTATION_NOT_FOUND', 'SLIDE_NOT_FOUND', 'VIEWER_UNAVAILABLE', 'SAVE_PENDING', 'NETWORK_ERROR',
  'READ_ONLY_SNAPSHOT', 'NOT_AUTHORIZED', 'ROUTE_UNAVAILABLE', 'WRITE_FAILED', 'REPAINT_FAILED', 'INVALID_BODY', 'SLIDE_CHANGED', 'NO_BACKGROUND_PICTURE', 'PICTURE_DECLINED', 'SLIDE_INDEX_OUT_OF_RANGE']
const STUDIO_CODES = ['TIMED_OUT', 'LAYOUT_SWITCH_OFF', 'BUSY', 'UNKNOWN']
/** Words that mean a raw backend message reached a person: names of services, stages, statuses, HTTP, routes, codes. */
const JARGON = /\b(Layout|Director|Elementor|stage|status|HTTP|route|endpoint|payload|JSON|stack|exception|undefined|null|code)\b|\b[45]\d\d\b(?! characters)|[A-Z]{3,}_[A-Z_]{3,}/
const NO_RETRY = ['REPAINT_FAILED', 'READ_ONLY_SNAPSHOT', 'VIEW_ONLY_PAGE', 'NOT_AUTHORIZED', 'NO_BACKGROUND_PICTURE', 'PICTURE_DECLINED', 'LAYOUT_SWITCH_OFF', 'ROUTE_UNAVAILABLE']
const RELOAD = ['REPAINT_FAILED', 'TIMED_OUT', 'VIEWER_UNAVAILABLE', 'PRESENTATION_NOT_FOUND', 'SLIDE_NOT_FOUND', 'SLIDE_INDEX_OUT_OF_RANGE', 'SLIDE_CHANGED', 'INVALID_BODY']
const reply = (code, extra = {}) => ({ success: false, action: 'setSlideBackgroundPicture', stage: 'route', code, error: `raw text for ${code}`, ...extra })
const OK_URL = 'https://pictures.example.test/harbour-dawn.jpg'

function libChecks(texts = {}) {
  const lib = (env = {}) => load(LIB, { env, texts })
  const L = lib(ON)
  // the flag: only the exact string, and it is the Studio shell's business to add its own
  for (const [value, on] of [['true', true], [undefined, false], ['', false], ['false', false], ['True', false], ['TRUE', false], ['1', false], ['yes', false], [' true', false], ['true ', false]]) {
    assert.equal(L.replacePictureFlagOn(value), on, `flag value ${JSON.stringify(value)}`)
    assert.equal(lib(value === undefined ? {} : { [FLAG]: value }).STUDIO_REPLACE_SLIDE_PICTURE_ENABLED, on, `the exported flag with ${JSON.stringify(value)}`)
  }
  assert.equal(lib({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }).STUDIO_REPLACE_SLIDE_PICTURE_ENABLED, false, 'the shell alone does not turn it on')
  // the command and its budget
  assert.equal(L.REPLACE_PICTURE_COMMAND, 'setSlideBackgroundPicture'); assert.equal(L.REPLACE_PICTURE_TIMEOUT_MS, 20000, 'the reply budget is 20 s (the contract\'s own example)')
  assert.equal(L.REPLACE_PICTURE_URL_MAX, 2048); assert.equal(L.REPLACE_PICTURE_ALT_MAX, 500)
  assert.equal(L.REPLACE_PICTURE_KIND_COMMAND, 'getTemplateSlotCatalog'); assert.equal(L.REPLACE_PICTURE_ORDER_COMMAND, 'composeGetState')
  // Layout's URL rule: https only, <= 2048, printable ASCII, none of " ' ` \ < > ( ) [ ] { }, a host, no user info, a valid port
  const good = [OK_URL, 'HTTPS://pictures.example.test/a.png', 'https://a.test', 'https://a.test:8443/x.jpg?w=1200&q=80#top', '  https://pictures.example.test/padded.jpg \n', 'https://xn--bcher-kva.example/a.jpg', 'https://127.0.0.1/a.png', `https://a.test/${'x'.repeat(2048 - 'https://a.test/'.length)}`]
  for (const url of good) assert.equal(L.checkPictureUrl(url).ok, true, `accepted: ${url.slice(0, 60)}`)
  assert.equal(L.checkPictureUrl('HTTPS://pictures.example.test/a.png').url, 'HTTPS://pictures.example.test/a.png', 'the link is sent as typed (trimmed); only Layout decides on the scheme\'s case')
  assert.equal(L.checkPictureUrl('  https://a.test/p.jpg \n').url, 'https://a.test/p.jpg', 'surrounding whitespace is trimmed')
  const bad = [
    ['', 'empty'], ['   ', 'empty'], [undefined, 'empty'], [null, 'empty'], [5, 'empty'], ['http://pictures.example.test/a.jpg', 'not-https'], ['ftp://a.test/a.jpg', 'not-https'], ['//a.test/a.jpg', 'not-https'], ['pictures.example.test/a.jpg', 'not-https'],
    ['data:image/png;base64,AAAA', 'not-https'], ['blob:https://a.test/1', 'not-https'], ['https://a.test/with space.jpg', 'characters'], ['https://a.test/tab\t.jpg', 'characters'], ['https://a.test/new\nline.jpg', 'characters'],
    ['https://a.test/a"b.jpg', 'characters'], ["https://a.test/a'b.jpg", 'characters'], ['https://a.test/a`b.jpg', 'characters'], ['https://a.test/a\\b.jpg', 'characters'], ['https://a.test/a<b>.jpg', 'characters'],
    ['https://a.test/a(1).jpg', 'characters'], ['https://a.test/a[1].jpg', 'characters'], ['https://a.test/a{1}.jpg', 'characters'], ['https://a.test/caf\u00e9.jpg', 'characters'],
    ['https://', 'no-host'], ['https:///a.jpg', 'no-host'], ['https://user@a.test/a.jpg', 'no-host'], ['https://user:pw@a.test/a.jpg', 'no-host'], ['https://?x=1', 'no-host'], ['https://#top', 'no-host'],
    ['https://a.test:99999/a.jpg', 'unusable'], ['https://a.test:abc/a.jpg', 'unusable'], [`https://a.test/${'x'.repeat(2048 - 'https://a.test/'.length + 1)}`, 'too-long'],
  ]
  for (const [url, problem] of bad) { const out = L.checkPictureUrl(url); assert.equal(out.ok, false, `refused: ${String(url).slice(0, 60)}`); assert.equal(out.problem, problem, `${String(url).slice(0, 60)}: ${problem}`) }
  for (const problem of ['empty', 'not-https', 'too-long', 'characters', 'no-host', 'unusable']) assert.ok(L.PICTURE_URL_PROBLEM_WORDS[problem] && !JARGON.test(L.PICTURE_URL_PROBLEM_WORDS[problem]), `plain words for a link that is ${problem}`)
  assert.equal(L.checkPictureAlt(undefined).alt, null); assert.equal(L.checkPictureAlt('  ').alt, null); assert.equal(L.checkPictureAlt(' a picture ').alt, 'a picture'); assert.equal(L.checkPictureAlt('x'.repeat(500)).ok, true)
  assert.equal(L.checkPictureAlt('x'.repeat(501)).ok, false); assert.equal(L.checkPictureAlt(5).ok, false)
  // the params: the contract's keys in its order, an absent alt / slide_id is absent
  deepEqual(Object.keys(L.buildReplacePictureParams({ slideIndex: 3, slideId: 'slide_ab12cd34', url: OK_URL, alt: 'Harbour at dawn' }).params), ['slide_index', 'slide_id', 'url', 'alt'])
  deepEqual(L.buildReplacePictureParams({ slideIndex: 0, slideId: null, url: OK_URL, alt: '' }), { ok: true, params: { slide_index: 0, url: OK_URL } })
  deepEqual(L.buildReplacePictureParams({ slideIndex: 7, url: `  ${OK_URL} ` }), { ok: true, params: { slide_index: 7, url: OK_URL } })
  for (const index of [-1, 1.5, '2', null, undefined, NaN, Infinity]) deepEqual(L.buildReplacePictureParams({ slideIndex: index, url: OK_URL }), { ok: false, code: 'INVALID_SLIDE_INDEX' }, `slide_index ${String(index)}`)
  for (const id of ['', 5, {}, []]) deepEqual(L.buildReplacePictureParams({ slideIndex: 0, slideId: id, url: OK_URL }), { ok: false, code: 'INVALID_SLIDE_ID' }, `slide_id ${JSON.stringify(id)}`)
  deepEqual(L.buildReplacePictureParams({ slideIndex: 0, url: 'http://a.test/a.jpg' }), { ok: false, code: 'INVALID_URL', problem: 'not-https' })
  deepEqual(L.buildReplacePictureParams({ slideIndex: 0, url: OK_URL, alt: 'x'.repeat(501) }), { ok: false, code: 'INVALID_ALT' })
  // every code of the contract has words, and so does each of Studio's own: plain ones
  deepEqual([...L.LAYOUT_PICTURE_CODES].sort(), [...CONTRACT_CODES].sort(), 'the lib lists exactly the contract\'s 20 codes')
  deepEqual([...L.STUDIO_PICTURE_CODES].sort(), [...STUDIO_CODES].sort(), 'and Studio\'s own four')
  deepEqual(Object.keys(L.REPLACE_PICTURE_WORDS).sort(), [...CONTRACT_CODES, ...STUDIO_CODES].sort(), 'one sentence per code, no more, no fewer')
  const seen = new Map()
  for (const [code, words] of Object.entries(L.REPLACE_PICTURE_WORDS)) {
    assert.ok(typeof words === 'string' && words.length >= 25 && words.length <= 190 && words.endsWith('.'), `${code}: one plain sentence or two`)
    assert.ok(!JARGON.test(words), `${code}: no jargon in "${words}"`)
    assert.ok(!/raw text for/.test(words), `${code}: no raw text`)
    seen.set(words, [...(seen.get(words) ?? []), code])
  }
  for (const [words, codes] of seen) if (codes.length > 1) assert.deepEqual([...codes].sort(), ['INVALID_SLIDE_ID', 'INVALID_SLIDE_INDEX'], `only the two slide-identity codes share their words: ${words}`)
  assert.match(L.REPLACE_PICTURE_WORDS.REPAINT_FAILED, /saved/i); assert.match(L.REPLACE_PICTURE_WORDS.REPAINT_FAILED, /reload/i); assert.match(L.REPLACE_PICTURE_WORDS.TIMED_OUT, /may or may not/); assert.match(L.REPLACE_PICTURE_WORDS.TIMED_OUT, /20 seconds/)
  for (const code of [...CONTRACT_CODES, ...STUDIO_CODES].filter(c => !['REPAINT_FAILED', 'TIMED_OUT', 'UNKNOWN', 'SLIDE_CHANGED', 'BUSY'].includes(c))) assert.ok(/Nothing changed|try again|Reload|Pick|Click|Use a|Keep|Open|Sign in|Choose|Wait|Press|Turn/i.test(L.REPLACE_PICTURE_WORDS[code]), `${code}: says what to do or that nothing changed`)
  // which codes offer Reload deck / Try again (the dialog's buttons)
  for (const code of [...CONTRACT_CODES, ...STUDIO_CODES]) {
    const out = L.failureOutcome(code)
    assert.equal(out.ok, false); assert.equal(out.code, code); assert.equal(out.words, L.REPLACE_PICTURE_WORDS[code])
    assert.equal(out.reload, RELOAD.includes(code), `${code}: Reload deck ${RELOAD.includes(code) ? 'offered' : 'not offered'}`)
    assert.equal(out.retry, !NO_RETRY.includes(code), `${code}: Try again ${NO_RETRY.includes(code) ? 'not offered' : 'offered'}`)
    assert.equal(out.stored, code === 'REPAINT_FAILED', `${code}: stored only for REPAINT_FAILED`)
  }
  // the failure reader: the viewer's own reply first
  for (const code of CONTRACT_CODES) {
    const got = L.readReplacePictureFailure(new Error('Command failed'), reply(code))
    assert.equal(got.code, code, `reply code ${code}`); assert.equal(got.stored, code === 'REPAINT_FAILED', `${code}: stored`)
    assert.equal(L.readReplacePictureFailure(reply(code)).code, code, `${code}: a bare reply works too`)
  }
  deepEqual(L.readReplacePictureFailure(new Error('x'), reply('SOMETHING_NEW', { saved: true })), { code: 'UNKNOWN', stored: true }, 'a code Layout adds later: plain unknown words, stored when the reply says saved')
  deepEqual(L.readReplacePictureFailure(new Error('x'), reply('WRITE_FAILED', { saved: true })), { code: 'WRITE_FAILED', stored: true }, 'a saved flag is honoured')
  deepEqual(L.readReplacePictureFailure(new Error('view-only'), { success: false, error: 'view-only' }), { code: 'VIEW_ONLY_PAGE', stored: false }, 'the guard answers "view-only" with no code')
  deepEqual(L.readReplacePictureFailure(new Error('view-only')), { code: 'VIEW_ONLY_PAGE', stored: false }, 'and the bridge\'s own Error says the same')
  deepEqual(L.readReplacePictureFailure(new Error('Unknown action: setSlideBackgroundPicture'), { success: false, error: 'Unknown action: setSlideBackgroundPicture' }), { code: 'LAYOUT_SWITCH_OFF', stored: false })
  deepEqual(L.readReplacePictureFailure(new Error('Command timeout')), { code: 'TIMED_OUT', stored: false }); deepEqual(L.readReplacePictureFailure(new Error('Iframe not ready')), { code: 'VIEWER_UNAVAILABLE', stored: false })
  deepEqual(L.readReplacePictureFailure(new Error('Layout service has no configured viewer origin')), { code: 'VIEWER_UNAVAILABLE', stored: false })
  for (const odd of [null, undefined, 5, {}, new Error('boom'), 'boom', reply(null)]) assert.equal(L.readReplacePictureFailure(odd).code, 'UNKNOWN', `an odd failure is UNKNOWN: ${String(odd)}`)
  // a reply that resolved
  const ok = L.outcomeFromReply({ success: true, hidden_image_ids: ['image_a', 'image_b'], background_image: OK_URL })
  deepEqual(ok, { ok: true, hiddenCount: 2, words: 'Picture replaced.', note: '2 pictures that covered the whole slide were hidden, not deleted. Restoring an earlier version of the deck brings it back.' })
  assert.match(L.outcomeFromReply({ success: true, hidden_image_ids: ['image_a'] }).note, /^A picture that covered the whole slide was hidden, not deleted\./); assert.equal(L.outcomeFromReply({ success: true, hidden_image_ids: [] }).note, null); assert.equal(L.outcomeFromReply({ success: true }).note, null)
  assert.equal(L.outcomeFromReply(reply('NO_BACKGROUND_PICTURE')).code, 'NO_BACKGROUND_PICTURE'); assert.equal(L.outcomeFromReply(null).code, 'UNKNOWN'); assert.equal(L.outcomeFromReply({ success: 'yes' }).ok, false, 'only success === true is success')
  // the runner: one send with the contract's shape; never throws; nothing sent on a bad input
  const calls = []
  const run = (send, input = { slideIndex: 2, slideId: 'slide_x', url: OK_URL, alt: 'A' }, observed) => L.runReplacePicture({ send: (...args) => { calls.push(args); return send(...args) }, ...(observed ? { observed } : {}) }, input)
  return (async () => {
    deepEqual(await run(async () => ({ success: true, hidden_image_ids: [] })), { ok: true, hiddenCount: 0, words: 'Picture replaced.', note: null })
    deepEqual(calls, [['setSlideBackgroundPicture', { slide_index: 2, slide_id: 'slide_x', url: OK_URL, alt: 'A' }, { timeoutMs: 20000 }]], 'one send: the command, the contract\'s params, the 20 s budget')
    calls.length = 0
    for (const code of CONTRACT_CODES) {
      const got = await run(async () => { throw new Error('Command failed') }, undefined, () => reply(code))
      assert.equal(got.code, code, `${code}: through the runner`); assert.equal(got.words, L.REPLACE_PICTURE_WORDS[code])
    }
    deepEqual(await run(async () => { throw new Error('Command timeout') }), L.failureOutcome('TIMED_OUT'))
    deepEqual(await run(async () => { throw 'a string' }), L.failureOutcome('UNKNOWN')); deepEqual(await run(async () => { throw null }), L.failureOutcome('UNKNOWN'))
    deepEqual(await run(async () => reply('WRITE_FAILED')), L.failureOutcome('WRITE_FAILED'), 'a failed reply that resolves is an outcome too')
    deepEqual(await run(() => { throw new Error('Iframe not ready') }), L.failureOutcome('VIEWER_UNAVAILABLE'), 'a send that throws at once')
    deepEqual(await run(async () => { throw new Error('x') }, undefined, () => { throw new Error('observer broke') }).catch(() => 'threw'), 'threw', 'a broken observer is the caller\'s bug, but a broken send never escapes (above)')
    calls.length = 0
    for (const [input, code] of [[{ slideIndex: -1, url: OK_URL }, 'INVALID_SLIDE_INDEX'], [{ slideIndex: 0, url: 'http://x.test/a.jpg' }, 'INVALID_URL'], [{ slideIndex: 0, url: OK_URL, alt: 'x'.repeat(501) }, 'INVALID_ALT'], [{ slideIndex: 0, slideId: '', url: OK_URL }, 'INVALID_SLIDE_ID']]) {
      deepEqual(await run(async () => assert.fail('sent'), input), L.failureOutcome(code), `a bad input is ${code} and nothing is sent`)
    }
    assert.equal(calls.length, 0, 'no send for a bad input')
    availabilityChecks(L)
  })()
}

const clear = { deckOpen: true, viewerReady: true, readOnly: null, tabPausedHint: null, templateMode: false, building: false, regeneratingThisSlide: false, studioBusy: false, mutationPending: false, slideKind: 'hero' }
function availabilityChecks(L) {
  const R = L.REPLACE_PICTURE_REASONS
  assert.equal(L.replacePictureDisabledReason(clear), null, 'everything clear on a hero: on')
  assert.equal(L.replacePictureDisabledReason({ ...clear, slideKind: 'unknown' }), null, 'a slide whose kind could not be read stays on (Layout answers NO_BACKGROUND_PICTURE if it has no slot)')
  const alone = [
    [{ building: true }, R.building], [{ regeneratingThisSlide: true }, R.regenerating], [{ studioBusy: true }, R.busy], [{ mutationPending: true }, R.mutating], [{ templateMode: true }, R.template],
    [{ readOnly: 'view-only' }, R.viewOnly], [{ readOnly: 'preview' }, R.preview], [{ tabPausedHint: 'This tab is paused.' }, 'This tab is paused.'], [{ viewerReady: false }, R.loading], [{ deckOpen: false }, R.loading],
    [{ slideKind: 'other' }, R.notHero], [{ slideKind: 'loading' }, R.checking],
  ]
  for (const [state, want] of alone) assert.equal(L.replacePictureDisabledReason({ ...clear, ...state }), want, `off for ${JSON.stringify(state)}`)
  for (const text of Object.values(R)) assert.ok(typeof text === 'string' && text.endsWith('.') && !JARGON.test(text), `plain reason: ${text}`)
  assert.match(R.building, /build is running/); assert.match(R.regenerating, /regenerated/); assert.match(R.notHero, /title, section and closing slides/)
  // the order: read-only first (the outline preview right after it), then the paused tab, Template Mode, a build, a regenerate, any other busy state, a slide change, loading, the kind
  assert.equal(L.replacePictureDisabledReason({ ...clear, readOnly: 'view-only', tabPausedHint: 'paused' }), R.viewOnly); assert.equal(L.replacePictureDisabledReason({ ...clear, readOnly: 'preview', tabPausedHint: 'paused' }), R.preview, 'the outline preview comes before the paused tab'); assert.equal(L.replacePictureDisabledReason({ ...clear, slideKind: 'other', viewerReady: false }), R.loading, 'loading comes before the kind')
  const order = [{ readOnly: 'view-only' }, { tabPausedHint: 'paused' }, { templateMode: true }, { building: true }, { regeneratingThisSlide: true }, { studioBusy: true }, { mutationPending: true }, { viewerReady: false }, { slideKind: 'other' }]
  for (let i = 0; i < order.length; i++) {
    const state = Object.assign({}, ...order.slice(i))
    assert.equal(L.replacePictureDisabledReason({ ...clear, ...state }), L.replacePictureDisabledReason({ ...clear, ...order[i] }), `with everything from ${JSON.stringify(order[i])} down, that one wins`)
  }
  // the kind: a hero is H and a digit
  for (const type of ['H1', 'H1s', 'H2', 'H3', 'h2', 'H1-structured', 'H2-section', 'H3-closing', ' H3 ']) assert.equal(L.replacePictureSlideKind(type), 'hero', type)
  for (const type of ['C1', 'L25', 'B1', 'V2', 'S4-comparison', 'HERO', 'Hx']) assert.equal(L.replacePictureSlideKind(type), 'other', type)
  for (const type of [null, undefined, '', '  ', 5, {}]) assert.equal(L.replacePictureSlideKind(type), 'unknown', String(type))
  assert.equal(L.canvasTypeFromCatalogReply({ success: true, canvas_type: 'H1s' }), 'H1s'); assert.equal(L.canvasTypeFromCatalogReply({ catalog: { canvasType: 'H2' } }), 'H2'); assert.equal(L.canvasTypeFromCatalogReply({ data: { canvas_type: ' C1 ' } }), 'C1')
  for (const odd of [null, 5, {}, { canvas_type: '' }, { canvas_type: 5 }, []]) assert.equal(L.canvasTypeFromCatalogReply(odd), null)
  // the viewer's order: the id at the index and whether the viewer is on it
  const order2 = { success: true, current_visual_index: 2, slides: [{ slide_id: 'slide_a' }, { slide_id: 'slide_b' }, { slide_id: 'slide_c' }] }
  deepEqual(L.slideIdentityFromOrder(order2, 2), { slideId: 'slide_c', onSlide: true }); deepEqual(L.slideIdentityFromOrder(order2, 0), { slideId: 'slide_a', onSlide: false }); deepEqual(L.slideIdentityFromOrder(order2, 9), { slideId: null, onSlide: false })
  for (const odd of [null, { success: false, slides: [] }, { success: true }, 'x']) deepEqual(L.slideIdentityFromOrder(odd, 0), { slideId: null, onSlide: null })
  deepEqual(L.slideIdentityFromOrder({ success: true, slides: [{ slide_id: '' }], current_visual_index: 'a' }, 0), { slideId: null, onSlide: null })
  // a refine job on this slide: by id when both sides have one, else by position; only a building refine job
  const job = (over = {}) => ({ kind: 'refine', status: 'building', targetSlideId: null, targetIndex: 3, targetLayoutIndex: 3, ...over })
  assert.equal(L.refineBuildingOnSlide([job()], { slideId: null, slideIndex: 3 }), true, 'by position'); assert.equal(L.refineBuildingOnSlide([job()], { slideId: 'x', slideIndex: 3 }), true, 'one side has no id: by position')
  assert.equal(L.refineBuildingOnSlide([job({ targetSlideId: 'a' })], { slideId: 'a', slideIndex: 0 }), true, 'by id'); assert.equal(L.refineBuildingOnSlide([job({ targetSlideId: 'a' })], { slideId: 'b', slideIndex: 3 }), false, 'both have ids and they differ: another slide')
  assert.equal(L.refineBuildingOnSlide([job({ status: 'error' })], { slideId: null, slideIndex: 3 }), false, 'a failed job is not running'); assert.equal(L.refineBuildingOnSlide([job({ kind: 'compose' })], { slideId: null, slideIndex: 3 }), false, 'an Add Slide compose is not a regenerate')
  assert.equal(L.refineBuildingOnSlide([job({ targetIndex: 5, targetLayoutIndex: 5 })], { slideId: null, slideIndex: 3 }), false); assert.equal(L.refineBuildingOnSlide(null, { slideId: null, slideIndex: 0 }), false); assert.equal(L.refineBuildingOnSlide([], { slideId: null, slideIndex: 0 }), false)
  for (const [url, on] of [['https://l.test/p/d?viewOnly=true', true], ['https://l.test/p/d?x=1&viewOnly=true#/3', true], ['https://l.test/p/d?viewOnly=TRUE', true], ['https://l.test/p/d?viewOnly=false', false], ['https://l.test/p/d', false], ['https://l.test/p/d?notviewOnly=true', false], [null, false], [5, false]]) assert.equal(L.urlIsViewOnly(url), on, String(url))
}

// ============================================================================================================================================
// B. the hook, REAL, in the offline React host, against a viewer double
// ============================================================================================================================================
const FRAME = { frame: 'iframe' }
let mountSeq = 0
/** A viewer double: answers the three reads and the command the way the contract says; a failed command posts its reply message to the window's listeners (as the viewer does) and rejects with text only (as the bridge does). */
function viewer(over = {}) {
  const calls = [], listeners = new Set(), added = [], removed = []
  const win = { addEventListener: (type, fn) => { if (type === 'message') { listeners.add(fn); added.push(fn) } }, removeEventListener: (type, fn) => { if (type === 'message') { listeners.delete(fn); removed.push(fn) } }, post: (data, source = 'viewer') => { for (const fn of [...listeners]) fn({ data, source, origin: 'https://layout.test' }) } }
  const state = { canvas: 'H1s', current: 0, count: 8, ...over }
  const send = async (iframe, action, params, options) => {
    calls.push({ action, params: JSON.parse(JSON.stringify(params ?? null)), options: options ? { ...options } : undefined, iframe })
    if (action === 'getTemplateSlotCatalog') { if (state.catalogFails) throw new Error('Command timeout'); return { success: true, canvas_type: state.canvas } }
    if (action === 'composeGetState') { if (state.orderFails) throw new Error('Command timeout'); return { success: true, current_visual_index: state.current, slides: Array.from({ length: state.count }, (_, i) => ({ slide_id: `slide_${String(i + 1).padStart(8, '0')}` })) } }
    if (action === 'setSlideBackgroundPicture') {
      if (state.command) return state.command({ params, win })
      return { success: true, action, slide_index: params.slide_index, hidden_image_ids: state.hidden ?? [] }
    }
    throw new Error(`unexpected command ${action}`)
  }
  return { calls, listeners, added, removed, win, send, state, commands: () => calls.filter(c => c.action === 'setSlideBackgroundPicture') }
}
/** A command that fails the way the real bridge does: the viewer's reply message first, then a rejection that has the text only. */
const failing = (replyBody, text = 'raw viewer text that must never be shown') => ({ win }) => { if (replyBody) win.post(replyBody); throw new Error(text) }

async function mount(env, v, over = {}, texts = {}) {
  const probe = { begins: [], released: 0, after: 0, begin: null }
  const H = load(HOOK, { env, texts, globals: { window: v.win }, id: `mount${++mountSeq}` })
  const input = () => ({
    enabled: true, deckOpen: true, viewerReady: true, presenting: false, presentationId: 'deck-1', frameUrl: 'https://layout.test/p/deck-1', activeVersion: 'final', currentSlide: 1, railSlideId: 'outline-1', railSlideTitle: 'Why we are rethinking the roadmap',
    tabPausedHint: undefined, templateMode: false, building: false, studioBusy: false, composeJobs: [], mutationPending: false, send: v.send, getIframe: () => FRAME, isTrustedReply: event => event.source === 'viewer', onReloadDeck: undefined,
    begin: operation => { probe.begins.push(operation); return probe.begin === 'none' ? null : { iframe: FRAME, isCurrent: () => probe.begin !== 'stale', release: () => { probe.released++ } } },
    afterReplace: () => { probe.after++ }, ...over,
  })
  const out = { view: null }
  const Probe = ({ props }) => { out.view = H.useStudioReplacePicture(props); return null }
  const rootHost = new Root()
  const set = patch => { Object.assign(over, patch); rootHost.setElement(h(Probe, { props: input() })) }
  const settle = async () => { for (let i = 0; i < 5; i++) { rootHost.flush(); await tick() } rootHost.flush() }
  set({}); await settle()
  return { out, probe, set, settle, root: rootHost, view: () => out.view }
}
const kindReads = v => v.calls.filter(c => c.action === 'getTemplateSlotCatalog')

async function hookChecks(texts = {}) {
  const L = load(LIB, { env: ON, texts })
  const R = L.REPLACE_PICTURE_REASONS
  const mountT = (env, v, over = {}) => mount(env, v, over, texts)
  // flag off: nothing read, nothing sent, nothing drawn (every way for it to be off)
  for (const over of [{ enabled: false }, { enabled: false, building: true }, { enabled: false, currentSlide: 4 }]) {
    const v = viewer(), m = await mountT({}, v, over)
    assert.equal(m.view().visible, false, 'off: not drawn'); assert.equal(m.view().reason, null, 'off: no reason'); assert.equal(v.calls.length, 0, 'off: not one command to the viewer'); assert.equal(v.added.length, 0, 'off: no listener')
    m.set({ currentSlide: 2 }); await m.settle(); assert.equal(v.calls.length, 0, 'off: still none after the slide changed'); assert.equal(m.probe.begins.length, 0)
  }
  // on: the kind of the slide on screen is read once, with the viewer's own read
  let v = viewer(), m = await mountT(ON, v)
  assert.equal(m.view().visible, true); assert.equal(m.view().reason, null, 'a hero: on')
  assert.equal(kindReads(v).length, 1, 'the slide kind is read once'); deepEqual(kindReads(v)[0].params, { slideIndex: 0 }); assert.equal(kindReads(v)[0].options.timeoutMs, 8000); assert.equal(kindReads(v)[0].iframe, FRAME)
  assert.equal(v.commands().length, 0, 'nothing is sent until the person confirms'); assert.equal(m.view().slideNumber, 1); assert.equal(m.view().slideTitle, 'Why we are rethinking the roadmap')
  m.set({ railSlideTitle: 'Slide 1' }); await m.settle(); assert.equal(m.view().slideTitle, null, 'a fallback title "Slide N" is not shown as a name'); m.set({ railSlideTitle: null }); await m.settle(); assert.equal(m.view().slideTitle, null)
  m.set({ currentSlide: 2 }); await m.settle(); assert.equal(kindReads(v).length, 2, 'a new slide, a new read'); deepEqual(kindReads(v)[1].params, { slideIndex: 1 })
  m.set({ studioBusy: false }); await m.settle(); assert.equal(kindReads(v).length, 2, 'no read when nothing changed')
  // a content slide, a slide whose kind cannot be read, and the moment before the read answers
  v = viewer({ canvas: 'C1' }); m = await mountT(ON, v); assert.equal(m.view().reason, R.notHero, 'a content slide: off, and why')
  v = viewer({ catalogFails: true }); m = await mountT(ON, v); assert.equal(m.view().reason, null, 'a kind that cannot be read: on (Layout answers for itself)')
  { const slow = viewer(); let release; slow.send = async (iframe, action, ...rest) => { if (action === 'getTemplateSlotCatalog') await new Promise(resolve => { release = resolve }); return viewer().send(iframe, action, ...rest) }
    const pending = await mountT(ON, slow); assert.equal(pending.view().reason, R.checking, 'before the read answers: checking'); release(); await pending.settle(); assert.equal(pending.view().reason, null) }
  // every disabled state: its reason, no read while busy, and still nothing sent
  const states = [
    [{ building: true }, R.building], [{ studioBusy: true }, R.busy], [{ mutationPending: true }, R.mutating], [{ templateMode: true }, R.template], [{ tabPausedHint: 'This tab is paused (test).' }, 'This tab is paused (test).'],
    [{ activeVersion: 'strawman' }, R.preview], [{ frameUrl: 'https://layout.test/p/deck-1?viewOnly=true' }, R.viewOnly], [{ viewerReady: false }, R.loading], [{ deckOpen: false }, R.loading],
    [{ composeJobs: [{ kind: 'refine', status: 'building', targetSlideId: 'outline-1', targetIndex: 0, targetLayoutIndex: 0 }] }, R.regenerating],
    [{ composeJobs: [{ kind: 'refine', status: 'building', targetSlideId: null, targetIndex: 0, targetLayoutIndex: 0 }] }, R.regenerating],
  ]
  for (const [state, want] of states) {
    v = viewer(); m = await mountT(ON, v, state)
    assert.equal(m.view().reason, want, `off for ${JSON.stringify(state).slice(0, 80)}`); assert.equal(v.commands().length, 0)
    if (state.building || state.studioBusy || state.mutationPending || state.templateMode || state.viewerReady === false || state.deckOpen === false) assert.equal(kindReads(v).length, 0, `no kind read while ${JSON.stringify(state).slice(0, 40)}`)
  }
  v = viewer(); m = await mountT(ON, v, { composeJobs: [{ kind: 'refine', status: 'building', targetSlideId: 'outline-9', targetIndex: 5, targetLayoutIndex: 5 }, { kind: 'compose', status: 'building', targetIndex: 0 }] }); assert.equal(m.view().reason, null, 'a refine job on another slide, or an Add Slide compose, does not switch it off by itself here (the page\'s busy rule does that)')
  v = viewer(); m = await mountT(ON, v, { presenting: true }); assert.equal(m.view().visible, false, 'in Present it is not drawn'); assert.equal(v.calls.length, 0, 'and nothing is read')
  v = viewer(); m = await mountT(ON, v, { building: true }); m.set({ building: false }); await m.settle(); assert.equal(m.view().reason, null, 'the build ends: on again'); assert.equal(kindReads(v).length, 1, 'and the kind is read then')

  // the command on the wire: composeGetState then setSlideBackgroundPicture, inside the mutation scaffolding
  v = viewer({ hidden: ['image_free_0'] }); m = await mountT(ON, v)
  let outcome = await m.view().replace({ slideNumber: 1 }, { url: `  ${OK_URL}  `, alt: ' Harbour at dawn ' })
  deepEqual(v.calls.filter(c => c.action !== 'getTemplateSlotCatalog').map(c => [c.action, c.params, c.options]), [
    ['composeGetState', {}, { timeoutMs: 5000 }],
    ['setSlideBackgroundPicture', { slide_index: 0, slide_id: 'slide_00000001', url: OK_URL, alt: 'Harbour at dawn' }, { timeoutMs: 20000 }],
  ], 'the identity read, then the command: the contract\'s keys, the viewer\'s own slide id (never the rail\'s), the trimmed link and description, the 20 s budget')
  assert.ok(v.calls.every(c => c.iframe === FRAME), 'every command goes to the frame the mutation captured')
  deepEqual(outcome, { ok: true, hiddenCount: 1, words: 'Picture replaced.', note: 'A picture that covered the whole slide was hidden, not deleted. Restoring an earlier version of the deck brings it back.' })
  deepEqual(m.probe.begins, ['picture replacement']); assert.equal(m.probe.released, 1, 'the busy state is released once'); assert.equal(m.probe.after, 1, 'the rail and the other tabs are told once'); assert.equal(v.listeners.size, 0, 'the reply listener is removed'); assert.equal(v.added.length, 1); assert.equal(v.removed[0], v.added[0], 'the same listener')
  m.set({ currentSlide: 4 }); v.state.current = 3; await m.settle(); outcome = await m.view().replace({ slideNumber: 4 }, { url: OK_URL, alt: '' })
  deepEqual(v.commands().at(-1).params, { slide_index: 3, slide_id: 'slide_00000004', url: OK_URL }, 'slide 4: slide_index 3 and its id; no alt key when none was typed')
  // what each reply becomes: the reply message carries the code; the rejection carries text only
  for (const code of CONTRACT_CODES) {
    v = viewer({ command: failing(reply(code, { saved: code === 'REPAINT_FAILED' })) }); m = await mountT(ON, v)
    const got = await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' })
    assert.equal(got.ok, false); assert.equal(got.code, code, `${code}: from the reply message`); assert.equal(got.words, L.REPLACE_PICTURE_WORDS[code], `${code}: its words`); assert.ok(!JSON.stringify(got).includes('raw text'), `${code}: no raw text in the outcome`)
    assert.equal(m.probe.released, 1, `${code}: released`); assert.equal(m.probe.after, code === 'REPAINT_FAILED' ? 1 : 0, `${code}: the rail is refreshed only when the picture is stored`); assert.equal(v.listeners.size, 0, `${code}: listener removed`)
  }
  v = viewer({ command: failing({ success: false, action: 'setSlideBackgroundPicture', error: 'view-only' }) }); m = await mountT(ON, v)
  assert.equal((await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' })).code, 'VIEW_ONLY_PAGE', 'the guard\'s reply has no code: view-only')
  v = viewer({ command: failing({ success: false, action: 'setSlideBackgroundPicture', error: 'Unknown action: setSlideBackgroundPicture' }) }); m = await mountT(ON, v)
  assert.equal((await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' })).code, 'LAYOUT_SWITCH_OFF', 'Layout\'s flag off: unknown action')
  v = viewer({ command: failing(null, 'Command timeout') }); m = await mountT(ON, v)
  deepEqual(await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' }), L.failureOutcome('TIMED_OUT'), 'no reply at all: the timeout words'); assert.equal(m.probe.after, 0)
  v = viewer({ command: failing(reply('WRITE_FAILED'), 'Command failed') }); m = await mountT({ ...ON }, v, { isTrustedReply: () => false })
  assert.equal((await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' })).code, 'UNKNOWN', 'a reply message the viewer check does not trust is ignored (the words are the plain unknown ones)')
  v = viewer({ command: ({ win }) => { win.post(reply('WRITE_FAILED'), 'somewhere else'); win.post({ action: 'other', code: 'WRITE_FAILED' }); throw new Error('Command failed') } }); m = await mountT(ON, v)
  assert.equal((await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' })).code, 'UNKNOWN', 'a message from another window, or for another action, is not this command\'s reply')
  // a bad input is refused before the command goes out, and the identity read is the only thing sent
  v = viewer(); m = await mountT(ON, v); deepEqual(await m.view().replace({ slideNumber: 1 }, { url: 'http://a.test/a.jpg', alt: '' }), L.failureOutcome('INVALID_URL')); assert.equal(v.commands().length, 0); assert.equal(m.probe.released, 1)
  // the slide changed under the dialog: the viewer is on another slide
  v = viewer({ current: 4 }); m = await mountT(ON, v); deepEqual(await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' }), L.failureOutcome('SLIDE_CHANGED')); assert.equal(v.commands().length, 0, 'nothing is sent to the wrong slide'); assert.equal(m.probe.released, 1)
  v = viewer(); m = await mountT(ON, v); m.probe.begin = 'stale'; deepEqual(await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' }), L.failureOutcome('SLIDE_CHANGED'), 'the frame went away between the read and the send'); assert.equal(v.commands().length, 0); assert.equal(m.probe.released, 1)
  v = viewer({ orderFails: true }); m = await mountT(ON, v); await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' }); deepEqual(v.commands()[0].params, { slide_index: 0, url: OK_URL }, 'the identity read failed: the command goes without a slide_id (Layout writes to the slide at the index)')
  // the viewer is busy with another slide change: nothing is sent
  v = viewer(); m = await mountT(ON, v); m.probe.begin = 'none'; deepEqual(await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' }), L.failureOutcome('BUSY')); assert.equal(v.calls.filter(c => c.action !== 'getTemplateSlotCatalog').length, 0); assert.equal(m.probe.released, 0, 'nothing was taken, nothing is released')
  // a deck Layout refused as read-only stays off until another deck is opened
  for (const code of ['VIEW_ONLY_PAGE', 'READ_ONLY_SNAPSHOT']) {
    v = viewer({ command: failing(reply(code)) }); m = await mountT(ON, v); await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' }); await m.settle()
    assert.equal(m.view().reason, R.viewOnly, `${code}: the button goes off for this deck`)
    m.set({ presentationId: 'deck-2' }); await m.settle(); assert.equal(m.view().reason, null, `${code}: another deck, on again`)
  }
  v = viewer({ command: failing(reply('WRITE_FAILED')) }); m = await mountT(ON, v); await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' }); await m.settle(); assert.equal(m.view().reason, null, 'a failed write does not switch it off')
  v = viewer(); m = await mountT(ON, v, { presentationId: null }); assert.equal(m.view().reason, null, 'no deck id: nothing to compare, nothing wrongly refused')
  // the reload offer rides along
  const reload = () => {}; v = viewer(); m = await mountT(ON, v, { onReloadDeck: reload }); assert.equal(m.view().reloadDeck, reload)
  m.root.unmount()
}

// ============================================================================================================================================
// C. the control
// ============================================================================================================================================
const noIds = markup => markup.replace(/radix-_R_[A-Za-z0-9]+_/g, 'radix-ID').replace(/_R_[A-Za-z0-9]+_/g, 'ID')
function controlMarkup(props = {}, texts = {}) {
  const C = load(CONTROL, { env: ON, texts, react: React })
  return noIds(renderToStaticMarkup(h(C.ReplacePictureControl, { reason: null, slideNumber: 1, slideTitle: 'Title', onReplace: async () => ({}), buttonClassName: 'btn', labelClassName: 'lbl', ...props })))
}
function controlChecks(texts = {}) {
  const on = controlMarkup({}, texts)
  assert.ok(/<button[^>]*data-studio-replace-picture="trigger"[^>]*data-state="on"/.test(on) || /<button[^>]*data-state="on"[^>]*data-studio-replace-picture="trigger"/.test(on), 'the trigger is on'); assert.ok(!/<button[^>]*data-studio-replace-picture="trigger"[^>]*disabled/.test(on.replace(/aria-haspopup="dialog"/, '')), 'and not disabled')
  assert.ok(on.includes('>Replace picture<') && on.includes('class="btn"') && on.includes('class="lbl"'), 'it says Replace picture and wears the toolbar\'s classes'); assert.ok(on.includes('aria-haspopup="dialog"') && on.includes('data-slide="1"'))
  assert.ok(!on.includes('data-studio-replace-picture="dialog"') && !on.includes('role="dialog"'), 'the dialog is not drawn until it is opened'); assert.ok(!on.includes('data-studio-disabled-reason'), 'nothing says why when it is on')
  const off = controlMarkup({ reason: 'A build is running. Replace picture is available when it finishes.', slideNumber: 3 }, texts)
  assert.ok(/<button[^>]*disabled/.test(off) && /data-state="off"/.test(off), 'blocked: the button is disabled'); assert.ok(off.includes('data-studio-disabled-reason="true"') && off.includes('role="button"') && off.includes('aria-disabled="true"') && off.includes('tabindex="0"'), 'blocked: a keyboard tab stop that says so')
  assert.ok(off.includes('aria-label="Replace picture"') && /class="sr-only">A build is running\. Replace picture is available when it finishes\.</.test(off), 'blocked: the reason is read aloud'); assert.ok(off.includes('data-slide="3"'))
  // the source: only the outcome's own words reach a person; the dialog cannot be dismissed while it runs
  const src = texts[CONTROL] ?? read(CONTROL)
  assert.ok(!/outcome\.(error|message|detail|stage|status|raw)\b/.test(src) && !/\.message\b/.test(src), 'the control never reads a message, stage or status of the outcome')
  for (const field of ['words', 'note']) assert.ok(src.includes(`outcome.${field}`), `it shows outcome.${field}`)
  for (const needle of ['onEscapeKeyDown', 'onPointerDownOutside', 'onInteractOutside']) assert.ok(new RegExp(`${needle}=\\{event => \\{ if \\(running\\) event\\.preventDefault\\(\\) \\}\\}`).test(src), `${needle}: not while it runs`)
  assert.ok(/onOpenChange=\{next => \{ if \(!next && running\) return; setOpen\(next\) \}\}/.test(src), 'the close button cannot close it while it runs'); assert.ok(src.includes('REPLACE_PICTURE_TIMEOUT_MS / 1000'), 'the wait it names is the budget\'s')
  assert.ok(/outcome\.reload && onReloadDeck/.test(src) && /outcome\.retry/.test(src), 'Reload deck and Try again follow the outcome\'s own flags'); for (const action of ['cancel', 'replace', 'done', 'close', 'reload', 'retry']) assert.ok(src.includes(`data-action="${action}"`), `the ${action} action`)
  assert.ok(/role="alert"/.test(src) && /role="status"/.test(src) && /aria-live="polite"/.test(src), 'problems and progress are announced'); assert.ok(!/localStorage|sessionStorage|document\.cookie|fetch\(/.test(src), 'the control stores nothing and fetches nothing')
  assert.ok(src.includes('checkPictureUrl(url)') && src.includes('PICTURE_URL_PROBLEM_WORDS[checkedUrl.problem]'), 'a link is checked, in plain words, before anything is sent')
}

// ============================================================================================================================================
// D. the viewer's marked lines, and the bridge left alone
// ============================================================================================================================================
const lineWith = (text, needle) => { const hits = text.split('\n').filter(line => line.includes(needle)); assert.equal(hits.length, 1, `exactly one line holds ${JSON.stringify(needle)} (found ${hits.length})`); return hits[0] }
const functionText = (text, start, end) => { const a = text.indexOf(start), b = text.indexOf(end, a); assert.ok(a >= 0 && b > a, `${start} ... ${end}`); return text.slice(a, b) }
function viewerChecks(texts = {}) {
  const viewer0 = texts[VIEWER] ?? read(VIEWER), area = texts[AREA] ?? read(AREA), page = texts[PAGE] ?? read(PAGE)
  const call = lineWith(viewer0, 'const replacePicture = useStudioReplacePicture({')
  assert.match(call, /enabled: STUDIO_REPLACE_SLIDE_PICTURE_ENABLED && studioShell,/, 'the hook is enabled by the flag and the Studio shell, nothing else')
  assert.match(call, /deckOpen: Boolean\(approvedPresentationUrl && presentationId\),/); assert.match(call, /viewerReady: viewerIsReady,/); assert.match(call, /presenting: isFullscreen,/)
  assert.match(call, /building: Boolean\(isGenerating \|\| studioPartialArtifact\),/, 'a build: the generation overlay or a build filling the deck'); assert.match(call, /studioBusy: Boolean\(studioFormatBusy\),/, 'the page\'s own busy rule (the one the Format button uses)')
  assert.match(call, /composeJobs, mutationPending: isSlideMutationPending,/); assert.match(call, /templateMode: templateModeOn,/); assert.match(call, /tabPausedHint: studioTabPausedHint,/); assert.match(call, /activeVersion,/); assert.match(call, /frameUrl: approvedPresentationUrl,/)
  assert.match(call, /send: sendCommand,/, 'it sends through the viewer\'s own bridge'); assert.match(call, /begin: beginStudioNativeSlideMutation,/, 'inside the viewer\'s own slide-mutation scaffolding')
  assert.match(call, /isTrustedReply: \(event, frame\) => VIEWER_ORIGIN !== null && !LAYOUT_URL_CONFIG_ERROR && isTrustedLayoutViewerMessage\(event, frame, VIEWER_ORIGIN\),/, 'a reply message is trusted by the same origin and window check the bridge applies')
  assert.match(call, /afterReplace: \(\) => \{ reportDeckChange\('element'\); if \(presentationId\) onThumbnailInvalidatedRef\.current\?\.\(presentationId\); slideRailRefreshRef\.current\(\) \}/, 'after a stored picture: the other tabs, the rail\'s previews and its re-read')
  assert.match(call, /onReloadDeck: onReplacePictureReloadDeck \}\)/); assert.ok(!/localStorage|fetch\(|window\.|document\./.test(call), 'the call reaches for nothing global')
  const jsx = lineWith(viewer0, '<ReplacePictureControl ')
  assert.match(jsx, /\{replacePicture\.visible && <ReplacePictureControl /, 'the control is drawn only when the hook says visible (flag, shell, a built deck, not presenting)'); assert.match(jsx, /reason=\{replacePicture\.reason\}/); assert.match(jsx, /onReplace=\{replacePicture\.replace\}/); assert.match(jsx, /onReloadDeck=\{replacePicture\.reloadDeck\}/)
  assert.match(jsx, /buttonClassName=\{cn\(toolbarButtonClass, toolbarBtnBase\)\}/, 'it wears the toolbar\'s own classes'); assert.ok(viewer0.slice(0, viewer0.indexOf(jsx)).trimEnd().endsWith('</DropdownMenu>') && viewer0.slice(viewer0.indexOf(jsx) + jsx.length).trimStart().startsWith('{presentInStrip && (') && viewer0.indexOf(jsx) < viewer0.indexOf('const deliveryControls = ('), 'it is at the END of the authoring strip, after the Show menu and before Present: no earlier sibling\'s place moves, so the ids React generates for them are the base\'s')
  assert.match(lineWith(viewer0, 'onReplacePictureReloadDeck?: () => void'), /\/\/ REPLACE-PICTURE/); assert.match(lineWith(area, 'onReplacePictureReloadDeck={onReplacePictureReloadDeck}'), /\/\/ REPLACE-PICTURE/)
  const pageProp = lineWith(page, 'onReplacePictureReloadDeck={')
  assert.match(pageProp, /onReplacePictureReloadDeck=\{STUDIO_REPLACE_SLIDE_PICTURE_ENABLED && studioShell \? reloadDeckFromOtherTab : undefined\}/, 'the page passes its own Reload deck only with the flag on'); assert.ok(page.includes('const reloadDeckFromOtherTab = useCallback('), 'which exists')
  // the bridge is untouched, byte for byte: it still rejects with text only, for every command
  const bridge = text => functionText(text, 'function sendCommand(', 'function postCommand(')
  assert.equal(bridge(viewer0), bridge(baseText(VIEWER)), 'sendCommand is the base\'s, byte for byte'); assert.ok(bridge(viewer0).includes("reject(new Error(event.data.error || 'Command failed'))"))
  assert.equal(functionText(viewer0, 'function createViewerRequestId', 'function sendCommand('), functionText(baseText(VIEWER), 'function createViewerRequestId', 'function sendCommand('), 'and so is its request id')
}

const SSR_STUBS = {
  'next/navigation': { useRouter: () => ({ push() {}, replace() {}, refresh() {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/builder' },
  'next-auth/react': { useSession: () => ({ data: null, status: 'unauthenticated', update: async () => null }), signIn: async () => {}, signOut: async () => {}, SessionProvider: ({ children }) => children },
}
const SSR_URL = 'https://layout.uat.test/p/pres-1'
const SSR_ENVS = [['studio', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'https://layout.uat.test' }], ['studio + rail flags', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'https://layout.uat.test', NEXT_PUBLIC_STUDIO_RAIL_SLIDE_IDENTITY_ENABLED: 'true' }], ['studio + toolbar cleanup', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_TOOLBAR_CLEANUP: 'true', NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'https://layout.uat.test' }], ['classic', { NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'https://layout.uat.test' }]]
const SSR_DECKS = [['7 slides', { presentationUrl: SSR_URL, presentationId: 'pres-1', slideCount: 7 }], ['3 slides, thumbnails', { presentationUrl: SSR_URL, presentationId: 'pres-1', slideCount: 3, thumbnailUrlsBySlide: { 1: 'https://proj.test/a.png' } }],
  ['compose job', { presentationUrl: SSR_URL, presentationId: 'pres-1', slideCount: 2, composeJobs: [{ jobId: 'j1', targetIndex: 1, targetLayoutIndex: 1, status: 'building', lastProgressText: 'Writing' }] }], ['no slide count', { presentationUrl: SSR_URL, presentationId: 'pres-1' }]]
const quiet = fn => { const e = console.error, w = console.warn; console.error = console.warn = () => {}; try { return fn() } finally { console.error = e; console.warn = w } }
/** The REAL viewer, server-rendered, with the viewer's own text replaced by `viewerText` (the base's, or a mutant). Every other module is the working tree's. */
function viewerMarkup(env, props, viewerText, tag) {
  const Viewer = load(VIEWER, { env, texts: { [VIEWER]: viewerText }, stubs: SSR_STUBS, id: `ssr-${tag}` }).PresentationViewer
  return quiet(() => renderToStaticMarkup(h(Viewer, props)))
}
function markupChecks(texts = {}) {
  const now = texts[VIEWER] ?? read(VIEWER), base = baseText(VIEWER)
  for (const [envName, env] of SSR_ENVS) for (const [deck, props] of SSR_DECKS) {
    const want = viewerMarkup(env, props, base, `base-${envName}`), got = viewerMarkup(env, props, now, `work-${envName}-${now === read(VIEWER) ? 'a' : 'b'}`)
    assert.ok(want.length > 1000, `${envName}, ${deck}: a real render`)
    assert.equal(got, want, `${envName}, ${deck}: flag off, the viewer's server markup is the base viewer's, byte for byte`)
  }
}

// ============================================================================================================================================
// E. the sources
// ============================================================================================================================================
const SECRET = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-|glpat[-])/
/** The lines added to and removed from `was` to make `now` (a multiset difference by line). */
function lineDiff(was, now) {
  const count = new Map(); for (const line of was.split('\n')) count.set(line, (count.get(line) || 0) + 1)
  const added = []; for (const line of now.split('\n')) { const n = count.get(line) || 0; if (n > 0) count.set(line, n - 1); else added.push(line) }
  const removed = []; for (const [line, n] of count) for (let i = 0; i < n; i++) removed.push(line)
  return { added, removed }
}
/** What the strips of the changes registered AFTER this one do to a text (they are other changes' lines and stay when only this strip runs). */
const laterStrips = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }
const laterEnv = text => { const blocks = registry.LATER_ENV_BLOCKS, at = blocks.indexOf(ENV_BLOCK); return (at === -1 ? [] : blocks.slice(at + 1)).reduce((out, later) => out.replace(`\n${later}`, ''), text) }
const TEXTS = Object.fromEntries([...APP_FILES, ...NEW_FILES, ...stripModule.REPLACE_PICTURE_PIN_FILES, '.env.example', REGISTRY].map(rel => [rel, read(rel)]))

function sourceChecks(texts, mod = stripModule) {
  const strip = mod.stripReplacePicture, edits = mod.REPLACE_PICTURE_EDITS, files = mod.REPLACE_PICTURE_FILES, block = mod.REPLACE_PICTURE_ENV_BLOCK
  // the strip gives each touched file its base back (past the changes registered after this one), byte for byte, and is idempotent
  for (const rel of files) {
    const now = laterStrips(rel, texts[rel]), out = strip(rel, now)
    assert.equal(out, baseText(rel), `${rel}: without this change's edits the file is the base's, byte for byte`)
    assert.equal(strip(rel, out), out, `${rel}: stripping twice changes nothing more`); assert.notEqual(now, baseText(rel), `${rel}: the change is there to strip`)
  }
  for (const rel of ['components/builder/message-list.tsx', '.env.example', REGISTRY]) assert.equal(strip(rel, 'x\nREPLACE-PICTURE\n'), 'x\nREPLACE-PICTURE\n', `${rel}: a file this change does not own comes back as it is`)
  assert.equal(strip(files[0], 5), 5, 'a text that is not a string comes back as it is')
  // every line a file gains carries the marker and is a pure insertion: no base line is lost, none is rewritten (so flag off, the source is the base's)
  for (const rel of files) {
    const mine = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), mine)
    for (const line of diff.added) assert.match(line, MARKER_RE, `${rel}: a line added to the file carries the marker: ${line.trim().slice(0, 100)}`)
    assert.deepEqual(diff.removed, [], `${rel}: no base line is lost or rewritten`)
    assert.equal(diff.added.length, edits[rel].length, `${rel}: one marked line per edit`)
    for (const [has, was] of edits[rel]) assert.ok(was === '' && MARKER_RE.test(has) && has.endsWith('\n') && !has.slice(0, -1).includes('\n'), `${rel}: a pair is one marked line and nothing put back`)
  }
  // the older proofs this change teaches: each gains only marked lines and loses none, and is the base's without them
  for (const rel of mod.REPLACE_PICTURE_PIN_FILES) {
    const now = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), now), gained = mod.REPLACE_PICTURE_PIN_EDITS[rel].length
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's lines the proof is the base's, byte for byte`); assert.equal(strip(rel, strip(rel, now)), baseText(rel), `${rel}: putting back twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, gained], `${rel}: the proof gains ${gained} marked line(s) and loses none`)
    for (const line of diff.added) assert.ok(line.includes(mod.REPLACE_PICTURE_PIN_MARK), `${rel}: a line added to the proof carries the pin mark: ${line.trim().slice(0, 100)}`)
    for (const line of diff.added.filter(added => added.includes('shas.splice'))) assert.ok(line.includes('^Replace picture:'), `${rel}: the splice names this change's own subject`)
    for (const line of diff.added.filter(added => added.includes('fs.readFileSync = '))) assert.ok(line.includes('stripReplacePicture(rel, out)') && !line.includes('stripLaterChanges') && !line.includes('registry.'), `${rel}: a read hook uses this change's own strip, never the registry`)
  }
  // the new libs: one literal env read, and nothing else reads the flag
  for (const [rel, flag] of mod.REPLACE_PICTURE_LIB_FLAGS) {
    assert.equal((texts[rel].match(new RegExp(`process\\.env\\.${flag}\\b`, 'g')) || []).length, 1, `${rel} reads the literal env name ${flag} once`)
    for (const other of [...files, ...mod.REPLACE_PICTURE_NEW_FILES.filter(f => /^(hooks|components)\//.test(f))]) assert.equal((texts[other] || '').includes(`process.env.${flag}`), false, `${other} does not read ${flag} itself`)
    assert.ok(!/process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL/.test(texts[rel]), `${rel} leaves the Studio shell to the viewer (one flag, one read)`)
  }
  assert.deepEqual([...texts[LIB].matchAll(/^import .*$/gm)].map(m => m[0]), [], 'the lib is import-free'); assert.ok(!/\bfetch\(|localStorage|sessionStorage|XMLHttpRequest|WebSocket/.test(texts[LIB]), 'the lib touches no network and no storage')
  assert.deepEqual([...texts[HOOK].matchAll(/from '([^']+)'/g)].map(m => m[1]), ['react', '@/lib/studio-replace-picture'], 'the hook imports React and the lib only')
  assert.ok(!/\bfetch\(|localStorage|sessionStorage|XMLHttpRequest|WebSocket|postMessage/.test(texts[HOOK]), 'the hook sends nothing itself: the viewer\'s bridge does')
  // .env.example: the base plus the block (after one blank line, past the blocks registered after this one); the flag documented "false", once
  assert.equal(laterEnv(texts['.env.example']), `${baseText('.env.example')}\n${block}`, '.env.example is the base plus the block')
  for (const flag of mod.REPLACE_PICTURE_FLAGS) {
    assert.match(block, new RegExp(`^${flag}="false"$`, 'm'), `the block documents ${flag} as "false"`)
    assert.equal((texts['.env.example'].match(new RegExp(`^${flag}=`, 'gm')) || []).length, 1, `.env.example assigns ${flag} once`)
  }
  assert.ok(block.endsWith('\n') && block.split('\n').filter(line => line && !line.startsWith('#')).length === mod.REPLACE_PICTURE_FLAGS.length, 'the block is comments and one assignment per flag')
  for (const word of ['LAYOUT_SLIDE_BACKGROUND_PICTURE_ENABLED', 'LAYOUT_SLIDES_PUT_STALE_GUARD_ENABLED', 'LAYOUT_STORAGE_TO_THREAD_ENABLED', 'NEXT_PUBLIC_STUDIO_V4_SHELL']) assert.ok(block.includes(word), `the block names ${word}`)
  // secrets, in everything this change adds
  for (const rel of [...files, ...mod.REPLACE_PICTURE_NEW_FILES, '.env.example']) assert.doesNotMatch(texts[rel] ?? read(rel), SECRET, `${rel}: no secret`)
  // the css: every rule is scoped to this dialog
  const css = texts[CSS] ?? read(CSS)
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map(r => r.split('{')[0].trim()).filter(Boolean)) {
    if (rule.startsWith('@')) continue
    assert.ok(/^(\.dark )?\[data-studio-replace-picture=/.test(rule) || /^\d+%/.test(rule) || /^(from|to)$/.test(rule), `a rule that only reaches this dialog's own markup: ${rule}`)
  }
}
function registryChecks(text, texts = TEXTS) {
  const { REPLACE_PICTURE_SCOPE_FILES: scope } = stripModule
  for (const list of ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS']) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const rows = text.slice(start, end).split('\n').filter(Boolean)
    const reference = { LATER_CHANGE_FILES: 'studio-ingest-status-comment-strip.mjs', LATER_ENV_BLOCKS: 'studio-connectors-session-links-strip.mjs', LATER_STRIPS: 'studio-sessions-owner-strip.mjs' }[list]
    const own = rows.findIndex(line => line.includes('studio-replace-picture-strip.mjs')), before = rows.findIndex(line => line.includes(reference))
    assert.ok(own > before && before > 0, `${list}: this change's line comes after ${reference} (the last one before it when this was written; a later change's line may follow)`)
    assert.equal((text.slice(start, end).match(/studio-replace-picture-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-replace-picture-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines'); assert.ok(registered.every(line => line.includes('// LATER-CHANGE: FRONTEND-1, M10 Replace picture')), 'each carries the registry marker')
  assert.deepEqual(lineDiff(baseText(REGISTRY), text).removed, [], 'and loses none')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(ENV_BLOCK), 'the block is registered')
  assert.ok([...scope].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  for (const rel of APP_FILES) assert.equal(registry.stripLaterChanges(rel, texts[rel]), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is the base's (older proofs read it like that)`)
  assert.equal(FLAGS.some(flag => registry.stripLaterEnvBlocks('.env.example', texts['.env.example']).includes(flag)), false, 'the registry takes the block out of .env.example')
}
const isOwnCommit = subject => subject.startsWith(SUBJECT)
function ownCommits(ref = 'HEAD') { return git('rev-list', '--no-merges', `${BASE_COMMIT}..${ref}`).split('\n').filter(Boolean).filter(commit => isOwnCommit(git('log', '-1', '--format=%s', commit))) }
function touchedFiles(commits) { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(commit => git('show', '--name-only', '--format=', commit).split('\n')).filter(rel => rel && net.has(rel))) }
function scopeCheck(commits, extra = []) { assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !SCOPE.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base') }
function messageProblems(subject, body) { const problems = []; if (!subject.startsWith(SUBJECT)) problems.push(`the subject starts "${SUBJECT}"`); if (!/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line'); return problems }

// ============================================================================================================================================
// run
// ============================================================================================================================================
await check('A. the lib: the flag, the command and its budget, Layout\'s URL rule, the params, every code\'s words, the failure reader, the runner, the reasons', () => libChecks())
await check('B. the hook (REAL, in the offline React host): flag off, the kind read, every disabled state, the command on the wire, every reply, the slide changing, a refused deck', () => hookChecks())
await check('C. the control: the trigger\'s markup and the dialog\'s source', () => controlChecks())
await check('D. the viewer\'s marked lines; the bridge is the base\'s, byte for byte', () => viewerChecks())
await check('D2. flag off: the REAL viewer\'s server markup is the base viewer\'s, byte for byte (4 environments x 4 decks)', () => markupChecks())
await check('E1. the sources: markers, the strip, the libs, .env.example, secrets, the css', () => sourceChecks(TEXTS))
await check('E2. the registry (three lines, at the true ends)', () => registryChecks(TEXTS[REGISTRY]))
await check('E3. scope, from the COMMITTED diff only; the commits', () => {
  const commits = ownCommits(); assert.ok(commits.length >= 1, 'this change has commits of its own')
  scopeCheck(commits)
  for (const commit of commits) assert.deepEqual(messageProblems(git('log', '-1', '--format=%s', commit), git('log', '-1', '--format=%B', commit)), [], `commit ${commit.slice(0, 8)}`)
})
await check('F. the flag is read from one literal env name', () => { assert.equal((TEXTS[LIB].match(new RegExp(`process\\.env\\.${FLAG}\\b`, 'g')) || []).length, 1) })

// ---- G. mutants: one edit of the real sources each, fed to the same checks ------------------------------------------------------------------------------------------------------------
const TEXT = { [LIB]: read(LIB), [HOOK]: read(HOOK), [CONTROL]: read(CONTROL), [VIEWER]: read(VIEWER), [AREA]: read(AREA), [PAGE]: read(PAGE) }
const M = (rel, from, to) => ({ [rel]: swap(TEXT[rel], from, to) })
const MUTANTS = [
  // command shape
  ['lib: the command is renamed', M(LIB, "export const REPLACE_PICTURE_COMMAND = 'setSlideBackgroundPicture'", "export const REPLACE_PICTURE_COMMAND = 'setSlideBackground'"), libChecks],
  ['lib: the budget is 10 s', M(LIB, 'export const REPLACE_PICTURE_TIMEOUT_MS = 20_000', 'export const REPLACE_PICTURE_TIMEOUT_MS = 10_000'), libChecks],
  ['lib: the params use camelCase keys', M(LIB, "{ slide_index: index, ...(typeof id === 'string' ? { slide_id: id } : {}), url: url.url,", "{ slideIndex: index, ...(typeof id === 'string' ? { slide_id: id } : {}), url: url.url,"), libChecks],
  ['lib: the alt is sent empty', M(LIB, '...(alt.alt !== null ? { alt: alt.alt } : {})', '...(alt.alt !== undefined ? { alt: alt.alt } : {})'), libChecks],
  ['lib: the slide id is dropped from the params', M(LIB, "...(typeof id === 'string' ? { slide_id: id } : {}), ", ''), libChecks],
  ['lib: the runner sends the raw input', M(LIB, '{ ...built.params }, { timeoutMs: REPLACE_PICTURE_TIMEOUT_MS }', '{ slide_index: input.slideIndex, url: input.url, alt: input.alt }, { timeoutMs: REPLACE_PICTURE_TIMEOUT_MS }'), libChecks],
  ['lib: the runner sends without checking the input', M(LIB, "  if (!built.ok) return failureOutcome(built.code)\n  try {", '  try {'), libChecks],
  // the URL rule
  ['lib: http is accepted', M(LIB, "if (url.slice(0, 8).toLowerCase() !== 'https://') return { ok: false, problem: 'not-https' }", ''), libChecks],
  ['lib: a link with a space is accepted', M(LIB, 'const URL_UNSAFE = /[^\\x21-\\x7e]|["\'`\\\\<>()[\\]{}]/', 'const URL_UNSAFE = /["\'`\\\\<>()[\\]{}]/'), libChecks],
  ['lib: user info is accepted', M(LIB, "if (!authority || authority.includes('@')) return", "if (!authority) return"), libChecks],
  ['lib: the length limit is 4096', M(LIB, 'export const REPLACE_PICTURE_URL_MAX = 2048', 'export const REPLACE_PICTURE_URL_MAX = 4096'), libChecks],
  ['lib: a bad port is accepted', M(LIB, "    } catch {\n      return { ok: false, problem: 'unusable' }\n    }", '    } catch {\n    }'), libChecks],
  ['lib: the alt limit is 1000', M(LIB, 'export const REPLACE_PICTURE_ALT_MAX = 500', 'export const REPLACE_PICTURE_ALT_MAX = 1000'), libChecks],
  // the codes and their words
  ['lib: a code has no words', M(LIB, "  SLIDE_CHANGED: 'This slide changed while you were working (it moved or was rebuilt). Select it again and try again.',\n", ''), libChecks],
  ['lib: a code of the contract is dropped', M(LIB, "'SLIDE_CHANGED', 'NO_BACKGROUND_PICTURE', 'PICTURE_DECLINED', 'SLIDE_INDEX_OUT_OF_RANGE',\n]", "'SLIDE_CHANGED', 'NO_BACKGROUND_PICTURE', 'PICTURE_DECLINED',\n]"), libChecks],
  ['lib: a word table shows the raw code', M(LIB, "  WRITE_FAILED: 'The picture could not be saved. Nothing changed. Try again in a moment.',", "  WRITE_FAILED: 'WRITE_FAILED: the store failed (500).',"), libChecks],
  ['lib: REPAINT_FAILED does not say it is saved', M(LIB, "REPAINT_FAILED: 'The new picture is saved, but the slide could not redraw it. Reload the deck to see it.',", "REPAINT_FAILED: 'The picture could not be shown. Try again in a moment.',"), libChecks],
  ['lib: the timeout does not say it may be saved', M(LIB, 'The picture may or may not have been saved. ', ''), libChecks],
  ['lib: REPAINT_FAILED offers Try again', M(LIB, "  'REPAINT_FAILED', 'READ_ONLY_SNAPSHOT', 'VIEW_ONLY_PAGE', 'NOT_AUTHORIZED',", "  'READ_ONLY_SNAPSHOT', 'VIEW_ONLY_PAGE', 'NOT_AUTHORIZED',"), libChecks],
  ['lib: REPAINT_FAILED does not offer Reload deck', M(LIB, "  'REPAINT_FAILED', 'TIMED_OUT', 'VIEWER_UNAVAILABLE',", "  'TIMED_OUT', 'VIEWER_UNAVAILABLE',"), libChecks],
  ['lib: REPAINT_FAILED is not stored', M(LIB, "code === 'REPAINT_FAILED' || saved", 'saved'), libChecks],
  ['lib: the guard\'s "view-only" is unknown', M(LIB, "if (/^view-only$/i.test(message.trim())) return { code: 'VIEW_ONLY_PAGE', stored: false }\n", ''), libChecks],
  ['lib: an unknown action is unknown', M(LIB, "if (/^unknown action/i.test(message.trim())) return { code: 'LAYOUT_SWITCH_OFF', stored: false }\n", ''), libChecks],
  ['lib: a timeout is unknown', M(LIB, "if (/command timeout/i.test(message)) return { code: 'TIMED_OUT', stored: false }\n", ''), libChecks],
  ['lib: the reply\'s code is ignored', M(LIB, 'const code = seen && typeof seen.code === \'string\' ? seen.code : null', 'const code = null'), libChecks],
  ['lib: success is anything truthy', M(LIB, 'if (value && value.success === true) {', 'if (value && value.success) {'), libChecks],
  ['lib: a note is never made', M(LIB, 'if (!Number.isInteger(count) || count < 1) return null', 'return null'), libChecks],
  // when it is off
  ['lib: a build does not switch it off', M(LIB, '  if (a.building) return REPLACE_PICTURE_REASONS.building\n', ''), libChecks],
  ['lib: a regenerate does not switch it off', M(LIB, '  if (a.regeneratingThisSlide) return REPLACE_PICTURE_REASONS.regenerating\n', ''), libChecks],
  ['lib: a read-only deck is not switched off', M(LIB, "  if (a.readOnly === 'view-only') return REPLACE_PICTURE_REASONS.viewOnly\n", ''), libChecks],
  ['lib: the outline preview is not switched off', M(LIB, "  if (a.readOnly === 'preview') return REPLACE_PICTURE_REASONS.preview\n", ''), libChecks],
  ['lib: a content slide is on', M(LIB, "  if (a.slideKind === 'other') return REPLACE_PICTURE_REASONS.notHero\n", ''), libChecks],
  ['lib: any layout is a hero', M(LIB, "return /^H\\d/i.test(canvasType.trim()) ? 'hero' : 'other'", "return 'hero'"), libChecks],
  ['lib: a refine job matches any slide', M(LIB, 'return job.targetLayoutIndex === slide.slideIndex || job.targetIndex === slide.slideIndex', 'return true'), libChecks],
  ['lib: the reasons are in another order', M(LIB, "  if (a.building) return REPLACE_PICTURE_REASONS.building\n  if (a.regeneratingThisSlide) return REPLACE_PICTURE_REASONS.regenerating\n", "  if (a.regeneratingThisSlide) return REPLACE_PICTURE_REASONS.regenerating\n  if (a.building) return REPLACE_PICTURE_REASONS.building\n"), libChecks],
  // the hook
  ['hook: it reads and sends with the flag off', M(HOOK, '  const live = input.enabled && input.deckOpen && input.viewerReady && !input.presenting', '  const live = input.deckOpen && input.viewerReady && !input.presenting'), hookChecks],
  ['hook: it is drawn with the flag off', M(HOOK, '    visible: input.enabled && input.deckOpen && !input.presenting,', '    visible: input.deckOpen && !input.presenting,'), hookChecks],
  ['hook: it is drawn in Present', M(HOOK, '    visible: input.enabled && input.deckOpen && !input.presenting,', '    visible: input.enabled && input.deckOpen,'), hookChecks],
  ['hook: it reads the kind while a build runs', M(HOOK, '    if (!live || busy) return\n', '    if (!live) return\n'), hookChecks],
  ['hook: the kind is read for the wrong slide', M(HOOK, "{ slideIndex }, { timeoutMs: 8000 }", "{ slideIndex: 0 }, { timeoutMs: 8000 }"), hookChecks],
  ['hook: the identity read is skipped', M(HOOK, "      try {\n        const identity = slideIdentityFromOrder(await now.send(mutation.iframe, REPLACE_PICTURE_ORDER_COMMAND, {}, { timeoutMs: 5000 }), index)", "      try {\n        const identity = slideIdentityFromOrder(null, index)"), hookChecks],
  ['hook: the rail\'s slide id is sent', M(HOOK, '        slideId = identity.slideId\n', '        slideId = latest.current.railSlideId\n'), hookChecks],
  ['hook: a slide that moved is written anyway', M(HOOK, "        if (identity.onSlide === false) return failureOutcome('SLIDE_CHANGED')\n", ''), hookChecks],
  ['hook: a stale frame is written anyway', M(HOOK, "      if (!mutation.isCurrent()) return failureOutcome('SLIDE_CHANGED')\n      // The bridge", "      // The bridge"), hookChecks],
  ['hook: the busy state is never taken', M(HOOK, "    const mutation = now.begin('picture replacement')\n    if (!mutation) return failureOutcome('BUSY')", "    const mutation = { iframe: now.getIframe(), isCurrent: () => true, release: () => {} }"), hookChecks],
  ['hook: the busy state is not released', M(HOOK, '    } finally {\n      mutation.release()\n    }', '    } finally {\n    }'), hookChecks],
  ['hook: the reply listener is left on', M(HOOK, "      } finally {\n        window.removeEventListener('message', watch)\n      }", '      } finally {\n      }'), hookChecks],
  ['hook: any message is taken for the reply', M(HOOK, "data.action === REPLACE_PICTURE_COMMAND && now.isTrustedReply(event, frame)", "data.action === REPLACE_PICTURE_COMMAND"), hookChecks],
  ['hook: the reply message is not read', M(HOOK, 'observed: () => reply }', 'observed: () => null }'), hookChecks],
  ['hook: the rail is refreshed after a failure', M(HOOK, '      if (outcome.ok || outcome.stored) { if (mutation.isCurrent()) latest.current.afterReplace() }', '      if (true) { if (mutation.isCurrent()) latest.current.afterReplace() }'), hookChecks],
  ['hook: a stored picture does not refresh the rail', M(HOOK, '      if (outcome.ok || outcome.stored) {', '      if (outcome.ok) {'), hookChecks],
  ['hook: a refused deck stays on', M(HOOK, '      else if (isReadOnlyPictureCode(outcome.code)) setRefused(latest.current.presentationId)\n', ''), hookChecks],
  ['hook: a refusal outlives its deck', M(HOOK, '(refused !== null && refused === input.presentationId)', '(refused !== null)'), hookChecks],
  ['hook: the outline preview is not read-only', M(HOOK, "    : input.activeVersion === 'strawman' ? 'preview' as const : null", '    : null'), hookChecks],
  ['hook: the page\'s busy rule is ignored', M(HOOK, '    studioBusy: input.studioBusy,\n', '    studioBusy: false,\n'), hookChecks],
  ['hook: a fallback title is shown as a name', M(HOOK, "input.railSlideTitle && !/^Slide \\d+$/i.test(input.railSlideTitle.trim()) ? input.railSlideTitle.trim() : null", 'input.railSlideTitle'), hookChecks],
  // the control
  ['control: the dialog can be closed while it runs', M(CONTROL, '          onEscapeKeyDown={event => { if (running) event.preventDefault() }}\n', ''), controlChecks],
  ['control: the close button works while it runs', M(CONTROL, 'if (!next && running) return; setOpen(next)', 'setOpen(next)'), controlChecks],
  ['control: a raw message is shown', M(CONTROL, '<p data-studio-replace-picture="words">{outcome.words}</p>\n            </div>\n          )}', '<p data-studio-replace-picture="words">{outcome.words} {(outcome as { message?: string }).message}</p>\n            </div>\n          )}'), controlChecks],
  ['control: Reload deck is always offered', M(CONTROL, '{outcome.reload && onReloadDeck && (', '{onReloadDeck && ('), controlChecks],
  ['control: the link is not checked in the form', M(CONTROL, '    const checkedUrl = checkPictureUrl(url)', '    const checkedUrl = { ok: true as const, url }'), controlChecks],
  ['control: the trigger is not disabled', M(CONTROL, '          disabled={blocked}\n', ''), controlChecks],
  ['control: the reason is not a tab stop', M(CONTROL, '<StudioDisabledReason reason={reason} label="Replace picture"', '<StudioDisabledReason reason={null} label="Replace picture"'), controlChecks],
  ['control: it stores the link', M(CONTROL, '    setUrl("")\n    setAlt("")\n', '    localStorage.setItem("u", url)\n    setAlt("")\n'), controlChecks],
  // the viewer's lines
  ['viewer: the flag alone enables it (no shell)', M(VIEWER, 'enabled: STUDIO_REPLACE_SLIDE_PICTURE_ENABLED && studioShell,', 'enabled: STUDIO_REPLACE_SLIDE_PICTURE_ENABLED,'), viewerChecks],
  ['viewer: the build rule is dropped', M(VIEWER, 'building: Boolean(isGenerating || studioPartialArtifact),', 'building: false,'), viewerChecks],
  ['viewer: the page\'s busy rule is dropped', M(VIEWER, 'studioBusy: Boolean(studioFormatBusy),', 'studioBusy: false,'), viewerChecks],
  ['viewer: it sends outside the bridge', M(VIEWER, ' send: sendCommand,', ' send: (frame, action, params) => frame!.contentWindow!.postMessage({ action, params }, "*") as never,'), viewerChecks],
  ['viewer: the control is drawn whatever the hook says', M(VIEWER, '{replacePicture.visible && <ReplacePictureControl ', '{true && <ReplacePictureControl '), viewerChecks],
  ['viewer: the bridge is edited', M(VIEWER, "            reject(new Error(event.data.error || 'Command failed'))\n", "            reject(new Error(event.data.error || 'Command failed')) // edited\n"), viewerChecks],
  ['viewer: the reply trust check is dropped', M(VIEWER, 'isTrustedReply: (event, frame) => VIEWER_ORIGIN !== null && !LAYOUT_URL_CONFIG_ERROR && isTrustedLayoutViewerMessage(event, frame, VIEWER_ORIGIN),', 'isTrustedReply: () => true,'), viewerChecks],
  ['viewer: the control is a child in the middle of the strip (older siblings\' generated ids move)', { [VIEWER]: (() => { const line = TEXT[VIEWER].split('\n').find(l => l.includes('<ReplacePictureControl ')); const moved = TEXT[VIEWER].replace(line + '\n', ''); return swap(moved, '              {/* Template — "Save as Template"', line + '\n              {/* Template — "Save as Template"') })() }, markupChecks],
  ['page: the reload is passed without the flag', M(PAGE, 'onReplacePictureReloadDeck={STUDIO_REPLACE_SLIDE_PICTURE_ENABLED && studioShell ? reloadDeckFromOtherTab : undefined}', 'onReplacePictureReloadDeck={reloadDeckFromOtherTab}'), viewerChecks],
]
for (const [label, texts, fn] of MUTANTS) await mutant(label, () => fn(texts))
// source mutants: a marker lost, a base line lost, the flag read twice, a secret, the env block edited, the registry line gone, a stray file, a missing co-author line
await mutant('sources: a marked line loses its marker', () => sourceChecks({ ...TEXTS, [VIEWER]: swap(TEXTS[VIEWER], "import { useStudioReplacePicture } from '@/hooks/use-studio-replace-picture' // REPLACE-PICTURE\n", "import { useStudioReplacePicture } from '@/hooks/use-studio-replace-picture'\n") }))
await mutant('sources: a base line is lost', () => sourceChecks({ ...TEXTS, [VIEWER]: swap(TEXTS[VIEWER], "const DEFAULT_BUILD_THEME_SELECTION: BuildThemeSelection = { mode: 'auto' }\n", '') }))
await mutant('sources: a base line is rewritten', () => sourceChecks({ ...TEXTS, [VIEWER]: swap(TEXTS[VIEWER], "            reject(new Error(event.data.error || 'Command failed'))\n", "            reject(new Error(String(event.data.error || 'Command failed')))\n") }))
await mutant('sources: another file reads the flag', () => sourceChecks({ ...TEXTS, [PAGE]: `${TEXTS[PAGE]}const x = process.env.${FLAG}\n` }))
await mutant('sources: a secret', () => sourceChecks({ ...TEXTS, [LIB]: `${TEXTS[LIB]}\n// sk-${'a'.repeat(24)}\n` }))
await mutant('sources: the lib imports something', () => sourceChecks({ ...TEXTS, [LIB]: `import { x } from './y'\n${TEXTS[LIB]}` }))
await mutant('sources: the env block is edited', () => sourceChecks({ ...TEXTS, '.env.example': swap(TEXTS['.env.example'], `${FLAG}="false"`, `${FLAG}="true"`) }))
await mutant('sources: a css rule reaches outside the dialog', () => sourceChecks({ ...TEXTS, [CSS]: `${TEXTS[CSS]}\nbutton { color: red; }\n` }))
await mutant('sources: the registry line is gone', () => registryChecks(swap(TEXTS[REGISTRY], "  (await import('./studio-replace-picture-strip.mjs')).stripReplacePicture, // LATER-CHANGE: FRONTEND-1, M10 Replace picture (NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE)\n", '')))
await mutant('scope: a stray file', () => scopeCheck(ownCommits(), ['components/builder/message-list.tsx']))
await mutant('commit: no co-author line', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'a body\n'), []))
await mutant('commit: another subject', () => assert.deepEqual(messageProblems('Fix a thing', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), []))

console.log(`\n${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`FAILED: ${failed.join('; ')}`); if (missed.length) console.error(`MISSED: ${missed.join('; ')}`); process.exit(1) }
process.exit(0)
