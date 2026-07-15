export const SUPERVISOR_CREDENTIAL_TYPES = [
  "LCMHCS",
  "LPC-Supervisor",
  "LMHC",
  "LCSW",
  "LMFT",
  "LPCC",
  "LCAT",
  "LP",
  "NCC",
  "LPC",
  "Psychologist",
  "Psychiatrist",
  "Qualified-Supervisor",
] as const;

export type SupervisorCredentialType = (typeof SUPERVISOR_CREDENTIAL_TYPES)[number];
