"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useChatSessions } from "@/hooks/use-chat-sessions"

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { Plus, Search, Filter, MoreVertical, Sparkles, Calendar, Users, Crown, Folder, Tag, X, ChevronDown } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth()
  const { loadSessions } = useChatSessions()
  const [presentations, setPresentations] = useState<Presentation[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState<"completed" | "strawman">("completed")
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const router = useRouter()

  // Helper functions
  const getStatusFromStage = (stage: number): "draft" | "completed" | "in-progress" => {
    if (stage === 6) return "completed"
    if (stage >= 4) return "in-progress"
    return "draft"
  }

  const getFirstMessage = (session: any): string => {
    return session.messages?.[0]?.userText || session.title || 'No description available'
  }

  // Load sessions from API
  useEffect(() => {
    const fetchSessions = async () => {
      if (!user) {
        setIsLoadingSessions(false)
        return
      }

      try {
        setIsLoadingSessions(true)
        const result = await loadSessions({
          limit: 100,
          status: 'active'
        })

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
            thumbnail: session.finalPresentationUrl || session.strawmanPreviewUrl || '/placeholder.svg',
            folder: 'general',
            tags: [],
            strawmanPreviewUrl: session.strawmanPreviewUrl,
            finalPresentationUrl: session.finalPresentationUrl,
            currentStage: session.currentStage,
          }))

          setPresentations(transformedPresentations)
        }
      } catch (error) {
        console.error('Error loading sessions:', error)
      } finally {
        setIsLoadingSessions(false)
      }
    }

    fetchSessions()
  }, [user, loadSessions])

  // Keep folder structure for future use
  useEffect(() => {
    setFolders([
      { id: "all", name: "All Presentations", color: "slate", count: presentations.length },
      { id: "general", name: "General", color: "purple", count: presentations.length },
    ])
  }, [presentations])

  const handleSignOut = async () => {
    await logout()
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">deckster.xyz</span>
            </Link>
            <Badge variant="outline" className="ml-4">
              {user?.tier === "free" ? "Free Plan" : user?.tier === "pro" ? "Pro Plan" : "Enterprise"}
              {user?.tier === "pro" && <Crown className="ml-1 h-3 w-3" />}
            </Badge>
          </div>

          <div className="flex items-center space-x-4">
            <Button asChild>
              <Link href="/builder">
                <Plus className="mr-2 h-4 w-4" />
                New Presentation
              </Link>
            </Button>

            <UserProfileMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name || 'there'}!</h1>
          <p className="text-slate-600">Ready to create amazing presentations with your AI agent team?</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Presentations</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{presentations.length}</div>
              <p className="text-xs text-muted-foreground">
                {user?.tier === "free" ? `${Math.max(0, 3 - presentations.length)} remaining in free plan` : "Unlimited"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2</div>
              <p className="text-xs text-muted-foreground">+1 from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Collaborations</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">47</div>
              <p className="text-xs text-muted-foreground">Agent interactions this month</p>
            </CardContent>
          </Card>
        </div>

        {/* Folders */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Folder className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-semibold">Folders</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {folders.map((folder) => (
              <Button
                key={folder.id}
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
        <div className="space-y-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search presentations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
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
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            )}
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <Card className="p-4">
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
                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Tabs for Completed vs Strawman Presentations */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "completed" | "strawman")} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="completed">
              Completed Presentations ({completedPresentations.length})
            </TabsTrigger>
            <TabsTrigger value="strawman">
              Strawman Previews ({strawmanPresentations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="completed" className="space-y-6">
            {/* Presentations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPresentations.map((presentation) => (
                <Card
                  key={presentation.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/builder?session_id=${presentation.id}`)}
                >
                  <div className="aspect-video bg-slate-100 rounded-t-lg overflow-hidden">
                    {presentation.finalPresentationUrl || presentation.strawmanPreviewUrl ? (
                      <iframe
                        src={presentation.finalPresentationUrl || presentation.strawmanPreviewUrl || ''}
                        className="w-full h-full pointer-events-none"
                        title={presentation.title}
                      />
                    ) : (
                      <img
                        src={presentation.thumbnail || "/placeholder.svg"}
                        alt={presentation.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-1">{presentation.title}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-1">{presentation.description}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/builder/${presentation.id}`}>Edit</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>Duplicate</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-slate-500">
                      <span>{presentation.slideCount} slides</span>
                      <span>Updated {new Date(presentation.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getStatusColor(presentation.status)}>{presentation.status}</Badge>
                      {presentation.currentStage && (
                        <Badge variant="outline" className="text-xs">
                          Stage {presentation.currentStage}: {getStageName(presentation.currentStage)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {presentation.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {presentation.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                      {presentation.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{presentation.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

            {/* Empty State */}
            {filteredPresentations.length === 0 && (
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No completed presentations found</h3>
                <p className="text-slate-600 mb-4">
                  {searchQuery ? "Try adjusting your search terms" : "Complete a strawman preview to create your first presentation"}
                </p>
                <Button asChild>
                  <Link href="/builder">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Presentation
                  </Link>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="strawman" className="space-y-6">
            {/* Strawman Presentations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPresentations.map((presentation) => (
                <Card
                  key={presentation.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/builder?session_id=${presentation.id}`)}
                >
                  <div className="aspect-video bg-slate-100 rounded-t-lg overflow-hidden">
                    {presentation.finalPresentationUrl || presentation.strawmanPreviewUrl ? (
                      <iframe
                        src={presentation.finalPresentationUrl || presentation.strawmanPreviewUrl || ''}
                        className="w-full h-full pointer-events-none"
                        title={presentation.title}
                      />
                    ) : (
                      <img
                        src={presentation.thumbnail || "/placeholder.svg"}
                        alt={presentation.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-1">{presentation.title}</CardTitle>
                        <CardDescription className="line-clamp-2 mt-1">{presentation.description}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/builder/${presentation.id}`}>Edit</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>Duplicate</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-slate-500">
                          <span>{presentation.slideCount} slides</span>
                          <span>Updated {new Date(presentation.updatedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={getStatusColor(presentation.status)}>{presentation.status}</Badge>
                          {presentation.currentStage && (
                            <Badge variant="outline" className="text-xs">
                              Stage {presentation.currentStage}: {getStageName(presentation.currentStage)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {presentation.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {presentation.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                          {presentation.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{presentation.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Empty State */}
            {filteredPresentations.length === 0 && (
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No strawman previews found</h3>
                <p className="text-slate-600 mb-4">
                  {searchQuery ? "Try adjusting your search terms" : "Create a presentation to generate a strawman preview"}
                </p>
                <Button asChild>
                  <Link href="/builder">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Presentation
                  </Link>
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
