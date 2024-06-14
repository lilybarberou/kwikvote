'use client';

import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/utils/fetch';
import { Bird, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { parseAsString, useQueryState } from 'nuqs';

const SearchSchema = z.object({
  email: z.string().email(),
});
type SearchSchema = z.infer<typeof SearchSchema>;

export const MyPolls = () => {
  const [email, setEmail] = useQueryState('email', parseAsString);

  const { isLoading, data: polls = [] } = useSWR<{ id: string; title: string }[]>(`/api/poll/email/${email?.toLowerCase()}`, fetcher);

  const { register, handleSubmit, getValues } = useForm<SearchSchema>({
    resolver: zodResolver(SearchSchema),
    defaultValues: { email: email ?? '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setEmail(email);
  });

  return (
    <>
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <Input className="flex-1 sm:flex-initial sm:w-64" placeholder="Votre email..." inputMode="email" {...register('email')} />
        <Button disabled={!!(email && isLoading)}>
          Rechercher
          {email && isLoading && <Loader2 className="ml-2 w-5 h-5 animate-spin" />}
        </Button>
      </form>
      {!isLoading && (getValues('email') && polls.length === 0 ? <NoPolls /> : <Polls polls={polls} />)}
    </>
  );
};

const NoPolls = () => {
  return (
    <div className="mt-24 flex flex-col justify-center items-center">
      <Bird className="mb-10 w-24 h-24" />
      <p className="text-2xl font-bold">C'est vide !</p>
      <p className="text-muted-foreground text-center">
        Vous pouvez créer un sondage via la{' '}
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
          className="p-2 block border rounded hover:bg-accent transition-all"
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
