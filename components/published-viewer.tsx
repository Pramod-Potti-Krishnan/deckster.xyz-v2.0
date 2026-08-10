"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Download,
  FileText,
  Maximize2,
  MessageCircleQuestion,
  Minimize2,
  Presentation,
  PlayCircle,
} from 'lucide-react'
import {
  PublishedPresenter,
  type NarrationManifest,
} from '@/components/published-presenter'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  PublishedQaPanel,
  useUnreadThreadCount,
  type FaqItemView,
} from '@/components/published-qa-panel'

interface PublishedViewerProps {
  title: string
  /** Published-deck slug — download links route through the server gate */
  slug: string
  /** Public Layout Service origin the browser can reach */
  layoutBaseUrl: string
  /** The frozen snapshot presentation viewers see */
  snapshotPresentationId: string
  slideCount: number
  allowPdf: boolean
  allowPptx: boolean
  /** Display name for the publisher — the only human name on this page. */
  ownerName: string
  /** Whether NEW questions are accepted. The FAQ stays readable either way:
   *  turning off the live endpoint does not retract published answers. */
  qaEnabled: boolean
  /** SSR'd so the FAQ is readable before any JavaScript runs. */
  initialFaq: FaqItemView[]
}

/**
 * Minimal-chrome viewer for published decks (/p/[slug]).
 *
 * The iframe loads the Layout Service's read-only viewer; navigation relies
 * on Reveal's built-in controls, keyboard, touch and #/N deep links — no
 * postMessage plumbing needed here.
 */
export function PublishedViewer({
  title,
  slug,
  layoutBaseUrl,
  snapshotPresentationId,
  slideCount,
  allowPdf,
  allowPptx,
  ownerName,
  qaEnabled,
  initialFaq,
}: PublishedViewerProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [qaOpen, setQaOpen] = useState(false)
  // The narrated run. Null until we know there is anything to play — the deck
  // is perfectly usable without it, so nothing here may block the slides.
  const [manifest, setManifest] = useState<NarrationManifest | null>(null)
  const [presenting, setPresenting] = useState(false)
  // Reveal deep link for a cited slide, 0-based (`#/2` is slide 3).
  const [slideHash, setSlideHash] = useState('')

  // The Q&A affordance appears when the owner accepts questions OR has already
  // published answers — a deck with an FAQ and questions since switched off is
  // still worth opening.
  const qaAvailable = qaEnabled || initialFaq.length > 0
  const unreadCount = useUnreadThreadCount(slug, qaAvailable)

  const handleCiteSlide = useCallback((slideNumber: number) => {
    // Reveal counts from 0; citations carry human 1-based slide numbers.
    setSlideHash(`#/${Math.max(0, slideNumber - 1)}`)
  }, [])

  // The read-only viewer for the iframe. Downloads no longer go straight to the
  // public Downloads service from here — they route through the server gate at
  // /api/publish/{slug}/download/{format}, which enforces the passcode + the
  // per-format flags before proxying + streaming the file back.
  const viewerUrl = `${layoutBaseUrl}/p/${snapshotPresentationId}?viewOnly=true${slideHash}`
  const downloadHref = (format: 'pdf' | 'pptx') => `/api/publish/${slug}/download/${format}`

  const canDownload = allowPdf || allowPptx

  // Ask once whether this deck can narrate. A 404 is the ordinary answer for a
  // deck with narration off, so it is not treated as an error.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(`/api/narration/manifest?slug=${encodeURIComponent(slug)}`)
        if (!response.ok || cancelled) return
        const data = (await response.json()) as NarrationManifest
        // Offered only when something is genuinely playable. A "Play" button
        // that produces silence is worse than no button.
        if (data.slides?.some((slide) => slide.full)) setManifest(data)
      } catch {
        /* narration is optional — the deck stands without it */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      stageRef.current?.requestFullscreen().catch(() => {})
    }
  }, [])

  return (
    <div className="h-dvh flex flex-col bg-gray-100 dark:bg-slate-900">
      {/* Top bar — title + actions */}
      <header className="flex-shrink-0 h-12 px-4 flex items-center justify-between gap-3 border-b border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <h1 className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <div className="flex flex-shrink-0 items-center gap-1">
          {qaAvailable && (
            <button
              onClick={() => setQaOpen((value) => !value)}
              className="relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              title={qaEnabled ? 'Ask a question about this deck' : 'Read answered questions'}
              aria-expanded={qaOpen}
            >
              <MessageCircleQuestion className="h-4 w-4" />
              <span className="hidden sm:inline">Ask</span>
              {unreadCount > 0 && (
                <span
                  className="absolute right-1 top-1 h-2 w-2 rounded-full bg-indigo-500"
                  aria-label={`${unreadCount} answered`}
                />
              )}
            </button>
          )}
          {canDownload && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
                  title="Download this presentation"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {allowPdf && (
                  <DropdownMenuItem asChild className="cursor-pointer">
                    {/* Plain anchor: hits the server gate, which streams the file
                        back with Content-Disposition (no client-side conversion) */}
                    <a href={downloadHref('pdf')}>
                      <FileText className="mr-2 h-4 w-4" />
                      <span>Download as PDF</span>
                    </a>
                  </DropdownMenuItem>
                )}
                {allowPptx && (
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <a href={downloadHref('pptx')}>
                      <Presentation className="mr-2 h-4 w-4" />
                      <span>Download as PPTX</span>
                    </a>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* ONE control. "Present" and "Play" were the same act described two
              ways — this is an interactive presentation, not a video, and
              offering both invited the reading that one of them is a passive
              watch. A deck with narration presents; a deck without one still
              goes fullscreen, which is what presenting meant before. */}
          {manifest && !presenting ? (
            <button
              onClick={() => {
                setPresenting(true)
                if (!document.fullscreenElement) {
                  stageRef.current?.requestFullscreen().catch(() => {})
                }
              }}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-700"
              title="Present this deck"
            >
              <PlayCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Present</span>
            </button>
          ) : (
            <button
              onClick={handleToggleFullscreen}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              title={isFullscreen ? 'Exit fullscreen' : 'Present fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Present'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Stage + Q&A. The panel NARROWS the stage rather than covering it, so a
          cited slide stays visible when the reader clicks its citation. */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <div
        ref={stageRef}
        className={`flex-1 min-h-0 flex items-center justify-center bg-gray-100 dark:bg-slate-900 ${isFullscreen ? 'bg-black p-0' : 'p-4'}`}
      >
        <div
          className={`overflow-hidden ${isFullscreen ? '' : 'rounded-sm shadow-2xl'}`}
          style={{
            aspectRatio: '16 / 9',
            // Fit-contain without layout math: cap width by both the column
            // and the height the chrome leaves over (~120px bar/footer/padding).
            width: isFullscreen
              ? 'min(100%, calc(100dvh * (16 / 9)))'
              : 'min(100%, calc((100dvh - 120px) * (16 / 9)))',
          }}
        >
          <iframe
            src={viewerUrl}
            className="h-full w-full border-0"
            title={title}
            allow="fullscreen"
          />
          {presenting && manifest && (
            <PublishedPresenter
              slug={slug}
              manifest={manifest}
              onSlide={handleCiteSlide}
              onExit={() => {
                setPresenting(false)
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
              }}
            />
          )}
        </div>
      </div>

        {/* Hidden in fullscreen: presenting is the one moment the deck should
            own the whole screen. */}
        {qaAvailable && !isFullscreen && (
          <PublishedQaPanel
            slug={slug}
            ownerName={ownerName}
            initialFaq={initialFaq}
            qaEnabled={qaEnabled}
            open={qaOpen}
            onClose={() => setQaOpen(false)}
            onCiteSlide={handleCiteSlide}
          />
        )}
      </div>

      {/* Footer — the viral loop */}
      <footer className="flex-shrink-0 flex items-center justify-center gap-1 py-2 text-xs text-slate-500 dark:text-slate-400">
        <span>Made with</span>
        <Link
          href="/"
          className="group inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Deckster
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/"
          className="inline-flex items-center gap-0.5 text-slate-600 underline-offset-2 hover:underline dark:text-slate-300"
        >
          create yours
          <ArrowRight className="h-3 w-3" />
        </Link>
      </footer>
    </div>
  )
}
