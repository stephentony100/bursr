// Bursr's colour system: every colour in the product, with the one job it does.
// The same values are the `@theme` tokens in app/globals.css (colour-system.test.ts
// keeps the two identical). Use the token classes in markup (bg-ledger, text-ok…);
// use this object only where code needs a raw value (GSAP tweens, generated images).
//
// Rules:
// - brand (ledger): things you can press or follow, the active page, and the
//   one highlighted phrase in a heading. Never for status.
// - ok: money arrived or done. Nothing else is green.
// - hold: waiting, needs you. Never decorative.
// - refuse: blocked, failed, danger. Never for emphasis.
// - *-soft: the tinted background behind the same meaning. *-bright: the same
//   meaning on a dark surface (night).
// - Neutrals carry everything else. Networks appear only as their own logos.
export const PALETTE = {
  paper: "#f5f6f8",
  "paper-2": "#eef0f4",
  card: "#ffffff",
  ink: "#0b1220",
  muted: "#5b6475",
  line: "#e4e7ec",
  ledger: "#2f4bdb",
  "ledger-soft": "#eef1fd",
  "ledger-bright": "#8ea0ff",
  indigo: "#2339b5",
  ok: "#12a150",
  "ok-soft": "#e7f6ec",
  "ok-bright": "#4ade80",
  hold: "#b54708",
  "hold-soft": "#fef0c7",
  "hold-bright": "#fbbf24",
  refuse: "#d92d20",
  "refuse-soft": "#fee4e2",
  "refuse-bright": "#ffc9c3",
  night: "#0b1220",
  "night-2": "#18213a",
} as const;
