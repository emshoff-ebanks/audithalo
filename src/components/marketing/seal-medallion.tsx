/**
 * The AuditHalo seal medallion — concentric seal-gold rings + check.
 * Reserved for sealed/verified evidence chrome only (design-system-v2.md §1.1).
 * Used on the hero proof card and the public verify page.
 */
export function SealMedallion({ size = 56 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="32" cy="32" r="28" fill="none" stroke="var(--seal-gold)" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="var(--seal-gold)" strokeWidth="0.5" />
      <path
        d="M22 32 l7 7 l14 -16"
        fill="none"
        stroke="var(--seal-gold)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
