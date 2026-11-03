# Modern Classroom × Google Classroom — the plan

> One doc for the next version: why, what, how, and where it stands.
> Built from the ADAPT session (detail lives in [`docs/adapt/`](adapt/)). Last updated: 2026-11-03.

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
- Pacing the class.

## What changes

| | Today (v6.2) | Next version |
|---|---|---|
| Students | Sign in to Modern Classroom | Use Google Classroom only, with no account |
| Curriculum | Lives in the app | Lives in the app **and is posted to Classroom** |
| Progress | Students mark it in the app | Read from their Classroom turn-ins |
| Pacing | Gate locks sections in the app | Gate decides what is published in Classroom |
| Grades | Entered in the app | Entered in the app and written to Classroom's gradebook, and back |

## Scope for v1

**Must-have**
- Post the approved curriculum to Classroom (topics and assignments).
- Scheduled posting: items appear on their date.
- Push plan updates to items already in Classroom.
- Pull turn-ins back into the grid.
- File import (Gemini reads Word, Excel, PDF or photos).
- Progress grid.
- Progress gate (whole class).
- Checkpoint grades.

**Won't (v1)**
- Student-facing pages.
- Screenshot proofs.
- Per-student unlocking.
- Review and approve, or send back.
- Help status.
- Offline sync / outbox.
- Invites and rosters (the roster comes from Classroom).

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
                ├─ progress grid, gate, grades                          │   │ turn-ins,
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
| Checkpoint (quiz or test) | Graded assignment |
| Past the progress gate | Not yet published |

**Scheduling.** Each item has a **post date** (when students see it) and a **due date** (from the syllabus). When reviewing an import she picks one rule: *on the lesson day*, *when the unit starts*, or *only when I move the gate*. She can then change any single row. Classroom's own scheduling posts each item on its date, so nothing on our side has to be running. **Proven on 2026-11-03.**

**Updating the plan.** It works the way it does now: changes are suggested and she approves or declines them row by row. Approved changes go to Classroom. Items already posted can have their dates and wording changed. Removing a posted lesson asks before deleting it in Classroom too.

**Sync**
- Turn-ins are pulled when the grid opens, plus a refresh button. The grid then updates live on her other devices.
- If Google is down or rate-limited, the app retries silently.
- If she edits or deletes an app-made item directly in Classroom, **Classroom wins** and the app adopts the change.

**Sign-in.** She keeps her Modern Classroom email/password account and adds a one-time **Connect Google Classroom** step. Students never sign in; their roster, turn-ins and grades come through her Google permission.

**Data and privacy**
- Student names and progress are a cache of what's in Classroom. Deleting the class or disconnecting Google wipes it.
- Only the class's teacher can read it (Supabase row-level security).
- API keys are in Vercel's environment settings. Her Google refresh token is in a server-only Supabase table.
- Classroom's responses are parsed on the server.

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
| 009 | Student data is a cache, wiped on delete | Students only exist in Classroom |
| 010 | Sections with parallel resource tracks | Her three resources cover the same material in different orders |

## Risks and what's proven

| Assumption | Status |
|---|---|
| The Classroom API accepts a scheduled publish time | ✅ **Proven** (M1, 2026-11-03) |
| Her school's Google admin approves the app | ⏳ Check the district's app policy; she forwards the request after the demo |
| Her Google permission can read every student's turn-ins and grades | ⏳ M3 |
| Holding items unpublished works as the gate | ⏳ M2 |
| She can connect, upload and approve without help | ⏳ M6 |
| The import reads her real files well enough | Builder is ~99% sure |
| She'll stop posting in Classroom by hand | Builder is ~99% sure |
| "Classroom wins" won't surprise her | ⏳ M6 |

**Known limit:** the API can only edit Classroom items that this app created. Anything she has posted by hand stays hers.

## Milestones

| # | Milestone | Done when | Status |
|---|---|---|---|
| M1 | Spike: connect Google and schedule a draft | An API-made scheduled draft publishes on its own in a personal-Gmail class | ✅ Done (2026-11-03) |
| M2 | Post the approved curriculum, with the gate | Approving a real syllabus creates every topic and assignment, and items past the gate stay unpublished | Next |
| M3 | Pull turn-ins into the grid | A test student's turn-in shows after opening or refreshing the grid; other devices update live; the cache is wiped on delete or disconnect | |
| M4 | Checkpoint grades both ways | A mark entered in the grid shows in Classroom's gradebook, and the reverse | |
| M5 | Push plan updates | A changed syllabus works as it does today: changes are suggested, approved or declined, and approved ones reach Classroom | |
| M6 | Demo to Ms. Gomes | The 5-minute demo runs clean on personal-Gmail accounts, she says yes, and the request is with school IT | |

## Taking it to Ms. Gomes

Show her the demo first and raise the approval afterwards.

1. **Demo (about 5 minutes, on personal Gmail accounts):**
   - Upload her syllabus, and Classroom fills in.
   - Move the gate, and the next section appears.
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
  - the gate's publish logic
  - turn-in states mapping to grid statuses
  - grades in both directions
- **Today:** 55 Vitest cases on curriculum logic, with no CI running them.
- **Feedback:** she texts or emails the builder.

## Open items

- What's the rollback if a release breaks during class?
- Most decision records don't yet say which tradeoffs were accepted or when to revisit the decision.
