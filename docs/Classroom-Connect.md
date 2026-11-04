# Modern Classroom × Google Classroom — the plan

> One doc for the next version: why, what, how, and where it stands.
> Built from the ADAPT session (detail lives in [`docs/adapt/`](adapt/)). Last updated: 2026-11-03 (simplified: no red line, no hand edits; grading designed).

## Intention

Ms. Gomes wants a tailored alternative to Google Classroom without moving her students off it. She uploads her syllabus at the start of the year, or whenever it changes, and the course in Classroom fills in and updates to match. Students keep using Classroom exactly as they do now. She gets the organized progress view Modern Classroom already has.

It should feel like Claude connecting to Google Calendar: she connects once, and the app edits Classroom and reads student activity on her behalf.

## The problem

Ms. Gomes's year plan lives in her own files, but her students live in Google Classroom, and keeping the two in step is manual, repeated work. Because Classroom has no view of self-paced progress, she also can't tell daily who is ahead, behind or stuck.

- **Who:** Ms. Gomes. She uses Google Classroom only today, and the pain is daily.
- **Her four pains:** re-posting the year by hand · not seeing who's where · re-editing when the plan shifts · students racing ahead or getting lost.
- **Evidence:** she asked for it herself.

## Goal

**Success in 30 days:** the number of items she still posts to Classroom by hand is near 0.

What she hires it for:
- Turning her year plan into Classroom without retyping it.
- Seeing who's where, daily.
- Grading every lesson and quiz in one place.

## What changes

| | Today (v6.2) | Next version |
|---|---|---|
| Students | Sign in to Modern Classroom | Use Google Classroom only, with no account |
| Curriculum | Lives in the app | Lives in the app **and is posted to Classroom** |
| Progress | Students mark it in the app | Read from their Classroom turn-ins |
| Pacing | A red line locks sections in the app | Dates decide: each item posts on its day. To move something, change its date in the file |
| Grades | Quizzes only, entered in the app | Every lesson and quiz, entered in the grid, kept in Classroom's gradebook |

## Scope for v1

**Must-have**
- Post the approved curriculum to Classroom (topics and assignments).
- Scheduled posting: items appear on their date.
- Push plan updates to items already in Classroom.
- Pull turn-ins back into the grid.
- File import (Gemini reads Word, Excel, PDF or photos).
- Progress grid.
- Grades for every posted item.

**Won't (v1)**
- Student-facing pages.
- Screenshot proofs.
- Per-student unlocking.
- Review and approve, or send back.
- Help status.
- Offline sync / outbox.
- Invites, class codes and rosters (the roster comes from Classroom).
- The red line (progress gate).
- Editing the curriculum by hand (move dates, add or edit subunits). An updated file is the one way to change it.
- "Only when I say so" posting.

**Kept as is:** demo mode, theming, email/password accounts, background sync.

**Constraints**
- **Users:** one teacher in the first term.
- **Students:** all 13+. The app keeps names and progress.
- **Budget:** $0 on free tiers. Paying a few cents for imports is fine if she ever hits Gemini's daily limit.
- **Downtime:** if the app is down, class carries on in Classroom.
- **Devices:** school laptop or Chromebook, personal laptop, phone, projector.

## How it works

```
 Ms. Gomes ──► Modern Classroom (web app)              Students ──► Google Classroom
                ├─ upload syllabus → curriculum                         ▲   │
                ├─ progress grid, grades                                │   │ turn-ins,
                └─ sync ─────────── Classroom API ──── posts/edits ─────┘   │ grades
                          ▲                                                 │
                          └──────── pulled when the grid opens ◄────────────┘
```

**How curriculum maps onto Classroom**

| Modern Classroom | Google Classroom |
|---|---|
| Unit | Topic |
| Learn | Material |
| Practice (one per resource track) | Assignment |
| A lesson with nothing written in yet (how imports arrive) | One assignment per resource, due on its date |
| Checkpoint (quiz or test) | Graded assignment |

**Scheduling.** Each item has a **post date** (when students see it) and a **due date** (from the syllabus). She picks one rule: *on the lesson day* or *when the unit starts*. To change when something appears, she changes its date in her file and uploads it. Classroom's own scheduling posts each item on its date, so nothing on our side has to be running. **Proven on 2026-11-03.**

**Updating the plan.** It works the way it does now: changes are suggested and she approves or declines them row by row. Approved changes go to Classroom. Items already posted can have their dates and wording changed. Removing a posted lesson asks before deleting it in Classroom too.

**Sync**
- Turn-ins are pulled when the grid opens, plus a refresh button. The grid then updates live on her other devices.
- If Google is down or rate-limited, the app retries silently.
- Sync runs both ways, with no button ([ADR-012](adapt/decisions/ADR-012-two-way-sync.md)). A change to her curriculum reaches Classroom by itself. If she edits or deletes an app-made item directly in Classroom, **Classroom wins**: it shows here on next open or refresh, and stays until her curriculum changes that same thing.
- A lesson removed from her curriculum is deleted from Classroom only if no student has touched it.

**Sign-in.** She keeps her Modern Classroom email/password account and adds a one-time **Connect Google Classroom** step. Students never sign in; their roster, turn-ins and grades come through her Google permission.

**Data and privacy**
- Student names and progress are a cache of what's in Classroom. Deleting the class or disconnecting Google wipes it.
- Only the class's teacher can read it (Supabase row-level security).
- API keys are in Vercel's environment settings. Her Google refresh token is in a server-only Supabase table.
- Classroom's responses are parsed on the server.

## Grading

Decided 2026-11-03 ([ADR-011](adapt/decisions/ADR-011-grades-live-in-classroom.md)).

- **Grades live in Google Classroom.** Students exist only there, so every posted lesson and quiz is already a Classroom assignment with its own grade box. The grid reads and writes those. Classroom's gradebook is the one copy; there is no grade table of ours to keep in step.
- **One grade per resource.** A lesson with two resources (0.2 Next-Gen, 0.2 Delta Math) is two Classroom assignments, so two marks, matching Classroom's gradebook column for column.
- **Out of 100 by default**, lessons and quizzes alike. Each column's header has its total; changing it changes the assignment's points in Classroom.
- **Marks are drafts until returned.** Typing a mark sets Classroom's *draft* grade, which only the teacher sees. A **Return grades** button on each column releases every mark in it to students.
- **Each cell shows the mark and the turn-in status**, e.g. *18 / 100 · Turned in*, *Missing*, *Not yet*.
- **Classroom wins** (ADR-008): a mark she changes in Classroom shows in the grid on the next open or refresh.
- **Comes after M3:** the grid needs Classroom's roster first.

Columns follow the curriculum: each lesson's resources, then the quizzes and tests that come after it.

## Key decisions

Full records are in [`docs/adapt/decisions/`](adapt/decisions/).

| # | Decision | Why |
|---|---|---|
| 001 | Next.js on Vercel | Already knew it |
| 002 | Supabase | Realtime sync, which now means live grid updates |
| 003 | Gemini reads uploaded files | Free tier |
| 004 | Email/password plus Connect Google Classroom | Chosen by the builder |
| 005 | Classroom API from the web app (not a Chrome extension or add-on) | Students stay in Classroom; an add-on needs a paid licence |
| 006 | Classroom's own scheduling | Proven to work; the daily-job fallback isn't needed |
| 007 | Links to Classroom items in a new Supabase table | The hardest part to change later |
| 008 | Pull on open, silent retry, Classroom wins | Chosen by the builder |
| 011 | Grades live in Classroom, one per resource, drafts until returned | Students exist only in Classroom |
| 009 | Student data is a cache, wiped on delete | Students only exist in Classroom |
| 010 | Sections with parallel resource tracks | Her three resources cover the same material in different orders |
| 012 | Two-way sync: remember what each side last said | The only way to tell which side changed |

## Risks and what's proven

| Assumption | Status |
|---|---|
| The Classroom API accepts a scheduled publish time | ✅ **Proven** (M1, 2026-11-03) |
| Her school's Google admin approves the app | ⏳ Check the district's app policy; she forwards the request after the demo |
| Her Google permission can read every student's turn-ins and grades | ⏳ M3 |
| She can connect, upload and approve without help | ⏳ M6 |
| The import reads her real files well enough | Builder is ~99% sure |
| She'll stop posting in Classroom by hand | Builder is ~99% sure |
| "Classroom wins" won't surprise her | ⏳ M6 |

**Known limit:** the API can only edit Classroom items that this app created. Anything she has posted by hand stays hers, and shows read-only in the grid.

## Milestones

| # | Milestone | Done when | Status |
|---|---|---|---|
| M1 | Spike: connect Google and schedule a draft | An API-made scheduled draft publishes on its own in a personal-Gmail class | ✅ Done (2026-11-03) |
| M2 | Post the approved curriculum | Approving a real syllabus creates every topic and assignment, scheduled on their dates, with no duplicates | ✅ Done (2026-11-03) |
| M3 | Roster and turn-ins from Classroom | The grid lists the Classroom class's students; a test student's turn-in shows after opening or refreshing; the cache is wiped on delete or disconnect | Built, not yet verified with a real student |
| M4 | Grades for every item | See *Grading* below: a mark typed in the grid is a draft in Classroom, "Return grades" releases a column, and a mark changed in Classroom shows in the grid | Built; marks and returning not yet run with a real student |
| M5 | Push plan updates | A changed syllabus works as it does today: changes are suggested, approved or declined, and approved ones reach Classroom; edits made in Classroom come back | Built; calls checked on real Google, full flow not yet verified |
| M6 | Demo to Ms. Gomes | The 5-minute demo runs clean on personal-Gmail accounts, she says yes, and the request is with school IT | |

## Taking it to Ms. Gomes

Show her the demo first and raise the approval afterwards.

1. **Demo (about 5 minutes, on personal Gmail accounts):**
   - Upload her syllabus, and Classroom fills in.
   - A student turns in work on a phone, and the grid updates.
   - A grade entered in the grid lands in Classroom.
2. **The ask:**

   > "To run this on your real classes, your school's Google admin needs to approve the app, the same way they approved Kahoot or Mote. It's a one-time setting. I'll write the request for you to forward."

3. **Fallback:** if IT says no, the current Modern Classroom still works on its own. The Classroom connection is a layer on top, not a rebuild.

Ms. Gomes never does any Google Cloud setup. That was a one-time developer step. She clicks **Connect Google Classroom**, picks her account and clicks **Allow**.

## How it gets built

- **AI rules:** prompt from these docs, review every diff, make small commits, be able to explain every line, and have tests before merge.
- **Tests needed before she uses it:**
  - the curriculum-to-Classroom mapping
  - turn-in states mapping to grid statuses
  - grades in both directions
- **Today:** 55 Vitest cases on curriculum logic, with no CI running them.
- **Feedback:** she texts or emails the builder.

## Open items

- What's the rollback if a release breaks during class?
- Most decision records don't yet say which tradeoffs were accepted or when to revisit the decision.
