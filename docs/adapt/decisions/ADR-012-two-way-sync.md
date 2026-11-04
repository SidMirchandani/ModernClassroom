# ADR-012: Two-way sync with Google Classroom
Status: Accepted
Date: 2026-11-04
Recorded: live

## Context
- The builder asked for "Update Google Classroom" to go and for changes on either side to show up on the other.
- The sync only ever created items and moved schedules. Edits to the curriculum never reached items already in Classroom, and edits in Classroom were never read.
- One lesson can be several Classroom items (one per resource, Learn and Practice), so the two sides don't line up one to one.
- A Classroom assignment deleted through the API takes students' submissions with it.
- Classroom's API lets this app edit only what it created.

## Options considered
- Noticing change: compare each side against what was last agreed · compare the two sides directly and pick one. Comparing directly can't tell which side changed.
- Classroom edits: write them into the stored curriculum · show them over it without changing it.
- Timing: on opening a class and on Refresh · instantly, through Google's notification service.

## Decision
- Each link remembers what the curriculum last sent (`sent`) and what Classroom last said (`classroom`). The curriculum differing from `sent` is an edit here, and is sent. Classroom differing is an edit there, and is left alone until the curriculum changes that same field.
- Classroom edits are shown over the curriculum and in the grid, not written into it. Uploading the same file again finds nothing new and can't undo them.
- A lesson takes a new date only when all its items moved to the same day. A quiz, which is one item, takes its title and date directly.
- An item deleted in Classroom is not recreated. It leaves the grid and is crossed out in the curriculum.
- An item dropped from the curriculum is deleted from Classroom only if no student has touched it. Otherwise it stays (`KEPT`) and the teacher is told.
- A lesson renumbered in an upload keeps its Classroom item when the match is unambiguous.
- Assignments posted by hand appear read-only under "Also in Google Classroom".
- Syncing runs when a class opens and after any change here. There is no button.

## Tradeoffs accepted
- Changes made in Classroom appear on next open or Refresh, not instantly.
- Links on an existing item (materials) aren't updated: the update call doesn't cover them.
- A lesson's title doesn't take an edit made to one of its items; the grid shows it on that item's column.
- An item's move to a different topic in either direction isn't tracked.

## Revisit if
- Teachers need Classroom changes to appear while the app is open: Google's push notifications cover this.
- Teachers try to edit lessons in Classroom and expect the whole lesson to follow.
