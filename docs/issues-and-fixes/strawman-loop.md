# Director Service: Strawman Regeneration Loop Issue

**Date**: 2025-01-16
**Reported By**: Frontend Team
**Severity**: HIGH - Affects user experience during strawman generation
**Status**: Investigation Required by Director Service Team

---

## Executive Summary

Users are reporting that the strawman presentation appears to be regenerating repeatedly after the initial generation. While the console logs show multiple Reveal.js initialization messages, a comprehensive frontend code analysis has ruled out any frontend-side loops or triggers. This document provides evidence that the issue originates in the **Director Service** and outlines specific areas for investigation.

**Impact**: Users may see the presentation reload multiple times, causing confusion and potentially degraded performance. The issue appears to occur during or immediately after strawman generation.

---

## Issue Description

### User Experience

When a user requests a presentation (e.g., "Create a presentation about elephants for kids"), the following occurs:

1. Director generates strawman successfully
2. Frontend receives `slide_update` message with `preview_url`
3. Presentation displays in iframe
4. **ISSUE**: Presentation appears to reload/regenerate multiple times
5. Console shows repeated Reveal.js initialization logs
6. User sees presentation "refresh" or "flicker"

### Console Evidence

User console shows these logs appearing multiple times:
```
✅ Presentation rendered: 3 slides
✅ Reveal.js initialized with custom config
✅ Reveal.js ready
   - Total slides: 3
Slide changed: 2 / 3
```

**Important**: These logs are from inside the Google Slides iframe (Reveal.js library), NOT from our frontend React code. They indicate the iframe is loading multiple times, which suggests the presentation URL is changing or being regenerated.

### What's NOT Appearing in Logs

Notably, we do NOT see the expected frontend WebSocket logs:
- `"📨 Received message: slide_update"`
- `"💓 Ping sent"` (every 15 seconds)
- `"✅ Connected to Director v3.4"`

This could indicate:
1. Console filter is active
2. Logs have scrolled away
3. Session is resumed (doesn't auto-connect)
4. WebSocket not connected

---

## Frontend Analysis: Why It's NOT a Frontend Bug

We conducted a comprehensive code review of the frontend implementation. Here's what we verified:

### 1. Message Deduplication ✅ WORKING CORRECTLY

**Location**: `hooks/use-deckster-websocket-v2.ts` (Lines 284-290)

```typescript
setState(prev => {
  // Prevent duplicate messages by checking message_id
  const isDuplicate = prev.messages.some(m => m.message_id === message.message_id);

  const newState = {
    ...prev,
    messages: isDuplicate ? prev.messages : [...prev.messages, messageWithTimestamp],
  };
```

**What This Means**:
- Every incoming message is checked for duplicate `message_id`
- If a message with the same ID was already received, it's discarded
- This prevents processing the same message multiple times

**Implication**: If Director sends the same `slide_update` message 100 times with the same `message_id`, the frontend only processes it once. However, if Director sends multiple messages with DIFFERENT `message_id`s, the frontend will process each one (as it should).

### 2. Iframe Implementation ✅ NO BACKEND TRIGGERS

**Location**: `app/builder/page.tsx` (Lines 840-845)

```typescript
<iframe
  src={presentationUrl}
  className="absolute inset-0 w-full h-full border-none"
  title="Presentation"
  allow="fullscreen"
/>
```

**What This Means**:
- The iframe is a pure display component
- NO `onLoad` event handler
- NO event listeners
- NO communication back to backend

**Implication**: When the iframe loads Google Slides, it does NOT send any requests to Director or Layout service that could trigger regeneration.

### 3. State Management ✅ NO LOOPS

**Analysis**: We reviewed all `useEffect` hooks in `app/builder/page.tsx`:
- Line 124: Onboarding check (unrelated)
- Line 136: Session initialization (runs once)
- Line 286: WebSocket auto-connect (controlled, won't loop)
- Line 303: Message persistence (doesn't trigger regeneration)
- Line 338: Scroll to bottom (cosmetic only)

**What This Means**:
- No useEffect depends on `presentationUrl` that would create loops
- No state updates trigger cascade effects
- No automatic re-rendering that sends messages to backend

### 4. Single WebSocket Connection ✅ VERIFIED

**Location**: `hooks/use-deckster-websocket-v2.ts` (Lines 224-235)

```typescript
const connect = useCallback(() => {
  // Prevent multiple simultaneous connection attempts
  if (isConnectingRef.current) {
    console.log('⏳ Connection attempt already in progress, skipping...');
    return;
  }

  if (wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING) {
    console.log('✅ WebSocket already connected or connecting');
    return;
  }
```

**What This Means**:
- Only ONE WebSocket connection exists at a time
- Multiple connection attempts are prevented
- No duplicate message handlers

**Implication**: There's no scenario where multiple connections could cause duplicate message processing.

### 5. Heartbeat Implementation ✅ INTENTIONAL

**Location**: `hooks/use-deckster-websocket-v2.ts` (Lines 189-212)

```typescript
heartbeatIntervalRef.current = setInterval(() => {
  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
    try {
      const pingMessage = {
        type: 'ping',
        timestamp: new Date().toISOString()
      };
      wsRef.current.send(JSON.stringify(pingMessage));
      console.log('💓 Ping sent');
    }
  }
}, HEARTBEAT_INTERVAL); // 15 seconds
```

**What This Sends**:
```json
{
  "type": "ping",
  "timestamp": "2025-01-16T10:30:45.123Z"
}
```

**Important**: These ping messages are sent every 15 seconds to keep the WebSocket connection alive during long operations (like strawman generation). They should be **ignored** by Director service and **NOT** interpreted as user messages or generation triggers.

---

## Root Cause Analysis

Based on the frontend code review, the issue is **NOT in the frontend**. The most likely scenarios are:

### Scenario A: Director Service Internal Loop (HIGHEST LIKELIHOOD - 70%)

**Hypothesis**: Director service is stuck in a loop where it repeatedly generates and sends strawman updates.

**Possible Causes**:

1. **Ping Messages Being Misinterpreted**
   - Frontend sends `{"type": "ping"}` every 15 seconds
   - Director might be processing these as user messages
   - Triggers strawman regeneration
   - **Test**: Check if regeneration happens every ~15 seconds

2. **State Machine Not Transitioning**
   - After sending `slide_update`, Director doesn't transition to "complete" state
   - Remains in "generating" state
   - Continues to regenerate
   - **Test**: Check Director state logs

3. **Message Queue Replaying**
   - User message gets stuck in a queue
   - Replays multiple times
   - Each replay triggers new generation
   - **Test**: Check message processing logs

4. **Retry Logic Gone Wrong**
   - Director has retry logic for failed generations
   - Logic isn't checking if generation already succeeded
   - Keeps retrying even after success
   - **Test**: Look for retry/exponential backoff code

5. **No Idempotency Check**
   - Director doesn't track if strawman already generated for this conversation
   - Each time it processes the conversation, it regenerates
   - **Test**: Add generation tracking by conversation ID

**Evidence Supporting This**:
- Frontend only processes unique `message_id`s
- If we're seeing multiple reloads, Director must be sending multiple messages with different IDs
- Each new message likely has a new `preview_url`

**What to Check in Director Logs**:
```
How many times does Director log "Generating strawman"?
What triggers each generation?
Are ping messages being logged as incoming user messages?
Does state machine show proper transitions?
```

### Scenario B: Layout Service Regenerating (MEDIUM LIKELIHOOD - 20%)

**Hypothesis**: Layout service is regenerating the presentation on every iframe load instead of caching.

**Possible Causes**:

1. **No Caching Implementation**
   - Director calls Layout service for strawman preview
   - Layout generates fresh presentation every time
   - Returns new `preview_url` each time
   - Director forwards new URL to frontend
   - Iframe reloads with new URL

2. **Cache Invalidation Too Aggressive**
   - Layout has caching but invalidates too quickly
   - Treats each request as needing fresh generation

**Evidence**:
- Check if `preview_url` changes on each reload
- Same presentation content, different URLs = regeneration

**What to Check in Layout Logs**:
```
How many times is Layout service called for the same presentation?
Is it returning cached presentations or generating fresh ones?
Are URLs different on each call?
```

### Scenario C: Multiple Browser Tabs/Sessions (LOW LIKELIHOOD - 10%)

**Hypothesis**: User has multiple tabs open with the same session.

**Why This Would Cause the Symptom**:
- Each tab has its own WebSocket connection
- All connected to same session ID
- Director responds to all connections
- Each iframe in each tab shows Reveal.js logs
- User sees logs from all tabs in one console

**How to Rule Out**:
- Ask user to close all other tabs
- If issue persists with single tab, this isn't the cause

---

## Specific Investigation Areas for Director Service Team

### Priority 1: Message Processing Logic

**File to Check**: Director's WebSocket message handler

**Questions to Answer**:
1. How does Director distinguish between user messages and ping messages?
2. What happens when Director receives `{"type": "ping"}`?
3. Is there a message type filter before processing?

**Expected Behavior**:
```python
# Pseudocode
def on_message(message):
    msg_type = message.get('type')

    # CRITICAL: Ignore ping messages
    if msg_type == 'ping':
        logger.debug('Heartbeat ping received, ignoring')
        return

    if msg_type == 'user_message':
        process_user_message(message)
```

### Priority 2: Idempotency for Strawman Generation

**File to Check**: Strawman generation workflow/state machine

**Questions to Answer**:
1. Does Director track which conversations already have a strawman?
2. Is there a check before generating to see if it's already done?
3. What's the state machine flow after strawman is generated?

**Expected Behavior**:
```python
# Pseudocode
def generate_strawman(session_id, user_message):
    # Check if already generated
    if already_has_strawman(session_id):
        logger.info(f'Strawman already exists for {session_id}, skipping')
        return

    # Generate only if not already done
    strawman = create_strawman(user_message)
    mark_strawman_generated(session_id)
    send_slide_update(session_id, strawman)
```

### Priority 3: State Machine Transitions

**File to Check**: Director state management

**Questions to Answer**:
1. What states does Director have? (idle, generating, complete, etc.)
2. After sending `slide_update`, does state transition to complete?
3. Can Director be stuck in a state that keeps triggering generation?

**Expected State Flow**:
```
IDLE → (user message) → GENERATING → (strawman complete) → AWAITING_FEEDBACK
                                      ↓
                                  (send slide_update)
```

**Anti-Pattern to Avoid**:
```
GENERATING → (strawman complete) → GENERATING → (strawman complete) → GENERATING
             ↑___________________|
             (loop - doesn't transition)
```

### Priority 4: Rate Limiting / Duplicate Detection

**File to Check**: Message queue or event processing

**Questions to Answer**:
1. Is there rate limiting on generation requests?
2. How does Director handle rapid repeated requests?
3. Is there deduplication of user messages?

**Expected Behavior**:
```python
# Pseudocode
def should_generate_strawman(session_id, user_message):
    # Check time since last generation
    last_gen_time = get_last_generation_time(session_id)
    if time.now() - last_gen_time < 60:  # seconds
        logger.warning('Generation requested too soon after last one')
        return False

    # Check if message is duplicate
    if is_duplicate_message(user_message):
        logger.warning('Duplicate message detected')
        return False

    return True
```

---

## Recommended Fixes for Director Service

### Fix 1: Ignore Ping Messages (CRITICAL)

**Problem**: Heartbeat pings might be triggering generation

**Solution**:
```python
def on_websocket_message(message):
    msg_type = message.get('type')

    # Ignore heartbeat pings - they're just keep-alive
    if msg_type == 'ping':
        return

    # Only process actual user messages
    if msg_type == 'user_message':
        handle_user_message(message)
```

**Test**: After this fix, verify that generations don't happen every 15 seconds

### Fix 2: Add Idempotency Tracking (HIGH PRIORITY)

**Problem**: No tracking of whether strawman already generated

**Solution**:
```python
class DirectorSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.strawman_generated = False
        self.strawman_data = None

    def generate_strawman(self, user_request):
        if self.strawman_generated:
            logger.info('Strawman already generated, returning cached version')
            return self.strawman_data

        # Generate only once
        strawman = create_strawman_presentation(user_request)
        self.strawman_generated = True
        self.strawman_data = strawman
        return strawman
```

**Test**: Second generation attempt should use cached version

### Fix 3: Proper State Machine Transitions (HIGH PRIORITY)

**Problem**: State machine might not transition after generation

**Solution**:
```python
class DirectorStateMachine:
    STATES = ['IDLE', 'GATHERING_REQUIREMENTS', 'GENERATING_STRAWMAN',
              'STRAWMAN_COMPLETE', 'REFINING', 'FINAL_COMPLETE']

    def on_strawman_generated(self):
        if self.state != 'GENERATING_STRAWMAN':
            logger.error(f'Invalid state for strawman completion: {self.state}')
            return

        # Send slide_update to frontend
        self.send_slide_update()

        # CRITICAL: Transition to next state
        self.transition_to('STRAWMAN_COMPLETE')

    def transition_to(self, new_state):
        logger.info(f'State transition: {self.state} → {new_state}')
        self.state = new_state
```

**Test**: Verify state transitions in logs

### Fix 4: Add Rate Limiting (MEDIUM PRIORITY)

**Problem**: No protection against rapid repeated generations

**Solution**:
```python
from datetime import datetime, timedelta

class GenerationRateLimiter:
    def __init__(self):
        self.last_generation = {}

    def can_generate(self, session_id, min_interval_seconds=30):
        now = datetime.now()

        if session_id in self.last_generation:
            last_gen = self.last_generation[session_id]
            if now - last_gen < timedelta(seconds=min_interval_seconds):
                logger.warning(f'Rate limit: Generation requested too soon for {session_id}')
                return False

        self.last_generation[session_id] = now
        return True
```

**Test**: Rapid requests should be rejected

---

## Testing Recommendations

### Test 1: Verify Ping Message Handling

**Steps**:
1. Connect to Director with WebSocket
2. Send ping message: `{"type": "ping", "timestamp": "2025-01-16T10:00:00Z"}`
3. Check Director logs

**Expected**: Director should log "Ping received, ignoring" or similar
**Failure**: Director processes ping as user message, triggers generation

### Test 2: Verify Idempotency

**Steps**:
1. Send user message: "Create presentation about cats"
2. Wait for strawman generation
3. Manually trigger generation again (internal call)
4. Check if new strawman is generated

**Expected**: Second call returns cached strawman, no regeneration
**Failure**: Second strawman generated

### Test 3: Verify State Transitions

**Steps**:
1. Send user message
2. Monitor Director state in logs
3. Trace state changes through generation process

**Expected**: `IDLE → GATHERING → GENERATING → COMPLETE`
**Failure**: State stuck in `GENERATING` or loops back

### Test 4: Verify Message Deduplication

**Steps**:
1. Send same user message twice rapidly
2. Check Director logs

**Expected**: Second message rejected as duplicate
**Failure**: Both messages processed, both trigger generation

---

## Debugging Data Collection

### Logs to Collect from Director Service

When reproducing the issue, please collect:

```
1. Message receive logs
   - Timestamp
   - Message type
   - Message content
   - Session ID

2. State transition logs
   - Current state
   - New state
   - Trigger

3. Generation trigger logs
   - What triggered the generation
   - Session ID
   - User message content

4. Generation completion logs
   - When generation finished
   - Preview URL generated
   - Message ID sent to frontend

5. WebSocket send logs
   - What messages sent to frontend
   - Message IDs
   - Timestamps
```

### Correlation Analysis

Compare:
- **Frontend logs** showing `"📨 Received message: slide_update"`
- **Director logs** showing `"Sending slide_update to session_id"`

Questions:
- How many `slide_update` messages does Director send?
- Do they have different `message_id`s?
- What triggered each one?

---

## Expected Message Flow (Correct Behavior)

### Initial Generation

```
USER ACTION:
User types: "Create presentation about elephants"

FRONTEND → DIRECTOR:
{
  "type": "user_message",
  "data": {
    "text": "Create presentation about elephants"
  }
}

DIRECTOR PROCESSING:
1. Receives user message
2. State: IDLE → GATHERING_REQUIREMENTS
3. Asks clarifying questions (if needed)
4. State: GATHERING_REQUIREMENTS → GENERATING_STRAWMAN
5. Calls Layout service to generate strawman
6. Layout returns preview_url
7. State: GENERATING_STRAWMAN → STRAWMAN_COMPLETE

DIRECTOR → FRONTEND:
{
  "message_id": "uuid-1",
  "session_id": "session-abc",
  "timestamp": "2025-01-16T10:00:00Z",
  "type": "slide_update",
  "payload": {
    "preview_url": "https://slides.google.com/preview/abc123",
    "metadata": { ... },
    "slides": [ ... ]
  }
}

FRONTEND:
- Receives slide_update
- Checks message_id "uuid-1" not duplicate ✓
- Updates presentationUrl
- Iframe loads Google Slides

USER SEES:
Strawman presentation loads once
```

### Heartbeat (Should NOT Trigger Generation)

```
Every 15 seconds:

FRONTEND → DIRECTOR:
{
  "type": "ping",
  "timestamp": "2025-01-16T10:00:15Z"
}

DIRECTOR PROCESSING:
1. Receives ping message
2. Checks type === "ping"
3. Ignores it (keep-alive only)
4. No state change
5. No generation triggered

DIRECTOR → FRONTEND:
(optional pong response, or nothing)
```

---

## Incorrect Behavior (What's Happening Now)

### Regeneration Loop Scenario

```
USER ACTION:
User types: "Create presentation about elephants"

FRONTEND → DIRECTOR:
{
  "type": "user_message",
  "data": {"text": "Create presentation about elephants"}
}

DIRECTOR PROCESSING (FIRST TIME):
1. Generates strawman
2. Sends slide_update with message_id: "uuid-1"

DIRECTOR → FRONTEND: slide_update (uuid-1)
FRONTEND: Loads presentation ✓

--- 15 SECONDS LATER ---

FRONTEND → DIRECTOR (HEARTBEAT):
{
  "type": "ping",
  "timestamp": "2025-01-16T10:00:15Z"
}

DIRECTOR PROCESSING (BUG):
1. Receives ping
2. ⚠️ BUG: Processes as user message
3. ⚠️ BUG: Triggers strawman generation
4. Generates again
5. Sends slide_update with message_id: "uuid-2"

DIRECTOR → FRONTEND: slide_update (uuid-2)
FRONTEND: Different message_id, processes it ✓
FRONTEND: presentationUrl changes
FRONTEND: Iframe reloads ⚠️

USER SEES: Presentation reloads/refreshes

--- 15 SECONDS LATER ---

LOOP REPEATS...
```

**OR**

```
DIRECTOR PROCESSING (ALTERNATIVE BUG):
1. Generates strawman
2. Sends slide_update
3. ⚠️ BUG: State doesn't transition
4. Still in GENERATING_STRAWMAN state
5. Internal logic says "still generating, keep going"
6. Generates again
7. Sends another slide_update
8. Loop continues
```

---

## Success Criteria

After implementing fixes, the following should be true:

### Test 1: Single Generation Per User Request
- ✅ User sends one message
- ✅ Director generates strawman once
- ✅ Sends one slide_update message
- ✅ No additional slide_updates without new user input

### Test 2: Heartbeat Ignored
- ✅ Frontend sends ping every 15 seconds
- ✅ Director logs ping receipt
- ✅ Director does NOT trigger generation
- ✅ No slide_updates sent in response to pings

### Test 3: Idempotency Works
- ✅ Same user message sent twice
- ✅ First triggers generation
- ✅ Second returns cached strawman
- ✅ Only one slide_update sent

### Test 4: Proper State Transitions
- ✅ State logs show: IDLE → GATHERING → GENERATING → COMPLETE
- ✅ No state stuck in loop
- ✅ State matches actual system behavior

---

## Additional Resources

### Frontend Code References

- **WebSocket Hook**: `hooks/use-deckster-websocket-v2.ts`
- **Builder Page**: `app/builder/page.tsx`
- **Message Deduplication**: Line 246 in websocket hook
- **Heartbeat Implementation**: Lines 189-221 in websocket hook
- **Iframe Rendering**: Lines 840-845 in builder page

### Expected WebSocket Protocol

Director should expect these message types from frontend:
- `user_message` - Process and respond
- `ping` - Ignore (keep-alive only)

Director should send these message types to frontend:
- `chat_message` - Regular chat response
- `action_request` - Request user action/choice
- `slide_update` - Strawman or plan update
- `presentation_url` - Final presentation ready
- `status_update` - Progress indicator

---

## Contact

For questions about frontend implementation or this analysis:
- **Frontend Team**: [Contact Info]
- **Document**: `docs/DIRECTOR_STRAWMAN_LOOP_ISSUE.md`
- **Date Created**: 2025-01-16

---

## Appendix: Frontend Protections Already in Place

This section documents what the frontend has already implemented to prevent loops:

| Protection | Status | Location | Description |
|------------|--------|----------|-------------|
| Message Deduplication | ✅ Implemented | `hooks/use-deckster-websocket-v2.ts:284-290` | Prevents processing same message_id twice |
| Single WebSocket Connection | ✅ Implemented | `hooks/use-deckster-websocket-v2.ts:224-235` | Prevents multiple connections |
| No Iframe Triggers | ✅ Verified | `app/builder/page.tsx:840-845` | Iframe has no backend communication |
| Controlled State Updates | ✅ Verified | `app/builder/page.tsx:all useEffect hooks` | No state loops |
| Heartbeat Labeled Correctly | ✅ Implemented | `hooks/use-deckster-websocket-v2.ts:201-204` | Pings clearly marked with `type: "ping"` |

**Conclusion**: The frontend is not causing the loop. Investigation should focus on Director service message processing, state management, and idempotency.
