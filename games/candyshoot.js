function buildCandyshoot(api){
  const g=api.g;
  api.preload(["bg.jpg","gold.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。cannon.pngは生成不良のため不使用(issues参照)
  let targets=[],bullets=[],shards=[],rings=[],sparks=[],motes=[],clouds=[],floats=[];
  let cannonX,cannonY,R,spawnT=0,count=0,combo=0,comboT=0,tsec=0,flash=0,flashHue="#fff";
  let firstSpawned=false; // 【軸3(b)】このプレイ最初の1匹だけ特別扱い(大きく・遅く・中央寄り)
  let charge=0,charging=false,aimX=0,aimY=0,recoil=0,muzzle=0;
  // fever + rare-gold + hitstop cooldown state
  let fever=0,feverT=0,feverHue=0,hsCd=0;
  // stage progression
  const STAGES=5;
  let stage=1,stageKill=0,stageGoal=8,clearT=0,clearStage=0,endingT=0,celebrate=0;
  const PASTEL=["#ff9ec4","#ffd23f","#9be8ff","#b9f5b0","#c9a8ff","#ffb073","#ff7bb8"];
  // candy-land sky per stage (top-to-bottom pastel gradient)
  const STAGE_SKY=[
    ["#ffe3f1","#ffd0e6","#ffbcd9","#ff9ec4"], // 1 strawberry
    ["#fff3d0","#ffe6a8","#ffd682","#ffc35a"], // 2 lemon cream
    ["#e0f5ff","#c2ecff","#a8def5","#8fcbe8"], // 3 soda mint
    ["#efe2ff","#dcc6ff","#c9a8ff","#b58bf0"], // 4 grape
    ["#ffe9d6","#ffd2b0","#ffba8a","#ff9e6a"]  // 5 caramel
  ];
  function sky(){return STAGE_SKY[(stage-1)%STAGE_SKY.length];}
  function stageGoalFor(s){return 10+(s-1)*3;}   // 7〜8歳向けに手応えを増やした(8,10,12,14,16 → 10,13,16,19,22)
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  const PASTELNAME={"#ff9ec4":"ももいろ","#ffd23f":"きいろ","#9be8ff":"みずいろ","#b9f5b0":"きみどり","#c9a8ff":"むらさき","#ffb073":"オレンジ","#ff7bb8":"ピンク"};
  let luckyColor=pick(["#ff9ec4","#ffd23f","#9be8ff","#b9f5b0","#c9a8ff","#ffb073","#ff7bb8"]); // ② きょうのラッキー色(秘密の1色)
  let luckySeen=false,luckyMsgT=0;
  let rbMsgT=0;                       // ① にじいろキャンディ 発見バナー
  let rbTele=0,rbTeleSide=1,rbTeleY=0;// ① 接近予告(はしっこの虹矢印)
  let stageMiss=0,noMissT=0;          // ③ パーフェクト判定(このステージで逃したキャンディ数)
  let star=null,starTimer=rnd(320,620);// ④ ながれ星(ひみつ発見)
  function buildBg(){
    clouds=[];for(let i=0;i<5;i++)clouds.push({x:rnd(0,api.W),y:api.H*rnd(0.06,0.34),s:rnd(0.7,1.5),sp:rnd(0.05,0.14),a:rnd(0.5,0.8),col:pick(["#fff","#ffe3f1","#fff3d0"])});
    motes=[];for(let i=0;i<22;i++)motes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(1.2,3.6),sp:rnd(0.1,0.4),tw:rnd(0,TAU),col:pick(PASTEL)});
  }
  function layout(){
    cannonX=api.W/2;cannonY=api.H*0.92;
    R=clamp(Math.min(api.W,api.H)*0.05,22,46);
    buildBg();
  }
  layout();
  buildBg();
  function spawn(){
    // 【軸3(b)】このプレイの最初の1匹だけ、大きく・遅く・大砲の真上寄り(中心x・画面中央あたりのy)にして
    // 「どこを狙ってもだいたい当たる」位置に置き、最初の成功までの時間を縮める。
    // (画面の端から出す/上のほうに置くと、狙いのズレが大きく増幅されてかえって当たりにくくなるため、
    //  大砲のx・タップの重心に近いy=中央付近に据える)
    if(!firstSpawned&&stage===1&&count===0){
      firstSpawned=true;
      const fromLeft=Math.random()<0.5,r=R*1.6,ty2=api.H*0.48,speed2=0.35;
      const x0=api.W/2+(fromLeft?-1:1)*r*1.6;
      targets.push({x:x0,y:ty2,vx:(fromLeft?1:-1)*speed2,
        r,kind:"candy",hp:1,col:pick(PASTEL),col2:pick(PASTEL),bob:rnd(0,TAU),
        spin:rnd(0,TAU),vs:rnd(-0.03,0.03)*(fromLeft?1:-1),flash:0,dy:0,lucky:false});
      return;
    }
    // ① にじいろキャンディ: stage2以降 低確率(約5%)。すぐには出さず、はしっこに虹の矢印で予告し、少し遅れて登場(ドキドキ)。
    if(stage>=2&&rbTele<=0&&!targets.some(t=>t.kind==="rainbow")&&Math.random()<0.05){
      rbTele=54;rbTeleSide=Math.random()<0.5?1:-1;rbTeleY=rnd(api.H*0.18,api.H*0.46);
      api.tone(1318,0.09,"sine",0.06);return;
    }
    const fromLeft=Math.random()<0.5;
    const ty=rnd(api.H*0.16,api.H*0.5);
    const speed=clamp(0.75+(stage-1)*0.22,0.75,2.6)*rnd(0.85,1.15);  // 7〜8歳向けに少し速く
    const kinds=["candy","candy","choco","gummy"];
    if(stage>=2)kinds.push("cake");
    if(stage>=3)kinds.push("lolli");
    if(stage>=4)kinds.push("donut");
    let kind=pick(kinds);
    // rare golden star candy (~7%): big points + fanfare when popped
    if(Math.random()<0.07)kind="gold";
    let hp=1,r=R*rnd(0.85,1.15);
    if(kind==="cake"){hp=2;r=R*1.6;}          // 【軸7】大きい物として明確化
    else if(kind==="gummy"){r=R*rnd(0.6,0.75);} // 【軸7】小さい物として明確化
    else if(kind==="lolli"){r=R*0.95;}
    else if(kind==="donut"){r=R*1.05;}
    else if(kind==="gold"){r=R;
      api.tone(1568,0.14,"triangle",0.09);api.tone(2093,0.18,"triangle",0.06);}
    const col=kind==="gold"?"#ffd23f":pick(PASTEL);
    // ② ラッキー色: 色を持つふつうのお菓子だけが対象(チョコ/ケーキ/ゴールドは対象外)
    const lucky=(kind==="candy"||kind==="gummy"||kind==="lolli"||kind==="donut")&&col===luckyColor;
    targets.push({x:fromLeft?-r-10:api.W+r+10,y:ty,vx:(fromLeft?1:-1)*speed,
      r,kind,hp,col,col2:pick(PASTEL),bob:rnd(0,TAU),
      spin:rnd(0,TAU),vs:rnd(-0.03,0.03)*(fromLeft?1:-1),flash:0,dy:0,lucky});
  }
  function spawnRainbow(side,ty){
    // ① にじいろキャンディ本体: 予告のあとに登場する激レア。虹色に光り、割ると大量得点。
    const fromLeft=side>0,r=R*1.12;
    const speed=clamp(0.7+(stage-1)*0.1,0.7,1.5);
    targets.push({x:fromLeft?-r-10:api.W+r+10,y:ty,vx:(fromLeft?1:-1)*speed,
      r,kind:"rainbow",hp:1,col:"#ff6fae",col2:"#9be8ff",bob:rnd(0,TAU),
      spin:rnd(0,TAU),vs:rnd(-0.02,0.02)*(fromLeft?1:-1),flash:0,dy:0,lucky:false});
  }
  function spawnStar(){
    // ④ ながれ星: 上空をスーッと流れる。撃ち落とすとキラキラ＋小ボーナス(逃しても減点なし)。
    const fromLeft=Math.random()<0.5,sp=rnd(3.4,4.6);
    star={x:fromLeft?-20:api.W+20,y:rnd(api.H*0.1,api.H*0.3),vx:(fromLeft?1:-1)*sp,
      vy:rnd(0.6,1.4),r:R*0.62,life:1,trail:[]};
  }
  function starHit(){
    if(!star)return;
    const x=star.x,y=star.y;star=null;starTimer=rnd(380,700);
    count+=2;api.setScore(count);
    flash=Math.min(1,flash+0.22);flashHue="#fff3c0";api.shake(6);api.boom(0.3);
    api.tone(1568,0.12,"triangle",0.1);api.tone(2093,0.14,"triangle",0.07);
    floats.push({x,y:y-R,txt:"ながれ星！＋2",life:1,vy:-0.9,col:"#fff3c0",size:30});
    for(let i=0;i<16;i++){const a=i/16*TAU,sd=rnd(3,8);
      shards.push({x,y,vx:Math.cos(a)*sd,vy:Math.sin(a)*sd-2,r:rnd(3,7),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),
        life:1,decay:rnd(0.014,0.024),col:i%2?"#fff":"#ffe9a8",shape:2});}
    rings.push({x,y,r:Math.max(0,R*0.3),vr:R*0.7,life:1,decay:0.05,col:"#fff3c0"});
  }
  function rainbowBurst(x,y){
    // ① にじいろ撃破: 虹の輪＋虹の破片が大盤振る舞い(白飛びしないよう flash は控えめ＆すぐ引く)。
    flash=Math.min(1,flash+0.4);flashHue="#ffd6f0";api.shake(14);api.boom(0.6);
    if(hsCd<=0){api.hitStop(4);hsCd=32;}
    api.slide(660,1320,0.4,0.2,"triangle");
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.14,"triangle",0.1),i*60));
    for(let i=0;i<26;i++){const a=i/26*TAU,sd=rnd(4,11);
      shards.push({x,y,vx:Math.cos(a)*sd,vy:Math.sin(a)*sd-2.5,r:rnd(4,9),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),
        life:1,decay:rnd(0.01,0.018),col:"hsl("+(i*14)+",90%,64%)",shape:rint(0,2)});}
    const rbc=["#ff6fae","#ffd23f","#9be8ff","#b9f5b0","#c9a8ff"];
    for(let k=0;k<5;k++)rings.push({x,y,r:Math.max(0,R*0.4),vr:R*(0.6+k*0.14),life:1,decay:0.045,col:rbc[k]});
    if(shards.length>170)shards.splice(0,shards.length-170);
  }
  function shoot(){
    const dx=aimX-cannonX,dy=aimY-cannonY;
    const d=Math.max(1,Math.hypot(dx,dy));
    const power=0.6+charge*0.6;        // charge 0..1 -> bigger, slightly faster
    const spd=13+charge*5;
    bullets.push({x:cannonX,y:cannonY-R*0.9,vx:dx/d*spd,vy:dy/d*spd,
      r:R*(0.34+charge*0.5)*(feverT>0?1.2:1),big:charge>0.6||feverT>0,col:pick(PASTEL),life:1,trail:[]});
    recoil=1;muzzle=1;
    api.slide(charge>0.6?520:680,180,0.12,0.26,"square");
    api.noise(0.06,0.12,1600,"highpass");
    if(charge>0.6){api.boom(0.45);api.shake(6);}
    charge=0;charging=false;
  }
  function hitFx(x,y,col,big,kind){
    flash=Math.min(1,flash+(big?0.5:0.28));flashHue=col;
    rings.push({x,y,r:R*0.4,vr:big?R*0.7:R*0.5,life:1,decay:0.05,col});
    rings.push({x,y,r:R*0.2,vr:R*0.4,life:1,decay:0.06,col:"#fff"});
    const n=(big?18:11)+Math.min(combo,6);
    // 【軸7】壊れ方の違い: donutは水平に吹っ飛ぶ、cakeはゆっくり崩れる大きい欠片、それ以外は素早く砕ける
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(2.5,big?10:7);
      if(kind==="donut"){
        shards.push({x,y,vx:Math.cos(a)*(s+6)*(a<Math.PI?1:-1),vy:Math.sin(a)*s*0.4-1,r:rnd(3,8),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.022),
          col:i%3===0?col:(i%3===1?"#fff":pick(PASTEL)),shape:rint(0,2)});
      }else if(kind==="cake"){
        shards.push({x,y,vx:Math.cos(a)*s*0.5,vy:Math.sin(a)*s*0.5-1.2,r:rnd(6,12),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.006,0.012),
          col:i%3===0?col:(i%3===1?"#fff":pick(PASTEL)),shape:rint(0,2)});
      }else{
        shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(3,8),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.022),
          col:i%3===0?col:(i%3===1?"#fff":pick(PASTEL)),shape:rint(0,2)});
      }}
    for(let i=0;i<rint(5,8);i++){const a=rnd(0,TAU),s=rnd(4,11);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,18),life:1,decay:rnd(0.05,0.09)});}
  }
  function pop(t,bx,by,big){
    t.hp-=(feverT>0?99:1);           // fever: everything pops in one hit
    if(t.hp>0){t.flash=1;hitFx(bx,by,"#fff",false);
      api.slide(420,300,0.08,0.16,"square");api.noise(0.05,0.1,1400);api.shake(3);return false;}
    t._dead=true;
    let gain=t.kind==="cake"?3:(t.kind==="lolli"||t.kind==="donut"?2:(t.kind==="gold"?5:(t.kind==="rainbow"?8:1)));
    // ② ラッキー色: 今日の秘密の色を割ると +1 の隠しボーナス。気づくと得する。
    if(t.lucky){gain+=1;luckyMsgT=luckySeen?Math.max(luckyMsgT,0.7):1.6;luckySeen=true;}
    if(feverT>0)gain*=2;             // fever: double points
    count+=gain;stageKill++;api.setScore(count);combo++;comboT=0.9;
    api.tone(440*Math.pow(2,clamp(combo,0,12)/12),0.12,"triangle",0.13);
    api.slide(300,140,0.12,0.28,"square");api.noise(0.1,0.16,1700);
    api.boom(big?0.55:0.4);api.shake(5+Math.min(combo,8));
    // hitStop: big-hit / gold / combo milestone only, with cooldown
    if((big||t.kind==="gold"||(combo>=5&&combo%5===0))&&hsCd<=0){api.hitStop(big?4:3);hsCd=32;}
    hitFx(t.x,t.y+t.dy,t.col,big||combo>=5,t.kind);
    if(t.kind==="gold"){
      goldBurst(t.x,t.y+t.dy);
      floats.push({x:t.x,y:t.y-t.r-8,txt:"ゴールド！＋"+gain,life:1,vy:-0.9,col:"#ffd23f",size:34});
    }
    if(t.kind==="rainbow"){
      rainbowBurst(t.x,t.y+t.dy);rbMsgT=1.5;
      floats.push({x:t.x,y:t.y-t.r-8,txt:"にじいろ！＋"+gain,life:1,vy:-0.9,col:"#ff6fae",size:38});
    }
    if(t.lucky){
      api.tone(1046,0.12,"triangle",0.11);api.tone(1568,0.14,"triangle",0.08);
      for(let i=0;i<8;i++){const a=rnd(0,TAU),s2=rnd(2,6);
        shards.push({x:t.x,y:t.y+t.dy,vx:Math.cos(a)*s2,vy:Math.sin(a)*s2-2,r:rnd(3,6),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:luckyColor,shape:0});}
      floats.push({x:t.x,y:t.y-t.r-6,txt:"ラッキー！",life:1,vy:-0.9,col:luckyColor,size:26});
    }
    if(combo>1)floats.push({x:t.x,y:t.y-t.r,txt:"x"+combo,life:1,vy:-1.1,
      col:combo>=8?"#ff2bff":combo>=4?"#ff7bb8":"#ffd23f",size:combo>=4?38:28});
    if(combo>=3){celebrate=Math.min(1.4,0.6+combo*0.06);}
    // fever gauge fills with every pop; gold gives a big chunk
    if(feverT<=0){fever=Math.min(1,fever+(t.kind==="gold"?0.34:0.07));
      if(fever>=1)startFever();}
    checkStage();
    return true;
  }
  function goldBurst(x,y){
    flash=1;flashHue="#ffd23f";api.shake(10);api.boom(0.6);
    [0,4,7,12].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.16,"triangle",0.12),i*70));
    for(let i=0;i<20;i++){const a=i/20*TAU,sd=rnd(4,10);
      shards.push({x,y,vx:Math.cos(a)*sd,vy:Math.sin(a)*sd-2.5,r:rnd(4,9),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),
        life:1,decay:rnd(0.01,0.018),col:"hsl("+(i*18)+",95%,65%)",shape:rint(0,2)});}
    rings.push({x,y,r:R*0.5,vr:R*0.9,life:1,decay:0.04,col:"#ffd23f"});
    if(shards.length>170)shards.splice(0,shards.length-170);
  }
  function startFever(){
    feverT=10;fever=1;flash=1;flashHue="#ff7bb8";
    api.boom(0.7);api.shake(16);api.slide(220,1760,0.5,0.22,"square");
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(523*Math.pow(2,s/12),0.14,"triangle",0.12),i*60));
    floats.push({x:api.W/2,y:api.H*0.3,txt:"フィーバー！！",life:1,vy:-0.3,col:"#ff2bff",size:46});
    for(let i=0;i<16;i++){const a=rnd(0,TAU),s2=rnd(3,9);
      shards.push({x:api.W/2,y:api.H*0.35,vx:Math.cos(a)*s2,vy:Math.sin(a)*s2-2,r:rnd(4,8),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.012,col:"hsl("+rint(0,360)+",95%,65%)",shape:rint(0,2)});}
    if(shards.length>170)shards.splice(0,shards.length-170);
  }
  function checkStage(){
    if(stageKill<stageGoal||clearT>0||endingT>0)return;
    // ③ パーフェクト: このステージで1こも逃さなかったら +3 & きみどりの星シャワー＆祝福バナー。
    //    「飛んでいくお菓子を全部おとす」= 気づくと得する頭の使いどころ(むずかしい操作は不要)。
    const perfect=stageMiss===0;
    if(perfect){count+=3;api.setScore(count);noMissT=1.9;api.tone(1318,0.16,"triangle",0.12);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(3,8);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(4,8),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:"#b9f5b0",shape:rint(0,2)});}}
    stageMiss=0;
    if(stage>=STAGES){
      endingT=2.4;celebrate=1.4;flash=1;flashHue="#ffd23f";api.boom(0.7);api.shake(18);
      api.slide(523,1046,0.5,0.22,"triangle");
    }else{
      clearStage=stage;clearT=1.6;celebrate=1;flash=0.7;flashHue=sky()[3];
      api.boom(0.5);api.shake(12);api.slide(523,784,0.3,0.2,"triangle");
      api.tone(660,0.25,"triangle",0.14);api.tone(988,0.3,"triangle",0.1);
      for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(PASTEL),shape:rint(0,2)});}
      stage++;stageGoal=stageGoalFor(stage);stageKill=0;buildBg();
    }
  }
  return{
    resize:layout,
    input(px,py,type){
      if(type==="down"){
        if(clearT>0||endingT>0)return;
        aimX=px;aimY=py;charging=true;charge=0;
        api.tone(300,0.05,"sine",0.08);
        return;
      }
      // track aim while holding
      if(type==="move"&&charging){aimX=px;aimY=py;return;}
      if(type==="up"){
        if(!charging)return;
        aimX=px;aimY=py;
        if(clearT>0||endingT>0){charging=false;charge=0;return;}
        shoot();
        return;
      }
    },
    frame(dt,now){
      tsec+=0.016*dt;
      if(recoil>0)recoil=Math.max(0,recoil-0.08*dt);
      if(muzzle>0)muzzle=Math.max(0,muzzle-0.12*dt);
      if(celebrate>0)celebrate=Math.max(0,celebrate-0.02*dt);
      if(charging)charge=Math.min(1,charge+0.018*dt);
      if(hsCd>0)hsCd-=dt;
      const paused=clearT>0||endingT>0;
      // fever countdown
      if(feverT>0){feverHue+=4*dt;
        if(!paused){feverT-=0.016*dt;
          if(feverT<=0){feverT=0;fever=0;
            api.slide(880,220,0.4,0.16,"triangle");
            floats.push({x:api.W/2,y:api.H*0.3,txt:"フィーバー おわり",life:1,vy:-0.4,col:"#fff",size:24});}}}
      // ---- background: candy sky (画像 cover-fit、無ければ従来のグラデーション) ----
      const sk=sky();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージのパレット色を薄く重ねてステージごとの雰囲気を変える(1面はそのまま)
        if((stage-1)%STAGE_SKY.length!==0){
          g.save();g.globalAlpha=0.24;
          const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,sk[0]);tg.addColorStop(0.4,sk[1]);tg.addColorStop(0.74,sk[2]);tg.addColorStop(1,sk[3]);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();
        }
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,sk[0]);grd.addColorStop(0.4,sk[1]);grd.addColorStop(0.74,sk[2]);grd.addColorStop(1,sk[3]);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // fever rainbow wash over the sky
      if(feverT>0){g.save();g.globalCompositeOperation="lighter";
        const fg=g.createLinearGradient(0,0,api.W,api.H);
        for(let i=0;i<=4;i++)fg.addColorStop(i/4,"hsla("+((feverHue*2+i*70)%360)+",90%,60%,"+(0.13+0.05*Math.sin(tsec*6))+")");
        g.fillStyle=fg;g.fillRect(0,0,api.W,api.H);g.restore();}
      // soft sweet sun-glow upper area
      let glow=g.createRadialGradient(api.W*0.5,api.H*0.08,0,api.W*0.5,api.H*0.08,api.W*0.7);
      glow.addColorStop(0,"rgba(255,255,255,.4)");glow.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=glow;g.fillRect(0,0,api.W,api.H);
      // drifting candy clouds (puffy + a cherry on top) ※画像背景のときは絵に雲があるので描かない
      if(!imgBg) for(const c of clouds){
        c.x+=c.sp*dt;if(c.x>api.W+90*c.s)c.x=-90*c.s;
        g.save();g.globalAlpha=c.a;g.fillStyle=c.col;const w=46*c.s;
        g.beginPath();
        g.ellipse(c.x,c.y,w,w*0.55,0,0,TAU);
        g.ellipse(c.x+w*0.8,c.y+w*0.14,w*0.7,w*0.45,0,0,TAU);
        g.ellipse(c.x-w*0.8,c.y+w*0.16,w*0.62,w*0.4,0,0,TAU);
        g.fill();
        g.fillStyle="#ff6f91";g.beginPath();g.arc(c.x,c.y-w*0.5,w*0.14,0,TAU);g.fill();
        g.restore();
      }
      g.globalAlpha=1;
      // twinkling sugar motes
      for(const m of motes){
        m.x+=m.sp*0.4*dt;m.y-=m.sp*0.2*dt;m.tw+=0.05*dt;
        if(m.x>api.W)m.x=0;if(m.y<0)m.y=api.H;
        g.globalAlpha=0.2+0.25*(0.5+0.5*Math.sin(m.tw));
        g.fillStyle=m.col;g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();
      }
      g.globalAlpha=1;
      // ---- spawn flying candies ----
      if(!paused){spawnT-=dt;if(spawnT<=0){spawn();spawnT=clamp(64-(stage-1)*7,30,64);  // 7〜8歳向けに少し速く
        if(feverT>0)spawnT*=0.45;}   // fever: candies pour in
        // ① にじいろ 予告カウント。満了で本体登場
        if(rbTele>0){rbTele-=dt;if(rbTele<=0)spawnRainbow(rbTeleSide,rbTeleY);}
        // ④ ながれ星 出現タイマー(画面に無い時だけ数える)
        if(!star){starTimer-=dt;if(starTimer<=0)spawnStar();}
        else{star.x+=star.vx*dt;star.y+=star.vy*dt;
          star.trail.push({x:star.x,y:star.y});if(star.trail.length>10)star.trail.shift();
          if(star.x<-60||star.x>api.W+60||star.y>api.H*0.62){star=null;starTimer=rnd(380,700);}}
      }
      // ---- update + draw targets ----
      for(const t of targets){
        if(t.flash>0)t.flash-=0.08*dt;
        if(!paused){t.x+=t.vx*dt;}
        t.bob+=0.06*dt;t.spin+=t.vs*dt;
        // ③ 画面外へ逃げた=ミス(ゴールド/にじいろは対象外=逃してもパーフェクト継続)
        if(t.x<-t.r-40||t.x>api.W+t.r+40){
          if(!t._dead&&!paused&&t.kind!=="gold"&&t.kind!=="rainbow")stageMiss++;
          t._dead=true;}
        t.dy=Math.sin(t.bob)*(t.kind==="donut"?R*0.7:R*0.12);  // donut floats in big waves
        drawTarget(t,t.x,t.y+t.dy);
        // ② ラッキー色ヒント: 頭上に小さな星がキラッ(気づける手がかり)
        if(t.lucky&&!t._dead){const tw=0.5+0.5*Math.sin(tsec*7+t.bob);
          g.save();g.globalAlpha=0.45+0.5*tw;g.translate(t.x,t.y+t.dy-t.r*1.28);
          const sc=0.5+0.16*tw;g.scale(sc,sc);
          g.fillStyle=luckyColor;g.shadowColor=luckyColor;g.shadowBlur=8;
          drawStarP(R*0.34);g.restore();g.globalAlpha=1;g.shadowBlur=0;}
      }
      targets=targets.filter(t=>!t._dead);
      // ④ ながれ星の描画(お菓子の上・UIの下)
      if(star)drawStar2(star);
      // ---- update bullets + collision ----
      for(const b of bullets){
        if(!paused){
          b.x+=b.vx*dt;b.y+=b.vy*dt;
          b.trail.push({x:b.x,y:b.y});if(b.trail.length>8)b.trail.shift();
          if(b.x<-40||b.x>api.W+40||b.y<-40)b.life=0;
          for(const t of targets){
            if(t._dead)continue;
            if(Math.hypot(b.x-t.x,b.y-(t.y+t.dy))<t.r+b.r){
              pop(t,b.x,b.y,b.big);
              if(!b.big){b.life=0;}      // normal candy spends itself; big one pierces
              else b.r*=0.9;
              break;
            }
          }
          // ④ ながれ星に当たったら ごほうび(逃しても減点なし)
          if(b.life>0&&star&&Math.hypot(b.x-star.x,b.y-star.y)<star.r+b.r+8){
            starHit();if(!b.big)b.life=0;else b.r*=0.9;}
        }
        // draw bullet trail (additive sweet glow)
        g.save();g.globalCompositeOperation="lighter";
        for(let i=0;i<b.trail.length;i++){const tr=b.trail[i],a=i/b.trail.length;
          g.globalAlpha=a*0.5;g.fillStyle=b.col;
          g.beginPath();g.arc(tr.x,tr.y,b.r*a,0,TAU);g.fill();}
        g.restore();g.globalAlpha=1;
        // bullet itself: glossy candy ball
        g.save();g.shadowColor=b.col;g.shadowBlur=12;
        const bg=g.createRadialGradient(b.x-b.r*0.3,b.y-b.r*0.3,b.r*0.1,b.x,b.y,b.r);
        bg.addColorStop(0,"#fff");bg.addColorStop(0.5,b.col);bg.addColorStop(1,shade(b.col,-40));
        g.fillStyle=bg;g.beginPath();g.arc(b.x,b.y,b.r,0,TAU);g.fill();g.restore();
        g.fillStyle="rgba(255,255,255,.8)";g.beginPath();g.arc(b.x-b.r*0.32,b.y-b.r*0.32,b.r*0.22,0,TAU);g.fill();
      }
      bullets=bullets.filter(b=>b.life>0);
      // ---- shards (candy crumbs) ----
      for(const s of shards){s.vy+=0.32*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.rot+=s.vr*dt;s.life-=s.decay*dt;
        g.save();g.globalAlpha=Math.max(0,s.life);g.translate(s.x,s.y);g.rotate(s.rot);
        g.shadowColor=s.col;g.shadowBlur=6;g.fillStyle=s.col;
        const rr=s.r*(0.6+s.life*0.4);
        if(s.shape===0){g.beginPath();g.arc(0,0,rr,0,TAU);g.fill();}
        else if(s.shape===1){g.fillRect(-rr*0.7,-rr*0.7,rr*1.4,rr*1.4);}
        else{drawStarP(rr);}
        g.restore();}
      g.globalAlpha=1;g.shadowBlur=0;shards=shards.filter(s=>s.life>0&&s.y<api.H+40);
      // ---- rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);
      // ---- sparks ----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#fff7c2";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;sparks=sparks.filter(sp=>sp.life>0);
      // ---- aim guide while charging ----
      if(charging&&!paused){
        const dx=aimX-cannonX,dy=aimY-(cannonY-R*0.9),d=Math.max(1,Math.hypot(dx,dy));
        const ux=dx/d,uy=dy/d;
        g.save();g.globalAlpha=0.5;g.fillStyle="rgba(255,255,255,.7)";
        for(let i=1;i<=6;i++){const dist=i*R*0.9*(1+charge);
          g.globalAlpha=0.5*(1-i/8);
          g.beginPath();g.arc(cannonX+ux*dist,(cannonY-R*0.9)+uy*dist,3+i*0.5,0,TAU);g.fill();}
        g.restore();g.globalAlpha=1;
      }
      // ---- cannon (cute candy gun) ----
      drawCannon();
      // ---- combo / floats ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.018*dt;
        g.save();g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(120,40,90,.5)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.restore();}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // ---- celebration color-wash ----
      if(celebrate>0){const ca=Math.min(1,celebrate);
        g.save();g.globalCompositeOperation="lighter";
        const cw=g.createRadialGradient(api.W/2,api.H*0.45,0,api.W/2,api.H*0.45,api.W*0.75);
        cw.addColorStop(0,"rgba(255,230,245,"+(0.4*ca)+")");
        cw.addColorStop(0.5,"rgba(255,200,230,"+(0.2*ca)+")");
        cw.addColorStop(1,"rgba(255,200,230,0)");
        g.fillStyle=cw;g.fillRect(0,0,api.W,api.H);g.restore();}
      // ---- impact flash ----
      if(flash>0){flash-=0.06*dt;
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=Math.max(0,flash)*0.3;
        g.fillStyle=flashHue;g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      // ---- combo text (top center) ----
      if(combo>1){
        const popS=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.16);g.scale(popS,popS);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(255,120,180,.8)";g.shadowBlur=14;
        g.fillStyle="#ffd23f";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.7)";
        g.strokeText("コンボ x"+combo,0,0);g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // ① にじいろ 接近予告: はしっこに脈打つ虹の矢印(内向き)
      if(rbTele>0){const yy=rbTeleY,side=rbTeleSide,pulse=0.5+0.5*Math.sin(tsec*12);
        const ex=side>0?18:api.W-18,rc=["#ff6fae","#ffd23f","#9be8ff"];
        g.save();g.globalAlpha=0.5+0.4*pulse;g.lineWidth=5;g.lineCap="round";g.lineJoin="round";
        for(let k=0;k<3;k++){g.strokeStyle=rc[k];const ox=ex+side*(k*13);
          g.beginPath();g.moveTo(ox+side*12,yy-16);g.lineTo(ox,yy);g.lineTo(ox+side*12,yy+16);g.stroke();}
        g.restore();g.globalAlpha=1;}
      // ① にじいろキャンディ！ 発見バナー(虹色に色替わり)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,hue=(tsec*120)%360;
        g.save();g.translate(api.W/2,api.H*0.23);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 38px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="hsl("+hue+",90%,60%)";g.shadowBlur=18;
        g.fillStyle="#fff";g.fillText("にじいろキャンディ！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="hsl("+hue+",90%,55%)";g.strokeText("にじいろキャンディ！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央の小ヒント(初回だけ大きく)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        const pop=1+Math.max(0,luckyMsgT-1.1)*1.3;
        g.save();g.translate(api.W/2,api.H*0.30);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";
        const txt="きょうの ラッキーいろは "+(PASTELNAME[luckyColor]||"")+"！";
        g.shadowColor=luckyColor;g.shadowBlur=12;
        g.lineWidth=5;g.strokeStyle="rgba(120,40,90,.5)";g.strokeText(txt,0,0);
        g.fillStyle=luckyColor;g.fillText(txt,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ パーフェクト ボーナス！ バナー(下側=クリア文字と重ねない)
      if(noMissT>0){noMissT-=0.014*dt;
        const pop=1+Math.max(0,noMissT-1.3)*1.4;
        g.save();g.translate(api.W/2,api.H*0.64);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(noMissT*1.3,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=16;
        g.fillStyle="#c7ffcf";g.fillText("パーフェクト ボーナス！",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,120,60,.7)";g.strokeText("パーフェクト ボーナス！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(noMissT<0)noMissT=0;}
      // ---- HUD (top center) ----
      drawHUD();
      // ---- stage clear banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.4;g.fillStyle="#6b2a4a";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const popB=1+Math.max(0,clearT-1.3)*1.8;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(popB,popB);g.globalAlpha=a;
        g.textAlign="center";g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,120,180,.9)";g.shadowBlur=20;g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア！",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText(teaser(clearStage+1),0,42);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=20;}
      }
      // ---- ending ----
      if(endingT>0){endingT-=0.012*dt;
        const a=clamp(endingT,0,1);
        g.save();g.globalAlpha=a*0.4;g.fillStyle="#3a0f2a";g.fillRect(0,0,api.W,api.H);g.restore();
        if(tsec%0.05<dt*0.016)shards.push({x:rnd(0,api.W),y:-10,vx:rnd(-1,1),vy:rnd(2,5),r:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.008,col:pick(PASTEL),shape:rint(0,2)});
        const popE=1+Math.sin(tsec*7)*0.06;
        g.save();g.translate(api.W/2,api.H*0.42);g.scale(popE,popE);g.globalAlpha=a;
        g.textAlign="center";g.font="900 54px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,210,60,1)";g.shadowBlur=26;g.fillStyle="#ffd23f";
        g.fillText("ぜんぶ クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle="#fff";g.strokeText("ぜんぶ クリア！",0,0);
        g.font="800 26px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("すごい！ もういちど あそべるよ",0,50);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(endingT<=0){endingT=0;stage=1;stageGoal=stageGoalFor(1);stageKill=0;combo=0;
          fever=0;feverT=0;stageMiss=0;star=null;rbTele=0;starTimer=rnd(320,620);buildBg();spawnT=20;}
      }
      // 白飛び防止の総仕上げ: 加算合成を確実に通常へ戻して次フレームへ持ち越さない
      g.globalCompositeOperation="source-over";g.globalAlpha=1;g.shadowBlur=0;
    },
    stop(){}
  };
  // ---------- drawing helpers ----------
  function drawTarget(t,x,y){
    const r=t.r;
    g.save();g.translate(x,y);
    // soft shadow blob(【軸6】背板として機能するよう濃く)
    g.fillStyle="rgba(80,30,60,.32)";g.beginPath();g.ellipse(0,r*1.1,r*0.8,r*0.28,0,0,TAU);g.fill();
    g.rotate(t.spin);
    if(t.kind==="candy")drawCandy(t,r);
    else if(t.kind==="choco")drawChoco(t,r);
    else if(t.kind==="gummy")drawGummy(t,r);
    else if(t.kind==="cake")drawCake(t,r);
    else if(t.kind==="lolli")drawLolli(t,r);
    else if(t.kind==="donut")drawDonut(t,r);
    else if(t.kind==="gold")drawGold(t,r);
    else if(t.kind==="rainbow")drawRainbow(t,r);
    // 【軸6】背景から浮かせる白い縁取り(星形のgold/rainbowは輪郭が合わないため対象外)
    if(t.kind!=="gold"&&t.kind!=="rainbow"){
      g.save();g.lineWidth=Math.max(2,r*0.1);g.strokeStyle="rgba(255,255,255,.85)";
      g.beginPath();g.arc(0,0,Math.max(0,r*0.96),0,TAU);g.stroke();g.restore();
    }
    // hit flash
    if(t.flash>0){g.globalAlpha=t.flash*0.7;g.fillStyle="#fff";g.beginPath();g.arc(0,0,r,0,TAU);g.fill();g.globalAlpha=1;}
    // cute face
    drawFace(r*0.5);
    g.restore();
  }
  function drawFace(s){
    g.fillStyle="#5a2b3f";
    g.beginPath();g.arc(-s*0.45,-s*0.1,s*0.18,0,TAU);g.arc(s*0.45,-s*0.1,s*0.18,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.9)";
    g.beginPath();g.arc(-s*0.5,-s*0.16,s*0.07,0,TAU);g.arc(s*0.4,-s*0.16,s*0.07,0,TAU);g.fill();
    g.strokeStyle="#5a2b3f";g.lineWidth=Math.max(2,s*0.12);g.lineCap="round";
    g.beginPath();g.arc(0,-s*0.05,s*0.32,0.15*Math.PI,0.85*Math.PI);g.stroke();
    g.fillStyle="rgba(255,130,160,.45)";
    g.beginPath();g.arc(-s*0.7,s*0.2,s*0.16,0,TAU);g.arc(s*0.7,s*0.2,s*0.16,0,TAU);g.fill();
  }
  function drawCandy(t,r){
    // round candy with wrapper twists on the sides
    g.fillStyle=t.col2;
    g.beginPath();g.moveTo(-r,0);g.lineTo(-r*1.7,-r*0.5);g.lineTo(-r*1.7,r*0.5);g.closePath();g.fill();
    g.beginPath();g.moveTo(r,0);g.lineTo(r*1.7,-r*0.5);g.lineTo(r*1.7,r*0.5);g.closePath();g.fill();
    const bg=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r);
    bg.addColorStop(0,"#fff");bg.addColorStop(0.5,t.col);bg.addColorStop(1,shade(t.col,-40));
    g.fillStyle=bg;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    // swirl stripe
    g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=r*0.18;g.lineCap="round";
    g.beginPath();g.arc(0,0,r*0.55,-0.3,2.6);g.stroke();
    g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(-r*0.32,-r*0.32,r*0.18,0,TAU);g.fill();
  }
  function drawChoco(t,r){
    // rounded chocolate square
    rrect(-r*0.85,-r*0.85,r*1.7,r*1.7,r*0.28);
    const bg=g.createLinearGradient(-r,-r,r,r);
    bg.addColorStop(0,"#7a4a2a");bg.addColorStop(0.5,"#5a341c");bg.addColorStop(1,"#3a2010");
    g.fillStyle=bg;g.fill();
    g.strokeStyle="rgba(255,220,180,.3)";g.lineWidth=2;
    // grid lines
    g.beginPath();g.moveTo(0,-r*0.85);g.lineTo(0,r*0.85);g.moveTo(-r*0.85,0);g.lineTo(r*0.85,0);g.stroke();
    g.fillStyle="rgba(255,240,220,.25)";g.fillRect(-r*0.78,-r*0.78,r*0.6,r*0.5);
  }
  function drawGummy(t,r){
    // translucent gummy bear-ish blob
    g.save();g.globalAlpha=0.92;
    const bg=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r);
    bg.addColorStop(0,lighten(t.col,90));bg.addColorStop(0.6,t.col);bg.addColorStop(1,shade(t.col,-30));
    g.fillStyle=bg;
    // body
    g.beginPath();g.ellipse(0,r*0.15,r*0.8,r*0.85,0,0,TAU);g.fill();
    // ears
    g.beginPath();g.arc(-r*0.55,-r*0.6,r*0.28,0,TAU);g.arc(r*0.55,-r*0.6,r*0.28,0,TAU);g.fill();
    g.restore();
    g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.ellipse(-r*0.3,-r*0.2,r*0.16,r*0.24,-0.4,0,TAU);g.fill();
  }
  function drawCake(t,r){
    // slice of cake (tough, 2 hits) - layered + cream + cherry
    g.fillStyle="#ffe9c2";
    rrect(-r*0.9,-r*0.2,r*1.8,r*0.9,r*0.16);g.fill();
    g.fillStyle="#ff9ec4";g.fillRect(-r*0.9,-r*0.2,r*1.8,r*0.22);  // jam layer
    g.fillStyle="#fff3d0";rrect(-r*0.9,r*0.45,r*1.8,r*0.32,r*0.1);g.fill();
    // cream top
    g.fillStyle="#fff";
    g.beginPath();
    for(let i=-2;i<=2;i++){g.arc(i*r*0.34,-r*0.32,r*0.26,Math.PI,0);}
    g.lineTo(r*0.9,-r*0.2);g.lineTo(-r*0.9,-r*0.2);g.closePath();g.fill();
    // cherry
    g.fillStyle="#ff3b5c";g.beginPath();g.arc(0,-r*0.62,r*0.22,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(-r*0.06,-r*0.68,r*0.07,0,TAU);g.fill();
    if(t.hp<=1){g.strokeStyle="rgba(120,60,30,.5)";g.lineWidth=2.5;g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.2,-r*0.1);g.lineTo(0,r*0.3);g.lineTo(-r*0.1,r*0.6);g.stroke();}
  }
  function drawLolli(t,r){
    // lollipop with stick + swirl (worth 2)
    g.strokeStyle="#fff";g.lineWidth=r*0.18;g.lineCap="round";
    g.beginPath();g.moveTo(0,r*0.6);g.lineTo(0,r*1.5);g.stroke();
    const bg=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r);
    bg.addColorStop(0,"#fff");bg.addColorStop(0.5,t.col);bg.addColorStop(1,shade(t.col,-30));
    g.fillStyle=bg;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    // spiral
    g.strokeStyle="rgba(255,255,255,.75)";g.lineWidth=r*0.14;g.lineCap="round";
    g.beginPath();
    for(let a=0;a<TAU*2.4;a+=0.25){const rr=r*0.12+a*r*0.1;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}
    g.stroke();
    g.fillStyle="rgba(255,255,255,.6)";g.beginPath();g.arc(-r*0.3,-r*0.3,r*0.16,0,TAU);g.fill();
  }
  function drawGold(t,r){
    // rare golden star: pulsing glow halo + orbiting sparkles
    const pu=1+0.08*Math.sin(tsec*8+t.bob);
    g.save();g.scale(pu,pu);
    g.save();g.globalCompositeOperation="lighter";
    const halo=g.createRadialGradient(0,0,Math.max(0,r*0.2),0,0,Math.max(0.1,r*1.9));
    halo.addColorStop(0,"rgba(255,230,120,.7)");halo.addColorStop(0.6,"rgba(255,200,60,.22)");halo.addColorStop(1,"rgba(255,200,60,0)");
    g.fillStyle=halo;g.beginPath();g.arc(0,0,Math.max(0,r*1.9),0,TAU);g.fill();g.restore();
    // 画像ゴールドキャンディがあれば差し替え、無ければ従来の手描き星へ
    if(!api.drawAsset("gold.png",0,0,r*2.3,r*2.3,{center:true})){
      const bg=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r);
      bg.addColorStop(0,"#fff7d0");bg.addColorStop(0.5,"#ffd23f");bg.addColorStop(1,"#e09a00");
      g.fillStyle=bg;g.shadowColor="#ffd23f";g.shadowBlur=16;
      drawStarP(r*1.05);g.shadowBlur=0;
      g.strokeStyle="rgba(255,255,255,.8)";g.lineWidth=2.5;g.stroke();
    }
    g.save();g.globalCompositeOperation="lighter";g.fillStyle="#fff";
    for(let i=0;i<3;i++){const a=tsec*4+i*TAU/3;
      g.beginPath();g.arc(Math.cos(a)*r*1.25,Math.sin(a)*r*1.25,2.2,0,TAU);g.fill();}
    g.restore();g.restore();
  }
  function drawRainbow(t,r){
    // にじいろキャンディ: 虹色に光るまるいキャンディ(色相を時間でまわす)。半径はすべて非負にクランプ。
    const hue=(tsec*90)%360;
    g.save();g.globalCompositeOperation="lighter";
    const hr=Math.max(0.1,r*1.8);
    const halo=g.createRadialGradient(0,0,Math.max(0,r*0.2),0,0,hr);
    halo.addColorStop(0,"hsla("+hue+",95%,72%,.5)");
    halo.addColorStop(0.6,"hsla("+((hue+120)%360)+",95%,66%,.16)");
    halo.addColorStop(1,"hsla("+hue+",95%,66%,0)");
    g.fillStyle=halo;g.beginPath();g.arc(0,0,hr,0,TAU);g.fill();g.restore();
    // wrapper twists
    g.fillStyle="hsl("+((hue+180)%360)+",85%,68%)";
    g.beginPath();g.moveTo(-r,0);g.lineTo(-r*1.7,-r*0.5);g.lineTo(-r*1.7,r*0.5);g.closePath();g.fill();
    g.beginPath();g.moveTo(r,0);g.lineTo(r*1.7,-r*0.5);g.lineTo(r*1.7,r*0.5);g.closePath();g.fill();
    const bg=g.createRadialGradient(-r*0.3,-r*0.3,Math.max(0,r*0.1),0,0,Math.max(0.1,r));
    bg.addColorStop(0,"#fff");
    bg.addColorStop(0.45,"hsl("+hue+",95%,66%)");
    bg.addColorStop(1,"hsl("+((hue+90)%360)+",85%,46%)");
    g.fillStyle=bg;g.shadowColor="hsl("+hue+",95%,60%)";g.shadowBlur=14;
    g.beginPath();g.arc(0,0,Math.max(0.1,r),0,TAU);g.fill();g.shadowBlur=0;
    // swirl stripe + highlight
    g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=r*0.18;g.lineCap="round";
    g.beginPath();g.arc(0,0,Math.max(0,r*0.55),-0.3,2.6);g.stroke();
    g.fillStyle="rgba(255,255,255,.75)";g.beginPath();g.arc(-r*0.32,-r*0.32,Math.max(0,r*0.18),0,TAU);g.fill();
  }
  function drawStar2(s){
    // ながれ星: 加算グローの尾＋明るい星の頭。半径は非負にクランプ、composite は必ず戻す。
    g.save();g.globalCompositeOperation="lighter";
    for(let i=0;i<s.trail.length;i++){const tr=s.trail[i],a=i/Math.max(1,s.trail.length);
      g.globalAlpha=a*0.5;g.fillStyle="#fff3c0";
      g.beginPath();g.arc(tr.x,tr.y,Math.max(0,s.r*0.5*a),0,TAU);g.fill();}
    g.globalAlpha=0.9;g.fillStyle="#fff";g.shadowColor="#fff3c0";g.shadowBlur=14;
    g.translate(s.x,s.y);drawStarP(Math.max(0.1,s.r));
    g.restore();g.globalAlpha=1;g.shadowBlur=0;
  }
  function drawDonut(t,r){
    // floaty donut (stage 4+): icing + sprinkles + hole
    g.fillStyle="#e8b06a";g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    g.fillStyle=t.col;g.beginPath();g.arc(0,-r*0.06,r*0.92,0,TAU);g.fill();
    g.fillStyle="#c98a4a";g.beginPath();g.arc(0,r*0.05,r*0.3,0,TAU);g.fill();
    for(let i=0;i<8;i++){const a=i/8*TAU+0.4;
      g.save();g.translate(Math.cos(a)*r*0.6,Math.sin(a)*r*0.6);g.rotate(a);
      g.fillStyle=PASTEL[i%PASTEL.length];g.fillRect(-3,-1.4,6,2.8);g.restore();}
    g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.ellipse(-r*0.35,-r*0.42,r*0.2,r*0.12,-0.5,0,TAU);g.fill();
  }
  function drawCannon(){
    const recoilOff=recoil*R*0.4;
    const dx=aimX-cannonX,dy=aimY-(cannonY-R*0.9);
    let ang=Math.atan2(dy,dx);
    ang=clamp(ang,-Math.PI*0.92,-Math.PI*0.08);  // keep barrel pointing upward
    g.save();g.translate(cannonX,cannonY);
    // base shadow
    g.fillStyle="rgba(120,60,90,.25)";g.beginPath();g.ellipse(0,R*0.55,R*1.3,R*0.4,0,0,TAU);g.fill();
    // barrel (peppermint candy tube) — 画像生成が不良(紫色にじみ・穴)だったため常に手描き
    g.save();g.rotate(ang);g.translate(-recoilOff,0);
    const bl=R*1.5,bw=R*0.78;
    {
      rrect(0,-bw/2,bl,bw,bw*0.3);
      const bg=g.createLinearGradient(0,-bw/2,0,bw/2);
      bg.addColorStop(0,"#fff");bg.addColorStop(0.5,"#ff6f91");bg.addColorStop(1,"#d8466b");
      g.fillStyle=bg;g.fill();
      // stripes
      g.save();rrect(0,-bw/2,bl,bw,bw*0.3);g.clip();
      g.strokeStyle="rgba(255,255,255,.85)";g.lineWidth=bw*0.22;
      for(let i=-1;i<6;i++){g.beginPath();g.moveTo(i*bw*0.5,-bw);g.lineTo(i*bw*0.5+bw*0.6,bw);g.stroke();}
      g.restore();
    }
    // muzzle flash(画像/手描き共通)
    if(muzzle>0){g.save();g.globalCompositeOperation="lighter";g.globalAlpha=muzzle;
      const mg=g.createRadialGradient(bl,0,0,bl,0,R*0.9);
      mg.addColorStop(0,"#fff");mg.addColorStop(0.5,"rgba(255,210,120,.7)");mg.addColorStop(1,"rgba(255,210,120,0)");
      g.fillStyle=mg;g.beginPath();g.arc(bl,0,R*0.9,0,TAU);g.fill();g.restore();}
    g.restore();
    // round candy-pot body
    const body=g.createRadialGradient(-R*0.3,-R*0.3,R*0.1,0,0,R*1.1);
    body.addColorStop(0,"#bff0ff");body.addColorStop(0.6,"#7bd0f0");body.addColorStop(1,"#3a9fc8");
    g.fillStyle=body;g.beginPath();g.arc(0,0,R*0.95,0,TAU);g.fill();
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;g.beginPath();g.arc(0,0,R*0.95,0,TAU);g.stroke();
    g.fillStyle="rgba(255,255,255,.6)";g.beginPath();g.arc(-R*0.32,-R*0.32,R*0.22,0,TAU);g.fill();
    // little face on the cannon
    g.fillStyle="#2b3a4a";
    g.beginPath();g.arc(-R*0.28,R*0.02,R*0.11,0,TAU);g.arc(R*0.28,R*0.02,R*0.11,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.85)";
    g.beginPath();g.arc(-R*0.31,-R*0.02,R*0.04,0,TAU);g.arc(R*0.25,-R*0.02,R*0.04,0,TAU);g.fill();
    g.strokeStyle="#2b3a4a";g.lineWidth=R*0.08;g.lineCap="round";
    g.beginPath();g.arc(0,R*0.12,R*0.16,0.15*Math.PI,0.85*Math.PI);g.stroke();
    g.fillStyle="rgba(255,130,160,.4)";
    g.beginPath();g.arc(-R*0.5,R*0.2,R*0.13,0,TAU);g.arc(R*0.5,R*0.2,R*0.13,0,TAU);g.fill();
    g.restore();
    // charge meter ring around cannon when charging
    if(charging&&charge>0.05){
      g.save();g.globalCompositeOperation="lighter";
      g.strokeStyle=charge>0.6?"#ff6f91":"#ffd23f";g.lineWidth=4;
      g.shadowColor=g.strokeStyle;g.shadowBlur=10;
      g.beginPath();g.arc(cannonX,cannonY,R*1.2,-Math.PI/2,-Math.PI/2+TAU*charge);g.stroke();
      g.restore();
      if(charge>0.6){
        g.save();g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.fillStyle="#fff";g.shadowColor="#ff6f91";g.shadowBlur=8;
        g.fillText("とくだい！",cannonX,cannonY-R*1.5);g.restore();g.textAlign="left";
      }
    }
  }
  function teaser(s){
    // next-stage sneak peek shown during the clear banner
    if(s===2)return"つぎは ケーキが とんでくる！";
    if(s===3)return"つぎは ペロペロキャンディ！";
    if(s===4)return"つぎは ふわふわ ドーナツ！";
    return"さいごは スーパースピード！";
  }
  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.045;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(120,40,90,.6)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+" / "+STAGES+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(120,40,90,.35)";rrect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#9be8ff");gg.addColorStop(1,"#ff9ec4");
      g.fillStyle=gg;rrect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=2;rrect(bx,by,bw,bh,bh/2);g.stroke();
    // fever gauge (thin bar under stage bar, top-center)
    const fx2=bx+bw*0.15,fw0=bw*0.7,fy=by+bh+5,fh=8;
    g.fillStyle="rgba(120,40,90,.3)";rrect(fx2,fy,fw0,fh,fh/2);g.fill();
    if(feverT>0){
      const fw2=fw0*clamp(feverT/10,0,1);
      if(fw2>fh){const fg2=g.createLinearGradient(fx2,0,fx2+fw0,0);
        for(let i=0;i<=4;i++)fg2.addColorStop(i/4,"hsl("+((feverHue*3+i*70)%360)+",90%,62%)");
        g.fillStyle=fg2;rrect(fx2,fy,fw2,fh,fh/2);g.fill();}
      g.font="800 15px 'Hiragino Maru Gothic ProN',system-ui";
      g.fillStyle="#fff";g.shadowColor="#ff2bff";g.shadowBlur=8;
      g.fillText("フィーバー！ とくてん 2ばい！",api.W/2,fy+fh+18);g.shadowBlur=0;
    }else if(fever>0.02){
      const fw2=fw0*fever;
      if(fw2>fh){const fg2=g.createLinearGradient(fx2,0,fx2+fw0,0);
        fg2.addColorStop(0,"#ffd23f");fg2.addColorStop(1,"#ff2bff");
        g.fillStyle=fg2;rrect(fx2,fy,fw2,fh,fh/2);g.fill();}
      if(fever>0.85){g.font="800 14px 'Hiragino Maru Gothic ProN',system-ui";
        g.fillStyle="#fff";g.shadowColor="rgba(255,43,255,.7)";g.shadowBlur=6;
        g.fillText("もうすぐ フィーバー！",api.W/2,fy+fh+16);g.shadowBlur=0;}
    }
    g.restore();g.textAlign="left";
  }
  function drawStarP(r){g.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*0.45:r;
    g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}g.closePath();g.fill();}
  function rrect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function shade(hex,amt){const c=parseInt(hex.slice(1),16);
    const r=clamp((c>>16)+amt,0,255),gg=clamp(((c>>8)&255)+amt,0,255),b=clamp((c&255)+amt,0,255);
    return"rgb("+r+","+gg+","+b+")";}
  function lighten(hex,amt){const a=amt===undefined?50:amt;const c=parseInt(hex.slice(1),16);
    const r=Math.min(255,((c>>16)&255)+a),gg=Math.min(255,((c>>8)&255)+a),b=Math.min(255,(c&255)+a);
    return"rgb("+r+","+gg+","+b+")";}
}
Engine.register("candyshoot", buildCandyshoot);
