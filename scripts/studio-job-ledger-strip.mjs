// FRONTEND-2 P3-4 slice C: Director's job ledger in Studio (NEXT_PUBLIC_STUDIO_JOB_LEDGER, default off). The exact text this change adds
// to (or swaps in) the files it touches, so a pin that holds one of them to an earlier commit can first put the base text back
// (stripJobLedger(rel, text)), the way the other *-strip.mjs files do. scripts/test-studio-job-ledger.mjs proves that stripping gives back
// BASE_COMMIT's file byte for byte. New files (no base text to put back): JOB_LEDGER_NEW_FILES below.

export const BASE_COMMIT = 'cfc09f899ee47a5e828f2eb5fb0a7007dd3c694a'

const ENV_BLOCK = `# P3-4 DIRECTOR'S JOB LEDGER IN STUDIO (FRONTEND-2, Studio side of P3-4, slice C; the Builder in the Studio shell only). On for the exact value
# "true"; default off, and then nothing changes: Director's job_update frames are dropped as before and nothing is sent. Build-time value:
# change it on Vercel and redeploy. It pairs with Director's DIRECTOR_JOB_LEDGER_ENABLED (!527): with that off no job rows arrive and no card
# shows. On: Director's job rows (job_update frames, and the jobs list of sync_response) are kept per job (the highest seq; a finished row never
# changes), and each slide compose or refine, chat element, refine-element, theme or export directive, or deck build of this session that
# failed or timed out gets one calm card at the end of the chat, in Studio's own words (never the raw error). Retry, only where Director offers
# a frame retry (never for a build, whose text points at Resume, and never for Studio's own REST compose or refine jobs, which keep the rail
# card's retry), sends {"type": "job_retry", "data": {"job_id": "<id>"}} once per click and stays disabled until Director answers or 15 s pass;
# nothing is ever retried automatically. Dismiss hides that card in this tab only and sends nothing. No other frame, request body, endpoint or
# saved field changes.
NEXT_PUBLIC_STUDIO_JOB_LEDGER="false"

`

const HOOK_IMPORT = `// NEXT_PUBLIC_STUDIO_JOB_LEDGER (P3-4c, default off): Director's job_update frames and sync_response.payload.jobs go to the page's ledger.
import { STUDIO_JOB_LEDGER_ENABLED, JOB_UPDATE_TYPE, jobLedgerRow, jobLedgerRows } from '@/lib/studio-job-ledger';
`

const HOOK_CONTROL_ADDED = `      data: { job_id: string };
    }
  // NEXT_PUBLIC_STUDIO_JOB_LEDGER (P3-4c): run a failed / timed-out Director job again (a frame-route row's retry.job_id; the user's click only).
  | {
      type: 'job_retry';
      data: { job_id: string };
    };
`
const HOOK_CONTROL_BASE = `      data: { job_id: string };
    };
`

const HOOK_OPTIONS = `  // NEXT_PUBLIC_STUDIO_JOB_LEDGER (P3-4c): Director's job rows for this socket's session (a job_update frame's row; sync_response's
  // jobs list, possibly []). Never rendered in chat. Unused with the flag off.
  onJobUpdate?: (row: import('@/lib/studio-job-ledger').JobLedgerRow, owner: import('@/lib/studio-job-ledger').JobLedgerOwner) => void;
  onJobsSync?: (rows: import('@/lib/studio-job-ledger').JobLedgerRow[], owner: import('@/lib/studio-job-ledger').JobLedgerOwner) => void;
`

export const JOB_LEDGER_HOOK_INTAKE = `            // NEXT_PUBLIC_STUDIO_JOB_LEDGER (P3-4c): Director's job_update (a state tick: it does not unlock the turn) goes to the page's ledger,
            // here, ahead of the allowlist, so it never reaches the reducer, the transcript or the cache; sync_response's jobs go there too,
            // and that frame then carries on as before. Only this socket's session. Flag off: job_update is unknown, dropped below as before.
            if (STUDIO_JOB_LEDGER_ENABLED && (parsedMessage.type as unknown) === JOB_UPDATE_TYPE) {
              const row = parsedMessage.session_id === socketSessionId ? jobLedgerRow(parsedMessage.payload) : null;
              if (row) transportCallbacksRef.current.onJobUpdate?.(row, { sessionId: socketSessionId, isCurrent: isCurrentSocket });
              return;
            }
            if (STUDIO_JOB_LEDGER_ENABLED && parsedMessage.type === 'sync_response' && parsedMessage.session_id === socketSessionId) {
              const rows = jobLedgerRows((parsedMessage.payload as { jobs?: unknown } | null | undefined)?.jobs);
              if (rows) transportCallbacksRef.current.onJobsSync?.(rows, { sessionId: socketSessionId, isCurrent: isCurrentSocket });
            }
`

const PAGE_IMPORT = `// NEXT_PUBLIC_STUDIO_JOB_LEDGER (P3-4c, default off): Director's failed or timed-out jobs as calm cards at the end of the chat (lib/studio-job-ledger.ts).
import { STUDIO_JOB_LEDGER_ENABLED } from '@/lib/studio-job-ledger'
import { StudioJobLedgerCards, studioJobLedger } from '@/components/builder/chat/studio-job-ledger-card'
`

export const JOB_LEDGER_PAGE_OPTIONS = `    // NEXT_PUBLIC_STUDIO_JOB_LEDGER: Director's job rows (job_update, sync_response jobs) go to this tab's ledger. Off: not passed.
    ...(STUDIO_JOB_LEDGER_ENABLED ? { onJobUpdate: studioJobLedger.onJobUpdate, onJobsSync: studioJobLedger.onJobsSync } : {}),
`

export const JOB_LEDGER_PAGE_MOUNT = `                      {/* NEXT_PUBLIC_STUDIO_JOB_LEDGER (Studio shell): a card per failed or timed-out job of this session; Retry sends job_retry. */}
                      {STUDIO_JOB_LEDGER_ENABLED && studioShell && (
                        <StudioJobLedgerCards sessionId={currentSessionId || wsSessionId} sendJobRetry={jobId => sendControlMessage('job_retry', { job_id: jobId })} />
                      )}
`

// [text this change has, text the base has]; each `added` is a literal that occurs once in the file.
const CHANGES = {
  '.env.example': [[ENV_BLOCK, '']],
  'app/builder/page.tsx': [
    [PAGE_IMPORT, ''],
    [JOB_LEDGER_PAGE_OPTIONS, ''],
    [JOB_LEDGER_PAGE_MOUNT, ''],
  ],
  'hooks/use-deckster-websocket-v2.ts': [
    [HOOK_IMPORT, ''],
    [HOOK_CONTROL_ADDED, HOOK_CONTROL_BASE],
    [HOOK_OPTIONS, ''],
    [JOB_LEDGER_HOOK_INTAKE, ''],
  ],
}

export const JOB_LEDGER_FILES = Object.keys(CHANGES)
export const JOB_LEDGER_NEW_FILES = ['lib/studio-job-ledger.ts', 'components/builder/chat/studio-job-ledger-card.tsx', 'components/builder/chat/studio-job-ledger-card.css',
  'scripts/studio-job-ledger-strip.mjs', 'scripts/test-studio-job-ledger.mjs',
  // DIRECTOR-2's recorded frames (deckster-workspace 561f004ba29, streams/director2/job-ledger/), copied verbatim.
  ...['job-update-each-state', 'job-retry-round-trip', 'directive-never-answered', 'deck-build-stall', 'sync-response-with-jobs'].map(name => `scripts/fixtures/studio-job-ledger/${name}.json`)]
export const JOB_LEDGER_CHANGES = CHANGES

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripJobLedger(rel, text) {
  const table = CHANGES[rel]
  if (!table) return text
  return table.reduce((out, [added, original]) => out.replace(added, () => original), text)
}
