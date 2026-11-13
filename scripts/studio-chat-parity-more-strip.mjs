// FRONTEND-1 (overnight chat parity, 11 Nov 2026), the REMAINING commands, stacked on the workspace half (PR #614, head bc84a6fe), which sits on the viewer half (PR #611, head ca41ae33); all on dev 2f06e51e. The flag is the chain's one flag, NEXT_PUBLIC_STUDIO_CHAT_PARITY_COMMANDS (the string "true", default off, build-time; the viewer half adds it and its .env.example block), on top of NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (which already needs
// NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell): the composer's "/" menu gains /delete-theme <name> and /delete-template <name> (the Themes and Templates pages' own delete confirmation, opened; the click there deletes), /model auto|fast|balanced|best, /model reset
// and /model <work> <model> (the gauge's own save, and the Intelligence page's per-task save), /kg-search <words> (the Knowledge page's own search), /ask <question> (the Ask box FILLED, never sent) and /switch-template <name> (the Template picker's switch); the existing /publish row
// now presses the Publish button (the wizard opens), and a picked @template is chosen the way the toolbar chooses it. No flag of its own beyond the chain's, no .env.example block of its own, no backend, no Director change. Flag off, the composer's hook is inert (no row, no pick, no hand-off written), the pages take no hand-off and the gauge's hook registers nothing; /publish and an @template pick are what the commands flag alone gave. The hand-off carries the signed-in account's id and a page takes only its own account's entry (the Ask box is handed it by the Knowledge page).
// lib/studio-chat-parity-more.ts decides (the rows, what cannot run and why, the words, the bus for the gauge, the runs), lib/studio-chat-parity-more-model.ts turns the gauge's hook into the rows' state and the saves, lib/studio-chat-parity-more-handoff.ts is the one-time hand-off to
// the page a command opens, components/builder/chat/studio-chat-parity-more.tsx is the composer's glue, and the pages that receive a hand-off (Knowledge, the Ask box, Themes, Templates, the library row) carry marked lines.
// Every line this change adds to an EXISTING file carries the marker CHAT-PARITY-MORE (matched as a whole token; CHAT-PARITY-WORKSPACE is the workspace half's, CHAT-PARITY-VIEWER the viewer half's, CHAT-PARITY is another change's). Almost all are pure insertions; the five that
// change a line (the library row's props, the two workspaces' row, the Ask box's signature and the Knowledge page's line that draws it) are listed in CHAT_PARITY_MORE_EDITS as [line now, line before]. Take the marked lines out (and put those five back) and each file is the workspace half's head, byte for byte.
// The base is the workspace half's head, not the commit under it: for a file that half touched that is its text; for a file it left alone the two commits agree (BASE_TOUCHED says which is which: the proof reads each from its own commit and checks the list against git).
// How the older pins reach it: this change REGISTERS its files and this strip (scripts/studio-later-changes.mjs, two lines; no .env.example block), and teaches the older proofs that read files this change touched without going through the registry.
// Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'bc84a6fe6c72d518d8be362aea37f939d8a95e6e' // origin/frontend1/chat-parity-workspace (#614's head, on dev 2f06e51e); the tree diff from it to this change's newest commit is this change
export const BASE_UNDER_COMMIT = 'ca41ae3322386bdea92a4c05a3606527d23f527c' // origin/frontend1/chat-parity-viewer (#611's head, on dev 2f06e51e): what a file the workspace half left alone is, in either commit
export const CHAT_PARITY_MORE_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_COMMANDS'
export const CHAT_PARITY_MORE_MARKER = 'CHAT-PARITY-MORE'
/** The marker as a WHOLE token: CHAT-PARITY-MORE-X and X-CHAT-PARITY-MORE are not this change's (CHAT-PARITY-WORKSPACE is the workspace half's, CHAT-PARITY-VIEWER the viewer half's, CHAT-PARITY is chat parity's). */
export const CHAT_PARITY_MORE_MARKER_RE = /(?<![\w-])CHAT-PARITY-MORE(?![\w-])/
/** The subject prefix of this change's own commits (the proof reads these, not a merge of dev that this branch may need). */
export const CHAT_PARITY_MORE_SUBJECT = 'Chat parity more:'

/** Existing files that get marked lines. */
export const CHAT_PARITY_MORE_FILES = [
  "components/builder/chat/studio-chat-commands.tsx",
  "components/builder/chat/studio-chat-parity-viewer-menu.tsx",
  "lib/studio-chat-commands.ts",
  "components/builder/chat-input.tsx",
  "components/model-choice/use-model-choice.ts",
  "components/knowledge/studio-kg-ask.tsx",
  "app/(app)/knowledge/page.tsx",
  "components/studio-libraries/library-manage.tsx",
  "components/studio-libraries/themes-workspace.tsx",
  "components/studio-libraries/templates-workspace.tsx",
]

/** The changed lines: [line now, line before] per edit, whole lines; every line now carries the marker and occurs once in its file. */
export const CHAT_PARITY_MORE_EDITS = {
  "components/knowledge/studio-kg-ask.tsx": [
    [
      "export function StudioKgAsk({ handoffAccount = null }: { handoffAccount?: string | null } = {}) { // CHAT-PARITY-MORE\n",
      "export function StudioKgAsk() {\n"
    ]
  ],
  "app/(app)/knowledge/page.tsx": [
    [
      "      {KG_ASK && <StudioKgAsk handoffAccount={kg.userId ?? null} /> /* CHAT-PARITY-MORE */}\n",
      "      {KG_ASK && <StudioKgAsk />}\n"
    ]
  ],
  "components/studio-libraries/library-manage.tsx": [
    [
      "export function ManagedLibraryRow({ kind, name, isStandard = false, disabled = false, deleteBlockedReason, renameBlockedReason, otherNames = [], onRename, onDelete, children, confirmRequest = false, onConfirmRequest }: { // CHAT-PARITY-MORE\n",
      "export function ManagedLibraryRow({ kind, name, isStandard = false, disabled = false, deleteBlockedReason, renameBlockedReason, otherNames = [], onRename, onDelete, children }: {\n"
    ]
  ],
  "components/studio-libraries/themes-workspace.tsx": [
    [
      "    ? <ManagedLibraryRow key={theme.id} kind=\"theme\" name={theme.name} isStandard={Boolean(theme.is_standard)} disabled={!accountReady || loading || Boolean(operation)} otherNames={(themes ?? []).filter(item => item.id !== theme.id).map(item => item.name)} onRename={nextName => manageRename(theme, nextName)} onDelete={() => manageDelete(theme)} confirmRequest={chatMoreDelete === theme.id} onConfirmRequest={() => setChatMoreDelete(null)}>{row}</ManagedLibraryRow> // CHAT-PARITY-MORE\n",
      "    ? <ManagedLibraryRow key={theme.id} kind=\"theme\" name={theme.name} isStandard={Boolean(theme.is_standard)} disabled={!accountReady || loading || Boolean(operation)} otherNames={(themes ?? []).filter(item => item.id !== theme.id).map(item => item.name)} onRename={nextName => manageRename(theme, nextName)} onDelete={() => manageDelete(theme)}>{row}</ManagedLibraryRow>\n"
    ]
  ],
  "components/studio-libraries/templates-workspace.tsx": [
    [
      "    ? <ManagedLibraryRow key={template.id} kind=\"template\" name={template.name} disabled={!accountReady || loading || Boolean(optimizingId)} deleteBlockedReason={'stage_template_summary' in template ? (LAUNCH_WORDING ? \"Composer templates can't be deleted here.\" : COMPOSER_TEMPLATE_DELETE_REASON) : undefined} renameBlockedReason={renameUnavailable ? (LAUNCH_WORDING ? \"Renaming templates isn't available.\" : TEMPLATE_RENAME_UNAVAILABLE_REASON) : undefined} otherNames={(templates ?? []).filter(item => item.id !== template.id).map(item => item.name)} onRename={nextName => manageRename(template, nextName)} onDelete={() => manageDelete(template)} confirmRequest={chatMoreDelete === template.id} onConfirmRequest={() => setChatMoreDelete(null)}>{row}</ManagedLibraryRow> // CHAT-PARITY-MORE\n",
      "    ? <ManagedLibraryRow key={template.id} kind=\"template\" name={template.name} disabled={!accountReady || loading || Boolean(optimizingId)} deleteBlockedReason={'stage_template_summary' in template ? (LAUNCH_WORDING ? \"Composer templates can't be deleted here.\" : COMPOSER_TEMPLATE_DELETE_REASON) : undefined} renameBlockedReason={renameUnavailable ? (LAUNCH_WORDING ? \"Renaming templates isn't available.\" : TEMPLATE_RENAME_UNAVAILABLE_REASON) : undefined} otherNames={(templates ?? []).filter(item => item.id !== template.id).map(item => item.name)} onRename={nextName => manageRename(template, nextName)} onDelete={() => manageDelete(template)}>{row}</ManagedLibraryRow>\n"
    ]
  ]
}

/** The files of this change that the workspace half touched too (the proof reads the base of each of these from the workspace half's head, every other file of this change from the commit under it: the two agree for those). */
export const BASE_TOUCHED = [
  "components/builder/chat/studio-chat-commands.tsx",
  "components/builder/chat/studio-chat-parity-viewer-menu.tsx",
  "lib/studio-chat-commands.ts",
]

/** New files (no base text to put back). */
export const CHAT_PARITY_MORE_NEW_FILES = [
  "lib/studio-chat-parity-more.ts",
  "lib/studio-chat-parity-more-model.ts",
  "lib/studio-chat-parity-more-handoff.ts",
  "components/builder/chat/studio-chat-parity-more.tsx",
  "components/builder/chat/studio-chat-parity-more-icons.ts",
  "scripts/studio-chat-parity-more-strip.mjs",
  "scripts/test-studio-chat-parity-more.mjs",
]

/**
 * The older proofs this change teaches: [line now, line before] per edit, whole lines (a line now carries "registry read (CHAT-PARITY-MORE)" and occurs once in its file). Each goes back to the workspace half's line (its strip never reads these).
 * The three atlas Templates proofs, the Templates notice proof, the Knowledge Ask proof and the two library manage proofs read the Knowledge page and UI and the two workspaces with an older strip innermost or none: one import and one read hook each (this strip only, never the registry), pure insertions;
 * the two library manage proofs' flag walks also drop a file a later change registers (the remaining commands' own glue names the manage flags) from the files that read them, one inserted line each.
 */
export const CHAT_PARITY_MORE_PIN_EDITS = {
  "scripts/test-studio-chat-commands.mjs": [
    [
      "import { stripChatParityMore, CHAT_PARITY_MORE_FILES } from './studio-chat-parity-more-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-MORE): the remaining slash commands (stacked after the workspace's) add rows and lines to files this proof reads; it reads them as the workspace commands left them, then as the viewer's and chat commands had them\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && CHAT_PARITY_MORE_FILES.includes(rel) ? stripChatParityMore(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-MORE): every read of a file that change touched (the module loader's too) is the file as the workspace commands left it (each hook only drops its own marked lines, so the order they are installed in does not matter)\n",
      ""
    ]
  ],
  "scripts/test-studio-chat-parity-viewer.mjs": [
    [
      "const stripMore = await import('./studio-chat-parity-more-strip.mjs') // LATER-CHANGES: registry read (CHAT-PARITY-MORE): the remaining slash commands (stacked after the workspace's) add marked lines to files this proof reads and to the viewer half's own menu; it reads them as the workspace commands left them\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' ? stripMore.stripChatParityMore(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-MORE): every read is the file without the remaining commands' lines (the registry and the proofs that change taught included), as the workspace commands left it\n",
      ""
    ],
    [
      "const addedLines = (rel, from = strip.BASE_COMMIT) => git('diff', '--no-color', '-U0', from, '--', rel).split('\\n').filter(line => /^\\+(?!\\+\\+)/.test(line)).map(line => line.slice(1)).filter(line => !stripWorkspace.CHAT_PARITY_WORKSPACE_MARKER_RE.test(line)).filter(line => !stripMore.CHAT_PARITY_MORE_MARKER_RE.test(line)) // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): the workspace commands' marked lines are a later change's // LATER-CHANGES: registry read (CHAT-PARITY-MORE): so are the remaining commands'\n",
      "const addedLines = (rel, from = strip.BASE_COMMIT) => git('diff', '--no-color', '-U0', from, '--', rel).split('\\n').filter(line => /^\\+(?!\\+\\+)/.test(line)).map(line => line.slice(1)).filter(line => !stripWorkspace.CHAT_PARITY_WORKSPACE_MARKER_RE.test(line)) // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): the workspace commands' marked lines are a later change's\n"
    ]
  ],
  "scripts/test-studio-chat-parity-workspace.mjs": [
    [
      "const stripMore = await import('./studio-chat-parity-more-strip.mjs') // LATER-CHANGES: registry read (CHAT-PARITY-MORE): the remaining slash commands (stacked after this change) add marked lines to files this proof reads; it reads them as this change left them\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' ? stripMore.stripChatParityMore(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-MORE): every read is the file without the remaining commands' lines (the registry and the proofs that change taught included), as this change left it\n",
      ""
    ],
    [
      "const diffLines = (rel, sign) => git('diff', '--no-color', '-U0', baseCommitOf(rel), '--', rel).split('\\n').filter(line => (sign === '+' ? /^\\+(?!\\+\\+)/ : /^-(?!--)/).test(line)).map(line => line.slice(1)).filter(line => !stripMore.CHAT_PARITY_MORE_MARKER_RE.test(line)) // LATER-CHANGES: registry read (CHAT-PARITY-MORE): the remaining commands' marked lines are a later change's\n",
      "const diffLines = (rel, sign) => git('diff', '--no-color', '-U0', baseCommitOf(rel), '--', rel).split('\\n').filter(line => (sign === '+' ? /^\\+(?!\\+\\+)/ : /^-(?!--)/).test(line)).map(line => line.slice(1))\n"
    ]
  ],
  "scripts/test-studio-chat-parity.mjs": [
    [
      "const OWN = (() => { try { return git('log', '--format=%H%x09%s', '-E', '--grep=^Chat parity', 'HEAD').split('\\n').filter(Boolean).map(line => line.split('\\t')).find(([, subject]) => !subject.startsWith('Chat parity viewer:') && !subject.startsWith('Chat parity workspace:') && !subject.startsWith('Chat parity more:'))?.[0] || null } catch { return null } })() // a merge of dev into this branch is this change's commit too (its subject starts the same way) // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): the viewer's slash commands (commits \"Chat parity viewer: ...\") are a later change's, not this one's // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): so are the workspace commands (commits \"Chat parity workspace: ...\") // LATER-CHANGES: registry read (CHAT-PARITY-MORE): so are the remaining commands (commits \"Chat parity more: ...\")\n",
      "const OWN = (() => { try { return git('log', '--format=%H%x09%s', '-E', '--grep=^Chat parity', 'HEAD').split('\\n').filter(Boolean).map(line => line.split('\\t')).find(([, subject]) => !subject.startsWith('Chat parity viewer:') && !subject.startsWith('Chat parity workspace:'))?.[0] || null } catch { return null } })() // a merge of dev into this branch is this change's commit too (its subject starts the same way) // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): the viewer's slash commands (commits \"Chat parity viewer: ...\") are a later change's, not this one's // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): so are the workspace commands (commits \"Chat parity workspace: ...\")\n"
    ]
  ],
  "scripts/test-atlas-templates-account-boundary.mjs": [
    [
      "import { stripChatParityMore, CHAT_PARITY_MORE_FILES } from './studio-chat-parity-more-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-MORE): the remaining slash commands (stacked after the workspace's) mark lines in the Knowledge, Themes and Templates files; this proof reads them as the workspace commands left them\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = file instanceof URL && file.pathname.startsWith(root.pathname) ? file.pathname.slice(root.pathname.length) : ''; return typeof out === 'string' && CHAT_PARITY_MORE_FILES.includes(rel) ? stripChatParityMore(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-MORE): every read of a file the remaining commands touched is the file without their marked lines (that change's own strip, never the registry, before this proof's own strips read it)\n",
      ""
    ]
  ],
  "scripts/test-atlas-templates-recovery.mjs": [
    [
      "import { stripChatParityMore, CHAT_PARITY_MORE_FILES } from './studio-chat-parity-more-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-MORE): the remaining slash commands (stacked after the workspace's) mark lines in the Knowledge, Themes and Templates files; this proof reads them as the workspace commands left them\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = file instanceof URL && file.pathname.startsWith(root.pathname) ? file.pathname.slice(root.pathname.length) : ''; return typeof out === 'string' && CHAT_PARITY_MORE_FILES.includes(rel) ? stripChatParityMore(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-MORE): every read of a file the remaining commands touched is the file without their marked lines (that change's own strip, never the registry, before this proof's own strips read it)\n",
      ""
    ]
  ],
  "scripts/test-atlas-templates-render-corrections.mjs": [
    [
      "import { stripChatParityMore, CHAT_PARITY_MORE_FILES } from './studio-chat-parity-more-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-MORE): the remaining slash commands (stacked after the workspace's) mark lines in the Knowledge, Themes and Templates files; this proof reads them as the workspace commands left them\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = file instanceof URL && file.pathname.startsWith(root.pathname) ? file.pathname.slice(root.pathname.length) : ''; return typeof out === 'string' && CHAT_PARITY_MORE_FILES.includes(rel) ? stripChatParityMore(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-MORE): every read of a file the remaining commands touched is the file without their marked lines (that change's own strip, never the registry, before this proof's own strips read it)\n",
      ""
    ]
  ],
  "scripts/test-studio-templates-notice-plain.mjs": [
    [
      "import { stripChatParityMore, CHAT_PARITY_MORE_FILES } from './studio-chat-parity-more-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-MORE): the remaining slash commands (stacked after the workspace's) mark lines in the Knowledge, Themes and Templates files; this proof reads them as the workspace commands left them\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(repoRoot, file) : ''; return typeof out === 'string' && CHAT_PARITY_MORE_FILES.includes(rel) ? stripChatParityMore(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-MORE): every read of a file the remaining commands touched is the file without their marked lines (that change's own strip, never the registry, before this proof's own strips read it)\n",
      ""
    ]
  ],
  "scripts/test-studio-kg-ask.mjs": [
    [
      "import { stripChatParityMore, CHAT_PARITY_MORE_FILES } from './studio-chat-parity-more-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-MORE): the remaining slash commands (stacked after the workspace's) mark lines in the Knowledge, Themes and Templates files; this proof reads them as the workspace commands left them\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(repoRoot, file) : ''; return typeof out === 'string' && CHAT_PARITY_MORE_FILES.includes(rel) ? stripChatParityMore(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-MORE): every read of a file the remaining commands touched is the file without their marked lines (that change's own strip, never the registry, before this proof's own strips read it)\n",
      ""
    ]
  ],
  "scripts/test-studio-template-library-manage.mjs": [
    [
      "import { stripChatParityMore, CHAT_PARITY_MORE_FILES } from './studio-chat-parity-more-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-MORE): the remaining slash commands (stacked after the workspace's) mark lines in the Knowledge, Themes and Templates files; this proof reads them as the workspace commands left them\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && CHAT_PARITY_MORE_FILES.includes(rel) ? stripChatParityMore(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-MORE): every read of a file the remaining commands touched is the file without their marked lines (that change's own strip, never the registry, before launch wording and the registry strip it)\n",
      ""
    ],
    [
      "  { const later = (await import('./studio-later-changes.mjs')).LATER_CHANGE_FILES; reads.splice(0, reads.length, ...reads.filter(rel => !later.has(rel) || rel === PROXY || rel === TEMPLATES_WORKSPACE)) } // LATER-CHANGES: registry read (CHAT-PARITY-MORE): a file a later change registers (the remaining commands' own acting-on-this-flag glue, components/builder/chat/studio-chat-parity-more.tsx) is that change's, not a reader of this change's flag; the files this proof names stay\n",
      ""
    ]
  ],
  "scripts/test-studio-theme-library-manage.mjs": [
    [
      "import { stripChatParityMore, CHAT_PARITY_MORE_FILES } from './studio-chat-parity-more-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-MORE): the remaining slash commands (stacked after the workspace's) mark lines in the Knowledge, Themes and Templates files; this proof reads them as the workspace commands left them\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && CHAT_PARITY_MORE_FILES.includes(rel) ? stripChatParityMore(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-MORE): every read of a file the remaining commands touched is the file without their marked lines (that change's own strip, never the registry, before launch wording and the registry strip it)\n",
      ""
    ],
    [
      "  { const later = (await import('./studio-later-changes.mjs')).LATER_CHANGE_FILES; reads.splice(0, reads.length, ...reads.filter(rel => !later.has(rel) || rel === THEMES_WORKSPACE)) } // LATER-CHANGES: registry read (CHAT-PARITY-MORE): a file a later change registers (the remaining commands' own acting-on-this-flag glue, components/builder/chat/studio-chat-parity-more.tsx) is that change's, not a reader of this change's flag; the files this proof names stay\n",
      ""
    ]
  ]
}
export const CHAT_PARITY_MORE_PIN_FILES = Object.keys(CHAT_PARITY_MORE_PIN_EDITS)
/** Files this change edits that are neither marked app code nor new: the registry (two lines) and the older proofs it teaches. No package.json script: run the proof with `node scripts/test-studio-chat-parity-more.mjs`. */
export const CHAT_PARITY_MORE_OWN_EDITS = ['scripts/studio-later-changes.mjs', ...CHAT_PARITY_MORE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_PARITY_MORE_SCOPE_FILES = new Set([...CHAT_PARITY_MORE_FILES, ...CHAT_PARITY_MORE_NEW_FILES, ...CHAT_PARITY_MORE_OWN_EDITS])

/** The registry text carries this change's two lines; they name this module. */
export const CHAT_PARITY_MORE_REGISTRY_MARK = "./studio-chat-parity-more-strip.mjs')"

/** An older proof without this change's edits (the previous file). */
export function putBackChatParityMoreEdits(rel, text) {
  return (CHAT_PARITY_MORE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/**
 * The file without this change's lines: the changed lines go back to what they were, then every line that carries the marker (as a whole token) is taken out; every other byte stays. The registry loses its two lines;
 * a taught proof gets its previous lines back. Any other file is returned as it is.
 */
export function stripChatParityMore(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === 'scripts/studio-later-changes.mjs') return text.split('\n').filter(line => !line.includes(CHAT_PARITY_MORE_REGISTRY_MARK)).join('\n')
  if (rel in CHAT_PARITY_MORE_PIN_EDITS) return putBackChatParityMoreEdits(rel, text)
  if (!CHAT_PARITY_MORE_FILES.includes(rel)) return text
  const swapped = (CHAT_PARITY_MORE_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
  return swapped.split('\n').filter(line => !CHAT_PARITY_MORE_MARKER_RE.test(line)).join('\n')
}
