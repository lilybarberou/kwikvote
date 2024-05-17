const PrismaClient = require('@prisma/client').PrismaClient;
const webpush = require('web-push');
const { format } = require('date-fns/format');
const { fr } = require('date-fns/locale/fr');
const cron = require('node-cron');

webpush.setVapidDetails('mailto:' + process.env.NEXT_PUBLIC_VAPID_EMAIL, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

const prismaClientSingleton = () => {
  return new PrismaClient();
};

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

// ----------------------------------------------------------------

const doStuff = async () => {
  try {
    const cronSchedules = await prisma.cronSchedule.findMany({
      where: {
        schedule: {
          lte: new Date(),
        },
      },
      select: {
        id: true,
        poll: {
          select: {
            id: true,
            title: true,
            timeBeforeAllowedType: true,
            msBeforeAllowed: true,
            slots: {
              select: {
                id: true,
                startDate: true,
                maxParticipants: true,
                registered: true,
                waitingList: true,
                waitingListReregistered: true,
                notComing: true,
              },
              orderBy: {
                startDate: 'asc',
              },
            },
          },
        },
      },
    });

    // if no cron schedules, return
    if (cronSchedules.length === 0) return console.log('No cron schedules found');

    const pollsDone = [];

    for (const cronSchedule of cronSchedules) {
      if (pollsDone.includes(cronSchedule.poll.id)) continue;
      pollsDone.push(cronSchedule.poll.id);
      const poll = cronSchedule.poll;

      const initialPoll = JSON.parse(JSON.stringify(poll.slots));
      let newPoll = undefined;

      const timeBeforeAllowedPassed = checkTimeBeforeAllow({
        timeBeforeAllowedType: poll.timeBeforeAllowedType,
        msBeforeAllowed: poll.msBeforeAllowed,
        slots: poll.slots,
      });

      // check if still place in registered
      let voteIdToRegister = '';
      poll.slots.forEach((slot) => {
        if (slot.registered.length < slot.maxParticipants && timeBeforeAllowedPassed[slot.id]) {
          if (slot.waitingListReregistered.length > 0) {
            voteIdToRegister = slot.waitingListReregistered[0];
          }
        }
      });
      console.log('voteIdToRegister: ', voteIdToRegister);
      if (voteIdToRegister) {
        newPoll = await updateSlotsArray({ poll, voteId: voteIdToRegister, timeBeforeAllowedPassed });

        // get new people registered to send notifications
        const votesNewlyRegistered = newPoll.slots.reduce(
          (obj, slot) => {
            obj.votesBySlot[slot.id] = [];
            const oldRegistered = initialPoll.find((initialSlot) => initialSlot.id === slot.id).registered;

            // get id addded in registered
            const newRegistered = slot.registered.filter((id) => !oldRegistered.includes(id));

            // push ids which are not in array yet
            newRegistered.forEach((id) => {
              if (!obj.votes.includes(id)) {
                obj.votes.push(id);
                obj.votesBySlot[slot.id].push(id);
              }
            });

            return obj;
          },
          { votesBySlot: {}, votes: [] }
        );
        console.log('votesNewlyRegistered: ', votesNewlyRegistered);

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

        // send notifications
        Object.entries(votesNewlyRegistered.votesBySlot).forEach(([slotId, votes]) => {
          const slot = poll.slots.find((slot) => slot.id === slotId);
          const formattedDate = format(slot.startDate, 'eeee d', { locale: fr });

          const payload = JSON.stringify({
            title: 'Vous êtes inscrit !',
            body: `Bonne nouvelle, vous avez intégré les inscrits du ${formattedDate} à ${format(slot.startDate, 'kk:mm', { locale: fr })} !`,
            link: `${process.env.DOMAIN}/poll/${poll.id}`,
          });

          votes.forEach((vote) => {
            const voteSubs = votesWithSub.find((voteWithSub) => voteWithSub.id === vote)?.subscriptions;
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
                  payload
                )
                .then((res) => console.log('notif envoyée: ', res.statusCode))
                .catch((err) => console.log(err));
            });
          });
        });
      }
      // move wlr to wl if time passed
      else {
        poll.slots.forEach((slot) => {
          if (timeBeforeAllowedPassed[slot.id]) {
            slot.waitingList = [...slot.waitingList, ...slot.waitingListReregistered];
            slot.waitingListReregistered = [];
          }
        });
      }

      // update slots in db
      for (const slot of newPoll ? newPoll.slots : poll.slots) {
        await prisma.slot.update({
          where: { id: slot.id },
          data: slot,
        });
      }
    }

    // delete all these cron schedules as stuff is done
    const idsToDelete = cronSchedules.map((cronSchedule) => cronSchedule.id);
    await prisma.cronSchedule.deleteMany({
      where: {
        id: { in: idsToDelete },
      },
    });

    console.log('ok');
  } catch (err) {
    console.log(err);
  }
};

const updateSlotsArray = async ({ poll, voteId, timeBeforeAllowedPassed }) => {
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
    const isFull = slot.registered.length >= slot.maxParticipants;
    const currentVoteChoice = currentVoteData.choices.find((choice) => choice.slotId === slot.id);

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
        if (timeBeforeAllowedPassed[slot.id]) {
          isRegisteredOnce = true;
          continue;
        }
        // else remove from registered (will be in reregistered waiting list)
        else slot.registered = slot.registered.filter((id) => id !== voteId);
      }
      // not registered yet -> actually in wl or wlr
      else {
        const isWaitingList = slot.waitingList.includes(voteId);
        const isWaitingListReregistered = slot.waitingListReregistered.includes(voteId);
        const isAllowedToRegister = !isRegisteredOnce || timeBeforeAllowedPassed[slot.id];

        if (isFull) {
          // if allowed to reregister -> must be in wl
          if (isAllowedToRegister) {
            if (isWaitingListReregistered) slot.waitingListReregistered = slot.waitingListReregistered.filter((id) => id !== voteId);
            else continue;
          }
          // else -> must be in wlr
          else {
            if (isWaitingList) slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
            else continue;
          }
        } else {
          // if allowed to reregister -> remove from all wl -> will be in registered
          if (isAllowedToRegister) {
            slot.waitingListReregistered = slot.waitingListReregistered.filter((id) => id !== voteId);
            slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
          }
          // else -> must be in wlr
          else {
            if (isWaitingList) slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
            else continue;
          }
        }
      }
    }
    // no changes if still no
    else continue;

    // not full -> add to registered
    if (!isFull && (!isRegisteredOnce || timeBeforeAllowedPassed[slot.id])) {
      slot.registered.push(voteId);
      isRegisteredOnce = true;
    }
    // full and not registered anywhere -> add to waiting list
    else if (!isRegisteredOnce || timeBeforeAllowedPassed[slot.id]) slot.waitingList.push(voteId);
    // already registered somewhere -> add to reregistered waiting list
    else slot.waitingListReregistered.push(voteId);
  }

  // ----- CHECK SI IL RESTE DE LA PLACE DANS LES INSCRITS D'UN CRENEAU -----
  let voteIdToRegister = '';
  poll.slots.forEach((slot) => {
    if (slot.registered.length < slot.maxParticipants && timeBeforeAllowedPassed[slot.id]) {
      if (slot.waitingListReregistered.length > 0) {
        voteIdToRegister = slot.waitingListReregistered[0];
      }
    }
  });

  if (voteIdToRegister) {
    poll = await updateSlotsArray({ poll, voteId: voteIdToRegister, timeBeforeAllowedPassed });
  }
  // move wlr to wl if time passed
  else {
    poll.slots.forEach((slot) => {
      if (timeBeforeAllowedPassed[slot.id]) {
        slot.waitingList = [...slot.waitingList, ...slot.waitingListReregistered];
        slot.waitingListReregistered = [];
      }
    });
  }

  return poll;
};

const checkTimeBeforeAllow = ({ timeBeforeAllowedType, msBeforeAllowed, slots }) => {
  return slots.reduce((obj, curr) => {
    const now = new Date();

    // date to compare is day before at 5pm
    if (timeBeforeAllowedType == 1) {
      const dateToCompare = new Date(curr.startDate);
      dateToCompare.setDate(dateToCompare.getDate() - 1);
      dateToCompare.setHours(17, 0, 0, 0);

      obj[curr.id] = now.getTime() > dateToCompare.getTime();
    }
    // specific hours number before startDate
    else {
      obj[curr.id] = now.getTime() > curr.startDate.getTime() - msBeforeAllowed;
    }
    return obj;
  }, {});
};

console.log(`Cron started on '${format(new Date(), 'eeee d MMMM kk:mm', { locale: fr })}'`);

cron.schedule('*/1 * * * *', async () => {
  const formattedDate = format(new Date(), 'eeee d MMMM kk:mm', { locale: fr });
  console.log(`START -- ${formattedDate} -------------------`);
  await doStuff();
  console.log('END --------------------------------------------------');
});
