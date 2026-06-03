import type { MetadataRoute } from "next";

const BASE = "https://audithalo.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The app subdomain is gated by Auth.js — block crawlers from wasting
        // requests on the login/register/dashboard pages
        disallow: ["/dashboard/", "/login", "/register", "/api/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
