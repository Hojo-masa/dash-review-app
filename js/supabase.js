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
  const { data, error } = await sb
    .from('students')
    .select('code,name,created_at, progress(data,updated_at)')
    .order('created_at', { ascending:true });
  if(error) throw error;
  return data || [];
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

function genCode(name){
  const base = (name||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,6) || 'dash';
  const rnd = Math.random().toString(36).slice(2,6);
  return `${base}-${rnd}`;
}
