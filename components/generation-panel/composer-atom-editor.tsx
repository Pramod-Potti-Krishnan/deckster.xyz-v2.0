'use client'

import { useEffect, useRef, useState } from 'react'
import { composerEditableVariants, composerIsCustom, readPointer, type ComposerSource, type ComposerTarget } from '@/lib/composer-atoms'

export function ComposerAtomEditor({ target, onClose, onReplaced }: {
  target: ComposerTarget
  onClose: () => void
  onReplaced: (target: ComposerTarget, originalTarget: ComposerTarget) => Promise<void>
}) {
  const [source, setSource] = useState<ComposerSource | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [variant, setVariant] = useState(target.metadata.variant_id)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [needsReload, setNeedsReload] = useState(false)
  const mounted = useRef(false)
  const inFlight = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    mounted.current = true
    setSource(null); setValues({}); setError(null); setDone(false); setNeedsReload(false); setVariant(target.metadata.variant_id)
    const query = new URLSearchParams({ presentationId: target.presentationId, slideIndex: String(target.slideIndex), collection: target.collection, elementId: target.elementId })
    fetch(`/api/composer/regenerate?${query}`, { signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result as ComposerSource })
      .then(result => {
        if (controller.signal.aborted) return
        if (result.metadata.source.request_sha256 !== target.metadata.source.request_sha256) throw new Error('The source changed. Select the element again.')
        setSource(result)
        setValues(Object.fromEntries(result.slots.map(slot => [slot.id, readPointer(result.request, slot.path)])))
      }).catch(reason => { if (!controller.signal.aborted) setError(String(reason.message ?? reason)) })
    return () => { mounted.current = false; controller.abort() }
  }, [target.presentationId, target.slideIndex, target.collection, target.elementId, target.metadata.source.request_sha256])

  async function regenerate() {
    if (!source || inFlight.current || needsReload) return
    inFlight.current = true
    const originalTarget = structuredClone(target)
    let dispatched = false, responseReceived = false, committed = false
    setBusy(true); setError(null); setDone(false)
    try {
      const edits = Object.fromEntries(source.slots.filter(slot => values[slot.id] !== readPointer(source.request, slot.path)).map(slot => [slot.id, values[slot.id]]))
      dispatched = true
      const response = await fetch('/api/composer/regenerate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...originalTarget, expectedSourceSha256: source.metadata.source.request_sha256, variant, edits }) })
      const result = await response.json()
      responseReceived = true
      if (!response.ok) {
        if (mounted.current && result.replacementOutcome !== 'not_sent') setNeedsReload(true)
        throw new Error(result.error ?? 'Regeneration outcome could not be confirmed. Reload before retrying.')
      }
      committed = true
      if (mounted.current) { setDone(true); setNeedsReload(true) }
      // A completed mutation still requires viewer refresh if this editor was
      // unmounted by a newer selection. The parent compares originalTarget
      // with its current selection before choosing what to select afterwards.
      await onReplaced({ ...originalTarget, elementId: result.element.id, metadata: result.element.element_metadata }, originalTarget)
    } catch (reason) {
      if (mounted.current) {
        const suffix = committed ? ' Replacement committed; reload the slide if it has not refreshed.'
          : dispatched && !responseReceived ? ' Request outcome is unknown; reload and reconcile before retrying.' : ''
        if (committed || (dispatched && !responseReceived)) setNeedsReload(true)
        setError((reason instanceof Error ? reason.message : String(reason)) + suffix)
      }
    } finally { inFlight.current = false; if (mounted.current) setBusy(false) }
  }

  return <section className="flex h-full flex-col bg-white text-slate-900" aria-label="Composer element editor" data-composer-element-id={target.elementId} data-composer-source-hash={target.metadata.source.request_sha256}>
    <div className="border-b p-4"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{target.metadata.owning_family}</h2><button onClick={onClose} disabled={busy} aria-label="Close element editor">✕</button></div><p className="mt-1 text-sm text-slate-500">Edit this element’s saved content</p></div>
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {!composerIsCustom(target.metadata) && <label className="block text-sm font-medium">Variant<select aria-label="Variant" className="mt-1 block w-full rounded border p-2" value={variant} onChange={event => setVariant(event.target.value)} disabled={busy}>
        {composerEditableVariants(target.metadata).map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>}
      {!source && !error && <p role="status">Loading saved values…</p>}
      {source && !source.slots.length && <p role="status" className="text-sm text-slate-600">This graphic has no text. Select a label or annotation on the slide to edit it.</p>}
      {source?.slots.map(slot => <label key={slot.id} className="block text-sm font-medium">{slot.label}<span className="ml-2 text-xs font-normal text-slate-500">{slot.role}</span><textarea aria-label={slot.label} data-slot-id={slot.id} data-slot-role={slot.role} className="mt-1 block min-h-16 w-full rounded border p-2 font-normal" value={values[slot.id] ?? ''} disabled={busy} onChange={event => setValues(previous => ({ ...previous, [slot.id]: event.target.value }))}/></label>)}
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {done && <p role="status">Element replaced.</p>}
    </div>
    <div className="border-t p-4"><button className="w-full rounded bg-purple-700 px-4 py-3 font-medium text-white disabled:opacity-50" disabled={!source?.slots.length || busy || needsReload} onClick={regenerate}>{busy ? 'Regenerating…' : 'Regenerate element'}</button></div>
  </section>
}
