"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPollsByEmail } from "@/lib/api/poll/query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bird, Loader2 } from "lucide-react";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { useForm } from "react-hook-form";
import { z } from "zod";

const SearchSchema = z.object({
  email: z.string().email(),
});
type SearchSchema = z.infer<typeof SearchSchema>;

export const MyPolls = () => {
  const [email, setEmail] = useQueryState("email", parseAsString);

  const { data: polls, isLoading } = useQuery({
    queryKey: ["getPollsByEmail", email?.toLowerCase()],
    queryFn: async () => {
      const res = await getPollsByEmail(email?.toLowerCase()!);
      return res?.data;
    },
    enabled: !!email,
  });

  const { register, handleSubmit, getValues } = useForm<SearchSchema>({
    resolver: zodResolver(SearchSchema),
    defaultValues: { email: email ?? "" },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setEmail(email);
  });

  return (
    <>
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <Input
          className="flex-1 sm:w-64 sm:flex-initial"
          placeholder="Votre email..."
          inputMode="email"
          {...register("email")}
        />
        <Button disabled={!!(email && isLoading)}>
          Rechercher
          {email && isLoading && (
            <Loader2 className="ml-2 h-5 w-5 animate-spin" />
          )}
        </Button>
      </form>
      {!isLoading &&
        (getValues("email") && polls?.length === 0 ? (
          <NoPolls />
        ) : (
          <Polls polls={polls!} />
        ))}
    </>
  );
};

const NoPolls = () => {
  return (
    <div className="mt-24 flex flex-col items-center justify-center">
      <Bird className="mb-10 h-24 w-24" />
      <p className="text-2xl font-bold">C'est vide !</p>
      <p className="text-center text-muted-foreground">
        Vous pouvez créer un sondage via la{" "}
        <Link className="text-primary" href="/poll/create">
          page de création
        </Link>
        .
      </p>
    </div>
  );
};

const Polls = ({ polls }: { polls: { id: string; title: string }[] }) => {
  const LinkMotion = motion(Link);

  return (
    <motion.div
      className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      variants={{ init: { opacity: 0 }, anim: { opacity: 1 } }}
      transition={{ staggerChildren: 0.1 }}
      initial="init"
      animate="anim"
    >
      {polls?.map((poll) => (
        <LinkMotion
          className="block rounded border p-2 transition-all hover:bg-accent"
          href={`/poll/${poll.id}`}
          variants={{ init: { opacity: 0 }, anim: { opacity: 1 } }}
          key={poll.id}
        >
          {poll.title}
        </LinkMotion>
      ))}
    </motion.div>
  );
};
