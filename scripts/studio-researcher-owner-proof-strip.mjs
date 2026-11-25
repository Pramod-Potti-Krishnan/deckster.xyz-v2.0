const ROUTE = 'app/api/director/ws-token/route.ts'
const HOOK = 'hooks/use-deckster-websocket-v2.ts'
const SERVER = 'STUDIO_RESEARCHER_OWNER_PROOF_ENABLED'
const CLIENT = 'NEXT_PUBLIC_STUDIO_RESEARCHER_OWNER_PROOF'

export const SCOPE_FILES = new Set([
  ROUTE, HOOK, '.env.example', 'scripts/studio-later-changes.mjs', 'scripts/test-studio-researcher-owner-proof.mjs',
  'scripts/fixtures/researcher-session-auth-f899342.py', 'scripts/fixtures/researcher-session-auth-parity.mjs',
  'scripts/studio-researcher-owner-proof-strip.mjs',
])
export const ENV_BLOCK = [
  '# D16 STUDIO RESEARCHER OWNER PROOF. Both flags default off and accept only the exact value "true".',
  '# The server flag mints proof for the authenticated account and session. The public build-time flag carries it on auth_refresh.',
  `${SERVER}="false"`,
  `${CLIENT}="false"`,
].join('\n') + '\n'

// Older proof files also pin these D16 successor registrations to their earlier bytes.
const FIRST_PARENT_PIN = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^(?:Researcher owner proof:|(?:Add Studio Researcher owner proof to Director websocket refresh|Prove Director reconnect parity when owner proof is enabled|Pin Studio websocket proof to Researcher token source)$)/.test(git('log', '-1', '--format=%s', sha).trimEnd()))) // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF): the approved D16 WS proof commits belong to the later change, not this guard's own first-parent scope.\n"
const RESEARCH_BY_LEVEL_PINS = [
  [
    "import { ENV_BLOCK as D16_ENV_BLOCK, SCOPE_FILES as D16_SCOPE_FILES, stripResearcherOwnerProof } from './studio-researcher-owner-proof-strip.mjs' // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
    "",
  ],
  [
    [
      "const D16_PIN_FILES = new Set(['scripts/test-studio-chat-element-edit.mjs', 'scripts/test-studio-deck-sync-truth.mjs']) // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "const D16_PIN_LINE = \"  shas.splice(0, shas.length, ...shas.filter(sha => !/^(?:Researcher owner proof:|(?:Add Studio Researcher owner proof to Director websocket refresh|Prove Director reconnect parity when owner proof is enabled|Pin Studio websocket proof to Researcher token source)$)/.test(git('log', '-1', '--format=%s', sha).trimEnd()))) // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF): the approved D16 WS proof commits belong to the later change, not this guard's own first-parent scope.\\n\" // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "const D16_REGISTRY_LINES = new Set([ // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "  \"  ...(await import('./studio-researcher-owner-proof-strip.mjs')).SCOPE_FILES, // LATER-CHANGE: Platform, D16 Studio WS owner proof (STUDIO_RESEARCHER_OWNER_PROOF_ENABLED / NEXT_PUBLIC_STUDIO_RESEARCHER_OWNER_PROOF)\", // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "  \"  (await import('./studio-researcher-owner-proof-strip.mjs')).ENV_BLOCK, // LATER-CHANGE: Platform, D16 Studio WS owner proof (STUDIO_RESEARCHER_OWNER_PROOF_ENABLED / NEXT_PUBLIC_STUDIO_RESEARCHER_OWNER_PROOF)\", // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "  \"  (await import('./studio-researcher-owner-proof-strip.mjs')).stripResearcherOwnerProof, // LATER-CHANGE: Platform, D16 Studio WS owner proof (STUDIO_RESEARCHER_OWNER_PROOF_ENABLED / NEXT_PUBLIC_STUDIO_RESEARCHER_OWNER_PROOF)\", // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "]) // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "const D16_SUCCESSOR_FILES = new Set([ // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "  ...D16_SCOPE_FILES, ...D16_PIN_FILES, 'scripts/test-director-question-submit.mjs', // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "  'scripts/test-studio-researcher-token-mint-sites.mjs', 'scripts/test-studio-sessions-owner.mjs', // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "]) // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "function withoutD16(rel, text) { // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "  if (rel === '.env.example') return text.replace(`\\n${D16_ENV_BLOCK}`, '') // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "  if (rel === 'scripts/studio-later-changes.mjs') { // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "    const pending = new Set(D16_REGISTRY_LINES) // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "    return text.split('\\n').filter(line => !pending.delete(line)).join('\\n') // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "  } // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "  if (D16_PIN_FILES.has(rel)) return text.replace(D16_PIN_LINE, '') // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "  return stripResearcherOwnerProof(rel, text) // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "} // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
      "const read = rel => withoutD16(rel, fs.readFileSync(path.join(root, rel), 'utf8')) // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
    ].join(''),
    "const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')\n",
  ],
  [
    "  assert.deepEqual(registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(STRIP_FN) + 1), [stripUploadFormats, stripResearcherOwnerProof], 'only the upload formats and D16 strips follow this strip, in order') // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): that change's strip is registered after this one // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
    "  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN) && registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(STRIP_FN) + 1).every(strip => strip === stripUploadFormats), 'the strip runs last, but for the Studio upload formats change\\'s (the order the changes were stacked)') // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): that change's strip is registered after this one\n",
  ],
  [
    "const wholeRangeOutside = (names, marketing = UAT_MARKETING_V4_SCOPE_FILES) => names.filter(Boolean).filter(rel => !SCOPE.has(rel) && !UPLOAD_FORMATS_SCOPE_FILES.has(rel) && !D16_SUCCESSOR_FILES.has(rel) && !marketing.has(rel)).sort() // RESEARCH-BY-LEVEL (S67): the committed files of BASE..HEAD that no scope names; a promotion merge of dev into uat carries uat's own marketing-v4 commits, left out by exact path (the uat marketing registry's set), never by prefix and never every later change's files; LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): taught to that change's pin with the other lines of this proof // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
    "const wholeRangeOutside = (names, marketing = UAT_MARKETING_V4_SCOPE_FILES) => names.filter(Boolean).filter(rel => !SCOPE.has(rel) && !UPLOAD_FORMATS_SCOPE_FILES.has(rel) && !marketing.has(rel)).sort() // RESEARCH-BY-LEVEL (S67): the committed files of BASE..HEAD that no scope names; a promotion merge of dev into uat carries uat's own marketing-v4 commits, left out by exact path (the uat marketing registry's set), never by prefix and never every later change's files; LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): taught to that change's pin with the other lines of this proof\n",
  ],
  [
    "  assert.deepEqual(wholeRangeOutside([...UAT_MARKETING_V4_SCOPE_FILES, ...SCOPE, ...UPLOAD_FORMATS_SCOPE_FILES, ...D16_SUCCESSOR_FILES, 'lib/stray-file.ts', 'components/marketing/v4/not-uats-own.tsx']), ['components/marketing/v4/not-uats-own.tsx', 'lib/stray-file.ts'], 'a promotion merge: uat\\'s own marketing-v4 files, this change\\'s and the two named successors are left out; a stray product file and a marketing path uat does not own are still named') // RESEARCH-BY-LEVEL (S67): the table row for the line above; LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): taught to that change's pin with the other lines of this proof // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF)\n",
    "  assert.deepEqual(wholeRangeOutside([...UAT_MARKETING_V4_SCOPE_FILES, ...SCOPE, ...UPLOAD_FORMATS_SCOPE_FILES, 'lib/stray-file.ts', 'components/marketing/v4/not-uats-own.tsx']), ['components/marketing/v4/not-uats-own.tsx', 'lib/stray-file.ts'], 'a promotion merge: uat\\'s own marketing-v4 files, this change\\'s and the upload formats change\\'s are left out; a stray product file and a marketing path uat does not own are still named') // RESEARCH-BY-LEVEL (S67): the table row for the line above; LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): taught to that change's pin with the other lines of this proof\n",
  ],
]

export function stripResearcherOwnerProof(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === ROUTE || rel === HOOK) return text.replace(/^.* \/\/ D16-OWNER-PROOF\n/gm, '')
  if (rel === 'scripts/test-studio-chat-element-edit.mjs' || rel === 'scripts/test-studio-deck-sync-truth.mjs') {
    return text.replace(FIRST_PARENT_PIN, '')
  }
  if (rel === 'scripts/test-studio-research-by-level.mjs') {
    return RESEARCH_BY_LEVEL_PINS.reduce((out, [added, original]) => out.replace(added, () => original), text)
  }
  return text
}
