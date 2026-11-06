// FRONTEND-2 (B60; FRONTEND-1's UX pass finding UX-15): proof of the /redeem page in the Studio v4 frame (flag NEXT_PUBLIC_STUDIO_REDEEM_V4, exact "true", build-time, default off).
// Offline and plain node: no network, no browser, no database, no build. The REAL sources are transpiled and run in a vm (the page, the view, the lib), the markup is react-dom/server's, the stylesheet is read with postcss.
//   node scripts/test-studio-redeem-v4.mjs        (CHECK_ONLY=<text> runs the checks whose label has it; mutants are skipped then; MUTANT_WHY=1 prints the first line of what caught each mutant)
//
// What it proves:
//  1. the flag: exact "true" only (every other spelling is off), read in lib/studio-redeem-v4.ts; the page tests the very same name inline, around its import(), and imports nothing of the Studio view statically (so a build with
//     the flag off drops the view and its stylesheet, as app/not-found.tsx does); .env.example documents it as "false".
//  2. the page, run through a tiny hook runtime with the REAL shadcn components, flag off, in 16 scenarios (loading, signed out, form, picked plan by query / by localStorage / a bad one / a blocked store, typing, an empty submit, a failed
//     redeem with and without a server message, a network failure, a success with and without a tier note, an approved user, sign out): the markup is byte for byte the base commit's (and the stripped page's), the requests and calls are the same.
//  3. the same 16 scenarios flag on: the visible text nodes, the field's attributes, the buttons (label, disabled), the form and the links are the base's, state for state; the calls (fetch URL, method, headers, body keys and value, update,
//     localStorage, the 1200 ms redirect, sign out, the redirects) are the base's, in the same order. The list of words and attributes is taken from the base file's syntax tree, not typed here.
//  4. the look: no purple / old gradient class names, no old wordmark image, no lowercase "deckster", "Deckster" with the brand tile; the stylesheet colours are tokens only, equal to the Studio shell's own values, light and dark; the phone rules.
//  5. the pins: the page without its six marked lines is the base's, byte for byte (idempotent), pure insertions, after the last hook; the older proofs taught put back to the base; the strip is plain data; the registry holds it.
//  6. scope over the COMMITTED diff, GATE-SAFE (own commits by subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, no hash-object --stdin).
//  7. mutants: each is one edit of the real sources fed to the same checks.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'
import {
  BASE_COMMIT, REDEEM_V4_FILES, REDEEM_V4_NEW_FILES, REDEEM_V4_PIN_EDITS, REDEEM_V4_PIN_FILES, REDEEM_V4_PIN_MARK, REDEEM_V4_SCOPE_FILES,
  REDEEM_V4_ENV_BLOCK, REDEEM_V4_MARKER_RE, REDEEM_V4_SUBJECT, REDEEM_V4_FLAG, stripRedeemV4,
} from './studio-redeem-v4-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const nodeRequire = createRequire(path.join(root, 'package.json'))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
/** Only the strips of the changes registered AFTER this one, in the registry's order: on a branch stacked after this change a later change's own lines (its subject filter beside this one's in a taught proof, ...) are undone first, so a file reads as this change left it. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripRedeemV4); return (at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1)).reduce((out, fn) => { const next = typeof fn === 'function' ? fn(rel, out) : out; return typeof next === 'string' ? next : out }, text) }
/** A mutant whose anchor is not in the source exactly once is a broken mutant, not a caught one. */
class AnchorError extends Error {}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new AnchorError(`mutant anchor must occur exactly once: ${JSON.stringify(from.slice(0, 80))}`); return text.replace(from, () => to) }

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
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof AnchorError) { missed.push(`${label} (${error.message})`); console.error(`BROKEN mutant ${label}: ${error.message}`) } else { caught++; console.log(`CAUGHT mutant ${label}${process.env.MUTANT_WHY ? `  <- ${String(error?.message).split('\n')[0].slice(0, 170)}` : ''}`) }
  }
}

const PAGE = 'app/(auth)/redeem/page.tsx', VIEW = 'components/studio-redeem.tsx', CSS = 'components/studio-redeem.css', LIB = 'lib/studio-redeem-v4.ts'
const SHELL_CSS = 'components/layout/studio-shell.css', HYGIENE = 'components/builder/studio-session-hygiene-styles.ts', ADMIN_CSS = 'components/admin/studio-p2-admin.css'
const FLAG = REDEEM_V4_FLAG
const SPELLINGS = [undefined, 'false', 'TRUE', '1', ' true', 'true ', 'yes', '']

// ---- the real sources in a vm ----------------------------------------------------------------------------------------------------------------------------
const REAL_DEPS = new Set(['lucide-react', 'clsx', 'tailwind-merge', 'class-variance-authority', '@radix-ui/react-slot', 'react/jsx-runtime'])
const compileCache = new Map()
const compile = (file, text) => {
  const id = `${file}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const h = React.createElement
function resolveRepo(spec, fromRel) {
  const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
  for (const ext of ['', '.ts', '.tsx']) { const rel = base + ext; if (/\.tsx?$/.test(rel) && fs.existsSync(path.join(root, rel)) && fs.statSync(path.join(root, rel)).isFile()) return rel }
  throw new Error(`unresolved ${spec} from ${fromRel}`)
}
/** A module world: repo files by path (their text can be overridden), a few real node packages, stubs for Next. next/dynamic loads its module as soon as it is called; `settled()` waits for those loads. */
function makeWorld({ env = {}, texts = {}, stubs = {}, sandbox = {} } = {}) {
  const cache = new Map(), pending = [], css = []
  const dynamic = loader => { const cell = {}; pending.push(Promise.resolve(loader()).then(C => { cell.C = C })); const Dyn = props => h(cell.C, props); Dyn.__target = () => cell.C; return Dyn }
  const builtin = { 'next/dynamic': { __esModule: true, default: dynamic }, 'next/link': { __esModule: true, default: ({ href, className, children }) => h('a', { href, className }, children) }, ...stubs }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const req = spec => {
      if (spec in builtin) return builtin[spec]
      if (spec.endsWith('.css')) { css.push(spec); return {} }
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolveRepo(spec, rel))
      if (REAL_DEPS.has(spec)) return nodeRequire(spec)
      throw new Error(`unexpected import ${spec} in ${rel}`)
    }
    vm.runInNewContext(compile(rel, texts[rel] ?? read(rel)), { module, exports: module.exports, require: req, process: { env }, console, ...sandbox }, { filename: rel })
    return module.exports
  }
  return { load, cache, css, settled: () => Promise.all(pending) }
}

// ---- a tiny hook runtime (state, effects, re-render until stable) -----------------------------------------------------------------------------------------
function makeRuntime() {
  const rt = { cells: [], deps: [], idx: 0, queue: [], dirty: false, out: null }
  rt.useState = init => {
    const i = rt.idx++
    if (!rt.cells[i]) rt.cells[i] = { v: typeof init === 'function' ? init() : init }
    const cell = rt.cells[i]
    return [cell.v, next => { const v = typeof next === 'function' ? next(cell.v) : next; if (!Object.is(v, cell.v)) { cell.v = v; rt.dirty = true } }]
  }
  rt.useEffect = (fn, deps) => {
    const i = rt.idx++, prev = rt.deps[i]
    if (!prev || !deps || deps.some((d, k) => !Object.is(d, prev[k]))) rt.queue.push(() => { rt.deps[i] = deps; return fn() })
  }
  rt.render = component => {
    for (let n = 0; n < 25; n++) {
      rt.idx = 0; rt.queue = []; rt.dirty = false
      rt.out = component()
      const effects = rt.queue; rt.queue = []
      for (const effect of effects) effect()
      if (!rt.dirty) return rt.out
    }
    throw new Error('the component does not settle')
  }
  return rt
}

// ---- a tiny parser for the static markup -----------------------------------------------------------------------------------------------------------------
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const decode = s => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
function parseHtml(html) {
  const top = { tag: '#root', attrs: {}, children: [] }, stack = [top]
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|[^<]+/g
  let m
  while ((m = re.exec(html))) {
    const at = stack[stack.length - 1]
    if (m[2] === undefined) { if (m[0].trim()) at.children.push({ text: decode(m[0]) }); continue }
    const [, close, tag, attrText, selfClose] = m
    if (close) { const i = stack.map(n => n.tag).lastIndexOf(tag); assert.ok(i >= 1, `unbalanced </${tag}>`); stack.length = i; continue }
    const attrs = {}; for (const a of attrText.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) attrs[a[1]] = decode(a[2] ?? '')
    const node = { tag, attrs, children: [] }; at.children.push(node)
    if (!VOID.has(tag) && !selfClose) stack.push(node)
  }
  assert.equal(stack.length, 1, 'every tag is closed')
  return top
}
const walkNodes = (node, fn) => { fn(node); (node.children ?? []).forEach(child => walkNodes(child, fn)) }
const norm = s => s.replace(/\s+/g, ' ').trim()
/** The words a person reads, in order: every text node, and the alt of an image that has one. */
function textNodes(dom) {
  const out = []
  walkNodes(dom, n => { if ('text' in n && n.text !== undefined) { if (norm(n.text)) out.push(norm(n.text)) } else if (n.tag === 'img' && norm(n.attrs.alt ?? '')) out.push(norm(n.attrs.alt)) })
  return out
}
const textOf = node => { let out = ''; walkNodes(node, n => { if (n.text !== undefined) out += n.text }); return norm(out) }
function frameOf(label, html) {
  const dom = parseHtml(html), els = []
  walkNodes(dom, n => { if (n.tag && n.tag !== '#root') els.push(n) })
  return {
    label, html, text: textNodes(dom),
    inputs: els.filter(n => n.tag === 'input').map(n => ({ value: n.attrs.value ?? null, placeholder: n.attrs.placeholder ?? null, disabled: 'disabled' in n.attrs, autofocus: 'autofocus' in n.attrs })),
    buttons: els.filter(n => n.tag === 'button').map(n => ({ text: textOf(n), disabled: 'disabled' in n.attrs, submit: n.attrs.type === 'submit' })),
    forms: els.filter(n => n.tag === 'form').length,
    links: els.filter(n => n.tag === 'a').map(n => n.attrs.href ?? null),
    imgs: els.filter(n => n.tag === 'img').map(n => n.attrs.src ?? null),
    classes: els.flatMap(n => (n.attrs.class ?? '').split(/\s+/).filter(Boolean)),
    roots: els.filter(n => n.attrs['data-studio-redeem'] === 'true' && n.attrs['data-studio-v4-shell'] === 'true').length,
  }
}

// ---- the page, driven ------------------------------------------------------------------------------------------------------------------------------------
const tick = () => new Promise(resolve => setImmediate(resolve))
/** Element-tree search; a next/dynamic stub is opened to the view it loaded. */
function findEls(node, pred, out = []) {
  if (Array.isArray(node)) { node.forEach(child => findEls(child, pred, out)); return out }
  if (node == null || typeof node !== 'object' || !('type' in node)) return out
  if (pred(node)) out.push(node)
  if (typeof node.type === 'function' && node.type.__target) findEls(node.type.__target()(node.props), pred, out)
  else findEls(node.props?.children, pred, out)
  return out
}
const elText = node => (Array.isArray(node) ? node.map(elText).join('') : node == null || typeof node === 'boolean' ? '' : typeof node === 'object' ? elText(node.props?.children) : String(node))

async function openPage({ flag, pageText, viewText, cssText, extraTexts = {} }) {
  const env = flag === undefined ? {} : { [FLAG]: flag }
  const rt = makeRuntime(), log = [], timers = []
  const state = { status: 'authenticated', session: { user: { email: 'pk@example.com', approved: false } }, storage: {}, storageThrows: false, resolve: null, reject: null }
  state.sp = { get: () => null }
  const sandbox = {
    localStorage: { getItem: k => { if (state.storageThrows) throw new Error('blocked'); return k in state.storage ? state.storage[k] : null }, removeItem: k => { log.push(['removeItem', k]) } },
    fetch: (url, init) => { log.push(['fetch', url, init.method, JSON.stringify(init.headers), init.body]); return new Promise((resolve, reject) => { state.resolve = resolve; state.reject = reject }) },
    setTimeout: (fn, ms) => { log.push(['setTimeout', ms]); timers.push(fn); return timers.length },
  }
  const stubs = {
    react: { ...React, useState: rt.useState, useEffect: rt.useEffect },
    'next-auth/react': { useSession: () => ({ data: state.session, status: state.status, update: value => { log.push(['update', JSON.stringify(value)]); return Promise.resolve() } }), signOut: options => { log.push(['signOut', JSON.stringify(options)]) } },
    'next/navigation': { useRouter: () => ({ push: to => { log.push(['push', to]) } }), useSearchParams: () => state.sp },
  }
  const texts = { [PAGE]: pageText, ...(viewText === undefined ? {} : { [VIEW]: viewText }), ...extraTexts }
  const world = makeWorld({ env, texts, stubs, sandbox })
  const mod = world.load(PAGE)
  await world.settled()
  const tree = mod.default()
  const content = tree.props.children.type
  const frames = []
  const s = {
    log, state, world, fallback: tree.props.fallback, frames,
    render: () => rt.render(() => content({})),
    html: () => (rt.out == null ? '' : renderToStaticMarkup(rt.out)),
    snap: label => { const frame = frameOf(label, s.html()); frames.push(frame); return frame },
    snapMarkup: (label, html) => { const frame = frameOf(label, html); frames.push(frame); return frame },
    setParams: params => { state.sp = { get: key => params[key] ?? null } },
    form: () => findEls(rt.out, e => e.type === 'form')[0],
    input: () => findEls(rt.out, e => e.props?.placeholder !== undefined)[0],
    signOutButton: () => findEls(rt.out, e => e.type === 'button' && elText(e).includes('Sign out'))[0],
    type: value => { s.input().props.onChange({ target: { value } }); s.render() },
    submit: () => { const done = s.form().props.onSubmit({ preventDefault: () => { log.push(['preventDefault']) } }); s.render(); return done },
    respond: (ok, body) => state.resolve({ ok, json: () => Promise.resolve(body) }),
    runTimers: () => { for (const fn of timers.splice(0)) fn(); s.render() },
    viewLoaded: () => world.cache.has(VIEW), cssLoaded: () => world.css.length,
  }
  return s
}

const SCENARIOS = {
  loading: async s => { s.state.status = 'loading'; s.state.session = null; s.render(); s.snap('loading'); s.snapMarkup('fallback', renderToStaticMarkup(s.fallback)) },
  signedOut: async s => { s.state.status = 'unauthenticated'; s.state.session = null; s.render(); s.snap('signed out: nothing is drawn, the page goes home') },
  form: async s => { s.render(); s.snap('form'); s.snapMarkup('fallback', renderToStaticMarkup(s.fallback)) },
  noEmail: async s => { s.state.session = { user: {} }; s.render(); s.snap('no email') },
  planQuery: async s => {
    for (const plan of ['starter', 'PRO', 'premium', 'bogus', '']) { s.setParams({ plan }); s.render(); s.snap(`plan query ${JSON.stringify(plan)}`) }
  },
  planStorage: async s => {
    s.state.storage.selectedPlan = 'premium'; s.render(); s.snap('plan from localStorage')
    s.state.storage.selectedPlan = 'nonsense'; s.setParams({}); s.render(); s.snap('a bad plan in localStorage')
    s.state.storageThrows = true; s.setParams({}); s.render(); s.snap('localStorage blocked')
  },
  typing: async s => {
    s.render(); s.snap('typing: empty'); s.type('ab c'); s.snap('typing: "ab c"'); s.type('   '); s.snap('typing: spaces only'); s.type(''); s.snap('typing: cleared'); s.type('welcome50'); s.snap('typing: lower case becomes upper case')
  },
  emptySubmit: async s => { s.render(); await s.submit(); s.snap('submit with nothing'); s.type('   '); await s.submit(); s.snap('submit with spaces') },
  redeemFails: async s => {
    s.render(); s.type(' ab12 '); const done = s.submit(); await tick(); s.snap('redeeming'); await s.submit(); await tick(); s.snap('a second submit while redeeming')
    s.respond(false, { error: 'Coupon expired' }); await done; s.render(); s.snap('the server error'); s.type('ab13'); s.snap('typing clears the error')
  },
  redeemFailsNoMessage: async s => { s.render(); s.type('x1'); const done = s.submit(); await tick(); s.respond(false, {}); await done; s.render(); s.snap('no server message') },
  redeemNetwork: async s => { s.render(); s.type('x1'); const done = s.submit(); await tick(); s.state.reject(new Error('offline')); await done; s.render(); s.snap('network failure') },
  redeemSuccess: async s => {
    s.setParams({ plan: 'pro' }); s.render(); s.type('pro-1'); const done = s.submit(); await tick(); s.respond(true, { creditedCents: 1250, tier: 'pro', balanceCents: 1250 }); await done; s.render(); s.snap('success, the picked plan'); s.runTimers(); s.snap('after the redirect timer')
  },
  redeemSuccessMismatch: async s => {
    s.setParams({ plan: 'starter' }); s.render(); s.type('max-1'); const done = s.submit(); await tick(); s.respond(true, { creditedCents: 5, tier: 'premium', balanceCents: 5 }); await done; s.render(); s.snap('success, another plan than the picked one')
  },
  redeemSuccessUnknownTier: async s => {
    s.render(); s.type('zz-1'); const done = s.submit(); await tick(); s.respond(true, { creditedCents: 100000, tier: 'zzz', balanceCents: 100000 }); await done; s.render(); s.snap('success, a tier the page has no label for')
  },
  approved: async s => { s.state.session = { user: { email: 'pk@example.com', approved: true } }; s.render(); s.snap('already approved') },
  signOut: async s => { s.render(); s.signOutButton().props.onClick(); s.snap('sign out') },
}
async function runAll(opts, only = Object.keys(SCENARIOS)) {
  const out = {}
  for (const name of only) {
    const s = await openPage(opts)
    let timer
    try { await Promise.race([SCENARIOS[name](s), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${name}: the scenario does not finish`)), 3000) })]) } finally { clearTimeout(timer) }
    out[name] = { frames: s.frames, log: s.log, viewLoaded: s.viewLoaded(), cssLoaded: s.cssLoaded() }
  }
  return out
}
const strip = frame => ({ text: frame.text, inputs: frame.inputs, buttons: frame.buttons, forms: frame.forms, links: frame.links })

// ---- what the base file says (its syntax tree, not a typed list) -----------------------------------------------------------------------------------------
/** Every word a person reads in the page: JSX text, an expression child (through ?: && || ?? and templates), the placeholder and alt attributes, what setError is given, the plan labels. */
function visibleStringsOf(source) {
  const sf = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX), out = new Set()
  const add = text => { const t = norm(text); if (t) out.add(t) }
  const visible = node => {
    for (let n = node.parent; n; n = n.parent) {
      if (ts.isJsxExpression(n)) return !ts.isJsxAttribute(n.parent)
      if (ts.isCallExpression(n)) return ts.isIdentifier(n.expression) && n.expression.text === 'setError'
      if (ts.isPropertyAssignment(n)) { const decl = n.parent.parent; return ts.isVariableDeclaration(decl) && decl.name.getText(sf) === 'PLAN_LABELS' }
      if (ts.isConditionalExpression(n) || ts.isParenthesizedExpression(n) || ts.isTemplateExpression(n) || ts.isTemplateSpan(n) || ts.isBinaryExpression(n)) continue
      return false
    }
    return false
  }
  const visit = node => {
    if (ts.isJsxText(node)) add(node.text)
    else if (ts.isJsxAttribute(node) && ['placeholder', 'alt'].includes(node.name.getText(sf)) && node.initializer && ts.isStringLiteral(node.initializer)) add(node.initializer.text)
    else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && visible(node)) add(node.text)
    else if (ts.isTemplateExpression(node) && visible(node)) { add(node.head.text); node.templateSpans.forEach(span => add(span.literal.text)) }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return [...out]
}
/** The attribute names the base page gives its form, its field and its submit button (className aside), and the request it makes. */
function baseContract(source) {
  const sf = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX), attrs = { form: [], Input: [], Button: [] }, fetchCalls = []
  const visit = node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf)
      if (tag in attrs) attrs[tag] = node.attributes.properties.filter(ts.isJsxAttribute).map(a => a.name.getText(sf)).filter(name => name !== 'className')
    }
    if (ts.isCallExpression(node) && node.expression.getText(sf) === 'fetch') {
      const [url, init] = node.arguments
      fetchCalls.push({ url: url.text, props: Object.fromEntries(init.properties.map(p => [p.name.getText(sf), p.initializer.getText(sf).replace(/\s+/g, ' ')])) })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return { attrs, fetchCalls }
}
const BASE_PAGE = baseText(PAGE)
const BASE_STRINGS = visibleStringsOf(BASE_PAGE)
const BASE_CONTRACT = baseContract(BASE_PAGE)

// ---- 1. the flag ------------------------------------------------------------------------------------------------------------------------------------------
console.log('1. flag')
const libWorld = (env, text) => makeWorld({ env, texts: text === undefined ? {} : { [LIB]: text } }).load(LIB)
function proveFlag({ lib = read(LIB), page = read(PAGE), env = read('.env.example') } = {}) {
  assert.equal(libWorld({}, lib).STUDIO_REDEEM_V4_FLAG, FLAG, 'the lib names the flag')
  for (const value of SPELLINGS) {
    const on = value === 'true', exports = libWorld(value === undefined ? {} : { [FLAG]: value }, lib)
    assert.equal(exports.STUDIO_REDEEM_V4_ENABLED, on, `constant: ${JSON.stringify(value)}`)
    assert.equal(exports.studioRedeemV4Enabled(value === undefined ? {} : { [FLAG]: value }), on, `function: ${JSON.stringify(value)}`)
  }
  assert.equal(libWorld({}, lib).studioRedeemV4Enabled({ SOMETHING_ELSE: 'true' }), false, 'another variable is no flag')
  assert.match(lib, /export const STUDIO_REDEEM_V4_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_REDEEM_V4 === 'true'/, 'read as a literal so the build inlines it')
  // the page tests the same name, exact "true", inline, around the import(); it imports nothing of the Studio view or the lib statically
  const code = page.replace(/\/\/.*$/gm, '')
  const tests = code.match(/process\.env\.[A-Z0-9_]+/g) ?? []
  assert.deepEqual(tests, [`process.env.${FLAG}`], 'the page reads exactly one variable, the flag')
  assert.match(code, new RegExp(`const StudioRedeemV4 = process\\.env\\.${FLAG} === 'true' \\? dynamic\\(\\(\\) => import\\('@/components/studio-redeem'\\)\\.then\\(\\(mod\\) => mod\\.StudioRedeemView\\)\\) : null`), 'the flag is tested inline, around the dynamic import()')
  assert.equal((code.match(/studio-redeem/g) ?? []).length, 1, 'the view is named once: in that import()')
  assert.doesNotMatch(code, /^import .*(?:studio-redeem|studio-redeem-v4)/m, 'no static import of the view, its stylesheet or the lib')
  assert.doesNotMatch(code, /^import .*\.css/m, 'the page imports no stylesheet')
  assert.ok(env.includes(`\n${FLAG}="false"\n`) || env.endsWith(`\n${FLAG}="false"`), '.env.example documents the flag as "false"')
  assert.ok(REDEEM_V4_ENV_BLOCK.includes(`${FLAG}="false"`), 'and so does the registered block')
}
await check('the flag is exact "true" (every other spelling is off), read in the lib; the page tests the same name inline around its import() and imports nothing of the view statically; .env.example says "false"', () => proveFlag())

// ---- 2/3. the page flag off, the page flag on --------------------------------------------------------------------------------------------------------------
console.log('2/3. the page, driven: flag off is the base; flag on is the same words, field and request in the v4 frame')
const PURPLE = /purple|violet|indigo|fuchsia|pink|gradient|(?:^|-)(?:from|via|to)-/
const REQUEST_URL = /fetch\('\/api\/coupons\/redeem'/
async function proveBehaviour({ page = read(PAGE), view = read(VIEW) } = {}) {
  const stripped = stripRedeemV4(PAGE, page)
  const [off, offFalse, baseRun, strippedRun, on] = await Promise.all([
    runAll({ flag: undefined, pageText: page, viewText: view }), runAll({ flag: 'false', pageText: page, viewText: view }),
    runAll({ flag: undefined, pageText: BASE_PAGE, viewText: view }), runAll({ flag: undefined, pageText: stripped, viewText: view }), runAll({ flag: 'true', pageText: page, viewText: view }),
  ])
  const names = Object.keys(SCENARIOS)
  // flag off: the base's bytes, state by state; the view and its stylesheet are never loaded
  for (const name of names) {
    for (const [what, run] of [['unset', off], ['"false"', offFalse], ['the stripped page', strippedRun]]) {
      assert.deepEqual(run[name].frames.map(f => f.html), baseRun[name].frames.map(f => f.html), `${name}: flag ${what}: the markup is the base commit's, byte for byte`)
      assert.deepEqual(run[name].log, baseRun[name].log, `${name}: flag ${what}: the same calls as the base`)
    }
    assert.equal(off[name].viewLoaded, false, `${name}: flag off loads no Studio view`); assert.equal(off[name].cssLoaded, 0, `${name}: flag off loads no stylesheet`)
    assert.equal(offFalse[name].viewLoaded, false); assert.equal(offFalse[name].cssLoaded, 0)
  }
  // flag on: the base's words, field, buttons, links and calls, state by state
  for (const name of names) {
    assert.equal(on[name].frames.length, baseRun[name].frames.length, `${name}: as many states`)
    on[name].frames.forEach((frame, i) => {
      const was = baseRun[name].frames[i]
      assert.equal(frame.label, was.label)
      assert.deepEqual(strip(frame), strip(was), `${name} / ${frame.label}: the same words, field, buttons, form and links as the base`)
    })
    assert.deepEqual(on[name].log, baseRun[name].log, `${name}: the same calls as the base, in the same order`)
    assert.equal(on[name].viewLoaded, true, `${name}: flag on loads the view`); assert.ok(on[name].cssLoaded >= 1, `${name}: and its stylesheet`)
  }
  // the look of every flag-on state that draws something
  const drawn = names.flatMap(name => on[name].frames).filter(frame => frame.html !== '')
  assert.ok(drawn.length >= 25, 'many states drawn')
  for (const frame of drawn) {
    const at = `${frame.label}`
    assert.equal(frame.roots, 1, `${at}: one Studio v4 root (data-studio-v4-shell + data-studio-redeem)`)
    assert.deepEqual(frame.imgs, [], `${at}: no image (the old logo and wordmark are gone)`)
    assert.doesNotMatch(frame.html, /logo-icon|logo-wordmark|\.png/, `${at}: no old logo file`)
    assert.deepEqual(frame.classes.filter(c => PURPLE.test(c)), [], `${at}: no purple / gradient class`)
    assert.ok(frame.classes.every(c => /^(?:sr-|lucide)/.test(c)), `${at}: only the view's own classes and the icons': ${frame.classes.filter(c => !/^(?:sr-|lucide)/.test(c)).join(' ')}`)
    assert.doesNotMatch(frame.text.join(' '), /\bdeckster\b/, `${at}: no lowercase deckster`)
  }
  for (const frame of drawn.filter(f => f.forms > 0 || f.buttons.length > 0 || f.label === 'no email')) assert.equal(frame.text[0], 'Deckster', `${frame.label}: the brand is "Deckster", first`)
  const formFrame = on.form.frames[0]
  assert.ok(formFrame.classes.includes('sr-brand-tile') && formFrame.classes.includes('sr-primary') && formFrame.classes.includes('sr-card'), 'the brand tile, the v4 primary button and the card')
  assert.deepEqual(formFrame.links, ['/'], 'the brand still links home')
  const loadFrame = on.loading.frames
  assert.deepEqual(loadFrame.map(f => f.label), ['loading', 'fallback'])
  for (const frame of loadFrame) { assert.deepEqual(frame.text, [], `${frame.label}: the loading state has no words, as before`); assert.ok(frame.classes.includes('sr-spinner') && frame.roots === 1, `${frame.label}: the v4 spinner, in the v4 root`) }
  assert.deepEqual(baseRun.loading.frames.map(f => f.text), [[], []])
  // every word, attribute and button of the base file is drawn somewhere flag on (the list comes from the base's syntax tree)
  assert.ok(BASE_STRINGS.length >= 15, `the base's words were found (${BASE_STRINGS.length})`)
  const shown = new Set(); const inputsSeen = []
  for (const name of names) for (const frame of on[name].frames) { frame.text.forEach(t => shown.add(t)); frame.inputs.forEach(i => inputsSeen.push(i)) }
  const allText = [...shown].join('\n'), placeholders = inputsSeen.map(i => i.placeholder)
  for (const word of BASE_STRINGS) assert.ok(allText.includes(word) || placeholders.includes(word), `flag on shows the base's ${JSON.stringify(word)}`)
  // the field, the button and the form carry the attributes the base gives them
  const view1 = (await openPage({ flag: 'true', pageText: page, viewText: view })); view1.render()
  const has = (el, names) => names.map(n => [n, n in el.props])
  assert.deepEqual(has(view1.form(), BASE_CONTRACT.attrs.form).filter(([, ok]) => !ok), [], 'the form has the base form\'s attributes')
  assert.deepEqual(has(view1.input(), BASE_CONTRACT.attrs.Input).filter(([, ok]) => !ok), [], 'the field has the base field\'s attributes')
  const submit = findEls(view1.form(), e => e.props?.type === 'submit')[0]
  assert.deepEqual(has(submit, BASE_CONTRACT.attrs.Button).filter(([, ok]) => !ok), [], 'the submit button has the base button\'s attributes')
  // the request: one fetch, the base's URL, method, header and body keys; the view makes none
  assert.equal(BASE_CONTRACT.fetchCalls.length, 1); assert.equal(BASE_CONTRACT.fetchCalls[0].url, '/api/coupons/redeem')
  assert.deepEqual(BASE_CONTRACT.fetchCalls[0].props, { method: "'POST'", headers: "{ 'Content-Type': 'application/json' }", body: 'JSON.stringify({ code: code.trim() })' })
  const requests = names.flatMap(name => on[name].log.filter(entry => entry[0] === 'fetch'))
  assert.equal(requests.length, 6, 'one request in each of the six scenarios that redeem')
  for (const [, url, method, headers, body] of requests) { assert.equal(url, '/api/coupons/redeem'); assert.equal(method, 'POST'); assert.equal(headers, '{"Content-Type":"application/json"}'); assert.deepEqual(Object.keys(JSON.parse(body)), ['code']) }
  assert.equal(JSON.parse(on.redeemFails.log.find(e => e[0] === 'fetch')[4]).code, 'AB12', 'the code is upper-cased and trimmed')
  assert.equal((on.redeemFails.log.filter(e => e[0] === 'fetch')).length, 1, 'a second submit while redeeming sends nothing')
  assert.equal(on.emptySubmit.log.filter(e => e[0] === 'fetch').length, 0, 'an empty submit sends nothing')
  const viewCode = view.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(viewCode, /fetch\(|localStorage|useSession|useRouter|useSearchParams|signOut\(|process\.env|useState|useEffect|api\/coupons/, 'the view is only a drawing: no request, no storage, no session, no state, no environment')
  assert.doesNotMatch(viewCode, /dark:|style=\{/, 'no Tailwind dark: classes and no inline style in the view')
}
await check('flag off (unset, "false", stripped page): the markup of 16 scenarios and every call are the base commit\'s, byte for byte, and no Studio view or stylesheet is loaded; flag on: the base\'s words, field, buttons, links and calls state for state, in the v4 root with the brand tile, "Deckster", no purple, no image, the request unchanged', () => proveBehaviour())
await check('the flag turns the page on for the exact value "true" only (every other spelling draws the base page)', async () => {
  const baseShot = await openPage({ flag: undefined, pageText: BASE_PAGE }); baseShot.render()
  const baseHtml = baseShot.html(), baseFrame = frameOf('base', baseHtml)
  assert.equal(baseFrame.roots, 0)
  for (const value of SPELLINGS) {
    const s = await openPage({ flag: value, pageText: read(PAGE) }); s.render()
    const frame = s.snap('form')
    assert.equal(frame.roots, value === 'true' ? 1 : 0, JSON.stringify(value))
    assert.equal(frame.html === baseHtml, value !== 'true', `${JSON.stringify(value)}: the base markup exactly when off`)
  }
})

// ---- 4. the look: the stylesheet -------------------------------------------------------------------------------------------------------------------------
console.log('4. the stylesheet: tokens only, the shell\'s own values, light and dark, a phone')
const LIGHT = '[data-studio-redeem="true"]', DARK = '.dark [data-studio-redeem="true"]'
const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|\b(?:white|black|red|green|blue|purple|violet|pink|indigo|fuchsia|orange|yellow|gray|grey|teal|cyan|magenta)\b/i
const declsOfRule = (rules, selector) => Object.fromEntries(rules.filter(r => r.selector === selector).flatMap(r => r.nodes.filter(n => n.type === 'decl').map(d => [d.prop, d.value])))
const allRules = text => { const out = []; postcss.parse(text).walkRules(rule => out.push(rule)); return out }
function proveCss(cssText = read(CSS)) {
  const root = postcss.parse(cssText), rules = allRules(cssText)
  const light = declsOfRule(rules, LIGHT), dark = declsOfRule(rules, DARK)
  // 4a. no colour literal outside the two token blocks; none of the old look's words anywhere
  root.walkDecls(decl => {
    const inTokens = (decl.parent.selector === LIGHT || decl.parent.selector === DARK) && decl.prop.startsWith('--sr-')
    if (COLOR_LITERAL.test(decl.value.replace(/var\(--[\w-]+/g, 'var('))) assert.ok(inTokens, `a colour literal outside the token blocks: ${decl.parent.selector} { ${decl.prop}: ${decl.value} }`)
    assert.doesNotMatch(`${decl.prop} ${decl.value}`, /purple|violet|indigo|fuchsia|pink|gradient/i, `${decl.prop}: ${decl.value}`)
    assert.ok(!/url\(/.test(decl.value), 'no image in the stylesheet')
  })
  root.walkRules(rule => { assert.doesNotMatch(rule.selector, /purple|gradient/i); if (rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return; assert.match(rule.selector, /\[data-studio-redeem="true"\]/, `every rule is scoped: ${rule.selector}`) })
  // 4b. every token the rules read is declared; light and dark carry the same colour tokens
  const declared = new Set(Object.keys(light)); const used = new Set()
  root.walkDecls(decl => { for (const m of decl.value.matchAll(/var\((--sr-[\w-]+)/g)) used.add(m[1]) })
  for (const name of used) assert.ok(declared.has(name), `${name} is read but never declared`)
  for (const name of Object.keys(light).filter(n => /var\(--ss-/.test(light[n]))) assert.ok(name in dark, `${name} is in the dark block too`)
  assert.ok(Object.keys(dark).length >= 12, 'the dark block carries the colour tokens')
  // 4c. the values are the Studio shell's: each --ss-x fallback is the shell's own --ss-x (light and dark); the brand tile, the card shadow and the danger colour are the shell's, the 404's and the admin pages'
  const shellRules = allRules(read(SHELL_CSS)), shellLight = declsOfRule(shellRules, '[data-studio-v4-shell="true"]'), shellDark = declsOfRule(shellRules, '.dark [data-studio-v4-shell="true"]')
  const fallbackOf = value => /^var\((--ss-[\w-]+),\s*([\s\S]*)\)$/.exec(value)
  let compared = 0
  for (const [block, mine, shell] of [['light', light, shellLight], ['dark', dark, shellDark]]) for (const [name, value] of Object.entries(mine)) {
    const m = fallbackOf(value); if (!m) continue
    assert.equal(m[2].trim(), shell[m[1]], `${block} ${name}: the fallback is the shell's ${m[1]}`); compared++
  }
  assert.ok(compared >= 24, `colour tokens compared with the shell (${compared})`)
  const brand = declsOfRule(shellRules, '[data-studio-v4-rail] .studio-rail-brand')
  assert.equal(light['--sr-brand'], brand.background, 'the brand tile is the rail\'s'); assert.equal(light['--sr-on-brand'], brand.color); assert.equal(light['--sr-brand-shadow'], brand['box-shadow'])
  assert.equal(light['--sr-shadow'], /\[data-studio-problem-card="true"\] \{[^}]*box-shadow: ([^;]+);/.exec(read(HYGIENE))[1], 'the card shadow is the 404 card\'s')
  const adminRules = allRules(read(ADMIN_CSS)); assert.equal(light['--sr-danger'], declsOfRule(adminRules, '[data-studio-p2-admin="true"]')['--sa-danger'], 'danger, light'); assert.equal(dark['--sr-danger'], declsOfRule(adminRules, '.dark [data-studio-p2-admin="true"]')['--sa-danger'], 'danger, dark')
  const palette = new Set((read(SHELL_CSS) + read(HYGIENE) + read(ADMIN_CSS)).match(/#[0-9a-f]{3,8}\b/gi).map(x => x.toLowerCase()))
  for (const value of [...Object.values(light), ...Object.values(dark)]) for (const hex of value.match(/#[0-9a-f]{3,8}\b/gi) ?? []) assert.ok(palette.has(hex.toLowerCase()), `${hex} is not a Studio shell colour`)
  // 4d. a phone (375 wide): a media query for it; no fixed width wider than the card the phone has; wrapping rows; the field and the card fit
  const phone = rules.filter(r => r.parent.type === 'atrule' && r.parent.name === 'media' && /max-width:\s*520px/.test(r.parent.params))
  assert.ok(phone.length >= 5, 'phone rules (max-width: 520px)')
  root.walkDecls(/^(?:width|min-width|flex-basis)$/, decl => { const px = /^(\d+(?:\.\d+)?)px$/.exec(decl.value.trim()); if (px) assert.ok(Number(px[1]) <= 343, `${decl.parent.selector}: ${decl.prop}: ${decl.value} is wider than a 375 phone's card`) })
  const card = declsOfRule(rules, `${LIGHT} .sr-card`); assert.match(card.width, /^min\(\d+px, 100%\)$/, 'the card is min(440px, 100%) wide'); assert.equal(card['min-width'], '0')
  assert.equal(declsOfRule(rules, `${LIGHT} .sr-input`).width, '100%'); assert.equal(declsOfRule(rules, `${LIGHT} .sr-primary`).width, '100%')
  assert.equal(declsOfRule(rules, `${LIGHT} .sr-foot`)['flex-wrap'], 'wrap', 'the signed-in row wraps'); assert.equal(declsOfRule(rules, `${LIGHT} .sr-foot > span`)['overflow-wrap'], 'anywhere', 'a long email wraps')
  assert.equal(light['min-height'], '100dvh'); assert.equal(light['box-sizing'], 'border-box')
  assert.ok(Number.parseInt(declsOfRule(rules, `${LIGHT} .sr-input`)['font-size']) >= 16, 'the field is 16px or more (no zoom on focus on a phone)')
  for (const sel of ['.sr-primary', '.sr-input', '.sr-signout', '.sr-brand']) assert.ok(rules.some(r => r.selector === `${LIGHT} ${sel}:focus-visible`), `${sel} has a visible focus ring`)
  assert.ok(rules.some(r => r.parent.type === 'atrule' && /prefers-reduced-motion/.test(r.parent.params)), 'reduced motion')
}
await check('the stylesheet: colour literals only in the two token blocks and equal to the shell\'s own values (light and dark); no purple or gradient; every token declared; the phone rules (375 wide, no fixed width, wrapping rows, focus rings)', () => proveCss())

// ---- 5. pins ---------------------------------------------------------------------------------------------------------------------------------------------
console.log('5. pins')
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const lineDiff = (before, after) => { const b = before.split('\n'), a = after.split('\n'), out = []; let i = 0, j = 0; while (i < b.length || j < a.length) { if (b[i] === a[j]) { i++; j++ } else if (a[j] !== undefined && !b.slice(i).includes(a[j])) { out.push(`+${a[j++]}`) } else if (b[i] !== undefined && !a.slice(j).includes(b[i])) { out.push(`-${b[i++]}`) } else { out.push(`-${b[i++]}`); out.push(`+${a[j++]}`) } } return out }
function provePins(readNow = read, at = '', later = laterStrips) {
  const a = m => (at ? `${at}: ${m}` : m)
  const now = later(PAGE, readNow(PAGE)), base = baseText(PAGE), marked = now.split('\n').filter(line => REDEEM_V4_MARKER_RE.test(line))
  assert.equal(stripRedeemV4(PAGE, now), base, a('the page without its marked lines is the base\'s, byte for byte'))
  assert.equal(stripRedeemV4(PAGE, stripRedeemV4(PAGE, now)), base, a('stripping twice changes nothing more'))
  assert.equal(marked.length, 6, a('six marked lines'))
  const diff = lineDiff(base, now); assert.deepEqual(diff.filter(l => l.startsWith('-')), [], a('nothing is removed or rewritten')); assert.equal(diff.length, 6, a('six lines are added')); assert.ok(diff.every(l => REDEEM_V4_MARKER_RE.test(l)), a('and each carries the marker'))
  assert.ok(/^import dynamic from 'next\/dynamic'/.test(marked[0]), a('line 1 imports next/dynamic'))
  assert.ok(/^\/\/ REDEEM-V4 \(/.test(marked[1]), a('line 2 is the comment'))
  assert.ok(/^const StudioRedeemV4 = process\.env\.NEXT_PUBLIC_STUDIO_REDEEM_V4 === 'true' \? dynamic\(/.test(marked[2]), a('line 3 is the flag-tested dynamic()'))
  assert.ok(/^  if \(StudioRedeemV4 && status === 'loading'\) return <StudioRedeemV4 phase="loading" \/>/.test(marked[3]), a('line 4 is the loading dispatch'))
  assert.ok(/^  if \(StudioRedeemV4\) return <StudioRedeemV4 phase="form" /.test(marked[4]), a('line 5 is the card dispatch'))
  assert.ok(/^  if \(StudioRedeemV4\) return <Suspense fallback=\{<StudioRedeemV4 phase="loading" \/>\}><RedeemContent \/><\/Suspense>/.test(marked[5]), a('line 6 is the Suspense dispatch'))
  assert.doesNotMatch(marked.slice(3).join('\n').replace(/\/\/.*$/gm, ''), /process\.env/, a('the dispatches read no environment (line 3 does, once)'))
  // the dispatches follow the last hook (Rules of Hooks): the loading and card dispatches sit after every useState / useEffect of RedeemContent
  const lastHook = Math.max(now.lastIndexOf('useState('), now.lastIndexOf('useEffect('), now.lastIndexOf('useSession()'), now.lastIndexOf('useSearchParams()'), now.lastIndexOf('useRouter()'))
  assert.ok(now.indexOf(marked[3]) > lastHook && now.indexOf(marked[4]) > lastHook, a('the dispatches come after the last hook'))
  assert.ok(now.indexOf(marked[3]) < now.indexOf("  if (status === 'loading') {") && now.indexOf(marked[4]) > now.indexOf('const tierMismatch') && now.indexOf(marked[4]) < now.indexOf('  return (\n    <div className="min-h-screen bg-gradient'), a('the loading dispatch is before the old spinner; the card dispatch is after the signed-out redirect and before the old card'))
  // the card dispatch hands over the page's own state and handlers, nothing else
  const props = [...marked[4].matchAll(/ (\w+)=\{/g)].map(m => m[1])
  assert.deepEqual(props, ['email', 'planLabel', 'success', 'successLabel', 'tierMismatch', 'code', 'setCode', 'error', 'setError', 'isRedeeming', 'onSubmit', 'onSignOut'], a('the props handed to the view'))
  assert.ok(marked[4].includes('onSubmit={handleRedeem}') && marked[4].includes("onSignOut={() => signOut({ callbackUrl: '/' })}") && marked[4].includes('setCode={setCode}') && marked[4].includes('setError={setError}'), a('the view gets the page\'s own handlers'))
  for (const rel of REDEEM_V4_PIN_FILES) {
    const text = later(rel, readNow(rel)), was = baseText(rel)
    assert.equal(stripRedeemV4(rel, text), was, a(`${rel}: an older proof taught: put back it is the base's, byte for byte`))
    assert.equal(stripRedeemV4(rel, stripRedeemV4(rel, text)), was, a(`${rel}: put back twice changes nothing more`))
    for (const [has, wasText] of REDEEM_V4_PIN_EDITS[rel]) { assert.equal(text.split(has).length - 1, 1, a(`${rel}: a taught line is there exactly once`)); for (const line of has.split('\n').filter(Boolean)) assert.ok(line.includes(REDEEM_V4_PIN_MARK), a(`${rel}: a taught line carries the registry-read mark`)); assert.ok(!wasText.includes(REDEEM_V4_PIN_MARK)) }
    const added = lineDiff(was, text).filter(l => l.startsWith('+')); assert.equal(added.length, 1, a(`${rel}: one line is added`)); assert.ok(added.every(l => l.includes(REDEEM_V4_PIN_MARK)), a(`${rel}: and it carries the mark`))
  }
  for (const rel of [LIB, ...REDEEM_V4_NEW_FILES]) assert.doesNotMatch(readNow(rel), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, `${rel}: no secret-shaped literal`)
}
await check('the page without its six marked lines is the base\'s, byte for byte (idempotent); pure insertions after the last hook, handing over the page\'s own state and handlers; the older proofs taught put back to the base', () => { provePins() })
await check('the strip is plain data: nothing but the marker, the lists and the functions; any other file comes back untouched; the registry holds the strip, the block and every file', () => {
  const text = read('scripts/studio-redeem-v4-strip.mjs')
  assert.doesNotMatch(text.replace(/\/\/.*$/gm, ''), /^import |require\(|readFileSync|execFileSync/m, 'no imports, nothing read from disk or git')
  assert.equal(stripRedeemV4('app/builder/page.tsx', 'x // REDEEM-V4\n'), 'x // REDEEM-V4\n', 'a file this change does not own is returned as it is')
  assert.equal(stripRedeemV4(PAGE, 'a\nb // REDEEM-V4-X\nc // X-REDEEM-V4\nd // REDEEM-V3\n'), 'a\nb // REDEEM-V4-X\nc // X-REDEEM-V4\nd // REDEEM-V3\n', 'the marker is a whole token')
  assert.equal(stripRedeemV4(PAGE, 1), 1)
  assert.ok(registry.LATER_STRIPS.includes(stripRedeemV4) && registry.LATER_ENV_BLOCKS.includes(REDEEM_V4_ENV_BLOCK) && [...REDEEM_V4_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'the registry holds the strip, the block and every file')
  assert.equal(registry.stripLaterChanges(PAGE, read(PAGE)), baseText(PAGE), 'through the whole registry the page is the base\'s')
})

// ---- 6. scope --------------------------------------------------------------------------------------------------------------------------------------------
console.log('6. scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-04T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-04T00:00:00Z' }
const plumb = (args, env = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT, ...env }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`: a large input through a stdin pipe once left a git child waiting forever in another proof's run): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rv4-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => subject.startsWith(REDEEM_V4_SUBJECT)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees none of them on the gate's merge. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  On a branch (HEAD is this change's tip, or a merge of dev INTO it) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim(), parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude (?:Sonnet|Opus) 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  return own
}
const scopeCommittedFiles = head => {
  const own = scopeOwnCommits(head), touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)
  assert.deepEqual([...touched].sort(), [...REDEEM_V4_SCOPE_FILES].sort(), 'the files this change\'s own commits touch (net of what they put back) are exactly its scope')
  assert.deepEqual([...net].sort(), [...REDEEM_V4_SCOPE_FILES].sort(), 'and the whole committed diff from BASE is nothing else')
  for (const rel of REDEEM_V4_FILES) {
    const now = git('show', `${head}:${rel}`), diff = lineDiff(baseText(rel), now)
    assert.ok(diff.length === 6 && diff.every(line => line.startsWith('+') && REDEEM_V4_MARKER_RE.test(line)), `${rel}: six added lines, each with the marker, none removed`)
    assert.equal(stripRedeemV4(rel, now), baseText(rel), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of REDEEM_V4_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of REDEEM_V4_PIN_FILES) assert.equal(stripRedeemV4(rel, git('show', `${head}:${rel}`)), baseText(rel), `${rel}: an older proof taught: put back it is the base's`)
  for (const rel of ['app/api/coupons/redeem/route.ts', 'lib/wallet.ts', 'lib/config.ts', 'components/ui/button.tsx', 'components/ui/input.tsx', 'components/ui/card.tsx', 'app/layout.tsx', 'app/globals.css', 'components/layout/studio-shell.css', 'components/builder/studio-session-hygiene-styles.ts',
    'components/admin/studio-p2-admin.css', 'package.json', 'middleware.ts', 'scripts/test-studio-p2-admin.mjs', 'scripts/test-studio-payments-open-soon.mjs']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = head => {
  const envText = git('show', `${head}:.env.example`), baseEnv = baseText('.env.example')
  assert.equal(registry.stripLaterEnvBlocks('.env.example', envText), registry.stripLaterEnvBlocks('.env.example', baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(envText.split(REDEEM_V4_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(envText, new RegExp(`\\n\\n${REDEEM_V4_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  assert.ok(envText.endsWith(REDEEM_V4_ENV_BLOCK), 'the block is the last in the file (after the last one)')
  assert.equal(envText, `${baseEnv}\n${REDEEM_V4_ENV_BLOCK}`, 'and .env.example is the base plus one blank line plus the block, nothing else')
  assert.ok(REDEEM_V4_ENV_BLOCK.includes(`${REDEEM_V4_FLAG}="false"`), 'the flag is documented as off')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const own = diff.filter(line => line.includes('studio-redeem-v4-strip.mjs'))
  assert.equal(own.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of own) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(own.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['REDEEM_V4_SCOPE_FILES', 'REDEEM_V4_ENV_BLOCK', 'stripRedeemV4'])
  assert.equal(diff.length, 3, 'and nothing else in the registry')
}
const scopeAll = head => { scopeOwnCommits(head); scopeCommittedFiles(head); scopeEnvAndRegistry(head) }

const HEAD = scopeHead('HEAD')
/** This change's own commits on the FIRST-PARENT line of `head` from BASE. Merged into dev, its commits come in by a merge's second parent and that line has none of them: dev past the merge, a branch stacked after this change, a later change's gate merge. */
const ownOnLine = head => git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** There the committed diff from BASE holds the later changes' work too, so the scope checks stand down; the pins above (read past the later changes' strips) and every other section still run. On this change's own branch, and on its gate merge through HEAD^2, they all run. */
const ON_OWN_LINE = ownOnLine(HEAD).length > 0
const scopeCheck = (label, fn) => (ON_OWN_LINE ? check(label, fn) : undefined)
if (!ON_OWN_LINE) console.log('NOTE scope: no commit of this change on the first-parent line from BASE (merged into dev: its commits are on a second parent); the scope checks stand down, the pins above cover the files')
await scopeCheck(`this change's own commits (subject starts "${REDEEM_V4_SUBJECT}", found across the whole line, no merges) exist, with the co-author line`, () => { scopeOwnCommits(HEAD) })
await scopeCheck('the committed files are exactly this change\'s; every line added to the page is a marked pure insertion; the strip gives the base back byte for byte; the request route, the shell, the admin css, the ui components and the layout are not touched', () => scopeCommittedFiles(HEAD))
await scopeCheck('.env.example is the base plus one blank line and the block (the last in the file); the registry gains exactly its three marked lines and loses none', () => scopeEnvAndRegistry(HEAD))
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = gateMerge(BASE_COMMIT, HEAD)
await scopeCheck('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE)
  for (const rel of REDEEM_V4_FILES) assert.equal(stripRedeemV4(rel, git('show', `${GATE}:${rel}`)), baseText(rel), `the merged tree, without this change's lines, is the base's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await scopeCheck('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rv4-idx-'))
  try {
    const envIdx = { GIT_INDEX_FILE: path.join(dir, 'index') }
    plumb(['read-tree', parent], envIdx)
    for (const [rel, text] of Object.entries(edits)) plumb(['update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`], envIdx)
    return plumb(['commit-tree', plumb(['write-tree'], envIdx), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
const unrelated = commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE')
const ADVANCED_GATE = gateMerge(unrelated, HEAD)
await scopeCheck('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE: the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
await scopeCheck('mutant caught: a stray file in a "Redeem v4:" commit, an own commit without the co-author line, an unmarked line added to the page, and a touched foreign file (the request route, the shell css) fail the scope', () => {
  const stray = commitWith(HEAD, { 'stray-redeem-v4.txt': 'stray\n' }, `${REDEEM_V4_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray)); assert.doesNotThrow(() => scopeCommittedFiles(HEAD)); assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/)
  const noTrailer = commitWith(HEAD, {}, `${REDEEM_V4_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  for (const rel of REDEEM_V4_FILES) {
    const sneaky = commitWith(HEAD, { [rel]: git('show', `${HEAD}:${rel}`).replace(/^(import [^\n]*\n)/m, '$1const sneaky = 1\n') }, `${REDEEM_V4_SUBJECT} a sneaky line${TRAILER}`)
    assert.throws(() => scopeCommittedFiles(sneaky), /six added lines|exactly its scope/, rel)
  }
  for (const rel of ['app/api/coupons/redeem/route.ts', 'components/layout/studio-shell.css']) {
    const foreign = commitWith(HEAD, { [rel]: git('show', `${HEAD}:${rel}`) + '\n' }, `${REDEEM_V4_SUBJECT} touches ${rel}${TRAILER}`)
    assert.throws(() => scopeCommittedFiles(foreign), /exactly its scope|is not touched/, rel)
  }
})

// a branch stacked after this change: dev's merge brings it in by its SECOND parent, then a later change adds its own subject filter beside this change's in a taught proof
const SYN = { file: 'scripts/test-studio-deck-sync-truth.mjs', mark: 'registry read (SYNTHETIC-LATER)' }
const synStrip = (rel, text) => (rel === SYN.file && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.mark)).join('\n') : text)
const stackedAfter = () => {
  const dev = gateMerge(BASE_COMMIT, HEAD), taught = git('show', `${dev}:${SYN.file}`).split('\n')
  const at = taught.findIndex(line => line.includes('registry read (REDEEM-V4)')); assert.ok(at > 0, 'this change\'s subject filter is in the taught proof')
  taught.splice(at + 1, 0, `  shas.splice(0, shas.length, ...shas.filter(sha => !/^Synthetic later:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: ${SYN.mark}: a made-up change stacked after this one`)
  return commitWith(dev, { [SYN.file]: taught.join('\n') }, `Synthetic later: a change stacked after this one${TRAILER}`)
}
await scopeCheck('ROBUST AFTER MERGE: on a branch stacked after this change (dev\'s merge brings it in by a second parent, then a later change adds its subject filter beside this one\'s in a taught proof) no own commit is on the first-parent line, so the scope checks stand down there, and the pins, read past the later change\'s strip, still pass', () => {
  const later = stackedAfter(), readAt = rel => git('show', `${later}:${rel}`)
  assert.equal(ownOf(later).length, ownOf(HEAD).length, 'this change\'s commits are all there, by the second parent'); assert.deepEqual(ownOnLine(later), [], 'none of them on the first-parent line')
  provePins(readAt, 'stacked after', (rel, text) => synStrip(rel, laterStrips(rel, text)))
  assert.throws(() => provePins(readAt, 'stacked after, not told', laterStrips), /put back it is the base's/, 'mutant caught: without the later change\'s strip, its line breaks the put-back')
})

// ---- 7. mutants ------------------------------------------------------------------------------------------------------------------------------------------
console.log('7. mutants (each one edit of the real sources, fed to the same checks)')
const pageSrc = read(PAGE), viewSrc = read(VIEW), cssSrc = read(CSS), libSrc = read(LIB), envSrc = read('.env.example')
const FLAG_TEST = "process.env.NEXT_PUBLIC_STUDIO_REDEEM_V4 === 'true' ? dynamic("
const behave = make => () => proveBehaviour(make())
await mutant('the flag is read as truthy, not exactly "true" (the lib)', () => proveFlag({ lib: swap(libSrc, "export const STUDIO_REDEEM_V4_ENABLED = process.env.NEXT_PUBLIC_STUDIO_REDEEM_V4 === 'true'", 'export const STUDIO_REDEEM_V4_ENABLED = !!process.env.NEXT_PUBLIC_STUDIO_REDEEM_V4') }))
await mutant('the flag function is read as truthy (the lib)', () => proveFlag({ lib: swap(libSrc, "return env[STUDIO_REDEEM_V4_FLAG] === 'true'", 'return Boolean(env[STUDIO_REDEEM_V4_FLAG])') }))
await mutant('the lib names another variable', () => proveFlag({ lib: swap(libSrc, "'NEXT_PUBLIC_STUDIO_REDEEM_V4'", "'NEXT_PUBLIC_STUDIO_REDEEM'") }))
await mutant('the page tests the flag as truthy (a "false" turns the view on)', behave(() => ({ page: swap(pageSrc, FLAG_TEST, "process.env.NEXT_PUBLIC_STUDIO_REDEEM_V4 ? dynamic(") })))
await mutant('the page tests the flag as truthy (the inline test is not exact "true")', () => proveFlag({ page: swap(pageSrc, FLAG_TEST, "process.env.NEXT_PUBLIC_STUDIO_REDEEM_V4 ? dynamic(") }))
await mutant('the page is on by default (no flag needed)', behave(() => ({ page: swap(pageSrc, FLAG_TEST, "true ? dynamic(") })))
await mutant('the page imports the view statically (the build could not drop it)', () => proveFlag({ page: swap(pageSrc, "import dynamic from 'next/dynamic' // REDEEM-V4\n", "import dynamic from 'next/dynamic' // REDEEM-V4\nimport { StudioRedeemView } from '@/components/studio-redeem' // REDEEM-V4\n") }))
await mutant('the page imports the stylesheet itself (flag off would link it)', () => proveFlag({ page: swap(pageSrc, "import dynamic from 'next/dynamic' // REDEEM-V4\n", "import dynamic from 'next/dynamic' // REDEEM-V4\nimport '@/components/studio-redeem.css' // REDEEM-V4\n") }))
await mutant('the page reads a second variable', () => proveFlag({ page: swap(pageSrc, "export default function RedeemPage() {\n", "export default function RedeemPage() {\n  const other = process.env.NEXT_PUBLIC_SOMETHING_ELSE // REDEEM-V4\n") }))
await mutant('the flag is documented as on in .env.example', () => proveFlag({ env: envSrc.replace('NEXT_PUBLIC_STUDIO_REDEEM_V4="false"', 'NEXT_PUBLIC_STUDIO_REDEEM_V4="true"') }))
await mutant('the page changes the request body (flag off)', behave(() => ({ page: swap(pageSrc, 'JSON.stringify({ code: code.trim() })', 'JSON.stringify({ coupon: code.trim() })') })))
await mutant('the page changes an old string (flag off)', behave(() => ({ page: swap(pageSrc, "'Enter your access coupon'", "'Enter your coupon'") })))
await mutant('the card dispatch forgets the page\'s submit handler', behave(() => ({ page: swap(pageSrc, 'onSubmit={handleRedeem} onSignOut', 'onSignOut') })))
await mutant('the card dispatch hands over a different sign-out', behave(() => ({ page: swap(pageSrc, "onSignOut={() => signOut({ callbackUrl: '/' })}", "onSignOut={() => signOut()}") })))
await mutant('the card dispatch forgets the tier note', behave(() => ({ page: swap(pageSrc, 'tierMismatch={tierMismatch} ', '') })))
await mutant('the Suspense fallback is dropped (the purple spinner shows first)', behave(() => ({ page: swap(pageSrc, pageSrc.split('\n').find(l => l.startsWith('  if (StudioRedeemV4) return <Suspense')) + '\n', '') })))
await mutant('a marker line is mistyped (the strip would leave it behind)', () => provePins(rel => rel === PAGE ? swap(pageSrc, "import dynamic from 'next/dynamic' // REDEEM-V4", "import dynamic from 'next/dynamic' // REDEEM-V3") : read(rel)))
await mutant('an existing line of the page is changed (not a pure insertion)', () => provePins(rel => rel === PAGE ? swap(pageSrc, "setTimeout(() => router.push('/builder'), 1200)", "setTimeout(() => router.push('/builder'), 1500)") : read(rel)))
await mutant('a seventh marked line is added', () => provePins(rel => rel === PAGE ? swap(pageSrc, "import { Input } from '@/components/ui/input'\n", "import { Input } from '@/components/ui/input'\nimport './x.css' // REDEEM-V4\n") : read(rel)))
await mutant('a dispatch is moved above the last hook (Rules of Hooks)', () => provePins(rel => {
  if (rel !== PAGE) return read(rel)
  const line = pageSrc.split('\n').find(l => l.startsWith("  if (StudioRedeemV4 && status === 'loading')"))
  return swap(swap(pageSrc, line + '\n', ''), '  useEffect(() => {\n    // Only auto-redirect', line + '\n  useEffect(() => {\n    // Only auto-redirect')
}))
await mutant('the view draws a purple class', behave(() => ({ view: swap(viewSrc, 'className="sr-primary"', 'className="sr-primary bg-purple-600"') })))
await mutant('the view draws a gradient class', behave(() => ({ view: swap(viewSrc, 'className="sr-card"', 'className="sr-card bg-gradient-to-br from-purple-50"') })))
await mutant('the view draws the old wordmark image', behave(() => ({ view: swap(viewSrc, '<span className="sr-brand-name">Deckster</span>', '<img src="/logo-wordmark.png" alt="Deckster" />') })))
await mutant('the view spells the brand in lower case', behave(() => ({ view: swap(viewSrc, '<span className="sr-brand-name">Deckster</span>', '<span className="sr-brand-name">deckster</span>') })))
await mutant('the view loses the brand tile', behave(() => ({ view: swap(viewSrc, 'className="sr-brand-tile"', 'className="sr-brand-tile-x"') })))
await mutant('the view changes a word (the redirect line)', behave(() => ({ view: swap(viewSrc, '<p>Redirecting to the builder...</p>', '<p>Redirecting...</p>') })))
await mutant('the view changes the placeholder', behave(() => ({ view: swap(viewSrc, 'placeholder="e.g. WELCOME50"', 'placeholder="Coupon code"') })))
await mutant('the view changes the button label', behave(() => ({ view: swap(viewSrc, '                    "Redeem Coupon"\n', '                    "Redeem"\n') })))
await mutant('the view drops the tier note', behave(() => ({ view: swap(viewSrc, '{tierMismatch && (', '{false && tierMismatch && (') })))
await mutant('the view formats the credits another way', behave(() => ({ view: swap(viewSrc, '(success.creditedCents / 100).toFixed(2)', '(success.creditedCents / 100).toFixed(0)') })))
await mutant('the view no longer upper-cases the code', behave(() => ({ view: swap(viewSrc, 'e.target.value.toUpperCase()', 'e.target.value') })))
await mutant('the view no longer clears the error when typing', behave(() => ({ view: swap(viewSrc, '      setError?.(null)\n', '') })))
await mutant('the submit button is never disabled', behave(() => ({ view: swap(viewSrc, 'disabled={!code.trim() || isRedeeming}', 'disabled={false}') })))
await mutant('the field is not disabled while redeeming', behave(() => ({ view: swap(viewSrc, '                    disabled={isRedeeming}\n', '') })))
await mutant('the form has no submit handler', behave(() => ({ view: swap(viewSrc, '<form onSubmit={onSubmit} className="sr-form">', '<form className="sr-form">') })))
await mutant('sign out is not wired', behave(() => ({ view: swap(viewSrc, 'onClick={onSignOut}', 'onClick={undefined}') })))
await mutant('the field loses its autofocus', behave(() => ({ view: swap(viewSrc, '                    autoFocus\n', '') })))
await mutant('the view makes its own request', behave(() => ({ view: swap(viewSrc, 'export function StudioRedeemView(props: StudioRedeemViewProps) {\n', 'export function StudioRedeemView(props: StudioRedeemViewProps) {\n  void fetch("/api/coupons/redeem", { method: "POST", headers: {}, body: "{}" })\n') })))
await mutant('the view keeps its own state', behave(() => ({ view: swap(viewSrc, 'import type { FormEvent } from "react"\n', 'import { useState, type FormEvent } from "react"\n') })))
await mutant('the signed-in row is lost', behave(() => ({ view: swap(viewSrc, '<span>Signed in as {email}</span>', '<span>{email}</span>') })))
await mutant('the heading shows the wrong plan', behave(() => ({ view: swap(viewSrc, '`Activate your ${planLabel} plan`', '`Activate your ${tierMismatch} plan`') })))
await mutant('the root loses the v4 marker', behave(() => ({ view: swap(viewSrc, 'data-studio-v4-shell="true" data-studio-redeem="true" data-studio-redeem-phase="form"', 'data-studio-redeem="true" data-studio-redeem-phase="form"') })))
await mutant('the loading state draws words', behave(() => ({ view: swap(viewSrc, '<div className="sr-spinner" />', '<div className="sr-spinner">Loading</div>') })))
await mutant('a purple colour literal in a rule', () => proveCss(swap(cssSrc, '.sr-badge { display: grid;', '.sr-badge { color: #7e22ce; display: grid;')))
await mutant('a purple colour literal in a token that is not the shell\'s', () => proveCss(swap(cssSrc, '--sr-accent: var(--ss-accent, #6a4fc0);', '--sr-accent: var(--ss-accent, #7e22ce);')))
await mutant('a token fallback that is not the shell\'s value', () => proveCss(swap(cssSrc, '--sr-frame: var(--ss-frame, #e8f0ed);', '--sr-frame: var(--ss-frame, #e8f0ee);')))
await mutant('a dark token fallback that is not the shell\'s value', () => proveCss(swap(cssSrc, '--sr-frame: var(--ss-frame, #1a2624);', '--sr-frame: var(--ss-frame, #1a2625);')))
await mutant('a gradient in a rule', () => proveCss(swap(cssSrc, '.sr-badge { display: grid;', '.sr-badge { background: linear-gradient(var(--sr-soft), var(--sr-active)); display: grid;')))
await mutant('a named colour in a rule', () => proveCss(swap(cssSrc, '.sr-title { font-size: 24px;', '.sr-title { color: white; font-size: 24px;')))
await mutant('a rule reads a token nobody declared', () => proveCss(swap(cssSrc, 'background: var(--sr-soft); color: var(--sr-text); }', 'background: var(--sr-nope); color: var(--sr-text); }')))
await mutant('the dark block loses a colour token', () => proveCss(swap(cssSrc, '--sr-frame: var(--ss-frame, #1a2624); ', '')))
await mutant('the brand tile is another purple', () => proveCss(swap(cssSrc, '--sr-brand: #6a4fc0;', '--sr-brand: #7e22ce;')))
await mutant('the card is a fixed 500px wide (a phone would scroll sideways)', () => proveCss(swap(cssSrc, 'width: min(440px, 100%); min-width: 0;', 'width: 500px; min-width: 0;')))
await mutant('the signed-in row does not wrap', () => proveCss(swap(cssSrc, '.sr-foot { display: flex; flex-wrap: wrap;', '.sr-foot { display: flex; flex-wrap: nowrap;')))
await mutant('a long email does not wrap', () => proveCss(swap(cssSrc, '.sr-foot > span { min-width: 0; overflow-wrap: anywhere; }', '.sr-foot > span { min-width: 0; }')))
await mutant('the field is 14px (iOS zooms on focus)', () => proveCss(swap(cssSrc, 'font-size: 18px; font-weight: 500; letter-spacing: .12em;', 'font-size: 14px; font-weight: 500; letter-spacing: .12em;')))
await mutant('a rule that is not scoped to the page', () => proveCss(`${cssSrc}\n.sr-card { border-radius: 0; }\n`))
await mutant('the stylesheet pulls in an image', () => proveCss(swap(cssSrc, '.sr-badge { display: grid;', '.sr-badge { background-image: url(/x.png); display: grid;')))
await mutant('the phone rules are gone', () => proveCss(swap(cssSrc, '@media (max-width: 520px) {', '@media (max-width: 521px) {')))

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
console.log('test-studio-redeem-v4: all checks passed; no network.')
