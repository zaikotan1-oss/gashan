/* ===========================================================
   ガッシャンランド — 共通エンジン (engine.js)
   すべてのゲームが共有する土台。
   - 描画ループ / 画面揺れ / 効果音(合成) / 入力ルーティング / メニュー
   グローバルに公開: Engine, api, および補助関数(TAU,rint,rnd,pick,clamp,lerp,ease)
   各ゲームは Engine.register("id", function build(api){ ... return {frame,input?,resize?,stop?} }) で登録する。
   =========================================================== */

const TAU = Math.PI * 2;
const rint  = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const rnd   = (a,b)=>a+Math.random()*(b-a);
const pick  = a=>a[Math.floor(Math.random()*a.length)];
const clamp = (v,a,b)=>v<a?a:v>b?b:v;
const lerp  = (a,b,t)=>a+(b-a)*t;
const ease  = t=>1-Math.pow(1-t,3);

const cv = document.getElementById("c");
const g  = cv.getContext("2d");
const scoreEl = document.getElementById("score");

let _muted=false, _raf=null, _running=false, _active=null, _last=0, _hitStop=0;

/* subtle vignette: 全ゲーム共通の奥行き/質感（端をほんのり締める） */
let _vig=null,_vigW=0,_vigH=0;
function buildVignette(){
  const r=g.createRadialGradient(api.W/2,api.H*0.44,Math.min(api.W,api.H)*0.34,
                                 api.W/2,api.H*0.52,Math.max(api.W,api.H)*0.78);
  r.addColorStop(0,"rgba(0,0,0,0)"); r.addColorStop(0.7,"rgba(0,0,0,0.04)"); r.addColorStop(1,"rgba(0,0,0,0.20)");
  _vig=r; _vigW=api.W; _vigH=api.H;
}

/* celebration / juice fx state (engine-level: 全ゲーム共通) */
const _fx={ conf:[], bann:null, mileNext:10 };
const _MILES=[10,25,50,100,200,350,500];
function _nextMile(v){ for(const m of _MILES) if(m>v) return m; return Math.ceil((v+1)/100)*100; }

/* live shared state passed to every game */
const api = { W:0, H:0, dpr:1, g:g, shakeV:0,
  rint, rnd, pick, clamp, lerp, ease, TAU,
  shake(n){ api.shakeV = Math.min(api.shakeV + n, 42); },
  setScore(n){
    const prev=Number(scoreEl.textContent)||0; scoreEl.textContent=n;
    if(n>prev){ scoreEl.classList.remove("pop"); void scoreEl.offsetWidth; scoreEl.classList.add("pop");
      while(_fx.mileNext<=n){ _celebrate(_fx.mileNext); _fx.mileNext=_nextMile(_fx.mileNext); } }
    else if(n<prev){ _fx.mileNext=_nextMile(n-1); }   // 新規ゲーム/リセット時に再設定
  },
  hitStop(frames){ _hitStop=Math.max(_hitStop, frames||4); }   // 大ヒット時の微小フリーズ
};

/* -------- image assets (assets/<gameId>/<name>, 無ければ手描きへフォールバック) --------
   使い方: build 内で api.preload(["bg.jpg","robot.png"]);
           frame 内で if(!api.drawAsset("bg.jpg",0,0,api.W,api.H)){ ...従来の手描き... }
   ・拡張子省略時は .png。"shared/xxx.png" のように / を含めば assets/ 直下からの相対。
   ・Image が無い環境(nodeテスト)では常に未準備扱い→手描きにフォールバック(テストは従来どおり通る)。 */
const _imgs={};
function _assetVer(){ const e=document.getElementById("ver"); return e&&e.textContent?encodeURIComponent(String(e.textContent).trim()):"0"; }
api.gameId="";
api.asset=function(name){
  const file = name.indexOf(".")>=0 ? name : name+".png";
  const path = name.indexOf("/")>=0 ? "assets/"+file : "assets/"+api.gameId+"/"+file;
  let im=_imgs[path]; if(im) return im;
  if(typeof Image==="undefined"){ im={ready:false,failed:true,width:0,height:0}; _imgs[path]=im; return im; }
  im=new Image(); im.ready=false; im.failed=false;
  im.onload=()=>{ im.ready=im.naturalWidth>0; };
  im.onerror=()=>{ im.failed=true; };
  im.src=path+"?v="+_assetVer();
  _imgs[path]=im; return im;
};
/* 画像/キャンバスを描く共通部。opts: {center, rot, flip, alpha} */
api.drawSrc=function(src,x,y,w,h,opts){
  const c=api.g; c.save();
  if(opts&&opts.alpha!=null) c.globalAlpha=opts.alpha;
  if(opts&&(opts.rot||opts.flip)){
    const cx=opts.center?x:x+w/2, cy=opts.center?y:y+h/2;
    c.translate(cx,cy); if(opts.rot) c.rotate(opts.rot); if(opts.flip) c.scale(-1,1);
    c.drawImage(src,-w/2,-h/2,w,h);
  } else if(opts&&opts.center){ c.drawImage(src,x-w/2,y-h/2,w,h); }
  else c.drawImage(src,x,y,w,h);
  c.restore(); return true;
};
api.drawAsset=function(name,x,y,w,h,opts){
  const im=api.asset(name); if(!im.ready) return false;
  return api.drawSrc(im,x,y,w,h,opts);
};
/* 背景を画面いっぱいに cover-fit（比率を保ち中央で切る）。alpha 省略時 1 */
api.drawCover=function(name,alpha){
  const im=api.asset(name); if(!im.ready) return false;
  const iw=im.naturalWidth||im.width, ih=im.naturalHeight||im.height;
  const s=Math.max(api.W/iw, api.H/ih), w=iw*s, h=ih*s;
  const c=api.g; c.save(); if(alpha!=null) c.globalAlpha=alpha;
  c.drawImage(im,(api.W-w)/2,(api.H-h)/2,w,h); c.restore(); return true;
};
/* スプライトを色替えした複製（オフスクリーンに描いて source-atop で着色・キャッシュ）。
   未準備なら null（呼び出し側は手描きへ）。alpha=着色の強さ(既定0.45) */
const _tints={};
api.tinted=function(name,color,alpha){
  const im=api.asset(name); if(!im.ready) return null;
  const key=name+"|"+color+"|"+(alpha==null?0.45:alpha);
  let cv2=_tints[key]; if(cv2) return cv2;
  if(typeof document==="undefined"||!document.createElement) return null;
  const iw=im.naturalWidth||im.width, ih=im.naturalHeight||im.height;
  cv2=document.createElement("canvas"); cv2.width=iw; cv2.height=ih;
  const c2=cv2.getContext("2d"); if(!c2) return null;
  c2.drawImage(im,0,0);
  c2.globalCompositeOperation="source-atop"; c2.globalAlpha=(alpha==null?0.45:alpha);
  c2.fillStyle=color; c2.fillRect(0,0,iw,ih);
  c2.globalCompositeOperation="source-over"; c2.globalAlpha=1;
  _tints[key]=cv2; return cv2;
};
api.preload=function(names){ (names||[]).forEach(n=>api.asset(n)); };

/* -------- audio (synth, no files) -------- */
let _actx=null;
function ac(){ if(!_actx){ try{ _actx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return _actx; }
let _noise=null;
function noiseBuf(){ const c=ac(); if(!c) return null;
  if(!_noise){ _noise=c.createBuffer(1,c.sampleRate*0.6,c.sampleRate);
    const d=_noise.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
  return _noise; }
api.tone=(f,dur,type,vol)=>{ if(_muted)return; const c=ac(); if(!c)return; const t=c.currentTime;
  const o=c.createOscillator(),gn=c.createGain(); o.type=type||"sine"; o.frequency.value=f;
  gn.gain.setValueAtTime(vol||0.2,t); gn.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(gn); gn.connect(c.destination); o.start(t); o.stop(t+dur+0.02); };
api.slide=(f0,f1,dur,vol,type)=>{ if(_muted)return; const c=ac(); if(!c)return; const t=c.currentTime;
  const o=c.createOscillator(),gn=c.createGain(); o.type=type||"sine";
  o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(f1,1),t+dur);
  gn.gain.setValueAtTime(vol||0.4,t); gn.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(gn); gn.connect(c.destination); o.start(t); o.stop(t+dur+0.02); };
api.noise=(dur,vol,freq,ftype,Q)=>{ if(_muted)return; const c=ac(); if(!c)return; const nb=noiseBuf(); if(!nb)return;
  const t=c.currentTime; const n=c.createBufferSource(); n.buffer=nb;
  const f=c.createBiquadFilter(); f.type=ftype||"bandpass"; f.frequency.value=freq||1200; f.Q.value=Q||0.8;
  const gn=c.createGain(); gn.gain.setValueAtTime(vol||0.3,t); gn.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  n.connect(f); f.connect(gn); gn.connect(c.destination); n.start(t); n.stop(t+dur+0.02); };
/* layered "thick" boom: sub-bass thump + mid body + low rumble tail + bright crack.
   足すだけで爽快な低音の手応えが出る共通ヘルパー。power 0..1 で重さを調整。 */
api.boom=(power)=>{ if(_muted)return; const c=ac(); if(!c)return; const p=clamp(power==null?0.6:power,0,1);
  api.slide(135+75*p,40,0.4+0.28*p,0.5,"sine");        // sub-bass thump = weight
  api.slide(300,90,0.2,0.15,"triangle");               // mid body
  api.noise(0.5+0.4*p,0.3,360,"lowpass",0.7);          // low rumble tail
  api.noise(0.06,0.22*p,2800,"highpass",0.9);          // bright crack transient
};

/* -------- celebration fx (紙吹雪 + バナー + ファンファーレ) -------- */
function _celebrate(score){
  for(let i=0;i<76;i++){ const a=rnd(0,TAU), s=rnd(4,12);
    _fx.conf.push({x:api.W*rnd(0.15,0.85), y:api.H*rnd(0.08,0.4),
      vx:Math.cos(a)*s, vy:Math.sin(a)*s-5, s:rnd(6,14),
      col:pick(["#ff5b5b","#ffd23f","#4db8ff","#7be08a","#ff8c42","#ff7bd0","#b58bff","#ffffff"]),
      rot:rnd(0,TAU), vr:rnd(-0.4,0.4), life:1, decay:rnd(0.006,0.012),
      shimmer:rnd(0,TAU), sv:rnd(0.12,0.22)}); }
  _fx.bann={ txt:pick(["すごい！","やったね！","さいこう！","ナイス！","てんさい！"]), life:1 };
  api.shake(14);
  if(!_muted){ [0,4,7,12].forEach((semi,i)=>setTimeout(()=>api.tone(523.25*Math.pow(2,semi/12),0.2,"triangle",0.13),i*70)); }
}
function drawFX(dt){
  for(const c of _fx.conf){ c.vy+=0.35*dt; c.x+=c.vx*dt; c.y+=c.vy*dt; c.rot+=c.vr*dt; c.life-=c.decay*dt;
    c.shimmer+=c.sv*dt; const tw=0.62+0.38*Math.sin(c.shimmer);   // きらめき：軽い明滅
    g.save(); g.globalAlpha=Math.max(0,c.life); g.translate(c.x,c.y); g.rotate(c.rot);
    g.shadowColor=c.col; g.shadowBlur=6*tw*c.life;   // 微発光（紙吹雪が淡く光る）
    g.fillStyle=c.col; g.globalAlpha=Math.max(0,c.life)*tw; g.fillRect(-c.s/2,-c.s/3,c.s,c.s*0.66); g.restore(); }
  _fx.conf=_fx.conf.filter(c=>c.life>0 && c.y<api.H+40);
  if(_fx.bann){ const b=_fx.bann; b.life-=0.012*dt;
    const t=1-b.life, sc=t<0.18?ease(t/0.18):1, fade=clamp(b.life*3,0,1);
    g.save(); g.globalAlpha=fade; g.translate(api.W/2,api.H*0.3); g.scale(sc,sc);
    const hr=clamp(api.W*0.34,140,300), hg=g.createRadialGradient(0,0,0,0,0,hr);   // 柔らかな祝福グロー
    hg.addColorStop(0,"rgba(255,236,150,0.42)"); hg.addColorStop(0.5,"rgba(255,196,60,0.16)"); hg.addColorStop(1,"rgba(255,196,60,0)");
    g.globalCompositeOperation="lighter"; g.fillStyle=hg; g.beginPath(); g.arc(0,0,hr,0,TAU); g.fill();
    g.globalCompositeOperation="source-over"; g.globalAlpha=fade;
    g.font="900 "+Math.round(clamp(api.W*0.11,40,82))+"px 'Hiragino Maru Gothic ProN',system-ui";
    g.textAlign="center"; g.textBaseline="middle";
    g.lineWidth=10; g.strokeStyle="rgba(0,0,0,.55)"; g.strokeText(b.txt,0,0);
    const grd=g.createLinearGradient(0,-40,0,44); grd.addColorStop(0,"#fff2a0"); grd.addColorStop(1,"#ffb000");
    g.fillStyle=grd; g.fillText(b.txt,0,0);
    g.textAlign="left"; g.textBaseline="alphabetic"; g.restore();
    if(b.life<=0) _fx.bann=null; }
}

/* -------- canvas sizing -------- */
function resize(){
  api.dpr=Math.min(window.devicePixelRatio||1,2.5);
  api.W=window.innerWidth; api.H=window.innerHeight;
  cv.width=api.W*api.dpr; cv.height=api.H*api.dpr;
  g.setTransform(api.dpr,0,0,api.dpr,0,0);
  if(_active&&_active.resize) _active.resize();
}
window.addEventListener("resize",resize);

/* -------- main loop (applies screen shake, then game frame) -------- */
function loop(now){
  if(!_running) return;
  let dt=clamp((now-_last)/16.67,0,2.2)||1; _last=now;
  const rdt=dt;
  if(_hitStop>0){ _hitStop-=rdt; dt=0.001; }   // ヒットストップ中はゲーム進行を凍結（描画はする）
  g.setTransform(api.dpr,0,0,api.dpr,0,0);
  g.clearRect(0,0,api.W,api.H);
  g.save();
  if(api.shakeV>0.4){ g.translate(rnd(-api.shakeV,api.shakeV),rnd(-api.shakeV,api.shakeV)); api.shakeV*=0.86; }
  else api.shakeV=0;
  _active.frame(dt,now);
  g.restore();
  if(!_vig||_vigW!==api.W||_vigH!==api.H) buildVignette();
  g.fillStyle=_vig; g.fillRect(0,0,api.W,api.H);   // 質感ビネット（ゲーム描画の上、HUD/祝福の下）
  drawFX(rdt);   // 祝福エフェクトは画面座標で（揺れの影響を受けない）
  _raf=requestAnimationFrame(loop);
}

/* -------- Engine public API -------- */
const Engine = {
  meta:[],      // game metadata (set by registry.js)
  builds:{},    // id -> build(api) (set by each game file)
  setMeta(arr){ this.meta=arr; },
  register(id, fn){ this.builds[id]=fn; },
  start(){ resize(); buildMenu(); },
  launch(def){
    const c=ac(); if(c&&c.state==="suspended") c.resume();
    document.getElementById("menu").classList.add("hide");
    cv.classList.remove("hide");
    document.getElementById("gbar").classList.remove("hide");
    document.getElementById("gTitle").textContent=def.name;
    _fx.conf.length=0; _fx.bann=null; _fx.mileNext=10; _hitStop=0;
    api.setScore(0); resize();
    api.gameId=def.id;
    _active=this.builds[def.id](api);
    api.shakeV=0; _running=true; _last=performance.now(); _raf=requestAnimationFrame(loop);
  },
  exit(){
    _running=false; if(_raf) cancelAnimationFrame(_raf);
    if(_active&&_active.stop) _active.stop(); _active=null;
    cv.classList.add("hide");
    document.getElementById("gbar").classList.add("hide");
    document.getElementById("menu").classList.remove("hide");
  }
};
window.Engine = Engine;

/* -------- menu -------- */
const lockIcon = '<svg class="ic" viewBox="0 0 64 64"><rect x="20" y="28" width="24" height="20" rx="4" fill="rgba(255,255,255,.5)"/><path d="M24 28 v-6 a8 8 0 0 1 16 0 v6" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="4"/></svg>';
function shade(hex,amt){ const c=parseInt(hex.slice(1),16);
  const r=Math.min(255,((c>>16)&255)+amt), gg=Math.min(255,((c>>8)&255)+amt), b=Math.min(255,(c&255)+amt);
  return "#"+((1<<24)+(r<<16)+(gg<<8)+b).toString(16).slice(1); }
function buildMenu(){
  const grid=document.getElementById("grid"); grid.innerHTML="";
  Engine.meta.forEach(m=>{
    const playable=!!Engine.builds[m.id];
    const b=document.createElement("button");
    b.className="card"+(playable?"":" locked");
    b.style.background="linear-gradient(160deg,"+shade(m.color,18)+","+m.color+")";
    b.innerHTML=(playable?m.icon:lockIcon)+'<span class="nm">'+m.name+'</span>'+
      (playable?'<span class="badge new">NEW</span>':'<span class="badge">じゅんび中</span>');
    if(playable) b.addEventListener("click",()=>Engine.launch(m));
    grid.appendChild(b);
  });
}

/* -------- chrome controls -------- */
function evXY(e){ const r=cv.getBoundingClientRect(); return [e.clientX-r.left, e.clientY-r.top]; }
/* iPad: アプリ切替や着信で音が "interrupted/suspended" のまま止まるので、触れたら戻す */
function wakeAudio(){ if(_actx&&_actx.state!=="running"&&_actx.resume) _actx.resume(); }
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) wakeAudio(); });
/* iPad Safari は user-scalable=no を無視するので、2本指ズームはここで止める */
document.addEventListener("gesturestart",e=>e.preventDefault());
cv.addEventListener("pointerdown",e=>{ wakeAudio(); if(_active&&_active.input){ const[x,y]=evXY(e); _active.input(x,y,"down"); } });
cv.addEventListener("pointermove",e=>{ if(_active&&_active.input){ const[x,y]=evXY(e); _active.input(x,y,"move"); } });
window.addEventListener("pointerup",e=>{ if(_active&&_active.input){ const[x,y]=evXY(e); _active.input(x,y,"up"); } });
document.getElementById("backBtn").addEventListener("click",()=>Engine.exit());
/* mute button: canvas/SVG手描きアイコン（文字グリフは使わない＝絵文字混入なし）
   オン=スピーカー＋音波 / オフ=スピーカー＋× */
const _spk='<path d="M4 9 H7.5 L12 5.5 V18.5 L7.5 15 H4 Z" fill="#fff"/>';
const _icoOn ='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'+_spk+
  '<path d="M15.5 8.5 a4.5 4.5 0 0 1 0 7" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>'+
  '<path d="M17.8 6 a8 8 0 0 1 0 12" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>';
const _icoOff='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'+_spk+
  '<path d="M15.5 9 L20.5 15 M20.5 9 L15.5 15" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/></svg>';
const _muteBtn=document.getElementById("muteBtn");
function renderMute(){ _muteBtn.innerHTML=_muted?_icoOff:_icoOn; }
_muteBtn.addEventListener("click",function(){ _muted=!_muted; renderMute(); });
renderMute();
