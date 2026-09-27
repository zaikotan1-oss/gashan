function build_fireball(api){
  const g=api.g;
  api.preload(["bg.jpg","cannon.png","boss.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)
  // rock.png は生成2回とも「単体」にならず(タイル状の岩の集合)採用を見送り、いんせきは手描きのまま。
  let balls=[],rocks=[],shards=[],sparks=[],rings=[],embers=[],floats=[],lavaBubs=[];
  let cannonX,cannonY,baseR,groundY,tsec=0,count=0,combo=0,comboT=0,spawnT=0,flash=0;
  // charge state (long press = bigger fireball)
  let charging=false,charge=0,aimX=0,aimY=0;
  // stage progression
  const STAGES=5;
  let stage=1,stageKill=0,stageGoal=10,clearT=0,clearStage=0,endingT=0,climax=0;
  // boss / rare-gold state
  let boss=null,bossWarnT=0,hsCd=0;
  const RAINBOW=["#ff4d8d","#ffd23f","#3fffb0","#4db8ff","#b066ff","#fff6c8"];
  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマー/トラックと同じ思想) ----
  // ② きょうのラッキーいろ: いわに埋まった宝石の色を毎プレイ1色だけ秘密に選ぶ
  const GEMS=["#ff5b5b","#4db8ff","#ffd23f","#7be08a","#b066ff","#ff8c42"];
  const GEMNAME={"#ff5b5b":"あか","#4db8ff":"あお","#ffd23f":"きいろ","#7be08a":"みどり","#b066ff":"むらさき","#ff8c42":"オレンジ"};
  let luckyColor=pick(GEMS),luckySeen=false,luckyMsgT=0;
  let rbMsgT=0;                 // ① にじいろいんせき 発見バナー
  let stageMiss=0,perfectT=0;   // ③ パーフェクト判定(いわを 1つも にがさない)
  let shootStar=null;           // ④ ながれ星ひみつ (撃つとごほうび)
  let firstSpawnDone=false;     // 軸3: 開始直後の1個目だけ近く速く出して最初の成功を早める
  let lastFireT=-999;           // 軸3: 直前の発射時刻(間を置かないマッシュ連打の検出用)
  // hexカラー -> rgba文字列 (虹グラデの addColorStop 用: 非有限/負を出さない)
  function hexA(h,a){const n=parseInt(h.slice(1),16);const r=(n>>16)&255,gg=(n>>8)&255,b=n&255;
    return "rgba("+r+","+gg+","+b+","+clamp(a,0,1)+")";}
  const STAGE_BG=[
    {top:"#2a0a10",mid:"#7a1f12",low:"#ff7a2a"}, // 1
    {top:"#1a0518",mid:"#6e1230",low:"#ff5a3a"}, // 2
    {top:"#0a0612",mid:"#4a1040",low:"#ff8a3a"}, // 3
    {top:"#22060a",mid:"#8a2010",low:"#ffb02a"}, // 4
    {top:"#2e0612",mid:"#9a1a14",low:"#ffd23f"}  // 5 golden finale
  ];
  function curBg(){return STAGE_BG[(stage-1)%STAGE_BG.length];}
  function stageGoalFor(s){return 10+(s-1)*3;}   // 10,13,16,19,22（7〜8歳向けに手応えを増やした）
  function layout(){
    groundY=api.H*0.9;
    cannonX=api.W/2;cannonY=groundY-api.H*0.02;
    baseR=clamp(Math.min(api.W,api.H)*0.07,30,64);
    // re-seed lava bubbles for the magma floor
    lavaBubs=[];for(let i=0;i<10;i++)lavaBubs.push({x:rnd(0,api.W),y:groundY+rnd(4,api.H*0.06),
      r:rnd(4,14),ph:rnd(0,TAU),sp:rnd(0.03,0.08)});
  }
  layout();
  function rockType(){
    // ⑦(壊す物のバラエティ): 丸い隕石(orb)と小さい生き物(imp)を追加し、全部ジグザグ岩の色違いで
    // 終わらないようにする(orbは形が違う/impは生き物枠。詳細はdrawRock参照)。
    const bag=["rock","rock","orb"];
    if(stage>=2){bag.push("big");bag.push("imp");}
    if(stage>=3)bag.push("fast");
    if(stage>=4){bag.push("big");bag.push("fast");}
    return pick(bag);
  }
  function spawnRock(){
    // 軸3(最初の成功を早める): ゲーム開始直後の1個目だけ、出現位置を画面内寄り・速度を1.3倍にする。
    // 抽選ロジック自体(乱数を消費する順序)は変えず、生成された岩を最後に上書きするだけにして、
    // このフラグの有無でその後のプレイ全体の乱数列がずれてしまわないようにする。
    const isFirst=!firstSpawnDone;firstSpawnDone=true;
    function boostFirst(rk,fromLeft){
      if(!isFirst)return rk;
      rk.x=fromLeft?-baseR*0.3:api.W+baseR*0.3;
      rk.vx*=1.3;
      return rk;
    }
    // ① にじいろいんせき (約3.5%): 激レア。ゆっくり漂い虹色に光る。倒すと +8 と虹の大盤振る舞い。
    //    いつ来るか分からない = ドキドキ発見。出た瞬間にチャイム＋中央バナーで予告する。
    if(Math.random()<0.035){
      const fl=Math.random()<0.5;
      rocks.push(boostFirst({x:fl?-baseR:api.W+baseR,y:rnd(api.H*0.2,api.H*0.5),
        vx:(fl?1:-1)*rnd(0.7,1.05),vy:rnd(0.05,0.15),r:baseR*1.0,hp:1,type:"rainbow",
        rot:rnd(0,TAU),vr:rnd(-0.03,0.03),wob:rnd(0,TAU),hit:0},fl));
      rbMsgT=1.4;
      api.tone(880,0.12,"triangle",0.12);api.tone(1320,0.14,"triangle",0.1);api.tone(1760,0.16,"triangle",0.09);
      return;
    }
    // rare golden meteor (8%): slower + glowing, worth 5 and a rainbow burst
    if(Math.random()<0.08){
      const fl=Math.random()<0.5;
      rocks.push(boostFirst({x:fl?-baseR:api.W+baseR,y:rnd(api.H*0.2,api.H*0.55),
        vx:(fl?1:-1)*rnd(0.8,1.3),vy:rnd(0.05,0.2),r:baseR*0.95,hp:1,type:"gold",
        rot:rnd(0,TAU),vr:rnd(-0.03,0.03),wob:rnd(0,TAU),hit:0},fl));
      api.tone(1318,0.1,"triangle",0.12);api.tone(1760,0.16,"triangle",0.1); // spawn glint chime
      floats.push({x:api.W/2,y:api.H*0.3,txt:"ゴールドいんせき！",life:1,vy:-0.6,col:"#ffd23f",size:26});
      return;
    }
    const type=rockType();
    const fromLeft=Math.random()<0.5;
    const x=fromLeft?-baseR:api.W+baseR;
    const y=rnd(api.H*0.18,api.H*0.6);
    let hp=1,r=baseR*0.85,spd=rnd(1.1,2.0)+(stage-1)*0.2;   // 7〜8歳向け: 少し速め
    if(type==="big"){hp=2;r=baseR*1.25;spd*=0.7;}
    else if(type==="fast"){r=baseR*0.66;spd*=1.7;}
    else if(type==="orb"){r=baseR*0.8;spd*=1.1;}          // ⑦ まん丸い隕石(ジグザグ多角形とは違う形の枠)
    else if(type==="imp"){hp=1;r=baseR*0.62;spd*=0.85;}   // ⑦ 小さい生き物(顔つき・ジグザグ移動で岩と区別)
    // gentle arc toward cannon side, drifting downward
    const dir=fromLeft?1:-1;
    // ② いわには宝石のコアが埋まっている。色は毎回ランダム(そのうち1色が今日のラッキー)。impは生き物なので宝石なし。
    rocks.push(boostFirst({x,y,vx:dir*spd,vy:rnd(0.1,0.4),r,hp,type,gem:type==="imp"?null:pick(GEMS),
      rot:rnd(0,TAU),vr:type==="imp"?0:rnd(-0.04,0.04),wob:rnd(0,TAU),hit:0},fromLeft));
  }
  function fire(tx,ty,power){
    aimX=tx;aimY=ty;
    const ang=Math.atan2(ty-(cannonY-baseR),tx-cannonX);
    const big=power>0.5;
    const speed=12+power*6;
    // 置いてすぐ離す「瞬間打ち」(power低め)は火だまを小さく=当てにくく、
    // ためて撃つほど大きく育つ差をはっきりさせる(power=1で従来と同じ0.84倍まで育つ)
    const r=baseR*(0.22+power*0.62);
    // 軸3(狙わない連打を弱める): 「直前の弾からほとんど間を置かず・ろくに溜めもせず」撃った
    // 弾だけ当たり判定を絞る(狙わないマッシュ連打を狙い撃ち)。ゲーム開始いちばん最初の1発や、
    // 間隔をあけて撃つ・しっかり溜めて撃つ弾はこれまで通り当てやすいまま(最初の成功を遅らせない)。
    const spamTap=(tsec-lastFireT)<0.5&&power<0.45;
    lastFireT=tsec;
    balls.push({x:cannonX,y:cannonY-baseR*0.7,
      vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,
      r,life:0.8,big,tightHit:spamTap,trail:[]});
    api.slide(big?260:420,90,0.18+power*0.12,0.28,"sawtooth");
    api.noise(0.12,0.12,big?700:1400,"bandpass",0.7);
    if(big){api.boom(0.4);api.shake(5);}else api.shake(2);
    // muzzle sparks
    for(let i=0;i<(big?12:6);i++){const a=ang+rnd(-0.5,0.5),s=rnd(3,8);
      sparks.push({x:cannonX,y:cannonY-baseR*0.7,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
        len:rnd(8,18),life:1,decay:rnd(0.05,0.09)});}
  }
  function burst(x,y,r,col,big){
    rings.push({x,y,r:r*0.4,vr:r*0.7,life:1,decay:0.05,col:col});
    rings.push({x,y,r:r*0.2,vr:r*0.5,life:1,decay:0.045,col:"#fff3b0"});
    const n=(big?20:12)+Math.min(combo,8);
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(3,big?11:8);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,big?9:7),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.024),
        col:i%3===0?col:(i%3===1?"#ff8a2a":"#ffd23f")});}
    for(let i=0;i<rint(8,12);i++){const a=rnd(0,TAU),s=rnd(4,12);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,20),life:1,decay:rnd(0.05,0.09)});}
    flash=Math.min(1,flash+(big?0.5:0.28));
  }
  function destroyRock(rk){
    rk.killed=true;   // ③ パーフェクト判定用: 撃破済みは「にがした」に数えない
    if(rk.type==="rainbow"){ // ① 激レア にじいろいんせき: 虹の破片ぶわっと + ファンファーレ + 大量得点
      burst(rk.x,rk.y,rk.r*1.4,"#ff4d8d",true);
      for(let i=0;i<30;i++){const a=rnd(0,TAU),s=rnd(3,12);
        shards.push({x:rk.x,y:rk.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(4,10),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.009,0.016),col:pick(RAINBOW)});}
      count+=8;stageKill++;api.setScore(count);combo++;comboT=1.0;
      rbMsgT=Math.max(rbMsgT,1.4);
      floats.push({x:clamp(rk.x,60,api.W-60),y:rk.y-rk.r,txt:"にじいろ +8！",life:1,vy:-0.9,col:"#ff4d8d",size:36});
      [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.16,"triangle",0.12),i*70));
      api.boom(0.6);api.shake(12);climax=1;flash=Math.min(1,flash+0.4);
      if(hsCd<=0){api.hitStop(5);hsCd=30;}
      rk._dead=true;checkStage();return;
    }
    if(rk.type==="gold"){ // jackpot: rainbow shards + fanfare + big score
      burst(rk.x,rk.y,rk.r*1.3,"#ffd23f",true);
      for(let i=0;i<24;i++){const a=rnd(0,TAU),s=rnd(3,11);
        shards.push({x:rk.x,y:rk.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.018),col:pick(RAINBOW)});}
      count+=5;stageKill++;api.setScore(count);combo++;comboT=1.0;
      floats.push({x:clamp(rk.x,60,api.W-60),y:rk.y-rk.r,txt:"ゴールド +5！",life:1,vy:-0.9,col:"#ffd23f",size:36});
      [0,4,7,12].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.16,"triangle",0.13),i*70));
      api.boom(0.55);api.shake(10);climax=1;
      if(hsCd<=0){api.hitStop(5);hsCd=30;}
      rk._dead=true;checkStage();return;
    }
    if(rk.type==="big"){
      // ⑤「つみきが くずれる」演出: 上段/下段を別々にburst()して段ごとに壊れる見せ方にする(座標は
      // drawRockの積み重ね描画オフセットに合わせる)。fastの吹っ飛ぶ・normalの砕けるとは違う3つ目の壊れ方。
      burst(rk.x-rk.r*0.14,rk.y-rk.r*0.52,rk.r*0.7,"#ff5a2a",true);
      burst(rk.x+rk.r*0.14,rk.y+rk.r*0.1,rk.r*0.9,"#ff5a2a",true);
    }else{
      burst(rk.x,rk.y,rk.r,"#ff5a2a",rk.type==="big");
    }
    if(rk.type==="fast"){
      // ⑤「吹っ飛ぶ」演出: 進行方向へ破片を追加で偏らせて飛ばす(等方の爆散だけで終わらせない)
      const dirAng=Math.atan2(rk.vy,rk.vx);
      for(let i=0;i<10;i++){const a=dirAng+rnd(-0.45,0.45),s=rnd(7,15);
        shards.push({x:rk.x,y:rk.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(3,7),
          rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.014,0.022),col:"#ffb060"});}
    }
    let gain=rk.type==="big"?3:rk.type==="fast"?2:rk.type==="imp"?2:1;
    // ② きょうのラッキーいろ: いわの宝石が今日の秘密の色なら +1 のかくれボーナス。気づくと得する。
    const isLucky=rk.gem===luckyColor;
    if(isLucky)gain+=1;
    count+=gain;stageKill++;api.setScore(count);
    combo++;comboT=1.0;
    if(isLucky){
      if(!luckySeen){luckyMsgT=1.8;luckySeen=true;}   // 初回だけ中央に「ラッキーいろ」を教える
      api.tone(1046,0.12,"triangle",0.1);api.tone(1568,0.14,"triangle",0.08);
      floats.push({x:clamp(rk.x,60,api.W-60),y:rk.y-rk.r*0.8,txt:"ラッキー！",life:1,vy:-0.9,col:luckyColor,size:26});
      // 頭上に小さな星のキラッ(気づけるヒント)
      for(let i=0;i<6;i++){const a=rnd(0,TAU),s=rnd(2,5);
        shards.push({x:rk.x,y:rk.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(3,5),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:luckyColor});}
    }
    api.slide(360,150,0.12,0.3,"square");api.noise(0.12,0.2,1600);
    api.tone(420*Math.pow(2,clamp(combo,0,10)/12),0.12,"triangle",0.12);
    api.boom(0.4);api.shake(6+Math.min(combo,8));
    if(combo>1)floats.push({x:rk.x,y:rk.y-rk.r,txt:"x"+combo,life:1,vy:-1.0,
      col:combo>=8?"#ff2bff":combo>=5?"#ff3b3b":"#ffd23f",size:combo>=5?40:30});
    if(combo>=3){climax=Math.min(1,0.5+combo*0.06);
      if(hsCd<=0){api.hitStop(combo>=6?4:3);hsCd=30;}}
    rk._dead=true;
    checkStage();
  }
  function checkStage(){
    if(stageKill<stageGoal||clearT>0||endingT>0||boss||bossWarnT>0)return;
    if(stage===3||stage===STAGES){ // boss stages: warn first, boss guards the clear
      bossWarnT=1.5;
      api.boom(0.5);api.shake(12);api.slide(220,55,0.7,0.3,"sawtooth");
      return;
    }
    doClear();
  }
  function doClear(){
    // ③ パーフェクト: このステージで いわを 1つも にがさなかったら +3 & 祝福バナー(考えどころ=ぜんぶ落とす)
    const perfect=stageMiss===0;
    if(perfect){count+=3;api.setScore(count);perfectT=1.9;api.tone(1318,0.16,"triangle",0.12);}
    if(stage>=STAGES){
      endingT=2.4;climax=1;api.boom(0.7);api.shake(18);
      api.slide(523,1046,0.5,0.22,"triangle");
    }else{
      clearStage=stage;clearT=1.6;climax=0.7;api.boom(0.5);api.shake(12);
      api.slide(523,784,0.3,0.2,"triangle");api.tone(660,0.25,"triangle",0.14);
      for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(["#ff5a2a","#ffd23f","#ff8a2a"])});}
      stage++;stageGoal=stageGoalFor(stage);stageKill=0;stageMiss=0;layout();
    }
  }
  function spawnBoss(){
    const fin=stage>=STAGES;
    const r=baseR*(fin?2.9:2.4),hp=fin?10:8;   // ボスHP 6/8 → 8/10（7〜8歳向け）
    boss={x:api.W/2,y:-r*1.4,ty:api.H*0.3,r,hp,maxHp:hp,ph:rnd(0,TAU),hit:0};
    api.boom(0.7);api.shake(16);api.slide(80,40,0.9,0.5,"sawtooth");
    floats.push({x:api.W/2,y:api.H*0.5,txt:fin?"さいごの おおボス！！":"ボス とうじょう！",
      life:1,vy:-0.5,col:"#ff4a3a",size:34});
  }
  function hitBoss(bx,by,big){
    boss.hp-=big?2:1;boss.hit=1;
    burst(bx,by,boss.r*0.5,"#ff5a2a",big);
    boss.y-=boss.r*0.12; // knockback flinch
    combo++;comboT=1.0;
    api.slide(240,110,0.14,0.3,"square");api.noise(0.12,0.22,1100);api.shake(9);
    if(boss.hp>0){
      floats.push({x:bx,y:by-boss.r*0.6,txt:pick(["いてっ！","うわっ！","ぐぬぬ…"]),
        life:1,vy:-0.9,col:"#fff",size:26});
      api.tone(160,0.14,"square",0.1);
      return;
    }
    // ---- boss defeated: giant celebration + clear ----
    const b=boss;boss=null;
    burst(b.x,b.y,b.r,"#ffd23f",true);
    for(let i=0;i<32;i++){const a=rnd(0,TAU),s=rnd(4,13);
      shards.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(5,11),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.008,0.016),col:pick(RAINBOW)});}
    count+=10;api.setScore(count);
    floats.push({x:b.x,y:b.y-b.r,txt:"ボスを たおした！ +10",life:1,vy:-0.7,col:"#ffd23f",size:34});
    api.boom(0.85);api.shake(24);climax=1;flash=1;
    if(hsCd<=0){api.hitStop(6);hsCd=30;}
    api.slide(523,1046,0.5,0.24,"triangle");
    setTimeout(()=>api.tone(784,0.18,"triangle",0.2),130);
    setTimeout(()=>api.tone(1046,0.3,"triangle",0.2),280);
    doClear();
  }
  function hitRock(rk,bx,by){
    rk.hit=1;
    if(rk.type==="big"&&rk.hp>1){
      rk.hp--;
      rk.dent=1; // ⑤「へこむ」演出: 次の描画から色が暗く沈む
      api.slide(300,200,0.08,0.18,"square");api.noise(0.06,0.12,1400);api.shake(4);
      burst(bx,by,rk.r*0.6,"#cfa080",false);
      return false;
    }
    destroyRock(rk);
    return true;
  }
  return{
    resize:layout,
    input(x,y,type){
      if(clearT>0||endingT>0){ if(type==="up")charging=false; return; }
      if(type==="down"){
        charging=true;charge=0;aimX=x;aimY=y;
      }else if(type==="move"){
        if(charging){aimX=x;aimY=y;}
      }else if(type==="up"){
        if(charging){ fire(aimX,aimY,charge); charging=false; charge=0; }
      }
    },
    frame(dt,now){
      tsec+=0.016*dt;
      if(hsCd>0)hsCd-=dt;
      const paused=clearT>0||endingT>0;
      // ---- background: volcano sky gradient ----
      const bg=curBg();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージのパレット色を薄く重ねて面ごとの雰囲気を変える(1面は絵のまま)
        if(stage>1){g.save();g.globalAlpha=0.22;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,bg.top);tg.addColorStop(0.5,bg.mid);tg.addColorStop(1,bg.low);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,bg.top);grd.addColorStop(0.45,bg.mid);grd.addColorStop(1,bg.low);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // hot glow rising from the horizon (additive) ※画像時は控えめに
      g.save();g.globalCompositeOperation="lighter";
      let hg=g.createRadialGradient(api.W/2,groundY,0,api.W/2,groundY,api.W*0.8);
      hg.addColorStop(0,"rgba(255,140,40,"+((imgBg?0.18:0.35)+0.08*Math.sin(tsec*2))+")");
      hg.addColorStop(0.5,"rgba(255,90,30,"+(imgBg?0.06:0.12)+")");hg.addColorStop(1,"rgba(255,90,30,0)");
      g.fillStyle=hg;g.fillRect(0,0,api.W,api.H);g.restore();
      // distant volcano silhouettes with glowing craters ※画像背景のときは絵の火山があるので描かない
      if(!imgBg){
      g.fillStyle="rgba(20,6,8,0.7)";
      g.beginPath();g.moveTo(0,groundY);
      g.lineTo(api.W*0.18,groundY-api.H*0.22);g.lineTo(api.W*0.30,groundY-api.H*0.10);
      g.lineTo(api.W*0.34,groundY);g.closePath();g.fill();
      g.beginPath();g.moveTo(api.W*0.62,groundY);
      g.lineTo(api.W*0.80,groundY-api.H*0.30);g.lineTo(api.W*0.95,groundY-api.H*0.12);
      g.lineTo(api.W,groundY);g.closePath();g.fill();
      g.save();g.globalCompositeOperation="lighter";
      const cg=0.5+0.5*Math.sin(tsec*3);
      g.fillStyle="rgba(255,150,40,"+(0.5*cg)+")";
      g.beginPath();g.ellipse(api.W*0.18,groundY-api.H*0.21,18,7,0,0,TAU);g.fill();
      g.beginPath();g.ellipse(api.W*0.80,groundY-api.H*0.29,22,8,0,0,TAU);g.fill();
      g.restore();
      }
      // rising embers (ambient fire flecks)
      if(embers.length<46&&Math.random()<0.6)embers.push({x:rnd(0,api.W),y:groundY+rnd(0,20),
        vy:-rnd(0.4,1.4),ph:rnd(0,TAU),amp:rnd(6,20),r:rnd(1.2,3.2),life:1,col:pick(["#ffce6a","#ff8a2a","#ff5a2a"])});
      g.save();g.globalCompositeOperation="lighter";
      for(const e of embers){e.y+=e.vy*dt;e.ph+=0.05*dt;e.life-=0.004*dt;
        const ex=e.x+Math.sin(e.ph)*e.amp;
        g.globalAlpha=Math.max(0,e.life)*0.8;g.fillStyle=e.col;g.shadowBlur=8;g.shadowColor=e.col;
        g.beginPath();g.arc(ex,e.y,e.r,0,TAU);g.fill();}
      g.shadowBlur=0;g.globalAlpha=1;g.restore();
      embers=embers.filter(e=>e.life>0&&e.y>-20);
      // heat shimmer band near ground (cheap wavy translucent strip)
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.10;
      for(let x=0;x<api.W;x+=18){const yy=groundY-30+Math.sin(x*0.05+tsec*4)*6;
        g.fillStyle="#ffce6a";g.fillRect(x,yy,18,30);}
      g.restore();g.globalAlpha=1;
      // ---- molten ground ---- ※画像背景のときは絵の溶岩湖を活かして帯は描かない(泡は残す)
      if(!imgBg){
      let lg=g.createLinearGradient(0,groundY,0,api.H);
      lg.addColorStop(0,"#ffd23f");lg.addColorStop(0.3,"#ff6a1a");lg.addColorStop(1,"#7a1206");
      g.fillStyle=lg;g.fillRect(0,groundY,api.W,api.H-groundY);
      }
      // lava bubbles
      g.save();g.globalCompositeOperation="lighter";
      for(const b of lavaBubs){b.ph+=b.sp*dt;
        const bb=0.5+0.5*Math.sin(b.ph),rr=b.r*(0.5+bb*0.6);
        g.globalAlpha=0.4*bb;g.fillStyle="#fff3b0";
        g.beginPath();g.arc(b.x,b.y,rr,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      // ---- boss warning countdown (rumble before the boss drops in) ----
      if(bossWarnT>0&&!paused){
        bossWarnT-=0.016*dt;
        if(Math.random()<0.35)api.shake(2.5);
        if(bossWarnT<=0){bossWarnT=0;spawnBoss();}
      }
      // ---- boss update ----
      if(boss&&!paused){
        boss.ph+=0.018*dt;
        boss.y+=(boss.ty-boss.y)*0.05*dt;
        boss.x=api.W/2+Math.sin(boss.ph)*api.W*0.2;
        if(boss.hit>0)boss.hit=Math.max(0,boss.hit-0.07*dt);
      }
      // ---- spawn rocks ----
      if(!paused){spawnT-=dt;if(spawnT<=0){spawnRock();spawnT=clamp(76-(stage-1)*9,34,76);}}   // 出現間隔 約2割短縮
      // ---- update & draw rocks ----
      for(const rk of rocks){
        if(!paused){
          rk.x+=rk.vx*dt;rk.y+=rk.vy*dt;
          if(rk.type==="imp")rk.y+=Math.sin(tsec*5+rk.wob)*0.9*dt; // ⑦ imp: vyにsin波を足してジグザグに飛ばす(いわと区別)
          rk.rot+=rk.vr*dt;rk.wob+=0.08*dt;
        }
        if(rk.hit>0)rk.hit-=0.1*dt;
        // recycle if it drifts fully off-screen
        if(rk.x<-rk.r*2||rk.x>api.W+rk.r*2||rk.y>api.H+rk.r*2){
          // ③ にがした通常いわ = パーフェクト失敗(レア/ボーナスの取り逃しは数えない)
          if(!rk.killed&&rk.type!=="gold"&&rk.type!=="rainbow")stageMiss++;
          rk._dead=true;continue;}
        drawRock(rk);
      }
      rocks=rocks.filter(rk=>!rk._dead);
      if(boss)drawBoss();
      // ---- ④ ながれ星: たまに空の高いところを流れる。ファイアボールで撃つとひみつのごほうび(減点なし)。
      if(!paused&&!shootStar&&Math.random()<0.004){
        const fl=Math.random()<0.5;
        shootStar={x:fl?-30:api.W+30,y:rnd(api.H*0.08,api.H*0.3),
          vx:(fl?1:-1)*rnd(6,9),vy:rnd(0.5,1.3),tw:rnd(0,TAU),hit:false};
      }
      if(shootStar){
        if(!paused){shootStar.x+=shootStar.vx*dt;shootStar.y+=shootStar.vy*dt;shootStar.tw+=0.3*dt;}
        drawShootStar(shootStar);
        if(shootStar.x<-60||shootStar.x>api.W+60||shootStar.y>api.H*0.6)shootStar=null;
      }
      // ---- update & draw fireballs + collisions ----
      for(const ba of balls){
        if(!paused){
          ba.x+=ba.vx*dt;ba.y+=ba.vy*dt;ba.vy+=0.06*dt; // slight gravity
          ba.life-=0.01*dt;
          ba.trail.push({x:ba.x,y:ba.y,life:1});
          if(ba.trail.length>14)ba.trail.shift();
          // collide with rocks
          for(const rk of rocks){
            if(rk._dead)continue;
            if(Math.hypot(ba.x-rk.x,ba.y-rk.y)<ba.r+rk.r*(ba.tightHit?0.5:0.7)){
              const killed=hitRock(rk,ba.x,ba.y);
              if(!ba.big||killed){ba._dead=true;}
              if(!ba.big)break;
            }
          }
          // collide with boss (big charged shots deal double damage)
          if(boss&&!ba._dead&&Math.hypot(ba.x-boss.x,ba.y-boss.y)<ba.r+boss.r*0.85){
            hitBoss(ba.x,ba.y,ba.big);ba._dead=true;
          }
          // ④ ながれ星に命中: ひみつ発見のごほうび(+2 & 金コインのきらめき。コンボや失敗には影響しない)
          if(shootStar&&!shootStar.hit&&!ba._dead&&Math.hypot(ba.x-shootStar.x,ba.y-shootStar.y)<ba.r+16){
            shootStar.hit=true;count+=2;api.setScore(count);
            api.tone(1318,0.12,"triangle",0.1);api.tone(1976,0.16,"triangle",0.09);
            floats.push({x:clamp(shootStar.x,90,api.W-90),y:shootStar.y+22,txt:"おほしさま はっけん！ +2",life:1,vy:-0.7,col:"#fff6c8",size:24});
            for(let i=0;i<10;i++){const a=rnd(0,TAU),s=rnd(2,6);
              shards.push({x:shootStar.x,y:shootStar.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,6),
                rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.015,0.025),col:pick(["#ffd23f","#fff6c8","#ffe07a"])});}
            if(!ba.big)ba._dead=true;shootStar=null;
          }
        }
        if(ba.x<-80||ba.x>api.W+80||ba.y>api.H+80||ba.life<=0)ba._dead=true;
        drawBall(ba);
      }
      balls=balls.filter(ba=>!ba._dead);
      // ---- shards ----
      for(const p of shards){p.vy+=0.3*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        g.shadowColor=p.col;g.shadowBlur=8;g.fillStyle=p.col;
        g.fillRect(-p.r*0.5,-p.r*0.5,p.r,p.r);g.restore();}
      g.shadowBlur=0;g.globalAlpha=1;shards=shards.filter(p=>p.life>0);
      // ---- sparks (additive lines) ----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#ffe07a";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;sparks=sparks.filter(sp=>sp.life>0);
      // ---- shockwave rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      g.globalAlpha=1;rings=rings.filter(ri=>ri.life>0);
      // ---- charge build (long press) ----
      if(charging){charge=Math.min(1,charge+0.02*dt);}
      // ---- cannon ----
      drawCannon();
      // ---- aim guide while charging ----
      if(charging){
        const ang=Math.atan2(aimY-(cannonY-baseR),aimX-cannonX);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.5;
        g.strokeStyle="#ffce6a";g.lineWidth=2;g.setLineDash([8,10]);
        g.beginPath();g.moveTo(cannonX,cannonY-baseR*0.7);
        g.lineTo(cannonX+Math.cos(ang)*200,cannonY-baseR*0.7+Math.sin(ang)*200);g.stroke();
        g.setLineDash([]);g.restore();g.globalAlpha=1;
        // charge orb at muzzle
        const cr=baseR*(0.2+charge*0.5),pr=0.7+0.3*Math.sin(tsec*16);
        g.save();g.globalCompositeOperation="lighter";
        const og=g.createRadialGradient(cannonX,cannonY-baseR*0.7,0,cannonX,cannonY-baseR*0.7,cr*1.6);
        og.addColorStop(0,"rgba(255,240,160,"+(0.9*pr)+")");
        og.addColorStop(0.4,"rgba(255,120,40,"+(0.6*pr)+")");
        og.addColorStop(1,"rgba(255,80,30,0)");
        g.fillStyle=og;g.beginPath();g.arc(cannonX,cannonY-baseR*0.7,cr*1.6,0,TAU);g.fill();g.restore();
        if(charge>0.5){
          g.save();g.textAlign="center";g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
          g.fillStyle="#fff3b0";g.shadowColor="#ff5a2a";g.shadowBlur=10;
          g.fillText("とくだい！",api.W/2,api.H*0.8);g.restore();g.textAlign="left";
        }
      }
      // ---- floats (combo text) ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.018*dt;
        g.save();g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(40,8,4,.6)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.restore();}
      g.globalAlpha=1;floats=floats.filter(f=>f.life>0);
      // ---- combo banner (top center) ----
      // 軸6: engine.js側のマイルストーン祝福バナー(_fx.bann)はapi.H*0.3固定・大文字(最大82px)で
      // frame()の後に上乗せ描画されるため、fireball側の常設バナー帯は0.3から離した位置にまとめる。
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.12);g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);g.shadowColor="rgba(255,90,30,.9)";g.shadowBlur=14;
        g.fillStyle="#ffd23f";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.6)";
        g.strokeText("コンボ x"+combo,0,0);g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // ---- ① にじいろいんせき！ バナー(虹色に色替わり=レアの大きな祝福/予告) ----
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=RAINBOW[Math.floor(tsec*6)%RAINBOW.length];
        g.save();g.translate(api.W/2,api.H*0.20);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 36px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle="#fff";g.fillText("にじいろ いんせき！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろ いんせき！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ---- ② きょうのラッキーいろ 教示(初回だけ中央上に一度) ----
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.55);g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキーいろは "+(GEMNAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(40,8,4,.6)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ---- ③ パーフェクト！ バナー(クリア文字と重ねない下側) ----
      if(perfectT>0){perfectT-=0.014*dt;
        const pop=1+Math.max(0,perfectT-1.3)*1.3;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(perfectT*1.3,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=16;g.fillStyle="#c7ffcf";
        g.fillText("パーフェクト！ にがさなかった！",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(20,80,40,.7)";
        g.strokeText("パーフェクト！ にがさなかった！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(perfectT<0)perfectT=0;}
      // ---- climax color wash ----
      if(climax>0){
        const cw=g.createRadialGradient(api.W/2,api.H*0.45,0,api.W/2,api.H*0.45,api.W*0.75);
        cw.addColorStop(0,"rgba(255,200,90,"+(0.5*climax)+")");
        cw.addColorStop(0.5,"rgba(255,120,40,"+(0.26*climax)+")");
        cw.addColorStop(1,"rgba(255,90,30,0)");
        g.save();g.globalCompositeOperation="lighter";g.fillStyle=cw;g.fillRect(0,0,api.W,api.H);g.restore();
        climax-=0.05*dt;if(climax<0)climax=0;
      }
      // ---- impact flash ----
      if(flash>0){flash-=0.06*dt;
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=Math.max(0,flash)*0.3;
        g.fillStyle="#ffb060";g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      // ---- HUD ----
      drawHUD();
      // ---- boss warning banner (shadow falls + red alert) ----
      if(bossWarnT>0){
        const a=clamp(bossWarnT*2,0,1);
        g.save();g.globalAlpha=0.4*a;g.fillStyle="#1a0004";g.fillRect(0,0,api.W,api.H);g.restore();
        const pop=1+0.1*Math.sin(tsec*14);
        g.save();g.translate(api.W/2,api.H*0.4);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,40,20,.95)";g.shadowBlur=24;g.fillStyle="#ff4a3a";
        g.fillText("ボスが くる！！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ボスが くる！！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // ---- stage clear banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.5;g.fillStyle="#000";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,120,40,.9)";g.shadowBlur=20;g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア！",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        // teaser: hint at what's new in the next stage
        const TEASERS=["","つぎは おおきい いわが でてくる！","つぎは はやい いわ と ボス！",
          "つぎは いわが もっと いっぱい！","つぎは さいごの おおボス！！"];
        g.fillText(TEASERS[clearStage]||("つぎは ステージ"+(clearStage+1)+"！"),0,42);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=20;}
      }
      // ---- full clear ending ----
      if(endingT>0){endingT-=0.012*dt;
        const a=clamp(endingT,0,1);
        g.save();g.globalAlpha=a*0.45;g.fillStyle="#1a0608";g.fillRect(0,0,api.W,api.H);g.restore();
        if(tsec%0.1<dt*0.016)shards.push({x:rnd(0,api.W),y:-10,vx:rnd(-1,1),vy:rnd(2,5),r:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.01,col:pick(["#ff5a2a","#ffd23f","#ff8a2a"])});
        const pop=1+Math.sin(tsec*4)*0.06;
        g.save();g.translate(api.W/2,api.H*0.42);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 56px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,150,40,1)";g.shadowBlur=26;g.fillStyle="#ffd23f";
        g.fillText("ぜんぶ クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle="#fff";g.strokeText("ぜんぶ クリア！",0,0);
        g.font="800 26px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("すごい！ もういちど あそべるよ",0,50);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(endingT<=0){endingT=0;stage=1;stageGoal=stageGoalFor(1);stageKill=0;stageMiss=0;combo=0;layout();spawnT=20;}
      }
    },
    stop(){}
  };
  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.045;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(0,0,0,.5)";g.shadowBlur=6;
    const msg=(boss||bossWarnT>0)?"ステージ "+stage+" / "+STAGES+"      ボスを たおせ！"
      :"ステージ "+stage+" / "+STAGES+"      あと "+left+" こ";
    g.fillText(msg,api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,0,0,.4)";roundRect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#ff8a2a");gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg;roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;roundRect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }
  function drawCannon(){
    const aimAng=charging?Math.atan2(aimY-(cannonY-baseR),aimX-cannonX):-Math.PI/2;
    g.save();g.translate(cannonX,cannonY);
    // shadow / base mound
    g.fillStyle="rgba(0,0,0,.3)";g.beginPath();g.ellipse(0,baseR*0.5,baseR*1.3,baseR*0.4,0,0,TAU);g.fill();
    // barrel (rotates toward aim)
    g.save();g.rotate(aimAng+Math.PI/2);
    const bl=baseR*1.5;
    const bgrd=g.createLinearGradient(-baseR*0.4,0,baseR*0.4,0);
    bgrd.addColorStop(0,"#3a3a44");bgrd.addColorStop(0.5,"#7a7a88");bgrd.addColorStop(1,"#2a2a33");
    g.fillStyle=bgrd;roundRect(-baseR*0.35,-bl,baseR*0.7,bl,baseR*0.2);g.fill();
    g.strokeStyle="rgba(255,255,255,.25)";g.lineWidth=2;roundRect(-baseR*0.35,-bl,baseR*0.7,bl,baseR*0.2);g.stroke();
    // hot muzzle ring
    g.save();g.globalCompositeOperation="lighter";g.fillStyle="rgba(255,140,40,"+(0.5+0.3*Math.sin(tsec*8))+")";
    g.beginPath();g.ellipse(0,-bl,baseR*0.34,baseR*0.14,0,0,TAU);g.fill();g.restore();
    g.restore();
    // round cannon body with cute face
    const r=baseR;
    // 画像の丸い大砲ボディ(顔つき)。砲身は上で手描き回転済みなので、ボディだけ差し替える
    if(api.drawAsset("cannon.png",0,0,r*2.3,r*2.3,{center:true})){g.restore();return;}
    const body=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r*1.2);
    body.addColorStop(0,"#5a5a66");body.addColorStop(0.6,"#33333d");body.addColorStop(1,"#1a1a22");
    g.fillStyle=body;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.25)";g.beginPath();g.ellipse(-r*0.3,-r*0.35,r*0.3,r*0.16,-0.4,0,TAU);g.fill();
    // glowing eyes
    g.save();g.globalCompositeOperation="lighter";g.shadowColor="#ff8a2a";g.shadowBlur=10;
    g.fillStyle="#ffb84a";
    g.beginPath();g.arc(-r*0.32,-r*0.05,r*0.13,0,TAU);g.arc(r*0.32,-r*0.05,r*0.13,0,TAU);g.fill();g.restore();
    // little grin
    g.strokeStyle="#ffb84a";g.lineWidth=r*0.07;g.lineCap="round";
    g.beginPath();g.arc(0,r*0.18,r*0.3,0.15*Math.PI,0.85*Math.PI);g.stroke();
    // band rivets
    g.fillStyle="rgba(255,255,255,.3)";
    [[-r*0.6,r*0.3],[r*0.6,r*0.3],[0,r*0.7]].forEach(p=>{g.beginPath();g.arc(p[0],p[1],r*0.06,0,TAU);g.fill();});
    g.restore();
  }
  function drawBall(ba){
    // trail (additive)
    g.save();g.globalCompositeOperation="lighter";
    for(let i=0;i<ba.trail.length;i++){const t=ba.trail[i];const f=i/ba.trail.length;
      g.globalAlpha=f*0.5;g.fillStyle=f>0.6?"#ffe07a":"#ff6a2a";
      g.beginPath();g.arc(t.x,t.y,ba.r*(0.3+f*0.7),0,TAU);g.fill();}
    g.restore();g.globalAlpha=1;
    // glow halo
    g.save();g.globalCompositeOperation="lighter";
    const ag=g.createRadialGradient(ba.x,ba.y,0,ba.x,ba.y,ba.r*2.2);
    ag.addColorStop(0,"rgba(255,230,140,0.9)");
    ag.addColorStop(0.4,"rgba(255,120,40,0.5)");
    ag.addColorStop(1,"rgba(255,80,30,0)");
    g.fillStyle=ag;g.beginPath();g.arc(ba.x,ba.y,ba.r*2.2,0,TAU);g.fill();g.restore();
    // molten core
    const cg=g.createRadialGradient(ba.x-ba.r*0.3,ba.y-ba.r*0.3,ba.r*0.1,ba.x,ba.y,ba.r);
    cg.addColorStop(0,"#fff6c8");cg.addColorStop(0.5,"#ff9a3a");cg.addColorStop(1,"#e0401a");
    g.fillStyle=cg;g.beginPath();g.arc(ba.x,ba.y,ba.r,0,TAU);g.fill();
    // hot flicker spots
    g.save();g.globalCompositeOperation="lighter";g.fillStyle="rgba(255,250,200,.7)";
    g.beginPath();g.arc(ba.x+Math.sin(tsec*20)*ba.r*0.2,ba.y+Math.cos(tsec*18)*ba.r*0.2,ba.r*0.3,0,TAU);g.fill();
    g.restore();
  }
  function drawRock(rk){
    g.save();g.translate(rk.x,rk.y);g.rotate(rk.rot);
    // ⑦ 種類でシルエットを変える: fastは横長(ひゅっと飛ぶ)、bigは縦長で角ばった塊(どっしり)
    if(rk.type==="fast")g.scale(1.6,0.65);
    else if(rk.type==="big")g.scale(0.8,1.3);
    const r=rk.r,bob=Math.sin(rk.wob)*r*0.04;
    // shadow
    g.fillStyle="rgba(0,0,0,.25)";g.beginPath();g.ellipse(0,r*0.7,r*0.8,r*0.25,0,0,TAU);g.fill();
    // ⑦ imp: いわではなく小さいまもの枠。cannon/bossで使っている「目(arc二つ)+口(弧)」をそのまま流用して顔つきにする
    if(rk.type==="imp"){
      const bodyGrd=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,Math.max(0,r*1.1));
      bodyGrd.addColorStop(0,"#9a5aff");bodyGrd.addColorStop(0.6,"#5a1ecf");bodyGrd.addColorStop(1,"#26094f");
      g.fillStyle=bodyGrd;g.beginPath();g.arc(0,bob,Math.max(0,r*0.85),0,TAU);g.fill();
      // pointed ears (シルエットで生き物と分かるように)
      g.beginPath();g.moveTo(-r*0.55,bob-r*0.5);g.lineTo(-r*0.82,bob-r*1.05);g.lineTo(-r*0.2,bob-r*0.6);g.closePath();g.fill();
      g.beginPath();g.moveTo(r*0.55,bob-r*0.5);g.lineTo(r*0.82,bob-r*1.05);g.lineTo(r*0.2,bob-r*0.6);g.closePath();g.fill();
      // glowing eyes (drawCannonと同じ手法を流用)
      g.save();g.globalCompositeOperation="lighter";g.shadowColor="#ffe27a";g.shadowBlur=10;g.fillStyle="#fff6c8";
      g.beginPath();g.arc(-r*0.26,bob-r*0.05,Math.max(0,r*0.13),0,TAU);g.arc(r*0.26,bob-r*0.05,Math.max(0,r*0.13),0,TAU);g.fill();
      g.restore();
      // grin (drawBossと同じ弧の手法を流用)
      g.strokeStyle="#ffe27a";g.lineWidth=Math.max(1,r*0.08);g.lineCap="round";
      g.beginPath();g.arc(0,bob+r*0.18,Math.max(0,r*0.26),0.15*Math.PI,0.85*Math.PI);g.stroke();
      // hit flash
      if(rk.hit>0){g.save();g.globalAlpha=rk.hit*0.7;g.globalCompositeOperation="lighter";
        g.fillStyle="#fff";g.beginPath();g.arc(0,bob,Math.max(0,r*0.85),0,TAU);g.fill();g.restore();}
      // rim light(輪郭で背景から浮かせる。軸6対応)
      g.strokeStyle="rgba(255,220,140,.4)";g.lineWidth=2;
      g.beginPath();g.arc(0,bob,Math.max(0,r*0.81),Math.PI*1.1,Math.PI*1.8);g.stroke();
      g.restore();return;
    }
    // gold / rainbow: pulsing halo + orbiting sparkles so it instantly reads as special
    const gold=rk.type==="gold";
    const rainbow=rk.type==="rainbow";
    if(gold||rainbow){
      const pu=0.6+0.4*Math.sin(tsec*8+rk.wob);
      g.save();g.globalCompositeOperation="lighter";
      const hg2=g.createRadialGradient(0,0,r*0.2,0,0,r*2.1);
      if(rainbow){const c1=RAINBOW[Math.floor(tsec*5)%RAINBOW.length];
        hg2.addColorStop(0,hexA(c1,0.5*pu));hg2.addColorStop(0.5,hexA(c1,0.18*pu));hg2.addColorStop(1,hexA(c1,0));
      }else{
        hg2.addColorStop(0,"rgba(255,225,110,"+(0.55*pu)+")");
        hg2.addColorStop(0.5,"rgba(255,200,60,"+(0.2*pu)+")");
        hg2.addColorStop(1,"rgba(255,190,50,0)");}
      g.fillStyle=hg2;g.beginPath();g.arc(0,0,Math.max(0,r*2.1),0,TAU);g.fill();
      const on=rainbow?6:4;
      for(let i=0;i<on;i++){const a=tsec*3+i*TAU/on,rr=r*1.35;
        g.fillStyle=rainbow?RAINBOW[i%RAINBOW.length]:"#fff6c8";
        g.globalAlpha=0.5+0.5*Math.sin(tsec*6+i*2);
        g.beginPath();g.arc(Math.cos(a)*rr,Math.sin(a)*rr,2.6,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
    }
    // body: jagged molten rock (orbだけ丸)
    const fast=rk.type==="fast";
    const orb=rk.type==="orb";
    // rock.png は不採用(生成2回とも単体化に失敗)。ふつう/でかい/はやい/まる いんせきは常に手描きのまま。
    const grd=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r*1.2);
    if(gold){grd.addColorStop(0,"#fff0a0");grd.addColorStop(0.55,"#ffc02a");grd.addColorStop(1,"#a06a10");}
    else if(rainbow){const c=RAINBOW[Math.floor(tsec*4)%RAINBOW.length];
      grd.addColorStop(0,"#fff6c8");grd.addColorStop(0.55,c);grd.addColorStop(1,"#4a1030");}
    else if(fast){grd.addColorStop(0,"#9a4a3a");grd.addColorStop(0.6,"#5a241a");grd.addColorStop(1,"#2a0e08");}
    else if(orb){grd.addColorStop(0,"#dfe6ff");grd.addColorStop(0.55,"#7a8ad8");grd.addColorStop(1,"#2a2f66");}
    else if(rk.type==="big"&&rk.dent){ // ⑤「へこむ」演出: 1発当てた後は色が沈んで見た目に傷が付く
      grd.addColorStop(0,"#4a382e");grd.addColorStop(0.6,"#2a1e18");grd.addColorStop(1,"#140c0a");}
    else{grd.addColorStop(0,"#7a5a4a");grd.addColorStop(0.6,"#4a342a");grd.addColorStop(1,"#241612");}
    g.fillStyle=grd;
    if(orb){
      // ⑦ まる隕石: ジグザグ多角形をやめてg.arc一発の完全な円で描く(丸い形の枠を新規追加)
      g.beginPath();g.arc(0,bob,Math.max(0,r*0.92),0,TAU);g.fill();
    }else{
      // ⑦ 種類で頂点の生成ロジック自体を変える(色替え拡大縮小だけで終わらせない):
      // ふつう=でこぼこ7角、big=角の少ないでこぼこ塊(積み重ね感)、fast=尖った矢じり型(流線)
      let pts,rf;
      if(rk.type==="big"){
        pts=6;rf=(i)=>r*(0.86+(i%2===0?0.12:-0.04));
      }else if(fast){
        pts=4;rf=(i)=>r*(i%2===0?1.18:0.5);
      }else{
        pts=7;rf=(i)=>r*(0.82+((i*37)%10)/10*0.22);
      }
      g.beginPath();
      for(let i=0;i<=pts;i++){const a=i/pts*TAU;const rr=rf(i);
        const px=Math.cos(a)*rr,py=Math.sin(a)*rr+bob;
        if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}
      g.closePath();g.fill();
      if(rk.type==="big"){
        // 積み重なった岩塊: 一回り小さい塊を重ねて「単体の拡大」ではない見た目にする
        g.save();g.translate(-r*0.14,-r*0.52);g.scale(0.6,0.6);
        g.beginPath();
        for(let i=0;i<=5;i++){const a=i/5*TAU;const rr=r*(0.86+(i%2===0?0.1:-0.05));
          const px=Math.cos(a)*rr,py=Math.sin(a)*rr;
          if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}
        g.closePath();g.fill();g.restore();
      }
    }
    // molten cracks (glowing veins)
    g.save();g.globalCompositeOperation="lighter";
    g.strokeStyle="rgba(255,120,40,"+(0.5+0.3*Math.sin(tsec*4+rk.wob))+")";g.lineWidth=Math.max(2,r*0.08);g.lineCap="round";
    g.beginPath();g.moveTo(-r*0.4,-r*0.3);g.lineTo(0,0);g.lineTo(r*0.3,-r*0.2);
    g.moveTo(0,0);g.lineTo(-r*0.1,r*0.4);g.stroke();g.restore();
    // ② いわに埋まった宝石のコア(ダイヤ型)。この色が今日のラッキーいろだと当たり。source-over(加算にしない)。
    if(rk.gem){
      const gr=Math.max(0,r*0.34);
      g.save();g.shadowColor=rk.gem;g.shadowBlur=8;g.fillStyle=rk.gem;
      g.beginPath();g.moveTo(0,bob-gr);g.lineTo(gr*0.7,bob);g.lineTo(0,bob+gr);g.lineTo(-gr*0.7,bob);g.closePath();g.fill();
      g.shadowBlur=0;g.fillStyle="rgba(255,255,255,.75)";
      g.beginPath();g.moveTo(0,bob-gr);g.lineTo(gr*0.28,bob-gr*0.2);g.lineTo(0,bob);g.lineTo(-gr*0.28,bob-gr*0.2);g.closePath();g.fill();
      g.restore();
    }
    // hit flash
    if(rk.hit>0){g.save();g.globalAlpha=rk.hit*0.7;g.globalCompositeOperation="lighter";
      g.fillStyle="#fff";g.beginPath();g.arc(0,0,r,0,TAU);g.fill();g.restore();}
    // rim light
    g.strokeStyle="rgba(255,180,90,.3)";g.lineWidth=2;
    g.beginPath();g.arc(0,0,r*0.9,Math.PI*1.1,Math.PI*1.8);g.stroke();
    g.restore();
  }
  function drawBoss(){
    const b=boss,r=b.r,dmg=1-b.hp/b.maxHp;
    const sq=1+b.hit*0.14; // squash on hit
    g.save();g.translate(b.x,b.y);
    // menacing heat aura (grows as it takes damage)
    g.save();g.globalCompositeOperation="lighter";
    const gl=g.createRadialGradient(0,0,r*0.4,0,0,r*1.8);
    gl.addColorStop(0,"rgba(255,90,30,"+(0.22+0.3*dmg+0.08*Math.sin(tsec*6))+")");
    gl.addColorStop(1,"rgba(255,60,20,0)");
    g.fillStyle=gl;g.beginPath();g.arc(0,0,r*1.8,0,TAU);g.fill();g.restore();
    g.scale(sq,2-sq);
    g.rotate(Math.sin(b.ph*2)*0.06);
    // 画像ボス(溶岩いわモンスター)。被弾フラッシュだけ重ねる。HPピップは下で共通
    let useImg=false;
    if(api.drawAsset("boss.png",0,0,r*2.4,r*2.4,{center:true})){useImg=true;
      if(b.hit>0){g.save();g.globalAlpha=b.hit*0.6;g.globalCompositeOperation="lighter";
        g.fillStyle="#fff";g.beginPath();g.arc(0,0,Math.max(0,r*1.05),0,TAU);g.fill();g.restore();}
    }
    if(!useImg){
    // jagged giant body
    const grd=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r*1.2);
    grd.addColorStop(0,"#6a4436");grd.addColorStop(0.6,"#3c241a");grd.addColorStop(1,"#1a0e08");
    g.fillStyle=grd;g.beginPath();
    const pts=9;
    for(let i=0;i<=pts;i++){const a=i/pts*TAU;const rr=r*(0.84+((i*41)%10)/10*0.2);
      const px=Math.cos(a)*rr,py=Math.sin(a)*rr;
      if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}
    g.closePath();g.fill();
    // glowing cracks: more veins light up as hp drops
    g.save();g.globalCompositeOperation="lighter";
    g.strokeStyle="rgba(255,120,40,"+(0.45+0.45*dmg+0.15*Math.sin(tsec*5))+")";
    g.lineWidth=Math.max(3,r*0.06);g.lineCap="round";
    g.beginPath();g.moveTo(-r*0.5,-r*0.35);g.lineTo(-r*0.1,0);g.lineTo(r*0.4,-r*0.25);
    g.moveTo(-r*0.1,0);g.lineTo(0,r*0.5);
    if(dmg>0.33){g.moveTo(r*0.2,r*0.1);g.lineTo(r*0.55,r*0.45);}
    if(dmg>0.66){g.moveTo(-r*0.55,r*0.2);g.lineTo(-r*0.25,r*0.55);}
    g.stroke();g.restore();
    // angry glowing eyes + growling mouth (winces when hit)
    g.save();g.globalCompositeOperation="lighter";
    g.shadowColor="#ff5a2a";g.shadowBlur=14;g.fillStyle="#ffb84a";
    if(b.hit>0.35){ // ouch: eyes squeeze into > <
      g.strokeStyle="#ffb84a";g.lineWidth=r*0.07;g.lineCap="round";g.shadowBlur=10;
      g.beginPath();g.moveTo(-r*0.45,-r*0.28);g.lineTo(-r*0.2,-r*0.15);g.lineTo(-r*0.45,-r*0.02);g.stroke();
      g.beginPath();g.moveTo(r*0.45,-r*0.28);g.lineTo(r*0.2,-r*0.15);g.lineTo(r*0.45,-r*0.02);g.stroke();
    }else{
      g.beginPath();g.ellipse(-r*0.3,-r*0.15,r*0.15,r*0.11,0.35,0,TAU);g.fill();
      g.beginPath();g.ellipse(r*0.3,-r*0.15,r*0.15,r*0.11,-0.35,0,TAU);g.fill();
    }
    g.restore();
    g.strokeStyle="#ffb84a";g.lineWidth=r*0.06;g.lineCap="round";
    g.beginPath();
    if(b.hit>0.35){g.arc(0,r*0.42,r*0.18,1.1*Math.PI,1.9*Math.PI);} // "oh no" mouth
    else{g.moveTo(-r*0.3,r*0.32);g.lineTo(-r*0.15,r*0.24);g.lineTo(0,r*0.32);
      g.lineTo(r*0.15,r*0.24);g.lineTo(r*0.3,r*0.32);}
    g.stroke();
    // hit flash
    if(b.hit>0){g.save();g.globalAlpha=b.hit*0.6;g.globalCompositeOperation="lighter";
      g.fillStyle="#fff";g.beginPath();g.arc(0,0,r,0,TAU);g.fill();g.restore();}
    }
    g.restore();
    // HP pips above the boss (screen-space, unscaled)
    const pw=r*1.6,px0=b.x-pw/2,py0=b.y-r-18;
    for(let i=0;i<b.maxHp;i++){
      const cx=px0+pw*(i+0.5)/b.maxHp;
      g.save();
      g.fillStyle=i<b.hp?"#ff4a3a":"rgba(255,255,255,.25)";
      if(i<b.hp){g.shadowColor="#ff4a3a";g.shadowBlur=6;}
      g.beginPath();g.arc(cx,py0,6,0,TAU);g.fill();g.restore();
    }
  }
  function drawShootStar(ss){
    // ④ ながれ星: 光る頭 + 尾。空の高いところをスッと流れる。撃つと おほしさま はっけん！
    const dir=Math.atan2(ss.vy,ss.vx),tl=44;
    g.save();g.globalCompositeOperation="lighter";
    const tg=g.createLinearGradient(ss.x,ss.y,ss.x-Math.cos(dir)*tl,ss.y-Math.sin(dir)*tl);
    tg.addColorStop(0,"rgba(255,246,200,.9)");tg.addColorStop(1,"rgba(255,200,90,0)");
    g.strokeStyle=tg;g.lineWidth=4;g.lineCap="round";
    g.beginPath();g.moveTo(ss.x,ss.y);g.lineTo(ss.x-Math.cos(dir)*tl,ss.y-Math.sin(dir)*tl);g.stroke();
    const tw=0.6+0.4*Math.sin(ss.tw),hr=Math.max(0,10*tw+6);
    const hg3=g.createRadialGradient(ss.x,ss.y,0,ss.x,ss.y,hr);
    hg3.addColorStop(0,"rgba(255,250,220,.95)");hg3.addColorStop(1,"rgba(255,220,120,0)");
    g.fillStyle=hg3;g.beginPath();g.arc(ss.x,ss.y,hr,0,TAU);g.fill();
    g.restore();g.globalAlpha=1;
    // 星のコア(source-over)
    g.save();g.translate(ss.x,ss.y);g.fillStyle="#fff6c8";
    const sr=5;g.beginPath();
    for(let i=0;i<5;i++){const a=-Math.PI/2+i*TAU/5;g.lineTo(Math.cos(a)*sr,Math.sin(a)*sr);
      const a2=a+TAU/10;g.lineTo(Math.cos(a2)*sr*0.45,Math.sin(a2)*sr*0.45);}
    g.closePath();g.fill();g.restore();
  }
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
}
Engine.register("fireball", build_fireball);
