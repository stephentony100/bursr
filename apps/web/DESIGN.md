---
name: Bursar
description: An AI that pays a small business's bills, drawn as a crossed cheque on security paper.
colors:
  ledger: "#1d6a60"
  indigo: "#17544c"
  ledger-soft: "#d5e7e0"
  hold: "#95580a"
  hold-soft: "#f1e3c9"
  refuse: "#b3261e"
  refuse-soft: "#f6ddd9"
  guilloche: "#2f6f6a"
  paper: "#edf1ea"
  paper-2: "#e1e8de"
  card: "#f8faf5"
  ink: "#16202a"
  muted: "#4c5963"
  line: "#c3cec5"
  night: "#16202a"
  night-2: "#23303b"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.7rem, 6.6vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 112"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 112"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.11
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 112"
  title-section:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
    fontVariation: "'wdth' 110"
  body-lead:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  button:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.66rem"
    fontWeight: 600
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 125"
  numeral:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "0.92em"
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
  micr:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "0.72rem"
    letterSpacing: "0.18em"
    fontFeature: "'tnum' 1"
  hand:
    fontFamily: "Homemade Apple, cursive"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 2.1
    letterSpacing: "0"
rounded:
  bar: "2px"
  stamp: "3px"
  slip: "4px"
  button: "6px"
  card: "12px"
  round: "9999px"
spacing:
  tight: "8px"
  row: "12px"
  inline: "16px"
  gutter: "20px"
  card: "24px"
  stack: "32px"
  stack-lg: "40px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.ledger}"
    textColor: "{colors.card}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.indigo}"
  button-hero:
    backgroundColor: "{colors.ledger}"
    textColor: "{colors.card}"
    rounded: "{rounded.button}"
    padding: "14px 24px"
  button-hero-hover:
    backgroundColor: "{colors.indigo}"
  button-quiet:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "8px 16px"
  button-quiet-hover:
    backgroundColor: "{colors.paper}"
  button-danger:
    backgroundColor: "{colors.refuse}"
    textColor: "{colors.card}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "8px 16px"
  stamp-ready:
    textColor: "{colors.ledger}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "6px 10px"
  stamp-hold:
    textColor: "{colors.hold}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "6px 10px"
  stamp-void:
    textColor: "{colors.refuse}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "6px 10px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  counterfoil-stub:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    padding: "16px 24px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.button}"
    padding: "8px 12px"
  nav-band:
    backgroundColor: "{colors.night}"
    textColor: "{colors.card}"
    height: "64px"
  nav-item:
    textColor: "{colors.card}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "8px 12px"
  nav-item-hover:
    backgroundColor: "{colors.night-2}"
  nav-item-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
  mode-badge-live:
    backgroundColor: "{colors.refuse}"
    textColor: "{colors.card}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "4px 8px"
---

# Design System: Bursar

## Overview

**Creative North Star: "The Crossed Cheque"**

Two parallel lines across a cheque mean only the named payee can be paid. Bursar is that crossing made enforceable by the wallet, and every surface is drawn from the same desk: pale sage security paper, blue-black printing ink, teal security linework, rubber stamps, perforations and counterfoil stubs. The home page shows a real cheque to the sample restaurant's supplier being checked; the app is the cheque book the owner works from each week. Nothing glows, floats or fades into a gradient. Paper is flat, ink is flat, and status arrives the way it does in a bank office: as a stamp.

Density is calm and ledger-like. Landing sections breathe (96px vertical rhythm, headings at poster scale); app screens are stacked cards of plain-English rows with figures set in a printed monospace. The voice of the type is split three ways and never mixed: Archivo for everything you read (pushed wide for printed field labels), Martian Mono for the figures and codes a bank would print, and Homemade Apple only where the owner's own hand would write on a cheque.

The world explicitly refuses the payments-startup default: dark gradient hero, glowing accent, floating app screenshot. The user asked for no gradients; that is a standing decision.

**Key Characteristics:**
- Flat colour on pale sage security paper; blue-black ink; one teal accent.
- Security devices drawn as exact SVG geometry: guilloche bands, a rosette, the A/C PAYEE ONLY crossing, dotted perforations, the MICR line.
- Statuses are rubber stamps: bordered, uppercase, slightly rotated, in the verdict colour.
- Three type voices with hard boundaries: Archivo (reading and printed labels), Martian Mono (figures), Homemade Apple (payee line and signature).
- An ink band (blue-black) heads every page; the app sits on paper below it.
- Motion is pen and press: the crossing draws itself, ink ticks follow, stamps land, buttons give under the finger, the week scene is scrubbed by scroll and plays backwards when you scroll up.

## Colors

Pale sage paper and blue-black ink carry almost everything; one teal says "safe to go", ochre says "held", red says "void".

### Primary
- **Ledger Teal** (#1d6a60, token `ledger`): the single accent. Primary buttons ("Try it with a sample restaurant", "Approve and pay everyone", "Check this invoice"), the Ready stamp, Paid ticks, "Proof checked", the owner's limit figures and "Paid so far" on the home page, the weekly meter while under 80%, the scroll progress bar, the week-ruler marker, text selection and the caret.
- **Deep Ledger Teal** (#17544c, token `indigo`, a legacy name; it is a darker turn of the same teal, not a second hue): hover state of every teal button, inline links, and the focus ring.
- **Cleared Wash** (#d5e7e0, token `ledger-soft`): background of the "payments are ready for your OK" callout, checked payout-token chips, and "Allowed" results in the rule tester.

### Status
- **Hold Ochre** (#95580a, token `hold`): only for things that wait for the owner. Hold stamps, "On hold: please check", "Needs your eyes", "Ready, but read the note", payout-change entries in activity, the "30% more" price tag, and the weekly meter between 80% and 99%.
- **Hold Wash** (#f1e3c9, token `hold-soft`): background of hold callouts ("2 invoices need a look"), the duplicate and price-creep slips, and wallet-error notes.
- **Void Red** (#b3261e, token `refuse`): only for refusal and for the two warnings that something real is live. Void and Bounced stamps, "Blocked by your spending rules", "Not paid", the limit wall line, the red-pen ring round a look-alike name, the weekly meter at 100%, plus the "Live · real money" badge and the "Pause all payments" button.
- **Void Wash** (#f6ddd9, token `refuse-soft`): the zone past the limit wall, the "Held for you" tray, the look-alike and changed-bank-details slips, blocked-result boxes.

### Linework
- **Guilloche Teal** (#2f6f6a, token `guilloche`): the stroke colour of the guilloche bands and the rosette only, drawn as hairlines at 0.22 to 0.4 opacity; never a fill. (The sealed-room wireframe is drawn in Ledger Teal.)

### Neutral
- **Security Paper** (#edf1ea, token `paper`): the page ground everywhere, and the quiet-button hover.
- **Counterfoil Sage** (#e1e8de, token `paper-2`): alternate landing bands, counterfoil stubs, the empty track of the meter.
- **Field White** (#f8faf5, token `card`): the white of a filled-in field. Cards, cheques, invoices, inputs, and text on the ink band.
- **Printing Ink** (#16202a, token `ink`): all body text, headings, the crossing strokes, the 2px amount box and total rules. Used at alpha (10% to 40%) for paper-object borders and dotted rules on the landing.
- **Faded Ink** (#4c5963, token `muted`): secondary text, field labels, hints, timestamps (6.3:1 on paper).
- **Ruled Line** (#c3cec5, token `line`): 1px borders and dividers on app cards, tables and inputs.
- **Ink Band** (#16202a, token `night`, same ink under its legacy name): the site and app header, the clearing tape, the closing section and footer.
- **Ink Band Raised** (#23303b, token `night-2`): hover fill for nav items on the ink band.

`--color-cream` and `--color-stamp` remain in the theme as legacy aliases of Field White and Void Red; new work uses `card` and `refuse`.

### Named Rules
**The One Teal Rule.** Teal is the only accent. It marks the primary action and anything cleared, ready or paid. If a second element on a screen wants teal for decoration, it gets ink instead.

**The Verdict Colour Rule.** Ochre means held, red means refused. Neither is ever used for emphasis, decoration or branding. A red element that is not a refusal or a live-money warning is a bug.

**The Flat Ink Rule.** Flat colour only. No gradients, glows, blur filters, backdrop blur or grain, anywhere. Security texture is drawn as SVG line at low opacity, never faked with a gradient or noise.

## Typography

**Display Font:** Archivo, variable with the `wdth` axis (fallback ui-sans-serif, system-ui, sans-serif)
**Body Font:** Archivo at normal width
**Label/Mono Font:** Martian Mono (fallback ui-monospace, monospace)
**Hand Font:** Homemade Apple (fallback cursive)

**Character:** A wide, heavy grotesque that reads like the printed face of a cheque, paired with a square-shouldered mono for the figures a bank machine would print, and one loose handwriting face that stands for the owner's pen.

Width is set with `font-stretch` on Archivo's variable axis: 112% for headings, 110% for card and section titles, 125% for printed field labels, 100% for reading.

### Hierarchy
- **Display** (800, clamp(2.7rem, 6.6vw, 6rem), 0.94): the hero headline only, two lines, "Pay everyone. / Never the wrong person." The closing section uses the same voice at clamp(2.8rem, 6.4vw, 6rem), 0.92. Balanced wrapping.
- **Headline** (800, 3rem below 640px and 3.75rem above, 0.95): landing section headings. The week scene's step titles use the same voice at 1.875rem to 3rem.
- **Title** (800, 2.25rem, 1.11): the h1 of each app screen ("Invoices", "Spending rules", the business name on This week).
- **Title, section** (700, 1.25rem, 1.4, width 110%): card and section headings inside app screens ("Add an invoice", "Your limits", "Latest activity"). Also the slip titles and counterfoil business name.
- **Body lead** (400, 1.125rem, 1.625): landing paragraphs at 75% to 80% ink, measured to 34 to 60ch.
- **Body** (400, 1rem, 1.5) and **body small** (400, 0.875rem, 1.43): app copy, held to 42rem (max-w-2xl). Small is the default size for rows, hints and results.
- **Label** (600, 0.66rem, 0.08em, uppercase, width 125%): printed field labels ("PAY", "THE SUM OF", "INTO", "COUNTERFOIL", "LEFT TO SPEND THIS WEEK", "PAID SO FAR") and the text of stamps and badges.
- **Numeral** (Martian Mono, 0.92em of its context, tabular, -0.01em): every money amount, account and wallet address, invoice line figures, proof references and technical codes.
- **MICR** (Martian Mono, 0.72rem, 0.18em tracking, 70% ink): the machine line along the bottom of a cheque, e.g. "000412  0118 00  NEAR".
- **Hand** (Homemade Apple 400, 0.8 to 1.2rem, line-height 2 to 2.2): the payee line, the amount in words, and the signature "Bukka Corner". The tall line-height is required; the face has long ascenders.

### Named Rules
**The Printed Figure Rule.** Martian Mono is for figures and codes only: amounts, account numbers, addresses, proofs and the MICR line. Never for headings, labels, buttons or prose.

**The Own Hand Rule.** Homemade Apple appears only where the owner's pen would write on a cheque: the payee line, the amount in words and the signature. Never for UI text, headings, buttons or emphasis.

**The Field Label Rule.** Expanded caps label a printed field or the value beneath them. They never sit above a heading as an eyebrow or kicker.

## Layout

The landing is a single column of full-width paper bands inside a 1280px container (max-w-7xl) with 20px side gutters. Bands alternate Security Paper and Counterfoil Sage, each separated by a 1px rule at 10% ink, with 96px of vertical padding. The ink band opens and closes the page. The hero is a two-column grid at 1024px and up (0.75fr copy, 1.5fr cheque) under a full-width two-line headline; below 1024px the cheque drops beneath the copy and the counterfoil stub hides below 640px. Proof sections pair copy with an object in a 1:1 grid at 1024px; the four sourced figures run four across at 1024px, two at 640px, each hung on a 1px ink rule at its left.

The week scene is a 620vh section with a sticky 100svh stage. On large screens the caption sits in a 440px (480px at 1280px) left column; on phones it stacks above the stage. The stage is a fixed board (920 by 680, or 400 by 660 when its container is under 620px wide) scaled to fit, so the choreography is identical at every size. A Monday-to-Friday ruler runs along the bottom.

The app uses a 1152px container (max-w-6xl) with the same 20px gutters and 40px top and bottom padding. Screens are a vertical stack: page title and one paragraph, then full-width cards, 32 to 40px apart. Cards pad 24px (20px for list items); rows inside them divide on 1px Ruled Line with 12px vertical padding. Explanatory paragraphs are held to 42rem.

Breakpoints are Tailwind's defaults: 640, 768, 1024, 1280px.

## Elevation & Depth

App screens are flat: depth comes from tone (Security Paper ground, Field White cards, Counterfoil Sage stubs) and 1px Ruled Line borders, never from shadow. On the landing, only loose paper objects lying on the desk cast a shadow: the hero cheque, the supplier invoices, the counterfoil list in the week scene, and the small payment tickets in flight. Those shadows are soft, low, ink-tinted and pulled in with a negative spread so they sit under the paper, not around it. The ink band is the only dark surface.

### Shadow Vocabulary
- **Cheque on the desk** (`box-shadow: 0 30px 60px -34px rgb(22 32 42 / 0.6)`): the hero cheque only.
- **List on the desk** (`box-shadow: 0 24px 50px -30px rgb(22 32 42 / 0.6)`): the week scene's counterfoil list of this week's cheques.
- **Slip on the desk** (`box-shadow: 0 14px 30px -18px rgb(22 32 42 / 0.55)`): supplier invoices and the duplicate-bill slips.
- **Ticket in flight** (`box-shadow: 0 8px 18px -10px rgb(22 32 42 / 0.6)`): payment tickets travelling to their network in the week scene.

### Named Rules
**The Paper On The Desk Rule.** A shadow means a loose piece of paper. Cards, buttons, inputs, nav and anything inside the app stay flat.

## Shapes

Corners follow a small ladder tied to what the object is. Printed and stamped things are nearly square; containers are gently rounded.

- **Bar** (2px): meter tracks and the price-comparison bars.
- **Stamp** (3px): rubber stamps, the demo/live mode badge, the 2px amount box on a cheque, the "Checking" tag.
- **Slip** (4px): supplier invoices, the limit-wall cheque, payment tickets. The hero cheque and counterfoil lists use 6px.
- **Button** (6px): every button, input, select, nav item, checkbox chip and result box.
- **Card** (12px): app cards, the counterfoil on This week, the catch slips, the limit wall and the sealed-room panel.
- **Round** (full): icon wells only (40 to 48px circles holding a Phosphor glyph).

Borders carry the cheque language. Perforations are 2px dotted ink at 30% between a stub and its cheque. Rows on a counterfoil divide on 1px dotted ink at 25 to 30%. The amount on a cheque sits in a 2px solid ink box. A total sits under a 2px solid ink rule. The held tray is a 2px dashed red border at 45%. Rubber stamps are 2px solid in their verdict colour.

**The Radius Ladder Rule.** 3px stamps, 4 to 6px paper, 6px controls, 12px cards. Nothing in between, and nothing pill-shaped except icon wells.

## Components

### Buttons
Firm, square-shouldered and quick to answer the finger.
- **Shape:** gently squared corners (6px).
- **Primary:** Ledger Teal fill, Field White text, 0.875rem medium, 8px by 16px. Hover deepens to Deep Ledger Teal over 160ms. While a server action runs the label changes to "One moment…" and the button drops to 60% opacity with a not-allowed cursor.
- **Hero:** the landing call to action "Try it with a sample restaurant": same colours at 1rem semibold, 14px by 24px, with a bold Phosphor arrow that nudges 2px right on hover.
- **Quiet:** Field White with a 1px Ruled Line border and ink text; hover fills Security Paper. Used for "Not this week", "Reload the sample invoices", the rule-tester scenarios.
- **Danger:** Void Red fill, Field White text, for "Pause all payments" only. "Try to sneak a big payment past your limits" is a red outline variant (2px red border at 60%, red text, red wash on hover).
- **Press:** every button scales to 0.97 on press over 140ms on the ease-out curve (`cubic-bezier(0.23, 1, 0.32, 1)`); links styled as buttons take the same press through the `.press` class. Expandable buttons (`aria-expanded`) are exempt.
- **Focus:** a 2px Deep Ledger Teal outline, 3px offset, 4px corner, on every focusable element.

### Rubber Stamps
The status vocabulary. Every verdict is stamped, not badged.
- **Style:** transparent ground, 2px solid border and text in the verdict colour, 3px corners, expanded caps at extra-bold weight, 6px by 10px padding (4px by 6px small, 8px by 16px large), an optional one-line note beneath in medium weight.
- **Tilt:** rotated a few degrees (-2deg on app invoice cards, -8 to 9deg on the landing) so it reads as pressed by hand.
- **Verdicts:** Ready (teal), Hold (ochre), Void and Bounced (red). App invoice statuses ("Ready to pay", "On hold: please check", "Blocked: don't pay") and the "Proof checked" result use the same stamp. The demo badge on the ink band is the same shape in outline (1.5px Field White at 50%); the live badge is a solid red stamp.
- **Landing:** stamps land with a press (scale 1.5 to 0.97 to 1 over 320ms) or, in the week scene, at the instant the checking line passes the invoice.
- In-row progress inside a list (Paying…, Sent, Paid, Not paid) is plain coloured text in the same verdict colours, not a stamp.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Field White on Security Paper.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px Ruled Line. Callouts that need attention use a 2px border at 40% of their verdict colour over the matching wash (teal for "ready for your OK", ochre for "need a look").
- **Internal Padding:** 24px for sections, 20px for invoice list items, 16px by 12px for rows.

### Inputs / Fields
- **Style:** Field White, 1px Ruled Line border, 6px corners, 8px by 12px padding. Money fields carry a muted "$" prefix inside the border and set the value in Martian Mono.
- **Focus:** the global 2px Deep Ledger Teal outline; money fields show it on the wrapper (`focus-within`).
- **Checkbox chips:** 6px bordered labels; checked turns the border teal and fills Cleared Wash. Native checkboxes and radios take `accent-color` Ledger Teal.
- **Labels:** sentence case, 0.875rem medium, hint text below in muted regular.

### Navigation
- **Ink band:** a full-width Printing Ink header (64px tall on the landing, 14px vertical padding in the app) carrying the light-tone logo.
- **App items:** 0.875rem medium, 8px by 12px, 6px corners. Idle text is Field White at 75%; hover fills Ink Band Raised and brightens the text; the current page is a Field White tab with ink text (`aria-current="page"`). Items wrap on phones.
- **Landing items:** anchor links at 75% white, shown from 768px; "Open the app" is always visible, underlined at 40% white.
- **Mode badge:** right-aligned on the app band; a stamp reading "Demo · practice money" or "Live · real money".

### The Cheque (signature component)
The hero object and the template for every cheque-like surface.
- A Field White slip with 6px corners and the cheque-on-the-desk shadow. From 640px a 9.5rem Counterfoil Sage stub sits on the left behind a 2px dotted perforation, listing No., To, For and Amount.
- A guilloche band (seven phase-shifted sine paths, hairline Guilloche Teal at 0.28 opacity) across the top and a rosette (24 rotated ellipses at 40% opacity) in the top-right corner.
- Field rows: an expanded-caps label, the value on a 1px ink-30% rule, and an ink tick at the right. The payee and the amount in words are in the owner's hand; the account is in Martian Mono.
- The amount in a 2px ink box, the signature in the owner's hand over a rule with "Signed once for the week" beneath, and the MICR line under a 1px rule.
- **The crossing:** two parallel 2px ink strokes with "A/C PAYEE ONLY" set between them in expanded caps, laid across the payee area.
- **Motion:** the crossing draws once (each stroke 700ms ease-out, the second 140ms after the first, the words fading in 420ms later), then four ink ticks draw beside Pay, The sum of, Into and For (1050, 1250, 1450, 1650ms), each label settling in 160ms after its tick: "On your list", "As agreed", "Same as always", "Not paid before".

### The Counterfoil
The This week summary is a cheque-book counterfoil: a 12px card with a guilloche band, "Left to spend this week" as a field label over the remaining amount in 3rem Martian Mono, and a 10px meter (2px corners) that fills teal, then ochre at 80%, then red at 100%, easing over 700ms. On the right (below on phones) a Counterfoil Sage stub behind a 2px dotted perforation lists the wallet's facts on dotted rules. The landing's pricing card and the week scene's list of cheques use the same counterfoil grammar: field label, business name, dotted rows, a 2px ink rule over the total.

### The Week Scene
The pinned home-page story, scrubbed by scroll and fully reversible. Six supplier invoices drop into a pile, fan into an arc, and a teal checking line with a "Checking" tag sweeps across, stamping each one as it passes. Four slide into the dashed red "Held for you" tray; two shrink into the counterfoil list beside staff pay; the list totals, the teal "Approve and pay everyone" button turns ink and reads "Approved", the signature writes itself left to right, and six payment tickets arc to their network slots (NEAR, Base, Tron, Solana), which turn their border teal as money arrives. Every position is a pure function of scroll progress, so scrolling up plays it backwards. With reduced motion the scene snaps between the ends of the four steps instead of moving.

### Supporting landing pieces
- **The clearing tape:** a full-width ink band printing the week's outcomes as a 60s linear loop; "Paid" in white caps, the Void and Hold verbs in 60% white, struck through.
- **The limit wall:** a $5,000 cheque slides to a red line at 66% of a 12px card, shakes (420ms), and backs off with a "Bounced / Over your limit" stamp landing on it; a quiet button replays it. Reduced motion jumps straight to the bounced state.
- **The catch slips:** four tall 12px slips tinted in their verdict wash; the open one widens (flex-grow over 500ms on the in-out curve `cubic-bezier(0.77, 0, 0.175, 1)`) to show the catch. They rotate every 6.5s until the visitor picks one; no rotation with reduced motion.
- **Icons:** Phosphor at the bold weight (the fill weight only for result marks: check, cross, shield), 16 to 22px, in ink or the verdict colour.

## Do's and Don'ts

### Do:
- **Do** use Ledger Teal (#1d6a60) for the one primary action on a screen and for cleared, ready and paid states; hover to Deep Ledger Teal (#17544c).
- **Do** render every verdict as a rubber stamp: 2px border in the verdict colour, 3px corners, expanded caps, a few degrees of tilt.
- **Do** set every amount, account number, address and proof code in Martian Mono with tabular figures.
- **Do** draw security devices as exact SVG geometry: guilloche as computed sine paths, the rosette as rotated ellipses, crossings as two parallel strokes, perforations as 2px dotted borders.
- **Do** keep the radius ladder: 3px stamps, 4 to 6px paper, 6px controls, 12px cards.
- **Do** keep app surfaces flat and separate them with 1px Ruled Line (#c3cec5) borders and tone.
- **Do** give every button the 0.97 press over 140ms, and every focusable element the 2px Deep Ledger Teal outline at 3px offset.
- **Do** make scroll-driven motion a pure function of progress so it reverses, and give reduced-motion visitors the end state of each step instead of the movement.
- **Do** head every page with the ink band and keep the paper ground (#edf1ea) beneath.

### Don't:
- **Don't** use gradients, glows, blur filters, backdrop blur or grain. The user asked for no gradients; flat colour only.
- **Don't** add a second accent hue, or use ochre or red for emphasis. Ochre is only hold; red is only void, bounce, blocked and live-money warnings.
- **Don't** use Martian Mono for headings, labels, buttons or running text.
- **Don't** use Homemade Apple anywhere but the payee line, the amount in words and the signature.
- **Don't** put eyebrow or kicker labels above headings. Expanded-caps labels name a printed field or a value, nothing else.
- **Don't** shadow cards, buttons, inputs or any app surface. Shadows belong only to loose paper on the landing.
- **Don't** use pill-shaped status badges; statuses are stamps.
- **Don't** reach for the payments-startup look: dark gradient hero, glowing accent, floating app screenshot.
