import { getPollById } from "@/lib/api/poll/query";
import { handleServerResponse } from "@/lib/utils";
import { Metadata } from "next";
import { PropsWithChildren } from "react";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const data = await getPollById({ pollId: params.id });
  if (data?.serverError) return { title: "Ce sondage n'existe pas" };

  const poll = handleServerResponse(data);

  return {
    title: poll?.title,
  };
}

export default function Layout({ children }: PropsWithChildren) {
  return children;
}
