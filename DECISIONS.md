# Add Element Program Decisions

## E1 Frontend Stub

- `refineElementRequested` is accepted from the Layout viewer, but built-element refinement remains a guarded no-op until R0 adds `mode: 'refine'` and the context assembler. Blank placeholders route to the existing first-time generation flow via `openPanelForElement`, which keeps E1 typecheckable without referencing R0-only modules.
- `saveStatusChanged` is handled alongside the older `save_status` event so the builder's existing save indicator updates from the Layout E0/E1 autosave bridge without removing legacy compatibility.

## P3 Text Box And Theme Source

- `TEXT_BOX_HORIZONTAL` remains hidden. The Text Labs producer normalizes `horizontal` to `None` pending PK design approval, so the frontend exposes the approved `classic`, `vertical`, `mixed`, `simple`, and seven structured atom routes only.
- The Add Element theme selector defaults to `Deck theme` when a presentation id is available and to `No theme` otherwise. Saved-profile `Another theme` is hidden behind `NEXT_PUBLIC_ENABLE_ELEMENT_ANOTHER_THEME=true` because frontend source provides concrete hex fields for custom profiles but not for built-in preset ids.
- The frontend sends `presentation_id` on `/api/canvas/session` and every `/api/chat/message`. The current Text Labs session route ignores bodies, so `/api/chat/message` remains the authoritative per-request presentation/theme linkage until Text Labs persists session presentation ids from the session body.
