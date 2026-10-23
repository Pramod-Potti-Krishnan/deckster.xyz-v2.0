// PASS2 Docs / Help / Legal / Agents (FRONTEND-1): the public pages /docs, /docs/<category>/<article>, /docs/api, /legal/{privacy,terms,security,cookies}, /agents/<agent> in the Studio shell's tokens. There is no mockup for them.
// Flag NEXT_PUBLIC_STUDIO_P2_DOCS (exact "true"), default off.
//   /docs and the articles are rebuilt; the legal, API and agent pages keep their markup, words and links and take the shell's look through one marker element.
//   Fixed: a card's text was the article's raw markdown cut at 150 characters ("# Quick Start Guide Welcome to ..."); the side list linked three articles nobody wrote (Scripter, Graphic Artist, Data Visualizer: "Documentation Not
//   Found"); the article's title was shown twice (page heading and the markdown's own "# ..."); a "Share" button did nothing; a search with no hit gave bare text; on a phone the article list was hidden with no way to open it; a link
//   inside an article to a docs page that does not exist went to a dead end.
//
// Run: node scripts/test-studio-p2-docs.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   P2_DOCS_BASE=<commit> overrides the base commit flag-off identity is checked against (default fae9620, the studio-v4-dev-preparation-code tip the PR is based on: #468 admin email guard, #460 #464 #465 #469).
//
// Proven on the REAL sources:
//   1. lib/studio-p2-docs.ts: import-free; every word; the result line, the filter, the side list, the title split, the card text (on every real article too), the link kinds, which docs links land;
//   2. the components (executed): the index (all articles, search, empty, help band), an article (breadcrumb, both side lists, one heading, the markdown's links, related, not found), the frame;
//   3. the wiring (executed against the base commit's files): flag off, or any spelling but "true" = the same tree as the base commit's; on = the new pages; the old pages' code is the base commit's, renamed only; the three layouts;
//      every page this PR does not change is byte for byte the base commit's;
//   4. the CSS: every rule scoped to the frame's marker, tokens equal to the shell's (light and dark), every colour a token, readable in both themes, every class named exists, focus rings, phone targets, reduced motion;
//   5. the flag block in .env.example and the package script;
//   6. mutation check: every mutant of the sources is killed by sections 1-5.
// The content pass (PROGRAM-1 rulings of 22 Oct, same flag), each item proven on the real sources and on the base commit's files:
//   1. /docs/api says "Not available yet" (a notice under the header, the content muted at AA) and no footer links to it;
//   2. the legal and security wording is not touched (every legal page is the base commit's, byte for byte; the footers' trust lines are kept);
//   3. the docs text names the current eight agents (the set is read from AGENT_TEAM, content/agents.ts and the Help page, which must agree): old -> new table, counts, the seven new sections are content/agents.ts's own words;
//   4. the Landing footer gains Help, Docs, Security and Cookies (Privacy and Terms were there);
//   5. no link to /integrations or /agents in either footer, on the agent pages or on /compare (the routes and pages stay; /agents/<agent> links stay);
//   6. no per-agent rainbow: every per-agent colour on the agent pages is flattened by the CSS, none comes from anywhere else.
//   Flag off (or any spelling but "true") = the same tree as the base commit's for every file changed here.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const BASE_COMMIT = process.env.P2_DOCS_BASE || 'fae962006b080e26eb70c2add7066ca1edf8eca2'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const baseCache = new Map()
const baseSource = rel => {
  if (!baseCache.has(rel)) {
    try { baseCache.set(rel, execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })) }
    catch (error) { throw new Error(`base commit ${BASE_COMMIT} is not in this clone (fetch the full history): ${error.message}`) }
  }
  return baseCache.get(rel)
}
// .env.example and package.json are the two files every flag-gated change appends a line or a block to, so when other changes are stacked under this one they hold lines this change never wrote.
// For those two (and only those) the base's lines must all still be there, in order, with nothing of this change left, and any extra line must be a comment, a blank, an env line or a test script
// line (the rule scripts/test-studio-p2-publish.mjs and test-studio-p2-polish.mjs use). Every other file is held to the base byte for byte.
function sameAsBase(rel, text, baseText) {
  if (text === baseText) return true
  const norm = line => rel === 'package.json' ? line.replace(/,\s*$/, '') : line
  const want = baseText.split('\n').map(norm)
  const extras = []
  let next = 0
  for (const line of text.split('\n').map(norm)) {
    if (next < want.length && line === want[next]) next++
    else extras.push(line)
  }
  const kind = rel === 'package.json' ? /^\s*"test:[a-z0-9-]+": "node scripts\/test-[a-z0-9-]+\.mjs"$/ : /^\s*$|^\s*#|^[A-Z][A-Z0-9_]*=/
  return next === want.length && extras.every(line => line === '' || kind.test(line)) && !extras.some(line => /P2_DOCS|test:studio-p2-docs/.test(line))
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside the vm carry its realm's prototypes
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deepEq = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message))
const notes = []

const LIB = 'lib/studio-p2-docs.ts'
const UI = 'components/studio-docs/studio-p2-docs.tsx'
const FRAME = 'components/studio-docs/studio-p2-docs-frame.tsx'
const CSS = 'components/studio-docs/studio-p2-docs.css'
const PAGE_INDEX = 'app/docs/page.tsx'
const PAGE_ARTICLE = 'app/docs/[category]/[slug]/page.tsx'
const LAYOUT_DOCS = 'app/docs/layout.tsx'
const LAYOUT_LEGAL = 'app/legal/layout.tsx'
const LAYOUT_AGENTS = 'app/agents/layout.tsx'
const META_PRIVACY = 'app/legal/privacy/layout.tsx'
const META_TERMS = 'app/legal/terms/layout.tsx'
const META_ARTICLE = 'app/docs/[category]/[slug]/layout.tsx'
const META_AGENT = 'app/agents/[slug]/layout.tsx'
const CONTENT = 'content/docs.ts'
const LIB_DOCS = 'lib/docs.ts'
const HELP_TEMPLATE = 'app/help/template.tsx'
const HELP_CSS = 'components/help/studio-p2-help.css'
const SHELL_CSS = 'components/layout/studio-shell.css'
const API_NOTICE = 'components/studio-docs/studio-p2-docs-api-notice.tsx'
const AGENT_RULES = 'content/studio-p2-docs-agents.ts'
const FOOTER = 'components/layout/Footer.tsx'
const FOOTER_V3 = 'components/marketing/v3/FooterV3.tsx'
const PAGE_API = 'app/docs/api/page.tsx'
const PAGE_AGENT = 'app/agents/[slug]/page.tsx'
const PAGE_COMPARE = 'app/compare/page.tsx'
const TEAM_SOURCE = 'lib/marketing/homepage-v2-content.ts'
const V3_SOURCE = 'lib/marketing/v3-content.ts'
const ENV = '.env.example'
const PKG = 'package.json'
const TITLE_FIXES = [['app/docs/api/layout.tsx', 'API Documentation'], ['app/legal/cookies/layout.tsx', 'Cookie Policy'], ['app/legal/security/layout.tsx', 'Security & Compliance']]
const SOURCES = Object.fromEntries([LIB, UI, FRAME, API_NOTICE, AGENT_RULES, FOOTER, FOOTER_V3, PAGE_API, PAGE_AGENT, PAGE_COMPARE, CSS, HELP_TEMPLATE, HELP_CSS, PAGE_INDEX, PAGE_ARTICLE, LAYOUT_DOCS, LAYOUT_LEGAL, LAYOUT_AGENTS, META_PRIVACY, META_TERMS, META_ARTICLE, META_AGENT, ...TITLE_FIXES.map(([file]) => file), ENV, PKG].map(rel => [rel, read(rel)]))
const FLAG = 'NEXT_PUBLIC_STUDIO_P2_DOCS'
const ON = { [FLAG]: 'true' }
const OFF_SPELLINGS = [{}, { [FLAG]: 'false' }, { [FLAG]: 'TRUE' }, { [FLAG]: 'True' }, { [FLAG]: '1' }, { [FLAG]: ' true' }, { [FLAG]: 'true ' }, { [FLAG]: '' }, { [FLAG]: 'yes' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }]

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
  vm.runInNewContext(compile(source, fileName), { module, exports: module.exports, process: { env }, Date, ...globals, require: name => {
    if (name in deps) return deps[name]
    if (name === 'react/jsx-runtime') return JSX_RUNTIME
    if (name.endsWith('.css')) return {}
    if (name === 'lucide-react' || name.startsWith('@/components/') || name.startsWith('./') || name.startsWith('../')) return names
    assert.fail(`Unexpected import ${name} in ${fileName}`)
  } })
  return module.exports
}
function makeReact() {
  const slots = []; let cursor = 0
  return {
    reset() { cursor = 0 },
    api: {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }] },
    },
  }
}
const attempt = fn => { try { return fn() } catch (error) { return { threw: String(error) } } } // a mutant that crashes must fail an assertion, not the run
const LINK = { __esModule: true, default: 'Link' }

// the real content, loaded once from the real files (never mutated: the mutants target the lib, the components and the wiring)
const CONTENT_MODULE = load(read(CONTENT), CONTENT, { deps: { '@/types/docs': {} } })
const SECTIONS = CONTENT_MODULE.docSections
const DOCS_API = load(read(LIB_DOCS), LIB_DOCS, { deps: { '@/content/docs': CONTENT_MODULE, '@/types/docs': {} } })
const ALL_DOCS = SECTIONS.flatMap(section => section.items)
ok(SECTIONS.length >= 3 && ALL_DOCS.length >= 7, 'the real docs: sections and articles are loaded')
for (const doc of ALL_DOCS) deepEq(Object.keys(doc).sort(), ['category', 'content', 'id', 'slug', 'title'], `real article ${doc.slug}: the DocItem shape the lib is typed to`)
for (const section of SECTIONS) { deepEq(Object.keys(section).sort(), ['id', 'items', 'title'], `real section ${section.id}: the DocSection shape`); for (const doc of section.items) eq(doc.category, section.id, `real article ${doc.slug}: its category is its section`) }

// the content pass reads these real files: the rules, the team, the Landing's links
const RULES = load(SOURCES[AGENT_RULES], AGENT_RULES).STUDIO_DOCS_AGENT_RULES
const TEAM = load(read(TEAM_SOURCE), TEAM_SOURCE, { deps: { '@/types/elements': { CHART_TYPES: [] } } }).AGENT_TEAM
const V3 = load(read(V3_SOURCE), V3_SOURCE, { deps: { '@/lib/marketing/homepage-v2-content': { AGENT_TEAM: TEAM } } }).V3_CONTENT
const V3_LINKS = plain(V3.footer.links)
const HIDDEN = ['/agents', '/docs/api', '/integrations'] // the test's own list (the lib's function is checked against it)

// ---------------------------------------------------------------- 1. the lib
const WORDS = {
  eyebrow: 'Documentation',
  title: 'Get the most out of Deckster',
  lede: 'Guides and answers for turning your ideas into finished slides',
  searchLabel: 'Search documentation',
  searchPlaceholder: 'Search documentation',
  clearSearch: 'Clear search',
  emptyTitle: 'No articles found',
  emptyBody: 'Nothing in the documentation matches that search. Try a different word, or clear the search to see every article.',
  helpTitle: 'Still have questions?',
  helpBody: 'Can\'t find what you\'re looking for? Check the Help Center, or write to our support team.',
  helpCenter: 'Help Center',
  emailSupport: 'Email support',
  supportEmail: 'support@deckster.xyz',
  moreHelpTitle: 'Need more help?',
  moreHelpBody: 'Can\'t find what you\'re looking for? Our support team is here to help.',
  browseAll: 'Browse all docs',
  breadcrumb: 'Breadcrumb',
  home: 'Home',
  docsLabel: 'Documentation',
  navLabel: 'Documentation articles',
  navSummary: 'All articles',
  related: 'Related documentation',
  notFoundTitle: 'Article not found',
  notFoundBody: 'This documentation page does not exist, or it has moved. The list of articles has what is here today.',
  backToDocs: 'Browse documentation',
  apiNoticeTitle: 'Not available yet',
  apiNoticeBody: 'The Deckster API is not open yet. There is no API key to generate, and the endpoints below cannot be called today. This page stays for reference.',
}
const fixtureSections = () => [
  { id: 'a', title: 'Alpha Guides', items: [
    { id: 'a1', title: 'First Steps', slug: 'first-steps', category: 'a', content: '# First Steps\n\nBegin here.' },
    { id: 'a2', title: 'Charts', slug: 'charts', category: 'a', content: '# Charts\n\nMake a **bar chart**.' },
  ] },
  { id: 'b-two', title: 'Beta', items: [
    { id: 'b1', title: 'Export', slug: 'export', category: 'b-two', content: '# Export\n\nSave as PDF. A Chart can be exported too.' },
  ] },
]
function proveLib(source, label = 'lib') {
  nomatch(source, /^\s*import\s/m, `${label}: import-free (the test runs it as plain code)`)
  const L = load(source, LIB)
  deepEq(L.STUDIO_DOCS_WORDS, WORDS, `${label}: every word`)
  eq(L.STUDIO_DOCS_EXCERPT_MAX, 150, `${label}: a card's text is at most 150 characters (before the ellipsis)`)

  // the result line
  eq(L.studioDocsResultLine(7, 7, 3, ''), '7 articles in 3 categories', `${label}: line, no search`)
  eq(L.studioDocsResultLine(1, 1, 1, ''), '1 article in 1 category', `${label}: line, singular`)
  eq(L.studioDocsResultLine(1, 1, 3, undefined), '1 article in 3 categories', `${label}: line, no query value`)
  eq(L.studioDocsResultLine(7, 7, 3, '   '), '7 articles in 3 categories', `${label}: line, a blank query is no search`)
  eq(L.studioDocsResultLine(2, 7, 3, ''), '7 articles in 3 categories', `${label}: line, no search: the total, never the hits`)
  eq(L.studioDocsResultLine(2, 7, 3, 'chart'), '2 of 7 articles match “chart”', `${label}: line, a search`)
  eq(L.studioDocsResultLine(1, 7, 3, ' chart '), '1 of 7 articles match “chart”', `${label}: line, the query is trimmed`)
  eq(L.studioDocsResultLine(0, 7, 3, 'zz'), '0 of 7 articles match “zz”', `${label}: line, no hit`)
  eq(L.studioDocsResultLine(1, 1, 1, 'a'), '1 of 1 article match “a”', `${label}: line, a one-article site (the noun follows the total)`)
  eq(L.studioDocsResultLine(3, 3, 1, 5), '3 articles in 1 category', `${label}: line, a non-text query is no search`)

  // the filter
  const fixture = fixtureSections()
  const all = L.studioDocsFilter(fixture, '')
  deepEq(all, { sections: fixture, shown: 3, total: 3 }, `${label}: filter, no query keeps everything`)
  ok(all.sections !== fixture && all.sections[0] !== fixture[0] && all.sections[0].items !== fixture[0].items, `${label}: filter, a copy (the content is never handed back to be changed)`)
  deepEq(L.studioDocsFilter(fixture, '   '), { sections: fixture, shown: 3, total: 3 }, `${label}: filter, a blank query keeps everything`)
  deepEq(L.studioDocsFilter(fixture, undefined), { sections: fixture, shown: 3, total: 3 }, `${label}: filter, no query value keeps everything`)
  deepEq(L.studioDocsFilter(fixture, 'CHART'), { sections: [{ id: 'a', title: 'Alpha Guides', items: [fixture[0].items[1]] }, { id: 'b-two', title: 'Beta', items: [fixture[1].items[0]] }], shown: 2, total: 3 }, `${label}: filter, title or text, any case, a section with no hit is dropped`)
  deepEq(L.studioDocsFilter(fixture, '  first  '), { sections: [{ id: 'a', title: 'Alpha Guides', items: [fixture[0].items[0]] }], shown: 1, total: 3 }, `${label}: filter, the query is trimmed`)
  deepEq(L.studioDocsFilter(fixture, 'save as pdf'), { sections: [{ id: 'b-two', title: 'Beta', items: [fixture[1].items[0]] }], shown: 1, total: 3 }, `${label}: filter, the article's text counts`)
  const titled = [{ id: 't', title: 'Glossary', items: [{ id: 't1', title: 'Glossary', slug: 'glossary', category: 't', content: '# Terms\n\nWords and meanings.' }] }]
  deepEq(L.studioDocsFilter(titled, 'glossary'), { sections: titled, shown: 1, total: 1 }, `${label}: filter, a title alone matches`)
  deepEq(L.studioDocsFilter(titled, 'GLOSSARY'), { sections: titled, shown: 1, total: 1 }, `${label}: filter, a title matches in any case`)
  deepEq(L.studioDocsFilter(titled, 'Meanings'), { sections: titled, shown: 1, total: 1 }, `${label}: filter, text alone matches`)
  deepEq(L.studioDocsFilter(fixture, 'beta'), { sections: [], shown: 0, total: 3 }, `${label}: filter, a section's own title is not searched (as before)`)
  deepEq(L.studioDocsFilter(fixture, 'zzzz'), { sections: [], shown: 0, total: 3 }, `${label}: filter, no hit`)
  deepEq(L.studioDocsFilter([], 'x'), { sections: [], shown: 0, total: 0 }, `${label}: filter, no sections`)
  deepEq(L.studioDocsFilter(fixture, 7), { sections: fixture, shown: 3, total: 3 }, `${label}: filter, a non-text query is no search`)

  // links and the side list
  eq(L.studioDocsHref('getting-started', 'quick-start-guide'), '/docs/getting-started/quick-start-guide', `${label}: an article's address`)
  const nav = L.studioDocsNav(fixture, 'a', 'charts')
  deepEq(nav, [
    { id: 'a', title: 'Alpha Guides', items: [{ id: 'a1', title: 'First Steps', href: '/docs/a/first-steps', current: false }, { id: 'a2', title: 'Charts', href: '/docs/a/charts', current: true }] },
    { id: 'b-two', title: 'Beta', items: [{ id: 'b1', title: 'Export', href: '/docs/b-two/export', current: false }] },
  ], `${label}: the side list, the open article marked`)
  deepEq(L.studioDocsNav(fixture, 'b-two', 'charts').flatMap(s => s.items).filter(i => i.current), [], `${label}: the side list, a slug alone does not mark an article (the category counts)`)
  deepEq(L.studioDocsNav(fixture, 'a', 'nope').flatMap(s => s.items).filter(i => i.current), [], `${label}: the side list, no open article, none marked`)
  eq(L.studioDocsNav([], 'a', 'b').length, 0, `${label}: the side list, no sections`)
  eq(L.studioDocsCategoryTitle(fixture, 'b-two'), 'Beta', `${label}: a category is called by its section's title`)
  eq(L.studioDocsCategoryTitle(fixture, 'agent-reference'), 'Agent reference', `${label}: a category with no section is its id in words`)
  eq(L.studioDocsCategoryTitle(fixture, 'solo'), 'Solo', `${label}: ... one word`)
  eq(L.studioDocsCategoryTitle(fixture, ''), '', `${label}: ... none`)
  eq(L.studioDocsCategoryTitle(fixture, '--'), '', `${label}: ... only dashes`)

  // the title split
  deepEq(L.studioDocsSplit('# Quick Start\n\nWelcome.\n\n## Step 1\n', 'Fallback'), { title: 'Quick Start', body: 'Welcome.\n\n## Step 1\n' }, `${label}: split, the first heading is the title and leaves the body`)
  deepEq(L.studioDocsSplit('\n\n# Spaced  \n\nBody', 'F'), { title: 'Spaced', body: 'Body' }, `${label}: split, blank lines before the heading, the title trimmed`)
  deepEq(L.studioDocsSplit('# Closed ##\nBody', 'F'), { title: 'Closed', body: 'Body' }, `${label}: split, closing hashes are not part of the title`)
  deepEq(L.studioDocsSplit('Intro first\n\n# Later', 'Fallback'), { title: 'Fallback', body: 'Intro first\n\n# Later' }, `${label}: split, a heading that is not first stays in the body`)
  deepEq(L.studioDocsSplit('## Not the title\nBody', 'Fallback'), { title: 'Fallback', body: '## Not the title\nBody' }, `${label}: split, only a level-1 heading is the title`)
  deepEq(L.studioDocsSplit('#Nospace\nBody', 'Fallback'), { title: 'Fallback', body: '#Nospace\nBody' }, `${label}: split, "#x" is not a heading`)
  deepEq(L.studioDocsSplit('', 'Fallback'), { title: 'Fallback', body: '' }, `${label}: split, empty`)
  deepEq(L.studioDocsSplit(undefined, 'Fallback'), { title: 'Fallback', body: '' }, `${label}: split, no content`)
  deepEq(L.studioDocsSplit(42, 'Fallback'), { title: 'Fallback', body: '' }, `${label}: split, a number is no content`)
  deepEq(L.studioDocsSplit('# Only', 'Fallback'), { title: 'Only', body: '' }, `${label}: split, a heading alone`)

  // the card text
  eq(L.studioDocsExcerpt('# Quick Start Guide\n\nWelcome to deckster! This guide will help.\n\n## Step 1: Sign Up\n\n1. Click "Get Started"'), 'Welcome to deckster! This guide will help.', `${label}: excerpt, the first paragraph, not the heading or the steps`)
  eq(L.studioDocsExcerpt('Line one\nline two\n\nSecond paragraph'), 'Line one line two', `${label}: excerpt, a paragraph's lines are joined`)
  eq(L.studioDocsExcerpt('**Bold** and *italic* and `code` and [a link](/x) and ![alt](/i.png)'), 'Bold and italic and code and a link and alt', `${label}: excerpt, inline markdown is taken out`)
  eq(L.studioDocsExcerpt('__Bold__ and _italic_'), 'Bold and italic', `${label}: excerpt, underscore emphasis`)
  eq(L.studioDocsExcerpt('> A quoted line'), 'A quoted line', `${label}: excerpt, a quote marker`)
  eq(L.studioDocsExcerpt('- one\n- two'), 'one two', `${label}: excerpt, a list's markers`)
  eq(L.studioDocsExcerpt('* star\n+ plus'), 'star plus', `${label}: excerpt, star and plus markers`)
  eq(L.studioDocsExcerpt('1. first\n2. second'), 'first second', `${label}: excerpt, numbered markers`)
  eq(L.studioDocsExcerpt('# Title\n\n```\ncode only\n```\n\nAfter the code'), 'After the code', `${label}: excerpt, a fenced block is skipped`)
  eq(L.studioDocsExcerpt('# Title\n\n~~~\ncode only\n~~~\n\nAfter tilde'), 'After tilde', `${label}: excerpt, a tilde fence is skipped`)
  eq(L.studioDocsExcerpt('Before\n```\ncode\n```\nAfter'), 'Before', `${label}: excerpt, a fence ends the paragraph`)
  eq(L.studioDocsExcerpt('# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nAfter the table'), 'After the table', `${label}: excerpt, table rows are skipped`)
  eq(L.studioDocsExcerpt('# Title\n\n---\n\nAfter the rule'), 'After the rule', `${label}: excerpt, a rule is skipped`)
  eq(L.studioDocsExcerpt('# One\n## Two\n### Three'), '', `${label}: excerpt, headings only is empty`)
  eq(L.studioDocsExcerpt(''), '', `${label}: excerpt, empty`)
  eq(L.studioDocsExcerpt(undefined), '', `${label}: excerpt, no value`)
  eq(L.studioDocsExcerpt(42), '', `${label}: excerpt, a non-text value`)
  eq(L.studioDocsExcerpt('one  two   three'), 'one two three', `${label}: excerpt, runs of spaces are one`)
  eq(L.studioDocsExcerpt('[ ](/x) hello'), 'hello', `${label}: excerpt, a space left by a link is trimmed`)
  eq(L.studioDocsExcerpt('alpha beta- gamma delta', 13), 'alpha beta…', `${label}: excerpt, a cut drops a trailing hyphen`)
  eq(L.studioDocsExcerpt('alpha beta— gamma delta', 13), 'alpha beta…', `${label}: excerpt, a cut drops a trailing em dash`)
  eq(L.studioDocsExcerpt('alpha beta– gamma delta', 13), 'alpha beta…', `${label}: excerpt, a cut drops a trailing en dash`)
  eq(L.studioDocsExcerpt('x'.repeat(150)), 'x'.repeat(150), `${label}: excerpt, exactly 150 is not cut`)
  eq(L.studioDocsExcerpt('x'.repeat(151)), `${'x'.repeat(150)}…`, `${label}: excerpt, 151 is cut at 150 with an ellipsis (no space to cut at)`)
  const words = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega again and again and again and once more for good measure'
  const cut = L.studioDocsExcerpt(words)
  ok(cut.endsWith('…') && cut.length <= 151 && !cut.slice(0, -1).endsWith(' ') && words.startsWith(cut.slice(0, -1)), `${label}: excerpt, a long one is cut at a word (${cut.length})`)
  eq(L.studioDocsExcerpt('one, two, three, four, five, six', 15), 'one, two, three…', `${label}: excerpt, a cut drops the trailing comma and space; max is a parameter`)
  eq(L.studioDocsExcerpt('Sentence one. Sentence two. Sentence three', 28), 'Sentence one. Sentence two…', `${label}: excerpt, a cut drops the trailing full stop`)
  eq(L.studioDocsExcerpt('ab cdefghijklmnopqrstuvwxyz', 15), 'ab cdefghijklmn…', `${label}: excerpt, the only space is early: cut at the limit instead of leaving a stub`)
  eq(L.studioDocsExcerpt('abcdefghij klmnopqrstuvwxyz', 15), 'abcdefghij…', `${label}: excerpt, a space late enough: cut at the word`)
  eq(L.studioDocsExcerpt('Done - and - ', 100), 'Done - and -', `${label}: excerpt, short text is trimmed, never ellipsised`)

  // the link kinds and which docs links land
  for (const [href, kind] of [['/builder', 'internal'], ['/docs/x/y', 'internal'], ['#top', 'anchor'], ['mailto:a@b.c', 'mail'], ['https://example.com', 'external'], ['//cdn.example.com/x', 'external'], ['http://example.com', 'external'], ['', 'external'], [undefined, 'external'], [' /help ', 'internal'], ['relative/page', 'external']]) eq(L.studioDocsLinkKind(href), kind, `${label}: link kind of ${JSON.stringify(href)}`)
  const real = SECTIONS
  for (const [href, lands] of [['/docs', true], ['/docs/', true], ['/docs/api', true], ['/docs/api#x', true], ['/docs/getting-started/quick-start-guide', true], ['/docs/getting-started/quick-start-guide#step-1', true], ['/docs/getting-started/quick-start-guide?x=1', true], ['/docs/agent-reference/director-agent', true], ['/docs/features', false], ['/docs/agent-reference', false], ['/docs/getting-started/nope', false], ['/docs/nope/quick-start-guide', false], ['/docs/getting-started/quick-start-guide/extra', false], ['/docs/api/extra', false], ['/builder', true], ['/help', true], ['/docsx', true], ['/docsx/a/b', true], [' /docs/features ', false], [' /docs ', true], ['/resources', true], ['https://example.com/docs/x', true], [undefined, true]]) eq(L.studioDocsLinkLands(href, real), lands, `${label}: ${JSON.stringify(href)} ${lands ? 'lands' : 'is a dead end'}`)

  // the content pass: the rules run in order, once, in their own article; the sections handed in are never changed
  const rulesFx = [
    { doc: 'a/first-steps', from: 'Begin here.', to: 'Start here.' },
    { doc: 'a/first-steps', from: 'Start here.', to: 'Start now.' },
    { doc: 'a/charts', from: 'no such text', to: 'x' },
    { doc: 'b-two/export', from: 'Save as PDF.', to: 'Save as $& PDF.' },
    { doc: 'b-two/other', from: 'Export', to: 'Wrong article' },
  ]
  const untouched = fixtureSections()
  const now = L.studioDocsCurrent(untouched, rulesFx)
  deepEq(untouched, fixtureSections(), `${label}: current: the sections handed in are never changed`)
  eq(now[0].items[0].content, '# First Steps\n\nStart now.', `${label}: current: the rules run in order, each on the text the one before left`)
  eq(now[0].items[1].content, untouched[0].items[1].content, `${label}: current: a rule whose text is not found changes nothing`)
  eq(now[1].items[0].content, '# Export\n\nSave as $& PDF. A Chart can be exported too.', `${label}: current: the new text is literal (a "$&" stays "$&")`)
  deepEq(now.map(section => [section.id, section.title, section.items.map(item => [item.id, item.title, item.slug, item.category])]), untouched.map(section => [section.id, section.title, section.items.map(item => [item.id, item.title, item.slug, item.category])]), `${label}: current: only the text changes (ids, titles, slugs, categories, sections)`)
  ok(now !== untouched && now[0] !== untouched[0] && now[0].items !== untouched[0].items && now[0].items[1] !== untouched[0].items[1], `${label}: current: copies all the way down (an article no rule names too)`)
  deepEq(L.studioDocsCurrent(untouched, []), fixtureSections(), `${label}: current: no rules, the same text`)
  deepEq(L.studioDocsCurrent([], rulesFx), [], `${label}: current: no sections`)
  const twice = [{ id: 't', title: 'T', items: [{ id: 't1', title: 'T1', slug: 's', category: 't', content: 'x x x' }] }]
  eq(L.studioDocsCurrent(twice, [{ doc: 't/s', from: 'x', to: 'y' }])[0].items[0].content, 'y x x', `${label}: current: a rule swaps the first occurrence only`)
  const clash = [{ id: 'a', title: 'A', items: [{ id: 'c1', title: 'Charts', slug: 'charts', category: 'a', content: 'x' }] }, { id: 'b', title: 'B', items: [{ id: 'c2', title: 'Charts', slug: 'charts', category: 'b', content: 'x' }] }]
  deepEq(L.studioDocsCurrent(clash, [{ doc: 'a/charts', from: 'x', to: 'y' }]).map(section => section.items[0].content), ['y', 'x'], `${label}: current: a rule names its article by category and slug`)
  // one article, by category and slug; the others in its category
  eq(L.studioDocsItem(fixture, 'a', 'charts').id, 'a2', `${label}: item: found by category and slug`)
  eq(L.studioDocsItem(fixture, 'b-two', 'export').id, 'b1', `${label}: item: ... in the other category too`)
  eq(L.studioDocsItem(fixture, 'b-two', 'charts'), undefined, `${label}: item: the category counts, not the slug alone`)
  eq(L.studioDocsItem(fixture, 'a', 'nope'), undefined, `${label}: item: no such slug`)
  eq(L.studioDocsItem([], 'a', 'charts'), undefined, `${label}: item: no sections`)
  const five = [{ id: 'f', title: 'F', items: ['1', '2', '3', '4', '5'].map(n => ({ id: `i${n}`, title: `T${n}`, slug: `s${n}`, category: 'f', content: `# T${n}` })) }]
  deepEq(L.studioDocsRelated(five, five[0].items[0]).map(item => item.id), ['i2', 'i3', 'i4'], `${label}: related: the first three others, in order`)
  deepEq(L.studioDocsRelated(five, five[0].items[3]).map(item => item.id), ['i1', 'i2', 'i3'], `${label}: related: never the open article`)
  deepEq(L.studioDocsRelated(five, five[0].items[0], 2).map(item => item.id), ['i2', 'i3'], `${label}: related: the limit is a parameter`)
  deepEq(L.studioDocsRelated(fixture, fixture[1].items[0]), [], `${label}: related: a lone article has none`)
  deepEq(L.studioDocsRelated(fixture, { ...fixture[0].items[0], category: 'zz' }), [], `${label}: related: an unknown category has none`)
  // the links the footers drop
  for (const [href, hidden] of [['/docs/api', true], ['/docs/api/', true], [' /docs/api ', true], ['/docs/api#x', true], ['/docs/api?x=1', true], ['/integrations', true], ['/integrations/', true], ['/integrations#inout', true], ['/agents', true], ['/agents/', true], ['/agents?x=1', true], ['/agents/director', false], ['/agents/nope', false], ['/docs', false], ['/docs/getting-started/quick-start-guide', false], ['/docs/apix', false], ['/integrationsx', false], ['/agentsx', false], ['/experts', false], ['/pricing', false], ['https://example.com/agents', false], ['', false], [undefined, false], [5, false]]) {
    eq(L.studioDocsHiddenHref(href), hidden, `${label}: ${JSON.stringify(href)} is ${hidden ? 'dropped' : 'kept'} by the footers`)
  }
  for (const href of HIDDEN) ok(L.studioDocsHiddenHref(href), `${label}: the test's own list: ${href} is dropped`)
  // the Landing footer
  const help = { label: 'Help', href: '/help' }, docsLink = { label: 'Docs', href: '/docs' }, security = { label: 'Security', href: '/legal/security' }, cookies = { label: 'Cookies', href: '/legal/cookies' }
  eq(V3_LINKS[6].href, '/legal/privacy', `${label}: footer: the Landing's seventh link is Privacy`)
  eq(V3_LINKS[7].href, '/legal/terms', `${label}: footer: ... the eighth Terms`)
  deepEq(L.studioDocsFooterLinks(V3_LINKS), [...V3_LINKS.slice(0, 6), help, docsLink, ...V3_LINKS.slice(6), security, cookies], `${label}: footer: Help and Docs before the legal links, Security and Cookies after them; Privacy once`)
  deepEq(L.studioDocsFooterLinks(V3_LINKS).map(link => link.label), ['Bring', 'Present', 'Experts', 'Pricing', 'Learn', 'About', 'Help', 'Docs', 'Privacy', 'Terms', 'Security', 'Cookies'], `${label}: footer: the Landing's twelve links`)
  deepEq(L.studioDocsFooterLinks([]), [help, docsLink, security, cookies], `${label}: footer: no links, the four`)
  deepEq(L.studioDocsFooterLinks([{ label: 'Home', href: '/' }]), [{ label: 'Home', href: '/' }, help, docsLink, security, cookies], `${label}: footer: no legal links, the four go last`)
  deepEq(L.studioDocsFooterLinks([{ label: 'Terms', href: '/legal/terms' }]), [help, docsLink, { label: 'Terms', href: '/legal/terms' }, security, cookies], `${label}: footer: Terms alone is where the legal links start`)
  deepEq(L.studioDocsFooterLinks([{ label: 'Help', href: '/help' }, { label: 'Privacy', href: '/legal/privacy' }, { label: 'Security', href: '/legal/security' }]), [{ label: 'Help', href: '/help' }, docsLink, { label: 'Privacy', href: '/legal/privacy' }, { label: 'Security', href: '/legal/security' }, cookies], `${label}: footer: a link already there is never added twice`)
  { const all = L.studioDocsFooterLinks(L.studioDocsFooterLinks(V3_LINKS)); deepEq(all, L.studioDocsFooterLinks(V3_LINKS), `${label}: footer: twice is once`) }
  { const given = [{ label: 'Home', href: '/', extra: 1 }]; const out = L.studioDocsFooterLinks(given); ok(out !== given && given.length === 1 && out[0].extra === 1, `${label}: footer: a copy; the links keep their own fields`) }
  eq(new Set(L.studioDocsFooterLinks(V3_LINKS).map(link => link.href)).size, 12, `${label}: footer: no address twice`)

  // the real articles
  for (const doc of ALL_DOCS) {
    const excerpt = L.studioDocsExcerpt(doc.content)
    ok(excerpt.length > 0 && excerpt.length <= 151, `${label}: real ${doc.slug}: a card has text of fitting length (${excerpt.length})`)
    nomatch(excerpt, /[#`*_|]|\]\(|\n/, `${label}: real ${doc.slug}: no markdown in the card text`)
    nomatch(excerpt, /^\s|\s$|\s\s/, `${label}: real ${doc.slug}: no stray space in the card text`)
    const split = L.studioDocsSplit(doc.content, doc.title)
    match(doc.content, /^# /, `${label}: real ${doc.slug}: the article opens with its own heading`)
    eq(split.title, doc.content.split('\n')[0].replace(/^#\s+/, '').trim(), `${label}: real ${doc.slug}: the title is the first heading`)
    nomatch(split.body.split('\n').find(line => line.trim() !== '') ?? '', /^#\s/, `${label}: real ${doc.slug}: the body does not open with a level-1 heading`)
    ok(split.body.length > 100, `${label}: real ${doc.slug}: the body is the rest`)
  }
  { // the same articles, order and neighbours as lib/docs.ts, with the rules' text
    const current = L.studioDocsCurrent(SECTIONS, RULES)
    deepEq(current.map(section => [section.id, section.title, section.items.map(item => [item.id, item.slug, item.title, item.category])]), SECTIONS.map(section => [section.id, section.title, section.items.map(item => [item.id, item.slug, item.title, item.category])]), `${label}: real current: every section, article, slug and title as before`)
    for (const doc of ALL_DOCS) {
      eq(L.studioDocsItem(current, doc.category, doc.slug).id, DOCS_API.getDocBySlug(doc.category, doc.slug).id, `${label}: real current: ${doc.slug} is found where lib/docs.ts finds it`)
      deepEq(L.studioDocsRelated(current, doc).map(item => item.id), DOCS_API.getRelatedDocs(doc).map(item => item.id), `${label}: real current: ${doc.slug} has the neighbours lib/docs.ts gives it`)
    }
    eq(L.studioDocsItem(current, 'agent-reference', 'scripter-agent'), undefined, `${label}: real current: the article nobody wrote is still not found`)
  }
  const realNav = L.studioDocsNav(SECTIONS, 'getting-started', 'quick-start-guide')
  eq(realNav.flatMap(section => section.items).length, ALL_DOCS.length, `${label}: the real side list has one entry per article`)
  for (const item of realNav.flatMap(section => section.items)) ok(DOCS_API.getDocBySlug(item.href.split('/')[2], item.href.split('/')[3]), `${label}: ${item.href} is an article that exists`)
  eq(realNav.flatMap(section => section.items).filter(item => item.current).length, 1, `${label}: the real side list marks exactly one article`)
  return L
}
const REAL_LIB = proveLib(SOURCES[LIB])
{
  // what the old side list and the old links did (informational: the numbers the PR's notes quote)
  const oldNav = CONTENT_MODULE.docNavigation.flatMap(section => section.items)
  const dead = oldNav.filter(item => !DOCS_API.getDocBySlug(item.href.split('/')[2], item.href.split('/')[3]))
  notes.push(`the old side list: ${oldNav.length} entries, ${dead.length} dead (${dead.map(item => item.title).join(', ')})`)
  const links = ALL_DOCS.flatMap(doc => [...doc.content.matchAll(/\]\(([^)\s]+)\)/g)].map(m => m[1]))
  const deadLinks = links.filter(href => !REAL_LIB.studioDocsLinkLands(href, SECTIONS))
  notes.push(`links inside the articles: ${links.length}, ${deadLinks.length} into the docs with no page (${[...new Set(deadLinks)].join(', ')})`)
  for (const href of deadLinks) match(href, /^\/docs\//, 'a dead link is a docs link')
}

// ---------------------------------------------------------------- 2. the components (executed)
function mount(uiSource, libSource = SOURCES[LIB], { params = {}, docs = DOCS_API } = {}) {
  const react = makeReact()
  const lib = load(libSource, LIB)
  const deps = {
    react: react.api,
    'next/link': LINK,
    'next/navigation': { useParams: () => params },
    'react-markdown': { __esModule: true, default: props => jsx('ReactMarkdown', props) },
    'remark-gfm': { __esModule: true, default: 'remarkGfm' },
    '@/lib/docs': docs,
    '@/lib/studio-p2-docs': lib,
    '@/content/studio-p2-docs-agents': { STUDIO_DOCS_AGENT_RULES: RULES },
  }
  const mod = load(uiSource, UI, { deps })
  const render = name => { react.reset(); return expand(mod[name]()) }
  return { mod, render }
}
const byType = (tree, type) => nodes(tree).filter(node => node.type === type)
const attr = (node, name) => node.props[name]
const links = tree => byType(tree, 'Link')
function proveComponents(uiSource = SOURCES[UI], label = 'ui', libSource = SOURCES[LIB], frameSource = SOURCES[FRAME]) {
  const W = WORDS
  const total = ALL_DOCS.length
  const CURRENT = REAL_LIB.studioDocsCurrent(SECTIONS, RULES) // what the pages show: the docs with the agent-name rules applied
  const ALL_CURRENT = CURRENT.flatMap(section => section.items)
  const cur = doc => ALL_CURRENT.find(item => item.id === doc.id)
  const { render, mod } = mount(uiSource, libSource)
  deepEq(Object.keys(mod).sort(), ['StudioDocArticle', 'StudioDocsIndex'], `${label}: the two components are exported`)
  nomatch(uiSource, /\bShare\b/, `${label}: no "Share" control (it did nothing)`)
  nomatch(uiSource, /bg-gradient|from-purple|to-blue|text-purple|bg-purple|dark:/, `${label}: no utility colours or gradients (the CSS owns every colour)`)

  // ---- the index
  const index = mount(uiSource, libSource)
  let tree = index.render('StudioDocsIndex')
  const outer = tree
  eq(outer.type, 'div', `${label}: index: the page is one element`)
  eq(attr(outer, 'data-studio-p2-docs-page'), 'index', `${label}: index: its marker`)
  eq(attr(outer, 'className'), 'sd-page', `${label}: index: its class`)
  deepEq(outer.props.children.flat().map(child => child.type), ['Header', 'main', 'Footer'], `${label}: index: the site's header, the page, the site's footer`)
  eq(byType(tree, 'main').length, 1, `${label}: index: one main landmark`)
  eq(attr(byType(tree, 'main')[0], 'className'), 'sd-main container mx-auto px-4', `${label}: index: its class: the site header's own column`)
  eq(byType(tree, 'h1').length, 1, `${label}: index: one h1`)
  eq(text(byType(tree, 'h1')[0]), W.title, `${label}: index: the title`)
  eq(text(byType(tree, 'span').find(s => attr(s, 'className') === 'sd-eyebrow')), W.eyebrow, `${label}: index: the eyebrow`)
  eq(text(byType(tree, 'header')[0].props.children.find(c => c.type === 'p' && !attr(c, 'className'))), W.lede, `${label}: index: the lede`)
  const input = byType(tree, 'input')[0]
  eq(attr(input, 'type'), 'search', `${label}: index: a search field`)
  eq(attr(input, 'aria-label'), W.searchLabel, `${label}: index: the field has a name (a placeholder is not one)`)
  eq(attr(input, 'placeholder'), W.searchPlaceholder, `${label}: index: placeholder`)
  eq(attr(input, 'value'), '', `${label}: index: starts empty`)
  const status = () => byType(tree, 'p').find(p => attr(p, 'role') === 'status')
  eq(text(status()), `${total} articles in ${SECTIONS.length} categories`, `${label}: index: the count`)
  eq(attr(status(), 'className'), 'sd-count', `${label}: index: the count's class`)
  deepEq(byType(tree, 'section').map(section => text(byType(section, 'h2')[0])), SECTIONS.map(section => section.title), `${label}: index: a section per category, in order`)
  for (const section of byType(tree, 'section')) {
    const heading = byType(section, 'h2')[0]
    eq(attr(section, 'aria-labelledby'), attr(heading, 'id'), `${label}: index: ${text(heading)}: the section is named by its heading`)
    eq(attr(section, 'className'), 'sd-section', `${label}: index: ${text(heading)}: class`)
  }
  const cards = links(byType(tree, 'section'))
  eq(cards.length, total, `${label}: index: one card per article`)
  for (const doc of ALL_DOCS) {
    const card = cards.find(c => attr(c, 'href') === `/docs/${doc.category}/${doc.slug}`)
    ok(card, `${label}: index: ${doc.slug}: a card to its address`)
    eq(attr(card, 'className'), 'sd-card', `${label}: index: ${doc.slug}: card class`)
    const [title, excerpt] = card.props.children
    eq(text(title), doc.title, `${label}: index: ${doc.slug}: the card's title`)
    eq(attr(title, 'className'), 'sd-card__title', `${label}: index: ${doc.slug}: title class`)
    eq(text(excerpt), REAL_LIB.studioDocsExcerpt(cur(doc).content), `${label}: index: ${doc.slug}: the card's text is the article's first paragraph`)
    eq(attr(excerpt, 'className'), 'sd-card__text', `${label}: index: ${doc.slug}: text class`)
    nomatch(text(excerpt), /[#`*_|]|\]\(/, `${label}: index: ${doc.slug}: no markdown shows on the card`)
    ok(byType(title, 'ArrowRight').length === 1 && attr(byType(title, 'ArrowRight')[0], 'aria-hidden') === 'true', `${label}: index: ${doc.slug}: the arrow is decoration`)
  }
  eq(byType(tree, 'ul').filter(u => attr(u, 'className') === 'sd-cards').length, SECTIONS.length, `${label}: index: a list of cards per section`)
  ok(!text(tree).includes('Documentation Articles') && !text(tree).includes('AI agents to learn') && !text(tree).includes('Categories'), `${label}: index: the three stat tiles (one a hard-coded "8") are gone`)
  const aside = byType(tree, 'aside')[0]
  eq(attr(aside, 'aria-labelledby'), 'sd-help-title', `${label}: index: the help band is named by its heading`)
  eq(text(byType(aside, 'h2')[0]), W.helpTitle, `${label}: index: help title`)
  eq(attr(byType(aside, 'h2')[0], 'id'), 'sd-help-title', `${label}: index: help title id`)
  eq(text(byType(aside, 'p')[0]), W.helpBody, `${label}: index: help body`)
  const helpLink = links(aside)[0]
  eq(attr(helpLink, 'href'), '/help', `${label}: index: the Help Center link`)
  eq(text(helpLink), W.helpCenter, `${label}: index: Help Center word`)
  eq(attr(helpLink, 'className'), 'sd-button sd-button--primary', `${label}: index: Help Center is the primary action`)
  const mail = byType(aside, 'a')[0]
  eq(attr(mail, 'href'), `mailto:${W.supportEmail}`, `${label}: index: the second way is the support address, not a second link to the same page`)
  eq(text(mail), W.emailSupport, `${label}: index: email word`)
  eq(links(aside).length, 1, `${label}: index: one link inside the help band`)
  eq(byType(tree, 'div').filter(d => attr(d, 'data-studio-p2-docs-state') === 'empty').length, 0, `${label}: index: no empty state while there are articles`)

  // ---- the search
  const type = value => { attr(byType(tree, 'input')[0], 'onChange')({ target: { value } }); tree = index.render('StudioDocsIndex') }
  type('chart')
  const expected = REAL_LIB.studioDocsFilter(CURRENT, 'chart')
  eq(text(status()), `${expected.shown} of ${total} articles match “chart”`, `${label}: search: the count follows`)
  eq(links(byType(tree, 'section')).length, expected.shown, `${label}: search: only the matches`)
  eq(attr(byType(tree, 'input')[0], 'value'), 'chart', `${label}: search: the field keeps its text`)
  deepEq(byType(tree, 'section').map(section => text(byType(section, 'h2')[0])), expected.sections.map(section => section.title), `${label}: search: sections with no hit are gone`)
  type('  CHART ')
  eq(links(byType(tree, 'section')).length, expected.shown, `${label}: search: trimmed and any case`)
  type('zzzzqq')
  eq(text(status()), `0 of ${total} articles match “zzzzqq”`, `${label}: search: no hit, said in the count`)
  eq(byType(tree, 'section').length, 0, `${label}: search: no section when nothing matches`)
  const empty = byType(tree, 'div').find(d => attr(d, 'data-studio-p2-docs-state') === 'empty')
  ok(empty, `${label}: search: an empty state`)
  eq(attr(empty, 'className'), 'sd-empty', `${label}: search: empty class`)
  eq(text(byType(empty, 'h2')[0]), W.emptyTitle, `${label}: search: empty title`)
  eq(text(byType(empty, 'p')[0]), W.emptyBody, `${label}: search: empty body`)
  const clear = byType(empty, 'button')[0]
  eq(text(clear), W.clearSearch, `${label}: search: the way out is a button`)
  eq(attr(clear, 'type'), 'button', `${label}: search: ... of type button`)
  ok(byType(tree, 'aside').length === 1, `${label}: search: the help band is still there`)
  attr(clear, 'onClick')()
  tree = index.render('StudioDocsIndex')
  eq(attr(byType(tree, 'input')[0], 'value'), '', `${label}: search: clearing empties the field`)
  eq(links(byType(tree, 'section')).length, total, `${label}: search: ... and brings every article back`)
  eq(text(status()), `${total} articles in ${SECTIONS.length} categories`, `${label}: search: ... and the plain count`)

  type('scripter')
  eq(text(status()), `0 of ${total} articles match “scripter”`, `${label}: search: the old agent names are not in the text any more`)
  type('content generator')
  { const hits = ALL_CURRENT.filter(item => `${item.title} ${item.content}`.toLowerCase().includes('content generator')).map(item => `/docs/${item.category}/${item.slug}`)
    ok(hits.length === 3, `${label}: search: three articles name the Content Generator (${hits.length})`)
    deepEq(links(byType(tree, 'section')).map(link => attr(link, 'href')), hits, `${label}: search: the current agent names are found`) }
  attr(byType(tree, 'input')[0], 'onChange')({ target: { value: '' } }); tree = index.render('StudioDocsIndex')

  // ---- an article
  const first = ALL_DOCS[0]
  const part = mount(uiSource, libSource, { params: { category: first.category, slug: first.slug } })
  const article = part.render('StudioDocArticle')
  eq(attr(article, 'data-studio-p2-docs-page'), 'article', `${label}: article: its marker`)
  deepEq(article.props.children.flat().map(child => child.type), ['Header', 'nav', 'div', 'Footer'], `${label}: article: header, breadcrumb, the two columns, footer`)
  const crumbs = byType(article, 'nav').find(n => attr(n, 'aria-label') === W.breadcrumb)
  ok(crumbs, `${label}: article: a breadcrumb`)
  eq(attr(crumbs, 'className'), 'sd-crumbs container mx-auto px-4', `${label}: article: crumbs class: the site header's own column`)
  eq(attr(byType(article, 'div').find(d => String(attr(d, 'className')).startsWith('sd-layout')), 'className'), 'sd-layout container mx-auto px-4', `${label}: article: the two columns sit in the site header's own column`)
  const crumbItems = byType(crumbs, 'li')
  eq(crumbItems.length, 3, `${label}: article: three crumbs`)
  deepEq(links(crumbs).map(link => [attr(link, 'href'), text(link)]), [['/', W.home], ['/docs', W.docsLabel]], `${label}: article: Home and Documentation are links`)
  eq(attr(crumbItems[2], 'aria-current'), 'page', `${label}: article: the last crumb is the page`)
  eq(text(crumbItems[2]), first.title, `${label}: article: ... the article's listed title`)
  eq(crumbItems.filter(item => attr(item, 'aria-current') === 'page').length, 1, `${label}: article: only one is current`)
  eq(byType(article, 'main').length, 1, `${label}: article: one main landmark`)
  const navs = byType(article, 'nav').filter(n => attr(n, 'aria-label') === W.navLabel)
  eq(navs.length, 2, `${label}: article: the article list twice (the side column; the phone's folded copy)`)
  eq(attr(navs[0], 'className'), 'sd-side', `${label}: article: side class`)
  const details = byType(article, 'details')[0]
  eq(attr(details, 'className'), 'sd-side-mobile', `${label}: article: the folded copy's class`)
  eq(text(byType(details, 'summary')[0]), W.navSummary, `${label}: article: the folded copy opens by "All articles"`)
  ok(byType(details, 'nav').length === 1 && attr(byType(details, 'nav')[0], 'aria-label') === W.navLabel, `${label}: article: the folded copy holds the list`)
  for (const nav of navs) {
    const listed = links(nav)
    deepEq(listed.map(link => attr(link, 'href')), ALL_DOCS.map(doc => `/docs/${doc.category}/${doc.slug}`), `${label}: article: the list names exactly the articles that exist, in order`)
    deepEq(listed.map(link => text(link)), ALL_DOCS.map(doc => doc.title), `${label}: article: ... by their titles`)
    const current = listed.filter(link => attr(link, 'aria-current') === 'page')
    eq(current.length, 1, `${label}: article: one is marked as the open page`)
    eq(attr(current[0], 'href'), `/docs/${first.category}/${first.slug}`, `${label}: article: ... the open one`)
    deepEq(byType(nav, 'p').map(p => text(p)), SECTIONS.map(section => section.title), `${label}: article: the category names`)
    for (const p of byType(nav, 'p')) eq(attr(p, 'className'), 'sd-side__title', `${label}: article: category name class`)
  }
  for (const doc of ALL_DOCS) ok(DOCS_API.getDocBySlug(doc.category, doc.slug), `${label}: article: ${doc.slug} exists`)
  const head = byType(article, 'header').find(h => attr(h, 'className') === 'sd-article__head')
  ok(head, `${label}: article: a heading block`)
  eq(text(byType(head, 'span')[0]), SECTIONS.find(section => section.id === first.category).title, `${label}: article: the eyebrow is its category's title`)
  eq(byType(article, 'h1').length, 1, `${label}: article: one h1`)
  const split = REAL_LIB.studioDocsSplit(cur(first).content, first.title)
  eq(text(byType(article, 'h1')[0]), split.title, `${label}: article: the title is the article's own first heading`)
  const markdown = byType(article, 'ReactMarkdown')[0]
  eq(markdown.props.children, split.body, `${label}: article: the body without that heading (the title is shown once)`)
  deepEq(markdown.props.remarkPlugins, ['remarkGfm'], `${label}: article: tables and task lists still render (remark-gfm)`)
  eq(attr(byType(article, 'div').find(d => attr(d, 'className') === 'sd-prose'), 'className'), 'sd-prose', `${label}: article: the text sits in the prose block`)
  const C = markdown.props.components
  deepEq(Object.keys(C).sort(), ['a', 'h1', 'table'], `${label}: article: the markdown's three overrides`)
  deepEq(plain(C.h1({ children: 'Inner' })), { type: 'h2', props: { children: 'Inner' } }, `${label}: article: a second level-1 heading in the text is a level 2 (one h1 per page)`)
  const wrapped = C.table({ children: 'rows' })
  eq(wrapped.type, 'div', `${label}: article: a table scrolls inside a wrapper`)
  eq(wrapped.props.className, 'sd-table', `${label}: article: ... its class`)
  eq(wrapped.props.children.type, 'table', `${label}: article: ... around the table`)
  const live = C.a({ href: '/builder', children: 'Builder' })
  eq(live.type, 'Link', `${label}: article: a link inside the site stays in the tab`)
  eq(live.props.href, '/builder', `${label}: article: ... to the same place`)
  const liveDoc = C.a({ href: '/docs/getting-started/quick-start-guide#x', children: 'Guide' })
  eq(liveDoc.type, 'Link', `${label}: article: a docs link that lands is a link`)
  const dead = C.a({ href: '/docs/features', children: 'Features' })
  eq(dead.type, 'span', `${label}: article: a docs link to nowhere is plain text, not a dead end`)
  eq(dead.props['data-studio-p2-docs-dead-link'], 'true', `${label}: article: ... marked`)
  eq(dead.props.children, 'Features', `${label}: article: ... with its words`)
  eq(dead.props.href, undefined, `${label}: article: ... and no address`)
  const deadFolder = C.a({ href: '/docs/agent-reference', children: 'Agents' })
  eq(deadFolder.type, 'span', `${label}: article: a category address with no page is plain text too`)
  const external = C.a({ href: 'https://example.com/x', children: 'Out' })
  eq(external.type, 'a', `${label}: article: an outside link is a plain anchor`)
  eq(external.props.target, '_blank', `${label}: article: ... opened in a new tab`)
  eq(external.props.rel, 'noopener noreferrer', `${label}: article: ... safely`)
  const mailLink = C.a({ href: 'mailto:a@b.c', children: 'Mail' })
  eq(mailLink.type, 'a', `${label}: article: a mail link is an anchor`)
  eq(mailLink.props.target, undefined, `${label}: article: ... in the same tab`)
  const anchor = C.a({ href: '#step', children: 'Step' })
  eq(anchor.type, 'a', `${label}: article: an in-page link is an anchor`)
  eq(anchor.props.href, '#step', `${label}: article: ... kept`)
  const relatedSection = byType(article, 'section').find(s => attr(s, 'aria-labelledby') === 'sd-related-title')
  ok(relatedSection, `${label}: article: related articles`)
  eq(text(byType(relatedSection, 'h2')[0]), W.related, `${label}: article: related title`)
  const related = links(relatedSection)
  const sameCategory = ALL_CURRENT.filter(doc => doc.category === first.category && doc.id !== first.id).slice(0, 3)
  deepEq(related.map(link => attr(link, 'href')), sameCategory.map(doc => `/docs/${doc.category}/${doc.slug}`), `${label}: article: the others in its category (never itself)`)
  related.forEach((link, i) => eq(text(link.props.children[1]), REAL_LIB.studioDocsExcerpt(sameCategory[i].content, 100), `${label}: article: a related card's text is its first paragraph, at most 100`))
  eq(attr(byType(relatedSection, 'ul')[0], 'className'), 'sd-cards sd-cards--three', `${label}: article: related cards: three across`)
  const aside2 = byType(article, 'aside')[0]
  eq(text(byType(aside2, 'h2')[0]), W.moreHelpTitle, `${label}: article: help title`)
  eq(text(byType(aside2, 'p')[0]), W.moreHelpBody, `${label}: article: help body`)
  deepEq(links(aside2).map(link => [attr(link, 'href'), text(link)]), [['/help', W.helpCenter], ['/docs', W.browseAll]], `${label}: article: Help Center and Browse all docs`)
  eq(byType(article, 'button').length, 0, `${label}: article: no button at all (the Share button did nothing)`)
  // every category has an article that opens
  for (const doc of ALL_DOCS) {
    const view = mount(uiSource, libSource, { params: { category: doc.category, slug: doc.slug } }).render('StudioDocArticle')
    eq(attr(view, 'data-studio-p2-docs-page'), 'article', `${label}: article ${doc.slug}: opens`)
    eq(byType(view, 'h1').length, 1, `${label}: article ${doc.slug}: one h1`)
    eq(text(byType(view, 'h1')[0]), REAL_LIB.studioDocsSplit(cur(doc).content, doc.title).title, `${label}: article ${doc.slug}: the heading is the article's own first heading`)
    eq(byType(view, 'ReactMarkdown')[0].props.children, REAL_LIB.studioDocsSplit(cur(doc).content, doc.title).body, `${label}: article ${doc.slug}: its text is the current text (the agent names of the rules)`)
    nomatch(byType(view, 'ReactMarkdown')[0].props.children, /Scripter|Graphic Artist|Data Visualizer/, `${label}: article ${doc.slug}: no agent of the old set is named`)
    eq(text(byType(byType(view, 'nav').find(n => attr(n, 'aria-label') === W.breadcrumb), 'li')[2]), doc.title, `${label}: article ${doc.slug}: the last crumb is the listed title`)
    eq(links(byType(view, 'nav').find(n => attr(n, 'className') === 'sd-side')).filter(l => attr(l, 'aria-current') === 'page').map(l => attr(l, 'href')).join(), `/docs/${doc.category}/${doc.slug}`, `${label}: article ${doc.slug}: marked in the list`)
  }
  // a first paragraph longer than the card: the index cuts at 150, a related card at 100 (the real articles' paragraphs are all shorter)
  const longParagraph = 'This opening paragraph goes on for a good while, longer than any card has room for, so the card must cut it at a word and say so. '.repeat(3).trim()
  const longSections = [{ id: 'long', title: 'Long', items: ['one', 'two'].map(slug => ({ id: slug, title: `Article ${slug}`, slug, category: 'long', content: `# Article ${slug}\n\n${longParagraph}\n\n## More\n\nBody.` })) }]
  const longDocs = { getAllDocs: () => longSections, getDocBySlug: (c, s) => longSections.flatMap(x => x.items).find(i => i.category === c && i.slug === s), getRelatedDocs: doc => longSections[0].items.filter(i => i.id !== doc.id).slice(0, 3) }
  const longIndex = mount(uiSource, libSource, { docs: longDocs }).render('StudioDocsIndex')
  for (const card of links(byType(longIndex, 'section'))) { const t = text(card.props.children[1]); ok(t.endsWith('…') && t.length <= 151 && t.length > 100, `${label}: long: an index card is cut at 150 (${t.length})`) }
  const longArticle = mount(uiSource, libSource, { params: { category: 'long', slug: 'one' }, docs: longDocs }).render('StudioDocArticle')
  const longRelated = links(byType(longArticle, 'section').find(x => attr(x, 'aria-labelledby') === 'sd-related-title'))
  eq(longRelated.length, 1, `${label}: long: the one other article is related`)
  { const t = text(longRelated[0].props.children[1]); ok(t.endsWith('…') && t.length <= 101 && t.length > 60, `${label}: long: a related card is cut at 100 (${t.length})`) }
  // an array-valued param (Next gives one for catch-all routes) still opens the article
  const arrayParams = mount(uiSource, libSource, { params: { category: [first.category], slug: [first.slug] } }).render('StudioDocArticle')
  eq(attr(arrayParams, 'data-studio-p2-docs-page'), 'article', `${label}: article: an array param opens the article`)
  // not found
  for (const params of [{ category: 'agent-reference', slug: 'scripter-agent' }, { category: 'nope', slug: 'nope' }, {}, null, { category: first.category }]) {
    const view = mount(uiSource, libSource, { params }).render('StudioDocArticle')
    eq(attr(view, 'data-studio-p2-docs-page'), 'not-found', `${label}: missing ${JSON.stringify(params)}: its marker`)
    deepEq([view.props.children].flat(2).map(child => child.type), ['Header', 'main', 'Footer'], `${label}: missing: the site's header and footer stay`)
    eq(byType(view, 'h1').length, 1, `${label}: missing: one h1`)
    eq(text(byType(view, 'h1')[0]), W.notFoundTitle, `${label}: missing: its title`)
    eq(text(byType(view, 'p')[0]), W.notFoundBody, `${label}: missing: says what happened`)
    deepEq(links(view).map(link => [attr(link, 'href'), text(link), attr(link, 'className')]), [['/docs', W.backToDocs, 'sd-button sd-button--primary'], ['/help', W.helpCenter, 'sd-button']], `${label}: missing: two ways on`)
    eq(attr(byType(view, 'div').find(d => attr(d, 'data-studio-p2-docs-state') === 'not-found'), 'className'), 'sd-empty', `${label}: missing: state marker and class`)
    eq(attr(byType(view, 'main')[0], 'className'), 'sd-main sd-main--narrow container mx-auto px-4', `${label}: missing: a narrow column`)
  }
  // the frame
  const frameModule = load(frameSource, FRAME)
  for (const area of ['docs', 'legal', 'agents']) {
    const element = frameModule.StudioDocsFrame({ area, children: 'inside' })
    eq(element.type, 'div', `${label}: frame ${area}: one element`)
    deepEq(Object.keys(element.props).sort(), ['children', 'data-studio-p2-docs'], `${label}: frame ${area}: only the marker and the page`)
    eq(element.props['data-studio-p2-docs'], area, `${label}: frame ${area}: the marker names the area`)
    eq(element.props.children, 'inside', `${label}: frame ${area}: the page inside`)
  }
  nomatch(frameSource, /use client/, `${label}: the frame is a plain server component`)
  match(frameSource, /import "\.\/studio-p2-docs\.css"/, `${label}: the frame loads the stylesheet`)
  match(uiSource, /^"use client"/, `${label}: the components are client components`)
  match(uiSource, /import "\.\/studio-p2-docs\.css"/, `${label}: the components load the stylesheet`)
}
proveComponents()

// ---------------------------------------------------------------- 3. the wiring
const insertFor = ({ component, name, legacy, what }) => `import { ${component} } from '@/components/studio-docs/studio-p2-docs';\n\n// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): ${what} in the Studio shell's tokens. Anything else: the page below, untouched.\nconst STUDIO_P2_DOCS = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true';\n\nexport default function ${name}() {\n  return STUDIO_P2_DOCS ? <${component} /> : <${legacy} />;\n}\n\nfunction ${legacy}() {\n`
const PAGES = [
  { file: PAGE_INDEX, component: 'StudioDocsIndex', name: 'DocsPage', legacy: 'LegacyDocsPage', what: 'the index', params: {}, touch: "const [searchQuery, setSearchQuery] = useState('');" },
  { file: PAGE_ARTICLE, component: 'StudioDocArticle', name: 'DocPage', legacy: 'LegacyDocPage', what: 'the article', params: { category: 'getting-started', slug: 'quick-start-guide' }, touch: 'const params = useParams();' },
]
function provePage(page, code, label) {
  const prior = baseSource(page.file)
  const run = (source, env, params = page.params) => {
    const react = makeReact()
    const deps = { react: react.api, 'next/link': LINK, 'next/navigation': { useParams: () => params }, 'react-markdown': { __esModule: true, default: 'ReactMarkdown' }, 'remark-gfm': { __esModule: true, default: 'remarkGfm' }, '@/lib/docs': DOCS_API }
    const mod = load(source, page.file, { deps, env })
    react.reset()
    return mod.default()
  }
  const paramSets = page.file === PAGE_ARTICLE ? [page.params, { category: 'agent-reference', slug: 'scripter-agent' }] : [page.params]
  // flag off (or any spelling but "true"): the same tree as the base commit's, down to the last prop
  for (const env of OFF_SPELLINGS) for (const params of paramSets) {
    eq(rendered(expand(run(code, env, params))), rendered(expand(run(prior, env, params))), `${label}: ${page.file}: env ${JSON.stringify(env)}: the tree equals the base commit's`)
  }
  // flag on: the new component, with no props
  for (const env of [ON, { ...ON, NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }, { ...ON, NEXT_PUBLIC_STUDIO_V4_SHELL: 'false' }]) {
    const top = run(code, env)
    eq(top.type, page.component, `${label}: ${page.file}: on ${JSON.stringify(env)}: the new component`)
    eq(Object.keys(top.props).length, 0, `${label}: ${page.file}: on: no props`)
  }
  eq(run(code, {}).type.name, page.legacy, `${label}: ${page.file}: off: the old page's function`)
  // the old code is the base commit's, with one import, one flag line and one wrapper
  const insert = insertFor(page)
  const restored = code.replace(insert, `\nexport default function ${page.name}() {\n`)
  eq(restored, prior, `${label}: ${page.file}: removing the additions gives back the base commit's page byte for byte`)
  eq(code.length - restored.length, insert.length - `\nexport default function ${page.name}() {\n`.length, `${label}: ${page.file}: and nothing else was added`)
  match(code, /const STUDIO_P2_DOCS = process\.env\.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true';/, `${label}: ${page.file}: flag read inline (Next inlines NEXT_PUBLIC at build), exact true`)
  match(code, new RegExp(`return STUDIO_P2_DOCS \\? <${page.component} /> : <${page.legacy} />;`), `${label}: ${page.file}: the wrapper picks by the flag`)
  match(code, /^'use client';/, `${label}: ${page.file}: still a client page`)
}
for (const page of PAGES) provePage(page, SOURCES[page.file], 'page')
const LAYOUTS = [[LAYOUT_DOCS, 'docs', 'DocsLayout'], [LAYOUT_LEGAL, 'legal', 'LegalLayout'], [LAYOUT_AGENTS, 'agents', 'AgentsLayout']]
function proveLayout(file, area, name, code, label = 'layout') {
  const run = env => load(code, file, { env }).default
  const child = { type: 'child', props: {} }
  for (const env of OFF_SPELLINGS) eq(run(env)({ children: child }), child, `${label}: ${file}: env ${JSON.stringify(env)}: the page is handed through untouched (the same element)`)
  for (const env of [ON, { ...ON, NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }]) {
    const top = run(env)({ children: child })
    eq(top.type, 'StudioDocsFrame', `${label}: ${file}: on: the frame`)
    deepEq(Object.keys(top.props).sort(), ['area', 'children'], `${label}: ${file}: on: only the area and the page`)
    eq(top.props.area, area, `${label}: ${file}: on: the area is ${area}`)
    eq(top.props.children, child, `${label}: ${file}: on: the same page inside`)
  }
  eq(run({}).name, name, `${label}: ${file}: the layout's name`)
  match(code, /process\.env\.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true'/, `${label}: ${file}: flag read inline, exact true`)
  nomatch(code, /use client/, `${label}: ${file}: a plain server layout`)
  if (area === 'docs') ok(/export const metadata/.test(code), `${label}: ${file}: carries the index's tab title`)
  else nomatch(code, /metadata|generateMetadata/, `${label}: ${file}: no metadata (the page titles come from their own layouts)`)
}
for (const [file, area, name] of LAYOUTS) proveLayout(file, area, name, SOURCES[file])
// every page this PR does not change is the base commit's, byte for byte
const UNCHANGED = [
  'app/legal/privacy/page.tsx', 'app/legal/terms/page.tsx', 'app/legal/security/page.tsx', 'app/legal/cookies/page.tsx',
  'app/help/page.tsx', 'app/help/layout.tsx', 'components/help/studio-help.tsx', 'components/help/studio-help.css',
  'app/integrations/page.tsx', 'next.config.mjs',
  'components/layout/Header.tsx', 'components/marketing/PageHeader.tsx', 'components/marketing/Section.tsx',
  'content/docs.ts', 'lib/docs.ts', 'types/docs.ts', 'content/agents.ts', 'lib/agents.ts',
]
for (const file of UNCHANGED) eq(read(file), baseSource(file), `${file} is the base commit's, byte for byte`)
// ruling 2 (no legal or security wording is changed): the four legal pages are in that list
for (const file of ['app/legal/privacy/page.tsx', 'app/legal/terms/page.tsx', 'app/legal/security/page.tsx', 'app/legal/cookies/page.tsx']) ok(UNCHANGED.includes(file), `${file} is pinned to the base commit`)
// the redirects that make /integrations and /agents unreachable are still there (so those two pages are not restyled)
match(read('next.config.mjs'), /source: '\/integrations', destination: '\/bring#inout'/, '/integrations still redirects to /bring#inout')
match(read('next.config.mjs'), /source: '\/agents', destination: '\/experts'/, '/agents still redirects to /experts (exact path: /agents/<agent> is served)')


// the tabs: a title for each page that had none, and the double " | Deckster" gone from the four that had it (the root layout's template adds the suffix)
const AGENTS_CONTENT = load(read('content/agents.ts'), 'content/agents.ts', { deps: { '@/types/agents': {} } })
const AGENTS_API = load(read('lib/agents.ts'), 'lib/agents.ts', { deps: { '@/content/agents': AGENTS_CONTENT, '@/types/agents': {} } })
const SUFFIX_NOTE = name => `    // PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS): the root layout's title template already adds " | Deckster"; the tab read "${name} | Deckster | Deckster".\n`
function proveTitleFix(file, name, code, label = 'title') {
  const prior = baseSource(file)
  const run = env => load(code, file, { env })
  const baseMeta = load(prior, file).metadata
  match(baseMeta.title, / \| Deckster$/, `${label}: ${file}: the base title carries the suffix the root template adds again`)
  for (const env of OFF_SPELLINGS) deepEq(run(env).metadata, baseMeta, `${label}: ${file}: env ${JSON.stringify(env)}: the metadata equals the base commit's`)
  deepEq(run(ON).metadata, { title: name, description: baseMeta.description }, `${label}: ${file}: on: the title without the suffix, the description as before`)
  const from = `    title: '${name} | Deckster',\n`
  const to = `${SUFFIX_NOTE(name)}    title: process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' ? '${name}' : '${name} | Deckster',\n`
  eq(code.replace(to, from), prior, `${label}: ${file}: undoing the one edit gives back the base commit's file byte for byte`)
  eq(code.length - prior.length, to.length - from.length, `${label}: ${file}: and nothing else was added`)
  eq(run(ON).default({ children: 'x' }).props.children, 'x', `${label}: ${file}: the layout still hands the page through`)
}
for (const [file, name] of TITLE_FIXES) proveTitleFix(file, name, SOURCES[file])
const NEW_TITLES = [[META_PRIVACY, 'Privacy Policy'], [META_TERMS, 'Terms of Service']]
function proveNewTitle(file, title, code, label = 'tab') {
  const run = env => load(code, file, { env })
  for (const env of OFF_SPELLINGS) deepEq(run(env).metadata, {}, `${label}: ${file}: env ${JSON.stringify(env)}: no metadata (as before)`)
  deepEq(run(ON).metadata, { title }, `${label}: ${file}: on: the page's name`)
  const child = { type: 'child', props: {} }
  eq(run(ON).default({ children: child }), child, `${label}: ${file}: the page is handed through`)
  nomatch(code, /use client/, `${label}: ${file}: a plain server layout`)
  match(code, /process\.env\.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true'/, `${label}: ${file}: flag read inline, exact true`)
}
for (const [file, title] of NEW_TITLES) proveNewTitle(file, title, SOURCES[file])
function proveDocsTab(code, label = 'tab') {
  const run = env => load(code, LAYOUT_DOCS, { env }).metadata
  for (const env of OFF_SPELLINGS) deepEq(run(env), {}, `${label}: ${LAYOUT_DOCS}: env ${JSON.stringify(env)}: no metadata (as before)`)
  deepEq(run(ON), { title: { default: 'Documentation | Deckster', template: '%s | Deckster' }, description: 'Guides and answers for turning your ideas into finished slides' }, `${label}: ${LAYOUT_DOCS}: on: the index's tab, and the suffix template for the pages below`)
}
proveDocsTab(SOURCES[LAYOUT_DOCS])
async function proveGenerated(file, code, { lookup, deps, unknown, params, label = 'tab' }) {
  const mod = env => load(code, file, { env, deps })
  const child = { type: 'child', props: {} }
  eq(mod(ON).default({ children: child }), child, `${label}: ${file}: the page is handed through`)
  nomatch(code, /use client/, `${label}: ${file}: a plain server layout`)
  for (const env of OFF_SPELLINGS) deepEq(await mod(env).generateMetadata({ params: Promise.resolve(params(lookup[0])) }), {}, `${label}: ${file}: env ${JSON.stringify(env)}: no metadata (as before)`)
  for (const item of lookup) deepEq(await mod(ON).generateMetadata({ params: Promise.resolve(params(item)) }), { title: item.title }, `${label}: ${file}: on: ${item.title}`)
  deepEq(await mod(ON).generateMetadata({ params: Promise.resolve(unknown) }), { title: file === META_ARTICLE ? 'Article not found' : 'Agent not found' }, `${label}: ${file}: on: an unknown address`)
  match(code, /process\.env\.NEXT_PUBLIC_STUDIO_P2_DOCS !== 'true'\) return \{\}/, `${label}: ${file}: flag read inline, exact true`)
}
const articleTab = (code, label) => proveGenerated(META_ARTICLE, code, { lookup: ALL_DOCS, deps: { '@/lib/docs': DOCS_API }, unknown: { category: 'nope', slug: 'nope' }, params: doc => ({ category: doc.category, slug: doc.slug }), label })
const agentTab = (code, label) => proveGenerated(META_AGENT, code, { lookup: AGENTS_CONTENT.agents.map(agent => ({ ...agent, title: agent.name })), deps: { '@/lib/agents': AGENTS_API }, unknown: { slug: 'nope' }, params: agent => ({ slug: agent.slug }), label })
await articleTab(SOURCES[META_ARTICLE])
await agentTab(SOURCES[META_AGENT])
ok(AGENTS_CONTENT.agents.length >= 8, 'the real agents are loaded')

// ---------------------------------------------------------------- 3b. the content pass (PROGRAM-1 rulings, 22 Oct)
// ruling 3: the docs name the current agents. The current set is read from three real places that must agree.
const AGENT_NAMES = plain(TEAM).map(agent => agent.name)
const OLD_NAMES = ['Scripter', 'Graphic Artist', 'Data Visualizer']
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const EMOJI = { Researcher: '🔍', Analyst: '📈', 'Content Generator': '✍️', Visualizer: '📊', 'Theme Builder': '🎨', 'Slide Composer': '🎼', 'Element Generator': '🧱' }
const QS_DOC = 'getting-started/quick-start-guide', UA_DOC = 'getting-started/understanding-agents', DA_DOC = 'agent-reference/director-agent'
deepEq(AGENT_NAMES, ['Director', 'Researcher', 'Analyst', 'Content Generator', 'Visualizer', 'Theme Builder', 'Slide Composer', 'Element Generator'], 'the current team (AGENT_TEAM): these eight, in this order')
deepEq(AGENTS_CONTENT.agents.map(agent => agent.name), AGENT_NAMES, 'content/agents.ts (the agent pages) names the same eight in the same order')
{
  const sentence = /Deckster runs as eight specialists:[^"]*/.exec(read('app/help/page.tsx'))?.[0]
  ok(sentence, 'the Help page tells of the eight specialists')
  for (const name of AGENT_NAMES) ok(sentence.includes(name), `the Help page's sentence names ${name}`)
  eq(NUMBER_WORDS[AGENT_NAMES.length], 'eight', 'the Help page says eight, and the team is eight')
  const experts = plain(V3.pages.experts.team.agents).map(agent => agent.name)
  for (const name of AGENT_NAMES.slice(1)) ok(experts.includes(name), `the Experts page lists ${name}`)
  notes.push(`the Experts page also lists "${experts.at(-1)}" (${V3.pages.experts.team.agents.at(-1).status}); the docs do not name it`)
}
for (const name of OLD_NAMES) ok(!AGENT_NAMES.includes(name), `${name} is not in the current team`)
const COUNT_RE = /\b(?:four|4)\b[^.\n]{0,12}\bagents?\b/gi
function proveRules(rulesSource, label = 'rules') {
  nomatch(rulesSource, /^\s*import\s(?!type\s)/m, `${label}: data only (a type import at most)`)
  match(rulesSource, /^import type \{ StudioDocRule \} from "@\/lib\/studio-p2-docs"$/m, `${label}: the one import is the rule's type`)
  const rules = plain(load(rulesSource, AGENT_RULES).STUDIO_DOCS_AGENT_RULES)
  eq(rules.length, 11, `${label}: eleven rules`)
  const byKey = new Map(ALL_DOCS.map(doc => [`${doc.category}/${doc.slug}`, doc]))
  rules.forEach((rule, i) => {
    deepEq(Object.keys(rule).sort(), ['doc', 'from', 'to'], `${label}: rule ${i}: a doc, the text, its replacement`)
    ok(byKey.has(rule.doc), `${label}: rule ${i}: ${rule.doc} is an article that exists`)
    eq(byKey.get(rule.doc)?.content.split(rule.from).length - 1, 1, `${label}: rule ${i}: its text is found once in ${rule.doc}`)
    ok(rule.to !== rule.from && !rule.to.includes(rule.from), `${label}: rule ${i}: the new text is new, and applying the rules twice is applying them once`)
    nomatch(rule.to, /Scripter|Graphic Artist|Data Visualizer/, `${label}: rule ${i}: the new text names none of the old agents`)
  })
  deepEq([...new Set(rules.map(rule => rule.doc))].sort(), [DA_DOC, QS_DOC, UA_DOC], `${label}: the three articles that named the old agents`)
  const current = REAL_LIB.studioDocsCurrent(SECTIONS, rules)
  const now = Object.fromEntries(current.flatMap(section => section.items).map(item => [`${item.category}/${item.slug}`, item.content]))
  deepEq(REAL_LIB.studioDocsCurrent(current, rules).flatMap(section => section.items).map(item => item.content), current.flatMap(section => section.items).map(item => item.content), `${label}: the rules applied to the current text change nothing`)
  // nothing but the rules changed: put each rule's old text back, last rule first, and every article is the base commit's, byte for byte
  for (const doc of ALL_DOCS) {
    const key = `${doc.category}/${doc.slug}`
    let back = now[key]
    for (const rule of rules.filter(r => r.doc === key).reverse()) { eq(back.split(rule.to).length - 1, 1, `${label}: ${key}: the new text of a rule is found once`); back = back.replace(rule.to, () => rule.from) }
    eq(back, doc.content, `${label}: ${key}: put the old text back and the article is the base commit's, byte for byte`)
    if (!rules.some(rule => rule.doc === key)) eq(now[key], doc.content, `${label}: ${key}: no rule names it, so it reads as before`)
    nomatch(now[key], /Scripter|Graphic Artist|Data Visualizer/, `${label}: ${key}: none of the old agents is named`)
    nomatch(now[key], COUNT_RE, `${label}: ${key}: no count of four agents`)
  }
  const before = ALL_DOCS.map(doc => doc.content).join('\n')
  const oldCounts = OLD_NAMES.map(name => before.split(name).length - 1)
  ok(oldCounts.every(count => count >= 5), `${label}: the base text named each old agent at least five times (${oldCounts.join('/')})`)
  eq((before.match(COUNT_RE) ?? []).length, 5, `${label}: the base text counted its agents five times ("four" / "4")`)
  // the count follows the set
  const word = NUMBER_WORDS[AGENT_NAMES.length], Word = word[0].toUpperCase() + word.slice(1)
  const qs = now[QS_DOC], ua = now[UA_DOC], da = now[DA_DOC]
  match(qs, new RegExp(`^Our ${word} AI agents will collaborate to create your presentation:$`, 'm'), `${label}: quick start: "Our ${word} AI agents"`)
  match(ua, new RegExp(`^## The ${Word} AI Agents$`, 'm'), `${label}: understanding: "The ${Word} AI Agents"`)
  match(ua, new RegExp(`^- \\*\\*Pro Tier\\*\\*: All ${AGENT_NAMES.length} agents with full collaboration$`, 'm'), `${label}: understanding: the Pro line counts ${AGENT_NAMES.length}`)
  match(da, new RegExp(`^Agent collaboration: All ${word} agents needed$`, 'm'), `${label}: director: "All ${word} agents needed"`)
  match(da, new RegExp(`^- Coordinates all ${AGENT_NAMES.length} agents$`, 'm'), `${label}: director: coordinates ${AGENT_NAMES.length}`)
  // quick start: the list is the team, in order; the seven new lines are AGENT_TEAM's own roles; the Director keeps its line
  const list = /Our eight AI agents will collaborate to create your presentation:\n\n((?:- \*\*.+\n)+)/.exec(qs)?.[1].trim().split('\n') ?? []
  deepEq(list.map(line => /^- \*\*(.+?)\*\*: /.exec(line)?.[1]), AGENT_NAMES, `${label}: quick start: the list names the current team, in order`)
  list.forEach((line, i) => eq(line, i === 0 ? '- **Director**: Plans the structure and flow' : `- **${TEAM[i].name}**: ${TEAM[i].role}`, `${label}: quick start: ${AGENT_NAMES[i]}'s line`))
  // understanding: a section per agent, the Director's as before, the seven new ones in content/agents.ts's own words
  const heads = [...ua.matchAll(/^### (\S+) (.+) Agent$/gm)].map(m => [m[1], m[2]])
  deepEq(heads.map(head => head[1]), AGENT_NAMES, `${label}: understanding: a section per agent, in order`)
  deepEq(heads.slice(1).map(head => head[0]), AGENT_NAMES.slice(1).map(name => EMOJI[name]), `${label}: understanding: each new section opens with its icon`)
  let at = ua.indexOf('### 🎯 Director Agent')
  ok(at >= 0, `${label}: understanding: the Director's section is first and as it was`)
  AGENT_NAMES.slice(1).forEach((name, i) => {
    const agent = AGENTS_CONTENT.agents.find(candidate => candidate.name === name)
    const sentence = /^.*?\.(?=\s|$)/.exec(agent.description)[0]
    const expected = `### ${EMOJI[name]} ${name} Agent\n**Role**: ${agent.title}\n\n${sentence} This agent:\n${agent.capabilities.slice(0, 4).map(capability => `- ${capability.title}`).join('\n')}\n\n`
    const found = ua.indexOf(expected)
    ok(found > at, `${label}: understanding: ${name}: the section is content/agents.ts's own words (role, first sentence, first four capabilities), after the one before`)
    at = found
    ok(i === AGENT_NAMES.length - 2 ? ua.startsWith('## How Agents Collaborate', found + expected.length) : ua.startsWith('### ', found + expected.length), `${label}: understanding: ${name}: followed by the next section`)
  })
  match(ua, /^3\. \*\*Content Generator\*\* and \*\*Slide Composer\*\* work together on each slide$/m, `${label}: understanding: Scripter and Graphic Artist -> Content Generator and Slide Composer`)
  match(ua, /^4\. \*\*Visualizer\*\* is called when data needs visualization$/m, `${label}: understanding: Data Visualizer -> Visualizer`)
  match(ua, /^Use the Visualizer to create charts showing our quarterly growth$/m, `${label}: understanding: the first prompt names the Visualizer`)
  match(ua, /^Have the Content Generator and Slide Composer work together to make slide 5 more impactful$/m, `${label}: understanding: the second prompt names the Content Generator and Slide Composer`)
  match(ua, /^- \*\*Free Tier\*\*: Director \+ Content Generator \(2 agents\)$/m, `${label}: understanding: the Free line names the Content Generator`)
  match(da, /^- \*\*Content Generator\*\*: Write executive summary and conclusions$/m, `${label}: director: Scripter -> Content Generator`)
  match(da, /^- \*\*Visualizer\*\*: Create charts for all metrics$/m, `${label}: director: Data Visualizer -> Visualizer`)
  match(da, /^- \*\*Slide Composer\*\*: Design clean, professional layouts$/m, `${label}: director: Graphic Artist -> Slide Composer`)
  match(da, /^- \*\*Sequence\*\*: Content Generator → Visualizer → Slide Composer per slide$/m, `${label}: director: the sequence`)
  match(da, /^- Works with Content Generator only$/m, `${label}: director: the Free line`)
  return { now, oldCounts }
}
{
  const { oldCounts } = proveRules(SOURCES[AGENT_RULES])
  notes.push(`docs text, before: Scripter x${oldCounts[0]}, Graphic Artist x${oldCounts[1]}, Data Visualizer x${oldCounts[2]}, a count of four agents x5; after: none`)
}

// ruling 1: /docs/api says it is not available yet. The notice component:
function proveNotice(source, label = 'notice', libSource = SOURCES[LIB]) {
  const mod = load(source, API_NOTICE, { deps: { '@/lib/studio-p2-docs': load(libSource, LIB) } })
  deepEq(Object.keys(mod), ['StudioApiNotice'], `${label}: one component`)
  const tree = mod.StudioApiNotice()
  eq(tree.type, 'div', `${label}: one element`)
  eq(attr(tree, 'className'), 'sd-api-notice container mx-auto px-4', `${label}: the site header's own column`)
  eq(attr(tree, 'role'), 'note', `${label}: a note`)
  eq(attr(tree, 'aria-labelledby'), 'sd-api-notice-title', `${label}: named by its title`)
  const box = tree.props.children
  eq(box.type, 'div', `${label}: the box`)
  eq(attr(box, 'className'), 'sd-api-notice__box', `${label}: box class`)
  const [title, body] = box.props.children
  eq(title.type, 'p', `${label}: the title`)
  eq(attr(title, 'id'), 'sd-api-notice-title', `${label}: title id`)
  eq(attr(title, 'className'), 'sd-api-notice__title', `${label}: title class`)
  eq(text(title), 'Not available yet', `${label}: it says "Not available yet"`)
  eq(attr(body, 'className'), 'sd-api-notice__text', `${label}: text class`)
  eq(text(body), WORDS.apiNoticeBody, `${label}: it says what that means`)
  match(text(body), /no API key/, `${label}: ... there is no key to generate`)
  match(text(body), /cannot be called/, `${label}: ... the endpoints cannot be called`)
  eq(nodes(tree).filter(node => node.type === 'a' || node.type === 'Link' || node.type === 'button').length, 0, `${label}: no link, no button`)
  nomatch(source, /use client/, `${label}: a plain component (the page that uses it is a client page)`)
  match(source, /import "\.\/studio-p2-docs\.css"/, `${label}: loads the stylesheet`)
  nomatch(source, /bg-gradient|from-purple|to-blue|text-purple|bg-purple|dark:/, `${label}: no utility colours or gradients`)
}
proveNotice(SOURCES[API_NOTICE])

// the page itself: the notice is the one addition; off, the page is the base commit's
const undoAll = (code, pairs) => pairs.reduce((out, [to, from]) => { eq(out.split(to).length - 1, 1, `the addition is found once: ${to.slice(0, 60).replace(/\n/g, ' ')}`); return out.replace(to, () => from) }, code)
function proveApiPage(code, label = 'api page') {
  const prior = baseSource(PAGE_API)
  const run = (source, env) => load(source, PAGE_API, { env }).default()
  for (const env of OFF_SPELLINGS) eq(rendered(run(code, env)), rendered(run(prior, env)), `${label}: env ${JSON.stringify(env)}: the tree equals the base commit's`)
  for (const env of [ON, { ...ON, NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }]) {
    const top = run(code, env)
    const kids = top.props.children.filter(child => child !== false)
    deepEq(kids.map(child => child.type), ['Header', 'StudioApiNotice', 'PageHeader', 'Section', 'Footer'], `${label}: on: the notice sits under the site's header, before the title`)
    deepEq(Object.keys(kids[1].props), [], `${label}: on: the notice takes no props`)
    eq(rendered({ ...top, props: { ...top.props, children: kids.filter(kid => kid.type !== 'StudioApiNotice') } }), rendered(run(prior, env)), `${label}: on: take the notice away and it is the base commit's page, word for word`)
  }
  eq(undoAll(code, [
    ["import { StudioApiNotice } from '@/components/studio-docs/studio-p2-docs-api-notice';\n", ''],
    ["// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): this page documents an API that is not open yet; with the flag on a notice says so under the header and the page below it is muted. Off: the page as it was.\nconst STUDIO_P2_DOCS = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true';\n\n", ''],
    ['            {STUDIO_P2_DOCS && <StudioApiNotice />}\n', ''],
  ]), prior, `${label}: removing the three additions gives back the base commit's page byte for byte`)
  match(code, /const STUDIO_P2_DOCS = process\.env\.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true';/, `${label}: flag read inline, exact true`)
  match(code, /^'use client';/, `${label}: still a client page`)
  for (const claim of ['Authentication', 'Core Endpoints', '/v1/presentations/generate', 'Rate Limits', '100 requests per minute for Pro plans']) ok(code.includes(claim), `${label}: the page keeps its words ("${claim}")`)
}
proveApiPage(SOURCES[PAGE_API])

// ruling 5 (and 1's footer link): the footers, the agent pages and /compare do not link /integrations, /agents or /docs/api. The oracle: the base commit's own tree with those elements taken out.
const DROP = Symbol('drop')
function prune(node) {
  if (Array.isArray(node)) return node.map(prune).filter(item => item !== DROP)
  if (!isElement(node)) return node
  const kids = [node.props.children].flat()
  if (typeof node.props.href === 'string' && HIDDEN.includes(node.props.href)) return DROP
  if ((node.type === 'li' || node.type === 'Button') && kids.some(kid => isElement(kid) && HIDDEN.includes(kid.props.href))) return DROP
  if (!('children' in node.props)) return node
  const next = prune(node.props.children)
  return { ...node, props: { ...node.props, children: next === DROP ? undefined : next } }
}
const hrefsOf = tree => nodes(tree).filter(node => node.type === 'Link' || node.type === 'a').map(node => node.props.href)
function proveFooter(code, label = 'footer', libSource = SOURCES[LIB]) {
  const prior = baseSource(FOOTER)
  const render = (source, env, props) => load(source, FOOTER, { env, deps: { 'next/link': LINK, '@/lib/studio-p2-docs': load(libSource, LIB) } }).Footer(props)
  for (const props of [undefined, { compact: true }]) {
    const mode = props ? 'compact' : 'full'
    for (const env of OFF_SPELLINGS) eq(rendered(expand(render(code, env, props))), rendered(expand(render(prior, env, props))), `${label}: ${mode}: env ${JSON.stringify(env)}: the tree equals the base commit's`)
    const base = expand(render(prior, {}, props))
    for (const env of [ON, { ...ON, NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }]) {
      const on = expand(render(code, env, props))
      eq(rendered(on), rendered(prune(base)), `${label}: ${mode}: on: the base commit's footer without the links to /agents, /integrations and /docs/api, and nothing else`)
      for (const href of HIDDEN) ok(!hrefsOf(on).includes(href), `${label}: ${mode}: on: no link to ${href}`)
    }
    const dropped = hrefsOf(base).filter(href => HIDDEN.includes(href))
    deepEq(dropped, props ? ['/agents'] : ['/agents', '/docs/api'], `${label}: ${mode}: the base footer linked ${props ? '/agents' : '/agents and /docs/api'}, so that is what goes`)
    for (const href of ['/help', '/docs', '/legal/privacy', '/legal/terms', ...(props ? ['/pricing', '/compare', '/about'] : ['/legal/security', '/legal/cookies', '/templates', '/builder'])]) ok(hrefsOf(expand(render(code, ON, props))).includes(href), `${label}: ${mode}: on: the link to ${href} stays`)
  }
  // ruling 2: the footer's claims are not touched
  const on = text(expand(render(code, ON)))
  for (const claim of ['SSL Encrypted', 'GDPR Compliant', '99.9% Uptime', 'Privacy First']) ok(on.includes(claim), `${label}: on: "${claim}" is as it was`)
  eq(undoAll(code, [
    ["import { studioDocsHiddenHref } from '@/lib/studio-p2-docs';\n\n// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): /docs/api is not available yet, and /integrations and /agents are redirects, so with the flag on neither footer links them. Off: every link as before.\nconst STUDIO_P2_DOCS = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true';\nconst linked = (href: string) => !(STUDIO_P2_DOCS && studioDocsHiddenHref(href));\n", ''],
    [`{linked('/agents') && <li><Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground transition-colors">AI Agents</Link></li>}`, `<li><Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground transition-colors">AI Agents</Link></li>`],
    ['footerLinks.resources.filter((link) => linked(link.href)).map((link) => (', 'footerLinks.resources.map((link) => ('],
    ['links.filter((l) => linked(l.href)).map((l) => (', 'links.map((l) => ('],
  ]), prior, `${label}: removing the additions gives back the base commit's footer byte for byte`)
  match(code, /const STUDIO_P2_DOCS = process\.env\.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true';/, `${label}: flag read inline, exact true`)
  match(code, /^'use client';/, `${label}: still a client component`)
}
proveFooter(SOURCES[FOOTER])

// ruling 4: the Landing footer
function proveFooterV3(code, label = 'landing footer', libSource = SOURCES[LIB]) {
  const prior = baseSource(FOOTER_V3)
  const run = (source, env) => load(source, FOOTER_V3, { env, deps: { 'next/link': LINK, '@/lib/marketing/v3-content': { V3_CONTENT: V3 }, '@/lib/studio-p2-docs': load(libSource, LIB) } }).FooterV3()
  const linksOf = tree => byType(tree, 'Link').map(link => [attr(link, 'href'), text(link)])
  for (const env of OFF_SPELLINGS) {
    eq(rendered(run(code, env)), rendered(run(prior, env)), `${label}: env ${JSON.stringify(env)}: the tree equals the base commit's`)
    deepEq(linksOf(run(code, env)), V3_LINKS.map(link => [link.href, link.label]), `${label}: env ${JSON.stringify(env)}: the eight links it had`)
  }
  for (const env of [ON, { ...ON, NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }]) {
    const on = run(code, env)
    deepEq(linksOf(on), [['/bring', 'Bring'], ['/present', 'Present'], ['/experts', 'Experts'], ['/pricing', 'Pricing'], ['/learn', 'Learn'], ['/about', 'About'], ['/help', 'Help'], ['/docs', 'Docs'], ['/legal/privacy', 'Privacy'], ['/legal/terms', 'Terms'], ['/legal/security', 'Security'], ['/legal/cookies', 'Cookies']], `${label}: on: the eight it had, with Help, Docs, Security and Cookies`)
    eq(linksOf(on).filter(([href]) => href === '/legal/privacy').length, 1, `${label}: on: Privacy once`)
    eq(text(byType(on, 'span')[0]), V3.footer.copyright, `${label}: on: the copyright line as it was`)
    eq(attr(byType(on, 'nav')[0], 'aria-label'), 'Footer navigation', `${label}: on: the navigation keeps its name`)
    eq(attr(on, 'className'), 'ftr', `${label}: on: the footer keeps its class`)
    eq(new Set(byType(on, 'Link').map(link => link.key)).size, 12, `${label}: on: a key for each link`)
  }
  eq(undoAll(code, [
    ['import { studioDocsFooterLinks } from "@/lib/studio-p2-docs"\n\n// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): Help, Docs, Security and Cookies join Privacy and Terms (no other link on the Landing reached them). Off: the footer as it was.\nconst STUDIO_P2_DOCS = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === "true"\n', ''],
    ['  const links = STUDIO_P2_DOCS ? studioDocsFooterLinks(V3_CONTENT.footer.links) : V3_CONTENT.footer.links\n', ''],
    ['{links.map((link) =>', '{V3_CONTENT.footer.links.map((link) =>'],
  ]), prior, `${label}: removing the additions gives back the base commit's footer byte for byte`)
  match(code, /const STUDIO_P2_DOCS = process\.env\.NEXT_PUBLIC_STUDIO_P2_DOCS === "true"/, `${label}: flag read inline, exact true`)
  nomatch(code, /use client/, `${label}: still a server component`)
}
proveFooterV3(SOURCES[FOOTER_V3])

// ruling 5 on the pages: the agent pages and /compare
const unwrapFlag = code => code.replace(/^( *)\{!STUDIO_P2_DOCS && \(\n((?:\1  .*\n)+?)\1\)\}\n/gm, (_m, _indent, body) => body.split('\n').slice(0, -1).map(line => line.slice(2)).join('\n') + '\n')
function proveAgentPage(code, label = 'agent page') {
  const prior = baseSource(PAGE_AGENT)
  const run = (source, env, slug) => load(source, PAGE_AGENT, { env, deps: { 'next/link': LINK, 'next/navigation': { useParams: () => ({ slug }) }, '@/lib/agents': AGENTS_API } }).default()
  const slugs = ['director', 'element-generator', 'nope']
  for (const slug of slugs) {
    for (const env of OFF_SPELLINGS) eq(rendered(expand(run(code, env, slug))), rendered(expand(run(prior, env, slug))), `${label}: ${slug}: env ${JSON.stringify(env)}: the tree equals the base commit's`)
    const base = expand(run(prior, {}, slug)), on = expand(run(code, ON, slug))
    eq(rendered(on), rendered(prune(base)), `${label}: ${slug}: on: the base commit's page without the links to /agents, and nothing else`)
    ok(!hrefsOf(on).includes('/agents'), `${label}: ${slug}: on: no link to /agents`)
    eq(hrefsOf(base).filter(href => href === '/agents').length, slug === 'nope' ? 1 : 2, `${label}: ${slug}: the base page linked /agents ${slug === 'nope' ? 'once' : 'twice'}`)
    if (slug !== 'nope') {
      eq(hrefsOf(on).filter(href => /^\/agents\/[\w-]+$/.test(href)).length, 3, `${label}: ${slug}: on: the three links to other agent pages stay`)
      ok(hrefsOf(on).filter(href => href === '/builder').length === 2, `${label}: ${slug}: on: both builder links stay`)
    }
  }
  eq(unwrapFlag(undoAll(code, [["// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): /agents is a redirect (next.config.mjs), so with the flag on the three links to it are not shown. The links to the agent pages (/agents/<agent>) stay. Off: the page as it was.\nconst STUDIO_P2_DOCS = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true';\n\n", '']])), prior, `${label}: removing the flag and unwrapping the three links gives back the base commit's page byte for byte`)
  eq(code.split('{!STUDIO_P2_DOCS && (').length - 1, 3, `${label}: exactly three links are wrapped`)
  match(code, /^'use client';/, `${label}: still a client page`)
}
proveAgentPage(SOURCES[PAGE_AGENT])
function proveComparePage(code, label = 'compare page') {
  const prior = baseSource(PAGE_COMPARE)
  const run = (source, env) => load(source, PAGE_COMPARE, { env, deps: { 'next/link': LINK } }).default()
  for (const env of OFF_SPELLINGS) eq(rendered(expand(run(code, env))), rendered(expand(run(prior, env))), `${label}: env ${JSON.stringify(env)}: the tree equals the base commit's`)
  const base = expand(run(prior, {})), on = expand(run(code, ON))
  eq(rendered(on), rendered(prune(base)), `${label}: on: the base commit's page without "Meet the Team", and nothing else`)
  eq(hrefsOf(base).filter(href => href === '/agents').length, 1, `${label}: the base page linked /agents once`)
  ok(!hrefsOf(on).includes('/agents'), `${label}: on: no link to /agents`)
  ok(hrefsOf(on).includes('/builder'), `${label}: on: the Get Started link stays`)
  eq(unwrapFlag(undoAll(code, [["// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): /agents is a redirect (next.config.mjs), so with the flag on \"Meet the Team\" is not shown. Off: the page as it was.\nconst STUDIO_P2_DOCS = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true';\n\n", '']])), prior, `${label}: removing the flag and unwrapping the link gives back the base commit's page byte for byte`)
  eq(code.split('{!STUDIO_P2_DOCS && (').length - 1, 1, `${label}: exactly one link is wrapped`)
  match(code, /^'use client';/, `${label}: still a client page`)
}
proveComparePage(SOURCES[PAGE_COMPARE])

// ruling 6: no per-agent rainbow. Every per-agent colour on the agent pages is a gradient class the CSS flattens; nothing else carries one.
function proveNoRainbow(pageSource = SOURCES[PAGE_AGENT], label = 'rainbow') {
  const uses = [...pageSource.matchAll(/\.color\.(\w+)/g)].map(m => m[1])
  ok(uses.length >= 6, `${label}: the page uses the agent's colour in ${uses.length} places`)
  ok(uses.every(use => use === 'gradient'), `${label}: ... and only its gradient (not primary or secondary)`)
  const templates = [...pageSource.matchAll(/`([^`]*\$\{(?:agent|relatedAgent)\.color\.gradient\}[^`]*)`/g)].map(m => m[1])
  eq(templates.length, uses.length, `${label}: every use sits in a class template`)
  for (const template of templates) match(template, /bg-gradient-to-(?:br|b) /, `${label}: ${template.slice(0, 50)}...: the gradient is on a bg-gradient-to-* class, which the CSS flattens`)
  nomatch(pageSource, /(?:text|bg|border|from|to|via|ring|fill|stroke)-\$\{/, `${label}: no colour class is built from the agent's data`)
  nomatch(pageSource, /AGENT_TEAM|homepage-v2-content|style=\{\{[^}]*(?:color|background)/, `${label}: the hex colours of the team list and inline colours are not used here`)
  { const literals = pageSource.match(/#[0-9a-fA-F]{6}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) ?? []
    ok(literals.every(literal => /^rgba\(255,255,255,/.test(literal)), `${label}: the only literal colour in the page is the white glow (${literals.join(' ') || 'none'}), which the CSS hides`) }
  const gradients = new Set(plain(AGENTS_CONTENT.agents).map(agent => agent.color.gradient))
  ok(gradients.size >= 5, `${label}: the data has ${gradients.size} different gradients (that is what the CSS flattens)`)
  notes.push(`agent colours: ${gradients.size} different gradients in content/agents.ts, all flattened to the ink colour by the CSS (${AGENTS_CONTENT.agents.length} agent pages)`)
}
proveNoRainbow()

// /help: a template adds a display: contents marker (flag and shell on); the layout (pinned by the Atlas test), the page and the Help frame are the base commit's
function proveHelpTemplate(code, label = 'help template') {
  const run = env => load(code, HELP_TEMPLATE, { env }).default
  const child = { type: 'child', props: {} }
  const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
  // handed through untouched unless the flag AND the shell are both exactly "true"
  for (const env of [...OFF_SPELLINGS, ON, { ...ON, NEXT_PUBLIC_STUDIO_V4_SHELL: 'false' }, { ...ON, NEXT_PUBLIC_STUDIO_V4_SHELL: 'TRUE' }, { ...ON, NEXT_PUBLIC_STUDIO_V4_SHELL: '1' }, { ...SHELL, [FLAG]: 'TRUE' }, { ...SHELL, [FLAG]: '1' }, { ...SHELL, [FLAG]: 'false' }]) {
    eq(run(env)({ children: child }), child, `${label}: env ${JSON.stringify(env)}: the page is handed through (the same element)`)
  }
  const top = run({ ...ON, ...SHELL })({ children: child })
  eq(top.type, 'div', `${label}: on, with the shell: one element`)
  deepEq(top.props, { 'data-studio-p2-help': 'true', style: { display: 'contents' }, children: child }, `${label}: on, with the shell: the marker, no layout effect, the page inside`)
  eq(run({}).name, 'HelpTemplate', `${label}: the template's name`)
  match(code, /const STUDIO_P2_HELP = process\.env\.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' && process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true';/, `${label}: flag and shell read inline, exact true`)
  match(code, /import '@\/components\/help\/studio-p2-help\.css';/, `${label}: loads the stylesheet`)
  nomatch(code, /use client|metadata/, `${label}: a plain server template`)
}
proveHelpTemplate(SOURCES[HELP_TEMPLATE])

// ---------------------------------------------------------------- 4. the CSS
const rulesOf = css => { const rules = []; postcss.parse(css).walkRules(rule => rules.push(rule)); return rules }
const hex = value => { const m = /^#([0-9a-f]{6})$/i.exec(value.trim()); assert.ok(m, `${value} is a 6-digit hex`); return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) }
const luminance = rgb => { const [r, g, b] = rgb.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a, b) => { const [hi, lo] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }
const declsOf = rule => Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value]))
function shellTokens() {
  const rules = rulesOf(read(SHELL_CSS))
  const set = selector => declsOf(rules.find(r => r.selectors.includes(selector)))
  return { light: set('[data-studio-v4-shell="true"]'), dark: set('.dark [data-studio-v4-shell="true"]') }
}
const TOKENS = { frame: '--ss-frame', panel: '--ss-panel', surface: '--ss-surface', soft: '--ss-soft', line: '--ss-line', text: '--ss-text', muted: '--ss-muted', accent: '--ss-accent', 'accent-soft': '--ss-accent-soft', action: '--ss-action', 'on-action': '--ss-on-action', active: '--ss-active', teal: '--ss-teal' }
const classNamesOf = source => new Set([...source.matchAll(/className="([^"]*)"/g)].flatMap(m => m[1].split(/\s+/).filter(Boolean)))
const LEGACY_SOURCES = ['app/legal/privacy/page.tsx', 'app/legal/terms/page.tsx', 'app/legal/security/page.tsx', 'app/legal/cookies/page.tsx', 'app/docs/api/page.tsx', 'app/agents/[slug]/page.tsx', 'components/marketing/PageHeader.tsx', 'components/marketing/Section.tsx', 'components/ui/card.tsx', 'components/ui/badge.tsx', 'components/ui/button.tsx', 'components/layout/Header.tsx', 'components/layout/Footer.tsx']
const LEGACY_TEXT = LEGACY_SOURCES.map(read).join('\n')
const CSS_UI = `${SOURCES[UI]}\n${SOURCES[API_NOTICE]}` // the classes the CSS names are carried by the pages' components and by the API notice
function proveCss(css, ui = CSS_UI, label = 'css') {
  const root = postcss.parse(css)
  const rules = rulesOf(css)
  ok(rules.length > 100, `${label}: a real stylesheet (${rules.length} rules)`)
  const { light, dark } = shellTokens()
  // 1. scope: every selector names the frame's marker (or is the dark prefix of it); nothing touches another page
  for (const rule of rules) for (const selector of rule.selectors) {
    match(selector, /^(\.dark )?\[data-studio-p2-docs(="(docs|legal|agents)")?\]( |$)/, `${label}: ${selector}: only under the frame's marker (light or dark)`)
    nomatch(selector, /data-studio-v4|data-studio-help|data-studio-p2-(?!docs)|^body|\s(html|body)\b|:root/, `${label}: ${selector}: touches no other page's marker`)
  }
  // 2. tokens: the same names' values as the shell's, light and dark; nothing else declared
  const tokenRule = selector => { const rule = rules.find(r => r.selectors.length === 1 && r.selectors[0] === selector); ok(rule, `${label}: a token rule for ${selector}`); return declsOf(rule) }
  const lightSet = tokenRule('[data-studio-p2-docs]'), darkSet = tokenRule('.dark [data-studio-p2-docs]')
  deepEq(Object.keys(lightSet).filter(p => p.startsWith('--')).sort(), Object.keys(TOKENS).map(k => `--sd-${k}`).sort(), `${label}: the light set declares exactly the tokens`)
  deepEq(Object.keys(darkSet).sort(), Object.keys(TOKENS).map(k => `--sd-${k}`).sort(), `${label}: the dark set declares exactly the tokens (and nothing else)`)
  for (const [name, shell] of Object.entries(TOKENS)) {
    eq(lightSet[`--sd-${name}`], light[shell], `${label}: --sd-${name} is the shell's ${shell} (light)`)
    eq(darkSet[`--sd-${name}`], dark[shell], `${label}: --sd-${name} is the shell's ${shell} (dark)`)
  }
  eq(lightSet.background, 'var(--sd-frame)', `${label}: the frame is the shell's frame colour`)
  eq(lightSet.color, 'var(--sd-text)', `${label}: the frame's text is the shell's text colour`)
  // 3. every colour a token: var() names are declared; no literal colour outside the two token rules
  const used = new Set(); root.walkDecls(d => { for (const m of d.value.matchAll(/var\((--[\w-]+)/g)) used.add(m[1]) })
  for (const token of used) ok(token in lightSet && token in darkSet, `${label}: ${token} is declared for light and dark`)
  root.walkRules(rule => {
    if (rule.selectors.length === 1 && (rule.selectors[0] === '[data-studio-p2-docs]' || rule.selectors[0] === '.dark [data-studio-p2-docs]')) return
    rule.walkDecls(d => nomatch(d.value.replace(/color-mix\(in srgb, var\(--[\w-]+\) \d+%, #000\)/g, ''), /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/, `${label}: ${rule.selector}: ${d.prop}: no literal colour`))
  })
  root.walkDecls(d => nomatch(d.value, /gradient\(/, `${label}: ${d.prop}: no gradient value`))
  root.walkDecls(d => { if (d.important) { const at = d.parent.parent; ok(at?.type === 'atrule' && at.params === '(prefers-reduced-motion: reduce)' && d.prop === 'transition', `${label}: !important only to turn transitions off for reduced motion`) } })
  // 4. readable in both themes (WCAG AA 4.5:1 for text)
  for (const [theme, set] of [['light', lightSet], ['dark', darkSet]]) for (const [fg, bg] of [['text', 'panel'], ['muted', 'panel'], ['text', 'frame'], ['muted', 'frame'], ['accent', 'frame'], ['accent', 'panel'], ['teal', 'panel'], ['teal', 'frame'], ['teal', 'active'], ['text', 'surface'], ['muted', 'surface'], ['text', 'soft'], ['muted', 'soft'], ['on-action', 'action'], ['teal', 'surface'], ['muted', 'active']]) {
    const ratio = contrast(set[`--sd-${fg}`], set[`--sd-${bg}`])
    ok(ratio >= 4.5, `${label}: ${theme}: --sd-${fg} on --sd-${bg} is at least 4.5:1 (${ratio.toFixed(2)})`)
  }
  // 5. the classes: every class the CSS names is one the components carry, and every class they carry has a rule
  const selectorText = rules.flatMap(r => r.selectors).join('\n')
  const cssClasses = new Set([...selectorText.matchAll(/\.(sd-[\w-]+)/g)].map(m => m[1]))
  const uiClasses = new Set([...classNamesOf(ui)].filter(c => c.startsWith('sd-')))
  ok(cssClasses.size >= 25, `${label}: names its classes (${cssClasses.size})`)
  for (const c of cssClasses) ok(uiClasses.has(c), `${label}: the components carry .${c}`)
  for (const c of uiClasses) ok(cssClasses.has(c), `${label}: .${c} has a rule`)
  for (const marker of ['data-studio-p2-docs-page', 'data-studio-p2-docs-state', 'data-studio-p2-docs-dead-link']) ok(ui.includes(marker), `${label}: the component carries ${marker}`)
  // 6. the classes the old pages carry, named so the new look reaches them: each one is on those pages today
  const legacyClasses = [...new Set([...selectorText.matchAll(/\.((?!sd-)[a-z-][\w-]*)/g)].map(m => m[1]))].filter(c => c !== 'dark')
  ok(legacyClasses.length >= 15, `${label}: names the old pages' classes (${legacyClasses.length})`)
  for (const c of legacyClasses) match(LEGACY_TEXT, new RegExp(`(^|[\\s"'\`{:])${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[\\s"'\`}])`), `${label}: the old pages carry .${c}`)
  for (const [, name, value] of selectorText.matchAll(/\[(?!data-studio-p2-docs\b)([\w-]+)\*?="([^"]*)"\]/g)) {
    if (name === 'class') ok(LEGACY_TEXT.includes(value), `${label}: the old pages carry a class containing "${value}"`)
    else ok(ui.includes(`${name}=`) || LEGACY_TEXT.includes(`${name}="${value}"`), `${label}: [${name}="${value}"] is on a page this CSS styles`)
  }
  // 7. type scale: nothing under 10px; the title is the Help page's hero size; body 13px; prose 14px
  root.walkDecls('font-size', d => { if (/^[\d.]+px$/.test(d.value)) ok(parseFloat(d.value) >= 10, `${label}: font-size ${d.value} is at least 10px`) })
  const rule = selectorPart => { const found = rules.find(r => r.parent?.type === 'root' && r.selectors.includes(`[data-studio-p2-docs] ${selectorPart}`)); ok(found, `${label}: a rule for ${selectorPart}`); return declsOf(found) }
  eq(rule('.sd-hero h1')['font-size'], 'clamp(23px, 3vw, 31px)', `${label}: the page title is the Help page's hero size`)
  eq(rule('.sd-hero h1')['font-weight'], '500', `${label}: ... weight 500`)
  { const legacy = rules.find(r => r.selectors.includes('[data-studio-p2-docs] section.bg-gradient-to-br h1')); ok(legacy, `${label}: a rule for the old pages' title`); eq(declsOf(legacy)['font-size'], 'clamp(23px, 3vw, 31px)', `${label}: the old pages' title is the same size`); eq(declsOf(legacy)['font-weight'], '500', `${label}: ... weight 500`) }
  eq(rule('.sd-eyebrow')['font-size'], '10px', `${label}: the eyebrow is 10px`)
  eq(rule('.sd-eyebrow')['text-transform'], 'uppercase', `${label}: ... upper case`)
  eq(rule('.sd-eyebrow').color, 'var(--sd-accent)', `${label}: ... in the accent`)
  eq(rule('.sd-hero p')['font-size'], '13px', `${label}: the lede is 13px`)
  eq(rule('.sd-section h2')['font-size'], '17px', `${label}: a section title is 17px (the shell's section-title size)`)
  eq(rule('.sd-section h2')['font-weight'], '600', `${label}: ... weight 600`)
  eq(rule('.sd-card__title')['font-size'], '13px', `${label}: a card title is 13px`)
  eq(rule('.sd-card__text')['font-size'], '12px', `${label}: a card's text is 12px`)
  eq(rule('.sd-prose')['font-size'], '14px', `${label}: an article's text is 14px`)
  eq(rule('.sd-prose')['line-height'], '1.8', `${label}: ... with 1.8 leading`)
  eq(rule('.sd-card')['background'], 'var(--sd-panel)', `${label}: a card is the panel colour`)
  eq(rule('.sd-card')['border-radius'], '10px', `${label}: ... with 10px corners`)
  eq(rule('.sd-help')['border-radius'], '12px', `${label}: the help band has the shell's 12px corners`)
  eq(rule('.sd-button--primary').background, 'var(--sd-action)', `${label}: the primary button is the ink action colour (violet stays for AI)`)
  eq(rule('.sd-button--primary').color, 'var(--sd-on-action)', `${label}: ... with the on-action text`)
  eq(rule('.sd-button')['min-height'], '36px', `${label}: buttons are 36px high`)
  eq(rule('.sd-search input').height, '40px', `${label}: the search field is 40px high`)
  eq(rule('.sd-article')['max-width'], '760px', `${label}: an article's column is 760px at most`)
  eq(rule('.sd-layout')['grid-template-columns'], '220px minmax(0, 1fr)', `${label}: the side list is 220px`)
  // 8. controls: a visible focus ring on everything that can take focus, a hover state on the cards and buttons
  for (const part of ['.sd-card:focus-visible', '.sd-button:focus-visible', '.sd-search input:focus-visible', '.sd-crumbs a:focus-visible', '.sd-side a:focus-visible', '.sd-prose a:focus-visible', '.sd-side-mobile summary:focus-visible']) {
    ok(rules.some(r => r.selectors.some(s => s.includes(part)) && r.nodes.some(n => n.prop === 'outline' && n.value === '2px solid var(--sd-accent)')), `${label}: ${part} has a 2px accent ring`)
  }
  for (const part of ['.sd-card:hover', '.sd-button:hover', '.sd-side a:hover', '.sd-crumbs a:hover']) ok(rules.some(r => r.selectors.includes(`[data-studio-p2-docs] ${part}`)), `${label}: ${part} has a hover state`)
  eq(rule('.sd-card:hover')['border-color'], 'var(--sd-teal)', `${label}: a hovered card takes the teal edge`)
  ok(rules.some(r => r.selectors.some(s => s.includes('.sd-side a[aria-current="page"]')) && r.nodes.some(n => n.prop === 'background' && n.value === 'var(--sd-active)')), `${label}: the open article is marked in the list`)
  // 9. narrow screens and reduced motion
  const media = []; root.walkAtRules('media', a => media.push(a.params))
  for (const query of ['(max-width: 1023px)', '(max-width: 760px)', '(max-width: 640px)', '(prefers-reduced-motion: reduce)']) ok(media.includes(query), `${label}: a ${query} block`)
  const inMedia = query => rules.filter(r => r.parent?.type === 'atrule' && r.parent.params === query)
  ok(inMedia('(max-width: 1023px)').some(r => r.selectors.some(s => s.endsWith('.sd-side')) && r.nodes.some(n => n.prop === 'display' && n.value === 'none')), `${label}: below 1024px the side column gives way...`)
  ok(inMedia('(max-width: 1023px)').some(r => r.selectors.some(s => s.endsWith('.sd-side-mobile')) && r.nodes.some(n => n.prop === 'display' && n.value === 'block')), `${label}: ... to the folded list`)
  ok(rules.some(r => r.parent?.type === 'root' && r.selectors.some(s => s.endsWith('.sd-side-mobile')) && r.nodes.some(n => n.prop === 'display' && n.value === 'none')), `${label}: the folded list is hidden where the side column shows`)
  ok(inMedia('(max-width: 1023px)').some(r => r.selectors.some(s => s.endsWith('.sd-layout')) && r.nodes.some(n => n.prop === 'grid-template-columns' && n.value === 'minmax(0, 1fr)')), `${label}: the article takes the whole width below 1024px`)
  ok(inMedia('(max-width: 760px)').some(r => r.selectors.includes('[data-studio-p2-docs] .sd-cards') && r.selectors.includes('[data-studio-p2-docs] .sd-cards--three') && r.nodes.some(n => n.prop === 'grid-template-columns' && n.value === 'minmax(0, 1fr)')), `${label}: cards (and the three-across related cards) stack at 760px`)
  // the old pages: the strip under the header, the agent slides
  const old = selector => { const found = rules.find(r => r.selectors.includes(`[data-studio-p2-docs${selector.startsWith('[') ? '' : '] '}${selector}`) || r.selectors.includes(`[data-studio-p2-docs="agents"] ${selector}`)); ok(found, `${label}: a rule for ${selector}`); return declsOf(found) }
  eq(old('section.bg-gradient-to-br').background, 'var(--sd-frame)', `${label}: old pages: the page-header strip is the frame colour (no gradient)`)
  eq(old('section.bg-gradient-to-br')['border-bottom'], '0', `${label}: old pages: ... with no line under it`)
  eq(old('.-z-10')['background-color'], 'var(--sd-action)', `${label}: agents: the hero and call-to-action slides are the ink colour`)
  eq(old('.-z-10')['background-image'], 'none', `${label}: agents: ... with no gradient`)
  eq(old('[class*="bg-gradient-to-"]:not(.-z-10)')['background-color'], 'var(--sd-action)', `${label}: agents: icon tiles and step numbers are the ink colour`)
  eq(old('[class*="bg-gradient-to-b "]:not(.-z-10)')['background-color'], 'var(--sd-line)', `${label}: agents: the workflow line is the line colour (the trailing space keeps it from the to-br tiles)`)
  eq(old('[class*="bg-gradient-to-b "]:not(.-z-10)').opacity, '1', `${label}: agents: ... at full strength`)
  eq(old('.h-20').display, 'flex', `${label}: agents: the hero icon sits on its own line, above the badge`)
  eq(old('[class*="radial-gradient"]').display, 'none', `${label}: agents: the white glow is gone`)
  eq(old('.bg-card').background, 'var(--sd-panel)', `${label}: agents: a card is the panel colour`)
  eq(old('.text-primary').color, 'var(--sd-accent)', `${label}: agents: a "Learn more" link is the accent`)
  // /docs/api: the notice, and everything after it muted with the tokens (no literal colour, no opacity: the text stays readable)
  eq(rule('.sd-api-notice__title')['font-size'], '13px', `${label}: api: the notice's title is 13px`)
  eq(rule('.sd-api-notice__title')['font-weight'], '600', `${label}: api: ... weight 600`)
  eq(rule('.sd-api-notice__title').color, 'var(--sd-text)', `${label}: api: ... in the text colour`)
  eq(rule('.sd-api-notice__text')['font-size'], '12px', `${label}: api: the notice's text is 12px`)
  eq(rule('.sd-api-notice__text').color, 'var(--sd-muted)', `${label}: api: ... in the muted colour`)
  eq(rule('.sd-api-notice__box').background, 'var(--sd-panel)', `${label}: api: the notice is a panel`)
  eq(rule('.sd-api-notice__box')['border-left'], '3px solid var(--sd-action)', `${label}: api: ... with an ink edge (not an accent, not teal)`)
  eq(rule('.sd-api-notice__box')['border-radius'], '10px', `${label}: api: ... with 10px corners`)
  eq(rule('.sd-api-notice')['padding-top'], '24px', `${label}: api: the notice sits 24px under the header`)
  for (const prop of ['width', 'margin', 'padding-left', 'padding-right', 'padding-inline']) ok(!(prop in rule('.sd-api-notice')), `${label}: api: the notice sets no ${prop} (its column is the site header's container)`)
  { const muted = rule('.sd-api-notice ~ section')
    deepEq(muted, { '--sd-text': 'var(--sd-muted)', '--sd-accent': 'var(--sd-muted)', '--sd-teal': 'var(--sd-muted)' }, `${label}: api: every section after the notice reads in the muted colour: text, accent and teal become it`)
    root.walkDecls(d => { if (d.parent.selectors?.some(sel => sel.includes('.sd-api-notice ~ section'))) nomatch(d.prop, /^(opacity|filter)$/, `${label}: api: muted by colour, never by opacity or filter (the text stays readable)`) })
    eq(rule('.sd-api-notice ~ section .space-y-12 .rounded-lg:not(.bg-muted)')['border-style'], 'dashed', `${label}: api: the endpoint cards are dashed (a cue that is not colour)`)
    eq(rule('.sd-api-notice ~ section .space-y-12 .rounded-lg:not(.bg-muted)')['border-color'], 'var(--sd-muted)', `${label}: api: ... in the muted colour, so the dashes show`)
    eq(rule('.sd-api-notice ~ section :is(h2, code)').color, 'var(--sd-muted)', `${label}: api: headings and code read in the muted colour too`) }
  { const tail = rules.map(r => r.selectors.join(',')); const noticeAt = tail.findIndex(sel => sel.includes('.sd-api-notice ~ section .space-y-12')); const cardAt = tail.findIndex(sel => sel.includes('.space-y-12 .rounded-lg:not(.bg-muted)') && !sel.includes('.sd-api-notice'))
    ok(cardAt >= 0 && noticeAt > cardAt, `${label}: api: the dashed rule comes after the solid card rule it overrides (same weight, later wins)`) }
  ok(inMedia('(max-width: 640px)').some(r => r.selectors.some(s => s.endsWith('.sd-button')) && r.nodes.some(n => n.prop === 'min-height' && n.value === '44px')), `${label}: phone: buttons are 44px high`)
  ok(inMedia('(max-width: 640px)').some(r => r.selectors.some(s => s.endsWith('.sd-main')) && r.nodes.some(n => n.prop === 'padding-bottom' && n.value === '40px')), `${label}: phone: a shorter page bottom`)
  eq(rule('.sd-main')['flex'], '1', `${label}: the page fills the window, so the footer sits at the bottom`)
  for (const part of ['.sd-main', '.sd-crumbs', '.sd-layout']) { const decls = rule(part); for (const prop of ['width', 'margin', 'padding', 'padding-left', 'padding-right', 'padding-inline']) ok(!(prop in decls), `${label}: ${part} sets no ${prop} (the column is the site header's container)`) }
  ok(rules.some(r => r.selectors.some(s => s.includes('.sd-side-mobile summary')) && r.nodes.some(n => n.prop === 'min-height' && n.value === '44px')), `${label}: the folded list's summary is a 44px target`)
  ok(inMedia('(prefers-reduced-motion: reduce)').some(r => r.nodes.some(n => n.prop === 'transition' && /^none/.test(n.value))), `${label}: reduced motion turns every transition off`)
  nomatch(css, /@keyframes|animation:/, `${label}: nothing animates`)
  // 10. a rule that must win over a utility class on the old pages is at least (0,2,0): the marker plus one class
  for (const r of rules) for (const selector of r.selectors) ok((selector.match(/\[[^\]]+\]|\.[\w-]+|:[\w-]+/g) ?? []).length >= 1, `${label}: ${selector}: not a bare element rule`)
}
proveCss(SOURCES[CSS])

// /help's finishing rules: scoped to the frame's marker, the shell's own tokens, on classes the page already carries
const HELP_SCOPE = '[data-studio-p2-help="true"] [data-studio-help="true"]'
function proveHelpCss(css, label = 'help css') {
  const root = postcss.parse(css)
  const rules = rulesOf(css)
  ok(rules.length === 7, `${label}: seven finishing rules (${rules.length})`)
  const { light, dark } = shellTokens()
  for (const rule of rules) for (const selector of rule.selectors) {
    ok(selector.startsWith(`${HELP_SCOPE} `), `${label}: ${selector}: only under the layout's marker and the Help frame (so only with the flag and the shell on)`)
    nomatch(selector, /^body|\s(html|body)\b|:root|data-studio-p2-docs|data-studio-v4-rail/, `${label}: ${selector}: touches nothing else`)
  }
  const used = new Set(); root.walkDecls(d => { for (const m of d.value.matchAll(/var\((--[\w-]+)/g)) used.add(m[1]) })
  for (const token of used) { ok(token in light, `${label}: ${token} is in the shell's light set`); ok(token in dark, `${label}: ${token} is in the shell's dark set`) }
  root.walkDecls(d => nomatch(d.value, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|gradient\(|!important/, `${label}: ${d.prop}: tokens only`))
  nomatch(css, /!important/, `${label}: no !important`)
  const helpPage = read('app/help/page.tsx') + read('components/help/studio-help.tsx') + read('components/ui/button.tsx')
  const selectorText = rules.flatMap(r => r.selectors).join('\n')
  for (const [, c] of selectorText.matchAll(/\.([a-z][\w-]*)/g)) match(helpPage, new RegExp(`(^|[\\s"'\`{:])${c}($|[\\s"'\`}])`), `${label}: the page carries .${c}`)
  for (const [, name, value] of selectorText.matchAll(/\[(data-studio-help(?:-card|-part)?)(?:="([^"]*)")?\]/g)) ok(name === 'data-studio-help' || helpPage.includes(value ? `${name}="${value}"` : name) || helpPage.includes(name), `${label}: the page carries ${name}${value ? `="${value}"` : ''}`)
  const decl = (selector, prop) => { const rule = rules.find(r => r.selectors.includes(`${HELP_SCOPE} ${selector}`)); ok(rule, `${label}: a rule for ${selector}`); return declsOf(rule)[prop] }
  eq(decl('[data-studio-help-part="header"] > div', 'align-items'), 'center', `${label}: the header's label and link share a centre line`)
  eq(decl('[data-studio-help-part="header"] > div', 'padding'), '0 16px', `${label}: the header keeps 16px off the window's edge`)
  eq(decl('[data-studio-help-card] h4', 'font-size'), '13px', `${label}: a step title is 13px`)
  eq(decl('[data-studio-help-card] h4', 'font-weight'), '500', `${label}: ... weight 500`)
  eq(decl('[data-studio-help-card] :is(p, li, span, a, ul).text-sm', 'font-size'), '12px', `${label}: the agent and tip lines are 12px like the rest`)
  eq(decl('[data-studio-help-card] .border-t > h3', 'font-size'), '13px', `${label}: "Other Ways to Get Help" is 13px`)
  eq(decl('[data-studio-help-card] a.bg-primary', 'background'), 'var(--ss-action)', `${label}: "Start Creating" is the ink action colour (violet stays for AI)`)
  eq(decl('[data-studio-help-card] a.bg-primary', 'color'), 'var(--ss-on-action)', `${label}: ... with the on-action text`)
  eq(decl('[data-studio-help-card] a.bg-primary:hover', 'background'), 'var(--ss-action-hover)', `${label}: ... and its hover`)
  eq(decl('[data-studio-help-card] .text-center.py-8', 'border'), '1px dashed var(--ss-line)', `${label}: an empty search is a framed block`)
  eq(decl('[data-studio-help-card] .text-center.py-8', 'background'), 'var(--ss-surface)', `${label}: ... on the surface colour`)
  for (const [theme, tokens] of [['light', light], ['dark', dark]]) for (const [fg, bg] of [['--ss-on-action', '--ss-action'], ['--ss-muted', '--ss-surface'], ['--ss-text', '--ss-panel']]) {
    const ratio = contrast(tokens[fg], tokens[bg]); ok(ratio >= 4.5, `${label}: ${theme}: ${fg} on ${bg} is at least 4.5:1 (${ratio.toFixed(2)})`)
  }
  root.walkDecls('font-size', d => ok(parseFloat(d.value) >= 10, `${label}: font-size ${d.value} is at least 10px`))
  // each rule outranks the generic rule it must beat (Tailwind's single utility class): at least (0,3,0)
  for (const rule of rules) for (const selector of rule.selectors) ok((selector.match(/\[[^\]]+\]|\.[\w-]+|:[\w-]+/g) ?? []).length >= 3, `${label}: ${selector}: outranks a single utility class`)
}
proveHelpCss(SOURCES[HELP_CSS])

// ---------------------------------------------------------------- 5. env and package
function proveEnv(env, label = 'env') {
  const lines = env.split('\n')
  eq(lines.filter(l => l.startsWith(`${FLAG}=`)).length, 1, `${label}: the flag is declared once`)
  eq(lines.find(l => l.startsWith(`${FLAG}=`)), `${FLAG}="false"`, `${label}: default off`)
  const index = lines.findIndex(l => l.startsWith(`${FLAG}=`))
  match(lines[index - 1], /^# /, `${label}: the flag follows its comment`)
  const block = lines.slice(0, index).reverse().findIndex(l => l.trim() === '')
  const comment = lines.slice(index - block, index).join('\n')
  match(comment, /PASS2 Docs/, `${label}: the comment names the pages`)
  match(comment, /exact "true"/, `${label}: the comment says exact "true"`)
  match(comment, /READ AT BUILD TIME/, `${label}: the comment says build time`)
  match(comment, /NEXT_PUBLIC_STUDIO_V4_SHELL "true"/, `${label}: the comment says /help needs the shell`)
  match(comment, /no mockup/, `${label}: the comment says there is no mockup`)
  match(comment, /No new action/, `${label}: the comment says no new action`)
  for (const route of ['/docs', '/docs/api', '/legal/', '/agents/<agent>', '/help', '/integrations']) ok(comment.includes(route), `${label}: the comment names ${route}`)
  match(comment, /redirects \(next\.config\.mjs\)/, `${label}: the comment says /integrations and /agents are redirects`)
  match(comment, /FRONTEND-1, the public pages \/docs, \/docs\/<category>\/<article>, \/docs\/api, \/legal\/\{privacy,terms,security,cookies\}, \/agents\/<agent> and, in the Studio shell, \/help; there is no mockup/, `${label}: the first line names the pages`)
  // the content pass (same flag, no new one)
  match(comment, /Content pass \(PROGRAM-1, 22 Oct\), same flag/, `${label}: the comment names the content pass and says it is the same flag`)
  match(comment, /names the current eight agents \(Director, Researcher, Analyst, Content Generator, Visualizer, Theme Builder, Slide Composer, Element Generator\)/, `${label}: the comment lists the eight agents`)
  match(comment, /instead of Scripter, Graphic Artist/, `${label}: the comment says which names go`)
  match(comment, /content\/docs\.ts is not edited; content\/studio-p2-docs-agents\.ts swaps the text when the flag is on/, `${label}: the comment says where the swap lives`)
  match(comment, /\/docs\/api says "Not available yet" in a notice under the site header with its content muted, and no footer links to/, `${label}: the comment says what /docs/api shows`)
  match(comment, /neither footer links \/integrations or \/agents, and \/compare drops "Meet the Team"/, `${label}: the comment says which links go`)
  match(comment, /the Landing footer gains Help, Docs, Security and Cookies beside Privacy and Terms/, `${label}: the comment says what the Landing footer gains`)
  match(comment, /The words of the legal pages are not touched\./, `${label}: the comment says the legal words are untouched`)
  nomatch(comment, /exact "true" enables it/, `${label}: the comment does not use the phrase another flag's test pins`)
  eq(lines.filter(l => /^NEXT_PUBLIC_STUDIO_P2_[A-Z_]+="false"$/.test(l) && /DOC/.test(l)).length, 1, `${label}: no second flag for the content pass`)
  ok(lines[index + 1] === '', `${label}: the flag closes its block (a blank line or the end of the file follows; later changes' blocks may come after)`)
  const without = [...lines.slice(0, index - block), ...lines.slice(index + 1)].join('\n')
  ok(sameAsBase(ENV, without, baseSource(ENV)), `${label}: without its block the file is the base commit's .env.example (plus, at most, other changes' comments, blanks and env lines)`)
}
proveEnv(SOURCES[ENV])
function provePackage(pkg, label = 'package') {
  const json = JSON.parse(pkg)
  eq(json.scripts['test:studio-p2-docs'], 'node scripts/test-studio-p2-docs.mjs', `${label}: the test script`)
  const base = JSON.parse(baseSource(PKG))
  ok(!('test:studio-p2-docs' in base.scripts), `${label}: the base does not have the script yet`)
  const without = JSON.parse(pkg)
  delete without.scripts['test:studio-p2-docs']
  ok(sameAsBase(PKG, JSON.stringify(without, null, 2) + '\n', baseSource(PKG)), `${label}: without its script the scripts are the base commit's (plus, at most, other changes' test scripts)`)
  for (const key of Object.keys(base.scripts)) eq(json.scripts[key], base.scripts[key], `${label}: ${key} is unchanged`)
  deepEq({ ...json, scripts: null }, { ...base, scripts: null }, `${label}: nothing but the scripts changed`)
}
provePackage(SOURCES[PKG])

// ---------------------------------------------------------------- 6. mutation check
const MUTANTS = []
const mutant = (file, name, from, to) => MUTANTS.push([file, name, from, to])
// lib: limits and words
mutant(LIB, 'excerpt limit', 'STUDIO_DOCS_EXCERPT_MAX = 150', 'STUDIO_DOCS_EXCERPT_MAX = 160')
for (const [key, value] of Object.entries(WORDS)) mutant(LIB, `word ${key}`, `${key}: '${value.replace(/'/g, "\\'")}'`, `${key}: '${value.replace(/'/g, "\\'")} '`)
mutant(LIB, 'an import added', 'export interface StudioDocItem', "import { cn } from '@/lib/utils'\nexport interface StudioDocItem")
// lib: the result line
mutant(LIB, 'line: always plural', "`${n} ${n === 1 ? 'article' : 'articles'}`", '`${n} articles`')
mutant(LIB, 'line: always singular', "`${n} ${n === 1 ? 'article' : 'articles'}`", '`${n} article`')
mutant(LIB, 'line: categories plural', "${categories === 1 ? 'category' : 'categories'}", '${categories === 1 ? \'categories\' : \'category\'}')
mutant(LIB, 'line: query not trimmed', "typeof query === 'string' ? query.trim() : ''\n  const articles", "typeof query === 'string' ? query : ''\n  const articles")
mutant(LIB, 'line: shown for total', "if (!q) return `${articles(total)} in", "if (!q) return `${articles(shown)} in")
mutant(LIB, 'line: no total in a search', '`${shown} of ${articles(total)} match “${q}”`', '`${shown} of ${total} match “${q}”`')
mutant(LIB, 'line: total for shown in a search', '`${shown} of ${articles(total)} match “${q}”`', '`${total} of ${articles(total)} match “${q}”`')
mutant(LIB, 'line: straight quotes', 'match “${q}”', 'match "${q}"')
mutant(LIB, 'line: a blank query is a search', 'if (!q) return `${articles(total)}', 'if (query === undefined) return `${articles(total)}')
// lib: the filter
mutant(LIB, 'filter: query not lower-cased', "query.trim().toLowerCase() : ''\n  const total", "query.trim() : ''\n  const total")
mutant(LIB, 'filter: query not trimmed', "query.trim().toLowerCase() : ''\n  const total", "query.toLowerCase() : ''\n  const total")
mutant(LIB, 'filter: title and text both needed', '.includes(q) || item.content', '.includes(q) && item.content')
mutant(LIB, 'filter: title not searched', 'item.title.toLowerCase().includes(q) || ', '')
mutant(LIB, 'filter: text not searched', ' || item.content.toLowerCase().includes(q)', '')
mutant(LIB, 'filter: case-sensitive text', 'item.content.toLowerCase().includes(q)', 'item.content.includes(q)')
mutant(LIB, 'filter: case-sensitive title', 'item.title.toLowerCase().includes(q)', 'item.title.includes(q)')
mutant(LIB, 'filter: empty sections kept', '\n    .filter(section => section.items.length > 0)', '')
mutant(LIB, 'filter: the content handed back', 'return { sections: sections.map(section => ({ ...section, items: [...section.items] })), shown: total, total }', 'return { sections: sections as StudioDocSection[], shown: total, total }')
mutant(LIB, 'filter: items shared', '({ ...section, items: [...section.items] })', '({ ...section })')
mutant(LIB, 'filter: shown is the total', 'return { sections: kept, shown: kept.reduce((sum, section) => sum + section.items.length, 0), total }', 'return { sections: kept, shown: total, total }')
mutant(LIB, 'filter: total counts hits', "const total = sections.reduce((sum, section) => sum + section.items.length, 0)", "const total = sections.length")
mutant(LIB, 'filter: a non-text query read', "typeof query === 'string' ? query.trim().toLowerCase() : ''", "typeof query === 'object' ? '' : String(query).trim().toLowerCase()")
// lib: links and the side list
mutant(LIB, 'href: shape', 'return `/docs/${category}/${slug}`', 'return `/docs/${slug}`')
mutant(LIB, 'nav: slug alone marks', 'current: item.category === category && item.slug === slug,', 'current: item.slug === slug,')
mutant(LIB, 'nav: category alone marks', 'current: item.category === category && item.slug === slug,', 'current: item.category === category,')
mutant(LIB, 'nav: never marks', 'current: item.category === category && item.slug === slug,', 'current: false,')
mutant(LIB, 'nav: title lost', '    title: section.title,\n    items:', '    items:')
mutant(LIB, 'nav: id lost', '      id: item.id,\n      title: item.title,\n      href', '      title: item.title,\n      href')
mutant(LIB, 'category: id first', 'if (section) return section.title', 'if (false) return section.title')
mutant(LIB, 'category: not capitalised', 'words.charAt(0).toUpperCase() + words.slice(1)', 'words')
mutant(LIB, 'category: dashes kept', "category.split('-').filter(Boolean).join(' ')", 'category')
// lib: the title split
mutant(LIB, 'split: any level', '/^#\\s+(.+?)\\s*#*\\s*$/.exec(lines[first])', '/^#+\\s+(.+?)\\s*#*\\s*$/.exec(lines[first])')
mutant(LIB, 'split: no space needed', '/^#\\s+(.+?)', '/^#\\s*(.+?)')
mutant(LIB, 'split: closing hashes kept', '(.+?)\\s*#*\\s*$/.exec', '(.+)$/.exec')
mutant(LIB, 'split: the first line only', "lines.findIndex(line => line.trim() !== '')", '0')
mutant(LIB, 'split: title not trimmed', 'title: heading[1].trim(),', 'title: heading[1] + " ",')
mutant(LIB, 'split: body keeps the heading', 'lines.slice(first + 1).join', 'lines.slice(first).join')
mutant(LIB, 'split: body keeps the blank line', ".replace(/^\\s*\\n/, '')", '')
mutant(LIB, 'split: no fallback', 'return { title: fallbackTitle, body: text }', "return { title: '', body: text }")
mutant(LIB, 'split: fallback loses the body', 'return { title: fallbackTitle, body: text }', "return { title: fallbackTitle, body: '' }")
mutant(LIB, 'split: a non-text content read', "typeof content === 'string' ? content : ''", 'String(content ?? "")')
// lib: the card text
mutant(LIB, 'excerpt: no text check', "if (typeof markdown !== 'string') return ''", '')
mutant(LIB, 'excerpt: images kept', ".replace(/!\\[([^\\]]*)\\]\\([^)]*\\)/g, '$1')\n", '\n')
mutant(LIB, 'excerpt: images drop their words', ".replace(/!\\[([^\\]]*)\\]\\([^)]*\\)/g, '$1')", ".replace(/!\\[([^\\]]*)\\]\\([^)]*\\)/g, '')")
mutant(LIB, 'excerpt: links kept', ".replace(/\\[([^\\]]+)\\]\\([^)]*\\)/g, '$1')\n", '\n')
mutant(LIB, 'excerpt: links keep their address', ".replace(/\\[([^\\]]+)\\]\\([^)]*\\)/g, '$1')", ".replace(/\\[([^\\]]+)\\]\\([^)]*\\)/g, '$1 $&')")
mutant(LIB, 'excerpt: code ticks kept', ".replace(/`([^`]*)`/g, '$1')\n", '\n')
mutant(LIB, 'excerpt: bold kept', ".replace(/(\\*\\*|__)(.+?)\\1/g, '$2')\n", '\n')
mutant(LIB, 'excerpt: underscore bold kept', "(\\*\\*|__)(.+?)\\1", '(\\*\\*)(.+?)\\1')
mutant(LIB, 'excerpt: italic kept', ".replace(/(\\*|_)(.+?)\\1/g, '$2')\n", '\n')
mutant(LIB, 'excerpt: quote marker kept', ".replace(/^\\s*>+\\s?/, '')\n", '\n')
mutant(LIB, 'excerpt: list markers kept', ".replace(/^\\s*(?:[-*+]|\\d+\\.)\\s+/, '')\n", '\n')
mutant(LIB, 'excerpt: numbered markers kept', '(?:[-*+]|\\d+\\.)', '(?:[-*+])')
mutant(LIB, 'excerpt: star markers kept', '(?:[-*+]|\\d+\\.)', '(?:[-+]|\\d+\\.)')
mutant(LIB, 'excerpt: fences read', "if (/^(```|~~~)/.test(line)) { fenced = !fenced; blocks.push([]); continue }", '')
mutant(LIB, 'excerpt: tilde fences read', '/^(```|~~~)/', '/^(```)/')
mutant(LIB, 'excerpt: a fence does not end the paragraph', 'fenced = !fenced; blocks.push([]); continue', 'fenced = !fenced; continue')
mutant(LIB, 'excerpt: fenced code kept', '    if (fenced) continue\n', '')
mutant(LIB, 'excerpt: blank lines do not split', "if (line === '' || /^#{1,6}\\s/", "if (/^#{1,6}\\s/")
mutant(LIB, 'excerpt: headings kept', '|| /^#{1,6}\\s/.test(line)', '')
mutant(LIB, 'excerpt: level-1 headings only', '/^#{1,6}\\s/', '/^#\\s/')
mutant(LIB, 'excerpt: tables kept', ' || /^\\|/.test(line)', '')
mutant(LIB, 'excerpt: rules kept', ' || /^(-{3,}|\\*{3,}|_{3,})$/.test(line)', '')
mutant(LIB, 'excerpt: every paragraph', 'const first = blocks.find(block => block.length > 0)', 'const first = blocks.flat().length ? [blocks.flat().join(" ")] : undefined')
mutant(LIB, 'excerpt: the last paragraph', 'const first = blocks.find(block => block.length > 0)', 'const first = [...blocks].reverse().find(block => block.length > 0)')
mutant(LIB, 'excerpt: lines not joined', "first.join(' ')", "first.join('')")
mutant(LIB, 'excerpt: spaces not collapsed', ".replace(/\\s+/g, ' ').trim() : ''", ".trim() : ''")
mutant(LIB, 'excerpt: not trimmed', ".replace(/\\s+/g, ' ').trim() : ''", ".replace(/\\s+/g, ' ') : ''")
mutant(LIB, 'excerpt: cut at the limit exactly', 'if (text.length <= max) return text', 'if (text.length < max) return text')
mutant(LIB, 'excerpt: always cut', 'if (text.length <= max) return text', 'if (false) return text')
mutant(LIB, 'excerpt: cut one short', 'const cut = text.slice(0, max)', 'const cut = text.slice(0, max - 1)')
mutant(LIB, 'excerpt: cut anywhere', 'const head = space > max * 0.6 ? cut.slice(0, space) : cut', 'const head = cut')
mutant(LIB, 'excerpt: always at a word', 'const head = space > max * 0.6 ? cut.slice(0, space) : cut', 'const head = cut.slice(0, space)')
mutant(LIB, 'excerpt: threshold', 'space > max * 0.6', 'space > max * 0.95')
mutant(LIB, 'excerpt: trailing punctuation kept', ".replace(/[\\s,;:.\\-–—]+$/, '')", '')
mutant(LIB, 'excerpt: trailing full stop kept', '[\\s,;:.\\-–—]+$', '[\\s,;:\\-–—]+$')
mutant(LIB, 'excerpt: a dash kept', '[\\s,;:.\\-–—]+$', '[\\s,;:.–—]+$')
mutant(LIB, 'excerpt: no ellipsis', '`${head.replace(/[\\s,;:.\\-–—]+$/, \'\')}…`', 'head.replace(/[\\s,;:.\\-–—]+$/, \'\')')
mutant(LIB, 'excerpt: three dots', '}…`', '}...`')
// lib: link kinds
mutant(LIB, 'kind: anchors', "if (value.startsWith('#')) return 'anchor'", '')
mutant(LIB, 'kind: mail', "if (value.startsWith('mailto:')) return 'mail'", '')
mutant(LIB, 'kind: internal', "if (value.startsWith('/') && !value.startsWith('//')) return 'internal'", '')
mutant(LIB, 'kind: protocol-relative is internal', "value.startsWith('/') && !value.startsWith('//')", "value.startsWith('/')")
mutant(LIB, 'kind: not trimmed', "typeof href === 'string' ? href.trim() : ''\n  if (value.startsWith('#'))", "typeof href === 'string' ? href : ''\n  if (value.startsWith('#'))")
mutant(LIB, 'kind: default is internal', "  return 'external'\n}", "  return 'internal'\n}")
// lib: which docs links land
mutant(LIB, 'lands: query kept', "value.split(/[?#]/)[0]", 'value.split(/#/)[0]')
mutant(LIB, 'lands: hash kept', "value.split(/[?#]/)[0]", 'value.split(/\\?/)[0]')
mutant(LIB, 'lands: other docs links judged too', "if (path !== '/docs' && !path.startsWith('/docs/')) return true", '')
mutant(LIB, 'lands: a prefix is a docs link', "!path.startsWith('/docs/')", "!path.startsWith('/docs')")
mutant(LIB, 'lands: the index', 'if (parts.length === 1 ||', 'if (')
mutant(LIB, 'lands: the api page', "(parts.length === 2 && parts[1] === 'api')", 'false')
mutant(LIB, 'lands: any two-part docs link', "(parts.length === 2 && parts[1] === 'api')", '(parts.length === 2)')
mutant(LIB, 'lands: three parts or more', 'return parts.length === 3 && sections', 'return parts.length >= 3 && sections')
mutant(LIB, 'lands: category not checked', 'section.id === parts[1] && section.items', 'section.items')
mutant(LIB, 'lands: slug not checked', 'item.slug === parts[2]', 'true')
mutant(LIB, 'lands: not trimmed', "typeof href === 'string' ? href.trim() : ''\n  const path", "typeof href === 'string' ? href : ''\n  const path")
// components
mutant(UI, 'ui: not a client component', '"use client"\n\nimport { useState', 'import { useState')
mutant(UI, 'ui: the stylesheet is not loaded', 'import "./studio-p2-docs.css"', '')
mutant(UI, 'ui: a Share button', '<HelpBand\n          title={W.helpTitle}', '<button type="button">Share</button><HelpBand\n          title={W.helpTitle}')
mutant(UI, 'ui: a utility colour', 'className="sd-page"', 'className="sd-page bg-gradient-to-br"')
mutant(UI, 'ui: page marker', 'data-studio-p2-docs-page={kind}', 'data-studio-p2-docs-pg={kind}')
mutant(UI, 'ui: no header', '      <Header />\n      {children}', '      {children}')
mutant(UI, 'ui: no footer', '      {children}\n      <Footer />', '      {children}')
mutant(UI, 'ui: help band unnamed', '<aside className="sd-help" aria-labelledby="sd-help-title">', '<aside className="sd-help">')
mutant(UI, 'ui: help title id', '<h2 id="sd-help-title">', '<h2 id="sd-help-name">')
mutant(UI, 'ui: help center target', '<Link href="/help" className="sd-button sd-button--primary">', '<Link href="/docs" className="sd-button sd-button--primary">')
mutant(UI, 'ui: help center class', 'className="sd-button sd-button--primary">{W.helpCenter}', 'className="sd-button">{W.helpCenter}')
mutant(UI, 'ui: support mail target', 'href={`mailto:${W.supportEmail}`}', 'href="/help"')
mutant(UI, 'ui: support mail word', '>{W.emailSupport}</a>', '>{W.helpCenter}</a>')
mutant(UI, 'ui: the index is not a main', ['<main className="sd-main container mx-auto px-4">', '{W.emailSupport}</a>}\n        />\n      </main>'], ['<div className="sd-main container mx-auto px-4">', '{W.emailSupport}</a>}\n        />\n      </div>'])
mutant(UI, 'ui: the index main class', '<main className="sd-main container mx-auto px-4">', '<main className="sd-page container mx-auto px-4">')
mutant(UI, 'ui: the index column is not the site\'s', '<main className="sd-main container mx-auto px-4">', '<main className="sd-main">')
mutant(UI, 'ui: the crumbs column is not the site\'s', '<nav className="sd-crumbs container mx-auto px-4"', '<nav className="sd-crumbs"')
mutant(UI, 'ui: the article column is not the site\'s', '<div className="sd-layout container mx-auto px-4">', '<div className="sd-layout">')
mutant(UI, 'ui: eyebrow', '<span className="sd-eyebrow">{W.eyebrow}</span>', '')
mutant(UI, 'ui: title', '<h1>{W.title}</h1>', '<h1>{W.eyebrow}</h1>')
mutant(UI, 'ui: lede', '<p>{W.lede}</p>', '')
mutant(UI, 'ui: search type', 'type="search" aria-label', 'type="text" aria-label')
mutant(UI, 'ui: search unnamed', ' aria-label={W.searchLabel}', '')
mutant(UI, 'ui: search placeholder', 'placeholder={W.searchPlaceholder}', 'placeholder=""')
mutant(UI, 'ui: search not controlled', 'value={query} onChange', 'defaultValue={query} onChange')
mutant(UI, 'ui: search does not type', 'onChange={event => setQuery(event.target.value)}', 'onChange={() => undefined}')
mutant(UI, 'ui: the count is silent', '<p className="sd-count" role="status">', '<p className="sd-count">')
mutant(UI, 'ui: the count is the filter\'s', 'studioDocsResultLine(found.shown, found.total, sections.length, query)', 'studioDocsResultLine(found.total, found.total, sections.length, query)')
mutant(UI, 'ui: the count ignores the query', 'studioDocsResultLine(found.shown, found.total, sections.length, query)', 'studioDocsResultLine(found.shown, found.total, sections.length, "")')
mutant(UI, 'ui: the whole list shown while searching', 'const found = studioDocsFilter(sections, query)', 'const found = studioDocsFilter(sections, "")')
mutant(UI, 'ui: section unnamed', ' aria-labelledby={`sd-section-${section.id}`}>', '>')
mutant(UI, 'ui: section title id', '<h2 id={`sd-section-${section.id}`}>', '<h2>')
mutant(UI, 'ui: section class', '<section key={section.id} className="sd-section"', '<section key={section.id} className="sd-sect"')
mutant(UI, 'ui: card address', 'href={studioDocsHref(doc.category, doc.slug)} className="sd-card"', 'href={`/docs/${doc.slug}`} className="sd-card"')
mutant(UI, 'ui: card class', 'className="sd-card">\n                    <span className="sd-card__title">{doc.title}', 'className="sd-card-x">\n                    <span className="sd-card__title">{doc.title}')
mutant(UI, 'ui: card text is the raw start', '{studioDocsExcerpt(doc.content)}', '{doc.content.substring(0, 150)}')
mutant(UI, 'ui: card text too long', '{studioDocsExcerpt(doc.content)}', '{studioDocsExcerpt(doc.content, 400)}')
mutant(UI, 'ui: card title word', '<span className="sd-card__title">{doc.title}<ArrowRight', '<span className="sd-card__title">{doc.slug}<ArrowRight')
mutant(UI, 'ui: arrow announced', '<ArrowRight aria-hidden="true" size={14} /></span>\n                    <span className="sd-card__text">{studioDocsExcerpt(doc.content)}', '<ArrowRight size={14} /></span>\n                    <span className="sd-card__text">{studioDocsExcerpt(doc.content)}')
mutant(UI, 'ui: cards not a list', ['<ul className="sd-cards">\n              {section.items', '</ul>\n          </section>\n        )) : ('], ['<div className="sd-cards">\n              {section.items', '</div>\n          </section>\n        )) : ('])
mutant(UI, 'ui: empty state missing', ') : (\n          <div className="sd-empty" data-studio-p2-docs-state="empty">', ') : false && (\n          <div className="sd-empty" data-studio-p2-docs-state="empty">')
mutant(UI, 'ui: empty title', '<h2>{W.emptyTitle}</h2>', '<h2>{W.notFoundTitle}</h2>')
mutant(UI, 'ui: empty body', '<p>{W.emptyBody}</p>', '')
mutant(UI, 'ui: clear is not a button', '<button type="button" className="sd-button" onClick={() => setQuery("")}>{W.clearSearch}</button>', '<a className="sd-button" onClick={() => setQuery("")}>{W.clearSearch}</a>')
mutant(UI, 'ui: clear does not clear', 'onClick={() => setQuery("")}', 'onClick={() => undefined}')
mutant(UI, 'ui: clear word', '{W.clearSearch}</button>', '{W.helpCenter}</button>')
mutant(UI, 'ui: no help band on the index', "<HelpBand\n          title={W.helpTitle}\n          body={W.helpBody}", "<HelpBand\n          title={W.moreHelpTitle}\n          body={W.helpBody}")
mutant(UI, 'ui: help body on the index', 'body={W.helpBody}', 'body={W.moreHelpBody}')
mutant(UI, 'ui: params array', 'const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ""', 'const pick = (value: string | string[] | undefined) => (value as string) ?? ""')
mutant(UI, 'ui: params null', 'pick(params?.category)', 'pick(params.category)')
mutant(UI, 'ui: category not read', 'studioDocsItem(sections, category, slug)', 'studioDocsItem(sections, "", slug)')
mutant(UI, 'ui: missing article state', 'data-studio-p2-docs-state="not-found"', 'data-studio-p2-docs-state="empty"')
mutant(UI, 'ui: missing article page', '<Page kind="not-found">', '<Page kind="missing">')
mutant(UI, 'ui: missing article title', '<h1>{W.notFoundTitle}</h1>', '<h1>{W.emptyTitle}</h1>')
mutant(UI, 'ui: missing article body', '<p>{W.notFoundBody}</p>', '')
mutant(UI, 'ui: missing article way back', '<Link href="/docs" className="sd-button sd-button--primary">{W.backToDocs}</Link>', '<Link href="/" className="sd-button sd-button--primary">{W.backToDocs}</Link>')
mutant(UI, 'ui: missing article help', '<Link href="/help" className="sd-button">{W.helpCenter}</Link>\n            </div>\n          </div>\n        </main>', '</div>\n          </div>\n        </main>')
mutant(UI, 'ui: missing article column', '<main className="sd-main sd-main--narrow container mx-auto px-4">', '<main className="sd-main container mx-auto px-4">')
mutant(UI, 'ui: missing article is not a main', ['<main className="sd-main sd-main--narrow container mx-auto px-4">', '          </div>\n        </main>\n      </Page>'], ['<div className="sd-main sd-main--narrow container mx-auto px-4">', '          </div>\n        </div>\n      </Page>'])
mutant(UI, 'ui: crumbs unnamed', ' aria-label={W.breadcrumb}>', '>')
mutant(UI, 'ui: crumb home', '<li><Link href="/">{W.home}</Link></li>', '<li><Link href="/docs">{W.home}</Link></li>')
mutant(UI, 'ui: crumb docs', '<li><Link href="/docs">{W.docsLabel}</Link></li>', '<li>{W.docsLabel}</li>')
mutant(UI, 'ui: crumb current', '<li aria-current="page">{doc.title}</li>', '<li>{doc.title}</li>')
mutant(UI, 'ui: crumb title', '<li aria-current="page">{doc.title}</li>', '<li aria-current="page">{title}</li>')
mutant(UI, 'ui: side list unnamed', '<nav className="sd-side" aria-label={W.navLabel}>', '<nav className="sd-side">')
mutant(UI, 'ui: side list from the static navigation', 'const nav = studioDocsNav(sections, doc.category, doc.slug)', 'const nav = studioDocsNav(sections, "", "")')
mutant(UI, 'ui: side list marks nothing', 'aria-current={item.current ? "page" : undefined}', 'aria-current={undefined}')
mutant(UI, 'ui: side list marks all', 'aria-current={item.current ? "page" : undefined}', 'aria-current="page"')
mutant(UI, 'ui: side list title class', '<p className="sd-side__title">', '<p>')
mutant(UI, 'ui: no phone list', ['<details className="sd-side-mobile">', '          </details>'], ['<div className="sd-side-mobile">', '          </div>'])
mutant(UI, 'ui: phone list summary', '<summary>{W.navSummary}</summary>', '<summary>{W.related}</summary>')
mutant(UI, 'ui: phone list unnamed', '<nav aria-label={W.navLabel}><NavList nav={nav} /></nav>\n          </details>', '<nav><NavList nav={nav} /></nav>\n          </details>')
mutant(UI, 'ui: article is not a main', ['<main className="sd-article">', '        </main>\n      </div>\n    </Page>'], ['<div className="sd-article">', '        </div>\n      </div>\n    </Page>'])
mutant(UI, 'ui: article eyebrow', '{studioDocsCategoryTitle(sections, doc.category)}', '{doc.category}')
mutant(UI, 'ui: article title is the listing\'s', '<h1>{title}</h1>', '<h1>{doc.title}</h1>')
mutant(UI, 'ui: article title twice', '<div className="sd-prose">', '<h1>{title}</h1><div className="sd-prose">')
mutant(UI, 'ui: article body keeps its heading', '              {body}\n', '              {doc.content}\n')
mutant(UI, 'ui: tables', 'remarkPlugins={[remarkGfm]}', 'remarkPlugins={[]}')
mutant(UI, 'ui: second h1', 'h1: ({ children }) => <h2>{children}</h2>,', '')
mutant(UI, 'ui: table wrapper', '<div className="sd-table"><table>{children}</table></div>', '<table>{children}</table>')
mutant(UI, 'ui: table wrapper class', 'className="sd-table"', 'className="sd-tbl"')
mutant(UI, 'ui: internal links', 'if (kind === "internal") {', 'if (kind === "never") {')
mutant(UI, 'ui: dead links kept', 'return studioDocsLinkLands(href, sections)\n                      ?', 'return true\n                      ?')
mutant(UI, 'ui: dead links vanish', ': <span data-studio-p2-docs-dead-link="true">{children}</span>', ': null')
mutant(UI, 'ui: dead link marker', 'data-studio-p2-docs-dead-link="true"', 'data-studio-p2-docs-dead="true"')
mutant(UI, 'ui: outside links stay', 'if (kind === "external") return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>', 'if (kind === "external") return <a href={href}>{children}</a>')
mutant(UI, 'ui: outside links unsafe', 'rel="noopener noreferrer"', 'rel="noreferrer"')
mutant(UI, 'ui: mail links open a tab', 'return <a href={href}>{children}</a>\n                },', 'return <a href={href} target="_blank">{children}</a>\n                },')
mutant(UI, 'ui: related cut short', 'const related = studioDocsRelated(sections, doc)', 'const related = studioDocsRelated(sections, doc).slice(0, 1)')
mutant(UI, 'ui: related unnamed', '<section className="sd-section" aria-labelledby="sd-related-title">', '<section className="sd-section">')
mutant(UI, 'ui: related title', '<h2 id="sd-related-title">{W.related}</h2>', '<h2 id="sd-related-title">{W.browseAll}</h2>')
mutant(UI, 'ui: related cards wide', '<ul className="sd-cards sd-cards--three">', '<ul className="sd-cards">')
mutant(UI, 'ui: related text long', '{studioDocsExcerpt(item.content, 100)}', '{studioDocsExcerpt(item.content, 400)}')
mutant(UI, 'ui: related address', 'href={studioDocsHref(item.category, item.slug)} className="sd-card"', 'href={studioDocsHref(doc.category, doc.slug)} className="sd-card"')
mutant(UI, 'ui: article help title', 'title={W.moreHelpTitle}\n            body={W.moreHelpBody}', 'title={W.helpTitle}\n            body={W.moreHelpBody}')
mutant(UI, 'ui: article help second way', '<Link href="/docs" className="sd-button">{W.browseAll}</Link>', '<Link href="/help" className="sd-button">{W.browseAll}</Link>')
mutant(UI, 'ui: article page marker', '<Page kind="article">', '<Page kind="doc">')
// frame
mutant(FRAME, 'frame: marker', 'data-studio-p2-docs={area}', 'data-studio-docs={area}')
mutant(FRAME, 'frame: area', 'data-studio-p2-docs={area}', 'data-studio-p2-docs="docs"')
mutant(FRAME, 'frame: an extra element', '<div data-studio-p2-docs={area}>{children}</div>', '<div data-studio-p2-docs={area}><div>{children}</div></div>')
mutant(FRAME, 'frame: stylesheet', 'import "./studio-p2-docs.css"', '')
mutant(FRAME, 'frame: a client component', 'import type { ReactNode }', '"use client"\nimport type { ReactNode }')
// the pages
for (const page of PAGES) {
  mutant(page.file, `${page.name}: flag spelling`, "=== 'true';", "!== 'false';")
  mutant(page.file, `${page.name}: flag name`, 'process.env.NEXT_PUBLIC_STUDIO_P2_DOCS', 'process.env.NEXT_PUBLIC_STUDIO_DOCS')
  mutant(page.file, `${page.name}: wrapper picks the old page`, `STUDIO_P2_DOCS ? <${page.component} /> : <${page.legacy} />`, `STUDIO_P2_DOCS ? <${page.legacy} /> : <${page.component} />`)
  mutant(page.file, `${page.name}: always the new page`, `STUDIO_P2_DOCS ? <${page.component} /> : <${page.legacy} />`, `<${page.component} />`)
  mutant(page.file, `${page.name}: the old page changed`, page.touch, `${page.touch} void 0;`)
  mutant(page.file, `${page.name}: not a client page`, "'use client';", '')
  mutant(page.file, `${page.name}: import dropped`, `import { ${page.component} } from '@/components/studio-docs/studio-p2-docs';\n`, `import { ${page.component} } from '@/components/studio-docs/studio-p2-docs-x';\n`)
}
// the layouts
for (const [file, area] of LAYOUTS) {
  mutant(file, `${area} layout: flag spelling`, "=== 'true') return", "!== 'false') return")
  mutant(file, `${area} layout: flag name`, 'if (process.env.NEXT_PUBLIC_STUDIO_P2_DOCS', 'if (process.env.NEXT_PUBLIC_STUDIO_DOCS')
  mutant(file, `${area} layout: area`, `area="${area}"`, `area="${area === 'docs' ? 'legal' : 'docs'}"`)
  mutant(file, `${area} layout: the page dropped`, '{children}</StudioDocsFrame>', '</StudioDocsFrame>')
  mutant(file, `${area} layout: off wraps too`, "  return children;\n", "  return <StudioDocsFrame area=\"docs\">{children}</StudioDocsFrame>;\n")
  mutant(file, `${area} layout: metadata`, 'export default function', "export const metadata = { title: 'x' };\nexport default function")
  mutant(file, `${area} layout: a client layout`, "import type { ReactNode } from 'react';", "'use client';\nimport type { ReactNode } from 'react';")
}
// env and package
mutant(ENV, 'env: default on', `${FLAG}="false"`, `${FLAG}="true"`)
mutant(ENV, 'env: renamed', `${FLAG}="false"`, 'NEXT_PUBLIC_STUDIO_P2_DOC="false"')
mutant(ENV, 'env: declared twice', `${FLAG}="false"\n`, `${FLAG}="false"\n${FLAG}="false"\n`)
mutant(ENV, 'env: build time unsaid', 'as before. READ AT BUILD TIME: set it on Vercel, then redeploy. The public', 'as before. READ AT RUN TIME: set it on Vercel, then redeploy. The public')
mutant(ENV, 'env: exact true unsaid', 'of them): exact "true" turns it on', 'of them): any value turns it on')
mutant(ENV, 'env: shell unsaid', 'is already inside the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL "true")', 'is already inside the Studio shell (the shell flag)')
mutant(ENV, 'env: no mockup unsaid', 'there is no mockup for any', 'there is a mockup for any')
mutant(ENV, 'env: new action unsaid', 'No new action.', 'One new action.')
mutant(ENV, 'env: redirects unsaid', 'are redirects (next.config.mjs)', 'are pages')
mutant(ENV, 'env: a route missing', '/docs/api, /legal/', '/docs/apx, /legal/')
mutant(ENV, 'env: the agents route missing', '/agents/<agent>', '/agents/x')
mutant(ENV, 'env: the base changed', 'NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN="false"', 'NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN="true"')
mutant(PKG, 'package: script missing', '    "test:studio-p2-docs": "node scripts/test-studio-p2-docs.mjs",\n', '')
mutant(PKG, 'package: script target', 'node scripts/test-studio-p2-docs.mjs', 'node scripts/test-studio-p2-doc.mjs')
mutant(PKG, 'package: another script changed', '"test:studio-p2-landing": "node scripts/test-studio-p2-landing.mjs"', '"test:studio-p2-landing": "node scripts/test-studio-p2-landing.mjs --x"')
mutant(PKG, 'package: another script added', '"test:studio-p2-docs": "node scripts/test-studio-p2-docs.mjs",', '"test:studio-p2-docs": "node scripts/test-studio-p2-docs.mjs",\n    "test:studio-p2-extra": "node scripts/x.mjs",')

// CSS: the tokens (every one, light and dark), the scope, the type and size facts, the rings, the media blocks, the old pages' classes
for (const [name, light, dark] of [['frame', '#e8f0ed', '#1a2624'], ['panel', '#ffffff', '#1b2426'], ['surface', '#f5f7f6', '#141c1e'], ['soft', '#edf2f0', '#243034'], ['line', '#dde5e2', '#334245'], ['text', '#243438', '#e2ebe8'], ['muted', '#566965', '#a0b1ad'], ['accent', '#6a4fc0', '#b4a0f2'], ['accent-soft', '#f1edfb', '#2a2540'], ['action', '#223a3f', '#3d5c63'], ['teal', '#1f6f72', '#83c4bd']]) {
  mutant(CSS, `token ${name} (light)`, `--sd-${name}: ${light};`, `--sd-${name}: #010203;`)
  mutant(CSS, `token ${name} (dark)`, `--sd-${name}: ${dark};`, `--sd-${name}: #010203;`)
}
mutant(CSS, 'token active (light)', '--sd-active: #e8f2f0;', '--sd-active: #e8f2f1;')
mutant(CSS, 'token active (dark)', '--sd-active: #1d3634;', '--sd-active: #1d3635;')
mutant(CSS, 'token on-action (light)', '--sd-on-action: #ffffff; --sd-active: #e8f2f0', '--sd-on-action: #fffffe; --sd-active: #e8f2f0')
mutant(CSS, 'token on-action (dark)', '--sd-on-action: #ffffff; --sd-active: #1d3634', '--sd-on-action: #fffffe; --sd-active: #1d3634')
mutant(CSS, 'a token dropped (dark)', ' --sd-teal: #83c4bd;\n}', '\n}')
mutant(CSS, 'a token added (dark)', ' --sd-teal: #83c4bd;\n}', ' --sd-teal: #83c4bd; --sd-extra: #123456;\n}')
mutant(CSS, 'a token added (light)', '--sd-teal: #1f6f72;\n  background', '--sd-teal: #1f6f72; --sd-extra: #123456;\n  background')
mutant(CSS, 'frame background', '  background: var(--sd-frame); color: var(--sd-text);\n}\n.dark', '  background: var(--sd-panel); color: var(--sd-text);\n}\n.dark')
mutant(CSS, 'frame text', '  background: var(--sd-frame); color: var(--sd-text);\n}\n.dark', '  background: var(--sd-frame); color: var(--sd-muted);\n}\n.dark')
mutant(CSS, 'dark not under .dark', '.dark [data-studio-p2-docs] {', '[data-studio-dark] [data-studio-p2-docs] {')
mutant(CSS, 'a rule leaks to the body', '[data-studio-p2-docs] .sd-page {', 'body .sd-page {')
mutant(CSS, 'a rule leaks to every page', '[data-studio-p2-docs] .sd-eyebrow {', '.sd-eyebrow {')
mutant(CSS, 'a rule leaks to the shell', '[data-studio-p2-docs] .sd-hero { padding: 32px 0 8px; }', '[data-studio-v4-shell="true"] .sd-hero { padding: 32px 0 8px; }')
mutant(CSS, 'a literal colour', '.sd-card:hover { border-color: var(--sd-teal);', '.sd-card:hover { border-color: #1f6f72;')
mutant(CSS, 'a literal rgb', '.sd-search input::placeholder { color: var(--sd-muted);', '.sd-search input::placeholder { color: rgb(1, 2, 3);')
mutant(CSS, 'a gradient', '.sd-help { margin-top: 40px;', '.sd-help { background-image: linear-gradient(red, blue); margin-top: 40px;')
mutant(CSS, 'an undeclared token', '.sd-help h2 { margin: 0; color: var(--sd-text);', '.sd-help h2 { margin: 0; color: var(--sd-nope);')
mutant(CSS, 'important outside reduced motion', '.sd-button--primary:hover { background:', '.sd-button--primary:hover { color: var(--sd-text) !important; background:')
mutant(CSS, 'low contrast (light muted)', '--sd-muted: #566965;', '--sd-muted: #9aa9a5;')
mutant(CSS, 'low contrast (dark muted)', '--sd-muted: #a0b1ad;', '--sd-muted: #4a5a56;')
mutant(CSS, 'low contrast (light accent)', '--sd-accent: #6a4fc0;', '--sd-accent: #a99de0;')
mutant(CSS, 'low contrast (light teal)', '--sd-teal: #1f6f72;', '--sd-teal: #6fb0b3;')
mutant(CSS, 'a class the components do not carry', '[data-studio-p2-docs] .sd-card__text {', '[data-studio-p2-docs] .sd-card__body {')
mutant(CSS, 'a rule for a class nobody carries', '[data-studio-p2-docs] .sd-section { margin-top: 30px; }', '[data-studio-p2-docs] .sd-section { margin-top: 30px; }\n[data-studio-p2-docs] .sd-ghost { margin: 0; }')
mutant(CSS, 'eyebrow size', '.sd-eyebrow { display: block; color: var(--sd-accent); font-size: 10px;', '.sd-eyebrow { display: block; color: var(--sd-accent); font-size: 9px;')
mutant(CSS, 'eyebrow case', 'font-weight: 600; text-transform: uppercase; letter-spacing: .07em; }\n[data-studio-p2-docs] .sd-hero h1', 'font-weight: 600; text-transform: none; letter-spacing: .07em; }\n[data-studio-p2-docs] .sd-hero h1')
mutant(CSS, 'eyebrow colour', '.sd-eyebrow { display: block; color: var(--sd-accent);', '.sd-eyebrow { display: block; color: var(--sd-muted);')
mutant(CSS, 'title size', '.sd-empty h1 { margin: 9px 0; color: var(--sd-text); font-size: clamp(23px, 3vw, 31px);', '.sd-empty h1 { margin: 9px 0; color: var(--sd-text); font-size: clamp(24px, 3vw, 32px);')
mutant(CSS, 'old pages: title size', 'section.bg-gradient-to-br h1 { margin: 9px 0; color: var(--sd-text); font-size: clamp(23px, 3vw, 31px);', 'section.bg-gradient-to-br h1 { margin: 9px 0; color: var(--sd-text); font-size: clamp(30px, 3vw, 40px);')
mutant(CSS, 'old pages: title weight', 'section.bg-gradient-to-br h1 { margin: 9px 0; color: var(--sd-text); font-size: clamp(23px, 3vw, 31px); line-height: 1.2; font-weight: 500;', 'section.bg-gradient-to-br h1 { margin: 9px 0; color: var(--sd-text); font-size: clamp(23px, 3vw, 31px); line-height: 1.2; font-weight: 700;')
mutant(CSS, 'title weight', '.sd-empty h1 { margin: 9px 0; color: var(--sd-text); font-size: clamp(23px, 3vw, 31px); line-height: 1.2; font-weight: 500;', '.sd-empty h1 { margin: 9px 0; color: var(--sd-text); font-size: clamp(23px, 3vw, 31px); line-height: 1.2; font-weight: 700;')
mutant(CSS, 'lede size', '.sd-hero p { max-width: 650px; margin: 0; color: var(--sd-muted); font-size: 13px;', '.sd-hero p { max-width: 650px; margin: 0; color: var(--sd-muted); font-size: 14px;')
mutant(CSS, 'search height', 'width: 100%; height: 40px; padding: 0 12px 0 36px;', 'width: 100%; height: 36px; padding: 0 12px 0 36px;')
mutant(CSS, 'section title size', 'color: var(--sd-text); font-size: 17px; line-height: 1.4; font-weight: 600; letter-spacing: -.01em; }\n[data-studio-p2-docs] .sd-cards {', 'color: var(--sd-text); font-size: 18px; line-height: 1.4; font-weight: 600; letter-spacing: -.01em; }\n[data-studio-p2-docs] .sd-cards {')
mutant(CSS, 'section title weight', 'font-size: 17px; line-height: 1.4; font-weight: 600; letter-spacing: -.01em; }\n[data-studio-p2-docs] .sd-cards {', 'font-size: 17px; line-height: 1.4; font-weight: 500; letter-spacing: -.01em; }\n[data-studio-p2-docs] .sd-cards {')
mutant(CSS, 'card background', 'padding: 14px 16px; border: 1px solid var(--sd-line); border-radius: 10px; background: var(--sd-panel);', 'padding: 14px 16px; border: 1px solid var(--sd-line); border-radius: 10px; background: var(--sd-surface);')
mutant(CSS, 'card corners', 'padding: 14px 16px; border: 1px solid var(--sd-line); border-radius: 10px;', 'padding: 14px 16px; border: 1px solid var(--sd-line); border-radius: 6px;')
mutant(CSS, 'card title size', '.sd-card__title { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px;', '.sd-card__title { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 14px;')
mutant(CSS, 'card text size', 'overflow: hidden; color: var(--sd-muted); font-size: 12px; line-height: 1.65;', 'overflow: hidden; color: var(--sd-muted); font-size: 13px; line-height: 1.65;')
mutant(CSS, 'card hover', '.sd-card:hover { border-color', '.sd-card:active { border-color')
mutant(CSS, 'button hover', '.sd-button:hover { background: var(--sd-surface); }', '.sd-button:active { background: var(--sd-surface); }')
mutant(CSS, 'button height', 'box-sizing: border-box; min-height: 36px; padding: 0 14px;', 'box-sizing: border-box; min-height: 32px; padding: 0 14px;')
mutant(CSS, 'primary button fill', '.sd-button--primary { border-color: var(--sd-action); background: var(--sd-action); color: var(--sd-on-action); }', '.sd-button--primary { border-color: var(--sd-action); background: var(--sd-accent); color: var(--sd-on-action); }')
mutant(CSS, 'primary button text', '.sd-button--primary { border-color: var(--sd-action); background: var(--sd-action); color: var(--sd-on-action); }', '.sd-button--primary { border-color: var(--sd-action); background: var(--sd-action); color: var(--sd-text); }')
mutant(CSS, 'help band corners', '.sd-help { margin-top: 40px; padding: 20px; border: 1px solid var(--sd-line); border-radius: 12px;', '.sd-help { margin-top: 40px; padding: 20px; border: 1px solid var(--sd-line); border-radius: 8px;')
mutant(CSS, 'article column', '.sd-article { min-width: 0; max-width: 760px;', '.sd-article { min-width: 0; max-width: 900px;')
mutant(CSS, 'side list width', 'grid-template-columns: 220px minmax(0, 1fr); gap: 36px;', 'grid-template-columns: 260px minmax(0, 1fr); gap: 36px;')
mutant(CSS, 'page does not fill', '.sd-main { box-sizing: border-box; flex: 1;', '.sd-main { box-sizing: border-box; flex: none;')
mutant(CSS, 'page sets its own width', '.sd-main { box-sizing: border-box; flex: 1;', '.sd-main { box-sizing: border-box; width: 1080px; flex: 1;')
mutant(CSS, 'crumbs set their own padding', '.sd-crumbs { box-sizing: border-box; padding-top: 16px; }', '.sd-crumbs { box-sizing: border-box; padding: 16px 24px 0; }')
mutant(CSS, 'layout sets its own margin', 'gap: 36px; box-sizing: border-box; padding-top: 8px;', 'gap: 36px; box-sizing: border-box; margin: 0 auto; padding-top: 8px;')
mutant(CSS, 'prose size', '.sd-prose { color: var(--sd-text); font-size: 14px; line-height: 1.8;', '.sd-prose { color: var(--sd-text); font-size: 15px; line-height: 1.8;')
mutant(CSS, 'prose leading', '.sd-prose { color: var(--sd-text); font-size: 14px; line-height: 1.8;', '.sd-prose { color: var(--sd-text); font-size: 14px; line-height: 1.5;')
mutant(CSS, 'ring: card', '.sd-card:focus-visible { outline: 2px solid var(--sd-accent);', '.sd-card:focus-visible { outline: 1px solid var(--sd-accent);')
mutant(CSS, 'ring: button', '.sd-button:focus-visible { outline: 2px solid var(--sd-accent);', '.sd-button:focus-visible { outline: none;')
mutant(CSS, 'ring: search', '.sd-search input:focus-visible { outline: 2px solid var(--sd-accent);', '.sd-search input:focus-visible { outline: 2px solid var(--sd-teal);')
mutant(CSS, 'ring: crumbs', '.sd-crumbs a:focus-visible { outline: 2px solid var(--sd-accent);', '.sd-crumbs a:focus-visible { outline: 0 solid var(--sd-accent);')
mutant(CSS, 'ring: side list', '.sd-side a:focus-visible, [data-studio-p2-docs] .sd-side-mobile a:focus-visible { outline: 2px solid var(--sd-accent);', '.sd-side a:focus-visible, [data-studio-p2-docs] .sd-side-mobile a:focus-visible { outline: 3px solid var(--sd-accent);')
mutant(CSS, 'ring: prose links', '.sd-prose a:focus-visible { outline: 2px solid var(--sd-accent);', '.sd-prose a:focus-visible { outline: 2px solid var(--sd-text);')
mutant(CSS, 'ring: folded list', '.sd-side-mobile summary:focus-visible { outline: 2px solid var(--sd-accent);', '.sd-side-mobile summary:focus-visible { outline: 2px dashed var(--sd-accent);')
mutant(CSS, 'hover: side list', '.sd-side a:hover, [data-studio-p2-docs] .sd-side-mobile a:hover {', '.sd-side a:active, [data-studio-p2-docs] .sd-side-mobile a:active {')
mutant(CSS, 'hover: crumbs', '.sd-crumbs a:hover { color', '.sd-crumbs a:active { color')
mutant(CSS, 'open article unmarked', 'a[aria-current="page"], [data-studio-p2-docs] .sd-side-mobile a[aria-current="page"] { background: var(--sd-active);', 'a[aria-current="page"], [data-studio-p2-docs] .sd-side-mobile a[aria-current="page"] { background: var(--sd-soft);')
mutant(CSS, 'media: 1024 renamed', '@media (max-width: 1023px) {', '@media (max-width: 900px) {')
mutant(CSS, 'media: side column stays', '  [data-studio-p2-docs] .sd-side { display: none; }', '  [data-studio-p2-docs] .sd-side { display: block; }')
mutant(CSS, 'media: folded list stays hidden', '  [data-studio-p2-docs] .sd-side-mobile { display: block; }', '  [data-studio-p2-docs] .sd-side-mobile { display: none; }')
mutant(CSS, 'folded list always shown', '[data-studio-p2-docs] .sd-side-mobile { display: none; margin-bottom: 16px;', '[data-studio-p2-docs] .sd-side-mobile { display: block; margin-bottom: 16px;')
mutant(CSS, 'media: article stays two columns', '  [data-studio-p2-docs] .sd-layout { grid-template-columns: minmax(0, 1fr); gap: 0; }', '  [data-studio-p2-docs] .sd-layout { gap: 0; }')
mutant(CSS, 'media: cards do not stack', '  [data-studio-p2-docs] .sd-cards, [data-studio-p2-docs] .sd-cards--three { grid-template-columns: minmax(0, 1fr); }', '  [data-studio-p2-docs] .sd-cards { grid-template-columns: minmax(0, 1fr); }')
mutant(CSS, 'media: 760 renamed', '@media (max-width: 760px) {', '@media (max-width: 700px) {')
mutant(CSS, 'media: 640 renamed', '@media (max-width: 640px) {', '@media (max-width: 600px) {')
mutant(CSS, 'phone: buttons', '  [data-studio-p2-docs] .sd-button { min-height: 44px; }', '  [data-studio-p2-docs] .sd-button { min-height: 40px; }')
mutant(CSS, 'phone: page bottom', '  [data-studio-p2-docs] .sd-main { padding-top: 4px; padding-bottom: 40px; }', '  [data-studio-p2-docs] .sd-main { padding-top: 4px; padding-bottom: 56px; }')
mutant(CSS, 'folded list target', '.sd-side-mobile summary { display: flex; align-items: center; min-height: 44px;', '.sd-side-mobile summary { display: flex; align-items: center; min-height: 36px;')
mutant(CSS, 'motion: reduced block', '@media (prefers-reduced-motion: reduce) {\n  [data-studio-p2-docs] * { transition: none !important; }', '@media (prefers-reduced-motion: no-preference) {\n  [data-studio-p2-docs] * { transition: none !important; }')
mutant(CSS, 'motion: transitions stay', '[data-studio-p2-docs] * { transition: none !important; }', '[data-studio-p2-docs] * { transition-duration: 0s !important; }')
mutant(CSS, 'motion: an animation', '[data-studio-p2-docs] .sd-section { margin-top: 30px; }', '[data-studio-p2-docs] .sd-section { margin-top: 30px; animation: sd-fade 1s; }')
mutant(CSS, 'old pages: page header class', '[data-studio-p2-docs] section.bg-gradient-to-br { padding', '[data-studio-p2-docs] section.bg-gradient-to-bx { padding')
mutant(CSS, 'old pages: prose class', 'section.bg-background .prose { max-width: 760px;', 'section.bg-background .proze { max-width: 760px;')
mutant(CSS, 'old pages: radial overlay class', '[class*="radial-gradient"] { display: none; }', '[class*="radial-gradiant"] { display: none; }')
mutant(CSS, 'old pages: tile class', '[class*="bg-gradient-to-"]:not(.-z-10) { background-image: none;', '[class*="bg-gradient-two-"]:not(.-z-10) { background-image: none;')
mutant(CSS, 'old pages: the card class', '[data-studio-p2-docs="agents"] .bg-card {', '[data-studio-p2-docs="agents"] .bg-cards {')
mutant(CSS, 'old pages: a data attribute', 'section[data-snap="slide"] h1 {', 'section[data-snap="slides"] h1 {')
mutant(CSS, 'old pages: the wordmark', 'img[alt="Deckster"] {', 'img[alt="Decksters"] {')
mutant(CSS, 'old pages: the line is not told from the tiles', '[class*="bg-gradient-to-b "]:not(.-z-10)', '[class*="bg-gradient-to-b"]:not(.-z-10)')
mutant(CSS, 'old pages: the header strip colours', '[data-studio-p2-docs] section.bg-gradient-to-br { padding: 40px 0 20px; background: var(--sd-frame);', '[data-studio-p2-docs] section.bg-gradient-to-br { padding: 40px 0 20px; background: var(--sd-panel);')
mutant(CSS, 'old pages: a gradient stays', 'section.bg-gradient-to-br { padding: 40px 0 20px; background: var(--sd-frame); border-bottom: 0; }', 'section.bg-gradient-to-br { padding: 40px 0 20px; background-image: linear-gradient(var(--sd-frame), var(--sd-panel)); border-bottom: 0; }')
// the tabs
for (const [file, name] of TITLE_FIXES) {
  mutant(file, `${name} tab: suffix kept with the flag on`, `'${name}' : '${name} | Deckster'`, `'${name} | Deckster' : '${name} | Deckster'`)
  mutant(file, `${name} tab: suffix lost with the flag off`, `'${name}' : '${name} | Deckster'`, `'${name}' : '${name}'`)
  mutant(file, `${name} tab: flag spelling`, "=== 'true' ?", "!== 'false' ?")
  mutant(file, `${name} tab: flag name`, 'NEXT_PUBLIC_STUDIO_P2_DOCS === ', 'NEXT_PUBLIC_STUDIO_DOCS === ')
  mutant(file, `${name} tab: description lost`, '    description:', '    descr:')
}
for (const [file, name] of NEW_TITLES) {
  mutant(file, `${name} tab: flag spelling`, "=== 'true' ?", "!== 'false' ?")
  mutant(file, `${name} tab: flag name`, 'process.env.NEXT_PUBLIC_STUDIO_P2_DOCS', 'process.env.NEXT_PUBLIC_STUDIO_DOCS')
  mutant(file, `${name} tab: the name`, `{ title: '${name}' }`, `{ title: '${name} | Deckster' }`)
  mutant(file, `${name} tab: always set`, `=== 'true' ? { title: '${name}' } : {}`, `=== 'true' ? { title: '${name}' } : { title: '${name}' }`)
  mutant(file, `${name} tab: page dropped`, '  return children;', '  return null;')
  mutant(file, `${name} tab: a client layout`, "import type { Metadata } from 'next';", "'use client';\nimport type { Metadata } from 'next';")
}
mutant(LAYOUT_DOCS, 'docs tab: flag name', 'export const metadata: Metadata = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS', 'export const metadata: Metadata = process.env.NEXT_PUBLIC_STUDIO_DOCS')
mutant(LAYOUT_DOCS, 'docs tab: title', "default: 'Documentation | Deckster'", "default: 'Docs | Deckster'")
mutant(LAYOUT_DOCS, 'docs tab: template', "template: '%s | Deckster'", "template: '%s'")
mutant(LAYOUT_DOCS, 'docs tab: plain string title (drops the template for the pages below)', "{ title: { default: 'Documentation | Deckster', template: '%s | Deckster' },", "{ title: 'Documentation',")
mutant(LAYOUT_DOCS, 'docs tab: description', 'Guides and answers for turning your ideas into finished slides', 'Guides and answers')
mutant(LAYOUT_DOCS, 'docs tab: always set', "description: 'Guides and answers for turning your ideas into finished slides' } : {};", "description: 'Guides and answers for turning your ideas into finished slides' } : { title: 'Documentation' };")
mutant(LAYOUT_DOCS, 'docs tab: flag spelling', "export const metadata: Metadata = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true'", "export const metadata: Metadata = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS !== 'false'")
mutant(META_ARTICLE, 'article tab: flag spelling', "!== 'true') return {}", "=== 'false') return {}")
mutant(META_ARTICLE, 'article tab: the listing title', 'title: doc ? doc.title :', 'title: doc ? doc.slug :')
mutant(META_ARTICLE, 'article tab: unknown', "'Article not found'", "'Not found'")
mutant(META_ARTICLE, 'article tab: category ignored', 'getDocBySlug(category, slug)', 'getDocBySlug("", slug)')
mutant(META_ARTICLE, 'article tab: page dropped', '  return children;', '  return null;')
mutant(META_ARTICLE, 'article tab: params not awaited', 'const { category, slug } = await params;', 'const { category, slug } = params as unknown as { category: string; slug: string };')
mutant(META_AGENT, 'agent tab: flag spelling', "!== 'true') return {}", "=== 'false') return {}")
mutant(META_AGENT, 'agent tab: the name', 'title: agent ? agent.name :', 'title: agent ? agent.slug :')
mutant(META_AGENT, 'agent tab: unknown', "'Agent not found'", "'Not found'")
mutant(META_AGENT, 'agent tab: page dropped', '  return children;', '  return null;')
mutant(META_AGENT, 'agent tab: slug ignored', 'getAgentBySlug(slug)', 'getAgentBySlug("director")')

// /help

mutant(HELP_TEMPLATE, 'help template: flag spelling', "process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL", "process.env.NEXT_PUBLIC_STUDIO_P2_DOCS !== 'false' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL")
mutant(HELP_TEMPLATE, 'help template: flag name', "const STUDIO_P2_HELP = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS", "const STUDIO_P2_HELP = process.env.NEXT_PUBLIC_STUDIO_DOCS")
mutant(HELP_TEMPLATE, 'help template: the shell is not needed', " && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true';", ';')
mutant(HELP_TEMPLATE, 'help template: the shell spelling', "NEXT_PUBLIC_STUDIO_V4_SHELL === 'true';", "NEXT_PUBLIC_STUDIO_V4_SHELL !== 'false';")
mutant(HELP_TEMPLATE, 'help template: the flag is not needed', "process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true';", "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true';")
mutant(HELP_TEMPLATE, 'help template: either is enough', "process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true';", "process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' || process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true';")
mutant(HELP_TEMPLATE, 'help template: marker name', 'data-studio-p2-help="true"', 'data-studio-p2-hlp="true"')
mutant(HELP_TEMPLATE, 'help template: marker value', 'data-studio-p2-help="true"', 'data-studio-p2-help="on"')
mutant(HELP_TEMPLATE, 'help template: the wrapper has a box', "style={{ display: 'contents' }}", "style={{ display: 'block' }}")
mutant(HELP_TEMPLATE, 'help template: the wrapper has no style', " style={{ display: 'contents' }}", '')
mutant(HELP_TEMPLATE, 'help template: the page dropped', "{children}</div>;", "</div>;")
mutant(HELP_TEMPLATE, 'help template: always wrapped', 'if (STUDIO_P2_HELP) return', 'if (true) return')
mutant(HELP_TEMPLATE, 'help template: never wrapped', 'if (STUDIO_P2_HELP) return', 'if (false) return')
mutant(HELP_TEMPLATE, 'help template: the off return changed', '  return children;', '  return <div>{children}</div>;')
mutant(HELP_TEMPLATE, 'help template: stylesheet dropped', "import '@/components/help/studio-p2-help.css';\n", '')
mutant(HELP_TEMPLATE, 'help template: a client template', "import type { ReactNode } from 'react';", "'use client';\nimport type { ReactNode } from 'react';")
mutant(HELP_TEMPLATE, 'help template: the name', 'function HelpTemplate', 'function HelpTemplateX')

mutant(HELP_CSS, 'help css: a rule dropped', '[data-studio-p2-help="true"] [data-studio-help="true"] [data-studio-help-card] h4 { font-size: 13px; line-height: 1.5; font-weight: 500; }\n', '')
mutant(HELP_CSS, 'help css: header alignment', '> div { align-items: center; padding: 0 16px; }', '> div { align-items: flex-start; padding: 0 16px; }')
mutant(HELP_CSS, 'help css: header padding', '> div { align-items: center; padding: 0 16px; }', '> div { align-items: center; padding: 0 8px; }')
mutant(HELP_CSS, 'help css: step title size', 'h4 { font-size: 13px;', 'h4 { font-size: 16px;')
mutant(HELP_CSS, 'help css: step title weight', 'line-height: 1.5; font-weight: 500; }', 'line-height: 1.5; font-weight: 600; }')
mutant(HELP_CSS, 'help css: line size', ':is(p, li, span, a, ul).text-sm { font-size: 12px;', ':is(p, li, span, a, ul).text-sm { font-size: 14px;')
mutant(HELP_CSS, 'help css: other ways size', '.border-t > h3 { font-size: 13px;', '.border-t > h3 { font-size: 16px;')
mutant(HELP_CSS, 'help css: start creating fill', 'a.bg-primary { background: var(--ss-action);', 'a.bg-primary { background: var(--ss-accent);')
mutant(HELP_CSS, 'help css: start creating text', 'color: var(--ss-on-action); }', 'color: var(--ss-text); }')
mutant(HELP_CSS, 'help css: start creating hover', 'a.bg-primary:hover { background: var(--ss-action-hover); }', 'a.bg-primary:hover { background: var(--ss-action); }')
mutant(HELP_CSS, 'help css: empty border', 'border: 1px dashed var(--ss-line);', 'border: 1px solid var(--ss-line);')
mutant(HELP_CSS, 'help css: empty fill', 'background: var(--ss-surface); }', 'background: var(--ss-panel); }')
mutant(HELP_CSS, 'help css: a literal colour', 'a.bg-primary:hover { background: var(--ss-action-hover); }', 'a.bg-primary:hover { background: #223a3f; }')
mutant(HELP_CSS, 'help css: an unscoped rule', '[data-studio-p2-help="true"] [data-studio-help="true"] [data-studio-help-card] h4 {', '[data-studio-help-card] h4 {')
mutant(HELP_CSS, 'help css: scoped without the marker', '[data-studio-p2-help="true"] [data-studio-help="true"] [data-studio-help-card] .border-t > h3', '[data-studio-help="true"] [data-studio-help-card] .border-t > h3')
mutant(HELP_CSS, 'help css: a class the page lacks', '.text-center.py-8 {', '.text-center.py-9 {')
mutant(HELP_CSS, 'help css: a token the shell lacks', 'border: 1px dashed var(--ss-line);', 'border: 1px dashed var(--ss-border);')
mutant(HELP_CSS, 'help css: important', 'a.bg-primary { background: var(--ss-action);', 'a.bg-primary { background: var(--ss-action) !important;')


// ---- the content pass: the lib
mutant(LIB, 'current: every rule on every article', 'rules.filter(rule => rule.doc === `${item.category}/${item.slug}`)', 'rules.filter(rule => true)')
mutant(LIB, 'current: a rule names the slug alone', 'rule.doc === `${item.category}/${item.slug}`', 'rule.doc.endsWith(`/${item.slug}`)')
mutant(LIB, 'current: a rule names the category alone', 'rule.doc === `${item.category}/${item.slug}`', 'rule.doc.startsWith(`${item.category}/`)')
mutant(LIB, 'current: every occurrence', 'text.replace(rule.from, () => rule.to)', 'text.split(rule.from).join(rule.to)')
mutant(LIB, 'current: replacement patterns read', 'text.replace(rule.from, () => rule.to)', 'text.replace(rule.from, rule.to)')
mutant(LIB, 'current: the rules run backwards', 'own.reduce((text, rule)', '[...own].reverse().reduce((text, rule)')
mutant(LIB, 'current: only the first rule', 'own.reduce((text, rule)', '[own[0]].reduce((text, rule)')
mutant(LIB, 'current: the slug is lost', '{ ...item, content: own.reduce', '{ id: item.id, title: item.title, category: item.category, content: own.reduce')
mutant(LIB, 'current: an article is handed back as it is', 'return { ...item, content: own.reduce((text, rule) => text.replace(rule.from, () => rule.to), item.content) }', 'item.content = own.reduce((text, rule) => text.replace(rule.from, () => rule.to), item.content); return item')
mutant(LIB, 'item: any category', 'sections.find(section => section.id === category)?.items', 'sections[0]?.items')
mutant(LIB, 'item: any slug', 'find(item => item.slug === slug)', 'find(item => true)')
mutant(LIB, 'related: itself included', 'section.items.filter(item => item.id !== current.id)', 'section.items.filter(item => true)')
mutant(LIB, 'related: the limit ignored', '.slice(0, limit) : []', '.slice(0, 3) : []')
mutant(LIB, 'related: four', 'limit: number = 3', 'limit: number = 4')
mutant(LIB, 'related: any category', 'candidate.id === current.category', 'true')
mutant(LIB, 'related: an unknown category', '.slice(0, limit) : []', '.slice(0, limit) : [current]')
mutant(LIB, 'hidden: the api page shown', "path === '/docs/api' || ", '')
mutant(LIB, 'hidden: integrations shown', " || path === '/integrations'", '')
mutant(LIB, 'hidden: agents shown', " || path === '/agents'", '')
mutant(LIB, 'hidden: every docs page', "path === '/docs/api'", "path.startsWith('/docs')")
mutant(LIB, 'hidden: a prefix of the api page', "path === '/docs/api'", "path.startsWith('/docs/api')")
mutant(LIB, 'hidden: the agent pages too', "path === '/agents'", "path.startsWith('/agents')")
mutant(LIB, 'hidden: the query kept', "href.trim().split(/[?#]/)[0]", "href.trim().split(/#/)[0]")
mutant(LIB, 'hidden: the hash kept', "href.trim().split(/[?#]/)[0]", "href.trim().split(/\\?/)[0]")
mutant(LIB, 'hidden: the slash kept', ".replace(/\\/+$/, '') : ''", " : ''")
mutant(LIB, 'hidden: not trimmed', "href.trim().split(/[?#]/)[0]", "href.split(/[?#]/)[0]")
mutant(LIB, 'footer: Help missing', "[{ label: 'Help', href: '/help' }, { label: 'Docs', href: '/docs' }]", "[{ label: 'Docs', href: '/docs' }]")
mutant(LIB, 'footer: Docs missing', "[{ label: 'Help', href: '/help' }, { label: 'Docs', href: '/docs' }]", "[{ label: 'Help', href: '/help' }]")
mutant(LIB, 'footer: Help word', "{ label: 'Help', href: '/help' }, { label: 'Docs'", "{ label: 'Help Center', href: '/help' }, { label: 'Docs'")
mutant(LIB, 'footer: Docs word', "{ label: 'Docs', href: '/docs' }]", "{ label: 'Documentation', href: '/docs' }]")
mutant(LIB, 'footer: Help address', "{ label: 'Help', href: '/help' }, { label: 'Docs'", "{ label: 'Help', href: '/support' }, { label: 'Docs'")
mutant(LIB, 'footer: Security missing', "[{ label: 'Security', href: '/legal/security' }, { label: 'Cookies', href: '/legal/cookies' }]", "[{ label: 'Cookies', href: '/legal/cookies' }]")
mutant(LIB, 'footer: Cookies missing', "[{ label: 'Security', href: '/legal/security' }, { label: 'Cookies', href: '/legal/cookies' }]", "[{ label: 'Security', href: '/legal/security' }]")
mutant(LIB, 'footer: Cookies address', "href: '/legal/cookies' }].filter", "href: '/legal/cookie' }].filter")
mutant(LIB, 'footer: Help after the legal links', 'return [...head, ...help, ...tail, ...policy]', 'return [...head, ...tail, ...help, ...policy]')
mutant(LIB, 'footer: Security before the legal links', 'return [...head, ...help, ...tail, ...policy]', 'return [...head, ...help, ...policy, ...tail]')
mutant(LIB, 'footer: Help twice', "{ label: 'Docs', href: '/docs' }].filter(link => !has(link.href))", "{ label: 'Docs', href: '/docs' }]")
mutant(LIB, 'footer: Cookies twice', "{ label: 'Cookies', href: '/legal/cookies' }].filter(link => !has(link.href))", "{ label: 'Cookies', href: '/legal/cookies' }]")
mutant(LIB, 'footer: Terms is not where the legal links start', "link.href === '/legal/privacy' || link.href === '/legal/terms'", "link.href === '/legal/privacy'")
mutant(LIB, 'footer: Privacy is not where the legal links start', "link.href === '/legal/privacy' || link.href === '/legal/terms'", "link.href === '/legal/terms'")
mutant(LIB, 'footer: no legal links, the head is lost', 'const head = legal < 0 ? [...links] : links.slice(0, legal)', 'const head = legal < 0 ? [] : links.slice(0, legal)')
mutant(LIB, 'footer: no legal links, the tail is all', 'const tail = legal < 0 ? [] : links.slice(legal)', 'const tail = legal < 0 ? [...links] : links.slice(legal)')
// ---- the rules
const RULE_MUTANTS = [
  ['an import added', 'import type { StudioDocRule }', 'import { cn } from "@/lib/utils"\nimport type { StudioDocRule }'],
  ['an article renamed', 'doc: "getting-started/quick-start-guide",', 'doc: "getting-started/quick-start-guides",'],
  ['a rule\'s old text misquoted', 'from: `Use the Data Visualizer to create charts showing our quarterly growth`', 'from: `Use the Data Visualiser to create charts showing our quarterly growth`'],
  ['the count left at four', '- Coordinates all 8 agents', '- Coordinates all 4 agents'],
  ['the heading count', '## The Eight AI Agents', '## The Seven AI Agents'],
  ['the quick start count', 'Our eight AI agents will collaborate to create your presentation:\n\n- **Director**: Plans the structure and flow\n- **Researcher**', 'Our four AI agents will collaborate to create your presentation:\n\n- **Director**: Plans the structure and flow\n- **Researcher**'],
  ['the Pro count', 'All 8 agents with full collaboration', 'All 4 agents with full collaboration'],
  ['the example count', 'Agent collaboration: All eight agents needed', 'Agent collaboration: All four agents needed'],
  ['the Free line names the old agent', '- **Free Tier**: Director + Content Generator (2 agents)', '- **Free Tier**: Director + Scripter (2 agents)'],
  ['the Director article names the old agent', '- Works with Content Generator only', '- Works with Scripter only'],
  ['the sequence keeps an old name', 'Content Generator → Visualizer → Slide Composer per slide', 'Content Generator → Data Visualizer → Slide Composer per slide'],
  ['the sequence is reordered', 'Content Generator → Visualizer → Slide Composer per slide', 'Visualizer → Content Generator → Slide Composer per slide'],
  ['the Director\'s line changed', '- **Director**: Plans the structure and flow\n- **Researcher**', '- **Director**: Builds the team and choreographs every step\n- **Researcher**'],
  ['a role shortened', '- **Researcher**: Pulls facts from your data and the open web', '- **Researcher**: Pulls facts'],
  ['a role of the team list changed', '- **Slide Composer**: Conducts each slide — pacing, balance, focus', '- **Slide Composer**: Conducts each slide'],
  ['an agent missing from the list', '- **Element Generator**: Builds the atomic pieces every slide is made of`,\n  },\n  {\n    doc: "getting-started/understanding-agents"', '`,\n  },\n  {\n    doc: "getting-started/understanding-agents"'],
  ['a role title changed', '**Role**: The Investigator', '**Role**: The Detective'],
  ['an icon changed', '### 🔍 Researcher Agent', '### 🔎 Researcher Agent'],
  ['an agent renamed', '### 📊 Visualizer Agent', '### 📊 Chart Maker Agent'],
  ['a sentence shortened', 'The Analyst looks at the numbers and tells you what they mean. This agent:', 'The Analyst looks at the numbers. This agent:'],
  ['a long sentence shortened', 'The Theme Builder builds your custom theme — palette, typography, surface treatments — and applies it consistently across every slide and every visual on the canvas. This agent:', 'The Theme Builder builds your custom theme. This agent:'],
  ['a capability dropped', '- Searches your files and connected sources\n- Pulls public data on demand', '- Searches your files and connected sources'],
  ['a capability invented', '- Keeps spacing and alignment tight across elements', '- Keeps spacing and alignment tight across elements\n- Writes your slides for you'],
  ['the collaboration step', '3. **Content Generator** and **Slide Composer** work together on each slide', '3. **Content Generator** and **Theme Builder** work together on each slide'],
  ['the first prompt', 'Use the Visualizer to create charts showing our quarterly growth`', 'Use the Visualizer to create charts for our quarterly growth`'],
  ['the second prompt', 'Have the Content Generator and Slide Composer work together to make slide 5 more impactful', 'Have the Content Generator and Slide Composer work together to make slide 5 impactful'],
  ['the layout line', '- **Slide Composer**: Design clean, professional layouts', '- **Slide Composer**: Design layouts'],
]
for (const [name, from, to] of RULE_MUTANTS) mutant(AGENT_RULES, `rules: ${name}`, from, to)
// ---- the notice, the api page
mutant(API_NOTICE, 'notice: not a note', ' role="note"', '')
mutant(API_NOTICE, 'notice: unnamed', ' aria-labelledby="sd-api-notice-title"', '')
mutant(API_NOTICE, 'notice: title id', 'id="sd-api-notice-title"', 'id="sd-api-title"')
mutant(API_NOTICE, 'notice: not in the site\'s column', 'className="sd-api-notice container mx-auto px-4"', 'className="sd-api-notice"')
mutant(API_NOTICE, 'notice: box class', 'className="sd-api-notice__box"', 'className="sd-api-notice__panel"')
mutant(API_NOTICE, 'notice: title class', 'className="sd-api-notice__title"', 'className="sd-api-notice__head"')
mutant(API_NOTICE, 'notice: text class', 'className="sd-api-notice__text"', 'className="sd-api-notice__body"')
mutant(API_NOTICE, 'notice: title word', '{W.apiNoticeTitle}</p>', '{W.apiNoticeBody}</p>')
mutant(API_NOTICE, 'notice: body word', '{W.apiNoticeBody}</p>', '{W.apiNoticeTitle}</p>')
mutant(API_NOTICE, 'notice: stylesheet', 'import "./studio-p2-docs.css"', '')
mutant(API_NOTICE, 'notice: a client component', 'import { STUDIO_DOCS_WORDS as W }', '"use client"\nimport { STUDIO_DOCS_WORDS as W }')
mutant(API_NOTICE, 'notice: a link', '<p className="sd-api-notice__text">{W.apiNoticeBody}</p>', '<p className="sd-api-notice__text">{W.apiNoticeBody}</p><a href="/help">Help</a>')
mutant(API_NOTICE, 'notice: a utility colour', 'className="sd-api-notice__box"', 'className="sd-api-notice__box bg-gradient-to-r"')
mutant(PAGE_API, 'api page: flag spelling', "=== 'true';", "!== 'false';")
mutant(PAGE_API, 'api page: flag name', 'process.env.NEXT_PUBLIC_STUDIO_P2_DOCS', 'process.env.NEXT_PUBLIC_STUDIO_DOCS')
mutant(PAGE_API, 'api page: always the notice', '{STUDIO_P2_DOCS && <StudioApiNotice />}', '<StudioApiNotice />')
mutant(PAGE_API, 'api page: never the notice', '{STUDIO_P2_DOCS && <StudioApiNotice />}', '{false && <StudioApiNotice />}')
mutant(PAGE_API, 'api page: the notice after the title', ['{STUDIO_P2_DOCS && <StudioApiNotice />}\n            <PageHeader', '                badge={{ text: "v1.0 Beta", icon: <Zap className="h-3 w-3" /> }}\n            />'], ['<PageHeader', '                badge={{ text: "v1.0 Beta", icon: <Zap className="h-3 w-3" /> }}\n            />{STUDIO_P2_DOCS && <StudioApiNotice />}'])
mutant(PAGE_API, 'api page: the import', "'@/components/studio-docs/studio-p2-docs-api-notice'", "'@/components/studio-docs/studio-p2-docs-api'")
mutant(PAGE_API, 'api page: a word changed', 'title="Deckster API"', 'title="Deckster API v2"')
mutant(PAGE_API, 'api page: a claim cut', 'Authenticate your requests using Bearer tokens.', 'Authenticate your requests.')
mutant(PAGE_API, 'api page: not a client page', "'use client';", '')
// ---- the footers
mutant(FOOTER, 'footer: flag spelling', "=== 'true';\nconst linked", "!== 'false';\nconst linked")
mutant(FOOTER, 'footer: flag name', 'process.env.NEXT_PUBLIC_STUDIO_P2_DOCS', 'process.env.NEXT_PUBLIC_STUDIO_DOCS')
mutant(FOOTER, 'footer: the filter is inverted', '!(STUDIO_P2_DOCS && studioDocsHiddenHref(href))', '(STUDIO_P2_DOCS && studioDocsHiddenHref(href))')
mutant(FOOTER, 'footer: the flag off hides too', '!(STUDIO_P2_DOCS && studioDocsHiddenHref(href))', '!studioDocsHiddenHref(href)')
mutant(FOOTER, 'footer: the flag is not needed to show', '!(STUDIO_P2_DOCS && studioDocsHiddenHref(href))', '!(STUDIO_P2_DOCS || studioDocsHiddenHref(href))')
mutant(FOOTER, 'footer: AI Agents kept', "{linked('/agents') && <li>", '{true && <li>')
mutant(FOOTER, 'footer: AI Agents asked of another address', "{linked('/agents') && <li>", "{linked('/experts') && <li>")
mutant(FOOTER, 'footer: the API link kept', 'footerLinks.resources.filter((link) => linked(link.href)).map', 'footerLinks.resources.map')
mutant(FOOTER, 'footer: the compact link kept', 'links.filter((l) => linked(l.href)).map((l) => (', 'links.map((l) => (')
mutant(FOOTER, 'footer: a claim changed', '<span>GDPR Compliant</span>', '<span>GDPR Ready</span>')
mutant(FOOTER, 'footer: a claim cut', '<span>99.9% Uptime</span>', '<span>High uptime</span>')
mutant(FOOTER, 'footer: the import', "import { studioDocsHiddenHref } from '@/lib/studio-p2-docs';", "import { studioDocsHiddenHref } from '@/lib/studio-p2-docs-x';")
mutant(FOOTER, 'footer: not a client component', "'use client';", '')
mutant(FOOTER_V3, 'landing footer: flag spelling', '=== "true"\n', '!== "false"\n')
mutant(FOOTER_V3, 'landing footer: flag name', 'process.env.NEXT_PUBLIC_STUDIO_P2_DOCS', 'process.env.NEXT_PUBLIC_STUDIO_DOCS')
mutant(FOOTER_V3, 'landing footer: always the long list', 'STUDIO_P2_DOCS ? studioDocsFooterLinks(V3_CONTENT.footer.links) : V3_CONTENT.footer.links', 'studioDocsFooterLinks(V3_CONTENT.footer.links)')
mutant(FOOTER_V3, 'landing footer: never the long list', 'const links = STUDIO_P2_DOCS ?', 'const links = false ?')
mutant(FOOTER_V3, 'landing footer: the old links are not the list', ': V3_CONTENT.footer.links\n', ': []\n')
mutant(FOOTER_V3, 'landing footer: the list is not rendered', '{links.map((link) =>', '{V3_CONTENT.footer.links.map((link) =>')
mutant(FOOTER_V3, 'landing footer: the navigation name', 'aria-label="Footer navigation"', 'aria-label="Footer"')
mutant(FOOTER_V3, 'landing footer: the key', 'key={link.label}', 'key={link.href}')
mutant(FOOTER_V3, 'landing footer: the copyright', '<span>{V3_CONTENT.footer.copyright}</span>', '<span>{V3_CONTENT.footer.copyright} </span>')
mutant(FOOTER_V3, 'landing footer: a client component', 'import Link from "next/link"', '"use client"\nimport Link from "next/link"')
// ---- the pages that lose a link
mutant(PAGE_AGENT, 'agent page: flag spelling', "=== 'true';\n\nconst iconMap", "!== 'false';\n\nconst iconMap")
mutant(PAGE_AGENT, 'agent page: flag name', 'process.env.NEXT_PUBLIC_STUDIO_P2_DOCS', 'process.env.NEXT_PUBLIC_STUDIO_DOCS')
mutant(PAGE_AGENT, 'agent page: the not-found link kept', '          {!STUDIO_P2_DOCS && (\n            <Link', '          {true && (\n            <Link')
mutant(PAGE_AGENT, 'agent page: the hero link kept', '              {!STUDIO_P2_DOCS && (\n                <Button', '              {true && (\n                <Button')
mutant(PAGE_AGENT, 'agent page: the closing link kept', '                {!STUDIO_P2_DOCS && (\n                  <Button', '                {true && (\n                  <Button')
mutant(PAGE_AGENT, 'agent page: the hero link hidden with the flag off', '              {!STUDIO_P2_DOCS && (\n                <Button', '              {false && (\n                <Button')
mutant(PAGE_AGENT, 'agent page: a colour built from the agent', 'absolute bottom-0 left-4 top-0 w-0.5 bg-gradient-to-b ${agent.color.gradient} opacity-25', 'absolute bottom-0 left-4 top-0 w-0.5 bg-gradient-to-b ${agent.color.gradient} text-${agent.color.primary} opacity-25')
mutant(PAGE_AGENT, 'agent page: the primary colour used', 'absolute bottom-0 left-4 top-0 w-0.5 bg-gradient-to-b ${agent.color.gradient} opacity-25', 'absolute bottom-0 left-4 top-0 w-0.5 bg-gradient-to-b ${agent.color.gradient} opacity-25 ${agent.color.primary}')
mutant(PAGE_AGENT, 'agent page: a literal colour', 'absolute bottom-0 left-4 top-0 w-0.5 bg-gradient-to-b ${agent.color.gradient} opacity-25', 'absolute bottom-0 left-4 top-0 w-0.5 bg-gradient-to-b ${agent.color.gradient} opacity-25 text-[#a78bfa]')
mutant(PAGE_AGENT, 'agent page: a gradient the CSS cannot reach', 'absolute bottom-0 left-4 top-0 w-0.5 bg-gradient-to-b ${agent.color.gradient} opacity-25', 'absolute bottom-0 left-4 top-0 w-0.5 ${agent.color.gradient} opacity-25')
mutant(PAGE_AGENT, 'agent page: a word changed', 'All agents\n', 'All the agents\n')
mutant(PAGE_AGENT, 'agent page: not a client page', "'use client';", '')
mutant(PAGE_COMPARE, 'compare page: flag spelling', "=== 'true';\n\n// Real", "!== 'false';\n\n// Real")
mutant(PAGE_COMPARE, 'compare page: flag name', 'process.env.NEXT_PUBLIC_STUDIO_P2_DOCS', 'process.env.NEXT_PUBLIC_STUDIO_DOCS')
mutant(PAGE_COMPARE, 'compare page: Meet the Team kept', '{!STUDIO_P2_DOCS && (', '{true && (')
mutant(PAGE_COMPARE, 'compare page: Meet the Team hidden with the flag off', '{!STUDIO_P2_DOCS && (', '{false && (')
mutant(PAGE_COMPARE, 'compare page: a word changed', '>Meet the Team</Link>', '>Meet our Team</Link>')
mutant(PAGE_COMPARE, 'compare page: not a client page', "'use client';", '')
// ---- the CSS of the notice and the muted page
mutant(CSS, 'css api: text stays', '--sd-text: var(--sd-muted); --sd-accent: var(--sd-muted); --sd-teal: var(--sd-muted);', '--sd-accent: var(--sd-muted); --sd-teal: var(--sd-muted);')
mutant(CSS, 'css api: accent stays', '--sd-accent: var(--sd-muted); --sd-teal: var(--sd-muted); }', '--sd-teal: var(--sd-muted); }')
mutant(CSS, 'css api: teal stays', '--sd-teal: var(--sd-muted); }\n[data-studio-p2-docs] .sd-api-notice ~ section :is(h2, code)', '}\n[data-studio-p2-docs] .sd-api-notice ~ section :is(h2, code)')
mutant(CSS, 'css api: muted by opacity', '--sd-teal: var(--sd-muted); }\n[data-studio-p2-docs] .sd-api-notice ~ section :is(h2, code)', '--sd-teal: var(--sd-muted); opacity: .6; }\n[data-studio-p2-docs] .sd-api-notice ~ section :is(h2, code)')
mutant(CSS, 'css api: muted by a filter', '--sd-teal: var(--sd-muted); }\n[data-studio-p2-docs] .sd-api-notice ~ section :is(h2, code)', '--sd-teal: var(--sd-muted); filter: grayscale(1); }\n[data-studio-p2-docs] .sd-api-notice ~ section :is(h2, code)')
mutant(CSS, 'css api: the cards stay solid', 'border-style: dashed;', 'border-style: solid;')
mutant(CSS, 'css api: the dashes are faint', 'border-style: dashed; border-color: var(--sd-muted); }', 'border-style: dashed; }')
mutant(CSS, 'css api: the dashes are teal', 'border-style: dashed; border-color: var(--sd-muted); }', 'border-style: dashed; border-color: var(--sd-teal); }')
mutant(CSS, 'css api: headings keep the text colour', '.sd-api-notice ~ section :is(h2, code) { color: var(--sd-muted); }', '.sd-api-notice ~ section :is(h2, code) { color: var(--sd-text); }')
mutant(CSS, 'css api: code keeps its colour', '.sd-api-notice ~ section :is(h2, code) {', '.sd-api-notice ~ section :is(h2) {')
mutant(CSS, 'css api: the dashed rule is weaker', '.sd-api-notice ~ section .space-y-12 .rounded-lg:not(.bg-muted) { border-style', '.sd-api-notice ~ section .space-y-12 .rounded-lg { border-style')
mutant(CSS, 'css api: the muted rule reaches the footer', '.sd-api-notice ~ section {', '.sd-api-notice ~ * {')
mutant(CSS, 'css api: title size', '.sd-api-notice__title { margin: 0; color: var(--sd-text); font-size: 13px;', '.sd-api-notice__title { margin: 0; color: var(--sd-text); font-size: 16px;')
mutant(CSS, 'css api: title weight', 'font-size: 13px; line-height: 1.5; font-weight: 600; }\n[data-studio-p2-docs] .sd-api-notice__text', 'font-size: 13px; line-height: 1.5; font-weight: 400; }\n[data-studio-p2-docs] .sd-api-notice__text')
mutant(CSS, 'css api: title colour', '.sd-api-notice__title { margin: 0; color: var(--sd-text);', '.sd-api-notice__title { margin: 0; color: var(--sd-accent);')
mutant(CSS, 'css api: text size', 'margin: 4px 0 0; color: var(--sd-muted); font-size: 12px;', 'margin: 4px 0 0; color: var(--sd-muted); font-size: 11px;')
mutant(CSS, 'css api: text colour', 'margin: 4px 0 0; color: var(--sd-muted); font-size: 12px;', 'margin: 4px 0 0; color: var(--sd-text); font-size: 12px;')
mutant(CSS, 'css api: box edge', 'border-left: 3px solid var(--sd-action);', 'border-left: 3px solid var(--sd-accent);')
mutant(CSS, 'css api: box edge literal', 'border-left: 3px solid var(--sd-action);', 'border-left: 3px solid #223a3f;')
mutant(CSS, 'css api: box fill', 'border-radius: 10px; background: var(--sd-panel); }\n[data-studio-p2-docs] .sd-api-notice__title', 'border-radius: 10px; background: var(--sd-soft); }\n[data-studio-p2-docs] .sd-api-notice__title')
mutant(CSS, 'css api: box corners', 'padding: 12px 16px; border: 1px solid var(--sd-line); border-left: 3px solid var(--sd-action); border-radius: 10px;', 'padding: 12px 16px; border: 1px solid var(--sd-line); border-left: 3px solid var(--sd-action); border-radius: 4px;')
mutant(CSS, 'css api: notice offset', '.sd-api-notice { box-sizing: border-box; padding-top: 24px; }', '.sd-api-notice { box-sizing: border-box; padding-top: 0; }')
mutant(CSS, 'css api: notice sets its own width', '.sd-api-notice { box-sizing: border-box; padding-top: 24px; }', '.sd-api-notice { box-sizing: border-box; padding-top: 24px; width: 90%; }')
mutant(CSS, 'css api: important', '.sd-api-notice ~ section { --sd-text: var(--sd-muted);', '.sd-api-notice ~ section { --sd-text: var(--sd-muted) !important;')

let killed = 0, byAssertion = 0, byCrash = 0
const survivors = [], invalid = [], compileOnly = []
counting = false
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  const pairs = Array.isArray(from) ? from.map((f, i) => [f, to[i]]) : [[from, to]]
  let mutated = source, missing = false
  for (const [f, t] of pairs) {
    if (mutated.split(f).length - 1 !== 1) { invalid.push(`${name} (${mutated.split(f).length - 1} matches in ${file})`); missing = true; break }
    mutated = mutated.replace(f, () => t)
  }
  if (missing) continue
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    const page = PAGES.find(p => p.file === file), layout = LAYOUTS.find(l => l[0] === file)
    if (file === LIB) { proveLib(mutated, name); proveComponents(SOURCES[UI], name, mutated); proveFooter(SOURCES[FOOTER], name, mutated); proveFooterV3(SOURCES[FOOTER_V3], name, mutated); proveNotice(SOURCES[API_NOTICE], name, mutated) }
    else if (file === UI) proveComponents(mutated, name)
    else if (file === FRAME) proveComponents(SOURCES[UI], name, SOURCES[LIB], mutated)
    else if (page) provePage(page, mutated, name)
    else if (layout) { proveLayout(layout[0], layout[1], layout[2], mutated, name); if (file === LAYOUT_DOCS) proveDocsTab(mutated, name) }
    else if (file === CSS) proveCss(mutated, CSS_UI, name)
    else if (TITLE_FIXES.some(([f]) => f === file)) proveTitleFix(file, TITLE_FIXES.find(([f]) => f === file)[1], mutated, name)
    else if (NEW_TITLES.some(([f]) => f === file)) proveNewTitle(file, NEW_TITLES.find(([f]) => f === file)[1], mutated, name)
    else if (file === META_ARTICLE) await articleTab(mutated, name)
    else if (file === META_AGENT) await agentTab(mutated, name)
    else if (file === AGENT_RULES) proveRules(mutated, name)
    else if (file === API_NOTICE) proveNotice(mutated, name)
    else if (file === PAGE_API) proveApiPage(mutated, name)
    else if (file === FOOTER) proveFooter(mutated, name)
    else if (file === FOOTER_V3) proveFooterV3(mutated, name)
    else if (file === PAGE_AGENT) { proveAgentPage(mutated, name); proveNoRainbow(mutated, name) }
    else if (file === PAGE_COMPARE) proveComparePage(mutated, name)
    else if (file === HELP_TEMPLATE) proveHelpTemplate(mutated, name)
    else if (file === HELP_CSS) proveHelpCss(mutated, name)
    else if (file === ENV) proveEnv(mutated, name)
    else if (file === PKG) provePackage(mutated, name)
    else assert.fail(`no proof for ${file}`)
    survived = true
  } catch (error) {
    if (/ compiles/.test(String(error?.message))) compileOnly.push(name)
    else if (error?.code === 'ERR_ASSERTION') byAssertion++
    else { byCrash++; assert.ok(/^(TypeError|ReferenceError|SyntaxError)/.test(String(error)), `mutant "${name}": a crash, not a harness fault: ${error}`) }
    killed++
  }
  if (survived) survivors.push(name)
}
counting = true
assert.deepEqual(invalid, [], `mutants whose text is missing or not unique: ${invalid.join('; ')}`)
assert.deepEqual(compileOnly, [], `mutants that only fail to compile (not a proof): ${compileOnly.join(', ')}`)
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(', ')}`)
eq(killed, MUTANTS.length, 'every mutant is killed')

for (const note of notes) console.log(`note: ${note}`)
console.log(`Studio P2 docs: ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed (${byAssertion} by an assertion, ${byCrash} by the code throwing); no network.`)
