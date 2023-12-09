'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useNotificationsStore } from '@/lib/notificationsStore';
import fetcher from '@/utils/fetch';
import { CompletePoll } from '@/app/api/poll/id/[value]/route';
import { BarChart3, Bell, BellRing, Megaphone } from 'lucide-react';
import PollComments from '@/components/PollComments';
import PollSlots from '@/components/PollSlots';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useVotesStore } from '@/lib/votesStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PollSkeleton from '@/components/PollSkeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useHistoryStore } from '@/lib/historyStore';
import RegistrationPoll from '@/components/RegistrationPoll';

export default function PollPage({ params }: { params: { id: string } }) {
    const { initVotes } = useVotesStore();
    const { addPollToHistory } = useHistoryStore();
    const { notificationsSupported, notificationsPermission, init } = useNotificationsStore();
    const { toast } = useToast();
    const {
        data: poll,
        error,
        isLoading,
    } = useSWR<CompletePoll>(`/api/poll/id/${params.id}`, fetcher, {
        onSuccess: (data) => {
            initVotes(data.votes);
        },
    });

    // NOTIFICATIONS MANAGEMENT
    useEffect(() => {
        const initNotifications = async () => {
            // CHECK IF NOTIFICATIONS ARE SUPPORTED AND ALREADY ASKED
            const notificationsSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

            // STORE SUBSCRIPTION ENDPOINT
            let sub: PushSubscriptionJSON | undefined;
            if (notificationsSupported && Notification.permission === 'granted') {
                sub = await navigator.serviceWorker.ready
                    .then((registration) => {
                        return registration.pushManager.getSubscription();
                    })
                    .then((sub) => sub?.toJSON());
            }

            init({
                notificationsSupported,
                notificationsPermission: Notification.permission,
                subscription: sub
                    ? {
                          endpoint: sub.endpoint!,
                          auth: sub.keys!.auth,
                          p256dh: sub.keys!.p256dh,
                      }
                    : null,
            });
        };

        // ADD POLL TO HISTORY
        if (poll) addPollToHistory(params.id, poll?.title || '');

        initNotifications();
    }, [init, addPollToHistory, params.id, poll]);

    const enableNotifications = async () => {
        const receivedPermission = await Notification.requestPermission();
        if (receivedPermission !== 'granted') return;

        const swRegistration = await navigator.serviceWorker.register('/service.js');

        const subscription = await swRegistration.pushManager
            .subscribe({
                applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                userVisibleOnly: true,
            })
            .then((sub) => sub.toJSON());

        const res = await fetch('/api/subscription', {
            method: 'POST',
            body: JSON.stringify(subscription),
        });

        if (res.ok) {
            init({
                notificationsSupported,
                notificationsPermission: Notification.permission,
                subscription: {
                    endpoint: subscription.endpoint!,
                    auth: subscription.keys!.auth,
                    p256dh: subscription.keys!.p256dh,
                },
            });
            toast({
                title: 'Notifications activées',
                description: "Vous recevrez une notification lorsqu'un nouveau commentaire sera posté, ainsi qu'en cas de place disponible.",
            });
        } else toast({ title: 'Erreur', description: "Une erreur est survenue lors de l'activation des notifications." });
    };

    if (isLoading) return <PollSkeleton />;
    if (error || !poll)
        return (
            <div className="mx-auto mt-32 flex flex-col justify-center items-center">
                <BarChart3 className="mb-10 w-24 h-24" />
                <p className="text-2xl font-bold">Ce sondage n&apos;existe pas</p>
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
        <div>
            <h1 className="mb-5 text-lg">{poll?.title}</h1>
            {poll.description && (
                <Alert className="w-fit">
                    <Megaphone className="h-4 w-4" />
                    <AlertDescription>{poll.description}</AlertDescription>
                </Alert>
            )}
            <Tabs defaultValue="votes" className="mt-10">
                <div className="flex gap-2">
                    <TabsList>
                        <TabsTrigger value="votes">Votes</TabsTrigger>
                        <TabsTrigger value="comments">Commentaires ({poll.comments.length})</TabsTrigger>
                    </TabsList>
                    {notificationsSupported && notificationsPermission === 'default' && (
                        <AlertDialog>
                            <TooltipProvider>
                                <Tooltip delayDuration={300}>
                                    <TooltipTrigger asChild>
                                        <AlertDialogTrigger asChild>
                                            <Button className="w-10 h-10" size="icon">
                                                <Bell className="w-5 h-5" />
                                            </Button>
                                        </AlertDialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p>Activer les notifications</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Activer les notifications</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Vous recevrez une notification lorsqu&apos;un nouveau commentaire sera posté, ainsi que pour vous avertir de place
                                        disponible.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={enableNotifications}>Confirmer</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    {notificationsPermission === 'granted' && (
                        <TooltipProvider>
                            <Tooltip delayDuration={300}>
                                <TooltipTrigger asChild>
                                    <div className="w-10 h-10 flex justify-center items-center border rounded-sm text-black bg-green-400">
                                        <BellRing className="w-5 h-5" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p>Notifications activées</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                <TabsContent value="votes">
                    {poll.type === 1 && <PollSlots slots={poll.slots} pollId={poll.id} />}
                    {poll.type === 2 && <RegistrationPoll slots={poll.slots} pollId={poll.id} />}
                </TabsContent>
                <TabsContent value="comments">
                    <PollComments comments={poll.comments} pollId={params.id} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
