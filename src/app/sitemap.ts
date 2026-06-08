import type { MetadataRoute } from "next";
import { listLatestRules, ruleSlug } from "@/lib/rules";

const BASE = "https://audithalo.com";

const STATIC_PATHS = [
  "/",
  "/features",
  "/pricing",
  "/for-supervisors",
  "/for-group-practices",
  "/security",
  "/states",
  "/evidence-packages",
  // SEO Layer 1 — category pages
  "/clinical-supervision-software",
  "/mental-health-supervision-software",
  // SEO Layer 3 — pain pages
  "/supervision-log-template",
  "/counseling-supervision-audit-checklist",
  "/lcmhca-supervision-requirements",
  "/apcc-supervision-requirements",
  // Founding Supervisor program landing — indexable so warm referrals from
  // the cold-email campaign can also surface organically.
  "/founding",
  "/contact",
  "/legal/terms",
  "/legal/privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority:
      path === "/"
        ? 1.0
        : path === "/states" || path === "/pricing"
          ? 0.9
          : 0.7,
  }));

  const stateEntries: MetadataRoute.Sitemap = listLatestRules().map((r) => ({
    url: `${BASE}/states/${ruleSlug(r.jurisdiction, r.license_code)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.85, // state pages are core SEO targets
  }));

  return [...staticEntries, ...stateEntries];
}
