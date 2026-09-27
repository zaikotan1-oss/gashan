function build_jellypop(api){
  const g=api.g;
  api.preload(["bg.jpg","gold.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。にじいろは生成2回とも
                                          // 玉が割れて写ったため不採用、手描き(色サイクル)のまま使う。issues参照。
  let bubbles=[],shards=[],rings=[],sparks=[],floats=[],motes=[],sweets=[],count=0,combo=0,comboT=0,tsec=0,spawnT=0,flash=0;
  let R,maxBubbles;
  // stage progression: pop GOAL bubbles -> "ステージ クリア!" -> endless harder
  let stage=1,stagePop=0,stageGoal=10,clearT=0,clearStage=0,burstAllT=0;
  // fever + gold jelly state
  let feverT=0,feverG=0,feverBanner=0,feverEndT=0,hsCool=0;
  const COLORS=["#ff8fcf","#ffd23f","#9be8ff","#a0ff9e","#c8a0ff","#ff9a6e","#7fe6d0"];
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  const COLNAME={"#ff8fcf":"ピンク","#ffd23f":"きいろ","#9be8ff":"みずいろ","#a0ff9e":"みどり","#c8a0ff":"むらさき","#ff9a6e":"オレンジ","#7fe6d0":"みずいろ"};
  let luckyColor=pick(COLORS.filter(c=>c!=="#ffd23f")); // ② きょうのラッキー色(金ゼリーと同色は除外)
  let luckySeen=false,luckyMsgT=0;                       // ② 初回だけ中央上に一度教える
  let rbMsgT=0,rbTele=null;                              // ① にじいろゼリー 予告リング + 発見バナー
  let stageMiss=0,noMissT=0;                             // ③ パーフェクト(ノーミス)判定
  function stageGoalFor(s){return 12+(s-1)*4;}     // 7〜8歳向けに手応えを増やした(旧: 10+(s-1)*3)
  // 軸6対策: 共通エンジンの祝福バナー「やったね!」は画面中央やや上(だいたい api.H*0.24〜0.38)に出る。
  // ゴールド/にじいろ/ラッキーの浮遊テキストがこの帯に来ると重なって読めなくなるので、その時だけ下へ逃がす。
  function floatY(fy0){ return (fy0>api.H*0.22&&fy0<api.H*0.38)?api.H*0.4:fy0; }
  // gentle pastel candy-land sky per stage (subtle shift so each stage looks fresh)
  const SKY=[
    {top:"#ffe3f3",mid:"#ffd0ec",bot:"#c9e8ff",name:"いちごミルク"}, // 1 strawberry milk
    {top:"#fff0d6",mid:"#ffe0b0",bot:"#ffd0e0",name:"キャラメル"},   // 2 caramel cream
    {top:"#e3f0ff",mid:"#d0e4ff",bot:"#e8d0ff",name:"ソーダ"},       // 3 soda blue
    {top:"#e6ffe9",mid:"#cdf0d6",bot:"#fff0c8",name:"ミント"},       // 4 mint candy
    {top:"#f3e3ff",mid:"#e6d0ff",bot:"#ffd6ee",name:"グレープ"}      // 5 grape dream
  ];
  function curSky(){
    // ---- FEVER中は「にじいろの空」に切り替える(コメント通りの演出を実際に見せる) ----
    if(feverT>0){
      const hue=(tsec*50)%360;
      return {top:"hsl("+hue+",90%,88%)",mid:"hsl("+((hue+45)%360)+",90%,80%)",bot:"hsl("+((hue+90)%360)+",90%,86%)",name:"フィーバー"};
    }
    return SKY[(stage-1)%SKY.length];
  }
  function layout(){
    R=clamp(Math.min(api.W,api.H)*0.09,30,72);
    maxBubbles=clamp(Math.round(api.W/110),4,8);   // 7〜8歳向け: 同時数を少し増やした
    // background floating sweets (clouds made of candy)
    sweets=[];const n=6;
    for(let i=0;i<n;i++)sweets.push({x:rnd(0,api.W),y:api.H*rnd(0.06,0.5),s:rnd(0.7,1.4),
      sp:rnd(0.05,0.16),a:rnd(0.16,0.32),kind:rint(0,3),col:pick(COLORS),ph:rnd(0,TAU),pop:0});
    motes=[];for(let i=0;i<24;i++)motes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(0.8,2.6),sp:rnd(0.1,0.4),tw:rnd(0,TAU),col:pick(COLORS)});
  }
  layout();
  function popLife(){return clamp(2.4-(stage-1)*0.25,1.0,2.4);}     // seconds until a bubble bursts on its own(7〜8歳向けに短縮)
  function growRate(){return clamp(0.012+(stage-1)*0.002,0.012,0.03);}
  function spawn(){
    if(bubbles.length>=maxBubbles+(feverT>0?3:0))return;
    // ① にじいろゼリー: ステージ2以降の激レア(約3%)。すぐには出さず、出る場所に
    //    虹の輪が集まってくる"予告"を先に出す = 「つぎ くるかも!」のドキドキ発見。
    if(stage>=2 && !rbTele && !bubbles.some(b=>b.rainbow) && Math.random()<0.03){
      const rm=R*1.6;
      rbTele={x:rnd(rm,api.W-rm),y:rnd(api.H*0.18+rm,api.H*0.9-rm),t:0.85,t0:0.85};
      api.tone(1046,0.1,"triangle",0.06);api.tone(1568,0.12,"triangle",0.05);
      return;
    }
    const m=R*1.5;
    // rare golden jelly: shines, wiggles, huge points + rainbow burst (a bit more common in fever)
    const gold=Math.random()<(feverT>0?0.12:0.07);
    // ⑥ 大きさのクラス差: gold/rainbowと同じ低確率枠で「特大/ミニ」を混ぜ、大小の差をもう一段作る
    let sizeMul=1,r0Mul=1;
    if(!gold){
      const sroll=Math.random();
      if(sroll<0.05){sizeMul=1.35;r0Mul=1.3;}       // 特大(とくだい)
      else if(sroll<0.09){sizeMul=0.6;r0Mul=0.75;}  // ミニ
    }
    bubbles.push({
      x:rnd(m,api.W-m), y:rnd(api.H*0.16+m,api.H*0.9-m),
      r:R*0.28*r0Mul, grow:rnd(0.85,1.15)*growRate(),
      max:R*rnd(0.9,1.7)*sizeMul, col:gold?"#ffd23f":pick(COLORS), gold:gold,
      life:popLife()+rnd(-0.3,0.4)+(gold?0.7:0), age:0, state:"grow",
      wob:rnd(0,TAU), wobS:rnd(0.04,0.09), squash:1, blink:rnd(0,TAU), pop:0,
      shape:rint(0,3) // ⑤ 形のバラエティ: 0=まる 1=ほし 2=だんご(2段) 3=ながいオーバル(色だけでなく形でも特別感を出す)
    });
    if(gold){ // announce it the moment it appears (glint + chime)
      const b=bubbles[bubbles.length-1];
      api.tone(1568,0.12,"triangle",0.1);api.tone(2093,0.16,"triangle",0.08);
      for(let i=0;i<6;i++){const a=rnd(0,TAU),s=rnd(3,6);
        sparks.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,14),life:1,decay:rnd(0.05,0.08)});}
    }
  }
  // ① 予告が終わったら、その場所に にじいろゼリー が本当に登場する
  function spawnRainbow(x,y){
    bubbles.push({
      x,y, r:R*0.3, grow:rnd(0.9,1.1)*growRate()*1.1,
      max:R*rnd(1.3,1.7), col:"#ff5da2", gold:false, rainbow:true,
      life:popLife()+1.1, age:0, state:"grow",
      wob:rnd(0,TAU), wobS:rnd(0.05,0.1), squash:1, blink:rnd(0,TAU), pop:0,
      shape:rint(0,3)
    });
    api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.09);api.tone(2093,0.16,"triangle",0.07);
  }
  // ① にじいろゼリー撃破: 虹の輪7色 + 大量の雫 + ファンファーレ + 中央バナー(激レアの大ごほうび)
  function rainbowFx(x,y,r){
    rbMsgT=1.5;flash=Math.min(1,flash+0.4);
    api.boom(0.7);api.shake(16);
    if(hsCool<=0){api.hitStop(4);hsCool=30;}
    for(let k=0;k<COLORS.length;k++)rings.push({x,y,r:Math.max(0,r*0.4),vr:r*(0.5+k*0.14),life:1,decay:0.05,col:COLORS[k]});
    for(let i=0;i<28&&shards.length<240;i++){const a=rnd(0,TAU),s=rnd(3,10);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:COLORS[i%COLORS.length]});}
    floats.push({x,y:floatY(y-r-38),txt:"にじいろ ゼリー!",life:1,vy:-0.8,col:"#ff5da2",size:26});
    [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.16,"triangle",0.11),i*60));
  }
  // ② ラッキー色 命中: 頭上に小さな星のキラッ(白飛びしない控えめな祝福)
  function luckyStar(x,y){
    api.tone(1046,0.12,"triangle",0.1);api.tone(1568,0.14,"triangle",0.07);
    for(let i=0;i<7;i++){const a=rnd(0,TAU),s=rnd(2,5);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,len:rnd(6,12),life:1,decay:rnd(0.05,0.08)});}
    floats.push({x,y:floatY(y-6),txt:"ラッキー!",life:1,vy:-0.8,col:luckyColor,size:20});
  }
  // ④ ひみつ: 背景のおかしをタップしたら小さなごほうび(コイン+きらめき/減点なし・ミスにしない)
  function sweetSecret(s,sy){
    s.pop=0.6;count+=1;api.setScore(count);
    api.tone(1318,0.1,"triangle",0.09);api.tone(1976,0.12,"triangle",0.06);
    for(let i=0;i<8;i++){const a=rnd(-TAU*0.5,0),sp=rnd(2,5);
      sparks.push({x:s.x,y:sy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,len:rnd(5,11),life:1,decay:rnd(0.05,0.08)});}
    floats.push({x:s.x,y:sy-14,txt:"+1",life:1,vy:-0.9,col:"#ffd23f",size:20});
  }
  // 軸7対策: shapeごとに壊れ方を変える(0=まる=従来どおり/1=ほし=パリンと強く飛び散る/
  // 2=だんご=上下2段が別々に「ぷるん×2」で弾ける/3=オーバル=横に長く飛び散る)
  function burstFx(x,y,col,big,size,shape){
    shape=shape||0;
    if(shape===2){ // だんご: 上の段・下の段を少しずらしてそれぞれ弾く(ぷるん×2)
      burstFxCore(x,y-size*0.16,col,big,size*0.65,0);
      burstFxCore(x,y+size*0.12,col,big,size*0.85,0);
      return;
    }
    burstFxCore(x,y,col,big,size,shape);
  }
  function burstFxCore(x,y,col,big,size,shape){
    rings.push({x,y,r:size*0.5,vr:size*(big?0.7:0.45),life:1,decay:0.05,col});
    rings.push({x,y,r:size*0.2,vr:size*0.4,life:1,decay:0.045,col:"#ffffff"});
    let n=(big?16:9)+Math.min(combo,7);
    if(shape===1)n+=4; // ほし: 破片の数を増やして「パリン」と派手に
    for(let i=0;i<n&&shards.length<220;i++){
      let a=rnd(0,TAU),s=rnd(2.5,big?9:6);
      if(shape===1)s*=1.35;              // ほし: 初速を強く飛び散らせる
      if(shape===3){                     // ながいオーバル: 横方向に長く破片が飛ぶ
        a=Math.random()<0.5?rnd(-0.5,0.5):rnd(Math.PI-0.5,Math.PI+0.5);s*=1.15;
      }
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,8),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.014,0.026),
        col:i%3===0?col:(i%3===1?"#ffffff":pick(COLORS))});}
    for(let i=0;i<rint(5,8);i++){const a=rnd(0,TAU),s=rnd(4,11);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(7,16),life:1,decay:rnd(0.05,0.09)});}
  }
  function popBubble(b,idx){
    // bigger bubble = more points (size ratio over its base R); fever = x2; gold = x5
    const ratio=clamp(b.r/R,0.4,1.8);
    const mult=feverT>0?2:1;
    let gain=Math.max(1,Math.round(ratio*ratio*2))*mult;
    if(b.gold)gain*=5;
    if(b.rainbow)gain*=8;                                  // ① にじいろ = 大量得点
    // ② きょうのラッキー色: 秘密の1色を割ると +2 の隠しボーナス(気づくと得)
    const isLucky=!b.gold&&!b.rainbow&&b.col===luckyColor;
    if(isLucky){gain+=2;luckyMsgT=luckySeen?Math.max(luckyMsgT,0.6):1.6;luckySeen=true;}
    count+=gain;stagePop++;api.setScore(count);
    combo++;comboT=1.0;
    const big=ratio>=1.15||b.gold||b.rainbow;
    b.state="pop";b.pop=1;
    burstFx(b.x,b.y,b.col,big,b.r*2,b.shape);
    if(b.gold)goldFx(b.x,b.y,b.r);
    if(b.rainbow)rainbowFx(b.x,b.y,b.r);
    if(isLucky)luckyStar(b.x,b.y-b.r*0.9);
    flash=Math.min(1,flash+(big?0.4:0.22)+combo*0.02);
    // pitch climbs with combo for a satisfying ladder
    api.slide(360+ratio*120,140,0.14,0.3,"sine");
    api.tone(620*Math.pow(2,clamp(combo,0,12)/12),0.12,"triangle",0.12);
    api.noise(0.08,0.16,1600,"bandpass",1);
    if(big){api.boom(clamp(0.4+ratio*0.12,0.4,0.7));api.shake(7+Math.min(combo,8));
      if(hsCool<=0){api.hitStop(3);hsCool=30;}}
    else{api.shake(3+Math.min(combo,6));}
    floats.push({x:b.x,y:b.y-b.r,txt:b.rainbow?"にじいろ! +"+gain:b.gold?"ゴールド! +"+gain:"+"+gain,life:1,vy:-1.1,
      col:b.rainbow?"#ff5da2":b.gold?"#ffb000":big?"#ff4db8":"#ffd23f",size:b.rainbow?36:b.gold?36:big?34:24});
    // fever gauge charges per pop (gold/rainbow charge a big chunk)
    if(feverT<=0){feverG=Math.min(1,feverG+(b.rainbow?0.5:b.gold?0.34:0.09));if(feverG>=1)startFever();}
    if(combo>=3)floats.push({x:b.x,y:b.y-b.r-30,txt:"コンボ x"+combo,life:1,vy:-0.7,
      col:combo>=8?"#ff2bff":combo>=5?"#ff5b5b":"#ff8c42",size:combo>=5?24:18});
    // big-combo reward: pop every bubble on screen at once
    if(combo>0&&combo%8===0)burstAll();
    checkStage();
  }
  function burstAll(){
    burstAllT=1;flash=1;api.boom(0.7);api.shake(16);
    if(hsCool<=0){api.hitStop(5);hsCool=30;}
    api.slide(900,160,0.4,0.28,"triangle");api.tone(1318,0.3,"triangle",0.12);
    const mult=feverT>0?2:1;
    for(const b of bubbles){
      if(b.state==="pop")continue;
      const ratio=clamp(b.r/R,0.4,1.8);
      let gain=Math.max(1,Math.round(ratio*ratio*2))*mult;
      if(b.gold){gain*=5;goldFx(b.x,b.y,b.r);}
      count+=gain;stagePop++;b.state="pop";b.pop=1;
      burstFx(b.x,b.y,b.col,true,b.r*2,b.shape);
    }
    api.setScore(count);checkStage();
  }
  // rainbow celebration burst + fanfare for a golden jelly
  function goldFx(x,y,r){
    for(let i=0;i<16&&shards.length<240;i++){const a=i/16*TAU+rnd(-0.15,0.15),s=rnd(4,9);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),
        col:COLORS[i%COLORS.length]});}
    rings.push({x,y,r:r*0.6,vr:r*0.9,life:1,decay:0.04,col:"#ffd23f"});
    floats.push({x,y:floatY(y-r-34),txt:"キラキラ ゼリー!",life:1,vy:-0.8,col:"#ffd23f",size:22});
    // little fanfare arpeggio
    [0,4,7,12].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.16,"triangle",0.12),i*70));
  }
  // ---- FEVER TIME: gauge full -> 10s of x2 points, rain of jellies, rainbow sky ----
  function startFever(){
    feverT=10;feverG=0;feverBanner=1.8;flash=1;
    api.boom(0.7);api.shake(15);
    if(hsCool<=0){api.hitStop(5);hsCool=30;}
    api.slide(300,1400,0.5,0.3,"triangle");
    [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(523*Math.pow(2,semi/12),0.18,"triangle",0.13),i*70));
    for(let i=0;i<4;i++)spawn();
  }
  function checkStage(){
    if(stagePop<stageGoal||clearT>0)return;
    clearStage=stage;clearT=2.0;flash=1;
    api.boom(0.6);api.shake(14);
    api.slide(523,1046,0.5,0.22,"triangle");
    api.tone(784,0.25,"triangle",0.14);api.tone(1046,0.3,"triangle",0.1);
    for(let i=0;i<26;i++){const a=rnd(0,TAU),s=rnd(3,9);
      shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(COLORS)});}
    // ③ パーフェクト(ノーミス): このステージ中に「勝手に割れた/タップ外し」が0なら +5 & みどりの星シャワー
    if(stageMiss===0){count+=5;api.setScore(count);noMissT=2.2;
      api.tone(1318,0.16,"triangle",0.12);api.tone(1976,0.18,"triangle",0.08);
      for(let i=0;i<16;i++){const a=rnd(0,TAU),s=rnd(3,8);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(4,8),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:"#a0ff9e"});}}
    stageMiss=0;
    stage++;stageGoal=stageGoalFor(stage);stagePop=0;layout();
  }
  return {
    resize:layout,
    input(x,y,type){
      if(type!=="down"||clearT>0)return;
      // tap to pop: check topmost (largest index) first; generous hit radius
      // 軸1対策: まだ一度も得点していない/開始6秒以内は、ランダムに近いタップでも当たりやすいよう判定を広げる
      const hitPad=(count===0||tsec<6)?R*0.5:R*0.25;
      for(let i=bubbles.length-1;i>=0;i--){const b=bubbles[i];
        if(b.state==="pop")continue;
        if(Math.hypot(x-b.x,y-b.y)<b.r+hitPad){popBubble(b,i);return;}}
      // ④ ひみつ発見: あわを外したタップが背景のおかしに届いたら、コインをこぼす(ミスにしない)
      for(let i=sweets.length-1;i>=0;i--){const s=sweets[i];
        const sy=s.y+Math.sin(tsec*0.6+s.ph)*8, hr=22*s.s+R*0.15;
        if(Math.hypot(x-s.x,y-sy)<hr){sweetSecret(s,sy);return;}}
      // miss: tiny puff + reset combo softly (no game over ever) — ③ ノーミス判定にも記録
      combo=0;comboT=0;stageMiss++;
      api.tone(220,0.05,"triangle",0.06);
      for(let i=0;i<5;i++){const a=rnd(0,TAU),s=rnd(2,5);
        sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(5,10),life:1,decay:rnd(0.06,0.1)});}
    },
    frame(dt,now){
      tsec+=0.016*dt;
      // ---- candy sky: 画像背景があれば cover 表示(+ステージ色をうっすら重ねて面ごとの違いを出す)。無ければ従来の手描き ----
      const sk=curSky();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        g.save();g.globalAlpha=0.24;const tg=g.createLinearGradient(0,0,0,api.H);
        tg.addColorStop(0,sk.top);tg.addColorStop(0.5,sk.mid);tg.addColorStop(1,sk.bot);
        g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,sk.top);grd.addColorStop(0.5,sk.mid);grd.addColorStop(1,sk.bot);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
        // soft sweet sun-glow top
        let glow=g.createRadialGradient(api.W*0.5,api.H*0.04,0,api.W*0.5,api.H*0.04,api.W*0.7);
        glow.addColorStop(0,"rgba(255,255,240,.4)");glow.addColorStop(1,"rgba(255,255,240,0)");
        g.fillStyle=glow;g.fillRect(0,0,api.W,api.H);
      }
      // ---- drifting candy clouds (background sweets) ----
      for(const s of sweets){
        s.x+=s.sp*dt;if(s.x>api.W+80*s.s)s.x=-80*s.s;
        if(s.pop>0)s.pop-=0.05*dt;
        const sy=s.y+Math.sin(tsec*0.6+s.ph)*8;
        const psc=1+Math.max(0,s.pop)*0.35;   // ④ タップされたおかしが ぽよんと弾む
        g.save();g.globalAlpha=clamp(s.a+Math.max(0,s.pop)*0.5,0,0.7);g.translate(s.x,sy);g.scale(s.s*psc,s.s*psc);
        drawSweet(s.kind,s.col);g.restore();
      }
      g.globalAlpha=1;
      // ---- twinkling candy motes ----
      g.save();
      for(const m of motes){
        m.x+=m.sp*0.4*dt;m.y-=m.sp*0.16*dt;m.tw+=0.05*dt;
        if(m.x>api.W)m.x=0;if(m.y<0)m.y=api.H;
        g.globalAlpha=0.10+0.14*(0.5+0.5*Math.sin(m.tw));
        g.fillStyle=m.col;g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();
      }
      g.restore();g.globalAlpha=1;
      // ---- FEVER TIME を実際に減らす(以前はstartFever()でセットするだけで消化されず、にじいろの空/x2が事実上出なかった) ----
      if(feverT>0){feverT=Math.max(0,feverT-0.016*dt);}
      if(feverBanner>0)feverBanner-=0.016*dt;
      // ---- spawn jelly bubbles ----
      if(clearT<=0){spawnT-=dt;if(spawnT<=0){spawn();spawnT=clamp(40-(stage-1)*5,18,40);}}  // 7〜8歳向けに出現を速めた
      // ---- ① にじいろゼリー 予告: 出る場所へ虹の輪が集まってくる(くるかも!のドキドキ) ----
      if(rbTele){
        rbTele.t-=0.016*dt;
        const p=clamp(1-rbTele.t/rbTele.t0,0,1);
        g.save();g.globalCompositeOperation="lighter";
        for(let k=0;k<3;k++){
          const rr=Math.max(0,R*(1.7*(1-p))-k*4);   // 外から中心へ集まる輪
          g.globalAlpha=0.4*(1-p)+0.08;
          g.strokeStyle=COLORS[(k+Math.floor(tsec*6))%COLORS.length];g.lineWidth=3;
          g.beginPath();g.arc(rbTele.x,rbTele.y,rr,0,TAU);g.stroke();
        }
        const cr=Math.max(0,R*0.5*p);               // 中心のきらめきが育つ
        g.globalAlpha=0.5*p;g.fillStyle="#ffffff";g.beginPath();g.arc(rbTele.x,rbTele.y,cr,0,TAU);g.fill();
        g.restore();g.globalAlpha=1;
        if(rbTele.t<=0){spawnRainbow(rbTele.x,rbTele.y);rbTele=null;}
      }
      // ---- update + draw bubbles ----
      for(const b of bubbles){
        b.wob+=b.wobS*dt;b.blink+=0.04*dt;
        // ① にじいろゼリー: 生きている間ずっと虹色に色替わり + たまにキラッ(ひと目で特別と分かる)
        if(b.rainbow){b.col=COLORS[Math.floor(tsec*6+b.wob*2)%COLORS.length];
          if(Math.random()<0.3*dt){const a=rnd(0,TAU),s=rnd(2,4);
            sparks.push({x:b.x+Math.cos(a)*b.r,y:b.y+Math.sin(a)*b.r,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(5,10),life:1,decay:0.08});}}
        if(b.state==="grow"){
          b.r=Math.min(b.max,b.r+b.grow*R*dt);
          b.age+=0.016*dt;
          // squash-pulse as it swells (ぷくっと膨らむ)
          b.squash=1+Math.sin(b.wob)*0.06;
          if(b.age>=b.life){ // bursts on its own (missed it) — combo breaks, ③ ノーミス判定に記録
            b.state="pop";b.pop=1;combo=0;comboT=0;stageMiss++;
            burstFx(b.x,b.y,"#cfd8e0",false,b.r*1.6,b.shape);
            api.noise(0.12,0.12,500,"lowpass",1);api.slide(260,120,0.14,0.12,"sine");
          }
        }else if(b.state==="pop"){
          b.pop-=0.12*dt;if(b.pop<=0)b._dead=true;
        }
        drawBubble(b);
      }
      bubbles=bubbles.filter(b=>!b._dead);
      // ---- shockwave rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);
      // ---- glint sparks (additive) ----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#fff7e0";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;
      sparks=sparks.filter(sp=>sp.life>0);
      // ---- jelly shards (droplets flying out) ----
      for(const s of shards){s.vy+=0.3*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.rot+=s.vr*dt;s.life-=s.decay*dt;
        g.save();g.globalAlpha=Math.max(0,s.life);g.translate(s.x,s.y);g.rotate(s.rot);
        g.fillStyle=s.col;g.beginPath();
        g.ellipse(0,0,s.r*(0.6+s.life*0.5),s.r*(0.5+s.life*0.4),0,0,TAU);g.fill();
        g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(-s.r*0.25,-s.r*0.25,s.r*0.22,0,TAU);g.fill();
        g.restore();}
      g.globalAlpha=1;shards=shards.filter(s=>s.life>0);
      // ---- floating score / combo text ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.02*dt;
        g.save();g.globalAlpha=Math.max(0,f.life);g.textAlign="center";
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=5;g.lineJoin="round";g.strokeStyle="rgba(120,40,90,.5)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.restore();}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // ---- impact flash bloom ----
      if(flash>0){flash-=0.06*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa*0.28;
        g.fillStyle="#fff";g.fillRect(0,0,api.W,api.H);g.restore();}
      // ---- burst-all white flash ----
      if(burstAllT>0){g.save();g.globalAlpha=burstAllT*0.5;g.fillStyle="#fff";
        g.fillRect(0,0,api.W,api.H);g.restore();burstAllT-=0.05*dt;if(burstAllT<0)burstAllT=0;}
      // ---- combo banner (top center only) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.0;
        g.save();g.translate(api.W/2,api.H*0.14);g.scale(pop,pop);
        g.font="800 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(255,120,180,.8)";g.shadowBlur=14;g.fillStyle="#ff4db8";
        g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.7)";g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // ---- ① にじいろゼリー! 発見バナー(虹色に色替わり=激レアの大きな祝福) ----
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3, col=COLORS[Math.floor(tsec*6)%COLORS.length];
        g.save();g.translate(api.W/2,api.H*0.22);g.scale(pop,pop);g.textAlign="center";
        g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.shadowColor=col;g.shadowBlur=18;
        g.fillStyle="#ffffff";g.fillText("にじいろ ゼリー!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろ ゼリー!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ---- ② きょうのラッキー色は◯! 中央上に一度だけ教える ----
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        const pop=1+Math.max(0,luckyMsgT-0.9)*1.2, t2="きょうのラッキー色は "+(COLNAME[luckyColor]||"")+"!";
        g.save();g.translate(api.W/2,api.H*0.29);g.scale(pop,pop);g.textAlign="center";
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.shadowColor=luckyColor;g.shadowBlur=12;
        g.fillStyle="#ffffff";g.fillText(t2,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle=luckyColor;g.strokeText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ---- FEVER TIME! バナー(コンボ0.14/にじいろ0.22/ラッキー0.29と重ならない0.38に配置) ----
      if(feverBanner>0){
        const pop=1+Math.max(0,feverBanner-1.2)*1.3, col=COLORS[Math.floor(tsec*8)%COLORS.length];
        g.save();g.translate(api.W/2,api.H*0.38);g.scale(pop,pop);g.textAlign="center";
        g.font="900 32px 'Hiragino Maru Gothic ProN',system-ui";
        g.globalAlpha=clamp(feverBanner*1.2,0,1);g.shadowColor=col;g.shadowBlur=18;
        g.fillStyle="#ffffff";g.fillText("フィーバー タイム!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("フィーバー タイム!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(feverBanner<0)feverBanner=0;
      }
      // ---- ③ パーフェクト! バナー(クリア文字の下側=重ねない) ----
      if(noMissT>0){noMissT-=0.014*dt;
        const pop=1+Math.max(0,noMissT-1.5)*1.4;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.textAlign="center";
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.globalAlpha=clamp(noMissT*1.3,0,1);g.shadowColor="rgba(120,240,140,.9)";g.shadowBlur=16;
        g.fillStyle="#c7ffcf";g.fillText("パーフェクト!",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,150,70,.7)";g.strokeText("パーフェクト!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(noMissT<0)noMissT=0;}
      // ---- HUD: stage + progress gauge (top center, safe band) ----
      drawHUD();
      // ---- stage clear banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.3,0,1);
        g.save();g.globalAlpha=a*0.4;g.fillStyle="#5a1f4a";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.6)*1.6;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,120,180,.9)";g.shadowBlur=20;g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア!",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("つぎは ステージ"+(clearStage+1)+"!",0,42);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=16;}
      }
      // 白飛び防止の保険: フレーム終端で加算合成を必ず素の合成へ戻す(溜め込み厳禁)
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
    },
    stop(){}
  };
  // ⑤ shapeごとの本体シルエット(0=まる 1=ほし 2=だんご(2段) 3=ながいオーバル)。呼び出し側で fill/stroke する。
  function bodyPath(shape,rad){
    const rr=Math.max(0,rad);
    g.beginPath();
    if(shape===1){ // star jelly
      const pts=5,inset=0.5;
      for(let i=0;i<pts*2;i++){
        const rad2=Math.max(0,i%2===0?rr:rr*inset);
        const ang=-Math.PI/2+i*Math.PI/pts;
        const px=Math.cos(ang)*rad2, py=Math.sin(ang)*rad2;
        if(i===0)g.moveTo(px,py);else g.lineTo(px,py);
      }
      g.closePath();
    }else if(shape===2){ // dango jelly: 縦に2つ重なった団子形
      g.ellipse(0,-rr*0.5,Math.max(0,rr*0.55),Math.max(0,rr*0.48),0,0,TAU);
      g.ellipse(0,rr*0.32,Math.max(0,rr*0.78),Math.max(0,rr*0.68),0,0,TAU);
    }else if(shape===3){ // long oval jelly
      g.ellipse(0,0,Math.max(0,rr*1.35),Math.max(0,rr*0.72),0,0,TAU);
    }else{ // circle jelly(従来どおり)
      g.arc(0,0,rr,0,TAU);
    }
  }
  // ---- a swelling jelly bubble with cute face ----
  function drawBubble(b){
    const sx=b.x,sy=b.y;
    let r=b.r;
    if(b.state==="pop"){
      // burst flare: ring of splashing
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=b.pop*0.6;
      g.fillStyle=b.col;g.beginPath();g.arc(sx,sy,r*(1.4+(1-b.pop)*0.8),0,TAU);g.fill();
      g.restore();return;
    }
    const sq=b.squash, wob=Math.sin(b.wob)*0.04;
    g.save();g.translate(sx,sy);g.rotate(wob);
    // soft drop shadow under (背景の密集したキャンディ山から輪郭が浮くよう濃く・大きく)
    g.fillStyle="rgba(120,40,90,.28)";g.beginPath();g.ellipse(0,r*0.95,Math.max(0,r*1.05),Math.max(0,r*0.29),0,0,TAU);g.fill();
    // jelly body: translucent radial gradient
    g.scale(1/sq,sq);
    // 画像ジェリー: ゴールドは専用スプライトがあればそれを使う(未準備なら従来の手描きへ)。
    // にじいろは生成した画像が毎回玉の途中で割れて写る不良だったため、専用スプライトは使わず
    // 従来の手描き(にじ色サイクル)のままにしてある(issues参照)。
    if(b.gold){
      const spr=api.asset("gold.png");
      if(spr.ready){
        // gold.png はキャンバス下端に切り離れた影の名残りが薄く残る影響で、玉の実体が
        // キャンバス中心よりやや上(縦21%)・やや左(横7%)に寄っている。中心を実体に合わせて微調整。
        api.drawSrc(spr,r*0.28,r*0.82,r*3.85,r*3.85,{center:true});
        // 割れる直前の警告リング(画像でも残す=気づきの手がかり)
        if(b.life-b.age<0.5&&Math.floor(b.age*16)%2===0){
          g.strokeStyle="rgba(255,90,150,.7)";g.lineWidth=3;
          g.beginPath();g.arc(0,0,Math.max(0,r*1.04),0,TAU);g.stroke();
        }
        g.restore();return;
      }
    }
    // ⑤ 形のバラエティ: shapeごとに本体シルエットを変える(丸だけ=色違いのみ、を回避)
    const shape=b.shape||0;
    const fy=shape===2?r*0.32:0;  // だんご形は下側の大きい玉に顔が乗るようずらす
    const bg=g.createRadialGradient(-r*0.3,-r*0.35+fy,Math.max(0,r*0.1),0,fy,Math.max(0,r*1.15));
    bg.addColorStop(0,lighten(b.col,90));bg.addColorStop(0.5,lighten(b.col,30));bg.addColorStop(1,b.col);
    g.fillStyle=bg;bodyPath(shape,r);g.fill();
    // inner jelly glow ring(強化: 背景のキャンディ群と輪郭が同化しないよう太く・濃く)
    g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.55;
    g.strokeStyle=lighten(b.col,70);g.lineWidth=Math.max(0,r*0.16);
    g.beginPath();g.arc(0,fy,Math.max(0,r*0.7),0,TAU);g.stroke();g.restore();
    // big glossy highlight
    g.fillStyle="rgba(255,255,255,.7)";g.beginPath();
    g.ellipse(-r*0.32,-r*0.38+fy,Math.max(0,r*0.26),Math.max(0,r*0.16),-0.5,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.45)";g.beginPath();g.arc(r*0.3,r*0.28+fy,Math.max(0,r*0.1),0,TAU);g.fill();
    // rim light(本体と同じ輪郭でふちどる)
    g.strokeStyle="rgba(255,255,255,.45)";g.lineWidth=2;bodyPath(shape,r);g.stroke();
    // near-bursting warning: a quick wiggle outline when about to pop
    if(b.life-b.age<0.5&&Math.floor(b.age*16)%2===0){
      g.strokeStyle="rgba(255,90,150,.7)";g.lineWidth=3;
      g.beginPath();g.arc(0,fy,Math.max(0,r*1.04),0,TAU);g.stroke();
    }
    // cute face (scales with the bubble)
    const blink=Math.sin(b.blink)>0.93?0.12:1;
    g.fillStyle="#3a2030";
    g.beginPath();g.ellipse(-r*0.26,-r*0.05+fy,Math.max(0,r*0.1),Math.max(0,r*0.13*blink),0,0,TAU);g.fill();
    g.beginPath();g.ellipse(r*0.26,-r*0.05+fy,Math.max(0,r*0.1),Math.max(0,r*0.13*blink),0,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.9)";
    g.beginPath();g.arc(-r*0.29,-r*0.1+fy,Math.max(0,r*0.035),0,TAU);g.arc(r*0.23,-r*0.1+fy,Math.max(0,r*0.035),0,TAU);g.fill();
    // rosy cheeks
    g.fillStyle="rgba(255,120,160,.4)";
    g.beginPath();g.arc(-r*0.4,r*0.1+fy,Math.max(0,r*0.11),0,TAU);g.arc(r*0.4,r*0.1+fy,Math.max(0,r*0.11),0,TAU);g.fill();
    // smile
    g.strokeStyle="#3a2030";g.lineWidth=Math.max(2,r*0.06);g.lineCap="round";
    g.beginPath();g.arc(0,r*0.04+fy,Math.max(0,r*0.22),0.12*Math.PI,0.88*Math.PI);g.stroke();
    // ② ラッキー色のヒント: 頭の上で小さな星がときどきキラッ(その色が当たりだと気づける手がかり)
    if(b.col===luckyColor&&!b.gold&&!b.rainbow){
      const tw=0.5+0.5*Math.sin(b.blink*2.1);
      if(tw>0.45){const rr=Math.max(0,r*0.2*tw);
        g.save();g.globalAlpha=(tw-0.45)*1.6;g.fillStyle="#fffbe0";g.translate(0,-r*1.12);
        g.beginPath();
        g.moveTo(0,-rr);g.lineTo(rr*0.28,-rr*0.28);g.lineTo(rr,0);g.lineTo(rr*0.28,rr*0.28);
        g.lineTo(0,rr);g.lineTo(-rr*0.28,rr*0.28);g.lineTo(-rr,0);g.lineTo(-rr*0.28,-rr*0.28);
        g.closePath();g.fill();g.restore();}
    }
    g.restore();
  }
  // ---- background candy sweets (drawn around origin, ~40px) ----
  function drawSweet(kind,col){
    if(kind===0){ // candy cane swirl lollipop
      g.fillStyle="rgba(160,90,60,.8)";g.fillRect(-2,4,4,28);
      g.fillStyle="#fff";g.beginPath();g.arc(0,0,16,0,TAU);g.fill();
      g.strokeStyle=col;g.lineWidth=5;
      for(let i=0;i<3;i++){g.beginPath();g.arc(0,0,5+i*5,i*1.2,i*1.2+TAU*0.7);g.stroke();}
    }else if(kind===1){ // gumdrop
      g.fillStyle=col;g.beginPath();g.arc(0,0,15,Math.PI,TAU);g.lineTo(15,8);g.lineTo(-15,8);g.closePath();g.fill();
      g.fillStyle="rgba(255,255,255,.4)";g.beginPath();g.ellipse(-5,-4,5,3,-0.4,0,TAU);g.fill();
    }else if(kind===2){ // chocolate heart
      g.fillStyle=col;
      g.beginPath();g.moveTo(0,12);g.bezierCurveTo(-16,-2,-8,-14,0,-5);
      g.bezierCurveTo(8,-14,16,-2,0,12);g.closePath();g.fill();
      g.fillStyle="rgba(255,255,255,.35)";g.beginPath();g.arc(-5,-4,3,0,TAU);g.fill();
    }else{ // wrapped candy
      g.fillStyle=col;g.beginPath();g.ellipse(0,0,12,9,0,0,TAU);g.fill();
      g.fillStyle=col;
      g.beginPath();g.moveTo(12,0);g.lineTo(22,-7);g.lineTo(20,0);g.lineTo(22,7);g.closePath();g.fill();
      g.beginPath();g.moveTo(-12,0);g.lineTo(-22,-7);g.lineTo(-20,0);g.lineTo(-22,7);g.closePath();g.fill();
      g.fillStyle="rgba(255,255,255,.4)";g.beginPath();g.ellipse(-3,-3,4,2.5,-0.5,0,TAU);g.fill();
    }
  }
  function drawHUD(){
    const left=clamp(stageGoal-stagePop,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.045;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(120,40,90,.5)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(120,40,90,.28)";roundRect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stagePop/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#9be8ff");gg.addColorStop(1,"#ff8fcf");
      g.fillStyle=gg;roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=2;roundRect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function lighten(hex,amt){const a=amt===undefined?50:amt;const c=parseInt(hex.slice(1),16);
    const r=Math.min(255,((c>>16)&255)+a),gg=Math.min(255,((c>>8)&255)+a),b=Math.min(255,(c&255)+a);
    return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("jellypop", build_jellypop);
