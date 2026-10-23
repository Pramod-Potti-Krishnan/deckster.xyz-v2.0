# Refine an element from chat: one free live check (after merge, before any paid run)

FRONTEND-2, Pass 3. Studio flag `NEXT_PUBLIC_CHAT_ELEMENT_REFINE` (this PR); Director `DIRECTOR_MDC_REFINE_ELEMENT_ENABLED` + `CHAT_CAP_REFINE_ELEMENT`
(Director !511, narrowed by !512); Layout `LAYOUT_REQUEST_ELEMENT_REFINE_ENABLED` (layout-builder !245). Offline proof is in
`scripts/test-studio-chat-element-refine.mjs`. This plan is the first check against deployed services. **Nothing in it calls Text Labs**:
every step below ends before a generation starts, so it costs nothing. The first paid refine is a separate step that needs PK's go.

## Preconditions (OPS-2)

1. All three halves merged into their `uat` / Studio base branches and deployed, and the flags on in the SAME environment:
   - Layout UAT: `LAYOUT_REQUEST_ELEMENT_REFINE_ENABLED=true`. Check its `/health` `feature_flags` (the flag and `_RAW_PRESENT` both true).
   - Director UAT: `DIRECTOR_MDC_REFINE_ELEMENT_ENABLED=true`, `CHAT_CAP_REFINE_ELEMENT=true`, plus the flags the recordings used
     (`MULTI_INTENT_ENABLED`, `DIRECTOR_MDC_HONEST_REPLIES_ENABLED`, `DIRECTOR_MDC_SESSION_SCOPE_ENABLED`). Check `/health`.
   - Studio: `NEXT_PUBLIC_CHAT_ELEMENT_REFINE=true` and `NEXT_PUBLIC_CHAT_DIRECTIVES=true`. These are READ AT BUILD TIME, so the Studio
     deployment has to be rebuilt after setting them. It must be the Studio v4 deployment (the deployed UAT frontend is the older design), with
     every `NEXT_PUBLIC_*_URL` (incl. `NEXT_PUBLIC_WS_URL`) pointed at UAT, or it silently talks to production.
2. An EXISTING deck in that environment (do not build a new one) with, on one slide, a chart and a text box, and somewhere an infographic.
3. A person driving the browser with DevTools open on the WebSocket frames of the Director socket. Treat UAT data as production data: no screenshots
   or HAR files that include tokens or URLs with tokens.

## The check (about 10 minutes, all free)

| # | Do | Expect (WS frames / chat) | Proves |
|---|----|---------------------------|--------|
| 1 | Open the deck. Type "hello" with nothing selected. | `user_message.data.client_caps` = `["mdc1","element_refine1"]`; no `references`. | Studio flag is on and built in. |
| 2 | Select the text box, then click the empty canvas (deselect). Type "make this shorter". | No element reference. Director: "Which element do you mean? Select it on the canvas and send your message again." No directive. | Deselect clears the selection; G3. |
| 3 | Select the chart. Click its sparkle "Refine element" so the Element panel opens. Leave it open, re-select the chart, type "make it a bar chart". | Outbound: ONE reference `{kind:"element", element_id:<the chart>, element_type:"CHART", slide_index:<its slide>, slide_id, label:"Chart · slide N"}`. Inbound: `element_refine_directive` (not in the chat), then the receipt line. Outbound: `element_directive_result {status:"dismissed", error_code:null}`. Director: "No problem, I left that chart as it was." **No Text Labs request** (Network tab: no `/api/chat/message`). | Reference shape, directive delivery, the busy-panel rule, the result frame, Director's closing line. Free because the panel is open. |
| 4 | Close the panel. Select the infographic. Type "make this simpler". | One reference with `element_type:"INFOGRAPHIC"`. Director (with !512) sends NO directive and replies "I can't refine this infographic from chat yet…". | References for all 19 types; Director's refinable set. |
| 5 | Optional, only if OPS-2 flips Layout last or can hold it off briefly: with Studio and Director on and Layout's flag OFF, repeat step 3 with the panel CLOSED. | `element_directive_result {status:"failed", error_code:"viewer_unavailable"}`; Director's one failure line. No Text Labs request (the runner stops at the viewer command). | The real `requestElementRefine` "Unknown action" path end to end. |

Pass: every row matches, nothing appears twice in the chat, the directive never shows as a chat bubble, the turn unlocks after the receipt,
and the browser console shows no errors from the runner. Record the frame sequence for each row (types and the fields above; redact ids if needed)
in the PR thread.

Fail or anything unexpected: turn `NEXT_PUBLIC_CHAT_ELEMENT_REFINE` off and rebuild Studio (the chat is then exactly as before; Director falls
back to its text answer for any client without the cap). Director's flag off also stops it on its own side.

## After it passes: the first paid run (needs PK)

One refine of one chart with the panel closed ("make it a bar chart"): one Text Labs call. Expect `refined` and "Done. The chart on slide N is
refined, in the same place.", the chart regenerated where it was, and a new entry in Version history (which restores the old one).

## What this needs

- From OPS-2: the merge order and the flag flips above (Layout and Director first, then the Studio build; or Layout last if step 5 is wanted);
  the Studio v4 deployment target and its env check; the deck to use; a free slot to watch it; the rollback if a row fails.
- From PK: approval to switch the three flags on in UAT (UAT shares the production Supabase), and a separate go for the one paid refine.
