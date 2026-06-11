import { Badge } from "@/components/ui/badge";
import { visualStatusFor, type CalendarEvent } from "./_types";

const LABEL: Record<ReturnType<typeof visualStatusFor>, string> = {
  scheduled: "Scheduled",
  happening_now: "Happening now",
  starts_soon: "Starts soon",
  completed_pending_sign: "Awaiting sign",
  signed: "Signed",
  canceled: "Canceled",
  no_show: "No-show",
};

type StatusBadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const VARIANT: Record<ReturnType<typeof visualStatusFor>, StatusBadgeVariant> =
  {
    scheduled: "outline",
    happening_now: "outline-warn",
    starts_soon: "outline-warn",
    completed_pending_sign: "outline-warn",
    signed: "success",
    canceled: "outline",
    no_show: "outline",
  };

export function EventStatusBadge({
  event,
  now,
}: {
  event: CalendarEvent;
  now: number;
}) {
  const s = visualStatusFor(event, now);
  return (
    <Badge variant={VARIANT[s]} className="capitalize">
      {LABEL[s]}
    </Badge>
  );
}

/**
 * CSS class string for the colored block in week / month views. Maps
 * to the palette in docs/strategy/08 (Halo Blue scheduled, amber for
 * imminent, gold-accented green for signed, etc.).
 */
export function blockClasses(
  event: CalendarEvent,
  now: number
): string {
  const s = visualStatusFor(event, now);
  switch (s) {
    case "scheduled":
      return "bg-secondary/15 border-l-secondary text-foreground";
    case "starts_soon":
      return "bg-[color:var(--color-warning)]/15 border-l-[color:var(--color-warning)] text-foreground";
    case "happening_now":
      return "bg-[color:var(--color-warning)]/20 border-l-[color:var(--color-warning)] text-foreground ring-1 ring-[color:var(--color-warning)] animate-pulse";
    case "completed_pending_sign":
      return "bg-[color:var(--color-warning)]/10 border-l-[color:var(--color-warning)]/80 text-foreground/90";
    case "signed":
      return "bg-[color:var(--color-success)]/15 border-l-[color:var(--color-success)] text-foreground";
    case "canceled":
      return "bg-muted border-l-muted-foreground/30 text-foreground/50 line-through";
    case "no_show":
      return "bg-[color:var(--color-risk)]/10 border-l-[color:var(--color-risk)] border-l-[3px] text-foreground/80 border-dashed";
  }
}
