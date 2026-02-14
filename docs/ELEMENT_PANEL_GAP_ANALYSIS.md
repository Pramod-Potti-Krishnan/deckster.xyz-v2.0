# Element Panel Gap Analysis

Backend Reference vs Frontend Implementation — per-element checklist.

- `[x]` = already correct in frontend
- `[ ]` = needs work

---

## Cross-Cutting (All Forms)

- [ ] Z-Index input missing from ALL 9 forms (range 1-200, per-type defaults)
- [ ] Position Presets: Calculated size display missing (`{W*60}x{H*60} px`)
- [ ] Padding Control: Missing axis mode (uniform | axis | individual)

---

## TEXT_BOX

### Section Structure
- [ ] Regroup into 5 sections: Instances | Box Design | Heading | Content | Positioning

### Parameters
- [x] Prompt
- [x] Content Source (ai/placeholder)
- [ ] Count (1-6) — move into Section 1: Instances
- [ ] Layout — add `grid` option; show Grid Columns dropdown when layout=grid
- [ ] Grid Columns — MISSING: new dropdown, visible when layout=grid
- [ ] Items/Box — move from top-level into Section 4: Content
- [ ] Background — remove `white` option (only `colored` / `transparent`)
- [ ] Box Color / color_variant — MISSING: add color swatch (disabled when bg=transparent)
- [x] Shadow
- [x] Corners
- [x] Border
- [x] Theme (light/dark)
- [ ] Show Title — move into Section 3: Heading
- [ ] Title Style — remove `bold-line` (only `plain` / `underline`)
- [ ] Title Char Limits (min/max) — MISSING: add auto-calculated inputs in Section 3
- [ ] Heading Align — move into Section 3
- [ ] Heading Font overrides — move into Section 3
- [ ] Heading Indent — MISSING: number input 0-5 in Section 3
- [ ] List Style — change `dashes`->remove, `none`->`plain`. Values: bullets/numbered/plain
- [ ] Content Align — move into Section 4
- [ ] Content Font overrides — move into Section 4
- [ ] Content Indent — MISSING: number input 0-5 in Section 4
- [ ] Line Spacing — MISSING: dropdown (auto, 1.0-2.5) in Section 4
- [ ] Item Char Limits (min/max) — MISSING: add auto-calculated inputs in Section 4
- [ ] Position: Quick Preset — VERIFY 9 presets present
- [ ] Position: Calculated Size — MISSING
- [ ] Padding — MISSING: add padding section with uniform/axis/individual modes
- [ ] Z-Index — MISSING (default 50)
- [ ] recalcTextBoxLimits() — MISSING: implement full 10-step computed logic

---

## METRICS

### Section Structure
- [ ] Regroup into 6 sections: Instances | Card Design | Value | Label | Description | Positioning

### Parameters
- [x] Prompt
- [x] Content Source
- [ ] Count, Layout — move into Section 1
- [ ] Corners, Border, Alignment — move into Section 2
- [ ] Color Scheme — remove `outline` (values: gradient/solid/accent)
- [ ] Card Color / color_variant — MISSING: add color swatch in Section 2
- [ ] Value char limits + font — regroup into Section 3: Value
- [ ] Label char limits + font — regroup into Section 4: Label
- [ ] Description char limits + font — regroup into Section 5: Description
- [x] Position: Quick Preset (9 presets via PositionPresets component)
- [ ] Calculated Size — MISSING
- [ ] Z-Index — MISSING (default 90)

---

## TABLE

### Section Structure
- [ ] Regroup into 3 sections: Structure | Styling | Positioning

### Parameters
- [x] Prompt
- [x] Content Source
- [ ] Columns, Rows, Count — move into Section 1: Structure
- [ ] Column Balance — change values: `descriptive`/`data` (remove `equal`)
- [ ] Column Widths — MISSING: per-column number inputs, auto-distributed
- [ ] First/Last Col Bold, Total Row — move into Section 1
- [ ] Header Style — change values: `solid`/`minimal`/`accent` (remove `gradient`/`outline`)
- [ ] Stripe Rows, Corners, Alignment, Border Style — move into Section 2
- [x] Header Color
- [ ] Header/Cell char limits + font — regroup into Section 2 as sub-sections
- [ ] Layout toggle — REMOVE (backend has no layout toggle for TABLE)
- [ ] Position, Padding, Z-Index — move into Section 3
- [ ] Calculated Size — MISSING
- [ ] Z-Index — MISSING (default 50)
- [ ] _rebuildColumnWidthInputs() — MISSING: column width distribution algorithm

---

## CHART

- [ ] Chart types — remove `treemap` (keep 14 types)
- [ ] Multi-series types — remove `radar` from multi-series list (only: area_stacked, bar_grouped, bar_stacked)
- [ ] Calculated Size — MISSING
- [ ] Z-Index — MISSING (default 50)
- [x] Quick Preset (9 presets via PositionPresets)
- [x] No padding

---

## IMAGE

- [ ] Image styles — remove: minimalist, photographic, cinematic, artistic. Add: pixel_art, sketch, oil_painting, pop_art
- [ ] Quality — change from toggle buttons to dropdown
- [ ] Corners — remove `pill` (only `rounded`/`square`)
- [ ] Aspect ratio centering logic — MISSING: scale-to-fit + centering (maxWidth=28, maxHeight=14)
- [x] Position preset (via aspect ratio presets)
- [ ] Calculated Size + Aspect Ratio display — PARTIAL: has pixel dims, add GCD-based aspect ratio display
- [ ] Z-Index — MISSING (default 75)

---

## INFOGRAPHIC

- [ ] Instance count — hide count (backend hides it for INFOGRAPHIC)
- [ ] Aspect ratio — add `9:16` option
- [ ] Segments — range should be 1-8 (currently 3-8, missing 1, 2)
- [ ] Crop mode — value `full`->`rectangle`
- [ ] Position preset — MISSING: add 9-preset dropdown
- [ ] Calculated Size + Aspect display — MISSING
- [ ] Z-Index — MISSING (default 50)
- [x] No padding

---

## ICON_LABEL

- [ ] Size — remove `xs` (only `small`/`medium`/`large`)
- [ ] Style (icon mode) — replace all 6 options with: `circle`/`square`/`rounded`/`minimal`
- [ ] Z-Index — MISSING (default 90)
- [x] No position, no padding

---

## SHAPE

- [ ] Shape types — reduce from 25+ to 8: circle, rectangle, triangle, star, diamond, arrow, polygon, custom
- [ ] Stroke width max — change 0-10 to 0-20
- [ ] Rotation max — change 0-360 to 0-359
- [ ] Position model — switch from grid-based (Col/Row/W/H) to pixel-based (X/Y/W/H in px)
- [ ] Grid Size display — MISSING: show derived grid `grid: {W_grid}x{H_grid}`
- [ ] Pixel<->Grid sync — MISSING: implement bidirectional conversion
- [ ] Z-Index — MISSING (default 10)
- [x] Padding (backend says SHAPE has padding state)

---

## DIAGRAM (all 8 subtypes)

- [ ] KANBAN column range — change 3-6 to 2-6 (add option 2)
- [ ] CHEVRON stages range — change 3-7 to 3-8 (add option 8)
- [ ] CLOUD provider — remove `generic` (only aws/gcp/azure)
- [ ] Z-Index — MISSING (default 50) for all subtypes
- [x] No padding, no position inputs
