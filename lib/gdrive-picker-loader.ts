/**
 * Client-side Google Picker loader (P4-15 slice 1, DARK). The gapi script is injected only when the flag is on
 * AND the user clicks "Add files from Drive". The access token comes from /api/connectors/gdrive/picker-token
 * (short-lived, drive.file); no refresh token ever reaches the browser.
 * Env: NEXT_PUBLIC_GOOGLE_PICKER_API_KEY (browser API key, referrer-restricted), NEXT_PUBLIC_GOOGLE_PICKER_APP_ID (GCP project number).
 */
import { isGdriveConnectorEnabled } from '@/lib/connectors-gdrive-flag'

type PickerDoc = { id: string }
declare global { interface Window { gapi?: any; google?: any } } // eslint-disable-line @typescript-eslint/no-explicit-any

let loading: Promise<void> | null = null
function loadGapi(): Promise<void> {
  if (loading) return loading
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://apis.google.com/js/api.js'
    s.async = true
    s.onload = () => window.gapi.load('picker', { callback: () => resolve(), onerror: () => reject(new Error('picker load failed')) })
    s.onerror = () => { loading = null; reject(new Error('gapi load failed')) }
    document.head.appendChild(s)
  })
  return loading
}

/** Opens the Picker; resolves with chosen Drive file ids ([] if the user cancels). */
export async function openDrivePicker(): Promise<string[]> {
  if (!isGdriveConnectorEnabled()) throw new Error('Google Drive connector is off.')
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY
  const appId = process.env.NEXT_PUBLIC_GOOGLE_PICKER_APP_ID
  if (!apiKey || !appId) throw new Error('Google Drive picker is not set up yet.')
  const res = await fetch('/api/connectors/gdrive/picker-token', { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || typeof data.access_token !== 'string') throw new Error(data.error || 'Could not open Google Drive. Please reconnect.')
  await loadGapi()
  const g = window.google
  return new Promise<string[]>(resolve => {
    const view = new g.picker.DocsView(g.picker.ViewId.DOCS).setIncludeFolders(false).setSelectFolderEnabled(false)
    const picker = new g.picker.PickerBuilder()
      .addView(view).enableFeature(g.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(data.access_token).setDeveloperKey(apiKey).setAppId(appId)
      .setCallback((r: { action: string; docs?: PickerDoc[] }) => {
        if (r.action === g.picker.Action.PICKED) resolve((r.docs ?? []).map(d => d.id))
        else if (r.action === g.picker.Action.CANCEL) resolve([])
      })
      .build()
    picker.setVisible(true)
  })
}
