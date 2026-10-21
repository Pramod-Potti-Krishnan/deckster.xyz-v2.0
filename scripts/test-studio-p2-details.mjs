// PASS2 Your details (FRONTEND-1): the page as the accepted v4 mockup has it, wired to the open deck's EXISTING footer and logo, plus the shell cues (DET-12).
// Flag NEXT_PUBLIC_STUDIO_P2_DETAILS (exact "true"), default off; the page part also needs the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL "true", which the page itself requires).
//   DET-01 (build, limited) "This presentation" is wired to the deck's existing footer / logo: read on load, written back by "Save to this presentation" (Layout PUT .../derivative-elements).
//          "Reusable defaults" has no storage (backlog): it is not offered, nothing is saved anywhere but the deck.
//   DET-02 underline tabs and names: Account (kept first), Profile, Slide details    DET-03 the complete presenter fields (title, organization, contact email, website, confidentiality, https Logo URL)
//   DET-04 (build, limited) Show footer, Date, the four preset buttons and "Insert a field" (every field it inserts reaches the deck: Layout's five tokens as tokens, the rest as literal text)
//   DET-06 the never-working "Save as defaults" is gone; Save writes to the deck                DET-12 "+ Presentation" in the library top bar, the rail's teal current-page bar and brand divider
//
// Run: node scripts/test-studio-p2-details.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   P2_DETAILS_BASE=<commit> overrides the base commit flag-off identity is checked against (default 70b9277, the studio-v4-dev-preparation-code tip the work was rebased onto).
//
// Proven on the REAL sources:
//   1. lib/studio-details.ts: import-free; footer resolution, preview text, validation, the merge into the deck's derivative elements, "would saving change the deck", the draft a deck starts from, which presentation a session shows;
//   2. the page (executed with a hook stub and a fake fetch): tabs and keyboard, fields, presets and chips, the exact requests (read the session, read the deck, PUT the merge), every state (no deck, loading, error, saved, failed);
//   3. the wiring: flag off = the base commit's tree (source with the flagged lines removed equals the base file, and the executed header / rail match), flag on = the page, the link, the rail marker;
//   4. the CSS: every rule scoped to the page's / shell's own markers, tokens only (and every token exists);
//   5. env + package registration;
//   6. mutation check: every mutant of the sources is killed by sections 1-5.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const BASE_COMMIT = process.env.P2_DETAILS_BASE || '70b9277c5e210f120a209fe572ca4f013247d403'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const baseCache = new Map()
const baseSource = rel => {
  if (!baseCache.has(rel)) {
    try { baseCache.set(rel, execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })) }
    catch (error) { throw new Error(`base commit ${BASE_COMMIT} is not in this clone (fetch the full history): ${error.message}`) }
  }
  return baseCache.get(rel)
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside the vm carry its realm's prototypes
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deepEq = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message))

const LIB = 'lib/studio-details.ts'
const UI = 'components/studio-personal/studio-p2-details.tsx'
const DETAILS = 'components/studio-personal/details-workspace.tsx'
const HEADER = 'components/layout/app-header.tsx'
const RAIL = 'components/layout/studio-rail.tsx'
const CSS_PAGE = 'components/studio-personal/studio-p2-details.css'
const CSS_SHELL = 'components/layout/studio-p2-shell.css'
const CSS_BASE = 'components/studio-personal/personal-workspaces.css'
const SHELL_CSS = 'components/layout/studio-shell.css'
const ENV = '.env.example'
const PKG = 'package.json'
const SOURCES = Object.fromEntries([LIB, UI, DETAILS, HEADER, RAIL, CSS_PAGE, CSS_SHELL, ENV, PKG].map(rel => [rel, read(rel)]))
const FLAG = 'NEXT_PUBLIC_STUDIO_P2_DETAILS'

// ---------------------------------------------------------------- loading
const jsx = (type, props, key) => ({ type, props: props ?? {}, ...(key === undefined ? {} : { key }) })
const JSX_RUNTIME = { jsx, jsxs: jsx, Fragment: 'Fragment' }
const names = new Proxy({}, { get: (_target, key) => key })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : []
const rawText = value => Array.isArray(value) ? value.map(rawText).join(value.every(x => x == null || typeof x !== 'object') ? '' : ' ') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? rawText(value.props?.children) : String(value)
const text = value => rawText(value).replace(/\s+/g, ' ').trim()
const rendered = value => JSON.stringify(value, (key, item) => key === 'children' && Array.isArray(item) ? item.filter(x => x !== false && x !== undefined && x !== null) : typeof item === 'function' ? '[fn]' : item)
const isElement = value => value && typeof value === 'object' && 'type' in value && 'props' in value
const expand = value => Array.isArray(value) ? value.map(expand) : isElement(value) ? (typeof value.type === 'function' ? expand(value.type(value.props)) : { type: value.type, props: Object.fromEntries(Object.entries(value.props).map(([k, v]) => [k, k === 'children' ? expand(v) : v])) }) : value
const compileCache = new Map()
const compile = (source, fileName) => {
  const key = `${fileName}\0${source}`
  if (!compileCache.has(key)) {
    const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
    assert.equal((out.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0, `${fileName} compiles`)
    compileCache.set(key, out.outputText)
  }
  return compileCache.get(key)
}
function load(source, fileName, { deps = {}, env = {}, globals = {} } = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile(source, fileName), { module, exports: module.exports, process: { env }, Date, Object, JSON, Promise, URLSearchParams, encodeURIComponent, String, Array, Boolean, Math, ...globals, require: name => {
    if (name in deps) return deps[name]
    if (name === 'react/jsx-runtime') return JSX_RUNTIME
    if (name.endsWith('.css')) return {}
    if (name === 'lucide-react' || name.startsWith('@/components/') || name.startsWith('./') || name.startsWith('../') || name === 'next/link') return names
    assert.fail(`Unexpected import ${name} in ${fileName}`)
  } })
  return module.exports
}
function makeReact() {
  const slots = [], effects = []; let cursor = 0
  return {
    reset() { cursor = 0 },
    flushEffects() { while (effects.length) { const [i, fn] = effects.shift(); if (typeof slots[i].cleanup === 'function') slots[i].cleanup(); slots[i].cleanup = fn() } },
    unmount() { for (const slot of slots) if (slot && typeof slot.cleanup === 'function') { slot.cleanup(); slot.cleanup = undefined } },
    api: {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }] },
      useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
      useId() { const i = cursor++; return slots[i] ||= `:r${i}:` },
      useCallback: fn => fn,
      useMemo: fn => fn(),
      useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || !deps || deps.some((x, index) => x !== previous.deps[index])) { slots[i] = { deps, cleanup: previous?.cleanup }; effects.push([i, fn]) } },
    },
  }
}
const attempt = fn => { try { return fn() } catch (error) { return { threw: String(error) } } } // a mutant that crashes must fail an assertion, not the run
const tick = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)) }

// ---------------------------------------------------------------- 1. the lib
const NOW = new Date(2026, 9, 21)
const ADA = 'Ada Morgan'
const frozen = value => JSON.parse(JSON.stringify(value))
function proveLib(source, label = 'lib') {
  nomatch(source, /^\s*(?:import\b|export\s+\*?\s*from\b)|require\(/m, `${label}: import-free`)
  const lib = load(source, LIB)
  const draft = (over = {}) => ({ ...lib.studioDetailsInitial(ADA), ...over })
  const footer = (over, now = NOW) => attempt(() => lib.studioDetailsDeckFooter(draft(over), now))
  // words and lists
  eq(lib.STUDIO_DETAILS_WORDS.save, 'Save to this presentation', `${label}: the save button's words`)
  eq(lib.STUDIO_DETAILS_WORDS.scope, 'This presentation', `${label}: the one scope`)
  ok(!JSON.stringify(lib.STUDIO_DETAILS_WORDS).includes('defaults'), `${label}: no words for reusable defaults`)
  deepEq(lib.STUDIO_DETAILS_FOOTER_PRESETS, [{ label: 'Page only', value: '{page}' }, { label: 'Page X of Y', value: 'Page {page} of {total}' }, { label: 'Title + Page', value: '{title} | {page}' }, { label: 'Author + role', value: '{author} · {role} · {company} | {page}/{total}' }], `${label}: the mockup's four presets, in its order`)
  deepEq(lib.STUDIO_DETAILS_FIELD_TOKENS, ['author', 'role', 'company', 'title', 'date', 'page', 'total', 'confidentiality', 'email', 'website'], `${label}: Insert a field offers the mockup's ten fields`)
  eq(lib.STUDIO_DETAILS_FOOTER_MAX, 200, `${label}: Layout's footer template limit`)
  deepEq(lib.studioDetailsInitial(ADA), { author: ADA, role: '', company: '', email: '', website: '', confidentiality: '', logoUrl: '', date: '', footer: '{author} · {role} · {company} | {page}/{total}', showFooter: true }, `${label}: the starting draft is the mockup's`)
  eq(lib.studioDetailsInitial(undefined).author, '', `${label}: no account name, no author`)
  eq(lib.studioDetailsInitial(42).author, '', `${label}: a non-string name is no author`)
  // auto date
  for (const [month, want] of [[0, 'Jan 2026'], [4, 'May 2026'], [9, 'Oct 2026'], [11, 'Dec 2026']]) eq(lib.studioDetailsAutoDate(new Date(2026, month, 5)), want, `${label}: auto date for month ${month}`)
  // footer resolution
  deepEq(footer({}), { template: '{author} · {page}/{total}', values: { author: ADA } }, `${label}: empty role and organization drop out with their separators`)
  deepEq(footer({ role: 'CTO', company: 'Northwind' }), { template: '{author} · CTO · Northwind · {page}/{total}', values: { author: ADA } }, `${label}: filled details become literal text, "|" reads as " · "`)
  deepEq(footer({ role: '  CTO  ', company: ' Northwind ' }), { template: '{author} · CTO · Northwind · {page}/{total}', values: { author: ADA } }, `${label}: details are trimmed`)
  deepEq(footer({ author: '' }), { template: '{page}/{total}', values: {} }, `${label}: no author: the token goes and nothing is saved for it`)
  deepEq(footer({ author: '   ' }), { template: '{page}/{total}', values: {} }, `${label}: a blank author is no author`)
  deepEq(footer({ author: '  Ada  ' }), { template: '{author} · {page}/{total}', values: { author: 'Ada' } }, `${label}: the author is trimmed`)
  eq(footer({ showFooter: false }), null, `${label}: footer hidden: nothing to write`)
  for (const empty of ['', '   ', '{role}', '{role} | {company} · {email}']) eq(footer({ footer: empty }), null, `${label}: a template with nothing left (${JSON.stringify(empty)}) writes no footer`)
  deepEq(footer({ footer: '{page}' }), { template: '{page}', values: {} }, `${label}: a template with only Layout tokens is written as typed`)
  deepEq(footer({ footer: '{title} | {page}' }), { template: '{title} | {page}', values: {} }, `${label}: nothing filled in: the separators stay as typed`)
  deepEq(footer({ footer: '  Page {page} of {total}  ' }), { template: 'Page {page} of {total}', values: {} }, `${label}: surrounding spaces go`)
  deepEq(footer({ footer: '{nope} | {page}' }), { template: '{nope} | {page}', values: {} }, `${label}: an unknown token is left alone`)
  deepEq(footer({ footer: 'Updated {date}' }), { template: 'Updated {date}', values: { date: 'Oct 2026' } }, `${label}: an empty Date is the current month and year`)
  deepEq(footer({ footer: 'Updated {date}', date: ' March 2027 ' }), { template: 'Updated {date}', values: { date: 'March 2027' } }, `${label}: a typed Date wins, trimmed`)
  deepEq(footer({ footer: '{page}', date: 'March 2027' }), { template: '{page}', values: {} }, `${label}: no {date} in the template, no date value`)
  deepEq(footer({ footer: 'Updated {date}' }, new Date(2027, 0, 2)), { template: 'Updated {date}', values: { date: 'Jan 2027' } }, `${label}: the auto date follows the clock`)
  deepEq(footer({ footer: 'Dept: {role}!', role: ' CTO ' }), { template: 'Dept: CTO!', values: {} }, `${label}: the professional title is trimmed`)
  deepEq(footer({ footer: 'a {company} b {email} c {website} d {confidentiality} e', company: ' C ', email: ' E ', website: ' W ', confidentiality: ' K ' }), { template: 'a C b E c W d K e', values: {} }, `${label}: organization, email, website and confidentiality are trimmed`)
  deepEq(footer({ footer: '{email} | {website}', email: 'a@b.co' }), { template: 'a@b.co', values: {} }, `${label}: email without website`)
  deepEq(footer({ footer: '{email} | {website}', email: 'a@b.co', website: 'b.co' }), { template: 'a@b.co · b.co', values: {} }, `${label}: email and website`)
  deepEq(footer({ footer: '{confidentiality} · {page}', confidentiality: 'Internal' }), { template: 'Internal · {page}', values: {} }, `${label}: the confidentiality line`)
  deepEq(footer({ footer: '{title} · {role}', role: '' }), { template: '{title}', values: {} }, `${label}: an empty detail drops, Layout's {title} stays`)
  ok(!/\{(?:role|company|email|website|confidentiality)\}/.test(footer({ footer: '{role}{company}{email}{website}{confidentiality}x', role: 'r' }).template), `${label}: no detail token reaches the deck`)
  for (const key of lib.STUDIO_DETAILS_FIELD_TOKENS) {
    const out = footer({ footer: `{${key}}`, role: 'R', company: 'C', email: 'E', website: 'W', confidentiality: 'K' })
    ok(['{author}', '{title}', '{date}', '{page}', '{total}', 'R', 'C', 'E', 'W', 'K'].includes(out.template), `${label}: the field ${key} reaches the deck as a Layout token or as its text (${out.template})`)
  }
  // slide text
  const withDetails = draft({ role: 'CTO' })
  eq(attempt(() => lib.studioDetailsFooterText(withDetails, 'My deck', 2, 8, NOW)), 'Ada Morgan · CTO · 2/8', `${label}: one slide's footer`)
  eq(attempt(() => lib.studioDetailsFooterText(draft({ footer: '{title} | Page {page} of {total}' }), 'My deck', 1, 8, NOW)), 'My deck | Page 1 of 8', `${label}: title and page numbers come from the deck`)
  eq(attempt(() => lib.studioDetailsFooterText(draft({ footer: 'Updated {date}' }), 'T', 1, 8, NOW)), 'Updated Oct 2026', `${label}: the date in the preview`)
  eq(attempt(() => lib.studioDetailsFooterText(draft({ showFooter: false }), 'T', 1, 8, NOW)), '', `${label}: no footer, no text`)
  eq(attempt(() => lib.studioDetailsFooterText(draft({ footer: '{nope} {page}' }), 'T', 3, 9, NOW)), '{nope} 3', `${label}: an unknown token stays in the preview`)
  // logo
  for (const [url, want] of [['', true], ['  ', true], ['https://a.b/c.png', true], ['HTTPS://A.B/x', true], ['  https://a.b/c.png  ', true], ['http://a.b/c.png', false], ['https://', false], ['https:// ', false], ['https://a b', false], ['javascript:alert(1)', false], ['data:image/png;base64,AAA', false], ['ftp://x', false], ['//a.b/c', false], ['a.b/c.png', false], [`https://a.b/${'x'.repeat(1995)}`, false], [`https://a.b/${'x'.repeat(1900)}`, true], [undefined, true], [null, true], [42, true]]) eq(attempt(() => lib.studioDetailsLogoValid(url)), want, `${label}: logo url ${String(url).slice(0, 30)} valid = ${want}`)
  deepEq(attempt(() => lib.studioDetailsDeckLogo(draft({ logoUrl: ' https://a.b/c.png ' }))), { image_url: 'https://a.b/c.png', alt_text: 'Presentation logo' }, `${label}: the logo for the deck`)
  deepEq(attempt(() => lib.studioDetailsDeckLogo(draft({ logoUrl: 'https://a.b/c.png', company: ' Northwind ' }))), { image_url: 'https://a.b/c.png', alt_text: 'Northwind logo' }, `${label}: alt text from the organization`)
  eq(attempt(() => lib.studioDetailsDeckLogo(draft({ logoUrl: 'https://a.b/c.png', company: 'x'.repeat(200) }))).alt_text.length, 100, `${label}: alt text is at most 100 characters (Layout's limit)`)
  eq(attempt(() => lib.studioDetailsDeckLogo(draft({ logoUrl: '' }))), null, `${label}: no url, no logo`)
  eq(attempt(() => lib.studioDetailsDeckLogo(draft({ logoUrl: 'http://a.b/c.png' }))), null, `${label}: an http url is never written`)
  // validity
  deepEq(attempt(() => lib.studioDetailsValid(draft(), NOW)), { logo: true, footer: true, ok: true }, `${label}: the starting draft is valid`)
  deepEq(attempt(() => lib.studioDetailsValid(draft({ logoUrl: 'http://x' }), NOW)), { logo: false, footer: true, ok: false }, `${label}: a bad logo`)
  deepEq(attempt(() => lib.studioDetailsValid(draft({ footer: 'x'.repeat(200) }), NOW)), { logo: true, footer: true, ok: true }, `${label}: 200 characters fit`)
  deepEq(attempt(() => lib.studioDetailsValid(draft({ footer: 'x'.repeat(201) }), NOW)), { logo: true, footer: false, ok: false }, `${label}: 201 do not`)
  deepEq(attempt(() => lib.studioDetailsValid(draft({ footer: `{role}${'x'.repeat(190)}`, role: 'y'.repeat(30) }), NOW)), { logo: true, footer: false, ok: false }, `${label}: the length is counted after the details are filled in`)
  deepEq(attempt(() => lib.studioDetailsValid(draft({ showFooter: false, footer: 'x'.repeat(500) }), NOW)), { logo: true, footer: true, ok: true }, `${label}: a hidden footer has no length to check`)
  // merge
  const deck = { footer: { template: 'old', values: { title: 'T', author: 'A', date: 'D', extra: 'E' }, sources: 'S', sources_style: { a: 1 }, style: { color: '#000' } }, logo: { image_url: 'https://old/x.png', alt_text: 'Old' }, other: 1 }
  const before = frozen(deck)
  deepEq(attempt(() => lib.studioDetailsMergeDerivative(deck, draft(), NOW)), { footer: { template: '{author} · {page}/{total}', values: { title: 'T', date: 'D', extra: 'E', author: ADA }, sources: 'S', sources_style: { a: 1 }, style: { color: '#000' } }, other: 1 }, `${label}: footer replaced, sources / style / the deck's values / other keys kept, the author written, no logo in the draft: no logo`)
  deepEq(deck, before, `${label}: the deck object is not changed`)
  deepEq(attempt(() => lib.studioDetailsMergeDerivative(deck, draft({ footer: 'Updated {date}', date: 'May 2027' }), NOW)).footer.values, { title: 'T', author: 'A', extra: 'E', date: 'May 2027' }, `${label}: the date the template uses is written over the old one; the rest stay`)
  deepEq(attempt(() => lib.studioDetailsMergeDerivative(deck, draft({ showFooter: false, logoUrl: 'https://new/y.png' }), NOW)), { other: 1, logo: { image_url: 'https://new/y.png', alt_text: 'Presentation logo' } }, `${label}: footer hidden: it is left out (as the Master panel saves an empty template), the new logo is written`)
  deepEq(attempt(() => lib.studioDetailsMergeDerivative(deck, draft({ logoUrl: 'https://old/x.png' }), NOW)).logo, { image_url: 'https://old/x.png', alt_text: 'Old' }, `${label}: the same logo keeps its alt text`)
  deepEq(attempt(() => lib.studioDetailsMergeDerivative(deck, draft({ logoUrl: 'https://old/x.png', company: 'New Co' }), NOW)).logo, { image_url: 'https://old/x.png', alt_text: 'New Co logo' }, `${label}: a typed organization renames the alt text`)
  deepEq(attempt(() => lib.studioDetailsMergeDerivative(deck, draft({ logoUrl: 'https://other/z.png' }), NOW)).logo, { image_url: 'https://other/z.png', alt_text: 'Presentation logo' }, `${label}: another logo does not inherit the old alt text`)
  for (const none of [null, undefined, 'x', 42, [], true]) deepEq(attempt(() => lib.studioDetailsMergeDerivative(none, draft({ logoUrl: 'https://a.b/c.png' }), NOW)), { footer: { template: '{author} · {page}/{total}', values: { author: ADA } }, logo: { image_url: 'https://a.b/c.png', alt_text: 'Presentation logo' } }, `${label}: a deck with ${JSON.stringify(none)} starts empty`)
  deepEq(attempt(() => lib.studioDetailsMergeDerivative({ footer: 'bad', logo: 7 }, draft({ showFooter: false }), NOW)), {}, `${label}: a malformed footer / logo is dropped, not copied`)
  // would change
  eq(attempt(() => lib.studioDetailsWouldChange(null, draft(), NOW)), true, `${label}: a deck with no footer gets one`)
  eq(attempt(() => lib.studioDetailsWouldChange(null, draft({ showFooter: false }), NOW)), false, `${label}: nothing to write to a deck with nothing`)
  const saved = { footer: { template: '{title} | Page {page} of {total}', values: { title: '', date: '' }, sources: 'S' }, logo: { image_url: 'https://logo.example/m.png', alt_text: 'Northwind logo' } }
  eq(attempt(() => lib.studioDetailsWouldChange(saved, lib.studioDetailsDraftFromDeck(saved, ADA), NOW)), false, `${label}: a draft loaded from a deck is not a change`)
  eq(attempt(() => lib.studioDetailsWouldChange(saved, { ...lib.studioDetailsDraftFromDeck(saved, ADA), footer: 'Page {page}' }, NOW)), true, `${label}: a new template is a change`)
  eq(attempt(() => lib.studioDetailsWouldChange(saved, { ...lib.studioDetailsDraftFromDeck(saved, ADA), logoUrl: '' }, NOW)), true, `${label}: removing the logo is a change`)
  eq(attempt(() => lib.studioDetailsWouldChange(saved, { ...lib.studioDetailsDraftFromDeck(saved, ADA), showFooter: false }, NOW)), true, `${label}: hiding the footer is a change`)
  eq(attempt(() => lib.studioDetailsWouldChange(saved, { ...lib.studioDetailsDraftFromDeck(saved, ADA), role: 'CTO' }, NOW)), false, `${label}: a detail the template does not use changes nothing`)
  const reordered = { logo: { alt_text: 'Northwind logo', image_url: 'https://logo.example/m.png' }, footer: { sources: 'S', values: { date: '', title: '' }, template: '{title} | Page {page} of {total}' } }
  eq(attempt(() => lib.studioDetailsWouldChange(reordered, lib.studioDetailsDraftFromDeck(reordered, ADA), NOW)), false, `${label}: the order a deck stores its keys in is not a change`)
  // draft from deck
  deepEq(attempt(() => lib.studioDetailsDraftFromDeck({ footer: { template: '{author} | {date}', values: { author: ' Sam ', date: 'May 2027' } }, logo: { image_url: 'https://a.b/c.png' } }, ADA)), { ...lib.studioDetailsInitial(ADA), author: 'Sam', date: 'May 2027', footer: '{author} | {date}', logoUrl: 'https://a.b/c.png' }, `${label}: the deck's own footer, author, date and logo`)
  deepEq(attempt(() => lib.studioDetailsDraftFromDeck({ footer: { template: '{page}', values: {} } }, ADA)), { ...lib.studioDetailsInitial(ADA), footer: '{page}' }, `${label}: no author value: the account name`)
  for (const none of [null, undefined, {}, 'x', 7, [], { footer: null }, { footer: { template: '   ' } }, { footer: { template: 5 } }, { logo: { image_url: 'http://a.b/c.png' } }, { logo: { image_url: 7 } }]) deepEq(attempt(() => lib.studioDetailsDraftFromDeck(none, ADA)), lib.studioDetailsInitial(ADA), `${label}: a deck with ${JSON.stringify(none)} starts from the default`)
  // which presentation
  const session = (over = {}) => ({ title: ' Q3 ', finalPresentationId: 'f', strawmanPresentationId: 's', blankPresentationId: 'b', stateCache: { activeVersion: 'final' }, ...over })
  for (const [over, want] of [[{}, 'f'], [{ stateCache: { activeVersion: 'strawman' } }, 's'], [{ stateCache: { activeVersion: 'blank' } }, 'b'], [{ stateCache: { activeVersion: 'blank' }, blankPresentationId: null }, 'f'], [{ stateCache: { activeVersion: 'strawman' }, strawmanPresentationId: '' }, 'f'], [{ finalPresentationId: null }, 's'], [{ finalPresentationId: null, strawmanPresentationId: null }, 'b'], [{ stateCache: null }, 'f'], [{ stateCache: undefined, finalPresentationId: ' f2 ' }, 'f2'], [{ stateCache: { activeVersion: 'constructor' } }, 'f'], [{ stateCache: { activeVersion: '__proto__' } }, 'f'], [{ stateCache: { activeVersion: 'toString' } }, 'f'], [{ stateCache: { activeVersion: 7 } }, 'f']]) eq(attempt(() => lib.studioDetailsDeckTarget(session(over)))?.presentationId, want, `${label}: presentation for ${JSON.stringify(over)}`)
  eq(attempt(() => lib.studioDetailsDeckTarget(session())).title, 'Q3', `${label}: the deck's title, trimmed`)
  eq(attempt(() => lib.studioDetailsDeckTarget(session({ title: null }))).title, '', `${label}: no title`)
  for (const none of [null, undefined, 'x', 7, [], {}, session({ finalPresentationId: null, strawmanPresentationId: null, blankPresentationId: null }), session({ finalPresentationId: '  ', strawmanPresentationId: '', blankPresentationId: 5 })]) eq(attempt(() => lib.studioDetailsDeckTarget(none)), null, `${label}: no presentation for ${JSON.stringify(none)?.slice(0, 40)}`)
  return lib
}
const lib = proveLib(SOURCES[LIB])

// ---------------------------------------------------------------- 2. the page
const LAYOUT = 'http://layout.test'
const DECK_ID = 'pres-1'
const DECK = { footer: { template: '{title} | Page {page} of {total}', values: { title: '', date: '' }, sources: 'Source: Finance' }, logo: { image_url: 'https://logo.example/m.png', alt_text: 'Northwind logo' } }
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const lastBuilderKey = userId => `deckster:last_session_id:${userId}`
async function mount(source, { remembered, ids = { session: 'sess-1', deck: DECK_ID }, session, sessionStatus = 200, layoutStatus = 200, existing = DECK, putStatus = 200, layoutConfigError = null, storageThrows = false, holdLayout = null, holdPut = null } = {}) {
  const react = makeReact()
  const calls = [], listeners = new Map(), focused = [], rememberedId = remembered === undefined ? ids.session : remembered
  const storage = rememberedId ? { [lastBuilderKey('u1')]: rememberedId } : {}
  const sessionBody = session ?? { title: 'Q3 board update', finalPresentationId: ids.deck, stateCache: { activeVersion: 'final' } }
  const layoutPath = `${LAYOUT}/api/presentations/${encodeURIComponent(ids.deck)}/derivative-elements`
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init })
    if (url === `/api/sessions/${encodeURIComponent(ids.session)}`) return reply(sessionStatus, { session: sessionBody })
    if (String(url).startsWith(layoutPath)) {
      if (init.method === 'PUT') { if (holdPut) await holdPut; return reply(putStatus, { success: true }) }
      if (holdLayout) await holdLayout
      return reply(layoutStatus, { derivative_elements: existing })
    }
    return reply(404, {})
  }
  const globals = {
    window: { localStorage: { getItem: key => { if (storageThrows) throw new Error('blocked'); return storage[key] ?? null }, setItem() {} }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    document: { getElementById: id => ({ focus: () => focused.push(id) }) },
    fetch, AbortController,
  }
  const lastSession = load(read('lib/last-builder-session.ts'), 'lib/last-builder-session.ts')
  const mod = load(source, UI, { deps: { react: react.api, '@/lib/studio-details': lib, '@/lib/last-builder-session': lastSession, '@/lib/layout-service-client': { getLayoutServiceUrl: () => LAYOUT, LAYOUT_URL_CONFIG_ERROR: layoutConfigError } }, globals })
  const props = { userId: 'u1', accountName: ADA, accountEmail: 'ada@example.invalid', accountImage: null }
  const draw = () => { react.reset(); return mod.StudioP2DetailsWorkspace(props) }
  let tree = draw(); react.flushEffects(); await tick(); tree = draw(); react.flushEffects()
  const api = {
    calls, listeners, focused, unmount: () => react.unmount(),
    get tree() { return tree },
    redraw() { tree = draw(); react.flushEffects(); return tree },
    all: () => nodes(tree),
    byType: type => nodes(tree).filter(node => node.type === type),
    button: label => nodes(tree).find(node => node.type === 'button' && text(node) === label),
    tab: label => nodes(tree).find(node => node.props?.role === 'tab' && text(node) === label),
    field: label => { const wrap = nodes(tree).find(node => node.type === 'label' && text(node).startsWith(label)); return wrap && nodes(wrap).find(node => node.type === 'input') },
    click(label) { const node = api.button(label); assert.ok(node, `button ${label} exists`); node.props.onClick(); return api.redraw() },
    type(label, value) { const node = api.field(label); assert.ok(node, `field ${label} exists`); node.props.onChange({ target: { value } }); return api.redraw() },
    check(label, checked) { const node = api.field(label); node.props.onChange({ target: { checked } }); return api.redraw() },
    open(label) { api.tab(label).props.onClick(); return api.redraw() },
    async save() { api.button('Save to this presentation').props.onClick(); await tick(); return api.redraw() },
    async settle() { await tick(); return api.redraw() },
    text: () => text(tree),
    put: () => calls.find(call => call.init.method === 'PUT'),
  }
  return api
}
const SAVE = 'Save to this presentation'
const disabled = node => Boolean(node?.props?.disabled)
async function proveUi(source, libSource = SOURCES[LIB], label = 'page') {
  const L = libSource === SOURCES[LIB] ? lib : load(libSource, LIB)
  const saved = lib
  void saved; void L
  // loaded deck
  const page = await mount(source)
  deepEq(page.calls.map(call => call.url), ['/api/sessions/sess-1', `${LAYOUT}/api/presentations/${DECK_ID}/derivative-elements`], `${label}: reads the remembered session, then the deck's own footer and logo (nothing else)`)
  ok(page.calls.every(call => !call.init.method || call.init.method === 'GET'), `${label}: reads only`)
  eq(page.calls[0].init.cache, 'no-store', `${label}: no cached session read`)
  eq(page.calls[1].init.cache, 'no-store', `${label}: no cached deck read`)
  const main = page.tree
  eq(main.type, 'main', `${label}: one main`)
  eq(main.props['data-studio-p2-details'], 'true', `${label}: the page's own marker`)
  eq(main.props['data-studio-personal'], 'details', `${label}: still the details surface`)
  eq(main.props['data-studio-intro-surface'], 'details', `${label}: the intro still finds its surface`)
  deepEq(page.all().filter(node => node.props?.role === 'tab').map(text), ['Account', 'Profile', 'Slide details'], `${label}: tabs: Account first, then the mockup's names`)
  eq(page.all().find(node => node.props?.role === 'tablist')?.props['aria-label'], 'Your details sections', `${label}: the tab list is named`)
  deepEq(page.all().filter(node => node.props?.role === 'tab').map(node => node.props['aria-selected']), [true, false, false], `${label}: Account is selected first`)
  deepEq(page.all().filter(node => node.props?.role === 'tab').map(node => node.props.tabIndex), [0, -1, -1], `${label}: one tab stop`)
  eq(page.all().find(node => node.props?.role === 'tabpanel')?.props['aria-labelledby'], `:r${0}:-account-tab`.replace(/^:r0:/, page.all().find(node => node.props?.role === 'tabpanel').props['aria-labelledby'].split('-')[0]), `${label}: the panel is labelled by the selected tab`)
  ok(page.all().some(node => node.type === 'AccountProfileEditor'), `${label}: Account keeps the real account editor`)
  ok(!page.all().some(node => node.props?.['data-studio-p2-actions']), `${label}: no save bar on Account`)
  eq(page.byType('AccountIdentityPreview').length + page.all().filter(node => node.props?.['aria-label'] === 'Sample slide preview').length >= 1, true, `${label}: account preview and sample slide exist`)
  eq(page.all().find(node => node.props?.['aria-label'] === 'Sample slide preview').props.hidden, true, `${label}: the sample slide waits behind the Account tab`)
  ok(!page.all().some(node => node.props?.['data-studio-p2-scope']), `${label}: no scope strip on the Account tab`)
  match(text(main.props.children[0]), /Your details/, `${label}: the heading`)
  eq(page.all().find(node => node.type === 'span' && node.props.className === 'sp-draft-badge') && text(page.all().find(node => node.type === 'span' && node.props.className === 'sp-draft-badge')), 'Your account', `${label}: the badge on Account`)
  ok(page.all().some(node => node.type === 'StudioWorkflowAction' && node.props.action === 'master'), `${label}: the hand-off to Master stays`)
  match(page.text(), /Presenter avatars and voice are optional later additions\./, `${label}: the avatar line stays`)
  // Slide details with the deck's own values
  page.open('Profile')
  ok(page.all().some(node => node.type === 'AccountProfileEditor') && page.all().find(node => node.props?.className === 'sp-account-pane').props.hidden === true, `${label}: the account editor stays mounted (hidden) off Account, so an unsaved name survives a tab change`)
  ok(page.all().some(node => node.props?.['data-studio-p2-actions']), `${label}: the save bar is on the other tabs`)
  page.open('Slide details')
  const slides = page.all().filter(node => node.props?.['data-studio-p2-card'] === 'slides')
  eq(slides.length, 1, `${label}: the Slide details card`)
  eq(page.all().find(node => node.props?.['data-studio-p2-scope']).type, 'div', `${label}: the scope strip shows on Slide details`)
  deepEq(page.all().filter(node => node.props?.className === 'sp-p2-scope-pill').map(text), ['This presentation'], `${label}: the one scope, no "Reusable defaults"`)
  eq(text(page.all().find(node => node.props?.['data-studio-p2-scope-note'])), 'Q3 board update · Changes apply across this presentation.', `${label}: the scope note names the deck`)
  eq(page.all().find(node => node.props?.['data-studio-p2-scope-note']).props['data-studio-p2-scope-note'], 'ready', `${label}: the note's state is ready`)
  eq(page.all().find(node => node.props?.['data-studio-p2-scope-note']).props.role, 'status', `${label}: the note is announced`)
  eq(page.field('Footer template').props.value, '{title} | Page {page} of {total}', `${label}: the deck's own template`)
  eq(page.field('Show footer').props.checked, true, `${label}: Show footer is on for a deck with a footer`)
  eq(page.field('Date').props.placeholder, 'Auto · current month and year', `${label}: the Date placeholder`)
  eq(page.field('Date').props.value, '', `${label}: the deck has no date value`)
  deepEq(page.all().filter(node => node.props?.['data-studio-p2-presets']).flatMap(node => nodes(node.props.children).filter(n => n.type === 'button')).map(text), ['Page only', 'Page X of Y', 'Title + Page', 'Author + role'], `${label}: the four presets`)
  deepEq(page.all().filter(node => node.props?.['data-studio-p2-tokens']).flatMap(node => nodes(node.props.children).filter(n => n.type === 'button')).map(text), ['{author}', '{role}', '{company}', '{title}', '{date}', '{page}', '{total}', '{confidentiality}', '{email}', '{website}'], `${label}: Insert a field`)
  ok(page.all().some(node => node.type === 'summary' && text(node) === 'Insert a field'), `${label}: Insert a field is a disclosure`)
  eq(text(page.all().find(node => node.props?.['data-studio-p2-footer'])), 'Q3 board update | Page 1 of 8', `${label}: the sample slide's footer is the deck's template`)
  ok(!disabled(page.button('Reset draft')) === false, `${label}: nothing to reset yet`)
  ok(disabled(page.button(SAVE)), `${label}: nothing to save yet`)
  ok(!page.listeners.has('beforeunload'), `${label}: no leave warning for an untouched draft`)
  eq(page.button('Save as defaults'), undefined, `${label}: the dead "Save as defaults" is gone`)
  ok(!/Reusable defaults|Save as defaults|Local draft preview|not connected/.test(page.text()), `${label}: none of the old not-connected words`)
  match(text(page.all().find(node => node.props?.id === 'sp-details-save-note')), /^Saving writes the footer and logo to the presentation\. Leaving this page discards unsaved edits\.$/, `${label}: the note says what Save does`)
  // edit and save
  page.type('Footer template', '{author} · {role} · {company} | {page}/{total}')
  ok(!disabled(page.button(SAVE)), `${label}: an edit enables Save`)
  ok(!disabled(page.button('Reset draft')), `${label}: and Reset`)
  ok(page.listeners.has('beforeunload'), `${label}: an edited draft warns on leave`)
  page.open('Profile'); page.type('Professional title', 'Strategy Director'); page.type('Organization', 'Northwind Traders'); page.open('Slide details')
  eq(text(page.all().find(node => node.props?.['data-studio-p2-footer'])), 'Ada Morgan · Strategy Director · Northwind Traders · 1/8', `${label}: the preview fills the details in`)
  await page.save()
  const put = page.put()
  ok(put, `${label}: Save writes`)
  eq(put.url, `${LAYOUT}/api/presentations/${DECK_ID}/derivative-elements?created_by=user&change_summary=Updated+from+Your+details`, `${label}: to the deck's derivative-elements, the way the Master panel's store does, never anywhere else`)
  eq(put.init.method, 'PUT', `${label}: PUT`)
  deepEq(put.init.headers, { 'Content-Type': 'application/json' }, `${label}: JSON`)
  deepEq(JSON.parse(put.init.body), { footer: { template: '{author} · Strategy Director · Northwind Traders · {page}/{total}', values: { title: '', date: '', author: ADA }, sources: 'Source: Finance' }, logo: { image_url: 'https://logo.example/m.png', alt_text: 'Northwind Traders logo' } }, `${label}: the body is the merge: the filled footer, the deck's own sources and values kept, the logo kept`)
  eq(page.calls.filter(call => call.init.method === 'PUT').length, 1, `${label}: one write`)
  eq(text(page.all().find(node => node.props?.className === 'sp-feedback')), 'Saved. These details now apply across this presentation.', `${label}: saved, said so`)
  ok(disabled(page.button(SAVE)), `${label}: after saving there is nothing more to save`)
  ok(!page.listeners.has('beforeunload'), `${label}: a saved draft does not warn on leave`)
  page.type('Footer template', 'Page {page} of {total}')
  await page.save()
  deepEq(JSON.parse(page.calls.filter(call => call.init.method === 'PUT')[1].init.body).footer, { template: 'Page {page} of {total}', values: { title: '', date: '', author: ADA }, sources: 'Source: Finance' }, `${label}: a second save merges onto what the first wrote`)
  // presets, chips, hide footer
  const more = await mount(source)
  more.open('Slide details')
  more.click('Page only'); eq(more.field('Footer template').props.value, '{page}', `${label}: a preset fills the template`)
  eq(more.button('Page only').props['aria-pressed'], true, `${label}: the chosen preset is pressed`)
  eq(more.button('Title + Page').props['aria-pressed'], false, `${label}: the others are not`)
  more.click('Title + Page'); eq(more.field('Footer template').props.value, '{title} | {page}', `${label}: Title + Page`)
  more.click('Author + role'); eq(more.field('Footer template').props.value, '{author} · {role} · {company} | {page}/{total}', `${label}: Author + role`)
  more.type('Footer template', ''); more.click('{date}'); eq(more.field('Footer template').props.value, '{date}', `${label}: a field into an empty template`)
  more.click('{page}'); eq(more.field('Footer template').props.value, '{date} · {page}', `${label}: the next field is added with " · "`)
  more.click('{website}'); eq(more.field('Footer template').props.value, '{date} · {page} · {website}', `${label}: also a field only this page fills`)
  more.check('Show footer', false)
  ok(disabled(more.field('Footer template')), `${label}: a hidden footer's template is read-only`)
  ok(more.all().filter(node => node.type === 'button' && /^\{/.test(text(node))).every(disabled) && disabled(more.button('Page only')), `${label}: so are the presets and fields`)
  eq(text(more.all().find(node => node.props?.['data-studio-p2-footer'])), '', `${label}: and the sample slide has no footer`)
  await more.save()
  deepEq(JSON.parse(more.put().init.body), { logo: { image_url: 'https://logo.example/m.png', alt_text: 'Northwind logo' } }, `${label}: hidden: the write has no footer and keeps the logo`)
  // profile fields
  const profile = await mount(source)
  profile.open('Profile')
  deepEq(profile.all().filter(node => node.type === 'label' && node.props.className?.startsWith('sp-field')).map(node => text(node.props.children[0])), ['Author name', 'Professional title', 'Organization', 'Contact email', 'Website', 'Confidentiality line', 'Logo URL'], `${label}: the mockup's complete set, in its order`)
  ok(!profile.all().some(node => node.type === 'input' && node.props.type === 'file'), `${label}: no local logo file; the deck takes a URL`)
  eq(profile.field('Author name').props.value, ADA, `${label}: author starts from the account name`)
  eq(profile.field('Logo URL').props.value, 'https://logo.example/m.png', `${label}: the deck's logo`)
  eq(profile.field('Logo URL').props.placeholder, 'https://…', `${label}: the placeholder`)
  match(profile.text(), /Your professional title is separate from a presentation.s title\./, `${label}: the card's line`)
  match(profile.text(), /Contact details only appear when included in the footer\./, `${label}: the hint`)
  eq(profile.all().find(node => node.props?.['data-studio-p2-card'] === 'profile').props['data-studio-p2-card'], 'profile', `${label}: the Profile card`)
  profile.type('Logo URL', 'http://x/y.png')
  ok(profile.all().some(node => node.type === 'p' && node.props.role === 'alert' && text(node) === 'Use an HTTPS image URL, or leave this empty.'), `${label}: an http logo is refused in words`)
  eq(profile.field('Logo URL').props['aria-invalid'], true, `${label}: and marked`)
  ok(!profile.all().some(node => node.type === 'img'), `${label}: an address that is not allowed is never loaded into the sample slide`)
  ok(disabled(profile.button(SAVE)), `${label}: and cannot be saved`)
  profile.type('Logo URL', 'https://x/y.png')
  ok(!profile.all().some(node => node.props?.role === 'alert'), `${label}: a good one clears it`)
  ok(!disabled(profile.button(SAVE)), `${label}: and can be saved`)
  const preview = profile.all().find(node => node.type === 'img')
  eq(preview?.props.src, 'https://x/y.png', `${label}: the sample slide shows the logo`)
  eq(preview?.props.referrerPolicy, 'no-referrer', `${label}: without a referrer`)
  preview.props.onError(); profile.redraw()
  ok(profile.all().some(node => node.type === 'p' && node.props.role === 'alert' && /could not be loaded/.test(text(node))), `${label}: a logo that will not load is said so`)
  profile.type('Logo URL', 'https://x/z.png')
  ok(!profile.all().some(node => node.props?.role === 'alert'), `${label}: a new address clears it`)
  profile.type('Logo URL', 'https://x/y.png')
  ok(!profile.all().some(node => node.props?.role === 'alert'), `${label}: and going back to it does not bring the old message back before it fails again`)
  // long footer
  const long = await mount(source)
  long.open('Slide details'); long.type('Footer template', 'x'.repeat(201))
  ok(long.all().some(node => node.type === 'p' && node.props.role === 'alert' && /longer than 200 characters/.test(text(node))), `${label}: a footer over Layout's 200 is refused in words`)
  ok(disabled(long.button(SAVE)), `${label}: and cannot be saved`)
  eq(long.field('Footer template').props['aria-invalid'], true, `${label}: and marked`)
  eq(long.field('Footer template').props.maxLength, 400, `${label}: typing room for the unfilled template`)
  // ids are encoded
  const odd = await mount(source, { ids: { session: 'sess/1 x?', deck: 'pres 1/#a' } })
  deepEq(odd.calls.map(call => call.url), ['/api/sessions/sess%2F1%20x%3F', `${LAYOUT}/api/presentations/pres%201%2F%23a/derivative-elements`], `${label}: ids are encoded in both reads`)
  odd.open('Slide details'); odd.type('Footer template', 'Page {page}'); await odd.save()
  ok(odd.put().url.startsWith(`${LAYOUT}/api/presentations/pres%201%2F%23a/derivative-elements?`), `${label}: and in the write`)
  // typing before the deck has loaded is kept
  let release; const held = new Promise(resolve => { release = resolve })
  const early = await mount(source, { holdLayout: held })
  early.open('Slide details')
  eq(text(early.all().find(node => node.props?.['data-studio-p2-scope-note'])), 'Finding your open presentation…', `${label}: while the deck loads the note says so`)
  eq(early.all().find(node => node.props?.['data-studio-p2-scope-note']).props['data-studio-p2-scope-note'], 'loading', `${label}: and the state is loading`)
  ok(disabled(early.button(SAVE)), `${label}: no Save while it loads`)
  early.type('Footer template', 'Typed early')
  release(); await early.settle()
  eq(early.all().find(node => node.props?.['data-studio-p2-scope-note']).props['data-studio-p2-scope-note'], 'ready', `${label}: the deck arrives`)
  eq(early.field('Footer template').props.value, 'Typed early', `${label}: what was typed before it arrived is kept`)
  ok(!disabled(early.button(SAVE)), `${label}: and can now be saved`)
  // leaving cancels the read
  const leaving = await mount(source); leaving.unmount()
  ok(leaving.calls.every(call => call.init.signal?.aborted === true), `${label}: leaving the page aborts its reads`)
  // one write at a time
  let finish; const holdPut = new Promise(resolve => { finish = resolve })
  const slow = await mount(source, { holdPut })
  slow.open('Slide details'); slow.type('Footer template', 'Page {page}')
  slow.button(SAVE).props.onClick(); await tick(); slow.redraw()
  ok(disabled(slow.button('Saving…')), `${label}: while it saves the button is disabled and says so`)
  slow.all().find(node => node.type === 'button' && /^Saving…$/.test(text(node))).props.onClick()
  await tick()
  eq(slow.calls.filter(call => call.init.method === 'PUT').length, 1, `${label}: a second press while saving does not write again`)
  ok(disabled(slow.button('Reset draft')), `${label}: nor can the draft be reset mid-save`)
  finish(); await slow.settle()
  match(text(slow.all().find(node => node.props?.className === 'sp-feedback')), /^Saved\./, `${label}: and then it is saved`)
  // failed write
  const failing = await mount(source, { putStatus: 500 })
  failing.open('Slide details'); failing.type('Footer template', 'Page {page}')
  await failing.save()
  eq(text(failing.all().find(node => node.props?.className === 'sp-feedback')), 'The presentation was not changed. Try again.', `${label}: a failed write is said so`)
  ok(!disabled(failing.button(SAVE)), `${label}: and can be tried again`)
  ok(failing.listeners.has('beforeunload'), `${label}: and the draft is still unsaved`)
  // reset
  const resetting = await mount(source)
  resetting.open('Slide details'); resetting.type('Footer template', 'Page {page}'); resetting.click('Reset draft')
  eq(resetting.field('Footer template').props.value, '{title} | Page {page} of {total}', `${label}: Reset returns to what the deck has`)
  ok(disabled(resetting.button('Reset draft')) && disabled(resetting.button(SAVE)), `${label}: nothing left to reset or save`)
  // a deck without footer / logo
  const bare = await mount(source, { existing: null })
  bare.open('Slide details')
  eq(bare.field('Footer template').props.value, '{author} · {role} · {company} | {page}/{total}', `${label}: a deck with no footer starts from the mockup's template`)
  ok(!disabled(bare.button(SAVE)), `${label}: and saving it would add the footer`)
  eq(bare.field('Show footer').props.checked, true, `${label}: shown`)
  // no deck / errors
  const note = p => text(p.all().find(node => node.props?.['data-studio-p2-scope-note']))
  const state = p => p.all().find(node => node.props?.['data-studio-p2-scope-note']).props['data-studio-p2-scope-note']
  for (const [name, options, want, words] of [
    ['no remembered session', { remembered: '' }, 'none', 'Open or build a presentation in Studio, then come back to apply these details to it.'],
    ['the new-session id', { remembered: 'new' }, 'none', 'Open or build a presentation in Studio, then come back to apply these details to it.'],
    ['a deleted session (404)', { sessionStatus: 404 }, 'none', 'Open or build a presentation in Studio, then come back to apply these details to it.'],
    ['a deleted session (410)', { sessionStatus: 410 }, 'none', 'Open or build a presentation in Studio, then come back to apply these details to it.'],
    ['a session with no presentation yet', { session: { title: 'Empty' } }, 'none', 'Open or build a presentation in Studio, then come back to apply these details to it.'],
    ['the session read failing (500)', { sessionStatus: 500 }, 'error', 'Your open presentation could not be read. Reload to try again.'],
    ['the deck read failing', { layoutStatus: 500 }, 'error', 'Your open presentation could not be read. Reload to try again.'],
    ['no Layout service configured', { layoutConfigError: { message: 'x' } }, 'error', 'Your open presentation could not be read. Reload to try again.'],
    ['blocked storage', { storageThrows: true }, 'none', 'Open or build a presentation in Studio, then come back to apply these details to it.'],
  ]) {
    const p = await mount(source, options)
    p.open('Slide details')
    eq(state(p), want, `${label}: ${name}: state`)
    eq(note(p), words, `${label}: ${name}: words`)
    ok(disabled(p.button(SAVE)), `${label}: ${name}: no Save`)
    p.type('Footer template', 'Page {page}')
    ok(disabled(p.button(SAVE)), `${label}: ${name}: still no Save after an edit (there is no deck to write to)`)
    ok(!p.calls.some(call => call.init.method === 'PUT'), `${label}: ${name}: nothing is written`)
    if (want === 'none') match(text(p.all().find(node => node.props?.id === 'sp-details-save-note')), /^There is no presentation to save to yet\. Leaving this page discards the draft\.$/, `${label}: ${name}: the note says so`)
    if (name === 'no remembered session' || name === 'the new-session id') ok(!p.calls.some(call => call.url.startsWith('/api/sessions')), `${label}: ${name}: no session read`)
    if (name === 'no Layout service configured') ok(!p.calls.some(call => call.url.startsWith(LAYOUT)), `${label}: ${name}: no request to a missing service`)
  }
  const loading = await (async () => {
    const react = makeReact(); const pendingFetch = () => new Promise(() => {})
    const mod = load(source, UI, { deps: { react: react.api, '@/lib/studio-details': lib, '@/lib/last-builder-session': load(read('lib/last-builder-session.ts'), 'x'), '@/lib/layout-service-client': { getLayoutServiceUrl: () => LAYOUT, LAYOUT_URL_CONFIG_ERROR: null } }, globals: { window: { localStorage: { getItem: () => 'sess-1' }, addEventListener() {}, removeEventListener() {} }, document: {}, fetch: pendingFetch, AbortController } })
    const draw = () => { react.reset(); return mod.StudioP2DetailsWorkspace({ userId: 'u1', accountName: ADA }) }
    draw(); react.flushEffects(); await tick(); const tree = draw()
    return nodes(tree)
  })()
  eq(text(loading.find(node => node.props?.['data-studio-p2-scope-note'])), '', `${label}: while it loads the note is not shown on Account`)
  // keyboard
  const keys = await mount(source)
  const press = (index, key) => { let prevented = false; keys.all().filter(node => node.props?.role === 'tab')[index].props.onKeyDown({ key, preventDefault: () => { prevented = true } }); keys.redraw(); return prevented }
  const selected = () => keys.all().filter(node => node.props?.role === 'tab').map(node => node.props['aria-selected']).indexOf(true)
  eq(press(0, 'ArrowRight'), true, `${label}: ArrowRight is handled`); eq(selected(), 1, `${label}: ArrowRight: Profile`)
  press(1, 'ArrowRight'); eq(selected(), 2, `${label}: ArrowRight: Slide details`)
  press(2, 'ArrowRight'); eq(selected(), 0, `${label}: ArrowRight wraps to Account`)
  press(0, 'ArrowLeft'); eq(selected(), 2, `${label}: ArrowLeft wraps to Slide details`)
  press(2, 'ArrowLeft'); eq(selected(), 1, `${label}: ArrowLeft`)
  press(1, 'End'); eq(selected(), 2, `${label}: End`)
  press(2, 'Home'); eq(selected(), 0, `${label}: Home`)
  eq(press(0, 'a'), false, `${label}: another key is left alone`); eq(selected(), 0, `${label}: and moves nothing`)
  ok(keys.focused.length >= 6 && keys.focused.every(id => /-(account|profile|slides)-tab$/.test(id)), `${label}: focus follows the selected tab`)
  eq(keys.focused[0].endsWith('-profile-tab'), true, `${label}: ArrowRight focuses Profile`)
  // Profile selection: the aside and badge
  const badge = await mount(source); badge.open('Profile')
  eq(text(badge.all().find(node => node.type === 'span' && node.props.className === 'sp-draft-badge')), 'This presentation', `${label}: the badge off Account`)
  eq(badge.all().find(node => node.props?.['aria-label'] === 'Sample slide preview').props.hidden, false, `${label}: the sample slide shows off Account`)
  eq(badge.all().find(node => node.type === 'AccountIdentityPreview' || node.props?.active !== undefined)?.props.active, false, `${label}: the account card hides`)
  eq(badge.all().find(node => node.props?.active !== undefined).props.onPresenterPreview.toString().includes('profile'), true, `${label}: "Explore presenter preview" opens Profile`)
  // the Title / Content toggle (kept)
  badge.all().find(node => node.type === 'button' && text(node) === 'Content').props.onClick(); badge.redraw()
  eq(badge.all().find(node => node.props?.['data-preview-slide']).props['data-preview-slide'], 'content', `${label}: Content`)
  match(badge.text(), /Sample deck · 2 of 8 Preview only/, `${label}: the sample caption stays, page 2`)
  // unmount closes the read
  return true
}
await proveUi(SOURCES[UI])

// ---------------------------------------------------------------- 3. the wiring
const stripFlagged = (source, edits) => edits.reduce((out, [from, to]) => { assert.ok(out.includes(from), `flagged text present: ${from.slice(0, 60)}`); return out.replace(from, () => to) }, source)
const DETAILS_EDITS = [
  ['import { StudioP2DetailsWorkspace } from "./studio-p2-details"\n', ''],
  ['  // PASS2 DET-01..06 (NEXT_PUBLIC_STUDIO_P2_DETAILS, default off): the mockup\'s Your details wired to the open deck. Off: the page below, unchanged.\n  if (process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS === "true") return <StudioP2DetailsWorkspace key={user.id} userId={user.id} accountName={user.name || ""} accountEmail={user.email} accountImage={user.image} />\n', ''],
]
const HEADER_EDITS = [
  ['import { ArrowLeft, Brain, LayoutDashboard, Layers, Plus } from "lucide-react"', 'import { ArrowLeft, Brain, LayoutDashboard, Layers } from "lucide-react"'],
  ['import "./studio-library-back.css"\nimport "./studio-p2-shell.css"', 'import "./studio-library-back.css"'],
]
const HEADER_NEWDECK = /    \/\/ PASS2 DET-12 [^\n]*\n    const newDeck = [^\n]*\n/
const RAIL_EDITS = [
  [' data-studio-p2-rail={process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS === "true" ? "true" : undefined}', ''],
  ['import "./studio-shell.css"\nimport "./studio-p2-shell.css"', 'import "./studio-shell.css"'],
]
function identityOff(detailsSrc, headerSrc, railSrc, label) {
  eq(stripFlagged(detailsSrc, DETAILS_EDITS), baseSource(DETAILS), `${label}: details-workspace.tsx minus the flagged lines is the base file`)
  const headerPlain = stripFlagged(headerSrc, HEADER_EDITS).replace(HEADER_NEWDECK, '').replace('{libraryBack}{newDeck}</div>', '{libraryBack}</div>')
  eq(headerPlain, baseSource(HEADER), `${label}: app-header.tsx minus the flagged lines is the base file`)
  eq(stripFlagged(railSrc, RAIL_EDITS), baseSource(RAIL), `${label}: studio-rail.tsx minus the flagged lines is the base file`)
}
const authUser = { id: 'u1', name: ADA, email: 'ada@example.invalid', image: null }
function loadDetails(source, env) {
  const react = makeReact()
  const mod = load(source, DETAILS, { env, deps: { react: react.api, '@/hooks/use-auth': { useAuth: () => ({ user: authUser, isLoading: false }) } } })
  return { mod, react }
}
function proveDetailsWiring(source, label = 'details wiring') {
  for (const value of [undefined, 'false', '', 'TRUE', '1', 'yes', ' true']) {
    const { mod } = loadDetails(source, value === undefined ? {} : { [FLAG]: value })
    const out = mod.AccountDetailsWorkspace()
    eq(out.type, mod.DetailsWorkspace, `${label}: ${JSON.stringify(value)}: the existing page`)
    deepEq(out.props, { accountName: ADA, accountEmail: 'ada@example.invalid', accountImage: null }, `${label}: ${JSON.stringify(value)}: with the props it had`)
    eq(out.key, 'u1', `${label}: ${JSON.stringify(value)}: keyed by the account`)
  }
  const { mod } = loadDetails(source, { [FLAG]: 'true' })
  const on = mod.AccountDetailsWorkspace()
  eq(on.type, 'StudioP2DetailsWorkspace', `${label}: on: the new page`)
  deepEq(on.props, { userId: 'u1', accountName: ADA, accountEmail: 'ada@example.invalid', accountImage: null }, `${label}: on: for this account`)
  eq(on.key, 'u1', `${label}: on: keyed by the account`)
  // an account session that is missing or loading keeps its words whichever way the flag is
  for (const env of [{}, { [FLAG]: 'true' }]) {
    const loadingMod = load(source, DETAILS, { env, deps: { react: makeReact().api, '@/hooks/use-auth': { useAuth: () => ({ user: null, isLoading: true }) } } })
    eq(text(loadingMod.AccountDetailsWorkspace()), 'Loading your account…', `${label}: loading words (${JSON.stringify(env)})`)
    const noneMod = load(source, DETAILS, { env, deps: { react: makeReact().api, '@/hooks/use-auth': { useAuth: () => ({ user: null, isLoading: false }) } } })
    eq(text(noneMod.AccountDetailsWorkspace()), 'Your account session is unavailable. Reload to try again.', `${label}: no session words (${JSON.stringify(env)})`)
  }
  // the old page itself renders as it did
  const base = load(baseSource(DETAILS), DETAILS, { deps: { react: makeReact().api, '@/hooks/use-auth': { useAuth: () => ({ user: authUser, isLoading: false }) } } })
  const props = { accountName: ADA, accountEmail: 'ada@example.invalid', accountImage: null }
  const run = module => { const react = makeReact(); const m = load(source === undefined ? '' : module.src, DETAILS, { deps: { react: react.api, '@/hooks/use-auth': { useAuth: () => ({ user: authUser, isLoading: false }) } }, globals: { window: { addEventListener() {}, removeEventListener() {} } } }); react.reset(); return rendered(expand(m.DetailsWorkspace(props))) }
  eq(run({ src: source }), run({ src: baseSource(DETAILS) }), `${label}: the old page renders the same tree as the base's`)
  void base
}
const PATHS = ['/dashboard', '/knowledge', '/studio/templates', '/studio/themes', '/studio/intelligence', '/studio/details', '/profile']
const OTHER = ['/settings/profile', '/billing', '/shortcuts', '/builder', '/studio', '/studio/details/x', '/dashboard/x', '/', '']
function headerOut(source, pathname, env) {
  const mod = load(source, HEADER, { env, deps: { 'next/navigation': { usePathname: () => pathname, useRouter: () => ({ push() {} }) }, '@/hooks/use-auth': { useAuth: () => ({ user: authUser }) }, '@/lib/utils': { cn: (...parts) => parts.filter(Boolean).join(' ') }, '@/lib/studio-nav-labels': { studioNavLabels: () => ({ decks: 'Decks', knowledge: 'Knowledge' }) }, '@/lib/last-builder-session': { lastBuilderSessionKey: id => id }, '@/components/ui/button': { Button: 'Button' }, '@/components/user-profile-menu': { UserProfileMenu: 'UserProfileMenu' } }, globals: { window: { localStorage: { getItem: () => null } } } })
  return mod.AppHeader()
}
function proveHeader(source, label = 'header') {
  const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
  const links = tree => nodes(tree).filter(node => node.props?.['data-studio-p2-new-deck'])
  for (const pathname of PATHS) {
    for (const back of [false, true]) {
      const env = { ...SHELL, ...(back ? { NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK: 'true' } : {}) }
      const off = headerOut(source, pathname, env)
      eq(links(off).length, 0, `${label}: flag off: no link on ${pathname} (back ${back})`)
      const on = headerOut(source, pathname, { ...env, [FLAG]: 'true' })
      const found = links(on)
      eq(found.length, 1, `${label}: flag on: one "+ Presentation" on ${pathname} (back ${back})`)
      eq(found[0].type, 'default', `${label}: it is a link`)
      eq(found[0].props.href, '/builder?session_id=new', `${label}: to a fresh Studio session`)
      eq(text(found[0]), 'Presentation', `${label}: its word`)
      ok(nodes(found[0]).some(node => node.type === 'Plus'), `${label}: with the plus`)
      const row = nodes(on).find(node => node.type === 'div' && node.props.className === 'flex h-full items-center')
      const kids = [].concat(row.props.children).filter(Boolean)
      eq(kids.at(-1), found[0], `${label}: last in the bar, after "Back to Studio" when it is there (${pathname}, back ${back})`)
      eq(kids.length, back ? 3 : 2, `${label}: the bar's other children are unchanged (${pathname}, back ${back})`)
      eq(rendered(headerOut(source, pathname, { ...env, [FLAG]: 'true' })).includes('data-studio-library-back'), back, `${label}: "Back to Studio" is still its own flag`)
      deepEq(rendered(on).replace(/,?\{"type":"default","props":\{"data-studio-p2-new-deck":"true"[^]*?"children":\[\{"type":"Plus"[^]*?\}\]\}\}/, ''), rendered(off), `${label}: apart from the link the bar is the same (${pathname}, back ${back})`)
    }
  }
  for (const pathname of OTHER) eq(links(headerOut(source, pathname, { ...SHELL, [FLAG]: 'true' })).length, 0, `${label}: no link on ${JSON.stringify(pathname)}`)
  eq(links(headerOut(source, '/dashboard', { [FLAG]: 'true' })).length, 0, `${label}: no link in the old (non-shell) header`)
  eq(rendered(headerOut(source, '/dashboard', { [FLAG]: 'true' })), rendered(headerOut(source, '/dashboard', {})), `${label}: the old header is the same with the flag on`)
  for (const value of ['false', '', 'TRUE', '1', undefined]) eq(links(headerOut(source, '/dashboard', { ...SHELL, ...(value === undefined ? {} : { [FLAG]: value }) })).length, 0, `${label}: only the exact "true" (${JSON.stringify(value)})`)
}
function proveRail(source, label = 'rail') {
  const rail = env => load(source, RAIL, { env, deps: { 'next/navigation': { usePathname: () => '/studio/details' }, '@/lib/studio-nav-labels': { studioNavLabels: () => ({ decks: 'Decks', knowledge: 'Knowledge' }) }, '@/components/user-profile-menu': { UserProfileMenu: 'UserProfileMenu' } } }).StudioRail({})
  const off = rail({}), on = rail({ [FLAG]: 'true' })
  eq(off.props['data-studio-p2-rail'], undefined, `${label}: off: no marker`)
  eq(on.props['data-studio-p2-rail'], 'true', `${label}: on: the marker`)
  for (const value of ['false', '', 'TRUE', '1']) eq(rail({ [FLAG]: value }).props['data-studio-p2-rail'], undefined, `${label}: only the exact "true" (${JSON.stringify(value)})`)
  const { 'data-studio-p2-rail': _marker, ...rest } = on.props
  deepEq(rendered({ ...on, props: rest }), rendered(off), `${label}: nothing else differs`)
  ok(on.props['data-studio-v4-rail'] === 'true' && on.props['aria-label'] === 'Workspace navigation', `${label}: still the rail`)
  eq(nodes(on).filter(node => node.props?.['aria-current'] === 'page').length, 1, `${label}: one current page`)
}
identityOff(SOURCES[DETAILS], SOURCES[HEADER], SOURCES[RAIL], 'identity')
proveDetailsWiring(SOURCES[DETAILS])
proveHeader(SOURCES[HEADER])
proveRail(SOURCES[RAIL])

// ---------------------------------------------------------------- 4. the CSS
const SP_TOKENS = new Set([...read(CSS_BASE).matchAll(/(--sp-[a-z]+):/g)].map(m => m[1]))
const shellBlocks = read(SHELL_CSS).split(/\n(?=\.dark \[data-studio-v4-shell="true"\] \{)/)
const SS_LIGHT = new Set([...shellBlocks[0].matchAll(/(--ss-[a-z-]+):/g)].map(m => m[1])), SS_DARK = new Set([...(shellBlocks[1] ?? '').matchAll(/(--ss-[a-z-]+):/g)].map(m => m[1]))
const selectorsOf = css => { const out = []; postcss.parse(css).walkRules(rule => { if (!(rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name))) rule.selectors.forEach(selector => out.push([selector, rule])) }); return out }
const declsOf = css => { const out = []; postcss.parse(css).walkDecls(decl => out.push(decl)); return out }
function proveCssPage(css, label = 'page css') {
  const rules = selectorsOf(css)
  ok(rules.length > 20, `${label}: has its rules`)
  for (const [selector] of rules) match(selector, /^(?:\.dark )?\[data-studio-p2-details\]/, `${label}: scoped to the page's marker: ${selector}`)
  for (const decl of declsOf(css)) {
    for (const [, name] of decl.value.matchAll(/var\((--[a-z-]+)/g)) ok(SP_TOKENS.has(name), `${label}: ${decl.prop}: token ${name} exists`)
    for (const hex of decl.value.match(/#[0-9a-f]{3,8}\b/gi) ?? []) ok(['#a24133', '#f4aaa0'].includes(hex.toLowerCase()) && /border-color/.test(decl.prop), `${label}: only the invalid-field border is a literal colour (${decl.prop}: ${hex})`)
  }
  const decl = (selector, prop) => rules.find(([sel]) => sel === selector)?.[1].nodes.find(node => node.prop === prop)?.value
  eq(decl('[data-studio-p2-details] .sp-p2-tabs', 'border-bottom'), '1px solid var(--sp-line)', `${label}: one rule under the tab row`)
  eq(decl('[data-studio-p2-details] .sp-p2-tabs button[aria-selected="true"]', 'border-bottom-color'), 'var(--sp-teal)', `${label}: the selected tab is underlined in teal`)
  eq(decl('[data-studio-p2-details] .sp-p2-tabs button', 'border-bottom'), '2px solid transparent', `${label}: an unselected tab has no underline`)
  eq(decl('[data-studio-p2-details] .sp-p2-tabs button', 'margin-bottom'), '-1px', `${label}: the tab underline sits on the rule`)
  eq(decl('[data-studio-p2-details] .sp-p2-tabs button[aria-selected="true"]', 'color'), 'var(--sp-text)', `${label}: the selected tab is the strong ink`)
  eq(decl('[data-studio-p2-details] .sp-p2-tabs button', 'color'), 'var(--sp-muted)', `${label}: the others are muted`)
  eq(decl('[data-studio-p2-details] .sp-p2-scope-pill', 'color'), 'var(--sp-teal)', `${label}: the scope pill`)
  eq(decl('[data-studio-p2-details] .sp-p2-presets .sp-button[aria-pressed="true"]', 'border-color'), 'var(--sp-teal)', `${label}: the chosen preset`)
  eq(decl('[data-studio-p2-details] .sp-p2-tokens button', 'background'), 'var(--sp-surface)', `${label}: field chips`)
  eq(decl('[data-studio-p2-details] .sp-p2-presets button:disabled', 'opacity'), '.55', `${label}: disabled chips and presets are dimmed`)
  eq(decl('[data-studio-p2-details] .sp-field input:disabled', 'cursor'), 'not-allowed', `${label}: a hidden footer's input is read-only`)
  eq(decl('[data-studio-p2-details] .sp-sample-footer > span:first-child:empty', 'display'), 'none', `${label}: an empty footer corner takes no room`)
  const phone = (selector, prop) => rules.find(([sel, rule]) => sel === selector && rule.parent?.type === 'atrule' && /max-width:\s*620px/.test(rule.parent.params))?.[1].nodes.find(node => node.prop === prop)?.value
  eq(phone('[data-studio-p2-details] .sp-p2-tabs', 'overflow-x'), 'auto', `${label}: the tabs scroll on a phone`)
  eq(phone('[data-studio-p2-details] .sp-p2-tabs button', 'white-space'), 'nowrap', `${label}: and keep their words on one line`)
  eq(decl('.dark [data-studio-p2-details] .sp-field input[aria-invalid="true"]', 'border-color'), '#f4aaa0', `${label}: the invalid border has a dark colour`)
}
function proveCssShell(css, label = 'shell css') {
  const rules = selectorsOf(css)
  ok(rules.length >= 8, `${label}: has its rules`)
  for (const [selector] of rules) match(selector, /data-studio-p2-new-deck|data-studio-p2-rail/, `${label}: scoped to a marker only the flag renders: ${selector}`)
  for (const decl of declsOf(css)) {
    for (const [, name] of decl.value.matchAll(/var\((--[a-z-]+)/g)) ok(SS_LIGHT.has(name) && SS_DARK.has(name), `${label}: ${decl.prop}: token ${name} exists in light and dark`)
    ok(!/#[0-9a-f]{3,8}\b|rgb\(/i.test(decl.value), `${label}: no literal colour (${decl.prop}: ${decl.value})`)
  }
  const decl = (selector, prop) => rules.find(([sel]) => sel === selector)?.[1].nodes.find(node => node.prop === prop)?.value
  eq(decl('[data-studio-v4-rail][data-studio-p2-rail="true"] nav [aria-current="page"]::before', 'width'), '2px', `${label}: the current-page bar is 2px`)
  eq(decl('[data-studio-v4-rail][data-studio-p2-rail="true"] nav [aria-current="page"]::before', 'left'), '-8px', `${label}: at the rail's left edge (the 40px tile sits 8px in)`)
  eq(decl('[data-studio-v4-rail][data-studio-p2-rail="true"] nav [aria-current="page"]::before', 'background'), 'var(--ss-teal)', `${label}: in the shell's teal`)
  eq(decl('[data-studio-v4-rail][data-studio-p2-rail="true"] nav [aria-current="page"]', 'position'), 'relative', `${label}: anchored to the tile`)
  eq(decl('[data-studio-v4-rail][data-studio-p2-rail="true"] .studio-rail-brand::after', 'height'), '1px', `${label}: the brand divider is a hairline`)
  eq(decl('[data-studio-v4-rail][data-studio-p2-rail="true"] .studio-rail-brand::after', 'background'), 'var(--ss-line)', `${label}: in the shell's line colour`)
  eq(decl('[data-studio-v4-shell="true"] [data-studio-p2-new-deck="true"]', 'border'), '1px solid var(--ss-line)', `${label}: "+ Presentation" is the bordered one (Back to Studio is the quiet one)`)
  eq(decl('[data-studio-v4-shell="true"] [data-studio-p2-new-deck="true"]', 'background'), 'var(--ss-panel)', `${label}: on the panel colour`)
  eq(decl('[data-studio-v4-shell="true"] [data-studio-p2-new-deck="true"]', 'height'), '34px', `${label}: as tall as Back to Studio`)
  eq(decl('[data-studio-v4-shell="true"] span + [data-studio-p2-new-deck="true"]', 'margin-left'), 'auto', `${label}: without Back to Studio it goes to the right`)
  const narrow = (selector, prop) => rules.find(([sel, rule]) => sel === selector && rule.parent?.type === 'atrule' && /max-width:\s*666px/.test(rule.parent.params))?.[1].nodes.find(node => node.prop === prop)?.value
  eq(narrow('[data-studio-v4-shell="true"] [data-studio-p2-new-deck="true"] span', 'display'), 'none', `${label}: icon only on a narrow bar`)
  eq(narrow('[data-studio-v4-shell="true"] [data-studio-p2-new-deck="true"]', 'width'), '34px', `${label}: a square button there`)
}
function proveEnv(env, label = 'env') {
  match(env, new RegExp(`^${FLAG}="false"$`, 'm'), `${label}: documented, default off`)
  eq(env.split(`${FLAG}=`).length - 1, 1, `${label}: once`)
  ok(env.indexOf(`# PASS2 DET-01/02/03/04/06/12`) < env.indexOf(`${FLAG}=`), `${label}: with its comment above`)
}
function provePackage(pkg, label = 'package') {
  eq(JSON.parse(pkg).scripts['test:studio-p2-details'], 'node scripts/test-studio-p2-details.mjs', `${label}: registered`)
}
proveCssPage(SOURCES[CSS_PAGE]); proveCssShell(SOURCES[CSS_SHELL]); proveEnv(SOURCES[ENV]); provePackage(SOURCES[PKG])

// ---------------------------------------------------------------- 6. mutation check
const MUTANTS = []
const mutant = (file, name, from, to) => MUTANTS.push([file, name, from, to])
// lib
mutant(LIB, 'default footer changed', "export const STUDIO_DETAILS_DEFAULT_FOOTER = '{author} · {role} · {company} | {page}/{total}'", "export const STUDIO_DETAILS_DEFAULT_FOOTER = '{author} | {page}/{total}'")
mutant(LIB, 'preset dropped', "  { label: 'Title + Page', value: '{title} | {page}' },\n", '')
mutant(LIB, 'preset wrong', "{ label: 'Page X of Y', value: 'Page {page} of {total}' }", "{ label: 'Page X of Y', value: 'Page {page}/{total}' }")
mutant(LIB, 'field chip dropped', "'confidentiality', 'email', 'website']", "'confidentiality', 'email']")
mutant(LIB, 'footer limit', 'export const STUDIO_DETAILS_FOOTER_MAX = 200', 'export const STUDIO_DETAILS_FOOTER_MAX = 400')
mutant(LIB, 'reusable defaults word', "scope: 'This presentation',", "scope: 'Reusable defaults',")
mutant(LIB, 'save word', "save: 'Save to this presentation',", "save: 'Save as defaults',")
mutant(LIB, 'month off by one', 'MONTHS[now.getMonth()]', 'MONTHS[now.getMonth() + 1]')
mutant(LIB, 'hidden footer still written', 'if (!draft.showFooter) return null', '')
mutant(LIB, 'detail token kept for the deck', 'if (DETAIL_TOKENS.includes(key)) { changed = true; return filled[key] }', 'if (DETAIL_TOKENS.includes(key)) return whole')
mutant(LIB, 'details not trimmed', "role: draft.role.trim(), company: draft.company.trim(),", "role: draft.role, company: draft.company,")
mutant(LIB, 'empty author token stays', "if (key === 'author' && !author) { changed = true; return '' }", '')
mutant(LIB, 'author not trimmed', "const author = draft.author.trim()\n  const date", "const author = draft.author\n  const date")
mutant(LIB, 'date not trimmed', 'const date = draft.date.trim() || studioDetailsAutoDate(now)', 'const date = draft.date || studioDetailsAutoDate(now)')
mutant(LIB, 'no auto date', 'const date = draft.date.trim() || studioDetailsAutoDate(now)', "const date = draft.date.trim()")
mutant(LIB, 'always tidy', 'const template = changed ? tidy(resolved) : resolved.trim()', 'const template = tidy(resolved)')
mutant(LIB, 'never tidy', 'const template = changed ? tidy(resolved) : resolved.trim()', 'const template = resolved.trim()')
mutant(LIB, 'tidy joins with a bar', "filter(part => part.trim()).join(' · ')", "filter(part => part.trim()).join(' | ')")
mutant(LIB, 'tidy keeps empty parts', 'filter(part => part.trim()).join', 'join')
mutant(LIB, 'empty template written', "  if (!template) return null\n  const values", "  const values")
mutant(LIB, 'author value always', "if (/\\{author\\}/.test(template)) values.author = author", "values.author = author")
mutant(LIB, 'author value never', "if (/\\{author\\}/.test(template)) values.author = author", "")
mutant(LIB, 'date value always', "if (/\\{date\\}/.test(template)) values.date = date", "values.date = date")
mutant(LIB, 'date value never', "if (/\\{date\\}/.test(template)) values.date = date", "")
mutant(LIB, 'preview: title not filled', "const values: Record<string, string> = { ...footer.values, title, page: String(page), total: String(total) }", "const values: Record<string, string> = { ...footer.values, page: String(page), total: String(total) }")
mutant(LIB, 'preview: page not 1-based', "page: String(page),", "page: String(page + 1),")
mutant(LIB, 'preview: unknown token blanked', "(LAYOUT_TOKENS.includes(key) ? (values[key] ?? '') : whole)", "(values[key] ?? '')")
mutant(LIB, 'preview: no footer is a space', "if (!footer) return ''", "if (!footer) return ' '")
mutant(LIB, 'logo: http allowed', "/^https:\\/\\/[^\\s]+$/i", "/^https?:\\/\\/[^\\s]+$/i")
mutant(LIB, 'logo: bare https allowed', "/^https:\\/\\/[^\\s]+$/i", "/^https:\\/\\/[^\\s]*$/i")
mutant(LIB, 'logo: spaces allowed', "/^https:\\/\\/[^\\s]+$/i", "/^https:\\/\\/.+$/i")
mutant(LIB, 'logo: case sensitive', "/^https:\\/\\/[^\\s]+$/i", "/^https:\\/\\/[^\\s]+$/")
mutant(LIB, 'logo: empty invalid', "return !value || (value.length", "return (value.length")
mutant(LIB, 'logo: no length limit', 'value.length <= STUDIO_DETAILS_LOGO_MAX && ', '')
mutant(LIB, 'logo: not trimmed', "typeof logoUrl === 'string' ? logoUrl.trim() : ''", "typeof logoUrl === 'string' ? logoUrl : ''")
mutant(LIB, 'logo: alt too long', '.slice(0, 100) }', '.slice(0, 300) }')
mutant(LIB, 'logo: alt from nowhere', "(company ? `${company} logo` : 'Presentation logo')", "'Presentation logo'")
mutant(LIB, 'logo: invalid written', "if (!url || !studioDetailsLogoValid(url)) return null", "if (!url) return null")
mutant(LIB, 'valid: footer length ignored', 'const footer = (studioDetailsDeckFooter(draft, now)?.template.length ?? 0) <= STUDIO_DETAILS_FOOTER_MAX', 'const footer = true')
mutant(LIB, 'valid: length before filling', 'const footer = (studioDetailsDeckFooter(draft, now)?.template.length ?? 0) <= STUDIO_DETAILS_FOOTER_MAX', 'const footer = draft.footer.length <= STUDIO_DETAILS_FOOTER_MAX')
mutant(LIB, 'valid: length off by one', '.template.length ?? 0) <= STUDIO_DETAILS_FOOTER_MAX', '.template.length ?? 0) < STUDIO_DETAILS_FOOTER_MAX')
mutant(LIB, 'valid: ok ignores the logo', 'ok: logo && footer', 'ok: footer')
mutant(LIB, 'valid: ok ignores the footer', 'ok: logo && footer', 'ok: logo')
mutant(LIB, 'merge: sources dropped', 'next.footer = { ...(previous ?? {}), template', 'next.footer = { template')
mutant(LIB, 'merge: old values dropped', 'for (const [key, value] of Object.entries(previous.values)) if', 'for (const [key, value] of []) if')
mutant(LIB, 'merge: new author not written', "if (/\\{author\\}/.test(template)) values.author = author", "")
mutant(LIB, 'merge: other keys dropped', 'const next: Record<string, unknown> = { ...base }', 'const next: Record<string, unknown> = {}')
mutant(LIB, 'merge: old logo kept', '  delete next.logo\n', '')
mutant(LIB, 'merge: old footer kept', '  delete next.footer\n', '')
mutant(LIB, 'merge: alt text always rewritten', "if (!draft.company.trim() && was && was.image_url === logo.image_url && text(was.alt_text).trim()) logo.alt_text", "if (false) logo.alt_text")
mutant(LIB, 'merge: alt kept for another logo', 'was.image_url === logo.image_url && ', '')
mutant(LIB, 'merge: alt kept over a typed organization', 'if (!draft.company.trim() && was', 'if (was')
mutant(LIB, 'merge: input mutated', 'const next: Record<string, unknown> = { ...base }\n  delete next.footer', 'const next: Record<string, unknown> = base\n  delete next.footer')
mutant(LIB, 'would change: always', 'return JSON.stringify(canon(studioDetailsMergeDerivative(existing, draft, now))) !== JSON.stringify(canon(isObject(existing) ? existing : {}))', 'return true')
mutant(LIB, 'would change: never', 'return JSON.stringify(canon(studioDetailsMergeDerivative(existing, draft, now))) !== JSON.stringify(canon(isObject(existing) ? existing : {}))', 'return false')
mutant(LIB, 'would change: key order matters', 'const canon = (value: unknown): unknown => Array.isArray(value) ? value.map(canon) : isObject(value) ? Object.fromEntries(Object.keys(value).sort()', 'const canon = (value: unknown): unknown => Array.isArray(value) ? value.map(canon) : isObject(value) ? Object.fromEntries(Object.keys(value).reverse()')
mutant(LIB, 'from deck: template ignored', 'draft.footer = text(footer.template)', "draft.footer = draft.footer")
mutant(LIB, 'from deck: author ignored', "draft.author = text(values.author).trim() || draft.author", 'draft.author = draft.author')
mutant(LIB, 'from deck: author not trimmed', "draft.author = text(values.author).trim() || draft.author", 'draft.author = text(values.author) || draft.author')
mutant(LIB, 'from deck: date ignored', 'draft.date = text(values.date)', "draft.date = ''")
mutant(LIB, 'from deck: blank template taken', "if (footer && text(footer.template).trim()) {", 'if (footer) {')
mutant(LIB, 'from deck: http logo taken', 'if (logo && studioDetailsLogoValid(text(logo.image_url))) draft.logoUrl', 'if (logo) draft.logoUrl')
mutant(LIB, 'from deck: logo ignored', 'draft.logoUrl = text(logo.image_url)', "draft.logoUrl = ''")
mutant(LIB, 'target: active version ignored', "[active, 'final', 'strawman', 'blank']", "['final', 'strawman', 'blank']")
mutant(LIB, 'target: prototype key', "Object.prototype.hasOwnProperty.call(ids, name) && ids[name]", "ids[name]")
mutant(LIB, 'target: strawman before final', "[active, 'final', 'strawman', 'blank']", "[active, 'strawman', 'final', 'blank']")
mutant(LIB, 'target: blank first', "[active, 'final', 'strawman', 'blank']", "[active, 'blank', 'final', 'strawman']")
mutant(LIB, 'target: id not trimmed', "final: text(session.finalPresentationId).trim()", "final: text(session.finalPresentationId)")
mutant(LIB, 'target: title not trimmed', "title: text(session.title).trim()", "title: text(session.title)")
mutant(LIB, 'target: strawman unused', "strawman: text(session.strawmanPresentationId).trim(), ", "strawman: '', ")
// the page
mutant(UI, 'account tab not first', 'const SECTIONS: readonly { id: Section; label: string; Icon: typeof UserRound }[] = [{ id: "account", label: "Account", Icon: UserRound }, { id: "profile", label: "Profile", Icon: UserRound }', 'const SECTIONS: readonly { id: Section; label: string; Icon: typeof UserRound }[] = [{ id: "profile", label: "Profile", Icon: UserRound }, { id: "account", label: "Account", Icon: UserRound }')
mutant(UI, 'tab renamed', '{ id: "slides", label: "Slide details", Icon: FileText }', '{ id: "slides", label: "Footer & logo", Icon: FileText }')
mutant(UI, 'tabs not tabs', 'role="tab" aria-selected={section === id}', 'aria-pressed={section === id}')
mutant(UI, 'two tab stops', 'tabIndex={section === id ? 0 : -1}', 'tabIndex={0}')
mutant(UI, 'arrow right backwards', 'if (event.key === "ArrowRight") next = (index + 1) % SECTIONS.length', 'if (event.key === "ArrowRight") next = (index + SECTIONS.length - 1) % SECTIONS.length')
mutant(UI, 'arrow left does not wrap', 'else if (event.key === "ArrowLeft") next = (index + SECTIONS.length - 1) % SECTIONS.length', 'else if (event.key === "ArrowLeft") next = Math.max(0, index - 1)')
mutant(UI, 'home missing', 'else if (event.key === "Home") next = 0\n', '')
mutant(UI, 'end missing', 'else if (event.key === "End") next = SECTIONS.length - 1\n', '')
mutant(UI, 'other keys swallowed', 'else return\n    event.preventDefault()', 'event.preventDefault()')
mutant(UI, 'focus not moved', "document.getElementById(`${baseId}-${SECTIONS[next].id}-tab`)?.focus()", '')
mutant(UI, 'account editor missing', '<div className="sp-account-pane" hidden={section !== "account"}><AccountProfileEditor /></div>', '')
mutant(UI, 'account editor unmounted off Account', '<div className="sp-account-pane" hidden={section !== "account"}><AccountProfileEditor /></div>', '{section === "account" ? <div className="sp-account-pane"><AccountProfileEditor /></div> : null}')
mutant(UI, 'sample slide shown on Account', '<aside className="sp-identity-preview" hidden={section === "account"}', '<aside className="sp-identity-preview" hidden={false}')
mutant(UI, 'explore opens the wrong tab', 'onPresenterPreview={() => setSection("profile")}', 'onPresenterPreview={() => setSection("slides")}')
mutant(UI, 'badge words', 'section === "account" ? "Your account" : "This presentation"', 'section === "account" ? "Your account" : "Local draft preview"')
mutant(UI, 'scope strip on Account', '{section !== "account" && <>\n        <div className="sp-p2-scope"', '{true && <>\n        <div className="sp-p2-scope"')
mutant(UI, 'scope pill words', '{STUDIO_DETAILS_WORDS.scope}</span></div>', 'Reusable defaults</span></div>')
mutant(UI, 'scope note without deck', '<><strong>{deck.title || "Your open presentation"}</strong> · {STUDIO_DETAILS_WORDS.scopeNote}</>', 'STUDIO_DETAILS_WORDS.scopeNote')
mutant(UI, 'scope note state not exposed', 'data-studio-p2-scope-note={deck.status}', 'data-studio-p2-scope-note="ready"')
mutant(UI, 'scope note not announced', '<p className="sp-p2-scope-note" role="status"', '<p className="sp-p2-scope-note"')
mutant(UI, 'no-deck words', 'deck.status === "error" ? STUDIO_DETAILS_WORDS.scopeError : STUDIO_DETAILS_WORDS.scopeNone', 'STUDIO_DETAILS_WORDS.scopeError')
mutant(UI, 'session read cached', '{ signal: controller.signal, cache: "no-store" })\n        if (sessionResponse.status', '{ signal: controller.signal })\n        if (sessionResponse.status')
mutant(UI, 'deck read cached', '{ signal: controller.signal, cache: "no-store" })\n        if (!layoutResponse.ok)', '{ signal: controller.signal })\n        if (!layoutResponse.ok)')
mutant(UI, 'new session is a deck', 'if (!sessionId || sessionId === "new")', 'if (!sessionId)')
mutant(UI, 'deleted session is an error', 'if (sessionResponse.status === 404 || sessionResponse.status === 410) { setDeck({ status: "none" }); return }', '')
mutant(UI, 'gone session is not 410', 'sessionResponse.status === 404 || sessionResponse.status === 410', 'sessionResponse.status === 404')
mutant(UI, 'session failure is none', 'if (!sessionResponse.ok) { setDeck({ status: "error" }); return }', 'if (!sessionResponse.ok) { setDeck({ status: "none" }); return }')
mutant(UI, 'no presentation is an error', 'if (!target) { setDeck({ status: "none" }); return }', 'if (!target) { setDeck({ status: "error" }); return }')
mutant(UI, 'missing layout service read anyway', 'if (LAYOUT_URL_CONFIG_ERROR) { setDeck({ status: "error" }); return }', '')
mutant(UI, 'deck read failure is none', 'if (!layoutResponse.ok) { setDeck({ status: "error" }); return }', 'if (!layoutResponse.ok) { setDeck({ status: "none" }); return }')
mutant(UI, 'deck read wrong path', '/derivative-elements`, { signal', '/slides`, { signal')
mutant(UI, 'deck id not encoded', '${encodeURIComponent(target.presentationId)}/derivative-elements`, { signal', '${target.presentationId}/derivative-elements`, { signal')
mutant(UI, 'session id not encoded', '/api/sessions/${encodeURIComponent(sessionId)}', '/api/sessions/${sessionId}')
mutant(UI, 'draft not loaded from the deck', 'if (!edited.current) { const fromDeck = studioDetailsDraftFromDeck(existingElements, accountName); setDraft(fromDeck); setLoaded(fromDeck) }', '')
mutant(UI, 'deck load overwrites typing', 'if (!edited.current) { const fromDeck', 'if (true) { const fromDeck')
mutant(UI, 'loaded draft is unsaved', 'setDraft(fromDeck); setLoaded(fromDeck) }', 'setDraft(fromDeck) }')
mutant(UI, 'read not aborted', 'return () => controller.abort()', 'return () => {}')
mutant(UI, 'leave warning never', 'if (!dirty) return\n    const beforeUnload', 'if (true) return\n    const beforeUnload')
mutant(UI, 'leave warning always', 'if (!dirty) return\n    const beforeUnload', 'if (false) return\n    const beforeUnload')
mutant(UI, 'edit does not mark the draft', 'edited.current = true\n    setDraft(previous', 'setDraft(previous')
mutant(UI, 'save when nothing changed', 'check.ok && !saving && studioDetailsWouldChange(existing, draft, now)', 'check.ok && !saving')
mutant(UI, 'save without a deck', 'const canSave = deck.status === "ready" && check.ok', 'const canSave = check.ok')
mutant(UI, 'save an invalid draft', 'const canSave = deck.status === "ready" && check.ok &&', 'const canSave = deck.status === "ready" &&')
mutant(UI, 'save twice at once', 'check.ok && !saving && studio', 'check.ok && studio')
mutant(UI, 'save to another path', "derivative-elements?${new URLSearchParams", "slides?${new URLSearchParams")
mutant(UI, 'save is a POST', 'method: "PUT", headers', 'method: "POST", headers')
mutant(UI, 'save without json header', 'headers: { "Content-Type": "application/json" }, body', 'headers: {}, body')
mutant(UI, 'save body is the draft', 'body: JSON.stringify(body),', 'body: JSON.stringify(draft),')
mutant(UI, 'save does not merge', 'const body = studioDetailsMergeDerivative(deck.existing, draft, new Date())', 'const body = studioDetailsMergeDerivative(null, draft, new Date())')
mutant(UI, 'save summary', '"Updated from Your details"', '"x"')
mutant(UI, 'save creator', 'created_by: "user"', 'created_by: "admin"')
mutant(UI, 'failed save looks saved', 'if (!response.ok) throw new Error(String(response.status))', '')
mutant(UI, 'saved deck not remembered', 'setDeck({ ...deck, existing: body })', '')
mutant(UI, 'saved draft still unsaved', 'setLoaded(draft)\n      setStatus(STUDIO_DETAILS_WORDS.saved)', 'setStatus(STUDIO_DETAILS_WORDS.saved)')
mutant(UI, 'saved not said', 'setStatus(STUDIO_DETAILS_WORDS.saved)', '')
mutant(UI, 'failure not said', 'setStatus(STUDIO_DETAILS_WORDS.saveFailed)', '')
mutant(UI, 'saving stuck', 'finally {\n      setSaving(false)', 'finally {\n      ')
mutant(UI, 'reset keeps the draft', 'setDraft(start); setLoaded(start); edited.current = false;', 'edited.current = false;')
mutant(UI, 'reset to the default, not the deck', 'const start = deck.status === "ready" ? studioDetailsDraftFromDeck(deck.existing, accountName) : studioDetailsInitial(accountName)', 'const start = studioDetailsInitial(accountName)')
mutant(UI, 'reset always enabled', 'disabled={!dirty || saving} onClick={reset}', 'onClick={reset}')
mutant(UI, 'profile field dropped', '{ key: "website", label: "Website", placeholder: "Optional", max: 120 }, ', '')
mutant(UI, 'profile field renamed', 'label: "Professional title"', 'label: "Job title"')
mutant(UI, 'logo is a file again', '<input value={draft.logoUrl} placeholder="https://…" inputMode="url"', '<input type="file" value={draft.logoUrl} placeholder="https://…" inputMode="url"')
mutant(UI, 'logo error words', '<p className="sp-error" role="alert">{STUDIO_DETAILS_WORDS.logoInvalid}</p>', '')
mutant(UI, 'logo not marked invalid', 'aria-invalid={!check.logo} onChange', 'onChange')
mutant(UI, 'broken logo not said', '{logoBroken && logoBroken === logoUrl && <p className="sp-error" role="alert">This logo could not be loaded from that address.</p>}', '')
mutant(UI, 'logo preview sends the referrer', 'referrerPolicy="no-referrer"', '')
mutant(UI, 'logo preview of an invalid url', 'const logoUrl = check.logo ? draft.logoUrl.trim() : ""', 'const logoUrl = draft.logoUrl.trim()')
mutant(UI, 'broken logo not remembered', 'onError={() => setLogoBroken(logoUrl)}', 'onError={() => {}}')
mutant(UI, 'broken logo sticks', 'onChange={event => { setLogoBroken(""); change("logoUrl", event.target.value) }}', 'onChange={event => change("logoUrl", event.target.value)}')
mutant(UI, 'show footer missing', 'checked={draft.showFooter} onChange={event => change("showFooter", event.target.checked)}', 'checked={true} onChange={() => {}}')
mutant(UI, 'template editable when hidden', 'maxLength={400} disabled={!draft.showFooter}', 'maxLength={400}')
mutant(UI, 'template room', 'maxLength={400}', 'maxLength={200}')
mutant(UI, 'template error not said', '{!check.footer && <p className="sp-error" role="alert">{STUDIO_DETAILS_WORDS.footerLong}</p>}', '')
mutant(UI, 'template not marked invalid', 'aria-invalid={!check.footer}', '')
mutant(UI, 'preset not pressed', 'aria-pressed={draft.footer === preset.value}', '')
mutant(UI, 'preset does nothing', 'onClick={() => change("footer", preset.value)}', 'onClick={() => {}}')
mutant(UI, 'preset enabled when hidden', 'disabled={!draft.showFooter} aria-pressed', 'aria-pressed')
mutant(UI, 'chip replaces', '`${draft.footer}${draft.footer ? " · " : ""}{${key}}`', '`{${key}}`')
mutant(UI, 'chip joined with nothing', '`${draft.footer}${draft.footer ? " · " : ""}{${key}}`', '`${draft.footer}{${key}}`')
mutant(UI, 'chip enabled when hidden', '<button key={key} type="button" disabled={!draft.showFooter}', '<button key={key} type="button"')
mutant(UI, 'chips not offered', '{STUDIO_DETAILS_FIELD_TOKENS.map(key =>', '{[].map(key =>')
mutant(UI, 'date field gone', '<label className="sp-field"><span>Date</span><input value={draft.date}', '<label className="sp-field"><span>Day</span><input value={draft.date}')
mutant(UI, 'date placeholder', 'placeholder="Auto · current month and year"', 'placeholder=""')
mutant(UI, 'footer text ignores the deck title', 'deck.status === "ready" && deck.title ? deck.title : sampleTitle', 'sampleTitle')
mutant(UI, 'sample total changed', 'studioDetailsFooterText(draft, deck.status === "ready" && deck.title ? deck.title : sampleTitle, page, 8, now)', 'studioDetailsFooterText(draft, deck.status === "ready" && deck.title ? deck.title : sampleTitle, page, 7, now)')
mutant(UI, 'save note without a deck', '{deck.status === "ready" ? STUDIO_DETAILS_WORDS.saveNote : STUDIO_DETAILS_WORDS.noteNone}', '{STUDIO_DETAILS_WORDS.saveNote}')
mutant(UI, 'save button words', '{saving ? STUDIO_DETAILS_WORDS.saving : STUDIO_DETAILS_WORDS.save}', '{saving ? STUDIO_DETAILS_WORDS.saving : "Save as defaults"}')
mutant(UI, 'actions on Account', '{section !== "account" && <div className="sp-draft-actions"', '{true && <div className="sp-draft-actions"')
mutant(UI, 'master hand-off gone', '<StudioWorkflowAction action="master" className="sp-button">Open deck details in Studio</StudioWorkflowAction>', '')
mutant(UI, 'avatar line gone', '<p className="sp-later-note">Presenter avatars and voice are optional later additions.</p>', '')
mutant(UI, 'content toggle gone', '<button type="button" aria-pressed={preview === "content"} onClick={() => setPreview("content")}>Content</button>', '')
// wiring
mutant(DETAILS, 'flag ignored', 'if (process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS === "true") return', 'if (true) return')
mutant(DETAILS, 'flag truthy', 'if (process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS === "true") return', 'if (process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS) return')
mutant(DETAILS, 'flag case', 'process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS === "true") return', 'process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS?.toLowerCase() === "true") return')
mutant(DETAILS, 'wrong user id', 'userId={user.id} accountName', 'userId={user.email} accountName')
mutant(DETAILS, 'page not keyed', '<StudioP2DetailsWorkspace key={user.id} userId', '<StudioP2DetailsWorkspace userId')
mutant(DETAILS, 'old page changed', 'return <DetailsWorkspace key={user.id} accountName={user.name || ""} accountEmail={user.email} accountImage={user.image} />', 'return <DetailsWorkspace key={user.id} accountName={user.name || ""} accountEmail={user.email} />')
mutant(HEADER, 'link ignores the flag', 'const newDeck = process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS === "true" && STUDIO_LIBRARY_BACK_PATHS', 'const newDeck = STUDIO_LIBRARY_BACK_PATHS')
mutant(HEADER, 'link flag truthy', 'const newDeck = process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS === "true" &&', 'const newDeck = process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS &&')
mutant(HEADER, 'link on every page', '&& STUDIO_LIBRARY_BACK_PATHS.includes(pathname) ? <Link data-studio-p2-new-deck', '&& true ? <Link data-studio-p2-new-deck')
mutant(HEADER, 'link to the last session', 'href="/builder?session_id=new"', 'href="/builder"')
mutant(HEADER, 'link words', '<span>Presentation</span></Link> : null', '<span>New</span></Link> : null')
mutant(HEADER, 'link not rendered', '{libraryBack}{newDeck}</div>', '{libraryBack}</div>')
mutant(HEADER, 'link before back', '{libraryBack}{newDeck}</div>', '{newDeck}{libraryBack}</div>')
mutant(HEADER, 'link without the plus', '<Plus className="h-4 w-4" aria-hidden="true" />', '')
mutant(RAIL, 'rail marker ignores the flag', 'data-studio-p2-rail={process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS === "true" ? "true" : undefined}', 'data-studio-p2-rail="true"')
mutant(RAIL, 'rail marker flag truthy', 'process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS === "true" ? "true" : undefined}', 'process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS ? "true" : undefined}')
mutant(RAIL, 'rail marker never', 'process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS === "true" ? "true" : undefined}', 'undefined}')
// css
mutant(CSS_PAGE, 'unscoped rule', '[data-studio-p2-details] .sp-p2-scope-note { margin', '.sp-p2-scope-note { margin')
mutant(CSS_PAGE, 'tab underline not teal', 'button[aria-selected="true"] { color: var(--sp-text); font-weight: 600; border-bottom-color: var(--sp-teal);', 'button[aria-selected="true"] { color: var(--sp-text); font-weight: 600; border-bottom-color: var(--sp-line);')
mutant(CSS_PAGE, 'tab row without a rule', 'margin: 0 0 16px; border-bottom: 1px solid var(--sp-line); }', 'margin: 0 0 16px; border-bottom: 0; }')
mutant(CSS_PAGE, 'tab underline off the rule', 'min-height: 42px; margin-bottom: -1px;', 'min-height: 42px; margin-bottom: 0;')
mutant(CSS_PAGE, 'selected tab muted', 'button[aria-selected="true"] { color: var(--sp-text);', 'button[aria-selected="true"] { color: var(--sp-muted);')
mutant(CSS_PAGE, 'unselected tab not muted', 'background: none; color: var(--sp-muted); font-size: 13px; font-weight: 500; }', 'background: none; color: var(--sp-text); font-size: 13px; font-weight: 500; }')
mutant(CSS_PAGE, 'tabs do not scroll on a phone', '.sp-p2-tabs { overflow-x: auto; scrollbar-width: none; }', '.sp-p2-tabs { overflow-x: visible; scrollbar-width: none; }')
mutant(CSS_PAGE, 'literal colour', 'background: var(--sp-active); color: var(--sp-teal); font-size: 12px; font-weight: 600; }', 'background: #e8f2f0; color: var(--sp-teal); font-size: 12px; font-weight: 600; }')
mutant(CSS_PAGE, 'unknown token', 'color: var(--sp-muted); overflow-wrap: anywhere; }', 'color: var(--sp-faint); overflow-wrap: anywhere; }')
mutant(CSS_PAGE, 'scope pill not teal', 'border: 1px solid var(--sp-teal); border-radius: 8px; background: var(--sp-active); color: var(--sp-teal);', 'border: 1px solid var(--sp-teal); border-radius: 8px; background: var(--sp-active); color: var(--sp-text);')
mutant(CSS_PAGE, 'chosen preset not marked', '.sp-button[aria-pressed="true"] { border-color: var(--sp-teal);', '.sp-button[aria-pressed="true"] { border-color: var(--sp-line);')
mutant(CSS_PAGE, 'chips on the wrong surface', 'border-radius: 6px; background: var(--sp-surface);', 'border-radius: 6px; background: var(--sp-panel);')
mutant(CSS_PAGE, 'disabled chips not dimmed', '.sp-p2-presets button:disabled { opacity: .55; }', '.sp-p2-presets button:disabled { opacity: 1; }')
mutant(CSS_PAGE, 'read-only input looks editable', '.sp-field input:disabled { opacity: .6; cursor: not-allowed; }', '.sp-field input:disabled { opacity: .6; cursor: text; }')
mutant(CSS_PAGE, 'empty footer corner takes room', '.sp-sample-footer > span:first-child:empty { display: none; }', '.sp-sample-footer > span:first-child:empty { display: block; }')
mutant(CSS_PAGE, 'no dark invalid border', '.dark [data-studio-p2-details] .sp-field input[aria-invalid="true"] { border-color: #f4aaa0; }', '.dark [data-studio-p2-details] .sp-field input[aria-invalid="true"] { border-color: #a24133; }')
mutant(CSS_SHELL, 'new deck not bordered', 'color: var(--ss-text); border: 1px solid var(--ss-line); border-radius: 8px; background: var(--ss-panel); }', 'color: var(--ss-text); border: 0; border-radius: 8px; background: var(--ss-panel); }')
mutant(CSS_SHELL, 'new deck height', 'flex-shrink: 0; height: 34px; gap: 6px; margin-left: 6px;', 'flex-shrink: 0; height: 40px; gap: 6px; margin-left: 6px;')
mutant(CSS_SHELL, 'new deck surface', 'border-radius: 8px; background: var(--ss-panel); }', 'border-radius: 8px; background: var(--ss-surface); }')
mutant(CSS_SHELL, 'new deck not pushed right', '[data-studio-v4-shell="true"] span + [data-studio-p2-new-deck="true"] { margin-left: auto; }', '[data-studio-v4-shell="true"] span + [data-studio-p2-new-deck="true"] { margin-left: 0; }')
mutant(CSS_SHELL, 'new deck text on a narrow bar', '[data-studio-v4-shell="true"] [data-studio-p2-new-deck="true"] span { display: none; }', '[data-studio-v4-shell="true"] [data-studio-p2-new-deck="true"] span { display: inline; }')
mutant(CSS_SHELL, 'rail bar width', 'bottom: 11px; width: 2px;', 'bottom: 11px; width: 4px;')
mutant(CSS_SHELL, 'rail bar position', 'left: -8px; top: 11px;', 'left: 0; top: 11px;')
mutant(CSS_SHELL, 'rail bar colour', 'border-radius: 0 2px 2px 0; background: var(--ss-teal); }', 'border-radius: 0 2px 2px 0; background: var(--ss-accent); }')
mutant(CSS_SHELL, 'rail bar not anchored', 'nav [aria-current="page"] { position: relative; }', 'nav [aria-current="page"] { position: static; }')
mutant(CSS_SHELL, 'brand divider thick', 'width: 26px; height: 1px;', 'width: 26px; height: 3px;')
mutant(CSS_SHELL, 'brand divider colour', 'transform: translateX(-50%); background: var(--ss-line); }', 'transform: translateX(-50%); background: var(--ss-text); }')
mutant(CSS_SHELL, 'rail rule unscoped', '[data-studio-v4-rail][data-studio-p2-rail="true"] .studio-rail-brand { position: relative; }', '[data-studio-v4-rail] .studio-rail-brand { position: relative; }')
mutant(CSS_SHELL, 'literal colour', 'background: var(--ss-line); }', 'background: #dde5e2; }')
// env + package
mutant(ENV, 'default on', `${FLAG}="false"`, `${FLAG}="true"`)
mutant(ENV, 'not documented', `${FLAG}="false"\n`, '')
mutant(PKG, 'test not registered', '"test:studio-p2-details": "node scripts/test-studio-p2-details.mjs",\n', '')
mutant(PKG, 'test registered to another file', 'node scripts/test-studio-p2-details.mjs', 'node scripts/test-studio-p2-account.mjs')

let killed = 0
const survivors = [], crashed = []
counting = false
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    if (file === LIB) proveLib(mutated, name)
    else if (file === UI) await proveUi(mutated, SOURCES[LIB], name)
    else if (file === DETAILS) { proveDetailsWiring(mutated, name); identityOff(mutated, SOURCES[HEADER], SOURCES[RAIL], name) }
    else if (file === HEADER) { proveHeader(mutated, name); identityOff(SOURCES[DETAILS], mutated, SOURCES[RAIL], name) }
    else if (file === RAIL) { proveRail(mutated, name); identityOff(SOURCES[DETAILS], SOURCES[HEADER], mutated, name) }
    else if (file === CSS_PAGE) proveCssPage(mutated, name)
    else if (file === CSS_SHELL) proveCssShell(mutated, name)
    else if (file === ENV) proveEnv(mutated, name)
    else if (file === PKG) provePackage(mutated, name)
    survived = true
  } catch (error) { if (error?.code !== 'ERR_ASSERTION') crashed.push(name); killed++ } // a mutant the page cannot survive (it throws) is detected too; it is counted apart
  if (survived) survivors.push(name)
}
counting = true
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(', ')}`)
eq(killed, MUTANTS.length)

console.log(`Studio P2 details (DET-01/02/03/04/06/12): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed (${killed - crashed.length} by an assertion, ${crashed.length} by the code throwing); no network.`)
