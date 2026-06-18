"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * 12-hour date/time picker — date input + hour/minute/AM-PM selects.
 *
 * Replaces `<input type="datetime-local">`, whose 12h vs 24h rendering is
 * locked to the OS/browser locale and gave Windows users no AM/PM
 * affordance. This component always shows AM/PM regardless of locale.
 *
 * Output contract: a hidden `<input name={name}>` whose value matches the
 * same `YYYY-MM-DDTHH:mm` shape that `datetime-local` produces (24-hour
 * internal). Server actions and conflict probes that read the field by
 * name keep working with zero change.
 *
 * For change detection in client forms, the component fires `onChange`
 * with the same string on every internal change.
 */

type Props = {
  /** Form field name — value lands here in FormData. */
  name: string;
  /** Initial value in `YYYY-MM-DDTHH:mm` 24h format (same as datetime-local). */
  defaultValue?: string;
  /** Fires whenever the composed datetime string changes. */
  onChange?: (value: string) => void;
  /** Minimum selectable date (YYYY-MM-DD). Hint only — server still validates. */
  minDate?: string;
  /** True disables every control. */
  disabled?: boolean;
  /** Optional id for the date input — labels can target it. */
  id?: string;
};

const MINUTES = ["00", "15", "30", "45"] as const;
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12

/** Convert 24-hour HH to 12-hour { hour: 1-12, meridiem: AM|PM }. */
export function to12h(h24: number): { hour: number; meridiem: "AM" | "PM" } {
  if (h24 === 0) return { hour: 12, meridiem: "AM" };
  if (h24 === 12) return { hour: 12, meridiem: "PM" };
  if (h24 > 12) return { hour: h24 - 12, meridiem: "PM" };
  return { hour: h24, meridiem: "AM" };
}

/** Convert 12-hour pair back to 24-hour HH (0..23). */
export function to24h(hour12: number, meridiem: "AM" | "PM"): number {
  if (meridiem === "AM") {
    return hour12 === 12 ? 0 : hour12;
  }
  return hour12 === 12 ? 12 : hour12 + 12;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function nearestQuarter(min: number): "00" | "15" | "30" | "45" {
  // Round to the nearest 15-min mark — slightly more useful than truncating.
  if (min < 8) return "00";
  if (min < 23) return "15";
  if (min < 38) return "30";
  if (min < 53) return "45";
  return "00"; // 53..59 wraps; the hour bump happens via the default value
}

function parseInitial(defaultValue?: string): {
  date: string;
  hour: number;
  minute: "00" | "15" | "30" | "45";
  meridiem: "AM" | "PM";
} {
  // Format expected: YYYY-MM-DDTHH:mm (datetime-local style).
  const m =
    defaultValue?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/) ?? null;
  if (!m) {
    // No initial — default to today + 1 hour, rounded to next 15.
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
      now.getDate()
    )}`;
    const { hour, meridiem } = to12h(now.getHours());
    return { date, hour, minute: nearestQuarter(now.getMinutes()), meridiem };
  }
  const h24 = parseInt(m[2], 10);
  const minRaw = parseInt(m[3], 10);
  const { hour, meridiem } = to12h(h24);
  return { date: m[1], hour, minute: nearestQuarter(minRaw), meridiem };
}

export function DateTime12h({
  name,
  defaultValue,
  onChange,
  minDate,
  disabled,
  id,
}: Props) {
  const initial = parseInitial(defaultValue);
  const [date, setDate] = useState(initial.date);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState<(typeof MINUTES)[number]>(initial.minute);
  const [meridiem, setMeridiem] = useState<"AM" | "PM">(initial.meridiem);

  const composed = `${date}T${pad2(to24h(hour, meridiem))}:${minute}`;

  useEffect(() => {
    onChange?.(composed);
    // We deliberately only re-fire when the composed value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composed]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        id={id}
        type="date"
        value={date}
        min={minDate}
        onChange={(e) => setDate(e.currentTarget.value)}
        disabled={disabled}
        className="h-11 w-[160px]"
      />
      <select
        value={hour}
        onChange={(e) => setHour(parseInt(e.currentTarget.value, 10))}
        disabled={disabled}
        className="h-11 min-w-[3.25rem] rounded-sm border border-input bg-card px-2 text-sm text-foreground"
        aria-label="Hour"
      >
        {HOURS_12.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-foreground/60 text-sm">:</span>
      <select
        value={minute}
        onChange={(e) =>
          setMinute(e.currentTarget.value as (typeof MINUTES)[number])
        }
        disabled={disabled}
        className="h-11 min-w-[3.25rem] rounded-sm border border-input bg-card px-2 text-sm text-foreground"
        aria-label="Minute"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        value={meridiem}
        onChange={(e) => setMeridiem(e.currentTarget.value as "AM" | "PM")}
        disabled={disabled}
        className="h-11 min-w-[3.75rem] rounded-sm border border-input bg-card px-2 text-sm text-foreground"
        aria-label="AM or PM"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
      {/* Hidden field carries the composed value into FormData under
          the original name. */}
      <input type="hidden" name={name} value={composed} />
    </div>
  );
}
