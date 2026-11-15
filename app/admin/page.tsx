import { AdminPollsHeader } from "@/components/admin/AdminPollsHeader";
import { AdminPollsList } from "@/components/admin/AdminPollsList";
import { AdminSignIn } from "@/components/admin/AdminSignIn";
import { hasAdminSession } from "@/lib/admin-session.server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  if (!(await hasAdminSession())) {
    // an old bookmark with ?password=: never used, the form explains why
    const { password } = await searchParams;
    return <AdminSignIn passwordInUrl={password !== undefined} />;
  }

  return (
    <div className="space-y-8">
      <h1 className="sr-only">Administration</h1>
      <AdminPollsHeader />
      <AdminPollsList />
    </div>
  );
}
