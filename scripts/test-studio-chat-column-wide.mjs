// FRONTEND-2 (B51, 31 Oct): proof of PK's UAT feedback F-10 (confirmed 31 Oct 04:11Z): flag NEXT_PUBLIC_STUDIO_CHAT_COLUMN_WIDE (exact "true", build-time, default off). With it on, the full-width first-run welcome (head, starters, the Replay intro / Explore
// templates / Blank canvas row and the composer's visible box) is one centred column of about 44% of the window (clamp 640 to 880 px), superseding PK decision #6's 560 px column; and two shared CSS custom properties are defined, with exactly these names and only with the flag
// on: --studio-chat-welcome-column and --studio-chat-conversation-column (about 50%, clamp 640 to 1000 px, which PR #554 reads). The docked chat panel keeps its width. Page.tsx is untouched: the tokens and rules hang on a marker attribute the Director header carries only with the flag on.
//
//   node scripts/test-studio-chat-column-wide.mjs        (plain node: transpile + vm of the REAL header, postcss over the REAL stylesheets, no network, no browser; the measured widths of the real page are in the PNG job's facts)
//
// What it proves:
//  1. the flag is the exact string "true" and the marker attribute exists only with it (the header's markup is the BASE's, byte for byte, for every other spelling and in every header state; with the flag on it differs by the one attribute);
//  2. the tokens: exact names, the exact strings of lib/studio-chat-column-wide.ts, defined once, only in a rule keyed to the marker, and what they evaluate to (640 px at 1440, 704 at 1600, 880 from 2000, never over the cap, the 16 px gutter on a narrow window);
//  3. every rule is keyed to the marker, and every rule but the token rule to the first-run stage, so the docked panel and every flag-off page match nothing;
//  4. the cascade, on the REAL stylesheets: each rule of this change is more specific than every rule of studio-first-run.css that sets the same property on the same elements (the 620 / 668 rules and the 560 rules), with no !important anywhere, so it wins whatever the order;
//  5. the welcome blocks it covers are exactly the ones today's rules size, and the composer is the column plus its own 24 px padding (so the visible box is the column);
//  6. scope over the COMMITTED diff, GATE-SAFE (subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, registry / .env.example / strip reads past a synthetic later change, no hash-object --stdin);  7. mutants are caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'
import {
  BASE_COMMIT, CHAT_COLUMN_WIDE_FILES, CHAT_COLUMN_WIDE_NEW_FILES, CHAT_COLUMN_WIDE_PIN_EDITS, CHAT_COLUMN_WIDE_SCOPE_FILES, CHAT_COLUMN_WIDE_ENV_BLOCK, CHAT_COLUMN_WIDE_MARKER_RE, CHAT_COLUMN_WIDE_SUBJECT, CHAT_COLUMN_WIDE_FLAG, stripChatColumnWide,
} from './studio-chat-column-wide-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
/** Every OTHER registered change's strip, in the registry's order (this change's is left out): a file is read as this change left it, whatever other changes marked in it. */
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(strip => strip !== stripChatColumnWide), rel, text)
const laterBlocks = () => { const at = registry.LATER_ENV_BLOCKS.indexOf(CHAT_COLUMN_WIDE_ENV_BLOCK); return at === -1 ? [] : registry.LATER_ENV_BLOCKS.slice(at + 1) }

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch { caught++; console.log(`CAUGHT mutant ${label}`) }
}
const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, `exactly one ${JSON.stringify(from.slice(0, 80))}`); return text.replace(from, () => to) }
const count = (text, pattern) => (text.match(pattern) || []).length

// ---- the real header in a vm ------------------------------------------------------------------------------------------------------------------
const HEADER = 'components/builder/chat/studio-director-header.tsx', LIB = 'lib/studio-chat-column-wide.ts', CSS = 'components/builder/chat/studio-chat-column-wide.css', FIRST_RUN_CSS = 'components/builder/studio-first-run.css'
const env = {}
const stubs = { react: React, 'react/jsx-runtime': jsxRuntime, 'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), width: props?.size })) }) }
const transpiled = new Map()
const compile = (file, text) => ts.transpileModule(text, { fileName: file, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
function createLoader(sourceOverrides = {}) {
  const cache = new Map(), overridden = new Map()
  const resolve = (spec, from) => { const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(from), spec); for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return base + suffix; return null }
  const requireFor = (spec, from) => {
    if (spec in stubs) return stubs[spec]
    if (spec.endsWith('.css')) return {}
    if (spec.startsWith('@/') || spec.startsWith('.')) { const file = resolve(spec, from); assert.ok(file, `unresolved import ${spec} in ${path.relative(root, from)}`); return run(file) }
    throw new Error(`unexpected import ${spec} in ${path.relative(root, from)}`)
  }
  function run(file) {
    if (cache.has(file)) return cache.get(file)
    const mod = { exports: {} }; cache.set(file, mod.exports)
    const rel = path.relative(root, file)
    if (rel in sourceOverrides) overridden.set(file, compile(file, otherStrips(rel, sourceOverrides[rel])))
    else if (!transpiled.has(file)) transpiled.set(file, compile(file, otherStrips(rel, fs.readFileSync(file, 'utf8'))))
    vm.runInNewContext(overridden.get(file) ?? transpiled.get(file), { module: mod, exports: mod.exports, process: { env }, console, require: spec => requireFor(spec, file) })
    cache.set(file, mod.exports)
    return mod.exports
  }
  return { load: rel => run(path.join(root, rel)) }
}
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL', CHAT_HEADER = 'NEXT_PUBLIC_STUDIO_CHAT_HEADER', CHAT_RECONNECT = 'NEXT_PUBLIC_STUDIO_CHAT_RECONNECT'
const setFlags = ({ wide, shell = 'true', chatHeader, reconnect } = {}) => {
  for (const key of [SHELL, CHAT_HEADER, CHAT_RECONNECT, CHAT_COLUMN_WIDE_FLAG]) delete env[key]
  if (shell !== null) env[SHELL] = shell
  if (wide !== undefined) env[CHAT_COLUMN_WIDE_FLAG] = wide
  if (chatHeader) env[CHAT_HEADER] = 'true'
  if (reconnect) env[CHAT_RECONNECT] = 'true'
}
const loader = createLoader(), baseLoader = createLoader({ [HEADER]: baseText(HEADER) })
const lib = loader.load(LIB)
const SPELLINGS = [undefined, 'false', 'TRUE', '1', 'true ', '']
const STATES = [{ connectionState: 'connected' }, { connectionState: 'connecting' }, { connectionState: 'error' }, { connectionState: 'connected', isLoadingSession: true }, { connectionState: 'disconnected', reconnectStatus: 'exhausted', onReconnect: () => {} }]
const headerMarkup = (api, flags, props) => { setFlags(flags); try { return renderToStaticMarkup(React.createElement(api.load(HEADER).StudioDirectorHeader, { actions: React.createElement('button', null, 'Share'), ...props })) } finally { setFlags({}) } }
const ATTR = ` ${lib.STUDIO_CHAT_COLUMN_WIDE_ATTRIBUTE}="true"`

// ---- the stylesheets, parsed --------------------------------------------------------------------------------------------------------------------
const ruleList = text => { const out = []; postcss.parse(text).walkRules(rule => out.push({ selectors: rule.selectors.map(selector => selector.trim()), decls: rule.nodes.filter(node => node.type === 'decl').map(node => ({ prop: node.prop, value: node.value, important: node.important })) })); return out }
const cssText = read(CSS), firstRunText = read(FIRST_RUN_CSS)
const mine = () => ruleList(cssText)
/** CSS specificity of a selector (a, b, c): ids, classes / attributes / pseudo-classes, types. :has / :is / :not count as their most specific argument, :where as nothing. */
function specificity(selector) {
  let a = 0, b = 0, c = 0, i = 0
  const ident = at => { let j = at; while (j < selector.length && /[\w-]/.test(selector[j])) j++; return j }
  const close = open => { let depth = 0; for (let j = open; j < selector.length; j++) { if (selector[j] === '(') depth++; else if (selector[j] === ')' && --depth === 0) return j } throw new Error(`unbalanced ${selector}`) }
  const top = text => { const parts = []; let depth = 0, from = 0; for (let j = 0; j < text.length; j++) { if (text[j] === '(' || text[j] === '[') depth++; else if (text[j] === ')' || text[j] === ']') depth--; else if (text[j] === ',' && depth === 0) { parts.push(text.slice(from, j)); from = j + 1 } } parts.push(text.slice(from)); return parts }
  while (i < selector.length) {
    const ch = selector[i]
    if (ch === '[') { b++; i = selector.indexOf(']', i) + 1 } else if (ch === '.') { b++; i = ident(i + 1) } else if (ch === '#') { a++; i = ident(i + 1) }
    else if (ch === ':') {
      if (selector[i + 1] === ':') { c++; i = ident(i + 2); continue }
      const end = ident(i + 1), name = selector.slice(i + 1, end)
      if (selector[end] === '(') {
        const stop = close(end), inner = selector.slice(end + 1, stop)
        if (['has', 'is', 'not', 'matches'].includes(name)) { let best = [0, 0, 0]; for (const arg of top(inner)) { const s = specificity(arg); if (s[0] > best[0] || (s[0] === best[0] && (s[1] > best[1] || (s[1] === best[1] && s[2] > best[2])))) best = s } a += best[0]; b += best[1]; c += best[2] }
        else if (name !== 'where') b++
        i = stop + 1
      } else { b++; i = end }
    } else if (/[A-Za-z]/.test(ch)) { c++; i = ident(i) } else i++
  }
  return [a, b, c]
}
const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
/** A px / vw / % value of PK's expression at a window width and a percentage basis: min(clamp(lo, N vw, hi), 100% - gutter). */
function evaluate(value, windowPx, basisPx) {
  const clampMatch = /clamp\((\d+)px, (\d+)vw, (\d+)px\)/.exec(value), cap = /100% - (\d+)px\)$/.exec(value)
  assert.ok(clampMatch && cap, `an expression of the expected shape: ${value}`)
  const [lo, vw, hi] = [Number(clampMatch[1]), Number(clampMatch[2]) * windowPx / 100, Number(clampMatch[3])]
  return Math.min(Math.min(Math.max(vw, lo), hi), basisPx - Number(cap[1]))
}
const TOKEN_SELECTOR = '[data-studio-v4-shell="true"]:has([data-studio-chat-column-wide="true"])'
const TARGETS = [
  ['the blocks of the column (head, starters, the links row inside them)', selector => selector.endsWith('div:has(> [data-studio-first-run]) > *'), 'width'],
  ['the welcome head', selector => selector.endsWith('[data-studio-director-welcome][data-studio-first-run]'), 'max-width'],
  ['the composer element', selector => selector.endsWith('[data-studio-v4-composer]'), 'width'],
]

// ===== 1. the flag and the marker ===========================================================================================================================
await check('the flag is the exact string "true", read when asked, and the marker attribute exists only with it: for every other spelling the header is the BASE header\'s markup, byte for byte, in every header state, with and without the chat header; with it on it differs by that one attribute', () => {
  for (const value of SPELLINGS) { setFlags({ wide: value }); assert.equal(lib.studioChatColumnWideOn(), false, `spelling ${JSON.stringify(value)}`); assert.deepEqual({ ...lib.studioChatColumnWideProps() }, {}) }
  setFlags({ wide: 'true' }); assert.equal(lib.studioChatColumnWideOn(), true); assert.deepEqual({ ...lib.studioChatColumnWideProps() }, { 'data-studio-chat-column-wide': 'true' }); setFlags({})
  for (const chatHeader of [false, true]) for (const props of STATES) {
    const baseline = headerMarkup(baseLoader, { chatHeader }, props)
    assert.ok(!baseline.includes('data-studio-chat-column-wide'), 'the base has no marker')
    for (const value of SPELLINGS) assert.equal(headerMarkup(loader, { wide: value, chatHeader }, props), baseline, `${chatHeader ? 'chat' : 'plain'} header ${JSON.stringify(props.connectionState)}, flag ${JSON.stringify(value)}: the base's markup`)
    const on = headerMarkup(loader, { wide: 'true', chatHeader }, props)
    assert.equal(on, baseline.replace(/^<header([^>]*)>/, (whole, attrs) => `<header${attrs}${ATTR}>`), 'flag on: the one attribute on the opening tag, nothing else')
    assert.equal(count(on, /data-studio-chat-column-wide/g), 1, 'one marker')
  }
  assert.equal(headerMarkup(loader, { wide: 'true', shell: null }, STATES[0]), '', 'outside the Studio shell the header draws nothing, so there is no marker either')
})
await check('the strip gives the header back byte for byte (the pinned tag line put back, other changes\' lines out of both sides), and twice changes nothing more; a file it does not own comes back as it is', () => {
  const now = read(HEADER), base = baseText(HEADER)
  assert.notEqual(now, base); assert.equal(stripChatColumnWide(HEADER, otherStrips(HEADER, now)), otherStrips(HEADER, base)); assert.equal(stripChatColumnWide(HEADER, stripChatColumnWide(HEADER, now)), stripChatColumnWide(HEADER, now))
  assert.equal(registry.stripLaterChanges(HEADER, now), registry.stripLaterChanges(HEADER, base), 'through the registry (the older pins\' read) it is the base\'s too')
  assert.equal(stripChatColumnWide('lib/anything.ts', 'x'), 'x')
  assert.equal(count(now, /^.*STUDIO-CHAT-COLUMN-WIDE.*$/gm), 3, 'three marked header lines (two imports and the tag)')
  assert.ok(!/studio-chat-column-wide/.test(read('app/builder/page.tsx')), 'app/builder/page.tsx is not touched (it is FRONTEND-1-acked for #554 only)')
})

// ===== 2. the tokens =========================================================================================================================================
await check('the tokens: exactly --studio-chat-welcome-column and --studio-chat-conversation-column, with the exact strings of the lib, defined once, in the one rule keyed to the marker (on the Studio shell), nowhere else', () => {
  const rules = mine(), defs = rules.flatMap(rule => rule.decls.filter(decl => decl.prop.startsWith('--')).map(decl => ({ ...decl, selectors: rule.selectors })))
  assert.deepEqual(defs.map(def => def.prop).sort(), ['--studio-chat-conversation-column', '--studio-chat-welcome-column'], 'exactly the two exact names are defined')
  assert.equal(lib.STUDIO_CHAT_WELCOME_COLUMN_TOKEN, '--studio-chat-welcome-column'); assert.equal(lib.STUDIO_CHAT_CONVERSATION_COLUMN_TOKEN, '--studio-chat-conversation-column')
  for (const def of defs) { assert.deepEqual(def.selectors, [TOKEN_SELECTOR], 'defined only on the shell that holds the marker'); assert.ok(!def.important) }
  assert.equal(defs.find(def => def.prop === '--studio-chat-welcome-column').value, lib.STUDIO_CHAT_WELCOME_COLUMN_VALUE)
  assert.equal(defs.find(def => def.prop === '--studio-chat-conversation-column').value, lib.STUDIO_CHAT_CONVERSATION_COLUMN_VALUE)
  assert.match(lib.STUDIO_CHAT_WELCOME_COLUMN_VALUE, /^min\(clamp\(640px, 44vw, 880px\), 100% - 8px\)$/); assert.match(lib.STUDIO_CHAT_CONVERSATION_COLUMN_VALUE, /^min\(clamp\(640px, 50vw, 1000px\), 100% - 8px\)$/)
  let definers = []; try { definers = git('grep', '-l', '-F', '-e', '--studio-chat-welcome-column:', '-e', '--studio-chat-conversation-column:', '--', 'app', 'components', 'lib', 'hooks').split('\n').filter(Boolean) } catch { /* exit 1: no file at all */ }
  assert.deepEqual(definers.filter(file => file !== CSS), [], 'no other committed file defines a token (the working tree file is this change\'s)')
})
await check('what the tokens evaluate to: the welcome is 640 px at 1440 (44.4%), 704 at 1600 (44%), 844.8 at 1920, 880 from 2000 (44%, the clamp) and never over; the conversation column is 720 at 1440, 800 at 1600, 960 at 1920, 1000 from 2000; a narrow window keeps a 16 px gutter', () => {
  const W = lib.STUDIO_CHAT_WELCOME_COLUMN_VALUE, C = lib.STUDIO_CHAT_CONVERSATION_COLUMN_VALUE, big = 5000
  for (const [win, welcome, conversation] of [[1440, 640, 720], [1600, 704, 800], [1920, 844.8, 960], [2000, 880, 1000], [2560, 880, 1000], [1280, 640, 640]]) {
    assert.ok(Math.abs(evaluate(W, win, big) - welcome) < 1e-9, `welcome at ${win}`); assert.ok(Math.abs(evaluate(C, win, big) - conversation) < 1e-9, `conversation at ${win}`)
  }
  assert.ok(Math.abs(evaluate(W, 2000, big) / 2000 - 0.44) < 1e-9, '44% of the window at 2000')
  // a narrow window: the percentage basis is the scroll content (the chat area less 12 px padding each side): the column is that minus 8 px, so the gutter from the chat area is 12 + 4 = 16 px each side
  for (const chatArea of [300, 364, 500, 640, 700]) { const content = chatArea - 24, column = evaluate(W, 420, content); assert.ok(column <= content - 8 + 1e-9 && (chatArea - column) / 2 >= 16 - 1e-9, `chat area ${chatArea}: column ${column}, gutter ${(chatArea - column) / 2}`) }
  assert.ok(evaluate(W, 1440, 500) < 640, 'it shrinks below the 640 clamp when the chat area is narrower (never overflows)')
})

// ===== 3. every rule is keyed =================================================================================================================================
await check('every rule is keyed to the marker attribute, and every rule but the token rule to the full-width first-run stage (so the docked panel and every flag-off page match nothing); no !important on any width this change competes with', () => {
  const rules = mine(); assert.ok(rules.length >= 4)
  for (const rule of rules) for (const selector of rule.selectors) {
    assert.ok(selector.includes('[data-studio-chat-column-wide="true"]'), `keyed to the marker: ${selector.slice(0, 90)}`)
    if (selector !== TOKEN_SELECTOR) { assert.ok(selector.includes('[data-studio-first-run-stage="true"]') && selector.includes('[data-studio-first-run]'), `keyed to the first-run stage: ${selector.slice(0, 90)}`); assert.ok(selector.startsWith(TOKEN_SELECTOR + ' '), 'under the shell that holds the marker') }
    for (const decl of rule.decls) assert.ok(!decl.important)
  }
  const sized = ruleList(firstRunText).filter(rule => rule.selectors.some(selector => TARGETS.some(([, test, prop]) => test(selector) && rule.decls.some(decl => decl.prop === prop))))
  assert.ok(sized.length >= 6); for (const rule of sized) for (const decl of rule.decls.filter(decl => decl.prop === 'width' || decl.prop === 'max-width')) assert.ok(!decl.important, `the competing ${decl.prop} rule has no !important: ${rule.selectors[0].slice(0, 60)}`)
  // the first-run stage selector is the one studio-first-run.css lays the full-width welcome out under: the docked panel's wrapper has no data-studio-first-run-stage
  assert.ok(firstRunText.includes('[data-studio-v4-shell-presentation][data-studio-first-run-stage="true"]'))
})

// ===== 4. the cascade on the real stylesheets =====================================================================================================================
await check('cascade: each rule of this change is MORE specific than every rule of studio-first-run.css that sets the same property on the same elements (the 620 / 668 rules and all three 560 rules), so it wins whatever the order, with the flag on', () => {
  const ours = mine().flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls }))), theirs = ruleList(firstRunText).flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls })))
  let compared = 0
  for (const [label, test, prop] of TARGETS) {
    const mineRules = ours.filter(rule => test(rule.selector) && rule.decls.some(decl => decl.prop === prop)), others = theirs.filter(rule => test(rule.selector) && rule.decls.some(decl => decl.prop === prop))
    assert.equal(mineRules.length, 1, `${label}: one rule of ours sets ${prop}`); assert.ok(others.length >= 1, `${label}: there is a rule to beat`)
    for (const other of others) { assert.ok(cmp(specificity(mineRules[0].selector), specificity(other.selector)) > 0, `${label}: ours ${specificity(mineRules[0].selector)} beats ${specificity(other.selector)} (${other.decls.find(decl => decl.prop === prop).value})`); compared++ }
  }
  assert.ok(compared >= 6, `compared ${compared} competing rules`)
  const widths = theirs.filter(rule => rule.decls.some(decl => /^(620|668|560)px$|min\((620|668|560)px/.test(decl.value) || /min\(calc\(560px/.test(decl.value)))
  assert.ok(widths.length >= 5, 'the 620 / 668 / 560 rules are among those compared')
  for (const other of widths.filter(rule => TARGETS.some(([, test]) => test(rule.selector)))) assert.ok(TARGETS.some(([, test]) => test(other.selector)))
})
await check('coverage and the composer inset: the rules size exactly the elements today\'s 620 / 668 / 560 rules size, and the composer ELEMENT is the column plus its own 24 px padding (the visible box is the column), capped like the column; every block uses the welcome token', () => {
  const ours = mine().flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls }))).filter(rule => rule.selector !== TOKEN_SELECTOR)
  const sized = ruleList(firstRunText).flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls }))).filter(rule => rule.decls.some(decl => (decl.prop === 'width' || decl.prop === 'max-width') && /(620|668|560)px/.test(decl.value)))
  const kinds = rules => new Set(rules.map(rule => TARGETS.find(([, test]) => test(rule.selector))?.[0]))
  assert.deepEqual([...kinds(sized)].sort(), [...kinds(ours)].sort(), 'the same three kinds of element')
  const value = (rule, prop) => rule.decls.find(decl => decl.prop === prop)?.value
  assert.equal(value(ours.find(rule => TARGETS[0][1](rule.selector)), 'width'), 'var(--studio-chat-welcome-column)')
  assert.equal(value(ours.find(rule => TARGETS[1][1](rule.selector)), 'max-width'), 'var(--studio-chat-welcome-column)')
  assert.equal(value(ours.find(rule => TARGETS[2][1](rule.selector)), 'width'), `min(calc(var(--studio-chat-welcome-column) + ${lib.STUDIO_CHAT_COMPOSER_INSET_PX}px), 100% - 8px)`)
  assert.equal(lib.STUDIO_CHAT_COMPOSER_INSET_PX, 24, 'the p-3 inset, 12 px each side'); assert.match(read('lib/studio-welcome-width.ts'), /STUDIO_WELCOME_COMPOSER_INSET_PX = 24/); assert.match(read('components/builder/chat-input.tsx'), /\bp-3\b/)
  assert.ok(!ours.some(rule => /\b(620|668|560)px\b/.test(rule.decls.map(decl => decl.value).join(' '))), 'no old width survives in the new rules')
  const evaluated = evaluate(lib.STUDIO_CHAT_WELCOME_COLUMN_VALUE, 1600, 5000) + lib.STUDIO_CHAT_COMPOSER_INSET_PX; assert.equal(evaluated, 704 + 24, 'composer element at 1600: 728 px, its visible box 704 px')
})

// ===== 6. scope =================================================================================================================================================
console.log('scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-31T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-31T00:00:00Z' }
const plumb = (args, input) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...(input === undefined ? {} : { input }), env: { ...process.env, ...GIT_IDENT }, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`: a large input through a stdin pipe once left a git child waiting forever in another proof's run): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wtr-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => [CHAT_COLUMN_WIDE_SUBJECT].some(prefix => subject.startsWith(prefix))
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees nothing on the gate's merge and none of this change's commits once a change is stacked after it. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  The branch tip must be an ORDINARY commit (one parent), never itself a dev-first two-parent merge. On a branch (HEAD is this change's tip, or a merge of dev INTO it) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const REAL = { norm: otherStrips, env: text => registry.stripLaterEnvBlocks('.env.example', text) }
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const normDiff = (ctx, rel, head) => git('diff', '-U0', blobOf(ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`))), blobOf(ctx.norm(rel, git('show', `${head}:${rel}`))))
const OLDER_PREFIXES = /^(Chat element edit|Targeted chat edit:|Targeted chat add:|Chat text set:|Text set keep look:|Structural refine decline:)/
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) assert.doesNotMatch(subjectOf(c), OLDER_PREFIXES, `${c.slice(0, 8)} would be taken for an older change's own commit`)
  return own
}
/** The base lines the pin puts back: the lines of the base file that contain the pinned fragment (the pin is a tail of one line, so it keeps working when a later change adds a name earlier in that line). */
const removedAllowed = (rel, baseNorm) => new Set(baseNorm.split('\n').filter(line => (CHAT_COLUMN_WIDE_PIN_EDITS[rel] || []).some(([, was]) => line.includes(was.replace(/\n$/, '')))))
const scopeCommittedFiles = (head, ctx = REAL) => {
  const own = scopeOwnCommits(head)
  const touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  assert.deepEqual([...touched].sort(), [...CHAT_COLUMN_WIDE_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
  for (const rel of CHAT_COLUMN_WIDE_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head)), allowedRemoved = removedAllowed(rel, ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)))
    for (const line of diff) {
      if (line.startsWith('-')) assert.ok(allowedRemoved.has(line.slice(1)), `${rel}: a removed line that is not a pinned one: ${line.slice(0, 120)}`)
      else assert.match(line, CHAT_COLUMN_WIDE_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`)
    }
    assert.ok(diff.filter(line => line.startsWith('+')).length > 0, `${rel}: the number of added lines`)
    assert.equal(diff.filter(line => line.startsWith('-')).length, (CHAT_COLUMN_WIDE_PIN_EDITS[rel] || []).length, `${rel}: exactly the pinned lines are removed`)
    assert.equal(stripChatColumnWide(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of CHAT_COLUMN_WIDE_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of ['app/builder/page.tsx', 'components/builder/presentation-area.tsx', 'components/builder/studio-outline-canvas.tsx', 'components/builder/studio-first-run-actions.tsx', 'components/builder/studio-introduction.tsx', 'components/builder/studio-first-run.css',
    'components/builder/chat/studio-director-header.css', 'lib/studio-greeting-lifecycle.ts', 'lib/studio-flow-control.ts', 'hooks/use-studio-flow-control.ts', 'hooks/use-deckster-websocket-v2.ts', 'public/logo-icon-sm.png']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const env = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(env), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(env.split(CHAT_COLUMN_WIDE_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(env, new RegExp(`\\n\\n${CHAT_COLUMN_WIDE_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const mine = diff.filter(line => line.includes('studio-chat-column-wide-strip.mjs'))
  assert.equal(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of mine) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(mine.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['CHAT_COLUMN_WIDE_SCOPE_FILES', 'CHAT_COLUMN_WIDE_ENV_BLOCK', 'stripChatColumnWide'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }

const HEAD = scopeHead('HEAD')
await check(`this change's own commits (subject starts "${CHAT_COLUMN_WIDE_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's`, () => { scopeOwnCommits(HEAD) })
await check('the committed files are exactly this change\'s; every line added to an existing file is a pure insertion that carries one of the two markers (the one pinned dependency-list line aside); the strip gives the base back byte for byte; the six older proofs taught a registry read put back are the base\'s', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of CHAT_COLUMN_WIDE_NEW_FILES.filter(rel => !rel.endsWith('.json') && !rel.endsWith('.css'))) assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
})
await check('every line that names the marker names it as a whole token, in the header only', () => {
  const lines = read(HEADER).split('\n').filter(line => /STUDIO-CHAT-COLUMN-WIDE/.test(line))
  assert.ok(lines.length === 3 && lines.every(line => CHAT_COLUMN_WIDE_MARKER_RE.test(line)), 'three header lines carry the marker (two imports, the opening tag), each as a whole token')
  for (const rel of ['components/builder/message-list.tsx', 'components/builder/chat/studio-welcome.tsx']) assert.ok(!/STUDIO-CHAT-COLUMN-WIDE/.test(read(rel)), `${rel} carries no marker of this change`)
})
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = gateMerge(BASE_COMMIT, HEAD)
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE)
  for (const rel of CHAT_COLUMN_WIDE_FILES) assert.equal(stripChatColumnWide(rel, otherStrips(rel, git('show', `${GATE}:${rel}`))), otherStrips(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree, without this change's lines, is the base's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await check('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wtr-idx-'))
  try {
    const env = { ...process.env, ...GIT_IDENT, GIT_INDEX_FILE: path.join(dir, 'index') }
    const viaIndex = (...a) => execFileSync('git', a, { cwd: root, env, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim()
    viaIndex('read-tree', parent)
    for (const [rel, text] of Object.entries(edits)) viaIndex('update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`)
    return plumb(['commit-tree', viaIndex('write-tree'), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
const unrelated = commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE')
const ADVANCED_GATE = gateMerge(unrelated, HEAD)
await check('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE (an unrelated commit): the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
// a SYNTHETIC change stacked after this one: marked lines in the welcome, the header and the list (next to this change's own), a registry trio below this change's, an .env.example block, a new file
const SYN = { marker: 'SYNTHETIC-LATER', file: 'scripts/studio-synthetic-later-strip.mjs', block: '# SYNTHETIC LATER (a made-up change stacked after this one)\nNEXT_PUBLIC_SYNTHETIC_LATER="false"\n' }
const syntheticStrip = (rel, text) => CHAT_COLUMN_WIDE_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.marker)).join('\n') : text
const syntheticCommit = parent => {
  const at = rel => git('show', `${parent}:${rel}`)
  const edits = {}
  for (const rel of CHAT_COLUMN_WIDE_FILES) {
    const lines = at(rel).split('\n'); let done = false
    edits[rel] = lines.flatMap(line => { if (!done && CHAT_COLUMN_WIDE_MARKER_RE.test(line) && line.startsWith('import ')) { done = true; return [line, `const syntheticLater = 1 // ${SYN.marker}`] } return [line] }).join('\n')
    if (!done) edits[rel] = lines.flatMap(line => { if (!done && /^\s*const welcomeTrim|^\s*const markTrim|^\s*const trimGreetingsRef/.test(line)) { done = true; return [line, `  const syntheticLater = 1 // ${SYN.marker}`] } return [line] }).join('\n')
    assert.ok(edits[rel].includes(SYN.marker), `the synthetic anchor exists in ${rel}`)
  }
  edits['scripts/studio-later-changes.mjs'] = at('scripts/studio-later-changes.mjs').split('\n').flatMap(line => {
    if (line.includes('CHAT_COLUMN_WIDE_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('CHAT_COLUMN_WIDE_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripChatColumnWide')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
    return [line]
  }).join('\n')
  edits['.env.example'] = `${at('.env.example')}\n${SYN.block}`
  edits[SYN.file] = 'export const SYNTHETIC_SCOPE_FILES = new Set()\n'
  return commitWith(parent, edits, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const SYNTHETIC = syntheticCommit(HEAD)
const SYN_CTX = {
  norm: (rel, text) => syntheticStrip(rel, otherStrips(rel, text)),
  env: text => registry.stripLaterEnvBlocks('.env.example', text).replace(`\n${SYN.block}`, ''),
}
await check('ROBUST AFTER MERGE: a synthetic change stacked after this one (its marked lines beside this change\'s in the three files, a registry trio, an .env.example block, a new file; its own commit has another subject) leaves this change\'s scope section passing, on the branch, on the gate\'s merge and on a merge onto an advanced dev', () => {
  assert.ok(ownOf(SYNTHETIC).length === ownOf(HEAD).length && !ownOf(SYNTHETIC).includes(SYNTHETIC), 'the later commit is not this change\'s')
  assert.equal(scopeHead(SYNTHETIC), SYNTHETIC)
  scopeAll(SYNTHETIC, SYN_CTX)
  const gate = gateMerge(BASE_COMMIT, SYNTHETIC)
  assert.equal(scopeHead(gate), SYNTHETIC); scopeAll(scopeHead(gate), SYN_CTX); scopeEnvAndRegistry(gate, SYN_CTX)
  for (const rel of CHAT_COLUMN_WIDE_FILES) assert.equal(stripChatColumnWide(rel, SYN_CTX.norm(rel, git('show', `${gate}:${rel}`))), SYN_CTX.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree is the base's ${rel} without this change's and the later change's lines`)
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
  // the registry reads past it: through stripLaterChanges the older pins see the base, with the later change's lines in the file too
  for (const rel of CHAT_COLUMN_WIDE_FILES) assert.equal(stripChatColumnWide(rel, syntheticStrip(rel, git('show', `${SYNTHETIC}:${rel}`))), baseText(rel), `${rel}: either order of the two strips gives the base`)
})
await check('mutant caught: the same synthetic later change fails a scope that is not told about it (its lines are unmarked additions, its registry lines extra)', () => {
  assert.throws(() => scopeCommittedFiles(SYNTHETIC), /unmarked added line|exactly its scope/)
  assert.throws(() => scopeEnvAndRegistry(SYNTHETIC), /gains exactly|base plus the registered blocks/)
})
await check('mutant caught: a stray foreign file in a "Welcome trim:" commit fails the committed-files check (own commits found by subject, the diff names the file)', () => {
  const stray = commitWith(HEAD, { 'stray-welcome-trim.txt': 'stray\n' }, `${CHAT_COLUMN_WIDE_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an own commit without the co-author line, an unmarked line added to the list or the header in an own commit, and a touched foreign file, fail the scope', () => {
  const noTrailer = commitWith(HEAD, {}, `${CHAT_COLUMN_WIDE_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  for (const rel of [HEADER]) {
    const sneaky = commitWith(HEAD, { [rel]: git('show', `${HEAD}:${rel}`).replace('\nexport ', '\nconst sneaky = 1\nexport ') }, `${CHAT_COLUMN_WIDE_SUBJECT} a sneaky line${TRAILER}`)
    assert.throws(() => scopeCommittedFiles(sneaky), /unmarked added line/, rel)
  }
  const hook = commitWith(HEAD, { 'hooks/use-deckster-websocket-v2.ts': git('show', `${HEAD}:hooks/use-deckster-websocket-v2.ts`) + '\n' }, `${CHAT_COLUMN_WIDE_SUBJECT} touches the hook${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(hook), /exactly its scope|is not touched/)
  const pageLine = commitWith(HEAD, { 'components/builder/studio-first-run-actions.tsx': git('show', `${HEAD}:components/builder/studio-first-run-actions.tsx`) + '\n' }, `${CHAT_COLUMN_WIDE_SUBJECT} touches the stage actions${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(pageLine), /exactly its scope|is not touched/)
})

// ===== 7. mutants (each one edit of the real sources, fed to the same checks) =============================================================================
if (!process.env.CHECK_ONLY) console.log('mutants')
const libSrc = read(LIB), headerSrc = read(HEADER)
const mutantCss = (from, to) => { const text = swap(cssText, from, to); return { rules: ruleList(text), text } }
const tokenCheck = (text, expected) => { const defs = ruleList(text).flatMap(rule => rule.decls.filter(decl => decl.prop.startsWith('--'))); assert.deepEqual(defs.map(def => def.value).sort(), expected.sort()) }
const WELCOME_V = lib.STUDIO_CHAT_WELCOME_COLUMN_VALUE, CONV_V = lib.STUDIO_CHAT_CONVERSATION_COLUMN_VALUE
await mutant('a token value drifts (44vw becomes 40vw)', () => tokenCheck(swap(cssText, 'clamp(640px, 44vw, 880px)', 'clamp(640px, 40vw, 880px)'), [WELCOME_V, CONV_V]))
await mutant('a token loses its cap (the column can overflow a narrow chat area)', () => tokenCheck(swap(cssText, 'min(clamp(640px, 50vw, 1000px), 100% - 8px)', 'min(clamp(640px, 50vw, 1000px), 100%)'), [WELCOME_V, CONV_V]))
await mutant('a token is renamed', () => { const defs = ruleList(swap(cssText, '--studio-chat-conversation-column:', '--studio-chat-convo-column:')).flatMap(rule => rule.decls.filter(decl => decl.prop.startsWith('--'))); assert.deepEqual(defs.map(def => def.prop).sort(), ['--studio-chat-conversation-column', '--studio-chat-welcome-column']) })
await mutant('the flag is read as truthy, not exactly "true"', () => { const api = createLoader({ [LIB]: swap(libSrc, "=== 'true'", '!== undefined') }); setFlags({ wide: 'false' }); try { assert.equal(api.load(LIB).studioChatColumnWideOn(), false) } finally { setFlags({}) } })
await mutant('the marker is always on (flag off is not the base)', () => { const api = createLoader({ [LIB]: swap(libSrc, "return studioChatColumnWideOn() ? { 'data-studio-chat-column-wide': 'true' } : {}", "return { 'data-studio-chat-column-wide': 'true' }") }); assert.equal(headerMarkup(api, {}, STATES[0]), headerMarkup(baseLoader, {}, STATES[0])) })
await mutant('the header drops the marker with the flag on', () => { const api = createLoader({ [HEADER]: swap(headerSrc, '{...studioChatColumnWideProps() /*', '{...{} /*') }); assert.ok(headerMarkup(api, { wide: 'true' }, STATES[0]).includes(ATTR)) })
await mutant('a rule loses the marker key (it would match with the flag off)', () => { const text = swap(cssText, ':has([data-studio-chat-column-wide="true"]) [data-studio-v4-shell-workspace]:has(> [data-studio-v4-shell-presentation][data-studio-first-run-stage="true"]):has([data-studio-workspace-drawer="deck"][data-studio-workspace-visible="true"] [data-studio-first-run][data-studio-director-welcome]) [data-studio-director-welcome][data-studio-first-run] {', ' [data-studio-v4-shell-workspace]:has(> [data-studio-v4-shell-presentation][data-studio-first-run-stage="true"]):has([data-studio-workspace-drawer="deck"][data-studio-workspace-visible="true"] [data-studio-first-run][data-studio-director-welcome]) [data-studio-director-welcome][data-studio-first-run] {'); for (const rule of ruleList(text)) for (const selector of rule.selectors) assert.ok(selector.includes('[data-studio-chat-column-wide="true"]')) })
await mutant('a rule loses the first-run stage key (the docked panel would be resized)', () => { const text = swap(cssText, '[data-studio-v4-shell-workspace]:has(> [data-studio-v4-shell-presentation][data-studio-first-run-stage="true"]):has([data-studio-workspace-drawer="deck"][data-studio-workspace-visible="true"] [data-studio-first-run][data-studio-director-welcome]) [data-studio-v4-composer] {', '[data-studio-v4-shell-workspace] [data-studio-v4-composer] {'); for (const rule of ruleList(text)) for (const selector of rule.selectors) if (selector !== TOKEN_SELECTOR) assert.ok(selector.includes('[data-studio-first-run-stage="true"]')) })
const cascadeOf = text => { const ours = ruleList(text).flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls }))), theirs = ruleList(firstRunText).flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls }))); for (const [, test, prop] of TARGETS) { const a = ours.find(rule => test(rule.selector) && rule.decls.some(decl => decl.prop === prop)); for (const other of theirs.filter(rule => test(rule.selector) && rule.decls.some(decl => decl.prop === prop))) assert.ok(cmp(specificity(a.selector), specificity(other.selector)) > 0) } }
await mutant('the composer rule is less specific than the 560 rule (it would lose to it)', () => cascadeOf(swap(cssText, '[data-studio-first-run][data-studio-director-welcome]) [data-studio-v4-composer] {', '[data-studio-first-run]) [data-studio-v4-composer] {')))
await mutant('the block rule is less specific than the 560 rule', () => cascadeOf(swap(cssText, '[data-studio-first-run][data-studio-director-welcome]) div:has(> [data-studio-first-run]) > * {', '[data-studio-first-run]) div:has(> [data-studio-first-run]) > * {')))
await mutant('the shell no longer needs the marker (one specificity step lost on every rule)', () => cascadeOf(cssText.replace(/\[data-studio-v4-shell="true"\]:has\(\[data-studio-chat-column-wide="true"\]\) \[data-studio-v4-shell-workspace\]/g, '[data-studio-v4-shell="true"] [data-studio-v4-shell-workspace]')))
await mutant('the composer inset is dropped (the visible box would be 24 px narrower than the column)', () => { const text = swap(cssText, 'min(calc(var(--studio-chat-welcome-column) + 24px), 100% - 8px)', 'min(var(--studio-chat-welcome-column), 100% - 8px)'); assert.match(ruleList(text).find(rule => rule.selectors[0].endsWith('[data-studio-v4-composer]')).decls[0].value, /\+ 24px/) })
await mutant('an old width is left in a rule (620 px)', () => { const text = swap(cssText, 'width: var(--studio-chat-welcome-column);\n}', 'width: min(620px, 100%);\n}'); assert.ok(!ruleList(text).some(rule => rule.decls.some(decl => /620px/.test(decl.value)))) })
await mutant('a marker line is mistyped (the strip would leave it behind)', () => assert.equal(stripChatColumnWide(HEADER, headerSrc.replace('import "./studio-chat-column-wide.css" // STUDIO-CHAT-COLUMN-WIDE', 'import "./studio-chat-column-wide.css" // STUDIO-CHAT-COLUMN-WIDEE')), baseText(HEADER)))
await mutant('the pin is not put back (the tag keeps its spread after the strip)', () => assert.equal(stripChatColumnWide(HEADER, headerSrc.replace('{...studioChatColumnWideProps() /* STUDIO-CHAT-COLUMN-WIDE:', '{...studioChatColumnWideProps() /* STUDIO-CHAT-COLUMN-WIDEX:')), baseText(HEADER)))

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
