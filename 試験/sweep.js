const D=require(require('path').resolve(process.argv[2])); const {render}=require('./synth.js'); const sr=48000;
function tot(segs){const x=render(segs,sr);const d=new D(sr);for(let i=0;i<x.length;i+=1024)d.feed(x.subarray(i,i+1024));return d.total.toFixed(2)}
console.log('トレモロの谷の深さ別（5秒弾いて数えた秒数。0なら外した）');
for(const hz of [6,8,10,12]) console.log(' '+hz+'Hz', [3,4,5,6,7,8].map(db=>db+'dB:'+tot([{dur:.3},{dur:5,f:440,trem:{hz,dipDb:db,dipMs:Math.min(60,350/hz),noise:0.2}},{dur:.3}])).join('  '));
console.log('ビブラートの音量の揺れ別（3秒弾いて数えた秒数。3に近ければ数えた）');
for(const am of [2,3,4,5,6]) console.log(' ±'+am+'dB', 'ピッチ±30c:'+tot([{dur:.3},{dur:3,f:440,vibC:30,amDb:am,amHz:5.5},{dur:.3}]), ' ピッチ揺れなし:'+tot([{dur:.3},{dur:3,f:440,amDb:am,amHz:5.5},{dur:.3}]));
console.log('部屋の雑音つき（白色雑音 約-40dBFS）で3秒:', tot([{dur:.3,white:0.01},{dur:3,f:440,white:0.01},{dur:.3,white:0.01}]));
