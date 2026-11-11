# Bursr design system

Rebuilt on 11 Nov 2026 as a fintech product, from a study of Nigerian fintech apps (Moniepoint, Kuda, Paystack, PiggyVest, Cowrywise, Grey, Brass, OPay): balance first with a hide/show eye, actions beside it, transaction rows (avatar, name, one short line, amount right, status), bottom tabs on phones, one helper line per section, explanations behind "Details". Built in our own components; no branding, scripts or layouts copied.

## Tokens (`app/globals.css`, `@theme`)

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#f5f6f8` | App background |
| `paper-2` | `#eef0f4` | Tiles, table heads |
| `card` | `#ffffff` | Cards, inputs |
| `ink` | `#0b1220` | Text |
| `muted` | `#5b6475` | Secondary text |
| `line` | `#e4e7ec` | Borders |
| `ledger` / `ledger-soft` / `indigo` | `#2f4bdb` / `#eef1fd` / `#2339b5` | Brand blue: actions, links, active nav (hover `indigo`) |
| `ok` / `ok-soft` | `#12a150` / `#e7f6ec` | Done, paid, success |
| `hold` / `hold-soft` | `#b54708` / `#fef0c7` | Waiting, needs a look |
| `refuse` / `refuse-soft` | `#d92d20` / `#fee4e2` | Blocked, failed |
| `night` | `#0b1220` | Balance card |

Three status colours, always with a word.

## Type

Plus Jakarta Sans (headings, balance, `.display`, weight 700–800) and Inter (everything else; `.num` = tabular figures). Wallet addresses use `.addr` (monospace, so look-alike characters stand apart). Copy rules: page title 1–2 words, one helper line of 12 words or fewer, buttons a verb plus one word.

## Shape and depth

Cards 16–20px (`rounded-2xl`), buttons and inputs 12px (`rounded-xl`), badges, tabs and avatars fully round. Borders separate surfaces; shadows only on sheets and menus (`--shadow-pop`).

## Components

- **Badge** (`components/ui/badge.tsx`): status pill with an icon and text: ready (check), hold (pause), block (prohibit), neutral. Status is never shown by colour alone.
- **Tables**: real `<table>` with `<th scope="col">`, no-wrap headings, row hover; wide tables scroll inside a keyboard-focusable region with a label.
- **App shell** (`app/(app)/layout.tsx`): dark sidebar with icons on large screens, scrolling tab row on phones, light top bar with the business name, page name and mode badge, skip-to-content link.
- **Dashboard** (`this-week`): page header with actions, four number cards, activity table, side panels.

## Motion

GSAP 3.15 with ScrollTrigger, SplitText and CustomEase on the home page only: Hear-style pinned split steps and line reveal, New Engen-style pinned checks accordion, Stax-style auto-advancing limits tabs. Buttons scale to 0.98 on press. All motion respects `prefers-reduced-motion`. No motion on app navigation or table rows.

## Verification (9 Nov 2026)

Production build checked at 320, 768, 1024 and 1440px on every route: no horizontal overflow, no console errors, no axe-core WCAG 2 A/AA violations.
