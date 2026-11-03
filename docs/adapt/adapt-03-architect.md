Stage: 03 Architect
Status: Passed
Last updated: 2026-11-02

# 03 Architect: design and decisions

## Components
- **Web app** — Next.js App Router on Vercel ([ADR-001](decisions/ADR-001-nextjs-on-vercel.md)). Teacher-only in v1.
- **Database / auth / realtime** — Supabase ([ADR-002](decisions/ADR-002-supabase.md)).
- **File import** — Gemini via `/api/curriculum/import` ([ADR-003](decisions/ADR-003-gemini-file-import.md)).
- **Classroom connection** — Classroom API, server-side, teacher's OAuth grant ([ADR-005](decisions/ADR-005-classroom-api-from-web-app.md)).
- **Students** — use Google Classroom only. No account, no app pages.

## Data model
- Class → Unit → Section → ResourceTrack (Learn → Practice) + Checkpoints ([ADR-010](decisions/ADR-010-resource-track-model.md)).
- New: link table, curriculum item ↔ Classroom item id ([ADR-007](decisions/ADR-007-classroom-mapping-table.md)).
- Student data: cached names and progress from Classroom, wiped on class delete or Google disconnect ([ADR-009](decisions/ADR-009-student-data-cache.md)).

## Classroom mapping (from this session's design discussion)
- Unit → Topic · Learn → Material · Practice → Assignment · Checkpoint → graded Assignment.
- Progress gate → items past the gate stay unpublished.

## APIs / flows
- Approve curriculum → create or update Classroom items.
- Dated items → Classroom's own scheduling; fallback daily job ([ADR-006](decisions/ADR-006-scheduled-posting.md)).
- Turn-ins → pulled when the grid opens + refresh button ([ADR-008](decisions/ADR-008-sync-behaviour.md)).
- Checkpoint grades entered in the grid → written to Classroom.

## Auth
- Teacher keeps email/password; separate "Connect Google Classroom" step ([ADR-004](decisions/ADR-004-teacher-sign-in.md)).

## Access
- A teacher sees and edits only the classes she teaches (existing RLS).
- Students have no app access.
- Deletion: deleting a class or disconnecting Google wipes cached student data. Classroom itself is untouched.

## Failure modes
| Failure | Answer |
|---|---|
| Google API down or rate-limited | Silent retry |
| Classroom API won't take a scheduled publish time | Fall back to a daily job |
| She edits/deletes an app item directly in Classroom | Classroom wins; app adopts it |
| App down during class | Class carries on; she loses the grid for a while |

## Cost
- Ceiling $0. At 10x, Gemini's free limit (20 imports/day site-wide) breaks first.

## Hardest to change later
- The Classroom item mapping.

## Hosting
- Vercel + Supabase, free tiers.

## ADR index
- [ADR-001](decisions/ADR-001-nextjs-on-vercel.md) Next.js on Vercel — retroactive
- [ADR-002](decisions/ADR-002-supabase.md) Supabase — retroactive
- [ADR-003](decisions/ADR-003-gemini-file-import.md) Gemini file import — retroactive
- [ADR-004](decisions/ADR-004-teacher-sign-in.md) Teacher sign-in — live
- [ADR-005](decisions/ADR-005-classroom-api-from-web-app.md) Classroom API from web app — live
- [ADR-006](decisions/ADR-006-scheduled-posting.md) Scheduled posting — live
- [ADR-007](decisions/ADR-007-classroom-mapping-table.md) Mapping table — live
- [ADR-008](decisions/ADR-008-sync-behaviour.md) Sync behaviour — live
- [ADR-009](decisions/ADR-009-student-data-cache.md) Student data cache — live
- [ADR-010](decisions/ADR-010-resource-track-model.md) Resource-track model — retroactive

## OPEN
- OPEN: Tradeoffs and "revisit if" not stated for most ADRs.
