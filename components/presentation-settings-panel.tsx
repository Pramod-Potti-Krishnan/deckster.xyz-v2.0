"use client"

import "./studio-editor-dialogs.css"
import "./studio-master-panel.css"

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Upload, Wand2, Trash2, Loader2, Image as ImageIcon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getLayoutViewerOrigin,
  isTrustedLayoutViewerMessage,
} from '@/lib/layout-viewer-messaging'

// Data models matching backend API
interface FooterConfig {
  template: string
  values: {
    title?: string
    date?: string
    author?: string
  }
  style?: {
    color?: string
    fontSize?: string
    fontFamily?: string
  } | null
}

interface LogoConfig {
  image_url: string | null
  alt_text?: string
}

interface DerivativeElements {
  footer?: FooterConfig | null
  logo?: LogoConfig | null
}

interface PresentationSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  viewerOrigin: string
  currentSlide: number
  totalSlides: number
  presentationId?: string | null
}

// Studio read ownership START — native messages remain unversioned.
type StudioMasterOwner = { presentationId?: string | null; iframe: HTMLIFrameElement | null; window: Window | null; src: string; origin: string }
type StudioMasterLifetime = { owner: StudioMasterOwner; open: boolean; frameEpoch: number }
type StudioMasterRead = { lifetime: StudioMasterLifetime | null; status: 'unknown' | 'loading' | 'ready' | 'error'; error: string }
type StudioMasterField = 'footerTemplate' | 'footerTitle' | 'footerDate' | 'footerAuthor' | 'logoUrl' | 'logoAltText' | 'logoFileName'
type StudioMasterLease = { settled: Promise<void>; timedOut: boolean }
// Unversioned replies require one listener per action and actual viewer window,
// including retired instances. Save/Clear share a lane so writes cannot overlap.
// A timeout stays quarantined until its late receipt or viewer load drains it.
const studioMasterCommandLeases = new WeakMap<Window, Map<string, StudioMasterLease>>()
// Studio read ownership END.

// Common footer templates for quick selection
const FOOTER_TEMPLATES = [
  { label: 'Page only', template: 'Page {page}' },
  { label: 'Page X of Y', template: 'Page {page} of {total}' },
  { label: 'Title + Page', template: '{title} | Page {page}' },
  { label: 'Professional', template: '{title} | {date} | Page {page}' },
]

/**
 * PresentationSettingsPanel Component
 *
 * Slide-out panel for managing derivative elements (footer and logo)
 * that appear consistently across all slides.
 */
export function PresentationSettingsPanel({
  isOpen,
  onClose,
  iframeRef,
  viewerOrigin,
  currentSlide,
  totalSlides,
  presentationId,
}: PresentationSettingsPanelProps) {
  const studio = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Loading states
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false)

  // Footer state
  const [footerTemplate, setFooterTemplate] = useState('')
  const [footerTitle, setFooterTitle] = useState('')
  const [footerDate, setFooterDate] = useState('')
  const [footerAuthor, setFooterAuthor] = useState('')
  const [previewText, setPreviewText] = useState('')

  // Logo state
  const [logoUrl, setLogoUrl] = useState('')
  const [logoAltText, setLogoAltText] = useState('')
  const [logoFileName, setLogoFileName] = useState('')
  const [logoPrompt, setLogoPrompt] = useState('')
  const [showLogoPrompt, setShowLogoPrompt] = useState(false)

  // Track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState(false)

  // Studio lifetime state START.
  const [studioRead, setStudioRead] = useState({ lifetime: null, status: 'unknown', error: '' } as StudioMasterRead)
  const [studioFrameEpoch, setStudioFrameEpoch] = useState(0)
  const studioOwnerRef = useRef<StudioMasterOwner | null>(null)
  const studioLifetimeRef = useRef<StudioMasterLifetime | null>(null)
  const studioReadRef = useRef(studioRead)
  const studioReadSequence = useRef(0)
  const studioMounted = useRef(true)
  const studioFieldsOwner = useRef<StudioMasterOwner | null>(null)
  const studioPendingWrite = useRef<{ lifetime: StudioMasterLifetime | null } | null>(null)
  const studioDraft = useRef({ owner: null as StudioMasterOwner | null, version: 0, fields: new Set<StudioMasterField>() })
  const studioFrame = iframeRef.current
  const studioWindow = studioFrame?.contentWindow ?? null
  const studioSrc = studioFrame?.getAttribute('src') ?? ''
  if (studio && (!studioOwnerRef.current || studioOwnerRef.current.presentationId !== presentationId || studioOwnerRef.current.iframe !== studioFrame || studioOwnerRef.current.window !== studioWindow || studioOwnerRef.current.src !== studioSrc || studioOwnerRef.current.origin !== viewerOrigin)) {
    studioOwnerRef.current = { presentationId, iframe: studioFrame, window: studioWindow, src: studioSrc, origin: viewerOrigin }
    studioDraft.current = { owner: studioOwnerRef.current, version: 0, fields: new Set() }
  }
  const studioOwner = studioOwnerRef.current
  if (studio && studioOwner && (!studioLifetimeRef.current || studioLifetimeRef.current.owner !== studioOwner || studioLifetimeRef.current.open !== isOpen || studioLifetimeRef.current.frameEpoch !== studioFrameEpoch)) {
    studioLifetimeRef.current = { owner: studioOwner, open: isOpen, frameEpoch: studioFrameEpoch }
  }
  const studioLifetime = studioLifetimeRef.current
  studioReadRef.current = studioRead
  const studioIsCurrent = () => !!studioLifetime && studioMounted.current && studioLifetime.open && studioLifetimeRef.current === studioLifetime && studioOwnerRef.current === studioOwner && iframeRef.current === studioOwner?.iframe && studioOwner?.iframe?.contentWindow === studioOwner?.window && (studioOwner?.iframe?.getAttribute('src') ?? '') === studioOwner?.src
  const studioKnown = () => studioIsCurrent() && studioReadRef.current.lifetime === studioLifetime && studioReadRef.current.status === 'ready'
  const studioSetRead = (next: StudioMasterRead) => { studioReadRef.current = next; setStudioRead(next) }
  const studioMarkDraft = (...fields: StudioMasterField[]) => {
    if (!studio || !studioIsCurrent()) return
    studioDraft.current.version++
    fields.forEach(field => studioDraft.current.fields.add(field))
  }
  useEffect(() => {
    if (!studio) return
    studioMounted.current = true
    return () => { studioMounted.current = false; studioReadSequence.current++ }
  }, [studio])
  useEffect(() => {
    if (!studio || !studioFrame) return
    const loaded = () => { studioReadSequence.current++; setStudioFrameEpoch(epoch => epoch + 1) }
    studioFrame.addEventListener('load', loaded)
    return () => studioFrame.removeEventListener('load', loaded)
  }, [studio, studioFrame])
  useEffect(() => {
    if (!studio || !studioOwner || studioFieldsOwner.current === studioOwner) return
    studioFieldsOwner.current = studioOwner
    setFooterTemplate(''); setFooterTitle(''); setFooterDate(''); setFooterAuthor('')
    setLogoUrl(''); setLogoAltText(''); setLogoFileName(''); setPreviewText('')
    setLogoPrompt(''); setShowLogoPrompt(false); setHasChanges(false)
    setIsSaving(false); setIsLoading(false); setIsGeneratingLogo(false)
  }, [studio, studioOwner])
  useEffect(() => {
    if (!studio) return
    // Busy UI belongs to an open lifetime; transport leases outlive that UI.
    // Reopening stays usable, while a fresh write waits for the retired receipt.
    studioPendingWrite.current = null
    setIsSaving(false); setIsLoading(false); setIsGeneratingLogo(false)
  }, [studio, studioLifetime])
  // Studio lifetime state END.

  /**
   * Send command to iframe via postMessage
   */
  const sendCommand = useCallback(async (
    action: string,
    params?: Record<string, any>
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!iframeRef.current) {
        reject(new Error('Iframe not ready'))
        return
      }

      const iframe = iframeRef.current
      const handler = (event: MessageEvent) => {
        if (!isTrustedLayoutViewerMessage(event, iframe, viewerOrigin)) return

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

      setTimeout(() => {
        window.removeEventListener('message', handler)
        reject(new Error('Command timeout'))
      }, 10000) // 10 second timeout for API calls

      iframe.contentWindow?.postMessage(
        { action, params },
        getLayoutViewerOrigin(iframe, viewerOrigin),
      )
    })
  }, [iframeRef, viewerOrigin])

  // Studio serialized commands START — the general/classic bridge is unchanged.
  const sendStudioCommand = async (action: string, params: Record<string, any> | undefined, admitted: () => boolean): Promise<any> => {
    const frame = studioOwner?.iframe, frameWindow = studioOwner?.window
    if (!frame || !frameWindow) throw new Error('Viewer is not ready. Try again when the presentation has loaded.')
    let lanes = studioMasterCommandLeases.get(frameWindow)
    if (!lanes) { lanes = new Map(); studioMasterCommandLeases.set(frameWindow, lanes) }
    const lane = action === 'updateDerivativeElements' || action === 'clearDerivativeElements' ? 'derivative-write' : action
    for (;;) {
      if (!admitted()) throw new Error('Settings command retired')
      const previous = lanes.get(lane)
      if (!previous) break
      if (previous.timedOut) throw new Error('The viewer did not respond. Reload the presentation before retrying settings.')
      await previous.settled
    }
    return new Promise((resolve, reject) => {
      let settle!: () => void
      const lease: StudioMasterLease = { settled: new Promise<void>(done => { settle = done }), timedOut: false }
      lanes.set(lane, lease)
      const cleanup = () => {
        clearTimeout(timer)
        window.removeEventListener('message', handler)
        frame.removeEventListener('load', loaded)
        if (lanes.get(lane) === lease) lanes.delete(lane)
        settle()
      }
      const loaded = () => { cleanup(); reject(new Error('Viewer reloaded during settings command')) }
      const handler = (event: MessageEvent) => {
        if (!isTrustedLayoutViewerMessage(event, frame, viewerOrigin) || event.data.action !== action) return
        cleanup()
        if (!event.data.success) { reject(new Error(event.data.error || 'Command failed')); return }
        resolve(event.data)
      }
      const timer = setTimeout(() => {
        lease.timedOut = true
        settle()
        reject(new Error('The viewer did not respond. Reload the presentation before retrying settings.'))
      }, 10000)
      window.addEventListener('message', handler)
      frame.addEventListener('load', loaded)
      try {
        frameWindow.postMessage({ action, params }, getLayoutViewerOrigin(frame, viewerOrigin))
      } catch (error) { cleanup(); reject(error) }
    })
  }
  const readStudioDerivativeElements = async (sequence: number): Promise<DerivativeElements | null> => {
    const result = await sendStudioCommand('getDerivativeElements', undefined, () => studioIsCurrent() && studioReadSequence.current === sequence)
    const elements = result.derivativeElements
    if (elements !== null && (!elements || typeof elements !== 'object' || Array.isArray(elements))) {
      throw new Error('The viewer returned an incomplete settings read. Try again.')
    }
    return elements
  }
  // Studio serialized commands END.

  /**
   * Load current derivative elements when panel opens
   */
  const loadDerivativeElements = useCallback(async () => {
    if (!isOpen) return

    // Studio known-read branch START.
    if (studio) {
      if (!studioIsCurrent()) return
      const sequence = ++studioReadSequence.current
      studioSetRead({ lifetime: studioLifetime, status: 'loading', error: '' })
      setIsLoading(true)
      try {
        const elements = await readStudioDerivativeElements(sequence)
        if (!studioIsCurrent() || studioReadSequence.current !== sequence) return
        const values: Record<StudioMasterField, string> = {
          footerTemplate: elements?.footer?.template || '', footerTitle: elements?.footer?.values?.title || '',
          footerDate: elements?.footer?.values?.date || '', footerAuthor: elements?.footer?.values?.author || '',
          logoUrl: elements?.logo?.image_url || '', logoAltText: elements?.logo?.alt_text || '',
          logoFileName: elements?.logo?.image_url ? elements.logo.image_url.split('/').pop() || 'logo.png' : '',
        }
        const setters = { footerTemplate: setFooterTemplate, footerTitle: setFooterTitle, footerDate: setFooterDate, footerAuthor: setFooterAuthor, logoUrl: setLogoUrl, logoAltText: setLogoAltText, logoFileName: setLogoFileName }
        for (const field of Object.keys(setters) as StudioMasterField[]) {
          if (!studioDraft.current.fields.has(field)) setters[field](values[field])
        }
        setHasChanges(studioDraft.current.fields.size > 0)
        studioSetRead({ lifetime: studioLifetime, status: 'ready', error: '' })
      } catch (error) {
        if (!studioIsCurrent() || studioReadSequence.current !== sequence) return
        studioSetRead({ lifetime: studioLifetime, status: 'error', error: error instanceof Error ? error.message : 'Could not read footer and logo settings' })
      } finally {
        if (studioIsCurrent() && studioReadSequence.current === sequence) setIsLoading(false)
      }
      return
    }
    // Studio known-read branch END.

    setIsLoading(true)
    try {
      const result = await sendCommand('getDerivativeElements')
      const elements: DerivativeElements | null = result.derivativeElements

      if (elements) {
        // Load footer config
        if (elements.footer) {
          setFooterTemplate(elements.footer.template || '')
          setFooterTitle(elements.footer.values?.title || '')
          setFooterDate(elements.footer.values?.date || '')
          setFooterAuthor(elements.footer.values?.author || '')
        } else {
          setFooterTemplate('')
          setFooterTitle('')
          setFooterDate('')
          setFooterAuthor('')
        }

        // Load logo config
        if (elements.logo) {
          setLogoUrl(elements.logo.image_url || '')
          setLogoAltText(elements.logo.alt_text || '')
          // Extract filename from URL
          if (elements.logo.image_url) {
            const urlParts = elements.logo.image_url.split('/')
            setLogoFileName(urlParts[urlParts.length - 1] || 'logo.png')
          } else {
            setLogoFileName('')
          }
        } else {
          setLogoUrl('')
          setLogoAltText('')
          setLogoFileName('')
        }
      }

      setHasChanges(false)
    } catch (error) {
      console.error('Failed to load derivative elements:', error)
      // Don't show error toast - elements may just not be configured yet
    } finally {
      setIsLoading(false)
    }
  }, [isOpen, sendCommand, studio, studioLifetime])

  /**
   * Load elements when panel opens
   */
  useEffect(() => {
    if (isOpen) {
      loadDerivativeElements()
    }
  }, [isOpen, loadDerivativeElements])

  /**
   * Preview footer as user types (debounced)
   */
  const updatePreview = useCallback(async () => {
    if (studio && !studioKnown()) return
    const studioVersion = studioDraft.current.version
    const sendOwnedCommand = studio ? (action: string, params: Record<string, any>) => sendStudioCommand(action, params, () => studioKnown() && studioDraft.current.version === studioVersion) : sendCommand
    if (!footerTemplate) {
      setPreviewText('')
      return
    }

    try {
      const result = await sendOwnedCommand('previewFooter', {
        footer: {
          template: footerTemplate,
          values: {
            title: footerTitle,
            date: footerDate,
            author: footerAuthor,
          }
        },
        slideIndex: currentSlide - 1 // Convert to 0-based
      })

      if (studio && (!studioKnown() || studioDraft.current.version !== studioVersion)) return
      setPreviewText(result.previewText || '')
    } catch (error) {
      if (studio && (!studioKnown() || studioDraft.current.version !== studioVersion)) return
      // Fallback: do simple local preview
      let preview = footerTemplate
      preview = preview.replace('{title}', footerTitle || '[Title]')
      preview = preview.replace('{page}', String(currentSlide))
      preview = preview.replace('{total}', String(totalSlides))
      preview = preview.replace('{date}', footerDate || '[Date]')
      preview = preview.replace('{author}', footerAuthor || '[Author]')
      setPreviewText(preview)
    }
  }, [footerTemplate, footerTitle, footerDate, footerAuthor, currentSlide, totalSlides, sendCommand, studio, studioLifetime, studioRead])

  /**
   * Debounced preview update
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      updatePreview()
    }, 300)
    return () => clearTimeout(timer)
  }, [updatePreview])

  /**
   * Mark as changed when any input changes
   */
  const handleInputChange = useCallback((field?: StudioMasterField) => {
    if (field) studioMarkDraft(field)
    setHasChanges(true)
  }, [studio, studioLifetime])

  /**
   * Handle file upload for logo
   */
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (studio && !studioIsCurrent()) return
    const studioVersion = studioDraft.current.version
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file (PNG, JPG, SVG)',
        variant: 'destructive'
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    try {
      // Upload to Supabase storage via our API
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'logo')
      if (presentationId) {
        formData.append('presentationId', presentationId)
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      if (studio && (!studioIsCurrent() || studioDraft.current.version !== studioVersion)) return
      studioMarkDraft('logoUrl', 'logoFileName')
      setLogoUrl(data.url)
      setLogoFileName(file.name)
      setHasChanges(true)

      toast({
        title: 'Logo uploaded',
        description: 'Your logo has been uploaded successfully'
      })
    } catch (error) {
      if (studio && !studioIsCurrent()) return
      console.error('Logo upload failed:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload logo. Please try again.',
        variant: 'destructive'
      })
    } finally {
      if (!studio || studioIsCurrent()) setIsLoading(false)
    }
  }

  /**
   * Generate logo using AI (Elementor API)
   */
  const handleGenerateLogo = async () => {
    if (studio && !studioIsCurrent()) return
    const studioVersion = studioDraft.current.version
    if (!logoPrompt.trim()) {
      toast({
        title: 'Enter a prompt',
        description: 'Please describe the logo you want to generate',
        variant: 'destructive'
      })
      return
    }

    setIsGeneratingLogo(true)
    try {
      const response = await fetch('/api/elementor/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Logo design: ${logoPrompt}. Professional, clean, minimal, suitable for presentation footer.`,
          width: 200,
          height: 100,
          presentationId
        })
      })

      if (!response.ok) {
        throw new Error('Generation failed')
      }

      const data = await response.json()
      if (studio && (!studioIsCurrent() || studioDraft.current.version !== studioVersion)) return
      studioMarkDraft('logoUrl', 'logoFileName')
      setLogoUrl(data.url)
      setLogoFileName('ai-generated-logo.png')
      setShowLogoPrompt(false)
      setLogoPrompt('')
      setHasChanges(true)

      toast({
        title: 'Logo generated',
        description: 'Your AI logo has been generated successfully'
      })
    } catch (error) {
      if (studio && !studioIsCurrent()) return
      console.error('Logo generation failed:', error)
      toast({
        title: 'Generation failed',
        description: 'Failed to generate logo. Please try again.',
        variant: 'destructive'
      })
    } finally {
      if (!studio || studioIsCurrent()) setIsGeneratingLogo(false)
    }
  }

  /**
   * Remove logo
   */
  const handleRemoveLogo = () => {
    if (studio && !studioIsCurrent()) return
    studioMarkDraft('logoUrl', 'logoFileName', 'logoAltText')
    setLogoUrl('')
    setLogoFileName('')
    setLogoAltText('')
    setHasChanges(true)
  }

  /**
   * Save all changes
   */
  const handleSave = async () => {
    if (studio && (!studioKnown() || studioPendingWrite.current?.lifetime === studioLifetime)) return
    const studioVersion = studioDraft.current.version
    const operation = { lifetime: studioLifetime }
    if (studio) studioPendingWrite.current = operation
    const sendOwnedCommand = studio ? (action: string, params: Record<string, any>) => sendStudioCommand(action, params, () => studioKnown() && studioDraft.current.version === studioVersion && studioPendingWrite.current === operation) : sendCommand
    setIsSaving(true)
    try {
      const footer: FooterConfig | null = footerTemplate
        ? {
            template: footerTemplate,
            values: {
              title: footerTitle || undefined,
              date: footerDate || undefined,
              author: footerAuthor || undefined,
            }
          }
        : null

      const logo: LogoConfig | null = logoUrl
        ? {
            image_url: logoUrl,
            alt_text: logoAltText || 'Logo'
          }
        : null

      await sendOwnedCommand('updateDerivativeElements', {
        presentationId,
        footer,
        logo
      })

      if (studio && (!studioKnown() || studioDraft.current.version !== studioVersion)) return
      if (studio) studioDraft.current.fields.clear()
      setHasChanges(false)
      toast({
        title: 'Settings saved',
        description: 'Footer and logo have been updated across all slides'
      })
      onClose()
    } catch (error) {
      if (studio && (!studioKnown() || studioDraft.current.version !== studioVersion || studioPendingWrite.current !== operation)) return
      console.error('Failed to save derivative elements:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive'
      })
    } finally {
      if (!studio || (studioIsCurrent() && studioPendingWrite.current === operation)) {
        if (studio) studioPendingWrite.current = null
        setIsSaving(false)
      }
    }
  }

  /**
   * Clear all derivative elements
   */
  const handleClearAll = async () => {
    if (studio && (!studioKnown() || studioPendingWrite.current?.lifetime === studioLifetime)) return
    const studioVersion = studioDraft.current.version
    const operation = { lifetime: studioLifetime }
    if (studio) studioPendingWrite.current = operation
    const sendOwnedCommand = studio ? (action: string, params: Record<string, any>) => sendStudioCommand(action, params, () => studioKnown() && studioDraft.current.version === studioVersion && studioPendingWrite.current === operation) : sendCommand
    setIsLoading(true)
    try {
      await sendOwnedCommand('clearDerivativeElements', {
        presentationId,
        clearFooter: true,
        clearLogo: true
      })

      if (studio && (!studioKnown() || studioDraft.current.version !== studioVersion)) return
      if (studio) studioDraft.current.fields.clear()
      // Reset all state
      setFooterTemplate('')
      setFooterTitle('')
      setFooterDate('')
      setFooterAuthor('')
      setLogoUrl('')
      setLogoFileName('')
      setLogoAltText('')
      setPreviewText('')
      setHasChanges(false)

      toast({
        title: 'Settings cleared',
        description: 'Footer and logo have been removed from all slides'
      })
    } catch (error) {
      if (studio && (!studioKnown() || studioDraft.current.version !== studioVersion || studioPendingWrite.current !== operation)) return
      console.error('Failed to clear derivative elements:', error)
      toast({
        title: 'Clear failed',
        description: studio && error instanceof Error ? error.message : 'Failed to clear settings',
        variant: 'destructive'
      })
    } finally {
      if (!studio || (studioIsCurrent() && studioPendingWrite.current === operation)) {
        if (studio) studioPendingWrite.current = null
        setIsLoading(false)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div data-studio-v4-dialog={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'master' : undefined} role="dialog" aria-modal="false" aria-label="Footer and logo" className="fixed inset-y-0 left-0 w-96 bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-r border-gray-200 dark:border-slate-700">
      {/* Header */}
      <div data-studio-master-part={studio ? 'header' : undefined} className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
        <h2 className="text-xs font-semibold text-gray-900 dark:text-slate-100">Master</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 dark:bg-slate-700 transition-colors"
          data-studio-master-part={studio ? 'close' : undefined}
          aria-label={studio ? 'Close footer and logo panel' : undefined}
          title="Close panel"
        >
          <X className="h-4 w-4 text-gray-600 dark:text-slate-300" />
        </button>
      </div>

      {/* Content */}
      <div data-studio-master-part={studio ? 'body' : undefined} className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Studio settings-read notice START. */}
        {studio && studioRead.lifetime === studioLifetime && studioRead.status === 'error' && (
          <div data-studio-master-part="read-error" role="alert" className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-semibold">Footer and logo settings could not be loaded</p>
            <p className="text-xs">{studioRead.error}</p>
            <p className="text-xs">Your draft is kept. Save, Clear and preview stay unavailable until settings load.</p>
            <Button data-studio-master-action="retry-read" variant="outline" size="sm" onClick={loadDerivativeElements}>Retry settings</Button>
          </div>
        )}
        {/* Studio settings-read notice END. */}
        {(isLoading || (studio && (!studioRead.lifetime || studioRead.lifetime !== studioLifetime || studioRead.status === 'unknown'))) ? (
          <div role={studio ? 'status' : undefined} aria-label={studio ? 'Loading footer and logo controls' : undefined} className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400 dark:text-slate-500" />
          </div>
        ) : (
          <>
            {/* Footer Section */}
            <div data-studio-master-part={studio ? 'section' : undefined} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Footer</h3>
              </div>

              {/* Template Input */}
              <div className="space-y-1.5">
                <Label htmlFor="footer-template" className="text-[10px] text-gray-600 dark:text-slate-300">
                  Template
                </Label>
                <Input
                  id="footer-template"
                  value={footerTemplate}
                  onChange={(e) => {
                    setFooterTemplate(e.target.value)
                    handleInputChange('footerTemplate')
                  }}
                  placeholder="{title} | Page {page} of {total}"
                  className="h-7 text-[11px]"
                />

                {/* Quick templates */}
                <div data-studio-master-part={studio ? 'presets' : undefined} className="flex flex-wrap gap-1.5 mt-2">
                  {FOOTER_TEMPLATES.map((t) => (
                    <button
                      key={t.template}
                      data-studio-master-preset={studio ? t.template : undefined}
                      aria-pressed={studio ? footerTemplate === t.template : undefined}
                      onClick={() => {
                        setFooterTemplate(t.template)
                        handleInputChange('footerTemplate')
                      }}
                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700 dark:bg-slate-700 rounded text-gray-600 dark:text-slate-300 transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {previewText && (
                <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-2.5 border border-gray-200 dark:border-slate-700">
                  <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-0.5">Preview:</div>
                  <div data-studio-master-part={studio ? 'preview' : undefined} className="text-xs text-gray-800 font-medium">{previewText}</div>
                </div>
              )}

              {/* Variables */}
              <div className="space-y-2 pt-1">
                <div className="text-[10px] font-medium text-gray-500 dark:text-slate-400">Variables</div>

                <div className="space-y-1.5">
                  <Label htmlFor="footer-title" className="text-[10px] text-gray-600 dark:text-slate-300">
                    Title <span className="text-gray-400 dark:text-slate-500">{'{title}'}</span>
                  </Label>
                  <Input
                    id="footer-title"
                    value={footerTitle}
                    onChange={(e) => {
                      setFooterTitle(e.target.value)
                      handleInputChange('footerTitle')
                    }}
                    placeholder="Presentation title"
                    className="h-7 text-[11px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="footer-date" className="text-[10px] text-gray-600 dark:text-slate-300">
                    Date <span className="text-gray-400 dark:text-slate-500">{'{date}'}</span>
                  </Label>
                  <Input
                    id="footer-date"
                    value={footerDate}
                    onChange={(e) => {
                      setFooterDate(e.target.value)
                      handleInputChange('footerDate')
                    }}
                    placeholder="December 2024"
                    className="h-7 text-[11px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="footer-author" className="text-[10px] text-gray-600 dark:text-slate-300">
                    Author <span className="text-gray-400 dark:text-slate-500">{'{author}'}</span>
                  </Label>
                  <Input
                    id="footer-author"
                    value={footerAuthor}
                    onChange={(e) => {
                      setFooterAuthor(e.target.value)
                      handleInputChange('footerAuthor')
                    }}
                    placeholder="Author name"
                    className="h-7 text-[11px]"
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-slate-700" />

            {/* Logo Section */}
            <div data-studio-master-part={studio ? 'section' : undefined} className="space-y-3">
              <h3 className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Logo</h3>

              {/* Logo Preview */}
              {logoUrl ? (
                <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                  <div data-studio-master-part={studio ? 'logo-image' : undefined} className="w-16 h-12 flex items-center justify-center bg-white dark:bg-slate-900 rounded border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <img
                      src={logoUrl}
                      alt={logoAltText || 'Logo preview'}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div data-studio-master-part={studio ? 'logo-file' : undefined} className="text-xs font-medium text-gray-700 dark:text-slate-200 truncate">
                      {logoFileName || 'Logo'}
                    </div>
                    <button
                      onClick={handleRemoveLogo}
                      className="text-xs text-red-600 hover:text-red-700 mt-1 flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-700">
                  <div className="text-center">
                    <ImageIcon className="h-6 w-6 text-gray-300 mx-auto mb-1.5" />
                    <div className="text-[11px] text-gray-500 dark:text-slate-400">{studio && !studioKnown() ? 'Logo settings have not loaded' : 'No logo configured'}</div>
                  </div>
                </div>
              )}

              {/* Logo Actions */}
              <div data-studio-master-part={studio ? 'logo-actions' : undefined} className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 h-7 text-[11px]"
                >
                  <Upload className="h-3 w-3 mr-1.5" />
                  Upload
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLogoPrompt(!showLogoPrompt)}
                  className="flex-1 h-7 text-[11px]"
                >
                  <Wand2 className="h-3 w-3 mr-1.5" />
                  Generate
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>

              {/* AI Generation Prompt */}
              {showLogoPrompt && (
                <div className="space-y-1.5 p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                  <Label htmlFor="logo-prompt" className="text-[10px] text-purple-700">
                    Describe your logo
                  </Label>
                  <Input
                    id="logo-prompt"
                    value={logoPrompt}
                    onChange={(e) => setLogoPrompt(e.target.value)}
                    placeholder="A modern tech company logo with..."
                    className="h-7 text-[11px]"
                  />
                  <Button
                    size="sm"
                    onClick={handleGenerateLogo}
                    disabled={isGeneratingLogo || !logoPrompt.trim()}
                    className="w-full h-7 text-[11px] bg-purple-600 hover:bg-purple-700"
                  >
                    {isGeneratingLogo ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Generate Logo
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Direct URL Input */}
              <div className="space-y-1.5">
                <Label htmlFor="logo-url" className="text-[10px] text-gray-600 dark:text-slate-300">
                  Or enter URL directly
                </Label>
                <Input
                  id="logo-url"
                  value={logoUrl}
                  onChange={(e) => {
                    setLogoUrl(e.target.value)
                    setLogoFileName('')
                    studioMarkDraft('logoFileName')
                    handleInputChange('logoUrl')
                  }}
                  placeholder="https://example.com/logo.png"
                  className="h-7 text-[11px]"
                />
              </div>

              {/* Alt Text */}
              {logoUrl && (
                <div className="space-y-1.5">
                  <Label htmlFor="logo-alt" className="text-[10px] text-gray-600 dark:text-slate-300">
                    Alt text (for accessibility)
                  </Label>
                  <Input
                    id="logo-alt"
                    value={logoAltText}
                    onChange={(e) => {
                      setLogoAltText(e.target.value)
                      handleInputChange('logoAltText')
                    }}
                    placeholder="Company Logo"
                    className="h-7 text-[11px]"
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div data-studio-master-part={studio ? 'footer' : undefined} className="px-3 py-2 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 space-y-1.5">
        {/* Clear All Button */}
        <Button
          variant="ghost"
          size="sm"
          data-studio-master-action={studio ? 'clear' : undefined}
          onClick={handleClearAll}
          disabled={isLoading || isSaving || (studio && !studioKnown())}
          className="w-full h-7 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3 mr-1.5" />
          Clear All Settings
        </Button>

        {/* Save/Cancel Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            data-studio-master-action={studio ? 'cancel' : undefined}
            onClick={onClose}
            disabled={!studio && isSaving}
            className="flex-1 h-7 text-[11px]"
          >
            Cancel
          </Button>
          <Button
            data-studio-master-action={studio ? 'save' : undefined}
            onClick={handleSave}
            disabled={isSaving || !hasChanges || (studio && !studioKnown())}
            className="flex-1 h-7 text-[11px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
