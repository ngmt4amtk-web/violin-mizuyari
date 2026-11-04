// 伸ばし音の判定（水やりゲームの核）。app.html にも同じ中身を埋め込む。
// マイクの生の波形を少しずつ受け取り、10ミリ秒ごとに「伸ばしている音か」を決める。
// 録音はしない。直近1秒ぶんの数値だけを手元に置き、古いものは捨てる。
(function (root) {
  'use strict';

  var DEFAULTS = {
    waterStartSec: 1.0,   // この秒数だけ伸びたら水が出る（本人の言葉: 1秒）
    bloomSec: 30,         // 合計でこの秒数伸ばしたら花が咲く（本人の言葉: 30秒）
    onDb: -45,            // これより大きい音を「鳴っている」とみなす（dBFS）
    tremoloDipDb: 6,      // 音量がこれだけ落ちて戻ったら「弓の返し」1回とみなす
    tremoloDips: 2,       // 0.7秒の中に返しがこの回数以上あればトレモロ
    tremoloWindowSec: 0.7,
    gapHoldSec: 0.15,     // 弓を返す一瞬の途切れはここまで許す
    minClarity: 0.6       // 音の高さがはっきりしている度合い（0〜1）。雑音や息を外す
  };

  var RANGES = {
    waterStartSec: [0.1, 10], bloomSec: [1, 3600], onDb: [-100, 0],
    tremoloDipDb: [1, 40], tremoloDips: [1, 20], tremoloWindowSec: [0.2, 2],
    gapHoldSec: [0, 1], minClarity: [0, 1]
  };

  function toDb(meanSq) { return meanSq > 1e-18 ? 10 * Math.log10(meanSq) : -120; }

  function Detector(sampleRate, opts) {
    this.sr = sampleRate;
    this.opt = {};
    for (var k in DEFAULTS) this.opt[k] = DEFAULTS[k];
    if (opts) this.setOptions(opts);
    this.blockLen = Math.round(sampleRate * 0.01);
    this.blockSec = this.blockLen / sampleRate;
    this.anaLen = 1024 * Math.max(1, Math.round(sampleRate / 48000));
    if (this.anaLen < 1024) this.anaLen = 1024;
    this.ring = new Float32Array(this.anaLen);
    this.ringPos = 0;
    this.blockBuf = new Float32Array(this.blockLen);
    this.blockFill = 0;
    this.blockIndex = 0;
    this.minLag = Math.floor(sampleRate / 3500);
    this.maxLag = Math.ceil(sampleRate / 180);
    this.classify = null;      // レベル2: 音の高さ → どのタネか（無ければレベル1の数え方）
    this.reset();
  }

  // レベル2で使う。fn(高さHz) が {key: タネの番号 か null, heard: 画面に出す聞こえ方} を返す。
  // 渡すと、秒数をタネごとに分けて数え、違う音に変わったら伸ばしを1秒からやり直す。
  Detector.prototype.setClassifier = function (fn) {
    this.classify = typeof fn === 'function' ? fn : null;
    this.noteHist = [];
    this.key = null;
    this.heard = null;
  };

  Detector.prototype.setOptions = function (o) {
    for (var k in o) {
      var v = Number(o[k]);
      if (k in DEFAULTS && isFinite(v)) this.opt[k] = v;
    }
    // 0や負の数などで止まったり壊れたりしないよう、値を範囲に収める
    var R = RANGES;
    for (var key in R) {
      var x = this.opt[key];
      if (x < R[key][0]) x = R[key][0];
      if (x > R[key][1]) x = R[key][1];
      this.opt[key] = x;
    }
    this.opt.tremoloDips = Math.round(this.opt.tremoloDips);
  };

  // 途中で音の処理が止まった時に呼ぶ。今の伸ばしは終わりにし、貯まった秒数と回数は残す。
  Detector.prototype.pause = function () {
    this._endStroke();
    this.state = 'idle';
    this.gateOpen = false;
    this.tremolo = false;
    this.dipTimes = [];
    this.pitchHist = [];
    this.vibrato = false;
    this.dipState = 'high';
    this.peak = -120;
    this.noteHist = [];
    this.key = null;
    this.heard = null;
  };

  Detector.prototype.reset = function () {
    this.now = 0;
    this.total = 0;            // 今の花に向けて貯まった秒数（確定分＋仮置き分。画面に出す値）
    this.committed = 0;        // 確定した秒数。花はこれで咲かせる
    this.blooms = 0;           // 咲かせた回数
    this.waters = 0;           // 水が出た回数
    this.stroke = 0;           // 今の伸ばしの秒数（鳴っている時間だけ数える）
    this.qualified = false;    // 今の伸ばしが水の秒数を越えたか
    this.gap = 0;
    this.gateOpen = false;
    this.env = -120;
    this.clarity = 0;
    this.pitch = 0;
    this.pitchCoarse = 0;
    this.tremolo = false;
    this.dipState = 'high';
    this.peak = -120;
    this.trough = 0;
    this.dipTimes = [];
    this.pitchHist = [];
    this.vibrato = false;
    this.lowSince = 0;
    this.accrual = [];         // 仮置きの [時刻, 秒数]。トレモロと分かったら取り消し、古くなったら確定する
    this.state = 'idle';       // idle | rising | watering | tremolo
    this.events = [];          // 'water' | 'bloom' | 'tremolo' を UI へ渡す（レベル2は {type, key}）
    // レベル2（タネごと）
    this.noteHist = [];        // 直近0.12秒の高さ。真ん中の値でタネを決める
    this.key = null;           // 今鳴っている音のタネ（どれでもなければ null）
    this.heard = null;         // 今の音がどう聞こえたか（画面の「いまのは〜」用）
    this.strokeKey = null;     // 今の伸ばしのタネ
    this.committedBy = {};     // タネごとの確定した秒数
    this.totalBy = {};         // タネごとの秒数（仮置きを含む。画面に出す値）
    this.bloomedBy = {};       // 咲いたタネ
  };

  // 波形を受け取る。長さは何でもよい。
  Detector.prototype.feed = function (samples) {
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      this.ring[this.ringPos] = s;
      this.ringPos = (this.ringPos + 1) % this.anaLen;
      this.blockBuf[this.blockFill++] = s;
      if (this.blockFill === this.blockLen) {
        this.blockFill = 0;
        this._block();
      }
    }
  };

  Detector.prototype._clarity = function () {
    // McLeod の NSDF（正規化した自己相関）で、周期のはっきりさと高さを見る。
    var n = this.anaLen, x = new Float32Array(n), p = this.ringPos, i;
    for (i = 0; i < n; i++) x[i] = this.ring[(p + i) % n];
    var maxLag = Math.min(this.maxLag, n >> 1);
    var nsdf = new Float32Array(maxLag + 2);
    for (var tau = 0; tau <= maxLag + 1; tau++) {
      var acf = 0, m = 0;
      for (i = 0; i + tau < n; i++) {
        acf += x[i] * x[i + tau];
        m += x[i] * x[i] + x[i + tau] * x[i + tau];
      }
      nsdf[tau] = m > 0 ? 2 * acf / m : 0;
    }
    // 最初に負へ下がった後の山を集める。はっきりさは、いちばん高い山で決める。
    var t = 1;
    while (t <= maxLag && nsdf[t] > 0) t++;
    var best = 0, bestLag = 0, peaks = [];
    for (; t <= maxLag; t++) {
      if (t >= this.minLag && nsdf[t] > nsdf[t - 1] && nsdf[t] >= nsdf[t + 1]) {
        peaks.push(t);
        if (nsdf[t] > best) { best = nsdf[t]; bestLag = t; }
      }
    }
    // ビブラートの見分け（レベル1の数え方）には、前の版と同じ粗い高さを使う。
    // 細かい高さに替えると、揺れの測り方が変わってトレモロの判定まで変わるため。
    this.pitchCoarse = bestLag ? this.sr / bestLag : 0;
    // 音の高さは、いちばん高い山の9割を越える最初の山で決める（McLeod の方法）。
    // いちばん高い山をそのまま使うと、1オクターブ下に聞き違えることがある。
    var lag = 0;
    for (var k = 0; k < peaks.length; k++) { if (nsdf[peaks[k]] >= best * 0.9) { lag = peaks[k]; break; } }
    if (lag) {
      // 山の頂を放物線で細かく求める（高い音ほど1サンプルの差が大きいので）
      var a = nsdf[lag - 1], b = nsdf[lag], c = nsdf[lag + 1], den = a - 2 * b + c;
      var shift = den !== 0 ? 0.5 * (a - c) / den : 0;
      if (shift > 0.5) shift = 0.5; else if (shift < -0.5) shift = -0.5;
      this.pitch = this.sr / (lag + shift);
    } else {
      this.pitch = 0;
    }
    return best;
  };

  Detector.prototype._block = function () {
    var o = this.opt, b = this.blockBuf, half = b.length >> 1, s1 = 0, s2 = 0, i;
    for (i = 0; i < half; i++) s1 += b[i] * b[i];
    for (; i < b.length; i++) s2 += b[i] * b[i];
    var db = toDb((s1 + s2) / b.length);
    this.env = db;
    this.blockIndex++;
    if (this.blockIndex % 2 === 0) {
      this.clarity = db > o.onDb - 6 ? this._clarity() : 0;
      this._trackPitch();
      if (this.classify) this._trackNote(db);
    }

    // 鳴っているか（入りと切れに6dBの幅をつけて、ばたつきを抑える）
    if (this.gateOpen) { if (db < o.onDb - 6) this.gateOpen = false; }
    else if (db > o.onDb) this.gateOpen = true;

    // 弓の返しの谷は短い（20〜40ミリ秒）ので、5ミリ秒きざみで見る
    this.now += this.blockSec / 2;
    this._trackDips(toDb(s1 / half));
    this.now += this.blockSec / 2;
    this._trackDips(toDb(s2 / (b.length - half)));

    // トレモロか: 0.7秒の中に弓の返し（音量の谷）が何回あるか
    var win = o.tremoloWindowSec, now = this.now;
    while (this.dipTimes.length && this.dipTimes[0] < now - win) this.dipTimes.shift();
    var wasTrem = this.tremolo;
    this.tremolo = this.dipTimes.length >= o.tremoloDips;
    if (this.tremolo && !wasTrem) this._onTremolo();

    // トレモロと分かるまでの遅れ（窓の長さ＋0.2秒）より古い分を確定し、確定分だけで花を咲かせる
    var hold = win + 0.2;
    while (this.accrual.length && this.accrual[0][0] < now - hold) {
      var ac = this.accrual.shift();
      this.committed += ac[1];
      if (this.classify) this.committedBy[ac[2]] = (this.committedBy[ac[2]] || 0) + ac[1];
    }
    if (!this.classify) {
      while (this.committed >= o.bloomSec) {
        this.committed -= o.bloomSec;
        this.blooms++;
        this._emit('bloom');
      }
    } else {
      // タネごとに、確定した秒数が開花の秒数に届いたら1回だけ咲かせる
      for (var bk in this.committedBy) {
        if (!this.bloomedBy[bk] && this.committedBy[bk] >= o.bloomSec) {
          this.bloomedBy[bk] = true;
          this.blooms++;
          this._emit({ type: 'bloom', key: Number(bk) });
        }
      }
    }

    var voiced = this.gateOpen && this.clarity >= o.minClarity && !this.tremolo &&
                 (!this.classify || this.key !== null);
    // レベル2: 違うタネの音に変わったら、伸ばしを1秒からやり直す
    if (voiced && this.classify) {
      if (this.stroke > 0 && this.strokeKey !== this.key) this._endStroke();
      if (this.stroke === 0) this.strokeKey = this.key;
    }
    if (this.tremolo) {
      this._endStroke();
      this.state = 'tremolo';
    } else if (voiced) {
      this.gap = 0;
      this.stroke += this.blockSec;
      if (!this.qualified) {
        this.state = 'rising';
        if (this.stroke >= o.waterStartSec) {
          this.qualified = true;
          this.waters++;
          this._emit(this.classify ? { type: 'water', key: this.strokeKey } : 'water');
          // 水が出るまでの1秒も伸ばした時間として数える（10ミリ秒ずつ、もとの時刻で置く）
          var n = Math.round(this.stroke / this.blockSec);
          for (var j = n - 1; j >= 0; j--) this._add(this.blockSec, now - j * this.blockSec);
        }
      } else {
        this.state = 'watering';
        this._add(this.blockSec, now);
      }
    } else {
      this.gap += this.blockSec;
      if (this.gap > o.gapHoldSec) { this._endStroke(); this.state = 'idle'; }
    }
    this._sumTotal();
  };

  Detector.prototype._sumTotal = function () {
    var p = 0;
    for (var i = 0; i < this.accrual.length; i++) p += this.accrual[i][1];
    this.total = this.committed + p;
    if (this.classify) {
      var by = {};
      for (var k in this.committedBy) by[k] = this.committedBy[k];
      for (var j = 0; j < this.accrual.length; j++) {
        var e = this.accrual[j];
        by[e[2]] = (by[e[2]] || 0) + e[1];
      }
      this.totalBy = by;
    }
  };

  Detector.prototype._emit = function (e) {
    this.events.push(e);
    if (this.events.length > 50) this.events.shift();   // 画面が止まっていても溜めすぎない
  };

  Detector.prototype._add = function (sec, time) {
    this.accrual.push([time, sec, this.strokeKey]);
  };

  Detector.prototype._endStroke = function () {
    this.stroke = 0;
    this.qualified = false;
    this.gap = 0;
  };

  Detector.prototype._trackDips = function (db) {
    // 音量の山から tremoloDipDb 以上落ち、谷から6割戻ったら「谷1つ」。
    // 山はゆっくり下がる（1秒で30dB）ので、だんだん弱くする音は谷にならない。
    // 谷が0.3秒より長ければ、弓の返しではなく休み（数えない）。
    // ビブラートは音量も少し揺れるので、音の高さが揺れている間は谷の基準を3dB深くする。
    var d = this.opt.tremoloDipDb + (this.vibrato ? 3 : 0), on = this.opt.onDb;
    if (this.dipState === 'high') {
      this.peak = Math.max(db, this.peak - 0.15);
      if (this.peak > on && db < this.peak - d) { this.dipState = 'low'; this.trough = db; this.lowSince = this.now; }
    } else {
      if (db < this.trough) this.trough = db;
      if (db > this.trough + d * 0.6 && db > on - 6) {
        this.dipState = 'high';
        this.peak = db;
        if (this.now - this.lowSince <= 0.3) this.dipTimes.push(this.now);
      } else if (this.now - this.lowSince > 0.3 && db < on - 6) {
        this.dipState = 'high';
        this.peak = db;
      }
    }
  };

  Detector.prototype._trackPitch = function () {
    // 直近0.5秒の音の高さ（はっきりした所だけ）の揺れ幅をセントで見る。
    // 20セント以上揺れていればビブラート。トレモロは同じ高さのままなので揺れない。
    var ph = this.pitchHist;
    if (this.clarity >= 0.8 && this.pitchCoarse > 0) ph.push([this.now, 1200 * Math.log2(this.pitchCoarse / 440)]);
    while (ph.length && ph[0][0] < this.now - 0.5) ph.shift();
    if (ph.length < 10) { this.vibrato = false; return; }
    var c = ph.map(function (e) { return e[1]; }).sort(function (a, b) { return a - b; });
    var lo = c[Math.floor(c.length * 0.1)], hi = c[Math.floor(c.length * 0.9)];
    var med = c[c.length >> 1];
    // 半音以上の動き（音が変わった）はビブラートと呼ばない
    this.vibrato = (hi - lo) >= 20 && (hi - lo) <= 100 && Math.abs(hi - med) < 60;
  };

  Detector.prototype._onTremolo = function () {
    // トレモロと分かる前に数えてしまった分を取り消す（最初の谷の少し前から）。
    // 取り消すのはまだ仮置きの分だけ。確定した分と咲いた回数には触らない。
    var from = this.dipTimes[0] - 0.2;
    this.accrual = this.accrual.filter(function (e) { return e[0] < from; });
    this._sumTotal();
    this._emit(this.classify ? { type: 'tremolo', key: null } : 'tremolo');
  };

  Detector.prototype._trackNote = function (db) {
    // 直近0.12秒の、はっきりした高さの真ん中の値でタネを決める。
    // 弾き始めのゆれや、1コマだけの聞き違いで別のタネへ飛ばないようにする。
    var nh = this.noteHist;
    if (db > this.opt.onDb - 6 && this.clarity >= this.opt.minClarity && this.pitch > 0) nh.push([this.now, this.pitch]);
    while (nh.length && nh[0][0] < this.now - 0.12) nh.shift();
    if (nh.length < 3) { this.key = null; this.heard = null; return; }
    var f = nh.map(function (e) { return e[1]; }).sort(function (a, b) { return a - b; })[nh.length >> 1];
    var r = this.classify(f);
    this.key = (r && r.key !== null && r.key !== undefined) ? r.key : null;
    this.heard = r ? (r.heard || null) : null;
  };

  Detector.prototype.takeEvents = function () {
    var e = this.events; this.events = []; return e;
  };

  Detector.DEFAULTS = DEFAULTS;
  root.SustainDetector = Detector;
  if (typeof module !== 'undefined' && module.exports) module.exports = Detector;
})(typeof window !== 'undefined' ? window : globalThis);
