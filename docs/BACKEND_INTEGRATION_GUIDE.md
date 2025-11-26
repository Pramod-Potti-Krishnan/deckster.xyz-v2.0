# Backend Integration Guide - New File Search Architecture

**Target Audience**: Backend Team
**Date**: November 26, 2025
**Status**: Ready for Integration

---

## TL;DR - What Changed

**Before**: Backend managed file uploads and File Search Stores
**After**: Frontend manages files and stores, backend only does RAG queries

### What You Need to Do

1. ✅ Update message handler to accept `store_name` parameter
2. ✅ Use provided `store_name` for RAG queries (don't create your own)
3. ❌ Remove `/api/v1/files/upload` endpoint
4. ❌ Remove file/store database tables

---

## New Message Format

### What Backend Receives

**WebSocket Message Type**: `user_message`

```json
{
  "type": "user_message",
  "data": {
    "text": "Create a presentation about Q4 sales performance",
    "store_name": "fileSearchStores/store_abc123",
    "file_count": 3
  }
}
```

**Fields**:
- `text` (string): User's message text
- `store_name` (string, optional): Gemini File Search Store resource name
- `file_count` (number, optional): Number of files in the store (for logging)

### When `store_name` is Present

User has attached files. Use the provided File Search Store for RAG.

### When `store_name` is Absent

No files attached. Perform standard content generation without RAG.

---

## Code Changes Required

### Python Example (Vertex AI SDK)

```python
from vertexai.generative_models import GenerativeModel, Tool, FileSearchTool

def handle_user_message(message_data: dict):
    text = message_data["text"]
    store_name = message_data.get("store_name")  # Optional field
    file_count = message_data.get("file_count", 0)

    # Initialize model
    model = GenerativeModel('gemini-2.0-flash-exp')

    if store_name:
        # RAG mode - use File Search with provided store
        print(f"📎 Using File Search Store: {store_name} ({file_count} files)")

        response = model.generate_content(
            contents=text,
            tools=[
                Tool(
                    file_search=FileSearchTool(
                        file_search_store_names=[store_name]
                    )
                )
            ]
        )
    else:
        # Standard mode - no RAG
        print("💬 Standard generation (no files)")
        response = model.generate_content(contents=text)

    return response.text
```

### Node.js Example (Vertex AI SDK)

```javascript
import { VertexAI } from '@google-cloud/vertexai';

async function handleUserMessage(messageData) {
  const { text, store_name, file_count = 0 } = messageData;

  const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION,
  });

  const model = vertexAI.preview.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
  });

  if (store_name) {
    // RAG mode - use File Search
    console.log(`📎 Using File Search Store: ${store_name} (${file_count} files)`);

    const response = await model.generateContent({
      contents: text,
      tools: [{
        fileSearch: {
          fileSearchStoreNames: [store_name]
        }
      }]
    });

    return response.response.text();
  } else {
    // Standard mode - no RAG
    console.log('💬 Standard generation (no files)');

    const response = await model.generateContent({ contents: text });
    return response.response.text();
  }
}
```

---

## What to Remove

### 1. File Upload Endpoint

```python
# DELETE THIS ENTIRE ENDPOINT
@app.post("/api/v1/files/upload")
async def upload_file(...):
    # Frontend now handles this directly with Gemini
    # No longer needed
    pass
```

### 2. Database Tables/Models

```python
# REMOVE these models
class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    # ...

class FileSearchStore(Base):
    __tablename__ = "file_search_stores"
    # ...
```

**Database Migration**:
```sql
-- Drop tables (after confirming frontend is working)
DROP TABLE IF EXISTS uploaded_files CASCADE;
DROP TABLE IF EXISTS file_search_stores CASCADE;
```

### 3. Store Management Code

```python
# REMOVE all functions like:
def create_file_search_store(session_id): ...
def upload_to_gemini(file): ...
def manage_store_lifecycle(): ...
```

**Reason**: Frontend now manages all of this.

---

## Testing the Integration

### 1. Test Without Files (Standard Mode)

**Send**:
```json
{
  "type": "user_message",
  "data": {
    "text": "Create a slide about innovation"
  }
}
```

**Expected**: Backend generates content normally without RAG.

### 2. Test With Files (RAG Mode)

**Send**:
```json
{
  "type": "user_message",
  "data": {
    "text": "Create slides based on the uploaded documents",
    "store_name": "fileSearchStores/test-store-123",
    "file_count": 2
  }
}
```

**Expected**: Backend uses provided File Search Store for RAG.

### 3. Verify Backward Compatibility

**Old messages (no store_name)** should still work:
```json
{
  "type": "user_message",
  "data": {
    "text": "Create a slide"
  }
}
```

---

## Deployment Strategy

### Phase 1: Update Backend (Non-Breaking)

1. Update message handler to check for `store_name` field
2. Use `store_name` if present, otherwise standard mode
3. Keep old `/api/v1/files/upload` endpoint temporarily (unused)
4. Deploy backend changes

### Phase 2: Verify Frontend Integration

1. Frontend team tests file uploads
2. Verify `store_name` is received correctly
3. Verify RAG queries work with provided stores

### Phase 3: Cleanup (After Verification)

1. Remove `/api/v1/files/upload` endpoint
2. Drop old database tables
3. Remove file management code

---

## FAQ

### Q: What if I need file metadata (name, size, type)?

**A**: Frontend no longer sends individual file metadata. If you need it for logging:
- You have `file_count` for basic logging
- File content is accessible via the File Search Store in RAG queries
- For detailed metadata, query the File Search Store directly using Vertex AI SDK

### Q: How long do files persist in the store?

**A**:
- Files auto-delete after 48 hours (Gemini behavior)
- Stores persist until frontend deletes them
- Frontend manages store lifecycle (creates on first upload, can delete on session archive)

### Q: What if the store doesn't exist?

**A**:
- This shouldn't happen - frontend creates stores before sending `store_name`
- If it does, Gemini will return an error (handle gracefully)
- Log the error and fall back to standard mode

### Q: Can I still upload files from backend for other purposes?

**A**: Yes, but:
- Don't create File Search Stores yourself (frontend manages them)
- If you need to add files to existing store, you can use Vertex AI SDK
- But this breaks the architecture separation - consider if really necessary

### Q: How do I test RAG locally without frontend?

**A**:
```python
# Create a test store manually
from lib.gemini_store_manager import create_file_search_store, upload_file_to_store

store_name = await create_file_search_store({
    "sessionId": "test-session",
    "userId": "test-user"
})

# Upload test file
await upload_file_to_store({
    "storeName": store_name,
    "filePath": "./test-document.pdf",
    "displayName": "test-document.pdf"
})

# Now use store_name in your tests
test_message = {
    "type": "user_message",
    "data": {
        "text": "Summarize the document",
        "store_name": store_name,
        "file_count": 1
    }
}
```

### Q: What about rate limiting?

**A**:
- Vertex AI has rate limits per project
- Monitor your quota in GCP Console
- Frontend implements retry logic for transient failures
- Backend should handle quota errors gracefully

---

## Migration Checklist

### Pre-Deployment
- [ ] Review new message format
- [ ] Update message handler to check for `store_name`
- [ ] Add RAG logic using provided File Search Store
- [ ] Add fallback to standard mode when `store_name` absent
- [ ] Test both modes (with/without files)

### Deployment
- [ ] Deploy backend changes (non-breaking)
- [ ] Verify frontend file uploads work
- [ ] Monitor logs for `store_name` usage
- [ ] Check RAG queries are using correct stores

### Post-Deployment Cleanup
- [ ] Remove old `/api/v1/files/upload` endpoint
- [ ] Drop database tables (after 7+ days of stability)
- [ ] Remove unused file management code
- [ ] Update backend documentation

---

## Support

**Frontend Contact**: Pramod Potti
**Architecture Docs**: `/docs/GEMINI_FILE_SEARCH_ARCHITECTURE.md`

**Issues?**
- Check frontend logs for `store_name` being sent
- Check backend logs for RAG query structure
- Verify GCP service account has "Vertex AI User" role

---

## Example: Complete Backend Handler

```python
# app/websocket/handlers.py
from vertexai.generative_models import GenerativeModel, Tool, FileSearchTool

async def handle_user_message(websocket, message_data: dict):
    """
    Handle user message with optional File Search Store.

    Args:
        message_data: {
            "text": str,
            "store_name": str (optional),
            "file_count": int (optional)
        }
    """
    text = message_data["text"]
    store_name = message_data.get("store_name")
    file_count = message_data.get("file_count", 0)

    try:
        model = GenerativeModel('gemini-2.0-flash-exp')

        if store_name:
            # User has attached files - use RAG
            print(f"[RAG] Using store: {store_name} ({file_count} files)")

            response = model.generate_content(
                contents=text,
                tools=[Tool(file_search=FileSearchTool(
                    file_search_store_names=[store_name]
                ))]
            )
        else:
            # No files - standard generation
            print(f"[Standard] Generating content without RAG")
            response = model.generate_content(contents=text)

        # Send response back to frontend
        await websocket.send_json({
            "type": "bot_message",
            "data": {
                "text": response.text,
                "used_rag": bool(store_name)
            }
        })

    except Exception as e:
        print(f"[Error] Content generation failed: {e}")
        await websocket.send_json({
            "type": "error",
            "data": {"message": "Content generation failed"}
        })
```

---

**Version**: 1.0
**Last Updated**: November 26, 2025
**Status**: Ready for Backend Integration
