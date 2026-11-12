// KNOWLEDGE-FILTER-TABS: the Second Brain map's filter as "Everything N" + one tab per kind in plain words (flag NEXT_PUBLIC_STUDIO_KNOWLEDGE_FILTER_TABS, exact
// "true", Studio shell only, default off). Card PASS2-J6-FINDINGS finding L4 (streams/ops/PASS2/J6/RUN.md section 2); mock design/studio-v4-mockup/components/knowledge-map.tsx.
// Offline and self-contained: no network, no browser, no git. Run: node scripts/test-studio-knowledge-filter-tabs.mjs
//   helper     lib/studio-knowledge-filter-tabs.ts on its own (import-free): kind names, the tab row for a set of hidden types, what picking a tab hides;
//   component  components/knowledge/studio-knowledge-filter-tabs.tsx, rendered with the real React: the row, the pressed state, the dots, a click hands on the right set;
//   page       app/(app)/knowledge/page.tsx: the flag is read once (exact "true", AND the Studio shell), the tabs sit in the typeFilters chain ahead of the old chips and
//              nothing else in the page mentions them; the old chips, the "Show all" link and the boundary around them are still there for flag off;
//   css        every rule of the new stylesheet hangs on data-studio-knowledge-filter-tabs, which exists only with the flag on, so flag off nothing is restyled.
// Flag-off identity of the whole page is held by the render goldens of scripts/test-studio-knowledge-fixes.mjs and scripts/test-atlas-knowledge-recovery.mjs (they
// run the real page with the flag unset); this change adds no line to any path they exercise.
// Then every layer re-runs against deliberately broken copies of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
let root = here
while (!fs.existsSync(path.join(root, 'package.json'))) {
  const parent = path.dirname(root)
  assert.notEqual(parent, root, 'no package.json above this script')
  root = parent
}
const requireOwn = createRequire(path.join(root, 'package.json'))
const ts = requireOwn('typescript')
const React = requireOwn('react')
const { renderToStaticMarkup } = requireOwn('react-dom/server')
const jsxRuntime = requireOwn('react/jsx-runtime')

const HELPER = 'lib/studio-knowledge-filter-tabs.ts'
const COMPONENT = 'components/knowledge/studio-knowledge-filter-tabs.tsx'
const CSS = 'components/knowledge/studio-knowledge-filter-tabs.css'
const PAGE = 'app/(app)/knowledge/page.tsx'
const FLAG = 'NEXT_PUBLIC_STUDIO_KNOWLEDGE_FILTER_TABS'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')

class MutationTargetMissing extends Error {}
const mutate = (source, edits, label) => edits.reduce((text, [from, to]) => {
  if (!text.includes(from)) throw new MutationTargetMissing(`mutation target missing in ${label}: ${from.slice(0, 70)}`)
  return text.replace(from, to)
}, source)

function transpile(source, fileName) {
  const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  assert.deepEqual((out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [], `${fileName} transpiles`)
  return out.outputText
}
function loadHelper(source) {
  const mod = { exports: {} }
  vm.runInNewContext(transpile(source, HELPER), { module: mod, exports: mod.exports, process: { env: {} } })
  return mod.exports
}
function loadComponent(source, helper) {
  const mod = { exports: {} }
  const req = spec => {
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec === 'react') return React
    if (spec === '@/lib/studio-knowledge-filter-tabs') return helper
    if (spec.endsWith('.css')) return {}
    throw new Error(`unexpected import ${spec}`)
  }
  vm.runInNewContext(transpile(source, COMPONENT), { module: mod, exports: mod.exports, require: req, Intl })
  return mod.exports
}

let checks = 0
const check = (fn, ...args) => { fn(...args); checks++ }
const plain = value => JSON.parse(JSON.stringify(value))
const isSet = value => Object.prototype.toString.call(value) === '[object Set]' // the helper runs in its own realm
const deq = (actual, expected, message) => check(assert.deepStrictEqual, plain(actual), plain(expected), message)

// the kinds a real stats response lists (the J6 baseline: 9 entities, 7 types), in the API's order
const BASELINE = [
  { entity_type: 'METRIC', count: 2 }, { entity_type: 'ORG', count: 2 }, { entity_type: 'EVENT', count: 1 }, { entity_type: 'PERSON', count: 1 },
  { entity_type: 'PLACE', count: 1 }, { entity_type: 'PRODUCT', count: 1 }, { entity_type: 'TECHNOLOGY', count: 1 },
]
const hidden = (...types) => new Set(types)
const labels = tabs => tabs.map(tab => tab.label)
const selected = tabs => tabs.filter(tab => tab.selected).map(tab => tab.label)

// ---- helper ---------------------------------------------------------------------------------------------------------------------------------
function helperChecks(h) {
  // kind names: every type the service writes, in the person's words; the code never reaches the screen
  const known = { ORG: 'Organizations', PERSON: 'People', CONCEPT: 'Ideas', METRIC: 'Metrics', PRODUCT: 'Products', EVENT: 'Events', PLACE: 'Places', TECHNOLOGY: 'Technologies', TREND: 'Trends' }
  for (const [type, label] of Object.entries(known)) {
    check(assert.equal, h.knowledgeKindLabel(type), label, type)
    check(assert.equal, h.knowledgeKindLabel(type.toLowerCase()), label, `${type} in lower case`)
  }
  check(assert.equal, h.knowledgeKindLabel('  Org '), 'Organizations', 'spaces around')
  check(assert.equal, h.knowledgeKindLabel('legal_entity'), 'Legal entity', 'an unknown type is shown as its own words')
  check(assert.equal, h.knowledgeKindLabel('LEGAL-ENTITY'), 'Legal entity', 'a dash reads as a space')
  check(assert.equal, h.knowledgeKindLabel('regulatory body'), 'Regulatory body')
  check(assert.equal, h.knowledgeKindLabel('constructor'), 'Constructor', 'a name on Object.prototype is not a label')
  check(assert.equal, h.knowledgeKindLabel('__proto__'), 'Proto', 'nor is __proto__')
  for (const empty of ['', '   ', null, undefined, '___', 42]) check(assert.equal, h.knowledgeKindLabel(empty), empty === 42 ? '42' : 'Other', `empty or odd ${String(empty)}`)

  // the row: Everything first with the total, then every kind in the API's order, with its count
  let row = h.filterTabs(BASELINE, hidden())
  deq(labels(row.tabs), ['Everything', 'Metrics', 'Organizations', 'Events', 'People', 'Places', 'Products', 'Technologies'], 'the row, in order')
  deq(row.tabs.map(tab => tab.count), [9, 2, 2, 1, 1, 1, 1, 1], 'the counts, Everything the total')
  deq(row.tabs.map(tab => tab.entityType), [null, 'METRIC', 'ORG', 'EVENT', 'PERSON', 'PLACE', 'PRODUCT', 'TECHNOLOGY'], 'the raw type stays on the tab (it is what the page hides)')
  deq(selected(row.tabs), ['Everything'], 'nothing hidden: Everything is the selected tab')
  check(assert.equal, row.mixed, false)
  // one kind hidden: several showing, so no tab is selected
  row = h.filterTabs(BASELINE, hidden('ORG'))
  deq(selected(row.tabs), [], 'one kind hidden selects no tab')
  check(assert.equal, row.mixed, true)
  // every kind but one hidden: that kind's tab is selected
  const allBut = type => new Set(BASELINE.map(kind => kind.entity_type).filter(entityType => entityType !== type))
  for (const kind of BASELINE) {
    row = h.filterTabs(BASELINE, allBut(kind.entity_type))
    deq(selected(row.tabs), [h.knowledgeKindLabel(kind.entity_type)], `only ${kind.entity_type} showing`)
    check(assert.equal, row.mixed, false)
  }
  // two kinds showing: mixed again
  row = h.filterTabs(BASELINE, new Set([...allBut('ORG')].filter(type => type !== 'EVENT')))
  deq(selected(row.tabs), [], 'two kinds showing selects no tab')
  check(assert.equal, row.mixed, true)
  // every kind hidden (reachable only from outside the tabs): no tab selected, still mixed, Everything is the way back
  row = h.filterTabs(BASELINE, new Set(BASELINE.map(kind => kind.entity_type)))
  deq(selected(row.tabs), [], 'all hidden')
  check(assert.equal, row.mixed, true)
  // a hidden type the stats do not list does not change the row
  deq(h.filterTabs(BASELINE, hidden('NOT_LISTED')), h.filterTabs(BASELINE, hidden()), 'a stale hidden type is ignored')
  // the counts are whole numbers >= 0; a repeated type adds up; a malformed entry is skipped
  row = h.filterTabs([{ entity_type: 'ORG', count: 2 }, { entity_type: 'ORG', count: 3 }, { entity_type: 'PERSON', count: -4 }, { entity_type: 'PLACE', count: 1.9 },
    { entity_type: 'EVENT', count: 'x' }, { entity_type: 'TREND', count: Infinity }, { entity_type: 'CONCEPT', count: NaN }, { entity_type: '', count: 5 }, { count: 7 }, null, 'ORG', 7], hidden())
  deq(row.tabs.map(tab => [tab.entityType, tab.count]), [[null, 6], ['ORG', 5], ['PERSON', 0], ['PLACE', 1], ['EVENT', 0], ['TREND', 0], ['CONCEPT', 0]], 'counts and skipped entries')
  // a single kind
  row = h.filterTabs([{ entity_type: 'ORG', count: 4 }], hidden())
  deq(row.tabs.map(tab => [tab.label, tab.count, tab.selected]), [['Everything', 4, true], ['Organizations', 4, false]], 'one kind: Everything is selected')
  // no kinds, no row
  for (const none of [[], undefined, null, 'x', {}, [null]]) deq(h.filterTabs(none, hidden()), { tabs: [], mixed: false }, `no kinds: ${JSON.stringify(none)}`)

  // picking: Everything shows all, a kind shows that kind alone
  deq([...h.hiddenAfterPick(null, BASELINE)], [], 'Everything')
  deq([...h.hiddenAfterPick('ORG', BASELINE)].sort(), ['EVENT', 'METRIC', 'PERSON', 'PLACE', 'PRODUCT', 'TECHNOLOGY'], 'ORG alone')
  deq([...h.hiddenAfterPick('NOT_LISTED', BASELINE)], [], 'a kind the stats do not list picks Everything')
  deq([...h.hiddenAfterPick('ORG', [{ entity_type: 'ORG', count: 1 }])], [], 'the only kind: nothing to hide')
  deq([...h.hiddenAfterPick('ORG', undefined)], [], 'no kinds')
  check(assert.ok, isSet(h.hiddenAfterPick(null, BASELINE)), 'a Set, which is what the page keeps')
  // the round trip: picking a kind (of two or more) selects exactly that tab; picking Everything selects Everything
  for (const kind of BASELINE) deq(selected(h.filterTabs(BASELINE, h.hiddenAfterPick(kind.entity_type, BASELINE)).tabs), [h.knowledgeKindLabel(kind.entity_type)], `pick ${kind.entity_type}`)
  deq(selected(h.filterTabs(BASELINE, h.hiddenAfterPick(null, BASELINE)).tabs), ['Everything'], 'pick Everything')
}

// ---- component ------------------------------------------------------------------------------------------------------------------------------
function componentChecks(helper, componentSource) {
  const { StudioKnowledgeFilterTabs } = loadComponent(componentSource, helper)
  const colorFor = type => `#${type.length.toString(16).padStart(2, '0')}0000`
  const element = (hiddenTypes, onPick = () => {}) => StudioKnowledgeFilterTabs({ nodesByType: BASELINE, hiddenTypes, onPick, colorFor })
  const buttons = tree => {
    const out = []
    const walk = node => { if (Array.isArray(node)) node.forEach(walk); else if (node && typeof node === 'object') { if (node.type === 'button') out.push(node); walk(node.props?.children) } }
    walk(tree)
    return out
  }
  const html = (hiddenTypes, nodesByType = BASELINE) => renderToStaticMarkup(React.createElement(StudioKnowledgeFilterTabs, { nodesByType, hiddenTypes, onPick: () => {}, colorFor }))

  let markup = html(hidden())
  check(assert.match, markup, /^<div data-studio-knowledge-filter-tabs="true" role="group" aria-label="Show the map by kind of knowledge" class="skft">/, 'the group')
  check(assert.equal, (markup.match(/<button /g) ?? []).length, 8, 'Everything + 7 kinds')
  check(assert.match, markup, /<button type="button" aria-pressed="true" class="skft-tab is-selected">Everything<span class="skft-count">9<\/span><\/button>/, 'Everything is pressed and selected, with its total, and no dot')
  check(assert.match, markup, /<button type="button" aria-pressed="false" class="skft-tab"><i class="skft-dot" style="background-color:#060000" aria-hidden="true"><\/i>Metrics<span class="skft-count">2<\/span><\/button>/, 'a kind: its colour dot, name and count')
  check(assert.equal, (markup.match(/aria-pressed="true"/g) ?? []).length, 1, 'one pressed tab')
  for (const word of ['metric', 'org', 'event', 'person', 'place', 'product', 'technology']) check(assert.doesNotMatch, markup, new RegExp(`>${word}<`), `the code "${word}" is not shown`)
  check(assert.doesNotMatch, markup, /Show all/, 'no "Show all": Everything is the way back')

  markup = html(new Set(BASELINE.map(kind => kind.entity_type).filter(type => type !== 'PERSON')))
  check(assert.match, markup, /aria-pressed="true" class="skft-tab is-selected"><i [^>]*><\/i>People/, 'People alone: its tab is pressed')
  check(assert.match, markup, /aria-pressed="false" class="skft-tab">Everything/, 'and Everything is not')
  check(assert.equal, (markup.match(/aria-pressed="true"/g) ?? []).length, 1)
  check(assert.equal, (html(hidden('ORG')).match(/aria-pressed="true"/g) ?? []).length, 0, 'mixed: no tab pressed')

  // a click hands the page the set to keep, and nothing else happens
  const picks = []
  const tree = element(hidden('ORG'), set => picks.push(set))
  const row = buttons(tree)
  deq(row.map(button => button.props.children.filter(child => typeof child === 'string')), ['Everything', 'Metrics', 'Organizations', 'Events', 'People', 'Places', 'Products', 'Technologies'].map(label => [label]), 'the buttons')
  row[0].props.onClick()
  row[3].props.onClick()
  row[6].props.onClick()
  check(assert.equal, picks.length, 3)
  deq([...picks[0]], [], 'Everything: nothing hidden')
  deq([...picks[1]].sort(), ['METRIC', 'ORG', 'PERSON', 'PLACE', 'PRODUCT', 'TECHNOLOGY'], 'Events alone')
  deq([...picks[2]].sort(), ['EVENT', 'METRIC', 'ORG', 'PERSON', 'PLACE', 'TECHNOLOGY'], 'Products alone')
  check(assert.ok, picks.every(isSet))
  // no kinds, no row
  for (const none of [[], undefined, null]) check(assert.equal, StudioKnowledgeFilterTabs({ nodesByType: none, hiddenTypes: hidden(), onPick: () => {}, colorFor }), null, 'no kinds, no element')
  check(assert.equal, renderToStaticMarkup(React.createElement(StudioKnowledgeFilterTabs, { nodesByType: [], hiddenTypes: hidden(), onPick: () => {}, colorFor })), '')
  // two types that read as the same word ("ORG" and "org") are two tabs with two keys
  const twins = buttons(StudioKnowledgeFilterTabs({ nodesByType: [{ entity_type: 'ORG', count: 1 }, { entity_type: 'org', count: 2 }], hiddenTypes: hidden(), onPick: () => {}, colorFor }))
  check(assert.equal, twins.length, 3)
  check(assert.equal, new Set(twins.map(button => button.key)).size, 3, 'the keys are unique')
  // a long kind name does not change the structure
  check(assert.match, html(hidden(), [{ entity_type: 'regulatory_body', count: 1234 }]), /Regulatory body<span class="skft-count">1,234<\/span>/, 'a name the list does not know; counts grouped')
}

/** The selector text of every rule, at any depth (the head of an at-rule such as @media is not one). */
function selectorsOf(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { const head = text.slice(start, i).trim(); if (!head.startsWith('@')) out.push(head); start = i + 1 } else if (text[i] === '}') start = i + 1
  }
  return out
}

// ---- page -----------------------------------------------------------------------------------------------------------------------------------
function pageChecks(page, css) {
  const occurrences = (text, needle) => text.split(needle).length - 1
  check(assert.equal, occurrences(page, FLAG), 1, 'the flag is named once in the page')
  check(assert.ok, page.includes(`const KNOWLEDGE_FILTER_TABS = STUDIO_SHELL && process.env.${FLAG} === "true"\n`), 'read once, exact "true", AND the Studio shell')
  check(assert.ok, page.indexOf('const STUDIO_SHELL =') < page.indexOf('const KNOWLEDGE_FILTER_TABS ='), 'STUDIO_SHELL is defined first')
  check(assert.equal, (page.match(/\bKNOWLEDGE_FILTER_TABS\b/g) ?? []).length, 2, 'the constant is defined and used once')
  check(assert.equal, occurrences(page, 'StudioKnowledgeFilterTabs'), 2, 'the component is imported and used once')
  check(assert.ok, page.includes('import { StudioKnowledgeFilterTabs } from "@/components/knowledge/studio-knowledge-filter-tabs"\n'), 'the import')
  check(assert.ok, !page.includes('@/lib/studio-knowledge-filter-tabs'), 'the page does not import the helper (the component does); the sibling page tests stub every import but their own four modules')
  const chain = /const typeFilters = KNOWLEDGE_FILTER_TABS\n {4}\? <StudioKnowledgeFilterTabs nodesByType=\{stats\?\.nodes_by_type\} hiddenTypes=\{hiddenTypes\} onPick=\{setHiddenTypes\} colorFor=\{typeColor\} \/>\n {4}: KNOWLEDGE_FIXES\n {4}\? <KnowledgeSectionBoundary label="type filters" resetKey=\{stats\}><LazySection render=\{renderTypeFilters\} \/><\/KnowledgeSectionBoundary>\n {4}: renderTypeFilters\(\)\n/
  check(assert.match, page, chain, 'the tabs come first; the boundary around the old chips and the old chips are the rest of the chain, as before')
  check(assert.equal, occurrences(page, '{typeFilters}'), 1, 'rendered where the chips were')
  // flag off the old chips are what renders: their markup and the "Show all" link are still in the page, untouched
  check(assert.ok, page.includes('aria-label="Filter entities by type"'), 'the old chips are still there')
  check(assert.ok, page.includes('Show all\n'), 'and their "Show all" link')
  check(assert.ok, page.includes('onClick={() => setHiddenTypes(new Set())}'), 'and its handler')
  // the page keeps the set of hidden types; the tabs only hand it a new one
  check(assert.ok, page.includes('const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())'), 'the state is still the set of hidden types')
  // css: every rule hangs on the attribute that exists only with the flag on
  const selectors = selectorsOf(css)
  check(assert.ok, selectors.length >= 8, 'the stylesheet has rules')
  for (const selector of selectors) for (const part of selector.split(',')) check(assert.match, part.trim(), /^\[data-studio-v4-shell="true"\] \[data-studio-knowledge-filter-tabs="true"\]/, `scoped: ${part.trim()}`)
  check(assert.ok, css.includes('.skft-tab.is-selected'), 'the selected look')
  check(assert.ok, css.includes('var(--ss-accent-soft)') && css.includes('var(--ss-accent)'), 'on the shell tokens')
}

// ---- run, then break things ------------------------------------------------------------------------------------------------------------------
const sources = { helper: read(HELPER), component: read(COMPONENT), page: read(PAGE), css: read(CSS) }
const runAll = ({ helper, component, page, css }) => {
  const h = loadHelper(helper)
  helperChecks(h)
  componentChecks(h, component)
  pageChecks(page, css)
}
runAll(sources)
const real = checks

const MUTANTS = [
  // helper
  ['helper', 'ORG: \'Organizations\'', 'ORG: \'Orgs\'', 'a kind name changed'],
  ['helper', "PERSON: 'People'", "PERSON: 'Persons'", 'People'],
  ['helper', ".toUpperCase().replace(/[\\s-]+/g, '_')", ".replace(/[\\s-]+/g, '_')", 'the type is no longer upper-cased'],
  ['helper', ".replace(/[\\s-]+/g, '_')", '', 'a dash or space is no longer an underscore'],
  ['helper', "if (key === '') return 'Other'", "if (key === '') return ''", 'an empty type has no name'],
  ['helper', "words.charAt(0).toUpperCase() + words.slice(1)", 'words', 'an unknown type is not capitalised'],
  ['helper', ".toLowerCase().replace(/_+/g, ' ')", ".replace(/_+/g, ' ')", 'an unknown type keeps its capitals'],
  ['helper', "if (typeof entityType !== 'string' || entityType === '') continue", "if (typeof entityType !== 'string') continue", 'an empty type is kept'],
  ['helper', "if (typeof item !== 'object' || item === null) continue", "if (typeof item !== 'object') continue", 'a null entry is read'],
  ['helper', 'count > 0 ? Math.floor(count) : 0', 'count > 0 ? count : 0', 'a fractional count is kept'],
  ['helper', 'Number.isFinite(count) && count > 0', 'count > 0', 'an infinite count is kept'],
  ['helper', 'count > 0 ? Math.floor(count) : 0', 'Math.floor(count)', 'a negative count is kept'],
  ['helper', 'if (seen) seen.count += n', 'if (seen) seen.count = n', 'a repeated type does not add up'],
  ['helper', 'else kinds.push({ entity_type: entityType, count: n })', 'else kinds.push({ entity_type: entityType, count: 1 })', 'every count is 1'],
  ['helper', 'if (!Array.isArray(nodesByType)) return []', 'if (!nodesByType) return []', 'a non-array is read'],
  ['helper', 'if (kinds.length === 0) return { tabs: [], mixed: false }', 'if (kinds.length === 0) return { tabs: [{ entityType: null, label: EVERYTHING_LABEL, count: 0, selected: true }], mixed: false }', 'an empty row'],
  ['helper', 'const nothingHidden = showing.length === kinds.length', 'const nothingHidden = hidden.size === 0', 'a stale hidden type counts as hidden'],
  ['helper', '!nothingHidden && showing.length === 1 ? showing[0].entity_type : null', 'showing.length === 1 ? showing[0].entity_type : null', 'the only kind of a one-kind row is selected as well'],
  ['helper', '!nothingHidden && showing.length === 1 ? showing[0].entity_type : null', '!nothingHidden && showing.length <= 2 ? showing[0]?.entity_type ?? null : null', 'two showing kinds select the first'],
  ['helper', 'kinds.reduce((sum, kind) => sum + kind.count, 0), selected: nothingHidden', 'kinds.length, selected: nothingHidden', 'Everything counts the kinds, not the entities'],
  ['helper', 'selected: nothingHidden }', 'selected: true }', 'Everything is always selected'],
  ['helper', 'selected: kind.entity_type === onlyOne', 'selected: false', 'a kind is never selected'],
  ['helper', 'mixed: !nothingHidden && onlyOne === null', 'mixed: false', 'mixed is never reported'],
  ['helper', 'mixed: !nothingHidden && onlyOne === null', 'mixed: onlyOne === null', 'mixed with nothing hidden'],
  ['helper', 'if (entityType === null || !kinds.some(kind => kind.entity_type === entityType)) return new Set()', 'if (entityType === null) return new Set()', 'an unlisted kind hides everything'],
  ['helper', 'kinds.filter(kind => kind.entity_type !== entityType)', 'kinds.filter(kind => kind.entity_type === entityType)', 'picking a kind hides that kind'],
  ['helper', '...kinds.map(kind => ({ entityType: kind.entity_type, label: knowledgeKindLabel(kind.entity_type)', '...[...kinds].reverse().map(kind => ({ entityType: kind.entity_type, label: knowledgeKindLabel(kind.entity_type)', 'the kinds are reversed'],
  ['helper', 'tabs: [\n      { entityType: null', 'tabs: [\n      { entityType: undefined', 'Everything has no null type'],
  // component
  ['component', 'aria-pressed={tab.selected}', 'aria-pressed={!tab.selected}', 'the pressed state is inverted'],
  ['component', 'className={tab.selected ? "skft-tab is-selected" : "skft-tab"}', 'className="skft-tab"', 'the selected look is never applied'],
  ['component', 'onClick={() => onPick(hiddenAfterPick(tab.entityType, nodesByType))}', 'onClick={() => onPick(new Set())}', 'every tab picks Everything'],
  ['component', 'onClick={() => onPick(hiddenAfterPick(tab.entityType, nodesByType))}', 'onClick={() => onPick(hiddenAfterPick(null, nodesByType))}', 'every tab hides nothing'],
  ['component', '{tab.entityType !== null && <i className="skft-dot"', '{<i className="skft-dot"', 'Everything gets a dot'],
  ['component', 'style={{ backgroundColor: colorFor(tab.entityType) }}', 'style={{ backgroundColor: "#000000" }}', 'the dot is not the map colour'],
  ['component', 'if (tabs.length === 0) return null', 'if (!tabs) return null', 'an empty row is drawn'],
  ['component', 'role="group" aria-label="Show the map by kind of knowledge"', 'aria-label="Show the map by kind of knowledge"', 'the group role is gone'],
  ['component', 'data-studio-knowledge-filter-tabs="true"', 'data-studio-knowledge-filters="true"', 'the scoping attribute is renamed'],
  ['component', '<span className="skft-count">{new Intl.NumberFormat().format(tab.count)}</span>', '', 'the count is gone'],
  ['component', 'key={tab.entityType ?? "everything"}', 'key={tab.label}', 'keys by label'],
  // page
  ['page', 'const KNOWLEDGE_FILTER_TABS = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_FILTER_TABS === "true"', 'const KNOWLEDGE_FILTER_TABS = process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_FILTER_TABS === "true"', 'not tied to the Studio shell'],
  ['page', 'const KNOWLEDGE_FILTER_TABS = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_FILTER_TABS === "true"', 'const KNOWLEDGE_FILTER_TABS = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_FILTER_TABS !== "false"', 'on unless "false"'],
  ['page', 'const KNOWLEDGE_FILTER_TABS = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_FILTER_TABS === "true"', 'const KNOWLEDGE_FILTER_TABS = STUDIO_SHELL && Boolean(process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_FILTER_TABS)', 'on for any value'],
  ['page', 'const typeFilters = KNOWLEDGE_FILTER_TABS\n', 'const typeFilters = !KNOWLEDGE_FILTER_TABS\n', 'the branch is inverted'],
  ['page', 'onPick={setHiddenTypes}', 'onPick={() => {}}', 'a pick does nothing'],
  ['page', 'hiddenTypes={hiddenTypes}', 'hiddenTypes={new Set<string>()}', 'the tabs do not see what is hidden'],
  ['page', 'nodesByType={stats?.nodes_by_type}', 'nodesByType={graph?.nodes}', 'the tabs read the wrong list'],
  ['page', 'colorFor={typeColor}', 'colorFor={() => "#000"}', 'the dots are not the map colours'],
  ['page', '    : KNOWLEDGE_FIXES\n    ? <KnowledgeSectionBoundary label="type filters"', '    : false\n    ? <KnowledgeSectionBoundary label="type filters"', 'the boundary around the old chips is dropped'],
  ['page', '    : renderTypeFilters()\n', '    : null\n', 'the old chips are gone flag off'],
  ['page', 'aria-label="Filter entities by type"', 'aria-label="Filter"', 'the old chips are changed'],
  ['page', '{typeFilters}', '{typeFilters}{typeFilters}', 'rendered twice'],
  ['page', 'import { StudioKnowledgeFilterTabs } from "@/components/knowledge/studio-knowledge-filter-tabs"\n', 'import { StudioKnowledgeFilterTabs } from "@/components/knowledge/studio-knowledge-filter-tabs"\nimport { filterTabs } from "@/lib/studio-knowledge-filter-tabs"\n', 'another use of the helper in the page'],
  ['page', 'const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())', 'const [hiddenTypes, setHiddenTypes] = useState<string[]>([])', 'the state changes shape'],
  // css
  ['css', '[data-studio-v4-shell="true"] [data-studio-knowledge-filter-tabs="true"] .skft-dot {', '.skft-dot {', 'a rule that is not scoped'],
  ['css', '[data-studio-v4-shell="true"] [data-studio-knowledge-filter-tabs="true"] .skft-tab:hover {', '[data-studio-knowledge-filter-tabs="true"] .skft-tab:hover {', 'a rule without the shell'],
  ['css', 'var(--ss-accent-soft)', '#f4eefc', 'a colour that is not a token'],
]
let caught = 0
for (const [file, from, to, name] of MUTANTS) {
  const before = checks
  const broken = { ...sources, [file]: mutate(sources[file], [[from, to]], `${file} (${name})`) }
  let failed = false
  try { runAll(broken) } catch (error) { if (error instanceof MutationTargetMissing) throw error; failed = true }
  checks = before
  assert.ok(failed, `mutant not caught: ${file}: ${name}`)
  caught++
}
checks = real
console.log(`PASS: studio knowledge filter tabs (${checks} checks, ${caught}/${MUTANTS.length} mutants caught)`)
