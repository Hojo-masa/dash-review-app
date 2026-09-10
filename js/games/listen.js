// ===== リスニング (listen & choose) — cue = audio, so the answer is determinate =====
import { allSentences, shuffle, sample, normalize } from '../engine.js';
import { h, mount, progressHeader, feedback, speak } from '../ui.js';

const MAX_Q = 8;

export function play(lesson, root, onFinish){
  // sentences that are pronounceable & distinct enough (2–10 words)
  const pool = allSentences(lesson).filter(s => {
    const n = s.full.trim().split(/\s+/).length;
    return n >= 2 && n <= 12;
  });
  if(pool.length < 4){
    mount(root, h('div',{class:'empty'}, 'このレッスンにはリスニング問題がありません。'));
    return;
  }
  const chosen = sample(pool, Math.min(MAX_Q, pool.length));
  const questions = chosen.map(t => {
    const others = pool.filter(x => normalize(x.full) !== normalize(t.full));
    const distractors = sample(others, 3).map(x => x.full);
    return { answer: t.full, choices: shuffle([t.full, ...distractors]) };
  });

  let idx = 0, score = 0;
  render();

  function render(){
    const q = questions[idx];
    const replay = h('button',{class:'hint-audio',title:'もう一度きく',onClick:()=>speak(q.answer)}, '🔊');
    const choicesBox = h('div',{class:'choices'});
    q.choices.forEach(c => {
      choicesBox.append(h('button',{class:'choice',onClick:e=>answer(e.currentTarget, c)}, c));
    });

    mount(root,
      h('div',{class:'play'},
        ...progressHeader(idx, questions.length),
        h('div',{class:'prompt-ja',style:'text-align:center'}, '聞こえた英文はどれ？'),
        h('div',{style:'margin:26px 0 30px'}, replay),
        choicesBox
      )
    );
    setTimeout(()=>speak(q.answer), 350); // auto-play once
  }

  function answer(btn, choice){
    const q = questions[idx];
    const correct = normalize(choice) === normalize(q.answer);
    const box = btn.parentElement;
    [...box.children].forEach(c => {
      c.classList.add('disabled');
      if(normalize(c.textContent) === normalize(q.answer)) c.classList.add('correct');
    });
    if(!correct) btn.classList.add('wrong');
    if(correct) score++;

    const play = root.querySelector('.play');
    feedback(correct, q.answer, next).forEach(el => play.append(el));
  }

  function next(){
    idx++;
    if(idx >= questions.length) onFinish(score, questions.length);
    else render();
  }
}
