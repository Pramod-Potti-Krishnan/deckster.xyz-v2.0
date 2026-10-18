"use client"

import type { ReactNode } from "react"
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, Command, CreditCard, HelpCircle, Info, LogOut, Monitor, Moon, SlidersHorizontal, Sun, UserRound } from "lucide-react"
import {
  STUDIO_APPEARANCE_OPTIONS,
  STUDIO_PROFILE_LAYOUT,
  STUDIO_PROFILE_WORDS,
  studioAppearanceChoice,
  studioAppearanceFromValue,
  type StudioAppearance,
  type StudioProfileRowId,
} from "@/lib/studio-profile-menu"
import "./user-profile-menu-p2.css"

// PASS2 PRO-02/04/05/06/07/08/10 (NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU, default off): the Studio account menu as the accepted v4 mockup has it.
// Rendered by components/user-profile-menu.tsx in place of its own menu body; the quota read, the session usage strip and the usage disclosure
// come from there, so this file holds no state and no network.

const ROW_ICONS: Record<StudioProfileRowId, typeof UserRound> = {
  details: UserRound,
  settings: SlidersHorizontal,
  shortcuts: Command,
  billing: CreditCard,
  help: HelpCircle,
}

const APPEARANCE_ICONS: Record<StudioAppearance, typeof Sun> = { light: Sun, dark: Moon, system: Monitor }

export interface StudioProfileMenuP2Props {
  name?: string | null
  email?: string | null
  image?: string | null
  initials: string
  /** The plan badge: only once the quota read has returned, as in the original menu. */
  tierLabel?: string
  sessionUsage?: ReactNode
  /** The original "Usage remaining" disclosure, already built; absent until the quota read returns. */
  usage?: ReactNode
  /** The stored next-themes value. */
  theme?: string
  onTheme: (next: StudioAppearance) => void
  onNavigate: (path: string) => void
  onAbout: () => void
  onLogout: () => void | Promise<void>
}

export function StudioProfileMenuP2({ name, email, image, initials, tierLabel, sessionUsage, usage, theme, onTheme, onNavigate, onAbout, onLogout }: StudioProfileMenuP2Props) {
  return (
    <DropdownMenuContent data-studio-v4-profile="true" data-studio-profile-fidelity="true" data-studio-p2-profile="true" side="right" sideOffset={8} align="end" className="w-64">
      <DropdownMenuLabel data-studio-profile-identity="true" data-studio-p2-identity="true" className="font-normal">
        <Avatar data-studio-p2-disc="true" className="h-9 w-9">
          <AvatarImage src={image || undefined} alt={name || "User avatar"} />
          <AvatarFallback data-studio-p2-disc-fallback="true">{initials}</AvatarFallback>
        </Avatar>
        <div data-studio-p2-identity-text="true">
          <p data-studio-profile-name="true" className="text-sm font-medium leading-none">{name}</p>
          <p data-studio-profile-email="true" className="text-xs leading-none text-muted-foreground">{email}</p>
        </div>
        {tierLabel && (
          <Badge
            data-studio-v4-profile-role="tier"
            variant="outline"
            className="h-4 border-purple-200 bg-purple-50 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
          >
            {tierLabel}
          </Badge>
        )}
      </DropdownMenuLabel>
      {sessionUsage && <div data-studio-session-usage="true" role="group" aria-label="Current session token usage">{sessionUsage}</div>}

      <DropdownMenuSeparator data-studio-v4-profile-role="separator" />

      {STUDIO_PROFILE_LAYOUT.map((entry, index) => {
        if (entry.kind === "separator") return <DropdownMenuSeparator key={`separator-${index}`} data-studio-v4-profile-role="separator" />
        if (entry.kind === "appearance") {
          return (
            <div key="appearance" data-studio-p2-appearance-block="true">
              <DropdownMenuLabel id="studio-p2-appearance-label" data-studio-p2-eyebrow="true">{STUDIO_PROFILE_WORDS.appearance}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                data-studio-p2-appearance="true"
                aria-labelledby="studio-p2-appearance-label"
                value={studioAppearanceChoice(theme)}
                onValueChange={(value: string) => {
                  const next = studioAppearanceFromValue(value)
                  if (next) onTheme(next)
                }}
              >
                {STUDIO_APPEARANCE_OPTIONS.map((option) => {
                  const Icon = APPEARANCE_ICONS[option.value]
                  return (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                      title={option.hint}
                      data-studio-v4-profile-role="item"
                      data-studio-p2-appearance-option={option.value}
                      onSelect={(event) => event.preventDefault()}
                    >
                      <Icon aria-hidden="true" />
                      <span>{option.label}</span>
                    </DropdownMenuRadioItem>
                  )
                })}
              </DropdownMenuRadioGroup>
            </div>
          )
        }
        const Icon = ROW_ICONS[entry.id]
        return (
          <DropdownMenuItem key={entry.id} data-studio-v4-profile-role="item" data-studio-p2-row={entry.id} onClick={() => onNavigate(entry.href)}>
            <Icon className="mr-2 h-4 w-4" />
            <span>{entry.label}</span>
            <ChevronRight data-studio-p2-chevron="true" />
          </DropdownMenuItem>
        )
      })}

      <DropdownMenuItem data-studio-v4-profile-role="item" data-studio-p2-row="about" onSelect={(event) => { event.preventDefault(); onAbout() }}>
        <Info className="mr-2 h-4 w-4" />
        <span>{STUDIO_PROFILE_WORDS.about}</span>
        <ChevronRight data-studio-p2-chevron="true" />
      </DropdownMenuItem>

      {usage && (
        <>
          <DropdownMenuSeparator data-studio-v4-profile-role="separator" />
          {usage}
        </>
      )}

      <DropdownMenuSeparator data-studio-v4-profile-role="separator" />

      <DropdownMenuItem data-studio-v4-profile-role="danger" onClick={onLogout} className="text-red-600 dark:text-red-400">
        <LogOut className="mr-2 h-4 w-4" />
        <span>{STUDIO_PROFILE_WORDS.signOut}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
