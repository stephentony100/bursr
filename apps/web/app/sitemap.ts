import type { MetadataRoute } from "next";
import { readEnv } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = readEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/signin`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
