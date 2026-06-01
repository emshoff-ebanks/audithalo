import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Dashboard — AuditHalo",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Badge variant="outline" className="mb-4">
        Welcome
      </Badge>
      <h1 className="font-display text-4xl font-semibold text-foreground">
        Hello, {session.user.name ?? session.user.email}.
      </h1>
      <p className="mt-3 text-foreground/70 max-w-2xl">
        You're signed in as a <span className="font-medium">{session.user.role}</span>.
        The full supervision dashboard with hour progress and at-risk flags lands in
        Phase 1.6. For now you can build your roster.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard/roster">
            <Users />
            Manage roster <ArrowRight />
          </Link>
        </Button>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="label-overline mb-2">User ID</p>
            <p className="font-mono text-sm text-foreground/80 break-all">
              {session.user.id}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="label-overline mb-2">Email</p>
            <p className="text-foreground">{session.user.email}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="label-overline mb-2">Role</p>
            <p className="text-foreground capitalize">{session.user.role}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
