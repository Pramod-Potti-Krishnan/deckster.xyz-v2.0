# Code Archive Plan - V2.0 Frontend Optimization

**Date**: 2025-10-13
**Status**: PLANNING
**Goal**: Archive unused code from v1 implementation to optimize the v2.0 frontend

---

## Executive Summary

After implementing Director v2.0 with the streamlined 25/75 split interface, significant portions of the v1 codebase are no longer in use. This plan identifies code to archive while preserving:
- Current working functionality (Director v2.0 integration)
- Future-use pages (billing, pricing, help, etc.)
- Core infrastructure (auth, UI components)

**Estimated Impact**:
- ~45+ component files to archive
- ~8 hook files to archive/replace
- ~15+ library files to archive
- ~3 test pages to archive
- Reduced bundle size and improved build times

---

## Currently Active Code (KEEP)

### Core Pages
- ✅ `app/page.tsx` - Landing page
- ✅ `app/builder/page.tsx` - Main builder (Director v2.0)
- ✅ `app/layout.tsx` - Root layout
- ✅ `app/auth/signin/page.tsx` - Sign in
- ✅ `app/auth/signup/page.tsx` - Sign up
- ✅ `app/onboarding/page.tsx` - Onboarding flow
- ⚠️ `app/dashboard/page.tsx` - Keep for future
- ⚠️ `app/profile/page.tsx` - Keep for future
- ⚠️ `app/settings/account/page.tsx` - Keep for future
- ⚠️ `app/billing/page.tsx` - Keep for future
- ⚠️ `app/pricing/page.tsx` - Keep for future
- ⚠️ `app/help/page.tsx` - Keep for future
- ⚠️ `app/shortcuts/page.tsx` - Keep for future

### Active Components
- ✅ `components/error-boundary.tsx` - WebSocket error boundary
- ✅ `components/user-profile-menu.tsx` - User menu
- ✅ `components/onboarding-modal.tsx` - Onboarding modal
- ✅ `components/theme-provider.tsx` - Theme support
- ✅ `components/providers/session-provider.tsx` - Session management
- ✅ `components/ui/*` - All shadcn/ui components (KEEP ALL)

### Active Hooks
- ✅ `hooks/use-auth.ts` - Authentication
- ✅ `hooks/use-deckster-websocket-v2.ts` - NEW WebSocket for Director v2.0
- ✅ `hooks/use-toast.ts` - Toast notifications
- ✅ `hooks/use-mobile.tsx` - Mobile detection

### Active Libraries
- ✅ `lib/auth-helper.ts` - Auth utilities
- ✅ `lib/auth-options.ts` - NextAuth config
- ✅ `lib/config.ts` - App configuration
- ✅ `lib/utils.ts` - General utilities

### Active APIs
- ✅ `app/api/auth/[...nextauth]/route.ts` - NextAuth
- ⚠️ `app/api/dev/mock-token/route.ts` - Dev utilities (keep for now)
- ⚠️ `app/api/test-env/route.ts` - Dev utilities (keep for now)

---

## Code to Archive

### 1. Old Builder Implementation

#### Pages
- ❌ `app/builder/page-old.tsx` - Old builder page
- ❌ `app/test-connection/page.tsx` - Connection testing page
- ❌ `app/test-auth/page.tsx` - Auth testing page
- ❌ `app/api-test/page.tsx` - API testing page

**Reason**: Replaced by new streamlined builder with Director v2.0

---

### 2. Old WebSocket Implementation

#### Hooks
- ❌ `hooks/use-deckster-websocket.ts` - OLD WebSocket (replaced by v2)
- ❌ `hooks/use-connection-status.ts` - OLD connection status (depends on old WebSocket)

#### Libraries
- ❌ `lib/websocket-client.ts` - OLD WebSocket client
- ❌ `lib/websocket-service.ts` - OLD WebSocket service
- ❌ `lib/types/websocket-types.ts` - OLD WebSocket types
- ❌ `lib/types/vibe-decker-api.ts` - OLD API types

**Reason**: Superseded by `use-deckster-websocket-v2.ts` and Director v2.0 protocol

**⚠️ NOTE**: `components/connection-error.tsx` currently uses `use-connection-status.ts`.
**ACTION REQUIRED**: Either simplify ConnectionError or create ConnectionErrorV2

---

### 3. Old Multi-Pane Interface Components

The old builder had a complex multi-pane interface with live editing, agent visualization, etc. All replaced by simpler 25/75 chat/presentation split.

#### Slide Components
- ❌ `components/slide-editor.tsx` - Inline slide editing
- ❌ `components/slide-display.tsx` - Slide display component
- ❌ `components/slide-element.tsx` - Individual slide elements
- ❌ `components/slide-metadata.tsx` - Slide metadata panel
- ❌ `components/slide-meta-content.tsx` - Metadata content

#### Chat Components
- ❌ `components/chat-message.tsx` - OLD chat message (now inline in builder)
- ❌ `components/enhanced-chat-input.tsx` - Enhanced chat input
- ❌ `components/conversation-flow.tsx` - Conversation flow visualizer
- ❌ `components/attachment-panel.tsx` - File attachments

#### Editor Components
- ❌ `components/contextual-toolbar.tsx` - Context toolbar
- ❌ `components/editable-text.tsx` - Inline text editing
- ❌ `components/visual-suggestions.tsx` - Visual suggestion panel

#### UI Flow Components
- ❌ `components/narrative-purpose.tsx` - Narrative input
- ❌ `components/engagement-hook.tsx` - Engagement hook input
- ❌ `components/question-response.tsx` - Q&A component

#### Sidebar Components
- ❌ `components/project-sidebar.tsx` - Project sidebar
- ❌ `components/enhanced-project-sidebar.tsx` - Enhanced sidebar
- ❌ `components/version-history.tsx` - Version history panel

#### Debug/Test Components
- ❌ `components/debug-panel.tsx` - Debug panel
- ❌ `components/connection-debug.tsx` - Connection debugger
- ❌ `components/conversation-debug.tsx` - Conversation debugger
- ❌ `components/progress-tracker.tsx` - OLD progress tracker
- ❌ `components/waiting-indicator.tsx` - Waiting indicator
- ❌ `components/vibe-decker-test.tsx` - OLD test component
- ❌ `components/simple-api-test.tsx` - API test component
- ❌ `components/api-test-generator.tsx` - API test generator

#### Settings Components
- ⚠️ `components/settings-dialog.tsx` - Keep if used by settings page
- ⚠️ `components/share-dialog.tsx` - Keep if used by share feature

**Reason**: New builder uses simple chat interface + iframe presentation display. No inline editing, no agent visualization, no complex sidebars.

---

### 4. Old Backend Integration Layer

These files were part of the compatibility layer for the old backend API.

- ❌ `lib/migration/compatibility-layer.ts` - Backend compatibility
- ❌ `lib/agent-mapper.ts` - Agent message mapping
- ❌ `lib/data-transformer.ts` - Data transformation
- ❌ `lib/presentation-reducer.ts` - Presentation state reducer
- ❌ `lib/slide-asset-loader.ts` - Slide asset loading
- ❌ `lib/types/director-messages.ts` - OLD director types

**Reason**: Director v2.0 uses streamlined protocol defined in `use-deckster-websocket-v2.ts`

---

### 5. Old Optimistic Updates & File Upload

- ❌ `hooks/use-file-upload.ts` - File upload hook
- ❌ `hooks/use-optimistic-updates.ts` - Optimistic UI updates
- ❌ `lib/optimistic-updates.ts` - Optimistic update utilities
- ❌ `lib/file-upload-service.ts` - File upload service
- ❌ `lib/update-cache.ts` - Cache updates
- ❌ `components/file-uploader.tsx` - File uploader component

**Reason**: Not used in v2.0 simplified interface. Director v2.0 handles everything via text chat.

---

### 6. Old Utilities

- ❌ `lib/debug-utils.ts` - Debug utilities (if only used by archived components)
- ❌ `lib/error-handler.ts` - Error handler (if only used by archived components)
- ❌ `lib/feature-flags.ts` - Feature flags (if not actively used)
- ❌ `lib/jwt-generator.ts` - JWT generation (if not actively used)
- ❌ `lib/token-manager.ts` - Token management (if not actively used)
- ⚠️ `app/api/proxy/token/route.ts` - Check if still needed
- ⚠️ `app/api/proxy/ws-info/route.ts` - Check if still needed

**Reason**: May be unused or superseded by simpler auth flow

---

## Archive Structure

```
v2.0/
├── archive/
│   ├── ARCHIVE_README.md           # This document
│   ├── v1-builder/                 # Old builder implementation
│   │   ├── pages/
│   │   │   ├── page-old.tsx
│   │   │   ├── test-connection/
│   │   │   ├── test-auth/
│   │   │   └── api-test/
│   │   ├── components/
│   │   │   ├── slide-editor.tsx
│   │   │   ├── conversation-flow.tsx
│   │   │   ├── [40+ components]
│   │   └── hooks/
│   │       ├── use-deckster-websocket.ts
│   │       └── use-connection-status.ts
│   ├── old-websocket/              # Old WebSocket implementation
│   │   ├── websocket-client.ts
│   │   ├── websocket-service.ts
│   │   └── types/
│   ├── old-backend-layer/          # Old backend compatibility
│   │   ├── compatibility-layer.ts
│   │   ├── agent-mapper.ts
│   │   └── data-transformer.ts
│   ├── file-upload/                # File upload features
│   │   ├── use-file-upload.ts
│   │   ├── file-upload-service.ts
│   │   └── file-uploader.tsx
│   └── utilities/                  # Old utilities
│       ├── debug-utils.ts
│       ├── error-handler.ts
│       └── feature-flags.ts
```

---

## Action Items Before Archiving

### 1. Fix ConnectionError Component
- [ ] Analyze: Does ConnectionError work without use-connection-status?
- [ ] Option A: Simplify ConnectionError to work without hook
- [ ] Option B: Create ConnectionErrorV2 for new builder
- [ ] Option C: Remove ConnectionError from new builder entirely

### 2. Verify No Hidden Dependencies
- [ ] Search for imports of each component to be archived
- [ ] Check if any "keep for future" pages use archived components
- [ ] Verify API routes aren't used by active pages

### 3. Test After Each Archive Batch
- [ ] Archive test pages → Verify builder works
- [ ] Archive old hooks → Verify builder works
- [ ] Archive old components (batch 1: slide components) → Verify
- [ ] Archive old components (batch 2: chat components) → Verify
- [ ] Archive old components (batch 3: sidebar components) → Verify
- [ ] Archive old libraries → Verify

---

## Migration Steps

### Phase 1: Preparation (CURRENT)
1. ✅ Create this plan document
2. [ ] Review with team
3. [ ] Fix ConnectionError dependency issue
4. [ ] Create comprehensive grep checks for each file

### Phase 2: Archive Test Pages
1. [ ] Move `app/test-connection` → `archive/v1-builder/pages/`
2. [ ] Move `app/test-auth` → `archive/v1-builder/pages/`
3. [ ] Move `app/api-test` → `archive/v1-builder/pages/`
4. [ ] Test builder page works

### Phase 3: Archive Old WebSocket
1. [ ] Move `hooks/use-deckster-websocket.ts` → `archive/old-websocket/`
2. [ ] Move `hooks/use-connection-status.ts` → `archive/old-websocket/`
3. [ ] Move `lib/websocket-*.ts` → `archive/old-websocket/`
4. [ ] Move old types → `archive/old-websocket/types/`
5. [ ] Test builder page works

### Phase 4: Archive Components (Batched)
1. [ ] Archive slide components (5 files)
2. [ ] Test builder
3. [ ] Archive chat components (4 files)
4. [ ] Test builder
5. [ ] Archive editor components (3 files)
6. [ ] Test builder
7. [ ] Archive sidebar components (3 files)
8. [ ] Test builder
9. [ ] Archive debug components (8 files)
10. [ ] Test builder
11. [ ] Archive UI flow components (3 files)
12. [ ] Test builder

### Phase 5: Archive Libraries
1. [ ] Archive backend compatibility layer (3 files)
2. [ ] Archive file upload (3 files)
3. [ ] Archive optimistic updates (3 files)
4. [ ] Archive old utilities (check dependencies first)
5. [ ] Test builder

### Phase 6: Documentation
1. [ ] Create ARCHIVE_README.md in archive folder
2. [ ] Document what each archived section did
3. [ ] Document how to restore if needed
4. [ ] Update main README with v2.0 architecture

---

## Risk Assessment

### Low Risk
- Test pages (test-connection, test-auth, api-test)
- Debug components (debug-panel, connection-debug)
- Old builder page (page-old.tsx)

### Medium Risk
- Components potentially used by "future" pages (settings-dialog, share-dialog)
- Utility libraries that might have hidden dependencies
- Old WebSocket (need to verify ConnectionError doesn't break)

### High Risk
- **ConnectionError component** - currently used by builder but depends on old hook
- API routes (proxy/token, proxy/ws-info) - need to verify not used

---

## Rollback Plan

If issues arise after archiving:
1. Each phase is committed separately
2. Can git revert specific commits
3. Archive folder remains in repo for quick restoration
4. All files are git-tracked, not deleted

---

## Expected Benefits

### Developer Experience
- Cleaner codebase, easier to navigate
- Faster file searches
- Clearer separation between v1 and v2
- Less confusion about which components to use

### Performance
- Smaller bundle size
- Faster builds
- Faster hot reload
- Less code to parse/compile

### Maintenance
- Easier to onboard new developers
- Reduced cognitive load
- Clear v2.0 architecture
- Less technical debt

---

## Decision: Proceed?

**Questions for Discussion**:
1. Should we archive everything at once or in phases?
2. Should we keep archived code in git or remove entirely?
3. Do we need to keep compatibility-layer for any reason?
4. Should we fix ConnectionError before or after archiving?

**Recommendation**:
- Proceed with phased approach
- Keep archived code in git under `archive/` folder
- Fix ConnectionError first (simplify it)
- Test thoroughly after each phase
