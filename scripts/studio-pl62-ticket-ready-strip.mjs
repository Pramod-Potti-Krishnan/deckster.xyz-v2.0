// PL-62 STUDIO-TICKET-READY (Platform card, 26 Nov 2026): with the Layout viewer ticket on, the editing frame's `src` carries ?t=<ticket>, and its load handler compared that src to the approved URL with `===`.
// This change makes the compare ignore ONLY the t parameter (lib/studio-layout-viewer-ticket.ts viewerSrcMatchesApproved), behind NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED. Stacked on PL-60 (claude/pl60-view-tickets).
// The only existing file whose older lines it touches is components/presentation-viewer.tsx: two pure insertions and four whole-line replacements, every one carrying the marker LAYOUT-TICKET-READY.
// Strip them (the inserted lines out, the replaced lines back) and the file is its base, byte for byte. Plain node, nothing is read from disk or git here.

export const PL62_BASE_COMMIT = 'a6fd96cc63' // origin/claude/pl60-view-tickets, the commit this change is cut from
export const PL62_COMMIT_SUBJECT = /^PL-62:/
export const PL62_MARKER_RE = /(?<![\w-])LAYOUT-TICKET-READY(?![\w-])/
export const PL62_VIEWER = 'components/presentation-viewer.tsx'

/** Whole lines this change inserts into the viewer (they come out). */
export const PL62_INSERTED_LINES = [
  "import { viewerSrcMatchesApproved } from '@/lib/studio-layout-viewer-ticket' // LAYOUT-TICKET-READY (PL-62): with ticketing on, the frame's src carries ?t=<ticket>; the load check ignores only that parameter",
  "    loadedUrl = approvedIframeNavigationUrl // LAYOUT-TICKET-READY (PL-62): what readiness and the native frame's source compare is the approved URL, not the ticketed src",
]
/** Whole lines this change rewrites: [line now, line before]. */
export const PL62_REPLACED_LINES = [
  ["    let loadedUrl = event.currentTarget.src // LAYOUT-TICKET-READY (PL-62)", "    const loadedUrl = event.currentTarget.src"],
  ["        || !viewerSrcMatchesApproved(iframeRef.current?.src, owner.source)) return // LAYOUT-TICKET-READY (PL-62): the frame's src carries ?t=<ticket> when ticketing is on", "        || iframeRef.current?.src !== owner.source) return"],
  ["        || !viewerSrcMatchesApproved(iframeRef.current?.src, expectedOwner.source)) return // LAYOUT-TICKET-READY (PL-62): the frame's src carries ?t=<ticket> when ticketing is on", "        || iframeRef.current?.src !== expectedOwner.source) return"],
  ["    if (!approvedIframeNavigationUrl || !viewerSrcMatchesApproved(loadedUrl, approvedIframeNavigationUrl)) { // LAYOUT-TICKET-READY (PL-62)", "    if (!approvedIframeNavigationUrl || loadedUrl !== approvedIframeNavigationUrl) {"],
]

/** The reverse hunks of the eight older proofs this change teaches: [text as it stands now, text as it was before], generated from the diff against the base (not retyped). Older pins that hold a proof to ITS base (test-studio-arrange's
 *  "the taught line of test-studio-rail-add-slide.mjs puts back to the base's") run this strip over it, so a line taught here comes back out. */
export const PL62_REVERSE_HUNKS = {
  "scripts/studio-chat-stale-viewer-guard-world.mjs": [
    [
      "    studioShell: true, iframeRef, approvedIframeNavigationUrl: iframe.src, debugLog() {}, viewerSrcMatchesApproved: (loaded, approved) => loaded === approved /* LATER-CHANGES: registry read (PL-62): flag off the library's compare is === */, STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED: false, studioSlideDeleteRefresh: { frameLoaded() {} },\n",
      "    studioShell: true, iframeRef, approvedIframeNavigationUrl: iframe.src, debugLog() {}, STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED: false, studioSlideDeleteRefresh: { frameLoaded() {} },\n"
    ]
  ],
  "scripts/test-studio-arrange.mjs": [
    [
      "import { stripPl62TicketReady } from './studio-pl62-ticket-ready-strip.mjs' // LATER-CHANGES: registry read (PL-62): the viewer's four ticket-ready lines come out in read(), before every older strip below\n",
      ""
    ],
    [
      "const read = rel => chatParityStrip.stripChatParity(rel, stripChatElementEdit(rel, stripPl62TicketReady(rel, fs.readFileSync(path.join(root, rel), 'utf8')))) // stacked after #475: LATER-CHANGES: registry read (CHAT-PARITY): chat parity's marked line in the viewer (the Master opener) comes out too, outside #522's strip\n",
      "const read = rel => chatParityStrip.stripChatParity(rel, stripChatElementEdit(rel, fs.readFileSync(path.join(root, rel), 'utf8'))) // stacked after #475: LATER-CHANGES: registry read (CHAT-PARITY): chat parity's marked line in the viewer (the Master opener) comes out too, outside #522's strip\n"
    ]
  ],
  "scripts/test-studio-dual-lookup.mjs": [
    [
      "const strips = registry.LATER_STRIPS; eq(strips.slice(strips.indexOf(strip.stripDualLookup) - 1, strips.indexOf(strip.stripDualLookup) + 1), [(await import('./studio-flip-enablers-strip.mjs')).stripFlipEnablers, strip.stripDualLookup], 'registry: the flip-enablers strip, then this one, then only the strips of later changes (stacking order)') // LATER-CHANGES: registry read (PL-62): the strips of later changes follow this one\n",
      "const strips = registry.LATER_STRIPS; eq(strips.slice(-2), [(await import('./studio-flip-enablers-strip.mjs')).stripFlipEnablers, strip.stripDualLookup], 'registry: the flip-enablers strip, then this one, at the list end (stacking order)')\n"
    ]
  ],
  "scripts/test-studio-first-paint-viewer.mjs": [
    [
      "import { stripPl62TicketReady, PL62_REPLACED_LINES } from './studio-pl62-ticket-ready-strip.mjs' // LATER-CHANGES: registry read (PL-62): the viewer's four ticket-ready lines come out before the byte pin below\n",
      ""
    ],
    [
      "const viewerText = chatParityStrip.stripChatParity(VIEWER, stripFlipEnablers(VIEWER, stripPl62TicketReady(VIEWER, read(VIEWER)))) // stacked after #475: LATER-CHANGES: registry read (CHAT-PARITY): chat parity's marked line in the viewer (the Master opener) comes out before the byte pin below\n",
      "const viewerText = chatParityStrip.stripChatParity(VIEWER, stripFlipEnablers(VIEWER, read(VIEWER))) // stacked after #475: LATER-CHANGES: registry read (CHAT-PARITY): chat parity's marked line in the viewer (the Master opener) comes out before the byte pin below\n"
    ],
    [
      "  const added = diff.filter(line => line.startsWith('+')), removed = diff.filter(line => line.startsWith('-') && !PL62_REPLACED_LINES.some(([, before]) => line === `-${before}`)) // LATER-CHANGES: registry read (PL-62): its two rewritten viewer lines (a later change's, not this one's) are not this change's removals\n",
      "  const added = diff.filter(line => line.startsWith('+')), removed = diff.filter(line => line.startsWith('-'))\n"
    ]
  ],
  "scripts/test-studio-launch-wording.mjs": [
    [
      "import { stripPl62TicketReady } from './studio-pl62-ticket-ready-strip.mjs' // LATER-CHANGES: registry read (PL-62)\n",
      ""
    ],
    [
      "    const head = stripJobDeadlines(rel, stripPl62TicketReady(rel, heads[rel])) // LATER-CHANGES: registry read (PL-62): the viewer's four ticket-ready lines come out too;  the base's P3-4b lines out first (they change a base line in narration-voice-picker.tsx); a text without them is returned as it is\n",
      "    const head = stripJobDeadlines(rel, heads[rel]) // the base's P3-4b lines out first (they change a base line in narration-voice-picker.tsx); a text without them is returned as it is\n"
    ]
  ],
  "scripts/test-studio-phone-hints.mjs": [
    [
      "const { stripPl62TicketReady } = await import('./studio-pl62-ticket-ready-strip.mjs') // LATER-CHANGES: registry read (PL-62): the viewer's four ticket-ready lines come out before the flip enablers' lines\n",
      ""
    ],
    [
      "  const page = read(PAGE), viewer = stripFlipEnablers(VIEWER, stripPl62TicketReady(VIEWER, read(VIEWER)))\n",
      "  const page = read(PAGE), viewer = stripFlipEnablers(VIEWER, read(VIEWER))\n"
    ]
  ],
  "scripts/test-studio-phone-landscape.mjs": [
    [
      "const { stripPl62TicketReady } = await import('./studio-pl62-ticket-ready-strip.mjs') // LATER-CHANGES: registry read (PL-62): the viewer's four ticket-ready lines come out before the flip enablers' lines\n",
      ""
    ],
    [
      "  const page = read(PAGE), viewer = stripFlipEnablers(VIEWER, stripPl62TicketReady(VIEWER, read(VIEWER))) // LATER-CHANGES: registry read (FLIP-ENABLERS): program1/studio-flip-enablers' viewer lines come out first\n",
      "  const page = read(PAGE), viewer = stripFlipEnablers(VIEWER, read(VIEWER)) // LATER-CHANGES: registry read (FLIP-ENABLERS): program1/studio-flip-enablers' viewer lines come out first\n"
    ]
  ],
  "scripts/test-studio-rail-add-slide.mjs": [
    [
      "import { PL62_REPLACED_LINES } from './studio-pl62-ticket-ready-strip.mjs' // LATER-CHANGES: registry read (PL-62): the viewer's two rewritten lines and four marked lines are that later change's, not counted here\n",
      ""
    ],
    [
      "    const changed = (rel, base) => git(['diff', '--no-color', '-U0', BASE_COMMIT, '--', rel]).split('\\n').filter(line => /^[+-](?![+-])/.test(line) && !line.includes('LAYOUT-TICKET-READY') && !PL62_REPLACED_LINES.some(([, before]) => line === `-${before}`) && !line.includes('CHAT-PARITY') && !line.includes('PASS2D B4') && !line.includes('SLIDE-OPS-VIA-VIEWER') && !line.includes('INSERT-PERSIST') && !line.includes('STUDIO_LAUNCH_WORDING') && !line.includes('VERSION-HISTORY-V2') && !line.includes('NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD') && !belongsToRailBuildCount(line) && !/(?<![\\w-])STUDIO-ARRANGE(?![\\w-])/.test(line) && !/(?<![\\w-])CHAT-ELEMENT-EDIT(?![\\w-])/.test(line)) // LATER-CHANGES: registry read (STUDIO-ARRANGE): its marked viewer lines; scripts/test-studio-arrange.mjs pins them. LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT): and #522's, which scripts/test-studio-chat-element-edit.mjs pins // stacked after #475: LATER-CHANGES: registry read (CHAT-PARITY): chat parity's one marked line in the viewer is its own\n",
      "    const changed = (rel, base) => git(['diff', '--no-color', '-U0', BASE_COMMIT, '--', rel]).split('\\n').filter(line => /^[+-](?![+-])/.test(line) && !line.includes('CHAT-PARITY') && !line.includes('PASS2D B4') && !line.includes('SLIDE-OPS-VIA-VIEWER') && !line.includes('INSERT-PERSIST') && !line.includes('STUDIO_LAUNCH_WORDING') && !line.includes('VERSION-HISTORY-V2') && !line.includes('NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD') && !belongsToRailBuildCount(line) && !/(?<![\\w-])STUDIO-ARRANGE(?![\\w-])/.test(line) && !/(?<![\\w-])CHAT-ELEMENT-EDIT(?![\\w-])/.test(line)) // LATER-CHANGES: registry read (STUDIO-ARRANGE): its marked viewer lines; scripts/test-studio-arrange.mjs pins them. LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT): and #522's, which scripts/test-studio-chat-element-edit.mjs pins // stacked after #475: LATER-CHANGES: registry read (CHAT-PARITY): chat parity's one marked line in the viewer is its own\n"
    ]
  ]
}

/** The viewer without this change's lines, and each taught proof with its taught lines put back; every other file comes back untouched. */
export function stripPl62TicketReady(rel, text) {
  if (rel === PL62_VIEWER) {
    const replaced = new Map(PL62_REPLACED_LINES)
    return text.split('\n').filter(line => !PL62_INSERTED_LINES.includes(line)).map(line => replaced.get(line) ?? line).join('\n')
  }
  const hunks = PL62_REVERSE_HUNKS[rel]
  if (!hunks) return text
  let out = text
  for (const [now, before] of hunks) { const at = out.indexOf(now); if (at >= 0) out = out.slice(0, at) + before + out.slice(at + now.length) }
  return out
}

/** Every file this change's commits touch: what the older scope checks skip once the registry names it. */
export const PL62_SCOPE_FILES = new Set([
  "components/presentation-viewer.tsx",
  "lib/studio-layout-viewer-ticket.ts",
  "scripts/studio-chat-stale-viewer-guard-world.mjs",
  "scripts/test-studio-arrange.mjs",
  "scripts/test-studio-dual-lookup.mjs",
  "scripts/test-studio-first-paint-viewer.mjs",
  "scripts/test-studio-launch-wording.mjs",
  "scripts/test-studio-phone-hints.mjs",
  "scripts/test-studio-phone-landscape.mjs",
  "scripts/test-studio-rail-add-slide.mjs",
  "scripts/test-studio-pl62-ticket-ready.mjs",
  "scripts/studio-pl62-ticket-ready-strip.mjs",
  "scripts/studio-later-changes.mjs"
])

/** The eight older proofs/harnesses this change teaches (registry-order pins and chains that read the viewer): each edit is one line, marked LATER-CHANGES: registry read (PL-62). */
export const PL62_TAUGHT_FILES = new Set([
  "scripts/studio-chat-stale-viewer-guard-world.mjs",
  "scripts/test-studio-arrange.mjs",
  "scripts/test-studio-dual-lookup.mjs",
  "scripts/test-studio-first-paint-viewer.mjs",
  "scripts/test-studio-launch-wording.mjs",
  "scripts/test-studio-phone-hints.mjs",
  "scripts/test-studio-phone-landscape.mjs",
  "scripts/test-studio-rail-add-slide.mjs"
])
