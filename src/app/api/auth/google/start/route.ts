import { handleOAuthStart } from "@/lib/calendar/oauth-handlers";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleOAuthStart("google");
}
