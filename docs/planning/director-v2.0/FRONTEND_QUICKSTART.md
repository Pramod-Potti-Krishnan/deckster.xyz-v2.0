# Frontend Quick Start Guide

**For**: Frontend developers integrating Director v2.0
**Time to integrate**: ~30 minutes
**Full docs**: See `FRONTEND_INTEGRATION.md`

---

## 🚀 5-Minute Integration

### 1. Connect to WebSocket

```javascript
// Generate IDs
const sessionId = crypto.randomUUID();
const userId = 'user_12345'; // or current user ID

// Connect
const ws = new WebSocket(
  `wss://directorv20-production.up.railway.app/ws?session_id=${sessionId}&user_id=${userId}`
);

ws.onopen = () => console.log('Connected!');
ws.onmessage = (event) => handleMessage(JSON.parse(event.data));
```

### 2. Send Messages

```javascript
function sendMessage(text) {
  ws.send(JSON.stringify({
    type: 'user_message',
    data: { text: text }
  }));
}

// Usage
sendMessage("I need a presentation about AI");
```

### 3. Handle Responses

```javascript
function handleMessage(message) {
  switch (message.type) {
    case 'chat_message':
      // Display in chat: message.payload.text
      // Optional list: message.payload.list_items
      break;

    case 'action_request':
      // Show buttons: message.payload.actions
      // Prompt: message.payload.prompt_text
      break;

    case 'status_update':
      // Show loading: message.payload.text
      // Progress bar: message.payload.progress
      break;

    case 'presentation_url':
      // Load in iframe: message.payload.url
      // Slide count: message.payload.slide_count
      break;
  }
}
```

### 4. Display Presentation

```javascript
// When you receive presentation_url
if (message.type === 'presentation_url') {
  const iframe = document.getElementById('presentation-iframe');
  iframe.src = message.payload.url;
  iframe.style.display = 'block';
}
```

---

## 📋 Key Message Types

### Chat Message (text, questions, confirmations)
```json
{
  "type": "chat_message",
  "payload": {
    "text": "Hello! What presentation would you like?",
    "list_items": ["Item 1", "Item 2"]
  }
}
```

### Action Request (buttons, choices)
```json
{
  "type": "action_request",
  "payload": {
    "prompt_text": "Does this work?",
    "actions": [
      { "label": "Yes", "primary": true },
      { "label": "No", "primary": false }
    ]
  }
}
```

### Status Update (loading, progress)
```json
{
  "type": "status_update",
  "payload": {
    "status": "generating",
    "text": "Creating presentation...",
    "progress": 50
  }
}
```

### Presentation URL (final result!)
```json
{
  "type": "presentation_url",
  "payload": {
    "url": "https://web-production-f0d13.up.railway.app/p/abc-123",
    "slide_count": 8
  }
}
```

---

## 🎨 Recommended UI Layout

```
┌─────────────────────────────────────────────────┐
│              Director v2.0                      │
├──────────────────────┬──────────────────────────┤
│ CHAT (40% width)     │ PRESENTATION (60% width) │
│                      │                          │
│ • Messages           │ • Empty until URL        │
│ • User input         │ • Then: <iframe>         │
│ • Action buttons     │                          │
│ • Status/loading     │                          │
└──────────────────────┴──────────────────────────┘
```

---

## 🔄 Complete Flow

```
1. User connects → Receives greeting
2. User: "I need a presentation about X"
3. AI: Asks clarifying questions (list_items)
4. User: Answers questions
5. AI: Shows plan + action_request ("Does this work?")
6. User: "Yes" (clicks button)
7. AI: status_update ("Creating presentation..." + progress)
8. AI: presentation_url (load in iframe!)
```

---

## ✅ Checklist

- [ ] WebSocket connection with session_id + user_id
- [ ] Send messages as `{ type: 'user_message', data: { text: '...' }}`
- [ ] Handle 4 message types: chat, action, status, presentation_url
- [ ] Display chat messages with list_items support
- [ ] Show action buttons from action_request
- [ ] Display loading/progress from status_update
- [ ] Load presentation URL in iframe
- [ ] Add error handling (reconnection)
- [ ] Test complete flow

---

## 🧪 Test It

Open browser console:

```javascript
// Connect
const ws = new WebSocket('wss://directorv20-production.up.railway.app/ws?session_id=' + crypto.randomUUID() + '&user_id=test');
ws.onmessage = (e) => console.log(JSON.parse(e.data));

// Wait for greeting, then send:
ws.send(JSON.stringify({
  type: 'user_message',
  data: { text: 'I need a presentation about AI' }
}));

// Continue conversation...
```

---

## 📖 Full Documentation

See `FRONTEND_INTEGRATION.md` for:
- Complete API reference
- Full code examples (JS, TS, React)
- Error handling patterns
- TypeScript types
- Best practices
- Troubleshooting guide

---

## 🆘 Common Issues

**Not connecting?**
- Use `wss://` not `ws://`
- Include `session_id` and `user_id` parameters

**Not receiving messages?**
- Check `ws.onmessage` is set
- Parse JSON: `JSON.parse(event.data)`

**Iframe not loading?**
- Set `iframe.src = message.payload.url`
- Check URL in message.payload, not message.url

---

## 🔗 Live URLs

- **WebSocket**: `wss://directorv20-production.up.railway.app/ws`
- **Health Check**: `https://directorv20-production.up.railway.app/health`
- **API Docs**: `https://directorv20-production.up.railway.app/docs`

---

**Need help?** Check `FRONTEND_INTEGRATION.md` for complete documentation.
