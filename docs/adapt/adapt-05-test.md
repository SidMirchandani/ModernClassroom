Stage: 05 Test
Status: Passed with open items
Last updated: 2026-11-02

# 05 Test: the product, then yourself

## Tested today
- 55 Vitest cases on curriculum logic: `lib/curriculum-diff.test.ts`, `lib/curriculum-edit.test.ts`, `lib/curriculum-review.test.ts`.
- No CI runs them. The only workflow (`keep-supabase-awake.yml`) pings Supabase.
- Nothing Classroom-related is tested yet.

## Must be tested before Ms. Gomes touches the Classroom version
- Curriculum → Classroom mapping (Unit / Learn / Practice / Checkpoint → the right Classroom items).
- Gate publish logic (only items up to the gate publish; moving it publishes the next).
- Turn-in → grid status (Classroom submission states map to grid statuses).
- Grades both ways (grid ↔ gradebook stays consistent; Classroom wins on conflict).
- Rule: tests before merge (from [04 Prototype](adapt-04-prototype.md)).

## Real users now
- None. Only the demo and the builder.

## Privacy / security
- **Secrets:** API keys in Vercel env; her Google refresh token in a server-only Supabase table.
- **Who reads student data:** only the class's teacher, via RLS.
- **Input validation:** Classroom API responses are parsed server-side.

## Rollback
- OPEN: what is the rollback if a release breaks during class?

## Feedback channel
- She texts or emails the builder directly.

## Retro
- Not yet. Runs after the first milestone ships.
