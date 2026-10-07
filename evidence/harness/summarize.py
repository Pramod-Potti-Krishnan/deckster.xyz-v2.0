"""Print the J2 before/flags-off/after comparison from evidence/results (1440x900 runs)."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'results'
load = lambda d, sc, label: json.loads((root / d / f'{sc}-{label}.json').read_text())
rows = {'before': 'before', 'flags-off': 'flags-off', 'after': 'after'}

print('F4 count: samples where footer total != rail heading, after one Add (52 samples, 150 ms apart)')
for d, label in rows.items():
    r = load(d, 'count', label)
    print(f"  {d:10s} mismatched {r['mismatch_samples']:2d}/{len(r['samples'])}  last at {r['last_mismatch_t']} s  final {r['final']}  dom {r['dom_before']['sha256_16']}" if d != 'after' else
          f"  {d:10s} mismatched {r['mismatch_samples']:2d}/{len(r['samples'])}  last at {r['last_mismatch_t']} s  final {r['final']}")
print('F5 panel: distinct iframe sizes while the Slide panel opens (910x512 -> 510x287)')
for d, label in rows.items():
    r = load(d, 'panel', label)
    print(f"  {d:10s} distinct {r['iframe_sizes_during_open']['distinct']:2d}  final iframe {r['open']['iframe']}  remounted {not r['iframe_same_element_after_open']}  dom {r['dom_open']['sha256_16']}")
print('F7 generate (edit mode on, anchor slide 3, deck 8 -> 9): Generate button travel and where the viewer lands')
for d, label in rows.items():
    r = load(d, 'generate', label)
    print(f"  {d:10s} button y travel {r['submit_y_range_px']:4.0f} px  landed {r['final']['iframe_counter']} ({r['final']['iframe_slide'][:24]})  footer {r['final']['footer']}  dom {r['dom_empty']['sha256_16']}")
