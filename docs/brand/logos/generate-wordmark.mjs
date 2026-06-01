// Generate the horizontal AuditHalo wordmark: mark + "AuditHalo" in Cabinet Grotesk Bold.
// Text is converted to SVG paths so the file is portable — no font dependency.
//
// Run: node docs/brand/logos/generate-wordmark.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import opentype from "opentype.js";
import sharp from "sharp";

const FONT_DIR = "docs/brand/fonts";
const TTF_PATH = `${FONT_DIR}/cabinet-grotesk-bold.ttf`;
const GOLD = "#B8860B";
const FG = "#0A1428";

if (!existsSync(FONT_DIR)) mkdirSync(FONT_DIR, { recursive: true });

async function ensureFont() {
  if (existsSync(TTF_PATH)) return readFileSync(TTF_PATH);
  console.log("Fetching Cabinet Grotesk Bold from Fontshare ...");
  const cssRes = await fetch(
    "https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800&display=swap",
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  const css = await cssRes.text();
  // Fontshare serves the TTF directly alongside woff2/woff. Grab the TTF URL.
  const ttfMatch = css.match(/url\(['"]?(\/\/[^)'"]+\.ttf)['"]?\)/);
  if (!ttfMatch) throw new Error("Could not parse TTF URL from Fontshare CSS");
  const ttfUrl = `https:${ttfMatch[1]}`;
  console.log(`  → ${ttfUrl}`);
  const fontRes = await fetch(ttfUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const ttf = Buffer.from(await fontRes.arrayBuffer());
  writeFileSync(TTF_PATH, ttf);
  console.log(`  wrote ${TTF_PATH} (${ttf.length} bytes)`);
  return ttf;
}

const ttf = await ensureFont();
const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));

// --- Mark (lifted from the chosen logo) ----------------------------------------------
// Inner ring: r=35, outer base: 42, knockout dot at -68° on mid radius.
const markInner = readFileSync(
  "docs/brand/logos/mark-transparent.svg",
  "utf8"
)
  .replace(/^<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");

// --- Text → path -------------------------------------------------------------------
const text = "AuditHalo";
const fontSize = 100;
const path = font.getPath(text, 0, 0, fontSize);
const bbox = path.getBoundingBox();
const textPathData = path.toPathData(2);
const textWidth = bbox.x2 - bbox.x1;
const textHeight = bbox.y2 - bbox.y1;

// --- Compose horizontal wordmark ----------------------------------------------------
// Mark from the source is in viewBox 0..200. Useful inner bounds ~40..160 (120 units).
// We scale mark to match a target cap height so it visually balances the text.
const targetMarkSize = 200; // units in our composed canvas
const markScale = targetMarkSize / 200;

// Text scale: we want text cap height around 60% of the mark height.
const targetCapHeight = targetMarkSize * 0.6;
const textScale = targetCapHeight / textHeight;

// Translate text so its baseline aligns vertically with the mark center.
const textRenderWidth = textWidth * textScale;
const gap = targetMarkSize * 0.12;
const totalWidth = targetMarkSize + gap + textRenderWidth;
const totalHeight = targetMarkSize;

const textY = totalHeight / 2 + (targetCapHeight / 2);
const textTx = targetMarkSize + gap - bbox.x1 * textScale;
const textTy = textY - bbox.y2 * textScale;

const composedTransparent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${totalHeight.toFixed(2)}" width="${totalWidth.toFixed(0)}" height="${totalHeight.toFixed(0)}">
  <g transform="scale(${markScale.toFixed(4)})">${markInner}</g>
  <path d="${textPathData}" transform="translate(${textTx.toFixed(2)} ${textTy.toFixed(2)}) scale(${textScale.toFixed(4)})" fill="${FG}"/>
</svg>
`;

const composedLight = composedTransparent.replace(
  /<svg([^>]*)>/,
  (m, attrs) =>
    `<svg${attrs}><rect width="100%" height="100%" fill="#FAFAF7"/>`
);

writeFileSync("docs/brand/logos/wordmark-horizontal.svg", composedTransparent);
writeFileSync(
  "docs/brand/logos/wordmark-horizontal-cream-bg.svg",
  composedLight
);

console.log(`Wrote wordmark-horizontal.svg (${totalWidth.toFixed(0)}×${totalHeight.toFixed(0)})`);

// --- Export PNG variants ------------------------------------------------------------
async function rasterize(svgString, outPath, scaleHeight) {
  const aspect = totalWidth / totalHeight;
  const h = scaleHeight;
  const w = Math.round(h * aspect);
  await sharp(Buffer.from(svgString), { density: 600 })
    .resize(w, h, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outPath);
  console.log(`Wrote ${outPath} (${w}×${h})`);
}

for (const h of [128, 256, 512, 1024]) {
  await rasterize(
    composedTransparent,
    `docs/brand/logos/wordmark-horizontal-${h}.png`,
    h
  );
}
