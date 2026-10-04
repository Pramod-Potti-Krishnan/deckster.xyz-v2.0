# Accepted visual references and wireframes

These nine images are accepted v4 prototype states, visually inspected for this package. They show local sample content and simulated conversation. They are **design references**, not screenshots of connected voice on the dev app. Preserve the actual app’s functional controls where the mock simplifies them. The supplied source art is the Director character in the call pane, not the small account avatar at the lower left.

| File | Intended behavior |
|---|---|
| [30 Chat call buttons](images/30-chat-call-buttons.png) | Compact Call and interactive/avatar entry actions beside Director; ordinary chat stays the base. |
| [31 Voice call](images/31-voice-call.png) | Avatar/status strip, full chat, pinned current choice and unchanged composer. |
| [32 Interactive avatar and decision](images/32-video-call-decision.png) | Large person-focused character, camera-off self placeholder, decision sheet and captions. |
| [33 Composer over avatar](images/33-video-composer-sheet.png) | The real composer and options remain reachable without leaving the interaction. |
| [34 Ended call](images/34-call-ended-in-chat.png) | Return to chat with actual recorded turns and optional honest call summary. |
| [51 Dark interactive view](images/51-dark-video-call.png) | Dark palette, readable overlay, captions and visible End control. |
| [71 Voice approval](images/71-ask-approval-voice.png) | Existing approval UI retains identity and confirmation, with full chat visible. |
| [72 Interactive approval](images/72-ask-approval-video.png) | Same approval in the avatar view. The explanatory read-back copy is intent, not an implemented security policy. |
| [73 Interactive questions](images/73-ask-questions-video.png) | Ordered questions, selected choices, free text and Submit stay bound to the real question state. |

## Pane wireframe

Chat: Director identity + call actions → existing messages/questions → existing composer.

Voice: Director identity + call timer/status → mute / mode / End → compact avatar + real activity → existing messages → current-question strip → existing composer.

Interactive: Director identity + call controls → large Director avatar with current-question overlay → text captions/history → explicit Talk/output controls; open the existing composer as a sheet. The slide canvas remains usable alongside the pane and must not remount.

Activity artwork supports idle, listening, thinking, noting and speaking. Drive it from actual state; animation is decorative and is not evidence of recording or backend progress. The motion hook already handles reduced motion, hidden/offscreen state and cancellation. It is an expressive rig, not audio-derived lip sync.

## Prototype source boundaries

`reference-source/director-character.tsx.txt`, its CSS, and `use-director-motion.ts` form a reusable React/SVG/CSS unit. Other supplied files are design/interaction references and have prototype-only imports (`model`, `feature-access`) intentionally not copied. They are not a production-ready package. Port their layout, not their sample entitlements, sample Talk utterances, invented replies or fake success paths.

The accepted interaction wording is recorded in `frontend/prototypes/builder-studio-v4/review-v4/ROUND-2-PK-FOCUS.md` §2. The production staging is `PRODUCTION-PLAN-v4.md` §O0–O3: call shell, explicit dictation, spoken replies, then carefully bound actions. Those earlier optional labels are historical staging, not a reason to skip this newly requested frontend assignment.
