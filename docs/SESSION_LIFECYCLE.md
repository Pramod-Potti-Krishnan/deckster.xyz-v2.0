# Session Lifecycle Architecture

**Version**: 1.0
**Date**: November 26, 2025
**Status**: Production Ready (Feature Flag Controlled)

---

## Overview

This document describes the session lifecycle management system that enables users to upload files before sending their first message, improving the overall user experience.

---

## Session States

Sessions progress through the following states:

```
┌──────────┐  Click "Attach Files"   ┌──────────┐  Send First Message   ┌────────┐
│   NEW    │ ──────────────────────> │  DRAFT   │ ────────────────────> │ ACTIVE │
│ (no DB)  │                          │ (has DB) │                        │        │
└──────────┘                          └──────────┘                        └────────┘
                                           │                                   │
                                           │ No activity (24h)                 │ User archives
                                           ▼                                   ▼
                                      ┌──────────┐                        ┌──────────┐
                                      │ DELETED  │                        │ ARCHIVED │
                                      │(cleanup) │                        │          │
                                      └──────────┘                        └──────────┘
```

### State Definitions

| State | Description | Database Record | firstMessageAt | lastMessageAt |
|-------|-------------|-----------------|----------------|---------------|
| **NEW** | Page just loaded, no session created yet | ❌ No | null | null |
| **DRAFT** | Session created for file upload, no messages | ✅ Yes | null | null |
| **ACTIVE** | User has sent at least one message | ✅ Yes | ✅ Set | ✅ Set |
| **ARCHIVED** | User manually archived the session | ✅ Yes | ✅ Set | ✅ Set |
| **DELETED** | Cleanup job removed abandoned draft | ❌ No | N/A | N/A |

---

## User Experience Flow

### Before (Original Behavior)
1. User opens /builder
2. File upload button is **disabled** (grayed out)
3. User sends first message → Session created
4. File upload button becomes **enabled**
5. User can now upload files

**Problem**: Poor UX - users expect to upload files immediately

### After (With Feature Flag Enabled)
1. User opens /builder
2. File upload button is **enabled** immediately
3. User clicks "Attach Files" → Shows "Preparing..." (~300ms)
4. Draft session created in background
5. File picker opens → User selects files
6. Files upload to draft session
7. User sends message → Session becomes ACTIVE
8. **OR** User abandons → Cleanup job deletes after 24h

**Benefit**: Natural UX - upload files anytime

---

## Technical Implementation

### Database Schema

**ChatSession Model** (`fe_chat_sessions` table):
```prisma
model ChatSession {
  // ... existing fields ...

  status                 String    @default("draft")      // 'draft' | 'active' | 'archived'
  firstMessageAt         DateTime? @map("first_message_at")  // When session became active
  lastMessageAt          DateTime? @map("last_message_at")   // Most recent message

  // ... rest of model ...
}
```

### API Endpoints

#### 1. Session Activation
**POST** `/api/sessions/[id]/activate`

Called when user sends their first message to transition session from `draft` to `active`.

**Request**: No body required
**Response**:
```json
{
  "message": "Session activated successfully",
  "session": {
    "id": "uuid",
    "status": "active",
    "firstMessageAt": "2025-11-26T10:30:00Z",
    "lastMessageAt": "2025-11-26T10:30:00Z"
  }
}
```

**Authentication**: Required (NextAuth session)

#### 2. Cleanup Job (Dry Run)
**GET** `/api/admin/cleanup-sessions`

Shows what would be deleted without actually deleting. Useful for monitoring.

**Request**: No auth required (read-only)
**Response**:
```json
{
  "dryRun": true,
  "thresholdHours": 24,
  "cutoffTime": "2025-11-25T10:00:00Z",
  "wouldDelete": 15,
  "totalFiles": 42,
  "totalSizeMB": "125.50",
  "sessions": [
    {
      "id": "uuid",
      "userId": "user@example.com",
      "createdAt": "2025-11-24T08:00:00Z",
      "ageHours": 26,
      "fileCount": 3,
      "totalFileSize": 5242880
    }
  ]
}
```

#### 3. Cleanup Job (Actual Deletion)
**POST** `/api/admin/cleanup-sessions`

Deletes abandoned draft sessions. Protected by `CRON_SECRET`.

**Request Headers**:
```
Authorization: Bearer {CRON_SECRET}
```

**Response**:
```json
{
  "success": true,
  "thresholdHours": 24,
  "cutoffTime": "2025-11-25T10:00:00Z",
  "sessionsDeleted": 15,
  "filesDeleted": 42,
  "messagesDeleted": 0,
  "cacheDeleted": 15,
  "oldestSessionAge": 72,
  "uniqueUsers": 12,
  "geminiStoresAffected": 8,
  "sessions": [...]
}
```

### Cron Schedule

**File**: `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/admin/cleanup-sessions",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Schedule**: Daily at 2:00 AM UTC
**Cron Expression**: `0 2 * * *`

---

## Feature Flag

### Configuration

**Environment Variable**: `NEXT_PUBLIC_ENABLE_EARLY_SESSION_CREATION`

**Values**:
- `"false"` (default) - Original behavior, file upload disabled until first message
- `"true"` - New behavior, file upload creates draft session immediately

### Code Logic

**File**: `app/builder/page.tsx`
```typescript
<FileUploadButton
  onFilesSelected={handleFilesSelected}
  maxFiles={5}
  currentFileCount={uploadedFiles.length}
  disabled={
    features.enableEarlySessionCreation
      ? isLoadingSession  // Only disabled while loading
      : (!currentSessionId || isLoadingSession)  // Disabled until session exists
  }
  onRequestSession={
    features.enableEarlySessionCreation
      ? handleRequestSession  // Create session before upload
      : undefined  // No session creation
  }
  isCreatingSession={
    features.enableEarlySessionCreation
      ? isCreatingSession
      : false
  }
/>
```

---

## Cleanup Job Logic

### What Gets Deleted

A draft session is considered "abandoned" and eligible for deletion if **ALL** of the following are true:

1. `status = 'draft'`
2. `lastMessageAt IS NULL` (no messages ever sent)
3. `createdAt < NOW() - THRESHOLD` (older than 24 hours by default)

### What Happens During Cleanup

1. **Find** abandoned draft sessions
2. **Delete** uploaded files (database records)
3. **Delete** messages (shouldn't exist, but checked)
4. **Delete** session state cache
5. **Delete** session records
6. **Note**: Gemini File Search Stores auto-expire after 48h (no API call needed)

### Cascade Deletion

The database uses `onDelete: Cascade` for related records:
```prisma
messages      ChatMessage[]       // Auto-deleted
uploadedFiles UploadedFile[]      // Auto-deleted
stateCache    SessionStateCache?  // Auto-deleted
```

---

## Migration Guide

### Prerequisites

1. **Database Migration** - Add `firstMessageAt` field
2. **Environment Variables** - Configure `CRON_SECRET`
3. **Feature Flag** - Default to `false` initially

### Step-by-Step Deployment

#### Step 1: Database Migration (Supabase)

Run in Supabase SQL Editor:
```sql
-- See: docs/session_lifecycle_migration.sql
ALTER TABLE fe_chat_sessions ADD COLUMN IF NOT EXISTS first_message_at TIMESTAMP;

UPDATE fe_chat_sessions
SET first_message_at = last_message_at, status = 'active'
WHERE last_message_at IS NOT NULL AND first_message_at IS NULL;
```

**Verify**:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fe_chat_sessions' AND column_name = 'first_message_at';
```

#### Step 2: Deploy Code (Feature Flag OFF)

```bash
git pull origin main  # Get latest code
# Verify .env has NEXT_PUBLIC_ENABLE_EARLY_SESSION_CREATION="false"
vercel deploy
```

#### Step 3: Configure Production Environment

In Vercel Dashboard → Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `CRON_SECRET` | Generate with `openssl rand -base64 32` | Required |
| `SESSION_CLEANUP_THRESHOLD_HOURS` | `24` | Optional (defaults to 24) |
| `NEXT_PUBLIC_ENABLE_EARLY_SESSION_CREATION` | `false` | Keep disabled initially |

#### Step 4: Monitor Cleanup Job (Dry Run)

**First Week**: Monitor what would be deleted:
```bash
curl https://your-domain.com/api/admin/cleanup-sessions
```

**Check logs** in Vercel dashboard to ensure no active sessions would be deleted.

#### Step 5: Enable Cleanup Job

After 3-7 days of monitoring, the cron job will automatically start running (POST method with `CRON_SECRET`).

**Verify** in Vercel → Cron Jobs → Check execution logs

#### Step 6: Enable Feature Flag (A/B Test)

**Week 2**: Enable for 10% of users (use feature flag service or gradual rollout)

**Monitor metrics**:
- Draft session creation rate
- Draft → Active conversion rate
- Abandonment rate
- File upload success rate

**Week 3**: If metrics look good, enable for 100%:
```bash
NEXT_PUBLIC_ENABLE_EARLY_SESSION_CREATION="true"
```

---

## Monitoring & Metrics

### Key Metrics

1. **Draft Session Creation Rate**
   - Track: `COUNT(*)` where `status='draft'` per day
   - Expected: Increase by ~20% after enabling

2. **Conversion Rate** (Draft → Active)
   - Track: `COUNT(*) where firstMessageAt IS NOT NULL / COUNT(*) where status='draft'`
   - Target: >75%

3. **Abandonment Rate**
   - Track: Cleanup job deletions per day
   - Target: <25% of draft sessions

4. **File Upload Success Rate**
   - Track: Upload API success vs failures
   - Target: >95%

### Dashboard Queries

**Daily draft sessions**:
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as draft_sessions,
  COUNT(CASE WHEN first_message_at IS NOT NULL THEN 1 END) as activated,
  ROUND(100.0 * COUNT(CASE WHEN first_message_at IS NOT NULL THEN 1 END) / COUNT(*), 2) as conversion_rate
FROM fe_chat_sessions
WHERE status = 'draft' OR (status = 'active' AND created_at > NOW() - INTERVAL '7 days')
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Cleanup job performance**:
```sql
SELECT
  COUNT(*) as abandoned_sessions,
  SUM(CASE WHEN created_at < NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END) as eligible_for_cleanup
FROM fe_chat_sessions
WHERE status = 'draft' AND last_message_at IS NULL;
```

---

## Rollback Plan

### Immediate Rollback (0 downtime)

Set feature flag to `false`:
```bash
NEXT_PUBLIC_ENABLE_EARLY_SESSION_CREATION="false"
```

**Effect**: Reverts to original behavior immediately. No code changes needed.

### Full Rollback (if database issues)

1. **Disable cleanup job** (remove from `vercel.json`)
2. **Deploy previous version** of code
3. **Optional**: Remove `firstMessageAt` column (not recommended unless necessary)

---

## FAQ

### Q: What happens to files in deleted sessions?

**A**:
- Database records are deleted immediately
- Gemini files auto-expire after 48 hours (no API call needed)
- Gemini File Search Stores also auto-expire after 48 hours

### Q: Can users recover deleted draft sessions?

**A**: No. Draft sessions are deleted permanently after 24h of inactivity. This is by design to keep the database clean.

### Q: What if a user is actively uploading when cleanup runs?

**A**: Very unlikely - cleanup only targets sessions >24h old. Active uploads complete in seconds. If it happens, upload will fail with 404, user can retry.

### Q: How do I test the cleanup job locally?

**A**:
```bash
# Dry run (no auth required)
curl http://localhost:3002/api/admin/cleanup-sessions

# Actual deletion (requires CRON_SECRET)
curl -X POST http://localhost:3002/api/admin/cleanup-sessions \
  -H "Authorization: Bearer your-cron-secret"
```

### Q: Can I change the 24h threshold?

**A**: Yes, set `SESSION_CLEANUP_THRESHOLD_HOURS` environment variable:
```bash
SESSION_CLEANUP_THRESHOLD_HOURS="12"  # 12 hours instead of 24
```

### Q: Will this increase database size?

**A**: Slightly (~20% more sessions created), but cleanup job keeps it manageable. Draft sessions are deleted after 24h, so steady-state size increase is minimal.

---

## Security Considerations

### CRON_SECRET Protection

- **Required** for POST endpoint (actual deletion)
- **Generate** with `openssl rand -base64 32`
- **Store** in Vercel environment variables (encrypted)
- **Never** commit to git

### Session Ownership Validation

All API endpoints verify session belongs to authenticated user:
```typescript
if (chatSession.userId !== session.user.email) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
}
```

### Rate Limiting

Consider adding rate limiting to session creation:
```typescript
// In /app/api/sessions/route.ts
const draftCount = await prisma.chatSession.count({
  where: { userId: user.id, status: 'draft' }
})

if (draftCount >= 10) {
  return NextResponse.json({ error: 'Too many draft sessions' }, { status: 429 })
}
```

---

## Troubleshooting

### Issue: Cleanup job not running

**Check**:
1. Vercel → Cron Jobs → View execution logs
2. Verify `CRON_SECRET` is set in environment variables
3. Check `vercel.json` has correct cron configuration

### Issue: Sessions not being deleted

**Debug**:
```bash
# Check dry run to see what would be deleted
curl https://your-domain.com/api/admin/cleanup-sessions
```

**Common causes**:
- Sessions have `lastMessageAt` set (not eligible)
- Sessions are newer than threshold
- Cleanup job failing (check logs)

### Issue: Feature flag not working

**Check**:
1. Environment variable is `NEXT_PUBLIC_*` (client-side)
2. Rebuild application after changing env var (Next.js embeds at build time)
3. Clear browser cache

---

**Version**: 1.0
**Last Updated**: November 26, 2025
**Status**: Production Ready (Feature Flag Controlled)
