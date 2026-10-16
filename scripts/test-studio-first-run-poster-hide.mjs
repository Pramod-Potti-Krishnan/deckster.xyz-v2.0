// PASS2B G09 (FRONTEND-2): the canvas's first-run poster ("Make something worth presenting. Tell Director who it's for and what you want to say.")
// no longer stays up after the first message is sent; a planning card replaces it, as the accepted v4 mockup's canvas does
// ("Your presentation will take shape here"). Flag NEXT_PUBLIC_STUDIO_FIRST_RUN_POSTER_HIDE (exact "true", Studio shell only), default off.
//
// Run: node scripts/test-studio-first-run-poster-hide.mjs   (plain node: transpile, no network, no browser, no env)
//   FIRST_RUN_POSTER_BASE=<commit> overrides the base commit the flag-off identity is checked against (default 8df821b, the #407 merge: the
//   last commit before the G20/G12/G09 batch; the default was a2e14da until #407 landed its own page lines between the two).
//
// Proven on the REAL components/builder/studio-welcome-stage.tsx, components/builder/presentation-area.tsx and app/builder/page.tsx:
//   1. the stage: without `planning` the markup is the base commit's, byte for byte, over a props matrix; with it the poster's words and first-run
//      actions are gone, the planning words are there, and only classes the poster already uses are drawn (no new CSS);
//   2. the stage area: the planning decision (flag AND the first message sent) over its whole grid, run from the source text; both places the area
//      draws the poster hand it down; with the G09 text removed the file is the base commit's;
//   3. the page: the signal is "a user turn exists in this session", only with the exact flag in the Studio shell; with that attribute removed the
//      page's text is the base commit's (the G12 block is likewise removed, it is proven by its own test);
//   4. mutation check: every mutant of the three sources is killed by sections 1-3.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const BASE_COMMIT = process.env.FIRST_RUN_POSTER_BASE || '8df821b'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
function baseSource(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
    return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch { return null }
}
let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

const STAGE = 'components/builder/studio-welcome-stage.tsx'
const AREA = 'components/builder/presentation-area.tsx'
const PAGE = 'app/builder/page.tsx'
const SOURCES = { [STAGE]: read(STAGE), [AREA]: read(AREA), [PAGE]: read(PAGE) }
const FLAG = 'NEXT_PUBLIC_STUDIO_FIRST_RUN_POSTER_HIDE'

// ---------------------------------------------------------------- 1. the stage component
function stageComponent(source) {
  const module = { exports: {} }
  const out = ts.transpileModule(source, { fileName: STAGE, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const stubs = {
    'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) },
    '@/components/studio-intro-replay': { StudioIntroReplay: () => React.createElement('button', { 'data-stub': 'intro-replay' }, 'Replay intro') },
  }
  new Function('module', 'exports', 'require', out)(module, module.exports, spec => stubs[spec] ?? nodeRequire(spec))
  return module.exports.StudioWelcomeStage
}
const sentinel = React.createElement('button', { 'data-sentinel': 'true' }, 'Replay (page)')
const PROPS = [[], [{}], [{ studioIntroReplay: sentinel }], [{ planning: false }], [{ planning: undefined, studioIntroReplay: sentinel }]]
const render = (Stage, ...props) => renderToStaticMarkup(React.createElement(Stage, ...props))
const classesOf = html => new Set([...html.matchAll(/class="([^"]*)"/g)].flatMap(m => m[1].split(/\s+/)).filter(Boolean))
function proveStage(Stage, label = 'real') {
  const poster = render(Stage)
  assert.match(poster, /Make something<br\/><em>worth presenting\.<\/em>/, `${label}: the poster is still the poster`)
  assert.match(poster, /Tell Director who it’s for/, `${label}: with its prompt`)
  assert.match(poster, /Start with a conversation/, `${label}: and its first-run actions`)
  assert.doesNotMatch(poster, /data-studio-welcome-planning/, `${label}: no planning marker on the poster`)
  const planning = render(Stage, { planning: true })
  assert.match(planning, /data-studio-welcome-planning="true"/, `${label}: the planning card is marked`)
  assert.match(planning, /Your presentation<br\/><em>will take shape here\.<\/em>/, `${label}: the mockup's words`)
  assert.match(planning, /Director is shaping your outline\./, `${label}: and what is happening`)
  assert.match(planning, /It will appear on this stage for your review\./, `${label}: and where it will appear`)
  for (const gone of [/Make something/, /worth presenting/, /Tell Director who/, /Your story starts here/, /Start with a conversation/, /Replay intro/, /Explore templates/, /\/studio\/templates/, /data-sentinel/, /<a /, /<button/])
    assert.doesNotMatch(planning, gone, `${label}: the planning card has no ${gone}`)
  assert.match(planning, /role="region" aria-label="Your presentation stage"/, `${label}: the same landmark`)
  const sentinelPlanning = render(Stage, { planning: true, studioIntroReplay: sentinel })
  assert.doesNotMatch(sentinelPlanning, /data-sentinel/, `${label}: the page's replay button is not drawn on the planning card`)
  // no new CSS: every class the planning card draws, the poster draws
  const posterClasses = classesOf(poster)
  for (const cls of classesOf(planning)) assert.ok(posterClasses.has(cls), `${label}: planning class ${cls} is a poster class`)
}
proveStage(stageComponent(SOURCES[STAGE])); checks += 24
{
  const baseStage = baseSource(STAGE)
  if (baseStage) {
    const Base = stageComponent(baseStage), Work = stageComponent(SOURCES[STAGE])
    for (const props of PROPS) check(assert.equal, render(Work, ...props), render(Base, ...props), `no planning: the base commit's markup for ${JSON.stringify(props.map(p => Object.keys(p)))}`)
  } else console.log(`  SKIP base-commit stage identity: ${BASE_COMMIT} is not in this clone`)
}

// ---------------------------------------------------------------- 2. the stage area
const AREA_G09 = [
  // the prop, its destructure, the decision (with its comment), the two spreads
  /  \/\*\* PASS2B G09[^\n]*\n  studioBriefSent\?: boolean\n/,
  /  studioBriefSent,\n/,
  /  \/\/ PASS2B G09[^\n]*\n  const studioPosterPlanning = [^\n]*\n/,
  / \{\.\.\.studioPosterPlanning\}/g,
]
// PASS2B G16 (9a9f0e4, same batch): one pass-through line on <PresentationDownloadControls>, reverted too so the file can be compared with the base commit.
const AREA_G16 = /(<PresentationDownloadControls[^\n]*\n(?:[^\n]*\n)*?\s*stage=\{currentStage\}\n)\s*hasFinalDeck=\{hasFinalDeck\}\n/
const stripG09 = text => [...AREA_G09, AREA_G16].reduce((acc, pattern) => acc.replace(pattern, pattern === AREA_G16 ? '$1' : ''), text)
function areaDecision(source) {
  const decision = source.match(/const studioPosterPlanning = ([^\n]+)\n/)?.[1]
  assert.ok(decision, 'the decision is in the source')
  return env => vm.runInNewContext(`(studioBriefSent) => ${decision}`, { process: { env } })
}
function proveArea(source, label = 'area') {
  const make = areaDecision(source)
  for (const envValue of [undefined, '', 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'true']) {
    const decide = make(envValue === undefined ? {} : { [FLAG]: envValue })
    for (const sent of [undefined, null, false, true, 0, 1, 'true', 'yes']) {
      const got = JSON.parse(JSON.stringify(decide(sent)))
      const want = envValue === 'true' && sent === true ? { planning: true } : {}
      assert.deepEqual(got, want, `${label}: flag ${JSON.stringify(envValue)}, first message sent ${JSON.stringify(sent)}`)
    }
  }
  assert.equal((source.match(/<StudioWelcomeStage /g) ?? []).length, 2, `${label}: the area draws the poster in two places`)
  const draws = [...source.matchAll(/<StudioWelcomeStage [^\n]*\/>/g)].map(m => m[0])
  assert.equal(draws.length, 2, `${label}: two single-line draws`)
  for (const draw of draws) assert.equal(draw, '<StudioWelcomeStage studioIntroReplay={studioIntroReplay} {...studioPosterPlanning} />', `${label}: each hands the decision down`)
  assert.match(source, /studioInitialNativeDeferred = false,\n  studioBriefSent,\n/, `${label}: studioBriefSent has no default (absent = not sent)`)
  assert.match(source, /studioBriefSent\?: boolean\n/, `${label}: a boolean prop`)
  assert.equal((source.match(/process\.env\.NEXT_PUBLIC_STUDIO_FIRST_RUN_POSTER_HIDE/g) ?? []).length, 1, `${label}: the flag is read once, inline`)
  const baseArea = baseSource(AREA)
  if (baseArea) assert.equal(stripG09(source), baseArea, `${label}: without the G09 text the file is ${BASE_COMMIT}'s`)
}
proveArea(SOURCES[AREA]); checks += 80 + 10

// ---------------------------------------------------------------- 3. the page
const G12_BLOCK = /\s*\/\/ PASS2B G12[^\n]*\n\s*\.\.\.\(process\.env\.NEXT_PUBLIC_STUDIO_COMPOSER_STAGE_CONTEXT === 'true' \? \{ stage: \{[\s\S]*?\} \} : \{\}\),/
// + PASS2B G01/G02 (NEXT_PUBLIC_STUDIO_WELCOME_POLISH) add an import, one flag-gated spread on MessageList, the edge-tab decision and a wrapper around the
//   Slide handle; flag off none of it changes the page's output. scripts/test-studio-welcome-polish.mjs proves them against the same base text.
const G01_G02 = [
  ["import { studioSlideEdgeTabHidden } from '@/lib/studio-welcome-polish'\n", ''],
  ["                        {...(studioShell && process.env.NEXT_PUBLIC_STUDIO_WELCOME_POLISH === 'true' ? { studioWelcomeGreeting: { name: user?.name ?? null } } : {})}\n", ''],
  [`  // PASS2B G02 (flag NEXT_PUBLIC_STUDIO_WELCOME_POLISH, default off): no collapsed Slide edge tab on the welcome screen or over the outline.
  const studioSlideTabHidden = studioShell && studioSlideEdgeTabHidden({
    enabled: process.env.NEXT_PUBLIC_STUDIO_WELCOME_POLISH === 'true', panelOpen: isSlideDrawerOpen || studioSlideVisible,
    landing: studioWelcome, builtDeck: studioCanvasLifecycle.hasGeneratedDeck, activeVersion: effectiveActiveVersion,
  })
`, ''],
  ['              {!studioSlideTabHidden && (\n', ''],
  ['              </button>\n              )}\n', '              </button>\n'],
]
const stripG01G02 = text => G01_G02.reduce((acc, [from, to]) => acc.replace(from, to), text)
const PAGE_ATTR = "            studioBriefSent={studioShell && process.env.NEXT_PUBLIC_STUDIO_FIRST_RUN_POSTER_HIDE === 'true' ? session.userMessages.length > 0 : undefined}\n"
function provePage(page, label = 'page') {
  assert.equal((page.match(/studioBriefSent=/g) ?? []).length, 1, `${label}: one attribute`)
  assert.ok(page.includes(PAGE_ATTR), `${label}: the attribute is the exact-flag, Studio-shell, first-message expression`)
  const at = page.indexOf('<PresentationArea\n'), end = page.indexOf('\n          />', at)
  assert.ok(at > 0 && page.slice(at, end).includes(PAGE_ATTR), `${label}: it is on PresentationArea`)
  const basePage = baseSource(PAGE)
  if (basePage) assert.equal(stripG01G02(stripDarkPersist(PAGE, stripAddSlideStatus(PAGE, page)).replace(PAGE_ATTR, '').replace(G12_BLOCK, '')), basePage, `${label}: without it (and the G12 block) the page is ${BASE_COMMIT}'s`)
}
provePage(SOURCES[PAGE]); checks += 3 + 1

// ---------------------------------------------------------------- 4. mutation check
const MUTANTS = [
  [STAGE, 'planning ignored', 'if (planning) return', 'if (false) return'],
  [STAGE, 'planning always', 'if (planning) return', 'if (true) return'],
  [STAGE, 'poster words kept', 'Your presentation<br />', 'Make something<br />'],
  [STAGE, 'prompt kept', 'It will appear on this stage for your review.', 'Tell Director who it’s for.'],
  [STAGE, 'what is happening dropped', 'Director is shaping your outline.<br />', ''],
  [STAGE, 'marker dropped', ' data-studio-welcome-planning="true"', ''],
  [STAGE, 'first-run actions kept', '<span>01</span></div>\n    </div>\n  </div>\n  return', '<span>01</span></div>\n    </div>\n    <div className="studio-welcome-caption"><Link href="/studio/templates">Explore templates</Link></div>\n  </div>\n  return'],
  [STAGE, 'new class', '<div className="studio-welcome-rule" /><span className="studio-welcome-eyebrow">FROM', '<div className="studio-welcome-rule new-class" /><span className="studio-welcome-eyebrow">FROM'],
  [STAGE, 'poster changed', 'Your story starts here', 'Your story starts now'],
  [STAGE, 'poster action changed', 'Start with a conversation', 'Start a conversation'],
  [AREA, 'flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_FIRST_RUN_POSTER_HIDE === 'true' && studioBriefSent", "process.env.NEXT_PUBLIC_STUDIO_FIRST_RUN_POSTER_HIDE !== 'false' && studioBriefSent"],
  [AREA, 'flag ignored', "process.env.NEXT_PUBLIC_STUDIO_FIRST_RUN_POSTER_HIDE === 'true' && studioBriefSent === true", 'studioBriefSent === true'],
  [AREA, 'sent read loosely', "=== 'true' && studioBriefSent === true", "=== 'true' && studioBriefSent"],
  [AREA, 'sent ignored', "=== 'true' && studioBriefSent === true", "=== 'true'"],
  [AREA, 'first draw forgets the decision', 'studioIntroReplay={studioIntroReplay} {...studioPosterPlanning} />\n              {waitingForDirector', 'studioIntroReplay={studioIntroReplay} />\n              {waitingForDirector'],
  [AREA, 'second draw forgets the decision', ': <StudioWelcomeStage studioIntroReplay={studioIntroReplay} {...studioPosterPlanning} />', ': <StudioWelcomeStage studioIntroReplay={studioIntroReplay} />'],
  [AREA, 'wrong prop', 'planning: true', 'planing: true'],
  [AREA, 'default sent', 'studioInitialNativeDeferred = false,\n  studioBriefSent,', 'studioInitialNativeDeferred = false,\n  studioBriefSent = true,'],
  [AREA, 'another branch changed', 'const waitingForDirector = narrationActive || !!waitingActivity', 'const waitingForDirector = narrationActive'],
  [PAGE, 'attribute flag read loosely', "=== 'true' ? session.userMessages.length > 0 : undefined}", "!== 'false' ? session.userMessages.length > 0 : undefined}"],
  [PAGE, 'attribute outside the Studio shell', 'studioBriefSent={studioShell && process', 'studioBriefSent={process'],
  [PAGE, 'attribute always sent', "studioBriefSent={studioShell && process.env.NEXT_PUBLIC_STUDIO_FIRST_RUN_POSTER_HIDE === 'true' ? session.userMessages.length > 0 : undefined}", 'studioBriefSent={session.userMessages.length > 0}'],
  [PAGE, 'two messages needed', 'session.userMessages.length > 0 : undefined}', 'session.userMessages.length > 1 : undefined}'],
  [PAGE, 'wrong signal', 'session.userMessages.length > 0 : undefined}', 'messages.length > 0 : undefined}'],
]
let killed = 0
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    if (file === STAGE) { proveStage(stageComponent(mutated), name); const base = baseSource(STAGE); if (base) for (const props of PROPS) assert.equal(render(stageComponent(mutated), ...props), render(stageComponent(base), ...props), `${name}: base markup`) }
    if (file === AREA) proveArea(mutated, name)
    if (file === PAGE) provePage(mutated, name)
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
check(assert.equal, killed, MUTANTS.length)

// ---------------------------------------------------------------- .env.example
check(assert.match, read('.env.example'), /^NEXT_PUBLIC_STUDIO_FIRST_RUN_POSTER_HIDE="false"$/m, 'documented in .env.example, default off')

console.log(`Studio first-run poster hide: ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
