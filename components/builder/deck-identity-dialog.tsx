"use client"

import React, { useEffect, useState } from "react"
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
  const enabled = isDeckIdentityEnabled()
  const [open, setOpen] = useState(false)
  const { form, presenter, save } = useDeckIdentityForm()
  const [draft, setDraft] = useState<DeckIdentityForm>({})

  // Reset the draft from storage each time the dialog opens.
  useEffect(() => {
    if (open) setDraft(form)
  }, [open, form])

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
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Presenter details</DialogTitle>
            <DialogDescription>
              Used on the title slide and the deck footer. Anything you leave blank
              is simply left off.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
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
                value={draft.confidentiality ?? ""}
                placeholder="Optional — e.g. Confidential"
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, confidentiality: event.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="deck-identity-logo" className="text-xs">
                Logo URL
              </Label>
              <Input
                id="deck-identity-logo"
                value={draft.logoUrl ?? ""}
                placeholder="Optional — https://…"
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, logoUrl: event.target.value }))
                }
              />
              {logoLooksWrong && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Must start with https:// — anything else is ignored.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
