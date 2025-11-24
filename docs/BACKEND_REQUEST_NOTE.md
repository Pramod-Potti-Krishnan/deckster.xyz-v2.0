# Backend Whitelist Request - Quick Reference

**Date**: 2025-11-24
**Status**: 🔴 BLOCKING PRODUCTION

---

## Issue Summary

Presentation viewer toolbar buttons are **non-functional in production** because the backend is rejecting postMessage commands from `https://www.deckster.xyz`.

**Error in Console**:
```
⚠️ Rejected postMessage from unauthorized origin: https://www.deckster.xyz
```

---

## Request

Add these domains to the v7.5-main viewer's postMessage origin whitelist:
- `https://www.deckster.xyz`
- `https://deckster.xyz`

**Regex Pattern**:
```javascript
/^https:\/\/(www\.)?deckster\.xyz$/
```

---

## Detailed Report

**Full Path**:
```
/Users/pk1980/Documents/Software/deckster-frontend/docs/BACKEND_ORIGIN_WHITELIST_REQUEST.md
```

The detailed report includes:
- Root cause analysis
- Console log evidence
- Technical implementation details
- Code changes needed
- Testing instructions
- Verification checklist

---

## Impact

**Broken Features** (production only):
- ❌ Prev/Next navigation buttons
- ❌ Grid/Overview button
- ❌ Edit mode toggle
- ❌ Save/Cancel buttons
- ❌ Slide counter (shows "1 / 0")

**Working Features**:
- ✅ Keyboard shortcuts (G, E, B keys)
- ✅ Presentation display
- ✅ Fullscreen button

---

## Priority

**HIGH** - 100% of toolbar functionality is non-functional in production.

Estimated fix time: **5 minutes** (add 2 lines to backend whitelist)

---

## Backend Team Contact

**Backend Location**:
```
/Users/pk1980/Documents/Software/deckster-backend/deckster-w-content-strategist/agents/layout_builder_main/v7.5-main/
```

**File to Update**: Viewer postMessage event handler (likely in `presentation-viewer.html` or server configuration)

**Current Whitelist** (from docs):
- `localhost:*`
- `127.0.0.1:*`
- `*.up.railway.app`
- `*.vercel.app`
- `*.netlify.app`

**Needed Addition**:
- `(www.)?deckster.xyz`

---

## Next Steps

1. ✅ Detailed report created
2. ⏳ Send report to backend team
3. ⏳ Backend adds domains to whitelist
4. ⏳ Deploy updated viewer
5. ⏳ Test toolbar buttons on production

---

**For full technical details, see**: `BACKEND_ORIGIN_WHITELIST_REQUEST.md`
