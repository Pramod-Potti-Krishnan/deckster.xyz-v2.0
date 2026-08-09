/**
 * GET/PATCH /api/publish/[slug]/qa-sources — the per-document Q&A allowlist.
 *
 * This table lives in the PUBLISH schema, not knowledge/KG, and that is a
 * deliberate boundary: the two are maintained by different teams and a shared
 * table is a standing invitation for one team's change to silently alter the
 * other's behaviour. Publish decides what publish exposes.
 *
 * The decision travels OUT to Researcher on freeze and is enforced by NOT
 * COPYING the denied source into the frozen corpus. Researcher never reads this
 * table. That is why denial is durable rather than a filter someone can forget:
 * the bytes are not there.
 *
 * Defaults are per KIND, and asymmetric on purpose. Deck slides and public web
 * pages default to allowed — the audience can already see one and anyone can
 * see the other. Uploads and internal research default to DENIED. A denied
 * source costs a missed answer, which the owner's inbox recovers; an allowed
 * confidential one costs a leak, which nothing recovers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireDeckOwner } from '@/lib/publish/qa-owner'
import { listQaCorpusSources } from '@/lib/publish/qa'
import { stripLabelMarkup } from '@/lib/publish/qa-citations'

export const dynamic = 'force-dynamic'

/** Unknown kinds deny, so a source type added later cannot become readable by
 *  the audience merely because nobody updated this function. */
export function defaultAllowForKind(kind: string): boolean {
  return kind === 'deck' || kind === 'web'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const owned = await requireDeckOwner(slug)
    if (owned.error) return owned.error

    const stored = await prisma.publishedDeckSource.findMany({
      where: { publishedDeckId: owned.deck.id },
      orderBy: [{ sourceKind: 'asc' }, { sourceLabel: 'asc' }],
    })

    // Reconcile against what is actually IN the frozen corpus. A source the
    // owner denied last time is absent from the corpus by design, so the stored
    // rows — not the corpus — are the record of the decision.
    let live: Awaited<ReturnType<typeof listQaCorpusSources>> = []
    if (owned.deck.qaCorpusStatus === 'ready' || owned.deck.qaCorpusStatus === 'partial') {
      try {
        live = await listQaCorpusSources(owned.deck.id)
      } catch (error) {
        console.error('[Publish QA] corpus source listing failed:', error)
      }
    }

    const byRef = new Map(stored.map((row) => [row.sourceRef, row]))
    for (const source of live) {
      const existing = byRef.get(source.source_ref)
      if (existing) {
        byRef.set(source.source_ref, { ...existing, chunkCount: source.chunk_count })
        continue
      }
      byRef.set(source.source_ref, {
        id: '',
        publishedDeckId: owned.deck.id,
        sourceRef: source.source_ref,
        sourceKind: source.source_kind,
        sourceLabel: source.source_label,
        chunkCount: source.chunk_count,
        allowedForQa: defaultAllowForKind(source.source_kind),
        updatedAt: new Date(),
      })
    }

    return NextResponse.json({
      sources: [...byRef.values()].map((row) => ({
        sourceRef: row.sourceRef,
        sourceKind: row.sourceKind,
        // Owner-facing only, never serialised to /p/{slug} — but slide titles
        // are HTML, so the publish dialog was rendering raw <span style=…>
        // at the owner too. Same strip as the viewer boundary.
        sourceLabel: row.sourceLabel ? stripLabelMarkup(row.sourceLabel) : null,
        chunkCount: row.chunkCount,
        allowedForQa: row.allowedForQa,
      })),
      corpusStatus: owned.deck.qaCorpusStatus,
      corpusVersion: owned.deck.qaCorpusVersion,
    })
  } catch (error) {
    console.error('[Publish QA] sources read failed:', error)
    return NextResponse.json({ error: 'Could not load Q&A sources' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const owned = await requireDeckOwner(slug)
    if (owned.error) return owned.error

    const body = await request.json().catch(() => null)
    if (!body || !Array.isArray(body.sources)) {
      return NextResponse.json(
        { error: 'Body must be { sources: [{ sourceRef, sourceKind, allowedForQa }] }' },
        { status: 400 }
      )
    }
    if (body.sources.length > 500) {
      return NextResponse.json({ error: 'Too many sources in one update' }, { status: 400 })
    }

    const updates: {
      sourceRef: string
      sourceKind: string
      sourceLabel: string | null
      allowedForQa: boolean
    }[] = []
    for (const raw of body.sources) {
      if (!raw || typeof raw.sourceRef !== 'string' || !raw.sourceRef.trim()) continue
      if (typeof raw.allowedForQa !== 'boolean') continue
      updates.push({
        sourceRef: raw.sourceRef.trim().slice(0, 300),
        sourceKind: typeof raw.sourceKind === 'string' ? raw.sourceKind.slice(0, 40) : 'document',
        sourceLabel: typeof raw.sourceLabel === 'string' ? raw.sourceLabel.slice(0, 300) : null,
        allowedForQa: raw.allowedForQa,
      })
    }
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid source updates' }, { status: 400 })
    }

    await prisma.$transaction(
      updates.map((update) =>
        prisma.publishedDeckSource.upsert({
          where: {
            publishedDeckId_sourceRef: {
              publishedDeckId: owned.deck.id,
              sourceRef: update.sourceRef,
            },
          },
          create: { publishedDeckId: owned.deck.id, ...update },
          // The label may legitimately have changed; the DECISION is what the
          // owner just sent, so it always wins.
          update: { allowedForQa: update.allowedForQa, sourceLabel: update.sourceLabel },
        })
      )
    )

    // The corpus was frozen under the OLD allowlist. Denying a source now does
    // not remove its chunks — only a refreeze does that. Say so rather than
    // implying the change is already in force.
    const needsRefreeze = updates.some((update) => !update.allowedForQa)

    return NextResponse.json({
      updated: updates.length,
      needsRefreeze,
      message: needsRefreeze
        ? 'Republish the deck to rebuild the Q&A corpus without the sources you turned off.'
        : null,
    })
  } catch (error) {
    console.error('[Publish QA] sources update failed:', error)
    return NextResponse.json({ error: 'Could not update Q&A sources' }, { status: 500 })
  }
}
