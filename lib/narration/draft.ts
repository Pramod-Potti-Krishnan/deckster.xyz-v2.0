/**
 * Drafting what a slide says out loud.
 *
 * The governing constraint is the same one that governs published Q&A: **this
 * is the publisher speaking.** A narration script goes out in their name, over
 * their slides, to their audience. So the model is not writing an essay about
 * the topic — it is putting the slide's own content into spoken form, and it
 * may not introduce anything the slide does not already say.
 *
 * Two variants come back from ONE call rather than two. The compressed script
 * has to be a compression *of that full script* — same claims, same figures,
 * fewer words. Drafting them independently would produce two scripts that
 * disagree, and the session switches between them mid-deck.
 */

import { COMPRESSED_RATIO } from './budget'

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'

/** Cheap and fast: this runs once per slide across a whole deck, and the task
 *  is rephrasing supplied content rather than reasoning about it. */
const DRAFT_MODEL = process.env.NARRATION_DRAFT_MODEL ?? 'google/gemini-3-flash-preview'

export interface SlideSource {
  index: number
  title?: string | null
  /** Visible slide text — what the audience is reading while this is spoken. */
  bodyText: string
  /** The presenter's own notes, if any. Strongest signal for what to SAY, since
   *  a human wrote them for exactly this purpose. */
  speakerNotes?: string | null
  /** Researcher's delivery notes, threaded through from the re-thread. */
  pacingHints?: string[] | null
}

export interface DraftedScript {
  full: string
  compressed: string
}

export class DraftError extends Error {}

const SYSTEM_PROMPT = `You write what a presenter SAYS OUT LOUD while a slide is on screen.

The words go out in the presenter's name, over their slides, to their audience.

HARD RULES — not style preferences:
- Say only what the slide and its notes already contain. Introduce no fact,
  figure, company, product, person or date that is not in the supplied material.
- Never invent a number, and never convert or recompute one. State figures
  exactly as they appear.
- Do not read the slide aloud word for word. The audience can read. Say the
  thing the slide is FOR — what it means, why it is here, what to take from it.
- No stage directions, no "as you can see on this slide", no meta-commentary
  about the presentation itself.
- Plain spoken prose. No markdown, no bullet points, no headings — every
  character is going to be spoken by a voice.

You return TWO variants of the same script:
- "full": the version for when there is time.
- "compressed": the SAME substance in about half the words — for when questions
  have run long and the deck still has to finish. Keep every figure and the
  central claim; drop elaboration, examples and transitions. It must never
  contradict the full version.

Return ONLY JSON: {"full": str, "compressed": str}`

function buildUserPrompt(slide: SlideSource, words: number, compressedWords: number): string {
  const parts = [
    `SLIDE ${slide.index + 1}${slide.title ? `: ${slide.title}` : ''}`,
    '',
    'What is on the slide:',
    slide.bodyText.trim() || '(no body text — speak to the title)',
  ]
  if (slide.speakerNotes?.trim()) {
    parts.push('', "The presenter's own notes for this slide:", slide.speakerNotes.trim())
  }
  if (slide.pacingHints?.length) {
    parts.push('', 'Delivery notes:', slide.pacingHints.join('; '))
  }
  parts.push(
    '',
    `LENGTH: "full" is at most ${words} words. "compressed" is at most ${compressedWords} words.`,
    'These are ceilings, not targets — a slide with little to say should be short.'
  )
  return parts.join('\n')
}

function parseJson(raw: string): { full?: unknown; compressed?: unknown } | null {
  const text = raw.trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/)
  const candidate = fenced ? fenced[1].trim() : text
  try {
    return JSON.parse(candidate)
  } catch {
    const braced = candidate.match(/\{[\s\S]*\}/)
    if (!braced) return null
    try {
      return JSON.parse(braced[0])
    } catch {
      return null
    }
  }
}

/**
 * Every number the script speaks must already exist in the material it was
 * drafted from.
 *
 * The one failure that would genuinely embarrass a publisher is their deck
 * confidently speaking a figure nobody wrote. Deliberately crude: compare the
 * digit-runs, ignoring separators and formatting, so "$2.4B" in the source
 * covers "2.4" in the script and "1,200" covers "1200". It can pass something
 * it should have caught; it will not fail something legitimate, and a guard
 * that cried wolf would be switched off.
 */
export function numbersAreGrounded(script: string, source: string): { ok: boolean; missing: string[] } {
  const digits = (text: string) => (text.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, ''))
  const sourceNumbers = new Set(digits(source).map((n) => n.replace(/,/g, '')))
  const missing = digits(script)
    .map((n) => n.replace(/,/g, ''))
    .filter((n) => {
      if (sourceNumbers.has(n)) return false
      // A bare small integer is almost always prose ("three things", "step 2"),
      // not a claim. Only figures are worth failing over.
      if (/^\d{1,2}$/.test(n)) return false
      return true
    })
  return { ok: missing.length === 0, missing: [...new Set(missing)] }
}

export async function draftSlideScript(
  slide: SlideSource,
  words: number,
  compressedWords: number
): Promise<DraftedScript> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new DraftError('OPENROUTER_API_KEY is not configured')

  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: DRAFT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(slide, words, compressedWords) },
      ],
      // Low but not zero: narration that is identical in cadence on every slide
      // is its own kind of wrong.
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new DraftError(`Draft failed (${response.status}): ${detail.slice(0, 160)}`)
  }

  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  const parsed = parseJson(body?.choices?.[0]?.message?.content ?? '')
  const full = typeof parsed?.full === 'string' ? parsed.full.trim() : ''
  const compressed = typeof parsed?.compressed === 'string' ? parsed.compressed.trim() : ''
  if (!full) throw new DraftError('The model returned no script')

  const source = [slide.title, slide.bodyText, slide.speakerNotes].filter(Boolean).join('\n')
  const grounded = numbersAreGrounded(`${full}\n${compressed}`, source)
  if (!grounded.ok) {
    throw new DraftError(
      `Draft invented figures not on the slide: ${grounded.missing.slice(0, 4).join(', ')}`
    )
  }

  return {
    full,
    // A missing compressed variant falls back to the full script rather than to
    // nothing: the session would otherwise have no way to finish a deck it is
    // running late on, which is the failure the variant exists to prevent.
    compressed: compressed || full,
  }
}

export { COMPRESSED_RATIO }
