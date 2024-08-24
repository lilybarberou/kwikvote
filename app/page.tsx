import { Home } from "@/components/home/Home";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "KwikVote | Créez vos sondages et partagez-les en un clin d'oeil",
};

export default function Page() {
  return <Home />;
}
