"use client"

import './studio-presentation.css'
import { StudioWaitingState } from '@/components/builder/studio-waiting-state'
import { EditModeGuide } from './edit-mode-guide'
import { StudioToolbarSaveFeedback } from './studio-toolbar-save-feedback'
import { StudioIntroReplay } from '@/components/studio-intro-replay'
import './studio-authoring-menus.css'
import type { StudioWorkflowRequest } from "@/lib/studio-workflow"
import { parseStudioNativeSlideOrder, matchStudioNativeAddSlideOrder } from '@/lib/studio-native-slide-order'
import { planStudioSlideThumbnailMutation, remapStudioSlideThumbnailRows, canAdmitStudioSlideThumbnailMetadata, type StudioSlideThumbnailMutationPlan, type StudioSlideThumbnailCapture } from '@/lib/studio-slide-thumbnail-mutations'
import { shouldHandleStudioCanvasShortcut } from "@/lib/studio-canvas-shortcuts"
import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft,
  ChevronRight,
  Minimize2,
  Save,
  X,
  Play,
  Layers,
  Check,
  Plus,
  Type,
  Image,
  LayoutGrid,
  GitBranch,
  Grid2x2,
  BarChart3,
  Square,
  Pencil,
  Settings,
  Palette,
  TrendingUp,
  Sparkles,
  LayoutTemplate,
  SlidersHorizontal,
  Settings2,
  Eye,
  Sun,
  Moon,
  Tag,
  Pentagon,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { features } from '@/lib/config'
import { debugLog } from '@/lib/debug-log'
import { getLayoutServiceUrl, LAYOUT_URL_CONFIG_ERROR, LAYOUT_VIEWER_URL_POLICY } from '@/lib/layout-service-client'
import {
  getLayoutViewerOrigin,
  isTrustedLayoutViewerMessage,
} from '@/lib/layout-viewer-messaging'
import { evaluateLayoutViewerUrl } from '@/lib/layout-viewer-url-policy'
import { isPresentViewOnlyEnabled, presentNavigationCommand } from '@/lib/present-view-only'
import { PresentViewOnlyFrame } from './present-view-only-frame'
import {
  buildSnapshotNavigationUrl,
  completedBuildSnapshotKey,
  nativeSnapshotSlideCount,
  type CompletedBuildSnapshot,
} from '@/lib/build-viewer-snapshot'
import {
  isMatchingSlideComposeCommandResponse,
  restoreSlideViewerSelection,
  resolveSlideComposeViewerState,
  resolveSlideViewerNavigationInfo,
} from '@/lib/slide-compose-async'
import { applyStageFThumbnailUrls, ownedRestoredThumbnailUrl } from '@/lib/stage-f-thumbnails'
import { useSlideRailIdentity } from '@/hooks/use-slide-rail-identity'
import { STUDIO_RAIL_SLIDE_IDENTITY_ENABLED } from '@/lib/slide-rail-identity'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { SlideThumbnailStrip, SlideThumbnail, type SlideComposeThumbnailJob } from './slide-thumbnail-strip'
import type { SlideRefineTarget } from '@/lib/slide-refinement'
import { SlideNotesPanel } from './slide-notes-panel'
import { SaveStatus } from './save-status-indicator'
import { SlideLayoutPicker, SlideLayoutType } from './slide-layout-picker'
import { DeleteSlideDialog } from './delete-slide-dialog'
import { TemplateSaveDialog } from './template-save-dialog'
import { TemplateIngestDialog } from './template-ingest-dialog'
import { useToast } from '@/hooks/use-toast'
// TextFormatPopover is now replaced by simple text box insertion button
// Keeping FormatTextParams for backward compatibility if needed
import { FormatTextParams } from './text-format-popover'
import { generateTableHTML } from './table-insert-popover'
import { InsertChartParams, generateChartConfig } from './chart-picker-popover'
import { ElementType, ElementProperties, BaseElementProperties, ChartType } from '@/types/elements'
import { VersionHistoryPanel } from './version-history-panel'
import { PresentationSettingsPanel } from './presentation-settings-panel'
import { ThemePanel } from './theme-panel'
import { TemplateModeOverlay } from './builder/template-mode-overlay'
import { TemplatePickerContent } from './builder/template-picker'
import type { TemplateBlueprint, TemplateSelection, TemplateSnapshot } from '@/hooks/use-templates'
import { getTemplateSaveGate } from '@/lib/template-save-gate'
import {
  LAYOUT_SERVICE_COMMANDS,
  getCommandType,
  isElementorCommand,
  isLayoutViewerEvent,
} from '@/lib/element-command-router'
import {
  getElementorServiceUrl,
  getElementorEndpoint,
  ElementorContext,
  ElementorPosition
} from '@/lib/elementor-client'
import { SlideBuildingLoader } from './slide-building-loader'
import type { BuildThemeSelection } from '@/lib/theme-builder'
import { createStudioFormatSelectionHandle, type StudioFormatSelectionHandle } from '@/lib/studio-format-native'
import { IDLE_THEME_SYNC, type ThemeSyncState } from '@/lib/theme-sync'
import {
  isDiagramRendererStateEvent,
  parseDiagramRendererStateUpdate,
  type DiagramRendererStateUpdate,
} from '@/lib/diagram-renderer-state'
import {
  createLayoutMutationId,
  layoutMutationStateIsAmbiguous,
  sendLayoutMutationWithReconciliation,
} from '@/lib/layout-command-result'

const DEFAULT_BUILD_THEME_SELECTION: BuildThemeSelection = { mode: 'auto' }

function scTrace(event: string, payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  if (!isSlideComposerTraceEnabled()) return
  console.info('[SC_TRACE]', event, payload)
}

function isSlideComposerTraceEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return features.slideComposerTraceEnabled || window.localStorage?.getItem('deckster.slideComposerTrace') === 'true'
}

// Selection info from Layout Service
export interface SelectionInfo {
  hasSelection: boolean
  selectedText?: string
  sectionId?: string
  slideIndex?: number
}

// Text box formatting info from Layout Service
export interface TextBoxFormatting {
  fontFamily?: string
  fontSize?: string
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
  color?: string
  backgroundColor?: string
  textAlign?: string
  lineHeight?: string
  padding?: string
  border?: string
  borderRadius?: string
  themeBindings?: Record<string, string> | null
}

export interface RefineElementRequest {
  elementId: string
  elementType: string
  componentType?: string
  slideIndex?: number
  gridPosition?: {
    gridRow?: string
    gridColumn?: string
    startCol?: number
    startRow?: number
    width?: number
    height?: number
  }
  isBlank?: boolean
  formatting?: Record<string, unknown>
  properties?: Record<string, unknown>
  themeVariantId?: string | null
  themeBindings?: Record<string, string> | null
  styleOwner?: string | null
  themeVariantSource?: string | null
  researchProvenance?: Record<string, unknown> | null
  semanticRole?: import('@/types/textlabs').TextSemanticRole | null
  slotName?: string | null
  slotKind?: import('@/types/textlabs').TextSlotKind | null
  accessoryType?: string | null
  generationConfig?: Record<string, unknown> | import('@/types/textlabs').DiagramGenerationConfig | null
  citationsUsed?: Array<Record<string, unknown>> | null
  metricsColorVariant?: string | null
  diagramSubtype?: import('@/types/textlabs').TextLabsDiagramSubtype | null
  zIndex?: number | null
  content?: unknown
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/**
 * Layout versions have exposed persisted element metadata at both the event
 * root and under properties/metadata. Accept every additive location while
 * preferring the current direct contract so older saved charts can still
 * hydrate Refine after a full-page reload.
 */
export function resolveRefineElementGenerationConfig(
  payload: unknown,
): Record<string, unknown> | import('@/types/textlabs').DiagramGenerationConfig | null {
  const root = recordValue(payload)
  if (!root) return null
  const properties = recordValue(root.properties)
  const metadata = recordValue(root.metadata)
  const propertyMetadata = recordValue(properties?.metadata)
  const nestedData = recordValue(root.data)
  const candidates = [
    root.generationConfig,
    root.generation_config,
    properties?.generationConfig,
    properties?.generation_config,
    metadata?.generationConfig,
    metadata?.generation_config,
    propertyMetadata?.generationConfig,
    propertyMetadata?.generation_config,
    nestedData?.generationConfig,
    nestedData?.generation_config,
  ]
  for (const candidate of candidates) {
    const config = recordValue(candidate)
    if (config) return config
  }
  return null
}

export type StudioThumbnailMutationCapture = (presentationId: string, owner: { readonly presentationId: string | null }) =>
  ((currentOwner: { readonly presentationId: string | null }, plan: StudioSlideThumbnailMutationPlan) => void) & {
    fence?: (currentOwner: { readonly presentationId: string | null }) => boolean
  }

interface PresentationViewerProps {
  onStudioFormatRequested?: (selection: StudioFormatSelectionHandle) => void
  studioFormatBusy?: boolean
  studioWorkflowRequest?: StudioWorkflowRequest | null
  presentationUrl: string
  presentationId: string | null
  slideCount: number | null
  completedBuildSnapshot?: CompletedBuildSnapshot | null
  slideStructure?: any // SlideUpdate payload from WebSocket
  showControls?: boolean
  downloadControls?: React.ReactNode
  onSlideChange?: (slideNumber: number) => void
  studioPartialArtifact?: boolean
  onStudioPartialNativeReadback?: (readback: StudioPartialNativeReadback) => void
  onThumbnailInvalidated?: (presentationId: string) => void
  onThumbnailMutationCapture?: StudioThumbnailMutationCapture
  studioOwnerUserId?: string | null
  onEditModeChange?: (isEditing: boolean) => void
  className?: string
  // Version switching support (Builder V2: now includes 'blank' version)
  strawmanPreviewUrl?: string | null
  finalPresentationUrl?: string | null
  activeVersion?: 'blank' | 'strawman' | 'final'
  isBlankPresentation?: boolean
  onVersionSwitch?: (version: 'blank' | 'strawman' | 'final') => void
  // Text box panel callbacks
  onTextBoxSelected?: (
    elementId: string,
    formatting: TextBoxFormatting | null,
    componentType?: string,
  ) => void
  onTextBoxDeselected?: () => void
  // Element panel callbacks (Image, Table, Chart, Infographic, Diagram)
  onElementSelected?: (elementId: string, elementType: ElementType, properties: ElementProperties) => void
  onElementDeselected?: () => void
  onElementDeleted?: (elementId: string) => void
  // Text Labs Generation Panel - opens generation panel for the given element type
  onOpenGenerationPanel?: (type: string) => void  // Uses string to avoid coupling to TextLabsComponentType
  onRefineElementRequested?: (payload: RefineElementRequest) => void
  buildThemeSelection?: BuildThemeSelection
  themeSync?: ThemeSyncState
  onBuildThemeChange?: (selection: BuildThemeSelection) => void
  // Element moved/resized on canvas (for position sync with GenerationPanel)
  onElementMoved?: (elementId: string, gridRow: string, gridColumn: string) => void
  // Bottom toolbar items (moved from header)
  connected?: boolean
  connecting?: boolean
  // Portal target for rendering toolbar in the header bar
  toolbarPortalTarget?: HTMLDivElement | null
  toolbarOffset?: number
  // Generation overlay: keeps viewer mounted but overlays loader
  isGenerating?: boolean
  generatingMode?: 'default' | 'strawman'
  // Build Narration v2: narration-agnostic chrome slots anchored to the slide.
  // ribbon renders above the slide container, footer below it (both plain flex
  // children — the container's ResizeObserver absorbs their height), frame and
  // placeholder render INSIDE the sized 16:9 box (frame around/over the
  // iframe, placeholder covering it). All slots skipped in fullscreen; the
  // whole prop null/undefined ⇒ byte-identical output to today.
  studioIntroReplay?: React.ReactNode
  stageChrome?: {
    ribbon?: React.ReactNode
    footer?: React.ReactNode
    frame?: React.ReactNode
    placeholder?: React.ReactNode
  } | null
  // Template Builder: the WS session id (source for "Save as Template") + gate
  sessionId?: string | null
  deckOwnerSessionId?: string | null
  templateSavePresentationId?: string | null
  templateBuilderEnabled?: boolean
  onSelectTemplate?: (template: TemplateSelection) => void
  onTemplateOptimizationFailed?: (templateId: string) => void
  templateSelectionLocked?: boolean
  templateModeOn?: boolean
  onTemplateModeChange?: (enabled: boolean) => void
  templateModeAvailable?: boolean
  composeJobs?: SlideComposeThumbnailJob[]
  onRefineSlide?: (target: SlideRefineTarget) => void
  onGenerateSlide?: () => void
  thumbnailUrlsBySlide?: Record<number, string>
  templateSnapshot?: TemplateSnapshot | null
  templateSnapshotLoading?: boolean
  templateCurrentSlideIndex?: number
  selectedTemplateElementId?: string | null
  blueprintEditorV2Enabled?: boolean
  onTemplateElementSelect?: (overrideKey: string | null) => void
  onTemplateBlueprintChange?: (blueprint: TemplateBlueprint) => void
  // Expose Layout Service API handlers for external use (e.g., Format Panel)
  onApiReady?: (apis: {
    getSelectionInfo: () => Promise<SelectionInfo | null>
    updateSectionContent: (slideIndex: number, sectionId: string, content: string) => Promise<boolean>
    sendTextBoxCommand: (action: string, params: Record<string, any>) => Promise<any>
    sendElementCommand: (action: string, params: Record<string, any>) => Promise<any>
    // MDC P8: index-based navigation for chat-invoked element placement.
    goToSlide: (slideIndex: number) => Promise<void>
    getStudioIntroductionSafety?: () => StudioIntroductionSafety
    captureStudioElementGeneration?: () => StudioElementGenerationLease | null
  } | null) => void
  onStudioIntroductionSafetyChange?: (safety: StudioIntroductionSafety | null) => void
  onComposeApiReady?: (apis: SlideComposeViewerApi | null) => void
}

/** Local observed safety only; this getter performs no iframe command or save. */
export interface StudioIntroductionSafety {
  presentationId: string | null
  presentationUrl: string | null
  ready: boolean
  dirty: boolean
  busy: boolean
  error: boolean
}

/** Local operation lifetime; it adds no native command or service request. */
export interface StudioElementGenerationLease {
  isCurrent: () => boolean
  sendElementCommand: (action: string, params: Record<string, any>) => Promise<any>
}

export interface StudioComposeSelectionContext {
  readonly frameEpoch: object
  readonly continuationKey: object
  readonly loadRevision: number
  readonly interactionRevision: number
  readonly structureRevision: number
  readonly presentationUrl: string
  isCurrent: () => boolean
  readNativeOrder: () => Promise<unknown>
  restoreIdentity: (input: {
    slideId: string
    expectedNativeCount: number | null
    isCurrent: () => boolean
  }) => Promise<{ slideId: string; visualIndex: number; nativeCount: number; verified: true }>
}

export interface SlideComposeViewerApi {
  composePlaceholderAdd: (jobId: string, visualIndex: number, replaceJobId?: string) => Promise<any>
  composeSlideReconcile: (
    jobId: string,
    realSlideIndex: number,
    realSlideId?: string | null,
    presentationId?: string | null,
  ) => Promise<any>
  composePlaceholderUpdate: (
    jobId: string,
    text: string,
    stage?: string | null,
    detail?: string | null,
  ) => Promise<any>
  composePlaceholderFail: (jobId: string) => Promise<any>
  composeGetState: () => Promise<any>
  composeGoToPlaceholder: (jobId: string) => Promise<any>
  composeGoToVisualIndex: (visualIndex: number, options?: { isCurrent?: () => boolean }) => Promise<any>
  composeCaptureSelectionContext?: () => StudioComposeSelectionContext | null
  refineOverlayMark: (jobId: string, slideId: string) => Promise<any>
  refineSlideReconcile: (
    jobId: string,
    oldSlideId: string,
    realSlideId: string,
    presentationId?: string | null,
  ) => Promise<any>
  refineOverlayClear: (jobId: string) => Promise<any>
}

interface SlideInfo {
  index: number
  total: number
}

// Viewer origin for postMessage communication
const VIEWER_ORIGIN = LAYOUT_VIEWER_URL_POLICY.configuredOrigin

/**
 * Send command to iframe via postMessage (cross-origin safe)
 */
type SendCommandOptions = {
  timeoutMs?: number
  expectedJobId?: string | null
  requireRequestId?: boolean
}

function createViewerRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `viewer-request-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sendCommand(
  iframe: HTMLIFrameElement | null,
  action: string,
  params?: Record<string, any>,
  optionsOrTimeout: number | SendCommandOptions = 5000,
): Promise<any> {
  const options = typeof optionsOrTimeout === 'number'
    ? { timeoutMs: optionsOrTimeout }
    : optionsOrTimeout
  const timeoutMs = options.timeoutMs ?? 5000
  const requestId = createViewerRequestId()
  const requiresStrictResponse = action.startsWith('compose') || action.startsWith('refine')
  const commandParams = requiresStrictResponse && isSlideComposerTraceEnabled()
    ? { ...(params || {}), _sc_trace: true }
    : params

  return new Promise((resolve, reject) => {
    try {
      getLayoutServiceUrl()
    } catch (error) {
      reject(error)
      return
    }
    if (!VIEWER_ORIGIN) {
      reject(new Error("Layout service has no configured viewer origin"))
      return
    }
    if (!iframe) {
      if (requiresStrictResponse) {
        scTrace('viewer.command.error', { action, requestId, params, error: 'Iframe not ready' })
      }
      reject(new Error('Iframe not ready'))
      return
    }

    const targetOrigin = getLayoutViewerOrigin(iframe, VIEWER_ORIGIN)
    let settled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      if (timeoutId) clearTimeout(timeoutId)
      window.removeEventListener('message', handler)
      callback()
    }

    const handler = (event: MessageEvent) => {
      if (!isTrustedLayoutViewerMessage(event, iframe, VIEWER_ORIGIN)) return

      const matches = requiresStrictResponse
        ? isMatchingSlideComposeCommandResponse(event.data, {
            action,
            requestId,
            expectedJobId: options.expectedJobId,
          })
        : event.data?.action === action && (options.requireRequestId
          ? event.data.requestId === requestId
          : !event.data?.requestId || event.data.requestId === requestId)

      if (matches) {
        if (requiresStrictResponse) {
          scTrace('viewer.command.response', {
            action,
            requestId,
            expected_job_id: options.expectedJobId ?? null,
            response: event.data,
          })
        }
        if (event.data.success) {
          settle(() => {
            resolve(event.data)
          })
        } else {
          settle(() => {
            reject(new Error(event.data.error || 'Command failed'))
          })
        }
      }
    }

    window.addEventListener('message', handler)

    // Timeout after the requested command budget.
    timeoutId = setTimeout(() => {
      if (requiresStrictResponse) {
        scTrace('viewer.command.timeout', {
          action,
          requestId,
          expected_job_id: options.expectedJobId ?? null,
          timeout_ms: timeoutMs,
          params: commandParams,
        })
      }
      settle(() => reject(new Error('Command timeout')))
    }, timeoutMs)

    if (requiresStrictResponse) {
      scTrace('viewer.command.send', {
        action,
        requestId,
        expected_job_id: options.expectedJobId ?? null,
        timeout_ms: timeoutMs,
        params: commandParams,
      })
    }
    iframe.contentWindow?.postMessage({ action, params: commandParams, requestId }, targetOrigin)
  })
}

function postCommand(
  iframe: HTMLIFrameElement | null,
  action: string,
  params?: Record<string, any>,
) {
  if (!VIEWER_ORIGIN || LAYOUT_URL_CONFIG_ERROR) return
  iframe?.contentWindow?.postMessage(
    { action, params, requestId: createViewerRequestId() },
    getLayoutViewerOrigin(iframe, VIEWER_ORIGIN),
  )
}

const DEFAULT_LAYOUT_COMMAND_TIMEOUT_MS = 5_000
const READ_LAYOUT_COMMAND_TIMEOUT_MS = 8_000
const MUTATING_LAYOUT_COMMAND_TIMEOUT_MS = 30_000
const CITED_UPSERT_LAYOUT_COMMAND_TIMEOUT_MS = 45_000

const LAYOUT_ELEMENT_COMMAND_TIMEOUTS: Record<string, number> = {
  getElementGeometry: READ_LAYOUT_COMMAND_TIMEOUT_MS,
  getSlideGenerationContext: READ_LAYOUT_COMMAND_TIMEOUT_MS,
  getTemplateSlotCatalog: READ_LAYOUT_COMMAND_TIMEOUT_MS,
  getElementThemeVariants: READ_LAYOUT_COMMAND_TIMEOUT_MS,
  refreshElementThemeMetadata: READ_LAYOUT_COMMAND_TIMEOUT_MS,
  setElementGenerationState: MUTATING_LAYOUT_COMMAND_TIMEOUT_MS,

  insertTextBox: MUTATING_LAYOUT_COMMAND_TIMEOUT_MS,
  insertTable: MUTATING_LAYOUT_COMMAND_TIMEOUT_MS,
  insertImage: MUTATING_LAYOUT_COMMAND_TIMEOUT_MS,
  insertChart: MUTATING_LAYOUT_COMMAND_TIMEOUT_MS,
  insertInfographic: MUTATING_LAYOUT_COMMAND_TIMEOUT_MS,
  insertDiagram: MUTATING_LAYOUT_COMMAND_TIMEOUT_MS,
  insertShape: MUTATING_LAYOUT_COMMAND_TIMEOUT_MS,
  deleteElement: MUTATING_LAYOUT_COMMAND_TIMEOUT_MS,
  deleteTextBox: MUTATING_LAYOUT_COMMAND_TIMEOUT_MS,

  upsertSemanticElement: CITED_UPSERT_LAYOUT_COMMAND_TIMEOUT_MS,
  upsertCitedElement: CITED_UPSERT_LAYOUT_COMMAND_TIMEOUT_MS,
}

function waitForViewerSettle(delayMs: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, delayMs))
}

export interface StudioPartialNativeReadback {
  readonly presentationId: string
  readonly presentationUrl: string
  readonly nativeCount: number
  readonly currentVisualIndex: number
  /** Navigation counts carry no native IDs/order. Only real_order uses the
   * existing strict compose parser; neither kind supplies storage authority. */
  readonly kind: 'navigation' | 'real_order'
  readonly isFrameCurrent: () => boolean
  readonly isCurrent: () => boolean
}

export function PresentationViewer({
  presentationUrl,
  presentationId,
  slideCount,
  slideStructure,
  showControls = true,
  downloadControls,
  onSlideChange,
  studioPartialArtifact = false,
  onStudioPartialNativeReadback,
  onThumbnailInvalidated,
  onThumbnailMutationCapture,
  studioOwnerUserId,
  onStudioFormatRequested,
  studioFormatBusy = false,
  onEditModeChange,
  className = '',
  strawmanPreviewUrl,
  finalPresentationUrl,
  activeVersion = 'final',
  isBlankPresentation = false,
  onVersionSwitch,
  onTextBoxSelected,
  onTextBoxDeselected,
  onElementSelected,
  onElementDeselected,
  onElementDeleted,
  onApiReady,
  onStudioIntroductionSafetyChange,
  onComposeApiReady,
  onOpenGenerationPanel,
  onRefineElementRequested,
  buildThemeSelection = DEFAULT_BUILD_THEME_SELECTION,
  themeSync = IDLE_THEME_SYNC,
  onBuildThemeChange,
  onElementMoved,
  toolbarPortalTarget,
  toolbarOffset = 0,
  connected,
  connecting,
  isGenerating,
  generatingMode,
  studioIntroReplay,
  stageChrome = null,
  completedBuildSnapshot = null,
  sessionId,
  deckOwnerSessionId,
  templateSavePresentationId,
  templateBuilderEnabled,
  onSelectTemplate,
  onTemplateOptimizationFailed,
  templateSelectionLocked = false,
  templateModeOn = false,
  onTemplateModeChange,
  templateModeAvailable = false,
  composeJobs = [],
  onRefineSlide,
  onGenerateSlide,
  thumbnailUrlsBySlide = {},
  templateSnapshot = null,
  templateSnapshotLoading = false,
  templateCurrentSlideIndex,
  selectedTemplateElementId = null,
  blueprintEditorV2Enabled = false,
  onTemplateElementSelect,
  onTemplateBlueprintChange,
  studioWorkflowRequest = null,
}: PresentationViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const slideContainerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [isEditMode, setIsEditMode] = useState(false)
  // Fullscreen slide dimensions (calculated via JS for accuracy)
  const [fullscreenSlideSize, setFullscreenSlideSize] = useState<{ width: number; height: number } | null>(null)
  // Normal-mode slide dimensions (fit-contain via ResizeObserver)
  const [normalSlideSize, setNormalSlideSize] = useState<{ width: number; height: number } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showTemplateSave, setShowTemplateSave] = useState(false) // Template Builder: Save dialog
  const [showTemplateIngest, setShowTemplateIngest] = useState(false) // Template Ingest: Upload dialog (C-7)
  // Template Ingest (C-7): flag-gated 4th Template-menu item.
  const templateIngestEnabled = process.env.NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED === 'true'
  const [toolbarTemplateMenuOpen, setToolbarTemplateMenuOpen] = useState(false)
  const [toolbarTemplatePickerOpen, setToolbarTemplatePickerOpen] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(1) // Start at 1 (slides are 1-indexed)
  const [totalSlides, setTotalSlides] = useState(slideCount || 0)
  const [visualTotalSlides, setVisualTotalSlides] = useState(slideCount || 0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // A4: while Present is on, a separate `?viewOnly=true` frame covers the editing frame so audiences
  // never see authoring placeholders. Flag NEXT_PUBLIC_PRESENT_VIEW_ONLY_ENABLED, default off = unchanged.
  const presentViewOnlyEnabled = isPresentViewOnlyEnabled()
  const [presentFrameFailed, setPresentFrameFailed] = useState(false)
  const presentFrameRef = useRef<HTMLIFrameElement | null>(null) // the view-only frame, once initialised
  const presentSlideIndexRef = useRef<number | null>(null) // last slide it reported, 0-based
  const presentViewOnlyActiveRef = useRef(false)
  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  const authoringStripRef = useRef<HTMLDivElement>(null)
  const [studioAuthoringPortalTarget, setStudioAuthoringPortalTarget] = useState<HTMLDivElement | null>(null)
  const [studioPresentPortalTarget, setStudioPresentPortalTarget] = useState<HTMLDivElement | null>(null)
  const [thumbnailWidth, setThumbnailWidth] = useState(120)
  const thumbnailResizeRef = useRef<{ startX: number; width: number } | null>(null)
  const thumbnailPreferenceKey = 'deckster_studio_v4_thumbnail_width'
  const clampThumbnailWidth = (width: number) => Math.max(96, Math.min(180, Math.round(width)))
  const rememberThumbnailWidth = (width: number) => {
    const bounded = clampThumbnailWidth(width)
    setThumbnailWidth(bounded)
    try { localStorage.setItem(thumbnailPreferenceKey, String(bounded)) } catch { /* Optional preference. */ }
  }
  useEffect(() => {
    if (!studioShell) return
    try {
      const saved = localStorage.getItem(thumbnailPreferenceKey)
      if (saved !== null && Number.isFinite(Number(saved))) setThumbnailWidth(clampThumbnailWidth(Number(saved)))
    } catch { /* Storage restrictions do not block the canvas. */ }
  }, [studioShell])
  useEffect(() => {
    if (!studioShell || isFullscreen || !showControls) return
    const container = authoringStripRef.current
    if (!container) return
    const revealAuthoringFocus = (event: FocusEvent) => {
      const control = event.target
      if (!(control instanceof HTMLElement) || !container.contains(control)) return
      const bounds = container.getBoundingClientRect()
      const focused = control.getBoundingClientRect()
      const style = getComputedStyle(control)
      const outline = style.outlineStyle === 'none' ? 0 : Math.max(
        0, (parseFloat(style.outlineWidth) || 0) + (parseFloat(style.outlineOffset) || 0),
      )
      const left = bounds.left + container.clientLeft
      const right = left + container.clientWidth
      const delta = focused.left - outline < left
        ? focused.left - outline - left
        : Math.max(0, focused.right + outline - right)
      if (delta) container.scrollLeft += delta
    }
    // Reveal just this strip; leave keyboard focus and the page position intact.
    container.addEventListener('focusin', revealAuthoringFocus)
    return () => container.removeEventListener('focusin', revealAuthoringFocus)
  }, [studioShell, isFullscreen, showControls, studioAuthoringPortalTarget])
  const [showThumbnails, setShowThumbnails] = useState(true) // Show by default
  const thumbnailVisibilityInitializedRef = useRef(false)
  useEffect(() => {
    if (thumbnailVisibilityInitializedRef.current) return
    thumbnailVisibilityInitializedRef.current = true
    // Initialize once after hydration; native toggles and later resizing own the choice.
    if (studioShell && window.innerWidth <= 666) setShowThumbnails(false)
  }, [studioShell])
  const [showToolbar, setShowToolbar] = useState(true) // For auto-hide in fullscreen
  const [iframeReady, setIframeReady] = useState(false)
  const [loadedApprovedNavigationUrl, setLoadedApprovedNavigationUrl] = useState<string | null>(null)
  const [pollingFailureCount, setPollingFailureCount] = useState(0)
  const lastSlideInfoRef = useRef<{ slide: number; total: number; visualTotal: number } | null>(null)
  const diagramStateTimersRef = useRef<Map<string, number>>(new Map())
  const pendingDiagramStatesRef = useRef<Map<string, DiagramRendererStateUpdate>>(new Map())
  const onSlideChangeRef = useRef(onSlideChange)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  // Native saves can race React renders. Only a trusted saved/no-pending event
  // clears a dirty history; forceSave/getPendingChanges fallbacks do not prove it.
  const nativeSnapshotDirtyRef = useRef(false)
  const [nativeSnapshotSafetyRevision, setNativeSnapshotSafetyRevision] = useState(0)
  const [buildSnapshotRevision, setBuildSnapshotRevision] = useState(0)
  const completedSnapshotRef = useRef<string | null>(null)
  const snapshotProbeRef = useRef<object | null>(null)
  const snapshotSelectionRef = useRef<{ source: string; index: number; restoring?: boolean } | null>(null)
  const [nativeReadySource, setNativeReadySource] = useState<string | null>(null)
  const snapshotCurrentSlideRef = useRef(currentSlide)
  snapshotCurrentSlideRef.current = currentSlide
  const nativeSnapshotStructureEditedRef = useRef(false)
  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [slidesToDelete, setSlidesToDelete] = useState<number[] | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Multi-select state for slide thumbnails
  const [selectedSlideIndices, setSelectedSlideIndices] = useState<number[]>([])
  // Track when CRUD operations have modified slides (invalidates stale slideStructure)
  const [slidesModifiedByCrud, setSlidesModifiedByCrud] = useState(false)
  const [isSlideMutationPending, setIsSlideMutationPending] = useState(false)
  const slideMutationPendingRef = useRef(false)
  // Publication survives release of the busy lease, so queued React updates
  // remain owned until a newer structural intent or frame/deck retires them.
  const studioNativeMutationPublicationRef = useRef<object | null>(null)
  // A native reload retires publication, but its latest logical operation may
  // still need an honest check-result notice. New intent/deck/mount wins.
  const studioNativeMutationIntentRef = useRef<object | null>(null)
  const studioDeleteDialogRef = useRef<{
    indices: number[]; open: boolean; submitted: boolean; isCurrent: () => boolean
  } | null>(null)
  const viewerInteractionIntentRef = useRef(0)
  // Manual navigation can retire automatic selection without retiring owned
  // structural counts/metadata. Poll movement is not a manual-intent receipt.
  const studioSlideNavigationRevisionRef = useRef(0)
  const studioManualSlideNavigationRef = useRef<{
    revision: number; iframe: HTMLIFrameElement; isCurrent: () => boolean
    selectedId: Promise<string | null>
  } | null>(null)
  const studioComposeLoadRevisionRef = useRef(0)
  const studioComposeLoadedFrameRef = useRef<{
    iframe: HTMLIFrameElement; source: string; nativeWindow: Window | null; revision: number
  } | null>(null)
  const studioComposeContinuationRef = useRef<{ key: string; deckOwner: object; token: object } | null>(null)
  const studioSaveRequestRef = useRef<object | null>(null)
  const slideMutationMountRef = useRef({ active: true, generation: 0 })
  const thumbnailNativeRevisionRef = useRef(0)
  const thumbnailMetadataRef = useRef({ structure: slideStructure, revision: 0 })
  if (thumbnailMetadataRef.current.structure !== slideStructure) {
    thumbnailMetadataRef.current = { structure: slideStructure, revision: thumbnailMetadataRef.current.revision + 1 }
  }
  const [studioCanonicalThumbnails, setStudioCanonicalThumbnails] = useState<{
    owner: object; nativeRevision: number; metadataRevision: number; rows: SlideThumbnail[]
  } | null>(null)
  const slideMutationRequestRef = useRef<{
    owner: object
    mountGeneration: number
    iframe: HTMLIFrameElement
    isCurrent?: () => boolean
    reportUnconfirmed?: () => void
    operation?: 'add'
  } | null>(null)
  const toolbarDropdownPortalContainer = isFullscreen ? containerRef.current ?? undefined : undefined
  // Text box selection state
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
  // Version history panel state
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showPresentationSettings, setShowPresentationSettings] = useState(false)
  const [showThemePanel, setShowThemePanel] = useState(false)
  const handledWorkflowRef = useRef<string | null>(null)


  const viewerUrlDecision = useMemo(
    () => evaluateLayoutViewerUrl(presentationUrl, LAYOUT_VIEWER_URL_POLICY),
    [presentationUrl],
  )
  const approvedPresentationUrl = !LAYOUT_URL_CONFIG_ERROR && viewerUrlDecision.status === 'allowed'
    ? viewerUrlDecision.url
    : null
  const templateSaveGate = getTemplateSaveGate({
    templateBuilderEnabled,
    sessionId,
    deckOwnerSessionId,
    presentationUrl: approvedPresentationUrl,
    presentationId,
    finalPresentationUrl,
    templateSavePresentationId,
    activeVersion,
    isBlankPresentation,
    templateModeOn,
  })
  const canSaveTemplate = !studioPartialArtifact && templateSaveGate.canSave
  const resolvedTemplateSavePresentationId = studioPartialArtifact ? null : templateSaveGate.sourcePresentationId
  // View mode toggles (grid, borders, edit) - only shown in non-fullscreen
  const [isGridActive, setIsGridActive] = useState(false)
  const [isBordersActive, setIsBordersActive] = useState(false)
  const approvedIframeNavigationUrl = useMemo(() => {
    return buildSnapshotNavigationUrl(approvedPresentationUrl, studioShell ? buildSnapshotRevision : 0)
  }, [approvedPresentationUrl, studioShell, buildSnapshotRevision])
  const presentViewOnlyActive = presentViewOnlyEnabled && isFullscreen && !presentFrameFailed && !!approvedIframeNavigationUrl
  presentViewOnlyActiveRef.current = presentViewOnlyActive
  const slideMutationOwnerRef = useRef({
    userId: studioOwnerUserId ?? null,
    presentationId: presentationId ?? null,
    source: approvedIframeNavigationUrl,
    sessionId: sessionId ?? null,
    deckOwnerSessionId: deckOwnerSessionId ?? null,
    activeVersion,
    generation: 0,
  })
  if (studioShell && (
    slideMutationOwnerRef.current.userId !== (studioOwnerUserId ?? null)
    ||
    slideMutationOwnerRef.current.presentationId !== (presentationId ?? null)
    || slideMutationOwnerRef.current.source !== approvedIframeNavigationUrl
    || slideMutationOwnerRef.current.sessionId !== (sessionId ?? null)
    || slideMutationOwnerRef.current.deckOwnerSessionId !== (deckOwnerSessionId ?? null)
    || slideMutationOwnerRef.current.activeVersion !== activeVersion
  )) {
    slideMutationOwnerRef.current = {
      userId: studioOwnerUserId ?? null,
      presentationId: presentationId ?? null,
      source: approvedIframeNavigationUrl,
      sessionId: sessionId ?? null,
      deckOwnerSessionId: deckOwnerSessionId ?? null,
      activeVersion,
      generation: slideMutationOwnerRef.current.generation + 1,
    }
    // A different viewer may admit its own slide mutation while the original
    // receipt continues settling. Its eventual finally cannot release this gate.
    slideMutationRequestRef.current = null
    slideMutationPendingRef.current = false
    studioNativeMutationPublicationRef.current = null
    studioNativeMutationIntentRef.current = null
    studioDeleteDialogRef.current = null
    studioManualSlideNavigationRef.current = null
    studioSaveRequestRef.current = null
  }
  const renderSlideMutationOwner = slideMutationOwnerRef.current
  const studioComposeDeckOwnerKey = JSON.stringify([studioOwnerUserId, presentationId, sessionId,
    deckOwnerSessionId, activeVersion])
  const studioComposeDeckOwnerRef = useRef({ key: studioComposeDeckOwnerKey, token: {} })
  if (studioComposeDeckOwnerRef.current.key !== studioComposeDeckOwnerKey) {
    studioComposeDeckOwnerRef.current = { key: studioComposeDeckOwnerKey, token: {} }
  }
  const [studioFormatSelection, setStudioFormatSelection] = useState<StudioFormatSelectionHandle | null>(null)
  const studioFormatSelectionRef = useRef<StudioFormatSelectionHandle | null>(null)
  const studioFormatModeRef = useRef({ enabled: templateModeOn, revision: 0 })
  if (studioFormatModeRef.current.enabled !== templateModeOn) {
    studioFormatModeRef.current = { enabled: templateModeOn, revision: studioFormatModeRef.current.revision + 1 }
    // Retire at render admission, before effects; leaving Template Mode does
    // not revive a captured ordinary-slide selection.
    studioFormatSelectionRef.current = null
  }
  const studioFormatSlideRef = useRef({ index: currentSlide, revision: 0 })
  if (studioFormatSlideRef.current.index !== currentSlide) {
    studioFormatSlideRef.current = { index: currentSlide, revision: studioFormatSlideRef.current.revision + 1 }
  }
  const studioFormatBusyRef = useRef(studioFormatBusy)
  studioFormatBusyRef.current = studioFormatBusy
  const onThumbnailInvalidatedRef = useRef(onThumbnailInvalidated)
  onThumbnailInvalidatedRef.current = onThumbnailInvalidated
  // F8/S-03 rail identity: the post-ack closures below re-read Layout's slide inventory through this.
  const slideRailRefreshRef = useRef<() => void>(() => {})
  const captureThumbnailInvalidation = useCallback((retireMapping = true) => {
    const owner = renderSlideMutationOwner
    const iframe = iframeRef.current
    const mountGeneration = slideMutationMountRef.current.generation
    // Every structural intent (duplicate/delete/reorder/layout as well as Add)
    // retires the injected snapshot-count proof before its native command.
    if (studioShell && owner.presentationId && iframe
      && slideMutationMountRef.current.active
      && slideMutationMountRef.current.generation === mountGeneration
      && slideMutationOwnerRef.current === owner) {
      viewerInteractionIntentRef.current += 1
      nativeSnapshotStructureEditedRef.current = true
      if (retireMapping) {
        thumbnailNativeRevisionRef.current += 1
        setStudioCanonicalThumbnails(null)
      }
    }
    return () => {
      if (!studioShell || !owner.presentationId || !iframe ||
        !slideMutationMountRef.current.active ||
        slideMutationMountRef.current.generation !== mountGeneration ||
        slideMutationOwnerRef.current !== owner || iframeRef.current !== iframe) return
      onThumbnailInvalidatedRef.current?.(owner.presentationId)
      slideRailRefreshRef.current()
    }
  }, [studioShell, renderSlideMutationOwner])
  const captureStudioNativeSlideFrame = useCallback(() => {
    const owner = renderSlideMutationOwner
    const iframe = iframeRef.current
    if (!iframe) return null
    if (!studioShell) return { iframe, isCurrent: () => true, isLogicalCurrent: () => true }
    const mount = slideMutationMountRef.current.generation
    const source = iframe.src
    const nativeWindow = iframe.contentWindow
    const loaded = studioComposeLoadedFrameRef.current
    const deck = studioComposeDeckOwnerRef.current.token
    let retired = false
    const isLogicalCurrent = () => slideMutationMountRef.current.active
      && slideMutationMountRef.current.generation === mount
      && studioComposeDeckOwnerRef.current.token === deck
      && slideMutationOwnerRef.current.source === source
    const isCurrent = () => {
      if (retired) return false
      const current = isLogicalCurrent() && slideMutationOwnerRef.current === owner
        && iframeRef.current === iframe && iframe.src === source && iframe.contentWindow === nativeWindow
        && Boolean(nativeWindow && loaded && loaded.iframe === iframe && loaded.source === source
          && loaded.nativeWindow === nativeWindow && loaded.revision === studioComposeLoadRevisionRef.current)
        && studioComposeLoadedFrameRef.current === loaded && source === owner.source
      if (!current) retired = true
      return current
    }
    return isCurrent() ? { iframe, isCurrent, isLogicalCurrent } : null
  }, [studioShell, renderSlideMutationOwner])
  const beginStudioManualSlideNavigation = useCallback((targetIndex: number) => {
    if (!studioShell) return null
    const revision = ++studioSlideNavigationRevisionRef.current
    studioManualSlideNavigationRef.current = null
    // Only a pending Add can self-navigate without a frame reload. Capture a
    // real selected ID for that recovery; no ordinary navigation read is added.
    if (slideMutationRequestRef.current?.operation !== 'add') return null
    const frame = captureStudioNativeSlideFrame()
    if (!frame) return null
    let settle: (id: string | null) => void = () => {}
    const selectedId = new Promise<string | null>(resolve => { settle = resolve })
    const record = { revision, iframe: frame.iframe, selectedId,
      isCurrent: () => studioManualSlideNavigationRef.current === record
        && studioSlideNavigationRevisionRef.current === revision && frame.isCurrent() }
    studioManualSlideNavigationRef.current = record
    let started = false
    return {
      capture: async () => {
        if (started) return
        started = true
        let id: string | null = null
        try {
          if (record.isCurrent()) {
            const order = parseStudioNativeSlideOrder(await sendCommand(frame.iframe, 'composeGetState', {}, {
              timeoutMs: READ_LAYOUT_COMMAND_TIMEOUT_MS,
            }))
            if (record.isCurrent() && order?.currentVisualIndex === targetIndex) id = order.slideIds[targetIndex] ?? null
          }
        } catch { /* Optional identity proof never guesses or repeats Add. */ }
        settle(id)
      },
      cancel: () => { started = true; settle(null) },
    }
  }, [studioShell, captureStudioNativeSlideFrame])
  const beginStudioNativeSlideMutation = useCallback((operation = 'slide change') => {
    const frame = captureStudioNativeSlideFrame()
    if (!frame) return null
    if (!studioShell) return {
      ...frame, release: () => {}, reportUnconfirmed: (_operation: string) => {},
      commit: <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => setter(value),
      commitSelection: <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => setter(value),
    }
    const owner = renderSlideMutationOwner
    const mount = slideMutationMountRef.current.generation
    const navigationRevision = studioSlideNavigationRevisionRef.current
    const pending = slideMutationRequestRef.current
    if (pending && (pending.owner !== owner || pending.mountGeneration !== mount
      || pending.iframe !== frame.iframe || pending.isCurrent?.() === false)) {
      slideMutationRequestRef.current = null
      slideMutationPendingRef.current = false
    }
    if (slideMutationPendingRef.current) return null
    const request = { owner, mountGeneration: mount, iframe: frame.iframe,
      isCurrent: () => false, reportUnconfirmed: () => {} }
    studioNativeMutationPublicationRef.current = request
    studioNativeMutationIntentRef.current = request
    const isLogicalCurrent = () => studioNativeMutationPublicationRef.current === request && frame.isLogicalCurrent()
    const isCurrent = () => isLogicalCurrent() && frame.isCurrent()
    request.isCurrent = isCurrent
    slideMutationRequestRef.current = request
    slideMutationPendingRef.current = true
    setIsSlideMutationPending(previous => isLogicalCurrent() ? true : previous)
    let reported = false
    const reportUnconfirmed = (label = operation) => {
      if (reported || studioNativeMutationIntentRef.current !== request || !frame.isLogicalCurrent()
        || iframeRef.current?.src !== owner.source) return
      reported = true
      toast({ title: 'Check slide result',
        description: `The ${label} result could not be confirmed. Check the slide list before trying again.`,
        variant: 'destructive' })
    }
    request.reportUnconfirmed = () => reportUnconfirmed()
    return {
      iframe: frame.iframe, isCurrent, isLogicalCurrent,
      commit: <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
        if (isCurrent()) setter(previous => isCurrent() ? value : previous)
      },
      commitSelection: <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
        const selected = () => isCurrent() && studioSlideNavigationRevisionRef.current === navigationRevision
        if (selected()) setter(previous => selected() ? value : previous)
      },
      reportUnconfirmed,
      release: () => {
        if (slideMutationRequestRef.current !== request) return
        slideMutationRequestRef.current = null
        slideMutationPendingRef.current = false
        // Releasing this request's busy UI does not publish native slide data.
        setIsSlideMutationPending(previous => isLogicalCurrent() ? false : previous)
      },
    }
  }, [captureStudioNativeSlideFrame, studioShell, renderSlideMutationOwner, toast])
  const beginStudioViewerInteraction = useCallback(() => {
    const owner = renderSlideMutationOwner
    const mountGeneration = slideMutationMountRef.current.generation
    const iframe = iframeRef.current
    const source = iframe?.src
    const nativeWindow = iframe?.contentWindow
    const intent = ++viewerInteractionIntentRef.current
    const isSourceCurrent = () => Boolean(
      iframe
      && slideMutationMountRef.current.active
      && slideMutationMountRef.current.generation === mountGeneration
      && slideMutationOwnerRef.current === owner
      && iframeRef.current === iframe
      && iframe.src === source && iframe.contentWindow === nativeWindow
    )
    const isCurrent = () => isSourceCurrent() && viewerInteractionIntentRef.current === intent
    return { iframe, isCurrent, isSourceCurrent }
  }, [renderSlideMutationOwner])
  useEffect(() => {
    slideMutationMountRef.current.active = true
    return () => {
      slideMutationMountRef.current.active = false
      slideMutationMountRef.current.generation += 1
      if (studioShell) {
        slideMutationRequestRef.current = null
        slideMutationPendingRef.current = false
        studioNativeMutationPublicationRef.current = null
        studioNativeMutationIntentRef.current = null
        studioDeleteDialogRef.current = null
        studioManualSlideNavigationRef.current = null
      }
    }
  }, [studioShell])
  useEffect(() => {
    if (studioShell) setIsSlideMutationPending(slideMutationPendingRef.current)
    if (studioShell && !studioSaveRequestRef.current) setIsSaving(false)
    if (studioShell && !studioDeleteDialogRef.current) {
      setIsDeleting(false)
      setShowDeleteDialog(false)
      setSlidesToDelete(null)
    }
  }, [studioShell, renderSlideMutationOwner])
  const viewerHasLoaded = Boolean(
    iframeReady &&
    approvedIframeNavigationUrl &&
    loadedApprovedNavigationUrl === approvedIframeNavigationUrl
  )
  const viewerIsReady = viewerHasLoaded && (!studioShell
    || snapshotSelectionRef.current?.source !== approvedIframeNavigationUrl
    || nativeReadySource === approvedIframeNavigationUrl)
  const snapshotSafetyRef = useRef({ isEditMode, isSaving, saveStatus, composeJobs: composeJobs.length })
  snapshotSafetyRef.current = { isEditMode, isSaving, saveStatus, composeJobs: composeJobs.length }
  const introSafetyRef = useRef({ presentationId, presentationUrl, viewerIsReady, isEditMode, isSaving, saveStatus,
    composing: composeJobs.some(job => job.status === 'building'), composeError: composeJobs.some(job => job.status === 'error') })
  introSafetyRef.current = { presentationId, presentationUrl, viewerIsReady, isEditMode, isSaving, saveStatus,
    composing: composeJobs.some(job => job.status === 'building'), composeError: composeJobs.some(job => job.status === 'error') }
  const getStudioIntroductionSafety = useCallback((): StudioIntroductionSafety => {
    const safety = introSafetyRef.current
    return { presentationId: safety.presentationId, presentationUrl: safety.presentationUrl,
      ready: safety.viewerIsReady,
      dirty: nativeSnapshotDirtyRef.current || safety.isEditMode || safety.saveStatus !== 'saved',
      busy: safety.isSaving || slideMutationPendingRef.current || !!slideMutationRequestRef.current
        || safety.composing || diagramStateTimersRef.current.size > 0 || pendingDiagramStatesRef.current.size > 0,
      error: safety.saveStatus === 'error' || safety.composeError }
  }, [])
  const captureStudioFormatSelection = useCallback((elementId: string, eventKind: 'textBoxSelected' | 'elementSelected', elementType?: ElementType) => {
    const mode = studioFormatModeRef.current
    if (!studioShell || mode.enabled) return
    const iframe = iframeRef.current
    const owner = slideMutationOwnerRef.current
    const mount = slideMutationMountRef.current.generation
    const slide = studioFormatSlideRef.current
    const intent = viewerInteractionIntentRef.current
    const source = iframe?.src
    const nativeWindow = iframe?.contentWindow
    if (!iframe || !nativeWindow || !owner.presentationId || !owner.userId
      || !owner.sessionId || owner.sessionId === 'new' || owner.deckOwnerSessionId !== owner.sessionId) return
    const epoch = {}
    let selection: StudioFormatSelectionHandle | null = null
    const isCurrent = () => Boolean(selection && studioFormatSelectionRef.current === selection
      && studioFormatModeRef.current === mode && !studioFormatModeRef.current.enabled
      && slideMutationMountRef.current.active && slideMutationMountRef.current.generation === mount
      && slideMutationOwnerRef.current === owner && iframeRef.current === iframe
      && iframe.src === source && iframe.contentWindow === nativeWindow
      && studioFormatSlideRef.current === slide && viewerInteractionIntentRef.current === intent
      && introSafetyRef.current.viewerIsReady && !getStudioIntroductionSafety().busy
      && !getStudioIntroductionSafety().error && !studioFormatBusyRef.current)
    selection = createStudioFormatSelectionHandle({ iframe, elementId, presentationId: owner.presentationId,
      sessionId: owner.sessionId, slideIndex: slide.index - 1, eventKind, elementType, owner: epoch, isCurrent })
    studioFormatSelectionRef.current = selection
    setStudioFormatSelection(selection)
  }, [studioShell, getStudioIntroductionSafety])
  useEffect(() => {
    if (studioShell) onStudioIntroductionSafetyChange?.(getStudioIntroductionSafety())
  }, [studioShell, onStudioIntroductionSafetyChange, getStudioIntroductionSafety, presentationId, presentationUrl,
    viewerIsReady, isEditMode, isSaving, saveStatus, nativeSnapshotSafetyRevision, isSlideMutationPending,
    introSafetyRef.current.composing, introSafetyRef.current.composeError])
  const introSafetyCallbackRef = useRef(onStudioIntroductionSafetyChange)
  introSafetyCallbackRef.current = onStudioIntroductionSafetyChange
  useEffect(() => () => { introSafetyCallbackRef.current?.(null) }, [])
  const snapshotBaseOwnerKey = JSON.stringify([
    approvedPresentationUrl, presentationId, sessionId, deckOwnerSessionId,
  ])
  useEffect(() => {
    completedSnapshotRef.current = null
    snapshotProbeRef.current = null
    snapshotSelectionRef.current = null
    nativeSnapshotDirtyRef.current = false
    nativeSnapshotStructureEditedRef.current = false
    setNativeReadySource(null)
  }, [snapshotBaseOwnerKey])
  useEffect(() => {
    if (isEditMode) nativeSnapshotDirtyRef.current = true
  }, [isEditMode])
  const completedBuildKey = completedBuildSnapshotKey(completedBuildSnapshot)
  useEffect(() => {
    if (!studioShell || !viewerIsReady || !completedBuildKey || !completedBuildSnapshot
      || completedSnapshotRef.current === completedBuildKey || templateModeOn
      || activeVersion !== 'final' || !sessionId || deckOwnerSessionId !== sessionId
      || completedBuildSnapshot.presentationId !== presentationId) return
    const owner = renderSlideMutationOwner
    const iframe = iframeRef.current
    const intent = viewerInteractionIntentRef.current
    const probe = {}
    const isCurrentAndSafe = () => {
      const safety = snapshotSafetyRef.current
      return iframe && iframeRef.current === iframe && slideMutationOwnerRef.current === owner
        && slideMutationMountRef.current.active && snapshotProbeRef.current === probe
        && viewerInteractionIntentRef.current === intent
        && !safety.isEditMode && !safety.isSaving && safety.saveStatus === 'saved'
        && !safety.composeJobs && !slideMutationPendingRef.current
        && !nativeSnapshotDirtyRef.current && !nativeSnapshotStructureEditedRef.current
        && !pendingDiagramStatesRef.current.size
    }
    snapshotProbeRef.current = probe
    if (!isCurrentAndSafe()) return
    void (async () => {
      try {
        const count = nativeSnapshotSlideCount(await sendCommand(iframe, 'getSlideCount'))
        if (!isCurrentAndSafe() || count === null) return
        const mode = await sendCommand(iframe, 'isEditModeActive')
        if (!isCurrentAndSafe() || mode.success !== true || mode.isEditing !== false) return
        // Injected count is valid for this unmodified build frame. Native CRUD
        // would make it stale and is fenced above. Equal/newer frames stay put.
        completedSnapshotRef.current = completedBuildKey
        if (count >= completedBuildSnapshot.slideCount) return
        const nextRevision = buildSnapshotRevision + 1
        const source = buildSnapshotNavigationUrl(approvedPresentationUrl, nextRevision)
        if (!source) return
        snapshotSelectionRef.current = { source, index: Math.max(0, snapshotCurrentSlideRef.current - 1) }
        setBuildSnapshotRevision(nextRevision)
      } catch {
        // An uncertain receipt never authorizes a reload. A later native-ready
        // or explicit safe-state transition can retry this pending build event.
      }
    })()
    return () => { if (snapshotProbeRef.current === probe) snapshotProbeRef.current = null }
  }, [studioShell, viewerIsReady, completedBuildKey, completedBuildSnapshot?.presentationId,
    templateModeOn, activeVersion, sessionId, deckOwnerSessionId, presentationId,
    renderSlideMutationOwner, buildSnapshotRevision, approvedPresentationUrl,
    isEditMode, isSaving, saveStatus, isSlideMutationPending, composeJobs.length,
    nativeSnapshotSafetyRevision, nativeReadySource])
  useEffect(() => {
    if (!studioShell || !viewerIsReady || !studioWorkflowRequest || handledWorkflowRef.current === studioWorkflowRequest.key) return
    handledWorkflowRef.current = studioWorkflowRequest.key
    if (studioWorkflowRequest.action === 'master') setShowPresentationSettings(true)
    if (studioWorkflowRequest.action === 'theme' && !templateModeOn) setShowThemePanel(true)
    if (studioWorkflowRequest.action === 'templates' && templateBuilderEnabled) {
      setToolbarTemplateMenuOpen(true)
      setToolbarTemplatePickerOpen(!templateSelectionLocked)
    }
  }, [studioShell, viewerIsReady, studioWorkflowRequest, templateBuilderEnabled, templateSelectionLocked, templateModeOn])

  // Theme — read from next-themes (canonical theme source, shared with
  // the profile-menu's "Dark Mode" toggle). Used inside the Mode dropdown.
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    onSlideChangeRef.current = onSlideChange
  }, [onSlideChange])
  const partialNativeReadbackRef = useRef(onStudioPartialNativeReadback)
  useEffect(() => { partialNativeReadbackRef.current = onStudioPartialNativeReadback }, [onStudioPartialNativeReadback])
  const partialLogicalTargetKey = JSON.stringify([studioOwnerUserId, sessionId, deckOwnerSessionId, presentationId])
  const partialLogicalTargetRef = useRef(partialLogicalTargetKey)
  useLayoutEffect(() => {
    const changed = partialLogicalTargetRef.current !== partialLogicalTargetKey
    partialLogicalTargetRef.current = partialLogicalTargetKey
    if (!studioShell || !studioPartialArtifact || !changed) return
    // A's retained counters cannot serve as a minimum for newly admitted B.
    // The existing poll supplies B's real count; progress never supplies it.
    setTotalSlides(0); setVisualTotalSlides(0); setCurrentSlide(1)
    lastSlideInfoRef.current = null
  }, [studioShell, studioPartialArtifact, partialLogicalTargetKey])

  // Sync totalSlides with slideCount prop changes
  const slideCountPresentationUrlRef = useRef(presentationUrl)
  useEffect(() => {
    if (slideCount && slideCount > 0) {
      const presentationChanged = slideCountPresentationUrlRef.current !== presentationUrl
      slideCountPresentationUrlRef.current = presentationUrl
      setTotalSlides(prev => {
        const next = presentationChanged ? slideCount : Math.max(prev, slideCount)
        if (prev === next) return prev
        debugLog(`📊 Updating totalSlides: ${prev} → ${next}`)
        return next
      })
      setVisualTotalSlides(prev => presentationChanged ? slideCount : Math.max(prev, slideCount))
    }
  }, [presentationUrl, slideCount])

  // Reset CRUD modification flag when fresh slideStructure arrives from WebSocket
  useEffect(() => {
    if (slideStructure?.slides) {
      setSlidesModifiedByCrud(false)
      debugLog('📡 Fresh slideStructure received, reset CRUD flag')
    }
  }, [slideStructure])

  // Reset readiness for every exact iframe navigation, including notes and
  // fullscreen query-string rewrites, before that frame can report its load.
  useLayoutEffect(() => {
    debugLog('🔄 Presentation iframe navigation changed, resetting readiness')
    setIframeReady(false)
    setLoadedApprovedNavigationUrl(null)
    setPollingFailureCount(0)
    lastSlideInfoRef.current = null
  }, [approvedIframeNavigationUrl])

  useEffect(() => {
    if (viewerUrlDecision.status !== 'blocked') return

    setIframeReady(false)
    setLoadedApprovedNavigationUrl(null)
    console.error('[LayoutViewerPolicy] Blocked presentation viewer URL', {
      source: 'presentation_viewer',
      origin: viewerUrlDecision.origin,
      reason: viewerUrlDecision.reason,
      allowedOrigins: LAYOUT_VIEWER_URL_POLICY.allowedOrigins,
    })
  }, [viewerUrlDecision])

  // Handle iframe load event
  const handleIframeLoad = useCallback((event: React.SyntheticEvent<HTMLIFrameElement>) => {
    if (studioShell && event.currentTarget !== iframeRef.current) return
    const loadedUrl = event.currentTarget.src
    if (!approvedIframeNavigationUrl || loadedUrl !== approvedIframeNavigationUrl) {
      if (studioShell) {
        studioComposeLoadedFrameRef.current = null
        studioNativeMutationPublicationRef.current = null
        slideMutationRequestRef.current = null
        slideMutationPendingRef.current = false
        studioDeleteDialogRef.current = null
        studioManualSlideNavigationRef.current = null
        setIsSlideMutationPending(false)
        setIsDeleting(false)
        setShowDeleteDialog(false)
        setSlidesToDelete(null)
      }
      setIframeReady(false)
      setLoadedApprovedNavigationUrl(null)
      return
    }
    debugLog('✅ Iframe loaded and ready')
    if (studioShell) {
      // Even an identical URL is a fresh native frame lifetime.
      const retiredNativeRequest = slideMutationRequestRef.current
      studioComposeLoadRevisionRef.current += 1
      studioComposeLoadedFrameRef.current = { iframe: event.currentTarget, source: loadedUrl,
        nativeWindow: event.currentTarget.contentWindow, revision: studioComposeLoadRevisionRef.current }
      slideMutationOwnerRef.current = { ...slideMutationOwnerRef.current,
        generation: slideMutationOwnerRef.current.generation + 1 }
      slideMutationRequestRef.current = null
      slideMutationPendingRef.current = false
      studioNativeMutationPublicationRef.current = null
      studioDeleteDialogRef.current = null
      studioManualSlideNavigationRef.current = null
      studioSaveRequestRef.current = null
      setIsSaving(false)
      setIsSlideMutationPending(false)
      setIsDeleting(false)
      setShowDeleteDialog(false)
      setSlidesToDelete(null)
      setNativeSnapshotSafetyRevision(value => value + 1)
      // Layout's existing CRUD handlers reload before ACK. Warn promptly,
      // once, without claiming success or borrowing this new frame's data.
      retiredNativeRequest?.reportUnconfirmed?.()
    }
    setLoadedApprovedNavigationUrl(loadedUrl)
    setIframeReady(true)
    setPollingFailureCount(0) // Reset failure count on load
    lastSlideInfoRef.current = null
  }, [approvedIframeNavigationUrl, studioShell])

  // F8/S-03 (flag NEXT_PUBLIC_STUDIO_RAIL_SLIDE_IDENTITY_ENABLED, default off): when Layout serves
  // its slide inventory, the rail is keyed by slide_id and reads previews from it. `rows` stays null
  // (today's path below, untouched) whenever the flag is off or the endpoint is absent.
  const railIdentityStructure = useMemo(
    () => !slidesModifiedByCrud && Array.isArray(slideStructure?.slides) ? slideStructure.slides as unknown[] : null,
    [slideStructure, slidesModifiedByCrud],
  )
  // A content signature, not the object: the prop defaults to a fresh `{}` on every render.
  const railThumbnailFrames = useMemo(() => STUDIO_RAIL_SLIDE_IDENTITY_ENABLED ? JSON.stringify(thumbnailUrlsBySlide) : '', [thumbnailUrlsBySlide])
  const { rows: railIdentityRows, refresh: refreshSlideRail } = useSlideRailIdentity({
    enabled: STUDIO_RAIL_SLIDE_IDENTITY_ENABLED && studioShell && Boolean(approvedPresentationUrl),
    presentationId,
    ownerUserId: studioOwnerUserId,
    structureSlides: railIdentityStructure,
    refreshSignals: [totalSlides, railThumbnailFrames],
  })
  slideRailRefreshRef.current = refreshSlideRail

  // Extract slide thumbnails from slideStructure
  // Use totalSlides when: CRUD ops occurred, OR slideStructure is stale/missing
  const slideThumbnails = useMemo<SlideThumbnail[]>(() => {
    if (railIdentityRows) return railIdentityRows
    if (studioShell && studioCanonicalThumbnails
      && studioCanonicalThumbnails.owner === renderSlideMutationOwner
      && studioCanonicalThumbnails.nativeRevision === thumbnailNativeRevisionRef.current
      && studioCanonicalThumbnails.metadataRevision === thumbnailMetadataRef.current.revision
      && studioCanonicalThumbnails.rows.length === totalSlides) {
      return applyStageFThumbnailUrls(studioCanonicalThumbnails.rows, thumbnailUrlsBySlide)
    }
    // Detect if slideStructure count doesn't match totalSlides (stale data)
    const structureCountMismatch = slideStructure?.slides &&
      totalSlides > 0 &&
      slideStructure.slides.length !== totalSlides

    // Use totalSlides when: CRUD modified, count mismatch, or no structure
    if (slidesModifiedByCrud || structureCountMismatch || !slideStructure || !slideStructure.slides) {
      if (totalSlides > 0) {
        const fallbackSlides: SlideThumbnail[] = Array.from({ length: totalSlides }, (_, i) => ({
          slideNumber: i + 1,
          title: `Slide ${i + 1}`,
        }))
        return applyStageFThumbnailUrls(fallbackSlides, thumbnailUrlsBySlide)
      }
      return []
    }

    // slideStructure is fresh and matches totalSlides - use rich data
    const structureSlides: SlideThumbnail[] = slideStructure.slides.map((slide: any, index: number) => {
      const slideIndex = Number(slide.slide_index)
      const actualSlideIndex = Number(slide.actual_slide_index ?? slide.real_slide_index)
      return {
        slideNumber: index + 1,
        slideId: slide.slide_id || slide.id || null,
        slideIndex: Number.isInteger(slideIndex) && slideIndex >= 0 ? slideIndex : index,
        actualSlideIndex: Number.isInteger(actualSlideIndex) && actualSlideIndex >= 0 ? actualSlideIndex : undefined,
        title: slide.title || slide.slide_type || `Slide ${index + 1}`,
        content: slide.narrative || slide.key_points?.join(', '),
        // Retain a supplied image on restored Studio metadata; live StageF
        // images below still take precedence. This does not generate an image.
        thumbnailUrl: studioShell ? ownedRestoredThumbnailUrl(slide, presentationId) : undefined,
      }
    })
    return applyStageFThumbnailUrls(structureSlides, thumbnailUrlsBySlide)
  }, [railIdentityRows, slideStructure, totalSlides, slidesModifiedByCrud, thumbnailUrlsBySlide, studioShell, presentationId, studioCanonicalThumbnails, renderSlideMutationOwner])

  // Define handlers FIRST (before effects that use them)
  const handleNextSlide = useCallback(async () => {
    debugLog('🔘 Next button clicked!')
    const navigation = beginStudioManualSlideNavigation(currentSlide)
    const interaction = studioShell ? beginStudioViewerInteraction() : null
    if (studioShell && snapshotSelectionRef.current) {
      navigation?.cancel()
      const next = Math.min(Math.max(1, totalSlides || currentSlide), snapshotCurrentSlideRef.current + 1)
      snapshotSelectionRef.current.index = next - 1
      setCurrentSlide(next)
      onSlideChangeRef.current?.(next)
      return
    }
    if (!iframeRef.current) {
      navigation?.cancel()
      debugLog('❌ Iframe not ready')
      return
    }
    try {
      await sendCommand(interaction?.iframe ?? iframeRef.current, 'nextSlide')
      if (interaction && !interaction.isCurrent()) { navigation?.cancel(); return }
      void navigation?.capture()
      // Immediately update local state (polling will confirm/sync)
      const navigationTotal = Math.max(visualTotalSlides || 0, totalSlides || 0, currentSlide)
      if (currentSlide < (navigationTotal || 999)) {
        const newSlide = currentSlide + 1
        setCurrentSlide(newSlide)
        onSlideChange?.(newSlide)
        debugLog(`➡️ Next slide (${currentSlide} → ${newSlide})`)
      }
    } catch (error) {
      navigation?.cancel()
      console.error('Error navigating to next slide:', error)
    }
  }, [currentSlide, totalSlides, visualTotalSlides, onSlideChange, studioShell, beginStudioViewerInteraction, beginStudioManualSlideNavigation])

  const handlePrevSlide = useCallback(async () => {
    debugLog('🔘 Prev button clicked!')
    const navigation = beginStudioManualSlideNavigation(Math.max(0, currentSlide - 2))
    const interaction = studioShell ? beginStudioViewerInteraction() : null
    if (studioShell && snapshotSelectionRef.current) {
      navigation?.cancel()
      const previous = Math.max(1, snapshotCurrentSlideRef.current - 1)
      snapshotSelectionRef.current.index = previous - 1
      setCurrentSlide(previous)
      onSlideChangeRef.current?.(previous)
      return
    }
    debugLog(`   Current slide: ${currentSlide}, Total: ${totalSlides}`)
    debugLog(`   Button should be disabled: ${currentSlide <= 1}`)
    if (!iframeRef.current) {
      navigation?.cancel()
      debugLog('❌ Iframe not ready')
      return
    }
    try {
      debugLog('📤 Sending prevSlide command...')
      await sendCommand(interaction?.iframe ?? iframeRef.current, 'prevSlide')
      if (interaction && !interaction.isCurrent()) { navigation?.cancel(); return }
      void navigation?.capture()
      // Immediately update local state (polling will confirm/sync)
      if (currentSlide > 1) {
        const newSlide = currentSlide - 1
        setCurrentSlide(newSlide)
        onSlideChange?.(newSlide)
        debugLog(`⬅️ Previous slide (${currentSlide} → ${newSlide})`)
      }
    } catch (error) {
      navigation?.cancel()
      console.error('❌ Error navigating to previous slide:', error)
    }
  }, [currentSlide, totalSlides, onSlideChange, studioShell, beginStudioViewerInteraction, beginStudioManualSlideNavigation])

  const handleToggleOverview = useCallback(() => {
    debugLog('🔘 Grid button clicked - toggling thumbnail strip!')
    setShowThumbnails(prev => !prev)
  }, [])

  // Toggle grid overlay via postMessage (fire-and-forget to avoid timeout on hide)
  const handleToggleGrid = useCallback(() => {
    if (!iframeRef.current) return
    const nextActive = !isGridActive
    setIsGridActive(nextActive)
    postCommand(iframeRef.current, nextActive ? 'showGridOverlay' : 'hideGridOverlay')
    debugLog(`📐 Grid overlay: ${nextActive ? 'ON' : 'OFF'}`)
  }, [isGridActive])

  // Toggle border highlight via postMessage
  const handleToggleBorders = useCallback(async () => {
    if (!iframeRef.current) return
    try {
      if (isBordersActive) {
        await sendCommand(iframeRef.current, 'hideBorderHighlight')
      } else {
        await sendCommand(iframeRef.current, 'showBorderHighlight')
      }
      setIsBordersActive(prev => !prev)
      debugLog(`🔲 Borders: ${!isBordersActive ? 'ON' : 'OFF'}`)
    } catch (error) {
      console.error('Error toggling borders:', error)
    }
  }, [isBordersActive])

  // Toggle edit mode via postMessage (button version)
  const handleToggleEditModeButton = useCallback(async (requestedMode?: boolean) => {
    if (!iframeRef.current) return
    try {
      if (studioShell) {
        const interaction = beginStudioViewerInteraction()
        if (!interaction.isCurrent()) return
        const targetIframe = interaction.iframe
        const current = await sendCommand(targetIframe, 'isEditModeActive')
        if (!interaction.isCurrent()) return
        const desired = requestedMode ?? !current.isEditing
        if (desired !== current.isEditing) {
          await sendCommand(targetIframe, desired ? 'enterEditMode' : 'exitEditMode')
          if (!interaction.isCurrent()) return
        }
        const observed = await sendCommand(targetIframe, 'isEditModeActive')
        if (!interaction.isCurrent()) return
        setIsEditMode(Boolean(observed.isEditing))
        onEditModeChange?.(Boolean(observed.isEditing))
        return
      }
      if (isEditMode) {
        await sendCommand(iframeRef.current, 'exitEditMode')
      } else {
        await sendCommand(iframeRef.current, 'enterEditMode')
      }
      setIsEditMode(prev => !prev)
      onEditModeChange?.(!isEditMode)
      debugLog(`✏️ Edit mode: ${!isEditMode ? 'ON' : 'OFF'}`)
    } catch (error) {
      console.error('Error toggling edit mode:', error)
    }
  }, [studioShell, isEditMode, onEditModeChange, beginStudioViewerInteraction])

  // MDC P8 fix: onSlideChange arrives as an inline arrow from the page, so a
  // useCallback keyed on it churns every parent render — and this handler sits
  // in the onApiReady effect's deps, which turned that churn into an
  // onApiReady -> setState -> re-render loop (React #185). Route through the
  // existing effect-synced onSlideChangeRef instead; identity stays stable.
  const handleGoToSlide = useCallback(async (slideIndex: number) => {
    debugLog(`🎯 Navigating to slide ${slideIndex + 1}`)
    const navigation = beginStudioManualSlideNavigation(slideIndex)
    const interaction = studioShell ? beginStudioViewerInteraction() : null
    const nextSlide = slideIndex + 1
    setCurrentSlide(nextSlide)
    onSlideChangeRef.current?.(nextSlide)
    if (snapshotSelectionRef.current) {
      navigation?.cancel()
      snapshotSelectionRef.current.index = Math.max(0, slideIndex)
      return
    }

    if (!iframeRef.current) {
      navigation?.cancel()
      debugLog('❌ Iframe not ready')
      return
    }

    try {
      await sendCommand(interaction?.iframe ?? iframeRef.current, 'goToSlide', { index: slideIndex }, { timeoutMs: 1500 })
      if (interaction && !interaction.isCurrent()) { navigation?.cancel(); return }
      void navigation?.capture()
      debugLog(`✅ Navigated to slide ${slideIndex + 1}`)
    } catch (error) {
      if (interaction && !interaction.isCurrent()) { navigation?.cancel(); return }
      console.warn('goToSlide response timed out; keeping optimistic slide state and sending fallback navigation.', error)
      postCommand(interaction?.iframe ?? iframeRef.current, 'goToSlide', { index: slideIndex })
      void navigation?.capture()
    }
  }, [studioShell, beginStudioViewerInteraction, beginStudioManualSlideNavigation])

  // Poll for slide info updates via postMessage (with exponential backoff)
  useEffect(() => {
    // Don't poll if iframe isn't ready
    if (!viewerHasLoaded) {
      debugLog('⏸️ Polling paused - iframe not ready yet')
      return
    }

    // Stop polling after too many consecutive failures
    const MAX_FAILURES = 10
    if (pollingFailureCount >= MAX_FAILURES) {
      console.warn(`🛑 Polling stopped after ${MAX_FAILURES} consecutive failures`)
      return
    }

    // Exponential backoff: steady-state every 3s, slower after failures.
    const baseInterval = 3000
    const backoffInterval = Math.min(baseInterval * Math.pow(2, pollingFailureCount), 10000)

    const interval = setInterval(async () => {
      if (!iframeRef.current || !viewerHasLoaded) return
      const polledFrame = iframeRef.current
      const polledOwner = renderSlideMutationOwner
      const polledNavigationRevision = studioSlideNavigationRevisionRef.current
      const partialFrame = studioShell && studioPartialArtifact ? captureStudioNativeSlideFrame() : null
      // This receipt's read origin stays excluded after Add releases its busy
      // lease; it may already contain Add's self-selected native index.
      const polledDuringManualAdd = slideMutationRequestRef.current?.operation === 'add'
        && studioManualSlideNavigationRef.current?.revision === polledNavigationRevision
      const selectionIsCurrent = () => !studioShell || (
        !polledDuringManualAdd && studioSlideNavigationRevisionRef.current === polledNavigationRevision
        && !(slideMutationRequestRef.current?.operation === 'add'
          && studioManualSlideNavigationRef.current?.revision === polledNavigationRevision)
      )

      try {
        const hasComposeJobs = composeJobs.length > 0
        const result = hasComposeJobs
          ? await sendCommand(polledFrame, 'composeGetState')
          : await sendCommand(polledFrame, 'getCurrentSlideInfo')
        if (iframeRef.current !== polledFrame || slideMutationOwnerRef.current !== polledOwner) return
        if (partialFrame?.isCurrent() && selectionIsCurrent() && presentationId) {
          // Read only the existing native response. Do not use retained totals,
          // typed build counts or a fallback floor as native count authority.
          const order = hasComposeJobs ? parseStudioNativeSlideOrder(result) : null
          const navigation = hasComposeJobs || result.success !== true ? null : resolveSlideViewerNavigationInfo(result)
          const nativeCount = order?.nativeCount ?? navigation?.totalSlides
          const nativeIndex = order?.currentVisualIndex ?? navigation?.currentVisualIndex
          if (nativeCount !== undefined && nativeIndex !== undefined && partialFrame.isCurrent()) {
            let retiredReadback = false
            const readbackIsCurrent = () => {
              if (!partialFrame.isCurrent() || !selectionIsCurrent()) retiredReadback = true
              return !retiredReadback
            }
            partialNativeReadbackRef.current?.({ presentationId, presentationUrl,
              nativeCount, currentVisualIndex: nativeIndex,
              kind: order ? 'real_order' : 'navigation', isFrameCurrent: partialFrame.isCurrent,
              isCurrent: readbackIsCurrent })
          }
        }
        if (result.success && (result.data || hasComposeJobs)) {
          const data = result.data ?? result
          const pendingSelection = snapshotSelectionRef.current
          if (pendingSelection && pendingSelection.source === approvedIframeNavigationUrl
            && iframeRef.current && resolveSlideViewerNavigationInfo(result)) {
            if (pendingSelection.restoring) return
            pendingSelection.restoring = true
            try {
              const frame = iframeRef.current
              const info = resolveSlideViewerNavigationInfo(result)!
              const requestedIndex = pendingSelection.index
              const target = Math.min(requestedIndex, info.totalSlides - 1)
              await sendCommand(frame, 'goToSlide', { index: target })
              if (iframeRef.current !== frame || slideMutationOwnerRef.current !== polledOwner) return
              const observed = resolveSlideViewerNavigationInfo(await sendCommand(frame, 'getCurrentSlideInfo'))
              if (iframeRef.current !== frame || slideMutationOwnerRef.current !== polledOwner
                || snapshotSelectionRef.current !== pendingSelection || pendingSelection.index !== requestedIndex
                || observed?.currentVisualIndex !== target) return
              snapshotSelectionRef.current = null
              if (isGridActive) postCommand(frame, 'showGridOverlay')
              if (isBordersActive) postCommand(frame, 'showBorderHighlight')
              setCurrentSlide(target + 1)
              onSlideChangeRef.current?.(target + 1)
              setNativeReadySource(approvedIframeNavigationUrl)
              return
            } finally {
              pendingSelection.restoring = false
            }
          }
          if (studioShell && resolveSlideViewerNavigationInfo(result)) setNativeReadySource(approvedIframeNavigationUrl)
          const verifiedMinimumTotal = Math.max(0, totalSlides || 0, slideCount || 0)
          const {
            currentVisualIndex,
            realTotal: resolvedRealTotal,
            visualTotal: resolvedVisualTotal,
          } = resolveSlideComposeViewerState(data, verifiedMinimumTotal)
          const total = Math.max(resolvedRealTotal, verifiedMinimumTotal)
          const visualTotal = Math.max(resolvedVisualTotal, total)
          const slideNum = currentVisualIndex + 1 // Convert 0-based to 1-based
          const previous = lastSlideInfoRef.current
          const slideInfoChanged = !previous ||
            previous.slide !== slideNum ||
            previous.total !== total ||
            previous.visualTotal !== visualTotal

          if (slideInfoChanged) {
            debugLog(`📊 Slide info: ${slideNum} / ${visualTotal} visual (${total} real)`)
            // An older poll, or Add's own native self-navigation while a later
            // explicit choice is being restored, cannot supersede that choice.
            if (selectionIsCurrent()) {
              lastSlideInfoRef.current = { slide: slideNum, total, visualTotal }
              setCurrentSlide(prev => selectionIsCurrent() && prev !== slideNum ? slideNum : prev)
            }
            setTotalSlides(prev => prev === total ? prev : total)
            setVisualTotalSlides(prev => prev === visualTotal ? prev : visualTotal)
            if (selectionIsCurrent()) onSlideChangeRef.current?.(slideNum)
          }

          // Reset failure count on success
          setPollingFailureCount(prev => prev === 0 ? prev : 0)
        }
      } catch (error) {
        // Increment failure count and apply backoff
        setPollingFailureCount(prev => prev + 1)
        debugLog(`⏸️ Polling failed (attempt ${pollingFailureCount + 1}/${MAX_FAILURES})`)
      }
    }, backoffInterval)

    return () => clearInterval(interval)
  }, [composeJobs.length, pollingFailureCount, slideCount, totalSlides, viewerHasLoaded,
    approvedIframeNavigationUrl, renderSlideMutationOwner, isGridActive, isBordersActive,
    studioPartialArtifact, captureStudioNativeSlideFrame, presentationId, presentationUrl])

  // Force save handler (for Ctrl+S and retry on error)
  // IMPORTANT: Must be declared BEFORE the keyboard shortcuts useEffect that references it
  const handleForceSave = useCallback(async () => {
    if (!iframeRef.current) return
    const interaction = studioShell ? beginStudioViewerInteraction() : null
    const request = {}
    if (studioShell) studioSaveRequestRef.current = request
    const isCurrent = () => !studioShell || (studioSaveRequestRef.current === request && !!interaction?.isSourceCurrent())
    setSaveStatus('saving')
    try {
      await sendCommand(interaction?.iframe ?? iframeRef.current, 'forceSave')
      if (!isCurrent()) return
      setSaveStatus('saved')
      debugLog('💾 Force save completed')
    } catch (error) {
      if (!isCurrent()) return
      console.error('Error forcing save:', error)
      setSaveStatus('error')
    } finally {
      if (studioSaveRequestRef.current === request) studioSaveRequestRef.current = null
    }
  }, [studioShell, beginStudioViewerInteraction])

  // Keyboard shortcuts (handlers are now defined above)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!iframeRef.current) return
      if (isGenerating) return
      if (studioShell && !shouldHandleStudioCanvasShortcut(e)) return

      // Only handle if not in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // A4: the view-only Present frame owns the keyboard. Arrow keys are forwarded to it;
      // nothing reaches the editing frame underneath (no E / G / B / Ctrl+S while presenting).
      if (presentViewOnlyActiveRef.current) {
        const command = presentNavigationCommand(e.key)
        if (command) {
          e.preventDefault()
          postCommand(presentFrameRef.current, command)
        }
        return
      }

      // Ctrl+S / Cmd+S - Force save (in edit mode)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (isEditMode) {
          handleForceSave()
        }
        return
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          handleNextSlide()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          handlePrevSlide()
          break
        case 'Escape':
          e.preventDefault()
          handleToggleOverview()
          break
        case 'g':
        case 'G':
          e.preventDefault()
          handleToggleGrid()
          break
        case 'b':
        case 'B':
          e.preventDefault()
          handleToggleBorders()
          break
        case 'e':
        case 'E':
          e.preventDefault()
          handleToggleEditModeButton()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNextSlide, handlePrevSlide, handleToggleOverview, isEditMode, handleForceSave, handleToggleGrid, handleToggleBorders, handleToggleEditModeButton, isGenerating, studioShell])

  // Lazy edit mode: automatically enter edit mode when needed
  const ensureEditMode = useCallback(async (
    expectedIframe?: HTMLIFrameElement,
    isCurrent?: () => boolean,
  ): Promise<boolean> => {
    const interaction = studioShell && !isCurrent ? beginStudioViewerInteraction() : null
    const isAccepted = () => (!interaction || interaction.isCurrent()) && (!isCurrent || isCurrent())
    if (!isAccepted()) return false
    // Studio must also observe native E/Escape exits made inside the iframe.
    if (!studioShell && isEditMode) return true

    if (!iframeRef.current) {
      debugLog('❌ Iframe not ready for edit mode')
      return false
    }

    try {
      const targetIframe = expectedIframe ?? interaction?.iframe ?? iframeRef.current
      // Native E can enter editing before the parent has received a selection.
      // Adopt that state instead of toggling the already-active renderer off.
      const nativeState = studioShell
        ? await sendCommand(targetIframe, 'isEditModeActive')
        : null
      if (!isAccepted()) return false
      const result = nativeState?.isEditing
        ? nativeState
        : await sendCommand(targetIframe, studioShell ? 'enterEditMode' : 'toggleEditMode')
      if (!isAccepted()) return false
      if (result.isEditing) {
        setIsEditMode(true)
        onEditModeChange?.(true)
        debugLog('✏️ Auto-entered edit mode')
        return true
      }
      return false
    } catch (error) {
      console.error('Error entering edit mode:', error)
      return false
    }
  }, [studioShell, isEditMode, onEditModeChange, beginStudioViewerInteraction])

  const handleSaveChanges = useCallback(async () => {
    if (!iframeRef.current) return
    const interaction = studioShell ? beginStudioViewerInteraction() : null
    const request = {}
    if (studioShell) studioSaveRequestRef.current = request
    const isCurrent = () => !studioShell || (studioSaveRequestRef.current === request && !!interaction?.isSourceCurrent())
    setIsSaving(true)
    try {
      await sendCommand(interaction?.iframe ?? iframeRef.current, 'saveAllChanges')
      if (!isCurrent()) return
      debugLog('💾 Changes saved successfully')

      // Exit edit mode after saving
      setIsEditMode(false)
      onEditModeChange?.(false)
    } catch (error) {
      if (!isCurrent()) return
      console.error('Error saving changes:', error)
      alert('Failed to save changes. Please try again.')
    } finally {
      if (isCurrent()) setIsSaving(false)
      if (studioSaveRequestRef.current === request) studioSaveRequestRef.current = null
    }
  }, [onEditModeChange, studioShell, beginStudioViewerInteraction])

  const handleCancelEdits = useCallback(async () => {
    if (!iframeRef.current) return

    // Confirm before canceling
    if (!confirm('Are you sure you want to discard all changes?')) {
      return
    }
    const interaction = studioShell ? beginStudioViewerInteraction() : null
    try {
      await sendCommand(interaction?.iframe ?? iframeRef.current, 'cancelEdits')
      if (interaction && !interaction.isCurrent()) return
      setIsEditMode(false)
      onEditModeChange?.(false)
      debugLog('🚫 Edits canceled')
    } catch (error) {
      console.error('Error canceling edits:', error)
    }
  }, [onEditModeChange, studioShell, beginStudioViewerInteraction])

  // Add slide handler
  const handleAddSlide = useCallback(async (layoutId: SlideLayoutType) => {
    const expectedOwner = renderSlideMutationOwner
    const expectedMountGeneration = slideMutationMountRef.current.generation
    const capturedFrame = studioShell ? captureStudioNativeSlideFrame() : null
    if (studioShell && (
      !slideMutationMountRef.current.active
      || slideMutationOwnerRef.current !== expectedOwner
      || !capturedFrame
    )) return
    const pendingRequest = slideMutationRequestRef.current
    if (studioShell && pendingRequest && (
      pendingRequest.owner !== expectedOwner
      || pendingRequest.mountGeneration !== expectedMountGeneration
      || pendingRequest.iframe !== iframeRef.current
      || pendingRequest.isCurrent?.() === false
    )) {
      slideMutationRequestRef.current = null
      slideMutationPendingRef.current = false
    }
    // State updates are asynchronous; the ref closes the same-tick duplicate
    // click window before SlideLayoutPicker can repaint its disabled state.
    if (slideMutationPendingRef.current) return
    const iframe = capturedFrame?.iframe ?? iframeRef.current
    if (!iframe) {
      toast({
        title: 'Error',
        description: 'Presentation not ready',
        variant: 'destructive'
      })
      return
    }

    const navigationRevision = studioSlideNavigationRevisionRef.current
    let addDispatched = false
    let committedSlideNumber: number | null = null
    let reportedRetirement = false
    const request = { owner: expectedOwner, mountGeneration: expectedMountGeneration, iframe,
      operation: 'add' as const, isCurrent: () => false, reportUnconfirmed: () => {} }
    const isCurrentSlideMutation = () => !studioShell || (
      studioNativeMutationPublicationRef.current === request && capturedFrame?.isCurrent() === true
    )
    const isCurrentSlideSelection = () => isCurrentSlideMutation()
      && (!studioShell || studioSlideNavigationRevisionRef.current === navigationRevision)
    const commit = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
      if (!studioShell) { setter(value); return }
      if (isCurrentSlideMutation()) setter(previous => isCurrentSlideMutation() ? value : previous)
    }
    const commitSelection = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
      if (!studioShell) { setter(value); return }
      if (isCurrentSlideSelection()) setter(previous => isCurrentSlideSelection() ? value : previous)
    }
    const reportRetiredAdd = () => {
      if (!studioShell || !addDispatched || reportedRetirement
        || studioNativeMutationIntentRef.current !== request || !capturedFrame?.isLogicalCurrent()
        || iframeRef.current?.src !== expectedOwner.source) return
      reportedRetirement = true
      toast({ title: 'Check slide result',
        description: 'The slide result could not be confirmed. Check the slide list before trying again; do not add it again merely to recover the acknowledgement.',
        variant: 'destructive' })
    }
    request.isCurrent = isCurrentSlideMutation
    request.reportUnconfirmed = reportRetiredAdd
    if (studioShell) {
      studioNativeMutationPublicationRef.current = request
      studioNativeMutationIntentRef.current = request
      studioManualSlideNavigationRef.current = null
      slideMutationRequestRef.current = request
    }
    slideMutationPendingRef.current = true
    if (studioShell) nativeSnapshotStructureEditedRef.current = true
    commit<boolean>(setIsSlideMutationPending, true)
    const capturedNativeRevision = thumbnailNativeRevisionRef.current
    const capturedMetadataRevision = thumbnailMetadataRef.current.revision
    const invalidateThumbnails = studioShell ? captureThumbnailInvalidation(false) : () => {}
    let commitThumbnailMutation: ReturnType<StudioThumbnailMutationCapture> | undefined
    const isCurrentThumbnailProof = () => isCurrentSlideMutation()
      && capturedNativeRevision === thumbnailNativeRevisionRef.current
      && capturedMetadataRevision === thumbnailMetadataRef.current.revision
    // These reads are optional evidence for unchanged metadata. A refused read
    // never blocks Add, retries its mutation, or substitutes an invented ID.
    const readNativeOrder = async () => {
      try {
        if (!isCurrentSlideMutation()) { reportRetiredAdd(); return null }
        const receipt = await sendCommand(iframe, 'composeGetState', {}, {
          timeoutMs: READ_LAYOUT_COMMAND_TIMEOUT_MS,
        })
        return isCurrentSlideMutation() ? parseStudioNativeSlideOrder(receipt) : null
      } catch { return null }
    }
    const restoreManualSlideSelection = async (expectedTotal: number) => {
      const manual = studioManualSlideNavigationRef.current
      const active = () => isCurrentSlideMutation() && !!manual
        && manual.iframe === iframe && manual.isCurrent()
      if (!active() || !manual) return false
      const selectedId = await manual.selectedId
      if (!selectedId || !active()) return false
      const before = await readNativeOrder()
      if (!active() || !before || before.nativeCount !== expectedTotal) return false
      const index = before.slideIds.indexOf(selectedId)
      if (index < 0) return false
      try {
        if (before.currentVisualIndex !== index) {
          // Existing navigation only: the ID was observed at the user's own
          // selection, and this exact current order proves its new index.
          if (!active()) return false
          await sendCommand(iframe, 'goToSlide', { index })
          if (!active()) return false
        }
        const after = await readNativeOrder()
        if (!active() || !after || after.nativeCount !== expectedTotal
          || after.slideIds[index] !== selectedId || after.currentVisualIndex !== index) return false
        setCurrentSlide(previous => active() ? index + 1 : previous)
        setSelectedSlideIndices(previous => active() ? [index] : previous)
        if (!active()) return false
        onSlideChangeRef.current?.(index + 1)
        return active()
      } catch { return false }
    }
    const proofOwner = {
      userId: expectedOwner.userId ?? '', sessionId: expectedOwner.sessionId ?? '',
      presentationId: expectedOwner.presentationId ?? '', source: expectedOwner.source ?? '',
      activeVersion: expectedOwner.activeVersion, epoch: expectedOwner.generation,
    }
    let beforeOrder: ReturnType<typeof parseStudioNativeSlideOrder> = null
    let provenRows: SlideThumbnail[] | null = null
    let thumbnailCapture: StudioSlideThumbnailCapture | null = null
    let thumbnailCacheRetired = false
    try {
      commitThumbnailMutation = studioShell && expectedOwner.presentationId
        ? onThumbnailMutationCapture?.(expectedOwner.presentationId, expectedOwner) : undefined
      if (!isCurrentSlideMutation()) { reportRetiredAdd(); return }
      if (studioShell && commitThumbnailMutation && expectedOwner.deckOwnerSessionId === expectedOwner.sessionId) {
        beforeOrder = await readNativeOrder()
        if (!isCurrentSlideMutation()) { reportRetiredAdd(); return }
        if (beforeOrder && isCurrentThumbnailProof()) {
          const rows = studioCanonicalThumbnails?.owner === expectedOwner
            && studioCanonicalThumbnails.nativeRevision === capturedNativeRevision
            && studioCanonicalThumbnails.metadataRevision === capturedMetadataRevision
            ? studioCanonicalThumbnails.rows
            : !slidesModifiedByCrud && Array.isArray(slideStructure?.slides)
              ? slideStructure.slides.map((slide: any, index: number) => ({
                  slideNumber: index + 1, slideIndex: index,
                  actualSlideIndex: index, slideId: slide.slide_id || slide.id || null,
                  title: slide.title || slide.slide_type || `Slide ${index + 1}`,
                  content: slide.narrative || slide.key_points?.join(', '),
                  thumbnailUrl: ownedRestoredThumbnailUrl(slide, presentationId),
                })) : []
          const capture = { owner: proofOwner, nativeCount: beforeOrder.nativeCount,
            nativeRevision: capturedNativeRevision, metadataRevision: capturedMetadataRevision }
          if (canAdmitStudioSlideThumbnailMetadata({ captured: capture, current: capture,
            rows, nativeSlideIds: beforeOrder.slideIds })) {
            provenRows = rows
            thumbnailCapture = capture
          }
        }
      }
      const mutationId = createLayoutMutationId('add-slide')
      const result = await sendLayoutMutationWithReconciliation(
        (action, params) => {
          if (!isCurrentSlideMutation()) throw new Error('Native Add frame retired')
          if (action === 'addSlide') addDispatched = true
          return sendCommand(iframe, action, params, {
            timeoutMs: action === 'getElementMutationReceipt'
              ? READ_LAYOUT_COMMAND_TIMEOUT_MS
              : MUTATING_LAYOUT_COMMAND_TIMEOUT_MS,
          })
        },
        'addSlide',
        {
          layout: layoutId,
          position: currentSlide, // Insert after current slide (0-based in iframe)
        },
        mutationId,
        { attempts: 12, delayMs: 250 },
      )
      if (!isCurrentSlideMutation()) { reportRetiredAdd(); return }

      if (result.success) {
        // Backend sends slide_index and slide_count directly (not nested in data)
        const resultData = recordValue(result.data)
        const candidateSlideIndex = result.slide_index
          ?? result.slideIndex
          ?? resultData?.slide_index
          ?? resultData?.slideIndex
        const candidateSlideCount = result.slide_count
          ?? result.slideCount
          ?? resultData?.slide_count
          ?? resultData?.slideCount
        const newSlideIndex = typeof candidateSlideIndex === 'number' && Number.isFinite(candidateSlideIndex)
          ? candidateSlideIndex
          : currentSlide
        const newTotal = typeof candidateSlideCount === 'number' && Number.isFinite(candidateSlideCount)
          ? candidateSlideCount
          : totalSlides + 1
        const newSlideNumber = newSlideIndex + 1
        committedSlideNumber = newSlideNumber

        if (studioShell && capturedNativeRevision === thumbnailNativeRevisionRef.current) {
          // Do not display old-index images while the post-ACK identity read waits.
          setStudioCanonicalThumbnails(previous => isCurrentSlideMutation()
            && thumbnailNativeRevisionRef.current === capturedNativeRevision ? null : previous)
          if (commitThumbnailMutation?.fence?.(expectedOwner) !== true) invalidateThumbnails()
          thumbnailCacheRetired = true
        }
        if (!isCurrentSlideMutation()) { reportRetiredAdd(); return }
        commit(setTotalSlides, newTotal)
        slideRailRefreshRef.current() // F8/S-03: re-read the slide inventory after the Add ack
        commitSelection(setCurrentSlide, newSlideNumber) // Update local state (1-based)
        if (studioShell) commitSelection<number[]>(setSelectedSlideIndices, [newSlideIndex])
        // The parent owns the slide index used by Add Element. Publish the
        // authoritative addSlide result before awaiting navigation/edit-mode
        // commands so an immediate Add Blank → Chart cannot target the prior
        // slide while the 3-second viewer poll is still stale.
        if (isCurrentSlideSelection()) onSlideChangeRef.current?.(newSlideNumber)
        if (!isCurrentSlideMutation()) { reportRetiredAdd(); return }
        commit<boolean>(setSlidesModifiedByCrud, true) // Invalidate stale slideStructure
        if (studioShell) {
          let preserved = false
          if (beforeOrder && provenRows && thumbnailCapture && commitThumbnailMutation && isCurrentThumbnailProof()) {
            const afterOrder = await readNativeOrder()
            if (!isCurrentSlideMutation()) { reportRetiredAdd(); return }
            if (afterOrder && isCurrentThumbnailProof()) {
              const plan = planStudioSlideThumbnailMutation({ captured: thumbnailCapture,
                current: thumbnailCapture, mutation: { kind: 'add' },
                acknowledgement: result, verifiedNativeCount: afterOrder.nativeCount })
              const mappedIds = plan.oldIndexByNewIndex.map(oldIndex => oldIndex === null ? null : beforeOrder!.slideIds[oldIndex])
              const order = plan.mode === 'mapped' ? matchStudioNativeAddSlideOrder(mappedIds, afterOrder) : null
              if (order && plan.nativeCount === newTotal) {
                const rows = remapStudioSlideThumbnailRows(provenRows, plan).map((row, index) => ({
                  ...row, slideId: order.slideIds[index],
                })) as SlideThumbnail[]
                thumbnailNativeRevisionRef.current += 1
                const nativeRevision = thumbnailNativeRevisionRef.current
                setStudioCanonicalThumbnails(previous => isCurrentSlideMutation()
                  && thumbnailNativeRevisionRef.current === nativeRevision
                  && thumbnailMetadataRef.current.revision === capturedMetadataRevision
                  ? { owner: expectedOwner, nativeRevision, metadataRevision: capturedMetadataRevision, rows }
                  : previous)
                if (!isCurrentSlideMutation()) { reportRetiredAdd(); return }
                commitThumbnailMutation(expectedOwner, plan)
                preserved = true
              }
            }
          }
          // New Director metadata does not prove the post-Add physical order.
          // Retire old-index previews even when rich metadata proof changed;
          // a newer native revision or a different owner still wins.
          if (!preserved && isCurrentSlideMutation()
            && capturedNativeRevision === thumbnailNativeRevisionRef.current) {
            thumbnailNativeRevisionRef.current += 1
            const retiredNativeRevision = thumbnailNativeRevisionRef.current
            setStudioCanonicalThumbnails(previous => isCurrentSlideMutation()
              && thumbnailNativeRevisionRef.current === retiredNativeRevision ? null : previous)
            if (!thumbnailCacheRetired) invalidateThumbnails()
          }
        }

        let manualSelectionConfirmed = true
        if (isCurrentSlideSelection()) {
          // Navigate iframe to the new slide (PowerPoint/Keynote behavior).
          await sendCommand(iframe, 'goToSlide', { index: newSlideIndex })
          if (!isCurrentSlideMutation()) { reportRetiredAdd(); return }
          if (isCurrentSlideSelection()) {
            // Only the still-current automatic selection owns these editing
            // follow-ups; a later manual slide is not this Add's edit target.
            await sendCommand(iframe, 'toggleBorderHighlight')
            if (!isCurrentSlideMutation()) { reportRetiredAdd(); return }
            if (isCurrentSlideSelection()) {
              if (studioShell) await ensureEditMode(iframe, isCurrentSlideSelection)
              else await ensureEditMode()
            }
          }
        }
        if (!isCurrentSlideMutation()) { reportRetiredAdd(); return }
        if (studioShell && !isCurrentSlideSelection()) {
          manualSelectionConfirmed = await restoreManualSlideSelection(newTotal)
          if (!isCurrentSlideMutation()) { reportRetiredAdd(); return }
        }

        toast({
          title: manualSelectionConfirmed ? 'Slide Added' : 'Slide added; selection not confirmed',
          description: manualSelectionConfirmed ? `New slide inserted at position ${newSlideIndex + 1}`
            : `Slide ${newSlideNumber} was added. Select your slide again; do not add it again.`,
        })

        debugLog(`➕ Added ${layoutId} slide at position ${newSlideIndex + 1}`)
      }
    } catch (error) {
      if (!isCurrentSlideMutation()) { reportRetiredAdd(); return }
      console.error('Error adding slide:', error)
      toast({
        title: committedSlideNumber
          ? 'Slide added; viewer sync delayed'
          : layoutMutationStateIsAmbiguous(error)
            ? 'Check slide result'
            : 'Error',
        description: committedSlideNumber
          ? `Slide ${committedSlideNumber} was added. Reload if the viewer did not navigate to it; do not add it again.`
          : layoutMutationStateIsAmbiguous(error)
            ? 'The slide acknowledgement was delayed. Reload before trying again so a completed slide is not duplicated.'
            : 'Failed to add slide. Please try again.',
        variant: 'destructive'
      })
    } finally {
      if (!studioShell || slideMutationRequestRef.current === request) {
        if (studioShell) slideMutationRequestRef.current = null
        slideMutationPendingRef.current = false
        if (!studioShell) setIsSlideMutationPending(false)
        else setIsSlideMutationPending(previous => studioNativeMutationPublicationRef.current === request
          && capturedFrame?.isLogicalCurrent() === true ? false : previous)
      }
    }
  }, [currentSlide, totalSlides, toast, ensureEditMode, studioShell, renderSlideMutationOwner, captureThumbnailInvalidation,
    onThumbnailMutationCapture, studioCanonicalThumbnails, slideStructure, slidesModifiedByCrud, presentationId, captureStudioNativeSlideFrame])

  // Duplicate slide handler
  const handleDuplicateSlide = useCallback(async (slideIndex: number) => {
    const mutation = beginStudioNativeSlideMutation('duplicate')
    if (!mutation) return
    const invalidateThumbnails = captureThumbnailInvalidation()

    try {
      const result = await sendCommand(mutation.iframe, 'duplicateSlide', {
        index: slideIndex,      // snake_case to match backend
        insert_after: true
      }, studioShell ? { requireRequestId: true } : 5000)
      if (!mutation.isCurrent()) { mutation.reportUnconfirmed('duplicate'); return }

      if (result.success) {
        // Backend sends new_slide_index directly (not nested in data)
        const newSlideIndex = result.new_slide_index ?? result.data?.newSlideIndex ?? slideIndex + 1
        const newTotal = result.slide_count ?? result.data?.slideCount ?? totalSlides + 1

        mutation.commit(setTotalSlides, newTotal)
        mutation.commitSelection(setCurrentSlide, newSlideIndex + 1)
        mutation.commit<boolean>(setSlidesModifiedByCrud, true) // Invalidate stale slideStructure
        invalidateThumbnails()
        if (!mutation.isCurrent()) { mutation.reportUnconfirmed('duplicate'); return }

        toast({
          title: 'Slide Duplicated',
          description: `Slide copied to position ${newSlideIndex + 1}`
        })

        debugLog(`📋 Duplicated slide ${slideIndex + 1} → ${newSlideIndex + 1}`)
      }
    } catch (error) {
      if (!mutation.isCurrent()) { mutation.reportUnconfirmed('duplicate'); return }
      if (studioShell && error instanceof Error && /command timeout/i.test(error.message)) {
        mutation.reportUnconfirmed('duplicate'); return
      }
      console.error('Error duplicating slide:', error)
      toast({
        title: 'Error',
        description: 'Failed to duplicate slide. Please try again.',
        variant: 'destructive'
      })
    } finally { mutation.release() }
  }, [totalSlides, toast, captureThumbnailInvalidation, studioShell, beginStudioNativeSlideMutation])

  // Open delete dialog for single slide
  const handleOpenDeleteDialog = useCallback((slideIndex: number) => {
    const indices = [slideIndex]
    if (studioShell) {
      if (slideMutationPendingRef.current) return
      const frame = captureStudioNativeSlideFrame()
      if (!frame) return
      const intent = viewerInteractionIntentRef.current
      studioDeleteDialogRef.current = { indices, open: true, submitted: false,
        isCurrent: () => frame.isCurrent() && viewerInteractionIntentRef.current === intent }
    }
    setSlidesToDelete(indices)
    setShowDeleteDialog(true)
  }, [studioShell, captureStudioNativeSlideFrame])

  // Open delete dialog for multiple slides (bulk delete)
  const handleOpenBulkDeleteDialog = useCallback((slideIndices: number[]) => {
    if (slideIndices.length === 0) return
    // Cannot delete all slides
    if (slideIndices.length >= totalSlides) {
      toast({
        title: 'Cannot delete all slides',
        description: 'At least one slide must remain in the presentation.',
        variant: 'destructive'
      })
      return
    }
    if (studioShell) {
      if (slideMutationPendingRef.current) return
      const frame = captureStudioNativeSlideFrame()
      if (!frame) return
      const intent = viewerInteractionIntentRef.current
      studioDeleteDialogRef.current = { indices: slideIndices, open: true, submitted: false,
        isCurrent: () => frame.isCurrent() && viewerInteractionIntentRef.current === intent }
    }
    setSlidesToDelete(slideIndices)
    setShowDeleteDialog(true)
  }, [totalSlides, toast, studioShell, captureStudioNativeSlideFrame])

  const renderStudioDeleteDialog = studioDeleteDialogRef.current
  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!studioShell) { setShowDeleteDialog(open); return }
    const dialog = renderStudioDeleteDialog
    if (!dialog || studioDeleteDialogRef.current !== dialog) return
    dialog.open = open
    setShowDeleteDialog(previous => studioDeleteDialogRef.current === dialog ? open : previous)
    // Radix closes its Action after onConfirm. That visibility event must not
    // retire an already dispatched mutation or erase its recovery target.
    if (!open && !dialog.submitted) {
      setSlidesToDelete(previous => studioDeleteDialogRef.current === dialog ? null : previous)
    }
  }, [studioShell, renderStudioDeleteDialog])

  // Confirm delete slide(s) - uses bulk deleteSlides endpoint
  const handleConfirmDelete = useCallback(async () => {
    if (!slidesToDelete || slidesToDelete.length === 0 || !iframeRef.current) return
    const dialog = studioDeleteDialogRef.current
    if (studioShell && (!dialog || !dialog.open || dialog.submitted
      || dialog.indices !== slidesToDelete || !dialog.isCurrent())) return
    const mutation = beginStudioNativeSlideMutation('delete')
    if (!mutation) return
    if (studioShell && dialog) dialog.submitted = true
    const invalidateThumbnails = captureThumbnailInvalidation()

    mutation.commit<boolean>(setIsDeleting, true)
    try {
      debugLog('🗑️ Attempting bulk delete with indices:', slidesToDelete)

      // Use bulk delete endpoint - pass all indices at once
      const result = await sendCommand(mutation.iframe, 'deleteSlides', {
        indices: slidesToDelete  // 0-based indices
      }, studioShell ? { requireRequestId: true } : 5000)
      if (!mutation.isCurrent()) { mutation.reportUnconfirmed('delete'); return }

      debugLog('🗑️ Bulk delete response:', result)

      if (!result.success) {
        // Extract error message from various possible response formats
        const errorMsg = result.message
          || result.error
          || (typeof result.detail === 'string' ? result.detail : null)
          || (result.detail?.msg)
          || JSON.stringify(result)
        throw new Error(errorMsg)
      }

      // Update local state based on response
      const deletedCount = result.deleted_count || slidesToDelete.length
      const remainingCount = result.remaining_slide_count || (totalSlides - deletedCount)

      mutation.commit(setTotalSlides, remainingCount)
      mutation.commit<boolean>(setSlidesModifiedByCrud, true) // Invalidate stale slideStructure
      invalidateThumbnails()
      mutation.commitSelection<number[]>(setSelectedSlideIndices, []) // Clear the mutation's selection after delete

      // Adjust current slide if needed
      if (currentSlide > remainingCount) {
        mutation.commitSelection(setCurrentSlide, remainingCount)
      } else {
        // Find how many deleted slides were before current
        const deletedBefore = slidesToDelete.filter(i => i < currentSlide - 1).length
        if (deletedBefore > 0) {
          mutation.commitSelection(setCurrentSlide, currentSlide - deletedBefore)
        }
      }

      const message = deletedCount === 1
        ? `Slide ${slidesToDelete[0] + 1} has been removed`
        : `${deletedCount} slides have been removed`

      if (!mutation.isCurrent()) { mutation.reportUnconfirmed('delete'); return }

      toast({
        title: deletedCount === 1 ? 'Slide Deleted' : 'Slides Deleted',
        description: message
      })

      debugLog(`🗑️ Bulk deleted ${deletedCount} slide(s), ${remainingCount} remaining`)
    } catch (error) {
      if (!mutation.isCurrent()) { mutation.reportUnconfirmed('delete'); return }
      if (studioShell && error instanceof Error && /command timeout/i.test(error.message)) {
        mutation.reportUnconfirmed('delete'); return
      }
      console.error('Error deleting slides:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete slides. Please try again.',
        variant: 'destructive'
      })
    } finally {
      if (!studioShell) {
        setIsDeleting(false)
        setShowDeleteDialog(false)
        setSlidesToDelete(null)
      } else if (dialog && studioDeleteDialogRef.current === dialog && mutation.isLogicalCurrent()) {
        // Busy belongs to this request, even if its exact frame was retired.
        setIsDeleting(previous => studioDeleteDialogRef.current === dialog && mutation.isLogicalCurrent() ? false : previous)
        if (mutation.isCurrent()) {
          dialog.open = false
          setShowDeleteDialog(previous => studioDeleteDialogRef.current === dialog && mutation.isCurrent() ? false : previous)
          setSlidesToDelete(previous => studioDeleteDialogRef.current === dialog && mutation.isCurrent() ? null : previous)
        }
      }
      mutation.release()
    }
  }, [slidesToDelete, totalSlides, currentSlide, toast, captureThumbnailInvalidation, studioShell, beginStudioNativeSlideMutation])

  // Change slide layout handler
  const handleChangeLayout = useCallback(async (slideIndex: number, newLayout: SlideLayoutType) => {
    const mutation = beginStudioNativeSlideMutation('layout change')
    if (!mutation) return
    const invalidateThumbnails = captureThumbnailInvalidation()

    try {
      const result = await sendCommand(mutation.iframe, 'changeSlideLayout', {
        index: slideIndex,       // snake_case to match backend
        new_layout: newLayout,
        preserve_content: true
      }, studioShell ? { requireRequestId: true } : 5000)
      if (!mutation.isCurrent()) { mutation.reportUnconfirmed('layout change'); return }

      if (result.success) {
        invalidateThumbnails()
        if (!mutation.isCurrent()) { mutation.reportUnconfirmed('layout change'); return }
        toast({
          title: 'Layout Changed',
          description: `Slide ${slideIndex + 1} layout updated`
        })

        debugLog(`🔄 Changed slide ${slideIndex + 1} layout to ${newLayout}`)
      }
    } catch (error) {
      if (!mutation.isCurrent()) { mutation.reportUnconfirmed('layout change'); return }
      if (studioShell && error instanceof Error && /command timeout/i.test(error.message)) {
        mutation.reportUnconfirmed('layout change'); return
      }
      console.error('Error changing layout:', error)
      toast({
        title: 'Error',
        description: 'Failed to change layout. Please try again.',
        variant: 'destructive'
      })
    } finally { mutation.release() }
  }, [toast, captureThumbnailInvalidation, studioShell, beginStudioNativeSlideMutation])

  // Reorder slides handler
  const handleReorderSlides = useCallback(async (fromIndex: number, toIndex: number) => {
    const mutation = beginStudioNativeSlideMutation('reorder')
    if (!mutation) return
    const invalidateThumbnails = captureThumbnailInvalidation()

    try {
      const result = await sendCommand(mutation.iframe, 'reorderSlides', {
        from_index: fromIndex,   // snake_case to match backend
        to_index: toIndex
      }, studioShell ? { requireRequestId: true } : 5000)
      if (!mutation.isCurrent()) { mutation.reportUnconfirmed('reorder'); return }

      if (result.success) {
        // Update current slide if it was moved
        if (currentSlide === fromIndex + 1) {
          mutation.commitSelection(setCurrentSlide, toIndex + 1)
        }
        mutation.commit<boolean>(setSlidesModifiedByCrud, true) // Invalidate stale slideStructure
        invalidateThumbnails()
        if (!mutation.isCurrent()) { mutation.reportUnconfirmed('reorder'); return }

        toast({
          title: 'Slide Moved',
          description: `Slide moved from position ${fromIndex + 1} to ${toIndex + 1}`
        })

        debugLog(`↕️ Moved slide ${fromIndex + 1} → ${toIndex + 1}`)
      }
    } catch (error) {
      if (!mutation.isCurrent()) { mutation.reportUnconfirmed('reorder'); return }
      if (studioShell && error instanceof Error && /command timeout/i.test(error.message)) {
        mutation.reportUnconfirmed('reorder'); return
      }
      console.error('Error reordering slides:', error)
      toast({
        title: 'Error',
        description: 'Failed to reorder slides. Please try again.',
        variant: 'destructive'
      })
    } finally { mutation.release() }
  }, [currentSlide, toast, ensureEditMode, captureThumbnailInvalidation, studioShell, beginStudioNativeSlideMutation])

  // === Layout Service v7.5.3 API Handlers ===

  // Text Formatting handler
  const handleFormatText = useCallback(async (params: FormatTextParams): Promise<boolean> => {
    if (!iframeRef.current) {
      toast({
        title: 'Error',
        description: 'Presentation not ready',
        variant: 'destructive'
      })
      return false
    }

    try {
      const result = await sendCommand(iframeRef.current, 'formatText', params)
      if (result.success) {
        debugLog('✏️ Text formatted:', params)
        return true
      }
      return false
    } catch (error) {
      console.error('Error formatting text:', error)
      toast({
        title: 'Format Failed',
        description: 'Select text in the slide first, then apply formatting.',
        variant: 'destructive'
      })
      return false
    }
  }, [toast])

  // Table insertion handler - opens panel for AI table generation
  const handleInsertTable = useCallback(async (rows: number, cols: number): Promise<void> => {
    // Auto-enter edit mode if needed
    if (!await ensureEditMode()) {
      toast({
        title: 'Error',
        description: 'Could not enter edit mode',
        variant: 'destructive'
      })
      return
    }

    // Generate a mock element ID for now (Layout Service will assign real IDs when implemented)
    const mockElementId = `table-${Date.now()}`

    // Create default properties for new table
    const properties: ElementProperties = {
      type: 'table',
      elementId: mockElementId,
      position: { x: 10, y: 20 },
      size: { width: 80, height: 50 },
      rotation: 0,
      locked: false,
      zIndex: 1,
      cols: cols,
      rows: rows,
      hasHeaderRow: true
    }

    // Try to insert via Layout Service if iframe is ready
    if (iframeRef.current) {
      try {
        const result = await sendCommand(iframeRef.current, 'insertTable', {
          componentType: 'TABLE',
          slideIndex: currentSlide - 1,
          gridRow: '5/15',
          gridColumn: '3/30',
          tableHtml: generateTableHTML(rows, cols)
        })

        if (result.success) {
          const elementId = result.elementId || result.data?.elementId
          if (elementId) {
            properties.elementId = elementId
          }
          debugLog(`📊 Table element inserted via Layout Service: ${properties.elementId}`)
        }
      } catch (error) {
        console.warn('Layout Service insertTable not available, showing panel in mock mode:', error)
      }
    }

    // Always show the panel (even in mock mode for UI preview)
    onElementSelected?.(properties.elementId, 'table', properties)
    toast({
      title: 'Table Panel',
      description: `Configure your ${rows}×${cols} table with AI`
    })
  }, [currentSlide, toast, onElementSelected, ensureEditMode])

  // Chart insertion handler - opens panel for AI chart generation
  const handleInsertChart = useCallback(async (params: InsertChartParams): Promise<void> => {
    // Auto-enter edit mode if needed
    if (!await ensureEditMode()) {
      toast({
        title: 'Error',
        description: 'Could not enter edit mode',
        variant: 'destructive'
      })
      return
    }

    // Generate a mock element ID for now (Layout Service will assign real IDs when implemented)
    const mockElementId = `chart-${Date.now()}`
    const chartTypeMap: Record<InsertChartParams['type'], ChartType> = {
      bar: 'bar_vertical',
      line: 'line',
      pie: 'pie',
      doughnut: 'doughnut',
      radar: 'radar',
      polarArea: 'polar_area'
    }

    // Create default properties for new chart
    const properties: ElementProperties = {
      type: 'chart',
      elementId: mockElementId,
      position: { x: 5, y: 15 },
      size: { width: 60, height: 60 },
      rotation: 0,
      locked: false,
      zIndex: 1,
      chartType: chartTypeMap[params.type],
      colorPalette: 'default'
    }

    // Try to insert via Layout Service if iframe is ready
    if (iframeRef.current) {
      try {
        const result = await sendCommand(iframeRef.current, 'insertChart', {
          componentType: 'CHART',
          slideIndex: currentSlide - 1,
          gridRow: '3/16',
          gridColumn: '2/20',
          chartConfig: generateChartConfig(params)
        })

        if (result.success) {
          const elementId = result.elementId || result.data?.elementId
          if (elementId) {
            properties.elementId = elementId
          }
          debugLog(`📈 Chart element inserted via Layout Service: ${properties.elementId}`)
        }
      } catch (error) {
        console.warn('Layout Service insertChart not available, showing panel in mock mode:', error)
      }
    }

    // Always show the panel (even in mock mode for UI preview)
    onElementSelected?.(properties.elementId, 'chart', properties)
    toast({
      title: 'Chart Panel',
      description: `Configure your ${params.type} chart with AI`
    })
  }, [currentSlide, toast, onElementSelected, ensureEditMode])

  // Image insertion handler
  const handleInsertImage = useCallback(async (): Promise<void> => {
    // Auto-enter edit mode if needed
    if (!await ensureEditMode()) {
      toast({
        title: 'Error',
        description: 'Could not enter edit mode',
        variant: 'destructive'
      })
      return
    }

    // Generate a mock element ID for now (Layout Service will assign real IDs when implemented)
    const mockElementId = `image-${Date.now()}`

    // Create default properties for new image
    const properties: ElementProperties = {
      type: 'image',
      elementId: mockElementId,
      position: { x: 25, y: 20 },
      size: { width: 50, height: 50 },
      rotation: 0,
      locked: false,
      zIndex: 1
    }

    // Try to insert via Layout Service if iframe is ready
    if (iframeRef.current) {
      try {
        const result = await sendCommand(iframeRef.current, 'insertImage', {
          componentType: 'IMAGE',
          slideIndex: currentSlide - 1,
          gridRow: '4/14',
          gridColumn: '8/24',
          imageUrl: '', // Placeholder - will be generated via AI
          alt: 'Generated image'
        })

        if (result.success) {
          const elementId = result.elementId || result.data?.elementId
          if (elementId) {
            properties.elementId = elementId
          }
          debugLog(`📷 Image element inserted via Layout Service: ${properties.elementId}`)
        }
      } catch (error) {
        console.warn('Layout Service insertImage not available, showing panel in mock mode:', error)
      }
    }

    // Always show the panel (even in mock mode for UI preview)
    onElementSelected?.(properties.elementId, 'image', properties)
    toast({
      title: 'Image Panel',
      description: 'Configure your AI-generated image'
    })
  }, [currentSlide, toast, onElementSelected, ensureEditMode])

  // Infographic insertion handler
  const handleInsertInfographic = useCallback(async (): Promise<void> => {
    // Auto-enter edit mode if needed
    if (!await ensureEditMode()) {
      toast({
        title: 'Error',
        description: 'Could not enter edit mode',
        variant: 'destructive'
      })
      return
    }

    // Generate a mock element ID for now (Layout Service will assign real IDs when implemented)
    const mockElementId = `infographic-${Date.now()}`

    // Create default properties for new infographic
    const properties: ElementProperties = {
      type: 'infographic',
      elementId: mockElementId,
      position: { x: 5, y: 15 },
      size: { width: 90, height: 70 },
      rotation: 0,
      locked: false,
      zIndex: 1,
      infographicType: 'process'
    }

    // Try to insert via Layout Service if iframe is ready
    if (iframeRef.current) {
      try {
        const result = await sendCommand(iframeRef.current, 'insertInfographic', {
          componentType: 'INFOGRAPHIC',
          slideIndex: currentSlide - 1,
          gridRow: '3/16',
          gridColumn: '2/31',
          infographicType: 'process' // Default type
        })

        if (result.success) {
          const elementId = result.elementId || result.data?.elementId
          if (elementId) {
            properties.elementId = elementId
          }
          debugLog(`📊 Infographic element inserted via Layout Service: ${properties.elementId}`)
        }
      } catch (error) {
        console.warn('Layout Service insertInfographic not available, showing panel in mock mode:', error)
      }
    }

    // Always show the panel (even in mock mode for UI preview)
    onElementSelected?.(properties.elementId, 'infographic', properties)
    toast({
      title: 'Infographic Panel',
      description: 'Choose an infographic type and generate content'
    })
  }, [currentSlide, toast, onElementSelected, ensureEditMode])

  // Diagram insertion handler
  const handleInsertDiagram = useCallback(async (): Promise<void> => {
    // Auto-enter edit mode if needed
    if (!await ensureEditMode()) {
      toast({
        title: 'Error',
        description: 'Could not enter edit mode',
        variant: 'destructive'
      })
      return
    }

    // Generate a mock element ID for now (Layout Service will assign real IDs when implemented)
    const mockElementId = `diagram-${Date.now()}`

    // Create default properties for new diagram
    const properties: ElementProperties = {
      type: 'diagram',
      elementId: mockElementId,
      position: { x: 10, y: 15 },
      size: { width: 80, height: 70 },
      rotation: 0,
      locked: false,
      zIndex: 1,
      diagramType: 'flowchart',
      direction: 'TB',
      theme: 'default'
    }

    // Try to insert via Layout Service if iframe is ready
    if (iframeRef.current) {
      try {
        const result = await sendCommand(iframeRef.current, 'insertDiagram', {
          componentType: 'DIAGRAM',
          slideIndex: currentSlide - 1,
          gridRow: '3/16',
          gridColumn: '4/28',
          diagramType: 'flowchart', // Default type
          direction: 'TB',
          theme: 'default'
        })

        if (result.success) {
          const elementId = result.elementId || result.data?.elementId
          if (elementId) {
            properties.elementId = elementId
          }
          debugLog(`🔀 Diagram element inserted via Layout Service: ${properties.elementId}`)
        }
      } catch (error) {
        console.warn('Layout Service insertDiagram not available, showing panel in mock mode:', error)
      }
    }

    // Always show the panel (even in mock mode for UI preview)
    onElementSelected?.(properties.elementId, 'diagram', properties)
    toast({
      title: 'Diagram Panel',
      description: 'Select a diagram type and generate with AI'
    })
  }, [currentSlide, toast, onElementSelected, ensureEditMode])

  // Insert text box handler
  const handleInsertTextBox = useCallback(async () => {
    // Auto-enter edit mode if needed
    if (!await ensureEditMode()) {
      toast({
        title: 'Error',
        description: 'Could not enter edit mode',
        variant: 'destructive'
      })
      return
    }

    try {
      const result = await sendCommand(iframeRef.current!, 'insertTextBox', {
        componentType: 'TEXT_BOX',
        slideIndex: currentSlide - 1, // Convert to 0-based
        gridRow: '6/12',      // Center position
        gridColumn: '8/24',
        content: '<p>Click to edit text</p>'
      })

      if (result.success) {
        const elementId = result.elementId || result.data?.elementId
        if (elementId) {
          setSelectedTextBoxId(elementId)
          onTextBoxSelected?.(elementId, null)
        }
        toast({
          title: 'Text Box Added',
          description: 'Click to edit your text'
        })
        debugLog(`📝 Inserted text box: ${elementId}`)
      }
    } catch (error) {
      console.error('Error inserting text box:', error)
      toast({
        title: 'Error',
        description: 'Failed to add text box. Please try again.',
        variant: 'destructive'
      })
    }
  }, [currentSlide, toast, onTextBoxSelected, ensureEditMode])

  // Delete text box handler
  const handleDeleteTextBox = useCallback(async () => {
    if (!selectedTextBoxId || !iframeRef.current) return

    try {
      const result = await sendCommand(iframeRef.current, 'deleteTextBox', {
        elementId: selectedTextBoxId
      })

      if (result.success) {
        setSelectedTextBoxId(null)
        onTextBoxDeselected?.()
        toast({
          title: 'Text Box Deleted'
        })
        debugLog(`🗑️ Deleted text box: ${selectedTextBoxId}`)
      }
    } catch (error) {
      console.error('Error deleting text box:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete text box',
        variant: 'destructive'
      })
    }
  }, [selectedTextBoxId, toast, onTextBoxDeselected])

  // Get selection info from Layout Service (for AI regeneration)
  const handleGetSelectionInfo = useCallback(async (): Promise<SelectionInfo | null> => {
    if (!iframeRef.current) return null

    try {
      const result = await sendCommand(iframeRef.current, 'getSelectionInfo')
      if (result.success && result.data) {
        return {
          hasSelection: result.data.hasSelection,
          selectedText: result.data.selectedText,
          sectionId: result.data.sectionId,
          slideIndex: result.data.slideIndex
        }
      }
      return { hasSelection: false }
    } catch (error) {
      console.error('Error getting selection info:', error)
      return null
    }
  }, [])

  // Update section content via Layout Service (for AI regeneration)
  const handleUpdateSectionContent = useCallback(async (
    slideIndex: number,
    sectionId: string,
    content: string
  ): Promise<boolean> => {
    if (!iframeRef.current) {
      toast({
        title: 'Error',
        description: 'Presentation not ready',
        variant: 'destructive'
      })
      return false
    }

    if (studioShell) viewerInteractionIntentRef.current += 1
    try {
      const result = await sendCommand(iframeRef.current, 'updateSectionContent', {
        slideIndex,
        sectionId,
        content
      })

      if (result.success) {
        debugLog(`✅ Updated section ${sectionId} on slide ${slideIndex + 1}`)
        return true
      }
      return false
    } catch (error) {
      console.error('Error updating section content:', error)
      toast({
        title: 'Error',
        description: 'Failed to update section content. Please try again.',
        variant: 'destructive'
      })
      return false
    }
  }, [toast, studioShell])

  // Send text box command to iframe (for TextBoxFormatPanel)
  const handleSendTextBoxCommand = useCallback(async (action: string, params: Record<string, any>) => {
    if (!iframeRef.current) {
      throw new Error('Iframe not ready')
    }
    if (studioShell) viewerInteractionIntentRef.current += 1
    return sendCommand(iframeRef.current, action, params)
  }, [studioShell])

  // Trigger iframe refresh after Elementor auto-injection
  const triggerIframeRefresh = useCallback(() => {
    if (!iframeRef.current) return
    if (studioShell) viewerInteractionIntentRef.current += 1

    // Send refreshSlide command to iframe - Layout Service will reload current slide
    postCommand(iframeRef.current, 'refreshSlide')
    debugLog('[Elementor] Triggered iframe refresh after auto-injection')
  }, [studioShell])

  // Send element command - routes to Layout Service or Elementor as appropriate
  const handleSendElementCommand = useCallback(async (action: string, params: Record<string, any>) => {
    if (!iframeRef.current) {
      throw new Error('Iframe not ready')
    }

    const commandType = getCommandType(action)
    if (studioShell && ![
      'getElementGeometry', 'getSlideGenerationContext', 'getTemplateSlotCatalog',
      'getElementThemeVariants', 'getSelectionInfo',
    ].includes(action)) viewerInteractionIntentRef.current += 1

    // Direct Layout Service command - send to iframe
    if (commandType === 'layout-service') {
      debugLog(`[ElementCommand] Layout Service: ${action}`, params)
      const timeoutMs = LAYOUT_ELEMENT_COMMAND_TIMEOUTS[action] ?? DEFAULT_LAYOUT_COMMAND_TIMEOUT_MS
      return sendCommand(iframeRef.current, action, params, { timeoutMs })
    }

    // Elementor command - call Elementor API (auto-injects into Layout Service)
    if (commandType === 'elementor') {
      const endpoint = getElementorEndpoint(action)
      if (!endpoint) {
        throw new Error(`No Elementor endpoint found for: ${action}`)
      }

      debugLog(`[ElementCommand] Elementor: ${action} -> ${endpoint}`)

      try {
        // Build Elementor request with context and position
        const elementorRequest = {
          element_id: params.elementId,
          context: {
            presentation_id: presentationId || 'unknown',
            presentation_title: 'Untitled', // TODO: Get from props if available
            slide_id: `slide-${currentSlide}`,
            slide_index: currentSlide - 1,
          } as ElementorContext,
          position: params.position || {
            grid_row: '4/14',
            grid_column: '2/30'
          } as ElementorPosition,
          prompt: params.prompt,
          // Pass through element-specific params
          ...(params.style && { style: params.style }),
          ...(params.aspectRatio && { aspect_ratio: params.aspectRatio }),
          ...(params.quality && { quality: params.quality }),
          ...(params.chartType && { chart_type: params.chartType }),
          ...(params.colorPalette && { palette: params.colorPalette }),
          ...(params.diagramType && { diagram_type: params.diagramType }),
          ...(params.direction && { direction: params.direction }),
          ...(params.theme && { theme: params.theme }),
          ...(params.infographicType && { infographic_type: params.infographicType }),
          ...(params.colorScheme && { color_scheme: params.colorScheme }),
          ...(params.iconStyle && { icon_style: params.iconStyle }),
          ...(params.rows && { rows: params.rows }),
          ...(params.cols && { columns: params.cols }),
          ...(params.hasHeaderRow !== undefined && { has_header: params.hasHeaderRow }),
        }

        const response = await fetch(`${getElementorServiceUrl()}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(elementorRequest)
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error?.message || `Elementor API error: ${response.status}`)
        }

        const data = await response.json()

        if (!data.success) {
          return {
            success: false,
            error: data.error?.message || 'Elementor generation failed'
          }
        }

        debugLog(`[ElementCommand] Elementor generated and auto-injected: ${data.element_id}`)

        // Elementor auto-injects content - trigger iframe refresh to show it
        if (data.injected) {
          triggerIframeRefresh()
        }

        return {
          success: true,
          elementId: data.element_id,
          injected: data.injected
        }
      } catch (error) {
        console.error(`[ElementCommand] Elementor generation failed:`, error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Elementor generation failed'
        }
      }
    }

    // Unknown command - try sending to iframe anyway (backwards compatibility)
    console.warn(`[ElementCommand] Unknown command type: ${action}, sending to iframe`)
    return sendCommand(iframeRef.current, action, params)
  }, [presentationId, currentSlide, triggerIframeRefresh, studioShell])

  const captureStudioElementGeneration = useCallback((): StudioElementGenerationLease | null => {
    const owner = renderSlideMutationOwner
    const mode = studioFormatModeRef.current
    const safety = getStudioIntroductionSafety()
    if (!studioShell || !owner.userId || !owner.presentationId || !owner.sessionId
      || owner.sessionId === 'new' || owner.deckOwnerSessionId !== owner.sessionId
      || mode.enabled || !safety.ready || safety.busy || safety.error) return null
    const frame = captureStudioNativeSlideFrame()
    if (!frame) return null
    let retired = false
    const isCurrent = () => {
      if (retired) return false
      const current = frame.isCurrent() && studioFormatModeRef.current === mode
        && !mode.enabled && getStudioIntroductionSafety().ready
      if (!current) retired = true
      return current
    }
    return {
      isCurrent,
      sendElementCommand: async (action, params) => {
        if (!isCurrent()) throw new Error('The presentation viewer changed during element generation.')
        const result = await handleSendElementCommand(action, params)
        if (!isCurrent()) throw new Error('The presentation viewer changed during element generation. Check the original slide before retrying.')
        return result
      },
    }
  }, [studioShell, renderSlideMutationOwner, captureStudioNativeSlideFrame, getStudioIntroductionSafety, handleSendElementCommand])

  const handleComposePlaceholderAdd = useCallback((jobId: string, visualIndex: number, replaceJobId?: string) => {
    if (studioShell && iframeRef.current) {
      viewerInteractionIntentRef.current += 1
      nativeSnapshotStructureEditedRef.current = true
    }
    return sendCommand(
      iframeRef.current,
      'composePlaceholderAdd',
      {
        job_id: jobId,
        visual_index: visualIndex,
        ...(replaceJobId ? { replace_job_id: replaceJobId } : {}),
      },
      { timeoutMs: 8000, expectedJobId: jobId },
    )
  }, [])

  const handleComposeSlideReconcile = useCallback((
    jobId: string,
    realSlideIndex: number,
    realSlideId?: string | null,
    targetPresentationId?: string | null,
  ) => {
    if (studioShell && iframeRef.current) {
      viewerInteractionIntentRef.current += 1
      nativeSnapshotStructureEditedRef.current = true
    }
    return sendCommand(
      iframeRef.current,
      'composeSlideReconcile',
      {
        job_id: jobId,
        real_slide_index: realSlideIndex,
        ...(realSlideId ? { real_slide_id: realSlideId } : {}),
        ...(targetPresentationId ? { presentation_id: targetPresentationId } : {}),
      },
      { timeoutMs: 8000, expectedJobId: jobId },
    )
  }, [])

  const handleComposePlaceholderFail = useCallback((jobId: string) => {
    return sendCommand(
      iframeRef.current,
      'composePlaceholderFail',
      { job_id: jobId },
      { timeoutMs: 8000, expectedJobId: jobId },
    )
  }, [])

  const handleComposePlaceholderUpdate = useCallback((
    jobId: string,
    text: string,
    stage?: string | null,
    detail?: string | null,
  ) => {
    return sendCommand(
      iframeRef.current,
      'composePlaceholderUpdate',
      {
        job_id: jobId,
        text,
        ...(stage ? { stage } : {}),
        ...(detail ? { detail } : {}),
      },
      { timeoutMs: 5000, expectedJobId: jobId },
    )
  }, [])

  const handleRefineOverlayMark = useCallback((jobId: string, slideId: string) => {
    return sendCommand(
      iframeRef.current,
      'refineOverlayMark',
      {
        job_id: jobId,
        slide_id: slideId,
      },
      { timeoutMs: 8000, expectedJobId: jobId },
    )
  }, [])

  const handleRefineSlideReconcile = useCallback((
    jobId: string,
    oldSlideId: string,
    realSlideId: string,
    targetPresentationId?: string | null,
  ) => {
    if (studioShell && iframeRef.current) {
      viewerInteractionIntentRef.current += 1
      nativeSnapshotStructureEditedRef.current = true
    }
    return sendCommand(
      iframeRef.current,
      'refineSlideReconcile',
      {
        job_id: jobId,
        old_slide_id: oldSlideId,
        real_slide_id: realSlideId,
        ...(targetPresentationId ? { presentation_id: targetPresentationId } : {}),
      },
      { timeoutMs: 8000, expectedJobId: jobId },
    )
  }, [])

  const handleRefineOverlayClear = useCallback((jobId: string) => {
    return sendCommand(
      iframeRef.current,
      'refineOverlayClear',
      { job_id: jobId },
      { timeoutMs: 8000, expectedJobId: jobId },
    )
  }, [])

  const handleComposeGetState = useCallback(() => {
    return sendCommand(iframeRef.current, 'composeGetState', {}, { timeoutMs: 5000 })
  }, [])

  const handleComposeCaptureSelectionContext = useCallback((): StudioComposeSelectionContext | null => {
    if (!studioShell) return null
    const iframe = iframeRef.current
    const owner = slideMutationOwnerRef.current
    const source = iframe?.src
    const nativeWindow = iframe?.contentWindow
    const mount = slideMutationMountRef.current.generation
    const mode = studioFormatModeRef.current
    const interaction = viewerInteractionIntentRef.current
    const structure = thumbnailNativeRevisionRef.current
    const loadRevision = studioComposeLoadRevisionRef.current
    const loadedFrame = studioComposeLoadedFrameRef.current
    const continuationKey = JSON.stringify([owner.userId, owner.presentationId, owner.sessionId,
      owner.deckOwnerSessionId, owner.activeVersion, mount, mode.revision, interaction, structure])
    const deckOwner = studioComposeDeckOwnerRef.current.token
    if (studioComposeContinuationRef.current?.key !== continuationKey || studioComposeContinuationRef.current.deckOwner !== deckOwner) {
      studioComposeContinuationRef.current = { key: continuationKey, deckOwner, token: {} }
    }
    const continuation = studioComposeContinuationRef.current.token
    let retired = false
    const isCurrent = () => {
      const safety = getStudioIntroductionSafety()
      if (retired || !iframe || !nativeWindow || !owner.userId || !owner.presentationId
        || !owner.sessionId || owner.sessionId === 'new' || owner.deckOwnerSessionId !== owner.sessionId
        || !slideMutationMountRef.current.active || slideMutationMountRef.current.generation !== mount
        || slideMutationOwnerRef.current !== owner || iframeRef.current !== iframe
        || iframe.src !== source || iframe.contentWindow !== nativeWindow
        || !loadedFrame || studioComposeLoadedFrameRef.current !== loadedFrame
        || loadedFrame.iframe !== iframe || loadedFrame.source !== source || loadedFrame.nativeWindow !== nativeWindow
        || loadedFrame.revision !== loadRevision || studioComposeLoadRevisionRef.current !== loadRevision
        || source !== owner.source
        || studioFormatModeRef.current !== mode || mode.enabled
        || viewerInteractionIntentRef.current !== interaction || thumbnailNativeRevisionRef.current !== structure
        || studioSaveRequestRef.current !== null || !safety.ready || safety.dirty || safety.busy || safety.error) {
        retired = true
        return false
      }
      return true
    }
    if (!isCurrent()) return null
    const assertCurrent = () => {
      if (!isCurrent()) throw new Error('Native selection context retired')
    }
    const readNativeOrder = async () => {
      assertCurrent()
      const receipt = await sendCommand(iframe, 'composeGetState', {}, { timeoutMs: 5000 })
      assertCurrent()
      if (!parseStudioNativeSlideOrder(receipt)) throw new Error('Native slide identity/order unavailable')
      return receipt
    }
    return Object.freeze({
      frameEpoch: owner,
      continuationKey: continuation,
      loadRevision,
      interactionRevision: interaction,
      structureRevision: structure,
      presentationUrl: introSafetyRef.current.presentationUrl!,
      isCurrent,
      readNativeOrder,
      restoreIdentity: async ({ slideId, expectedNativeCount, isCurrent: targetIsCurrent }: Parameters<StudioComposeSelectionContext['restoreIdentity']>[0]) => {
        let orderRetired = false
        const active = () => !orderRetired && isCurrent() && targetIsCurrent()
        const check = () => {
          if (!active()) throw new Error('Native selection target retired')
        }
        if (!slideId || slideId !== slideId.trim() || (expectedNativeCount !== null
          && (!Number.isSafeInteger(expectedNativeCount) || expectedNativeCount < 1))) {
          throw new Error('Invalid native selection identity/count')
        }
        check()
        const initial = parseStudioNativeSlideOrder(await readNativeOrder())!
        check()
        const visualIndex = initial.slideIds.indexOf(slideId)
        const nativeCount = initial.nativeCount
        if (visualIndex < 0 || (expectedNativeCount !== null && nativeCount !== expectedNativeCount)) {
          throw new Error('Requested native slide identity/count unavailable')
        }
        const read = async () => {
          check()
          const receipt = await readNativeOrder()
          check()
          const order = parseStudioNativeSlideOrder(receipt)!
          if (order.nativeCount !== nativeCount || order.slideIds[visualIndex] !== slideId) {
            // Never keep navigating an old index after the real ID moved.
            orderRetired = true
            throw new Error('Native slide order changed during selection')
          }
          return order
        }
        await restoreSlideViewerSelection({
          targetVisualIndex: visualIndex,
          readNavigationInfo: async () => {
            const order = await read()
            return { currentVisualIndex: order.currentVisualIndex, totalSlides: order.nativeCount }
          },
          navigate: async index => {
            // Re-read the strict identity immediately before dispatch.
            await read()
            check()
            await sendCommand(iframe, 'goToSlide', { index }, { timeoutMs: 1500 })
            check()
          },
          wait: waitForViewerSettle,
          isActive: active,
        })
        const final = await read()
        check()
        if (final.currentVisualIndex !== visualIndex || final.slideIds[visualIndex] !== slideId) {
          throw new Error('Native selection readback did not match')
        }
        setCurrentSlide(visualIndex + 1)
        setTotalSlides(nativeCount)
        setVisualTotalSlides(nativeCount)
        lastSlideInfoRef.current = { slide: visualIndex + 1, total: nativeCount, visualTotal: nativeCount }
        onSlideChangeRef.current?.(visualIndex + 1)
        return { slideId, visualIndex, nativeCount, verified: true as const }
      },
    })
  }, [studioShell, getStudioIntroductionSafety])

  const handleComposeGoToVisualIndex = useCallback(async (visualIndex: number, options?: { isCurrent?: () => boolean }) => {
    const safeVisualIndex = Math.max(0, visualIndex)
    const iframe = iframeRef.current
    if (!iframe) throw new Error('Iframe not ready')
    const source = iframe.src
    const nativeWindow = iframe.contentWindow
    const owner = slideMutationOwnerRef.current
    const mount = slideMutationMountRef.current.generation
    const interaction = viewerInteractionIntentRef.current
    const structure = thumbnailNativeRevisionRef.current
    const mode = studioFormatModeRef.current
    const isActive = () => (!options?.isCurrent || options.isCurrent())
      && iframeRef.current === iframe && iframe.src === source && iframe.contentWindow === nativeWindow
      && (!studioShell || (slideMutationMountRef.current.active && slideMutationMountRef.current.generation === mount
        && slideMutationOwnerRef.current === owner && viewerInteractionIntentRef.current === interaction
        && thumbnailNativeRevisionRef.current === structure && studioFormatModeRef.current === mode))

    const result = await restoreSlideViewerSelection({
      targetVisualIndex: safeVisualIndex,
      readNavigationInfo: async () => resolveSlideViewerNavigationInfo(await sendCommand(
        iframe,
        'getCurrentSlideInfo',
        {},
        { timeoutMs: 1000 },
      )),
      navigate: async targetVisualIndex => {
        await sendCommand(
          iframe,
          'goToSlide',
          { index: targetVisualIndex },
          { timeoutMs: 1500 },
        )
      },
      wait: waitForViewerSettle,
      isActive,
      onRetry: retry => {
        scTrace(
          retry.phase === 'waiting'
            ? 'viewer.selection_restore.waiting'
            : 'viewer.selection_restore.retry',
          {
            visual_index: safeVisualIndex,
            attempt: retry.attempt,
            phase: retry.phase,
            viewer_state: retry.viewerState,
            error: retry.error instanceof Error ? retry.error.message : retry.error,
          },
        )
      },
    })

    if (!isActive()) throw new Error('Presentation iframe changed during slide selection restore')
    const nextSlide = safeVisualIndex + 1
    setCurrentSlide(nextSlide)
    onSlideChangeRef.current?.(nextSlide)
    return {
      success: true,
      action: 'goToSlide',
      index: safeVisualIndex,
      attempts: result.attempts,
      verified: true,
    }
  }, [studioShell])

  const handleComposeGoToPlaceholder = useCallback(async (jobId: string) => {
    const state = await sendCommand(iframeRef.current, 'composeGetState', {}, { timeoutMs: 5000 })
    const placeholder = Array.isArray(state?.placeholders)
      ? state.placeholders.find((item: any) => item?.job_id === jobId)
      : null
    if (!placeholder || !Number.isFinite(Number(placeholder.visual_index))) {
      throw new Error(`Placeholder not found for job ${jobId}`)
    }
    return handleComposeGoToVisualIndex(Number(placeholder.visual_index))
  }, [handleComposeGoToVisualIndex])

  // Expose APIs to parent component when iframe is ready
  useEffect(() => {
    if (!onApiReady) return

    if (!viewerIsReady) {
      onApiReady(null)
      return
    }

    onApiReady({
      getSelectionInfo: handleGetSelectionInfo,
      updateSectionContent: handleUpdateSectionContent,
      sendTextBoxCommand: handleSendTextBoxCommand,
      sendElementCommand: handleSendElementCommand,
      // MDC P8: index-based navigation for chat-invoked element placement.
      goToSlide: handleGoToSlide,
      ...(studioShell ? { getStudioIntroductionSafety, captureStudioElementGeneration } : {})
    })

    return () => onApiReady(null)
  }, [viewerIsReady, onApiReady, handleGetSelectionInfo, handleUpdateSectionContent, handleSendTextBoxCommand, handleSendElementCommand, handleGoToSlide, studioShell, getStudioIntroductionSafety, captureStudioElementGeneration])

  useEffect(() => {
    if (!onComposeApiReady) return

    if (!viewerIsReady) {
      onComposeApiReady(null)
      return
    }

    onComposeApiReady({
      composePlaceholderAdd: handleComposePlaceholderAdd,
      composeSlideReconcile: handleComposeSlideReconcile,
      composePlaceholderUpdate: handleComposePlaceholderUpdate,
      composePlaceholderFail: handleComposePlaceholderFail,
      composeGetState: handleComposeGetState,
      composeGoToPlaceholder: handleComposeGoToPlaceholder,
      composeGoToVisualIndex: handleComposeGoToVisualIndex,
      ...(studioShell ? { composeCaptureSelectionContext: handleComposeCaptureSelectionContext } : {}),
      refineOverlayMark: handleRefineOverlayMark,
      refineSlideReconcile: handleRefineSlideReconcile,
      refineOverlayClear: handleRefineOverlayClear,
    })

    return () => onComposeApiReady(null)
  }, [
    viewerIsReady,
    onComposeApiReady,
    handleComposePlaceholderAdd,
    handleComposeSlideReconcile,
    handleComposePlaceholderUpdate,
    handleComposePlaceholderFail,
    handleComposeGetState,
    handleComposeGoToPlaceholder,
    handleComposeGoToVisualIndex,
    handleComposeCaptureSelectionContext,
    studioShell,
    renderSlideMutationOwner,
    handleRefineOverlayMark,
    handleRefineSlideReconcile,
    handleRefineOverlayClear,
  ])

  const handleFullscreen = useCallback(async () => {
    const targetContainer = containerRef.current
    if (!targetContainer) return
    const interaction = studioShell ? beginStudioViewerInteraction() : null
    const isCurrent = () => !interaction || (
      interaction.isCurrent() && containerRef.current === targetContainer
    )
    if (!isCurrent()) return

    try {
      if (!document.fullscreenElement) {
        if (studioShell && iframeRef.current) {
          const targetIframe = interaction!.iframe
          const current = await sendCommand(targetIframe, 'isEditModeActive')
          if (!isCurrent()) return
          let observed = current
          if (current.isEditing) {
            await sendCommand(targetIframe, 'exitEditMode')
            if (!isCurrent()) return
            observed = await sendCommand(targetIframe, 'isEditModeActive')
            if (!isCurrent()) return
          }
          setIsEditMode(Boolean(observed.isEditing))
          onEditModeChange?.(Boolean(observed.isEditing))
          if (observed.isEditing || !isCurrent()) return
        }
        // Exit edit mode before entering fullscreen (presentation mode should not be editable)
        if (!studioShell && isEditMode && iframeRef.current) {
          await sendCommand(iframeRef.current, 'exitEditMode')
          setIsEditMode(false)
          onEditModeChange?.(false)
          debugLog('✏️ Exited edit mode for fullscreen presentation')
        }

        // Hide grid overlay before entering fullscreen
        if (isGridActive && iframeRef.current) {
          await sendCommand(interaction?.iframe ?? iframeRef.current, 'hideGridOverlay')
          if (!isCurrent()) return
          setIsGridActive(false)
          debugLog('📐 Hid grid overlay for fullscreen presentation')
        }

        // Hide border highlight before entering fullscreen
        if (isBordersActive && iframeRef.current) {
          await sendCommand(interaction?.iframe ?? iframeRef.current, 'hideBorderHighlight')
          if (!isCurrent()) return
          setIsBordersActive(false)
          debugLog('🔲 Hid borders for fullscreen presentation')
        }

        // Enter fullscreen on container - we control the UI with black backgrounds
        if (!isCurrent()) return
        await (studioShell ? targetContainer : containerRef.current!).requestFullscreen()
        if (!isCurrent()) return
        setIsFullscreen(true)
        debugLog('🖥️ Entered fullscreen mode')
      } else {
        // Exit fullscreen
        await document.exitFullscreen()
        if (!isCurrent()) return
        setIsFullscreen(false)
        debugLog('🖥️ Exited fullscreen mode')
      }
    } catch (error) {
      console.error('❌ Fullscreen error:', error)
    }
  }, [studioShell, isEditMode, onEditModeChange, isGridActive, isBordersActive, beginStudioViewerInteraction])

  // Debug: Log button states
  useEffect(() => {
    debugLog(`🎯 Button states - currentSlide: ${currentSlide}, totalSlides: ${totalSlides}`)
    debugLog(`   Prev disabled: ${currentSlide === 1}`)
    debugLog(`   Next disabled: ${currentSlide === totalSlides}`)
  }, [currentSlide, totalSlides])

  // Handle fullscreen change events (user presses ESC or F11)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement
      setIsFullscreen(isNowFullscreen)
      // When entering fullscreen, hide toolbar initially
      if (isNowFullscreen) {
        setShowToolbar(false)
      } else {
        setShowToolbar(true)
        setFullscreenSlideSize(null) // Reset when exiting fullscreen
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // A4: leaving Present drops a failed view-only frame so the next Present tries again, and
  // brings the editing frame to the slide the audience ended on (the editing frame never moved).
  useEffect(() => {
    if (!presentViewOnlyEnabled || isFullscreen) return
    setPresentFrameFailed(false)
  }, [presentViewOnlyEnabled, isFullscreen])
  useEffect(() => {
    if (presentViewOnlyActive) return
    const endedOn = presentSlideIndexRef.current
    if (endedOn === null) return
    presentSlideIndexRef.current = null
    if (endedOn !== currentSlide - 1) void handleGoToSlide(endedOn)
  }, [presentViewOnlyActive, currentSlide, handleGoToSlide])

  // Calculate optimal slide dimensions in fullscreen mode
  useEffect(() => {
    if (!isFullscreen || !slideContainerRef.current) return

    const calculateSize = () => {
      const container = slideContainerRef.current
      if (!container) return

      // Get actual container dimensions (accounts for all padding/margins)
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      // Calculate optimal 16:9 dimensions that fit within container
      const aspectRatio = 16 / 9
      let width = containerWidth
      let height = width / aspectRatio

      // If calculated height exceeds container, constrain by height instead
      if (height > containerHeight) {
        height = containerHeight
        width = height * aspectRatio
      }

      debugLog(`📐 Fullscreen slide size: ${Math.round(width)}x${Math.round(height)} (container: ${containerWidth}x${containerHeight})`)
      setFullscreenSlideSize({ width, height })
    }

    // Calculate immediately and on resize
    calculateSize()
    window.addEventListener('resize', calculateSize)

    return () => window.removeEventListener('resize', calculateSize)
  }, [isFullscreen])

  // Calculate optimal slide dimensions in normal mode (fit-contain)
  useEffect(() => {
    if (isFullscreen) return
    const container = slideContainerRef.current
    if (!container) return

    const calculate = () => {
      const { width, height } = container.getBoundingClientRect()
      // Subtract padding (p-4 = 16px each side)
      const pw = width - 32, ph = height - 32
      if (pw <= 0 || ph <= 0) return
      const ratio = 16 / 9
      let w = pw, h = w / ratio
      if (h > ph) { h = ph; w = h * ratio }
      setNormalSlideSize({ width: w, height: h })
    }

    // Immediate calculation on mount/URL change
    calculate()

    const ro = new ResizeObserver(() => calculate())
    ro.observe(container)
    return () => ro.disconnect()
  }, [isFullscreen, presentationUrl])

  // Auto-hide toolbar in fullscreen mode
  useEffect(() => {
    if (!isFullscreen) return

    let hideTimeout: NodeJS.Timeout

    const handleMouseMove = (e: MouseEvent) => {
      // Show toolbar if mouse is near top (within 100px)
      if (e.clientY < 100) {
        setShowToolbar(true)
        // Hide again after 3 seconds of no movement
        clearTimeout(hideTimeout)
        hideTimeout = setTimeout(() => {
          setShowToolbar(false)
        }, 3000)
      } else {
        // Hide toolbar if mouse is away from top
        setShowToolbar(false)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      clearTimeout(hideTimeout)
    }
  }, [isFullscreen])

  // Listen for save status/refine events from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!VIEWER_ORIGIN || LAYOUT_URL_CONFIG_ERROR || !isTrustedLayoutViewerMessage(event, iframeRef.current, VIEWER_ORIGIN)) return
      const type = event.data?.type
      if (typeof type !== 'string' || !isLayoutViewerEvent(type)) return

      if (isDiagramRendererStateEvent(type)) {
        const update = parseDiagramRendererStateUpdate(event.data)
        if (!update) return
        if (studioShell) viewerInteractionIntentRef.current += 1
        pendingDiagramStatesRef.current.set(update.elementId, update)
        const previousTimer = diagramStateTimersRef.current.get(update.elementId)
        if (previousTimer !== undefined) window.clearTimeout(previousTimer)
        if (update.action === 'taskColumnResize' || update.action === 'rowLabelResize') {
          // Resize-end is an explicit terminal renderer event. Persist it
          // immediately so a fast Regenerate preflight cannot beat debounce.
          diagramStateTimersRef.current.delete(update.elementId)
          pendingDiagramStatesRef.current.delete(update.elementId)
          postCommand(iframeRef.current, 'updateDiagramRendererState', update)
          return
        }
        const timer = window.setTimeout(() => {
          diagramStateTimersRef.current.delete(update.elementId)
          const pending = pendingDiagramStatesRef.current.get(update.elementId)
          pendingDiagramStatesRef.current.delete(update.elementId)
          if (!pending) return
          postCommand(iframeRef.current, 'updateDiagramRendererState', pending)
        }, 250)
        diagramStateTimersRef.current.set(update.elementId, timer)
        return
      }

      // Handle save status updates from auto-save system
      if (type === 'save_status' || type === 'saveStatusChanged') {
        const status = event.data.status as SaveStatus
        if (!['saved', 'unsaved', 'saving', 'error'].includes(status)) return
        if (status !== 'saved') {
          if (studioShell) viewerInteractionIntentRef.current += 1
          nativeSnapshotDirtyRef.current = true
        }
        else if (event.data.hasPendingChanges === false) nativeSnapshotDirtyRef.current = false
        setNativeSnapshotSafetyRevision(value => value + 1)
        setSaveStatus(status)
        debugLog(`💾 Save status: ${status}`)
      }

      if (
        type === 'refineElementRequested' &&
        event.data.elementId &&
        (event.data.componentType || event.data.elementType)
      ) {
        onRefineElementRequested?.({
          elementId: String(event.data.elementId),
          elementType: String(event.data.elementType || event.data.componentType),
          componentType: event.data.componentType ? String(event.data.componentType) : undefined,
          slideIndex: typeof event.data.slideIndex === 'number' ? event.data.slideIndex : undefined,
          gridPosition: event.data.gridPosition,
          isBlank: Boolean(event.data.isBlank),
          formatting: event.data.formatting,
          properties: event.data.properties,
          themeVariantId: typeof event.data.themeVariantId === 'string'
            ? event.data.themeVariantId
            : typeof event.data.theme_variant_id === 'string'
              ? event.data.theme_variant_id
              : null,
          themeBindings: event.data.themeBindings || event.data.theme_bindings,
          styleOwner: event.data.styleOwner || event.data.style_owner || null,
          themeVariantSource: event.data.themeVariantSource || event.data.theme_variant_source || null,
          researchProvenance: event.data.researchProvenance || event.data.research_provenance || null,
          semanticRole: event.data.semanticRole || event.data.semantic_role || null,
          slotName: event.data.slotName || event.data.slot_name || null,
          slotKind: event.data.slotKind || event.data.slot_kind || null,
          accessoryType: event.data.accessoryType || event.data.accessory_type || null,
          generationConfig: resolveRefineElementGenerationConfig(event.data),
          citationsUsed: event.data.citationsUsed || event.data.citations_used || null,
          metricsColorVariant: event.data.metricsColorVariant || event.data.metrics_color_variant || null,
          diagramSubtype: event.data.diagramSubtype || event.data.diagram_subtype
            || event.data.diagramType || event.data.diagram_type || null,
          zIndex: typeof (event.data.zIndex ?? event.data.z_index) === 'number'
            ? Number(event.data.zIndex ?? event.data.z_index)
            : null,
          content: event.data.content,
        })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      diagramStateTimersRef.current.forEach(timer => window.clearTimeout(timer))
      diagramStateTimersRef.current.clear()
      pendingDiagramStatesRef.current.clear()
    }
  }, [onRefineElementRequested])

  // Listen for text box selection events from iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!VIEWER_ORIGIN || LAYOUT_URL_CONFIG_ERROR || !isTrustedLayoutViewerMessage(event, iframeRef.current, VIEWER_ORIGIN)) return

      // Handle text box selection - auto-enter edit mode
      if (event.data.type === 'textBoxSelected') {
        const elementId = event.data.elementId
        const formatting = event.data.formatting as TextBoxFormatting | null
        const componentType = typeof event.data.componentType === 'string'
          ? event.data.componentType
          : undefined

        // Auto-enter edit mode when user clicks on a text box
        const interaction = studioShell ? beginStudioViewerInteraction() : null
        if (interaction && !interaction.isCurrent()) return
        const entered = await ensureEditMode(interaction?.iframe ?? undefined, interaction?.isCurrent)
        if (interaction && (!entered || !interaction.isCurrent())) return

        setSelectedTextBoxId(elementId)
        captureStudioFormatSelection(elementId, 'textBoxSelected')
        onTextBoxSelected?.(elementId, formatting, componentType)
        if (interaction && !interaction.isCurrent()) return
        void sendCommand(interaction?.iframe ?? iframeRef.current, 'bringToFront', { elementId }).catch((error) => {
          console.warn('[PresentationViewer] Failed to bring selected text box to front:', error)
        })
        debugLog(`📦 Text box selected: ${elementId} (${componentType || 'TEXT_BOX'})`)
      }

      // Handle text box deselection
      if (event.data.type === 'textBoxDeselected') {
        if (studioShell) viewerInteractionIntentRef.current += 1
        setSelectedTextBoxId(null)
        onTextBoxDeselected?.()
        debugLog('📦 Text box deselected')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onTextBoxSelected, onTextBoxDeselected, ensureEditMode, studioShell, beginStudioViewerInteraction, captureStudioFormatSelection])

  // Listen for element selection events from iframe (Image, Chart, Table, Infographic, Diagram)
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!VIEWER_ORIGIN || LAYOUT_URL_CONFIG_ERROR || !isTrustedLayoutViewerMessage(event, iframeRef.current, VIEWER_ORIGIN)) return

      // Handle element selection - auto-enter edit mode and show format panel
      if (event.data.type === 'elementSelected') {
        const elementId = event.data.elementId as string
        const elementType = event.data.elementType as ElementType
        const properties = event.data.properties as ElementProperties

        // Auto-enter edit mode when user clicks on an element
        const interaction = studioShell ? beginStudioViewerInteraction() : null
        if (interaction && !interaction.isCurrent()) return
        const entered = await ensureEditMode(interaction?.iframe ?? undefined, interaction?.isCurrent)
        if (interaction && (!entered || !interaction.isCurrent())) return

        // Notify parent to show the appropriate format panel
        captureStudioFormatSelection(elementId, 'elementSelected', elementType)
        onElementSelected?.(elementId, elementType, properties)
        if (interaction && !interaction.isCurrent()) return
        void sendCommand(interaction?.iframe ?? iframeRef.current, 'bringToFront', { elementId }).catch((error) => {
          console.warn('[PresentationViewer] Failed to bring selected element to front:', error)
        })
        debugLog(`🎯 Element selected: ${elementType} (${elementId})`)
      }

      // Handle element deselection
      if (event.data.type === 'elementDeselected') {
        if (studioShell) viewerInteractionIntentRef.current += 1
        onElementDeselected?.()
        debugLog('🎯 Element deselected')
      }

      if (event.data.type === 'elementDeleted') {
        if (studioShell) viewerInteractionIntentRef.current += 1
        const elementId = event.data.elementId as string
        if (elementId) onElementDeleted?.(elementId)
        debugLog(`🎯 Element deleted: ${elementId}`)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onElementSelected, onElementDeselected, onElementDeleted, ensureEditMode, studioShell, beginStudioViewerInteraction, captureStudioFormatSelection])

  // Listen for element moved/resized events from iframe
  useEffect(() => {
    if (!onElementMoved) return

    const handleMessage = (event: MessageEvent) => {
      if (!VIEWER_ORIGIN || LAYOUT_URL_CONFIG_ERROR || !isTrustedLayoutViewerMessage(event, iframeRef.current, VIEWER_ORIGIN)) return

      if (event.data.type === 'elementMoved' || event.data.action === 'elementMoved') {
        const elementId = event.data.elementId as string
        const position = event.data.position || event.data
        const gridRow = position.gridRow as string
        const gridColumn = position.gridColumn as string

        if (elementId && gridRow && gridColumn) {
          if (studioShell) viewerInteractionIntentRef.current += 1
          onElementMoved(elementId, gridRow, gridColumn)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onElementMoved, studioShell])

  return (
    <div data-studio-v4-viewer={studioShell ? "true" : undefined} data-studio-v4-fullscreen={isFullscreen ? "true" : undefined} ref={containerRef} className={`relative flex flex-col h-full ${className} ${isFullscreen ? 'bg-black' : ''}`}>
      {/* Fullscreen toolbar trigger zone - at top, below Chrome's fullscreen bar */}
      {isFullscreen && (
        <div
          className="absolute top-0 left-0 right-0 h-20 z-40"
          onMouseEnter={() => setShowToolbar(true)}
        />
      )}

      {/* Control Toolbar - portaled to header (normal) or floating overlay (fullscreen) */}
      {showControls && (() => {
        const toolbarButtonClass = "flex h-12 min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        const toolbarLabelClass = "text-[10px] font-medium"
        // Uniform default style — no persistent fill, only hover bg + slight text lift on hover.
        const toolbarBtnBase = "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
        // Active mode (View/Edit) — subtle text accent only, no background block.
        const toolbarBtnActive = "text-purple-700 hover:bg-slate-100 hover:text-purple-800 dark:text-purple-300 dark:hover:bg-slate-800 dark:hover:text-purple-200"
        // Quiet helper (Mode/Show/version) — lighter than the build actions to signal lower weight.
        const toolbarBtnQuiet = "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        // Play — the single most important present action, given a solid brand accent so it pops.
        const toolbarBtnPlay = "bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500"
        const addElementItems = [
          {
            label: 'Table',
            icon: Grid2x2,
            disabled: !viewerIsReady,
            action: () => onOpenGenerationPanel ? onOpenGenerationPanel('TABLE') : handleInsertTable(3, 3),
          },
          {
            label: 'Metrics',
            icon: TrendingUp,
            disabled: !viewerIsReady || !onOpenGenerationPanel,
            action: () => onOpenGenerationPanel?.('METRICS'),
          },
          {
            label: 'Chart',
            icon: BarChart3,
            disabled: !viewerIsReady,
            action: () => onOpenGenerationPanel ? onOpenGenerationPanel('CHART') : handleInsertChart({ type: 'bar' }),
          },
          {
            label: 'Text Box',
            icon: Type,
            disabled: !viewerIsReady,
            action: () => onOpenGenerationPanel ? onOpenGenerationPanel('TEXT_BOX') : handleInsertTextBox(),
          },
          {
            label: 'Image',
            icon: Image,
            disabled: !viewerIsReady,
            action: () => onOpenGenerationPanel ? onOpenGenerationPanel('IMAGE') : handleInsertImage(),
          },
          {
            label: 'Icon / Label',
            icon: Tag,
            disabled: !viewerIsReady || !onOpenGenerationPanel,
            action: () => onOpenGenerationPanel?.('ICON_LABEL'),
          },
          {
            label: 'Shape',
            icon: Pentagon,
            disabled: !viewerIsReady || !onOpenGenerationPanel,
            action: () => onOpenGenerationPanel?.('SHAPE'),
          },
          {
            label: 'Infographic',
            icon: LayoutGrid,
            disabled: !viewerIsReady,
            action: () => onOpenGenerationPanel ? onOpenGenerationPanel('INFOGRAPHIC') : handleInsertInfographic(),
          },
          {
            label: 'Diagram',
            icon: GitBranch,
            disabled: !viewerIsReady,
            action: () => onOpenGenerationPanel ? onOpenGenerationPanel('DIAGRAM') : handleInsertDiagram(),
          },
        ]

        const versionMenuItems = (
          <>
                      <DropdownMenuItem
                        aria-current={studioShell && activeVersion === 'blank' ? 'true' : undefined}
                        onClick={() => onVersionSwitch?.('blank')}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>Custom</span>
                          {activeVersion === 'blank' && <Check className="h-4 w-4 text-blue-500" />}
                        </div>
                      </DropdownMenuItem>
                      {strawmanPreviewUrl && (
                        <DropdownMenuItem
                          aria-current={studioShell && activeVersion === 'strawman' ? 'true' : undefined}
                          onClick={() => onVersionSwitch?.('strawman')}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>Strawman</span>
                            {activeVersion === 'strawman' && <Check className="h-4 w-4 text-blue-500" />}
                          </div>
                        </DropdownMenuItem>
                      )}
                      {finalPresentationUrl && (
                        <DropdownMenuItem
                          aria-current={studioShell && activeVersion === 'final' ? 'true' : undefined}
                          onClick={() => onVersionSwitch?.('final')}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>Final</span>
                            {activeVersion === 'final' && <Check className="h-4 w-4 text-blue-500" />}
                          </div>
                        </DropdownMenuItem>
                      )}
          </>
        )

        const authoringControls = (
          <div
              className={cn(
                "flex items-center gap-1 min-w-0",
                !isFullscreen && "transition-[margin] duration-300 ease-out"
              )}
              style={!isFullscreen && !studioShell ? { marginLeft: toolbarOffset } : undefined}
            >
              {/* Add Slide */}
              <SlideLayoutPicker
                onAddSlide={handleAddSlide}
                onGenerateSlide={onGenerateSlide}
                disabled={!viewerIsReady || templateModeOn || isSlideMutationPending}
                className="min-w-[80px] justify-center"
              />

              {/* Add Element — same Plus icon as Add Slide; label disambiguates */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={!viewerIsReady || templateModeOn || isSlideMutationPending}
                    className={cn(toolbarButtonClass, toolbarBtnBase, "min-w-[96px]")}
                    title="Add an element"
                  >
                    <Plus className="h-5 w-5" />
                    <span className={cn(toolbarLabelClass, "whitespace-nowrap")}>Add Element</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal container={toolbarDropdownPortalContainer}>
                  <DropdownMenuContent data-studio-authoring-menu={studioShell && !isFullscreen ? "add-element" : undefined} data-studio-v4-shell={studioShell && isFullscreen ? "true" : undefined} data-studio-presentation-popup={studioShell && isFullscreen ? "true" : undefined} align="start" sideOffset={8} className="w-52 p-1">
                    {addElementItems.map(({ label, icon: Icon, disabled, action }) => (
                      <DropdownMenuItem
                        key={label}
                        disabled={disabled}
                        onClick={() => { void action() }}
                        className="cursor-pointer gap-2"
                      >
                        <Icon className="h-4 w-4 text-gray-600" />
                        <span>{label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenu>

              {studioShell && onStudioFormatRequested && <button type="button"
                disabled={!viewerIsReady || templateModeOn || isSlideMutationPending || studioFormatBusy || !studioFormatSelection?.isCurrent()}
                className={cn(toolbarButtonClass, toolbarBtnBase)} title="Format the selected element"
                onClick={() => { if (studioFormatSelection?.isCurrent()) onStudioFormatRequested(studioFormatSelection) }}>
                <Palette className="h-5 w-5" /><span className={toolbarLabelClass}>Format</span>
              </button>}

              {/* Template — "Save as Template" (Template Builder). Enabled once a
                  deck exists and we know the WS session to snapshot. */}
              {templateBuilderEnabled ? (
                <DropdownMenu
                  open={toolbarTemplateMenuOpen}
                  onOpenChange={(open) => {
                    setToolbarTemplateMenuOpen(open)
                    if (!open) setToolbarTemplatePickerOpen(false)
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <button
                      disabled={!viewerIsReady}
                      className={cn(toolbarButtonClass, toolbarBtnBase)}
                      title="Template options"
                      aria-label={studioShell ? "Template" : undefined}
                    >
                      <LayoutTemplate className="h-5 w-5" />
                      <span className={toolbarLabelClass}>Template</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuPortal container={toolbarDropdownPortalContainer}>
                    <DropdownMenuContent data-studio-authoring-menu={studioShell && !isFullscreen ? "template" : undefined} data-studio-v4-shell={studioShell && isFullscreen ? "true" : undefined} data-studio-presentation-popup={studioShell && isFullscreen ? "true" : undefined} align="center" sideOffset={8} className="w-56 p-1">
                      {studioShell && studioWorkflowRequest?.action === 'templates' && studioWorkflowRequest.itemId && templateSelectionLocked && <p className="px-2 py-2 text-xs leading-relaxed text-muted-foreground" role="status">The library selection has not been applied. Template selection is locked for this deck.</p>}
                      <DropdownMenuItem
                        disabled={!canSaveTemplate}
                        title={studioPartialArtifact ? 'Available when this deck is complete'
                          : !canSaveTemplate && templateSaveGate.disabledReason ? templateSaveGate.disabledReason.replace(/_/g, ' ') : undefined}
                        className="cursor-pointer gap-2"
                        onClick={() => setShowTemplateSave(true)}
                      >
                        <Save className="h-4 w-4 text-gray-600" />
                        <span>Save Template</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!templateModeAvailable && !templateModeOn}
                        className="cursor-pointer gap-2"
                        onClick={() => {
                          if (studioShell) viewerInteractionIntentRef.current += 1
                          onTemplateModeChange?.(!templateModeOn)
                          setToolbarTemplateMenuOpen(false)
                        }}
                      >
                        <Sparkles className="h-4 w-4 text-gray-400" />
                        <span className="flex-1">
                          {templateModeOn ? 'Exit Template Mode' : 'Template Mode'}
                        </span>
                        {!templateModeAvailable && !templateModeOn && (
                          <span className="text-xs text-muted-foreground">Select template</span>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub
                        open={toolbarTemplatePickerOpen}
                        onOpenChange={setToolbarTemplatePickerOpen}
                      >
                        <DropdownMenuSubTrigger
                          disabled={templateSelectionLocked}
                          className={cn(
                            "gap-2",
                            templateSelectionLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                          )}
                        >
                          <LayoutTemplate className="h-4 w-4 text-gray-600" />
                          <span>{templateSelectionLocked ? 'Template locked' : 'Available Templates'}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent data-studio-authoring-menu={studioShell && !isFullscreen ? "template-library" : undefined} data-studio-v4-shell={studioShell && isFullscreen ? "true" : undefined} data-studio-presentation-popup={studioShell && isFullscreen ? "true" : undefined} alignOffset={-4} className="w-64">
                          <TemplatePickerContent
                            preferredTemplateId={studioWorkflowRequest?.action === 'templates' ? studioWorkflowRequest.itemId : undefined}
                            label="Available templates"
                            isOpen={toolbarTemplatePickerOpen}
                            mode="review"
                            onSelect={(template) => {
                              onSelectTemplate?.(template)
                              setToolbarTemplatePickerOpen(false)
                              setToolbarTemplateMenuOpen(false)
                            }}
                          />
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      {templateIngestEnabled && (
                        <>
                          <DropdownMenuSeparator />
                          {/* Template Ingest (C-7): convert an uploaded deck into a template */}
                          <DropdownMenuItem
                            className="cursor-pointer gap-2"
                            onClick={() => {
                              setShowTemplateIngest(true)
                              setToolbarTemplateMenuOpen(false)
                            }}
                          >
                            <Upload className="h-4 w-4 text-gray-600" />
                            <span>Upload presentation…</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenuPortal>
                </DropdownMenu>
              ) : (
                <button
                  disabled
                  className={cn(toolbarButtonClass, "text-slate-400 dark:text-slate-500 cursor-not-allowed")}
                  title="Templates — coming soon"
                >
                  <LayoutTemplate className="h-5 w-5" />
                  <span className={toolbarLabelClass}>Template</span>
                </button>
              )}

              {/* Theme — 4th primary build action; sits with its build siblings */}
              <button
                onClick={() => setShowThemePanel(true)}
                disabled={!viewerIsReady || templateModeOn}
                className={cn(toolbarButtonClass, toolbarBtnBase)}
                title="Presentation theme"
                aria-label={studioShell ? "Theme" : undefined}
                data-studio-v4-secondary={studioShell ? "true" : undefined}
              >
                <Palette className="h-5 w-5" />
                <span className={toolbarLabelClass}>Theme</span>
              </button>

              {/* Divider — separates the four primary build actions from the quiet view helpers */}
              <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

              {/* Mode — quiet helper: editing mode (View/Edit) + UI theme (Light/Dark) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={!viewerIsReady}
                    className={cn(toolbarButtonClass, toolbarBtnQuiet)}
                    title="Editing mode + theme"
                    aria-label={studioShell ? "Mode" : undefined}
                    data-studio-v4-secondary={studioShell ? "true" : undefined}
                  >
                    <Settings2 className="h-5 w-5" />
                    <span className={toolbarLabelClass}>Mode</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal container={toolbarDropdownPortalContainer}>
                  <DropdownMenuContent data-studio-authoring-menu={studioShell && !isFullscreen ? "mode" : undefined} data-studio-v4-shell={studioShell && isFullscreen ? "true" : undefined} data-studio-presentation-popup={studioShell && isFullscreen ? "true" : undefined} align="center" sideOffset={8} className="w-44">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Editing mode
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={isEditMode ? 'edit' : 'view'}
                      onValueChange={(v) => {
                        const wantsEdit = v === 'edit'
                        if (studioShell) void handleToggleEditModeButton(wantsEdit)
                        else if (wantsEdit !== isEditMode) void handleToggleEditModeButton()
                      }}
                    >
                      <DropdownMenuRadioItem value="view" className="cursor-pointer whitespace-nowrap">
                        <Eye className="h-4 w-4 mr-2" /> View
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="edit" className="cursor-pointer whitespace-nowrap">
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Theme
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={resolvedTheme === 'dark' ? 'dark' : 'light'}
                      onValueChange={(v) => setTheme(v)}
                    >
                      <DropdownMenuRadioItem value="light" className="cursor-pointer whitespace-nowrap">
                        <Sun className="h-4 w-4 mr-2" /> Light
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="dark" className="cursor-pointer whitespace-nowrap">
                        <Moon className="h-4 w-4 mr-2" /> Dark
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenu>

              {/* Show menu — display toggles + Master settings */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={!viewerIsReady}
                    className={cn(toolbarButtonClass, toolbarBtnQuiet)}
                    title="Display options"
                    aria-label={studioShell ? "Show" : undefined}
                    data-studio-v4-secondary={studioShell ? "true" : undefined}
                  >
                    <SlidersHorizontal className="h-5 w-5" />
                    <span className={toolbarLabelClass}>Show</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal container={toolbarDropdownPortalContainer}>
                  <DropdownMenuContent data-studio-authoring-menu={studioShell && !isFullscreen ? "show" : undefined} data-studio-v4-shell={studioShell && isFullscreen ? "true" : undefined} data-studio-presentation-popup={studioShell && isFullscreen ? "true" : undefined} align="center" sideOffset={8} className="w-44">
                    <DropdownMenuCheckboxItem
                      checked={isGridActive}
                      onCheckedChange={() => handleToggleGrid()}
                      className="cursor-pointer whitespace-nowrap"
                    >
                      <Grid2x2 className="h-4 w-4 mr-2" /> Grids
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={isBordersActive}
                      onCheckedChange={() => handleToggleBorders()}
                      className="cursor-pointer whitespace-nowrap"
                    >
                      <Square className="h-4 w-4 mr-2" /> Borders
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setShowPresentationSettings(true)}
                      className="cursor-pointer whitespace-nowrap"
                    >
                      <Settings className="h-4 w-4 mr-2" /> Master…
                    </DropdownMenuItem>
                    {studioShell && viewerIsReady && (strawmanPreviewUrl || finalPresentationUrl) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Version</DropdownMenuLabel>
                        {versionMenuItems}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenu>
            </div>
        )
        const presentControl = (
              <button
                onClick={handleFullscreen}
                disabled={!viewerIsReady}
                className={cn(toolbarButtonClass, toolbarBtnBase)}
                title={isFullscreen ? "Exit fullscreen (ESC)" : "Present fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
                <span className={toolbarLabelClass}>{studioShell ? (isFullscreen ? 'Exit' : 'Present') : 'Play'}</span>
              </button>
        )

        const deliveryControls = (
          <div className="flex flex-shrink-0 items-center gap-1">
              {/* Save — transient status only; autosave is automatic, so nothing shows at rest */}
              <StudioToolbarSaveFeedback
                saveStatus={saveStatus}
                isSaving={isSaving}
                viewerIsReady={viewerIsReady}
                onSave={handleSaveChanges}
                toolbarButtonClass={toolbarButtonClass}
                toolbarLabelClass={toolbarLabelClass}
              />

              {/* Version switcher — only surfaces once a tagged strawman/final version exists */}
              {!studioShell && viewerIsReady && (strawmanPreviewUrl || finalPresentationUrl) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(toolbarButtonClass, toolbarBtnQuiet)}
                      title="Switch version"
                    >
                      <Layers className="h-5 w-5" />
                      <span className={toolbarLabelClass}>
                        {activeVersion === 'final' ? 'Final' : activeVersion === 'strawman' ? 'Strawman' : 'Custom'}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuPortal container={toolbarDropdownPortalContainer}>
                    <DropdownMenuContent data-studio-authoring-menu={studioShell && !isFullscreen ? "version" : undefined} data-studio-v4-shell={studioShell && isFullscreen ? "true" : undefined} data-studio-presentation-popup={studioShell && isFullscreen ? "true" : undefined} align="end" className="w-40">
                      {versionMenuItems}
                    </DropdownMenuContent>
                  </DropdownMenuPortal>
                </DropdownMenu>
              )}

              {/* Play */}
              {(!studioShell || isFullscreen) && presentControl}

              {/* Download Controls */}
              {viewerIsReady ? downloadControls : null}
            </div>
        )
        const toolbarContent = (
          <div className={cn(
            "flex items-center justify-between w-full min-w-0 gap-3",
            isFullscreen ? "px-4 py-2" : "px-3 h-full",
            presentViewOnlyActive && "justify-end",
            isGenerating && "pointer-events-none opacity-50"
          )}>
            {/* A4: the view-only frame refuses edits, so its Present toolbar carries no authoring controls. */}
            {presentViewOnlyActive ? null : authoringControls}
            {deliveryControls}
          </div>
        )

        return (
          <>
            {/* Fullscreen: inline floating overlay with auto-hide */}
            {isFullscreen && (
              <div data-studio-v4-shell={studioShell ? "true" : undefined} data-studio-presentation-toolbar={studioShell ? "true" : undefined} className={`absolute top-12 left-1/2 -translate-x-1/2 z-50 rounded-lg shadow-2xl border border-gray-200 bg-gray-50 transition-all duration-300 ${
                !showToolbar ? 'opacity-0 -translate-y-full pointer-events-none' : 'opacity-100 translate-y-0'
              }`}>
                {toolbarContent}
              </div>
            )}

            {studioShell && !isFullscreen && studioAuthoringPortalTarget && createPortal(
              <div data-studio-v4-authoring="true" className={cn(isGenerating && "pointer-events-none opacity-50")}>
                <div ref={authoringStripRef} data-studio-v4-authoring-controls="true" role="group" aria-label="Slide authoring controls">{authoringControls}</div>
              </div>,
              studioAuthoringPortalTarget
            )}
            {studioShell && !isFullscreen && studioPresentPortalTarget && createPortal(
              <div data-studio-slide-controls="true" role="group" aria-label="Presentation controls" className={cn(isGenerating && "pointer-events-none opacity-50")}>
              <span>Slide {currentSlide} / {visualTotalSlides || totalSlides || slideCount || (studioPartialArtifact ? '—' : 1)}</span>
                {presentControl}
              </div>,
              studioPresentPortalTarget
            )}
            {/* Normal: portal to header slot */}
            {!isFullscreen && toolbarPortalTarget && createPortal(
              studioShell ? <div data-studio-v4-delivery="true" className={cn(isGenerating && "pointer-events-none opacity-50")}>{deliveryControls}</div> : toolbarContent,
              toolbarPortalTarget
            )}

            {/* Fallback: inline if no portal target */}
            {!isFullscreen && !toolbarPortalTarget && (
              <div className="flex items-center justify-between px-6 py-2 bg-gray-50 border-b">
                {studioShell ? <div data-studio-v4-delivery="true" className={cn(isGenerating && "pointer-events-none opacity-50")}>{deliveryControls}</div> : toolbarContent}
              </div>
            )}
          </>
        )
      })()}

      {/* Main Content Area - Flex container for slide and thumbnails */}
      <div className={`flex-1 flex min-h-0 min-w-0 ${isFullscreen ? 'bg-black' : ''}`}>
        {/* Left: Presentation Area */}
        <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${isFullscreen ? 'bg-black' : 'overflow-hidden bg-gray-100 dark:bg-slate-800'}`}>
          {studioShell && !isFullscreen && showControls && (
            <div ref={setStudioAuthoringPortalTarget} data-studio-authoring-slot="true" />
          )}
          {/* Build Narration v2: ribbon slot — above the slide, height absorbed
              by the slide container's ResizeObserver fit-contain. */}
          {!isFullscreen && stageChrome?.ribbon ? (
            <div className="flex-shrink-0">{stageChrome.ribbon}</div>
          ) : null}
          {/* Presentation Iframe */}
          <div
            ref={slideContainerRef}
            data-studio-slide-space={studioShell ? "true" : undefined}
            tabIndex={studioShell && !isFullscreen && approvedPresentationUrl ? 0 : undefined}
            role={studioShell && !isFullscreen && approvedPresentationUrl ? "region" : undefined}
            aria-label={studioShell && !isFullscreen && approvedPresentationUrl ? "Slide canvas" : undefined}
            data-studio-template-active={studioShell ? String(templateModeOn) : undefined}
            className={cn(
              "flex-1 min-h-0 relative flex items-center justify-center overflow-hidden",
              isFullscreen ? 'bg-black' : 'bg-gray-100 dark:bg-slate-800 p-4',
              templateModeOn && "bg-slate-950/10 dark:bg-slate-950"
            )}
          >
            {templateModeOn && (
              <div className="pointer-events-none absolute left-1/2 top-4 z-30 flex -translate-x-1/2 flex-col items-center gap-1">
                <div className="rounded-full border border-violet-300 bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-700 shadow-lg dark:border-violet-700 dark:bg-slate-950/95 dark:text-violet-200">
                  Template Mode
                </div>
                <button
                  type="button"
                  className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-violet-200 bg-white/95 text-violet-700 shadow-lg transition hover:border-violet-300 hover:bg-violet-50 dark:border-violet-800 dark:bg-slate-950/95 dark:text-violet-200 dark:hover:bg-violet-950"
                  onClick={(event) => {
                    event.stopPropagation()
                    if (studioShell) viewerInteractionIntentRef.current += 1
                    void onTemplateModeChange?.(false)
                  }}
                  aria-label="Exit Template Mode"
                  title="Exit Template Mode"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {approvedPresentationUrl ? (
              <div
                className={cn(
                  isFullscreen || studioShell ? '' : 'max-w-7xl',
                  "relative",
                  templateModeOn
                    ? "overflow-visible rounded-md bg-violet-950/5 shadow-[0_0_0_9999px_rgba(15,23,42,0.08)]"
                    : "overflow-hidden"
                )}
                onClick={() => {
                  if (templateModeOn) onTemplateElementSelect?.(null)
                }}
                style={isFullscreen && fullscreenSlideSize ? {
                  // Use JavaScript-calculated dimensions for accuracy
                  width: fullscreenSlideSize.width,
                  height: fullscreenSlideSize.height
                } : normalSlideSize ? {
                  width: normalSlideSize.width,
                  height: normalSlideSize.height,
                } : {
                  aspectRatio: '16/9',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                }}
              >
                {templateModeOn && (
                  <div className="pointer-events-none absolute -inset-1 z-0 rounded-md border-2 border-dashed border-violet-400" />
                )}
                <div className="relative z-10 h-full w-full overflow-hidden rounded-sm">
                  <iframe
                  key={approvedIframeNavigationUrl}
                  ref={iframeRef}
                  src={approvedIframeNavigationUrl || undefined}
                  onLoad={handleIframeLoad}
                  className={cn(
                    "w-full h-full border-0 transition duration-200",
                    isFullscreen ? 'shadow-2xl' : 'rounded-sm shadow-2xl',
                    templateModeOn && "saturate-50 contrast-90"
                  )}
                  title="Presentation Viewer"
                  allow="fullscreen"
                />
                {presentViewOnlyActive && approvedIframeNavigationUrl && (
                  <PresentViewOnlyFrame
                    baseUrl={approvedIframeNavigationUrl}
                    startIndex={Math.max(0, currentSlide - 1)}
                    sendCommand={sendCommand}
                    frameRef={presentFrameRef}
                    onSlideIndex={(index) => { presentSlideIndexRef.current = index }}
                    onFailed={() => {
                      console.warn('[Present] View-only frame did not initialise; presenting the editing frame instead.')
                      setPresentFrameFailed(true)
                    }}
                  />
                )}
                {studioShell && !viewerHasLoaded && <div className="absolute inset-0 z-20 pointer-events-none" data-studio-viewer-loading="true">
                  <StudioWaitingState scope="canvas" message="Loading your slides…" />
                </div>}
                {templateModeOn && templateBuilderEnabled && (
                  <TemplateModeOverlay
                    snapshot={templateSnapshot}
                    currentSlideIndex={templateCurrentSlideIndex ?? currentSlide - 1}
                    loading={templateSnapshotLoading}
                    selectedElementId={selectedTemplateElementId}
                    blueprintEditorV2Enabled={blueprintEditorV2Enabled}
                    onSelectElement={onTemplateElementSelect}
                    onBlueprintChange={onTemplateBlueprintChange}
                  />
                )}
                </div>
                {/* Build Narration v2: frame slot — perimeter glow / QA pill /
                    click-shield at exact slide geometry (components own their
                    own positioning and pointer-events). */}
                {!isFullscreen && stageChrome?.frame}
                {/* Build Narration v2: placeholder slot — covers the iframe
                    (blank-landing card). Rendered after frame so it stacks
                    above it. */}
                {!isFullscreen && stageChrome?.placeholder}
              </div>
            ) : LAYOUT_URL_CONFIG_ERROR ? (
              <div role="alert" className="flex max-w-xl flex-col items-center justify-center rounded-lg border border-amber-300 bg-amber-50 p-8 text-center text-amber-950 shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <p className="text-base font-semibold">Slides are unavailable in this environment</p>
                <p className="mt-2 text-sm opacity-80">{LAYOUT_URL_CONFIG_ERROR.message}</p>
              </div>
            ) : viewerUrlDecision.status === 'blocked' ? (
              <div
                role="alert"
                className="flex max-w-xl flex-col items-center justify-center rounded-lg border border-amber-300 bg-amber-50 p-8 text-center text-amber-950 shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              >
                <p className="text-base font-semibold">Presentation blocked in this environment</p>
                <p className="mt-2 text-sm opacity-80">
                  This presentation points to a Layout Service origin that is not approved for this deployment.
                </p>
                {viewerUrlDecision.origin && (
                  <code className="mt-3 max-w-full break-all rounded bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
                    {viewerUrlDecision.origin}
                  </code>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center text-gray-400">
                <p>No presentation to display</p>
              </div>
            )}

            {/* Generation Overlay - covers slide area during generation */}
            {isGenerating && (
              <div data-studio-generation-cover={studioShell && !isFullscreen ? "true" : undefined} className="absolute inset-0 z-20 bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                <SlideBuildingLoader className="w-full h-full" mode={generatingMode} />
              </div>
            )}

            {/* Edit Mode Instructions - positioned absolutely to not shift slide */}
            {isEditMode && !isFullscreen && !studioShell && (
              <EditModeGuide />
            )}
          </div>

          {/* Studio edit guidance has its own row outside the fitted slide. */}
          {studioShell && isEditMode && !isFullscreen && (
            <EditModeGuide />
          )}

          {/* Build Narration v2: footer slot — below the slide (CoT lines,
              stage dots, research card). Same height-absorption rule as the
              notes panel beneath it. */}
          {!isFullscreen && stageChrome?.footer ? (
            <div className="flex-shrink-0">{stageChrome.footer}</div>
          ) : null}
          {/* Script | Notes | References — collapsible panel below the slide.
              The slide container's ResizeObserver fit-contain absorbs the
              height change; hidden while presenting fullscreen. */}
          {!isFullscreen && (
            <SlideNotesPanel
              presentationId={presentationId}
              currentSlideIndex={Math.max(0, currentSlide - 1)}
              slideStructure={slideStructure}
              sessionId={sessionId ?? null}
            />
          )}

          {/* powered by deckster — inside slide column so it tracks the slide's right edge */}
          {!isFullscreen && (
            <div data-studio-canvas-brand={studioShell ? "true" : undefined} className="flex-shrink-0 flex justify-end pr-4 py-0.5">
              {studioShell && (studioIntroReplay ?? <StudioIntroReplay className="studio-canvas-intro-replay" />)}
              {studioShell && showControls && <div ref={setStudioPresentPortalTarget} data-studio-present-slot="true" />}
              <Link
                href="/"
                aria-label={studioShell ? 'Deckster home' : undefined}
                className="group flex items-center opacity-60 hover:opacity-90 transition-opacity"
              >
                <span className="text-xs text-slate-600 dark:text-slate-300 mr-1">powered by</span>
                <img src="/logo-icon.png" alt="" aria-hidden className="h-8 w-auto" />
                <img src="/logo-wordmark.png" alt="Deckster" className="h-6 w-auto -ml-0.5" />
              </Link>
            </div>
          )}

        </div>

        {studioShell && !isFullscreen && showThumbnails && (
          <div
            data-studio-v4-thumbnail-resize="true"
            role="separator"
            tabIndex={0}
            aria-label="Resize slide thumbnails"
            aria-orientation="vertical"
            aria-valuemin={96}
            aria-valuemax={180}
            aria-valuenow={thumbnailWidth}
            aria-valuetext={`${thumbnailWidth} pixels`}
            title="Drag to resize thumbnails. Use Left and Right arrows, Home or End."
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              thumbnailResizeRef.current = { startX: event.clientX, width: thumbnailWidth }
              event.currentTarget.setPointerCapture(event.pointerId)
              event.currentTarget.focus({ preventScroll: true })
            }}
            onPointerMove={(event) => {
              const drag = thumbnailResizeRef.current
              if (drag) setThumbnailWidth(clampThumbnailWidth(drag.width + drag.startX - event.clientX))
            }}
            onPointerUp={(event) => {
              const drag = thumbnailResizeRef.current
              if (drag) rememberThumbnailWidth(drag.width + drag.startX - event.clientX)
              thumbnailResizeRef.current = null
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={() => { thumbnailResizeRef.current = null }}
            onLostPointerCapture={() => { thumbnailResizeRef.current = null }}
            onKeyDown={(event) => {
              const width = event.key === 'ArrowLeft' ? thumbnailWidth + (event.shiftKey ? 20 : 8)
                : event.key === 'ArrowRight' ? thumbnailWidth - (event.shiftKey ? 20 : 8)
                : event.key === 'Home' ? 96
                : event.key === 'End' ? 180 : null
              if (width === null) return
              event.preventDefault()
              event.stopPropagation() // Resize arrows must not navigate the deck.
              rememberThumbnailWidth(width)
            }}
          />
        )}

        {/* Right: Slide Thumbnail Handle — zero-width context, no grey line */}
        {!isFullscreen && (
          <div className="relative w-0 flex-shrink-0 z-10">
            <button
              data-studio-v4-thumbnail-toggle={studioShell ? "true" : undefined}
              onClick={handleToggleOverview}
              className={cn(
                "absolute top-[50%] -translate-y-1/2 right-0",
                "w-4 py-3 rounded-l-md shadow-sm border border-r-0",
                "flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors",
                showThumbnails
                  ? "bg-indigo-200 hover:bg-indigo-300 border-indigo-400 text-indigo-700 dark:bg-indigo-900/50 dark:hover:bg-indigo-800/60 dark:border-indigo-700 dark:text-indigo-200"
                  : "bg-indigo-100 hover:bg-indigo-200 border-indigo-300 text-indigo-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-indigo-300"
              )}
              title={showThumbnails ? "Hide thumbnails" : "Show thumbnails"}
              aria-label={showThumbnails ? "Hide thumbnails" : "Show thumbnails"}
              aria-expanded={showThumbnails}
            >
              {showThumbnails ? (
                <ChevronRight className="h-2.5 w-2.5" />
              ) : (
                <ChevronLeft className="h-2.5 w-2.5" />
              )}
              <span className="[writing-mode:vertical-rl] rotate-180 text-[9px] font-semibold uppercase tracking-wider select-none leading-none">
                Thumbnails
              </span>
            </button>
          </div>
        )}

        {/* Thumbnail Strip — separate flex participant */}
        {!isFullscreen && (
          <div data-studio-v4-thumbnails={studioShell ? "true" : undefined} style={studioShell ? { width: showThumbnails ? thumbnailWidth : 0 } : undefined} className={cn(
            "flex flex-col border-l border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0",
            !studioShell && "transition-[width] duration-300 ease-out",
            showThumbnails ? "w-36" : "w-0"
          )}>
            {showThumbnails && (slideThumbnails.length > 0 || composeJobs.length > 0) && (
              <SlideThumbnailStrip
                slides={slideThumbnails}
                currentSlide={currentSlide}
                onSlideClick={(slideNumber) => {
                  handleGoToSlide(slideNumber - 1) // Convert 1-based to 0-based index
                }}
                orientation="vertical"
                // Multi-select support
                selectedSlides={selectedSlideIndices}
                onSelectionChange={setSelectedSlideIndices}
                // CRUD handlers
                onDuplicateSlide={handleDuplicateSlide}
                onDeleteSlide={handleOpenDeleteDialog}
                onDeleteSlides={handleOpenBulkDeleteDialog}
                onChangeLayout={handleChangeLayout}
                onReorderSlides={handleReorderSlides}
                enableDragDrop={true}
                totalSlides={totalSlides}
                composeJobs={composeJobs}
                onRefineSlide={onRefineSlide}
                keyBySlideId={railIdentityRows !== null}
              />
            )}
          </div>
        )}
      </div>

      {/* Delete Slide Confirmation Dialog */}
      <DeleteSlideDialog
        open={showDeleteDialog}
        onOpenChange={handleDeleteDialogOpenChange}
        slideNumbers={slidesToDelete ? slidesToDelete.map(i => i + 1) : []}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Save as Template (Template Builder) */}
      <TemplateSaveDialog
        open={showTemplateSave}
        onOpenChange={setShowTemplateSave}
        sessionId={sessionId ?? null}
        deckOwnerSessionId={deckOwnerSessionId ?? null}
        sourcePresentationId={templateModeOn ? null : resolvedTemplateSavePresentationId}
        onSavedTemplate={onSelectTemplate}
        onTemplateOptimizationFailed={onTemplateOptimizationFailed}
      />

      {/* Upload presentation → template (Template Ingest, C-7) */}
      {templateIngestEnabled && (
        <TemplateIngestDialog
          open={showTemplateIngest}
          onOpenChange={setShowTemplateIngest}
        />
      )}

      {/* Version History Panel */}
      {VIEWER_ORIGIN && !LAYOUT_URL_CONFIG_ERROR && <VersionHistoryPanel
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        iframeRef={iframeRef}
        viewerOrigin={VIEWER_ORIGIN}
      />}

      {/* Presentation Settings Panel (Footer, Logo) */}
      {VIEWER_ORIGIN && !LAYOUT_URL_CONFIG_ERROR && <PresentationSettingsPanel
        isOpen={showPresentationSettings}
        onClose={() => setShowPresentationSettings(false)}
        iframeRef={iframeRef}
        viewerOrigin={VIEWER_ORIGIN}
        currentSlide={currentSlide}
        totalSlides={totalSlides}
        presentationId={presentationId}
      />}

      {/* Theme Panel */}
      <ThemePanel
        isOpen={showThemePanel}
        onClose={() => setShowThemePanel(false)}
        presentationId={presentationId}
        buildThemeSelection={buildThemeSelection}
        themeSync={themeSync}
        selectionLocked={templateSelectionLocked}
        onBuildThemeChange={onBuildThemeChange}
      />
    </div>
  )
}
