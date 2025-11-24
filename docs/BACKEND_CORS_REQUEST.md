# CORS Headers Request for v7.5-main Presentation Viewer

**Date**: 2025-01-23
**From**: Frontend Team
**To**: Backend Team (v7.5-main Presentation Viewer)
**Priority**: High

---

## Issue Summary

The presentation viewer buttons (Prev, Next, Grid, Edit, Fullscreen) in our frontend are **not working** due to cross-origin security restrictions when embedding the v7.5-main presentation viewer in an iframe.

---

## Root Cause

When we embed the presentation viewer via iframe:
```html
<iframe src="https://web-production-f0d13.up.railway.app/p/{id}" />
```

From our frontend domain (localhost:3002 or production domain), we cannot access the iframe's `contentWindow` to call functions like:
- `iframeWindow.Reveal.next()`
- `iframeWindow.Reveal.prev()`
- `iframeWindow.toggleOverview()`
- `iframeWindow.toggleEditMode()`
- `iframeWindow.saveAllChanges()`

This is blocked by the browser's Same-Origin Policy because:
- **Frontend domain**: `localhost:3002` (or production domain)
- **Iframe domain**: `web-production-f0d13.up.railway.app`

---

## Solution Required

According to the **Frontend Integration Guide** (v7.5-main, lines 371-377), the backend needs to add CORS headers:

```
Access-Control-Allow-Origin: *
X-Frame-Options: ALLOWALL
```

Or if you prefer more restrictive CORS:
```
Access-Control-Allow-Origin: https://our-production-domain.com
Access-Control-Allow-Origin: http://localhost:3002  (for development)
```

---

## Verification from Integration Guide

From `/agents/layout_builder_main/v7.5-main/docs/FRONTEND_INTEGRATION_GUIDE.md`:

> ### Cross-Origin Issues
>
> If embedding from a different domain, ensure CORS headers are set:
> ```
> Access-Control-Allow-Origin: *
> X-Frame-Options: ALLOWALL
> ```

---

## Expected Behavior After Fix

Once CORS headers are added, our frontend buttons will be able to:

1. **Navigation Buttons**:
   - Prev/Next buttons will call `iframeWindow.Reveal.prev()` and `.next()`

2. **Grid View Button**:
   - Will call `iframeWindow.toggleOverview()`

3. **Edit Mode Button**:
   - Will call `iframeWindow.toggleEditMode()` and `.saveAllChanges()`

4. **Fullscreen Button**:
   - Will open `/presentation/{id}` route in new tab

5. **Slide Counter**:
   - Will poll `iframeWindow.getCurrentSlideInfo()` every 500ms

---

## Testing Steps

After you add the CORS headers:

1. We'll embed the presentation in our frontend
2. Click the "Next" button
3. Browser console should show: `➡️ Next slide` (not a CORS error)
4. Presentation should navigate to next slide

---

## Current Workaround

Until CORS is added, users can:
- Use keyboard shortcuts (Arrow keys, Esc for overview)
- Use the presentation's built-in navigation arrows
- Click directly on the iframe to focus it

But our control buttons remain non-functional.

---

## Implementation Request

**Action Items for Backend Team**:

1. Add CORS headers to the v7.5-main presentation viewer responses
   - Routes: `/p/{id}` and `/viewer/{id}` (if still in use)

2. Set headers:
   ```
   Access-Control-Allow-Origin: *
   X-Frame-Options: ALLOWALL
   ```

3. Deploy to Railway production environment

4. Notify frontend team when deployed so we can verify

---

## Additional Context

- **Frontend implementation**: `/components/presentation-viewer.tsx`
- **Integration guide reference**: Lines 371-377 of FRONTEND_INTEGRATION_GUIDE.md
- **Current error in console**:
  ```
  Uncaught DOMException: Blocked a frame with origin "http://localhost:3002"
  from accessing a cross-origin frame.
  ```

---

## Questions?

Contact: Frontend Team
Reference: Presentation Viewer Integration (v7.5-main)

Thank you!
