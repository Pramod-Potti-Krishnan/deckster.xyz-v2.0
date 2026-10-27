// FRONTEND-2 (P3-1 A chat parity): proof of NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (the string "true", default off, build-time; needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell).
//   lib/studio-chat-commands.ts (pure decisions), lib/studio-chat-commands-wire.ts (the whole wire), components/builder/chat/studio-chat-commands.tsx (the hook, the two menus and the note),
//   components/builder/studio-chat-commands.css, marked lines in chat-input.tsx, app/builder/page.tsx and hooks/use-deckster-websocket-v2.ts, and the .env.example block.
//
//   A. The wire, function by function: the flag, the caps, the readable tokens, the typed references (a deleted token drops its reference; never two element references), the command hint.
//   B. The lib: the twelve commands in PK's order, the "/" trigger and filter, what each command resolves to (run / prefill / decline) in every state, the "@" sections, the query words, pressing a real control.
//   C. The REAL handlers behind every run command: the page's own stop, the page's own research switches, the export directive's own runner with the Download menu's calls, the Undo chip's own button, the
//      theme and template popups' open state, the model gauge and the Publish button (their sources, executed or read: no stand-in).
//   D. The hook and the menus with real React: keyboard (arrows, Enter, Tab, Esc, Shift, IME), filter, focus, every command's effect, every mention kind's token and reference, honest notes, the inert flag-off hook.
//   E. The REAL socket hook, base and this tree: flag off puts the same bytes on the socket as the base for the same sends; flag on adds the caps, the references and the command, in the agreed shape.
//   F. The sources: every marked line is an insertion that carries the marker, stripping gives chat clean's files byte for byte, the gates, .env.example, the registry, the stylesheet, the scope, no secrets.
//   G. MUTANTS: every one of them must be caught by A-F.
//
//   node scripts/test-studio-chat-commands.mjs
//
// Offline: no socket, fetch or timer of its own (the harness's host network guard is installed; the hook runs on the harness's fake socket and clock); git is read only for F. Later changes stack on top of this
// one, so every source, diff and scope check reads THIS change's own newest commit (subject "Chat commands: ..."), not HEAD or the working tree.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { installHostNetworkGuard, createEnvironment } from './studio-chat-harness/fake-env.mjs'
import { BASE_ENV } from './studio-chat-harness/profiles.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const release = installHostNetworkGuard(net, dns)
let checks = 0
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const eq = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message) }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
// React and the offline host are loaded AFTER NODE_ENV is set above (a static import would load React's development build first and mismatch the production server renderer).
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const postcss = require('postcss')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
const { Root, hostNodes, toElements } = await import('./studio-chat-harness/mini-react.mjs')
const strip = await import('./studio-chat-commands-strip.mjs')
const chatCleanStrip = await import('./studio-chat-clean-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const macrotask = () => new Promise(resolve => setImmediate(resolve))
// values built inside the loader's vm have their own Array / Object prototypes: compare them as plain data
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const count = (text, needle) => text.split(needle).length - 1

const LIB = 'lib/studio-chat-commands.ts'
const WIRE = 'lib/studio-chat-commands-wire.ts'
const COMPONENT = 'components/builder/chat/studio-chat-commands.tsx'
const CSS = 'components/builder/studio-chat-commands.css'
const PAGE = 'app/builder/page.tsx'
const INPUT = 'components/builder/chat-input.tsx'
const HOOK = 'hooks/use-deckster-websocket-v2.ts'
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const OWN = (() => { try { return git('log', '-1', '--format=%H', '--no-merges', '-E', '--grep=^Chat commands:', 'HEAD').trim() || null } catch { return null } })()
const readOwn = rel => { if (!OWN) return read(rel); try { return git('show', `${OWN}:${rel}`) } catch { return read(rel) } }
const hasBase = (() => { try { git('cat-file', '-e', `${strip.BASE_COMMIT}^{commit}`); return true } catch { return false } })()

const ON = { NEXT_PUBLIC_STUDIO_CHAT_COMMANDS: 'true', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }

// ---- the wire, evaluated in THIS realm with a fake process (it is import-free by design) ------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
function loadWire(text = read(WIRE), env = ON) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'process', compile(text, WIRE))(module, module.exports, () => { throw new Error('the wire must stay import-free') }, { env })
  return module.exports
}

// ============================================================================================================================================
// A. The wire
// ============================================================================================================================================
function wireSuite(wireText = read(WIRE)) {
  // -- the flag: exact "true", and the other two it needs ---------------------------------------------------------------------------------------
  for (const [name, env] of [['unset', {}], ['only commands', { NEXT_PUBLIC_STUDIO_CHAT_COMMANDS: 'true' }], ['no clean', { ...ON, NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'false' }], ['no shell', { ...ON, NEXT_PUBLIC_STUDIO_V4_SHELL: 'false' }],
    ['TRUE', { ...ON, NEXT_PUBLIC_STUDIO_CHAT_COMMANDS: 'TRUE' }], ['1', { ...ON, NEXT_PUBLIC_STUDIO_CHAT_COMMANDS: '1' }], [' true', { ...ON, NEXT_PUBLIC_STUDIO_CHAT_COMMANDS: ' true' }], ['yes', { ...ON, NEXT_PUBLIC_STUDIO_CHAT_COMMANDS: 'yes' }]]) {
    eq(loadWire(wireText, env).STUDIO_CHAT_COMMANDS_ENABLED, false, `flag off: ${name}`)
  }
  eq(loadWire(wireText, ON).STUDIO_CHAT_COMMANDS_ENABLED, true, 'flag on: the string "true", chat clean on, the Studio shell')
  const wire = loadWire(wireText)
  eq([wire.MENTIONS2_CLIENT_CAP, wire.COMMANDS1_CLIENT_CAP, wire.CHAT_MENTIONS_MAX], ['mentions2', 'commands1', 20], 'caps and the cap on references')
  // -- tokens ---------------------------------------------------------------------------------------------------------------------------------
  eq([wire.mentionLabel(' a [b]\nc  d '), wire.mentionLabel(null), wire.mentionLabel('x'.repeat(80)).length, wire.mentionLabel('😀'.repeat(70))], ['a b c d', '', 60, '😀'.repeat(60)], 'labels: one line, no brackets, 60 characters, never inside a surrogate pair')
  eq([wire.elementToken('Chart · slide 3'), wire.fileToken('q3 report.pdf'), wire.templateToken('Board update'), wire.themeToken('Midnight', 'preset'), wire.themeToken('Midnight', 'saved')],
    ['@[Element: Chart · slide 3]', '@[File: q3 report.pdf]', '@[Template: Board update]', '@[Theme: Midnight]', '@[Theme: Midnight (saved)]'], 'tokens read as @[Kind: name]; a saved theme says so')
  eq([wire.elementToken(''), wire.fileToken(''), wire.templateToken(''), wire.themeToken('', 'preset')], ['@[Element: selected element]', '@[File: file]', '@[Template: template]', '@[Theme: theme]'], 'an empty name still reads')
  // -- the references on a send ---------------------------------------------------------------------------------------------------------------
  const file = { kind: 'file', file_id: 'f1', name: 'q3 report.pdf', source: 'upload' }
  const template = { kind: 'template', template_id: 't1', name: 'Board update' }
  const preset = { kind: 'theme', theme_id: 'midnight', name: 'Midnight', source: 'preset' }
  const saved = { kind: 'theme', theme_id: 'u-77', name: 'Midnight', source: 'saved' }
  const live = { kind: 'element', element_id: 'el_chart_7f3a', element_type: 'CHART', slide_index: 2, slide_id: 'L2', label: 'Chart · slide 3' }
  const picked = { kind: 'element', element_id: 'el_img_1', element_type: 'IMAGE', slide_index: 4, slide_id: 'L4', label: 'Image · slide 5' }
  const slideRef = { kind: 'slide', index: 1, slide_id: 'L1', label: 'Intro' }
  const reset = () => wire.clearChatCommands()
  reset()
  const base = () => ({ text: 'x', store_name: null, client_caps: ['mdc1', 'element_refine1'], references: [slideRef, live] })
  // caps: after the ones already there, once
  const data = wire.addChatCommandsFields(base(), 'plain text')
  eq(data.client_caps, ['mdc1', 'element_refine1', 'mentions2', 'commands1'], 'caps follow the caps already there')
  eq(wire.addChatCommandsFields(data, 'again').client_caps, ['mdc1', 'element_refine1', 'mentions2', 'commands1'], 'caps are never doubled')
  eq(wire.addChatCommandsFields({ text: 'x' }, 'plain').client_caps, ['mentions2', 'commands1'], 'no caps yet: just ours')
  eq(wire.addChatCommandsFields({ text: 'x', client_caps: null }, 'plain').client_caps, ['mentions2', 'commands1'], 'caps that are not a list are ignored')
  eq(wire.addChatCommandsFields({ text: 'x', client_caps: ['mdc1', 3, null] }, 'plain').client_caps, ['mdc1', 'mentions2', 'commands1'], 'a cap that is not a string is dropped')
  eq(data.references, [slideRef, live], 'nothing picked: the references are untouched (K1 and the element refine own them)')
  ok(!('command' in data), 'no command hint without a pre-fill')
  // picks: the token has to be in the text
  wire.registerMention(wire.fileToken(file.name), file); wire.registerMention(wire.templateToken(template.name), template)
  wire.registerMention(wire.themeToken('Midnight', 'preset'), preset); wire.registerMention(wire.themeToken('Midnight', 'saved'), saved)
  const text = `Use ${wire.themeToken('Midnight', 'saved')} and ${wire.fileToken(file.name)} on ${wire.templateToken(template.name)}, not ${wire.themeToken('Midnight', 'preset')}`
  eq(wire.referencesInText(text).map(r => r.kind + ':' + (r.file_id ?? r.template_id ?? r.theme_id)), ['theme:u-77', 'file:f1', 'template:t1', 'theme:midnight'], 'references come in the order the tokens appear in the text')
  eq(wire.addChatCommandsFields(base(), text).references, [slideRef, live, saved, file, template, preset], 'after the slide and element references, one per token')
  eq(wire.referencesInText(`${wire.fileToken(file.name)} ${wire.fileToken(file.name)}`), [file], 'a token twice is one reference')
  // a deleted token drops its reference
  eq(wire.referencesInText(text.replace(wire.fileToken(file.name), '')).map(r => r.kind), ['theme', 'template', 'theme'], 'deleting a token removes its reference')
  eq(wire.referencesInText('no tokens at all'), [], 'no token, no reference')
  eq(wire.referencesInText(text.replace('@[File: q3 report.pdf]', '@[File: q3 report.pd')), wire.referencesInText(text.replace(wire.fileToken(file.name), '')), 'half a token is not a token')
  eq(wire.referencesInText(undefined), [], 'a non-string text has none')
  // never two element references: a picked @Element replaces the live selection's, in place
  wire.registerMention(wire.elementToken(picked.label), picked)
  const withElement = wire.addChatCommandsFields(base(), `Make ${wire.elementToken(picked.label)} bigger`).references
  eq([withElement.map(r => r.kind), withElement[1].element_id], [['slide', 'element'], 'el_img_1'], 'the picked element replaces the live one, after the slide reference: one element reference')
  eq(withElement.filter(r => r.kind === 'element').length, 1, 'exactly one element reference')
  eq(wire.addChatCommandsFields({ text: 'x', references: [live, live] }, `Make ${wire.elementToken(picked.label)} bigger`).references.filter(r => r.kind === 'element').length, 1, 'even if two were somehow there')
  eq(wire.addChatCommandsFields({ text: 'x' }, `Make ${wire.elementToken(picked.label)} bigger`).references, [picked], 'no live selection: the picked one')
  eq(wire.addChatCommandsFields(base(), 'no element token').references, [slideRef, live], 'no @Element token: the live selection stays as the refine flag sent it')
  // at most 20 typed references
  reset()
  for (let i = 0; i < 30; i++) wire.registerMention(wire.fileToken(`file ${i}`), { kind: 'file', file_id: `f${i}`, name: `file ${i}`, source: 'upload' })
  eq(wire.referencesInText(Array.from({ length: 30 }, (_, i) => wire.fileToken(`file ${i}`)).join(' ')).length, 20, 'at most 20 typed references on one message')
  ok(wire.chatCommandsBus.mentions.size <= 40, 'the registry itself is bounded')
  // the command hint: only while the text still reads as the request the pre-fill began
  reset()
  wire.registerCommand('add_slide', /^\s*Add a slide after slide \d+/)
  eq(wire.addChatCommandsFields({ text: 'x' }, 'Add a slide after slide 3 about revenue').command, 'add_slide', 'the pre-filled request carries its command')
  ok(!('command' in wire.addChatCommandsFields({ text: 'x' }, 'Please put a slide in')), 'a request rewritten by hand carries no hint (the text is the source of truth)')
  ok(!('command' in wire.addChatCommandsFields({ text: 'x' }, undefined)), 'a non-string text carries none')
  eq(wire.commandInText('  Add a slide after slide 12 about'), 'add_slide', 'leading spaces do not hide it')
  wire.registerCommand('delete_slide', /^\s*Delete slide \d+/)
  eq([wire.commandInText('Add a slide after slide 3'), wire.commandInText('Delete slide 4')], [null, 'delete_slide'], 'one command is pending at a time')
  // what a send spends
  reset()
  wire.registerMention(wire.fileToken('a.pdf'), { kind: 'file', file_id: 'a', name: 'a.pdf', source: 'upload' }); wire.registerMention(wire.fileToken('b.pdf'), { kind: 'file', file_id: 'b', name: 'b.pdf', source: 'upload' })
  wire.registerCommand('duplicate_slide', /^Duplicate slide \d+/)
  wire.chatCommandsSent(`Duplicate slide 3 ${wire.fileToken('a.pdf')}`)
  eq([[...wire.chatCommandsBus.mentions.keys()], wire.chatCommandsBus.command], [[wire.fileToken('b.pdf')], null], 'a send spends the picks it used and the command; other picks stay')
  wire.registerCommand('duplicate_slide', /^Duplicate slide \d+/)
  wire.chatCommandsSent('Yes, go ahead')
  eq(wire.chatCommandsBus.command !== null, true, 'a message that was not that request (a quick reply) leaves the command pending')
  wire.chatCommandsSent('Duplicate slide 4')
  eq(wire.chatCommandsBus.command, null, 'the request itself spends it')
  wire.chatCommandsSent(undefined); reset()
  // the data it is given is the only thing it changes
  const untouched = { text: 'hello', store_name: 's', deep_research: true, theme: { mode: 'preset' } }
  const copy = JSON.parse(JSON.stringify(untouched))
  wire.addChatCommandsFields(copy, 'hello')
  eq({ ...copy, client_caps: undefined }, { ...untouched, client_caps: undefined }, 'no other field of the message changes')
  return wire
}

// ============================================================================================================================================
// B. The lib (through the harness loader, so its real imports resolve)
// ============================================================================================================================================
function makeLoader(env = {}, overrides = {}, extra = {}) {
  const fsReal = fs.readFileSync
  const loader = createModuleLoader({
    root,
    globals: { process: { env: { NODE_ENV: 'production', ...env } }, console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Symbol, Promise, Math, JSON, Object, Array, Error, Map, Set, Number, String, Boolean, RegExp, TextEncoder, TextDecoder, URL, queueMicrotask, ...(extra.globals ?? {}) },
    stubs: extra.stubs ?? {}, fileStubs: extra.fileStubs ?? {},
  })
  if (Object.keys(overrides).length) fs.readFileSync = function (file, ...rest) { const rel = typeof file === 'string' ? path.relative(root, file) : null; return rel && rel in overrides ? overrides[rel] : fsReal.call(fs, file, ...rest) }
  return { loader, restore: () => { fs.readFileSync = fsReal } }
}
function withLoader(env, overrides, extra, fn) {
  const { loader, restore } = makeLoader(env, overrides, extra)
  try { return fn(loader) } finally { restore() }
}

const PK_ORDER = ['/add-slide', '/duplicate', '/delete', '/theme', '/template', '/model', '/research', '/web', '/export', '/publish', '/undo', '/stop']
const slides = [
  { index: 0, title: 'Title', slide_id: 'L0' }, { index: 1, title: 'Market size', slide_id: 'L1' }, { index: 2, title: 'Revenue plan', slide_id: 'L2' },
  { index: 3, title: 'Team', slide_id: 'L3' }, { index: 4, title: 'Risks', slide_id: 'L4' }, { index: 5, title: 'Roadmap', slide_id: 'L5' }, { index: 6, title: 'Ask', slide_id: 'L6' },
]
const elementRef = { kind: 'element', element_id: 'el_chart_7f3a', element_type: 'CHART', slide_index: 2, slide_id: 'L2', label: 'Chart · slide 3' }
const ctxOf = over => ({
  deck: { open: true, slide: 3 }, stop: { visible: true, enabled: true }, undoOn: true, exportOn: true, themeBlocked: null, template: { available: true, blocked: null },
  modelOn: true, research: { locked: false }, ...over,
})

function libSuite(libText = read(LIB), over = {}) {
  const overrides = { [LIB]: libText, ...over }
  return withLoader({ ...ON }, overrides, {}, loader => {
    const lib = loader.load(LIB)
    const wire = loader.load(WIRE)
    // the lib and the wire were built inside the loader's vm: compare what they return as plain data
    const eq = (actual, expected, message) => { checks++; assert.deepEqual(plain(actual), plain(expected), message) }
    // -- the twelve commands, PK's list in PK's order ------------------------------------------------------------------------------------
    eq(lib.CHAT_COMMANDS.map(c => c.name), PK_ORDER, 'the twelve commands, in PK\'s order')
    eq(lib.CHAT_COMMANDS.map(c => c.how), ['prefill', 'prefill', 'prefill', 'run', 'run', 'run', 'run', 'run', 'run', 'decline', 'run', 'run'], 'how each resolves when it can')
    ok(lib.CHAT_COMMANDS.every(c => typeof c.blurb === 'string' && c.blurb.length > 3 && c.blurb.length < 40), 'each has a one-line description')
    eq(lib.CHAT_COMMANDS.find(c => c.id === 'export').args, ['pdf', 'pptx'], '/export takes pdf or pptx')
    eq(Object.keys(lib.COMMAND_HANDLERS).sort(), ['export', 'model', 'publish', 'research', 'stop', 'template', 'theme', 'undo', 'web'], 'a real handler is named for every command that is not a pre-fill')
    // -- the "/" trigger -----------------------------------------------------------------------------------------------------------------------
    const t = text => plain(lib.detectTrigger(text))
    eq(t('/'), { kind: 'command', start: 0, name: '', arg: null }, '"/" at the start opens the menu')
    eq(t('/th'), { kind: 'command', start: 0, name: 'th', arg: null }, 'the name filters')
    eq(t('Make it bold /th'), { kind: 'command', start: 13, name: 'th', arg: null }, '"/" after a space opens it too')
    eq(t('line one\n/st'), { kind: 'command', start: 9, name: 'st', arg: null }, '"/" after a line break opens it')
    eq(t('/export p'), { kind: 'command', start: 0, name: 'export', arg: 'p' }, 'one argument after the name')
    eq(t('/export '), { kind: 'command', start: 0, name: 'export', arg: '' }, 'the argument can be empty')
    for (const none of ['', 'hello', 'a/b', 'http://x', 'and/or', '/a/b', '/export pdf now', '/ x y', '1 / 2 / 3 ok']) eq(t(none), null, `no menu for ${JSON.stringify(none)}`)
    eq(t('x /y z'), { kind: 'command', start: 2, name: 'y', arg: 'z' }, 'a name and an argument that match no command still read as a trigger (and list nothing)')
    eq(t('see @sl'), { kind: 'mention', start: 4, query: 'sl' }, '"@" is the K1 expression: unchanged')
    eq(t('@slide 3'), { kind: 'mention', start: 0, query: 'slide 3' }, '"@slide 3"')
    eq(t('/add @'), { kind: 'mention', start: 5, query: '' }, 'an "@" inside a command text wins')
    eq(t('@[Slide 2: Market] '), null, 'a finished token opens nothing')
    eq(t(undefined), null, 'a non-string text opens nothing')
    eq([lib.triggerKey(lib.detectTrigger('/x')), lib.triggerKey(lib.detectTrigger('a @b')), lib.triggerKey(null)], ['command:0', 'mention:2', null], 'a trigger has a key (where it starts)')
    // -- the rows ----------------------------------------------------------------------------------------------------------------------------
    const rows = text => lib.commandRows(lib.detectTrigger(text)).map(r => r.label)
    eq(rows('/'), PK_ORDER, '"/" lists all twelve, in order')
    eq(rows('/ex'), ['/export'], '"/ex" narrows to export')
    eq(rows('/e'), ['/export', '/add-slide', '/duplicate', '/delete', '/theme', '/template', '/model', '/research', '/web'], '"/e": names that start with it first, then names that contain it, each in list order')
    eq(rows('/ST'), ['/stop'], 'case does not matter')
    eq(rows('/zzz'), [], 'nothing matches: no menu, Enter sends as before')
    eq(plain(lib.commandRows(lib.detectTrigger('/export '))).map(r => [r.label, r.arg, r.fill]), [['/export pdf', 'pdf', false], ['/export pptx', 'pptx', false]], 'after "/export " the formats; picking one runs it')
    eq(rows('/export p'), ['/export pdf', '/export pptx'], '"p" matches both'); eq(rows('/export pd'), ['/export pdf'], '"pd" matches pdf'); eq(rows('/export x'), [], 'no such format')
    eq(rows('/stop '), [], 'a command with no arguments has none to list'); eq(rows('/nope '), [], 'nor an unknown one')
    eq(plain(lib.commandRows(lib.detectTrigger('/ex'))[0]), { key: 'export', id: 'export', label: '/export', blurb: 'Download as PDF or PowerPoint', arg: null, fill: true }, 'picking /export fills "/export " so the formats show (a download never starts from a half-typed name)')
    ok(lib.commandRows(lib.detectTrigger('/')).filter(r => r.id !== 'export').every(r => r.fill === false), 'every other row runs or pre-fills at once')
    // -- what each command resolves to ---------------------------------------------------------------------------------------------------------
    const res = (id, arg, over) => plain(lib.resolveCommand(id, arg, ctxOf(over)))
    const out = r => ({ ...r, pattern: r.pattern ? String(r.pattern) : undefined })
    eq(out(lib.resolveCommand('add-slide', null, ctxOf({}))), { kind: 'prefill', text: 'Add a slide after slide 3 about ', command: 'add_slide', pattern: String(/^\s*Add a slide after slide \d+/) }, '/add-slide: an editable request after the current slide')
    eq(out(lib.resolveCommand('duplicate', null, ctxOf({ deck: { open: true, slide: 1 } }))), { kind: 'prefill', text: 'Duplicate slide 1', command: 'duplicate_slide', pattern: String(/^\s*Duplicate slide \d+/) }, '/duplicate: "Duplicate slide N"')
    eq(out(lib.resolveCommand('delete', null, ctxOf({ deck: { open: true, slide: 12 } }))), { kind: 'prefill', text: 'Delete slide 12', command: 'delete_slide', pattern: String(/^\s*Delete slide \d+/) }, '/delete: "Delete slide N"')
    for (const id of ['add-slide', 'duplicate', 'delete']) {
      for (const deck of [{ open: false, slide: null }, { open: true, slide: null }, { open: false, slide: 2 }]) {
        const r = res(id, null, { deck }); eq([r.kind, r.tone, r.title, r.button], ['decline', 'notice', 'Open a deck first', null], `${id}: no deck, no slide to point at`)
      }
    }
    eq(res('stop', null, {}), { kind: 'run', action: 'stop' }, '/stop: the Send/Stop control\'s stop, while a build runs')
    eq([res('stop', null, { stop: { visible: false, enabled: false } }).title, res('stop', null, { stop: { visible: true, enabled: false } }).title], ['Nothing is building', 'Already stopping'], '/stop: nothing building, already stopping: said plainly')
    eq(res('undo', null, {}), { kind: 'run', action: 'undo' }, '/undo: the Undo chip\'s button, when chat undo is on')
    eq([res('undo', null, { undoOn: false }).title, res('undo', null, { undoOn: false }).body, res('undo', null, { undoOn: false }).control, res('undo', null, { undoOn: false }).button], ["Can't do this from chat yet", "Undo from chat isn't turned on in this build.", 'undo', null], '/undo: chat undo off: can\'t yet, naming the control')
    eq([res('export', 'pdf', {}), res('export', 'pptx', {}), res('export', null, {})], [{ kind: 'run', action: 'export:pdf' }, { kind: 'run', action: 'export:pptx' }, { kind: 'run', action: 'export:pdf' }], '/export: pdf, pptx')
    eq(res('export', 'pdf', { exportOn: false }).title, "Can't do this from chat yet", '/export without the page\'s runner declines')
    eq(res('theme', null, {}), { kind: 'run', action: 'theme' }, '/theme opens the theme popup')
    eq([res('theme', null, { themeBlocked: 'Build theme selection is locked for this deck.' }).title, res('theme', null, { themeBlocked: 'Build theme selection is locked for this deck.' }).body], ['Theme is locked', 'Build theme selection is locked for this deck.'], '/theme locked: the popup\'s own reason')
    eq(res('template', null, {}), { kind: 'run', action: 'template' }, '/template opens the template popup')
    eq(res('template', null, { template: { available: false, blocked: null } }).control, 'template', '/template with no picker in this build declines, naming it')
    eq(res('template', null, { template: { available: true, blocked: 'Template selection is locked for this deck.' } }).title, 'Template is locked', '/template locked')
    eq(res('model', null, {}), { kind: 'run', action: 'model' }, '/model: the gauge')
    eq([res('model', null, { modelOn: false }).control, res('model', null, { modelOn: false }).body], ['model', "The model picker isn't turned on in this build."], '/model with the picker off declines, naming it')
    eq([res('research', null, {}), res('web', null, {})], [{ kind: 'run', action: 'research' }, { kind: 'run', action: 'web' }], '/research and /web flip the switches')
    for (const id of ['research', 'web']) {
      const r = res(id, null, { research: { locked: true } })
      eq([r.kind, r.title, r.body.startsWith('Research already ran'), r.button], ['decline', 'Locked for this deck', true, { label: 'Show research options', action: 'open-research-options' }], `${id}: locked once research has run, with a button to the options menu`)
    }
    const publish = res('publish', null, {})
    eq([publish.kind, publish.tone, publish.title, publish.body, publish.button], ['decline', 'cant-yet', "Can't do this from chat yet", "Publishing from chat isn't ready yet. The Publish button shares this deck.", { label: 'Open Publish', action: 'open-publish' }], '/publish: honest, with the button that does the real thing')
    for (const id of lib.CHAT_COMMANDS.map(c => c.id)) {
      const r = lib.resolveCommand(id, 'pdf', ctxOf({}))
      ok(['run', 'prefill', 'decline'].includes(r.kind), `${id}: resolves to exactly one of run / prefill / decline`)
      if (r.kind === 'decline') ok(r.title && r.body, `${id}: a decline always says why`)
    }
    // -- the research switches' rules ------------------------------------------------------------------------------------------------------------
    eq(plain([[false, false], [true, false], [false, true], [true, true]].map(([d, w]) => [lib.researchAfter('research', d, w), lib.researchAfter('web', d, w)])),
      [[{ deep: true, web: true }, { deep: false, web: true }], [{ deep: false, web: false }, { deep: true, web: true }], [{ deep: true, web: true }, { deep: false, web: false }], [{ deep: false, web: true }, { deep: false, web: false }]], 'the switches\' own rules, all four states')
    eq([lib.researchNote({ deep: true, web: true }), lib.researchNote({ deep: false, web: false })], ['Deep research on · Web search on', 'Deep research off · Web search off'], 'the note reads the new state')
    eq(lib.textBefore('keep this /th', lib.detectTrigger('keep this /th')), 'keep this ', 'the typed "/name" comes out; what was before stays')
    // -- pressing a real control -----------------------------------------------------------------------------------------------------------
    const node = over => { const el = { disabled: false, clicks: 0, click() { this.clicks++ }, getAttribute: () => null, getClientRects: () => [1], ...over }; return el }
    const scope = nodes => ({ querySelectorAll: () => nodes })
    const a = node(), b = node()
    eq([lib.pressControl(scope([a, b]), 'x'), a.clicks, b.clicks], ['clicked', 1, 0], 'presses the first usable control, once')
    const hidden = node({ getClientRects: () => [] }), off = node({ disabled: true }), aria = node({ getAttribute: name => (name === 'aria-disabled' ? 'true' : null) }), shown = node()
    eq([lib.pressControl(scope([hidden, shown]), 'x'), hidden.clicks, shown.clicks], ['clicked', 0, 1], 'a hidden control is skipped')
    eq([lib.pressControl(scope([off]), 'x'), off.clicks, lib.pressControl(scope([aria]), 'x'), aria.clicks], ['disabled', 0, 'disabled', 0], 'a disabled control is reported, never pressed')
    eq([lib.pressControl(scope([]), 'x'), lib.pressControl(null, 'x'), lib.pressControl(scope([hidden]), 'x')], ['missing', 'missing', 'disabled'], 'no control: missing; only a hidden one: it cannot be pressed')
    eq([{ querySelector: () => node() }].map(only => lib.pressControl(only, 'x')), ['clicked'], 'a scope with only querySelector works too')
    eq(lib.CONTROL_SELECTORS, { undo: '[data-studio-chat-undo="idle"]', publish: '[data-studio-publish-trigger]', model: 'button[data-mpick="gauge"]' }, 'the three controls are found by the attributes the real components set')

    // -- the "@" sections --------------------------------------------------------------------------------------------------------------------
    const source = over => ({
      slides, element: elementRef, files: [{ id: 'f1', name: 'q3 report.pdf', source: 'upload' }, { id: 'f2', name: 'notes.docx', source: 'upload' }],
      templates: { status: 'ready', items: [{ id: 't1', name: 'Board update' }, { id: 't2', name: 'Pitch' }] },
      presets: [{ id: 'midnight', name: 'Midnight' }, { id: 'corporate_light', name: 'Corporate light' }], saved: [{ id: 'u-77', name: 'Midnight' }], savedStatus: 'ready', ...over,
    })
    const model = (query, over) => plain(lib.buildMentionModel(source(over), query))
    const all = model('')
    eq(all.items.map(i => i.section), ['slide', 'slide', 'slide', 'slide', 'slide', 'element', 'file', 'file', 'template', 'template', 'theme', 'theme', 'theme'], 'sections in order: Slides · Element · Files · Templates · Themes; 5 slides, 3 of the others')
    eq(lib.MENTION_SECTION_HEADINGS, { slide: 'Slides', element: 'Element', file: 'Files', template: 'Templates', theme: 'Themes' }, 'the headings')
    eq(all.items[0], { key: 'slide:0', section: 'slide', label: 'Slide 1', hint: 'Title', token: '@[Slide 1: Title]', reference: null }, 'a slide: the K1 token, no reference (K1 parses it on send)')
    eq(all.items.find(i => i.section === 'element'), { key: 'element:el_chart_7f3a', section: 'element', label: 'Selected element', hint: 'Chart · slide 3', token: '@[Element: Chart · slide 3]', reference: elementRef }, 'the element: the selection\'s one reference')
    eq(all.items.find(i => i.section === 'file'), { key: 'file:f1', section: 'file', label: 'q3 report.pdf', hint: 'Uploaded', token: '@[File: q3 report.pdf]', reference: { kind: 'file', file_id: 'f1', name: 'q3 report.pdf', source: 'upload' } }, 'a file: token + reference')
    eq(all.items.find(i => i.section === 'template'), { key: 'template:t1', section: 'template', label: 'Board update', hint: 'Template', token: '@[Template: Board update]', reference: { kind: 'template', template_id: 't1', name: 'Board update' } }, 'a template')
    const themes = all.items.filter(i => i.section === 'theme')
    eq(themes.map(i => [i.label, i.hint, i.token, i.reference.source, i.reference.theme_id]), [['Midnight', 'Saved theme', '@[Theme: Midnight (saved)]', 'saved', 'u-77'], ['Midnight', 'Preset theme', '@[Theme: Midnight]', 'preset', 'midnight'], ['Corporate light', 'Preset theme', '@[Theme: Corporate light]', 'preset', 'corporate_light']], 'themes: saved and preset apart (label, token, source), the user\'s own first')
    eq(new Set(all.items.map(i => i.key)).size, all.items.length, 'every row has its own key')
    eq(all.empty, null, 'rows: nothing to apologise for')
    // narrowing by a section word
    eq(model('slide 3').items.map(i => i.key), ['slide:2'], '"@slide 3" is slide 3')
    eq(model('slides').items.length, 7, '"@slides" lists them (12 at most)'); eq(model('slide').narrowed, 'slide', 'narrowed to the section')
    eq(model('file').items.map(i => i.key), ['file:f1', 'file:f2'], '"@file" is the files'); eq(model('file report').items.map(i => i.key), ['file:f1'], '"@file report" filters them')
    eq(model('theme mid').items.map(i => i.key), ['theme:saved:u-77', 'theme:preset:midnight'], '"@theme mid"'); eq(model('template pit').items.map(i => i.key), ['template:t2'], '"@template pit"')
    eq(model('element').items.map(i => i.section), ['element'], '"@element"'); eq(model('elem').items.map(i => i.section), ['element'], '"@elem" finds the element')
    eq(model('mid').items.map(i => i.section), ['theme', 'theme'], 'a plain word filters every section')
    eq(model('3').items.filter(i => i.section === 'slide').map(i => i.key), ['slide:2'], 'a number finds the slide (the K1 filter)')
    eq(model('Revenue').items.map(i => i.key), ['slide:2'], 'a title word finds the slide')
    eq(model('', { slides: [] }).items.filter(i => i.section === 'slide'), [], 'no slides: no Slides section')
    eq(model('', { element: null }).items.filter(i => i.section === 'element'), [], 'Element only when an element is selected')
    eq(model('', { templates: { status: 'loading', items: [] } }).items.filter(i => i.section === 'template'), [], 'templates still loading: none yet')
    eq(model('', { templates: { status: 'off', items: [] } }).items.filter(i => i.section === 'template'), [], 'saved templates off: none')
    eq([model('file', { files: [] }).empty, model('element', { element: null }).empty, model('slide', { slides: [] }).empty], [{ section: 'file', note: 'No files in this deck yet. Attach one with the paperclip.' }, { section: 'element', note: 'Select an element on the slide first.' }, { section: 'slide', note: 'No slides in this deck yet.' }], 'a section you named that is empty says so plainly')
    eq([model('template', { templates: { status: 'loading', items: [] } }).empty.note, model('template', { templates: { status: 'failed', items: [] } }).empty.note, model('template', { templates: { status: 'ready', items: [] } }).empty.note], ['Loading…', "Couldn't load this list.", 'No saved templates to mention yet.'], 'templates: loading, failed, none')
    eq([model('theme', { presets: [], saved: [], savedStatus: 'loading' }).empty.note, model('theme', { presets: [], saved: [], savedStatus: 'ready' }).empty.note], ['Loading…', 'No themes to mention yet.'], 'themes: loading, none')
    eq(model('zzz').items, [], 'a word that matches nothing: no rows (and no menu)'); eq(model('zzz').empty, null, '...and no empty note unless a section was named')
    eq(lib.textWithMention('Tidy up @sl', lib.detectTrigger('Tidy up @sl'), '@[Slide 2: Market size]'), 'Tidy up @[Slide 2: Market size] ', 'a pick: the "@…" becomes the token and a space (as the K1 popover does)')
    eq([lib.moveHighlight(0, 3, 1), lib.moveHighlight(2, 3, 1), lib.moveHighlight(0, 3, -1), lib.moveHighlight(0, 0, 1), lib.moveHighlight(1, 1, -1)], [1, 0, 2, 0, 0], 'the highlight wraps at both ends')
    return { lib, wire }
  })
}

// ============================================================================================================================================
// C. The REAL handlers behind the run commands
// ============================================================================================================================================
/** The text of a `const name = <initializer>` in `source` (the first), or throws. */
function declInit(source, name, fileName = 'source.tsx') {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  let found = null
  const visit = node => { if (!found && ts.isVariableDeclaration(node) && node.name.getText(file) === name && node.initializer) found = node.initializer.getText(file); ts.forEachChild(node, visit) }
  visit(file)
  if (!found) throw new Error(`no declaration of ${name}`)
  return found
}
/** Every property assignment `name: <value>` in `source`, as text. */
function propTexts(source, name) {
  const file = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  const out = []
  const visit = node => { if (ts.isPropertyAssignment(node) && node.name.getText(file) === name) out.push(node.initializer.getText(file)); ts.forEachChild(node, visit) }
  visit(file)
  return out
}
/** The expression, types stripped, evaluated against `scope` (the names the page holds when it runs it). */
function evalTs(expression, scope) {
  const js = ts.transpileModule(`(${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.Preserve } }).outputText
  return vm.runInNewContext(js, { ...scope })
}
const squash = text => text.replace(/\s+/g, ' ').replace(/,\s*([}\])])/g, '$1').replace(/\s+([}\])])/g, '$1').replace(/([{[(])\s+/g, '$1').trim()

/** A document whose `querySelectorAll` finds the host nodes of a mini-react tree by the three selector shapes the composer uses: `[attr]`, `[attr="v"]`, `tag[attr="v"]`. */
function fakeDocument(getTree) {
  const matches = (node, selector) => {
    const m = /^([a-z]+)?\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector)
    if (!m) throw new Error(`fake document: unsupported selector ${selector}`)
    const [, tag, attr, value] = m
    if (tag && node.type !== tag) return false
    return attr in node.props && (value === undefined || String(node.props[attr]) === value)
  }
  const wrap = node => ({ disabled: Boolean(node.props.disabled), click: () => node.props.onClick?.({ detail: 0, preventDefault() {} }), getAttribute: name => (node.props[name] == null ? null : String(node.props[name])), getClientRects: () => [1] })
  return { querySelectorAll: selector => hostNodes(getTree()).filter(node => typeof node.type === 'string' && matches(node, selector)).map(wrap) }
}

async function handlerSuite() {
  const page = readOwn(PAGE), input = readOwn(INPUT)
  const { loader, restore } = makeLoader({ ...ON, NEXT_PUBLIC_STUDIO_CHAT_UNDO: 'true', NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' })
  restore()
  const lib = loader.load(LIB)
  // -- /stop: the Send/Stop control's stop = the page's chatCleanStop (build_control stop), handed to the composer as onStop --------------------------------------
  {
    const calls = []; let request = 'req-1'
    const stop = evalTs(declInit(page, 'chatCleanStop'), { sendBuildControl: (...a) => { calls.push(['send', ...a]); return request }, markNarrationControl: (...a) => calls.push(['mark', ...a]), buildNarration: { buildId: 'b-7' }, toast: t => calls.push(['toast', t.title]) })
    stop()
    eq(calls, [['send', 'stop', 'b-7'], ['mark', 'stop_requested', 'b-7', 'req-1']], '/stop: the page\'s own stop sends build_control stop and marks it requested')
    request = null; stop()
    eq(calls.slice(-1), [['toast', "Couldn't stop the build"]], '/stop: when Director does not take it, the page\'s own toast says so (never silent)')
    ok(/onStop: chatCleanStop/.test(page), '/stop: the page hands chatCleanStop to the composer as the Stop control\'s onStop')
    ok(input.includes('run: () => chatClean?.onStop()') && input.includes('visible: Boolean(chatClean?.composer.showStop), enabled: Boolean(chatClean?.composer.stopEnabled)'), '/stop: the command calls that same onStop, and is live exactly while the Stop button is shown and enabled')
  }
  // -- /research and /web: the options menu's switches: the same handlers, the same rules, the same lock ---------------------------------------------------------
  {
    for (const [deep, web] of [[false, false], [true, false], [false, true], [true, true]]) {
      for (const action of ['research', 'web']) {
        const state = { deep, web }
        const scope = { useCallback: fn => fn, setResearchEnabled: v => { state.deep = v }, setWebSearchEnabled: v => { state.web = v } }
        const onDeep = evalTs(declInit(page, 'handleResearchEnabledChange'), scope), onWeb = evalTs(declInit(page, 'handleWebSearchEnabledChange'), scope)
        const want = lib.researchAfter(action, deep, web)
        if (action === 'research') onDeep(!deep); else onWeb(!web) // exactly what a click on the Switch hands its handler: the opposite of what it shows
        eq(state, plain(want), `/${action} from deep=${deep} web=${web}: the page's own handler ends where the command says it will`)
      }
    }
    ok(input.includes('onCheckedChange={onResearchEnabledChange}') && input.includes('onCheckedChange={onWebSearchEnabledChange}') && count(input, 'disabled={researchSettingsLocked}') >= 2, 'research: the switches in the options menu use these props and this lock')
    ok(input.includes('research: { deep: researchEnabled, web: webSearchEnabled, locked: researchSettingsLocked, onDeep: onResearchEnabledChange, onWeb: onWebSearchEnabledChange, openOptions: () => setResearchOpen(true) }'), 'research: the command is handed those same props')
    ok(/onResearchEnabledChange=\{handleResearchEnabledChange\}/.test(page) && /onWebSearchEnabledChange=\{handleWebSearchEnabledChange\}/.test(page), 'research: the page hands the composer those two handlers')
  }
  // -- /export: the export directive's own runner, with the Download menu's calls and enable rule; the state it is given is the runner's own -------------------------
  {
    const { loader: exportLoader, restore: restoreExport } = makeLoader({ ...ON, NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' })
    restoreExport()
    const { runExportDirective } = exportLoader.load('lib/chat-theme-export.ts')
    const states = {
      done: { stage: 4, final: true, narration: { active: false, phase: 'idle' }, partial: null },
      early: { stage: 2, final: false, narration: { active: false, phase: 'idle' }, partial: null },
      building: { stage: 4, final: true, narration: { active: true, phase: 'building' }, partial: null },
      partial: { stage: 4, final: true, narration: { active: false, phase: 'idle' }, partial: { slides: 3 } },
    }
    const run = async (name, format) => {
      const st = states[name], downloads = []
      const exportDeck = evalTs(declInit(page, 'chatCommandsExport'), {
        elementDirectiveGenerationOwnerRef: { current: { sessionId: 'sess-e', deckOwnerSessionId: 'sess-e', presentationId: 'pres-e', epoch: 0 } }, runExportDirective,
        effectivePresentationUrl: 'https://layout.synthetic.invalid/p/pres-e', effectiveSlideCount: 7, currentStage: st.stage, finalPresentationId: st.final ? 'final-1' : null, finalPresentationUrl: null,
        studioShell: true, studioPartialMetadata: st.partial, effectiveBuildNarrationEnabled: true, buildNarration: st.narration,
        process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD: 'true' } },
        downloadPDF: async (...a) => { downloads.push(['pdf', ...a]); return { success: true } }, downloadPPTX: async (...a) => { downloads.push(['pptx', ...a]); return { success: true } },
      })
      return { result: plain(await exportDeck(format)), downloads }
    }
    let r = await run('done', 'pdf'); eq(r, { result: { directive_id: 'chat-command', status: 'done', error_code: null }, downloads: [['pdf', 'https://layout.synthetic.invalid/p/pres-e', 'high']] }, '/export pdf: the Download menu\'s downloadPDF(url, "high")')
    r = await run('done', 'pptx'); eq(r, { result: { directive_id: 'chat-command', status: 'done', error_code: null }, downloads: [['pptx', 'https://layout.synthetic.invalid/p/pres-e', 7, 'high']] }, '/export pptx: the Download menu\'s downloadPPTX(url, slides, "high")')
    for (const name of ['early', 'building', 'partial']) { r = await run(name, 'pdf'); eq([r.result.status, r.result.error_code, r.downloads], ['failed', 'export_blocked', []], `/export ${name}: the menu's own rule blocks it, nothing is downloaded`) }
    const mine = propTexts(page, 'exportState'), theirs = mine.slice(0, 1)
    eq(mine.length, 2, 'export: the page has the directive runner\'s exportState and this command\'s')
    eq(squash(mine[1]), squash(theirs[0]), 'export: this command is given exactly the state the directive runner is given')
    ok(/displayed: \(\) => elementDirectiveGenerationOwnerRef\.current,\s*exportState/.test(page.slice(page.indexOf('const chatCommandsExport'))), 'export: the same owner record')
    ok(/exportDeck: chatCommandsExport/.test(page), 'export: handed to the composer')
  }
  // -- /undo: a press on the Undo chip's own button (the real component, the real store) --------------------------------------------------------------------------
  {
    const { loader: undoLoader, restore: restoreUndo } = makeLoader({ ...ON, NEXT_PUBLIC_STUDIO_CHAT_UNDO: 'true' })
    restoreUndo()
    const storeModule = undoLoader.load('lib/studio-bulk-edit-store.ts'), chip = undoLoader.load('components/builder/chat/studio-undo-chip.tsx')
    const store = storeModule.createBulkEditUndoStore()
    const SID = 'sess-u', PRES = 'pres-u'
    const context = storeModule.bulkEditUndoContext(SID, { deckOwnerSessionId: SID, presentationId: PRES }, null, true)
    store.route({ type: 'chat_message', message_id: 'm1', session_id: SID, timestamp: '2026-10-26T12:00:00.000Z', role: 'assistant', payload: { text: 'Done', sub_title: null, list_items: null, format: 'markdown', ephemeral: false } }, context)
    store.route({ type: 'change_recorded', message_id: 'c1', session_id: SID, role: 'assistant', payload: { change_id: 'chg-1', label: 'Shortened slide 3', kind: 'slide_replaced', presentation_id: PRES, undoable: true } }, context)
    const undone = []
    const rootNode = new Root()
    rootNode.setElement(React.createElement(chip.StudioUndoChip, { sessionId: SID, messageId: 'm1', undo: (changeId, messageId) => { undone.push([changeId, messageId]); return Promise.resolve(true) }, store }))
    for (let i = 0; i < 4; i++) { await macrotask(); rootNode.flush() }
    const doc = fakeDocument(() => rootNode.tree)
    eq(lib.pressControl(doc, lib.CONTROL_SELECTORS.undo), 'clicked', '/undo: the selector finds the chip\'s idle button and presses it')
    eq(undone, [['chg-1', 'm1']], '/undo: the chip\'s own handler ran: undo(changeId, messageId), the call the chat\'s undo path (sendStudioUndo) is given')
    rootNode.unmount()
    const none = new Root(); none.setElement(React.createElement(chip.StudioUndoChip, { sessionId: SID, messageId: 'no-such-line', undo: () => Promise.resolve(true), store })); none.flush()
    eq(lib.pressControl(fakeDocument(() => none.tree), lib.CONTROL_SELECTORS.undo), 'missing', '/undo: no chip (nothing recorded, or already undone): nothing to press, said plainly')
    none.unmount()
    ok(/undo=\{undoChange\}/.test(readOwn('components/builder/message-list.tsx')) && /sendStudioUndo\(sessionId, changeId, messageId/.test(readOwn('components/builder/message-list.tsx')), '/undo: the chip is given the chat\'s own undo path')
  }
  // -- /model and /publish: the real controls carry the attributes the command presses -----------------------------------------------------------------------------
  {
    const { loader: controlLoader, restore: restoreControl } = makeLoader({ ...ON, NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' })
    restoreControl()
    const sliderModule = controlLoader.load('components/model-choice/model-slider.tsx'), publishModule = controlLoader.load('components/publish-dialog.tsx')
    const gauge = renderToStaticMarkup(React.createElement(sliderModule.ModelSliderView, { label: 'Balanced', valueText: 'Balanced', stateKind: 'choice', scope: 'deck', mode: 'live', ready: true, stops: [], index: 0, thumb: 'selected', advanced: {}, saveNote: '', open: false, onOpenChange() {}, onDraft() {}, onCommit() {}, onAdvanced() {} }))
    ok(/<button[^>]*data-mpick="gauge"[^>]*aria-haspopup="dialog"/.test(gauge) || /<button[^>]*aria-haspopup="dialog"[^>]*data-mpick="gauge"/.test(gauge), '/model: the real gauge is a button with data-mpick="gauge" that opens the slider popover (Radix trigger)')
    ok(/<button[^>]*type="button"/.test(gauge) && !/<button[^>]*\sdisabled=""/.test(gauge), '/model: ... and is a plain enabled button when the picker is ready')
    const publish = renderToStaticMarkup(React.createElement(publishModule.PublishControls, { sessionId: 'sess-p', deckTitle: 'Deck', slideCount: 3, hasFinalDeck: true }))
    ok(/<button[^>]*data-studio-publish-trigger="true"/.test(publish) && !/<button[^>]*data-studio-publish-trigger="true"[^>]*\sdisabled=""/.test(publish), '/publish: the real Publish button carries data-studio-publish-trigger and is enabled once the deck is built')
    ok(/<button[^>]*data-studio-publish-trigger="true"[^>]*\sdisabled=""/.test(renderToStaticMarkup(React.createElement(publishModule.PublishControls, { sessionId: 'sess-p', deckTitle: 'Deck', slideCount: 3, hasFinalDeck: false }))), '/publish: ... and disabled before it (the command then says Publish is not ready)')
    ok(/data-studio-publish-trigger=\{STUDIO_PUBLISH \? 'true' : undefined\}[\s\S]{0,260}onClick=\{\(\) => setOpen\(true\)\}/.test(read('components/publish-dialog.tsx')), '/publish: that button\'s own onClick opens the Publish dialog')
    ok(read('components/model-choice/model-slider.tsx').includes('data-mpick="gauge"') && /PopoverPrimitive\.Trigger\s+type="button"/.test(read('components/model-choice/model-slider.tsx')), '/model: the source: the gauge is the popover\'s own trigger')
  }
}

// ============================================================================================================================================
// D. The composer with real React: ChatInput, the hook and the menus (Radix pieces, the template popup and the theme menu are recorders)
// ============================================================================================================================================
const SLIDES = slides
const FILES = [
  { id: 'f1', name: 'q3 report.pdf', size: 1, type: 'application/pdf', status: 'success', uploadProgress: 100 },
  { id: 'f2', name: 'notes.docx', size: 1, type: 'application/msword', status: 'processing', uploadProgress: 100 },
]
const FILES_ALL = [...FILES,
  { id: 'f3', name: 'still-uploading.pdf', size: 1, type: 'application/pdf', status: 'uploading', uploadProgress: 40 },
  { id: 'f4', name: 'broken.pdf', size: 1, type: 'application/pdf', status: 'error', uploadProgress: 0 },
]
const ROUTES = {
  '/api/templates': { templates: [{ id: 't1', name: 'Board update' }, { id: 't2', name: 'Pitch deck' }], count: 2 },
  '/api/themes': { themes: [{ id: 'u-77', name: 'Midnight sun', theme_payload: { mode: 'preset', preset_id: 'corporate_light' } }], count: 1 },
}
const FILE_STUBS = records => ({
  'components/builder/studio-composer-hint': { StudioComposerHint: ({ children }) => children },
  'components/ui/dropdown-menu': { DropdownMenu: props => { records.menus.push(props); return props.children }, DropdownMenuTrigger: ({ children }) => children, DropdownMenuContent: props => props.children },
  'components/ui/switch': { Switch: () => null }, 'components/file-chip': { FileChip: () => null },
  // the field: a plain textarea that hands its ref to the proof (the harness' host nodes do not keep refs)
  'components/ui/textarea': { Textarea: React.forwardRef((props, ref) => { records.textareaRef = ref; return React.createElement('textarea', props) }) },
  // the gauge: a button with the attributes the real one has (checked against the real component above); the Radix popover behind it cannot run on the offline host
  'components/model-choice/model-picker': { ModelPicker: props => React.createElement('button', { type: 'button', 'data-mpick': 'gauge', disabled: Boolean(props.disabled), onClick: () => records.calls.push(['gauge']) }) },
  'components/builder/studio-theme-menu': { StudioThemeMenu: () => null },
  'components/builder/template-picker': { TemplatePicker: props => { records.pickers.push(props); return null } },
})

async function mountComposer(opts = {}) {
  const records = { menus: [], pickers: [], fetches: [], calls: [] }
  const doc = { find: () => [] }
  const env = { ...ON, NEXT_PUBLIC_CHAT_MENTIONS: 'true', NEXT_PUBLIC_STUDIO_CHAT_UNDO: 'true', NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true', ...(opts.env ?? {}) }
  for (const [name, value] of Object.entries(env)) if (value === undefined) delete env[name]
  const fetchFn = async url => {
    records.fetches.push(String(url))
    const route = (opts.routes ?? ROUTES)[String(url)]
    return route ? { ok: true, status: 200, json: async () => route } : { ok: false, status: 500, json: async () => ({}) }
  }
  const { loader, restore } = makeLoader(env, opts.overrides ?? {}, { globals: { fetch: fetchFn, document: { querySelectorAll: sel => doc.find(sel), getElementById: id => { records.scrolled ??= []; return { scrollIntoView: options => records.scrolled.push([id, options]) } } } }, fileStubs: FILE_STUBS(records) })
  let mod, cleanLib
  try { mod = loader.load(INPUT); cleanLib = loader.load('lib/studio-chat-clean.ts') } finally { restore() }
  const composer = over => cleanLib.chatCleanComposerState({ enabled: true, active: false, phase: 'idle', control: 'idle', slidesDone: 0, slideCount: 0, controlEnabled: true, ackKey: null, ackLine: '', ...over })
  const state = { text: opts.text ?? '', extra: { ...(opts.props ?? {}) }, set: null, textarea: null }
  const page = { slides: SLIDES, currentSlide: 3, getElement: () => state.element ?? null, exportDeck: async format => { records.calls.push(['export', format]); return state.exportResult ?? { status: 'done', error_code: null } } }
  function Wrapper() {
    const [value, setValue] = React.useState(state.text)
    state.text = value; state.set = setValue
    const props = {
      inputMessage: value, onInputChange: v => { state.text = v; setValue(v) }, onSubmit: () => records.calls.push(['submit', state.text]), uploadedFiles: FILES, onFilesSelected() {}, onRemoveFile() {}, onClearAllFiles() {}, pendingActionInput: null, onCancelAction() {},
      researchEnabled: false, onResearchEnabledChange: v => records.calls.push(['deep', v]), webSearchEnabled: false, onWebSearchEnabledChange: v => records.calls.push(['web', v]), knowledgeGraphEnabled: false, onKnowledgeGraphEnabledChange() {}, showKnowledgeGraphToggle: false,
      knowledgeGraphAccess: 'unavailable', onKnowledgeGraphAccessClick() {}, isReady: true, isLoadingSession: false, connected: true, connecting: false, user: { id: 'u1' }, currentSessionId: 's1', onRequestSession: async () => {}, buildTheme: { mode: 'auto' }, onBuildThemeChange() {},
      templateBuilderEnabled: true, onSelectTemplate() {}, onOpenComposerLibrary: undefined,
      studioChatClean: { composer: composer(opts.composer ?? {}), onStop: () => records.calls.push(['stop']), onSendDirections() {}, sessionId: 's1' },
      ...(opts.noPage ? {} : { studioChatCommands: page }),
      ...(opts.mentionSlides ? { mentionSlides: SLIDES } : {}),
      ...state.extra,
    }
    return React.createElement(mod.ChatInput, props)
  }
  const rootNode = new Root()
  rootNode.setElement(React.createElement(Wrapper))
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 80) throw new Error('did not settle'); await macrotask(); quiet = rootNode.flush() ? 0 : quiet + 1 } }
  await settle()
  const fakeTextarea = { focused: 0, selection: null, style: {}, scrollHeight: 20, getBoundingClientRect: () => ({ width: 300 }), focus() { this.focused++ }, setSelectionRange(a, b) { this.selection = [a, b] }, closest: () => ({ querySelectorAll: sel => doc.find(sel, 'composer') }), get value() { return state.text } }
  const api = {
    records, state, doc, rootNode, settle, fakeTextarea, loader, page,
    nodes: () => hostNodes(rootNode.tree),
    ta() { const node = hostNodes(rootNode.tree).find(n => n.type === 'textarea'); if (records.textareaRef && typeof records.textareaRef === 'object') records.textareaRef.current = fakeTextarea; return node },
    async type(value) { api.ta().props.onChange({ target: { value } }); await settle() },
    async key(key, extra = {}) { const event = { key, shiftKey: false, nativeEvent: {}, prevented: 0, preventDefault() { this.prevented++ }, ...extra }; api.ta().props.onKeyDown(event); await settle(); return event },
    menu: () => hostNodes(rootNode.tree).find(n => n.props?.['data-studio-chat-commands-menu']) ?? null,
    rows: () => hostNodes(rootNode.tree).filter(n => n.type === 'button' && n.props.role === 'option'),
    note: () => hostNodes(rootNode.tree).find(n => n.props?.['data-studio-chat-commands-note']) ?? null,
    labels: () => api.rows().map(n => n.props['aria-label']),
    text: () => state.text,
    set: async patch => { Object.assign(state.extra, patch); rootNode.schedule(); await settle() },
    markup: () => renderToStaticMarkup(toElements(rootNode.tree)),
    themeMenu: () => records.menus.slice(-2)[0], researchMenu: () => records.menus.slice(-2)[1], picker: () => records.pickers.at(-1),
    unmount: () => rootNode.unmount(),
  }
  return api
}
const rowText = node => hostNodes({ t: 'host', props: {}, children: node.children }).map(n => n.children).flat().filter(c => c?.t === 'text').map(c => c.value).join('|')

async function composerSuite(over = {}) {
  const overrides = over
  // -- flag off, and the flag on without the v3.1 composer: nothing at all --------------------------------------------------------------------------------------
  {
    const c = await mountComposer({ env: { NEXT_PUBLIC_STUDIO_CHAT_COMMANDS: undefined }, overrides })
    await c.type('/'); ok(!c.menu() && c.rows().length === 0, 'flag off: "/" opens nothing')
    const e = await c.key('Enter'); eq([e.prevented, c.records.calls], [1, [['submit', '/']]], 'flag off: Enter sends "/" as before')
    await c.type('@'); ok(!c.menu() && c.rows().length === 0 && !c.markup().includes('data-studio-composer-mentions'), 'flag off, the page passes no slide list: "@" opens nothing (the K1 popover needs its slides)')
    c.unmount()
    const off = await mountComposer({ env: { NEXT_PUBLIC_STUDIO_CHAT_COMMANDS: undefined }, mentionSlides: true, overrides })
    await off.type('@'); ok(off.markup().includes('data-studio-composer-mentions') && count(off.markup(), 'aria-label="Mention slide') === 7, 'flag off: "@" is the K1 slide popover, exactly as before')
    off.unmount()
    const noClean = await mountComposer({ props: { studioChatClean: undefined }, overrides })
    await noClean.type('/'); ok(!noClean.menu() && !noClean.note(), 'flag on without the v3.1 composer props: inert')
    noClean.unmount()
    const noPage = await mountComposer({ noPage: true, overrides })
    await noPage.type('/'); ok(!noPage.menu(), 'flag on, no page props: inert')
    noPage.unmount()
    const noShell = await mountComposer({ env: { NEXT_PUBLIC_STUDIO_V4_SHELL: undefined }, overrides })
    await noShell.type('/'); ok(!noShell.menu(), 'flag on without the Studio shell: inert')
    noShell.unmount()
  }
  // -- the "/" menu: open, filter, keyboard ------------------------------------------------------------------------------------------------------------------------
  const c = await mountComposer({ overrides })
  eq([c.menu(), c.ta().props['aria-controls']], [null, undefined], 'closed: no menu, no aria on the field')
  await c.type('/')
  ok(c.menu() && c.menu().props.role === 'listbox' && c.menu().props['aria-label'] === 'Commands', '"/" opens the command menu (a listbox)')
  eq(c.rows().length, 12, 'twelve rows'); eq(c.rows().map(n => n.props['data-studio-chat-command']), ['add-slide', 'duplicate', 'delete', 'theme', 'template', 'model', 'research', 'web', 'export', 'publish', 'undo', 'stop'], 'in PK\'s order')
  ok(c.rows()[0].props['aria-selected'] === true && c.rows().slice(1).every(n => n.props['aria-selected'] === false), 'the first row is highlighted')
  eq([c.ta().props['aria-controls'], c.ta().props['aria-activedescendant'], c.ta().props['aria-autocomplete']], [c.menu().props.id, c.rows()[0].props.id, 'list'], 'the field points at the menu and the highlighted row')
  ok(c.markup().includes('Enter or Tab chooses · Esc closes') && c.markup().includes('data-studio-composer-mentions="true"'), 'the menu is on the composer\'s own "@" surface, with its hint line')
  ok(c.rows().every(n => /: /.test(n.props['aria-label'])) && c.rows()[0].props['aria-label'] === '/add-slide: Add a slide after this one', 'every row says what it does')
  await c.key('ArrowDown'); ok(c.rows()[1].props['aria-selected'] === true, 'ArrowDown moves down')
  const up = await c.key('ArrowUp'); ok(up.prevented === 1 && c.rows()[0].props['aria-selected'] === true, 'ArrowUp moves up (and keeps the caret where it is)')
  await c.key('ArrowUp'); ok(c.rows()[11].props['aria-selected'] === true, 'ArrowUp wraps to the last'); await c.key('ArrowDown'); ok(c.rows()[0].props['aria-selected'] === true, 'ArrowDown wraps to the first')
  await c.rows()[4].props.onMouseEnter?.(); await c.settle(); ok(c.rows()[4].props['aria-selected'] === true, 'hover moves the highlight')
  // filter
  await c.type('/th'); eq(c.rows().map(n => n.props['data-studio-chat-command']), ['theme'], 'type to filter')
  await c.type('/zzz'); ok(!c.menu() && !c.ta().props['aria-controls'], 'nothing matches: no menu')
  c.records.calls.length = 0
  let e = await c.key('Enter'); eq([e.prevented, c.records.calls], [1, [['submit', '/zzz']]], 'nothing matches: Enter sends as it always did')
  await c.type('/th')
  // Esc closes and stays closed for this "/"
  e = await c.key('Escape'); ok(e.prevented === 1 && !c.menu(), 'Esc closes the menu'); await c.type('/the'); ok(!c.menu(), '...and it stays closed while the same "/" is being typed')
  await c.type('hello'); await c.type('/'); ok(c.menu(), 'a new "/" opens it again')
  // keys that must not be taken
  for (const [label, key, extra] of [['Shift+Enter', 'Enter', { shiftKey: true }], ['Shift+Tab', 'Tab', { shiftKey: true }], ['an arrow during IME composition', 'ArrowDown', { nativeEvent: { isComposing: true } }], ['a letter', 'a', {}], ['Backspace', 'Backspace', {}]]) {
    c.records.calls.length = 0; const ev = await c.key(key, extra); ok(ev.prevented === 0 && c.menu() && c.records.calls.length === 0, `${label} is not taken by the menu`)
  }
  // Enter and Tab pick; Esc with no menu is not taken
  await c.type('/model'); eq(c.rows().map(n => n.props['data-studio-chat-command']), ['model'], 'filtered to /model')
  c.unmount()
  return c
}


const tick = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms))
const RUNNING = { active: true, phase: 'building', control: 'running', slidesDone: 2, slideCount: 7 }
const noteOf = c => { const n = c.note(); return n ? { tone: n.props['data-studio-chat-commands-note'], control: n.props['data-studio-chat-commands-control'] ?? null, text: hostNodes({ t: 'host', props: {}, children: n.children }).filter(h => h.type === 'p' || h.type === 'button').map(h => h.children.map(x => x.value ?? '').join('')) } : null }
const pressNoteButton = async (c, which) => { const b = hostNodes(c.rootNode.tree).find(n => n.type === 'button' && n.props[which]); b.props.onClick(); await c.settle() }
const wireOf = c => c.loader.load(WIRE)
const tokenFlow = async (c, query, pick = 0) => { await c.type(query); for (let i = 0; i < pick; i++) await c.key('ArrowDown'); const e = await c.key('Enter'); return e }

async function commandSuite(overrides = {}) {
  // -- /add-slide, /duplicate, /delete: an editable request, nothing sent ------------------------------------------------------------------------------------------
  for (const [name, text, command, said] of [['add-slide', 'Add a slide after slide 3 about ', 'add_slide', 'Add a slide after slide 3 about growth'], ['duplicate', 'Duplicate slide 3', 'duplicate_slide', 'Duplicate slide 3'], ['delete', 'Delete slide 3', 'delete_slide', 'Delete slide 3']]) {
    const c = await mountComposer({ overrides })
    await c.type(`/${name}`)
    const e = await c.key('Enter')
    eq([e.prevented, c.text(), c.menu() === null, c.records.calls], [1, text, true, []], `/${name}: the composer text becomes "${text}", nothing is sent`)
    await tick()
    eq([c.fakeTextarea.focused > 0, c.fakeTextarea.selection], [true, [text.length, text.length]], `/${name}: focus stays in the composer with the cursor at the end`)
    eq(wireOf(c).commandInText(said), command, `/${name}: the wire carries command ${command} while the text still reads as that request`)
    c.page.currentSlide = 5; await c.type('/'); await c.type(''); await c.type(`/${name}`); await c.key('Enter')
    ok(c.text().includes('slide 5'), `/${name}: N is the slide on the canvas now`)
    c.unmount()
  }
  { // text typed before the "/" stays
    const c = await mountComposer({ overrides }); await c.type('Please /dup'); await c.key('Enter')
    eq(c.text(), 'Please Duplicate slide 3', 'a "/" after other words keeps them'); c.unmount()
  }
  { // no deck: said plainly
    const c = await mountComposer({ overrides }); c.page.slides = []; c.page.currentSlide = null
    await c.type('/delete'); await c.key('Enter')
    eq([c.text(), noteOf(c).tone, noteOf(c).text.slice(0, 1)], ['', 'notice', ['Open a deck first']], '/delete with no deck: nothing is pre-filled, the note says why'); c.unmount()
  }
  // -- /stop ------------------------------------------------------------------------------------------------------------------------------------------------
  {
    const c = await mountComposer({ overrides, composer: RUNNING })
    await c.type('/stop'); await c.key('Enter')
    eq([c.records.calls, c.text(), c.note()], [[['stop']], '', null], '/stop while a build runs: the Send/Stop control\'s stop, once')
    c.unmount()
    const idle = await mountComposer({ overrides }); await idle.type('/stop'); await idle.key('Enter')
    eq([idle.records.calls, noteOf(idle).text[0]], [[], 'Nothing is building'], '/stop with no build: nothing is stopped, the note says so'); idle.unmount()
    const stopping = await mountComposer({ overrides, composer: { ...RUNNING, control: 'stop_requested' } }); await stopping.type('/stop'); await stopping.key('Enter')
    eq([stopping.records.calls, noteOf(stopping).text[0]], [[], 'Already stopping'], '/stop while the stop is in flight: not sent twice'); stopping.unmount()
    const held = await mountComposer({ overrides, composer: { ...RUNNING, control: 'stopped', phase: 'stopped' } }); await held.type('/stop'); await held.key('Enter')
    eq([held.records.calls, noteOf(held).text[0]], [[], 'Nothing is building'], '/stop on a held build: nothing is building'); held.unmount()
  }
  // -- /undo ------------------------------------------------------------------------------------------------------------------------------------------------
  {
    const c = await mountComposer({ overrides })
    const chip = { disabled: false, click() { c.records.calls.push(['undo-chip-click']) }, getAttribute: () => null, getClientRects: () => [1] }
    c.doc.find = selector => (selector === '[data-studio-chat-undo="idle"]' ? [chip] : [])
    await c.type('/undo'); await c.key('Enter')
    eq([c.records.calls, noteOf(c).tone, noteOf(c).text[0]], [[['undo-chip-click']], 'done', 'Asked Director to undo the last change.'], '/undo: presses the Undo chip\'s button, nothing else')
    c.doc.find = () => []; await c.type('/undo'); await c.key('Enter')
    eq([c.records.calls.length, noteOf(c).text[0]], [1, 'Nothing to undo right now'], '/undo with no chip: said plainly'); c.unmount()
    const off = await mountComposer({ overrides, env: { NEXT_PUBLIC_STUDIO_CHAT_UNDO: undefined } }); await off.type('/undo'); await off.key('Enter')
    eq([noteOf(off), off.records.calls], [{ tone: 'cant-yet', control: 'undo', text: ["Can't do this from chat yet", "Undo from chat isn't turned on in this build.", 'Dismiss'] }, []], '/undo with chat undo off: can\'t yet, naming the control, no button to a feature that is off'); off.unmount()
  }
  // -- /export ----------------------------------------------------------------------------------------------------------------------------------------------
  {
    const c = await mountComposer({ overrides })
    await c.type('/export'); await c.key('Enter')
    eq([c.text(), c.rows().map(n => n.props['data-studio-chat-command']), c.records.calls], ['/export ', ['export', 'export'], []], '/export fills "/export " and lists the formats: no download starts from a half-typed name')
    eq(c.labels(), ['/export pdf: Download the deck as a PDF', '/export pptx: Download the deck as a PowerPoint'], 'the formats')
    await c.key('Enter'); await tick(); await c.settle()
    eq([c.records.calls, noteOf(c).text[0]], [[['export', 'pdf']], 'Your PDF download started.'], '/export pdf: the directive runner, then "download started"')
    await c.type('/export '); await c.key('ArrowDown'); await c.key('Enter'); await tick(); await c.settle()
    eq(c.records.calls.slice(1), [['export', 'pptx']], '/export pptx'); await c.type('/export pdf'); await c.key('Enter'); await tick(); await c.settle()
    eq(c.records.calls.length, 3, 'a typed "/export pdf" runs it too')
    c.state.exportResult = { status: 'failed', error_code: 'export_blocked' }; await c.type('/export pdf'); await c.key('Enter'); await tick(); await c.settle()
    eq(noteOf(c).text.slice(0, 2), ["Export isn't ready yet", 'The Download menu opens up once the deck is built. Finish or stop the build first.'], 'blocked: said plainly')
    c.state.exportResult = { status: 'failed', error_code: 'export_failed' }; await c.type('/export pdf'); await c.key('Enter'); await tick(); await c.settle()
    eq(noteOf(c).text[0], "Couldn't export", 'failed: said plainly')
    c.unmount()
    const none = await mountComposer({ overrides, noPage: false }); none.page.exportDeck = null; await none.type('/export pdf'); await none.key('Enter')
    eq(noteOf(none).text[0], "Can't do this from chat yet", 'no runner: can\'t yet'); none.unmount()
  }
  // -- /theme: the theme popup's open state and its saved-themes read -----------------------------------------------------------------------------------------------
  {
    const viaTrigger = await mountComposer({ overrides }); viaTrigger.themeMenu().onOpenChange(true); await viaTrigger.settle(); await tick(); await viaTrigger.settle()
    const c = await mountComposer({ overrides })
    eq(c.themeMenu().open, false, 'the theme popup starts closed')
    await c.type('/theme'); await c.key('Enter'); await tick(); await c.settle()
    eq([c.themeMenu().open, c.text(), c.note()], [true, '', null], '/theme opens the theme popup')
    eq(c.records.fetches.filter(u => u === '/api/themes'), viaTrigger.records.fetches.filter(u => u === '/api/themes'), '/theme reads the saved themes exactly as the button does')
    ok(viaTrigger.themeMenu().open === true, 'the button path opens the same state')
    c.unmount(); viaTrigger.unmount()
    const locked = await mountComposer({ overrides, props: { templateSelectionLocked: true } }); await locked.type('/theme'); await locked.key('Enter')
    eq([locked.themeMenu().open, noteOf(locked).text.slice(0, 2)], [false, ['Theme is locked', 'Build theme selection is locked for this deck.']], '/theme on a locked deck: not opened, the popup\'s own reason'); locked.unmount()
  }
  // -- /template: the template popup's open state ----------------------------------------------------------------------------------------------------------------
  {
    const c = await mountComposer({ overrides })
    eq([c.picker().open, typeof c.picker().onOpenChange], [false, 'function'], 'the flag takes over the template popup\'s open state (closed to begin with)')
    await c.type('/template'); await c.key('Enter')
    eq([c.picker().open, c.text()], [true, ''], '/template opens the template popup')
    c.picker().onOpenChange(false); await c.settle(); eq(c.picker().open, false, '...and the popup closes itself as it always did'); c.picker().onOpenChange(true); await c.settle(); eq(c.picker().open, true, '...and its own button opens it')
    c.unmount()
    const v2 = await mountComposer({ overrides, env: { NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2: 'true' } })
    eq([v2.picker().open, v2.picker().dropdowns], [false, true], 'with the composer popups flag on, the composer owns the open state')
    await v2.type('/template'); await v2.key('Enter'); eq(v2.picker().open, true, '/template opens it through the composer\'s own popup state'); v2.unmount()
    const off = await mountComposer({ overrides, props: { templateBuilderEnabled: false, onSelectTemplate: undefined } }); await off.type('/template'); await off.key('Enter')
    eq(noteOf(off).text.slice(0, 2), ["Can't do this from chat yet", "Templates aren't turned on in this build."], '/template with no template picker in this build: can\'t yet, naming it'); off.unmount()
    const locked = await mountComposer({ overrides, props: { templateSelectionLocked: true } }); await locked.type('/template'); await locked.key('Enter')
    eq([locked.picker().open, noteOf(locked).text[0]], [false, 'Template is locked'], '/template on a locked deck: the picker\'s own rule'); locked.unmount()
  }
  // -- /model: a press on the gauge ------------------------------------------------------------------------------------------------------------------------------------
  {
    const c = await mountComposer({ overrides })
    c.doc.find = selector => fakeDocument(() => c.rootNode.tree).querySelectorAll(selector)
    await c.type('/model'); await c.key('Enter')
    eq([c.records.calls, c.text(), c.note()], [[['gauge']], '', null], '/model presses the gauge button: the slider popover opens')
    c.doc.find = () => []; await c.type('/model'); await c.key('Enter')
    eq([c.records.calls.length, noteOf(c).text[0]], [1, "Model choice isn't ready"], '/model with no gauge to press: said plainly'); c.unmount()
    const off = await mountComposer({ overrides, env: { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: undefined } }); await off.type('/model'); await off.key('Enter')
    eq([noteOf(off).control, noteOf(off).text.slice(0, 2)], ['model', ["Can't do this from chat yet", "The model picker isn't turned on in this build."]], '/model with the picker off: can\'t yet, naming the picker'); off.unmount()
  }
  // -- /research and /web ---------------------------------------------------------------------------------------------------------------------------------------------
  {
    const c = await mountComposer({ overrides })
    await c.type('/research'); await c.key('Enter')
    eq([c.records.calls, noteOf(c).text[0]], [[['deep', true]], 'Deep research on · Web search on'], '/research: the switch\'s own handler, with the value a click gives it')
    await c.type('/web'); await c.key('Enter')
    eq([c.records.calls.slice(1), noteOf(c).text[0]], [[['web', true]], 'Deep research off · Web search on'], '/web')
    await c.set({ researchEnabled: true, webSearchEnabled: true })
    await c.type('/research'); await c.key('Enter'); await c.type('/web'); await c.key('Enter')
    eq(c.records.calls.slice(2), [['deep', false], ['web', false]], 'on -> off, by the same handlers')
    c.unmount()
    const locked = await mountComposer({ overrides, props: { researchSettingsLocked: true } })
    await locked.type('/research'); await locked.key('Enter')
    eq([locked.records.calls, noteOf(locked).text.slice(0, 3)], [[], ['Locked for this deck', 'Research already ran, so these switches can no longer change. Start a new session to change them.', 'Show research options']], '/research once research has run: the lock holds, with the way to the options menu')
    eq(locked.researchMenu().open, false, 'the options menu starts closed')
    await pressNoteButton(locked, 'data-studio-chat-commands-button'); eq([locked.researchMenu().open, locked.note()], [true, null], 'the button opens the research options')
    locked.unmount()
  }
  // -- /publish --------------------------------------------------------------------------------------------------------------------------------------------------------
  {
    const c = await mountComposer({ overrides })
    await c.type('/publish'); await c.key('Enter')
    eq(noteOf(c), { tone: 'cant-yet', control: 'publish', text: ["Can't do this from chat yet", "Publishing from chat isn't ready yet. The Publish button shares this deck.", 'Open Publish', 'Dismiss'] }, '/publish: honest, with the button')
    const publishButton = { disabled: false, click() { c.records.calls.push(['publish-click']) }, getAttribute: () => null, getClientRects: () => [1] }
    c.doc.find = selector => (selector === '[data-studio-publish-trigger]' ? [publishButton] : [])
    await pressNoteButton(c, 'data-studio-chat-commands-button')
    eq([c.records.calls, c.note()], [[['publish-click']], null], 'the button presses the real Publish button')
    c.doc.find = () => []; await c.type('/publish'); await c.key('Enter'); await pressNoteButton(c, 'data-studio-chat-commands-button')
    eq(noteOf(c).text.slice(0, 1), ['Publish is not ready'], 'with no Publish button to press (no built deck): said plainly')
    await c.key('Escape'); eq(c.note(), null, 'Esc closes a note')
    await c.type('/publish'); await c.key('Enter'); await pressNoteButton(c, 'data-studio-chat-commands-dismiss'); eq(c.note(), null, 'Dismiss closes it')
    await c.type('/publish'); await c.key('Enter'); await c.type('/'); ok(c.menu() && !c.note(), 'a new "/" shows the menu in place of the note')
    c.unmount()
  }
  // -- pointer and touch --------------------------------------------------------------------------------------------------------------------------------------------------
  {
    const c = await mountComposer({ overrides })
    await c.type('/'); let prevented = 0
    c.rows()[3].props.onMouseDown({ preventDefault: () => prevented++ }); await c.settle()
    eq([prevented, c.themeMenu().open], [1, true], 'pointer / touch: pressing a row picks it and keeps the composer\'s focus')
    await c.type('/'); c.rows()[3].props.onClick({ detail: 1 }); await c.settle(); eq(c.rows().length, 12, 'the click after a mouse press picks nothing twice')
    c.rows()[0].props.onClick({ detail: 0 }); await c.settle(); eq(c.text().startsWith('Add a slide after slide 3'), true, 'assistive technology activation picks')
    c.unmount()
  }
}

async function mentionSuite(overrides = {}) {
  const sections = c => c.nodes().filter(n => n.props?.['data-studio-chat-commands-heading']).map(n => n.props['data-studio-chat-commands-heading'])
  {
    const c = await mountComposer({ overrides })
    await c.type('@')
    ok(c.menu() && c.menu().props['data-studio-chat-commands-menu'] === 'mentions' && c.menu().props['aria-label'] === 'Mention something', '"@" opens the mention menu')
    await tick(); await c.settle()
    eq(sections(c), ['slide', 'file', 'template', 'theme'], 'Slides · Files · Templates · Themes (and Element only when an element is selected)')
    eq(c.rows().map(n => n.props['data-studio-chat-mention']), ['slide', 'slide', 'slide', 'slide', 'slide', 'file', 'file', 'template', 'template', 'theme', 'theme', 'theme'], 'five slides, then what the pickers hold')
    eq(c.records.fetches.filter(u => u === '/api/templates'), ['/api/templates'], 'the template list is read once, through the template popup\'s own list call')
    eq(c.records.fetches.filter(u => u === '/api/themes'), ['/api/themes'], 'the saved themes are read once, through the composer\'s own refresh')
    ok(!c.records.fetches.some(u => !['/api/templates', '/api/themes'].includes(u) && !/themes\/presets/.test(u)), 'no other fetch is made for the menu')
    await c.key('Escape'); await c.type(''); await c.type('@'); await tick(); await c.settle()
    eq([c.records.fetches.filter(u => u === '/api/templates').length, c.records.fetches.filter(u => u === '/api/themes').length], [1, 1], 'a list that is loaded is not read again')
    // a slide: the K1 token, nothing registered
    const w = wireOf(c)
    await c.type('Tidy @slide 2'); eq(c.rows().map(n => n.props['aria-label']), ['Mention Slide 2, Market size'], '"@slide 2" is slide 2')
    await c.key('Enter'); eq(c.text(), 'Tidy @[Slide 2: Market size] ', 'a slide pick: the K1 token and a space')
    eq([w.chatCommandsBus.mentions.size, c.menu()], [0, null], '...K1 turns it into a reference on send: nothing is registered here')
    // a file
    await c.type('@file'); eq(c.rows().map(n => n.props['aria-label']), ['Mention q3 report.pdf, Uploaded', 'Mention notes.docx, Uploaded'], '"@file": this deck\'s uploads')
    await c.key('Enter'); eq(c.text(), '@[File: q3 report.pdf] ', 'a file pick: a readable token')
    eq(plain(w.referencesInText(c.text())), [{ kind: 'file', file_id: 'f1', name: 'q3 report.pdf', source: 'upload' }], '...with its typed reference')
    await c.type('@[File: q3 report.pdf] and more'); eq(plain(w.referencesInText(c.text())).length, 1, 'the token typed on: still one reference')
    await c.type('and more'); eq(plain(w.referencesInText(c.text())), [], 'a deleted token drops its reference')
    // a template
    await c.type('@template pit'); await c.key('Enter')
    eq([c.text(), plain(w.referencesInText(c.text()))], ['@[Template: Pitch deck] ', [{ kind: 'template', template_id: 't2', name: 'Pitch deck' }]], 'a template pick: token + reference')
    // themes: saved and preset apart
    await c.type('@theme'); eq(c.rows().map(n => n.props['aria-label']).slice(0, 2), ['Mention Midnight sun, Saved theme', 'Mention Corporate Light, Preset theme'], '"@theme": the user\'s own first, labelled apart')
    await c.key('Enter'); eq([c.text(), plain(w.referencesInText(c.text()))], ['@[Theme: Midnight sun (saved)] ', [{ kind: 'theme', theme_id: 'u-77', name: 'Midnight sun', source: 'saved' }]], 'a saved theme: token says so, reference says source saved')
    await c.type('@theme corp'); await c.key('Enter'); eq([c.text(), plain(w.referencesInText(c.text()))], ['@[Theme: Corporate Light] ', [{ kind: 'theme', theme_id: 'corporate_light', name: 'Corporate Light', source: 'preset' }]], 'a preset theme: source preset, its preset id')
    // an element
    await c.type('@element'); eq([c.rows().length, noteOf(c), c.menu().props['data-studio-chat-commands-menu']], [0, null, 'mentions'], '"@element" with nothing selected: the menu says so')
    ok(c.markup().includes('Select an element on the slide first.'), '...in words')
    c.records.calls.length = 0; const ev = await c.key('Enter'); eq([ev.prevented, c.records.calls], [1, [['submit', '@element']]], '...and Enter sends as it always did (a menu with nothing to pick takes nothing)')
    c.state.element = elementRef; await c.set({}); await c.type('@element'); eq(c.labels(), ['Mention Selected element, Chart · slide 3'], 'with an element selected: the Element section')
    await c.key('Enter'); eq([c.text(), plain(w.referencesInText(c.text()))], ['@[Element: Chart · slide 3] ', [elementRef]], 'an element pick: token + the one element reference Studio already builds')
    ok(w.addChatCommandsFields({ references: [{ ...elementRef, element_id: 'other' }] }, c.text()).references.filter(r => r.kind === 'element').length === 1, 'and on send there is still only one element reference')
    // mouse
    await c.type('@file'); let prevented = 0; c.rows()[1].props.onMouseDown({ preventDefault: () => prevented++ }); await c.settle()
    eq([prevented, c.text()], [1, '@[File: notes.docx] '], 'pointer: a press picks; the composer keeps its focus')
    await tick(); eq(c.fakeTextarea.selection, [c.text().length, c.text().length], 'the cursor is at the end after a pick')
    c.unmount()
  }
  { // a file that is still uploading, or failed, cannot be mentioned
    const busy = await mountComposer({ overrides, props: { uploadedFiles: FILES_ALL } }); await busy.type('@file')
    eq(busy.rows().map(n => n.props['aria-label']), ['Mention q3 report.pdf, Uploaded', 'Mention notes.docx, Uploaded'], '"@file": not the file still uploading, not the one that failed'); busy.unmount()
  }
  { // sections follow the flags
    const noMentions = await mountComposer({ overrides, env: { NEXT_PUBLIC_CHAT_MENTIONS: undefined } }); await noMentions.type('@'); await tick(); await noMentions.settle()
    ok(!sections(noMentions).includes('slide'), 'without the K1 slide mentions flag there is no Slides section (nothing would turn its token into a reference)')
    await noMentions.type('@slide'); ok(noMentions.markup().includes('No slides in this deck yet.'), '...and "@slide" says so'); noMentions.unmount()
    const noTemplates = await mountComposer({ overrides, props: { templateBuilderEnabled: false, onSelectTemplate: undefined } }); await noTemplates.type('@'); await tick(); await noTemplates.settle()
    ok(!sections(noTemplates).includes('template') && !noTemplates.records.fetches.includes('/api/templates'), 'saved templates off: no Templates section, no list call'); noTemplates.unmount()
    const failing = await mountComposer({ overrides, routes: {} }); await failing.type('@template'); await tick(); await failing.settle()
    ok(failing.markup().includes("Couldn&#x27;t load this list."), 'a list that cannot be read says so'); failing.unmount()
  }
}


// ============================================================================================================================================
// E. The REAL socket hook, base and this tree
// ============================================================================================================================================
const SESSION = 'sess-hook-1'
function withFileText(rel, text, fn) {
  if (text === null) return fn()
  const target = path.join(root, rel), original = fs.readFileSync
  fs.readFileSync = function (file, ...rest) { return path.resolve(String(file)) === target ? text : original.call(this, file, ...rest) }
  try { return fn() } finally { fs.readFileSync = original }
}
async function mountHook({ env = {}, hookText = null, wireText = null } = {}) {
  const world = createEnvironment({ processEnv: { ...BASE_ENV, NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_CHAT_DIRECTIVES: 'true', ...env } })
  const user = { id: 'synthetic-user', email: 'synthetic-user@example.invalid' }
  const loader = createModuleLoader({ root, globals: world.globals, stubs: { react: React }, fileStubs: { 'hooks/use-auth': { useAuth: () => ({ user, isLoading: false }) } } })
  const hookModule = withFileText(WIRE, wireText, () => withFileText(HOOK, hookText, () => loader.load(HOOK)))
  const probe = { api: null, reference: null }
  function Probe() {
    probe.api = hookModule.useDecksterWebSocketV2({ autoConnect: false, existingSessionId: SESSION, onMessage() {}, getChatElementReference: () => probe.reference })
    return null
  }
  const rootNode = new Root()
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 80) throw new Error('hook did not settle'); await world.macrotask(); quiet = rootNode.flush() ? 0 : quiet + 1 } }
  rootNode.setElement(React.createElement(Probe))
  await settle()
  probe.api.ensureConnected()
  await world.clock.advance(0, settle)
  world.sockets[0].serverOpen()
  await world.clock.advance(0, settle)
  const sent = () => world.outbound.filter(item => item.data !== 'ping').map(item => item.data)
  return {
    probe, wire: loader.load(WIRE), sent,
    async send(...args) { const accepted = probe.api.sendMessage(...args); await world.clock.advance(0, settle); return accepted },
    frames: () => sent().map(raw => JSON.parse(raw)).filter(frame => frame.type === 'user_message'),
    unmount: () => rootNode.unmount(),
  }
}

async function hookSuite(over = {}) {
  const headHook = over[HOOK] ?? readOwn(HOOK), headWire = over[WIRE] ?? null
  const baseHook = hasBase ? git('show', `${strip.BASE_COMMIT}:${HOOK}`) : null
  const SENDS = [
    ['hello'], ['Add a slide after slide 3 about growth'], ['Use @[File: q3 report.pdf] and @[Theme: Midnight (saved)] on @[Template: Board update]', 'store-1', 2, { deepResearch: true }],
    ['@[Slide 2: Market size] shorter'], ['Make @[Element: Chart · slide 3] bigger', null, 0, { theme: { mode: 'preset', preset_id: 'corporate_light' } }],
  ]
  const picks = wire => {
    wire.registerMention(wire.fileToken('q3 report.pdf'), { kind: 'file', file_id: 'f1', name: 'q3 report.pdf', source: 'upload' })
    wire.registerMention(wire.themeToken('Midnight', 'saved'), { kind: 'theme', theme_id: 'u-77', name: 'Midnight', source: 'saved' })
    wire.registerMention(wire.templateToken('Board update'), { kind: 'template', template_id: 't1', name: 'Board update' })
    wire.registerMention(wire.elementToken('Chart · slide 3'), { kind: 'element', element_id: 'el_chart_7f3a', element_type: 'CHART', slide_index: 2, slide_id: 'L2', label: 'Chart · slide 3' })
  }
  const command = wire => wire.registerCommand('add_slide', /^\s*Add a slide after slide \d+/)
  // -- flag off (every way of being off): the same bytes as the base, with picks sitting in the registry ---------------------------------------------------------
  if (baseHook) {
    for (const [name, env] of [['unset', {}], ['commands only', { NEXT_PUBLIC_STUDIO_CHAT_COMMANDS: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }], ['everything but commands', { NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true', NEXT_PUBLIC_CHAT_MENTIONS: 'true', NEXT_PUBLIC_CHAT_ELEMENT_REFINE: 'true' }]]) {
      const offEnv = name === 'commands only' ? { ...env, NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'false' } : env
      const base = await mountHook({ env: offEnv, hookText: baseHook }), head = await mountHook({ env: offEnv, hookText: headHook, wireText: headWire })
      picks(head.wire)
      for (const [i, args] of SENDS.entries()) { if (i === 1) command(head.wire); await base.send(...args); await head.send(...args) }
      eq(head.sent(), base.sent(), `flag off (${name}): the head hook puts the same bytes on the socket as the base for ${SENDS.length} sends`)
      ok(head.frames().length === SENDS.length && head.frames().every(frame => !('command' in frame.data) && !(frame.data.client_caps ?? []).some(cap => cap === 'mentions2' || cap === 'commands1')), `flag off (${name}): no cap, no command`)
      eq(head.frames().map(frame => frame.data.references ?? null), base.frames().map(frame => frame.data.references ?? null), `flag off (${name}): the same references (K1 and the element refine, as before)`)
      base.unmount(); head.unmount()
    }
  }
  // -- flag on ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const ENV_ON = { ...ON }
  const off = await mountHook({ env: {}, hookText: headHook, wireText: headWire })
  const on = await mountHook({ env: ENV_ON, hookText: headHook, wireText: headWire })
  picks(on.wire)
  for (const [i, args] of SENDS.entries()) { if (i === 1) { command(on.wire); command(off.wire) } await off.send(...args); await on.send(...args) }
  const [f0, f1, f2, f3, f4] = on.frames().map(frame => frame.data)
  const [o0, o1, o2, o3, o4] = off.frames().map(frame => frame.data)
  eq(f0.client_caps, ['mdc1', 'mentions2', 'commands1'], 'flag on: the caps follow mdc1, on every message'); eq(o0.client_caps, ['mdc1'], 'flag off: mdc1 only')
  ok(!('command' in f0) && !('references' in f0), 'flag on: a plain message carries neither')
  eq([f1.command, f1.text], ['add_slide', 'Add a slide after slide 3 about growth'], 'flag on: the pre-filled request carries its command; the text is as typed')
  eq(f2.references, [{ kind: 'file', file_id: 'f1', name: 'q3 report.pdf', source: 'upload' }, { kind: 'theme', theme_id: 'u-77', name: 'Midnight', source: 'saved' }, { kind: 'template', template_id: 't1', name: 'Board update' }], 'flag on: the picked file, theme and template references, in text order, exactly the agreed shape')
  ok(!('command' in f2), 'flag on: the command was spent by the message before')
  ok(!('references' in f3), 'flag on: a slide token alone adds nothing here (K1 owns it; no slides in this hook state)')
  eq(f4.references, [{ kind: 'element', element_id: 'el_chart_7f3a', element_type: 'CHART', slide_index: 2, slide_id: 'L2', label: 'Chart · slide 3' }], 'flag on: a picked @Element is the one element reference (the refine flag is off here)')
  eq(f2.deep_research, true, 'flag on: the options still travel as they did')
  const strippedOf = data => { const copy = JSON.parse(JSON.stringify(data)); delete copy.references; delete copy.command; copy.client_caps = (copy.client_caps ?? []).filter(cap => cap !== 'mentions2' && cap !== 'commands1'); return copy }
  eq(on.frames().map(frame => strippedOf(frame.data)), off.frames().map(frame => strippedOf(frame.data)), 'flag on adds only client_caps entries, references and command: every other field is the base\'s')
  // the same picks are spent: a second send of the same text carries no references
  await on.send(SENDS[2][0]); eq(on.frames().at(-1).data.references ?? null, null, 'flag on: a send spends the picks it used')
  off.unmount(); on.unmount()
  // -- flag on with the K1 slide mentions and the element refine: one element reference, slide references first -------------------------------------------------
  const refined = await mountHook({ env: { ...ENV_ON, NEXT_PUBLIC_CHAT_MENTIONS: 'true', NEXT_PUBLIC_CHAT_ELEMENT_REFINE: 'true' }, hookText: headHook, wireText: headWire })
  picks(refined.wire)
  refined.probe.reference = { kind: 'element', element_id: 'el_live', element_type: 'IMAGE', slide_index: 4, slide_id: 'L4', label: 'Image · slide 5' }
  await refined.send('Make it bigger'); await refined.send('Make @[Element: Chart · slide 3] bigger with @[File: q3 report.pdf]')
  const [r0, r1] = refined.frames().map(frame => frame.data)
  eq([r0.client_caps, r0.references], [['mdc1', 'element_refine1', 'mentions2', 'commands1'], [refined.probe.reference]], 'with the element refine on: its cap, then ours; the live selection is the one element reference')
  eq(r1.references.filter(reference => reference.kind === 'element').map(reference => reference.element_id), ['el_chart_7f3a'], 'a picked @Element replaces the live selection: still exactly one')
  eq(r1.references.map(reference => reference.kind), ['element', 'file'], '...and the file after it')
  refined.unmount()
}


// ============================================================================================================================================
// F. The sources
// ============================================================================================================================================
function sourceSuite(over = {}) {
  const src = rel => rel in over ? over[rel] : readOwn(rel)
  const stripModule = over.strip ?? strip
  const marker = stripModule.CHAT_COMMANDS_MARKER_RE
  // -- the marked files: insertions only, every added line marked, stripping gives chat clean's files --------------------------------------------------------------
  for (const rel of stripModule.CHAT_COMMANDS_FILES) {
    const now = src(rel)
    ok(now.split('\n').filter(line => marker.test(line)).length > 0, `${rel}: carries marked lines`)
    ok(!/CHAT-COMMANDS-|-CHAT-COMMANDS/.test(now), `${rel}: the marker is never part of a longer token`)
    if (hasBase && OWN) {
      const base = git('show', `${stripModule.BASE_COMMIT}:${rel}`)
      eq(stripModule.stripChatCommands(rel, now) === base, true, `${rel}: without this change's lines it is chat clean's file (#530's head), byte for byte`)
      eq(registry.stripLaterChanges(rel, now) === registry.stripLaterChanges(rel, base), true, `${rel}: ...and through the registry (both sides)`)
      const diff = git('diff', '--unified=0', stripModule.BASE_COMMIT, OWN, '--', rel).split('\n').filter(line => /^[-+]/.test(line) && !/^(---|\+\+\+)/.test(line))
      eq(diff.filter(line => line.startsWith('-')), [], `${rel}: no existing line is rewritten`)
      ok(diff.length > 0 && diff.every(line => marker.test(line)), `${rel}: every added line carries the marker`)
    }
  }
  // -- the gates ----------------------------------------------------------------------------------------------------------------------------------------------
  const hook = src(HOOK), hookLines = hook.split('\n')
  ok(hookLines.filter(line => marker.test(line)).length === 3, 'hook: three marked lines (the import and the two calls)')
  ok(hook.includes("      if (STUDIO_CHAT_COMMANDS_ENABLED) addChatCommandsFields(message.data as unknown as Record<string, unknown>, text); // CHAT-COMMANDS"), 'hook: the fields are added only with the flag, to the built message, with the text')
  ok(hook.includes("      if (STUDIO_CHAT_COMMANDS_ENABLED) chatCommandsSent(text); // CHAT-COMMANDS") && hook.indexOf('chatCommandsSent(text)') > hook.indexOf('wsRef.current.send(JSON.stringify(message))'), 'hook: what a message used is spent only after it went out')
  ok(hook.indexOf('addChatCommandsFields(') > hook.indexOf('addBulkEditUndoCaps(message.data') && hook.indexOf('addChatCommandsFields(') > hook.indexOf('addChatElementRefineFields(message.data'), 'hook: after the K1 slide references, the element refine\'s reference and every other cap (ours come last)')
  ok(!/connect\(\);/.test(hookLines.filter(line => marker.test(line)).join('\n')), 'hook: no connect() added (the reconnect proof counts them)')
  const page = src(PAGE), pageLines = page.split('\n')
  const firstMarked = pageLines.findIndex(line => marker.test(line)), flowHook = pageLines.findIndex(line => line.includes('useStudioFlowControl({'))
  ok(flowHook >= 0 && firstMarked > flowHook, 'page: nothing of this change comes before the flow hook (after the Builder\'s runners)')
  ok(page.includes('const chatCommandsOn = STUDIO_CHAT_COMMANDS_ENABLED && chatCleanShell'), 'page: gated on the flag, chat clean and the Studio shell')
  { const at = pageLines.findIndex(line => line.includes('const chatCommandsOn')), after = pageLines.findIndex(line => line.includes('const chatCleanSendDirections')); ok(at > after && at - after <= 2, 'page: the block sits right after chat clean\'s') }
  ok(pageLines.filter(line => marker.test(line) && /^import /.test(line)).every(line => pageLines.indexOf(line) > pageLines.findIndex(line => line.includes("from '@/components/builder/chat/studio-chat-clean'"))), 'page: the imports sit at the end, after chat clean\'s')
  ok(page.includes("{...((chatCommandsOn ? { mentionSlides: undefined, studioChatCommands: chatCommandsPage } : {}) as { mentionSlides?: undefined; studioChatCommands?: ChatCommandsPageProps }) /* CHAT-COMMANDS") && page.indexOf('studioChatCommands: chatCommandsPage') > page.indexOf('mentionSlides={\n'), 'page: the "@" menu takes over the K1 picker through a spread that is empty with the flag off, after the prop it overrides')
  ok(/const chatCommandsPage: ChatCommandsPageProps \| undefined = chatCommandsOn \? \{/.test(page) && page.includes('getElement: () => (CHAT_ELEMENT_REFINE_ENABLED ? chatElementReferenceFor(chatElementSelectionRef.current) : null)'), 'page: the element is the refine flag\'s own reference, read when the menu draws')
  ok(page.includes('exportDeck: chatCommandsExport'), 'page: the export runner')
  const input = src(INPUT)
  ok(input.includes('const chatCommands = useStudioChatCommands({ page: chatClean ? studioChatCommands ?? null : null,'), 'chat-input: inert without chat clean\'s composer props and the page\'s')
  ok(input.indexOf('const chatCommands = useStudioChatCommands(') > input.indexOf('const refreshSavedThemes = useCallback') && input.indexOf('const chatCommands = useStudioChatCommands(') < input.indexOf('const handlePresetChange'), 'chat-input: the hook is called once the composer\'s own state and handlers exist')
  ok(/onKeyDown=\{\(e\) => \{\n\s+if \(chatCommands\.onKeyDown\(e\)\) return \/\/ CHAT-COMMANDS/.test(input), 'chat-input: the menu sees a key first')
  ok(input.includes('{chatCommands.menu}{/* CHAT-COMMANDS') && input.indexOf('{chatCommands.menu}') < input.indexOf('{/* Textarea */}'), 'chat-input: the menu sits where the K1 popover did, before the field')
  ok(input.includes('{...chatCommands.textareaProps /* CHAT-COMMANDS') && input.includes('{...chatCommands.templatePicker /* CHAT-COMMANDS'), 'chat-input: aria on the field, the open prop on the template popup, both through spreads that are empty with the flag off')
  ok(input.includes('openTheme: () => { setThemeOpen(true); void refreshSavedThemes() }') && /onOpenChange=\{\(open\) => \{ setThemeOpen\(open\); if \(open\) void refreshSavedThemes\(\) \}\}/.test(input), '/theme: the command does what the theme button does when it opens the popup')
  ok(input.includes("openTemplatePopup: () => popupSetter('template')(true)") && input.includes("onOpenChange: popupSetter('template')"), '/template: with the composer popups flag, the command uses the same setter as the picker')
  ok(input.includes("themeBlocked: !user ? 'Sign in to choose a build theme.' : isLoadingSession ? 'Loading your conversation…' : templateSelectionLocked ? 'Build theme selection is locked for this deck.' : null") && input.includes("lockReason={!user ? 'Sign in to choose a build theme.' : isLoadingSession ? 'Loading your conversation…' : templateSelectionLocked ? 'Build theme selection is locked for this deck.' : null}"), '/theme: blocked for exactly the popup\'s own reasons, in its words')
  ok(input.includes('disabled={disabled || (selectionLocked && !onOpenLibrary)}') === false && read('components/builder/template-picker.tsx').includes('disabled={disabled || (selectionLocked && !onOpenLibrary)}') && input.includes('templateSelectionLocked && !onOpenComposerLibrary ?'), '/template: blocked as the picker\'s button is (disabled, or locked with no library)')
  // -- the new files --------------------------------------------------------------------------------------------------------------------------------------------
  const wireText = src(WIRE)
  ok(!/^import |^export .* from |require\(/m.test(wireText), 'wire: import-free')
  ok(count(wireText, 'process.env.') === 3 && /NEXT_PUBLIC_STUDIO_CHAT_COMMANDS === 'true'/.test(wireText) && /NEXT_PUBLIC_STUDIO_CHAT_CLEAN === 'true'/.test(wireText) && /NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'/.test(wireText), 'wire: three literal flag reads, each the exact string')
  ok(!/fetch\(|WebSocket|localStorage|console\./.test(wireText), 'wire: no I/O')
  const lib = src(LIB)
  ok(!/process\.env|fetch\(|WebSocket|localStorage|console\./.test(lib) && !/from 'react'|from "react"/.test(lib), 'lib: pure (no env, I/O or React)')
  const component = src(COMPONENT)
  ok(component.startsWith('"use client"'), 'component: a client file')
  ok(!/WebSocket|localStorage|console\./.test(component) && count(component, 'fetch(') === 0 && count(component, 'listTemplates()') === 1, 'component: draws and presses controls; its one read is the template popup\'s own list call')
  ok(count(component, 'process.env.') === 1 && component.includes("process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE === 'true'"), 'component: one literal flag read of its own (the model gauge\'s), the same as components/model-choice/use-model-choice.ts')
  ok(read('components/model-choice/use-model-choice.ts').includes('process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE === "true"'), 'component: ...which is that file\'s literal')
  ok(component.includes("import '../studio-chat-commands.css'"), 'component: loads its stylesheet')
  ok(!/dangerouslySetInnerHTML|innerHTML/.test(component), 'component: nothing is injected as HTML')
  // -- the stylesheet --------------------------------------------------------------------------------------------------------------------------------------------
  const css = postcss.parse(src(CSS))
  let rules = 0
  css.walkRules(rule => { rules++; for (const selector of rule.selectors) ok(selector.startsWith('[data-studio-v4-shell="true"] [data-studio-chat-clean] [data-studio-chat-commands-'), `css: scoped to the flag's menus: ${selector.slice(0, 90)}`) })
  ok(rules >= 15, 'css: a stylesheet, not a stub')
  const text = src(CSS)
  ok(!/#[0-9a-fA-F]{3,8}\b/.test(text.replace(/\/\*[\s\S]*?\*\//g, '')), 'css: no colour of its own: every colour is a v3.1 token or the shell\'s')
  css.walkDecls('font-size', decl => ok(['9px', '10px', '11px', '11.5px'].includes(decl.value), `css: ${decl.parent.selector.slice(-70)}: font-size ${decl.value} is not larger than the composer\'s menus draw today (9 / 10 / 11 / 11.5)`))
  ok(/@media \(max-width: 767px\), \(pointer: coarse\) \{[\s\S]*button\[role="option"\] \{ min-height: 44px; \}/.test(text), 'css: 44 px rows on phones and touch')
  ok(/forced-colors: active/.test(text), 'css: forced colours keep the highlight')
  ok(!/phone-tab-bar|data-studio-phone|studio-workspace-switch/.test(text), 'css: nothing of the phone shell')
  // -- .env.example, the registry, the taught proofs, the scope ----------------------------------------------------------------------------------------------
  if (hasBase && OWN) {
    const envBase = git('show', `${stripModule.BASE_COMMIT}:.env.example`), envOwn = src('.env.example')
    eq(envOwn === `${envBase}\n${stripModule.CHAT_COMMANDS_ENV_BLOCK}`, true, '.env.example: chat clean\'s plus this block, after one blank line')
    ok(!stripModule.CHAT_COMMANDS_ENV_BLOCK.includes('exact "true" enables it') && /\nNEXT_PUBLIC_STUDIO_CHAT_COMMANDS="false"\n$/.test(stripModule.CHAT_COMMANDS_ENV_BLOCK), '.env.example: default "false"')
    eq(registry.stripLaterEnvBlocks('.env.example', envOwn).includes('NEXT_PUBLIC_STUDIO_CHAT_COMMANDS'), false, '.env.example: the registry takes the block out')
    const regDiff = git('diff', '-U0', stripModule.BASE_COMMIT, OWN, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(line => /^[-+]/.test(line) && !/^(---|\+\+\+)/.test(line))
    eq(regDiff.length, 3, 'registry: three lines'); ok(regDiff.every(line => line.startsWith('+') && line.includes('studio-chat-commands-strip.mjs') && line.includes('// LATER-CHANGE: ')), 'registry: ...all this change\'s')
    for (const rel of stripModule.CHAT_COMMANDS_SCOPE_FILES) ok(registry.LATER_CHANGE_FILES.has(rel), `registry: ${rel} is registered`)
    ok(registry.LATER_STRIPS.includes(strip.stripChatCommands) && registry.LATER_ENV_BLOCKS.includes(strip.CHAT_COMMANDS_ENV_BLOCK), 'registry: the strip and the block are registered, after chat clean\'s')
    ok(registry.LATER_STRIPS.indexOf(strip.stripChatCommands) > registry.LATER_STRIPS.indexOf(chatCleanStrip.stripChatClean), 'registry: ...in stacking order')
    eq(stripModule.CHAT_COMMANDS_PIN_FILES, ['scripts/test-studio-pass2b-chat.mjs', 'scripts/test-theme-font-selection.mjs', 'scripts/test-studio-chat-element-edit.mjs'], 'three older proofs are taught: pass2b-chat (it pinned the import lines of chat-input.tsx through chat clean\'s strip alone), theme-font-selection (it runs buildUserMessage in a sandbox that must name this change\'s flag) and #522\'s chat-element-edit (its pins count lines in theme-font-selection)')
    for (const rel of stripModule.CHAT_COMMANDS_PIN_FILES) {
      const now = src(rel), studioBase = git('show', `${stripModule.BASE_COMMIT}:${rel}`) // dev holds chat clean (#530) and #522 now
      eq(chatCleanStrip.stripChatClean(rel, stripModule.stripChatCommands(rel, now)) === chatCleanStrip.stripChatClean(rel, studioBase), true, `${rel}: through this change's put-back it is the studio base's file, byte for byte (both read past chat clean's put-back, which this one's is chained to)`)
      eq(registry.stripLaterChanges(rel, now) === registry.stripLaterChanges(rel, studioBase), true, `${rel}: ...and through the registry`)
      for (const [has] of stripModule.CHAT_COMMANDS_PIN_EDITS[rel]) { ok(now.includes(has), `${rel}: taught line present`); ok(has.includes('registry read (CHAT-COMMANDS)'), `${rel}: taught line marked`); ok(count(now, has) === 1, `${rel}: ...once`) }
    }
    const changed = git('diff', '--name-only', `${stripModule.BASE_COMMIT}..${OWN}`).split('\n').filter(Boolean).sort()
    eq(changed, [...stripModule.CHAT_COMMANDS_SCOPE_FILES].sort(), 'scope: the committed diff is exactly this change\'s files')
    const subjects = git('log', '--no-merges', '--format=%s', `${stripModule.BASE_COMMIT}..${OWN}`).split('\n').filter(Boolean) // a merge of dev is not this change's commit
    ok(subjects.length > 0 && subjects.every(subject => subject.startsWith(stripModule.CHAT_COMMANDS_SUBJECT)), 'scope: every commit of this change starts "Chat commands:"')
    ok(git('log', '--no-merges', '--format=%B', `${stripModule.BASE_COMMIT}..${OWN}`).split('\n').filter(line => /^Co-Authored-By:/.test(line)).length === subjects.length, 'scope: ...and ends with the Co-Authored-By line')
    for (const rel of stripModule.CHAT_COMMANDS_NEW_FILES) ok(fs.existsSync(path.join(root, rel)), `scope: ${rel} exists`)
  } else console.log(`NOTE F  git has no ${stripModule.BASE_COMMIT.slice(0, 8)} or no own commit yet: the base-identity, .env.example, registry and scope checks were skipped`)
  // -- no secrets ------------------------------------------------------------------------------------------------------------------------------------------------
  const CRED = /Bearer [A-Za-z0-9._-]{16,}|\bsk-[A-Za-z0-9]{16,}|\beyJ[A-Za-z0-9_-]{20,}|(?:api[_-]?key|secret|token|passw(?:or)?d|credential)[A-Za-z0-9_]*['"]?\s*[:=]\s*['"`][^'"`\s$]{8,}['"`]/i
  for (const rel of stripModule.CHAT_COMMANDS_NEW_FILES) ok(!CRED.test(src(rel)), `${rel}: no credential-shaped literal`)
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
wireSuite()
console.log(`PASS A  the wire: flag, caps, tokens, typed references, a deleted token drops its reference, one element reference, the command hint (${checks} checks)`)
libSuite()
console.log(`PASS B  the lib: the twelve commands, the triggers, run / prefill / decline in every state, the sections, pressing a real control (${checks} checks)`)
await handlerSuite()
console.log(`PASS C  the real handlers: stop, the research switches, the export directive's runner, the Undo chip, the model gauge, Publish (${checks} checks)`)
await composerSuite()
await commandSuite()
await mentionSuite()
console.log(`PASS D  the composer with real React: the menus, the keyboard, every command's effect, every mention kind (${checks} checks)`)
await hookSuite()
console.log(`PASS E  the real socket hook: flag off puts the base's bytes on the socket, flag on adds the caps, the references and the command (${checks} checks)`)
sourceSuite()
console.log(`PASS F  the sources: marked lines, gates, base identity, the registry, .env.example, the stylesheet, scope (${checks} checks)`)

// ---- G. mutants ------------------------------------------------------------------------------------------------------------------------------
const wireText = read(WIRE), libText = read(LIB), componentText = read(COMPONENT), cssText = read(CSS)
const mutate = (text, from, to) => { if (!text.includes(from)) throw new Error(`mutant target missing: ${from.slice(0, 70)}`); if (text.split(from).length !== 2) throw new Error(`mutant target not unique: ${from.slice(0, 70)}`); return text.replace(from, to) }
const expectFail = async (label, fn) => { let failed = false; try { await fn() } catch { failed = true } ok(failed, `mutant caught: ${label}`) }
const allComposer = async overrides => { await composerSuite(overrides); await commandSuite(overrides); await mentionSuite(overrides) }
const savedChecks = checks
// the wire
for (const [label, from, to] of [
  ['the flag does not need chat clean', "  process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN === 'true' &&\n", ''],
  ['the commands1 cap is not advertised', '[MENTIONS2_CLIENT_CAP, COMMANDS1_CLIENT_CAP].filter', '[MENTIONS2_CLIENT_CAP].filter'],
  ['our caps go before the others', 'data.client_caps = [...caps, ...[MENTIONS2_CLIENT_CAP, COMMANDS1_CLIENT_CAP].filter(cap => !caps.includes(cap))]', 'data.client_caps = [...[MENTIONS2_CLIENT_CAP, COMMANDS1_CLIENT_CAP], ...caps]'],
  ['a deleted token keeps its reference', '    if (at >= 0) found.push({ at, reference })', '    found.push({ at, reference })'],
  ['a picked element is added beside the live one (two element references)', "const kept = element ? existing.filter(reference => reference?.kind !== 'element') : existing", 'const kept = existing'],
  ['the command hint outlives the request', "return command && typeof text === 'string' && command.pattern.test(text) ? command.name : null", 'return command ? command.name : null'],
  ['the references are not capped', '.sort((a, b) => a.at - b.at).slice(0, CHAT_MENTIONS_MAX)', '.sort((a, b) => a.at - b.at)'],
  ['a send keeps the command', "  if (commandInText(text)) chatCommandsBus.command = null\n}", '}'],
  ['a send always spends the command', "  if (commandInText(text)) chatCommandsBus.command = null\n}", '  chatCommandsBus.command = null\n}'],
  ['a saved theme reads like the preset', "${source === 'saved' ? ' (saved)' : ''}", "${source === 'saved' ? '' : ''}"],
  ['brackets stay in a label', ".replace(/[\\[\\]\\r\\n]+/g, ' ')", ".replace(/[\\r\\n]+/g, ' ')"],
]) await expectFail(label, () => wireSuite(mutate(wireText, from, to)))
// the lib
for (const [label, from, to] of [
  ['"/" opens the menu inside a word', 'const COMMAND_RE = /(^|\\s)\\/', 'const COMMAND_RE = /()\\/'],
  ['/export runs from a half-typed name', 'fill: Boolean(command.args)', 'fill: false'],
  ['/stop with nothing building runs', 'if (!ctx.stop.visible) return decline(', 'if (false) return decline('],
  ['a locked research switch still flips', 'return ctx.research.locked', 'return false'],
  ['/undo with chat undo off runs', "return ctx.undoOn ? { kind: 'run', action: 'undo' } : cantYet(W.undoOffBody, 'undo')", "return { kind: 'run', action: 'undo' }"],
  ['/publish runs something', 'return cantYet(W.publishBody', "return { kind: 'run', action: 'theme' } || cantYet(W.publishBody"],
  ['/add-slide loses its trailing space', '`Add a slide after slide ${slide} about `', '`Add a slide after slide ${slide} about`'],
  ['the highlight does not wrap', 'return (index + direction + count) % count', 'return Math.max(0, Math.min(count - 1, index + direction))'],
  ['"@slide" is not a section word', "slide: 'slide', slides: 'slide', ", ''],
  ['/web turns deep research on with it', 'web: next ? true : web', 'web: web'],
  ['a disabled control is pressed', "el.disabled !== true && el.getAttribute?.('aria-disabled') !== 'true'", 'true'],
  ['/export pptx runs the pdf', "action: arg === 'pptx' ? 'export:pptx' : 'export:pdf'", "action: 'export:pdf'"],
  ['a narrowed section is capped at 3', "(narrowed === section ? 12 : section === 'slide' ? 5 : 3)", '3'],
]) await expectFail(label, () => libSuite(mutate(libText, from, to)))
// the menus and the commands
for (const [label, from, to] of [
  ['Esc does not close the menu', 'event.preventDefault(); setDismissed(key); return true', 'event.preventDefault(); return true'],
  ['Enter picks but lets the send through', 'count > 0) { event.preventDefault(); pickAt(active); return true }', 'count > 0) { pickAt(active); return true }'],
  ['Shift+Tab is taken', "(event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey && count > 0", "(event.key === 'Enter' || event.key === 'Tab') && count > 0"],
  ['an IME composition is taken', 'if (!enabled || event.nativeEvent?.isComposing) return false', 'if (!enabled) return false'],
  ['a pointer press moves the focus', 'onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); onPick(index) }', 'onMouseDown: (e: React.MouseEvent) => { onPick(index) }'],
  ['a click after the press picks twice', 'onClick: (e: React.MouseEvent) => { if (e.detail === 0) onPick(index) }', 'onClick: (e: React.MouseEvent) => { onPick(index) }'],
  ['the composer loses its focus after a pick', 'field.focus?.({ preventScroll: true })', ''],
  ['/research flips web search', "if (action === 'research') input.research.onDeep(next.deep)", "if (action === 'research') input.research.onWeb(next.deep)"],
  ['/export always exports a PDF', 'page?.exportDeck?.(format)', "page?.exportDeck?.('pdf')"],
  ['the template list is read at every opening', "input.template.saved && templates.status !== 'ready' && !templatesAsked.current", 'input.template.saved && !templatesAsked.current'],
  ['Slides appear without the K1 flag', 'slides: CHAT_MENTIONS ? page.slides : [],', 'slides: page.slides,'],
  ['Publish\'s button presses the wrong control', 'const result = pressControl(doc, CONTROL_SELECTORS.publish)', 'const result = pressControl(doc, CONTROL_SELECTORS.undo)'],
  ['the research button does nothing', "if (button === 'open-research-options')", "if (button !== 'open-research-options')"],
  ['/theme opens nothing', "case 'theme': input.openTheme(); return", "case 'theme': return"],
  ['/template ignores the composer popups flag', 'if (input.popupsV2) input.openTemplatePopup(); else setTemplateOpen(true)', 'setTemplateOpen(true)'],
  ['a file still uploading can be mentioned', "file.status !== 'uploading' && file.status !== 'error'", 'true'],
  ['a pre-filled request carries no command', 'registerCommand(resolution.command, resolution.pattern)', ''],
  ['a pick registers no reference', 'if (item.reference) registerMention(item.token, item.reference)', ''],
  ['the template popup is not controlled', 'templatePicker: input.popupsV2 ? {} : { open: templateOpen, onOpenChange: setTemplateOpen }', 'templatePicker: {}'],
]) await expectFail(label, () => allComposer({ [COMPONENT]: mutate(componentText, from, to) }))
await expectFail('the lib\'s prefill loses its command in the composer', () => allComposer({ [LIB]: mutate(libText, "command: 'add_slide', pattern", "command: 'duplicate_slide', pattern") }))
await expectFail('the wire drops a theme\'s source in the composer', () => allComposer({ [LIB]: mutate(libText, "reference: { kind: 'theme', theme_id: theme.id, name: mentionLabel(theme.name) || 'theme', source: theme.source } })", "reference: { kind: 'theme', theme_id: theme.id, name: mentionLabel(theme.name) || 'theme' } as never })") }))
// the real socket hook
await expectFail('the hook adds fields with the flag off', () => hookSuite({ [HOOK]: mutate(readOwn(HOOK), '      if (STUDIO_CHAT_COMMANDS_ENABLED) addChatCommandsFields(', '      if (true) addChatCommandsFields(') }))
await expectFail('the hook never spends a pick', () => hookSuite({ [HOOK]: mutate(readOwn(HOOK), '      if (STUDIO_CHAT_COMMANDS_ENABLED) chatCommandsSent(text); // CHAT-COMMANDS: the picks and the command this message used are spent. Off: nothing.\n', '') }))
await expectFail('the wire adds fields to every message', () => hookSuite({ [WIRE]: mutate(wireText, '  const picked = referencesInText(text)\n  if (picked.length) {', '  const picked = referencesInText(text)\n  data.references = data.references ?? []\n  if (picked.length) {') }))
// the sources
await expectFail('the strip leaves the marked lines in', () => sourceSuite({ strip: { ...strip, stripChatCommands: (rel, text) => text } }))
await expectFail('a marked line loses its marker', () => sourceSuite({ [HOOK]: mutate(readOwn(HOOK), 'chatCommandsSent(text); // CHAT-COMMANDS', 'chatCommandsSent(text); //') }))
await expectFail('the hook call is no longer behind the flag', () => sourceSuite({ [HOOK]: mutate(readOwn(HOOK), '      if (STUDIO_CHAT_COMMANDS_ENABLED) addChatCommandsFields(', '      addChatCommandsFields(') }))
await expectFail('the page forgets chat clean in the gate', () => sourceSuite({ [PAGE]: mutate(readOwn(PAGE), 'const chatCommandsOn = STUDIO_CHAT_COMMANDS_ENABLED && chatCleanShell', 'const chatCommandsOn = STUDIO_CHAT_COMMANDS_ENABLED') }))
await expectFail('the K1 popover is left on beside the new menu', () => sourceSuite({ [PAGE]: mutate(readOwn(PAGE), '{...((chatCommandsOn ? { mentionSlides: undefined, studioChatCommands: chatCommandsPage } : {})', '{...((chatCommandsOn ? { studioChatCommands: chatCommandsPage } : {})') }))
await expectFail('the composer takes the page props without chat clean', () => sourceSuite({ [INPUT]: mutate(readOwn(INPUT), 'page: chatClean ? studioChatCommands ?? null : null', 'page: studioChatCommands ?? null') }))
await expectFail('the key handler runs after the base\'s', () => sourceSuite({ [INPUT]: mutate(mutate(readOwn(INPUT), "              if (chatCommands.onKeyDown(e)) return // CHAT-COMMANDS", '              // CHAT-COMMANDS'), "              // MDC P6 (UAT 2026-08-30)", "              if (chatCommands.onKeyDown(e)) return // CHAT-COMMANDS\n              // MDC P6 (UAT 2026-08-30)") }))
await expectFail('the .env.example block is gone', () => sourceSuite({ '.env.example': mutate(readOwn('.env.example'), 'NEXT_PUBLIC_STUDIO_CHAT_COMMANDS="false"\n', '') }))
await expectFail('the flag defaults on', () => sourceSuite({ '.env.example': mutate(readOwn('.env.example'), 'NEXT_PUBLIC_STUDIO_CHAT_COMMANDS="false"', 'NEXT_PUBLIC_STUDIO_CHAT_COMMANDS="true"') }))
await expectFail('a rule escapes the flag in the stylesheet', () => sourceSuite({ [CSS]: `${cssText}\nbutton[role="option"] { min-height: 10px; }\n` }))
await expectFail('the stylesheet sets a larger type', () => sourceSuite({ [CSS]: mutate(cssText, 'padding: 8px 12px 4px; border-top: 1px solid var(--scc-line); color: var(--ss-muted); font-size: 9px;', 'padding: 8px 12px 4px; border-top: 1px solid var(--scc-line); color: var(--ss-muted); font-size: 13px;') }))
await expectFail('the stylesheet brings a colour of its own', () => sourceSuite({ [CSS]: mutate(cssText, 'background: var(--ss-active); }', 'background: #7c3aed; }') }))
await expectFail('the phone rule loses its 44 px', () => sourceSuite({ [CSS]: mutate(cssText, 'button[role="option"] { min-height: 44px; }', 'button[role="option"] { min-height: 32px; }') }))
await expectFail('the component talks to the network itself', () => sourceSuite({ [COMPONENT]: `${componentText}\nvoid fetch('/api/x')\n` }))
await expectFail('the wire gains an import', () => sourceSuite({ [WIRE]: `import { x } from '@/lib/x'\n${wireText}` }))
await expectFail('the wire reads a fourth variable', () => sourceSuite({ [WIRE]: `${wireText}\nexport const EXTRA = process.env.NEXT_PUBLIC_X === 'true'\n` }))
await expectFail('the lib reads the environment', () => sourceSuite({ [LIB]: `${libText}\nexport const X = process.env.NODE_ENV\n` }))
console.log(`PASS G  mutants: every one caught (${checks} checks)`)
release?.()
console.log(`ALL PASS test-studio-chat-commands: ${checks} checks`)
