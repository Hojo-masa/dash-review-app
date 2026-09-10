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

// ---------- HOME ----------
function home(){
  const done = progress.doneCount();
  const goal = progress.weeklyGoal();
  const weekXP = progress.weekXP();

  const lessons = LESSONS.map(L => {
    const isReview = L.kind === 'review';
    const completed = progress.lessonCompleted(L.no);
    return h('div',{class:'lesson'+(isReview?' review':''),onClick:()=>lessonMenu(L.no)},
      h('div',{class:'num'}, isReview ? '★' : String(L.no)),
      h('div',{class:'body'},
        h('div',{class:'title'}, `${L.title}`),
        h('div',{class:'theme'}, L.theme || (isReview?'これまでの総復習':''))
      ),
      completed ? h('div',{class:'badge'},'済') : h('div',{class:'progress-dot'+(progress.lessonStarted(L.no)?' done':'')}),
      h('div',{class:'chev'},'›')
    );
  });

  mount(app,
    topbar(null),
    h('div',{class:'wrap'},
      h('div',{class:'hero'},
        h('div',{class:'hero-brand'},
          h('span',{class:'hero-dash'}, APP_NAME),
          h('span',{class:'hero-tag'}, '〜復習を駆け抜ける〜')
        ),
        h('h2',{}, `おかえり${progress.userName() ? '、'+progress.userName() : ''}！今週もはじめよう 💨`),
        h('p',{}, '日常会話スタートプラン'),
        h('div',{class:'streak-row'},
          h('div',{class:'stat tappable',onClick:streakScreen}, h('b',{}, '🔥'+progress.dailyStreak()), h('small',{},'連続日')),
          h('div',{class:'stat'}, h('b',{}, `${weekXP}`), h('small',{},'今週のXP')),
          h('div',{class:'stat'}, h('b',{}, `${done}/${LESSONS.length}`), h('small',{},'レッスン'))
        ),
        h('div',{style:'margin-top:14px'},
          h('div',{class:'progressbar',style:'background:rgba(255,255,255,.25)'},
            h('i',{style:`width:${Math.min(100,Math.round(weekXP/goal*100))}%;background:#fff`})),
          h('small',{style:'opacity:.9'}, `今週の目標まで あと ${Math.max(0,goal-weekXP)} XP`)
        )
      ),
      h('div',{class:'section-label'},'レッスン'),
      ...lessons,
      progress.currentUser()
        ? h('button',{class:'logout-link',onClick:doLogout}, 'ログアウト')
        : ''
    )
  );
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
        listBox.append(h('div',{class:'teacher-row'},
          h('div',{class:'tr-main'}, h('b',{}, r.name), h('span',{class:'tr-code'}, r.code)),
          h('div',{class:'tr-streak'}, '🔥 '+streak)
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
      listBox
    )
  );
  refresh();
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
        home(); return;
      }
    }catch(e){ /* fall through to login */ }
  }
  loginScreen();
}
boot();
