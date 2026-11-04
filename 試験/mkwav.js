const fs=require('fs'); const {render}=require('./synth.js'); const sr=48000;
function wav(path,x){const b=Buffer.alloc(44+x.length*2);b.write('RIFF',0);b.writeUInt32LE(36+x.length*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(x.length*2,40);for(let i=0;i<x.length;i++)b.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(x[i]*32767))),44+i*2);fs.writeFileSync(path,b)}
const S=(dur,o={})=>Object.assign({dur,f:440},o), Z=d=>({dur:d});
const trem={hz:8,dipDb:12,dipMs:40,noise:0.5};
wav('w_long.wav',render([Z(3),S(35),Z(4)],sr));                 // 35秒まっすぐ → 30秒で開花
wav('w_trem.wav',render([Z(3),S(12,{trem}),Z(3)],sr));          // トレモロ12秒 → 水なし
wav('w_mix.wav',render([Z(3),S(1.3),Z(0.6),S(1.3),Z(0.6),S(0.7),Z(0.6),S(3),S(3,{trem}),Z(3)],sr)); // 水3回・短い音とトレモロは数えない
