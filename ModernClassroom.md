# Modern Classroom

> **Master doc — the north star for this project.** Everything else (README, comments, code) should agree with this. Where code and doc conflict, the code wins and this doc gets fixed.
>
> Repo: [SidMirchandani/modernclassroom](https://github.com/SidMirchandani/modernclassroom) (public) · Cloned locally: 2026-08-17 · Last commit: `1.2: Updated to localstorage` (2026-06-25)

## What it is

A self-paced classroom dashboard. Students work through a unit's subunits in order — **Learn → Practice → Extra Material** — uploading proof of work and setting their own status as they go. Teachers author the curriculum, watch a live progress grid, review submitted work, and drag a **progress gate** that caps how far the class can move ahead.

The pitch on the landing page: *"Your classroom, modernized."* Self-paced learning, teacher oversight, one login for both roles.

## Who it's for

Teachers running a self-paced or mastery-based unit who want visibility without collecting work by hand, and students who want to move at their own speed without getting lost or racing ahead of the class.

---

## How it's built

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 3 · lucide-react icons. Auth primitives via `bcryptjs` + `jose`. No test framework, no CI.

### The two-app split

The codebase is really **two apps sharing components**:

| | Route | Data source | Purpose |
|---|---|---|---|
| **Demo** | `/demo/student`, `/demo/teacher` | Seeded fixtures + `localStorage` | Zero-login showcase. `/student` and `/teacher` are redirects into it. |
| **Real** | `/`, `/dashboard/**` | Accounts + classes in `localStorage` | Sign up, create or join a class, author curriculum, track real progress. |

Both are driven by the same student/teacher view components, differing mainly in where data comes from.

### Data layer — everything lives in the browser

Despite appearances, **there is no server persistence**. As of the `1.2: Updated to localstorage` commit, all reads and writes go through `lib/db/client.ts`, a synchronous `localStorage` store keyed on `modern-classroom-db`. `lib/auth-client.ts` layers accounts on top of it: signup hashes the password with bcrypt *in the browser*, and the "session" is the user's id in `localStorage` under `modern-classroom-session`.

`localStorage` keys in use:

| Key | Written by | Holds |
|---|---|---|
| `modern-classroom-db` | `lib/db/client.ts` | Users, classes, enrollments, invites, progress |
| `modern-classroom-session` | `lib/auth-client.ts` | Logged-in user id |
| `modern-classroom-progress` | `lib/progress-store.ts` | Demo student progress |
| `modern-classroom-progress-block` | `lib/progress-block-store.ts` | Demo progress gate |

> ⚠️ **The entire server stack is orphaned.** `app/api/**` (11 routes), `lib/db/index.ts` (filesystem JSON store), `lib/auth.ts` (JWT sessions, httpOnly cookies, bcrypt) and `data/db.json` are all still present and still compile — but **nothing calls them**. No component fetches `/api/*`. They are the pre-1.2 server implementation, left in place when the app moved client-side. `lib/db/client.ts` is a near-line-for-line duplicate of `lib/db/index.ts` with `fs` swapped for `localStorage`. See [Known issues](#known-issues--decisions-to-make).

### Domain model

```
User ──teaches──> Class ──has──> Unit[] ──has──> Section[] (subunits)
  └──enrolled in──┘                                  └──has──> ContentBlock[] + Objective[]
StudentProgress: (classId, studentId) -> { [sectionId]: SectionActivityStatus }
```

- **Roles are per-class, not global.** `DbUser.role` exists but is deprecated — you're a teacher in the class you created and a student in classes you joined. `getClassesForUser` returns both.
- **Joining** happens by 6-digit class code, or by an invite on email/username that auto-accepts on next login (`acceptPendingInvites`).
- **A Section** carries `objectives[]` and `blocks[]`. Blocks are typed `learn | practice | extra` and hold attachments (links or files). Legacy flat fields (`learnResources`, `practiceDescription`, `extraMaterials`) are marked deprecated and migrated into `blocks` on load.

### Progress rules — `lib/class-progress.ts`

This is the heart of the app. The rules that matter:

- **Sequential unlock within a section:** `learn` → `practice` → `extra`. An activity opens once the previous is *finished*, where finished means `done` **or** `help` — so asking for help never blocks you.
- **Sequential unlock across sections:** section *N* is reachable only if every prior section has `learn` and `practice` finished. `extra` is genuinely optional.
- **A section is complete** when `learn` and `practice` are both `done` (not `help`).
- **The progress gate** (`blockSectionId`) hard-caps access: anything after the gated section is locked regardless of how fast a student works.
- **Teacher review loop:** practice marked `done` with `practiceApproved !== true` surfaces as **Review**. The teacher can approve it, or send it back — which reverts practice to `available`, drops the proof URL, and sets `sentBackForReview` for a student-facing notice.
- **Teacher status per cell** is derived, not stored: `review` → `complete` (before current section) → `not-started` (after) → `help` → `in-progress`.
- **Unit phase** (`lib/unit-phase.ts`) classifies each unit as `finished | active | upcoming` off the gate position; help-request counts skip finished and upcoming units.

### Layout

```
app/
  page.tsx                    Landing + AuthPanel (login/signup)
  dashboard/                  Real app — class list, class view, subunit view
  demo/                       Demo app — student & teacher, seeded
  api/                        ⚠️ orphaned server routes (see above)
components/
  student/                    ActivityCard, SectionView, SectionSidebar,
                              StudentDashboard (demo), ClassStudentView (real)
  teacher/                    TeacherDashboard (demo, 45KB), ClassTeacherView (real, 39KB),
                              CurriculumTable, TableProgressGate, Subunit*Editor
  dashboard/                  DashboardClient, ClassPageClient, DashboardShell
  auth/                       AuthPanel, ProfileMenu
lib/
  class-progress.ts           ⭐ unlock / status / review logic (real app)
  progress.ts                 same, for the demo app
  db/client.ts                ⭐ localStorage store — the live data layer
  db/index.ts, auth.ts        ⚠️ orphaned server data layer
  demo-units.ts               17KB of seeded Unit 3 curriculum
data/db.json                  ⚠️ orphaned seed for the server store
```

### Demo data

Eight demo students on **Unit 3: Linear Models and Systems** (sections 3.1–3.7). No seed student is past **3.4**, and the default gate sits at **3.4** — drag the red line on the teacher table to open more.

---

## Running it

```bash
npm run dev
```

Then open http://localhost:3000. Scripts: `dev`, `build`, `start`, `lint`, `fix-logo` (regenerates favicons from `public/Logo.png`).

**Verified 2026-08-17:** `npm install` clean (372 packages), `npm run build` passes — compiles, typechecks, 16 static pages generated, no errors.

**To reset state:** clear the `modern-classroom-*` keys in devtools, or use an incognito window.

---

## Known issues / decisions to make

Found on the 2026-08-17 read-through. None of these are breaking the app today; all are worth a decision.

1. **Orphaned server stack (biggest one).** `app/api/**`, `lib/db/index.ts`, `lib/auth.ts`, `data/db.json` are dead weight — ~30KB of code that compiles, ships in the build output as 11 live routes, and does nothing. Either **delete it** (clean, and it's recoverable from git history) or **wire it back up** if server persistence is the intent. Leaving it is the worst of both: a reader can't tell which data layer is authoritative, and the two `db` files will drift.

2. **Client-side auth is not security.** Password hashes and every user record sit in `localStorage`, readable and writable from the console. The "session" is a plain user id — set it to any value and you're that user. Fine for a demo; **not deployable as a real classroom tool** with student data in it. This is the decision that drives #1.

3. **README understates the app.** It documents only the demo mode ("no backend or login required") and never mentions accounts, classes, class codes, invites, the curriculum editors, or `/dashboard`. Should be brought in line with this doc.

4. **`AUTH_SECRET` has a hardcoded dev fallback** in `lib/auth.ts:9`. Moot while the file is orphaned; a real problem the moment it isn't.

5. **6 high-severity npm advisories** at install. `npm audit` for detail; `eslint@8` and `glob@7` are both EOL.

6. **Two giant components.** `TeacherDashboard.tsx` (45KB) and `ClassTeacherView.tsx` (39KB) do a lot in one file each, with meaningful duplication between them. Worth a split if either grows.

7. **No tests.** The unlock/gate/review logic in `class-progress.ts` is pure, well-factored, and the highest-value thing in the repo to test — it'd be cheap to cover.

---

## Version history

House scheme is `vMAJOR.MINOR` (Release bumps major; Fix/Update bumps minor). The tracked `package.json` version is `0.1.0` and is not currently in sync with the commit labels.

| Label | Date | What |
|---|---|---|
| `1.2` | 2026-06-25 | Moved persistence to localStorage — the change that orphaned the server stack |
| `V1.1` | 2026-06-25 | Full working demo, UI/UX complete, all localhost |
| — | 2026-06-24 | Added login / local real use |
