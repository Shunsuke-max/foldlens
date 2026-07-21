# FoldLens submission checklist

Deadline: July 22, 2026 at 09:00 JST.

## Repository

- [x] Choose and add a project license.
- [ ] Re-authenticate GitHub CLI: `gh auth login -h github.com`.
- [x] Initialize this directory as its own repository.
- [x] Commit and push to a GitHub repository.
- [x] Make the repository public, or share a private repository with `testing@devpost.com` and `build-week-event@openai.com`.
- [x] Confirm `.env.local`, `node_modules`, and `dist` are not committed.

## Verification

- [x] Use Node.js 22.12 or later.
- [x] Run `npm ci` from a clean checkout.
- [x] Run `npm run verify`.
- [x] Check the welcome, sample, PAE selection, model switch, Ask FoldLens, evidence action, import dialog, export, and mobile flows.
- [x] Confirm there are no relevant browser console errors.

## Deployment

- [ ] Create a Render Blueprint from `render.yaml`.
- [ ] Add `OPENAI_API_KEY` as a secret.
- [ ] Set an OpenAI project budget and usage alert.
- [x] Confirm `/api/health` reports live analysis.
- [x] Submit one live GPT-5.6 question and verify the byline, evidence, and action.
- [ ] Keep the deployment available through judging ending August 7 and preferably the August 12 winner announcement.

## Submission assets

- [x] Capture a clean project thumbnail and 2–4 screenshots.
- [ ] Record an English, public YouTube demo shorter than three minutes.
- [ ] Include audio explaining both Codex and GPT-5.6 usage.
- [ ] Do not use unlicensed music, logos, or third-party footage.
- [x] Copy and tailor `devpost-copy.md`.
- [ ] Obtain the main Codex task’s `/feedback` Session ID.
- [x] Select **Work & Productivity**.
- [ ] Add the GitHub (`https://github.com/Shunsuke-max/foldlens`), public demo (`https://foldlens.vercel.app/`), and pending YouTube URL.
- [ ] Submit early enough to reopen and verify the final Devpost entry.
