import { redirect } from "next/navigation";

export const metadata = { title: "Overview — AuditHalo" };

export default function ExecutiveLegacyRedirect() {
  redirect("/dashboard");
}
