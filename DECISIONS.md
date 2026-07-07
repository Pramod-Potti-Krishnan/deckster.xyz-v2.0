# Add Element Program Decisions

## E1 Frontend Stub

- `refineElementRequested` is accepted from the Layout viewer, but built-element refinement remains a guarded no-op until R0 adds `mode: 'refine'` and the context assembler. Blank placeholders route to the existing first-time generation flow via `openPanelForElement`, which keeps E1 typecheckable without referencing R0-only modules.
- `saveStatusChanged` is handled alongside the older `save_status` event so the builder's existing save indicator updates from the Layout E0/E1 autosave bridge without removing legacy compatibility.
