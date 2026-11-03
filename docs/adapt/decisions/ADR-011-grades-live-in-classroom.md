# ADR-011: Grades live in Google Classroom
Status: Accepted
Date: 2026-11-03
Recorded: live

## Context
- The builder asked for a grade ("out of") on every item in the progress grid, lessons included, not only quizzes and tests.
- Students exist only in Google Classroom; they have no Modern Classroom accounts. The existing `checkpoint_grades` table is keyed to app accounts.
- Every posted lesson and quiz is already a Classroom assignment with its own grade.

## Options considered
- What gets one grade: each resource (one per Classroom assignment) · each lesson (one combined assignment per subunit).
- Default total: 100 · 10 · ungraded until set.
- When students see a mark: right away · when the teacher returns the column.
- What a cell shows: mark + turn-in status · mark only.

## Decision
- Grades are read from and written to Classroom's own grade on each assignment; no grade table of ours.
- One grade per resource.
- Out of 100 by default; each column's total is editable and becomes the assignment's points.
- A typed mark is a draft grade; "Return grades" releases a column.
- Cells show the mark and the turn-in status.
- Builds on M3 (roster and turn-ins from Classroom).

## Tradeoffs accepted
- OPEN: not stated.

## Revisit if
- OPEN: not stated.
