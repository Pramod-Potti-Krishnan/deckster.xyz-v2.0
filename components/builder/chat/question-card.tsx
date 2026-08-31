"use client"

/**
 * QuestionCard (MDC §6.2 — DIRECTOR_INTERFACE_REFINEMENT_PLAN.md).
 *
 * Renders an action_request as a structured card instead of a text wall.
 * Two modes:
 *  - PLAIN (P2, CHAT_CLARITY): prompt text + the existing actions as chips.
 *    Behavior-identical to the old buttons (same onActionClick), clearer frame.
 *  - STRUCTURED (P3, CHAT_QUESTIONS + payload.question_set): each question
 *    stacked with suggestion chips (recommended pre-highlighted) + optional
 *    free text, one "Send answers" composing a single human-readable reply
 *    (§12-Q1 locked: stacked card, one send). The plain actions still render
 *    below as the escape hatch; typing in the main input also always works.
 *
 * Old-Director sessions (no question_set) always get PLAIN mode.
 */

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { HelpCircle } from "lucide-react"
import type { QuestionSet } from "@/types/mdc"

interface ActionShape {
  label: string
  value: string
  primary: boolean
  requires_input: boolean
}

export interface QuestionCardProps {
  promptText: string
  actions: ActionShape[]
  messageId: string
  onActionClick: (action: ActionShape, messageId: string) => void
  questionSet?: QuestionSet | null
  structuredEnabled?: boolean
  /** Sends a composed free-form reply through the normal chat send path.
   *  displayText is the compact human echo (UAT 2026-08-30): the transcript
   *  shows "Answers: A · B · C" while the Director consumes the full prose. */
  onSubmitAnswers?: (text: string, displayText?: string) => void
}

export function QuestionCard({
  promptText,
  actions,
  messageId,
  onActionClick,
  questionSet,
  structuredEnabled = false,
  onSubmitAnswers,
}: QuestionCardProps) {
  const structured = Boolean(
    structuredEnabled && onSubmitAnswers && questionSet && questionSet.questions?.length,
  )
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [freeText, setFreeText] = useState<Record<string, string>>({})
  // UAT 2026-08-30: reveal questions one by one — a tall all-at-once card
  // auto-scrolled the chat past its own first question.
  const cardRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ block: "nearest" })
    })
    return () => cancelAnimationFrame(id)
  }, [])
  const answered = (qid: string) => Boolean(selected[qid] || (freeText[qid] || "").trim())
  const firstOpenIdx = questionSet
    ? questionSet.questions.findIndex((q) => !answered(q.id))
    : -1
  const visibleCount = questionSet
    ? firstOpenIdx === -1
      ? questionSet.questions.length
      : firstOpenIdx + 1
    : 0

  const answeredCount = useMemo(() => {
    if (!questionSet) return 0
    return questionSet.questions.filter(
      (q) => selected[q.id] || (freeText[q.id] || "").trim(),
    ).length
  }, [questionSet, selected, freeText])

  const submit = () => {
    if (!questionSet || !onSubmitAnswers) return
    const parts = questionSet.questions
      .map((q) => {
        const answer = (freeText[q.id] || "").trim() || selected[q.id]
        return answer ? `${q.text.replace(/\?+$/, "")}: ${answer}` : null
      })
      .filter(Boolean)
    if (parts.length === 0) return
    const answersOnly = questionSet.questions
      .map((q) => (freeText[q.id] || "").trim() || selected[q.id])
      .filter(Boolean)
    onSubmitAnswers(parts.join("\n"), `Answers: ${answersOnly.join(" · ")}`)
  }

  return (
    <div ref={cardRef} className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/40 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <HelpCircle className="h-3 w-3 text-purple-600 dark:text-purple-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">
          {structured ? "Quick questions" : "Your input"}
        </span>
      </div>
      <p className="text-xs text-gray-700 dark:text-slate-200 mb-2 whitespace-pre-wrap">
        {structured ? (questionSet?.intro || "A few quick questions:") : promptText}
      </p>

      {structured && questionSet && (
        <div className="space-y-3 mb-3">
          {questionSet.questions.slice(0, visibleCount).map((q) => (
            <div key={q.id}>
              <p className="text-xs font-medium text-gray-800 dark:text-slate-100 mb-1.5">{q.text}</p>
              <div className="flex flex-wrap gap-1.5">
                {q.suggestions.map((sug) => {
                  const isSelected = selected[q.id] === sug.label
                  return (
                    <button
                      key={sug.label}
                      type="button"
                      onClick={() =>
                        setSelected((prev) => ({
                          ...prev,
                          [q.id]: isSelected ? "" : sug.label,
                        }))
                      }
                      className={[
                        "text-xs h-auto min-h-7 py-1 px-2.5 rounded-full border transition-colors max-w-full whitespace-normal text-left",
                        isSelected
                          ? "bg-purple-600 text-white border-purple-600"
                          : sug.recommended
                            ? "border-purple-300 dark:border-purple-700 text-gray-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                            : "border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800",
                      ].join(" ")}
                    >
                      {sug.label}
                      {sug.recommended && !isSelected && (
                        <span className="ml-1 text-[9px] text-purple-500 dark:text-purple-400">★</span>
                      )}
                    </button>
                  )
                })}
              </div>
              {q.allow_free_text && (
                <input
                  type="text"
                  value={freeText[q.id] || ""}
                  onChange={(e) =>
                    setFreeText((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  placeholder="Or type your own…"
                  className="mt-1.5 w-full text-xs h-7 px-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 placeholder:text-gray-400"
                />
              )}
            </div>
          ))}
          <Button
            size="sm"
            onClick={submit}
            disabled={answeredCount === 0}
            className="text-xs h-7 max-w-full bg-gray-900 dark:bg-slate-600 hover:bg-gray-800 dark:hover:bg-slate-700"
          >
            {visibleCount < questionSet.questions.length
              ? `Send answers (${answeredCount}/${questionSet.questions.length} — more coming as you answer)`
              : `Send answers${answeredCount > 0 ? ` (${answeredCount}/${questionSet.questions.length})` : ""}`}
          </Button>
        </div>
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {actions.map((action, i) => (
            <Button
              key={i}
              size="sm"
              variant={action.primary ? "default" : "outline"}
              onClick={() => onActionClick(action, messageId)}
              className={
                action.primary
                  ? "text-xs h-auto min-h-7 py-1 max-w-full whitespace-normal text-left bg-gray-900 dark:bg-slate-600 hover:bg-gray-800 dark:hover:bg-slate-700"
                  : "text-xs h-auto min-h-7 py-1 max-w-full whitespace-normal text-left border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800"
              }
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
