"use client"

import "@/components/builder/studio-decks.css"
import "@/components/builder/studio-duplicate-deck.css"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useChatSessions } from "@/hooks/use-chat-sessions"
import { sessionCacheKey, sessionMetadataCacheKey } from "@/hooks/use-session-cache"
import { lastBuilderSessionKey } from "@/lib/last-builder-session"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Plus, Search, Filter, MoreVertical, Sparkles, Calendar, Users, Crown, Folder, Tag, X, ChevronDown, LayoutGrid, List, Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { StudioIntroReplay } from "@/components/studio-intro-replay"
import "@/components/studio-libraries/destination-intros.css"
import { useRouter } from "next/navigation"
import { LAYOUT_VIEWER_URL_POLICY, getLayoutServiceUrl } from "@/lib/layout-service-client"
import { evaluateLayoutViewerUrl } from "@/lib/layout-viewer-url-policy"
import { viewOnlyIfEnabled } from "@/lib/present-view-only"
import { deckCardDescription, deckCardStatusLabel } from "@/lib/studio-deck-cards"
import { studioDeckCardCountLabel, studioDeckCardPreviewUrl } from "@/lib/studio-deck-card-count"
import { studioCreateLabel } from "@/lib/studio-create-word"
import { studioDeckShownTitle, studioDeckTitleProps } from "@/lib/studio-deck-title"
import { studioTemplateDisplayName } from "@/lib/studio-template-display-name"
// FRONTEND-2 Pass 3 (NEXT_PUBLIC_STUDIO_DUPLICATE_DECK, default off): the deck list can copy a deck. Everything below is behind the flag; off, the Duplicate item stays disabled as it was.
import { toast } from "@/hooks/use-toast"
import { duplicateTargetFor, runDuplicateDeck } from "@/lib/studio-duplicate-deck"
import { useStudioDeckCardThumbnail } from "@/hooks/use-studio-deck-card-thumbnail" // DECK-CARD-THUMBNAIL (NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED, default off): a card shows its first-slide image instead of the live viewer

// NEXT_PUBLIC_STUDIO_LAUNCH_WORDING (default off): launched wording instead of promises and developer-speak; off, this file is exactly as before.
const LAUNCH_WORDING = process.env.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === "true"

interface Presentation {
  id: string
  title: string
  description: string
  createdAt: string
  updatedAt: string
  slideCount: number
  status: "draft" | "completed" | "in-progress"
  thumbnail: string
  folder?: string
  tags: string[]
  strawmanPreviewUrl?: string | null
  finalPresentationUrl?: string | null
  currentStage?: number
}

// PASS2D T (NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES, default off): a deck titled with a stored upload name ("Deck03_Northwind_QBR.pptx — upload 2026-10-12 22:53 UTC [id]") is drawn by
// its clean name ("Deck03 Northwind QBR"); the stored title stays in a tooltip and in search, and any other title is drawn as it is. Off, this returns the stored title.
const DECK_TITLE_NAMES = process.env.NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES === "true"
const deckTitle = (presentation: { title: string }) => DECK_TITLE_NAMES ? studioDeckShownTitle(presentation.title, studioTemplateDisplayName) : presentation.title

interface Folder {
  id: string
  name: string
  color: string
  count: number
}

interface DeckPagination {
  nextOffset: number
  hasMore: boolean
  sessionCount: number
}

function PresentationPreview({ presentation }: { presentation: Presentation }) {
  // PASS2D R5 (NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT, default off): an unfinished deck previews its strawman, the deck its count describes (not a blank final deck).
  const candidate = process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT === "true" ? studioDeckCardPreviewUrl(presentation) : presentation.finalPresentationUrl || presentation.strawmanPreviewUrl
  const decision = evaluateLayoutViewerUrl(candidate, LAYOUT_VIEWER_URL_POLICY)
  const deckCardThumbnail = useStudioDeckCardThumbnail(decision, deckTitle(presentation)) // DECK-CARD-THUMBNAIL: null with the flag off, and whenever today's preview is to be drawn
  if (deckCardThumbnail) return deckCardThumbnail // DECK-CARD-THUMBNAIL

  if (decision.status === 'allowed') {
    return (
      <iframe
        src={viewOnlyIfEnabled(decision.url)}
        className="w-full h-full pointer-events-none"
        title={deckTitle(presentation)}
        loading="lazy"
        tabIndex={-1}
      />
    )
  }

  return (
    <div className="relative h-full w-full">
      <img
        src="/placeholder.svg"
        alt={deckTitle(presentation)}
        className="w-full h-full object-cover"
      />
      {decision.status === 'blocked' && (
        <span className="absolute inset-x-2 bottom-2 rounded bg-amber-950/80 px-2 py-1 text-center text-xs text-white">
          Preview unavailable in this environment
        </span>
      )}
    </div>
  )
}

// NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: what the page passes a card when the flag is on. Undefined (flag off) renders the disabled "Duplicate" item and its note exactly as before.
// `reason` is why this deck cannot be copied (null = it can); `state` is idle, busy (this card is being copied) or locked (another copy or a library read is running).
interface DuplicateControl { reason: string | null; state: "idle" | "busy" | "locked"; onSelect: () => void }

function PresentationCard({ presentation, onOpen, getStatusColor, getStageName, onDelete, deleteDisabled, duplicate }: {
  presentation: Presentation; onOpen: (id: string) => void
  onDelete?: (presentation: Presentation) => void; deleteDisabled?: boolean; duplicate?: DuplicateControl
  getStatusColor: (status: string) => string; getStageName: (stage: number) => string
}) {
  const href = `/builder?session_id=${encodeURIComponent(presentation.id)}`
  const unavailableNote = `deck-actions-${presentation.id}`
  // PASS2 #10 (flag NEXT_PUBLIC_STUDIO_DECK_CARDS_V2, default off): one plain status word, no internal stage label, and no
  // description that only repeats the title. Off: the card below is unchanged.
  const cardsV2 = process.env.NEXT_PUBLIC_STUDIO_DECK_CARDS_V2 === "true"
  // PASS2D R5 (flag NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT, default off): an unfinished deck's count is the outline's, so the card says "3 slides planned", not "3 slides" over a "1 / 1" thumbnail.
  const slideCountLabel = process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT === "true"
  const description = cardsV2 ? deckCardDescription(presentation.title, presentation.description) : presentation.description
  const duplicateNote = duplicate ? [duplicate.reason, onDelete ? null : LAUNCH_WORDING ? "Deleting decks isn't available right now." : "Delete is not connected in this library."].filter(Boolean).join(" ") : ""
  return <Card data-studio-deck-card="true" className={duplicate?.state === "busy" ? "hover:shadow-lg transition-shadow cursor-pointer opacity-70" : "hover:shadow-lg transition-shadow cursor-pointer"} {...(duplicate?.state === "busy" ? { "data-studio-deck-duplicating": "true" } : {})} onClick={() => onOpen(presentation.id)}>
    <Link href={href} onClick={event => event.stopPropagation()} aria-label={`Open ${deckTitle(presentation)} in Studio`} data-studio-deck-preview="true" className="block aspect-video bg-slate-100 rounded-t-lg overflow-hidden"><PresentationPreview presentation={presentation} /></Link>
    <CardHeader data-studio-deck-card-header="true"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><CardTitle className="text-lg line-clamp-1"><Link href={href} onClick={event => event.stopPropagation()} {...(DECK_TITLE_NAMES ? studioDeckTitleProps(presentation.title, deckTitle(presentation)) : {})}>{deckTitle(presentation)}</Link></CardTitle>{(!cardsV2 || description !== null) && <CardDescription className="line-clamp-2 mt-1">{description}</CardDescription>}</div>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0 shrink-0" aria-label={`Manage ${deckTitle(presentation)}`} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>{duplicate?.state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" data-studio-deck-menu="true" onClick={event => event.stopPropagation()}><DropdownMenuItem asChild><Link href={href}>Edit</Link></DropdownMenuItem>{duplicate && !duplicate.reason ? <DropdownMenuItem data-studio-deck-duplicate="true" disabled={duplicate.state !== "idle"} onSelect={() => duplicate?.onSelect()}>{duplicate.state === "busy" ? "Copying…" : "Duplicate"}</DropdownMenuItem> : <DropdownMenuItem disabled aria-describedby={unavailableNote}>Duplicate</DropdownMenuItem>}{onDelete ? <DropdownMenuItem disabled={deleteDisabled} data-studio-deck-delete="true" className="text-red-600" onSelect={() => onDelete(presentation)}>Delete session…</DropdownMenuItem> : <DropdownMenuItem disabled className="text-red-600" aria-describedby={unavailableNote}>Delete</DropdownMenuItem>}{duplicate ? duplicateNote ? <p id={unavailableNote} className="max-w-56 px-2 py-2 text-xs text-muted-foreground">{duplicateNote}</p> : null : <p id={unavailableNote} className="max-w-56 px-2 py-2 text-xs text-muted-foreground">{LAUNCH_WORDING ? onDelete ? "Duplicating decks isn't available right now." : "Duplicating and deleting decks isn't available right now." : onDelete ? "Duplicate is not connected in this library." : "Duplicate and delete are not connected in this library."}</p>}</DropdownMenuContent></DropdownMenu>
    </div></CardHeader>
    <CardContent data-studio-deck-card-content="true"><div className="space-y-3"><div className="flex items-center justify-between"><div data-studio-deck-meta="true" className="flex items-center space-x-4 text-sm text-slate-500">{slideCountLabel ? <span data-studio-deck-count="true">{studioDeckCardCountLabel(presentation.slideCount, presentation.status)}</span> : <span>{presentation.slideCount} slides</span>}<span>Updated {new Date(presentation.updatedAt).toLocaleDateString()}</span></div><div className="flex gap-2"><Badge data-studio-deck-status={presentation.status} className={getStatusColor(presentation.status)}>{cardsV2 ? deckCardStatusLabel(presentation) : presentation.status}</Badge>{!cardsV2 && presentation.currentStage && <Badge variant="outline" className="text-xs">Stage {presentation.currentStage}: {getStageName(presentation.currentStage)}</Badge>}</div></div>{presentation.tags.length > 0 && <div className="flex flex-wrap gap-1">{presentation.tags.slice(0, 3).map(tag => <Badge key={tag} variant="outline" className="text-xs"><Tag className="h-3 w-3 mr-1" />{tag}</Badge>)}{presentation.tags.length > 3 && <Badge variant="outline" className="text-xs">+{presentation.tags.length - 3}</Badge>}</div>}</div></CardContent>
  </Card>
}

function getStatusFromStage(stage: number): "draft" | "completed" | "in-progress" {
  if (stage === 6) return "completed"
  if (stage >= 4) return "in-progress"
  return "draft"
}

function getFirstMessage(session: any): string {
  return session.messages?.[0]?.userText || session.title || 'No description available'
}


export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const owner = user?.id ?? user?.email ?? 'signed-out'
  // Counts, filters, confirmations and pending reads all belong to this account.
  return <DashboardForAccount key={owner} user={user} isLoading={isLoading} />
}

function DashboardForAccount({ user, isLoading }: Pick<ReturnType<typeof useAuth>, 'user' | 'isLoading'>) {
  const { loadSessions, deleteSession } = useChatSessions()
  const [presentations, setPresentations] = useState<Presentation[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState<"completed" | "strawman">("completed")
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null)
  const [sessionsError, setSessionsError] = useState("")
  const [pagination, setPagination] = useState<DeckPagination | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState("")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [deleteTarget, setDeleteTarget] = useState<{ presentation: Presentation; owner: string } | null>(null)
  const [isDeletingSession, setIsDeletingSession] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [deleteNotice, setDeleteNotice] = useState("")
  // FRONTEND-2 Pass 3 (NEXT_PUBLIC_STUDIO_DUPLICATE_DECK, exact "true", default off, read at build time): a deck's card menu can copy it (lib/studio-duplicate-deck.ts). Off, none of this runs.
  const duplicateDeckEnabled = process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_DECK === "true"
  const [duplicating, setDuplicating] = useState<{ id: string; title: string } | null>(null)
  const [duplicateError, setDuplicateError] = useState("")
  const duplicationPending = useRef(false)
  const deletion = useRef(0)
  const deletionPending = useRef(false)
  const request = useRef(0)
  const requestPending = useRef(false)
  const paginationRef = useRef<DeckPagination | null>(null)
  const loadedSessionIds = useRef(new Set<string>())
  const searchInput = useRef<HTMLInputElement>(null)
  const owner = user?.id ?? user?.email ?? null
  const currentOwner = useRef(owner)
  currentOwner.current = owner
  const hasLoadedSessions = Boolean(owner && loadedOwner === owner)
  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"
  // PASS2B G54 (NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS, default off, Studio shell only): the second tab reads "Outline previews".
  const plainNavLabels = studioShell && process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS === "true"
  // PASS2B G56 (NEXT_PUBLIC_STUDIO_CREATE_WORD, default off, Studio shell only): the create buttons say "New deck", as the top bar does.
  const createWord = studioShell && process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD === "true"
  // PASS2B G53 (NEXT_PUBLIC_STUDIO_DECK_GRID_4, default off, Studio shell only): four cards per row from the xl breakpoint (1280 px), as in the mockup.
  const deckGrid4 = studioShell && process.env.NEXT_PUBLIC_STUDIO_DECK_GRID_4 === "true"
  const router = useRouter()

  // Load sessions from API
  const fetchSessions = useCallback(async (append = false) => {
      if (deletionPending.current || requestPending.current) return
      const page = paginationRef.current
      if (append && (!page || !page.hasMore)) return
      const currentRequest = ++request.current
      if (!owner) {
        setIsLoadingSessions(false)
        setSessionsError("Your account session is unavailable. Reload to sign in again.")
        return
      }

      const offset = append && page ? page.nextOffset : 0
      requestPending.current = true
      try {
        if (append) setIsLoadingMore(true)
        else { setIsLoadingSessions(true); setSessionsError("") }
        setMoreError("")
        const result = await loadSessions({
          limit: 100,
          status: 'active',
          ...(offset ? { offset } : {}),
        })
        if (currentRequest !== request.current) return

        if (result) {
          // Filter to only show sessions with strawman or final presentations (stage >= 4)
          const sessionsWithPresentations = result.sessions.filter(
            session => session.currentStage >= 4
          )

          const transformedPresentations = sessionsWithPresentations.map(session => ({
            id: session.id,
            title: session.title || 'Untitled Presentation',
            description: getFirstMessage(session),
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            slideCount: session.slideCount || 0,
            status: getStatusFromStage(session.currentStage),
            thumbnail: '/placeholder.svg',
            folder: 'general',
            tags: [],
            strawmanPreviewUrl: session.strawmanPreviewUrl,
            finalPresentationUrl: session.finalPresentationUrl,
            currentStage: session.currentStage,
          }))

          setPresentations(existing => append
            ? Array.from(new Map([...existing, ...transformedPresentations].map(item => [item.id, item])).values())
            : transformedPresentations)
          if (!append) loadedSessionIds.current.clear()
          result.sessions.forEach(session => loadedSessionIds.current.add(session.id))
          // The API total includes excluded old empty sessions. A short/empty
          // page is exhausted even if that unfiltered count says hasMore.
          const nextPage = {
            nextOffset: offset + result.pagination.limit,
            hasMore: result.pagination.hasMore && result.sessions.length >= result.pagination.limit,
            sessionCount: loadedSessionIds.current.size,
          }
          paginationRef.current = nextPage
          setPagination(nextPage)
          setLoadedOwner(owner)
        } else {
          if (append) setMoreError("More sessions could not be loaded. Your loaded decks are still shown.")
          else setSessionsError("Your presentations could not be loaded. Try refreshing the library.")
        }
      } catch (error) {
        if (currentRequest === request.current) {
          if (append) setMoreError("More sessions could not be loaded. Your loaded decks are still shown.")
          else setSessionsError("Your presentations could not be loaded. Try refreshing the library.")
        }
      } finally {
        if (currentRequest === request.current) {
          requestPending.current = false
          setIsLoadingSessions(false)
          setIsLoadingMore(false)
        }
      }
  }, [owner, loadSessions])
  useEffect(() => {
    setPresentations([]); setLoadedOwner(null); setSessionsError("")
    setPagination(null); paginationRef.current = null; loadedSessionIds.current.clear()
    setIsLoadingMore(false); setMoreError(""); requestPending.current = false
    deletion.current += 1; deletionPending.current = false
    setDeleteTarget(null); setIsDeletingSession(false); setDeleteError(""); setDeleteNotice("")
    void fetchSessions()
    return () => { request.current += 1; deletion.current += 1; deletionPending.current = false; requestPending.current = false }
  }, [fetchSessions])

  const requestDelete = (presentation: Presentation) => {
    if (!studioShell || !owner || !hasLoadedSessions || requestPending.current || deletionPending.current) return
    setDeleteError(""); setDeleteNotice("")
    setDeleteTarget({ presentation, owner })
  }

  const confirmDelete = async () => {
    const target = deleteTarget
    if (!studioShell || !target || target.owner !== currentOwner.current || loadedOwner !== target.owner || deletionPending.current || requestPending.current || !presentations.some(item => item.id === target.presentation.id)) return
    const attempt = ++deletion.current
    deletionPending.current = true
    setIsDeletingSession(true); setDeleteError("")
    // Invalidate any older library response before this owned-session mutation.
    request.current += 1
    try {
      const acknowledged = await deleteSession(target.presentation.id)
      if (attempt !== deletion.current || currentOwner.current !== target.owner) return
      if (!acknowledged) {
        setDeleteError("The server did not confirm deletion. This session is still shown. Try again, or cancel and refresh the library to check its status.")
        return
      }
      // Match History's owner-scoped cache cleanup; never purge another session.
      let cacheCleared = true
      for (const key of [sessionCacheKey(target.owner, target.presentation.id), sessionMetadataCacheKey(target.owner, target.presentation.id)]) {
        try { sessionStorage.removeItem(key) } catch { cacheCleared = false }
      }
      try {
        const key = lastBuilderSessionKey(target.owner)
        if (localStorage.getItem(key) === target.presentation.id) localStorage.removeItem(key)
      } catch { cacheCleared = false }
      setPresentations(items => items.filter(item => item.id !== target.presentation.id))
      if (loadedSessionIds.current.delete(target.presentation.id) && paginationRef.current) {
        const page = paginationRef.current
        const adjusted = { ...page, nextOffset: Math.max(0, page.nextOffset - 1), sessionCount: loadedSessionIds.current.size }
        paginationRef.current = adjusted
        setPagination(adjusted)
      }
      setDeleteTarget(null)
      setDeleteNotice(`“${deckTitle(target.presentation)}” was removed from Decks and session history.${cacheCleared ? '' : ' Your browser could not clear every local reference.'}`)
    } catch {
      if (attempt === deletion.current && currentOwner.current === target.owner) setDeleteError("Deletion could not be confirmed. This session is still shown. Try again, or cancel and refresh the library.")
    } finally {
      if (attempt === deletion.current && currentOwner.current === target.owner) {
        deletionPending.current = false
        setIsDeletingSession(false)
      }
    }
  }

  const duplicateSession = async (presentation: Presentation) => {
    if (!duplicateDeckEnabled || !owner || !hasLoadedSessions || duplicationPending.current || requestPending.current || deletionPending.current) return
    const target = duplicateTargetFor(presentation, url => evaluateLayoutViewerUrl(url, LAYOUT_VIEWER_URL_POLICY))
    if (!target.ok) return
    const copyOwner = owner
    const shownTitle = deckTitle(presentation)
    duplicationPending.current = true
    setDuplicating({ id: presentation.id, title: shownTitle }); setDuplicateError("")
    try {
      // Layout copies the deck first; then the new session row; a failure after the Layout copy soft-deletes the new session (see lib/studio-duplicate-deck.ts).
      const result = await runDuplicateDeck({
        source: { sessionId: presentation.id, shownTitle, currentStage: presentation.currentStage, slideCount: presentation.slideCount },
        target,
        deps: {
          fetch: (input, init) => fetch(input, init),
          layoutBaseUrl: () => getLayoutServiceUrl(),
          newId: () => crypto.randomUUID(),
          now: () => new Date(),
          sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
        },
      })
      if (currentOwner.current !== copyOwner) return
      if (!result.ok) { setDuplicateError(result.message); return }
      const stamp = (value: unknown) => typeof value === "string" && value ? value : new Date().toISOString()
      const copy: Presentation = {
        id: result.sessionId, title: result.title, description: result.title,
        createdAt: stamp(result.session?.createdAt), updatedAt: stamp(result.session?.updatedAt),
        slideCount: result.slideCount, status: getStatusFromStage(result.currentStage), thumbnail: '/placeholder.svg', folder: 'general', tags: [],
        strawmanPreviewUrl: result.slot === "strawman" ? result.presentationUrl : null,
        finalPresentationUrl: result.slot === "final" ? result.presentationUrl : null,
        currentStage: result.currentStage,
      }
      // The new card goes first (its lastMessageAt is now), without a reload; the paging offset moves with it, as it does when a loaded deck is deleted.
      setPresentations(items => [copy, ...items.filter(item => item.id !== copy.id)])
      loadedSessionIds.current.add(copy.id)
      if (paginationRef.current) {
        const page = paginationRef.current
        const adjusted = { ...page, nextOffset: page.nextOffset + 1, sessionCount: loadedSessionIds.current.size }
        paginationRef.current = adjusted
        setPagination(adjusted)
      }
      toast({ title: "Deck copied", description: `“${result.title}” is in your decks. Chat history stays with the original.` })
    } catch {
      if (currentOwner.current === copyOwner) setDuplicateError("The deck could not be copied. Nothing was created.")
    } finally {
      duplicationPending.current = false
      if (currentOwner.current === copyOwner) setDuplicating(null)
    }
  }

  // Keep folder structure for future use
  useEffect(() => {
    setFolders([
      { id: "all", name: "All Presentations", color: "slate", count: presentations.length },
      { id: "general", name: "General", color: "purple", count: presentations.length },
    ])
  }, [presentations])

  // NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: undefined with the flag off, so a card renders exactly as before.
  const duplicateControl = (presentation: Presentation): DuplicateControl | undefined => {
    if (!duplicateDeckEnabled) return undefined
    const target = duplicateTargetFor(presentation, url => evaluateLayoutViewerUrl(url, LAYOUT_VIEWER_URL_POLICY))
    return {
      reason: target.ok ? null : target.reason,
      state: duplicating?.id === presentation.id ? "busy" : duplicating || isLoadingSessions || isLoadingMore || isDeletingSession ? "locked" : "idle",
      onSelect: () => { void duplicateSession(presentation) },
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700"
      case "in-progress":
        return "bg-blue-100 text-blue-700"
      case "draft":
        return "bg-slate-100 text-slate-700"
      default:
        return "bg-slate-100 text-slate-700"
    }
  }

  const getStageName = (stage: number): string => {
    switch (stage) {
      case 1: return 'Starting'
      case 2: return 'Planning'
      case 3: return 'Outlining'
      case 4: return 'Preview Ready'
      case 5: return 'Refining'
      case 6: return 'Complete'
      default: return 'Unknown'
    }
  }

  // Get all unique tags from presentations
  const allTags = Array.from(new Set(presentations.flatMap(p => p.tags)))

  // Real "this month" count derived from createdAt
  const now = new Date()
  const presentationsThisMonth = presentations.filter((p) => {
    const d = new Date(p.createdAt)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const thisMonthLabel = now.toLocaleDateString("en-US", { month: "long" })

  // Tab-based filtering: split presentations by completion status
  const completedPresentations = presentations.filter(p => p.finalPresentationUrl)
  const strawmanPresentations = presentations.filter(p => p.strawmanPreviewUrl && !p.finalPresentationUrl)

  // Get the presentations for the active tab
  const tabPresentations = activeTab === "completed" ? completedPresentations : strawmanPresentations

  // Advanced filtering logic
  const filteredPresentations = tabPresentations.filter((p) => {
    // Search filter
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    // Folder filter
    const matchesFolder = !selectedFolder || selectedFolder === "all" || p.folder === selectedFolder

    // Tags filter
    const matchesTags = selectedTags.length === 0 || selectedTags.some(tag => p.tags.includes(tag))

    // Status filter
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(p.status)

    return matchesSearch && matchesFolder && matchesTags && matchesStatus
  })

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    )
  }

  const clearFilters = () => {
    setSelectedFolder(null)
    setSelectedTags([])
    setSelectedStatuses([])
    setSearchQuery("")
  }

  const activeFiltersCount =
    (selectedFolder && selectedFolder !== "all" ? 1 : 0) +
    selectedTags.length +
    selectedStatuses.length
  const hasActiveCriteria = Boolean(searchQuery || activeFiltersCount)

  // User authentication is handled by middleware
  
  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <main data-studio-decks="true" data-studio-intro-surface="decks" className="container mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div data-studio-deck-welcome="true" className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div data-studio-deck-heading="true" className="mb-2 flex items-center gap-3">
            <h1 className="text-3xl font-bold">{studioShell ? 'Your decks' : `Welcome back, ${user?.name || 'there'}!`}</h1>
            <Badge variant="outline">
              {user?.tier === "premium"
                ? "Max Plan"
                : user?.tier && user.tier !== "free"
                  ? `${user.tier.charAt(0).toUpperCase() + user.tier.slice(1)} Plan`
                  : "Free Plan"}
              {(user?.tier === "pro" || user?.tier === "premium") && <Crown className="ml-1 h-3 w-3" />}
            </Badge>
          </div>
          <p className="text-slate-600 dark:text-slate-400">{studioShell ? 'Your presentations and outline previews, ready to continue.' : 'Ready to create amazing presentations with your AI agent team?'}</p>
        </div>
        <Button data-studio-deck-primary="true" asChild>
          <Link href="/builder">
            <Plus className="mr-2 h-4 w-4" />
            {studioCreateLabel(createWord, "New Presentation")}
          </Link>
        </Button>
      </div>

        {/* Quick Stats */}
        <div data-studio-deck-stats="true" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card data-studio-deck-stat="true">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{studioShell ? 'Loaded decks' : 'Total Presentations'}</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent data-studio-deck-card-content="true">
              <div className="text-2xl font-bold">{studioShell && !hasLoadedSessions ? '—' : presentations.length}</div>
              <p className="text-xs text-muted-foreground">
                {studioShell ? pagination ? `From ${pagination.sessionCount} loaded active sessions` : 'From your active sessions' : user?.tier === "free" ? `${Math.max(0, 3 - presentations.length)} remaining in free plan` : "Unlimited"}
              </p>
            </CardContent>
          </Card>

          <Card data-studio-deck-stat="true">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent data-studio-deck-card-content="true">
              <div className="text-2xl font-bold">{studioShell && !hasLoadedSessions ? '—' : presentationsThisMonth}</div>
              <p className="text-xs text-muted-foreground">Created in {thisMonthLabel}</p>
            </CardContent>
          </Card>

          <Card data-studio-deck-stat="true">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{studioShell || LAUNCH_WORDING ? 'Outline previews' : 'AI Collaborations'}</CardTitle>
              {studioShell || LAUNCH_WORDING ? <Folder className="h-4 w-4 text-muted-foreground" /> : <Users className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent data-studio-deck-card-content="true">
              <div className="text-2xl font-bold text-muted-foreground">{(studioShell || LAUNCH_WORDING) && hasLoadedSessions ? strawmanPresentations.length : '—'}</div>
              <p className="text-xs text-muted-foreground">{studioShell || LAUNCH_WORDING ? 'Loaded previews without a completed deck' : 'Coming soon'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Folders */}
        {!LAUNCH_WORDING && <div data-studio-deck-folders="true" className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Folder className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-semibold">Folders</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {folders.map((folder) => (
              <Button
                key={folder.id}
                aria-pressed={selectedFolder === folder.id || (!selectedFolder && folder.id === 'all')}
                data-studio-deck-selected={selectedFolder === folder.id ? 'true' : undefined}
                variant={selectedFolder === folder.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFolder(folder.id)}
                className="gap-2"
              >
                <Folder className="h-4 w-4" />
                {folder.name}
                <Badge variant="secondary" className="ml-1">
                  {folder.count}
                </Badge>
              </Button>
            ))}
          </div>
        </div>}

        {/* Search and Filter */}
        <div data-studio-deck-search="true" className="space-y-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                ref={searchInput}
                aria-label="Search presentations"
                placeholder="Search presentations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9"
              />
              {searchQuery && <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" aria-label="Clear presentation search" onClick={() => { setSearchQuery(''); searchInput.current?.focus() }}><X className="h-4 w-4" /></Button>}
            </div>
            <Button
              data-studio-deck-selected={showFilters ? 'true' : undefined}
              aria-expanded={showFilters}
              aria-controls="deck-filter-panel"
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
            {hasActiveCriteria && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            )}
          </div>
          <div data-studio-deck-results="true"><p role="status">{isLoadingMore ? 'Loading more presentations…' : isLoadingSessions ? hasLoadedSessions ? 'Refreshing your presentations…' : 'Loading your presentations…' : !hasLoadedSessions ? 'Library not loaded' : `${filteredPresentations.length} of ${tabPresentations.length} loaded ${activeTab === 'completed' ? 'completed presentations' : 'outline previews'}${hasActiveCriteria ? ' match' : ''}`}</p><div className="flex items-center gap-2">{studioShell && <div data-studio-deck-view-controls="true" role="group" aria-label="Presentation view"><Button variant="ghost" size="sm" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid className="h-4 w-4 mr-1.5" />Grid</Button><Button variant="ghost" size="sm" aria-pressed={view === 'list'} onClick={() => setView('list')}><List className="h-4 w-4 mr-1.5" />List</Button></div>}<Button variant="outline" size="sm" disabled={isLoadingSessions || isLoadingMore || !owner || (studioShell && isDeletingSession)} onClick={() => void fetchSessions()}><RefreshCw className={`h-4 w-4 mr-1.5${isLoadingSessions ? ' animate-spin' : ''}`} />Refresh</Button></div></div>
          {sessionsError && <div data-studio-deck-error="true" role="alert"><div><strong>{sessionsError}</strong>{hasLoadedSessions && <p>Showing the last loaded records. Refresh to check for updates.</p>}</div><Button variant="outline" size="sm" disabled={isLoadingSessions || isLoadingMore || !owner || (studioShell && isDeletingSession)} onClick={() => void fetchSessions()}>Retry library</Button></div>}

          {studioShell && deleteNotice && <p data-studio-deck-delete-notice="true" role="status">{deleteNotice}</p>}

          {duplicateDeckEnabled && duplicating && <p data-studio-deck-duplicate-status="true" role="status" className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Loader2 className="h-3.5 w-3.5 animate-spin" />Copying “{duplicating.title}”… This can take a moment.</p>}
          {duplicateDeckEnabled && duplicateError && <div data-studio-deck-duplicate-error="true" role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"><p>{duplicateError}</p><Button variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-xs" onClick={() => setDuplicateError("")}>Dismiss</Button></div>}

          {/* Filter Panel */}
          {showFilters && (
            <Card id="deck-filter-panel" data-studio-deck-filters="true" className="p-4">
              <div className="space-y-4">
                {/* Status Filters */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <ChevronDown className="h-4 w-4" />
                    Status
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {["draft", "in-progress", "completed"].map((status) => (
                      <Button
                        key={status}
                        aria-pressed={selectedStatuses.includes(status)}
                        data-studio-deck-selected={selectedStatuses.includes(status) ? 'true' : undefined}
                        variant={selectedStatuses.includes(status) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleStatus(status)}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Tag Filters */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <Button
                        key={tag}
                        aria-pressed={selectedTags.includes(tag)}
                        data-studio-deck-selected={selectedTags.includes(tag) ? 'true' : undefined}
                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Button>
                    ))}
                    {allTags.length === 0 && <p className="text-xs text-muted-foreground">{hasLoadedSessions ? 'No tags on the loaded presentations.' : 'Tags will appear when the library is loaded.'}</p>}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Tabs for Completed vs Strawman Presentations */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "completed" | "strawman")} className="space-y-6">
          <TabsList data-studio-deck-tabs="true" className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="completed">
              Completed Presentations ({completedPresentations.length})
            </TabsTrigger>
            <TabsTrigger value="strawman">
              {plainNavLabels ? <>Outline previews ({strawmanPresentations.length})</> : <>Strawman Previews ({strawmanPresentations.length})</>}
            </TabsTrigger>
          </TabsList>

          {(["completed", "strawman"] as const).map(tab => <TabsContent key={tab} value={tab} className="space-y-6">
            {!hasLoadedSessions && !sessionsError ? <div data-studio-deck-loading="true" role="status" className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading presentations…</div> : !hasLoadedSessions && sessionsError ? <div data-studio-deck-empty="true" className="text-center py-12"><h3 className="text-lg font-semibold mb-2">Your library is unavailable</h3><p className="text-slate-600">Retry the library above to load your presentations.</p></div> : <>
              <div data-studio-deck-grid="true" data-studio-deck-view={view} className={deckGrid4 ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>{filteredPresentations.map(presentation => <PresentationCard key={presentation.id} presentation={presentation} onOpen={id => router.push(`/builder?session_id=${encodeURIComponent(id)}`)} getStatusColor={getStatusColor} getStageName={getStageName} onDelete={studioShell && hasLoadedSessions ? requestDelete : undefined} deleteDisabled={isLoadingSessions || isLoadingMore || isDeletingSession} duplicate={duplicateControl(presentation)} />)}</div>
              {filteredPresentations.length === 0 && hasLoadedSessions && <div data-studio-deck-empty="true" className="text-center py-12"><Sparkles className="h-12 w-12 text-slate-400 mx-auto mb-4" /><h3 className="text-lg font-semibold mb-2">{hasActiveCriteria ? "No matching presentations" : tab === "completed" ? "No completed presentations found" : "No strawman previews found"}</h3><p className="text-slate-600 mb-4">{hasActiveCriteria ? "Try a different search or clear the folder, tag, and status filters." : tab === "completed" ? "Complete a strawman preview to create your first presentation." : "Create a presentation to generate a strawman preview."}</p>{hasActiveCriteria ? <Button variant="outline" onClick={clearFilters}><X className="mr-2 h-4 w-4" />Clear search and filters</Button> : <Button data-studio-deck-primary="true" asChild><Link href="/builder"><Plus className="mr-2 h-4 w-4" />{studioCreateLabel(createWord, "Create Presentation")}</Link></Button>}</div>}
            </>}
          </TabsContent>)}
        </Tabs>
      {studioShell && hasLoadedSessions && pagination && <section data-studio-deck-pagination="true" aria-label="Load more owned sessions">
        <p>{pagination.sessionCount} active sessions loaded. Search and filters apply to these loaded records.{pagination.hasMore ? ' Load more to find older decks.' : ''}</p>
        {moreError && <p role="alert">{moreError} Retry loading more or refresh the library.</p>}
        {pagination.hasMore && <Button variant="outline" disabled={isLoadingSessions || isLoadingMore || isDeletingSession} aria-busy={isLoadingMore} onClick={() => void fetchSessions(true)}>{isLoadingMore ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading more…</> : moreError ? 'Retry loading more' : 'Load more sessions'}</Button>}
      </section>}
      {studioShell && <AlertDialog open={Boolean(deleteTarget && deleteTarget.owner === owner)} onOpenChange={open => { if (!open && !deletionPending.current) { setDeleteTarget(null); setDeleteError("") } }}>
        <AlertDialogContent data-studio-deck-delete-dialog="true" aria-busy={isDeletingSession} onCloseAutoFocus={event => { event.preventDefault(); searchInput.current?.focus() }} onEscapeKeyDown={event => { if (deletionPending.current) event.preventDefault() }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription data-studio-deck-delete-description="true">This removes the session and its presentation from your Decks library and session history. There is no restore option here. Exported files and shared presentation links are not deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <div data-studio-deck-delete-summary="true"><strong>{deleteTarget ? deckTitle(deleteTarget.presentation) : undefined}</strong><span>{deleteTarget?.presentation.slideCount} slides · {deleteTarget?.presentation.status}</span></div>
          {deleteError && <p data-studio-deck-delete-error="true" role="alert">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSession}>Cancel</AlertDialogCancel>
            <AlertDialogAction data-studio-deck-delete-confirm="true" disabled={isDeletingSession} onClick={event => { event.preventDefault(); void confirmDelete() }}>{isDeletingSession ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</> : deleteError ? "Retry deletion" : "Delete session"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
      <StudioIntroReplay screen="decks" autoStart={true} enabled={!deleteTarget} targetSelector='[data-studio-intro-surface="decks"]' className="studio-destination-intro-replay" />
    </main>
  )
}
