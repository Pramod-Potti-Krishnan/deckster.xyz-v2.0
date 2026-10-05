"use client"

import "@/components/builder/studio-decks.css"

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
import { LAYOUT_VIEWER_URL_POLICY } from "@/lib/layout-service-client"
import { evaluateLayoutViewerUrl } from "@/lib/layout-viewer-url-policy"

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
  const candidate = presentation.finalPresentationUrl || presentation.strawmanPreviewUrl
  const decision = evaluateLayoutViewerUrl(candidate, LAYOUT_VIEWER_URL_POLICY)

  if (decision.status === 'allowed') {
    return (
      <iframe
        src={decision.url}
        className="w-full h-full pointer-events-none"
        title={presentation.title}
        loading="lazy"
        tabIndex={-1}
      />
    )
  }

  return (
    <div className="relative h-full w-full">
      <img
        src="/placeholder.svg"
        alt={presentation.title}
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

function PresentationCard({ presentation, onOpen, getStatusColor, getStageName, onDelete, deleteDisabled }: {
  presentation: Presentation; onOpen: (id: string) => void
  onDelete?: (presentation: Presentation) => void; deleteDisabled?: boolean
  getStatusColor: (status: string) => string; getStageName: (stage: number) => string
}) {
  const href = `/builder?session_id=${encodeURIComponent(presentation.id)}`
  const unavailableNote = `deck-actions-${presentation.id}`
  return <Card data-studio-deck-card="true" className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onOpen(presentation.id)}>
    <Link href={href} onClick={event => event.stopPropagation()} aria-label={`Open ${presentation.title} in Studio`} data-studio-deck-preview="true" className="block aspect-video bg-slate-100 rounded-t-lg overflow-hidden"><PresentationPreview presentation={presentation} /></Link>
    <CardHeader data-studio-deck-card-header="true"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><CardTitle className="text-lg line-clamp-1"><Link href={href} onClick={event => event.stopPropagation()}>{presentation.title}</Link></CardTitle><CardDescription className="line-clamp-2 mt-1">{presentation.description}</CardDescription></div>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0 shrink-0" aria-label={`Manage ${presentation.title}`} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" data-studio-deck-menu="true" onClick={event => event.stopPropagation()}><DropdownMenuItem asChild><Link href={href}>Edit</Link></DropdownMenuItem><DropdownMenuItem disabled aria-describedby={unavailableNote}>Duplicate</DropdownMenuItem>{onDelete ? <DropdownMenuItem disabled={deleteDisabled} data-studio-deck-delete="true" className="text-red-600" onSelect={() => onDelete(presentation)}>Delete session…</DropdownMenuItem> : <DropdownMenuItem disabled className="text-red-600" aria-describedby={unavailableNote}>Delete</DropdownMenuItem>}<p id={unavailableNote} className="max-w-56 px-2 py-2 text-xs text-muted-foreground">{onDelete ? "Duplicate is not connected in this library." : "Duplicate and delete are not connected in this library."}</p></DropdownMenuContent></DropdownMenu>
    </div></CardHeader>
    <CardContent data-studio-deck-card-content="true"><div className="space-y-3"><div className="flex items-center justify-between"><div data-studio-deck-meta="true" className="flex items-center space-x-4 text-sm text-slate-500"><span>{presentation.slideCount} slides</span><span>Updated {new Date(presentation.updatedAt).toLocaleDateString()}</span></div><div className="flex gap-2"><Badge data-studio-deck-status={presentation.status} className={getStatusColor(presentation.status)}>{presentation.status}</Badge>{presentation.currentStage && <Badge variant="outline" className="text-xs">Stage {presentation.currentStage}: {getStageName(presentation.currentStage)}</Badge>}</div></div>{presentation.tags.length > 0 && <div className="flex flex-wrap gap-1">{presentation.tags.slice(0, 3).map(tag => <Badge key={tag} variant="outline" className="text-xs"><Tag className="h-3 w-3 mr-1" />{tag}</Badge>)}{presentation.tags.length > 3 && <Badge variant="outline" className="text-xs">+{presentation.tags.length - 3}</Badge>}</div>}</div></CardContent>
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
      setDeleteNotice(`“${target.presentation.title}” was removed from Decks and session history.${cacheCleared ? '' : ' Your browser could not clear every local reference.'}`)
    } catch {
      if (attempt === deletion.current && currentOwner.current === target.owner) setDeleteError("Deletion could not be confirmed. This session is still shown. Try again, or cancel and refresh the library.")
    } finally {
      if (attempt === deletion.current && currentOwner.current === target.owner) {
        deletionPending.current = false
        setIsDeletingSession(false)
      }
    }
  }

  // Keep folder structure for future use
  useEffect(() => {
    setFolders([
      { id: "all", name: "All Presentations", color: "slate", count: presentations.length },
      { id: "general", name: "General", color: "purple", count: presentations.length },
    ])
  }, [presentations])

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
            New Presentation
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
              <CardTitle className="text-sm font-medium">{studioShell ? 'Outline previews' : 'AI Collaborations'}</CardTitle>
              {studioShell ? <Folder className="h-4 w-4 text-muted-foreground" /> : <Users className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent data-studio-deck-card-content="true">
              <div className="text-2xl font-bold text-muted-foreground">{studioShell && hasLoadedSessions ? strawmanPresentations.length : '—'}</div>
              <p className="text-xs text-muted-foreground">{studioShell ? 'Loaded previews without a completed deck' : 'Coming soon'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Folders */}
        <div data-studio-deck-folders="true" className="mb-6">
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
        </div>

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
              Strawman Previews ({strawmanPresentations.length})
            </TabsTrigger>
          </TabsList>

          {(["completed", "strawman"] as const).map(tab => <TabsContent key={tab} value={tab} className="space-y-6">
            {!hasLoadedSessions && !sessionsError ? <div data-studio-deck-loading="true" role="status" className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading presentations…</div> : !hasLoadedSessions && sessionsError ? <div data-studio-deck-empty="true" className="text-center py-12"><h3 className="text-lg font-semibold mb-2">Your library is unavailable</h3><p className="text-slate-600">Retry the library above to load your presentations.</p></div> : <>
              <div data-studio-deck-grid="true" data-studio-deck-view={view} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredPresentations.map(presentation => <PresentationCard key={presentation.id} presentation={presentation} onOpen={id => router.push(`/builder?session_id=${encodeURIComponent(id)}`)} getStatusColor={getStatusColor} getStageName={getStageName} onDelete={studioShell && hasLoadedSessions ? requestDelete : undefined} deleteDisabled={isLoadingSessions || isLoadingMore || isDeletingSession} />)}</div>
              {filteredPresentations.length === 0 && hasLoadedSessions && <div data-studio-deck-empty="true" className="text-center py-12"><Sparkles className="h-12 w-12 text-slate-400 mx-auto mb-4" /><h3 className="text-lg font-semibold mb-2">{hasActiveCriteria ? "No matching presentations" : tab === "completed" ? "No completed presentations found" : "No strawman previews found"}</h3><p className="text-slate-600 mb-4">{hasActiveCriteria ? "Try a different search or clear the folder, tag, and status filters." : tab === "completed" ? "Complete a strawman preview to create your first presentation." : "Create a presentation to generate a strawman preview."}</p>{hasActiveCriteria ? <Button variant="outline" onClick={clearFilters}><X className="mr-2 h-4 w-4" />Clear search and filters</Button> : <Button data-studio-deck-primary="true" asChild><Link href="/builder"><Plus className="mr-2 h-4 w-4" />Create Presentation</Link></Button>}</div>}
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
          <div data-studio-deck-delete-summary="true"><strong>{deleteTarget?.presentation.title}</strong><span>{deleteTarget?.presentation.slideCount} slides · {deleteTarget?.presentation.status}</span></div>
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
