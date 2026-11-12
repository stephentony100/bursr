import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

// Bursr's brand (apps/web/lib/palette.ts and the logo handoff).
export const C = {
  blue: "#3047e0",
  navy: "#0e1222",
  navy2: "#18213a",
  paper: "#f5f6f8",
  card: "#ffffff",
  line: "#e4e7ec",
  muted: "#5b6475",
  lilac: "#c3ccff",
  accent: "#7c8cff",
  ok: "#12a150",
  okBright: "#4ade80",
  hold: "#b54708",
  refuse: "#d92d20",
  refuseSoft: "#fee4e2",
  okSoft: "#e7f6ec",
  blueSoft: "#eef1fd",
};

export const DISPLAY = loadJakarta("normal", { weights: ["600", "700", "800"], subsets: ["latin"] }).fontFamily;
export const BODY = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
