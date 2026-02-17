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
  Type,
  Image,
  LayoutGrid,
  GitBranch,
  History,
  Grid2x2,
  Square,
  Pencil,
  Settings,
  Palette,
  TrendingUp,
  Tag,
  Pentagon,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SlideThumbnailStrip, SlideThumbnail } from './slide-thumbnail-strip'
import { SaveStatus } from './save-status-indicator'
import { SlideLayoutPicker, SlideLayoutType } from './slide-layout-picker'
import { DeleteSlideDialog } from './delete-slide-dialog'
import { useToast } from '@/hooks/use-toast'
// TextFormatPopover is now replaced by simple text box insertion button
// Keeping FormatTextParams for backward compatibility if needed
import { FormatTextParams } from './text-format-popover'
import { TableInsertPopover, generateTableHTML } from './table-insert-popover'
import { ChartPickerPopover, InsertChartParams, generateChartConfig } from './chart-picker-popover'
import { ElementType, ElementProperties, BaseElementProperties } from '@/types/elements'
import { VersionHistoryPanel } from './version-history-panel'
import { PresentationSettingsPanel } from './presentation-settings-panel'
import { ThemePanel } from './theme-panel'
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
  // Generation overlay: keeps viewer mounted but overlays loader
  isGenerating?: boolean
  generatingMode?: 'default' | 'strawman'
  // Expose Layout Service API handlers for external use (e.g., Format Panel)
  onApiReady?: (apis: {
    getSelectionInfo: () => Promise<SelectionInfo | null>
    updateSectionContent: (slideIndex: number, sectionId: string, content: string) => Promise<boolean>
    sendTextBoxCommand: (action: string, params: Record<string, any>) => Promise<any>
    sendElementCommand: (action: string, params: Record<string, any>) => Promise<any>
  }) => void
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
function sendCommand(
  iframe: HTMLIFrameElement | null,
  action: string,
  params?: Record<string, any>
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!iframe) {
      reject(new Error('Iframe not ready'))
      return
    }

    const handler = (event: MessageEvent) => {
      // Only accept messages from viewer origin
      if (event.origin !== VIEWER_ORIGIN) return

      if (event.data.action === action) {
        window.removeEventListener('message', handler)

        if (event.data.success) {
          resolve(event.data)
        } else {
          reject(new Error(event.data.error || 'Command failed'))
        }
      }
    }

    window.addEventListener('message', handler)

    // Timeout after 5 seconds
    setTimeout(() => {
      window.removeEventListener('message', handler)
      reject(new Error('Command timeout'))
    }, 5000)

    iframe.contentWindow?.postMessage({ action, params }, VIEWER_ORIGIN)
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
  onOpenGenerationPanel,
  onElementMoved,
  toolbarPortalTarget,
  connected,
  connecting,
  isGenerating,
  generatingMode,
}: PresentationViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const slideContainerRef = useRef<HTMLDivElement>(null)
  const gridInitializedRef = useRef(false)
  const { toast } = useToast()
  const [isEditMode, setIsEditMode] = useState(false)
  // Fullscreen slide dimensions (calculated via JS for accuracy)
  const [fullscreenSlideSize, setFullscreenSlideSize] = useState<{ width: number; height: number } | null>(null)
  // Normal-mode slide dimensions (fit-contain via ResizeObserver)
  const [normalSlideSize, setNormalSlideSize] = useState<{ width: number; height: number } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(1) // Start at 1 (slides are 1-indexed)
  const [totalSlides, setTotalSlides] = useState(slideCount || 0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showThumbnails, setShowThumbnails] = useState(true) // Show by default
  const [showToolbar, setShowToolbar] = useState(true) // For auto-hide in fullscreen
  const [iframeReady, setIframeReady] = useState(false)
  const [pollingFailureCount, setPollingFailureCount] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [slidesToDelete, setSlidesToDelete] = useState<number[] | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Multi-select state for slide thumbnails
  const [selectedSlideIndices, setSelectedSlideIndices] = useState<number[]>([])
  // Track when CRUD operations have modified slides (invalidates stale slideStructure)
  const [slidesModifiedByCrud, setSlidesModifiedByCrud] = useState(false)
  // Text box selection state
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
  // Version history panel state
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showPresentationSettings, setShowPresentationSettings] = useState(false)
  const [showThemePanel, setShowThemePanel] = useState(false)
  // View mode toggles (grid, borders, edit) - only shown in non-fullscreen
  const [isGridActive, setIsGridActive] = useState(false)
  const [isBordersActive, setIsBordersActive] = useState(false)

  // Sync totalSlides with slideCount prop changes
  useEffect(() => {
    if (slideCount && slideCount > 0) {
      console.log(`📊 Updating totalSlides: ${totalSlides} → ${slideCount}`)
      setTotalSlides(slideCount)
    }
  }, [slideCount])

  // Reset CRUD modification flag when fresh slideStructure arrives from WebSocket
  useEffect(() => {
    if (slideStructure?.slides) {
      setSlidesModifiedByCrud(false)
      console.log('📡 Fresh slideStructure received, reset CRUD flag')
    }
  }, [slideStructure])

  // Reset iframe ready state when presentation URL changes
  useEffect(() => {
    console.log('🔄 Presentation URL changed, resetting iframe state')
    setIframeReady(false)
    setPollingFailureCount(0)
  }, [presentationUrl])

  // Handle iframe load event
  const handleIframeLoad = useCallback(() => {
    console.log('✅ Iframe loaded and ready')
    setIframeReady(true)
    setPollingFailureCount(0) // Reset failure count on load
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
    console.log('🔘 Next button clicked!')
    if (!iframeRef.current) {
      console.log('❌ Iframe not ready')
      return
    }
    try {
      await sendCommand(iframeRef.current, 'nextSlide')
      // Immediately update local state (polling will confirm/sync)
      if (currentSlide < (totalSlides || 999)) {
        const newSlide = currentSlide + 1
        setCurrentSlide(newSlide)
        onSlideChange?.(newSlide)
        console.log(`➡️ Next slide (${currentSlide} → ${newSlide})`)
      }
    } catch (error) {
      console.error('Error navigating to next slide:', error)
    }
  }, [currentSlide, totalSlides, onSlideChange])

  const handlePrevSlide = useCallback(async () => {
    console.log('🔘 Prev button clicked!')
    console.log(`   Current slide: ${currentSlide}, Total: ${totalSlides}`)
    console.log(`   Button should be disabled: ${currentSlide <= 1}`)
    if (!iframeRef.current) {
      console.log('❌ Iframe not ready')
      return
    }
    try {
      console.log('📤 Sending prevSlide command...')
      await sendCommand(iframeRef.current, 'prevSlide')
      // Immediately update local state (polling will confirm/sync)
      if (currentSlide > 1) {
        const newSlide = currentSlide - 1
        setCurrentSlide(newSlide)
        onSlideChange?.(newSlide)
        console.log(`⬅️ Previous slide (${currentSlide} → ${newSlide})`)
      }
    } catch (error) {
      console.error('❌ Error navigating to previous slide:', error)
    }
  }, [currentSlide, totalSlides, onSlideChange])

  const handleToggleOverview = useCallback(() => {
    console.log('🔘 Grid button clicked - toggling thumbnail strip!')
    setShowThumbnails(prev => !prev)
  }, [])

  // Toggle grid overlay via postMessage (fire-and-forget to avoid timeout on hide)
  // Layout Service quirk: first activation needs 1 command, every subsequent toggle needs 2
  const handleToggleGrid = useCallback(() => {
    if (!iframeRef.current) return
    const nextActive = !isGridActive
    setIsGridActive(nextActive)
    const action = nextActive ? 'showGridOverlay' : 'hideGridOverlay'
    iframeRef.current.contentWindow?.postMessage({ action }, VIEWER_ORIGIN)
    if (gridInitializedRef.current) {
      setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage({ action }, VIEWER_ORIGIN)
      }, 50)
    }
    gridInitializedRef.current = true
    console.log(`📐 Grid overlay: ${nextActive ? 'ON' : 'OFF'}`)
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
      console.log(`🔲 Borders: ${!isBordersActive ? 'ON' : 'OFF'}`)
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
      console.log(`✏️ Edit mode: ${!isEditMode ? 'ON' : 'OFF'}`)
    } catch (error) {
      console.error('Error toggling edit mode:', error)
    }
  }, [isEditMode, onEditModeChange])

  const handleGoToSlide = useCallback(async (slideIndex: number) => {
    console.log(`🎯 Navigating to slide ${slideIndex + 1}`)
    if (!iframeRef.current) {
      console.log('❌ Iframe not ready')
      return
    }
    try {
      const result = await sendCommand(iframeRef.current, 'goToSlide', { index: slideIndex })
      console.log(`✅ Navigated to slide ${slideIndex + 1}`)
      setCurrentSlide(slideIndex + 1)
    } catch (error) {
      console.error('Error navigating to slide:', error)
    }
  }, [])

  // Poll for slide info updates via postMessage (with exponential backoff)
  useEffect(() => {
    // Don't poll if iframe isn't ready
    if (!iframeReady) {
      console.log('⏸️ Polling paused - iframe not ready yet')
      return
    }

    // Stop polling after too many consecutive failures (10 failures = ~5 seconds)
    const MAX_FAILURES = 10
    if (pollingFailureCount >= MAX_FAILURES) {
      console.warn(`🛑 Polling stopped after ${MAX_FAILURES} consecutive failures`)
      return
    }

    // Exponential backoff: start at 500ms, double on each failure (max 4s)
    const baseInterval = 500
    const backoffInterval = Math.min(baseInterval * Math.pow(2, pollingFailureCount), 4000)

    const interval = setInterval(async () => {
      if (!iframeRef.current || !iframeReady) return

      try {
        const result = await sendCommand(iframeRef.current, 'getCurrentSlideInfo')
        if (result.success && result.data) {
          const slideNum = result.data.index + 1 // Convert 0-based to 1-based
          console.log(`📊 Slide info: ${slideNum} / ${result.data.total}`)
          setCurrentSlide(slideNum)
          setTotalSlides(result.data.total)
          onSlideChange?.(slideNum)

          // Reset failure count on success
          setPollingFailureCount(0)
        }
      } catch (error) {
        // Increment failure count and apply backoff
        setPollingFailureCount(prev => prev + 1)
        console.log(`⏸️ Polling failed (attempt ${pollingFailureCount + 1}/${MAX_FAILURES})`)
      }
    }, backoffInterval)

    return () => clearInterval(interval)
  }, [iframeReady, pollingFailureCount, onSlideChange])

  // Force save handler (for Ctrl+S and retry on error)
  // IMPORTANT: Must be declared BEFORE the keyboard shortcuts useEffect that references it
  const handleForceSave = useCallback(async () => {
    if (!iframeRef.current) return

    setSaveStatus('saving')
    try {
      await sendCommand(iframeRef.current, 'forceSave')
      setSaveStatus('saved')
      console.log('💾 Force save completed')
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
      console.log('❌ Iframe not ready for edit mode')
      return false
    }

    try {
      const result = await sendCommand(iframeRef.current, 'toggleEditMode')
      if (result.isEditing) {
        setIsEditMode(true)
        onEditModeChange?.(true)
        console.log('✏️ Auto-entered edit mode')
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
      console.log('💾 Changes saved successfully')

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
      console.log('🚫 Edits canceled')
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

        console.log(`➕ Added ${layoutId} slide at position ${newSlideIndex + 1}`)
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

        console.log(`📋 Duplicated slide ${slideIndex + 1} → ${newSlideIndex + 1}`)
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
      console.log('🗑️ Attempting bulk delete with indices:', slidesToDelete)

      // Use bulk delete endpoint - pass all indices at once
      const result = await sendCommand(iframeRef.current, 'deleteSlides', {
        indices: slidesToDelete  // 0-based indices
      })

      console.log('🗑️ Bulk delete response:', result)

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

      console.log(`🗑️ Bulk deleted ${deletedCount} slide(s), ${remainingCount} remaining`)
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

        console.log(`🔄 Changed slide ${slideIndex + 1} layout to ${newLayout}`)
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

        console.log(`↕️ Moved slide ${fromIndex + 1} → ${toIndex + 1}`)
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
        console.log('✏️ Text formatted:', params)
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
          console.log(`📊 Table element inserted via Layout Service: ${properties.elementId}`)
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

    // Create default properties for new chart
    const properties: ElementProperties = {
      type: 'chart',
      elementId: mockElementId,
      position: { x: 5, y: 15 },
      size: { width: 60, height: 60 },
      rotation: 0,
      locked: false,
      zIndex: 1,
      chartType: params.type,
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
          console.log(`📈 Chart element inserted via Layout Service: ${properties.elementId}`)
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
          console.log(`📷 Image element inserted via Layout Service: ${properties.elementId}`)
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
          console.log(`📊 Infographic element inserted via Layout Service: ${properties.elementId}`)
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
          console.log(`🔀 Diagram element inserted via Layout Service: ${properties.elementId}`)
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
        console.log(`📝 Inserted text box: ${elementId}`)
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
        console.log(`🗑️ Deleted text box: ${selectedTextBoxId}`)
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
        console.log(`✅ Updated section ${sectionId} on slide ${slideIndex + 1}`)
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
    console.log('[Elementor] Triggered iframe refresh after auto-injection')
  }, [])

  // Send element command - routes to Layout Service or Elementor as appropriate
  const handleSendElementCommand = useCallback(async (action: string, params: Record<string, any>) => {
    if (!iframeRef.current) {
      throw new Error('Iframe not ready')
    }

    const commandType = getCommandType(action)

    // Direct Layout Service command - send to iframe
    if (commandType === 'layout-service') {
      console.log(`[ElementCommand] Layout Service: ${action}`, params)
      return sendCommand(iframeRef.current, action, params)
    }

    // Elementor command - call Elementor API (auto-injects into Layout Service)
    if (commandType === 'elementor') {
      const endpoint = getElementorEndpoint(action)
      if (!endpoint) {
        throw new Error(`No Elementor endpoint found for: ${action}`)
      }

      console.log(`[ElementCommand] Elementor: ${action} -> ${endpoint}`)

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

        console.log(`[ElementCommand] Elementor generated and auto-injected: ${data.element_id}`)

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

  const handleFullscreen = useCallback(async () => {
    if (!containerRef.current) return

    try {
      if (!document.fullscreenElement) {
        // Exit edit mode before entering fullscreen (presentation mode should not be editable)
        if (isEditMode && iframeRef.current) {
          await sendCommand(iframeRef.current, 'exitEditMode')
          setIsEditMode(false)
          onEditModeChange?.(false)
          console.log('✏️ Exited edit mode for fullscreen presentation')
        }

        // Hide grid overlay before entering fullscreen
        if (isGridActive && iframeRef.current) {
          iframeRef.current.contentWindow?.postMessage({ action: 'hideGridOverlay' }, VIEWER_ORIGIN)
          if (gridInitializedRef.current) {
            setTimeout(() => {
              iframeRef.current?.contentWindow?.postMessage({ action: 'hideGridOverlay' }, VIEWER_ORIGIN)
            }, 50)
          }
          setIsGridActive(false)
          gridInitializedRef.current = false
          console.log('📐 Hid grid overlay for fullscreen presentation')
        }

        // Hide border highlight before entering fullscreen
        if (isBordersActive && iframeRef.current) {
          await sendCommand(iframeRef.current, 'hideBorderHighlight')
          setIsBordersActive(false)
          console.log('🔲 Hid borders for fullscreen presentation')
        }

        // Enter fullscreen on container - we control the UI with black backgrounds
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
        console.log('🖥️ Entered fullscreen mode')
      } else {
        // Exit fullscreen
        await document.exitFullscreen()
        setIsFullscreen(false)
        console.log('🖥️ Exited fullscreen mode')
      }
    } catch (error) {
      console.error('❌ Fullscreen error:', error)
    }
  }, [isEditMode, onEditModeChange, isGridActive, isBordersActive])

  // Debug: Log button states
  useEffect(() => {
    console.log(`🎯 Button states - currentSlide: ${currentSlide}, totalSlides: ${totalSlides}`)
    console.log(`   Prev disabled: ${currentSlide === 1}`)
    console.log(`   Next disabled: ${currentSlide === totalSlides}`)
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

      console.log(`📐 Fullscreen slide size: ${Math.round(width)}x${Math.round(height)} (container: ${containerWidth}x${containerHeight})`)
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
        console.log(`💾 Save status: ${status}`)
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
        console.log(`📦 Text box selected: ${elementId}`)
      }

      // Handle text box deselection
      if (event.data.type === 'textBoxDeselected') {
        setSelectedTextBoxId(null)
        onTextBoxDeselected?.()
        console.log('📦 Text box deselected')
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
        console.log(`🎯 Element selected: ${elementType} (${elementId})`)
      }

      // Handle element deselection
      if (event.data.type === 'elementDeselected') {
        onElementDeselected?.()
        console.log('🎯 Element deselected')
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
        const toolbarContent = (
          <div className={cn(
            "flex items-center justify-between w-full",
            isFullscreen ? "px-6 py-2" : "px-4 h-full",
            isGenerating && "pointer-events-none opacity-50"
          )}>
            {/* Left Group: Add Slide + Edit */}
            <div className="flex items-center gap-4">
              {/* Add Slide */}
              <SlideLayoutPicker
                onAddSlide={handleAddSlide}
                disabled={!presentationUrl}
              />

              {/* Save */}
              <>
                <div className="w-px h-10 bg-gray-200" />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveChanges}
                    disabled={isSaving || !presentationUrl}
                    className="flex flex-col items-center gap-0.5 px-3 py-1 rounded bg-green-50 hover:bg-green-100 disabled:opacity-50 transition-colors"
                    title="Save changes"
                  >
                    <Save className="h-5 w-5 text-green-600" />
                    <span className="text-[10px] text-green-600 font-medium">{isSaving ? 'Saving' : 'Save'}</span>
                  </button>
                </div>
              </>
            </div>

            {/* Center Group: Insert & Format Tools */}
            <div className="flex items-center gap-1">
              {/* Fullscreen / Play */}
              <button
                onClick={handleFullscreen}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 transition-colors"
                title={isFullscreen ? "Exit fullscreen (ESC)" : "Present fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5 text-gray-700" />
                ) : (
                  <Play className="h-5 w-5 text-gray-700" />
                )}
                <span className="text-[10px] text-gray-500">Play</span>
              </button>

              <div className="w-px h-10 bg-gray-200 mx-2" />

              {/* Table */}
              {onOpenGenerationPanel ? (
                <button
                  onClick={() => onOpenGenerationPanel('TABLE')}
                  disabled={!presentationUrl}
                  className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Insert table"
                >
                  <Grid2x2 className="h-5 w-5 text-gray-700" />
                  <span className="text-[10px] text-gray-500">Table</span>
                </button>
              ) : (
                <TableInsertPopover
                  onInsertTable={handleInsertTable}
                  disabled={!presentationUrl}
                />
              )}

              {/* Metrics */}
              <button
                onClick={() => onOpenGenerationPanel?.('METRICS')}
                disabled={!presentationUrl || !onOpenGenerationPanel}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Insert metrics (KPI cards)"
              >
                <TrendingUp className="h-5 w-5 text-gray-700" />
                <span className="text-[10px] text-gray-500">Metrics</span>
              </button>

              {/* Chart */}
              {onOpenGenerationPanel ? (
                <button
                  onClick={() => onOpenGenerationPanel('CHART')}
                  disabled={!presentationUrl}
                  className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Insert chart"
                >
                  <svg className="h-5 w-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  <span className="text-[10px] text-gray-500">Chart</span>
                </button>
              ) : (
                <ChartPickerPopover
                  onInsertChart={handleInsertChart}
                  disabled={!presentationUrl}
                />
              )}

              {/* Text Box */}
              <button
                onClick={() => onOpenGenerationPanel ? onOpenGenerationPanel('TEXT_BOX') : handleInsertTextBox()}
                disabled={!presentationUrl}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Insert text box"
              >
                <Type className="h-5 w-5 text-gray-700" />
                <span className="text-[10px] text-gray-500">Text</span>
              </button>

              {/* Image */}
              <button
                onClick={() => onOpenGenerationPanel ? onOpenGenerationPanel('IMAGE') : handleInsertImage()}
                disabled={!presentationUrl}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Insert image (AI generated)"
              >
                <Image className="h-5 w-5 text-gray-700" />
                <span className="text-[10px] text-gray-500">Image</span>
              </button>

              {/* Icon/Label */}
              <button
                onClick={() => onOpenGenerationPanel?.('ICON_LABEL')}
                disabled={!presentationUrl || !onOpenGenerationPanel}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Insert icon or label"
              >
                <Tag className="h-5 w-5 text-gray-700" />
                <span className="text-[10px] text-gray-500">Icon</span>
              </button>

              {/* Shape */}
              <button
                onClick={() => onOpenGenerationPanel?.('SHAPE')}
                disabled={!presentationUrl || !onOpenGenerationPanel}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Insert shape"
              >
                <Pentagon className="h-5 w-5 text-gray-700" />
                <span className="text-[10px] text-gray-500">Shape</span>
              </button>

              {/* Infographic */}
              <button
                onClick={() => onOpenGenerationPanel ? onOpenGenerationPanel('INFOGRAPHIC') : handleInsertInfographic()}
                disabled={!presentationUrl}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Insert infographic"
              >
                <LayoutGrid className="h-5 w-5 text-gray-700" />
                <span className="text-[10px] text-gray-500">Infographic</span>
              </button>

              {/* Diagram */}
              <button
                onClick={() => onOpenGenerationPanel ? onOpenGenerationPanel('DIAGRAM') : handleInsertDiagram()}
                disabled={!presentationUrl}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Insert diagram (Mermaid)"
              >
                <GitBranch className="h-5 w-5 text-gray-700" />
                <span className="text-[10px] text-gray-500">Diagram</span>
              </button>
            </div>

            {/* Right Group: Version History + Version + Status + Download + Counter */}
            <div className="flex items-center gap-3">
              {/* Version History */}
              <button
                onClick={() => setShowVersionHistory(true)}
                disabled={!presentationUrl}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Version history"
              >
                <History className="h-5 w-5 text-gray-700" />
                <span className="text-[10px] text-gray-500">History</span>
              </button>

              {/* Version Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-gray-100 transition-colors"
                    title="Switch version"
                  >
                    <Layers className="h-5 w-5 text-gray-700" />
                    <span className="text-[10px] text-gray-500">
                      {activeVersion === 'final' ? 'Final' : activeVersion === 'strawman' ? 'Strawman' : 'Custom'}
                    </span>
                  </button>
                </DropdownMenuTrigger>
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
              </DropdownMenu>

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
        <div className={`flex-1 flex flex-col min-w-0 ${isFullscreen ? 'bg-black' : 'overflow-hidden'}`}>
          {/* Presentation Iframe */}
          <div
            ref={slideContainerRef}
            className={`flex-1 min-h-0 relative flex items-center justify-center overflow-hidden ${isFullscreen ? 'bg-black' : 'bg-gray-800 p-4'}`}
          >
            {presentationUrl ? (
              <div
                className={isFullscreen ? '' : 'max-w-7xl'}
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
                <iframe
                  ref={iframeRef}
                  src={presentationUrl}
                  onLoad={handleIframeLoad}
                  className={`w-full h-full border-0 ${isFullscreen ? 'shadow-2xl' : 'rounded-sm shadow-2xl'}`}
                  title="Presentation Viewer"
                  allow="fullscreen"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center text-gray-400">
                <p>No presentation to display</p>
              </div>
            )}

            {/* Generation Overlay - covers slide area during generation */}
            {isGenerating && (
              <div className="absolute inset-0 z-20 bg-gray-800 flex items-center justify-center">
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

          {/* View Mode Controls - Grid, Borders, Edit (below slide, non-fullscreen only) */}
          {!isFullscreen && (
            <div className={cn(
              "px-3 py-1.5 bg-gray-50 border-t border-gray-200 flex items-center gap-3",
              isGenerating && "pointer-events-none opacity-50"
            )}>
              <span className="text-[11px] text-gray-500 font-medium">View:</span>

              {/* Grid Toggle */}
              <button
                onClick={handleToggleGrid}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  isGridActive
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
                title="Toggle grid overlay (G)"
              >
                <Grid2x2 className="h-3 w-3" />
                Grid
              </button>

              {/* Borders Toggle */}
              <button
                onClick={handleToggleBorders}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  isBordersActive
                    ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
                title="Toggle element borders (B)"
              >
                <Square className="h-3 w-3" />
                Borders
              </button>

              {/* Edit Mode Toggle */}
              <button
                onClick={handleToggleEditModeButton}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  isEditMode
                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
                title="Toggle edit mode (E)"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>

              {/* Master Settings */}
              <button
                onClick={() => setShowPresentationSettings(true)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  showPresentationSettings
                    ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
                title="Master settings (footer, logo)"
              >
                <Settings className="h-3 w-3" />
                Master
              </button>

              {/* Theme */}
              <button
                onClick={() => setShowThemePanel(true)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  showThemePanel
                    ? 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
                title="Presentation theme"
              >
                <Palette className="h-3 w-3" />
                Theme
              </button>

              {/* Connected indicator */}
              {connected !== undefined && (
                <span className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium ${
                  connected
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : connecting
                      ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                      : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-500' : connecting ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  {connecting ? "Connecting..." : connected ? "Connected" : "Disconnected"}
                </span>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* powered by deckster */}
              <div className="flex flex-col items-center gap-[6px]">
                <span className="text-[7px] text-gray-400 leading-none">powered by</span>
                <div className="flex items-center gap-1">
                  <div className="flex h-[18px] w-[18px] items-center justify-center rounded bg-gradient-to-br from-purple-600 to-blue-600">
                    <Sparkles className="h-2.5 w-2.5 text-white" />
                  </div>
                  <span className="text-[11px] font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    deckster
                  </span>
                </div>
              </div>
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
                  ? "bg-indigo-200 hover:bg-indigo-300 border-indigo-400 text-indigo-700"
                  : "bg-indigo-100 hover:bg-indigo-200 border-indigo-300 text-indigo-600"
              )}
              title={showThumbnails ? "Hide thumbnails" : "Show thumbnails"}
            >
              {showThumbnails ? (
                <ChevronRight className="h-2.5 w-2.5" />
              ) : (
                <ChevronLeft className="h-2.5 w-2.5" />
              )}
              <span className="[writing-mode:vertical-rl] rotate-180 text-[8px] font-medium select-none leading-none">
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
            showThumbnails ? "w-32" : "w-0"
          )}>
            {showThumbnails && slideThumbnails.length > 0 && (
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
