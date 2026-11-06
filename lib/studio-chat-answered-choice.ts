// PASS2-DIRECTOR-CHAT PR D, item 8 (flag NEXT_PUBLIC_STUDIO_CHAT_ANSWERED_CHOICE): which option of an answered ask the user chose, so the
// answered card can show it, as the accepted v4 mockup's answered ask does (a check on the picked option).
//
// Pure and import-free. It reads only what the transcript already holds: the list MessageList is rendering (each user turn's text) and
// the ask frame. It writes nothing, so answered/earlier status, the answered-action bookkeeping, the stored turns and everything
// sent are exactly what they were. The evidence is the user's own turn text:
//   - a button click is echoed as the action's label (page.tsx handleActionClick: text = action.label);
//   - the question card's "Send answers" is echoed as "Answers: A · B · C" (question-card.tsx submit: displayText).
// Both are what the page stores and what a reloaded session restores, so the mark survives a reload.
//
// Conservative by design. It marks an option only when the evidence is exact and unambiguous: the next user turn after the ask, with no
// other ask between them, equal (after trim) to exactly one action label, or an "Answers:" part equal to a suggestion label that no other
// question of the set also offers. Anything else (a typed reply, a repeated label, a free-text answer) marks nothing, and the card
// renders as it does today.

export interface AnsweredChoice {
  /** Index into the ask's `actions` of the chosen button, or null. */
  actionIndex: number | null
  /** `${questionId}\u0000${suggestion label}` for each chosen suggestion of the ask's question set. */
  suggestions: string[]
}

interface AskLike {
  payload?: {
    actions?: readonly { label?: string }[]
    question_set?: { questions?: readonly { id: string; suggestions?: readonly { label: string }[] }[] } | null
  }
}

interface TranscriptItemLike {
  messageType?: string
  type?: string
  text?: unknown
  actionRequest?: unknown
}

export const ANSWERS_PREFIX = 'Answers: '
export const ANSWERS_SEPARATOR = ' · '

export function suggestionKey(questionId: string, label: string): string {
  return `${questionId}\u0000${label}`
}

const isAsk = (item: TranscriptItemLike) =>
  item.messageType !== 'user' && (item.type === 'action_request' || (item.type === 'combined_strawman' && Boolean(item.actionRequest)))

/** The choice recorded by the next user turn after `items[index]`, or null. Pure. */
export function findAnsweredChoice(items: readonly TranscriptItemLike[], index: number, ask: AskLike): AnsweredChoice | null {
  for (let i = index + 1; i < items.length; i++) {
    const item = items[i]
    if (item.messageType === 'user') return choiceFromReply(typeof item.text === 'string' ? item.text.trim() : '', ask)
    // Another ask sits between this card and the reply: the reply is not evidence of THIS ask.
    if (isAsk(item)) return null
  }
  return null
}

export function choiceFromReply(reply: string, ask: AskLike): AnsweredChoice | null {
  if (!reply) return null
  let actionIndex: number | null = null
  const matches = (ask.payload?.actions ?? []).flatMap((action, i) => (typeof action?.label === 'string' && action.label.trim() === reply ? [i] : []))
  if (matches.length === 1) actionIndex = matches[0]

  const suggestions: string[] = []
  const questions = ask.payload?.question_set?.questions
  if (questions?.length && reply.startsWith(ANSWERS_PREFIX)) {
    const parts = reply.slice(ANSWERS_PREFIX.length).split(ANSWERS_SEPARATOR).map(part => part.trim()).filter(Boolean)
    for (const part of parts) {
      const hits = questions.flatMap(question => (question.suggestions ?? []).some(suggestion => suggestion.label.trim() === part) ? [question.id] : [])
      // A label offered by two questions cannot be placed: skip it rather than guess.
      if (hits.length === 1) suggestions.push(suggestionKey(hits[0], questions.find(q => q.id === hits[0])!.suggestions!.find(s => s.label.trim() === part)!.label))
    }
  }
  return actionIndex === null && suggestions.length === 0 ? null : { actionIndex, suggestions }
}
