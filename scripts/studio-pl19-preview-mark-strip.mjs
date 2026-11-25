// PL-19 (Platform card, 25 Nov): a Vercel PREVIEW build shows one fixed mark on every Studio page. The ONLY existing file it touches is next.config.mjs (the build-time hook), which older proofs hold to the base commit byte for byte.
// So this change registers a code strip: stripPl19PreviewMark(rel, text) takes its three exact insertions back out of next.config.mjs and returns every other file untouched. No .env.example block (no flag, no setting). Plain node, nothing read from disk or git here.

import { stripVoiceCore } from './studio-voice-core-strip.mjs'
import { stripUploadFormats } from './studio-upload-formats-strip.mjs'
// The two older changes whose strips also edit the proofs this change teaches (voice core: the UAT marketing proof; upload formats: the Research by level and My companions proofs). The registry runs them BEFORE this strip, on lines this change had edited, so
// they could not read those lines; after this strip puts a proof back to dev's text they are run again, in registry order (a strip that finds nothing of its own to take out changes nothing). Readers that apply only the strips registered after theirs pass rerunEarlier = false.
const PL19_EARLIER_STRIPS_ON_THE_TAUGHT_PROOFS = [stripVoiceCore, stripUploadFormats]

export const PL19_BASE_COMMIT = '54c5f70e0e' // studio-v4-dev-preparation-code, the branch this change is cut from (its next.config.mjs is what the strip restores)
export const PL19_COMMIT_SUBJECT = /^PL-19:/

/** Every file this change's commits touch: what the older scope checks skip once the registry names it. */
export const PL19_SCOPE_FILES = new Set([
  'next.config.mjs',
  'components/preview-build/preview-toaster.tsx',
  'scripts/test-studio-preview-build-mark.mjs',
  'scripts/studio-pl19-preview-mark-strip.mjs',
  'scripts/studio-later-changes.mjs',
  // the five older proofs this change teaches (CA-29 ruling a, 25 Nov 11:32Z): their edits are this change's, so the older scope checks skip them
  'scripts/test-studio-brand-kit.mjs',
  'scripts/test-studio-my-companions-wiring.mjs',
  'scripts/test-studio-uat-marketing.mjs',
  'scripts/test-studio-research-by-level.mjs',
  'scripts/test-studio-upload-formats.mjs',
])

/** The three insertions this change makes in next.config.mjs, exactly as committed (generated from the diff against the base, not retyped). */
export const PL19_CONFIG_INSERTIONS = [
  "import { fileURLToPath } from 'node:url'\n",
  "// PL-19: a Vercel PREVIEW build shows one fixed mark on every page (\"Preview build: not the UAT product\"), so a PR preview is never taken for the UAT product.\n// Decided HERE, at build time, from Vercel's own system variable VERCEL_ENV (\"production\" | \"preview\" | \"development\"), which Vercel sets on the builds it runs\n// (a Git-integration PR preview is \"preview\"; the UAT and production deploys run `vercel build --prod`, so they are \"production\"): no project setting, no\n// variable on any Vercel target, nothing copied to the preview target. Anything other than exactly \"preview\" (including unset) adds NOTHING to this config,\n// so a production-target build compiles exactly what it did before. On preview the root layout's toaster import is swapped for a wrapper that adds the mark.\nconst isVercelPreviewBuild = process.env.VERCEL_ENV === 'preview'\nconst previewToasterFile = fileURLToPath(new URL('./components/preview-build/preview-toaster.tsx', import.meta.url))\n\n",
  "  ...(isVercelPreviewBuild\n    ? {\n        webpack(config, { webpack }) {\n          config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@\\/components\\/ui\\/toaster$/, previewToasterFile))\n          return config\n        },\n      }\n    : {}),\n",
]

/** The two lines this change adds to scripts/studio-later-changes.mjs, exactly as registered (generated from the registry, not retyped). */
export const PL19_REGISTRY_LINES = [
  "  ...(await import('./studio-pl19-preview-mark-strip.mjs')).PL19_SCOPE_FILES, // LATER-CHANGE: PLATFORM (LEAD-PLATFORM-CLAUDE), PL-19 preview build mark: next.config.mjs build-time hook for Vercel preview builds (no flag, no setting)\n",
  "  (await import('./studio-pl19-preview-mark-strip.mjs')).stripPl19PreviewMark, // LATER-CHANGE: PLATFORM (LEAD-PLATFORM-CLAUDE), PL-19 preview build mark: takes its three insertions back out of next.config.mjs\n",
]

/** The reverse hunks of the five older proofs this change teaches: [text as it stands now, text as dev had it], generated from the diff against the base (not retyped). */
export const PL19_TEST_REVERSE_HUNKS = {
  "scripts/test-studio-brand-kit.mjs": [
    ["import { stripPl19PreviewMark } from './studio-pl19-preview-mark-strip.mjs' // LATER-CHANGES: registry read (PL-19 preview build mark): next.config.mjs may carry that change's three exact insertions; this proof holds the rest to the base\n", ""],
    ["  for (const rel of ['package.json', 'pnpm-lock.yaml', 'prisma/schema.prisma', 'lib/director-rest-entitlement.ts', 'lib/api-hardening.ts', 'lib/service-url.ts', 'lib/config.ts', 'lib/theme-fonts.ts', 'app/api/upload/route.ts', 'app/api/profile/avatar/route.ts', 'lib/supabase-storage.ts', 'scripts/test-studio-voice-call.mjs']) assert.ok(!net.includes(rel), `${rel} is the base's: untouched (no bucket, no upload route, no migration, no dependency)`)\n  // PL-19 (preview build mark) edits next.config.mjs (a later change, registered): it must still be the base's plus EXACTLY that change's three insertions, nothing else\n  assert.equal(stripPl19PreviewMark('next.config.mjs', git('show', 'HEAD:next.config.mjs')), baseText('next.config.mjs'), \"next.config.mjs is the base's plus at most PL-19's three exact insertions (no bucket, no upload route, no migration, no dependency)\")\n", "  for (const rel of ['package.json', 'pnpm-lock.yaml', 'next.config.mjs', 'prisma/schema.prisma', 'lib/director-rest-entitlement.ts', 'lib/api-hardening.ts', 'lib/service-url.ts', 'lib/config.ts', 'lib/theme-fonts.ts', 'app/api/upload/route.ts', 'app/api/profile/avatar/route.ts', 'lib/supabase-storage.ts', 'scripts/test-studio-voice-call.mjs']) assert.ok(!net.includes(rel), `${rel} is the base's: untouched (no bucket, no upload route, no migration, no dependency)`)\n"],
  ],
  "scripts/test-studio-my-companions-wiring.mjs": [
    ["import { stripPl19PreviewMark } from './studio-pl19-preview-mark-strip.mjs' // LATER-CHANGES: registry read (PL-19 preview build mark): next.config.mjs carries three exact insertions of that change; this proof checks the file is dev's without them\n", ""],
    ["{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && rel === 'next.config.mjs' ? stripPl19PreviewMark(rel, out) : out } } // LATER-CHANGES: registry read (PL-19 preview build mark): a read of next.config.mjs goes through that change's own strip (its three exact insertions out, nothing else), so this proof sees the file as dev has it plus exactly those lines\n", ""],
  ],
  "scripts/test-studio-research-by-level.mjs": [
    ["import { stripPl19PreviewMark, PL19_SCOPE_FILES } from './studio-pl19-preview-mark-strip.mjs' // LATER-CHANGES: registry read (PL-19 preview build mark): a later change (stacked after this one) registers two lines and edits next.config.mjs; this proof reads them without it and counts its files in the whole-range scope\n", ""],
    ["{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' ? stripPl19PreviewMark(rel, out) : out } } // LATER-CHANGES: registry read (PL-19 preview build mark): the registry without that change's two lines and next.config.mjs without its three insertions, so this proof sees them as the change before left them\n", ""],
    ["  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN) && registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(STRIP_FN) + 1).every(strip => strip === stripUploadFormats || strip === stripPl19PreviewMark), 'the strip runs last, but for the Studio upload formats change\\'s and PL-19\\'s (the order the changes were stacked)') // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): that change's strip is registered after this one\n", "  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN) && registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(STRIP_FN) + 1).every(strip => strip === stripUploadFormats), 'the strip runs last, but for the Studio upload formats change\\'s (the order the changes were stacked)') // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): that change's strip is registered after this one\n"],
    ["const wholeRangeOutside = (names, marketing = UAT_MARKETING_V4_SCOPE_FILES) => names.filter(Boolean).filter(rel => !SCOPE.has(rel) && !UPLOAD_FORMATS_SCOPE_FILES.has(rel) && !PL19_SCOPE_FILES.has(rel) && !marketing.has(rel)).sort() // RESEARCH-BY-LEVEL (S67): the committed files of BASE..HEAD that no scope names; a promotion merge of dev into uat carries uat's own marketing-v4 commits, left out by exact path (the uat marketing registry's set), never by prefix and never every later change's files; LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): taught to that change's pin with the other lines of this proof\n", "const wholeRangeOutside = (names, marketing = UAT_MARKETING_V4_SCOPE_FILES) => names.filter(Boolean).filter(rel => !SCOPE.has(rel) && !UPLOAD_FORMATS_SCOPE_FILES.has(rel) && !marketing.has(rel)).sort() // RESEARCH-BY-LEVEL (S67): the committed files of BASE..HEAD that no scope names; a promotion merge of dev into uat carries uat's own marketing-v4 commits, left out by exact path (the uat marketing registry's set), never by prefix and never every later change's files; LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): taught to that change's pin with the other lines of this proof\n"],
  ],
  "scripts/test-studio-uat-marketing.mjs": [
    ["import { stripPl19PreviewMark } from './studio-pl19-preview-mark-strip.mjs' // LATER-CHANGE: PL-19 preview build mark: its three exact next.config.mjs insertions come out before this pin reads the file (base plus exactly those lines)\n", ""],
    ["const readFile = file => stripPl19PreviewMark(rel(file), stripApiHardening(rel(file), stripVoiceCore(file, fs.readFileSync(path.join(repoRoot, rel(file)), 'utf8')))) // LATER-CHANGE: PROGRAM-1 API hardening reads through its strip; PL-19 reads through its own (next.config.mjs only)\n", "const readFile = file => stripApiHardening(rel(file), stripVoiceCore(file, fs.readFileSync(path.join(repoRoot, rel(file)), 'utf8'))) // LATER-CHANGE: PROGRAM-1 API hardening reads through its strip\n"],
  ],
  "scripts/test-studio-upload-formats.mjs": [
    ["import { stripPl19PreviewMark } from './studio-pl19-preview-mark-strip.mjs' // LATER-CHANGES: registry read (PL-19 preview build mark): a later change (stacked after this one) registers its lines after this change's; this proof names them as the only lines that may follow\n", ""],
    ["const laterOnly = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip === stripPl19PreviewMark ? strip(rel, out, false) : strip(rel, out); return typeof next === 'string' ? next : out }, text) }   // PL-19's strip, run after this one in the registry, puts its taught proofs back to dev's text but leaves this change's marked lines (rerunEarlier = false)\n", "const laterOnly = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }\n"],
    ["function registryChecks(text = stripPl19PreviewMark(REGISTRY, read(REGISTRY))) {   // PL-19's two registry lines (stacked after this change) are read out first\n", "function registryChecks(text = read(REGISTRY)) {\n"],
    ["    assert.ok(at > 0, `${list}: this change's line is in the list`); assert.ok(rows.slice(at + 1).every(row => row.includes('studio-pl19-preview-mark-strip.mjs')), `${list}: the line is at the true end, just above the marker comment (but for PL-19's, stacked after this change)`)\n", "    assert.ok(at > 0, `${list}: this change's line is in the list`); assert.equal(at, rows.length - 1, `${list}: the line is at the true end, just above the marker comment`)\n"],
    ["  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN) && registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(STRIP_FN) + 1).every(strip => strip === stripPl19PreviewMark), 'the strip runs last, but for PL-19\\'s (the order the changes were stacked)'); assert.equal(registry.LATER_ENV_BLOCKS.at(-1), ENV_BLOCK, 'the block is the last')\n", "  assert.equal(registry.LATER_STRIPS.at(-1), STRIP_FN, 'the strip runs last (the order the changes were stacked)'); assert.equal(registry.LATER_ENV_BLOCKS.at(-1), ENV_BLOCK, 'the block is the last')\n"],
  ],
}

/** (rel, text, rerunEarlier = true) => text: next.config.mjs without this change's three insertions, the registry without this change's two lines, and each of the five older proofs this change taught with its added lines out and the lines it replaced put back (exactly, once each);
 *  any other file as it is. Each insertion is removed once, only where it stands whole. */
export function stripPl19PreviewMark(rel, text, rerunEarlier = true) {
  if (typeof text !== 'string') return text
  if (rel === 'scripts/studio-later-changes.mjs') {   // the registry: this change's two lines out, wherever they stand (older proofs that hold the registry to "without this change's lines")
    let reg = text
    for (const line of PL19_REGISTRY_LINES) { const at = reg.indexOf(line); if (at >= 0) reg = reg.slice(0, at) + reg.slice(at + line.length) }
    return reg
  }
  if (PL19_TEST_REVERSE_HUNKS[rel]) {   // an older proof this change taught
    let proof = text
    for (const [now, was] of PL19_TEST_REVERSE_HUNKS[rel]) { const at = proof.indexOf(now); if (at >= 0) proof = proof.slice(0, at) + was + proof.slice(at + now.length) }
    if (rerunEarlier) for (const earlier of PL19_EARLIER_STRIPS_ON_THE_TAUGHT_PROOFS) { const next = earlier(rel, proof); if (typeof next === 'string') proof = next }
    return proof
  }
  if (rel !== 'next.config.mjs') return text
  let out = text
  for (const chunk of PL19_CONFIG_INSERTIONS) {
    const at = out.indexOf(chunk)
    if (at >= 0) out = out.slice(0, at) + out.slice(at + chunk.length)
  }
  return out
}
