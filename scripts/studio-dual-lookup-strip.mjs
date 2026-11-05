// FRONTEND-1 (program1/studio-flip-enablers, "Flip enablers: dual lookup"). Server flag STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED (the branch's flag; the string "true", default off, read per call).
// With it on, an e-mail-only session is sent to Director as its DB id; Director rows written before the switch are keyed by the e-mail. Every Director READ of user-owned records
// (templates list / one, themes list / one / standard, ingest job, a chat session's library) asks with the DB id first and, only when that finds nothing, once more with the signed-in
// user's OWN e-mail from the server session, signed for that e-mail. Writes keep the DB id. All logic is lib/studio-director-email-fallback.ts (new).
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker DUAL-LOOKUP (a whole token): one import and two lines after the Director fetch in each of the
// seven route files. No existing line is rewritten. Strip the marked lines and each file is its base, byte for byte.
// One older proof is taught to read through the registry (DUAL_LOOKUP_EDITS): test-studio-deck-import's "the minter is imported by the two import routes only" skips registered later-change files
// (the flip enablers' server-only Director signers import the minter too); the strip puts its old line back.
// A second round ("Flip enablers: dual lookup - pins") teaches nine more pins the same way (DUAL_LOOKUP_EDITS): put-backs newest first where the flip enablers chained a whole-text edit on an older
// change's taught line, the flip enablers' own commit subjects skipped on the first-parent line, files whose only net change is another registered change's lines left out of a scope,
// and the thirteen Director routes put back to dev's text so closed-import harnesses read dev's route: #577's strip takes its REST-sign lines out, this one the flip enablers' resolveDirectorUserId edit (RESOLVE_ID_ROUTE_EDITS).
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, nothing read from disk or git here.

export const BASE_COMMIT = '359ec0195217c2ca82b3e3cf484468cef5e2a202' // program1/studio-flip-enablers head at the start of this change (already holds origin/studio-v4-dev-preparation-code 3e1ce88e)
export const DUAL_LOOKUP_FLAG = 'STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED'
export const DUAL_LOOKUP_MARKER = 'DUAL-LOOKUP'
/** The marker as a WHOLE token. */
export const DUAL_LOOKUP_MARKER_RE = /(?<![\w-])DUAL-LOOKUP(?![\w-])/

/** Existing files that get marked lines: [file, miss rule]. */
export const DUAL_LOOKUP_ROUTES = {
  'app/api/templates/route.ts': "missOnEmpty('templates')",
  'app/api/templates/[id]/route.ts': 'missOnNotFound',
  'app/api/themes/route.ts': "missOnEmpty('themes')",
  'app/api/themes/[id]/route.ts': 'missOnNotFound',
  'app/api/themes/standard/route.ts': "missOnEmpty('theme')",
  'app/api/ingest-jobs/[jobId]/route.ts': 'missOnNotFound',
  'app/api/director/sessions/[sourceSessionId]/library/route.ts': 'missOnForbiddenOrNotFound',
}
export const DUAL_LOOKUP_FILES = Object.keys(DUAL_LOOKUP_ROUTES)

/** The older proof this change teaches: [line now, line before], whole lines (the line now carries DUAL-LOOKUP; the line before is the base's). */
export const DUAL_LOOKUP_EDITS = {
  "scripts/test-studio-deck-save-refused-notice.mjs": [
    ["  for (const [rel, edits] of Object.entries(stripModule.DECK_SAVE_REFUSED_PIN_EDITS)) for (const [has] of edits) assert.ok(laterStrips(rel, read(rel)).includes(has) && has.includes('registry read (DECK-SAVE-REFUSED-NOTICE)'), `${rel}: a taught line is there and carries the registry-read mark`) // LATER-CHANGES: registry read (DUAL-LOOKUP): the strips registered after this change (the flip enablers' whole-text pin edits, chained on this change's taught lines) are put back first, newest first\n", "  for (const [rel, edits] of Object.entries(stripModule.DECK_SAVE_REFUSED_PIN_EDITS)) for (const [has] of edits) assert.ok(read(rel).includes(has) && has.includes('registry read (DECK-SAVE-REFUSED-NOTICE)'), `${rel}: a taught line is there and carries the registry-read mark`)\n"],
    ["  for (const rel of stripModule.DECK_SAVE_REFUSED_PIN_FILES) assert.equal(ctx.norm(rel, stripDeckSaveRefused(rel, laterStrips(rel, git('show', `${head}:${rel}`)))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: with its taught lines put back it is the base's, byte for byte`) // LATER-CHANGES: registry read (DUAL-LOOKUP): the strips registered after this change (the flip enablers' whole-text pin edits, chained on this change's taught lines) are put back first, newest first\n", "  for (const rel of stripModule.DECK_SAVE_REFUSED_PIN_FILES) assert.equal(ctx.norm(rel, stripDeckSaveRefused(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: with its taught lines put back it is the base's, byte for byte`)\n"],
    ["  for (const rel of [...DECK_SAVE_REFUSED_FILES, ...stripModule.DECK_SAVE_REFUSED_PIN_FILES]) assert.equal(otherStrips(rel, stripDeckSaveRefused(rel, laterStrips(rel, read(rel)))), otherStrips(rel, execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 })), `${rel}: ${stripModule.DECK_SAVE_REFUSED_PIN_FILES.includes(rel) ? 'an older file taught to read past this change (its edits put back)' : 'its marked lines taken out'}`) // LATER-CHANGES: registry read (DUAL-LOOKUP): the strips registered after this change (the flip enablers' whole-text pin edits, chained on this change's taught lines) are put back first, newest first\n", "  for (const rel of [...DECK_SAVE_REFUSED_FILES, ...stripModule.DECK_SAVE_REFUSED_PIN_FILES]) assert.equal(otherStrips(rel, stripDeckSaveRefused(rel, read(rel))), otherStrips(rel, execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 })), `${rel}: ${stripModule.DECK_SAVE_REFUSED_PIN_FILES.includes(rel) ? 'an older file taught to read past this change (its edits put back)' : 'its marked lines taken out'}`)\n"],
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^(Flip enablers:|feat\\(studio\\): flip enablers |feat\\(studio\\): sign every Director REST proxy )/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (DUAL-LOOKUP): on program1/studio-flip-enablers (stacked after this change) the first-parent commits are the flip enablers' own (registered: scripts/studio-flip-enablers-strip.mjs, scripts/studio-dual-lookup-strip.mjs), not this change's\n  for (const sha of shas) assert.equal(git('rev-list', '--parents', '-n', '1', sha).trim().split(' ').length, 2, `${sha} is not a merge`)\n", "  for (const sha of shas) assert.equal(git('rev-list', '--parents', '-n', '1', sha).trim().split(' ').length, 2, `${sha} is not a merge`)\n"],
  ],
  "scripts/studio-library-manage-harness.mjs": [
    ["    source = stripLaunchWording(rel, stripDualLookup(rel, source)) // NEXT_PUBLIC_STUDIO_LAUNCH_WORDING: its flag-gated edits come out first // LATER-CHANGES: registry read (DUAL-LOOKUP): the strips registered after this change (the flip enablers' whole-text pin edits, chained on this change's taught lines) are put back first, newest first\n", "    source = stripLaunchWording(rel, source) // NEXT_PUBLIC_STUDIO_LAUNCH_WORDING: its flag-gated edits come out first\n"],
    ["import { LATER_CHANGE_FILES } from './studio-later-changes.mjs' // the files of the changes stacked after bulk edit + chat undo (they register there) are stacked files too\nimport { stripDualLookup } from './studio-dual-lookup-strip.mjs' // LATER-CHANGES: registry read (DUAL-LOOKUP): the flip enablers' Director routes (REST-sign + dual lookup) are read as dev's\n", "import { LATER_CHANGE_FILES } from './studio-later-changes.mjs' // the files of the changes stacked after bulk edit + chat undo (they register there) are stacked files too\n"],
  ],
  "scripts/test-studio-chat-theme-export.mjs": [
    ["    if (rel === 'lib/api/download-service.ts' && read(rel) !== baseFile(rel)) { assert.equal(sha(stripJobDeadlines(rel, (await import('./studio-flip-enablers-strip.mjs')).stripFlipEnablers(rel, read(rel)))), sha(baseFile(rel)), rel); identityHashes[rel] = sha(baseFile(rel)); continue } // stacked after #475: P3-4b's export deadline lines come out first // LATER-CHANGES: registry read (DUAL-LOOKUP): the strips registered after this change (the flip enablers' whole-text pin edits, chained on this change's taught lines) are put back first, newest first\n", "    if (rel === 'lib/api/download-service.ts' && read(rel) !== baseFile(rel)) { assert.equal(sha(stripJobDeadlines(rel, read(rel))), sha(baseFile(rel)), rel); identityHashes[rel] = sha(baseFile(rel)); continue } // stacked after #475: P3-4b's export deadline lines come out first\n"],
  ],
  "scripts/test-studio-phone-hints.mjs": [
    ["  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\\n').filter(Boolean).filter(rel => { try { return ctx.norm(rel, git('show', `${head}:${rel}`)) !== ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)) } catch { return true } })); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel) // LATER-CHANGES: registry read (DUAL-LOOKUP): the strips registered after this change (the flip enablers' whole-text pin edits, chained on this change's taught lines) are put back first, newest first\n", "  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)\n"],
  ],
  "scripts/test-studio-phone-landscape.mjs": [
    ["  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\\n').filter(Boolean).filter(rel => { try { return ctx.norm(rel, git('show', `${head}:${rel}`)) !== ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)) } catch { return true } })); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel) // LATER-CHANGES: registry read (DUAL-LOOKUP): the strips registered after this change (the flip enablers' whole-text pin edits, chained on this change's taught lines) are put back first, newest first\n", "  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)\n"],
  ],
  "scripts/test-studio-rail-add-slide.mjs": [
    ["const withoutFirstPaint = lines => lines.filter(line => !(line.startsWith('+') && ((rel) => { const raw = fs.readFileSync(path.join(repoRoot, rel), 'utf8').split('\\n'), kept = new Set(stripLaterChanges(rel, raw.join('\\n')).split('\\n')); return new Set(raw.filter(l => !kept.has(l))) })(VIEWER).has(line.slice(1))) && !belongsToFirstPaint(line) && !line.includes('PASS3-POLISH-B') && !line.includes('CHAT-STALE-VIEWER-GUARD')) // LATER-CHANGES: registry read (PASS3-POLISH-B) // LATER-CHANGES: registry read (CHAT-STALE-VIEWER-GUARD): the stale viewer guard stacked after this change marks its own viewer lines // LATER-CHANGES: registry read (DUAL-LOOKUP): a viewer line a registered later change's strip takes out of the whole file (the flip enablers' viewer ticket) is its own; laterStripRemoves = the lines the registry's strips remove\n", "const withoutFirstPaint = lines => lines.filter(line => !belongsToFirstPaint(line) && !line.includes('PASS3-POLISH-B') && !line.includes('CHAT-STALE-VIEWER-GUARD')) // LATER-CHANGES: registry read (PASS3-POLISH-B) // LATER-CHANGES: registry read (CHAT-STALE-VIEWER-GUARD): the stale viewer guard stacked after this change marks its own viewer lines\n"],
  ],
  "scripts/test-studio-chat-element-edit.mjs": [
    ["    assert.equal(stripPeers(rel, stripChatElementEdit(rel, LATER_STRIPS.slice(LATER_STRIPS.indexOf(stripChatElementEdit) + 1).reduceRight((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, read(rel)))), stripPeers(rel, devFile(rel)), rel) // LATER-CHANGES: registry read (DUAL-LOOKUP): the strips registered after this change (the flip enablers' whole-text pin edits, chained on this change's taught lines) are put back first, newest first\n", "    assert.equal(stripPeers(rel, stripChatElementEdit(rel, text)), stripPeers(rel, devFile(rel)), rel)\n"],
    ["    const devLines = devFile(rel).split('\\n'), textLines = LATER_STRIPS.slice(LATER_STRIPS.indexOf(stripChatElementEdit) + 1).reduceRight((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, read(rel)).split('\\n') // LATER-CHANGES: registry read (DUAL-LOOKUP): the strips registered after this change (the flip enablers' whole-text pin edits, chained on this change's taught lines) are put back first, newest first\n", "    const devLines = devFile(rel).split('\\n'), textLines = text.split('\\n')\n"],
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^(Flip enablers:|feat\\(studio\\): flip enablers |feat\\(studio\\): sign every Director REST proxy )/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (DUAL-LOOKUP): on program1/studio-flip-enablers (stacked after this change) the first-parent commits are the flip enablers' own (registered: scripts/studio-flip-enablers-strip.mjs, scripts/studio-dual-lookup-strip.mjs), not this change's\n  // Merged into dev, this change's commits come in by the merge's second parent and the first-parent line has none of them: nothing of this change's own is left to read (the files are dev's then).\n", "  // Merged into dev, this change's commits come in by the merge's second parent and the first-parent line has none of them: nothing of this change's own is left to read (the files are dev's then).\n"],
    ["  const added = git('diff', '-U0', BASE_COMMIT, '--', rel).split('\\n').filter(l => l.startsWith('+') && !l.startsWith('+++') && stripPeers(rel, `${l.slice(1)}\\n`) !== '').filter(((raw, kept) => l => !(raw.includes(l.slice(1)) && !kept.includes(l.slice(1))))(read(rel).split('\\n'), stripPeers(rel, read(rel)).split('\\n'))) // a line another registered change marks (Arrange's) is its own // LATER-CHANGES: registry read (DUAL-LOOKUP): a line a registered later change's strip takes out of the whole file (the flip enablers' viewer ticket) is its own\n", "  const added = git('diff', '-U0', BASE_COMMIT, '--', rel).split('\\n').filter(l => l.startsWith('+') && !l.startsWith('+++') && stripPeers(rel, `${l.slice(1)}\\n`) !== '') // a line another registered change marks (Arrange's) is its own\n"],
  ],
  'scripts/test-studio-deck-import.mjs': [
    ["import { stripLaterChanges, LATER_CHANGE_FILES } from './studio-later-changes.mjs' // stacked: the later-changes registry (a change stacked after this one registers its files, its .env.example block and its strip there; every read of an app file goes through it first) // LATER-CHANGES: registry read (DUAL-LOOKUP): the registered later-change files\n", "import { stripLaterChanges } from './studio-later-changes.mjs' // stacked: the later-changes registry (a change stacked after this one registers its files, its .env.example block and its strip there; every read of an app file goes through it first)\n"],
    ["  deepEq([...text.keys()].filter(rel => rel !== HELPER && /director-rest-entitlement/.test(text.get(rel))).filter(rel => !(LATER_CHANGE_FILES.has(rel))).sort(), [JOBS, START].sort(), 'the minter is imported by the two import routes only') // LATER-CHANGES: registry read (DUAL-LOOKUP): a registered later change's server-only Director signers are its own\n", "  deepEq([...text.keys()].filter(rel => rel !== HELPER && /director-rest-entitlement/.test(text.get(rel))).sort(), [JOBS, START].sort(), 'the minter is imported by the two import routes only')\n"],
  ],
}
export const DUAL_LOOKUP_PIN_FILES = Object.keys(DUAL_LOOKUP_EDITS)
/** Pins this change taught that no longer need a put-back: stacked on #577, its own registry read of test-studio-template-library-manage already skips registered files, so the merge kept #577's line. Still in this change's commit scope. */
export const DUAL_LOOKUP_RETIRED_PIN_FILES = ['scripts/test-studio-template-library-manage.mjs']

/** New files (no base text to put back). */
export const DUAL_LOOKUP_NEW_FILES = ['lib/studio-director-email-fallback.ts', 'scripts/studio-dual-lookup-strip.mjs', 'scripts/test-studio-dual-lookup.mjs']

/** Files this change edits that are neither marked app code nor new. Run the proof with `node scripts/test-studio-dual-lookup.mjs`. */
export const DUAL_LOOKUP_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...DUAL_LOOKUP_PIN_FILES, ...DUAL_LOOKUP_RETIRED_PIN_FILES]

/** Every file this change's commit touches. */
export const DUAL_LOOKUP_SCOPE_FILES = new Set([...DUAL_LOOKUP_FILES, ...DUAL_LOOKUP_NEW_FILES, ...DUAL_LOOKUP_OWN_EDITS])

/** The whole .env.example block (comments only: the flag is the branch's own). */
export const DUAL_LOOKUP_ENV_BLOCK = `# STUDIO DIRECTOR DUAL LOOKUP (FRONTEND-1; flip enablers). No flag of its own: it rides STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED (server, "true" only, default off; off = nothing read, nothing re-asked).
# On: reads of Director user-owned records (templates, themes, the standard theme, ingest jobs, a chat session's library) ask with the DB id first and, only when that finds nothing, once more with the
# signed-in user's own e-mail (server session, never the request), signed for that e-mail, so records saved under the e-mail before the switch still load. Writes always use the DB id.
`

/**
 * Stacked on #577 (and #583): #577's own strip (scripts/studio-director-rest-sign-strip.mjs, registered BEFORE this one) now takes the REST-sign lines out of the thirteen Director routes, so this
 * change no longer carries a put-back of them. What is left is the flip enablers' own route edit (359ec019: e-mail sessions resolve to the DB id, resolveDirectorUserId): [text now, text before]
 * per edit, whole lines with one context line, on the text #577's strip leaves and after this change's DUAL-LOOKUP lines are out. Through the registry each route reads as dev's, byte for byte.
 */
export const RESOLVE_ID_ROUTE_EDITS = {
 "app/api/director/sessions/[sourceSessionId]/handoff/route.ts": [
  [
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\nimport { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'\n",
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\n"
  ],
  [
   "  const sessionUser = session?.user as SessionUser | undefined\n  const userId = await resolveDirectorUserId(sessionUser?.id || sessionUser?.email)\n",
   "  const sessionUser = session?.user as SessionUser | undefined\n  const userId = sessionUser?.id || sessionUser?.email\n"
  ]
 ],
 "app/api/ingest-jobs/[jobId]/route.ts": [
  [
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\nimport { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'\n",
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\n"
  ],
  [
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;\n  return resolveDirectorUserId(uid);\n",
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;\n  return uid ?? null;\n"
  ]
 ],
 "app/api/slides/compose/route.ts": [
  [
   "import { composeEntitlementHeaders } from '@/lib/studio-compose-entitlement'\nimport { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'\n",
   "import { composeEntitlementHeaders } from '@/lib/studio-compose-entitlement'\n"
  ],
  [
   "  const sessionUser = session?.user as SessionUserWithId | undefined\n  const userId = await resolveDirectorUserId(sessionUser?.id || sessionUser?.email)\n",
   "  const sessionUser = session?.user as SessionUserWithId | undefined\n  const userId = sessionUser?.id || sessionUser?.email\n"
  ]
 ],
 "app/api/slides/jobs/[jobId]/route.ts": [
  [
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\nimport { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'\n",
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\n"
  ],
  [
   "  const sessionUser = session?.user as SessionUserWithId | undefined\n  const userId = await resolveDirectorUserId(sessionUser?.id || sessionUser?.email)\n",
   "  const sessionUser = session?.user as SessionUserWithId | undefined\n  const userId = sessionUser?.id || sessionUser?.email\n"
  ]
 ],
 "app/api/slides/refine/route.ts": [
  [
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\nimport { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'\n",
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\n"
  ],
  [
   "  const sessionUser = session?.user as SessionUserWithId | undefined\n  const userId = await resolveDirectorUserId(sessionUser?.id || sessionUser?.email)\n",
   "  const sessionUser = session?.user as SessionUserWithId | undefined\n  const userId = sessionUser?.id || sessionUser?.email\n"
  ]
 ],
 "app/api/templates/[id]/blueprint/route.ts": [
  [
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\nimport { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'\n",
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\n"
  ],
  [
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;\n  return resolveDirectorUserId(uid);\n",
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;\n  return uid ?? null;\n"
  ]
 ],
 "app/api/templates/[id]/enrich/route.ts": [
  [
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\nimport { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'\n",
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\n"
  ],
  [
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;\n  return resolveDirectorUserId(uid);\n",
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;\n  return uid ?? null;\n"
  ]
 ],
 "app/api/templates/[id]/route.ts": [
  [
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\nimport { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'\n",
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\n"
  ],
  [
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;\n  return resolveDirectorUserId(uid);\n",
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;\n  return uid ?? null;\n"
  ]
 ],
 "app/api/templates/route.ts": [
  [
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\nimport { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'\n",
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\n"
  ],
  [
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;\n  return resolveDirectorUserId(uid);\n",
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;\n  return uid ?? null;\n"
  ]
 ],
 "app/api/themes/[id]/route.ts": [
  [
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\nimport { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'\n",
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\n"
  ],
  [
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email\n  return resolveDirectorUserId(uid)\n",
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email\n  return uid ?? null\n"
  ]
 ],
 "app/api/themes/[id]/standard/route.ts": [
  [
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\nimport { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'\n",
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\n"
  ],
  [
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email\n  return resolveDirectorUserId(uid)\n",
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email\n  return uid ?? null\n"
  ]
 ],
 "app/api/themes/route.ts": [
  [
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\nimport { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'\n",
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\n"
  ],
  [
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email\n  return resolveDirectorUserId(uid)\n",
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email\n  return uid ?? null\n"
  ]
 ],
 "app/api/themes/standard/route.ts": [
  [
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\nimport { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'\n",
   "import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'\n"
  ],
  [
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email\n  return resolveDirectorUserId(uid)\n",
   "  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email\n  return uid ?? null\n"
  ]
 ]
}
export const RESOLVE_ID_ROUTE_FILES = Object.keys(RESOLVE_ID_ROUTE_EDITS)
/** The route without the flip enablers' resolveDirectorUserId edit (#577's lines and this change's marked lines must already be out). */
export function putBackResolveId(rel, text) {
  return (RESOLVE_ID_ROUTE_EDITS[rel] || []).reduce((out, [now, before]) => out.replace(now, () => before), text)
}
/** The file without this change's marked lines only (no put-back): the own-commit proof compares this with the commit before it. */
export function removeDualLookupLines(rel, text) {
  return typeof text === 'string' && DUAL_LOOKUP_FILES.includes(rel) ? text.split('\n').filter(line => !DUAL_LOOKUP_MARKER_RE.test(line)).join('\n') : text
}

/** The file without this change's lines: every line that carries the marker is taken out. Any other file is returned as it is. */
export function stripDualLookup(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in DUAL_LOOKUP_EDITS) return DUAL_LOOKUP_EDITS[rel].reduce((out, [has, was]) => out.replace(has, () => was), text) // a taught proof: its previous text
  return putBackResolveId(rel, removeDualLookupLines(rel, text))
}
