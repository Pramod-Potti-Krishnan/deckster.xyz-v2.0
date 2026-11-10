/**
 * MDC feature flags (DIRECTOR_INTERFACE_REFINEMENT_PLAN.md §7.1).
 * All default OFF — flag-off must render pixel-identical to today.
 */

const on = (v: string | undefined) => v === 'true' || v === '1'

/** §6.1 rendering pass: question-card treatment of action_requests, receipts. */
export const CHAT_CLARITY = on(process.env.NEXT_PUBLIC_CHAT_CLARITY)

/** K2 binding: structured question_set rendering with suggestion chips. */
export const CHAT_QUESTIONS = on(process.env.NEXT_PUBLIC_CHAT_QUESTIONS)

/** K1: @slide mention input + references on user_message. */
export const CHAT_MENTIONS = on(process.env.NEXT_PUBLIC_CHAT_MENTIONS)

/** K3/K4/K5 handling + client_caps advertisement (K6). */
export const CHAT_DIRECTIVES = on(process.env.NEXT_PUBLIC_CHAT_DIRECTIVES)
