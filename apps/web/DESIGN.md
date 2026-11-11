# Bursr design system

Built on 9 Nov 2026 following the frontend-ui-engineering skill (addyosmani/agent-skills). References: Stax.ai's enterprise B2B pages and the business-banking style of products like Mercury and Ramp (calm neutral surfaces, one strong accent, product screens as proof, dense tables in the app). Rebuilt in our own components; no branding or layout copied.

## Tokens (`app/globals.css`, `@theme`)

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#f5f6f8` | App and page background |
| `paper-2` | `#eceef2` | Table heads, tiles, subtle fills |
| `card` | `#ffffff` | Cards, tables, inputs |
| `ink` | `#101828` | Primary text |
| `muted` | `#535d6e` | Secondary text (4.5:1 or better on white and paper) |
| `line` | `#e2e5ea` | Borders and dividers |
| `ledger` | `#0b7a57` | The one accent: primary actions, active state, paid |
| `ledger-soft` | `#e3f4ec` | Accent tint for badges and banners |
| `indigo` | `#086347` | Accent hover, links, focus ring |
| `hold` / `hold-soft` | `#9a5a07` / `#fdf1dd` | Held, needs a look |
| `refuse` / `refuse-soft` | `#c4271c` / `#fde8e6` | Blocked, refused, errors |
| `night` / `night-2` | `#0f1623` / `#1b2433` | Sidebar, checks section, closing band |

One grey family (cool). One accent. No gradients, glows or textures.

## Type

Geist for everything; Geist Mono (`.num`) only for amounts and account numbers. Headings use `.display` (semibold, -0.03em tracking). One `h1` per page; headings don't skip levels.

## Shape and depth

Cards and tables 12px (`rounded-xl`), buttons and inputs 8px (`rounded-lg`), badges and pills fully round. Borders separate surfaces; shadows only on the hero product preview and floating cards.

## Components

- **Badge** (`components/ui/badge.tsx`): status pill with an icon and text: ready (check), hold (pause), block (prohibit), neutral. Status is never shown by colour alone.
- **Tables**: real `<table>` with `<th scope="col">`, no-wrap headings, row hover; wide tables scroll inside a keyboard-focusable region with a label.
- **App shell** (`app/(app)/layout.tsx`): dark sidebar with icons on large screens, scrolling tab row on phones, light top bar with the business name, page name and mode badge, skip-to-content link.
- **Dashboard** (`this-week`): page header with actions, four number cards, activity table, side panels.

## Motion

GSAP 3.15 with ScrollTrigger, SplitText and CustomEase on the home page only: Hear-style pinned split steps and line reveal, New Engen-style pinned checks accordion, Stax-style auto-advancing limits tabs. Buttons scale to 0.98 on press. All motion respects `prefers-reduced-motion`. No motion on app navigation or table rows.

## Verification (9 Nov 2026)

Production build checked at 320, 768, 1024 and 1440px on every route: no horizontal overflow, no console errors, no axe-core WCAG 2 A/AA violations.
