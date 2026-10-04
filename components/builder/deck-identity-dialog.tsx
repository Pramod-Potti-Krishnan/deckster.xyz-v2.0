"use client"

import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import { BadgeCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDeckIdentityForm } from "@/hooks/use-deck-identity"
import { isDeckIdentityEnabled, type DeckIdentityForm } from "@/lib/deck-identity"
import { keepStudioScrollFocusVisible } from "@/lib/studio-inspector-focus"
import "./studio-deck-identity.css"

/** Director caps each identity field at 120 characters. */
const DECK_IDENTITY_MAX_LENGTH = 120

function revealStudioDeckIdentityField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return
  if (target.id === "deck-identity-logo" && target.getAttribute("aria-invalid") === "true") {
    const group = target.closest('[data-studio-deck-identity-logo-group="true"]')
    // The shared helper ignores groups too tall for its viewport clearance.
    if (group instanceof HTMLElement) keepStudioScrollFocusVisible(group, '[data-studio-deck-identity-fields="true"]')
  }
  // Preserve focused-input clearance when its complete group cannot fit.
  keepStudioScrollFocusVisible(target, '[data-studio-deck-identity-fields="true"]')
}

/**
 * "Presenter details" — the optional Builder form behind
 * NEXT_PUBLIC_DECK_IDENTITY_ENABLED (contract G3).
 *
 * Presenter is read-only: it comes from the signed-in profile, and the only way
 * to change it is /settings/profile. Company, confidentiality and logo URL are
 * stored per browser in localStorage; nothing here writes to the database.
 * Leaving a field blank means the deck carries no such line — the form never
 * seeds a placeholder.
 */
export function DeckIdentityDialog({ isDark = false }: { isDark?: boolean }) {
  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const openedContentRef = useRef<HTMLDivElement | null>(null)
  const enabled = isDeckIdentityEnabled()
  const [open, setOpen] = useState(false)
  const { form, presenter, save } = useDeckIdentityForm()
  const [draft, setDraft] = useState<DeckIdentityForm>({})

  // Reset the draft from storage each time the dialog opens.
  useEffect(() => {
    if (open) setDraft(form)
  }, [open, form])

  useLayoutEffect(() => {
    if (!studioShell || !enabled || !open) return
    const revealActive = () => {
      const active = document.activeElement
      const viewport = contentRef.current?.querySelector('[data-studio-deck-identity-fields="true"]')
      if (active && viewport?.contains(active)) revealStudioDeckIdentityField(active)
    }
    revealActive()
    // A warning can resize the fields viewport while its input already owns focus.
    const frame = requestAnimationFrame(revealActive)
    return () => cancelAnimationFrame(frame)
  }, [studioShell, enabled, open, draft.logoUrl])

  if (!enabled) return null

  const logoUrl = draft.logoUrl?.trim() ?? ""
  const logoLooksWrong = logoUrl.length > 0 && !/^https:\/\//i.test(logoUrl)

  const onSave = () => {
    save(draft)
    setOpen(false)
  }

  return (
    <>
      <Button
        ref={studioShell ? openerRef : undefined}
        data-studio-deck-identity-trigger={studioShell ? "true" : undefined}
        aria-haspopup={studioShell ? "dialog" : undefined}
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className={
          isDark
            ? "flex-shrink-0 text-slate-200 hover:bg-slate-800 hover:text-white"
            : "flex-shrink-0 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
        }
        aria-label="Presenter details"
        title="Presenter details"
      >
        <BadgeCheck className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent ref={studioShell ? contentRef : undefined} onOpenAutoFocus={studioShell ? () => {
          openedContentRef.current = contentRef.current
          // Keep Radix's native autofocus within this dialog.
        } : undefined} onCloseAutoFocus={studioShell ? (event) => {
          const opener = openerRef.current
          const closingContent = openedContentRef.current
          openedContentRef.current = null
          const active = document.activeElement
          const anotherDialog = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')).some(dialog => dialog !== closingContent)
          if (opener?.isConnected && opener.ownerDocument === document && !anotherDialog && (!active || active === document.body || closingContent?.contains(active))) {
            event.preventDefault()
            opener.focus({ preventScroll: true })
          }
        } : undefined} data-studio-deck-identity={studioShell ? "true" : undefined} className="sm:max-w-[420px]">
          <DialogHeader data-studio-deck-identity-header={studioShell ? "true" : undefined}>
            <DialogTitle>Presenter details</DialogTitle>
            <DialogDescription>
              Used on the title slide and the deck footer. Anything you leave blank
              is simply left off.
            </DialogDescription>
          </DialogHeader>

          <div onFocusCapture={studioShell ? event => revealStudioDeckIdentityField(event.target) : undefined} data-studio-deck-identity-fields={studioShell ? "true" : undefined} tabIndex={studioShell ? 0 : undefined} role={studioShell ? "region" : undefined} aria-label={studioShell ? "Optional presenter fields" : undefined} className="space-y-3 py-1">
            {studioShell && <p data-studio-deck-identity-note="true">Company, confidentiality and logo URL are kept in this browser. Presenter comes from your signed-in profile.</p>}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Presenter</Label>
              <p className="text-sm">
                {presenter || <span className="text-muted-foreground">Not set</span>}
                {" — "}
                <Link
                  href="/settings/profile"
                  className="underline underline-offset-2 hover:no-underline"
                >
                  edit in your profile
                </Link>
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="deck-identity-company" className="text-xs">
                Company
              </Label>
              <Input
                id="deck-identity-company"
                maxLength={DECK_IDENTITY_MAX_LENGTH}
                value={draft.company ?? ""}
                placeholder="Optional"
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, company: event.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="deck-identity-confidentiality" className="text-xs">
                Confidentiality
              </Label>
              <Input
                id="deck-identity-confidentiality"
                maxLength={DECK_IDENTITY_MAX_LENGTH}
                value={draft.confidentiality ?? ""}
                placeholder="Optional — e.g. Confidential"
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, confidentiality: event.target.value }))
                }
              />
            </div>

            <div data-studio-deck-identity-logo-group={studioShell ? "true" : undefined} className="space-y-1">
              <Label htmlFor="deck-identity-logo" className="text-xs">
                Logo URL
              </Label>
              <Input
                id="deck-identity-logo"
                aria-invalid={studioShell ? logoLooksWrong : undefined}
                aria-describedby={studioShell && logoLooksWrong ? "deck-identity-logo-warning" : undefined}
                maxLength={DECK_IDENTITY_MAX_LENGTH}
                value={draft.logoUrl ?? ""}
                placeholder="Optional — https://…"
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, logoUrl: event.target.value }))
                }
              />
              {logoLooksWrong && (
                <p data-studio-deck-identity-warning={studioShell ? "true" : undefined} id={studioShell ? "deck-identity-logo-warning" : undefined} role={studioShell ? "alert" : undefined} className="text-xs text-amber-600 dark:text-amber-400">
                  Must start with https:// — anything else is ignored.
                </p>
              )}
            </div>
          </div>

          <DialogFooter data-studio-deck-identity-footer={studioShell ? "true" : undefined}>
            <Button data-studio-deck-identity-action={studioShell ? "cancel" : undefined} variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button data-studio-deck-identity-action={studioShell ? "save" : undefined} onClick={onSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
