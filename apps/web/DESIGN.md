# Bursr design system

Rebuilt on 11 Nov 2026 as a fintech product, from a study of Nigerian fintech apps (Moniepoint, Kuda, Paystack, PiggyVest, Cowrywise, Grey, Brass, OPay): balance first with a hide/show eye, actions beside it, transaction rows (avatar, name, one short line, amount right, status), bottom tabs on phones, one helper line per section, explanations behind "Details". Built in our own components; no branding, scripts or layouts copied.

## Colour system

One source: `lib/palette.ts` (raw values, used only where code needs them: GSAP tweens, generated images) mirrors the `@theme` tokens in `app/globals.css`. `components/colour-system.test.ts` fails if the two differ or if any screen hard-codes a colour.

| Role | Tokens | Use it for | Never for |
| --- | --- | --- | --- |
| Brand | `ledger` `#2f4bdb`, `ledger-soft` `#eef1fd`, `indigo` `#2339b5` (hover), `ledger-bright` `#8ea0ff` (on dark) | Buttons, links, the active page, one highlighted phrase per heading | Status of any kind |
| Done | `ok` `#12a150`, `ok-soft`, `ok-bright` | Money arrived, paid, checks passed | Decoration, headings |
| Waiting | `hold` `#b54708`, `hold-soft`, `hold-bright` | Waiting, needs you, on hold | Highlights |
| Blocked | `refuse` `#d92d20`, `refuse-soft`, `refuse-bright` | Blocked, failed, refused, danger buttons | Emphasis |
| Neutrals | `paper` `#f5f6f8`, `paper-2` `#eef0f4`, `card` `#ffffff`, `ink` `#0b1220`, `muted` `#5b6475`, `line` `#e4e7ec`, `night` `#0b1220`, `night-2` `#18213a` | Everything else: text, surfaces, borders, dark sections | |

`-soft` is the tinted background behind the same meaning; `-bright` is the same meaning on a dark surface. Status always comes with a word or icon, never colour alone. Networks appear only as their own logos (`public/networks/`, web3icons MIT). No gradients in the hero or behind content.

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
