"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inviteSupervisorAction,
  inviteHrAdminAction,
  inviteExecutiveAction,
  type TeamActionResult,
} from "@/app/actions/team";

// Three small inline forms that share styling. We could collapse to one
// component with a `kind` prop, but the HR Admin form needs an extra TOTP
// field and slightly different button copy + audit messaging — keeping
// them separate reads cleaner.

export function InviteSupervisorForm() {
  const [state, formAction, pending] = useActionState<
    TeamActionResult | undefined,
    FormData
  >(inviteSupervisorAction, undefined);

  if (state?.ok) {
    return (
      <p className="text-sm text-[color:var(--color-success)] bg-[color:var(--color-success)]/8 px-3 py-2 rounded-sm">
        Supervisor invitation sent.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="sup-name">Name (optional)</Label>
          <Input
            id="sup-name"
            name="name"
            type="text"
            autoComplete="off"
            placeholder="Dr. Alex Rivera"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="sup-email">Email</Label>
          <Input
            id="sup-email"
            name="email"
            type="email"
            autoComplete="off"
            required
            placeholder="supervisor@firm.com"
            className="mt-1.5"
          />
        </div>
      </div>
      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send invitation"}
      </Button>
    </form>
  );
}

export function InviteHrAdminForm() {
  const [state, formAction, pending] = useActionState<
    TeamActionResult | undefined,
    FormData
  >(inviteHrAdminAction, undefined);

  if (state?.ok) {
    return (
      <p className="text-sm text-[color:var(--color-success)] bg-[color:var(--color-success)]/8 px-3 py-2 rounded-sm">
        HR Admin invitation sent.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="hra-name">Name (optional)</Label>
          <Input
            id="hra-name"
            name="name"
            type="text"
            autoComplete="off"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="hra-email">Email</Label>
          <Input
            id="hra-email"
            name="email"
            type="email"
            autoComplete="off"
            required
            placeholder="admin@firm.com"
            className="mt-1.5"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="hra-totp">Your 2FA code</Label>
        <Input
          id="hra-totp"
          name="totpCode"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          placeholder="123456"
          className="mt-1.5 font-mono tracking-widest max-w-[200px]"
        />
        <p className="mt-1 text-xs text-foreground/60">
          Inviting another HR Admin is sensitive — confirm with the 6-digit
          code from your authenticator app or an 8-character backup code.
        </p>
      </div>
      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Sending…" : "Invite HR Admin"}
      </Button>
    </form>
  );
}

export function InviteExecutiveForm({ seatsLeft }: { seatsLeft: number }) {
  const [state, formAction, pending] = useActionState<
    TeamActionResult | undefined,
    FormData
  >(inviteExecutiveAction, undefined);

  if (state?.ok) {
    return (
      <p className="text-sm text-[color:var(--color-success)] bg-[color:var(--color-success)]/8 px-3 py-2 rounded-sm">
        Executive invitation sent.
      </p>
    );
  }

  if (seatsLeft <= 0) {
    return (
      <p className="text-sm text-foreground/60">
        Executive seat cap reached. Deactivate an existing executive to free a
        seat.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="exec-name">Name (optional)</Label>
          <Input
            id="exec-name"
            name="name"
            type="text"
            autoComplete="off"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="exec-email">Email</Label>
          <Input
            id="exec-email"
            name="email"
            type="email"
            autoComplete="off"
            required
            placeholder="board@firm.com"
            className="mt-1.5"
          />
        </div>
      </div>
      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Invite executive"}
        </Button>
        <p className="text-xs text-foreground/60">
          {seatsLeft} executive seat{seatsLeft === 1 ? "" : "s"} remaining
        </p>
      </div>
    </form>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Deactivate member — small inline form with TOTP confirm.
// Used per-row in the team table; expands inline when "Deactivate" is clicked.
// ───────────────────────────────────────────────────────────────────────────

import { deactivateMemberAction, reassignSupervisorAction } from "@/app/actions/team";

export function DeactivateMemberButton({
  membershipId,
  userLabel,
}: {
  membershipId: string;
  userLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    TeamActionResult | undefined,
    FormData
  >(deactivateMemberAction, undefined);

  if (state?.ok) {
    return (
      <span className="text-xs text-foreground/60">Deactivated</span>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Deactivate
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <p className="text-xs text-foreground/70">
        Deactivate <strong>{userLabel}</strong>?
      </p>
      <Input
        name="totpCode"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        placeholder="2FA code"
        className="h-8 font-mono text-xs max-w-[140px]"
      />
      {state && state.ok === false && (
        <p
          role="alert"
          className="text-xs text-[color:var(--color-risk)]"
        >
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={pending}
        >
          {pending ? "…" : "Confirm"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Reassign supervisor — dropdown on a supervisee row that changes their
// primary supervisor. Visible to HR Admins only.
// ───────────────────────────────────────────────────────────────────────────

type SupervisorOption = { id: string; name: string };

export function ReassignSupervisorDropdown({
  superviseeId,
  currentSupervisorId,
  supervisors,
}: {
  superviseeId: string;
  currentSupervisorId: string | null;
  supervisors: SupervisorOption[];
}) {
  const [state, formAction, pending] = useActionState<
    TeamActionResult | undefined,
    FormData
  >(reassignSupervisorAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="superviseeId" value={superviseeId} />
      <div className="flex items-center gap-2">
        <select
          name="newSupervisorId"
          defaultValue={currentSupervisorId ?? ""}
          className="h-8 px-2 rounded-sm border border-border bg-background text-xs"
          disabled={pending}
        >
          {!currentSupervisorId && (
            <option value="" disabled>
              — unassigned —
            </option>
          )}
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "…" : "Save"}
        </Button>
      </div>
      {state && state.ok === false && (
        <p role="alert" className="text-xs text-[color:var(--color-risk)]">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="text-xs text-[color:var(--color-success)]">Reassigned.</p>
      )}
    </form>
  );
}
