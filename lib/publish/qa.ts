/**
 * Server-side client for Researcher's published-deck Q&A API.
 *
 * SERVER ONLY. It reads KNOWLEDGE_API_KEY and must never be imported from a
 * client component — the whole point of the ask route is that the browser
 * never learns how to talk to Researcher directly.
 */

import { getResearcherBaseUrl } from '@/lib/publish/service-urls'
import type { InternalCitation } from '@/lib/publish/qa-citations'

/** Matches Researcher's `AnswerResponse` (backend/researcher routers/qa.py). */
export interface QaAnswerResult {
  outcome: 'answered' | 'deferred'
  gate_reason: string
  answer: string | null
  citations: InternalCitation[]
  defer_message: string | null
  confidence: number | null
  retrieval_top: number | null
  /** Metered, not estimated. Non-zero on defers decided after the model call. */
  tokens_in: number
  tokens_out: number
  model_used: string | null
}

export interface QaCorpusSource {
  source_ref: string
  source_kind: string
  source_label: string | null
  chunk_count: number
}

/** How long we wait on Researcher before giving the asker a defer instead. */
const ANSWER_TIMEOUT_MS = 25_000
const FREEZE_TIMEOUT_MS = 120_000

function qaHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const apiKey = process.env.KNOWLEDGE_API_KEY
  if (apiKey) headers['X-API-Key'] = apiKey
  return headers
}

/** Is the Q&A backend configured at all? Checked before anything is offered. */
export function isQaBackendConfigured(): boolean {
  if (process.env.PUBLIC_QA_ENABLED !== 'true') return false
  try {
    getResearcherBaseUrl()
    return true
  } catch {
    return false
  }
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${getResearcherBaseUrl()}${path}`, {
      method: 'POST',
      headers: qaHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Researcher ${path} failed: ${response.status} ${detail.slice(0, 300)}`)
    }
    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Ask a question against a frozen corpus.
 *
 * Returns the FULL, tier-blind citation set — Researcher's gates verify against
 * all the evidence, so filtering happens later, at the serialization boundary
 * (`citationsForViewer`). Never hand this result to a viewer unfiltered.
 */
export async function askResearcher(params: {
  qaCorpusId: string
  corpusVersion: number
  question: string
  deckTitle?: string | null
  ownerName: string
  tonePreset: string
  toneInstruction?: string | null
  allowedSourceRefs?: string[] | null
}): Promise<QaAnswerResult> {
  return post<QaAnswerResult>(
    '/api/v1/qa/answer',
    {
      qa_corpus_id: params.qaCorpusId,
      corpus_version: params.corpusVersion,
      question: params.question,
      deck_title: params.deckTitle ?? null,
      owner_name: params.ownerName,
      tone_preset: params.tonePreset,
      tone_instruction: params.toneInstruction ?? null,
      // null means "no allowlist recorded yet" — Researcher then retrieves over
      // the whole frozen corpus, which is already the allowed set because
      // denied sources were never copied into it at freeze time.
      allowed_source_refs: params.allowedSourceRefs ?? null,
    },
    ANSWER_TIMEOUT_MS
  )
}

/**
 * Freeze a published deck's Q&A corpus.
 *
 * `excludedSourceRefs` is the publisher's allowlist travelling IN on this call.
 * Researcher never reads publish's tables to discover it, and a denied source is
 * enforced by NOT COPYING it — so the bytes are absent, not merely filtered.
 */
export async function freezeQaCorpus(params: {
  qaCorpusId: string
  corpusVersion: number
  presentation: unknown
  sessionId?: string | null
  excludedSourceRefs?: string[]
}): Promise<{ status: string; total: number; written?: number }> {
  return post(
    '/api/v1/qa/corpus/freeze',
    {
      qa_corpus_id: params.qaCorpusId,
      corpus_version: params.corpusVersion,
      presentation: params.presentation,
      session_id: params.sessionId ?? null,
      excluded_source_refs: params.excludedSourceRefs ?? [],
    },
    FREEZE_TIMEOUT_MS
  )
}

export async function listQaCorpusSources(qaCorpusId: string): Promise<QaCorpusSource[]> {
  const response = await fetch(
    `${getResearcherBaseUrl()}/api/v1/qa/corpus/${encodeURIComponent(qaCorpusId)}/sources`,
    { headers: qaHeaders(), cache: 'no-store' }
  )
  if (!response.ok) {
    throw new Error(`Researcher corpus/sources failed: ${response.status}`)
  }
  const data = await response.json()
  return (data?.sources ?? []) as QaCorpusSource[]
}

/**
 * Delete a frozen corpus. Called on unpublish.
 *
 * Never throws: failing to tear down a corpus must not block the unpublish
 * itself, because unpublish is the user's revocation path and it has to work.
 * The corpus is unreachable regardless once the deck row is revoked.
 */
export async function deleteQaCorpus(qaCorpusId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${getResearcherBaseUrl()}/api/v1/qa/corpus/${encodeURIComponent(qaCorpusId)}`,
      { method: 'DELETE', headers: qaHeaders(), cache: 'no-store' }
    )
    return response.ok
  } catch (error) {
    console.error('[Publish QA] corpus delete failed:', error)
    return false
  }
}
