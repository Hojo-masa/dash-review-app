// ===== 日本語ヒントゲート =====
// 日本語は「タダ」では見せない。授業で習った英語 "How do I say ~ in Japanese?" を
// 自分でタイプできた時だけアンロックされる。＝ヒントを見る行為をアウトプット練習に変える。
import { h, speak } from './ui.js';

// 受理する聞き方（正規化後）。授業フレーズを軸に、自然な揺れも許容。
function accepts(raw){
  const n = raw.toLowerCase().replace(/[.,!?"'`’“”]/g,'').replace(/\s+/g,' ').trim();
  const asks = /(how do (i|you) say)|(what('| i)s .* in japanese)|(how (can|would) (i|you) say)/.test(n);
  const jp   = /in japanese|japanese\??$/.test(n) || /japanese/.test(n);
  return asks && jp;
}

/**
 * createHintGate(japanese, opts)
 *  japanese : アンロック時に見せる日本語（無ければ '' で「準備中」表示）
 *  opts.label : 折りたたみ時のボタン文言
 * returns: DOM element
 */
export function createHintGate(japanese, opts={}){
  const label = opts.label || '意味が知りたい？';
  const wrap = h('div',{class:'hint-gate'});

  // --- 折りたたみ状態 ---
  const collapsed = h('button',{class:'hint-gate-open',onClick:expand},
    '🔒 ', label);
  wrap.append(collapsed);

  function expand(){
    wrap.innerHTML = '';
    let tries = 0;
    const input = h('input',{class:'hint-input',type:'text',
      placeholder:'How do I say ... ?', autocomplete:'off',
      autocapitalize:'off', spellcheck:'false'});
    const msg = h('div',{class:'hint-msg'});
    const scaffold = h('div',{class:'hint-scaffold',style:'display:none'});

    const ask = h('button',{class:'btn',style:'margin-top:10px',onClick:submit}, '英語で聞く');
    input.addEventListener('keydown', e=>{ if(e.key==='Enter') submit(); });

    const card = h('div',{class:'hint-card'},
      h('div',{class:'hint-title'}, '英語で聞けたら教えるよ 🗣️'),
      h('div',{class:'hint-sub'}, '授業で習った言い方、覚えてる？'),
      input, msg, scaffold, ask
    );
    wrap.append(card);
    setTimeout(()=>input.focus(), 50);

    function submit(){
      const v = input.value.trim();
      if(!v) return;
      if(accepts(v)){ unlock(v); return; }
      tries++;
      msg.className = 'hint-msg ng';
      msg.textContent = tries === 1
        ? 'うーん、その聞き方だと伝わらないかも。もう一回！'
        : 'おしい！「〜って日本語でなんて言う？」を英語で。';
      input.classList.add('shake');
      setTimeout(()=>input.classList.remove('shake'), 400);
      if(tries >= 3){                     // 3回で型をチラ見せ（学びに変える）
        scaffold.style.display = 'block';
        scaffold.innerHTML = 'ヒント：<b>How do I say ___ in Japanese?</b>';
      }
    }

    function unlock(saidText){
      speak(saidText);                    // 言えた英語を読み上げてあげる
      wrap.innerHTML = '';
      wrap.append(
        h('div',{class:'hint-card unlocked'},
          h('div',{class:'hint-said'}, '✅ ', h('i',{}, saidText)),
          japanese
            ? h('div',{class:'hint-reveal'}, '→ 日本語では ', h('b',{}, japanese))
            : h('div',{class:'hint-reveal muted'}, '（この文の日本語はまだ準備中です）')
        )
      );
    }
  }

  return wrap;
}
