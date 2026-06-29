"use client"

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
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
  FileText,
  Settings2,
  Eye,
  Sun,
  Moon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { debugLog } from '@/lib/debug-log'
import { isMatchingSlideComposeCommandResponse } from '@/lib/slide-compose-async'
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
import { SaveStatus } from './save-status-indicator'
import { SlideLayoutPicker, SlideLayoutType } from './slide-layout-picker'
import { DeleteSlideDialog } from './delete-slide-dialog'
import { TemplateSaveDialog } from './template-save-dialog'
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
import type { TemplateSnapshot } from '@/hooks/use-templates'
import {
  LAYOUT_SERVICE_COMMANDS,
  getCommandType,
  isElementorCommand
} from '@/lib/element-command-router'
import {
  ELEMENTOR_BASE_URL,
  getElementorEndpoint,
  ElementorContext,
  ElementorPosition
} from '@/lib/elementor-client'
import { SlideBuildingLoader } from './slide-building-loader'

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
}

interface PresentationViewerProps {
  presentationUrl: string
  presentationId: string | null
  slideCount: number | null
  slideStructure?: any // SlideUpdate payload from WebSocket
  showControls?: boolean
  downloadControls?: React.ReactNode
  onSlideChange?: (slideNumber: number) => void
  onEditModeChange?: (isEditing: boolean) => void
  className?: string
  // Version switching support (Builder V2: now includes 'blank' version)
  strawmanPreviewUrl?: string | null
  finalPresentationUrl?: string | null
  activeVersion?: 'blank' | 'strawman' | 'final'
  onVersionSwitch?: (version: 'blank' | 'strawman' | 'final') => void
  // Text box panel callbacks
  onTextBoxSelected?: (elementId: string, formatting: TextBoxFormatting | null) => void
  onTextBoxDeselected?: () => void
  // Element panel callbacks (Image, Table, Chart, Infographic, Diagram)
  onElementSelected?: (elementId: string, elementType: ElementType, properties: ElementProperties) => void
  onElementDeselected?: () => void
  // Text Labs Generation Panel - opens generation panel for the given element type
  onOpenGenerationPanel?: (type: string) => void  // Uses string to avoid coupling to TextLabsComponentType
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
  // Template Builder: the WS session id (source for "Save as Template") + gate
  sessionId?: string | null
  templateBuilderEnabled?: boolean
  onSelectTemplate?: (template: { id: string; name: string }) => void
  templateModeOn?: boolean
  onTemplateModeChange?: (enabled: boolean) => void
  templateModeAvailable?: boolean
  composeJobs?: SlideComposeThumbnailJob[]
  templateSnapshot?: TemplateSnapshot | null
  templateSnapshotLoading?: boolean
  templateCurrentSlideIndex?: number
  selectedTemplateElementId?: string | null
  onTemplateElementSelect?: (overrideKey: string | null) => void
  // Expose Layout Service API handlers for external use (e.g., Format Panel)
  onApiReady?: (apis: {
    getSelectionInfo: () => Promise<SelectionInfo | null>
    updateSectionContent: (slideIndex: number, sectionId: string, content: string) => Promise<boolean>
    sendTextBoxCommand: (action: string, params: Record<string, any>) => Promise<any>
    sendElementCommand: (action: string, params: Record<string, any>) => Promise<any>
  }) => void
  onComposeApiReady?: (apis: SlideComposeViewerApi | null) => void
}

export interface SlideComposeViewerApi {
  composePlaceholderAdd: (jobId: string, visualIndex: number, replaceJobId?: string) => Promise<any>
  composeSlideReconcile: (
    jobId: string,
    realSlideIndex: number,
    realSlideId?: string | null,
    presentationId?: string | null,
  ) => Promise<any>
  composePlaceholderFail: (jobId: string) => Promise<any>
}

interface SlideInfo {
  index: number
  total: number
}

// Viewer origin for postMessage communication
const VIEWER_ORIGIN = 'https://web-production-f0d13.up.railway.app'

/**
 * Send command to iframe via postMessage (cross-origin safe)
 */
type SendCommandOptions = {
  timeoutMs?: number
  expectedJobId?: string | null
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

  return new Promise((resolve, reject) => {
    if (!iframe) {
      reject(new Error('Iframe not ready'))
      return
    }

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
      // Only accept messages from viewer origin
      if (event.origin !== VIEWER_ORIGIN) return

      if (isMatchingSlideComposeCommandResponse(event.data, {
        action,
        requestId,
        expectedJobId: options.expectedJobId,
      })) {
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
      settle(() => reject(new Error('Command timeout')))
    }, timeoutMs)

    iframe.contentWindow?.postMessage({ action, params, requestId }, VIEWER_ORIGIN)
  })
}

export function PresentationViewer({
  presentationUrl,
  presentationId,
  slideCount,
  slideStructure,
  showControls = true,
  downloadControls,
  onSlideChange,
  onEditModeChange,
  className = '',
  strawmanPreviewUrl,
  finalPresentationUrl,
  activeVersion = 'final',
  onVersionSwitch,
  onTextBoxSelected,
  onTextBoxDeselected,
  onElementSelected,
  onElementDeselected,
  onApiReady,
  onComposeApiReady,
  onOpenGenerationPanel,
  onElementMoved,
  toolbarPortalTarget,
  toolbarOffset = 0,
  connected,
  connecting,
  isGenerating,
  generatingMode,
  sessionId,
  templateBuilderEnabled,
  onSelectTemplate,
  templateModeOn = false,
  onTemplateModeChange,
  templateModeAvailable = false,
  composeJobs = [],
  templateSnapshot = null,
  templateSnapshotLoading = false,
  templateCurrentSlideIndex,
  selectedTemplateElementId = null,
  onTemplateElementSelect,
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
  const [toolbarTemplateMenuOpen, setToolbarTemplateMenuOpen] = useState(false)
  const [toolbarTemplatePickerOpen, setToolbarTemplatePickerOpen] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(1) // Start at 1 (slides are 1-indexed)
  const [totalSlides, setTotalSlides] = useState(slideCount || 0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showThumbnails, setShowThumbnails] = useState(true) // Show by default
  const [showToolbar, setShowToolbar] = useState(true) // For auto-hide in fullscreen
  const [iframeReady, setIframeReady] = useState(false)
  const [pollingFailureCount, setPollingFailureCount] = useState(0)
  const lastSlideInfoRef = useRef<{ slide: number; total: number } | null>(null)
  const onSlideChangeRef = useRef(onSlideChange)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [slidesToDelete, setSlidesToDelete] = useState<number[] | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Multi-select state for slide thumbnails
  const [selectedSlideIndices, setSelectedSlideIndices] = useState<number[]>([])
  // Track when CRUD operations have modified slides (invalidates stale slideStructure)
  const [slidesModifiedByCrud, setSlidesModifiedByCrud] = useState(false)
  const toolbarDropdownPortalContainer = isFullscreen ? containerRef.current ?? undefined : undefined
  // Text box selection state
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
  // Version history panel state
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showPresentationSettings, setShowPresentationSettings] = useState(false)
  const [showThemePanel, setShowThemePanel] = useState(false)
  // View mode toggles (grid, borders, edit) - only shown in non-fullscreen
  const [isGridActive, setIsGridActive] = useState(false)
  const [isBordersActive, setIsBordersActive] = useState(false)
  // Speaker notes — default OFF (user opts in via the Show menu). The
  // Layout Service honors ?showNotes=true/false on the iframe URL; in
  // fullscreen we always force false regardless of this state.
  const [isNotesActive, setIsNotesActive] = useState(false)
  // Theme — read from next-themes (canonical theme source, shared with
  // the profile-menu's "Dark Mode" toggle). Used inside the Mode dropdown.
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    onSlideChangeRef.current = onSlideChange
  }, [onSlideChange])

  // Sync totalSlides with slideCount prop changes
  useEffect(() => {
    if (slideCount && slideCount > 0) {
      setTotalSlides(prev => {
        if (prev === slideCount) return prev
        debugLog(`📊 Updating totalSlides: ${prev} → ${slideCount}`)
        return slideCount
      })
    }
  }, [slideCount])

  // Reset CRUD modification flag when fresh slideStructure arrives from WebSocket
  useEffect(() => {
    if (slideStructure?.slides) {
      setSlidesModifiedByCrud(false)
      debugLog('📡 Fresh slideStructure received, reset CRUD flag')
    }
  }, [slideStructure])

  // Reset iframe ready state when presentation URL changes
  useEffect(() => {
    debugLog('🔄 Presentation URL changed, resetting iframe state')
    setIframeReady(false)
    setPollingFailureCount(0)
    lastSlideInfoRef.current = null
  }, [presentationUrl])

  // Handle iframe load event
  const handleIframeLoad = useCallback(() => {
    debugLog('✅ Iframe loaded and ready')
    setIframeReady(true)
    setPollingFailureCount(0) // Reset failure count on load
    lastSlideInfoRef.current = null
  }, [])

  // Extract slide thumbnails from slideStructure
  // Use totalSlides when: CRUD ops occurred, OR slideStructure is stale/missing
  const slideThumbnails = useMemo<SlideThumbnail[]>(() => {
    // Detect if slideStructure count doesn't match totalSlides (stale data)
    const structureCountMismatch = slideStructure?.slides &&
      totalSlides > 0 &&
      slideStructure.slides.length !== totalSlides

    // Use totalSlides when: CRUD modified, count mismatch, or no structure
    if (slidesModifiedByCrud || structureCountMismatch || !slideStructure || !slideStructure.slides) {
      if (totalSlides > 0) {
        return Array.from({ length: totalSlides }, (_, i) => ({
          slideNumber: i + 1,
          title: `Slide ${i + 1}`
        }))
      }
      return []
    }

    // slideStructure is fresh and matches totalSlides - use rich data
    return slideStructure.slides.map((slide: any, index: number) => ({
      slideNumber: index + 1,
      title: slide.title || slide.slide_type || `Slide ${index + 1}`,
      content: slide.narrative || slide.key_points?.join(', ')
    }))
  }, [slideStructure, totalSlides, slidesModifiedByCrud])

  // Define handlers FIRST (before effects that use them)
  const handleNextSlide = useCallback(async () => {
    debugLog('🔘 Next button clicked!')
    if (!iframeRef.current) {
      debugLog('❌ Iframe not ready')
      return
    }
    try {
      await sendCommand(iframeRef.current, 'nextSlide')
      // Immediately update local state (polling will confirm/sync)
      if (currentSlide < (totalSlides || 999)) {
        const newSlide = currentSlide + 1
        setCurrentSlide(newSlide)
        onSlideChange?.(newSlide)
        debugLog(`➡️ Next slide (${currentSlide} → ${newSlide})`)
      }
    } catch (error) {
      console.error('Error navigating to next slide:', error)
    }
  }, [currentSlide, totalSlides, onSlideChange])

  const handlePrevSlide = useCallback(async () => {
    debugLog('🔘 Prev button clicked!')
    debugLog(`   Current slide: ${currentSlide}, Total: ${totalSlides}`)
    debugLog(`   Button should be disabled: ${currentSlide <= 1}`)
    if (!iframeRef.current) {
      debugLog('❌ Iframe not ready')
      return
    }
    try {
      debugLog('📤 Sending prevSlide command...')
      await sendCommand(iframeRef.current, 'prevSlide')
      // Immediately update local state (polling will confirm/sync)
      if (currentSlide > 1) {
        const newSlide = currentSlide - 1
        setCurrentSlide(newSlide)
        onSlideChange?.(newSlide)
        debugLog(`⬅️ Previous slide (${currentSlide} → ${newSlide})`)
      }
    } catch (error) {
      console.error('❌ Error navigating to previous slide:', error)
    }
  }, [currentSlide, totalSlides, onSlideChange])

  const handleToggleOverview = useCallback(() => {
    debugLog('🔘 Grid button clicked - toggling thumbnail strip!')
    setShowThumbnails(prev => !prev)
  }, [])

  // Toggle grid overlay via postMessage (fire-and-forget to avoid timeout on hide)
  const handleToggleGrid = useCallback(() => {
    if (!iframeRef.current) return
    const nextActive = !isGridActive
    setIsGridActive(nextActive)
    iframeRef.current.contentWindow?.postMessage(
      { action: nextActive ? 'showGridOverlay' : 'hideGridOverlay' },
      VIEWER_ORIGIN
    )
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
  const handleToggleEditModeButton = useCallback(async () => {
    if (!iframeRef.current) return
    try {
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
  }, [isEditMode, onEditModeChange])

  const handleGoToSlide = useCallback(async (slideIndex: number) => {
    debugLog(`🎯 Navigating to slide ${slideIndex + 1}`)
    if (!iframeRef.current) {
      debugLog('❌ Iframe not ready')
      return
    }
    try {
      const result = await sendCommand(iframeRef.current, 'goToSlide', { index: slideIndex })
      debugLog(`✅ Navigated to slide ${slideIndex + 1}`)
      setCurrentSlide(slideIndex + 1)
    } catch (error) {
      console.error('Error navigating to slide:', error)
    }
  }, [])

  // Poll for slide info updates via postMessage (with exponential backoff)
  useEffect(() => {
    // Don't poll if iframe isn't ready
    if (!iframeReady) {
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
      if (!iframeRef.current || !iframeReady) return

      try {
        const result = await sendCommand(iframeRef.current, 'getCurrentSlideInfo')
        if (result.success && result.data) {
          const slideNum = result.data.index + 1 // Convert 0-based to 1-based
          const total = result.data.total || 0
          const previous = lastSlideInfoRef.current
          const slideInfoChanged = !previous || previous.slide !== slideNum || previous.total !== total

          if (slideInfoChanged) {
            debugLog(`📊 Slide info: ${slideNum} / ${total}`)
            lastSlideInfoRef.current = { slide: slideNum, total }
            setCurrentSlide(prev => prev === slideNum ? prev : slideNum)
            setTotalSlides(prev => prev === total ? prev : total)
            onSlideChangeRef.current?.(slideNum)
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
  }, [iframeReady, pollingFailureCount])

  // Force save handler (for Ctrl+S and retry on error)
  // IMPORTANT: Must be declared BEFORE the keyboard shortcuts useEffect that references it
  const handleForceSave = useCallback(async () => {
    if (!iframeRef.current) return

    setSaveStatus('saving')
    try {
      await sendCommand(iframeRef.current, 'forceSave')
      setSaveStatus('saved')
      debugLog('💾 Force save completed')
    } catch (error) {
      console.error('Error forcing save:', error)
      setSaveStatus('error')
    }
  }, [])

  // Keyboard shortcuts (handlers are now defined above)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!iframeRef.current) return
      if (isGenerating) return

      // Only handle if not in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
  }, [handleNextSlide, handlePrevSlide, handleToggleOverview, isEditMode, handleForceSave, handleToggleGrid, handleToggleBorders, handleToggleEditModeButton, isGenerating])

  // Lazy edit mode: automatically enter edit mode when needed
  const ensureEditMode = useCallback(async (): Promise<boolean> => {
    // Already in edit mode? Return immediately
    if (isEditMode) return true

    if (!iframeRef.current) {
      debugLog('❌ Iframe not ready for edit mode')
      return false
    }

    try {
      const result = await sendCommand(iframeRef.current, 'toggleEditMode')
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
  }, [isEditMode, onEditModeChange])

  const handleSaveChanges = useCallback(async () => {
    if (!iframeRef.current) return

    setIsSaving(true)
    try {
      await sendCommand(iframeRef.current, 'saveAllChanges')
      debugLog('💾 Changes saved successfully')

      // Exit edit mode after saving
      setIsEditMode(false)
      onEditModeChange?.(false)
    } catch (error) {
      console.error('Error saving changes:', error)
      alert('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [onEditModeChange])

  const handleCancelEdits = useCallback(async () => {
    if (!iframeRef.current) return

    // Confirm before canceling
    if (!confirm('Are you sure you want to discard all changes?')) {
      return
    }

    try {
      await sendCommand(iframeRef.current, 'cancelEdits')
      setIsEditMode(false)
      onEditModeChange?.(false)
      debugLog('🚫 Edits canceled')
    } catch (error) {
      console.error('Error canceling edits:', error)
    }
  }, [onEditModeChange])

  // Add slide handler
  const handleAddSlide = useCallback(async (layoutId: SlideLayoutType) => {
    if (!iframeRef.current) {
      toast({
        title: 'Error',
        description: 'Presentation not ready',
        variant: 'destructive'
      })
      return
    }

    try {
      const result = await sendCommand(iframeRef.current, 'addSlide', {
        layout: layoutId,
        position: currentSlide // Insert after current slide (0-based in iframe)
      })

      if (result.success) {
        // Backend sends slide_index and slide_count directly (not nested in data)
        const newSlideIndex = result.slide_index ?? result.data?.slideIndex ?? currentSlide
        const newTotal = result.slide_count ?? result.data?.slideCount ?? totalSlides + 1

        setTotalSlides(newTotal)
        setCurrentSlide(newSlideIndex + 1) // Update local state (1-based)
        setSlidesModifiedByCrud(true) // Invalidate stale slideStructure

        // Navigate iframe to the new slide (PowerPoint/Keynote behavior)
        await sendCommand(iframeRef.current, 'goToSlide', { index: newSlideIndex })

        // Activate element borders for editing (like pressing 'B')
        await sendCommand(iframeRef.current, 'toggleBorderHighlight')

        // Auto-enter edit mode after adding a slide
        await ensureEditMode()

        toast({
          title: 'Slide Added',
          description: `New slide inserted at position ${newSlideIndex + 1}`
        })

        debugLog(`➕ Added ${layoutId} slide at position ${newSlideIndex + 1}`)
      }
    } catch (error) {
      console.error('Error adding slide:', error)
      toast({
        title: 'Error',
        description: 'Failed to add slide. Please try again.',
        variant: 'destructive'
      })
    }
  }, [currentSlide, totalSlides, toast, ensureEditMode])

  // Duplicate slide handler
  const handleDuplicateSlide = useCallback(async (slideIndex: number) => {
    if (!iframeRef.current) return

    try {
      const result = await sendCommand(iframeRef.current, 'duplicateSlide', {
        index: slideIndex,      // snake_case to match backend
        insert_after: true
      })

      if (result.success) {
        // Backend sends new_slide_index directly (not nested in data)
        const newSlideIndex = result.new_slide_index ?? result.data?.newSlideIndex ?? slideIndex + 1
        const newTotal = result.slide_count ?? result.data?.slideCount ?? totalSlides + 1

        setTotalSlides(newTotal)
        setCurrentSlide(newSlideIndex + 1)
        setSlidesModifiedByCrud(true) // Invalidate stale slideStructure

        toast({
          title: 'Slide Duplicated',
          description: `Slide copied to position ${newSlideIndex + 1}`
        })

        debugLog(`📋 Duplicated slide ${slideIndex + 1} → ${newSlideIndex + 1}`)
      }
    } catch (error) {
      console.error('Error duplicating slide:', error)
      toast({
        title: 'Error',
        description: 'Failed to duplicate slide. Please try again.',
        variant: 'destructive'
      })
    }
  }, [totalSlides, toast])

  // Open delete dialog for single slide
  const handleOpenDeleteDialog = useCallback((slideIndex: number) => {
    setSlidesToDelete([slideIndex])
    setShowDeleteDialog(true)
  }, [])

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
    setSlidesToDelete(slideIndices)
    setShowDeleteDialog(true)
  }, [totalSlides, toast])

  // Confirm delete slide(s) - uses bulk deleteSlides endpoint
  const handleConfirmDelete = useCallback(async () => {
    if (!slidesToDelete || slidesToDelete.length === 0 || !iframeRef.current) return

    setIsDeleting(true)
    try {
      debugLog('🗑️ Attempting bulk delete with indices:', slidesToDelete)

      // Use bulk delete endpoint - pass all indices at once
      const result = await sendCommand(iframeRef.current, 'deleteSlides', {
        indices: slidesToDelete  // 0-based indices
      })

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

      setTotalSlides(remainingCount)
      setSlidesModifiedByCrud(true) // Invalidate stale slideStructure
      setSelectedSlideIndices([]) // Clear selection after delete

      // Adjust current slide if needed
      if (currentSlide > remainingCount) {
        setCurrentSlide(remainingCount)
      } else {
        // Find how many deleted slides were before current
        const deletedBefore = slidesToDelete.filter(i => i < currentSlide - 1).length
        if (deletedBefore > 0) {
          setCurrentSlide(currentSlide - deletedBefore)
        }
      }

      const message = deletedCount === 1
        ? `Slide ${slidesToDelete[0] + 1} has been removed`
        : `${deletedCount} slides have been removed`

      toast({
        title: deletedCount === 1 ? 'Slide Deleted' : 'Slides Deleted',
        description: message
      })

      debugLog(`🗑️ Bulk deleted ${deletedCount} slide(s), ${remainingCount} remaining`)
    } catch (error) {
      console.error('Error deleting slides:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete slides. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
      setSlidesToDelete(null)
    }
  }, [slidesToDelete, totalSlides, currentSlide, toast])

  // Change slide layout handler
  const handleChangeLayout = useCallback(async (slideIndex: number, newLayout: SlideLayoutType) => {
    if (!iframeRef.current) return

    try {
      const result = await sendCommand(iframeRef.current, 'changeSlideLayout', {
        index: slideIndex,       // snake_case to match backend
        new_layout: newLayout,
        preserve_content: true
      })

      if (result.success) {
        toast({
          title: 'Layout Changed',
          description: `Slide ${slideIndex + 1} layout updated`
        })

        debugLog(`🔄 Changed slide ${slideIndex + 1} layout to ${newLayout}`)
      }
    } catch (error) {
      console.error('Error changing layout:', error)
      toast({
        title: 'Error',
        description: 'Failed to change layout. Please try again.',
        variant: 'destructive'
      })
    }
  }, [toast])

  // Reorder slides handler
  const handleReorderSlides = useCallback(async (fromIndex: number, toIndex: number) => {
    if (!iframeRef.current) return

    try {
      const result = await sendCommand(iframeRef.current, 'reorderSlides', {
        from_index: fromIndex,   // snake_case to match backend
        to_index: toIndex
      })

      if (result.success) {
        // Update current slide if it was moved
        if (currentSlide === fromIndex + 1) {
          setCurrentSlide(toIndex + 1)
        }
        setSlidesModifiedByCrud(true) // Invalidate stale slideStructure

        toast({
          title: 'Slide Moved',
          description: `Slide moved from position ${fromIndex + 1} to ${toIndex + 1}`
        })

        debugLog(`↕️ Moved slide ${fromIndex + 1} → ${toIndex + 1}`)
      }
    } catch (error) {
      console.error('Error reordering slides:', error)
      toast({
        title: 'Error',
        description: 'Failed to reorder slides. Please try again.',
        variant: 'destructive'
      })
    }
  }, [currentSlide, toast, ensureEditMode])

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
  }, [toast])

  // Send text box command to iframe (for TextBoxFormatPanel)
  const handleSendTextBoxCommand = useCallback(async (action: string, params: Record<string, any>) => {
    if (!iframeRef.current) {
      throw new Error('Iframe not ready')
    }
    return sendCommand(iframeRef.current, action, params)
  }, [])

  // Trigger iframe refresh after Elementor auto-injection
  const triggerIframeRefresh = useCallback(() => {
    if (!iframeRef.current) return

    // Send refreshSlide command to iframe - Layout Service will reload current slide
    iframeRef.current.contentWindow?.postMessage(
      { action: 'refreshSlide' },
      VIEWER_ORIGIN
    )
    debugLog('[Elementor] Triggered iframe refresh after auto-injection')
  }, [])

  // Send element command - routes to Layout Service or Elementor as appropriate
  const handleSendElementCommand = useCallback(async (action: string, params: Record<string, any>) => {
    if (!iframeRef.current) {
      throw new Error('Iframe not ready')
    }

    const commandType = getCommandType(action)

    // Direct Layout Service command - send to iframe
    if (commandType === 'layout-service') {
      debugLog(`[ElementCommand] Layout Service: ${action}`, params)
      return sendCommand(iframeRef.current, action, params)
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

        const response = await fetch(`${ELEMENTOR_BASE_URL}${endpoint}`, {
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
  }, [presentationId, currentSlide, triggerIframeRefresh])

  const handleComposePlaceholderAdd = useCallback((jobId: string, visualIndex: number, replaceJobId?: string) => {
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

  // Expose APIs to parent component when iframe is ready
  useEffect(() => {
    if (iframeReady && onApiReady) {
      onApiReady({
        getSelectionInfo: handleGetSelectionInfo,
        updateSectionContent: handleUpdateSectionContent,
        sendTextBoxCommand: handleSendTextBoxCommand,
        sendElementCommand: handleSendElementCommand
      })
    }
  }, [iframeReady, onApiReady, handleGetSelectionInfo, handleUpdateSectionContent, handleSendTextBoxCommand, handleSendElementCommand])

  useEffect(() => {
    if (!onComposeApiReady) return

    if (!iframeReady) {
      onComposeApiReady(null)
      return
    }

    onComposeApiReady({
      composePlaceholderAdd: handleComposePlaceholderAdd,
      composeSlideReconcile: handleComposeSlideReconcile,
      composePlaceholderFail: handleComposePlaceholderFail,
    })

    return () => onComposeApiReady(null)
  }, [
    iframeReady,
    onComposeApiReady,
    handleComposePlaceholderAdd,
    handleComposeSlideReconcile,
    handleComposePlaceholderFail,
  ])

  const handleFullscreen = useCallback(async () => {
    if (!containerRef.current) return

    try {
      if (!document.fullscreenElement) {
        // Exit edit mode before entering fullscreen (presentation mode should not be editable)
        if (isEditMode && iframeRef.current) {
          await sendCommand(iframeRef.current, 'exitEditMode')
          setIsEditMode(false)
          onEditModeChange?.(false)
          debugLog('✏️ Exited edit mode for fullscreen presentation')
        }

        // Hide grid overlay before entering fullscreen
        if (isGridActive && iframeRef.current) {
          await sendCommand(iframeRef.current, 'hideGridOverlay')
          setIsGridActive(false)
          debugLog('📐 Hid grid overlay for fullscreen presentation')
        }

        // Hide border highlight before entering fullscreen
        if (isBordersActive && iframeRef.current) {
          await sendCommand(iframeRef.current, 'hideBorderHighlight')
          setIsBordersActive(false)
          debugLog('🔲 Hid borders for fullscreen presentation')
        }

        // Enter fullscreen on container - we control the UI with black backgrounds
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
        debugLog('🖥️ Entered fullscreen mode')
      } else {
        // Exit fullscreen
        await document.exitFullscreen()
        setIsFullscreen(false)
        debugLog('🖥️ Exited fullscreen mode')
      }
    } catch (error) {
      console.error('❌ Fullscreen error:', error)
    }
  }, [isEditMode, onEditModeChange, isGridActive, isBordersActive])

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

  // Listen for save status events from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== VIEWER_ORIGIN) return

      // Handle save status updates from auto-save system
      if (event.data.type === 'save_status') {
        const status = event.data.status as SaveStatus
        setSaveStatus(status)
        debugLog(`💾 Save status: ${status}`)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Listen for text box selection events from iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== VIEWER_ORIGIN) return

      // Handle text box selection - auto-enter edit mode
      if (event.data.type === 'textBoxSelected') {
        const elementId = event.data.elementId
        const formatting = event.data.formatting as TextBoxFormatting | null

        // Auto-enter edit mode when user clicks on a text box
        await ensureEditMode()

        setSelectedTextBoxId(elementId)
        onTextBoxSelected?.(elementId, formatting)
        debugLog(`📦 Text box selected: ${elementId}`)
      }

      // Handle text box deselection
      if (event.data.type === 'textBoxDeselected') {
        setSelectedTextBoxId(null)
        onTextBoxDeselected?.()
        debugLog('📦 Text box deselected')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onTextBoxSelected, onTextBoxDeselected, ensureEditMode])

  // Listen for element selection events from iframe (Image, Chart, Table, Infographic, Diagram)
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== VIEWER_ORIGIN) return

      // Handle element selection - auto-enter edit mode and show format panel
      if (event.data.type === 'elementSelected') {
        const elementId = event.data.elementId as string
        const elementType = event.data.elementType as ElementType
        const properties = event.data.properties as ElementProperties

        // Auto-enter edit mode when user clicks on an element
        await ensureEditMode()

        // Notify parent to show the appropriate format panel
        onElementSelected?.(elementId, elementType, properties)
        debugLog(`🎯 Element selected: ${elementType} (${elementId})`)
      }

      // Handle element deselection
      if (event.data.type === 'elementDeselected') {
        onElementDeselected?.()
        debugLog('🎯 Element deselected')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onElementSelected, onElementDeselected, ensureEditMode])

  // Listen for element moved/resized events from iframe
  useEffect(() => {
    if (!onElementMoved) return

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== VIEWER_ORIGIN) return

      if (event.data.type === 'elementMoved' || event.data.action === 'elementMoved') {
        const elementId = event.data.elementId as string
        const position = event.data.position || event.data
        const gridRow = position.gridRow as string
        const gridColumn = position.gridColumn as string

        if (elementId && gridRow && gridColumn) {
          onElementMoved(elementId, gridRow, gridColumn)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onElementMoved])

  return (
    <div ref={containerRef} className={`relative flex flex-col h-full ${className} ${isFullscreen ? 'bg-black' : ''}`}>
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
            disabled: !presentationUrl,
            action: () => onOpenGenerationPanel ? onOpenGenerationPanel('TABLE') : handleInsertTable(3, 3),
          },
          {
            label: 'Metrics',
            icon: TrendingUp,
            disabled: !presentationUrl || !onOpenGenerationPanel,
            action: () => onOpenGenerationPanel?.('METRICS'),
          },
          {
            label: 'Chart',
            icon: BarChart3,
            disabled: !presentationUrl,
            action: () => onOpenGenerationPanel ? onOpenGenerationPanel('CHART') : handleInsertChart({ type: 'bar' }),
          },
          {
            label: 'Text Box',
            icon: Type,
            disabled: !presentationUrl,
            action: () => onOpenGenerationPanel ? onOpenGenerationPanel('TEXT_BOX') : handleInsertTextBox(),
          },
          {
            label: 'Image',
            icon: Image,
            disabled: !presentationUrl,
            action: () => onOpenGenerationPanel ? onOpenGenerationPanel('IMAGE') : handleInsertImage(),
          },
          {
            label: 'Infographic',
            icon: LayoutGrid,
            disabled: !presentationUrl,
            action: () => onOpenGenerationPanel ? onOpenGenerationPanel('INFOGRAPHIC') : handleInsertInfographic(),
          },
          {
            label: 'Diagram',
            icon: GitBranch,
            disabled: !presentationUrl,
            action: () => onOpenGenerationPanel ? onOpenGenerationPanel('DIAGRAM') : handleInsertDiagram(),
          },
        ]

        const toolbarContent = (
          <div className={cn(
            "flex items-center justify-between w-full min-w-0 gap-3",
            isFullscreen ? "px-4 py-2" : "px-3 h-full",
            isGenerating && "pointer-events-none opacity-50"
          )}>
            {/* LEFT — build cluster (Add Slide, Add Element, Template, Theme) + quiet view helpers (Mode, Show) */}
            <div
              className={cn(
                "flex items-center gap-1 min-w-0",
                !isFullscreen && "transition-[margin] duration-300 ease-out"
              )}
              style={!isFullscreen ? { marginLeft: toolbarOffset } : undefined}
            >
              {/* Add Slide */}
              <SlideLayoutPicker
                onAddSlide={handleAddSlide}
                disabled={!presentationUrl || templateModeOn}
                className="min-w-[80px] justify-center"
              />

              {/* Add Element — same Plus icon as Add Slide; label disambiguates */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={!presentationUrl || templateModeOn}
                    className={cn(toolbarButtonClass, toolbarBtnBase, "min-w-[96px]")}
                    title="Add an element"
                  >
                    <Plus className="h-5 w-5" />
                    <span className={cn(toolbarLabelClass, "whitespace-nowrap")}>Add Element</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal container={toolbarDropdownPortalContainer}>
                  <DropdownMenuContent align="start" sideOffset={8} className="w-52 p-1">
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
                      disabled={!presentationUrl || !sessionId}
                      className={cn(toolbarButtonClass, toolbarBtnBase)}
                      title="Template options"
                    >
                      <LayoutTemplate className="h-5 w-5" />
                      <span className={toolbarLabelClass}>Template</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuPortal container={toolbarDropdownPortalContainer}>
                    <DropdownMenuContent align="center" sideOffset={8} className="w-56 p-1">
                      <DropdownMenuItem
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
                        <DropdownMenuSubTrigger className="cursor-pointer gap-2">
                          <LayoutTemplate className="h-4 w-4 text-gray-600" />
                          <span>Available Templates</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent alignOffset={-4} className="w-64">
                          <TemplatePickerContent
                            label="Available templates"
                            isOpen={toolbarTemplatePickerOpen}
                            onSelect={(template) => {
                              onSelectTemplate?.(template)
                              setToolbarTemplatePickerOpen(false)
                              setToolbarTemplateMenuOpen(false)
                            }}
                          />
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
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
                disabled={!presentationUrl || templateModeOn}
                className={cn(toolbarButtonClass, toolbarBtnBase)}
                title="Presentation theme"
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
                    className={cn(toolbarButtonClass, toolbarBtnQuiet)}
                    title="Editing mode + theme"
                  >
                    <Settings2 className="h-5 w-5" />
                    <span className={toolbarLabelClass}>Mode</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal container={toolbarDropdownPortalContainer}>
                  <DropdownMenuContent align="center" sideOffset={8} className="w-44">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Editing mode
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={isEditMode ? 'edit' : 'view'}
                      onValueChange={(v) => {
                        const wantsEdit = v === 'edit'
                        if (wantsEdit !== isEditMode) void handleToggleEditModeButton()
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
                    className={cn(toolbarButtonClass, toolbarBtnQuiet)}
                    title="Display options"
                  >
                    <SlidersHorizontal className="h-5 w-5" />
                    <span className={toolbarLabelClass}>Show</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal container={toolbarDropdownPortalContainer}>
                  <DropdownMenuContent align="center" sideOffset={8} className="w-44">
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
                    <DropdownMenuCheckboxItem
                      checked={isNotesActive}
                      onCheckedChange={() => setIsNotesActive((prev) => !prev)}
                      className="cursor-pointer whitespace-nowrap"
                    >
                      <FileText className="h-4 w-4 mr-2" /> Notes
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setShowPresentationSettings(true)}
                      className="cursor-pointer whitespace-nowrap"
                    >
                      <Settings className="h-4 w-4 mr-2" /> Master…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenu>
            </div>

            {/* RIGHT — present: the two highest-value present actions (Play, Download) */}
            <div className="flex flex-shrink-0 items-center gap-1">
              {/* Save — transient status only; autosave is automatic, so nothing shows at rest */}
              {saveStatus === 'saving' || isSaving ? (
                <div
                  className={cn(toolbarButtonClass, "text-slate-600 dark:text-slate-300 cursor-default")}
                  title="Saving…"
                >
                  <div className="h-5 w-5 flex items-center justify-center">
                    <div className="h-3.5 w-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <span className={toolbarLabelClass}>Saving</span>
                </div>
              ) : saveStatus === 'unsaved' || saveStatus === 'error' ? (
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving || !presentationUrl}
                  className={cn(toolbarButtonClass, "bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 dark:text-amber-200")}
                  title="Save changes now"
                >
                  <Save className="h-5 w-5" />
                  <span className={toolbarLabelClass}>Save</span>
                </button>
              ) : null}

              {/* Version switcher — only surfaces once a tagged strawman/final version exists */}
              {(strawmanPreviewUrl || finalPresentationUrl) && (
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
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
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
                          onClick={() => onVersionSwitch?.('final')}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>Final</span>
                            {activeVersion === 'final' && <Check className="h-4 w-4 text-blue-500" />}
                          </div>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenuPortal>
                </DropdownMenu>
              )}

              {/* Play */}
              <button
                onClick={handleFullscreen}
                disabled={!presentationUrl}
                className={cn(toolbarButtonClass, toolbarBtnBase)}
                title={isFullscreen ? "Exit fullscreen (ESC)" : "Present fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
                <span className={toolbarLabelClass}>Play</span>
              </button>

              {/* Download Controls */}
              {downloadControls}
            </div>
          </div>
        )

        return (
          <>
            {/* Fullscreen: inline floating overlay with auto-hide */}
            {isFullscreen && (
              <div className={`absolute top-12 left-1/2 -translate-x-1/2 z-50 rounded-lg shadow-2xl border border-gray-200 bg-gray-50 transition-all duration-300 ${
                !showToolbar ? 'opacity-0 -translate-y-full pointer-events-none' : 'opacity-100 translate-y-0'
              }`}>
                {toolbarContent}
              </div>
            )}

            {/* Normal: portal to header slot */}
            {!isFullscreen && toolbarPortalTarget && createPortal(
              toolbarContent,
              toolbarPortalTarget
            )}

            {/* Fallback: inline if no portal target */}
            {!isFullscreen && !toolbarPortalTarget && (
              <div className="flex items-center justify-between px-6 py-2 bg-gray-50 border-b">
                {toolbarContent}
              </div>
            )}
          </>
        )
      })()}

      {/* Main Content Area - Flex container for slide and thumbnails */}
      <div className={`flex-1 flex min-h-0 min-w-0 ${isFullscreen ? 'bg-black' : ''}`}>
        {/* Left: Presentation Area */}
        <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${isFullscreen ? 'bg-black' : 'overflow-hidden bg-gray-100 dark:bg-slate-800'}`}>
          {/* Presentation Iframe */}
          <div
            ref={slideContainerRef}
            className={cn(
              "flex-1 min-h-0 relative flex items-center justify-center overflow-hidden",
              isFullscreen ? 'bg-black' : 'bg-gray-100 dark:bg-slate-800 p-4',
              templateModeOn && "bg-slate-950/10 dark:bg-slate-950"
            )}
          >
            {templateModeOn && (
              <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full border border-violet-300 bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-700 shadow-lg dark:border-violet-700 dark:bg-slate-950/95 dark:text-violet-200">
                Template Mode
              </div>
            )}
            {presentationUrl ? (
              <div
                className={cn(
                  isFullscreen ? '' : 'max-w-7xl',
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
                  ref={iframeRef}
                  src={(() => {
                    // showNotes: true when the user has the Notes toggle on
                    // AND we're not in fullscreen presentation mode.
                    // Layout Service honors ?showNotes=true|false on the
                    // iframe URL (see docs/BACKEND_REQUEST_THUMBNAILS_AND_NOTES.md).
                    const showNotesInIframe = !isFullscreen && isNotesActive
                    try {
                      const u = new URL(presentationUrl, window.location.href)
                      u.searchParams.set('showNotes', String(showNotesInIframe))
                      return u.toString()
                    } catch {
                      return presentationUrl
                    }
                  })()}
                  onLoad={handleIframeLoad}
                  className={cn(
                    "w-full h-full border-0 transition duration-200",
                    isFullscreen ? 'shadow-2xl' : 'rounded-sm shadow-2xl',
                    templateModeOn && "saturate-50 contrast-90"
                  )}
                  title="Presentation Viewer"
                  allow="fullscreen"
                />
                {templateModeOn && templateBuilderEnabled && (
                  <TemplateModeOverlay
                    snapshot={templateSnapshot}
                    currentSlideIndex={templateCurrentSlideIndex ?? currentSlide - 1}
                    loading={templateSnapshotLoading}
                    selectedElementId={selectedTemplateElementId}
                    onSelectElement={onTemplateElementSelect}
                  />
                )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center text-gray-400">
                <p>No presentation to display</p>
              </div>
            )}

            {/* Generation Overlay - covers slide area during generation */}
            {isGenerating && (
              <div className="absolute inset-0 z-20 bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                <SlideBuildingLoader className="w-full h-full" mode={generatingMode} />
              </div>
            )}

            {/* Edit Mode Instructions - positioned absolutely to not shift slide */}
            {isEditMode && !isFullscreen && (
              <div className="absolute bottom-0 left-0 right-0 px-3 py-1 text-[10px] text-stone-400">
                <span className="font-semibold text-stone-300">Edit Mode:</span> Click on any text to edit. Select text for formatting toolbar.
                <span className="ml-1.5 text-[9px] text-stone-500">
                  Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+U (Underline), Ctrl+S (Save)
                </span>
              </div>
            )}
          </div>

          {/* powered by deckster — inside slide column so it tracks the slide's right edge */}
          {!isFullscreen && (
            <div className="flex-shrink-0 flex justify-end pr-4 py-0.5">
              <Link
                href="/"
                className="group flex items-center opacity-60 hover:opacity-90 transition-opacity"
              >
                <span className="text-xs text-slate-600 dark:text-slate-300 mr-1">powered by</span>
                <img src="/logo-icon.png" alt="" aria-hidden className="h-8 w-auto" />
                <img src="/logo-wordmark.png" alt="Deckster" className="h-6 w-auto -ml-0.5" />
              </Link>
            </div>
          )}

        </div>

        {/* Right: Slide Thumbnail Handle — zero-width context, no grey line */}
        {!isFullscreen && (
          <div className="relative w-0 flex-shrink-0 z-10">
            <button
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
          <div className={cn(
            "flex flex-col border-l border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0",
            "transition-[width] duration-300 ease-out",
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
              />
            )}
          </div>
        )}
      </div>

      {/* Delete Slide Confirmation Dialog */}
      <DeleteSlideDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        slideNumbers={slidesToDelete ? slidesToDelete.map(i => i + 1) : []}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Save as Template (Template Builder) */}
      <TemplateSaveDialog
        open={showTemplateSave}
        onOpenChange={setShowTemplateSave}
        sessionId={sessionId ?? null}
      />

      {/* Version History Panel */}
      <VersionHistoryPanel
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        iframeRef={iframeRef}
        viewerOrigin={VIEWER_ORIGIN}
      />

      {/* Presentation Settings Panel (Footer, Logo) */}
      <PresentationSettingsPanel
        isOpen={showPresentationSettings}
        onClose={() => setShowPresentationSettings(false)}
        iframeRef={iframeRef}
        viewerOrigin={VIEWER_ORIGIN}
        currentSlide={currentSlide}
        totalSlides={totalSlides}
        presentationId={presentationId}
      />

      {/* Theme Panel */}
      <ThemePanel
        isOpen={showThemePanel}
        onClose={() => setShowThemePanel(false)}
        iframeRef={iframeRef}
        viewerOrigin={VIEWER_ORIGIN}
        presentationId={presentationId}
      />
    </div>
  )
}
