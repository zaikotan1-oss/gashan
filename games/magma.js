function buildMagma(api){
  const g=api.g;
  api.preload(["bg.jpg","blob.png","rock.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)
  let holes=[],targets=[],shards=[],rings=[],sparks=[],embers=[],bubbles=[],heatT=0,tG=0;
  let R,spawnT=0,count=0,combo=0,comboT=0,climax=0,flash=0,lastHS=-999;
  // fever time (B) + rare rainbow magma (A)
  const FEVER_LEN=560;
  let fever=0,feverGauge=0,feverBanner=0;
  // stage progression
  const STAGES=5;
  let stage=1,stageKill=0,stageGoal=8,clearT=0,clearStage=0,endingT=0;
  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマー/トラックと同じ思想) ----
  let luckyHole=-1,luckyMsgT=0,luckySeen=false;   // ② きょうのラッキーあな: 秘密の1つの穴。そこから出たマグマを倒すとボーナス
  let rbMsgT=0,rbTeleT=0,rbPending=0;             // ① にじいろマグマ 予告(ドキドキ)+発見バナー
  let stageEscape=0,perfectT=0;                    // ③ パーフェクト判定: このステージで1匹も逃がさなかったか
  let craterWink=0,coins=[];                       // ④ クレーターひみつタップ + こぼれコイン
  const craterHit={x:0,y:0,r:0};                   // ④ クレーターの当たり判定(layoutで確定)
  // per-stage palette: sky and lava tint shift each stage (volcano moods)
  const STAGE_BG=[
    {sky:"#3a1206",mid:"#7a2208",lo:"#c24410",lava:"#ff6a1a",glow:"#ff8a2a"}, // dusk volcano
    {sky:"#2a0a12",mid:"#6e1428",lo:"#b8284a",lava:"#ff3b5e",glow:"#ff5b7a"}, // crimson
    {sky:"#1a0822",mid:"#4a1450",lo:"#8a2a8a",lava:"#ff7adf",glow:"#ff9ae6"}, // violet ash
    {sky:"#04101e",mid:"#0a2a4a",lo:"#1a5a8a",lava:"#ffb020",glow:"#ffd060"}, // night fire
    {sky:"#1a0a02",mid:"#5a2606",lo:"#c26410",lava:"#ffd23f",glow:"#ffe680"}  // golden eruption
  ];
  function stageGoalFor(s){return 10+(s-1)*4;}   // 10,14,18,22,26（7〜8歳向けに手応えを増やした）
  function curBg(){return STAGE_BG[(stage-1)%STAGE_BG.length];}
  function layout(){
    const cols=3,rows=3;
    R=clamp(Math.min(api.W/(cols+1),api.H/(rows+2))*0.36,28,62);
    holes=[];
    const gw=api.W*0.82,gx=(api.W-gw)/2,gh=api.H*0.46,gy=api.H*0.30;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)
      holes.push({x:gx+gw*(c+0.5)/cols,y:gy+gh*(r+0.5)/rows,occ:false,glow:rnd(0,TAU)});
    targets.forEach(t=>{const h=holes[t.hi];if(h){t.x=h.x;t.baseY=h.y;}});
    bubbles=[];for(let i=0;i<26;i++)bubbles.push({x:rnd(0,api.W),y:rnd(api.H*0.6,api.H),r:rnd(3,10),sp:rnd(0.2,0.7),ph:rnd(0,TAU)});
    // ④ クレーターひみつタップの当たり判定(上部中央の噴火口・描画位置と一致・寛容に大きめ)
    craterHit.x=api.W*0.5;craterHit.y=api.H*0.12;craterHit.r=Math.max(44,api.W*0.12);
  }
  layout();
  luckyHole=rint(0,holes.length-1);   // ② セッションごとに秘密のラッキーあなを1つ選ぶ
  function pickType(){
    if(rbPending>0){rbPending--;return "rainbow";} // ① 予告のあとは確定でにじいろ
    if(Math.random()<0.07)return "rainbow"; // rare! big bonus + fanfare
    const bag=["blob","blob","blob","critter"]; // ⑦ 丸ブロブ一辺倒を避け、生き物型を早くから混ぜる
    if(stage>=2)bag.push("rock");          // hard black rock: 2 taps
    if(stage>=3){bag.push("rock");bag.push("gold");} // shiny gold magma = bonus
    if(stage>=4){bag.push("rock");bag.push("critter");}
    let type=pick(bag);
    // ⑦ 大岩: stage3以降、岩の一部(20%)を一回り大きい・耐久3の『大岩』にして大小のコントラストを作る
    if(type==="rock"&&stage>=3&&Math.random()<0.2)type="bigrock";
    return type;
  }
  function spawn(){
    const free=holes.map((h,i)=>i).filter(i=>!holes[i].occ);
    if(!free.length)return;
    const hi=pick(free);holes[hi].occ=true;
    const dur=clamp(1320-(stage-1)*160,680,1320);   // 出ている時間を少し短く(7〜8歳向け)
    const rawType=pickType();
    const big=rawType==="bigrock";
    const type=big?"rock":rawType;
    let hp=1,life=dur,rScale=1;
    if(type==="rock"){hp=fever>0?1:(big?3:2);if(big)rScale=1.4;}   // fever: everything pops in 1 tap
    else if(type==="gold")life=dur*0.6;
    else if(type==="rainbow"){life=dur*0.7;
      // eye-catching entrance: sparkle chime so kids look up immediately
      api.tone(1568,0.1,"triangle",0.1);api.tone(2093,0.14,"triangle",0.08);}
    targets.push({hi,x:holes[hi].x,baseY:holes[hi].y,up:0,state:"rise",
      type,big,rScale,hp,life,squash:1,blink:999,bob:rnd(0,TAU),flash:0,wob:rnd(0,TAU)});
  }
  function hitFx(hx,hy,big,col,type){
    rings.push({x:hx,y:hy,r:R*0.5,vr:R*0.55,life:1,decay:0.06,col:col||"#ff8a2a"});
    rings.push({x:hx,y:hy,r:R*0.2,vr:R*0.4,life:1,decay:0.05,col:"#fff2c2"});
    const n=Math.min((big?16:10)+Math.min(combo,6),Math.max(0,150-shards.length));
    const isRock=type==="rock",isCritter=type==="critter";
    for(let i=0;i<n;i++){
      let vx,vy;
      if(isRock){ // ⑦ 岩は重力で下に崩れ落ちる感じ(上向きの初速を抑え気味に)
        const a=rnd(Math.PI*0.12,Math.PI*0.88),s=rnd(2,7);
        vx=Math.cos(a)*s*0.6;vy=Math.abs(Math.sin(a))*s*0.55+rnd(0,2);
      }else if(isCritter){ // ⑦ 生き物は横に大きく吹っ飛ぶ
        vx=(Math.random()<0.5?-1:1)*rnd(4.5,10);vy=rnd(-4,1);
      }else{const a=rnd(0,TAU),s=rnd(2.5,8);vx=Math.cos(a)*s;vy=Math.sin(a)*s-3;}
      shards.push({x:hx,y:hy,vx,vy,r:rnd(3,7.5),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.014,0.024),
        col:i%3===0?(col||"#ff6a1a"):(i%3===1?"#ffd23f":"#ff3b1a")});}
    for(let i=0;i<rint(6,10);i++){const a=rnd(0,TAU),s=rnd(4,11);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,18),life:1,decay:rnd(0.05,0.09)});}
  }
  function spawnEmbers(hx,hy,n){
    for(let i=0;i<n;i++){const a=rnd(-TAU/4-0.6,-TAU/4+0.6),s=rnd(3,8);
      embers.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(1.5,3.5),life:1,decay:rnd(0.01,0.02)});}
  }
  function luckyStar(hx,hy){
    // ② ラッキーあな 命中: きらっと小さめの祝福(白飛びしないよう控えめ・shardsで加算負荷を増やさない)
    api.tone(1318,0.12,"triangle",0.1);api.tone(1976,0.14,"triangle",0.07);
    const room=Math.max(0,150-shards.length);
    for(let i=0;i<Math.min(6,room);i++){const a=rnd(-TAU*0.5,0),s=rnd(2,5);
      shards.push({x:hx,y:hy,vx:Math.cos(a)*s*0.6,vy:Math.sin(a)*s-2,r:rnd(3,6),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:"#ffe680"});}
  }
  function perfectShower(){
    // ③ パーフェクト: みどり&きんの星シャワー(祝福)
    const room=Math.max(0,150-shards.length);
    for(let i=0;i<Math.min(16,room);i++){const a=rnd(0,TAU),s=rnd(3,8);
      shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(4,8),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:i%2?"#ffe680":"#7be08a"});}
    api.tone(1318,0.16,"triangle",0.12);api.tone(1976,0.18,"triangle",0.08);
  }
  function checkStage(){
    if(stageKill<stageGoal||clearT>0||endingT>0)return;
    // ③ パーフェクト判定: このステージで1匹も逃がしていなければボーナス
    const perfect=stageEscape===0;
    if(stage>=STAGES){
      endingT=2.4;climax=1;flash=1;api.boom(0.7);api.shake(18);
      api.slide(523,1046,0.5,0.22,"triangle");
      if(perfect){count+=3;api.setScore(count);perfectT=1.9;perfectShower();}
    }else{
      clearStage=stage;clearT=1.6;climax=0.7;flash=0.7;api.boom(0.5);api.shake(12);
      api.slide(440,720,0.3,0.2,"triangle");api.tone(660,0.25,"triangle",0.14);
      for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(["#ff6a1a","#ffd23f","#ff3b5e"])});}
      if(perfect){count+=3;api.setScore(count);perfectT=1.9;perfectShower();}
      stage++;stageGoal=stageGoalFor(stage);stageKill=0;stageEscape=0;
    }
  }
  function rainbowBurst(hx,hy){
    // rainbow rings + glowing multicolor shards + fanfare
    for(let i=0;i<4;i++)rings.push({x:hx,y:hy,r:R*(0.3+i*0.2),vr:R*(0.4+i*0.12),life:1,
      decay:0.045,col:"hsl("+((tG*9+i*90)%360)+",95%,65%)"});
    const room=Math.max(0,150-shards.length);
    for(let i=0;i<Math.min(22,room);i++){const a=rnd(0,TAU),s=rnd(3,9);
      shards.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3.5,r:rnd(3.5,8),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.02),
        col:"hsl("+rint(0,359)+",95%,62%)"});}
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(784*Math.pow(2,s/12),0.16,"triangle",0.13),i*65));
    climax=1;flash=1;api.boom(0.55);api.shake(12);rbMsgT=1.5;   // ① 発見バナー
  }
  function startFever(){
    feverGauge=0;fever=FEVER_LEN;feverBanner=1.7;climax=1;flash=1;
    // everything already on the field pops in one tap during fever
    for(const t of targets)if(t.type==="rock")t.hp=1;
    api.boom(0.65);api.shake(16);api.slide(392,1568,0.5,0.24,"sawtooth");
    [0,4,7,12].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.16,"triangle",0.13),i*70));
    if(tG-lastHS>30){api.hitStop(4);lastHS=tG;}
  }
  function smash(t){
    if(t.type==="rock"&&t.hp>1&&fever<=0){
      t.hp--;t.flash=1;t.squash=0.82;combo++;comboT=0.9;
      api.slide(220,150,0.08,0.2,"square");api.noise(0.07,0.14,1200);api.shake(4);
      hitFx(t.x,t.baseY-R*0.5,false,"#888",t.type);spawnEmbers(t.x,t.baseY-R*0.6,5);return;
    }
    t.state="smashed";t.squash=1;holes[t.hi].occ=false;
    let gain=t.type==="gold"?3:t.type==="rainbow"?5:1;
    // ② きょうのラッキーあな: 秘密の1つの穴から出たマグマを倒すと隠しボーナス+頭上に星のキラッ
    const isLucky=t.type!=="rainbow"&&t.hi===luckyHole;
    if(isLucky){gain+=1;luckyMsgT=luckySeen?Math.max(luckyMsgT,0.7):1.6;luckySeen=true;}
    if(fever>0)gain*=2;                    // fever = double points
    count+=gain;stageKill++;api.setScore(count);combo++;comboT=0.9;
    const col=t.type==="rainbow"?"hsl("+((tG*9)%360)+",95%,65%)":t.type==="gold"?"#ffd23f":t.type==="critter"?"#7be08a":curBg().lava;
    api.slide(320,120,0.12,0.32,"square");api.noise(0.1,0.2,1600,"lowpass",0.8);
    api.tone(440*Math.pow(2,clamp(combo,0,10)/12),0.12,"triangle",0.12);api.boom(0.45);
    api.shake(6+Math.min(combo,8));flash=Math.min(1,flash+0.35);
    if(tG-lastHS>30){api.hitStop(2);lastHS=tG;}
    spawnEmbers(t.x,t.baseY-R*0.6,8);
    if(t.type==="gold"){api.tone(1046,0.18,"triangle",0.14);api.tone(1318,0.2,"triangle",0.1);}
    if(t.type==="rainbow")rainbowBurst(t.x,t.baseY-R*0.5);
    if(isLucky)luckyStar(t.x,t.baseY-R*1.15);
    if(combo>=3){climax=Math.min(1,0.5+combo*0.06);api.tone(200,0.22,"sawtooth",0.07);
      if((combo===5||combo===10)&&tG-lastHS>30){api.hitStop(4);lastHS=tG;}}
    hitFx(t.x,t.baseY-R*0.5,combo>=5,col,t.type);
    // fever gauge builds while not in fever ("もう一度あれを出したい")
    if(fever<=0){feverGauge+=t.type==="rainbow"?0.3:0.075;
      if(feverGauge>=1)startFever();}
    checkStage();
  }
  return{
    resize:layout,
    input(px,py,type){
      if(type!=="down"||clearT>0||endingT>0)return;
      // forgiving auto-aim: hit the nearest live target within a generous radius
      let best=null,bd=1e9;
      for(let i=targets.length-1;i>=0;i--){const t=targets[i];
        if(t.state==="smashed"||t._dead)continue;
        const ty=t.baseY-t.up*R*1.6;
        const d=Math.hypot(px-t.x,py-ty);
        if(d<bd){bd=d;best=t;}}
      if(best&&bd<R*2.6){smash(best);return;}
      // ④ クレーターひみつタップ: マグマに当たらなかったタップが噴火口に届いたら、コインがこぼれる(減点なし)
      if(craterHit.r>0&&Math.hypot(px-craterHit.x,py-craterHit.y)<craterHit.r){
        craterWink=1;api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.08);
        for(let i=0;i<8;i++){const a=rnd(-TAU*0.5,0),s=rnd(2.5,6);
          coins.push({x:craterHit.x+rnd(-20,20),y:craterHit.y,vx:Math.cos(a)*s*0.6,vy:Math.sin(a)*s-1.5,
            r:rnd(4,7),rot:rnd(0,TAU),vr:rnd(-0.2,0.2),life:1,decay:0.012});}
        if(coins.length>40)coins.splice(0,coins.length-40);
        return;
      }
      // miss: small puff where tapped
      api.slide(200,120,0.05,0.12,"square");
      for(let i=0;i<5;i++){const a=rnd(0,TAU),s=rnd(2,5);
        sparks.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(6,12),life:1,decay:rnd(0.06,0.1)});}
    },
    frame(dt,now){
      tG+=dt;heatT+=0.03*dt;
      // ① にじいろ 予告: たまに「なにか くる…！」と噴火口が脈打ってから、確定でにじいろが出る(発見のドキドキ)
      if(rbTeleT<=0&&rbPending<=0&&fever<=0&&clearT<=0&&endingT<=0&&Math.random()<0.004){rbTeleT=72;api.tone(1046,0.1,"sine",0.05);}
      if(rbTeleT>0){const pv=rbTeleT;rbTeleT-=dt;
        if(Math.floor(pv/16)!==Math.floor(rbTeleT/16))api.tone(880+(72-rbTeleT)*7,0.06,"triangle",0.05);
        if(rbTeleT<=0){rbTeleT=0;rbPending=1;api.tone(1760,0.12,"triangle",0.09);}}
      const bg=curBg();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージのパレット色を薄く重ねて面ごとの雰囲気を変える(1面=夕方の火山はそのまま)
        if(stage!==1){g.save();g.globalAlpha=0.28;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,bg.sky);tg.addColorStop(0.5,bg.mid);tg.addColorStop(1,bg.lava);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        // sky-to-magma vertical gradient
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,bg.sky);grd.addColorStop(0.34,bg.mid);
        grd.addColorStop(0.66,bg.lo);grd.addColorStop(1,bg.lava);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
        // distant volcano silhouette + erupting glow at top ※画像背景のときは絵の火山を活かして描かない
        g.fillStyle="rgba(0,0,0,.32)";
        g.beginPath();g.moveTo(0,api.H*0.42);
        g.lineTo(api.W*0.32,api.H*0.16);g.lineTo(api.W*0.40,api.H*0.20);
        g.lineTo(api.W*0.50,api.H*0.10);g.lineTo(api.W*0.60,api.H*0.20);
        g.lineTo(api.W*0.70,api.H*0.16);g.lineTo(api.W,api.H*0.40);
        g.lineTo(api.W,api.H*0.5);g.lineTo(0,api.H*0.5);g.closePath();g.fill();
      }
      // crater glow
      let cg=g.createRadialGradient(api.W*0.5,api.H*0.12,0,api.W*0.5,api.H*0.12,api.W*0.3);
      cg.addColorStop(0,"rgba(255,150,40,.5)");cg.addColorStop(0.4,"rgba(255,90,20,.2)");cg.addColorStop(1,"rgba(255,90,20,0)");
      g.save();g.globalCompositeOperation="lighter";g.fillStyle=cg;g.fillRect(0,0,api.W,api.H);g.restore();
      // ① 予告中は噴火口が虹色に脈打つ(なにか来る合図・短時間かつ低頻度なので溜まらない)
      if(rbTeleT>0){const pr=1-rbTeleT/72,pulse=0.5+0.5*Math.sin(tG*0.5);
        const rr=Math.max(0,api.W*0.16*(0.6+pr*0.6));
        const pg=g.createRadialGradient(craterHit.x,craterHit.y,0,craterHit.x,craterHit.y,rr);
        pg.addColorStop(0,"hsla("+((tG*9)%360)+",100%,70%,"+(0.28*pulse)+")");
        pg.addColorStop(1,"hsla("+((tG*9)%360)+",100%,60%,0)");
        g.save();g.globalCompositeOperation="lighter";g.fillStyle=pg;
        g.beginPath();g.arc(craterHit.x,craterHit.y,rr,0,TAU);g.fill();g.restore();g.globalAlpha=1;}
      // rising heat shimmer bands (cheap) ※画像背景のときは平坦な帯が絵と喧嘩するので描かない
      if(!imgBg){g.save();g.globalCompositeOperation="lighter";
      for(let i=0;i<4;i++){const yy=api.H*(0.55+i*0.1)+Math.sin(heatT+i)*6;
        g.globalAlpha=0.05+0.03*Math.sin(heatT*1.4+i);g.fillStyle=bg.glow;
        g.fillRect(0,yy,api.W,api.H*0.04);}
      g.restore();g.globalAlpha=1;}
      // lava bubbles bobbing along bottom
      g.save();g.globalCompositeOperation="lighter";
      for(const b of bubbles){b.ph+=0.05*dt;b.y-=b.sp*dt;if(b.y<api.H*0.55)b.y=api.H+rnd(0,30);
        const bx=b.x+Math.sin(b.ph)*4;g.globalAlpha=0.18+0.12*Math.sin(b.ph*1.3);
        g.fillStyle=bg.glow;g.beginPath();g.arc(bx,b.y,b.r,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      // floating embers / fire sparks ambient
      if(embers.length<60&&Math.random()<0.5)embers.push({x:rnd(0,api.W),y:api.H+10,vx:rnd(-0.5,0.5),vy:-rnd(0.6,1.8),r:rnd(1,3),life:1,decay:rnd(0.004,0.009)});
      g.save();g.globalCompositeOperation="lighter";
      for(const e of embers){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy*=0.99;e.life-=e.decay*dt;
        g.globalAlpha=Math.max(0,e.life);g.fillStyle="#ffb84a";g.shadowColor="#ff7a1a";g.shadowBlur=8;
        g.beginPath();g.arc(e.x,e.y,e.r,0,TAU);g.fill();}
      g.shadowBlur=0;g.restore();g.globalAlpha=1;
      embers=embers.filter(e=>e.life>0&&e.y>-20);
      // holes (glowing magma vents)
      for(const h of holes){
        h.glow+=0.04*dt;const gp=0.6+0.4*Math.sin(h.glow);
        // dark vent
        g.fillStyle="rgba(0,0,0,.45)";g.beginPath();g.ellipse(h.x,h.y+R*0.72,R*1.12,R*0.54,0,0,TAU);g.fill();
        g.fillStyle="#1a0a04";g.beginPath();g.ellipse(h.x,h.y+R*0.7,R*0.94,R*0.44,0,0,TAU);g.fill();
        // inner lava glow
        g.save();g.globalCompositeOperation="lighter";
        const lg=g.createRadialGradient(h.x,h.y+R*0.7,0,h.x,h.y+R*0.7,R*0.9);
        lg.addColorStop(0,"rgba(255,160,50,"+(0.5*gp)+")");lg.addColorStop(0.5,"rgba(255,80,20,"+(0.2*gp)+")");lg.addColorStop(1,"rgba(255,80,20,0)");
        g.fillStyle=lg;g.beginPath();g.ellipse(h.x,h.y+R*0.7,R*0.8,R*0.4,0,0,TAU);g.fill();g.restore();
        // hot rim
        g.strokeStyle="rgba(255,140,60,.4)";g.lineWidth=2.5;
        g.beginPath();g.ellipse(h.x,h.y+R*0.66,R*0.96,R*0.46,0,Math.PI*1.05,Math.PI*1.95);g.stroke();
        // ② ラッキーあなの ちいさな ヒント: ときどき 星が キラッ(気づけるように・控えめ)
        if(holes.indexOf(h)===luckyHole){const tw=Math.sin(h.glow*1.3)*0.5+0.5;
          if(tw>0.74){const sy=h.y-R*0.9,sr=Math.max(2,R*0.16*tw);
            g.save();g.globalAlpha=(tw-0.74)*2.8;g.fillStyle="#fff2c2";g.shadowColor="#ffe680";g.shadowBlur=8;
            g.beginPath();g.moveTo(h.x,sy-sr);g.lineTo(h.x+sr*0.3,sy-sr*0.3);g.lineTo(h.x+sr,sy);g.lineTo(h.x+sr*0.3,sy+sr*0.3);
            g.lineTo(h.x,sy+sr);g.lineTo(h.x-sr*0.3,sy+sr*0.3);g.lineTo(h.x-sr,sy);g.lineTo(h.x-sr*0.3,sy-sr*0.3);g.closePath();g.fill();
            g.restore();g.shadowBlur=0;g.globalAlpha=1;}}
      }
      // fever timer + rainbow-pulsing sky wash while active
      if(fever>0){fever-=dt;
        if(fever<=0){fever=0;flash=Math.min(1,flash+0.5);
          api.tone(659,0.18,"triangle",0.12);api.tone(523,0.26,"triangle",0.1);}
        else{g.save();g.globalCompositeOperation="lighter";
          g.globalAlpha=0.13+0.06*Math.sin(tG*0.35);
          g.fillStyle="hsl("+((tG*5)%360)+",90%,55%)";g.fillRect(0,0,api.W,api.H);
          g.restore();g.globalAlpha=1;}}
      // spawn (fever = eruption rush: targets pour out nonstop)
      const paused=clearT>0||endingT>0;
      if(!paused){spawnT-=dt;if(spawnT<=0){spawn();
        spawnT=fever>0?13:clamp(50-(stage-1)*6,26,50);}}   // 出現を少し速く(7〜8歳向け)
      // update + draw targets
      for(const t of targets){
        if(t.flash>0)t.flash-=0.08*dt;
        t.wob+=0.12*dt;
        // ⑦ critter: じっと出るだけでなく左右にちょこちょこ動く(見た目だけでなく動きの質も変える)
        if(t.type==="critter"){const h=holes[t.hi];if(h)t.x=h.x+Math.sin(t.wob)*R*0.15;}
        if(t.state==="rise"){t.up=Math.min(1,t.up+0.12*dt);if(t.up>=1)t.state="up";}
        else if(t.state==="up"){t.life-=dt*16;t.blink=t.life<320?t.life:999;if(t.life<=0){t.state="duck";stageEscape++;}}
        else if(t.state==="duck"){t.up-=0.12*dt;if(t.up<=0){holes[t.hi].occ=false;t._dead=true;}}
        else if(t.state==="smashed"){t.squash-=0.09*dt;if(t.squash<=0)t._dead=true;}
        const ee=t.state==="rise"?api.ease(t.up):1;
        const bob=t.state==="up"?Math.sin(t.bob+=0)*R*0.04:0;
        const ty=t.baseY-((t.state==="rise"?ee:t.up)*R*1.6)-bob;
        g.save();
        g.beginPath();g.rect(t.x-R*1.5,0,R*3,t.baseY+R*0.7);g.clip();
        if(t.type==="rock")drawRock(t,t.x,ty,t.state==="smashed"?t.squash:1);
        else if(t.type==="critter")drawCritter(t,t.x,ty,t.state==="smashed"?t.squash:1);
        else drawBlob(t,t.x,ty,t.state==="smashed"?t.squash:1);
        g.restore();
      }
      targets=targets.filter(t=>!t._dead);
      // rings
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.ellipse(ri.x,ri.y,ri.r,ri.r*0.55,0,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);
      // sparks (additive lines)
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#fff2b0";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;
      sparks=sparks.filter(sp=>sp.life>0);
      // shards (glowing chunks)
      for(const s of shards){s.vy+=0.32*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.rot+=s.vr*dt;s.life-=s.decay*dt;
        g.save();g.globalAlpha=Math.max(0,s.life);g.translate(s.x,s.y);g.rotate(s.rot);
        g.shadowColor=s.col;g.shadowBlur=8;g.fillStyle=s.col;
        const r=s.r*(0.6+s.life*0.4);g.beginPath();
        g.moveTo(0,-r);g.lineTo(r*0.7,-r*0.2);g.lineTo(r*0.5,r*0.7);g.lineTo(-r*0.5,r*0.7);g.lineTo(-r*0.7,-r*0.2);g.closePath();g.fill();
        g.restore();}
      g.globalAlpha=1;g.shadowBlur=0;shards=shards.filter(s=>s.life>0);
      // ④ こぼれたコイン (クレーターひみつタップのごほうび・重力で落ちて消える/加算は使わない)
      for(const c of coins){c.vy+=0.32*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=c.vr*dt;c.life-=c.decay*dt;
        g.save();g.globalAlpha=Math.max(0,c.life);g.translate(c.x,c.y);g.rotate(c.rot);
        const rr=Math.max(0,c.r*(0.7+c.life*0.3));
        g.fillStyle="#ffcf3a";g.beginPath();g.ellipse(0,0,rr,rr*0.82,0,0,TAU);g.fill();
        g.fillStyle="#ffe680";g.beginPath();g.ellipse(0,0,rr*0.6,rr*0.5,0,0,TAU);g.fill();
        g.fillStyle="rgba(255,255,255,.8)";g.beginPath();g.ellipse(-rr*0.25,-rr*0.28,Math.max(0,rr*0.18),Math.max(0,rr*0.12),0,0,TAU);g.fill();
        g.restore();}
      g.globalAlpha=1;coins=coins.filter(c=>c.life>0&&c.y<api.H+30);
      // ④ クレーター ウインク: ひみつタップの瞬間だけ にっこり顔(発見のごほうび)
      if(craterWink>0){craterWink-=0.02*dt;const cx=craterHit.x,cy=craterHit.y,sr=Math.max(6,craterHit.r*0.5);
        g.save();g.globalAlpha=clamp(craterWink*1.4,0,1);g.strokeStyle="#ffe0a0";g.lineWidth=Math.max(2,sr*0.14);g.lineCap="round";
        g.beginPath();
        g.moveTo(cx-sr*0.5,cy);g.quadraticCurveTo(cx-sr*0.32,cy-sr*0.32,cx-sr*0.14,cy);
        g.moveTo(cx+sr*0.14,cy);g.quadraticCurveTo(cx+sr*0.32,cy-sr*0.32,cx+sr*0.5,cy);
        g.stroke();
        g.beginPath();g.arc(cx,cy+sr*0.18,Math.max(0,sr*0.36),0.12*Math.PI,0.88*Math.PI);g.stroke();
        g.restore();g.globalAlpha=1;if(craterWink<0)craterWink=0;}
      // climax color-wash
      if(climax>0){
        const cw=g.createRadialGradient(api.W/2,api.H*0.45,0,api.W/2,api.H*0.45,api.W*0.75);
        cw.addColorStop(0,"rgba(255,180,80,"+(0.5*climax)+")");
        cw.addColorStop(0.5,"rgba(255,90,30,"+(0.28*climax)+")");
        cw.addColorStop(1,"rgba(255,60,20,0)");
        g.save();g.globalCompositeOperation="lighter";g.fillStyle=cw;g.fillRect(0,0,api.W,api.H);g.restore();
        climax-=0.06*dt;if(climax<0)climax=0;
      }
      // impact flash
      if(flash>0){flash-=0.07*dt;g.save();g.globalCompositeOperation="lighter";
        g.globalAlpha=Math.max(0,flash)*0.3;g.fillStyle="#ffd28a";g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      g.globalCompositeOperation="source-over";   // 加算(lighter)を毎フレーム確実に戻す(白飛び/漏れ防止)
      // combo timer + text
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.17);g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(255,120,30,.9)";g.shadowBlur=14;
        g.fillStyle="#ffd23f";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.6)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // ① 予告テキスト「なにか くる…！」(上部中央=HUD安全帯)
      if(rbTeleT>0){const a=clamp((rbTeleT/72)*1.2,0,1),pop=1+Math.sin(tG*0.4)*0.05;
        g.save();g.translate(api.W/2,api.H*0.21);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 26px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="hsl("+((tG*9)%360)+",100%,60%)";g.shadowBlur=14;
        g.fillStyle="#fff2c2";g.fillText("なにか くる…！",0,0);
        g.shadowBlur=0;g.restore();g.globalAlpha=1;g.textAlign="left";}
      // ① にじいろマグマ！ 発見バナー(虹色に色替わり)
      if(rbMsgT>0){rbMsgT-=0.016*dt;const pop=1+Math.max(0,rbMsgT-1)*1.4,col="hsl("+((tG*11)%360)+",95%,65%)";
        g.save();g.translate(api.W/2,api.H*0.24);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 36px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle="#fff";g.fillText("にじいろ マグマ！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろ マグマ！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ② ラッキーあな バナー(初回は「みつけた！」・以降は「ラッキー！」)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;const pop=1+Math.max(0,luckyMsgT-1.1)*1.3;
        g.save();g.translate(api.W/2,api.H*0.34);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.4,0,1);g.font="900 24px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,220,80,.9)";g.shadowBlur=14;g.fillStyle="#ffe680";
        g.fillText(luckyMsgT>1.2?"ラッキーな あな みつけた！":"ラッキー！",0,0);
        g.shadowBlur=0;g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // fever entry banner
      if(feverBanner>0){feverBanner-=0.016*dt;
        const a=clamp(feverBanner*1.5,0,1),pop=1+Math.max(0,feverBanner-1.3)*2+0.06*Math.sin(tG*0.6);
        g.save();g.translate(api.W/2,api.H*0.30);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="hsl("+((tG*9)%360)+",100%,60%)";g.shadowBlur=24;
        g.fillStyle="hsl("+((tG*9+180)%360)+",100%,72%)";
        g.fillText("マグマ フィーバー！",0,0);
        g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle="#fff";g.strokeText("マグマ フィーバー！",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("ぜんぶ 1ぱつ！ とくてん 2ばい！",0,38);
        g.restore();g.globalAlpha=1;g.textAlign="left";}
      // HUD
      drawHUD();
      // stage clear banner
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.5;g.fillStyle="#000";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,140,30,.9)";g.shadowBlur=20;g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア！",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        const NEXT=["","つぎは かたい くろいわ が でてくる！","つぎは きんいろ マグマ が でるよ！",
          "つぎは よる の かざん！ いわ が いっぱい！","さいごは おうごん の だいふんか！"];
        g.fillText(NEXT[clearStage]||("つぎは ステージ"+(clearStage+1)+"！"),0,42);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=20;}
      }
      // ③ パーフェクト！ バナー(クリア文字と重ねない下側=中央下)
      if(perfectT>0){perfectT-=0.014*dt;const pop=1+Math.max(0,perfectT-1.3)*1.4;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(perfectT*1.3,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=16;g.fillStyle="#c7ffcf";
        g.fillText("パーフェクト！ ＋3",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,120,60,.7)";g.strokeText("パーフェクト！ ＋3",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(perfectT<0)perfectT=0;}
      // ending
      if(endingT>0){endingT-=0.012*dt;
        const a=clamp(endingT,0,1);
        g.save();g.globalAlpha=a*0.45;g.fillStyle="#1a0602";g.fillRect(0,0,api.W,api.H);g.restore();
        if(tG%1<dt)shards.push({x:rnd(0,api.W),y:-10,vx:rnd(-1,1),vy:rnd(2,5),r:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.01,col:pick(["#ff6a1a","#ffd23f","#ff3b5e"])});
        const pop=1+Math.sin(tG*0.12)*0.06;
        g.save();g.translate(api.W/2,api.H*0.42);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 54px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,160,40,1)";g.shadowBlur=26;g.fillStyle="#ffd23f";
        g.fillText("ぜんぶ クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle="#fff";g.strokeText("ぜんぶ クリア！",0,0);
        g.font="800 26px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("すごい！ もういちど あそべるよ",0,50);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(endingT<=0){endingT=0;stage=1;stageGoal=stageGoalFor(1);stageKill=0;stageEscape=0;combo=0;spawnT=20;}
      }
    }
  };
  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.05;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(0,0,0,.6)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+" / "+STAGES+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,0,0,.4)";roundRect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#ff6a1a");gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg;roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;roundRect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
    drawFeverGauge();
  }
  function drawFeverGauge(){
    const fw=Math.min(api.W*0.5,260),fh=12,fx=(api.W-fw)/2,fy=api.H-30;
    const inF=fever>0,fr=inF?clamp(fever/FEVER_LEN,0,1):clamp(feverGauge,0,1);
    g.save();g.textAlign="center";
    g.fillStyle="rgba(0,0,0,.45)";roundRect(fx-4,fy-3,fw+8,fh+6,(fh+6)/2);g.fill();
    if(fr>0){
      if(inF){ // rainbow remaining-time bar
        const gg=g.createLinearGradient(fx,0,fx+fw,0);
        for(let i=0;i<=4;i++)gg.addColorStop(i/4,"hsl("+((tG*9+i*70)%360)+",95%,60%)");
        g.fillStyle=gg;
      }else{
        const gg=g.createLinearGradient(fx,0,fx+fw,0);
        gg.addColorStop(0,"#ff6a1a");gg.addColorStop(1,"#ffd23f");g.fillStyle=gg;
      }
      g.save();if(inF||fr>0.85){g.shadowColor=inF?"#fff":"#ffd23f";g.shadowBlur=10+6*Math.sin(tG*0.5);}
      roundRect(fx,fy,Math.max(fh,fw*fr),fh,fh/2);g.fill();g.restore();
    }
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;roundRect(fx-4,fy-3,fw+8,fh+6,(fh+6)/2);g.stroke();
    g.font="800 14px 'Hiragino Maru Gothic ProN',system-ui";
    g.shadowColor="rgba(0,0,0,.7)";g.shadowBlur=5;
    g.fillStyle=inF?"hsl("+((tG*9)%360)+",100%,75%)":fr>0.85?"#ffe680":"#fff";
    g.fillText(inF?"フィーバーちゅう！ 2ばい！":fr>0.85?"もうすぐ フィーバー！":"フィーバー",api.W/2,fy-7);
    g.shadowBlur=0;g.restore();g.textAlign="left";
  }
  function drawBlob(t,x,y,sq){
    const gold=t.type==="gold",rb=t.type==="rainbow";
    const hue=(tG*9)%360;
    const r=R*0.9*(t.rScale||1);
    const wob=Math.sin(t.wob)*r*0.05;
    g.save();g.translate(x,y);g.scale(1,sq);
    // hot aura (rainbow = big pulsing multicolor halo so it instantly stands out)
    g.save();g.globalCompositeOperation="lighter";
    const gp=0.5+0.5*Math.sin(tG*(gold||rb?0.4:0.2));
    const ag=g.createRadialGradient(0,-r*0.1,0,0,-r*0.1,r*(rb?2.3:1.9));
    ag.addColorStop(0,rb?"hsla("+hue+",100%,70%,"+(0.65*gp)+")":gold?"rgba(255,235,140,"+(0.6*gp)+")":"rgba(255,150,50,"+(0.5*gp)+")");
    ag.addColorStop(1,rb?"hsla("+((hue+120)%360)+",100%,60%,0)":"rgba(255,140,40,0)");
    g.fillStyle=ag;g.beginPath();g.arc(0,-r*0.1,r*(rb?2.3:1.9),0,TAU);g.fill();g.restore();
    // rainbow: orbiting sparkle stars
    if(rb){g.save();g.globalCompositeOperation="lighter";
      for(let i=0;i<5;i++){const a=tG*0.18+i*TAU/5,sr=r*1.35;
        const sx=Math.cos(a)*sr,sy=-r*0.1+Math.sin(a)*sr*0.6;
        g.globalAlpha=0.6+0.4*Math.sin(tG*0.5+i*2);
        g.fillStyle="hsl("+((hue+i*72)%360)+",100%,75%)";g.shadowColor="#fff";g.shadowBlur=8;
        g.beginPath();g.arc(sx,sy,r*0.09,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;g.shadowBlur=0;}
    // shadow
    g.fillStyle="rgba(0,0,0,.25)";g.beginPath();g.ellipse(0,r*0.7,r*0.8,r*0.28,0,0,TAU);g.fill();
    // 画像マグマ: にじいろ(色が回る)は従来の手描きのまま。ふつう=ステージの溶岩色を薄く着色、きんいろ=金色に着色
    if(!rb){
      const bimg=api.asset("blob.png");
      let src=null;
      if(bimg.ready){
        if(gold)src=api.tinted("blob.png","#ffd23f",0.5)||bimg;
        else if(stage===1)src=bimg;                       // 1面はスプライトそのままのオレンジ
        else src=api.tinted("blob.png",curBg().lava,0.38)||bimg;
      }
      if(src){
        const blinking=t.blink!==999&&Math.floor(t.blink/40)%2===0;   // もうすぐ引っ込む合図(点滅)
        api.drawSrc(src,r*0.21,-r*0.2,r*2.4,r*2.4,{center:true,alpha:blinking?0.55:1});
        // ゆらめく炎のふさ(手描きと同じ動き)を頭上に重ねる
        g.save();g.globalCompositeOperation="lighter";
        const ft=Math.sin(tG*0.3)*r*0.1;
        g.fillStyle="rgba(255,180,60,.6)";g.beginPath();
        g.moveTo(0,-r*1.2);g.quadraticCurveTo(r*0.2+ft,-r*1.55,0,-r*1.8);g.quadraticCurveTo(-r*0.2+ft,-r*1.55,0,-r*1.2);g.closePath();g.fill();
        g.restore();
        g.restore();return;
      }
    }
    // molten body (wobbly blob)
    const base=rb?"hsl("+hue+",95%,58%)":gold?"#ffb020":curBg().lava;
    const grd=g.createRadialGradient(-r*0.25,-r*0.4,r*0.1,0,0,r*1.25);
    grd.addColorStop(0,rb?"hsl("+((hue+40)%360)+",100%,82%)":gold?"#fff0a0":"#ffd060");
    grd.addColorStop(0.5,rb?"hsl("+((hue+20)%360)+",95%,68%)":gold?"#ffce40":"#ff8a2a");grd.addColorStop(1,base);
    g.fillStyle=grd;
    g.beginPath();
    g.moveTo(0,-r-wob);
    g.quadraticCurveTo(r*1.0,-r*0.7,r*0.9,r*0.1);
    g.quadraticCurveTo(r*0.85,r*0.7,0,r*0.75);
    g.quadraticCurveTo(-r*0.85,r*0.7,-r*0.9,r*0.1);
    g.quadraticCurveTo(-r*1.0,-r*0.7,0,-r-wob);
    g.closePath();g.fill();
    // glowing crust cracks
    g.save();g.globalCompositeOperation="lighter";g.strokeStyle="rgba(255,240,180,.5)";g.lineWidth=2;
    g.beginPath();g.moveTo(-r*0.4,-r*0.3);g.lineTo(-r*0.1,r*0.1);g.lineTo(-r*0.3,r*0.4);g.stroke();
    g.restore();
    // top sheen
    g.fillStyle="rgba(255,255,255,.35)";g.beginPath();g.ellipse(-r*0.2,-r*0.5,r*0.34,r*0.18,-0.3,0,TAU);g.fill();
    // little flame tuft on top
    g.save();g.globalCompositeOperation="lighter";
    const ft=Math.sin(tG*0.3)*r*0.1;
    g.fillStyle="rgba(255,180,60,.8)";g.beginPath();
    g.moveTo(0,-r-wob);g.quadraticCurveTo(r*0.2+ft,-r*1.5,0,-r*1.7);g.quadraticCurveTo(-r*0.2+ft,-r*1.5,0,-r-wob);g.closePath();g.fill();
    g.restore();
    // face: cute eyes (blink when about to leave)
    const blinking=t.blink!==999&&Math.floor(t.blink/40)%2===0;
    if(blinking){
      g.strokeStyle="#3a1500";g.lineWidth=r*0.08;g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.4,-r*0.15);g.lineTo(-r*0.14,-r*0.15);
      g.moveTo(r*0.14,-r*0.15);g.lineTo(r*0.4,-r*0.15);g.stroke();
    }else{
      g.fillStyle="#fff";g.beginPath();g.arc(-r*0.26,-r*0.15,r*0.22,0,TAU);g.arc(r*0.26,-r*0.15,r*0.22,0,TAU);g.fill();
      g.fillStyle="#3a1500";g.beginPath();g.arc(-r*0.24,-r*0.11,r*0.11,0,TAU);g.arc(r*0.28,-r*0.11,r*0.11,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.9)";g.beginPath();
      g.arc(-r*0.28,-r*0.17,r*0.04,0,TAU);g.arc(r*0.24,-r*0.17,r*0.04,0,TAU);g.fill();
    }
    // open mouth (cute)
    g.fillStyle="#5a1500";g.beginPath();g.arc(0,r*0.18,r*0.16,0.1*Math.PI,0.9*Math.PI);g.fill();
    // cheeks
    g.fillStyle="rgba(255,120,80,.4)";g.beginPath();
    g.arc(-r*0.5,r*0.02,r*0.12,0,TAU);g.arc(r*0.5,r*0.02,r*0.12,0,TAU);g.fill();
    g.restore();
  }
  function drawRock(t,x,y,sq){
    const r=R*0.92*(t.rScale||1);
    const cracked=t.hp<=1;
    g.save();g.translate(x,y);g.scale(1,sq);
    // shadow
    g.fillStyle="rgba(0,0,0,.3)";g.beginPath();g.ellipse(0,r*0.72,r*0.82,r*0.3,0,0,TAU);g.fill();
    // 画像いわ: ひび(1発目のあと)と被弾フラッシュだけ重ねる
    if(api.drawAsset("rock.png",-r*0.18,-r*0.1,r*2.2,r*2.2,{center:true})){
      if(cracked){g.strokeStyle="rgba(255,200,120,.85)";g.lineWidth=3;g.lineCap="round";
        g.beginPath();g.moveTo(-r*0.1,-r*0.75);g.lineTo(r*0.12,-r*0.25);g.lineTo(-r*0.12,r*0.15);g.lineTo(r*0.1,r*0.6);g.stroke();}
      if(t.flash>0){g.save();g.globalAlpha=t.flash*0.7;g.fillStyle="#fff";
        g.beginPath();g.arc(0,-r*0.1,r*0.95,0,TAU);g.fill();g.restore();}
      g.restore();return;
    }
    // dark rock body (chunky polygon)
    const grd=g.createRadialGradient(-r*0.25,-r*0.4,r*0.1,0,0,r*1.3);
    grd.addColorStop(0,"#5a5560");grd.addColorStop(0.6,"#33303a");grd.addColorStop(1,"#1a1820");
    g.fillStyle=grd;
    g.beginPath();
    g.moveTo(0,-r);g.lineTo(r*0.7,-r*0.6);g.lineTo(r*0.92,r*0.1);
    g.lineTo(r*0.55,r*0.7);g.lineTo(-r*0.55,r*0.7);g.lineTo(-r*0.92,r*0.1);
    g.lineTo(-r*0.7,-r*0.6);g.closePath();g.fill();
    // glowing magma seams between rock plates
    g.save();g.globalCompositeOperation="lighter";
    const sp=0.5+0.5*Math.sin(tG*0.25);
    g.strokeStyle="rgba(255,110,30,"+(0.5+0.3*sp)+")";g.lineWidth=r*0.07;g.lineCap="round";
    g.shadowColor="#ff6a1a";g.shadowBlur=8;
    g.beginPath();g.moveTo(-r*0.5,-r*0.3);g.lineTo(0,0);g.lineTo(r*0.45,-r*0.2);
    g.moveTo(0,0);g.lineTo(-r*0.15,r*0.5);g.stroke();
    g.restore();
    // crack overlay after first hit
    if(cracked){g.strokeStyle="rgba(255,200,120,.7)";g.lineWidth=2.5;g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.1,-r*0.7);g.lineTo(r*0.1,-r*0.2);g.lineTo(-r*0.12,r*0.15);g.lineTo(r*0.08,r*0.55);g.stroke();}
    // hit flash
    if(t.flash>0){g.save();g.globalAlpha=t.flash*0.7;g.fillStyle="#fff";
      g.beginPath();g.arc(0,0,r*0.9,0,TAU);g.fill();g.restore();}
    // rim light
    g.strokeStyle="rgba(255,255,255,.18)";g.lineWidth=2;
    g.beginPath();g.moveTo(0,-r);g.lineTo(r*0.7,-r*0.6);g.lineTo(r*0.92,r*0.1);g.stroke();
    // grumpy face
    g.strokeStyle="#ffcaa0";g.lineWidth=r*0.08;g.lineCap="round";
    g.beginPath();g.moveTo(-r*0.42,-r*0.28);g.lineTo(-r*0.14,-r*0.16);
    g.moveTo(r*0.42,-r*0.28);g.lineTo(r*0.14,-r*0.16);g.stroke();
    g.fillStyle="#ffd2a0";g.beginPath();g.arc(-r*0.26,-r*0.04,r*0.1,0,TAU);g.arc(r*0.26,-r*0.04,r*0.1,0,TAU);g.fill();
    g.fillStyle="#1a1820";g.beginPath();g.arc(-r*0.26,-r*0.04,r*0.05,0,TAU);g.arc(r*0.26,-r*0.04,r*0.05,0,TAU);g.fill();
    g.strokeStyle="#ffcaa0";g.lineWidth=r*0.06;
    g.beginPath();g.arc(0,r*0.38,r*0.16,1.1*Math.PI,1.9*Math.PI);g.stroke();
    g.restore();
  }
  function drawCritter(t,x,y,sq){
    // ⑦ ブロブ(丸い液体)/岩(角ばった岩)とは明確に違う第3のシルエット: 脚の生えた丸い生き物
    const r=Math.max(4,R*0.76*(t.rScale||1));
    const legPhase=Math.sin(t.wob*2.2);
    g.save();g.translate(x,y);g.scale(1,sq);
    // shadow
    g.fillStyle="rgba(0,0,0,.25)";g.beginPath();g.ellipse(0,r*0.78,r*0.72,r*0.24,0,0,TAU);g.fill();
    // stubby legs (alternate as it scurries side to side)
    g.strokeStyle="#2a3a1a";g.lineWidth=Math.max(1,r*0.22);g.lineCap="round";
    g.beginPath();
    g.moveTo(-r*0.34,r*0.48);g.lineTo(-r*0.34+legPhase*r*0.22,r*0.86);
    g.moveTo(r*0.34,r*0.48);g.lineTo(r*0.34-legPhase*r*0.22,r*0.86);
    g.stroke();
    // warm aura so it still reads as a magma creature, distinct hue from blob/rock
    g.save();g.globalCompositeOperation="lighter";
    const gp=0.5+0.5*Math.sin(tG*0.28);
    const ag=g.createRadialGradient(0,-r*0.1,0,0,-r*0.1,Math.max(1,r*1.5));
    ag.addColorStop(0,"rgba(150,255,150,"+(0.32*gp)+")");
    ag.addColorStop(1,"rgba(150,255,150,0)");
    g.fillStyle=ag;g.beginPath();g.arc(0,-r*0.1,Math.max(1,r*1.5),0,TAU);g.fill();
    g.restore();
    // round earthy-green body
    const grd=g.createRadialGradient(-r*0.25,-r*0.35,r*0.08,0,0,Math.max(1,r*1.15));
    grd.addColorStop(0,"#c9f2a0");grd.addColorStop(0.55,"#6fbf5a");grd.addColorStop(1,"#2f6e35");
    g.fillStyle=grd;g.beginPath();g.arc(0,0,Math.max(1,r*0.84),0,TAU);g.fill();
    // small round ear bumps on top
    g.fillStyle="#6fbf5a";g.beginPath();
    g.arc(-r*0.48,-r*0.6,Math.max(1,r*0.17),0,TAU);g.arc(r*0.48,-r*0.6,Math.max(1,r*0.17),0,TAU);g.fill();
    // hit flash
    if(t.flash>0){g.save();g.globalAlpha=t.flash*0.7;g.fillStyle="#fff";
      g.beginPath();g.arc(0,0,Math.max(1,r*0.9),0,TAU);g.fill();g.restore();}
    // face (blink when about to duck back in)
    const blinking=t.blink!==999&&Math.floor(t.blink/40)%2===0;
    if(blinking){
      g.strokeStyle="#173018";g.lineWidth=Math.max(1,r*0.08);g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.36,-r*0.08);g.lineTo(-r*0.12,-r*0.08);
      g.moveTo(r*0.12,-r*0.08);g.lineTo(r*0.36,-r*0.08);g.stroke();
    }else{
      g.fillStyle="#fff";g.beginPath();
      g.arc(-r*0.24,-r*0.06,Math.max(1,r*0.19),0,TAU);g.arc(r*0.24,-r*0.06,Math.max(1,r*0.19),0,TAU);g.fill();
      g.fillStyle="#173018";g.beginPath();
      g.arc(-r*0.22,-r*0.02,Math.max(1,r*0.1),0,TAU);g.arc(r*0.26,-r*0.02,Math.max(1,r*0.1),0,TAU);g.fill();
    }
    g.fillStyle="#173018";g.beginPath();g.arc(0,r*0.2,Math.max(1,r*0.12),0.1*Math.PI,0.9*Math.PI);g.fill();
    g.restore();
  }
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
}
Engine.register("magma", buildMagma);
