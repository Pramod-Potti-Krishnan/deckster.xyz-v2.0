# Director v2.0 Documentation

Welcome to the Director v2.0 documentation. This folder contains all technical documentation for understanding, deploying, and integrating with the Director AI presentation assistant.

---

## 📚 Documentation Overview

### For Frontend Developers

| Document | Purpose | Time to Read |
|----------|---------|--------------|
| **[FRONTEND_QUICKSTART.md](./FRONTEND_QUICKSTART.md)** | Get started in 5 minutes | 5 min |
| **[FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)** | Complete integration guide | 30 min |

**Start here**: If you're building a frontend, start with `FRONTEND_QUICKSTART.md` for quick integration, then refer to `FRONTEND_INTEGRATION.md` for complete details.

---

### For Backend Developers

| Document | Purpose | Time to Read |
|----------|---------|--------------|
| **[Architecture Documentation](../../docs/architecture/)** | System architecture and design | 20 min |
| **[API Documentation](./API.md)** *(if exists)* | Backend API reference | 15 min |

---

### For DevOps / Deployment

| Document | Purpose | Time to Read |
|----------|---------|--------------|
| **[../DEPLOYMENT_SUCCESS.md](../DEPLOYMENT_SUCCESS.md)** | Deployment guide & status | 10 min |
| **[../RAILWAY_TEST_GUIDE.md](../RAILWAY_TEST_GUIDE.md)** | Testing Railway deployment | 15 min |

---

## 🚀 Quick Links

### Live System
- **WebSocket URL**: `wss://directorv20-production.up.railway.app/ws`
- **Health Check**: https://directorv20-production.up.railway.app/health
- **API Docs**: https://directorv20-production.up.railway.app/docs
- **Deck-Builder**: https://web-production-f0d13.up.railway.app

### GitHub
- **Repository**: https://github.com/Pramod-Potti-Krishnan/director_v2.0
- **Issues**: https://github.com/Pramod-Potti-Krishnan/director_v2.0/issues

---

## 📖 Documentation by Use Case

### "I want to build a frontend UI"
1. Read [FRONTEND_QUICKSTART.md](./FRONTEND_QUICKSTART.md)
2. Implement basic WebSocket connection
3. Test with browser console
4. Refer to [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) for:
   - Complete message type reference
   - Error handling patterns
   - React/TypeScript examples
   - Best practices

### "I want to understand the system architecture"
1. Read [../../docs/architecture/ARCHITECTURE.md](../../docs/architecture/ARCHITECTURE.md) *(if exists)*
2. Review conversation state machine
3. Understand message flow
4. Review deck-builder integration

### "I want to deploy to production"
1. Read [../DEPLOYMENT_SUCCESS.md](../DEPLOYMENT_SUCCESS.md)
2. Configure environment variables
3. Set up Railway or your hosting platform
4. Run tests with [../RAILWAY_TEST_GUIDE.md](../RAILWAY_TEST_GUIDE.md)

### "I want to test the API"
1. Use browser console test from [FRONTEND_QUICKSTART.md](./FRONTEND_QUICKSTART.md)
2. Run automated tests: `python3 test_railway_auto.py`
3. Use interactive test: `python3 test_railway_simple.py`

---

## 🎯 Key Concepts

### WebSocket Connection
Director v2.0 uses WebSocket for real-time bidirectional communication. Clients connect with a `session_id` and `user_id`, then exchange messages in JSON format.

### Message Protocol
The streamlined protocol uses 5 message types:
1. **chat_message** - Conversational text with optional lists
2. **action_request** - User interaction prompts with buttons
3. **status_update** - Loading states and progress
4. **presentation_url** - Final presentation URL (v2.0)
5. **state_change** - Internal state transitions (optional)

### Conversation Flow
```
Connect → Greeting → Topic → Questions → Answers → Plan →
Confirmation → Generation → Presentation URL → Display
```

### Split UI Layout
Recommended frontend layout:
- **Left Side (40%)**: Chat interface with messages, buttons, status
- **Right Side (60%)**: Presentation display (iframe with reveal.js)

---

## 🔧 Technical Stack

### Backend
- **Framework**: FastAPI with WebSocket support
- **AI**: Google Gemini (via PydanticAI)
- **Database**: Supabase (session management)
- **Deployment**: Railway
- **Language**: Python 3.13

### Presentation Generation
- **Generator**: Deck-Builder API
- **Format**: Reveal.js presentations
- **Output**: Hosted URLs

### Frontend (Recommended)
- **Protocol**: WebSocket
- **Format**: JSON messages
- **Framework**: Any (React, Vue, Vanilla JS)
- **Rendering**: Markdown support recommended

---

## 📊 API Message Examples

### Sending a Message (Client → Server)
```json
{
  "type": "user_message",
  "data": {
    "text": "I need a presentation about AI in healthcare"
  }
}
```

### Receiving a Message (Server → Client)
```json
{
  "message_id": "msg_abc123",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-10-12T10:30:00.000Z",
  "type": "chat_message",
  "payload": {
    "text": "Great topic! To create the perfect presentation...",
    "list_items": ["Question 1", "Question 2", "Question 3"]
  }
}
```

### Final Presentation URL
```json
{
  "type": "presentation_url",
  "payload": {
    "url": "https://web-production-f0d13.up.railway.app/p/abc-123",
    "presentation_id": "abc-123",
    "slide_count": 8,
    "message": "Your presentation is ready!"
  }
}
```

---

## 🧪 Testing

### Manual Test (Browser Console)
```javascript
const ws = new WebSocket('wss://directorv20-production.up.railway.app/ws?session_id=' + crypto.randomUUID() + '&user_id=test');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.send(JSON.stringify({ type: 'user_message', data: { text: 'Hello' }}));
```

### Automated Test (Python)
```bash
python3 test_railway_auto.py
```

### Interactive Test (Python)
```bash
python3 test_railway_simple.py
```

---

## 🆘 Getting Help

### Common Issues
See [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) → "Error Handling" section

### Troubleshooting
See [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) → "Testing" and "Troubleshooting" sections

### Contact
- GitHub Issues: https://github.com/Pramod-Potti-Krishnan/director_v2.0/issues
- Railway Logs: Check deployment logs in Railway dashboard

---

## 📝 Document Status

| Document | Last Updated | Status |
|----------|--------------|--------|
| FRONTEND_QUICKSTART.md | 2025-10-12 | ✅ Current |
| FRONTEND_INTEGRATION.md | 2025-10-12 | ✅ Current |
| DEPLOYMENT_SUCCESS.md | 2025-10-12 | ✅ Current |
| RAILWAY_TEST_GUIDE.md | 2025-10-12 | ✅ Current |

---

## 🎉 Quick Start Summary

**For Frontend Developers**:
1. Connect: `wss://directorv20-production.up.railway.app/ws?session_id={UUID}&user_id={ID}`
2. Send: `{ type: 'user_message', data: { text: '...' }}`
3. Receive: Handle 4 types: `chat_message`, `action_request`, `status_update`, `presentation_url`
4. Display: Load `presentation_url` payload in iframe

**See [FRONTEND_QUICKSTART.md](./FRONTEND_QUICKSTART.md) for complete 5-minute guide.**

---

**Version**: 2.0
**Status**: ✅ Production Ready
**Last Updated**: 2025-10-12
