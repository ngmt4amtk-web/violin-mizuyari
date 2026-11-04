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

  // opts = {string:'A', high2:{G:true,D:true,A:true,E:true}, tolCents:90, a4:442, fingers:[0,1,2]（レベル2〜4だけ）}
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

    // レベル2〜4（opts.fingers に遊ぶ指の一覧）: 音程はかなりゆるく見る（本人 2026-11-04「音程はかなりゆるくて良い」）。
    // 選んだ弦の 0〜4 の指のうち、いちばん近い指で決める（ほかの弦の半音で狭めない）。tol より離れていれば外れ。
    // いちばん近い指が遊ぶ指なら、その指の一覧の中の番号（タネの番号）を key にする。遊ばない指なら「いまのは ◯」
    if (opts.fingers) {
      var act = opts.fingers.slice();
      var own = [];
      for (var f2 = 0; f2 < 5; f2++) own.push({ str: chosen, finger: f2, midi: STRINGS[chosen].midi + fingerSteps(high2[chosen] !== false)[f2] });
      var fnA = function (hz) {
        if (!(hz > 0)) return { key: null, heard: null };
        var mf = 69 + 12 * Math.log2(hz / a4);
        var bo = null, bd = 1e9;
        for (var j = 0; j < own.length; j++) {
          var d = (mf - own[j].midi) * 100;
          if (Math.abs(d) < Math.abs(bd)) { bd = d; bo = own[j]; }
        }
        if (bo && Math.abs(bd) <= tol) {
          var ki = act.indexOf(bo.finger);
          return { key: ki >= 0 ? ki : null, heard: { str: chosen, finger: bo.finger, midi: bo.midi, cents: bd } };
        }
        // 選んだ弦のどの指からも遠い: ほかの弦の音として名前を出す
        var bestO = null, bestOD = 1e9;
        for (var k = 0; k < cand.length; k++) {
          var d2 = (mf - cand[k].midi) * 100;
          if (Math.abs(d2) < Math.abs(bestOD)) { bestOD = d2; bestO = cand[k]; }
        }
        if (!bestO || Math.abs(bestOD) > 60 || bestO.str === chosen) return { key: null, heard: { off: true, cents: bd } };
        return { key: null, heard: { str: bestO.str, finger: bestO.finger, midi: bestO.midi, cents: bestOD } };
      };
      fnA.targets = act.map(function (f) { return own[f]; });
      return fnA;
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
