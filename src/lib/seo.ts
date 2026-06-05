/**
 * JSON-LD builders for marketing pages. Each returns a plain object that
 * should be embedded inside a <script type="application/ld+json"> element
 * rendered server-side. Keep types loose — Google's schema validator is the
 * source of truth, not TypeScript.
 */

const BASE = "https://audithalo.com";

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AuditHalo",
    description:
      "State-board compliance software for mental health supervisors. Track pre-licensed counselor hours, signatures, and state-board requirements; generate audit-ready evidence packages.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: BASE,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "49",
      highPrice: "199",
    },
    publisher: { "@type": "Organization", name: "AuditHalo", url: BASE },
  };
}

export function pricingProductJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "AuditHalo",
    description:
      "Mental health supervision compliance and evidence packaging for state board audits.",
    brand: { "@type": "Brand", name: "AuditHalo" },
    offers: [
      {
        "@type": "Offer",
        name: "Solo",
        price: "49",
        priceCurrency: "USD",
        url: `${BASE}/pricing`,
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Practice",
        price: "199",
        priceCurrency: "USD",
        url: `${BASE}/pricing`,
        availability: "https://schema.org/InStock",
      },
    ],
  };
}

export function articleJsonLd(input: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    url: input.url,
    datePublished: input.datePublished,
    publisher: { "@type": "Organization", name: "AuditHalo", url: BASE },
    author: { "@type": "Organization", name: "AuditHalo", url: BASE },
  };
}

export function faqPageJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function jsonLdScript(payload: object) {
  return {
    __html: JSON.stringify(payload).replace(/</g, "\\u003c"),
  };
}
