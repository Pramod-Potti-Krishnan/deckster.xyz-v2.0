// FRONTEND-2 Pass 3 track 4: the shared harness of scripts/test-studio-theme-library-manage.mjs and scripts/test-studio-template-library-manage.mjs. Not a test itself (the suite only runs test-*.mjs).
// Plain node: the real TypeScript is transpiled and run in a vm, with a small fake React (hooks keep their state between renders; a state write asks for another render) and the
// JSX runtime answering plain {type, props, key} nodes. No browser, no network, no services: every import a module asks for must be handed in, and an unknown one fails loudly.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { stripLaunchWording } from './studio-launch-wording-strip.mjs' // NEXT_PUBLIC_STUDIO_LAUNCH_WORDING (launched wording): its flag-gated edits come out first, before every older change's strip

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// LIBRARY_MANAGE_BASE=<commit> overrides the commit the flag-off identity is checked against (default 4c5fd0f, the studio-v4-dev-preparation-code tip this change is stacked on: #459 added only the Profile page and #468 only the admin email guard,
// its .env.example block and its package script on top of bcd8aed, and none of the files this change touches).
export const BASE_COMMIT = process.env.LIBRARY_MANAGE_BASE || '4c5fd0fbe6500afeb8218075261e268157706eed'
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
export function baseSource(rel) {
  try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]); return git(['show', `${BASE_COMMIT}:${rel}`]) } catch { return null }
}
// .env.example and package.json are the two files every flag-gated change appends a line or a block to, so once other changes are stacked on this one (Ask your second brain, Duplicate a deck ...) they hold
// lines this change never wrote. For those two (and only those) the base's lines must all still be there, in order, with nothing of this change left, and any extra line must be a comment, a blank, an env
// line or a test script line (the rule scripts/test-studio-p2-polish.mjs and scripts/test-studio-p2-publish.mjs use). Every other file is held to the base byte for byte, as before.
export function appendOnlyOver(rel, text, baseText) {
  if (rel === '.env.example') { // a flag's comment is prose that a later change may reword in place (PP-8 rewords the polish block's), so for .env.example what must survive, in order, is every env assignment of the base; every other line must be a comment or a blank
    const assignment = line => /^[A-Z][A-Z0-9_]*=/.test(line)
    const want = baseText.split('\n').filter(assignment), lines = text.split('\n')
    let next = 0
    for (const line of lines.filter(assignment)) if (next < want.length && line === want[next]) next++
    return next === want.length && lines.every(line => /^\s*$|^\s*#/.test(line) || assignment(line)) && !lines.some(line => /LIBRARY_MANAGE|library-manage/.test(line))
  }
  const norm = line => rel === 'package.json' ? line.replace(/,\s*$/, '') : line
  const want = baseText.split('\n').map(norm), extras = []
  let next = 0
  for (const line of text.split('\n').map(norm)) { if (next < want.length && line === want[next]) next++; else extras.push(line) }
  const kind = rel === 'package.json' ? /^\s*"test:[a-z0-9-]+": "node scripts\/test-[a-z0-9-]+\.mjs"$/ : /^\s*$|^\s*#|^[A-Z][A-Z0-9_]*=/
  return next === want.length && extras.every(line => line === '' || kind.test(line)) && !extras.some(line => /LIBRARY_MANAGE|library-manage/.test(line))
}
/** `stripped` is the file with this change's lines out: the base's file, or (for the two shared append-only files) the base's lines plus other changes' comments, blanks and env lines. */
export const isBaseFile = (rel, stripped, baseText) => stripped === baseText || (['.env.example', 'package.json'].includes(rel) && appendOnlyOver(rel, stripped, baseText))
// The other FRONTEND-2 Pass 3 changes that may be stacked on the same base (#460 Ask your second brain, #464 Duplicate a deck, #469 deck-mutation dedupe, BY10 narration via the router). Their files are not this change's, and none of them is a library file;
// the diff-scope check below allows exactly these on top of this change's own files and nothing else.
export const STACKED_PASS3_FILES = [
  // Studio first paint (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED, COMPOSER-2, stacked): its lib; the only other source file it touches, the viewer, is listed elsewhere here.
  'lib/studio-first-paint.ts',
  'app/(app)/knowledge/page.tsx', 'app/api/knowledge-graph/query/route.ts', 'components/knowledge/studio-kg-ask.css', 'components/knowledge/studio-kg-ask.tsx', 'hooks/use-studio-kg-ask.ts', 'lib/studio-kg-ask.ts',
  // deck import (NEXT_PUBLIC_STUDIO_DECK_IMPORT): a new Decks layout, two proxy routes, the dialog and entry, their hook and rules, and OPS-2's REST entitlement minter carried verbatim (PR #312); no library file
  'app/(app)/dashboard/layout.tsx', 'app/api/studio-deck-import/route.ts', 'app/api/studio-deck-import/jobs/[jobId]/route.ts', 'components/studio-deck-import/studio-deck-import-dialog.tsx', 'components/studio-deck-import/studio-deck-import-entry.tsx', 'components/studio-deck-import/studio-deck-import.css', 'hooks/use-studio-deck-import.ts', 'lib/studio-deck-import.ts', 'lib/director-rest-entitlement.ts',
  // UAT marketing port, FRONTEND-1 (NEXT_PUBLIC_STUDIO_UAT_MARKETING): the seven Landing route files and their layout gain a flag dispatch; the share card and a sitemap; one new flag helper, UAT's copy of the copy and its metadata, the parallel tree under components/marketing/v3-uat, its hook, and a neutral edit of the rail; no library file
  'app/(marketing-v3)/about/page.tsx', 'app/(marketing-v3)/bring/page.tsx', 'app/(marketing-v3)/experts/page.tsx', 'app/(marketing-v3)/layout.tsx', 'app/(marketing-v3)/learn/page.tsx',
  'app/(marketing-v3)/page.tsx', 'app/(marketing-v3)/present/page.tsx', 'app/(marketing-v3)/pricing/page.tsx', 'app/opengraph-image.tsx', 'app/sitemap.ts',
  'components/marketing/SnapDeck/SlideProgressRail.tsx', 'components/marketing/v3-uat/AudienceQA.tsx', 'components/marketing/v3-uat/BringFlow.tsx', 'components/marketing/v3-uat/BuildCta.tsx',
  'components/marketing/v3-uat/CycleWord.tsx', 'components/marketing/v3-uat/ExpertsLoop.tsx', 'components/marketing/v3-uat/FooterV3.tsx', 'components/marketing/v3-uat/HeaderV3.tsx',
  'components/marketing/v3-uat/HeroFilm.tsx', 'components/marketing/v3-uat/KnowledgeGraphCanvas.tsx', 'components/marketing/v3-uat/PlayerSlides.tsx', 'components/marketing/v3-uat/SlideChip.tsx',
  'components/marketing/v3-uat/StatusPill.tsx', 'components/marketing/v3-uat/SvgDefs.tsx', 'components/marketing/v3-uat/ThemeSwitch.tsx', 'components/marketing/v3-uat/V3Runtime.tsx',
  'components/marketing/v3-uat/V3Spotlight.tsx', 'components/marketing/v3-uat/Waveform.tsx', 'components/marketing/v3-uat/ZoomBuild.tsx', 'components/marketing/v3-uat/flag.ts',
  'components/marketing/v3-uat/home/Begin.tsx', 'components/marketing/v3-uat/home/Bring.tsx', 'components/marketing/v3-uat/home/Experts.tsx', 'components/marketing/v3-uat/home/Gallery.tsx',
  'components/marketing/v3-uat/home/Knowledge.tsx', 'components/marketing/v3-uat/home/Present.tsx', 'components/marketing/v3-uat/home/Pricing.tsx', 'components/marketing/v3-uat/home/RealDeck.tsx',
  'components/marketing/v3-uat/home/Start.tsx', 'components/marketing/v3-uat/home/Themes.tsx', 'components/marketing/v3-uat/pages/about.tsx', 'components/marketing/v3-uat/pages/bring.tsx',
  'components/marketing/v3-uat/pages/experts.tsx', 'components/marketing/v3-uat/pages/home.tsx', 'components/marketing/v3-uat/pages/learn.tsx', 'components/marketing/v3-uat/pages/metadata.ts',
  'components/marketing/v3-uat/pages/present.tsx', 'components/marketing/v3-uat/pages/pricing.tsx', 'components/marketing/v3-uat/shell.tsx', 'hooks/use-v3-deck-uat.ts', 'lib/analytics.ts',
  'lib/marketing/v3-metadata.ts', 'lib/marketing/v3-uat-content.ts', 'lib/marketing/v3-uat-view.ts', 'lib/studio-uat-marketing.ts',
  // brand files (own commit, not behind a flag: UAT's logo and app icons, same names and sizes)
  'app/apple-icon.png', 'app/icon.png', 'app/icon.svg',
  // Security page under the Docs flag (own commit): the page, its tab layout and the footer's two trust lines
  'app/legal/security/layout.tsx', 'app/legal/security/page.tsx', 'components/layout/Footer.tsx',
  // deck import, FRONTEND-1 (the Builder's welcome links and the imported-deck note): the adoption reader (keeps Director's import marker), the note, and the two welcome components that gain one flag-gated link each
  'lib/composer-theme-policy.ts', 'components/studio-deck-import/studio-deck-import-note.tsx', 'components/studio-deck-import/studio-deck-import-gate.tsx', 'components/builder/studio-first-run-actions.tsx', 'components/builder/studio-welcome-stage.tsx',
  'app/(app)/dashboard/page.tsx', 'app/builder/page.tsx', 'components/builder/studio-copied-from-note.tsx', 'components/builder/studio-duplicate-deck.css', 'lib/studio-duplicate-deck.ts',
  'lib/studio-deck-mutation-dedupe.ts',
  // FRONTEND-2 Pass 3 refine an element from chat (NEXT_PUBLIC_CHAT_ELEMENT_REFINE, #470): its flag-gated hook lines and two new libs.
  'hooks/use-deckster-websocket-v2.ts', 'hooks/use-textlabs-generation.ts', 'lib/chat-element-refine-wire.ts', 'lib/chat-element-refine.ts', 'types/mdc.ts',
  // FRONTEND-2 Pass 3 change the theme / export from chat (NEXT_PUBLIC_CHAT_THEME_CHANGE, NEXT_PUBLIC_CHAT_EXPORT, #472): its flag-gated hook lines and two new libs.
  'lib/chat-theme-export-wire.ts', 'lib/chat-theme-export.ts',
  // the model catalog on the Intelligence page (NEXT_PUBLIC_STUDIO_MODEL_CATALOG): a new layout, a new route, the Models section and its helper; no library file
  'app/(app)/studio/intelligence/layout.tsx', 'app/api/models/catalogue/route.ts', 'components/studio-personal/intelligence-models.css', 'components/studio-personal/intelligence-models.tsx', 'lib/studio-model-catalog.ts',
  // BY10 narration through the model router (NARRATION_VIA_ROUTER): the library files and the four routes that hand the call its identity.
  'lib/narration/model-router.ts', 'lib/narration/draft.ts', 'lib/narration/tts.ts', 'lib/narration/spoken.ts',
  'app/api/narration/render/route.ts', 'app/api/narration/script/route.ts', 'app/api/narration/speak/route.ts', 'app/api/narration/voice/sample/[voiceId]/route.ts',
  // FRONTEND-1 template rename (the template hook and its proxy gain the rename; test-studio-template-library-manage.mjs holds them to the base without it)
  'app/api/templates/[id]/route.ts', 'hooks/use-templates.ts',
  // Stripe real tier (STRIPE_REAL_TIER_MAPPING_ENABLED, P2-STRIPE-TIER, stacked on #475): the webhook route and the price-to-plan table.
  'app/api/webhooks/stripe/route.ts', 'lib/stripe/subscription-plan.ts',
  // launched wording (NEXT_PUBLIC_STUDIO_LAUNCH_WORDING): flag-gated edits to Settings, Billing, Shortcuts, Help, Decks, sign-up, Your details, Intelligence and the libraries, and the words list; scripts/test-studio-launch-wording.mjs holds them.
  'app/(app)/billing/page.tsx',
  'app/(app)/settings/notifications/page.tsx',
  'app/(app)/settings/privacy/page.tsx',
  'app/(app)/settings/security/page.tsx',
  'app/(app)/shortcuts/page.tsx',
  'app/auth/pending/page.tsx',
  'app/auth/signup/page.tsx',
  'app/help/page.tsx',
  'components/narration-voice-picker.tsx',
  'components/presentation-download-controls.tsx',
  'components/presentation-viewer.tsx',
  'components/studio-add-slide-v2.tsx',
  'components/studio-libraries/templates-workspace.tsx',
  'components/studio-libraries/themes-workspace.tsx',
  'components/studio-personal/details-workspace.tsx',
  'components/studio-personal/intelligence-p2.tsx',
  'components/studio-personal/intelligence-workspace.tsx',
  'components/studio-personal/studio-p2-details.tsx',
  'lib/studio-launch-wording.ts',
  // P3-4a resync after a reconnect (NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC, #482, stacked): the deck-changed notice's lib, hook and strip.
  'lib/studio-deck-changed-notice.ts', 'hooks/use-deck-changed-notice.ts', 'components/builder/studio-deck-changed-notice.tsx',
  // Text Labs signed requests (NEXT_PUBLIC_STUDIO_TL_SIGNED_REQUESTS / TEXT_LABS_SIGNED_REQUESTS_ENABLED, stacked): the mint route, its lib, the browser half, the client.
  'app/api/identity/text-labs-token/route.ts', 'lib/text-labs-identity-mint.ts', 'lib/text-labs-signed-fetch.ts', 'lib/textlabs-client.ts',
  // P3-4b every long Studio request ends (NEXT_PUBLIC_STUDIO_JOB_DEADLINES, stacked): the deadlines module, the export service, the narration picker.
  'lib/studio-job-deadlines.ts', 'lib/api/download-service.ts', 'components/narration-voice-picker.tsx',
  // P3-4c Director's job ledger in Studio (NEXT_PUBLIC_STUDIO_JOB_LEDGER, stacked): its lib and the chat card (tsx and css).
  'lib/studio-job-ledger.ts', 'components/builder/chat/studio-job-ledger-card.tsx', 'components/builder/chat/studio-job-ledger-card.css',
  // New-deck handoff send (NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND, stacked): its hook.
  'hooks/use-studio-new-deck-handoff-send.ts',
  // Add Slide compose signs its user (STUDIO_COMPOSE_ENTITLEMENT_ENABLED, stacked on #475): the compose proxy and its lib.
  'app/api/slides/compose/route.ts', 'lib/studio-compose-entitlement.ts',
  // Publish preview from Layout's inventory (NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED, stacked): its hook and lib, and the preview component that reads through the hook.
  'hooks/use-studio-publish-preview-inventory.ts', 'lib/studio-publish-preview-inventory.ts', 'components/studio-publish-preview.tsx',
  // Payments open soon (NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON, stacked): its lib, hook, mount and sheet, the account layout's one flag-gated element, the two checkout routes, the upgrade button and the top-up modal; no library file.
  'lib/studio-payments-open-soon.ts', 'hooks/use-studio-payments-open-soon.ts', 'components/billing/studio-payments-open-soon.css', 'components/billing/studio-payments-open-soon-mount.tsx',
  'app/(app)/layout.tsx', 'app/api/stripe/create-checkout-session/route.ts', 'app/api/stripe/create-topup-session/route.ts', 'components/billing/UpgradeButton.tsx', 'components/builder/topup-modal.tsx',
  // Studio new logo (NEXT_PUBLIC_STUDIO_NEW_LOGO, FRONTEND-1, stacked on the UAT marketing port): the rail's brand tile, its flag helper and its sheet.
  'lib/studio-new-logo.ts', 'components/layout/studio-new-logo.css', 'components/layout/studio-rail.tsx',
  // Publish review fit (NEXT_PUBLIC_STUDIO_PUBLISH_REVIEW_FIT, stacked): its hook, and the Publish dialog's stylesheet (one block appended after the Pass 2 polish block).
  'hooks/use-studio-publish-review-fit.ts', 'components/studio-publish.css',
  // Version history deck only (NEXT_PUBLIC_STUDIO_VERSION_HISTORY_DECK_ONLY, stacked): its hook, and the bridge's setCovered in the Version history lib.
  'hooks/use-studio-version-history-deck-only.ts', 'lib/studio-version-history-v2.ts',
]
// The FRONTEND-1 Pass 2 changes that are stacked on the same base too (the /admin pages and their hardening, the Docs / Help / Legal / Agents pages and their content passes, the account menu's rhythm). None is a
// library file; the diff-scope check allows exactly these as well, and nothing else.
export const STACKED_P2_FILES = [
  'app/admin/coupons/layout.tsx', 'app/admin/users/layout.tsx', 'app/agents/[slug]/layout.tsx', 'app/agents/[slug]/page.tsx', 'app/agents/layout.tsx', 'app/api/admin/coupons/[id]/route.ts',
  'app/api/admin/coupons/route.ts', 'app/api/admin/users/route.ts', 'app/compare/page.tsx', 'app/docs/[category]/[slug]/layout.tsx', 'app/docs/[category]/[slug]/page.tsx', 'app/docs/api/layout.tsx',
  'app/docs/api/page.tsx', 'app/docs/layout.tsx', 'app/docs/page.tsx', 'app/help/template.tsx', 'app/legal/cookies/layout.tsx', 'app/legal/layout.tsx', 'app/legal/privacy/layout.tsx',
  'app/legal/security/layout.tsx', 'app/legal/terms/layout.tsx', 'components/admin/studio-p2-admin.css', 'components/admin/studio-p2-admin.tsx', 'components/help/studio-p2-help.css',
  'components/layout/Footer.tsx', 'components/marketing/ExampleShowcase/ExampleCard.tsx', 'components/marketing/TemplateGallery/TemplateCard.tsx', 'components/marketing/v3/FooterV3.tsx',
  'components/studio-docs/studio-p2-docs-api-notice.tsx', 'components/studio-docs/studio-p2-docs-frame.tsx', 'components/studio-docs/studio-p2-docs.css', 'components/studio-docs/studio-p2-docs.tsx',
  'components/user-profile-menu-p2.css', 'components/user-profile-menu-p2.tsx', 'lib/comparisons.ts', 'lib/examples.ts', 'lib/studio-p2-admin.ts', 'lib/studio-p2-docs.ts', 'lib/studio-p2-polish.ts',
  'lib/templates.ts', 'middleware.ts',
]
export const sha = text => crypto.createHash('sha256').update(text).digest('hex')
export const plain = value => JSON.parse(JSON.stringify(value))

// ---- in-memory mutations (--mutation-check): a child run applies one source edit, the suite must then fail ---------------------------------------------------------
export function makeReader(mutations, envName) {
  const index = process.env[envName] === undefined ? null : Number(process.env[envName])
  return rel => {
    let source = fs.readFileSync(path.join(root, rel), 'utf8')
    source = stripLaunchWording(rel, source) // NEXT_PUBLIC_STUDIO_LAUNCH_WORDING: its flag-gated edits come out first
    const mutation = index === null ? null : mutations[index]
    if (mutation && mutation.file === rel) {
      assert.ok(source.includes(mutation.from), `mutation "${mutation.name}" no longer applies; update MUTATIONS`)
      source = source.replace(mutation.from, () => mutation.to)
    }
    return source
  }
}

// ---- compile + run ------------------------------------------------------------------------------------------------------------------------------------------------------
export function compile(code, file = 'module.tsx') {
  const out = ts.transpileModule(code, { fileName: file, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } })
  assert.equal(out.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, `${file} transpiles`)
  return out.outputText
}
export const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
export const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' }
export const refuse = () => assert.fail('No network, storage, navigation or services allowed')

/** Runs `code` as a CommonJS module. `imports` is the closed list of modules it may require. */
export function loadSource(code, imports = {}, { env = {}, globals = {}, file = 'module.tsx' } = {}) {
  const mod = { exports: {} }
  const context = { module: mod, exports: mod.exports, process: { env: { ...env } }, console, URLSearchParams, encodeURIComponent, decodeURIComponent, Promise, fetch: refuse, ...globals,
    require: name => { assert.ok(name in imports, `${file} asked for an import nobody handed in: ${name}`); return imports[name] } }
  vm.runInNewContext(compile(code, file), context)
  return mod.exports
}

export const flat = value => Array.isArray(value) ? value.flatMap(flat) : !value || typeof value !== 'object' ? [] : [value, ...flat(value.props?.children)]
export const text = value => Array.isArray(value) ? value.map(text).join('') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? text(value.props?.children) : String(value)
export const tick = async (times = 16) => { for (let i = 0; i < times; i++) await new Promise(resolve => setImmediate(resolve)) }
export const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej }); return { promise, resolve, reject } }

/**
 * Mounts one function component with a fake React. `renderFn()` (it calls the component) is called for every render; its hooks keep their cells between renders. A state write marks the tree dirty;
 * `settle()` renders again until nothing is dirty and every effect ran. `refs` of drawn nodes are given a stub element so focus/closest/querySelector calls are recorded.
 */
export function createRuntime(renderFn, { elementFor = () => ({}) } = {}) {
  const cells = [], pendingEffects = [], focused = []
  let cursor = 0, dirty = false, tree = null, unmounted = false, renders = 0
  const react = {
    useState(initial) {
      const i = cursor++
      cells[i] ??= { value: typeof initial === 'function' ? initial() : initial }
      const cell = cells[i]
      return [cell.value, update => {
        if (unmounted) return
        const next = typeof update === 'function' ? update(cell.value) : update
        if (!Object.is(next, cell.value)) { cell.value = next; dirty = true }
      }]
    },
    useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial } },
    useCallback(callback, deps) { const i = cursor++, old = cells[i]; if (!old || !deps || deps.some((v, j) => !Object.is(v, old.deps?.[j]))) cells[i] = { callback, deps }; return cells[i].callback },
    useMemo(factory, deps) { const i = cursor++, old = cells[i]; if (!old || !deps || deps.some((v, j) => !Object.is(v, old.deps?.[j]))) cells[i] = { value: factory(), deps }; return cells[i].value },
    useEffect(effect, deps) {
      const i = cursor++, old = cells[i]
      if (!old || !deps || deps.some((v, j) => !Object.is(v, old.deps?.[j]))) {
        cells[i] = { deps, effect, cleanup: old?.cleanup }
        pendingEffects.push(() => { const cell = cells[i]; cell.cleanup?.(); cell.cleanup = effect() })
      }
    },
    useLayoutEffect() {}, useId: () => 'id-1',
  }
  const attachRefs = node => {
    for (const n of flat(node)) if (n.props?.ref && typeof n.props.ref === 'object') n.props.ref.current = elementFor(n, focused)
  }
  const api = {
    react, focused,
    render() {
      for (let attempts = 0; ; attempts++) {
        assert.ok(attempts < 20, 'render settles')
        cursor = 0; dirty = false; renders++
        tree = renderFn()
        attachRefs(tree)
        while (pendingEffects.length) pendingEffects.shift()()
        if (!dirty) return tree
      }
    },
    async settle() { for (let i = 0; i < 20; i++) { await Promise.resolve(); if (dirty || pendingEffects.length) api.render() } await tick(2); if (dirty) api.render(); return tree },
    unmount() { unmounted = true; cells.forEach(cell => { cell?.cleanup?.(); if (cell) cell.cleanup = undefined }) },
    find: predicate => flat(tree).filter(predicate),
    one: predicate => { const found = flat(tree).filter(predicate); assert.equal(found.length, 1, `exactly one node matches (found ${found.length})`); return found[0] },
    get tree() { return tree }, get renders() { return renders },
  }
  return api
}
