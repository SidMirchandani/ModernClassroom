# ADR-007: Curriculum ↔ Classroom links live in a new Supabase table
Status: Accepted
Date: 2026-11-02
Recorded: live

## Context
- Each posted section track / checkpoint must be tied to its Classroom item to update it later and match turn-ins.

## Options considered
- New Supabase table (one row per curriculum item ↔ Classroom item id).
- Fields on existing rows.
- Not stored (match by title each sync).

## Decision
- New Supabase table.
- Builder's view: this mapping is the hardest part to change later.

## Tradeoffs accepted
- OPEN: not stated.

## Revisit if
- OPEN: not stated.
