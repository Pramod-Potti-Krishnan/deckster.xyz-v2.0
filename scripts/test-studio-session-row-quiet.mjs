// PASS2B G48 (FRONTEND-2): quiet Sessions rows. Flag NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET (exact "true", Studio shell only), default off.
// On, a Sessions row drops a message preview that is one of Director's canned lines (first line only; a real prompt or reply is kept) and a session
// without a stage reads "Draft" instead of "Unknown". Title, slide count, time, "Current" tag, delete control and every other stage word are untouched.
//
// Run: node scripts/test-studio-session-row-quiet.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   SESSION_ROW_QUIET_BASE=<commit> overrides the base commit the flag-off identity is checked against (default e9503ae).
//
// Proven on the REAL sources lib/studio-session-row.ts and components/session-list-item.tsx (stubbed leaves only):
//   1. the canned-line test on a table, and the lib is import-free;
//   2. the row is rendered (react-dom/server) for stages 0..6 and odd stages, with and without a canned or real last message: flag off (unset, "", "false",
//      near-misses, "true" without the shell) the markup is the base commit's file rendered the same way, byte for byte; shell + "true": a canned preview is
//      gone, a real one kept, a stage-less row reads "Draft", and nothing else differs; outside the Studio shell the flag is ignored;
//   3. source: reversing the four edits gives the base file; the flag is read once, inline, exact "true" AND the shell;
//   4. mutation check: every mutant of the two sources is killed by sections 1-3.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const BASE_COMMIT = process.env.SESSION_ROW_QUIET_BASE || 'e9503ae'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const baseSource = rel => execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const LIB = 'lib/studio-session-row.ts', ROW = 'components/session-list-item.tsx'
const SOURCES = { [LIB]: read(LIB), [ROW]: read(ROW) }
const BASE_ROW = baseSource(ROW)
const FLAG = 'NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
const loadLib = source => { const module = { exports: {} }; new Function('module', 'exports', compile(source, LIB))(module, module.exports); return module.exports }

// ---------------------------------------------------------------- 1. the canned-line test
const CANNED = [
  'Your presentation is ready.', 'Your presentation is ready!', 'Your presentation is ready', 'Your presentation is ready...', 'YOUR PRESENTATION IS READY.',
  'Your presentation is ready!\n\nView it at https://x', '\n\n  Your presentation is ready.  ', 'Your presentation is ready.\r\nSecond line',
  "Hello! I'm your presentation assistant. I can help you create professional presentations. What topic would you like to present on?",
  "Hello! I'm Deckster, your AI presentation assistant. I can help you build a deck. What would you like to present on?",
  "Hello! I’m Deckster, your AI presentation assistant.", 'Hello. Im your presentation assistant',
  'Here is the outline for your deck.', 'Here is the outline for your deck!', 'Content generation complete! Your presentation is ready.',
  '✅ Your presentation is ready.', "🎉 Hello! I'm Deckster, your AI presentation assistant. Ask me anything.", '- Here is the outline for your deck.',
]
const REAL = [
  'Build my presentation', 'Your presentation is ready to review, but slide 3 needs a source.', 'Here is the outline for your deck, with notes.', 'Make it shorter\nYour presentation is ready.',
  "Hello, I'm your presentation assistant", 'Hi! I\'m your presentation assistant.', 'Content generation complete! Your deck needs a theme.', 'Write a deck on Q3 sales. Your presentation is ready.',
  "Hello! I'm your presentation coach.", 'Your presentation', 'presentation is ready.', '', '   ', '\n\n', '!!!',
  null, undefined, 0, 1, true, {}, [], ['Your presentation is ready.'], () => 'Your presentation is ready.',
]
const verdict = (lib, text) => { try { return lib.isGenericSessionPreview(text) } catch { return 'throws' } }
function proveLib(source, label = 'lib') {
  nomatch(source.replace(/^\/\/.*$/gm, ''), /^import |require\(/m, `${label}: import-free`)
  const lib = loadLib(source)
  eq(lib.SESSION_ROW_NO_STAGE_LABEL, 'Draft', `${label}: the stage-less word`)
  for (const text of CANNED) eq(verdict(lib, text), true, `${label}: canned ${JSON.stringify(text)}`)
  for (const text of REAL) eq(verdict(lib, text), false, `${label}: real ${typeof text === 'function' ? 'fn' : JSON.stringify(text)}`)
  return lib
}
proveLib(SOURCES[LIB])

// ---------------------------------------------------------------- 2. the row, rendered
const env = {}
const lucide = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), className: props?.className })) })
const stubs = lib => ({
  react: React, 'react/jsx-runtime': jsxRuntime, 'lucide-react': lucide,
  'date-fns': { formatDistanceToNow: (date, opts) => `T:${new Date(date).toISOString()}${opts?.addSuffix ? ' ago' : ''}` },
  '@/components/ui/checkbox': { Checkbox: props => React.createElement('input', { type: 'checkbox', checked: Boolean(props.checked), readOnly: true, 'aria-label': props['aria-label'] }) },
  '@/components/delete-confirm-modal': { DeleteConfirmModal: props => React.createElement('i', { 'data-modal': String(props.open), 'data-surface': props.studioSurface }) },
  '@/lib/studio-session-row': lib,
})
function component(source, lib) {
  const module = { exports: {} }, table = stubs(lib)
  vm.runInNewContext(compile(source, ROW), { module, exports: module.exports, process: { env }, console, require: spec => { if (!(spec in table)) throw new Error(`unexpected import ${spec}`); return table[spec] } })
  return module.exports.SessionListItem
}
const chat = text => ({ messages: [{ userText: null, messageType: 'chat_message', payload: { text } }] })
const typed = userText => ({ messages: [{ userText, messageType: 'user_input', payload: {} }] })
// [name, session fields, preview: 'dropped' (canned, shown in the base) | 'kept' (real) | 'none' (no preview in the base either)]
const CASES = [
  ['stage 0, no messages', { currentStage: 0, messages: [] }, 'none'],
  ['stage 1 real prompt', { currentStage: 1, ...typed('Build my presentation about Q3 sales') }, 'kept'],
  ['stage 2 canned reply', { currentStage: 2, ...chat('Your presentation is ready.') }, 'dropped'],
  ['stage 3 canned greeting', { currentStage: 3, ...chat("Hello! I'm Deckster, your AI presentation assistant. What would you like to present on?") }, 'dropped'],
  ['stage 4 canned user text', { currentStage: 4, ...typed('Your presentation is ready!\n\nView it at https://x') }, 'dropped'],
  ['stage 5 real reply', { currentStage: 5, ...chat('Your presentation is ready to review, but slide 3 needs a source.') }, 'kept'],
  ['stage 6 canned outline line', { currentStage: 6, ...chat('Here is the outline for your deck.') }, 'dropped'],
  ['stage 6 real long reply', { currentStage: 6, ...chat('I rewrote the agenda and moved the pricing slide to the end, as you asked, then checked every figure against the source.') }, 'kept'],
  ['stage undefined, no messages', { currentStage: undefined, messages: undefined }, 'none'],
  ['stage null, canned', { currentStage: null, ...chat('Your presentation is ready.') }, 'dropped'],
  ['stage 7, real', { currentStage: 7, ...typed('Add a roadmap slide') }, 'kept'],
  ['stage -1, canned', { currentStage: -1, ...chat('Content generation complete! Your presentation is ready.') }, 'dropped'],
  ['stage 0, canned', { currentStage: 0, ...chat('Your presentation is ready.') }, 'dropped'],
  ['stage 0, real', { currentStage: 0, ...typed('Start a pitch deck') }, 'kept'],
  ['stage 1, emoji canned', { currentStage: 1, ...chat('✅ Your presentation is ready.') }, 'dropped'],
  ['stage 2, not a chat message', { currentStage: 2, messages: [{ userText: null, messageType: 'status', payload: { text: 'Your presentation is ready.' } }] }, 'none'],
  ['stage 3, no title, favourite, no slide count', { currentStage: 3, title: '', isFavorite: true, slideCount: null, lastMessageAt: null, ...chat('Your presentation is ready.') }, 'dropped'],
]
const VARIANTS = [{}, { isActive: true }, { isSelectionMode: true, isSelected: true }, { onDelete: () => {}, isActive: true }, { onDelete: () => {}, isSelectionMode: true }]
const sessionOf = (fields, index) => ({ id: `s${index}`, title: `Deck number ${index}`, slideCount: 12, isFavorite: false, createdAt: '2026-10-01T10:00:00.000Z', lastMessageAt: '2026-10-02T11:30:00.000Z', ...fields })
const render = (Row, session, variant, values) => {
  for (const key of Object.keys(env)) delete env[key]
  Object.assign(env, values)
  return renderToStaticMarkup(React.createElement(Row, { session, ...variant }))
}
const PREVIEW_SRC = '<p title="[^"]*" class="text-\\[10px\\] text-gray-500 dark:text-gray-400 line-clamp-2 mb-1">[^<]*</p>'
const PREVIEW_ALL = new RegExp(PREVIEW_SRC, 'g'), hasPreview = html => new RegExp(PREVIEW_SRC).test(html)
const OFF_VALUES = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on', 'enabled']
const envOf = (shell, value) => ({ ...(shell === undefined ? {} : { [SHELL]: shell }), ...(value === undefined ? {} : { [FLAG]: value }) })
function proveRow(rowSource, lib, label = 'row') {
  const Row = component(rowSource, lib), Base = component(BASE_ROW, null)
  CASES.forEach(([name, fields, preview], index) => {
    const session = sessionOf(fields, index)
    for (const variant of VARIANTS) {
      const tag = `${label}: ${name} ${Object.keys(variant).join('+') || 'plain'}`
      const baseStudio = render(Base, session, variant, envOf('true')), baseAccount = render(Base, session, variant, envOf(undefined))
      // flag off: the base's markup, in the Studio shell and out of it, for every non-"true" value; "true" out of the shell (or a shell that is not "true") is off too
      for (const value of OFF_VALUES) {
        eq(render(Row, session, variant, envOf('true', value)), baseStudio, `${tag}: flag ${JSON.stringify(value)} (shell) is the base`)
        eq(render(Row, session, variant, envOf(undefined, value)), baseAccount, `${tag}: flag ${JSON.stringify(value)} (account) is the base`)
      }
      for (const shell of [undefined, '', 'false', 'TRUE', '1']) eq(render(Row, session, variant, envOf(shell, 'true')), render(Base, session, variant, envOf(shell)), `${tag}: "true" without the shell (${JSON.stringify(shell)}) is the base`)
      // flag on, in the shell: the preview and the stage word, nothing else
      const stageless = ![1, 2, 3, 4, 5, 6].includes(fields.currentStage)
      let want = baseStudio
      eq(hasPreview(baseStudio), preview !== 'none', `${tag}: the base draws a preview paragraph only when it has text`)
      if (preview === 'dropped') want = want.replace(PREVIEW_ALL, '')
      if (stageless) { eq(want.split('Unknown').length - 1, 2, `${tag}: the base says Unknown twice`); want = want.replaceAll('Unknown', 'Draft') }
      const on = render(Row, session, variant, envOf('true', 'true'))
      eq(on, want, `${tag}: shell + "true" is the base minus the canned preview, with Draft for a stage-less row`)
      eq(hasPreview(on), preview === 'kept', `${tag}: a canned preview is gone, a real one kept`)
      if (stageless) { nomatch(on, /Unknown/, `${tag}: no Unknown`); match(on, /— Draft, T:/, `${tag}: aria-label reads Draft`); match(on, /<\/span>Draft<\/span>/, `${tag}: stage text reads Draft`) }
      else { nomatch(on, /Draft/, `${tag}: a known stage keeps its word`); eq(on.includes(`${['', 'Starting', 'Planning', 'Outlining', 'Preview Ready', 'Refining', 'Complete'][fields.currentStage]}`), true, `${tag}: the stage word is kept`) }
      eq(on.includes('12 slides'), fields.slideCount !== null, `${tag}: slide count kept`); eq(on.includes('T:2026-10-0'), true, `${tag}: time kept`)
      if (variant.isActive) eq(on.includes('>Current</span>'), true, `${tag}: Current tag kept`)
      if (variant.onDelete && !variant.isSelectionMode) eq(on.includes('data-studio-session-part="row-delete"'), true, `${tag}: delete control kept`)
      // outside the Studio shell the row is the account row: the flag changes nothing, "…" preview and "Unknown" included
      eq(render(Row, session, variant, envOf(undefined, 'true')), baseAccount, `${tag}: account row ignores the flag`)
    }
  })
}
proveRow(SOURCES[ROW], loadLib(SOURCES[LIB]))

// ---------------------------------------------------------------- 3. source
const IMPORT = "import { isGenericSessionPreview, SESSION_ROW_NO_STAGE_LABEL } from '@/lib/studio-session-row';\n"
const QUIET = `  // PASS2B G48 (NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET, default off, Studio shell only): no canned-line preview, "Draft" for a session without a stage.
  const quietRow = studio && process.env.NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET === 'true';\n`
const PREVIEW = '  const studioMessagePreview = quietRow && isGenericSessionPreview(studioMessagePreviewFull) ? null : studioMessagePreviewFull;\n'
function proveSource(source, label = 'source') {
  eq(source.split(IMPORT).length - 1, 1, `${label}: the import, once`)
  eq(source.split(QUIET).length - 1, 1, `${label}: the exact-flag, Studio-shell decision, once`)
  eq(source.split(PREVIEW).length - 1, 1, `${label}: the preview line, once`)
  eq((source.match(/NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET/g) ?? []).length, 2, `${label}: the flag is named in the comment and read once`)
  eq((source.match(/process\.env\.NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET/g) ?? []).length, 1, `${label}: read inline, once`)
  const reversed = source.replace(IMPORT, '').replace(QUIET, '').replace(PREVIEW, '').replace('studioMessagePreviewFull = ', 'studioMessagePreview = ')
    .replace('getStageLabel(session.currentStage, quietRow)', 'getStageLabel(session.currentStage)').replace('stage: number, quietRow = false)', 'stage: number)')
    .replace("default: return quietRow ? SESSION_ROW_NO_STAGE_LABEL : 'Unknown';", "default: return 'Unknown';")
  eq(reversed, BASE_ROW, `${label}: without the five G48 edits the file is ${BASE_COMMIT}'s`)
}
proveSource(SOURCES[ROW])
match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET="false"$/m, 'documented in .env.example, default off')

// ---------------------------------------------------------------- 4. mutation check
const MUTANTS = [
  [LIB, 'stage-less word', "SESSION_ROW_NO_STAGE_LABEL = 'Draft'", "SESSION_ROW_NO_STAGE_LABEL = 'Unknown'"],
  [LIB, 'stage-less word spelt', "SESSION_ROW_NO_STAGE_LABEL = 'Draft'", "SESSION_ROW_NO_STAGE_LABEL = 'draft'"],
  [LIB, 'case-sensitive', '/^hello[!.]?\\s+i[\'’]?m\\s+(?:deckster,\\s+)?your\\s+(?:ai\\s+)?presentation\\s+assistant\\b/i', '/^hello[!.]?\\s+i[\'’]?m\\s+(?:deckster,\\s+)?your\\s+(?:ai\\s+)?presentation\\s+assistant\\b/'],
  [LIB, 'greeting without Deckster', '(?:deckster,\\s+)?', ''],
  [LIB, 'greeting without AI', '(?:ai\\s+)?', ''],
  [LIB, 'greeting prefix only', 'presentation\\s+assistant\\b/i', 'presentation/i'],
  [LIB, 'curly apostrophe', "i['’]?m", "i[']?m"],
  [LIB, 'ready line unanchored at the end', 'your\\s+presentation\\s+is\\s+ready[.!]*$/i', 'your\\s+presentation\\s+is\\s+ready/i'],
  [LIB, 'ready line without the complete prefix', '(?:content generation complete[!.]?\\s+)?', ''],
  [LIB, 'ready line without punctuation', 'ready[.!]*$/i', 'ready$/i'],
  [LIB, 'outline line dropped', '  /^here\\s+is\\s+the\\s+outline\\s+for\\s+your\\s+deck[.!]*$/i,\n', ''],
  [LIB, 'outline line unanchored', 'for\\s+your\\s+deck[.!]*$/i', 'for\\s+your\\s+deck/i'],
  [LIB, 'ready line unanchored at the start', '/^(?:content generation complete[!.]?\\s+)?your', '/(?:content generation complete[!.]?\\s+)?your'],
  [LIB, 'non-string accepted', "if (typeof text !== 'string') return false", "if (text == null) return false"],
  [LIB, 'emoji not skipped', '.replace(/^[^\\p{L}\\p{N}]+/u, \'\')', ''],
  [LIB, 'first line only dropped', '.find(line => line !== \'\')', '.reverse().find(line => line !== \'\')'],
  [LIB, 'blank lines not skipped', '.find(line => line !== \'\')', '[0]'],
  [LIB, 'every first line canned', 'GENERIC_FIRST_LINES.some(pattern => pattern.test(firstLine))', 'true'],
  [LIB, 'lib gains an import', "export const SESSION_ROW_NO_STAGE_LABEL", "import x from 'x'\nexport const SESSION_ROW_NO_STAGE_LABEL"],
  [ROW, 'flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET === 'true'", "process.env.NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET !== 'false'"],
  [ROW, 'flag read as truthy', "process.env.NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET === 'true'", 'process.env.NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET'],
  [ROW, 'shell dropped', 'const quietRow = studio && process', 'const quietRow = process'],
  [ROW, 'flag ignored', "const quietRow = studio && process.env.NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET === 'true';", 'const quietRow = studio;'],
  [ROW, 'always quiet', "const quietRow = studio && process.env.NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET === 'true';", 'const quietRow = true;'],
  [ROW, 'canned preview kept', 'quietRow && isGenericSessionPreview(studioMessagePreviewFull) ? null', 'false && isGenericSessionPreview(studioMessagePreviewFull) ? null'],
  [ROW, 'every preview dropped', 'quietRow && isGenericSessionPreview(studioMessagePreviewFull) ? null', 'quietRow ? null'],
  [ROW, 'preview dropped without the flag', 'quietRow && isGenericSessionPreview(studioMessagePreviewFull) ? null', 'isGenericSessionPreview(studioMessagePreviewFull) ? null'],
  [ROW, 'preview text cut', ': studioMessagePreviewFull;\n', ': String(studioMessagePreviewFull ?? \'\').slice(0, 30) || null;\n'],
  [ROW, 'stage word unchanged', 'getStageLabel(session.currentStage, quietRow)', 'getStageLabel(session.currentStage)'],
  [ROW, 'stage word from the flag only', 'default: return quietRow ? SESSION_ROW_NO_STAGE_LABEL : \'Unknown\';', 'default: return SESSION_ROW_NO_STAGE_LABEL;'],
  [ROW, 'stage word inverted', 'default: return quietRow ? SESSION_ROW_NO_STAGE_LABEL : \'Unknown\';', 'default: return quietRow ? \'Unknown\' : SESSION_ROW_NO_STAGE_LABEL;'],
  [ROW, 'stage word hard-coded', 'quietRow ? SESSION_ROW_NO_STAGE_LABEL :', "quietRow ? 'Unset' :"],
  [ROW, 'a known stage word changed', "case 1: return 'Starting';", "case 1: return quietRow ? 'Draft' : 'Starting';"],
  [ROW, 'stage 0 split off', "case 1: return 'Starting';", "case 0: return quietRow ? 'Draft' : 'Unknown';\n    case 1: return 'Starting';"],
  [ROW, 'slide count dropped', '{studio && session.slideCount != null && <span>{session.slideCount} slides</span>}', ''],
  [ROW, 'time dropped under the flag', '<span>{timeAgo}</span>', '<span>{quietRow ? null : timeAgo}</span>'],
  [ROW, 'Current tag dropped under the flag', "{studio && isActive && <span", "{studio && isActive && !quietRow && <span"],
  [ROW, 'delete dropped under the flag', '{onDelete && !isSelectionMode && (', '{onDelete && !isSelectionMode && !quietRow && ('],
  [ROW, 'title changed under the flag', "{session.title || 'Untitled Session'}\n          </h3>", "{quietRow ? 'Session' : session.title || 'Untitled Session'}\n          </h3>"],
  [ROW, 'account preview changed', '`${lastMessagePreview}...`', "`${lastMessagePreview}…`"],
]
let killed = 0
counting = false
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    if (file === LIB) proveRow(SOURCES[ROW], proveLib(mutated, name), name)
    else { proveRow(mutated, loadLib(SOURCES[LIB]), name); proveSource(mutated, name) }
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
counting = true
eq(killed, MUTANTS.length)

console.log(`Studio quiet Sessions rows (G48): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
