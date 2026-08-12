-- =====================================================================
-- Fix the column defaults on email_settings
--
-- Four of the five payment-reminder flags default to TRUE:
--
--     five_day_reminder    default false
--     day_of_reminder      default TRUE
--     one_day_overdue      default false
--     three_day_overdue    default TRUE
--     seven_day_overdue    default TRUE
--
-- (Verified empirically by inserting a row with a single column set and
-- reading back what the rest became.)
--
-- This feature sends email to tenants. A settings row created without
-- naming every column therefore switches on three reminder schedules the
-- landlord never enabled. That is the wrong direction to fail in: the
-- safe default for "send mail on the landlord's behalf" is off.
--
-- The app no longer depends on these defaults -- setReminderField in
-- lib/payment-reminders/core.js writes all five flags on every save, so
-- a row created through the UI is fully specified. This script closes
-- the other doors: a seed script, a manual INSERT in the SQL editor, or
-- a future API route that inserts a partial row.
--
-- Safe to run at any time. Changing a DEFAULT does not touch existing
-- rows, and the UPDATE below is scoped to NULLs only, so a landlord who
-- has deliberately enabled a reminder keeps it.
-- =====================================================================

alter table public.email_settings alter column five_day_reminder  set default false;
alter table public.email_settings alter column day_of_reminder    set default false;
alter table public.email_settings alter column one_day_overdue    set default false;
alter table public.email_settings alter column three_day_overdue  set default false;
alter table public.email_settings alter column seven_day_overdue  set default false;

-- Belt and braces: a NULL flag reads as "off" in the UI (mapEmailSettings
-- coerces), but leaving NULLs around invites a future `where five_day_reminder`
-- to behave as neither true nor false. Only touches NULLs.
update public.email_settings set five_day_reminder  = false where five_day_reminder  is null;
update public.email_settings set day_of_reminder    = false where day_of_reminder    is null;
update public.email_settings set one_day_overdue    = false where one_day_overdue    is null;
update public.email_settings set three_day_overdue  = false where three_day_overdue  is null;
update public.email_settings set seven_day_overdue  = false where seven_day_overdue  is null;

-- Confirm: every default should now read `false`.
select column_name, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'email_settings'
  and column_name in (
    'five_day_reminder', 'day_of_reminder', 'one_day_overdue',
    'three_day_overdue', 'seven_day_overdue'
  )
order by column_name;
