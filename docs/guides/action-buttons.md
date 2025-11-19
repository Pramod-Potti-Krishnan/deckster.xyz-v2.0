# Frontend Action Buttons Implementation Guide

## Overview

Action buttons are the primary way users interact with Director v3.4 to make decisions during the presentation generation workflow. This guide explains exactly how to implement action button handling in your frontend.

---

## 🎯 Why Action Buttons Matter

After Director generates a strawman presentation (Stage 4), it sends **action buttons** for the user to decide what to do next:
- **"Looks perfect!"** → Proceed to Stage 6 (Content Generation)
- **"Make some changes"** → Stay in Stage 5 (Refinement)

**Without properly handling these buttons**, users cannot progress from Stage 4 to Stage 6.

---

## 📋 Action Request Message Structure

When Director wants the user to make a decision, it sends an `action_request` message:

```json
{
  "message_id": "msg_abc123",
  "session_id": "647c7066-22af-4350-b1c0-c3017b107428",
  "timestamp": "2025-11-06T13:20:00Z",
  "type": "action_request",
  "payload": {
    "prompt_text": "Your presentation is ready! What would you like to do?",
    "actions": [
      {
        "label": "Looks perfect!",
        "value": "accept_strawman",
        "primary": true,
        "requires_input": false
      },
      {
        "label": "Make some changes",
        "value": "request_refinement",
        "primary": false,
        "requires_input": true
      }
    ]
  }
}
```

### Action Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Button text displayed to user (e.g., "Looks perfect!") |
| `value` | string | Backend action identifier (e.g., "accept_strawman") |
| `primary` | boolean | Whether this is the primary/recommended action |
| `requires_input` | boolean | Whether user needs to provide additional text |

---

## 🔧 Implementation Steps

### Step 1: Detect Action Request Messages

```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === "action_request") {
    handleActionRequest(message.payload);
  }
};
```

### Step 2: Render Action Buttons

```javascript
function handleActionRequest(payload) {
  const { prompt_text, actions } = payload;

  // Display the prompt text in chat
  appendToChatInterface(prompt_text);

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'action-buttons';

  // Render each action as a button
  actions.forEach(action => {
    const button = document.createElement('button');
    button.textContent = action.label;
    button.className = action.primary ? 'primary-button' : 'secondary-button';

    // Attach click handler
    button.onclick = () => handleButtonClick(action);

    buttonContainer.appendChild(button);
  });

  // Add to chat interface
  appendToChatInterface(buttonContainer);
}
```

### Step 3: Send Button Value to Backend

```javascript
function handleButtonClick(action) {
  const { value, requires_input } = action;

  if (requires_input) {
    // Show input field for user to provide additional text
    showTextInputDialog((userText) => {
      sendUserMessage(userText);
    });
  } else {
    // Send the action value directly
    sendUserMessage(value);
  }
}

function sendUserMessage(text) {
  ws.send(JSON.stringify({
    type: "user_message",
    data: { text: text }
  }));
}
```

---

## 🎬 Complete Working Example

```javascript
// WebSocket message handler
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case "action_request":
      handleActionRequest(message.payload);
      break;
    // ... other message types
  }
};

// Handle action request messages
function handleActionRequest(payload) {
  const { prompt_text, actions } = payload;

  // Display prompt in chat
  const promptDiv = document.createElement('div');
  promptDiv.className = 'assistant-message';
  promptDiv.textContent = prompt_text;
  document.getElementById('chat-messages').appendChild(promptDiv);

  // Create action buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'action-buttons';

  actions.forEach(action => {
    const button = document.createElement('button');
    button.textContent = action.label;
    button.className = action.primary ? 'btn-primary' : 'btn-secondary';

    button.onclick = () => {
      // Remove buttons after click (prevent double-clicks)
      buttonContainer.remove();

      if (action.requires_input) {
        // Show input field
        showInputField((userInput) => {
          sendMessage(userInput);
        });
      } else {
        // Send action value directly
        sendMessage(action.value);

        // Show confirmation in chat
        appendUserMessage(action.label);
      }
    };

    buttonContainer.appendChild(button);
  });

  document.getElementById('chat-messages').appendChild(buttonContainer);
}

// Send message to backend
function sendMessage(text) {
  ws.send(JSON.stringify({
    type: "user_message",
    data: { text: text }
  }));
}

// Display user message in chat
function appendUserMessage(text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'user-message';
  msgDiv.textContent = text;
  document.getElementById('chat-messages').appendChild(msgDiv);
}
```

---

## 🔄 Strawman Acceptance Workflow

Here's the complete flow for Stage 4 (strawman) → Stage 6 (content generation):

### 1. Backend Sends Strawman + Buttons

```javascript
// Message 1: presentation_url with strawman preview
{
  "type": "presentation_url",
  "payload": {
    "url": "https://web-production-f0d13.up.railway.app/p/abc-123",
    "presentation_id": "abc-123",
    "slide_count": 7,
    "message": "Your presentation is ready!"
  }
}

// Message 2: action_request with buttons (THIS IS CRITICAL)
{
  "type": "action_request",
  "payload": {
    "prompt_text": "Your presentation is ready! What would you like to do?",
    "actions": [
      {
        "label": "Looks perfect!",
        "value": "accept_strawman",  // ← This triggers Stage 6
        "primary": true,
        "requires_input": false
      },
      {
        "label": "Make some changes",
        "value": "request_refinement",  // ← This stays in Stage 5
        "primary": false,
        "requires_input": true
      }
    ]
  }
}
```

### 2. Frontend Displays Buttons

```
┌─────────────────────────────────────┐
│ Chat Interface                      │
├─────────────────────────────────────┤
│ 🤖 Your presentation is ready!      │
│    What would you like to do?       │
│                                     │
│ ┌──────────────────┐ ┌────────────┐│
│ │ Looks perfect!   │ │Make changes││
│ │    (primary)     │ │ (secondary)││
│ └──────────────────┘ └────────────┘│
└─────────────────────────────────────┘
```

### 3. User Clicks "Looks perfect!"

Frontend sends:
```javascript
{
  "type": "user_message",
  "data": { "text": "accept_strawman" }  // Send button's value
}
```

### 4. Backend Triggers Stage 6

Director receives "accept_strawman", classifies intent as `Accept_Strawman`, transitions to `CONTENT_GENERATION` state, and starts generating real content for slides.

### 5. Frontend Receives Final Presentation

```javascript
{
  "type": "presentation_url",
  "payload": {
    "url": "https://web-production-f0d13.up.railway.app/p/abc-123-final",
    "slide_count": 7,
    "message": "Your presentation is ready! Content generated for 7/7 slides"
  }
}
```

---

## ⚠️ Common Mistakes & Troubleshooting

### Mistake 1: Sending Button Label Instead of Value

❌ **WRONG**:
```javascript
// Don't send the label text!
sendMessage("Looks perfect!");
```

✅ **CORRECT**:
```javascript
// Send the value field
sendMessage(action.value);  // "accept_strawman"
```

### Mistake 2: Not Handling action_request Messages

If you don't handle `action_request` messages, users will have no way to accept the strawman and progress to Stage 6.

**Symptoms**:
- No buttons appear after strawman generation
- User has to type "looks good" or similar text manually
- Director doesn't progress to content generation

**Solution**: Implement action_request handler as shown above.

### Mistake 3: Not Removing Buttons After Click

**Problem**: User clicks button multiple times, sending duplicate messages.

**Solution**: Remove button container after first click:
```javascript
button.onclick = () => {
  buttonContainer.remove();  // Remove immediately
  sendMessage(action.value);
};
```

---

## 📊 All Action Values Reference

Director v3.4 uses these action values:

| Action Value | When Sent | What It Does |
|--------------|-----------|--------------|
| `accept_plan` | Stage 3 (Confirmation Plan) | Accept plan and generate strawman |
| `reject_plan` | Stage 3 (Confirmation Plan) | Reject plan and request changes |
| `accept_strawman` | Stage 4 (Strawman) | Accept strawman and proceed to Stage 6 |
| `request_refinement` | Stage 4 (Strawman) | Request changes to strawman (Stage 5) |

---

## 🧪 Testing Checklist

After implementing action buttons:

- [ ] **Test 1**: Connect to WebSocket and reach strawman stage
- [ ] **Test 2**: Verify buttons appear after strawman generation
- [ ] **Test 3**: Click "Looks perfect!" button
- [ ] **Test 4**: Verify message sent with value "accept_strawman"
- [ ] **Test 5**: Verify Stage 6 content generation starts
- [ ] **Test 6**: Verify final presentation URL received
- [ ] **Test 7**: Test "Make some changes" button (requires_input)
- [ ] **Test 8**: Verify input field appears for refinement
- [ ] **Test 9**: Test buttons don't send duplicate clicks

---

## 💡 Best Practices

### 1. Visual Feedback

Show loading state when button is clicked:
```javascript
button.onclick = () => {
  button.disabled = true;
  button.textContent = "Processing...";
  sendMessage(action.value);
};
```

### 2. Accessibility

Make buttons keyboard-accessible:
```html
<button
  role="button"
  tabindex="0"
  aria-label="Accept strawman and continue">
  Looks perfect!
</button>
```

### 3. Mobile-Friendly

Use touch-friendly button sizes:
```css
.action-buttons button {
  min-height: 44px;  /* iOS minimum tap target */
  padding: 12px 24px;
  margin: 8px;
}
```

---

## 🔗 Related Documentation

- **FRONTEND_INTEGRATION_GUIDE.md** - Complete WebSocket integration guide
- **FRONTEND_CORRECTION.md** - Message structure (payload vs data)
- **FRONTEND_FIX_SUMMARY.md** - Quick reference for common fixes

---

## 📞 Support

If action buttons still don't work after following this guide:

1. Check browser console for JavaScript errors
2. Verify WebSocket connection is active
3. Verify you're sending `action.value` not `action.label`
4. Verify message structure uses `type: "user_message"` and `data: { text: "..." }`
5. Check backend logs for intent classification issues

If problem persists, share:
- Frontend console logs
- WebSocket message traces
- Backend Railway logs
