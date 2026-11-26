// FRONTEND-1: proof of the narrowed upload picker (wave 1 step 0.9-S; Draft PR #643, finished by FRONTEND-1 as one writer on top of the Codex commit 73ce44ab, which it keeps).
// Flags NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW and NEXT_PUBLIC_STUDIO_UPLOAD_TEXT_FORMATS: each the exact string "true", default off, build-time; the composer checks the Studio shell too.
// NARROW on: the composer's file picker offers only what the Researcher reads today (.pdf .docx .txt .md .xlsx .csv .pptx and the images .png .jpg .jpeg .gif .webp; no .doc, .xls or .ppt), and a file DROPPED on the composer that is not on the same list is left out.
// TEXT_FORMATS acts only with NARROW on: it adds .json .xml .yaml .yml .py .js .ts .java .go .rs (the Researcher reads them only with its own text-formats switch). Off, the picker and the drop are dev's, byte for byte.
//
//   node scripts/test-studio-upload-formats.mjs        (plain node, offline: the REAL lib is transpiled and run in a vm; the REAL picker element and the REAL onDrop handler are cut out of the real composer file and RUN, over stand-ins for the file list;
//                                                     git is read for the strip, the registry and the scope; no network, no browser, no .next)
//
// What it proves (A to G), then mutants (H):
//  A. the lib: the accept string for every flag combination (off and TEXT alone: none, so the base's picker stands; NARROW; NARROW + TEXT; every non-"true" value is off), the helper's table (every extension, upper and lower case, no extension, double extensions, .doc .xls .ppt refused,
//     report.PDF accepted), the picker's accept string and the drop's check built from the SAME lists, one literal env read per flag, nothing imported, nothing mutated;
//  B. the composer, RUN: the picker's rendered markup for every flag and shell combination (flag off: sha256 equal to dev's; on: dev's markup with only the accept string changed) and the drop (every combination over a mixed list of names; flag off: the trace is dev's, sha256 equal;
//     on: only the accepted files go on, in their order; none left: no session is requested and nothing is sent); the lib is imported statically, on a marked line, never required inside the render; the three marked lines sit where they should;
//  C. only insertions: the strip gives dev's composer byte for byte (three marked lines, none rewritten); the older proofs taught gain only marked lines;
//  D. .env.example: one block at the very end, both flags "false", plain words, naming only its own two flags (and no Researcher variable by its full name);
//  E. the registry: exactly three lines, each marked LATER-CHANGE, at the true end of each list;
//  F. scope, read in three states (the pure head; a gate-style merge of it onto dev with the kit's own subject; a PR-style merge with GitHub's subject; the two merges are built here with git commit-tree, no checkout, no index): own commits are the NON-MERGE commits
//     with one of the two subject forms, a merge is never one (only this change's own dev merge keeps its house-form check, by sha), merged into dev the line has none of them and the proof says so and reads them over the whole range; the files, the kept Codex commit and its author, the messages, a secret scan;
//  G. one literal read per flag, only in the lib;
//  H. mutants: each is one edit of the real sources, fed to the same checks, and must be caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'
import * as stripModule from './studio-upload-formats-strip.mjs'
import * as registry from './studio-later-changes.mjs'
import { stripPl42LockedCopy } from './studio-pl42-locked-copy-strip.mjs' // LATER-CHANGES: registry read (PL-42 locked research switches copy): a later change (stacked after this one) registers its lines after this change's; this proof names them as the only lines that may follow

const { BASE_COMMIT, UPLOAD_FORMATS_FLAGS: FLAGS, UPLOAD_FORMATS_MARKER_RE: MARKER_RE, UPLOAD_FORMATS_SUBJECT: SUBJECT, UPLOAD_FORMATS_SUBJECT_RE: SUBJECT_RE, UPLOAD_FORMATS_FIRST_SUBJECT: FIRST_SUBJECT, UPLOAD_FORMATS_FILES: APP_FILES,
  UPLOAD_FORMATS_NEW_FILES: NEW_FILES, UPLOAD_FORMATS_EDITS: EDITS, UPLOAD_FORMATS_PIN_EDITS: PIN_EDITS, UPLOAD_FORMATS_PIN_FILES: PIN_FILES, UPLOAD_FORMATS_PIN_MARK: PIN_MARK, UPLOAD_FORMATS_SCOPE_FILES: SCOPE, UPLOAD_FORMATS_ENV_BLOCK: ENV_BLOCK, UPLOAD_FORMATS_READ_FILES: READ_FILES } = stripModule
const STRIP_FN = stripModule.stripUploadFormats
const [NARROW, TEXT] = FLAGS
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const KEPT_COMMIT = '73ce44ab69e1b705aae16585a7d36e424ebd7140' // the Codex commit, kept with its author

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const nodeRequire = createRequire(path.join(root, 'package.json'))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE_COMMIT}:${rel}`)); return baseCache.get(rel) }
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${String(error?.message ?? error).split('\n').slice(0, 14).join(' | ').slice(0, 700)}`) }
}
let caught = 0
const missed = []
class SwapError extends Error {}
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 160)})`) } else { caught++; console.log(`CAUGHT mutant ${label}${process.env.SHOW_CAUGHT ? ` :: ${String(error?.message ?? error).slice(0, 200)}` : ''}`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }

const LIB = 'lib/studio-upload-formats.ts', CHAT = 'components/builder/chat-input.tsx', REGISTRY = 'scripts/studio-later-changes.mjs', ENV = '.env.example'
const LEGACY = '.pdf,.docx,.doc,.txt,.md,.xlsx,.xls,.csv,.pptx,.ppt,.json,.xml,.yaml,.yml,.png,.jpg,.jpeg,.gif,.webp,.py,.js,.ts,.java,.go,.rs' // dev's accept string, written out here on purpose
const DOCS = ['.pdf', '.docx', '.txt', '.md', '.xlsx', '.csv', '.pptx'], IMAGES = ['.png', '.jpg', '.jpeg', '.gif', '.webp'], TEXTS = ['.json', '.xml', '.yaml', '.yml', '.py', '.js', '.ts', '.java', '.go', '.rs']
const ACCEPT_NARROW = [...DOCS, ...IMAGES].join(','), ACCEPT_TEXT = [...DOCS, ...IMAGES, ...TEXTS].join(',')
const compile = (file, text) => ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
function lineDiff(was, now) {
  const count = new Map(); for (const line of was.split('\n')) count.set(line, (count.get(line) || 0) + 1)
  const added = []; for (const line of now.split('\n')) { const n = count.get(line) || 0; if (n > 0) count.set(line, n - 1); else added.push(line) }
  const removed = []; for (const [line, n] of count) for (let i = 0; i < n; i++) removed.push(line)
  return { added, removed }
}
const SECRET = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-|[A-Za-z]+:\/\/[^\s/:@]+:[^\s/:@]+@)/ // the URL-with-password shape too: the pre-push scan flags it
/** What the strips of the changes registered AFTER this one do to a text (they are other changes' lines and stay when only this strip runs). */
const laterOnly = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip === stripPl42LockedCopy ? strip(rel, out, false) : strip(rel, out); return typeof next === 'string' ? next : out }, text) }   // PL-42's strip, run after this one in the registry, puts its taught proofs back to dev's text but leaves this change's marked lines (rerunEarlier = false)

// ============================================================================================================================================
// the real lib, run with a given environment
// ============================================================================================================================================
const libCache = new Map()
function loadLib(env, texts = {}) {
  const text = texts[LIB] ?? read(LIB), key = `${sha(text)}:${JSON.stringify(env)}`
  if (libCache.has(key)) return libCache.get(key)
  const module = { exports: {} }
  libCache.set(key, module.exports)
  vm.runInNewContext(compile(LIB, text), { module, exports: module.exports, require: spec => nodeRequire(spec), process: { env: { ...env } } }, { filename: LIB })
  return module.exports
}
const ENV_OFF = {}
const envOf = (narrow, text, shell = 'true') => ({ ...(shell === null ? {} : { [SHELL]: shell }), ...(narrow === undefined ? {} : { [NARROW]: narrow }), ...(text === undefined ? {} : { [TEXT]: text }) })
const NOT_TRUE = [undefined, '', 'false', 'True', 'TRUE', '1', ' true', 'true ', 'yes', 'on']

/** The spec in words, written independently of the lib: the file's ending after its last dot, lower-cased, is on the list. */
const specAccepts = (name, text) => { const lower = String(name).toLowerCase(), i = lower.lastIndexOf('.'), ext = i === -1 ? '' : lower.slice(i); return [...DOCS, ...IMAGES, ...(text ? TEXTS : [])].includes(ext) }

// ============================================================================================================================================
// A. the lib
// ============================================================================================================================================
const TABLE = [ // [name, accepted with TEXT off, accepted with TEXT on]
  ...DOCS.map(e => [`file${e}`, true, true]), ...IMAGES.map(e => [`photo${e}`, true, true]), ...TEXTS.map(e => [`data${e}`, false, true]),
  ...[...DOCS, ...IMAGES, ...TEXTS].map(e => [`UPPER${e.toUpperCase()}`, !TEXTS.includes(e), true]), ['report.PDF', true, true], ['Report.Pdf', true, true], ['SHEET.XLSX', true, true], ['Photo.JPG', true, true], ['x.Json', false, true], ['script.PY', false, true],
  ['legacy.doc', false, false], ['legacy.DOC', false, false], ['sheet.xls', false, false], ['slides.ppt', false, false], ['rich.rtf', false, false], ['tab.tsv', false, false], ['page.html', false, false], ['icon.svg', false, false], ['app.tsx', false, false], ['lib.jsx', false, false], ['run.sh', false, false], ['prog.exe', false, false], ['x.json5', false, false], ['x.mdx', false, false], ['x.cmd', false, false],
  ['README', false, false], ['pdf', false, false], ['docx', false, false], ['', false, false], ['.', false, false], ['file.', false, false], ['no extension at all', false, false],
  ['a.tar.gz', false, false], ['a.tar.pdf', true, true], ['archive.zip', false, false], ['report.pdf.exe', false, false], ['report.pdf.doc', false, false], ['notes.txt.bak', false, false], ['v1.2.3.md', true, true], ['x.js.pdf', true, true], ['x.pdf.js', false, true],
  ['.pdf', true, true], ['.hidden', false, false], ['my file (1).pdf', true, true], ['résumé.docx', true, true], ['a/b/c.csv', true, true],
]
function libChecks(texts = {}) {
  const lib = texts[LIB] ?? read(LIB)
  // the lists
  const off = loadLib(ENV_OFF, texts)
  assert.deepEqual([...off.UPLOAD_DOCUMENT_EXTENSIONS], DOCS, 'the documents the Researcher reads today'); assert.deepEqual([...off.UPLOAD_IMAGE_EXTENSIONS], IMAGES, 'the images'); assert.deepEqual([...off.UPLOAD_TEXT_EXTENSIONS], TEXTS, 'the data and source files')
  for (const gone of ['.doc', '.xls', '.ppt']) assert.ok(!off.uploadExtensions(true).includes(gone), `${gone} is never offered (the Researcher reads none of .doc .xls .ppt)`)
  assert.deepEqual([...off.uploadExtensions(false)], [...DOCS, ...IMAGES]); assert.deepEqual([...off.uploadExtensions(true)], [...DOCS, ...IMAGES, ...TEXTS])
  // the accept string for every flag combination
  const accept = (narrow, text) => loadLib(envOf(narrow, text), texts).STUDIO_UPLOAD_ACCEPT
  assert.equal(accept('true', 'false'), ACCEPT_NARROW, 'NARROW: documents and images'); assert.equal(accept('true', undefined), ACCEPT_NARROW, 'NARROW, TEXT unset'); assert.equal(accept('true', 'true'), ACCEPT_TEXT, 'NARROW + TEXT: and the data and source files')
  for (const narrow of [undefined, 'false', ...NOT_TRUE]) for (const text of [undefined, 'false', 'true', ...NOT_TRUE]) if (narrow !== 'true') assert.equal(accept(narrow, text), undefined, `NARROW ${JSON.stringify(narrow)} / TEXT ${JSON.stringify(text)}: off, the base's picker stands (TEXT alone does nothing)`)
  for (const text of NOT_TRUE.filter(v => v !== 'true')) assert.equal(accept('true', text), ACCEPT_NARROW, `TEXT ${JSON.stringify(text)} is not the exact "true": documents and images only`)
  for (const narrow of NOT_TRUE.filter(v => v !== 'true')) assert.equal(accept(narrow, 'true'), undefined, `NARROW ${JSON.stringify(narrow)} is not the exact "true": off`)
  assert.equal(off.uploadAccept(false, true), undefined, 'the pure function: TEXT alone is off'); assert.equal(off.uploadAccept(true, false), ACCEPT_NARROW); assert.equal(off.uploadAccept(true, true), ACCEPT_TEXT); assert.equal(off.uploadAccept(false, false), undefined)
  // the flags as booleans
  for (const [narrow, text] of [['true', 'true'], ['true', 'false'], ['false', 'true'], [undefined, undefined], ['True', '1']]) { const l = loadLib(envOf(narrow, text), texts); assert.equal(l.STUDIO_UPLOAD_FORMATS_NARROW, narrow === 'true'); assert.equal(l.STUDIO_UPLOAD_TEXT_FORMATS, text === 'true') }
  // the helper's table, with the text list off and on
  for (const [name, withoutText, withText] of TABLE) {
    assert.equal(off.acceptsUploadFile(name, false), withoutText, `acceptsUploadFile(${JSON.stringify(name)}, false)`); assert.equal(off.acceptsUploadFile(name, true), withText, `acceptsUploadFile(${JSON.stringify(name)}, true)`)
    assert.equal(specAccepts(name, false), withoutText, `the table agrees with the spec in words: ${JSON.stringify(name)}`); assert.equal(specAccepts(name, true), withText)
  }
  // the helper's default follows the TEXT flag
  for (const text of ['true', 'false', undefined, '1']) { const l = loadLib(envOf('true', text), texts); for (const [name, withoutText, withText] of TABLE) assert.equal(l.acceptsUploadFile(name), text === 'true' ? withText : withoutText, `default for TEXT ${JSON.stringify(text)}: ${JSON.stringify(name)}`) }
  for (const bad of [undefined, null, 5, {}]) assert.equal(off.acceptsUploadFile(bad), false, `a name that is not a string is refused: ${String(bad)}`)
  // the picker's string and the drop's check are one list: every extension of the accept string is accepted and every other extension of dev's string is refused
  for (const [text, accepted] of [[false, ACCEPT_NARROW], [true, ACCEPT_TEXT]]) {
    const listed = accepted.split(',')
    for (const ext of listed) assert.equal(off.acceptsUploadFile(`x${ext}`, text), true, `${ext} is in the accept string and the drop takes it`)
    for (const ext of LEGACY.split(',').filter(e => !listed.includes(e))) assert.equal(off.acceptsUploadFile(`x${ext}`, text), false, `${ext} is not in the accept string and the drop refuses it`)
    assert.equal(off.uploadAccept(true, text), accepted)
  }
  // dev's string is the legacy list, and the narrowed lists are inside it (nothing new is offered)
  assert.ok(ACCEPT_TEXT.split(',').every(e => LEGACY.split(',').includes(e)), 'every narrowed extension is one dev already offered')
  // the helper does not change its input (a string), and the lists are not shared out to be changed
  const first = off.uploadExtensions(false); first.pop(); assert.deepEqual([...off.uploadExtensions(false)], [...DOCS, ...IMAGES], 'a caller changing the returned list changes nothing')
  // text: one literal read per flag, nothing imported
  assert.equal((lib.match(/process\.env\./g) || []).length, 2, 'two env reads in the lib')
  assert.equal((lib.match(new RegExp(`process\\.env\\.${NARROW} === 'true'`, 'g')) || []).length, 1, `${NARROW}: one literal read, compared with the exact "true"`)
  assert.equal((lib.match(new RegExp(`process\\.env\\.${TEXT} === 'true'`, 'g')) || []).length, 1, `${TEXT}: one literal read, compared with the exact "true"`)
  assert.doesNotMatch(lib, /\bimport\b|\brequire\s*\(/, 'the lib imports nothing')
  assert.doesNotMatch(lib, /process\.env\[|process\.env\s*\)|\.\.\.process\.env|const \{[^}]*\} = process\.env/, 'no computed or destructured env read (Next inlines only literal reads)')
}

// ============================================================================================================================================
// B. the composer: the real picker element and the real onDrop handler, run
// ============================================================================================================================================
const astCache = new Map()
const parse = source => { let ast = astCache.get(source); if (!ast) astCache.set(source, ast = ts.createSourceFile(CHAT, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)); return ast }
function declOf(ast, name) { let found; (function visit(n) { if (!found && ts.isVariableDeclaration(n) && n.name.getText(ast) === name) found = n; ts.forEachChild(n, visit) })(ast); assert.ok(found, `the composer declares ${name}`); return found.getText(ast) }
function attrOf(ast, name) { const hits = []; (function visit(n) { if (ts.isJsxAttribute(n) && n.name.getText(ast) === name && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression) hits.push(n.initializer.expression.getText(ast)); ts.forEachChild(n, visit) })(ast); assert.equal(hits.length, 1, `exactly one ${name}= attribute with an expression in the composer`); return hits[0] }
const importsOf = source => source.split('\n').filter(line => line.startsWith('import ') && MARKER_RE.test(line) && line.includes('studio-upload-formats'))
const outCache = new Map()
function evaluate(code, env, texts) {
  let out = outCache.get(code); if (!out) outCache.set(code, out = ts.transpileModule(code, { fileName: CHAT, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)
  const exports = {}
  new Function('exports', 'require', 'process', 'console', out)(exports, id => (id === '@/lib/studio-upload-formats' ? loadLib(env, texts) : nodeRequire(id)), { env }, { log() {}, error() {}, warn() {} })
  return exports.default
}
/** The picker's real element, rendered to markup, with the env a build would have. */
function picker(source, env, texts = {}) {
  const ast = parse(source)
  const element = evaluate(`${importsOf(source).join('\n')}\nconst fileInputRef = { current: null }\nconst ${declOf(ast, 'studio')}\nconst ${declOf(ast, 'hiddenFileInput')}\nexport default hiddenFileInput`, env, texts)
  return { accept: element.props.accept, html: renderToStaticMarkup(element) }
}
/** The real onDrop handler, run over a drop of the given names; what it did, in order. */
async function drop(source, env, names, { enabled = true, texts = {} } = {}) {
  const ast = parse(source)
  const make = evaluate(`${importsOf(source).join('\n')}\nconst ${declOf(ast, 'studio')}\nexport default (features, setIsDraggingFiles, onRequestSession, onFilesSelected) => (${attrOf(ast, 'onDrop')})`, env, texts)
  const trace = []
  const handler = make({ enableFileUploads: enabled }, flag => trace.push(`dragging:${flag}`), () => { trace.push('session'); return Promise.resolve() }, files => trace.push(`files:${files.map(f => f.name).join('|')}`))
  handler({ preventDefault: () => trace.push('preventDefault'), dataTransfer: { files: names.map(name => ({ name })) } })
  await new Promise(resolve => setImmediate(resolve))
  return trace
}
const ENVS = [ // [label, env, which accept string the picker and drop must follow: legacy | narrow | text]
  ['nothing set', envOf(undefined, undefined), 'legacy'], ['both false', envOf('false', 'false'), 'legacy'], ['TEXT alone on', envOf(undefined, 'true'), 'legacy'], ['NARROW false, TEXT on', envOf('false', 'true'), 'legacy'],
  ['NARROW "True"', envOf('True', 'true'), 'legacy'], ['NARROW "1"', envOf('1', 'true'), 'legacy'], ['NARROW " true"', envOf(' true', undefined), 'legacy'],
  ['NARROW on', envOf('true', undefined), 'narrow'], ['NARROW on, TEXT false', envOf('true', 'false'), 'narrow'], ['NARROW on, TEXT "1"', envOf('true', '1'), 'narrow'], ['NARROW on, TEXT "True"', envOf('true', 'True'), 'narrow'],
  ['NARROW + TEXT on', envOf('true', 'true'), 'text'],
  ['both on, the legacy shell (V4_SHELL false)', envOf('true', 'true', 'false'), 'legacy'], ['both on, no shell flag', envOf('true', 'true', null), 'legacy'], ['NARROW on, the legacy shell', envOf('true', undefined, 'false'), 'legacy'], ['both on, the shell "True"', envOf('true', 'true', 'True'), 'legacy'],
]
const MIXED = ['report.pdf', 'legacy.doc', 'Photo.PNG', 'sheet.xls', 'slides.ppt', 'data.JSON', 'notes.md', 'archive.tar.gz', 'script.py', 'README', 'deck.pptx', 'pic.gif', 'image.webp', 'a.jpeg', 'b.jpg', 'c.docx', 'd.txt', 'e.xlsx', 'f.csv', 'x.yaml', 'x.yml', 'x.xml', 'x.js', 'x.ts', 'x.java', 'x.go', 'x.rs', 'Z.PDF']
const DROPS = { mixed: MIXED, 'one accepted': ['a.pdf'], 'none accepted': ['a.doc', 'b.xls', 'c'], 'one refused': ['a.doc'], 'text only': ['a.json', 'b.py'], 'none dropped': [] }
const wantFiles = (names, kind) => names.filter(name => kind === 'legacy' || specAccepts(name, kind === 'text'))
const accepts = { legacy: LEGACY, narrow: ACCEPT_NARROW, text: ACCEPT_TEXT }
async function composerChecks(texts = {}, sink = {}) {
  const head = texts[CHAT] ?? read(CHAT), base = baseText(CHAT)
  const traces = [], pickers = []
  for (const [label, env, kind] of ENVS) {
    const before = picker(base, env), after = picker(head, env, texts)
    assert.equal(before.accept, LEGACY, `${label}: dev's picker is the legacy list`); assert.equal(after.accept, accepts[kind], `${label}: the picker's accept string`)
    assert.equal(after.html, before.html.replace(`accept="${LEGACY}"`, `accept="${accepts[kind]}"`), `${label}: the picker's markup is dev's with only the accept string changed`)
    if (kind === 'legacy') { assert.equal(sha(after.html), sha(before.html), `${label}: flag off, the picker's markup is dev's, sha256 equal`); pickers.push([sha(before.html), sha(after.html)]) }
    for (const [dropLabel, names] of Object.entries(DROPS)) {
      const was = await drop(base, env, names), now = await drop(head, env, names, { texts })
      const want = wantFiles(names, kind), expected = [`preventDefault`, 'dragging:false', ...(want.length ? ['session', `files:${want.join('|')}`] : [])]
      assert.deepEqual(was, [`preventDefault`, 'dragging:false', ...(names.length ? ['session', `files:${names.join('|')}`] : [])], `${label} / ${dropLabel}: dev's drop sends every file`)
      assert.deepEqual(now, expected, `${label} / ${dropLabel}: the drop follows the ${kind} list${want.length ? '' : ' (none left: no session, nothing sent)'}`)
      if (kind === 'legacy') { assert.equal(sha(JSON.stringify(now)), sha(JSON.stringify(was)), `${label} / ${dropLabel}: flag off, the drop's trace is dev's, sha256 equal`); traces.push([sha(JSON.stringify(was)), sha(JSON.stringify(now))]) }
    }
    // uploads off: nothing happens, with the flag on or off (dev's own guard stands)
    assert.deepEqual(await drop(head, env, MIXED, { enabled: false, texts }), await drop(base, env, MIXED, { enabled: false }), `${label}: with file uploads off the drop does what dev's does`)
  }
  // the order of the files that go on is the order they were dropped in
  assert.deepEqual((await drop(head, envOf('true', 'true'), ['z.pdf', 'b.doc', 'a.png', 'y.json'], { texts }))[3], 'files:z.pdf|a.png|y.json')
  sink.pickers = pickers; sink.traces = traces
  composerTextChecks(texts)
}
function composerTextChecks(texts = {}) {
  const head = texts[CHAT] ?? read(CHAT), ast = parse(head), lines = head.split('\n')
  // the lib is imported statically, at the top level, on a marked line; never required inside the render
  const imports = ast.statements.filter(s => ts.isImportDeclaration(s) && s.moduleSpecifier.getText(ast).includes('studio-upload-formats'))
  assert.equal(imports.length, 1, 'one static import of the lib, at the top level'); assert.ok(MARKER_RE.test(lines[ast.getLineAndCharacterOfPosition(imports[0].getStart(ast)).line]), 'the import line carries the marker')
  assert.ok(imports[0].importClause && !imports[0].importClause.isTypeOnly && imports[0].importClause.namedBindings && ts.isNamedImports(imports[0].importClause.namedBindings), 'a plain named import (not a type import, not a namespace)')
  assert.deepEqual(imports[0].importClause.namedBindings.elements.map(e => e.name.text), ['STUDIO_UPLOAD_ACCEPT', 'acceptsUploadFile'], 'it takes the accept string and the helper')
  assert.doesNotMatch(head, /require\s*\(\s*['"]@\/lib\/studio-upload-formats|import\s*\(\s*['"]@\/lib\/studio-upload-formats|typeof import\(/, 'no require, dynamic import or import type inside the render')
  assert.equal((head.match(/studio-upload-formats/g) || []).length, 2 + 0, 'the lib is named by the import line and the accept line\'s comment only (the lib\'s own path)') // the import path, the spread's comment
  // three marked lines in three places
  const marked = lines.map((line, i) => (MARKER_RE.test(line) ? i : -1)).filter(i => i >= 0)
  assert.equal(marked.length, 3, 'three marked lines in the composer (the import, the accept spread, the drop)')
  const [imp, spread, dropLine] = marked
  assert.ok(lines[imp].startsWith('import { STUDIO_UPLOAD_ACCEPT, acceptsUploadFile } from \'@/lib/studio-upload-formats\''), 'the import')
  assert.ok(lines[spread].trim().startsWith('{...(studio && STUDIO_UPLOAD_ACCEPT ? { accept: STUDIO_UPLOAD_ACCEPT } : ({} as { accept?: string }))}'), 'the spread: the Studio shell and the narrow flag, else nothing (the empty object is typed so that the base\'s accept above is not an overwritten attribute for tsc, TS2783)')
  assert.ok(/^\s*accept="/.test(lines[spread - 1]) && /^\s*onChange=\{/.test(lines[spread + 1]), 'the spread sits right after the base\'s accept attribute (it overrides it only when on) and before onChange')
  assert.ok(lines[dropLine].trim().startsWith('if (studio && STUDIO_UPLOAD_ACCEPT) files.splice(0, files.length, ...files.filter(file => acceptsUploadFile(file.name)))'), 'the drop line: only with the Studio shell and the narrow flag, the dropped list is cut to what the picker offers')
  assert.ok(lines[dropLine - 1].trim() === 'const files = Array.from(e.dataTransfer.files)' && lines[dropLine + 1].trim() === 'if (files.length > 0) {', 'the drop line sits between the list and the base\'s own length test (so a drop with nothing left asks for no session)')
  assert.equal((head.match(/acceptsUploadFile/g) || []).length, 2, 'the helper is used once (and imported once)'); assert.equal((head.match(/STUDIO_UPLOAD_ACCEPT/g) || []).length, 4, 'the accept string is imported once and used twice (the spread has it twice)')
  // the picker's own onChange path and the base's other lines are untouched (an <input accept> is a hint a person can widen in the file dialog; this change does not add a filter there)
  assert.equal((head.match(/acceptsUploadFile\(/g) || []).length, 1, 'only the drop filters files')
}

// ============================================================================================================================================
// C. only insertions: the strip gives dev's composer byte for byte
// ============================================================================================================================================
function diffChecks(texts = {}, strip = STRIP_FN, edits = EDITS) {
  const now = texts[CHAT] ?? read(CHAT), base = baseText(CHAT)
  const out = strip(CHAT, laterOnly(CHAT, now))
  assert.equal(out, base, `${CHAT}: without this change's lines the composer is dev's, byte for byte`); assert.equal(strip(CHAT, out), out, `${CHAT}: stripping twice changes nothing more`); assert.notEqual(now, base, `${CHAT}: the change is there to strip`)
  const diff = lineDiff(base, laterOnly(CHAT, now))
  assert.deepEqual(diff.removed, [], 'no base line is rewritten or lost: every change to the composer is a pure insertion')
  assert.equal(edits[CHAT].length, 3, 'three insertions, one per marked line'); assert.equal(edits[CHAT].filter(([, was]) => was !== '').length, 0, 'every pair of the strip is an insertion (its `was` is empty)')
  assert.ok(edits[CHAT].every(([has]) => has.endsWith('\n') && has.split('\n').length === 2), 'each is one whole line')
  for (const line of diff.added) assert.match(line, MARKER_RE, `a line added to the composer carries the marker: ${line.trim().slice(0, 100)}`)
  assert.deepEqual([...diff.added].sort(), edits[CHAT].flatMap(([has]) => has.split('\n').filter(Boolean)).sort(), 'the lines added to the composer are exactly the strip\'s')
  for (const rel of ['app/builder/page.tsx', 'lib/file-validation.ts', 'hooks/use-file-upload.ts', 'components/file-upload-button.tsx', ENV, REGISTRY]) assert.equal(STRIP_FN(rel, 'x\nSTUDIO-UPLOAD-FORMATS\n'), 'x\nSTUDIO-UPLOAD-FORMATS\n', `${rel}: a file this change does not edit comes back as it is`)
  assert.equal(STRIP_FN(CHAT, 5), 5, 'a text that is not a string comes back as it is'); assert.equal(STRIP_FN(CHAT, 'x\nSTUDIO-UPLOAD-FORMATS\n'), 'x\nSTUDIO-UPLOAD-FORMATS\n', 'a text with no edit in it comes back as it is')
  // the strip gives dev's bytes for every existing file this change edits (the composer, .env.example, the registry, the older proofs), twice over
  assert.deepEqual([...READ_FILES].sort(), [CHAT, ENV, REGISTRY, ...PIN_FILES].sort(), 'the files an older proof reads through the strip are the ones this change edits')
  for (const rel of READ_FILES) { const mine = laterOnly(rel, texts[rel] ?? read(rel)); assert.equal(strip(rel, mine), baseText(rel), `${rel}: without this change's lines it is dev's, byte for byte`); assert.equal(strip(rel, strip(rel, mine)), baseText(rel), `${rel}: putting back twice changes nothing more`) }
  assert.equal(edits[ENV].length, 1, 'one pair for .env.example: the block, last'); assert.equal(edits[ENV][0][0], `\n${ENV_BLOCK}`, 'the blank line and the whole block'); assert.equal(edits[ENV][0][1], '')
  assert.equal(edits[REGISTRY].length, 3, 'three pairs for the registry: its three lines'); assert.ok(edits[REGISTRY].every(([has, was]) => was === '' && has.endsWith('\n') && has.includes('studio-upload-formats-strip.mjs') && has.includes('// LATER-CHANGE: FRONTEND-1, Upload formats:')), 'each a whole marked line')
  // the files this change must not touch are dev's, byte for byte (the upload hook, the validator, the page: the drop is cut in the composer only)
  for (const rel of ['app/builder/page.tsx', 'hooks/use-file-upload.ts', 'lib/file-validation.ts', 'components/file-upload-button.tsx']) assert.equal(laterOnly(rel, texts[rel] ?? read(rel)), baseText(rel), `${rel} is dev's file, byte for byte`)
}
const PIN_GAINS = { // [lines gained, lines lost (the three that rewrite one line)]
  'scripts/test-studio-chat-element-edit.mjs': [1, 0], 'scripts/test-studio-deck-sync-truth.mjs': [1, 0], 'scripts/test-studio-connectors-gdrive-composer.mjs': [1, 0], 'scripts/test-studio-my-companions-wiring.mjs': [3, 1], 'scripts/test-studio-research-by-level.mjs': [8, 2],
}
function pinChecks(texts = {}, mod = stripModule) {
  const strip = mod.stripUploadFormats, pinFiles = mod.UPLOAD_FORMATS_PIN_FILES
  assert.deepEqual([...pinFiles].sort(), Object.keys(PIN_GAINS).sort(), 'the older proofs this change teaches')
  for (const [rel, gained] of Object.entries(PIN_GAINS)) {
    const now = laterOnly(rel, texts[rel] ?? read(rel)), diff = lineDiff(baseText(rel), now)
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's lines the proof is dev's, byte for byte`); assert.equal(strip(rel, strip(rel, now)), strip(rel, now), `${rel}: putting back twice changes nothing more`)
    assert.deepEqual([diff.added.length, diff.removed.length], gained, `${rel}: the proof gains ${gained[0]} marked line(s) and loses ${gained[1]}`)
    for (const line of diff.added) assert.ok(line.includes(mod.UPLOAD_FORMATS_PIN_MARK), `${rel}: a line added to the proof carries the pin mark: ${line.trim().slice(0, 100)}`)
  }
  for (const rel of ['scripts/test-studio-chat-element-edit.mjs', 'scripts/test-studio-deck-sync-truth.mjs']) {
    const added = lineDiff(baseText(rel), texts[rel] ?? read(rel)).added.filter(line => line.includes('shas.splice'))
    assert.equal(added.length, 1, `${rel}: one splice line`)
    assert.ok(added[0].includes('/^(Upload formats:|Narrow Studio upload formats behind flags\\s*$)/.test(git(\'log\', \'-1\', \'--format=%s\', sha))'), `${rel}: the splice names both subject forms of this change (the first has no prefix; a subject read from git ends in a newline) and nothing else`)
    assert.ok(!/Research by level|Research default|Research switch/.test(added[0]), `${rel}: and no other change's subject`)
  }
  // both subject forms, as the proofs' own test sees them (git's subject ends in a newline)
  const re = /^(Upload formats:|Narrow Studio upload formats behind flags\s*$)/
  for (const subject of ['Upload formats: a fix\n', 'Narrow Studio upload formats behind flags\n', 'Narrow Studio upload formats behind flags', 'Upload formats: merge 374d697a (dev)\n']) assert.ok(re.test(subject), `taken out of the first-parent line: ${JSON.stringify(subject)}`)
  for (const subject of ['Narrow Studio upload formats behind flags too\n', 'Upload formats\n', 'Research by level: x\n', ' Upload formats: x\n', 'upload formats: x\n']) assert.ok(!re.test(subject), `not taken out: ${JSON.stringify(subject)}`)
  assert.ok(mod.UPLOAD_FORMATS_SUBJECT_RE.source === re.source, 'the strip module\'s regex is the splice lines\'')
  assert.equal(Object.values(mod.UPLOAD_FORMATS_PIN_EDITS).flat().length, Object.values(PIN_GAINS).reduce((a, [added]) => a + added, 0), 'one pin edit per gained line')
  const rewrites = Object.entries(mod.UPLOAD_FORMATS_PIN_EDITS).flatMap(([rel, pairs]) => pairs.filter(([, was]) => was !== '').map(pair => [rel, ...pair]))
  assert.deepEqual(rewrites.map(([rel]) => rel).sort(), ['scripts/test-studio-my-companions-wiring.mjs', 'scripts/test-studio-research-by-level.mjs', 'scripts/test-studio-research-by-level.mjs'], 'three pairs rewrite a line: the My companions list of files dev must not have (once), the research-by-level proof\'s "runs last" and "no file outside its scope" (once each)')
  for (const [rel, has, was] of rewrites) { assert.ok(baseText(rel).includes(was) && !baseText(rel).includes(has), `${rel}: the old line is dev's`); assert.ok(has.includes(mod.UPLOAD_FORMATS_PIN_MARK), `${rel}: the new line carries the pin mark`); assert.ok(was.endsWith('\n') && has.endsWith('\n'), `${rel}: whole lines`) }
  // the taught reads: an import of this change's own strip (never the registry) and one patched read, in the two proofs that hold files to their bytes; one stub in the Drive composer proof
  for (const [rel, list] of [['scripts/test-studio-my-companions-wiring.mjs', 'UPLOAD_FORMATS_FILES'], ['scripts/test-studio-research-by-level.mjs', 'UPLOAD_FORMATS_READ_FILES']]) {
    const gained = lineDiff(baseText(rel), texts[rel] ?? read(rel)).added
    assert.equal(gained.filter(l => l.startsWith(`import { stripUploadFormats, ${list}`) && l.includes("from './studio-upload-formats-strip.mjs'")).length, 1, `${rel}: imports this change's own strip (not the registry)`)
    assert.equal(gained.filter(l => l.startsWith('{ const realRead = fs.readFileSync;') && l.includes(`${list}.includes(rel) ? stripUploadFormats(rel, out) : out`) && !l.includes('registry.')).length, 1, `${rel}: reads the files this change edits through it`)
  }
  assert.equal(lineDiff(baseText('scripts/test-studio-connectors-gdrive-composer.mjs'), texts['scripts/test-studio-connectors-gdrive-composer.mjs'] ?? read('scripts/test-studio-connectors-gdrive-composer.mjs')).added.filter(l => l.startsWith("  '@/lib/studio-upload-formats': { STUDIO_UPLOAD_ACCEPT: undefined, acceptsUploadFile: () => true },")).length, 1, 'the Drive composer proof loads the real composer over stubs: it gets a stub for the upload formats lib (flag off: no narrowed accept string, every dropped file goes on)')
  const mc = lineDiff(baseText('scripts/test-studio-my-companions-wiring.mjs'), texts['scripts/test-studio-my-companions-wiring.mjs'] ?? read('scripts/test-studio-my-companions-wiring.mjs'))
  assert.ok(mc.removed.length === 1 && mc.removed[0].startsWith('const UNTOUCHED = [') && mc.removed[0].includes("'lib/studio-upload-formats.ts'") && mc.added.some(l => l.startsWith('const UNTOUCHED = [') && !l.includes("'lib/studio-upload-formats.ts'") && l.includes('(STUDIO-UPLOAD-FORMATS)')), 'the My companions list of files dev must not have no longer names the lib this change creates')
}

// ============================================================================================================================================
// D. .env.example: one block, at the very end
// ============================================================================================================================================
function envChecks(texts = {}, block = ENV_BLOCK) {
  const env = texts[ENV] ?? read(ENV)
  assert.ok(env.endsWith(`\n${block}`), '.env.example ends with the block (at the very end)')
  assert.equal(env.slice(0, env.length - block.length - 1), baseText(ENV), '.env.example is dev\'s file plus that one blank-line-separated block')
  assert.equal(baseText(ENV).trimEnd().split('\n').at(-1), 'NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL="false"', 'the block follows the last block of dev (research by level\'s)')
  const lines = block.split('\n').filter(Boolean), comments = lines.filter(l => l.startsWith('#')), assignments = lines.filter(l => !l.startsWith('#'))
  assert.deepEqual(assignments, [`${NARROW}="false"`, `${TEXT}="false"`], 'the block ends with its two assignments, both "false", the narrow flag first'); assert.equal(lines.slice(-2).join('\n'), assignments.join('\n'), 'the assignments come last')
  assert.ok(comments.length >= 2 && comments.length <= 4, `two to four comment lines (found ${comments.length})`)
  for (const flag of FLAGS) assert.equal((env.match(new RegExp(`^${flag}=`, 'gm')) || []).length, 1, `.env.example assigns ${flag} once`)
  assert.deepEqual([...block.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)].map(m => m[0]).sort(), [...FLAGS].sort(), 'the block names its own two flags, each once (its assignment), and no other (an older proof counts flag names)')
  assert.doesNotMatch(block, /RESEARCHER_|[A-Z]{3,}_[A-Z]{3,}_ENABLED/, 'the Researcher\'s variable is named in prose, never by its full name')
  for (const words of ['exact value "true"', 'default off', 'off, nothing changes', 'Build-time values', 'Studio shell', '.pdf .docx .txt .md .xlsx .csv .pptx', '.png .jpg .jpeg .gif .webp', 'no .doc, .xls or .ppt', 'left out', '.json .xml .yaml .yml .py .js .ts .java .go .rs', 'only after the Researcher\'s text-formats switch is on in the same environment']) assert.ok(block.includes(words), `the block says: ${words}`)
  assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes(NARROW), false, 'the registry takes the block out of .env.example')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env), registry.stripLaterEnvBlocks(ENV, baseText(ENV)), 'read through the registry it is what the registry makes of dev\'s file')
}

// ============================================================================================================================================
// E. the registry
// ============================================================================================================================================
const REG_MARK = '// LATER-CHANGE: FRONTEND-1, Upload formats:'
function registryChecks(text = stripPl42LockedCopy(REGISTRY, read(REGISTRY))) {   // PL-42's two registry lines (stacked after this change) are read out first
  const lists = { LATER_CHANGE_FILES: 'UPLOAD_FORMATS_SCOPE_FILES', LATER_ENV_BLOCKS: 'UPLOAD_FORMATS_ENV_BLOCK', LATER_STRIPS: 'stripUploadFormats' }
  for (const [list, name] of Object.entries(lists)) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const rows = text.slice(start, end).split('\n').filter(line => line.trim() !== ''), at = rows.findIndex(line => line.includes('studio-upload-formats-strip.mjs'))
    assert.ok(at > 0, `${list}: this change's line is in the list`); assert.ok(rows.slice(at + 1).every(row => row.includes('studio-pl42-locked-copy-strip.mjs')), `${list}: the line is at the true end, just above the marker comment (but for PL-42's, stacked after this change)`)
    assert.ok(rows[at].includes(`).${name},`), `${list}: the line reads ${name}`); assert.equal((text.slice(start, end).match(/studio-upload-formats-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
    assert.ok(rows[at - 1].includes('studio-research-by-level-strip.mjs') && rows[at - 2].includes('studio-levels-direct-live-strip.mjs') && rows[at - 3].includes('studio-my-companions-strip.mjs'), `${list}: after research by level's line (the last one dev has), after levels direct live's, after My companions': this change last`)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-upload-formats-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines')
  assert.ok(registered.every(line => line.includes(REG_MARK) && /(?<![\w-])LATER-CHANGE(?![\w-])/.test(line) && line.includes(`(${NARROW})`)), 'each carries the registry marker, "FRONTEND-1, Upload formats:" and the flag')
  const diff = lineDiff(baseText(REGISTRY), text)
  assert.deepEqual(diff.removed, [], 'and loses none'); assert.deepEqual([...diff.added].sort(), [...registered].sort(), 'the three are the only lines it adds')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(ENV_BLOCK), 'the block is registered')
  assert.ok([...SCOPE].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN) && registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(STRIP_FN) + 1).every(strip => strip === stripPl42LockedCopy), 'the strip runs last, but for PL-42\'s (the order the changes were stacked)'); assert.equal(registry.LATER_ENV_BLOCKS.at(-1), ENV_BLOCK, 'the block is the last')
  assert.equal(registry.stripLaterChanges(CHAT, read(CHAT)), registry.stripLaterChanges(CHAT, baseText(CHAT)), `${CHAT}: read through the registry it is dev's (older proofs read it like that)`)
  assert.equal(registry.stripLaterChanges(ENV, read(ENV)), registry.stripLaterChanges(ENV, baseText(ENV)), `${ENV}: read through the registry it is dev's`)
  for (const rel of PIN_FILES) assert.equal(registry.stripLaterChanges(rel, read(rel)), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is dev's`)
  // the neighbouring strips leave each other's lines alone, whichever order they run in
  const now = laterOnly(CHAT, read(CHAT))   // PL-42's strip (registered after this one) puts the one replaced sentence of the composer back first
  assert.equal(STRIP_FN(CHAT, now), baseText(CHAT), 'this strip gives dev\'s composer')
  const others = registry.LATER_STRIPS.filter(strip => strip !== STRIP_FN).reduce((out, strip) => { const next = strip(CHAT, out); return typeof next === 'string' ? next : out }, now)
  for (const [has] of EDITS[CHAT]) assert.ok(others.includes(has), 'no other registered strip takes this change\'s lines out of the composer')
  assert.equal(registry.LATER_STRIPS.reduce((out, strip) => { const next = strip(CHAT, out); return typeof next === 'string' ? next : out }, now), registry.LATER_STRIPS.slice().reverse().reduce((out, strip) => { const next = strip(CHAT, out); return typeof next === 'string' ? next : out }, now), 'the strips commute on the composer')
}

// ============================================================================================================================================
// F. scope, commits, secrets (the committed range BASE..HEAD; never the working tree, which a gate run and the suites write into)
// ============================================================================================================================================
const subjectOf = sha => git('log', '-1', '--format=%s', sha)
const OWN_MERGE = '885a6b8d098b31e6b78a41efb82af3a4df340fd4' // this change's own merge of dev 374d697a, in the house form
const isAncestor = (sha, head) => { try { git('merge-base', '--is-ancestor', sha, head); return true } catch { return false } }
/** [sha, subject] of the commits BASE..head, one git call. */
const logOf = (head, ...args) => git('log', '--format=%H%x09%s', ...args, `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).map(line => { const [sha, ...subject] = line.split('\t'); return [sha, subject.join('\t')] })
/** This change's own commits: NON-MERGE commits whose subject has one of its two forms. A merge commit is never an own commit, whatever its subject: dev's merges, the gate kit's local merge (its own subject), GitHub's "Merge pull request #643 ..." and this change's own dev merge are all skipped here. */
const ownOf = (head, ...args) => logOf(head, '--no-merges', ...args).filter(([, subject]) => SUBJECT_RE.test(subject)).map(([sha]) => sha)
const touchedFiles = (commits, head) => { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)); return new Set(commits.flatMap(commit => git('show', '--name-only', '--format=', commit).split('\n')).filter(rel => rel && net.has(rel))) }
function scopeCheck(commits, head, extra = []) { assert.deepEqual([...touchedFiles(commits, head), ...extra].filter(rel => !SCOPE.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base') }
function messageProblems(subject, body, { kept = false } = {}) {
  const problems = []
  if (!kept && !subject.startsWith(SUBJECT)) problems.push(`the subject starts "${SUBJECT}"`)
  if (!kept && !/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line')
  return problems
}
function secretChecks(texts = {}, commits = ownOf('HEAD')) {
  for (const rel of [...APP_FILES, ...NEW_FILES]) assert.doesNotMatch(texts[rel] ?? read(rel), SECRET, `${rel}: no secret`)
  for (const rel of [ENV, REGISTRY, ...PIN_FILES]) assert.doesNotMatch(lineDiff(baseText(rel), texts[rel] ?? read(rel)).added.join('\n'), SECRET, `${rel}: no secret in the lines this change adds`)
  for (const sha of commits) assert.doesNotMatch(git('show', '--format=%B', sha), SECRET, `commit ${sha.slice(0, 8)}: no secret in the diff or the message`)
}
/**
 * The scope of the commits that make up head. Robust after merge (the #567 lesson): merge commits are never own commits and their messages are not read, whoever made them
 * (only THIS change's own dev merge, by sha, keeps its house-form check); once the branch is merged into dev (the gate kit's local merge, or GitHub's PR merge) this change's commits are on the merge's
 * second parent, the first-parent line from BASE has none of them, and the proof says so with a NOTE and goes on to read the commits by subject over the whole range (the second parent included).
 * `hooks.onMerge(sha)` runs on every merge on the first-parent line: only a mutant uses it (the old check of every merge's message).
 */
function scopeChecks(head = 'HEAD', hooks = {}) {
  assert.ok(isAncestor(BASE_COMMIT, head), 'the strip\'s BASE_COMMIT (dev 374d697a) is an ancestor of this branch: the branch carries dev as a merge, never a rebase')
  const first = ownOf(head, '--first-parent'), all = ownOf(head)
  for (const sha of git('rev-list', '--first-parent', '--merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) hooks.onMerge?.(sha)
  if (first.length === 0) console.log('NOTE scope: no commit of this change on the first-parent line (merged into dev: its commits are on the merge\'s second parent); the commits are read by subject over the whole range, and the strip, source and registry checks cover the files')
  else {
    scopeCheck(first, head)
    // when every commit on the first-parent line is this change's (the branch itself), the whole net diff against the base is in scope; a line that carries others' commits is read by the commit list
    const line = logOf(head, '--first-parent')
    if (line.every(([, subject]) => SUBJECT_RE.test(subject))) assert.deepEqual(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(rel => !SCOPE.has(rel)).sort(), [], 'over the whole committed range no file is outside the scope either')
  }
  scopeCheck(all, head)
  for (const sha of all) assert.deepEqual(messageProblems(subjectOf(sha), git('show', '--no-patch', '--format=%B', sha), { kept: sha === KEPT_COMMIT }), [], `commit ${sha.slice(0, 8)}: the message`)
  assert.deepEqual([...touchedFiles(all, head)].filter(rel => !registry.LATER_CHANGE_FILES.has(rel)), [], 'every file the commits touch is registered')
  if (isAncestor(OWN_MERGE, head)) assert.deepEqual(messageProblems(subjectOf(OWN_MERGE), git('show', '--no-patch', '--format=%B', OWN_MERGE)), [], 'this change\'s own merge of dev: the house form (a merge by anyone else is not read)')
  // the Codex commit is kept, with its author (a branch that was rebased or squashed would lose it)
  if (isAncestor(KEPT_COMMIT, head)) { assert.equal(git('log', '-1', '--format=%an', KEPT_COMMIT).trim(), 'Pramod-Potti-Krishnan', 'the Codex commit keeps its author'); assert.equal(subjectOf(KEPT_COMMIT).trim(), FIRST_SUBJECT, 'and its subject'); assert.ok(!subjectOf(KEPT_COMMIT).startsWith(SUBJECT), 'which has no prefix (it is not rewritten or amended)') }
  else if (all.length > 0) assert.fail('this change has commits but the Codex commit is not among them')
  else console.log('NOTE scope: none of this change\'s commits is in the range (a squash merge): the strip, source and registry checks cover the files')
  secretChecks({}, all)
}
/**
 * The three states a head is read in, built without touching the working tree or the index (git commit-tree, fixed names and dates: the same two objects every run): the pure head, the gate kit's local
 * merge of the head onto dev (a subject of the kit's own) and GitHub's PR merge ("Merge pull request #643 ..."). Dev is BASE here (the tree is the head's: the head already carries dev).
 */
function mergeStates(head = 'HEAD') {
  const env = { ...process.env, GIT_AUTHOR_NAME: 'proof', GIT_AUTHOR_EMAIL: 'proof@example.invalid', GIT_COMMITTER_NAME: 'proof', GIT_COMMITTER_EMAIL: 'proof@example.invalid', GIT_AUTHOR_DATE: '2026-11-20T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-20T00:00:00Z' }
  const tree = git('rev-parse', `${head}^{tree}`).trim(), tip = git('rev-parse', head).trim()
  const merge = message => execFileSync('git', ['commit-tree', tree, '-p', BASE_COMMIT, '-p', tip, '-m', message], { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim()
  return { 'the pure head': head, 'a gate-style merge (the kit\'s own subject)': merge(`gate: kit merge of ${tip.slice(0, 8)} onto dev`), 'a PR-style merge (GitHub\'s subject)': merge('Merge pull request #643 from Pramod-Potti-Krishnan/frontend1/upload-formats\n\n0.9-S Narrow Studio upload picker formats') }
}

// ============================================================================================================================================
// G. one literal read per flag, only in the lib
// ============================================================================================================================================
function oneReadChecks(texts = {}) {
  for (const rel of git('ls-files', 'app', 'hooks', 'components', 'lib', 'middleware.ts', 'next.config.mjs').split('\n').filter(Boolean).filter(f => /\.(ts|tsx|mjs|js)$/.test(f))) {
    const text = texts[rel] ?? read(rel)
    for (const flag of FLAGS) assert.equal((text.match(new RegExp(`process\\.env\\.${flag}\\b`, 'g')) || []).length, rel === LIB ? 1 : 0, `${rel}: ${rel === LIB ? `reads ${flag} once` : `does not read ${flag} itself`}`)
  }
  for (const rel of git('grep', '-l', '-E', '-e', 'STUDIO_UPLOAD_(FORMATS_NARROW|TEXT_FORMATS)', '--', 'app', 'hooks', 'components', 'lib').split('\n').filter(Boolean)) assert.ok([LIB, CHAT].includes(rel), `${rel}: only the lib (and the composer's marked comment) name the flags`)
  assert.equal((texts[CHAT] ?? read(CHAT)).split('\n').filter(l => l.includes('STUDIO_UPLOAD_FORMATS_NARROW')).length, 1, 'the composer names the narrow flag once, in the comment of its spread; the text flag not at all')
  assert.equal((texts[CHAT] ?? read(CHAT)).includes('STUDIO_UPLOAD_TEXT_FORMATS'), false, 'the composer does not name the text flag')
  for (const rel of ['hooks/use-file-upload.ts', 'lib/file-validation.ts']) assert.equal((texts[rel] ?? read(rel)).includes('studio-upload-formats'), false, `${rel}: the upload hook and the validator do not know the lib`)
}

// ============================================================================================================================================
// the checks
// ============================================================================================================================================
const sink = {}
await check('A. the lib: the accept string for every flag combination (TEXT alone is off), the helper\'s table, one list for the picker and the drop, one literal read per flag', () => libChecks())
await check('B. the composer, RUN: the picker\'s markup and the drop over every flag and shell combination; flag off is dev\'s, sha256 of every output; the static import, three marked lines', () => composerChecks({}, sink))
await check('C. only insertions: the strip gives dev\'s composer byte for byte; three marked lines', () => diffChecks())
await check('C2. the older proofs taught: dev\'s text byte for byte without this change\'s marked lines; both subject forms', () => pinChecks())
await check('D. .env.example: one block at the very end, both "false", plain words, names only its own two flags', () => envChecks())
await check('E. the registry: three lines, marked, at the true end of each list; the strips commute', () => registryChecks())
await check('F. scope, in three states (the pure head, a gate-style merge, a PR-style merge): own commits by subject, merges never own; the files, the kept Codex commit and its author, the messages, no secret', () => {
  const states = mergeStates(), labels = Object.keys(states)
  for (const label of labels.slice(1)) { assert.equal(git('rev-list', '--parents', '-n1', states[label]).trim().split(' ').length, 3, `${label}: built as a merge (two parents, dev first)`); assert.ok(!SUBJECT_RE.test(subjectOf(states[label])), `${label}: its subject is not this change's`); assert.deepEqual(ownOf(states[label], '--first-parent'), [], `${label}: this change has no commit on its first-parent line`); assert.deepEqual(ownOf(states[label]).sort(), ownOf('HEAD').sort(), `${label}: the same own commits over the whole range (the second parent)`) }
  for (const label of labels) { try { scopeChecks(states[label]) } catch (error) { error.message = `${label}: ${error.message}`; throw error } }
})
await check('G. one literal env read per flag, only in the lib; nothing else knows the lib', () => oneReadChecks())
if (sink.pickers) {
  const flagOff = [...new Set(sink.pickers.map(([a, b]) => `${a.slice(0, 12)}/${b.slice(0, 12)}`))], dropsOff = [...new Set(sink.traces.map(([a, b]) => `${a.slice(0, 12)}/${b.slice(0, 12)}`))]
  console.log(`flag off: picker markup sha256 (dev / this) ${flagOff.join(' ')}; ${sink.traces.length} drop traces (dev / this), all equal: ${sink.traces.every(([a, b]) => a === b)}`)
  console.log(`          drop trace digests: ${dropsOff.join(' ')}`)
}

// ============================================================================================================================================
// H. mutants: one edit of the real sources each, fed to the same checks
// ============================================================================================================================================
const TX = (rel, from, to) => ({ [rel]: swap(read(rel), from, to) })
const lineOf = needle => { const hits = read(CHAT).split('\n').filter(l => l.includes(needle)); if (hits.length !== 1) throw new SwapError(`exactly one composer line holds ${JSON.stringify(needle)} (found ${hits.length})`); return hits[0] }
const DROP_LINE = () => lineOf('files.splice(0, files.length'), SPREAD_LINE = () => lineOf('{...(studio && STUDIO_UPLOAD_ACCEPT'), IMPORT_LINE = () => lineOf("from '@/lib/studio-upload-formats'")
const withoutLine = line => swap(read(CHAT), `${line}\n`, '')
const libMut = (from, to) => TX(LIB, from, to)
const chatMut = (from, to) => TX(CHAT, from, to)
const allLib = async texts => { libChecks(texts); await composerChecks(texts) }
const NARROW_READ = `process.env.${NARROW} === 'true'`, TEXT_READ = `process.env.${TEXT} === 'true'`
await mutant('lib: NARROW is on for "True" as well', () => allLib(libMut(NARROW_READ, `(${NARROW_READ} || process.env.${NARROW} === 'True')`)))
await mutant('lib: NARROW is on unless it is "false"', () => allLib(libMut(NARROW_READ, `process.env.${NARROW} !== 'false'`)))
await mutant('lib: NARROW is on when it is set at all', () => allLib(libMut(NARROW_READ, `!!process.env.${NARROW}`)))
await mutant('lib: TEXT is on for "1" as well', () => allLib(libMut(TEXT_READ, `(${TEXT_READ} || process.env.${TEXT} === '1')`)))
await mutant('lib: TEXT acts alone (the accept string is built without NARROW)', () => allLib(libMut('(narrow ? uploadExtensions(text).join(\',\') : undefined)', '((narrow || text) ? uploadExtensions(text).join(\',\') : undefined)')))
await mutant('lib: TEXT is ignored (documents and images only)', () => allLib(libMut('(narrow ? uploadExtensions(text).join(\',\') : undefined)', '(narrow ? uploadExtensions(false).join(\',\') : undefined)')))
await mutant('lib: the data and source files are always offered', () => allLib(libMut('...(textFormats ? UPLOAD_TEXT_EXTENSIONS : [])', '...UPLOAD_TEXT_EXTENSIONS')))
await mutant('lib: .doc is offered', () => allLib(libMut("['.pdf', '.docx', '.txt',", "['.pdf', '.docx', '.doc', '.txt',")))
await mutant('lib: .xls is offered', () => allLib(libMut("'.xlsx', '.csv', '.pptx'] as const", "'.xlsx', '.xls', '.csv', '.pptx'] as const")))
await mutant('lib: .ppt is offered', () => allLib(libMut("'.csv', '.pptx'] as const", "'.csv', '.pptx', '.ppt'] as const")))
await mutant('lib: .gif is dropped from the images', () => allLib(libMut("'.jpeg', '.gif', '.webp'", "'.jpeg', '.webp'")))
await mutant('lib: the order of the lists changes (documents after images)', () => allLib(libMut('[...UPLOAD_DOCUMENT_EXTENSIONS, ...UPLOAD_IMAGE_EXTENSIONS,', '[...UPLOAD_IMAGE_EXTENSIONS, ...UPLOAD_DOCUMENT_EXTENSIONS,')))
await mutant('lib: the helper is case-sensitive', () => allLib(libMut('name.toLowerCase()', 'name')))
await mutant('lib: the helper matches anywhere in the name (report.pdf.exe is taken)', () => allLib(libMut('lower.endsWith(extension)', 'lower.includes(extension)')))
await mutant('lib: the helper matches the extension without its dot (x.cmd, "pdf" are taken)', () => allLib(libMut('lower.endsWith(extension)', 'lower.endsWith(extension.slice(1))')))
await mutant('lib: the helper takes a name with no extension', () => allLib(libMut('return uploadExtensions(textFormats).some(extension => lower.endsWith(extension))', "return !lower.includes('.') || uploadExtensions(textFormats).some(extension => lower.endsWith(extension))")))
await mutant('lib: the helper ignores its TEXT argument', () => allLib(libMut('return uploadExtensions(textFormats).some', 'return uploadExtensions(false).some')))
await mutant('lib: the helper\'s default is always TEXT on', () => allLib(libMut('textFormats: boolean = STUDIO_UPLOAD_TEXT_FORMATS', 'textFormats: boolean = true')))
await mutant('lib: the helper has its own list (a format the picker does not offer is taken)', () => allLib(libMut('return uploadExtensions(textFormats).some(extension => lower.endsWith(extension))', "return [...uploadExtensions(textFormats), '.rtf'].some(extension => lower.endsWith(extension))")))
await mutant('lib: the helper refuses a name it should take (uppercase image)', () => allLib(libMut('name.toLowerCase()', "name.toLowerCase().replace('.jpg', '')")))
await mutant('lib: the returned list is a shared one (a caller can change it)', () => allLib({ [LIB]: swap(swap(read(LIB), '=> [...UPLOAD_DOCUMENT_EXTENSIONS, ...UPLOAD_IMAGE_EXTENSIONS, ...(textFormats ? UPLOAD_TEXT_EXTENSIONS : [])]', '=> (textFormats ? [...SHARED, ...UPLOAD_TEXT_EXTENSIONS] : SHARED)'), 'export const uploadExtensions', 'const SHARED: string[] = [...UPLOAD_DOCUMENT_EXTENSIONS, ...UPLOAD_IMAGE_EXTENSIONS]\nexport const uploadExtensions') }))
await mutant('lib: the flag is read non-literally', () => allLib(libMut(NARROW_READ, `process.env['${NARROW}'] === 'true'`)))
await mutant('lib: the flag is read through a destructured env', () => allLib(libMut(NARROW_READ, `(({ ${NARROW}: v }) => v)(process.env) === 'true'`)))
await mutant('lib: a third env read', () => allLib(libMut('export const STUDIO_UPLOAD_ACCEPT', `export const STUDIO_UPLOAD_EXTRA = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'\nexport const STUDIO_UPLOAD_ACCEPT`)))
await mutant('lib: the lib imports something', () => allLib({ [LIB]: `import type { X } from '@/lib/x'\n${read(LIB)}` }))
await mutant('lib: the lib reads the flag twice', () => allLib(libMut('export const STUDIO_UPLOAD_ACCEPT: string | undefined = uploadAccept(STUDIO_UPLOAD_FORMATS_NARROW,', `export const STUDIO_UPLOAD_ACCEPT: string | undefined = uploadAccept(process.env.${NARROW} === 'true',`)))
await mutant('composer: the drop line is missing (a dropped .doc still goes on)', () => allLib({ [CHAT]: withoutLine(DROP_LINE()) }))
await mutant('composer: the drop line has no marker', () => composerTextChecks(chatMut('// STUDIO-UPLOAD-FORMATS: with the narrow flag on', '// with the narrow flag on')))
await mutant('composer: the drop filter ignores the Studio shell', () => allLib(chatMut('if (studio && STUDIO_UPLOAD_ACCEPT) files.splice', 'if (STUDIO_UPLOAD_ACCEPT) files.splice')))
await mutant('composer: the drop filter does not look at the narrow flag (it cuts the list with the flag off)', () => allLib(chatMut('if (studio && STUDIO_UPLOAD_ACCEPT) files.splice', 'if (studio) files.splice')))
await mutant('composer: the drop filter is inverted', () => allLib(chatMut('files.filter(file => acceptsUploadFile(file.name))', 'files.filter(file => !acceptsUploadFile(file.name))')))
await mutant('composer: the drop filter checks the TEXT list always off', () => allLib(chatMut('acceptsUploadFile(file.name)', 'acceptsUploadFile(file.name, false)')))
await mutant('composer: the drop filter reorders the files', () => allLib(chatMut('files.splice(0, files.length, ...files.filter(file => acceptsUploadFile(file.name)))', 'files.splice(0, files.length, ...files.filter(file => acceptsUploadFile(file.name)).reverse())')))
await mutant('composer: the drop filter looks at the whole file, not its name (type)', () => allLib(chatMut('acceptsUploadFile(file.name)', 'acceptsUploadFile(file.type)')))
await mutant('composer: the drop line sits after the base\'s length test (a drop with nothing left still asks for a session)', () => allLib({ [CHAT]: swap(withoutLine(DROP_LINE()), '          if (files.length > 0) {\n            onRequestSession().then(() => {', `          if (files.length > 0) {\n${DROP_LINE()}\n            onRequestSession().then(() => {`) }))
await mutant('composer: the picker\'s spread sets accept to undefined with the flag off', () => allLib(chatMut('{...(studio && STUDIO_UPLOAD_ACCEPT ? { accept: STUDIO_UPLOAD_ACCEPT } : ({} as { accept?: string }))}', '{...(studio ? { accept: STUDIO_UPLOAD_ACCEPT } : ({} as { accept?: string }))}')))
await mutant('composer: the picker\'s spread ignores the Studio shell', () => allLib(chatMut('{...(studio && STUDIO_UPLOAD_ACCEPT ? { accept: STUDIO_UPLOAD_ACCEPT } : ({} as { accept?: string }))}', '{...(STUDIO_UPLOAD_ACCEPT ? { accept: STUDIO_UPLOAD_ACCEPT } : ({} as { accept?: string }))}')))
await mutant('composer: the picker\'s spread comes before the accept (the base\'s accept wins)', () => allLib({ [CHAT]: swap(withoutLine(SPREAD_LINE()), '      multiple\n      accept=', `      multiple\n${SPREAD_LINE()}\n      accept=`) }))
await mutant('composer: the lib is required inside the render', () => composerTextChecks(chatMut("import { STUDIO_UPLOAD_ACCEPT, acceptsUploadFile } from '@/lib/studio-upload-formats' // STUDIO-UPLOAD-FORMATS\n", "const { STUDIO_UPLOAD_ACCEPT, acceptsUploadFile } = require('@/lib/studio-upload-formats') // STUDIO-UPLOAD-FORMATS\n")))
await mutant('composer: the import has no marker', () => diffChecks(chatMut("from '@/lib/studio-upload-formats' // STUDIO-UPLOAD-FORMATS\n", "from '@/lib/studio-upload-formats'\n")))
await mutant('composer: the import is a type import of the whole module', () => composerTextChecks(chatMut("import { STUDIO_UPLOAD_ACCEPT, acceptsUploadFile } from", "import * as UPLOAD from")))
await mutant('composer: a base line is rewritten (the base\'s accept)', () => diffChecks(chatMut('accept=".pdf,.docx,.doc,', 'accept=".pdf,.docx,.doc,.rtf,')))
await mutant('composer: a base line is rewritten and marked (the onChange)', () => diffChecks(chatMut("        console.log(`[ChatInput] File input onChange fired,", "        console.log(`[ChatInput] File input onChange fired (x),")))
await mutant('composer: a line is added without the marker', () => diffChecks(chatMut('          if (files.length > 0) {\n            onRequestSession()', '          void 0\n          if (files.length > 0) {\n            onRequestSession()')))
await mutant('composer: a fourth marked line', () => diffChecks(chatMut('          if (files.length > 0) {\n            onRequestSession()', '          void 0 // STUDIO-UPLOAD-FORMATS\n          if (files.length > 0) {\n            onRequestSession()')))
await mutant('composer: the picker\'s own onChange also filters (a file filter outside the drop)', () => composerTextChecks(chatMut('          onFilesSelected(files)\n        }\n        if (fileInputRef.current) {', '          onFilesSelected(files.filter(f => acceptsUploadFile(f.name)))\n        }\n        if (fileInputRef.current) {')))
await mutant('composer: another file (the upload hook) knows the lib', () => oneReadChecks({ 'hooks/use-file-upload.ts': `${read('hooks/use-file-upload.ts')}\n// studio-upload-formats\n` }))
await mutant('composer: another file (the upload hook) reads a flag', () => oneReadChecks({ 'hooks/use-file-upload.ts': `${read('hooks/use-file-upload.ts')}\nconst x = process.env.${NARROW}\n` }))
await mutant('composer: the page is touched', () => diffChecks({ 'app/builder/page.tsx': `${read('app/builder/page.tsx')}\n` }))
const stripOf = edits => (rel, text) => (typeof text === 'string' && edits[rel] ? edits[rel].reduce((out, [has, was]) => out.replace(has, () => was), text) : text)
await mutant('strip: a pair is missing (the import stays behind)', () => { const edits = { [CHAT]: EDITS[CHAT].slice(1) }; diffChecks({}, stripOf(edits), edits) })
await mutant('strip: a pair puts back text that is not dev\'s', () => { const edits = { [CHAT]: EDITS[CHAT].map(([has, was], i) => (i === 0 ? [has, `${was}// x\n`] : [has, was])) }; diffChecks({}, stripOf(edits), edits) })
await mutant('strip: one pair is not a whole line', () => { const edits = { [CHAT]: EDITS[CHAT].map(([has, was], i) => (i === 0 ? [has.replace(/\n$/, ''), was] : [has, was])) }; diffChecks({}, stripOf(edits), edits) })
await mutant('strip: a fourth pair', () => { const edits = { [CHAT]: [...EDITS[CHAT], ['x\n', '']] }; diffChecks({}, stripOf(edits), edits) })
await mutant('env: the block says "true"', () => envChecks({ [ENV]: read(ENV).replace(`${NARROW}="false"`, `${NARROW}="true"`) }, ENV_BLOCK.replace(`${NARROW}="false"`, `${NARROW}="true"`)))
await mutant('env: the second flag says "true"', () => envChecks({ [ENV]: read(ENV).replace(`${TEXT}="false"`, `${TEXT}="true"`) }, ENV_BLOCK.replace(`${TEXT}="false"`, `${TEXT}="true"`)))
await mutant('env: the block is empty-valued (the Codex form)', () => envChecks({ [ENV]: read(ENV).replace(`${NARROW}="false"`, `${NARROW}=`).replace(`${TEXT}="false"`, `${TEXT}=`) }, ENV_BLOCK.replace(`${NARROW}="false"`, `${NARROW}=`).replace(`${TEXT}="false"`, `${TEXT}=`)))
await mutant('env: the block names the Researcher\'s variable in full', () => envChecks({ [ENV]: read(ENV).replace('the Researcher\'s text-formats switch', 'RESEARCHER_UPLOAD_TEXT_FORMATS_ENABLED') }, ENV_BLOCK.replace('the Researcher\'s text-formats switch', 'RESEARCHER_UPLOAD_TEXT_FORMATS_ENABLED')))
await mutant('env: the block names its own flag in prose too', () => envChecks({ [ENV]: read(ENV).replace('acts only with the first flag on', `acts only with ${NARROW} on`) }, ENV_BLOCK.replace('acts only with the first flag on', `acts only with ${NARROW} on`)))
await mutant('env: the block is not at the very end', () => envChecks({ [ENV]: `${read(ENV)}\n# STUDIO SOMETHING LATER\nNEXT_PUBLIC_STUDIO_SOMETHING_LATER="false"\n` }))
await mutant('env: the block is missing', () => envChecks({ [ENV]: read(ENV).replace(ENV_BLOCK, '') }))
await mutant('env: the block lacks the coupling sentence', () => envChecks({ [ENV]: read(ENV).replace('only after the Researcher\'s text-formats switch is on in the same environment', 'whenever') }, ENV_BLOCK.replace('only after the Researcher\'s text-formats switch is on in the same environment', 'whenever')))
await mutant('env: the block grows past four comment lines', () => envChecks({ [ENV]: read(ENV).replace(`${NARROW}="false"`, `# one more\n${NARROW}="false"`) }, ENV_BLOCK.replace(`${NARROW}="false"`, `# one more\n${NARROW}="false"`)))
await mutant('registry: this change\'s strip line is in the middle of its list', () => { const t = read(REGISTRY), line = t.split('\n').find(l => l.includes('studio-upload-formats-strip.mjs') && l.includes('stripUploadFormats')); registryChecks(t.replace(`${line}\n`, '').replace('  (await import(\'./studio-research-by-level-strip.mjs\')).stripResearchByLevel,', `${line}\n  (await import('./studio-research-by-level-strip.mjs')).stripResearchByLevel,`)) })
await mutant('registry: a line is missing (the scope list)', () => registryChecks(read(REGISTRY).split('\n').filter(l => !(l.includes('studio-upload-formats-strip.mjs') && l.includes('SCOPE_FILES'))).join('\n')))
await mutant('registry: a line loses its marker', () => registryChecks(read(REGISTRY).replace('// LATER-CHANGE: FRONTEND-1, Upload formats:', '// FRONTEND-1, Upload formats:')))
await mutant('registry: a line is the Codex form (FRONTEND-1-B1)', () => registryChecks(read(REGISTRY).replace('// LATER-CHANGE: FRONTEND-1, Upload formats:', '// LATER-CHANGE: FRONTEND-1-B1, Upload formats:')))
await mutant('registry: a line has lost its flag', () => registryChecks(read(REGISTRY).replace(`(${NARROW})`, '(x)')))
await mutant('registry: a line is added that is not this change\'s', () => registryChecks(read(REGISTRY).replace('  // one line per later change, above this comment\n])', '  // LATER-CHANGE: someone, something\n  // one line per later change, above this comment\n])')))
await mutant('scope: a stray file in the commit', () => scopeCheck(ownOf('HEAD', '--first-parent'), 'HEAD', ['README.md']))
const bodyOf = sha => git('show', '--no-patch', '--format=%B', sha)
const everyMerge = sha => assert.deepEqual(messageProblems(subjectOf(sha), bodyOf(sha)), [], `merge ${sha.slice(0, 8)}: the message (the old check: the house form demanded of every merge)`)
await mutant('scope: the old check (every merge on the line must be in the house form) is caught by the gate-style merge', () => scopeChecks(Object.values(mergeStates())[1], { onMerge: everyMerge }))
await mutant('scope: the old check (every merge on the line must be in the house form) is caught by the PR-style merge', () => scopeChecks(Object.values(mergeStates())[2], { onMerge: everyMerge }))
await mutant('scope: a merge subject is read as an own subject (the kit\'s merge counts as this change\'s commit and is held to the co-author line)', () => { const gate = Object.values(mergeStates())[1]; assert.deepEqual(messageProblems(subjectOf(gate), bodyOf(gate)), []) })
await mutant('scope: the Codex subject with a suffix is not this change\'s', () => assert.ok(SUBJECT_RE.test('Narrow Studio upload formats behind flags and more')))
await mutant('scope: a subject of another change is this change\'s', () => assert.ok(SUBJECT_RE.test('Research by level: x')))
await mutant('message: the subject does not start with the prefix', () => assert.deepEqual(messageProblems('Fix things', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), []))
await mutant('message: the co-author line is missing', () => assert.deepEqual(messageProblems('Upload formats: x', 'body\n'), []))
await mutant('secret: a credential-shaped literal in the lib', () => assert.doesNotMatch(`${read(LIB)}\n// ${'sk-'}${'a'.repeat(24)}\n`, SECRET))
await mutant('older proofs: a splice line names another subject', () => pinChecks({ 'scripts/test-studio-chat-element-edit.mjs': read('scripts/test-studio-chat-element-edit.mjs').replace('/^(Upload formats:|', '/^(Upload formatz:|') }))
await mutant('older proofs: a splice line has no end anchor allowance (a subject from git ends in a newline)', () => pinChecks({ 'scripts/test-studio-deck-sync-truth.mjs': read('scripts/test-studio-deck-sync-truth.mjs').replace('behind flags\\s*$)/', 'behind flags$)/') }))
await mutant('older proofs: a splice line is missing', () => pinChecks({ 'scripts/test-studio-deck-sync-truth.mjs': read('scripts/test-studio-deck-sync-truth.mjs').split('\n').filter(l => !l.includes('(STUDIO-UPLOAD-FORMATS)')).join('\n') }))
await mutant('older proofs: a proof gains an unmarked line', () => pinChecks({ 'scripts/test-studio-deck-sync-truth.mjs': `${read('scripts/test-studio-deck-sync-truth.mjs')}\n// stray\n` }))

const dropLines = (rel, test) => ({ [rel]: read(rel).split('\n').filter(l => !test(l)).join('\n') })
await mutant('older proofs: the My companions wiring proof loses its read hook', () => pinChecks(dropLines('scripts/test-studio-my-companions-wiring.mjs', l => l.startsWith('{ const realRead = fs.readFileSync;') && l.includes('UPLOAD_FORMATS_FILES'))))
await mutant('older proofs: the My companions wiring proof loses its import', () => pinChecks(dropLines('scripts/test-studio-my-companions-wiring.mjs', l => l.startsWith('import { stripUploadFormats'))))
await mutant('older proofs: the research-by-level proof loses its read hook', () => pinChecks(dropLines('scripts/test-studio-research-by-level.mjs', l => l.startsWith('{ const realRead = fs.readFileSync;') && l.includes('UPLOAD_FORMATS_READ_FILES'))))
await mutant('older proofs: the research-by-level proof reads through the registry instead of this change\'s strip', () => pinChecks({ 'scripts/test-studio-research-by-level.mjs': read('scripts/test-studio-research-by-level.mjs').replace('UPLOAD_FORMATS_READ_FILES.includes(rel) ? stripUploadFormats(rel, out) : out', 'UPLOAD_FORMATS_READ_FILES.includes(rel) ? registry.stripLaterChanges(rel, out) : out') }))
await mutant('older proofs: the research-by-level proof\'s "runs last" check is dev\'s again', () => pinChecks({ 'scripts/test-studio-research-by-level.mjs': read('scripts/test-studio-research-by-level.mjs').split('\n').map(l => (l.startsWith('  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN) &&') ? "  assert.equal(registry.LATER_STRIPS.at(-1), STRIP_FN, 'the strip runs last (the order the changes were stacked)')" : l)).join('\n') }))
await mutant('older proofs: the research-by-level proof\'s scope check is dev\'s again', () => pinChecks({ 'scripts/test-studio-research-by-level.mjs': read('scripts/test-studio-research-by-level.mjs').replace(' && !UPLOAD_FORMATS_SCOPE_FILES.has(rel)', '') }))
await mutant('older proofs: the Drive composer proof loses its stub', () => pinChecks(dropLines('scripts/test-studio-connectors-gdrive-composer.mjs', l => l.includes("'@/lib/studio-upload-formats'"))))
await mutant('older proofs: the My companions list of files dev must not have names the lib again', () => pinChecks({ 'scripts/test-studio-my-companions-wiring.mjs': read('scripts/test-studio-my-companions-wiring.mjs').split('\n').map(l => (l.startsWith('const UNTOUCHED = [') ? `${l.replace(/\] \/\/ LATER-CHANGES.*$/, ", 'lib/studio-upload-formats.ts']")}` : l)).join('\n') }))
await mutant('strip: the .env.example pair is missing', () => { const edits = { ...EDITS, [ENV]: [] }; diffChecks({}, stripOf(edits), edits) })
await mutant('strip: a registry pair is missing', () => { const edits = { ...EDITS, [REGISTRY]: EDITS[REGISTRY].slice(1) }; diffChecks({}, stripOf(edits), edits) })
await mutant('strip: the .env.example pair leaves the blank line behind', () => { const edits = { ...EDITS, [ENV]: [[EDITS[ENV][0][0].slice(1), '']] }; diffChecks({}, stripOf(edits), edits) })

console.log(`\n${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (failed.length || missed.length) { console.error(`FAILED: ${[...failed, ...missed.map(m => `mutant ${m}`)].join('; ')}`); process.exit(1) }
