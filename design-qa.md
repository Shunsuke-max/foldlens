# FoldLens Scientific Discussion — Design QA

Source visual truth: `docs/audit-2026-07-22-hackathon/05-ai-evidence-action-desktop.png`

Implementation screenshots:

- `docs/design/foldlens-scientific-discussion-qa-desktop.png`
- `docs/design/foldlens-scientific-discussion-desktop.png`
- `docs/design/foldlens-scientific-discussion-mobile.png`

Viewports: 1440 × 810 desktop; 390 × 844 mobile.

State: Illustrative variant 1. The matched desktop comparison uses Interface Q–S and the PAE selection `S 612–626 scored on S 612–626`, with a completed live discussion turn. The mobile capture uses the same prediction with a completed discussion turn.

## Full-view comparison evidence

- The app shell, prediction rail, structure viewer, confidence strip, PAE panel, dark surfaces, cyan/lime/amber semantic colors, borders, radii, and density remain aligned with the source visual and the current FoldLens layout tokens.
- The source’s one-shot Ask FoldLens panel is intentionally replaced by a scientific-discussion hierarchy: live structure context, user question, conclusion, observed evidence, alternative interpretation, falsification condition, limitations, and follow-up questions.
- The inspector uses the current 376 px desktop grid track rather than the wider track in the older source capture. The conversation scroll preserves access to all sections without changing the surrounding workspace or hiding the composer.
- The 390 px layout has no horizontal overflow. The panel and sticky composer both resolve exactly from 0 to 390 px, and the composer remains at the viewport bottom.

## Focused region comparison evidence

Focused crops:

- `docs/design/foldlens-scientific-discussion-source-panel.jpg`
- `docs/design/foldlens-scientific-discussion-rendered-panel.jpg`

The full-resolution panel comparison confirms that metric typography remains monospaced, values retain the same hierarchy, evidence rows retain the existing table treatment, cyan focus accents are preserved, and the added context/conclusion layers use existing tokens rather than introducing a new visual language.

## Required fidelity surfaces

- Fonts and typography: Existing UI and monospace stacks are preserved. The scientific labels use the established small uppercase treatment; conclusions use the existing 14–17 px answer hierarchy with readable line height and wrapping.
- Spacing and layout rhythm: Existing 6–8 px radii, 8–16 px spacing increments, panel borders, composer height, and compact evidence rows are retained. Conversation sections scroll within the inspector on desktop and flow naturally on mobile.
- Colors and visual tokens: Existing background, line, cyan, lime, amber, muted, and text tokens are reused. Alternative and falsification cards use subtle token-derived borders with sufficient contrast.
- Image quality and asset fidelity: No source imagery or visual assets were replaced. The real 3D canvas, PAE canvas, brand mark, and existing icon system remain intact.
- Copy and content: Labels clearly separate conclusion, observed evidence, alternative interpretation, evidence that would change the conclusion, and limitations. Confidence is consistently distinguished from experimental validation.

## Interaction and accessibility verification

- Tested sample launch, initial question, live GPT-5.6 planning response, multi-turn follow-up, Japanese question/response, Evidence-to-interface action, Evidence-to-residue action, PAE/3D synchronization, cancel state, and local fallback compatibility.
- Verified prediction changes discard stale responses; selection changes update context without deleting the discussion; older incompatible API payloads are normalized safely.
- Desktop and mobile DOM expose tab, textbox, button, region, status, and article semantics. Keyboard submit supports Enter, while Shift+Enter remains available for a line break.
- Browser console was checked. A historical missing-field crash found during the first pass was fixed with schema normalization. The only remaining messages are the in-app browser’s Vite development WebSocket warnings; no current application runtime error was observed after the fix.

## Comparison history

1. P1 — The first implementation scrolled the untouched baseline panel to the bottom, hiding its conclusion. Fixed by keeping the initial state at scroll position zero and auto-scrolling only after a discussion begins. Post-fix evidence: `docs/design/foldlens-scientific-discussion-desktop.png`.
2. P2 — The first implementation exposed two identical “Show interface” quick actions because ipTM and PAE referenced the same viewer action. Fixed by deduplicating quick actions by action type, producing “Show interface” and “Show S 612–626”. Post-fix evidence: final browser interaction check and `docs/design/foldlens-scientific-discussion-mobile.png`.
3. P1 — A legacy live response without the new scientific fields could crash the response card. Fixed by schema-valid normalization with deterministic fallbacks; the compatibility path is covered by component tests and rechecked in the browser.

## Findings

No actionable P0, P1, or P2 visual or interaction findings remain.

## Follow-up polish

- P3: The desktop context chips intentionally truncate long residue labels at the current narrow inspector width; the complete value remains available as the title and in linked PAE labels.
- P3: Development-only Vite WebSocket warnings appear in the in-app browser, while the production build completes successfully.

## Implementation checklist

- [x] Preserve FoldLens visual language and measured-evidence cards.
- [x] Add structure context and multi-turn discussion.
- [x] Add alternative interpretation and falsification condition.
- [x] Keep every viewer action deterministically grounded.
- [x] Verify desktop, 390 px mobile, Japanese discussion, fallback, and accessibility semantics.
- [x] Pass tests, typecheck, production build, and visual comparison.

final result: passed
