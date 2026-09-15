import type { ReactNode } from "react";

/** GitHub-style slug: lowercase, strip punctuation, spaces → hyphens. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Flatten React children (used by MDX headings) down to their text content. */
export function nodeToText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (typeof node === "object" && "props" in node) {
    // React element — recurse into its children.
    return nodeToText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}
