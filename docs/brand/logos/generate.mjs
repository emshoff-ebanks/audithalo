// Generate SVG logo concept files for AuditHalo brand exploration.
// Two directions, multiple variations each.
//
// Run: node docs/brand/logos/generate.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const GOLD = "#B8860B";
const BG = "#FAFAF7";

const TAU = Math.PI * 2;
const cx = 100;
const cy = 100;

const SIZE = 200;

function svgWrap(inner, { transparent = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  ${transparent ? "" : `<rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>`}
  ${inner}
</svg>
`;
}

/**
 * Sound-Wave Halo concept
 * @param {Object} opts
 * @param {number} opts.tickCount
 * @param {number} opts.innerRadius
 * @param {number} opts.outerBase
 * @param {number} opts.amplitude   peak audio-waveform variation
 * @param {number} opts.harmonicA   primary cycle count around the ring
 * @param {number} opts.harmonicB   secondary cycle count
 * @param {number} opts.strokeWidth
 */
function soundWaveHalo({
  tickCount = 60,
  innerRadius = 58,
  outerBase = 62,
  amplitude = 3,
  harmonicA = 5,
  harmonicB = 11,
  strokeWidth = 1.4,
}) {
  let body = `<g stroke="${GOLD}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none">\n`;
  for (let i = 0; i < tickCount; i++) {
    const angle = (i / tickCount) * TAU - Math.PI / 2; // start at top
    const wave =
      amplitude *
      (0.55 * Math.sin(angle * harmonicA) +
        0.35 * Math.sin(angle * harmonicB + 0.6) +
        0.25 * Math.sin(angle * (harmonicA + harmonicB) * 0.5));
    const outer = outerBase + wave;
    const x1 = cx + innerRadius * Math.cos(angle);
    const y1 = cy + innerRadius * Math.sin(angle);
    const x2 = cx + outer * Math.cos(angle);
    const y2 = cy + outer * Math.sin(angle);
    body += `  <line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>\n`;
  }
  body += `</g>\n`;
  return svgWrap(body);
}

/**
 * 22° Halo concept — perfect ring with an off-center "sun-dog" dot
 * @param {Object} opts
 * @param {number} opts.ringRadius
 * @param {number} opts.ringStroke
 * @param {number} opts.dotAngleDeg  angle of sun-dog (0° = 3 o'clock, CCW)
 * @param {number} opts.dotDistance  how far outside the ring the dot sits (in px from ring path)
 * @param {number} opts.dotRadius
 * @param {boolean} opts.parhelia     show a second sun-dog (parhelion pair)
 */
function halo22({
  ringRadius = 50,
  ringStroke = 2,
  dotAngleDeg = 200, // ~8 o'clock
  dotDistance = 12,
  dotRadius = 5,
  parhelia = false,
}) {
  const angle = (dotAngleDeg * Math.PI) / 180;
  const dotX = cx + (ringRadius + dotDistance) * Math.cos(angle);
  const dotY = cy + (ringRadius + dotDistance) * Math.sin(angle);

  let parts = `
  <circle cx="${cx}" cy="${cy}" r="${ringRadius}" fill="none" stroke="${GOLD}" stroke-width="${ringStroke}"/>
  <circle cx="${dotX.toFixed(2)}" cy="${dotY.toFixed(2)}" r="${dotRadius}" fill="${GOLD}"/>
`;

  if (parhelia) {
    // Reflect dot across the vertical axis of the ring center for the parhelion pair
    const mirrorAngle = Math.PI - angle;
    const dot2X = cx + (ringRadius + dotDistance) * Math.cos(mirrorAngle);
    const dot2Y = cy + (ringRadius + dotDistance) * Math.sin(mirrorAngle);
    parts += `  <circle cx="${dot2X.toFixed(2)}" cy="${dot2Y.toFixed(2)}" r="${dotRadius}" fill="${GOLD}"/>\n`;
  }

  return svgWrap(parts);
}

const outDir = "docs/brand/logos";
mkdirSync(dirname(outDir + "/x"), { recursive: true });

/**
 * Solid wavy halo + 22° sun-dog — the chosen direction, now as a single
 * filled annulus instead of discrete ticks. Outer edge oscillates with the
 * audire-waveform function; inner edge is a perfect circle. A background-
 * colored knockout punches a clean gap for the dot.
 */
function solidWavyHaloOnLine({
  innerRadius = 35,
  outerBase = 42,
  amplitude = 3,
  harmonicA = 5,
  harmonicB = 11,
  samples = 360,
  dotAngleDeg = -68,
  dotRadius = 10,
  knockoutPad = 5,
  transparent = false,
}) {
  // Outer wavy edge as a polyline approximating the smooth waveform
  let outer = "";
  for (let i = 0; i <= samples; i++) {
    const angle = (i / samples) * TAU - Math.PI / 2;
    const wave =
      amplitude *
      (0.55 * Math.sin(angle * harmonicA) +
        0.35 * Math.sin(angle * harmonicB + 0.6) +
        0.25 * Math.sin(angle * (harmonicA + harmonicB) * 0.5));
    const r = outerBase + wave;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    outer += (i === 0 ? "M" : "L") + ` ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  outer += "Z";

  // Inner perfect circle (counterclockwise via two arcs so evenodd makes it a hole)
  const inner =
    `M ${cx + innerRadius} ${cy} ` +
    `A ${innerRadius} ${innerRadius} 0 1 0 ${cx - innerRadius} ${cy} ` +
    `A ${innerRadius} ${innerRadius} 0 1 0 ${cx + innerRadius} ${cy} Z`;

  // Sun-dog on the ring midline
  const ringMidRadius = (innerRadius + outerBase) / 2;
  const dotAngleRad = (dotAngleDeg * Math.PI) / 180;
  const dotX = cx + ringMidRadius * Math.cos(dotAngleRad);
  const dotY = cy + ringMidRadius * Math.sin(dotAngleRad);
  const knockoutRadius = dotRadius + knockoutPad;

  // SVG <mask> punches a real hole in the ring at the dot position. White in
  // the mask = visible; black = transparent. This makes the gap around the dot
  // truly empty space, not a background-color filled circle — so the logo works
  // on ANY surface (transparent PNG, navy header, photo background, etc.).
  const maskId = "aud-knockout";
  let body = `<defs>
    <mask id="${maskId}" maskUnits="userSpaceOnUse">
      <rect x="-1000" y="-1000" width="2200" height="2200" fill="white"/>
      <circle cx="${dotX.toFixed(2)}" cy="${dotY.toFixed(2)}" r="${knockoutRadius}" fill="black"/>
    </mask>
  </defs>
  <path d="${outer} ${inner}" fill="${GOLD}" fill-rule="evenodd" mask="url(#${maskId})"/>
  <circle cx="${dotX.toFixed(2)}" cy="${dotY.toFixed(2)}" r="${dotRadius}" fill="${GOLD}"/>
`;

  return svgWrap(body, { transparent });
}

/**
 * Hybrid On-Line — Sound-Wave Halo + 22° sun-dog placed ON the ring with a
 * background-colored knockout that prevents the ticks from touching the dot.
 * The dot becomes part of the ring, not a satellite of it.
 */
function soundWaveHaloOnLine({
  tickCount = 60,
  innerRadius = 50,
  outerBase = 54,
  amplitude = 2.5,
  harmonicA = 5,
  harmonicB = 11,
  strokeWidth = 1.4,
  dotAngleDeg = -68,    // 22° clockwise from 12 o'clock
  dotRadius = 8,
  knockoutPad = 4,       // gap between ring ticks and the dot
}) {
  const ringMidRadius = (innerRadius + outerBase) / 2;
  const dotAngleRad = (dotAngleDeg * Math.PI) / 180;

  // Angular range to suppress ticks (so they don't run into the knockout)
  const knockoutRadius = dotRadius + knockoutPad;
  const knockoutAngleHalfRad =
    Math.atan2(knockoutRadius, ringMidRadius);

  let body = `<g stroke="${GOLD}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none">\n`;
  for (let i = 0; i < tickCount; i++) {
    const angle = (i / tickCount) * TAU - Math.PI / 2;
    // Skip ticks that fall inside the knockout's angular range
    let delta = angle - dotAngleRad;
    while (delta > Math.PI) delta -= TAU;
    while (delta < -Math.PI) delta += TAU;
    if (Math.abs(delta) < knockoutAngleHalfRad) continue;

    const wave =
      amplitude *
      (0.55 * Math.sin(angle * harmonicA) +
        0.35 * Math.sin(angle * harmonicB + 0.6) +
        0.25 * Math.sin(angle * (harmonicA + harmonicB) * 0.5));
    const outer = outerBase + wave;
    const x1 = cx + innerRadius * Math.cos(angle);
    const y1 = cy + innerRadius * Math.sin(angle);
    const x2 = cx + outer * Math.cos(angle);
    const y2 = cy + outer * Math.sin(angle);
    body += `  <line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>\n`;
  }
  body += `</g>\n`;

  // The sun-dog sits centered on the ring path
  const dotX = cx + ringMidRadius * Math.cos(dotAngleRad);
  const dotY = cy + ringMidRadius * Math.sin(dotAngleRad);

  // Background knockout (slightly larger than the dot) — enforces the gap
  body += `<circle cx="${dotX.toFixed(2)}" cy="${dotY.toFixed(2)}" r="${knockoutRadius}" fill="${BG}"/>\n`;
  // The dot itself
  body += `<circle cx="${dotX.toFixed(2)}" cy="${dotY.toFixed(2)}" r="${dotRadius}" fill="${GOLD}"/>\n`;

  return svgWrap(body);
}

/**
 * Hybrid — Sound-Wave Halo + 22° sun-dog (original, dot outside ring)
 */
function soundWaveHalo22({
  tickCount = 60,
  innerRadius = 50,
  outerBase = 54,
  amplitude = 2.5,
  harmonicA = 5,
  harmonicB = 11,
  strokeWidth = 1.4,
  dotAngleDeg = 200, // 8 o'clock (SVG y-down convention)
  dotDistance = 12,
  dotRadius = 5,
  parhelia = false,
}) {
  // Sound-wave ring
  let body = `<g stroke="${GOLD}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none">\n`;
  for (let i = 0; i < tickCount; i++) {
    const angle = (i / tickCount) * TAU - Math.PI / 2;
    const wave =
      amplitude *
      (0.55 * Math.sin(angle * harmonicA) +
        0.35 * Math.sin(angle * harmonicB + 0.6) +
        0.25 * Math.sin(angle * (harmonicA + harmonicB) * 0.5));
    const outer = outerBase + wave;
    const x1 = cx + innerRadius * Math.cos(angle);
    const y1 = cy + innerRadius * Math.sin(angle);
    const x2 = cx + outer * Math.cos(angle);
    const y2 = cy + outer * Math.sin(angle);
    body += `  <line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>\n`;
  }
  body += `</g>\n`;

  // Sun-dog(s)
  const ringOuterApprox = outerBase + amplitude;
  const angle = (dotAngleDeg * Math.PI) / 180;
  const dotX = cx + (ringOuterApprox + dotDistance) * Math.cos(angle);
  const dotY = cy + (ringOuterApprox + dotDistance) * Math.sin(angle);
  body += `<circle cx="${dotX.toFixed(2)}" cy="${dotY.toFixed(2)}" r="${dotRadius}" fill="${GOLD}"/>\n`;

  if (parhelia) {
    const mirrorAngle = Math.PI - angle;
    const dot2X = cx + (ringOuterApprox + dotDistance) * Math.cos(mirrorAngle);
    const dot2Y = cy + (ringOuterApprox + dotDistance) * Math.sin(mirrorAngle);
    body += `<circle cx="${dot2X.toFixed(2)}" cy="${dot2Y.toFixed(2)}" r="${dotRadius}" fill="${GOLD}"/>\n`;
  }

  return svgWrap(body);
}

const concepts = [
  // Sound-Wave Halo variations
  {
    file: "soundwave-a-subtle.svg",
    label: "Sound-Wave A — subtle (48 ticks, gentle variation)",
    svg: soundWaveHalo({
      tickCount: 48,
      amplitude: 2,
      harmonicA: 4,
      harmonicB: 9,
      strokeWidth: 1.4,
    }),
  },
  {
    file: "soundwave-b-balanced.svg",
    label: "Sound-Wave B — balanced (60 ticks, clear waveform feel)",
    svg: soundWaveHalo({
      tickCount: 60,
      amplitude: 3,
      harmonicA: 5,
      harmonicB: 11,
      strokeWidth: 1.4,
    }),
  },
  {
    file: "soundwave-c-dense.svg",
    label: "Sound-Wave C — dense (84 ticks, very fine — favicon-strong)",
    svg: soundWaveHalo({
      tickCount: 84,
      amplitude: 2.5,
      harmonicA: 6,
      harmonicB: 13,
      strokeWidth: 1.0,
    }),
  },
  // 22° Halo variations
  {
    file: "halo22-a-classic.svg",
    label: "22° A — classic (ring + single sun-dog at 8 o'clock)",
    svg: halo22({
      ringRadius: 50,
      ringStroke: 2,
      dotAngleDeg: 200,
      dotDistance: 14,
      dotRadius: 6,
    }),
  },
  {
    file: "halo22-b-parhelia.svg",
    label: "22° B — parhelia (ring + two sun-dogs, symmetric)",
    svg: halo22({
      ringRadius: 50,
      ringStroke: 2,
      dotAngleDeg: 200,
      dotDistance: 14,
      dotRadius: 6,
      parhelia: true,
    }),
  },
  {
    file: "halo22-c-thin-tight.svg",
    label: "22° C — minimal (hair-thin ring + tighter sun-dog placement)",
    svg: halo22({
      ringRadius: 52,
      ringStroke: 1.25,
      dotAngleDeg: 200,
      dotDistance: 9,
      dotRadius: 4.5,
    }),
  },
  // Hybrid — Sound-Wave Halo + 22° sun-dog (the fusion)
  {
    file: "hybrid-a-balanced.svg",
    label: "Hybrid A — balanced (60-tick waveform ring + sun-dog at 8 o'clock)",
    svg: soundWaveHalo22({
      tickCount: 60,
      innerRadius: 50,
      outerBase: 54,
      amplitude: 2.5,
      harmonicA: 5,
      harmonicB: 11,
      strokeWidth: 1.4,
      dotAngleDeg: 200,
      dotDistance: 12,
      dotRadius: 5,
    }),
  },
  {
    file: "hybrid-b-dense-tight.svg",
    label: "Hybrid B — dense ring + tight sun-dog (favicon-strong, tighter composition)",
    svg: soundWaveHalo22({
      tickCount: 84,
      innerRadius: 52,
      outerBase: 55,
      amplitude: 2,
      harmonicA: 6,
      harmonicB: 13,
      strokeWidth: 1.1,
      dotAngleDeg: 200,
      dotDistance: 9,
      dotRadius: 4.5,
    }),
  },
  {
    file: "hybrid-c-22deg-from-top.svg",
    label: "Hybrid C — sun-dog at exact 22° clockwise from 12 o'clock (poetic literalism)",
    svg: soundWaveHalo22({
      tickCount: 60,
      innerRadius: 50,
      outerBase: 54,
      amplitude: 2.5,
      harmonicA: 5,
      harmonicB: 11,
      strokeWidth: 1.4,
      // SVG: 0° = 3 o'clock, clockwise. 22° clockwise from 12 o'clock = -90° + 22° = -68°.
      dotAngleDeg: -68,
      dotDistance: 12,
      dotRadius: 5,
    }),
  },
  {
    file: "hybrid-d-parhelia.svg",
    label: "Hybrid D — waveform ring + parhelion pair (both metaphors maxed)",
    svg: soundWaveHalo22({
      tickCount: 60,
      innerRadius: 50,
      outerBase: 54,
      amplitude: 2.5,
      harmonicA: 5,
      harmonicB: 11,
      strokeWidth: 1.4,
      dotAngleDeg: 200,
      dotDistance: 12,
      dotRadius: 5,
      parhelia: true,
    }),
  },
  // Hybrid C iterations — dot on the ring at 22°, with knockout gap so ticks
  // don't touch the dot. Three size/gap variations for Damon to pick from.
  {
    file: "hybrid-c2-a-tight.svg",
    label: "Hybrid C2a — dot on line at 22°, smaller dot (r=7), tight 3px gap",
    svg: soundWaveHaloOnLine({
      tickCount: 60,
      innerRadius: 50,
      outerBase: 54,
      amplitude: 2.5,
      harmonicA: 5,
      harmonicB: 11,
      strokeWidth: 1.4,
      dotAngleDeg: -68,
      dotRadius: 7,
      knockoutPad: 3,
    }),
  },
  {
    file: "hybrid-c2-b-balanced.svg",
    label: "Hybrid C2b — dot on line at 22°, medium dot (r=8), 4px gap (recommended baseline)",
    svg: soundWaveHaloOnLine({
      tickCount: 60,
      innerRadius: 50,
      outerBase: 54,
      amplitude: 2.5,
      harmonicA: 5,
      harmonicB: 11,
      strokeWidth: 1.4,
      dotAngleDeg: -68,
      dotRadius: 8,
      knockoutPad: 4,
    }),
  },
  {
    file: "hybrid-c2-c-bold.svg",
    label: "Hybrid C2c — dot on line at 22°, bold dot (r=10), generous 5px gap",
    svg: soundWaveHaloOnLine({
      tickCount: 60,
      innerRadius: 50,
      outerBase: 54,
      amplitude: 2.5,
      harmonicA: 5,
      harmonicB: 11,
      strokeWidth: 1.4,
      dotAngleDeg: -68,
      dotRadius: 10,
      knockoutPad: 5,
    }),
  },
  // Hybrid C3 iterations — shrink the ring so the dot dominates more.
  // Keep dot r=10 + 5px knockout from C2c. Three ring sizes to compare.
  {
    file: "hybrid-c3-a-slight.svg",
    label: "Hybrid C3a — slight shrink (ring inner 44 / outer 48)",
    svg: soundWaveHaloOnLine({
      tickCount: 56,
      innerRadius: 44,
      outerBase: 48,
      amplitude: 2.2,
      harmonicA: 5,
      harmonicB: 11,
      strokeWidth: 1.4,
      dotAngleDeg: -68,
      dotRadius: 10,
      knockoutPad: 5,
    }),
  },
  {
    file: "hybrid-c3-b-medium.svg",
    label: "Hybrid C3b — medium shrink (ring inner 40 / outer 44)",
    svg: soundWaveHaloOnLine({
      tickCount: 52,
      innerRadius: 40,
      outerBase: 44,
      amplitude: 2,
      harmonicA: 5,
      harmonicB: 11,
      strokeWidth: 1.3,
      dotAngleDeg: -68,
      dotRadius: 10,
      knockoutPad: 5,
    }),
  },
  {
    file: "hybrid-c3-c-dramatic.svg",
    label: "Hybrid C3c — dramatic shrink (ring inner 36 / outer 40, dot dominates)",
    svg: soundWaveHaloOnLine({
      tickCount: 48,
      innerRadius: 36,
      outerBase: 40,
      amplitude: 1.8,
      harmonicA: 4,
      harmonicB: 9,
      strokeWidth: 1.3,
      dotAngleDeg: -68,
      dotRadius: 10,
      knockoutPad: 5,
    }),
  },
  // Hybrid C4 iterations — keep C3c geometry but pump the waveform amplitude
  // so the audio character is clearly readable, not subtle.
  {
    file: "hybrid-c4-a-clear.svg",
    label: "Hybrid C4a — clear waveform (amplitude 3, tick lengths 4-10)",
    svg: soundWaveHaloOnLine({
      tickCount: 48,
      innerRadius: 35,
      outerBase: 42,
      amplitude: 3,
      harmonicA: 5,
      harmonicB: 11,
      strokeWidth: 1.3,
      dotAngleDeg: -68,
      dotRadius: 10,
      knockoutPad: 5,
    }),
  },
  {
    file: "hybrid-c4-b-pronounced.svg",
    label: "Hybrid C4b — pronounced waveform (amplitude 4, 40 ticks, slower beats)",
    svg: soundWaveHaloOnLine({
      tickCount: 40,
      innerRadius: 33,
      outerBase: 43,
      amplitude: 4,
      harmonicA: 4,
      harmonicB: 9,
      strokeWidth: 1.3,
      dotAngleDeg: -68,
      dotRadius: 10,
      knockoutPad: 5,
    }),
  },
  {
    file: "hybrid-c4-c-bold.svg",
    label: "Hybrid C4c — bold waveform (amplitude 5, 36 ticks, big beats — unmistakable audio character)",
    svg: soundWaveHaloOnLine({
      tickCount: 36,
      innerRadius: 31,
      outerBase: 44,
      amplitude: 5,
      harmonicA: 3,
      harmonicB: 7,
      strokeWidth: 1.4,
      dotAngleDeg: -68,
      dotRadius: 10,
      knockoutPad: 5,
    }),
  },
  // Solid wavy ring variants — same waveform character, but as a continuous
  // filled annulus rather than discrete ticks (no gaps). Three amplitudes.
  {
    file: "hybrid-solid-a-subtle.svg",
    label: "Solid A — subtle wave (amplitude 2). Looks like a slightly textured ring.",
    svg: solidWavyHaloOnLine({
      innerRadius: 35,
      outerBase: 42,
      amplitude: 2,
      harmonicA: 5,
      harmonicB: 11,
      dotAngleDeg: -68,
      dotRadius: 10,
      knockoutPad: 5,
    }),
  },
  {
    file: "mark-transparent.svg",
    label: "Solid A — TRANSPARENT BG. The official mark, ready for any surface.",
    svg: solidWavyHaloOnLine({
      innerRadius: 35,
      outerBase: 42,
      amplitude: 2,
      harmonicA: 5,
      harmonicB: 11,
      dotAngleDeg: -68,
      dotRadius: 10,
      knockoutPad: 5,
      transparent: true,
    }),
  },
  {
    file: "hybrid-solid-b-clear.svg",
    label: "Solid B — clear wave (amplitude 3, matches C4a's waveform exactly).",
    svg: solidWavyHaloOnLine({
      innerRadius: 35,
      outerBase: 42,
      amplitude: 3,
      harmonicA: 5,
      harmonicB: 11,
      dotAngleDeg: -68,
      dotRadius: 10,
      knockoutPad: 5,
    }),
  },
  {
    file: "hybrid-solid-c-pronounced.svg",
    label: "Solid C — pronounced wave (amplitude 4, slower harmonics). More dramatic outer-edge wobble.",
    svg: solidWavyHaloOnLine({
      innerRadius: 33,
      outerBase: 43,
      amplitude: 4,
      harmonicA: 4,
      harmonicB: 9,
      dotAngleDeg: -68,
      dotRadius: 10,
      knockoutPad: 5,
    }),
  },
];

for (const c of concepts) {
  writeFileSync(`${outDir}/${c.file}`, c.svg);
  console.log(`Wrote ${outDir}/${c.file}  —  ${c.label}`);
}
