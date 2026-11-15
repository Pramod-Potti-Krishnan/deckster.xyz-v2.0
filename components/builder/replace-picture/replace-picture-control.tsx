"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, ImagePlus, Loader2 } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StudioDisabledReason } from "@/components/studio-disabled-reason"
import {
  PICTURE_URL_PROBLEM_WORDS,
  REPLACE_PICTURE_ALT_MAX,
  REPLACE_PICTURE_TIMEOUT_MS,
  REPLACE_PICTURE_WORDS,
  checkPictureAlt,
  checkPictureUrl,
  type ReplacePictureOutcome,
} from "@/lib/studio-replace-picture"
import "./replace-picture.css"

export interface ReplacePictureControlProps {
  /** Why the action is off right now, in plain words; null when it can be used. */
  reason: string | null
  slideNumber: number
  slideTitle: string | null
  onReplace: (target: { slideNumber: number }, form: { url: string; alt: string }) => Promise<ReplacePictureOutcome>
  /** Reload deck, offered after the answers that say so (the picture stored but not drawn, no answer in time). */
  onReloadDeck?: () => void
  /** The toolbar's own button classes, so the button looks like its neighbours. */
  buttonClassName: string
  labelClassName: string
  tooltipContainer?: HTMLElement
}

type Phase = "form" | "running" | "done" | "failed"

/**
 * REPLACE-PICTURE (NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE): the "Replace picture" toolbar button and its dialog. The dialog takes an https picture link and an optional description, says what it is doing
 * while the viewer works (up to 20 seconds), and ends in plain words: done (with a note when a picture that covered the slide was hidden), or the reason it did not work (lib/studio-replace-picture.ts
 * maps every Layout code). It never shows a raw message. The slide it was opened for is fixed when it opens, so moving about the deck cannot send the picture to another slide.
 */
export function ReplacePictureControl({ reason, slideNumber, slideTitle, onReplace, onReloadDeck, buttonClassName, labelClassName, tooltipContainer }: ReplacePictureControlProps) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>("form")
  const [url, setUrl] = useState("")
  const [alt, setAlt] = useState("")
  const [problem, setProblem] = useState<string | null>(null)
  const [altProblem, setAltProblem] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<ReplacePictureOutcome | null>(null)
  const [target, setTarget] = useState({ slideNumber, slideTitle })
  const [seconds, setSeconds] = useState(0)
  const mounted = useRef(true)
  const blocked = typeof reason === "string" && reason !== ""

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (phase !== "running") return
    setSeconds(0)
    const timer = setInterval(() => setSeconds(value => value + 1), 1000)
    return () => clearInterval(timer)
  }, [phase])

  const openDialog = () => {
    setTarget({ slideNumber, slideTitle })
    setUrl("")
    setAlt("")
    setProblem(null)
    setAltProblem(null)
    setOutcome(null)
    setPhase("form")
    setOpen(true)
  }

  const submit = async () => {
    if (phase === "running") return
    const checkedUrl = checkPictureUrl(url)
    const checkedAlt = checkPictureAlt(alt)
    setProblem(checkedUrl.ok ? null : PICTURE_URL_PROBLEM_WORDS[checkedUrl.problem])
    setAltProblem(checkedAlt.ok ? null : REPLACE_PICTURE_WORDS.INVALID_ALT)
    if (!checkedUrl.ok || !checkedAlt.ok) return
    setPhase("running")
    const result = await onReplace({ slideNumber: target.slideNumber }, { url: checkedUrl.url, alt })
    if (!mounted.current) return
    setOutcome(result)
    setPhase(result.ok ? "done" : "failed")
  }

  const running = phase === "running"
  const title = target.slideTitle ? `: ${target.slideTitle}` : ""

  return (
    <>
      <StudioDisabledReason reason={reason} label="Replace picture" portalContainer={tooltipContainer}>
        <button
          type="button"
          disabled={blocked}
          data-studio-replace-picture="trigger"
          data-slide={slideNumber}
          data-state={blocked ? "off" : "on"}
          aria-haspopup="dialog"
          className={buttonClassName}
          title={blocked ? undefined : "Replace the picture on this slide"}
          onClick={openDialog}
        >
          <ImagePlus className="h-5 w-5" />
          <span className={labelClassName}>Replace picture</span>
        </button>
      </StudioDisabledReason>

      <Dialog open={open} onOpenChange={next => { if (!next && running) return; setOpen(next) }}>
        <DialogContent
          data-studio-replace-picture="dialog"
          data-phase={phase}
          onEscapeKeyDown={event => { if (running) event.preventDefault() }}
          onPointerDownOutside={event => { if (running) event.preventDefault() }}
          onInteractOutside={event => { if (running) event.preventDefault() }}
          aria-busy={running}
        >
          <DialogHeader data-studio-replace-picture="header">
            <DialogTitle>Replace picture</DialogTitle>
            <DialogDescription>
              Slide {target.slideNumber}{title}. The new picture goes into the slide&apos;s own picture area. A picture that covers the whole slide is hidden, never deleted.
            </DialogDescription>
          </DialogHeader>

          {(phase === "form" || phase === "running" || phase === "failed") && (
            <form
              data-studio-replace-picture="form"
              onSubmit={event => { event.preventDefault(); void submit() }}
              noValidate
            >
              <label htmlFor="replace-picture-url">Picture link</label>
              <input
                id="replace-picture-url"
                data-studio-replace-picture="url"
                type="text"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="https://example.com/picture.jpg"
                value={url}
                disabled={running}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? "replace-picture-url-problem" : "replace-picture-url-help"}
                onChange={event => { setUrl(event.target.value); if (problem) setProblem(null) }}
              />
              {problem
                ? <p id="replace-picture-url-problem" role="alert" data-studio-replace-picture="problem">{problem}</p>
                : <p id="replace-picture-url-help" data-studio-replace-picture="help">A public https:// link to a picture, such as a .jpg, .png or .webp.</p>}

              <label htmlFor="replace-picture-alt">Description (optional)</label>
              <input
                id="replace-picture-alt"
                data-studio-replace-picture="alt"
                type="text"
                autoComplete="off"
                maxLength={REPLACE_PICTURE_ALT_MAX + 100}
                placeholder="What the picture shows"
                value={alt}
                disabled={running}
                aria-invalid={altProblem ? true : undefined}
                aria-describedby={altProblem ? "replace-picture-alt-problem" : "replace-picture-alt-help"}
                onChange={event => { setAlt(event.target.value); if (altProblem) setAltProblem(null) }}
              />
              {altProblem
                ? <p id="replace-picture-alt-problem" role="alert" data-studio-replace-picture="problem">{altProblem}</p>
                : <p id="replace-picture-alt-help" data-studio-replace-picture="help">Read aloud by screen readers. Up to {REPLACE_PICTURE_ALT_MAX} characters.</p>}
              <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
            </form>
          )}

          {running && (
            <div data-studio-replace-picture="status" data-state="running" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <div>
                <p>Replacing the picture. {seconds} s</p>
                <p data-studio-replace-picture="help">This can take up to {REPLACE_PICTURE_TIMEOUT_MS / 1000} seconds. Keep this open until it finishes.</p>
                <div data-studio-replace-picture="bar" aria-hidden="true"><span /></div>
              </div>
            </div>
          )}

          {phase === "done" && outcome?.ok && (
            <div data-studio-replace-picture="status" data-state="done" role="status" aria-live="polite">
              <Check className="h-4 w-4" aria-hidden="true" />
              <div>
                <p data-studio-replace-picture="words">{outcome.words}</p>
                {outcome.note && <p data-studio-replace-picture="help">{outcome.note}</p>}
              </div>
            </div>
          )}

          {phase === "failed" && outcome && !outcome.ok && (
            <div data-studio-replace-picture="status" data-state="failed" data-code={outcome.code} data-stored={outcome.stored ? "true" : "false"} role="alert">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <p data-studio-replace-picture="words">{outcome.words}</p>
            </div>
          )}

          <DialogFooter data-studio-replace-picture="footer">
            {phase === "done" && (
              <button type="button" data-studio-replace-picture="action" data-action="done" onClick={() => setOpen(false)}>Done</button>
            )}
            {phase === "failed" && outcome && !outcome.ok && (
              <>
                <button type="button" data-studio-replace-picture="action" data-action="close" onClick={() => setOpen(false)}>Close</button>
                {outcome.reload && onReloadDeck && (
                  <button type="button" data-studio-replace-picture="action" data-action="reload" onClick={() => { setOpen(false); onReloadDeck() }}>Reload deck</button>
                )}
                {outcome.retry && (
                  <button type="button" data-studio-replace-picture="action" data-action="retry" data-primary="true" onClick={() => { setOutcome(null); setPhase("form") }}>Try again</button>
                )}
              </>
            )}
            {(phase === "form" || phase === "running") && (
              <>
                <button type="button" data-studio-replace-picture="action" data-action="cancel" disabled={running} onClick={() => setOpen(false)}>Cancel</button>
                <button type="button" data-studio-replace-picture="action" data-action="replace" data-primary="true" disabled={running} onClick={() => { void submit() }}>
                  {running ? "Replacing..." : "Replace picture"}
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
