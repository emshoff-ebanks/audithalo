import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** SVG fill for the gold ring + dot. Defaults to currentColor so parents can color via Tailwind text-* class. */
  color?: string;
  /** Knockout color — must match the surface the mark sits on. Defaults to var(--color-background). */
  bg?: string;
  title?: string;
};

export function AuditHaloMark({
  className,
  color = "currentColor",
  bg = "var(--color-background)",
  title = "AuditHalo",
}: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="40 40 120 120"
      role="img"
      aria-label={title}
      className={cn("h-7 w-7 text-[color:var(--color-gold)]", className)}
    >
      <g
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
        fill="none"
      >
        <line x1="100.00" y1="65.00" x2="100.00" y2="58.78" />
        <line x1="124.75" y1="75.25" x2="129.79" y2="70.21" />
        <line x1="127.77" y1="78.69" x2="133.75" y2="74.10" />
        <line x1="130.31" y1="82.50" x2="137.04" y2="78.61" />
        <line x1="132.34" y1="86.61" x2="137.92" y2="84.29" />
        <line x1="133.81" y1="90.94" x2="137.63" y2="89.92" />
        <line x1="134.70" y1="95.43" x2="139.23" y2="94.84" />
        <line x1="135.00" y1="100.00" x2="142.59" y2="100.00" />
        <line x1="134.70" y1="104.57" x2="144.21" y2="105.82" />
        <line x1="133.81" y1="109.06" x2="142.40" y2="111.36" />
        <line x1="132.34" y1="113.39" x2="139.26" y2="116.26" />
        <line x1="130.31" y1="117.50" x2="136.59" y2="121.13" />
        <line x1="127.77" y1="121.31" x2="133.47" y2="125.68" />
        <line x1="124.75" y1="124.75" x2="129.01" y2="129.01" />
        <line x1="121.31" y1="127.77" x2="124.36" y2="131.75" />
        <line x1="117.50" y1="130.31" x2="120.38" y2="135.30" />
        <line x1="113.39" y1="132.34" x2="116.17" y2="139.03" />
        <line x1="109.06" y1="133.81" x2="110.99" y2="141.01" />
        <line x1="104.57" y1="134.70" x2="105.48" y2="141.60" />
        <line x1="100.00" y1="135.00" x2="100.00" y2="142.78" />
        <line x1="95.43" y1="134.70" x2="94.20" y2="144.05" />
        <line x1="90.94" y1="133.81" x2="88.59" y2="142.57" />
        <line x1="86.61" y1="132.34" x2="84.25" y2="138.02" />
        <line x1="82.50" y1="130.31" x2="80.56" y2="133.67" />
        <line x1="78.69" y1="127.77" x2="75.86" y2="131.46" />
        <line x1="75.25" y1="124.75" x2="70.40" y2="129.60" />
        <line x1="72.23" y1="121.31" x2="66.08" y2="126.03" />
        <line x1="69.69" y1="117.50" x2="63.17" y2="121.26" />
        <line x1="67.66" y1="113.39" x2="60.32" y2="116.44" />
        <line x1="66.19" y1="109.06" x2="57.75" y2="111.32" />
        <line x1="65.30" y1="104.57" x2="57.23" y2="105.63" />
        <line x1="65.00" y1="100.00" x2="58.59" y2="100.00" />
        <line x1="65.30" y1="95.43" x2="59.64" y2="94.69" />
        <line x1="66.19" y1="90.94" x2="60.01" y2="89.28" />
        <line x1="67.66" y1="86.61" x2="61.66" y2="84.12" />
        <line x1="69.69" y1="82.50" x2="64.97" y2="79.78" />
        <line x1="72.23" y1="78.69" x2="67.86" y2="75.33" />
        <line x1="75.25" y1="75.25" x2="69.61" y2="69.61" />
        <line x1="78.69" y1="72.23" x2="72.43" y2="64.07" />
        <line x1="82.50" y1="69.69" x2="77.73" y2="61.43" />
        <line x1="86.61" y1="67.66" x2="84.02" y2="61.43" />
        <line x1="90.94" y1="66.19" x2="89.59" y2="61.13" />
        <line x1="95.43" y1="65.30" x2="94.68" y2="59.61" />
      </g>
      <circle cx="114.42" cy="64.30" r="15" fill={bg} />
      <circle cx="114.42" cy="64.30" r="10" fill={color} />
    </svg>
  );
}

export function AuditHaloWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <AuditHaloMark className="h-7 w-7 text-[color:var(--color-gold)]" />
      <span className="font-display text-xl font-bold text-foreground tracking-tight">
        AuditHalo
      </span>
    </span>
  );
}
