# Director v2.0 Frontend Integration Guide

**Version**: 2.0
**Protocol**: WebSocket with Streamlined Message Protocol
**Last Updated**: 2025-10-12

---

## Table of Contents

1. [Overview](#overview)
2. [WebSocket Connection](#websocket-connection)
3. [Message Protocol](#message-protocol)
4. [Message Types Reference](#message-types-reference)
5. [Conversation Flow](#conversation-flow)
6. [UI Implementation Guide](#ui-implementation-guide)
7. [Code Examples](#code-examples)
8. [Error Handling](#error-handling)
9. [Testing](#testing)

---

## Overview

Director v2.0 is an AI-powered presentation assistant that guides users through creating presentations via a conversational interface. The system uses WebSocket for real-time, bidirectional communication.

### Key Features:
- Real-time conversational UI
- Multi-stage presentation creation workflow
- AI-generated presentations with deck-builder integration
- Returns presentation URLs for immediate viewing

### UI Layout:
```
┌──────────────────────────────────────────────────────────┐
│                     Director v2.0                        │
├──────────────────────┬───────────────────────────────────┤
│                      │                                   │
│   CHAT INTERFACE     │    PRESENTATION DISPLAY          │
│   (Left Side)        │    (Right Side)                  │
│                      │                                   │
│ • Messages           │ • Initially empty                 │
│ • Questions          │ • Shows presentation iframe       │
│ • Actions            │   when URL received               │
│ • Status updates     │ • Full-screen reveal.js          │
│                      │   presentation                    │
│                      │                                   │
└──────────────────────┴───────────────────────────────────┘
```

---

## WebSocket Connection

### Connection URL

**Production**:
```
wss://directorv20-production.up.railway.app/ws?session_id={SESSION_ID}&user_id={USER_ID}
```

**Local Development**:
```
ws://localhost:8000/ws?session_id={SESSION_ID}&user_id={USER_ID}
```

### Required Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | UUID | Yes | Unique session identifier (generate client-side) |
| `user_id` | String | Yes | User identifier (can be username or UUID) |

### Generating IDs

```javascript
// Generate session_id (UUID v4)
const sessionId = crypto.randomUUID();
// Or: import { v4 as uuidv4 } from 'uuid'; const sessionId = uuidv4();

// Generate user_id
const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
// Or use authenticated user ID: const userId = currentUser.id;
```

### Connection Example

```javascript
const sessionId = crypto.randomUUID();
const userId = 'user_12345';
const wsUrl = `wss://directorv20-production.up.railway.app/ws?session_id=${sessionId}&user_id=${userId}`;

const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  console.log('Connected to Director v2.0');
  // Greeting will be automatically sent by server
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleMessage(message);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Connection closed');
};
```

---

## Message Protocol

### Sending Messages (Client → Server)

All user messages follow this structure:

```json
{
  "type": "user_message",
  "data": {
    "text": "User's message text here"
  }
}
```

**JavaScript Example**:
```javascript
function sendMessage(text) {
  const message = {
    type: "user_message",
    data: {
      text: text
    }
  };
  ws.send(JSON.stringify(message));
}

// Usage
sendMessage("I need a presentation about AI in healthcare");
```

### Receiving Messages (Server → Client)

All server messages have this base structure:

```json
{
  "message_id": "msg_abc123",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-10-12T10:30:00.000Z",
  "type": "chat_message|action_request|status_update|presentation_url",
  "payload": {
    // Type-specific payload data
  }
}
```

---

## Message Types Reference

### 1. `chat_message` - Conversational Content

Used for: Greetings, questions, explanations, confirmations

```json
{
  "message_id": "msg_abc123",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-10-12T10:30:00.000Z",
  "type": "chat_message",
  "payload": {
    "text": "Hello! I'm Deckster, your AI presentation assistant.",
    "sub_title": "Optional subtitle text",
    "list_items": [
      "First item",
      "Second item",
      "Third item"
    ],
    "format": "markdown"
  }
}
```

**Payload Fields**:
- `text` (string, required): Main message text (supports markdown)
- `sub_title` (string, optional): Subtitle or section header
- `list_items` (array, optional): Bulleted list items
- `format` (string, optional): "markdown" or "plain" (default: "markdown")

**UI Rendering**:
```
┌─────────────────────────────────────┐
│ 🤖 Director                         │
│                                     │
│ Hello! I'm Deckster, your AI        │
│ presentation assistant.             │
│                                     │
│ Optional subtitle text              │
│ • First item                        │
│ • Second item                       │
│ • Third item                        │
└─────────────────────────────────────┘
```

---

### 2. `action_request` - User Interaction Prompt

Used for: Binary choices, confirmations, decision points

```json
{
  "message_id": "msg_def456",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-10-12T10:31:00.000Z",
  "type": "action_request",
  "payload": {
    "prompt_text": "Does this structure work for you?",
    "actions": [
      {
        "label": "Yes, let's build it!",
        "value": "accept_plan",
        "primary": true,
        "requires_input": false
      },
      {
        "label": "I'd like to make changes",
        "value": "reject_plan",
        "primary": false,
        "requires_input": true
      }
    ]
  }
}
```

**Payload Fields**:
- `prompt_text` (string, required): Question or prompt for user
- `actions` (array, required): Available actions
  - `label` (string): Button text
  - `value` (string): Internal action identifier (not sent back)
  - `primary` (boolean): Visual emphasis (primary button style)
  - `requires_input` (boolean): If true, show text input with button

**UI Rendering**:
```
┌─────────────────────────────────────┐
│ Does this structure work for you?   │
│                                     │
│ [Yes, let's build it!] (primary)    │
│ [I'd like to make changes]          │
└─────────────────────────────────────┘
```

**User Response**:
When user clicks a button:
- If `requires_input: false` → Send button label as message
- If `requires_input: true` → Show text input, send user's typed text

```javascript
// Primary action (no input required)
sendMessage("Yes, let's build it!");

// Secondary action (input required)
sendMessage("Please add more slides about data security");
```

---

### 3. `status_update` - Progress Indication

Used for: Loading states, progress tracking, completion

```json
{
  "message_id": "msg_ghi789",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-10-12T10:32:00.000Z",
  "type": "status_update",
  "payload": {
    "status": "generating",
    "text": "Creating your presentation...",
    "progress": 45,
    "estimated_time": 10
  }
}
```

**Payload Fields**:
- `status` (string, required): Status level
  - `"idle"` - Ready state
  - `"thinking"` - Processing user input
  - `"generating"` - Creating presentation
  - `"complete"` - Task finished
  - `"error"` - Error occurred
- `text` (string, required): Status message
- `progress` (number, optional): 0-100 percentage
- `estimated_time` (number, optional): Seconds remaining

**UI Rendering**:
```
┌─────────────────────────────────────┐
│ ⏳ Creating your presentation...    │
│ [████████████░░░░░░░░] 45%         │
│ About 10 seconds remaining          │
└─────────────────────────────────────┘
```

**Status Icons**:
- `idle`: ⏸️ or blank
- `thinking`: 🤔 or 💭
- `generating`: ⏳ or animated spinner
- `complete`: ✅
- `error`: ❌

---

### 4. `presentation_url` - Generated Presentation (v2.0)

Used for: Final presentation delivery with deck-builder URL

```json
{
  "message_id": "msg_jkl012",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-10-12T10:33:00.000Z",
  "type": "presentation_url",
  "payload": {
    "url": "https://web-production-f0d13.up.railway.app/p/abc-123-def-456",
    "presentation_id": "abc-123-def-456",
    "slide_count": 8,
    "message": "Your presentation is ready! View it at: https://..."
  }
}
```

**Payload Fields**:
- `url` (string, required): Full URL to presentation
- `presentation_id` (string, required): Unique presentation identifier
- `slide_count` (number, required): Number of slides
- `message` (string, required): Success message

**UI Actions**:
1. Display success message in chat
2. **Load presentation in right-side iframe**
3. Optionally provide "Open in new tab" button

**UI Rendering**:
```
Left Side (Chat):                Right Side (Display):
┌─────────────────────────┐    ┌────────────────────────┐
│ 🎉 Your presentation    │    │                        │
│    is ready!            │    │   [IFRAME LOADS HERE]  │
│                         │    │                        │
│ 📊 8 slides             │    │   Reveal.js            │
│                         │    │   Presentation         │
│ [Open in new tab] 🔗    │    │                        │
└─────────────────────────┘    └────────────────────────┘
```

**Frontend Implementation**:
```javascript
// When presentation_url received
if (message.type === 'presentation_url') {
  const { url, slide_count, message: successMessage } = message.payload;

  // Update chat with success message
  displayChatMessage({
    text: `🎉 ${successMessage}`,
    metadata: `${slide_count} slides created`
  });

  // Load presentation in right panel iframe
  const iframe = document.getElementById('presentation-iframe');
  iframe.src = url;
  iframe.style.display = 'block';

  // Optional: Add new tab button
  addOpenInNewTabButton(url);
}
```

---

### 5. `state_change` - State Transition (Optional)

Used for: Debugging, state tracking (can be ignored for basic UI)

```json
{
  "message_id": "msg_mno345",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-10-12T10:30:30.000Z",
  "type": "state_change",
  "new_state": "ASK_CLARIFYING_QUESTIONS",
  "previous_state": "PROVIDE_GREETING"
}
```

**Note**: This message type is informational. Most UIs can ignore it.

---

## Conversation Flow

### Complete User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                  CONVERSATION FLOW                          │
└─────────────────────────────────────────────────────────────┘

1. CONNECTION
   ↓
   Server → chat_message (Greeting)
   "Hello! I'm Deckster..."

2. TOPIC SUBMISSION
   ↓
   User → "I need a presentation about AI in healthcare"
   ↓
   Server → chat_message (Clarifying Questions)
   "To create the perfect presentation, I need to know:
    • Who is your audience?
    • What is the duration?
    • What topics should I cover?"

3. QUESTION ANSWERS
   ↓
   User → "Healthcare professionals, 20 minutes, cover diagnostics and treatment"
   ↓
   Server → chat_message (Plan Summary)
   "Perfect! I'll create a 9-slide presentation."
   ↓
   Server → action_request
   "Does this structure work for you?"

4. PLAN CONFIRMATION
   ↓
   User → "Yes, let's build it!"
   ↓
   Server → status_update (progress: 0)
   "Creating your presentation..."
   ↓
   Server → status_update (progress: 50)
   "Creating your presentation..." [if API sends progress]

5. PRESENTATION GENERATION
   ↓
   Server → presentation_url
   {
     "url": "https://web-production-f0d13.up.railway.app/p/abc-123",
     "slide_count": 9,
     "message": "Your presentation is ready!"
   }

6. PRESENTATION DISPLAY
   ↓
   Frontend loads URL in iframe
   User views presentation

7. OPTIONAL: REFINEMENT
   ↓
   User → "Can you make slide 3 more detailed?"
   ↓
   Server → status_update
   "Refining your presentation..."
   ↓
   Server → presentation_url (updated URL)
```

---

## UI Implementation Guide

### Layout Structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>Director v2.0</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .container {
      display: flex;
      height: 100vh;
    }

    /* Left Side: Chat */
    .chat-panel {
      width: 40%;
      display: flex;
      flex-direction: column;
      border-right: 1px solid #ddd;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .chat-input {
      padding: 20px;
      border-top: 1px solid #ddd;
    }

    /* Right Side: Presentation */
    .presentation-panel {
      width: 60%;
      background: #f5f5f5;
      position: relative;
    }

    .presentation-iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: none; /* Hidden until URL received */
    }

    .presentation-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Left Side: Chat Interface -->
    <div class="chat-panel">
      <div class="chat-messages" id="chat-messages">
        <!-- Messages appear here -->
      </div>
      <div class="chat-input">
        <input type="text" id="user-input" placeholder="Type your message...">
        <button onclick="sendMessage()">Send</button>
      </div>
    </div>

    <!-- Right Side: Presentation Display -->
    <div class="presentation-panel">
      <iframe id="presentation-iframe" class="presentation-iframe"></iframe>
      <div id="presentation-placeholder" class="presentation-placeholder">
        <p>Your presentation will appear here once generated</p>
      </div>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

### Message Rendering Functions

```javascript
// Render chat_message
function renderChatMessage(message) {
  const { text, sub_title, list_items, format } = message.payload;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';

  let html = `<div class="message-avatar">🤖</div>`;
  html += `<div class="message-content">`;

  // Main text (markdown support)
  html += `<div class="message-text">${format === 'markdown' ? marked(text) : text}</div>`;

  // Subtitle
  if (sub_title) {
    html += `<div class="message-subtitle">${sub_title}</div>`;
  }

  // List items
  if (list_items && list_items.length > 0) {
    html += `<ul class="message-list">`;
    list_items.forEach(item => {
      html += `<li>${item}</li>`;
    });
    html += `</ul>`;
  }

  html += `</div>`;
  messageDiv.innerHTML = html;

  document.getElementById('chat-messages').appendChild(messageDiv);
  scrollToBottom();
}

// Render action_request
function renderActionRequest(message) {
  const { prompt_text, actions } = message.payload;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant action-request';

  let html = `<div class="action-prompt">${prompt_text}</div>`;
  html += `<div class="action-buttons">`;

  actions.forEach(action => {
    const buttonClass = action.primary ? 'btn-primary' : 'btn-secondary';

    if (action.requires_input) {
      // Show text input + button
      html += `
        <div class="action-with-input">
          <input type="text" id="action-input-${action.value}" placeholder="Enter your response...">
          <button class="${buttonClass}" onclick="sendActionWithInput('${action.value}')">
            ${action.label}
          </button>
        </div>
      `;
    } else {
      // Just button
      html += `
        <button class="${buttonClass}" onclick="sendMessage('${action.label}')">
          ${action.label}
        </button>
      `;
    }
  });

  html += `</div>`;
  messageDiv.innerHTML = html;

  document.getElementById('chat-messages').appendChild(messageDiv);
  scrollToBottom();
}

// Render status_update
function renderStatusUpdate(message) {
  const { status, text, progress, estimated_time } = message.payload;

  // Check if status message already exists, update it
  let statusDiv = document.querySelector('.status-message');

  if (!statusDiv) {
    statusDiv = document.createElement('div');
    statusDiv.className = 'status-message';
    document.getElementById('chat-messages').appendChild(statusDiv);
  }

  const icon = getStatusIcon(status);
  let html = `<div class="status-content">`;
  html += `<span class="status-icon">${icon}</span>`;
  html += `<span class="status-text">${text}</span>`;

  if (progress !== null && progress !== undefined) {
    html += `
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
      <span class="progress-text">${progress}%</span>
    `;
  }

  if (estimated_time) {
    html += `<span class="eta">~${estimated_time}s remaining</span>`;
  }

  html += `</div>`;
  statusDiv.innerHTML = html;

  // Remove status message when complete
  if (status === 'complete') {
    setTimeout(() => statusDiv.remove(), 2000);
  }

  scrollToBottom();
}

function getStatusIcon(status) {
  const icons = {
    'idle': '⏸️',
    'thinking': '🤔',
    'generating': '⏳',
    'complete': '✅',
    'error': '❌'
  };
  return icons[status] || '⏳';
}

// Render presentation_url
function renderPresentationURL(message) {
  const { url, slide_count, message: successMessage } = message.payload;

  // Display success in chat
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant success';
  messageDiv.innerHTML = `
    <div class="message-content">
      <div class="success-header">🎉 ${successMessage}</div>
      <div class="presentation-info">
        <p>📊 <strong>${slide_count} slides</strong> created</p>
        <button onclick="window.open('${url}', '_blank')" class="btn-link">
          Open in new tab 🔗
        </button>
      </div>
    </div>
  `;
  document.getElementById('chat-messages').appendChild(messageDiv);

  // Load in right panel
  const iframe = document.getElementById('presentation-iframe');
  const placeholder = document.getElementById('presentation-placeholder');

  iframe.src = url;
  iframe.style.display = 'block';
  placeholder.style.display = 'none';

  scrollToBottom();
}
```

---

## Code Examples

### Complete WebSocket Implementation

```javascript
class DirectorClient {
  constructor() {
    this.ws = null;
    this.sessionId = crypto.randomUUID();
    this.userId = `user_${Date.now()}`;
  }

  connect() {
    const wsUrl = `wss://directorv20-production.up.railway.app/ws?session_id=${this.sessionId}&user_id=${this.userId}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('✅ Connected to Director v2.0');
      this.onConnected();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.onError(error);
    };

    this.ws.onclose = () => {
      console.log('🔌 Connection closed');
      this.onDisconnected();
    };
  }

  handleMessage(message) {
    console.log('📨 Received:', message.type, message);

    switch (message.type) {
      case 'chat_message':
        renderChatMessage(message);
        break;

      case 'action_request':
        renderActionRequest(message);
        break;

      case 'status_update':
        renderStatusUpdate(message);
        break;

      case 'presentation_url':
        renderPresentationURL(message);
        break;

      case 'state_change':
        // Optional: Log or ignore
        console.log('State changed:', message.new_state);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  sendMessage(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    const message = {
      type: 'user_message',
      data: {
        text: text
      }
    };

    this.ws.send(JSON.stringify(message));

    // Display user message in chat
    this.renderUserMessage(text);
  }

  renderUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
      <div class="message-content">
        <div class="message-text">${text}</div>
      </div>
    `;
    document.getElementById('chat-messages').appendChild(messageDiv);
    scrollToBottom();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  // Callbacks (override these)
  onConnected() {}
  onDisconnected() {}
  onError(error) {}
}

// Usage
const client = new DirectorClient();
client.connect();

// Send messages
function sendMessage() {
  const input = document.getElementById('user-input');
  const text = input.value.trim();

  if (text) {
    client.sendMessage(text);
    input.value = '';
  }
}

// Handle Enter key
document.getElementById('user-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});
```

### TypeScript Types (Optional)

```typescript
// Message types
interface BaseMessage {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'chat_message' | 'action_request' | 'status_update' | 'presentation_url';
  payload: any;
}

interface ChatMessage extends BaseMessage {
  type: 'chat_message';
  payload: {
    text: string;
    sub_title?: string;
    list_items?: string[];
    format?: 'markdown' | 'plain';
  };
}

interface ActionRequest extends BaseMessage {
  type: 'action_request';
  payload: {
    prompt_text: string;
    actions: Array<{
      label: string;
      value: string;
      primary: boolean;
      requires_input: boolean;
    }>;
  };
}

interface StatusUpdate extends BaseMessage {
  type: 'status_update';
  payload: {
    status: 'idle' | 'thinking' | 'generating' | 'complete' | 'error';
    text: string;
    progress?: number;
    estimated_time?: number;
  };
}

interface PresentationURL extends BaseMessage {
  type: 'presentation_url';
  payload: {
    url: string;
    presentation_id: string;
    slide_count: number;
    message: string;
  };
}

type Message = ChatMessage | ActionRequest | StatusUpdate | PresentationURL;
```

---

## Error Handling

### Connection Errors

```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);

  // Display error to user
  displayErrorMessage('Connection failed. Please check your network and try again.');

  // Attempt reconnection
  setTimeout(() => {
    console.log('Attempting to reconnect...');
    connect();
  }, 5000);
};

ws.onclose = (event) => {
  if (event.code === 1006) {
    // Abnormal closure
    displayErrorMessage('Connection lost. Reconnecting...');
    reconnect();
  }
};
```

### Error Messages from Server

If server encounters an error, it may send:

```json
{
  "type": "status_update",
  "payload": {
    "status": "error",
    "text": "An error occurred. Please try again."
  }
}
```

Or:

```json
{
  "type": "chat_message",
  "payload": {
    "text": "I encountered an error while processing your request. Please try again or let me know if you need help."
  }
}
```

**Frontend Handling**:
```javascript
if (message.type === 'status_update' && message.payload.status === 'error') {
  displayErrorBanner(message.payload.text);
  enableRetryButton();
}
```

### Timeout Handling

```javascript
class DirectorClient {
  constructor() {
    // ...
    this.messageTimeout = null;
    this.TIMEOUT_DURATION = 60000; // 60 seconds
  }

  sendMessage(text) {
    // Clear existing timeout
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    // Set new timeout
    this.messageTimeout = setTimeout(() => {
      displayWarning('Response taking longer than expected...');
    }, this.TIMEOUT_DURATION);

    // Send message
    const message = {
      type: 'user_message',
      data: { text }
    };
    this.ws.send(JSON.stringify(message));
  }

  handleMessage(message) {
    // Clear timeout when response received
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    // Handle message...
  }
}
```

---

## Testing

### Manual Testing Steps

1. **Open Developer Tools** (F12)
2. **Connect to WebSocket**
   ```javascript
   const ws = new WebSocket('wss://directorv20-production.up.railway.app/ws?session_id=' + crypto.randomUUID() + '&user_id=test_user');
   ws.onmessage = (e) => console.log(JSON.parse(e.data));
   ```

3. **Wait for Greeting**
   - Should receive `chat_message` with greeting

4. **Send Topic**
   ```javascript
   ws.send(JSON.stringify({
     type: 'user_message',
     data: { text: 'I need a presentation about AI in healthcare' }
   }));
   ```

5. **Receive Questions**
   - Should receive `chat_message` with clarifying questions

6. **Answer Questions**
   ```javascript
   ws.send(JSON.stringify({
     type: 'user_message',
     data: { text: 'Healthcare professionals, 20 minutes, cover diagnostics' }
   }));
   ```

7. **Receive Plan**
   - Should receive `chat_message` with plan
   - Should receive `action_request` for confirmation

8. **Confirm Plan**
   ```javascript
   ws.send(JSON.stringify({
     type: 'user_message',
     data: { text: 'Yes, let\'s build it!' }
   }));
   ```

9. **Monitor Generation**
   - Should receive `status_update` messages
   - Should receive `presentation_url` with final URL

10. **Verify URL**
    - Open URL in browser
    - Should display reveal.js presentation

### Automated Test Script

```javascript
async function testDirectorAPI() {
  return new Promise((resolve, reject) => {
    const sessionId = crypto.randomUUID();
    const ws = new WebSocket(`wss://directorv20-production.up.railway.app/ws?session_id=${sessionId}&user_id=test_user`);

    const messages = [
      'I need a presentation about healthy eating',
      'Healthcare professionals, 20 minutes, balanced diet and nutrition myths',
      'Yes, that plan looks great'
    ];

    let messageIndex = 0;
    let receivedPresentationURL = false;

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received:', message.type);

      if (message.type === 'presentation_url') {
        console.log('✅ Test passed! Received URL:', message.payload.url);
        receivedPresentationURL = true;
        ws.close();
        resolve(message.payload.url);
      }

      // Auto-send next message after small delay
      if (messageIndex < messages.length) {
        setTimeout(() => {
          const msg = {
            type: 'user_message',
            data: { text: messages[messageIndex] }
          };
          ws.send(JSON.stringify(msg));
          messageIndex++;
        }, 1000);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ Test failed:', error);
      reject(error);
    };

    setTimeout(() => {
      if (!receivedPresentationURL) {
        console.error('❌ Test timeout');
        ws.close();
        reject(new Error('Timeout'));
      }
    }, 120000); // 2 minute timeout
  });
}

// Run test
testDirectorAPI()
  .then(url => console.log('Presentation URL:', url))
  .catch(error => console.error('Test failed:', error));
```

---

## Best Practices

### 1. Message Display
- **Show typing indicators** when `status_update` with `status: "thinking"` received
- **Update progress bars** smoothly when receiving `status_update` messages
- **Scroll to bottom** automatically when new messages arrive
- **Disable input** during `status: "generating"` to prevent interruptions

### 2. Presentation Loading
- **Show loading spinner** in right panel while iframe loads
- **Handle iframe load errors** gracefully
- **Provide "Open in new tab" option** for users who want full-screen
- **Clear previous presentation** before loading new one (on refinement)

### 3. State Management
- **Store session_id** and **user_id** in component state
- **Track conversation history** for context
- **Save presentation URLs** for user to revisit later
- **Handle page refresh** by storing session ID in localStorage (if needed)

### 4. Error Recovery
- **Implement reconnection logic** with exponential backoff
- **Show clear error messages** to users
- **Provide retry buttons** when errors occur
- **Log errors** for debugging

### 5. Performance
- **Debounce user input** to avoid rapid message sending
- **Lazy load iframe** (only when URL received)
- **Optimize message rendering** for long conversations
- **Clear old messages** if conversation gets very long

---

## Example React Component

```jsx
import { useState, useEffect, useRef } from 'react';

function DirectorChat() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [presentationURL, setPresentationURL] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const userIdRef = useRef(`user_${Date.now()}`);

  useEffect(() => {
    // Connect to WebSocket
    const ws = new WebSocket(
      `wss://directorv20-production.up.railway.app/ws?session_id=${sessionIdRef.current}&user_id=${userIdRef.current}`
    );

    ws.onopen = () => {
      console.log('Connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'presentation_url') {
        setPresentationURL(message.payload.url);
      }

      setMessages(prev => [...prev, message]);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('Disconnected');
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = () => {
    if (!inputValue.trim() || !isConnected) return;

    const message = {
      type: 'user_message',
      data: { text: inputValue }
    };

    wsRef.current.send(JSON.stringify(message));

    // Add user message to UI
    setMessages(prev => [...prev, {
      type: 'user_message',
      payload: { text: inputValue }
    }]);

    setInputValue('');
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Left: Chat */}
      <div style={{ width: '40%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {messages.map((msg, idx) => (
            <MessageComponent key={idx} message={msg} />
          ))}
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid #ddd' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..."
            style={{ width: '100%', padding: '10px' }}
          />
          <button onClick={sendMessage} disabled={!isConnected}>
            Send
          </button>
        </div>
      </div>

      {/* Right: Presentation */}
      <div style={{ width: '60%', background: '#f5f5f5' }}>
        {presentationURL ? (
          <iframe
            src={presentationURL}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Presentation"
          />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#999'
          }}>
            Your presentation will appear here
          </div>
        )}
      </div>
    </div>
  );
}

function MessageComponent({ message }) {
  switch (message.type) {
    case 'chat_message':
      return (
        <div className="message assistant">
          <div>{message.payload.text}</div>
          {message.payload.list_items && (
            <ul>
              {message.payload.list_items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      );

    case 'action_request':
      return (
        <div className="action-request">
          <p>{message.payload.prompt_text}</p>
          {message.payload.actions.map((action, i) => (
            <button key={i}>{action.label}</button>
          ))}
        </div>
      );

    case 'status_update':
      return (
        <div className="status">
          {message.payload.text}
          {message.payload.progress && ` (${message.payload.progress}%)`}
        </div>
      );

    case 'user_message':
      return (
        <div className="message user">
          {message.payload.text}
        </div>
      );

    default:
      return null;
  }
}

export default DirectorChat;
```

---

## Summary

### Quick Reference

| Action | Method |
|--------|--------|
| **Connect** | `new WebSocket('wss://directorv20-production.up.railway.app/ws?session_id={UUID}&user_id={ID}')` |
| **Send Message** | `ws.send(JSON.stringify({ type: 'user_message', data: { text: 'message' }}))` |
| **Receive Messages** | `ws.onmessage = (e) => { const msg = JSON.parse(e.data); }` |
| **Message Types** | `chat_message`, `action_request`, `status_update`, `presentation_url` |
| **Load Presentation** | `iframe.src = message.payload.url` |

### Key Points
1. ✅ Generate UUID for `session_id` client-side
2. ✅ Always send messages as `{ type: 'user_message', data: { text: '...' }}`
3. ✅ Handle all message types (`chat_message`, `action_request`, `status_update`, `presentation_url`)
4. ✅ Load presentation URL in iframe when `presentation_url` received
5. ✅ Implement error handling and reconnection logic
6. ✅ Show loading states during `status_update`

---

## Support & Troubleshooting

### Common Issues

**Issue**: WebSocket won't connect
- Check network connectivity
- Verify URL is correct (wss:// not ws://)
- Ensure session_id and user_id parameters are included

**Issue**: Not receiving messages
- Check `ws.onmessage` handler is attached
- Verify JSON parsing is working
- Check browser console for errors

**Issue**: Presentation iframe not loading
- Verify URL is correct
- Check for CORS issues (shouldn't be an issue with deck-builder)
- Ensure iframe src is set correctly

**Issue**: Messages out of order
- WebSocket guarantees message order
- Check if multiple connections are open
- Verify session_id is consistent

### Contact
For issues or questions:
- Check Railway logs: `https://railway.app/project/directorv20`
- Test with: `python3 test_railway_auto.py`
- GitHub: `https://github.com/Pramod-Potti-Krishnan/director_v2.0`

---

**Last Updated**: 2025-10-12
**API Version**: v2.0
**Status**: ✅ Production Ready
