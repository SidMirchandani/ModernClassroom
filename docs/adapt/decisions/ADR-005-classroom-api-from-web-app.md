# ADR-005: Talk to Google Classroom through the Classroom API from the web app
Status: Accepted
Date: 2026-11-02
Recorded: live

## Context
- Students should keep using Google Classroom. The teacher's plan must reach Classroom and student activity must come back.

## Options considered
- Classroom API from the web app (server-side, teacher's OAuth grant).
- Chrome extension injected into classroom.google.com (like Mote).
- Classroom add-on (needs Education Plus / Teaching & Learning licence).
- API now, extension later.

## Decision
- Classroom API from the web app. Students never sign in to the app; roster, turn-ins and grades come through the teacher's grant.

## Tradeoffs accepted
- The API can only edit Classroom items this app created.
- OPEN: other tradeoffs not stated.

## Revisit if
- OPEN: not stated.
