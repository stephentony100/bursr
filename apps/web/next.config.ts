import path from "node:path";
import type { NextConfig } from "next";

// The .env at the repo root is loaded by lib/env.ts (see the note there).

// Cache Components is off: every Bursar page shows live data from the local
// database, so pages render per request (see `connection()` in each page).
const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3", "@phala/dcap-qvl"],
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
