# Current application source map

The paths below are frontend-repository relative, verified by reading the dev release baseline `a1dac11f0ffe22c3ce32e89e5b4807accc3b854c`. Line numbers are navigation aids and will drift. Current code wins over historical documents.

| Source | Role and boundary |
|---|---|
| `app/builder/page.tsx` around 4440, 5650 and 5787 | Existing `handleSendMessage`, gated Director header mount and real ChatInput submission. Use a thin adapter; preserve admission, files/research/theme/template/deck context and pending-action behavior. |
| `components/builder/chat/studio-director-header.tsx` | Compact existing header with actual connection/loading state. Add optional feature entry actions only behind the new flag; a connected socket alone does not mean sending is allowed. |
| `components/builder/chat-input.tsx` | The real composer. Keep existing inputs, upload/library/model/options controls and draft behavior. |
| `components/builder/message-list.tsx`, `components/builder/chat/question-card.tsx` | Existing conversation rendering and structured asks. Reuse actual data/callbacks, not mock Ask IDs or label-based execution. |
| `hooks/use-deckster-websocket-v2.ts` around 2747–2887 | `sendMessage` and `sendMessageWhenConnected`. Actual text transport with session-sticky sources, research, theme/template/action fields, identity/idempotency and existing readiness. Keep this contract unchanged; browser queue success does not prove a server result. |
| `components/published-presenter.tsx`, `components/presenter-question.tsx`, `components/published-qa-panel.tsx` | Existing published narration and Q&A. Separate scope; unchanged by this work. Their publish-slug access and budgets cannot be repurposed for private Director calls. |
| `lib/narration/voices.ts`, `components/narration-voice-picker.tsx` | Existing narration catalog/availability; do not invent Director voice IDs, prices or new provider mappings from this catalog. |
| `components/studio-personal/details-workspace.tsx` | Presenter/avatar later-addition disclosure; do not expand personal likeness or account-photo work here. |

Open these paths at the pinned application baseline with `https://github.com/Pramod-Potti-Krishnan/deckster.xyz-v2.0/blob/a1dac11f0ffe22c3ce32e89e5b4807accc3b854c/<path>`.

## Proven and missing contracts

**Source-confirmed:** real Director text send path; current session/target/action admission in Builder; actual connection state header; separate published audio/Q&A endpoints. **Not proven by this package:** remote dev health, live account permissions, microphone/STT support, approved browser-recognition privacy behavior, Director TTS/provider mapping, real media budget/settlement, persisted call metadata, spoken approval read-back policy, full-duplex audio, audio-driven visemes, personal likeness or video transport.

Use feature-detected on-device speech synthesis only when an actual local voice exists and the user requests playback. Browser recognition can send audio to a browser vendor; do not silently describe it as on-device or wire it to an unapproved provider. A missing input contract should yield an honest disabled microphone and editable typed fallback. A visual avatar does not require a new provider service.

Do not copy `.env` files, logs, cookies, test accounts, profile images, private session IDs or existing users’ content into this public package or your return artifacts. Normal sign-in and approved owned disposable test content are the only connected validation path; no forged auth or quota bypass.
