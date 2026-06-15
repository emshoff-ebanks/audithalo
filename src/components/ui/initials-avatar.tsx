import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

// Picked from the brand palette CSS vars so the avatar color reads as part
// of the system, not an island. Order matters — the first colors get the
// most-common name initials.
const PALETTE = [
  "bg-[color:var(--color-secondary)] text-white",
  "bg-[color:var(--color-gold)] text-foreground",
  "bg-[color:var(--color-primary)] text-white",
  "bg-[color:var(--color-success)] text-white",
  "bg-[color:var(--color-warning)] text-white",
  "bg-[color:var(--color-risk)] text-white",
];

/** Sum char codes mod palette length — deterministic per name so a user's
 *  avatar color is stable across sessions. */
function colorForName(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return PALETTE[sum % PALETTE.length];
}

/** Pull at most two letters: first letter of first word + first letter of
 *  last word. Falls back to first two characters when there's only one
 *  word, and "?" when the name is empty. Email-style names ("a@b.com")
 *  use the local part before @. */
export function initialsFor(rawName: string): string {
  const name = rawName.trim();
  if (!name) return "?";
  const localPart = name.includes("@") ? name.split("@")[0] : name;
  const words = localPart
    .split(/[\s._-]+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

type Props = {
  name: string;
  size?: Size;
  className?: string;
};

export function InitialsAvatar({ name, size = "md", className }: Props) {
  const initials = initialsFor(name);
  const color = colorForName(name);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold select-none",
        SIZE_CLASSES[size],
        color,
        className
      )}
    >
      {initials}
    </span>
  );
}
