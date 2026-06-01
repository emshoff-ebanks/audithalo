// Export the AuditHalo mark as transparent PNG at several useful sizes.
//
// Run: node docs/brand/logos/export-png.mjs

import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

// Use the mask-based SVG produced by generate.mjs (no bg rect, real hole around dot)
const SRC = "docs/brand/logos/mark-transparent.svg";
const transparentSvg = readFileSync(SRC, "utf8");

const sizes = [256, 512, 1024, 2048];
for (const size of sizes) {
  const out = `docs/brand/logos/mark-transparent-${size}.png`;
  await sharp(Buffer.from(transparentSvg), { density: 600 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`Wrote ${out}`);
}
