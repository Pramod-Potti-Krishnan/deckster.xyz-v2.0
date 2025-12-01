"use client"

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Edit3, Maximize2, Minimize2, Save, X, Layers, PanelRightClose, PanelRightOpen, SlidersHorizontal } from 'lucide-react'
import { SlideThumbnailStrip, SlideThumbnail } from './slide-thumbnail-strip'
import { SaveStatusIndicator, SaveStatus } from './save-status-indicator'
import { SlideLayoutPicker, SlideLayoutId } from './slide-layout-picker'
import { DeleteSlideDialog } from './delete-slide-dialog'
import { useToast } from '@/hooks/use-toast'
import { TextFormatPopover, FormatTextParams } from './text-format-popover'
import { ShapePickerPopover, InsertShapeParams } from './shape-picker-popover'
import { TableInsertPopover, generateTableHTML } from './table-insert-popover'
import { ChartPickerPopover, InsertChartParams, generateChartConfig } from './chart-picker-popover'

// Selection info from Layout Service
export interface SelectionInfo {
  hasSelection: boolean
  selectedText?: string
  sectionId?: string
  slideIndex?: number
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
  // Version switching support
  strawmanPreviewUrl?: string | null
  finalPresentationUrl?: string | null
  activeVersion?: 'strawman' | 'final'
  onVersionSwitch?: (version: 'strawman' | 'final') => void
  // Format panel toggle
  onFormatPanelToggle?: () => void
  isFormatPanelOpen?: boolean
  // Expose Layout Service API handlers for external use (e.g., Format Panel)
  onApiReady?: (apis: {
    getSelectionInfo: () => Promise<SelectionInfo | null>
    updateSectionContent: (slideIndex: number, sectionId: string, content: string) => Promise<boolean>
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
  onFormatPanelToggle,
  isFormatPanelOpen = false,
  onApiReady
}: PresentationViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [isEditMode, setIsEditMode] = useState(false)
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
  const [slideToDelete, setSlideToDelete] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Track when CRUD operations have modified slides (invalidates stale slideStructure)
  const [slidesModifiedByCrud, setSlidesModifiedByCrud] = useState(false)

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
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNextSlide, handlePrevSlide, handleToggleOverview, isEditMode, handleForceSave])

  const handleToggleEditMode = useCallback(async () => {
    console.log('🔘 Edit button clicked!')
    if (!iframeRef.current) {
      console.log('❌ Iframe not ready')
      return
    }
    try {
      const result = await sendCommand(iframeRef.current, 'toggleEditMode')
      const newEditMode = result.isEditing
      setIsEditMode(newEditMode)
      onEditModeChange?.(newEditMode)

      console.log(`✏️ Edit mode: ${newEditMode ? 'ON' : 'OFF'}`)
    } catch (error) {
      console.error('Error toggling edit mode:', error)
    }
  }, [onEditModeChange])

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
  const handleAddSlide = useCallback(async (layoutId: SlideLayoutId) => {
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
        const newSlideIndex = result.data?.slideIndex ?? currentSlide
        const newTotal = result.data?.slideCount ?? totalSlides + 1

        setTotalSlides(newTotal)
        setCurrentSlide(newSlideIndex + 1) // Navigate to new slide (1-based)
        setSlidesModifiedByCrud(true) // Invalidate stale slideStructure

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
  }, [currentSlide, totalSlides, toast])

  // Duplicate slide handler
  const handleDuplicateSlide = useCallback(async (slideIndex: number) => {
    if (!iframeRef.current) return

    try {
      const result = await sendCommand(iframeRef.current, 'duplicateSlide', {
        index: slideIndex,      // snake_case to match backend
        insert_after: true
      })

      if (result.success) {
        const newSlideIndex = result.data?.newSlideIndex ?? slideIndex + 1
        const newTotal = result.data?.slideCount ?? totalSlides + 1

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

  // Open delete dialog
  const handleOpenDeleteDialog = useCallback((slideIndex: number) => {
    setSlideToDelete(slideIndex)
    setShowDeleteDialog(true)
  }, [])

  // Confirm delete slide
  const handleConfirmDelete = useCallback(async () => {
    if (slideToDelete === null || !iframeRef.current) return

    setIsDeleting(true)
    try {
      const result = await sendCommand(iframeRef.current, 'deleteSlide', {
        index: slideToDelete  // Backend expects 'index', not 'slideIndex'
      })

      if (result.success) {
        const newTotal = result.data?.slideCount ?? totalSlides - 1
        setTotalSlides(newTotal)
        setSlidesModifiedByCrud(true) // Invalidate stale slideStructure

        // Adjust current slide if needed
        if (currentSlide > newTotal) {
          setCurrentSlide(newTotal)
        } else if (currentSlide > slideToDelete + 1) {
          setCurrentSlide(currentSlide - 1)
        }

        toast({
          title: 'Slide Deleted',
          description: `Slide ${slideToDelete + 1} has been removed`
        })

        console.log(`🗑️ Deleted slide ${slideToDelete + 1}`)
      }
    } catch (error) {
      console.error('Error deleting slide:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete slide. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
      setSlideToDelete(null)
    }
  }, [slideToDelete, totalSlides, currentSlide, toast])

  // Change slide layout handler
  const handleChangeLayout = useCallback(async (slideIndex: number, newLayout: SlideLayoutId) => {
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
  }, [currentSlide, toast])

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

  // Shape insertion handler
  const handleInsertShape = useCallback(async (params: InsertShapeParams): Promise<void> => {
    if (!iframeRef.current) {
      toast({
        title: 'Error',
        description: 'Presentation not ready',
        variant: 'destructive'
      })
      return
    }

    try {
      const result = await sendCommand(iframeRef.current, 'insertShape', {
        slideIndex: currentSlide - 1, // Convert to 0-based
        type: params.type,
        gridRow: '8/12',    // Center-ish default position
        gridColumn: '14/20',
        fill: params.fill || '#3b82f6',
        stroke: params.stroke || '#1e40af',
        strokeWidth: params.strokeWidth || 2
      })

      if (result.success) {
        toast({
          title: 'Shape Added',
          description: `${params.type} shape inserted on slide`
        })
        console.log(`🔷 Inserted ${params.type} shape`)
      }
    } catch (error) {
      console.error('Error inserting shape:', error)
      toast({
        title: 'Error',
        description: 'Failed to insert shape. Please try again.',
        variant: 'destructive'
      })
    }
  }, [currentSlide, toast])

  // Table insertion handler
  const handleInsertTable = useCallback(async (rows: number, cols: number): Promise<void> => {
    if (!iframeRef.current) {
      toast({
        title: 'Error',
        description: 'Presentation not ready',
        variant: 'destructive'
      })
      return
    }

    try {
      const result = await sendCommand(iframeRef.current, 'insertTable', {
        slideIndex: currentSlide - 1,
        gridRow: '5/15',
        gridColumn: '3/30',
        tableHtml: generateTableHTML(rows, cols)
      })

      if (result.success) {
        toast({
          title: 'Table Added',
          description: `${rows}×${cols} table inserted on slide`
        })
        console.log(`📊 Inserted ${rows}×${cols} table`)
      }
    } catch (error) {
      console.error('Error inserting table:', error)
      toast({
        title: 'Error',
        description: 'Failed to insert table. Please try again.',
        variant: 'destructive'
      })
    }
  }, [currentSlide, toast])

  // Chart insertion handler
  const handleInsertChart = useCallback(async (params: InsertChartParams): Promise<void> => {
    if (!iframeRef.current) {
      toast({
        title: 'Error',
        description: 'Presentation not ready',
        variant: 'destructive'
      })
      return
    }

    try {
      const result = await sendCommand(iframeRef.current, 'insertChart', {
        slideIndex: currentSlide - 1,
        gridRow: '3/16',
        gridColumn: '2/20',
        chartConfig: generateChartConfig(params)
      })

      if (result.success) {
        toast({
          title: 'Chart Added',
          description: `${params.type} chart inserted on slide`
        })
        console.log(`📈 Inserted ${params.type} chart`)
      }
    } catch (error) {
      console.error('Error inserting chart:', error)
      toast({
        title: 'Error',
        description: 'Failed to insert chart. Please try again.',
        variant: 'destructive'
      })
    }
  }, [currentSlide, toast])

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

  // Expose APIs to parent component when iframe is ready
  useEffect(() => {
    if (iframeReady && onApiReady) {
      onApiReady({
        getSelectionInfo: handleGetSelectionInfo,
        updateSectionContent: handleUpdateSectionContent
      })
    }
  }, [iframeReady, onApiReady, handleGetSelectionInfo, handleUpdateSectionContent])

  const handleFullscreen = useCallback(async () => {
    if (!containerRef.current) return

    try {
      if (!document.fullscreenElement) {
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
  }, [])

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
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

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

  return (
    <div ref={containerRef} className={`flex flex-col h-full ${className} ${isFullscreen ? 'bg-black' : ''}`}>
      {/* Control Toolbar - Keynote-Inspired Layout */}
      {showControls && (
        <div className={`${isFullscreen ? 'absolute top-0 left-0 right-0 z-50' : ''} flex items-center justify-between px-4 py-2 bg-gray-50 border-b transition-all duration-300 ${
          isFullscreen && !showToolbar ? 'opacity-0 -translate-y-full pointer-events-none' : 'opacity-100 translate-y-0'
        }`}>
          {/* Left Group: Navigation + Insert + Edit */}
          <div className="flex items-center gap-1">
            {/* Navigation Group */}
            <div className="flex items-center border border-gray-300 rounded-md overflow-hidden bg-white">
              <Button
                size="sm"
                variant="ghost"
                onClick={handlePrevSlide}
                disabled={currentSlide <= 1}
                className="h-8 rounded-none border-0 px-2 hover:bg-gray-100"
                title="Previous slide"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="w-px h-5 bg-gray-200" />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleNextSlide}
                disabled={totalSlides ? currentSlide >= totalSlides : false}
                className="h-8 rounded-none border-0 px-2 hover:bg-gray-100"
                title="Next slide"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-2" />

            {/* Add Slide */}
            <SlideLayoutPicker
              onAddSlide={handleAddSlide}
              disabled={!presentationUrl}
            />

            <div className="w-px h-6 bg-gray-300 mx-2" />

            {/* Edit Mode Toggle */}
            {!isEditMode ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleToggleEditMode}
                className="h-8"
              >
                <Edit3 className="h-4 w-4 mr-1" />
                Edit
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="h-8 bg-green-600 hover:bg-green-700"
                >
                  <Save className="h-4 w-4 mr-1" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdits}
                  disabled={isSaving}
                  className="h-8"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            )}

            {/* Format Panel Toggle */}
            {onFormatPanelToggle && (
              <>
                <div className="w-px h-6 bg-gray-300 mx-2" />
                <Button
                  size="sm"
                  variant={isFormatPanelOpen ? "default" : "outline"}
                  onClick={onFormatPanelToggle}
                  className="h-8"
                  title="Format slide"
                >
                  <SlidersHorizontal className="h-4 w-4 mr-1" />
                  Format
                </Button>
              </>
            )}
          </div>

          {/* Center Group: Format Tools (Layout Service v7.5.3) */}
          <div className="flex items-center gap-1">
            <TextFormatPopover
              onFormat={handleFormatText}
              disabled={!presentationUrl || !isEditMode}
            />
            <ShapePickerPopover
              onInsertShape={handleInsertShape}
              disabled={!presentationUrl || !isEditMode}
            />
            <TableInsertPopover
              onInsertTable={handleInsertTable}
              disabled={!presentationUrl || !isEditMode}
            />
            <ChartPickerPopover
              onInsertChart={handleInsertChart}
              disabled={!presentationUrl || !isEditMode}
            />
          </div>

          {/* Right Group: View + Save + Counter */}
          <div className="flex items-center gap-2">
            {/* Version Toggle - Only show when both versions are available */}
            {strawmanPreviewUrl && finalPresentationUrl && (
              <div className="flex items-center border border-gray-300 rounded-md overflow-hidden bg-white h-8">
                <button
                  onClick={() => onVersionSwitch?.('strawman')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    activeVersion === 'strawman'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  title="View strawman preview"
                >
                  Strawman
                </button>
                <div className="w-px h-full bg-gray-200" />
                <button
                  onClick={() => onVersionSwitch?.('final')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    activeVersion === 'final'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  title="View final presentation"
                >
                  Final
                </button>
              </div>
            )}

            {/* Fullscreen */}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleFullscreen}
              className="h-8 px-2"
              title={isFullscreen ? "Exit fullscreen (ESC)" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            {/* Save Status Indicator */}
            <SaveStatusIndicator
              status={saveStatus}
              onRetry={saveStatus === 'error' ? handleForceSave : undefined}
            />

            {/* Download Controls */}
            {downloadControls}

            {/* Slide Counter */}
            <div className="text-sm font-medium text-gray-600 ml-2 min-w-[80px] text-right">
              Slide {currentSlide} / {totalSlides || '?'}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Flex container for slide and thumbnails */}
      <div className={`flex-1 flex min-h-0 overflow-hidden ${isFullscreen ? 'bg-black' : ''}`}>
        {/* Left: Presentation Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Presentation Iframe */}
          <div className={`flex-1 relative flex items-center justify-center ${isFullscreen ? 'bg-black p-0' : 'bg-gray-800 p-8'}`}>
            {presentationUrl ? (
              <div className={`w-full ${isFullscreen ? 'h-full' : 'max-w-7xl'}`} style={isFullscreen ? undefined : { aspectRatio: '16/9' }}>
                <iframe
                  ref={iframeRef}
                  src={presentationUrl}
                  onLoad={handleIframeLoad}
                  className={`w-full h-full border-0 ${isFullscreen ? '' : 'rounded-sm shadow-2xl'}`}
                  title="Presentation Viewer"
                  allow="fullscreen"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center text-gray-400">
                <p>No presentation to display</p>
              </div>
            )}
          </div>

          {/* Edit Mode Instructions */}
          {isEditMode && !isFullscreen && (
            <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200 text-sm text-yellow-800">
              <strong>Edit Mode:</strong> Click on any text to edit. Select text for formatting toolbar.
              <span className="ml-2 text-xs text-yellow-600">
                Shortcuts: Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+U (Underline), Ctrl+S (Save)
              </span>
            </div>
          )}
        </div>

        {/* Right: Slide Thumbnail Panel with Toggle */}
        {!isFullscreen && (
          <div className={`flex-shrink-0 flex flex-col border-l border-gray-200 bg-gray-50 transition-all duration-200 ${showThumbnails ? 'w-32' : 'w-10'}`}>
            {/* Panel Header with Toggle */}
            <div className="flex items-center justify-center py-2 border-b border-gray-200">
              <button
                onClick={handleToggleOverview}
                className="p-1.5 rounded-md hover:bg-gray-200 transition-colors"
                title={showThumbnails ? "Hide thumbnails" : "Show thumbnails"}
              >
                {showThumbnails ? (
                  <PanelRightClose className="h-4 w-4 text-gray-600" />
                ) : (
                  <PanelRightOpen className="h-4 w-4 text-gray-600" />
                )}
              </button>
            </div>

            {/* Thumbnail Strip */}
            {showThumbnails && slideThumbnails.length > 0 && (
              <SlideThumbnailStrip
                slides={slideThumbnails}
                currentSlide={currentSlide}
                onSlideClick={(slideNumber) => {
                  handleGoToSlide(slideNumber - 1) // Convert 1-based to 0-based index
                }}
                orientation="vertical"
                // CRUD handlers
                onDuplicateSlide={handleDuplicateSlide}
                onDeleteSlide={handleOpenDeleteDialog}
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
        slideNumber={slideToDelete !== null ? slideToDelete + 1 : 0}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}
