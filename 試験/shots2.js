// レベル2とメニューの見た目を3つの大きさで撮る。node shots2.js <出力フォルダ>
const {spawn}=require('child_process'); const fs=require('fs'); const path=require('path');
const outDir=process.argv[2]; const W=path.resolve(__dirname,'..'); const port=9800+Math.floor(Math.random()*100);
const ud=fs.mkdtempSync(require('os').tmpdir()+'/wgshot-');
const ch=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${ud}`,'--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  for(let i=0;i<50;i++){try{await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();break}catch{await sleep(200)}}
  const tgt=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  const ws=new WebSocket(tgt.webSocketDebuggerUrl); let id=0; const pend={}; const logs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]} if(m.method==='Runtime.exceptionThrown')logs.push('EXC '+JSON.stringify(m.params.exceptionDetails));};
  await new Promise(r=>ws.onopen=r);
  const send=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}))});
  const ev=async x=>(await send('Runtime.evaluate',{expression:x,returnByValue:true})).result?.result?.value;
  await send('Runtime.enable'); await send('Page.enable');
  const shot=async name=>{const s=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync(path.join(outDir,name+'.png'),Buffer.from(s.result.data,'base64'));};
  const feed=`(function(m,sec){var d=window.__wg.detector,sr=48000,f=442*Math.pow(2,(m-69)/12),n=Math.round(sec*sr),x=new Float32Array(n),ph=0;for(var i=0;i<n;i++){ph+=2*Math.PI*f/sr;var v=0;for(var h=1;h<=8;h++)v+=Math.sin(h*ph)/h;x[i]=v*0.18+(Math.random()-.5)*0.002;}for(var j=0;j<n;j+=1024)d.feed(x.subarray(j,j+1024));})`;
  const sizes=[[1180,820,'tab_yoko'],[768,1024,'tab_tate'],[390,844,'phone']];
  for(const [w,h,nm] of sizes){
    await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:nm==='phone'});
    await send('Page.navigate',{url:'file://'+W+'/index.html'}); await sleep(700); await shot(nm+'_menu');
    await send('Page.navigate',{url:'file://'+W+'/yubi.html'}); await sleep(700); await shot(nm+'_pick');
    await send('Page.navigate',{url:'file://'+W+'/yubi.html?string=D'}); await sleep(700);
    await ev(feed+'(62,16.5)'); await ev(feed+'(64,7)'); await sleep(400); await ev(feed+'(66,2.2)'); await sleep(900);
    const ov=await ev('JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,st:window.__wg.getState()})');
    console.log(nm, ov); await shot(nm+'_play');
    await ev("document.getElementById('gearBtn').click()"); await sleep(300); await shot(nm+'_settings');
  }
  console.log(logs.join('\n')||'例外なし'); ws.close(); ch.kill(); process.exit(0);
})().catch(e=>{console.error(e);ch.kill();process.exit(1)});
