"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { HeaderActionPortal } from "@/components/app/shell/header-action-portal";
import { LogHoursModal } from "./_log-hours-modal";

/**
 * The page's single halo-yellow CTA: portals a "+ Log practice hours" button
 * into the global header slot and owns the LogHoursModal open state.
 */
export function LogHoursHeaderAction({ superviseeId }: { superviseeId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <HeaderActionPortal>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-[8px] bg-[color:var(--halo-yellow)] px-3.5 h-9 text-sm font-semibold text-[color:var(--ink-900)] hover:bg-[color:var(--halo-yellow-hover)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--halo-yellow)]"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Log practice hours
        </button>
      </HeaderActionPortal>

      {open && (
        <LogHoursModal superviseeId={superviseeId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
