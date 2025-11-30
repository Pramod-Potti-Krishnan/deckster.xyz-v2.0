# Director Service Requirements Document

## Overview

This document outlines required changes to the Director service to fix session message restoration issues in the frontend. These changes will improve message ordering, reduce unnecessary data transfer, and ensure proper user/assistant message classification.

**Date**: November 30, 2025
**Session Reference**: `4ec948ca-a0fd-4635-bec2-d9f0cb8e6a12`

---

## Current Issues Observed

### Issue 1: Role Field Missing in WebSocket Messages

**Current Behavior**: When replaying conversation history via WebSocket, messages are sent with `"role": null`

**Evidence from logs**:
```json
{
  "message_id": "msg_30cf8488",
  "session_id": "4ec948ca-a0fd-4635-bec2-d9f0cb8e6a12",
  "timestamp": "2025-11-29T23:56:34.316197",
  "type": "slide_update",
  "role": null,
  "payload": {...}
}
```

**But Supabase has the role**:
```python
{'role': 'user', 'content': 'Stranger Things', 'timestamp': '2025-11-29T23:55:40.687594'}
```

**Impact**: Frontend cannot distinguish user messages from assistant messages, causing:
- User's first topic ("Stranger Things") to be missing or misclassified
- Incorrect message ordering in the UI

### Issue 2: Timestamps Without Timezone Indicator

**Current Behavior**: Timestamps are sent without 'Z' suffix

**Evidence**:
```json
"timestamp": "2025-11-29T23:56:34.316197"
```

**Impact**: JavaScript's `new Date()` parses this as LOCAL time instead of UTC, causing timezone offset bugs (messages appear hours off in different timezones).

### Issue 3: Excessive History Replay

**Current Behavior**: Director sends ALL 11 conversation messages on EVERY WebSocket reconnection

**Evidence from logs**:
```
📤 SENDING MESSAGE 1/11
📤 SENDING MESSAGE 2/11
...
📤 SENDING MESSAGE 11/11
```

**Impact**:
- Unnecessary bandwidth usage
- Frontend must deduplicate messages on every reconnect
- Race conditions between frontend DB load and Director replay

---

## Required Changes

### Change 1: Preserve Role Field in WebSocket Messages

**Priority**: HIGH

When packaging conversation history for WebSocket transmission, preserve the `role` field from Supabase.

**Current conversation_history in Supabase**:
```python
{'role': 'user', 'content': 'Stranger Things', 'timestamp': '2025-11-29T23:55:40.687594'}
{'role': 'assistant', 'state': 'ASK_CLARIFYING_QUESTIONS', 'content': {...}, 'timestamp': '...'}
```

**Expected WebSocket message**:
```json
{
  "message_id": "msg_xxx",
  "session_id": "...",
  "timestamp": "2025-11-29T23:55:40.687594Z",
  "type": "chat_message",
  "role": "user",
  "payload": {"text": "Stranger Things"}
}
```

**Implementation suggestion**: In the message packaging code, copy the `role` field from the conversation history entry to the WebSocket message.

### Change 2: Use ISO 8601 Timestamps with UTC Indicator

**Priority**: HIGH

All timestamps sent to frontend must include timezone indicator.

**Current**:
```json
"timestamp": "2025-11-29T23:56:34.316197"
```

**Expected**:
```json
"timestamp": "2025-11-29T23:56:34.316197Z"
```

**Implementation suggestion**: Ensure all datetime objects are converted to ISO format with 'Z' suffix:
```python
timestamp_str = dt.isoformat() + 'Z' if not dt.tzinfo else dt.isoformat()
```

### Change 3: Implement Sync Protocol to Avoid Redundant History Replay

**Priority**: MEDIUM

Add a handshake protocol where frontend informs Director what messages it already has.

**Proposed Protocol**:

1. **Frontend sends sync request on connect**:
```json
{
  "type": "sync_request",
  "session_id": "4ec948ca-a0fd-4635-bec2-d9f0cb8e6a12",
  "last_message_id": "msg_f084296c",
  "message_count": 12
}
```

2. **Director responds with sync decision**:
```json
{
  "type": "sync_response",
  "action": "skip_history" | "send_history" | "send_delta",
  "missing_message_ids": ["msg_xxx", "msg_yyy"]
}
```

3. **If action is "skip_history"**: Director only sends new messages going forward
4. **If action is "send_delta"**: Director sends only missing messages
5. **If action is "send_history"**: Director sends full history (fallback for corrupted state)

**Alternative simpler approach**:
- Frontend sends `skip_history: true` flag on connect when it has cached messages
- Director skips history replay if flag is present

### Change 4: Send Messages in Chronological Order

**Priority**: MEDIUM

Ensure historical messages are sent in timestamp order (earliest first).

**Current observation**: Messages appear to be sent in random order based on log interleaving:
```
📤 SENDING MESSAGE 1/11 Type: chat_message
📤 SENDING MESSAGE 2/11 Type: chat_message
📤 SENDING MESSAGE 6/11 Type: chat_message  // Out of order
📤 SENDING MESSAGE 3/11 Type: chat_message
```

**Expected**: Messages should be sent in strict chronological order to allow frontend to render progressively.

### Change 5: Validate Message Count for Cache Integrity (NEW)

**Priority**: HIGH

**Date Added**: November 30, 2025

The frontend now sends a `message_count` query parameter in the WebSocket URL. Director should validate this count against Supabase and override `skip_history` if there's a mismatch.

**WebSocket URL Format**:
```
wss://director.../ws?session_id=xxx&user_id=yyy&skip_history=true&message_count=8
```

**Implementation**:

```python
# Parse query parameters
message_count = int(query_params.get('message_count', 0))
skip_history = query_params.get('skip_history', 'false') == 'true'

# Get actual count from Supabase
supabase_count = len(session.conversation_history)

# Validate cache completeness
if skip_history and message_count != supabase_count:
    print(f"⚠️ Cache mismatch: frontend={message_count}, supabase={supabase_count}")
    skip_history = False  # Force history replay - cache is incomplete/corrupt

if not skip_history:
    await send_full_history(websocket, session)
else:
    # Send sync_response to confirm skip
    await send_sync_response(websocket, action='skip_history', message_count=supabase_count)
```

**Why This Is Critical**:
- Frontend's sessionStorage cache can become corrupt or incomplete
- Without validation, `skip_history=true` would cause data loss
- This provides a safety net - Director has the source of truth (Supabase)

---

## WebSocket Message Schema (Updated)

```typescript
interface DirectorMessage {
  message_id: string;           // Unique message ID
  session_id: string;           // Session UUID
  timestamp: string;            // ISO 8601 with 'Z' suffix
  type: 'chat_message' | 'action_request' | 'slide_update' | 'presentation_url' | 'status_update';
  role: 'user' | 'assistant' | null;  // NEW: Must be set for chat_message types
  payload: object;              // Type-specific payload
}
```

---

## Testing Checklist

After implementing these changes, verify:

- [ ] User messages have `role: "user"` in WebSocket transmission
- [ ] Assistant messages have `role: "assistant"` in WebSocket transmission
- [ ] All timestamps end with 'Z' suffix
- [ ] Reconnecting to existing session does not replay full history (with sync protocol)
- [ ] Messages are received in chronological order
- [ ] Frontend displays first user message ("Stranger Things" in test case) correctly
- [ ] Message order is consistent between initial load and page refresh

---

## Frontend Workarounds Implemented

While waiting for Director fixes, the frontend has implemented these workarounds:

1. **Timestamp normalization**: Frontend now appends 'Z' suffix to timestamps that don't have it
2. **Role field detection**: Frontend checks for `role: 'user'` and properly classifies those messages
3. **Content-matching fallback**: Frontend matches message content to identify user messages
4. **Deduplication**: Frontend deduplicates messages by ID and content

However, these workarounds cannot fully solve the problem without Director cooperation on:
- Sending the `role` field (most critical)
- Reducing history replay redundancy

---

## Contact

For questions about frontend expectations, refer to:
- `app/builder/page.tsx` lines 1180-1340 (message classification and sorting)
- `hooks/use-deckster-websocket-v2.ts` (WebSocket message handling)
- `hooks/use-session-persistence.ts` (message persistence)
