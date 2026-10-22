// PASS2B G42 (FRONTEND-2): plain words for the Templates page's "not enabled" notice. Flag NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN (exact "true", Studio
// shell only), default off. While saved templates are off (NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED unset) the page shows a notice; on, it says the same thing
// without "environment" or "enabled". The notice still shows under exactly the same condition; nothing is hidden. PK may reword it: only its properties are
// pinned here (no developer words, a different sentence from the original), not its exact text.
//
// Run: node scripts/test-studio-templates-notice-plain.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   TEMPLATES_NOTICE_PLAIN_BASE=<commit> overrides the base commit the flag-off identity is checked against (default e9503ae).
//
// Proven on the REAL lib/studio-templates-notice.ts and components/studio-libraries/templates-workspace.tsx (the whole workspace needs a dozen hooks and a
// layout engine, so the one JSX line is proven as source and then evaluated, exactly as written, in a vm):
//   1. the lib: the original sentence is the literal the base commit's file holds; a strict-true table; import-free; the plain words have no developer words;
//   2. the component source: with its import and that one line turned back into the base's, the file is the base commit's; the line reads the flag inline,
//      exact "true", AND the Studio shell; the original literal is gone from the component;
//   3. the line evaluated: the notice renders (react-dom/server) as the base line's markup unless shell AND flag are exactly "true", then as the plain words;
//      with saved templates on there is no notice at all, flag on or off;
//   4. mutation check: every mutant of the two sources is killed by sections 1-3.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { stripLibraryManage } from './studio-library-manage-strip.mjs'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const BASE_COMMIT = process.env.TEMPLATES_NOTICE_PLAIN_BASE || 'e9503ae'
const read = rel => stripLibraryManage(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')) // FRONTEND-2 Pass 3 track 4 (NEXT_PUBLIC_STUDIO_THEME_LIBRARY_MANAGE / NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE): that change's lines are not part of what this pin holds (scripts/studio-library-manage-strip.mjs)
const baseSource = rel => execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const LIB = 'lib/studio-templates-notice.ts', PAGE = 'components/studio-libraries/templates-workspace.tsx'
const SOURCES = { [LIB]: read(LIB), [PAGE]: read(PAGE) }
const BASE_PAGE = baseSource(PAGE)
const FLAG = 'NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
const loadLib = source => { const module = { exports: {} }; new Function('module', 'exports', compile(source, LIB))(module, module.exports); return module.exports }

// ---------------------------------------------------------------- 1. the words
const BASE_LINE = BASE_PAGE.split('\n').find(line => line.includes('Saved templates are not enabled in this environment'))
const BASE_NOTICE = /<LibraryNotice>(Saved templates are not enabled[^<]*)<\/LibraryNotice>/.exec(BASE_LINE)[1]
const NOT_TRUE = [undefined, null, 0, 1, '', 'true', 'false', 'TRUE', 'yes', {}, [], NaN, Symbol.for('x')]
function proveLib(source, label = 'lib') {
  nomatch(source.replace(/^\/\/.*$/gm, ''), /^import |require\(/m, `${label}: import-free`)
  const lib = loadLib(source)
  eq(BASE_NOTICE.startsWith('Saved templates are not enabled in this environment. You can sketch a local draft;'), true, `${label}: the base notice is the one described`)
  eq(lib.TEMPLATES_NOTICE_ORIGINAL, BASE_NOTICE, `${label}: the original sentence is the base commit's literal`)
  ok(lib.TEMPLATES_NOTICE_PLAIN !== lib.TEMPLATES_NOTICE_ORIGINAL, `${label}: the plain sentence is another sentence`)
  eq(lib.templatesNoticeText(false), lib.TEMPLATES_NOTICE_ORIGINAL, `${label}: false is the original`)
  eq(lib.templatesNoticeText(true), lib.TEMPLATES_NOTICE_PLAIN, `${label}: true is the plain words`)
  for (const value of NOT_TRUE) eq(lib.templatesNoticeText(value), lib.TEMPLATES_NOTICE_ORIGINAL, `${label}: ${typeof value === 'symbol' ? 'a symbol' : JSON.stringify(value) ?? String(value)} is not a real true`)
  const plain = lib.TEMPLATES_NOTICE_PLAIN
  nomatch(plain, /environment/i, `${label}: no "environment"`); nomatch(plain, /enabled/i, `${label}: no "enabled"`)
  nomatch(plain, /\benv\b|NEXT_PUBLIC|flag|deploy|config/i, `${label}: no other developer words`)
  match(plain, /^Saved templates /, `${label}: still about saved templates`); match(plain, /\.$/, `${label}: a finished sentence`)
  ok(plain.trim() === plain && plain.length > 20, `${label}: tidy`)
  eq(Object.keys(lib).sort().join(), 'TEMPLATES_NOTICE_ORIGINAL,TEMPLATES_NOTICE_PLAIN,templatesNoticeText', `${label}: the exports`)
  return lib
}
const realLib = proveLib(SOURCES[LIB])

// ---------------------------------------------------------------- 2. the component source
const IMPORT = "import { templatesNoticeText } from '@/lib/studio-templates-notice'\n"
const LINE = "    {!TEMPLATES_ENABLED && <LibraryNotice>{templatesNoticeText(process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN === 'true')}</LibraryNotice>}"
function proveSource(source, label = 'page') {
  eq(source.split(IMPORT).length - 1, 1, `${label}: the import, once`)
  eq(source.split(LINE).length - 1, 1, `${label}: the notice line, once`)
  eq((source.match(/NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN/g) ?? []).length, 1, `${label}: the flag is read once, inline`)
  eq((source.match(/templatesNoticeText\(/g) ?? []).length, 1, `${label}: the words come from the lib, once`)
  nomatch(source, /Saved templates are not enabled in this environment/, `${label}: the original literal now lives in the lib only`)
  eq(source.replace(IMPORT, '').replace(LINE, BASE_LINE), BASE_PAGE, `${label}: without the import and that line the file is ${BASE_COMMIT}'s`)
}
proveSource(SOURCES[PAGE])
match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN="false"$/m, 'documented in .env.example, default off')

// ---------------------------------------------------------------- 3. the line, evaluated
const env = {}
const Notice = ({ children, error }) => React.createElement('div', { className: error ? 'sl-notice sl-error' : 'sl-notice' }, children)
function lineComponent(line, lib) {
  const module = { exports: {} }
  const source = `${IMPORT}module.exports = ({ TEMPLATES_ENABLED, LibraryNotice }) => <>\n${line}\n</>\n`
  const table = { 'react/jsx-runtime': jsxRuntime, '@/lib/studio-templates-notice': lib }
  vm.runInNewContext(compile(source, 'line.tsx'), { module, exports: module.exports, process: { env }, require: spec => table[spec] })
  return module.exports
}
const markup = (Component, enabled, values) => {
  for (const key of Object.keys(env)) delete env[key]
  Object.assign(env, values)
  return renderToStaticMarkup(React.createElement(Component, { TEMPLATES_ENABLED: enabled, LibraryNotice: Notice }))
}
const SHELLS = [undefined, '', 'false', 'FALSE', 'TRUE', '1', 'true'], FLAGS = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on', 'true']
const envOf = (shell, flag) => ({ ...(shell === undefined ? {} : { [SHELL]: shell }), ...(flag === undefined ? {} : { [FLAG]: flag }) })
function proveLine(line, lib, label = 'line') {
  const Work = lineComponent(line, lib), Base = lineComponent(BASE_LINE, lib)
  const original = `<div class="sl-notice">${BASE_NOTICE}</div>`, plain = `<div class="sl-notice">${lib.TEMPLATES_NOTICE_PLAIN}</div>`
  eq(markup(Base, false, {}), original, `${label}: the base line draws the original sentence`)
  for (const shell of SHELLS) {
    for (const flag of FLAGS) {
      const on = shell === 'true' && flag === 'true', tag = `${label}: shell ${JSON.stringify(shell)}, flag ${JSON.stringify(flag)}`
      eq(markup(Work, false, envOf(shell, flag)), on ? plain : markup(Base, false, envOf(shell, flag)), `${tag}: the notice's words`)
      if (!on) eq(markup(Work, false, envOf(shell, flag)), original, `${tag}: off is the base's markup, byte for byte`)
      eq(markup(Work, true, envOf(shell, flag)), '', `${tag}: with saved templates on there is no notice`)
      eq(markup(Base, true, envOf(shell, flag)), '', `${tag}: (as in the base)`)
    }
  }
  nomatch(markup(Work, false, envOf('true', 'true')), /environment|enabled/i, `${label}: the drawn plain notice has no developer words`)
}
proveLine(LINE, realLib)

// ---------------------------------------------------------------- 4. mutation check
const MUTANTS = [
  [LIB, 'original reworded', 'Saved templates are not enabled in this environment.', 'Saved templates are not enabled in this setup.'],
  [LIB, 'original truncated', ' connected creation and reuse remain in Studio when enabled.', ''],
  [LIB, 'plain says environment', 'Saved templates are not available yet.', 'Saved templates are not available in this environment.'],
  [LIB, 'plain says enabled', 'Saved templates are not available yet.', 'Saved templates are not enabled yet.'],
  [LIB, 'plain says env', 'You can still sketch a draft here', 'You can still sketch a draft here (env)'],
  [LIB, 'plain is the original', "PLAIN = 'Saved templates are not available yet. You can still sketch a draft here and continue planning it in Studio.'", 'PLAIN = TEMPLATES_NOTICE_ORIGINAL'],
  [LIB, 'plain about something else', "PLAIN = 'Saved templates are not available yet.", "PLAIN = 'Templates are not available yet."],
  [LIB, 'plain unfinished', 'continue planning it in Studio.\'', "continue planning it in Studio'"],
  [LIB, 'read loosely', 'return plain === true ? TEMPLATES_NOTICE_PLAIN : TEMPLATES_NOTICE_ORIGINAL', 'return plain ? TEMPLATES_NOTICE_PLAIN : TEMPLATES_NOTICE_ORIGINAL'],
  [LIB, 'always plain', 'return plain === true ? TEMPLATES_NOTICE_PLAIN : TEMPLATES_NOTICE_ORIGINAL', 'return TEMPLATES_NOTICE_PLAIN'],
  [LIB, 'never plain', 'return plain === true ? TEMPLATES_NOTICE_PLAIN : TEMPLATES_NOTICE_ORIGINAL', 'return TEMPLATES_NOTICE_ORIGINAL'],
  [LIB, 'inverted', 'return plain === true ? TEMPLATES_NOTICE_PLAIN : TEMPLATES_NOTICE_ORIGINAL', 'return plain === true ? TEMPLATES_NOTICE_ORIGINAL : TEMPLATES_NOTICE_PLAIN'],
  [LIB, 'lib gains an import', 'export const TEMPLATES_NOTICE_ORIGINAL', "import x from 'x'\nexport const TEMPLATES_NOTICE_ORIGINAL"],
  [PAGE, 'flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN === 'true'", "process.env.NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN !== 'false'"],
  [PAGE, 'flag read as truthy', "process.env.NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN === 'true'", 'process.env.NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN'],
  [PAGE, 'flag ignored', "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN === 'true'", "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'"],
  [PAGE, 'shell dropped', "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN", 'process.env.NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN'],
  [PAGE, 'shell read loosely', "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATES", "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== 'false' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATES"],
  [PAGE, 'shell or flag', "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATES", "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' || process.env.NEXT_PUBLIC_STUDIO_TEMPLATES"],
  [PAGE, 'always plain', "templatesNoticeText(process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN === 'true')", 'templatesNoticeText(true)'],
  [PAGE, 'never plain', "templatesNoticeText(process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN === 'true')", 'templatesNoticeText(false)'],
  [PAGE, 'condition inverted', '{!TEMPLATES_ENABLED && <LibraryNotice>{templatesNoticeText', '{TEMPLATES_ENABLED && <LibraryNotice>{templatesNoticeText'],
  [PAGE, 'notice hidden under the flag', '{!TEMPLATES_ENABLED && <LibraryNotice>{templatesNoticeText', '{!TEMPLATES_ENABLED && !(process.env.NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN === \'true\') && <LibraryNotice>{templatesNoticeText'],
  [PAGE, 'notice shown with saved templates on', '{!TEMPLATES_ENABLED && <LibraryNotice>{templatesNoticeText', '{(!TEMPLATES_ENABLED || process.env.NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN === \'true\') && <LibraryNotice>{templatesNoticeText'],
  [PAGE, 'notice made an error', '<LibraryNotice>{templatesNoticeText', '<LibraryNotice error>{templatesNoticeText'],
  [PAGE, 'literal back in the component', '</LibraryNotice>}\n    {actionError', '</LibraryNotice>}\n    {/* Saved templates are not enabled in this environment. */}{actionError', true],
  [PAGE, 'import dropped', IMPORT, '', true],
  [PAGE, 'import from another module', "'@/lib/studio-templates-notice'", "'@/lib/studio-templates-notices'", true],
]
let killed = 0
counting = false
for (const [file, name, from, to, sourceOnly] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    if (file === LIB) { const lib = proveLib(mutated, name); proveLine(LINE, lib, name) }
    else if (sourceOnly) proveSource(mutated, name) // a change the evaluated line cannot show: the source pin kills it
    else proveLine(mutated.split('\n').find(row => row.includes('LibraryNotice>{templatesNoticeText')), realLib, name) // a behaviour change: the evaluated line alone must kill it
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
counting = true
eq(killed, MUTANTS.length)

console.log(`Studio templates notice in plain words (G42): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
