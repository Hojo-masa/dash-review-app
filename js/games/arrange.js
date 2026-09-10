// ===== 並べ替え (word arrange) =====
import { allSentences, tokenize, shuffle, sample, normalize } from '../engine.js';
import { h, mount, progressHeader, feedback, speak } from '../ui.js';

const MAX_Q = 6;

export function play(lesson, root, onFinish){
  // pick sentences that make good arrange puzzles (2–8 words)
  const pool = allSentences(lesson).filter(s => {
    const n = tokenize(s.full).length;
    return n >= 2 && n <= 8;
  });
  if(pool.length < 1){
    mount(root, h('div',{class:'empty'}, 'このレッスンには並べ替え問題がありません。'));
    return;
  }
  const questions = sample(pool, Math.min(MAX_Q, pool.length));

  let idx = 0, score = 0;
  render();

  function render(){
    const q = questions[idx];
    const tokens = tokenize(q.full);
    const answer = [];                       // indices placed, in order
    const bankOrder = shuffle(tokens.map((t,i)=>i));

    const answerZone = h('div',{class:'answer-zone'});
    const bank = h('div',{class:'bank'});
    const checkBtn = h('button',{class:'btn',disabled:'',style:'margin-top:14px'}, '答え合わせ');

    function draw(){
      answerZone.innerHTML=''; bank.innerHTML='';
      answer.forEach(i => {
        answerZone.append(h('div',{class:'token placed',onClick:()=>{
          answer.splice(answer.indexOf(i),1); draw();
        }}, tokens[i]));
      });
      bankOrder.forEach(i => {
        const used = answer.includes(i);
        bank.append(h('div',{class:'token'+(used?' ghost':''),onClick:()=>{
          if(!used){ answer.push(i); draw(); }
        }}, tokens[i]));
      });
      checkBtn.disabled = answer.length !== tokens.length;
    }
    draw();

    checkBtn.addEventListener('click', ()=>{
      const built = answer.map(i=>tokens[i]).join(' ');
      const ok = normalize(built) === normalize(q.full);
      if(ok) score++;
      speak(q.full);
      answerZone.querySelectorAll('.token').forEach(t=>{
        t.style.pointerEvents='none';
        t.classList.add(ok ? 'placed' : 'wrong');
      });
      checkBtn.remove();
      const play = root.querySelector('.play');
      feedback(ok, q.full, next).forEach(el => play.append(el));
    });

    mount(root,
      h('div',{class:'play'},
        ...progressHeader(idx, questions.length),
        h('div',{class:'prompt-ja'}, '正しい順に並べよう'),
        q.note_ja ? h('div',{class:'qnote',style:'margin:2px 0 0'}, q.note_ja) : '',
        answerZone,
        bank,
        checkBtn
      )
    );
  }

  function next(){
    idx++;
    if(idx >= questions.length) onFinish(score, questions.length);
    else render();
  }
}
