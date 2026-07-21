# FoldLens fidelity ledger

## QA setup

- Accepted desktop concept: `foldlens-desktop-concept.png` (1584×992)
- Desktop implementation capture: `foldlens-desktop-implementation.png` at a 1440×900 browser viewport
- Accepted mobile concept: `foldlens-mobile-concept.png` (849×1848)
- Mobile implementation capture: `foldlens-mobile-implementation-viewport.png` at a 430×932 browser viewport
- Verification: Codex in-app browser, DOM snapshots, interaction checks, browser screenshots, and direct `view_image` inspection of both concept and implementation

## Comparison points

| Area | Concept evidence | Render evidence | Resolution |
| --- | --- | --- | --- |
| Information architecture | 280px prediction rail, central molecule canvas, narrow inspector, bottom PAE rail | The same four-region hierarchy is visible at 1440×900 | Matched; desktop remains a single no-scroll analysis workspace |
| Palette and surfaces | Blue-black background, graphite rails, cyan/lime accents, thin separators, almost no shadow | Render uses `#06111a`/`#07131d`, cyan/lime scores, 1px borders, and separator-led depth | Matched |
| Typography and chrome | Compact scientific controls, tabular scores, clear region headings | Scores, controls, sidebars, tables, axes, and mobile tabs all have explicit size/weight/line-height | Matched; no browser-default control typography remains |
| Molecular focal point | Large blue/lime complex centered in the uninterrupted viewer | Real PDB 4HLA renders interactively in blue/lime chain colors with rotation and zoom | Functionally and visually matched; the compact HIV-1 protease dimer keeps its bound ligand legible |
| Prediction controls | Five model rows with Model 1 selected and 0.92/0.89/0.84/0.81/0.76 scores | Identical row count, labels, values, selected rail, and hover/selection treatment | Matched |
| Confidence summary | Ranking, ipTM, pTM, and clash state in one compact strip | Identical metrics and values, with tabular numerals and semantic colors | Matched |
| PAE analysis | Chain bands, scientific heatmap, Å legend, linked selection outline | Responsive canvas heatmap, chain boundaries, legend, and PAE-to-3D chain highlighting all work | Matched; MVP highlights the chain rather than exact residue rectangle |
| Inspector | Interpretation, chain visibility, and chain-pair matrix | All three modules render and update from parsed AF3 summary JSON | Matched; demo uses PDB auth chain IDs A/B plus the bound `017` ligand |
| Mobile hierarchy | Viewer first, score row, four tabs, readable interpretation and chain controls | 430×932 has the same order, 44px controls, sticky tabs, and zero horizontal overflow | Matched; content scrolls vertically to retain readable type rather than compressing all rows into one viewport |
| Core states | Loaded result, selected model, color mode, chain visibility, PAE selection | Model 2 updates the ranking to 0.89, chain A can be toggled, and PAE selections link back to the structure | Matched and interactive |

## Above-the-fold copy diff

All allowed first-viewport copy is present and ordered consistently: `FoldLens`, the job name, local-only status, `Open result`, `Export`, `Predictions`, viewer controls, confidence metrics, `Interpretation`, and `Predicted aligned error`.

Intentional differences:

- `Chains` is selected initially for the bundled experimental PDB demo. Selecting `Confidence` applies true pLDDT thresholds, but starting in that mode would misrepresent experimental B-factors as AF3 confidence.
- Demo chains use the source structure’s A/B IDs and represent darunavir as ligand code `017`; imported AF3 results use their own `chain_ids` and ligand identifiers.
- The compact controls omit decorative dropdown chevrons because every visible control is a direct action in this MVP.

## Material fixes made during QA

- Increased and then bounded viewer zoom independently for desktop and mobile so the molecule stays prominent without clipping.
- Switched the demo from misleading confidence coloring to truthful chain coloring.
- Reduced the demo PAE range so its heatmap matches the low-error, blue/cyan scientific treatment in the concept.
- Verified and prevented horizontal overflow at 1440×900 and 430×932.
- Replaced the unreliable full-page WebGL capture with the native 430×932 viewport capture for visual comparison.

No unintended material mismatches remain. The implementation is faithful to the accepted design system and core composition, with the documented scientific-data differences preserved intentionally.
