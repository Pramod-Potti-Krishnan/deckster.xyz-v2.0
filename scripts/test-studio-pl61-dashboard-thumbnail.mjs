// PL-61 (ARCH-PLATFORM ruling 14:44Z, card 15:27Z): the Decks page (dashboard) draws one live Layout viewer per deck card. With NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED on, a live viewer needs a ticket, which would mean one
// ticket mint per card on page load. Option 3 of the ruling: with that flag on, the card uses the EXISTING first-slide thumbnail (DECK-CARD-THUMBNAIL) and NEVER a live viewer: no ticket per card, no capability on the page.
// Same flag, so it is dark until the flag goes on; flag off, every card is exactly what it was.
//   node scripts/test-studio-pl61-dashboard-thumbnail.mjs      (plain node, offline: the REAL thumbnail hook transpiled and run per environment under a small hook runner; the REAL PresentationPreview cut out of
//   the page by brace matching and rendered with react-dom/server over stand-ins for its hooks.) Mutants change the sources in memory only.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const ts = nodeRequire('typescript')
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const HOOK = 'hooks/use-studio-deck-card-thumbnail.tsx', LIBTHUMB = 'lib/studio-deck-card-thumbnail.ts', PAGE = 'app/(app)/dashboard/page.tsx', TICKET = 'lib/studio-layout-viewer-ticket.ts', POLICY = 'lib/layout-viewer-url-policy.ts'
const real = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
let checks = 0
const check = (name, fn) => { checks++; const r = fn(); if (r && typeof r.then === 'function') return r.then(() => console.log(`PASS ${name}`)); console.log(`PASS ${name}`) }

/** A module (and the repo files it imports, relative or by @/) transpiled and run against a fresh process.env; `stubs` answer by specifier. */
function loadModule(rel, env, { overrides = {}, stubs = {} } = {}) {
  const cache = new Map()
  const get = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }; cache.set(file, module)
    const code = ts.transpileModule(file in overrides ? overrides[file] : real(file), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    const resolve = (spec, from) => { const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(from), spec); return fs.existsSync(path.join(repoRoot, `${base}.ts`)) ? `${base}.ts` : `${base}.tsx` }
    new Function('module', 'exports', 'require', 'process', code)(module, module.exports, spec => (spec in stubs ? stubs[spec] : spec.startsWith('@/') || spec.startsWith('.') ? get(resolve(spec, file)) : nodeRequire(spec)), { env })
    return module.exports
  }
  return get(rel)
}

// ---------------------------------------------------------------------------------------------------------- a tiny hook runner (state / reducer / ref / effect) for the REAL thumbnail hook
function createRunner(callFn, { nullRef } = {}) {
  const slots = []; let idx = 0, dirty = false, effects = [], value
  const api = {
    useState(init) { const i = idx++; if (!(i in slots)) slots[i] = { v: typeof init === 'function' ? init() : init }; const s = slots[i]; return [s.v, nv => { const next = typeof nv === 'function' ? nv(s.v) : nv; if (!Object.is(next, s.v)) { s.v = next; dirty = true } }] },
    useReducer(reducer, init) { const i = idx++; if (!(i in slots)) slots[i] = { v: init }; const s = slots[i]; return [s.v, action => { const next = reducer(s.v, action); if (!Object.is(next, s.v)) { s.v = next; dirty = true } }] },
    useRef(init) { const i = idx++; if (!(i in slots)) slots[i] = { v: init === null && nullRef ? nullRef : { current: init } }; return slots[i].v },
    useEffect(fn, deps) { const i = idx++; const prev = slots[i]; const changed = !prev || !deps || deps.length !== prev.deps.length || deps.some((d, k) => !Object.is(d, prev.deps[k])); if (!changed) return; const holder = { deps, cleanup: prev ? prev.cleanup : undefined }; slots[i] = holder; effects.push(() => { if (holder.cleanup) holder.cleanup(); holder.cleanup = fn() }) },
  }
  const render = () => { for (let n = 0; n < 20; n++) { current = api; idx = 0; dirty = false; effects = []; value = callFn(); for (const e of effects) e(); current = null; if (!dirty) break } return value }
  return { render, unmount: () => { for (const s of slots) if (s && typeof s.cleanup === 'function') s.cleanup() } }
}
let current = null
const reactStub = { useState: i => current.useState(i), useReducer: (r, i) => current.useReducer(r, i), useRef: i => current.useRef(i), useEffect: (f, d) => current.useEffect(f, d) }

const POLICY_MODULE = (() => { const m = { exports: {} }; new Function('module', 'exports', ts.transpileModule(real(POLICY), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(m, m.exports); return m.exports })()
const LAYOUT_POLICY = POLICY_MODULE.createLayoutViewerUrlPolicy('https://layout.test')
const ALLOWED = 'https://layout.test/p/deck-1'

/** What the REAL hook returns for one card, once its effects have run (a fake IntersectionObserver is present, as in a browser). */
function hookAnswer(env, url, overrides = {}) {
  const stubs = { react: reactStub, '@/components/studio-deck-card-thumbnail': { StudioDeckCardThumbnailImage: 'IMAGE', StudioDeckCardThumbnailPending: 'PENDING' }, '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: LAYOUT_POLICY, getLayoutServiceUrl: () => 'https://layout.test' } }
  const saved = globalThis.IntersectionObserver
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} }
  try {
    const mod = loadModule(HOOK, env, { overrides, stubs })
    const decision = POLICY_MODULE.evaluateLayoutViewerUrl(url, LAYOUT_POLICY)
    const runner = createRunner(() => mod.useStudioDeckCardThumbnail(decision, 'Q3 plan'), { nullRef: { current: { box: true } } })
    const out = runner.render(); runner.unmount()
    return out === null ? null : out.type
  } finally { if (saved === undefined) delete globalThis.IntersectionObserver; else globalThis.IntersectionObserver = saved }
}

/** The page's PresentationPreview, cut out by brace matching, run with its free identifiers supplied. */
function cutPreview(text) {
  const start = text.indexOf('function PresentationPreview(')
  assert.ok(start >= 0, 'PresentationPreview is in the page')
  const open = text.indexOf('{\n', text.indexOf(')', start))
  let depth = 0, i = open
  for (; i < text.length; i++) { const c = text[i]; if (c === '{') depth++; else if (c === '}' && --depth === 0) break }
  return text.slice(start, i + 1)
}
const NAMES = ['evaluateLayoutViewerUrl', 'LAYOUT_VIEWER_URL_POLICY', 'studioDeckCardPreviewUrl', 'useStudioDeckCardThumbnail', 'deckTitle', 'viewOnlyIfEnabled', 'isStudioLayoutTicketEnabled', 'process']
function buildPreview(overrides, env, hookValue) {
  const ticketLib = loadModule(TICKET, env)
  const js = ts.transpileModule(`export ${cutPreview(overrides[PAGE] ?? real(PAGE))}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const bag = {}
  const impl = {
    evaluateLayoutViewerUrl: POLICY_MODULE.evaluateLayoutViewerUrl, LAYOUT_VIEWER_URL_POLICY: LAYOUT_POLICY, studioDeckCardPreviewUrl: () => { throw new Error('the slide-count path is off here') }, useStudioDeckCardThumbnail: () => hookValue.value,
    deckTitle: p => p.title, viewOnlyIfEnabled: url => url, isStudioLayoutTicketEnabled: ticketLib.isStudioLayoutTicketEnabled, process: { env },
  }
  new Function('exports', 'require', ...NAMES, js)(bag, spec => nodeRequire(spec), ...NAMES.map(n => impl[n]))
  return presentation => renderToStaticMarkup(bag.PresentationPreview({ presentation }))
}
const DECK = url => ({ title: 'Q3 plan', finalPresentationUrl: url, strawmanPreviewUrl: null })
const THUMB = React.createElement('div', { 'data-test-thumbnail': 'yes' })
const IFRAME = '<iframe src="https://layout.test/p/deck-1" class="w-full h-full pointer-events-none" title="Q3 plan" loading="lazy" tabindex="-1"></iframe>'

const SUITE = {
  /** the hook: the thumbnails are on for the thumbnail flag OR the ticket flag (each the exact "true"); a blocked URL has none. */
  hookFlag(overrides = {}) {
    const answer = (thumb, ticket, url = ALLOWED) => hookAnswer({ NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED: thumb, NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED: ticket }, url, overrides)
    assert.equal(answer('true', undefined), 'PENDING', 'the thumbnail flag alone (as before)'); assert.equal(answer(undefined, 'true'), 'PENDING', 'the ticket flag turns the thumbnails on'); assert.equal(answer('true', 'true'), 'PENDING')
    assert.equal(answer(undefined, undefined), null, 'both off: off (as before)')
    for (const loose of ['TRUE', 'True', '1', 'yes', ' true', 'false', '']) { assert.equal(answer(loose, undefined), null, `thumbnail flag ${JSON.stringify(loose)}`); assert.equal(answer(undefined, loose), null, `ticket flag ${JSON.stringify(loose)}`) }
    assert.equal(answer(undefined, 'true', 'https://evil.test/p/deck-1'), null, 'a blocked URL has no thumbnail (the page then draws the placeholder)'); assert.equal(answer(undefined, 'true', 'https://layout.test/not-a-deck'), null, 'no deck id: none')
  },
  /** the card: flag on never draws a live viewer; flag off is what it was. */
  card(overrides = {}) {
    const ON = { NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED: 'true' }, OFF = {}
    const hook = { value: null }
    let render = buildPreview(overrides, ON, hook)
    hook.value = THUMB; assert.match(render(DECK(ALLOWED)), /data-test-thumbnail/, 'flag on: the thumbnail is drawn'); assert.doesNotMatch(render(DECK(ALLOWED)), /<iframe/)
    hook.value = null
    for (const url of [ALLOWED, 'https://layout.test/p/deck-1?viewOnly=true#/2']) { const html = render(DECK(url)); assert.doesNotMatch(html, /<iframe/, `flag on, thumbnail unavailable: NO live viewer for ${url}`); assert.match(html, /<img src="\/placeholder\.svg" alt="Q3 plan"/); assert.doesNotMatch(html, /Preview unavailable/, 'an allowed URL has no notice') }
    assert.match(render(DECK('https://evil.test/p/deck-1')), /Preview unavailable in this environment/, 'flag on, a blocked URL: placeholder and its notice, as before'); assert.doesNotMatch(render(DECK('https://evil.test/p/deck-1')), /<iframe/)
    assert.doesNotMatch(render(DECK(null)), /<iframe|Preview unavailable/, 'no URL: the plain placeholder')
    render = buildPreview(overrides, OFF, hook)
    assert.equal(render(DECK(ALLOWED)), IFRAME, 'flag off, thumbnail unavailable: EXACTLY the live viewer it was'); hook.value = THUMB; assert.match(render(DECK(ALLOWED)), /data-test-thumbnail/, 'flag off: the hook answer is drawn'); hook.value = null
    assert.match(render(DECK('https://evil.test/p/deck-1')), /Preview unavailable in this environment/)
    for (const loose of ['TRUE', '1', 'false', '']) assert.equal(buildPreview(overrides, { NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED: loose }, hook)(DECK(ALLOWED)), IFRAME, `ticket flag ${JSON.stringify(loose)}: the live viewer, as before`)
  },
}

await check('HOOK the REAL thumbnail hook is on for the thumbnail flag OR the ticket flag (each the exact "true"), off otherwise; a blocked URL or a non-deck URL has no thumbnail', () => SUITE.hookFlag())
await check('CARD flag on: the thumbnail when there is one, otherwise the placeholder (with its notice for a blocked URL), NEVER a live viewer; flag off: exactly the live viewer it was; loose ticket spellings are off', () => SUITE.card())
await check('SOURCE the page has one <iframe>, inside the guarded branch; it imports no ticket hook or wrapper (no ticket mint per card); the library is untouched; the marked lines are the only change', () => {
  const page = real(PAGE)
  assert.equal((page.match(/<iframe/g) ?? []).length, 1, 'one live viewer in the page')
  assert.match(page, /  if \(decision\.status === 'allowed' && liveFrameAllowed\) \{ \/\/ LAYOUT-TICKET-DASHBOARD \(PL-61\)\n    return \(\n      <iframe/)
  assert.doesNotMatch(page, /ViewTicketedIframe|useLayoutViewerTicket|fetchViewerTicket|api\/presentations\/[^\n]*viewer-ticket/, 'no ticket mint in the page')
  assert.equal((page.match(/LAYOUT-TICKET-DASHBOARD/g) ?? []).length, 3, 'three marked lines in the page'); assert.equal((real(HOOK).match(/LAYOUT-TICKET-DASHBOARD/g) ?? []).length, 2, 'two in the hook')
  assert.ok(!/LAYOUT_TICKET/.test(real(LIBTHUMB)), 'the library reads no other flag (its own proof pins that)')
  assert.match(cutPreview(page), /const liveFrameAllowed = !isStudioLayoutTicketEnabled\(\)/)
})
await check('STRIP the registered strip takes the marked lines out and puts the rewritten lines back; other files are untouched; the files and the strip are registered, the strip last', async () => {
  const strip = await import('./studio-pl61-dashboard-thumbnail-strip.mjs'), registry = await import('./studio-later-changes.mjs')
  for (const rel of [PAGE, HOOK]) { const out = strip.stripPl61DashboardThumbnail(rel, real(rel)); assert.ok(!strip.PL61_MARKER_RE.test(out), `${rel}: no marker left`) }
  const page = strip.stripPl61DashboardThumbnail(PAGE, real(PAGE)); assert.ok(page.includes("  if (decision.status === 'allowed') {\n")); assert.ok(!page.includes('liveFrameAllowed'))
  const hook = strip.stripPl61DashboardThumbnail(HOOK, real(HOOK)); assert.ok(hook.includes('  const id = STUDIO_DECK_CARD_THUMBNAILS_ENABLED ? deckCardThumbnailTarget(')); assert.ok(!hook.includes('isStudioLayoutTicketEnabled'))
  assert.equal(strip.stripPl61DashboardThumbnail('lib/x.ts', 'abc'), 'abc')
  for (const rel of strip.PL61_SCOPE_FILES) assert.ok(registry.LATER_CHANGE_FILES.has(rel), `registered: ${rel}`)
  assert.equal(registry.LATER_STRIPS.at(-1), strip.stripPl61DashboardThumbnail, 'the strip is registered, last')
  assert.equal(Object.keys(strip.PL61_REVERSE_HUNKS).length, 8, 'eight older proofs are taught')
  for (const rel of Object.keys(strip.PL61_REVERSE_HUNKS)) { assert.ok(strip.PL61_SCOPE_FILES.has(rel), `${rel}: in the scope`); assert.ok(/registry read \(PL-61\)|, PL-61\)/.test(real(rel)), `${rel}: carries the marker`); assert.ok(!/registry read \(PL-61\)/.test(strip.stripPl61DashboardThumbnail(rel, real(rel))), `${rel}: the strip puts its taught line back`) }
})

// ---------------------------------------------------------------------------------------------------------- mutants (the sources change in memory only)
const rep = (rel, from, to) => { const t = real(rel); assert.ok(t.includes(from), `mutation target in ${rel}: ${from.slice(0, 60)}`); return { [rel]: t.replace(from, to) } }
const ORED = "STUDIO_DECK_CARD_THUMBNAILS_ENABLED || isStudioLayoutTicketEnabled() /* LAYOUT-TICKET-DASHBOARD (PL-61) */ ?"
const MUTANTS = [
  ['the hook ignores the ticket flag', rep(HOOK, ORED, 'STUDIO_DECK_CARD_THUMBNAILS_ENABLED ?'), SUITE.hookFlag],
  ['the hook reads the ticket flag loosely', rep(HOOK, ORED, "STUDIO_DECK_CARD_THUMBNAILS_ENABLED || Boolean(process.env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED) ?"), SUITE.hookFlag],
  ['the hook is on for the ticket flag only', rep(HOOK, ORED, 'isStudioLayoutTicketEnabled() ?'), SUITE.hookFlag],
  ['the hook is on for the ticket flag AND the thumbnail flag', rep(HOOK, ORED, 'STUDIO_DECK_CARD_THUMBNAILS_ENABLED && isStudioLayoutTicketEnabled() ?'), SUITE.hookFlag],
  ['the card still draws the live viewer when the thumbnail is unavailable', rep(PAGE, "  if (decision.status === 'allowed' && liveFrameAllowed) {", "  if (decision.status === 'allowed') {"), SUITE.card],
  ['the card never draws the live viewer, even flag off', rep(PAGE, 'const liveFrameAllowed = !isStudioLayoutTicketEnabled()', 'const liveFrameAllowed = false'), SUITE.card],
  ['the card reads the ticket flag loosely', rep(PAGE, 'const liveFrameAllowed = !isStudioLayoutTicketEnabled()', "const liveFrameAllowed = !process.env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED"), SUITE.card],
  ['the card ignores the thumbnail', rep(PAGE, "  if (deckCardThumbnail) return deckCardThumbnail // DECK-CARD-THUMBNAIL\n", ''), SUITE.card],
  ['the card draws no placeholder for a blocked URL with the flag on', rep(PAGE, "      {decision.status === 'blocked' && (", '      {false && ('), SUITE.card],
]
for (const [name, overrides, suite] of MUTANTS) await check(`MUTANT is caught: ${name}`, async () => {
  let failed = false
  try { await suite(overrides) } catch (error) { failed = true; if (process.env.PL61_DEBUG) console.log(`     caught: ${String(error?.message).split('\n')[0].slice(0, 140)}`) }
  assert.ok(failed, 'the suite did not fail')
})
console.log(`PASS: ${checks} checks passed, 0 failed (${MUTANTS.length} mutants caught)`)
