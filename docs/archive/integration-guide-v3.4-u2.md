# Director Agent v3.4 - Frontend Integration Guide

## Overview

This guide provides complete integration instructions for connecting a frontend application to the Director Agent v3.4 service. The Director orchestrates a 6-stage conversational workflow that culminates in generating complete presentations with visual content.

**Integration Architecture:**
- **Chat Interface**: Handles all conversational messages (greeting, questions, plans, confirmations)
- **Presentation Screen**: Displays generated presentation via URL
- **Communication**: Real-time bidirectional WebSocket connection

---

## Quick Start

### Connection URL

**Production (Railway)**:
```
wss://directorv33-production.up.railway.app/ws?session_id={SESSION_ID}&user_id={USER_ID}
```

**Local Development**:
```
ws://localhost:8000/ws?session_id={SESSION_ID}&user_id={USER_ID}
```

**Required Query Parameters:**
- `session_id`: Unique identifier for the presentation session (UUID recommended)
- `user_id`: User identifier (can be user's email, ID, or anonymous UUID)

**Example**:
```javascript
const sessionId = crypto.randomUUID();
const userId = "user-12345"; // or user email
const wsUrl = `wss://directorv33-production.up.railway.app/ws?session_id=${sessionId}&user_id=${userId}`;
const ws = new WebSocket(wsUrl);
```

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Application                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────┐    ┌─────────────────────────┐ │
│  │   Chat Interface       │    │  Presentation Screen    │ │
│  │                        │    │                         │ │
│  │  - Greeting messages   │    │  - Initially empty      │ │
│  │  - Clarifying Q&A      │    │  - Shows presentation   │ │
│  │  - Plan display        │    │    via iframe/embed     │ │
│  │  - Progress updates    │    │  - Updates when URL     │ │
│  │  - User input          │    │    received             │ │
│  └────────┬───────────────┘    └────────┬────────────────┘ │
│           │                              │                  │
│           └──────────┬───────────────────┘                  │
│                      │                                      │
└──────────────────────┼──────────────────────────────────────┘
                       │
                       ▼
           ┌───────────────────────┐
           │  WebSocket Connection │
           │  (Bidirectional)      │
           └───────────┬───────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              Director Agent v3.4 (Railway)                   │
│                                                               │
│  Stage 1: PROVIDE_GREETING                                   │
│  Stage 2: ASK_CLARIFYING_QUESTIONS                           │
│  Stage 3: CREATE_CONFIRMATION_PLAN                           │
│  Stage 4: GENERATE_STRAWMAN                                  │
│  Stage 5: REFINE_STRAWMAN                                    │
│  Stage 6: CONTENT_GENERATION → Presentation URL             │
└──────────────────────────────────────────────────────────────┘
```

---

## WebSocket Message Protocol

All messages follow a consistent JSON structure:

```json
{
  "message_id": "msg_07ca8044",
  "session_id": "29796dc1-9e65-4eb2-b1f1-b808dd5e10fa",
  "timestamp": "2025-11-06T05:49:41.651292",
  "type": "message_type",
  "payload": { /* payload specific to message type */ }
}
```

**⚠️ CRITICAL**: All message data is in the `payload` field, NOT `data`.

---

## Message Types Reference

### Client → Server (What Frontend Sends)

#### 1. User Message
Send user's text input to Director.

```json
{
  "type": "user_message",
  "data": {
    "text": "I need a presentation about AI in healthcare"
  }
}
```

**When to Send:**
- User types message in chat interface
- User answers clarifying questions
- User provides feedback on plans
- User requests revisions

**Example Flow:**
```javascript
// User types in chat input
const userMessage = {
  type: "user_message",
  data: {
    text: chatInput.value
  }
};
ws.send(JSON.stringify(userMessage));
```

---

### Server → Client (What Frontend Receives)

#### 1. Chat Message (`chat_message`)
Regular conversational message from Director.

```json
{
  "type": "chat_message",
  "data": {
    "text": "Hello! I'll help you create a presentation. What topic would you like to present?",
    "format": "markdown"
  }
}
```

**Display In:** Chat Interface

**Handling:**
```javascript
if (message.type === "chat_message") {
  const text = message.payload.text;
  const format = message.payload.format || "text";

  // Render in chat interface
  appendToChatInterface({
    sender: "assistant",
    content: text,
    format: format  // "markdown" or "text"
  });
}
```

**Use Cases:**
- Initial greeting (Stage 1)
- Clarifying questions (Stage 2)
- Acknowledgments
- Progress updates
- Error messages

---

#### 2. Action Request (`action_request`)
Director requests user to choose from predefined actions (buttons).

```json
{
  "type": "action_request",
  "data": {
    "prompt_text": "Here's your presentation plan. Should I proceed?",
    "actions": [
      {
        "label": "Accept",
        "value": "accept",
        "primary": true
      },
      {
        "label": "Revise",
        "value": "revise",
        "primary": false
      }
    ]
  }
}
```

**Display In:** Chat Interface (as buttons/options)

**Handling:**
```javascript
if (message.type === "action_request") {
  const promptText = message.payload.prompt_text;
  const actions = message.payload.actions;

  // Display prompt
  appendToChatInterface({
    sender: "assistant",
    content: promptText
  });

  // Display action buttons
  displayActionButtons(actions, (selectedValue) => {
    // User clicked an action button
    ws.send(JSON.stringify({
      type: "user_message",
      data: { text: selectedValue }
    }));
  });
}
```

**Use Cases:**
- Confirmation plan acceptance (Stage 3)
- **Strawman acceptance (Stage 4)** - Critical for progression to Stage 6
- Refinement decisions (Stage 5)

**Action Values:**
- `"accept_plan"`: Accept confirmation plan (Stage 3 → Stage 4)
- `"reject_plan"`: Reject plan and request changes (Stage 3 loop)
- `"accept_strawman"`: Accept strawman and proceed to Stage 6 (CRITICAL)
- `"request_refinement"`: Request strawman changes (Stage 4 → Stage 5)

**⚠️ IMPORTANT**: After receiving a strawman, Director sends action buttons. The frontend MUST render these buttons and send the button's `value` field (not `label`) when clicked.

**Example**: When user clicks "Looks perfect!" button:
```javascript
// ✅ CORRECT - Send the value field
ws.send(JSON.stringify({
  type: "user_message",
  data: { text: "accept_strawman" }  // Button's value, not label
}));

// ❌ WRONG - Don't send the label
ws.send(JSON.stringify({
  type: "user_message",
  data: { text: "Looks perfect!" }  // This won't work!
}));
```

**📚 See Also**: For detailed action button implementation guide, see **FRONTEND_ACTION_BUTTONS_GUIDE.md**

---

#### 3. Slide Update (`slide_update`)
Director sends presentation structure (strawman).

```json
{
  "type": "slide_update",
  "data": {
    "operation": "full_update",
    "metadata": {
      "title": "AI in Healthcare: Transforming Patient Outcomes",
      "total_slides": 10,
      "theme": "professional",
      "duration_minutes": 15
    },
    "slides": [
      {
        "slide_number": 1,
        "title": "Title Slide",
        "classification": "title_slide",
        "layout_id": "L29",
        "narrative": "Introduction to AI healthcare transformation",
        "topics": ["AI", "Healthcare", "Innovation"]
      },
      {
        "slide_number": 2,
        "title": "Four Pillars of AI Excellence",
        "classification": "matrix_2x2",
        "layout_id": "L25",
        "variant_id": "matrix_2x2",
        "narrative": "Core AI capabilities",
        "topics": ["Speed", "Accuracy", "Scale", "Insight"]
      },
      {
        "slide_number": 3,
        "title": "Closing Slide",
        "classification": "closing_slide",
        "layout_id": "L29",
        "narrative": "Call to action and contact information"
      }
    ]
  }
}
```

**Display In:** Chat Interface (as preview/outline) OR Presentation Screen (as thumbnail navigation)

**Handling:**
```javascript
if (message.type === "slide_update") {
  const metadata = message.payload.metadata;
  const slides = message.payload.slides;

  // Option 1: Display as text outline in chat
  const outline = `
    **${metadata.title}**
    ${metadata.total_slides} slides | ${metadata.duration_minutes} minutes

    ${slides.map(s => `${s.slide_number}. ${s.title}`).join('\n')}
  `;
  appendToChatInterface({
    sender: "assistant",
    content: outline,
    format: "markdown"
  });

  // Option 2: Store for presentation screen (to be rendered later)
  presentationData = {
    metadata: metadata,
    slides: slides
  };
}
```

**Use Cases:**
- Confirmation plan presentation (Stage 3)
- Initial strawman presentation (Stage 4)
- Refined strawman presentation (Stage 5)

---

#### 4. Presentation URL (`presentation_url`)
**🎯 MOST IMPORTANT MESSAGE - Final presentation is ready!**

```json
{
  "type": "presentation_url",
  "data": {
    "url": "http://localhost:8504/p/8b4c2ef2-669f-48a5-bda4-7c8971160183",
    "slide_count": 10,
    "content_generated": true,
    "successful_slides": 10,
    "failed_slides": 0,
    "message": "Your presentation with generated content is ready! View it at: http://localhost:8504/p/8b4c2ef2-669f-48a5-bda4-7c8971160183"
  }
}
```

**Display In:**
- ✅ **Presentation Screen** (load URL in iframe/embed - PRIMARY)
- ✅ **Chat Interface** (show success message with link - SECONDARY)

**Handling:**
```javascript
if (message.type === "presentation_url") {
  const url = message.payload.url;
  const slideCount = message.payload.slide_count;
  const successCount = message.payload.successful_slides;
  const message = message.payload.message;

  // 🎯 PRIMARY: Update Presentation Screen
  updatePresentationScreen(url);

  // SECONDARY: Show success message in chat
  appendToChatInterface({
    sender: "assistant",
    content: `✅ **Presentation Ready!**\n\n${successCount}/${slideCount} slides generated successfully.\n\n[View Presentation](${url})`,
    format: "markdown"
  });
}

function updatePresentationScreen(url) {
  // Option 1: iframe (recommended)
  const iframe = document.getElementById('presentation-iframe');
  iframe.src = url;

  // Option 2: window.open (new tab)
  // window.open(url, '_blank');

  // Option 3: Direct navigation (replace page)
  // window.location.href = url;
}
```

**Use Cases:**
- Stage 6 (CONTENT_GENERATION) completes successfully
- User receives final presentation with all visual content

**Important Notes:**
- This is the **final message** in the workflow
- Always update **Presentation Screen** when you receive this
- URL points to Layout Architect service (localhost:8504 or production URL)
- Presentation includes all hero slides (gradients, large fonts) and content slides

---

#### 5. Progress Update (`progress_update`)
Real-time progress during Stage 6 content generation.

```json
{
  "type": "progress_update",
  "data": {
    "stage": "content_generation",
    "message": "Generating slide 5 of 10: Four Pillars of Excellence (matrix_2x2)",
    "current_slide": 5,
    "total_slides": 10,
    "percentage": 50
  }
}
```

**Display In:** Chat Interface (as progress indicator)

**Handling:**
```javascript
if (message.type === "progress_update") {
  const { current_slide, total_slides, percentage, message } = message.payload;

  // Option 1: Update progress bar
  updateProgressBar(percentage);

  // Option 2: Show status message
  updateStatusMessage(message);

  // Option 3: Both
  showProgressIndicator({
    current: current_slide,
    total: total_slides,
    message: message,
    percentage: percentage
  });
}
```

**Use Cases:**
- Stage 6 slide-by-slide generation progress
- Keeps user informed during 10-120 second content generation

---

#### 6. Error Message (`error`)
Error occurred during processing.

```json
{
  "type": "error",
  "data": {
    "error": "Text Service unavailable",
    "details": "Failed to connect to text generation service",
    "recoverable": true
  }
}
```

**Display In:** Chat Interface (as error message)

**Handling:**
```javascript
if (message.type === "error") {
  const errorMsg = message.payload.error;
  const details = message.payload.details;
  const recoverable = message.payload.recoverable;

  appendToChatInterface({
    sender: "system",
    content: `⚠️ **Error**: ${errorMsg}\n\n${details}`,
    format: "markdown",
    style: "error"
  });

  if (recoverable) {
    // Show retry option
    displayActionButtons([
      { label: "Retry", value: "retry", primary: true },
      { label: "Cancel", value: "cancel", primary: false }
    ]);
  }
}
```

---

## Complete Integration Example

### HTML Structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>AI Presentation Creator</title>
  <style>
    body {
      display: flex;
      height: 100vh;
      margin: 0;
      font-family: Arial, sans-serif;
    }

    #chat-container {
      width: 40%;
      display: flex;
      flex-direction: column;
      border-right: 2px solid #ccc;
    }

    #chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      background: #f5f5f5;
    }

    #chat-input-container {
      padding: 20px;
      background: white;
      border-top: 1px solid #ccc;
    }

    #chat-input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    #presentation-container {
      width: 60%;
      display: flex;
      flex-direction: column;
      background: #e0e0e0;
    }

    #presentation-iframe {
      flex: 1;
      border: none;
      background: white;
    }

    .message {
      margin-bottom: 15px;
      padding: 10px;
      border-radius: 8px;
    }

    .message.assistant {
      background: white;
      margin-right: 20%;
    }

    .message.user {
      background: #007bff;
      color: white;
      margin-left: 20%;
      text-align: right;
    }

    .action-buttons {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }

    .action-button {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .action-button.primary {
      background: #007bff;
      color: white;
    }

    .action-button.secondary {
      background: #6c757d;
      color: white;
    }

    .progress-indicator {
      padding: 10px;
      background: #e7f3ff;
      border-left: 4px solid #007bff;
      margin-bottom: 10px;
    }

    #placeholder-message {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #999;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <!-- Chat Interface (Left Side) -->
  <div id="chat-container">
    <div id="chat-messages"></div>
    <div id="chat-input-container">
      <input
        type="text"
        id="chat-input"
        placeholder="Type your message..."
        onkeypress="handleKeyPress(event)"
      />
    </div>
  </div>

  <!-- Presentation Screen (Right Side) -->
  <div id="presentation-container">
    <div id="placeholder-message">
      Presentation will appear here after generation...
    </div>
    <iframe id="presentation-iframe" style="display: none;"></iframe>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

### JavaScript Implementation

```javascript
// app.js

let ws = null;
let sessionId = null;
let userId = null;

// Initialize connection
function connect() {
  // Generate or retrieve session/user IDs
  sessionId = sessionStorage.getItem('sessionId') || crypto.randomUUID();
  userId = sessionStorage.getItem('userId') || 'user-' + crypto.randomUUID();

  sessionStorage.setItem('sessionId', sessionId);
  sessionStorage.setItem('userId', userId);

  // Connect to Director Agent
  // TODO: Replace with Railway URL when deployed
  const wsUrl = `ws://localhost:8000/ws?session_id=${sessionId}&user_id=${userId}`;
  // const wsUrl = `wss://director-agent-v34-production.up.railway.app/ws?session_id=${sessionId}&user_id=${userId}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = handleOpen;
  ws.onmessage = handleMessage;
  ws.onerror = handleError;
  ws.onclose = handleClose;
}

function handleOpen(event) {
  console.log('✅ Connected to Director Agent');
  appendSystemMessage('Connected to AI Presentation Assistant');
}

function handleMessage(event) {
  const message = JSON.parse(event.data);
  console.log('📨 Received:', message);

  switch (message.type) {
    case 'chat_message':
      handleChatMessage(message.payload);
      break;
    case 'action_request':
      handleActionRequest(message.payload);
      break;
    case 'slide_update':
      handleSlideUpdate(message.payload);
      break;
    case 'presentation_url':
      handlePresentationUrl(message.payload);
      break;
    case 'progress_update':
      handleProgressUpdate(message.payload);
      break;
    case 'error':
      handleErrorMessage(message.payload);
      break;
    default:
      console.warn('Unknown message type:', message.type);
  }
}

function handleChatMessage(data) {
  const text = data.text;
  const format = data.format || 'text';

  appendAssistantMessage(text, format);
}

function handleActionRequest(data) {
  const promptText = data.prompt_text;
  const actions = data.actions;

  // Display prompt
  appendAssistantMessage(promptText);

  // Display action buttons
  displayActionButtons(actions);
}

function handleSlideUpdate(data) {
  const metadata = data.metadata;
  const slides = data.slides;

  // Display presentation outline in chat
  const outline = `
**${metadata.title}**
${metadata.total_slides} slides | ${metadata.duration_minutes} minutes

${slides.map(s => `${s.slide_number}. ${s.title}`).join('\n')}
  `;

  appendAssistantMessage(outline, 'markdown');
}

function handlePresentationUrl(data) {
  const url = data.url;
  const slideCount = data.slide_count;
  const successCount = data.successful_slides;
  const failedCount = data.failed_slides;

  // 🎯 PRIMARY: Update Presentation Screen
  updatePresentationScreen(url);

  // SECONDARY: Show success in chat
  const statusEmoji = failedCount > 0 ? '⚠️' : '✅';
  const message = `${statusEmoji} **Presentation Ready!**\n\n${successCount}/${slideCount} slides generated successfully.\n\n[View Full Screen](${url})`;

  appendAssistantMessage(message, 'markdown');
}

function handleProgressUpdate(data) {
  const { current_slide, total_slides, percentage, message } = data;

  // Update or create progress indicator
  updateProgressIndicator({
    current: current_slide,
    total: total_slides,
    percentage: percentage,
    message: message
  });
}

function handleErrorMessage(data) {
  const errorMsg = data.error;
  const details = data.details;

  appendSystemMessage(`❌ Error: ${errorMsg}\n${details}`, 'error');
}

function handleError(event) {
  console.error('❌ WebSocket error:', event);
  appendSystemMessage('Connection error. Please refresh the page.', 'error');
}

function handleClose(event) {
  console.log('🔌 WebSocket closed');
  appendSystemMessage('Connection closed. Refresh to reconnect.', 'warning');
}

// UI Functions

function appendAssistantMessage(text, format = 'text') {
  const chatMessages = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';

  if (format === 'markdown') {
    // Simple markdown rendering (use a library like marked.js for full support)
    messageDiv.innerHTML = simpleMarkdown(text);
  } else {
    messageDiv.textContent = text;
  }

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendUserMessage(text) {
  const chatMessages = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user';
  messageDiv.textContent = text;

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendSystemMessage(text, type = 'info') {
  const chatMessages = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message system';
  messageDiv.textContent = text;
  messageDiv.style.background = type === 'error' ? '#ffebee' : '#e3f2fd';
  messageDiv.style.color = type === 'error' ? '#c62828' : '#1565c0';

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function displayActionButtons(actions) {
  const chatMessages = document.getElementById('chat-messages');
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'action-buttons';

  actions.forEach(action => {
    const button = document.createElement('button');
    button.className = `action-button ${action.primary ? 'primary' : 'secondary'}`;
    button.textContent = action.label;
    button.onclick = () => {
      sendMessage(action.value);
      buttonsContainer.remove();
    };

    buttonsContainer.appendChild(button);
  });

  chatMessages.appendChild(buttonsContainer);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateProgressIndicator(data) {
  const chatMessages = document.getElementById('chat-messages');

  // Remove existing progress indicator if any
  const existingProgress = document.querySelector('.progress-indicator');
  if (existingProgress) {
    existingProgress.remove();
  }

  // Create new progress indicator
  const progressDiv = document.createElement('div');
  progressDiv.className = 'progress-indicator';
  progressDiv.innerHTML = `
    <strong>Generating Content...</strong>
    <div>${data.message}</div>
    <div>Progress: ${data.current}/${data.total} (${data.percentage}%)</div>
  `;

  chatMessages.appendChild(progressDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updatePresentationScreen(url) {
  // Hide placeholder
  document.getElementById('placeholder-message').style.display = 'none';

  // Show and load iframe
  const iframe = document.getElementById('presentation-iframe');
  iframe.style.display = 'block';
  iframe.src = url;

  console.log('🎨 Presentation loaded:', url);
}

function sendMessage(text) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    appendSystemMessage('Not connected. Please refresh.', 'error');
    return;
  }

  const message = {
    type: 'user_message',
    data: { text: text }
  };

  ws.send(JSON.stringify(message));
  appendUserMessage(text);

  // Clear input
  const input = document.getElementById('chat-input');
  if (input) {
    input.value = '';
  }
}

function handleKeyPress(event) {
  if (event.key === 'Enter') {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();

    if (text) {
      sendMessage(text);
    }
  }
}

// Utility: Simple markdown rendering
function simpleMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\n/g, '<br>');
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', connect);
```

---

## Typical User Flow

### Example Conversation Flow

```
1. [CONNECT] WebSocket established

2. [chat_message] "Hello! I'll help you create a presentation..."

3. [user_message] "I need a presentation about AI in healthcare"

4. [chat_message] "Great! Let me ask a few questions..."

5. [chat_message] "What's the target audience?"

6. [user_message] "Healthcare professionals"

7. [chat_message] "How many slides do you need?"

8. [user_message] "About 10 slides, 15 minutes"

9. [chat_message] "Perfect! Here's what I'll create..."

10. [slide_update] {metadata + slides array}

11. [action_request] "Should I proceed with this plan?"

12. [user_message] "accept"

13. [chat_message] "Creating your presentation outline..."

14. [slide_update] {strawman with classifications}

15. [action_request] "Ready to generate content?"

16. [user_message] "accept"

17. [progress_update] "Generating slide 1 of 10..."

18. [progress_update] "Generating slide 2 of 10..."

19. [progress_update] "Generating slide 3 of 10..."

...

28. [progress_update] "Generating slide 10 of 10..."

29. [presentation_url] 🎯 {url: "http://...", slide_count: 10}

    → Frontend updates Presentation Screen with URL
    → Frontend shows success message in chat
```

---

## Service URLs (Production)

**Director Agent**: `wss://directorv33-production.up.railway.app/ws`
- WebSocket connection endpoint
- Frontend connects here for chat and presentation generation

**Text Service v1.2**: `https://web-production-5daf.up.railway.app`
- Used internally by Director for content generation
- Frontend doesn't call this directly

**Layout Architect**: `http://localhost:8504` (or production URL when deployed)
- Generates presentation URLs
- Frontend receives URLs like: `http://localhost:8504/p/{presentation-id}`

---

## Error Handling

### Connection Errors

```javascript
ws.onerror = (event) => {
  console.error('WebSocket error:', event);
  showErrorNotification('Connection failed. Please check your internet connection.');
};

ws.onclose = (event) => {
  if (event.wasClean) {
    console.log('Connection closed cleanly');
  } else {
    console.error('Connection lost');
    showReconnectOption();
  }
};
```

### Timeout Handling

```javascript
// Set timeout for responses
let responseTimeout;

function sendMessageWithTimeout(text, timeoutMs = 60000) {
  sendMessage(text);

  clearTimeout(responseTimeout);
  responseTimeout = setTimeout(() => {
    showErrorNotification('No response from server. Please try again.');
  }, timeoutMs);
}

// Clear timeout when message received
function handleMessage(event) {
  clearTimeout(responseTimeout);
  // ... rest of handling
}
```

### Partial Success Handling

```javascript
function handlePresentationUrl(data) {
  const successCount = data.successful_slides;
  const failedCount = data.failed_slides;
  const total = data.slide_count;

  if (failedCount > 0) {
    const warningMsg = `⚠️ Presentation generated with ${failedCount} failed slide(s). ${successCount}/${total} slides completed successfully.`;
    showWarningNotification(warningMsg);
  }

  // Still update presentation screen
  updatePresentationScreen(data.url);
}
```

---

## Testing Checklist

### Pre-Integration Testing

- [ ] Connect to WebSocket successfully
- [ ] Receive greeting message
- [ ] Send user message
- [ ] Receive chat_message responses
- [ ] Display action buttons correctly
- [ ] Handle user action selections
- [ ] Display slide updates in chat
- [ ] Show progress indicators during generation
- [ ] Receive presentation URL
- [ ] Load presentation in iframe
- [ ] Handle connection errors gracefully
- [ ] Reconnect after disconnection

### Integration Testing Scenarios

**Scenario 1: Complete Flow (Happy Path)**
```
1. Connect → Receive greeting
2. User: "AI in healthcare presentation"
3. Clarifying questions → User answers
4. Plan shown → User accepts
5. Strawman shown → User accepts
6. Progress updates → 10 slides
7. Presentation URL → Iframe loads
✅ Success
```

**Scenario 2: Plan Revision**
```
1. Connect → Receive greeting
2. User: "Marketing strategy presentation"
3. Clarifying questions → User answers
4. Plan shown → User selects "revise"
5. User: "Add more competitive analysis"
6. Revised plan → User accepts
7. Continue to strawman → Content generation
✅ Success
```

**Scenario 3: Network Error**
```
1. Connect → Receive greeting
2. User: "Tech innovation presentation"
3. Connection drops
4. Show error message
5. Display reconnect button
6. User reconnects → Resume session
✅ Graceful recovery
```

---

## Performance Considerations

### Expected Response Times

| Stage | Action | Expected Time |
|-------|--------|---------------|
| 1 | Initial connection | <1 second |
| 1 | Greeting message | 1-2 seconds |
| 2 | Clarifying questions | 2-5 seconds |
| 3 | Confirmation plan | 5-10 seconds |
| 4 | Strawman generation | 10-20 seconds |
| 5 | Refinement | 5-15 seconds |
| 6 | Content generation (3 slides) | 10-15 seconds |
| 6 | Content generation (10 slides) | 45-60 seconds |
| 6 | Content generation (20 slides) | 90-120 seconds |

### UI Feedback Recommendations

**Stage 1-5** (Conversational):
- Show typing indicator after user sends message
- Display messages immediately when received
- Keep chat scrolled to bottom

**Stage 6** (Content Generation):
- Show persistent progress bar
- Update with each slide (don't just spin)
- Display current slide being generated
- Show percentage completion
- Estimated time remaining (optional)

```javascript
function showContentGenerationUI() {
  const progressUI = `
    <div class="generation-progress">
      <div class="progress-header">
        <strong>Generating Your Presentation</strong>
        <span id="progress-percentage">0%</span>
      </div>
      <div class="progress-bar">
        <div id="progress-fill" style="width: 0%;"></div>
      </div>
      <div id="progress-message">Starting generation...</div>
    </div>
  `;

  appendToChat(progressUI);
}

function updateGenerationProgress(data) {
  document.getElementById('progress-percentage').textContent = `${data.percentage}%`;
  document.getElementById('progress-fill').style.width = `${data.percentage}%`;
  document.getElementById('progress-message').textContent = data.message;
}
```

---

## Security Considerations

### Authentication (Future Enhancement)

Currently, Director Agent uses session_id and user_id for identification. For production with user authentication:

```javascript
// After user logs in, get auth token
const authToken = await loginUser(username, password);

// Include in WebSocket connection
const wsUrl = `wss://director-agent-v34-production.up.railway.app/ws?session_id=${sessionId}&user_id=${userId}&token=${authToken}`;
```

### Input Validation

```javascript
function sanitizeUserInput(text) {
  // Remove potentially harmful characters
  return text
    .replace(/<script>/gi, '')
    .replace(/<\/script>/gi, '')
    .trim();
}

function sendMessage(text) {
  const sanitized = sanitizeUserInput(text);

  if (!sanitized || sanitized.length > 5000) {
    showErrorNotification('Invalid message');
    return;
  }

  // Send sanitized message
  ws.send(JSON.stringify({
    type: 'user_message',
    data: { text: sanitized }
  }));
}
```

### CORS Configuration

If frontend is on different domain, ensure Director Agent allows CORS:

```python
# Director Agent should have CORS enabled
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Troubleshooting

### Common Issues

**Issue 1: WebSocket fails to connect**
```
Symptoms: Connection refused, 404 error
Solutions:
- Verify WebSocket URL is correct
- Check session_id and user_id are provided
- Ensure Director Agent is deployed and running
- Check network/firewall settings
```

**Issue 2: Stuck after strawman, Stage 6 doesn't start**
```
Symptoms:
- Strawman displays but no action buttons appear
- User types "looks good" but nothing happens
- Workflow stuck at Stage 4, doesn't proceed to Stage 6

Root Cause:
Frontend not handling action_request messages properly

Solutions:
1. Verify you're handling action_request messages:
   if (message.type === "action_request") {
     handleActionRequest(message.payload);
   }

2. Render action buttons in your UI:
   - "Looks perfect!" button with value "accept_strawman"
   - "Make some changes" button with value "request_refinement"

3. When button clicked, send the VALUE (not label):
   ws.send(JSON.stringify({
     type: "user_message",
     data: { text: "accept_strawman" }  // Send this exact value
   }));

4. Check backend logs for intent classification:
   - Should see: "Classified intent: Accept_Strawman"
   - Should see: "State transition: GENERATE_STRAWMAN -> CONTENT_GENERATION"

📚 See FRONTEND_ACTION_BUTTONS_GUIDE.md for complete implementation details
```

**Issue 3: No presentation URL received**
```
Symptoms: Content generation progress stops, no final URL
Solutions:
- Check Stage 6 actually started (user accepted strawman)
- Look for error messages in chat
- Check browser console for errors
- Verify Layout Architect service is running
- Check Text Service v1.2 is responding
```

**Issue 4: Presentation iframe doesn't load**
```
Symptoms: Blank iframe after receiving URL
Solutions:
- Check URL is valid (starts with http:// or https://)
- Verify Layout Architect service is accessible
- Check browser console for CORS errors
- Try opening URL in new tab to debug
- Check iframe src attribute is set correctly
```

**Issue 5: Messages not displaying in chat**
```
Symptoms: WebSocket connected but no messages appear
Solutions:
- Check handleMessage() is being called
- Verify message parsing (JSON.parse)
- Check message type routing (switch statement)
- Ensure chat DOM elements exist
- Check for JavaScript errors in console
```

---

## Deployment Checklist

### Before Going Live

- [ ] Replace all `localhost` URLs with Railway production URLs
- [ ] Test WebSocket connection to production Director Agent
- [ ] Verify presentation URLs point to production Layout Architect
- [ ] Test complete workflow end-to-end on production
- [ ] Implement error handling for all message types
- [ ] Add loading states for all async operations
- [ ] Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile devices (responsive design)
- [ ] Implement reconnection logic
- [ ] Add session persistence (localStorage/sessionStorage)
- [ ] Configure CORS correctly
- [ ] Set up monitoring/analytics
- [ ] Test with slow network conditions
- [ ] Verify presentation iframes load correctly
- [ ] Test concurrent sessions (multiple users)

---

## Support & Documentation

**Director Agent Repository**: `agents/director_agent/v3.4/`

**Key Documentation Files**:
- `README.md` - Service overview and setup
- `ARCHITECTURE.md` - Technical architecture details
- `FRONTEND_INTEGRATION_GUIDE.md` - This document
- `docs/V3.4_IMPLEMENTATION_PLAN.md` - Stage 6 implementation

**Related Services**:
- Text Service v1.2: `agents/text_table_builder/v1.2/`
- Layout Architect: (separate repository)

**Contact**:
- For integration support: [Your team contact]
- For bug reports: [GitHub issues]

---

## Appendix: Complete Message Type Reference

| Message Type | Direction | Purpose | Display Location |
|-------------|-----------|---------|------------------|
| `user_message` | Client → Server | User input | Chat (user bubble) |
| `chat_message` | Server → Client | Assistant response | Chat (assistant bubble) |
| `action_request` | Server → Client | Request user action | Chat (buttons) |
| `slide_update` | Server → Client | Presentation outline | Chat (outline) |
| `presentation_url` | Server → Client | **Final presentation** | **Presentation Screen + Chat** |
| `progress_update` | Server → Client | Generation progress | Chat (progress bar) |
| `error` | Server → Client | Error notification | Chat (error message) |

---

**Document Version**: 1.0
**Last Updated**: December 2025
**Target Audience**: Frontend Developers
**Status**: Ready for Integration (Pending Railway Deployment)

---

## Quick Start Template

For a minimal working integration, start with this template:

```javascript
// Minimal Director Agent Integration

const ws = new WebSocket('ws://localhost:8000/ws?session_id=test-123&user_id=user-456');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'chat_message') {
    console.log('Assistant:', message.payload.text);
    // Display in chat interface
  }

  if (message.type === 'presentation_url') {
    console.log('🎯 Presentation ready:', message.payload.url);
    // Load URL in presentation iframe
    document.getElementById('presentation-iframe').src = message.payload.url;
  }
};

function send(text) {
  ws.send(JSON.stringify({
    type: 'user_message',
    data: { text: text }
  }));
}
```

Then gradually enhance with:
1. Action button handling
2. Progress indicators
3. Error handling
4. Reconnection logic
5. Full UI polish

---

**End of Frontend Integration Guide**
