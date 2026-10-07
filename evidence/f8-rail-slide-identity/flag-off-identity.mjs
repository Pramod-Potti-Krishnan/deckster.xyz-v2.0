// Flag-off identity proof for F8 / S-03 (frontend half). One-off evidence script, not part of the test suite.
// Run from the repo root: node evidence/f8-rail-slide-identity/flag-off-identity.mjs [baseRef]
// 1. Every F8 edit to presentation-viewer.tsx and slide-thumbnail-strip.tsx is a known snippet; with those snippets
//    removed, both files are byte-identical (sha256) to the base commit's.
// 2. The viewer's slideThumbnails logic, extracted from the base commit and from this branch, is run over a matrix of
//    viewer states with railIdentityRows = null (what the hook returns when the flag is off): output hashes are equal.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const baseRef = process.argv[2] ?? 'origin/studio-v4-dev-preparation-code'
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const base = file => execFileSync('git', ['show', `${baseRef}:${file}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const here = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')

const VIEWER_EDITS = [
  ["import { useSlideRailIdentity } from '@/hooks/use-slide-rail-identity'\nimport { STUDIO_RAIL_SLIDE_IDENTITY_ENABLED } from '@/lib/slide-rail-identity'\n", ''],
  ["  // F8/S-03 rail identity: the post-ack closures below re-read Layout's slide inventory through this.\n  const slideRailRefreshRef = useRef<() => void>(() => {})\n", ''],
  ["      slideRailRefreshRef.current()\n    }\n  }, [studioShell, renderSlideMutationOwner])", "    }\n  }, [studioShell, renderSlideMutationOwner])"],
  [/  \/\/ F8\/S-03 \(flag NEXT_PUBLIC_STUDIO_RAIL_SLIDE_IDENTITY_ENABLED[\s\S]*?  slideRailRefreshRef\.current = refreshSlideRail\n\n/, ''],
  ["    if (railIdentityRows) return railIdentityRows\n", ''],
  ["[railIdentityRows, slideStructure, totalSlides,", "[slideStructure, totalSlides,"],
  ["        slideRailRefreshRef.current() // F8/S-03: re-read the slide inventory after the Add ack\n", ''],
  ["                keyBySlideId={railIdentityRows !== null}\n", ''],
]
const STRIP_EDITS = [
  [/  \/\*\* F8\/S-03: rows come from Layout's slide inventory[\s\S]*?  keyBySlideId\?: boolean\n/, ''],
  ["  keyBySlideId = false,\n", ''],
  ["    const itemKey = keyBySlideId && slide.slideId ? `slide-${slide.slideId}` : realSlideNumber\n", ''],
  ["<ContextMenu key={itemKey}>", "<ContextMenu key={realSlideNumber}>"],
  ["<React.Fragment key={itemKey}>", "<React.Fragment key={realSlideNumber}>"],
]
function revert(text, edits) {
  let out = text
  for (const [from, to] of edits) {
    const next = typeof from === 'string' ? (out.includes(from) ? out.replace(from, to) : out) : out.replace(from, to)
    assert.notEqual(next, out, `F8 snippet not found: ${String(from).slice(0, 70)}`)
    out = next
  }
  return out
}
const report = {}
for (const [file, edits] of [['components/presentation-viewer.tsx', VIEWER_EDITS], ['components/slide-thumbnail-strip.tsx', STRIP_EDITS]]) {
  const baseText = base(file), reverted = revert(here(file), edits)
  report[file] = { base_sha256: sha(baseText), branch_minus_f8_sha256: sha(reverted), branch_sha256: sha(here(file)) }
  assert.equal(reverted, baseText, `${file}: branch minus F8 snippets differs from ${baseRef}`)
}

// ---- behaviour: the viewer's slideThumbnails logic, base vs branch (rows null)
function memoBody(text) {
  const start = text.indexOf('  const slideThumbnails = useMemo<SlideThumbnail[]>(() => {\n')
  const end = text.indexOf('\n  }, [', start)
  assert.ok(start > 0 && end > start, 'memo not found')
  return text.slice(start + '  const slideThumbnails = useMemo<SlideThumbnail[]>(() => {\n'.length, end)
}
const stageF = ts.transpileModule(here('lib/stage-f-thumbnails.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const stageFModule = { exports: {} }
vm.runInNewContext(stageF, { module: stageFModule, exports: stageFModule.exports })
function runnable(body) {
  const js = ts.transpileModule(`function f(env) { const { railIdentityRows, slideStructure, totalSlides, slidesModifiedByCrud, thumbnailUrlsBySlide, studioShell, presentationId, studioCanonicalThumbnails, renderSlideMutationOwner, thumbnailNativeRevisionRef, thumbnailMetadataRef } = env;\n${body}\n}`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
  const ctx = { applyStageFThumbnailUrls: stageFModule.exports.applyStageFThumbnailUrls, ownedRestoredThumbnailUrl: stageFModule.exports.ownedRestoredThumbnailUrl }
  vm.runInNewContext(js, ctx)
  return ctx.f
}
const baseMemo = runnable(memoBody(base('components/presentation-viewer.tsx')))
const branchMemo = runnable(memoBody(here('components/presentation-viewer.tsx')))
const structure = n => ({ metadata: { main_title: 'Deck' }, slides: Array.from({ length: n }, (_, i) => ({
  slide_id: `slide_00${i + 1}`, title: i === 1 ? undefined : `Title ${i + 1}`, slide_type: 'content_slide', narrative: `n${i}`,
  thumbnail_presentation_id: i === 0 ? 'deck-a' : undefined, thumbnail_url: i === 0 ? 'https://img.test/a.png' : undefined })) })
const owner = {}
const scenarios = []
for (const studioShell of [false, true])
  for (const slideStructure of [null, structure(0), structure(3), structure(7)])
    for (const totalSlides of [0, 3, 4, 7, 8])
      for (const slidesModifiedByCrud of [false, true])
        for (const urls of [{}, { 0: 'https://img.test/0.png', 2: 'https://img.test/2.png' }])
          for (const canonical of [null, { owner, nativeRevision: 0, metadataRevision: 0, rows: Array.from({ length: totalSlides }, (_, i) => ({ slideNumber: i + 1, title: `C${i}` })) }])
            scenarios.push({ railIdentityRows: null, slideStructure, totalSlides, slidesModifiedByCrud, thumbnailUrlsBySlide: urls, studioShell,
              presentationId: 'deck-a', studioCanonicalThumbnails: canonical, renderSlideMutationOwner: owner,
              thumbnailNativeRevisionRef: { current: 0 }, thumbnailMetadataRef: { current: { revision: 0 } } })
const run = (fn) => scenarios.map(env => JSON.stringify(fn(env)))
const baseOut = run(baseMemo), branchOut = run(branchMemo)
assert.deepEqual(branchOut, baseOut)
report.scenarios = scenarios.length
report.output_sha256_base = sha(baseOut.join('\n'))
report.output_sha256_branch = sha(branchOut.join('\n'))
assert.equal(report.output_sha256_base, report.output_sha256_branch)
console.log(JSON.stringify(report, null, 2))
console.log('FLAG-OFF IDENTITY: OK')
