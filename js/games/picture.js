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
      finish(ok, alts[0]);
    }catch(err){
      micBtn.classList.remove('listening');
      status.textContent = (err==='not-allowed'||err==='service-not-allowed')
        ? '⚠️ マイクの許可が必要です' : 'うまく聞き取れなかった…もう一度どうぞ';
    }
  }

  function reveal(){ finish(null, null); }  // self-check mode

  // ok=true/false auto-judged (transcript=聞き取った文), or ok=null => self-check
  function finish(ok, transcript){
    const q = questions[idx];
    speak(q.full);
    const play = root.querySelector('.play');
    play.querySelectorAll('.mic-btn,.btn.ghost,.mic-status,.cue-hint,.hint-gate').forEach(el=>el.remove());

    if(ok === null){
      // 自己採点：正解例（ニュートラル）＋言えた/まだ
      play.append(h('div',{class:'answer-reveal neutral'},
        h('div',{class:'reveal-label'}, '正解例'),
        h('div',{class:'answer-en'}, q.full)));
      play.append(h('div',{class:'selfcheck'},
        h('button',{class:'btn',onClick:()=>{score++;next();}}, '言えた ⭕'),
        h('button',{class:'btn ghost',onClick:next}, 'まだ 🔁')));
      return;
    }

    if(ok){ score++; celebrate(q); return; }   // 正解＝全画面ばーん

    // 失敗：あなたの回答を上に赤で
    play.append(h('div',{class:'said-wrong'},
      h('div',{class:'reveal-label bad'}, '🗣️ あなたの回答'),
      h('div',{class:'said-en'}, transcript || '（聞き取れませんでした）')));
    // 正解例を下に
    play.append(h('div',{class:'answer-reveal ok'},
      h('div',{class:'reveal-label good'}, '✅ 正解例'),
      h('div',{class:'answer-en'}, q.full)));
    play.append(h('button',{class:'btn accent',style:'margin-top:14px',onClick:next}, '次へ →'));
  }

  // 全画面のお祝い演出（正解時）
  function celebrate(q){
    const words  = ['ナイス！','最高！','いいね！','完璧！','その調子！','やるね！'];
    const emojis = ['🎉','💯','🔥','⭐','🙌','✨'];
    const confetti = h('div',{class:'confetti'});
    for(let i=0;i<14;i++){
      const ang = Math.random()*Math.PI*2, dist = 120 + Math.random()*170;
      const tx = Math.cos(ang)*dist, ty = Math.sin(ang)*dist - 40;
      confetti.append(h('span',{
        style:`--tx:${tx.toFixed(0)}px;--ty:${ty.toFixed(0)}px;--r:${(Math.random()*720-360)|0}deg;animation-delay:${(Math.random()*0.15).toFixed(2)}s`
      }, emojis[i % emojis.length]));
    }
    root.append(h('div',{class:'celebrate'},
      confetti,
      h('div',{class:'celebrate-burst'}, emojis[Math.floor(Math.random()*emojis.length)]),
      h('div',{class:'celebrate-word'}, words[Math.floor(Math.random()*words.length)]),
      h('div',{class:'celebrate-en'}, q.full),
      h('button',{class:'btn celebrate-next',onClick:next}, '次へ →')
    ));
  }

  function next(){
    idx++;
    if(idx >= questions.length) onFinish(score, questions.length);
    else render();
  }
}
