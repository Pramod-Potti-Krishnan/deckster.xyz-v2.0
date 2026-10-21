// PASS2D T (FRONTEND-1): the deck list draws a clean title for a deck named after an uploaded file. Flag NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES (exact "true"), default off.
//   A template upload starts a session titled "Deck03_Northwind_QBR.pptx — upload 2026-10-12 22:53 UTC [id]" (or "Q3_report_final_v2.pptx"); with the flag on the card says
//   "Deck03 Northwind QBR" / "Q3 report final v2", using the PASS2B G38 cleaner (lib/studio-template-display-name.ts) that the template pickers already use. Any other title is
//   drawn exactly as stored; the stored title stays in a tooltip, in search and in the card's description rule.
//
// Run: node scripts/test-studio-deck-title.mjs   (plain node: transpile + vm, no network, no browser, no env)
//
// Proven on the REAL sources: lib/studio-deck-title.ts, lib/studio-template-display-name.ts, app/(app)/dashboard/page.tsx (PresentationCard) and the pins' strip module:
//   1. the helper over a table of titles (an independent oracle for "is an upload name"), the real cleaner's results, a throwing / empty / non-string cleaner, the tooltip props;
//   2. the card, rendered: flag off (unset, "false", near-misses) every card equals the card of the page with PASS2D T's lines stripped (the base's), for upload and ordinary titles;
//      flag on, an ordinary title is untouched and an upload name is cleaned in the visible title, the open / manage labels and the preview's title and alt, with the stored name
//      in the title's tooltip; the description rule still compares with the STORED title;
//   3. the page source: the flag is read once, exact "true"; the helper calls and the cleaner are wired as designed; the strip module removes exactly PASS2D T's lines;
//   4. mutation check: every mutant of the helper and the page is killed by sections 1-3.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { stripDeckTitle, DECK_TITLE_ADDITIONS } from './studio-deck-title-strip.mjs'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const PAGE = 'app/(app)/dashboard/page.tsx'
const LIB = 'lib/studio-deck-title.ts'
const CLEANER = 'lib/studio-template-display-name.ts'
const CARDS = 'lib/studio-deck-cards.ts'
const FLAG = 'NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES'
const CARDS_V2 = 'NEXT_PUBLIC_STUDIO_DECK_CARDS_V2' // the dev project has it on: a description that repeats the title is not drawn
const SOURCES = { [PAGE]: read(PAGE), [LIB]: read(LIB) }
const CLEANER_SOURCE = read(CLEANER), CARDS_SOURCE = read(CARDS)

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
const UPLOAD_TABLE = [
  ['Deck03_Northwind_QBR.pptx — upload 2026-10-12 22:53 UTC [f1x7ure0-0000-4000-8000-n0rthw1nd030]', 'Deck03 Northwind QBR'],
  ['J1-rollout-40-stores.pptx — upload 2026-10-13 18:02 UTC [a1b2c3d4]', 'J1-rollout-40-stores'],
  ['Q3_report_final_v2.pptx', 'Q3 report final v2'],
  ['Quarterly review.PPTX', 'Quarterly review'],
  ['Board deck.key', 'Board deck'],
  ['Kickoff.potx', 'Kickoff'],
  ['Strategy - upload 2026-10-12', 'Strategy'],
  ['Strategy – upload 2026-10-12 22:53 UTC', 'Strategy'],
  ['Deck_one.odp', 'Deck one'],
]
const ORDINARY = [
  'Quarterly Review', 'Q3_plan', 'Why upload speed matters', 'Pitch deck [draft]', 'Rolling out AI demand forecasting to 40 stores', 'Untitled Presentation',
  'Our .pptx story', 'upload 2026-10-12', 'The pptx format', 'notes.txt', 'report.pdf', 'Plan - upload speed 2026', '', ' ', 'x'.repeat(1200) + '.pptx',
]
function oracleIsUpload(title) {
  if (typeof title !== 'string' || title.length > 1000) return false
  return /\.(pptx|pptm|ppt|potx|potm|pot|ppsx|ppsm|pps|odp|key)\s*$/i.test(title) || /\s+[—–-]\s+upload\s+\d{4}-\d{2}-\d{2}/i.test(title)
}
function proveLib(libSource, label = 'lib') {
  const lib = loadModule(libSource, LIB, { fallback: false })
  const cleaner = loadModule(CLEANER_SOURCE, CLEANER, { fallback: false }).studioTemplateDisplayName
  for (const [title, want] of UPLOAD_TABLE) {
    ok(lib.isUploadDeckTitle(title), `${label}: ${JSON.stringify(title)} is an upload name`)
    eq(lib.studioDeckShownTitle(title, cleaner), want, `${label}: ${JSON.stringify(title)} -> ${want}`)
  }
  for (const title of ORDINARY) {
    eq(lib.isUploadDeckTitle(title), oracleIsUpload(title), `${label}: ${JSON.stringify(title.slice(0, 40))} per the oracle`)
    if (!oracleIsUpload(title)) eq(lib.studioDeckShownTitle(title, cleaner), title, `${label}: ordinary title ${JSON.stringify(title.slice(0, 40))} unchanged`)
  }
  for (const title of [...UPLOAD_TABLE.map(([t]) => t), ...ORDINARY]) eq(lib.isUploadDeckTitle(title), oracleIsUpload(title), `${label}: oracle agrees on ${JSON.stringify(title.slice(0, 40))}`)
  for (const notString of [undefined, null, 42, {}, []]) { eq(lib.isUploadDeckTitle(notString), false, `${label}: ${JSON.stringify(notString)} is not an upload name`) }
  // the cleaner is injected and only asked about upload names
  let asked = 0
  eq(lib.studioDeckShownTitle('Quarterly Review', () => { asked++; return 'X' }), 'Quarterly Review', `${label}: an ordinary title never reaches the cleaner`)
  eq(asked, 0, `${label}: the cleaner is not called for an ordinary title`)
  eq(lib.studioDeckShownTitle('a.pptx', () => 'Cleaned'), 'Cleaned', `${label}: the cleaner's answer is used`)
  eq(lib.studioDeckShownTitle('a.pptx', () => ''), 'a.pptx', `${label}: an empty answer falls back to the stored title`)
  eq(lib.studioDeckShownTitle('a.pptx', () => '   '), 'a.pptx', `${label}: a blank answer falls back`)
  eq(lib.studioDeckShownTitle('a.pptx', () => undefined), 'a.pptx', `${label}: a non-string answer falls back`)
  eq(lib.studioDeckShownTitle('a.pptx', () => 42), 'a.pptx', `${label}: a number falls back`)
  eq(lib.studioDeckShownTitle('a.pptx', () => { throw new Error('boom') }), 'a.pptx', `${label}: a throwing cleaner falls back`)
  // the tooltip keeps the stored title, only when the shown one differs
  eq(JSON.stringify(lib.studioDeckTitleProps('a.pptx', 'a')), '{"title":"a.pptx"}', `${label}: tooltip props when different`)
  eq(Object.keys(lib.studioDeckTitleProps('same', 'same')).length, 0, `${label}: no key at all when equal`)
  eq(Object.keys(lib.studioDeckTitleProps(undefined, 'x')).length, 0, `${label}: no key for a non-string stored title`)
  eq(Object.keys(lib.studioDeckTitleProps('x', undefined)).length, 0, `${label}: no key for a non-string shown title`)
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
    '@/lib/studio-template-display-name': loadModule(CLEANER_SOURCE, CLEANER, { fallback: false }),
    '@/lib/studio-deck-title': loadModule(libSource, LIB, { fallback: false }),
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
  const expanded = typeof node.type === 'function' ? node.type(node.props) : null
  if (expanded !== null) return findAll(expanded, predicate, out)
  if (predicate(node)) out.push(node)
  findAll(node.props.children, predicate, out)
  return out
}
const getStatusColor = status => `color-${status}`
const getStageName = stage => ({ 4: 'Preview Ready', 6: 'Complete' }[stage] ?? 'Unknown')
const deck = (id, title, extra = {}) => ({ id, title, description: title, createdAt: '2026-10-10T09:00:00Z', updatedAt: '2026-10-10T09:30:00Z', slideCount: 4, status: 'completed', thumbnail: '/placeholder.svg', folder: 'general', tags: [], strawmanPreviewUrl: null, finalPresentationUrl: `${LAYOUT}p/${id}`, currentStage: 6, ...extra })
const FIXTURES = [
  ...UPLOAD_TABLE.map(([title], i) => deck(`up-${i}`, title)),
  ...UPLOAD_TABLE.slice(0, 3).map(([title], i) => deck(`up-d-${i}`, title, { description: 'Make this for the regional ops review' })),
  ...ORDINARY.filter(title => title.trim()).map((title, i) => deck(`ord-${i}`, title)),
  deck('strawman', 'Q3_report_final_v2.pptx', { status: 'in-progress', currentStage: 4, finalPresentationUrl: null, strawmanPreviewUrl: `${LAYOUT}p/strawman` }),
  deck('no-preview', 'Deck03_Northwind_QBR.pptx — upload 2026-10-12 22:53 UTC [f1x7]', { finalPresentationUrl: null }),
]
const render = (Card, presentation, withDelete) => Card({ presentation, onOpen() {}, getStatusColor, getStageName, ...(withDelete ? { onDelete() {}, deleteDisabled: false } : {}) })
const NEAR_MISSES = [undefined, '', 'false', '1', 'TRUE', 'True', ' true', 'true ', 'yes']

function proveCard(pageSource, libSource, label = 'card') {
  const baseCard = loadCard(stripDeckTitle(pageSource), libSource, { [CARDS_V2]: 'true' })
  const offCards = NEAR_MISSES.map(value => [value, loadCard(pageSource, libSource, value === undefined ? { [CARDS_V2]: 'true' } : { [CARDS_V2]: 'true', [FLAG]: value })])
  const onCard = loadCard(pageSource, libSource, { [CARDS_V2]: 'true', [FLAG]: 'true' })
  const cleaner = loadModule(CLEANER_SOURCE, CLEANER, { fallback: false }).studioTemplateDisplayName
  for (const presentation of FIXTURES) {
    for (const withDelete of [false, true]) {
      const base = serialise(render(baseCard, presentation, withDelete))
      for (const [value, card] of offCards) eq(serialise(render(card, presentation, withDelete)), base, `${label}: flag ${JSON.stringify(value)}, ${presentation.id}: the base's card`)
    }
    const stored = presentation.title, shown = oracleIsUpload(stored) ? cleaner(stored) : stored
    const on = render(onCard, presentation, true), onHtml = serialise(on)
    const links = findAll(findAll(on, node => node.type === 'CardTitle'), node => node.type === 'Link')
    eq(links.length, 1, `${label}: ${presentation.id}: one title link`)
    eq(links[0].props.children, shown, `${label}: ${presentation.id}: the title shown`)
    if (shown !== stored) {
      eq(links[0].props.title, stored, `${label}: ${presentation.id}: the stored title is the tooltip`)
      nomatch(visibleText(on).join('|'), new RegExp(stored.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label}: ${presentation.id}: no stored upload name is visible`)
      ok(onHtml.includes(`aria-label="Open ${shown} in Studio"`) && onHtml.includes(`aria-label="Manage ${shown}"`), `${label}: ${presentation.id}: the open and manage labels use the shown title`)
    } else {
      eq(onHtml, serialise(render(baseCard, presentation, true)), `${label}: ${presentation.id}: an ordinary title is the base's card`)
      ok(links[0].props.title === undefined, `${label}: ${presentation.id}: no tooltip for an unchanged title`)
    }
  }
  // the preview's iframe title and image alt
  const preview = loadCard(pageSource, libSource, { [CARDS_V2]: 'true', [FLAG]: 'true' })
  const withFrame = serialise(render(preview, deck('p1', 'Q3_report_final_v2.pptx'), false))
  match(withFrame, /<iframe[^>]*title="Q3 report final v2"/, `${label}: the preview frame's title is the shown title`)
  eq(withFrame.split('Q3_report_final_v2.pptx').length - 1, 1, `${label}: the stored name appears once on the card, as the title link's tooltip`)
  match(withFrame, /<Link (?:(?!<Link ).)*?title="Q3_report_final_v2\.pptx".*?>Q3 report final v2<\/Link>/, `${label}: and that is the title link`)
  const noFrame = serialise(render(preview, deck('p2', 'Q3_report_final_v2.pptx', { finalPresentationUrl: null }), false))
  match(noFrame, /<img alt="Q3 report final v2"/, `${label}: the placeholder image's alt is the shown title`)
  // without NEXT_PUBLIC_STUDIO_DECK_CARDS_V2 the card's description is drawn as it always was (the stored name): only the title line changes
  const v2Off = loadCard(pageSource, libSource, { [FLAG]: 'true' }), v2OffBase = loadCard(stripDeckTitle(pageSource), libSource, {})
  const texts = visibleText(render(v2Off, deck('v1', 'Q3_report_final_v2.pptx'), false)), baseTexts = visibleText(render(v2OffBase, deck('v1', 'Q3_report_final_v2.pptx'), false))
  eq(texts[0], 'Q3 report final v2', `${label}: the title line is cleaned without cards-v2 too`)
  eq(texts.slice(1).join('|'), baseTexts.slice(1).join('|'), `${label}: and nothing else on the card changes`)
  // the description rule compares with the STORED title: a description that repeats the stored name stays hidden
  const hidden = visibleText(render(preview, deck('d1', 'Q3_report_final_v2.pptx'), false))
  ok(!hidden.includes('Q3_report_final_v2.pptx'), `${label}: a description that repeats the stored upload name does not come back as text`)
}

// ---------------------------------------------------------------- 3. the page source
function proveSource(pageSource, label = 'page') {
  eq(pageSource.match(/process\.env\.NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES === "true"/g)?.length, 1, `${label}: the flag is read once, exact "true"`)
  eq((pageSource.match(/NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES/g) || []).length >= 2, true, `${label}: the flag name is spelled the same everywhere`)
  match(pageSource, /import \{ studioDeckShownTitle, studioDeckTitleProps \} from "@\/lib\/studio-deck-title"/, `${label}: the helper is imported`)
  match(pageSource, /import \{ studioTemplateDisplayName \} from "@\/lib\/studio-template-display-name"/, `${label}: the #409 cleaner is imported`)
  match(pageSource, /const deckTitle = \(presentation: \{ title: string \}\) => DECK_TITLE_NAMES \? studioDeckShownTitle\(presentation\.title, studioTemplateDisplayName\) : presentation\.title/, `${label}: deckTitle is the flag, the helper and the cleaner`)
  eq((pageSource.match(/deckTitle\(/g) || []).length, 8, `${label}: eight title reads go through deckTitle`)
  eq((pageSource.match(/studioDeckTitleProps\(/g) || []).length, 1, `${label}: one tooltip`)
  match(pageSource, /\{\.\.\.\(DECK_TITLE_NAMES \? studioDeckTitleProps\(presentation\.title, deckTitle\(presentation\)\) : \{\}\)\}/, `${label}: the tooltip is gated and keeps the stored title`)
  eq((pageSource.match(/presentation\.title/g) || []).length, 4, `${label}: raw reads of presentation.title are the helper's own, the tooltip and the description rule`)
  match(pageSource, /deckCardDescription\(presentation\.title, presentation\.description\)/, `${label}: the description rule still compares with the stored title`)
  match(pageSource, /p\.title\.toLowerCase\(\)\.includes\(searchQuery\.toLowerCase\(\)\)/, `${label}: search still matches the stored title`)
  const stripped = stripDeckTitle(pageSource)
  nomatch(stripped, /deckTitle|DECK_TITLE_NAMES|studio-deck-title|studioTemplateDisplayName/, `${label}: the strip removes every trace`)
  for (const [added] of DECK_TITLE_ADDITIONS) eq(pageSource.split(added).length - 1, 1, `${label}: strip entry applies once`)
  nomatch(stripped, /studioDeckShownTitle|studioDeckTitleProps/, `${label}: no helper call left after the strip`)
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
  [LIB, 'extension gate dropped', s => s.replace('return PRESENTATION_EXTENSION.test(title) || UPLOAD_SUFFIX.test(title)', 'return UPLOAD_SUFFIX.test(title)')],
  [LIB, 'suffix gate dropped', s => s.replace('return PRESENTATION_EXTENSION.test(title) || UPLOAD_SUFFIX.test(title)', 'return PRESENTATION_EXTENSION.test(title)')],
  [LIB, 'every title is an upload name', s => s.replace('return PRESENTATION_EXTENSION.test(title) || UPLOAD_SUFFIX.test(title)', 'return true')],
  [LIB, 'extension not anchored', s => s.replace(')\\s*$/i\nconst UPLOAD_SUFFIX', ')/i\nconst UPLOAD_SUFFIX')],
  [LIB, 'suffix without a date', s => s.replace('upload\\s+\\d{4}-\\d{2}-\\d{2}/i', 'upload/i')],
  [LIB, 'length cap dropped', s => s.replace(" || title.length > MAX_TITLE_LENGTH", '')],
  [LIB, 'empty answer accepted', s => s.replace("shown.trim() !== '' ? shown : title", 'true ? shown : title')],
  [LIB, 'blank answer accepted', s => s.replace("shown.trim() !== '' ? shown : title", "shown !== '' ? shown : title")],
  [LIB, 'non-string answer accepted', s => s.replace("typeof shown === 'string' && ", '')],
  [LIB, 'throwing cleaner not caught', s => s.replace('try { shown = clean(title) } catch { return title }', 'shown = clean(title)')],
  [LIB, 'ordinary title cleaned', s => s.replace('if (!isUploadDeckTitle(title)) return title\n', '')],
  [LIB, 'tooltip always', s => s.replace('shown !== stored ? { title: stored } : {}', '{ title: stored }')],
  [LIB, 'tooltip never', s => s.replace('shown !== stored ? { title: stored } : {}', '{}')],
  [LIB, 'tooltip carries the shown title', s => s.replace('{ title: stored } : {}', '{ title: shown } : {}')],
  [PAGE, 'flag loosened', s => s.replace('process.env.NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES === "true"', 'process.env.NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES !== undefined')],
  [PAGE, 'flag inverted', s => s.replace('process.env.NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES === "true"', 'process.env.NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES !== "true"')],
  [PAGE, 'flag wrong name', s => s.replace('process.env.NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES', 'process.env.NEXT_PUBLIC_STUDIO_DECK_TITLES')],
  [PAGE, 'visible title not cleaned', s => s.replace('{deckTitle(presentation)}</Link></CardTitle>', '{presentation.title}</Link></CardTitle>')],
  [PAGE, 'open label not cleaned', s => s.replace('aria-label={`Open ${deckTitle(presentation)} in Studio`}', 'aria-label={`Open ${presentation.title} in Studio`}')],
  [PAGE, 'manage label not cleaned', s => s.replace('aria-label={`Manage ${deckTitle(presentation)}`}', 'aria-label={`Manage ${presentation.title}`}')],
  [PAGE, 'frame title not cleaned', s => s.replace('title={deckTitle(presentation)}', 'title={presentation.title}')],
  [PAGE, 'image alt not cleaned', s => s.replace('alt={deckTitle(presentation)}', 'alt={presentation.title}')],
  [PAGE, 'delete notice not cleaned', s => s.replace('${deckTitle(target.presentation)}', '${target.presentation.title}')],
  [PAGE, 'delete summary not cleaned', s => s.replace('{deleteTarget ? deckTitle(deleteTarget.presentation) : undefined}', '{deleteTarget?.presentation.title}')],
  [PAGE, 'tooltip dropped', s => s.replace(' {...(DECK_TITLE_NAMES ? studioDeckTitleProps(presentation.title, deckTitle(presentation)) : {})}', '')],
  [PAGE, 'tooltip ungated', s => s.replace('{...(DECK_TITLE_NAMES ? studioDeckTitleProps(presentation.title, deckTitle(presentation)) : {})}', '{...studioDeckTitleProps(presentation.title, deckTitle(presentation))}')],
  [PAGE, 'tooltip keeps the shown title', s => s.replace('studioDeckTitleProps(presentation.title, deckTitle(presentation))', 'studioDeckTitleProps(deckTitle(presentation), deckTitle(presentation))')],
  [PAGE, 'description compares with the shown title', s => s.replace('deckCardDescription(presentation.title, presentation.description)', 'deckCardDescription(deckTitle(presentation), presentation.description)')],
  [PAGE, 'search matches the shown title', s => s.replace('p.title.toLowerCase().includes(searchQuery.toLowerCase())', 'deckTitle(p).toLowerCase().includes(searchQuery.toLowerCase())')],
  [PAGE, 'flag-off helper call', s => s.replace('DECK_TITLE_NAMES ? studioDeckShownTitle(presentation.title, studioTemplateDisplayName) : presentation.title', 'studioDeckShownTitle(presentation.title, studioTemplateDisplayName)')],
  [PAGE, 'cleaner swapped for identity', s => s.replace('studioDeckShownTitle(presentation.title, studioTemplateDisplayName)', 'studioDeckShownTitle(presentation.title, name => name)')],
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
console.log(`deck titles: ${realChecks} checks, ${killed}/${mutants.length} mutants killed`)
