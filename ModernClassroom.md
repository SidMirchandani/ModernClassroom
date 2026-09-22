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
`class_summaries`. All `security definer`, all refuse an anonymous caller, each
checks its own permission. Access helpers (`is_class_teacher`, `is_enrolled`,
`shares_class_with`) are `security definer` too — an inline subquery in a
policy has to evaluate the *other* table's policies, which is how RLS turns
recursive and slow.

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

### Course templates — `lib/course-templates.ts`

Three courses transcribed from the *Class Time Lines 2026* sheet, so a new class
arrives with the year already laid out:

| Template | Units | Subunits | Checkpoints | Resources |
|---|---|---|---|---|
| Algebra II, Honors | 11 | 72 | 30 | Next-Gen Textbook · Discovery Activity · eMath Guided Notes |
| AP Precalculus | 4 | 58 | 19 | Textbook · AP Classroom · Guided Notes (The Algebros) |
| AP Statistics | 5 | 55 | 24 | Stats: Modeling the World · AP Classroom · Guided Notes (Goldie's) |

Each subunit carries its due date and a per-resource
`reference` (textbook chapter, CED topic, guided lesson). Learn/Practice slots
come in **empty** — the teacher attaches documents, keys and videos as the year
runs, which is the stated workflow.

**A subunit is numbered by the class unit it sits in, never by the textbook.**
`9.1` is the first subunit of Unit 9 whatever chapter covers it; the chapter
lives in that resource's `reference` (`Ch 8.1`), which is the whole point of
tracks. Algebra II shipped four units transcribed straight off the textbook
spine — Unit 9 opening at "8.1" — and they are renumbered. The curriculum
editor already numbers new subunits `${unit}.${n}`, so this is the rule
everywhere.

`instantiateTemplate()` builds `CurriculumUnit[]`; `createDefaultClass()` sets
the initial gate to the **last subunit of Unit 1** so a fresh template class
opens on Unit 1 rather than the end of the year.

### Layout

```
app/
  page.tsx                    Landing + AuthPanel
  dashboard/                  The app — class list, class view, subunit editor
    new/                      Start a class from a template (its own page, not a dialog)
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
  course-templates.ts         ⭐ Algebra II / AP Precalc / AP Stats skeletons
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
| `GEMINI_MODEL` | Optional, defaults to `gemini-2.5-flash` |

`.env.local` is gitignored; `.env.example` is the template. **`/demo` needs none
of them** — it is entirely local, which is also what makes it the fallback when
Supabase is not configured.

**Verified 2026-09-22** (v4.0): `npm run build` passes. Exercised across two
sessions against the live project — signed up a teacher and a student, created
a class from the Algebra II template, joined it by code, marked tracks from the
student side and watched them appear in the teacher's grid, set a checkpoint
grade, renamed a subunit, changed the class colour. Rehearsed the connection
dropping with `mc-force-offline`: the write queued, the pill read
*"Offline — 1 change saved on this device"*, and clearing the flag flushed it
to Postgres. `/demo` still runs with no account and no network. RLS checked by
querying as each role rather than by reading the policies.

### Design system — Open* house theme

One brand blue, one status vocabulary, one radius scale. Tokens live in
`tailwind.config.ts` and `app/globals.css`; components never invent a colour.

- **`primary` is the only accent** — nav, links, CTAs, focus rings, eyebrows, the current-section highlight. The teacher side used to run on violet; it does not any more. It defaults to the house blue `#2563ea` but **is not a fixed hex**: inside a class it becomes that class's colour (see *Customize*). `bg-brand` is the one fixed blue, for the colour picker's own swatch.
- **Colour sits on white, never on colour.** Chips are the card's own surface with a tinted border and tinted text; checkpoint rows are white with a thin coloured left stripe; the beyond-the-gate column is dimmed rather than tinted. Stacked tints were what made the page read as noise.
- **Status is one vocabulary** — `lib/status-styles.ts` holds the tonal chips every surface reads from: slate `Not Started` · sky `In Progress` · amber `Submitted` · rose `Help!` · emerald `Done`, plus `STATUS_DOT` for the bar/dot form. The student badges, the step chips, the teacher grid chips, the section-breakdown bars and the section pills all import it, so a colour never means two things. **Status colours never follow the class colour** — a step that is in progress is sky in a rose class too, or "in progress" and "done" would collide in a green one.
- **Resource hues are category identity only** — indigo textbook · violet AP Classroom · teal guided notes · amber extra · slate custom. They appear on the icon tile, the editor badge and the objective dot, never on chrome and never on a status. Attachments share one neutral treatment (`ATTACHMENT_CLASS`).
- **Flat by design.** The page is white (`#0b0f16` in dark) and every surface sits on it with a 1px border and no shadow. Only true overlays — modals, dropdowns, the demo notice — carry `shadow-z5`. `shadow-z1`–`z3` are no longer used on cards.
- **No native `<select>`.** `components/Select.tsx` draws the option list, because the browser's own popup ignores the app's font and highlight colour. It renders through a **portal**: these sit inside `overflow-x-auto` tables and `overflow-hidden` cards that would clip an absolutely-positioned menu.
- **One scrollbar, everywhere**: `scrollbar-width: thin` with a transparent track, and matching `::-webkit-scrollbar` rules for the engines that ignore it (8px track, 4px thumb via a transparent border and `background-clip: content-box`). The native Windows bar is a 17px grey gutter with arrow buttons — a piece of the OS sitting on the page.
- **Students get a class-coloured strip** (white text) so the room they are in is unmistakable; teachers keep the neutral strip. In dark mode it drops to `primary-900` — a full-strength accent against a near-black page glares.
- **Popups blur the page behind them; they never darken it.** The blur lives on **`#app-root`** (a wrapper in the root layout around everything the app renders), driven by a `body.overlay-open` class, and it is animated — `filter: blur(10px)` over 280ms. Because that blur is what separates a popup from the page, popups carry **no shadow**. Two things forced this shape:
  - **`backdrop-filter` on the overlay is not enough.** It only samples content composited into the same layer, so a sticky navbar or the class strip stayed razor-sharp behind a blurred page. Blurring the app subtree is the only thing that blurs the chrome too.
  - **Everything that floats must therefore portal to `<body>`** — outside `#app-root`, or it blurs itself. `Modal`, `Popover`, `Select` and the phone section sheet all do.
- **One z-ladder, and popups sit on top of it.** Page chrome ≤ `z-30` · demo notice `z-100` · centred popups `z-120` · anchored panels (dropdowns, popovers, the profile menu) `z-200`, so a dropdown opened inside a dialog still lands above it. Anything anchored to a trigger goes through `components/Popover.tsx` rather than an `absolute` panel — an absolutely-positioned menu gets clipped by `overflow-hidden` cards and out-stacked by later siblings in the sticky header, which is exactly what buried the profile menu.
- **`useOverlayTransition` flips the shown flag after *two* animation frames.** One is not enough: rAF can run before the browser has painted the hidden state, so the transition has nothing to move from and the overlay snaps open. It also keeps the node mounted past the close so the exit animates, and holds the body scroll lock for that whole time.
- **Anything that floats is translucent and blurred.** `.float-pane` (white / `slate-950` at 85% + `backdrop-blur-md`) and `.float-pane-raised` (over a white page) are on every navbar, the class strip, the phone picker, the teacher grid's sticky student column, dropdowns, popovers, modals and the demo notice. Content passing underneath reads as a blur rather than disappearing behind a hard edge. A sticky container whose children are panes must not paint its own background — an opaque parent cancels the whole effect.
- **No nested icon tiles.** A bordered, filled square inside a bordered card made every resource and class card read as somebody else's logo. Icons are bare glyphs at the text's own scale; the resource hue lives on the glyph.
- **The segmented capsule needs a visible pill in dark mode.** `slate-900` on a `slate-950` navbar left nothing but the label — the active tab is `slate-700` with a `slate-600` ring.
- **Radius scale**: `lg` 10px controls · `xl` 14px inner panels · `2xl` 18px cards · `3xl` 24px hero.
- **Helpers**: `.card` / `.card-interactive`, `.panel-inset`, `.eyebrow` / `.eyebrow-muted`.
- **UI chrome is Title Case**; prose is sentence case.

> ⚠️ **`tailwind.config.ts` must scan `./lib`.** The status chips and resource palettes are plain `.ts` modules. They were silently dropped from the build once — chips rendered with no text in dark mode — until `lib` was added to `content`.

### Responsive rules worth knowing

- **The sticky header is one block.** Navbar (`h-14`) + class strip (`h-11`) + the phone section-picker all live inside a single `sticky top-0` container, so nothing needs a guessed offset. The container itself is transparent (see the pane rule above). The desktop section sidebar is the one place that hardcodes the 100px header height.
- **Phones get their own layout, not a squeezed one.** The curriculum table stacks into a card per unit below `md`; the teacher nav capsule moves to its own row below `sm`; per-resource status moves under the resource name in `TrackCard`; stat tiles become label/value rows.
- **Wide tables scroll inside their own container** — the page body never scrolls sideways.

**To reset state:** clear the `modern-classroom-*` keys in devtools, or use an incognito window.

---

## Known issues / decisions to make

1. **`npm run lint` is broken.** The script still calls `next lint`, removed in Next 16. Use `npx eslint app components lib --ext .ts,.tsx` until the script is repointed.

2. **Uploaded files are still base64 in the row.** Student proof screenshots and teacher attachments are data URLs inside `progress.state` / `classes.units`. They work, but they bloat rows and Postgres is the wrong place for a megabyte of PNG. Supabase Storage is the fix; deliberately deferred.

3. **Leaked-password protection is off.** A Supabase dashboard toggle (Auth → Passwords) that checks new passwords against HaveIBeenPwned. Worth turning on before real students sign up.

4. **One conflict is not resolved, by choice.** The same *track* edited offline by a student and online by their teacher is last-write-wins. Per-track rows make this rare — it needs two people on the same resource of the same subunit within one offline window — and the alternative is merge UI nobody would read.

5. **A class created offline shows `······` as its code** until it syncs. The server mints the code, and it cannot do that while unreachable.

6. **6 high-severity npm advisories** at install; `eslint@8` and `glob@7` are EOL.

7. **`ClassTeacherView.tsx` is large** (~1,150 lines: grid, gate, review modal, help modal, invites, stat modals). Splitting out a `ProgressGrid` is the next worthwhile cut.

8. **Thin test coverage.** `class-progress.ts` and `section-tracks.ts` are pure and are the highest-value things to cover — especially the legacy-migration determinism, which silently loses student progress if it ever breaks.

9. **Templates carry structure, not materials.** Unit/section/date/checkpoint/reference data is transcribed from the timeline sheet; the actual documents, answer keys and videos still have to be attached per section.

---

## Version history

House scheme is `vMAJOR.MINOR` (Release bumps major; Fix/Update bumps minor). The tracked `package.json` version moves only on a Release, and only its major digit — it sits at `4.0.0`; its minor and patch digits are intentionally stale.

| Label | Date | What |
|---|---|---|
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
