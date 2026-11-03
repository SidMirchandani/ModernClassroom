Stage: 02 Define
Status: Passed
Last updated: 2026-11-02

# 02 Define: requirements and scope

## Jobs she hires it for
- Turn her year plan into Classroom without hand-typing it.
- See who's where, daily.
- Pace the class.

## Must-have for v1
| Feature | Traces to |
|---|---|
| Post plan to Classroom (topics + assignments) | Plan lives in her files; copying it into Classroom is manual |
| Scheduled posting (items appear on their date) | Same, plus pacing |
| Push plan updates to items already in Classroom | Keeping the two in step is repeated work |
| Pull turn-ins back from Classroom | Can't tell daily who is ahead, behind or stuck |
| File import (Gemini reads Word/Excel/PDF/photo) | Plan lives in her own files |
| Progress grid | Can't tell daily who is ahead, behind or stuck |
| Progress gate (class-wide) | Pace the class |
| Checkpoint grades | See who's where |

## Should-have
- None stated.

## Won't (v1)
- Student-facing pages (students stay in Classroom).
- Screenshot proofs (Classroom holds submissions).
- Per-student unlocking (class-wide gate is enough).
- Review & approve / send back.
- Help status.
- Offline sync / outbox.
- Invites & rosters (roster comes from Classroom).

## Kept as-is (not cut, not must)
- Demo mode (`/demo`).
- Theming / Customize.
- Email/password accounts.
- Background sync.

## Non-functional
- **Users, first term:** just Ms. Gomes.
- **Student data:** names + progress (turn-in states, grades). All students 13+.
- **Cost ceiling:** $0 (free tiers only). Gemini free tier (20 imports/day site-wide): one teacher shouldn't hit it. If she does, paying a few cents for imports is acceptable.
- **Down during class:** class carries on. Students are in Classroom anyway; she loses the grid for a while.
- **Devices:** school laptop/Chromebook, personal laptop, phone, classroom projector.

## Success metric (30 days)
- Count of items she still posts to Classroom by hand. Target: near 0.

## Gate
- Passed by the builder on 2026-11-02 with 7 won't items against 8 must-haves.
