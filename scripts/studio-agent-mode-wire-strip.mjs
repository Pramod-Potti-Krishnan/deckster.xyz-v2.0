// FRONTEND-1 (the Agent mode wire, stacked on FRONTEND-2's #607, the Agent build shell, which is new files only and mounts nothing): the Studio mounts Agent build. Flags: NEXT_PUBLIC_AGENT_MODE AND NEXT_PUBLIC_STUDIO_V4_SHELL, each only the exact string "true"
// (#607's own constant STUDIO_AGENT_MODE_ENABLED in lib/studio-agent-mode.ts, reused; no new flag, so NO .env.example block of this change: the flag's block is #607's). Off (either one), the page mounts nothing, the socket hook routes nothing and sends nothing,
// and every frame and every byte of output is what the base produced.
//   - the socket hook (hooks/use-deckster-websocket-v2.ts): the six agent frames go to the page's run card, ahead of the allowlist (onAgentFrame); the person's card answer goes out as the contract's { type: 'agent_answer', data: { run_id, card, choice } }
//     on the live socket only (sendAgentAnswer: never queued, never replayed); the optional build_mode key rides a user message;
//   - the Builder page (app/builder/page.tsx): the picker above the composer, the cards in the chat after the messages, the run card's state (#607's reducer), the build mode on the four build sends (a ref read at send time), the plan the signed-in session carries (null keeps Agent disabled);
//   - the pure half (lib/studio-agent-mode-wire.ts, new): the page's reducer, when the picker is off, the one rule of an answer, the words of a failed send, the key that brings a card into view.
//   - NO AGENT START FROM VOICE (PK ruling, 11 Nov): a send that comes from the voice call (its two handlers on the page: handleSendMessage for words, handleActionClick for a card's button, a spoken yes to the plan) never carries build_mode "agent". The page asks at the top of each
//     handler whether the words are the ones the call armed (voiceOriginatedSend) and reads the voice build mode (voiceBuildMode: "standard" for a plan that can hold Director's sticky Agent opt-in, else no key) instead of the picker's; the hook turns "agent" on a user message
//     marked mode "voice" into "standard" (last line). Same pattern: marked pure insertions, [has, was] pairs; with the flags off none of it acts.
//   - STANDARD IS SAID OUT LOUD (PK ruling, 12 Nov: "both yes"): Director's Agent opt-in is sticky (saved with the session; only an explicit "standard" clears it) and Studio does not read it back, so after a reload a typed send or a click with the picker on Standard (the key was left out)
//     could still run Agent. On a plan that can hold the opt-in (Pro, Max) a build send with the picker on Standard now carries build_mode "standard" (typedBuildMode, one marked line: the ref the four build sends read); the other plans and the flags off: no key, as today.
// Every line this change adds to an EXISTING file carries the marker AGENT-MODE-WIRE (matched as a whole token). All of them are pure insertions: NO base line is rewritten (older proofs hold every base line of the page and the hook, in order), so the strip is a list of
// [has, was] pairs with was = '': putting each pair back gives the file at STACK_BASE (#607's head) byte for byte. The new files (a lib, this strip, a proof) have no base text.
// Older proofs this change teaches (tests only, every line carries the registry-read mark): the two that read the first-parent commits for their own commits' subjects get one more inserted line each, "Agent mode wire:", right after the shell's; and #607's own proof, whose
// scope check held the hook and the Builder page to the base byte for byte ("the drafts are not applied": the one line that applies them now reads them past the later changes' strips, so it is the one line REPLACED). No other older proof needed an edit
// (the registry takes this change's lines out of the files they read). How the older pins reach it: it REGISTERS its files and its strip (scripts/studio-later-changes.mjs, two lines: the env-block list gets none, this change adds no block).
// Plain node, no imports, nothing read from disk or git here.

export const STACK_BASE = "d5978867da78d8d7ed00137eeb9e1c7901ac8567" // #607's head (frontend2/agent-mode-shell, "Agent mode shell: read the agent frames as AGENT-1's contract fixture has them")
export const BASE_COMMIT = 'eeb78d4f4b7676d75c244746f1edc7da1d269478' // origin/studio-v4-dev-preparation-code (#598 merged), the trunk #607 sits on
export const AGENT_MODE_WIRE_FLAGS = ['NEXT_PUBLIC_AGENT_MODE', 'NEXT_PUBLIC_STUDIO_V4_SHELL']
export const AGENT_MODE_WIRE_MARKER = 'AGENT-MODE-WIRE'
/** The marker as a WHOLE token: AGENT-MODE-WIRE is this change's; AGENT-MODE-WIRE-X and X-AGENT-MODE-WIRE are not. */
export const AGENT_MODE_WIRE_MARKER_RE = /(?<![\w-])AGENT-MODE-WIRE(?![\w-])/
/** The subject prefix of this change's own commits. */
export const AGENT_MODE_WIRE_SUBJECT = 'Agent mode wire:'

export const SOCKET_HOOK = 'hooks/use-deckster-websocket-v2.ts'
export const BUILDER_PAGE = 'app/builder/page.tsx'
/** Existing app files that get marked lines. */
export const AGENT_MODE_WIRE_APP_FILES = [SOCKET_HOOK, BUILDER_PAGE]
/** New files (no base text to put back). */
export const AGENT_MODE_WIRE_NEW_FILES = ['lib/studio-agent-mode-wire.ts', 'scripts/studio-agent-mode-wire-strip.mjs', 'scripts/test-studio-agent-mode-wire.mjs']

/** [text the file has now, text the file had at STACK_BASE] per edit, whole lines (with their newline), in the order they sit in the file; was = '' for an inserted line. Putting them back gives the base file byte for byte. */
export const AGENT_MODE_WIRE_EDITS = {
  [SOCKET_HOOK]: [
    ["import { STUDIO_AGENT_MODE_ENABLED, agentAnswerFrame, agentAnswerSendable, isAgentFrameType } from '@/lib/studio-agent-mode'; // AGENT-MODE-WIRE (NEXT_PUBLIC_AGENT_MODE and NEXT_PUBLIC_STUDIO_V4_SHELL, both exact \"true\"; default off)\n", ""],
    ["    build_mode?: 'standard' | 'author' | 'agent'; // AGENT-MODE-WIRE: Director's opt-in key (MR-604); omitted unless the picker chose and the plan allows it\n", ""],
    ["  buildMode?: 'standard' | 'author' | 'agent'; // AGENT-MODE-WIRE\n", ""],
    ["  onAgentFrame?: (frame: unknown, owner: { sessionId: string | null; isCurrent: () => boolean }) => void; // AGENT-MODE-WIRE: Director's six agent_* frames ({ type, payload }, no session envelope) go to the page's run card, only with the flags. Unused with them off.\n", ""],
    ["            // AGENT-MODE-WIRE (NEXT_PUBLIC_AGENT_MODE and NEXT_PUBLIC_STUDIO_V4_SHELL, default off): Director's six agent frames (agent_estimate, agent_step, agent_checkpoint, agent_research_offer, agent_failed, agent_done) go to the page's run card, here, ahead of the allowlist,\n", ""],
    ["            // AGENT-MODE-WIRE: so they never reach the reducer, the transcript or the cache, and they do not unlock the turn. Like the other server frames without the regular envelope, a frame carries no session id: its owner is this exact socket (a session id, if one is\n", ""],
    ["            // AGENT-MODE-WIRE: sent, must be this socket's). Flags off: an agent frame is an unknown type, dropped below as before.\n", ""],
    ["            if (STUDIO_AGENT_MODE_ENABLED && isAgentFrameType(parsedMessage.type)) { if (isCurrentSocket() && (rawMessage.session_id === undefined || rawMessage.session_id === socketSessionId)) transportCallbacksRef.current.onAgentFrame?.(parsedMessage, { sessionId: socketSessionId, isCurrent: isCurrentSocket }); return; } // AGENT-MODE-WIRE\n", ""],
    ["          ...(options?.buildMode && { build_mode: options.buildMode }), // AGENT-MODE-WIRE\n", ""],
    ["      if (STUDIO_AGENT_MODE_ENABLED && (message.data as unknown as Record<string, unknown>).mode === 'voice' && message.data.build_mode === 'agent') message.data.build_mode = 'standard'; // AGENT-MODE-WIRE: PK ruling, a voice turn never starts an Agent run: one marked mode \"voice\" never carries build_mode \"agent\" (the page already gave it \"standard\"; this is the last line, for a send that got past it), so Director's opt-in is dropped, never kept or set. Flags off: nothing.\n", ""],
    ["  // AGENT-MODE-WIRE: the person's answer to an agent card (the contract's { type: 'agent_answer', data: { run_id, card, choice } }, lib/studio-agent-mode.ts agentAnswerFrame). It goes out ONLY on the live socket, never queued, never replayed after a reconnect\n", ""],
    ["  // AGENT-MODE-WIRE: (Director ignores an answer from a socket that is not the signed, current one); false (flags off, no live socket, a bad answer, a throwing send) leaves the card open for another click and sends nothing.\n", ""],
    ["  const sendAgentAnswer = useCallback((answer: import('@/lib/studio-agent-mode').AgentAnswer): boolean => { // AGENT-MODE-WIRE\n", ""],
    ["    const socket = wsRef.current; // AGENT-MODE-WIRE\n", ""],
    ["    if (!STUDIO_AGENT_MODE_ENABLED || !socket || !agentAnswerSendable(answer, socket.readyState === WebSocket.OPEN)) return false; // AGENT-MODE-WIRE\n", ""],
    ["    try { socket.send(JSON.stringify(agentAnswerFrame(answer))); return true; } catch { return false; } // AGENT-MODE-WIRE\n", ""],
    ["  }, []); // AGENT-MODE-WIRE\n", ""],
    ["    sendAgentAnswer, // AGENT-MODE-WIRE\n", ""],
  ],
  [BUILDER_PAGE]: [
    ["  const [buildMode, setBuildMode] = useState<BuildMode>('standard') // AGENT-MODE-WIRE: the build mode the picker holds; nothing is sent until a build request carries it (buildModeWire below)\n", ""],
    ["  const [buildModeFrom, setBuildModeFrom] = useState<BuildMode | undefined>(undefined) // AGENT-MODE-WIRE: set once the person picked Author or Agent, so that going back to Standard is sent as an explicit reset\n", ""],
    ["  const [agentRun, dispatchAgentRun] = React.useReducer(agentWireReducer, undefined, initialAgentRunState) // AGENT-MODE-WIRE: the run card's state (#607's reducer: Director's agent frames and the person's answers); idle with the flags off, and then never touched\n", ""],
    ["  const agentBuildModeRef = useRef<BuildMode | undefined>(undefined) // AGENT-MODE-WIRE: the build_mode the next build request carries (undefined omits the key); written each render from the picker, the flags and the plan\n", ""],
    ["  const agentVoiceModeRef = useRef<BuildMode | undefined>(undefined) // AGENT-MODE-WIRE: the build_mode a build send that came from the voice call carries (PK ruling: voice never starts Agent); written each render, never \"agent\"\n", ""],
    ["  const agentCardsRef = useRef<HTMLDivElement>(null) // AGENT-MODE-WIRE: the cards in the chat, to bring a new one into view\n", ""],
    ["  const agentSessionRef = useRef<string | null>(null) // AGENT-MODE-WIRE: the last session the page showed, to tell a move to another session from the first save of a new chat\n", ""],
    ["  const agentPlan = agentPlanOf(user?.tier) // AGENT-MODE-WIRE: the plan the signed-in session carries (read from the database, not from a frame); one that is not free / starter / pro / premium is null, and null keeps Agent disabled\n", ""],
    ["  const buildModeWire = STUDIO_AGENT_MODE_ENABLED ? buildModeOnWire(buildMode, { plan: agentPlan, previous: buildModeFrom }) : undefined // AGENT-MODE-WIRE: the picker's build_mode on the wire (undefined: Standard, and no other was ever picked; the two refs below turn it into the key a typed send and a voice send carry); with the flags off it is undefined and every frame is today's\n", ""],
    ["  agentBuildModeRef.current = STUDIO_AGENT_MODE_ENABLED ? typedBuildMode(buildModeWire, agentPlan) : undefined // AGENT-MODE-WIRE: read at send time by the four build sends below (typed message, outline accept), so a pick is on the very next request and a closure never holds an old mode; PK ruling (12 Nov): Standard on a plan that can have an Agent opt-in (Pro, Max) is sent as an explicit \"standard\" (Director's opt-in is sticky and the picker starts on Standard after a reload), the other plans leave the key out\n", ""],
    ["  agentVoiceModeRef.current = STUDIO_AGENT_MODE_ENABLED ? voiceBuildMode(buildModeWire, agentPlan) : undefined // AGENT-MODE-WIRE: the same, for a send that came from the voice call: \"standard\" for a plan that can have an Agent opt-in (Director's is sticky; this drops it), else no key; never \"agent\"\n", ""],
    ["  useEffect(() => { // AGENT-MODE-WIRE: a run, its cards and a picked mode belong to the session they were made in; another session starts clean (the first save of a new chat is not a move)\n", ""],
    ["    if (!STUDIO_AGENT_MODE_ENABLED) return // AGENT-MODE-WIRE\n", ""],
    ["    if (agentSessionChanged(agentSessionRef.current, currentSessionId)) { dispatchAgentRun(AGENT_WIRE_RESET); setBuildMode('standard'); setBuildModeFrom(undefined) } // AGENT-MODE-WIRE\n", ""],
    ["    agentSessionRef.current = currentSessionId ?? agentSessionRef.current // AGENT-MODE-WIRE\n", ""],
    ["  }, [currentSessionId]) // AGENT-MODE-WIRE\n", ""],
    ["  const agentCardsViewKey = agentCardsKey(agentRun) // AGENT-MODE-WIRE\n", ""],
    ["  useEffect(() => { if (STUDIO_AGENT_MODE_ENABLED && agentCardsViewKey) agentCardsRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }) }, [agentCardsViewKey]) // AGENT-MODE-WIRE: a card that appears or changes (the estimate, a spend check, a failure) is brought into view; a run's steps and totals are not\n", ""],
    ["    sendAgentAnswer, // AGENT-MODE-WIRE\n", ""],
    ["    ...(STUDIO_AGENT_MODE_ENABLED ? { onAgentFrame: (frame: unknown, owner: { isCurrent: () => boolean }) => { if (owner.isCurrent()) dispatchAgentRun(frame) } } : {}), // AGENT-MODE-WIRE: Director's agent frames go to the run card's reducer; off: not passed\n", ""],
    ["    const agentModeRef = STUDIO_AGENT_MODE_ENABLED && voiceOriginatedSend(messageText) ? agentVoiceModeRef : agentBuildModeRef // AGENT-MODE-WIRE: PK ruling, a voice turn never starts Agent: asked here, before any await, whether these are the words the voice call armed; the sends below read the mode from this ref\n", ""],
    ["          ...(agentModeRef.current ? { buildMode: agentModeRef.current } : {}), // AGENT-MODE-WIRE\n", ""],
    ["              ...(agentModeRef.current ? { buildMode: agentModeRef.current } : {}), // AGENT-MODE-WIRE\n", ""],
    ["        ...(agentModeRef.current ? { buildMode: agentModeRef.current } : {}), // AGENT-MODE-WIRE\n", ""],
    ["    const agentModeRef = STUDIO_AGENT_MODE_ENABLED && voiceOriginatedSend(action.label) ? agentVoiceModeRef : agentBuildModeRef // AGENT-MODE-WIRE: the same for a card's button: a spoken \"yes\" is this click with the call's words armed, and it sends \"standard\", not the picker's Agent\n", ""],
    ["            ...(agentModeRef.current ? { buildMode: agentModeRef.current } : {}), // AGENT-MODE-WIRE\n", ""],
    ["                      {STUDIO_AGENT_MODE_ENABLED && agentRun.status !== 'idle' ? <div ref={agentCardsRef} className=\"space-y-4\"><AgentRunCards state={agentRun} onAnswer={answer => { answerAgentCard(agentRun, answer, sendAgentAnswer, dispatchAgentRun, () => toast(AGENT_WIRE_COPY.answerNotSent)) }} onControl={action => { const requestId = sendBuildControl(action, buildNarration.buildId ?? undefined); if (requestId) markNarrationControl(AGENT_WIRE_CONTROL_MARK[action], buildNarration.buildId, requestId); else toast(AGENT_WIRE_COPY.controlNotSent(action)) }} /></div> : null}{/* AGENT-MODE-WIRE (NEXT_PUBLIC_AGENT_MODE and NEXT_PUBLIC_STUDIO_V4_SHELL): the estimate, run and A3 / A4 / A6 cards, in the chat after the messages; a card is answered only by a click, and the answer goes out only on the live socket; off, null */}\n", ""],
    ["                  {STUDIO_AGENT_MODE_ENABLED ? <div className=\"mx-auto w-full max-w-[668px] px-3 pb-1\"><BuildModePicker value={buildMode} plan={agentPlan} disabled={agentRunBusy(agentRun)} onChange={mode => { if (mode !== 'standard') setBuildModeFrom(mode); setBuildMode(mode) }} /></div> : null}{/* AGENT-MODE-WIRE (NEXT_PUBLIC_AGENT_MODE and NEXT_PUBLIC_STUDIO_V4_SHELL): Standard / Author / Agent above the composer; Agent only for Pro and Max, and the mode cannot change while a run is in progress; choosing sends nothing; off, null */}\n", ""],
    ["import { AgentRunCards } from '@/components/builder/agent-mode/agent-run-cards' // AGENT-MODE-WIRE\n", ""],
    ["import { BuildModePicker } from '@/components/builder/agent-mode/build-mode-picker' // AGENT-MODE-WIRE\n", ""],
    ["import { STUDIO_AGENT_MODE_ENABLED, agentPlanOf, buildModeOnWire, initialAgentRunState, type BuildMode } from '@/lib/studio-agent-mode' // AGENT-MODE-WIRE\n", ""],
    ["import { AGENT_WIRE_CONTROL_MARK, AGENT_WIRE_COPY, AGENT_WIRE_RESET, agentCardsKey, agentRunBusy, agentSessionChanged, agentWireReducer, answerAgentCard, typedBuildMode, voiceBuildMode, voiceOriginatedSend } from '@/lib/studio-agent-mode-wire' // AGENT-MODE-WIRE\n", ""],
  ],
}

/** The older proofs this change teaches: [text the proof has now, text it had before] per edit (was = '' for an inserted line). Every line the proof has now that this change added carries AGENT_MODE_WIRE_PIN_MARK. */
export const AGENT_MODE_WIRE_PIN_MARK = '// LATER-CHANGES: registry read (AGENT-MODE-WIRE)'
const PIN_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Agent mode wire:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE): on a branch stacked after this change (the Agent build wire, on the Agent build shell), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
export const AGENT_MODE_WIRE_PIN_EDITS = {
  // two older proofs walk the first-parent line of BASE..HEAD without merges and require every subject on it to be their own: this change's commits (subject "Agent mode wire:") are left out of that line, like every later change's
  'scripts/test-studio-chat-element-edit.mjs': [[PIN_LINE, '']],
  'scripts/test-studio-deck-sync-truth.mjs': [[PIN_LINE, '']],
  // #607's own proof: the scope check that held the hook and the Builder page to the base reads them past the later changes' strips (the replaced line is its "drafts are not applied" line)
  'scripts/test-studio-agent-mode-shell.mjs': [["  for (const rel of AGENT_MODE_SHELL_DRAFT_FILES) assert.equal(later(rel, git('show', `${head}:${rel}`)), baseText(rel), `the drafts are not applied: ${rel} is dev's, byte for byte (a later change's registered lines out first)`) // LATER-CHANGES: registry read (AGENT-MODE-WIRE): on a branch stacked after this change (the Agent build wire applies lines to the hook and the Builder page), the committed files are read past the later changes' strips\n", "  assert.equal(git('diff', '--stat', `${BASE_COMMIT}..${head}`, '--', ...AGENT_MODE_SHELL_DRAFT_FILES).trim(), '', 'the drafts are not applied: the hook and the Builder page are dev\\'s, byte for byte')\n"]],
}
/** Where the taught line goes: right after the shell's (#607) subject filter, the line that starts with this text. */
export const AGENT_MODE_WIRE_PIN_AFTER = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Agent mode shell:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AGENT-MODE-SHELL)"
export const AGENT_MODE_WIRE_PIN_FILES = Object.keys(AGENT_MODE_WIRE_PIN_EDITS)

/** Every [has, was] pair this change makes to an existing file, by file: the two app files and the three taught proofs. */
export const AGENT_MODE_WIRE_ALL_EDITS = { ...AGENT_MODE_WIRE_EDITS, ...AGENT_MODE_WIRE_PIN_EDITS }

/** Files this change edits that are not app code: the registry (two lines: its files and its strip) and the older proofs it teaches. */
export const AGENT_MODE_WIRE_OWN_EDITS = ['scripts/studio-later-changes.mjs', ...AGENT_MODE_WIRE_PIN_FILES]
/** #607's own files this change edits in place (PK ruling, 11 Nov: the A1 estimate card is information, not a gate, because the Agent send is the spend click; Stop sends A1 cancel): the card, the mount that hands it its props, the shared button's comment and the words (AGENT_COPY). Not marked lines, so not stripped; #607's own proof holds what they do. #607's proof is the other file edited in place (it is in AGENT_MODE_WIRE_PIN_FILES). */
export const AGENT_MODE_WIRE_SHELL_EDITED_FILES = ['components/builder/agent-mode/agent-card-parts.tsx', 'components/builder/agent-mode/agent-estimate-card.tsx', 'components/builder/agent-mode/agent-run-cards.tsx', 'lib/studio-agent-mode.ts']
/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const AGENT_MODE_WIRE_SCOPE_FILES = new Set([...AGENT_MODE_WIRE_APP_FILES, ...AGENT_MODE_WIRE_NEW_FILES, ...AGENT_MODE_WIRE_OWN_EDITS, ...AGENT_MODE_WIRE_SHELL_EDITED_FILES])

/** `text` with one whole line put back: `has` is the line with its newline, and it counts only at the start of a line (never the tail of a longer one). Only the first occurrence goes: a line that is there twice is a merge mistake the older pins must still see. */
function putBackLine(text, has, was) {
  let at = text.indexOf(has)
  while (at !== -1 && !(at === 0 || text[at - 1] === '\n')) at = text.indexOf(has, at + 1)
  return at === -1 ? text : text.slice(0, at) + was + text.slice(at + has.length)
}

/** The file with this change's edits put back (the previous text). Idempotent: a file that has none of the lines comes back as it is. */
export function putBackAgentModeWire(rel, text) {
  return (Object.prototype.hasOwnProperty.call(AGENT_MODE_WIRE_ALL_EDITS, rel) ? AGENT_MODE_WIRE_ALL_EDITS[rel] : []).reduce((out, [has, was]) => putBackLine(out, has, was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripAgentModeWire(rel, text) {
  if (typeof text !== 'string') return text
  if (!Object.prototype.hasOwnProperty.call(AGENT_MODE_WIRE_ALL_EDITS, rel)) return text
  return putBackAgentModeWire(rel, text)
}
