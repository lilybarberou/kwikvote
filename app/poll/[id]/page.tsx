'use client';

import { CompletePoll } from '@/app/api/poll/[id]/route';
import PollComments from '@/components/PollComments';
import PollSlots from '@/components/PollSlots';
import fetcher from '@/utils/fetch';
import useSWR from 'swr';

export default function PollPage({ params }: { params: { id: string } }) {
    const { data: poll, error, isLoading } = useSWR<CompletePoll>(`/api/poll/${params.id}`, fetcher);

    if (isLoading)
        return (
            <div>
                <h1>Loading...</h1>
            </div>
        );
    if (error || !poll) return <div>Ce sondage n&apos;existe pas</div>;
    return (
        <div className="flex flex-col gap-10">
            <h1 className="text-lg">{poll?.title}</h1>
            <p>{poll?.description}</p>
            <PollSlots slots={poll.slots} votes={poll.votes} pollId={params.id} />
            <PollComments comments={poll.comments} pollId={params.id} />
        </div>
    );
}
