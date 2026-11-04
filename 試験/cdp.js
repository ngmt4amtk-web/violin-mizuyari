// 使い方: node cdp.js <wav> <秒数> <ログ出力>
const {spawn}=require('child_process'); const fs=require('fs');
const [wavPath,secs,out,shotsArg]=process.argv.slice(2); const acts=(process.env.ACT||'').split(';').filter(Boolean).map(a=>{const k=a.indexOf(':');return [Number(a.slice(0,k)),a.slice(k+1)]}); const shots=(shotsArg||'').split(',').filter(Boolean).map(Number); const port=9300+Math.floor(Math.random()*500);
const app=(process.env.APP||'file:///Users/ngmt.mtk/Shortcuts/ヘルメス成果物/2026-11-04_水やりゲーム/app.html')+'?autostart=1';
const ud=fs.mkdtempSync(require('os').tmpdir()+'/wgchrome-');
const ch=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${ud}`,
 '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${wavPath}%noloop`,
 '--autoplay-policy=no-user-gesture-required','--allow-file-access-from-files','about:blank'],{stdio:['ignore','ignore','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  let ver; for(let i=0;i<50;i++){try{ver=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();break}catch{await sleep(200)}}
  const tgt=await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(app)}`,{method:'PUT'})).json();
  const ws=new WebSocket(tgt.webSocketDebuggerUrl); let id=0; const pend={}; const logs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]} if(m.method==='Runtime.consoleAPICalled')logs.push(m.params.args.map(a=>a.value).join(' ')); if(m.method==='Runtime.exceptionThrown')logs.push('EXC '+JSON.stringify(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text));};
  await new Promise(r=>ws.onopen=r);
  const send=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}))});
  await send('Runtime.enable');
  const rows=[]; const t0=Date.now();
  while((Date.now()-t0)/1000<+secs){
    const r=await send('Runtime.evaluate',{expression:'JSON.stringify(window.__wg?window.__wg.getState():null)',returnByValue:true});
    const el=(Date.now()-t0)/1000;
    if(acts.length && el>=acts[0][0]){const a=acts.shift(); const rr=await send('Runtime.evaluate',{expression:a[1],awaitPromise:true}); rows.push('ACTION '+a[1]+' -> '+JSON.stringify(rr.result?.result?.value??rr.result?.exceptionDetails?.text??null));} rows.push(el.toFixed(2)+' '+(r.result?.result?.value));
    if(shots.length && el>=shots[0]){const sh=await send('Page.captureScreenshot',{format:'png'}); if(sh.result) fs.writeFileSync(out+'.'+shots[0]+'.png',Buffer.from(sh.result.data,'base64')); shots.shift();}
    await sleep(250);
  }
  const shot=await send('Page.captureScreenshot',{format:'png'}); if(shot.result) fs.writeFileSync(out+'.png',Buffer.from(shot.result.data,'base64'));
  fs.writeFileSync(out,rows.join('\n')+'\n--- console ---\n'+logs.join('\n'));
  ws.close(); ch.kill(); process.exit(0);
})().catch(e=>{console.error(e);ch.kill();process.exit(1)});
