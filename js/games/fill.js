// ===== 絵で穴埋め (image cue + word choice) — 絵がヒントなので答えが決まる =====
import { SLIDES } from '../slides.js';
import { shuffle, sample, normalize } from '../engine.js';
import { h, mount, progressHeader, feedback, speak } from '../ui.js';
import { createHintGate } from '../hintGate.js';

const MAX_Q = 8;

export function play(lesson, root, onFinish){
  const pool = SLIDES.filter(s => s.lesson === lesson.no && s.word);
  if(pool.length < 4){
    mount(root, h('div',{class:'empty'}, 'このレッスンには絵の問題がまだありません。'));
    return;
  }
  const uniqWords = [...new Set(pool.map(s => s.word))];
  const chosen = sample(pool, Math.min(MAX_Q, pool.length));
  const questions = chosen.map(s => {
    const distractors = sample(uniqWords.filter(w => w !== s.word), 3);
    return { s, choices: shuffle([s.word, ...distractors]) };
  });

  let idx = 0, score = 0;
  render();

  function render(){
    const q = questions[idx];
    const parts = q.s.pattern.split('___');
    const img = h('img',{class:'cue-img',src:q.s.img,alt:''});
    const sentence = h('div',{class:'qtext small'},
      parts[0], h('span',{class:'blank'}, '____'), parts[1] || '');
    const choicesBox = h('div',{class:'choices'});
    q.choices.forEach(c => choicesBox.append(
      h('button',{class:'choice',onClick:e=>answer(e.currentTarget, c)}, c)));

    mount(root, h('div',{class:'play'},
      ...progressHeader(idx, questions.length),
      h('div',{class:'cue-wrap'}, img),
      sentence,
      choicesBox,
      createHintGate(q.s.ja)
    ));
  }

  function answer(btn, choice){
    const q = questions[idx];
    const ok = normalize(choice) === normalize(q.s.word);
    [...btn.parentElement.children].forEach(c => {
      c.classList.add('disabled');
      if(normalize(c.textContent) === normalize(q.s.word)) c.classList.add('correct');
    });
    if(!ok) btn.classList.add('wrong');
    if(ok) score++;
    speak(q.s.full);
    const play = root.querySelector('.play');
    feedback(ok, q.s.full, next).forEach(el => play.append(el));
  }

  function next(){
    idx++;
    if(idx >= questions.length) onFinish(score, questions.length);
    else render();
  }
}
