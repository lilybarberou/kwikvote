-- DEDUPLICATION of "VoteChoice", then the unique index of
-- @@unique([voteId, slotId]) (prisma/schema.prisma). To run ONCE, BEFORE
-- deploying the app with this schema: `prisma db push` (run by the build)
-- refuses to add a unique constraint without --accept-data-loss, even when
-- there is no duplicate; once the index exists, it finds the base in sync.
--
-- 1. pg_dump first, then the dry run (vote-choice-unique-dry-run.sql).
-- 2. psql "$DATABASE_URL" then \i docs/sql/vote-choice-unique.sql
-- 3. check that "DELETE n" is the "choices to delete" of the dry run, and keep
--    the rows the DELETE returns (they are what a rollback puts back),
--    then type COMMIT; (or ROLLBACK; if anything differs).
--
-- Rerunnable: with no duplicate left, DELETE 0, and the index is only created
-- if it is missing.

BEGIN;

-- no vote can be written while the copies are removed and the index built
LOCK TABLE "VoteChoice" IN SHARE ROW EXCLUSIVE MODE;

-- keep the copy written last (see the dry run), delete the others
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY "voteId", "slotId" ORDER BY age(xmin) ASC, id DESC) AS rank
  FROM "VoteChoice"
)
DELETE FROM "VoteChoice" vc
USING ranked r
WHERE vc.id = r.id AND r.rank > 1
RETURNING vc.id, vc."voteId", vc."slotId", vc.choice;

-- the name Prisma gives to @@unique([voteId, slotId])
CREATE UNIQUE INDEX IF NOT EXISTS "VoteChoice_voteId_slotId_key" ON "VoteChoice"("voteId", "slotId");

-- now type COMMIT; (or ROLLBACK;)
