# ADR-008: Sync behaviour — pull on open, silent retry, Classroom wins
Status: Accepted
Date: 2026-11-02
Recorded: live

## Context
- Turn-ins happen in Classroom; posts and edits go from the app to Classroom.

## Options considered
- Trigger: pull on open + refresh button · Classroom push notifications · poll every few minutes.
- On Google error: queue and retry with a label · error and Try again · silent retry.
- On edits made directly in Classroom: Classroom wins · app wins · ask her.

## Decision
- Pull turn-ins when the grid opens, plus a refresh button.
- Google down or rate-limited: silent retry.
- Item edited or deleted directly in Classroom: Classroom wins; the app adopts it.

## Tradeoffs accepted
- OPEN: not stated.

## Revisit if
- OPEN: not stated.
