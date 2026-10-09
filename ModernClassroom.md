# Modern Classroom

> **Master doc — the north star for this project.** Everything else (README, comments, code) should agree with this. Where code and doc conflict, the code wins and this doc gets fixed.
>
> Repo: [SidMirchandani/ModernClassroom](https://github.com/SidMirchandani/ModernClassroom) (public) · Last commit: `ModernClassroom v1.3: Update: Add master doc` · Last reviewed: 2026-08-17

## What it is

A self-paced classroom dashboard built around one teacher's actual way of running a course: a whole-year timeline broken into 42-minute lessons, and **three parallel resources per section** — an approved textbook, AP Classroom, and a guided-notes series — that cover the same objectives in *different orders* and can never be forced onto one shared numbering.

Students open a section and see one button per resource. Each button expands into that resource's own learning targets, its **Learn** material, and its **Practice** deliverable, with its own status. Teachers author the curriculum, watch a live grid that shows *which resource* each student is stuck on, review submitted work, and drag a **progress gate** that caps how far the class can move ahead.

The pitch on the landing page: *"Your classroom, modernized."*

## Who it's for

Teachers running a self-paced or mastery-based course off multiple non-aligned resources, who want visibility without collecting work by hand — and students who want to move at their own speed without getting lost or racing ahead of the class.

---

## The domain model

```
User ──teaches──> Class ──has──> Unit[] ──has──> Section[]  (subunits: "3.1")
  └──enrolled in──┘                 │              ├─ objectives[]   shared targets
                                    │              ├─ date  (soft due date)
                                    │              └─ tracks[]       ⭐ one per resource
                                    │                   ├─ kind, label, reference
                                    │                   ├─ objectives[]  CED targets
                                    │                   ├─ optional?
                                    │                   └─ blocks[]  type: learn | practice
                                    └─ checkpoints[]   dated quizzes/tests/projects

StudentProgress: (classId, studentId) -> sections[sectionId].tracks[trackId] -> {learn, practice, …}
```

### Resource tracks — the core idea

A **`ResourceTrack`** is one source's path through a section. `kind` is one of
`textbook · apclassroom · guided · extra · custom`; `label` is what students see
("Next-Gen Textbook", "eMath Guided Notes"); `reference` records where the
section lands *in that source* — section 3.3 is "Ch 11 – Least Squares" in the
textbook and "Unit 3 Lesson 3" in the guided notes. That mismatch is the whole
reason tracks exist.

Inside a track the order is fixed: **Learn → Practice**. Across tracks there is
no order — all of them open the moment the section does.

- `optional: true` (Extra Material) means the track is visible and trackable but never gates the section.
- A track with no blocks of a given type simply has no such step; a track with no blocks at all is hidden everywhere.
- **Track ids are stable** (`"3.1::textbook"`), because student progress is keyed on them and legacy curricula are re-migrated on every read. `stableTrackId()` in `lib/section-tracks.ts` is the single source of that rule — never mint a uuid during migration.

### Checkpoints

Section dates are **soft due dates** — free text, shown as "Due 10/14", and they
never lock anything. Pacing is enforced by the gate alone.

`Checkpoint` is a dated marker anchored *between* sections (`afterSectionId`),
matching how the timeline sheet reads: Quiz 3A after 3.5, Quiz 3B after 3.7,
Unit Test at the end. `kind` ∈ `quiz · test · checkpoint · project`. Dates are
**free text** so `"10/12 or 10/13"` survives intact. Checkpoints are informational —
pacing is enforced by the gate, not by dates.

### Checkpoint grades

Checkpoints are the one thing in the app that carries a **mark** rather than a
status. `Checkpoint.maxPoints` is what it is scored out of (default 100), and a
student's result is a `CheckpointGrade` — `{ score, outOf }` — kept in
`StudentProgress.checkpoints`, keyed by checkpoint id.

Grading happens **in the table itself** — no dialog. Each checkpoint gets its own
column, positioned after the subunit it follows; the column header carries an
editable "out of" box and every cell under it is a number field. Type, tab away,
saved. Drafts are held while typing and committed on blur, so a half-typed "1"
of "18" never reaches the store.

Changing the total re-denominates the marks already given: raw scores stay put
and the denominator moves with the assignment, rather than leaving old marks
reading against a total that no longer exists. `outOf` is still stored per
student so nothing renders wrong in between.

Students see their own mark on the checkpoint row in the Class Dashboard.

### Progress rules — `lib/class-progress.ts`

The heart of the app; every rule lives here and nowhere else.

- **Within a track:** `learn` → `practice`. A step opens once the previous is *finished*, where finished means `done` **or** `help` — asking for help never blocks you.
- **Across tracks:** parallel. Stuck on the textbook? Keep going in AP Classroom.
- **Across sections:** section *N* is reachable only when every prior section is *finished* — every **required** track done-or-help.
- **A section is complete** when every required track has all its steps `done` (not `help`).
- **The progress gate** (`blockSectionId`) hard-caps access regardless of speed.
- **Access is always judged against the whole course**, never one unit's list. Passing a single unit's sections makes `isBeyondBlock` miss the gate entirely and unlocks the first section of every later unit — this was a real bug in `CourseOverview`.
- **Teacher review loop:** practice `done` with `practiceApproved !== true` surfaces as **Review** on that track. The teacher approves it (optionally with a grade) or sends *that track* back — reverting practice to `available`, dropping the proof, and flagging `sentBackForReview`.
- **Legacy progress** written before tracks (flat `learn/practice/extra`) is migrated on read by `migrateSectionProgress()` onto the `::custom` and `::extra` tracks that legacy curricula migrate to.

---

## How it's built

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 3 · lucide-react · **EB Garamond** (`next/font/google`, wired to `font-sans` so the whole app is set in it). Auth primitives via `bcryptjs` + `jose`. No test framework, no CI.

### One app, one demo

There is no separate demo build any more. `/demo` seeds the **real** store with
one account — named simply **Demo** — that *teaches* three courses and is also
*enrolled* in them, eight classmates filling each roster, and their progress.
It signs in and drops you on `/dashboard`, so the demo exercises the product
itself and cannot drift out of sync with it. `/student` and `/teacher` redirect
to `/demo`.

Because roles are per-class and the demo account holds both, the **Teaching**
tab opens each class as the teacher and **Enrolled** opens the same class as a
student (`?as=student`). No persona switcher — the tabs are the switch. The back
link carries `?tab=` so you return to the side you came from.

> ⚠️ Anything reading a class for the student must pass `"student"` to
> `getClassDetail`. A teacher enrolled in their own class otherwise gets the
> teacher payload, which strips their own progress row — the student view then
> renders as if they had done nothing.

`components/demo/DemoNotice.tsx` floats a dismissible one-liner at the top of
every dashboard route. It stays out of the way until it has something to say —
`lib/db/client.ts` fires a `DB_WRITE_EVENT` on every store write, and the notice
listens for the **first** one, then slides in. It never dims the page, and it
carries the Exit link that clears the seeded data.

> This replaced a parallel demo implementation — `TeacherDashboard.tsx` (1119
> lines), `StudentDashboard.tsx`, `DemoSubunitEditor.tsx` and four demo-only
> stores — all deleted. The duplication they carried was the repo's oldest
> known issue.

### Data layer — Supabase, with the browser as a cache

Everything goes through **`lib/store/`**, one async `Store` interface with two
implementations and a router:

| File | What it is |
|---|---|
| `store/types.ts` | The `Store` interface, and the two events the app listens on |
| `store/local.ts` | The localStorage document. **The demo** (complete, offline, no account) *and* the cache for a signed-in user |
| `store/remote.ts` | Every call that touches Supabase. Row shapes go in, app shapes come out |
| `store/outbox.ts` | Writes that have not reached the server yet |
| `store/synced.ts` | Cache + remote + outbox, wired together |
| `store/index.ts` | `store` — what components import. Routes each call to whichever store is live |

**Reads are answered from the cache**, refreshed from Supabase first whenever
the server can be reached. **Writes land in the cache immediately** and are
queued; the queue is pushed at once if there is a connection and on the
`online` event or a 30-second timer if there is not. So every screen renders
the same way online and off, and the only difference is the pill in the navbar
(`components/SyncStatus.tsx`).

**The outbox is a map of intentions, not a log of keystrokes.** Each pending
write is keyed by the row it touches, so two offline edits to the same track
collapse into the latest and the queue cannot outgrow the number of rows a
person can touch. Tabs take a Web Lock before draining it. A write the server
*refuses* is dropped with a console error rather than retried forever — it
would never succeed, and one bad row must not block the rest.

| Key | Holds |
|---|---|
| `modern-classroom-db` | The demo's whole world |
| `modern-classroom-session` | The demo's "signed-in" user id |
| `modern-classroom-demo` | Flag: the demo is running |
| `modern-classroom-cache` | A signed-in user's offline copy |
| `modern-classroom-outbox` | Writes still to be pushed |
| `mc-force-offline` | Set to `"1"` in devtools to rehearse losing the connection |

**Accounts are Supabase Auth** (`lib/auth-client.ts`): email and password, no
confirmation step, sign-in **by email**. The username stays as a display and
invite handle — signing in by username would need a lookup that lets anyone
test whether an address has an account. A database trigger builds the profile
row from the signup metadata, minting the username by the app's own scheme
(last name + first initial, then a number if taken).

The demo never touches the server and has no account. Signing in leaves it.

> ⚠️ **Progress is stored per track, not per student.** One row per
> `(class, student, section, track)`. A student marking their guided notes and
> the teacher approving their textbook practice in the *same section* write
> different rows, so neither can overwrite the other. Grouping back into the
> one-row-per-student shape the grid reads happens in `store/remote.ts`.

> ⚠️ **Only meaningful progress is sent.** Locked/available is derived from the
> gate on every load, so a track nobody has touched carries nothing worth a
> row. Without that filter a student's first click wrote two hundred rows of
> `{"learn":"locked"}`.

> ⚠️ **`saveAllClassProgress` replaces only the rows it is given.** It used to
> clear every row for the class first. The teacher grid builds its list from the
> roster and `getClassDetail` strips the teacher's own progress row, so a
> teacher enrolled in their own class lost all their student progress the first
> time they approved a submission. Any writer that touches "all" of something
> should merge, not sweep.

### Importing a curriculum — `lib/curriculum-diff.ts`, `app/api/curriculum/import/`

Teachers already keep their year in a spreadsheet. The Curriculum tab takes
those files — Word documents, `.xlsx`, `.csv`, PDFs, photos of a printed plan — and proposes
the curriculum they describe. It only ever *proposes*: nothing is written until
the teacher has said yes to it, cell by cell if they want to.

The panel is teacher-only and curriculum-only by construction: it lives inside
`ClassTeacherView`, which `ClassPageClient` renders only when the class role is
teacher, and the route re-checks `classes.teacher_id` server-side so a crafted
POST from a student is refused rather than trusted.

**The route** (`app/api/curriculum/import/route.ts`) is where the Gemini key
lives and the only place it lives. It reads the class from the database rather
than trusting the browser's copy, turns spreadsheets and Word documents into
text with SheetJS (the model reads tables far better than binaries, and cannot
read a `.docx` at all) and passes PDFs and images inline. The reply is
constrained by a `responseSchema`, so it is parsed, not guessed at. Models are
tried in a **measured order**, not newest-first: `PREFERRED_MODELS` (3.5, 3.6,
3.7 Flash, `flash-latest`, 3.8) lead while the catalogue lists them, then the
rest of the catalogue, and **Lite models last of all** — they never fail, but
on a real timeline they stop after a unit or four and call it finished. The answer is **streamed**, which tells a model that is writing apart
from one stuck in Google's queue: no first word in 20s, or 25s of silence
mid-answer, and that model is dropped — but a model that is writing gets as
long as it needs, because a full year is 20–60s of output. When Google is busy
the route moves to a *different* model rather than waiting on the same one, and
it **hedges**: if the model it is waiting on is still silent at 8s, it starts
the next one alongside and takes whichever finishes first, aborting the other.
An answer cut off partway or not in the asked-for shape is retried on another
model rather than shown as an error. The prompt gives the model a **skeleton**: it
writes an `outline` of every unit first (number and title), then the units in
full; the number before a section's dot *is* its unit, one unit per unit
number; semesters, tabs and heading-only rows are never units; quizzes, tests
and projects (Qz, Tst, Pj) are checkpoints in the unit they assess with the
date the files give; review days are neither. When a timeline lays **several
plans side by side** (two textbooks, a platform, a framework), one column is
the class's sequence — the one numbered through the year in order with its own
headings and assessments, unless the teacher's notes name another — and every
other column becomes a resource track on that day's section. An answer whose
units fall short of its own outline (more than 15% missing), or that is empty
for an empty class, is retried on another model; if every model falls short,
the fullest partial answer is offered with a note to check it. Then
`shapeProposal` (`lib/curriculum-diff.ts`, tested) enforces the part that can
be checked in code: sections are regrouped by their unit number whatever the
model did, a lumped unit's title is dropped in favour of the existing unit's
or "Unit N", a new unit is titled "Unit N: Name", units are ordered by their first lesson's date (a class may teach
11 before 8), and a new checkpoint with no place in its unit is placed by date.
Sheets are flattened with SheetJS's `strip`, so a formatted sheet's hundreds
of empty columns do not eat the 400k-character budget. Up to seven distinct models per import, at
most two in flight, and no new attempt within 12s of the function's
`maxDuration` (180s) — so a teacher gets a real answer, never a platform
timeout. A model that came back busy is **cooled** for five minutes (moved to
the back of the queue, never removed), so the next import goes straight to one
that is working: on 2026-10-06 that took repeat imports from ~45s to ~1s. Every
failed attempt logs one line (`[import] gemini-3.8-flash failed (HTTP 503) after
3282ms`), which is what to read in the Vercel logs when an import fails.

Every import spends the operator's Gemini quota, so every caller is limited:
the demo to 8 an hour per address, a signed-in teacher to 30 an hour per
account. Files are parsed *before* either counter runs, so a wrong file type
costs a correction, not an import, and an import that fails on our side hands
its allowance back. The demo's curriculum arrives from the
browser and is shape-checked (and capped at 200k characters) before anything
walks it.

> ⚠️ **Uploads are capped at 4 MB because Vercel is.** A serverless function's
> request body tops out at 4.5 MB, and anything bigger gets the platform's own
> non-JSON 413 before the route runs. The old 15 MB limit was a promise the
> platform broke, and the browser then tried to parse an HTML error page as
> JSON. The import card now checks the size before sending, and the panel reads
> a non-JSON 413/504 into a sentence a teacher can act on.

> ⚠️ **Overload is per model, so never retry the same one.** The first version
> tried the configured model twice, then one sibling, then gave up — and on
> 2026-10-06 `gemini-3.8-flash` and `3.7-flash` were both returning 503 while
> `3.6` answered at once. Teachers saw *"Google's models are busy"* for an outage
> that never touched most of the catalogue. Walking down distinct models turned
> the same morning into 5–9s imports.

> ⚠️ **Newest is not best, and one cap on a whole answer kills working
> models.** On 2026-10-08 imports were failing more often than not. Measured
> against a year-long plan (60 sections, as a sheet and as a PDF): 3.6–3.8
> Flash — first in the old newest-first order, and 3.8 pinned by
> `GEMINI_MODEL` — dropped four answers in six partway through, the one that
> finished took 59s, and `gemini-flash-latest` answered 503 three times in
> three; 3.5 Flash and the Lite models answered every time in 21–29s. The old
> 40s cap per attempt then cut off even the models that were working. Reordering,
> streaming and limiting *silence* instead of total time took the same files to
> six imports in six, 2–28s each.

> ⚠️ **A free-tier Gemini key is 20 requests a day per model.** Google's 429
> says so ("limit: 20, model: gemini-3.5-flash"), and the whole site shares that
> allowance. Once a model's is spent it answers 429 for hours; the route reads
> Google's "retry in 1h17m" and skips that model until then. Below that, the
> chain falls to weaker models — which is how a teacher's real timeline came
> back as two units, then none. **Production needs a key with billing enabled**
> (Tier 1); an import costs a few cents.

**The diff engine** (`lib/curriculum-diff.ts`) is the part that matters, and the
one place in the repo with tests, because its failure mode is silent loss of
student work. Two rules it exists to keep:

> ⚠️ **A matched section keeps its own `tracks[]` objects, ids and all.** Track
> ids are opaque keys into `progress`; re-deriving one from a section's new
> number would orphan every mark filed under it. After a renumber a track id
> still reads `3.3::textbook` on section `3.4` — that is correct, and it is why
> history survives.

> ⚠️ **Silence is not a change.** A field the proposal leaves null keeps the
> teacher's existing wording. Only substance they can see is ever offered, so
> re-importing an unchanged sheet yields zero changes rather than a wall of
> re-phrasings.

Matching runs in passes over the whole proposal — every explicit id first, then
exact titles, then numbers — so a newly inserted `3.3` cannot claim the real
`3.3` before that section's own id has been read. Renumbers come back as an
ordered `SectionRemap[]`: a shift of `3.3→3.4→3.5` is emitted far-end-first so
no move ever lands on a key another move has yet to vacate, and a genuine swap
is broken with a scratch id.

**The review** replaces the curriculum table with the same table, marked up:
each changed cell shows `old → new` with its own ✓/✗, additions in emerald,
removals in rose and flagged as destructive, and a sticky bar with Approve all
· Deny all · Discard · Apply *n*. Nothing is pre-approved. Applying goes
through `store.applyCurriculum` with the version the teacher was looking at, so
a class edited elsewhere mid-review is refused rather than overwritten.

The demo can run it. The reading is real — a real call, a real diff — and only
the class it changes is local. It ships with **Try it with a sample**, which
builds a CSV out of the class's own timeline with a few deliberate edits, so a
visitor with no spreadsheet of their own still sees the honest result: on a
72-subunit class, four suggestions and sixty-eight rows left alone.

### Live updates — `lib/store/live.ts`, `lib/use-class-sync.ts`

A class is two people looking at the same thing from opposite sides, so both
sides move on their own. A student marking a step appears in the teacher's grid;
a teacher moving a date appears on the student's list. Supabase Realtime carries
the signal for `progress`, `checkpoint_grades`, `enrollments` and `classes`
(migration `0005`).

> ⚠️ **An event is only ever a nudge to re-read.** No payload from the socket is
> trusted as data; the re-read goes back through the store, the cache and
> row-level security like any other. A duplicate nudge therefore costs nothing.

> ⚠️ **Realtime must be handed the session token before subscribing.** The
> socket starts out holding the anon key, and RLS decides which changes are even
> visible — subscribe first and the stream comes back empty *and silent*, which
> is the worst of both worlds.

Re-reads never move the person: `settled` guards mean only the first read
chooses which unit is shown or which subunit a student lands on, and a teacher
halfway through typing a class name keeps what they have typed. `watchForeground`
is the backstop — returning to the window, or coming back online, re-reads too,
which is what makes the offline path finish honestly.

**What's new for a student** (`lib/curriculum-news.ts`) is a reading mark, not a
record: a per-person fingerprint of every subunit and checkpoint in
localStorage. On load it yields "new" or "updated" per item, shown as a small
badge in the sidebar and the Class Dashboard, a count on each collapsed unit,
and one banner with a *Got it*. Opening a subunit clears its own flag and
nothing else. The first time a class is ever opened, everything would be new —
so the snapshot is taken silently and nothing is flagged.

### The database — `supabase/migrations/`

Seven tables, all behind row-level security, and a small set of RPCs that are
the only way anything is written.

| Table | Notes |
|---|---|
| `profiles` | One per account. **No email column** — it lives in `auth.users`, so a classmate cannot read yours |
| `classes` | `units` as `jsonb`; `version` bumps on every curriculum write |
| `enrollments` | `(class, student)` |
| `invites` | A handle held until that person has an account |
| `progress` | `(class, student, section, track)` → state |
| `checkpoint_grades` | Teacher-authoritative |
| `section_aliases` | Where a renumbered section went |

RPCs: `create_class`, `join_class`, `invite_to_class`, `accept_invites`,
`upsert_track_progress`, `set_checkpoint_grade`, `apply_curriculum`,
`class_summaries`, `delete_account`. All `security definer`, all refuse an
anonymous caller, each checks its own permission. The security advisor lists
these under *"signed-in users can execute SECURITY DEFINER function"* — that is
intended: they are the app's whole write API, and the tables have no direct
write policies precisely so every write goes through a body that checks.

The access helpers (`is_class_teacher`, `is_enrolled`, `shares_class_with`) are
`security definer` too — an inline subquery in a policy has to evaluate the
*other* table's policies, which is how RLS turns recursive and slow. They live
in the **`private`** schema (migration `0008`), not `public`.

> ⚠️ **Policy helpers must not live in an exposed schema.** A policy runs as
> the caller, so the caller has to be able to execute its helpers — and
> PostgREST publishes anything a role can execute in `public` at
> `/rest/v1/rpc/<name>`. Left in `public`, `shares_class_with(uid)` let any
> signed-in user probe whether they share a class with an arbitrary account.
> `private` is not exposed, so the helpers still work inside policies while
> answering 404 as endpoints.

`public.ping()` (migration `0007`) is the one function an anonymous caller may
run: `security invoker`, empty `search_path`, touches no table. It exists for
the keep-awake workflow, because the obvious ping — an anonymous read of a real
table — is correctly refused.

**Verified by role** rather than by reading the policies: an account with no
seat in a class sees 0 classes, 0 progress rows and only its own profile; an
enrolled student sees their class, their own progress, their own grades, no
invites, and the profiles of people they share a class with.

**Renumbering a section moves its history.** `apply_curriculum` takes the new
units and a list of `{from, to}`, and in one transaction rewrites every
affected `progress.section_id`, moves the gate, records an alias, and bumps
`version`. Nothing is deleted: a section that goes away leaves its rows behind,
invisible but intact. `upsert_track_progress` resolves through the aliases, so
a write queued offline under `3.3` still lands after `3.3` became `3.4`.

> ⚠️ **Track ids are derived from the section id** — `stableTrackId` is
> literally `"3.3" + "::" + kind`, and that is how the templates mint them. A
> renumber must therefore **keep each matched section's existing `tracks[]`
> objects**, ids and all, and never re-derive them. Re-deriving orphans every
> student's work on that section, silently: it just renders as "not started".

### Starting a class — `app/dashboard/new/`, `lib/pending-import.ts`

A class starts from what the teacher already has. The new-class page asks for a
name, the teacher's materials (time line, syllabus, a photo of a printed plan)
and anything we should know — then **Create class**. There are no
ready-made courses to pick from any more; "Start with an empty class" is the
only other door.

The draft is made in the new class's own Curriculum tab, not on the new-class
page: the import route only reads for a class that exists and that the caller
teaches, and the Curriculum tab is where every proposal is reviewed anyway. So
the page creates the class **blank** (`createClassForTeacher(id, { name, blank:
true })` — no units at all), parks the files in `setPendingImport(classId, …)`
and moves to `?view=curriculum`, where `CurriculumPanel` takes them on arrival
and starts the read. The teacher's first sight of their new class is the AI's
draft forming; nothing reaches the class until they approve it.

> ⚠️ **A class address that is not a UUID is a missing class, not an error.** Leaving the demo switches the browser to the real store while a tab can still be on `/dashboard/class/demo-algebra-2`; Postgres answered that id with *"invalid input syntax for type uuid"*, and the student view's background reload threw it as a runtime crash. `remote.pullClass` now returns `null` for anything that is not a UUID without asking the server; the class page and subunit editor send any load failure back to the dashboard; and the class views' background reloads (every live nudge, every return to the tab) keep what is on screen when one fails, instead of throwing.

> ⚠️ **An AI-built class must start with no units.** The import never deletes
> a unit the files do not mention — that is what keeps a partial upload from
> wiping the rest of the year. So the old placeholder "Unit 1 / Subunit 1.1"
> would survive beside every unit the AI proposed. `blank` exists for exactly
> this; an empty class started by hand still gets the placeholder.

> ⚠️ **The hand-off is module memory, on purpose.** `File` objects cannot go
> into storage or survive a reload, and do not need to: it is a client-side
> navigation of a second or two. `takePendingImport` reads and forgets, and the
> panel checks once (a ref, so React's double-run of effects in development
> cannot start two reads). And the panel asks `isDemoMode()` directly when it
> builds the request — an import started on arrival runs before the effect
> that sets the `demo` state has.

`MaterialsPicker` is the one component for "attach files and say what matters",
shared by the new-class page and the Curriculum tab, so creating a class and
updating one ask the same thing the same way. It is a **composer**, the shape
people know from chat apps: one field for the notes, attached files as chips
inside it, attach on the left of its bottom bar and the send button on the
right, and the whole thing a drop target. An earlier open layout — a separate
attach button, file rows and an underlined text field — did not read as
somewhere to type, and its pieces drifted apart.

`lib/course-templates.ts` remains only as the source of the demo's three seeded
classes (see *Demo data*). Its subunits are numbered by the class unit, never
by the textbook — `9.1` is the first subunit of Unit 9 whatever chapter covers
it; the chapter lives in that resource's `reference` — which is the rule the
AI is told to follow as well.

### Layout

```
app/
  page.tsx                    Landing + AuthPanel
  dashboard/                  The app — class list, class view, subunit editor
    new/                      Start a class: name, materials, notes → AI draft (or empty)
  demo/                       Asks tour-or-no-tour, seeds the store, then enters
components/
  AppNavbar.tsx / NavCapsule.tsx   Fixed h-14 bar · the segmented tab pill
  Select.tsx / Popover.tsx    ⭐ portal-rendered dropdown · portal-rendered panel
  ConfirmDialog.tsx           The second ask, before anything irreversible
  SyncStatus.tsx              ⭐ offline / syncing / couldn't sync, in every navbar
  TodoButton.tsx              ⭐ past due / this week / next week
  AttachmentList.tsx          Shared link/file chips
  CheckpointRow.tsx           Shared dated quiz/test/project row
  TrackStatusDots.tsx         ⭐ per-resource status chips (T / AP / GN / EX)
  demo/DemoNotice.tsx         "Nothing is saved" — shows on the first edit
  tour/DemoTour.tsx           ⭐ the guided tour's panel and highlight ring
  student/
    ClassStudentView.tsx      ⭐ the shell: class strip, sidebar, section
    CourseOverview.tsx        ⭐ the Class Dashboard view (whole curriculum, dates, assessments)
    SectionView.tsx           ⭐ the three-button section
    TrackCard.tsx             ⭐ one expandable resource
    StepPanel.tsx             Learn or Practice inside a track (status + proof upload)
    SectionSidebar.tsx        One unit's sections, checkpoints interleaved
  teacher/
    ClassTeacherView.tsx      ⭐ the progress grid, gate, review + help flows
    SubunitTracksEditor.tsx   ⭐ author resources, targets, Learn/Practice blocks
    SubunitScheduleEditor.tsx Soft due date
    SubunitObjectivesEditor.tsx / ObjectiveListEditor.tsx
    CurriculumTable.tsx       Units · subunits · checkpoints (all editable)
    ClassCustomize.tsx        ⭐ the Customize tab — name, icon, colour
    TableProgressGate.tsx     The draggable red line
lib/
  types.ts                    ⭐ Section / ResourceTrack / Checkpoint / TrackProgress
  section-tracks.ts           ⭐ track helpers + legacy migration (deterministic ids)
  class-progress.ts           ⭐ unlock / status / review logic — the only copy
  todos.ts                    ⭐ due-date parsing + the three to-do buckets
  course-templates.ts         The demo's three seeded courses (not offered to teachers)
  pending-import.ts           Hands a new class's files to its Curriculum tab
  class-appearance.ts         ⭐ the eight accents and twelve class glyphs
  use-current-user.ts         The signed-in user, re-read on every store write
  curriculum.ts               Empty section factory + `shortUnitLabel`
  demo-units.ts               Seeded Algebra II Unit 3 with real objectives + dates
  demo-seed.ts                ⭐ the whole demo world, and its pinned clock
  tour.ts                     ⭐ the tour's stops, in order
  store/                      ⭐ the data layer: local · remote · outbox · synced
  supabase/client.ts          The browser Supabase client (cookie session)
  db/types.ts                 Row and DTO shapes (the store speaks these)
```

### The teacher's progress table

One row per student, one column per subunit in the **selected unit**, plus a
column for every checkpoint in it. The chrome around it:

- **The unit selector appears twice** — under the class name and again above the
  table, where the status-filter chips used to be. Both are the same `UnitNav`
  on the same state, so moving the unit in one place moves it in the other. (The
  old filter chips only dimmed each other; nothing was lost with them.)
- **Three keys**, labelled as such, sit left of the student search: **Resources**
  (the two-letter chips, built from the tracks actually present in the unit, so
  a class with a "Discovery Activity" gets `DA` in its own key), **Assignment
  Colors** (the five statuses) and **Title Colors** (quiz · test · checkpoint ·
  project). One list per vocabulary — a teacher looking up a colour should not
  have to read past the other two.
- **Checkpoint columns carry no kind label.** The title itself is coloured by
  kind, and `components/Tooltip.tsx` explains it on hover — a styled floating
  card, portalled to `<body>` at `z-250`, replacing the browser's native `title`
  bubble, which arrives late, in the OS font, and is unreadable on a dark page.
  The resource chips use the same tooltip.
- **The student column is sticky, thinner and blurred harder** than the rest of
  the chrome (`.float-pane-sticky`, 75% + `blur-xl`) — columns pass *under* it,
  so it reads as depth rather than a wall.
- **Columns size themselves to their title**, wide enough to wrap in two lines
  at most (`titleColumnWidth`), clamped so one wordy subunit cannot push the
  grid off the screen. Past that the table scrolls, which is what the sticky
  column is for.
- **The red gate line** is positioned from the section columns' refs; checkpoint
  columns sit between them without disturbing it.

### Navigating a class — the strip, the sidebar, the To-Do

The student's class page is three pieces of chrome and one canvas:

- **The class strip** (`h-11`, the class's own colour, white text) carries its
  glyph, the class name, and everything that moves you around it: **Class
  Dashboard**, a **unit navigator** (`‹ Unit 3 ›`), and **To-Do** at the right
  end. Below `md` only the name and
  To-Do stay; the other two move into the phone sheet.
- **The sidebar lists one unit at a time.** Seventy-two subunits in one scroll
  was the thing it replaced. The navigator picks the unit; opening a section
  from anywhere pulls the sidebar to that section's unit. Access is still judged
  against the *whole* course — a later unit's first section is only open once
  everything before it is done and the gate has passed it.
- **The canvas** is either the Class Dashboard (`CourseOverview.tsx` — the whole
  curriculum, dates and upcoming assessments) or one section.

**To-Do — `lib/todos.ts`.** Three buckets: past due, due this week, due next
week (weeks end Sunday, so "this week" shrinks as the week goes on). The same
component serves one class from its strip and every enrolled class from the
dashboard header, where each row names its class.

Three rules make the list mean something:

1. **Dates are read the way a teacher writes them.** `parseDueDate` takes the
   **last** `M/D` in the string — "10/12 or 10/13" is a window, and the work is
   not late until it closes — and hangs it off the school year (August onward is
   the autumn term; earlier months belong to the following calendar year).
2. **Nothing past the gate is owed.** Sections the teacher has not opened are
   not to-dos. Sections you are simply behind on are.
3. **A checkpoint inherits the section it follows.** Quizzes carry no progress of
   their own, so once the section before a quiz is signed off, the quiz drops
   off the list — otherwise "Unit 1 Test" stays overdue all year.

### Leaving, removing and deleting

Three ways a class or a roster seat ends, and they are not equally destructive:

- **A student leaves** a class from the `···` on its dashboard card.
- **A teacher removes a student** from the `···` beside their name in the
  progress table.
- **A teacher deletes a class** from the `···` on its dashboard card. The class,
  its curriculum, its roster, its invites and everyone's work go with it.

The first two are the *same* store operation — `unenrollStudent()` drops the
enrolment row and nothing else. **The progress row is deliberately left
behind:** it is invisible to everyone while that person is off the roster (the
teacher's grid reads progress against the roster, and `saveAllClassProgress`
merges rather than sweeps), and rejoining with the class code brings the year's
work back. A removal made in error is not a year lost — which is why the dialog
says so.

`deleteClass()` is the one that cannot be taken back, so it names the class and
its student count before it asks. Every one of the three goes through
`ConfirmDialog`, and in all three the cancel is the neutral button.

### Customize — how a class presents itself — `lib/class-appearance.ts`

A third tab beside **Classroom** and **Curriculum**, teacher-only. It sets the
class name, its **glyph** (twelve subject icons) and its **colour** (eight), and
the choices ride on the class itself, so a colour picked by the teacher is the
colour every student in that class sees — and only that class.

Both are ids into fixed maps, never free text: `color` and `icon` on `DbClass`,
each optional. It is a fixed set of eight rather than a hex field because every
option has to be legible in light and dark, as text and as a background — a free
picker cannot promise that. An unset glyph still falls back to the old
role-based default: a grid for a class you teach, a cap for one you sit in.

**The colour is not a class name — it is the `primary` ramp.** `primary` is
defined in `tailwind.config.ts` as `rgb(var(--primary-*) / <alpha-value>)`, and
the channels live in `globals.css`: the house blue on `:root`, then one block
per colour under `[data-accent="…"]`. `useClassTheme()` puts that attribute on
`<html>` while a class page is open and takes it off on the way out.

So **every** `text-primary` / `bg-primary/[0.85]` / `border-primary/30` /
`focus-visible` outline already in the app becomes that class's colour, with no
component knowing a colour exists — subunit numbers, unit titles, links, the
class strip, buttons, eyebrows, the avatar rings, the section headers in the
editor. It reaches portalled overlays too, which is why the attribute sits on
`<html>` and not on the page's own root: a dialog opened from a green class must
not come back blue. The dashboard is the one page holding several classes at
once, so there each card carries its own `data-accent`.

**A person has an accent too, and it is not the class's.** `DbUser.accent` is
set from the profile menu, where the eight options appear as swatches with no
names — the colours *are* the control. A new account is assigned one at random
rather than asked to choose; accounts made before the setting (and the seeded
classmates) fall back to one derived from the user id, which is effectively
random but stable across renders. It rides on the same `data-accent` attribute,
set on the avatar itself, so your initials stay yours on a page wearing a
different colour. Blue therefore needs its own `[data-accent="blue"]` block even
though `:root` already carries it — with no rule to match, an avatar asking for
blue inherits the class's palette instead of overriding it. And because the
choice is made in a menu floating over a page that also shows your name,
`useCurrentUser()` re-reads the store on `DB_WRITE_EVENT` rather than reading
once on mount; otherwise the name behind the menu keeps its old colour. That is why the attribute is `data-accent` and not
`data-class-color`: two different things can carry one.

Two colours are tuned rather than taken straight from Tailwind: **amber** runs a
step darker (600 is ~3:1 on white, too thin for 11px labels) and **slate**'s
`900` is really `800`, because the darkest slate *is* the dark page and the
strip would vanish into it. And the picker's blue swatch uses `bg-brand`, a
fixed hex — inside a rose class, `bg-primary` would paint it rose.

### The guided tour — `lib/tour.ts`

`/demo` asks one question before it seeds anything, because the two people who
arrive there want opposite things: someone who has never seen the app needs to
be shown where things are, and someone who has needs to be left alone. Both
landing-page buttons point here, so the choice is offered once and in one place.

Choosing the tour writes a step index to `localStorage`; `DemoTour`, mounted in
the dashboard layout, reads it and walks fourteen stops across both sides of a
class. A stop is a screen (`href` + a `place` name), a thing to look at
(`anchor`, matched against a `data-tour` attribute) and what that thing is for —
adding or reordering one is an edit to a single array.

**Changing screens is shown, never done silently.** Every stop names the screen
it is on in the panel header ("Step 6 of 14 · Teacher view"), the panel says
"Going to the student view…", and the page behind dips to 35% while it happens.

More than that, **the tour presses the buttons rather than jumping**. A stop
that moves you carries a `route` — the `data-tour` values of the controls to
click, in order. Each one is scrolled to, ringed, given a ripple at the point of
contact, held for ~220ms, and then genuinely `click()`ed, so the app navigates
through its own handlers. Reaching the student side is three presses —
**Dashboard → Enrolled → the class card** — and you watch all three, which
means you could repeat the trip yourself afterwards. `href` remains the
destination check and the fallback if a control cannot be found. Going *back*
skips the theatre: the controls that lead forward are on the screen you just
left, so Back simply returns.

Three things it deliberately does **not** do:

- **It does not block the page.** No scrim, no dimming — the ring is the only
  separation, so a stop can say "try one" and mean it. Same reasoning as popups
  blurring rather than darkening.
- **It does not re-run its own walk.** The travel effect reads the location from
  `window` instead of depending on `pathname`: a route changes the path halfway
  through, and depending on it would tear the walk down and restart it from the
  first click. A generation counter cancels a walk if the step changes under it.
- **It does not guess when to measure.** The ring tracks the smooth scroll frame
  by frame for ~900ms; a single reading taken after a guessed delay lands where
  the element was passing through. It also clamps to the viewport, because a
  stop can point at something taller than the screen.
- **It does not drive the UI through state it does not own.** The teacher's tabs
  became URL-addressable (`?view=curriculum`, `?view=customize`) so the tour
  navigates by link like anything else. That deep-linking is useful on its own.

The panel places itself in whichever half of the screen the ring is not; when
the ring fills the height — the table, the curriculum — it steps sideways
instead. Anchors must be **real boxes**: `display: contents` was tried on one
wrapper and measured as all zeros.

### Demo data — `lib/demo-seed.ts`

One account named **Demo**, eight classmates enrolled in all three classes, and
the three real courses instantiated from the templates:

| Class | Source | Gate |
|---|---|---|
| Algebra II, Honors | `algebra-2` template, Unit 3 replaced with the fully-authored sections | `3.6` |
| AP Precalculus | `ap-precalculus` template | `3.6` |
| AP Statistics | `ap-statistics` template | `3.6` |

**Every class opens in Unit 3** — units 1 and 2 signed off, the class a few
sections into the third, the gate at `3.6` and the signed-in student at `3.3`.
Reaches are **offsets from Unit 3's first section**, never absolute indices: the
courses have different-sized opening units (Algebra II reaches `3.1` after 8
sections, AP Precalculus after 29), so one spread lands correctly in all three.

> **The demo's clock is pinned.** `DEMO_TODAY` (14 Oct 2026) is what
> `referenceToday()` returns while the demo store is loaded. The timeline sheet
> runs September to June — against a real "today" the whole course would be in
> the future and nothing would ever be due. The date is chosen to sit inside
> Algebra II's Unit 3 so the To-Do has something in each of its three buckets.
>
> The three courses cannot all be on schedule at once: Algebra II teaches Unit 3
> in October, AP Statistics in December, AP Precalculus in January. The pinned
> date follows Algebra II — the class with the fully-authored unit — so in the
> two AP classes the demo student reads as comfortably ahead, and they
> contribute nothing to the To-Do.

> The signed-in account is enrolled in classes it teaches, so it has a progress
> row but no roster seat. `getClassDetail` drops that row for the teacher view —
> without it the grid dereferences an undefined student.

Its own student progress sits mid-course in every class, with the current
section deliberately mid-flight — one resource done, one submitted and waiting,
one asking for help — so the student view shows every state on open.

`seedProgressFor` walks each student a different distance in (`reaches` are
indices into the flattened section list), and Algebra II overlays the authored
Unit 3 spread on top — deliberately **uneven per track**, so the teacher grid
demonstrates what it is for: one student stuck on the guided notes while fine on
the textbook.

Students see the **whole year** in every class: all units listed and expandable,
with everything past the gate locked and unclickable.

---

## Running it

```bash
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev
```

Then open http://localhost:3000. Scripts: `dev`, `build`, `start`, `lint` (broken — see below), `fix-logo`.

### Environment

| Variable | Where it is used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser. Project settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser. The publishable key — safe there, every table is behind RLS |
| `GEMINI_API_KEY` | **Server only.** The curriculum import route. Never `NEXT_PUBLIC_` |
| `GEMINI_MODEL` | Optional, and best left unset. When set it is tried *before* the measured order (`PREFERRED_MODELS`), so pinning a busy model makes every import start on it — `gemini-3.8-flash` here was part of why imports failed on 2026-10-08. A retired name degrades to "used a different model", not to a broken import |

`.env.local` is gitignored; `.env.example` is the template. **`/demo` needs none
of them** — it is entirely local, which is also what makes it the fallback when
Supabase is not configured.

**Verified 2026-10-04** (v4.3): `npm run build` and `npm test` (18 specs) pass.
Supabase was found **paused** and restored — see known issue 1. Against the
live project: signup lands straight in the dashboard (no email confirmation),
sign-in works, and the authenticated curriculum import ran end to end — version
4→5, titles and a date applied, a subunit added, the other ten units untouched,
and the student's progress rows still on their original track ids.
Account deletion driven through the real UI, not just the RPC: the dialog
counted and named the class and its student, the confirm button stayed disabled
on load and on a near-miss word and only enabled on `DELETE`, clicking it while
disabled did nothing, and confirming redirected to `/`, emptied localStorage and
bounced a later `/dashboard` visit back to the login form. In the database the
account, its identity, its class, that class's progress and the enrolment were
all gone, while the **student's own account survived** and another teacher's
class and its two progress rows were untouched — every count back to baseline. Checked at 375px: no horizontal overflow on the
landing, the class page or the policies.

**Verified 2026-09-22** (v4.1): `npm run build` and `npm test` (17 specs) pass.
The import exercised in the demo against the live Gemini API: a sample built
from a 72-subunit class came back with **four** suggestions and every other row
untouched, ids and all; approving one cell moved exactly that cell and left the
denied title, date and new subunit alone. Live updates checked across the real
project — a `progress` write straight into Postgres flipped the teacher's grid
from *Active* to *Help!* with no reload, and a `classes` write refreshed the
cached curriculum to the new version the same way. A student's first visit to a
class recorded its curriculum silently and flagged nothing; a later change
raised *"Your teacher changed 2 things"* with `Upd` on the moved date and `New`
on the added subunit, and opening one cleared only its own flag.

**Verified 2026-09-22** (v4.0): `npm run build` passes. Exercised across two
sessions against the live project — signed up a teacher and a student, created
a class from the Algebra II template, joined it by code, marked tracks from the
student side and watched them appear in the teacher's grid, set a checkpoint
grade, renamed a subunit, changed the class colour. Rehearsed the connection
dropping with `mc-force-offline`: the write queued, the pill read
*"Offline — 1 change saved on this device"*, and clearing the flag flushed it
to Postgres. `/demo` still runs with no account and no network. RLS checked by
querying as each role rather than by reading the policies.

### Public pages — landing, privacy, terms

`/` is two pages at one address. With `?auth=login` or `?auth=signup` it is the
sign-in card and nothing else — a returning user came here to get in, not to
read a pitch — and every in-app redirect (`router.replace("/?auth=login")`)
still lands exactly where it did. Without it, `/` is the marketing page: what
the thing is, the resource-track idea, the import, and what makes it safe to
put a class in.

The pitch leads with how a class starts — attach your materials and the AI
drafts the curriculum (there are no ready-made courses on offer) — and shows
the product rather than describing it, in Supabase's language, minus the
boxes: one flat page colour, the brand blue used only for the primary
action and the second line of the hero, 1px borders instead of shadows,
medium-weight two-tone headings (the claim in ink, its tail in grey), and
almost no frames: the product miniatures sit on the page with hairlines between
rows, the feature vignettes stand on a grey plotting grid that fades into the
page, the steps are bare numbers, and the FAQ is rows split by rules. Only the
hero's grid keeps a window frame, because it is a picture of a window. Sections
rise a few pixels as they come into view, the grid mock fills in on a diagonal,
and two tiles loop between real states (offline → saved, active → done).
Nothing else moves.

> ⚠️ **Colour was tried and taken out.** An earlier pass on 2026-10-06 put a
> drifting colour field behind every screen, frosted cards, light beams, a
> gradient headline and cursor-following glows. It read as busy and generic, and
> was reverted the same day in favour of the flat system above. The lesson for
> next time: in this app restraint is the brand — reach for a border before a
> shadow, and grey before a second colour.

> ⚠️ **Motion is opt-in at the CSS layer, not the JS layer.** Every rule that
> hides or moves anything lives inside `@media (prefers-reduced-motion:
> no-preference)`. Nothing outside that guard sets `opacity: 0`, so a reader who
> asks for less motion gets the finished page immediately — verified by walking
> the live stylesheet for ungated hiding rules, not by reading the source.

> ⚠️ **`.reveal` needs a `<noscript>` escape hatch.** It starts hidden and waits
> for an IntersectionObserver to say otherwise, so with JS disabled everything
> below the hero would never appear. The landing page ships a `<noscript>` style
> that forces it visible. Any future JS-driven reveal needs the same.

The pitch shows the product rather than describing it. `components/landing/Mocks.tsx`
draws three miniatures — the teacher's grid, one subunit split by resource, and
the import's review — out of the app's own tokens, importing the real
`STATUS_CHIP` / `STATUS_DOT` vocabulary so the colours on the landing page can
never drift from the colours in the app. They are `aria-hidden` and nothing in
them is clickable; the prose beside each carries the meaning.

`/privacy` and `/terms` are real documents written against what the code
actually does, not a template. Both are worth re-reading whenever behaviour
changes, because they make specific claims:

- no analytics, no third-party scripts, nothing sold or shared — **verified**: the only outbound hosts in the codebase are curriculum resource links (Desmos, DeltaMath, Khan, YouTube);
- **no student data is ever sent to the AI** — the import posts curriculum structure and the teacher's own files, and nothing else;
- access is enforced by row-level security, not by the interface.

`lib/site.ts` holds the contact address, product name and policy date so prose
never hard-codes them. `app/robots.ts` keeps `/dashboard` and `/demo` out of
search results (tidiness, not security — RLS is the security), and
`app/sitemap.ts` lists the three public routes. Both read
`NEXT_PUBLIC_SITE_URL`, which should be set in production.

> ⚠️ **Seeding an auth user by hand needs the legacy token columns set to `''`.**
> `confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`
> and friends default to NULL on a manual insert, and GoTrue reads them into
> non-nullable strings — so sign-in fails with the useless *"Database error
> querying schema"* while the row looks perfectly fine. Signing up through the
> app never hits this; only hand-seeded test accounts do.

> ⚠️ **Deleting an account takes the classes you teach with it.**
> `delete_account()` (migration `0006`) removes them, and every student's work
> in them, because a class with no teacher is unreachable and leaving the
> records behind would be keeping data we were just asked to erase. The dialog
> counts and names exactly what will be lost and makes you type `DELETE` — but
> there is no export first, which is the next honest thing to build.

### Design system — Open* house theme

One brand blue, one status vocabulary, one radius scale. Tokens live in
`tailwind.config.ts` and `app/globals.css`; components never invent a colour.

- **One typeface: Poppins, everywhere.** Headings, body, labels, numbers, class codes and code samples alike — hierarchy comes from size, weight and grey, never from switching families. Tailwind's `sans`, `display` *and* `mono` all point at it, and `pre`/`code` inherit, so no class anywhere can quietly bring a second face back. **Nothing is heavier than medium:** Poppins at 600–700 read chunky at every size, so `tailwind.config.ts` maps `font-semibold`/`font-bold` (and heavier) to 500, `b`/`strong`/`th` are 500 in the base layer, and `layout.tsx` loads only 400 and 500. Hierarchy is size and grey, not weight. Body is `0.9375rem`; headings tighten to `-0.02em`.

> ⚠️ **The model catalogue is not the truth.** Google keeps listing
> `gemini-2.5-flash` in ListModels long after calling it returns *"no longer
> available to new users"*. So discovery alone is not enough: the route asks the
> catalogue what exists, ranks what follows the measured `PREFERRED_MODELS`
> (newer > older, stable > preview, full > lite), **and** strikes off any name it watches
> 404 so no later import spends a request on it. With a deliberately retired
> `GEMINI_MODEL` the first import still succeeded in 10.9s and the next took
> 2.6s — the difference is the dead name being remembered.

> ⚠️ **Name the model that actually failed.** The import tries the configured
> model, then siblings. Reporting the *configured* name when a fallback
> was the one that errored produced the worst possible message — *"gemini-3.6-flash
> is not available to this key"* while that model was working perfectly and a
> retired fallback had 404'd. A 404 now also falls through to the next model
> instead of killing the request: model names are retired on Google's schedule,
> and a retired default should degrade rather than take the feature down.

> ⚠️ **A font change is a layout change.** `titleColumnWidth()` in the teacher grid sizes each subunit column from a measured per-character width. That constant was `4.6` for Garamond and `5.05` for Inter; Poppins at the header's 10px measures **5.1** — measured in the browser across the real column titles, not guessed. Poppins is also wider at every size: the class code beside the tab capsule overran it at tablet width until the "Dashboard" label was held back to `lg`.

- **`primary` is the only accent** — nav, links, CTAs, focus rings, eyebrows, the current-section highlight. The teacher side used to run on violet; it does not any more. It defaults to the house blue `#2563ea` but **is not a fixed hex**: inside a class it becomes that class's colour (see *Customize*). `bg-brand` is the one fixed blue, for the colour picker's own swatch.
- **Colour sits on white, never on colour.** Chips are the card's own surface with a tinted border and tinted text; checkpoint rows are white with a thin coloured left stripe; the beyond-the-gate column is dimmed rather than tinted. Stacked tints were what made the page read as noise.
- **Status is one vocabulary** — `lib/status-styles.ts` holds the tonal chips every surface reads from: slate `Not Started` · sky `In Progress` · amber `Submitted` · rose `Help!` · emerald `Done`, plus `STATUS_DOT` for the bar/dot form. The student badges, the step chips, the teacher grid chips, the section-breakdown bars and the section pills all import it, so a colour never means two things. **Status colours never follow the class colour** — a step that is in progress is sky in a rose class too, or "in progress" and "done" would collide in a green one.
- **Resource hues are category identity only** — indigo textbook · violet AP Classroom · teal guided notes · amber extra · slate custom. They appear on the icon tile, the editor badge and the objective dot, never on chrome and never on a status. Attachments share one neutral treatment (`ATTACHMENT_CLASS`).
- **Buttons are three weights and nothing else** — `.btn-primary` (solid **ink** — black on light, white on dark — no border, no shadow; a filled brand-blue block was the loudest thing on every screen, so blue is kept for links, the active tab and "new" badges) for the one action a screen is for, `.btn-secondary` (1px border, no fill) for an equal alternative, `.btn-ghost` for minor actions, plus `.btn-danger`. Size is `.btn-sm` / `.btn-md` / `.btn-lg`, so height and radius are decided once. **A filled button never also carries a border, and an outlined one never carries a fill** — mixing the two is what made the app read as half-designed. A primary that is not ready yet turns **neutral grey**, not faded blue — a washed-out brand colour read as broken, worst of all in dark mode — while one that is working (`aria-busy`) keeps its full colour.
- **Flat by design, after Supabase.** One flat page colour (white, `#0b0f16` in dark). Every surface is `.surface` / `.card`: solid fill, a 1px `slate-200` (`slate-800` in dark) border, **no shadow**. Interactive cards answer the pointer with their border only — no lift, no glow. The class colour is spent sparingly: the primary button, the active tab, the student's class strip, a heading's accent line. Only true overlays (modals, dropdowns) carry a shadow.
- **Motion does a job or it does not happen.** Two curves in `:root` — `--ease-out` for anything arriving, `--ease-spring` for anything the hand moved. What stayed: a short fade-and-rise when a view changes (`.page-in`, `.list-in`), one sliding pill per tab bar (`useSlidingPill`, in `NavCapsule` and `SubunitViewToggle`), sections that slide to their exact height (`<Collapse>`, grid rows 0fr→1fr), stat numbers that count up (`useCountUp`), bars that grow in (`.bar-fill`), the light sweeping the import card while Gemini reads (`.scan-line`), and the theme switch spreading from the toggle as a circle (View Transitions API). All of it inside `prefers-reduced-motion: no-preference`.
- **Flat, but it answers the cursor** — the other half of what makes Supabase and Vercel feel alive. `<PointerTracker />` (one listener in the root layout, one write per frame, off on touch screens) feeds `--mx`/`--my` to every `[data-pointer]`, `.card-interactive` and `.edge-glow` under the pointer. With it: a card's 1px edge lights in the brand colour where the cursor is (`::after`, masked to the border); the line-art grid in a landing tile brightens in a circle beneath the cursor (`.line-grid-hot`); each landing vignette plays its change on hover (`.swap-a` / `.swap-b` — a student finishing, a help flag raised, offline changes landing), falling back to a slow loop on touch screens; the landing nav shares one highlight that glides between links (`<HoverNav>`); course cells go from grey to ink and reveal a detail line; and arrows nudge toward where they point.

> ⚠️ **The theme circle must run on an even curve, with every other transition off.** It first ran on a strong ease-out and looked like it stalled three-quarters of the way: the circle covered most of the screen at once, then crawled through the far corner. And because the new snapshot is live, cards and buttons were still easing their own colours inside the circle as it grew. `ThemeToggle` now uses a symmetric ease-in-out and puts `theme-switching` on `<html>` (all transitions `none`) until the view transition finishes. The circle itself is a **CSS animation** (`theme-reveal` on `:root.theme-switching::view-transition-new(root)`, centre and radius passed as `--vt-x`/`--vt-y`/`--vt-r`), not `element.animate()` from script: a transition ends when its own animations do (~250ms), and one added from script did not always hold it open — on phones the circle got halfway and the page snapped. Declared in CSS it is one of the transition's animations. Note that browsers skip view transitions on a hidden page — test it with the window in front.

> ⚠️ **An edge glow cannot sit on an `overflow-hidden` card.** The ring is the card's own `::after` at `inset: -1px`, over the border — and `overflow: hidden` clips a pseudo-element to the padding box, so the ring vanishes. The grid and diff mocks are `overflow-hidden` for their tables and so get row hovers instead.

> ⚠️ **`<Collapse>` unmounts when closed.** A closed track can hold video embeds; keeping every one mounted would load all of them on every page. It mounts on open and unmounts after the close animation, via `useOverlayTransition`.
- **No native `<select>`.** `components/Select.tsx` draws the option list, because the browser's own popup ignores the app's font and highlight colour. It renders through a **portal**: these sit inside `overflow-x-auto` tables and `overflow-hidden` cards that would clip an absolutely-positioned menu.
- **One scrollbar, everywhere**: `scrollbar-width: thin` with a transparent track, and matching `::-webkit-scrollbar` rules for the engines that ignore it (8px track, 4px thumb via a transparent border and `background-clip: content-box`). The native Windows bar is a 17px grey gutter with arrow buttons — a piece of the OS sitting on the page.
- **Students get a class-coloured strip** (white text) so the room they are in is unmistakable; teachers keep the neutral strip. In dark mode it drops to `primary-900` — a full-strength accent against a near-black page glares.
- **Popups blur the page behind them; they never darken it.** The blur lives on **`#app-root`** (a wrapper in the root layout around everything the app renders), driven by a `body.overlay-open` class, and it is animated — `filter: blur(10px)` over 280ms. Because that blur is what separates a popup from the page, popups carry **no shadow**. Two things forced this shape:
  - **`backdrop-filter` on the overlay is not enough.** It only samples content composited into the same layer, so a sticky navbar or the class strip stayed razor-sharp behind a blurred page. Blurring the app subtree is the only thing that blurs the chrome too.
  - **Everything that floats must therefore portal to `<body>`** — outside `#app-root`, or it blurs itself. `Modal`, `Popover`, `Select` and the phone section sheet all do.
- **One z-ladder, and popups sit on top of it.** Page chrome ≤ `z-30` · demo notice `z-100` · centred popups `z-120` · anchored panels (dropdowns, popovers, the profile menu) `z-200`, so a dropdown opened inside a dialog still lands above it. Anything anchored to a trigger goes through `components/Popover.tsx` rather than an `absolute` panel — an absolutely-positioned menu gets clipped by `overflow-hidden` cards and out-stacked by later siblings in the sticky header, which is exactly what buried the profile menu.
- **`useOverlayTransition` flips the shown flag after *two* animation frames.** One is not enough: rAF can run before the browser has painted the hidden state, so the transition has nothing to move from and the overlay snaps open. It also keeps the node mounted past the close so the exit animates, and holds the body scroll lock for that whole time.
- **Anything that floats over scrolling content is nearly opaque, lightly blurred.** `.float-pane` (white at 90% + `backdrop-blur-md`) and `.float-pane-raised` (over a white page) are on every navbar, the class strip, the phone picker, the teacher grid's sticky student column, dropdowns, popovers, modals and the demo notice. Content passing underneath reads as a blur rather than disappearing behind a hard edge. A sticky container whose children are panes must not paint its own background — an opaque parent cancels the whole effect.
- **No nested icon tiles.** A bordered, filled square inside a bordered card made every resource and class card read as somebody else's logo. Icons are bare glyphs at the text's own scale; the resource hue lives on the glyph.
- **The segmented capsule needs a visible pill in dark mode.** `slate-900` on a `slate-950` navbar left nothing but the label — the sliding pill is `slate-700` with a white/10 ring. Until the pill has measured, the active tab paints its own highlight, so the first frame is never blank; the first placement is instant and only later moves animate.
- **Radius scale**: `lg` 10px controls · `xl` 14px inner panels · `2xl` 18px cards · `3xl` 24px hero.
- **Helpers**: `.surface`, `.card` / `.card-interactive`, `.panel-inset`, `.eyebrow` / `.eyebrow-muted`, `.page-in`, `.list-in`, `.fade-in`, `.bar-fill`, `.scan-line`; on the landing, `.ink` / `.muted-ink` for two-tone copy, `.line-grid` / `.line-grid-hot` for tile line-art, `.edge-glow` for a cursor-lit edge.
- **UI chrome is Title Case**; prose is sentence case.
- **Spacious, not empty — one rhythm.** 40px (`space-y-10`) between the major sections of a screen; ~12px from a section heading to its content; list rows at an even 14–16px with hairlines between. Fewer, larger gaps rather than many small ones: when a screen feels cluttered the fix is usually to remove an element (the dashboard's per-row Duplicate button moved into the ⋯ menu; the class code lost its label) before adding space around it.
- **Say less.** A label that can stand alone does: no subtitles under headings, no example text in placeholders (*"Notes (optional)"*), no sentences explaining what a button will do. The dashboard heading is *"Classes"*; the import panel is a title and a composer. If a screen needs a paragraph to be understood, the screen is what needs fixing.
- **The product says "we", never "AI".** Teachers are wary of AI, so no screen, button, placeholder or error names it: *"we build the class"*, *"anything we should know"*, *"we'll suggest the changes"*, **Create class**. No ✨ sparkle icons on the import either — that glyph is the industry's AI badge. Errors a teacher can see talk about their files (*"We're busier than usual — give it a minute"*), never about models, keys or providers; the operator's detail goes to the server log. The one exception is the privacy policy and terms, which must name Google's Gemini API exactly as the processor of uploaded documents — under calmer headings (*"How your documents are read"*), but with the disclosure itself unchanged.

> ⚠️ **`tailwind.config.ts` must scan `./lib`.** The status chips and resource palettes are plain `.ts` modules. They were silently dropped from the build once — chips rendered with no text in dark mode — until `lib` was added to `content`.

### Responsive rules worth knowing

- **The sticky header is one block.** Navbar (`h-14`) + class strip (`h-11`) + the phone section-picker all live inside a single `sticky top-0` container, so nothing needs a guessed offset. The container itself is transparent (see the pane rule above). The desktop section sidebar is the one place that hardcodes the 100px header height.
- **Phones get their own layout, not a squeezed one.** The curriculum table stacks into a card per unit below `md`; the teacher nav capsule moves to its own row below `sm`; per-resource status moves under the resource name in `TrackCard`; stat tiles become label/value rows.
- **Wide tables scroll inside their own container** — the page body never scrolls sideways.

**To reset state:** clear the `modern-classroom-*` keys in devtools, or use an incognito window.

---

## Known issues / decisions to make

1. **The Supabase project pauses when idle.** Free tier suspends after about a week with no traffic, and a paused project means the whole app is down — signup, sign-in, every class. Restoring it from the dashboard brings the data back, but the restore is **asynchronous**: the REST endpoint answers before the data is back, so a project mid-restore looks like an empty database. Do not conclude data is lost, and do not re-run migrations against it, until `list_tables` shows the real tables. A paid plan, or any traffic at all, avoids the pause.

2. **Deleting an account deletes the classes you teach.** `delete_account()` removes them along with every student's work in them, because a class with no teacher is unreachable. The dialog counts and names what will be lost and makes you type DELETE, but there is no export first — building one is the honest next step.

3. **Never run `npm run build` while the dev server is up.** They share `.next`,
and rebuilding or deleting it under a live dev server leaves it serving a bare
*Internal Server Error* until it is restarted — which looks exactly like an app
bug and is not one. Use **`npm run build:check`** to verify a build; it writes
`.next-build` instead and leaves the dev server alone. (`npm run build` is still
the real deploy build, because that is what hosts expect to find.) One wrinkle:
`build:check` rewrites the generated `next-env.d.ts` to point at `.next-build`.
That file is committed pointing at `.next`, which is what a deploy produces, so
`git checkout next-env.d.ts` after a check build if it shows up as changed.

4. **`npm run lint` is broken.** The script still calls `next lint`, removed in Next 16. Use `npx eslint app components lib --ext .ts,.tsx` until the script is repointed.

5. **Uploaded files are still base64 in the row.** Student proof screenshots and teacher attachments are data URLs inside `progress.state` / `classes.units`. They work, but they bloat rows and Postgres is the wrong place for a megabyte of PNG. Supabase Storage is the fix; deliberately deferred.

6. **Leaked-password protection is off.** A Supabase dashboard toggle (Auth → Passwords) that checks new passwords against HaveIBeenPwned. Worth turning on before real students sign up.

7. **One conflict is not resolved, by choice.** The same *track* edited offline by a student and online by their teacher is last-write-wins. Per-track rows make this rare — it needs two people on the same resource of the same subunit within one offline window — and the alternative is merge UI nobody would read.

8. **A class created offline shows `······` as its code** until it syncs. The server mints the code, and it cannot do that while unreachable.

9. **8 npm advisories** at install (1 critical, 6 high, 1 moderate) — all in transitive dependencies of `next`, `browserslist` and `eslint@8`, none from the Gemini or SheetJS additions. `eslint@8` and `glob@7` are EOL.

10. **`ClassTeacherView.tsx` is large** (~1,150 lines: grid, gate, review modal, help modal, invites, stat modals). Splitting out a `ProgressGrid` is the next worthwhile cut.

11. **Test coverage is one module deep.** `lib/curriculum-diff.ts` has 17 vitest specs (`npm test`) because its failure loses student work silently. `class-progress.ts` and `section-tracks.ts` are pure and are the next highest-value things to cover — especially the legacy-migration determinism, which has the same failure mode.

12. **The import's demo rate limit is per-process and in-memory.** Eight runs an hour per IP, held in a `Map` that resets whenever the server does. Fine for one host; wrong the moment it runs on more than one.

13. **A student's "new since you were last here" marks are per-device.** They live in that browser's localStorage, so the same student on a phone and a laptop is told twice. That is the right trade for a reading mark — it costs a row per person per class to do otherwise — but it is a choice, not an oversight.

14. **The AI drafts structure, not materials.** It reads units, subunits, dates, checkpoints and resource references out of the teacher's files; the actual documents, answer keys and videos still have to be attached per section.

---

## Version history

House scheme is `vMAJOR.MINOR` (Release bumps major; Fix/Update bumps minor). The tracked `package.json` version moves only on a Release, and only its major digit — it sits at `5.0.0`; its minor and patch digits are intentionally stale.

| Label | Date | What |
|---|---|---|
| `5.3` | 2026-10-08 | Classes start from the teacher's own files: attach materials and notes, we draft the curriculum, the teacher approves it (ready-made courses no longer offered). A calmer design — Poppins only, nothing heavier than medium, ink buttons, flat surfaces with fewer boxes, one spacing rhythm, far fewer words, and no "AI" in the product's voice. The import hedges across Gemini models and remembers busy ones (repeat imports ~1s), caps uploads at Vercel's limit, rate-limits signed-in imports and validates demo input. Exit demo always on screen; a non-UUID class address no longer crashes |
| `5.4` | 2026-10-08 | Imports stop failing: models are tried in a measured order (3.5 Flash and Lite first, not the newest), answers are streamed so a model that is writing is never cut off while one stuck in Google's queue is dropped at 20s, a cut-off answer retries on another model, and `maxDuration` is 180s. Word documents (`.docx`) can be attached. A failed import no longer counts against the hourly limit |
| `5.5` | 2026-10-08 | Imports build one unit per unit number: the prompt gives the model a skeleton (the number before the dot is the unit; semesters and tabs are never units; quizzes and tests are dated checkpoints in the unit they assess), and `shapeProposal` regroups sections by number in code whatever the model returns. Undated-place checkpoints are placed by date; sheets drop trailing empty columns and the per-file budget is 400k characters |
| `5.6` | 2026-10-08 | Imports read real teacher timelines: the model writes an outline of the whole year first and is held to it (short answers retry on another model, or come back flagged), side-by-side plans pick one column as the class's sequence and turn the others into tracks, units keep the year's teaching order by date, Lite models are tried last, and a model out of free-tier quota is skipped until it resets. The theme circle runs as a CSS animation, so it no longer snaps to the end halfway on phones. New units are numbered ("Unit 3: Linear Models"); notes speak to the teacher in the first person about gaps only, shown under "A note for you · not added to your curriculum" |
| `5.2` | 2026-10-06 | The RLS helpers moved out of the exposed API, so a signed-in user can no longer probe other accounts' class memberships |
| `5.1` | 2026-10-06 | Keep-awake workflow working: repo secrets set, and an anonymous heartbeat to ping, since real tables correctly refuse anonymous reads |
| `5.0` | 2026-10-05 | AI curriculum import (upload a time line, review every change cell by cell, approve what you want); live updates between teacher and student with a "new since you were last here" flag; account deletion; flat sans type (Inter + Archivo) replacing Garamond; one button system; a real landing page built from the product's own components, with privacy, terms, robots and sitemap; and a phone-first pass. Model selection made self-healing |
| `4.0` | 2026-09-22 | Supabase: real accounts, shared classes, per-track progress behind row-level security — with the browser kept as an offline cache that queues writes and syncs on reconnect. The orphaned server stack deleted |
| `3.2` | 2026-09-21 | Classes can be deleted or left; students removed from the roster |
| `3.1` | 2026-09-21 | A personal colour stays personal inside a class |
| `3.0` | 2026-09-21 | Customize tab (name, icon, colour) with per-class theming, personal accent colours, and the guided demo tour |
| `2.0` | 2026-08-18 | Curriculum rebuilt around resource tracks: per-source Learn/Practice paths, dates and checkpoints, the student Class Dashboard, course templates, the To-Do, checkpoint grading, and one seeded demo in place of the parallel demo app |
| `2.0` | 2026-08-17 | Removed the committed database file (history rewritten to purge it) |
| `1.3` | 2026-08-17 | Added this master doc |
| `1.2` | 2026-06-25 | Moved persistence to localStorage — the change that orphaned the server stack |
| `V1.1` | 2026-06-25 | Full working demo, UI/UX complete, all localhost |
| — | 2026-06-24 | Added login / local real use |
