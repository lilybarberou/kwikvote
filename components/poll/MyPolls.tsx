"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePoll } from "@/hooks/use-poll";
import { isEmail } from "@/lib/email";
import { m } from "framer-motion";
import { Bird, Loader2 } from "lucide-react";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { useForm } from "react-hook-form";

type SearchSchema = { email: string };

export const MyPolls = () => {
  const [email, setEmail] = useQueryState("email", parseAsString);

  const {
    getPollsByEmailQuery: { data: polls, isLoading, error },
  } = usePoll({ enabled: { getPollsByEmail: !!email } });

  const { register, handleSubmit, getValues } = useForm<SearchSchema>({
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
          aria-label="Votre email"
          inputMode="email"
          autoComplete="email"
          {...register("email", { validate: isEmail })}
        />
        <Button disabled={!!(email && isLoading)}>
          Rechercher
          {email && isLoading && (
            <Loader2 className="ml-2 h-5 w-5 animate-spin" />
          )}
        </Button>
      </form>
      {/* too many searches: said, not taken for "no poll" */}
      {error && (
        <p
          role="alert"
          className="mt-4 text-sm text-destructive dark:text-red-400"
        >
          {error.message}
        </p>
      )}
      {!isLoading &&
        !error &&
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
      <Bird aria-hidden className="mb-10 h-24 w-24" />
      <h2 className="text-2xl font-bold">C'est vide !</h2>
      <p className="text-center text-muted-foreground">
        Vous pouvez créer un sondage via la{" "}
        <Link
          className="text-primary underline underline-offset-4"
          href="/poll/creer"
        >
          page de création
        </Link>
        .
      </p>
    </div>
  );
};

// outside of Polls: a component created during render is remounted on each render
const LinkMotion = m(Link);

const Polls = ({ polls }: { polls: { id: string; title: string }[] }) => {
  return (
    <m.div
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
    </m.div>
  );
};
