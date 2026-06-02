"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitContactAction, subscribeNewsletterAction } from "@/app/actions/contact";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const TOPICS = [
  "General question",
  "Supervisor account help",
  "Enterprise / group practice",
  "State rule request",
  "Partnership or press",
  "Other",
];

const STATES = [
  { value: "", label: "All states" },
  { value: "NC", label: "North Carolina (LCMHCA)" },
  { value: "CA", label: "California (APCC)" },
  { value: "TX", label: "Texas (LPC-Associate)" },
  { value: "FL", label: "Florida (RMHCI)" },
  { value: "NY", label: "New York (LP-MHC)" },
];

export function ContactForm() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      setError(null);
      const result = await submitContactAction(fd);
      if (result.ok) {
        setDone(true);
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return (
      <div className="flex items-start gap-3 p-6 border border-border rounded-sm bg-card">
        <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-[color:var(--color-success)]" />
        <div>
          <p className="font-medium text-foreground">Message sent.</p>
          <p className="mt-1 text-sm text-foreground/70">
            We'll get back to you at the email you provided — usually same day.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Your name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="topic">What's this about?</Label>
        <select
          id="topic"
          name="topic"
          className="w-full h-9 rounded-sm border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-secondary"
        >
          {TOPICS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          placeholder="Tell us what you need..."
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-[color:var(--color-risk)]">{error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
        {!pending && <ArrowRight className="h-4 w-4" />}
      </Button>
    </form>
  );
}

export function NewsletterForm() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      setError(null);
      const result = await subscribeNewsletterAction(fd);
      if (result.ok) {
        setDone(true);
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return (
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-[color:var(--color-success)]" />
        <p className="text-sm text-foreground">
          You're subscribed. We'll notify you when your state's requirements change.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          name="email"
          type="email"
          required
          placeholder="your@email.com"
          className="flex-1"
        />
        <select
          name="state"
          className="h-9 rounded-sm border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-secondary"
        >
          {STATES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "…" : "Subscribe"}
        </Button>
      </div>
      {error && <p className="text-xs text-[color:var(--color-risk)]">{error}</p>}
    </form>
  );
}
