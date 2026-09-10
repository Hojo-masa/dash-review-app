// ===== Shared game engine helpers =====
import { DATA } from './data.js';

export const LESSONS = DATA.lessons;

export function lessonByNo(no){ return LESSONS.find(l => l.no === Number(no)); }

// Fisher–Yates
export function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
export function sample(arr, n){ return shuffle(arr).slice(0, n); }
export function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// All completed practice sentences of a lesson (pattern + slot word => full)
export function practiceItems(lesson){
  const items = [];
  (lesson.blocks || []).forEach(b => {
    (b.words || []).forEach(w => {
      const full = b.pattern.replace('___', w);
      items.push({ pattern: b.pattern, slot: b.slot, word: w, full, blockId: b.id });
    });
  });
  return items;
}

// Intro (target) phrases with notes
export function introItems(lesson){
  return (lesson.intros || []).map(i => ({
    full: i.phrase, note_en: i.note_en, note_ja: i.note_ja
  }));
}

// Every reviewable sentence in a lesson (for arrange / listening / flashcards)
export function allSentences(lesson){
  const s = [];
  introItems(lesson).forEach(i => s.push({ full: i.full, note_ja: i.note_ja||'', note_en: i.note_en||'' }));
  practiceItems(lesson).forEach(p => s.push({ full: p.full, note_ja:'', note_en:'' }));
  (lesson.review || []).forEach(r => s.push({ full: r, note_ja:'', note_en:'' }));
  // de-dup by text
  const seen = new Set(); const out = [];
  for(const x of s){ if(!seen.has(x.full)){ seen.add(x.full); out.push(x); } }
  return out;
}

// tokenise a sentence into draggable chunks (words, keep punctuation attached)
export function tokenize(sentence){
  return sentence.trim().split(/\s+/);
}

// normalise for answer comparison (speech / typing)
export function normalize(str){
  return str.toLowerCase()
    .replace(/[.,!?"'`’“”]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}
