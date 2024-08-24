import { AdminPollsHeader } from "@/components/admin/AdminPollsHeader";
import { AdminPollsList } from "@/components/admin/AdminPollsList";
import { notFound } from "next/navigation";

export default function Page({
  searchParams,
}: {
  searchParams: { password: string };
}) {
  if (searchParams.password !== process.env.ADMIN_PASSWORD) notFound();

  return (
    <div className="space-y-8">
      <AdminPollsHeader />
      <AdminPollsList />
    </div>
  );
}
