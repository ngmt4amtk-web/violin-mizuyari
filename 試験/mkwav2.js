// レベル2（ゆびのタネ）の Chrome 試験用の音。ラ線・基準442Hz
const fs=require('fs'); const {render}=require('./synth.js'); const sr=48000;
function wav(path,x){const b=Buffer.alloc(44+x.length*2);b.write('RIFF',0);b.writeUInt32LE(36+x.length*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(x.length*2,40);for(let i=0;i<x.length;i++)b.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(x[i]*32767))),44+i*2);fs.writeFileSync(path,b)}
const hz=m=>442*Math.pow(2,(m-69)/12), N=(dur,m,o={})=>Object.assign({dur,f:hz(m)},o), Z=d=>({dur:d});
const trem={hz:8,dipDb:12,dipMs:40,noise:0.5};
// 3秒無音 → レ線の開放2.5秒（いまのは レせんの 0）→ ドのナチュラル2.5秒（どのタネかな）→ ラ線の0〜4を16秒ずつ → 4秒無音
wav('y_full.wav',render([Z(3),N(2.5,62),Z(0.8),N(2.5,72),Z(0.8),...[69,71,73,74,76].flatMap(m=>[N(16,m),Z(0.6)]),Z(4)],sr));
// 3秒無音 → 1の指でトレモロ6秒 → 2の指3秒 → 3の指3秒 → 無音
wav('y_trem.wav',render([Z(3),N(6,71,{trem}),Z(0.6),N(3,73),N(3,74),Z(3)],sr));
