'use client';

import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/utils/fetch';
import { useSearchParams } from 'next/navigation';
import { Bird, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const SearchSchema = z.object({
    email: z.string().email(),
});

export default function SearchPollsByEmail() {
    const [polls, setPolls] = useState<{ id: string; title: string }[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const searchParams = useSearchParams();
    const email = searchParams.get('email')?.replace(/%40/g, '@');
    const { isLoading } = useSWR<{ id: string; title: string }[]>(`/api/poll/email/${email}`, fetcher, {
        onSuccess: (data) => setPolls(data),
    });
    const { register, handleSubmit, getValues } = useForm<z.infer<typeof SearchSchema>>({
        resolver: zodResolver(SearchSchema),
        defaultValues: { email: email ?? '' },
    });

    const onSubmit = handleSubmit(async ({ email }) => {
        setLoading(true);
        const res = await fetch(`/api/poll/email/${email}`);
        setLoading(false);

        if (res.ok) {
            const data = await res.json();
            setPolls(data);
        }
    });

    const Polls = () => {
        if (isLoading || loading) return;
        else if (getValues('email') && !polls.length)
            return (
                <div className="mt-24 flex flex-col justify-center items-center">
                    <Bird className="mb-10 w-24 h-24" />
                    <p className="text-2xl font-bold">C&apos;est vide !</p>
                    <p className="text-muted-foreground text-center">
                        Vous pouvez créer un sondage via la{' '}
                        <Link className="text-primary" href="/poll/create">
                            page de création
                        </Link>
                        .
                    </p>
                </div>
            );
        return (
            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {polls?.map((poll) => (
                    <Link className="p-2 border rounded" key={poll.id} href={`/poll/${poll.id}`}>
                        {poll.title}
                    </Link>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col">
            <h1 className="mb-4 text-3xl font-bold">Mes sondages</h1>
            <p className="mb-6 text-muted-foreground">Si vous avez lié vos sondages à votre adresse mail, vous pourrez retrouver la liste de vos sondages.</p>
            <form onSubmit={onSubmit} className="flex items-end gap-2">
                <Input className="flex-1 sm:flex-initial sm:w-64" placeholder="Votre email..." {...register('email')} />
                <Button disabled={(email && isLoading) || loading}>
                    Rechercher
                    {((email && isLoading) || loading) && <Loader2 className="ml-2 w-5 h-5 animate-spin" />}
                </Button>
            </form>
            <Polls />
        </div>
    );
}
