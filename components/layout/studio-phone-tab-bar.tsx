"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import { Brain, Cpu, FolderOpen, HelpCircle, Layers, LayoutTemplate, MoreHorizontal, Palette, UserRound } from "lucide-react"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { useAuth } from "@/hooks/use-auth"
import { lastBuilderSessionKey } from "@/lib/last-builder-session"
import { studioNavLabels } from "@/lib/studio-nav-labels"
import { STUDIO_PHONE_COMPOSER_SELECTOR, STUDIO_PHONE_MORE_LINKS, studioPhoneActiveTab } from "@/lib/studio-phone-shell"
import "./studio-phone-shell.css"

const MORE_ICONS = { knowledge: Brain, intelligence: Cpu, details: UserRound, help: HelpCircle } as const

/**
 * STUDIO PHONE SHELL (NEXT_PUBLIC_STUDIO_PHONE_SHELL, default off; drawn only with it on): the bottom tab bar PK chose for phones (decision A). The account layout and the Builder draw it next to the rail;
 * components/layout/studio-phone-shell.css shows it at 640 px and narrower only, where the rail steps aside (its brand tile stays, at the top left of the top bar). Navigation only: the routes, words and
 * the Studio entry's behaviour are the rail's. More is a modal sheet (Radix Dialog: focus moves in, Escape and a tap outside close it, focus goes back to More).
 */
export function StudioPhoneTabBar({ sessionUsage }: { sessionUsage?: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const [composerFocus, setComposerFocus] = useState(false)
  const navLabels = studioNavLabels(process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS === "true")
  const active = studioPhoneActiveTab(pathname)

  // A destination of the sheet (or of the account menu inside it) was opened: the sheet closes with the old page.
  useEffect(() => { setMoreOpen(false) }, [pathname])

  // The Director prompt has focus (the phone keyboard is up): the bar steps aside so the keyboard and the composer get the room; it comes back on blur.
  useEffect(() => {
    const isComposer = (node: EventTarget | null) => node instanceof Element && node.matches(STUDIO_PHONE_COMPOSER_SELECTOR)
    const onFocusIn = (event: FocusEvent) => setComposerFocus(isComposer(event.target))
    const onFocusOut = (event: FocusEvent) => { if (!isComposer(event.relatedTarget)) setComposerFocus(false) }
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)
    return () => {
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
    }
  }, [])

  // The rail's Studio entry on the account pages (BackToBuilderButton): the most recent Builder deck, else a fresh Builder. localStorage is read in the click, as there.
  const openStudio = () => {
    let target = "/builder"
    try {
      const userId = user?.id ?? user?.email
      const last = userId ? window.localStorage.getItem(lastBuilderSessionKey(userId)) : null
      if (last) target = `/builder?session_id=${last}`
    } catch {
      // localStorage can throw (Safari private mode): a fresh Builder
    }
    router.push(target)
  }

  const current = (tab: string) => (active === tab ? "page" as const : undefined)
  return (
    <nav data-studio-phone-tabbar="true" data-composer-focus={composerFocus ? "true" : undefined} aria-label="Studio destinations">
      {active === "studio"
        ? <button type="button" data-studio-phone-tab="studio" aria-current="page"><Layers aria-hidden="true" /><span>Studio</span></button>
        : <button type="button" data-studio-phone-tab="studio" onClick={openStudio}><Layers aria-hidden="true" /><span>Studio</span></button>}
      <Link href="/dashboard" data-studio-phone-tab="decks" aria-current={current("decks")}><FolderOpen aria-hidden="true" /><span>{navLabels.decks}</span></Link>
      <Link href="/studio/templates" data-studio-phone-tab="templates" aria-current={current("templates")}><LayoutTemplate aria-hidden="true" /><span>Templates</span></Link>
      <Link href="/studio/themes" data-studio-phone-tab="themes" aria-label="Themes & brand" aria-current={current("themes")}><Palette aria-hidden="true" /><span>Themes</span></Link>
      <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <Dialog.Trigger asChild>
          <button type="button" data-studio-phone-tab="more" aria-current={current("more")}><MoreHorizontal aria-hidden="true" /><span>More</span></button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay data-studio-phone-more-overlay="true" />
          <Dialog.Content data-studio-v4-shell="true" data-studio-phone-more="true" aria-describedby={undefined}>
            <Dialog.Title data-studio-phone-more-title="true">More</Dialog.Title>
            <ul aria-label="More destinations">
              {STUDIO_PHONE_MORE_LINKS.map(({ key, label, href }) => {
                const Icon = MORE_ICONS[key]
                return <li key={key}><Link href={href} data-studio-phone-more-link={key} aria-current={pathname === href ? "page" : undefined} onClick={() => setMoreOpen(false)}><Icon aria-hidden="true" /><span>{label ?? navLabels.knowledge}</span></Link></li>
              })}
              <li data-studio-phone-more-account="true"><UserProfileMenu sessionUsage={sessionUsage} studioLabels studioPalette={process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS === "true"} /><span aria-hidden="true">Account</span></li>
            </ul>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </nav>
  )
}
