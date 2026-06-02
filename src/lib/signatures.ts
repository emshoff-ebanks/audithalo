import type { SessionSignature } from "@/lib/db/schema";

export type SignatureDecision =
  | { ok: true; updated: SessionSignature[]; fullySigned: boolean }
  | { ok: false; error: string };

/**
 * Pure decision: given the current signature list and a candidate new signature,
 * return the next list + whether the session is now fully signed by all required
 * roles (supervisee + supervisor). No I/O, no auth — caller is responsible for
 * those before calling.
 */
export function decideNextSignature(
  existing: SessionSignature[],
  candidate: SessionSignature
): SignatureDecision {
  if (!candidate.intentConfirmed) {
    return { ok: false, error: "You must confirm intent before signing." };
  }
  if (existing.some((s) => s.signerId === candidate.signerId)) {
    return { ok: false, error: "You already signed this session." };
  }
  const updated = [...existing, candidate];
  const fullySigned =
    updated.some((s) => s.signerRole === "supervisee") &&
    updated.some((s) => s.signerRole === "supervisor");
  return { ok: true, updated, fullySigned };
}
