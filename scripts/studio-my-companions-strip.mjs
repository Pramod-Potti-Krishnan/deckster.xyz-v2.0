// AVATAR-W5 (M11, Step A): PK's own avatar presents in Studio from a private pack. Flag NEXT_PUBLIC_STUDIO_MY_COMPANIONS (exact "true", only with the Studio shell, default off, build-time): "show my companions, no upload".
// Off: the two new routes (GET /api/avatar/companions, GET /api/avatar/pack/<id>/<path>) answer ONE identical 404 and read nothing; the call's character switch, its players and /studio/companions are what they were.
// On: the signed-in owner's own companion (a private pack kept in a private storage bucket; a server variable holds the registry of one) joins the voice call's character switch (the pack, then its portrait, then Felix) and is listed on
// /studio/companions, which then offers no upload and no delete. The upload mock flag is untouched.
// Every line this change adds to an EXISTING file carries the marker MY-COMPANIONS (matched as a whole token); a base line is rewritten only where EDITS says so (a [has, was] pair); putting every pair back gives the file at BASE_COMMIT byte for byte.
// The new files have no base text. The Builder page, the composer, the chat input, the middleware and the next config are not touched.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.
// Older proofs are TAUGHT lines only (MY_COMPANIONS_PIN_EDITS): the two that read the first-parent line each drop this change's subject from it, as for every later change, and the proofs that hold the voice-call files to dev's bytes read them through this strip.

export const BASE_COMMIT = '659f66d7a431711f27c8ad54acb1505c0f3b3265' // origin/studio-v4-dev-preparation-code (#640 merged), the trunk this change sits on
export const MY_COMPANIONS_FLAGS = ['NEXT_PUBLIC_STUDIO_MY_COMPANIONS']
export const MY_COMPANIONS_MARKER = 'MY-COMPANIONS'
/** The marker as a WHOLE token: MY-COMPANIONS is this change's; X-MY-COMPANIONS and MY-COMPANIONS-X are not. */
export const MY_COMPANIONS_MARKER_RE = /(?<![\w-])MY-COMPANIONS(?![\w-])/
/** The subject prefix of this change's own commits. */
export const MY_COMPANIONS_SUBJECT = 'My companions:'

/** Existing files that get marked lines. */
export const MY_COMPANIONS_FILES = [
  "app/(app)/studio/companions/page.tsx",
  "components/builder/voice-call/voice-call-stage.tsx",
  "hooks/use-studio-voice-call.ts",
  "lib/studio-voice-call-ui.ts"
]

/** New files (no base text to put back). */
export const MY_COMPANIONS_NEW_FILES = [
  "app/api/avatar/companions/route.ts",
  "app/api/avatar/pack/[packId]/[...path]/route.ts",
  "components/studio-avatar-spawn/my-companions-page.tsx",
  "lib/server/avatar-pack-access.ts",
  "lib/server/avatar-pack-link.ts",
  "lib/studio-my-companions.ts",
  "scripts/studio-my-companions-strip.mjs",
  "scripts/test-studio-avatar-pack-route.mjs",
  "scripts/test-studio-my-companions-wiring.mjs",
  "scripts/test-studio-my-companions.mjs"
]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per hunk, in the order they sit in the file); putting them back gives the base file byte for byte. */
export const MY_COMPANIONS_EDITS = {
  "app/(app)/studio/companions/page.tsx": [
    [
      "import { STUDIO_MY_COMPANIONS_ENABLED } from \"@/lib/studio-my-companions\" // MY-COMPANIONS\nimport { MyCompanionsPage } from \"@/components/studio-avatar-spawn/my-companions-page\" // MY-COMPANIONS\n",
      ""
    ],
    [
      "  // MY-COMPANIONS (NEXT_PUBLIC_STUDIO_MY_COMPANIONS): the owner's own companions, list only. It wins over the upload mock even when that flag is on too: until Step B's real client there is nothing real to upload to.\n  if (STUDIO_MY_COMPANIONS_ENABLED) return <MyCompanionsPage /> // MY-COMPANIONS\n",
      ""
    ]
  ],
  "components/builder/voice-call/voice-call-stage.tsx": [
    [
      "import { myCompanionName, packRootUrl } from '@/lib/studio-my-companions' // MY-COMPANIONS\nconst castCompanionName = companionName // MY-COMPANIONS: the cast's own words for a character (the stage's companionName below adds the display names of the owner's own companions)\n",
      ""
    ],
    [
      "  /** MY-COMPANIONS: what the owner's own companions (user packs, u-...) go by, by pack id; absent (the flag off), every character goes by its pack's name, as before. */\n  names?: Readonly<Record<string, string>> // MY-COMPANIONS\n",
      ""
    ],
    [
      "        const response = await fetch(`${packRootUrl(pack)}/motion/manifest.json`, { credentials: 'same-origin' }) // MY-COMPANIONS: a user pack's through the pack route; the cast's at /companions/<name>, as before\n",
      "        const response = await fetch(`/companions/${pack}/motion/manifest.json`, { credentials: 'same-origin' })\n"
    ],
    [
      "export function VoiceCallStage({ snapshot, pack, choices, names, onChooseCompanion, getLevel, onTalkPress, onTalkRelease, onStop, onMute, onEnd, onRetry, onDismissNotice }: VoiceCallStageProps) { // MY-COMPANIONS: names\n",
      "export function VoiceCallStage({ snapshot, pack, choices, onChooseCompanion, getLevel, onTalkPress, onTalkRelease, onStop, onMute, onEnd, onRetry, onDismissNotice }: VoiceCallStageProps) {\n"
    ],
    [
      "  const companionName = (choice: string): string => myCompanionName(names, choice) ?? castCompanionName(choice) // MY-COMPANIONS: one of the owner's own goes by its display name (here and in the switch below); every other character by the cast's words, as before\n",
      ""
    ]
  ],
  "hooks/use-studio-voice-call.ts": [
    [
      "import { COMPANION_STORAGE_KEY, companionChoicesWithMine } from '@/lib/studio-voice-call-ui' // MY-COMPANIONS\nimport { STUDIO_MY_COMPANIONS_ENABLED, myCompanionNames, reachableCompanions, rememberMyCompanion, type MyCompanion } from '@/lib/studio-my-companions' // MY-COMPANIONS\n",
      ""
    ],
    [
      "const NO_COMPANIONS: readonly MyCompanion[] = [] // MY-COMPANIONS: none of the owner's own (the flag off, none listed, or none whose pack answers): the call offers CHOICES, as before\n",
      ""
    ],
    [
      "  const [mine, setMine] = useState<readonly MyCompanion[]>(NO_COMPANIONS) // MY-COMPANIONS: the owner's own companions whose pack answers (NEXT_PUBLIC_STUDIO_MY_COMPANIONS)\n  const choices = mine.length ? companionChoicesWithMine(STUDIO_VOICE_COMPANION, mine.map(entry => entry.id)) : CHOICES // MY-COMPANIONS: the cast, then the owner's own; none: CHOICES itself\n  const names = mine.length ? myCompanionNames(mine) : undefined // MY-COMPANIONS: what the owner's own go by (none: the stage's own words)\n",
      ""
    ],
    [
      "  // MY-COMPANIONS (NEXT_PUBLIC_STUDIO_MY_COMPANIONS, default off: none of this runs): once, after mount, the owner's own companions are asked for and only those whose pack answers are kept (one that does not never reaches\n  // MY-COMPANIONS the switch: the call stays on the cast, and the player still falls back to the pack's portrait, then Felix); the device's remembered character is read again with them on offer (one that is gone: the default).\n  useEffect(() => { // MY-COMPANIONS\n    if (!enabled || !STUDIO_MY_COMPANIONS_ENABLED) return // MY-COMPANIONS\n    let cancelled = false // MY-COMPANIONS\n    const get = typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : null // MY-COMPANIONS: the page's own fetch, handed to the lib (the requests are the lib's)\n    void reachableCompanions(get).then(found => { // MY-COMPANIONS\n      if (cancelled) return // MY-COMPANIONS\n      setMine(found.length ? found : NO_COMPANIONS) // MY-COMPANIONS\n      setCompanion(readCompanionChoice(deviceStorage(), STUDIO_VOICE_COMPANION, found.map(entry => entry.id))) // MY-COMPANIONS\n    }) // MY-COMPANIONS\n    return () => { cancelled = true } // MY-COMPANIONS\n  }, [enabled]) // MY-COMPANIONS\n",
      ""
    ],
    [
      "        snapshot, pack: companion, choices, names, getLevel: controller.getLevel, // MY-COMPANIONS: the cast and the owner's own (the flag off: CHOICES and no names, as before)\n        onChooseCompanion: () => { const next = nextCompanion(companion, choices); writeCompanionChoice(deviceStorage(), next, STUDIO_VOICE_COMPANION); rememberMyCompanion(deviceStorage(), COMPANION_STORAGE_KEY, next, mine); setCompanion(next) }, // MY-COMPANIONS: round the cast and the owner's own; the cast's write refuses a user pack, which is remembered by its own\n",
      "        snapshot, pack: companion, choices: CHOICES, getLevel: controller.getLevel,\n        onChooseCompanion: () => { const next = nextCompanion(companion, CHOICES); writeCompanionChoice(deviceStorage(), next, STUDIO_VOICE_COMPANION); setCompanion(next) },\n"
    ]
  ],
  "lib/studio-voice-call-ui.ts": [
    [
      "/** MY-COMPANIONS (NEXT_PUBLIC_STUDIO_MY_COMPANIONS): a user pack id, u- and 26 characters from [a-z0-9] (lib/studio-my-companions.ts USER_PACK_ID_PATTERN, written out here because this file stays import-free). */\nconst USER_PACK_ID = /^u-[a-z0-9]{26}$/ // MY-COMPANIONS\n/** MY-COMPANIONS: where a pack's files are: a user pack's through the same-origin pack route (the signed-in owner only), every other pack at /companions/<name>, exactly as before. */\nconst packRoot = (pack: string): string => (USER_PACK_ID.test(pack) ? `/api/avatar/pack/${pack}` : `/companions/${pack}`) // MY-COMPANIONS\n/** MY-COMPANIONS: the characters on offer when the owner has companions of their own: the cast (companionChoices), then the owner's user packs (anything that is not a user pack id is left out), none twice. */\nexport function companionChoicesWithMine(fallback: string, mine: readonly string[]): string[] { // MY-COMPANIONS\n  return [...new Set([...companionChoices(fallback), ...mine.filter(id => typeof id === 'string' && USER_PACK_ID.test(id))])] // MY-COMPANIONS\n} // MY-COMPANIONS\n",
      ""
    ],
    [
      "export function readCompanionChoice(storage: CompanionStorage | null | undefined, fallback: string, mine: readonly string[] = []): string { // MY-COMPANIONS: mine, the owner's own user packs on offer besides the cast (default none: as before)\n",
      "export function readCompanionChoice(storage: CompanionStorage | null | undefined, fallback: string): string {\n"
    ],
    [
      "    if (typeof stored === 'string' && mine.length > 0 && companionChoicesWithMine(fallback, mine).includes(stored)) return stored // MY-COMPANIONS\n",
      ""
    ],
    [
      "  const root = `${packRoot(pack)}/motion/` // MY-COMPANIONS: a user pack's through the pack route\n",
      "  const root = `/companions/${pack}/motion/`\n"
    ],
    [
      "      const url = main.layered && USER_PACK_ID.test(pack) ? `${packRoot(pack)}/face/manifest.json` : main.layered ? `/companions/${pack}/face/manifest.json` : main.pointer ? `${root}${main.pointer}` : null // MY-COMPANIONS: a user pack's native Face catalog through the pack route; the cast's text is kept as it was (the voice call proof pins it)\n",
      "      const url = main.layered ? `/companions/${pack}/face/manifest.json` : main.pointer ? `${root}${main.pointer}` : null\n"
    ],
    [
      "export const portraitUrl = (pack: string): string => (USER_PACK_ID.test(pack) ? `${packRoot(pack)}/portrait-512.webp` : `/companions/${pack}/portrait-512.webp`) // MY-COMPANIONS: a user pack's through the pack route; the cast's text is kept as it was (the voice call proof pins it)\n",
      "export const portraitUrl = (pack: string): string => `/companions/${pack}/portrait-512.webp`\n"
    ],
    [
      "export const sceneUrl = (pack: string, file: string): string => `${packRoot(pack)}/${file}` // MY-COMPANIONS: a user pack's through the pack route\n",
      "export const sceneUrl = (pack: string, file: string): string => `/companions/${pack}/${file}`\n"
    ]
  ]
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const MY_COMPANIONS_PIN_MARK = 'LATER-CHANGES: registry read (MY-COMPANIONS)'
export const MY_COMPANIONS_PIN_EDITS = {
  "scripts/test-studio-chat-element-edit.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^My companions:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (MY-COMPANIONS): on a branch stacked after this change (My companions, the owner's companion in the call and on its page), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^My companions:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (MY-COMPANIONS): on a branch stacked after this change (My companions, the owner's companion in the call and on its page), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ],
  "scripts/test-studio-avatar-spawn.mjs": [
    [
      "import { stripMyCompanions, MY_COMPANIONS_FILES } from './studio-my-companions-strip.mjs' // LATER-CHANGES: registry read (MY-COMPANIONS): the My companions change (stacked after this change) marks lines in the companions page; this proof reads that page as this change left it\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && MY_COMPANIONS_FILES.includes(rel) ? stripMyCompanions(rel, out) : out } } // LATER-CHANGES: registry read (MY-COMPANIONS): every read of a file the My companions change marks (the companions page) is dev's text for this proof\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches. */
export const MY_COMPANIONS_PIN_FILES = Object.keys(MY_COMPANIONS_PIN_EDITS)

export const MY_COMPANIONS_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...MY_COMPANIONS_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const MY_COMPANIONS_SCOPE_FILES = new Set([...MY_COMPANIONS_FILES, ...MY_COMPANIONS_NEW_FILES, ...MY_COMPANIONS_OWN_EDITS])

/** The whole .env.example block: its comments and its line. */
export const MY_COMPANIONS_ENV_BLOCK = "# STUDIO MY COMPANIONS (AVATAR-W5 for FRONTEND-1; M11 Step A). On for the exact value \"true\" and only with the Studio shell also on; default off, and then nothing changes: the two /api/avatar routes answer one 404, and the call, its character switch and the companions page are as they were. Build-time value: change it on Vercel and redeploy.\n# On: the signed-in owner's own companion (a private pack in a private storage bucket) joins the voice call's character switch and is listed on /studio/companions, which then offers no upload and no delete. The server needs AVATAR_COMPANIONS_REGISTRY (a JSON list of one: pack id, display name, owner's user id) and AVATAR_PACK_BUCKET (the private bucket's name); AVATAR_PACK_LINK_TTL_SECONDS is optional (default 300). None of them is ever sent to the browser, and the pack's files are reached only through the signed-in owner's own request.\nNEXT_PUBLIC_STUDIO_MY_COMPANIONS=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackMyCompanions(rel, text) {
  return (MY_COMPANIONS_EDITS[rel] || MY_COMPANIONS_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripMyCompanions(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in MY_COMPANIONS_EDITS) && !(rel in MY_COMPANIONS_PIN_EDITS)) return text
  return putBackMyCompanions(rel, text)
}
