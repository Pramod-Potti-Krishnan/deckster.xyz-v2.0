// FRONTEND-1: proof of Replace picture (PK mandate M10 of 15 Nov 2026: after return, decks stay editable, especially the pictures on title, section and closing slides). Flag NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE, only the exact
// string "true", default off; it acts only in the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL). The Layout half is SLIDE-4's Draft !294 (viewer command setSlideBackgroundPicture, docs/api/SLIDE_BACKGROUND_PICTURE.md).
//
//   node scripts/test-studio-replace-picture.mjs        (plain node, offline: the REAL sources transpiled and run in a vm; the REAL hook runs in the offline React host (scripts/studio-chat-harness/mini-react.mjs) against a viewer double
//                                                        that answers the way the contract says; react-dom/server for the markup; git is read for the strips, the registry and the scope; no network, no browser, no .next)
//
// What it proves (A to F), then mutants (G):
//  A. the lib: the flag (exact "true" only), the command and its 20 s budget, Layout's URL rule (a table of links that must pass and fail), the params (the contract's keys, in its order), every code of the contract
//     (the 20 Layout codes + Studio's four) has plain words, which codes offer Reload deck and Try again, the failure reader (the reply's code first; the guard's "view-only", "Unknown action", a timeout, no frame), the runner
//     (one send of {action, params, timeoutMs}, never throws, no send on a bad input), the disabled reasons and their order, the refine-job match, the read-only URL;
//  B. THE COMMAND, from the REAL hook in the offline React host: flag off (nothing read, nothing sent, nothing drawn); the slide's eligibility read once per slide; for every disabled state the reason and no send; the command shape on the wire
//     (composeGetState {} then setSlideBackgroundPicture {slide_index, slide_id, url, alt} with timeoutMs 20000), the busy scaffolding (begin / release once), what each reply becomes (a reply message watched for its code: the bridge
//     rejects with text only), the slide changing under the dialog, a refused deck staying off, an untrusted reply ignored, the listener removed;
//  C. the control: the trigger's markup (enabled, disabled with its reason as a tab stop), and its source: it shows only the outcome's own words, the dialog cannot be closed while it runs;
//  D. the viewer's marked lines: the hook call, the one JSX line (at the END of the authoring strip, after Show and before Present, so no older sibling's place moves), the prop; the bridge (sendCommand) is untouched, byte for byte; and with the flag off the REAL viewer's
//     server markup is the base viewer's, byte for byte, in four environments and four decks (React's generated ids included: they move when a child is added in the middle of a list);
//  E. the sources: markers, the strip gives each touched file its base back byte for byte, the registry (three lines, at the true ends), .env.example, secrets, the css, scope (from the COMMITTED diff only), the commits;
//  F. the lib reads the flag from one literal env name and nothing else reads it.
//  H. THE LAYOUT !296 FOLLOW-UP (same flag; docs/api/SLIDE_BACKGROUND_PICTURE.md at Layout Draft !296, head 26283304): eligibility up front (getTemplateSlotCatalog's backgroundPicture: eligible, each reason, a slide that is not listed,
//     NO key, a malformed one, a failed read -> the button on / greyed with plain words; Layout decides instead of the hero guess), progress (the viewer's interim events matched on commandRequestId by the REAL hook; an untrusted, foreign,
//     out-of-order or reply-shaped event ignored; the REAL sendCommand, extracted from the viewer and run, never settles on one), the dialog's stage words, the allow-list left alone;
//  I. REVIEW-1's P2 and P3s on #636 (2159e182): the slide on screen is found in the viewer's order by its visual position (placeholders counted), and ITS layout_index and slide_id are sent, with its layout_index picking the eligibility entry; a placeholder on
//     screen greys the button; the dialog is bound to the slide's id when it opens and Replace refuses (SLIDE_CHANGED, nothing sent) when the viewer moved or the id there changed; the reason is checked again when Replace is pressed; Enter in the failed
//     dialog does not send after an answer that offers no Try again; after a bridge timeout the watched reply of that run is ignored; the proof's own exit is non-zero when nothing ran.
//  G. mutants: each is one edit of the real sources, fed to the same checks, and must be caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync, spawnSync } from 'node:child_process'
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
const ROUTER = 'lib/element-command-router.ts'
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
const STUDIO_CODES = ['TIMED_OUT', 'LAYOUT_SWITCH_OFF', 'BUSY', 'NOT_AVAILABLE', 'UNKNOWN']
/** Words that mean a raw backend message reached a person: names of services, stages, statuses, HTTP, routes, codes. */
const JARGON = /\b(Layout|Director|Elementor|stage|status|HTTP|route|endpoint|payload|JSON|stack|exception|undefined|null|code)\b|\b[45]\d\d\b(?! characters)|[A-Z]{3,}_[A-Z_]{3,}/
const NO_RETRY = ['REPAINT_FAILED', 'READ_ONLY_SNAPSHOT', 'VIEW_ONLY_PAGE', 'NOT_AUTHORIZED', 'NO_BACKGROUND_PICTURE', 'PICTURE_DECLINED', 'LAYOUT_SWITCH_OFF', 'ROUTE_UNAVAILABLE', 'NOT_AVAILABLE']
const RELOAD = ['REPAINT_FAILED', 'TIMED_OUT', 'VIEWER_UNAVAILABLE', 'PRESENTATION_NOT_FOUND', 'SLIDE_NOT_FOUND', 'SLIDE_INDEX_OUT_OF_RANGE', 'SLIDE_CHANGED', 'INVALID_BODY']
const reply = (code, extra = {}) => ({ success: false, action: 'setSlideBackgroundPicture', stage: 'route', code, error: `raw text for ${code}`, ...extra })
/** composeGetState as Layout's viewer builds it (viewer/presentation-viewer.html handleComposeGetState at Layout !296, 26283304): `sections` is the visual order ('P' = an Add Slide placeholder, anything else a real slide's id); `slides` holds the REAL slides only, each with its visual_index and its
 *  layout_index; the placeholders are listed apart; current_visual_index is the viewer's own. This is the shape REVIEW-1's probe built. */
function orderReceipt(sections, currentVisualIndex, over = {}) {
  const slides = [], placeholders = []
  let real = 0
  sections.forEach((section, visualIndex) => {
    if (section === 'P') { placeholders.push({ job_id: 'job-1', visual_index: visualIndex }); return }
    slides.push({ slide_id: section, visual_index: visualIndex, layout_index: real }); real += 1
  })
  return { success: true, action: 'composeGetState', current_visual_index: currentVisualIndex, current_placeholder_job_id: sections[currentVisualIndex] === 'P' ? 'job-1' : null,
    real_slide_count: slides.length, visual_section_count: sections.length, total_visual_sections: sections.length, placeholders, slides, ...over }
}
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
  assert.equal(L.REPLACE_PICTURE_CATALOG_COMMAND, 'getTemplateSlotCatalog'); assert.equal(L.REPLACE_PICTURE_ORDER_COMMAND, 'composeGetState'); assert.equal(L.REPLACE_PICTURE_PROGRESS_TYPE, 'setSlideBackgroundPictureProgress')
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
  deepEqual([...L.STUDIO_PICTURE_CODES].sort(), [...STUDIO_CODES].sort(), 'and Studio\'s own five')
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
    // (the runner, continued)
    // a bridge timeout: the reply the watch holds is an earlier run's, never this run's
    { const timedOut = async () => { throw new Error('Command timeout') }
      deepEqual(await run(timedOut, undefined, () => reply('REPAINT_FAILED', { saved: true })), L.failureOutcome('TIMED_OUT'), 'timed out: a late reply of an earlier run is ignored (not REPAINT_FAILED, not stored)'); deepEqual(await run(timedOut, undefined, () => reply('WRITE_FAILED')), L.failureOutcome('TIMED_OUT'))
      deepEqual(await run(async () => { throw 'Command timeout' }, undefined, () => reply('WRITE_FAILED')), L.failureOutcome('TIMED_OUT'), 'a timeout that arrives as a string')
      deepEqual(await run(async () => { throw new Error('Command failed') }, undefined, () => reply('WRITE_FAILED')), L.failureOutcome('WRITE_FAILED'), 'any other failure still reads the watched reply')
      assert.equal(L.isTimeoutFailure(new Error('Command timeout')), true); assert.equal(L.isTimeoutFailure('command TIMEOUT'), true); for (const odd of [new Error('Command failed'), null, undefined, 5, {}, reply('WRITE_FAILED')]) assert.equal(L.isTimeoutFailure(odd), false, `not a timeout: ${String(odd)}`) }
    availabilityChecks(L)
    eligibilityChecks(L)
    progressChecks(L)
  })()
}

const clear = { deckOpen: true, viewerReady: true, readOnly: null, tabPausedHint: null, templateMode: false, building: false, regeneratingThisSlide: false, studioBusy: false, mutationPending: false, eligibility: { state: 'known', eligible: true, reason: null, target: 'hero_slot' } }
function availabilityChecks(L) {
  const R = L.REPLACE_PICTURE_REASONS
  assert.equal(L.replacePictureDisabledReason(clear), null, 'everything clear on a hero: on')
  assert.equal(L.replacePictureDisabledReason({ ...clear, eligibility: { state: 'unknown' } }), null, 'a slide Layout did not report on (or a read that failed) stays on: the route decides at click time')
  assert.equal(L.replacePictureDisabledReason({ ...clear, eligibility: { state: 'known', eligible: true, reason: null, target: 'slide_background' } }), null, 'a content slide Layout calls eligible is on (target: slide_background): Layout decides, not a guess from the layout name')
  const alone = [
    [{ building: true }, R.building], [{ regeneratingThisSlide: true }, R.regenerating], [{ studioBusy: true }, R.busy], [{ mutationPending: true }, R.mutating], [{ templateMode: true }, R.template],
    [{ readOnly: 'view-only' }, R.viewOnly], [{ readOnly: 'preview' }, R.preview], [{ tabPausedHint: 'This tab is paused.' }, 'This tab is paused.'], [{ viewerReady: false }, R.loading], [{ deckOpen: false }, R.loading],
    [{ placeholderOnScreen: true }, R.placeholder], [{ eligibility: { state: 'loading' } }, R.checking], [{ eligibility: { state: 'absent' } }, R.notOnYet],
    [{ eligibility: { state: 'known', eligible: false, reason: 'NO_BACKGROUND_PICTURE', target: 'slide_background' } }, L.upfrontWords('NO_BACKGROUND_PICTURE')],
    [{ eligibility: { state: 'known', eligible: false, reason: 'PICTURE_DECLINED', target: 'hero_slot' } }, L.upfrontWords('PICTURE_DECLINED')],
    [{ eligibility: { state: 'known', eligible: false, reason: 'VIEW_ONLY_PAGE', target: 'hero_slot' } }, L.upfrontWords('VIEW_ONLY_PAGE')],
    [{ eligibility: { state: 'known', eligible: false, reason: null, target: null } }, R.notEligible],
  ]
  for (const [state, want] of alone) assert.equal(L.replacePictureDisabledReason({ ...clear, ...state }), want, `off for ${JSON.stringify(state)}`)
  for (const text of Object.values(R)) assert.ok(typeof text === 'string' && text.endsWith('.') && !JARGON.test(text), `plain reason: ${text}`)
  assert.match(R.building, /build is running/); assert.match(R.regenerating, /regenerated/); assert.equal(R.notOnYet, 'Replacing a picture is not turned on for this server yet.', 'SLIDE-4\'s sentence for a Layout with no backgroundPicture key, word for word'); assert.equal(R.notOnYet, L.upfrontWords('LAYOUT_SWITCH_OFF'), 'and it is the code table\'s sentence, as said before any click')
  assert.ok(!('notHero' in R), 'the title / section / closing guess is gone: Layout decides')
  // the order: read-only first (the outline preview right after it), then the paused tab, Template Mode, a build, a regenerate, any other busy state, a slide change, loading, what Layout says about the slide
  assert.equal(L.replacePictureDisabledReason({ ...clear, readOnly: 'view-only', tabPausedHint: 'paused' }), R.viewOnly); assert.equal(L.replacePictureDisabledReason({ ...clear, readOnly: 'preview', tabPausedHint: 'paused' }), R.preview, 'the outline preview comes before the paused tab'); assert.equal(L.replacePictureDisabledReason({ ...clear, eligibility: { state: 'absent' }, viewerReady: false }), R.loading, 'loading comes before what Layout says about the slide'); assert.equal(L.replacePictureDisabledReason({ ...clear, placeholderOnScreen: true, eligibility: { state: 'absent' } }), R.placeholder, 'a placeholder on screen comes before what Layout says about the slides'); assert.equal(L.replacePictureDisabledReason({ ...clear, placeholderOnScreen: false }), null, 'no placeholder: on')
  assert.match(R.placeholder, /not been built/, 'a placeholder, building or failed: plain words that fit both')
  const order = [{ readOnly: 'view-only' }, { tabPausedHint: 'paused' }, { templateMode: true }, { building: true }, { regeneratingThisSlide: true }, { studioBusy: true }, { mutationPending: true }, { viewerReady: false }, { placeholderOnScreen: true }, { eligibility: { state: 'absent' } }]
  for (let i = 0; i < order.length; i++) {
    const state = Object.assign({}, ...order.slice(i))
    assert.equal(L.replacePictureDisabledReason({ ...clear, ...state }), L.replacePictureDisabledReason({ ...clear, ...order[i] }), `with everything from ${JSON.stringify(order[i])} down, that one wins`)
  }
  // the slide on screen, from the viewer's own order (REVIEW-1's P2): the entry whose visual_index is the viewer's current one, with its layout_index and id; the visual position counts placeholders, the stored index does not
  const D = ['slide_a', 'slide_b', 'slide_c', 'slide_d']
  const slideAt = (visualIndex, layoutIndex, slideId) => ({ state: 'slide', visualIndex, layoutIndex, slideId })
  deepEqual(L.readCurrentSlide(orderReceipt(D, 2)), slideAt(2, 2, 'slide_c'), 'a, b, c, d; on c: stored index 2')
  deepEqual(L.readCurrentSlide(orderReceipt(['slide_a', 'slide_b', 'P', 'slide_c', 'slide_d'], 3)), slideAt(3, 2, 'slide_c'), 'a, b, P, c, d; on c: visual 3 but stored index 2 and c\'s own id (REVIEW-1\'s row 2: it was 3 and d)')
  deepEqual(L.readCurrentSlide(orderReceipt(['slide_a', 'slide_b', 'P', 'slide_c'], 3)), slideAt(3, 2, 'slide_c'), 'a, b, P, c; on c, the LAST slide: stored index 2 (it was 3, and no id)')
  deepEqual(L.readCurrentSlide(orderReceipt(['slide_a', 'slide_b', 'slide_c', 'P', 'slide_d'], 2)), slideAt(2, 2, 'slide_c'), 'a, b, c, P, d; on c: a placeholder after it changes nothing')
  deepEqual(L.readCurrentSlide(orderReceipt(['slide_a', 'slide_b', 'slide_c', 'P', 'slide_d'], 4)), slideAt(4, 3, 'slide_d'), 'on d, after the placeholder: visual 4, stored index 3')
  deepEqual(L.readCurrentSlide(orderReceipt(['P', 'slide_a', 'P', 'P', 'slide_b'], 4)), slideAt(4, 1, 'slide_b'), 'several placeholders')
  deepEqual(L.readCurrentSlide(orderReceipt(['slide_a', 'slide_b', 'P', 'slide_c', 'slide_d'], 2)), { state: 'placeholder', visualIndex: 2 }, 'on the placeholder itself: no stored slide is on screen')
  deepEqual(L.readCurrentSlide(orderReceipt(['slide_a', 'slide_b', 'slide_c', 'P'], 3)), { state: 'placeholder', visualIndex: 3 }, 'a failed job\'s card at the end')
  // the strict reader the other slide changes use (parseStudioNativeSlideOrder): where it accepts, this reader agrees with it; where a placeholder is in the deck it refuses and this one still answers
  { const strict = load('lib/studio-native-slide-order.ts'), S = strict.parseStudioNativeSlideOrder
    for (let current = 0; current < D.length; current++) { const got = S(orderReceipt(D, current)); assert.ok(got, 'strict accepts a deck with no placeholder'); deepEqual(L.readCurrentSlide(orderReceipt(D, current)), slideAt(got.currentVisualIndex, got.currentVisualIndex, got.slideIds[got.currentVisualIndex]), `no placeholder, on ${current}: the same slide as the strict reader`) }
    for (const [sections, current] of [[['slide_a', 'slide_b', 'P', 'slide_c', 'slide_d'], 3], [['slide_a', 'slide_b', 'P', 'slide_c'], 3], [['slide_a', 'slide_b', 'slide_c', 'P', 'slide_d'], 2]]) { assert.equal(S(orderReceipt(sections, current)), null, 'the strict reader refuses a deck that holds a placeholder'); assert.equal(L.readCurrentSlide(orderReceipt(sections, current)).state, 'slide', 'and this reader names the slide on screen') } }
  // a receipt that is not an identity-bearing composeGetState answer, or does not add up: unknown (nothing is named)
  const base4 = () => orderReceipt(['slide_a', 'slide_b', 'P', 'slide_c'], 3)
  const bad = [
    ['null', null], ['undefined', undefined], ['a string', 'x'], ['an array', []], ['no success', { ...base4(), success: undefined }], ['success "true"', { ...base4(), success: 'true' }], ['failed', { ...base4(), success: false }],
    ['no action', (() => { const r = base4(); delete r.action; return r })()], ['another action', { ...base4(), action: 'getTemplateSlotCatalog' }],
    ['no slides', { ...base4(), slides: undefined }], ['slides not an array', { ...base4(), slides: {} }], ['no placeholders list', { ...base4(), placeholders: undefined }], ['placeholders not an array', { ...base4(), placeholders: 'P' }],
    ['no current index', { ...base4(), current_visual_index: undefined }], ['negative current index', { ...base4(), current_visual_index: -1 }], ['current index past the end', { ...base4(), current_visual_index: 4 }], ['fractional current index', { ...base4(), current_visual_index: 2.5 }], ['string current index', { ...base4(), current_visual_index: '3' }], ['NaN current index', { ...base4(), current_visual_index: NaN }],
    ['real_slide_count off', { ...base4(), real_slide_count: 4 }], ['visual_section_count off', { ...base4(), visual_section_count: 3 }], ['total_visual_sections off', { ...base4(), total_visual_sections: 5 }],
    ['a slide that is not an object', { ...base4(), slides: [null, ...base4().slides.slice(1)] }],
    ['layout_index out of order', (() => { const r = base4(); r.slides[1].layout_index = 2; r.slides[2].layout_index = 1; return r })()], ['layout_index repeated', (() => { const r = base4(); r.slides[2].layout_index = 1; return r })()], ['layout_index missing', (() => { const r = base4(); delete r.slides[2].layout_index; return r })()],
    ['visual_index missing', (() => { const r = base4(); delete r.slides[2].visual_index; return r })()], ['visual_index fractional', (() => { const r = base4(); r.slides[2].visual_index = 3.5; return r })()], ['visual_index past the end', (() => { const r = base4(); r.slides[2].visual_index = 9; return r })()], ['visual_index negative', (() => { const r = base4(); r.slides[0].visual_index = -1; return r })()],
    ['two slides at one visual position', (() => { const r = base4(); r.slides[1].visual_index = 0; return r })()], ['a placeholder where a slide is', (() => { const r = base4(); r.placeholders[0].visual_index = 3; return r })()], ['a placeholder that is not an object', { ...base4(), placeholders: [5] }], ['a placeholder with no position', { ...base4(), placeholders: [{ job_id: 'j' }] }], ['a placeholder past the end', { ...base4(), placeholders: [{ job_id: 'j', visual_index: 7 }] }],
    ['a slide without an id', (() => { const r = base4(); r.slides[1].slide_id = null; return r })()], ['an empty id', (() => { const r = base4(); r.slides[1].slide_id = ''; return r })()], ['an id with spaces round it', (() => { const r = base4(); r.slides[1].slide_id = ' slide_b '; return r })()], ['an id that is a number', (() => { const r = base4(); r.slides[0].slide_id = 5; return r })()], ['the same id twice', (() => { const r = base4(); r.slides[1].slide_id = 'slide_a'; return r })()],
  ]
  for (const [what, receipt] of bad) deepEqual(L.readCurrentSlide(receipt), { state: 'unknown' }, `${what}: unknown`)
  // the answer never carries anything but the three fields
  deepEqual(Object.keys(L.readCurrentSlide(orderReceipt(D, 1))).sort(), ['layoutIndex', 'slideId', 'state', 'visualIndex']); deepEqual(Object.keys(L.readCurrentSlide(orderReceipt(['slide_a', 'P'], 1))).sort(), ['state', 'visualIndex'], 'and a placeholder carries only its place')
  // when Replace is pressed and the action is off: the reason's own words, nothing else, no Try again
  { const out = L.unavailableOutcome(R.building); deepEqual(out, { ok: false, code: 'NOT_AVAILABLE', words: R.building, stored: false, reload: false, retry: false }, 'the reason\'s words, no Try again, nothing stored'); deepEqual(L.unavailableOutcome(''), L.failureOutcome('NOT_AVAILABLE'), 'no words given: the default ones'); deepEqual(L.unavailableOutcome(null), L.failureOutcome('NOT_AVAILABLE')) }
  // Enter / the Replace button: only from the form, or from a failed dialog whose answer offers Try again (REPAINT_FAILED is a second write of a picture that is stored already)
  assert.equal(L.submitAllowed('form', null), true); assert.equal(L.submitAllowed('running', null), false, 'not while it runs'); assert.equal(L.submitAllowed('done', L.outcomeFromReply({ success: true })), false, 'not after it is done')
  for (const code of [...CONTRACT_CODES, ...STUDIO_CODES]) assert.equal(L.submitAllowed('failed', L.failureOutcome(code)), !NO_RETRY.includes(code), `a failed dialog after ${code}: Enter ${NO_RETRY.includes(code) ? 'does nothing' : 'sends again'}`)
  assert.equal(L.submitAllowed('failed', null), false, 'a failed dialog with no answer'); assert.equal(L.submitAllowed('failed', L.unavailableOutcome(R.building)), false)
  // a refine job on this slide: by id when both sides have one, else by position; only a building refine job
  const job = (over = {}) => ({ kind: 'refine', status: 'building', targetSlideId: null, targetIndex: 3, targetLayoutIndex: 3, ...over })
  assert.equal(L.refineBuildingOnSlide([job()], { slideId: null, slideIndex: 3 }), true, 'by position'); assert.equal(L.refineBuildingOnSlide([job()], { slideId: 'x', slideIndex: 3 }), true, 'one side has no id: by position')
  assert.equal(L.refineBuildingOnSlide([job({ targetSlideId: 'a' })], { slideId: 'a', slideIndex: 0 }), true, 'by id'); assert.equal(L.refineBuildingOnSlide([job({ targetSlideId: 'a' })], { slideId: 'b', slideIndex: 3 }), false, 'both have ids and they differ: another slide')
  assert.equal(L.refineBuildingOnSlide([job({ status: 'error' })], { slideId: null, slideIndex: 3 }), false, 'a failed job is not running'); assert.equal(L.refineBuildingOnSlide([job({ kind: 'compose' })], { slideId: null, slideIndex: 3 }), false, 'an Add Slide compose is not a regenerate')
  assert.equal(L.refineBuildingOnSlide([job({ targetIndex: 5, targetLayoutIndex: 5 })], { slideId: null, slideIndex: 3 }), false); assert.equal(L.refineBuildingOnSlide(null, { slideId: null, slideIndex: 0 }), false); assert.equal(L.refineBuildingOnSlide([], { slideId: null, slideIndex: 0 }), false)
  for (const [url, on] of [['https://l.test/p/d?viewOnly=true', true], ['https://l.test/p/d?x=1&viewOnly=true#/3', true], ['https://l.test/p/d?viewOnly=TRUE', true], ['https://l.test/p/d?viewOnly=false', false], ['https://l.test/p/d', false], ['https://l.test/p/d?notviewOnly=true', false], [null, false], [5, false]]) assert.equal(L.urlIsViewOnly(url), on, String(url))
}

/** A slot-catalog reply the way Layout !296 answers it: today's catalog fields, plus backgroundPicture (docs/api/SLIDE_BACKGROUND_PICTURE.md, "Up-front eligibility"). */
const bpEntry = (index, over = {}) => ({ slide_index: index, slide_id: `slide_${String(index + 1).padStart(8, '0')}`, eligible: true, reason: null, target: 'hero_slot', ...over })
const bpCatalog = (slides, over = {}) => ({ success: true, canvas_type: 'H1s', hero_style: null, slots: [], backgroundPicture: { enabled: true, slides }, ...over })
function eligibilityChecks(L) {
  // the contract's own example: an eligible title slide, a hero that declined a picture, a template shell
  const example = bpCatalog([bpEntry(0), bpEntry(1, { eligible: false, reason: 'PICTURE_DECLINED' }), bpEntry(2, { eligible: false, reason: 'NO_BACKGROUND_PICTURE', target: 'slide_background' })])
  deepEqual(L.readSlideEligibility(example, 0), { state: 'known', eligible: true, reason: null, target: 'hero_slot' })
  deepEqual(L.readSlideEligibility(example, 1), { state: 'known', eligible: false, reason: 'PICTURE_DECLINED', target: 'hero_slot' })
  deepEqual(L.readSlideEligibility(example, 2), { state: 'known', eligible: false, reason: 'NO_BACKGROUND_PICTURE', target: 'slide_background' })
  deepEqual(L.readSlideEligibility(bpCatalog([bpEntry(0), bpEntry(1, { target: 'slide_background' })]), 1), { state: 'known', eligible: true, reason: null, target: 'slide_background' }, 'a content slide can be eligible: its picture becomes the slide\'s background')
  for (const reason of ['NO_BACKGROUND_PICTURE', 'PICTURE_DECLINED', 'VIEW_ONLY_PAGE']) deepEqual(L.readSlideEligibility(bpCatalog([bpEntry(0, { eligible: false, reason })]), 0), { state: 'known', eligible: false, reason, target: 'hero_slot' }, reason)
  deepEqual([...L.PICTURE_ELIGIBILITY_REASONS], ['NO_BACKGROUND_PICTURE', 'PICTURE_DECLINED', 'VIEW_ONLY_PAGE'], 'the contract\'s three reasons')
  // the entry is found by slide_index, not by its place in the list
  const shuffled = bpCatalog([bpEntry(2, { eligible: false, reason: 'PICTURE_DECLINED' }), bpEntry(0), bpEntry(1, { eligible: false, reason: 'NO_BACKGROUND_PICTURE' })])
  deepEqual(L.readSlideEligibility(shuffled, 1), { state: 'known', eligible: false, reason: 'NO_BACKGROUND_PICTURE', target: 'hero_slot' }); deepEqual(L.readSlideEligibility(shuffled, 0).eligible, true)
  // NO backgroundPicture key (Layout's flag off, or an older Layout): absent; so is a key that is not Layout's report
  for (const reply of [{ success: true, canvas_type: 'H1s', slots: [] }, { success: true, data: { backgroundPicture: example.backgroundPicture } }, { success: true, catalog: { backgroundPicture: example.backgroundPicture } },
    bpCatalog([], { backgroundPicture: null }), bpCatalog([], { backgroundPicture: 'yes' }), bpCatalog([], { backgroundPicture: [] }), bpCatalog([], { backgroundPicture: { enabled: false, slides: [bpEntry(0)] } }),
    bpCatalog([], { backgroundPicture: { enabled: 'true', slides: [bpEntry(0)] } }), bpCatalog([], { backgroundPicture: { slides: [bpEntry(0)] } }), bpCatalog([], { backgroundPicture: { enabled: true } }), bpCatalog([], { backgroundPicture: { enabled: true, slides: 'all' } })]) deepEqual(L.readSlideEligibility(reply, 0), { state: 'absent' }, JSON.stringify(reply).slice(0, 100))
  // a report that does not list the slide, an entry without a boolean, an entry that is not an object: nothing is known (the route decides at click time)
  deepEqual(L.readSlideEligibility(example, 9), { state: 'unknown' }, 'an unlisted slide'); deepEqual(L.readSlideEligibility(bpCatalog([]), 0), { state: 'unknown' }, 'a report with no slides'); deepEqual(L.readSlideEligibility(bpCatalog([bpEntry(0, { eligible: 'no' })]), 0), { state: 'unknown' }); deepEqual(L.readSlideEligibility(bpCatalog([bpEntry(0, { eligible: undefined })]), 0), { state: 'unknown' })
  deepEqual(L.readSlideEligibility(bpCatalog([null, 5, 'x', [], bpEntry(0, { slide_index: '0' }), bpEntry(0, { slide_index: 0.5 })]), 0), { state: 'unknown' }, 'odd entries are not this slide')
  for (const odd of [null, undefined, 5, 'x', [], true]) deepEqual(L.readSlideEligibility(odd, 0), { state: 'unknown' }, `an odd reply: ${String(odd)}`)
  // a reason or target Layout adds later is never taken raw; an eligible slide keeps no reason
  deepEqual(L.readSlideEligibility(bpCatalog([bpEntry(0, { eligible: false, reason: 'SOMETHING_NEW', target: 'somewhere' })]), 0), { state: 'known', eligible: false, reason: null, target: null })
  deepEqual(L.readSlideEligibility(bpCatalog([bpEntry(0, { eligible: true, reason: 'PICTURE_DECLINED' })]), 0), { state: 'known', eligible: true, reason: null, target: 'hero_slot' }, '`eligible` decides, a stray reason does not')
  deepEqual(L.readSlideEligibility(bpCatalog([bpEntry(0, { eligible: false, reason: null })]), 0), { state: 'known', eligible: false, reason: null, target: 'hero_slot' })
  // the words before any click: the code table's sentence, without its closing "Nothing changed."
  for (const code of [...CONTRACT_CODES, ...STUDIO_CODES]) {
    const table = L.REPLACE_PICTURE_WORDS[code], up = L.upfrontWords(code)
    assert.equal(up, table.replace(/ Nothing changed\.$/, ''), `${code}: only a closing "Nothing changed." goes`); assert.ok(up.endsWith('.'), `${code}: still a sentence`)
    if (/ Nothing changed\.$/.test(table)) assert.ok(!/Nothing changed/.test(up), `${code}: no "Nothing changed" is left`); else assert.equal(up, table, `${code}: a sentence that does not end with it is left whole`)
  }
  for (const reason of L.PICTURE_ELIGIBILITY_REASONS) { const words = L.upfrontWords(reason); assert.ok(words.length >= 25 && !JARGON.test(words), `${reason}: plain words: ${words}`); assert.notEqual(words, reason) }
  assert.equal(L.upfrontWords('NO_BACKGROUND_PICTURE'), 'This slide comes from a saved template, which has no background picture to replace.')
  assert.equal(L.upfrontWords('PICTURE_DECLINED'), 'This slide was designed without a picture, so a new one would not show. Choose another design for it to use a picture.')
  assert.equal(L.upfrontWords('LAYOUT_SWITCH_OFF'), 'Replacing a picture is not turned on for this server yet.', 'SLIDE-4\'s instruction, word for word')
  // where the picture goes, in words: only a title / section / closing slide's picture area can hide a covering picture
  deepEqual(Object.keys(L.REPLACE_PICTURE_TARGET_WORDS).sort(), ['hero_slot', 'slide_background', 'unknown'])
  for (const [key, words] of Object.entries(L.REPLACE_PICTURE_TARGET_WORDS)) assert.ok(words.endsWith('.') && !JARGON.test(words), `${key}: plain words`)
  assert.match(L.REPLACE_PICTURE_TARGET_WORDS.hero_slot, /hidden, never deleted/); assert.match(L.REPLACE_PICTURE_TARGET_WORDS.slide_background, /becomes this slide's background/)
  assert.ok(!/hidden/.test(L.REPLACE_PICTURE_TARGET_WORDS.slide_background) && !/hidden/.test(L.REPLACE_PICTURE_TARGET_WORDS.unknown), 'a content slide\'s pictures are not hidden, and a slide whose target is not known is not told they are')
}

/** A progress event the way the viewer posts it (docs/api/SLIDE_BACKGROUND_PICTURE.md, "Progress events"): no action, no requestId, the command's id as commandRequestId. */
const progressEvent = (stage, over = {}) => ({ type: 'setSlideBackgroundPictureProgress', command: 'setSlideBackgroundPicture', progress: true, stage, slide_index: 0, commandRequestId: 'req-A', ...over })
function progressChecks(L) {
  deepEqual([...L.REPLACE_PICTURE_STAGES], ['saving', 'writing', 'repainting'], 'the contract\'s stages, in the order a run enters them')
  deepEqual(L.REPLACE_PICTURE_STAGE_WORDS, { saving: 'Saving your edits…', writing: 'Saving the picture…', repainting: 'Redrawing the slide…' }, 'the stage words, as SLIDE-4 was told')
  for (const [stage, words] of Object.entries(L.REPLACE_PICTURE_STAGE_WORDS)) assert.ok(!JARGON.test(words) && words.replace(/\u2026$/, '').toLowerCase() !== stage && /^[A-Z][a-z]+ .+\u2026$/.test(words) && words.length > 12, `${stage}: words of a sentence, not the stage's name`)
  // a whole run, in order
  let t = L.createProgressTracker(0)
  for (const stage of ['saving', 'writing', 'repainting']) assert.equal(t.accept(progressEvent(stage)), stage, `a full run: ${stage}`)
  // a SAVE_PENDING run stops after saving; a route refusal after writing: the tracker has nothing to do past that
  t = L.createProgressTracker(3); assert.equal(t.accept(progressEvent('saving', { slide_index: 3 })), 'saving'); t = L.createProgressTracker(3); for (const stage of ['saving', 'writing']) assert.equal(t.accept(progressEvent(stage, { slide_index: 3 })), stage)
  // an event before the run has begun (no "saving" yet), or of an earlier run that outlived its dialog, is ignored
  t = L.createProgressTracker(0); assert.equal(t.accept(progressEvent('writing', { commandRequestId: 'req-OLD' })), null, 'an unbound "writing" is ignored'); assert.equal(t.accept(progressEvent('repainting', { commandRequestId: 'req-OLD' })), null)
  assert.equal(t.accept(progressEvent('saving')), 'saving', 'the run\'s own "saving" binds it'); assert.equal(t.accept(progressEvent('writing', { commandRequestId: 'req-OLD' })), null, 'a late event of another run (another commandRequestId) is ignored'); assert.equal(t.accept(progressEvent('writing')), 'writing')
  assert.equal(t.accept(progressEvent('saving', { commandRequestId: 'req-B' })), null, 'a second "saving" of another id does not rebind a run in progress'); assert.equal(t.accept(progressEvent('repainting')), 'repainting')
  // matched by commandRequestId: a different id, a missing one, an empty one, one that is not a string
  t = L.createProgressTracker(0); t.accept(progressEvent('saving'))
  for (const id of ['req-B', '', undefined, null, 5, {}, ['req-A']]) assert.equal(t.accept(progressEvent('writing', { commandRequestId: id })), null, `commandRequestId ${JSON.stringify(id)}`)
  { const noId = progressEvent('saving'); delete noId.commandRequestId; assert.equal(L.createProgressTracker(0).accept(noId), null, 'no commandRequestId key: not this run\'s') }
  assert.equal(L.createProgressTracker(0).accept(progressEvent('saving', { commandRequestId: '' })), null, 'an empty id cannot bind a run')
  // another slide's events, a stage that is not one of the three, a stage that goes back or repeats
  t = L.createProgressTracker(0); assert.equal(t.accept(progressEvent('saving', { slide_index: 1 })), null, 'another slide'); assert.equal(t.accept(progressEvent('saving', { slide_index: '0' })), null); assert.equal(t.accept(progressEvent('saving', { slide_index: undefined })), null)
  for (const stage of ['done', 'Saving', 'save', '', null, undefined, 1, {}]) assert.equal(L.createProgressTracker(0).accept(progressEvent(stage)), null, `stage ${JSON.stringify(stage)}`)
  t = L.createProgressTracker(0); t.accept(progressEvent('saving')); t.accept(progressEvent('writing')); assert.equal(t.accept(progressEvent('writing')), null, 'a repeated stage'); assert.equal(t.accept(progressEvent('saving')), null, 'a stage that goes back'); assert.equal(t.accept(progressEvent('repainting')), 'repainting')
  // only the contract's shape counts: type, command, progress true, and NO action / requestId key (those mark a reply, which the bridge settles on)
  const shaped = [['type', 'other'], ['type', undefined], ['command', 'setSlideBackground'], ['command', undefined], ['progress', false], ['progress', 'true'], ['progress', undefined], ['action', 'setSlideBackgroundPicture'], ['action', undefined], ['requestId', 'req-A'], ['requestId', undefined]]
  for (const [key, value] of shaped) { const event = progressEvent('saving'); if (key === 'action' || key === 'requestId') event[key] = value; else if (value === undefined) delete event[key]; else event[key] = value; assert.equal(L.createProgressTracker(0).accept(event), null, `${key}=${String(value)}: not a progress event`) }
  const reply = { success: true, action: 'setSlideBackgroundPicture', requestId: 'req-A', slide_index: 0 }; assert.equal(L.createProgressTracker(0).accept(reply), null, 'the final reply is never progress')
  for (const odd of [null, undefined, 5, 'saving', [], true]) assert.equal(L.createProgressTracker(0).accept(odd), null, `an odd message: ${String(odd)}`)
  // two runs, two trackers: independent
  const a = L.createProgressTracker(0), b = L.createProgressTracker(0); a.accept(progressEvent('saving')); a.accept(progressEvent('writing')); assert.equal(b.accept(progressEvent('saving', { commandRequestId: 'req-B' })), 'saving', 'a new run starts from its own "saving"')
}

// ============================================================================================================================================
// B. the hook, REAL, in the offline React host, against a viewer double
// ============================================================================================================================================
const FRAME = { frame: 'iframe' }
let mountSeq = 0
/** A viewer double: answers the reads (the slot catalog with Layout !296's backgroundPicture: every REAL slide eligible, a hero's picture going to its slot, any other slide's to its background, unless `entries` says otherwise; `noReport` leaves the key out, `report` puts any value there;
 *  the viewer's order, composeGetState, built the way Layout builds it: `count` real slides, `placeholders` = the visual positions that hold an Add Slide placeholder, `current` = the viewer's visual position; `ids` renames a real slide; heroes / entries are by STORED index) and the command the way the contract says;
 *  a failed command posts its reply message to the window's listeners (as the viewer does) and rejects with text only (as the bridge does). */
function viewer(over = {}) {
  const calls = [], listeners = new Set(), added = [], removed = []
  const win = { addEventListener: (type, fn) => { if (type === 'message') { listeners.add(fn); added.push(fn) } }, removeEventListener: (type, fn) => { if (type === 'message') { listeners.delete(fn); removed.push(fn) } }, post: (data, source = 'viewer') => { for (const fn of [...listeners]) fn({ data, source, origin: 'https://layout.test' }) } }
  const state = { current: 0, count: 8, heroes: [0, 3, 7], entries: {}, placeholders: [], ids: {}, ...over, currentExplicit: 'current' in over }
  const idOf = layout => state.ids[layout] ?? `slide_${String(layout + 1).padStart(8, '0')}`
  const sections = () => { const out = []; let real = 0; for (let visual = 0; visual < state.count + state.placeholders.length; visual++) out.push(state.placeholders.includes(visual) ? 'P' : idOf(real++)); return out }
  const send = async (iframe, action, params, options) => {
    calls.push({ action, params: JSON.parse(JSON.stringify(params ?? null)), options: options ? { ...options } : undefined, iframe })
    if (action === 'getTemplateSlotCatalog') {
      if (state.catalogFails) throw new Error('Command timeout')
      const slides = Array.from({ length: state.count }, (_, i) => ({ slide_index: i, slide_id: idOf(i), eligible: true, reason: null, target: state.heroes.includes(i) ? 'hero_slot' : 'slide_background', ...(state.entries[i] ?? {}) }))
      return { success: true, canvas_type: 'H1s', hero_style: null, slots: [], ...(state.noReport ? {} : { backgroundPicture: 'report' in state ? state.report : { enabled: true, slides } }) }
    }
    if (action === 'composeGetState') { if (state.orderFails) throw new Error('Command timeout'); return state.orderReply ? state.orderReply() : orderReceipt(sections(), state.current) }
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
  // a viewer double whose position was not given follows the slide number the hook is shown (the viewer is on the slide the page says; placeholders aside)
  const set = patch => { Object.assign(over, patch); if (!v.state.currentExplicit && Number.isInteger(over.currentSlide)) v.state.current = over.currentSlide - 1; rootHost.setElement(h(Probe, { props: input() })) }
  const settle = async () => { for (let i = 0; i < 5; i++) { rootHost.flush(); await tick() } rootHost.flush() }
  set({}); await settle()
  return { out, probe, set, settle, root: rootHost, view: () => out.view }
}
const catalogReads = v => v.calls.filter(c => c.action === 'getTemplateSlotCatalog')
const orderReads = v => v.calls.filter(c => c.action === 'composeGetState')
/** What the viewer double says each stored slide is called (slide_00000001 is the first real slide). */
const sid = layout => `slide_${String(layout + 1).padStart(8, '0')}`

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
  // on: what Layout says about the slide on screen is read once, with the viewer's own read (the slot catalog, which also carries backgroundPicture)
  let v = viewer(), m = await mountT(ON, v)
  assert.equal(m.view().visible, true); assert.equal(m.view().reason, null, 'an eligible title slide: on'); assert.equal(m.view().target, 'hero_slot', 'and Layout says where the picture goes')
  assert.equal(catalogReads(v).length, 1, 'the slide\'s eligibility is read once'); deepEqual(catalogReads(v)[0].params, { slideIndex: 0 }); assert.equal(catalogReads(v)[0].options.timeoutMs, 8000); assert.equal(catalogReads(v)[0].iframe, FRAME)
  assert.equal(orderReads(v).length, 1, 'and so is the viewer\'s order (which slide is on screen), by the same frame'); deepEqual(orderReads(v)[0].params, {}); assert.equal(orderReads(v)[0].options.timeoutMs, 5000); assert.equal(orderReads(v)[0].iframe, FRAME); assert.equal(m.view().slideId, sid(0), 'the hook reports Layout\'s id for the slide on screen (the dialog binds to it)')
  assert.equal(v.commands().length, 0, 'nothing is sent until the person confirms'); assert.equal(m.view().slideNumber, 1); assert.equal(m.view().slideTitle, 'Why we are rethinking the roadmap')
  m.set({ railSlideTitle: 'Slide 1' }); await m.settle(); assert.equal(m.view().slideTitle, null, 'a fallback title "Slide N" is not shown as a name'); m.set({ railSlideTitle: null }); await m.settle(); assert.equal(m.view().slideTitle, null)
  v.state.current = 1; m.set({ currentSlide: 2 }); await m.settle(); assert.equal(catalogReads(v).length, 2, 'a new slide, a new read'); deepEqual(catalogReads(v)[1].params, { slideIndex: 1 }); assert.equal(orderReads(v).length, 2, 'of both'); assert.equal(m.view().slideId, sid(1))
  m.set({ studioBusy: false }); await m.settle(); assert.equal(catalogReads(v).length, 2, 'no read when nothing changed'); assert.equal(orderReads(v).length, 2)
  // Layout decides (the hero guess is gone): a content slide it calls eligible is on, with the picture going to the slide's background
  v = viewer(); m = await mountT(ON, v, { currentSlide: 2 }); assert.equal(m.view().reason, null, 'a content slide Layout calls eligible: on'); assert.equal(m.view().target, 'slide_background')
  v = viewer({ heroes: [] }); m = await mountT(ON, v); assert.equal(m.view().reason, null, 'a slide with a hero-looking layout that Layout files as a plain background is still on'); assert.equal(m.view().target, 'slide_background')
  // each reason Layout gives, with the words (the code table's, without "Nothing changed."), on its own slide; nothing sent
  for (const reason of ['NO_BACKGROUND_PICTURE', 'PICTURE_DECLINED', 'VIEW_ONLY_PAGE']) for (const [slide, target] of [[1, 'hero_slot'], [2, 'slide_background']]) {
    v = viewer({ entries: { [slide - 1]: { eligible: false, reason, target } } }); m = await mountT(ON, v, { currentSlide: slide })
    assert.equal(m.view().reason, L.upfrontWords(reason), `${reason} on slide ${slide}: greyed with its words`); assert.equal(m.view().reason, L.REPLACE_PICTURE_WORDS[reason].replace(/ Nothing changed\.$/, '')); assert.equal(m.view().visible, true, 'still drawn, only greyed'); assert.equal(v.commands().length, 0)
  }
  v = viewer({ entries: { 0: { eligible: false, reason: null } } }); m = await mountT(ON, v); assert.equal(m.view().reason, R.notEligible, 'not eligible and no reason: the plain default words')
  v = viewer({ entries: { 0: { eligible: false, reason: 'SOMETHING_NEW' } } }); m = await mountT(ON, v); assert.equal(m.view().reason, R.notEligible, 'a reason Layout adds later is never shown raw')
  // the slide's OWN entry is used: slide 3 refused, slide 1 and 2 not, and going back is on again
  v = viewer({ entries: { 2: { eligible: false, reason: 'NO_BACKGROUND_PICTURE', target: 'slide_background' } } }); m = await mountT(ON, v)
  assert.equal(m.view().reason, null, 'slide 1: on'); m.set({ currentSlide: 3 }); await m.settle(); assert.equal(m.view().reason, L.upfrontWords('NO_BACKGROUND_PICTURE'), 'slide 3: greyed'); m.set({ currentSlide: 2 }); await m.settle(); assert.equal(m.view().reason, null, 'slide 2: on'); m.set({ currentSlide: 1 }); await m.settle(); assert.equal(m.view().reason, null)
  // NO backgroundPicture key (Layout's flag off, or an older Layout): greyed on EVERY slide, a title slide too, with SLIDE-4's sentence; nothing sent
  for (const slide of [1, 2, 4, 8]) { v = viewer({ noReport: true }); m = await mountT(ON, v, { currentSlide: slide }); assert.equal(m.view().reason, 'Replacing a picture is not turned on for this server yet.', `no key, slide ${slide}: greyed`); assert.equal(m.view().visible, true); assert.equal(v.commands().length, 0); assert.equal(m.view().target, null) }
  for (const report of [null, 'yes', 5, [], {}, { enabled: false, slides: [] }, { enabled: 'true', slides: [] }, { enabled: true }, { enabled: true, slides: 'all' }]) { v = viewer({ report }); m = await mountT(ON, v); assert.equal(m.view().reason, R.notOnYet, `a report that is not Layout's: greyed (${JSON.stringify(report)})`) }
  // a report that does not list this slide, an entry that makes no sense, a failed read: nothing is known, so it stays on and the route decides at click time
  v = viewer({ report: { enabled: true, slides: [{ slide_index: 5, eligible: false, reason: 'NO_BACKGROUND_PICTURE', target: 'hero_slot' }] } }); m = await mountT(ON, v); assert.equal(m.view().reason, null, 'a slide the report does not list: on'); assert.equal(m.view().target, null)
  v = viewer({ report: { enabled: true, slides: [{ slide_index: 0, eligible: 'no', reason: 'NO_BACKGROUND_PICTURE' }, null, 5] } }); m = await mountT(ON, v); assert.equal(m.view().reason, null, 'an entry with no boolean eligible: on')
  v = viewer({ report: { enabled: true, slides: [{ slide_index: '0', eligible: false, reason: 'NO_BACKGROUND_PICTURE' }] } }); m = await mountT(ON, v); assert.equal(m.view().reason, null, 'a slide_index that is not a number is not this slide: on')
  v = viewer({ catalogFails: true }); m = await mountT(ON, v); assert.equal(m.view().reason, null, 'a read that fails: on (Layout answers for itself)')
  // the key counts only at the top of the answer (the contract's place), not inside data / catalog
  { const nested = viewer(); const send = nested.send; nested.send = async (...args) => { const out = await send(...args); if (args[1] === 'getTemplateSlotCatalog') return { success: true, data: { backgroundPicture: out.backgroundPicture } }; return out }
    m = await mountT(ON, nested); assert.equal(m.view().reason, R.notOnYet, 'a backgroundPicture nested under data is not the contract\'s: greyed') }
  // a read that lands after the person moved to another slide is not used for it
  { const slow = viewer({ entries: { 0: { eligible: false, reason: 'PICTURE_DECLINED', target: 'hero_slot' } } }); const send = slow.send; const waiting = []
    slow.send = async (iframe, action, params, ...rest) => { if (action === 'getTemplateSlotCatalog' && params.slideIndex === 0) await new Promise(resolve => waiting.push(resolve)); return send(iframe, action, params, ...rest) }
    const late = await mountT(ON, slow); late.set({ currentSlide: 2 }); await late.settle(); assert.equal(late.view().reason, null, 'slide 2 is on'); waiting.forEach(resolve => resolve()); await late.settle(); assert.equal(late.view().reason, null, 'slide 1\'s late answer (greyed) does not change slide 2') }
  // the report is the deck as it is NOW: a refusal that came after the read (the deck changed server-side) is read again when the change settles
  v = viewer(); m = await mountT(ON, v); assert.equal(m.view().reason, null); v.state.entries = { 0: { eligible: false, reason: 'PICTURE_DECLINED', target: 'hero_slot' } }
  m.set({ mutationPending: true }); await m.settle(); assert.equal(catalogReads(v).length, 1, 'no read while a change is in flight'); m.set({ mutationPending: false }); await m.settle(); assert.equal(catalogReads(v).length, 2, 'read again when it settles'); assert.equal(m.view().reason, L.upfrontWords('PICTURE_DECLINED'), 'and now greyed with its words')
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
    if (state.building || state.studioBusy || state.mutationPending || state.templateMode || state.viewerReady === false || state.deckOpen === false) assert.equal(catalogReads(v).length, 0, `no catalog read while ${JSON.stringify(state).slice(0, 40)}`)
  }
  v = viewer(); m = await mountT(ON, v, { composeJobs: [{ kind: 'refine', status: 'building', targetSlideId: 'outline-9', targetIndex: 5, targetLayoutIndex: 5 }, { kind: 'compose', status: 'building', targetIndex: 0 }] }); assert.equal(m.view().reason, null, 'a refine job on another slide, or an Add Slide compose, does not switch it off by itself here (the page\'s busy rule does that)')
  v = viewer(); m = await mountT(ON, v, { presenting: true }); assert.equal(m.view().visible, false, 'in Present it is not drawn'); assert.equal(v.calls.length, 0, 'and nothing is read')
  v = viewer(); m = await mountT(ON, v, { building: true }); m.set({ building: false }); await m.settle(); assert.equal(m.view().reason, null, 'the build ends: on again'); assert.equal(catalogReads(v).length, 1, 'and the report is read then')

  // the command on the wire: composeGetState then setSlideBackgroundPicture, inside the mutation scaffolding
  v = viewer({ hidden: ['image_free_0'] }); m = await mountT(ON, v)
  const opened = v.calls.length
  let outcome = await m.view().replace({ slideNumber: 1, slideId: m.view().slideId }, { url: `  ${OK_URL}  `, alt: ' Harbour at dawn ' })
  deepEqual(v.calls.slice(opened).map(c => [c.action, c.params, c.options]), [
    ['composeGetState', {}, { timeoutMs: 5000 }],
    ['setSlideBackgroundPicture', { slide_index: 0, slide_id: 'slide_00000001', url: OK_URL, alt: 'Harbour at dawn' }, { timeoutMs: 20000 }],
  ], 'the order read again when Replace is pressed, then the command: the contract\'s keys, the viewer\'s own slide id (never the rail\'s), the trimmed link and description, the 20 s budget')
  assert.ok(v.calls.every(c => c.iframe === FRAME), 'every command goes to the frame the mutation captured')
  deepEqual(outcome, { ok: true, hiddenCount: 1, words: 'Picture replaced.', note: 'A picture that covered the whole slide was hidden, not deleted. Restoring an earlier version of the deck brings it back.' })
  deepEqual(m.probe.begins, ['picture replacement']); assert.equal(m.probe.released, 1, 'the busy state is released once'); assert.equal(m.probe.after, 1, 'the rail and the other tabs are told once'); assert.equal(v.listeners.size, 0, 'the reply listener is removed'); assert.equal(v.added.length, 1); assert.equal(v.removed[0], v.added[0], 'the same listener')
  m.set({ currentSlide: 4 }); v.state.current = 3; await m.settle(); outcome = await m.view().replace({ slideNumber: 4, slideId: m.view().slideId }, { url: OK_URL, alt: '' })
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
  v = viewer({ orderFails: true }); m = await mountT(ON, v); assert.equal(m.view().reason, null, 'the order could not be read when the button was drawn: nothing is known, it stays on'); assert.equal(m.view().slideId, null)
  deepEqual(await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' }), L.failureOutcome('VIEWER_UNAVAILABLE'), 'and when Replace cannot read the order either, nothing is sent: the stored index is not guessed from the visual position'); assert.equal(v.commands().length, 0); assert.equal(m.probe.released, 1)
  for (const [what, orderReply] of [['not an identity-bearing receipt', () => ({ success: true, current_visual_index: 0, slides: [{ slide_id: sid(0) }] })], ['counts that do not add up', () => orderReceipt([sid(0), sid(1)], 0, { real_slide_count: 5 })], ['no slide id', () => orderReceipt([null, sid(1)], 0)]]) {
    v = viewer({ orderReply }); m = await mountT(ON, v); deepEqual(await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' }), L.failureOutcome('VIEWER_UNAVAILABLE'), `${what}: nothing is sent`); assert.equal(v.commands().length, 0, what)
  }
  // the viewer is busy with another slide change: nothing is sent
  v = viewer(); m = await mountT(ON, v); m.probe.begin = 'none'; const readsBefore = v.calls.length; deepEqual(await m.view().replace({ slideNumber: 1 }, { url: OK_URL, alt: '' }), L.failureOutcome('BUSY')); assert.equal(v.calls.length, readsBefore, 'nothing is read or sent'); assert.equal(m.probe.released, 0, 'nothing was taken, nothing is released')
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
  // progress (Layout !296): the viewer's interim events, heard by the hook's own watch (no change to the bridge), matched on their commandRequestId, from the trusted frame only
  const succeed = { success: true, action: 'setSlideBackgroundPicture', hidden_image_ids: [] }
  const withProgress = async (command, { slide = 1, listen = true, over = {} } = {}) => {
    v = viewer({ command, current: slide - 1 }); m = await mountT(ON, v, { currentSlide: slide, ...over }); const heard = []
    const out = await m.view().replace({ slideNumber: slide }, { url: OK_URL, alt: '' }, listen ? { onProgress: stage => heard.push(stage) } : undefined)
    return { heard, out }
  }
  const events = (win, list, slide = 0) => { for (const [stage, over] of list) win.post(progressEvent(stage, { slide_index: slide, ...(over ?? {}) })) }
  let ran = await withProgress(({ win }) => { events(win, [['saving'], ['writing'], ['repainting']]); return succeed })
  deepEqual(ran.heard, ['saving', 'writing', 'repainting'], 'a full run: each stage, in order'); assert.equal(ran.out.ok, true, 'and the outcome is the reply\'s'); assert.equal(v.listeners.size, 0, 'one listener served the reply and the progress, and it is removed'); assert.equal(v.added.length, 1)
  deepEqual(v.commands()[0].params, { slide_index: 0, slide_id: 'slide_00000001', url: OK_URL }, 'the command carries nothing for progress: the contract\'s params only'); deepEqual(v.commands()[0].options, { timeoutMs: 20000 }, 'and the 20 s budget is kept')
  ran = await withProgress(({ win }) => { events(win, [['saving', { commandRequestId: 'req-S' }], ['writing', { commandRequestId: 'req-S' }], ['repainting', { commandRequestId: 'req-S' }]], 3); return succeed }, { slide: 4 }); deepEqual(ran.heard, ['saving', 'writing', 'repainting'], 'slide 4: its own slide_index (3) matches')
  ran = await withProgress(({ win }) => { events(win, [['saving']]); win.post(reply('SAVE_PENDING', { stage: 'save_pending' })); throw new Error('x') }); deepEqual(ran.heard, ['saving'], 'SAVE_PENDING: a run that stops after saving'); assert.equal(ran.out.code, 'SAVE_PENDING')
  ran = await withProgress(failing(null, 'Command failed')); deepEqual(ran.heard, [], 'no event, no stage: the dialog keeps its plain words')
  ran = await withProgress(({ win }) => { events(win, [['saving'], ['writing']]); win.post(reply('WRITE_FAILED')); throw new Error('raw viewer text that must never be shown') }); deepEqual(ran.heard, ['saving', 'writing']); assert.equal(ran.out.code, 'WRITE_FAILED', 'a route refusal after writing: the code still comes from the reply message'); assert.ok(!JSON.stringify(ran.out).includes('raw viewer text'))
  ran = await withProgress(({ win }) => { events(win, [['saving'], ['writing'], ['repainting']]); win.post(reply('REPAINT_FAILED', { saved: true })); throw new Error('x') }); assert.equal(ran.out.code, 'REPAINT_FAILED'); assert.equal(ran.out.stored, true)
  // a run that never says anything is fine, and so is a caller that does not listen
  ran = await withProgress(({ win }) => { events(win, [['saving'], ['writing']]); return succeed }, { listen: false }); assert.equal(ran.out.ok, true, 'nobody listening: nothing breaks')
  // not heard: an untrusted source (the origin and window check), another run's id after the run began, another slide, an event before "saving", a reply-shaped message, a stage that goes back
  ran = await withProgress(({ win }) => { win.post(progressEvent('saving'), 'somewhere else'); win.post(progressEvent('writing'), 'somewhere else'); return succeed }); deepEqual(ran.heard, [], 'progress from a frame the viewer check does not trust is ignored')
  ran = await withProgress(({ win }) => { events(win, [['saving'], ['writing']]); return succeed }, { over: { isTrustedReply: () => false } }); deepEqual(ran.heard, [], 'and so is all of it when the frame is not the trusted one')
  ran = await withProgress(({ win }) => { events(win, [['saving'], ['writing', { commandRequestId: 'req-OTHER' }], ['repainting', { commandRequestId: 'req-OTHER' }], ['writing']]); return succeed }); deepEqual(ran.heard, ['saving', 'writing'], 'matched on commandRequestId: another run\'s events are not this run\'s')
  ran = await withProgress(({ win }) => { events(win, [['writing'], ['repainting']]); events(win, [['saving']], 5); events(win, [['saving']]); return succeed }); deepEqual(ran.heard, ['saving'], 'events before this run\'s "saving", and another slide\'s, are ignored')
  ran = await withProgress(({ win }) => { win.post({ ...progressEvent('saving'), action: 'setSlideBackgroundPicture' }); win.post({ ...progressEvent('saving'), requestId: 'req-A' }); return succeed }); deepEqual(ran.heard, [], 'a message with an action or a requestId key is a reply, never progress')
  ran = await withProgress(({ win }) => { events(win, [['saving'], ['writing'], ['saving'], ['writing']]); return succeed }); deepEqual(ran.heard, ['saving', 'writing'], 'a stage that goes back or repeats is ignored')
  ran = await withProgress(({ win }) => { events(win, [['saving'], ['somewhere'], ['done']]); return succeed }); deepEqual(ran.heard, ['saving'], 'an unknown stage is never passed on')
  // a progress event is never taken for the reply: even one that carries a code, it adds nothing to the failure's words
  ran = await withProgress(({ win }) => { win.post({ ...progressEvent('writing'), code: 'WRITE_FAILED', saved: true, error: 'raw' }); events(win, [['saving']]); throw new Error('Command failed') }); assert.equal(ran.out.code, 'UNKNOWN', 'only the reply message (the one with the command\'s action) is read for the code'); assert.equal(ran.out.stored, false)
  ran = await withProgress(({ win }) => { events(win, [['saving']]); throw new Error('Command timeout') }); assert.equal(ran.out.code, 'TIMED_OUT', 'progress and then no reply: still the timeout words (it may or may not be stored)')
  // flag off: nothing is read, listened for or sent, and no target is offered
  v = viewer(); m = await mountT({}, v, { enabled: false }); assert.equal(m.view().target, null, 'off: no target'); assert.equal(v.added.length, 0)
  m.root.unmount()
}

// ============================================================================================================================================
// I. the slide on screen, by the viewer's own order (REVIEW-1's P2 and P3s on #636), REAL hook in the offline React host
// ============================================================================================================================================
/** Decks the way REVIEW-1's probe built them (probes/studio636_placeholder_probe_review1.mjs): a, b, c, d are the viewer double's stored slides 0..3 (sid(0)..sid(3)); `placeholders` are the visual positions of Add Slide placeholders; `current` is the viewer's visual position. */
async function slideIdentityChecks(texts = {}) {
  const L = load(LIB, { env: ON, texts }), R = L.REPLACE_PICTURE_REASONS
  const mountT = (env, v, over = {}) => mount(env, v, over, texts)
  const NEW = 'https://pictures.example.test/new.png'
  const sent = v => v.commands().map(c => c.params)
  // each deck: [name, viewer options, the slide number the viewer shows (1-based, placeholders counted), the stored index and id the command must carry]
  const decks = [
    ['a, b, c, d; on c (no placeholder)', { count: 4, placeholders: [], current: 2 }, 3, 2],
    ['a, b, P, c, d; on c (a placeholder BEFORE the slide on screen: it used to be slide_index 3 and d\'s id)', { count: 4, placeholders: [2], current: 3 }, 4, 2],
    ['a, b, P, c; on c, the last slide (it used to be slide_index 3, no slide there)', { count: 3, placeholders: [2], current: 3 }, 4, 2],
    ['a, b, c, P, d; on c (a placeholder after it)', { count: 4, placeholders: [3], current: 2 }, 3, 2],
    ['a, b, c, P, d; on d (after the placeholder)', { count: 4, placeholders: [3], current: 4 }, 5, 3],
    ['P, a, P, P, b; on b (three placeholders before it)', { count: 2, placeholders: [0, 2, 3], current: 4 }, 5, 1],
  ]
  for (const [name, options, slideNumber, stored] of decks) {
    const v = viewer(options), m = await mountT(ON, v, { currentSlide: slideNumber })
    assert.equal(m.view().reason, null, `${name}: on`); assert.equal(m.view().slideId, sid(stored), `${name}: the id reported is the stored slide's, ${sid(stored)}`); assert.equal(m.view().slideNumber, slideNumber, `${name}: the dialog says the viewer's own number`)
    deepEqual(catalogReads(v)[0].params, { slideIndex: slideNumber - 1 }, `${name}: the slot catalog read keeps the visual position (that read is by the viewer's sections)`)
    const out = await m.view().replace({ slideNumber, slideId: m.view().slideId }, { url: NEW, alt: '' })
    assert.equal(out.ok, true, `${name}: replaced`); deepEqual(sent(v), [{ slide_index: stored, slide_id: sid(stored), url: NEW }], `${name}: the command carries the STORED index ${stored} and that slide's id, never the visual position ${slideNumber - 1}`)
    assert.equal(m.probe.released, 1)
  }
  // the eligibility entry is the slide on screen's: by its stored index (REVIEW-1: with d declined and c fine, the button on c was greyed with d's reason)
  let v = viewer({ count: 4, placeholders: [2], current: 3, entries: { 3: { eligible: false, reason: 'PICTURE_DECLINED', target: 'hero_slot' } } }), m = await mountT(ON, v, { currentSlide: 4 })
  assert.equal(m.view().reason, null, 'on c with d declined: on'); assert.equal(m.view().target, 'slide_background', 'c\'s own target (a stored hero by default is 0, 3 and 7: c is stored 2, a content slide), not the visual position\'s')
  v = viewer({ count: 4, placeholders: [2], current: 3, entries: { 2: { eligible: false, reason: 'NO_BACKGROUND_PICTURE', target: 'slide_background' } } }); m = await mountT(ON, v, { currentSlide: 4 })
  assert.equal(m.view().reason, L.upfrontWords('NO_BACKGROUND_PICTURE'), 'c refused (stored 2): greyed with c\'s own reason'); assert.equal(sent(v).length, 0)
  v = viewer({ count: 4, placeholders: [2], current: 3, heroes: [2] }); m = await mountT(ON, v, { currentSlide: 4 }); assert.equal(m.view().target, 'hero_slot', 'a hero by its stored index: hero_slot')
  // progress events carry the stored index too
  v = viewer({ count: 4, placeholders: [2], current: 3, command: ({ win }) => { for (const stage of ['saving', 'writing', 'repainting']) win.post(progressEvent(stage, { slide_index: 2 })); win.post(progressEvent('writing', { slide_index: 3, commandRequestId: 'req-A' })); return { success: true, action: 'setSlideBackgroundPicture', hidden_image_ids: [] } } }); m = await mountT(ON, v, { currentSlide: 4 })
  { const heard = []; const out = await m.view().replace({ slideNumber: 4, slideId: m.view().slideId }, { url: NEW, alt: '' }, { onProgress: stage => heard.push(stage) }); assert.equal(out.ok, true); deepEqual(heard, ['saving', 'writing', 'repainting'], 'the stages of slide_index 2 (stored) are heard; one for the visual position 3 is not') }
  // a placeholder on screen (building, or a failed job\'s card): greyed with plain words, no id, no target, and nothing goes out
  for (const [name, options, slideNumber] of [['a, b, P, c; on P', { count: 3, placeholders: [2], current: 2 }, 3], ['a, b, c, P; on P (a failed job\'s card at the end)', { count: 3, placeholders: [3], current: 3 }, 4], ['P, a; on P', { count: 1, placeholders: [0], current: 0 }, 1]]) {
    v = viewer(options); m = await mountT(ON, v, { currentSlide: slideNumber })
    assert.equal(m.view().reason, R.placeholder, `${name}: greyed with the placeholder words`); assert.equal(m.view().visible, true); assert.equal(m.view().slideId, null, 'no stored slide is on screen'); assert.equal(m.view().target, null)
    const before = v.calls.length, out = await m.view().replace({ slideNumber }, { url: NEW, alt: '' })
    deepEqual(out, L.unavailableOutcome(R.placeholder), `${name}: pressed anyway (a stale button): the same words, nothing sent`); assert.equal(v.calls.length, before, 'nothing read or sent'); deepEqual(m.probe.begins, [], 'the busy state is not taken')
  }
  // moving off the placeholder switches it on, and back on switches it off
  v = viewer({ count: 3, placeholders: [2], current: 2 }); m = await mountT(ON, v, { currentSlide: 3 }); assert.equal(m.view().reason, R.placeholder)
  v.state.current = 3; m.set({ currentSlide: 4 }); await m.settle(); assert.equal(m.view().reason, null, 'on c: on'); assert.equal(m.view().slideId, sid(2)); v.state.current = 2; m.set({ currentSlide: 3 }); await m.settle(); assert.equal(m.view().reason, R.placeholder, 'and back on the placeholder: greyed')
  // a read of another slide than the one Studio shows (the viewer moved on while the reads were in flight) says nothing about this one: no id bound, no eligibility taken from it
  v = viewer({ count: 4, current: 3, entries: { 3: { eligible: false, reason: 'PICTURE_DECLINED', target: 'hero_slot' } } }); m = await mountT(ON, v, { currentSlide: 1 })
  assert.equal(m.view().slideId, null, 'the viewer is on visual 3, Studio shows slide 1: nothing is bound'); assert.equal(m.view().reason, null, 'and the slide the viewer is on (declined) does not grey this one'); assert.equal(m.view().target, null)
  // an order that cannot be read does not grey the button (nothing is known), but a catalog with no report still greys it
  v = viewer({ count: 4, current: 2, orderFails: true, noReport: true }); m = await mountT(ON, v, { currentSlide: 3 }); assert.equal(m.view().reason, R.notOnYet, 'no order, and no report: greyed (Layout\'s flag is off)')
  // a job that starts or ends changes the deck inside the viewer: the order is read again, once per change of the jobs
  v = viewer({ count: 3, placeholders: [2], current: 2 }); const job = status => ({ kind: 'compose', status, targetIndex: 2, targetLayoutIndex: 2 })
  m = await mountT(ON, v, { currentSlide: 3, composeJobs: [job('building')] }); assert.equal(m.view().reason, R.placeholder, 'an Add Slide job is building its placeholder on screen'); assert.equal(orderReads(v).length, 1); assert.equal(catalogReads(v).length, 1)
  m.set({ composeJobs: [job('building')] }); await m.settle(); assert.equal(orderReads(v).length, 1, 'the same jobs (a new array, the same kind and status): no new read')
  v.state.placeholders = []; v.state.count = 4; m.set({ composeJobs: [job('done')] }); await m.settle(); assert.equal(orderReads(v).length, 2, 'the job finished: read again'); assert.equal(catalogReads(v).length, 2); assert.equal(m.view().reason, null, 'the placeholder is a slide now: on'); assert.equal(m.view().slideId, sid(2))
  v.state.placeholders = [2]; v.state.count = 3; m.set({ composeJobs: [job('error')] }); await m.settle(); assert.equal(orderReads(v).length, 3, 'a job that failed leaves its card: read again'); assert.equal(m.view().reason, R.placeholder)
  // the dialog is bound to the slide it was opened for: with the slide gone from under it, Replace sends nothing and says so
  const rebuilt = async (name, change, { bound = true } = {}) => {
    const w = viewer({ count: 4, placeholders: [], current: 2 }), n = await mountT(ON, w, { currentSlide: 3 }), id = n.view().slideId
    assert.equal(id, sid(2), `${name}: bound to c`); change(w); const before = w.commands().length
    const out = await n.view().replace({ slideNumber: 3, ...(bound ? { slideId: id } : {}) }, { url: NEW, alt: '' })
    return { w, n, out, sentAfter: w.commands().slice(before) }
  }
  { const r = await rebuilt('c rebuilt (its id changed)', w => { w.state.ids = { 2: 'slide_rebuilt_c' } }); deepEqual(r.out, L.failureOutcome('SLIDE_CHANGED'), 'the id under the same visual position changed: SLIDE_CHANGED'); assert.equal(r.sentAfter.length, 0, 'and nothing is sent'); assert.equal(r.n.probe.released, 1, 'the busy state is released'); assert.equal(r.n.probe.after, 0) }
  { const r = await rebuilt('another slide moved in', w => { w.state.ids = { 2: sid(3), 3: sid(2) } }); deepEqual(r.out, L.failureOutcome('SLIDE_CHANGED')); assert.equal(r.sentAfter.length, 0) }
  { const r = await rebuilt('a placeholder appeared where c was', w => { w.state.placeholders = [2]; w.state.count = 4 }); deepEqual(r.out, L.failureOutcome('SLIDE_CHANGED'), 'a placeholder stands at that position now'); assert.equal(r.sentAfter.length, 0) }
  { const r = await rebuilt('a placeholder appeared where c was, and the dialog knew no id', w => { w.state.placeholders = [2]; w.state.count = 4 }, { bound: false }); deepEqual(r.out, L.failureOutcome('SLIDE_CHANGED'), 'a placeholder is not a slide whatever the dialog was bound to'); assert.equal(r.sentAfter.length, 0) }
  { const r = await rebuilt('the viewer moved to another slide, and the dialog knew no id', w => { w.state.current = 0 }, { bound: false }); deepEqual(r.out, L.failureOutcome('SLIDE_CHANGED'), 'another slide is on screen'); assert.equal(r.sentAfter.length, 0) }
  { const r = await rebuilt('a placeholder appeared before c and the viewer followed c', w => { w.state.placeholders = [1]; w.state.count = 4; w.state.current = 3 }); deepEqual(r.out, L.failureOutcome('SLIDE_CHANGED'), 'the viewer is on visual 3 now, the dialog was opened on 2'); assert.equal(r.sentAfter.length, 0) }
  { const r = await rebuilt('the viewer moved to another slide', w => { w.state.current = 0 }); deepEqual(r.out, L.failureOutcome('SLIDE_CHANGED')); assert.equal(r.sentAfter.length, 0) }
  { const r = await rebuilt('the same deck, nothing changed', () => {}); assert.equal(r.out.ok, true, 'control: nothing moved, it is written'); deepEqual(r.sentAfter.map(c => c.params), [{ slide_index: 2, slide_id: sid(2), url: NEW }]) }
  { const r = await rebuilt('c rebuilt, but the dialog knew no id when it opened', w => { w.state.ids = { 2: 'slide_rebuilt_c' } }, { bound: false }); assert.equal(r.out.ok, true, 'no id was bound: the slide at that position now is used, with the id just read'); deepEqual(r.sentAfter.map(c => c.params), [{ slide_index: 2, slide_id: 'slide_rebuilt_c', url: NEW }]) }
  // the reason is checked again when Replace is pressed (a state that arose while the dialog was open): the reason's own words, nothing taken, nothing sent
  const arose = [
    [{ building: true }, R.building], [{ studioBusy: true }, R.busy], [{ templateMode: true }, R.template], [{ tabPausedHint: 'This tab is paused (test).' }, 'This tab is paused (test).'], [{ activeVersion: 'strawman' }, R.preview], [{ frameUrl: 'https://layout.test/p/deck-1?viewOnly=true' }, R.viewOnly],
    [{ composeJobs: [{ kind: 'refine', status: 'building', targetSlideId: 'outline-1', targetIndex: 0, targetLayoutIndex: 0 }] }, R.regenerating], [{ mutationPending: true }, R.mutating],
  ]
  for (const [patch, words] of arose) {
    v = viewer(); m = await mountT(ON, v); assert.equal(m.view().reason, null, 'on when the dialog opens'); const id = m.view().slideId
    m.set(patch); await m.settle(); const before = v.calls.length
    const out = await m.view().replace({ slideNumber: 1, slideId: id }, { url: NEW, alt: '' })
    deepEqual(out, L.unavailableOutcome(words), `${JSON.stringify(patch).slice(0, 50)}: arose while the dialog was open: refused with the reason\'s words`); assert.equal(out.code, 'NOT_AVAILABLE'); assert.equal(v.commands().length, 0); assert.equal(v.calls.length, before, 'no read either'); deepEqual(m.probe.begins, [], 'the busy state is not taken'); assert.equal(m.probe.released, 0)
  }
  // Layout's own answer may change while the dialog is open (a re-read lands): the greyed reason is the one Replace honours
  v = viewer(); m = await mountT(ON, v); { const id = m.view().slideId; v.state.entries = { 0: { eligible: false, reason: 'PICTURE_DECLINED', target: 'hero_slot' } }; m.set({ composeJobs: [{ kind: 'compose', status: 'building' }] }); await m.settle()
    assert.equal(m.view().reason, L.upfrontWords('PICTURE_DECLINED')); const before = v.commands().length; deepEqual(await m.view().replace({ slideNumber: 1, slideId: id }, { url: NEW, alt: '' }), L.unavailableOutcome(L.upfrontWords('PICTURE_DECLINED')), 'a refusal that lands after the dialog opened stops the send'); assert.equal(v.commands().length, before) }
  // the viewer is on another slide than the dialog was opened for: SLIDE_CHANGED before anything is taken
  v = viewer(); m = await mountT(ON, v); m.set({ currentSlide: 2 }); v.state.current = 1; await m.settle(); { const before = v.calls.length; deepEqual(await m.view().replace({ slideNumber: 1 }, { url: NEW, alt: '' }), L.failureOutcome('SLIDE_CHANGED')); assert.equal(v.calls.length, before); deepEqual(m.probe.begins, []) }
  // a run that is allowed to start still releases and listens as before
  v = viewer(); m = await mountT(ON, v); await m.view().replace({ slideNumber: 1, slideId: m.view().slideId }, { url: NEW, alt: '' }); assert.equal(m.probe.released, 1); assert.equal(v.listeners.size, 0)
  // a late reply of an earlier run is not this run's: run 1 times out, run 2 times out, and run 1's reply arrives in between
  v = viewer({ command: failing(null, 'Command timeout') }); m = await mountT(ON, v)
  deepEqual(await m.view().replace({ slideNumber: 1 }, { url: NEW, alt: '' }), L.failureOutcome('TIMED_OUT'), 'run 1: no reply in 20 s'); assert.equal(m.probe.after, 0)
  v.state.command = ({ win }) => { win.post(reply('REPAINT_FAILED', { saved: true })); throw new Error('Command timeout') }
  { const out = await m.view().replace({ slideNumber: 1 }, { url: NEW, alt: '' }); deepEqual(out, L.failureOutcome('TIMED_OUT'), 'run 2: run 1\'s late reply (REPAINT_FAILED, saved) arrived during it, and it timed out too: the words are the timeout\'s, not "stored"'); assert.equal(out.stored, false); assert.equal(m.probe.after, 0, 'the rail is not told of a picture nobody confirmed') }
  v.state.command = ({ win }) => { win.post(reply('WRITE_FAILED')); throw new Error('Command failed') }
  assert.equal((await m.view().replace({ slideNumber: 1 }, { url: NEW, alt: '' })).code, 'WRITE_FAILED', 'a failure that is not a timeout still reads the watched reply')
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
  // progress (Layout !296): the stage the viewer has reached is shown in the lib's words, never by name; a run that has said nothing keeps the plain ones; where the picture goes follows Layout's target
  assert.ok(/\{stage \? REPLACE_PICTURE_STAGE_WORDS\[stage\] : "Replacing the picture\."\}/.test(src), 'the running dialog shows the stage\'s words, or the plain ones before any')
  assert.deepEqual([...src.matchAll(/\{[^{}]*\bstage\b[^{}]*\}/g)].map(m => m[0]).sort(), ['{ onProgress?: (stage: ReplacePictureStage) => void }', '{stage ?? "starting"}', '{stage ? REPLACE_PICTURE_STAGE_WORDS[stage] : "Replacing the picture."}'].sort(), 'the stage appears only as the prop\'s type, as those words and as a data attribute, never as text')
  assert.ok(/onProgress: next => \{ if \(mounted\.current\) setStage\(next\) \}/.test(src), 'the dialog listens for progress, and only while it is mounted'); assert.ok(src.includes('setStage(null)'), 'each run starts with no stage')
  assert.ok(src.includes('REPLACE_PICTURE_TARGET_WORDS[target.pictureTarget ?? "unknown"]') && /setTarget\(\{ slideNumber, slideTitle, pictureTarget, slideId \}\)/.test(src), 'the dialog\'s description follows the target Layout reported for the slide it was opened on')
  // REVIEW-1's P2 and P3: the dialog is bound to the slide (its number and Layout\'s id) when it opens, Replace names that slide, and Enter in the failed dialog goes through the same rule as the button
  assert.ok(/useState\(\{ slideNumber, slideTitle, pictureTarget, slideId \}\)/.test(src) && /slideId = null, onReplace,/.test(src), 'the dialog\'s slide includes Layout\'s id, which is none when the hook did not report one')
  assert.ok(src.includes('await onReplace({ slideNumber: target.slideNumber, slideId: target.slideId }, {'), 'Replace names the slide the dialog was opened for, by number and by id, never the one on screen now')
  assert.ok(src.includes('if (!submitAllowed(phase, outcome)) return') && !/if \(phase === "running"\) return/.test(src), 'submit (the button and Enter) asks the lib\'s rule: not while it runs, not after an answer that offers no Try again')
  assert.deepEqual([...src.matchAll(/\bsubmitAllowed\b/g)].length, 2, 'imported once, used once')
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
  assert.match(jsx, /\{replacePicture\.visible && <ReplacePictureControl /, 'the control is drawn only when the hook says visible (flag, shell, a built deck, not presenting)'); assert.match(jsx, /slideId=\{replacePicture\.slideId\}/, 'the control is told Layout\'s id for the slide on screen: the dialog binds to it when it opens'); assert.match(jsx, /pictureTarget=\{replacePicture\.target\}/, 'the control is told where Layout says the picture goes (the dialog\'s words differ for a slide background)'); assert.match(jsx, /reason=\{replacePicture\.reason\}/); assert.match(jsx, /onReplace=\{replacePicture\.replace\}/); assert.match(jsx, /onReloadDeck=\{replacePicture\.reloadDeck\}/)
  assert.match(jsx, /buttonClassName=\{cn\(toolbarButtonClass, toolbarBtnBase\)\}/, 'it wears the toolbar\'s own classes'); assert.ok(viewer0.slice(0, viewer0.indexOf(jsx)).trimEnd().endsWith('</DropdownMenu>') && viewer0.slice(viewer0.indexOf(jsx) + jsx.length).trimStart().startsWith('{presentInStrip && (') && viewer0.indexOf(jsx) < viewer0.indexOf('const deliveryControls = ('), 'it is at the END of the authoring strip, after the Show menu and before Present: no earlier sibling\'s place moves, so the ids React generates for them are the base\'s')
  assert.match(lineWith(viewer0, 'onReplacePictureReloadDeck?: () => void'), /\/\/ REPLACE-PICTURE/); assert.match(lineWith(area, 'onReplacePictureReloadDeck={onReplacePictureReloadDeck}'), /\/\/ REPLACE-PICTURE/)
  const pageProp = lineWith(page, 'onReplacePictureReloadDeck={')
  assert.match(pageProp, /onReplacePictureReloadDeck=\{STUDIO_REPLACE_SLIDE_PICTURE_ENABLED && studioShell \? reloadDeckFromOtherTab : undefined\}/, 'the page passes its own Reload deck only with the flag on'); assert.ok(page.includes('const reloadDeckFromOtherTab = useCallback('), 'which exists')
  // the bridge is untouched, byte for byte: it still rejects with text only, for every command
  const bridge = text => functionText(text, 'function sendCommand(', 'function postCommand(')
  assert.equal(bridge(viewer0), bridge(baseText(VIEWER)), 'sendCommand is the base\'s, byte for byte'); assert.ok(bridge(viewer0).includes("reject(new Error(event.data.error || 'Command failed'))"))
  assert.equal(functionText(viewer0, 'function createViewerRequestId', 'function sendCommand('), functionText(baseText(VIEWER), 'function createViewerRequestId', 'function sendCommand('), 'and so is its request id')
  // the viewer-event allow-list is the base's too: the hook's own listener hears the progress event without it, so no flag-off line moves
  const router = texts[ROUTER] ?? read(ROUTER)
  assert.equal(router, baseText(ROUTER), 'isLayoutViewerEvent\'s allow-list is the base\'s, byte for byte'); assert.ok(!router.includes('setSlideBackgroundPictureProgress'), 'the progress type is not in it')
}

/** The REAL sendCommand, cut out of the viewer's source and run in a vm against a fake frame: a progress event (no action, no requestId key) never settles it, the reply does, and the timeout is the command's own. */
async function bridgeChecks(viewerText = read(VIEWER)) {
  const source = functionText(viewerText, 'type SendCommandOptions = {', 'function postCommand(')
  const messaging = load('lib/layout-viewer-messaging.ts', { id: 'bridge' })
  const origin = 'https://layout.test', ACTION = 'setSlideBackgroundPicture'
  const listeners = new Set(), sent = [], acks = []
  const frameWindow = { postMessage: (message, target) => sent.push({ message, target }) }
  const iframe = { src: `${origin}/p/deck-1`, contentWindow: frameWindow }
  const win = { addEventListener: (type, fn) => { if (type === 'message') listeners.add(fn) }, removeEventListener: (type, fn) => { if (type === 'message') listeners.delete(fn) } }
  const post = (data, from = frameWindow, at = origin) => { for (const fn of [...listeners]) fn({ data, source: from, origin: at }) }
  let uuid = 0
  const context = {
    window: win, crypto: { randomUUID: () => `request-${++uuid}` }, setTimeout, clearTimeout, Promise, Error, URL, getLayoutServiceUrl: () => origin, VIEWER_ORIGIN: origin, LAYOUT_URL_CONFIG_ERROR: null,
    getLayoutViewerOrigin: messaging.getLayoutViewerOrigin, isTrustedLayoutViewerMessage: messaging.isTrustedLayoutViewerMessage, isSlideComposerTraceEnabled: () => false, scTrace: () => {},
    isMatchingSlideComposeCommandResponse: () => assert.fail('the strict (compose / refine) matcher was used'), reportLayoutCommandAck: action => acks.push(action),
  }
  vm.runInNewContext(`${compile('bridge.ts', source)}\nthis.sendCommand = sendCommand`, context)
  const call = (timeoutMs = 1000) => { const out = { state: 'pending', value: null, error: null }; context.sendCommand(iframe, ACTION, { slide_index: 0, url: OK_URL }, { timeoutMs }).then(value => { out.state = 'resolved'; out.value = value }, error => { out.state = 'rejected'; out.error = error }); return out }
  let out = call(); await tick()
  assert.equal(sent.length, 1, 'one command goes out'); assert.equal(sent[0].message.action, ACTION); assert.equal(typeof sent[0].message.requestId, 'string'); assert.equal(sent[0].target, origin)
  const requestId = sent[0].message.requestId
  for (const stage of ['saving', 'writing', 'repainting']) { post(progressEvent(stage, { commandRequestId: requestId })); await tick(); assert.equal(out.state, 'pending', `a "${stage}" progress event does not settle the command`) }
  assert.equal(acks.length, 0, 'and it is not an acknowledged command'); assert.equal(listeners.size, 1, 'the command is still waiting for its reply')
  post({ action: ACTION, requestId: 'another-request', success: true }); await tick(); assert.equal(out.state, 'pending', 'a reply that carries another request\'s id does not settle it')
  post({ action: ACTION, requestId, success: true, hidden_image_ids: [] }, { other: 'window' }); await tick(); assert.equal(out.state, 'pending', 'a reply from another window does not settle it')
  post({ action: ACTION, requestId, success: true, hidden_image_ids: ['image_a'] }); await tick(); assert.equal(out.state, 'resolved', 'the reply settles it'); deepEqual(out.value.hidden_image_ids, ['image_a']); deepEqual(acks, [ACTION]); assert.equal(listeners.size, 0)
  out = call(); await tick(); const second = sent[1].message.requestId; assert.notEqual(second, requestId)
  post(progressEvent('saving', { commandRequestId: second })); post(progressEvent('writing', { commandRequestId: second })); await tick(); assert.equal(out.state, 'pending')
  post({ action: ACTION, requestId: second, success: false, stage: 'route', code: 'WRITE_FAILED', error: 'the reply\'s own text' }); await tick(); assert.equal(out.state, 'rejected', 'a failure reply rejects it'); assert.equal(out.error.message, 'the reply\'s own text', 'with text only (the code is read from the reply message by the hook)')
  out = call(60); await tick(); const third = sent[2].message.requestId; post(progressEvent('saving', { commandRequestId: third })); await new Promise(resolve => setTimeout(resolve, 150))
  assert.equal(out.state, 'rejected', 'progress does not hold the command open past its budget'); assert.equal(out.error.message, 'Command timeout'); assert.equal(listeners.size, 0)
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
// J. the proof's own verdict (REVIEW-1's P3 9): it used to print "0 checks passed" and exit 0 when CHECK_ONLY matched nothing
// ============================================================================================================================================
// VERDICT-BEGIN
/** The proof's exit: non-zero when a check failed, a mutant was missed, or NO check ran at all (a CHECK_ONLY that matches nothing). */
function proofVerdict({ passed, failed, missed }) {
  if (passed === 0 && failed === 0) return { code: 1, message: 'NO CHECK RAN: 0 checks passed (does CHECK_ONLY match the label of a check?)' }
  if (failed > 0 || missed > 0) return { code: 1, message: `${failed} check(s) failed, ${missed} mutant(s) missed` }
  return { code: 0, message: '' }
}
// VERDICT-END
const SELF = 'scripts/test-studio-replace-picture.mjs'
function verdictChecks(text = read(SELF)) {
  const source = functionText(text, 'function proofVerdict(', '// VERDICT-END')
  const verdict = vm.runInNewContext(`(${source.trim()})`)
  deepEqual(verdict({ passed: 0, failed: 0, missed: 0 }), { code: 1, message: 'NO CHECK RAN: 0 checks passed (does CHECK_ONLY match the label of a check?)' }, 'nothing ran: non-zero, and it says so')
  assert.equal(verdict({ passed: 0, failed: 2, missed: 0 }).code, 1, 'nothing passed, some failed'); assert.doesNotMatch(verdict({ passed: 0, failed: 2, missed: 0 }).message, /NO CHECK RAN/, 'and it says they failed, not that none ran'); assert.equal(verdict({ passed: 3, failed: 0, missed: 0 }).code, 0, 'checks ran and passed: zero'); assert.equal(verdict({ passed: 3, failed: 1, missed: 0 }).code, 1, 'a check failed'); assert.equal(verdict({ passed: 3, failed: 0, missed: 1 }).code, 1, 'a mutant was missed')
  assert.equal(verdict({ passed: 1, failed: 0, missed: 0 }).message, '', 'a pass says nothing')
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
await check('A. the lib: the flag, the command and its budget, Layout\'s URL rule, the params, every code\'s words, the failure reader, the runner, the reasons, eligibility, progress', () => libChecks())
await check('B. the hook (REAL, in the offline React host): flag off, the eligibility read, every disabled state, the command on the wire, every reply, the slide changing, a refused deck, Layout\'s eligibility, progress', () => hookChecks())
await check('I. the slide on screen by the viewer\'s own order (REVIEW-1\'s P2): placeholders counted in the visual position and not in the stored index, the dialog bound to the slide\'s id, the reason checked again at Replace, a late reply of an earlier run', () => slideIdentityChecks())
await check('C. the control: the trigger\'s markup and the dialog\'s source', () => controlChecks())
await check('D. the viewer\'s marked lines; the bridge is the base\'s, byte for byte', () => viewerChecks())
await check('D3. the REAL sendCommand (cut out of the viewer, run against a fake frame): a progress event never settles it, the reply does', () => bridgeChecks())
await check('D2. flag off: the REAL viewer\'s server markup is the base viewer\'s, byte for byte (4 environments x 4 decks)', () => markupChecks())
await check('E1. the sources: markers, the strip, the libs, .env.example, secrets, the css', () => sourceChecks(TEXTS))
await check('E2. the registry (three lines, at the true ends)', () => registryChecks(TEXTS[REGISTRY]))
await check('E3. scope, from the COMMITTED diff only; the commits', () => {
  const commits = ownCommits(); assert.ok(commits.length >= 1, 'this change has commits of its own')
  scopeCheck(commits)
  for (const commit of commits) assert.deepEqual(messageProblems(git('log', '-1', '--format=%s', commit), git('log', '-1', '--format=%B', commit)), [], `commit ${commit.slice(0, 8)}`)
})
await check('F. the flag is read from one literal env name', () => { assert.equal((TEXTS[LIB].match(new RegExp(`process\\.env\\.${FLAG}\\b`, 'g')) || []).length, 1) })
await check('J. the proof\'s own verdict: non-zero when no check ran (this very proof is run with a CHECK_ONLY that matches nothing, and with one that matches a cheap check)', () => {
  verdictChecks()
  const child = only => spawnSync(process.execPath, [path.join(root, SELF)], { cwd: root, env: { ...process.env, CHECK_ONLY: only }, encoding: 'utf8', timeout: 120_000 })
  const none = child('no check has a label like this one'); assert.equal(none.status, 1, `CHECK_ONLY matching nothing exits non-zero (got ${none.status})`); assert.match(none.stdout, /0 checks passed/); assert.match(none.stderr, /NO CHECK RAN/, 'and says why')
  const one = child('F. the flag is read'); assert.equal(one.status, 0, `CHECK_ONLY matching one check exits 0 (got ${one.status}: ${one.stderr.slice(0, 200)})`); assert.match(one.stdout, /1 checks passed, 0 failed/)
})

// ---- G. mutants: one edit of the real sources each, fed to the same checks ------------------------------------------------------------------------------------------------------------
const TEXT = { [LIB]: read(LIB), [HOOK]: read(HOOK), [CONTROL]: read(CONTROL), [VIEWER]: read(VIEWER), [AREA]: read(AREA), [PAGE]: read(PAGE), [ROUTER]: read(ROUTER) }
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
  ['lib: a slide Layout calls not eligible is on', M(LIB, "  if (a.eligibility.state === 'known' && !a.eligibility.eligible) return a.eligibility.reason === null ? REPLACE_PICTURE_REASONS.notEligible : upfrontWords(a.eligibility.reason)\n", ''), libChecks],
  ['lib: a Layout with no report is not greyed', M(LIB, "  if (a.eligibility.state === 'absent') return REPLACE_PICTURE_REASONS.notOnYet\n", ''), libChecks],
  ['lib: the not-yet words are not SLIDE-4\'s', M(LIB, "  notOnYet: upfrontWords('LAYOUT_SWITCH_OFF'),", "  notOnYet: 'Replacing a picture is not available.',"), libChecks],
  ['lib: a read in flight is on', M(LIB, "  if (a.eligibility.state === 'loading') return REPLACE_PICTURE_REASONS.checking\n", ''), libChecks],
  ['lib: no report is read as unknown (the button stays on)', M(LIB, "if (!report || report.enabled !== true || !Array.isArray(report.slides)) return { state: 'absent' }", "if (!report || report.enabled !== true || !Array.isArray(report.slides)) return { state: 'unknown' }"), libChecks],
  ['lib: a report that is not enabled still counts', M(LIB, "if (!report || report.enabled !== true || !Array.isArray(report.slides))", "if (!report || !Array.isArray(report.slides))"), libChecks],
  ['lib: the key is read from inside data too', M(LIB, "const report = record(source.backgroundPicture)", "const report = record(source.backgroundPicture ?? record(source.data)?.backgroundPicture)"), libChecks],
  ['lib: eligible is always true', M(LIB, "return { state: 'known', eligible: entry.eligible, reason: entry.eligible ? null : reason, target }", "return { state: 'known', eligible: true, reason: entry.eligible ? null : reason, target }"), libChecks],
  ['lib: the first entry is every slide\'s', M(LIB, "item !== null && item.slide_index === slideIndex)", "item !== null)"), libChecks],
  ['lib: a stray reason stays on an eligible slide', M(LIB, "reason: entry.eligible ? null : reason, target }", "reason, target }"), libChecks],
  ['lib: a reason Layout adds later is shown raw', M(LIB, "const reason = (PICTURE_ELIGIBILITY_REASONS as readonly unknown[]).includes(entry.reason) ? entry.reason as PictureEligibilityReason : null", "const reason = typeof entry.reason === 'string' ? entry.reason as PictureEligibilityReason : null"), libChecks],
  ['lib: a target Layout adds later is taken raw', M(LIB, "const target = entry.target === 'hero_slot' || entry.target === 'slide_background' ? entry.target : null", "const target = typeof entry.target === 'string' ? entry.target as PictureTarget : null"), libChecks],
  ['lib: the greyed words keep "Nothing changed."', M(LIB, "return REPLACE_PICTURE_WORDS[code].replace(/\\s*Nothing changed\\.$/, '')", "return REPLACE_PICTURE_WORDS[code]"), libChecks],
  ['lib: the greyed words are the code', M(LIB, "return REPLACE_PICTURE_WORDS[code].replace(/\\s*Nothing changed\\.$/, '')", "return code"), libChecks],
  ['lib: a slide background is told its pictures are hidden', M(LIB, "slide_background: 'The new picture becomes this slide\\'s background. Pictures already on the slide stay as they are.',", "slide_background: 'The new picture becomes this slide\\'s background. A picture that covers the whole slide is hidden, never deleted.',"), libChecks],
  // progress
  ['lib: a stage is renamed', M(LIB, "export const REPLACE_PICTURE_STAGES = ['saving', 'writing', 'repainting'] as const", "export const REPLACE_PICTURE_STAGES = ['saving', 'writing', 'painting'] as const"), libChecks],
  ['lib: two stages share their words', M(LIB, "  writing: 'Saving the picture\\u2026',", "  writing: 'Saving your edits\\u2026',"), libChecks],
  ['lib: a stage word shows the stage name', M(LIB, "  repainting: 'Redrawing the slide\\u2026',", "  repainting: 'repainting\\u2026',"), libChecks],
  ['lib: the progress tracker binds on any stage', M(LIB, "if (runId === null) { if (at !== 0) return null; runId = id }", "if (runId === null) { runId = id }"), libChecks],
  ['lib: the progress tracker ignores commandRequestId', M(LIB, " else if (id !== runId) return null", ""), libChecks],
  ['lib: the progress tracker takes another slide\'s events', M(LIB, "if (at < 0 || event.slide_index !== slideIndex) return null", "if (at < 0) return null"), libChecks],
  ['lib: the progress tracker takes a reply for progress', M(LIB, "      if ('action' in event || 'requestId' in event) return null\n", ''), libChecks],
  ['lib: the progress tracker lets a stage go back', M(LIB, "      if (at <= last) return null\n", ''), libChecks],
  ['lib: the progress tracker takes any type', M(LIB, "event.type !== REPLACE_PICTURE_PROGRESS_TYPE || ", ""), libChecks],
  ['lib: the progress tracker takes another command\'s event', M(LIB, " || event.command !== REPLACE_PICTURE_COMMAND || event.progress !== true) return null", " || event.progress !== true) return null"), libChecks],
  ['lib: the progress tracker takes an event that is not progress:true', M(LIB, " || event.command !== REPLACE_PICTURE_COMMAND || event.progress !== true) return null", " || event.command !== REPLACE_PICTURE_COMMAND) return null"), libChecks],
  ['lib: the progress tracker takes an empty id', M(LIB, "if (typeof id !== 'string' || id === '') return null", "if (typeof id !== 'string') return null"), libChecks],
  ['lib: a refine job matches any slide', M(LIB, 'return job.targetLayoutIndex === slide.slideIndex || job.targetIndex === slide.slideIndex', 'return true'), libChecks],
  ['lib: the reasons are in another order', M(LIB, "  if (a.building) return REPLACE_PICTURE_REASONS.building\n  if (a.regeneratingThisSlide) return REPLACE_PICTURE_REASONS.regenerating\n", "  if (a.regeneratingThisSlide) return REPLACE_PICTURE_REASONS.regenerating\n  if (a.building) return REPLACE_PICTURE_REASONS.building\n"), libChecks],
  // the slide on screen, the placeholder reason, the P3s (lib)
  ['lib: the slide on screen is the one at the viewer\'s visual position in the list of real slides', M(LIB, "if (slide.visual_index === current) found = { state: 'slide'", "if (layoutIndex === current) found = { state: 'slide'"), libChecks],
  ['lib: the slide on screen is named by its visual position', M(LIB, "visualIndex: current as number, layoutIndex, slideId: slide.slide_id }", "visualIndex: current as number, layoutIndex: current as number, slideId: slide.slide_id }"), libChecks],
  ['lib: a placeholder on screen is not known', M(LIB, "return onPlaceholder ? { state: 'placeholder', visualIndex: current as number } : ORDER_UNKNOWN", 'return ORDER_UNKNOWN'), libChecks],
  ['lib: a placeholder anywhere refuses the deck (the strict reader\'s rule)', M(LIB, 'const slides = value.slides, placeholders = value.placeholders\n', 'const slides = value.slides, placeholders = value.placeholders\n  if (placeholders.length > 0) return ORDER_UNKNOWN\n'), libChecks],
  ['lib: the order\'s action is not checked', M(LIB, "value.action !== 'composeGetState' || ", ''), libChecks],
  ['lib: the order\'s counts are not checked', M(LIB, '  if (value.real_slide_count !== slides.length || value.visual_section_count !== total || value.total_visual_sections !== total) return ORDER_UNKNOWN\n', ''), libChecks],
  ['lib: the order accepts layout indexes out of order', M(LIB, 'if (!slide || slide.layout_index !== layoutIndex || ', 'if (!slide || '), libChecks],
  ['lib: the order accepts two slides at one visual position', M(LIB, '      || visuals.has(slide.visual_index as number) || !validSlideId', '      || !validSlideId'), libChecks],
  ['lib: the order accepts a slide with no id', M(LIB, ' || !validSlideId(slide.slide_id) || ids.has(slide.slide_id)) return ORDER_UNKNOWN', ' || ids.has(slide.slide_id as string)) return ORDER_UNKNOWN'), libChecks],
  ['lib: the order accepts the same id twice', M(LIB, ' || !validSlideId(slide.slide_id) || ids.has(slide.slide_id)) return ORDER_UNKNOWN', ' || !validSlideId(slide.slide_id)) return ORDER_UNKNOWN'), libChecks],
  ['lib: the order accepts a placeholder on a slide\'s place', M(LIB, ' || visuals.has(placeholder.visual_index as number)) return ORDER_UNKNOWN', ') return ORDER_UNKNOWN'), libChecks],
  ['lib: a placeholder on screen does not grey the button', M(LIB, '  if (a.placeholderOnScreen) return REPLACE_PICTURE_REASONS.placeholder\n', ''), libChecks],
  ['lib: a bridge timeout still reads the watched reply', M(LIB, 'isTimeoutFailure(failure) ? null : deps.observed?.() ?? null', 'deps.observed?.() ?? null'), libChecks],
  ['lib: everything is a timeout', M(LIB, 'return /command timeout/i.test(message)\n}', 'return true\n}'), libChecks],
  ['lib: Enter sends again after a no-retry answer', M(LIB, "return phase === 'failed' && outcome !== null && !outcome.ok && outcome.retry", "return phase === 'failed'"), libChecks],
  ['lib: Enter sends while it runs', M(LIB, "  if (phase === 'form') return true\n", "  if (phase === 'form' || phase === 'running') return true\n"), libChecks],
  ['lib: a refusal at Replace offers Try again', M(LIB, "'LAYOUT_SWITCH_OFF', 'ROUTE_UNAVAILABLE', 'NOT_AVAILABLE',\n])", "'LAYOUT_SWITCH_OFF', 'ROUTE_UNAVAILABLE',\n])"), libChecks],
  ['lib: a refusal at Replace loses the reason\'s words', M(LIB, "words: typeof reason === 'string' && reason !== '' ? reason : REPLACE_PICTURE_WORDS.NOT_AVAILABLE }", 'words: REPLACE_PICTURE_WORDS.NOT_AVAILABLE }'), libChecks],
  // the hook
  ['hook: it reads and sends with the flag off', M(HOOK, '  const live = input.enabled && input.deckOpen && input.viewerReady && !input.presenting', '  const live = input.deckOpen && input.viewerReady && !input.presenting'), hookChecks],
  ['hook: it is drawn with the flag off', M(HOOK, '    visible: input.enabled && input.deckOpen && !input.presenting,', '    visible: input.deckOpen && !input.presenting,'), hookChecks],
  ['hook: it is drawn in Present', M(HOOK, '    visible: input.enabled && input.deckOpen && !input.presenting,', '    visible: input.enabled && input.deckOpen,'), hookChecks],
  ['hook: it reads the report while a build runs', M(HOOK, '    if (!live || busy) return\n', '    if (!live) return\n'), hookChecks],
  ['hook: the report is read for the wrong slide', M(HOOK, "{ slideIndex }, { timeoutMs: 8000 }", "{ slideIndex: 0 }, { timeoutMs: 8000 }"), hookChecks],
  ['hook: the identity read at Replace is skipped', M(HOOK, "try { order = readCurrentSlide(await now.send(mutation.iframe, REPLACE_PICTURE_ORDER_COMMAND, {}, { timeoutMs: 5000 })) }", "try { order = readCurrentSlide(null) }"), slideIdentityChecks],
  ['hook: the rail\'s slide id is sent', M(HOOK, 'slideId: order.slideId, url: form.url', 'slideId: latest.current.railSlideId, url: form.url'), slideIdentityChecks],
  ['hook: no slide id is sent', M(HOOK, 'slideId: order.slideId, url: form.url', 'url: form.url'), slideIdentityChecks],
  ['hook: the visual position is sent as the stored index (REVIEW-1\'s P2)', M(HOOK, '{ slideIndex: order.layoutIndex, slideId: order.slideId,', '{ slideIndex: visualIndex, slideId: order.slideId,'), slideIdentityChecks],
  ['hook: the visual position is sent as the stored index (and it stays the rail\'s count)', M(HOOK, '{ slideIndex: order.layoutIndex, slideId: order.slideId,', '{ slideIndex: now.currentSlide - 1, slideId: order.slideId,'), slideIdentityChecks],
  ['hook: progress is read for the visual position', M(HOOK, 'createProgressTracker(order.layoutIndex)', 'createProgressTracker(visualIndex)'), slideIdentityChecks],
  ['hook: the eligibility is read by the visual position', M(HOOK, "readSlideEligibility(catalog, slide.state === 'slide' ? slide.layoutIndex : -1)", 'readSlideEligibility(catalog, slideIndex)'), slideIdentityChecks],
  ['hook: the eligibility is read for stored slide 0 only', M(HOOK, "readSlideEligibility(catalog, slide.state === 'slide' ? slide.layoutIndex : -1)", 'readSlideEligibility(catalog, 0)'), hookChecks],
  ['hook: a read of another slide is taken for this one', M(HOOK, "const moved = order.state !== 'unknown' && order.visualIndex !== slideIndex", 'const moved = false'), slideIdentityChecks],
  ['hook: the order is not read up front', M(HOOK, "{ timeoutMs: 5000 })).then(readCurrentSlide).catch(", "{ timeoutMs: 5000 })).then(() => ({ state: 'unknown' } as CurrentSlide)).catch("), slideIdentityChecks],
  ['hook: a placeholder on screen does not grey the button', M(HOOK, "    placeholderOnScreen: slide.state === 'placeholder',\n", "    placeholderOnScreen: false,\n"), slideIdentityChecks],
  ['hook: the id the dialog was bound to is not checked', M(HOOK, "      if (typeof target.slideId === 'string' && target.slideId !== order.slideId) return failureOutcome('SLIDE_CHANGED')\n", ''), slideIdentityChecks],
  ['hook: a placeholder where the slide was is written anyway', M(HOOK, "if (order.visualIndex !== visualIndex || order.state !== 'slide') return failureOutcome('SLIDE_CHANGED')", "if (order.visualIndex !== visualIndex) return failureOutcome('SLIDE_CHANGED')"), slideIdentityChecks],
  ['hook: a viewer that moved is written anyway', M(HOOK, "if (order.visualIndex !== visualIndex || order.state !== 'slide') return failureOutcome('SLIDE_CHANGED')", "if (order.state !== 'slide') return failureOutcome('SLIDE_CHANGED')"), hookChecks],
  ['hook: an order that cannot be read is written anyway', M(HOOK, "      if (order.state === 'unknown') return failureOutcome('VIEWER_UNAVAILABLE')\n", ''), hookChecks],
  ['hook: the reason is not checked again when Replace is pressed', M(HOOK, '    if (reasonNow.current !== null) return unavailableOutcome(reasonNow.current)\n', ''), slideIdentityChecks],
  ['hook: the reason Replace honours is never the latest', M(HOOK, '  reasonNow.current = shownReason\n', ''), slideIdentityChecks],
  ['hook: Replace refused for a reason answers busy', M(HOOK, 'return unavailableOutcome(reasonNow.current)', "return failureOutcome('BUSY')"), slideIdentityChecks],
  ['hook: the slide the dialog was opened for is not compared with the one on screen', M(HOOK, "    if (now.currentSlide !== target.slideNumber) return failureOutcome('SLIDE_CHANGED')\n", ''), slideIdentityChecks],
  ['hook: a job that starts or ends does not read again', M(HOOK, '[live, busy, key, slideIndex, jobsKey])', '[live, busy, key, slideIndex])'), slideIdentityChecks],
  ['hook: the dialog is not told the slide\'s id', M(HOOK, "    slideId: slide.state === 'slide' ? slide.slideId : null,\n", '    slideId: null,\n'), slideIdentityChecks],
  ['hook: a stale frame is written anyway', M(HOOK, "      if (!mutation.isCurrent()) return failureOutcome('SLIDE_CHANGED')\n      // no order, no slide to name", "      // no order, no slide to name"), hookChecks],
  ['hook: the busy state is never taken', M(HOOK, "    const mutation = now.begin('picture replacement')\n    if (!mutation) return failureOutcome('BUSY')", "    const mutation = { iframe: now.getIframe(), isCurrent: () => true, release: () => {} }"), hookChecks],
  ['hook: the busy state is not released', M(HOOK, '    } finally {\n      mutation.release()\n    }', '    } finally {\n    }'), hookChecks],
  ['hook: the reply listener is left on', M(HOOK, "      } finally {\n        window.removeEventListener('message', watch)\n      }", '      } finally {\n      }'), hookChecks],
  ['hook: any message is taken for the reply or for progress', M(HOOK, "if (!data || typeof data !== 'object' || !now.isTrustedReply(event, frame)) return", "if (!data || typeof data !== 'object') return"), hookChecks],
  ['hook: progress is taken for the reply', M(HOOK, "if (data.action === REPLACE_PICTURE_COMMAND) { reply = data; return }", "if (data.action === REPLACE_PICTURE_COMMAND || data.progress === true) { reply = data; return }"), hookChecks],
  ['hook: progress is not passed on', M(HOOK, "        if (stage !== null) options?.onProgress?.(stage)\n", ''), hookChecks],
  ['hook: progress is read for slide 1 only', M(HOOK, "const progress = createProgressTracker(order.layoutIndex)", "const progress = createProgressTracker(0)"), hookChecks],
  ['hook: every progress event is passed on', M(HOOK, "        const stage = progress.accept(data)\n        if (stage !== null) options?.onProgress?.(stage)", "        const stage = (data as { stage?: ReplacePictureStage }).stage ?? null\n        if (stage !== null) options?.onProgress?.(stage)"), hookChecks],
  ['hook: a failed catalog read greys the slide', M(HOOK, ".catch((): unknown => null)", ".catch((): unknown => ({}))"), hookChecks],
  ['hook: the target is not offered', M(HOOK, "    target: eligibility.state === 'known' ? eligibility.target : null,\n", "    target: null,\n"), hookChecks],
  ['hook: an answer for another slide is used', M(HOOK, "      if (!cancelled) setSlideRead({ key, slide, eligibility })", "      setSlideRead({ key: `${latest.current.presentationId ?? ''}\\u0000${latest.current.currentSlide}`, slide, eligibility })"), hookChecks],
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
  ['control: the running dialog never shows the stage', M(CONTROL, '{stage ? REPLACE_PICTURE_STAGE_WORDS[stage] : "Replacing the picture."}', 'Replacing the picture.'), controlChecks],
  ['control: the running dialog shows the raw stage', M(CONTROL, '{stage ? REPLACE_PICTURE_STAGE_WORDS[stage] : "Replacing the picture."}', '{stage ?? "Replacing the picture."}'), controlChecks],
  ['control: the dialog does not listen for progress', M(CONTROL, ', { onProgress: next => { if (mounted.current) setStage(next) } })', ')'), controlChecks],
  ['control: the stage of an earlier run is kept', M(CONTROL, '    setStage(null)\n', ''), controlChecks],
  ['control: the description ignores the target', M(CONTROL, 'REPLACE_PICTURE_TARGET_WORDS[target.pictureTarget ?? "unknown"]', 'REPLACE_PICTURE_TARGET_WORDS.hero_slot'), controlChecks],
  ['control: the trigger is not disabled', M(CONTROL, '          disabled={blocked}\n', ''), controlChecks],
  ['control: the reason is not a tab stop', M(CONTROL, '<StudioDisabledReason reason={reason} label="Replace picture"', '<StudioDisabledReason reason={null} label="Replace picture"'), controlChecks],
  ['control: the dialog does not bind the slide\'s id when it opens', M(CONTROL, '    setTarget({ slideNumber, slideTitle, pictureTarget, slideId })\n', '    setTarget({ slideNumber, slideTitle, pictureTarget, slideId: null })\n'), controlChecks],
  ['control: Replace names the slide on screen now', M(CONTROL, 'await onReplace({ slideNumber: target.slideNumber, slideId: target.slideId }, {', 'await onReplace({ slideNumber, slideId }, {'), controlChecks],
  ['control: Replace names no id', M(CONTROL, 'await onReplace({ slideNumber: target.slideNumber, slideId: target.slideId }, {', 'await onReplace({ slideNumber: target.slideNumber }, {'), controlChecks],
  ['control: Enter sends in the failed dialog', M(CONTROL, '    if (!submitAllowed(phase, outcome)) return', '    if (phase === "running") return'), controlChecks],
  ['control: it stores the link', M(CONTROL, '    setUrl("")\n    setAlt("")\n', '    localStorage.setItem("u", url)\n    setAlt("")\n'), controlChecks],
  // the viewer's lines
  ['viewer: the flag alone enables it (no shell)', M(VIEWER, 'enabled: STUDIO_REPLACE_SLIDE_PICTURE_ENABLED && studioShell,', 'enabled: STUDIO_REPLACE_SLIDE_PICTURE_ENABLED,'), viewerChecks],
  ['viewer: the build rule is dropped', M(VIEWER, 'building: Boolean(isGenerating || studioPartialArtifact),', 'building: false,'), viewerChecks],
  ['viewer: the page\'s busy rule is dropped', M(VIEWER, 'studioBusy: Boolean(studioFormatBusy),', 'studioBusy: false,'), viewerChecks],
  ['viewer: it sends outside the bridge', M(VIEWER, ' send: sendCommand,', ' send: (frame, action, params) => frame!.contentWindow!.postMessage({ action, params }, "*") as never,'), viewerChecks],
  ['viewer: the control is not told the target', M(VIEWER, ' pictureTarget={replacePicture.target}', ''), viewerChecks],
  ['viewer: the control is not told the slide\'s id', M(VIEWER, ' slideId={replacePicture.slideId}', ''), viewerChecks],
  ['viewer: sendCommand settles on a progress event', M(VIEWER, "        : event.data?.action === action && (options.requireRequestId", "        : (event.data?.action === action || event.data?.progress === true) && (options.requireRequestId"), bridgeChecks],
  ['viewer: sendCommand settles on a progress event (the byte pin)', M(VIEWER, "        : event.data?.action === action && (options.requireRequestId", "        : (event.data?.action === action || event.data?.progress === true) && (options.requireRequestId"), viewerChecks],
  ['router: the allow-list gains the progress type', { [ROUTER]: swap(TEXT[ROUTER], "export function isLayoutViewerEvent(type: string): boolean {\n  return LAYOUT_VIEWER_EVENTS.has(type)", "export function isLayoutViewerEvent(type: string): boolean {\n  return LAYOUT_VIEWER_EVENTS.has(type) || type === 'setSlideBackgroundPictureProgress'") }, viewerChecks],
  ['viewer: the control is drawn whatever the hook says', M(VIEWER, '{replacePicture.visible && <ReplacePictureControl ', '{true && <ReplacePictureControl '), viewerChecks],
  ['viewer: the bridge is edited', M(VIEWER, "            reject(new Error(event.data.error || 'Command failed'))\n", "            reject(new Error(event.data.error || 'Command failed')) // edited\n"), viewerChecks],
  ['viewer: the reply trust check is dropped', M(VIEWER, 'isTrustedReply: (event, frame) => VIEWER_ORIGIN !== null && !LAYOUT_URL_CONFIG_ERROR && isTrustedLayoutViewerMessage(event, frame, VIEWER_ORIGIN),', 'isTrustedReply: () => true,'), viewerChecks],
  ['viewer: the control is a child in the middle of the strip (older siblings\' generated ids move)', { [VIEWER]: (() => { const line = TEXT[VIEWER].split('\n').find(l => l.includes('<ReplacePictureControl ')); const moved = TEXT[VIEWER].replace(line + '\n', ''); return swap(moved, '              {/* Template — "Save as Template"', line + '\n              {/* Template — "Save as Template"') })() }, markupChecks],
  ['page: the reload is passed without the flag', M(PAGE, 'onReplacePictureReloadDeck={STUDIO_REPLACE_SLIDE_PICTURE_ENABLED && studioShell ? reloadDeckFromOtherTab : undefined}', 'onReplacePictureReloadDeck={reloadDeckFromOtherTab}'), viewerChecks],
]
for (const [label, texts, fn] of MUTANTS) await mutant(label, () => fn === bridgeChecks ? fn(texts[VIEWER]) : fn(texts))
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
// (the needles are joined at run time: written whole they would also match these very lines, and a swap needs exactly one match)
const verdictLine = (...parts) => parts.join('')
await mutant('proof: nothing ran is a pass', () => verdictChecks(swap(read(SELF), verdictLine('  if (passed === 0 ', '&& failed === 0) return { code: 1,'), '  if (false) return { code: 1,')))
await mutant('proof: a failed check is a pass', () => verdictChecks(swap(read(SELF), verdictLine('  if (failed > 0 ', '|| missed > 0) return'), '  if (missed > 0) return')))
await mutant('proof: a missed mutant is a pass', () => verdictChecks(swap(read(SELF), verdictLine('  if (failed > 0 ', '|| missed > 0) return'), '  if (failed > 0) return')))
await mutant('proof: a run where every check failed is reported as nothing ran', () => verdictChecks(swap(read(SELF), verdictLine('  if (passed === 0 ', '&& failed === 0) return { code: 1,'), '  if (passed === 0) return { code: 1,')))
await mutant('commit: no co-author line', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'a body\n'), []))
await mutant('commit: another subject', () => assert.deepEqual(messageProblems('Fix a thing', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), []))

console.log(`\n${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (failed.length) console.error(`FAILED: ${failed.join('; ')}`)
if (missed.length) console.error(`MISSED: ${missed.join('; ')}`)
const verdict = proofVerdict({ passed, failed: failed.length, missed: missed.length })
if (verdict.message) console.error(verdict.message)
process.exit(verdict.code)
