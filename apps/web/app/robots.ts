import type { MetadataRoute } from "next";
import { readEnv } from "@/lib/env";

// Search engines see the home page and sign-in; a business's own pages and payee links stay private.
export default function robots(): MetadataRoute.Robots {
  const base = readEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/signin"],
      disallow: ["/api/", "/join/", "/welcome", "/this-week", "/agent", "/invoices", "/payments", "/records", "/people", "/spending-rules", "/add-money"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
