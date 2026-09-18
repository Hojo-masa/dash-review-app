// ===== Dish Review — app shell & router =====
import { LESSONS, lessonByNo } from './engine.js';
import { SLIDES } from './slides.js';
import { h, mount } from './ui.js';
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
};

let feedbackList = [];   // 生徒のフィードバック履歴（新→旧）
let feedback = null;     // 最新（＝現在の弱点）
let totalStars = 0;      // 累計スター（scoreの合計）
let schedule;            // 生徒のスケジュール（undefined=未取得, null=未設定）

async function loadFeedback(code){
  try{
    feedbackList = await db.getFeedbackList(code);
    feedback = feedbackList[0] || null;
    totalStars = feedbackList.reduce((s,f)=> s + (f.score||0), 0);
  }catch(e){ feedbackList=[]; feedback=null; totalStars=0; }
}

function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth()+1}/${d.getDate()}`;
}
function validWeakPoints(){
  const wp = (feedback && feedback.weak_points) || [];
  return wp.filter(w => GAME_META[w.game] && (!GAME_META[w.game].needsSlides || hasSlides(w.lesson)));
}

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
  const wp        = validWeakPoints();
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
        h('div',{class:'fb-date'}, fmtDate(feedback.created_at))),
      h('div',{class:'fb-score-line'}, `今日の評価 ${feedback.score!=null?feedback.score:'-'} / 10`),
      feedback.note ? h('div',{class:'fb-note'}, '「'+feedback.note+'」') : ''
    ));
  }

  if(wp.length){
    children.push(h('div',{class:'section-label'},'今日の10問'));
    children.push(h('button',{class:'daily-cta'+(doneToday?' done':''),onClick:dailyDrill},
      h('div',{class:'daily-cta-ico'}, doneToday?'✅':'🔥'),
      h('div',{class:'daily-cta-txt'},
        h('div',{class:'daily-cta-title'}, doneToday?'今日は完了！えらい！':'今日の10問にチャレンジ'),
        h('div',{class:'daily-cta-sub'}, doneToday?'また明日、炎を絶やさずに 🔥':'苦手をまとめて10問。炎をキープ')),
      h('div',{class:'daily-cta-go'}, doneToday?'もう一回':'START')
    ));
    children.push(h('div',{class:'section-label'},'あなたの弱点'));
    wp.forEach(w=>{
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

function weeklyView(sch){
  const days = ['月','火','水','木','金','土','日'];
  const byDay = Array.from({length:7}, ()=>[]);
  if(sch.jp && sch.jp.day!=null && sch.jp.day!=='')      byDay[sch.jp.day].push({type:'jp',label:'日本人',time:sch.jp.time});
  if(sch.native && sch.native.day!=null && sch.native.day!=='') byDay[sch.native.day].push({type:'native',label:'ネイティブ',time:sch.native.time});
  const cols = byDay.map((lessons,i)=>h('div',{class:'wk-col'},
    h('div',{class:'wk-day'+(i>=5?' wknd':'')}, days[i]),
    h('div',{class:'wk-slots'},
      ...(lessons.length
        ? lessons.map(l=>h('div',{class:'wk-lesson '+l.type},
            h('div',{class:'wk-type'}, l.label),
            l.time ? h('div',{class:'wk-time'}, l.time) : ''))
        : [h('div',{class:'wk-empty'})])
    )
  ));
  return h('div',{class:'card wk-card'}, h('div',{class:'wk-grid'}, ...cols));
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
  const wp = validWeakPoints();
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
function feedbackForm(student){
  let score = null;
  const weak = [];   // [{lesson, game}]

  const scoreRow = h('div',{class:'score-row'});
  for(let i=1;i<=10;i++){
    const b = h('button',{class:'score-btn',onClick:()=>{
      score=i; [...scoreRow.children].forEach(c=>c.classList.remove('on')); b.classList.add('on');
    }}, String(i));
    scoreRow.append(b);
  }

  const lessonSel = h('select',{class:'auth-input select'}, ...LESSONS.map(L=>h('option',{value:L.no}, `L${L.no} ${L.title}`)));
  const gameSel   = h('select',{class:'auth-input select'}, ...Object.entries(GAME_META).map(([id,m])=>h('option',{value:id}, m.label)));
  const chips = h('div',{class:'chips'});
  function renderChips(){
    chips.innerHTML='';
    if(!weak.length){ chips.append(h('div',{class:'sub'},'まだ弱点なし')); return; }
    weak.forEach((w,idx)=>{
      const m=GAME_META[w.game];
      chips.append(h('div',{class:'chip'}, `${m.ico} L${w.lesson} × ${m.label} `,
        h('span',{class:'chip-x',onClick:()=>{ weak.splice(idx,1); renderChips(); }},'×')));
    });
  }
  renderChips();
  const addWp = h('button',{class:'btn ghost',style:'margin-top:8px',onClick:()=>{
    const w = { lesson:Number(lessonSel.value), game:gameSel.value };
    if(!weak.some(x=>x.lesson===w.lesson && x.game===w.game)){ weak.push(w); renderChips(); }
  }}, '＋ この弱点を追加');

  const note = h('textarea',{class:'auth-input',rows:'2',placeholder:'コメント（任意）',style:'resize:vertical'});
  const msg  = h('div',{class:'auth-msg'});
  const save = h('button',{class:'btn',style:'margin-top:12px',onClick:doSave}, 'この評価を保存');
  async function doSave(){
    if(score==null){ msg.className='auth-msg ng'; msg.textContent='スコア（1〜10）を選んでね'; return; }
    save.disabled=true; msg.className='auth-msg'; msg.textContent='保存中…';
    try{
      await db.saveFeedback(student.code, { score, note:note.value.trim(), weakPoints:weak });
      teacherScreen();
    }catch(e){ msg.className='auth-msg ng'; msg.textContent='保存に失敗しました'; save.disabled=false; }
  }

  mount(app,
    topbarSimple(student.name+' の評価', teacherScreen),
    h('div',{class:'wrap'},
      h('button',{class:'btn ghost',style:'margin-bottom:14px',onClick:()=>scheduleForm(student)}, '📅 スケジュールを設定'),
      h('div',{class:'auth-card card'},
        h('div',{class:'auth-title'},'今日の総合評価（1〜10）'),
        h('p',{class:'sub',style:'text-align:center;margin:-4px 0 8px'},'その子のレベル基準で相対評価'),
        scoreRow),
      h('div',{class:'auth-card card',style:'margin-top:12px'},
        h('div',{class:'auth-title'},'弱点を指定（レッスン × スキル）'),
        h('div',{class:'wp-selects'}, lessonSel, gameSel),
        addWp, chips),
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
  const daySel = (cur)=> h('select',{class:'auth-input select'},
    h('option',{value:''},'曜日'),
    ...days.map((d,i)=>{ const o=h('option',{value:i}, d+'曜'); if(cur===i) o.selected=true; return o; }));
  const jpDay = daySel(sch.jp && sch.jp.day),   jpTime = h('input',{class:'auth-input',placeholder:'例: 17:00-18:00',value:(sch.jp&&sch.jp.time)||''});
  const nvDay = daySel(sch.native && sch.native.day), nvTime = h('input',{class:'auth-input',placeholder:'例: 18:00-19:00',value:(sch.native&&sch.native.time)||''});
  const msg = h('div',{class:'auth-msg'});
  const save = h('button',{class:'btn',style:'margin-top:12px',onClick:doSave}, 'スケジュールを保存');
  async function doSave(){
    const data = {
      term_start: startI.value || null,
      term_end:   endI.value || null,
      jp:     jpDay.value!=='' ? { day:Number(jpDay.value), time:jpTime.value.trim() } : null,
      native: nvDay.value!=='' ? { day:Number(nvDay.value), time:nvTime.value.trim() } : null,
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
        h('div',{class:'wp-selects'}, jpDay, jpTime)),
      h('div',{class:'auth-card card',style:'margin-top:12px'},
        h('div',{class:'auth-title'},'ネイティブ講師の枠'),
        h('div',{class:'wp-selects'}, nvDay, nvTime)),
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
