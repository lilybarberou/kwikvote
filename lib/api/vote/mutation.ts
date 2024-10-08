"use server";

import { action } from "@/lib/safe-action";
import {
  createVoteSchema,
  deleteVoteSchema,
  updateVoteNameSchema,
} from "@/lib/schema/vote-schema";
import { checkTimeBeforeAllow } from "@/lib/utils";
import { prisma } from "@/prisma/db";
import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { fr } from "date-fns/locale/fr";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:" + process.env.NEXT_PUBLIC_VAPID_EMAIL,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

export const createVote = action
  .schema(createVoteSchema)
  .action(async ({ parsedInput: data }) => {
    const voteInDB = await prisma.vote.findUnique({
      where: { id: data.id },
      select: {
        choices: {
          select: {
            id: true,
            slotId: true,
            choice: true,
          },
        },
      },
    });

    // UPDATE VOTE IN DB
    await prisma.vote.upsert({
      where: {
        id: data.id,
      },
      update: {
        name: data.name,
        choices: {
          upsert: data.choices.map(
            (choice: { id: string; slotId: string; choice: number }) => ({
              where: {
                id: choice.id,
              },
              update: {
                choice: choice.choice,
              },
              create: {
                id: choice.id,
                choice: choice.choice,
                slot: {
                  connect: {
                    id: choice.slotId,
                  },
                },
              },
            }),
          ),
        },
        subscriptions: data.subscription
          ? {
              connectOrCreate: {
                where: { endpoint: data.subscription.endpoint },
                create: {
                  ...data.subscription,
                },
              },
            }
          : undefined,
      },
      create: {
        id: data.id,
        name: data.name,
        poll: {
          connect: {
            id: data.pollId,
          },
        },
        choices: {
          create: data.choices.map(
            (choice: { id: string; slotId: string; choice: number }) => ({
              id: choice.id,
              choice: choice.choice,
              slot: {
                connect: {
                  id: choice.slotId,
                },
              },
            }),
          ),
        },
        subscriptions: data.subscription
          ? {
              connectOrCreate: {
                where: { endpoint: data.subscription.endpoint },
                create: {
                  ...data.subscription,
                },
              },
            }
          : undefined,
      },
    });

    if (data.pollType == 2) {
      const poll = await prisma.poll.findUnique({
        where: { id: data.pollId },
        include: {
          slots: {
            orderBy: {
              startDate: "asc",
            },
          },
        },
      });

      if (!poll) throw new Error("Sondage introuvable");

      const initialPoll = JSON.parse(
        JSON.stringify(poll.slots),
      ) as PollWithSlots["slots"];

      const timeBeforeAllowedPassed = checkTimeBeforeAllow({
        timeBeforeAllowedType: poll.timeBeforeAllowedType,
        msBeforeAllowed: poll.msBeforeAllowed,
        slots: poll.slots,
      });

      const newPoll = await updateSlotsArrayAfterCreation({
        poll,
        timeBeforeAllowedPassed,
        voteId: data.id,
        initialVoteChoices: data.choices,
        initialVoteOldChoices: voteInDB?.choices,
        firstCall: true,
        voteExists: !!voteInDB,
      });

      // update slots in db
      for (const slot of newPoll.slots) {
        await prisma.slot.update({
          where: { id: slot.id },
          data: slot,
        });
      }

      sendNotifications({
        voteId: data.id,
        pollId: data.pollId,
        poll,
        newPoll,
        initialPoll,
      });
    }
  });

const updateSlotsArrayAfterCreation = async ({
  poll,
  voteId,
  initialVoteChoices,
  initialVoteOldChoices,
  voteExists,
  timeBeforeAllowedPassed,
  firstCall,
}: {
  poll: PollWithSlots;
  voteId: string;
  initialVoteChoices: Choice[];
  initialVoteOldChoices?: Choice[];
  voteExists: boolean;
  timeBeforeAllowedPassed: Record<string, boolean>;
  firstCall?: boolean;
}): Promise<PollWithSlots> => {
  let isRegisteredOnce = false;

  // check si le vote existe (uniquement pour celui reçu dans l'api)
  const currentVoteData = await prisma.vote.findUnique({
    where: { id: voteId },
    select: {
      choices: {
        select: {
          id: true,
          slotId: true,
          choice: true,
        },
      },
    },
  });

  for (const slot of poll.slots) {
    const timePassed = timeBeforeAllowedPassed[slot.id];
    const currentVoteChoice = [
      ...(firstCall ? initialVoteChoices : currentVoteData!.choices),
    ].find((choice) => choice.slotId === slot.id);
    const isChoiceNo = currentVoteChoice?.choice == 2;

    const isAllowedToRegister = () => !isRegisteredOnce || timePassed;
    const isFull = () => slot.registered.length >= slot.maxParticipants;

    // if its an edit
    if (voteExists) {
      const oldChoice = firstCall
        ? initialVoteOldChoices!.find((choice) => choice.slotId === slot.id)!
        : undefined;
      const choiceChanged = firstCall
        ? oldChoice?.choice !== currentVoteChoice?.choice
        : false;

      if (choiceChanged) {
        slot.registered = slot.registered.filter((id) => id !== voteId);
        slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
        slot.waitingListReregistered = slot.waitingListReregistered.filter(
          (id) => id !== voteId,
        );
        slot.notComing = slot.notComing.filter((id) => id !== voteId);
      } else {
        if (currentVoteChoice?.choice == 1) {
          const isRegistered = slot.registered.includes(voteId);

          // premier créneau où il est inscrit, on le laisse inscrit
          if (isRegistered && !isRegisteredOnce) {
            isRegisteredOnce = true;
            continue;
          }
          // déjà inscrit dans un créneau précédent, on l'enlève des inscrits
          // (passera en liste d'attente dans la logique suivante)
          else if (isRegistered && isRegisteredOnce) {
            // if time passed and reregistered allowed we can leave it
            if (timePassed) {
              isRegisteredOnce = true;
              continue;
            }
            // else remove from registered (will be in reregistered waiting list)
            else
              slot.registered = slot.registered.filter((id) => id !== voteId);
          }
          // not registered yet -> actually in wl or wlr
          else {
            const isWaitingList = slot.waitingList.includes(voteId);
            const isWaitingListReregistered =
              slot.waitingListReregistered.includes(voteId);

            if (isFull()) {
              // if allowed to reregister -> must be in wl
              if (isAllowedToRegister()) {
                if (isWaitingListReregistered)
                  slot.waitingListReregistered =
                    slot.waitingListReregistered.filter((id) => id !== voteId);
                else continue;
              }
              // else -> must be in wlr
              else {
                if (isWaitingList)
                  slot.waitingList = slot.waitingList.filter(
                    (id) => id !== voteId,
                  );
                else continue;
              }
            } else {
              // if allowed to reregister -> remove from all wl -> will be in registered
              if (isAllowedToRegister()) {
                slot.waitingListReregistered =
                  slot.waitingListReregistered.filter((id) => id !== voteId);
                slot.waitingList = slot.waitingList.filter(
                  (id) => id !== voteId,
                );
              }
              // else -> must be in wlr
              else {
                if (isWaitingList)
                  slot.waitingList = slot.waitingList.filter(
                    (id) => id !== voteId,
                  );
                else continue;
              }
            }
          }
        }
        // no changes if still no
        else continue;
      }
    }

    if (isChoiceNo) slot.notComing.push(voteId);
    else {
      // not full -> add to registered
      if (!isFull() && isAllowedToRegister()) {
        slot.registered.push(voteId);
        isRegisteredOnce = true;
      }
      // full and not registered anywhere -> add to waiting list
      else if (isAllowedToRegister()) slot.waitingList.push(voteId);
      // already registered somewhere -> add to reregistered waiting list
      else slot.waitingListReregistered.push(voteId);
    }
  }

  // ----- CHECK SI IL RESTE DE LA PLACE DANS LES INSCRITS D'UN CRENEAU -----
  let voteIdToRegister = "";
  poll.slots.forEach((slot) => {
    const isNotFull = slot.registered.length < slot.maxParticipants;
    const isWaitingListNotEmpty = slot.waitingList.length > 0;

    if (isNotFull && isWaitingListNotEmpty) {
      voteIdToRegister = slot.waitingList[0];
    }
  });

  if (voteIdToRegister) {
    poll = await updateSlotsArrayAfterCreation({
      poll,
      voteId: voteIdToRegister,
      initialVoteChoices,
      voteExists: true,
      timeBeforeAllowedPassed,
    });
  }

  return poll;
};

export const deleteVote = action
  .schema(deleteVoteSchema)
  .action(async ({ parsedInput: { voteId, pollId, pollType } }) => {
    let newPoll: PollWithSlots | undefined = undefined;

    // REMOVE VOTE FROM ALL SLOTS ARRAYS
    if (pollType == 2) {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          slots: {
            orderBy: {
              startDate: "asc",
            },
          },
        },
      });

      if (!poll) throw new Error("Sondage introuvable");

      const initialPoll = JSON.parse(
        JSON.stringify(poll.slots),
      ) as PollWithSlots["slots"];

      // remove vote from all slots arrays
      poll.slots.forEach((slot) => {
        slot.registered = slot.registered.filter((id) => id != voteId);
        slot.waitingList = slot.waitingList.filter((id) => id != voteId);
        slot.waitingListReregistered = slot.waitingListReregistered.filter(
          (id) => id != voteId,
        );
        slot.notComing = slot.notComing.filter((id) => id != voteId);
      });
      newPoll = JSON.parse(JSON.stringify(poll)) as PollWithSlots;

      // check if someone can be registered
      let voteIdToRegister = "";
      poll.slots.forEach((slot) => {
        if (slot.registered.length < slot.maxParticipants) {
          if (slot.waitingList.length > 0) {
            voteIdToRegister = slot.waitingList[0];
          }
        }
      });

      if (voteIdToRegister) {
        const timeBeforeAllowedPassed = checkTimeBeforeAllow({
          timeBeforeAllowedType: poll.timeBeforeAllowedType,
          msBeforeAllowed: poll.msBeforeAllowed,
          slots: poll.slots,
        });

        newPoll = await updateSlotsArrayAfterDelete({
          poll,
          voteId: voteIdToRegister,
          timeBeforeAllowedPassed,
        });

        sendNotifications({
          voteId,
          pollId,
          poll,
          newPoll,
          initialPoll,
        });
      }

      // update slots in db
      for (const slot of newPoll.slots) {
        await prisma.slot.update({
          where: { id: slot.id },
          data: slot,
        });
      }
    }

    await prisma.voteChoice.deleteMany({ where: { voteId } });

    await prisma.vote.delete({
      where: { id: voteId },
    });
  });

const updateSlotsArrayAfterDelete = async ({
  poll,
  voteId,
  timeBeforeAllowedPassed,
}: {
  poll: PollWithSlots;
  voteId: string;
  timeBeforeAllowedPassed: Record<string, boolean>;
}): Promise<PollWithSlots> => {
  let isRegisteredOnce = false;

  const currentVoteData = await prisma.vote.findUnique({
    where: { id: voteId },
    select: {
      choices: {
        select: {
          id: true,
          slotId: true,
          choice: true,
        },
      },
    },
  });

  for (const slot of poll.slots) {
    const timePassed = timeBeforeAllowedPassed[slot.id];
    const currentVoteChoice = currentVoteData!.choices.find(
      (choice) => choice.slotId === slot.id,
    );

    const isAllowedToRegister = () => !isRegisteredOnce || timePassed;
    const isFull = () => slot.registered.length >= slot.maxParticipants;

    if (currentVoteChoice?.choice == 1) {
      const isRegistered = slot.registered.includes(voteId);

      // premier créneau où il est inscrit, on le laisse inscrit
      if (isRegistered && !isRegisteredOnce) {
        isRegisteredOnce = true;
        continue;
      }
      // déjà inscrit dans un créneau précédent, on l'enlève des inscrits
      // (passera en liste d'attente dans la logique suivante)
      else if (isRegistered && isRegisteredOnce) {
        // if time passed and reregistered allowed we can leave it
        if (timePassed) {
          isRegisteredOnce = true;
          continue;
        }
        // else remove from registered (will be in reregistered waiting list)
        else slot.registered = slot.registered.filter((id) => id !== voteId);
      }
      // not registered yet -> actually in wl or wlr
      else {
        const isWaitingList = slot.waitingList.includes(voteId);
        const isWaitingListReregistered =
          slot.waitingListReregistered.includes(voteId);

        if (isFull()) {
          // if allowed to reregister -> must be in wl
          if (isAllowedToRegister()) {
            if (isWaitingListReregistered)
              slot.waitingListReregistered =
                slot.waitingListReregistered.filter((id) => id !== voteId);
            else continue;
          }
          // else -> must be in wlr
          else {
            if (isWaitingList)
              slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
            else continue;
          }
        } else {
          // if allowed to reregister -> remove from all wl -> will be in registered
          if (isAllowedToRegister()) {
            slot.waitingListReregistered = slot.waitingListReregistered.filter(
              (id) => id !== voteId,
            );
            slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
          }
          // else -> must be in wlr
          else {
            if (isWaitingList)
              slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
            else continue;
          }
        }
      }
    }
    // no changes if still no
    else continue;

    // not full -> add to registered
    if (!isFull() && isAllowedToRegister()) {
      slot.registered.push(voteId);
      isRegisteredOnce = true;
    }
    // full and not registered anywhere -> add to waiting list
    else if (isAllowedToRegister()) slot.waitingList.push(voteId);
    // already registered somewhere -> add to reregistered waiting list
    else slot.waitingListReregistered.push(voteId);
  }

  // ----- CHECK SI IL RESTE DE LA PLACE DANS LES INSCRITS D'UN CRENEAU -----
  let voteIdToRegister = "";
  poll.slots.forEach((slot) => {
    const isNotFull = slot.registered.length < slot.maxParticipants;
    const isWaitingListNotEmpty = slot.waitingList.length > 0;

    if (isNotFull && isWaitingListNotEmpty) {
      voteIdToRegister = slot.waitingList[0];
      return;
    }
  });

  if (voteIdToRegister) {
    poll = await updateSlotsArrayAfterDelete({
      poll,
      voteId: voteIdToRegister,
      timeBeforeAllowedPassed,
    });
  }

  return poll;
};

export const sendNotifications = async ({
  pollId,
  poll,
  voteId,
  newPoll,
  initialPoll,
}: {
  pollId: string;
  poll: PollWithSlots;
  voteId: string;
  newPoll: PollWithSlots;
  initialPoll: PollWithSlots["slots"];
}) => {
  // get new people registered to send notifications
  const votesNewlyRegistered = newPoll.slots.reduce(
    (obj, slot) => {
      obj.votesBySlot[slot.id] = [];

      const oldRegistered = initialPoll.find(
        (initialSlot) => initialSlot.id === slot.id,
      )!.registered;

      // get id addded in registered
      const newRegistered = slot.registered.filter(
        (id) => !oldRegistered.includes(id),
      );

      // push ids which are not in array yet
      newRegistered.forEach((id) => {
        if (!obj.votes.includes(id) && id !== voteId) {
          obj.votes.push(id);
          obj.votesBySlot[slot.id].push(id);
        }
      });

      return obj;
    },
    { votesBySlot: {}, votes: [] } as {
      votesBySlot: { [slotId: string]: string[] };
      votes: string[];
    },
  );

  // get subs from all the votes
  const votesWithSub = await prisma.vote.findMany({
    where: {
      id: { in: votesNewlyRegistered.votes },
    },
    select: {
      id: true,
      subscriptions: {
        select: {
          auth: true,
          endpoint: true,
          p256dh: true,
        },
      },
    },
  });

  Object.entries(votesNewlyRegistered.votesBySlot).forEach(
    ([slotId, votes]) => {
      const slot = poll.slots.find((slot) => slot.id === slotId)!;
      const frSlotDate = toZonedTime(slot.startDate, "Europe/Paris");
      const formattedDate = format(frSlotDate, "eeee d", { locale: fr });
      const formattedTime = format(frSlotDate, "HH:mm", { locale: fr });

      const payload = JSON.stringify({
        title: "Vous êtes inscrit !",
        body: `Bonne nouvelle, vous avez intégré les inscrits du ${formattedDate} à ${formattedTime} !`,
        link: `${process.env.DOMAIN}/poll/${pollId}`,
      });

      votes.forEach((vote) => {
        const voteSubs = votesWithSub.find(
          (voteWithSub) => voteWithSub.id === vote,
        )?.subscriptions;
        if (!voteSubs) return;

        voteSubs.forEach((sub) => {
          webpush
            .sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  auth: sub.auth,
                  p256dh: sub.p256dh,
                },
              },
              payload,
            )
            .then((res) => console.log("notif envoyée: ", res.statusCode))
            .catch((err) => console.log(err));
        });
      });
    },
  );
};

export const updateVoteName = action
  .schema(updateVoteNameSchema)
  .action(async ({ parsedInput: { voteId, name, subscription } }) => {
    await prisma.vote.update({
      where: { id: voteId },
      data: {
        name,
        subscriptions: {
          connectOrCreate: subscription
            ? {
                where: { endpoint: subscription.endpoint },
                create: {
                  ...subscription,
                },
              }
            : undefined,
        },
      },
    });
  });

export type PollWithSlots = Prisma.PollGetPayload<{ include: { slots: true } }>;
type Choice = {
  id: string;
  slotId: string;
  choice: number;
};
