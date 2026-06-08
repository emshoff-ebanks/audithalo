"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  provisionEnterpriseOrgAction,
  type AdminEnterpriseResult,
} from "@/app/actions/admin-enterprise";

export function ProvisionEnterpriseForm() {
  const [state, formAction, pending] = useActionState<
    AdminEnterpriseResult | undefined,
    FormData
  >(provisionEnterpriseOrgAction, undefined);
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
        Provision new Enterprise org
      </Button>
    );
  }

  if (state?.ok) {
    return (
      <Card className="border-[color:var(--color-success)]/30">
        <CardContent className="p-6 space-y-3">
          <p className="text-sm text-[color:var(--color-success)] font-medium">
            Enterprise org provisioned. Welcome email sent with
            password-reset link.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setExpanded(false);
              window.location.reload();
            }}
          >
            Provision another
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-secondary/30">
      <CardContent className="p-6">
        <p className="label-overline mb-3">Provision new Enterprise org</p>
        <p className="text-xs text-foreground/70 mb-4 max-w-prose">
          Creates the customer's account + Enterprise-tier org + HR Admin
          membership in one step. They receive a welcome email with a
          24-hour password-reset link. Use this after a sales call closes
          — for an existing customer who self-registered on Solo/Practice,
          use Promote to Enterprise below instead.
        </p>
        <form action={formAction} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prov-customer-name">Customer name</Label>
              <Input
                id="prov-customer-name"
                name="customerName"
                type="text"
                required
                placeholder="Dr. Jamie Rivera"
                autoComplete="off"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="prov-customer-email">Customer email</Label>
              <Input
                id="prov-customer-email"
                name="customerEmail"
                type="email"
                required
                placeholder="jamie@bigpractice.com"
                autoComplete="off"
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="prov-org-name">Organization name</Label>
            <Input
              id="prov-org-name"
              name="orgName"
              type="text"
              required
              placeholder="Big Practice Counseling Group"
              autoComplete="off"
              className="mt-1.5"
            />
          </div>
          {state && state.ok === false && (
            <p
              role="alert"
              className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
            >
              {state.error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Provisioning…" : "Create org + send welcome"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setExpanded(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
