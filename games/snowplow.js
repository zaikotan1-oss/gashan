function buildSnowplow(api){
  const g=api.g;
  api.preload(["bg.jpg","gold.png","cone.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。除雪車は生成不良のため手描きのまま
  let imgBg=false;   // このフレームで背景画像が出ているか(平坦な手描きの丘/地面帯をスキップする判定)
  let groundY,truckX,truckY,truckW,truckH,speed,baseSpeed,boost,boostT;
  let obstacles=[],shards=[],puffs=[],rings=[],sparks=[],snowfall=[],glints=[],hills=[];
  let count=0,combo=0,comboT=0,tsec=0,holding=false,wheelSpin=0,scrollX=0;
  let stage=1,stageKill=0,stageGoal,clearT=0,clearStage=0,flash=0;
  let feverG=0,fever=false,feverT=0,feverBannT=0,hitStopCd=0;
  let pendingClear=false,pendingFeverBanner=false; // 軸6: 大型バナーを同時に2枚出さないための順番待ち
  const STAGES=5,FEVER_LEN=10;
  const RAINBOW=["#ff5b5b","#ff9a3a","#ffd23f","#7be08a","#4db8ff","#b58bff","#ff7bd0"];
  // ---- 隠し発見レイヤー(crane/hammer/truck と同じ思想) ----
  const BLOCKCOLS=["#ff5b5b","#4db8ff","#ffd23f","#7be08a","#b58bff","#ff7bd0"];
  const BLOCKNAME={"#ff5b5b":"あか","#4db8ff":"あお","#ffd23f":"きいろ","#7be08a":"みどり","#b58bff":"むらさき","#ff7bd0":"ピンク"};
  let luckyColor=pick(BLOCKCOLS),luckySeen=false,luckyMsgT=0;   // ② きょうのラッキー色: 秘密の1色
  let rbMsgT=0;                                                 // ① にじいろプレゼント 発見バナー
  let comboKept=true,nonstopT=0;                                // ③ ノンストップ判定(コンボを切らさずクリア)
  let sunWink=0;                                                // ④ 太陽ひみつタップ
  let lastAimT=0;                                               // 軸3: 直近の「狙い成功」タップからの残り秒。これが尽きると刃が壊せなくなる(渋滞)
  const sunHit={x:0,y:0,r:0};
  function shade(hex,amt){let n=parseInt(hex.slice(1),16),r=clamp((n>>16)+amt,0,255),
    gr=clamp(((n>>8)&255)+amt,0,255),b=clamp((n&255)+amt,0,255);return "rgb("+(r|0)+","+(gr|0)+","+(b|0)+")";}
  // per-stage sky palette: each stage tints the winter scene a little differently
  const STAGE_SKY=[
    ["#bfe9f5","#9fd6ea","#e8f4fa"], // 1 clear morning
    ["#d6e6ff","#b6cdf2","#eef3ff"], // 2 cool blue
    ["#ffe0d0","#ffc9b0","#fff0e6"], // 3 sunrise
    ["#c9d6ff","#9fb0e8","#e6ecff"], // 4 dusk
    ["#dcc9ff","#b89fe0","#f0e6ff"]  // 5 aurora violet
  ];
  function sky(){return STAGE_SKY[(stage-1)%STAGE_SKY.length];}
  function stageGoalFor(s){return 10+(s-1)*4;} // 10,14,18,22,26（7〜8歳向けに手応えを2〜3割増やした）
  function buildBg(){
    hills=[
      {y:0.62,amp:0.05,wl:0.9,col:"#dff0f7",ph:0},
      {y:0.70,amp:0.06,wl:0.7,col:"#eaf6fb",ph:1.6}
    ];
    snowfall=[];
    for(let i=0;i<70;i++)snowfall.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(1.2,3.6),
      sp:rnd(0.4,1.4),sw:rnd(0.2,0.7),ph:rnd(0,TAU)});
    glints=[];
    for(let i=0;i<16;i++)glints.push({x:rnd(0,api.W),y:rnd(0,1),tw:rnd(0,TAU),sp:rnd(0.05,0.12)});
  }
  function layout(){
    groundY=api.H*0.78;
    truckW=clamp(api.W*0.2,90,180);
    truckH=truckW*0.62;
    truckX=api.W*0.26;
    truckY=groundY-truckH*0.5;
    sunHit.x=api.W*0.72;sunHit.y=api.H*0.16;sunHit.r=Math.max(42,api.W*0.1); // ④ 太陽の当たり判定(描画と一致)
    buildBg();
  }
  layout();
  function obstType(){
    const bag=["snow","snow","snow","cone","block","block"]; // block: いろとりどりの積み木(ラッキー色の対象)
    if(stage>=2)bag.push("snow","block","snowman"); // 軸7: 3段重ねの雪だるま(大きい・崩れ方が違う)
    if(stage>=3)bag.push("ice");   // ice block: tougher, 2 hits
    if(stage>=4)bag.push("cone","ice");
    bag.push("icicle");   // 軸7: 小さいつらら(1タッチで即壊れる/落ちて割れる)。いつでも少しだけ出る
    return pick(bag);
  }
  function nextTarget(){
    // 軸3: 「次に来る障害物」= いま truckX にいちばん近い未破壊オブジェクトを狙い先にする(表示用)
    let best=null,bestD=Infinity;
    for(const o of obstacles){
      if(o.dead)continue;
      const d=Math.abs(o.x-truckX);
      if(d<bestD){bestD=d;best=o;}
    }
    return best;
  }
  function aimHit(x,y){
    // 軸1: 記念すべき最初の1体は、どこをタップしても狙い成功(最初の成功を確実に)
    const freebie=obstacles.find(o=>o.free&&!o.dead);
    if(freebie)return freebie;
    // 軸3: 「狙って当てた」= いずれかの未破壊オブジェクトの、横も縦もその物のすぐ近くをタップしたか。
    // オブジェクトごとに横距離・縦距離の両方が近いときだけ命中(画面下1/4ならどこでも、という粗い帯判定は廃止)。
    let best=null,bestD=Infinity;
    for(const o of obstacles){
      if(o.dead)continue;
      const d=Math.abs(o.x-x),dy=Math.abs(o.y-y);
      if(d<o.w*0.75&&dy<o.h*0.9&&d<bestD){bestD=d;best=o;}
    }
    return best;
  }
  let spawnGap=0,firstSpawnDone=false;
  function spawn(){
    let type=obstType();
    // ① にじいろプレゼント: 数%の激レア。虹色に光り、砕くと大量得点＋虹の大演出。いつ出るか分からない=ドキドキ発見。
    if(Math.random()<0.045&&!obstacles.some(o=>o.type==="rainbow"||o.type==="gold"))type="rainbow";
    // rare golden present: sparkles and begs to be smashed (more common during fever)
    else if(Math.random()<(fever?0.16:0.08)&&!obstacles.some(o=>o.type==="gold"))type="gold";
    // 軸1/3: 最初の1体だけは単純な雪山にして、狙いタップ制でも「最初の成功」が早く来るのを保証する
    if(!firstSpawnDone)type="snow";
    let w,h,hp=1,col;
    if(type==="snow"){h=rnd(truckH*0.5,truckH*1.1);w=h*rnd(0.9,1.3);col="#f4fbff";}
    else if(type==="cone"){h=truckH*0.7;w=h*0.55;col="#ff8a3a";}
    else if(type==="block"){h=rnd(truckH*0.5,truckH*0.85);w=h*rnd(0.82,1.05);col=pick(BLOCKCOLS);}
    else if(type==="snowman"){h=truckH*1.6;w=h*0.56;hp=3;col="#ffffff";}   // 軸7: 大きい・3段(段ごとに崩れる)
    else if(type==="icicle"){h=truckH*0.3;w=h*0.55;hp=1;col="#d8f4ff";}    // 軸7: 小さい・一撃で壊れる
    else if(type==="gold"){h=truckH*0.85;w=h*0.9;col="#ffd23f";
      api.tone(1318,0.14,"triangle",0.12);api.tone(1568,0.2,"triangle",0.1);} // "!" chime on appear
    else if(type==="rainbow"){h=truckH*0.9;w=h*0.95;col="#ff5b5b";
      api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.16,"triangle",0.09);api.tone(2093,0.18,"triangle",0.07);} // 虹のチャイム
    else{h=truckH*0.8;w=h*0.85;hp=2;col="#bfeaff";}            // ice
    const isFirst=!firstSpawnDone;
    let sx=api.W+w*0.5+rnd(0,40);
    if(!firstSpawnDone){firstSpawnDone=true;sx=truckX+truckW*1.7+rnd(0,30);}   // 軸1/3: 最初の1体だけ手前寄りに出す
    obstacles.push({x:sx,y:groundY-h*0.5,w,h,type,hp,col,
      squash:1,hit:0,wob:rnd(0,TAU),
      free:isFirst}); // 軸1: 記念すべき最初の1体だけは、位置を問わずどこをタップしても「狙い成功」扱い(最初の成功を確実に)
  }
  function makeShards(x,y,col,n,big){
    for(let i=0;i<n;i++){const a=rnd(-TAU/2,0),s=rnd(3,9)*(big?1.4:1);
      shards.push({x,y,vx:Math.cos(a)*s+rnd(1,4),vy:Math.sin(a)*s-rnd(0,3),
        r:rnd(4,11),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.02),
        col:Array.isArray(col)?pick(col):col});}
    if(shards.length>140)shards.splice(0,shards.length-140); // particle cap
  }
  function makePuffs(x,y,n){
    for(let i=0;i<n;i++)puffs.push({x:x+rnd(-12,12),y:y+rnd(-12,12),
      r:rnd(8,22),vr:rnd(0.5,1.4),vx:rnd(-2,3),vy:rnd(-2.2,-0.4),life:1,decay:rnd(0.012,0.022)});
  }
  function checkStage(){
    if(stageKill<stageGoal||clearT>0||pendingClear)return;
    // 軸6: フィーバー演出が鳴っている間はクリアバナーを重ねず、鳴り終わってから出す
    if(feverBannT>0){pendingClear=true;return;}
    doStageClear();
  }
  function doStageClear(){
    clearStage=stage;clearT=1.6;flash=Math.min(1,flash+0.7);
    api.boom(0.5);api.shake(12);
    api.slide(523,784,0.3,0.2,"triangle");api.tone(660,0.25,"triangle",0.14);
    api.tone(988,0.3,"triangle",0.1);
    for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
      shards.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,
        r:rnd(5,11),rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),
        col:pick(["#bfeaff","#fff","#ffd23f","#9fd6ea"])});}
    // ③ ノンストップ ボーナス: このステージ中コンボを一度も切らさずクリアしたら +5 & みどりの星シャワー
    if(comboKept){count+=5;api.setScore(count);nonstopT=1.8;
      api.tone(1318,0.16,"triangle",0.11);api.tone(1976,0.18,"triangle",0.08);
      for(let i=0;i<16;i++){const a=rnd(0,TAU),s=rnd(3,8);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,
          r:rnd(4,9),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:"#7be08a"});}}
    comboKept=true;   // 次ステージのノンストップ判定をリセット
    stage=stage>=STAGES?1:stage+1;
    stageGoal=stageGoalFor(stage);stageKill=0;buildBg();
  }
  function startFever(){
    fever=true;feverT=FEVER_LEN;feverG=1;
    // 軸6: ステージクリアのバナーが出ている間はフィーバーのバナーを重ねない(消えてから出す)
    if(clearT>0)pendingFeverBanner=true;else feverBannT=1.5;
    api.boom(0.65);api.shake(14);flash=1;
    api.slide(392,1046,0.4,0.3,"triangle");
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(523*Math.pow(2,s/12),0.16,"triangle",0.12),i*70));
    spawnGap=Math.min(spawnGap,20); // pile them in right away
  }
  function crush(o,big){
    const x=o.x,y=o.y,gold=o.type==="gold",rainbow=o.type==="rainbow";
    let pts=rainbow?8:(gold?5:(o.type==="ice"?2:1));
    // ② きょうのラッキー色: 今日の秘密の色の積み木を砕くと隠しボーナス(気づくと得する)
    const isLucky=o.type==="block"&&o.col===luckyColor;
    if(isLucky)pts+=1;
    if(fever)pts*=2; // fever = double points
    count+=pts;stageKill++;api.setScore(count);
    combo++;comboT=1.0;
    boost=Math.min(1,boost+0.16);boostT=0.7;
    if(!fever){feverG=Math.min(1,feverG+((gold||rainbow)?0.34:0.09));if(feverG>=1)startFever();}
    makeShards(x,y,(gold||rainbow)?RAINBOW:o.col,(gold||rainbow)?18:(big?16:10),big||gold||rainbow);
    makePuffs(x,y,big?9:6);
    if(o.type==="icicle"){ // 軸7: つらら特有の壊れ方=かけらが下にパラパラ落ちる(他は上に弾ける)
      api.tone(1760,0.08,"triangle",0.09);api.tone(2093,0.06,"triangle",0.06);
      for(let i=0;i<5;i++)shards.push({x,y,vx:rnd(-1,1),vy:rnd(1,4),r:rnd(3,6),
        rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.02,0.03),col:"#eafaff"});
    }
    rings.push({x,y,r:o.w*0.4,vr:o.w*0.6,life:1,decay:0.05,col:gold?"#ffd23f":"#ffffff"});
    if(gold)rings.push({x,y,r:o.w*0.6,vr:o.w*0.9,life:1,decay:0.04,col:"#fff2a0"});
    for(let i=0;i<rint(4,7)+(gold?5:0);i++){const a=rnd(0,TAU),s=rnd(4,10);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,16),life:1,decay:rnd(0.05,0.09)});}
    api.slide(320,140,0.12,0.3,"square");api.noise(0.12,0.2,1400,"lowpass",0.7);
    api.tone(480*Math.pow(2,clamp(combo,0,10)/12),0.1,"triangle",0.1);
    api.boom(gold?0.7:(big?0.55:0.4));api.shake(gold?16:6+Math.min(combo,8));
    // hitStop only on big moments, with a 30-frame cooldown (never every crush)
    if(hitStopCd<=0&&(gold||big||(combo>0&&combo%6===0))){api.hitStop(gold?5:3);hitStopCd=30;}
    flash=Math.min(1,flash+(gold?0.6:big?0.4:0.22));
    if(gold){ // golden fanfare!
      [0,4,7,12].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.18,"triangle",0.13),i*80));
    }
    if(combo>0&&combo%6===0){flash=Math.min(1,flash+0.4);api.tone(1046,0.18,"triangle",0.12);}
    // ① にじいろプレゼント / ② ラッキー色 の特別演出
    if(rainbow)rainbowBurst(o);
    if(isLucky)luckyPop(x,y);
    checkStage();
  }
  function rainbowBurst(o){
    // ① にじいろプレゼント 撃破: 虹の輪が7色ぶわっと広がる大盤振る舞い(激レアの爽快ごほうび)
    const x=o.x,y=o.y;rbMsgT=1.4;
    api.boom(0.7);api.shake(16);
    if(hitStopCd<=0){api.hitStop(5);hitStopCd=30;}  // 節目のみ・30fクールダウン
    api.slide(660,1320,0.45,0.2,"triangle");api.tone(988,0.16,"triangle",0.1);api.tone(1318,0.18,"triangle",0.09);
    flash=Math.min(1,flash+0.5);                    // まぶしすぎ防止に上限(連打で溜まらない)
    for(let k=0;k<RAINBOW.length;k++)rings.push({x,y,r:o.w*0.3,vr:o.w*(0.5+k*0.13),life:1,decay:0.05,col:RAINBOW[k]});
    for(let i=0;i<12;i++){const a=rnd(0,TAU),s=rnd(4,10);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(10,18),life:1,decay:rnd(0.05,0.09)});}
  }
  function luckyPop(x,y){
    // ② ラッキー色 命中: きらっと小さめの祝福(白飛びしないよう控えめ)
    luckyMsgT=luckySeen?Math.max(luckyMsgT,0.7):1.6;luckySeen=true;
    api.tone(1046,0.14,"triangle",0.11);api.tone(1568,0.16,"triangle",0.08);
    for(let i=0;i<8;i++){const a=rnd(-TAU/2,0),s=rnd(2,6);
      shards.push({x,y:y-6,vx:Math.cos(a)*s*0.7,vy:Math.sin(a)*s-2,r:rnd(3,6),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:luckyColor});}
  }
  function hitObstacle(o){
    if(o.type==="gold"||o.type==="rainbow"){o.dead=true;o.squash=1;crush(o,true);return;}
    if(o.type==="ice"&&o.hp>1&&!fever){ // fever: everything smashes in 1 hit
      o.hp--;o.hit=1;o.squash=0.84;
      api.slide(300,200,0.07,0.18,"square");api.noise(0.06,0.12,2200,"highpass",0.9);
      api.tone(340,0.07,"square",0.08);api.shake(4);
      makeShards(o.x,o.y,"#e6f6ff",6,false);
      return;
    }
    if(o.type==="snowman"&&o.hp>1&&!fever){ // 軸7: 段ごとに崩れる(iceとは違う壊れ方=頭から縮む)
      o.hp--;o.hit=1;o.squash=0.9;
      api.slide(260,160,0.09,0.2,"square");api.noise(0.05,0.1,1600,"lowpass",0.6);
      api.tone(280,0.09,"square",0.07);api.shake(5);
      makeShards(o.x,o.y-o.h*0.32,"#ffffff",5,false);
      o.h=Math.max(truckH*0.5,o.h*0.7); // 上の段が落ちて背が低くなる
      return;
    }
    o.dead=true;o.squash=1;
    crush(o,o.type==="snowman"||(o.type==="snow"&&o.h>truckH*0.8));
  }
  stageGoal=stageGoalFor(stage);
  baseSpeed=1.3;speed=baseSpeed;boost=0;boostT=0; // 軸3: 押しっぱなし/連打だけではstageGoalに届かないペース(狙いタップのブーストが必要)
  let introT=1.6; // 軸1/3: 起動直後だけ一時的に速く(最初の1体が刃まで届くのを速め、firstScoreSec<=3秒を死守)。以降のペースには影響しない
  spawnGap=18; // 軸3: 加速源を狙いタップ中心にした分、最初の1体だけ早めに出して合格線(3秒)を死守(以降のペースは変えない)
  return{
    resize:layout,
    input(x,y,type){
      if(type==="down"){holding=true;
        // 軸3: 道の上でオブジェクトの近くを狙ったタップだけブースト発動(どこを押しても同じ、をやめる)
        const tg=aimHit(x,y);
        if(tg){
          boost=Math.min(1,boost+0.14);boostT=0.5;
          lastAimT=0.6; // 軸3: 狙い成功=これから0.6秒だけ、刃に着いたオブジェクトを壊せる
          api.tone(180,0.05,"square",0.08);
        }else{
          // スカ: 狙いが外れたタップはブーストが増えない。小さな雪煙と低い音だけの合図
          api.tone(150,0.05,"sine",0.05);
          puffs.push({x,y,r:rnd(4,9),vr:rnd(0.3,0.8),vx:rnd(-1,1),vy:rnd(-1,-0.2),life:1,decay:rnd(0.03,0.05)});
        }
        // ④ 太陽ひみつタップ: 太陽に触れたら ウインク＋金コインがこぼれる(アクセルはそのまま/減点なし)
        if(sunHit.r>0&&Math.hypot(x-sunHit.x,y-sunHit.y)<sunHit.r){
          sunWink=1;api.tone(1318,0.1,"triangle",0.09);api.tone(1760,0.12,"triangle",0.07);
          for(let i=0;i<7;i++){const a=rnd(-TAU/2,0),s=rnd(2,6);
            shards.push({x:sunHit.x,y:sunHit.y,vx:Math.cos(a)*s*0.6,vy:Math.sin(a)*s-1,
              r:rnd(4,7),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.012,col:pick(["#ffd23f","#fff0a0"])});}}
      }
      else if(type==="up")holding=false;
    },
    frame(dt,now){
      tsec+=0.016*dt;
      if(lastAimT>0)lastAimT=Math.max(0,lastAimT-0.016*dt); // 軸3: 狙い成功の効き目切れ
      if(hitStopCd>0)hitStopCd--;
      if(combo>0){comboT-=0.016*dt;if(comboT<=0){combo=0;comboKept=false;}} // ③ コンボ切れ=ノンストップ失敗
      if(boostT>0)boostT-=0.016*dt;else if(boost>0)boost=Math.max(0,boost-0.004*dt);
      if(fever){feverT-=0.016*dt;
        if(feverT<=0){fever=false;feverT=0;feverG=0;flash=Math.min(1,flash+0.25);
          api.tone(392,0.2,"triangle",0.1);api.tone(330,0.28,"triangle",0.08);}}
      // target speed: holding pushes the plow forward; combo boost stacks on top; fever = turbo
      if(introT>0)introT=Math.max(0,introT-0.016*dt); // 軸1/3: 起動直後の一時的な速さは数秒で自然に消える
      const want=baseSpeed+(introT>0?1.3:0)+(holding?0.5:0)+boost*4.2+(fever?2.2:0); // 軸3: 押しっぱなしだけで最高速に届かないよう抑える
      speed=lerp(speed,want,clamp(0.08*dt,0,1));
      const moving=speed>baseSpeed+0.05;
      scrollX+=speed*dt;
      wheelSpin+=speed*0.06*dt;

      // ---- background sky ----
      const sk=sky();
      imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージの空パレットを薄く重ねて面ごとの雰囲気を変える(1面=晴れの朝はそのまま)
        if(stage!==1){g.save();g.globalAlpha=0.28;let tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,sk[0]);tg.addColorStop(0.5,sk[1]);tg.addColorStop(1,sk[2]);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,sk[0]);grd.addColorStop(0.5,sk[1]);grd.addColorStop(1,sk[2]);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // soft sun/halo upper area
      const sunx=api.W*0.72,suny=api.H*0.16;
      let sun=g.createRadialGradient(sunx,suny,0,sunx,suny,api.W*0.4);
      sun.addColorStop(0,"rgba(255,250,230,.5)");sun.addColorStop(1,"rgba(255,250,230,0)");
      g.fillStyle=sun;g.fillRect(0,0,api.W,api.H);
      // soft sun disk so the secret tap-target has a home
      g.save();g.shadowColor="rgba(255,245,200,.8)";g.shadowBlur=24;
      g.fillStyle="rgba(255,252,228,.85)";g.beginPath();g.arc(sunx,suny,api.W*0.042,0,TAU);g.fill();g.restore();
      // ④ ヒント: 太陽の上でごく小さな星がゆっくりキラッ(タップできるよ、の気づき。加算だが極小・低alphaで溜まらない)
      if(sunWink<=0){const tw=0.5+0.5*Math.sin(tsec*2.2),hy=suny-api.W*0.06,hs=api.W*0.012*(0.7+0.3*tw);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.18+0.22*tw;g.fillStyle="#fff7c2";
        g.beginPath();g.moveTo(sunx,hy-hs);g.lineTo(sunx+hs*0.34,hy);g.lineTo(sunx,hy+hs);g.lineTo(sunx-hs*0.34,hy);g.closePath();g.fill();
        g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";}
      // ④ 太陽ひみつタップ: 叩かれた瞬間だけ ^_^ のウインク顔が出る(発見のごほうび)
      if(sunWink>0){sunWink-=0.02*dt;const sr=api.W*0.042;
        g.save();g.strokeStyle="#e0a020";g.lineWidth=Math.max(2,sr*0.16);g.lineCap="round";g.globalAlpha=clamp(sunWink*1.4,0,1);
        g.beginPath();
        g.moveTo(sunx-sr*0.5,suny-sr*0.05);g.quadraticCurveTo(sunx-sr*0.33,suny-sr*0.34,sunx-sr*0.16,suny-sr*0.05);
        g.moveTo(sunx+sr*0.16,suny-sr*0.05);g.quadraticCurveTo(sunx+sr*0.33,suny-sr*0.34,sunx+sr*0.5,suny-sr*0.05);
        g.stroke();
        g.beginPath();g.arc(sunx,suny+sr*0.16,sr*0.36,0.12*Math.PI,0.88*Math.PI);g.stroke();
        g.restore();g.globalAlpha=1;if(sunWink<0)sunWink=0;}
      // ① にじいろプレゼント 接近予告: 画面右外にレアが控えていたら 右ふちに虹のシェブロン(ドキドキ)
      if(obstacles.some(o=>o.type==="rainbow"&&!o.dead&&o.x>api.W)){
        const yy=api.H*0.52,pulse=0.5+0.5*Math.sin(tsec*5);
        g.save();g.globalAlpha=0.45+0.4*pulse;g.lineWidth=5;g.lineCap="round";g.lineJoin="round";
        for(let k=0;k<3;k++){g.strokeStyle=RAINBOW[(k*2+Math.floor(tsec*4))%RAINBOW.length];
          const ox=api.W-14-k*13;g.beginPath();g.moveTo(ox-12,yy-16);g.lineTo(ox,yy);g.lineTo(ox-12,yy+16);g.stroke();}
        g.restore();g.globalAlpha=1;}
      // fever sky: rainbow aurora ribbons wash over everything
      if(fever){
        g.save();g.globalCompositeOperation="lighter";
        for(let a=0;a<3;a++){const cy=api.H*(0.14+a*0.14);
          let ag=g.createLinearGradient(0,cy-50,0,cy+50);
          const rc=RAINBOW[(a*2+Math.floor(tsec*3))%RAINBOW.length];
          ag.addColorStop(0,"rgba(0,0,0,0)");ag.addColorStop(0.5,rc);ag.addColorStop(1,"rgba(0,0,0,0)");
          g.globalAlpha=0.22*(0.6+0.4*Math.sin(tsec*2+a*1.7));g.fillStyle=ag;
          g.beginPath();g.moveTo(0,cy);
          for(let x=0;x<=api.W;x+=28)g.lineTo(x,cy+Math.sin(x*0.014+tsec*2.4+a*2)*24);
          g.lineTo(api.W,cy+70);g.lineTo(0,cy+70);g.closePath();g.fill();}
        g.restore();g.globalAlpha=1;
      }
      // twinkly sky glints
      g.save();g.globalCompositeOperation="lighter";g.fillStyle="#ffffff";
      for(const gl of glints){gl.tw+=gl.sp*dt;
        g.globalAlpha=0.2+0.3*(0.5+0.5*Math.sin(gl.tw));
        const gy=gl.y*api.H*0.5;
        g.beginPath();g.arc(gl.x,gy,1.6,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      // parallax snowy hills ※画像背景のときは絵の丘を活かして描かない
      if(!imgBg) for(let hi=0;hi<hills.length;hi++){const hl=hills[hi];
        const off=(scrollX*(0.15+hi*0.12))%(api.W);
        g.fillStyle=hl.col;g.beginPath();g.moveTo(-off,api.H);
        for(let x=-off;x<=api.W+24;x+=24){
          const yy=api.H*hl.y+Math.sin((x+off)/(api.W*hl.wl)*TAU+hl.ph)*api.H*hl.amp;
          g.lineTo(x,yy);}
        g.lineTo(api.W,api.H);g.closePath();g.fill();}

      // ---- snowy ground ---- ※画像背景のときは絵の雪道を活かして地面の帯を描かない
      if(!imgBg){
        let gg=g.createLinearGradient(0,groundY-10,0,api.H);
        gg.addColorStop(0,"#ffffff");gg.addColorStop(0.4,"#eaf6fb");gg.addColorStop(1,"#cfe6f0");
        g.fillStyle=gg;g.fillRect(0,groundY,api.W,api.H-groundY);
      }
      // moving snow-texture stripes on the road (画像時も薄く残す = 走っている感)
      g.save();g.globalAlpha=imgBg?0.3:0.5;g.strokeStyle="rgba(160,200,220,.5)";g.lineWidth=2;
      for(let i=0;i<8;i++){const lx=((i*api.W/8-scrollX*0.8)%api.W+api.W)%api.W;
        g.beginPath();g.moveTo(lx,groundY+12);g.lineTo(lx-30,api.H);g.stroke();}
      g.restore();g.globalAlpha=1;
      // cleared snow ridge in front of plow (the path it carves)
      g.fillStyle="rgba(255,255,255,.7)";
      g.beginPath();g.moveTo(0,groundY);
      g.lineTo(truckX-truckW*0.2,groundY);
      g.lineTo(truckX-truckW*0.2,groundY-truckH*0.4);
      g.lineTo(0,groundY-truckH*0.15);g.closePath();g.fill();

      // ---- spawn obstacles ----
      spawnGap-=speed*dt;
      if(spawnGap<=0){spawn();
        spawnGap=fever?45+rnd(0,15):clamp(120-(stage-1)*12,60,120)+rnd(0,36);}   // 7〜8歳向け: 出現間隔を約15%短く

      // ---- move + draw obstacles, collide with plow blade ----
      const bladeX=truckX-truckW*0.18; // front of the snowplow blade
      const aimTarget=nextTarget(); // 軸3: 今どれを狙えばいいかのヒント表示用
      let queueBack=-Infinity; // 軸3: 手前で止まっている未破壊オブジェクトの背面位置(渋滞の壁。詰まり防止)
      for(const o of obstacles){
        if(o.hit>0)o.hit-=0.08*dt;
        if(o.squash<1)o.squash=Math.min(1,o.squash+0.06*dt);
        o.wob+=0.06*dt;
        if(!o.dead){
          o.x-=speed*dt;
          const bladeStop=bladeX+o.w*0.4;     // 刃に届く位置(=ここまでは進める)
          const jamStop=queueBack+o.w*0.75;   // 手前のオブジェクトに突っ込まない位置(渋滞)。軸3: 間隔を広めにして取り違えヒットを防ぐ
          const stopX=Math.max(bladeStop,jamStop);
          if(o.x<stopX)o.x=stopX;
          // 軸3: 直近0.6秒以内に「狙い成功」タップがあったときだけ、刃に着いたオブジェクトを壊す。
          // タップの正誤に関係なく壊れていた自動衝突をやめ、放っておくと刃の手前で渋滞するようにする。
          if(lastAimT>0&&o.x<=bladeStop+0.01){hitObstacle(o);}
        }
        if(o.dead){o.squash-=0.1*dt;o.x-=speed*0.6*dt;
          if(o.type==="cone")o.rot=(o.rot||0)+0.25*dt; // 軸7: コーンは倒れて転がる
          if(o.squash<=0)o._gone=true;
        }else{
          queueBack=Math.max(queueBack,o.x+o.w*0.5); // 次(後ろ)のオブジェクトから見た渋滞の壁
        }
        drawObstacle(o,o===aimTarget&&!o.dead);
      }
      obstacles=obstacles.filter(o=>!o._gone&&o.x>-120);

      // ---- shards ----
      for(const s of shards){s.vy+=0.4*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.rot+=s.vr*dt;
        if(s.y>groundY-2){s.y=groundY-2;s.vy*=-0.4;s.vx*=0.7;if(Math.abs(s.vy)<1)s.life-=0.05*dt;}
        s.life-=s.decay*dt;
        g.save();g.globalAlpha=Math.max(0,s.life);g.translate(s.x,s.y);g.rotate(s.rot);
        g.fillStyle=s.col;g.beginPath();
        g.moveTo(-s.r*0.5,-s.r*0.4);g.lineTo(s.r*0.5,-s.r*0.5);
        g.lineTo(s.r*0.45,s.r*0.5);g.lineTo(-s.r*0.5,s.r*0.4);g.closePath();g.fill();
        g.fillStyle="rgba(255,255,255,.5)";g.fillRect(-s.r*0.4,-s.r*0.35,s.r*0.5,s.r*0.25);
        g.restore();}
      shards=shards.filter(s=>s.life>0);

      // ---- snow puffs (soft clouds) ----
      g.save();
      for(const p of puffs){p.r+=p.vr*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=p.decay*dt;
        g.globalAlpha=Math.max(0,p.life)*0.6;g.fillStyle="#ffffff";
        g.beginPath();g.arc(p.x,p.y,Math.max(0,p.r),0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      puffs=puffs.filter(p=>p.life>0);

      // ---- shockwave rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        const rr=Math.max(0,ri.r);
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.ellipse(ri.x,ri.y,rr,rr*0.6,0,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);

      // ---- the snowplow bulldozer ----
      drawTruck(moving);

      // ---- glint sparks ----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#fff7e0";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;
      sparks=sparks.filter(sp=>sp.life>0);

      // ---- falling snow (foreground) ----
      g.fillStyle="#ffffff";
      for(const f of snowfall){f.y+=f.sp*speed*0.3*dt+f.sp*dt;f.x+=Math.sin(f.ph+tsec)*f.sw*dt-speed*0.15*dt;
        if(f.y>api.H){f.y=-4;f.x=rnd(0,api.W);}
        if(f.x<-4)f.x=api.W;
        g.globalAlpha=0.5+0.4*Math.sin(f.ph+tsec*2);
        g.beginPath();g.arc(f.x,f.y,f.r,0,TAU);g.fill();}
      g.globalAlpha=1;

      // ---- speed lines when boosting ----
      if(boost>0.25||moving){
        g.save();g.globalCompositeOperation="lighter";g.strokeStyle="rgba(255,255,255,.5)";
        const n=Math.floor(2+boost*8);
        for(let i=0;i<n;i++){const ly=truckY-truckH*0.4+rnd(-truckH,truckH);
          const lx=truckX+truckW*0.4+((tsec*600+i*120)%api.W);
          g.globalAlpha=0.3*Math.min(1,boost+0.3);g.lineWidth=2;
          g.beginPath();g.moveTo(lx,ly);g.lineTo(lx-40-boost*30,ly);g.stroke();}
        g.restore();g.globalAlpha=1;}

      // ---- combo text (top-center safe zone) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.16);g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(80,160,220,.8)";g.shadowBlur=14;g.fillStyle="#4db8ff";
        g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.7)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";}

      // ---- HUD: stage + progress (top-center) + fever gauge (bottom-center) ----
      drawHUD();
      drawFever();

      // ---- FEVER TIME banner ----
      if(feverBannT>0){feverBannT-=0.016*dt;
        const a=clamp(feverBannT*1.6,0,1),pop=1+Math.max(0,feverBannT-1.2)*2.2+0.06*Math.sin(tsec*12);
        g.save();g.translate(api.W/2,api.H*0.32);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        const fg=g.createLinearGradient(-140,0,140,0);
        RAINBOW.forEach((c,i)=>fg.addColorStop(i/(RAINBOW.length-1),c));
        g.shadowColor="rgba(255,210,63,.9)";g.shadowBlur=22;g.fillStyle=fg;
        g.fillText("フィーバー タイム！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("フィーバー タイム！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";}
      // 軸6: フィーバー演出が鳴り終わったら、待たせていたステージクリアを出す(重ね出し禁止)
      if(pendingClear&&feverBannT<=0){pendingClear=false;doStageClear();}

      // ---- impact flash ----
      if(flash>0){flash-=0.06*dt;
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=Math.max(0,flash)*0.25;
        g.fillStyle="#ffffff";g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}

      // ---- STAGE CLEAR banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.4;g.fillStyle="#0a2a3a";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(80,180,255,.9)";g.shadowBlur=20;g.fillStyle="#bfeaff";
        g.fillText("ステージ クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ クリア！",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const prevTxt=stagePreview(stage),ptw=g.measureText(prevTxt).width;
        // 軸6: 予告テキストの下に半透明の角丸背景を敷いてコントラストを確保(灰色オーバーレイに埋もれない)
        g.fillStyle="rgba(10,30,45,.62)";rrect(-ptw/2-16,40-20,Math.max(0,ptw+32),34,12);g.fill();
        g.fillStyle="#fff";g.fillText(prevTxt,0,40); // teaser: what's coming next
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnGap=60;}}
      // 軸6: クリアバナーが消えたら、待たせていたフィーバーバナーを出す(重ね出し禁止)
      if(pendingFeverBanner&&clearT<=0){pendingFeverBanner=false;feverBannT=1.5;}

      // ① にじいろプレゼント！ 中央バナー(虹色に色替わり=レアの大祝福)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=RAINBOW[Math.floor(tsec*6)%RAINBOW.length];
        g.save();g.translate(api.W/2,api.H*0.22);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 40px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle="#ffffff";g.fillText("にじいろプレゼント！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろプレゼント！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 中央の小ヒント(初回だけ大きめに一度教える)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.28);g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.4,0,1);g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(BLOCKNAME[luckyColor]||"")+"！";
        g.shadowColor=luckyColor;g.shadowBlur=12;
        g.lineWidth=4;g.lineJoin="round";g.strokeStyle="rgba(255,255,255,.85)";g.strokeText(t2,0,0);
        g.shadowBlur=0;g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.lineJoin="miter";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ ノンストップ ボーナス！ バナー(クリア文字の下=重ねない)
      if(nonstopT>0){nonstopT-=0.014*dt;
        const pop=1+Math.max(0,nonstopT-1.3)*1.3;
        g.save();g.translate(api.W/2,api.H*0.6);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(nonstopT*1.3,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=16;g.fillStyle="#c7ffcf";
        g.fillText("ノンストップ ボーナス！",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,120,60,.7)";g.strokeText("ノンストップ ボーナス！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(nonstopT<0)nonstopT=0;}

      // 白飛び対策の保険: フレーム末で加算合成を必ず戻す(溜まり残り防止)
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
    },
    stop(){}
  };

  function stagePreview(s){
    if(s===2)return"つぎは ゆきが もっと ふえる！";
    if(s===3)return"つぎは こおりブロックが でてくる！";
    if(s===4)return"つぎは スピードアップ！こおりも ふえる！";
    if(s===5)return"つぎは オーロラの そら！さいごの まち！";
    return"さいしょの まちへ！もっと はやく はしろう！";
  }

  function drawFever(){
    const bw=Math.min(api.W*0.5,240),bh=14,bx=(api.W-bw)/2,by=api.H-30;
    g.save();
    g.fillStyle="rgba(10,42,58,.5)";rrect(bx-5,by-3,bw+10,bh+6,(bh+6)/2);g.fill();
    g.lineWidth=2;g.strokeStyle="rgba(255,255,255,.5)";rrect(bx-5,by-3,bw+10,bh+6,(bh+6)/2);g.stroke();
    const fr=fever?clamp(feverT/FEVER_LEN,0,1):feverG;
    if(fr>0.01){
      const lg=g.createLinearGradient(bx,0,bx+bw,0);
      if(fever){RAINBOW.forEach((c,i)=>lg.addColorStop(i/(RAINBOW.length-1),c));
        g.shadowBlur=12+6*Math.sin(tsec*8);g.shadowColor="#ffd23f";}
      else{lg.addColorStop(0,"#ffe14a");lg.addColorStop(1,"#ff9a3a");}
      g.fillStyle=lg;rrect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();g.shadowBlur=0;
      // moving shimmer
      const sxp=bx+((tsec*120)%Math.max(bw*fr,1));
      if(bw*fr>8){g.save();rrect(bx,by,bw*fr,bh,bh/2);g.clip();
        g.globalAlpha=0.5;g.fillStyle="#fff";g.fillRect(sxp,by,3,bh);g.restore();}
    }
    g.font="800 14px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
    g.lineWidth=4;g.lineJoin="round";g.strokeStyle="rgba(10,42,58,.6)";
    const label=fever?"フィーバー ちゅう！ てん 2ばい！":"フィーバー";
    if(fever){g.shadowBlur=10+5*Math.sin(tsec*8);g.shadowColor="#ffd23f";}
    g.strokeText(label,api.W/2,by-7);g.fillStyle=fever?"#fff":"#fff5d6";g.fillText(label,api.W/2,by-7);
    g.restore();g.textAlign="left";g.lineJoin="miter";
  }

  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.05;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#1b3a4a";g.shadowColor="rgba(255,255,255,.6)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+" / "+STAGES+"     あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,0,0,.18)";rrect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const lg=g.createLinearGradient(bx,0,bx+bw,0);
      lg.addColorStop(0,"#7be0ff");lg.addColorStop(1,"#4db8ff");
      g.fillStyle=lg;rrect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=2;rrect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }

  function drawObstacle(o,isTarget){
    const sx=o.x,sy=o.y,w=o.w,h=Math.max(0,o.h*o.squash);  // squashのオーバーシュートで負→楕円の負半径クラッシュを防ぐ
    g.save();g.translate(sx,sy+ (o.h-h)*0.5);
    // ground shadow
    g.fillStyle="rgba(80,110,130,.25)";g.beginPath();
    g.ellipse(0,h*0.5,w*0.55,h*0.12,0,0,TAU);g.fill();
    if(o.type==="gold"){
      // GOLDEN PRESENT: glowing, wobbling, impossible to miss
      const pu=0.5+0.5*Math.sin(o.wob*3);
      g.save();g.globalCompositeOperation="lighter";
      const au=g.createRadialGradient(0,0,0,0,0,w*(0.75+pu*0.3));
      au.addColorStop(0,"rgba(255,225,100,.55)");au.addColorStop(1,"rgba(255,225,100,0)");
      g.fillStyle=au;g.beginPath();g.arc(0,0,w*(0.75+pu*0.3),0,TAU);g.fill();g.restore();
      // 画像プレゼント: 光の輪(上)ときらめき星(下)だけ重ねる。当たり判定 w×h に合わせた正方形で描く
      // (一覧表計測: 画像の不透明域は 横94%×縦98% → 一辺 h*1.02 で見た目 ≒ 判定 w0.9h×h、底が地面に着く)
      const gs=Math.max(w,h)*1.02;
      if(api.drawAsset("gold.png",0,0,gs,gs,{center:true,rot:Math.sin(o.wob*2.2)*0.09})){
        g.save();g.globalCompositeOperation="lighter";g.fillStyle="#fff9d0";
        for(let i=0;i<3;i++){const a=o.wob*2+i*TAU/3,sr=w*0.62;
          const sx2=Math.cos(a)*sr,sy2=Math.sin(a)*sr*0.7-h*0.1,ss=3+2*Math.sin(o.wob*4+i);
          g.globalAlpha=0.6+0.4*Math.sin(o.wob*5+i*2);
          g.beginPath();g.moveTo(sx2,sy2-ss);g.lineTo(sx2+ss*0.35,sy2);g.lineTo(sx2,sy2+ss);
          g.lineTo(sx2-ss*0.35,sy2);g.closePath();g.fill();}
        g.restore();g.globalAlpha=1;
      } else {
      g.save();g.rotate(Math.sin(o.wob*2.2)*0.09); // excited wiggle
      const gd=g.createLinearGradient(-w*0.5,-h*0.5,w*0.5,h*0.5);
      gd.addColorStop(0,"#fff2a0");gd.addColorStop(0.5,"#ffd23f");gd.addColorStop(1,"#e0a000");
      g.fillStyle=gd;rrect(-w*0.42,-h*0.36,w*0.84,h*0.78,w*0.1);g.fill();
      g.strokeStyle="rgba(160,100,0,.6)";g.lineWidth=2;rrect(-w*0.42,-h*0.36,w*0.84,h*0.78,w*0.1);g.stroke();
      // ribbon cross + bow
      g.fillStyle="#ff5b8d";
      g.fillRect(-w*0.07,-h*0.36,w*0.14,h*0.78);g.fillRect(-w*0.42,-h*0.04,w*0.84,h*0.14);
      g.beginPath();g.arc(-w*0.1,-h*0.42,w*0.09,0,TAU);g.arc(w*0.1,-h*0.42,w*0.09,0,TAU);g.fill();
      // twinkling star sparkles orbiting the box
      g.save();g.globalCompositeOperation="lighter";g.fillStyle="#fff9d0";
      for(let i=0;i<3;i++){const a=o.wob*2+i*TAU/3,sr=w*0.62;
        const sx2=Math.cos(a)*sr,sy2=Math.sin(a)*sr*0.7-h*0.1,ss=3+2*Math.sin(o.wob*4+i);
        g.globalAlpha=0.6+0.4*Math.sin(o.wob*5+i*2);
        g.beginPath();g.moveTo(sx2,sy2-ss);g.lineTo(sx2+ss*0.35,sy2);g.lineTo(sx2,sy2+ss);
        g.lineTo(sx2-ss*0.35,sy2);g.closePath();g.fill();}
      g.restore();g.globalAlpha=1;
      g.restore();
      }
    }else if(o.type==="rainbow"){
      // にじいろプレゼント: 虹色に光る宝箱。ぷるぷる揺れて激レアを主張。
      const pu=0.5+0.5*Math.sin(o.wob*3);
      g.save();g.globalCompositeOperation="lighter";
      const au=g.createRadialGradient(0,0,0,0,0,w*(0.8+pu*0.3));
      au.addColorStop(0,"rgba(255,220,170,.5)");au.addColorStop(1,"rgba(255,220,170,0)");
      g.fillStyle=au;g.beginPath();g.arc(0,0,w*(0.8+pu*0.3),0,TAU);g.fill();g.restore();
      g.save();g.rotate(Math.sin(o.wob*2.2)*0.1);
      const gd=g.createLinearGradient(-w*0.5,-h*0.5,w*0.5,h*0.5);
      RAINBOW.forEach((c,i)=>gd.addColorStop(i/(RAINBOW.length-1),c));
      g.fillStyle=gd;rrect(-w*0.42,-h*0.36,w*0.84,h*0.78,w*0.1);g.fill();
      g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=2;rrect(-w*0.42,-h*0.36,w*0.84,h*0.78,w*0.1);g.stroke();
      // ribbon cross + bow (white)
      g.fillStyle="rgba(255,255,255,.92)";
      g.fillRect(-w*0.07,-h*0.36,w*0.14,h*0.78);g.fillRect(-w*0.42,-h*0.04,w*0.84,h*0.14);
      g.beginPath();g.arc(-w*0.1,-h*0.42,w*0.09,0,TAU);g.arc(w*0.1,-h*0.42,w*0.09,0,TAU);g.fill();
      // orbiting rainbow sparkles
      g.save();g.globalCompositeOperation="lighter";
      for(let i=0;i<4;i++){const a=o.wob*2+i*TAU/4,sr=w*0.6;
        const sx2=Math.cos(a)*sr,sy2=Math.sin(a)*sr*0.7-h*0.05,ss=3+2*Math.sin(o.wob*4+i);
        g.globalAlpha=0.6+0.4*Math.sin(o.wob*5+i*2);g.fillStyle=RAINBOW[i%RAINBOW.length];
        g.beginPath();g.moveTo(sx2,sy2-ss);g.lineTo(sx2+ss*0.35,sy2);g.lineTo(sx2,sy2+ss);g.lineTo(sx2-ss*0.35,sy2);g.closePath();g.fill();}
      g.restore();g.globalAlpha=1;
      g.restore();
    }else if(o.type==="block"){
      // いろとりどりの積み木(ラッキー色の対象): やさしい顔つき、雪をかぶる
      const grd=g.createLinearGradient(-w*0.5,-h*0.5,w*0.5,h*0.5);
      grd.addColorStop(0,shade(o.col,26));grd.addColorStop(1,shade(o.col,-24));
      g.fillStyle=grd;rrect(-w*0.5,-h*0.5,w,h,w*0.14);g.fill();
      g.fillStyle="rgba(255,255,255,.28)";rrect(-w*0.5,-h*0.5,w,h*0.28,w*0.14);g.fill();
      g.strokeStyle="rgba(0,0,0,.22)";g.lineWidth=2;rrect(-w*0.5,-h*0.5,w,h,w*0.14);g.stroke();
      // snow cap
      g.fillStyle="rgba(255,255,255,.9)";g.beginPath();g.ellipse(0,-h*0.5,w*0.4,h*0.1,0,0,TAU);g.fill();
      // friendly face
      g.fillStyle="#2b2b3a";g.beginPath();g.arc(-w*0.15,-h*0.02,w*0.06,0,TAU);g.arc(w*0.15,-h*0.02,w*0.06,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.9)";g.beginPath();g.arc(-w*0.17,-h*0.05,w*0.02,0,TAU);g.arc(w*0.13,-h*0.05,w*0.02,0,TAU);g.fill();
      g.strokeStyle="#2b2b3a";g.lineWidth=Math.max(1.5,w*0.03);g.lineCap="round";
      g.beginPath();g.arc(0,h*0.06,w*0.12,0.12*Math.PI,0.88*Math.PI);g.stroke();
      // ② ラッキー色のヒント: 今日の色なら頭上に小さな星がキラッ(気づけるヒント)
      if(o.col===luckyColor){g.save();g.globalCompositeOperation="lighter";
        const tw=0.5+0.5*Math.sin(o.wob*4);g.globalAlpha=0.5+0.5*tw;g.fillStyle="#fff7c2";
        const ss=w*0.13*(0.7+0.3*tw),ty=-h*0.66;
        g.beginPath();g.moveTo(0,ty-ss);g.lineTo(ss*0.35,ty);g.lineTo(0,ty+ss);g.lineTo(-ss*0.35,ty);g.closePath();g.fill();
        g.restore();g.globalAlpha=1;}
    }else if(o.type==="cone"&&api.drawAsset("cone.png",0,-h*0.02,h*1.04,h*1.04,{center:true,rot:o.dead?(o.rot||0):0})){
      // 画像コーン: 当たり判定の高さ h に合わせた正方形で描く(雪の帽子だけ重ねる)。軸7: 壊れたら倒れて転がる
      // (一覧表計測: 不透明域は 縦93%・横68%、先端が上端 → 一辺 h*1.04・少し上げて底を地面 +0.5h に合わせる)
      g.fillStyle="#ffffff";g.beginPath();g.arc(0,-h*0.5,w*0.14,0,TAU);g.fill();
    }else if(o.type==="cone"){
      // traffic cone, snow-dusted。軸7: 壊れたら倒れて転がる(他はその場で潰れる)
      g.save();g.rotate(o.dead?(o.rot||0):0);
      g.fillStyle=o.col;
      g.beginPath();g.moveTo(0,-h*0.5);g.lineTo(w*0.5,h*0.45);g.lineTo(-w*0.5,h*0.45);g.closePath();g.fill();
      g.fillStyle="rgba(255,255,255,.85)";
      g.fillRect(-w*0.42,-h*0.05,w*0.84,h*0.16);
      g.fillStyle="#5a3a20";g.fillRect(-w*0.55,h*0.42,w*1.1,h*0.1);
      // snow cap on top
      g.fillStyle="#ffffff";g.beginPath();g.arc(0,-h*0.5,w*0.16,0,TAU);g.fill();
      g.restore();
    }else if(o.type==="snowman"){
      // 軸7: 3段重ねの雪だるま(いちばん大きい・ヒットのたびに頭の段が落ちて縮む=iceとは違う崩れ方)
      const segH=h/3;
      for(let i=0;i<3;i++){
        const cy=h*0.5-segH*(i+0.5),rr=Math.max(2,w*0.5*(1-i*0.16));
        const grd=g.createRadialGradient(-rr*0.25,cy-rr*0.3,rr*0.1,0,cy,rr);
        grd.addColorStop(0,"#ffffff");grd.addColorStop(1,"#d9edf5");
        g.fillStyle=grd;g.beginPath();g.arc(0,cy,rr,0,TAU);g.fill();
        g.strokeStyle="rgba(140,180,200,.5)";g.lineWidth=1.5;g.beginPath();g.arc(0,cy,rr,0,TAU);g.stroke();
      }
      const topY=h*0.5-segH*2.5;
      g.fillStyle="#2b2b3a";g.beginPath();g.arc(-w*0.09,topY-w*0.02,Math.max(0.5,w*0.035),0,TAU);
      g.arc(w*0.09,topY-w*0.02,Math.max(0.5,w*0.035),0,TAU);g.fill();
      g.fillStyle="#ff8a3a";g.beginPath();g.moveTo(0,topY);g.lineTo(w*0.16,topY+w*0.03);g.lineTo(0,topY+w*0.06);g.closePath();g.fill();
      g.strokeStyle="#8a5a2a";g.lineWidth=Math.max(1.5,w*0.03);const midY=h*0.5-segH*1.5;
      g.beginPath();g.moveTo(-w*0.4,midY);g.lineTo(-w*0.15,midY);g.moveTo(w*0.4,midY);g.lineTo(w*0.15,midY);g.stroke();
    }else if(o.type==="icicle"){
      // 軸7: 小さいつらら(即壊れる)。逆三角の氷柱で、砕けると下にパラパラ落ちる(他は上に弾ける)
      const grd=g.createLinearGradient(0,-h*0.5,0,h*0.5);
      grd.addColorStop(0,"#eafaff");grd.addColorStop(1,"#9fd6ea");
      g.fillStyle=grd;g.beginPath();g.moveTo(-w*0.45,-h*0.5);g.lineTo(w*0.45,-h*0.5);g.lineTo(0,h*0.5);g.closePath();g.fill();
      g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=1.5;g.stroke();
      g.fillStyle="rgba(255,255,255,.6)";g.fillRect(-w*0.12,-h*0.42,w*0.1,h*0.7);
    }else if(o.type==="ice"){
      // ice block: translucent cyan with shine, crack when chipped
      const grd=g.createLinearGradient(-w*0.5,-h*0.5,w*0.5,h*0.5);
      grd.addColorStop(0,"#eafaff");grd.addColorStop(0.5,o.col);grd.addColorStop(1,"#7fc6e6");
      g.fillStyle=grd;rrect(-w*0.5,-h*0.5,w,h,w*0.12);g.fill();
      g.strokeStyle="rgba(255,255,255,.8)";g.lineWidth=2;rrect(-w*0.5,-h*0.5,w,h,w*0.12);g.stroke();
      g.fillStyle="rgba(255,255,255,.5)";g.fillRect(-w*0.4,-h*0.4,w*0.22,h*0.7);
      if(o.hp<2){g.strokeStyle="rgba(60,110,140,.7)";g.lineWidth=2;g.lineCap="round";
        g.beginPath();g.moveTo(-w*0.1,-h*0.4);g.lineTo(w*0.05,-h*0.05);g.lineTo(-w*0.08,h*0.2);g.lineTo(w*0.08,h*0.45);g.stroke();}
    }else{
      // snow pile / mound: soft rounded humps with sparkle
      const wob=Math.sin(o.wob)*h*0.03;
      const grd=g.createRadialGradient(-w*0.2,-h*0.3,h*0.1,0,0,h);
      grd.addColorStop(0,"#ffffff");grd.addColorStop(0.7,o.col);grd.addColorStop(1,"#d6ecf5");
      g.fillStyle=grd;
      g.beginPath();
      g.moveTo(-w*0.5,h*0.5);
      g.quadraticCurveTo(-w*0.5,-h*0.2+wob,-w*0.18,-h*0.3);
      g.quadraticCurveTo(0,-h*0.55,w*0.18,-h*0.3);
      g.quadraticCurveTo(w*0.5,-h*0.2-wob,w*0.5,h*0.5);
      g.closePath();g.fill();
      // sparkle dots
      g.fillStyle="rgba(255,255,255,.9)";
      g.beginPath();g.arc(-w*0.15,-h*0.1,h*0.04,0,TAU);
      g.arc(w*0.12,h*0.05,h*0.03,0,TAU);g.fill();
    }
    // 軸3: 「ここを狙おう」の薄いリング(1体だけに重ねる=どこを押せばいいか分かる)
    if(isTarget){
      const pr=Math.max(2,w*0.62)*(1+0.04*Math.sin(tsec*6));
      g.save();g.globalAlpha=0.5+0.25*Math.sin(tsec*6);
      g.strokeStyle="rgba(255,255,255,.9)";g.lineWidth=Math.max(2,w*0.05);
      g.beginPath();g.arc(0,0,pr,0,TAU);g.stroke();
      g.restore();g.globalAlpha=1;
    }
    // hit flash overlay
    if(o.hit>0){g.globalAlpha=o.hit*0.6;g.fillStyle="#fff";
      rrect(-w*0.5,-h*0.5,w,h,w*0.1);g.fill();g.globalAlpha=1;}
    g.restore();
  }

  function drawTruck(moving){
    const x=truckX,y=truckY,w=truckW,h=truckH;
    const bounce=moving?Math.sin(tsec*16)*2:Math.sin(tsec*2)*1;
    g.save();g.translate(x,y+bounce);
    // shadow
    g.fillStyle="rgba(70,100,120,.3)";g.beginPath();
    g.ellipse(0,h*0.55,w*0.6,h*0.16,0,0,TAU);g.fill();
    // 除雪車は手描き(生成画像は2回とも背景の写り込み/複数体で不良だったため画像を使わない)
    // ---- snowplow blade (front, big and friendly) ----
    g.save();g.translate(-w*0.45,h*0.05);
    const bg=g.createLinearGradient(0,-h*0.5,0,h*0.5);
    bg.addColorStop(0,"#ffe14a");bg.addColorStop(0.5,"#ffc02a");bg.addColorStop(1,"#e09000");
    g.fillStyle=bg;
    g.beginPath();
    g.moveTo(0,-h*0.45);
    g.quadraticCurveTo(-w*0.22,-h*0.3,-w*0.2,h*0.1);
    g.lineTo(-w*0.18,h*0.45);
    g.lineTo(w*0.04,h*0.45);
    g.lineTo(w*0.04,-h*0.45);
    g.closePath();g.fill();
    g.strokeStyle="rgba(120,70,0,.6)";g.lineWidth=3;g.stroke();
    // blade shine
    g.fillStyle="rgba(255,255,255,.45)";g.fillRect(-w*0.16,-h*0.35,w*0.06,h*0.7);
    // warning stripes
    g.fillStyle="rgba(40,30,0,.5)";
    for(let i=0;i<3;i++)g.fillRect(-w*0.18,-h*0.2+i*h*0.22,w*0.2,h*0.06);
    g.restore();
    // ---- body / cab ----
    const bdy=g.createLinearGradient(0,-h*0.4,0,h*0.4);
    bdy.addColorStop(0,"#ff7b5b");bdy.addColorStop(0.5,"#ff5b3b");bdy.addColorStop(1,"#d63a20");
    g.fillStyle=bdy;rrect(-w*0.32,-h*0.45,w*0.7,h*0.85,h*0.18);g.fill();
    g.strokeStyle="rgba(120,30,10,.5)";g.lineWidth=2;rrect(-w*0.32,-h*0.45,w*0.7,h*0.85,h*0.18);g.stroke();
    // body shine
    g.fillStyle="rgba(255,255,255,.3)";rrect(-w*0.28,-h*0.4,w*0.6,h*0.16,h*0.08);g.fill();
    // cabin window (cute eye-like)
    g.fillStyle="#bfeaff";rrect(-w*0.05,-h*0.35,w*0.32,h*0.42,h*0.1);g.fill();
    g.strokeStyle="rgba(120,160,180,.7)";g.lineWidth=2;rrect(-w*0.05,-h*0.35,w*0.32,h*0.42,h*0.1);g.stroke();
    g.fillStyle="rgba(255,255,255,.6)";g.beginPath();
    g.ellipse(w*0.06,-h*0.2,w*0.08,h*0.1,-0.4,0,TAU);g.fill();
    // little driver face (a friendly dot character)
    g.fillStyle="#ffd9a8";g.beginPath();g.arc(w*0.12,-h*0.08,h*0.1,0,TAU);g.fill();
    g.fillStyle="#2b2b3a";g.beginPath();g.arc(w*0.1,-h*0.1,h*0.022,0,TAU);g.arc(w*0.17,-h*0.1,h*0.022,0,TAU);g.fill();
    g.strokeStyle="#2b2b3a";g.lineWidth=1.6;g.lineCap="round";
    g.beginPath();g.arc(w*0.13,-h*0.06,h*0.035,0.1*Math.PI,0.9*Math.PI);g.stroke();
    // hard hat on driver
    g.fillStyle="#ffd23f";g.beginPath();g.arc(w*0.13,-h*0.14,h*0.1,Math.PI,TAU);g.fill();
    // exhaust / beacon light (blinks)
    const beac=0.5+0.5*Math.sin(tsec*8);
    g.save();g.globalCompositeOperation="lighter";g.fillStyle="rgba(255,180,60,"+(0.4+0.5*beac)+")";
    g.beginPath();g.arc(-w*0.05,-h*0.5,h*0.07*(0.7+0.4*beac),0,TAU);g.fill();g.restore();
    g.fillStyle="#ffb000";g.beginPath();g.arc(-w*0.05,-h*0.48,h*0.05,0,TAU);g.fill();
    // ---- wheels (spinning) ----
    drawWheel(-w*0.14,h*0.4,h*0.2);
    drawWheel(w*0.2,h*0.4,h*0.2);
    g.restore();
  }
  function drawWheel(wx,wy,r){
    g.save();g.translate(wx,wy);
    g.fillStyle="#2b2b33";g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    g.fillStyle="#555";g.beginPath();g.arc(0,0,r*0.5,0,TAU);g.fill();
    g.save();g.rotate(wheelSpin);
    g.strokeStyle="#888";g.lineWidth=Math.max(2,r*0.12);
    for(let i=0;i<4;i++){g.rotate(Math.PI/2);
      g.beginPath();g.moveTo(0,0);g.lineTo(0,r*0.45);g.stroke();}
    g.restore();
    g.fillStyle="#ccc";g.beginPath();g.arc(0,0,r*0.16,0,TAU);g.fill();
    g.restore();
  }
  function rrect(x,y,w,h,r){r=Math.min(r,w*0.5,h*0.5);
    g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
}
Engine.register("snowplow", buildSnowplow);
