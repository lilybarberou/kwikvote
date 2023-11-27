'use client';

import { CompletePoll } from '@/app/api/poll/[id]/route';
import PollComments from '@/components/PollComments';
import PollSlots from '@/components/PollSlots';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useVotesStore } from '@/lib/votesStore';
import fetcher from '@/utils/fetch';
import { Loader2, Megaphone } from 'lucide-react';
import useSWR from 'swr';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function PollPage({ params }: { params: { id: string } }) {
    const { initVotes } = useVotesStore();
    const {
        data: poll,
        error,
        isLoading,
    } = useSWR<CompletePoll>(`/api/poll/${params.id}`, fetcher, {
        onSuccess: (data) => {
            initVotes(data.votes);
        },
    });

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
        <div className="m-auto w-fit mt-4">
            <h1 className="mb-5 text-lg">{poll?.title}</h1>
            {poll.description && (
                <Alert>
                    <Megaphone className="h-4 w-4" />
                    <AlertDescription>{poll.description}</AlertDescription>
                </Alert>
            )}
            <Tabs defaultValue="votes" className="mt-10 w-[500px]">
                <TabsList>
                    <TabsTrigger value="votes">Votes</TabsTrigger>
                    <TabsTrigger value="comments">Commentaires ({poll.comments.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="votes">
                    <PollSlots slots={poll.slots} pollId={params.id} />
                </TabsContent>
                <TabsContent value="comments">
                    <PollComments comments={poll.comments} pollId={params.id} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
