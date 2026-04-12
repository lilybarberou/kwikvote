import { AdminPollsHeader } from "@/components/admin/AdminPollsHeader";
import { AdminPollsList } from "@/components/admin/AdminPollsList";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const { password } = await searchParams;

  if (password !== env.ADMIN_PASSWORD) notFound();

  return (
    <div className="space-y-8">
      <AdminPollsHeader />
      <AdminPollsList />
    </div>
  );
}
