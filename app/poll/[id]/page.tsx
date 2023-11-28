'use client';

import { CompletePoll } from '@/app/api/poll/[id]/route';
import PollComments from '@/components/PollComments';
import PollSlots from '@/components/PollSlots';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useVotesStore } from '@/lib/votesStore';
import fetcher from '@/utils/fetch';
import { BarChart3, Megaphone } from 'lucide-react';
import useSWR from 'swr';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PollSkeleton from '@/components/PollSkeleton';
import Link from 'next/link';

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

    if (isLoading) return <PollSkeleton />;
    if (error || !poll)
        return (
            <div className="mx-auto mt-20 h-full flex flex-col justify-center items-center">
                <BarChart3 className="mb-10 w-24 h-24" />
                <p className="text-2xl font-bold">Ce sondage n&apos;existe pas</p>
                <p className="text-muted-foreground">
                    Vous pouvez créer un sondage via la{' '}
                    <Link className="text-primary" href="/poll/create">
                        page de création
                    </Link>
                    .
                </p>
            </div>
        );
    return (
        <div className="mt-4">
            <h1 className="mb-5 text-lg">{poll?.title}</h1>
            {poll.description && (
                <Alert className="w-fit">
                    <Megaphone className="h-4 w-4" />
                    <AlertDescription>{poll.description}</AlertDescription>
                </Alert>
            )}
            <Tabs defaultValue="votes" className="mt-10">
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
