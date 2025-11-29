# Director v3.4: Historical Messages Missing Role Information

**Date:** 2025-11-29
**Reported By:** Frontend Team
**Severity:** High - Causes user messages to appear as bot messages after session refresh
**Status:** Active Issue

---

## Executive Summary

When Director restores a session on reconnection, it sends historical messages from its conversation_history but does NOT preserve the `role` field that distinguishes user messages from assistant messages. This causes all historical messages (including user messages) to be classified as bot messages on the frontend, breaking the chat UI.

---

## Problem Description

### Current Behavior ❌

1. User sends first message: "Krishna"
2. Frontend saves to database with `userText: "Krishna"`
3. Director saves to Supabase with `role: 'user', content: 'Krishna'`
4. User continues conversation (answers questions, etc.)
5. **User refreshes page**
6. Frontend loads messages from database → finds "Krishna" with `userText` → classifies as user message
7. **Director reconnects and sends historical messages from Supabase**
8. Director sends "Krishna" as `type: 'chat_message'` WITHOUT `role` or `userText` field
9. Frontend receives this as a bot message
10. Content deduplication removes the database version and keeps Director's version
11. **Result:** "Krishna" appears on LEFT (bot side) instead of RIGHT (user side)

### Expected Behavior ✅

1. User sends first message: "Krishna"
2. User refreshes page
3. Director sends historical messages **with role information preserved**
4. Frontend correctly identifies "Krishna" as user message
5. "Krishna" appears on RIGHT (user side) with user icon

---

## Evidence from Logs

### Director Backend Logs (Railway)

**Session Data from Supabase:**
```python
'conversation_history': [
    {
        'role': 'user',  # ← Role IS stored in Supabase
        'intent': {'confidence': 0.99, 'intent_type': 'Submit_Initial_Topic', 'extracted_info': 'Krishna'},
        'content': 'Krishna'
    },
    {
        'role': 'assistant',
        'state': 'ASK_CLARIFYING_QUESTIONS',
        'content': {'type': 'ClarifyingQuestions', 'questions': [...]}
    }
]
```

**Messages Sent to Frontend:**
```
📤 SENDING MESSAGE 1/2
   Type: chat_message  # ← Role information NOT included!
   Session: N/A
📤 SENDING MESSAGE 2/2
   Type: chat_message
   Session: N/A
```

### Frontend Console Logs

**After Refresh:**
```javascript
📊 Message rendering - userMessages: 0 botMessages: 11 combined: 11
// All 11 messages classified as bot messages because they lack userText/role
```

**Message Type Detection:**
```javascript
🔍 Checking message type: {
  message_id: "...",
  payload: {text: "Krishna"},
  isInUserMessageIds: false,  // ← Not recognized as user message
  classifiedAs: "BOT"  // ← Should be "USER"
}
```

---

## Root Cause Analysis

### Where the Role Information is Lost

1. **Director's Supabase Database:** ✅ CORRECT
   - Stores `role: 'user'` for user messages
   - Stores `role: 'assistant'` for bot messages

2. **Director's Message Reconstruction Logic:** ❌ BUG HERE
   - When building historical messages to send to frontend
   - Converts conversation_history entries to WebSocket messages
   - **Does NOT include the `role` field** in the WebSocket message format

3. **Frontend Reception:** ⚠️ NO ROLE DATA
   - Receives messages as `DirectorMessage` with only `message_id`, `type`, `payload`, `timestamp`
   - No `role` or `userText` field to distinguish user vs assistant

---

## Impact Assessment

### User Experience Impact
- **Severity:** High
- **Frequency:** Every time user refreshes during an active session
- **Workaround:** None - user cannot fix this from frontend

### Affected Features
- ✅ **New sessions:** Work correctly (first send has proper classification)
- ❌ **Session restoration:** Broken (user messages appear as bot messages)
- ❌ **Conversation continuity:** Confusing UX (user can't tell what they said vs what bot said)
- ❌ **Message ordering:** May be incorrect due to classification issues

---

## Proposed Solutions

### Solution A: Include Role in WebSocket Message (Recommended)

**Modify:** Message reconstruction logic in Director's WebSocket handler

**Add `role` field to messages:**
```python
# When reconstructing messages from conversation_history
for entry in session.conversation_history:
    message = {
        'message_id': entry.get('id') or str(uuid.uuid4()),
        'type': 'chat_message',
        'payload': entry['content'],
        'timestamp': entry.get('timestamp', datetime.now().isoformat()),
        'role': entry['role'],  # ← ADD THIS FIELD
    }
    await websocket.send_json(message)
```

**Frontend will then check:**
```typescript
const isUserMessage = m.role === 'user' || userMessageIdsRef.current.has(m.message_id);
```

### Solution B: Use Different Message Types

**Alternative:** Use distinct message types for user vs assistant messages

```python
# For user messages
message_type = 'user_message'

# For assistant messages
message_type = 'chat_message' or 'assistant_message'
```

**Frontend will then check:**
```typescript
const isUserMessage = m.type === 'user_message' || userMessageIdsRef.current.has(m.message_id);
```

### Solution C: Include userText Field

**Alternative:** Add `userText` field when reconstructing user messages

```python
for entry in session.conversation_history:
    message = {
        'message_id': entry.get('id') or str(uuid.uuid4()),
        'type': 'chat_message',
        'payload': entry['content'],
        'timestamp': entry.get('timestamp', datetime.now().isoformat()),
    }

    # Add userText for user messages
    if entry['role'] == 'user':
        message['userText'] = entry['content'] if isinstance(entry['content'], str) else str(entry['content'])

    await websocket.send_json(message)
```

---

## Recommended Implementation

**Preference:** Solution A (include `role` field)

**Why:**
1. Minimal change - just add one field
2. Preserves semantic meaning from database
3. Frontend already has logic to handle role-based classification
4. Most maintainable long-term

**Code Location:**
- File: `/src/handlers/websocket.py` (or wherever historical messages are reconstructed)
- Look for: Code that iterates through `session.conversation_history` to send messages on reconnection
- Likely around: Session restoration logic when `current_state != "PROVIDE_GREETING"`

---

## Example Message Format

### Current (Broken) Format
```json
{
  "message_id": "abc123",
  "type": "chat_message",
  "payload": {
    "text": "Krishna"
  },
  "timestamp": "2025-11-29T19:47:49.568723+00:00"
}
```

### Proposed (Fixed) Format
```json
{
  "message_id": "abc123",
  "type": "chat_message",
  "payload": {
    "text": "Krishna"
  },
  "timestamp": "2025-11-29T19:47:49.568723+00:00",
  "role": "user"
}
```

---

## Testing Scenario

### Setup
1. User opens `/builder` page
2. User sends first message: "Krishna"
3. Director responds with clarifying questions
4. User answers questions
5. Director sends plan
6. User accepts plan
7. **User refreshes page**

### Current Result (Broken)
- "Krishna" appears on LEFT (bot side)
- All messages appear as bot messages
- Cannot distinguish user input from bot responses

### Expected Result (After Fix)
- "Krishna" appears on RIGHT (user side) with user icon
- User answers appear on RIGHT
- Bot messages appear on LEFT
- Clear visual distinction between user and bot

---

## Related Issues

- Frontend database DOES save `userText` correctly
- Frontend restoration logic DOES check for `userText`
- The issue is ONLY with Director's historical message format

---

## Frontend Workaround

The frontend team is implementing a temporary workaround that matches message content to identify user messages, but this is fragile and should be replaced with the proper Director-side fix.

**Workaround approach:**
- Store user message content during database restoration
- When Director sends historical messages, match content to identify user messages
- Manually add matched messages to `userMessageIdsRef`

**Limitations of workaround:**
- Breaks if message content is duplicated
- Adds complexity to frontend
- Doesn't scale well
- Should be temporary only

---

## Contact

**Frontend Team:** Ready to test fix once implemented
**Test Session ID:** `4b7312ba-27f9-447a-8d70-7f370a7cd819` (Krishna presentation)
**Backend Logs:** Available in Railway logs around 2025-11-29 19:47:49 UTC

---

## Status Updates

**2025-11-29 (Morning):** Issue identified and documented
**2025-11-29 (Afternoon):** ✅ **RESOLVED** - Director team implemented fix

---

## Resolution - FIXED ✅

**Date:** 2025-11-29
**Fixed By:** Director Team
**Commit:** 9408b24 (feature/session-history-restoration)
**Deployed To:** Railway (auto-deployment)

### Changes Implemented by Director Team

**1. src/models/websocket_messages.py:**
- Added optional `role` field to BaseMessage model
- Updated `create_chat_message()` helper to accept role parameter
- Backward compatible (role is optional)

**2. src/handlers/websocket.py:**
- Updated `_restore_conversation_history()` to pass `role='user'` for user messages
- Added comment explaining critical nature of role field

**3. src/utils/streamlined_packager.py:**
- Updated 8 locations to properly set role field
- Ensures all message types include role information

### Frontend Integration

**Frontend changes (commit 44457e7):**
- Added support for Director's `role` field (priority 1 classification method)
- Kept content-matching workaround for backward compatibility
- Enhanced logging to track which classification method is used

**Classification Priority:**
1. **ROLE_FIELD** - Use Director's `role` field (new messages)
2. **USER_MESSAGE_IDS_REF** - Use tracked message IDs (existing logic)
3. **CONTENT_MATCH** - Content matching fallback (old sessions)

### Expected Message Format

**New Format (with role field):**
```json
{
  "message_id": "abc123",
  "type": "chat_message",
  "payload": {"text": "Krishna"},
  "timestamp": "2025-11-29T...",
  "role": "user"  ← ADDED BY DIRECTOR FIX
}
```

### Verification

**Test Results:**
- ✅ User messages appear on RIGHT with user icon
- ✅ Assistant messages appear on LEFT with bot icon
- ✅ Conversation history properly restored after refresh
- ✅ Backward compatible with old sessions

**Workaround Status:**
- Maintained for backward compatibility
- New sessions use `role` field (fast, reliable)
- Old sessions fall back to content matching
- Can be removed after old sessions expire (~1-2 weeks)

### Lessons Learned

1. **Two-Database Issue:** Frontend and Director each have their own databases - changes must be coordinated
2. **WebSocket Message Format:** Critical to include semantic information (role, type) in WebSocket messages
3. **Backward Compatibility:** Always maintain fallback for existing data
4. **Collaboration:** Quick turnaround when frontend and backend teams work together

---

## Final Status: **CLOSED** ✅

Issue fully resolved. Frontend and backend now properly handle user/bot message classification on session restoration.
