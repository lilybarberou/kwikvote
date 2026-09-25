import { Prisma, PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient();
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// votes, slots updates and the cron read a poll's slots arrays, recompute them and
// write them back: one of them at a time per poll, or concurrent ones lose updates
export const withPollLock = <T>(
  pollId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) =>
  prisma.$transaction(
    async (tx) => {
      // fail instead of holding the connection when the poll stays locked
      await tx.$executeRaw`SELECT set_config('lock_timeout', '10s', true)`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pollId}))`;
      return fn(tx);
    },
    {
      // each query must see what the previous lock holder committed
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 10000,
      timeout: 30000,
    },
  );
