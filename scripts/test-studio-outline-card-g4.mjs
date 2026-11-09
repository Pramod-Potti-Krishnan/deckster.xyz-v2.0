// FRONTEND-1 (DIRECTOR-2's read-only diagnosis G-4 of the outline card): proof of NEXT_PUBLIC_STUDIO_OUTLINE_CARD_G4 (exact "true", default off, build-time).
//
// THE DEFECTS (lib/studio-outline-card-g4.ts has the fix; components/builder/chat/studio-outline-card.tsx, the expanded slide):
//   (a) the key message is drawn twice: under "Key message" and again as the narrative's leading "Key message: ..." line;
//   (b) slide.subtitle is never drawn;
//   (c) "Research details" is drawn for a "conceptual" slide that has no citations, no source types and no issues.
//
//   1. The lib, function by function: the flag, (a) the narrative, (b) the subtitle, (c) the empty-research rule, the view the card reads.
//   2. The REAL card on the offline React host. Flag off is the base card's markup byte for byte (the base card is read from git, BASE_COMMIT), for every card variant and for slides that carry exactly what the fix acts on.
//      Flag on: (a), (b) and (c) one slide at a time, with the negatives (a different first narrative line, a different key message, no key message, any other status, any citation, any source type, any issue); where nothing applies
//      the flag-on markup is the base's; the key points and everything outside the expanded bodies are the base's.
//   3. The sources: every marked line, the strip gives each touched file its base back byte for byte, the registry, .env.example, the voice-call proof's four-line pin edit (the same four lines FRONTEND-2's #603 carries), the scope (read from the
//      COMMITTED diff BASE..HEAD only, never the working tree), the commits.
//   4. Mutants: each must be caught.
//
//   node scripts/test-studio-outline-card-g4.mjs
//
// Offline: no socket or fetch (the harness's host network guard is installed); git is read only for 3.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

setTimeout(() => { process.stderr.write('[watchdog] test-studio-outline-card-g4 stalled for 240 s; exit 124\n'); process.exit(124) }, Number(process.env.STUDIO_PROOF_TRACE_WATCHDOG_MS) || 240_000).unref()

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const FLAG = 'NEXT_PUBLIC_STUDIO_OUTLINE_CARD_G4'
const LIB = 'lib/studio-outline-card-g4.ts'
const CARD = 'components/builder/chat/studio-outline-card.tsx'
const HOOK = 'hooks/use-deckster-websocket-v2.ts'
const STRIP = 'scripts/studio-outline-card-g4-strip.mjs'
const VOICE_CALL = 'scripts/test-studio-voice-call.mjs'
const REGISTRY = 'scripts/studio-later-changes.mjs'
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8')
let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split('\n').join('\n       ')}`) }
}
/** True when `fn` (sync or async) throws. */
async function throws(fn) { try { await fn(); return false } catch { return true } }

const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { installHostNetworkGuard } = await import('./studio-chat-harness/fake-env.mjs')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
const { lucideStub } = await import('./studio-chat-harness/esm-packages.mjs')
const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-outline-card-g4-strip.mjs')
const { BASE_COMMIT, OUTLINE_CARD_G4_FILES, OUTLINE_CARD_G4_NEW_FILES, OUTLINE_CARD_G4_SCOPE_FILES, OUTLINE_CARD_G4_ENV_BLOCK, OUTLINE_CARD_G4_SUBJECT, OUTLINE_CARD_G4_MARKER_RE } = stripModule
const release = installHostNetworkGuard(net, dns)
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 60_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE_COMMIT}:${rel}`)); return baseCache.get(rel) }
const plain = value => JSON.parse(JSON.stringify(value)) // values built inside a vm have their own prototypes

// ---- the lib, evaluated in THIS realm with a fake process -----------------------------------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
function loadLib(text = read(LIB), env = { [FLAG]: 'true' }) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'process', compile(text, LIB))(module, module.exports, () => { throw new Error('the lib must stay import-free') }, { env })
  return module.exports
}

// ============================================================================================================================================
// 1. The lib
// ============================================================================================================================================
const KM = 'Revenue grew 20%'
function libChecks(libText = read(LIB)) {
  const lib = loadLib(libText)
  // -- the flag --------------------------------------------------------------------------------------------------------------------------
  for (const [value, want] of [[undefined, false], ['false', false], ['TRUE', false], ['1', false], [' true', false], ['', false], ['yes', false], ['true', true]]) assert.equal(lib.outlineCardG4FlagOn(value), want, `flag ${JSON.stringify(value)}`)
  assert.equal(loadLib(libText, {}).STUDIO_OUTLINE_CARD_G4_ENABLED, false, 'unset: off')
  assert.equal(loadLib(libText, { [FLAG]: 'true' }).STUDIO_OUTLINE_CARD_G4_ENABLED, true, '"true": on')
  assert.equal(loadLib(libText, { [FLAG]: 'on' }).STUDIO_OUTLINE_CARD_G4_ENABLED, false, '"on": off')
  // -- (a) the narrative ------------------------------------------------------------------------------------------------------------------
  const narrative = lib.outlineCardNarrative
  const gone = (text, want, why, ...key) => assert.equal(narrative(text, key.length ? key[0] : KM), want, why) // a key message given as undefined is not the default one
  const kept = (text, why, ...key) => assert.equal(narrative(text, key.length ? key[0] : KM), text, why)
  gone('Key message: Revenue grew 20%', '', 'the key message line alone: nothing is left')
  gone('Key message: Revenue grew 20%\nBody line', 'Body line', 'the leading line goes, the next stays')
  gone('Key message: Revenue grew 20%\n\nBody\n\nMore', 'Body\n\nMore', 'the blank lines right after it go with it; the ones between kept lines stay')
  gone('Key message: Revenue grew 20%\nA\nB\n', 'A\nB\n', 'every other line is kept, the trailing newline too')
  gone('  key   MESSAGE:  revenue  grew   20%   \nBody', 'Body', 'trimmed, whitespace collapsed, case ignored, the label dropped')
  gone('KEY MESSAGE:revenue grew 20%\nBody', 'Body', 'no space after the colon')
  gone('\n\nKey message: Revenue grew 20%\nBody', 'Body', 'blank lines before the leading line: the first line with text is the leading one')
  gone('Key message: Revenue grew 20%\r\nBody\r\n', 'Body\r\n', 'CRLF lines')
  gone('Key message: Revenue grew 20%\nBody', 'Body', 'a key message that carries the label itself', 'Key message: Revenue grew 20%')
  gone('Key message: Revenue grew 20%\nBody', 'Body', 'a key message with stray space and case', '  REVENUE   grew 20%  ')
  gone('Key message: Revenue grew 20%\nKey message: Revenue grew 20%\nBody', 'Key message: Revenue grew 20%\nBody', 'only the leading line, not a repeat of it')
  // negatives: the narrative comes back untouched
  kept('Setup line\nKey message: Revenue grew 20%\nBody', 'a different first line: the key message line further down is kept')
  kept('Key message: Something else\nBody', 'a different text: kept')
  kept('Key message: Revenue grew 20% in Q3\nBody', 'a longer text: kept')
  kept('Key message: Revenue grew\nBody', 'a shorter text: kept')
  kept('Revenue grew 20%\nBody', 'the same text without the label is not the "Key message:" line: kept')
  kept('Key messages: Revenue grew 20%\nBody', 'another label: kept')
  kept('Key message Revenue grew 20%\nBody', 'no colon: kept')
  kept('The key message: Revenue grew 20%\nBody', 'the label is not at the start of the line: kept')
  for (const unset of [undefined, null, '', '   ', 'Key message:', 5, {}]) kept('Key message: Revenue grew 20%\nBody', `key message ${JSON.stringify(unset)}: not set, kept`, unset)
  for (const unset of ['', '   ', 'Key message:', ' key MESSAGE: ']) kept('Key message:\nBody', `an empty label line and a key message that is not set (${JSON.stringify(unset)}): kept`, unset)
  for (const text of ['', '   \n  ', 'Body only']) kept(text, `nothing to strip: ${JSON.stringify(text)}`)
  for (const odd of [undefined, null, 7]) assert.equal(narrative(odd, KM), odd, `a narrative that is not a string comes back as it is: ${String(odd)}`)
  assert.equal(narrative(narrative('Key message: Revenue grew 20%\nBody', KM), KM), 'Body', 'stripping twice changes nothing more')
  // -- (b) the subtitle -------------------------------------------------------------------------------------------------------------------
  assert.equal(lib.outlineCardSubtitle('Q3 at a glance'), 'Q3 at a glance'); assert.equal(lib.outlineCardSubtitle('  Q3  '), 'Q3', 'trimmed')
  for (const bad of [undefined, null, '', '  \n ', 5, {}, []]) assert.equal(lib.outlineCardSubtitle(bad), null, `no subtitle: ${JSON.stringify(bad)}`)
  // -- (c) the empty research rule --------------------------------------------------------------------------------------------------------
  const empty = ctx => lib.outlineCardResearchEmpty(ctx)
  for (const ctx of [{ research_status: 'conceptual' }, { research_status: 'conceptual', citation_count: 0 }, { research_status: 'conceptual', citation_count: null }, { research_status: 'conceptual', source_types: [], research_issues: [] },
    { research_status: 'conceptual', research_ready: false }, { research_status: 'conceptual', research_ready: true }, { research_status: 'conceptual', key_message: KM }]) assert.equal(empty(ctx), true, `empty conceptual research: ${JSON.stringify(ctx)}`)
  for (const ctx of [null, undefined, {}, { research_status: null }, { research_status: '' }, { research_status: 'complete' }, { research_status: 'partial', citation_count: 0 }, { research_status: 'conceptual_draft' },
    { research_status: 'conceptual', citation_count: 1 }, { research_status: 'conceptual', citation_count: 12 }, { research_status: 'conceptual', source_types: ['web'] }, { research_status: 'conceptual', research_issues: ['thin'] },
    { research_status: 'conceptual', citation_count: 2, source_types: ['web'], research_issues: ['thin'] }, { research_ready: true }, { research_ready: false, citation_count: 0 }]) assert.equal(empty(ctx), false, `research stays: ${JSON.stringify(ctx)}`)
  // -- the view the card reads ------------------------------------------------------------------------------------------------------------
  const view = (enabled, slide, ctx, has) => plain(lib.outlineCardG4View(enabled, slide, ctx, has))
  const slide = { narrative: `Key message: ${KM}\nBody`, subtitle: 'Q3 at a glance' }
  const ctx = { key_message: KM, research_status: 'conceptual', citation_count: 0 }
  for (const has of [true, false]) assert.deepEqual(view(false, slide, ctx, has), { narrative: slide.narrative, subtitle: null, research: has }, `flag off: the slide's own narrative, no subtitle, hasResearch (${has})`)
  assert.deepEqual(view(true, slide, ctx, true), { narrative: 'Body', subtitle: 'Q3 at a glance', research: false }, 'flag on: all three fixes')
  assert.deepEqual(view(true, slide, { ...ctx, research_status: 'complete' }, true), { narrative: 'Body', subtitle: 'Q3 at a glance', research: true }, 'flag on, research with another status: kept')
  assert.deepEqual(view(true, { narrative: 'Body' }, undefined, false), { narrative: 'Body', subtitle: null, research: false }, 'flag on, nothing to fix, no research: no research')
  assert.deepEqual(view(true, { narrative: 'Body', subtitle: null }, null, true), { narrative: 'Body', subtitle: null, research: true }, 'flag on, no context: hasResearch as it was')
}

// ============================================================================================================================================
// 2. The REAL card on the offline React host
// ============================================================================================================================================
/** The card (and the lib it reads), with `overrides` (rel -> text) served to the loader in place of the files, and the flag on or off (or any value). */
function cardModule({ flag, overrides = {} }) {
  const fsReal = fs.readFileSync
  if (Object.keys(overrides).length) fs.readFileSync = function (file, ...rest) { const rel = typeof file === 'string' ? path.relative(repo, file) : null; return rel && rel in overrides ? overrides[rel] : fsReal.call(fs, file, ...rest) }
  try {
    const loader = createModuleLoader({
      root: repo,
      globals: { process: { env: { NODE_ENV: 'production', ...(flag === undefined ? {} : { [FLAG]: flag }) } }, console },
      stubs: { react: React, 'lucide-react': lucideStub(React) },
    })
    return loader.load(CARD).StudioOutlineCard
  } finally { fs.readFileSync = fsReal }
}
const html = element => renderToStaticMarkup(element)
const slideOf = (n, over = {}) => ({ slide_id: `s${n}`, slide_number: n, slide_type: 'content_heavy', title: `Slide ${n}`, narrative: '', key_points: [], analytics_needed: null, visuals_needed: null, diagrams_needed: null, structure_preference: null, ...over })
const payloadOf = slides => ({ operation: 'full_update', metadata: { main_title: 'Q3 Review', overall_theme: 'Corporate', design_suggestions: 'x', target_audience: 'Executives', presentation_duration: 20 }, slides, affected_slides: null })
const cardMarkup = (Card, slides, contexts, props = {}) => html(React.createElement(Card, { payload: payloadOf(slides), contextByIndex: contexts, renderEvidence: () => null, ...props }))
/** The expanded body of the only slide: what sits inside outline-review-content. */
const bodyOf = (Card, slide, ctx) => {
  const markup = cardMarkup(Card, [slide], ctx ? { 0: ctx } : null)
  const start = markup.indexOf('data-studio-director-part="outline-review-content">'), end = markup.indexOf('</details>', start)
  assert.ok(start > 0 && end > start, 'the expanded body is in the markup')
  const inner = markup.slice(start + 'data-studio-director-part="outline-review-content">'.length, end)
  assert.ok(inner.endsWith('</div>'), 'the body is a div'); return inner.slice(0, -'</div>'.length)
}
const withoutBodies = markup => markup.replace(/<div data-studio-director-part="outline-review-content">[\s\S]*?<\/details>/g, '</details>')

const SUB = text => `<p data-studio-director-part="outline-review-subtitle">${text}</p>`
const TAKE = text => `<p data-studio-director-part="outline-review-takeaway"><b>Key message</b>${text}</p>`
const NARR = text => `<p>${text}</p>`
const POINTS = points => `<ul>${points.map(point => `<li>${point}</li>`).join('')}</ul>`
const RESEARCH = inner => `<div data-studio-director-part="research-details"><strong>Research details</strong>${inner}</div>`
const CONCEPTUAL = ctx => ({ research_status: 'conceptual', ...ctx })

// each case: the slide, its context, and the body flag ON must draw (flag off is always the base's); `same` = nothing applies, so flag on is the base too
const FULL_NARRATIVE = `Key message: ${KM}\n\nGrowth came from enterprise.\nSecond line.`
const CASES = [
  { name: 'all three at once: the key message line is dropped, the subtitle drawn first, the empty conceptual research hidden; the key points stay',
    slide: slideOf(1, { narrative: FULL_NARRATIVE, subtitle: 'Q3 at a glance', key_points: ['alpha', 'beta'] }), ctx: CONCEPTUAL({ key_message: KM, citation_count: 0 }),
    on: SUB('Q3 at a glance') + TAKE(KM) + NARR('Growth came from enterprise.\nSecond line.') + POINTS(['alpha', 'beta']) },
  { name: '(a) normalised: case, spacing and a trailing space', slide: slideOf(2, { narrative: 'key  MESSAGE:  revenue grew   20% \nBody' }), ctx: { key_message: KM }, on: TAKE(KM) + NARR('Body') },
  { name: '(a) the key message line alone: no narrative paragraph at all', slide: slideOf(3, { narrative: `Key message: ${KM}` }), ctx: { key_message: KM }, on: TAKE(KM) },
  { name: '(a) negative: a different first narrative line is kept (the key message line further down stays)', slide: slideOf(4, { narrative: `Setup\nKey message: ${KM}` }), ctx: { key_message: KM }, same: true },
  { name: '(a) negative: a "Key message:" line with a different text is kept', slide: slideOf(5, { narrative: 'Key message: Something else\nBody' }), ctx: { key_message: KM }, same: true },
  { name: '(a) negative: no key message in the context: the narrative is kept whole', slide: slideOf(6, { narrative: `Key message: ${KM}\nBody` }), ctx: { narrative_role: 'opening' }, same: true },
  { name: '(a) negative: no context at all: the narrative is kept whole', slide: slideOf(7, { narrative: `Key message: ${KM}\nBody` }), ctx: null, same: true },
  { name: '(b) the subtitle alone, no context', slide: slideOf(8, { subtitle: 'A subtitle' }), ctx: null, on: SUB('A subtitle') },
  { name: '(b) the subtitle is trimmed', slide: slideOf(9, { subtitle: '  Padded subtitle  ', narrative: 'Body' }), ctx: { key_message: 'Hook' }, on: SUB('Padded subtitle') + TAKE('Hook') + NARR('Body') },
  { name: '(b) negative: a blank subtitle draws nothing', slide: slideOf(10, { subtitle: '   ', narrative: 'Body' }), ctx: null, same: true },
  { name: '(b) negative: a null subtitle draws nothing', slide: slideOf(18, { subtitle: null, narrative: 'Body' }), ctx: null, same: true },
  { name: '(c) hidden: conceptual with a citation count of 0 (flag off draws the block)', slide: slideOf(11, { narrative: 'Body' }), ctx: CONCEPTUAL({ citation_count: 0 }), on: NARR('Body') },
  { name: '(c) hidden: conceptual with the citation count missing, readiness given', slide: slideOf(12), ctx: CONCEPTUAL({ research_ready: true }), on: '' },
  { name: '(c) negative: another status keeps the block', slide: slideOf(13), ctx: { research_status: 'complete', citation_count: 0 }, same: true },
  { name: '(c) negative: conceptual with citations keeps the block', slide: slideOf(14), ctx: CONCEPTUAL({ citation_count: 4 }), same: true },
  { name: '(c) negative: conceptual with source types keeps the block', slide: slideOf(15), ctx: CONCEPTUAL({ citation_count: 0, source_types: ['web', 'report'] }), same: true },
  { name: '(c) negative: conceptual with issues keeps the block', slide: slideOf(16), ctx: CONCEPTUAL({ citation_count: 0, research_issues: ['thin'] }), same: true },
  { name: '(c) negative: no status, a readiness line alone keeps the block', slide: slideOf(17), ctx: { research_ready: false }, same: true },
]
async function cardChecks(overrides = {}) {
  const Base = cardModule({ flag: undefined, overrides: { [CARD]: baseText(CARD) } })
  const Off = cardModule({ flag: undefined, overrides }), OffFalse = cardModule({ flag: 'false', overrides }), On = cardModule({ flag: 'true', overrides })
  const odd = ['TRUE', '1', 'yes', ' true', 'on'].map(flag => [JSON.stringify(flag), cardModule({ flag, overrides })])
  // the base card draws what the defects say: the duplicate line, no subtitle, the empty research block
  const baseA = bodyOf(Base, CASES[0].slide, CASES[0].ctx)
  assert.ok(baseA.includes(`<p>${FULL_NARRATIVE}</p>`) && !baseA.includes('Q3 at a glance') && baseA.includes('research-details'), 'the base card has the three defects')
  // flag off: the base's markup for every variant and for slides carrying what the fix acts on
  const all = CASES.map(item => item.slide), contexts = Object.fromEntries(CASES.map((item, index) => [index, item.ctx]).filter(([, ctx]) => ctx))
  for (const props of [{}, { historyStatus: 'earlier' }, { historyStatus: 'current' }, { onCanvas: true }, { canvasSuperseded: true }, { outlineLabel: true, deckSlideCount: 3 }, { onCanvas: true, outlineLabel: true, deckSlideCount: 9 }]) {
    const was = cardMarkup(Base, all, contexts, props)
    assert.ok(was.includes('Slide 1') || props.onCanvas || props.canvasSuperseded, `the base card lists the slides inline: ${JSON.stringify(props)}`)
    for (const [label, Card] of [['unset', Off], ['"false"', OffFalse], ...odd]) assert.equal(cardMarkup(Card, all, contexts, props), was, `flag ${label} is the base card's markup byte for byte: ${JSON.stringify(props)}`)
  }
  for (const item of CASES) assert.equal(bodyOf(Off, item.slide, item.ctx), bodyOf(Base, item.slide, item.ctx), `flag off, the body is the base's: ${item.name}`)
  // flag on, case by case
  for (const item of CASES) {
    const was = bodyOf(Base, item.slide, item.ctx), now = bodyOf(On, item.slide, item.ctx)
    if (item.same) assert.equal(now, was, `flag on, nothing applies, so the base's body: ${item.name}`)
    else {
      assert.equal(now, item.on, `flag on: ${item.name}`)
      assert.notEqual(now, was, `flag on differs from the base here: ${item.name}`)
    }
  }
  // the key points are the base's markup, flag on or off, and the rest of the card (outside the bodies) is the base's too
  const points = slideOf(20, { narrative: `Key message: ${KM}\nBody`, subtitle: 'Sub', key_points: ['one', 'two', 'three'] })
  for (const Card of [Off, On]) assert.ok(bodyOf(Card, points, { key_message: KM }).includes(POINTS(['one', 'two', 'three'])), 'the key points are drawn as the base draws them')
  assert.equal(withoutBodies(cardMarkup(On, all, contexts)), withoutBodies(cardMarkup(Base, all, contexts)), 'flag on: everything outside the expanded bodies is the base\'s markup')
  assert.equal(withoutBodies(cardMarkup(On, all, contexts, { onCanvas: true })), withoutBodies(cardMarkup(Base, all, contexts, { onCanvas: true })), 'flag on, on the canvas: the same')
  // the order inside a body: subtitle, key message, narrative, key points, research
  assert.equal(bodyOf(On, slideOf(21, { narrative: 'Body', subtitle: 'Sub', key_points: ['p'] }), { key_message: 'KM', research_status: 'complete', citation_count: 2 }),
    SUB('Sub') + TAKE('KM') + NARR('Body') + POINTS(['p']) + RESEARCH('<p><b>Status</b>complete</p><p><b>Citations</b>2</p>'), 'the order: subtitle, key message, narrative, key points, research')
}

// ============================================================================================================================================
// 3. The sources
// ============================================================================================================================================
/** The strips of the changes registered after this one come out first (none today): a later change that touches these files must not hide this change's edits from the identity check. */
const laterStrips = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(stripModule.stripOutlineCardG4); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }
/** The older proofs this change teaches (their first-parent scope checks leave the commits whose subject starts "Outline card G4:" out). */
const PIN_FILES = ['scripts/test-studio-chat-element-edit.mjs', 'scripts/test-studio-deck-sync-truth.mjs']
const SECRET = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/
/** The only two base lines this change rewrites (the narrative paragraph and the research condition), as the base has them. */
const REWRITTEN = new Set(['                  {slide.narrative && <p>{slide.narrative}</p>}', '                  {hasResearch && ('])
/** The lines added to and removed from `was` to make `now` (a multiset difference by line). */
function lineDiff(was, now) {
  const count = new Map(); for (const line of was.split('\n')) count.set(line, (count.get(line) || 0) + 1)
  const added = []; for (const line of now.split('\n')) { const n = count.get(line) || 0; if (n > 0) count.set(line, n - 1); else added.push(line) }
  const removed = []; for (const [line, n] of count) for (let i = 0; i < n; i++) removed.push(line)
  return { added, removed }
}

/** The checks on the files as given: `texts` (rel -> text) for the card, the hook, the lib and .env.example; `mod` is the strip module under test. */
function sourceChecks(texts, mod = stripModule) {
  const { stripOutlineCardG4, OUTLINE_CARD_G4_FILES: files, OUTLINE_CARD_G4_ENV_BLOCK: block } = mod
  // the strip gives each touched file its base back, byte for byte, and is idempotent
  for (const rel of files) {
    const now = laterStrips(rel, texts[rel]), out = stripOutlineCardG4(rel, now)
    assert.equal(out, baseText(rel), `${rel}: without this change's edits the file is the base's, byte for byte`)
    assert.equal(stripOutlineCardG4(rel, out), out, `${rel}: stripping twice changes nothing more`)
    assert.notEqual(now, baseText(rel), `${rel}: the change is there to strip`)
  }
  for (const rel of ['app/builder/page.tsx', 'components/builder/message-list.tsx', '.env.example', REGISTRY]) assert.equal(stripOutlineCardG4(rel, 'x\nOUTLINE-CARD-G4\n'), 'x\nOUTLINE-CARD-G4\n', `${rel}: a file this change does not own comes back as it is`)
  assert.equal(stripOutlineCardG4(CARD, 5), 5, 'a text that is not a string comes back as it is')
  // every marked line is where it should be: five in the card, one in the hook; every line a file gains carries the marker, and the only base lines lost are the two rewritten ones
  assert.equal(texts[CARD].split('\n').filter(line => OUTLINE_CARD_G4_MARKER_RE.test(line)).length, 5, 'the card carries the marker on five lines')
  assert.equal(texts[HOOK].split('\n').filter(line => OUTLINE_CARD_G4_MARKER_RE.test(line)).length, 1, 'the socket hook carries the marker on one line')
  for (const rel of files) {
    const diff = lineDiff(baseText(rel), laterStrips(rel, texts[rel]))
    for (const line of diff.added) assert.match(line, OUTLINE_CARD_G4_MARKER_RE, `${rel}: a line added to the file carries the marker: ${line.trim().slice(0, 100)}`)
    for (const line of diff.removed) assert.ok(rel === CARD && REWRITTEN.has(line), `${rel}: a base line is lost that this change does not rewrite: ${line.trim().slice(0, 100)}`)
    assert.equal(diff.removed.length, rel === CARD ? 2 : 0, `${rel}: the base lines this change rewrites`)
  }
  // the older proofs this change teaches: each gains one marked line (the first-parent walk leaves this change's commits out) and is the base's without it
  assert.deepEqual([...mod.OUTLINE_CARD_G4_PIN_FILES].sort(), PIN_FILES, 'the older proofs this change teaches')
  for (const rel of PIN_FILES) {
    const now = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), now)
    assert.equal(stripOutlineCardG4(rel, now), baseText(rel), `${rel}: without this change's line the proof is the base's, byte for byte`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, 1], `${rel}: the proof gains one line and loses none`)
    assert.ok(diff.added[0].includes(mod.OUTLINE_CARD_G4_PIN_MARK) && diff.added[0].includes('^Outline card G4:'), `${rel}: the line carries the pin mark and names this change's subject`)
  }
  // the voice-call proof: FRONTEND-1's four-line after-merge edit (2 lines inserted after the strip import, 2 lines changed), the same four lines FRONTEND-2's #603 carries byte for byte (so both merge clean in either order); every added line carries #603's mark
  assert.deepEqual([...mod.OUTLINE_CARD_G4_VOICE_CALL_PIN_FILES], [VOICE_CALL], 'the one voice-call proof this change edits')
  {
    const now = texts[VOICE_CALL], diff = lineDiff(baseText(VOICE_CALL), now)
    assert.equal(stripOutlineCardG4(VOICE_CALL, laterStrips(VOICE_CALL, now)), baseText(VOICE_CALL), `${VOICE_CALL}: without the four lines the proof is the base's, byte for byte`)
    assert.equal(stripOutlineCardG4(VOICE_CALL, stripOutlineCardG4(VOICE_CALL, now)), stripOutlineCardG4(VOICE_CALL, now), `${VOICE_CALL}: stripping twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [2, 4], `${VOICE_CALL}: two base lines changed and two lines inserted, nothing else`)
    for (const line of diff.added) assert.ok(line.endsWith(mod.OUTLINE_CARD_G4_VOICE_CALL_PIN_MARK), `${VOICE_CALL}: a line added carries the registry-read mark: ${line.trim().slice(0, 90)}`)
    const lines = now.split('\n'), at = lines.indexOf(mod.OUTLINE_CARD_G4_VOICE_CALL_PIN_ANCHOR)
    assert.ok(at >= 0 && lines[at + 1].startsWith('const laterRegistry = await import(') && lines[at + 2].startsWith('const laterEnvOut = text =>'), `${VOICE_CALL}: the two inserted lines sit right after the strip import`)
    assert.equal(now.split('\n').filter(line => line.includes('laterEnvOut(')).length, 2, `${VOICE_CALL}: the helper is read by the two .env.example pins`)
  }
  assert.match(texts[HOOK], /^      subtitle\?: string \| null; \/\/ OUTLINE-CARD-G4$/m, 'the slide type gains `subtitle?: string | null`')
  // the lib: one literal env read, import-free; nothing else reads the env
  assert.equal((texts[LIB].match(/process\.env\.NEXT_PUBLIC_STUDIO_OUTLINE_CARD_G4\b/g) || []).length, 1, 'the lib reads the literal env name once')
  assert.deepEqual([...texts[LIB].matchAll(/^import .*$/gm)].map(m => m[0]), [], 'the lib is import-free')
  for (const rel of [CARD, HOOK]) assert.equal((texts[rel].match(/process\.env\.NEXT_PUBLIC_STUDIO_OUTLINE_CARD_G4\b/g) || []).length, 0, `${rel} does not read the env itself`)
  assert.match(texts[CARD], /import \{ STUDIO_OUTLINE_CARD_G4_ENABLED, outlineCardG4View \} from "@\/lib\/studio-outline-card-g4" \/\/ OUTLINE-CARD-G4/, 'the card reads the lib\'s constant')
  // .env.example: the base plus the block (after one blank line); the flag is documented "false", once
  assert.equal(texts['.env.example'], `${baseText('.env.example')}\n${block}`, '.env.example is the base plus the block')
  assert.match(block, new RegExp(`^${FLAG}="false"$`, 'm'), 'the block documents the flag as "false"')
  assert.equal((texts['.env.example'].match(new RegExp(FLAG, 'g')) || []).length, 1, '.env.example names the flag once')
}

/** The registry checks on the registry's text. */
function registryChecks(text, texts = TEXTS) {
  const { OUTLINE_CARD_G4_SCOPE_FILES: scope, stripOutlineCardG4, OUTLINE_CARD_G4_ENV_BLOCK: block } = stripModule
  for (const list of ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS']) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const own = text.slice(start, end).split('\n').findIndex(line => line.includes('studio-outline-card-g4-strip.mjs')), voice = text.slice(start, end).split('\n').findIndex(line => line.includes('studio-voice-call-strip.mjs'))
    assert.ok(own > voice && voice > 0, `${list}: this change's line comes after the voice call's (the end of the stack at the time)`)
    assert.equal((text.slice(start, end).match(/studio-outline-card-g4-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-outline-card-g4-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines'); assert.ok(registered.every(line => line.includes('// LATER-CHANGE: FRONTEND-1, outline card G4')), 'each carries the registry marker')
  assert.deepEqual(lineDiff(baseText(REGISTRY), text).removed, [], 'and loses none')
  assert.equal(lineDiff(baseText(REGISTRY), text).added.filter(line => registered.includes(line)).length, 3, 'the three lines are what it gains (a change registered later adds its own)')
  assert.ok(registry.LATER_STRIPS.includes(stripOutlineCardG4), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(block), 'the block is registered')
  assert.ok([...scope].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  for (const rel of OUTLINE_CARD_G4_FILES) assert.equal(registry.stripLaterChanges(rel, texts[rel]), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is the base's (older proofs read it like that)`)
  assert.equal(registry.stripLaterEnvBlocks('.env.example', texts['.env.example']).includes(FLAG), false, 'the registry takes the block out of .env.example')
}

/** This change's own commits, found by SUBJECT across `rev-list --no-merges` (so a merge of dev does not hide or add any). */
function ownCommits(ref = 'HEAD') { return git('rev-list', '--no-merges', `${BASE_COMMIT}..${ref}`).split('\n').filter(Boolean).filter(commit => git('log', '-1', '--format=%s', commit).startsWith(OUTLINE_CARD_G4_SUBJECT)) }
/** The files that differ from the base: what this change's own commits touch, that the COMMITTED diff BASE..HEAD still shows (a file put back to the base nets to nothing). Nothing is read from the working tree, the index or the untracked files: a polluted tree must not fail the scope check. */
function touchedFiles(commits) { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(commit => git('show', '--name-only', '--format=', commit).split('\n')).filter(rel => rel && net.has(rel))) }
function scopeCheck(commits, extra = []) { assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !OUTLINE_CARD_G4_SCOPE_FILES.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base') }
/** What is wrong with one commit message (an empty list: nothing). */
function messageProblems(subject, body) {
  const problems = []
  if (!subject.startsWith(OUTLINE_CARD_G4_SUBJECT)) problems.push(`the subject starts "${OUTLINE_CARD_G4_SUBJECT}"`)
  if (!/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line')
  return problems
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
const TEXTS = Object.fromEntries([LIB, CARD, HOOK, '.env.example', REGISTRY, STRIP, 'scripts/test-studio-outline-card-g4.mjs', ...PIN_FILES, VOICE_CALL].map(rel => [rel, read(rel)]))

await check('1. the lib: the flag, (a) the narrative, (b) the subtitle, (c) the empty research rule, the view the card reads', () => libChecks())
await check('2. the REAL card: flag off is the base card\'s markup byte for byte (every variant, every odd flag value); flag on does (a), (b) and (c) and nothing else, with their negatives', () => cardChecks())
await check('3a. the strip gives the card and the hook their base back byte for byte; every marked line is where it should be; the lib, the flag read and .env.example', () => sourceChecks(TEXTS))
await check('3b. the registry names this change in all three lists (strip, block, files) and loses nothing; read through it, the files are the base\'s', () => registryChecks(TEXTS[REGISTRY]))
await check('3c. the scope: every file that differs from the base (own commits, edited, new) is this change\'s; the own commits carry the subject and the co-author line; no secret-shaped literal in the new files', () => {
  const own = ownCommits()
  scopeCheck(own)
  assert.deepEqual(OUTLINE_CARD_G4_NEW_FILES.filter(rel => !fs.existsSync(path.join(repo, rel))), [], 'the new files exist')
  if (git('status', '--porcelain').trim() === '') assert.ok(own.length >= 1, 'a clean tree has this change committed (commits whose subject starts "Outline card G4:")')
  for (const commit of own) assert.deepEqual(messageProblems(git('log', '-1', '--format=%s', commit).trim(), git('log', '-1', '--format=%B', commit)), [], `commit ${commit.slice(0, 8)}`)
  for (const rel of [...OUTLINE_CARD_G4_NEW_FILES, '.env.example']) assert.doesNotMatch(read(rel), SECRET, `${rel}: no secret-shaped literal`)
})

// ============================================================================================================================================
// 4. Mutants: each must be caught
// ============================================================================================================================================
const mutate = (text, from, to, name) => { assert.equal(text.split(from).length - 1, 1, `mutant "${name}": the text to change is there exactly once`); return text.replace(from, () => to) }
const dataModule = text => import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)
const LIB_TEXT = TEXTS[LIB], CARD_TEXT = TEXTS[CARD], HOOK_TEXT = TEXTS[HOOK]
// [name, text to change, the change]: the lib's behaviour is proved by 1 and 2 together
const LIB_MUTANTS = [
  ['the flag accepts "1"', "return value === 'true'", "return value === 'true' || value === '1'"],
  ['the flag is always on', "return value === 'true'", 'return true'],
  ['the view ignores the flag', 'if (!enabled) return', 'if (false) return'],
  ['the narrative is stripped without the label (any line equal to the key message)', "if (!lead.startsWith(LABEL) || lead.slice(LABEL.length).trim() !== wanted) return narrative", "if (lead.slice(lead.startsWith(LABEL) ? LABEL.length : 0).trim() !== wanted) return narrative"],
  ['the narrative is stripped whatever the text says', "|| lead.slice(LABEL.length).trim() !== wanted) return narrative", ") return narrative"],
  ['the narrative match is "starts with", not "equals"', "lead.slice(LABEL.length).trim() !== wanted)", "!lead.slice(LABEL.length).trim().startsWith(wanted))"],
  ['the comparison is case sensitive', "text.trim().replace(/\\s+/g, ' ').toLowerCase()", "text.trim().replace(/\\s+/g, ' ')"],
  ['the comparison does not collapse whitespace', "text.trim().replace(/\\s+/g, ' ').toLowerCase()", 'text.trim().toLowerCase()'],
  ['the comparison does not trim', "text.trim().replace(/\\s+/g, ' ').toLowerCase()", "text.replace(/\\s+/g, ' ').toLowerCase()"],
  ['the first line with text is not the leading one (only line 0)', "const first = lines.findIndex(line => line.trim() !== '')", 'const first = 0'],
  ['a key message line further down is stripped too', "const first = lines.findIndex(line => line.trim() !== '')", "const first = lines.findIndex(line => normalise(line).startsWith(LABEL))"],
  ['the blank lines after the stripped line stay', "while (from < lines.length && lines[from].trim() === '') from++", ''],
  ['every line after the stripped one is dropped', 'return lines.slice(from).join(\'\\n\')', "return ''"],
  ['the stripped narrative loses its other lines\' newlines', 'return lines.slice(from).join(\'\\n\')', "return lines.slice(from).join(' ')"],
  ['an unset key message still strips', "if (wanted === '') return narrative", ''],
  ['a non-string key message is not checked', "typeof keyMessage !== 'string'", 'false'],
  ['the subtitle is not trimmed', "subtitle.trim() : null", "subtitle : null"],
  ['a blank subtitle is drawn', "typeof subtitle === 'string' && subtitle.trim() !== '' ?", "typeof subtitle === 'string' ?"],
  ['the research rule ignores the status', "context.research_status === 'conceptual' && ", ''],
  ['the research rule ignores the citations', "!(Number(context.citation_count) > 0) && ", ''],
  ['the research rule ignores the source types', "!context.source_types?.length && ", ''],
  ['the research rule ignores the issues', " && !context.research_issues?.length", ''],
  ['the research rule hides every status', "context.research_status === 'conceptual'", "typeof context.research_status === 'string'"],
  ['hasResearch is ignored (research is always drawn)', 'research: hasResearch && !outlineCardResearchEmpty(context)', 'research: true'],
  ['hasResearch is ignored (research is never drawn)', 'research: hasResearch && !outlineCardResearchEmpty(context)', 'research: false'],
  ['the research rule is not applied', 'research: hasResearch && !outlineCardResearchEmpty(context)', 'research: hasResearch'],
  ['the subtitle is not passed on', 'subtitle: outlineCardSubtitle(slide.subtitle),', 'subtitle: null,'],
  ['the narrative is not passed on', 'narrative: outlineCardNarrative(slide.narrative, context?.key_message),', 'narrative: slide.narrative,'],
  ['the lib imports something', 'export function outlineCardG4FlagOn', "import { x } from '@/lib/x'\nexport function outlineCardG4FlagOn"],
]
for (const [name, from, to] of LIB_MUTANTS) {
  await check(`mutant caught: lib: ${name}`, async () => {
    const mutant = mutate(LIB_TEXT, from, to, name)
    assert.ok(await throws(async () => { libChecks(mutant); await cardChecks({ [LIB]: mutant }); sourceChecks({ ...TEXTS, [LIB]: mutant }) }), 'sections 1 to 3 must fail')
  })
}
const CARD_MUTANTS = [
  ['the narrative paragraph reads the slide again', '{g4.narrative && <p>{g4.narrative}</p>}', '{slide.narrative && <p>{slide.narrative}</p>}'],
  ['the research block reads hasResearch again', '{g4.research && (', '{hasResearch && ('],
  ['the subtitle is not drawn', '{g4.subtitle && <p data-studio-director-part="outline-review-subtitle">{g4.subtitle}</p>}', ''],
  ['the subtitle is drawn after the key message', '{g4.subtitle && <p data-studio-director-part="outline-review-subtitle">{g4.subtitle}</p>}{/* OUTLINE-CARD-G4 */}\n                  {context?.key_message && <p data-studio-director-part="outline-review-takeaway"><b>Key message</b>{context.key_message}</p>}', '{context?.key_message && <p data-studio-director-part="outline-review-takeaway"><b>Key message</b>{context.key_message}</p>}\n                  {g4.subtitle && <p data-studio-director-part="outline-review-subtitle">{g4.subtitle}</p>}{/* OUTLINE-CARD-G4 */}'],
  ['the card hands the view true instead of the flag', 'outlineCardG4View(STUDIO_OUTLINE_CARD_G4_ENABLED,', 'outlineCardG4View(true,'],
  ['the key points are changed (first only)', "{slide.key_points?.length > 0 && <ul>{slide.key_points.map(", "{slide.key_points?.length > 0 && <ul>{slide.key_points.slice(0, 1).map("],
  ['the key message line is changed', '<b>Key message</b>{context.key_message}', '<b>Key message</b>{context.key_message.toUpperCase()}'],
  ['the research block loses its status line', '{context?.research_status && <p><b>Status</b>', '{false && <p><b>Status</b>'],
  ['the flag is read from the env by the card', 'outlineCardG4View(STUDIO_OUTLINE_CARD_G4_ENABLED,', 'outlineCardG4View(process.env.NEXT_PUBLIC_STUDIO_OUTLINE_CARD_G4 === "true",'],
  ['an unmarked line is added to the card', 'import type { ReactNode } from "react"\n', 'import type { ReactNode } from "react"\nimport { extra } from "./extra"\n'],
  ['the view line loses its marker', ' // OUTLINE-CARD-G4: flag off = the slide\'s own narrative, no subtitle, hasResearch', ''],
]
for (const [name, from, to] of CARD_MUTANTS) {
  await check(`mutant caught: card: ${name}`, async () => {
    const mutant = mutate(CARD_TEXT, from, to, name)
    assert.ok(await throws(async () => { await cardChecks({ [CARD]: mutant }); sourceChecks({ ...TEXTS, [CARD]: mutant }) }), 'sections 2 and 3 must fail')
  })
}
await check('mutant caught: the hook without the subtitle line (the strip would restore a line it never had; the type check line fails)', async () => {
  const mutant = mutate(HOOK_TEXT, '      subtitle?: string | null; // OUTLINE-CARD-G4\n', '', 'hook')
  assert.ok(await throws(() => sourceChecks({ ...TEXTS, [HOOK]: mutant })))
})
await check('mutant caught: an unmarked line in the hook', async () => {
  const mutant = mutate(HOOK_TEXT, '      speaker_notes?: string | null;\n', '      speaker_notes?: string | null;\n      extra_field?: string;\n', 'hook extra')
  assert.ok(await throws(() => sourceChecks({ ...TEXTS, [HOOK]: mutant })))
})
await check('mutant caught: the card\'s marker is on a different line (a base line rewritten without its pair)', async () => {
  const mutant = mutate(CARD_TEXT, '                  {g4.research && ( // OUTLINE-CARD-G4\n', '                  {g4.research && (  // OUTLINE-CARD-G4\n', 'spacing')
  assert.ok(await throws(() => sourceChecks({ ...TEXTS, [CARD]: mutant })), 'the strip pair no longer matches, so the file is not put back')
})
await check('mutant caught: a taught proof with an unmarked extra line, or without this change\'s line', async () => {
  const rel = PIN_FILES[0], text = TEXTS[rel]
  assert.ok(await throws(() => sourceChecks({ ...TEXTS, [rel]: text + '// stray\n' })), 'an unmarked extra line')
  assert.ok(await throws(() => sourceChecks({ ...TEXTS, [rel]: text.split('\n').filter(line => !line.includes('registry read (OUTLINE-CARD-G4)')).join('\n') })), 'the line removed (the proof would fail on this change\'s own commits)')
  assert.ok(await throws(() => sourceChecks({ ...TEXTS, [rel]: text.replace('registry read (OUTLINE-CARD-G4)', 'registry read (OTHER)') })), 'the pin mark changed')
})
await check('mutant caught: .env.example with the flag on by default, or the block missing', async () => {
  assert.ok(await throws(() => sourceChecks({ ...TEXTS, '.env.example': TEXTS['.env.example'].replace(`${FLAG}="false"`, `${FLAG}="true"`) })))
  assert.ok(await throws(() => sourceChecks({ ...TEXTS, '.env.example': baseText('.env.example') })))
})
const STRIP_TEXT = TEXTS[STRIP]
/** The one line of the strip that holds `needle` (a mutant takes a whole [has, was] pair line out). */
const stripLine = needle => { const found = STRIP_TEXT.split('\n').filter(line => line.includes(needle)); assert.equal(found.length, 1, `the strip has one line with ${needle}`); return found[0] }
const STRIP_MUTANTS = [
  ['the strip puts nothing back', 'return (OUTLINE_CARD_G4_EDITS[rel] || OUTLINE_CARD_G4_PIN_EDITS[rel] || OUTLINE_CARD_G4_VOICE_CALL_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)', 'return text'],
  ['the narrative pair puts back the marked line', "`                  {slide.narrative && <p>{slide.narrative}</p>}\\n`],", "`                  {g4.narrative && <p>{g4.narrative}</p>}\\n`],"],
  ['the research pair puts back a different condition', "`                  {hasResearch && (\\n`],", "`                  {hasResearch && !x && (\\n`],"],
  ['the subtitle pair is missing', "    [`                  {g4.subtitle && <p data-studio-director-part=\"outline-review-subtitle\">{g4.subtitle}</p>}${JSX_MARK}\\n`, ''],\n", ''],
  ['the element-edit pin pair is missing', "    [`${SPLICE}${OUTLINE_CARD_G4_PIN_MARK}: on a branch stacked after this change (the outline card G4's), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\\n`, ''],\n", ''],
  ['the deck-sync pin pair puts back a changed line', "the first-parent commits are its own, not this change's; with none left the identity checks cover the files\\n`, ''],", "the first-parent commits are its own, not this change's; with none left the identity checks cover the files\\n`, 'x\\n'],"],
  ['the hook pair is missing', "    [`      subtitle?: string | null; ${MARK}\\n`, ''],\n", ''],
  ['the strip touches a file it does not own', 'if (!(rel in OUTLINE_CARD_G4_EDITS) && !(rel in OUTLINE_CARD_G4_PIN_EDITS) && !(rel in OUTLINE_CARD_G4_VOICE_CALL_PIN_EDITS)) return text', "if (rel === 'app/builder/page.tsx') return text.toUpperCase()"],
  ['the strip does not know the voice-call proof', 'if (!(rel in OUTLINE_CARD_G4_EDITS) && !(rel in OUTLINE_CARD_G4_PIN_EDITS) && !(rel in OUTLINE_CARD_G4_VOICE_CALL_PIN_EDITS)) return text', 'if (!(rel in OUTLINE_CARD_G4_EDITS) && !(rel in OUTLINE_CARD_G4_PIN_EDITS)) return text'],
  ['the voice-call import pair is missing', `${stripLine("const laterRegistry = await import(")}\n`, ''],
  ['the voice-call helper pair is missing', `${stripLine('const laterEnvOut = text =>')}\n`, ''],
  ['the voice-call "last thing in the file" pair puts back a changed line', '"  ok(env.endsWith(', '"  ok(env.startsWith('],
  ['the voice-call ".env.example adds its block" pair puts back a changed line', '"    ok(envDiff.map(', '"    ok(envDiff.filter('],
  ['the voice-call ".env.example adds its block" pair is missing', `${stripLine("ok(laterEnvOut(`${envDiff")}\n`, ''],
]
for (const [name, from, to] of STRIP_MUTANTS) {
  await check(`mutant caught: strip: ${name}`, async () => {
    const mutant = await dataModule(mutate(STRIP_TEXT, from, to, name))
    assert.ok(await throws(() => sourceChecks(TEXTS, mutant)), 'section 3 must fail')
  })
}
await check('mutant caught: a stray file outside the scope (in a commit) fails the scope check, a polluted working tree does not; a commit message without the subject or the co-author line fails the message check', async () => {
  const own = ownCommits()
  assert.doesNotThrow(() => scopeCheck(own), 'the real tree passes')
  assert.ok(await throws(() => scopeCheck(own, ['stray-outline-card-g4.txt'])), 'a stray file fails the scope check')
  assert.ok(await throws(() => scopeCheck(own, ['app/builder/page.tsx'])), 'an app file nobody registered fails it too')
  // the scope reads the COMMITTED diff only: an untracked file in the tree (or an edited, or a staged one) is not a file this change commits, so it changes nothing
  const stray = path.join(repo, 'stray-outline-card-g4.txt'), before = [...touchedFiles(own)].sort()
  fs.writeFileSync(stray, 'stray\n')
  try { assert.deepEqual([...touchedFiles(own)].sort(), before, 'an untracked stray file does not change the files read'); assert.doesNotThrow(() => scopeCheck(own), 'and does not fail the scope check') } finally { fs.rmSync(stray) }
  assert.deepEqual(messageProblems('Outline card G4: a change', 'body\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), [], 'a good message has no problem')
  assert.deepEqual(messageProblems('Outline card G4: a change', 'body\n'), ['the co-author line'], 'no co-author line')
  assert.deepEqual(messageProblems('Fix the card', 'body\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), [`the subject starts "${OUTLINE_CARD_G4_SUBJECT}"`], 'another subject')
})
await check('mutant caught: the registry without one of the three lines, with a line changed, or with a base line lost', async () => {
  const text = TEXTS[REGISTRY], lines = text.split('\n')
  const mine = lines.map((line, index) => [line, index]).filter(([line]) => line.includes('studio-outline-card-g4-strip.mjs'))
  assert.equal(mine.length, 3)
  assert.doesNotThrow(() => registryChecks(text), 'the real registry passes')
  for (const [, index] of mine) assert.ok(await throws(() => registryChecks(lines.filter((_, at) => at !== index).join('\n'))), `without line ${index + 1}`)
  assert.ok(await throws(() => registryChecks(text.replace('// LATER-CHANGE: FRONTEND-1, outline card G4: key message once', '// LATER-CHANGE: FRONTEND-1, outline card: key message once'))), 'a changed marker comment')
  assert.ok(await throws(() => registryChecks(lines.filter(line => !line.includes('studio-voice-call-strip.mjs')).join('\n'))), 'a base line lost')
  assert.ok(await throws(() => registryChecks(lines.filter(line => !line.includes('one line per later change, above this comment')).join('\n'))), 'the marker comments lost')
})

release()
console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
