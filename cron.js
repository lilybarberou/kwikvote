const PrismaClient = require("@prisma/client").PrismaClient;
const webpush = require("web-push");
const { format } = require("date-fns/format");
const { fr } = require("date-fns/locale/fr");
const cron = require("node-cron");
const { toZonedTime } = require("date-fns-tz");
// the registration rules of the app, not a copy: lib/registration.ts, loaded
// by node itself (type stripping, Node 22.18 or later)
const {
  checkTimeBeforeAllow,
  getChoicesByVoteId,
  getSlotsInVoteOrder,
  openReregistrations,
} = require("./lib/registration.ts");

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
        pollId: true,
      },
    });

    // if no cron schedules, return
    if (cronSchedules.length === 0)
      return console.log("No cron schedules found");

    const pollIds = [
      ...new Set(cronSchedules.map((cronSchedule) => cronSchedule.pollId)),
    ];

    // each poll on its own: an error on one doesn't block the others
    for (const pollId of pollIds) {
      const cronScheduleIds = cronSchedules
        .filter((cronSchedule) => cronSchedule.pollId === pollId)
        .map((cronSchedule) => cronSchedule.id);

      try {
        // same lock as the app (prisma/db.ts withPollLock): votes, slots updates and
        // this cron must not recompute a poll's slots arrays at the same time
        const registration = await prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT set_config('lock_timeout', '10s', true)`;
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pollId}))`;

            // delete these cron schedules as stuff is done (kept if it fails)
            await tx.cronSchedule.deleteMany({
              where: { id: { in: cronScheduleIds } },
            });

            const poll = await tx.poll.findUnique({
              where: { id: pollId },
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
                  // same order as the app (lib/registration.ts slotsOrderBy)
                  orderBy: [{ startDate: "asc" }, { id: "asc" }],
                },
              },
            });
            if (!poll) return;

            const initialPoll = JSON.parse(JSON.stringify(poll.slots));

            // the choices of every vote of the poll; the ids of deleted votes
            // left by past concurrent writes are skipped (the app removes them
            // with lib/registration.ts repairDeletedVotes)
            const votes = await tx.vote.findMany({
              where: { pollId },
              select: {
                id: true,
                choices: {
                  select: { slotId: true, choice: true, priority: true },
                },
              },
            });

            const timeBeforeAllowedPassed = checkTimeBeforeAllow({
              timeBeforeAllowedType: poll.timeBeforeAllowedType,
              msBeforeAllowed: poll.msBeforeAllowed,
              slots: poll.slots,
            });

            // the same rules as the app: the reregistered people of the
            // opened slots get the free spots, the others join the waiting list
            openReregistrations({
              slots: poll.slots,
              choicesByVoteId: getChoicesByVoteId(votes),
              timeBeforeAllowedPassed,
            });

            // update changed slots arrays in db (not the dates)
            for (const slot of poll.slots) {
              const data = {
                registered: slot.registered,
                waitingList: slot.waitingList,
                waitingListReregistered: slot.waitingListReregistered,
                notComing: slot.notComing,
              };
              const initialSlot = initialPoll.find(
                (initialSlot) => initialSlot.id === slot.id,
              );
              const initialData = {
                registered: initialSlot.registered,
                waitingList: initialSlot.waitingList,
                waitingListReregistered: initialSlot.waitingListReregistered,
                notComing: initialSlot.notComing,
              };
              if (JSON.stringify(data) === JSON.stringify(initialData))
                continue;

              await tx.slot.update({
                where: { id: slot.id },
                data,
              });
            }

            // the people newly registered are notified
            const isSomeoneRegistered = poll.slots.some((slot) => {
              const before = initialPoll.find(
                (initialSlot) => initialSlot.id === slot.id,
              ).registered;
              return slot.registered.some((id) => !before.includes(id));
            });
            if (isSomeoneRegistered)
              return { poll, pollId: poll.id, initialPoll, newPoll: poll };
          },
          { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 30000 },
        );

        if (registration) {
          sendNotifications(registration).catch((err) => console.log(err));
        }
      } catch (err) {
        console.log(err);
      }
    }

    console.log("ok");
  } catch (err) {
    console.log(err);
  }
};

// the same as sendPush of lib/push.server.ts (this file is CommonJS): on a
// 404 or 410, the subscription expired or the browser unsubscribed, it will
// never work again (RFC 8030): it is deleted; other errors are only logged
const sendPush = (sub, payload) =>
  webpush
    .sendNotification(
      { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
      payload,
    )
    .then((res) => console.log("notif envoyée: ", res.statusCode))
    .catch((err) => {
      if (err?.statusCode !== 404 && err?.statusCode !== 410)
        return console.log(err);
      return prisma.subscription
        .deleteMany({ where: { endpoint: sub.endpoint } })
        .then(() => console.log("abonnement expiré supprimé"))
        .catch((err) => console.log(err));
    });

const sendNotifications = async ({ pollId, poll, newPoll, initialPoll }) => {
  // get new people registered to send notifications
  const votesNewlyRegistered = newPoll.slots.reduce(
    (obj, slot) => {
      obj.votesBySlot[slot.id] = [];
      const oldRegistered = initialPoll.find(
        (initialSlot) => initialSlot.id === slot.id,
      ).registered;

      // get id addded in registered
      const newRegistered = slot.registered.filter(
        (id) => !oldRegistered.includes(id),
      );

      // push ids which are not in array yet
      newRegistered.forEach((id) => {
        if (!obj.votes.includes(id)) {
          obj.votes.push(id);
          obj.votesBySlot[slot.id].push(id);
        }
      });

      return obj;
    },
    { votesBySlot: {}, votes: [] },
  );
  console.log("votesNewlyRegistered: ", votesNewlyRegistered);

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
  Object.entries(votesNewlyRegistered.votesBySlot).forEach(
    ([slotId, votes]) => {
      const slot = poll.slots.find((slot) => slot.id === slotId);
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

        voteSubs.forEach((sub) => sendPush(sub, payload));
      });
    },
  );
};

// imported by the tests: only the functions, no cron nor VAPID keys (the tests
// replace webpush.sendNotification); the rules come from lib/registration.ts
module.exports = {
  doStuff,
  getSlotsInVoteOrder,
  checkTimeBeforeAllow,
  sendNotifications,
};

if (require.main === module) {
  webpush.setVapidDetails(
    "mailto:" + process.env.NEXT_PUBLIC_VAPID_EMAIL,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  console.log(
    `Cron started on '${format(toZonedTime(new Date(), "Europe/Paris"), "eeee d MMMM kk:mm")}'`,
  );

  const task = cron.schedule("*/1 * * * *", async () => {
    const formattedDateFr = format(
      toZonedTime(new Date(), "Europe/Paris"),
      "eeee d MMMM kk:mm",
    );
    console.log(`START -- ${formattedDateFr} -------------------`);
    await doStuff();
    console.log("END --------------------------------------------------");
  });
  // node-cron 4 has no runOnInit option: the first run starts right away
  task.execute();
}
