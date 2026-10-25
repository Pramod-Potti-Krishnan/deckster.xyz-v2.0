// FRONTEND-2 (PROGRAM-1, DIRECTOR-2 option a): proof for the flag NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT (exact "true", default off, build-time; flips together with Director's DIRECTOR_MDC_BULK_EDIT_POLISH_ENABLED).
// The whole-deck edit confirm card (components/builder/chat/studio-bulk-edit-card.tsx) draws the Director's own sentence for the card, payload.prompt_text, once, under the "Whole-deck change" heading and before the quoted
// instruction. lib/studio-bulk-edit-wire.ts keeps the sentence in the card's model (promptText) only with the flag on: plain text, cleaned and capped like every other text there.
// Run: node scripts/test-studio-bulk-edit-prompt-text.mjs   (plain node: TypeScript transpiled and run in a vm, react-dom server render, `git show` reads the base commit; no network, no browser, no model call)
//
//   1. fixtures   DIRECTOR-2's RECORDED confirm frames: 10 and 11 (Director 4330151d, the I2 polish; copied verbatim, hashes checked) and the older 01 (18fa6604, pre-polish wording): the sentences are what the proof expects
//   2. wire       flag on: the exact sentence is the model's promptText and nothing else about the model differs; flag off (every misspelling too): the model is the base commit's, with no promptText key; missing, empty, blank or
//                 non-string sentences give null; control characters and runs of spaces are cleaned; the cap holds; HTML stays text; a bad sentence never makes the card invalid
//   3. card       the REAL card rendered (stand-ins for icons and the store): flag off the markup is the base commit's, byte for byte (sha256), for every recorded card; flag on the exact sentence appears once, between the
//                 heading and the instruction, HTML is shown as text, the estimate label is said once (in the sentence; the card's own Estimate line is left out), a sentence that lacks the label keeps the Estimate line; an
//                 empty or missing sentence leaves the markup exactly as the flag-off markup
//   4. css        one rule, the card's own text token, nothing new
//   5. pin        the card and the wire lib without the marked lines are BASE_COMMIT's files byte for byte; .env.example is the base plus the block; every added line carries BULK-EDIT-PROMPT-TEXT; no base line changes
//   6. change     the strip, the registry (three lines), scope (the COMMITTED diff only, skipping LATER_CHANGE_FILES), no secret
//   7. mutants    each one must make sections 1-6 fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  BASE_COMMIT, BULK_EDIT_PROMPT_TEXT_CARD, BULK_EDIT_PROMPT_TEXT_ENV_BLOCK, BULK_EDIT_PROMPT_TEXT_FILES, BULK_EDIT_PROMPT_TEXT_MARKER, BULK_EDIT_PROMPT_TEXT_NEW_FILES, BULK_EDIT_PROMPT_TEXT_SCOPE_FILES,
  BULK_EDIT_PROMPT_TEXT_WIRE, stripBulkEditPromptText,
} from './studio-bulk-edit-prompt-text-strip.mjs'
import { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS, stripLaterChanges } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const BASE = process.env.BULK_EDIT_PROMPT_TEXT_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
// This change's OWN committed files: the non-merge commits on the first-parent line BASE..HEAD. The working tree is never consulted (the suites of other changes write into docs/ and scripts/).
const ownCommitted = () => [...new Set(git('log', '--first-parent', '--no-merges', '--name-only', '--format=', `${BASE}..HEAD`).split('\n').filter(Boolean))]
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
let overrides = {} // in-memory mutations: every proof reads its sources through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), deep = count(assert.deepEqual), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const CARD = BULK_EDIT_PROMPT_TEXT_CARD, WIRE = BULK_EDIT_PROMPT_TEXT_WIRE, LIB = 'lib/studio-bulk-edit-prompt-text.ts', CSS = 'components/builder/chat/studio-bulk-edit-prompt-text.css', ENV = '.env.example'
const REGISTRY = 'scripts/studio-later-changes.mjs', STRIP_MODULE = 'scripts/studio-bulk-edit-prompt-text-strip.mjs', THIS_TEST = 'scripts/test-studio-bulk-edit-prompt-text.mjs'
const FLAG = 'NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT', M = BULK_EDIT_PROMPT_TEXT_MARKER
const ON = { [FLAG]: 'true' }
const OFF_STATES = [{}, { [FLAG]: 'false' }, { [FLAG]: 'TRUE' }, { [FLAG]: '1' }, { [FLAG]: '' }, { [FLAG]: ' true' }, { [FLAG]: 'yes' }]

// ---------------------------------------------------------------- loading: the real TypeScript in a vm
const compileCache = new Map()
function compile(rel, text) {
  const cacheId = `${rel}\0${text}`
  if (!compileCache.has(cacheId)) compileCache.set(cacheId, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(cacheId)
}
function loadTs(rel, text, { env = {}, mocks = {}, globals = {} } = {}) {
  const module = { exports: {} }
  const req = spec => {
    if (Object.prototype.hasOwnProperty.call(mocks, spec)) return mocks[spec]
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec === 'react') return React
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(compile(rel, text), { module, exports: module.exports, require: req, process: { env }, Error, ...globals }, { filename: rel })
  return module.exports
}
const wireOf = (env, text = read(WIRE)) => loadTs(WIRE, text, { env })
const baseWire = env => loadTs(WIRE, baseOf(WIRE), { env })
const promptLib = (env = ON) => loadTs(LIB, read(LIB), { env })
const iconStub = name => () => React.createElement('svg', { 'data-icon': name })
const storeStub = { studioBulkEditUndo: { bulk: () => null }, useStudioBulkEditUndoVersion: () => 0 }
function cardOf(cardText, wire, lib) {
  return loadTs(CARD, cardText, { mocks: {
    'lucide-react': { Check: iconStub('check'), Layers: iconStub('layers'), Minus: iconStub('minus'), Sparkles: iconStub('sparkles'), X: iconStub('x') },
    '@/lib/studio-bulk-edit-wire': wire, '@/lib/studio-bulk-edit-store': storeStub, './studio-bulk-edit-undo.css': {}, './studio-bulk-edit-prompt-text.css': {}, '@/lib/studio-bulk-edit-prompt-text': lib,
  } })
}
const renderCard = (mod, model) => renderToStaticMarkup(React.createElement(mod.StudioBulkEditRow, { ask: { message_id: 'msg_fixture' }, model, sessionId: 's_fixture', choose: async () => true }))
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const occurrences = (haystack, needle) => haystack.split(needle).length - 1

// ---------------------------------------------------------------- 1. the recorded frames
const FIXTURES = {
  '01 (18fa6604, pre-polish wording)': 'scripts/fixtures/chat-undo-v2/01-bulk-confirm-card.json',
  '10 (4330151d, title only: the "may shift slightly" caveat)': 'scripts/fixtures/bulk-edit-prompt-text/10-bulk-polish-title-only.json',
  '11 (4330151d, chart slides)': 'scripts/fixtures/bulk-edit-prompt-text/11-bulk-polish-refine-only-and-rebuild-card.json',
}
const SENTENCES = {
  '01 (18fa6604, pre-polish wording)': 'Change 5 slides (slides 1, 2, 3, 4 and 5)? I\'ll apply "Shorten the title" to each one, one or two at a time, keeping each slide in its place. Rough cost: about $0.25 to $0.50.',
  '10 (4330151d, title only: the "may shift slightly" caveat)': 'Change 5 slides (slides 1–5)? I\'ll apply "Shorten the title" to each one, one or two at a time, keeping each slide in its place. Each slide is re-composed with the instruction to change only its title, so its other text and layout should stay as they are but may shift slightly. Rough cost: about $0.25 to $0.50.',
  '11 (4330151d, chart slides)': 'Change 2 chart slides (slides 2 and 4)? I\'ll apply "Use a bar chart" to each one, one or two at a time, keeping each slide in its place. Rough cost: about $0.10 to $0.20.',
}
const confirmFrame = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')).frames.map(f => f.frame).find(f => f && f.type === 'action_request' && f.payload && f.payload.kind === 'bulk_edit_confirm')
const frames = () => Object.fromEntries(Object.entries(FIXTURES).map(([name, file]) => [name, confirmFrame(file)]))
function proveFixtures() {
  const sources = Object.fromEntries(fs.readFileSync(path.join(root, 'scripts/fixtures/bulk-edit-prompt-text/SOURCES.sha256'), 'utf8').split('\n').filter(Boolean).map(line => { const [hash, name] = line.split(/\s+/); return [name, hash] }))
  for (const name of ['10-bulk-polish-title-only.json', '11-bulk-polish-refine-only-and-rebuild-card.json']) {
    eq(sha(fs.readFileSync(path.join(root, 'scripts/fixtures/bulk-edit-prompt-text', name))), sources[name], `fixtures: ${name} is the recorded file (hash)`)
    const original = path.join(root, '..', 'director2-i2-polish', 'docs/mdc/bulk-edit-undo-frames', name)
    if (fs.existsSync(original)) eq(sha(fs.readFileSync(original)), sources[name], `fixtures: ${name} is byte for byte DIRECTOR-2's file`)
  }
  eq(JSON.parse(fs.readFileSync(path.join(root, FIXTURES['10 (4330151d, title only: the "may shift slightly" caveat)']), 'utf8')).director_commit.slice(0, 8), '4330151d', 'fixtures: 10 was recorded at Director 4330151d')
  eq(JSON.parse(fs.readFileSync(path.join(root, FIXTURES['11 (4330151d, chart slides)']), 'utf8')).director_commit.slice(0, 8), '4330151d', 'fixtures: 11 was recorded at Director 4330151d')
  for (const [name, frame] of Object.entries(frames())) {
    eq(frame.payload.prompt_text, SENTENCES[name], `fixtures: ${name}: the recorded sentence`)
    ok(frame.payload.prompt_text.includes(frame.payload.bulk_edit.estimate.label), `fixtures: ${name}: Director's sentence already carries the estimate label ("${frame.payload.bulk_edit.estimate.label}")`)
    ok(!('prompt_text' in frame.payload.bulk_edit), `fixtures: ${name}: prompt_text sits on the payload, not inside bulk_edit`)
  }
}

// ---------------------------------------------------------------- 2. the wire lib
function proveWire(text, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const on = wireOf(ON, text), base = baseWire({})
  for (const [name, frame] of Object.entries(frames())) {
    const model = plain(on.parseBulkEditConfirm(frame)), off = plain(base.parseBulkEditConfirm(frame))
    eq(model.promptText, SENTENCES[name], a(`wire: ${name}: flag on: the exact sentence is promptText`))
    const { promptText, ...rest } = model
    deep(rest, off, a(`wire: ${name}: flag on: nothing else about the model differs`))
    for (const state of OFF_STATES) {
      const head = plain(wireOf(state, text).parseBulkEditConfirm(frame))
      deep(head, off, a(`wire: ${name}: flag off (${JSON.stringify(state)}): the model is the base commit's`))
      ok(!('promptText' in head), a(`wire: ${name}: flag off (${JSON.stringify(state)}): no promptText key`))
    }
  }
  const frame = frames()['10 (4330151d, title only: the "may shift slightly" caveat)']
  const withText = value => { const f = JSON.parse(JSON.stringify(frame)); if (value === undefined) delete f.payload.prompt_text; else f.payload.prompt_text = value; return f }
  const promptOf = value => { const m = on.parseBulkEditConfirm(withText(value)); return m === null ? 'INVALID' : m.promptText }
  for (const value of [undefined, null, '', '   ', '\n\t \u0000', 42, true, {}, [], ['a']]) eq(promptOf(value), null, a(`wire: ${JSON.stringify(value) ?? 'missing'} gives null and the card stays valid`))
  eq(promptOf('  Change 5 slides?  \n\n  Rough   cost: $1.\u0000 '), 'Change 5 slides? Rough cost: $1.', a('wire: control characters and runs of spaces are cleaned, the ends trimmed'))
  const HTML = '<img src=x onerror=alert(1)> & <b>bold</b> "quoted"'
  eq(promptOf(HTML), HTML, a('wire: HTML is kept as TEXT (it is escaped when drawn, never parsed)'))
  eq(promptOf('x'.repeat(600)), 'x'.repeat(600), a('wire: 600 characters pass'))
  eq(promptOf('x'.repeat(601)), `${'x'.repeat(599)}…`, a('wire: the cap is 600 characters, cut with an ellipsis'))
  eq(promptOf(`${'word '.repeat(200)}`).length <= 600, true, a('wire: a long sentence is capped'))
  eq(on.parseBulkEditConfirm({ type: 'action_request', payload: { kind: 'bulk_edit_confirm', prompt_text: 'Only a sentence', actions: [] } }), null, a('wire: a sentence cannot make a malformed frame valid'))
  eq(on.parseBulkEditConfirm(null), null, a('wire: null is still null'))
}

// ---------------------------------------------------------------- 3. the card
const MARKUP_MODELS = () => Object.entries(frames()).map(([name, frame]) => [name, frame])
function proveCard(cardText, wireText, libText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const onWire = wireOf(ON, wireText), onLib = loadTs(LIB, libText, { env: ON })
  const headOn = cardOf(cardText, onWire, onLib)
  const baseCard = cardOf(baseOf(CARD), baseWire({}), { bulkEditPromptCardModel: model => model })
  const HEADING = 'data-studio-bulk-edit-part="heading"', INSTRUCTION = 'data-studio-bulk-edit-part="instruction"', PROMPT = 'data-studio-bulk-edit-part="prompt"', ESTIMATE = 'data-studio-bulk-edit-part="estimate"'
  const offHashes = [], baseHashes = []
  for (const [name, frame] of MARKUP_MODELS()) {
    const offWire = wireOf({}, wireText), offLib = loadTs(LIB, libText, { env: {} })
    const offModel = offWire.parseBulkEditConfirm(frame), baseModel = baseWire({}).parseBulkEditConfirm(frame)
    const offMarkup = renderCard(cardOf(cardText, offWire, offLib), offModel), baseMarkup = renderCard(baseCard, baseModel)
    eq(sha(offMarkup), sha(baseMarkup), a(`card: ${name}: flag off: the markup is the base commit's, byte for byte`))
    nomatch(offMarkup, /data-studio-bulk-edit-part="prompt"/, a(`card: ${name}: flag off: no prompt element`))
    offHashes.push(sha(offMarkup)); baseHashes.push(sha(baseMarkup))
    // flag on
    const model = onWire.parseBulkEditConfirm(frame)
    const markup = renderCard(headOn, model)
    const sentence = SENTENCES[name], label = frame.payload.bulk_edit.estimate.label
    eq(occurrences(markup, escapeHtml(sentence)), 1, a(`card: ${name}: flag on: the exact sentence appears once`))
    eq(occurrences(markup, `<p ${PROMPT}>`), 1, a(`card: ${name}: flag on: one prompt element`))
    ok(markup.indexOf(HEADING) < markup.indexOf(PROMPT) && markup.indexOf(PROMPT) < markup.indexOf(INSTRUCTION), a(`card: ${name}: flag on: under the heading, before the quoted instruction`))
    eq(occurrences(markup, label), 1, a(`card: ${name}: flag on: the estimate label "${label}" is said once (in the sentence)`))
    nomatch(markup, new RegExp(ESTIMATE), a(`card: ${name}: flag on: the card's own Estimate line is left out`))
    ok(markup.includes(`&ldquo;`) || markup.includes('“'), a(`card: ${name}: flag on: the quoted instruction is still drawn`))
    // with the sentence and the estimate line put back/removed, the rest of the card is the flag-off card
    const stripped = markup.replace(new RegExp(`<p ${PROMPT}>[^<]*(?:<[^>]+>[^<]*)*?</p>`), '')
    const offWithoutEstimate = offMarkup.replace(new RegExp(`<p ${ESTIMATE}>[^<]*</p>`), '')
    eq(sha(stripped.replace(/<p data-studio-bulk-edit-part="prompt">.*?<\/p>/, '')), sha(offWithoutEstimate), a(`card: ${name}: flag on: apart from the sentence and the Estimate line, the markup is the flag-off markup`))
    // empty or missing sentence: unchanged
    for (const empty of [null, undefined, '']) {
      const same = renderCard(headOn, { ...offModel, promptText: empty })
      eq(sha(same), sha(offMarkup), a(`card: ${name}: promptText ${JSON.stringify(empty) ?? 'undefined'}: the markup is exactly the flag-off markup`))
    }
    // a sentence that does NOT carry the label: the card's Estimate line stays, the label is still said once
    const other = renderCard(headOn, { ...offModel, promptText: 'Change these slides now.' })
    eq(occurrences(other, label), 1, a(`card: ${name}: a sentence without the label: the label is said once (the Estimate line)`))
    match(other, new RegExp(ESTIMATE), a(`card: ${name}: a sentence without the label keeps the Estimate line`))
    eq(occurrences(other, escapeHtml('Change these slides now.')), 1, a(`card: ${name}: and still draws the sentence once`))
  }
  eq(sha(JSON.stringify(offHashes)), sha(JSON.stringify(baseHashes)), a('card: flag off, sha256 over every recorded card equals the base commit\'s'))
  // HTML is shown as text
  const model = onWire.parseBulkEditConfirm(frames()['11 (4330151d, chart slides)'])
  const html = renderCard(headOn, { ...model, promptText: '<img src=x onerror=alert(1)> & <b>bold</b>', estimateLabel: null })
  ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &lt;b&gt;bold&lt;/b&gt;'), a('card: HTML in the sentence is shown as text, escaped'))
  nomatch(html, /<img|<b>|onerror=alert\(1\)>/, a('card: and no element is made from it'))
  nomatch(cardText.replace(/^\s*\/\/.*$/gm, ''), /dangerouslySetInnerHTML/, a('card: nothing is set as HTML'))
  // the helper on its own
  const lib = onLib
  const m = { estimateLabel: 'about $1', promptText: 'Rough cost: about $1.' }
  ok(lib.bulkEditPromptCardModel(m) !== m && lib.bulkEditPromptCardModel(m).estimateLabel === null, a('lib: a sentence that holds the label drops the estimate label (in a copy)'))
  eq(m.estimateLabel, 'about $1', a('lib: the model it was given is not changed'))
  const n = { estimateLabel: 'about $1', promptText: 'No cost here' }
  eq(lib.bulkEditPromptCardModel(n), n, a('lib: a sentence without the label gives back the very same model'))
  for (const none of [null, undefined, '']) { const k = { estimateLabel: 'about $1', promptText: none }; eq(lib.bulkEditPromptCardModel(k), k, a(`lib: promptText ${JSON.stringify(none) ?? 'undefined'}: the very same model`)) }
  const noLabel = { estimateLabel: null, promptText: 'Sentence' }
  eq(lib.bulkEditPromptCardModel(noLabel), noLabel, a('lib: no estimate label: the same model'))
  nomatch(libText.replace(/^\s*\/\/.*$/gm, ''), /^import (?!type)/m, a('lib: only a type import'))
}

// ---------------------------------------------------------------- 4. the stylesheet
function proveCss(text, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const rules = text.replace(/\/\*[\s\S]*?\*\//g, '').trim()
  const blocks = rules.split('}').map(block => block.trim()).filter(Boolean)
  eq(blocks.length, 1, a('css: one rule'))
  match(blocks[0], /^\[data-studio-v4-shell="true"\] \[data-studio-bulk-edit-part="prompt"\] \{/, a('css: scoped to the Studio shell and to the attribute only the sentence carries'))
  deep([...blocks[0].matchAll(/var\((--[a-z-]+)\)/g)].map(x => x[1]), ['--ss-text'], a('css: the colour is the card\'s own text token, the one the quoted instruction uses'))
  nomatch(blocks[0], /#[0-9a-fA-F]{3,8}\b|rgb|hsl|color-mix|oklch|@media|!important/, a('css: no new colour, no override'))
  const instruction = read('components/builder/chat/studio-bulk-edit-undo.css').split('\n').find(line => line.includes('[data-studio-bulk-edit-part="instruction"]'))
  eq(blocks[0].replace(/^[^{]*\{/, '').trim().replace(/;$/, ''), instruction.replace(/^[^{]*\{/, '').replace(/\}\s*$/, '').trim().replace(/;$/, ''), a('css: it declares what the quoted instruction declares (same size, line height, wrapping)'))
}

// ---------------------------------------------------------------- 5. the pins
const codeOf = line => { const at = line.indexOf(M); return line.slice(0, Math.max(line.lastIndexOf('//', at), line.lastIndexOf('/*', at))).trimEnd() }
const ADDED = {
  [CARD]: [
    'import "./studio-bulk-edit-prompt-text.css"',
    'import { bulkEditPromptCardModel } from "@/lib/studio-bulk-edit-prompt-text"',
    '  model = bulkEditPromptCardModel(model)',
    '          {model.promptText ? <p data-studio-bulk-edit-part="prompt">{model.promptText}</p> : null',
  ],
  [WIRE]: [
    'const MAX_PROMPT_TEXT = 600',
    "const PROMPT_TEXT_ON = process.env.NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT === 'true'",
    '  promptText?: string | null',
    '      ...(PROMPT_TEXT_ON ? { promptText: cleanText(payload.prompt_text, MAX_PROMPT_TEXT) } : {}),',
  ],
}
function provePin(rel, text, at = '', stripFn = stripBulkEditPromptText) {
  const a = message => (at ? `${at}: ${message}` : message)
  const base = baseOf(rel)
  eq(sha(stripFn(rel, text)), sha(base), a(`${rel}: without this change's lines it is ${BASE.slice(0, 8)}'s file byte for byte`))
  const lines = text.split('\n')
  const marked = lines.filter(line => line.includes(M))
  deep(marked.filter(line => !line.trimStart().startsWith('/**')).map(codeOf), ADDED[rel], a(`${rel}: the marked lines are exactly the ones this change adds, in order`))
  eq(marked.length, ADDED[rel].length + (rel === WIRE ? 1 : 0), a(`${rel}: only the added lines carry the marker`))
  deep(lines.filter(line => !line.includes(M)), base.split('\n'), a(`${rel}: every other line is the base's, in order (nothing changed or removed)`))
  eq(stripFn(rel, stripFn(rel, text)), stripFn(rel, text), a(`${rel}: stripping twice changes nothing more`))
  nomatch(text.split('\n').filter(line => !line.includes(M)).join('\n'), /prompt_text|promptText/, a(`${rel}: the sentence is named only on the marked lines`))
}
function proveEnv(envText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  // Later changes stacked after this one register their own .env.example block (scripts/studio-later-changes.mjs, LATER_ENV_BLOCKS) and append it at the end, after a blank line: the file is the base, this block, then those.
  const own = `${baseOf(ENV)}\n${BULK_EDIT_PROMPT_TEXT_ENV_BLOCK}`
  const later = LATER_ENV_BLOCKS.filter(block => block !== BULK_EDIT_PROMPT_TEXT_ENV_BLOCK && !own.includes(String(block).replace(/\n+$/, '')))
  eq(envText, later.reduce((text, block) => (envText.includes(block) ? `${text}\n${block}` : text), own), a('env: .env.example is the base plus this change\'s block, after a blank line, then any later registered block (each after a blank line), at the end'))
  match(BULK_EDIT_PROMPT_TEXT_ENV_BLOCK, /NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT="false"\n$/, a('env: the flag is documented off'))
  match(BULK_EDIT_PROMPT_TEXT_ENV_BLOCK, /DIRECTOR_MDC_BULK_EDIT_POLISH_ENABLED/, a('env: it says it flips together with the Director polish flag'))
  eq(stripLaterChanges(ENV, envText), stripLaterChanges(ENV, baseOf(ENV)), a('env: through the registry it is the base\'s file'))
}

// ---------------------------------------------------------------- 6. the change
function proveChange(stripFn, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  eq(stripFn('app/builder/page.tsx', 'x // BULK-EDIT-PROMPT-TEXT\n'), 'x // BULK-EDIT-PROMPT-TEXT\n', a('strip: another file comes back untouched'))
  eq(stripFn(CARD, 7), 7, a('strip: a non-string comes back'))
  eq(stripFn(CARD, 'a\nb // BULK-EDIT-PROMPT-TEXT x\nc\n'), 'a\nc\n', a('strip: a marked line goes, the rest stays'))
  deep(BULK_EDIT_PROMPT_TEXT_FILES, [CARD, WIRE], a('strip: the two files'))
  ok([...BULK_EDIT_PROMPT_TEXT_SCOPE_FILES].every(rel => fs.existsSync(path.join(root, rel))), a('every file listed exists'))
}
function proveRegistry(registryText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = registryText.split('\n').filter(line => !baseOf(REGISTRY).split('\n').includes(line))
  const mine = added.filter(line => line.includes('studio-bulk-edit-prompt-text-strip.mjs'))
  eq(mine.length, 3, a('registry: this change adds three lines (its files, its block, its strip)'))
  ok(mine.every(line => line.includes('LATER-CHANGE')), a('registry: all carry LATER-CHANGE'))
  ok(mine.some(line => line.includes('BULK_EDIT_PROMPT_TEXT_SCOPE_FILES')) && mine.some(line => line.includes('BULK_EDIT_PROMPT_TEXT_ENV_BLOCK')) && mine.some(line => line.includes('stripBulkEditPromptText')), a('registry: one names the files, one the block, one the strip'))
  ok(added.every(line => line.includes('LATER-CHANGE')), a('registry: every added line, mine and the later changes stacked with it (PR C), is a LATER-CHANGE registration; nothing else in it changed'))
  ok(LATER_STRIPS.some(fn => fn.name === 'stripBulkEditPromptText'), a('registry: holds the strip'))
  ok(LATER_ENV_BLOCKS.includes(BULK_EDIT_PROMPT_TEXT_ENV_BLOCK), a('registry: holds the env block'))
  ok([...BULK_EDIT_PROMPT_TEXT_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)), a('registry: names every file of this change'))
}
function proveRegistryStripsToBase(texts, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  for (const rel of BULK_EDIT_PROMPT_TEXT_FILES) eq(sha(stripLaterChanges(rel, texts[rel])), sha(stripLaterChanges(rel, baseOf(rel))), a(`${rel}: through the registry (innermost, as every older pin reads it) it is the base commit's file`))
}
function proveScope(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  for (const rel of BULK_EDIT_PROMPT_TEXT_SCOPE_FILES) nomatch(rel, /^app\/admin|^components\/admin|^app\/docs|^components\/studio-docs|^app\/help|^components\/help|publish|published|^components\/settings|^app\/\(app\)\/settings|^app\/\(app\)\/billing|^components\/billing|launch-wording|studio-p2-/, a(`scope: ${rel} is not in FRONTEND-1's areas`))
  const committed = ownCommitted()
  const stray = committed.filter(rel => !BULK_EDIT_PROMPT_TEXT_SCOPE_FILES.has(rel) && !LATER_CHANGE_FILES.has(rel))
  deep(stray, [], a(`every file in the committed diff ${BASE.slice(0, 8)}..HEAD is this change's or a registered later change's (no older test is edited)`))
  if (committed.length) {
    deep([...BULK_EDIT_PROMPT_TEXT_SCOPE_FILES].filter(rel => !committed.includes(rel)), [], a('and every file of this change is in the committed diff'))
    ok(committed.filter(rel => /^scripts\/test-/.test(rel)).every(rel => rel === THIS_TEST || LATER_CHANGE_FILES.has(rel)), a('the only test it adds or edits is its own'))
  }
}
function proveSecretScan(texts, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = [LIB, CSS, STRIP_MODULE, THIS_TEST].map(rel => (rel in texts ? texts[rel] : read(rel))).concat(BULK_EDIT_PROMPT_TEXT_FILES.flatMap(rel => texts[rel].split('\n').filter(line => line.includes(M))), BULK_EDIT_PROMPT_TEXT_ENV_BLOCK).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no credential-shaped literal in the added lines'))
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, a('no user:pass@ in an added URL'))
}

// ---------------------------------------------------------------- run everything
function proveAll(stripFn = stripBulkEditPromptText, at = '') {
  const texts = { [CARD]: read(CARD), [WIRE]: read(WIRE) }
  proveFixtures()
  proveWire(texts[WIRE], at)
  proveCard(texts[CARD], texts[WIRE], read(LIB), at)
  proveCss(read(CSS), at)
  for (const rel of BULK_EDIT_PROMPT_TEXT_FILES) provePin(rel, texts[rel], at, stripFn)
  proveEnv(read(ENV), at)
  proveChange(stripFn, at)
  proveRegistry(read(REGISTRY), at)
  proveRegistryStripsToBase(texts, at)
  proveScope(at)
  proveSecretScan(texts, at)
}
proveAll()
console.log(`PASS fixtures, wire, card, css, pins, env, change: ${checks} checks (recorded: ${Object.keys(FIXTURES).length} cards)`)

// =========================================================== 7. mutants
const killed = [], survived = []
function mutant(name, edits, { strip = stripBulkEditPromptText } = {}) {
  const before = overrides
  try {
    overrides = { ...before }
    for (const [rel, from, to, mode] of edits) { // mode: none = the text occurs once; 'all' = every one
      const source = read(rel), n = source.split(from).length - 1
      assert.ok(mode ? n >= 1 : n === 1, `mutant "${name}" no longer applies to ${rel}: ${from.slice(0, 70)}`)
      overrides[rel] = mode === 'all' ? source.split(from).join(to) : source.replace(from, () => to)
    }
    proveAll(strip, name)
  } catch (error) {
    if (/no longer applies/.test(String(error.message))) throw error
    killed.push(name); if (process.env.BULK_EDIT_PROMPT_TEXT_VERBOSE) console.log(`  killed: ${name}\n    by: ${String(error.message).split('\n')[0].slice(0, 170)}`); return
  } finally { overrides = before }
  survived.push(name)
}
const PROMPT_LINE = '          {model.promptText ? <p data-studio-bulk-edit-part="prompt">{model.promptText}</p> : null /* BULK-EDIT-PROMPT-TEXT (default off): Director\'s own sentence, once, as plain text */}\n'
// wire
mutant('wire: the flag is loosened to anything set', [[WIRE, "process.env.NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT === 'true'", 'Boolean(process.env.NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT)']])
mutant('wire: the flag is ignored (always on)', [[WIRE, "process.env.NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT === 'true'", 'true']])
mutant('wire: the key is there with the flag off', [[WIRE, '...(PROMPT_TEXT_ON ? { promptText: cleanText(payload.prompt_text, MAX_PROMPT_TEXT) } : {}),', '...{ promptText: PROMPT_TEXT_ON ? cleanText(payload.prompt_text, MAX_PROMPT_TEXT) : null },']])
mutant('wire: the sentence is not cleaned', [[WIRE, 'promptText: cleanText(payload.prompt_text, MAX_PROMPT_TEXT)', 'promptText: typeof payload.prompt_text === \'string\' ? payload.prompt_text : null']])
mutant('wire: the cap is 1200', [[WIRE, 'const MAX_PROMPT_TEXT = 600', 'const MAX_PROMPT_TEXT = 1200']])
mutant('wire: the sentence is read from bulk_edit', [[WIRE, 'cleanText(payload.prompt_text, MAX_PROMPT_TEXT)', 'cleanText(bulk.prompt_text, MAX_PROMPT_TEXT)']])
mutant('wire: a bad sentence invalidates the card', [[WIRE, 'promptText: cleanText(payload.prompt_text, MAX_PROMPT_TEXT)', 'promptText: (cleanText(payload.prompt_text, MAX_PROMPT_TEXT) ?? (() => { throw new Error(\'no sentence\') })())']])
// lib
mutant('lib: the label test is a prefix test', [[LIB, 'sentence.includes(label)', 'sentence.startsWith(label)']])
mutant('lib: the estimate label is always dropped', [[LIB, 'return label && sentence.includes(label) ? { ...model, estimateLabel: null } : model', 'return { ...model, estimateLabel: null }']])
mutant('lib: the estimate label is never dropped (it would be said twice)', [[LIB, 'return label && sentence.includes(label) ? { ...model, estimateLabel: null } : model', 'return model']])
mutant('lib: the model it was given is changed', [[LIB, '{ ...model, estimateLabel: null }', '(model.estimateLabel = null, model)']])
// card
mutant('card: the sentence is drawn after the instruction', [[CARD, PROMPT_LINE + '          <p data-studio-bulk-edit-part="instruction">&ldquo;{model.instruction}&rdquo;</p>\n', '          <p data-studio-bulk-edit-part="instruction">&ldquo;{model.instruction}&rdquo;</p>\n' + PROMPT_LINE]])
mutant('card: the sentence is drawn twice', [[CARD, PROMPT_LINE, PROMPT_LINE + PROMPT_LINE]])
mutant('card: the sentence is set as HTML', [[CARD, '<p data-studio-bulk-edit-part="prompt">{model.promptText}</p>', '<p data-studio-bulk-edit-part="prompt" dangerouslySetInnerHTML={{ __html: model.promptText }} />']])
mutant('card: the estimate line is not left out (the label is said twice)', [[CARD, '  model = bulkEditPromptCardModel(model) // BULK-EDIT-PROMPT-TEXT (default off): Director\'s own sentence, when the model has one, already says the estimate, so the estimate line is not drawn a second time; no sentence: the same model\n', '']])
mutant('card: an empty sentence draws an empty element', [[CARD, '{model.promptText ? <p', '{model.promptText !== undefined ? <p']])
mutant('card: the attribute is renamed (the rule would not match)', [[CARD, '<p data-studio-bulk-edit-part="prompt">', '<p data-studio-bulk-edit-part="sentence">']])
// css
mutant('css: a hard-coded colour', [[CSS, 'color: var(--ss-text);', 'color: #243438;']])
mutant('css: a muted token instead of the text token', [[CSS, 'color: var(--ss-text);', 'color: var(--ss-muted);']])
mutant('css: not scoped to the Studio shell', [[CSS, '[data-studio-v4-shell="true"] [data-studio-bulk-edit-part="prompt"]', '[data-studio-bulk-edit-part="prompt"]']])
// env, strip, registry
mutant('env: the flag is documented on', [[ENV, 'NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT="false"', 'NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT="true"']])
mutant('env: a base line of .env.example changed', [[ENV, 'NEXT_PUBLIC_STUDIO_PASS3_POLISH="false"', 'NEXT_PUBLIC_STUDIO_PASS3_POLISH="true"']])
mutant('strip: also strips an unmarked line', [], { strip: (rel, text) => (BULK_EDIT_PROMPT_TEXT_FILES.includes(rel) ? text.split('\n').filter(line => !line.includes(M)).slice(0, -2).join('\n') : text) })
mutant('registry: the strip line is gone', [[REGISTRY, "  (await import('./studio-bulk-edit-prompt-text-strip.mjs')).stripBulkEditPromptText, // LATER-CHANGE: FRONTEND-2, bulk edit prompt text (NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT)\n", '']])
mutant('registry: the env block line is gone', [[REGISTRY, "  (await import('./studio-bulk-edit-prompt-text-strip.mjs')).BULK_EDIT_PROMPT_TEXT_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, bulk edit prompt text (NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT)\n", '']])
mutant('registry: the files line is gone', [[REGISTRY, "  ...(await import('./studio-bulk-edit-prompt-text-strip.mjs')).BULK_EDIT_PROMPT_TEXT_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, bulk edit prompt text (NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT)\n", '']])
const FAKE_NAME = ['api', 'Key', 'Value'].join(''), FAKE_VALUE = ['abcdef', '1234567890'].join('') // built here so that this file carries no credential-shaped literal itself
mutant('secret scan: a credential-shaped literal', [[LIB, 'export function bulkEditPromptCardModel', `const ${FAKE_NAME} = '${FAKE_VALUE}'\nexport function bulkEditPromptCardModel`]])

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.error(`SURVIVED:\n  ${survived.join('\n  ')}`); process.exit(1) }
console.log(`test-studio-bulk-edit-prompt-text: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
