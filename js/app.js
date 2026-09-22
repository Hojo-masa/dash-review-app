// ===== Dish Review — app shell & router =====
import { LESSONS, lessonByNo, normalize } from './engine.js';
import { SLIDES } from './slides.js';
import { h, mount, speak, canRecognize, recognizeOnce } from './ui.js';
import * as progress from './progress.js';
import * as db from './supabase.js';
import { TEACHER_PASSCODE } from './config.js';

const APP_NAME = 'Dash';   // Dish の復習アプリ＝Dash（習ったことを駆け抜ける）

const hasSlides = no => SLIDES.some(s => s.lesson === no);

const GAMES = [
  { id:'picture', ico:'🖼️', name:'絵を見て言う', desc:'絵を見て発音',   ready:true,  needsSlides:true, mod:'./games/picture.js' },
  { id:'fill',    ico:'✏️', name:'絵で穴埋め',   desc:'絵を見て空欄を', ready:true,  needsSlides:true, mod:'./games/fill.js' },
  { id:'arrange', ico:'🧩', name:'並べ替え',     desc:'単語を正しい順に', ready:true, mod:'./games/arrange.js' },
  { id:'listen',  ico:'🎧', name:'リスニング',   desc:'音声を聞いて選ぶ', ready:true, mod:'./games/listen.js' },
  { id:'flash',   ico:'🃏', name:'フラッシュ',   desc:'カードで反復',     ready:false, soonNote:'近日公開' },
];

// スキル（ゲーム種別）メタ ＝ 弱点・毎日ドリルで使う
const GAME_META = {
  picture: { label:'絵を見て言う', ico:'🖼️', mod:'./games/picture.js', needsSlides:true },
  fill:    { label:'絵で穴埋め',   ico:'✏️', mod:'./games/fill.js',    needsSlides:true },
  arrange: { label:'並べ替え',     ico:'🧩', mod:'./games/arrange.js' },
  listen:  { label:'リスニング',   ico:'🎧', mod:'./games/listen.js' },
  roleplay:{ label:'ロールプレイ', ico:'🎭', standalone:true },   // 復習回の会話（毎日1文ずつ隠す）
};

const hasDialogues = no => { const L = lessonByNo(no); return !!(L && L.dialogues && L.dialogues.length); };
// そのレッスンで実際に成立するスキルだけ返す（絵ゲームはスライド有り、ロールプレイは会話有りの回のみ）
function availableSkills(no){
  const s = [];
  if(hasSlides(no)) s.push('picture','fill');
  s.push('listen','arrange');
  if(hasDialogues(no)) s.push('roleplay');
  return s;
}
// 会話データの2形式を [{en,ja}, ...] に正規化（en は "A: ..." 形式）
function dialogueLines(dia){
  if(Array.isArray(dia.en)) return dia.en.map((en,idx)=>({ en, ja:(dia.ja&&dia.ja[idx])||'' }));
  if(Array.isArray(dia.lines)) return dia.lines.map(l=>({ en:l.en||'', ja:l.ja||'' }));
  return [];
}

let feedbackList = [];   // 生徒のフィードバック履歴（新→旧）
let feedback = null;     // 最新（スコア/コメント表示用）
let totalStars = 0;      // 累計スター（各レッスン1回分の合計）
let allWeak = [];        // 全レッスンの弱点を統合したもの
let schedule;            // 生徒のスケジュール（undefined=未取得, null=未設定）

async function loadFeedback(code){
  try{
    feedbackList = await db.getFeedbackList(code);
    const rows = feedbackList.filter(f => f.lesson != null);   // 旧・レッスン無し行は無視
    feedback = rows[0] || null;
    totalStars = rows.reduce((s,f)=> s + (f.score||0), 0);
    const seen = new Set(); allWeak = [];
    rows.forEach(f => (f.weak_points||[]).forEach(w => {         // 全レッスン分をためる（重複除去）
      const k = w.lesson+':'+w.game;
      if(!seen.has(k)){ seen.add(k); allWeak.push(w); }
    }));
  }catch(e){ feedbackList=[]; feedback=null; totalStars=0; allWeak=[]; }
}

function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth()+1}月${d.getDate()}日`;
}
function validWeakPoints(){
  return allWeak.filter(w => {
    const m = GAME_META[w.game]; if(!m) return false;
    if(w.game === 'roleplay') return hasDialogues(w.lesson);
    return !m.needsSlides || hasSlides(w.lesson);
  });
}
function drillWeakPoints(){ return validWeakPoints().filter(w => !GAME_META[w.game].standalone); }
function roleplayWeakPoints(){ return validWeakPoints().filter(w => w.game === 'roleplay'); }

const app = document.getElementById('app');

function brandMark(){
  return h('img',{class:'brand-logo',src:'assets/brand/dish-logo.png',alt:'Dish'});
}
function topbar(back){
  return h('div',{class:'topbar'},
    back ? h('button',{class:'back-btn',onClick:back},'←') : brandMark(),
    h('div',{class:'spacer'}),
    h('div',{class:'pill tappable',onClick:streakScreen}, h('span',{class:'fire'},'🔥'), String(progress.dailyStreak())),
    h('div',{class:'pill'}, '⭐ ', String(progress.weekXP()))
  );
}

// ---------- 下部タブ ----------
function tabBar(active){
  const tab = (id, ico, label, fn) => h('button',{class:'tab'+(active===id?' on':''),onClick:fn},
    h('div',{class:'tab-ico'}, ico), h('div',{class:'tab-label'}, label));
  return h('div',{class:'tabbar'},
    tab('home','🏠','ホーム', home),
    tab('schedule','📅','スケジュール', scheduleScreen),
    tab('ranking','🏆','ランキング', rankingScreen)
  );
}

// ---------- HOME ----------
function home(){
  const streak    = progress.dailyStreak();
  const doneToday = progress.doneToday();
  const allWp     = validWeakPoints();
  const drillWp   = drillWeakPoints();
  const rpWp      = roleplayWeakPoints();
  const nick      = progress.nickname() || progress.userName();
  const children  = [];

  children.push(h('div',{class:'hero'},
    h('div',{class:'hero-brand'},
      h('span',{class:'hero-dash'}, APP_NAME),
      h('span',{class:'hero-tag'}, '〜復習を駆け抜ける〜')),
    h('h2',{}, `おかえり${nick ? '、'+nick : ''}！`),
    h('div',{class:'streak-row'},
      h('div',{class:'stat tappable',onClick:streakScreen}, h('b',{}, '🔥'+streak), h('small',{},'連続日')),
      h('div',{class:'stat tappable',onClick:rankingScreen}, h('b',{}, '⭐'+totalStars), h('small',{},'スター')),
      h('div',{class:'stat'}, h('b',{}, doneToday?'✅':'—'), h('small',{},'今日の10問'))
    )
  ));

  if(feedback){
    children.push(h('div',{class:'section-label'},'先生からの評価'));
    children.push(h('div',{class:'card feedback-card'},
      h('div',{class:'fb-top'},
        h('div',{class:'fb-stars'}, '⭐'.repeat(Math.max(0,Math.min(10, feedback.score||0)))),
        h('div',{class:'fb-date'}, '評価日 '+fmtDate(feedback.created_at))),
      h('div',{class:'fb-score-line'}, `今日の評価 ${feedback.score!=null?feedback.score:'-'} / 10`),
      feedback.note ? h('div',{class:'fb-note'}, '「'+feedback.note+'」') : ''
    ));
  }

  if(drillWp.length){
    children.push(h('div',{class:'section-label'},'今日の10問'));
    children.push(h('button',{class:'daily-cta'+(doneToday?' done':''),onClick:dailyDrill},
      h('div',{class:'daily-cta-ico'}, doneToday?'✅':'🔥'),
      h('div',{class:'daily-cta-txt'},
        h('div',{class:'daily-cta-title'}, doneToday?'今日は完了！えらい！':'今日の10問にチャレンジ'),
        h('div',{class:'daily-cta-sub'}, doneToday?'また明日、炎を絶やさずに 🔥':'苦手をまとめて10問。炎をキープ')),
      h('div',{class:'daily-cta-go'}, doneToday?'もう一回':'START')
    ));
  }
  if(rpWp.length){
    children.push(h('div',{class:'section-label'},'ロールプレイ'));
    rpWp.forEach(w=>{
      const L = lessonByNo(w.lesson);
      children.push(h('button',{class:'daily-cta rp',onClick:()=>roleplayEntry(L)},
        h('div',{class:'daily-cta-ico'}, '🎭'),
        h('div',{class:'daily-cta-txt'},
          h('div',{class:'daily-cta-title'}, 'ロールプレイ'),
          h('div',{class:'daily-cta-sub'}, `${L?L.title:''}・毎日1文ずつ隠して暗記`)),
        h('div',{class:'daily-cta-go'}, 'START')));
    });
  }
  if(allWp.length){
    children.push(h('div',{class:'section-label'},'あなたの弱点'));
    allWp.forEach(w=>{
      const L=lessonByNo(w.lesson); const m=GAME_META[w.game];
      children.push(h('div',{class:'weak-row'},
        h('div',{class:'weak-ico'}, m.ico),
        h('div',{class:'weak-body'},
          h('div',{class:'weak-title'}, m.label),
          h('div',{class:'weak-sub'}, `Lesson ${w.lesson}・${L?L.title:''}`))
      ));
    });
  } else {
    children.push(h('div',{class:'empty-feedback card'},
      h('div',{style:'font-size:42px'}, feedback?'🎉':'📝'),
      h('div',{class:'ef-title'}, feedback?'今日の弱点はなし！バッチリ':'先生の評価を待ってね'),
      h('div',{class:'sub'}, '授業のあと、先生が今日の弱点を登録します')));
  }

  children.push(h('div',{class:'foot-links'},
    h('button',{class:'logout-link',onClick:nicknameEditor}, 'ニックネーム設定'),
    h('button',{class:'logout-link',onClick:doLogout}, 'ログアウト')
  ));

  mount(app, topbar(null), h('div',{class:'wrap'}, ...children), tabBar('home'));
  window.scrollTo(0,0);
}

// ---------- スケジュール（時間割） ----------
async function scheduleScreen(){
  mount(app, topbar(null), h('div',{class:'wrap'}, h('div',{class:'sub'},'読み込み中…')), tabBar('schedule'));
  if(schedule === undefined){
    try{ schedule = await db.getSchedule(progress.currentUser()); }catch(e){ schedule = null; }
  }
  const sch = schedule;
  const children = [ h('div',{class:'h1',style:'font-size:20px'}, '📅 スケジュール') ];
  const hasAny = sch && (sch.term_start || sch.term_end || sch.jp || sch.native);
  if(hasAny){
    if(sch.term_start || sch.term_end){
      children.push(h('div',{class:'card term-card'},
        h('div',{class:'term-label'},'受講期間'),
        h('div',{class:'term-range'}, `${sch.term_start||'—'}  〜  ${sch.term_end||'—'}`)));
    }
    children.push(weeklyView(sch));
    children.push(h('div',{class:'sched-legend'},
      h('span',{class:'lg jp'}, '■ 日本人講師'),
      h('span',{class:'lg native'}, '■ ネイティブ講師')));
  } else {
    children.push(h('div',{class:'empty-feedback card'},
      h('div',{style:'font-size:42px'}, '📅'),
      h('div',{class:'ef-title'}, 'まだスケジュール未設定'),
      h('div',{class:'sub'}, '先生が設定すると、授業の曜日・時間がここに出ます')));
  }
  mount(app, topbar(null), h('div',{class:'wrap'}, ...children), tabBar('schedule'));
  window.scrollTo(0,0);
}

function fmtSlot(s){
  if(!s) return '';
  if(s.start || s.end) return `${s.start||''}${(s.start&&s.end)?'〜':''}${s.end||''}`;
  return s.time || '';
}
function weeklyView(sch){
  const days = ['月','火','水','木','金','土','日'];
  const byDay = Array.from({length:7}, ()=>[]);
  const add = (s,type,label)=>{ if(s && s.day!=null && s.day!=='') byDay[s.day].push({type,label,time:fmtSlot(s)}); };
  add(sch.jp,'jp','日本人講師'); add(sch.native,'native','ネイティブ講師');
  const rows = byDay.map((lessons,i)=>h('div',{class:'wk-row'+(lessons.length?' has':'')},
    h('div',{class:'wk-rowday'+(i>=5?' wknd':'')}, days[i]),
    h('div',{class:'wk-rowslots'},
      ...(lessons.length
        ? lessons.map(l=>h('div',{class:'wk-chip '+l.type},
            h('span',{class:'wk-chip-type'}, l.label),
            l.time ? h('span',{class:'wk-chip-time'}, l.time) : ''))
        : [h('div',{class:'wk-none'}, '—')]))
  ));
  return h('div',{class:'card wk-card'}, ...rows);
}

// ---------- DAILY 10 (苦手をまとめて) ----------
function distribute(wp, total){
  if(!wp.length) return [];
  const base = Math.max(1, Math.floor(total / wp.length));
  const rounds = wp.map(w => ({ ...w, limit: base }));
  let sum = base*wp.length, i=0;
  while(sum < total){ rounds[i % rounds.length].limit++; sum++; i++; }
  return rounds;
}

function dailyDrill(){
  const wp = drillWeakPoints();
  if(!wp.length){ home(); return; }
  const rounds = distribute(wp, 10);
  let totalScore=0, totalQ=0, i=0;
  runNext();

  function runNext(){
    if(i >= rounds.length){
      if(totalQ>0) progress.record('drill','daily', totalScore, totalQ);
      drillComplete(totalScore, totalQ);
      return;
    }
    const r = rounds[i++]; const meta = GAME_META[r.game];
    if(!meta){ runNext(); return; }
    mount(app, topbar(home));
    const root = h('div',{}); app.append(root);
    import(meta.mod).then(m => m.play(lessonByNo(r.lesson), root,
      (s,t)=>{ totalScore+=s; totalQ+=t; runNext(); }, { limit:r.limit }));
  }
}

function drillComplete(score, total){
  const streak = progress.dailyStreak();
  mount(app, topbar(home),
    h('div',{class:'streak-hero'},
      h('div',{class:'flame lit'}, '🔥'),
      h('div',{class:'streak-num'}, String(streak)),
      h('div',{class:'streak-unit'}, '日連続！'),
      h('div',{class:'streak-msg'}, `今日の10問クリア！ ${score}/${total} 正解 🎉`)),
    h('div',{class:'wrap'},
      h('button',{class:'btn',onClick:home}, 'ホームへ戻る'))
  );
  window.scrollTo(0,0);
}

// ---------- ロールプレイ（復習回の会話・毎日1文ずつ隠す） ----------
function roleplayEntry(lesson){
  let role = 'B';
  render();
  function render(){
    const dias = lesson.dialogues || [];
    const roleBtns = h('div',{class:'role-toggle'},
      ...['A','B'].map(r=>h('button',{class:'role-btn'+(role===r?' on':''),onClick:()=>{role=r;render();}}, r+'役')));
    const list = h('div',{class:'rp-list'});
    dias.forEach((dia,idx)=>{
      const ls = dialogueLines(dia);
      const myCount = ls.filter(l=>(l.en||'').trim()[0]===role).length;
      const key = `${lesson.no}:${idx}:${role}`;
      const hidden = Math.min(progress.rpHidden(key), myCount);
      const done = myCount>0 && hidden>=myCount;
      list.append(h('button',{class:'rp-item',onClick:()=>roleplayRun(lesson,dia,role,idx)},
        h('div',{class:'rp-item-main'},
          h('div',{class:'rp-item-title'}, `会話 ${idx+1}`),
          h('div',{class:'rp-item-sub'}, myCount===0 ? `${role}役のセリフなし`
              : done ? 'コンプリート！🎉' : `隠し ${hidden} / ${myCount} 文`)),
        h('div',{class:'rp-item-go'}, myCount===0?'':'▶')));
    });
    mount(app, topbarSimple('🎭 ロールプレイ', home),
      h('div',{class:'wrap'},
        h('p',{class:'sub'}, `${lesson.title}｜役を選んで会話を選ぼう`),
        roleBtns, list));
    window.scrollTo(0,0);
  }
}

function roleplayRun(lesson, dia, role, dIdx){
  const lines = dialogueLines(dia).map(({en,ja})=>{
    const ci = en.indexOf(':'); const ji = ja.indexOf(':');
    return { speaker: en.slice(0,ci).trim(), text: en.slice(ci+1).trim(),
             ja: ji>=0 ? ja.slice(ji+1).trim() : ja };
  });
  const myIdx = lines.map((l,i)=>l.speaker===role?i:-1).filter(i=>i>=0);
  if(!myIdx.length){ roleplayEntry(lesson); return; }
  const key = `${lesson.no}:${dIdx}:${role}`;
  const hidden = Math.min(progress.rpHidden(key), myIdx.length);
  const hiddenSet = new Set(myIdx.slice(0, hidden));
  const useMic = canRecognize();
  const total = myIdx.length;
  let i=0, correct=0;
  const log = h('div',{class:'rp-log'});
  step();

  function shell(bottom){
    mount(app, topbarSimple(`会話（${role}役）`, ()=>roleplayEntry(lesson)),
      h('div',{class:'rp-play'}, log, h('div',{class:'rp-bottom'}, bottom)));
    log.scrollTop = log.scrollHeight;
  }
  function bubble(l, cls, extra){
    const b = h('div',{class:'rp-bubble '+cls},
      h('div',{class:'rp-sp'}, l.speaker+'役'+(cls==='me'?'（あなた）':'')),
      h('div',{class:'rp-text'}, l.text));
    if(extra) b.append(extra);
    log.append(b);
  }
  function step(){
    if(i>=lines.length){ finish(); return; }
    const l = lines[i];
    if(l.speaker!==role) partnerTurn(l); else myTurn(l, hiddenSet.has(i));
  }
  function partnerTurn(l){
    bubble(l,'them'); speak(l.text);
    shell(h('button',{class:'btn',onClick:()=>{ i++; step(); }}, '▶ 次へ'));
  }
  function myTurn(l, isHidden){
    if(!isHidden){
      bubble(l,'me'); speak(l.text);
      shell(h('button',{class:'btn',onClick:()=>{ correct++; i++; step(); }}, '言えた！次へ →'));
    } else {
      const status = h('div',{class:'mic-status'});
      const mic = useMic ? h('button',{class:'mic-btn',onClick:go},'🎤') : null;
      const reveal = h('button',{class:'btn ghost',style:'margin-top:10px',onClick:()=>done(null)}, '答えを見る');
      shell(h('div',{},
        h('div',{class:'rp-cue'},
          h('div',{class:'rp-cue-label'},'あなたのセリフ（意味から英語で言おう）'),
          h('div',{class:'rp-cue-ja'}, l.ja || '（ヒントなし）')),
        useMic ? h('div',{style:'text-align:center'}, mic, status) : status,
        reveal));
      async function go(){
        status.textContent='🎙️ 聞いてるよ…';
        mic.classList.add('listening');
        try{
          const alts = await recognizeOnce();
          mic.classList.remove('listening');
          const t = normalize(l.text);
          const ok = alts.some(a=>{ const n=normalize(a); return n===t||n.includes(t)||t.includes(n); });
          done(ok, alts[0]);
        }catch(e){ mic.classList.remove('listening'); status.textContent='うまく聞き取れなかった…もう一度'; }
      }
      function done(ok, said){
        speak(l.text);
        if(ok) correct++;
        bubble(l,'me', (ok===false && said) ? h('div',{class:'rp-said'}, 'あなた: '+said) : null);
        i++; step();
      }
    }
  }
  function finish(){
    progress.rpAdvance(key, total);
    progress.record('roleplay','rp', Math.min(correct,total), total);
    roleplayComplete(lesson, dia, role, key, total);
  }
}

function roleplayComplete(lesson, dia, role, key, total){
  const nowHidden = progress.rpHidden(key);   // 次回の隠し数（今回終了で+1済み）
  const complete = nowHidden >= total;
  mount(app, topbarSimple('🎭 ロールプレイ', ()=>roleplayEntry(lesson)),
    h('div',{class:'streak-hero'},
      h('div',{class:'flame lit'}, complete ? '🏆' : '🎭'),
      h('div',{class:'streak-num'}, complete ? '★' : String(nowHidden)),
      h('div',{class:'streak-unit'}, complete ? 'コンプリート！' : '文まで暗記'),
      h('div',{class:'streak-msg'}, complete
        ? '全部そらで言えた！完璧です 🎉'
        : `ナイス完走！次回はセリフが ${nowHidden}文 隠れるよ🔥`)),
    h('div',{class:'wrap'},
      h('button',{class:'btn',onClick:()=>roleplayEntry(lesson)}, '他の会話へ'),
      h('button',{class:'btn ghost',style:'margin-top:10px',onClick:home}, 'ホームへ'))
  );
  window.scrollTo(0,0);
}

// ---------- ニックネーム ----------
function nicknameEditor(){
  const input = h('input',{class:'auth-input',value:progress.nickname()||'',maxlength:'20',placeholder:'ニックネーム'});
  const msg = h('div',{class:'auth-msg'});
  const save = h('button',{class:'btn',style:'margin-top:10px',onClick:()=>{
    const n = input.value.trim();
    if(!n){ msg.className='auth-msg ng'; msg.textContent='ニックネームを入れてね'; return; }
    progress.setNickname(n); home();
  }}, '保存');
  mount(app, topbarSimple('ニックネーム設定', home),
    h('div',{class:'wrap'},
      h('div',{class:'auth-card card'},
        h('div',{class:'auth-title'},'ランキングに表示される名前'),
        input, msg, save)));
  setTimeout(()=>input.focus(), 80);
}

// ---------- ランキング ----------
async function rankingScreen(){
  mount(app, topbar(null), h('div',{class:'wrap'}, h('div',{class:'sub'},'読み込み中…')), tabBar('ranking'));
  let rows = [];
  try{ rows = await db.getRanking(); }catch(e){}
  rows.sort((a,b)=> b.stars - a.stars || progress.streakFromData(b.data) - progress.streakFromData(a.data));
  const me = progress.currentUser();
  const list = h('div',{class:'rank-list'});
  if(!rows.length) list.append(h('div',{class:'sub'},'まだデータがありません'));
  rows.forEach((r,idx)=>{
    const medal = idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':`${idx+1}`;
    list.append(h('div',{class:'rank-row'+(r.code===me?' me':'')},
      h('div',{class:'rank-pos'}, medal),
      h('div',{class:'rank-name'}, r.name || '(名無し)'),
      h('div',{class:'rank-stars'}, '⭐'+r.stars)
    ));
  });
  mount(app, topbar(null),
    h('div',{class:'wrap'},
      h('div',{class:'h1',style:'font-size:20px'},'⭐ スターランキング'),
      h('p',{class:'sub'},'先生からもらった星の合計で競争！'),
      list),
    tabBar('ranking'));
  window.scrollTo(0,0);
}

function doLogout(){ progress.logout(); loginScreen(); }

// ---------- STREAK (dopamine) ----------
function streakScreen(){
  const streak  = progress.dailyStreak();
  const longest = Math.max(progress.longestStreak(), streak);
  const done    = progress.doneToday();
  const week    = progress.daysPracticedThisWeek();
  const msg = streak === 0 ? '今日からスタート！1問でも火がつくよ 🔥'
            : done          ? `今日はもう完了！この調子で駆け抜けよう 🎉`
            :                 `あと1回やれば ${streak + 1}日目に突入！`;
  const marks = [3,7,14,30,50,100,200,365];
  const next  = marks.find(m => m > streak) || (streak + 100);

  mount(app,
    topbar(home),
    h('div',{class:'streak-hero'},
      h('div',{class:'flame'+(streak>0?' lit':'')}, '🔥'),
      h('div',{class:'streak-num'}, String(streak)),
      h('div',{class:'streak-unit'}, '日連続！'),
      h('div',{class:'streak-msg'}, msg)
    ),
    h('div',{class:'wrap'},
      h('div',{class:'weekdots-card card'}, weekDots(week)),
      h('div',{class:'section-label'}, '連続記録カレンダー'),
      calendarCard(),
      h('div',{class:'section-label'}, '次の目標'),
      goalCard(streak, next, longest)
    )
  );
  window.scrollTo(0,0);
}

function weekDots(count){
  const wd = ['月','火','水','木','金','土','日'];
  const days = progress.activeDays();
  const now = new Date(); const dow = (now.getDay()+6)%7;
  const monday = new Date(now); monday.setDate(now.getDate()-dow);
  const row = h('div',{class:'weekdots'});
  for(let i=0;i<7;i++){
    const d = new Date(monday); d.setDate(monday.getDate()+i);
    const active = !!days[progress.keyOf(d)];
    row.append(h('div',{class:'wd-col'},
      h('div',{class:'wd-dot'+(active?' on':'')}, active?'🔥':''),
      h('small',{}, wd[i])
    ));
  }
  return h('div',{},
    h('div',{class:'weekdots-title'}, `今週は ${count}日 練習したよ`),
    row
  );
}

function calendarCard(){
  const days = progress.activeDays();
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  const offset = (new Date(y,m,1).getDay()+6)%7;      // Monday-first
  const numDays = new Date(y,m+1,0).getDate();
  const wd = ['月','火','水','木','金','土','日'];
  const head = h('div',{class:'cal-grid'}, ...wd.map(w=>h('div',{class:'cal-wd'}, w)));
  const cells = [];
  for(let i=0;i<offset;i++) cells.push(h('div',{class:'cal-cell empty'}));
  for(let d=1; d<=numDays; d++){
    const dt = new Date(y,m,d); const key = progress.keyOf(dt);
    const cls = 'cal-cell' + (days[key]?' active':'') + (key===progress.keyOf(now)?' today':'');
    cells.push(h('div',{class:cls}, h('span',{class:'cal-num'}, String(d))));
  }
  return h('div',{class:'card cal-card'},
    h('div',{class:'cal-title'}, `${y}年${m+1}月`),
    head,
    h('div',{class:'cal-grid'}, ...cells)
  );
}

function goalCard(streak, next, longest){
  const pct = Math.min(100, Math.round(streak / next * 100));
  return h('div',{class:'card goal-card'},
    h('div',{class:'goal-row'}, h('span',{}, `🎯 ${next}日連続まで`), h('b',{}, `あと ${Math.max(0,next-streak)}日`)),
    h('div',{class:'progressbar'}, h('i',{style:`width:${pct}%`})),
    h('div',{class:'goal-longest'}, `🏆 最長記録：${longest}日`)
  );
}

// ---------- LESSON MENU ----------
function lessonMenu(no){
  const L = lessonByNo(no);
  const grid = h('div',{class:'game-grid'});
  GAMES.forEach(g => {
    const blocked = g.needsSlides && !hasSlides(no);
    const ready = g.ready && !blocked;
    const note = blocked ? '絵がまだ' : (g.soonNote || '近日公開');
    const tile = h('div',{class:'game-tile'+(ready?'':' soon'),onClick:()=> ready && runGame(no, g)},
      h('div',{class:'ico'}, g.ico),
      h('div',{class:'name'}, g.name),
      h('div',{class:'desc'}, g.desc),
      ready ? '' : h('div',{class:'soon-tag'}, note)
    );
    grid.append(tile);
  });

  mount(app,
    topbar(home),
    h('div',{class:'wrap'},
      h('div',{class:'h1'}, L.kind==='review' ? `★ ${L.title}` : `Lesson ${L.no}`),
      h('p',{class:'sub'}, L.kind==='review' ? 'これまでの総復習' : L.title),
      grid
    )
  );
  window.scrollTo(0,0);
}

// ---------- RUN A GAME ----------
async function runGame(no, game){
  const L = lessonByNo(no);
  mount(app, topbar(()=>lessonMenu(no)));
  const root = h('div',{});
  app.append(root);
  const mod = await import(game.mod);
  mod.play(L, root, (score, total)=>{
    progress.record(no, game.id, score, total);
    results(no, game, score, total);
  });
}

// ---------- RESULTS ----------
function results(no, game, score, total){
  const pct = score/total;
  const stars = pct>=1?3:pct>=0.7?2:pct>=0.4?1:0;
  const msg = pct>=1?'パーフェクト！🌟':pct>=0.7?'その調子！':pct>=0.4?'あと少し！':'もう一回やってみよう';

  mount(app,
    topbar(home),
    h('div',{class:'result'},
      h('div',{class:'big'}, pct>=0.7?'🎉':'💪'),
      h('div',{class:'stars'}, '★'.repeat(stars) + '☆'.repeat(3-stars)),
      h('div',{class:'score'}, `${score} / ${total}`),
      h('div',{class:'msg'}, msg),
      h('button',{class:'btn',style:'margin-bottom:12px',onClick:()=>runGame(no, game)}, 'もう一回'),
      h('button',{class:'btn ghost',onClick:()=>lessonMenu(no)}, 'ゲームを選ぶ')
    )
  );
  window.scrollTo(0,0);
}

// ---------- AUTH ----------
function topbarSimple(title, back){
  return h('div',{class:'topbar'},
    h('button',{class:'back-btn',onClick:back},'←'),
    h('div',{class:'spacer'}),
    h('div',{class:'topbar-title'}, title),
    h('div',{class:'spacer'})
  );
}

function loginScreen(){
  const input = h('input',{class:'auth-input',type:'text',placeholder:'あいことばコード',
    autocapitalize:'off',autocomplete:'off',spellcheck:'false'});
  const msg = h('div',{class:'auth-msg'});
  const go  = h('button',{class:'btn',style:'margin-top:10px',onClick:submit}, 'はじめる');
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') submit(); });

  async function submit(){
    const code = input.value.trim().toLowerCase();
    if(!code) return;
    msg.className='auth-msg'; msg.textContent='確認中…'; go.disabled=true;
    try{
      if(!db.ready()) throw new Error('offline');
      const st = await db.getStudent(code);
      if(!st){ msg.className='auth-msg ng'; msg.textContent='そのコードは見つかりません。先生に確認してね'; go.disabled=false; return; }
      let cloud=null; try{ cloud = await db.getProgress(code); }catch(e){}
      progress.setUser(code, cloud, st.name);
      await loadFeedback(code);
      home();
    }catch(e){
      msg.className='auth-msg ng'; msg.textContent='接続できませんでした。少し待って試してね'; go.disabled=false;
    }
  }

  mount(app,
    h('div',{class:'auth-wrap'},
      h('img',{class:'auth-logo',src:'assets/brand/dish-logo.png',alt:'Dish'}),
      h('div',{class:'auth-dash'}, 'Dash'),
      h('div',{class:'auth-tag'}, '〜復習を駆け抜ける〜'),
      h('div',{class:'auth-card card'},
        h('div',{class:'auth-title'}, 'あいことばコードを入力'),
        input, msg, go
      ),
      h('button',{class:'auth-teacher',onClick:teacherGate}, '先生用ページ')
    )
  );
  setTimeout(()=>input.focus(), 80);
}

function teacherGate(){
  const input = h('input',{class:'auth-input',type:'password',placeholder:'先生用パスコード'});
  const msg = h('div',{class:'auth-msg'});
  const go = h('button',{class:'btn',style:'margin-top:10px',onClick:check}, '入る');
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') check(); });
  function check(){
    if(input.value === TEACHER_PASSCODE) teacherScreen();
    else { msg.className='auth-msg ng'; msg.textContent='パスコードが違います'; }
  }
  mount(app, h('div',{class:'auth-wrap'},
    h('div',{class:'auth-dash',style:'margin-top:40px'}, '先生用'),
    h('div',{class:'auth-card card'}, h('div',{class:'auth-title'},'パスコード'), input, msg, go),
    h('button',{class:'auth-teacher',onClick:loginScreen}, '← 生徒ログインへ戻る')
  ));
  setTimeout(()=>input.focus(), 80);
}

function teacherScreen(){
  const nameInput = h('input',{class:'auth-input',placeholder:'生徒の名前'});
  const addBtn = h('button',{class:'btn accent',style:'margin-top:10px',onClick:add}, '生徒を追加してコード発行');
  const result = h('div',{class:'teacher-result'});
  const listBox = h('div',{class:'teacher-list'});

  async function refresh(){
    listBox.innerHTML='';
    listBox.append(h('div',{class:'sub'},'読み込み中…'));
    try{
      const rows = await db.listStudents();
      listBox.innerHTML='';
      if(!rows.length){ listBox.append(h('div',{class:'sub'},'まだ生徒がいません')); return; }
      rows.forEach(r=>{
        const pr = Array.isArray(r.progress) ? r.progress[0] : r.progress;
        const streak = pr && pr.data ? progress.streakFromData(pr.data) : 0;
        const fbArr = Array.isArray(r.feedback) ? r.feedback : (r.feedback ? [r.feedback] : []);
        const stars = fbArr.reduce((s,f)=> s + (f.score||0), 0);
        listBox.append(h('div',{class:'teacher-row tappable',onClick:()=>feedbackForm(r)},
          h('div',{class:'tr-main'}, h('b',{}, r.name), h('span',{class:'tr-code'}, r.code)),
          h('div',{class:'tr-meta'},
            h('span',{class:'tr-streak'}, '🔥'+streak),
            h('span',{class:'tr-score'}, '⭐'+stars),
            h('span',{class:'chev'}, '›'))
        ));
      });
    }catch(e){
      listBox.innerHTML='';
      listBox.append(h('div',{class:'auth-msg ng'},'一覧を取得できません（テーブル未作成かも）'));
    }
  }
  async function add(){
    const name = nameInput.value.trim(); if(!name) return;
    addBtn.disabled=true; result.innerHTML='';
    try{
      const s = await db.createStudent(name);
      result.append(h('div',{class:'code-issued'},
        h('div',{}, `${s.name} さんのコード`),
        h('div',{class:'code-big'}, s.code),
        h('div',{class:'sub'}, 'これを生徒に渡してください')
      ));
      nameInput.value=''; refresh();
    }catch(e){
      result.append(h('div',{class:'auth-msg ng'},'追加に失敗（テーブル未作成かも）'));
    }
    addBtn.disabled=false;
  }

  mount(app,
    topbarSimple('先生用ページ', loginScreen),
    h('div',{class:'wrap'},
      h('div',{class:'auth-card card'},
        h('div',{class:'auth-title'},'生徒を追加'), nameInput, addBtn, result),
      h('div',{class:'section-label'},'生徒一覧'),
      h('p',{class:'sub',style:'margin:-4px 4px 10px'},'名前をタップして今日の評価・弱点を入力'),
      listBox
    )
  );
  refresh();
}

// ---------- 講師フィードバック入力 ----------
async function feedbackForm(student){
  let list = [];
  try{ list = await db.getFeedbackList(student.code); }catch(e){}
  const byLesson = {};
  list.forEach(f => { if(f.lesson!=null && byLesson[f.lesson]===undefined) byLesson[f.lesson] = f; });
  const evaluated = Object.keys(byLesson).map(Number);
  const maxLesson = evaluated.length ? Math.max(...evaluated) : 0;
  let curLesson = Math.min(12, maxLesson + 1) || 1;

  let score = null;
  const weak = [];

  const todaySel = h('select',{class:'fb-lesson-sel',onChange:()=>{ curLesson=Number(todaySel.value); loadLesson(); }},
    ...LESSONS.map(L=>h('option',{value:L.no}, `Lesson ${L.no}：${L.title}`)));
  const editNote = h('div',{class:'fb-editnote'});

  const scoreRow = h('div',{class:'score-row'});
  for(let i=1;i<=10;i++){
    const b = h('button',{class:'score-btn',onClick:()=>{
      score=i; [...scoreRow.children].forEach(c=>c.classList.remove('on')); b.classList.add('on');
    }}, String(i));
    scoreRow.append(b);
  }

  const wpLessonSel = h('select',{class:'auth-input select',onChange:renderSkillToggles},
    ...LESSONS.map(L=>h('option',{value:L.no}, `L${L.no} ${L.title}`)));
  const skillBox = h('div',{class:'skill-toggles'});
  const chips = h('div',{class:'chips'});
  function renderChips(){
    chips.innerHTML='';
    if(!weak.length){ chips.append(h('div',{class:'sub'},'まだ弱点なし')); return; }
    weak.forEach((w,idx)=>{
      const m=GAME_META[w.game];
      chips.append(h('div',{class:'chip'}, `${m?m.ico:''} L${w.lesson} × ${m?m.label:w.game} `,
        h('span',{class:'chip-x',onClick:()=>{ weak.splice(idx,1); renderSkillToggles(); renderChips(); }},'×')));
    });
  }
  function renderSkillToggles(){
    skillBox.innerHTML='';
    const wl = Number(wpLessonSel.value);
    availableSkills(wl).forEach(g=>{
      const m = GAME_META[g];
      const on = weak.some(w=>w.lesson===wl && w.game===g);
      skillBox.append(h('button',{class:'skill-toggle'+(on?' on':''),onClick:()=>{
        const idx = weak.findIndex(w=>w.lesson===wl && w.game===g);
        if(idx>=0) weak.splice(idx,1); else weak.push({lesson:wl, game:g});
        renderSkillToggles(); renderChips();
      }}, `${m.ico} ${m.label}`));
    });
  }

  const note = h('textarea',{class:'auth-input',rows:'2',placeholder:'コメント（任意）',style:'resize:vertical'});
  const msg  = h('div',{class:'auth-msg'});
  const save = h('button',{class:'btn',style:'margin-top:12px',onClick:doSave}, 'この評価を保存');

  function loadLesson(){
    const f = byLesson[curLesson];
    score = f ? f.score : null;
    weak.length = 0; if(f && Array.isArray(f.weak_points)) f.weak_points.forEach(w=>weak.push({...w}));
    note.value = f ? (f.note||'') : '';
    [...scoreRow.children].forEach((c,idx)=>c.classList.toggle('on', idx+1===score));
    editNote.textContent = f ? '✏️ このレッスンは評価済み。修正して上書きされます' : '🆕 新しい評価';
    editNote.className = 'fb-editnote'+(f?' edit':'');
    wpLessonSel.value = String(curLesson);
    renderSkillToggles();
    renderChips();
  }

  async function doSave(){
    if(score==null){ msg.className='auth-msg ng'; msg.textContent='スコア（1〜10）を選んでね'; return; }
    save.disabled=true; msg.className='auth-msg'; msg.textContent='保存中…';
    try{
      await db.saveFeedback(student.code, { lesson:curLesson, score, note:note.value.trim(), weakPoints:weak });
      teacherScreen();
    }catch(e){ msg.className='auth-msg ng'; msg.textContent='保存に失敗しました'; save.disabled=false; }
  }

  todaySel.value = String(curLesson);
  loadLesson();

  mount(app,
    topbarSimple(student.name+' の評価', teacherScreen),
    h('div',{class:'wrap'},
      h('button',{class:'btn ghost',style:'margin-bottom:14px',onClick:()=>scheduleForm(student)}, '📅 スケジュールを設定'),
      h('div',{class:'auth-card card'},
        h('div',{class:'auth-title'},'今日のレッスン'),
        h('p',{class:'sub',style:'text-align:center;margin:-4px 0 8px'},'前回の次を自動表示（授業が前後したら変更OK）'),
        todaySel, editNote),
      h('div',{class:'auth-card card',style:'margin-top:12px'},
        h('div',{class:'auth-title'},'今日の総合評価（1〜10）'),
        h('p',{class:'sub',style:'text-align:center;margin:-4px 0 8px'},'その子のレベル基準で相対評価'),
        scoreRow),
      h('div',{class:'auth-card card',style:'margin-top:12px'},
        h('div',{class:'auth-title'},'弱点スキル'),
        h('p',{class:'sub',style:'text-align:center;margin:-4px 0 10px'},'苦手なスキルをタップ（過去回はレッスンを変更）'),
        h('div',{class:'wp-lesson-row'}, h('span',{class:'wp-lesson-lb'},'レッスン'), wpLessonSel),
        skillBox, chips),
      h('div',{class:'auth-card card',style:'margin-top:12px'},
        h('div',{class:'auth-title'},'コメント'), note),
      msg, save
    )
  );
  window.scrollTo(0,0);
}

// ---------- 講師：スケジュール設定 ----------
async function scheduleForm(student){
  let sch = {};
  try{ sch = (await db.getSchedule(student.code)) || {}; }catch(e){}
  const days = ['月','火','水','木','金','土','日'];
  const startI = h('input',{class:'auth-input',type:'date',value:sch.term_start||''});
  const endI   = h('input',{class:'auth-input',type:'date',value:sch.term_end||''});
  const daySel = (cur)=> h('select',{class:'sched-day'},
    h('option',{value:''},'曜日'),
    ...days.map((d,i)=>{ const o=h('option',{value:i}, d+'曜'); if(cur===i) o.selected=true; return o; }));
  const timeI = (v)=> h('input',{class:'sched-time',type:'time',value:v||''});
  const startOf = s => s ? (s.start || (s.time ? (s.time.split(/[-~〜]/)[0]||'').trim() : '')) : '';
  const endOf   = s => s ? (s.end   || (s.time ? (s.time.split(/[-~〜]/)[1]||'').trim() : '')) : '';

  const jpDay = daySel(sch.jp && sch.jp.day);
  const jpS = timeI(startOf(sch.jp)), jpE = timeI(endOf(sch.jp));
  const nvDay = daySel(sch.native && sch.native.day);
  const nvS = timeI(startOf(sch.native)), nvE = timeI(endOf(sch.native));
  const msg = h('div',{class:'auth-msg'});
  const save = h('button',{class:'btn',style:'margin-top:12px',onClick:doSave}, 'スケジュールを保存');

  function slot(daySel, s, e){
    return daySel.value!=='' ? { day:Number(daySel.value), start:s.value, end:e.value } : null;
  }
  async function doSave(){
    const data = {
      term_start: startI.value || null,
      term_end:   endI.value || null,
      jp:     slot(jpDay, jpS, jpE),
      native: slot(nvDay, nvS, nvE),
    };
    save.disabled=true; msg.className='auth-msg'; msg.textContent='保存中…';
    try{ await db.saveSchedule(student.code, data); schedule=undefined; feedbackForm(student); }
    catch(e){ msg.className='auth-msg ng'; msg.textContent='保存に失敗しました'; save.disabled=false; }
  }

  mount(app,
    topbarSimple(student.name+' のスケジュール', ()=>feedbackForm(student)),
    h('div',{class:'wrap'},
      h('div',{class:'auth-card card'},
        h('div',{class:'auth-title'},'受講期間'),
        h('div',{class:'wp-selects'}, startI, endI)),
      h('div',{class:'auth-card card',style:'margin-top:12px'},
        h('div',{class:'auth-title'},'日本人講師の枠'),
        h('div',{class:'sched-row'}, jpDay, jpS, h('span',{class:'tilde'},'〜'), jpE)),
      h('div',{class:'auth-card card',style:'margin-top:12px'},
        h('div',{class:'auth-title'},'ネイティブ講師の枠'),
        h('div',{class:'sched-row'}, nvDay, nvS, h('span',{class:'tilde'},'〜'), nvE)),
      msg, save
    )
  );
  window.scrollTo(0,0);
}

// ---------- BOOT ----------
async function boot(){
  let saved=null; try{ saved = localStorage.getItem('dash_current_code'); }catch(e){}
  if(saved && db.ready()){
    try{
      const st = await db.getStudent(saved);
      if(st){
        let cloud=null; try{ cloud = await db.getProgress(saved); }catch(e){}
        progress.setUser(saved, cloud, st.name);
        await loadFeedback(saved);
        home(); return;
      }
    }catch(e){ /* fall through to login */ }
  }
  loginScreen();
}
boot();
