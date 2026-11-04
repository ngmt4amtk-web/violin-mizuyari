// 合成音の材料。seg = {dur, f, vibC, vibHz, amDb, amHz, trem:{hz, dipDb, dipMs, noise}, gain, noise}
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296-0.5}}
function render(segs, sr=48000, seed=1){
  const r=rng(seed); const total=segs.reduce((a,s)=>a+s.dur,0); const out=new Float32Array(Math.round(total*sr));
  let i0=0, ph=0;
  for(const s of segs){
    const n=Math.round(s.dur*sr); const g=Math.pow(10,(s.gain??-20)/20);
    for(let i=0;i<n;i++){
      const t=i/sr; let v=0;
      if(s.f){
        const f=s.f*Math.pow(2,((s.vibC||0)*Math.sin(2*Math.PI*(s.vibHz||5.5)*t))/1200);
        ph+=2*Math.PI*f/sr; for(let h=1;h<=8;h++) v+=Math.sin(h*ph)/h; v*=0.6;
        let amp=1;
        if(s.amDb) amp*=Math.pow(10,(s.amDb*Math.sin(2*Math.PI*(s.amHz||5.5)*t))/20);
        if(s.ramp) amp*=Math.pow(10,(s.ramp[0]+(s.ramp[1]-s.ramp[0])*t/s.dur)/20);
        if(s.trem){ const per=1/s.trem.hz; const tp=t%per; const dm=s.trem.dipMs/1000;
          if(tp<dm){ const w=Math.sin(Math.PI*tp/dm); const att=Math.pow(10,-s.trem.dipDb*w/20); amp*=att; v+= (s.trem.noise||0)*w*r()*4; } }
        if(s.bowEvery){ const tp=t%s.bowEvery; const dm=0.05; if(t>0.2 && tp<dm){ const w=Math.sin(Math.PI*tp/dm); amp*=Math.pow(10,-8*w/20);} }
        v*=amp;
      }
      v+= (s.noise??0.002)*r()*2;
      if(s.white) v+= s.white*r()*2;
      out[i0+i]=v*g*3;
    }
    i0+=n;
  }
  return out;
}
module.exports={render};
