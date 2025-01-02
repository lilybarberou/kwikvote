import { AdminPollsHeader } from "@/components/admin/AdminPollsHeader";
import { AdminPollsList } from "@/components/admin/AdminPollsList";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";

export default function Page({
  searchParams,
}: {
  searchParams: { password: string };
}) {
  if (searchParams.password !== env.ADMIN_PASSWORD) notFound();

  return (
    <div className="space-y-8">
      <AdminPollsHeader />
      <AdminPollsList />
    </div>
  );
}
