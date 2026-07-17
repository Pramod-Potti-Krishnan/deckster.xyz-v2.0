# Text box semantic-role contract

The Builder gets the active slide's valid roles and accessory slots from Layout via:

```text
getTemplateSlotCatalog { slideIndex }
```

The response owns `canvas_type` and `slots[]`. Each supported slot may include
`semantic_role`, `slot_name`, `kind` (`body`, `structural`, `system`, or
`accessory`), `accessory_type`, geometry, typography, and single-instance/system-managed
flags. The frontend must not duplicate template definitions. If the catalog is unavailable,
only the backward-compatible Auto/Body Text option is shown.

Text Labs generation sends `semantic_role`, `slot_name`, `slot_kind`,
`accessory_type`, and `geometry_mode`. `AUTO` is the default. In Auto, the frontend omits
character limits, item counts, typography sizes, line height, and padding. `MANUAL` sends only
fields explicitly set by the user inside `manual_geometry_overrides`:

```text
items_per_box, title_min_chars, title_max_chars, item_min_chars, item_max_chars,
heading_font_size_px, content_font_size_px, line_height, padding_px,
bullet_gap_px, max_lines, max_chars
```

Text Labs responses may return `resolved_geometry`, `platinum_profile`, and
`citations_used`. The Builder preserves these diagnostics and sends role/citation-bearing
text through Layout's atomic `upsertSemanticElement` command. Layout owns structural slot
geometry, single-instance replacement, citation numbering, source-registry persistence, and
Sources rebuilding.

The Layout refine event must include `semanticRole`, `slotName`, `slotKind`,
`accessoryType`, and `citationsUsed` (snake_case aliases are accepted). Regenerate opens refine
mode directly and preselects the persisted slot; there is no Regenerate toggle.
