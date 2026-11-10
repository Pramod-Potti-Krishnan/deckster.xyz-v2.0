"use client"

// PASS2 ONBOARDING (NEXT_PUBLIC_STUDIO_P2_ONBOARDING, default off): the /onboarding wizard in the Studio shell's tokens, type and spacing, light and dark.
// app/onboarding/layout.tsx renders it instead of the old page; the old page (app/onboarding/page.tsx) is not touched. What it keeps: the five steps, the choices, a choice needed per question,
// "Skip", "Back", and the two destinations. What it fixes is listed in lib/studio-onboarding.ts. Every answer stays in this component's state; nothing is sent or stored.

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, BarChart3, Check, FileText, GraduationCap, Layout, ListChecks, MessageSquare, Palette, Rocket, Sparkles, TrendingUp } from "lucide-react"
import {
  STUDIO_ONBOARDING_EMPTY, STUDIO_ONBOARDING_PRICING_HREF, STUDIO_ONBOARDING_SKIP_HREF, STUDIO_ONBOARDING_STEPS, STUDIO_ONBOARDING_WELCOME_CARDS, STUDIO_ONBOARDING_WORDS,
  studioOnboardingCanContinue, studioOnboardingChoices, studioOnboardingDestination, studioOnboardingPrompts, studioOnboardingRecap, studioOnboardingStatus,
  type StudioOnboardingAnswers, type StudioOnboardingKey,
} from "@/lib/studio-onboarding"
import "./studio-p2-onboarding.css"

// Icons belong to a question, not to an id: "sales" is both a use case and a role, and only the use case has one.
const CHOICE_ICONS: Partial<Record<StudioOnboardingKey, Record<string, typeof Sparkles>>> = {
  useCase: { sales: TrendingUp, marketing: Palette, education: GraduationCap, business: BarChart3, creative: Sparkles, startup: Rocket },
  start: { scratch: FileText, template: Layout },
}
const WELCOME_ICONS: Record<string, typeof Sparkles> = { director: MessageSquare, canvas: Layout, inspector: ListChecks }
const TWO_COLUMN: readonly StudioOnboardingKey[] = ["useCase", "team", "start"]
// "Founder/Entrepreneur" is one unbreakable word to the browser and spills out of a four-column card: offer a line break after the slash.
const softSlash = (label: string) => label.split("/").flatMap((part, index, parts) => index < parts.length - 1 ? [`${part}/`, <wbr key={index} />] : [part])

export function StudioP2Onboarding() {
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<StudioOnboardingAnswers>(STUDIO_ONBOARDING_EMPTY)
  const [done, setDone] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const shown = useRef({ stepIndex: 0, done: false })
  const baseId = useId()
  const step = STUDIO_ONBOARDING_STEPS[stepIndex]
  const key: StudioOnboardingKey | null = step.id === "welcome" ? null : step.id
  const last = stepIndex === STUDIO_ONBOARDING_STEPS.length - 1
  const canContinue = studioOnboardingCanContinue(stepIndex, answers)
  const destination = studioOnboardingDestination(answers.start)

  // A step change (not the first paint, and not a development double run) leaves the keyboard and screen-reader position at the new heading.
  useEffect(() => {
    if (shown.current.stepIndex === stepIndex && shown.current.done === done) return
    shown.current = { stepIndex, done }
    titleRef.current?.focus()
  }, [stepIndex, done])

  const choose = (question: StudioOnboardingKey, id: string) => setAnswers(previous => ({ ...previous, [question]: id }))
  const next = () => { if (!canContinue) return; if (last) setDone(true); else setStepIndex(stepIndex + 1) }
  const back = () => { if (done) setDone(false); else setStepIndex(stepIndex - 1) }

  const title = done ? STUDIO_ONBOARDING_WORDS.doneTitle : step.title
  const description = done ? destination.text : step.description

  return (
    <main data-studio-p2-onboarding="true">
      <section className="so-card" aria-labelledby={`${baseId}-title`}>
        <header className="so-header">
          <span className="so-eyebrow">{done ? STUDIO_ONBOARDING_WORDS.eyebrowDone : `${STUDIO_ONBOARDING_WORDS.eyebrow} · Step ${stepIndex + 1} of ${STUDIO_ONBOARDING_STEPS.length}`}</span>
          <h1 id={`${baseId}-title`} ref={titleRef} tabIndex={-1}>{title}</h1>
          <p>{description}</p>
        </header>
        <div className="so-body">
          {!done && <ol className="so-chapters" aria-label={STUDIO_ONBOARDING_WORDS.chapters}>
            {STUDIO_ONBOARDING_STEPS.map((chapter, index) => <li key={chapter.id} aria-current={index === stepIndex ? "step" : undefined} data-done={index < stepIndex ? "true" : undefined}><b>{index + 1}</b>{chapter.chapter}</li>)}
          </ol>}
          {done ? <>
            <dl className="so-recap">{studioOnboardingRecap(answers).map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
            <p className="so-note">{STUDIO_ONBOARDING_WORDS.doneNote}</p>
          </> : key === null ? <>
            <div className="so-cards">
              {STUDIO_ONBOARDING_WELCOME_CARDS.map(card => { const Icon = WELCOME_ICONS[card.id]; return <article key={card.id}><Icon aria-hidden="true" /><h2>{card.title}</h2><p>{card.text}</p></article> })}
            </div>
            <p className="so-note">{studioOnboardingStatus(stepIndex, answers)}</p>
          </> : <>
            <fieldset className="so-choices" data-columns={TWO_COLUMN.includes(key) ? "2" : "4"}>
              <legend className="so-sr">{step.title}</legend>
              {studioOnboardingChoices(key).map(choice => {
                const Icon = CHOICE_ICONS[key]?.[choice.id]
                return (
                  <label key={choice.id} className="so-choice">
                    <input type="radio" name={`${baseId}-${key}`} value={choice.id} checked={answers[key] === choice.id} onChange={() => choose(key, choice.id)} />
                    <span className="so-face">
                      {Icon && <span className="so-icon"><Icon aria-hidden="true" /></span>}
                      <span className="so-text"><b>{softSlash(choice.label)}</b>{choice.description && <small>{choice.description}</small>}</span>
                      <Check className="so-check" aria-hidden="true" />
                    </span>
                  </label>
                )
              })}
            </fieldset>
            {key === "start" && answers.start === "scratch" && <div className="so-prompts">
              <h2>{STUDIO_ONBOARDING_WORDS.promptsTitle}</h2>
              <ul>{studioOnboardingPrompts(answers.useCase).map(prompt => <li key={prompt}>{prompt}</li>)}</ul>
            </div>}
            {key === "team" && answers.team === "large" && <p className="so-callout" role="status">{STUDIO_ONBOARDING_WORDS.teamLarge} <Link href={STUDIO_ONBOARDING_PRICING_HREF}>{STUDIO_ONBOARDING_WORDS.teamLargeLink}</Link></p>}
            <p className="so-note" role="status">{studioOnboardingStatus(stepIndex, answers)}</p>
          </>}
        </div>
        <footer className="so-footer">
          <Link href={STUDIO_ONBOARDING_SKIP_HREF} className="so-skip">{STUDIO_ONBOARDING_WORDS.skip}</Link>
          <div>
            {stepIndex > 0 && <button type="button" className="so-back" onClick={back}>{STUDIO_ONBOARDING_WORDS.back}</button>}
            {done
              ? <Link href={destination.href} className="so-next">{destination.label}<ArrowRight aria-hidden="true" /></Link>
              : <button type="button" className="so-next" disabled={!canContinue} onClick={next}>{last ? STUDIO_ONBOARDING_WORDS.finish : STUDIO_ONBOARDING_WORDS.next}<ArrowRight aria-hidden="true" /></button>}
          </div>
        </footer>
      </section>
    </main>
  )
}
