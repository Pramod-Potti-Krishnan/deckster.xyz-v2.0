/** Presentation-only allocation. Never changes the editor's drawer owners or saved preferences. */
export const STUDIO_DUAL_PANE_MIN_WIDTH = 1100
export type StudioWorkspacePane = 'chat' | 'inspector'
export type StudioInspector = 'element' | 'slide' | 'template'

function finiteWidth(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, Math.min(min, max)), max)
}

export function allocateStudioWorkspace({
  width,
  chatPreference,
  inspectorPreference,
  chatOpen,
  inspectorOpen,
  inspectorCollapsed = false,
  collapsedWidth = 28,
  activePane,
  overlay = false,
  stageSelected = false,
}: {
  width: number
  chatPreference: number
  inspectorPreference: number
  chatOpen: boolean
  inspectorOpen: boolean
  inspectorCollapsed?: boolean
  collapsedWidth?: number
  activePane: StudioWorkspacePane
  overlay?: boolean
  stageSelected?: boolean
}) {
  const workspaceWidth = finiteWidth(width, 1100)
  const dualPane = workspaceWidth >= STUDIO_DUAL_PANE_MIN_WIDTH
  // If the selected pane closes, expose the remaining open pane without changing its owner.
  const presentedPane = activePane === 'chat' && !chatOpen && inspectorOpen
    ? 'inspector'
    : activePane === 'inspector' && !inspectorOpen && chatOpen ? 'chat' : activePane
  // Small screens present one full-width surface over a positive-width, mounted Stage.
  // This does not write preferences or change the native open/closed drawer owners.
  if (overlay && !dualPane) {
    const chatVisible = !stageSelected && chatOpen && presentedPane === 'chat'
    const inspectorVisible = !stageSelected && inspectorOpen && presentedPane === 'inspector'
    const right = inspectorVisible && inspectorCollapsed ? Math.min(collapsedWidth, workspaceWidth) : 0
    return { chatMax: workspaceWidth, inspectorMax: workspaceWidth, dualPane, presentedPane,
      chatVisible, inspectorVisible, chatWidth: workspaceWidth, inspectorWidth: workspaceWidth,
      left: 0, right, canvasWidth: workspaceWidth - right }
  }
  const chatVisible = chatOpen && (dualPane || presentedPane === 'chat')
  const inspectorVisible = inspectorOpen && (dualPane || presentedPane === 'inspector')
  const canvasFloor = dualPane ? 480 : Math.min(320, workspaceWidth * 0.45)
  const chatMax = Math.max(0, Math.min(inspectorVisible ? 360 : 720, workspaceWidth - canvasFloor - (
    inspectorVisible ? inspectorCollapsed ? collapsedWidth : 320 : 0
  )))
  const chatWidth = clamp(finiteWidth(chatPreference, 304), 280, chatMax)
  const inspectorMax = Math.max(0, Math.min(400, workspaceWidth - canvasFloor - (chatVisible ? chatWidth : 0)))
  const inspectorWidth = clamp(finiteWidth(inspectorPreference, 360), 320, inspectorMax)
  const left = chatVisible ? chatWidth : 0
  const right = inspectorVisible ? inspectorCollapsed ? Math.min(collapsedWidth, workspaceWidth) : inspectorWidth : 0
  return { chatMax, inspectorMax, dualPane, presentedPane, chatVisible, inspectorVisible, chatWidth, inspectorWidth, left, right, canvasWidth: Math.max(0, workspaceWidth - left - right) }
}

/**
 * NEXT_PUBLIC_STUDIO_CHAT_WIDTH_V2 (PASS2B G11, default off): the chat column's DEFAULT width per stage, as in the accepted v4 mockup
 * (measured at 1280, 1440 and 1600: 560 px from the brief through plan, outline and build, then 440 px once a deck is open). It is only
 * the default: a width the user has dragged (`saved`) always wins, and the allocator above still clamps whatever it is given, so the
 * 480 px canvas floor, the 360 px cap beside an inspector and the single-pane / overlay layouts are untouched.
 * - welcome (first run and the brief questions): today's value, unchanged (the first-run layout is out of scope);
 * - plan (plan gate, outline review, build before a deck exists): 560 px, but the canvas keeps at least 640 px;
 * - deck (a built or blank deck is open, slide rail and all): 440 px, but the canvas keeps at least 720 px;
 * - narrower than the side-by-side layout, or while an inspector is open (Add Slide, Add Element, Template): today's value;
 * - side by side, the result is never below 380 px (the narrowest window gets 460 / 380), so it degrades toward, never under, today's 304 px.
 * Flag off returns exactly the value the page computed before this existed. Pure: no React, no DOM, no process.env.
 */
export type StudioChatStage = 'welcome' | 'plan' | 'deck'
export const STUDIO_CHAT_WIDTH_V2_PLAN = 560
export const STUDIO_CHAT_WIDTH_V2_DECK = 440
export const STUDIO_CHAT_WIDTH_V2_PLAN_CANVAS_MIN = 640
export const STUDIO_CHAT_WIDTH_V2_DECK_CANVAS_MIN = 720
const STUDIO_CHAT_WIDTH_LEGACY = 304

/**
 * Welcome while the first-run / brief landing shows; plan while the canvas lifecycle is 'authored' (outline review) or 'preparing' (plan gate,
 * planning, build before the deck is adopted); deck for everything else, including a blank canvas and a session still loading its deck.
 */
export function studioChatStage(input: { welcome: boolean; mode: string }): StudioChatStage {
  if (input.welcome) return 'welcome'
  return input.mode === 'authored' || input.mode === 'preparing' ? 'plan' : 'deck'
}

export function studioChatDefaultWidth({ enabled, stage, width, inspectorOpen = false }: {
  enabled: boolean
  stage: StudioChatStage
  width: number
  inspectorOpen?: boolean
}) {
  // The expression the page used before the flag existed (kept verbatim so flag off cannot differ).
  const legacy = stage === 'welcome' ? Math.min(640, width * .44) : STUDIO_CHAT_WIDTH_LEGACY
  if (!enabled || stage === 'welcome' || inspectorOpen) return legacy
  const workspaceWidth = finiteWidth(width, 1100)
  if (workspaceWidth < STUDIO_DUAL_PANE_MIN_WIDTH) return legacy
  const plan = stage === 'plan'
  const room = workspaceWidth - (plan ? STUDIO_CHAT_WIDTH_V2_PLAN_CANVAS_MIN : STUDIO_CHAT_WIDTH_V2_DECK_CANVAS_MIN)
  return Math.min(plan ? STUDIO_CHAT_WIDTH_V2_PLAN : STUDIO_CHAT_WIDTH_V2_DECK, room)
}

/** The chat width handed to the allocator: the user's saved (dragged) width if there is one, else the stage default. */
export function studioChatPreference(input: {
  saved: number | null
  enabled: boolean
  stage: StudioChatStage
  width: number
  inspectorOpen?: boolean
}) {
  return input.saved ?? studioChatDefaultWidth(input)
}

export function resizeStudioPane(startWidth: number, startX: number, currentX: number, side: StudioWorkspacePane) {
  return startWidth + (currentX - startX) * (side === 'chat' ? 1 : -1)
}
