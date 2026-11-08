// FRONTEND-2 (B69, PROGRAM-1 DEEP "the agent-mode UI shell"): P4-16 Track A, MR A-F1, the Studio side of Agent build. NEW files only: lib/studio-agent-mode.ts (flags, typed frames, the run-card reducer, credits words) and eight components under
// components/builder/agent-mode/ (BuildModePicker; the estimate card A1, the run card, the checkpoint card A3, the research offer card A4, the failed card A6; AgentRunCards, the one mount). Flags NEXT_PUBLIC_AGENT_MODE (the shell) and
// NEXT_PUBLIC_AUTHOR_MODE_PICKER (the Author option of the picker): each counts only as the exact string "true", is off by default, and works only with NEXT_PUBLIC_STUDIO_V4_SHELL "true". Off, every component returns null.
// NOTHING IS APPLIED to FRONTEND-1's files: not the hook (hooks/use-deckster-websocket-v2.ts), not the Builder page (app/builder/page.tsx), not the chat cards. The lines they would need are the DRAFTS below (data, with the dev line numbers of their anchors);
// the proof renders the components, and feeds the reducer, without any of them. Every DRAFT line carries the marker AGENT-MODE-SHELL (a WHOLE token) so that, once an owner applies one, a strip can take it out.
// CONTRACT PENDING A-D1: DIRECTOR-2 has published no agent frame shape (nothing under streams/director2 or streams/pass5 names one), so the six inbound frames and the outbound card answer are this shell's own, in the { type, payload } envelope Studio reads.
// The older proofs this change teaches (tests only, every line carries the registry-read mark): the two that read the first-parent commits of BASE..HEAD for their own commits' subjects get one more inserted line each, for "Agent mode shell:", right after
// the last subject filter of the shape !/^...:/ (the usage credits page's), as #567 / #568 / #589 / B61 / B63 did. How the older pins reach this change: it REGISTERS its files, its .env.example block and its strip (scripts/studio-later-changes.mjs, three lines).
// Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'eeb78d4f4b7676d75c244746f1edc7da1d269478' // Studio dev (7 Nov), the merge of #598
export const AGENT_MODE_SHELL_FLAGS = ['NEXT_PUBLIC_AGENT_MODE', 'NEXT_PUBLIC_AUTHOR_MODE_PICKER']
export const AGENT_MODE_SHELL_MARKER = 'AGENT-MODE-SHELL'
/** The marker as a WHOLE token: AGENT-MODE-SHELL is this change's; AGENT-MODE-SHELL-X and X-AGENT-MODE-SHELL are not. */
export const AGENT_MODE_SHELL_MARKER_RE = /(?<![\w-])AGENT-MODE-SHELL(?![\w-])/
/** The subject prefix of this change's own commits. */
export const AGENT_MODE_SHELL_SUBJECT = 'Agent mode shell:'

/** New files (no base text to put back). */
export const AGENT_MODE_SHELL_COMPONENT_FILES = [
  'components/builder/agent-mode/agent-card-parts.tsx',
  'components/builder/agent-mode/agent-checkpoint-card.tsx',
  'components/builder/agent-mode/agent-estimate-card.tsx',
  'components/builder/agent-mode/agent-failed-card.tsx',
  'components/builder/agent-mode/agent-research-offer-card.tsx',
  'components/builder/agent-mode/agent-run-card.tsx',
  'components/builder/agent-mode/agent-run-cards.tsx',
  'components/builder/agent-mode/build-mode-picker.tsx',
]
export const AGENT_MODE_SHELL_NEW_FILES = ['lib/studio-agent-mode.ts', ...AGENT_MODE_SHELL_COMPONENT_FILES, 'scripts/studio-agent-mode-shell-strip.mjs', 'scripts/test-studio-agent-mode-shell.mjs']

/** The older proofs this change teaches: [text the proof has now, text the base commit's proof has] per edit, whole lines, so putting them back gives the base file byte for byte. Every line a taught proof has now carries AGENT_MODE_SHELL_PIN_MARK. */
export const AGENT_MODE_SHELL_PIN_MARK = '// LATER-CHANGES: registry read (AGENT-MODE-SHELL)'
const FIRST_PARENT_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Agent mode shell:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AGENT-MODE-SHELL): on a branch stacked after this change (the Agent build shell), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
export const AGENT_MODE_SHELL_PIN_EDITS = {
  'scripts/test-studio-deck-sync-truth.mjs': [[FIRST_PARENT_LINE, '']],
  'scripts/test-studio-chat-element-edit.mjs': [[FIRST_PARENT_LINE, '']],
}
/** Where each taught line goes: right after the last subject filter of the shape !/^...:/ the base proof has, B63's "Usage credits page:" (the line that starts with this text). */
export const AGENT_MODE_SHELL_PIN_AFTER = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Usage credits page:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (USAGE-CREDITS-PAGE)"
export const AGENT_MODE_SHELL_PIN_FILES = Object.keys(AGENT_MODE_SHELL_PIN_EDITS)
/** Every [has, was] pair this change makes to an existing file, by file: the two taught proofs. (No app file is edited: see the drafts.) */
export const AGENT_MODE_SHELL_EDITS = { ...AGENT_MODE_SHELL_PIN_EDITS }

/** Files this change edits that are not app code: .env.example (its block, appended), the registry (three lines: its files, its block, its strip) and the older proofs it teaches. */
export const AGENT_MODE_SHELL_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...AGENT_MODE_SHELL_PIN_FILES]
/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const AGENT_MODE_SHELL_SCOPE_FILES = new Set([...AGENT_MODE_SHELL_NEW_FILES, ...AGENT_MODE_SHELL_OWN_EDITS])

/** The whole .env.example block: its comments and its two lines (appended at the end of the file, after one blank line). */
export const AGENT_MODE_SHELL_ENV_BLOCK = `# STUDIO AGENT BUILD SHELL (FRONTEND-2; AGENT-MODE-SHELL, P4-16 Track A, MR A-F1). NEXT_PUBLIC_AGENT_MODE: the exact value "true" turns on the Studio shell for Agent build: the Agent option of the build-mode picker, the estimate card
# (A1), the run card (steps in plain words, a credit meter against the cap, Pause and Stop) and the spend, research and failure cards (A3 / A4 / A6). Anything else, including unset, is off, and then nothing changes: every new component draws
# nothing and the socket hook is not asked to read an agent frame. Build-time value: change it on Vercel and redeploy. It needs the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL "true"). The components are built and proved but not mounted: Director's
# agent frames (A-D1) and the owners' wiring lines come first. On screen it is credits only, and Agent is for Pro and Max.
NEXT_PUBLIC_AGENT_MODE="false"
# STUDIO AGENT BUILD SHELL, AUTHOR OPTION: NEXT_PUBLIC_AUTHOR_MODE_PICKER adds the Author option to the same picker (exact "true", default off, Studio shell only). Author mode has no opt-in in Studio today; Director's own switch still decides.
NEXT_PUBLIC_AUTHOR_MODE_PICKER="false"
`

/**
 * The lines the shell needs in FRONTEND-1's files, NOT APPLIED (FRONTEND-2 asks the owner). Each is a pure insertion unless `where` says "replace". `line` is the anchor's line number in dev (BASE_COMMIT), `anchor` the whole line there, `add` the new
 * line(s), byte for byte, in order. The hook's last commits (git log) are FRONTEND-1's (Voice call, Billing); the Builder page is theirs too. build_mode itself is Director's opt-in key (MR-604: an optional "build_mode" on a user message).
 * The page has no plan today (no tier in app/builder/page.tsx): agentPlan is FRONTEND-1's to supply from the verified plan, and null keeps Agent disabled (fail closed). The agent answer frame is CONTRACT PENDING A-D1.
 */
export const AGENT_MODE_SHELL_DRAFTS = [
  { id: 'H1', file: 'hooks/use-deckster-websocket-v2.ts', line: 57, where: 'after', anchor: "import { STUDIO_ONE_LIVE_TAB_ENABLED, isDirectorSupersededClose } from '@/lib/studio-one-live-tab';",
    add: ["import { STUDIO_AGENT_FRAME_TYPES, agentAnswerFrame, isAgentFrameType } from '@/lib/studio-agent-mode'; // AGENT-MODE-SHELL (NEXT_PUBLIC_AGENT_MODE, default off)"] },
  { id: 'H2', file: 'hooks/use-deckster-websocket-v2.ts', line: 117, where: 'after', anchor: "  'template_ingest_failed',",
    add: ["  ...(STUDIO_AGENT_FRAME_TYPES as unknown as BaseMessage['type'][]), // AGENT-MODE-SHELL: the six agent_* frame types, only with the flag (off: none, so they are dropped at ingress exactly as today)"] },
  { id: 'H3', file: 'hooks/use-deckster-websocket-v2.ts', line: 626, where: 'after', anchor: '    handoff_idempotency_key?: string;',
    add: ["    build_mode?: 'standard' | 'author' | 'agent'; // AGENT-MODE-SHELL: Director's opt-in key (MR-604); omitted unless the picker chose"] },
  { id: 'H4', file: 'hooks/use-deckster-websocket-v2.ts', line: 635, where: 'after', anchor: '  extendedGeneration?: boolean;',
    add: ["  buildMode?: 'standard' | 'author' | 'agent'; // AGENT-MODE-SHELL"] },
  { id: 'H5', file: 'hooks/use-deckster-websocket-v2.ts', line: 2161, where: 'after', anchor: "                message.type !== 'template_ingest_failed' &&",
    add: ['                !isAgentFrameType(message.type) && // AGENT-MODE-SHELL: an agent frame drives the run card, never a chat row'] },
  { id: 'H6', file: 'hooks/use-deckster-websocket-v2.ts', line: 3434, where: 'after', anchor: '          ...(options?.actionLabel && { action_label: options.actionLabel }),',
    add: ['          ...(options?.buildMode && { build_mode: options.buildMode }), // AGENT-MODE-SHELL'] },
  { id: 'H7', file: 'hooks/use-deckster-websocket-v2.ts', line: 3616, where: 'after', anchor: "  chatParityBus.send = sendChatParityResult // CHAT-PARITY: the page's runner answers through the bus (lib/studio-chat-parity.ts)",
    add: [
      "  const sendAgentAnswer = useCallback((answer: import('@/lib/studio-agent-mode').AgentAnswer): boolean => { // AGENT-MODE-SHELL (CONTRACT PENDING A-D1: the answer frame)",
      '    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false; try { wsRef.current.send(JSON.stringify(agentAnswerFrame(answer))); return true; } catch { return false; } // AGENT-MODE-SHELL',
      '  }, []); // AGENT-MODE-SHELL',
    ] },
  { id: 'H8', file: 'hooks/use-deckster-websocket-v2.ts', line: 4239, where: 'after', anchor: '    sendControlMessage,', add: ['    sendAgentAnswer, // AGENT-MODE-SHELL'] },
  { id: 'P1', file: 'app/builder/page.tsx', line: 694, where: 'after', anchor: '  const [inputMessage, setInputMessage] = useState("")',
    add: ["  const [buildMode, setBuildMode] = useState<BuildMode>('standard'); const [buildModeFrom, setBuildModeFrom] = useState<BuildMode | undefined>(undefined); const [agentRun, dispatchAgentRun] = React.useReducer(agentRunReducer, undefined, initialAgentRunState); const agentPlan: AgentPlan | null = null // AGENT-MODE-SHELL: agentPlan is FRONTEND-1's to supply from the verified plan (this page has none today); null keeps Agent disabled"] },
  { id: 'P2', file: 'app/builder/page.tsx', line: 845, where: 'after', anchor: '  }, [deckIdentity])',
    add: ["  const buildModeWire = buildModeOnWire(buildMode, { plan: agentPlan, previous: buildModeFrom }) // AGENT-MODE-SHELL: the build_mode a request carries; undefined omits the key, so with the flags off every frame is today's"] },
  { id: 'P3', file: 'app/builder/page.tsx', line: 849, where: 'after', anchor: '      theme: buildThemeSelection,', add: ['      ...(buildModeWire ? { buildMode: buildModeWire } : {}), // AGENT-MODE-SHELL'] },
  { id: 'P4', file: 'app/builder/page.tsx', line: 852, where: 'replace', anchor: '    [templateSendOptions, buildThemeSelection, deckIdentity],', add: ['    [templateSendOptions, buildThemeSelection, deckIdentity, buildModeWire], // AGENT-MODE-SHELL'] },
  { id: 'P5', file: 'app/builder/page.tsx', line: 2431, where: 'after', anchor: '    sendControlMessage,', add: ['    sendAgentAnswer, // AGENT-MODE-SHELL'] },
  { id: 'P6', file: 'app/builder/page.tsx', line: 2541, where: 'after', anchor: '    onMessage: (message) => {',
    add: ['      if (isAgentFrameType(message.type)) { dispatchAgentRun(message); return } // AGENT-MODE-SHELL: agent frames go to the run card\'s reducer'] },
  { id: 'P7', file: 'app/builder/page.tsx', line: 7924, where: 'after', anchor: '                  <BuilderQuotaRefusal />{/* BILLING-F5-USAGE (NEXT_PUBLIC_STUDIO_QUOTA_SCREENS): out of credits / plan refusal screen; off, null */}',
    add: ['                  <AgentRunCards state={agentRun} onAnswer={answer => { if (sendAgentAnswer(answer)) dispatchAgentRun(agentAnswered(answer)) }} onControl={action => { sendBuildControl(action, buildNarration.buildId ?? undefined) }} />{/* AGENT-MODE-SHELL (NEXT_PUBLIC_AGENT_MODE): the estimate, run and A3 / A4 / A6 cards; off, null */}'] },
  { id: 'P8', file: 'app/builder/page.tsx', line: 7933, where: 'before', anchor: '                  <ChatInput',
    add: ["                  <BuildModePicker value={buildMode} plan={agentPlan} onChange={mode => { if (mode !== 'standard') setBuildModeFrom(mode); setBuildMode(mode) }} />{/* AGENT-MODE-SHELL (NEXT_PUBLIC_AGENT_MODE / NEXT_PUBLIC_AUTHOR_MODE_PICKER): Standard / Author / Agent above the composer; off, null */}"] },
  { id: 'P9', file: 'app/builder/page.tsx', line: 8564, where: 'after', anchor: "import { BuilderQuotaRefusal } from '@/components/billing/builder-quota-refusal' // BILLING-F5-USAGE",
    add: [
      "import { AgentRunCards } from '@/components/builder/agent-mode/agent-run-cards' // AGENT-MODE-SHELL",
      "import { BuildModePicker } from '@/components/builder/agent-mode/build-mode-picker' // AGENT-MODE-SHELL",
      "import { agentAnswered, agentRunReducer, buildModeOnWire, initialAgentRunState, isAgentFrameType, type AgentPlan, type BuildMode } from '@/lib/studio-agent-mode' // AGENT-MODE-SHELL",
    ] },
]
/** The existing app files the drafts are for: none of them is edited by this change (the proof reads the committed diff). */
export const AGENT_MODE_SHELL_DRAFT_FILES = [...new Set(AGENT_MODE_SHELL_DRAFTS.map(draft => draft.file))]

/** `text` with one whole line taken out: `has` is the line with its newline, and it counts only at the start of a line (it must be a whole line, never the tail of a longer one). Only the first occurrence goes: a line that is there twice is a merge mistake the older pins must still see. */
function putBackLine(text, has, was) {
  let at = text.indexOf(has)
  while (at !== -1 && !(at === 0 || text[at - 1] === '\n')) at = text.indexOf(has, at + 1)
  return at === -1 ? text : text.slice(0, at) + was + text.slice(at + has.length)
}

/** The file without this change's lines: an older proof this change taught gets its base text back. Any other file is returned as it is (no app file carries a line of this change). Idempotent: a file that has none of the lines comes back as it is. */
export function stripAgentModeShell(rel, text) {
  if (typeof text !== 'string') return text
  if (!Object.prototype.hasOwnProperty.call(AGENT_MODE_SHELL_EDITS, rel)) return text
  return AGENT_MODE_SHELL_EDITS[rel].reduce((out, [has, was]) => putBackLine(out, has, was), text)
}
