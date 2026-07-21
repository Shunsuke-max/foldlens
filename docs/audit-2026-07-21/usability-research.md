# FoldLens usability research and UX audit

Date: 2026-07-21  
Audience: experimental biologists, structural biologists, students, and first-time AlphaFold 3 users  
Time horizon: Build Week MVP first, then a research-grade workspace  
Scope: importing AF3 outputs, understanding a prediction, comparing samples, asking a grounded question, exporting a result, mobile use, and visible accessibility risks

## Executive read

FoldLens already has a strong visual shell and its most valuable interaction is real: a PAE selection changes the 3D structure and produces an exact residue-range label. The largest remaining problems are not cosmetic. They are confidence provenance, import correctness, and turning a set of views into a guided scientific decision flow. The current AI fallback can display the user's new question while returning a generic interface answer; in that state the product looks more certain and responsive than it really is. The current parser also misses parts of the modern AF3 output contract, including Zstandard-compressed outputs and `contact_probs`, labels all imported entities as proteins, and would treat the top-level copy of the best prediction as another sample. The best near-term direction is therefore a “confidence brief” with honest provenance, robust import diagnostics, task-oriented presets, and a real two-model comparison view. A broad viewer feature race is less valuable than making the main conclusion reproducible and hard to misread.

## Evidence captured in this run

1. `01-structure-overview.png` — default responsive structure view.
2. `02-pae-mobile.png` — PAE view before a selection.
3. `03-pae-selection-mobile-full.png` — PAE rectangle linked to the 3D highlight.
4. `04-insights-mobile.png` — evidence-backed assistant layout.
5. `05-ai-fallback-mobile.png` — custom question with deterministic fallback.
6. `06-desktop-workspace-fresh.png` — fresh 1440 × 900 workspace.
7. `07-open-result-dialog.png` — local result import dialog.
8. `08-mobile-390-overview.png` — 390 × 844 responsive view.

## Flow health

| Step | User task | Health | Evidence |
|---|---|---:|---|
| 1 | Understand the loaded result at a glance | Good foundation | 08 |
| 2 | Open and read PAE | Mixed | 02 |
| 3 | Select uncertainty and find it in 3D | Good | 03 |
| 4 | Ask for an interpretation | Mixed | 04 |
| 5 | Recover when live AI is unavailable | Poor | 05 |
| 6 | Use all major evidence on desktop | Good foundation | 06 |
| 7 | Compare prediction samples | Poor | 06 + browser observation |
| 8 | Import a new AF3 result | Mixed | 07 |

## Strengths

- The desktop workspace keeps the model list, 3D structure, evidence, and PAE visible together.
- PAE click/drag selection produces an exact residue-range label and changes the 3D highlight.
- The assistant exposes deterministic evidence as clickable actions instead of hiding the basis of the answer.
- The product clearly states that files stay on the device and that confidence is not experimental validation.
- The 390 px layout had no horizontal overflow in this run.
- Visible buttons met the WCAG 2.2 minimum target size in the measured mobile state; the app also has visible focus CSS and reduced-motion CSS.

## Ranked problems

### 1. The offline AI state can imply that a question was answered when it was not

- Severity: critical
- Frequency signal: high in the current environment because the live request is quota-blocked
- Confidence: high; observed directly and confirmed in code
- What breaks: after asking “Which region should I avoid interpreting?”, the UI repeats that question but returns the same interface-level headline used for the default question.
- Cause: the deterministic response generator does not receive or classify the question. On any API failure, the panel substitutes that generic preview.
- Product move: never present the fallback as an answer to an arbitrary question. Either support a bounded deterministic intent set, or show “Live explanation unavailable” followed by a neutral confidence brief. Label every answer with the selected sample and exact metric provenance.

### 2. Import compatibility and data identity are not yet reliable enough for research use

- Severity: critical
- Frequency signal: medium-to-high for local AF3 outputs; low for the current demo
- Confidence: high; official AF3 output contract plus parser inspection
- What breaks:
  - AF3 v3.0.2 can Zstandard-compress mmCIF and confidence JSON, but FoldLens filters those files out before it can warn about them.
  - The official local output contains the best prediction at the root and the same sample in its seed/sample directory. FoldLens currently maps every CIF to a prediction, so the top model can appear twice.
  - All imported chains are labelled as proteins, even when the result contains RNA, DNA, glycans, ions, or ligands.
  - More than 12 predictions are silently truncated.
  - ZIP extraction inflates the entire archive before irrelevant NPZ files are filtered. Official optional distogram and embedding files can be multi-gigabyte for large inputs.
- Product move: add a pre-import manifest and validation screen, support or clearly reject `.zst`, de-duplicate the top-level best copy, parse entity types and sample/seed IDs, disclose skipped files, and move ZIP/JSON work to a worker with size limits and selective extraction.

### 3. “Models” is a switcher, not a comparison workflow

- Severity: high
- Frequency signal: high; AF3 returns five samples by default
- Confidence: high
- What breaks: the user can change Model 1 to Model 2, but cannot see where the models agree, where interfaces move, or which model wins for a specific chain pair.
- Product move:
  - Add `Rank by: overall / chain pair / chain / ligand`.
  - Let the user pin two models and superpose them.
  - Show per-residue pLDDT deltas and RMSD/coordinate disagreement.
  - Show interface consistency across samples, not just the top score.
  - Explain that overall `ranking_score` is not the correct ranking for every entity or interaction.

### 4. Mobile hides the core import action behind a dead menu and a long scroll

- Severity: high
- Frequency signal: high on mobile
- Confidence: high; observed and confirmed in code
- What breaks: the header hides Open and Export below 820 px. The visible “More options” button has no action. “Open another result” appears only after the viewer, scores, tabs, and current tab content.
- Product move: make the overflow menu functional and put `Open result` first. On first launch, show a real empty state with `Open AF3 result` and `Explore demo`, rather than dropping users directly into an illustrative result.

### 5. PAE linking works, but PAE comprehension is incomplete

- Severity: high for novices, medium for experts
- Frequency signal: high
- Confidence: high
- What breaks: the heatmap lacks a live residue-pair/value tooltip, a visible Y axis, a simple explanation of asymmetry, and a keyboard alternative. The info icon is decorative. The canvas is not focusable (`tabIndex=-1`) and exposes no equivalent data table or range controls.
- Product move: add hover/crosshair details, both axes, chain-pair presets, “aligned on Y / error at X” copy, a clear-selection action, and an accessible chain-pair table/range form. Use a colorblind-safe palette and combine color with values or outlines.

### 6. The current export is not the promised research memo

- Severity: medium-high
- Frequency signal: medium
- Confidence: high; code inspection
- What breaks: Export downloads only job name, source, selected prediction, summary metrics, and notices. It omits the current PAE selection, highlighted residues, chain visibility, question/answer/evidence, viewer image, camera, sample/seed identity, and file provenance.
- Product move: offer two exports:
  1. a resumable local FoldLens session; and
  2. a human-readable HTML/PDF confidence report with structure image, PAE crop, evidence table, caveats, provenance, and a file hash.

### 7. Core AF3 evidence is left unused

- Severity: medium-high
- Frequency signal: high for complexes and ligand work
- Confidence: high
- What breaks: the official confidence JSON includes `contact_probs`, atom-level pLDDT, per-chain pTM/ipTM, and disorder information. FoldLens currently parses only a subset. It shows `has_clash` as a boolean but cannot locate clashes.
- Product move: add deterministic “contact / pocket / clash” views. For a selected ligand or chain pair, list likely contacts, map them to 3D, and distinguish confidence from physical validation. Compute and show clash locations locally.

### 8. Metric hierarchy and terminology remain expert-first

- Severity: medium
- Frequency signal: high for new users
- Confidence: medium-high
- What breaks: Ranking, pTM, ipTM, and PAE appear without definitions, scope labels, or thresholds. Global ipTM and chain-pair ipTM can differ, but both are shown as “ipTM”, which can look inconsistent.
- Product move: label scope explicitly (`Global ipTM`, `Q–S chain-pair ipTM`), add one-line “what this tells you / what it does not” popovers, and offer task presets instead of requiring users to know which metric applies.

### 9. Dialog and complex-view accessibility need implementation testing

- Severity: medium
- Frequency signal: lower, but blocks keyboard and assistive-technology users
- Confidence: high for Escape and canvas; medium for full focus behavior
- What breaks: Escape did not close the import dialog, and the component has no focus-management or focus-trap logic. The PAE canvas is pointer-only. The 3D view has an accessible name but no text equivalent for the selected state.
- Product move: focus the dialog on open, trap focus, close on Escape, restore focus, announce loading/errors/toasts, expose toolbar state with `aria-pressed`, and provide text/table equivalents for visual evidence.

## Competitive pattern map

| Pattern | Evidence | Implication for FoldLens |
|---|---|---|
| PAE hover, PAE-domain coloring, chain dividers, plot-to-3D selection | ChimeraX AlphaFold tool | Add hover details, PAE-domain presets, and clearer bidirectional selection |
| Linked sequence, PAE, 3D, chain/interface overlays, colorblind-safe palette | PAE Viewer paper | Add a sequence track and consistent selection across all three views |
| Side-by-side pLDDT comparison, multiple ranking metrics, clash locations in PAE and 3D | ABCFold paper | Build a real compare mode and local clash localization |
| Model-confidence summary, sequence, presets, domains, annotations, multiple interface metrics | AlphaFold DB 2025–2026 interface | Guide users by task and let them layer annotations without leaving the page |
| Selection, measurements, ligand neighborhood, sequence, superposition, snapshots | RCSB Mol* documentation | Keep 3D exploration bounded for MVP, but plan measurements and comparison; reassess Mol* after Build Week |

## Opportunity map

### Fix this week

1. Make the mobile overflow menu work and put Open first.
2. Replace the misleading generic fallback with an honest offline confidence brief.
3. Label demo/sample data prominently.
4. Add import manifest validation, de-duplication, entity typing, skipped-file warnings, and an explicit `.zst` error.
5. Add PAE hover values, both axes, scoped metric labels, and chain-pair quick actions.
6. Add dialog Escape/focus handling and `aria-live` for import/AI/toast states.
7. Change Export to a useful HTML confidence report plus session JSON.

### Fix this quarter

1. Two-model superposition and consensus/difference view.
2. Rank models by overall score, selected chain pair, selected chain, or ligand.
3. Sequence/pLDDT track linked to PAE and 3D.
4. Contact-probability, ligand-neighborhood, distance, and clash overlays.
5. Custom residue annotations processed locally.
6. Streaming/worker-based import for large multi-seed outputs.

### Needs deeper research

1. AlphaFold Server handoff or extension integration, including terms, CORS, and UI-change resilience.
2. Optional Boltz/Chai import and cross-predictor comparison.
3. Experimental restraints, crosslinks, and PDB superposition.
4. Share links versus standalone local HTML for private research data.
5. Short usability sessions with three groups: first-time wet-lab users, experienced structural biologists, and high-throughput computational users.

## Recommended Build Week cut

The strongest three-minute demo is:

1. Drop a real AF3 ZIP.
2. See an import confidence manifest: 5 samples, 3 proteins, 1 ligand, all evidence matched.
3. Receive a one-screen confidence brief with explicit “supported / uncertain / inspect” sections.
4. Click the uncertain interface and see PAE, sequence, and 3D move together.
5. Pin Model 1 and Model 2 and show where the interface changes.
6. Export a reproducible local HTML report.

This is more defensible than adding a larger free-form chat surface. The chat remains valuable when every answer is scoped to the selected sample, current region, and a deterministic evidence bundle.

## Source map

- Google DeepMind, AlphaFold 3 output documentation: output tree, sample/seed behavior, metric definitions, `contact_probs`, and large optional arrays. https://github.com/google-deepmind/alphafold3/blob/main/docs/output.md
- Google DeepMind, AlphaFold 3 v3.0.2 release: Zstandard-compressed output support. https://github.com/google-deepmind/alphafold3/releases/tag/v3.0.2
- UCSF ChimeraX AlphaFold tool: PAE hover, plot/structure linking, domain coloring, and chain dividers. https://www.rbvi.ucsf.edu/chimerax/docs/user/tools/alphafold.html
- PAE Viewer paper: integrated sequence/PAE/3D interaction, chain/interface overlays, colorblind-safe palette, and privacy-preserving client-side processing. https://academic.oup.com/nar/article/51/W1/W404/7151339
- ABCFold paper: comparative model output, side-by-side pLDDT, multiple ranking signals, and clash localization. https://academic.oup.com/bioinformaticsadvances/article/5/1/vbaf153/8176613
- AlphaFold Database and EMBL-EBI training: model-confidence layout, interface metrics, domains, annotations, and linked presets. https://alphafold.ebi.ac.uk/faq/ and https://www.ebi.ac.uk/training/online/courses/navigating-alphafold-database/understanding-the-structure-prediction-page/summary-and-model-confidence-tab/
- RCSB PDB Mol* documentation: sequence-linked selection, measurements, ligand neighborhoods, comparison, and image capture. https://www2.rcsb.org/docs/exploring-a-3d-structure/structure-3d-visualization
- W3C WAI: target-size minimum and text alternatives for complex graphics. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html and https://www.w3.org/WAI/tutorials/images/complex/

## Evidence limits

- This was an expert inspection and source-grounded audit, not a moderated usability study with working scientists.
- The demo uses illustrative confidence values and one reused structure, so it cannot validate scientific correctness across real multi-seed outputs.
- Visual review and DOM inspection cannot establish full WCAG conformance. Screen-reader, keyboard-only, zoom, high-contrast, and multiple-browser testing are still required.
- Public discussion evidence was sparse and anecdotal, so recommendations rely primarily on direct product behavior, official output contracts, peer-reviewed tools, and current authoritative product documentation.
