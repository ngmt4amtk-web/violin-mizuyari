// 効果音（本人 2026-11-04「終わった時に、効果音欲しいか。マナーモードでもなる感じで」）。
// 録音した音は使わず、その場で音を作る。鳴らすのは、マイクで使っている AudioContext（無ければ新しく作る）。
// マナーモード（iPhone の消音スイッチ）でも鳴るように、Safari の audioSession を play-and-record にする
// （この形では消音スイッチで消えない。マイクを始める前に呼ぶ）。iPhone の実機では確かめていない。
(function (root) {
  'use strict';
  function prepare() {
    try { if (root.navigator && root.navigator.audioSession) root.navigator.audioSession.type = 'play-and-record'; } catch (e) { /* 使えないブラウザでは何もしない */ }
  }
  var own = null;
  function ctxOf(ctx) {
    if (ctx && ctx.state !== 'closed') return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    if (!own || own.state === 'closed') own = new AC();
    return own;
  }
  var outs = [];   // 鳴っている効果音の出口（stop で止める）
  function out(c) {
    var comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    var g = c.createGain(); g.gain.value = 0.9;
    comp.connect(g); g.connect(c.destination);
    outs.push({ c: c, g: g });
    if (outs.length > 8) outs.shift();
    return comp;
  }
  // 鳴っている効果音をすぐ止める（「もういちど」の時。残った音をマイクが拾って次の回に数えないように）
  function stop() {
    outs.forEach(function (o) {
      try { o.g.gain.cancelScheduledValues(0); o.g.gain.setValueAtTime(0, o.c.currentTime); o.g.disconnect(); } catch (e) { /* 無視 */ }
    });
    outs = [];
  }
  // 1つの音: 三角波＋サイン波（1オクターブ上を少し）に、すぐ立ち上がって減っていく包絡
  function tone(c, dest, f, t, dur, vol, type) {
    var o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    o1.type = type || 'triangle'; o1.frequency.value = f;
    o2.type = 'sine'; o2.frequency.value = f * 2;
    var g2 = c.createGain(); g2.gain.value = 0.25;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vol * 0.5, t + Math.min(0.12, dur * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
  }
  function sparkle(c, dest, t, n, vol) {
    for (var i = 0; i < n; i++) tone(c, dest, 2093 * Math.pow(2, ((i * 5) % 12) / 12), t + i * 0.055, 0.12, vol, 'sine');
  }
  var N = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, E6: 1318.5, G6: 1568, C7: 2093, G4: 392, C4: 261.63, E4: 329.63 };
  // kind: 'seed'（タネ1つ咲いた・小さく短く）| 'bloom'（咲いた・おしまい）| 'record'（さいこう きろく・大きく長く）
  function play(kind, ctx) {
    var c = ctxOf(ctx); if (!c) return;
    try { if (c.state !== 'running') c.resume(); } catch (e) { /* 無視 */ }
    var d = out(c), t = c.currentTime + 0.03;
    if (kind === 'seed') {
      // 短い音だけ（マイクが拾っても、伸ばしている音として数えられない長さ）
      tone(c, d, N.G5, t, 0.11, 0.22); tone(c, d, N.C6, t + 0.08, 0.11, 0.22); tone(c, d, N.E6, t + 0.16, 0.16, 0.2);
      return;
    }
    if (kind === 'record') {
      var seq = [N.C5, N.E5, N.G5, N.C6, N.E5, N.G5, N.C6, N.E6];
      for (var i = 0; i < seq.length; i++) tone(c, d, seq[i], t + i * 0.09, 0.18, 0.3);
      var t2 = t + seq.length * 0.09 + 0.04;
      [N.C5, N.E5, N.G5, N.C6].forEach(function (f) { tone(c, d, f, t2, 1.4, 0.2); });
      tone(c, d, N.C4, t2, 1.4, 0.22, 'sine');
      sparkle(c, d, t2 + 0.1, 10, 0.08);
      return;
    }
    // bloom
    [N.C5, N.E5, N.G5].forEach(function (f, i) { tone(c, d, f, t + i * 0.1, 0.2, 0.3); });
    var t3 = t + 0.32;
    [N.C5, N.E5, N.G5, N.C6].forEach(function (f) { tone(c, d, f, t3, 1.0, 0.2); });
    tone(c, d, N.C4, t3, 1.0, 0.2, 'sine');
    sparkle(c, d, t3 + 0.08, 6, 0.07);
  }
  root.Sfx = { prepare: prepare, play: play, stop: stop };
})(typeof window !== 'undefined' ? window : globalThis);
