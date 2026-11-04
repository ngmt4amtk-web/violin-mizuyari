const D=require(require('path').resolve(process.argv[2])); const {render}=require('./synth.js');
const sr=48000;
function run(name, segs, expect, opts){
  const x=render(segs,sr); const d=new D(sr,opts||{}); 
  for(let i=0;i<x.length;i+=1024) d.feed(x.subarray(i,i+1024));
  const res={waters:d.waters, blooms:d.blooms, total:+d.total.toFixed(2)};
  const ok=Object.entries(expect).every(([k,v])=> Array.isArray(v)? (res[k]>=v[0]&&res[k]<=v[1]) : res[k]===v);
  console.log((ok?'OK  ':'NG  ')+name.padEnd(42), JSON.stringify(res), ' 期待', JSON.stringify(expect));
  return ok;
}
const S=(dur,o={})=>Object.assign({dur,f:440},o), Z=(dur)=>({dur});
let all=true; const T=(...a)=>{all=run(...a)&&all};
T('A 3秒まっすぐ(A4)',[Z(0.5),S(3),Z(0.5)],{waters:1,total:[2.8,3.05]});
T('B 35秒まっすぐ→1回咲く',[Z(0.3),S(35),Z(0.3)],{waters:1,blooms:1,total:[4.7,5.05]});
T('C ビブラート±30c 5.5Hz 音量±2dB',[Z(0.3),S(3,{vibC:30,amDb:2}),Z(0.3)],{waters:1,total:[2.8,3.05]});
T('C2 ビブラート±40c 6Hz 音量±3dB',[Z(0.3),S(3,{vibC:40,vibHz:6,amDb:3,amHz:6}),Z(0.3)],{waters:1,total:[2.8,3.05]});
T('D トレモロ8Hz 谷-12dB+擦れ',[Z(0.3),S(5,{trem:{hz:8,dipDb:12,dipMs:40,noise:0.5}}),Z(0.3)],{total:[0,0.3]});
T('D2 トレモロ12Hz 谷-8dB',[Z(0.3),S(5,{trem:{hz:12,dipDb:8,dipMs:30,noise:0.3}}),Z(0.3)],{total:[0,0.3]});
T('D3 トレモロ6Hz 毎回途切れる',[Z(0.3),S(5,{trem:{hz:6,dipDb:60,dipMs:60}}),Z(0.3)],{total:[0,0.3]});
T('D4 トレモロ10Hz 浅い谷-7dB',[Z(0.3),S(5,{trem:{hz:10,dipDb:7,dipMs:35,noise:0.2}}),Z(0.3)],{total:[0,0.3]});
T('D5 トレモロ4Hz 谷-10dB',[Z(0.3),S(5,{trem:{hz:4,dipDb:10,dipMs:50,noise:0.3}}),Z(0.3)],{total:[0,0.3]});
T('D6 トレモロ16Hz 谷-10dB',[Z(0.3),S(5,{trem:{hz:16,dipDb:10,dipMs:25,noise:0.3}}),Z(0.3)],{total:[0,0.3]});
T('E 0.7秒の短い音×10',Array.from({length:10},()=>[S(0.7),Z(0.5)]).flat(),{waters:0,total:0});
T('F 1.3秒の音×5（間0.4秒）',Array.from({length:5},()=>[S(1.3),Z(0.4)]).flat(),{waters:5,total:[6.2,6.55]});
T('G 10秒、2秒ごとに弓返し',[Z(0.3),S(10,{bowEvery:2}),Z(0.3)],{waters:1,total:[9.6,10.05]});
T('H 大きい雑音3秒',[Z(0.3),{dur:3,white:0.3},Z(0.3)],{waters:0,total:0});
T('I まっすぐ3→トレモロ3→まっすぐ3',[Z(0.3),S(3),S(3,{trem:{hz:8,dipDb:12,dipMs:40,noise:0.5}}),S(3),Z(0.3)],{waters:2,total:[5.3,6.05]});
T('J G3(196Hz) 3秒',[Z(0.3),S(3,{f:196}),Z(0.3)],{waters:1,total:[2.8,3.05]});
T('J2 E6(1319Hz) 3秒',[Z(0.3),S(3,{f:1319}),Z(0.3)],{waters:1,total:[2.8,3.05]});
T('K だんだん弱く(-0→-15dB) 4秒',[Z(0.3),S(4,{ramp:[0,-15]}),Z(0.3)],{waters:1,total:[3.8,4.05]});
T('L 小さすぎる音(-50dB程度) 3秒',[Z(0.3),S(3,{gain:-55}),Z(0.3)],{waters:0,total:0});
T('M 無音',[Z(5)],{waters:0,total:0});
T('N 0.9秒×40（足しても水なし）',Array.from({length:40},()=>[S(0.9),Z(0.3)]).flat(),{waters:0,blooms:0,total:0});
T('O 1.5秒×21≒31秒→1回咲く',Array.from({length:21},()=>[S(1.5),Z(0.3)]).flat(),{waters:21,blooms:1,total:[1.0,1.5]});
const tr={hz:8,dipDb:12,dipMs:40,noise:0.5};
T('P 29.85秒まっすぐ→すぐトレモロ（咲かない）',[Z(0.3),S(29.85),S(3,{trem:tr}),Z(1.5)],{blooms:0,total:[29.3,29.95]});
T('Q 1.6秒まっすぐ→トレモロ（前半は残る）',[Z(0.3),S(1.6),S(3,{trem:tr}),Z(1.5)],{waters:1,total:[1.2,1.65]});
T('R 31秒まっすぐ→トレモロ（1回咲いて残りあり）',[Z(0.3),S(31),S(3,{trem:tr}),Z(1.5)],{blooms:1,total:[0.5,1.05]});
{ // 途中で開花秒数を下げる
  const x=render([Z(0.3),S(25),Z(2)],sr); const d=new D(sr); for(let i=0;i<x.length;i+=1024){ d.feed(x.subarray(i,i+1024)); if(i===Math.round(26.5*sr/1024)*1024) d.setOptions({bloomSec:10}); }
  const ok=d.blooms===2 && d.total>4.5 && d.total<5.1; all=ok&&all; console.log((ok?'OK  ':'NG  ')+'S 25秒の後に開花10秒へ変更→すぐ2回咲く', JSON.stringify({blooms:d.blooms,total:+d.total.toFixed(2)}));
}
{ const d=new D(sr,{bloomSec:0}); d.feed(render([S(2)],sr)); const ok=d.opt.bloomSec>=1; all=ok&&all; console.log((ok?'OK  ':'NG  ')+'T 開花0秒を渡しても止まらない', d.opt.bloomSec, d.blooms); }
console.log(all?'全部OK':'NGあり');
