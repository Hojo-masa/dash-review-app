// ===== Supabase データアクセス =====
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// supabase-js は index.html の UMD スクリプトで window.supabase として読み込む
const sb = (window.supabase && SUPABASE_URL && SUPABASE_KEY)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

export function ready(){ return !!sb; }

// 合言葉コードで生徒を照合
export async function getStudent(code){
  const { data, error } = await sb.from('students').select('code,name').eq('code', code).maybeSingle();
  if(error) throw error;
  return data;   // null = 見つからない
}

// 先生：生徒を追加してコードを発行
export async function createStudent(name){
  const code = genCode(name);
  const { error } = await sb.from('students').insert({ code, name });
  if(error) throw error;
  return { code, name };
}

export async function listStudents(){
  let res = await sb.from('students')
    .select('code,name,created_at, progress(data,updated_at), feedback(score,created_at)')
    .order('created_at', { ascending:true });
  if(res.error){   // feedback テーブル未作成でも生徒一覧は出す
    res = await sb.from('students')
      .select('code,name,created_at, progress(data,updated_at)')
      .order('created_at', { ascending:true });
  }
  if(res.error) throw res.error;
  return res.data || [];
}

// 講師フィードバックを保存（1レッスン1評価＝上書き）
export async function saveFeedback(code, { lesson, score, note, weakPoints }){
  const { error } = await sb.from('feedback')
    .upsert({ code, lesson, score, note: note || null, weak_points: weakPoints || [],
              created_at: new Date().toISOString() },
            { onConflict: 'code,lesson' });
  if(error) throw error;
}

// 生徒のフィードバック履歴（新しい順）。[0]=最新（現在の弱点）／合計スコア=累計スター
export async function getFeedbackList(code){
  const { data, error } = await sb.from('feedback')
    .select('lesson,score,note,weak_points,created_at')
    .eq('code', code)
    .order('created_at', { ascending:false });
  if(error) throw error;
  return data || [];
}

// ランキング用：全生徒の 累計スター（フィードバックscore合計）＋ニックネーム＋連続日
export async function getRanking(){
  const [fbRes, prRes, stRes] = await Promise.all([
    sb.from('feedback').select('code,score,lesson'),
    sb.from('progress').select('code,data'),
    sb.from('students').select('code,name'),
  ]);
  const stars = {}; (fbRes.data||[]).forEach(f => { if(f.lesson!=null) stars[f.code] = (stars[f.code]||0) + (f.score||0); });
  const prog = {}; (prRes.data||[]).forEach(p => { prog[p.code] = p.data || {}; });
  const rows = (stRes.data||[]).map(s => ({
    code: s.code,
    name: (prog[s.code] && prog[s.code].nickname) || s.name,
    stars: stars[s.code] || 0,
    data: prog[s.code] || {},
  }));
  return rows;
}

export async function getProgress(code){
  const { data, error } = await sb.from('progress').select('data').eq('code', code).maybeSingle();
  if(error) throw error;
  return data ? data.data : null;
}

export async function saveProgress(code, blob){
  const { error } = await sb.from('progress')
    .upsert({ code, data: blob, updated_at: new Date().toISOString() }, { onConflict:'code' });
  if(error) throw error;
}

// スケジュール（受講期間＋講師枠）
export async function getSchedule(code){
  const { data, error } = await sb.from('schedules').select('data').eq('code', code).maybeSingle();
  if(error) throw error;
  return data ? data.data : null;
}
export async function saveSchedule(code, data){
  const { error } = await sb.from('schedules')
    .upsert({ code, data, updated_at: new Date().toISOString() }, { onConflict:'code' });
  if(error) throw error;
}

// ===== 予約システム =====
export async function listSlots(){
  const today = new Date().toISOString().slice(0,10);
  const { data, error } = await sb.from('slots')
    .select('*, reservations(id,status)')
    .gte('date', today)
    .order('date').order('start_time');
  if(error) throw error;
  return (data||[]).map(s => {
    const taken = (s.reservations||[]).filter(r=>r.status==='confirmed').length;
    return { ...s, taken, open: taken < s.capacity };
  });
}
export async function createSlot(slot){ const { error } = await sb.from('slots').insert(slot); if(error) throw error; }
export async function deleteSlot(id){ const { error } = await sb.from('slots').delete().eq('id', id); if(error) throw error; }
export async function book(slot_id, code, kind){
  const { error } = await sb.from('reservations').insert({ slot_id, code, kind });
  if(error) throw error;
}
export async function myReservations(code){
  const { data, error } = await sb.from('reservations')
    .select('id,kind,status,created_at, slots(date,start_time,end_time,teacher)')
    .eq('code', code).eq('status','confirmed')
    .order('created_at', { ascending:false });
  if(error) throw error; return data || [];
}
export async function cancelReservation(id){
  const { error } = await sb.from('reservations').update({ status:'cancelled' }).eq('id', id);
  if(error) throw error;
}
export async function allReservations(){
  const { data, error } = await sb.from('reservations')
    .select('id,kind,code, students(name), slots(date,start_time,teacher)')
    .eq('status','confirmed');
  if(error) throw error; return data || [];
}

function genCode(name){
  const base = (name||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,6) || 'dash';
  const rnd = Math.random().toString(36).slice(2,6);
  return `${base}-${rnd}`;
}
