// ===== tiny DOM helpers =====
export function h(tag, props, ...kids){
  const e = document.createElement(tag);
  if(props){
    for(const k in props){
      if(k === 'class') e.className = props[k];
      else if(k === 'html') e.innerHTML = props[k];
      else if(k.startsWith('on') && typeof props[k] === 'function')
        e.addEventListener(k.slice(2).toLowerCase(), props[k]);
      else if(props[k] != null) e.setAttribute(k, props[k]);
    }
  }
  for(const kid of kids.flat()){
    if(kid == null || kid === false) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return e;
}
export function clear(node){ while(node.firstChild) node.removeChild(node.firstChild); }
export function mount(node, ...kids){ clear(node); kids.flat().forEach(k => k && node.append(k)); }

// progress bar + counter used by every game
export function progressHeader(done, total){
  const bar = h('div',{class:'progressbar'}, h('i',{style:`width:${Math.round(done/total*100)}%`}));
  const cnt = h('div',{class:'qcount'}, `${done} / ${total}`);
  return [bar, cnt];
}

// shared bottom feedback + continue button. onNext called when button pressed.
export function feedback(ok, answerText, onNext){
  const bar = h('div',{class:'feedback '+(ok?'ok':'ng')},
    h('div',{class:'fb-ico'}, ok ? '🎉' : '💡'),
    h('div',{class:'fb-txt'},
      h('div',{class:'fb-title'}, ok ? 'ナイス！' : '正解はこちら'),
      h('div',{class:'fb-sub'}, answerText)
    )
  );
  const btn = h('button',{class:'btn '+(ok?'':'accent'),style:'margin-top:12px',onClick:onNext}, '次へ →');
  return [bar, btn];
}

// ---- speech recognition (発音チェック / 絵を見て言う) ----
export function canRecognize(){
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
export function recognizeOnce(){
  return new Promise((resolve, reject)=>{
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){ reject('unsupported'); return; }
    const r = new SR();
    r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 3;
    let got = false;
    r.onresult = e => { got = true; resolve([...e.results[0]].map(a=>a.transcript)); };
    r.onerror = e => reject(e.error || 'error');
    r.onend = () => { if(!got) reject('nomatch'); };
    try{ r.start(); }catch(e){ reject('start'); }
  });
}

// speak using browser TTS (used by listening & feedback)
export function speak(text, rate=0.95){
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = rate;
    const v = speechSynthesis.getVoices().find(v=>/en[-_]US/i.test(v.lang));
    if(v) u.voice = v;
    speechSynthesis.speak(u);
  }catch(e){ /* no-op */ }
}
