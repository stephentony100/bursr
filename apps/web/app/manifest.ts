import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bursr",
    short_name: "Bursr",
    description: "An AI agent that pays your staff and suppliers in digital dollars, inside limits you set.",
    start_url: "/this-week",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#0b1220",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
