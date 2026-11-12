// PASS2B G20 (FRONTEND-2): an untitled slide in the Studio slide rail reads as its layout's friendly name, as the accepted v4 mockup's rail does
// ("Hero title", "Metrics grid"), instead of "Slide N". Flag NEXT_PUBLIC_STUDIO_RAIL_LAYOUT_LABELS (exact "true", Studio shell only), default off.
//
// Run: node scripts/test-studio-rail-layout-labels.mjs   (plain node: transpile, no network, no browser, no env)
//   RAIL_LAYOUT_LABELS_BASE=<commit> overrides the base commit the flag-off identity is checked against (default a2e14da, the head this was built on).
//
// Proven on the REAL lib/studio-rail-layout-label.ts, lib/slide-rail-identity.ts and components/slide-thumbnail-strip.tsx:
//   1. the flag is exact "true" and nothing else;
//   2. the name map: catalogue ids, the inventory's series codes, the retired L-codes; anything unknown is null (never a raw id);
//   3. rows: flag off = the base commit's rows exactly (no layout key); flag on = the same rows plus `layout`, only when the inventory names one;
//   4. the real strip server-rendered: flag off = the base commit's strip byte for byte over a matrix of cases and envs; flag on = only the label
//      of an untitled row differs, a titled row never changes, an unknown layout keeps "Slide N", the refine target keeps its old title;
//   5. mutation check: every mutant of the three sources is killed by sections 2-4.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')

const FLAG = 'NEXT_PUBLIC_STUDIO_RAIL_LAYOUT_LABELS'
const BASE_COMMIT = process.env.RAIL_LAYOUT_LABELS_BASE || 'a2e14da'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ---------------------------------------------------------------- loader: transpile-on-require, repo files only
function compile(rel, source) {
  const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
  const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, `${rel} does not transpile`)
  return out.outputText
}
function createWorld({ env = {}, overrides = {}, stubs = {} } = {}) {
  const cache = new Map()
  const exists = rel => rel in overrides || (fs.existsSync(path.join(repoRoot, rel)) && fs.statSync(path.join(repoRoot, rel)).isFile())
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (exists(base + ext) && /\.tsx?$/.test(base + ext)) return base + ext
    throw new Error(`unresolved ${spec} from ${fromRel}`)
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const source = rel in overrides ? overrides[rel] : read(rel)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(spec, rel))
      return nodeRequire(spec)
    }
    new Function('module', 'exports', 'require', 'process', compile(rel, source))(module, module.exports, require, { env })
    return module.exports
  }
  return { load }
}
function baseSource(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
    return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch { return null }
}

const LABEL_LIB = 'lib/studio-rail-layout-label.ts'
const ROWS_LIB = 'lib/slide-rail-identity.ts'
const STRIP = 'components/slide-thumbnail-strip.tsx'
const SOURCES = { [LABEL_LIB]: read(LABEL_LIB), [ROWS_LIB]: read(ROWS_LIB), [STRIP]: read(STRIP) }
const plain = value => JSON.parse(JSON.stringify(value))

// ---------------------------------------------------------------- 1. the flag
{
  const make = env => createWorld({ env }).load(LABEL_LIB)
  check(assert.equal, make({}).STUDIO_RAIL_LAYOUT_LABELS, false, 'default off')
  for (const value of ['', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'false', 'on'])
    check(assert.equal, make({ [FLAG]: value }).STUDIO_RAIL_LAYOUT_LABELS, false, `flag "${value}" is off`)
  check(assert.equal, make({ [FLAG]: 'true' }).STUDIO_RAIL_LAYOUT_LABELS, true, 'exact "true" is on')
}

// ---------------------------------------------------------------- 2. the name map
const NAMES = {
  // the catalogue ids the picker and the rail's "Change layout" menu use
  'H1-generated': 'Title', 'H1-structured': 'Title', 'H2-section': 'Section Divider', 'H3-closing': 'Closing',
  'C1-text': 'Text', 'C3-chart': 'Chart', 'C4-infographic': 'Infographic', 'C5-diagram': 'Diagram',
  'V1-image-text': 'Image + Text', 'V2-chart-text': 'Chart + Text', 'V3-diagram-text': 'Diagram + Text', 'V4-infographic-text': 'Infographic + Text',
  'I1-image-left': 'Image Left', 'I2-image-right': 'Image Right', 'I3-image-left-narrow': 'Narrow Left', 'I4-image-right-narrow': 'Narrow Right',
  'S3-two-visuals': 'Two Visuals', 'S4-comparison': 'Comparison', 'B1-blank': 'Blank',
  // the series codes Layout's slide inventory sends (its registry ids), any case
  H1: 'Title', H1s: 'Title', H2: 'Section Divider', H3: 'Closing', C1: 'Text', C3: 'Chart', C4: 'Infographic',
  V1: 'Image + Text', V2: 'Chart + Text', V3: 'Diagram + Text', V4: 'Infographic + Text',
  I1: 'Image Left', I2: 'Image Right', I3: 'Narrow Left', I4: 'Narrow Right', S3: 'Two Visuals', S4: 'Comparison', B1: 'Blank',
  h2: 'Section Divider', c1: 'Text', ' C3 ': 'Chart', 'c1-text': 'Text',
  // the retired L-codes (components/slide-layout-picker.tsx LEGACY_LAYOUT_MAP)
  L01: 'Title', L02: 'Section Divider', L03: 'Text', L25: 'Image + Text', L27: 'Image Left', L29: 'Title', l29: 'Title',
}
const UNKNOWN = [null, undefined, '', '   ', 42, {}, [], true, 'hero', 'metrics', 'closing_slide', 'C2', 'C9', 'X1', 'H', '1', 'L99', 'H1-unknown', 'H10', 'constructor', '__proto__', 'toString']
function proveNames(lib, label) {
  const nameOf = layout => { try { return lib.railLayoutName(layout) } catch (error) { return assert.fail(`${label}: ${JSON.stringify(layout)} threw ${error}`) } }
  for (const [layout, name] of Object.entries(NAMES)) assert.equal(nameOf(layout), name, `${label}: ${JSON.stringify(layout)} -> ${name}`)
  for (const layout of UNKNOWN) assert.equal(nameOf(layout), null, `${label}: ${JSON.stringify(layout)} has no name`)
}
proveNames(createWorld().load(LABEL_LIB), 'real'); checks++
{
  // every catalogue entry has a name, and the names are the catalogue's own labels (minus a trailing "(AI)" / "(Manual)")
  const elements = createWorld().load('types/elements.ts')
  const lib = createWorld().load(LABEL_LIB)
  check(assert.equal, elements.SLIDE_LAYOUTS.length, 19, 'the catalogue the map is built from has 19 layouts')
  for (const { layout, label } of elements.SLIDE_LAYOUTS)
    check(assert.equal, lib.railLayoutName(layout), label.replace(/\s*\([^)]*\)\s*$/, ''), `catalogue ${layout}`)
  // the L-codes equal the picker's own map (a drift here would name a slide differently from its layout menu)
  const picker = read('components/slide-layout-picker.tsx')
  const legacy = Object.fromEntries([...picker.match(/LEGACY_LAYOUT_MAP[^{]*\{([^}]*)\}/)[1].matchAll(/'(L\d+)':\s*'([^']+)'/g)].map(m => [m[1], m[2]]))
  check(assert.ok, Object.keys(legacy).length >= 6, 'found the picker\'s legacy map')
  for (const [code, id] of Object.entries(legacy)) check(assert.equal, lib.railLayoutName(code), lib.railLayoutName(id), `${code} names the same as ${id}`)
  // the lib is the only place that knows names: the strip and the rows never spell one
  check(assert.doesNotMatch, SOURCES[STRIP], /Image \+ Text|Section Divider|'Blank'/, 'the strip spells no layout name')
}

// ---------------------------------------------------------------- 3. rows
const INVENTORY = {
  presentationId: 'p1', slideCount: 5, slides: ['H1', 'C1', null, 'L29', 'weird'].map((layout, i) => ({
    slideId: `s${i + 1}`, slideIndex: i, layout, contentVersion: 'v1', thumbnailUrl: i === 0 ? 'https://proj.test/a.png' : null,
    thumbnailStale: false, thumbnailStatus: i === 0 ? 'fresh' : 'none', title: i === 1 ? 'Real title' : null })),
}
function railRows(env, overrides = {}) {
  const world = createWorld({ env, overrides }).load(ROWS_LIB)
  return plain(world.buildRailRows(INVENTORY, new Map([['s5', 'Remembered']])))
}
const baseRowsSource = baseSource(ROWS_LIB)
const rowsOff = railRows({})
check(assert.equal, rowsOff.some(row => 'layout' in row), false, 'flag off: no row carries a layout')
for (const value of ['false', 'TRUE', '', '1']) check(assert.deepEqual, railRows({ [FLAG]: value }), rowsOff, `flag "${value}": rows as off`)
if (baseRowsSource) check(assert.deepEqual, rowsOff, railRows({}, { [ROWS_LIB]: baseRowsSource }), `flag off: the rows of ${BASE_COMMIT}`)
else console.log(`  SKIP base-commit rows identity: ${BASE_COMMIT} is not in this clone`)
const rowsOn = railRows({ [FLAG]: 'true' })
check(assert.deepEqual, rowsOn.map(row => row.layout), ['H1', 'C1', undefined, 'L29', 'weird'], 'flag on: the inventory\'s layout, only when there is one')
check(assert.deepEqual, rowsOn.map(({ layout, ...rest }) => rest), rowsOff, 'flag on: nothing else about a row changes')
check(assert.doesNotMatch, SOURCES[ROWS_LIB], /^\s*import\s/m, 'the rows lib stays import-free (its tests transpile it in a bare sandbox)')

// ---------------------------------------------------------------- 4. the real strip, server-rendered
const STRIP_ENV = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
function stripWorld({ env = {}, overrides = {} } = {}) {
  const policy = createWorld().load('lib/layout-viewer-url-policy.ts').createLayoutViewerUrlPolicy('https://layout.uat.test', '')
  const stubs = {
    '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: policy },
    './rail-live-preview': { RailLivePreview: props => React.createElement('i', { 'data-stub-live': 'true', 'data-index': String(props.slideIndex) }) },
  }
  return createWorld({ env, overrides, stubs }).load(STRIP).SlideThumbnailStrip
}
const ROWS = [
  { slideNumber: 1, slideId: 's1', title: 'A real title', layout: 'C1', thumbnailStatus: 'none' },
  { slideNumber: 2, slideId: 's2', title: 'Slide 2', layout: 'H1', thumbnailStatus: 'none' },
  { slideNumber: 3, slideId: 's3', title: 'Slide 3', layout: 'V2-chart-text', thumbnailStatus: 'none' },
  { slideNumber: 4, slideId: 's4', layout: 'S4', thumbnailStatus: 'none' },
  { slideNumber: 5, slideId: 's5', title: 'Slide 5', layout: 'weird-code', thumbnailStatus: 'none' },
  { slideNumber: 6, slideId: 's6', title: 'Slide 6', thumbnailStatus: 'none' },
  { slideNumber: 7, slideId: 's7', title: 'Slide 7', layout: 'L29', thumbnailUrl: 'https://proj.test/g.png', thumbnailStatus: 'fresh' },
  { slideNumber: 8, slideId: 's8', title: 'Titled <b>', layout: 'H2', thumbnailStatus: 'none' },
]
const noop = () => {}
const asyncNoop = async () => {}
const CASES = [
  ['plain', {}],
  ['current 3, selection', { currentSlide: 3, selectedSlides: [2, 4] }],
  ['crud + refine', { onDuplicateSlide: asyncNoop, onDeleteSlide: noop, onDeleteSlides: noop, onChangeLayout: asyncNoop, onReorderSlides: asyncNoop,
    enableDragDrop: true, onRefineSlide: noop, keyBySlideId: true }],
  ['horizontal', { orientation: 'horizontal' }],
]
const render = (Strip, extra, rows = ROWS) => renderToStaticMarkup(React.createElement(Strip, {
  slides: rows, currentSlide: 1, onSlideClick: noop, orientation: 'vertical', totalSlides: rows.length, ...extra }))
const ENVS = [
  ['studio', STRIP_ENV],
  ['studio + rail v2 + identity', { ...STRIP_ENV, NEXT_PUBLIC_STUDIO_SLIDE_RAIL_V2: 'true', NEXT_PUBLIC_STUDIO_RAIL_SLIDE_IDENTITY_ENABLED: 'true' }],
  ['classic', {}],
]
const baseStrip = baseSource(STRIP)
if (baseStrip) {
  let compared = 0
  for (const [envName, env] of ENVS) {
    const Base = stripWorld({ env, overrides: { [STRIP]: baseStrip } })
    for (const [flagName, flagEnv] of [['unset', env], ['"false"', { ...env, [FLAG]: 'false' }], ['"TRUE"', { ...env, [FLAG]: 'TRUE' }],
      ...(env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? [] : [['"true" without the Studio shell', { ...env, [FLAG]: 'true' }]])]) {
      const Work = stripWorld({ env: flagEnv })
      for (const [caseName, extra] of CASES) {
        check(assert.equal, render(Work, extra), render(Base, extra), `${envName}, flag ${flagName}, ${caseName}: identical to ${BASE_COMMIT}`)
        compared++
      }
    }
  }
  console.log(`  flag-off strip == ${BASE_COMMIT} strip in ${compared} renders`)
} else console.log(`  SKIP base-commit strip identity: ${BASE_COMMIT} is not in this clone (the flag-off checks below still run)`)

const cardsOf = html => html.split('data-studio-thumbnail-card="true"').slice(1)
const visibleLabels = html => cardsOf(html)
  .map(card => card.match(/<span (?:title="[^"]*" )?class="min-w-0 text-\[10px\][^"]*">([^<]*)<\/span>/)?.[1])
const OFF_LABELS = ['A real title', 'Slide 2', 'Slide 3', 'Slide 4', 'Slide 5', 'Slide 6', 'Slide 7', 'Titled &lt;b&gt;']
const ON_LABELS = ['A real title', 'Title', 'Chart + Text', 'Comparison', 'Slide 5', 'Slide 6', 'Title', 'Titled &lt;b&gt;']
const RENAMED = [1, 2, 3, 6]
function proveStrip(world, label = 'real', stripSource = SOURCES[STRIP]) {
  for (const [envName, env] of ENVS.filter(([, e]) => e.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true')) {
    const Off = world({ env })
    const On = world({ env: { ...env, [FLAG]: 'true' } })
    for (const [caseName, extra] of CASES) {
      const at = `${label} ${envName}, ${caseName}`
      assert.deepEqual(visibleLabels(render(Off, extra)), OFF_LABELS, `${at}: off labels`)
      assert.deepEqual(visibleLabels(render(On, extra)), ON_LABELS, `${at}: on labels (titled kept, unnamed layouts keep "Slide N")`)
      // only the renamed cards differ; the flag on with no layout on any row is the flag off, byte for byte
      const off = cardsOf(render(Off, extra)), on = cardsOf(render(On, extra))
      assert.equal(off.length, on.length, `${at}: same cards`)
      off.forEach((card, i) => { if (!RENAMED.includes(i)) assert.equal(on[i], card, `${at}: card ${i + 1} is untouched`) })
      const bare = ROWS.map(({ layout, ...row }) => row)
      assert.equal(render(On, extra, bare), render(Off, extra, bare), `${at}: flag on without any layout is the flag off`)
    }
    // the label also reaches the card's accessible name and the thumbnail's alt text, where displayTitle always went
    const on = render(On, {}), off = render(Off, {})
    assert.match(on, /aria-label="Go to slide 3: Chart \+ Text"/, `${label} ${envName}: the accessible name carries the layout name`)
    assert.match(on, /alt="Title thumbnail"/, `${label} ${envName}: the thumbnail's alt text carries it`)
    assert.doesNotMatch(off, /Chart \+ Text|Comparison/, `${label} ${envName}: flag off names no layout`)
  }
  // the classic (non-Studio) rail never takes the label
  assert.equal(render(world({ env: { [FLAG]: 'true' } }), {}), render(world({ env: {} }), {}), `${label}: classic rail unchanged with the flag on`)
  assert.match(render(world({ env: {} }), {}), /Slide 3/, `${label}: (the classic rail does draw "Slide N")`)
  // the refine target keeps the title it always had, even for a renamed row (it is a request, not a label); static markup cannot click it
  assert.match(stripSource, /slide_index: slideIndex,\s*title: baseTitle,/, `${label}: the refine target keeps the base title`)
}
proveStrip(opts => stripWorld(opts)); checks++

// ---------------------------------------------------------------- 5. mutation check
const MUTANTS = [
  [LABEL_LIB, 'flag read loosely', "=== 'true'", "!== 'false'"],
  [LABEL_LIB, 'no parenthetical strip', '.replace(/\\s*\\([^)]*\\)\\s*$/, \'\')', ''],
  [LABEL_LIB, 'legacy codes ignored', 'const legacy = LEGACY_CODES[key.toUpperCase()]', 'const legacy = undefined'],
  [LABEL_LIB, 'L29 is a section divider', "L29: 'H1-generated'", "L29: 'H2-section'"],
  [LABEL_LIB, 'case sensitive', 'const key = layout.trim().toLowerCase()', 'const key = layout.trim()'],
  [LABEL_LIB, 'no trim', 'const key = layout.trim().toLowerCase()', 'const key = layout.toLowerCase()'],
  [LABEL_LIB, 'series codes dropped', 'return series ? NAME_BY_SERIES.get(series[1]) ?? null : null', 'return null'],
  [LABEL_LIB, 'H1s dropped', '/^([a-z]\\d)s?$/', '/^([a-z]\\d)$/'],
  [LABEL_LIB, 'unknown returns the raw id', 'return series ? NAME_BY_SERIES.get(series[1]) ?? null : null', 'return series ? NAME_BY_SERIES.get(series[1]) ?? layout : layout'],
  [LABEL_LIB, 'non-string accepted', "if (typeof layout !== 'string') return null", "if (layout == null) return null"],
  [ROWS_LIB, 'rows carry layout with the flag off', '...(RAIL_LAYOUT_LABELS && row.layout ? { layout: row.layout } : {})', '...(row.layout ? { layout: row.layout } : {})'],
  [ROWS_LIB, 'rows carry an empty layout', '...(RAIL_LAYOUT_LABELS && row.layout ? { layout: row.layout } : {})', '...(RAIL_LAYOUT_LABELS ? { layout: row.layout } : {})'],
  [ROWS_LIB, 'rows flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_RAIL_LAYOUT_LABELS === 'true'", "process.env.NEXT_PUBLIC_STUDIO_RAIL_LAYOUT_LABELS !== undefined"],
  [STRIP, 'strip ignores the flag', 'STUDIO_RAIL_LAYOUT_LABELS && STUDIO_THUMBNAILS && (!slide.title', 'STUDIO_THUMBNAILS && (!slide.title'],
  [STRIP, 'strip ignores the Studio shell', 'STUDIO_RAIL_LAYOUT_LABELS && STUDIO_THUMBNAILS && (!slide.title', 'STUDIO_RAIL_LAYOUT_LABELS && (!slide.title'],
  [STRIP, 'titled rows renamed', 'STUDIO_RAIL_LAYOUT_LABELS && STUDIO_THUMBNAILS && (!slide.title || /^Slide \\d+$/i.test(slide.title)) ?', 'STUDIO_RAIL_LAYOUT_LABELS && STUDIO_THUMBNAILS ?'],
  [STRIP, 'unknown layout loses "Slide N"', 'const displayTitle = layoutTitle ?? baseTitle', "const displayTitle = layoutTitle ?? ''"],
  [STRIP, 'layout read from the wrong field', 'railLayoutName(slide.layout)', 'railLayoutName(slide.title)'],
  [STRIP, 'refine target renamed', 'title: baseTitle,', 'title: displayTitle,'],
  [STRIP, 'placeholder test dropped', 'STUDIO_THUMBNAILS && (!slide.title || /^Slide \\d+$/i.test(slide.title)) ?', 'STUDIO_THUMBNAILS && (!slide.title) ?'],
]
let killed = 0
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    const overrides = { [file]: mutated }
    if (file === LABEL_LIB) proveNames(createWorld({ overrides }).load(LABEL_LIB), name)
    if (file === ROWS_LIB) {
      const off = railRows({}, overrides), on = railRows({ [FLAG]: 'true' }, overrides)
      assert.deepEqual(off, rowsOff); assert.deepEqual(on.map(row => row.layout), ['H1', 'C1', undefined, 'L29', 'weird'])
      assert.deepEqual(railRows({ [FLAG]: 'TRUE' }, overrides), rowsOff)
    }
    proveStrip(opts => stripWorld({ ...opts, overrides }), name, file === STRIP ? mutated : SOURCES[STRIP])
    // the flag-off identity and the flag-on rows share the strip's mutants through proveStrip; the lib mutants reach it through the world too
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
check(assert.equal, killed, MUTANTS.length)

// ---------------------------------------------------------------- .env.example
check(assert.match, read('.env.example'), /^NEXT_PUBLIC_STUDIO_RAIL_LAYOUT_LABELS="false"$/m, 'documented in .env.example, default off')

console.log(`Studio rail layout labels: ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
