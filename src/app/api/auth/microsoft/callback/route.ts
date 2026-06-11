import { handleOAuthCallback } from "@/lib/calendar/oauth-handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleOAuthCallback("microsoft", request);
}
