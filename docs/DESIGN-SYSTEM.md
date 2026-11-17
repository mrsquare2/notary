# Design System

Follow this file; don't "make it look good" ad hoc. Tokens live in `frontend/src/style.css` (`:root`); components come from PrimeVue 4 with the Aura preset (indigo primary) defined in `frontend/src/main.js`.

## Colors

| Token | Value | Use |
|---|---|---|
| `--navy` / `--navy-2` | #1e2a5a / #2a3a7a | Header, brand, PDF headings |
| `--gold` | #f2c14e | Brand accent (logo star) only |
| `--ink` | #1f2937 | Body text |
| `--muted` | #64748b | Secondary text, option explanations, disclaimers |
| `--line` | #e2e8f0 | Borders |
| `--bg` / `--card` | #f6f7fb / #ffffff | Page / card background |
| `--ok` / `--ok-bg` | #15803d / #ecfdf3 | Correct answers, pass, "easy" tag |
| `--bad` / `--bad-bg` | #b91c1c / #fef2f2 | Wrong answers, fail, "hard" tag |
| `--flag` | #b45309 | Flagged-for-review |
| PrimeVue primary | indigo scale | Buttons, selection, focus, progress |

Never use color alone to show right or wrong: pair it with an icon (check/cross) or a text label, as the quiz and results views already do.

Dark mode: not supported in v1 (PrimeVue's `.app-dark` selector is configured but nothing toggles it). **Default chosen, please confirm.**

## Type and spacing

- Font: Inter, falling back to the system UI font. Line-height 1.5; headings 1.2 with slight negative tracking.
- Eyebrow labels: 0.78rem, bold, uppercase, letter-spaced, muted.
- Radius: `--radius` 14px for cards; pills (difficulty tags) are fully rounded.
- Layout: `.container` max 1080px with a 16px side gutter; `.page` padding 28px top, 64px bottom; cards (`.surface`) 24px padding (18px under 760px). Grids collapse to one column under 760px.
- Utilities to reuse: `.row`, `.stack`, `.grid-2`, `.grid-3`, `.muted`, `.small`, `.eyebrow`, `.surface`.

## Components

- Use PrimeVue components (Button, Select, Tag, Message, Toast, ConfirmDialog, ProgressBar, Tooltip) before writing custom ones.
- Answer options are `.option` buttons with a letter badge, the text and, once revealed, a `.why` line in muted small text. States: `.selected`, `.correct`, `.wrong`.
- Difficulty is a `.difficulty` pill next to the topic eyebrow: easy (green), medium (neutral), hard (red).
- Explanations sit in an `.explain` block with a left accent bar and the legal source underneath.
- **Planned:** admin and usage screens reuse the same tokens and PrimeVue components (DataTable for lists). No new UI library.

## Words on screen

- Plain, short, friendly; second person ("You see the answer after every question").
- Buttons say what they do: "Start practice", "Review & submit", "Export PDF", not "Submit" or "OK".
- Errors say what happened and what to do next ("Could not reach the server. Check your connection and try again.").
- Never promise a pass or imply legal advice. Keep the "Study aid only, not legal advice" footer and each state's disclaimer on every page.
- Option explanations start with "Correct." or "Wrong." followed by the reason.

## Accessibility

Target WCAG 2.1 AA. **Default chosen, please confirm.** Keep keyboard shortcuts and `aria-live` feedback in the quiz, visible focus rings, `role="radiogroup"` on options, and enough contrast for muted text on tinted backgrounds.
