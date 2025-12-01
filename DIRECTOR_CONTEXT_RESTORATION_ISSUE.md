# Director v3.4: Context Restoration Issue on Reconnection

**Date:** 2025-11-27
**Reported By:** Frontend Team
**Severity:** High - Impacts user experience on session reload

---

## Issue Summary

When a user reconnects to an existing chat session (e.g., browser refresh, loading from session history), the Director service correctly loads the session state from Supabase but does not send conversation history to the frontend. This causes the conversation to appear empty, and the Director treats subsequent user input as a new conversation, asking clarifying questions again instead of continuing from where the user left off.

---

## Current Behavior vs. Expected Behavior

### Current Behavior ❌
1. User creates presentation, gets to strawman stage
2. User refreshes browser or loads session from history
3. Frontend reconnects with same `session_id`
4. **Director loads session from Supabase** (state = "GENERATE_STRAWMAN", has conversation history)
5. **Director sends nothing** (just logs "no greeting needed")
6. Frontend shows empty conversation
7. User clicks "Looks perfect!" → **Director asks clarifying questions again** (treats as new conversation)

### Expected Behavior ✅
1. User creates presentation, gets to strawman stage
2. User refreshes browser or loads session from history
3. Frontend reconnects with same `session_id`
4. Director loads session from Supabase
5. **Director sends conversation history to frontend** (greeting, clarifying questions, plan, strawman messages)
6. Frontend displays full conversation history
7. User clicks "Looks perfect!" → Director generates final presentation (continues conversation)

---

## Evidence from Logs

### Frontend Console Logs (Successful Reconnection)
```
✅ Restored session from database
   Session ID: 7304dad9-0492-41b4-a174-c421107b38dc
   Stage: 4 (strawman)
   Messages: 0  ← PROBLEM: No messages restored
   Has strawman URL: true
   Has final URL: false
```

### Director Backend Logs (websocket.py:186-196)
```python
# Current code in handle_connection():
if session.current_state == "PROVIDE_GREETING":
    logger.info(f"Session {session_id} is new, sending greeting")
    await self._send_greeting(websocket, session)
else:
    logger.info(f"Session {session_id} already in state: {session.current_state}, no greeting needed")
    # ⚠️ Nothing is sent here - frontend gets no context!
```

**Result:** Director logs "Session already in state: GENERATE_STRAWMAN, no greeting needed" and sends nothing.

---

## Root Cause Analysis

### What We Know ✅
1. **Director DOES persist sessions to Supabase** correctly via `session_manager.py`
2. **Director DOES load existing sessions** correctly in `handle_connection()`
3. **Session data includes:**
   - `current_state` (e.g., "GENERATE_STRAWMAN")
   - `conversation_history` (all previous messages)
   - `user_initial_request`, `clarifying_answers`, `confirmation_plan`, `presentation_strawman`
   - `presentation_url`

### The Gap ❌
When reconnecting to an existing session (where `current_state != "PROVIDE_GREETING"`), Director:
- ✅ Loads session state from database
- ✅ Has all conversation history available
- ❌ **Does NOT send this history to frontend**
- ❌ Frontend appears empty despite having presentation URL

---

## Questions for Director Team

### 1. Session State Management
**Q:** Does Director maintain conversation history in `session.conversation_history` throughout the workflow?

**Context:** We see history being added in `_handle_message()` lines 465-474:
```python
await self.sessions.add_to_history(session.id, self.current_user_id, {
    'role': 'user',
    'content': user_input,
    'intent': intent.dict()
})
await self.sessions.add_to_history(session.id, self.current_user_id, {
    'role': 'assistant',
    'state': session.current_state,
    'content': response
})
```

**Verification Needed:**
- Does this history persist across reconnections?
- What format is the history stored in?
- Can we reconstruct original messages from this history?

### 2. Message Format Compatibility
**Q:** What message format should we use to send historical messages on reconnection?

**Context:** Director uses two protocols:
- **Streamlined Protocol** (v3.4+): `StreamlinedMessage` with types like `chat_message`, `slide_update`, `presentation_url`, `status_update`
- **Legacy Protocol**: Older format

**Questions:**
- Should we reconstruct messages in streamlined format?
- Do we need to preserve original message IDs?
- Should we send all history or just key messages (greeting, plan, strawman)?

### 3. State-Specific Restoration
**Q:** How should restoration differ based on `current_state`?

**Scenarios:**

| Current State | What Frontend Needs |
|---------------|-------------------|
| `ASK_CLARIFYING_QUESTIONS` | Greeting + initial topic |
| `CREATE_CONFIRMATION_PLAN` | Greeting + topic + questions + answers + plan |
| `GENERATE_STRAWMAN` | Everything + strawman preview + slide_update |
| `CONTENT_GENERATION` | Everything + final presentation URL |

**Question:** Should we send:
- **Option A:** Full conversation history for all states?
- **Option B:** State-appropriate subset (minimal for early states, full for late states)?
- **Option C:** Just the current state artifacts (e.g., only strawman for GENERATE_STRAWMAN)?

### 4. Intent Classification on Reconnection
**Q:** How does Director handle intents for the first message after reconnection?

**Current Issue:**
- User reconnects at strawman stage
- User clicks "Looks perfect!" (button sends `user_input = "accept_strawman"`)
- Director asks clarifying questions instead of generating final presentation

**Questions:**
- Does Director's intent router consider `current_state` when classifying intents?
- Should reconnection set a flag to indicate "continuing existing conversation"?
- Is there special handling needed for button actions (`accept_strawman`, `accept_plan`) on reconnection?

### 5. Presentation URL Handling
**Q:** How should Director send presentation URLs on reconnection?

**Current Observation:** Frontend has `strawmanPreviewUrl` in database but no corresponding messages.

**Questions:**
- Should restoration include a `presentation_url` message if one exists?
- Should we send `slide_update` message with full slide structure?
- Does this need to match the original message format from generation?

---

## Proposed Solution (Needs Validation)

### High-Level Approach
Add `_restore_session_state()` method in `websocket.py` to send conversation history when reconnecting to existing sessions.

### Pseudocode
```python
async def _restore_session_state(self, websocket: WebSocket, session: Any):
    """
    Restore conversation history on reconnection.

    Reconstructs and sends previous messages so frontend can display
    full conversation context.
    """
    use_streamlined = self._should_use_streamlined(session.id)

    if not use_streamlined:
        # Legacy protocol - need guidance on format
        logger.warning("Context restoration not yet implemented for legacy protocol")
        return

    # Build list of messages to send
    messages = []

    # 1. Send greeting (reconstructed)
    # TODO: How to reconstruct greeting message?

    # 2. Send conversation history
    for history_item in session.conversation_history:
        # TODO: Convert history_item to StreamlinedMessage
        # What format is history_item? How to map to message types?
        pass

    # 3. Send current state artifacts
    if session.current_state == "GENERATE_STRAWMAN" and session.presentation_strawman:
        # TODO: Reconstruct slide_update + presentation_url messages
        # Should we use _build_cached_strawman_response()?
        pass

    # Send all messages
    await self._send_messages(websocket, messages)
    logger.info(f"Restored {len(messages)} messages for session {session.id}")

# Modify handle_connection():
if session.current_state == "PROVIDE_GREETING":
    await self._send_greeting(websocket, session)
else:
    await self._restore_session_state(websocket, session)  # NEW
```

### Open Questions on Implementation
1. **History Format:** What's the structure of items in `session.conversation_history`?
2. **Message Reconstruction:** How to convert history items to `StreamlinedMessage` objects?
3. **Greeting Reconstruction:** Can we reuse `_send_greeting()` or need to reconstruct from history?
4. **Strawman Reconstruction:** Should we use `_build_cached_strawman_response()` + `streamlined_packager.package_messages()`?
5. **Message IDs:** Do we need to preserve original message IDs or generate new ones?
6. **Timing:** Should we batch send or add delays between messages?

---

## Testing Scenario

### Setup
1. Create new session, provide topic (e.g., "Jimmy Kimmel")
2. Answer clarifying questions
3. Accept plan
4. Get strawman preview
5. **Note session_id** (e.g., `7304dad9-0492-41b4-a174-c421107b38dc`)

### Test Reconnection
1. Refresh browser
2. Frontend reconnects with same `session_id`
3. **Verify:** Frontend shows full conversation (greeting → questions → plan → strawman)
4. Click "Looks perfect!" button
5. **Expected:** Director generates final presentation
6. **Current Bug:** Director asks clarifying questions again

---

## Impact Assessment

### User Experience Impact
- **Severity:** High
- **Frequency:** Every time user refreshes or switches sessions
- **Workaround:** None - user loses all context

### Affected Features
- ✅ **Presentation persistence:** Fixed (frontend now saves URLs correctly)
- ❌ **Conversation continuity:** Broken (this issue)
- ✅ **Session restoration:** Partially working (metadata loads, messages don't)

---

## Request to Director Team

Please review this analysis and provide guidance on:

1. ✅ **Confirm our understanding** of the issue
2. 📋 **Answer the questions** in sections above (especially message format and history structure)
3. 🛠️ **Validate the proposed solution** or suggest alternative approach
4. 📝 **Provide code examples** of:
   - How to access and parse `session.conversation_history`
   - How to reconstruct messages in streamlined format
   - Expected message format for restoration
5. 🤝 **Collaborate on implementation** - should this be:
   - **Director-side fix** (recommended - Director knows message format)
   - **Frontend-side fix** (frontend reconstructs from database)
   - **Hybrid approach** (both systems coordinate)

---

## Additional Context

### Frontend Persistence (Already Fixed ✅)
We recently fixed a critical bug where presentation URLs weren't persisting to the frontend database. This is now working:

```typescript
// Fixed stale closure bugs with refs
const currentSessionIdRef = useRef(currentSessionId)
const persistenceRef = useRef(persistence)

// Callback now correctly saves presentations
onSessionStateChange: (state) => {
  if (currentSessionIdRef.current && persistenceRef.current) {
    await persistenceRef.current.updateMetadata({
      strawmanPreviewUrl: state.presentationUrl,
      // ...
    });
  }
}
```

**Result:** Presentations now persist correctly in frontend database (`fe_chat_sessions` table).

### Frontend Session Restoration (Working ✅)
Frontend correctly loads session metadata on reconnection:

```typescript
// Loads from database
const session = await prisma.chatSession.findUnique({
  where: { id: sessionId },
  include: { messages: true, stateCache: true }
});

// Restores iframe with presentation URL
if (session.strawmanPreviewUrl) {
  setIframeSrc(session.strawmanPreviewUrl);
}
```

**Result:** Presentation iframe loads correctly, but conversation is empty.

---

## Files for Reference

### Director v3.4
- **WebSocket Handler:** `/src/handlers/websocket.py` (lines 186-196 need modification)
- **Session Manager:** `/src/utils/session_manager.py` (session persistence logic)
- **Message Packager:** `/src/utils/streamlined_packager.py` (message formatting)

### Frontend (for context)
- **WebSocket Hook:** `/hooks/use-deckster-websocket-v2.ts` (receives messages)
- **Builder Page:** `/app/builder/page.tsx` (manages session state)
- **Database Schema:** `/prisma/schema.prisma` (session structure)

---

## Contact

For questions or collaboration:
- **Frontend Team:** Available for testing and frontend changes if needed
- **Session ID for Testing:** `7304dad9-0492-41b4-a174-c421107b38dc` (Jimmy Kimmel presentation at strawman stage)

---

**Status:** Awaiting Director team feedback before implementing fix.
