# FoldLens demo script — target 2:45

Record in English, with the public deployment and live GPT-5.6 analysis enabled. Do not add copyrighted music.

## 0:00–0:20 — Problem

“An AlphaFold 3 job gives researchers structures, summary confidence, full PAE, and several prediction samples—but reviewing them still means switching between files and tools. FoldLens turns that folder into one evidence-linked workspace.”

Show the welcome screen, then select **Explore sample result**. Say explicitly: “This demo uses one experimental PDB structure with five illustrative confidence variants, not five predicted coordinate models.”

## 0:20–0:50 — Local-first import

“FoldLens can open an AlphaFold 3 ZIP, folder, CIF, or matching JSON files. Parsing happens in the browser, so the raw structure, coordinates, and sequences are not uploaded.”

Briefly open the import dialog and show its validated manifest, then return to the sample.

## 0:50–1:25 — One review workspace

“Here I can compare prediction samples and ranking metrics, rotate the structure, switch between chain and confidence coloring, and inspect the PAE map without losing model context.”

Switch models, rotate the structure, and select a PAE region. Show the corresponding highlight or evidence update.

## 1:25–2:05 — Grounded GPT-5.6 analysis

“Ask FoldLens does not send the raw scientific files to an unconstrained chatbot. The app first derives a small deterministic fact set from the active model and selection. GPT-5.6 receives the user’s question plus those facts. Its schema and a second semantic allowlist reject viewer actions that do not match the active chains, residue bounds, and PAE selection.”

Submit: “Is the Q–S interface reliable?” Show the live GPT-5.6 byline, evidence, caveat, and **Show interface** or residue action.

“The answer separates confidence from experimental validation. If the API is unavailable, FoldLens falls back visibly to a deterministic offline brief.”

## 2:05–2:35 — Codex collaboration

“Codex helped build and test the AlphaFold file matcher, PAE interactions, responsive layouts, and evidence-linked assistant. It also helped turn usability audits into the import flow and explicit sample labels. I made the core product decisions: keep raw files local, bound AI actions to active evidence, and prefer honest scientific limitations over unsupported claims.”

Show a quick mobile viewport or the repository tests while narrating.

## 2:35–2:45 — Close

“FoldLens shortens the path from an AlphaFold result folder to the next evidence-backed inspection. It is one local-first workspace for structures, confidence, PAE, and grounded GPT-5.6 analysis.”
