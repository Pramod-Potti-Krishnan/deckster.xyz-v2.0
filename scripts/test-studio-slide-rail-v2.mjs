// PASS2 rail v2: the Studio slide rail as in the accepted v4 mockup (readable labels, real slide thumbnails)
// (flag NEXT_PUBLIC_STUDIO_SLIDE_RAIL_V2, default off).
// Offline and self-contained: no network, no browser. The repo root is found from this file (package.json anchor).
// It covers the flag (exact "true"), the live-preview slot cap (3 off, 12 on), the real strip server-rendered (flag off = the
// base commit's strip byte for byte over a matrix of cases; flag on = exactly three markup changes), the viewer's default rail
// width, the CSS (every v2 rule is scoped to the strip's v2 attribute, so it is inert while the flag is off) and .env.example.
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

const FLAG = 'NEXT_PUBLIC_STUDIO_SLIDE_RAIL_V2'
const LIVE_FLAG = 'NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED'
/** The commit this feature was built on (studio-v4-dev-preparation-code at #357): the flag-off strip must render exactly as it did. */
const BASE_COMMIT = '68e3396'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ---------------------------------------------------------------- loader: transpile-on-require, repo files only
const transpiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!transpiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile`)
    transpiled.set(key, out.outputText)
  }
  return transpiled.get(key)
}
/** `overrides`: repo-relative path -> source text (a missing file may be supplied this way); `stubs`: specifier -> module. */
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

// ---------------------------------------------------------------- the flag module
{
  const make = env => createWorld({ env }).load('lib/studio-slide-rail-v2.ts')
  const lib = make({})
  check(assert.equal, lib.STUDIO_SLIDE_RAIL_V2, false, 'default off')
  for (const value of ['', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'false', 'on'])
    check(assert.equal, make({ [FLAG]: value }).STUDIO_SLIDE_RAIL_V2, false, `flag "${value}" is off`)
  check(assert.equal, make({ [FLAG]: 'true' }).STUDIO_SLIDE_RAIL_V2, true, 'exact "true" is on')
  check(assert.equal, lib.SLIDE_RAIL_V2_DEFAULT_WIDTH, 140, 'the mockup rail width')
  check(assert.equal, lib.SLIDE_RAIL_V2_MAX_FRAMES, 12)
  for (const [n, text] of [[1, '01'], [9, '09'], [10, '10'], [62, '62'], [120, '120']])
    check(assert.equal, lib.slideRailV2Number(n), text, `number ${n}`)
}

// ---------------------------------------------------------------- the live-preview slot cap
{
  const pool = env => createWorld({ env }).load('lib/rail-live-preview.ts')
  const off = pool({ [LIVE_FLAG]: 'true' })
  check(assert.equal, off.railPreviewSlots.max, 3, 'flag off: the F9-A cap of three')
  check(assert.equal, off.RAIL_LIVE_PREVIEW_MAX_FRAMES, 3)
  check(assert.equal, pool({ [FLAG]: 'TRUE' }).railPreviewSlots.max, 3, 'only exact "true" lifts it')
  const on = pool({ [LIVE_FLAG]: 'true', [FLAG]: 'true' })
  check(assert.equal, on.railPreviewSlots.max, 12, 'flag on: twelve')
  check(assert.equal, on.RAIL_LIVE_PREVIEW_MAX_FRAMES, 3, 'the F9-A constant itself is unchanged')
  // the pool still queues past the cap, and still hands a freed slot to the first waiter
  const granted = []
  const tickets = Array.from({ length: 14 }, (_, i) => on.railPreviewSlots.request(() => granted.push(i)))
  check(assert.equal, on.railPreviewSlots.active, 12)
  check(assert.equal, on.railPreviewSlots.waiting, 2)
  tickets[0].release()
  check(assert.deepEqual, granted, Array.from({ length: 13 }, (_, i) => i), 'the 13th card gets the freed slot, the 14th still waits')
  for (const t of tickets) t.release()
  check(assert.equal, on.railPreviewSlots.active, 0)
}

// ---------------------------------------------------------------- the real strip, server-rendered
function baseSource(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
    return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return null
  }
}
const VIEWER_URL = 'https://layout.uat.test/p/pres-1'
function stripWorld({ env = {}, overrides = {} } = {}) {
  const policy = createWorld().load('lib/layout-viewer-url-policy.ts').createLayoutViewerUrlPolicy('https://layout.uat.test', '')
  const stubs = {
    '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: policy },
    // the live frame is the F9-A component (covered by its own suite); a marker shows where the strip mounts it
    './rail-live-preview': { RailLivePreview: props => React.createElement('i', {
      'data-stub-live': 'true', 'data-index': String(props.slideIndex), 'data-status': props.status }) },
  }
  return createWorld({ env, overrides, stubs }).load('components/slide-thumbnail-strip.tsx').SlideThumbnailStrip
}
const ROWS = [
  { slideNumber: 1, slideId: 's1', title: 'AI Demand Forecasting for Retail', thumbnailUrl: 'https://proj.test/a.png', thumbnailStatus: 'fresh' },
  { slideNumber: 2, slideId: 's2', title: 'Traditional Retail Forecasting Relies on Backward-Looking Manual Methods', thumbnailStatus: 'pending' },
  { slideNumber: 3, slideId: 's3', title: 'Slide 3', thumbnailStatus: 'none' },
  { slideNumber: 4, slideId: 's4', title: 'Stale', thumbnailStatus: 'stale' },
  { slideNumber: 5, slideId: 's5', title: 'Legacy row' },
  { slideNumber: 6, slideId: 's6' },
  { slideNumber: 7, slideId: 's7', title: 'Seven', thumbnailStatus: 'none' },
  { slideNumber: 8, slideId: 's8', title: 'Eight', thumbnailUrl: 'https://proj.test/c.png', thumbnailStatus: 'pending' },
  { slideNumber: 9, slideId: 's9', title: 'Nine', thumbnailStatus: 'none' },
  { slideNumber: 10, slideId: 's10', title: 'Ten & <eleven>', thumbnailStatus: 'none' },
]
const noop = () => {}
const asyncNoop = async () => {}
const CASES = [
  ['plain', {}],
  ['current 3, selection', { currentSlide: 3, selectedSlides: [2, 4] }],
  ['crud + refine + viewer url', { onDuplicateSlide: asyncNoop, onDeleteSlide: noop, onDeleteSlides: noop, onChangeLayout: asyncNoop,
    onReorderSlides: asyncNoop, enableDragDrop: true, onRefineSlide: noop, keyBySlideId: true, livePreviewViewerUrl: VIEWER_URL }],
  ['compose and refine jobs', { onRefineSlide: noop, livePreviewViewerUrl: VIEWER_URL, composeJobs: [
    { jobId: 'j1', targetIndex: 1, targetLayoutIndex: 1, status: 'building', lastProgressText: 'Writing' },
    { jobId: 'j2', targetIndex: 4, status: 'error', title: 'Failed', errors: ['boom'], onRetry: noop, onDismiss: noop, failureCaption: 'Could not build' },
    { jobId: 'r1', kind: 'refine', targetIndex: 2, targetSlideId: 's3', status: 'building', lastProgressText: 'Refining' },
    { jobId: 'r2', kind: 'refine', targetIndex: 6, targetSlideId: 's7', status: 'error', errors: ['refine failed'] },
  ] }],
  ['horizontal', { orientation: 'horizontal' }],
]
const render = (Strip, extra) => renderToStaticMarkup(React.createElement(Strip, {
  slides: ROWS, currentSlide: 1, onSlideClick: noop, orientation: 'vertical', totalSlides: ROWS.length, ...extra }))
const ENVS = [
  ['studio + both rail flags', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [LIVE_FLAG]: 'true', NEXT_PUBLIC_STUDIO_RAIL_SLIDE_IDENTITY_ENABLED: 'true' }],
  ['studio only', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }],
  ['classic', {}],
]

const base = { strip: baseSource('components/slide-thumbnail-strip.tsx'), lib: baseSource('lib/rail-live-preview.ts') }
if (base.strip && base.lib) {
  // flag off, and flag on without the Studio shell: the base commit's strip, byte for byte
  const baseOverrides = { 'components/slide-thumbnail-strip.tsx': base.strip, 'lib/rail-live-preview.ts': base.lib }
  let compared = 0
  for (const [envName, env] of ENVS) {
    const Base = stripWorld({ env, overrides: baseOverrides })
    const variants = [['unset', env], ['"false"', { ...env, [FLAG]: 'false' }], ['"TRUE"', { ...env, [FLAG]: 'TRUE' }]]
    if (env.NEXT_PUBLIC_STUDIO_V4_SHELL !== 'true') variants.push(['"true" without the Studio shell', { ...env, [FLAG]: 'true' }])
    for (const [flagName, flagEnv] of variants) {
      const Work = stripWorld({ env: flagEnv })
      for (const [caseName, extra] of CASES) {
        check(assert.equal, render(Work, extra), render(Base, extra), `${envName}, flag ${flagName}, ${caseName}: identical to ${BASE_COMMIT}`)
        compared++
      }
    }
  }
  console.log(`  flag-off strip == ${BASE_COMMIT} strip in ${compared} renders`)
} else {
  console.log(`  SKIP base-commit identity: ${BASE_COMMIT} is not in this clone (the flag-off checks below still run)`)
}

// flag on: exactly three markup changes, in the Studio shell only
for (const [envName, env] of ENVS.filter(([, e]) => e.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true')) {
  const Off = stripWorld({ env })
  const On = stripWorld({ env: { ...env, [FLAG]: 'true' } })
  for (const [caseName, extra] of CASES) {
    const off = render(Off, extra)
    const on = render(On, extra)
    const label = `${envName}, ${caseName}`
    check(assert.equal, (on.match(/data-studio-rail-v2="true"/g) ?? []).length, 1, `${label}: the strip root carries the v2 attribute`)
    check(assert.doesNotMatch, off, /data-studio-rail-v2/, `${label}: flag off has none`)
    // undo the three changes: the root attribute, the padded number, the title's tooltip
    const undone = on
      .replace(' data-studio-rail-v2="true"', '')
      .replace(/(<span class="flex-none[^"]*">)0(\d)(<\/span>)/g, '$1$2$3')
      .replace(/<span title="[^"]*" class="(min-w-0 text-\[10px\])/g, '<span class="$1')
    check(assert.equal, undone, off, `${label}: nothing else differs`)
  }
}
{
  const On = stripWorld({ env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [LIVE_FLAG]: 'true', [FLAG]: 'true' } })
  const html = render(On, { livePreviewViewerUrl: VIEWER_URL })
  const cards = html.split('data-studio-thumbnail-card="true"').slice(1)
  check(assert.equal, cards.length, 10)
  const numbers = cards.map(card => card.match(/<span class="flex-none[^"]*">([^<]+)<\/span>/)?.[1])
  check(assert.deepEqual, numbers, ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'], 'two-digit numbers, as in the mockup')
  check(assert.match, cards[1], /<span title="Traditional Retail Forecasting Relies on Backward-Looking Manual Methods" class="min-w-0 text-\[10px\]/, 'the full title is the tooltip')
  check(assert.match, cards[2], /<span title="Slide 3" class="min-w-0/, 'a "Slide N" title stays "Slide N"')
  check(assert.match, cards[5], /<span title="Slide 6" class="min-w-0/, 'a missing title is "Slide N"')
  check(assert.match, cards[9], /<span title="Ten &amp; &lt;eleven&gt;"/, 'escaped like any attribute')
  // the live frames are the F9-A ones, on the same cards as before
  const live = cards.map(card => card.includes('data-stub-live'))
  check(assert.deepEqual, live, [false, true, true, true, false, false, true, false, true, true], 'none, pending or stale without an image')
  check(assert.match, cards[0], /<img[^>]+src="https:\/\/proj\.test\/a\.png"/, 'a real thumbnail is still the image')
}

// ---------------------------------------------------------------- the viewer's default rail width
{
  const viewer = read('components/presentation-viewer.tsx')
  check(assert.match, viewer, /^import \{ STUDIO_SLIDE_RAIL_V2, SLIDE_RAIL_V2_DEFAULT_WIDTH \} from '@\/lib\/studio-slide-rail-v2'$/m)
  check(assert.equal, (viewer.match(/useState\(STUDIO_SLIDE_RAIL_V2 \? SLIDE_RAIL_V2_DEFAULT_WIDTH : 120\)/g) ?? []).length, 1, 'flag off keeps 120')
  check(assert.doesNotMatch, viewer, /useState\(120\)/, 'no other default')
  check(assert.match, viewer, /const clampThumbnailWidth = \(width: number\) => Math\.max\(96, Math\.min\(180, Math\.round\(width\)\)\)/, 'the drag range is unchanged')
  check(assert.match, viewer, /localStorage\.getItem\(thumbnailPreferenceKey\)/, 'a remembered width still wins')
}

// ---------------------------------------------------------------- CSS: every v2 rule is scoped to the v2 attribute
{
  const css = read('components/studio-thumbnails.css')
  const marker = css.indexOf('/* PASS2 rail v2')
  check(assert.ok, marker > 0, 'the v2 block is marked')
  check(assert.doesNotMatch, css.slice(0, marker), /rail-v2/, 'nothing before the block mentions v2')
  const block = css.slice(marker).replace(/\/\*[\s\S]*?\*\//g, '')
  const selectors = []
  for (const match of block.matchAll(/([^{}]+)\{/g)) {
    const head = match[1].trim()
    if (!head || head.startsWith('@media')) continue
    selectors.push(...head.split(/,(?![^(]*\))/).map(s => s.trim()))
  }
  check(assert.ok, selectors.length >= 12, `found ${selectors.length} v2 selectors`)
  for (const selector of selectors) check(assert.match, selector, /^\[data-studio-rail-v2="true"\] /, `scoped: ${selector}`)
  check(assert.match, block, /\[data-studio-rail-v2="true"\] \[data-studio-rail-live-preview\] \{ top: 24px; \}/, 'the live frame sits under the 24 px label row')
  check(assert.match, block, /\[data-studio-thumbnail-caption="true"\] \{ order: -1;[^}]*height: 24px;/, 'the label row is on top and 24 px tall')
}

// ---------------------------------------------------------------- .env.example
check(assert.match, read('.env.example'), /^NEXT_PUBLIC_STUDIO_SLIDE_RAIL_V2="false"$/m, 'documented in .env.example, default off')

console.log(`Studio slide rail v2: ${checks} checks passed; no network.`)
