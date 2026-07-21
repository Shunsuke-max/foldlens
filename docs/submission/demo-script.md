# FoldLens hackathon video — final script

- Target runtime: **2:40–2:45**
- Language: **English**
- Format: screen recording with voice-over, 1280×720, browser zoom at 100%

Core story: **FoldLens takes a scientific question back to the exact evidence that should be inspected next.**

## 0:00–0:12 — Cold open: answer to evidence

**Screen**

- Begin on the completed Ask FoldLens answer for `Is the A–B interface reliable?`
- Keep the `GPT-5.6` source label, Evidence section, and Caveat visible.
- Click **Show interface**. Let the interface highlight appear in the 3D viewer and PAE workspace.

**Narration**

> Can we trust this predicted interface? FoldLens does not just give us an answer. It connects every interpretation back to the structure, confidence, and exact PAE evidence we should inspect next.

**On-screen text**

> From question to evidence

## 0:12–0:30 — The problem

**Screen**

- Cut to the welcome screen.
- Briefly show an AlphaFold 3 result folder or ZIP beside the browser.
- Return focus to FoldLens.

**Narration**

> An AlphaFold 3 job gives researchers structures, summary confidence, full predicted aligned error, and several prediction samples. Reviewing them still means moving between files, a molecular viewer, and separate plots, making it easy to lose the model or residue context behind a conclusion.

**On-screen text**

> Structure + confidence + PAE + interpretation

## 0:30–0:45 — Open the sample honestly

**Screen**

- Click **Explore sample result**.
- Pause briefly on the sample-data label as the workspace opens.

**Narration**

> FoldLens brings that review loop into one workspace. For a reproducible walkthrough, this demo uses one experimental PDB structure with five illustrative confidence variants—not five independently predicted coordinate models.

**On-screen text**

> Demo data: one experimental structure · illustrative confidence variants

## 0:45–1:02 — Local-first import

**Screen**

- Open **Open result**.
- Show the supported ZIP, folder, CIF, and JSON inputs and the validated manifest.
- Close the dialog and return to the workspace.

**Narration**

> FoldLens can open an AlphaFold 3 ZIP, output folder, CIF, or matching confidence files. Parsing happens in the browser, so raw structures, atomic coordinates, and sequences are not uploaded to the FoldLens server.

**On-screen text**

> Parsed locally in the browser

## 1:02–1:25 — One evidence-linked workspace

**Screen**

- Rotate the 3D structure slightly.
- Switch once between chain and confidence coloring.
- Select the A-aligned-to-B PAE region.
- Hold on the amber residue highlight and reciprocal median PAE value.

**Narration**

> Here, the active prediction stays attached to its ranking score, ipTM, pTM, clash status, and full PAE matrix. When I select the A-to-B region in the heatmap, FoldLens maps that selection back to the corresponding chains and residue range in 3D.

**On-screen text**

> PAE selection ↔ chains and residue ranges

## 1:25–1:58 — Grounded GPT-5.6 analysis

**Screen**

- Open **Ask FoldLens**.
- Enter `Is the A–B interface reliable?`
- Submit the question.
- Show the live loading state briefly, then the completed answer.
- Keep the source label, evidence rows, caveat, and action buttons visible.

**Narration**

> Now I will ask, “Is the A–B interface reliable?” FoldLens first derives a compact, deterministic fact set from the active model and current selection. GPT-5.6 receives only those facts and my question—not the raw scientific files. The response separates interface confidence from experimental validation and cites the metrics and residue ranges behind its conclusion.

**On-screen text**

> Question + deterministic facts → GPT-5.6

## 1:58–2:15 — Act on the cited evidence

**Screen**

- Click **Show interface**.
- Then click **Show B 43–58**.
- Hold on the linked 3D highlight and PAE selection.

**Narration**

> These are not arbitrary chatbot links. Structured output validation and a semantic allowlist restrict every action to chains and residue bounds that exist in the active result. One click takes me from the explanation back to the evidence.

**On-screen text**

> Validated actions · active evidence only

## 2:15–2:27 — Preserve model context

**Screen**

- Switch to illustrative variant 2 or enable its comparison overlay.
- Show the changed confidence metrics while keeping the sample-data label visible.

**Narration**

> Switching variants keeps the interpretation tied to the correct confidence context. Because this demo reuses one coordinate structure, the comparison is about illustrative confidence values—not structural differences.

## 2:27–2:39 — Codex collaboration and human decisions

**Screen**

- Cut quickly between the test suite, parser or PAE code, and one clean mobile view.
- Return to the main workspace before the final line.

**Narration**

> Codex helped build and test the file matcher, PAE interactions, responsive interface, and grounded assistant. I made the core decisions: keep raw data local, bound AI actions to active evidence, and state scientific limitations clearly.

**On-screen text**

> Built with Codex · Powered by GPT-5.6

## 2:39–2:45 — Close

**Screen**

- Show the full FoldLens workspace.
- Fade to the FoldLens logo, public demo URL, and GitHub URL.

**Narration**

> FoldLens shortens the path from an AlphaFold result folder to the next evidence-backed inspection.

**End card**

```text
FoldLens
Evidence-linked AlphaFold 3 review
foldlens.vercel.app
github.com/Shunsuke-max/foldlens
```

## Recording notes

- Record the public deployment with live GPT-5.6 analysis enabled.
- Before recording, reload the sample so the question and AI answer are not already present.
- Record the full interaction first; edit only after preserving a clean live take.
- If the API response takes longer than the target runtime allows, show about two seconds of the genuine loading state, then make a clean cut to the completed live response.
- Keep the cursor still whenever the viewer is not being manipulated.
- Do not zoom far enough to hide the sample-data label, GPT-5.6 source label, Evidence section, or Caveat.
- Do not describe the bundled sample as five predicted structures or imply that confidence is experimental validation.
- Use no music, or only music with explicit reuse rights. Keep narration intelligible above any background audio.
