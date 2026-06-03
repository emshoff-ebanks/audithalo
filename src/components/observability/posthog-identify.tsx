"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

type Props = {
  userId: string;
  email: string;
  role: string;
};

export function PostHogIdentify({ userId, email, role }: Props) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (process.env.NODE_ENV !== "production") return;
    posthog.identify(userId, { email, role });
  }, [userId, email, role]);
  return null;
}
