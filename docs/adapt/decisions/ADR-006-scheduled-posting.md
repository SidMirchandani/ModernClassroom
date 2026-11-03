# ADR-006: Classroom's own scheduling posts dated items
Status: Accepted
Date: 2026-11-02
Recorded: live

## Context
- Must-have: items appear in Classroom on their date, not all at once.

## Options considered
- Classroom's own scheduling (send a scheduled publish time).
- Our server, daily job (Vercel cron + stored refresh token).
- Classroom first, server fallback.

## Decision
- Classroom's own scheduling.
- If the spike shows the API won't accept a scheduled publish time: fall back to a daily job.

## Tradeoffs accepted
- OPEN: not stated.

## Spike result (2026-11-03)
- PASS. An API-created DRAFT with `scheduledTime` 3 minutes out showed as "Scheduled for 9:51AM" in Classroom and was PUBLISHED at the check one minute after. After publishing, the API no longer returns `scheduledTime`.
- The daily-job fallback is not needed for scheduling.

## Revisit if
- Classroom's scheduling misbehaves on a real school account.
