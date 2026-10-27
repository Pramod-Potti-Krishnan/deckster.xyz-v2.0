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
const { Root, hostNodes } = await import('./studio-chat-harness/mini-react.mjs')
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
    stubs: extra.stubs ?? {},
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
      [[{ deep: true, web: true }, { deep: false, web: true }], [{ deep: false, web: false }, { deep: false, web: true }], [{ deep: true, web: true }, { deep: false, web: false }], [{ deep: false, web: true }, { deep: false, web: false }]], 'the switches\' own rules, all four states')
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
// run
// ============================================================================================================================================
wireSuite()
console.log(`PASS A  the wire: flag, caps, tokens, typed references, a deleted token drops its reference, one element reference, the command hint (${checks} checks)`)
libSuite()
console.log(`PASS B  the lib: the twelve commands, the triggers, run / prefill / decline in every state, the sections, pressing a real control (${checks} checks)`)
release?.()
console.log(`ALL PASS test-studio-chat-commands (partial): ${checks} checks`)
