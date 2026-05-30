"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  Search,
  Keyboard
} from "lucide-react"

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

interface Shortcut {
  keys: string[]
  description: string
  category: string
}

export default function ShortcutsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  const shortcuts: Shortcut[] = [
    // Navigation
    { category: "Navigation", keys: ["Ctrl", "K"], description: "Open command palette" },
    { category: "Navigation", keys: ["Ctrl", "B"], description: "Toggle sidebar" },
    { category: "Navigation", keys: ["Ctrl", "Shift", "D"], description: "Go to dashboard" },
    { category: "Navigation", keys: ["Ctrl", "N"], description: "Create new presentation" },
    { category: "Navigation", keys: ["Esc"], description: "Close current dialog/modal" },
    
    // Builder
    { category: "Builder", keys: ["Ctrl", "Enter"], description: "Send message to AI agents" },
    { category: "Builder", keys: ["Ctrl", "Shift", "F"], description: "Focus on canvas" },
    { category: "Builder", keys: ["Ctrl", "Shift", "C"], description: "Focus on chat" },
    { category: "Builder", keys: ["Ctrl", "U"], description: "Upload attachment" },
    { category: "Builder", keys: ["Ctrl", "Z"], description: "Undo last action" },
    { category: "Builder", keys: ["Ctrl", "Y"], description: "Redo last action" },
    
    // Slides
    { category: "Slides", keys: ["←"], description: "Previous slide" },
    { category: "Slides", keys: ["→"], description: "Next slide" },
    { category: "Slides", keys: ["Ctrl", "D"], description: "Duplicate current slide" },
    { category: "Slides", keys: ["Delete"], description: "Delete selected element" },
    { category: "Slides", keys: ["Ctrl", "A"], description: "Select all elements" },
    { category: "Slides", keys: ["Ctrl", "C"], description: "Copy selected element" },
    { category: "Slides", keys: ["Ctrl", "V"], description: "Paste element" },
    
    // Editing
    { category: "Editing", keys: ["Enter"], description: "Edit selected text" },
    { category: "Editing", keys: ["Tab"], description: "Move to next element" },
    { category: "Editing", keys: ["Shift", "Tab"], description: "Move to previous element" },
    { category: "Editing", keys: ["Ctrl", "B"], description: "Bold text" },
    { category: "Editing", keys: ["Ctrl", "I"], description: "Italic text" },
    { category: "Editing", keys: ["Ctrl", "U"], description: "Underline text" },
    
    // View
    { category: "View", keys: ["F11"], description: "Toggle fullscreen" },
    { category: "View", keys: ["Ctrl", "+"], description: "Zoom in" },
    { category: "View", keys: ["Ctrl", "-"], description: "Zoom out" },
    { category: "View", keys: ["Ctrl", "0"], description: "Reset zoom" },
    { category: "View", keys: ["Ctrl", "H"], description: "Show/hide version history" },
    
    // General
    { category: "General", keys: ["Ctrl", "S"], description: "Save presentation" },
    { category: "General", keys: ["Ctrl", "P"], description: "Export/Print presentation" },
    { category: "General", keys: ["Ctrl", "Shift", "S"], description: "Share presentation" },
    { category: "General", keys: ["?"], description: "Show keyboard shortcuts" },
  ]

  const filteredShortcuts = shortcuts.filter(shortcut => {
    const matchesSearch = shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         shortcut.keys.join(" ").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || shortcut.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = ["all", ...Array.from(new Set(shortcuts.map(s => s.category)))]

  const getOSKey = (key: string) => {
    const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
    if (key === "Ctrl" && isMac) return "⌘"
    if (key === "Alt" && isMac) return "⌥"
    if (key === "Shift" && isMac) return "⇧"
    return key
  }

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
    <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Keyboard className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Keyboard Shortcuts</h1>
          <p className="text-slate-600">Master Deckster with these handy keyboard shortcuts</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Available Shortcuts</CardTitle>
            <CardDescription>Press ? anywhere in the app to view these shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search shortcuts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {categories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className="capitalize"
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            {/* Shortcuts List */}
            <div className="space-y-6">
              {selectedCategory === "all" ? (
                // Group by category when showing all
                categories.filter(cat => cat !== "all").map(category => {
                  const categoryShortcuts = filteredShortcuts.filter(s => s.category === category)
                  if (categoryShortcuts.length === 0) return null
                  
                  return (
                    <div key={category}>
                      <h3 className="font-medium text-sm text-muted-foreground mb-3">{category}</h3>
                      <div className="space-y-2">
                        {categoryShortcuts.map((shortcut, index) => (
                          <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
                            <span className="text-sm">{shortcut.description}</span>
                            <div className="flex gap-1">
                              {shortcut.keys.map((key, keyIndex) => (
                                <div key={keyIndex} className="flex items-center gap-1">
                                  <Badge variant="secondary" className="font-mono">
                                    {getOSKey(key)}
                                  </Badge>
                                  {keyIndex < shortcut.keys.length - 1 && (
                                    <span className="text-muted-foreground text-xs">+</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              ) : (
                // Show flat list for specific category
                <div className="space-y-2">
                  {filteredShortcuts.map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <div key={keyIndex} className="flex items-center gap-1">
                            <Badge variant="secondary" className="font-mono">
                              {getOSKey(key)}
                            </Badge>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-muted-foreground text-xs">+</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {filteredShortcuts.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No shortcuts found matching your search.</p>
              </div>
            )}

            {/* Tips */}
            <div className="mt-8 p-4 bg-purple-50 rounded-lg">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Command className="h-4 w-4" />
                Pro Tip
              </h3>
              <p className="text-sm text-muted-foreground">
                Many of these shortcuts work best when you're in the builder view. 
                Use <kbd className="px-1.5 py-0.5 text-xs bg-white rounded border">Ctrl + K</kbd> to 
                quickly access the command palette from anywhere in the app.
              </p>
            </div>
          </CardContent>
        </Card>
    </main>
  )
}