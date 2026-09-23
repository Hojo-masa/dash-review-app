-- ============================================================
--  Dash — 講師フィードバック機能 追加SQL
--  Supabase の「SQL Editor」に貼って Run（既存の students / progress はそのまま）
-- ============================================================

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  code        text not null references public.students(code) on delete cascade,
  score       int,                                  -- その日の総合評価 1〜10
  note        text,                                 -- 講師コメント
  weak_points jsonb not null default '[]'::jsonb,   -- [{ "lesson": 1, "game": "listen" }, ...]
  created_at  timestamptz not null default now()
);

grant select, insert on public.feedback to anon, authenticated;

alter table public.feedback enable row level security;

drop policy if exists "feedback_read"   on public.feedback;
drop policy if exists "feedback_insert" on public.feedback;
create policy "feedback_read"   on public.feedback for select using (true);
create policy "feedback_insert" on public.feedback for insert with check (true);

create index if not exists feedback_code_created on public.feedback (code, created_at desc);

-- ------------------------------------------------------------
--  スケジュール（受講期間＋日本人/ネイティブ講師の曜日・時間枠）
-- ------------------------------------------------------------
create table if not exists public.schedules (
  code       text primary key references public.students(code) on delete cascade,
  data       jsonb not null default '{}'::jsonb,   -- { term_start, term_end, jp:{day,time}, native:{day,time} }
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.schedules to anon, authenticated;
alter table public.schedules enable row level security;
drop policy if exists "schedules_all" on public.schedules;
create policy "schedules_all" on public.schedules for all using (true) with check (true);
