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

/** Pill label beside the time, e.g. "Ava V." or "Group (4)". */
export function pillLabel(event: CalendarEvent): string {
  if (event.sessionType === "group") {
    const n = event.groupAttendees;
    return typeof n === "number" && n > 0 ? `Group (${n})` : "Group";
  }
  const parts = (event.superviseeName ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const lastInitial =
    parts.length > 1 ? (parts[parts.length - 1]![0] ?? "").toUpperCase() : "";
  const out = lastInitial ? `${first} ${lastInitial}.` : first;
  return out || "Session";
}

/**
 * CSS class string for the colored block in week / month views. The
 * color encodes session TYPE (yellow = individual, sage = group); the
 * status overlays a left-border + ring/opacity treatment on top so a
 * glance tells you both.
 */
export function blockClasses(event: CalendarEvent, now: number): string {
  const type = event.sessionType === "group" ? "group" : "individual";
  const s = visualStatusFor(event, now);
  return [typeBase(type), statusOverlay(s)].filter(Boolean).join(" ");
}

function typeBase(type: "individual" | "group"): string {
  if (type === "group") {
    return "bg-[color:var(--sage-500)]/15 border-l-[color:var(--sage-500)] text-[color:var(--text-primary)]";
  }
  return "bg-[color:var(--halo-yellow)]/15 border-l-[color:var(--halo-yellow)] text-[color:var(--text-primary)]";
}

function statusOverlay(status: ReturnType<typeof visualStatusFor>): string {
  switch (status) {
    case "scheduled":
      return "";
    case "starts_soon":
      return "ring-1 ring-[color:var(--warn-500)]/40";
    case "happening_now":
      return "ring-1 ring-[color:var(--warn-500)] motion-safe:animate-pulse";
    case "completed_pending_sign":
      return "!border-l-[color:var(--warn-500)] opacity-80";
    case "signed":
      return "!border-l-[color:var(--seal-gold)]";
    case "canceled":
      return "opacity-55 grayscale [&_time]:line-through";
    case "no_show":
      return "border-dashed !border-l-[color:var(--risk-600)] opacity-70";
  }
}
