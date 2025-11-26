# Production Setup Guide - Google Cloud Credentials

## Quick Setup for Vercel/Production

### Step 1: Generate Base64 Credentials

On your local machine (where `service-account-key.json` exists):

```bash
base64 -i service-account-key.json
```

Copy the entire output (it will be a long single-line string).

### Step 2: Configure Environment Variables in Vercel

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add these variables:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `GOOGLE_CLOUD_PROJECT` | `deckster-xyz` | Your GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` | GCP region |
| `GOOGLE_APPLICATION_CREDENTIALS_BASE64` | *paste base64 output* | Base64 service account |
| `GEMINI_MODEL` | `gemini-2.0-flash-exp` | Model to use |

**IMPORTANT**:
- Variable name MUST be `GOOGLE_APPLICATION_CREDENTIALS_BASE64` (with `_BASE64` suffix)
- Without the `_BASE64` suffix, the automatic decoding will not work
- Applies to all environments: Production, Preview, and Development

### Step 3: Deploy & Verify

1. **Trigger Deployment**: Push to GitHub or click "Redeploy" in Vercel Dashboard
2. **Check Logs**: After deployment, verify you see: `[Vertex AI] Using base64-encoded service account credentials`
3. **Test Upload**: Try uploading a file to confirm it works

---

## Alternative: Railway Setup

Railway supports file uploads, so you can use the file path method:

### Step 1: Upload Service Account File

1. In Railway dashboard, go to your project
2. Upload `service-account-key.json` to the project root
3. Note the path (usually `/app/service-account-key.json`)

### Step 2: Configure Environment Variables

| Variable Name | Value |
|--------------|-------|
| `GOOGLE_CLOUD_PROJECT` | `deckster-xyz` |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` |
| `GOOGLE_APPLICATION_CREDENTIALS` | `/app/service-account-key.json` |
| `GEMINI_MODEL` | `gemini-2.0-flash-exp` |

---

## How It Works

The app supports **three authentication methods** (in order of priority):

### 1. Base64 Credentials (Recommended for Vercel)
```bash
GOOGLE_APPLICATION_CREDENTIALS_BASE64="ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsIC4uLiB9Cg=="
```
- ✅ Works on serverless platforms (Vercel, Netlify)
- ✅ No file system required
- ✅ Easy copy/paste setup
- ✅ Single environment variable

### 2. File Path (Recommended for Railway/VPS)
```bash
GOOGLE_APPLICATION_CREDENTIALS="./service-account-key.json"
```
- ✅ Works on platforms with persistent file system
- ✅ Cleaner environment variables
- ❌ Requires file upload

### 3. Inline JSON (Not Recommended)
```bash
GOOGLE_APPLICATION_CREDENTIALS='{"type":"service_account",...}'
```
- ⚠️ Requires careful JSON escaping
- ⚠️ Hard to read/debug
- ⚠️ Error-prone

---

## Verification

After deployment, check your application logs for:

```
[Vertex AI] Using base64-encoded service account credentials
```

Or if using file path:
```
[Vertex AI] Using GOOGLE_APPLICATION_CREDENTIALS
```

---

## Security Best Practices

### ✅ DO:
- Use base64 encoding for serverless deployments
- Store credentials in platform's secret management (Vercel Environment Variables, Railway Variables)
- Rotate service account keys periodically
- Use least-privilege IAM roles (only "Vertex AI User" + "Storage Object Admin")
- Enable billing alerts in Google Cloud Console

### ❌ DON'T:
- Never commit service account JSON to git
- Never expose credentials in client-side code
- Never share base64 credentials in public channels
- Never use production credentials in development

---

## Troubleshooting

### Error: "Missing required environment variables"
- Ensure `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` are set
- Check variable names (no typos)

### Error: "Failed to decode GOOGLE_APPLICATION_CREDENTIALS_BASE64"
- Verify base64 string has no extra spaces or newlines
- Re-generate: `base64 -i service-account-key.json`
- Ensure entire output is copied

### Error: "Authentication failed"
- Verify service account has required IAM roles:
  - "Vertex AI User" (`roles/aiplatform.user`)
  - "Storage Object Admin" (`roles/storage.objectAdmin`)
- Check service account is in the correct project
- Verify credentials are for the correct project

### Error: "Quota exceeded"
- Check Google Cloud Console for quota limits
- Set up billing alerts
- Consider upgrading quota if needed

---

## Local Development

For local development, use the file path method:

```bash
# .env.local
GOOGLE_CLOUD_PROJECT="deckster-xyz"
GOOGLE_CLOUD_LOCATION="us-central1"
GOOGLE_APPLICATION_CREDENTIALS="./service-account-key.json"
GEMINI_MODEL="gemini-2.0-flash-exp"
```

Make sure `service-account-key.json` is in your project root and is in `.gitignore`.

---

## Cost Monitoring

### Set up billing alerts in Google Cloud Console:

1. Go to: https://console.cloud.google.com/billing
2. Select your billing account
3. Go to "Budgets & alerts"
4. Create budget with alerts at 50%, 90%, 100%

### Vertex AI Pricing (as of 2025):
- Gemini 2.0 Flash: ~$0.000075 per 1K characters input
- File storage: First 48 hours free, then auto-deleted
- File Search indexing: Included in model pricing

**Recommended budget**: $50/month for moderate usage

---

## Production Checklist

Before going live:

- [ ] Service account credentials configured (base64 or file path)
- [ ] All environment variables set in production platform
- [ ] IAM roles verified on service account
- [ ] Billing alerts configured in GCP Console
- [ ] Backend team has updated to accept `store_name` parameter
- [ ] End-to-end file upload tested in staging
- [ ] Logs show successful authentication
- [ ] File uploads complete successfully
- [ ] RAG queries work with uploaded files

---

**Last Updated**: November 26, 2025
**Support**: See `/docs/BACKEND_INTEGRATION_GUIDE.md` for backend coordination
