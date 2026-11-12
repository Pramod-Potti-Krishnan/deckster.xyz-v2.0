"use client"

// FRONTEND-2 (W2 P4-7/8; flag NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH): on a phone, Change opens the same "Use with this deck" rows as a bottom sheet (Radix Dialog, like the phone shell's More sheet: focus moves in, Escape and a tap
// outside close it). Rendered by the badge component, so the page gains no line for it; the dialog portals to the body.
import Link from "next/link"
import * as Dialog from "@radix-ui/react-dialog"
import { ChevronRight } from "lucide-react"
import { TEMPLATE_MATCH_WORDS, pickerAvailable } from "@/lib/studio-template-match"
import { setTemplateSheetOpen, useStudioTemplateMatch } from "@/hooks/use-studio-template-match"
import { StudioTemplateMatchChoices } from "./studio-template-match-group"
import "./studio-template-match.css"

// "Start a new presentation from a template" goes where the picker's "Template library" link goes: the Templates page, only where that page works.
const TEMPLATES_PAGE_ENABLED = process.env.NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED === "true"

export function StudioTemplateMatchSheet() {
  const match = useStudioTemplateMatch()
  const open = match.sheetOpen && pickerAvailable(match.frame)
  return (
    <Dialog.Root open={open} onOpenChange={setTemplateSheetOpen}>
      <Dialog.Portal>
        <Dialog.Overlay data-studio-template-match="overlay" />
        <Dialog.Content data-studio-v4-shell="true" data-studio-template-match="sheet" aria-describedby={undefined}>
          <div data-studio-template-match="handle" aria-hidden="true" />
          <section data-studio-template-match="group">
            <Dialog.Title data-studio-template-match="group-title" asChild><h3>{TEMPLATE_MATCH_WORDS.groupTitle}</h3></Dialog.Title>
            <p data-studio-template-match="group-help">{TEMPLATE_MATCH_WORDS.sheetHelp}</p>
            <StudioTemplateMatchChoices sheet onDone={() => setTemplateSheetOpen(false)} />
          </section>
          {TEMPLATES_PAGE_ENABLED && (
            <Link href="/studio/templates" prefetch={false} data-studio-template-match="alt" onClick={() => setTemplateSheetOpen(false)}>
              <span>{TEMPLATE_MATCH_WORDS.startFromTemplateInSheet}</span><ChevronRight size={14} aria-hidden="true" />
            </Link>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
