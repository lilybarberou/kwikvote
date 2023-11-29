'use client';

import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/utils/fetch';
import { CompletePoll } from './api/poll/[id]/route';
import { useHistoryStore } from '@/lib/historyStore';

export default function Home() {
    const { data: polls } = useSWR<CompletePoll[]>(`/api/poll`, fetcher);
    const { pollHistory } = useHistoryStore();

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold">Historique</h1>
            <div className="flex flex-col w-fit">
                {pollHistory.map((poll) => (
                    <Link key={poll.pollId} href={`/poll/${poll.pollId}`}>
                        {poll.title}
                    </Link>
                ))}
            </div>
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
