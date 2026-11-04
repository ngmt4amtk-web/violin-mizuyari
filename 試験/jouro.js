// ジョウロの出る順番・左側・初期10秒を Chrome（作り物のマイク）で確かめる。
// 使い方: node jouro.js <出力フォルダ>
// 合成音の wav を出力フォルダに作り、app.html をそれぞれ開いて、ジョウロの出入りを毎コマ記録する。
const {spawn}=require('child_process'); const fs=require('fs'); const path=require('path');
const {render}=require('./synth.js');
const outDir=path.resolve(process.argv[2]||'.'); fs.mkdirSync(outDir,{recursive:true});
const APP='file://'+path.resolve(__dirname,'../app.html');
const sr=48000;
function wav(p,x){const b=Buffer.alloc(44+x.length*2);b.write('RIFF',0);b.writeUInt32LE(36+x.length*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(x.length*2,40);for(let i=0;i<x.length;i++)b.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(x[i]*32767))),44+i*2);fs.writeFileSync(p,b)}
const S=(dur,o={})=>Object.assign({dur,f:440},o), Z=d=>({dur:d});
const trem={hz:8,dipDb:12,dipMs:40,noise:0.5};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// 毎コマ、ジョウロと判定器の状態が変わった時だけ、判定器の時刻（音の秒）と一緒に残す
const REC=`(function(){var L=window.__log=[];var last='';var P=document.getElementById('plant');window.__anim=[];new MutationObserver(function(){var n=document.querySelector('#plant > .stage.nyoki');window.__anim.push({t:+window.__wg.detector.now.toFixed(2),boing:P.classList.contains('boing'),nyoki:n?n.getAttribute('data-stage'):null,pon:document.getElementById('pon').classList.contains('go'),grow:P.style.getPropertyValue('--grow')});}).observe(document.getElementById('scene'),{subtree:true,attributes:true,attributeFilter:['class','style']});function f(){var s=window.__wg.getState();var d=window.__wg.detector;
var k=[s.state,s.canVisible,s.canPouring,s.dropsOn,s.waters,s.finished,s.stage].join('|');
if(k!==last){last=k;L.push({t:+d.now.toFixed(3),state:s.state,can:s.canVisible,pour:s.canPouring,drops:s.dropsOn,waters:s.waters,total:+s.total.toFixed(2),finished:s.finished,stage:s.stage,bar:document.getElementById('barText').textContent});}
requestAnimationFrame(f);}requestAnimationFrame(f);})()`;

async function run(name,segs,secs,{w=1180,h=820,mobile=false,pre=null,shotsAt=[]}={}){
  const wp=path.join(outDir,name+'.wav'); wav(wp,render(segs,sr));
  const port=9400+Math.floor(Math.random()*400);
  const ud=fs.mkdtempSync(require('os').tmpdir()+'/wgjouro-');
  const ch=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${ud}`,
    '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${wp}%noloop`,
    '--autoplay-policy=no-user-gesture-required','--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
  for(let i=0;i<50;i++){try{await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();break}catch{await sleep(200)}}
  const tgt=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  const ws=new WebSocket(tgt.webSocketDebuggerUrl); let id=0; const pend={}; const exc=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]} if(m.method==='Runtime.exceptionThrown')exc.push(JSON.stringify(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text));};
  await new Promise(r=>ws.onopen=r);
  const send=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}))});
  const ev=async x=>(await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true})).result?.result?.value;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile});
  // 設定の初期状態: 空にしてから、必要なら前の版の保存値などを入れる
  await send('Page.navigate',{url:APP}); await sleep(500);
  await ev(`localStorage.clear(); ${pre||''}; 1`);
  await send('Page.navigate',{url:APP+'?autostart=1'}); await sleep(300);
  await ev(REC);
  const info={};
  info.cfgOnOpen=await ev(`JSON.stringify({bloomOpt:window.__wg.detector.opt.bloomSec,waterOpt:window.__wg.detector.opt.waterStartSec,slider:document.getElementById('bloomIn').value,out:document.getElementById('bloomOut').textContent,bar:document.getElementById('barText').textContent})`);
  const t0=Date.now(); const shots=[...shotsAt]; const geo=[];
  while((Date.now()-t0)/1000<secs){
    if(shots.length && (Date.now()-t0)/1000>=shots[0]){
      const at=shots.shift();
      const g=await ev(`(function(){var c=document.getElementById('canWrap').getBoundingClientRect(),p=document.getElementById('plant').getBoundingClientRect(),dr=document.querySelector('#drops .drop').getBoundingClientRect(),s=window.__wg.getState();return JSON.stringify({at:${at},vw:innerWidth,canLeft:Math.round(c.left),canRight:Math.round(c.right),plantCenter:Math.round((p.left+p.right)/2),dx:getComputedStyle(document.getElementById('drops')).getPropertyValue('--dx').trim(),can:s.canVisible,pour:s.canPouring,drops:s.dropsOn,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})})()`);
      geo.push(g);
      const sh=await send('Page.captureScreenshot',{format:'png'}); if(sh.result) fs.writeFileSync(path.join(outDir,`${name}_${at}s.png`),Buffer.from(sh.result.data,'base64'));
    }
    await sleep(100);
  }
  info.log=await ev('JSON.stringify(window.__log)');
  info.anim=await ev('JSON.stringify(window.__anim||[])');
  info.end=await ev('JSON.stringify(window.__wg.getState())');
  info.cfgSaved=await ev(`localStorage.getItem('wg_cfg_v1')`);
  info.geo=geo; info.exceptions=exc;
  fs.writeFileSync(path.join(outDir,name+'.json'),JSON.stringify(info,null,1));
  ws.close(); ch.kill();
  return info;
}

(async()=>{
  const which=(process.env.ONLY||'').split(',').filter(Boolean);
  const cases=[
    // 1. 4秒の音1本: 音が聞こえた所でジョウロ（立ったまま）→ 1秒で傾けて水
    ['one4s',[Z(1.5),S(4),Z(3)],10,{shotsAt:[2.0,3.6]}],
    // 2. 12秒の音: 初期値10秒で咲く
    ['bloom10',[Z(1.5),S(12),Z(3)],18,{shotsAt:[1.2,3.4,6.5,9.8,14]}],
    // 3. 0.7秒の音3つ: ジョウロは出るが、水は出ない・数えない
    ['short07',[Z(1.5),S(0.7),Z(1.2),S(0.7),Z(1.2),S(0.7),Z(3)],9,{}],
    // 3b. 水やりの直後（1.5秒以内）に短い音: 次の音が始まったら水を止め、立てて待つ
    ['again07',[Z(1.5),S(2),Z(0.4),S(0.7),Z(3)],8,{}],
    // 4. トレモロ8秒: 数えない。ジョウロが出ている時間も測る
    ['trem8',[Z(1.5),S(8,{trem}),Z(3)],14,{}],
    // 5. 水の秒数を2.0秒にした時: 2秒間は立ったまま待ち、2秒で水
    ['water2s',[Z(1.5),S(4),Z(3)],10,{pre:`localStorage.setItem('wg_cfg_v1',JSON.stringify({bloomSec:10,bloomV:2,waterStartSec:2,onDb:-45,tremoloDipDb:6}))`}],
    // 6. 前の版が残した30（印なし）: 10に読み替える
    ['old30',[Z(1)],3,{pre:`localStorage.setItem('wg_cfg_v1',JSON.stringify({bloomSec:30,waterStartSec:1,onDb:-50,tremoloDipDb:6}))`}],
    // 7. 前の版が残した20（印なし）: 20のまま
    ['old20',[Z(1)],3,{pre:`localStorage.setItem('wg_cfg_v1',JSON.stringify({bloomSec:20,waterStartSec:1,onDb:-45,tremoloDipDb:6}))`}],
    // 8. 今の版で30を選んだ（印あり）: 30のまま
    ['new30',[Z(1)],3,{pre:`localStorage.setItem('wg_cfg_v1',JSON.stringify({bloomSec:30,bloomV:2,waterStartSec:1,onDb:-45,tremoloDipDb:6}))`}],
    // 9-10. 縦のタブレットとスマホで、水を出している所を撮る（左側・はみ出し）
    ['tate',[Z(1.5),S(5),Z(2)],6,{w:768,h:1024,shotsAt:[1.9,4.0]}],
    ['phone',[Z(1.5),S(5),Z(2)],6,{w:390,h:844,mobile:true,shotsAt:[1.9,4.0]}],
  ];
  for(const [n,segs,secs,opt] of cases){
    if(which.length && !which.includes(n)) continue;
    const r=await run(n,segs,secs,opt);
    console.log('== '+n, r.cfgOnOpen, 'saved:', r.cfgSaved, 'exc:', r.exceptions.length);
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
