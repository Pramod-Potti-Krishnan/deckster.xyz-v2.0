"use client"

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import Link from "next/link"
import { AlertCircle, ArrowRight, ExternalLink, FileText, Loader2, Sparkles, X } from "lucide-react"
import { useStudioKgAsk } from "@/hooks/use-studio-kg-ask"
import {
  STUDIO_KG_ASK_COUNTER_FROM, STUDIO_KG_ASK_MAX_QUESTION, STUDIO_KG_ASK_WORDS as WORDS, studioKgAskCheck, studioKgAskLength, studioKgAskSummary,
  type StudioKgAskPassage, type StudioKgAskResult,
} from "@/lib/studio-kg-ask"
import "./studio-kg-ask.css"

// "Ask your second brain" (NEXT_PUBLIC_STUDIO_KG_ASK + the Studio shell): a question box on the Knowledge page. The Researcher's /kg/query returns the passages the person's graph holds
// on the question (not a written answer), so that is what is shown: each passage with where it came from (the source link, the deck it was learned in). Read only.
// States: idle (the hint), loading, passages, nothing found, error with Try again; every state but idle opens in a panel under the box, over the map, so the page never reflows. Enter submits (it is a form),
// Escape closes the panel; an empty or over-long question is refused before any request.

function Passage({ passage }: { passage: StudioKgAskPassage }) {
  const detail = [passage.meta, passage.entity ? `about ${passage.entity}` : ""].filter(Boolean).join(" · ")
  return (
    <li data-studio-kg-ask-passage="true">
      <span data-studio-kg-ask-number="true" aria-hidden="true">{passage.number}</span>
      <div>
        <blockquote>{passage.snippet}</blockquote>
        <p data-studio-kg-ask-source="true"><FileText className="h-3.5 w-3.5" /><strong>{passage.title}</strong>{detail && <small>{detail}</small>}</p>
        {passage.links.length > 0 && (
          <p data-studio-kg-ask-links="true">
            {passage.links.map(link => link.external
              ? <a key={link.kind} href={link.href} target="_blank" rel="noopener noreferrer" data-studio-kg-ask-link={link.kind}>{link.label}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a>
              : <Link key={link.kind} href={link.href} data-studio-kg-ask-link={link.kind}>{link.label}<ArrowRight className="h-3 w-3" aria-hidden="true" /></Link>)}
          </p>
        )}
      </div>
    </li>
  )
}

function Answer({ result }: { result: StudioKgAskResult }) {
  const side = result.entities.length > 0 || result.connections.length > 0
  return (
    <div data-studio-kg-ask-answer="true">
      <p data-studio-kg-ask-summary="true"><strong>{studioKgAskSummary(result)}</strong> <span>{WORDS.notAnswer}</span></p>
      <div data-studio-kg-ask-columns="true" data-two={side && result.passages.length > 0 ? "true" : undefined}>
        {result.passages.length > 0 && (
          <section aria-label={WORDS.passages}>
            <h3>{WORDS.passages}</h3>
            <ol data-studio-kg-ask-passages="true">{result.passages.map(passage => <Passage key={passage.key} passage={passage} />)}</ol>
          </section>
        )}
        {side && (
          <div data-studio-kg-ask-side="true">
            {result.entities.length > 0 && (
              <section aria-label={WORDS.entities}>
                <h3>{WORDS.entities}</h3>
                <ul data-studio-kg-ask-entities="true">{result.entities.map(entity => <li key={entity.id} data-best={entity.best ? "true" : undefined}>{entity.name}<small>{entity.typeLabel}</small></li>)}</ul>
              </section>
            )}
            {result.connections.length > 0 && (
              <section aria-label={WORDS.connections}>
                <h3>{WORDS.connections}</h3>
                <ul data-studio-kg-ask-connections="true">{result.connections.map(item => <li key={item.key}><strong>{item.from}</strong><span>{item.relation}</span><strong>{item.to}</strong></li>)}</ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function StudioKgAsk() {
  const { state, ask, reset } = useStudioKgAsk()
  const [text, setText] = useState("")
  const [guard, setGuard] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const headingId = useId()
  const inputId = useId()
  const noteId = useId()

  const loading = state.phase === "loading"
  const length = studioKgAskLength(text)
  const over = length > STUDIO_KG_ASK_MAX_QUESTION
  const note = over ? WORDS.guardTooLong : guard
  const showCount = length >= STUDIO_KG_ASK_COUNTER_FROM

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    const checked = studioKgAskCheck(text)
    if (!checked.ok) { setGuard(checked.message); return }
    setGuard(null)
    ask(checked.question)
  }
  // Escape closes the result panel (and cancels a question still being asked); the words in the field stay.
  const closeOnEscape = (event: KeyboardEvent<HTMLElement>) => { if (event.key === "Escape" && state.phase !== "idle") { event.stopPropagation(); reset() } }
  const clear = () => {
    reset()
    setText("")
    setGuard(null)
    inputRef.current?.focus()
  }

  return (
    <section data-studio-kg-ask="true" data-studio-kg-ask-state={state.phase} aria-labelledby={headingId} onKeyDown={closeOnEscape}>
      <div data-studio-kg-ask-row="true">
        <div data-studio-kg-ask-title="true"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /><h2 id={headingId}>{WORDS.title}</h2></div>
        <form onSubmit={submit} role="search" data-studio-kg-ask-form="true">
          <label htmlFor={inputId} className="sr-only">{WORDS.label}</label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={text}
            onChange={event => { setText(event.target.value); setGuard(null) }}
            placeholder={WORDS.placeholder}
            autoComplete="off"
            aria-invalid={note ? true : undefined}
            aria-describedby={note ? noteId : undefined}
          />
          {state.phase !== "idle" && !loading && <button type="button" data-studio-kg-ask-clear="true" onClick={clear} aria-label={WORDS.clear}><X className="h-3.5 w-3.5" /></button>}
          <button type="submit" disabled={loading} data-studio-kg-ask-submit="true">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            {loading ? WORDS.asking : WORDS.submit}
          </button>
        </form>
      </div>
      {(note || showCount) && (
        <p id={noteId} data-studio-kg-ask-note="true" data-over={over ? "true" : undefined} role={note ? "alert" : undefined}>
          {note}{note && showCount ? " " : ""}{showCount && <span>{length}/{STUDIO_KG_ASK_MAX_QUESTION}</span>}
        </p>
      )}
      <p data-studio-kg-ask-hint="true">{WORDS.hint}</p>
      <div data-studio-kg-ask-result="true" data-open={state.phase !== "idle" ? "true" : undefined} aria-live="polite">
        {loading && <p role="status" data-studio-kg-ask-loading="true"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{WORDS.loading}</p>}
        {state.phase === "ready" && state.result && <Answer result={state.result} />}
        {state.phase === "empty" && (
          <div data-studio-kg-ask-empty="true"><strong>{WORDS.emptyTitle}</strong><p>{WORDS.emptyBody}</p></div>
        )}
        {state.phase === "error" && (
          <div data-studio-kg-ask-error="true" role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <p>{state.error}</p>
            <button type="button" onClick={() => ask(state.asked)}>{WORDS.retry}</button>
          </div>
        )}
      </div>
    </section>
  )
}
