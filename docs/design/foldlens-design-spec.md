# FoldLens design specification

## Product surface

FoldLens is a local-first AlphaFold 3 result workspace. The loaded-result state is the primary product surface: predictions on the left, structure in the center, interpretation on the right, and linked PAE analysis below. Mobile collapses these regions into Structure, PAE, Models, and Insights tabs.

## Design tokens

- Background: `#06111a` (blue-black, not pure black)
- Raised surface: `#0a1620`
- Active surface: `#0c2940`
- Divider: `rgba(148, 171, 190, 0.22)`
- Primary text: `#f1f5f7`
- Secondary text: `#9cabb8`
- Cyan: `#42bdf5`
- Lime: `#a9d94a`
- Violet ligand: `#aa73df`
- Error: `#f27d69`
- Radius: 8px controls, 12px functional panels only
- Shadows: almost none; use separators and background shifts

## Typography

- Humanist system sans serif, with tabular numerals for scores.
- Job title 16px/650, region headings 13px/650, body 13px/1.45, controls 13px/600, metrics 21px/700.
- UI chrome is deliberately specified and must not fall back to browser-default sizing.

## Desktop layout

- Quiet 68px header.
- Main workbench columns: 280px / minmax(520px, 1fr) / 340px.
- The molecule canvas is uninterrupted; its score strip floats in the top-left and its tools run along the top.
- PAE spans the full width below the main workspace.

## Mobile layout

- Single column with compact header, dominant molecule viewer, horizontal score strip, four task tabs, then selected content.
- Sidebars must not be compressed into columns.
- Controls use a minimum 44px touch target.

## Component inventory

- Brand mark and quiet app header
- Primary/secondary outline buttons and consistent 1.5px outline icons
- Prediction list rows with selected and hover states
- Viewer toolbar, molecule canvas, and score strip
- Interpretation prose, chain visibility rows, chain-pair confidence matrix
- PAE heatmap canvas with linked selection
- File-open dialog and drag/drop state
- Mobile task tabs

## Allowed first-viewport copy

`FoldLens`, `KRAS · SOS1 complex`, `Private · processed on this device`, `Open result`, `Export`, `Predictions`, `Confidence`, `Chains`, `Surface`, `Reset view`, `Ranking`, `ipTM`, `pTM`, `Clashes`, `Interpretation`, `Predicted aligned error`.

## Motion

- 160ms hover and selected transitions.
- 220ms dialog/drag overlay entrance.
- Molecule rotation and zoom come from the viewer; reduced-motion disables nonessential UI animation.

## Source concepts

- `foldlens-desktop-concept.png` — desktop layout and visual system
- `foldlens-mobile-concept.png` — responsive hierarchy and touch model
