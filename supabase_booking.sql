-- ============================================================
--  Dash — 予約システム（空き枠方式）テーブル
--  Supabase の SQL Editor に貼って Run
-- ============================================================

-- 先生が開ける「予約枠」
create table if not exists public.slots (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,                 -- 日付
  start_time text not null,                 -- 例 "17:00"
  end_time   text,                          -- 例 "18:00"
  teacher    text not null default 'ネイティブ',  -- ネイティブ / 日本人 / 面談 など
  kind       text not null default 'any',   -- any / lesson / makeup / trial / counsel（この枠が対象にする予約種別。any=なんでも）
  capacity   int  not null default 1,       -- 定員
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists slots_date on public.slots (date, start_time);

-- 生徒の予約
create table if not exists public.reservations (
  id         uuid primary key default gen_random_uuid(),
  slot_id    uuid not null references public.slots(id) on delete cascade,
  code       text not null references public.students(code) on delete cascade,
  kind       text not null default 'lesson',  -- lesson(通常) / makeup(振替) / trial(体験) / counsel(面談)
  status     text not null default 'confirmed', -- confirmed / cancelled
  created_at timestamptz not null default now()
);
create index if not exists reservations_slot on public.reservations (slot_id);
create index if not exists reservations_code on public.reservations (code, created_at desc);

-- 権限＆RLS（v1：合言葉コード方式に合わせて公開ロールから利用可）
grant select, insert, update, delete on public.slots        to anon, authenticated;
grant select, insert, update, delete on public.reservations to anon, authenticated;
alter table public.slots        enable row level security;
alter table public.reservations enable row level security;
drop policy if exists "slots_all" on public.slots;
drop policy if exists "reservations_all" on public.reservations;
create policy "slots_all"        on public.slots        for all using (true) with check (true);
create policy "reservations_all" on public.reservations for all using (true) with check (true);
