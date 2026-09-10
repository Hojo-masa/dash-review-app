// ===== 絵を見て言う (picture → say it) — 授業と同じ活動 =====
import { SLIDES } from '../slides.js';
import { sample, normalize } from '../engine.js';
import { h, mount, progressHeader, feedback, speak, canRecognize, recognizeOnce } from '../ui.js';
import { createHintGate } from '../hintGate.js';

const MAX_Q = 6;

export function play(lesson, root, onFinish){
  const pool = SLIDES.filter(s => s.lesson === lesson.no);
  if(pool.length < 1){
    mount(root, h('div',{class:'empty'}, 'このレッスンには絵の問題がまだありません。'));
    return;
  }
  // de-dup images so the same picture doesn't repeat too much in one round
  const seen = new Set(); const uniq = [];
  for(const s of pool){ if(!seen.has(s.full)){ seen.add(s.full); uniq.push(s); } }
  const questions = sample(uniq, Math.min(MAX_Q, uniq.length));

  let idx = 0, score = 0;
  const useMic = canRecognize();
  render();

  function render(){
    const q = questions[idx];
    const hint = q.pattern && q.pattern.includes('___')
      ? h('div',{class:'cue-hint'}, 'この形で言ってみよう：', h('b',{}, q.pattern))
      : h('div',{class:'cue-hint'}, '絵を見て英語で言ってみよう');

    const status = h('div',{class:'mic-status'}, '');
    const micBtn = useMic
      ? h('button',{class:'mic-btn',onClick:()=>listen(status,micBtn)}, '🎤')
      : null;
    const revealBtn = h('button',{class:'btn ghost',style:'margin-top:12px',
      onClick:()=>reveal(null)}, useMic ? '答えを見る（自分で判定）' : '答えを見る');

    mount(root, h('div',{class:'play'},
      ...progressHeader(idx, questions.length),
      h('div',{class:'cue-wrap'}, h('img',{class:'cue-img',src:q.img,alt:''})),
      hint,
      useMic ? h('div',{style:'text-align:center'}, micBtn, status) : status,
      revealBtn,
      createHintGate(q.ja)
    ));
  }

  async function listen(status, micBtn){
    const q = questions[idx];
    status.textContent = '🎙️ 聞いてるよ…話してね';
    micBtn.classList.add('listening');
    try{
      const alts = await recognizeOnce();
      micBtn.classList.remove('listening');
      const target = normalize(q.full);
      const ok = alts.some(a => {
        const t = normalize(a);
        return t === target || t.includes(target) || target.includes(t);
      });
      status.textContent = '';
      finish(ok, `あなた: 「${alts[0]}」`);
    }catch(err){
      micBtn.classList.remove('listening');
      status.textContent = (err==='not-allowed'||err==='service-not-allowed')
        ? '⚠️ マイクの許可が必要です' : 'うまく聞き取れなかった…もう一度どうぞ';
    }
  }

  function reveal(){ finish(null, null); }  // self-check mode

  // ok=true/false auto-judged, or ok=null => self-check
  function finish(ok, sub){
    const q = questions[idx];
    speak(q.full);
    const play = root.querySelector('.play');
    play.querySelectorAll('.mic-btn,.btn.ghost,.mic-status,.cue-hint,.hint-gate').forEach(el=>el.remove());
    // 英語のみ表示。日本語は「英語で聞く」ゲート経由でしか出さない（ズル防止）
    const ansCard = h('div',{class:'answer-reveal'}, h('div',{class:'answer-en'}, q.full));
    play.append(ansCard);

    if(ok === null){
      // self grade
      play.append(h('div',{class:'selfcheck'},
        h('button',{class:'btn',onClick:()=>{score++;next();}}, '言えた ⭕'),
        h('button',{class:'btn ghost',onClick:next}, 'まだ 🔁')
      ));
    }else{
      if(ok) score++;
      feedback(ok, sub || q.full, next).forEach(el => play.append(el));
    }
  }

  function next(){
    idx++;
    if(idx >= questions.length) onFinish(score, questions.length);
    else render();
  }
}
