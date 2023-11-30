'use client';

import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/utils/fetch';
import { CompletePoll } from './api/poll/[id]/route';
import dynamic from 'next/dynamic';

const ConsultedHistory = dynamic(() => import('../components/ConsultedHistory'), {
    ssr: false,
});

export default function Home() {
    const { data: polls } = useSWR<CompletePoll[]>(`/api/poll`, fetcher);

    return (
        <div>
            <ConsultedHistory />
            <div className="mt-10 flex flex-col w-fit">
                <p className="mb-2 text-3xl font-bold">Tout</p>
                {polls?.map((poll) => (
                    <Link key={poll.id} href={`/poll/${poll.id}`}>
                        {poll.title}
                    </Link>
                ))}
            </div>
        </div>
    );
}
