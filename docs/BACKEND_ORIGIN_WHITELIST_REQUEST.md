# Backend Request: Whitelist Production Domain for postMessage

**Date**: 2025-11-24
**From**: Frontend Team (deckster.xyz)
**To**: Backend Team (v7.5-main viewer)
**Priority**: HIGH
**Status**: BLOCKING PRODUCTION FEATURE

---

## Executive Summary

The presentation viewer toolbar buttons are **non-functional in production** because the backend postMessage bridge is rejecting all commands from our production domain `https://www.deckster.xyz`.

**Request**: Add `www.deckster.xyz` and `deckster.xyz` to the allowed origins whitelist.

---

## Root Cause

The v7.5-main viewer's postMessage validation only accepts messages from these origins:

✅ **Currently Whitelisted**:
- `localhost:*` (development)
- `127.0.0.1:*` (development)
- `*.up.railway.app` (Railway deployments)
- `*.vercel.app` (Vercel deployments)
- `*.netlify.app` (Netlify deployments)

❌ **Missing**:
- `www.deckster.xyz` (our production domain)
- `deckster.xyz` (alternate production domain)

**Source**: `/docs/FRONTEND_CORS_RESPONSE.md` lines 222-230

---

## Evidence from Console Logs

### 1. postMessage Commands Are Being Sent

Frontend buttons are working correctly and sending postMessage commands:

```
🔘 Edit button clicked!
🔘 Grid button clicked!
🔘 Next button clicked!
```

### 2. Backend is Rejecting Commands

All postMessage commands are rejected with this error:

```
⚠️ Rejected postMessage from unauthorized origin: https://www.deckster.xyz
(anonymous) @ a7b78d1d-809e-46d5-830f-f39864cbd1bc:286
```

This error appears **repeatedly** in the iframe console, confirming systematic rejection.

### 3. Commands Timeout

Because responses are never received, all commands timeout after 5 seconds:

```
presentation-viewer.tsx:60 Error toggling edit mode: Error: Command timeout
presentation-viewer.tsx:60 Error navigating to next slide: Error: Command timeout
presentation-viewer.tsx:60 Error toggling overview: Error: Command timeout
```

### 4. Polling Continuously Fails

Slide info polling (used for slide counter and navigation state) fails continuously:

```
presentation-viewer.tsx:138 ⏸️ Polling failed (iframe not ready)
presentation-viewer.tsx:138 ⏸️ Polling failed (iframe not ready)
presentation-viewer.tsx:138 ⏸️ Polling failed (iframe not ready)
```

This causes button disabled states to be incorrect:
```
🎯 Button states - currentSlide: 1, totalSlides: 0
   Prev disabled: true
   Next disabled: false
```

Note: `totalSlides: 0` is wrong - the presentation has 7 slides, but polling can't retrieve this info.

---

## Impact on User Experience

**Currently Working**:
- ✅ Presentation loads and displays correctly in iframe
- ✅ Keyboard shortcuts work (handled inside iframe, not via postMessage)
- ✅ Fullscreen button works (uses `window.open`, not postMessage)

**Currently Broken**:
- ❌ Prev/Next buttons (postMessage blocked)
- ❌ Grid/Overview button (postMessage blocked)
- ❌ Edit mode button (postMessage blocked)
- ❌ Save/Cancel buttons (postMessage blocked)
- ❌ Slide counter shows "1 / 0" (polling blocked)
- ❌ Button disabled states incorrect (polling blocked)

**Severity**: Users cannot navigate or edit presentations using the toolbar. They must use keyboard shortcuts (which are undiscoverable).

---

## Technical Details

### Frontend Implementation

**File**: `/components/presentation-viewer.tsx`

**postMessage Target Origin**:
```typescript
const VIEWER_ORIGIN = 'https://web-production-f0d13.up.railway.app'

function sendCommand(
  iframe: HTMLIFrameElement | null,
  action: string,
  params?: Record<string, any>
): Promise<any> {
  return new Promise((resolve, reject) => {
    // ... validation and handler setup ...

    // Send postMessage to iframe
    iframe.contentWindow?.postMessage({ action, params }, VIEWER_ORIGIN)
  })
}
```

**Commands Being Sent**:
- `nextSlide` - Navigate to next slide
- `prevSlide` - Navigate to previous slide
- `toggleOverview` - Toggle grid view
- `toggleEditMode` - Toggle edit mode
- `saveAllChanges` - Save edits
- `cancelEdits` - Cancel edits
- `getCurrentSlideInfo` - Get current slide number and total (polling)

### Backend Validation (Needs Update)

**Expected Location**: Viewer postMessage event handler in presentation-viewer.html or similar

**Current Validation Logic** (based on docs):
```javascript
// Pseudocode - actual implementation location unknown
window.addEventListener('message', (event) => {
  const allowedOrigins = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https:\/\/.*\.up\.railway\.app$/,
    /^https:\/\/.*\.vercel\.app$/,
    /^https:\/\/.*\.netlify\.app$/
  ];

  // ❌ www.deckster.xyz doesn't match any pattern
  if (!allowedOrigins.some(pattern => pattern.test(event.origin))) {
    console.warn(`⚠️ Rejected postMessage from unauthorized origin: ${event.origin}`);
    return; // Reject message
  }

  // ... process command ...
});
```

**Needed Update**:
```javascript
const allowedOrigins = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/.*\.up\.railway\.app$/,
  /^https:\/\/.*\.vercel\.app$/,
  /^https:\/\/.*\.netlify\.app$/,
  /^https:\/\/(www\.)?deckster\.xyz$/  // ← ADD THIS LINE
];
```

---

## Domains to Whitelist

Please add both of these origins to the allowed list:

1. `https://www.deckster.xyz` (primary production domain)
2. `https://deckster.xyz` (alternate without www)

**Regex Pattern**:
```javascript
/^https:\/\/(www\.)?deckster\.xyz$/
```

This pattern allows both `www.deckster.xyz` and `deckster.xyz`.

---

## Testing Instructions

### Before Fix (Current State)

1. Visit: https://www.deckster.xyz/builder
2. Create a presentation (wait for strawman)
3. Open browser DevTools → Console
4. Click "Next" button
5. **Observe**:
   - Console shows: `🔘 Next button clicked!`
   - Console shows: `⚠️ Rejected postMessage from unauthorized origin: https://www.deckster.xyz`
   - After 5 seconds: `Error navigating to next slide: Error: Command timeout`
   - Slide does NOT advance

### After Fix (Expected Behavior)

1. Visit: https://www.deckster.xyz/builder
2. Create a presentation (wait for strawman)
3. Open browser DevTools → Console
4. Click "Next" button
5. **Observe**:
   - Console shows: `🔘 Next button clicked!`
   - Console shows: `📨 postMessage received: nextSlide` (from iframe)
   - Console shows: `➡️ Next slide`
   - Slide advances to slide 2
   - Slide counter updates: "Slide 2 / 7"

### Verification Checklist

After whitelisting the domains, verify these features work:

- [ ] Prev button navigates to previous slide
- [ ] Next button navigates to next slide
- [ ] Grid button toggles overview mode
- [ ] Edit button enables edit mode
- [ ] Save button (in edit mode) saves changes
- [ ] Cancel button (in edit mode) discards changes
- [ ] Slide counter shows "Slide X / Y" (correct total)
- [ ] Slide info polling succeeds: `📊 Slide info: 1 / 7`
- [ ] No console errors about rejected postMessages
- [ ] Button disabled states are correct

---

## Timeline

**Reported**: 2025-11-24
**Priority**: HIGH - Blocking production feature
**Impact**: 100% of toolbar navigation/editing features non-functional in production

**Estimated Fix Time**: 5 minutes (add 2 lines to origin whitelist)

---

## Related Documentation

**Frontend Integration**:
- `/Users/pk1980/Documents/Software/deckster-frontend/components/presentation-viewer.tsx`
- `/Users/pk1980/Documents/Software/deckster-frontend/docs/POSTMESSAGE_MIGRATION_COMPLETE.md`

**Backend Documentation**:
- `/Users/pk1980/Documents/Software/deckster-backend/deckster-w-content-strategist/agents/layout_builder_main/v7.5-main/docs/FRONTEND_CORS_RESPONSE.md` (lines 220-230)
- `/Users/pk1980/Documents/Software/deckster-backend/deckster-w-content-strategist/agents/layout_builder_main/v7.5-main/docs/FRONTEND_INTEGRATION_GUIDE.md`

---

## Contact

**Frontend Team**:
- Repository: https://github.com/Pramod-Potti-Krishnan/deckster.xyz-v2.0
- Production URL: https://www.deckster.xyz
- Issue: Toolbar buttons non-functional due to origin rejection

**Request**: Please add `www.deckster.xyz` and `deckster.xyz` to the postMessage origin whitelist in the v7.5-main viewer.

---

## Appendix: Full Console Log Sample

```
presentation-viewer.tsx:244 🎯 Button states - currentSlide: 1, totalSlides: 0
presentation-viewer.tsx:245    Prev disabled: true
presentation-viewer.tsx:246    Next disabled: false

[User clicks Edit button]
presentation-viewer.tsx:182 🔘 Edit button clicked!
a7b78d1d-809e-46d5-830f-f39864cbd1bc:286 ⚠️ Rejected postMessage from unauthorized origin: https://www.deckster.xyz
presentation-viewer.tsx:138 ⏸️ Polling failed (iframe not ready)

[5 seconds later]
presentation-viewer.tsx:60 Error toggling edit mode: Error: Command timeout

[User clicks Next button]
presentation-viewer.tsx:85 🔘 Next button clicked!
a7b78d1d-809e-46d5-830f-f39864cbd1bc:286 ⚠️ Rejected postMessage from unauthorized origin: https://www.deckster.xyz
presentation-viewer.tsx:138 ⏸️ Polling failed (iframe not ready)

[5 seconds later]
presentation-viewer.tsx:60 Error navigating to next slide: Error: Command timeout

[User clicks Grid button]
presentation-viewer.tsx:113 🔘 Grid button clicked!
a7b78d1d-809e-46d5-830f-f39864cbd1bc:286 ⚠️ Rejected postMessage from unauthorized origin: https://www.deckster.xyz
presentation-viewer.tsx:138 ⏸️ Polling failed (iframe not ready)

[5 seconds later]
presentation-viewer.tsx:60 Error toggling overview: Error: Command timeout
```

**Pattern**: Every button click is detected correctly, postMessage is sent, but rejected by the iframe due to origin mismatch, causing a 5-second timeout.

---

**Thank you for your assistance with this issue!**
