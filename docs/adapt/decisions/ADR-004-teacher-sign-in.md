# ADR-004: Teacher sign-in — keep email/password, add "Connect Google Classroom"
Status: Accepted
Date: 2026-11-02
Recorded: live

## Context
- Accounts are Supabase email/password today. v1 needs the teacher's Google grant for the Classroom API.

## Options considered
- Google sign-in only.
- Both: email/password account plus a separate Connect Google Classroom step.
- Email now, Google later.

## Decision
- Both.
- 2026-11-03: the builder added **"Continue with Google"** to Log In and Sign Up (Supabase's Google provider), alongside email/password.
  - As built, that button only signs in. Connecting Google Classroom stays its own step, so a plain sign-in never asks for access to anyone's classes. OPEN: whether to merge the two into one Google consent.

## Tradeoffs accepted
- OPEN: not stated.

## Revisit if
- OPEN: not stated.
