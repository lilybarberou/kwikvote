import FAQContent from '@/components/FAQContent';

export default function FAQPage() {
  return (
    <div className="m-auto w-full max-w-3xl">
      <h1 className="mb-5 text-3xl font-bold">FAQ</h1>
      <FAQContent faqPage />
    </div>
  );
}
