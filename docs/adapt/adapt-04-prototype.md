Stage: 04 Prototype
Status: Passed
Last updated: 2026-11-02

# 04 Prototype: try cheap, then build

Retrofit mode: the current app (v6.2) is the prototype. Nothing Classroom-related is built yet.

## Unproven assumptions
Google side:
- The Classroom API accepts a scheduled publish time on drafts.
- Her school's Workspace admin will approve the app for her account.
- The teacher grant can read every student's submission state and grade.
- Holding items unpublished as "the gate" works well for her and students.

Her side:
- She can follow connect → upload → approve without help.
- The import reads her real files well enough to approve.
- She'll stop hand-posting in Classroom.
- Her own Classroom edits being adopted ("Classroom wins") won't surprise her.

## Riskiest
- **API takes scheduled time** and **school will approve the app**, equally.
- The builder is ~99% sure "she'll stop hand-posting" and "import reads her real files" hold.

## Cheap tests
- **Scheduled time:** M1 Spike. Done when an API-created draft with a scheduled time publishes on its own in a personal-Gmail test class. If not, fall back to a daily job ([ADR-006](decisions/ADR-006-scheduled-posting.md)).
- **School approval:** look up the district's published approved-app list / request process, then after the demo she forwards a short request the builder writes.

## Results
- **M1 (2026-11-03): PASS.** Scheduled draft published on its own on a personal-Gmail class. See [ADR-006](decisions/ADR-006-scheduled-posting.md).

## Milestones
| # | Milestone | Done when |
|---|---|---|
| M1 | Spike: connect Google + scheduled draft on test class | An API-created draft with a scheduled time publishes on its own on a personal-Gmail test class |
| M2 | Post approved curriculum + gate | Approving a real syllabus creates every topic/assignment; items past the gate stay unpublished |
| M3 | Pull turn-ins into grid | A test student's Classroom turn-in shows on the grid after open/refresh; other open devices update live; cached student data is wiped on class delete / Google disconnect |
| M4 | Checkpoint grades to Classroom | A mark typed in the grid shows on the assignment in Classroom, and a grade changed in Classroom shows in the grid |
| M5 | Push plan updates | A changed syllabus works like it does now: edits are suggested and can be approved or declined row by row, and approved ones reach Classroom |
| M6 | Demo to Ms. Gomes | The 5-minute demo runs clean on personal-Gmail accounts, she says yes, and the approval request is with school IT |

## AI coding rules (builder commits to)
- Prompt from the spec docs (`docs/adapt/` + `ModernClassroom.md`).
- Review every diff.
- Small commits.
- Can explain every line.
- Tests before merge (Vitest).
