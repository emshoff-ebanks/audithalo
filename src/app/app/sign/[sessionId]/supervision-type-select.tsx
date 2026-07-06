"use client";

import { useTransition } from "react";
import { updateSupervisionTypeAction } from "@/app/actions/clinical-form";
import { SUPERVISION_TYPE_LABELS } from "@/lib/clinical-form/constants";
import { SUPERVISION_TYPES } from "@/lib/db/schema";

type Props = {
  sessionEventId: string;
  currentValue: string | null;
  disabled?: boolean;
};

export function SupervisionTypeSelect({
  sessionEventId,
  currentValue,
  disabled,
}: Props) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (!value) return;
    startTransition(async () => {
      await updateSupervisionTypeAction({
        sessionEventId,
        supervisionType: value as (typeof SUPERVISION_TYPES)[number],
      });
    });
  }

  return (
    <select
      value={currentValue ?? ""}
      onChange={handleChange}
      disabled={disabled || isPending}
      className="flex h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="">Select supervision type...</option>
      {SUPERVISION_TYPES.map((key) => (
        <option key={key} value={key}>
          {SUPERVISION_TYPE_LABELS[key] ?? key}
        </option>
      ))}
    </select>
  );
}
