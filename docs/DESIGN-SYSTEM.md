# Design System

Direction A, "trusted study tool": calm and credible, like a licensing-exam product. Deep navy, a seal-gold accent, serif headings and citations kept in plain view. Follow this file; don't "make it look good" ad hoc. Tokens live in `frontend/src/style.css` (`:root`, with dark values under `prefers-color-scheme: dark`). Components come from PrimeVue 4 (Aura preset with the navy primary scale in `frontend/src/main.js`; dark mode follows the device via `darkModeSelector: 'system'`).

## Colors

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #f6f7fa | #0d1322 | Page background |
| `--card` | #ffffff | #141c31 | Cards, inputs |
| `--card-2` | #f3f5f9 | #1a243e | Inset panels (exam at a glance, explanations) |
| `--ink` | #1b2233 | #e6eaf4 | Body text and headings |
| `--muted` | #576074 | #9ea8c0 | Secondary text, option explanations |
| `--line` | #e1e5ee | #26304a | Borders and dividers |
| `--brand` | #1d3a8a | #8fa8ff | Primary actions, selection, progress |
| `--brand-soft` / `--brand-ink` | #eef1f8 / #1d3a8a | #1d2a4d / #c3d0ff | Selected states, tags |
| `--header` | #13203f | #0a1020 | Top bar (with a 2px gold rule) |
| `--gold` / `--gold-ink` | #b58a2a / #85651a | #e0bd6a / #e0bd6a | Seal, eyebrow labels, citation lines, active nav underline |
| `--ok` / `--ok-bg` | #2f7a4f / #f0f7f2 | #82d3a4 / #12271c | Correct, pass, "easy" |
| `--bad` / `--bad-bg` | #a33a3a / #fbf1f1 | #f29b9b / #2d1718 | Incorrect, fail, "hard" |
| `--flag` | #a15c07 | #f2b34b | Flagged for review |

Right and wrong always come with an icon or a text label, never color alone. Gold is an accent only (seal, labels, citation rule), never a background.

## Type and shape

- Headings: Source Serif 4 (`--font-display`, 500–700). Body: Public Sans (400–700). Both self-hosted in `frontend/public/fonts/` with their OFL licences; Georgia and system-ui are the fallbacks.
- Scale: hero 2–2.9rem serif, page titles 1.7–2.2rem serif, question text 1.55rem serif, body 1rem/1.6, small 0.875rem.
- Shape: `--radius` 10px cards, `--radius-sm` 8px options and inputs, 4px tags and pills, 6px buttons. Shadows are hairline only.
- Layout: `.container` max 1120px with a 16px side gutter; cards 28px padding (20px under 760px); grids collapse to one column under 760px.

## Components

- Header: full-width navy bar, gold seal mark, serif wordmark, nav links with a gold underline for the active page.
- Landing hero: serif headline and a gold eyebrow with the state and question count, a primary button plus a text link, and an "exam at a glance" panel with the mock format, the official source and the learner's readiness.
- Answer options: `.option` with a square letter badge, the answer, then a `.why` line once revealed. States `.selected`, `.correct`, `.wrong`.
- Explanations: `.explain` with a gold left rule and the legal citation in gold underneath. Never hide citations.
- Readiness ring (`ReadinessRing.vue`) only from the learner's own results; an empty state otherwise.

## Words on screen

- Plain, calm and exact; second person. Lead with credibility ("cited to California law").
- Buttons say what they do: "Start a 10-question round", "Review & submit", "Export PDF".
- Texas and Florida never say "pass your exam"; say "notary commission" and explain the mock is a self-check.
- Keep the "Study aid only, not legal advice" footer and each state's disclaimer. US spelling.

## Accessibility

WCAG 2.1 AA in both themes: visible focus rings, `role="radiogroup"` on options, `aria-live` feedback, keyboard shortcuts in the quiz, 44px touch targets, `prefers-reduced-motion` respected (clips don't autoplay).
