# FoldLens submission checklist

Deadline: July 22, 2026 at 09:00 JST.

## Repository

- [ ] Choose and add a project license.
- [ ] Re-authenticate GitHub CLI: `gh auth login -h github.com`.
- [ ] Initialize this directory as its own repository.
- [ ] Commit and push to a GitHub repository.
- [ ] Make the repository public, or share a private repository with `testing@devpost.com` and `build-week-event@openai.com`.
- [ ] Confirm `.env.local`, `node_modules`, and `dist` are not committed.

## Verification

- [ ] Use Node.js 22.12 or later.
- [ ] Run `npm ci` from a clean checkout.
- [ ] Run `npm run verify`.
- [ ] Check the welcome, sample, PAE selection, model switch, Ask FoldLens, evidence action, import dialog, export, and mobile flows.
- [ ] Confirm there are no relevant browser console errors.

## Deployment

- [ ] Create a Render Blueprint from `render.yaml`.
- [ ] Add `OPENAI_API_KEY` as a secret.
- [ ] Set an OpenAI project budget and usage alert.
- [ ] Confirm `/api/health` reports live analysis.
- [ ] Submit one live GPT-5.6 question and verify the byline, evidence, and action.
- [ ] Keep the deployment free and available through the judging period ending August 5, 2026.

## Submission assets

- [ ] Capture a clean project thumbnail and 2–4 screenshots.
- [ ] Record an English, public YouTube demo shorter than three minutes.
- [ ] Include audio explaining both Codex and GPT-5.6 usage.
- [ ] Do not use unlicensed music, logos, or third-party footage.
- [ ] Copy and tailor `devpost-copy.md`.
- [ ] Obtain the main Codex task’s `/feedback` Session ID.
- [ ] Select **Work & Productivity**.
- [ ] Add the GitHub, public demo, and YouTube URLs.
- [ ] Submit early enough to reopen and verify the final Devpost entry.
