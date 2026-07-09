import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

const STATE_TTL_SECONDS = 60 * 10; // 10 min
const COOKIE_NAME = "ah_paycor_oauth_state";

export async function issuePaycorOAuthState(): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  const jar = await cookies();
  jar.set({
    name: COOKIE_NAME,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/paycor",
    maxAge: STATE_TTL_SECONDS,
  });
  return state;
}

export async function consumePaycorOAuthState(
  callbackState: string | null,
): Promise<void> {
  const jar = await cookies();
  const stored = jar.get(COOKIE_NAME)?.value;
  jar.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/paycor",
    maxAge: 0,
  });
  if (!stored || !callbackState || stored !== callbackState) {
    throw new Error("Paycor OAuth state mismatch — refusing to complete the flow.");
  }
}
