// program1/studio-flip-enablers: Studio enablers for the security flags (all default off): Director e-mail-session DB id, library proxy,
// Researcher upload proxy (NEXT_PUBLIC_STUDIO_RESEARCHER_PROXY_ENABLED / STUDIO_RESEARCHER_PROXY_ENABLED), Layout viewer ticket
// (NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED), Downloads bearer (NEXT_PUBLIC_STUDIO_DOWNLOADS_AUTH_ENABLED).
// Registers with scripts/studio-later-changes.mjs so older "base byte for byte" pins strip this change's edits. Plain node, nothing read here.

/** Existing app files: [text now, text before] per edit (whole lines, with unchanged context lines at the start). */
export const FLIP_ENABLERS_EDITS = {
  "scripts/test-studio-dual-lookup.mjs": [
    [
      "    if (isLib) { const h = setup(false, { user: { email: EMAIL } }, rows); h.state.answer = () => miss; const r = await call(h.load(rel)); eq(h.state.fetches.length, 0, `${rel}: flag off, no call`); eq(r.status, 404, `${rel}: flag off, 404`); eq(bodyOf(r).error, 'not_enabled', `${rel}: flag off, not_enabled`); eq(h.state.dbReads, 0, `${rel}: flag off, no DB read`) } else // LATER-CHANGES: registry read (FLIP-ENABLERS): \"Flip enablers: library route gated behind the flag\", registered after this change, answers the library route 404 not_enabled with the flag off before any read; the other routes keep the flag-off identity below\n    { const h = setup(false, { user: { email: EMAIL } }, rows); h.state.answer = () => miss; const r = await call(h.load(rel))\n",
      "    { const h = setup(false, { user: { email: EMAIL } }, rows); h.state.answer = () => miss; const r = await call(h.load(rel))\n"
    ]
  ],
  "scripts/test-studio-model-choice.mjs": [
    [
      "    const after = routesOf(git('ls-files', '-co', '--exclude-standard', '--', 'app').split('\\n').filter(Boolean))\n    after.splice(0, after.length, ...after.filter(route => before.includes(route) || !['/api/director/sessions/[sourceSessionId]/library', '/api/downloads/access-token', '/api/presentations/[id]/viewer-ticket', '/api/researcher/upload/[step]'].includes(route))) // LATER-CHANGES: registry read (FLIP-ENABLERS): program1/studio-flip-enablers, registered after this change, adds four routes of its own (library, Downloads access token, viewer ticket, Researcher upload); past them the route set is this change's\n",
      "    const after = routesOf(git('ls-files', '-co', '--exclude-standard', '--', 'app').split('\\n').filter(Boolean))\n"
    ]
  ],
  "components/presentation-viewer.tsx": [
    [
      "} from '@/lib/studio-slide-count-sync'\nimport { useLayoutViewerTicketSrc } from '@/lib/studio-layout-viewer-ticket-client' // LAYOUT-TICKET (NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED, default off)\n",
      "} from '@/lib/studio-slide-count-sync'\n"
    ],
    [
      "  }, [approvedPresentationUrl, studioShell, buildSnapshotRevision])\n  // LAYOUT-TICKET (NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED, default off): the editing frame loads with a minted viewer ticket, renewed in place by lib/studio-layout-viewer-ticket.ts. Off: exactly approvedIframeNavigationUrl.\n  const ticketedIframeSrc = useLayoutViewerTicketSrc(approvedIframeNavigationUrl, presentationId)\n",
      "  }, [approvedPresentationUrl, studioShell, buildSnapshotRevision])\n"
    ],
    [
      "                  src={approvedIframeNavigationUrl || undefined}\n                  {...((/* LAYOUT-TICKET */ ticketedIframeSrc !== approvedIframeNavigationUrl ? { src: ticketedIframeSrc || undefined } : {}) as object)}\n",
      "                  src={approvedIframeNavigationUrl || undefined}\n"
    ]
  ],
  "lib/api/download-service.ts": [
    [
      "import { withExportViewOnly } from '@/lib/export-view-only';\nimport { downloadAuthHeaders } from '@/lib/downloads-auth-client'; // DOWNLOADS-AUTH\n",
      "import { withExportViewOnly } from '@/lib/export-view-only';\n"
    ],
    [
      "    const response = await fetch(`${getDownloadServiceUrl()}/convert/pdf`, {\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/json',\n        ...(await downloadAuthHeaders()), // DOWNLOADS-AUTH (NEXT_PUBLIC_STUDIO_DOWNLOADS_AUTH_ENABLED, default off): Bearer access token; off adds nothing\n",
      "    const response = await fetch(`${getDownloadServiceUrl()}/convert/pdf`, {\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/json',\n"
    ],
    [
      "    const response = await fetch(`${getDownloadServiceUrl()}/convert/pptx`, {\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/json',\n        ...(await downloadAuthHeaders()), // DOWNLOADS-AUTH (NEXT_PUBLIC_STUDIO_DOWNLOADS_AUTH_ENABLED, default off): Bearer access token; off adds nothing\n",
      "    const response = await fetch(`${getDownloadServiceUrl()}/convert/pptx`, {\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/json',\n"
    ]
  ],
  "hooks/use-file-upload.ts": [
    [
      "import { ingestStatusPollUrl, type IngestStatusPollIdentity } from '@/lib/researcher-ingest-status-auth'\nimport { researcherUploadUrl } from '@/lib/researcher-upload-proxy'\n",
      "import { ingestStatusPollUrl, type IngestStatusPollIdentity } from '@/lib/researcher-ingest-status-auth'\n"
    ],
    [
      "      const pending = (async () => {\n        const response = await fetch(researcherUploadUrl(getResearcherBaseUrl(), 'sessions/create', { sessionId: owner.sessionId, userId: owner.userId }), {\n",
      "      const pending = (async () => {\n        const response = await fetch(`${getResearcherBaseUrl()}/api/v1/sessions/create`, {\n"
    ],
    [
      "    researcherSessionPromiseRef.current = (async () => {\n      const response = await fetch(researcherUploadUrl(getResearcherBaseUrl(), 'sessions/create', { sessionId: currentSessionId, userId }), {\n",
      "    researcherSessionPromiseRef.current = (async () => {\n      const response = await fetch(`${getResearcherBaseUrl()}/api/v1/sessions/create`, {\n"
    ],
    [
      "    researcherSessionId: string,\n    file: File,\n    contentType: string,\n    proxyIdentity?: IngestStatusPollIdentity,\n",
      "    researcherSessionId: string,\n    file: File,\n    contentType: string,\n"
    ],
    [
      "  ): Promise<StorageUploadUrlResponse> => {\n    const response = await fetch(researcherUploadUrl(getResearcherBaseUrl(), 'files/storage-upload-url', proxyIdentity), {\n",
      "  ): Promise<StorageUploadUrlResponse> => {\n    const response = await fetch(`${getResearcherBaseUrl()}/api/v1/files/storage-upload-url`, {\n"
    ],
    [
      "    storagePath: string,\n    file: File,\n    contentType: string,\n    proxyIdentity?: IngestStatusPollIdentity,\n",
      "    storagePath: string,\n    file: File,\n    contentType: string,\n"
    ],
    [
      "  ): Promise<ProcessUploadedResponse> => {\n    const response = await fetch(researcherUploadUrl(getResearcherBaseUrl(), 'files/process-uploaded', proxyIdentity), {\n",
      "  ): Promise<ProcessUploadedResponse> => {\n    const response = await fetch(`${getResearcherBaseUrl()}/api/v1/files/process-uploaded`, {\n"
    ],
    [
      "      updateFile(fileId, { uploadProgress: 10 }, owner)\n      // NEXT_PUBLIC_STUDIO_RESEARCHER_PROXY_ENABLED (off): which chat session + owner kind the same-origin proxy signs for. Unused when off.\n      const proxyIdentity: IngestStatusPollIdentity = {\n        sessionId: (STUDIO_UPLOAD_OWNERSHIP ? owner?.sessionId : sessionIdRef.current) ?? '',\n        userId: STUDIO_UPLOAD_OWNERSHIP ? owner?.userId : userId,\n      }\n",
      "      updateFile(fileId, { uploadProgress: 10 }, owner)\n"
    ],
    [
      "\n      const uploadUrl = await requestStorageUploadUrl(researcherSessionId, file, contentType, proxyIdentity)\n",
      "\n      const uploadUrl = await requestStorageUploadUrl(researcherSessionId, file, contentType)\n"
    ],
    [
      "          contentType,\n          proxyIdentity,\n",
      "          contentType,\n"
    ]
  ],
  "lib/researcher-upload.ts": [
    [
      "import { getKnowledgeServiceUrl } from '@/lib/config'\nimport { researcherUploadUrl } from '@/lib/researcher-upload-proxy'\n",
      "import { getKnowledgeServiceUrl } from '@/lib/config'\n"
    ],
    [
      "  const contentType = file.type || 'application/octet-stream'\n  // NEXT_PUBLIC_STUDIO_RESEARCHER_PROXY_ENABLED (off): same-origin proxy adds X-API-Key + session token. Off: direct URLs as before.\n  const proxyIdentity = { sessionId, userId }\n",
      "  const contentType = file.type || 'application/octet-stream'\n"
    ],
    [
      "  onProgress?.({ percent: 5, stage: 'session' })\n  const sessionResponse = await fetch(researcherUploadUrl(researcherBaseUrl, 'sessions/create', proxyIdentity), {\n",
      "  onProgress?.({ percent: 5, stage: 'session' })\n  const sessionResponse = await fetch(`${researcherBaseUrl}/api/v1/sessions/create`, {\n"
    ],
    [
      "  onProgress?.({ percent: 20, stage: 'prepare' })\n  const prepareResponse = await fetch(researcherUploadUrl(researcherBaseUrl, 'files/storage-upload-url', proxyIdentity), {\n",
      "  onProgress?.({ percent: 20, stage: 'prepare' })\n  const prepareResponse = await fetch(`${researcherBaseUrl}/api/v1/files/storage-upload-url`, {\n"
    ],
    [
      "  onProgress?.({ percent: 75, stage: 'process' })\n  const processResponse = await fetch(researcherUploadUrl(researcherBaseUrl, 'files/process-uploaded', proxyIdentity), {\n",
      "  onProgress?.({ percent: 75, stage: 'process' })\n  const processResponse = await fetch(`${researcherBaseUrl}/api/v1/files/process-uploaded`, {\n"
    ]
  ],
  "scripts/test-composer-storage-upload.mjs": [
    [
      "      if (name === '@/lib/service-url') return serviceUrl\n      if (name === '@/lib/researcher-upload-proxy') return { researcherUploadUrl: (base, step) => `${base}/api/v1/${step}` } // program1/studio-flip-enablers, flag off\n",
      "      if (name === '@/lib/service-url') return serviceUrl\n"
    ]
  ],
  "scripts/test-export-view-only.mjs": [
    [
      "    '@/lib/service-url': serviceUrlShim,\n    ...(withLib ? { '@/lib/export-view-only': lib } : {}),\n    '@/lib/downloads-auth-client': { downloadAuthHeaders: async () => ({}) }, // program1/studio-flip-enablers, flag off\n",
      "    '@/lib/service-url': serviceUrlShim,\n    ...(withLib ? { '@/lib/export-view-only': lib } : {}),\n"
    ],
    [
      "    },\n    ...(withLib ? { '@/lib/export-view-only': lib } : {}),\n    '@/lib/downloads-auth-client': { downloadAuthHeaders: async () => ({}) }, // program1/studio-flip-enablers, flag off\n",
      "    },\n    ...(withLib ? { '@/lib/export-view-only': lib } : {}),\n"
    ]
  ],
  "scripts/test-researcher-ingest-status-auth.mjs": [
    [
      "    '@/lib/researcher-ingest-status-auth': authLib,\n    // program1/studio-flip-enablers: flag-off upload URLs (NEXT_PUBLIC_STUDIO_RESEARCHER_PROXY_ENABLED unset) are the direct ones.\n    '@/lib/researcher-upload-proxy': { researcherUploadUrl: (base, step) => `${base}/api/v1/${step}` },\n",
      "    '@/lib/researcher-ingest-status-auth': authLib,\n"
    ]
  ],
  "scripts/test-studio-arrange.mjs": [
    ["    check(assert.equal, registry.stripLaterChanges(rel, strip.putBackPin(rel, registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(strip.stripStudioArrange) + 1).reduceRight((out, later) => { const next = later(rel, out); return typeof next === 'string' ? next : out }, read(rel)))), registry.stripLaterChanges(rel, baseText(rel)), `the taught line of ${rel} puts back to the base's`) // LATER-CHANGES: registry read (CHAT-CLEAN): a change registered later (chat clean) teaches this pin too, with lines of its own; past them (the registry's strips, both sides) the put-back is the base's // LATER-CHANGES: registry read (FLIP-ENABLERS): the strips registered after this change are put back first, newest first (the flip enablers rewrite a line of a pin another later change already taught), then this change's put-back\n", "    check(assert.equal, registry.stripLaterChanges(rel, strip.putBackPin(rel, read(rel))), registry.stripLaterChanges(rel, baseText(rel)), `the taught line of ${rel} puts back to the base's`) // LATER-CHANGES: registry read (CHAT-CLEAN): a change registered later (chat clean) teaches this pin too, with lines of its own; past them (the registry's strips, both sides) the put-back is the base's\n"],
    ["    check(assert.equal, registry.stripLaterChanges(rel, strip.stripStudioArrange(rel, registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(strip.stripStudioArrange) + 1).reduceRight((out, later) => { const next = later(rel, out); return typeof next === 'string' ? next : out }, read(rel)))), registry.stripLaterChanges(rel, baseText(rel)), `${rel} through the strip is the base's`) // LATER-CHANGES: registry read (CHAT-CLEAN): the same pin through this change's strip, past the later change's lines // LATER-CHANGES: registry read (FLIP-ENABLERS): the strips registered after this change are put back first, newest first (the flip enablers rewrite a line of a pin another later change already taught), then this change's put-back\n", "    check(assert.equal, registry.stripLaterChanges(rel, strip.stripStudioArrange(rel, read(rel))), registry.stripLaterChanges(rel, baseText(rel)), `${rel} through the strip is the base's`) // LATER-CHANGES: registry read (CHAT-CLEAN): the same pin through this change's strip, past the later change's lines\n"],
    [
      "import { stripDeckSaveRefused } from './studio-deck-save-refused-strip.mjs' // LATER-CHANGES: registry read (DECK-SAVE-REFUSED-NOTICE): the change stacked after this one marks lines in the viewer; the viewer is compared with the base past them\nconst { stripFlipEnablers } = await import('./studio-flip-enablers-strip.mjs') // LATER-CHANGES: registry read (FLIP-ENABLERS): program1/studio-flip-enablers' viewer lines come out first\n",
      "import { stripDeckSaveRefused } from './studio-deck-save-refused-strip.mjs' // LATER-CHANGES: registry read (DECK-SAVE-REFUSED-NOTICE): the change stacked after this one marks lines in the viewer; the viewer is compared with the base past them\n"
    ],
    [
      "  for (const rel of strip.STUDIO_ARRANGE_FILES) {\n    const now = stripDeckSaveRefused(rel, stripFlipEnablers(rel, read(rel))) // LATER-CHANGES: registry read (DECK-SAVE-REFUSED-NOTICE): the lines of the change stacked after this one come out first\n",
      "  for (const rel of strip.STUDIO_ARRANGE_FILES) {\n    const now = stripDeckSaveRefused(rel, read(rel)) // LATER-CHANGES: registry read (DECK-SAVE-REFUSED-NOTICE): the lines of the change stacked after this one come out first\n"
    ]
  ],
  "scripts/test-studio-director-rest-sign.mjs": [
    [
      "  state.session = { user: { email: 'b@example.test' } }; state.dbRows.set('email:b@example.test', 'cm-other'); state.warns = []\n  fresh() // LATER-CHANGES: flip enablers: an e-mail-only session resolves to its DB id at the proxy, so the routes send AND sign it; the e-mail fallback is reached at the signer\n  for (const c of await runAll()) { const h = header(c.f); ok(h, `${c.rel} ${c.method} e-mail session signed`); eq(verify(h, SECRET, c.method).sub, 'cm-other', `${c.rel}: sub is the DB id`); eq(sentUserId(c.f), 'cm-other', `${c.rel}: e-mail session sends the DB id`) } // LATER-CHANGES: flip enablers\n  state.warns = []; fresh() // LATER-CHANGES: flip enablers\n  eq(Object.keys(await signer().directorRestSignHeaders('b@example.test', 'GET')), [], 'e-mail fallback: no header (fail-closed)') // LATER-CHANGES: flip enablers\n  eq(state.warns.length, 1, 'e-mail fallback: one log line')\n  ok(/e-mail fallback/.test(state.warns[0]) && /DIRECTOR_REST_AUTH_ALL_ENABLED/.test(state.warns[0]), 'the line names the fallback and the Director flag')\n  ok(!state.warns[0].includes('b@example.test') && !state.warns[0].includes(SECRET), 'the line holds neither the e-mail nor the secret')\n  state.dbRows.delete('email:b@example.test'); await expectNone('e-mail session, no DB row') // LATER-CHANGES: flip enablers\n  env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED = 'false'; fresh(); for (const c of await runAll()) { eq(header(c.f), null, `${c.rel}: flag off, no header`); eq(sentUserId(c.f), 'b@example.test', `${c.rel}: flag off sends the e-mail as before`) } env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED = 'true' // LATER-CHANGES: flip enablers\n",
      "  state.session = { user: { email: 'b@example.test' } }; state.dbRows.set('email:b@example.test', 'cm-other'); state.warns = []\n  fresh()\n  const jobs = ROUTES.find(r => r[0] === 'app/api/slides/jobs/[jobId]/route.ts')\n  state.fetches = []; await jobs[2](load(jobs[0]))\n  eq(header(state.fetches[0]), null, 'e-mail fallback: no header (fail-closed)')\n  eq(sentUserId(state.fetches[0]), 'b@example.test', 'e-mail fallback: the proxy sent the e-mail')\n  eq(state.warns.length, 1, 'e-mail fallback: one log line')\n  ok(/e-mail fallback/.test(state.warns[0]) && /DIRECTOR_REST_AUTH_ALL_ENABLED/.test(state.warns[0]), 'the line names the fallback and the Director flag')\n  ok(!state.warns[0].includes('b@example.test') && !state.warns[0].includes(SECRET), 'the line holds neither the e-mail nor the secret')\n  await expectNone('e-mail fallback, DB id differs from sent id')\n"
    ]
  ],
  "scripts/test-studio-first-paint-viewer.mjs": [
    [
      "import { stripPass3PolishB } from './studio-pass3-polish-b-strip.mjs' // LATER-CHANGES: registry read (PASS3-POLISH-B)\nconst { stripFlipEnablers } = await import('./studio-flip-enablers-strip.mjs') // LATER-CHANGES: registry read (FLIP-ENABLERS): program1/studio-flip-enablers' viewer lines come out first\n",
      "import { stripPass3PolishB } from './studio-pass3-polish-b-strip.mjs' // LATER-CHANGES: registry read (PASS3-POLISH-B)\n"
    ],
    [
      "// =========================================================== Part 1: source pins ===========================================================\nconst viewerText = chatParityStrip.stripChatParity(VIEWER, stripFlipEnablers(VIEWER, read(VIEWER))) // stacked after #475: LATER-CHANGES: registry read (CHAT-PARITY): chat parity's marked line in the viewer (the Master opener) comes out before the byte pin below\n",
      "// =========================================================== Part 1: source pins ===========================================================\nconst viewerText = chatParityStrip.stripChatParity(VIEWER, read(VIEWER)) // stacked after #475: LATER-CHANGES: registry read (CHAT-PARITY): chat parity's marked line in the viewer (the Master opener) comes out before the byte pin below\n"
    ]
  ],
  "scripts/test-studio-job-deadlines.mjs": [
    [
      "        if (id === '@/lib/studio-job-deadlines') return jobsStub\n        if (id === '@/lib/downloads-auth-client') return { downloadAuthHeaders: async () => ({}) } // LATER-CHANGES: registry read (FLIP-ENABLERS): program1/studio-flip-enablers', flag off adds no header\n",
      "        if (id === '@/lib/studio-job-deadlines') return jobsStub\n"
    ]
  ],
  "scripts/test-studio-phone-hints.mjs": [
    [
      "import * as registry from './studio-later-changes.mjs'\nconst { stripFlipEnablers } = await import('./studio-flip-enablers-strip.mjs') // LATER-CHANGES: registry read (FLIP-ENABLERS): program1/studio-flip-enablers' viewer lines come out first\n",
      "import * as registry from './studio-later-changes.mjs'\n"
    ],
    [
      "await check('the marked lines are where they should be: the page has two imports and one line of JSX (after PR 1\\'s), every one names the marker as a whole token and none names PR 1\\'s (neither strip can take out the other\\'s lines); the viewer is not touched at all and still answers the key the swipe presses', () => {\n  const page = read(PAGE), viewer = stripFlipEnablers(VIEWER, read(VIEWER))\n",
      "await check('the marked lines are where they should be: the page has two imports and one line of JSX (after PR 1\\'s), every one names the marker as a whole token and none names PR 1\\'s (neither strip can take out the other\\'s lines); the viewer is not touched at all and still answers the key the swipe presses', () => {\n  const page = read(PAGE), viewer = read(VIEWER)\n"
    ]
  ],
  "scripts/test-studio-phone-landscape.mjs": [
    [
      "import * as registry from './studio-later-changes.mjs'\nconst { stripFlipEnablers } = await import('./studio-flip-enablers-strip.mjs') // LATER-CHANGES: registry read (FLIP-ENABLERS)\n",
      "import * as registry from './studio-later-changes.mjs'\n"
    ],
    [
      "await check('the marked lines are where they should be: the page has three imports, the workspace clamp\\'s call and one line of JSX (five), every one names the marker as a whole token, no existing line is rewritten; the viewer is not touched at all, and the two lines of it the stage\\'s CSS relies on are still there (its 16 px padding, and the fit that takes 32 px off what it measures)', () => {\n  const page = read(PAGE), viewer = stripFlipEnablers(VIEWER, read(VIEWER)) // LATER-CHANGES: registry read (FLIP-ENABLERS): program1/studio-flip-enablers' viewer lines come out first\n",
      "await check('the marked lines are where they should be: the page has three imports, the workspace clamp\\'s call and one line of JSX (five), every one names the marker as a whole token, no existing line is rewritten; the viewer is not touched at all, and the two lines of it the stage\\'s CSS relies on are still there (its 16 px padding, and the fit that takes 32 px off what it measures)', () => {\n  const page = read(PAGE), viewer = read(VIEWER)\n"
    ]
  ]
}

export const FLIP_ENABLERS_FILES = Object.keys(FLIP_ENABLERS_EDITS)

export const FLIP_ENABLERS_NEW_FILES = [
  'app/api/director/sessions/[sourceSessionId]/library/route.ts',
  'app/api/researcher/upload/[step]/route.ts',
  'app/api/presentations/[id]/viewer-ticket/route.ts',
  'app/api/downloads/access-token/route.ts',
  'lib/researcher-upload-proxy.ts',
  'lib/studio-layout-viewer-ticket.ts',
  'lib/studio-layout-viewer-ticket-client.ts',
  'lib/downloads-access-token.ts',
  'lib/downloads-auth-client.ts',
  'scripts/studio-flip-enablers-strip.mjs',
  'scripts/test-studio-flip-enablers.mjs',
]

/** The whole .env.example block. */
export const FLIP_ENABLERS_ENV_BLOCK = "# program1/studio-flip-enablers (all default off; names only, values never committed)\n# Researcher upload proxy: browser switch + server gate; the route adds X-API-Key (KNOWLEDGE_API_KEY) and\n# X-Deckster-Session-Token (RESEARCHER_SESSION_TOKEN_SECRET) bound to the chat session's owner.\nNEXT_PUBLIC_STUDIO_RESEARCHER_PROXY_ENABLED=\"false\"\nSTUDIO_RESEARCHER_PROXY_ENABLED=\"false\"\n# Layout viewer ticket: iframe loads /p/{id}?t=<ticket> minted server-side with LAYOUT_SERVICE_TOKEN, renewed by postMessage.\nNEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED=\"false\"\nLAYOUT_SERVICE_TOKEN=\"\"\n# Downloads: Authorization Bearer (Supabase-format access token, HS256 with SUPABASE_JWT_SECRET, sub = DB user id).\nNEXT_PUBLIC_STUDIO_DOWNLOADS_AUTH_ENABLED=\"false\"\nSUPABASE_JWT_SECRET=\"\"\n"

/** This change's strip: the file as it was before this change (any other file returned unchanged). */
export function stripFlipEnablers(rel, text) {
  return (FLIP_ENABLERS_EDITS[rel] || []).reduce((out, [now, before]) => out.replace(now, () => before), text)
}

export const FLIP_ENABLERS_SCOPE_FILES = new Set([
  ...FLIP_ENABLERS_FILES, ...FLIP_ENABLERS_NEW_FILES, '.env.example', 'scripts/studio-later-changes.mjs',
  'lib/studio-director-rest-sign.ts', 'scripts/test-studio-director-rest-sign.mjs',
  'scripts/test-researcher-ingest-status-auth.mjs', 'scripts/test-composer-storage-upload.mjs', 'scripts/test-export-view-only.mjs',
  'app/api/director/sessions/[sourceSessionId]/handoff/route.ts', 'app/api/ingest-jobs/[jobId]/route.ts', 'app/api/slides/compose/route.ts',
  'app/api/slides/jobs/[jobId]/route.ts', 'app/api/slides/refine/route.ts', 'app/api/templates/[id]/blueprint/route.ts',
  'app/api/templates/[id]/enrich/route.ts', 'app/api/templates/[id]/route.ts', 'app/api/templates/route.ts', 'app/api/themes/[id]/route.ts',
  'app/api/themes/[id]/standard/route.ts', 'app/api/themes/route.ts', 'app/api/themes/standard/route.ts',
])
