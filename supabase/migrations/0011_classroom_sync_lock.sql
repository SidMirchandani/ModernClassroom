-- One post to Google Classroom at a time per class.
--
-- Two posts running together both plan from the same empty set of links and
-- both create everything — which is how the first real test posted nine
-- quizzes twice. The sync route claims this column before it starts and
-- clears it when done; a claim older than the route's time limit is stale
-- (the run died) and may be taken over.
alter table public.classes add column classroom_sync_started_at timestamptz;
