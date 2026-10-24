// LAUNCHED WORDING (FRONTEND-1, Pass 3; flag NEXT_PUBLIC_STUDIO_LAUNCH_WORDING, exact "true", default off, read at build time). Import-free.
//
// PK, 23 Oct: "replace 'coming soon' / mock wording on the regular pages with launched wording (we are going out); grey out features that are truly not ready instead of
// promising them." This file is the ONE list of what changed: for every sentence the signed-in pages used to promise or explain in developer-speak, the text the page had
// (`today`) and the text it has with the flag on (`launched`), and the file that carries it. Plan and evidence: streams/frontend/pass3/launched-wording/PLAN.md in the workspace.
//
// The app files do NOT import this list. Each one reads the flag inline (`const LAUNCH_WORDING = process.env.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === "true"`, the exact-string rule
// of the other Studio flags, written out so Next inlines it) and carries its launched text as a literal next to the old one: the older page harnesses stub every import, and
// an imported flag would be a truthy stub. scripts/test-studio-launch-wording.mjs holds the two together: every `today` is in the base commit's file, every `launched` literal is
// in the file now, and no launched sentence promises anything.
//
// Greyed-out controls (not words) are listed in LAUNCH_GREYED; the test pins each in the file. With the flag off every file renders exactly as before.

export type LaunchWordKind = 'promise' | 'claim' | 'dev-speak' | 'prototype'

export interface LaunchWord {
  id: string
  /** The file that carries the launched text (and, unless `todayFile` says otherwise, the text it replaces). */
  file: string
  /** The pure word file that holds `today` when it is not `file` (those files read no environment, so the page or component that shows the text carries the launched one). */
  todayFile?: string
  kind: LaunchWordKind
  /** The text before this change (a rendered sentence, whitespace collapsed). */
  today: string
  /** The text with the flag on, as the file spells it (an apostrophe may be written &apos; in JSX text). */
  launched: string
}

export const LAUNCH_WORDS: readonly LaunchWord[] = [
  // ---- Settings: nothing here promises a later release; what is not available says so
  { id: 'security-2fa-text', file: 'app/(app)/settings/security/page.tsx', kind: 'promise', today: "Your Google account's 2FA protects your sign-in. App-level TOTP is planned for a future release.", launched: 'Two-step verification comes from your Google account. Deckster does not add a second factor of its own.' },
  { id: 'security-2fa-badge', file: 'app/(app)/settings/security/page.tsx', kind: 'promise', today: 'Planned', launched: 'Via Google' },
  { id: 'privacy-visibility-text', file: 'app/(app)/settings/privacy/page.tsx', kind: 'promise', today: 'Your profile is private. Public profiles and team sharing are planned for a future release.', launched: 'Your profile is private. Public profiles and team sharing are not available.' },
  { id: 'privacy-visibility-badge', file: 'app/(app)/settings/privacy/page.tsx', kind: 'promise', today: 'Planned', launched: 'Private' },
  { id: 'notifications-note', file: 'app/(app)/settings/notifications/page.tsx', kind: 'promise', today: 'Email delivery will activate when notifications ship.', launched: 'Email notifications are not available, so these switches are off.' },
  { id: 'notifications-note-classic', file: 'app/(app)/settings/notifications/page.tsx', kind: 'promise', today: 'Preferences saved. Email delivery will activate when notifications ship.', launched: 'Email notifications are not available, so these switches are off.' },
  { id: 'notifications-address', file: 'app/(app)/settings/notifications/page.tsx', kind: 'claim', today: 'Your notification delivery address', launched: 'The email address on your account' },
  // ---- Decks
  { id: 'dashboard-duplicate-note', file: 'app/(app)/dashboard/page.tsx', kind: 'dev-speak', today: 'Duplicate is not connected in this library.', launched: "Duplicating decks isn't available right now." },
  { id: 'dashboard-duplicate-delete-note', file: 'app/(app)/dashboard/page.tsx', kind: 'dev-speak', today: 'Duplicate and delete are not connected in this library.', launched: "Duplicating and deleting decks isn't available right now." },
  { id: 'dashboard-delete-note', file: 'app/(app)/dashboard/page.tsx', kind: 'dev-speak', today: 'Delete is not connected in this library.', launched: "Deleting decks isn't available right now." },
  { id: 'dashboard-card-sub', file: 'app/(app)/dashboard/page.tsx', kind: 'promise', today: 'Coming soon', launched: 'Loaded previews without a completed deck' },
  // ---- Help
  { id: 'help-templates', file: 'app/help/page.tsx', kind: 'claim', today: 'Absolutely! Visit the Templates page to browse professional starting points, then let the agents shape one into your deck.', launched: 'Yes. Upload a PowerPoint to turn it into a template, or save a finished deck as a template, then reuse it from the Templates page.' },
  { id: 'help-share', file: 'app/help/page.tsx', kind: 'promise', today: "Yes — export to PowerPoint or PDF and send the file to anyone. (Live multi-user editing isn't available yet.)", launched: 'Yes. Publish a link from the builder (Publish), or export to PowerPoint or PDF and send the file. Live multi-user editing is not available.' },
  { id: 'help-export', file: 'app/help/page.tsx', kind: 'claim', today: "Export times vary by presentation size. Most exports complete within 30-60 seconds. Large presentations (50+ slides) may take longer. You'll receive a notification when it's ready.", launched: 'Export times vary by presentation size. Most exports complete within 30-60 seconds. Large presentations (50+ slides) may take longer.' },
  { id: 'help-tip', file: 'app/help/page.tsx', kind: 'claim', today: 'Collaborate with team members by sharing presentations', launched: 'Share a published link with your team' },
  // ---- Sign-up
  { id: 'signup-templates', file: 'app/auth/signup/page.tsx', kind: 'claim', today: 'Professional templates', launched: 'Reusable templates from your own decks' },
  { id: 'signup-approval', file: 'app/auth/signup/page.tsx', kind: 'promise', today: 'Manual approval for early access', launched: 'Your account is approved by our team before first use' },
  // ---- Your details
  { id: 'details-identity-note', file: 'components/studio-personal/details-workspace.tsx', kind: 'prototype', today: 'One reusable identity is the direction. Saving defaults and applying them to decks are not connected in this candidate.', launched: 'Presenter details here are a preview. Use Open deck details in Studio to set the footer and logo for a deck.' },
  { id: 'details-defaults-note', file: 'components/studio-personal/details-workspace.tsx', kind: 'dev-speak', today: 'Reusable defaults are not connected. Leaving this page discards the draft.', launched: 'Reusable defaults are not available. Leaving this page discards the draft.' },
  // ---- Intelligence
  { id: 'intelligence-one-line', file: 'components/studio-personal/intelligence-p2.tsx', todayFile: 'lib/studio-intelligence-p2.ts', kind: 'promise', today: 'Your choices are kept on this device. Deckster does not use them to pick models yet.', launched: 'Your choices are kept on this device. They do not change which models Deckster uses.' },
  { id: 'intelligence-one-line-no-storage', file: 'components/studio-personal/intelligence-p2.tsx', todayFile: 'lib/studio-intelligence-p2.ts', kind: 'promise', today: 'This browser cannot keep your choices, so they last only until you reload or leave. Deckster does not use them to pick models yet.', launched: 'This browser cannot keep your choices, so they last only until you reload or leave. They do not change which models Deckster uses.' },
  { id: 'intelligence-provenance', file: 'components/studio-personal/intelligence-workspace.tsx', kind: 'prototype', today: 'Model names, task defaults, and specifications come from the accepted Studio v4 prototype catalog. They are examples for reviewing this experience, not your account permissions or current service routing. No connected model catalog, benchmark results, or preference-saving service is used here.', launched: 'Model names, task defaults, and specifications are a snapshot of the catalog. They are not your account permissions or current service routing. No live model catalog, benchmark results, or preference-saving service is used here.' },
  { id: 'intelligence-snapshot-label', file: 'components/studio-personal/intelligence-p2.tsx', kind: 'prototype', today: 'Design snapshot · ', launched: 'Catalog snapshot · ' },
  { id: 'intelligence-readiness-badge', file: 'components/studio-personal/intelligence-workspace.tsx', kind: 'promise', today: 'Preview', launched: 'Not available' },
  { id: 'intelligence-readiness-title', file: 'components/studio-personal/intelligence-workspace.tsx', kind: 'promise', today: 'Preview', launched: 'Personal models are not available' },
  { id: 'intelligence-scope-note', file: 'components/studio-personal/intelligence-workspace.tsx', kind: 'prototype', today: 'Choices for one presentation aren’t available in this preview.', launched: 'Choices for one presentation aren’t available.' },
  { id: 'model-catalog-not-available', file: 'components/studio-personal/intelligence-models.tsx', todayFile: 'lib/studio-model-catalog.ts', kind: 'promise', today: "The model catalog isn't available yet", launched: "The model catalog isn't available right now" },
  { id: 'model-catalog-summary', file: 'components/studio-personal/intelligence-models.tsx', todayFile: 'lib/studio-model-catalog.ts', kind: 'promise', today: 'Not available yet', launched: 'Not available' },
  { id: 'model-catalog-none', file: 'components/studio-personal/intelligence-models.tsx', todayFile: 'lib/studio-model-catalog.ts', kind: 'promise', today: 'No models open for selection yet', launched: 'No models open for selection' },
  { id: 'models-section-note', file: 'components/studio-personal/intelligence-models.tsx', kind: 'promise', today: 'It will appear here once it is set up. Nothing else on this page depends on it.', launched: 'Nothing else on this page depends on it.' },
  // ---- Imported decks, Add Slide
  { id: 'import-pdf', file: 'components/studio-deck-import/studio-deck-import-dialog.tsx', todayFile: 'lib/studio-deck-import.ts', kind: 'promise', today: 'Import the PowerPoint this PDF came from. PDF import is coming.', launched: 'Only PowerPoint (.pptx) files can be imported. If you have a PDF, import the PowerPoint it came from.' },
  { id: 'import-note', file: 'components/studio-deck-import/studio-deck-import-note.tsx', todayFile: 'lib/studio-deck-import.ts', kind: 'promise', today: 'This deck keeps the design of your PowerPoint file. Changing the theme and Add Element are not available for imported decks yet.', launched: 'This deck keeps the design of your PowerPoint file. Changing the theme and Add Element are not available for imported decks.' },
  { id: 'addslide-needs-input', file: 'components/studio-add-slide-v2.tsx', todayFile: 'lib/studio-add-slide-v2-submit.ts', kind: 'promise', today: 'This slide needs more detail than you gave. Follow-up questions are coming in v2.1. For now, add more detail to the box and try again.', launched: 'This slide needs more detail than you gave. Add more detail to the box and try again.' },
  // ---- Libraries
  { id: 'templates-composer-delete', file: 'components/studio-libraries/templates-workspace.tsx', todayFile: 'lib/studio-library-manage.ts', kind: 'promise', today: "Composer templates can't be deleted here yet.", launched: "Composer templates can't be deleted here." },
  { id: 'templates-rename-unavailable', file: 'components/studio-libraries/templates-workspace.tsx', todayFile: 'lib/studio-library-manage.ts', kind: 'promise', today: "Renaming templates isn't available yet.", launched: "Renaming templates isn't available." },
  { id: 'templates-notice', file: 'components/studio-libraries/templates-workspace.tsx', todayFile: 'lib/studio-templates-notice.ts', kind: 'promise', today: 'Saved templates are not available yet. You can still sketch a draft here and continue planning it in Studio.', launched: "Saved templates aren't available right now. You can still sketch a draft here and continue planning it in Studio." },
  { id: 'templates-library-off', file: 'components/studio-libraries/templates-workspace.tsx', kind: 'dev-speak', today: 'The connected template library is not enabled.', launched: "Saved templates aren't available right now." },
  { id: 'templates-composer-off', file: 'components/studio-libraries/templates-workspace.tsx', kind: 'dev-speak', today: 'This is a Composer template. Its dedicated Studio workflow is not enabled in this environment.', launched: "This template opens from the Composer library in Studio, which isn't available right now." },
  { id: 'templates-create-hint', file: 'components/studio-libraries/templates-workspace.tsx', kind: 'dev-speak', today: 'Create a deck, then use Save as Template. Import and template chat continue through their existing Studio workflows when enabled.', launched: 'Create a deck, then use Save as Template. Import and template chat continue in Studio.' },
  { id: 'themes-helper-fonts', file: 'components/studio-libraries/themes-workspace.tsx', kind: 'dev-speak', today: 'Website extraction and AI theme chat are not connected in this workspace. Colors and fonts above are editable now.', launched: 'Colors and fonts above are editable.' },
  { id: 'themes-helper-colors', file: 'components/studio-libraries/themes-workspace.tsx', kind: 'dev-speak', today: 'Website extraction, font editing, and AI theme chat are not connected in this workspace. Colors above are editable now.', launched: 'Colors above are editable.' },
  // ---- Builder chrome
  { id: 'viewer-templates-title', file: 'components/presentation-viewer.tsx', kind: 'promise', today: 'Templates — coming soon', launched: 'Templates are not available' },
  { id: 'builder-templates-off', file: 'app/builder/page.tsx', kind: 'dev-speak', today: 'Templates are not enabled in this environment.', launched: "Templates aren't available right now." },
  { id: 'download-not-ready', file: 'components/presentation-download-controls.tsx', kind: 'dev-speak', today: 'Presentation not ready yet. Waiting for Stage 4 (strawman)...', launched: "Your presentation isn't ready to export." },
  // ---- Narration voice picker
  { id: 'narration-title', file: 'components/narration-voice-picker.tsx', kind: 'promise', today: 'selected, but not saved yet', launched: 'selected, but not saved' },
  { id: 'narration-toast', file: 'components/narration-voice-picker.tsx', kind: 'promise', today: 'Your voice choice is not saved yet. Choose it again when saving is available.', launched: 'Your voice choice was not saved. Choose it again later.' },
  { id: 'narration-recording', file: 'components/narration-voice-picker.tsx', kind: 'promise', today: "Recording is unavailable right now. Audio can't be saved, so nothing will be generated or charged. Try recording again when it is available.", launched: "Recording is unavailable right now. Audio can't be saved, so nothing will be generated or charged." },
  { id: 'narration-persistence', file: 'components/narration-voice-picker.tsx', kind: 'promise', today: "Your voice choice isn't saved yet. You can compare the voices; choose it again when saving is available.", launched: "Your voice choice isn't saved. You can compare the voices; choose it again later." },
]

/** Controls and blocks the flag greys out or removes (not words): the file, a pattern its source must contain, and what it does. */
export interface LaunchGreyed { id: string; file: string; pattern: string; what: string }

export const LAUNCH_GREYED: readonly LaunchGreyed[] = [
  { id: 'notifications-switches', file: 'app/(app)/settings/notifications/page.tsx', pattern: 'const disabled = LAUNCH_WORDING || !owner', what: 'the three notification switches are disabled and read off' },
  { id: 'notifications-switches-classic', file: 'app/(app)/settings/notifications/page.tsx', pattern: 'disabled={LAUNCH_WORDING || saving === row.key}', what: 'the same in the classic page' },
  { id: 'intelligence-readiness-trigger', file: 'components/studio-personal/intelligence-workspace.tsx', pattern: '{ disabled: true, title: "Personal models are not available"', what: 'the "Your own intelligence" trigger is disabled and says so' },
  { id: 'dashboard-folders', file: 'app/(app)/dashboard/page.tsx', pattern: '{!LAUNCH_WORDING && <div data-studio-deck-folders="true"', what: 'the Folders chips (every deck is in "general") are not drawn' },
  { id: 'dashboard-card', file: 'app/(app)/dashboard/page.tsx', pattern: "studioShell || LAUNCH_WORDING ? 'Outline previews'", what: 'the "AI Collaborations" card is the real "Outline previews" card' },
  { id: 'billing-planned-row', file: 'app/(app)/billing/page.tsx', pattern: ') : LAUNCH_WORDING ? null : (', what: 'the "AI Agent Interactions: Planned" row is not drawn' },
  { id: 'shortcuts-verified', file: 'app/(app)/shortcuts/page.tsx', pattern: '(process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true" || LAUNCH_WORDING)', what: 'the page lists only the shortcuts that have a handler' },
  { id: 'pending-timeline', file: 'app/auth/pending/page.tsx', pattern: '{!LAUNCH_WORDING && <div className="bg-blue-50', what: 'the "24-48 hours / email notification" box is not drawn' },
  { id: 'help-dead-links', file: 'app/help/page.tsx', pattern: '{!STUDIO_HELP && !LAUNCH_WORDING && <a href="#"', what: 'the two dead links (Discord, documentation) are not drawn' },
  { id: 'details-later-note', file: 'components/studio-personal/details-workspace.tsx', pattern: '{!LAUNCH_WORDING && <p className="sp-later-note">', what: 'the "optional later additions" line is not drawn' },
  { id: 'details-later-note-p2', file: 'components/studio-personal/studio-p2-details.tsx', pattern: '{!LAUNCH_WORDING && <p className="sp-later-note">', what: 'the same in the wired Your details page' },
  { id: 'narration-plain', file: 'components/narration-voice-picker.tsx', pattern: "STUDIO_NARRATION || LAUNCH_WORDING ? 'Voice samples are unavailable right now.", what: 'the plain voice-sample warning replaces the one that names an environment variable' },
]

/** Words a launched sentence must not contain: a promise, a date, a version, or developer-speak. */
export const LAUNCH_FORBIDDEN: RegExp = /\b(?:soon|coming|planned|future release|yet|later additions|prototype|candidate|not connected|ships?|when enabled|if enabled|in this environment|in this build|v\d+\.\d+)\b/i

/** The text for `id`: today's with the flag off (anything but the exact string "true"), the launched text with it on. An unknown id gives ''. */
export function launchWord(id: string, flag: unknown): string {
  const word = LAUNCH_WORDS.find(item => item.id === id)
  if (!word) return ''
  return flag === 'true' ? word.launched : word.today
}
