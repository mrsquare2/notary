# Design System

Direction B, "friendly learning app": bright, rounded and encouraging, with legal citations and the "not legal advice" notice always visible so the trust signals survive. Follow this file; don't "make it look good" ad hoc. Tokens live in `frontend/src/style.css` (`:root`, with dark values under `prefers-color-scheme: dark`). Components come from PrimeVue 4 (Aura preset with the violet primary scale in `frontend/src/main.js`; dark mode follows the device via `darkModeSelector: 'system'`).

## Colors

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #f4f3ff | #12111f | Page background |
| `--card` | #ffffff | #1c1a30 | Cards, header, inputs |
| `--card-2` | #f8f7ff | #23213b | Inset areas, hover fills |
| `--ink` | #1e1b3a | #ecebff | Body text |
| `--muted` | #5d5a7a | #a9a6c8 | Secondary text, option explanations |
| `--line` | #e6e4f5 | #2f2c4b | Borders and dividers |
| `--brand` | #5b4bf5 | #8c7ffa | Primary actions, active nav, progress |
| `--brand-soft` | #ecebff | #2a2650 | Pills, selected states |
| `--brand-ink` | #4338ca | #c4bdff | Text on `--brand-soft` |
| `--ok` / `--ok-bg` | #0f766e / #e6fbf8 | #5eead4 / #10302c | Correct, pass, "easy", "strong topic" |
| `--bad` / `--bad-bg` | #c2410c / #fff1e6 | #fdba74 / #36220f | Incorrect, fail, "hard", "practice this" |
| `--flag` | #b45309 | #fbbf24 | Flagged for review |

Right and wrong use teal and orange (not green and red), and always come with an icon or a text label, never color alone.

## Type and shape

- Font: Plus Jakarta Sans (variable 400–800), self-hosted in `frontend/public/fonts/` (no Google request), with system-ui as the fallback.
- Scale: hero 2.6–3rem/800, page titles 1.9rem/800, section titles 1.2rem/700, body 1rem/1.55, small 0.875rem.
- Radius: `--radius` 20px for cards, `--radius-lg` 28px for hero panels, `--radius-sm` 12px for options and inputs; pills are fully rounded.
- Layout: `.container` max 1120px with a 16px side gutter. Cards (`.surface`) are 28px padding (20px under 760px). Grids collapse to one column under 760px.
- Utilities to reuse: `.row`, `.stack`, `.grid-2`, `.grid-3`, `.muted`, `.small`, `.eyebrow`, `.surface`, `.pill`.

## Components

- Use PrimeVue components (Button, Select, Tag, Message, Toast, ConfirmDialog, ProgressBar, DataTable, Tooltip) before writing custom ones.
- Header: a floating white rounded bar with the brand mark, pill navigation and the state picker.
- Answer options are `.option` buttons with a letter badge, the answer and, once revealed, a `.why` line. States: `.selected`, `.correct`, `.wrong`.
- Difficulty is a `.difficulty` pill: easy (teal), medium (violet), hard (orange).
- Readiness is a ring (`ReadinessRing.vue`) with strong/weak topic pills, built only from the learner's own results; with no results it shows an empty state, never invented numbers.
- Explanations sit in an `.explain` block with the legal source underneath. Never hide citations.

## Words on screen

- Plain, short, encouraging; second person ("Start a 10-question round").
- Buttons say what they do: "Start practice", "Review & submit", "Export PDF".
- Errors say what happened and what to do next.
- Texas and Florida never say "pass your exam": those states have no state exam. Say "prepare for your commission" and explain the mock is a self-check.
- Never promise a pass or imply legal advice. Keep the "Study aid only, not legal advice" footer and each state's disclaimer.
- Option explanations start with "Correct." or "Wrong." followed by the reason. US spelling ("practice", not "practise").

## Accessibility

WCAG 2.1 AA in both themes: visible focus rings, `role="radiogroup"` on options, `aria-live` feedback, keyboard shortcuts in the quiz, 44px touch targets, `prefers-reduced-motion` respected (clips don't autoplay, nothing pulses).
