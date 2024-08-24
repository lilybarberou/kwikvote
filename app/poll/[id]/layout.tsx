import { getPollById } from "@/lib/api/poll/query";
import { handleServerResponse } from "@/lib/utils";
import { Metadata } from "next";
import { PropsWithChildren } from "react";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const poll = await getPollById({ pollId: params.id }).then(
    handleServerResponse,
  );

  return {
    title: poll.title,
  };
}

export default function Layout({ children }: PropsWithChildren) {
  return children;
}
