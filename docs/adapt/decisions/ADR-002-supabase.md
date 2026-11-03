# ADR-002: Supabase for database, auth and realtime
Status: Accepted
Date: 2026-11-02
Recorded: retroactively

## Context
- v4.0 moved data from browser localStorage to a server.

## Options considered
- None considered at the time.

## Decision
- Supabase (Postgres + RLS + Auth + Realtime).
- Why: realtime sync.
- In v1 (students in Classroom), realtime's job is live updates to the teacher's progress grid.

## Tradeoffs accepted
- OPEN: not stated.

## Revisit if
- OPEN: not stated.
