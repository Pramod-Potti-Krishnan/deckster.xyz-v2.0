// UAT MARKETING PORT (flag NEXT_PUBLIC_STUDIO_UAT_MARKETING, default off): the seven Landing pages take the UAT design from a parallel tree; off, nothing of it renders.
//
// Run: node scripts/test-studio-uat-marketing.mjs   (plain node: transpile + vm, no network, no browser, no env; needs the two pinned commits in the clone: git fetch the full history)
//   UAT_MARKETING_UAT=<commit>  / UAT_MARKETING_BASE=<commit>  override the `uat` commit the copies come from and the dev commit flag-off identity is checked against (defaults: ee532fa, de4d8e3).
//
// Proven on the REAL sources lib/studio-uat-marketing.ts, lib/marketing/v3-uat-{content,view}.ts, components/marketing/v3-uat/**, hooks/use-v3-deck-uat.ts, styles/marketing-v3-uat.css, the eight route files,
// app/opengraph-image.tsx, app/sitemap.ts, .env.example and package.json:
//   1. the helper: exact "true" only; the LAND-05 overlay (two features, the rest and the input untouched); the rewording rules and the moved lines; the Knowledge-graph pill line; the phone menu's rules;
//   2. the real copy: every rewording rule's text is in UAT's copy exactly once, and with the ruling on no sentence still calls narration or questions beta; the 28 other plan / page claims are as UAT wrote them;
//   3. the copies: every ported file is what scripts/studio-uat-marketing-port.mjs makes from the pinned commits (UAT's file with only its documented edits), the copy of UAT's content is byte-identical, every
//      image is UAT's byte for byte, and no reference points at a still the UAT set does not hold;
//   4. flag-off identity: undoing the route files' dispatch edits gives the base commit's files back byte for byte; the unflagged hook, header, footer, content and Landing helper are the base's;
//   5. the dispatch, executed: each route file with the flag exactly "true" gives the UAT page / metadata / shell, and with any other spelling gives the page it gave before;
//   6. the stylesheet: every selector is scoped to `.mv3:where(.mv3-uat)` (or a class only the UAT tree renders), so none of it can match another page, and the rules keep UAT's specificity;
//   7. the pieces with behaviour: the phone menu (outside press, Escape + focus, choosing), the narration pill, the plan words and the footer links;
//   8. env + package: the flag is documented once, off, and the script is registered.
// Then every mutant below (a flipped rule, a loosened flag, a dropped scope...) must be caught by the proof written for it.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const ts = require('typescript')
const postcss = require('postcss')
const port = await import('./studio-uat-marketing-port.mjs')

// ---------------------------------------------------------------- tiny harness
let checks = 0
let failures = null // null: failing throws; an array: failures are collected (mutant runs)
function fail(message) { checks++; if (failures) failures.push(message); else assert.fail(message) }
const ok = (value, message) => { checks++; if (!value) fail(message) }
const eq = (actual, expected, message) => { checks++; if (!Object.is(actual, expected)) fail(`${message}: got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside the vm have another realm's prototypes
const deepEq = (actual, expected, message) => { checks++; try { assert.deepStrictEqual(plain(actual), plain(expected)) } catch { fail(`${message}: got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`) } }
const match = (text, re, message) => ok(re.test(text), message)
const nomatch = (text, re, message) => ok(!re.test(text), message)
const attempt = fn => { try { return fn() } catch (error) { return `THROWS ${error.message}` } }
const sha = value => crypto.createHash('sha1').update(value).digest('hex')
function collect(fn) { const was = failures; failures = []; try { fn() } catch (error) { failures.push(`threw: ${error.message}`) } const found = failures; failures = was; return found }

const rel = p => p.split('/').join(path.sep)
const readFile = file => fs.readFileSync(path.join(repoRoot, rel(file)), 'utf8')
const SOURCE_FILES = [
  'lib/studio-uat-marketing.ts', 'lib/marketing/v3-uat-view.ts', 'lib/marketing/v3-uat-content.ts', 'lib/marketing/v3-metadata.ts', 'hooks/use-v3-deck-uat.ts', 'styles/marketing-v3-uat.css',
  'components/marketing/v3-uat/flag.ts', 'components/marketing/v3-uat/shell.tsx', 'components/marketing/v3-uat/pages/metadata.ts',
  'components/marketing/v3-uat/HeaderV3.tsx', 'components/marketing/v3-uat/FooterV3.tsx', 'components/marketing/v3-uat/HeroFilm.tsx', 'components/marketing/v3-uat/home/Start.tsx', 'components/marketing/v3-uat/home/Present.tsx',
  'components/marketing/v3-uat/home/Pricing.tsx', 'components/marketing/v3-uat/pages/pricing.tsx', 'components/marketing/v3-uat/V3Runtime.tsx', 'components/marketing/v3-uat/StatusPill.tsx',
  'components/marketing/SnapDeck/SlideProgressRail.tsx', 'app/opengraph-image.tsx', 'app/sitemap.ts', 'lib/analytics.ts', '.env.example', 'package.json',
  ...Object.keys(port.ROUTE_EDITS),
]
const SOURCES = Object.fromEntries(SOURCE_FILES.map(file => [file, readFile(file)]))
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })

// ---------------------------------------------------------------- loading real TypeScript (transpile + vm)
const JSX_RUNTIME = { jsx: (type, props, key) => ({ type, props: props ?? {}, ...(key === undefined ? {} : { key }) }), Fragment: 'Fragment' }
JSX_RUNTIME.jsxs = JSX_RUNTIME.jsx
const deep = () => new Proxy(() => {}, { get: (_t, key) => (key === '__esModule' ? false : key === 'then' ? undefined : key === Symbol.toPrimitive ? () => 'stub' : deep()), apply: () => deep() })
function load(source, fileName, { env = {}, stubs = {}, globals = {} } = {}) {
  const output = ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const mod = { exports: {} }
  vm.runInNewContext(output, { module: mod, exports: mod.exports, process: { env, cwd: () => '/repo' }, JSON, Math, Object, Array, Set, Map, Promise, ...globals, require: spec => {
    if (spec in stubs) return stubs[spec]
    if (spec === 'react/jsx-runtime') return JSX_RUNTIME
    if (spec.endsWith('.css')) return {}
    return deep()
  } })
  return mod.exports
}
const loadHelper = (source = SOURCES['lib/studio-uat-marketing.ts']) => load(source, 'lib/studio-uat-marketing.ts')
const loadContent = (source = SOURCES['lib/marketing/v3-uat-content.ts']) => load(source, 'lib/marketing/v3-uat-content.ts', { stubs: { '@/lib/marketing/homepage-v2-content': { AGENT_TEAM: { find: () => ({ color: '#000000' }) } } } })

// ---------------------------------------------------------------- 1. the helper
function proveHelper(source = SOURCES['lib/studio-uat-marketing.ts'], label = 'helper') {
  nomatch(source, /^\s*(?:import\b|export\s+\*?\s*from\b)|require\(/m, `${label}: import-free`)
  const h = loadHelper(source)
  for (const [value, want] of [['true', true], ['false', false], ['', false], [undefined, false], [null, false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['1', false], ['yes', false], ['on', false]]) eq(attempt(() => h.studioUatMarketingOn(value)), want, `${label}: flag value ${JSON.stringify(value)}`)
  eq(h.STUDIO_UAT_ROOT_CLASS, 'mv3-uat', `${label}: the root class`)
  eq(h.STUDIO_UAT_SLIDES_PATH, '/marketing/v3-uat/slides/', `${label}: the stills' folder`)
  deepEq([...h.STUDIO_UAT_LANDING_LIVE_FEATURES], ['narration', 'questions'], `${label}: the two features the ruling holds live`)
  const features = { publish: 'live', questions: 'beta', narration: 'beta', meetings: 'planned', knowledgeGraph: 'beta', templates: 'beta' }
  eq(h.studioUatFeatures(features, false), features, `${label}: off, the very same object`)
  eq(h.studioUatFeatures(features, undefined), features, `${label}: not on, the very same object`)
  eq(h.studioUatFeatures(features, 'true'), features, `${label}: only the boolean true applies the ruling`)
  deepEq({ ...h.studioUatFeatures(features, true) }, { publish: 'live', questions: 'live', narration: 'live', meetings: 'planned', knowledgeGraph: 'beta', templates: 'beta' }, `${label}: on, narration and questions are live, the rest as it was`)
  deepEq({ ...features }, { publish: 'live', questions: 'beta', narration: 'beta', meetings: 'planned', knowledgeGraph: 'beta', templates: 'beta' }, `${label}: the input is not changed`)
  deepEq({ ...h.studioUatFeatures({ publish: 'live' }, true) }, { publish: 'live' }, `${label}: a config without them gains none`)
  // text rules and moves
  deepEq(h.studioUatApplyRules({ a: ['x beta y', { b: 'beta' }] }, [{ from: 'beta', to: 'live' }]), { a: ['x live y', { b: 'live' }] }, `${label}: rules reach every nested string`)
  deepEq(h.studioUatApplyRules({ a: '· beta', b: 'x · beta' }, [{ from: '· beta', to: '· live', exact: true }]), { a: '· live', b: 'x · beta' }, `${label}: an exact rule swaps a whole value only`)
  const input = { a: 'beta' }
  ok(h.studioUatApplyRules(input, [{ from: 'beta', to: 'live' }]) !== input && input.a === 'beta', `${label}: a copy, the input is not changed`)
  eq(h.studioUatApplyRules(input, []), input, `${label}: no rules, the same value`)
  deepEq(h.studioUatApplyRules({ n: 3, ok: true, none: null }, [{ from: '3', to: '4' }]), { n: 3, ok: true, none: null }, `${label}: only strings are touched`)
  const columns = [{ status: 'live', items: ['a'] }, { status: 'beta', items: ['b', 'c', 'd'] }, { status: 'planned', items: ['e'] }]
  deepEq(h.studioUatMoveLines(columns, ['c', 'b'], 'beta', 'live'), [{ status: 'live', items: ['a', 'c', 'b'] }, { status: 'beta', items: ['d'] }, { status: 'planned', items: ['e'] }], `${label}: lines move from beta to live, in the listed order`)
  deepEq(h.studioUatMoveLines(columns, ['zz'], 'beta', 'live'), columns, `${label}: a line that is not there moves nothing`)
  deepEq(h.studioUatMoveLines(columns.slice(0, 1), ['a'], 'beta', 'live'), columns.slice(0, 1), `${label}: no beta column, nothing moves`)
  deepEq(columns[1].items, ['b', 'c', 'd'], `${label}: the columns handed in are not changed`)
  const content = { pages: { about: { story: { columns: [{ status: 'live', items: ['x'] }, { status: 'beta', items: [h.STUDIO_UAT_LANDING_MOVED_LINES[0], 'keep'] }] } } }, note: 'In beta: audience questions and narration.' }
  eq(h.studioUatContent(content, false), content, `${label}: content off, the very same object`)
  const moved = h.studioUatContent(content, true)
  deepEq(moved.pages.about.story.columns, [{ status: 'live', items: ['x', h.STUDIO_UAT_LANDING_MOVED_LINES[0]] }, { status: 'beta', items: ['keep'] }], `${label}: content on, the about page's lines move`)
  eq(moved.note, 'Audience questions and narration included.', `${label}: content on, a sentence is reworded`)
  eq(content.pages.about.story.columns[1].items.length, 2, `${label}: the content handed in is not changed`)
  deepEq(h.studioUatContent({ note: 'x' }, true), { note: 'x' }, `${label}: content without the about page is only reworded`)
  // Knowledge-graph pill line
  eq(h.studioUatBetaLine(['a', 'Knowledge graph across your decks'], 'Knowledge graph across your decks'), 'Knowledge graph across your decks', `${label}: the exact line carries the pill`)
  eq(h.studioUatBetaLine(['Everything in Pro, plus:', 'Knowledge Graph: agents learn your domain across decks'], 'Knowledge graph across your decks'), 'Knowledge Graph: agents learn your domain across decks', `${label}: with the plan list's words the line that says Knowledge Graph carries it`)
  eq(h.studioUatBetaLine(['Custom themes'], 'Knowledge graph across your decks'), null, `${label}: no such line, no pill`)
  eq(h.studioUatBetaLine(['Knowledge Graph: x'], undefined), null, `${label}: a plan without betaFeature has no pill`)
  eq(h.studioUatBetaLine(['Knowledge Graph: x'], ''), null, `${label}: an empty betaFeature has no pill`)
  // menu
  for (const [open, event, want] of [[false, 'toggle', true], [true, 'toggle', false], [true, 'escape', false], [false, 'escape', false], [true, 'outside', false], [false, 'outside', false], [true, 'choose', false], [true, 'route', false], [false, 'route', false], [true, 'other', true], [false, 'other', false]]) eq(h.studioUatMenuNext(open, event), want, `${label}: ${open ? 'open' : 'closed'} + ${event}`)
  for (const [event, want] of [['escape', true], ['toggle', false], ['outside', false], ['choose', false], ['route', false]]) eq(h.studioUatMenuRestoresFocus(event), want, `${label}: focus returns after ${event}: ${want}`)
  for (const [key, want] of [['Escape', 'escape'], ['Esc', null], ['escape', null], ['Enter', null], [' ', null], ['', null], [undefined, null], [null, null]]) eq(h.studioUatMenuKeyEvent(key), want, `${label}: key ${JSON.stringify(key)}`)
  return h
}

// ---------------------------------------------------------------- 2. the real copy
const wordsOf = value => (typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(wordsOf) : value && typeof value === 'object' ? Object.values(value).flatMap(wordsOf) : [])
function proveContent(helperSource = SOURCES['lib/studio-uat-marketing.ts'], contentSource = SOURCES['lib/marketing/v3-uat-content.ts'], label = 'content') {
  const h = loadHelper(helperSource)
  const c = loadContent(contentSource)
  const strings = wordsOf(c.V3_CONTENT)
  for (const rule of h.STUDIO_UAT_LANDING_TEXT_RULES) {
    const holders = strings.filter(text => (rule.exact ? text === rule.from : text.includes(rule.from)))
    eq(holders.length, 1, `${label}: rule ${JSON.stringify(rule.from.slice(0, 50))} is in UAT's copy exactly once`)
  }
  for (const line of h.STUDIO_UAT_LANDING_MOVED_LINES) eq(c.V3_CONTENT.pages.about.story.columns.find(column => column.status === 'beta').items.filter(item => item === line).length, 1, `${label}: about page beta column holds ${JSON.stringify(line.slice(0, 30))}`)
  eq(c.V3_FEATURES.narration, 'beta', `${label}: UAT's own config says narration is beta`)
  eq(c.V3_FEATURES.questions, 'beta', `${label}: UAT's own config says questions are beta`)
  eq(c.V3_FEATURES.meetings, 'planned', `${label}: meetings are planned`)
  eq(c.V3_STATUS_WORDS.live, 'Live', `${label}: the live word`)
  const ruled = h.studioUatContent(c.V3_CONTENT, true)
  const reworded = wordsOf(h.studioUatApplyRules(c.V3_CONTENT, h.STUDIO_UAT_LANDING_TEXT_RULES))
  const after = wordsOf(ruled)
  const about = '(?:narrat|answers questions|audience questions|ask it questions|viewers can ask|questions on published)'
  for (const text of after) nomatch(text, new RegExp(`${about}[^.]*\\bbeta\\b|\\bbeta\\b[^.]*${about}`, 'i'), `${label}: no sentence still calls narration or questions beta: ${text.slice(0, 60)}`)
  ok(after.includes('Narration'), `${label}: the player's voice label reads Narration`)
  eq(ruled.pages.about.story.columns.find(column => column.status === 'live').items.length, 8, `${label}: the about page's live column has its six lines and the two moved`)
  eq(ruled.pages.about.story.columns.find(column => column.status === 'beta').items.length, 3, `${label}: and its beta column keeps the other three`)
  const live = wordsOf(ruled.pages.about.story.columns[1].items).join('|')
  match(live, /Knowledge graph across your decks/, `${label}: the knowledge graph stays beta`)
  match(live, /Template library from your own PowerPoints/, `${label}: templates stay beta`)
  eq(wordsOf(c.V3_CONTENT).length, wordsOf(ruled).length, `${label}: the ruling rewords, it adds and drops no string`)
  const changed = strings.filter((text, index) => text !== reworded[index]).length
  eq(changed, h.STUDIO_UAT_LANDING_TEXT_RULES.length, `${label}: exactly one string per rule changes (the about page's lines move, they are not reworded)`)
  eq(ruled.pages.pricing.start.tiers.length, 3, `${label}: three plans`)
  eq(c.V3_CONTENT.pages.pricing.start.tiers.filter(tier => tier.betaFeature).length, 1, `${label}: one plan has a Beta line`)
  return c
}

// ---------------------------------------------------------------- 3. the copies are UAT's, with only the documented edits
function proveCopies(sources = SOURCES, label = 'copies') {
  for (const [file, expected] of port.textOutputs()) {
    eq(file in sources ? sources[file] : readFile(file), expected, `${label}: ${file} is what the port script makes`)
  }
  eq(sources['lib/marketing/v3-uat-content.ts'], port.uatBlob('lib/marketing/v3-content.ts'), `${label}: the copy of UAT's content is byte-identical`)
  eq(sources['lib/marketing/v3-metadata.ts'], port.uatBlob('lib/marketing/v3-metadata.ts'), `${label}: v3-metadata is UAT's`)
  eq(sources['components/marketing/SnapDeck/SlideProgressRail.tsx'], port.uatBlob('components/marketing/SnapDeck/SlideProgressRail.tsx'), `${label}: the rail is UAT's`)
  for (const name of port.COMPONENT_FILES) {
    const file = `components/marketing/v3-uat/${name}.tsx`
    ok(fs.existsSync(path.join(repoRoot, rel(file))), `${label}: ${file} exists`)
  }
  eq(port.COMPONENT_FILES.length, 28, `${label}: all 28 UAT components are ported`)
  deepEq([...port.PAGE_NAMES].sort(), ['about', 'bring', 'experts', 'home', 'learn', 'present', 'pricing'], `${label}: the seven pages`)
  // every UAT file under components/marketing/v3 is accounted for
  const uatFiles = git('ls-tree', '-r', '--name-only', port.UAT_COMMIT, '--', 'components/marketing/v3').trim().split('\n').map(f => f.replace('components/marketing/v3/', '').replace(/\.tsx$/, ''))
  deepEq([...uatFiles].sort(), [...port.COMPONENT_FILES].sort(), `${label}: every component UAT has is ported, none else`)
  // images: UAT's, byte for byte
  const images = port.binaryOutputs()
  ok(images.length >= 21, `${label}: ${images.length} images (20 stills and the share card)`)
  for (const [from, to] of images) {
    const copy = fs.readFileSync(path.join(repoRoot, rel(to)))
    eq(sha(copy), sha(port.uatBlob(from, 'buffer')), `${label}: ${to} is UAT's file`)
  }
  // the brand files (their own commit; NOT behind the flag, they cannot be: same names, same places): UAT's, byte for byte, and the same pixel size as the file each replaces (so every <img> that names them lays out as before)
  const pngSize = buffer => ({ w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) })
  for (const file of port.LOGO_FILES) eq(sha(fs.readFileSync(path.join(repoRoot, rel(file)))), sha(port.uatBlob(file, 'buffer')), `${label}: ${file} is UAT's file`)
  eq(port.LOGO_FILES.length, 12, `${label}: twelve brand files`)
  for (const file of port.LOGO_FILES.filter(f => f.endsWith('.png') && !/icon-192|icon-512|apple-touch-icon/.test(f))) deepEq(pngSize(fs.readFileSync(path.join(repoRoot, rel(file)))), pngSize(port.baseBlob(file, 'buffer')), `${label}: ${file} keeps its pixel size`)
  for (const [file, size] of [['public/icon-192.png', 192], ['public/icon-512.png', 512], ['public/apple-touch-icon.png', 180]]) {
    deepEq(pngSize(fs.readFileSync(path.join(repoRoot, rel(file)))), { w: size, h: size }, `${label}: ${file} is ${size}x${size} (the manifest and the touch icon ask for that; the placeholder it replaces was 256x144)`)
    ok(fs.statSync(path.join(repoRoot, rel(file))).size > 2000, `${label}: ${file} is a real image, not the 568-byte placeholder`)
  }
  eq(JSON.parse(readFile('public/manifest.json')).icons.map(icon => icon.sizes).join(), '192x192,512x512', `${label}: the manifest asks for 192 and 512`)
  for (const file of ['app/icon.svg', 'public/icon.svg', 'public/favicon.svg']) match(readFile(file), /<svg/, `${label}: ${file} is an svg`)
  // no reference to a still the UAT set does not hold; none to the unflagged folder
  const tree = []
  const walk = dir => { for (const entry of fs.readdirSync(path.join(repoRoot, rel(dir)), { withFileTypes: true })) { const p = `${dir}/${entry.name}`; if (entry.isDirectory()) walk(p); else if (/\.(tsx?|css)$/.test(entry.name)) tree.push(p) } }
  walk('components/marketing/v3-uat'); tree.push('lib/marketing/v3-uat-content.ts', 'lib/marketing/v3-uat-view.ts')
  const stills = new Set(fs.readdirSync(path.join(repoRoot, 'public/marketing/v3-uat/slides')))
  for (const file of tree) {
    const text = readFile(file)
    nomatch(text, /\/marketing\/v3\/slides\//, `${label}: ${file} reads no still from the unflagged folder`)
    nomatch(text, /@\/lib\/marketing\/v3-content["']/, `${label}: ${file} does not read the unflagged copy`)
    nomatch(text, /@\/components\/marketing\/v3\//, `${label}: ${file} imports nothing from the unflagged components`)
    for (const m of text.matchAll(/\/marketing\/v3-uat\/slides\/([\w-]+\.jpg)/g)) ok(stills.has(m[1]), `${label}: ${file} names ${m[1]}, which is in the set`)
  }
  const content = readFile('lib/marketing/v3-uat-content.ts')
  for (const m of content.matchAll(/"(theme-[\w-]+\.jpg)"/g)) ok(stills.has(m[1]), `${label}: the copy names ${m[1]}, which is in the set`)
  for (const m of content.matchAll(/slide: (\d+)/g)) ok(stills.has(`deck-${String(m[1]).padStart(2, '0')}.jpg`) || Number(m[1]) > 12, `${label}: the copy's slot ${m[1]} has a still or is a slide number`)
  for (let slot = 1; slot <= 12; slot++) ok(stills.has(`deck-${String(slot).padStart(2, '0')}.jpg`), `${label}: deck-${slot} is in the set`)
}

// ---------------------------------------------------------------- 4. flag-off identity
const FROZEN = [
  'components/marketing/v3/HeaderV3.tsx', 'components/marketing/v3/HeaderMenuP2.tsx', 'components/marketing/v3/FooterV3.tsx', 'components/marketing/v3/home/Present.tsx', 'components/marketing/v3/home/Pricing.tsx',
  'hooks/use-v3-deck.ts', 'lib/marketing/v3-content.ts', 'lib/studio-p2-landing.ts', 'lib/studio-billing.ts', 'styles/marketing-v3.css', 'styles/marketing-v3-p2.css', 'next.config.mjs',
  'components/layout/Header.tsx', 'components/marketing/SnapDeck/SnapDeck.tsx', 'components/marketing/SnapDeck/SlideNavArrows.tsx', 'middleware.ts',
]
function proveIdentity(sources = SOURCES, label = 'identity') {
  for (const file of Object.keys(port.ROUTE_EDITS)) eq(port.routeUndo(file, sources[file]), port.baseBlob(file), `${label}: ${file}: undoing the dispatch gives the base commit's file back byte for byte`)
  for (const file of FROZEN) eq(readFile(file), port.baseBlob(file), `${label}: ${file} is the base commit's, byte for byte`)
  // the edits are additions around the base's own lines: every base line is still there, in order
  for (const file of Object.keys(port.ROUTE_EDITS)) {
    if (file === 'app/(marketing-v3)/layout.tsx') continue
    ok(sources[file].length > port.baseBlob(file).length, `${label}: ${file} only gains text`)
  }
  // the unflagged pages never name a UAT component outside the flag's branch
  for (const file of Object.keys(port.ROUTE_EDITS).filter(f => f.startsWith('app/(marketing-v3)/'))) {
    const text = sources[file]
    eq((text.match(/process\.env\.NEXT_PUBLIC_STUDIO_UAT_MARKETING|studioUatMarketing\.on/g) ?? []).length, file.endsWith('layout.tsx') ? 1 : 2, `${label}: ${file} reads the flag in exactly its metadata and its body (layout: once)`)
  }
}

// ---------------------------------------------------------------- 5. the dispatch, executed
const DEV_PAGES = {
  'app/(marketing-v3)/page.tsx': { name: 'home', component: 'UatHomePage', canonical: '/', page: 'main' },
  'app/(marketing-v3)/about/page.tsx': { name: 'about', component: 'UatAboutPage', canonical: '/about', page: 'main' },
  'app/(marketing-v3)/bring/page.tsx': { name: 'bring', component: 'UatBringPage', canonical: '/bring', page: 'main' },
  'app/(marketing-v3)/experts/page.tsx': { name: 'experts', component: 'UatExpertsPage', canonical: '/experts', page: 'Fragment' },
  'app/(marketing-v3)/learn/page.tsx': { name: 'learn', component: 'UatLearnPage', canonical: '/learn', page: 'main' },
}
const GOVERNED = {
  'app/(marketing-v3)/present/page.tsx': { name: 'present', component: 'UatPresentPage', canonical: '/present' },
  'app/(marketing-v3)/pricing/page.tsx': { name: 'pricing', component: 'UatPricingPage', canonical: '/pricing' },
}
const FLAG = 'NEXT_PUBLIC_STUDIO_UAT_MARKETING'
const OFF_SPELLINGS = [undefined, 'false', 'TRUE', 'True', '1', ' true', 'true ', '', 'yes', 'on']
const metaStub = Object.fromEntries(['home', 'about', 'bring', 'experts', 'learn', 'present', 'pricing'].map(n => [n, { uat: n }]))
const pageStubs = Object.fromEntries(['home', 'about', 'bring', 'experts', 'learn', 'present', 'pricing'].map(n => [`@/components/marketing/v3-uat/pages/${n}`, { __esModule: true, [`Uat${n[0].toUpperCase()}${n.slice(1)}Page`]: `Uat${n[0].toUpperCase()}${n.slice(1)}Page` }]))
async function proveDispatch(sources = SOURCES, label = 'dispatch') {
  for (const [file, spec] of Object.entries(DEV_PAGES)) {
    const run = value => load(sources[file], file, { env: value === undefined ? {} : { [FLAG]: value }, stubs: { ...pageStubs, '@/components/marketing/v3-uat/pages/metadata': { uatMarketingMetadata: metaStub }, '@/lib/marketing/v3-content': { V3_CONTENT: deep(), showcaseAlt: () => 'alt' }, '@/lib/studio-p2-landing': deep() } })
    const on = run('true')
    deepEq(on.metadata, { uat: spec.name }, `${label}: ${spec.name}: flag true, the UAT metadata`)
    const tree = await on.default()
    eq(tree?.type, spec.component, `${label}: ${spec.name}: flag true, the UAT page`)
    ok(attempt(() => on.default.constructor.name) === 'AsyncFunction', `${label}: ${spec.name}: the page is async (its UAT branch is an import())`)
    for (const value of OFF_SPELLINGS) {
      const off = run(value)
      eq(off.metadata?.alternates?.canonical, spec.canonical, `${label}: ${spec.name}: flag ${JSON.stringify(value)}, the page's own metadata`)
      const result = await off.default()
      eq(result?.type, spec.page, `${label}: ${spec.name}: flag ${JSON.stringify(value)}, the page as it was`)
    }
    match(sources[file], /if \(process\.env\.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true"\) \{\n    const \{ \w+ \} = await import\("@\/components\/marketing\/v3-uat\/pages\/\w+"\)/, `${label}: ${spec.name}: the UAT page is an import() inside the exact-true test (the build drops it with the flag off)`)
  }
  for (const [file, spec] of Object.entries(GOVERNED)) {
    const run = on => load(sources[file], file, { env: {}, stubs: { ...pageStubs, '@/components/marketing/v3-uat/pages/metadata': { uatMarketingMetadata: metaStub }, '@/components/marketing/v3-uat/flag': { studioUatMarketing: { on } }, '@/lib/marketing/v3-content': { V3_CONTENT: deep() }, '@/lib/studio-p2-landing': { studioP2LandingOn: () => false, studioP2Status: v => v } } })
    const on = run(true)
    deepEq(on.metadata, { uat: spec.name }, `${label}: ${spec.name}: flag on, the UAT metadata`)
    eq(on.default()?.type, spec.component, `${label}: ${spec.name}: flag on, the UAT page`)
    const off = run(false)
    eq(off.metadata?.alternates?.canonical, spec.canonical, `${label}: ${spec.name}: flag off, the page's own metadata`)
    eq(off.default()?.type, 'main', `${label}: ${spec.name}: flag off, the page as it was`)
    nomatch(sources[file], /NEXT_PUBLIC_STUDIO_UAT_MARKETING/, `${label}: ${spec.name}: reads the flag only through components/marketing/v3-uat/flag.ts`)
  }
  // the flag module itself
  const readFlag = value => load(sources['components/marketing/v3-uat/flag.ts'], 'flag.ts', { env: value === undefined ? {} : { [FLAG]: value }, stubs: { '@/lib/studio-uat-marketing': loadHelper() } }).studioUatMarketing.on
  eq(readFlag('true'), true, `${label}: the flag object is on for "true"`)
  for (const value of OFF_SPELLINGS) eq(readFlag(value), false, `${label}: the flag object is off for ${JSON.stringify(value)}`)
  // the layout
  const fonts = { Bricolage_Grotesque: () => ({ variable: 'v1' }), Instrument_Sans: () => ({ variable: 'v2' }), Instrument_Serif: () => ({ variable: 'v3' }), Inter: () => ({ variable: 'v4' }), JetBrains_Mono: () => ({ variable: 'v5' }) }
  const layoutFile = 'app/(marketing-v3)/layout.tsx'
  const layout = value => load(sources[layoutFile], layoutFile, { env: value === undefined ? {} : { [FLAG]: value }, stubs: { 'next/font/google': fonts, '@/components/marketing/v3-uat/shell': { __esModule: true, UatMarketingShell: 'UatMarketingShell' } } }).default({ children: 'kids' })
  const shell = await layout('true')
  eq(shell?.type, 'UatMarketingShell', `${label}: layout: flag true, the UAT shell`)
  eq(shell?.props?.fonts, 'v1 v2 v3 v5 v4', `${label}: layout: the shell gets the layout's own font classes`)
  eq(shell?.props?.children, 'kids', `${label}: layout: the shell wraps the page`)
  for (const value of OFF_SPELLINGS) { const tree = await layout(value); eq(tree?.type, 'div', `${label}: layout: flag ${JSON.stringify(value)}, the layout as it was`); match(String(tree?.props?.className), /^mv3 v1 v2 v3 v5 v4$/, `${label}: layout: flag ${JSON.stringify(value)}, the root is plain .mv3`) }
  match(sources[layoutFile], /import "@\/styles\/marketing-v3\.css"\n[^\n]*\nimport "@\/styles\/marketing-v3-uat\.css"\n/, `${label}: layout: the UAT sheet follows the base sheet in the same module (so it comes after it in the cascade)`)
  eq((sources[layoutFile].match(/import "@\/styles\/marketing-v3-uat\.css"/g) ?? []).length, 1, `${label}: layout: the UAT sheet is imported once`)
  ok(sources[layoutFile].indexOf('import "@/styles/marketing-v3.css"') >= 0 && sources[layoutFile].indexOf('import "@/styles/marketing-v3.css"') < sources[layoutFile].indexOf('import "@/styles/marketing-v3-uat.css"'), `${label}: layout: and never before the base sheet`)
  match(sources[layoutFile], /if \(process\.env\.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true"\) \{\n    const \{ UatMarketingShell \} = await import\("@\/components\/marketing\/v3-uat\/shell"\)/, `${label}: layout: the shell is an import() inside the exact-true test`)
  // share card and sitemap
  const og = value => load(sources['app/opengraph-image.tsx'], 'app/opengraph-image.tsx', { env: value === undefined ? {} : { [FLAG]: value }, globals: { Response: class { constructor(body, init) { this.body = body; this.init = init } } }, stubs: { 'node:fs/promises': { readFile: async () => 'JPEG' }, 'node:path': { join: (...parts) => parts.join('/') }, 'next/og': { ImageResponse: class { constructor() { this.png = true } } } } })
  const ogOn = og('true')
  eq(ogOn.contentType, 'image/jpeg', `${label}: share card: flag true, a JPEG`)
  eq(ogOn.alt, 'Deckster — Your knowledge. Your decks. Your voice.', `${label}: share card: flag true, UAT's line`)
  const sent = await ogOn.default()
  eq(sent?.body, 'JPEG', `${label}: share card: flag true, UAT's JPEG is sent`)
  eq(sent?.init?.headers?.['Content-Type'], 'image/jpeg', `${label}: share card: flag true, with the JPEG content type`)
  for (const value of OFF_SPELLINGS) {
    const card = og(value)
    eq(card.contentType, 'image/png', `${label}: share card: flag ${JSON.stringify(value)}, a PNG as before`)
    eq(card.alt, 'Deckster — A team of AI agents builds your deck', `${label}: share card: flag ${JSON.stringify(value)}, the old line`)
    ok((await card.default())?.png === true, `${label}: share card: flag ${JSON.stringify(value)}, the generated card`)
  }
  const map = value => load(sources['app/sitemap.ts'], 'app/sitemap.ts', { env: value === undefined ? {} : { [FLAG]: value }, stubs: { 'next/navigation': { notFound: () => { throw new Error('NEXT_NOT_FOUND') } } } }).default
  const listed = map('true')()
  eq(listed.length, 13, `${label}: sitemap: flag true, the 13 routes`)
  eq(listed[0].url, 'https://deckster.xyz', `${label}: sitemap: the home page is the bare origin`)
  for (const value of OFF_SPELLINGS) match(String(attempt(() => map(value)())), /NEXT_NOT_FOUND/, `${label}: sitemap: flag ${JSON.stringify(value)}, a 404 as before`)
}

// ---------------------------------------------------------------- 6. the stylesheet
function proveCss(source = SOURCES['styles/marketing-v3-uat.css'], label = 'css') {
  const root = postcss.parse(source)
  const bad = []
  let rules = 0
  root.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return
    rules++
    for (const selector of rule.selectors) {
      const s = selector.trim()
      if (!(s.startsWith(port.SCOPE) || port.CSS_UNSCOPED.some(re => re.test(s)))) bad.push(s)
      if (/\.mv3\.mv3-uat/.test(s)) bad.push(`(plain class, adds specificity) ${s}`)
    }
  })
  deepEq(bad, [], `${label}: every selector starts ${port.SCOPE} or is one of the three only the UAT tree renders`)
  ok(rules >= 230, `${label}: ${rules} rules (UAT's block has 238 plus the two restated below)`)
  const unscoped = []
  root.walkRules(rule => { for (const selector of rule.selectors) if (port.CSS_UNSCOPED.some(re => re.test(selector.trim()))) unscoped.push(selector.trim()) })
  eq(new Set(unscoped).size, 3, `${label}: exactly three selectors are left unscoped`)
  match(source, /@media \(max-width:900px\)\{\.mv3:where\(\.mv3-uat\) \.xchg\{right:16px;width:auto\}\}/, `${label}: the phone .xchg layout UAT's min-width change restores is restated`)
  match(source, /\.mv3:where\(\.mv3-uat\) \.player__voice--live\{border-color:var\(--st-live\);color:var\(--st-live\)\}/, `${label}: the live voice label has its colour`)
  nomatch(source, /(^|\})\s*\.mv3 /m, `${label}: no bare .mv3 rule (it would reach the unflagged pages)`)
  nomatch(source, /(^|[,{}])\s*(?:html|body)\s*[{,]/m, `${label}: no bare html or body rule`)
  match(source, /^\/\* NEXT_PUBLIC_STUDIO_UAT_MARKETING \(default off\)\. GENERATED by scripts\/studio-uat-marketing-port\.mjs/, `${label}: says it is generated`)
  eq(source, port.cssOutput(), `${label}: is what the port script makes from UAT's block`)
  // the base sheet is untouched and nothing here is imported by an unflagged page
  eq(readFile('styles/marketing-v3.css'), port.baseBlob('styles/marketing-v3.css'), `${label}: the base sheet is the base commit's`)
  const importers = []
  const walk = dir => { for (const entry of fs.readdirSync(path.join(repoRoot, rel(dir)), { withFileTypes: true })) { const p = `${dir}/${entry.name}`; if (entry.isDirectory()) { if (!['node_modules', '.next', '.git'].includes(entry.name)) walk(p) } else if (/\.(tsx?|css)$/.test(entry.name) && /^\s*import\s+["'][^"']*marketing-v3-uat\.css["']/m.test(fs.readFileSync(path.join(repoRoot, rel(p)), 'utf8'))) importers.push(p) } }
  for (const dir of ['app', 'components', 'hooks', 'lib', 'styles']) walk(dir)
  deepEq(importers, ['app/(marketing-v3)/layout.tsx'], `${label}: only the Landing layout imports the sheet`)
}

// ---------------------------------------------------------------- 7. the pieces with behaviour (source-level proofs)
function proveHeader(source = SOURCES['components/marketing/v3-uat/HeaderV3.tsx'], label = 'header') {
  match(source, /studioUatMenuNext\(current, event\)/, `${label}: open / closed comes from the helper's rule`)
  match(source, /if \(studioUatMenuRestoresFocus\(event\)\) buttonRef\.current\?\.focus\(\)/, `${label}: Escape hands the focus back to the button`)
  match(source, /const action = studioUatMenuKeyEvent\(event\.key\)\n\s+if \(action\) send\(action\)/, `${label}: the key goes through the helper`)
  match(source, /document\.addEventListener\("pointerdown", onPress\)/, `${label}: a press anywhere is heard`)
  match(source, /if \(target && headerRef\.current\?\.contains\(target\)\) return\n\s+send\("outside"\)/, `${label}: a press outside the header closes the menu, one inside does not`)
  match(source, /document\.removeEventListener\("pointerdown", onPress\)/, `${label}: the listener is removed`)
  match(source, /window\.removeEventListener\("keydown", onKey\)/, `${label}: the key listener is removed`)
  match(source, /useEffect\(\(\) => \{ setOpen\(false\) \}, \[pathname\]\)/, `${label}: a new page closes the menu`)
  match(source, /send\("toggle"\)/, `${label}: the button toggles`)
  match(source, /onClick=\{\(\) => send\("choose"\)\}/, `${label}: choosing a link closes`)
  match(source, /<header ref=\{headerRef\} className="hdr" data-v3-header>/, `${label}: the header element is the press boundary and keeps the marker the runtime reads`)
  match(source, /<button ref=\{buttonRef\} type="button" className="hdr__menu"/, `${label}: the button has its ref`)
  match(source, /aria-expanded=\{open\} aria-controls="v3-menu"/, `${label}: the button names the panel it opens`)
  nomatch(source, /p2-menu|HeaderMenuP2|data-p2-landing/, `${label}: the Pass 2 menu is not mounted in the UAT tree`)
}
function proveBits(sources = SOURCES, label = 'bits') {
  const hero = sources['components/marketing/v3-uat/HeroFilm.tsx']
  match(hero, /<span className=\{`st st--\$\{betaStatus\} st--sm`\}>\{betaWord\}<\/span>/, `${label}: the film's narration pill follows the feature's status`)
  nomatch(hero, /st st--beta st--sm/, `${label}: the film has no fixed Beta class left`)
  const start = sources['components/marketing/v3-uat/home/Start.tsx']
  match(start, /betaWord=\{statusOf\("narration"\)\.word\}\n\s+betaStatus=\{statusOf\("narration"\)\.status\}/, `${label}: the hero passes narration's own word and status`)
  match(sources['components/marketing/v3-uat/home/Present.tsx'], /player__voice player__voice--\$\{statusOf\("narration"\)\.status\}/, `${label}: the player voice label takes the narration status`)
  for (const file of ['components/marketing/v3-uat/home/Pricing.tsx', 'components/marketing/v3-uat/pages/pricing.tsx']) {
    const text = sources[file]
    match(text, /import \{ studioLandingTiers \} from "@\/lib\/studio-billing"/, `${label}: ${file}: reads the plan words through the shared helper`)
    match(text, /const STUDIO_P2_ACCOUNT = process\.env\.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"/, `${label}: ${file}: ACC-14's flag read inline, exact true`)
    match(text, /studioLandingTiers\((?:copy\.tiers|copy\.start\.tiers), PRICING_TIERS, STUDIO_P2_ACCOUNT\)/, `${label}: ${file}: the plan words come from PRICING_TIERS with the flag`)
    match(text, /feature === studioUatBetaLine\(tier\.features, tier\.betaFeature\)/, `${label}: ${file}: the Beta pill finds its line again`)
    nomatch(text, /feature === tier\.betaFeature/, `${label}: ${file}: no exact-text pill match left`)
  }
  const footer = sources['components/marketing/v3-uat/FooterV3.tsx']
  match(footer, /const STUDIO_P2_DOCS = process\.env\.NEXT_PUBLIC_STUDIO_P2_DOCS === "true"/, `${label}: footer: the Docs flag read inline, exact true`)
  match(footer, /STUDIO_P2_DOCS \? studioDocsFooterLinks\(V3_CONTENT\.footer\.links\) : V3_CONTENT\.footer\.links/, `${label}: footer: Help / Docs / Security / Cookies join UAT's list only with the flag`)
  match(footer, /\{links\.map\(\(link\)/, `${label}: footer: renders that list`)
  const hook = sources['hooks/use-v3-deck-uat.ts']
  match(hook, /export function useV3DeckUat\(\)/, `${label}: hook: its own name`)
  match(hook, /if \(STUDIO_P2_LANDING\) html\.classList\.add\(STUDIO_P2_NIGHT_CLASS\)/, `${label}: hook: LAND-01's night class is kept`)
  match(hook, /html\.classList\.toggle\("mv3-on-paper", onPaper\)/, `${label}: hook: UAT's paper marker`)
  match(hook, /html\.classList\.remove\("mv3-page", "mv3-on-paper"\)/, `${label}: hook: both markers are removed on the way out`)
  match(sources['components/marketing/v3-uat/V3Runtime.tsx'], /useV3DeckUat\(\)/, `${label}: the UAT runtime calls the UAT hook`)
  const view = sources['lib/marketing/v3-uat-view.ts']
  match(view, /const STUDIO_P2_LANDING = studioP2LandingOn\(process\.env\.NEXT_PUBLIC_STUDIO_P2_LANDING\)/, `${label}: view: LAND-05's flag through its own helper`)
  match(view, /studioUatFeatures<Record<V3Feature, V3Status>>\(UAT_FEATURES, STUDIO_P2_LANDING\)/, `${label}: view: the statuses get the ruling`)
  match(view, /studioUatContent\(UAT_CONTENT, STUDIO_P2_LANDING\)/, `${label}: view: the copy gets the ruling`)
  const shell = sources['components/marketing/v3-uat/shell.tsx']
  match(shell, /<div className=\{`mv3 \$\{STUDIO_UAT_ROOT_CLASS\} \$\{fonts\}`\}>/, `${label}: shell: the root carries mv3 and the UAT class`)
  nomatch(shell, /SlideNavArrows/, `${label}: shell: no on-screen arrows (UAT dropped them)`)
  match(shell, /<V3Spotlight \/>/, `${label}: shell: the pointer light`)
}

// ---------------------------------------------------------------- 8. env and package
function proveEnv(sources = SOURCES, label = 'env') {
  const lines = sources['.env.example'].split('\n')
  eq(lines.filter(l => l === `${FLAG}="false"`).length, 1, `${label}: the flag is documented once, off`)
  eq(lines.filter(l => new RegExp(`^${FLAG}=`).test(l)).length, 1, `${label}: and has no second value`)
  const index = lines.indexOf(`${FLAG}="false"`)
  const block = lines.slice(index - 5, index).join('\n')
  for (const word of ['UAT MARKETING PORT', 'READ AT BUILD TIME', 'default off'.replace('default off', 'exactly as before'), 'Pass 2 Landing flag', 'Pass 2 Docs flag', 'Pass 2 Account flag', 'NOT behind this flag']) ok(block.includes(word), `${label}: the block says "${word}"`)
  nomatch(block, /exact "true" enables it/, `${label}: the block avoids the phrase the earlier flags' checks look for`)
  nomatch(block, /P2_(?:LANDING|DOCS|ACCOUNT|POLISH)/, `${label}: the block names no other flag (the Docs and Landing checks strip their own block and refuse a line that names their flag)`)
  ok(lines.slice(index + 1).every(l => l.trim() === '' || l.startsWith('#')), `${label}: nothing but comments follows`)
  eq(JSON.parse(sources['package.json']).scripts['test:studio-uat-marketing'], 'node scripts/test-studio-uat-marketing.mjs', `${label}: the package script`)
  ok(fs.existsSync(path.join(repoRoot, 'scripts/test-studio-uat-marketing.mjs')), `${label}: the script exists`)
  // no other flag's value or script is touched
  const base = port.baseBlob('package.json')
  const was = JSON.parse(base).scripts, now = JSON.parse(sources['package.json']).scripts
  for (const key of Object.keys(was)) eq(now[key], was[key], `${label}: script ${key} is as it was`)
  eq(Object.keys(now).length, Object.keys(was).length + 1, `${label}: exactly one script was added`)
  // (the Security-page commit rewords one sentence of the Docs block: "the legal pages" -> "the Privacy, Terms and Cookies pages"; everything else of the base is untouched)
  const envBase = port.baseBlob('.env.example').split('\n').map(line => line.replace('The words of the legal pages are not touched.', 'The words of the Privacy, Terms and Cookies pages are not touched.'))
  let at = 0
  for (const line of sources['.env.example'].split('\n')) if (at < envBase.length && line === envBase[at]) at++
  eq(at, envBase.length, `${label}: every line .env.example had is still there, in order`)
  ok(sources['lib/analytics.ts'].includes('| "v3_zoom_try"\n  | "v3_menu"\n  | "v3_realdeck_open"\n'), `${label}: analytics: the three CTA names the UAT components send`)
}

// ---------------------------------------------------------------- run everything
async function proveAll(sources = SOURCES) {
  proveHelper(sources['lib/studio-uat-marketing.ts'])
  proveContent(sources['lib/studio-uat-marketing.ts'], sources['lib/marketing/v3-uat-content.ts'])
  proveCopies(sources)
  proveIdentity(sources)
  await proveDispatch(sources)
  proveCss(sources['styles/marketing-v3-uat.css'])
  proveHeader(sources['components/marketing/v3-uat/HeaderV3.tsx'])
  proveBits(sources)
  proveEnv(sources)
}
await proveAll()
const realChecks = checks

// ---------------------------------------------------------------- mutants: each must be caught by the proof written for it
const mutated = (file, from, to) => { const text = SOURCES[file] ?? readFile(file); if (!text.includes(from)) throw new Error(`mutant text not found in ${file}: ${from.slice(0, 60)}`); return { ...SOURCES, [file]: text.replace(from, to) } }
const MUTANTS = []
const mutant = (name, file, from, to, proofs) => MUTANTS.push({ name, file, from, to, proofs })
const H = 'lib/studio-uat-marketing.ts'
mutant('helper: flag loose', H, "return value === 'true'", "return value !== 'false'", ['helper'])
mutant('helper: flag truthy', H, "return value === 'true'", 'return Boolean(value)', ['helper'])
mutant('helper: flag any case', H, "return value === 'true'", "return typeof value === 'string' && value.toLowerCase() === 'true'", ['helper'])
mutant('helper: ruling always applied', H, 'if (landingOn !== true) return features', '', ['helper'])
mutant('helper: ruling on any truthy', H, 'if (landingOn !== true) return features', 'if (!landingOn) return features', ['helper'])
mutant('helper: meetings made live too', H, "['narration', 'questions'] as const", "['narration', 'questions', 'meetings'] as const", ['helper', 'content'])
mutant('helper: questions left beta', H, "['narration', 'questions'] as const", "['narration'] as const", ['helper', 'content'])
mutant('helper: features mutated in place', H, 'const next: Record<string, string> = { ...features }', 'const next: Record<string, string> = features', ['helper'])
mutant('helper: rule loses a sentence', H, "{ from: 'Narration · beta', to: 'Narration' },\n", '', ['content'])
mutant('helper: rule text drifts', H, "from: 'It presents and answers questions · beta'", "from: 'It presents and answers questions · BETA'", ['content'])
mutant('helper: exact rule made loose', H, "{ from: '· beta', to: '· live', exact: true }", "{ from: '· beta', to: '· live' }", ['helper', 'content'])
mutant('helper: exact rule ignored', H, 'if (rule.exact) { if (next === rule.from) next = rule.to; continue }', 'if (rule.exact) { continue }', ['helper', 'content'])
mutant('helper: second sentence kept beta', H, "to: 'Viewers can ask it questions and it answers from your slides and documents, and it can narrate itself. Live meetings come next.'", "to: 'In beta, viewers can ask it questions.'", ['content'])
mutant('helper: moved line dropped', H, "  'Narration in one of nine stock voices, fitted to your time',\n", '', ['content'])
mutant('helper: lines move the wrong way', H, "STUDIO_UAT_LANDING_MOVED_LINES, 'beta', 'live')", "STUDIO_UAT_LANDING_MOVED_LINES, 'live', 'beta')", ['helper', 'content'])
mutant('helper: moved lines lost', H, 'items: [...column.items, ...moving] }', 'items: column.items }', ['helper', 'content'])
mutant('helper: moved lines kept in beta', H, 'items: column.items.filter(item => !moving.includes(item)) }', 'items: column.items }', ['helper', 'content'])
mutant('helper: content ruling skips the lines', H, 'if (story && Array.isArray(story.columns)) story.columns =', 'if (false) story.columns =', ['helper', 'content'])
mutant('helper: content mutated in place', H, 'return (rules.length === 0 ? value : walk(value)) as T', 'return (rules.length === 0 ? value : (Object.assign(value as object, walk(value) as object))) as T', ['helper'])
mutant('helper: pill needs exact text only', H, 'return features.find(line => /knowledge graph/i.test(line)) ?? null', 'return null', ['helper'])
mutant('helper: pill on any plan', H, 'if (!betaFeature) return null', '', ['helper'])
mutant('helper: pill matches case-sensitively', H, '/knowledge graph/i.test(line)', '/knowledge graph/.test(line)', ['helper'])
mutant('helper: menu toggle stuck', H, "if (event === 'toggle') return !open", "if (event === 'toggle') return true", ['helper'])
mutant('helper: outside press keeps it open', H, "event === 'outside' ||", '', ['helper'])
mutant('helper: choosing keeps it open', H, "event === 'choose' ||", '', ['helper'])
mutant('helper: a new page keeps it open', H, "|| event === 'route') return false", ") return false", ['helper'])
mutant('helper: focus returns after outside press', H, "return event === 'escape'", "return event === 'escape' || event === 'outside'", ['helper'])
mutant('helper: Esc spelling accepted', H, "return key === 'Escape' ? 'escape' : null", "return key === 'Escape' || key === 'Esc' ? 'escape' : null", ['helper'])
mutant('helper: imports something', H, '// UAT MARKETING PORT', "import fs from 'node:fs'\n// UAT MARKETING PORT", ['helper'])
mutant('helper: stills folder moved', H, "'/marketing/v3-uat/slides/'", "'/marketing/v3/slides/'", ['helper'])
const R = 'app/(marketing-v3)'
mutant('dispatch: layout flag loose', `${R}/layout.tsx`, 'if (process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true") {', 'if (process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING !== "false") {', ['dispatch', 'identity'])
mutant('dispatch: layout flag truthy', `${R}/layout.tsx`, 'if (process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true") {', 'if (process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING) {', ['dispatch', 'identity'])
mutant('dispatch: layout shell not an import()', `${R}/layout.tsx`, 'const { UatMarketingShell } = await import("@/components/marketing/v3-uat/shell")', 'const { UatMarketingShell } = require("@/components/marketing/v3-uat/shell")', ['dispatch'])
mutant('dispatch: layout loses the fonts', `${R}/layout.tsx`, 'fonts={`${display.variable} ${body.variable} ${human.variable} ${mono.variable} ${slide.variable}`}', 'fonts=""', ['dispatch'])
mutant('dispatch: layout drops the UAT sheet', `${R}/layout.tsx`, 'import "@/styles/marketing-v3-uat.css"\n', '', ['dispatch', 'css'])
mutant('dispatch: layout sheet before the base sheet', `${R}/layout.tsx`, 'import "@/styles/marketing-v3.css"\n// NEXT_PUBLIC_STUDIO_UAT_MARKETING: UAT', 'import "@/styles/marketing-v3-uat.css"\nimport "@/styles/marketing-v3.css"\n// NEXT_PUBLIC_STUDIO_UAT_MARKETING: UAT', ['dispatch'])
for (const [file, spec] of Object.entries(DEV_PAGES)) {
  mutant(`dispatch: ${spec.name} flag loose`, file, 'process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true") {', 'process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING !== "false") {', ['dispatch', 'identity'])
  mutant(`dispatch: ${spec.name} metadata flag loose`, file, `process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true" ? uatMarketingMetadata.${spec.name}`, `process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING !== "false" ? uatMarketingMetadata.${spec.name}`, ['dispatch', 'identity'])
  mutant(`dispatch: ${spec.name} page is not an import()`, file, `await import("@/components/marketing/v3-uat/pages/${spec.name}")`, `require("@/components/marketing/v3-uat/pages/${spec.name}")`, ['dispatch'])
  mutant(`dispatch: ${spec.name} serves another page's metadata`, file, `uatMarketingMetadata.${spec.name}`, `uatMarketingMetadata.${spec.name === 'home' ? 'about' : 'home'}`, ['dispatch', 'identity'])
}
for (const [file, spec] of Object.entries(GOVERNED)) {
  mutant(`dispatch: ${spec.name} flag always on`, file, 'studioUatMarketing.on ? uatMarketingMetadata', 'true ? uatMarketingMetadata', ['dispatch', 'identity'])
  mutant(`dispatch: ${spec.name} page always UAT`, file, 'if (studioUatMarketing.on) return', 'if (true) return', ['dispatch', 'identity'])
  mutant(`dispatch: ${spec.name} reads the env directly`, file, 'studioUatMarketing.on ? uatMarketingMetadata', 'process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true" ? uatMarketingMetadata', ['dispatch', 'identity'])
}
mutant('flag module: loose', 'components/marketing/v3-uat/flag.ts', 'studioUatMarketingOn(process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING)', 'process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING !== undefined', ['dispatch'])
mutant('share card: flag loose', 'app/opengraph-image.tsx', 'process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true"', 'process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING !== "false"', ['dispatch'])
mutant('share card: JPEG served as PNG', 'app/opengraph-image.tsx', 'STUDIO_UAT_MARKETING ? "image/jpeg" : "image/png"', '"image/png"', ['dispatch'])
mutant('share card: old line kept on', 'app/opengraph-image.tsx', 'STUDIO_UAT_MARKETING ? "Deckster — Your knowledge. Your decks. Your voice." :', '', ['dispatch'])
mutant('sitemap: reachable with the flag off', 'app/sitemap.ts', 'process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING !== "true") notFound()', 'false) notFound()', ['dispatch'])
mutant('sitemap: flag loose', 'app/sitemap.ts', 'process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING !== "true"', 'process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "false"', ['dispatch'])
const C = 'styles/marketing-v3-uat.css'
mutant('css: a rule loses its scope', C, '.mv3:where(.mv3-uat) .hdr{background:rgba(12,13,19,.94)}', '.mv3 .hdr{background:rgba(12,13,19,.94)}', ['css'])
mutant('css: scope adds specificity', C, '.mv3:where(.mv3-uat) .wm{', '.mv3.mv3-uat .wm{', ['css'])
mutant('css: bare html rule', C, '.v3-spot{position:fixed', 'html{position:fixed', ['css'])
mutant('css: xchg restatement lost', C, '@media (max-width:900px){.mv3:where(.mv3-uat) .xchg{right:16px;width:auto}}', '', ['css'])
mutant('css: voice label colour lost', C, '.mv3:where(.mv3-uat) .player__voice--live{border-color:var(--st-live);color:var(--st-live)}', '', ['css'])
mutant('css: a declaration drifts', C, '.mv3:where(.mv3-uat) .st--live{color:var(--st-live)}', '.mv3:where(.mv3-uat) .st--live{color:var(--st-beta)}', ['css'])
mutant('css: not marked generated', C, 'GENERATED by scripts/studio-uat-marketing-port.mjs', 'written by hand', ['css'])
const HDR = 'components/marketing/v3-uat/HeaderV3.tsx'
mutant('header: outside press ignored', HDR, 'send("outside")', 'send("toggle")', ['header'])
mutant('header: inside press closes', HDR, 'if (target && headerRef.current?.contains(target)) return', 'if (!target) return', ['header'])
mutant('header: Escape does not return the focus', HDR, 'if (studioUatMenuRestoresFocus(event)) buttonRef.current?.focus()', '', ['header'])
mutant('header: pointerdown listener leaks', HDR, 'document.removeEventListener("pointerdown", onPress)', '', ['header'])
mutant('header: key listener leaks', HDR, 'window.removeEventListener("keydown", onKey)', '', ['header'])
mutant('header: choosing a link keeps it open', HDR, 'onClick={() => send("choose")}', 'onClick={() => undefined}', ['header'])
mutant('header: a new page keeps it open', HDR, 'useEffect(() => { setOpen(false) }, [pathname])', '', ['header'])
mutant('header: button does not toggle', HDR, 'send("toggle")', 'send("choose")', ['header'])
mutant('header: loses the runtime marker', HDR, '<header ref={headerRef} className="hdr" data-v3-header>', '<header ref={headerRef} className="hdr">', ['header'])
mutant('header: Pass 2 menu mounted too', HDR, 'import { trackCta } from "@/lib/analytics"\n', 'import { trackCta } from "@/lib/analytics"\nimport { HeaderMenuP2 } from "@/components/marketing/v3/HeaderMenuP2"\n', ['header'])
mutant('bits: film pill fixed to Beta', 'components/marketing/v3-uat/HeroFilm.tsx', '<span className={`st st--${betaStatus} st--sm`}>{betaWord}</span>', '<span className="st st--beta st--sm">{betaWord}</span>', ['bits'])
mutant('bits: hero ignores narration status', 'components/marketing/v3-uat/home/Start.tsx', 'betaStatus={statusOf("narration").status}', 'betaStatus="beta"', ['bits'])
mutant('bits: voice label ignores status', 'components/marketing/v3-uat/home/Present.tsx', 'player__voice--${statusOf("narration").status}', 'player__voice--beta', ['bits'])
mutant('bits: pricing page ignores the shared plan words', 'components/marketing/v3-uat/pages/pricing.tsx', 'studioLandingTiers(copy.start.tiers, PRICING_TIERS, STUDIO_P2_ACCOUNT)', 'copy.start.tiers', ['bits'])
mutant('bits: pricing home flag loose', 'components/marketing/v3-uat/home/Pricing.tsx', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT !== "false"', ['bits'])
mutant('bits: pill needs the exact text again', 'components/marketing/v3-uat/home/Pricing.tsx', 'feature === studioUatBetaLine(tier.features, tier.betaFeature)', 'feature === tier.betaFeature', ['bits'])
mutant('bits: footer drops the Docs links', 'components/marketing/v3-uat/FooterV3.tsx', 'STUDIO_P2_DOCS ? studioDocsFooterLinks(V3_CONTENT.footer.links) : V3_CONTENT.footer.links', 'V3_CONTENT.footer.links', ['bits'])
mutant('bits: footer flag loose', 'components/marketing/v3-uat/FooterV3.tsx', 'process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === "true"', 'process.env.NEXT_PUBLIC_STUDIO_P2_DOCS !== "false"', ['bits'])
mutant('bits: hook loses the night class', 'hooks/use-v3-deck-uat.ts', 'if (STUDIO_P2_LANDING) html.classList.add(STUDIO_P2_NIGHT_CLASS)', '', ['bits'])
mutant('bits: hook leaves the paper marker behind', 'hooks/use-v3-deck-uat.ts', 'html.classList.remove("mv3-page", "mv3-on-paper")', 'html.classList.remove("mv3-page")', ['bits'])
mutant('bits: runtime calls the unflagged hook', 'components/marketing/v3-uat/V3Runtime.tsx', 'useV3DeckUat()', 'useV3Deck()', ['bits'])
mutant('bits: view skips the ruling for statuses', 'lib/marketing/v3-uat-view.ts', 'studioUatFeatures<Record<V3Feature, V3Status>>(UAT_FEATURES, STUDIO_P2_LANDING)', 'UAT_FEATURES', ['bits'])
mutant('bits: view skips the ruling for the copy', 'lib/marketing/v3-uat-view.ts', 'studioUatContent(UAT_CONTENT, STUDIO_P2_LANDING)', 'UAT_CONTENT', ['bits'])
mutant('bits: shell without the pointer light', 'components/marketing/v3-uat/shell.tsx', '      <V3Spotlight />\n', '', ['bits'])
mutant('bits: shell keeps the arrows', 'components/marketing/v3-uat/shell.tsx', '      {children}\n', '      {children}\n      <SlideNavArrows />\n', ['bits'])
mutant('copies: a page edited by hand', 'components/marketing/v3-uat/pages/about.tsx', 'export function UatAboutPage()', 'export function UatAboutPage_()', ['copies'])
mutant('copies: content drifts', 'lib/marketing/v3-uat-content.ts', 'Request access', 'Request early access', ['copies'])
mutant('copies: unflagged still referenced', 'components/marketing/v3-uat/home/Gallery.tsx', '/marketing/v3-uat/slides/deck-', '/marketing/v3/slides/deck-', ['copies'])
mutant('copies: UAT copy points at the unflagged content', 'components/marketing/v3-uat/StatusPill.tsx', '@/lib/marketing/v3-uat-view', '@/lib/marketing/v3-content', ['copies'])
mutant('copies: the rail drifts', 'components/marketing/SnapDeck/SlideProgressRail.tsx', 'chapterStart &&', 'false &&', ['copies'])
mutant('identity: a dispatch edit left in the base file', `${R}/present/page.tsx`, 'export default function PresentPage() {', 'export default function PresentPage() { /* x */', ['identity'])
mutant('identity: pricing page gains a stray line', `${R}/pricing/page.tsx`, 'const copy = V3_CONTENT.pages.pricing\n', 'const copy = V3_CONTENT.pages.pricing\nconst extra = 1\n', ['identity'])
mutant('env: flag documented as on', '.env.example', `${FLAG}="false"`, `${FLAG}="true"`, ['env'])
mutant('env: flag documented twice', '.env.example', `${FLAG}="false"\n`, `${FLAG}="false"\n${FLAG}="false"\n`, ['env'])
mutant('env: block loses the logo note', '.env.example', '# NOT behind this flag', '# not behind', ['env'])
mutant('env: uses the earlier flags\' phrase', '.env.example', 'Only the value true turns it on;', 'exact "true" enables it;', ['env'])
mutant('env: script renamed', 'package.json', '"test:studio-uat-marketing": "node scripts/test-studio-uat-marketing.mjs"', '"test:studio-uat-marketing-x": "node scripts/test-studio-uat-marketing.mjs"', ['env'])
mutant('env: another script changed', 'package.json', '"test:studio-p2-landing": "node scripts/test-studio-p2-landing.mjs"', '"test:studio-p2-landing": "node scripts/test-studio-p2-landing.mjs --x"', ['env'])
mutant('env: analytics type dropped', 'lib/analytics.ts', '  | "v3_menu"\n', '', ['env'])

const runners = {
  helper: s => proveHelper(s[H], 'mutant'),
  content: s => proveContent(s[H], s['lib/marketing/v3-uat-content.ts'], 'mutant'),
  copies: s => proveCopies(s, 'mutant'),
  identity: s => proveIdentity(s, 'mutant'),
  css: s => proveCss(s[C], 'mutant'),
  header: s => proveHeader(s[HDR], 'mutant'),
  bits: s => proveBits(s, 'mutant'),
  env: s => proveEnv(s, 'mutant'),
}
// the dispatch proofs are async (the pages' UAT branch is an import()), so they are run to completion in the loop below
let killed = 0
const survivors = []
for (const m of MUTANTS) {
  const sources = mutated(m.file, m.from, m.to)
  let caught = false
  for (const proof of m.proofs) {
    if (proof === 'dispatch') {
      const found = await (async () => { const was = failures; failures = []; try { await proveDispatch(sources, 'mutant') } catch (error) { failures.push(`threw: ${error.message}`) } const result = failures; failures = was; return result })()
      if (found.length) caught = true
    } else if (collect(() => runners[proof](sources)).length) caught = true
    if (caught) break
  }
  if (caught) killed++; else survivors.push(m.name)
}
if (survivors.length) { console.error(`survivors: ${survivors.join('; ')}`); process.exit(1) }
console.log(`Studio UAT marketing port: ${realChecks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
