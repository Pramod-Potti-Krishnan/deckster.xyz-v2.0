# Session Lifecycle Deployment Guide

**Quick Reference for Production Deployment**

---

## ✅ What's Been Completed

- [x] Database schema updated (Prisma)
- [x] Session activation API created
- [x] Cleanup job API with dry-run mode
- [x] Vercel cron configuration
- [x] Feature flag system
- [x] Comprehensive documentation
- [x] Code deployed to GitHub

---

## 🚀 Deployment Steps

### Step 1: Database Migration (Supabase)

**File**: `docs/session_lifecycle_migration.sql`

1. Open Supabase SQL Editor
2. Copy/paste the entire migration file
3. Click "Run"

**Verify**:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'fe_chat_sessions'
  AND column_name IN ('first_message_at', 'status');
```

**Expected**: Shows `first_message_at` column exists

---

### Step 2: Configure Vercel Environment Variables

**Generate CRON_SECRET** (run locally):
```bash
openssl rand -base64 32
```

**Add to Vercel Dashboard** → Your Project → Settings → Environment Variables:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `CRON_SECRET` | *output from openssl command* | Production, Preview, Development |
| `SESSION_CLEANUP_THRESHOLD_HOURS` | `24` | Production, Preview, Development |
| `NEXT_PUBLIC_ENABLE_EARLY_SESSION_CREATION` | `false` | Production, Preview, Development |

**Important**: The feature flag MUST be `false` initially!

---

### Step 3: Deploy to Vercel

```bash
# Code is already on GitHub from our commits
# Vercel will auto-deploy if connected to GitHub
# OR manually trigger deployment in Vercel dashboard
```

**Verify deployment**:
- Go to Vercel Dashboard → Your Project → Deployments
- Check latest deployment status
- Click on deployment to see build logs

---

### Step 4: Test Cleanup Job (Dry Run)

Wait 24 hours after deployment, then test:

```bash
curl https://your-domain.vercel.app/api/admin/cleanup-sessions
```

**Expected Response**:
```json
{
  "dryRun": true,
  "thresholdHours": 24,
  "wouldDelete": 0,  // Should be 0 or very low initially
  "sessions": []
}
```

**Monitor for 3-7 days** to ensure:
- No active sessions would be deleted
- Only abandoned drafts are identified
- Numbers look reasonable

---

### Step 5: Verify Cron Job is Running

**Vercel Dashboard** → Your Project → Cron Jobs

**Check**:
- Cron job appears in list
- Path: `/api/admin/cleanup-sessions`
- Schedule: `0 2 * * *` (daily at 2 AM UTC)
- Status: Enabled

**After first execution** (next 2 AM UTC):
- Check execution logs
- Verify it ran successfully
- Check how many sessions were deleted

---

### Step 6: Enable Feature Flag (Gradual Rollout)

**Week 2-3**: After monitoring cleanup job

**Option A: Full Rollout** (Recommended for smaller apps)
1. Vercel → Environment Variables
2. Change `NEXT_PUBLIC_ENABLE_EARLY_SESSION_CREATION` to `true`
3. Redeploy (trigger new deployment)

**Option B: Gradual Rollout** (For larger apps)
1. Use A/B testing service (Optimizely, LaunchDarkly, etc.)
2. Start with 10% of users
3. Monitor metrics for 1 week
4. Increase to 50%, then 100%

---

## 📊 Monitoring Checklist

After enabling feature flag, monitor these daily:

### Success Metrics
- [ ] Draft session creation rate increased
- [ ] File upload success rate remains >95%
- [ ] Draft → Active conversion rate >75%
- [ ] User complaints about "disabled button" decreased to zero

### Health Metrics
- [ ] Database size growth is manageable
- [ ] Cleanup job runs successfully daily
- [ ] No errors in session activation API
- [ ] Response times remain acceptable

### SQL Queries for Monitoring

**Draft sessions created today**:
```sql
SELECT COUNT(*) as draft_sessions_today
FROM fe_chat_sessions
WHERE status = 'draft'
  AND DATE(created_at) = CURRENT_DATE;
```

**Conversion rate (last 7 days)**:
```sql
SELECT
  COUNT(*) as total_drafts,
  COUNT(CASE WHEN first_message_at IS NOT NULL THEN 1 END) as activated,
  ROUND(100.0 * COUNT(CASE WHEN first_message_at IS NOT NULL THEN 1 END) / COUNT(*), 2) as conversion_rate_percent
FROM fe_chat_sessions
WHERE created_at > NOW() - INTERVAL '7 days'
  AND (status = 'draft' OR status = 'active');
```

---

## 🔧 Troubleshooting

### Problem: Cleanup job not running

**Check**:
1. Vercel → Cron Jobs → View execution logs
2. Verify `CRON_SECRET` is set (check environment variables)
3. Check `vercel.json` has cron configuration

**Fix**:
- If missing from Vercel dashboard, redeploy
- If failing, check logs for error details

### Problem: Feature flag not working

**Check**:
1. Environment variable is `NEXT_PUBLIC_ENABLE_EARLY_SESSION_CREATION`
2. Value is exactly `"true"` (string, lowercase)
3. You redeployed after changing the variable

**Important**: Next.js embeds client-side env vars at build time, so you MUST redeploy!

### Problem: Too many draft sessions being created

**Action**:
1. Reduce `SESSION_CLEANUP_THRESHOLD_HOURS` to `12` hours
2. Add rate limiting (see docs/SESSION_LIFECYCLE.md)
3. Monitor user behavior for abuse

---

## 🔄 Rollback Procedure

### Immediate Rollback (if issues occur)

**Step 1**: Disable feature flag
```bash
# Vercel → Environment Variables
NEXT_PUBLIC_ENABLE_EARLY_SESSION_CREATION="false"
```

**Step 2**: Redeploy
```bash
# Trigger new deployment in Vercel dashboard
# OR push a commit to trigger auto-deploy
```

**Effect**: Reverts to original behavior (file upload disabled until first message)

### Full Rollback (if database issues)

```bash
# Revert to commit before session lifecycle
git revert d6db903 6999752
git push origin main
```

**Note**: This will remove all session lifecycle code

---

## 📈 Expected Results

### Before Feature Flag Enabled
- Original behavior preserved
- Cleanup job runs but finds few/no sessions
- Database schema ready but unused

### After Feature Flag Enabled
- Users can upload files immediately
- ~20% increase in draft sessions created
- ~75-80% of drafts become active
- ~20-25% of drafts get cleaned up after 24h
- Overall better user experience

---

## 📞 Support

**Documentation**:
- Full Architecture: `docs/SESSION_LIFECYCLE.md`
- API Reference: `docs/SESSION_LIFECYCLE.md#api-endpoints`
- Migration SQL: `docs/session_lifecycle_migration.sql`

**Monitoring**:
- Vercel Dashboard: Check deployment logs
- Supabase: Query database directly
- Sentry/Error Tracking: Monitor for API errors

---

## ✅ Deployment Checklist

Use this checklist to track your deployment:

- [ ] Database migration executed successfully
- [ ] `CRON_SECRET` generated and added to Vercel
- [ ] `SESSION_CLEANUP_THRESHOLD_HOURS` set to `24`
- [ ] `NEXT_PUBLIC_ENABLE_EARLY_SESSION_CREATION` set to `false`
- [ ] Code deployed to Vercel
- [ ] Dry-run cleanup tested (returns sensible data)
- [ ] Cron job visible in Vercel dashboard
- [ ] Monitored dry-run for 3-7 days
- [ ] First cleanup job executed successfully
- [ ] Feature flag enabled (or gradual rollout started)
- [ ] Metrics monitored for 1 week
- [ ] User feedback collected
- [ ] Full rollout complete (if gradual)

---

**Last Updated**: November 26, 2025
**Status**: Ready for Production Deployment
