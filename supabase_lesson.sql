-- ============================================================
--  Dash — 「1レッスン1評価（上書き式）」に変更するSQL
--  Supabase の SQL Editor に貼って Run
--  ※ これでスター重複が直り、評価の修正／自動次レッスンが有効に
-- ============================================================

-- feedback に「その日のレッスン」列を追加
alter table public.feedback add column if not exists lesson int;

-- 旧・追加式データ（レッスン未設定の行）を一掃 → スター重複をリセット（テストデータ）
delete from public.feedback where lesson is null;

-- 同じ生徒 × 同じレッスンは1行だけ（＝上書きになる）
create unique index if not exists feedback_code_lesson on public.feedback (code, lesson);

-- 評価の上書き（UPDATE）を許可
grant update on public.feedback to anon, authenticated;
drop policy if exists "feedback_update" on public.feedback;
create policy "feedback_update" on public.feedback for update using (true) with check (true);
