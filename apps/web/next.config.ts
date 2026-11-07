import path from "node:path";
import type { NextConfig } from "next";

// The .env at the repo root is loaded by lib/env.ts (see the note there).

// Cache Components is off: every Bursar page shows live data from the local
// database, so pages render per request (see `connection()` in each page).
const nextConfig: NextConfig = {
  // Pages were renamed to match the menu; old links (e.g. in Telegram messages) still work.
  async redirects() {
    return [
      { source: "/plan", destination: "/payments", permanent: true },
      { source: "/statement", destination: "/records", permanent: true },
      { source: "/payees", destination: "/people", permanent: true },
      { source: "/payees/:id", destination: "/people/:id", permanent: true },
      { source: "/setup", destination: "/spending-rules", permanent: true },
      { source: "/api/statement.csv", destination: "/api/records.csv", permanent: true },
    ];
  },
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
