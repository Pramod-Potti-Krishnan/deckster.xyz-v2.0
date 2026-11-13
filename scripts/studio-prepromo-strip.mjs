// FRONTEND-1: pre-promotion fixes C-07 (the dev mock-token route is deleted), C-06 (template/deck-import hosts from env) and UX-01
// (no provider prices in Studio). No flag: security and honesty fixes apply in every environment. Registered in
// scripts/studio-later-changes.mjs so older byte-for-byte pins see their base's file. stripPrepromo(rel, text) puts each
// changed span back exactly as it was; any file it does not own comes back untouched.
export const PREPROMO_SCOPE_FILES = [
  'app/api/dev/mock-token/route.ts',
  'scripts/test-studio-dev-token-gate.mjs',
  'scripts/studio-prepromo-strip.mjs',
  'scripts/studio-later-changes.mjs',
  'scripts/test-studio-d1-debug-routes.mjs',
  'lib/composer-library.ts',
  'scripts/test-studio-composer-env-hosts.mjs',
  'scripts/test-studio-deck-import.mjs',
  'components/studio-personal/intelligence-p2.tsx',
  'components/studio-personal/intelligence-model-choice.tsx',
  'components/studio-personal/intelligence-workspace.tsx',
  'scripts/test-studio-no-provider-price.mjs',
  'scripts/test-studio-model-catalog-2026-10.mjs',
  'scripts/test-studio-p2-polish.mjs',
  'scripts/test-studio-intelligence-polish.mjs',
  'scripts/test-studio-launch-wording.mjs',
  'scripts/test-studio-model-catalog.mjs',
  'scripts/test-studio-p2-intelligence.mjs',
  'scripts/test-studio-pass3-polish-g.mjs',
  'scripts/test-studio-build-provenance.mjs',
  'scripts/test-studio-jose-candidate.mjs',
]

// C-07 (PROGRAM-1 ruling, 4 Nov 2026): the dev mock-token route is DELETED outright (it replaces the earlier NODE_ENV-AND-flag gate). Like D1
// (scripts/studio-d1-debug-routes-strip.mjs: D1_DELETED / D1_REMOVED_ROUTES), the deleted file has no strip pair: an older pin that reads it
// either sees it absent, because the registry names it here, or reads the base's text from git at PREPROMO_BASE.
export const PREPROMO_BASE = '3e1ce88eec23fbfd33f249332d06a65ad05ffc40' // #564 merged: the commit this change is cut from
export const PREPROMO_DELETED = ['app/api/dev/mock-token/route.ts']
/** The routes those files served: the only routes this change removes. */
export const PREPROMO_REMOVED_ROUTES = ['/api/dev/mock-token']

// UX-01: Studio never shows provider cost. Each pair is [now, was]; the price row is put back after the "Release status" row and the
// refreshed-catalog note gets its old words back. The note pair is matched with the text that follows it, so the flag-off note
// ("Snapshot specifications only. Speed, quality, pricing, ...") is never touched.
const NOTE_PAIR = ['catalogRefreshed ? "Snapshot specifications only. Speed, quality, and live availability have not been verified."', 'catalogRefreshed ? "Snapshot specifications and public list prices only. Speed, quality, and live availability have not been verified."']
const P2_ROW_PAIR = [
  '          <tr><th scope="row">Release status</th><td>{releaseLabel(chosen.releaseStage)}</td><td>{releaseLabel(alternative.releaseStage)}</td></tr>\n',
  '          <tr><th scope="row">Release status</th><td>{releaseLabel(chosen.releaseStage)}</td><td>{releaseLabel(alternative.releaseStage)}</td></tr>\n          <tr><th scope="row">Price per 1M tokens</th><td>{priceLabel(chosen)}</td><td>{priceLabel(alternative)}</td></tr>\n',
]
const WS_ROW_PAIR = [
  '                <tr><th scope="row">Release status</th><td>{releaseLabel(chosen.releaseStage)}</td><td>{releaseLabel(alternative.releaseStage)}</td></tr>\n',
  '                <tr><th scope="row">Release status</th><td>{releaseLabel(chosen.releaseStage)}</td><td>{releaseLabel(alternative.releaseStage)}</td></tr>\n                <tr><th scope="row">Price per 1M tokens</th><td>{priceLabel(chosen)}</td><td>{priceLabel(alternative)}</td></tr>\n',
]
const MC_ROW_PAIR = [
  '          <tr><th scope="row">Release status</th><td>{cell(id => releaseLabel(catalog.models[id].releaseStage), current)}</td><td>{cell(id => releaseLabel(catalog.models[id].releaseStage), compareId)}</td></tr>\n',
  '          <tr><th scope="row">Release status</th><td>{cell(id => releaseLabel(catalog.models[id].releaseStage), current)}</td><td>{cell(id => releaseLabel(catalog.models[id].releaseStage), compareId)}</td></tr>\n          <tr><th scope="row">Price per 1M tokens</th><td>{cell(id => priceLabel(catalog.models[id]), current)}</td><td>{cell(id => priceLabel(catalog.models[id]), compareId)}</td></tr>\n',
]
const P2_IMPORT = ['parseSavedDraft, provenanceText, releaseLabel, taskDetails } from "./intelligence-workspace"', 'parseSavedDraft, priceLabel, provenanceText, releaseLabel, taskDetails } from "./intelligence-workspace"']
const MC_IMPORT = ['ManagedByDeckster, provenanceText, releaseLabel, taskDetails } from "./intelligence-workspace"', 'ManagedByDeckster, priceLabel, provenanceText, releaseLabel, taskDetails } from "./intelligence-workspace"']

// the one older pin whose own bytes another pin holds (scripts/test-studio-pass3-polish-g.mjs): its taught lines come back out
const P2_INTEL_TEST_PAIRS = [
  ["import { stripLaterChanges } from './studio-later-changes.mjs' // taught (FRONTEND-1, pre-promo UX-01): a later change's lines come out first, through the later-changes registry\n", ''],
  ["const read = rel => stripP2Polish(rel, stripLaunchWording(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))))", "const read = rel => stripP2Polish(rel, stripLaunchWording(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))"],
]

export const PREPROMO_PAIRS = {
  'components/studio-personal/intelligence-p2.tsx': [P2_IMPORT, P2_ROW_PAIR, NOTE_PAIR],
  'components/studio-personal/intelligence-model-choice.tsx': [MC_IMPORT, MC_ROW_PAIR, NOTE_PAIR],
  'components/studio-personal/intelligence-workspace.tsx': [WS_ROW_PAIR, NOTE_PAIR],
  'scripts/test-studio-p2-intelligence.mjs': P2_INTEL_TEST_PAIRS,
}

export function stripPrepromo(rel, text) {
  const pairs = PREPROMO_PAIRS[rel]
  if (!pairs || typeof text !== 'string') return text
  let out = text
  for (const [now, was] of pairs) if (!was || !out.includes(was)) out = out.split(now).join(was) // idempotent: a text already stripped is left as it is
  return out
}
