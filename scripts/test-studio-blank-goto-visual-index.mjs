// J2 v2 follow-up: after a Blank slide that lands past compose placeholders, the viewer navigates by VISUAL index
// (flag NEXT_PUBLIC_STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED, exact "true", default off).
//
// Offline and self-contained: no network, no git (the sources are read from the checkout this file sits in, found by walking up
// to the package.json that names this app). Covers
//   - the flag parse (exact "true" only);
//   - the persisted -> visual conversion for 0, 1 and 2 placeholders before the insert, pending (building) vs failed (error),
//     the ones that must not count (finished jobs, refine overlays), ties, clamping and both job shapes (page record, rail list),
//     against an independent picture of the rail and by round trip through the J2 v2 anchor resolver;
//   - the viewer wiring (flag off = the old index, only a resolved Blank position converts, goToSlide and the published slide
//     number use the visual index, the rail selection keeps the persisted one),
// then re-runs the suites against deliberately broken copies of the sources and fails if any copy survives.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import ts from 'typescript'

// Own anchor: the nearest package.json above this file that names the app.
function findRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (;;) {
    const manifest = path.join(dir, 'package.json')
    if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).name === 'deckster') return dir
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error('package.json of the app not found above the test')
    dir = parent
  }
}
const ROOT = findRoot()
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8')
const require = createRequire(import.meta.url)

const FLAG = 'NEXT_PUBLIC_STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED'
function compile(source) {
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
}
function load(source, { env = {}, imports = {} } = {}) {
  const module = { exports: {} }
  // Same realm as the test, so deepEqual compares plain objects.
  new Function('module', 'exports', 'process', 'require', compile(source))(module, module.exports, { env }, name => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`)
    return imports[name]
  })
  return module.exports
}

const SOURCES = {
  lib: read('lib/studio-blank-goto-visual-index.ts'),
  compose: read('lib/slide-compose-async.ts'),
  viewer: read('components/presentation-viewer.tsx'),
  submit: read('lib/studio-add-slide-v2-submit.ts'),
}
const ADD_SLIDE_V2 = read('lib/studio-add-slide-v2.ts')
const ELEMENT_TIMEOUT = read('lib/element-generation-timeout.ts')
const COMPOSE_HELPERS = read('components/slide-generation-panel/compose-helpers.ts')

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

function modules(sources, env = { [FLAG]: 'true' }) {
  const compose = load(sources.compose)
  const lib = load(sources.lib, { env, imports: { '@/lib/slide-compose-async': compose } })
  return { compose, lib }
}

// ---- Independent picture of the rail ------------------------------------------------------------------------------
// Real slides 0..n-1 and placeholders, each placeholder drawn right before the real slide it targets (n = after the last one),
// earlier job first on a tie. Written without the app's own ordering code so it can disagree with it.
const target = job => Math.max(0, Number(job.target_layout_index ?? job.targetLayoutIndex ?? job.targetIndex ?? 0))
const takesASlot = job => job.kind !== 'refine' && (job.status === 'building' || job.status === 'error')
function picture(n, jobs) {
  const list = Object.values(jobs).filter(takesASlot)
  const items = []
  for (let slot = 0; slot <= n; slot += 1) {
    for (const job of list) if (Math.min(target(job), n) === slot) items.push('P')
    if (slot < n) items.push(slot)
  }
  return items
}
const visualOf = (n, jobs, persisted) => picture(n, jobs).indexOf(persisted)

const job = (at, over = {}) => ({ kind: 'compose', status: 'building', target_layout_index: at, ...over })
// The rail's shape (page.tsx slideComposeThumbnailJobs): a list with jobId / targetIndex / targetLayoutIndex.
const railJob = (at, over = {}) => ({ jobId: `job-${at}-${over.status ?? 'building'}`, targetIndex: at, targetLayoutIndex: at, kind: 'compose', status: 'building', ...over })

function convert(mods, persistedIndex, realSlideCount, jobs) {
  return mods.lib.blankInsertVisualIndex({ persistedIndex, realSlideCount, jobs })
}

// ---- Behaviour suite over the lib: runs on the real sources and on every mutant -------------------------------------
function libSuite(sources) {
  const mods = modules(sources)
  const at = (p, n, jobs) => convert(mods, p, n, jobs)

  // flag: exact "true" only, default off
  for (const [value, expected] of [['true', true], ['false', false], ['', false], ['TRUE', false], ['1', false], [' true', false], ['yes', false], [undefined, false]]) {
    const env = value === undefined ? {} : { [FLAG]: value }
    check(assert.equal, modules(sources, env).lib.STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED, expected, `flag ${JSON.stringify(value)}`)
  }
  check(assert.equal, modules(sources, { NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED: 'true' }).lib.STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED, false, 'the J2 v2 flag does not switch it on')

  // 0 placeholders: the persisted index is the visual index
  for (let p = 0; p < 6; p += 1) check(assert.equal, at(p, 6, {}), p, `no placeholder: ${p} stays`)
  check(assert.equal, at(3, 6, []), 3, 'an empty rail list is the same')

  // 1 placeholder (6 real slides after the insert, the placeholder drawn before slide 2): S0 S1 P S2 S3 S4 S5
  const one = { a: job(2) }
  check(assert.deepEqual, [0, 1, 2, 3, 4, 5].map(p => at(p, 6, one)), [0, 1, 3, 4, 5, 6], 'one placeholder before slide 2 pushes slides 2..5 by one')
  // pending and failed take the same slot
  check(assert.deepEqual, [0, 1, 2, 3, 4, 5].map(p => at(p, 6, { a: job(2, { status: 'error' }) })), [0, 1, 3, 4, 5, 6], 'a failed placeholder counts like a pending one')
  // 2 placeholders: S0 P S1 S2 S3 P S4 S5 (one pending, one failed)
  const two = { a: job(1), b: job(4, { status: 'error' }) }
  check(assert.deepEqual, [0, 1, 2, 3, 4, 5].map(p => at(p, 6, two)), [0, 2, 3, 4, 6, 7], 'two placeholders push by one, then by two')
  check(assert.deepEqual, [0, 1, 2, 3, 4, 5].map(p => at(p, 6, { a: job(1, { status: 'error' }), b: job(4) })), [0, 2, 3, 4, 6, 7], 'which one failed does not matter')
  // two placeholders on the same slot: S0 S1 S2 P P S3 S4 S5
  const stacked = { a: job(3), b: job(3, { status: 'error' }) }
  check(assert.deepEqual, [0, 1, 2, 3, 4, 5].map(p => at(p, 6, stacked)), [0, 1, 2, 5, 6, 7], 'stacked placeholders push the slide by two')
  // a placeholder on the new slide's own slot sits before it (as the rail draws it); one after it changes nothing
  check(assert.equal, at(2, 6, one), 3, 'a placeholder on the slide\'s own slot is before it')
  check(assert.equal, at(1, 6, one), 1, 'a placeholder after the slide changes nothing')
  check(assert.equal, at(5, 6, { a: job(6) }), 5, 'a placeholder after the last slide changes nothing')
  check(assert.equal, at(5, 6, { a: job(99) }), 5, 'a target beyond the deck is clamped behind the last slide')
  check(assert.equal, at(0, 6, { a: { status: 'building' } }), 1, 'a job with no target counts as slot 0')
  check(assert.equal, at(3, 6, { a: job(0) }), 4, 'a placeholder at the very start')

  // what must not count
  check(assert.equal, at(3, 6, { a: job(1, { status: 'built' }) }), 3, 'a finished job is no placeholder')
  check(assert.equal, at(3, 6, { a: job(1, { status: 'done' }) }), 3, 'a done job is no placeholder')
  check(assert.equal, at(3, 6, { a: job(1, { kind: 'refine' }) }), 3, 'a refine overlay is no placeholder')
  check(assert.equal, at(3, 6, { a: job(1, { kind: 'refine', status: 'error' }) }), 3, 'a failed refine is no placeholder either')
  check(assert.equal, at(3, 6, { a: job(1, { kind: undefined }) }), 4, 'a job without a kind is a compose job')
  check(assert.equal, at(3, 6, { a: job(1), b: job(1, { kind: 'refine' }), c: job(2, { status: 'built' }) }), 4, 'only the real placeholder counts among others')

  // the rail's list shape gives the same numbers as the page's record
  const railTwo = [railJob(1), railJob(4, { status: 'error' })]
  check(assert.deepEqual, [0, 1, 2, 3, 4, 5].map(p => at(p, 6, railTwo)), [0, 2, 3, 4, 6, 7], 'the rail list shape')
  check(assert.equal, at(3, 6, [railJob(1, { kind: 'refine' })]), 3, 'a refine in the rail list')

  // not a slide of the deck: left alone
  for (const p of [-1, 6, 7, 1.5, NaN, Infinity]) check(assert.ok, Object.is(at(p, 6, one), p), `${p} is not a slide of a 6-slide deck: unchanged`)

  // the reported scenario: deck A B C D with a placeholder before B, the user selects C (visual 3) and adds a Blank.
  // Persisted position after C = 3 (J2 v2 resolver); the ack says slide_index 3 of 5. The rail then reads A P B C X D.
  check(assert.equal, at(3, 5, { a: job(1) }), 4, 'the new Blank is visual 4, not the persisted 3')
  check(assert.equal, at(3, 5, { a: job(1, { status: 'error' }) }), 4, '... also when the placeholder failed')

  // exhaustive against the independent picture: every deck up to 5 slides, every job list up to 3 jobs
  const kinds = [{}, { status: 'error' }, { status: 'built' }, { kind: 'refine' }]
  let compared = 0
  const run = (n, jobs, shape) => {
    for (let p = 0; p < n; p += 1) {
      const expected = visualOf(n, jobs, p)
      assert.equal(at(p, n, shape(jobs)), expected, `n=${n} p=${p} jobs=${JSON.stringify(jobs)}`)
      compared += 1
    }
  }
  for (let n = 1; n <= 5; n += 1) {
    const singles = []
    for (let t = 0; t <= n; t += 1) for (const over of kinds) singles.push(job(t, over))
    run(n, [], jobs => jobs)
    for (const a of singles) {
      run(n, [a], jobs => Object.fromEntries(jobs.map((j, i) => [`j${i}`, j])))
      for (const b of singles) {
        run(n, [a, b], jobs => jobs)
        if (n <= 3) for (const c of singles) run(n, [a, b, c], jobs => Object.fromEntries(jobs.map((j, i) => [`j${i}`, j])))
      }
    }
  }
  check(assert.ok, compared > 20000, `exhaustive comparison ran (${compared})`)

  // consistency with the J2 v2 anchor resolver, which maps the other way: every selectable real slide round-trips
  const submit = load(sources.submit, { imports: {
    '@/lib/slide-compose-async': mods.compose,
    '@/lib/element-generation-timeout': load(ELEMENT_TIMEOUT),
    '@/components/slide-generation-panel/compose-helpers': load(COMPOSE_HELPERS),
    '@/lib/studio-add-slide-v2': load(ADD_SLIDE_V2),
  } })
  for (const jobs of [{}, one, two, stacked, { a: job(0), b: job(2, { status: 'error' }), c: job(5) }]) {
    const n = 6
    for (let visualIndex = 0; visualIndex < n + Object.keys(jobs).length; visualIndex += 1) {
      const anchor = submit.resolveAddSlideV2Anchor({ presentationId: 'pres-1', visualIndex, realSlideCount: n, jobs })
      if (!anchor.ok) continue
      check(assert.equal, at(anchor.insertAfterIndex, n, jobs), visualIndex, `visual ${visualIndex} -> layout ${anchor.insertAfterIndex} -> visual`)
    }
  }
  // and the Blank target resolver's position lands right after its anchor: the new slide's visual index is the selection + 1
  const deck = { a: job(1) } // A P B C D, C selected (visual 3)
  const target3 = submit.resolveAddSlideV2BlankTarget({ presentationId: 'pres-1', visualIndex: 3, expectedVisualIndex: 3, realSlideCount: 4, jobs: deck })
  check(assert.deepEqual, target3, { ok: true, position: 3 })
  check(assert.equal, at(target3.position, 5, deck), 4, 'Blank after the selection (visual 3) is visual 4')
  const target4 = submit.resolveAddSlideV2BlankTarget({ presentationId: 'pres-1', visualIndex: 4, expectedVisualIndex: 4, realSlideCount: 4, jobs: { a: job(1), b: job(2, { status: 'error' }) } })
  check(assert.deepEqual, target4, { ok: true, position: 3 }, 'A P B P C D with C at visual 4')
  check(assert.equal, at(target4.position, 5, { a: job(1), b: job(2, { status: 'error' }) }), 5, '... is visual 5 after the Blank')
}

// ---- Wiring suite over the viewer: source pins plus the real conversion expression executed -----------------------
function viewerSuite(viewerSource, sources) {
  const addIndex = viewerSource.indexOf('const handleAddSlide = useCallback(')
  const duplicateIndex = viewerSource.indexOf('// Duplicate slide handler')
  check(assert.ok, addIndex > 0 && duplicateIndex > addIndex, 'the Add handler is where expected')
  const add = viewerSource.slice(addIndex, duplicateIndex)

  check(assert.match, viewerSource, /import \{ STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED, blankInsertVisualIndex \} from '@\/lib\/studio-blank-goto-visual-index'/, 'the viewer imports the flag and the conversion')
  check(assert.match, viewerSource, /const composeJobsRef = useRef\(composeJobs\)\n  composeJobsRef\.current = composeJobs\n/, 'the placeholders are read through a ref kept current on every render')
  check(assert.equal, (viewerSource.match(/composeJobsRef/g) ?? []).length, 3, 'one declaration, one assignment, one read')
  check(assert.doesNotMatch, add.slice(add.lastIndexOf('}, [')), /composeJobs/, 'the handler keeps its dependencies: no composeJobs, so its identity does not follow the jobs')

  const expression = add.match(/const newVisualIndex = ([\s\S]*?)\n\s*const newSlideNumber = newVisualIndex \+ 1\n\s*committedSlideNumber = newSlideNumber\n/)
  check(assert.ok, expression, 'the visual index is computed once, before the number everything else uses')
  const body = expression[1]

  // everything downstream uses the visual number / index, except the rail selection (real slides only)
  check(assert.match, add, /await sendCommand\(iframe, 'goToSlide', \{ index: newVisualIndex \}\)/, 'goToSlide takes the visual index')
  check(assert.doesNotMatch, add, /'goToSlide', \{ index: newSlideIndex \}/, 'no goToSlide with the persisted index is left')
  check(assert.match, add, /commitSelection\(setCurrentSlide, newSlideNumber\)/, 'the viewer slide number is the visual one')
  check(assert.match, add, /onSlideChangeRef\.current\?\.\(newSlideNumber\)/, 'the parent is told the visual slide number')
  check(assert.match, add, /commitSelection<number\[\]>\(setSelectedSlideIndices, \[newSlideIndex\]\)/, 'the rail selection stays the persisted (real slide) index')
  check(assert.match, add, /New slide inserted at position \$\{newSlideNumber\}/, 'the toast reports the slide number the viewer shows')
  check(assert.match, add, /position: options\?\.position \?\? currentSlide,/, 'the native position is untouched')

  // the real conversion: run the expression with the real helper under every flag / option combination
  const expressionFor = flag => {
    const mods = modules(sources, flag ? { [FLAG]: 'true' } : {})
    return (options, newSlideIndex, newTotal, jobs) => new Function('STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED', 'blankInsertVisualIndex', 'options', 'newSlideIndex', 'newTotal', 'composeJobsRef',
      `return (${body})`)(mods.lib.STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED, mods.lib.blankInsertVisualIndex, options, newSlideIndex, newTotal, { current: jobs })
  }
  const off = expressionFor(false)
  const on = expressionFor(true)
  const placed = [railJob(1)] // A P B C D after a Blank at persisted 3
  // flag off: identity for every input, placeholders or not
  for (const options of [undefined, {}, { position: undefined }, { position: 3 }]) {
    for (const jobs of [[], placed, [railJob(0, { status: 'error' }), railJob(2)]]) {
      check(assert.equal, off(options, 3, 5, jobs), 3, `flag off keeps the persisted index (${JSON.stringify(options)}, ${jobs.length} jobs)`)
    }
  }
  // flag on: only a resolved Blank position converts
  check(assert.equal, on({ position: 3 }, 3, 5, placed), 4, 'flag on, Blank past a placeholder: visual index')
  check(assert.equal, on({ position: 3 }, 3, 5, [railJob(1, { status: 'error' })]), 4, 'flag on, a failed placeholder')
  check(assert.equal, on({ position: 4 }, 4, 6, [railJob(1), railJob(3, { status: 'error' })]), 6, 'flag on, two placeholders before the slide')
  check(assert.equal, on({ position: 3 }, 3, 5, []), 3, 'flag on, no placeholders: unchanged')
  check(assert.equal, on({ position: 3 }, 3, 5, [railJob(1, { kind: 'refine' })]), 3, 'flag on, a refine overlay is not a placeholder')
  check(assert.equal, on({ position: 0 }, 0, 5, [railJob(0)]), 1, 'flag on, position 0 is a position (not "absent"): a Blank at the very start past a placeholder')
  check(assert.equal, on(undefined, 3, 5, placed), 3, 'flag on, no options (every other Add): unchanged')
  check(assert.equal, on({}, 3, 5, placed), 3, 'flag on, no position (the native default): unchanged')
  check(assert.equal, on({ position: 3 }, 3, 5, placed), on({ position: 99 }, 3, 5, placed), 'the ack index and the count decide, not the requested position')
  check(assert.equal, on({ position: 3 }, 2, 4, [railJob(1)]), 3, 'the ack count is the post-insert count')
}

// ---- Housekeeping pins ---------------------------------------------------------------------------------------------
function housekeeping() {
  const env = read('.env.example')
  check(assert.match, env, new RegExp(`^${FLAG}="false"$`, 'm'), 'the flag is in .env.example, off')
  check(assert.equal, (env.match(new RegExp(FLAG, 'g')) ?? []).length, 1, 'the example sets the flag once')
  const manifest = JSON.parse(read('package.json'))
  check(assert.equal, manifest.scripts['test:studio-blank-goto-visual-index'], 'node scripts/test-studio-blank-goto-visual-index.mjs', 'the script is anchored in package.json')
  const users = ['app', 'components', 'hooks', 'lib', 'contexts'].flatMap(dir => {
    const walk = folder => !fs.existsSync(path.join(ROOT, folder)) ? [] : fs.readdirSync(path.join(ROOT, folder), { withFileTypes: true }).flatMap(entry =>
      entry.isDirectory() ? (entry.name === 'node_modules' ? [] : walk(path.join(folder, entry.name))) : /\.(ts|tsx)$/.test(entry.name) ? [path.join(folder, entry.name)] : [])
    return walk(dir)
  }).filter(file => /studio-blank-goto-visual-index/.test(fs.readFileSync(path.join(ROOT, file), 'utf8')))
  check(assert.deepEqual, users, ['components/presentation-viewer.tsx'], 'only the viewer reaches the helper')
  check(assert.doesNotMatch, SOURCES.lib, /process\.env\.(?!NEXT_PUBLIC_STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED)/, 'the lib reads no other variable')
}

// ---- 1. real sources -------------------------------------------------------------------------------------------------
libSuite(SOURCES)
viewerSuite(SOURCES.viewer, SOURCES)
housekeeping()

// ---- 2. mutation check: every broken copy must be caught ------------------------------------------------------------
// [name, source key, from, to]
const mutants = [
  ['flag is not exact', 'lib', "=== 'true'", "!== 'false'"],
  ['flag reads another variable', 'lib', 'process.env.NEXT_PUBLIC_STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED', 'process.env.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED'],
  ['flag defaults on', 'lib', "=== 'true'", "!== 'false' || true"],
  ['jobs ignored', 'lib', 'jobs: jobs as Record<string, SlideComposeVisualJob> }', 'jobs: {} as Record<string, SlideComposeVisualJob> }'],
  ['search never leaves the persisted slot', 'lib', 'const last = persistedIndex + Object.values(jobs).length', 'const last = persistedIndex'],
  ['search stops one slot early', 'lib', 'visualIndex <= last', 'visualIndex < last'],
  ['first slide that resolves wins', 'lib', "resolved?.kind === 'slide' && resolved.layoutIndex === persistedIndex", "resolved?.kind === 'slide'"],
  ['slide count off by one', 'lib', 'slideCount: realSlideCount,', 'slideCount: realSlideCount - 1,'],
  // the accounting it reuses: a break there must show up here too
  ['resolver forgets failed placeholders', 'compose', "(job.status === 'building' || job.status === 'error'))\n  const item", "job.status === 'building')\n  const item"],
  ['resolver counts refine overlays', 'compose', ".filter(job => job.kind !== 'refine' && (job.status === 'building' || job.status === 'error'))\n  const item", ".filter(job => (job.status === 'building' || job.status === 'error'))\n  const item"],
  ['resolver counts finished jobs', 'compose', "(job.status === 'building' || job.status === 'error'))\n  const item", "true)\n  const item"],
  ['order draws the placeholder after its slide', 'compose', 'normalizedComposeJobs\n      .filter(({ targetLayoutIndex }) => targetLayoutIndex === index)', 'normalizedComposeJobs\n      .filter(({ targetLayoutIndex }) => targetLayoutIndex === index - 1)'],
  ['order drops stacked placeholders', 'compose', 'normalizedComposeJobs\n      .filter(({ targetLayoutIndex }) => targetLayoutIndex === index)\n      .forEach(', 'normalizedComposeJobs\n      .filter(({ targetLayoutIndex }) => targetLayoutIndex === index).slice(0, 1)\n      .forEach('],
  // the viewer
  ['viewer converts with the flag off', 'viewer', 'STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED && options?.position !== undefined', 'options?.position !== undefined'],
  ['viewer converts every Add', 'viewer', 'STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED && options?.position !== undefined', 'STUDIO_BLANK_GOTO_VISUAL_INDEX_ENABLED'],
  ['viewer treats position 0 as absent', 'viewer', 'options?.position !== undefined', 'options?.position'],
  ['viewer navigates by the persisted index', 'viewer', "await sendCommand(iframe, 'goToSlide', { index: newVisualIndex })", "await sendCommand(iframe, 'goToSlide', { index: newSlideIndex })"],
  ['viewer publishes the persisted number', 'viewer', 'const newSlideNumber = newVisualIndex + 1', 'const newSlideNumber = newSlideIndex + 1'],
  ['viewer converts the rail selection', 'viewer', 'commitSelection<number[]>(setSelectedSlideIndices, [newSlideIndex])', 'commitSelection<number[]>(setSelectedSlideIndices, [newVisualIndex])'],
  ['viewer converts against the pre-insert count', 'viewer', 'realSlideCount: newTotal', 'realSlideCount: totalSlides'],
  ['viewer converts against no placeholders', 'viewer', 'jobs: composeJobsRef.current', 'jobs: []'],
  ['viewer reads the placeholders through a stale ref', 'viewer', '  composeJobsRef.current = composeJobs\n', ''],
  ['viewer handler follows the jobs', 'viewer', 'onThumbnailMutationCapture, studioCanonicalThumbnails, slideStructure, slidesModifiedByCrud, presentationId, captureStudioNativeSlideFrame])', 'onThumbnailMutationCapture, studioCanonicalThumbnails, slideStructure, slidesModifiedByCrud, presentationId, captureStudioNativeSlideFrame, composeJobs])'],
  ['viewer toast reports the persisted position', 'viewer', 'New slide inserted at position ${newSlideNumber}', 'New slide inserted at position ${newSlideIndex + 1}'],
  ['viewer native position changed', 'viewer', 'position: options?.position ?? currentSlide,', 'position: options?.position ?? currentSlide + 1,'],
]
let caught = 0
for (const [name, key, from, to] of mutants) {
  assert.ok(SOURCES[key].includes(from), `mutant "${name}" no longer matches the ${key} source`)
  const broken = { ...SOURCES, [key]: SOURCES[key].replace(from, to) }
  const seen = checks
  let survived = false
  try {
    libSuite(broken)
    viewerSuite(broken.viewer, broken)
    survived = true
  } catch { /* caught */ }
  assert.equal(survived, false, `mutant survived: ${name}`)
  checks = seen
  caught += 1
}
check(assert.equal, caught, mutants.length)

console.log(`studio-blank-goto-visual-index: ${checks} checks passed, ${caught} mutants caught`)
