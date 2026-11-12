import type { MetadataRoute } from "next";
import { PALETTE } from "@/lib/palette";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bursr",
    short_name: "Bursr",
    description: "An AI agent that pays your staff and suppliers in digital dollars, inside limits you set.",
    start_url: "/this-week",
    display: "standalone",
    background_color: PALETTE.paper,
    theme_color: PALETTE.ink,
    icons: [
      { src: "/brand/app-icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
