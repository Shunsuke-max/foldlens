# FoldLens — Devpost submission copy

## Project title

FoldLens

## Tagline

Review AlphaFold 3 structures, confidence, PAE, and grounded GPT-5.6 evidence in one private workspace.

## Category

Work & Productivity

## Short description

FoldLens is a local-first review workspace for AlphaFold 3 results. It matches structures with confidence files, connects PAE selections to the 3D viewer, compares models, and uses GPT-5.6 to produce concise interpretations grounded only in visible metrics and residue ranges.

## Inspiration

AlphaFold 3 produces rich outputs, but reviewing them still involves switching between a download folder, molecular viewer, summary JSON, and separate PAE plot. The scientific challenge is not only displaying those files—it is keeping each interpretation tied to the correct model, chain pair, residue range, and caveat.

## What it does

FoldLens opens an AlphaFold 3 ZIP, result folder, structure, or confidence JSON directly in the browser. It automatically matches prediction samples, renders the structure, compares ranking score, ipTM, pTM, and clashes, and links PAE selections to chains and residue ranges in 3D.

Ask FoldLens turns the current view into a compact deterministic fact set. GPT-5.6 receives only those facts and returns a schema-validated answer with evidence actions such as Show interface or Show residues. Raw CIF/JSON files, coordinates, and sequences are not uploaded. If live analysis is unavailable, the same UI falls back to a deterministic local confidence brief and labels it clearly.

## How we built it

FoldLens uses React, TypeScript, Vite, Express, 3Dmol.js, fflate, Zod, and the OpenAI Responses API. Parsing and visualization run locally in the browser. The Express endpoint keeps the API key server-side, validates request size and shape, rate-limits the public demo, and uses Zod Structured Outputs for the GPT-5.6 response.

## How we used Codex and GPT-5.6

Codex was our iterative engineering and design partner. It helped turn usability audits into working flows, implement and test the AlphaFold file matcher and PAE interactions, compare generated design concepts with the rendered product, and expand regression coverage around scientific edge cases.

We used GPT-5.6 inside FoldLens as a constrained interpretation layer. It cannot inspect arbitrary hidden data or invent viewer actions: it receives only deterministic facts already derived by the app, and its schema-validated evidence must point to supplied chains and residue ranges.

The human decisions were to keep source files local, make every AI claim traceable to visible evidence, label illustrative sample values explicitly, and state where confidence stops short of experimental validation.

## Challenges

- Matching several AlphaFold naming layouts without mixing samples or top-level copies.
- Mapping PAE token indices back to chain and residue ranges consistently.
- Preserving responsive 3D and heatmap interactions on mobile.
- Making an AI explanation useful without allowing unsupported biological claims.
- Building an honest sample from an experimental PDB structure and clearly illustrative confidence values.

## Accomplishments

- A polished local-first workflow from import to evidence-linked interpretation.
- Strict separation between raw scientific files, deterministic facts, and GPT-5.6 output.
- Explicit offline fallback instead of hiding API failure.
- 34 automated tests covering parsing, analysis, exports, core UI, rate limiting, and safe API fallback behavior.
- Desktop and mobile layouts with the same scientific review loop.

## What we learned

In scientific tools, the highest-value AI behavior is often not generating more conclusions. It is compressing the path from a question to the exact evidence and caveat that should be inspected next.

## What's next

- Exact residue-rectangle synchronization between the PAE map and 3D structure.
- Native `.zst` decompression.
- Side-by-side structural alignment metrics across prediction samples.
- Shareable review annotations that remain separate from source result files.
- Additional evidence adapters for experimentally validated annotations.

## Testing instructions

1. Open the public demo URL.
2. Choose **Explore sample result**.
3. Switch between prediction models and color modes.
4. Select a region in the PAE heatmap and confirm the related structure evidence updates.
5. Open **Ask FoldLens**, submit the suggested interface question, and use an evidence action.
6. Use **Open result** to inspect the supported file manifest. No account is required.

## Important limitations

FoldLens interprets confidence outputs; it does not perform structure prediction, docking, screening, clinical analysis, or experimental validation. AlphaFold Server output remains subject to its own terms.
