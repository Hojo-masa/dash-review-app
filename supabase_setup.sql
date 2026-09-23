-- ============================================================
--  Dash 復習アプリ — テーブル作成SQL
--  Supabase の左メニュー「SQL Editor」に貼り付けて「Run」を押すだけ
-- ============================================================

-- 生徒（合言葉コード）
create table if not exists public.students (
  code       text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

-- 進捗（生徒ごとに1行、進捗まるごとをJSONで保存）
create table if not exists public.progress (
  code       text primary key references public.students(code) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 権限（publishable/anon キーから使えるように）
grant select, insert          on public.students to anon, authenticated;
grant select, insert, update  on public.progress to anon, authenticated;

-- 行レベルセキュリティ
alter table public.students enable row level security;
alter table public.progress enable row level security;

-- v1 ポリシー：合言葉コードはランダムで推測困難、かつ保存されるのは学習進捗のみ（非機微）。
--             まずシンプルに公開ロールから利用可に。将来 Supabase Auth ベースへ強化可能。
drop policy if exists "students_read"   on public.students;
drop policy if exists "students_insert" on public.students;
drop policy if exists "progress_all"    on public.progress;

create policy "students_read"   on public.students for select using (true);
create policy "students_insert" on public.students for insert with check (true);
create policy "progress_all"    on public.progress for all    using (true) with check (true);
