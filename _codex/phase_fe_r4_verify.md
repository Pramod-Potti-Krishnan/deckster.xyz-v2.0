# FE-R-4 Verification

- Async refine requests use the shared `withAsyncSlideComposeFields(...)` helper after `endpoint` is set from `isRefineMode ? '/api/slides/refine' : '/api/slides/compose'` in `components/slide-generation-panel/index.tsx`. The helper in `lib/slide-compose-async.ts` always adds `async: true` and `assume_on_missing: true`.
- Sync refine requests reuse the same panel branch as compose: they post to the same `endpoint` variable, add `assume_on_missing: false`, and then handle `isNeedsInputResponse(data)` before `isBuiltResponse(data)`. No new refinement-specific re-prompt UI was added.
