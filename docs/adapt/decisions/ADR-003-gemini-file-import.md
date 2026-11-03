# ADR-003: Gemini reads uploaded curriculum files
Status: Accepted
Date: 2026-11-02
Recorded: retroactively

## Context
- Teachers keep their year plan in Word, Excel, PDF or printed pages.

## Options considered
- None considered at the time.

## Decision
- Gemini API, server-side in `/api/curriculum/import`.
- Why: free tier.

## Tradeoffs accepted
- Free tier is 20 imports/day site-wide. One teacher shouldn't hit it; if she does, paying a few cents per import is acceptable.

## Revisit if
- More teachers join: Gemini's free limit is the first thing to break at 10x.
