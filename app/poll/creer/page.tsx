import { PollForm } from "@/components/poll/PollForm";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Créer un sondage",
};

export default function Page() {
  return (
    <div className="m-auto max-w-xl">
      <h1 className="mb-10 text-3xl font-bold">Création du sondage</h1>
      <Suspense>
        <PollForm />
      </Suspense>
    </div>
  );
}
