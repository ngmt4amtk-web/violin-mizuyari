// レベル2「ゆびのタネ」の音の高さ → タネの決め方。yubi.html にも同じ中身を埋め込む。
// 候補は4本の弦すべての 0〜4 の指（1ポジション）。いちばん近い候補が、選んだ弦の音ならそのタネ。
// 判定の考え方は「ゆびいろ」に合わせる（いちばん近い候補で決め、半音ずれは外れにする）。
(function (root) {
  'use strict';

  // 開放弦の高さ（MIDI番号）と色。色は教室の決まり（G青・Dオレンジ・A赤・E緑）
  var STRINGS = {
    G: { midi: 55, name: 'ソ', color: '#1F5FD1' },
    D: { midi: 62, name: 'レ', color: '#EE8A00' },
    A: { midi: 69, name: 'ラ', color: '#CC1030' },
    E: { midi: 76, name: 'ミ', color: '#138A3A' }
  };
  var ORDER = ['G', 'D', 'A', 'E'];

  // 指ごとの、開放弦からの半音の数。2の指だけ高い（+4）と低い（+3）を選べる
  function fingerSteps(high2) { return [0, 2, high2 ? 4 : 3, 5, 7]; }

  var PC = ['ド', 'ド♯', 'レ', 'レ♯', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ソ♯', 'ラ', 'ラ♯', 'シ'];
  function noteName(midi) { return PC[((midi % 12) + 12) % 12]; }

  // opts = {string:'A', high2:{G:true,D:true,A:true,E:true}, tolCents:90, a4:442}
  function make(opts) {
    var chosen = opts.string;
    var tol = opts.tolCents || 90;
    var a4 = opts.a4 || 442;
    var high2 = opts.high2 || {};
    // 同じ高さが2つの弦にある時（ラ線の4＝ミ線の0 など）は、選んだ弦の方をとる
    // ほかの弦どうしで重なる時は、指の少ない方（開放弦）の名前で呼ぶ（ゆびいろと同じ）
    var cand = [], seen = {};
    function add(s, f) {
      var m = STRINGS[s].midi + fingerSteps(high2[s] !== false)[f];
      if (seen[m]) return;
      seen[m] = true;
      cand.push({ str: s, finger: f, midi: m });
    }
    for (var f0 = 0; f0 < 5; f0++) add(chosen, f0);
    for (var f1 = 0; f1 < 5; f1++) {
      for (var i = 0; i < ORDER.length; i++) if (ORDER[i] !== chosen) add(ORDER[i], f1);
    }

    var fn = function (hz) {
      if (!(hz > 0)) return { key: null, heard: null };
      var mf = 69 + 12 * Math.log2(hz / a4);
      var best = null, bestD = 1e9;
      for (var j = 0; j < cand.length; j++) {
        var d = (mf - cand[j].midi) * 100;
        if (Math.abs(d) < Math.abs(bestD)) { bestD = d; best = cand[j]; }
      }
      if (!best || Math.abs(bestD) > tol) return { key: null, heard: { off: true, cents: best ? bestD : 0 } };
      var heard = { str: best.str, finger: best.finger, midi: best.midi, cents: bestD };
      return { key: best.str === chosen ? best.finger : null, heard: heard };
    };
    fn.targets = cand.filter(function (c) { return c.str === chosen; })
                     .sort(function (a, b) { return a.finger - b.finger; });
    return fn;
  }

  var api = { STRINGS: STRINGS, ORDER: ORDER, fingerSteps: fingerSteps, noteName: noteName, make: make };
  root.Tane = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
