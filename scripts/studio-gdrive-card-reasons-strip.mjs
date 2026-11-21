// KNOWLEDGE-3 for FRONTEND-1 (the Google Drive card says why). Flag NEXT_PUBLIC_STUDIO_CONNECTORS_CARD_REASONS (the exact "true", default off, build-time).
// It changes the Google Drive card on Settings > Connectors (app/(app)/settings/connectors/page.tsx) and nothing else: (1) the card shows ONE fixed sentence for how the Google sign-in ended, from the callback's ?gdrive= word (cancelled, invalid, failed, connected; any other value shows nothing), read once on mount, taken off the address bar,
// and gone once the person acts; (2) a failed list call keeps its words and gains small print: "code: <error_code>" (an error_code that starts with CONNECTOR_) or "service error <status>". Never a token, an id or an e-mail.
// How: the lib lib/studio-connectors-card-reasons.ts holds the flag (one literal read), the four sentences, the word reader and the small-print rule; the page gains 15 marked lines (an import, two states, one line in load, three effects, two render lines).
// The composer's own ?gdrive= handling (hooks/use-gdrive-composer.ts) and its one-time marker rule (lib/connectors-gdrive-composer.ts, lib/connectors-gdrive-server.ts) are not touched: the Settings landing carries no marker (the callback's back() adds one only when it returns to a chat).
// Off, the page behaves as it did (every line is behind the flag: the effects return first, the state setter is not called, the render lines are false).
// Every line this change adds to an EXISTING file carries the marker CARD-REASONS (matched as a whole token) and is a PURE INSERTION (no base line is rewritten or touched), so the strip is a list of [has, was] pairs whose `was` is empty: putting each back gives the file at BASE_COMMIT byte for byte. The new files have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.
// Two older proofs are TAUGHT one line each (CARD_REASONS_PIN_EDITS, pure insertions): they read the first-parent line of BASE..HEAD, which carries this change's own commit, so each drops this change's subject from it (as for every later change); putting those lines back gives each proof's previous text byte for byte.

export const BASE_COMMIT = 'cec6081d33b74887d5655b6454d95cee77044f9b' // origin/studio-v4-dev-preparation-code (#639 merged), the trunk this change sits on
export const CARD_REASONS_FLAGS = ["NEXT_PUBLIC_STUDIO_CONNECTORS_CARD_REASONS"]
export const CARD_REASONS_MARKER = 'CARD-REASONS'
/** The marker as a WHOLE token: CARD-REASONS is this change's; CARD-REASONS-X and X-CARD-REASONS are not. */
export const CARD_REASONS_MARKER_RE = /(?<![\w-])CARD-REASONS(?![\w-])/
/** The subject prefix of this change's own commits. */
export const CARD_REASONS_SUBJECT = "Card reasons:"

/** Existing files that get marked lines. */
export const CARD_REASONS_FILES = [
  "app/(app)/settings/connectors/page.tsx"
]

/** New files (no base text to put back). */
export const CARD_REASONS_NEW_FILES = [
  "lib/studio-connectors-card-reasons.ts",
  "scripts/studio-gdrive-card-reasons-strip.mjs",
  "scripts/test-studio-gdrive-card-reasons.mjs"
]

/** The new libs that read a flag: [file, flag], one literal env read each. */
export const CARD_REASONS_LIB_FLAGS = [["lib/studio-connectors-card-reasons.ts", "NEXT_PUBLIC_STUDIO_CONNECTORS_CARD_REASONS"]]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per marked insertion, in the order they sit in the file); putting them back gives the base file byte for byte. */
export const CARD_REASONS_EDITS = {
  "app/(app)/settings/connectors/page.tsx": [
    [
      "import { STUDIO_CONNECTORS_CARD_REASONS, gdriveFailureDetail, gdriveResultLine, takeGdriveResultWord } from \"@/lib/studio-connectors-card-reasons\" // CARD-REASONS\n",
      ""
    ],
    [
      "  const [resultLine, setResultLine] = useState<string | null>(null) // CARD-REASONS (NEXT_PUBLIC_STUDIO_CONNECTORS_CARD_REASONS, default off): the one line for how the Google sign-in ended (from the callback's ?gdrive= word, read once on mount)\n",
      ""
    ],
    [
      "  const [listDetail, setListDetail] = useState<string | null>(null) // CARD-REASONS: the small print of a failed list call (code: <error_code> or service error <status>)\n",
      ""
    ],
    [
      "      if (STUDIO_CONNECTORS_CARD_REASONS && !res.ok) setListDetail(gdriveFailureDetail(res.status, data)) // CARD-REASONS: a failed list call keeps its words (the line below) and gains small print: the relayed CONNECTOR_ code, else the HTTP status (it goes when the message does: the effect below)\n",
      ""
    ],
    [
      "  useEffect(() => { // CARD-REASONS (NEXT_PUBLIC_STUDIO_CONNECTORS_CARD_REASONS, default off): once, on mount, the callback's ?gdrive= word becomes one fixed sentence on the card (any other value: nothing) and is taken off the address bar, so a reload or a shared address does not say it again\n",
      ""
    ],
    [
      "    if (!STUDIO_CONNECTORS_CARD_REASONS) return // CARD-REASONS: flag off, nothing here runs\n",
      ""
    ],
    [
      "    const taken = takeGdriveResultWord(window.location.search) // CARD-REASONS: the Settings landing carries no one-time marker (the callback adds one only when it returns to a chat), so none is asked for here; the composer's marker rule is not touched\n",
      ""
    ],
    [
      "    const line = gdriveResultLine(taken.word) // CARD-REASONS\n",
      ""
    ],
    [
      "    if (line) setResultLine(line) // CARD-REASONS: only a line is ever set here, so a second run of this effect (Strict Mode's re-mount in development), which finds the word already gone, leaves it\n",
      ""
    ],
    [
      "    if (taken.found) { try { window.history.replaceState(null, \"\", `${window.location.pathname}${taken.search}${window.location.hash}`) } catch { /* the word stays in the address bar; this page view still says it once */ } } // CARD-REASONS: the word comes off the address bar (the composer does the same for its own return)\n",
      ""
    ],
    [
      "  }, []) // CARD-REASONS\n",
      ""
    ],
    [
      "  useEffect(() => { if (STUDIO_CONNECTORS_CARD_REASONS && busy) setResultLine(null) }, [busy]) // CARD-REASONS: the person acted (Add files, Disconnect, Remove): the line was read, and it does not come back (it is set on mount only)\n",
      ""
    ],
    [
      "  useEffect(() => { if (STUDIO_CONNECTORS_CARD_REASONS && message === null) setListDetail(null) }, [message]) // CARD-REASONS: the small print belongs to its own message and goes when the message does\n",
      ""
    ],
    [
      "        {STUDIO_CONNECTORS_CARD_REASONS && resultLine && <Alert data-connectors-gdrive-result=\"true\"><AlertDescription>{resultLine}</AlertDescription></Alert>}{/* CARD-REASONS: how the Google sign-in ended, one fixed sentence */}\n",
      ""
    ],
    [
      "        {STUDIO_CONNECTORS_CARD_REASONS && message && listDetail && <p className=\"text-xs text-slate-500 dark:text-slate-400\" style={{ marginTop: \"0.25rem\" }} data-connectors-gdrive-detail=\"true\">{listDetail}</p>}{/* CARD-REASONS: small print for a failed list call, under its message */}\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const CARD_REASONS_PIN_MARK = "LATER-CHANGES: registry read (CARD-REASONS)"
export const CARD_REASONS_PIN_EDITS = {
  "scripts/test-studio-chat-element-edit.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Card reasons:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (CARD-REASONS): on a branch stacked after this change (the Google Drive card's reasons), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Card reasons:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (CARD-REASONS): on a branch stacked after this change (the Google Drive card's reasons), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches. */
export const CARD_REASONS_PIN_FILES = Object.keys(CARD_REASONS_PIN_EDITS)

export const CARD_REASONS_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CARD_REASONS_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CARD_REASONS_SCOPE_FILES = new Set([...CARD_REASONS_FILES, ...CARD_REASONS_NEW_FILES, ...CARD_REASONS_OWN_EDITS])

/** The whole .env.example block: the comments and the line of the flag. */
export const CARD_REASONS_ENV_BLOCK = "# STUDIO CONNECTORS CARD REASONS (KNOWLEDGE-3 for FRONTEND-1). On for the exact value \"true\"; default off, and then the Settings > Connectors Google Drive card is the card it was. Build-time value: change it on Vercel and redeploy. It changes that card only, which exists only with NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED on (above).\n# On: (1) the card says, in one line, how the Google sign-in ended, from the callback's ?gdrive= word (read once, on mount; then taken off the address bar, and gone once the person acts): cancelled \"Google sign-in was cancelled or not approved.\"; invalid \"The Google sign-in took too long or finished in another browser. Please try again here.\"; failed \"Google said yes, but Deckster could not save the connection. This is our fault; please try again later.\"; connected \"Google Drive is connected.\"; any other value shows nothing.\n# (2) A failed list call keeps its words (\"Could not load your Drive files. Please try again.\") and gains small print: \"code: <error_code>\" when the answer carries an error_code that starts with CONNECTOR_, otherwise \"service error <status>\". It never shows a token, an id or an e-mail. The Builder composer's own ?gdrive= handling and its one-time marker are not touched.\nNEXT_PUBLIC_STUDIO_CONNECTORS_CARD_REASONS=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackCardReasons(rel, text) {
  return (Object.hasOwn(CARD_REASONS_EDITS, rel) ? CARD_REASONS_EDITS[rel] : Object.hasOwn(CARD_REASONS_PIN_EDITS, rel) ? CARD_REASONS_PIN_EDITS[rel] : []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripCardReasons(rel, text) {
  if (typeof text !== 'string') return text
  if (!Object.hasOwn(CARD_REASONS_EDITS, rel) && !Object.hasOwn(CARD_REASONS_PIN_EDITS, rel)) return text
  return putBackCardReasons(rel, text)
}
