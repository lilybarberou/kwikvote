'use client';

import fetcher from '@/utils/fetch';
import { CompletePoll } from './api/poll/[id]/route';
import useSWR from 'swr';
import Link from 'next/link';

export default function Home() {
    const { data: polls } = useSWR<CompletePoll[]>(`/api/poll`, fetcher);

    return (
        <div className="flex flex-col w-fit">
            {polls?.map((poll) => (
                <Link key={poll.id} href={`/poll/${poll.id}`}>
                    {poll.title}
                </Link>
            ))}
        </div>
    );
}
