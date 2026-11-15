-- DRY RUN: the duplicated choices of "VoteChoice" (same vote, same slot) and
-- which one the deduplication keeps. Reads only, changes nothing.
--
-- The kept choice is the one written last (most recent xmin): every edit of a
-- vote writes its new answer into one of the copies, so the last written one
-- holds the last answer of the person. Ties: the greatest id.
--
-- psql "$DATABASE_URL" -f docs/sql/vote-choice-unique-dry-run.sql

-- 1. every copy, kept or deleted
WITH ranked AS (
  SELECT vc.id, vc."voteId", vc."slotId", vc.choice,
         row_number() OVER w AS rank, count(*) OVER (PARTITION BY vc."voteId", vc."slotId") AS copies
  FROM "VoteChoice" vc
  WINDOW w AS (PARTITION BY vc."voteId", vc."slotId" ORDER BY age(vc.xmin) ASC, vc.id DESC)
)
SELECT p.title AS poll, v.name AS vote, s."startDate" AS slot, r.id AS "choiceId",
       r.choice, CASE WHEN r.rank = 1 THEN 'keep' ELSE 'DELETE' END AS action
FROM ranked r
JOIN "Vote" v ON v.id = r."voteId"
JOIN "Poll" p ON p.id = v."pollId"
JOIN "Slot" s ON s.id = r."slotId"
WHERE r.copies > 1
ORDER BY p.title, v.name, s."startDate", r.rank;

-- 2. the totals: the deduplication must delete exactly "choices to delete"
WITH ranked AS (
  SELECT row_number() OVER (PARTITION BY "voteId", "slotId" ORDER BY age(xmin) ASC, id DESC) AS rank
  FROM "VoteChoice"
)
SELECT count(*) FILTER (WHERE rank = 2) AS "votes and slots with copies",
       count(*) FILTER (WHERE rank > 1) AS "choices to delete"
FROM ranked;

-- 3. for information: registration polls (type 2) whose kept choice disagrees
-- with the lists of the slot (in a list but not a yes, or not coming but a
-- yes). Nothing is changed for them; a vote edit or a slot change by the
-- organizer puts them back in order.
WITH ranked AS (
  SELECT vc.*, row_number() OVER (PARTITION BY "voteId", "slotId" ORDER BY age(xmin) ASC, id DESC) AS rank,
         count(*) OVER (PARTITION BY "voteId", "slotId") AS copies
  FROM "VoteChoice" vc
)
SELECT p.title AS poll, v.name AS vote, s."startDate" AS slot, r.choice AS "kept choice",
       CASE WHEN r."voteId" = ANY (s.registered) THEN 'registered'
            WHEN r."voteId" = ANY (s."waitingList") THEN 'waiting list'
            WHEN r."voteId" = ANY (s."waitingListReregistered") THEN 'reregistered'
            WHEN r."voteId" = ANY (s."notComing") THEN 'not coming'
            ELSE 'no list' END AS list
FROM ranked r
JOIN "Slot" s ON s.id = r."slotId"
JOIN "Poll" p ON p.id = s."pollId"
JOIN "Vote" v ON v.id = r."voteId"
WHERE r.copies > 1 AND r.rank = 1 AND p.type = 2
  AND ((r.choice <> 1 AND r."voteId" = ANY (s.registered || s."waitingList" || s."waitingListReregistered"))
    OR (r.choice = 1 AND r."voteId" = ANY (s."notComing")))
ORDER BY p.title, v.name, s."startDate";
