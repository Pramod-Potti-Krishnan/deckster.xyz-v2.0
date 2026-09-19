import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { createHash } from 'node:crypto'
import { applyComposerEdits, buildComposerReplacement, composerIsCustom, hydrateComposerSource, sameComposerJson, verifyComposerReadback } from '@/lib/composer-atoms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const collections = { textboxes: 'text_boxes', infographics: 'infographics' } as const

function localBase(raw: string | undefined, port: string, allowedPorts: readonly string[] = [port]) {
  const url = new URL(raw ?? `http://127.0.0.1:${port}`)
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || !allowedPorts.includes(url.port) || url.username || url.password) throw new Error('The local Composer adapter only accepts its configured loopback services.')
  return url.origin
}
async function guard(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_COMPOSER_DIRECT_REGENERATE !== 'true' || process.env.NODE_ENV === 'production') throw new Error('The local Composer adapter is disabled.')
  if (!['localhost', '127.0.0.1'].includes(request.nextUrl.hostname)) throw new Error('Loopback access is required.')
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) throw new Error('Same-origin access is required.')
  if (!(await getServerSession(authOptions))?.user) throw new Error('Sign in to edit this element.')
}
async function call(url: string, body?: unknown) {
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000), ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
  const data = await response.json()
  if (!response.ok) throw new Error(`Local service returned ${response.status}: ${JSON.stringify(data.detail ?? data.error ?? data).slice(0, 1400)}`)
  return data
}
async function load(input: Record<string, any>) {
  const { presentationId, elementId, collection } = input
  const slideIndex = Number(input.slideIndex)
  if (!/^[a-zA-Z0-9-]+$/.test(presentationId ?? '') || !/^[a-zA-Z0-9_-]+$/.test(elementId ?? '') || !Object.hasOwn(collections, collection)
    || !Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 999) throw new Error('Invalid element identity.')
  const stage = process.env.COMPOSER_LOCAL_ROUND === 'stage1'
  const base = localBase(process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL, stage ? '8526' : '8504', stage ? ['8526'] : process.env.COMPOSER_LOCAL_ROUND === 'r17' ? ['8504', '8519'] : ['8504'])
  const presentation = await call(`${base}/api/presentations/${presentationId}`)
  const element = presentation.slides?.[slideIndex]?.[collections[collection as keyof typeof collections]]?.find((item: any) => item.id === elementId)
  if (!element) throw new Error('The selected element no longer exists.')
  const source = hydrateComposerSource(element)
  if ((source.metadata.owning_family === 'INFOGRAPHIC') !== (collection === 'infographics')) throw new Error('The stored family and collection disagree.')
  return { source, slide: presentation.slides[slideIndex], endpoint: `${base}/api/presentations/${presentationId}/slides/${slideIndex}/${collection}/${elementId}/recreate` }
}
export async function GET(request: NextRequest) {
  try { await guard(request); const { source } = await load(Object.fromEntries(request.nextUrl.searchParams)); return NextResponse.json(source) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
export async function POST(request: NextRequest) {
  let outcome: 'not_sent' | 'unknown' | 'committed' = 'not_sent'
  try {
    await guard(request)
    const input = await request.json()
    const { source, slide: originalSlide, endpoint } = await load(input)
    if (source.metadata.source.request_sha256 !== input.expectedSourceSha256) return NextResponse.json({ error: 'The source changed. Select the element again before editing.', replacementOutcome: 'not_sent', committed: false }, { status: 409 })
    if (!input.edits || Array.isArray(input.edits) || typeof input.edits !== 'object') throw new Error('Explicit edits are required.')
    const renderRequest = applyComposerEdits(source, input.edits, input.variant)
    const infographic = source.metadata.owning_family === 'INFOGRAPHIC'
    const custom = composerIsCustom(source.metadata)
    const stage = process.env.COMPOSER_LOCAL_ROUND === 'stage1'
    if (stage && (!custom || infographic)) throw new Error('Stage 1 permits only its isolated custom Text owner.')
    const renderEndpoint = infographic ? `/v1.0/atomic/infographic/${custom ? 'custom' : 'precise'}/render` : `/v1.2/atomic/${source.metadata.owning_family}${custom ? '/custom' : ''}`
    const serviceUrl = custom
      ? infographic ? process.env.COMPOSER_CUSTOM_ILLUSTRATOR_URL : process.env.COMPOSER_CUSTOM_TEXT_URL
      : infographic ? process.env.COMPOSER_ILLUSTRATOR_URL : process.env.COMPOSER_TEXT_URL
    const rendered = await call(localBase(serviceUrl, stage ? '8525' : custom ? infographic ? '8521' : '8520' : infographic ? '8507' : '8505') + renderEndpoint, renderRequest)
    const replacement = buildComposerReplacement(source, renderRequest, rendered)
    if (createHash('sha256').update(rendered.html, 'utf8').digest('hex') !== rendered.html_sha256) throw new Error('The owning service HTML hash does not match its content.')
    // No browser-side canonical hash. Layout checks the old service-bound source
    // and validates the full replacement before its single replacement commit.
    outcome = 'unknown' // Dispatch can commit even if its response is lost.
    const recreated = await call(endpoint, { expected_source_sha256: input.expectedSourceSha256, replacement })
    outcome = 'committed'
    if (recreated.replaced_element_id !== input.elementId || !/^[a-zA-Z0-9_-]+$/.test(recreated.id ?? '') || recreated.id === input.elementId) throw new Error('Replacement identity readback differs.')
    const { source: next, slide: finalSlide } = await load({ ...input, elementId: recreated.id })
    verifyComposerReadback(originalSlide, finalSlide, input.collection, input.elementId, recreated.id)
    if (next.metadata.source.request_sha256 !== rendered.request_sha256) throw new Error('Replacement readback hash differs.')
    for (const [key, value] of Object.entries(replacement)) {
      if (!sameComposerJson(next.element[key], value)) throw new Error(`Replacement readback changed ${key}.`)
    }
    return NextResponse.json({ element: next.element, replacedElementId: input.elementId, rendererVersion: rendered.renderer_version })
  } catch (error) {
    const detail = outcome === 'committed' ? ' Replacement committed; reload the slide before retrying.'
      : outcome === 'unknown' ? ' Replacement outcome is unknown; reload and reconcile the slide before retrying.'
      : ' No replacement request was sent by this action.'
    return NextResponse.json({ error: `${error instanceof Error ? error.message : String(error)}${detail}`,
      committed: outcome === 'unknown' ? null : outcome === 'committed', replacementOutcome: outcome }, { status: outcome === 'not_sent' ? 400 : 502 })
  }
}
