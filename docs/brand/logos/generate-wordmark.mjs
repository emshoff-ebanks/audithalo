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
  const ttfMatch = css.match(/url\(['"]?(\/\/[^)'"]+\.ttf)['"]?\)/);
  if (!ttfMatch) throw new Error("Could not parse TTF URL from Fontshare CSS");
  const ttfUrl = `https:${ttfMatch[1]}`;
  console.log(`  → ${ttfUrl}`);
  const fontRes = await fetch(ttfUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  const ttf = Buffer.from(await fontRes.arrayBuffer());
  writeFileSync(TTF_PATH, ttf);
  console.log(`  wrote ${TTF_PATH} (${ttf.length} bytes)`);
  return ttf;
}

const ttf = await ensureFont();
const font = opentype.parse(
  ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength)
);

// --- Mark (lifted from the chosen logo) -----------------------------------
const markInner = readFileSync(
  "docs/brand/logos/mark-transparent.svg",
  "utf8"
)
  .replace(/^<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");

// --- Text → path -----------------------------------------------------------
// Build the path data ourselves from opentype.js commands. This avoids any
// number-formatting quirks in toPathData() that have caused mid-glyph NaN
// emission in some versions of opentype.js.
function commandsToD(commands) {
  return commands
    .map((c) => {
      const n = (v) => (Number.isFinite(v) ? v.toFixed(2) : "0");
      switch (c.type) {
        case "M":
          return `M${n(c.x)} ${n(c.y)}`;
        case "L":
          return `L${n(c.x)} ${n(c.y)}`;
        case "Q":
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case "C":
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        case "Z":
          return "Z";
        default:
          return "";
      }
    })
    .join(" ");
}

const TEXT = "AuditHalo";
const FONT_SIZE = 100;
const opentypePath = font.getPath(TEXT, 0, 0, FONT_SIZE);
const textPathData = commandsToD(opentypePath.commands);
const tbb = opentypePath.getBoundingBox();
const textWidth = tbb.x2 - tbb.x1;
const textHeight = tbb.y2 - tbb.y1;

// --- Compose horizontal wordmark ------------------------------------------
// We use the mark's tight content bounds (40..160 in its native viewBox) by
// reparenting it inside a group with translate(-40,-40) so its effective
// origin is (0,0) and it occupies exactly 120 native units of space.
const MARK_NATIVE = 120; // tight bounds 40..160
const TARGET_MARK_PX = 240; // visual size of the mark in the composed canvas
const markScale = TARGET_MARK_PX / MARK_NATIVE;

// Text cap height should sit a bit BELOW the mark height so the mark reads
// as the dominant element of the lockup.
const TARGET_TEXT_HEIGHT = TARGET_MARK_PX * 0.55;
const textScale = TARGET_TEXT_HEIGHT / textHeight;

const GAP = TARGET_MARK_PX * 0.18;
const textRenderWidth = textWidth * textScale;
const totalWidth = TARGET_MARK_PX + GAP + textRenderWidth;
const totalHeight = TARGET_MARK_PX;

// Vertically center the text on the mark center
const markCenterY = TARGET_MARK_PX / 2;
const textTopY = markCenterY - TARGET_TEXT_HEIGHT / 2;
const textTx = TARGET_MARK_PX + GAP - tbb.x1 * textScale;
const textTy = textTopY - tbb.y1 * textScale;

const composedTransparent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${totalHeight.toFixed(2)}" width="${totalWidth.toFixed(0)}" height="${totalHeight.toFixed(0)}">
  <g transform="scale(${markScale.toFixed(4)}) translate(-40 -40)">${markInner}</g>
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
console.log(
  `Wrote wordmark-horizontal.svg  (viewBox ${totalWidth.toFixed(0)}×${totalHeight.toFixed(0)})`
);

// --- Export PNG variants ---------------------------------------------------
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
