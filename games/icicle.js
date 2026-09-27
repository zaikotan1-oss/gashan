function build_icicle(api){
  const g=api.g;
  api.preload(["bg.jpg","hut.png","gold.png","icicle.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)
  // ---- all mutable state lives here (build is called multiple times) ----
  let icicles=[],walkers=[],drops=[],shards=[],sparks=[],rings=[],puffs=[],flakes=[],glints=[];
  let count=0,combo=0,comboT=0,tsec=0,flash=0,groundY=0,W=0,H=0;
  let stage=1,stageKill=0,stageGoal=10,clearT=0,clearStage=0,climax=0,novaT=0;
  let spawnT=0,iceTimer=0;
  let fever=0,feverGauge=0,feverBann=0,hsCd=0;   // fever time + hitStop cooldown
  const FEVER_LEN=600;                            // ~10s at 60fps
  const STAGES=5;
  const TC=["#bfe9ff","#9fd6ff","#cfeeff","#e6f6ff","#a8e6ff"];
  // next-stage teaser lines (what shows up in stage N)
  const TEASE=["ゆきだま が いっぱい！","おうち も あるいてくる！","おおきい ボスだま が くるぞ！","みんな はやくなる！","ぜんいん しゅうごう だ！"];
  // ---- 隠し発見レイヤー(crane/hammer/truck と同じ思想) ----
  const SCARF=[{c:"#ff5b5b",n:"あか"},{c:"#ffd23f",n:"きいろ"},{c:"#7be08a",n:"みどり"},{c:"#c78bff",n:"むらさき"},{c:"#ff8fb3",n:"ピンク"}];
  let luckyColor=pick(SCARF).c;                                       // ② きょうのラッキー色(秘密)
  let luckyName=(SCARF.find(s=>s.c===luckyColor)||{}).n||"",luckySeen=false,luckyMsgT=0;
  let rbMsgT=0,rainbowPending=0,rainbowDir=1;                          // ① にじいろだま バナー / 接近予告
  let stageMiss=0,perfectT=0;                                         // ③ パーフェクト(ムダ落とし0)判定
  let moonWink=0,moon={x:0,y:0,r:0};                                  // ④ おつきさま ひみつタップ
  // hitStop is only for combo milestones / big hits, with a 30-frame cooldown
  function hs(frames){if(hsCd>0)return;hsCd=30;api.hitStop(frames);}
  function stageGoalFor(s){return 10+(s-1)*3;}    // 10,13,16,19,22（7〜8歳向けに手応えを増やした）

  function rebuildIcicles(){
    icicles=[];
    const n=clamp(Math.floor(W/110),5,9);
    const margin=W*0.06;
    for(let i=0;i<n;i++){
      const x=margin+(W-margin*2)*(i+0.5)/n;
      icicles.push({x,baseY:H*0.16,len:rnd(46,82),w:rnd(16,26),ready:true,regrow:0,wob:rnd(0,TAU)});
    }
  }
  function buildFlakes(){
    flakes=[];
    for(let i=0;i<70;i++)flakes.push({x:rnd(0,W),y:rnd(0,H),r:rnd(1,3.6),sp:rnd(0.3,1.1),sway:rnd(0,TAU),sv:rnd(0.01,0.03)});
    glints=[];
    for(let i=0;i<26;i++)glints.push({x:rnd(0,W),y:rnd(H*0.5,H*0.96),r:rnd(0.8,2.2),ph:rnd(0,TAU),sp:rnd(0.02,0.06)});
  }
  function layout(){
    W=api.W;H=api.H;groundY=H*0.84;
    moon.x=W*0.74;moon.y=H*0.14;moon.r=Math.max(46,W*0.1);  // ④ お月さまの当たり判定(描画と一致・寛容)
    rebuildIcicles();buildFlakes();
  }
  layout();
  spawnWalker(true);  // 【最優先】ゲーム開始直後の1体目だけ画面内(W*0.25〜0.75)に直接置く。端から歩いてくる待ち時間を無くし、最初の成功までを短くする。2体目以降は従来どおり端スポーン。

  function spawnWalker(direct){
    // a snow-blob or hut walking along the ground(+新形状: そり(sled)・雪だるまタワー(tower))
    const kinds=stage>=3?["blob","blob","hut","big","tower","sled"]:stage>=2?["blob","blob","hut","sled","tower"]:["blob","blob","blob","hut","sled"];
    let kind=pick(kinds);
    // rare golden snowball: fast, shiny, worth a lot (7%)
    if(Math.random()<0.07)kind="gold";
    const dir=Math.random()<0.5?1:-1;
    const r=kind==="big"?rnd(40,48):kind==="tower"?rnd(28,34):kind==="hut"?rnd(36,44):kind==="gold"?rnd(26,32):kind==="sled"?rnd(28,34):rnd(26,36);
    const sp=clamp((kind==="hut"?0.55:kind==="gold"?1.45:kind==="tower"?0.75:kind==="sled"?1.05:0.95)+(stage-1)*0.14,0.4,2.8)*dir;  // 7〜8歳向けに少し速め
    const startX=direct?rnd(W*0.25,W*0.75):(dir>0?-r-10:W+r+10);  // 直接出現(direct)は画面内、それ以外は従来どおり画面端
    walkers.push({x:startX,y:groundY,r,kind,sp,vx:0,rot:0,
      hp:kind==="big"?2:1,bob:rnd(0,TAU),squash:1,dead:false,flash:0,
      col:kind==="hut"?"#8fb8d8":kind==="gold"?"#ffd23f":"#eef6ff",
      scarf:(kind==="blob"||kind==="big"||kind==="tower"||kind==="sled")?pick(SCARF).c:null});  // ② マフラーの色=ラッキー色の手がかり
    if(kind==="gold"){ // "!" chime so it grabs attention the moment it appears
      api.tone(1568,0.09,"triangle",0.1);
      setTimeout(()=>api.tone(2093,0.12,"triangle",0.1),90);
    }
  }

  function spawnRainbow(){
    // ① にじいろだま: 予告のあとに登場する激レア。落とすと虹の大バースト＋大量得点。
    const dir=rainbowDir,r=rnd(28,34);
    const sp=clamp(1.1+(stage-1)*0.1,0.9,2.0)*dir;
    walkers.push({x:dir>0?-r-10:W+r+10,y:groundY,r,kind:"rainbow",sp,
      hp:1,bob:rnd(0,TAU),squash:1,dead:false,flash:0,col:"#ff5b5b",scarf:null});
    api.tone(1568,0.1,"triangle",0.1);
    setTimeout(()=>api.tone(2093,0.12,"triangle",0.1),90);
  }

  function dropIcicle(ic){
    if(!ic.ready)return;
    ic.ready=false;ic.regrow=0;
    drops.push({x:ic.x,y:ic.baseY+ic.len,vy:2,len:ic.len,w:ic.w,wob:0});
    api.slide(900,520,0.12,0.14,"triangle");
    api.tone(1400,0.05,"sine",0.08);
  }

  function smashWalker(wk,hx,hy){
    if(wk.kind==="big"&&wk.hp>1&&fever<=0){   // during fever everything pops in one hit
      wk.hp--;wk.flash=1;wk.squash=0.8;
      api.noise(0.08,0.16,1600,"highpass",0.9);api.tone(360,0.07,"square",0.1);api.shake(4);
      hitFx(hx,hy,"#dfeeff",false,false);return;
    }
    wk.dead=true;wk.squash=1.3;
    const gold=wk.kind==="gold";
    const rainbow=wk.kind==="rainbow";
    const base=rainbow?8:gold?5:wk.kind==="hut"?2:wk.kind==="big"?3:wk.kind==="tower"?2:1;
    // ② ラッキー色: きょうの秘密の色のマフラーを持つ子を落とすと +2 の隠しボーナス
    const isLucky=!rainbow&&!gold&&wk.scarf&&wk.scarf===luckyColor;
    let gain=base*(fever>0?2:1);                 // fever = double points
    if(isLucky)gain+=2;
    count+=gain;stageKill++;api.setScore(count);
    combo++;comboT=1;
    if(fever<=0){
      feverGauge=clamp(feverGauge+(rainbow?0.6:gold?0.5:0.08+base*0.035),0,1);
      if(feverGauge>=1)startFever();
    }
    api.slide(520,170,0.14,0.3,"triangle");
    api.noise(0.16,0.22,2200,"highpass",0.8);
    api.tone(660*Math.pow(2,clamp(combo,0,10)/12),0.12,"triangle",0.12);
    api.boom(gold?0.6:0.42);api.shake(6+Math.min(combo,8));
    flash=Math.min(1,flash+0.4);
    if(rainbow){ // ① にじいろだま: 特大の虹バースト＋ファンファーレ＋大量得点
      rbMsgT=1.4;climax=1;flash=Math.min(1,flash+0.5);hs(5);
      api.boom(0.7);api.shake(16);
      [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.16,"triangle",0.13),i*55));
      hitFx(hx,hy,"#ffffff",true,true);
      const rcol=["#ff5b5b","#ffd23f","#7be08a","#5ad1ff","#c78bff"];
      for(let k=0;k<5;k++)if(rings.length<26)rings.push({x:hx,y:hy,r:16,vr:8+k*1.6,life:1,decay:0.05,col:rcol[k]});
    }else if(gold){ // rainbow burst + fanfare
      climax=1;hs(5);
      [0,4,7,12].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.16,"triangle",0.13),i*60));
      hitFx(hx,hy,"#ffd23f",true,true);
      if(rings.length<26)rings.push({x:hx,y:hy,r:20,vr:11,life:1,decay:0.045,col:"#ffd23f"});
    }else{
      if(combo>=3){climax=Math.min(1,0.5+combo*0.06);hs(combo>=6?4:3);api.tone(240,0.2,"sawtooth",0.06);}
      if(wk.kind==="tower"){
        // ⑤ タワーだけ「へこむ」ではなく横に転がりながら崩れる(倒れる/吹っ飛ぶ)。段ごとに高さをずらして破片を出す。
        wk.vx=(wk.sp>=0?1:-1)*rnd(3.5,6);
        for(let i=0;i<3;i++)hitFx(hx,hy-wk.r*0.7*i,i===2?"#eef6ff":wk.col,i===0,false);
      }else{
        hitFx(hx,hy,wk.col,combo>=5,false);
      }
    }
    // ② ラッキー色 命中: きらっと小さめの祝福＋頭上に星(白飛びしない控えめ)
    if(isLucky){
      luckyMsgT=luckySeen?Math.max(luckyMsgT,0.7):1.6;luckySeen=true;
      api.tone(1046,0.16,"triangle",0.11);api.tone(1568,0.18,"triangle",0.08);
      for(let i=0;i<8;i++){const a=rnd(-TAU*0.5,0),s=rnd(2,5);
        shards.push({x:hx,y:hy-wk.r*0.6,vx:Math.cos(a)*s*0.7,vy:Math.sin(a)*s-2,s:rnd(4,7),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:luckyColor});}
    }
    if(combo>0&&combo%8===0)nova();
    checkStage();
  }

  function startFever(){
    fever=FEVER_LEN;feverGauge=0;feverBann=1.5;climax=1;flash=1;
    api.boom(0.7);api.shake(14);hs(6);
    api.slide(300,1200,0.5,0.2,"sawtooth");
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(523.25*Math.pow(2,s/12),0.18,"triangle",0.14),i*70));
  }

  function hitFx(hx,hy,col,big,rainbow){
    if(rings.length<26){
      rings.push({x:hx,y:hy,r:14,vr:big?9:6,life:1,decay:0.06,col});
      rings.push({x:hx,y:hy,r:8,vr:5,life:1,decay:0.05,col:"#ffffff"});
    }
    const n=Math.min((big?16:11)+Math.min(combo,6),Math.max(0,220-shards.length));
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(2.5,8);
      shards.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(4,10),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.022),
        col:rainbow?("hsl("+((i*37)%360)+",92%,66%)"):(i%3===0?col:(i%3===1?"#ffffff":"#bfe9ff"))});}
    const sn=Math.min(rint(6,9),Math.max(0,80-sparks.length));
    for(let i=0;i<sn;i++){const a=rnd(0,TAU),s=rnd(4,11);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,18),life:1,decay:rnd(0.05,0.09)});}
    if(puffs.length<40)for(let i=0;i<3;i++)puffs.push({x:hx+rnd(-10,10),y:hy+rnd(-6,6),r:rnd(10,20),vr:rnd(0.5,1.3),life:1,decay:rnd(0.014,0.022)});
  }

  function nova(){
    novaT=1;climax=1;api.boom(0.7);api.shake(16);hs(6);
    api.slide(800,160,0.4,0.28,"sawtooth");api.tone(140,0.4,"sawtooth",0.12);
    for(const wk of walkers){
      if(wk.dead)continue;
      wk.dead=true;wk.squash=1.3;count++;stageKill++;
      hitFx(wk.x,wk.y-wk.r*0.5,wk.col,true);
    }
    api.setScore(count);checkStage();
  }

  function checkStage(){
    if(stageKill<stageGoal||clearT>0)return;
    clearStage=stage;clearT=1.6;climax=0.7;api.boom(0.5);api.shake(12);
    api.slide(523,784,0.3,0.2,"triangle");api.tone(660,0.25,"triangle",0.14);
    api.tone(988,0.3,"triangle",0.1);
    for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
      shards.push({x:W/2,y:H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,s:rnd(5,11),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(TC)});}
    // ③ パーフェクト: このステージで つらら を1回もムダ落とし(地面ヒット)しなかったら +3 & 白い星シャワー
    if(stageMiss===0){count+=3;api.setScore(count);perfectT=1.9;api.tone(1318,0.16,"triangle",0.12);
      for(let i=0;i<16;i++){const a=rnd(0,TAU),s=rnd(3,8);
        shards.push({x:W/2,y:H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,s:rnd(5,10),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:"#eaf7ff"});}}
    stageMiss=0;
    if(stage>=STAGES)stage=1;else stage++;
    stageGoal=stageGoalFor(stage);stageKill=0;
  }

  return{
    resize:layout,
    input(x,y,type){
      if(type!=="down")return;
      if(clearT>0)return;
      // ④ おつきさま ひみつタップ: 空(つららより上)のお月さまに触れたら ウインク＋金の粉(減点なし・つらら落としと衝突しない)
      if(y<H*0.19&&Math.hypot(x-moon.x,y-moon.y)<moon.r){
        moonWink=1;api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.08);
        for(let i=0;i<8;i++){const a=rnd(0,TAU),s=rnd(2,5);
          sparks.push({x:moon.x,y:moon.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s+1,len:rnd(6,12),life:1,decay:rnd(0.04,0.07)});}
        for(let i=0;i<6;i++){const a=rnd(0,TAU),s=rnd(1.5,4);
          shards.push({x:moon.x,y:moon.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s+1,s:rnd(4,7),
            rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.014,0.024),col:"#ffe9a0"});}
        return;
      }
      // find nearest ready icicle near the tap (generous, but also tap-anywhere drops nearest)
      // 軸3(b)対策: ステージ1(はじめて遊ぶ回)だけ「X距離を主役・Y距離は弱める」にして選択半径も広げる。
      // 2以降はここを維持して歯ごたえを保つ(全ステージで緩めるとランダム連打まで伸びてしまう＝やり過ぎ)。
      let best=null,bd=1e9;
      const yw=stage===1?0.35:1;
      for(const ic of icicles){
        if(!ic.ready)continue;
        const d=Math.hypot(x-ic.x,(y-(ic.baseY+ic.len*0.5))*yw);
        if(d<bd){bd=d;best=ic;}
      }
      const pickR=stage===1?Math.max(W*0.30,170):Math.max(W*0.20,110);
      if(best&&bd<pickR){dropIcicle(best);return;}
      // tap landed nowhere useful: gentle feedback (no crash on empty)
      api.tone(300,0.05,"triangle",0.05);
    },
    frame(dt,now){
      tsec+=0.016*dt;
      const paused=clearT>0;
      if(hsCd>0)hsCd-=dt;
      if(fever>0&&!paused){
        fever-=dt;
        if(fever<=0){fever=0;api.slide(880,220,0.35,0.14,"sine");}
      }

      // ---------- background: winter sky gradient (画像背景があれば cover 描画・平坦な手描きはスキップ) ----------
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true; }
      else {
        let grd=g.createLinearGradient(0,0,0,H);
        grd.addColorStop(0,"#13294a");grd.addColorStop(0.28,"#2a4f7c");
        grd.addColorStop(0.55,"#5a8fc0");grd.addColorStop(0.8,"#a9d4ec");grd.addColorStop(1,"#e8f6ff");
        g.fillStyle=grd;g.fillRect(0,0,W,H);
      }
      // cold moon glow upper area (お月さまはひみつタップの標的なので画像時も描く。広い光暈だけ弱める)
      const mx=moon.x,my=moon.y,mr=W*0.04;
      let mg=g.createRadialGradient(mx,my,0,mx,my,Math.max(0,W*0.5));
      const mga=imgBg?0.5:1;
      mg.addColorStop(0,"rgba(230,245,255,"+(0.5*mga)+")");mg.addColorStop(0.3,"rgba(200,225,255,"+(0.16*mga)+")");mg.addColorStop(1,"rgba(200,225,255,0)");
      g.fillStyle=mg;g.fillRect(0,0,W,H);
      g.save();g.globalCompositeOperation="lighter";g.shadowColor="rgba(235,248,255,.9)";g.shadowBlur=24;
      g.fillStyle="rgba(245,252,255,.95)";g.beginPath();g.arc(mx,my,mr,0,TAU);g.fill();g.restore();
      // ④ おつきさま ひみつタップ: 叩かれた瞬間だけ ^_^ のウインク顔(発見のごほうび)
      if(moonWink>0){moonWink-=0.018*dt;
        g.save();g.strokeStyle="#7fa8c8";g.lineWidth=Math.max(2,mr*0.16);g.lineCap="round";g.globalAlpha=clamp(moonWink*1.4,0,1);
        g.beginPath();
        g.moveTo(mx-mr*0.44,my-mr*0.04);g.quadraticCurveTo(mx-mr*0.29,my-mr*0.34,mx-mr*0.14,my-mr*0.04);
        g.moveTo(mx+mr*0.14,my-mr*0.04);g.quadraticCurveTo(mx+mr*0.29,my-mr*0.34,mx+mr*0.44,my-mr*0.04);
        g.stroke();
        g.beginPath();g.arc(mx,my+mr*0.14,mr*0.36,0.12*Math.PI,0.88*Math.PI);g.stroke();
        g.restore();g.globalAlpha=1;if(moonWink<0)moonWink=0;}
      // twinkle stars in the dark upper band ※画像背景のときは絵の星空を活かして描かない
      if(!imgBg){
        for(let i=0;i<20;i++){const sx=((i*97+13)%100)/100*W,sy=((i*57+5)%100)/100*H*0.32;
          const tw=0.3+0.5*Math.sin(tsec*2+i*1.6);g.globalAlpha=Math.max(0,tw);
          g.fillStyle="#eaf6ff";g.beginPath();g.arc(sx,sy,Math.max(0,1+0.7*Math.sin(tsec+i)),0,TAU);g.fill();}
        g.globalAlpha=1;
      }

      // ---------- distant snowy hills / snowy ground ※画像背景のときは絵の丘と雪原を活かして描かない ----------
      if(!imgBg){
        g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.moveTo(0,H);
        for(let x=0;x<=W;x+=30)g.lineTo(x,groundY-50+Math.sin(x*0.006+1.5)*22);
        g.lineTo(W,H);g.closePath();g.fill();
        g.fillStyle="rgba(255,255,255,.72)";g.beginPath();g.moveTo(0,H);
        for(let x=0;x<=W;x+=30)g.lineTo(x,groundY-22+Math.sin(x*0.009)*16);
        g.lineTo(W,H);g.closePath();g.fill();
        g.fillStyle="#f4fbff";g.fillRect(0,groundY,W,H-groundY);
        g.fillStyle="rgba(150,195,225,.35)";g.fillRect(0,groundY,W,4);
      } else {
        // 画像時: 歩く高さ(groundY)がわかる うっすら雪面ラインだけ残す(ゲーム要素)
        g.fillStyle="rgba(255,255,255,.28)";g.fillRect(0,groundY,W,3);
      }
      // sparkle glints on the snow
      g.save();g.globalCompositeOperation="lighter";
      for(const gl of glints){gl.ph+=gl.sp*dt;const tw=Math.max(0,Math.sin(gl.ph));
        g.globalAlpha=tw*0.8;g.fillStyle="#ffffff";
        g.beginPath();g.arc(gl.x,gl.y,gl.r*tw,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;

      // ---------- ceiling / ice band (top) ----------
      let cg=g.createLinearGradient(0,0,0,H*0.18);
      cg.addColorStop(0,"rgba(180,220,250,.9)");cg.addColorStop(1,"rgba(120,170,210,.5)");
      g.fillStyle=cg;g.fillRect(0,0,W,H*0.16);

      // ---------- icicles (regrow over time) ----------
      const regrowNeed=fever>0?12:clamp(90-(stage-1)*6,42,90);   // fever: icicles regrow almost instantly
      for(const ic of icicles){
        if(!ic.ready){ic.regrow+=dt;if(ic.regrow>=regrowNeed){ic.ready=true;}}
        ic.wob+=0.05*dt;
        const grow=ic.ready?1:clamp(ic.regrow/regrowNeed,0,1);
        // 軸1(さわって分かるか)対策: ステージ1の最初の10秒だけ、準備完了のつららに薄い光の輪(pulse)を出して触る場所を誘導する(見た目のみ・当たり判定/計測ボットには無関係)
        if(ic.ready&&stage===1&&tsec<10){
          const pulse=0.5+0.5*Math.sin(tsec*4+ic.wob);
          g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.22+0.22*pulse;
          g.fillStyle="#eaf7ff";
          g.beginPath();g.arc(ic.x,ic.baseY+ic.len*grow*0.5,Math.max(0,ic.w*1.8+pulse*6),0,TAU);g.fill();
          g.restore();g.globalAlpha=1;
        }
        drawIcicle(ic.x,ic.baseY,ic.len*grow,ic.w*Math.max(0.25,grow),ic.ready,ic.wob);
      }

      // ---------- spawn walkers (fever: swarm) ----------
      if(!paused){spawnT-=dt;if(spawnT<=0){
        // ① にじいろだま: ステージ2以降、ときどき(約6%)予告を出してから登場(いつ来るか=ドキドキ)
        if(stage>=2&&fever<=0&&rainbowPending<=0&&!walkers.some(w=>w.kind==="rainbow"&&!w.dead)&&Math.random()<0.06){
          rainbowPending=100;rainbowDir=Math.random()<0.5?1:-1;api.tone(988,0.1,"sine",0.06);
        }else spawnWalker();
        spawnT=clamp(70-(stage-1)*9,34,70)*(fever>0?0.4:1);}   // 軸3(c)対策: 外した直後でも次の的が早く来るよう間隔を詰める(7〜8歳向け)
        if(rainbowPending>0){rainbowPending-=dt;if(rainbowPending<=0)spawnRainbow();}}

      // ---------- walkers ----------
      for(const wk of walkers){
        if(!wk.dead){wk.x+=wk.sp*dt;wk.bob+=0.12*dt;
          if((wk.sp>0&&wk.x>W+wk.r+20)||(wk.sp<0&&wk.x<-wk.r-20))wk.dead=true;
        } else {wk.squash+=( -0.06*dt );if(wk.vx){wk.x+=wk.vx*dt;wk.rot=(wk.rot||0)+wk.vx*0.05*dt;}}
        if(wk.flash>0)wk.flash-=0.08*dt;
        drawWalker(wk);
      }
      // remove walkers that died by squash collapse or walked off
      for(let i=walkers.length-1;i>=0;i--){
        const wk=walkers[i];
        if(wk.dead&&wk.squash<=0.2)walkers.splice(i,1);
        else if(wk.dead&&((wk.sp>0&&wk.x>W+wk.r+20)||(wk.sp<0&&wk.x<-wk.r-20)))walkers.splice(i,1);
      }

      // ① にじいろだま 接近予告: 出てくる側の画面ふちに 虹のシェブロン(pulse)
      if(rainbowPending>0){
        const side=rainbowDir>0?1:-1,ex=side>0?18:W-18,yy=groundY-26,pulse=0.5+0.5*Math.sin(tsec*6);
        const rcol=["#ff5b5b","#ffd23f","#7be08a","#5ad1ff","#c78bff"];
        g.save();g.globalAlpha=0.5+0.45*pulse;g.lineWidth=5;g.lineCap="round";g.lineJoin="round";
        for(let k=0;k<3;k++){g.strokeStyle=rcol[k];const ox=ex+side*k*13;
          g.beginPath();g.moveTo(ox-side*12,yy-16);g.lineTo(ox,yy);g.lineTo(ox-side*12,yy+16);g.stroke();}
        g.restore();g.globalAlpha=1;
      }

      // ---------- falling drops: collision + ground ----------
      for(const d of drops){
        d.vy+=0.55*dt;d.y+=d.vy*dt;
        // hit a walker?
        let hit=false;
        for(const wk of walkers){
          if(wk.dead)continue;
          const tipY=d.y;
          const hitR=stage===1?wk.r*1.25:wk.r*0.95;         // ③ ステージ1(はじめて遊ぶ回)だけ判定を緩めて当てやすくする。2以降は現状(0.95)を維持して歯ごたえを保つ。
          const topSpan=wk.kind==="tower"?wk.r*2.7:wk.r*1.6;  // タワーは背が高いので上側の当たり判定も伸ばす
          if(Math.abs(d.x-wk.x)<hitR&&tipY>=wk.y-topSpan&&tipY<=wk.y+wk.r*0.3){
            smashWalker(wk,d.x,wk.y-wk.r*0.6);hit=true;break;
          }
        }
        if(hit){d.done=true;continue;}
        // hit the ground?
        if(d.y>=groundY){
          d.done=true;stageMiss++;   // ③ ムダ落とし = パーフェクト判定のミス
          api.noise(0.12,0.16,1800,"highpass",0.8);api.tone(500,0.06,"triangle",0.07);api.shake(3);
          for(let i=0;i<8;i++){const a=rnd(-Math.PI,0),s=rnd(2,6);
            shards.push({x:d.x,y:groundY,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,s:rnd(3,7),
              rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.02,0.03),col:pick(["#bfe9ff","#ffffff"])});}
          puffs.push({x:d.x,y:groundY,r:14,vr:1.1,life:1,decay:0.02});
        }
        if(!d.done)drawDrop(d);
      }
      drops=drops.filter(d=>!d.done);

      // ---------- puffs (snow poofs) ----------
      for(const p of puffs){p.r+=p.vr*dt;p.life-=p.decay*dt;
        g.globalAlpha=Math.max(0,p.life)*0.5;g.fillStyle="#ffffff";
        g.beginPath();g.arc(p.x,p.y,p.r,0,TAU);g.fill();}
      g.globalAlpha=1;puffs=puffs.filter(p=>p.life>0);

      // ---------- shockwave rings ----------
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);

      // ---------- glint sparks (additive) ----------
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#eaf7ff";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;
      sparks=sparks.filter(sp=>sp.life>0);

      // ---------- ice shards ----------
      for(const s of shards){s.vy+=0.3*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.rot+=s.vr*dt;s.life-=s.decay*dt;
        g.save();g.globalAlpha=Math.max(0,s.life);g.translate(s.x,s.y);g.rotate(s.rot);
        g.shadowColor=s.col;g.shadowBlur=6;g.fillStyle=s.col;
        const r=s.s*(0.6+s.life*0.4);
        g.beginPath();g.moveTo(0,-r);g.lineTo(r*0.5,0);g.lineTo(0,r);g.lineTo(-r*0.5,0);g.closePath();g.fill();
        g.restore();}
      g.globalAlpha=1;g.shadowBlur=0;shards=shards.filter(s=>s.life>0);

      // ---------- falling snow (foreground; turns golden during fever) ----------
      g.fillStyle=fever>0?"#ffe9a0":"#ffffff";
      for(const f of flakes){f.y+=f.sp*dt;f.sway+=f.sv*dt;f.x+=Math.sin(f.sway)*0.4*dt;
        if(f.y>H){f.y=-4;f.x=rnd(0,W);}
        if(f.x<-4)f.x=W;if(f.x>W+4)f.x=0;
        g.globalAlpha=0.5+0.4*Math.sin(f.sway*2);
        g.beginPath();g.arc(f.x,f.y,f.r,0,TAU);g.fill();}
      g.globalAlpha=1;

      // ---------- climax color-wash ----------
      if(climax>0){
        const cw=g.createRadialGradient(W/2,H*0.45,0,W/2,H*0.45,W*0.75);
        cw.addColorStop(0,"rgba(210,240,255,"+(0.5*climax)+")");
        cw.addColorStop(0.5,"rgba(150,200,255,"+(0.26*climax)+")");
        cw.addColorStop(1,"rgba(120,170,255,0)");
        g.save();g.globalCompositeOperation="lighter";g.fillStyle=cw;g.fillRect(0,0,W,H);g.restore();
        climax-=0.06*dt;if(climax<0)climax=0;
      }
      // impact flash
      if(flash>0){flash-=0.06*dt;
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=Math.max(0,flash)*0.25;
        g.fillStyle="#cfeaff";g.fillRect(0,0,W,H);g.restore();g.globalAlpha=1;}

      // ---------- combo text (top-center safe band) ----------
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(W/2,H*0.17);g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(120,200,255,.9)";g.shadowBlur=14;
        g.fillStyle="#bfe9ff";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.7)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }

      // ① にじいろだま! 発見バナー(虹色に色替わり)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.4,rcol=["#ff5b5b","#ffd23f","#7be08a","#5ad1ff","#c78bff"],col=rcol[Math.floor(tsec*6)%rcol.length];
        g.save();g.translate(W/2,H*0.24);g.scale(pop,pop);
        g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.shadowColor=col;g.shadowBlur=18;
        g.fillStyle="#ffffff";g.fillText("にじいろだま!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろだま!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ② ラッキー! バナー(初回は「きょうのラッキー色は◯!」と教える)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        const pop=1+Math.max(0,luckyMsgT-1)*1.2,txt=luckyMsgT>1.1?("きょうのラッキー色は "+luckyName+"!"):("ラッキー! "+luckyName);
        g.save();g.translate(W/2,H*0.30);g.scale(pop,pop);
        g.font="900 24px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.4,0,1);g.shadowColor=luckyColor;g.shadowBlur=13;
        g.fillStyle="#fff7d8";g.fillText(txt,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ パーフェクト! バナー(クリア文字の下=重ねない)
      if(perfectT>0){perfectT-=0.014*dt;
        const pop=1+Math.max(0,perfectT-1.3)*1.4;
        g.save();g.translate(W/2,H*0.62);g.scale(pop,pop);
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(perfectT*1.3,0,1);g.shadowColor="rgba(200,240,255,.9)";g.shadowBlur=16;
        g.fillStyle="#eaf7ff";g.fillText("パーフェクト!",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(120,180,220,.8)";g.strokeText("パーフェクト!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(perfectT<0)perfectT=0;}

      // nova flash
      if(novaT>0){g.save();g.globalAlpha=novaT*0.5;g.fillStyle="#ffffff";
        g.fillRect(0,0,W,H);g.restore();novaT-=0.06*dt;if(novaT<0)novaT=0;}

      // ---------- HUD: stage + gauge (top-center) ----------
      drawHUD();

      // ---------- stage clear banner ----------
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.5;g.fillStyle="#0b1b33";g.fillRect(0,H*0.34,W,H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save();g.translate(W/2,H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(120,200,255,.9)";g.shadowBlur=20;g.fillStyle="#bfe9ff";
        g.fillText("ステージ"+clearStage+" クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア！",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("つぎは ステージ"+(clearStage>=STAGES?1:clearStage+1)+"！",0,42);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=20;}
      }

      // 白飛び防止: 加算(lighter)を必ず通常合成へ戻してフレームを終える(溜まり厳禁)
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
    },
    stop(){}
  };

  // =========== drawing helpers ===========
  function drawIcicle(x,topY,len,w,ready,wob){
    if(len<2)return;
    const sway=ready?Math.sin(wob)*1.2:0;
    g.save();g.translate(x+sway,topY);
    // 画像つらら(太い根元が上・とがった先が下)。長さに合わせて正方形スプライトを中央描画。付け根と先端の星だけ重ねる
    if(api.drawAsset("icicle.png",0,len*0.5,len*1.15,len*1.15,{center:true})){
      g.fillStyle="#bfe3f7";g.beginPath();g.ellipse(0,0,Math.max(0,w*0.6),Math.max(0,w*0.28),0,0,TAU);g.fill();
      if(ready){
        g.save();g.globalCompositeOperation="lighter";
        const tw=0.5+0.5*Math.sin(wob*2);
        g.fillStyle="rgba(230,248,255,"+(0.5+0.4*tw)+")";
        g.beginPath();g.arc(0,len,Math.max(0,2.5+1.5*tw),0,TAU);g.fill();g.restore();
      }
      g.restore();return;
    }
    // body: tapering triangle with rounded base
    const grd=g.createLinearGradient(0,0,0,len);
    grd.addColorStop(0,"#dff2ff");grd.addColorStop(0.5,"#a9d8f5");grd.addColorStop(1,"#7fc0ea");
    g.fillStyle=grd;
    g.beginPath();
    g.moveTo(-w/2,0);
    g.lineTo(w/2,0);
    g.lineTo(w*0.22,len*0.6);
    g.lineTo(0,len);
    g.lineTo(-w*0.22,len*0.6);
    g.closePath();g.fill();
    // glossy highlight stripe
    g.fillStyle="rgba(255,255,255,.55)";
    g.beginPath();g.moveTo(-w*0.18,2);g.lineTo(w*0.02,2);g.lineTo(0,len*0.85);g.lineTo(-w*0.08,len*0.6);g.closePath();g.fill();
    // base attach lump
    g.fillStyle="#bfe3f7";g.beginPath();g.ellipse(0,0,w*0.6,w*0.28,0,0,TAU);g.fill();
    if(ready){
      // ready shimmer star at tip
      g.save();g.globalCompositeOperation="lighter";
      const tw=0.5+0.5*Math.sin(wob*2);
      g.fillStyle="rgba(230,248,255,"+(0.5+0.4*tw)+")";
      g.beginPath();g.arc(0,len,2.5+1.5*tw,0,TAU);g.fill();g.restore();
    }
    g.restore();
  }

  function drawDrop(d){
    g.save();g.translate(d.x,d.y-d.len);
    // 画像つらら(落下中): 少し光るぼかしを添えて描く
    if(api.asset("icicle.png").ready){
      g.shadowColor="rgba(150,210,255,.7)";g.shadowBlur=8;
      api.drawAsset("icicle.png",0,d.len*0.5,d.len*1.15,d.len*1.15,{center:true});
      g.shadowBlur=0;g.restore();return;
    }
    const grd=g.createLinearGradient(0,0,0,d.len);
    grd.addColorStop(0,"#eaf7ff");grd.addColorStop(0.5,"#a9d8f5");grd.addColorStop(1,"#6fb8e6");
    g.fillStyle=grd;g.shadowColor="rgba(150,210,255,.7)";g.shadowBlur=8;
    g.beginPath();
    g.moveTo(-d.w/2,0);g.lineTo(d.w/2,0);g.lineTo(d.w*0.22,d.len*0.6);g.lineTo(0,d.len);g.lineTo(-d.w*0.22,d.len*0.6);
    g.closePath();g.fill();
    g.shadowBlur=0;
    g.fillStyle="rgba(255,255,255,.6)";
    g.beginPath();g.moveTo(-d.w*0.16,2);g.lineTo(d.w*0.02,2);g.lineTo(0,d.len*0.8);g.closePath();g.fill();
    g.restore();
  }

  function drawWalker(wk){
    const r=wk.r,bob=Math.sin(wk.bob)*r*0.06;
    const sq=clamp(wk.squash,0.2,1.4);
    g.save();g.translate(wk.x,wk.y+bob);
    g.scale(1,sq);
    // shadow
    g.fillStyle="rgba(60,100,140,.22)";g.beginPath();g.ellipse(0,r*0.05,r*0.95,r*0.28,0,0,TAU);g.fill();
    // 画像スプライト: おうち(hut) / きんいろだま(gold)。当たり判定 r に合わせて中央描画。
    // (ふつうの雪だま/でかだま/にじいろは マフラー色=ラッキー色の仕掛けがあるので手描きのまま)
    //  hut.png : 家の本体が画像幅の約82%・接地が高さの約92% → 幅 2.3r で家の半幅≒0.94r(当たり半幅0.95r)、
    //            接地点が雪面線の少し下(+0.1r)に来るよう中心を -0.87r に上げる(屋根の先は当たり上端 -1.6r の少し上)
    //  gold.png: 球が画像いっぱい → 直径 2.0r(当たり半幅0.95r)、手描き雪だまと同じ中心 -0.2r
    const sprName=wk.kind==="hut"?"hut.png":wk.kind==="gold"?"gold.png":null;
    if(sprName&&api.asset(sprName).ready){
      const sz=wk.kind==="hut"?r*2.3:r*2.0, cy=wk.kind==="hut"?-r*0.87:-r*0.2;
      api.drawAsset(sprName,0,cy,sz,sz,{center:true,flip:wk.kind==="hut"&&wk.sp<0});
      if(wk.flash>0){g.globalAlpha=wk.flash*0.7;g.fillStyle="#fff";
        g.beginPath();g.arc(0,cy,Math.max(0,r*0.95),0,TAU);g.fill();g.globalAlpha=1;}
      g.restore();return;
    }
    if(wk.kind==="hut"){
      // little snow hut (igloo-ish house)
      const grd=g.createLinearGradient(0,-r*1.1,0,r*0.1);
      grd.addColorStop(0,"#eaf4ff");grd.addColorStop(1,"#b9d4e8");
      g.fillStyle=grd;
      g.beginPath();g.arc(0,-r*0.2,r*0.95,Math.PI,TAU);g.fill();
      g.fillRect(-r*0.95,-r*0.2,r*1.9,r*0.45);
      // door
      g.fillStyle="#5a7a96";g.beginPath();g.arc(0,r*0.25,r*0.3,Math.PI,TAU);g.fill();
      g.fillRect(-r*0.3,r*0.05,r*0.6,r*0.2);
      // snow cap highlight
      g.fillStyle="rgba(255,255,255,.6)";g.beginPath();g.ellipse(-r*0.25,-r*0.7,r*0.3,r*0.16,-0.4,0,TAU);g.fill();
      // brick lines
      g.strokeStyle="rgba(120,160,190,.5)";g.lineWidth=1.5;
      g.beginPath();g.moveTo(-r*0.7,-r*0.2);g.lineTo(r*0.7,-r*0.2);
      g.moveTo(-r*0.55,-r*0.55);g.lineTo(r*0.55,-r*0.55);g.stroke();
    } else if(wk.kind==="sled"){
      // ⑦ 横長の「そり」(乗り物カテゴリ): 丸い雪玉と違う形・壊れ方の対象
      const sw=r*1.6,sh=r*0.6;
      g.fillStyle="#c8663a";g.beginPath();g.ellipse(0,r*0.05,Math.max(0,sw*0.55),Math.max(0,sh*0.55),0,0,TAU);g.fill();
      g.strokeStyle="#8a4a28";g.lineWidth=Math.max(2,r*0.08);g.lineCap="round";
      g.beginPath();g.moveTo(-sw*0.5,r*0.3);g.lineTo(sw*0.55,r*0.3);g.stroke();
      // 乗っている雪だま(顔つき)
      const rg=g.createRadialGradient(-r*0.15,-r*0.5,Math.max(0,r*0.1),0,-r*0.3,Math.max(0,r*0.8));
      rg.addColorStop(0,"#ffffff");rg.addColorStop(0.6,wk.col);rg.addColorStop(1,"#cfe2f0");
      g.fillStyle=rg;g.beginPath();g.arc(0,-r*0.35,r*0.55,0,TAU);g.fill();
      if(wk.scarf){g.fillStyle=wk.scarf;g.beginPath();g.ellipse(0,r*0.02,r*0.42,r*0.13,0,0,TAU);g.fill();}
      const blinkS=Math.sin(wk.bob*0.5)>0.97?0.15:1;
      g.fillStyle="#26415a";
      g.beginPath();g.ellipse(-r*0.18,-r*0.42,r*0.08,Math.max(0,r*0.1*blinkS),0,0,TAU);g.fill();
      g.beginPath();g.ellipse(r*0.18,-r*0.42,r*0.08,Math.max(0,r*0.1*blinkS),0,0,TAU);g.fill();
      g.strokeStyle="#26415a";g.lineWidth=Math.max(2,r*0.05);g.lineCap="round";
      g.beginPath();g.arc(0,-r*0.28,r*0.16,0.12*Math.PI,0.88*Math.PI);g.stroke();
    } else if(wk.kind==="tower"){
      // ⑦ 3段重ねの「雪だるまタワー」(積み重なった物カテゴリ)
      if(wk.rot){g.save();g.rotate(clamp(wk.rot,-0.6,0.6));}
      const segR=[r*0.62,r*0.48,r*0.36];
      const segY=[-r*0.05,-r*0.05-segR[0]-segR[1]*0.55,-r*0.05-segR[0]-segR[1]*1.15-segR[2]*0.55];
      for(let i=0;i<3;i++){
        const tg=g.createRadialGradient(-segR[i]*0.3,segY[i]-segR[i]*0.3,Math.max(0,segR[i]*0.1),0,segY[i],Math.max(0,segR[i]*1.2));
        tg.addColorStop(0,"#ffffff");tg.addColorStop(0.6,wk.col);tg.addColorStop(1,"#cfe2f0");
        g.fillStyle=tg;g.beginPath();g.arc(0,segY[i],Math.max(0,segR[i]),0,TAU);g.fill();
      }
      if(wk.scarf){g.fillStyle=wk.scarf;
        g.beginPath();g.ellipse(0,segY[0]-segR[0]*0.55,segR[0]*0.75,segR[0]*0.22,0,0,TAU);g.fill();}
      // 小枝の腕(生き物らしさ)
      g.strokeStyle="#7a5230";g.lineWidth=Math.max(2,r*0.05);g.lineCap="round";
      g.beginPath();g.moveTo(-segR[1]*0.9,segY[1]);g.lineTo(-segR[1]*1.6,segY[1]-segR[1]*0.5);
      g.moveTo(segR[1]*0.9,segY[1]);g.lineTo(segR[1]*1.6,segY[1]-segR[1]*0.5);g.stroke();
      // 顔(いちばん上の段)
      const topY=segY[2],blinkT=Math.sin(wk.bob*0.5)>0.97?0.15:1;
      g.fillStyle="#26415a";
      g.beginPath();g.ellipse(-segR[2]*0.32,topY-segR[2]*0.1,segR[2]*0.13,Math.max(0,segR[2]*0.16*blinkT),0,0,TAU);g.fill();
      g.beginPath();g.ellipse(segR[2]*0.32,topY-segR[2]*0.1,segR[2]*0.13,Math.max(0,segR[2]*0.16*blinkT),0,0,TAU);g.fill();
      g.strokeStyle="#26415a";g.lineWidth=Math.max(2,r*0.06);g.lineCap="round";
      g.beginPath();g.arc(0,topY+segR[2]*0.1,segR[2]*0.28,0.12*Math.PI,0.88*Math.PI);g.stroke();
      if(wk.rot)g.restore();
    } else {
      // snow blob (cute round critter)
      const grd=g.createRadialGradient(-r*0.3,-r*0.5,r*0.1,0,-r*0.2,r*1.2);
      grd.addColorStop(0,"#ffffff");grd.addColorStop(0.6,wk.col);grd.addColorStop(1,"#cfe2f0");
      g.fillStyle=grd;g.beginPath();g.arc(0,-r*0.2,r*0.9,0,TAU);g.fill();
      // ① にじいろだま: 体に虹のしま模様(クリップして球体になじませる)
      if(wk.kind==="rainbow"){
        const rc=["#ff5b5b","#ff8c42","#ffd23f","#7be08a","#5ad1ff","#c78bff"];
        g.save();g.beginPath();g.arc(0,-r*0.2,r*0.9,0,TAU);g.clip();g.globalAlpha=0.55;
        for(let i=0;i<rc.length;i++){g.fillStyle=rc[i];
          g.fillRect(-r,-r*0.2-r*0.9+i*(r*1.8/rc.length),r*2,r*1.8/rc.length+1);}
        g.restore();g.globalAlpha=1;}
      // big variant: spiky frost crown
      if(wk.kind==="big"){
        g.fillStyle="#dcecf8";
        for(let i=0;i<5;i++){const a=Math.PI+ i*Math.PI/4;
          g.beginPath();g.moveTo(Math.cos(a)*r*0.6,-r*0.2+Math.sin(a)*r*0.6);
          g.lineTo(Math.cos(a)*r*1.0,-r*0.2+Math.sin(a)*r*1.0);
          g.lineTo(Math.cos(a+0.25)*r*0.6,-r*0.2+Math.sin(a+0.25)*r*0.6);g.closePath();g.fill();}
        g.fillStyle=grd;g.beginPath();g.arc(0,-r*0.2,r*0.9,0,TAU);g.fill();
      }
      // ② ラッキー色の手がかり: 首もとの小さなマフラー(色つき・crownの上に描いて big でも見える)
      if(wk.scarf){g.fillStyle=wk.scarf;
        g.beginPath();g.ellipse(0,r*0.42,r*0.7,r*0.2,0,0,TAU);g.fill();
        g.fillRect(r*0.28,r*0.42,r*0.16,r*0.34);}
      // eyes
      const blink=Math.sin(wk.bob*0.5)>0.97?0.15:1;
      g.fillStyle="#26415a";
      g.beginPath();g.ellipse(-r*0.3,-r*0.3,r*0.11,r*0.14*blink,0,0,TAU);g.fill();
      g.beginPath();g.ellipse(r*0.3,-r*0.3,r*0.11,r*0.14*blink,0,0,TAU);g.fill();
      g.fillStyle="#fff";g.beginPath();g.arc(-r*0.26,-r*0.35,r*0.04,0,TAU);g.arc(r*0.34,-r*0.35,r*0.04,0,TAU);g.fill();
      // cheeks + smile
      g.fillStyle="rgba(140,190,230,.45)";g.beginPath();
      g.arc(-r*0.45,-r*0.12,r*0.12,0,TAU);g.arc(r*0.45,-r*0.12,r*0.12,0,TAU);g.fill();
      g.strokeStyle="#26415a";g.lineWidth=Math.max(2,r*0.06);g.lineCap="round";
      g.beginPath();g.arc(0,-r*0.16,r*0.22,0.12*Math.PI,0.88*Math.PI);g.stroke();
    }
    // hit flash overlay
    if(wk.flash>0){g.globalAlpha=wk.flash*0.7;g.fillStyle="#fff";
      g.beginPath();g.arc(0,-r*0.2,r*0.95,0,TAU);g.fill();g.globalAlpha=1;}
    g.restore();
  }

  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(W*0.6,360),bh=16,bx=(W-bw)/2,by=H*0.045;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(0,0,0,.5)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+" / "+STAGES+"      あと "+left+" こ",W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,0,0,.3)";rrect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#9fd6ff");gg.addColorStop(1,"#eaf7ff");
      g.fillStyle=gg;rrect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;rrect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }
  function rrect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
}
Engine.register("icicle", build_icicle);
