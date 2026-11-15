-- ROLLBACK of vote-choice-unique.sql: drops the unique index, so that a
-- version of the app without @@unique([voteId, slotId]) deploys again
-- (its `prisma db push` would otherwise drop the index itself: no data loss).
--
-- The deleted copies are not needed by any version of the app. To put them
-- back anyway, insert the rows returned by the DELETE, AFTER dropping the index:
--   INSERT INTO "VoteChoice" (id, "voteId", "slotId", choice) VALUES (...), (...);

DROP INDEX IF EXISTS "VoteChoice_voteId_slotId_key";
