'use client'

// Local component specimen only. Root supplies the strict read-only iframe/network adapter.
import { useState } from 'react'
import { ChatInput, type ChatInputProps } from '@/components/builder/chat-input'
import { PresentationViewer } from '@/components/presentation-viewer'
import type { UploadedFile } from '@/components/file-chip'
import '@/app/builder/studio-v4.css'
import '@/app/builder/studio-v4-type.css'
import '@/components/builder/studio-director.css'
import '@/components/layout/studio-shell.css'
import '@/components/builder/studio-canvas.css'

export const FILE_DETAILS_FIXTURE_DRAFT = 'Retained local Director draft while reviewing the complete file enrichment details.'
export const FILE_DETAILS_FIXTURE_LONG_NAME = 'SyntheticLocalUnbrokenOriginalFilename' + 'QuarterlyLeadershipDecisionContext'.repeat(5) + 'EndOfFilename.pdf'

type UploadNoticeSpecimen = 'original' | 'pending' | 'failed'

const diagnostic = [
  'Synthetic local diagnostic. This specimen did not upload a file, store a source or request enrichment.',
  'The native degraded-file details region should retain the complete explanation while the author scrolls, selects text or uses the keyboard. Opening this disclosure must preserve the composer draft and leave the presentation navigation handler available outside the disclosure.',
  ...Array.from({ length: 8 }, (_, index) => `Local diagnostic passage ${index + 1}: Review the complete source explanation, including the original document name, the supplied processing state and the remaining context. This text exists only as synthetic props for the native FileChip. It does not acknowledge a service response, claim durable storage or change any source record.`),
  'End of the synthetic local diagnostic. The retained draft and callback counters should remain unchanged during read-only details inspection.',
].join('\n\n')

export const FILE_DETAILS_FIXTURE_FILES: UploadedFile[] = [
  { id: 'fixture-uploading-file', name: 'Synthetic upload progress.pdf', size: 2058240, type: 'application/pdf', status: 'uploading', uploadProgress: 38 },
  { id: 'fixture-stored-file', name: 'Synthetic stored source.docx', size: 482304, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', status: 'stored', uploadProgress: 100 },
  { id: 'fixture-processing-file', name: 'Synthetic processing data.csv', size: 276480, type: 'text/csv', status: 'processing', uploadProgress: 100 },
  { id: 'fixture-success-file', name: 'Synthetic ready source.txt', size: 14336, type: 'text/plain', status: 'success', uploadProgress: 100 },
  { id: 'fixture-degraded-file', name: 'Synthetic source with a deliberately long original filename — quarterly priorities, supporting passages and complete leadership decision context.pdf', size: 3153920, type: 'application/pdf', status: 'degraded', uploadProgress: 100, errorMessage: diagnostic },
  { id: 'fixture-error-file', name: 'Synthetic failed source.json', size: 4096, type: 'application/json', status: 'error', uploadProgress: 0, errorMessage: 'Synthetic local failed-file props. No file upload was started by this specimen.' },
]

// Change only supplied props; the original six-state specimen stays the default.
export function fileDetailsFilesForNotice(specimen: UploadNoticeSpecimen): UploadedFile[] {
  if (specimen === 'original') return FILE_DETAILS_FIXTURE_FILES
  return FILE_DETAILS_FIXTURE_FILES.map<UploadedFile>(file => {
    if (file.status === 'uploading') return specimen === 'pending'
      ? { ...file, name: FILE_DETAILS_FIXTURE_LONG_NAME }
      : { ...file, status: 'stored' }
    if (file.status === 'error' && specimen === 'failed') return { ...file, name: FILE_DETAILS_FIXTURE_LONG_NAME }
    return file
  })
}

type CallbackCounters = {
  submit: number; remove: number; filesSelected: number; clearAll: number;
  sessionRequest: number; localSettings: number; actionCancel: number;
}

export default function LocalFileDetailsFixture() {
  const [draft, setDraft] = useState(FILE_DETAILS_FIXTURE_DRAFT)
  const [counters, setCounters] = useState<CallbackCounters>({ submit: 0, remove: 0, filesSelected: 0, clearAll: 0, sessionRequest: 0, localSettings: 0, actionCancel: 0 })
  const [uploadNotice, setUploadNotice] = useState<UploadNoticeSpecimen>('original')
  const record = (name: keyof CallbackCounters) => setCounters(previous => ({ ...previous, [name]: previous[name] + 1 }))
  const composerProps: ChatInputProps = {
    inputMessage: draft,
    onInputChange: setDraft,
    onSubmit: event => { event?.preventDefault(); record('submit') },
    uploadedFiles: fileDetailsFilesForNotice(uploadNotice),
    onFilesSelected: () => record('filesSelected'),
    onRemoveFile: () => record('remove'),
    onClearAllFiles: () => record('clearAll'),
    pendingActionInput: null,
    onCancelAction: () => record('actionCancel'),
    researchEnabled: false,
    onResearchEnabledChange: () => record('localSettings'),
    webSearchEnabled: false,
    onWebSearchEnabledChange: () => record('localSettings'),
    knowledgeGraphEnabled: false,
    onKnowledgeGraphEnabledChange: () => record('localSettings'),
    showKnowledgeGraphToggle: false,
    knowledgeGraphAccess: 'unavailable',
    onKnowledgeGraphAccessClick: () => record('localSettings'),
    isReady: true,
    isLoadingSession: false,
    connected: false,
    connecting: false,
    user: { id: 'synthetic-local-component-props' },
    currentSessionId: null,
    onRequestSession: async () => {
      record('sessionRequest')
      throw new Error('Local specimen refuses session creation; no upload or persistence is acknowledged.')
    },
    templateBuilderEnabled: false,
    buildTheme: { mode: 'auto' },
    onBuildThemeChange: () => record('localSettings'),
  }

  return <div data-studio-v4-shell="true" data-studio-file-details-fixture="true">
    <style>{`
      [data-studio-file-details-fixture] { height:100dvh; min-height:0; padding:12px; display:flex; flex-direction:column; gap:10px; color:var(--ss-text); }
      [data-studio-file-details-fixture] > header { flex-shrink:0; font-size:11px; line-height:17px; }
      [data-studio-file-details-fixture] > header strong { display:block; font-size:13px; line-height:19px; }
      [data-studio-file-details-fixture] > main { flex:1; min-height:0; display:grid; grid-template-columns:minmax(300px,40%) minmax(0,1fr); gap:12px; }
      [data-studio-file-details-fixture] [data-local-composer-panel] { min-width:0; min-height:0; overflow-y:auto; border:1px solid var(--ss-line); border-radius:12px; background:var(--ss-panel); padding:10px; }
      [data-studio-file-details-fixture] [data-local-viewer-panel] { min-width:0; min-height:0; overflow:hidden; border:1px solid var(--ss-line); border-radius:12px; }
      [data-studio-file-details-fixture] [data-local-callback-counters] { display:block; margin-bottom:10px; white-space:normal; overflow-wrap:anywhere; font-size:10px; line-height:16px; color:var(--ss-muted); }
      [data-studio-file-details-fixture] [data-local-upload-notice-control] { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-bottom:10px; color:var(--ss-muted); font-size:11px; }
      [data-studio-file-details-fixture] #local-upload-notice { min-width:0; max-width:100%; padding:5px; border:1px solid var(--ss-line); border-radius:5px; background:var(--ss-surface); color:var(--ss-text); }
      [data-studio-file-details-fixture] #local-upload-notice:focus-visible { outline:2px solid var(--ss-accent); outline-offset:2px; }
      @media(max-width:700px) { [data-studio-file-details-fixture] { height:auto; min-height:100dvh; } [data-studio-file-details-fixture] > main { grid-template-columns:minmax(0,1fr); } [data-studio-file-details-fixture] [data-local-viewer-panel] { min-height:330px; } }
    `}</style>
    <header><strong>Native composer and viewer · synthetic file props</strong>No upload, send, persistence or enrichment runs here. The draft is local. Callbacks only increment counters. The notice selector changes supplied props locally; the original six states remain the default. Root supplies the read-only viewer adapter.</header>
    <main>
      <section data-local-composer-panel="true" aria-label="Native composer with synthetic attachment states">
        <output data-local-callback-counters="true" aria-label="Local callback counters">Submit {counters.submit} · Remove {counters.remove} · Files selected {counters.filesSelected} · Clear all {counters.clearAll} · Session requests {counters.sessionRequest} · Settings {counters.localSettings} · Cancel {counters.actionCancel}</output>
        <label data-local-upload-notice-control="true" htmlFor="local-upload-notice">Synthetic upload notice
          <select id="local-upload-notice" value={uploadNotice} onChange={event => setUploadNotice(event.target.value as UploadNoticeSpecimen)}>
            <option value="original">Original six file states</option>
            <option value="pending">Long pending filename</option>
            <option value="failed">Long failed filename</option>
          </select>
        </label>
        <ChatInput {...composerProps} />
      </section>
      <section data-local-viewer-panel="true" aria-label="Native presentation viewer with read-only adapter">
        <PresentationViewer presentationUrl="https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer" presentationId="studio-v4-local-renderer" slideCount={6} showControls={false} isGenerating={false} className="h-full min-h-0" />
      </section>
    </main>
  </div>
}
