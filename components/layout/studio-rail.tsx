"use client"

import type { ReactElement, ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Brain, Cpu, FolderOpen, Layers, LayoutTemplate, Palette, UserRound } from "lucide-react"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { StudioNavigationHint } from "@/components/layout/studio-navigation-hint"
import "./studio-shell.css"

/** Navigation only. Session and workspace ownership remain with the existing pages. */
export function StudioRail({ studioEntry, homeHref = "/", sessionUsage }: { studioEntry?: ReactElement; homeHref?: string; sessionUsage?: ReactNode }) {
  const pathname = usePathname()
  const inStudio = pathname === "/builder" || pathname.startsWith("/builder/")
  return (
    <aside data-studio-v4-rail="true" aria-label="Workspace navigation">
      <StudioNavigationHint enabled label="Deckster home">
        <Link href={homeHref} className="studio-rail-brand" aria-label="Deckster home"><Layers className="h-5 w-5" /></Link>
      </StudioNavigationHint>
      <nav aria-label="Studio destinations">
        {studioEntry || <StudioNavigationHint enabled label="Studio">{inStudio ? <button type="button" aria-label="Studio" aria-current="page"><Layers className="h-5 w-5" /></button> : <Link href="/builder" aria-label="Studio"><Layers className="h-5 w-5" /></Link>}</StudioNavigationHint>}
        <StudioNavigationHint enabled label="Decks"><Link href="/dashboard" aria-label="Decks" aria-current={pathname==='/dashboard' ? 'page' : undefined}><FolderOpen className="h-5 w-5" /></Link></StudioNavigationHint>
        {[{label:'Templates',href:'/studio/templates',Icon:LayoutTemplate},{label:'Themes & brand',href:'/studio/themes',Icon:Palette}].map(({label,href,Icon}) => <StudioNavigationHint key={label} enabled label={label}><Link href={href} aria-label={label} aria-current={pathname===href ? 'page' : undefined}><Icon className="h-5 w-5" /></Link></StudioNavigationHint>)}
        <StudioNavigationHint enabled label="Knowledge"><Link href="/knowledge" aria-label="Knowledge" aria-current={pathname==='/knowledge' ? 'page' : undefined}><Brain className="h-5 w-5" /></Link></StudioNavigationHint>
        <StudioNavigationHint enabled label="Intelligence"><Link href="/studio/intelligence" aria-label="Intelligence" aria-current={pathname==='/studio/intelligence' ? 'page' : undefined}><Cpu className="h-5 w-5" /></Link></StudioNavigationHint>
        <StudioNavigationHint enabled label="Your details"><Link href="/studio/details" aria-label="Your details" aria-current={pathname==='/studio/details' ? 'page' : undefined}><UserRound className="h-5 w-5" /></Link></StudioNavigationHint>
      </nav>
      <div className="studio-rail-profile"><UserProfileMenu sessionUsage={sessionUsage} studioLabels studioPalette={process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS === 'true'} /></div>
    </aside>
  )
}
