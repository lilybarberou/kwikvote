import { getPollById } from "@/lib/api/poll/query";
import { Metadata } from "next";
import { PropsWithChildren } from "react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getPollById({ pollId: id });
  if (data?.data === null) return { title: "Ce sondage n'existe pas" };
  // not loaded: the default title, the page tells the error
  if (!data?.data) return {};

  return {
    title: data.data.title,
  };
}

export default function Layout({ children }: PropsWithChildren) {
  return children;
}
