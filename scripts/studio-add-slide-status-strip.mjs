// PASS2B J2-04 (flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS): the lines this change adds to files that other pins hold to a base commit
// ("without the added lines the file is <base>'s"). Sibling pins call stripAddSlideStatus(rel, text) first and then do what they always did, the
// way they already strip G09, G12 and G01/G02. scripts/test-studio-add-slide-status.mjs proves the panel strip against the panel's own base
// commit, and that nothing of this feature is left in the page after it.
//
// Every addition is flag-gated or inert flag off (false / undefined / not drawn): scripts/test-studio-add-slide-status.mjs hashes the panel's
// markup and a scripted session against the base's, and runs the page's own handlers on recorded frames with the flag off and on.

import { stripDuplicateDeck } from './studio-duplicate-deck-strip.mjs'
import { stripChatElementRefine } from './studio-chat-element-refine-strip.mjs'
import { stripChatThemeExport } from './studio-chat-theme-export-strip.mjs'
import { stripReconnectResync } from './studio-reconnect-resync-strip.mjs' // P3-4 slice A (stacked)
import { stripJobLedger } from './studio-job-ledger-strip.mjs' // P3-4 slice C (stacked)
import { stripNewDeckHandoffSend } from './studio-new-deck-handoff-send-strip.mjs' // new-deck handoff send (stacked)

const PAGE = 'app/builder/page.tsx'
const PANEL = 'components/studio-add-slide-v2.tsx'

const PAGE_ADDITIONS = [
  [/import \{ STUDIO_ADD_SLIDE_STATUS_ENABLED, createAddSlideV2StatusSettings \} from '@\/lib\/studio-add-slide-status'\n/, ''],
  [/ {16}\/\/ PASS2B J2-04 [^\n]*\n {16}includeJobId: STUDIO_ADD_SLIDE_STATUS_ENABLED,\n/, ''],
  [/ {14}\/\/ PASS2B J2-04 [^\n]*\n {14}\/\/ [^\n]*\n {14}status: STUDIO_ADD_SLIDE_STATUS_ENABLED \? createAddSlideV2StatusSettings\(\{[\s\S]*?\}\) : undefined,\n/, ''],
  // PASS2D A1 (NEXT_PUBLIC_STUDIO_COMPOSER_DRAFT): two imports and one hook call, all inert with the flag off; scripts/test-studio-composer-draft.mjs proves them.
  [/import \{ STUDIO_COMPOSER_DRAFT_ENABLED \} from '@\/lib\/studio-composer-draft'\n/, ''],
  [/import \{ useStudioComposerDraft \} from '@\/hooks\/use-studio-composer-draft'\n/, ''],
  [/ {2}\/\/ PASS2D A1 [^\n]*\n {2}\/\/ [^\n]*\n {2}useStudioComposerDraft\(\{\n[\s\S]*?\n {2}\}\)\n/, ''],
]

const PANEL_ADDITIONS = [
  [/import type \{ AddSlideStatus, AddSlideV2StatusSettings \} from '@\/lib\/studio-add-slide-status'\n/, ''],
  [/ {2}\/\*\* PASS2B J2-04 \(flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS\)[^\n]*\n {2}status\?: AddSlideV2StatusSettings\n/, ''],
  [/ {2}status: statusSettings,\n/, ''],
  [/ {2}\/\/ PASS2B J2-04: the job Generate queued[\s\S]*? {2}if \(tracked && addStatus !== tracked\.status\) setTracked\(\{ jobId: tracked\.jobId, status: addStatus \}\)\n/, ''],
  [/( {4}setQueued\(null\)\n) {4}setTracked\(null\)\n/, '$1'],
  [/ {8}if \(statusSettings && result\.jobId\) setTracked\(\{ jobId: result\.jobId, status: null \}\)\n/, ''],
  // the Queued note keeps its base line; the status line (three shapes) is the addition
  [/ {12}\{queued && !\(addStatus\?\.kind === 'added' \|\| addStatus\?\.kind === 'failed'\) && <p className="asv2-queued" role="status">\{queued\}<\/p>\}\n[\s\S]*?>Try again<\/button>\n {14}<\/p>\n {12}\)\}\n/,
    '            {queued && <p className="asv2-queued" role="status">{queued}</p>}\n'],
  [/ {10}status=\{settings\.status\}\n/, ''],
]

/** `text` of repo file `rel` without this change's additions (any other file comes back as it is). */
export function stripAddSlideStatus(rel, text) {
  const table = rel === PAGE ? PAGE_ADDITIONS : rel === PANEL ? PANEL_ADDITIONS : []
  // FRONTEND-2 Pass 3 (NEXT_PUBLIC_STUDIO_DUPLICATE_DECK): the Builder page's import and one gated element come out first (scripts/studio-duplicate-deck-strip.mjs).
  // FRONTEND-2 Pass 3 (NEXT_PUBLIC_CHAT_ELEMENT_REFINE): that change's flag-gated lines come out first (scripts/studio-chat-element-refine-strip.mjs).
  // FRONTEND-2 Pass 3 (NEXT_PUBLIC_CHAT_THEME_CHANGE / NEXT_PUBLIC_CHAT_EXPORT): those flags' gated lines come out first (scripts/studio-chat-theme-export-strip.mjs).
  return table.reduce((out, [from, to]) => out.replace(from, to), stripDuplicateDeck(rel, stripChatElementRefine(rel, stripChatThemeExport(rel, stripReconnectResync(rel, stripJobLedger(rel, stripNewDeckHandoffSend(rel, text)))))))
}
