"use client";

/**
 * The guided tour of the demo. It is a plain list of stops — a place to be, a
 * thing to look at, and what that thing is for — so adding or reordering a stop
 * is an edit to this array and nothing else.
 */

/** The showcase class every stop below points at. Seeded with a fixed id. */
export const TOUR_CLASS_ID = "demo-algebra-2";

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** Which screen this stop is on. Shown throughout, and named while moving. */
  place: string;
  /** Where the stop happens. The tour navigates here before showing it. */
  href?: string;
  /** `data-tour` value of the element to ring. Absent for the full-page stops. */
  anchor?: string;
  /**
   * The controls to press, in order, to get here from the stop before — by
   * `data-tour` value. The tour clicks them for real rather than jumping to
   * `href`, so you watch the path being walked and could repeat it yourself.
   * `href` stays as the destination check and the fallback.
   */
  route?: string[];
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    place: "Dashboard",
    title: "Welcome to the demo",
    href: "/dashboard?tab=teaching",
    body:
      "You are signed in as Demo, who teaches three courses and sits in them as a student — so you can see both sides of the same class. Nothing here is saved, so change whatever you like. Keep clicking Next, or leave at any time.",
  },
  {
    id: "mode-switch",
    place: "Dashboard",
    title: "Two sides, one account",
    href: "/dashboard?tab=teaching",
    anchor: "mode-switch",
    body:
      "Teaching lists the classes you run; Enrolled lists the ones you sit in. A real teacher taking a course lives on both, so the app never asks you to pick an identity.",
  },
  {
    id: "class-card",
    place: "Dashboard",
    title: "A class, and its join code",
    href: "/dashboard?tab=teaching",
    anchor: "class-card",
    body:
      "Students join with the six-digit code — copy it with the button beside it. Duplicate copies the whole curriculum into a fresh class for another period, without the students or their progress.",
  },
  {
    id: "class-nav",
    route: ["class-card-link"],
    place: "Teacher view",
    title: "Inside a class",
    href: `/dashboard/class/${TOUR_CLASS_ID}`,
    anchor: "class-nav",
    body:
      "Three tabs. Classroom is who is where; Curriculum is what the year holds; Customize is the name, icon and colour. We will walk all three.",
  },
  {
    id: "unit-nav",
    place: "Teacher view",
    title: "One unit at a time",
    href: `/dashboard/class/${TOUR_CLASS_ID}`,
    anchor: "unit-nav",
    body:
      "The arrows move the whole page between units — the table below follows. A course runs seventy-odd subunits, which is far more than any one screen should try to show.",
  },
  {
    id: "progress-table",
    place: "Teacher view",
    title: "Where everyone is",
    href: `/dashboard/class/${TOUR_CLASS_ID}`,
    anchor: "progress-table",
    body:
      "One row per student, one column per subunit. The chip is the subunit overall; the little squares under it are the separate resources — textbook, activity, guided notes — because a student can be done with one and stuck on another. Click any of them to see the work.",
  },
  {
    id: "table-keys",
    place: "Teacher view",
    title: "What the marks mean",
    href: `/dashboard/class/${TOUR_CLASS_ID}`,
    anchor: "table-keys",
    body:
      "Three keys: the resource letters, the colours a graded column can take, and the colours of the assessment titles. Hovering any chip or title explains it in place, too.",
  },
  {
    id: "progress-gate",
    place: "Teacher view",
    title: "How far the class may go",
    href: `/dashboard/class/${TOUR_CLASS_ID}`,
    anchor: "progress-gate",
    body:
      "Drag the red line to open or close the course. Everything past it is locked for students however fast they work — self-paced, but not unbounded.",
  },
  {
    id: "curriculum",
    route: ["nav-curriculum"],
    place: "Curriculum tab",
    title: "The year itself",
    href: `/dashboard/class/${TOUR_CLASS_ID}?view=curriculum`,
    anchor: "curriculum",
    body:
      "Every unit, subunit and dated assessment, all editable. Open a subunit to attach the actual documents, videos and keys for each resource.",
  },
  {
    id: "customize",
    route: ["nav-customize"],
    place: "Customize tab",
    title: "Make it yours",
    href: `/dashboard/class/${TOUR_CLASS_ID}?view=customize`,
    anchor: "customize-color",
    body:
      "Pick a colour and the whole class wears it — for you and for every student in it. Six periods stop looking like one grey list. Try one; the strip below previews what students see.",
  },
  {
    id: "student-strip",
    route: ["nav-dashboard", "mode-enrolled", "class-card-link"],
    place: "Student view",
    title: "Now the student side",
    href: `/dashboard/class/${TOUR_CLASS_ID}?as=student`,
    anchor: "class-strip",
    body:
      "The same class, as the people in it see it. The strip carries the class, a way back to its dashboard, and the unit you are reading.",
  },
  {
    id: "student-todo",
    place: "Student view",
    title: "What is actually due",
    href: `/dashboard/class/${TOUR_CLASS_ID}?as=student`,
    anchor: "todo-button",
    body:
      "Past due, due this week, due next week — read from the dates the teacher typed. Work the teacher has not opened yet never counts as owed. The same button on the Enrolled dashboard covers every class at once.",
  },
  {
    id: "student-section",
    place: "Student view",
    title: "One subunit, one button per resource",
    href: `/dashboard/class/${TOUR_CLASS_ID}?as=student`,
    anchor: "up-next",
    body:
      "Open Section drops you into the subunit you are on — the sidebar reaches any of the others. Inside, each resource opens into Learn and then Practice, marked on its own, so \"I watched the video but the problem set beat me\" is something the teacher can actually see. Help! raises a hand on that exact step.",
  },
  {
    id: "finish",
    place: "Student view",
    title: "That is the tour",
    href: `/dashboard/class/${TOUR_CLASS_ID}?as=student`,
    body:
      "Explore freely — every screen is the real product, and nothing you change leaves this browser. Open the demo again from the landing page if you want to run through this a second time.",
  },
];

const KEY = "modern-classroom-tour";

export function startTour(): void {
  localStorage.setItem(KEY, "0");
}

export function readTourStep(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (raw === null) return null;
  const index = Number.parseInt(raw, 10);
  return Number.isFinite(index) && index >= 0 && index < TOUR_STEPS.length ? index : null;
}

export function writeTourStep(index: number): void {
  localStorage.setItem(KEY, String(index));
}

export function endTour(): void {
  localStorage.removeItem(KEY);
}
