// レベル2「ゆびのタネ」の試験。node 試験/test2.js
const path = require('path');
const D = require(path.resolve(__dirname, '../detector.js'));
const Tane = require(path.resolve(__dirname, '../tane.js'));
const { render } = require('./synth.js');
const sr = 48000, A4 = 442;
const hz = (m, c = 0) => A4 * Math.pow(2, (m - 69 + c / 100) / 12);
const ALLHIGH = { G: true, D: true, A: true, E: true };

function run(name, segs, expect, o = {}) {
  const x = render(segs, sr);
  const d = new D(sr, { bloomSec: o.bloomSec || 15 });
  d.setClassifier(Tane.make({ string: o.string || 'A', high2: o.high2 || ALLHIGH, tolCents: o.tol || 90, a4: A4 }));
  const heard = {};
  for (let i = 0; i < x.length; i += 1024) {
    d.feed(x.subarray(i, i + 1024));
    if (d.heard && d.heard.str) heard[d.heard.str + d.heard.finger] = 1;
  }
  const by = {}; for (const k in d.totalBy) by[k] = +d.totalBy[k].toFixed(2);
  const ev = d.takeEvents().filter(e => e.type === 'bloom').map(e => e.key);
  const res = { waters: d.waters, by, blooms: ev, heard: Object.keys(heard).sort() };
  let ok = true;
  for (const [k, v] of Object.entries(expect)) {
    if (k === 'by') { for (const [kk, r] of Object.entries(v)) { const g = by[kk] || 0; if (g < r[0] || g > r[1]) ok = false; }
      for (const kk of Object.keys(by)) if (!(kk in v) && by[kk] > 0.05) ok = false; }
    else if (k === 'blooms') ok = ok && JSON.stringify(ev.slice().sort()) === JSON.stringify(v);
    else if (k === 'heardHas') ok = ok && v.every(h => res.heard.includes(h));
    else ok = ok && res[k] === v;
  }
  console.log((ok ? 'OK  ' : 'NG  ') + name.padEnd(40), JSON.stringify(res), ' 期待', JSON.stringify(expect));
  return ok;
}
const N = (dur, m, o = {}) => Object.assign({ dur, f: hz(m, o.c || 0) }, o), Z = dur => ({ dur });
let all = true; const T = (...a) => { all = run(...a) && all; };

// ラ線（A=69）: 0=ラ69 1=シ71 2=ド♯73 3=レ74 4=ミ76
T('A ラ線の0〜4を3秒ずつ', [69, 71, 73, 74, 76].map(m => [N(3, m), Z(0.4)]).flat(),
  { waters: 5, by: { 0: [2.8, 3.05], 1: [2.8, 3.05], 2: [2.8, 3.05], 3: [2.8, 3.05], 4: [2.8, 3.05] } });
T('B 1の指を16秒→1だけ咲く', [Z(0.3), N(16, 71), Z(1.5)], { waters: 1, blooms: [1], by: { 1: [15.8, 16.05] } });
T('C 5つとも16秒→5つ咲く', [69, 71, 73, 74, 76].map(m => [N(16, m), Z(0.4)]).flat().concat([Z(1.2)]),
  { waters: 5, blooms: [0, 1, 2, 3, 4] });
T('D となりのレ線の開放（ラ線を選択）', [Z(0.3), N(3, 62), Z(0.3)], { waters: 0, by: {}, heardHas: ['D0'] });
T('E ドのナチュラル（高い2の時は半音ずれ）', [Z(0.3), N(3, 72), Z(0.3)], { waters: 0, by: {} });
T('F 低い2の設定ならドは2', [Z(0.3), N(3, 72), Z(0.3)], { waters: 1, by: { 2: [2.8, 3.05] } }, { high2: { G: true, D: true, A: false, E: true } });
T('G 低い2の設定ではド♯は外れ', [Z(0.3), N(3, 73), Z(0.3)], { waters: 0, by: {} }, { high2: { G: true, D: true, A: false, E: true } });
T('H 0から1へ切らずに移る（2秒ずつ）', [Z(0.3), N(2, 69), N(2, 71), Z(0.4)], { waters: 2, by: { 0: [1.8, 2.05], 1: [1.7, 2.05] } });
T('I 0を0.6秒→1を0.6秒をくり返す（どれも1秒未満）', Array.from({ length: 8 }, (_, i) => N(0.6, i % 2 ? 71 : 69)), { waters: 0, by: {} });
T('J ビブラート±30セント', [Z(0.3), N(3, 74, { vibC: 30, amDb: 2 }), Z(0.3)], { waters: 1, by: { 3: [2.8, 3.05] } });
T('K 30セント高い', [Z(0.3), N(3, 73, { c: 30 }), Z(0.3)], { waters: 1, by: { 2: [2.8, 3.05] } });
T('L 60セント高いシ（ドに近い・外れ）', [Z(0.3), N(3, 71, { c: 60 }), Z(0.3)], { waters: 0, by: {} }, { tol: 40 });
T('M 1の指でトレモロ5秒', [Z(0.3), N(5, 71, { trem: { hz: 8, dipDb: 12, dipMs: 40, noise: 0.5 } }), Z(0.3)], { waters: 0, by: {} });
T('N ミ線を選んでラ線の4（ミ）を弾く→0', [Z(0.3), N(3, 76), Z(0.3)], { waters: 1, by: { 0: [2.8, 3.05] } }, { string: 'E' });
T('O ソ線 G3 の0と4（レ）', [Z(0.3), N(3, 55), Z(0.4), N(3, 62), Z(0.3)], { waters: 2, by: { 0: [2.8, 3.05], 4: [2.8, 3.05] } }, { string: 'G' });
T('P ミ線の4（シ5）', [Z(0.3), N(3, 83), Z(0.3)], { waters: 1, by: { 4: [2.8, 3.05] } }, { string: 'E' });
T('Q 440で調弦した楽器（-8セント）', [Z(0.3), { dur: 3, f: 440 }, Z(0.3)], { waters: 1, by: { 0: [2.8, 3.05] } });
T('R 15秒の手前でトレモロ（咲かない）', [Z(0.3), N(14.9, 69), N(3, 69, { trem: { hz: 8, dipDb: 12, dipMs: 40, noise: 0.5 } }), Z(1.5)], { blooms: [] });
console.log(all ? '全部OK' : 'NGあり');
