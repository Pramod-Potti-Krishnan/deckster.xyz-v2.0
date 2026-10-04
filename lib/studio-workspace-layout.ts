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

export function resizeStudioPane(startWidth: number, startX: number, currentX: number, side: StudioWorkspacePane) {
  return startWidth + (currentX - startX) * (side === 'chat' ? 1 : -1)
}
