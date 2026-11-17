# PRD: NotaryPrepPro

> Working name. The owner plans to rename it later. The app header currently says "NotaryPrep" and the page title "Notary Exam Prep"; aligning them is a small UI task to do once the final name is chosen.

## Problem

People applying to become a notary public need to learn their state's notary law and, in some states, pass a timed exam. Free material is scattered (state handbooks, flashcard decks) and rarely explains why each wrong answer is wrong.

## Who it is for

- **Primary user:** new notary applicants in Texas, New York, California and Florida.
- Renewing notaries and training companies are not target users for v1.
- How many there are, where they come from and how they find the app: **UNKNOWN: ask the owner**.

Note on states: New York and California give a state exam. Texas and Florida do not; for them the mock exam is a self-check on the same law (the app says so on screen).

## What version 1 must do

1. Let a learner choose a state (TX, NY, CA, FL) without signing in.
2. **Topic practice:** pick one or more topics and 10/20/30/50 questions. After each answer, show whether it was right, a summary explanation, the legal source, and a short "why this is right/wrong" note for every option.
3. **Timed mock exam:** questions drawn in proportion to each topic, a server-enforced timer, auto-submit at 0:00, flag-for-review, and no feedback until submit. Format per state: TX 50 q / 60 min, NY 40 q / 60 min, CA 45 q / 60 min, FL 40 q / 60 min; 70% to pass.
4. **Results:** score, pass/fail, per-topic breakdown, full answer review with per-option explanations, PDF export and history (per browser).
5. **Question bank:** at least 150 questions per state with easy, medium and hard questions (at least 15% of each), every option explained, every question cited.
6. Randomize question selection and answer order on every test, and never send the answer key to the browser before it is earned.
7. Rate-limit the API so one client can't overload it.
8. **Planned: admin screen.** One admin can sign in and add, edit or retire questions, topics and state settings in the database, and export the bank as JSON for backup and review.
9. **Planned: usage page (admin only).** Unique browsers, tests started, mocks completed and pass rate per state, by day, week and month, counted from the anonymous browser IDs. These are estimates: one person on two devices counts twice.
10. **Planned:** store sessions and results in the database (MySQL in production) instead of JSON files, so they survive redeploys.

Example of done: a learner can open the site, pick New York and start a 10-question practice in under 3 clicks.

## What version 1 must NOT do

- No native mobile apps (App Store / Play Store). The web app works on phones.
- No states beyond TX, NY, CA and FL.
- No payments, paywall or pricing. v1 is free.
- No learner accounts or sign-in. Add email sign-in later together with payments.
- No legal advice. Every page carries the "study aid only, not legal advice" disclaimer.
- No third-party analytics or ad trackers. **Default chosen, please confirm.**

## Success in the first 3 months

- Target: **30–50 per month.** The owner gave the number but not the unit; this doc assumes **unique learners (browsers) per month**. **Default chosen, please confirm.**
- Measured on the planned admin usage page.

## Open items

- Who reviews each state's questions for legal accuracy before launch: **UNKNOWN: ask the owner**. Until then, treat the bank as unreviewed.
- Support contact, privacy policy and terms of use: **UNKNOWN: ask the owner**.
- Final product name: **UNKNOWN: ask the owner**.
