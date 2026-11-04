-- The colour of a class's Google Classroom side on the dashboard. It lives here
-- because it can't live in Google: Classroom's API neither gives out nor changes
-- a class's theme, so this only colours our own banner. Null is the default.
-- The same fixed set as a class's own colour (lib/class-appearance.ts).
alter table public.classes
  add column classroom_color text
    check (classroom_color in ('blue', 'indigo', 'violet', 'teal', 'emerald', 'amber', 'rose', 'slate'));
