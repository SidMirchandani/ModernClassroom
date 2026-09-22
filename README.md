# Modern Classroom

A modern, self-paced learning dashboard for students and teachers. Built with Next.js, TypeScript, and Tailwind CSS.

Students work through unit sections at their own pace. Each section is split by **resource** — the textbook, AP Classroom, a guided-notes series — because the three cover the same objectives in different orders. Each resource is its own button that opens onto its own Learn material and Practice deliverable, with its own status. Teachers get a live progress grid showing which resource each student is stuck on, a draggable progress gate to control how far the class can move, and review workflows for submitted screenshots.

**Demo** — open `/demo` and the app seeds itself with a teacher, eight students and three real courses (Algebra II, AP Precalculus, AP Statistics), then drops you into the product. A "Viewing as" switcher lets you look at the same classroom as the teacher or any student. Everything is stored in the browser via `localStorage`.

## Features

### Student view
- Unit banner and section navigation (sidebar on desktop, bottom sheet on mobile)
- Course overview dashboard: whole curriculum, soft due dates and upcoming checkpoints
- Resource tracks run in parallel; inside each one, Learn unlocks Practice
- Status badge on each activity card (top-right dropdown): **In Progress**, **Done**, **Help Requested**, or **Locked**
- Practice requires a screenshot upload before marking Done
- Help requests do not block moving to the next activity or section
- Teacher progress gate limits access to sections beyond the gated point
- Light and dark mode

### Teacher view
- Class progress table with status per student and section
- Status types: **Done**, **Review** (yellow), **Active**, **Help** (red), not started
- **Progress gate** — draggable red line on the progress table; students cannot access sections past the gate
- Click **Review** to view a student's submitted screenshot and approve it
- Stat cards with detail modals (enrolled students, help requests, progress breakdown)
- Section breakdown charts

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)

## Getting started

### Prerequisites

- Node.js 18+
- npm

### Install and run

```bash
git clone https://github.com/SidMirchandani/ModernClassroom.git
cd ModernClassroom
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |
| `npm run fix-logo` | Fix PNG transparency on `public/Logo.png` and regenerate favicons |

## Project structure

```
app/                  # Next.js routes (home, student, teacher)
components/           # UI components
  student/            # Student dashboard, activity cards, sidebar
  teacher/            # Teacher dashboard, progress gate overlay
lib/                  # Types, demo data, progress logic, localStorage stores
public/               # Static assets (Logo.png, favicons)
scripts/              # Utility scripts
```

## Demo data

The app ships with eight demo students and progress for **Unit 3: Linear Models and Systems** (sections 3.1–3.7). No student has completed work past **3.4** in the seed data. The default progress gate is also set to **3.4** — drag the red line on the teacher table to open more sections.

Switch between students on the student view to see different progress states.

### Resetting demo state

Progress is persisted in `localStorage` under `modern-classroom-progress`. The progress gate uses `modern-classroom-progress-block`. Clear those keys in devtools (or use a fresh/incognito window) to reload the seed data.

## License

MIT
