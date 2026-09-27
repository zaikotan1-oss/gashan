function buildAvalanche(api){
  const g=api.g;
  // 画像アセットは背景のみ(無ければ従来の手描きにフォールバック)。
  // 雪玉/金ブロックのスプライトは生成が2回とも不良(顔・床・マゼンタ被り)だったので手描きのまま。
  api.preload(["bg.jpg"]);
  // ---- all mutable state lives here (closure) ----
  let balls=[],obstacles=[],shards=[],sparks=[],rings=[],puffs=[],flakes=[],floats=[];
  // ⑥ 同フレーム内で複数のfloatが同じ場所に出て重ならないよう、frame()の先頭で0に戻し
  //   floats.pushのたびに積み上げる縦オフセット(コンボ/キラキラ/にじいろ/ラッキー/ジャストヒットが対象)
  let floatStack=0;
  let groundY,slopeTop,slopeBot,slopeX0,slopeX1,unit;
  let count=0,combo=0,comboT=0,tsec=0,flash=0,chargeT=0,lastStopT=-9;
  // stage progression: clear a number of obstacles -> "ステージ クリア!" -> harder, endless
  let stage=1,stageKill=0,stageGoal=10,clearT=0,clearStage=0;
  // FEVER TIME: destroying blocks fills a gauge -> 12s of rainbow madness
  // (everything 1-hit, double points, extra obstacles). "また あれを 出したい!"
  let fever=0,feverGauge=0,feverBanner=0;
  const FEVER_LEN=12;
  const RAINBOW=["#ff4d8d","#ff8a3a","#ffd23f","#3fffb0","#36c9ff","#b066ff"];
  // per-stage winter palettes (sky gradient + accent) + name for the "next up" teaser
  const STAGE_BG=[
    {top:"#bfe9ff",mid:"#9fd4f0",low:"#e8f5ff",accent:"#7ec8ff",name:"まひるの ゆきやま"}, // 1 clear day
    {top:"#a9c4ff",mid:"#c8b8ff",low:"#efe6ff",accent:"#b58bff",name:"ゆうぐれの ゆきやま"}, // 2 dusk
    {top:"#1c2a52",mid:"#3a4f8a",low:"#aebfe6",accent:"#ffd23f",name:"よるの ゆきやま"}, // 3 night
    {top:"#ffd3c2",mid:"#ffc8d6",low:"#fff0e6",accent:"#ff9ec2",name:"あさやけの ゆきやま"}, // 4 dawn
    {top:"#bff0e6",mid:"#9fe0d0",low:"#e8fff8",accent:"#3fffb0",name:"こおりの ゆきやま"}  // 5 frost
  ];
  function curBg(){return STAGE_BG[(stage-1)%STAGE_BG.length];}
  function stageGoalFor(s){return 10+(s-1)*4;}     // 10,14,18,22...（7〜8歳向けに手応えを増やした）
  // background props
  let trees=[],bgFlakes=[],sparkleStars=[];
  const OBS_COL=["#c45a3a","#3f7fc4","#c4a03f","#7a5fc4","#3fa86a","#c43f7a"];
  const COLNAME={"#c45a3a":"あか","#3f7fc4":"あお","#c4a03f":"きいろ","#7a5fc4":"むらさき","#3fa86a":"みどり","#c43f7a":"ピンク"};
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  let luckyColor=pick(OBS_COL),luckySeen=false,luckyMsgT=0; // ② きょうのラッキー色: 秘密の1色
  let rbMsgT=0;                                             // ① にじいろブロック 発見バナー
  let comboKept=true,nonstopT=0;                            // ③ ノンストップ判定(このステージで連鎖を切らさない)
  let sunWink=0;                                            // ④ 太陽/月ひみつタップの目パチ
  const sunPos={x:0,y:0,r:0};                              // ④ 太陽/月の当たり判定(layoutで確定)
  // ⑥ 見やすさ対策: 目立つバナー(にじ/ラッキー/フィーバー)は同時に出さない。
  //   すでに何か出ている間はテキストの表示だけ0.3秒ずらす(音や揺れなど手応えは即時のまま)。
  //   クリア/ノンストップは位置がずらしてあり意図的に同時表示なので対象外。
  function bannerBusy(){return clearT>0.5||nonstopT>0.5||rbMsgT>0.5||luckyMsgT>0.5||feverBanner>0.5;}
  function queueBanner(setter){if(bannerBusy())setTimeout(setter,300);else setter();}

  function buildBg(){
    trees=[];const n=6;
    for(let i=0;i<n;i++)trees.push({x:api.W*((i+0.5)/n)+rnd(-api.W*0.04,api.W*0.04),
      y:api.H*rnd(0.5,0.62),s:rnd(0.7,1.25),sw:rnd(0,TAU)});
    bgFlakes=[];for(let i=0;i<60;i++)bgFlakes.push({x:rnd(0,api.W),y:rnd(0,api.H),
      r:rnd(1.4,4.2),sp:rnd(0.3,1.1),drift:rnd(0.1,0.5),ph:rnd(0,TAU)});
    sparkleStars=[];for(let i=0;i<26;i++)sparkleStars.push({x:rnd(0,api.W),y:rnd(0,api.H*0.7),
      ph:rnd(0,TAU),sp:rnd(0.04,0.12)});
  }
  function layout(){
    groundY=api.H*0.9;
    unit=clamp(Math.min(api.W,api.H)*0.05,22,42);
    // a snowy slope running top-left down to bottom-right
    slopeX0=api.W*0.06; slopeTop=api.H*0.30;
    slopeX1=api.W*0.78; slopeBot=api.H*0.74;
    // re-seat existing obstacles on the (possibly moved) surface
    for(const o of obstacles){o.x=clamp(o.x,0,api.W*0.94);o.by=surfYAt(o.x);}
    // ④ 太陽/月ひみつタップの当たり判定(描画位置に一致・寛容に大きめ)
    sunPos.x=api.W*0.82;sunPos.y=api.H*0.14;sunPos.r=Math.max(42,api.W*0.10);
    buildBg();
  }
  layout();

  // height of the slope surface at a given x (clamped to slope span)
  function slopeYAt(x){
    const t=clamp((x-slopeX0)/(slopeX1-slopeX0),0,1);
    return lerp(slopeTop,slopeBot,t);
  }
  // actual surface height: slopeYAt clamps t, so past slopeX1 it is a flat
  // run-out at slopeBot — one CONTINUOUS surface with no cliff, so rolling
  // balls always reach every obstacle (no dead zone they fly over)
  function surfYAt(x){return slopeYAt(x);}

  // ③ 縦レーン: 的をこの本数の帯に振り分けて置く(タップ位置でどのレーンを狙うか生まれる)
  const LANE_N=3;
  // ⑦ 丸い岩/背の高いタワー/横広の壁/氷の家(建物)の4種で見た目と壊れ方を変える。
  //   家は柱=タワーと同じ「硬そう」な印象を出せるので、hp2(かたいブロック)側にも回せる。
  const KINDS=["round","tower","wall","house"];
  const HARD_KINDS=["tower","house"]; // ⑦ hp2(かたい)に使ってよい見るからに硬そうな種類
  function spawnObstacle(){
    // obstacles sit ON the surface all along the ball's path (mid-slope to right edge)
    const minX=lerp(slopeX0,slopeX1,0.35), maxX=api.W*0.94;
    const laneW=(maxX-minX)/LANE_N;
    const lane=rint(0,LANE_N-1);
    const x=clamp(minX+laneW*(lane+0.5)+rnd(-laneW*0.32,laneW*0.32),minX,maxX);
    // ① 激レア にじいろブロック (~3.5%) — 虹色に光り、壊すと虹の大盤振る舞い＋大量得点。
    //    ふだんの金ブロック(~8%)より さらにレア。いつ出るか分からない=ドキドキ発見。
    const rainbow=Math.random()<0.035;
    const gold=!rainbow&&Math.random()<0.08;
    if(rainbow){api.tone(1046,0.08,"triangle",0.07);api.tone(1568,0.09,"triangle",0.06);api.tone(2093,0.12,"triangle",0.05);}
    else if(gold){api.tone(1568,0.09,"triangle",0.08);api.tone(2093,0.12,"triangle",0.06);}
    let hp;
    if(rainbow||gold||fever>0)hp=1;             // レア/フィーバーは気持ちよく一撃
    else hp=(stage>=3&&Math.random()<0.36?2:1);   // かたいこおりブロックを少し増やす(7〜8歳向け)
    // ⑦ かたいブロック(hp2)は硬そうな「タワー/家」からランダム。他は丸/タワー/壁/家からランダム。
    const kind=hp>=2?pick(HARD_KINDS):pick(KINDS);
    // ⑦補助: たまに(~14%)ふつうブロックの1.5〜2倍幅の「おおきい」個体を混ぜ、大小のコントラストを出す。
    //   激レア/金は既に専用サイズがあるので対象外。
    const big=!rainbow&&!gold&&Math.random()<0.14;
    let w;
    if(rainbow)w=rnd(unit*1.2,unit*1.6);
    else if(gold)w=rnd(unit*1.1,unit*1.5);
    else if(big)w=rnd(unit*1.7,unit*2.3);
    else w=rnd(unit*0.8,unit*1.3);
    obstacles.push({x,by:surfYAt(x),col:rainbow?RAINBOW[0]:(gold?"#ffd23f":pick(OBS_COL)),gold,rainbow,hp,kind,lane,big,
      w,wob:rnd(0,TAU)});
  }
  function ensureObstacles(){
    // fever floods the field with extra targets so every ball plows a long chain
    const want=clamp(4+Math.floor(stage/2),4,8)+(fever>0?3:0);
    let guard=0;
    while(obstacles.length<want&&guard++<20) spawnObstacle();
  }
  ensureObstacles();

  function startAvalanche(px,py){
    // tap launches a fresh snowball from the top of the slope; grows as it rolls
    chargeT=1;
    // ③ タップx座標でレーン(狙い先)が決まる。画面を3分割し、どのレーンを狙ったかを
    //    玉に持たせておく(このレーンの的に当たると本来の得点、ズレたレーンは点が伸びにくい)。
    //    発射位置そのものも同じレーンへ寄せるので、狙いが見た目にも反映される。
    // (発射位置そのものは坂の入口付近から少しだけ振る程度に留め、密度/粘り強さの数字を崩さない。
    //  「狙い」の主効果はレーン一致ボーナス側=hitObstacle()の得点調整で受け持つ)
    const lane=clamp(Math.floor(clamp(px,0,api.W)/api.W*LANE_N),0,LANE_N-1);
    const laneNudge=(lane-(LANE_N-1)/2)*unit*0.9;
    const sx=slopeX0+laneNudge+rnd(-unit*0.3,unit*0.6);
    balls.push({x:sx,y:slopeYAt(sx)-unit*0.6,vx:rnd(2.2,3.4),vy:0,
      r:unit*rnd(0.5,0.7),grew:0,spin:0,onGround:false,life:1,lane});
    // puff of snow kicked up at the launch
    for(let i=0;i<10;i++){const a=rnd(-2.4,-0.6),s=rnd(1.5,4);
      puffs.push({x:sx,y:slopeYAt(sx),vx:Math.cos(a)*s,vy:Math.sin(a)*s,
        r:rnd(unit*0.2,unit*0.45),life:1,decay:rnd(0.02,0.04)});}
    api.slide(420,180,0.18,0.16,"sine");
    api.noise(0.22,0.18,900,"lowpass",0.7);
    api.shake(3);
  }

  function hitObstacle(b,o){
    let gain=1+Math.floor(b.r/unit); // bigger ball = more points
    if(o.gold)gain*=5;               // golden block jackpot
    if(o.rainbow)gain=gain*6+8;      // ① にじいろブロック: 大量得点
    // ② きょうのラッキー色: 秘密の色のふつうブロックを壊すと +2 の隠しボーナス
    const isLucky=!o.gold&&!o.rainbow&&o.col===luckyColor;
    if(isLucky)gain+=2;
    if(fever>0){gain*=2;o.hp=Math.min(o.hp,1);} // fever: double points, everything 1-hit
    // ③ 狙ったレーン(タップした場所)の的ほど得点がまるごと伸びる。当たり自体は今まで通り
    //    全て命中して壊れる(爽快感・密度は崩さない)ので、狙わなくても壊せて楽しいままだが、
    //    ズレたレーンで壊すと金/にじ/フィーバー込みの合計点ごと大きく目減りする=連打だけでは稼げない。
    if(!o.gold&&!o.rainbow&&b.lane!==undefined&&o.lane!==undefined){
      const ld=Math.abs(b.lane-o.lane);
      gain=Math.max(1,Math.round(gain*(ld===0?1:(ld===1?0.4:0.12))));
    }
    const oy=o.by;
    // ③ ジャストヒット: 狙ったレーン(タップ位置)と的のレーンが一致した命中は、
    //   既存のsparks/toneに加えて言葉でも「当たった!」を即時に伝える(壊れる/割れる両方で出す)。
    const isJustHit=!o.gold&&!o.rainbow&&b.lane!==undefined&&o.lane!==undefined&&b.lane===o.lane;
    if(isJustHit){
      floats.push({x:o.x,y:oy-o.w-16-floatStack*26,txt:"ジャストヒット!",life:1,vy:-1.0,col:"#3fffb0",size:20});
      floatStack++;
      api.tone(1760,0.05,"triangle",0.05);
    }
    o.hp--;
    if(o.hp>0){
      // tough block: just cracks, ball slows a touch
      b.vx*=0.78;
      api.noise(0.08,0.16,1600,"highpass",0.8);api.tone(240,0.07,"square",0.08);
      api.shake(4);flash=Math.min(1,flash+0.12);
      for(let i=0;i<6;i++){const a=rnd(0,TAU),s=rnd(2,5);
        sparks.push({x:o.x,y:oy-o.w*0.6,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,
          len:rnd(6,14),life:1,decay:rnd(0.05,0.09)});}
      return;
    }
    // destroyed!
    count+=gain;stageKill++;combo++;comboT=1;
    api.setScore(count);
    const big=b.r>unit*1.1;
    // debris chunks (golden / rainbow blocks burst into RAINBOW pieces)
    // ⑦ 壊れ方も見た目に合わせる: 丸→まるい欠片(砕ける)/ タワー→細長い角材(崩れる)/ 壁→平たい板(はじけ飛ぶ)
    const shape=o.kind==="round"?"circle":"rect";
    for(let i=rint(6,9)+((o.gold||o.rainbow)?5:0);i>0;i--){const a=rnd(-TAU/2,0),s=rnd(3,8);
      const base=rnd(o.w*0.2,o.w*0.4);
      let sw=base,sh=base;
      if(o.kind==="tower"){sw=base*0.55;sh=base*1.6;}
      else if(o.kind==="wall"){sw=base*1.7;sh=base*0.5;}
      else if(o.kind==="house"){sw=base*1.2;sh=base*0.9;} // ⑦ 家は角ばった瓦礫として崩れる
      shards.push({x:o.x+rnd(-o.w*0.4,o.w*0.4),y:oy-rnd(0,o.w*1.2),
        vx:Math.cos(a)*s+b.vx*0.4,vy:Math.sin(a)*s-rnd(1,4),
        s:base,sw,sh,shape,col:(o.gold||o.rainbow)?pick(RAINBOW):o.col,rot:rnd(0,TAU),vr:rnd(-0.4,0.4),
        life:1,decay:rnd(0.008,0.016)});}
    // snow puffs + shockwave + glints
    for(let i=0;i<8;i++){const a=rnd(0,TAU),s=rnd(2,5);
      puffs.push({x:o.x,y:oy-o.w*0.5,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,
        r:rnd(unit*0.25,unit*0.55),life:1,decay:rnd(0.02,0.035)});}
    rings.push({x:o.x,y:oy-o.w*0.5,r:o.w*0.5,vr:o.w*0.6,life:1,decay:0.05,col:o.col});
    rings.push({x:o.x,y:oy-o.w*0.5,r:o.w*0.25,vr:o.w*0.5,life:1,decay:0.05,col:"#ffffff"});
    for(let i=0;i<rint(5,8);i++){const a=rnd(0,TAU),s=rnd(3,8);
      sparks.push({x:o.x,y:oy-o.w*0.5,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
        len:rnd(8,16),life:1,decay:rnd(0.05,0.09)});}
    // the ball grows from eating an obstacle (snowballing)
    b.r=Math.min(b.r+unit*0.28,unit*2.2);b.grew=1;
    flash=Math.min(1,flash+0.3+(big?0.2:0));
    api.slide(300-Math.min(combo*8,120),70,0.22,0.4,"sine");
    api.noise(0.2,0.28,1100,"lowpass",0.7);
    api.tone(440*Math.pow(2,clamp(combo,0,12)/12),0.12,"triangle",0.1);
    api.boom(big?0.6:0.4);
    api.shake(6+Math.min(combo,8));
    // hitStop only for a big ball's smash, and never twice in quick succession
    // (spamming it every hit would freeze the game during chain destruction)
    if(big&&tsec-lastStopT>0.6){api.hitStop(3);lastStopT=tsec;}
    if(combo>1){
      // ⑥ 直前のfloatがコンボ表示(末尾が数字のx始まり)ならpushせず使い回し、同時表示数を減らす
      const lastFl=floats.length?floats[floats.length-1]:null;
      const isComboFl=lastFl&&typeof lastFl.txt==="string"&&lastFl.txt[0]==="x"&&!isNaN(parseInt(lastFl.txt.slice(1),10));
      const cCol=combo>=8?"#ff5b9e":combo>=4?"#ff8c42":"#ffd23f",cSize=combo>=4?38:30;
      if(isComboFl){lastFl.txt="x"+combo;lastFl.life=1;lastFl.y=oy-o.w-16-floatStack*26;lastFl.col=cCol;lastFl.size=cSize;}
      else floats.push({x:o.x,y:oy-o.w-16-floatStack*26,txt:"x"+combo,life:1,vy:-1.1,col:cCol,size:cSize});
      floatStack++;
    }
    // golden block jackpot: fanfare + big float + extra glints
    if(o.gold){
      floats.push({x:o.x,y:oy-o.w-44-floatStack*26,txt:"キラキラ +"+gain,life:1,vy:-0.8,col:"#ffd23f",size:40});
      floatStack++;
      api.tone(1046,0.12,"triangle",0.14);
      setTimeout(()=>{api.tone(1318,0.12,"triangle",0.14);},90);
      setTimeout(()=>{api.tone(1568,0.2,"triangle",0.16);},180);
      api.boom(0.5);flash=Math.min(1,flash+0.35);
      for(let i=0;i<10;i++){const a=rnd(0,TAU),s=rnd(4,9);
        sparks.push({x:o.x,y:oy-o.w*0.6,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
          len:rnd(10,20),life:1,decay:rnd(0.03,0.06)});}
    }
    // ① にじいろブロック撃破: 5色の虹の輪＋にじ色の破片＋ファンファーレ(激レアの爽快ごほうび)
    if(o.rainbow){
      queueBanner(()=>{rbMsgT=1.5;}); // ⑥ 他のバナーと重なる時は表示だけ少し遅らせる
      floats.push({x:o.x,y:oy-o.w-46-floatStack*26,txt:"にじいろ +"+gain,life:1,vy:-0.8,col:"#ff4d8d",size:42});
      floatStack++;
      for(let k=0;k<RAINBOW.length;k++)
        rings.push({x:o.x,y:oy-o.w*0.5,r:o.w*0.4,vr:o.w*(0.5+k*0.14),life:1,decay:0.05,col:RAINBOW[k]});
      api.tone(880,0.1,"triangle",0.11);
      setTimeout(()=>{api.tone(1320,0.12,"triangle",0.11);},80);
      setTimeout(()=>{api.tone(1760,0.16,"triangle",0.09);},170);
      api.boom(0.6);api.shake(12);flash=Math.min(1,flash+0.3);
      if(tsec-lastStopT>0.6){api.hitStop(4);lastStopT=tsec;}
      for(let i=0;i<16;i++){const a=rnd(0,TAU),s=rnd(3,9);
        sparks.push({x:o.x,y:oy-o.w*0.5,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
          len:rnd(10,20),life:1,decay:rnd(0.03,0.05)});}
    }
    // ② ラッキー色命中: 小さな祝福(白飛びしないよう控えめ)＋頭上に星のキラッ
    if(isLucky){
      if(!luckySeen){luckySeen=true;queueBanner(()=>{luckyMsgT=1.8;});} // ⑥ 表示だけ遅らせて重なりを防ぐ
      floats.push({x:o.x,y:oy-o.w-40-floatStack*26,txt:"ラッキー!",life:1,vy:-0.8,col:luckyColor,size:32});
      floatStack++;
      api.tone(1046,0.12,"triangle",0.1);api.tone(1568,0.14,"triangle",0.08);
      // 頭上の小さな星(気づけるヒント)
      for(let i=0;i<5;i++){const a=rnd(-2.3,-0.8),s=rnd(2,5);
        sparks.push({x:o.x+rnd(-o.w*0.3,o.w*0.3),y:oy-o.w-8,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
          len:rnd(6,12),life:1,decay:rnd(0.03,0.05)});}
    }
    // fill the fever gauge (gold charges it fast)
    if(fever<=0){
      feverGauge=Math.min(1,feverGauge+((o.gold||o.rainbow)?0.28:0.09));
      if(feverGauge>=1)startFever();
    }
    // mark obstacle dead
    o.dead=true;
    checkStage();
  }

  function startFever(){
    fever=FEVER_LEN;feverGauge=0;flash=1;
    // ⑥ この一撃でステージクリアも同時に起きる時は、クリアバナー(y=0.44H)と位置が近く
    //   重なって読めなくなるのでフィーバーの大バナーだけ今回は出さない
    //   (空が虹色になる/ゲージが反転する/効果音は鳴るので"フィーバーに入った"こと自体は伝わる)。
    if(stageKill<stageGoal) queueBanner(()=>{feverBanner=1.8;});
    for(const o of obstacles)o.hp=Math.min(o.hp,1); // soften everything on the field
    api.boom(0.7);api.shake(18);
    api.slide(392,1568,0.5,0.28,"triangle");
    setTimeout(()=>{api.tone(1046,0.16,"triangle",0.3);},140);
    setTimeout(()=>{api.tone(1318,0.16,"triangle",0.3);},280);
    setTimeout(()=>{api.tone(1568,0.28,"triangle",0.3);},420);
    // celebratory star burst
    for(let i=0;i<20;i++){const a=rnd(0,TAU),s=rnd(3,9);
      sparks.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
        len:rnd(10,22),life:1,decay:rnd(0.02,0.04)});}
    if(tsec-lastStopT>0.6){api.hitStop(4);lastStopT=tsec;}
    ensureObstacles();
  }
  function endFever(){
    fever=0;
    api.tone(660,0.12,"sine",0.12);
    setTimeout(()=>{api.tone(440,0.18,"sine",0.1);},130);
  }

  function checkStage(){
    if(stageKill<stageGoal||clearT>0)return;
    // ⑥ ステージクリアは一番大事な瞬間。もし直前にフィーバー/にじいろ/ラッキーの大バナーが
    //   出ていたら退かして、クリア演出と絶対に重ならないようにする(タイミングがずれて
    //   別々に発火した場合の保険。位置が近いバナー同士が同時に立つのを防ぐ)。
    feverBanner=0;rbMsgT=0;luckyMsgT=0;
    clearStage=stage;clearT=1.7;flash=1;
    api.boom(0.6);api.shake(14);
    api.slide(523,1046,0.4,0.22,"triangle");
    api.tone(784,0.25,"triangle",0.12);
    // star burst from the center
    for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
      sparks.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
        len:rnd(10,20),life:1,decay:rnd(0.02,0.04)});}
    // ③ ノンストップ ボーナス: このステージを コンボを切らさず走り切ったら +3 & 祝福バナー。
    //    気づくと得する頭を使う隠し判定(気づかなくてもクリアはできる)。
    if(comboKept){count+=3;api.setScore(count);nonstopT=1.9;
      api.tone(1318,0.16,"triangle",0.12);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(3,8);
        sparks.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
          len:rnd(8,16),life:1,decay:rnd(0.02,0.04)});}}
    comboKept=true;  // 次ステージのノンストップ判定をリセット
    stage++;stageGoal=stageGoalFor(stage);stageKill=0;buildBg();
  }

  return{
    resize:layout,
    input(px,py,type){
      if(type!=="down")return;
      if(clearT>0)return;            // ignore taps during clear banner
      // ④ 太陽/月ひみつタップ: 触れたら ウインク＋金コインがこぼれる(なだれ発射はそのまま/減点なし)
      if(Math.hypot(px-sunPos.x,py-sunPos.y)<sunPos.r){
        sunWink=1;api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.08);
        for(let i=0;i<4;i++){const a=rnd(-2.2,-0.6),s=rnd(2,4.5);
          shards.push({x:sunPos.x+rnd(-8,8),y:sunPos.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
            s:rnd(unit*0.2,unit*0.32),col:pick(["#ffd23f","#fff0a0","#ffe08a"]),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),
            life:1,decay:rnd(0.01,0.016)});}
        for(let i=0;i<6;i++){const a=rnd(0,TAU),s=rnd(3,7);
          sparks.push({x:sunPos.x,y:sunPos.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
            len:rnd(8,16),life:1,decay:rnd(0.03,0.05)});}
      }
      if(balls.length>=14)return;    // hard cap so spam can't explode the array
      startAvalanche(px,py);
    },
    frame(dt,now){
      tsec+=0.016*dt;
      floatStack=0; // ⑥ このフレームで新たに積み上げるfloatの段数をリセット
      if(chargeT>0)chargeT=Math.max(0,chargeT-0.05*dt);
      if(fever>0){fever-=0.016*dt;if(fever<=0)endFever();}
      if(feverBanner>0)feverBanner=Math.max(0,feverBanner-0.016*dt);
      const bg=curBg();
      // ---- sky gradient (画像背景があればそれを使い、面ごとの色を薄く重ねる) ----
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 1面(まひる)は絵そのまま。2面以降はステージの空色を薄く重ねて夕方/夜/朝焼け/氷の雰囲気を出す
        const pi=(stage-1)%STAGE_BG.length;
        if(pi!==0){g.save();g.globalAlpha=pi===2?0.42:0.28;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,bg.top);tg.addColorStop(0.5,bg.mid);tg.addColorStop(1,bg.low);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,bg.top);grd.addColorStop(0.45,bg.mid);grd.addColorStop(1,bg.low);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // ---- FEVER sky takeover: scrolling rainbow bands over everything ----
      if(fever>0){
        g.save();g.globalCompositeOperation="lighter";
        const bandH=api.H/RAINBOW.length;
        for(let i=0;i<RAINBOW.length;i++){
          g.globalAlpha=0.10+0.05*Math.sin(tsec*4+i*1.3);
          g.fillStyle=RAINBOW[(i+Math.floor(tsec*3))%RAINBOW.length];
          g.fillRect(0,i*bandH,api.W,bandH+1);
        }
        g.restore();g.globalAlpha=1;
      }
      // ---- twinkling sky sparkles ----
      g.save();g.globalCompositeOperation="lighter";
      for(const s of sparkleStars){s.ph+=s.sp*dt;
        const tw=0.3+0.4*Math.sin(s.ph);if(tw<=0)continue;
        g.globalAlpha=tw*0.7;g.fillStyle=bg.accent;
        g.beginPath();g.arc(s.x,s.y,1.6,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      // ---- soft sun/moon glow ----
      const sunx=api.W*0.82,suny=api.H*0.14;
      let sun=g.createRadialGradient(sunx,suny,0,sunx,suny,api.W*0.4);
      sun.addColorStop(0,"rgba(255,255,245,.5)");sun.addColorStop(0.3,"rgba(255,250,220,.18)");
      sun.addColorStop(1,"rgba(255,250,220,0)");
      g.fillStyle=sun;g.fillRect(0,0,api.W,api.H);
      g.save();g.shadowColor="rgba(255,255,235,.9)";g.shadowBlur=26;
      g.fillStyle="rgba(255,255,240,.92)";g.beginPath();g.arc(sunx,suny,unit*0.7,0,TAU);g.fill();g.restore();
      // ④ ひみつタップ: 叩かれた瞬間だけ ^_^ のウインク顔が出る(発見のごほうび)
      if(sunWink>0){sunWink-=0.018*dt;const sr=unit*0.7;
        g.save();g.strokeStyle="#c0a040";g.lineWidth=Math.max(2,sr*0.16);g.lineCap="round";g.globalAlpha=clamp(sunWink*1.4,0,1);
        g.beginPath();
        g.moveTo(sunx-sr*0.5,suny-sr*0.05);g.quadraticCurveTo(sunx-sr*0.32,suny-sr*0.34,sunx-sr*0.14,suny-sr*0.05);
        g.moveTo(sunx+sr*0.14,suny-sr*0.05);g.quadraticCurveTo(sunx+sr*0.32,suny-sr*0.34,sunx+sr*0.5,suny-sr*0.05);
        g.stroke();
        g.beginPath();g.arc(sunx,suny+sr*0.16,sr*0.36,0.12*Math.PI,0.88*Math.PI);g.stroke();
        g.restore();g.globalAlpha=1;if(sunWink<0)sunWink=0;}
      // ---- distant pine trees ※画像背景のときは絵の木を活かして描かない ----
      if(!imgBg) for(const t of trees){
        const sway=Math.sin(tsec*0.5+t.sw)*0.04;
        g.save();g.translate(t.x,t.y);g.rotate(sway);g.scale(t.s,t.s);
        const th=unit*2.4,tw=unit*1.0;
        g.fillStyle="rgba(40,80,60,.55)";
        for(let k=0;k<3;k++){const yy=-k*th*0.28,sc=1-k*0.22;
          g.beginPath();g.moveTo(0,-th*0.5+yy);g.lineTo(tw*0.5*sc,yy);g.lineTo(-tw*0.5*sc,yy);g.closePath();g.fill();}
        // snow caps on the tree
        g.fillStyle="rgba(255,255,255,.8)";
        for(let k=0;k<3;k++){const yy=-k*th*0.28,sc=1-k*0.22;
          g.beginPath();g.moveTo(0,-th*0.5+yy);g.lineTo(tw*0.22*sc,-th*0.28+yy);g.lineTo(-tw*0.22*sc,-th*0.28+yy);g.closePath();g.fill();}
        g.restore();
      }
      // ---- the snowy slope (filled wedge) ----
      g.beginPath();
      g.moveTo(slopeX0,slopeTop);
      g.lineTo(api.W,slopeYAt(api.W));
      g.lineTo(api.W,api.H);
      g.lineTo(0,api.H);
      g.lineTo(0,slopeTop+(slopeBot-slopeTop)*((0-slopeX0)/(slopeX1-slopeX0)));
      g.closePath();
      let sg=g.createLinearGradient(0,slopeTop,0,api.H);
      sg.addColorStop(0,"#ffffff");sg.addColorStop(0.5,"#eaf4ff");sg.addColorStop(1,"#cdddf0");
      // 画像背景のときは坂を半透明にして絵を透かす(玉が転がる面=ゲーム要素なので消さない)
      if(imgBg){g.save();g.globalAlpha=0.42;g.fillStyle=sg;g.fill();g.restore();}
      else{g.fillStyle=sg;g.fill();}
      // slope crest highlight line
      g.strokeStyle="rgba(255,255,255,.9)";g.lineWidth=3;g.lineCap="round";
      g.beginPath();g.moveTo(slopeX0,slopeTop);g.lineTo(api.W,slopeYAt(api.W));g.stroke();
      // subtle blue shading under the crest
      g.strokeStyle="rgba(150,190,230,.35)";g.lineWidth=6;
      g.beginPath();g.moveTo(slopeX0,slopeTop+6);g.lineTo(api.W,slopeYAt(api.W)+6);g.stroke();
      // ---- flat snow ground at the bottom ※画像背景のときは平坦な帯を描かない ----
      if(!imgBg){
        g.fillStyle="#dbe8f5";g.fillRect(0,groundY,api.W,api.H-groundY);
        g.fillStyle="rgba(255,255,255,.7)";g.fillRect(0,groundY,api.W,4);
      }

      // ③ レーン帯: どこを狙うと得点が伸びるか(hitObstacle()の隠しレーン倍率)を画面に出す。
      //   spawnObstacle()と同じ式でレーン3本分の帯を描き、直近に発射した玉が狙っているレーンだけ明るくする。
      {
        const laneMinX=lerp(slopeX0,slopeX1,0.35),laneMaxX=api.W*0.94;
        const laneW=(laneMaxX-laneMinX)/LANE_N;
        const aimLane=balls.length?balls[balls.length-1].lane:-1;
        for(let li=0;li<LANE_N;li++){
          const lx=laneMinX+laneW*li;
          g.fillStyle=(li===aimLane)?"rgba(255,255,255,.22)":"rgba(255,255,255,.08)";
          g.fillRect(lx,slopeTop,Math.max(0,laneW),Math.max(0,api.H-slopeTop));
        }
      }
      // ---- obstacles (snowmen-ish blocks down in the run-out) ----
      for(const o of obstacles){
        const wob=Math.sin(tsec*2+o.wob)*0.5;
        drawObstacle(o,wob);
      }

      // ---- update + draw balls ----
      const gAcc=0.5;
      for(const b of balls){
        if(b.grew>0)b.grew=Math.max(0,b.grew-0.06*dt);
        const surfY=slopeYAt(b.x)-b.r;
        // simple physics: roll down-right, settle onto slope/ground
        b.vy+=gAcc*dt;
        b.x+=b.vx*dt;b.y+=b.vy*dt;
        // continuous surface collision (slope, then flat run-out at slopeBot)
        const floorY=surfYAt(b.x)-b.r;
        if(b.y>=floorY){
          b.y=floorY;
          if(b.vy>0)b.vy*=-0.18;          // tiny bounce
          if(Math.abs(b.vy)<1.4)b.vy=0;
          if(b.x<slopeX1){                 // gravity along the slope keeps it rolling
            b.vx=Math.min(b.vx+0.16*dt,9);
          }else{
            b.vx*=Math.pow(0.985,dt);      // friction on the flat
          }
          b.onGround=true;
        }
        b.spin+=b.vx*0.04*dt;
        // collide with obstacles (each sits on the surface at o.by;
        // generous vertical margin so hops off the slope edge still connect)
        for(const o of obstacles){
          if(o.dead)continue;
          if(Math.abs(b.x-o.x)<b.r+o.w*0.7 && b.y>o.by-b.r-o.w*2.2){
            hitObstacle(b,o);
            if(o.dead){o.x=-9999;} // pushed off; will be filtered
          }
        }
        // fade out a ball that stops or leaves the screen
        if(b.x>api.W+b.r*2 || (b.onGround&&Math.abs(b.vx)<0.4&&b.x>slopeX1)){
          b.life-=0.04*dt;
        }
        drawBall(b);
      }
      balls=balls.filter(b=>b.life>0 && b.x<api.W+b.r*3);
      // NOTE: never splice the FRONT of the pack here — evicting the oldest
      // (front-most) ball each tap kept the pack from ever reaching the
      // right-side obstacles. The >=14 guard in input() caps spawns instead.
      // remove destroyed obstacles, refill the field
      obstacles=obstacles.filter(o=>!o.dead);
      if(clearT<=0)ensureObstacles();

      // ---- snow puffs ----
      for(const p of puffs){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=0.06*dt;p.vx*=0.96;
        p.r+=0.6*dt;p.life-=p.decay*dt;
        g.globalAlpha=Math.max(0,p.life)*0.7;g.fillStyle="#ffffff";
        g.beginPath();g.arc(p.x,p.y,p.r,0,TAU);g.fill();}
      g.globalAlpha=1;puffs=puffs.filter(p=>p.life>0);
      if(puffs.length>90)puffs.splice(0,puffs.length-90);

      // ---- shards ----
      for(const s of shards){s.vy+=0.45*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.rot+=s.vr*dt;
        const sfy=surfYAt(s.x)-2;
        if(s.y>sfy){s.y=sfy;s.vy*=-0.4;s.vx*=0.7;if(Math.abs(s.vy)<1.2)s.life-=0.04*dt;}
        s.life-=s.decay*dt;
        g.save();g.globalAlpha=Math.max(0,s.life);g.translate(s.x,s.y);g.rotate(s.rot);
        g.fillStyle=s.col;
        if(s.shape==="circle"){
          const rr=Math.max(0,(s.sw||s.s)/2);
          g.beginPath();g.arc(0,0,rr,0,TAU);g.fill();
          g.fillStyle="rgba(255,255,255,.4)";
          g.beginPath();g.arc(-rr*0.3,-rr*0.3,Math.max(0,rr*0.35),0,TAU);g.fill();
        } else {
          const sw=s.sw||s.s,sh=s.sh||s.s;
          g.fillRect(-sw/2,-sh/2,sw,sh);
          g.fillStyle="rgba(255,255,255,.4)";g.fillRect(-sw/2,-sh/2,sw,sh*0.3);
        }
        g.restore();}
      g.globalAlpha=1;shards=shards.filter(s=>s.life>0);
      if(shards.length>80)shards.splice(0,shards.length-80);

      // ---- shockwave rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      g.globalAlpha=1;rings=rings.filter(ri=>ri.life>0);

      // ---- glint sparks (additive) ----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#fff7ff";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;sparks=sparks.filter(sp=>sp.life>0);
      if(sparks.length>120)sparks.splice(0,sparks.length-120);

      // ---- falling snow (foreground) ----
      g.fillStyle="#ffffff";
      for(const f of bgFlakes){f.y+=f.sp*dt;f.x+=Math.sin(tsec+f.ph)*f.drift*dt;
        if(f.y>api.H){f.y=-4;f.x=rnd(0,api.W);}
        if(f.x<-4)f.x=api.W;if(f.x>api.W+4)f.x=0;
        g.globalAlpha=0.55;g.beginPath();g.arc(f.x,f.y,f.r,0,TAU);g.fill();}
      g.globalAlpha=1;

      // ⑥ ステージクリアの暗幕はここ(floatsを描く直前=下のレイヤー)で先に塗る。
      //   floatsはこの後に描くので暗幕の上に乗り、コンボ数字が薄れて消えることがなくなる。
      //   帯の高さも0.2H→0.13Hに縮め、テキスト本体の周りだけを暗くする。
      if(clearT>0){
        g.save();g.globalAlpha=clamp(clearT*1.4,0,1)*0.4;g.fillStyle="#1a2a44";
        g.fillRect(0,api.H*0.36,api.W,api.H*0.13);g.restore();
      }
      // ---- floating combo numbers ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0){combo=0;comboKept=false;}} // ③ 連鎖が切れたらノンストップ失敗
      for(const fl of floats){fl.y+=fl.vy*dt;fl.life-=0.018*dt;
        g.globalAlpha=Math.max(0,fl.life);
        g.font="800 "+fl.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(40,60,90,.5)";g.strokeText(fl.txt,fl.x,fl.y);
        g.fillStyle=fl.col;g.fillText(fl.txt,fl.x,fl.y);}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(fl=>fl.life>0);

      // ---- impact flash ----
      if(flash>0){flash-=0.06*dt;
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=Math.max(0,flash)*0.25;
        g.fillStyle="#ffffff";g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}

      // ---- HUD (top-center) + fever gauge (bottom-center) ----
      drawHUD();
      drawFeverBar();

      // ---- FEVER TIME banner ----
      if(feverBanner>0){
        const a=clamp(feverBanner*1.5,0,1),pop=1+Math.max(0,feverBanner-1.5)*2.2;
        g.save();g.translate(api.W/2,api.H*0.4);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="#ffd23f";g.shadowBlur=20;
        g.fillStyle=RAINBOW[Math.floor(tsec*8)%RAINBOW.length];
        g.fillText("フィーバータイム!!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";
        g.strokeText("フィーバータイム!!",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("ぜんぶ 1ぱつ! てんすう 2ばい!",0,40);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }

      // ---- combo text (top-center) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.17);g.scale(pop,pop);
        g.font="800 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(80,160,255,.8)";g.shadowBlur=12;
        g.fillStyle="#ffd23f";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.6)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }

      // ---- ① にじいろブロック! 発見バナー(虹色に色替わり) ----
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.4,col=RAINBOW[Math.floor(tsec*8)%RAINBOW.length];
        g.save();g.translate(api.W/2,api.H*0.24);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 38px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle="#ffffff";g.fillText("にじいろブロック!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろブロック!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ---- ② きょうのラッキー色 はっけん! 中央の小ヒント(初回だけ) ----
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        // ⑥ engine.js の祝福バナー(y=0.3H)とちょうど同じ高さだったのでずらす
        g.save();g.translate(api.W/2,api.H*0.68);g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(COLNAME[luckyColor]||"")+"!";
        g.lineWidth=5;g.strokeStyle="rgba(40,60,90,.5)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ---- ③ ノンストップ ボーナス! バナー(クリア文字と重ねない下側) ----
      if(nonstopT>0){nonstopT-=0.014*dt;
        const pop=1+Math.max(0,nonstopT-1.3)*1.4;
        g.save();g.translate(api.W/2,api.H*0.60);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(nonstopT*1.3,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(63,255,176,.9)";g.shadowBlur=16;g.fillStyle="#c7ffe0";
        g.fillText("ノンストップ ボーナス!",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(30,110,80,.7)";g.strokeText("ノンストップ ボーナス!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(nonstopT<0)nonstopT=0;}

      // ---- STAGE CLEAR banner (暗幕はfloatsより前で既に塗ってある) ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        const pop=1+Math.max(0,clearT-1.4)*1.8;
        g.save();g.translate(api.W/2,api.H*0.44);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(120,200,255,.9)";g.shadowBlur=18;g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";
        g.strokeText("ステージ"+clearStage+" クリア!",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText(previewTxt(),0,40);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;ensureObstacles();}
      }
      // 加算合成をフレーム末で必ず戻す(光が溜まって白飛びしないための保険)
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
    },
    stop(){}
  };

  // ---------- drawing helpers ----------
  function drawBall(b){
    const r=b.r,gp=1+b.grew*0.18;
    g.save();g.translate(b.x,b.y);g.scale(gp,gp);
    // shadow
    g.fillStyle="rgba(60,90,130,.22)";
    g.beginPath();g.ellipse(0,r*0.95,r*0.95,r*0.3,0,0,TAU);g.fill();
    // 雪玉は手描き(白い物は背景抜きが安定しないため画像化しない)
    {
      // snowball body
      const grd=g.createRadialGradient(-r*0.3,-r*0.35,Math.max(0,r*0.1),0,0,Math.max(0,r));
      grd.addColorStop(0,"#ffffff");grd.addColorStop(0.6,"#eef6ff");grd.addColorStop(1,"#c3d6ec");
      g.fillStyle=grd;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
      // spin specks so the roll reads
      g.save();g.rotate(b.spin);g.fillStyle="rgba(170,200,230,.5)";
      for(let i=0;i<4;i++){const a=i*TAU/4;
        g.beginPath();g.arc(Math.cos(a)*r*0.5,Math.sin(a)*r*0.5,r*0.1,0,TAU);g.fill();}
      g.restore();
      // rim + highlight
      g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=2;g.beginPath();g.arc(0,0,r,0,TAU);g.stroke();
      g.fillStyle="rgba(255,255,255,.85)";
      g.beginPath();g.arc(-r*0.35,-r*0.38,r*0.2,0,TAU);g.fill();
    }
    // little cute face (a rolling snow buddy)
    g.fillStyle="#2b3a55";
    g.beginPath();g.arc(-r*0.22,-r*0.05,r*0.1,0,TAU);g.arc(r*0.22,-r*0.05,r*0.1,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.9)";
    g.beginPath();g.arc(-r*0.25,-r*0.08,r*0.035,0,TAU);g.arc(r*0.19,-r*0.08,r*0.035,0,TAU);g.fill();
    g.fillStyle="rgba(255,140,150,.4)";
    g.beginPath();g.arc(-r*0.34,r*0.12,r*0.1,0,TAU);g.arc(r*0.34,r*0.12,r*0.1,0,TAU);g.fill();
    g.strokeStyle="#2b3a55";g.lineWidth=r*0.06;g.lineCap="round";
    g.beginPath();g.arc(0,r*0.12,r*0.14,0.15*Math.PI,0.85*Math.PI);g.stroke();
    g.restore();
  }
  // teaser line shown under the STAGE CLEAR banner ("next up ...")
  function previewTxt(){
    const s=clearStage+1;
    if(s===3)return "つぎは かたい こおりブロックが でてくる!";
    return "つぎは "+STAGE_BG[(s-1)%STAGE_BG.length].name+"!";
  }
  function drawObstacle(o,wob){
    const w=o.w,x=o.x,y=o.by;
    const kind=o.kind||"wall";
    // ⑦ 種類ごとに見た目の大きさを変える(丸=横幅いっぱいの岩,タワー=背の高い2段,壁=横広で低い)
    let bw=w,bh=w*1.2;
    if(kind==="round"){bw=w*1.15;bh=bw;}
    else if(kind==="tower"){bw=w*0.82;bh=w*2.0;}
    else if(kind==="wall"){bw=w*1.6;bh=w*0.62;}
    else if(kind==="house"){bw=w*1.3;bh=w*1.55;} // ⑦ 氷の家(建物): 箱+三角屋根で丸/タワー/壁と違うシルエット
    // にじいろブロックは体色が虹の6色を巡回して にじ色に見える(激レアの合図)
    const base=o.rainbow?RAINBOW[Math.floor(tsec*6+o.wob)%RAINBOW.length]:o.col;
    g.save();g.translate(x,y);g.rotate(wob*((o.gold||o.rainbow)?0.12:0.04)); // gold/rainbow jiggle harder
    // shadow
    g.fillStyle="rgba(60,90,130,.2)";
    g.beginPath();g.ellipse(0,0,Math.max(0,bw*0.7),Math.max(0,bw*0.22),0,0,TAU);g.fill();
    // ブロックは全て手描き(色つき/にじいろは色バリエーションが要る。金は生成画像が不良だったので同じ描き方)
    {
      const grd=g.createLinearGradient(-bw*0.5,-bh,bw*0.5,0);
      grd.addColorStop(0,shadeHex(base,40));grd.addColorStop(0.5,base);grd.addColorStop(1,shadeHex(base,-30));
      g.fillStyle=grd;
      if(kind==="round"){
        // ⑦ 丸い岩/雪玉: 円形の輪郭にして角ブロックとはっきり違う形にする
        const rr=Math.max(0,bh*0.5);
        g.beginPath();g.arc(0,-rr,rr,0,TAU);g.fill();
        g.strokeStyle="rgba(255,255,255,.4)";g.lineWidth=2;
        g.beginPath();g.arc(0,-rr,rr,0,TAU);g.stroke();
        g.fillStyle=shadeHex(base,-20);g.globalAlpha=0.45;
        g.beginPath();g.arc(rr*0.35,-rr*0.7,Math.max(0,rr*0.3),0,TAU);g.fill();g.globalAlpha=1;
      } else if(kind==="tower"){
        // ⑦ 背の高い2段タワー: 継ぎ目を入れて重ねブロック感を出す(硬そうな見た目=hp2と合う)
        roundRect(-bw*0.5,-bh,bw,bh,bw*0.16);g.fill();
        g.strokeStyle="rgba(255,255,255,.4)";g.lineWidth=2;roundRect(-bw*0.5,-bh,bw,bh,bw*0.16);g.stroke();
        g.strokeStyle="rgba(20,30,50,.5)";g.lineWidth=Math.max(2,bw*0.09);
        g.beginPath();g.moveTo(-bw*0.5,-bh*0.5);g.lineTo(bw*0.5,-bh*0.5);g.stroke();
      } else if(kind==="house"){
        // ⑦ 氷の家: 四角い壁+三角の屋根+窓2つで「建物」のシルエットにする(丸/タワー/壁と別カテゴリ)
        const wallH=bh*0.62;
        roundRect(-bw*0.5,-wallH,bw,wallH,bw*0.08);g.fill();
        g.strokeStyle="rgba(255,255,255,.4)";g.lineWidth=2;roundRect(-bw*0.5,-wallH,bw,wallH,bw*0.08);g.stroke();
        g.beginPath();g.moveTo(-bw*0.62,-wallH);g.lineTo(0,-bh);g.lineTo(bw*0.62,-wallH);g.closePath();
        g.fillStyle=shadeHex(base,20);g.fill();
        g.strokeStyle="rgba(255,255,255,.4)";g.stroke();
        // 窓2つ+ドア(建物と分かる目印)
        g.fillStyle="rgba(255,255,240,.8)";
        g.fillRect(-bw*0.34,-wallH*0.86,bw*0.18,bw*0.18);
        g.fillRect(bw*0.16,-wallH*0.86,bw*0.18,bw*0.18);
        g.fillStyle="rgba(90,60,40,.55)";
        g.fillRect(-bw*0.09,-wallH*0.46,bw*0.18,wallH*0.46);
      } else {
        // 横広の壁
        roundRect(-bw*0.5,-bh,bw,bh,bw*0.18);g.fill();
        g.strokeStyle="rgba(255,255,255,.4)";g.lineWidth=2;roundRect(-bw*0.5,-bh,bw,bh,bw*0.18);g.stroke();
      }
      // crack overlay for tough (2-hp, already chipped) blocks
      if(o.hp<2){
        g.strokeStyle="rgba(20,30,50,.6)";g.lineWidth=Math.max(2,bw*0.07);g.lineCap="round";
        g.beginPath();g.moveTo(-bw*0.1,-bh*0.85);g.lineTo(bw*0.08,-bh*0.5);g.lineTo(-bw*0.1,-bh*0.25);g.stroke();
      }
      // snow cap on top
      g.fillStyle="#ffffff";
      g.beginPath();g.ellipse(0,-bh,Math.max(0,bw*0.5),Math.max(0,bw*0.18),0,0,TAU);g.fill();
      if(kind!=="round"&&kind!=="house"){
        g.fillStyle="rgba(255,255,255,.55)";
        g.fillRect(-bw*0.4,-bh*0.9,bw*0.16,bh*0.7);
      }
      // tiny worried eyes (cute target) ※家は窓/ドアがあるので顔は付けない
      if(kind!=="house"){
        g.fillStyle="#fff";
        g.beginPath();g.arc(-bw*0.18,-bh*0.55,Math.max(0,bw*0.12),0,TAU);g.arc(bw*0.18,-bh*0.55,Math.max(0,bw*0.12),0,TAU);g.fill();
        g.fillStyle="#2b3a55";
        g.beginPath();g.arc(-bw*0.18,-bh*0.53,Math.max(0,bw*0.06),0,TAU);g.arc(bw*0.18,-bh*0.53,Math.max(0,bw*0.06),0,TAU);g.fill();
      }
    }
    // GOLDEN block: pulsing glow, orbiting sparkle, bouncing "!" — impossible to miss
    if(o.gold){
      g.save();g.globalCompositeOperation="lighter";
      g.globalAlpha=0.45+0.3*Math.sin(tsec*6+o.wob);
      g.shadowBlur=18;g.shadowColor="#ffd23f";
      g.strokeStyle="#fff3b0";g.lineWidth=3;
      if(kind==="round"){g.beginPath();g.arc(0,-bh*0.5,Math.max(0,bh*0.5),0,TAU);g.stroke();}
      else{roundRect(-bw*0.5,-bh,bw,bh,bw*0.18);g.stroke();}
      // orbiting glint
      const ga=tsec*4+o.wob,gr=bw*0.75;
      g.fillStyle="#fff8d0";g.globalAlpha=0.8;
      g.beginPath();g.arc(Math.cos(ga)*gr,-bh*0.5+Math.sin(ga)*gr*0.6,3,0,TAU);g.fill();
      g.restore();
      const bp=Math.abs(Math.sin(tsec*5+o.wob))*8;
      g.font="900 "+Math.round(bw*0.7)+"px 'Hiragino Maru Gothic ProN',system-ui";
      g.textAlign="center";g.lineWidth=4;g.strokeStyle="rgba(120,80,0,.65)";
      g.strokeText("!",0,-bh-10-bp);g.fillStyle="#ffd23f";g.fillText("!",0,-bh-10-bp);
      g.textAlign="left";
    }
    // にじいろブロック: 虹の輪オーラ＋跳ねる「にじ」印(いつ出るか分からない激レアの合図)
    if(o.rainbow){
      g.save();g.globalCompositeOperation="lighter";
      const rp=0.45+0.3*Math.sin(tsec*6+o.wob);
      const ag=g.createRadialGradient(0,-bh*0.5,0,0,-bh*0.5,Math.max(0,bw*1.6));
      ag.addColorStop(0,"rgba(255,255,255,"+(0.4*rp)+")");
      ag.addColorStop(0.5,"rgba(180,230,255,"+(0.18*rp)+")");
      ag.addColorStop(1,"rgba(180,230,255,0)");
      g.fillStyle=ag;g.beginPath();g.arc(0,-bh*0.5,Math.max(0,bw*1.6),0,TAU);g.fill();
      g.lineWidth=3;
      for(let k=0;k<RAINBOW.length;k++){g.strokeStyle=RAINBOW[k];g.globalAlpha=0.5*rp;
        g.beginPath();g.arc(0,-bh*0.5,Math.max(0,bw*(0.7+k*0.09)),tsec*3+k,tsec*3+k+1.0);g.stroke();}
      g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";
      const bp=Math.abs(Math.sin(tsec*5+o.wob))*8;
      g.font="900 "+Math.round(bw*0.4)+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
      g.lineWidth=4;g.strokeStyle="rgba(60,40,90,.6)";g.strokeText("にじ",0,-bh-8-bp);
      g.fillStyle=RAINBOW[Math.floor(tsec*8)%RAINBOW.length];g.fillText("にじ",0,-bh-8-bp);
      g.textAlign="left";
    }
    g.restore();
  }
  // fever gauge / countdown bar at the bottom-center
  function drawFeverBar(){
    const bw=Math.min(api.W*0.5,260),bh=14,bx=(api.W-bw)/2,by=api.H-32;
    g.save();g.textAlign="center";
    g.fillStyle="rgba(20,40,70,.45)";roundRect(bx-4,by-3,bw+8,bh+6,(bh+6)/2);g.fill();
    const fr=fever>0?fever/FEVER_LEN:feverGauge;
    if(fr>0.01){
      let gg=g.createLinearGradient(bx,0,bx+bw,0);
      if(fever>0){const off=Math.floor(tsec*6);
        for(let i=0;i<RAINBOW.length;i++)gg.addColorStop(i/(RAINBOW.length-1),RAINBOW[(i+off)%RAINBOW.length]);}
      else{gg.addColorStop(0,"#7ec8ff");gg.addColorStop(1,"#ff5b9e");}
      g.fillStyle=gg;roundRect(bx,by,Math.max(bh,bw*clamp(fr,0,1)),bh,bh/2);g.fill();
    }
    g.strokeStyle="rgba(255,255,255,.55)";g.lineWidth=2;
    roundRect(bx-4,by-3,bw+8,bh+6,(bh+6)/2);g.stroke();
    g.font="800 15px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle=fever>0?RAINBOW[Math.floor(tsec*8)%RAINBOW.length]:"#fff";
    g.shadowColor="rgba(30,50,80,.7)";g.shadowBlur=5;
    g.fillText(fever>0?"フィーバー!! てんすう 2ばい!":"フィーバーゲージ",api.W/2,by-7);
    g.restore();g.textAlign="left";
  }
  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=14,bx=(api.W-bw)/2,by=api.H*0.05;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(30,50,80,.6)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(40,70,110,.35)";roundRect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#7ec8ff");gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg;roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;roundRect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }
  function roundRect(x,y,w,h,r){r=Math.min(r,w/2,h/2);
    g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function shadeHex(hex,amt){const c=parseInt(hex.slice(1),16);
    const r=clamp((c>>16)+amt,0,255),gg=clamp(((c>>8)&255)+amt,0,255),b=clamp((c&255)+amt,0,255);
    return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("avalanche", buildAvalanche);
