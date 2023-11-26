'use client';

import { CompletePoll } from '@/app/api/poll/[id]/route';
import PollComments from '@/components/PollComments';
import PollSlots from '@/components/PollSlots';
import fetcher from '@/utils/fetch';
import { Loader2 } from 'lucide-react';
import useSWR from 'swr';

export default function PollPage({ params }: { params: { id: string } }) {
    const { data: poll, error, isLoading } = useSWR<CompletePoll>(`/api/poll/${params.id}`, fetcher);

    if (isLoading)
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading
                </p>
            </div>
        );
    if (error || !poll) return <div>Ce sondage n&apos;existe pas</div>;
    return (
        <div className="m-auto w-fit mt-4 flex flex-col gap-10">
            <h1 className="text-lg">{poll?.title}</h1>
            <p>{poll?.description}</p>
            <PollSlots slots={poll.slots} votes={poll.votes} pollId={params.id} />
            <PollComments comments={poll.comments} pollId={params.id} />
        </div>
    );
}
