"use client";

import { usePoll } from "@/hooks/use-poll";
import { PopoverClose } from "@radix-ui/react-popover";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrashIcon } from "lucide-react";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { useIntersectionObserver } from "usehooks-ts";

import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export const AdminPollsList = () => {
  const queryClient = useQueryClient();

  const [password] = useQueryState("password", parseAsString.withDefault(""));

  const {
    getPollsQuery: { data: polls, hasNextPage, fetchNextPage },
    deletePollMutation,
    keys: { getPollsKey },
  } = usePoll({
    enabled: { getPolls: true },
  });

  const { ref } = useIntersectionObserver({
    threshold: 0.5,
    rootMargin: "0px",
    onChange: (isIntersecting) =>
      isIntersecting && hasNextPage && fetchNextPage(),
  });

  return (
    <motion.div
      className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      variants={{ init: { opacity: 0 }, anim: { opacity: 1 } }}
      transition={{ staggerChildren: 0.1 }}
      initial="init"
      animate="anim"
    >
      {polls?.pages.map((page, pIndex) =>
        page.map((poll, index) => (
          <motion.div
            className="group grid grid-cols-[1fr,auto] items-center rounded border pr-2 transition-all hover:bg-accent"
            variants={{ init: { opacity: 0 }, anim: { opacity: 1 } }}
            key={poll.id}
            ref={
              pIndex === polls.pages.length - 1 &&
              index === polls.pages[polls.pages.length - 1].length - 1
                ? ref
                : undefined
            }
          >
            <Link
              className="flex min-h-[50px] items-center pl-4"
              href={`/poll/${poll.id}`}
            >
              {poll.title}
            </Link>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  className="opacity-0 focus:opacity-100 group-hover:opacity-100 aria-[expanded=true]:opacity-100"
                  variant="destructive"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="flex max-w-[200px] flex-col items-center gap-2">
                <p className="text-center text-sm">
                  Confirmer la suppression du sondage
                </p>
                <PopoverClose asChild>
                  <Button className="w-full" variant="outline">
                    Annuler
                  </Button>
                </PopoverClose>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() =>
                    deletePollMutation.mutate(
                      { pollId: poll.id, password },
                      {
                        onSuccess: () => {
                          queryClient.invalidateQueries({
                            queryKey: getPollsKey,
                          });
                        },
                      },
                    )
                  }
                  disabled={deletePollMutation.isPending}
                >
                  Supprimer
                </Button>
              </PopoverContent>
            </Popover>
          </motion.div>
        )),
      )}
    </motion.div>
  );
};
