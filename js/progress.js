// ===== progress (localStorage cache + Supabase cloud sync) =====
import { saveProgress, ready } from './supabase.js';
const WEEKLY_GOAL = 100;

let currentCode = null;
let currentName = null;
function lsKey(){ return 'dash_progress_' + (currentCode || 'guest'); }

// ログイン時に呼ぶ：現在の生徒コードを設定し、クラウドのデータでローカルを上書き
export function setUser(code, cloudData, name){
  currentCode = code;
  currentName = name || null;
  try{ localStorage.setItem('dash_current_code', code); }catch(e){}
  try{ if(name) localStorage.setItem('dash_current_name', name); }catch(e){}
  if(cloudData && typeof cloudData === 'object'){
    try{ localStorage.setItem(lsKey(), JSON.stringify(cloudData)); }catch(e){}
  }
}
export function currentUser(){ return currentCode; }
export function userName(){
  if(currentName) return currentName;
  try{ return localStorage.getItem('dash_current_name'); }catch(e){ return null; }
}
export function logout(){
  try{ localStorage.removeItem('dash_current_code'); localStorage.removeItem('dash_current_name'); }catch(e){}
  currentCode = null; currentName = null;
}

// 任意の進捗blobから連続日数を計算（先生ダッシュボード用）
export function streakFromData(data){
  const days = (data && data.days) || {};
  let n = 0; const d = new Date();
  if(!days[keyOf(d)]) d.setDate(d.getDate()-1);
  while(days[keyOf(d)]){ n++; d.setDate(d.getDate()-1); }
  return n;
}

function pad(n){ return String(n).padStart(2,'0'); }
function keyOf(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function today(){ return new Date(); }
function weekIndex(){
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()) / (7*86400000));
}

function load(){
  let s;
  try{ s = JSON.parse(localStorage.getItem(lsKey())); }catch(e){ s = null; }
  if(!s) s = { days:{}, weekIdx:weekIndex(), weekXP:0, records:{}, started:{}, completed:{} };
  s.days = s.days || {};
  if(s.weekIdx !== weekIndex()){ s.weekIdx = weekIndex(); s.weekXP = 0; }
  return s;
}
function save(s){
  try{ localStorage.setItem(lsKey(), JSON.stringify(s)); }catch(e){}
  if(currentCode && ready()){ saveProgress(currentCode, s).catch(()=>{}); }  // クラウドへ（失敗は無視）
}

export function record(no, game, score, total){
  const s = load();
  const k = `${no}:${game}`;
  const prev = s.records[k] || { best:0, plays:0 };
  s.records[k] = { best:Math.max(prev.best, score), total, plays:prev.plays+1 };
  s.started[no] = true;
  if(score === total) s.completed[no] = true;
  s.weekXP = (s.weekXP||0) + score*10;
  const dk = keyOf(today());
  s.days[dk] = ((s.days[dk]||0) + score*10) || 1;   // その日のXP。プレイした事実は最低1で必ず記録
  save(s);
}

// ---- daily streak (Duolingo-style) ----
export function dailyStreak(){
  const days = load().days;
  let n = 0; const d = today();
  if(!days[keyOf(d)]) d.setDate(d.getDate()-1);   // today not done yet -> streak still alive from yesterday
  while(days[keyOf(d)]){ n++; d.setDate(d.getDate()-1); }
  return n;
}
export function longestStreak(){
  const keys = Object.keys(load().days).sort();
  let best=0, cur=0, prev=null;
  for(const k of keys){
    const d = new Date(k);
    if(prev && (d - prev)===86400000) cur++; else cur=1;
    best = Math.max(best, cur); prev = d;
  }
  return best;
}
export function doneToday(){ return !!load().days[keyOf(today())]; }
export function activeDays(){ return load().days; }        // {'YYYY-MM-DD': xp}
export function daysPracticedThisWeek(){
  const days = load().days; const now = today();
  const monday = new Date(now); const dow = (now.getDay()+6)%7; monday.setDate(now.getDate()-dow);
  let c=0; for(let i=0;i<7;i++){ const d=new Date(monday); d.setDate(monday.getDate()+i); if(days[keyOf(d)]) c++; }
  return c;
}

// ---- weekly XP / lessons ----
export function weekXP(){ return load().weekXP || 0; }
export function weeklyGoal(){ return WEEKLY_GOAL; }
export function lessonStarted(no){ return !!load().started[no]; }
export function lessonCompleted(no){ return !!load().completed[no]; }
export function doneCount(){ return Object.keys(load().started).length; }
export { keyOf };
