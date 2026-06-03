/** A PHI match found in user-supplied text. */
export type PhiMatch = {
  kind: "phone" | "ssn" | "email" | "address" | "credit_card";
  /** The matched substring. */
  match: string;
  /** Character offset within the input. */
  index: number;
};

/** Scan text for likely-PHI patterns. Pure function. Returns ALL matches
 *  across categories — caller decides how to surface them. */
export function scanForPhi(text: string): PhiMatch[] {
  const matches: PhiMatch[] = [];

  // Phone numbers — US-style: (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx, xxx xxx xxxx.
  // Requires at least one separator/paren so a bare 10-digit number (e.g. a
  // transaction id) doesn't trigger a false-positive. \b would fail before "("
  // since both characters are non-word; use a lookbehind so the paren is captured.
  const phoneRe = /(?<![\w\d])(?:\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}|\d{3}[\s.-]\d{3}[\s.-]\d{4})\b/g;
  for (const m of text.matchAll(phoneRe)) {
    matches.push({ kind: "phone", match: m[0], index: m.index ?? 0 });
  }

  // SSN — xxx-xx-xxxx
  const ssnRe = /\b\d{3}-\d{2}-\d{4}\b/g;
  for (const m of text.matchAll(ssnRe)) {
    matches.push({ kind: "ssn", match: m[0], index: m.index ?? 0 });
  }

  // Email
  const emailRe = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  for (const m of text.matchAll(emailRe)) {
    matches.push({ kind: "email", match: m[0], index: m.index ?? 0 });
  }

  // Street address indicators — number followed by Street/St/Avenue/Ave/Road/Rd/Lane/Ln/Drive/Dr/Boulevard/Blvd
  const addressRe = /\b\d+\s+\w+\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd|Court|Ct|Way|Place|Pl)\b\.?/gi;
  for (const m of text.matchAll(addressRe)) {
    matches.push({ kind: "address", match: m[0], index: m.index ?? 0 });
  }

  // Credit card — 13-19 digits possibly with spaces/dashes (basic, not Luhn-checked)
  const ccRe = /\b(?:\d[\s-]?){12,18}\d\b/g;
  for (const m of text.matchAll(ccRe)) {
    // Filter false positives that look like phone numbers (already caught above)
    const stripped = m[0].replace(/[\s-]/g, "");
    if (stripped.length >= 13 && stripped.length <= 19) {
      matches.push({ kind: "credit_card", match: m[0], index: m.index ?? 0 });
    }
  }

  // Sort by index for stable display
  matches.sort((a, b) => a.index - b.index);
  return matches;
}

/** Returns a label suitable for showing to the user about a found match. */
export function phiKindLabel(kind: PhiMatch["kind"]): string {
  switch (kind) {
    case "phone": return "phone number";
    case "ssn": return "Social Security number";
    case "email": return "email address";
    case "address": return "street address";
    case "credit_card": return "credit card number";
  }
}
