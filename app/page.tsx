"use client";

import FAQContent from "@/components/FAQContent";
import ProcessSteps from "@/components/ProcessSteps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useAnimationControls } from "framer-motion";
import { HelpCircle, List, ListTodo } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const SearchSchema = z.object({
  email: z.string().email(),
});

export default function Home() {
  const controls = useAnimationControls();

  useEffect(() => {
    controls.start({ opacity: 1, y: 0 });
  }, [controls]);

  const handleTabAnimSequence = async () => {
    await controls.start("exit");
    controls.start("show");
  };

  const router = useRouter();
  const { register, handleSubmit } = useForm<z.infer<typeof SearchSchema>>({
    resolver: zodResolver(SearchSchema),
  });

  const onSubmit = handleSubmit(({ email }) => {
    router.push(`/mes-sondages?email=${email}`);
  });

  return (
    <div className="flex w-full flex-col items-center">
      <div
        className="absolute top-0 -z-10 h-screen w-full"
        style={{
          background:
            " radial-gradient(88.74% 100% at 50% 0%, #41A4C3 0%, #020817 100%)",
        }}
      />
      <h1 className="mb-6 max-w-xl text-center text-3xl font-semibold sm:text-4xl">
        Créez un sondage en quelques secondes et partagez-le avec vos amis
      </h1>
      <h2 className="mb-4 text-center text-[#d5d5d5]">
        C'est simple, gratuit, et aucun compte n'est requis.
      </h2>
      <div className="mb-14 flex gap-2">
        <Button asChild variant="secondary">
          <Link href="/poll/create">Créer mon sondage</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="border-[#ffffff36] bg-transparent hover:bg-transparent"
          size="icon"
        >
          <Link href="#faq" aria-label="FAQ">
            <HelpCircle className="h-5 w-5" />
          </Link>
        </Button>
      </div>
      <Tabs
        onValueChange={handleTabAnimSequence}
        defaultValue="free"
        className="mb-32 flex w-full flex-col items-center gap-4"
      >
        <TabsList className="mb-2 bg-[#00000029]">
          <TabsTrigger
            value="free"
            className="flex items-center gap-2 data-[state=active]:bg-[#ffffff28]"
          >
            <ListTodo className="h-5 w-5" />
            Libre
          </TabsTrigger>
          <TabsTrigger
            value="waitlist"
            className="flex items-center gap-2 data-[state=active]:bg-[#ffffff28]"
          >
            <List className="h-5 w-5" />
            Liste d'attente
          </TabsTrigger>
        </TabsList>
        <motion.div
          className="aspect-auto w-full rounded-lg border border-b-0 border-[#ffffff38] p-2 sm:p-[10px]"
          variants={{
            init: { opacity: 0, y: -20 },
            show: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -20, transition: { duration: 0 } },
          }}
          initial="init"
          animate={controls}
          transition={{ duration: 0.5 }}
        >
          <div className="rounded-sm border border-b-0 border-[#ffffff38]">
            <TabsContent value="free" className="mt-0 bg-background pt-3">
              <Image
                className="h-full w-full rounded-sm object-cover"
                width={1000}
                height={500}
                src="/poll-1.png"
                alt="Sondage libre"
              />
            </TabsContent>
            <TabsContent value="waitlist" className="mt-0 bg-background pt-3">
              <Image
                className="h-full w-full rounded-sm object-cover"
                width={1000}
                height={500}
                src="/poll-2.png"
                alt="Sondage avec liste d'attente"
              />
            </TabsContent>
          </div>
        </motion.div>
      </Tabs>
      <ProcessSteps />
      <h3 className="mb-2 text-center text-2xl font-semibold sm:text-3xl">
        Vous avez déjà des sondages ?
      </h3>
      <p className="mb-8 text-center text-muted-foreground">
        Si vous avez lié vos sondages à votre adresse mail, vous pourrez en
        retrouver un historique.
      </p>
      <form
        onSubmit={onSubmit}
        className="mb-32 flex w-full items-end justify-center gap-2"
      >
        <Input
          className="flex-1 sm:w-64 sm:flex-initial"
          placeholder="Votre email..."
          inputMode="email"
          {...register("email")}
        />
        <Button>Rechercher</Button>
      </form>
      <FAQContent />
    </div>
  );
}
