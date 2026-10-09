"use client"

import { useState, useMemo, useRef } from 'react'
import './studio-slide-layout-picker.css'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Plus,
  Type,
  Layout,
  Columns,
  Image,
  BarChart3,
  LayoutGrid,
  GitBranch,
  Sparkles,
  Milestone,
  CheckCircle,
  ArrowLeftRight,
  Square,
  PanelLeft,
  PanelRight,
  SidebarOpen,
  SidebarClose,
  Search,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BuildThemeSelection } from '@/lib/theme-builder'
import { ADD_SLIDE_V2_ENABLED, type AddSlideV2EntryConfig } from '@/lib/studio-add-slide-v2'
import { AddSlideV2Entry } from './studio-add-slide-v2'
import {
  SlideLayoutType,
  SlideLayoutCategory,
  SLIDE_LAYOUTS as SLIDE_LAYOUT_DEFINITIONS,
  SLIDE_LAYOUT_CATEGORIES,
} from '@/types/elements'

const STUDIO_SHELL = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

// Re-export the type for backward compatibility
export type { SlideLayoutType }

// Legacy type alias for backward compatibility
export type SlideLayoutId = SlideLayoutType

export interface SlideLayout {
  id: SlideLayoutType
  name: string
  description: string
  icon: React.ReactNode
  category: SlideLayoutCategory
}

// Icon mapping with size variants
const getLayoutIcon = (iconName: string | undefined, size: 'sm' | 'md' | 'lg' = 'md') => {
  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'

  const icons: Record<string, React.ReactNode> = {
    'Sparkles': <Sparkles className={sizeClass} />,
    'Layout': <Layout className={sizeClass} />,
    'Milestone': <Milestone className={sizeClass} />,
    'CheckCircle': <CheckCircle className={sizeClass} />,
    'Type': <Type className={sizeClass} />,
    'BarChart3': <BarChart3 className={sizeClass} />,
    'LayoutGrid': <LayoutGrid className={sizeClass} />,
    'GitBranch': <GitBranch className={sizeClass} />,
    'Image': <Image className={sizeClass} />,
    'Columns': <Columns className={sizeClass} />,
    'ArrowLeftRight': <ArrowLeftRight className={sizeClass} />,
    'Square': <Square className={sizeClass} />,
    'PanelLeft': <PanelLeft className={sizeClass} />,
    'PanelRight': <PanelRight className={sizeClass} />,
    'SidebarOpen': <SidebarOpen className={sizeClass} />,
    'SidebarClose': <SidebarClose className={sizeClass} />,
  }

  return iconName && icons[iconName] ? icons[iconName] : <Layout className={sizeClass} />
}

// Build slide layouts from type definitions
export const SLIDE_LAYOUTS: SlideLayout[] = SLIDE_LAYOUT_DEFINITIONS.map(def => ({
  id: def.layout,
  name: def.label,
  description: def.description,
  icon: getLayoutIcon(def.icon, 'md'),
  category: def.category,
}))

// Get layouts by category
const getLayoutsByCategory = (category: SlideLayoutCategory): typeof SLIDE_LAYOUT_DEFINITIONS => {
  return SLIDE_LAYOUT_DEFINITIONS.filter(l => l.category === category)
}

interface SlideLayoutPickerProps {
  onAddSlide: (layoutId: SlideLayoutType, options?: { position?: number }) => Promise<void>
  onGenerateSlide?: () => void
  /** J2 v2: with NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED, the generate-first pop-up replaces the layout picker. */
  addSlideV2?: AddSlideV2EntryConfig<BuildThemeSelection>
  disabled?: boolean
  className?: string
}

/**
 * SlideLayoutPicker Component
 *
 * Popover with grid layout for adding new slides.
 * Supports 19 layout types aligned with Layout Service v7.5.1.
 */
export function SlideLayoutPicker({
  onAddSlide,
  onGenerateSlide,
  addSlideV2,
  disabled = false,
  className = '',
}: SlideLayoutPickerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [open, setOpen] = useState(false)
  const [portalContainer, setPortalContainer] = useState<Element | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<SlideLayoutCategory | 'all'>('all')
  const searchInput = useRef<HTMLInputElement>(null)

  const handleSelectLayout = async (layoutId: SlideLayoutType) => {
    setIsAdding(true)
    setOpen(false)
    try {
      await onAddSlide(layoutId)
    } finally {
      setIsAdding(false)
    }
  }

  // Group layouts by category
  const layoutsByCategory = useMemo(() => ({
    hero: getLayoutsByCategory('hero'),
    content: getLayoutsByCategory('content'),
    visual: getLayoutsByCategory('visual'),
    image: getLayoutsByCategory('image'),
    other: getLayoutsByCategory('other'),
  }), [])

  if (ADD_SLIDE_V2_ENABLED && addSlideV2) {
    return <AddSlideV2Entry config={addSlideV2} disabled={disabled} isAdding={isAdding} className={className} onInsertBlank={async position => {
      setIsAdding(true)
      try {
        await (position === undefined ? onAddSlide('B1-blank') : onAddSlide('B1-blank', { position }))
      } finally {
        setIsAdding(false)
      }
    }} />
  }

  if (STUDIO_SHELL) {
    const matches = SLIDE_LAYOUT_DEFINITIONS.filter(layout => (category === 'all' || layout.category === category) && `${layout.label} ${layout.description}`.toLowerCase().includes(query.trim().toLowerCase()))
    const unavailable = disabled || isAdding
    return <Popover open={open} onOpenChange={nextOpen => {
      setPortalContainer(nextOpen ? document.fullscreenElement : null)
      setOpen(nextOpen)
    }}>
      <PopoverTrigger asChild><button disabled={disabled || isAdding} className={cn("flex h-12 min-w-[88px] flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 text-slate-700 dark:text-slate-200", "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors", className)}><Plus className="h-5 w-5" /><span className="text-[10px] font-medium whitespace-nowrap">{isAdding ? 'Adding' : 'Add Slide'}</span></button></PopoverTrigger>
      <PopoverContent portalContainer={portalContainer} data-studio-slide-layout-picker="true" align="start" sideOffset={8} aria-label="Choose a slide layout">
        <header className="slp-heading"><div><h2>Add a slide</h2><p>Choose a structure to insert after your current slide.</p></div><button type="button" className="slp-close" aria-label="Close slide layouts" onClick={() => setOpen(false)}><X size={14} /></button></header>
        {onGenerateSlide && <nav className="slp-methods" aria-label="New slide method"><button type="button" disabled={unavailable} onClick={() => { setOpen(false); onGenerateSlide() }}><Sparkles size={13} aria-hidden="true" />Generate</button><button type="button" aria-current="page" onClick={() => searchInput.current?.focus()}><LayoutGrid size={13} aria-hidden="true" />From a layout</button></nav>}
        <div className="slp-search"><Search size={15} aria-hidden="true" /><input ref={searchInput} aria-label="Find a slide layout" placeholder="e.g. comparison, image, text…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear slide layout search" onClick={() => { setQuery(''); searchInput.current?.focus() }}><X size={13} /></button>}</div>
        <div className="slp-categories" role="group" aria-label="Slide layout category"><button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>All layouts</button>{SLIDE_LAYOUT_CATEGORIES.map(item => <button type="button" key={item.category} aria-pressed={category === item.category} onClick={() => setCategory(item.category)}>{item.label}</button>)}</div>
        <p className="slp-count" role="status">{unavailable ? isAdding ? 'Adding your slide…' : 'Adding slides is currently unavailable.' : `${matches.length} of ${SLIDE_LAYOUT_DEFINITIONS.length} layouts${query.trim() || category !== 'all' ? ' match' : ' available'}`}</p>
        <div className="slp-catalog">{matches.length ? SLIDE_LAYOUT_CATEGORIES.map(item => {
          const layouts = matches.filter(layout => layout.category === item.category)
          return layouts.length ? <section className="slp-group" key={item.category} aria-label={item.label}><h3>{item.label}<span>{layouts.length}</span></h3><div className="slp-grid">{layouts.map(layout => <button type="button" className="slp-card" key={layout.layout} disabled={unavailable} aria-label={`Insert ${layout.label} slide`} title={layout.description} onClick={() => handleSelectLayout(layout.layout)}><span className="slp-symbol" aria-hidden="true">{getLayoutIcon(layout.icon, 'sm')}</span><span className="slp-copy"><strong>{layout.label}</strong><small>{layout.description}</small></span></button>)}</div></section> : null
        }) : <div className="slp-empty"><strong>No matching layouts</strong><p>Try another structure or description, or browse all layouts.</p><button type="button" onClick={() => { setQuery(''); setCategory('all'); searchInput.current?.focus() }}>Show all layouts</button></div>}</div>
        <p className="slp-footer">Choose a card to add its layout. Your current slide stays intact.</p>
      </PopoverContent>
    </Popover>
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled || isAdding}
          className={cn(
            "flex h-12 min-w-[88px] flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 text-slate-700 dark:text-slate-200",
            "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
            className
          )}
        >
          <Plus className="h-5 w-5" />
          <span className="text-[10px] font-medium whitespace-nowrap">{isAdding ? 'Adding' : 'Add Slide'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[340px] p-4"
        sideOffset={8}
      >
        <div className="space-y-4">
          {/* Hero Slides - 4 items in a row */}
          <div>
            <h4 className="text-xs font-medium text-amber-600 mb-2 px-1">Hero Slides</h4>
            <div className="grid grid-cols-4 gap-2">
              {layoutsByCategory.hero.map((layout) => (
                <button
                  key={layout.layout}
                  onClick={() => handleSelectLayout(layout.layout)}
                  disabled={isAdding}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2 rounded-lg",
                    "border border-gray-200 bg-white",
                    "hover:border-amber-400 hover:bg-amber-50",
                    "transition-all duration-150",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title={layout.description}
                >
                  <div className="w-full aspect-[16/10] rounded bg-gray-100 flex items-center justify-center border border-gray-200">
                    {getLayoutIcon(layout.icon, 'md')}
                  </div>
                  <span className="text-[10px] text-gray-600 text-center leading-tight line-clamp-2">
                    {layout.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Slides - 4 items in a row */}
          <div>
            <h4 className="text-xs font-medium text-blue-600 mb-2 px-1">Content Slides</h4>
            <div className="grid grid-cols-4 gap-2">
              {layoutsByCategory.content.map((layout) => (
                <button
                  key={layout.layout}
                  onClick={() => handleSelectLayout(layout.layout)}
                  disabled={isAdding}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2 rounded-lg",
                    "border border-gray-200 bg-white",
                    "hover:border-blue-400 hover:bg-blue-50",
                    "transition-all duration-150",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title={layout.description}
                >
                  <div className="w-full aspect-[16/10] rounded bg-gray-100 flex items-center justify-center border border-gray-200">
                    {getLayoutIcon(layout.icon, 'md')}
                  </div>
                  <span className="text-[10px] text-gray-600 text-center leading-tight line-clamp-2">
                    {layout.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Visual + Text Slides - 4 items in a row */}
          <div>
            <h4 className="text-xs font-medium text-green-600 mb-2 px-1">Visual + Text</h4>
            <div className="grid grid-cols-4 gap-2">
              {layoutsByCategory.visual.map((layout) => (
                <button
                  key={layout.layout}
                  onClick={() => handleSelectLayout(layout.layout)}
                  disabled={isAdding}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2 rounded-lg",
                    "border border-gray-200 bg-white",
                    "hover:border-green-400 hover:bg-green-50",
                    "transition-all duration-150",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title={layout.description}
                >
                  <div className="w-full aspect-[16/10] rounded bg-gray-100 flex items-center justify-center border border-gray-200">
                    {getLayoutIcon(layout.icon, 'md')}
                  </div>
                  <span className="text-[10px] text-gray-600 text-center leading-tight line-clamp-2">
                    {layout.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Image Split Slides - 4 items in a row */}
          <div>
            <h4 className="text-xs font-medium text-teal-600 mb-2 px-1">Image Split</h4>
            <div className="grid grid-cols-4 gap-2">
              {layoutsByCategory.image.map((layout) => (
                <button
                  key={layout.layout}
                  onClick={() => handleSelectLayout(layout.layout)}
                  disabled={isAdding}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2 rounded-lg",
                    "border border-gray-200 bg-white",
                    "hover:border-teal-400 hover:bg-teal-50",
                    "transition-all duration-150",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title={layout.description}
                >
                  <div className="w-full aspect-[16/10] rounded bg-gray-100 flex items-center justify-center border border-gray-200">
                    {getLayoutIcon(layout.icon, 'md')}
                  </div>
                  <span className="text-[10px] text-gray-600 text-center leading-tight line-clamp-2">
                    {layout.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Other Slides - 3 items (Two Visuals, Comparison, Blank) */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2 px-1">Other</h4>
            <div className="grid grid-cols-4 gap-2">
              {layoutsByCategory.other.map((layout) => (
                <button
                  key={layout.layout}
                  onClick={() => handleSelectLayout(layout.layout)}
                  disabled={isAdding}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2 rounded-lg",
                    "border border-gray-200 bg-white",
                    "hover:border-gray-400 hover:bg-gray-50",
                    "transition-all duration-150",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title={layout.description}
                >
                  <div className="w-full aspect-[16/10] rounded bg-gray-100 flex items-center justify-center border border-gray-200">
                    {getLayoutIcon(layout.icon, 'md')}
                  </div>
                  <span className="text-[10px] text-gray-600 text-center leading-tight line-clamp-2">
                    {layout.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Legacy mapping for backward compatibility (old L01, L02 etc. to new layout IDs)
export const LEGACY_LAYOUT_MAP: Record<string, SlideLayoutType> = {
  'L01': 'H1-structured',  // Title Slide
  'L02': 'H2-section',     // Section Header
  'L03': 'C1-text',        // Content
  'L25': 'V1-image-text',  // Two Column -> Visual + Text
  'L27': 'I1-image-left',  // Image Focus -> Image Split Left
  'L29': 'H1-generated',   // Hero
}

// Helper to convert legacy layout ID to new format
export function convertLegacyLayoutId(legacyId: string): SlideLayoutType {
  return LEGACY_LAYOUT_MAP[legacyId] || 'C1-text'
}
