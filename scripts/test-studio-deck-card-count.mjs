// PASS2D R5 (FRONTEND-1): a deck card no longer says "3 slides" over a "1 / 1" thumbnail. Flag NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT (exact "true"), default off.
//   Two sources: the session row's slideCount (the card's "<n> slides") and the Layout presentation behind the live thumbnail (its own counter). For a finished deck they are one
//   deck's count; for a deck still in progress the row holds the OUTLINE's count, while the card previewed the FINAL deck first, which for Pilot Results (a row the build before #389 had
//   polluted) was the blank one-slide deck: 3 vs "1 / 1". With the flag on an unfinished deck that has a strawman previews the strawman (the deck its count describes); a finished deck
//   keeps "<n> slides" (and "1 slide"), an unfinished one says "<n> slides planned", and one with no count says "No slides yet".
//
// Run: node scripts/test-studio-deck-card-count.mjs   (plain node: transpile + vm, no network, no browser, no env)
//
// Proven on the REAL sources: lib/studio-deck-card-count.ts and app/(app)/dashboard/page.tsx (PresentationCard, PresentationPreview):
//   1. the helper over a grid of counts x statuses against an independent oracle (non-integers, negatives, strings and missing counts are 0), and the preview choice over statuses x addresses;
//   2. the card, rendered: flag off (unset, "false", near-misses) every card equals the card of the page with PASS2D R5's lines stripped (the base's), for every count and status;
//      flag on, only the count span changes (its text and a marker attribute) and the thumbnail's address (the strawman for an unfinished deck that has one), and the words are the helper's;
//   3. the page source: the flag is read twice (the card, the preview), exact "true"; the label is built from the card's own fields; the strip module removes exactly PASS2D R5's lines;
//   4. mutation check: every mutant of the helper and the page is killed by sections 1-3.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { stripDeckCardCount, DECK_CARD_COUNT_ADDITIONS } from './studio-deck-card-count-strip.mjs'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const PAGE = 'app/(app)/dashboard/page.tsx'
const LIB = 'lib/studio-deck-card-count.ts'
const CARDS = 'lib/studio-deck-cards.ts'
const FLAG = 'NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT'
const CARDS_V2 = 'NEXT_PUBLIC_STUDIO_DECK_CARDS_V2'
const SOURCES = { [PAGE]: read(PAGE), [LIB]: read(LIB) }
const CARDS_SOURCE = read(CARDS)

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
function loadModule(source, fileName, { env = {}, stubs = {}, fallback = true } = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(compile(source, fileName), {
    module: mod, exports: mod.exports, process: { env }, console, Date, Set, Map, Array, encodeURIComponent,
    require: id => {
      if (id in stubs) return stubs[id]
      if (id.endsWith('.css')) return {}
      if (!fallback) throw new Error(`unexpected import ${id}`)
      return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
    },
  })
  return mod.exports
}

// ---------------------------------------------------------------- 1. the helper
const COUNTS = [0, 1, 2, 3, 6, 30, 62, 120, -1, -30, 1.5, 0.5, NaN, Infinity, -Infinity, '3', '', null, undefined, {}, [], true, Number.MAX_SAFE_INTEGER + 2]
const STATUSES = ['completed', 'in-progress', 'draft', 'COMPLETED', '', null, undefined, 3, 'complete']
const oracleCount = n => typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER ? n : 0
function oracleLabel(n, status) {
  const c = oracleCount(n)
  const noun = c === 1 ? 'slide' : 'slides'
  if (status === 'completed') return c + ' ' + noun
  return c > 0 ? c + ' ' + noun + ' planned' : 'No slides yet'
}
const nonEmpty = v => typeof v === 'string' && v !== '' ? v : null
function oraclePreview(card) {
  if (!card || typeof card !== 'object') return null
  const finalUrl = nonEmpty(card.finalPresentationUrl), strawUrl = nonEmpty(card.strawmanPreviewUrl)
  if (card.status !== 'completed' && strawUrl) return strawUrl
  return finalUrl || strawUrl
}
function proveLib(libSource, label = 'lib') {
  const lib = loadModule(libSource, LIB, { fallback: false })
  for (const n of COUNTS) {
    eq(lib.studioDeckCardSlideCount(n), oracleCount(n), `${label}: count of ${String(n)}`)
    for (const status of STATUSES) eq(lib.studioDeckCardCountLabel(n, status), oracleLabel(n, status), `${label}: label for ${String(n)} / ${String(status)}`)
  }
  eq(lib.studioDeckCardCountLabel(3, 'in-progress'), '3 slides planned', `${label}: the Pilot Results case`)
  eq(lib.studioDeckCardCountLabel(1, 'in-progress'), '1 slide planned', `${label}: singular planned`)
  eq(lib.studioDeckCardCountLabel(30, 'completed'), '30 slides', `${label}: a finished deck keeps its words`)
  eq(lib.studioDeckCardCountLabel(1, 'completed'), '1 slide', `${label}: singular finished`)
  eq(lib.studioDeckCardCountLabel(0, 'in-progress'), 'No slides yet', `${label}: no count yet`)
  eq(lib.studioDeckCardCountLabel(0, 'draft'), 'No slides yet', `${label}: a draft with no count`)
  eq(lib.studioDeckCardCountLabel(0, 'completed'), '0 slides', `${label}: a finished deck with no count says what the base says`)
  // the preview choice
  const URLS = [null, undefined, '', 'http://l/p/final', 5, {}]
  const STRAWS = [null, undefined, '', 'http://l/p/straw', 5]
  for (const status of STATUSES) for (const finalUrl of URLS) for (const strawmanUrl of STRAWS) {
    const input = { status, finalPresentationUrl: finalUrl, strawmanPreviewUrl: strawmanUrl }
    eq(lib.studioDeckCardPreviewUrl(input), oraclePreview(input), `${label}: preview for ${JSON.stringify(input)}`)
  }
  for (const bad of [null, undefined, 0, 'x', []]) eq(lib.studioDeckCardPreviewUrl(bad), null, `${label}: preview of ${JSON.stringify(bad)}`)
  eq(lib.studioDeckCardPreviewUrl({ status: 'in-progress', finalPresentationUrl: 'http://l/p/blank', strawmanPreviewUrl: 'http://l/p/straw' }), 'http://l/p/straw', `${label}: the Pilot Results case previews the strawman`)
  eq(lib.studioDeckCardPreviewUrl({ status: 'completed', finalPresentationUrl: 'http://l/p/final', strawmanPreviewUrl: 'http://l/p/straw' }), 'http://l/p/final', `${label}: a finished deck previews its final deck`)
  eq(lib.studioDeckCardPreviewUrl({ status: 'in-progress', finalPresentationUrl: 'http://l/p/final', strawmanPreviewUrl: null }), 'http://l/p/final', `${label}: no strawman, the final deck as before`)
}

// ---------------------------------------------------------------- 2. the card
const jsx = (type, props, key) => ({ type, props: props || {}, key })
const LAYOUT = 'https://layout.example.invalid/'
function loadCard(pageSource, libSource, env) {
  const stubs = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    react: { useState: v => [v, () => {}], useRef: v => ({ current: v }), useCallback: f => f, useEffect: () => {} },
    'next/link': { __esModule: true, default: 'Link' },
    '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {} },
    '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: url => (typeof url === 'string' && url.startsWith(LAYOUT) ? { status: 'allowed', url } : { status: 'empty' }) },
    '@/lib/present-view-only': { viewOnlyIfEnabled: url => url },
    '@/lib/studio-deck-cards': loadModule(CARDS_SOURCE, CARDS),
    '@/lib/studio-deck-card-count': loadModule(libSource, LIB, { fallback: false }),
  }
  return loadModule(`${pageSource}\nexport { PresentationCard };`, PAGE, { env, stubs }).PresentationCard
}
function serialise(node) {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(serialise).join('')
  if (typeof node.type === 'function') return serialise(node.type(node.props))
  const { children, ...rest } = node.props
  const attrs = Object.keys(rest).sort().map(key => typeof rest[key] === 'function' ? `${key}=<fn>` : `${key}=${JSON.stringify(rest[key])}`)
  return `<${node.type}${attrs.length ? ' ' + attrs.join(' ') : ''}>${serialise(children)}</${node.type}>`
}
function visibleText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return []
  if (typeof node === 'string' || typeof node === 'number') return [String(node)]
  if (Array.isArray(node)) return node.flatMap(visibleText)
  if (typeof node.type === 'function') return visibleText(node.type(node.props))
  return visibleText(node.props.children)
}
function findAll(node, predicate, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) { node.forEach(child => findAll(child, predicate, out)); return out }
  if (typeof node.type === 'function') return findAll(node.type(node.props), predicate, out)
  if (predicate(node)) out.push(node)
  findAll(node.props.children, predicate, out)
  return out
}
const getStatusColor = status => `color-${status}`
const getStageName = stage => ({ 4: 'Preview Ready', 6: 'Complete' }[stage] ?? 'Unknown')
const deck = (id, status, slideCount, extra = {}) => ({ id, title: `Deck ${id}`, description: `Deck ${id}`, createdAt: '2026-10-10T09:00:00Z', updatedAt: '2026-10-10T09:30:00Z', slideCount, status, thumbnail: '/placeholder.svg', folder: 'general', tags: [], strawmanPreviewUrl: null, finalPresentationUrl: `${LAYOUT}p/${id}`, currentStage: status === 'completed' ? 6 : 4, ...extra })
const FIXTURES = []
for (const status of ['completed', 'in-progress', 'draft']) for (const n of [0, 1, 3, 30, 62]) FIXTURES.push(deck(`${status}-${n}`, status, n))
FIXTURES.push(deck('strawman-3', 'in-progress', 3, { finalPresentationUrl: null, strawmanPreviewUrl: `${LAYOUT}p/strawman-3` }), deck('nopreview-6', 'in-progress', 6, { finalPresentationUrl: null }),
  deck('pilot', 'in-progress', 3, { finalPresentationUrl: `${LAYOUT}p/blank-1`, strawmanPreviewUrl: `${LAYOUT}p/straw-3` }), deck('done-with-strawman', 'completed', 12, { strawmanPreviewUrl: `${LAYOUT}p/straw-12` }), deck('draft-with-both', 'draft', 0, { strawmanPreviewUrl: `${LAYOUT}p/straw-d` }))
const render = (Card, presentation, withDelete) => Card({ presentation, onOpen() {}, getStatusColor, getStageName, ...(withDelete ? { onDelete() {}, deleteDisabled: false } : {}) })
const NEAR_MISSES = [undefined, '', 'false', '1', 'TRUE', 'True', ' true', 'true ', 'yes']
const countSpan = card => findAll(card, node => node.type === 'span' && node.props['data-studio-deck-count'] === 'true')
const metaSpans = card => { const meta = findAll(card, node => node.type === 'div' && node.props['data-studio-deck-meta'] === 'true'); return meta.length === 1 ? findAll(meta[0].props.children, node => node.type === 'span') : [] }

function proveCard(pageSource, libSource, label = 'card') {
  const lib = loadModule(libSource, LIB, { fallback: false })
  for (const cardsV2 of [false, true]) {
    const baseEnv = cardsV2 ? { [CARDS_V2]: 'true' } : {}
    const baseCard = loadCard(stripDeckCardCount(pageSource), libSource, baseEnv)
    const offCards = NEAR_MISSES.map(value => [value, loadCard(pageSource, libSource, value === undefined ? baseEnv : { ...baseEnv, [FLAG]: value })])
    const onCard = loadCard(pageSource, libSource, { ...baseEnv, [FLAG]: 'true' })
    for (const presentation of FIXTURES) {
      for (const withDelete of [false, true]) {
        const base = serialise(render(baseCard, presentation, withDelete))
        for (const [value, card] of offCards) eq(serialise(render(card, presentation, withDelete)), base, `${label}: flag ${JSON.stringify(value)}, ${presentation.id}: the base's card`)
      }
      const baseTree = render(baseCard, presentation, true), onTree = render(onCard, presentation, true)
      eq(countSpan(baseTree).length, 0, `${label}: the base card has no count marker`)
      const spans = countSpan(onTree)
      eq(spans.length, 1, `${label}: ${presentation.id}: flag on, one count span`)
      eq(visibleText(spans[0]).join(''), lib.studioDeckCardCountLabel(presentation.slideCount, presentation.status), `${label}: ${presentation.id}: the count words`)
      eq(visibleText(spans[0]).join(''), oracleLabel(presentation.slideCount, presentation.status), `${label}: ${presentation.id}: the count words per the oracle`)
      // only that span and the thumbnail's address differ: the rest of the card is the base's
      const baseHtml = serialise(baseTree), onHtml = serialise(onTree)
      const baseSpan = metaSpans(baseTree)[0], onSpan = metaSpans(onTree)[0]
      eq(serialise(baseSpan), `<span>${presentation.slideCount} slides</span>`, `${label}: the base's span`)
      const baseSrc = nonEmpty(presentation.finalPresentationUrl) || nonEmpty(presentation.strawmanPreviewUrl)
      const wantSrc = oraclePreview(presentation)
      const frames = findAll(onTree, node => node.type === 'iframe')
      eq(frames.length, wantSrc ? 1 : 0, `${label}: ${presentation.id}: one thumbnail frame when there is a deck to preview`)
      if (wantSrc) eq(frames[0].props.src, wantSrc, `${label}: ${presentation.id}: the thumbnail previews ${wantSrc}`)
      const expectedHtml = baseSrc && wantSrc && baseSrc !== wantSrc ? baseHtml.replace(`src=${JSON.stringify(baseSrc)}`, `src=${JSON.stringify(wantSrc)}`) : baseHtml
      eq(onHtml.replace(serialise(onSpan), serialise(baseSpan)), expectedHtml, `${label}: ${presentation.id}: nothing else on the card changes`)
      // the thumbnail, title, status pill and the other meta span are untouched
      eq(visibleText(metaSpans(onTree)[1]).join(''), visibleText(metaSpans(baseTree)[1]).join(''), `${label}: the Updated span is the base's`)
    }
  }
  // a finished deck never says "planned", and an unfinished one always does (or has no count)
  const onCard = loadCard(pageSource, libSource, { [FLAG]: 'true' })
  for (const presentation of FIXTURES) {
    const words = visibleText(countSpan(render(onCard, presentation, false))[0]).join('')
    eq(/planned|No slides yet/.test(words), presentation.status !== 'completed', `${label}: ${presentation.id}: planned only while unfinished`)
  }
}

// ---------------------------------------------------------------- 3. the page source
function proveSource(pageSource, label = 'page') {
  eq(pageSource.match(/process\.env\.NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT === "true"/g)?.length, 2, `${label}: the flag is read twice (the card, the preview), exact "true"`)
  eq((pageSource.match(/NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT/g) || []).length >= 3, true, `${label}: the flag name is spelled the same everywhere`)
  match(pageSource, /import \{ studioDeckCardCountLabel, studioDeckCardPreviewUrl \} from "@\/lib\/studio-deck-card-count"/, `${label}: the helpers are imported`)
  match(pageSource, /const candidate = process\.env\.NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT === "true" \? studioDeckCardPreviewUrl\(presentation\) : presentation\.finalPresentationUrl \|\| presentation\.strawmanPreviewUrl/, `${label}: the preview's address, flag on and the base's expression off`)
  eq((pageSource.match(/studioDeckCardPreviewUrl\(/g) || []).length, 1, `${label}: one preview call`)
  eq((pageSource.match(/studioDeckCardCountLabel\(/g) || []).length, 1, `${label}: one call`)
  match(pageSource, /studioDeckCardCountLabel\(presentation\.slideCount, presentation\.status\)/, `${label}: built from the card's own count and status`)
  match(pageSource, /\{slideCountLabel \? <span data-studio-deck-count="true">/, `${label}: gated by the flag constant, on the span`)
  match(pageSource, /: <span>\{presentation\.slideCount\} slides<\/span>\}/, `${label}: the base's span is the other branch`)
  const stripped = stripDeckCardCount(pageSource)
  nomatch(stripped, /slideCountLabel|studio-deck-card-count|DECK_CARD_SLIDE_COUNT|studioDeckCardCountLabel|studioDeckCardPreviewUrl/, `${label}: the strip removes every trace`)
  match(stripped, /const candidate = presentation\.finalPresentationUrl \|\| presentation\.strawmanPreviewUrl\n/, `${label}: the strip restores the base's preview address`)
  for (const [added] of DECK_CARD_COUNT_ADDITIONS) eq(pageSource.split(added).length - 1, 1, `${label}: strip entry applies once`)
  eq(stripped.split('<span>{presentation.slideCount} slides</span>').length - 1, 1, `${label}: the base's span is back after the strip`)
}

function checkAll(src) {
  proveLib(src[LIB])
  proveCard(src[PAGE], src[LIB])
  proveSource(src[PAGE])
}
checkAll(SOURCES)
const realChecks = checks

// ---------------------------------------------------------------- 4. mutants
const mutants = [
  [LIB, 'integers not required', s => s.replace('Number.isSafeInteger(slideCount) && ', '')],
  [LIB, 'zero allowed past the positive check', s => s.replace('(slideCount as number) > 0 ?', '(slideCount as number) >= 0 ? 7 :')],
  [LIB, 'negatives allowed', s => s.replace('(slideCount as number) > 0 ?', 'true ?')],
  [LIB, 'singular dropped', s => s.replace("count === 1 ? 'slide' : 'slides'", "'slides'")],
  [LIB, 'singular for zero', s => s.replace("count === 1 ? 'slide' : 'slides'", "count <= 1 ? 'slide' : 'slides'")],
  [LIB, 'finished deck says planned', s => s.replace("if (status === 'completed') return `${count} ${noun}`", '')],
  [LIB, 'unfinished deck not planned', s => s.replace("return count > 0 ? `${count} ${noun} planned` : 'No slides yet'", "return count > 0 ? `${count} ${noun}` : 'No slides yet'")],
  [LIB, 'no-count words drift', s => s.replace("'No slides yet'", "'0 slides planned'")],
  [LIB, 'finished status loosened', s => s.replace("status === 'completed'", "status !== 'draft'")],
  [LIB, 'finished status case-folded', s => s.replace("status === 'completed'", "String(status).toLowerCase() === 'completed'")],
  [LIB, 'planned word drifts', s => s.replace('} planned`', '} outlined`')],
  [LIB, 'preview: unfinished with strawman still previews final', s => s.replace("if (card.status !== 'completed' && strawmanUrl) return strawmanUrl\n", '')],
  [LIB, 'preview: finished previews the strawman', s => s.replace("card.status !== 'completed' && strawmanUrl", "strawmanUrl")],
  [LIB, 'preview: strawman never', s => s.replace('return finalUrl || strawmanUrl', 'return finalUrl')],
  [LIB, 'preview: final never', s => s.replace('return finalUrl || strawmanUrl', 'return strawmanUrl')],
  [LIB, 'preview: empty strawman accepted', s => s.replace("typeof card.strawmanPreviewUrl === 'string' && card.strawmanPreviewUrl !== '' ? card.strawmanPreviewUrl : null", "typeof card.strawmanPreviewUrl === 'string' ? card.strawmanPreviewUrl : null")],
  [LIB, 'preview: non-string final accepted', s => s.replace("typeof card.finalPresentationUrl === 'string' && card.finalPresentationUrl !== '' ? card.finalPresentationUrl : null", "card.finalPresentationUrl ?? null")],
  [LIB, 'preview: status read as in-progress only', s => s.replace("card.status !== 'completed'", "card.status === 'in-progress'")],
  [PAGE, 'preview without the flag', s => s.replace('const candidate = process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT === "true" ? studioDeckCardPreviewUrl(presentation) :', 'const candidate = studioDeckCardPreviewUrl(presentation) ?? ')],
  [PAGE, 'preview flag inverted', s => s.replace('const candidate = process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT === "true" ?', 'const candidate = process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT !== "true" ?')],
  [PAGE, 'preview base expression changed', s => s.replace(': presentation.finalPresentationUrl || presentation.strawmanPreviewUrl\n', ': presentation.strawmanPreviewUrl || presentation.finalPresentationUrl\n')],
  [PAGE, 'flag loosened', s => s.replace('process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT === "true"', 'process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT !== undefined')],
  [PAGE, 'flag inverted', s => s.replace('process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT === "true"', 'process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT !== "true"')],
  [PAGE, 'flag wrong name', s => s.replace('process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT', 'process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_COUNT')],
  [PAGE, 'count read from the wrong field', s => s.replace('studioDeckCardCountLabel(presentation.slideCount, presentation.status)', 'studioDeckCardCountLabel(presentation.slideCount, presentation.currentStage)')],
  [PAGE, 'status read from the wrong field', s => s.replace('studioDeckCardCountLabel(presentation.slideCount, presentation.status)', 'studioDeckCardCountLabel(presentation.currentStage, presentation.status)')],
  [PAGE, 'marker dropped', s => s.replace(' data-studio-deck-count="true"', '')],
  [PAGE, 'always the helper', s => s.replace('{slideCountLabel ? <span data-studio-deck-count="true">', '{true ? <span data-studio-deck-count="true">')],
  [PAGE, 'never the helper', s => s.replace('{slideCountLabel ? <span data-studio-deck-count="true">', '{false ? <span data-studio-deck-count="true">')],
  [PAGE, 'base branch reworded', s => s.replace(': <span>{presentation.slideCount} slides</span>}', ': <span>{presentation.slideCount} slide(s)</span>}')],
  [PAGE, 'base branch dropped', s => s.replace(' : <span>{presentation.slideCount} slides</span>}', ' : null}')],
]
let killed = 0
const survivors = []
for (const [file, name, mutate] of mutants) {
  const mutated = mutate(SOURCES[file])
  if (mutated === SOURCES[file]) { survivors.push(`${name} (mutation did not apply)`); continue }
  let died = false
  const before = checks
  try { checkAll({ ...SOURCES, [file]: mutated }) } catch { died = true }
  checks = before
  if (died) killed++; else survivors.push(name)
}
eq(survivors.length, 0, `surviving mutants: ${survivors.join('; ')}`)
console.log(`deck card count: ${realChecks} checks, ${killed}/${mutants.length} mutants killed`)
