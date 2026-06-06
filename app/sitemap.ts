import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";
import { getPostSlugs } from "@/lib/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    "",
    "/product/odorstrike",
    "/shop",
    "/about",
    "/how-it-works",
    "/blog",
    "/contact",
    "/privacy",
    "/terms",
    "/refund",
    "/returns",
    "/shipping",
    "/cookies",
  ].map((route) => ({
    url: `${SITE.url}${route}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: route === "" || route === "/product/odorstrike" ? 1 : 0.7,
  }));

  const blogRoutes = getPostSlugs().map((slug) => ({
    url: `${SITE.url}/blog/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...blogRoutes];
}
