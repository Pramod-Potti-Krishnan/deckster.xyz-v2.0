// FRONTEND-2: the registry of LATER changes in the Studio stack, the ones that come after bulk edit + chat undo (a branch merged on top of it, or stacked above it) and that the older pins cannot know about.
// Plain node, nothing is read from disk or git here. Three things about a later change make an older pin fail, and this file answers all three in one place so that no older test has to be edited for each new change:
//   1. SCOPE. Several pins read the COMMITTED diff (BASE..HEAD) and refuse any file that is not their change's, a stacked change's, a strip root or a pin they taught. A later change's files are in that diff.
//      Those scope checks skip every file in LATER_CHANGE_FILES (and only there: a file that is in no list is still a stray).
//   2. .env.example. A pin that holds .env.example to an earlier commit, with its own block (and the blocks stacked on it) taken out, sees a later change's block as an extra. stripLaterEnvBlocks(rel, text) takes each
//      registered block out (the block and the one blank line that separates it from its neighbour) wherever it sits; any other file is returned as it is.
//   3. CODE LINES. A pin that holds an app file (the Decks page, the Builder page, the viewer, the hook ...) to an earlier commit, "without this change's lines it is the base's file", sees the lines a later change added.
//      LATER_STRIPS holds one strip per later change, (rel, text) => text, exactly the function the change's own strip module exports (stripFirstPaint, stripDeckCardThumbnail ...).
// stripLaterChanges(rel, text) is what a pin calls, INNERMOST in its read (before every older strip): it applies every registered strip in order, then stripLaterEnvBlocks. The older pins already reach it with no edit of
// their own: scripts/studio-bulk-edit-undo-strip.mjs (stripBulkEditUndo) calls it first, and the three shared strip roots (open-read-only, dark-persist, add-slide-status) call stripBulkEditUndo innermost.
//
// HOW A LATER CHANGE REGISTERS (three lines, one in each list below, no test edit). Each line carries the marker "LATER-CHANGE". Name the change's own strip module with a dynamic import, so that the registration is those
// lines and nothing else (no import line; a top-level await is fine in an .mjs), for example
//   LATER_CHANGE_FILES   ...(await import('./studio-example-strip.mjs')).EXAMPLE_SCOPE_FILES, // LATER-CHANGE: <who>, <what> (<FLAG>)    every file its commit touches: code, new files, the pins it taught, package.json
//   LATER_ENV_BLOCKS     (await import('./studio-example-strip.mjs')).EXAMPLE_ENV_BLOCK, // LATER-CHANGE: <who>, <what> (<FLAG>)         the exact text of its .env.example block (leave the line out when it adds none)
//   LATER_STRIPS         (await import('./studio-example-strip.mjs')).stripExample, // LATER-CHANGE: <who>, <what> (<FLAG>)             its (rel, text) => text strip (leave the line out when it adds no line to an older file)
// An env block may carry its leading and trailing blank lines or not; it is matched on its own lines, at the start of a line, and it must be the whole block (a partial match is not a block and is left alone).
// A strip must return its text untouched for a file it does not own, and must not need the strips of older changes to have run (the registry runs first). Until a change is merged, its lines stay out of this file
// (scripts/test-studio-bulk-edit-undo.mjs and scripts/test-studio-later-changes.mjs prove the registry with a made-up change that is never committed).
//
// All three lists are empty when nothing is stacked after bulk edit + chat undo, and then nothing here changes anything: stripLaterChanges returns its text as it was given, for every file.

export const LATER_CHANGE_FILES = new Set([
  ...(await import('./studio-first-paint-strip.mjs')).FIRST_PAINT_SCOPE_FILES, // LATER-CHANGE: COMPOSER-2, studio first paint (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED)
  ...(await import('./studio-deck-card-thumbnail-strip.mjs')).DECK_CARD_THUMBNAIL_SCOPE_FILES, // LATER-CHANGE: COMPOSER-2, deck card thumbnails (NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED)
  ...(await import('./studio-chat-undo-v2-strip.mjs')).CHAT_UNDO_V2_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, chat undo v2 (NEXT_PUBLIC_STUDIO_CHAT_UNDO; no .env.example block)
  ...(await import('./studio-pass3-polish-strip.mjs')).PASS3_POLISH_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR A (NEXT_PUBLIC_STUDIO_PASS3_POLISH)
  ...(await import('./studio-pass3-polish-b-strip.mjs')).PASS3_POLISH_B_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR B (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)
  ...(await import('./studio-pass3-polish-c-strip.mjs')).PASS3_POLISH_C_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR C (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)
  ...(await import('./studio-pass3-polish-d-strip.mjs')).PASS3_POLISH_D_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR D (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)
  ...(await import('./studio-bulk-edit-prompt-text-strip.mjs')).BULK_EDIT_PROMPT_TEXT_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, bulk edit prompt text (NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT)
  ...(await import('./studio-pass3-polish-e-strip.mjs')).PASS3_POLISH_E_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR E (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)
  ...(await import('./studio-d1-debug-routes-strip.mjs')).D1_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, D1 security hotfix: debug env routes removed, cleanup-sessions dry run gated (no flag: PK's ruling; no .env.example block)
  ...(await import('./studio-pass3-polish-f-strip.mjs')).PASS3_POLISH_F_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR F (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)
  ...(await import('./studio-legal-short-links-strip.mjs')).LEGAL_SHORT_LINKS_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, legal short links and the marketing-slide cache header from uat, D16 a (NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS)
  ...(await import('./studio-pass3-polish-g-strip.mjs')).PASS3_POLISH_G_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR G (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)
  ...(await import('./studio-phone-shell-nav-strip.mjs')).PHONE_SHELL_NAV_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, phone shell 1, the bottom tab bar on phones (NEXT_PUBLIC_STUDIO_PHONE_SHELL)
  ...(await import('./studio-phone-shell-builder-top-strip.mjs')).PHONE_SHELL_TOP_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, phone shell 2, the Builder top on phones and the Director dot (NEXT_PUBLIC_STUDIO_PHONE_SHELL; no .env.example block of its own: the flag's block is PR 1's)
  ...(await import('./studio-speed-perceived-strip.mjs')).SPEED_PERCEIVED_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, Studio perceived speed: the typed message echo (NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED)
  ...(await import('./studio-flow-control-strip.mjs')).FLOW_CONTROL_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, P3-1 D flow control, Studio half: the stage follows the build, steer a paused build (NEXT_PUBLIC_STUDIO_FLOW_FOCUS / _FLOW_AMEND / _FLOW_AMEND_INSTRUCTIONS)
  ...(await import('./studio-arrange-strip.mjs')).STUDIO_ARRANGE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, Arrange works in the Studio inspector, selecting no longer raises (NEXT_PUBLIC_STUDIO_ARRANGE)
  ...(await import('./studio-model-choice-strip.mjs')).MODEL_CHOICE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, P3-10 model choice: the Intelligence picker uses the live model catalogue (NEXT_PUBLIC_STUDIO_MODEL_CHOICE)
  ...(await import('./studio-model-slider-strip.mjs')).MODEL_SLIDER_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, P3-10 model choice, the slider variant of the composer picker, stacked on the line above (NEXT_PUBLIC_STUDIO_MODEL_CHOICE; no .env.example block, no strip of its own)
  ...(await import('./studio-model-five-strip.mjs')).MODEL_FIVE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, P3-10 model choice, five presets (Quick, Fast, Balanced, Best, Max) on the slider and the compact picker, on dev after the line above (NEXT_PUBLIC_STUDIO_MODEL_CHOICE; no .env.example block, no strip of its own)
  ...(await import('./studio-chat-clean-strip.mjs')).CHAT_CLEAN_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, P3-1 C chat clean v3: the Director chat as one thread, the job card inline, Send <-> Stop and the slim Continue bar (NEXT_PUBLIC_STUDIO_CHAT_CLEAN)
  ...(await import('./studio-chat-element-edit-strip.mjs')).CHAT_ELEMENT_EDIT_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, chat element edit and notes refresh (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT)
  ...(await import('./studio-chat-commands-strip.mjs')).CHAT_COMMANDS_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, P3-1 A chat parity: the composer's "/" commands and "@" mentions on chat clean (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS)
  ...(await import('./studio-deck-sync-truth-strip.mjs')).DECK_SYNC_TRUTH_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B26 deck sync truth: the true slide count and no false "another tab" after chat edits (NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH)
  ...(await import('./studio-build-failure-end-strip.mjs')).BUILD_FAILURE_END_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B27 build failure end: Studio leaves "Building..." when Director's turn ends with a reply and no build frame (NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END)
  ...(await import('./studio-paused-label-strip.mjs')).PAUSED_LABEL_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B27 paused label: the build ribbon reads "Paused" while the control state is paused (NEXT_PUBLIC_STUDIO_PAUSED_LABEL)
  ...(await import('./studio-chat-parity-strip.mjs')).CHAT_PARITY_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, P3-1 A chat parity, Studio half: studio_action / studio_action_result (NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES / _IDENTITY / _TEMPLATES)
  ...(await import('./studio-chat-element-edit-2-strip.mjs')).CHAT_ELEMENT_EDIT_2_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B32 chat element edit 2: an edit works after a reload and no stale element reference (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2)
  ...(await import('./studio-model-choice-deck-save-strip.mjs')).MODEL_CHOICE_DECK_SAVE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B37 model choice deck save: a presentation's model choice saves, and "Saved" shows only when it did (NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE)
  ...(await import('./studio-chat-clean-order-strip.mjs')).CHAT_CLEAN_ORDER_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B31 clean chat order: no stale working line at the outline gate, the thread's notes where they happened (NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER)
  ...(await import('./studio-model-choice-prefs-version-strip.mjs')).MODEL_CHOICE_PREFS_VERSION_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B37 follow-up model choice prefs version: the save's version travels in its own header (NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION)
  ...(await import('./studio-theme-own-choice-strip.mjs')).THEME_OWN_CHOICE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B34 theme own choice: after a reload Studio keeps the user's own theme, not Director's resolved preset (NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE)
  ...(await import('./studio-chat-edit-targeted-strip.mjs')).CHAT_EDIT_TARGETED_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B33 targeted chat edit: a chat element edit saves only that element (NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE)
  ...(await import('./studio-chat-clean-held-all-built-strip.mjs')).HELD_ALL_BUILT_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B40 held all built: after a Stop with every slide built, a typed message is a plain message, not new directions (NEXT_PUBLIC_STUDIO_CHAT_CLEAN_HELD_ALL_BUILT)
  ...(await import('./studio-chat-add-targeted-strip.mjs')).CHAT_ADD_TARGETED_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B42 targeted chat add: a chat element add saves only the new element (NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE)
  ...(await import('./studio-chat-stale-viewer-guard-strip.mjs')).CHAT_STALE_VIEWER_GUARD_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B43 stale viewer guard: a chat add or edit after a chat deck change lands on the right slide or says so (NEXT_PUBLIC_STUDIO_CHAT_STALE_VIEWER_GUARD)
  ...(await import('./studio-deck-save-refused-strip.mjs')).DECK_SAVE_REFUSED_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B46 deck save refused: when Layout refuses a stale whole-deck save Studio shows its existing "This deck was updated" notice (NEXT_PUBLIC_STUDIO_DECK_SAVE_REFUSED_NOTICE)
  ...(await import('./studio-mdc-element-fields-strip.mjs')).MDC_ELEMENT_FIELDS_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B44 MDC element fields: a chat label or shape add uses the Director's label text / shape type, as the Element panel does (NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS)
  ...(await import('./studio-chat-add-stacking-strip.mjs')).CHAT_ADD_STACKING_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B48 chat add stacking: a chat-added element lands on top like an Element panel add, so it can be selected (NEXT_PUBLIC_STUDIO_CHAT_ADD_STACKING)
  ...(await import('./studio-chat-element-text-set-strip.mjs')).CHAT_ELEMENT_TEXT_SET_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B49 chat text set: a chat 'Change this to ...' on a selected text box sets exactly those words (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET)
  ...(await import('./studio-chat-refine-structural-decline-strip.mjs')).CHAT_REFINE_STRUCTURAL_DECLINE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B50 structural refine decline: a chat refine of a title-type text box declines honestly instead of rewriting it from the instruction (NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE)
  ...(await import('./studio-chat-text-set-keep-look-strip.mjs')).CHAT_TEXT_SET_KEEP_LOOK_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B49b text set keep look: a chat exact-text set keeps the text box's look, so a title stays a title (NEXT_PUBLIC_STUDIO_CHAT_TEXT_SET_KEEP_LOOK)
  ...(await import('./studio-welcome-trim-strip.mjs')).WELCOME_TRIM_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B51 welcome trim and Director mark trim: the first-run welcome loses its extra copy and Director's greeting, and the old star can go (NEXT_PUBLIC_STUDIO_WELCOME_TRIM / NEXT_PUBLIC_STUDIO_DIRECTOR_MARK_TRIM)
  ...(await import('./studio-chat-column-wide-strip.mjs')).CHAT_COLUMN_WIDE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B51 chat column wide (F-10): the first-run welcome column is about 44% of the window, and the shared column tokens are defined (NEXT_PUBLIC_STUDIO_CHAT_COLUMN_WIDE)
  ...(await import('./studio-stage-open-gate-strip.mjs')).STAGE_OPEN_GATE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B52 stage open gate: the chat stays full-width through Director's clarifying questions; the stage opens on the strawman or build, a ready deck or an explicit ask (NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE)
  ...(await import('./studio-strawman-stage-strip.mjs')).STRAWMAN_STAGE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, F-04/F-05/F-07 strawman stage: the stage is the deck viewer showing Director's strawman preview deck, each slide's plan under it, the slide kept across the swap (NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE)
  ...(await import('./studio-strawman-chat-strip.mjs')).STRAWMAN_CHAT_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, strawman chat: no slide list in the chat outline card, no progress card, one quiet status line while the stage is hidden (NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT)
  ...(await import('./studio-template-match-strip.mjs')).STUDIO_TEMPLATE_MATCH_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, W2 P4-7/8 template match: Studio shows the template Director applied, with Change / Undo, source chips and an auto-apply check (NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH)
  ...(await import('./studio-phone-landscape-strip.mjs')).PHONE_LANDSCAPE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, F-13 phone landscape (PR 1): a phone turned sideways gets a viewing stage with a hamburger and a plus (NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE)
  ...(await import('./studio-phone-hints-strip.mjs')).PHONE_HINTS_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, F-13 phone hints (PR 2): the portrait rotate card, swipe to change slide, Full screen (NEXT_PUBLIC_STUDIO_PHONE_HINTS)
  ...(await import('./studio-tier-update-guard-strip.mjs')).TIER_GUARD_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, security P0 H4-01: server-side tier/entitlement only (no flag: security; no .env.example block)
  ...(await import('./studio-template-proof-order-strip.mjs')).TEMPLATE_PROOF_ORDER_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, #587 template-match proof order (tests only): the proof undoes later changes before its own put-back
  ...(await import('./studio-phone-shell-coverage-strip.mjs')).PHONE_SHELL_COVERAGE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B58 phone shell coverage: on a phone Help and the builder load-error screen draw the bottom tab bar (NEXT_PUBLIC_STUDIO_PHONE_SHELL_COVERAGE)
  ...(await import('./studio-ux-honesty-strip.mjs')).UX_HONESTY_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, UX honesty (no flag) + UX-09 page headings (NEXT_PUBLIC_STUDIO_PAGE_HEADINGS)
  ...(await import('./studio-prepromo-strip.mjs')).PREPROMO_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, pre-promotion fixes C-07 / C-06 / UX-01 (no flag: security and honesty fixes apply everywhere; no .env.example block)
  ...(await import('./studio-proofs-after-merge-strip.mjs')).PROOFS_AFTER_MERGE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, older proofs robust after merge (tests only): #475 narration-router reads its siblings, #521 model-choice its route set, at their own heads
  ...(await import('./studio-phone-polish-strip.mjs')).PHONE_POLISH_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B59 phone polish: the More sheet's hint and Escape, the landscape buttons clear of the page number (NEXT_PUBLIC_STUDIO_PHONE_POLISH)
  ...(await import('./studio-model-picker-simple-strip.mjs')).MODEL_PICKER_SIMPLE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, F-14 simplified model picker: the composer's slider picker as a calmer popover or phone sheet, the preset's name, the router's writing model, a reset icon (NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE)
  ...(await import('./studio-billing-security-strip.mjs')).BILLING_SECURITY_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1 for PROGRAM-1, billing security B4-B9: webhook claim in one transaction, price-mapped tier, coupon claim (STUDIO_BILLING_COUPON_TIER_HARDENING)
  ...(await import('./studio-api-hardening-strip.mjs')).API_HARDENING_SCOPE_FILES, // LATER-CHANGE: PROGRAM-1, Studio API hardening v1: approved-user gate, session owners, body allow-lists, unlock lockout, spoken-answer cache, admin = ADMIN_EMAILS (users, coupons, cleanup-sessions, /admin); activate id fix (STUDIO_API_HARDENING_V1_ENABLED / ADMIN_EMAILS)
  ...(await import('./studio-redeem-v4-strip.mjs')).REDEEM_V4_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B60 redeem v4: /redeem in the Studio v4 frame, same words and request (NEXT_PUBLIC_STUDIO_REDEEM_V4)
  ...(await import('./studio-billing-f4-f6-strip.mjs')).BILLING_F4F6_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, L-BILLING F4 debit switch + F6 single price source (WALLET_DEBIT_SOURCE)
  ...(await import('./studio-billing-f5-usage-strip.mjs')).BILLING_F5_USAGE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, L-BILLING F5 quota and refusal screens + Usage page (NEXT_PUBLIC_STUDIO_USAGE_PAGE)
  ...(await import('./studio-usage-credits-strip.mjs')).USAGE_CREDITS_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B62 usage credits: Studio's server read of the Model Router's usage read API and a credits view for the Usage page (NEXT_PUBLIC_STUDIO_USAGE_CREDITS)
  ...(await import('./studio-chat-caps-strip.mjs')).CHAT_CAPS_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B61 chat caps: C-D1's Studio reader, Director's sync chat_capabilities read into a read-only snapshot (NEXT_PUBLIC_STUDIO_CHAT_CAPS_META)
  ...(await import('./studio-chain-test-fix-strip.mjs')).CHAIN_TEST_FIX_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, Option L chain test fix (tests only)
  ...(await import('./studio-usage-credits-page-strip.mjs')).USAGE_CREDITS_PAGE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B63 usage credits page: the credits view on FRONTEND-1's Usage page, two marked lines (no flag of its own: NEXT_PUBLIC_STUDIO_USAGE_CREDITS is B62's; no .env.example block)
  ...(await import('./studio-voice-core-strip.mjs')).VOICE_CORE_SCOPE_FILES, // LATER-CHANGE: ELEMENT-3, pure Director voice core (NEXT_PUBLIC_STUDIO_VOICE_CALL)
  ...(await import('./studio-voice-call-strip.mjs')).VOICE_CALL_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, W6 P4-20 voice call UI: the call button, the docked companion, push-to-talk, the router speech contract (NEXT_PUBLIC_STUDIO_VOICE_CALL / _VOICE_COMPANION)
  ...(await import('./studio-agent-mode-shell-strip.mjs')).AGENT_MODE_SHELL_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B69 agent mode shell: Studio's build-mode picker and the Agent build cards, new files only, nothing mounted (NEXT_PUBLIC_AGENT_MODE / NEXT_PUBLIC_AUTHOR_MODE_PICKER)
  ...(await import('./studio-page-consistency-strip.mjs')).PAGE_CONSISTENCY_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, UX-07 / UX-10 Billing and Settings on the Studio shell, one create label (NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY)
  ...(await import('./studio-restack-ux-pc-proofs-strip.mjs')).RESTACK_UX_PC_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, restack of FRONTEND-1's page consistency: older proofs read the later changes right after the merge onto newer dev (tests only)
  ...(await import('./studio-billing-l5-strip.mjs')).BILLING_L5_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B67 L-BILLING Studio half: Plan & credits UI, F3 entitlement push, F4 meter receiver; new files only, owners' lines are drafts (NEXT_PUBLIC_STUDIO_BILLING_PLANS / STUDIO_ROUTER_ENTITLEMENTS_PUSH / STUDIO_METER_RECEIVER_ENABLED)
  ...(await import('./studio-avatar-spawn-strip.mjs')).AVATAR_SPAWN_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B66 AVATAR-SPAWN: the Studio 'Create my avatar' create / pick / delete mock at /studio/companions, new files only, no network (NEXT_PUBLIC_STUDIO_AVATAR_SPAWN)
  ...(await import('./studio-ws-bq-claim-strip.mjs')).WS_BQ_CLAIM_SCOPE_FILES, // LATER-CHANGE: OPS-2, J8.1 WS token bq claim (DECKSTER_WS_BQ_CLAIM_ENABLED)
  ...(await import('./studio-agent-mode-wire-strip.mjs')).AGENT_MODE_WIRE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, Agent mode wire: the picker, the agent frames and the card answer mounted in the Studio, stacked on the Agent build shell (NEXT_PUBLIC_AGENT_MODE and NEXT_PUBLIC_STUDIO_V4_SHELL; no .env.example block of its own: the flag's block is the shell's)
  ...(await import('./studio-brand-kit-strip.mjs')).BRAND_KIT_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, Brand Kit caller: colour suggestions from a logo, the kit form, the brand record proxy and the signed theme proxies (NEXT_PUBLIC_STUDIO_BRAND_KIT)
  ...(await import('./studio-audit-present-exit-strip.mjs')).AUDIT_PRESENT_EXIT_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, audit P-17, Present Exit leaves Present when the browser is not full screen (NEXT_PUBLIC_STUDIO_PRESENT_EXIT_FIX)
  ...(await import('./studio-audit-console-strip.mjs')).AUDIT_CONSOLE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, audit P-30 / P-32, no analytics script request where none is served, an honest first Decks tab (NEXT_PUBLIC_STUDIO_ANALYTICS_GATE / NEXT_PUBLIC_STUDIO_ANALYTICS_SERVED / NEXT_PUBLIC_STUDIO_DECK_TABS_HONEST)
  ...(await import('./studio-audit-previews-strip.mjs')).AUDIT_PREVIEWS_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, audit P-01 / P-07 / P-29, deck cards and Duplicate for a deck that exists on this Layout, the slide list and a live Publish preview when the inventory route is absent (NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME / NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK)
  ...(await import('./studio-thumbnail-proof-speed-strip.mjs')).THUMBNAIL_PROOF_SPEED_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, thumbnail-last-good proof speed-up (tests only)
  ...(await import('./studio-chat-parity-viewer-strip.mjs')).CHAT_PARITY_VIEWER_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, overnight chat parity, viewer slash commands: /goto /next /prev /blank-slide /layout /present /edit /view /rail /grid /borders /save /discard /version /canvas and /theme <preset> (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS; no flag of its own, no .env.example block)
  ...(await import('./studio-chat-parity-workspace-strip.mjs')).CHAT_PARITY_WORKSPACE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, overnight chat parity, workspace slash commands: /kg /template /template-mode /notes /dark /light /system /intro /pane /history (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS; no flag of its own, no .env.example block)
  ...(await import('./studio-chat-parity-more-strip.mjs')).CHAT_PARITY_MORE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, overnight chat parity, the remaining slash commands: /delete-theme /delete-template /model <choice> /kg-search /ask /switch-template, /publish opening the wizard and an @template that chooses it (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS; no flag of its own, no .env.example block)
  ...(await import('./studio-owner-cuid-strip.mjs')).OWNER_CUID_SCOPE_FILES, // LATER-CHANGE: KNOWLEDGE, K-02 chat upload owner = user.id cuid (NEXT_PUBLIC_STUDIO_OWNER_CUID_ENABLED)
  ...(await import('./studio-upload-session-token-strip.mjs')).UPLOAD_SESSION_TOKEN_SCOPE_FILES, // LATER-CHANGE: KNOWLEDGE-3, DSB-5a upload session token: the browser's Researcher upload calls carry a signed session token from a same-origin mint route (NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED)
  ...(await import('./studio-connectors-gdrive-strip.mjs')).CONNECTORS_GDRIVE_SCOPE_FILES, // LATER-CHANGE: KNOWLEDGE, P4-15 slice 1 Google Drive picker connector (NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED)
  // one line per later change, above this comment
])

export const LATER_ENV_BLOCKS = [
  (await import('./studio-first-paint-strip.mjs')).FIRST_PAINT_ENV_BLOCK, // LATER-CHANGE: COMPOSER-2, studio first paint (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED)
  (await import('./studio-deck-card-thumbnail-strip.mjs')).DECK_CARD_THUMBNAIL_ENV_BLOCK, // LATER-CHANGE: COMPOSER-2, deck card thumbnails (NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED)
  (await import('./studio-pass3-polish-strip.mjs')).PASS3_POLISH_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR A (NEXT_PUBLIC_STUDIO_PASS3_POLISH)
  (await import('./studio-bulk-edit-prompt-text-strip.mjs')).BULK_EDIT_PROMPT_TEXT_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, bulk edit prompt text (NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT)
  (await import('./studio-legal-short-links-strip.mjs')).LEGAL_SHORT_LINKS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, legal short links and the marketing-slide cache header from uat, D16 a (NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS)
  (await import('./studio-phone-shell-nav-strip.mjs')).PHONE_SHELL_NAV_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, phone shell 1, the bottom tab bar on phones (NEXT_PUBLIC_STUDIO_PHONE_SHELL)
  (await import('./studio-speed-perceived-strip.mjs')).SPEED_PERCEIVED_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, Studio perceived speed: the typed message echo (NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED)
  (await import('./studio-flow-control-strip.mjs')).FLOW_CONTROL_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, P3-1 D flow control, Studio half (NEXT_PUBLIC_STUDIO_FLOW_FOCUS / _FLOW_AMEND / _FLOW_AMEND_INSTRUCTIONS)
  (await import('./studio-arrange-strip.mjs')).STUDIO_ARRANGE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, Arrange works in the Studio inspector, selecting no longer raises (NEXT_PUBLIC_STUDIO_ARRANGE)
  (await import('./studio-model-choice-strip.mjs')).MODEL_CHOICE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, P3-10 model choice: the Intelligence picker uses the live model catalogue (NEXT_PUBLIC_STUDIO_MODEL_CHOICE)
  (await import('./studio-chat-clean-strip.mjs')).CHAT_CLEAN_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, P3-1 C chat clean v3 (NEXT_PUBLIC_STUDIO_CHAT_CLEAN)
  (await import('./studio-chat-element-edit-strip.mjs')).CHAT_ELEMENT_EDIT_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, chat element edit and notes refresh (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT)
  (await import('./studio-chat-commands-strip.mjs')).CHAT_COMMANDS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, P3-1 A chat parity (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS)
  (await import('./studio-deck-sync-truth-strip.mjs')).DECK_SYNC_TRUTH_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B26 deck sync truth: the true slide count and no false "another tab" after chat edits (NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH)
  (await import('./studio-build-failure-end-strip.mjs')).BUILD_FAILURE_END_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B27 build failure end (NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END)
  (await import('./studio-paused-label-strip.mjs')).PAUSED_LABEL_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B27 paused label (NEXT_PUBLIC_STUDIO_PAUSED_LABEL)
  (await import('./studio-chat-parity-strip.mjs')).CHAT_PARITY_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, P3-1 A chat parity, Studio half (NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES / _IDENTITY / _TEMPLATES)
  (await import('./studio-chat-element-edit-2-strip.mjs')).CHAT_ELEMENT_EDIT_2_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B32 chat element edit 2 (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2)
  (await import('./studio-model-choice-deck-save-strip.mjs')).MODEL_CHOICE_DECK_SAVE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B37 model choice deck save (NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE)
  (await import('./studio-chat-clean-order-strip.mjs')).CHAT_CLEAN_ORDER_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B31 clean chat order (NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER)
  (await import('./studio-model-choice-prefs-version-strip.mjs')).MODEL_CHOICE_PREFS_VERSION_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B37 follow-up model choice prefs version (NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION)
  (await import('./studio-theme-own-choice-strip.mjs')).THEME_OWN_CHOICE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B34 theme own choice (NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE)
  (await import('./studio-chat-edit-targeted-strip.mjs')).CHAT_EDIT_TARGETED_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B33 targeted chat edit (NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE)
  (await import('./studio-chat-clean-held-all-built-strip.mjs')).HELD_ALL_BUILT_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B40 held all built (NEXT_PUBLIC_STUDIO_CHAT_CLEAN_HELD_ALL_BUILT)
  (await import('./studio-chat-add-targeted-strip.mjs')).CHAT_ADD_TARGETED_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B42 targeted chat add (NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE)
  (await import('./studio-chat-stale-viewer-guard-strip.mjs')).CHAT_STALE_VIEWER_GUARD_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B43 stale viewer guard (NEXT_PUBLIC_STUDIO_CHAT_STALE_VIEWER_GUARD)
  (await import('./studio-deck-save-refused-strip.mjs')).DECK_SAVE_REFUSED_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B46 deck save refused (NEXT_PUBLIC_STUDIO_DECK_SAVE_REFUSED_NOTICE)
  (await import('./studio-mdc-element-fields-strip.mjs')).MDC_ELEMENT_FIELDS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B44 MDC element fields (NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS)
  (await import('./studio-chat-add-stacking-strip.mjs')).CHAT_ADD_STACKING_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B48 chat add stacking (NEXT_PUBLIC_STUDIO_CHAT_ADD_STACKING)
  (await import('./studio-chat-element-text-set-strip.mjs')).CHAT_ELEMENT_TEXT_SET_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B49 chat text set (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET)
  (await import('./studio-chat-refine-structural-decline-strip.mjs')).CHAT_REFINE_STRUCTURAL_DECLINE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B50 structural refine decline (NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE)
  (await import('./studio-chat-text-set-keep-look-strip.mjs')).CHAT_TEXT_SET_KEEP_LOOK_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B49b text set keep look (NEXT_PUBLIC_STUDIO_CHAT_TEXT_SET_KEEP_LOOK)
  (await import('./studio-welcome-trim-strip.mjs')).WELCOME_TRIM_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B51 welcome trim and Director mark trim (NEXT_PUBLIC_STUDIO_WELCOME_TRIM / NEXT_PUBLIC_STUDIO_DIRECTOR_MARK_TRIM)
  (await import('./studio-chat-column-wide-strip.mjs')).CHAT_COLUMN_WIDE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B51 chat column wide (NEXT_PUBLIC_STUDIO_CHAT_COLUMN_WIDE)
  (await import('./studio-stage-open-gate-strip.mjs')).STAGE_OPEN_GATE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B52 stage open gate (NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE)
  (await import('./studio-strawman-stage-strip.mjs')).STRAWMAN_STAGE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, F-04/F-05/F-07 strawman stage (NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE)
  (await import('./studio-strawman-chat-strip.mjs')).STRAWMAN_CHAT_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, strawman chat (NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT)
  (await import('./studio-template-match-strip.mjs')).STUDIO_TEMPLATE_MATCH_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, W2 P4-7/8 template match (NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH)
  (await import('./studio-phone-landscape-strip.mjs')).PHONE_LANDSCAPE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, F-13 phone landscape, PR 1 (NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE)
  (await import('./studio-phone-hints-strip.mjs')).PHONE_HINTS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, F-13 phone hints, PR 2 (NEXT_PUBLIC_STUDIO_PHONE_HINTS)
  (await import('./studio-phone-shell-coverage-strip.mjs')).PHONE_SHELL_COVERAGE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B58 phone shell coverage (NEXT_PUBLIC_STUDIO_PHONE_SHELL_COVERAGE)
  (await import('./studio-ux-honesty-strip.mjs')).PAGE_HEADINGS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, UX-09 page headings (NEXT_PUBLIC_STUDIO_PAGE_HEADINGS)
  (await import('./studio-phone-polish-strip.mjs')).PHONE_POLISH_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B59 phone polish (NEXT_PUBLIC_STUDIO_PHONE_POLISH)
  (await import('./studio-model-picker-simple-strip.mjs')).MODEL_PICKER_SIMPLE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, F-14 simplified model picker (NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE)
  (await import('./studio-billing-security-strip.mjs')).BILLING_SECURITY_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1 for PROGRAM-1, billing security B4-B9: webhook claim in one transaction, price-mapped tier, coupon claim (STUDIO_BILLING_COUPON_TIER_HARDENING)
  (await import('./studio-api-hardening-strip.mjs')).API_HARDENING_ENV_BLOCK, // LATER-CHANGE: PROGRAM-1, Studio API hardening v1 (STUDIO_API_HARDENING_V1_ENABLED / ADMIN_EMAILS)
  (await import('./studio-redeem-v4-strip.mjs')).REDEEM_V4_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B60 redeem v4 (NEXT_PUBLIC_STUDIO_REDEEM_V4)
  (await import('./studio-billing-f4-f6-strip.mjs')).BILLING_F4F6_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, L-BILLING F4 debit switch + F6 single price source (WALLET_DEBIT_SOURCE)
  (await import('./studio-billing-f5-usage-strip.mjs')).BILLING_F5_USAGE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, L-BILLING Usage page (NEXT_PUBLIC_STUDIO_USAGE_PAGE)
  (await import('./studio-billing-f5-usage-strip.mjs')).BILLING_F5_QUOTA_SCREENS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, L-BILLING F5 quota and refusal screens (NEXT_PUBLIC_STUDIO_QUOTA_SCREENS)
  (await import('./studio-usage-credits-strip.mjs')).USAGE_CREDITS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B62 usage credits (NEXT_PUBLIC_STUDIO_USAGE_CREDITS / MODEL_ROUTER_USAGE_READ_KEY)
  (await import('./studio-chat-caps-strip.mjs')).CHAT_CAPS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B61 chat caps (NEXT_PUBLIC_STUDIO_CHAT_CAPS_META)
  (await import('./studio-voice-core-strip.mjs')).VOICE_CORE_ENV_BLOCK, // LATER-CHANGE: ELEMENT-3, Director voice opt-in
  (await import('./studio-voice-call-strip.mjs')).VOICE_CALL_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, W6 P4-20 voice call UI (NEXT_PUBLIC_STUDIO_VOICE_COMPANION; the call flag's own line is ELEMENT-3's)
  (await import('./studio-agent-mode-shell-strip.mjs')).AGENT_MODE_SHELL_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B69 agent mode shell (NEXT_PUBLIC_AGENT_MODE / NEXT_PUBLIC_AUTHOR_MODE_PICKER)
  (await import('./studio-page-consistency-strip.mjs')).PAGE_CONSISTENCY_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, UX-07 / UX-10 page consistency (NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY)
  (await import('./studio-billing-l5-strip.mjs')).BILLING_L5_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B67 L-BILLING Studio half (NEXT_PUBLIC_STUDIO_BILLING_PLANS / STUDIO_ROUTER_ENTITLEMENTS_PUSH / STUDIO_METER_RECEIVER_ENABLED / METER_RECEIVER_MODE / ROUTER_ENTITLEMENTS_API_KEY / METER_WEBHOOK_SECRET)
  (await import('./studio-avatar-spawn-strip.mjs')).AVATAR_SPAWN_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B66 AVATAR-SPAWN (NEXT_PUBLIC_STUDIO_AVATAR_SPAWN)
  (await import('./studio-ws-bq-claim-strip.mjs')).WS_BQ_CLAIM_ENV_BLOCK, // LATER-CHANGE: OPS-2, J8.1 WS token bq claim (DECKSTER_WS_BQ_CLAIM_ENABLED)
  (await import('./studio-brand-kit-strip.mjs')).BRAND_KIT_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, Brand Kit caller (NEXT_PUBLIC_STUDIO_BRAND_KIT / THEME_BUILDER_BRAND_EXTRACT_KEY / STUDIO_BRAND_EXTRACT_DAILY_CAP)
  (await import('./studio-audit-present-exit-strip.mjs')).AUDIT_PRESENT_EXIT_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, audit P-17, Present Exit leaves Present when the browser is not full screen (NEXT_PUBLIC_STUDIO_PRESENT_EXIT_FIX)
  (await import('./studio-audit-console-strip.mjs')).AUDIT_CONSOLE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, audit P-30 / P-32, no analytics script request where none is served, an honest first Decks tab (NEXT_PUBLIC_STUDIO_ANALYTICS_GATE / NEXT_PUBLIC_STUDIO_ANALYTICS_SERVED / NEXT_PUBLIC_STUDIO_DECK_TABS_HONEST)
  (await import('./studio-audit-previews-strip.mjs')).AUDIT_PREVIEWS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, audit P-01 / P-07 / P-29, deck cards and Duplicate for a deck that exists on this Layout, the slide list and a live Publish preview when the inventory route is absent (NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME / NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK)
  (await import('./studio-chat-parity-viewer-strip.mjs')).CHAT_PARITY_COMMANDS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, overnight chat parity, the one flag of the chain (NEXT_PUBLIC_STUDIO_CHAT_PARITY_COMMANDS)
  (await import('./studio-owner-cuid-strip.mjs')).OWNER_CUID_ENV_BLOCK, // LATER-CHANGE: KNOWLEDGE, K-02 chat upload owner = user.id cuid (NEXT_PUBLIC_STUDIO_OWNER_CUID_ENABLED)
  (await import('./studio-upload-session-token-strip.mjs')).UPLOAD_SESSION_TOKEN_ENV_BLOCK, // LATER-CHANGE: KNOWLEDGE-3, DSB-5a upload session token (NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED)
  (await import('./studio-connectors-gdrive-strip.mjs')).CONNECTORS_GDRIVE_ENV_BLOCK, // LATER-CHANGE: KNOWLEDGE, P4-15 slice 1 Google Drive picker connector (NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED)
  // one line per later change, above this comment
]

/** One strip per later change, (rel, text) => text, in the order the changes were stacked. */
export const LATER_STRIPS = [
  (await import('./studio-first-paint-strip.mjs')).stripFirstPaint, // LATER-CHANGE: COMPOSER-2, studio first paint (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED)
  (await import('./studio-deck-card-thumbnail-strip.mjs')).stripDeckCardThumbnail, // LATER-CHANGE: COMPOSER-2, deck card thumbnails (NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED)
  (await import('./studio-chat-undo-v2-strip.mjs')).stripChatUndoV2, // LATER-CHANGE: FRONTEND-2, chat undo v2 (NEXT_PUBLIC_STUDIO_CHAT_UNDO; no .env.example block)
  (await import('./studio-pass3-polish-strip.mjs')).stripPass3Polish, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR A (NEXT_PUBLIC_STUDIO_PASS3_POLISH)
  (await import('./studio-pass3-polish-b-strip.mjs')).stripPass3PolishB, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR B (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)
  (await import('./studio-pass3-polish-c-strip.mjs')).stripPass3PolishC, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR C (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)
  (await import('./studio-pass3-polish-d-strip.mjs')).stripPass3PolishD, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR D (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)
  (await import('./studio-bulk-edit-prompt-text-strip.mjs')).stripBulkEditPromptText, // LATER-CHANGE: FRONTEND-2, bulk edit prompt text (NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT)
  (await import('./studio-pass3-polish-e-strip.mjs')).stripPass3PolishE, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR E (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)
  (await import('./studio-pass3-polish-f-strip.mjs')).stripPass3PolishF, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR F (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)
  (await import('./studio-d1-debug-routes-strip.mjs')).stripD1DebugRoutes, // LATER-CHANGE: FRONTEND-2, D1 security hotfix: debug env routes removed, cleanup-sessions dry run gated (no flag: PK's ruling; no .env.example block)
  (await import('./studio-pass3-polish-g-strip.mjs')).stripPass3PolishG, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR G (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)
  (await import('./studio-phone-shell-nav-strip.mjs')).stripPhoneShellNav, // LATER-CHANGE: FRONTEND-2, phone shell 1, the bottom tab bar on phones (NEXT_PUBLIC_STUDIO_PHONE_SHELL)
  (await import('./studio-phone-shell-builder-top-strip.mjs')).stripPhoneShellTop, // LATER-CHANGE: FRONTEND-2, phone shell 2, the Builder top on phones and the Director dot (NEXT_PUBLIC_STUDIO_PHONE_SHELL; no .env.example block of its own: the flag's block is PR 1's)
  (await import('./studio-speed-perceived-strip.mjs')).stripSpeedPerceived, // LATER-CHANGE: FRONTEND-2, Studio perceived speed: the typed message echo (NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED)
  (await import('./studio-flow-control-strip.mjs')).stripFlowControl, // LATER-CHANGE: FRONTEND-1, P3-1 D flow control, Studio half (NEXT_PUBLIC_STUDIO_FLOW_FOCUS / _FLOW_AMEND / _FLOW_AMEND_INSTRUCTIONS)
  (await import('./studio-arrange-strip.mjs')).stripStudioArrange, // LATER-CHANGE: FRONTEND-2, Arrange works in the Studio inspector, selecting no longer raises (NEXT_PUBLIC_STUDIO_ARRANGE)
  (await import('./studio-model-choice-strip.mjs')).stripModelChoice, // LATER-CHANGE: FRONTEND-2, P3-10 model choice: the Intelligence picker uses the live model catalogue (NEXT_PUBLIC_STUDIO_MODEL_CHOICE)
  (await import('./studio-chat-clean-strip.mjs')).stripChatClean, // LATER-CHANGE: FRONTEND-1, P3-1 C chat clean v3 (NEXT_PUBLIC_STUDIO_CHAT_CLEAN)
  (await import('./studio-chat-element-edit-strip.mjs')).stripChatElementEdit, // LATER-CHANGE: FRONTEND-2, chat element edit and notes refresh (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT)
  (await import('./studio-chat-commands-strip.mjs')).stripChatCommands, // LATER-CHANGE: FRONTEND-2, P3-1 A chat parity (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS)
  (await import('./studio-deck-sync-truth-strip.mjs')).stripDeckSyncTruth, // LATER-CHANGE: FRONTEND-2, B26 deck sync truth: the true slide count and no false "another tab" after chat edits (NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH)
  (await import('./studio-build-failure-end-strip.mjs')).stripBuildFailureEnd, // LATER-CHANGE: FRONTEND-2, B27 build failure end (NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END)
  (await import('./studio-paused-label-strip.mjs')).stripPausedLabel, // LATER-CHANGE: FRONTEND-2, B27 paused label (NEXT_PUBLIC_STUDIO_PAUSED_LABEL)
  (await import('./studio-chat-parity-strip.mjs')).stripChatParity, // LATER-CHANGE: FRONTEND-1, P3-1 A chat parity, Studio half (NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES / _IDENTITY / _TEMPLATES)
  (await import('./studio-chat-element-edit-2-strip.mjs')).stripChatElementEdit2, // LATER-CHANGE: FRONTEND-2, B32 chat element edit 2 (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2)
  (await import('./studio-model-choice-deck-save-strip.mjs')).stripModelChoiceDeckSave, // LATER-CHANGE: FRONTEND-2, B37 model choice deck save (NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE)
  (await import('./studio-chat-clean-order-strip.mjs')).stripChatCleanOrder, // LATER-CHANGE: FRONTEND-2, B31 clean chat order (NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER)
  (await import('./studio-model-choice-prefs-version-strip.mjs')).stripModelChoicePrefsVersion, // LATER-CHANGE: FRONTEND-2, B37 follow-up model choice prefs version (NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION)
  (await import('./studio-theme-own-choice-strip.mjs')).stripThemeOwnChoice, // LATER-CHANGE: FRONTEND-2, B34 theme own choice (NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE)
  (await import('./studio-chat-edit-targeted-strip.mjs')).stripChatEditTargeted, // LATER-CHANGE: FRONTEND-2, B33 targeted chat edit (NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE)
  (await import('./studio-chat-clean-held-all-built-strip.mjs')).stripHeldAllBuilt, // LATER-CHANGE: FRONTEND-2, B40 held all built (NEXT_PUBLIC_STUDIO_CHAT_CLEAN_HELD_ALL_BUILT)
  (await import('./studio-chat-add-targeted-strip.mjs')).stripChatAddTargeted, // LATER-CHANGE: FRONTEND-2, B42 targeted chat add (NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE)
  (await import('./studio-chat-stale-viewer-guard-strip.mjs')).stripChatStaleViewerGuard, // LATER-CHANGE: FRONTEND-2, B43 stale viewer guard (NEXT_PUBLIC_STUDIO_CHAT_STALE_VIEWER_GUARD)
  (await import('./studio-deck-save-refused-strip.mjs')).stripDeckSaveRefused, // LATER-CHANGE: FRONTEND-2, B46 deck save refused (NEXT_PUBLIC_STUDIO_DECK_SAVE_REFUSED_NOTICE)
  (await import('./studio-mdc-element-fields-strip.mjs')).stripMdcElementFields, // LATER-CHANGE: FRONTEND-2, B44 MDC element fields (NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS)
  (await import('./studio-chat-add-stacking-strip.mjs')).stripChatAddStacking, // LATER-CHANGE: FRONTEND-2, B48 chat add stacking (NEXT_PUBLIC_STUDIO_CHAT_ADD_STACKING)
  (await import('./studio-chat-element-text-set-strip.mjs')).stripChatElementTextSet, // LATER-CHANGE: FRONTEND-2, B49 chat text set (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET)
  (await import('./studio-chat-refine-structural-decline-strip.mjs')).stripChatRefineStructuralDecline, // LATER-CHANGE: FRONTEND-2, B50 structural refine decline (NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE)
  (await import('./studio-chat-text-set-keep-look-strip.mjs')).stripChatTextSetKeepLook, // LATER-CHANGE: FRONTEND-2, B49b text set keep look (NEXT_PUBLIC_STUDIO_CHAT_TEXT_SET_KEEP_LOOK)
  (await import('./studio-welcome-trim-strip.mjs')).stripWelcomeTrim, // LATER-CHANGE: FRONTEND-2, B51 welcome trim and Director mark trim (NEXT_PUBLIC_STUDIO_WELCOME_TRIM / NEXT_PUBLIC_STUDIO_DIRECTOR_MARK_TRIM)
  (await import('./studio-chat-column-wide-strip.mjs')).stripChatColumnWide, // LATER-CHANGE: FRONTEND-2, B51 chat column wide (NEXT_PUBLIC_STUDIO_CHAT_COLUMN_WIDE)
  (await import('./studio-stage-open-gate-strip.mjs')).stripStageOpenGate, // LATER-CHANGE: FRONTEND-2, B52 stage open gate (NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE)
  (await import('./studio-strawman-stage-strip.mjs')).stripStrawmanStage, // LATER-CHANGE: FRONTEND-1, F-04/F-05/F-07 strawman stage (NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE)
  (await import('./studio-strawman-chat-strip.mjs')).stripStrawmanChat, // LATER-CHANGE: FRONTEND-1, strawman chat (NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT)
  (await import('./studio-template-match-strip.mjs')).stripStudioTemplateMatch, // LATER-CHANGE: FRONTEND-2, W2 P4-7/8 template match (NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH)
  (await import('./studio-phone-landscape-strip.mjs')).stripPhoneLandscape, // LATER-CHANGE: FRONTEND-1, F-13 phone landscape, PR 1 (NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE)
  (await import('./studio-phone-hints-strip.mjs')).stripPhoneHints, // LATER-CHANGE: FRONTEND-1, F-13 phone hints, PR 2 (NEXT_PUBLIC_STUDIO_PHONE_HINTS)
  (await import('./studio-tier-update-guard-strip.mjs')).stripTierUpdateGuard, // LATER-CHANGE: FRONTEND-1, security P0 H4-01: server-side tier/entitlement only (no flag: security)
  (await import('./studio-template-proof-order-strip.mjs')).stripTemplateProofOrder, // LATER-CHANGE: FRONTEND-2, #587 template-match proof order (tests only)
  (await import('./studio-phone-shell-coverage-strip.mjs')).stripPhoneShellCoverage, // LATER-CHANGE: FRONTEND-2, B58 phone shell coverage (NEXT_PUBLIC_STUDIO_PHONE_SHELL_COVERAGE)
  (await import('./studio-ux-honesty-strip.mjs')).stripUxHonesty, // LATER-CHANGE: FRONTEND-1, UX honesty (no flag) + UX-09 page headings (NEXT_PUBLIC_STUDIO_PAGE_HEADINGS)
  (await import('./studio-prepromo-strip.mjs')).stripPrepromo, // LATER-CHANGE: FRONTEND-1, pre-promotion fixes C-07 / C-06 / UX-01 (no flag)
  (await import('./studio-proofs-after-merge-strip.mjs')).stripProofsAfterMerge, // LATER-CHANGE: FRONTEND-2, older proofs robust after merge (tests only)
  (await import('./studio-phone-polish-strip.mjs')).stripPhonePolish, // LATER-CHANGE: FRONTEND-2, B59 phone polish (NEXT_PUBLIC_STUDIO_PHONE_POLISH)
  (await import('./studio-model-picker-simple-strip.mjs')).stripModelPickerSimple, // LATER-CHANGE: FRONTEND-1, F-14 simplified model picker (NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE)
  (await import('./studio-billing-security-strip.mjs')).stripBillingSecurity, // LATER-CHANGE: FRONTEND-1 for PROGRAM-1, billing security B4-B9: webhook claim in one transaction, price-mapped tier, coupon claim (STUDIO_BILLING_COUPON_TIER_HARDENING)
  (await import('./studio-api-hardening-strip.mjs')).stripApiHardening, // LATER-CHANGE: PROGRAM-1, Studio API hardening v1 (STUDIO_API_HARDENING_V1_ENABLED / ADMIN_EMAILS)
  (await import('./studio-redeem-v4-strip.mjs')).stripRedeemV4, // LATER-CHANGE: FRONTEND-2, B60 redeem v4 (NEXT_PUBLIC_STUDIO_REDEEM_V4)
  (await import('./studio-billing-f4-f6-strip.mjs')).stripBillingF4F6, // LATER-CHANGE: FRONTEND-1, L-BILLING F4 debit switch + F6 single price source (WALLET_DEBIT_SOURCE)
  (await import('./studio-billing-f5-usage-strip.mjs')).stripBillingF5Usage, // LATER-CHANGE: FRONTEND-1, L-BILLING F5 quota and refusal screens + Usage page (NEXT_PUBLIC_STUDIO_USAGE_PAGE)
  (await import('./studio-usage-credits-strip.mjs')).stripUsageCredits, // LATER-CHANGE: FRONTEND-2, B62 usage credits (NEXT_PUBLIC_STUDIO_USAGE_CREDITS)
  (await import('./studio-chat-caps-strip.mjs')).stripChatCaps, // LATER-CHANGE: FRONTEND-2, B61 chat caps (NEXT_PUBLIC_STUDIO_CHAT_CAPS_META)
  (await import('./studio-chain-test-fix-strip.mjs')).stripChainTestFix, // LATER-CHANGE: FRONTEND-1, Option L chain test fix (tests only)
  (await import('./studio-usage-credits-page-strip.mjs')).stripUsageCreditsPage, // LATER-CHANGE: FRONTEND-2, B63 usage credits page (NEXT_PUBLIC_STUDIO_USAGE_CREDITS is B62's; no flag of its own)
  (await import('./studio-voice-core-strip.mjs')).stripVoiceCore, // LATER-CHANGE: ELEMENT-3, voice port compatibility pin
  (await import('./studio-voice-call-strip.mjs')).stripVoiceCall, // LATER-CHANGE: FRONTEND-1, W6 P4-20 voice call UI (NEXT_PUBLIC_STUDIO_VOICE_CALL)
  (await import('./studio-agent-mode-shell-strip.mjs')).stripAgentModeShell, // LATER-CHANGE: FRONTEND-2, B69 agent mode shell (NEXT_PUBLIC_AGENT_MODE)
  (await import('./studio-page-consistency-strip.mjs')).stripPageConsistency, // LATER-CHANGE: FRONTEND-1, UX-07 / UX-10 page consistency (NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY)
  (await import('./studio-restack-ux-pc-proofs-strip.mjs')).stripRestackUxPc, // LATER-CHANGE: FRONTEND-2, restack of FRONTEND-1's page consistency: older proofs read the later changes right after the merge onto newer dev (tests only)
  (await import('./studio-billing-l5-strip.mjs')).stripBillingL5, // LATER-CHANGE: FRONTEND-2, B67 L-BILLING Studio half (NEXT_PUBLIC_STUDIO_BILLING_PLANS / STUDIO_ROUTER_ENTITLEMENTS_PUSH / STUDIO_METER_RECEIVER_ENABLED)
  (await import('./studio-avatar-spawn-strip.mjs')).stripAvatarSpawn, // LATER-CHANGE: FRONTEND-2, B66 AVATAR-SPAWN (NEXT_PUBLIC_STUDIO_AVATAR_SPAWN)
  (await import('./studio-ws-bq-claim-strip.mjs')).stripWsBqClaim, // LATER-CHANGE: OPS-2, J8.1 WS token bq claim (DECKSTER_WS_BQ_CLAIM_ENABLED)
  (await import('./studio-agent-mode-wire-strip.mjs')).stripAgentModeWire, // LATER-CHANGE: FRONTEND-1, Agent mode wire (NEXT_PUBLIC_AGENT_MODE and NEXT_PUBLIC_STUDIO_V4_SHELL; no .env.example block of its own)
  (await import('./studio-brand-kit-strip.mjs')).stripBrandKit, // LATER-CHANGE: FRONTEND-1, Brand Kit caller (NEXT_PUBLIC_STUDIO_BRAND_KIT)
  (await import('./studio-audit-present-exit-strip.mjs')).stripAuditPresentExit, // LATER-CHANGE: FRONTEND-1, audit P-17, Present Exit leaves Present when the browser is not full screen (NEXT_PUBLIC_STUDIO_PRESENT_EXIT_FIX)
  (await import('./studio-audit-console-strip.mjs')).stripAuditConsole, // LATER-CHANGE: FRONTEND-1, audit P-30 / P-32, no analytics script request where none is served, an honest first Decks tab (NEXT_PUBLIC_STUDIO_ANALYTICS_GATE / NEXT_PUBLIC_STUDIO_ANALYTICS_SERVED / NEXT_PUBLIC_STUDIO_DECK_TABS_HONEST)
  (await import('./studio-audit-previews-strip.mjs')).stripAuditPreviews, // LATER-CHANGE: FRONTEND-1, audit P-01 / P-07 / P-29, deck cards and Duplicate for a deck that exists on this Layout, the slide list and a live Publish preview when the inventory route is absent (NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME / NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK)
  (await import('./studio-thumbnail-proof-speed-strip.mjs')).stripThumbnailProofSpeed, // LATER-CHANGE: FRONTEND-2, thumbnail-last-good proof speed-up (tests only)
  (await import('./studio-chat-parity-viewer-strip.mjs')).stripChatParityViewer, // LATER-CHANGE: FRONTEND-1, overnight chat parity, viewer slash commands (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS)
  (await import('./studio-chat-parity-workspace-strip.mjs')).stripChatParityWorkspace, // LATER-CHANGE: FRONTEND-1, overnight chat parity, workspace slash commands (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS)
  (await import('./studio-chat-parity-more-strip.mjs')).stripChatParityMore, // LATER-CHANGE: FRONTEND-1, overnight chat parity, the remaining slash commands (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS)
  (await import('./studio-owner-cuid-strip.mjs')).stripOwnerCuid, // LATER-CHANGE: KNOWLEDGE, K-02 chat upload owner = user.id cuid (NEXT_PUBLIC_STUDIO_OWNER_CUID_ENABLED)
  (await import('./studio-upload-session-token-strip.mjs')).stripUploadSessionToken, // LATER-CHANGE: KNOWLEDGE-3, DSB-5a upload session token (NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED)
  // one line per later change, above this comment
]

const lineStart = (text, at) => at === 0 || text[at - 1] === '\n'
const lineEnd = (text, at) => at === text.length || text[at] === '\n'

/**
 * `text` without the registered blocks, when `rel` is .env.example; every other file (and the empty registry) gives `text` back untouched.
 * A block comes out with the one blank line that separated it from its neighbour: the blank line after it when something follows, else the blank line before it (the block was the last thing in the file, with or without a blank line of its own after it).
 * Only the first whole occurrence of a block is taken (a block that is there twice is a merge mistake and the older pins must still see the second); stripping twice changes nothing more.
 */
export function stripLaterEnvBlocks(rel, text) {
  if (rel !== '.env.example' || typeof text !== 'string' || LATER_ENV_BLOCKS.length === 0) return text
  let out = text
  for (const registered of LATER_ENV_BLOCKS) {
    const block = String(registered).replace(/^\n+/, '').replace(/\n+$/, '')
    if (block === '') continue
    let at = out.indexOf(block)
    while (at !== -1 && !(lineStart(out, at) && lineEnd(out, at + block.length))) at = out.indexOf(block, at + 1)
    if (at === -1) continue
    const before = out.slice(0, at), after = out.slice(at + block.length)
    if (/^\n*$/.test(after)) out = before.endsWith('\n\n') ? before.slice(0, -1) : before // last in the file (only newlines after it, whether or not the block carries its own trailing blank line): the blank line before it goes
    else if (after.startsWith('\n\n')) out = before + after.slice(2) // the blank line after it goes with it
    else out = before + after.slice(1) // no blank line after it: only the block's own lines go
  }
  return out
}

/**
 * What an older pin reads an app file or .env.example through, INNERMOST: every registered strip in order (a result that is not a string is ignored), then the registered .env.example blocks. A file no later
 * change touches, and the empty registry, come back byte for byte.
 */
export function stripLaterChanges(rel, text) {
  if (typeof text !== 'string') return text
  let out = text
  for (const strip of LATER_STRIPS) {
    if (typeof strip !== 'function') continue
    const next = strip(rel, out)
    if (typeof next === 'string') out = next
  }
  return stripLaterEnvBlocks(rel, out)
}
