"use client";

import { DialogPollLink } from "@/components/poll/DialogPollLink";
import { PollComments } from "@/components/poll/PollComments";
import { PollSettingsDialog } from "@/components/poll/PollSettingsDialog";
import { PollSkeleton } from "@/components/poll/PollSkeleton";
import { PollSlots } from "@/components/poll/PollSlots";
import { RegistrationPoll } from "@/components/poll/RegistrationPoll";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { usePoll } from "@/hooks/use-poll";
import { useSubscription } from "@/hooks/use-subscription";
import { CreateSubscriptionSchema } from "@/lib/schema/subscription-schema";
import { useCommentsStore } from "@/lib/store/commentsStore";
import { useNotificationsStore } from "@/lib/store/notificationsStore";
import { useVotesStore } from "@/lib/store/votesStore";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Bell, BellRing, Megaphone } from "lucide-react";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useState } from "react";

export default function PollPage() {
  const [tab] = useQueryState("tab", parseAsString.withDefault("votes"));

  const alreadyVisited =
    typeof window !== "undefined"
      ? localStorage.getItem("alreadyVisited")
      : null;
  const [dialogWarnNotifOpen, setDialogWarnNotifOpen] =
    useState(!alreadyVisited);
  const {
    notificationsSupported,
    notificationsPermission,
    init,
    subscription,
  } = useNotificationsStore();

  const { votes } = useVotesStore();
  const { comments } = useCommentsStore();
  const { toast } = useToast();
  const { createSubscriptionMutation } = useSubscription();

  const {
    getPollByIdQuery: { data: poll, isLoading },
  } = usePoll({ enabled: { getPollById: true } });
  const isRegistrationPoll = poll?.type == 2;
  const hasSomeVotes = Object.values(votes).some((v) =>
    v.subscriptions.some((s) => s.endpoint === subscription?.endpoint),
  );

  // NOTIFICATIONS MANAGEMENT
  useEffect(() => {
    const initNotifications = async () => {
      // CHECK IF NOTIFICATIONS ARE SUPPORTED AND ALREADY ASKED
      const notificationsSupported =
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;

      // STORE SUBSCRIPTION ENDPOINT
      let sub: PushSubscriptionJSON | undefined;
      if (notificationsSupported && Notification.permission === "granted") {
        sub = await navigator.serviceWorker.ready
          .then((registration) => {
            return registration.pushManager.getSubscription();
          })
          .then((sub) => sub?.toJSON());
      }

      init({
        notificationsSupported,
        notificationsPermission: notificationsSupported
          ? Notification.permission
          : "default",
        subscription: sub
          ? {
              endpoint: sub.endpoint!,
              auth: sub.keys!.auth,
              p256dh: sub.keys!.p256dh,
            }
          : null,
      });
    };
    initNotifications();
  }, [init, toast]);

  const enableNotifications = async () => {
    const receivedPermission = await Notification.requestPermission();
    if (receivedPermission !== "granted") return;

    const swRegistration =
      await navigator.serviceWorker.register("/service.js");
    await navigator.serviceWorker.ready; // waits for service worker to be ready = status active for sure

    const subscription = await swRegistration.pushManager
      .subscribe({
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        userVisibleOnly: true,
      })
      .then((sub) => sub.toJSON());

    createSubscriptionMutation.mutate(subscription as CreateSubscriptionSchema);
  };

  const dismissNotif = () => {
    localStorage.setItem("alreadyVisited", "true");
    setDialogWarnNotifOpen(false);
  };

  if (isLoading) return <PollSkeleton />;
  if (!poll)
    return (
      <div className="mx-auto mt-32 flex flex-col items-center justify-center">
        <BarChart3 className="mb-10 h-24 w-24" />
        <p className="text-2xl font-bold">Ce sondage n'existe pas</p>
        <p className="text-center text-muted-foreground">
          Vous pouvez créer un sondage via la{" "}
          <Link className="text-primary" href="/poll/creer">
            page de création
          </Link>
          .
        </p>
      </div>
    );
  return (
    <div>
      <AnimatePresence>
        {dialogWarnNotifOpen &&
          notificationsSupported &&
          notificationsPermission === "default" && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-[20px] z-50 w-11/12 min-[400px]:right-4 min-[400px]:max-w-[400px]"
            >
              <Card className="p-4">
                <CardTitle className="text-lg">
                  Activer les notifications
                </CardTitle>
                <CardDescription>
                  <p>
                    Vous recevrez une notification lorsqu'un nouveau commentaire
                    sera posté
                    {isRegistrationPoll
                      ? ", ainsi que pour être prévenu de votre inscription lorsque vous êtes en liste d'attente."
                      : "."}
                  </p>
                  <div className="mt-2 flex justify-end gap-2">
                    <Button onClick={dismissNotif} variant="outline">
                      Non merci
                    </Button>
                    <Button onClick={enableNotifications}>Activer</Button>
                  </div>
                </CardDescription>
              </Card>
            </motion.div>
          )}
      </AnimatePresence>
      <DialogPollLink />
      <h1 className="mb-5 text-lg">{poll?.title}</h1>
      {poll.description && (
        <Alert className="w-fit">
          <Megaphone className="h-4 w-4" />
          <AlertDescription>{poll.description}</AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue={tab} className="mt-10">
        <div className="flex gap-2">
          <TabsList>
            <TabsTrigger value="votes">Votes</TabsTrigger>
            <TabsTrigger value="comments">
              Commentaires ({comments.length})
            </TabsTrigger>
          </TabsList>
          {notificationsSupported && notificationsPermission === "default" && (
            <AlertDialog>
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button className="h-10 w-10" size="icon">
                        <Bell className="h-5 w-5" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Activer les notifications</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AlertDialogContent className="w-11/12 max-w-[400px]">
                <AlertDialogHeader>
                  <AlertDialogTitle>Activer les notifications</AlertDialogTitle>
                  <AlertDialogDescription>
                    Vous recevrez une notification lorsqu'un nouveau commentaire
                    sera posté
                    {isRegistrationPoll
                      ? ", ainsi que pour être prévenu de votre inscription lorsque vous êtes en liste d'attente."
                      : "."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={enableNotifications}>
                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {notificationsPermission === "granted" && (
            <Popover>
              <PopoverTrigger>
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-sm border text-black",
                    hasSomeVotes ? "bg-green-400" : "bg-gray-400",
                  )}
                >
                  <BellRing className="h-5 w-5" />
                </div>
              </PopoverTrigger>
              <PopoverContent side="bottom">
                <p className="text-center text-sm">
                  {hasSomeVotes
                    ? "Notifications activées pour ce sondage"
                    : "En attente de votre vote pour activer les notifications sur ce sondage"}
                </p>
              </PopoverContent>
            </Popover>
          )}
          {poll.hasPassword && <PollSettingsDialog />}
        </div>
        <TabsContent value="votes">
          {poll.type === 1 && <PollSlots slots={poll.slots} />}
          {poll.type === 2 && <RegistrationPoll poll={poll} />}
        </TabsContent>
        <TabsContent value="comments">
          <PollComments />
        </TabsContent>
      </Tabs>
    </div>
  );
}
