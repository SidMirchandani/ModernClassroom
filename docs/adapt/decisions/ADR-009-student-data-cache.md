# ADR-009: Student data is a cache, wiped on delete
Status: Accepted
Date: 2026-11-02
Recorded: live

## Context
- Students never use the app. Their roster, turn-ins and grades come from Classroom via the teacher's grant.

## Options considered
- Nothing stored, fetch live.
- A cache, wiped on delete.
- Cache only checkpoint grades.

## Decision
- Cache names and progress for speed; delete it when the class is deleted or Google is disconnected.

## Tradeoffs accepted
- OPEN: not stated.

## Revisit if
- OPEN: not stated.
