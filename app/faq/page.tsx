import { FAQContent } from "@/components/faq/FAQContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
};

export default function Page() {
  return (
    <div className="m-auto w-full max-w-3xl">
      <h1 className="mb-5 text-3xl font-bold">FAQ</h1>
      <FAQContent faqPage />
    </div>
  );
}
