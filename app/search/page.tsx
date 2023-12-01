'use client';

import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/utils/fetch';
import { useSearchParams } from 'next/navigation';
import { Bird } from 'lucide-react';

export default function SearchPollsByEmail() {
    const searchParams = useSearchParams();
    const email = searchParams.get('email')?.replace(/%40/g, '@');
    const { data: polls, isLoading } = useSWR<{ id: string; title: string }[]>(`/api/poll/email/${email}`, fetcher);

    if (email && isLoading) return <p>Chargement...</p>;
    if (!email || !polls?.length)
        return (
            <div className="mt-32 flex flex-col justify-center items-center">
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
        <div className="mt-10 flex flex-col w-fit">
            <h1 className="mb-2 text-3xl font-bold">Mes sondages</h1>
            {polls?.map((poll) => (
                <Link key={poll.id} href={`/poll/${poll.id}`}>
                    {poll.title}
                </Link>
            ))}
        </div>
    );
}
