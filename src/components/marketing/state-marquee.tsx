/**
 * Trust-row marquee of state-credential pills. Pure-CSS scroll (see globals.css
 * .mkt-marquee): 32s linear, pauses on hover, halts under prefers-reduced-motion.
 * The list is duplicated so the -50% keyframe loops seamlessly.
 */
export function StateMarquee({
  items,
}: {
  items: { code: string; license: string }[];
}) {
  return (
    <div className="mkt-marquee" aria-label="Supported state boards">
      <div className="mkt-marquee-track">
        {[...items, ...items].map((s, i) => (
          <span
            key={`${s.code}-${i}`}
            aria-hidden={i >= items.length}
            className="flex-none rounded-full border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] px-2.5 py-1 font-mono text-xs text-[color:var(--ink-600)]"
          >
            {s.code} · {s.license}
          </span>
        ))}
      </div>
    </div>
  );
}
