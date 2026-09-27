function buildCrater(api){
  const g=api.g;
  api.preload(["bg.jpg","crater.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。
  // bubble.png/boss.png はレビューで2回まで作り直したが台座/足/背景残りが取れず不採用→手描きのまま(issues参照)
  let craters=[],shards=[],rings=[],sparks=[],embers=[],heat=[],floats=[];
  let cols,rows,R0,fieldX,fieldY,fieldW,fieldH,tsec=0,count=0,combo=0,comboT=0,flash=0,flashHue="#ff8a3a";
  // stage progression: pop GOAL bubbles -> "ステージ クリア!" -> harder endless. No game over.
  let stage=1,stagePop=0,stageGoal=15,clearT=0,clearStage=0,endingT=0;
  const STAGES=5;
  let novaT=0;                 // combo reward: all bubbles burst at once
  const BUB=["#ff7a2a","#ff5b3a","#ffb347","#ff9a3a","#ffd23f"];
  // --- added spice: gold bubbles / boss stage / next-stage hints ---
  let bossHp=0,bossMaxHp=0,bossWarnT=0,bossActive=false,bossDefeatT=0,bossDone=false;
  let bossX=0,bossY=0,bossSquish=0,bossHitT=0,hitCd=0;
  const BOSS_HP={3:8,5:12};      // boss appears at the end of these stages（7〜8歳向けに少しタフに）
  const RAINBOW=["#ff4d8d","#ffd23f","#3fffb0","#5ad0ff","#b066ff","#ff8a3a"];
  const HINTS={2:"つぎは きんいろの あわが でるぞ!",3:"つぎは …ボスが くる!!",
    4:"つぎは もっと はやい!",5:"さいごは でっかい ボス!!"};
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  // 溶岩バブルは色が一様なので、②ラッキー色は「バブルの中の宝石コア(5色)」で表現する。
  const GEM=[{c:"#ff5b6b",n:"あか"},{c:"#5ad0ff",n:"みず"},{c:"#7be08a",n:"みどり"},
             {c:"#ffe14a",n:"きいろ"},{c:"#c78bff",n:"むらさき"}];
  let luckyGem=pick(GEM),luckyMsgT=0,luckySeen=false;  // ② きょうのラッキー色(秘密の1色)
  let rbMsgT=0,rainbowQueued=false,rainbowSoonT=0;      // ① にじいろバブル + 接近予告(よかん)
  let stageFizzle=0,noMissT=0;                          // ③ ノーミス判定(自然に割れた=ミス)
  let sunWink=0; const sunPos={x:0,y:0,r:0};           // ④ ひみつの ほし タップ
  let lstars=[];                                       // ② ラッキー命中の頭上キラッ
  let stage3BoostT=0;   // 軸4(補助): ステージ3開始直後だけ少しゴールドを出やすくし、90秒でボスに届かない印象を和らげる
  function goldChance(){
    const base=stage>=2?0.09:0.05;
    // 軸4(補助): あとゴール5個以内まで来たら一時的にゴールドを出やすくし、終盤の得点効率を上げてボス到達を後押しする
    const nearGoal=(stageGoal-stagePop)<=5;
    const boosted=nearGoal?base+0.12:base;
    return stage3BoostT>0?Math.min(0.28,boosted+0.10):boosted;
  }
  function bossRadius(){return clamp(Math.min(api.W,api.H)*0.18,70,150);}
  function stageGoalFor(s){return 9+(s-1)*2;}             // 9,11,13,15,17（軸4: ステージ1+2+3累計を48→33個に短縮しボス到達を早める）
  function spawnInterval(){return clamp(34-(stage-1)*4,14,34);}
  // bubble swell speed per stage。旧: 出現→自然破裂が約0.08秒しかなく運ゲーだった。
  // 1個が出現(bub=0.04)から自然破裂(bub>=1)まで約1.0〜2.0秒かけて育つように調整。
  // ステージが進むほど少し速くなるが、どれだけ進んでも0.5秒未満にはならないようclampする。
  function growRate(){
    // 軸4: ステージが進むほど成長が急加速してフィズル(取りこぼし)が増えるのを緩和(0.00013→0.00008)
    const raw=0.00035+(stage-1)*0.00008;
    return clamp(raw,0.00035,0.00095);
  }
  // ambient: rising embers + heat shimmer columns + far smoke puffs
  let smokes=[];
  function buildAmbient(){
    embers=[];for(let i=0;i<26;i++)embers.push({x:rnd(0,api.W),y:rnd(0,api.H),
      r:rnd(1,3.4),sp:rnd(0.3,1.1),sway:rnd(0,TAU),sv:rnd(0.02,0.06),
      col:pick(["#ffd23f","#ff8a3a","#ff5b3a","#fff0a6"])});
    heat=[];for(let i=0;i<6;i++)heat.push({x:rnd(api.W*0.1,api.W*0.9),ph:rnd(0,TAU),
      w:rnd(40,90),sp:rnd(0.03,0.07)});
    smokes=[];for(let i=0;i<4;i++)smokes.push({x:rnd(0,api.W),y:api.H*rnd(0.05,0.3),
      s:rnd(0.8,1.6),sp:rnd(0.04,0.12),a:rnd(0.08,0.18)});
  }
  function layout(){
    cols=clamp(Math.round(api.W/150),3,5);
    rows=clamp(Math.round(api.H/220),2,4);
    R0=clamp(Math.min(api.W/(cols+1),api.H/(rows+2.4))*0.42,30,72);
    fieldW=api.W*0.9; fieldX=(api.W-fieldW)/2;
    fieldH=api.H*0.62; fieldY=api.H*0.24;
    craters=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      craters.push({
        x:fieldX+fieldW*(c+0.5)/cols,
        y:fieldY+fieldH*(r+0.5)/rows,
        bub:0,          // 0 = empty, >0 = bubble grown fraction (0..1)
        growing:false,
        grow:growRate(),
        wob:rnd(0,TAU),
        cd:rnd(10,spawnInterval()+10),  // 軸4補助: spawnIntervalを組み込み、常に育っているバブル数を底上げ(旧: rnd(20,120)固定)
        pop:0,           // pop animation timer (>0 = just burst)
        gloop:rnd(0,TAU),
        gold:false,      // rare golden bubble (big points + fanfare)
        scale:1,         // 軸7: 通常サイズ(下で一部だけ大きくする)
        aspect:rnd(0.5,1.6),  // 軸7: 縦長(積み上がった印象)/横長(寝そべった印象)を混在させ丸一辺倒を崩す(下限を0.7→0.5に広げ体感しやすく)
        shapeType:"bubble"    // 軸7: 大半は丸バブル。一部だけ下で角ばった"lump"に差し替える
      });
    }
    // 軸7(壊す物のバラエティ): 15個前後のうち3〜4個だけ一回り大きいクレーター/バブルにして
    // 大小が混ざって見えるようにする(全部同じ大きさの丸を色違いにしただけ、を避ける)。
    {
      const nBig=Math.min(craters.length,rint(3,4));
      const idxs=[];
      while(idxs.length<nBig){
        const i=Math.floor(rnd(0,craters.length));
        if(!idxs.includes(i)) idxs.push(i);
      }
      for(const i of idxs){
        craters[i].scale=rnd(1.3,1.4);
        // 軸7補助: 大きい個体は寝そべった溶岩だまりに見えるよう、はっきり潰れたaspectを強制する
        // (ランダムaspectだと1.0近くに当たり単なる大きい丸にしか見えないケースがあったため)
        craters[i].aspect=rnd(0.42,0.6);
      }
    }
    // 軸7(壊す物のバラエティ): 1〜2枠だけ丸バブルと違うシルエット(角ばった溶岩の塊=lump)を割り当てる。
    // 通常の楕円メッシュではなく専用ポリゴン描画にし、破片も常にchunk/sliver寄りにする(drawCrater/burst参照)。
    {
      const nLump=Math.min(craters.length,rint(1,2));
      const idxs=[];
      while(idxs.length<nLump){
        const i=Math.floor(rnd(0,craters.length));
        if(!idxs.includes(i)) idxs.push(i);
      }
      for(const i of idxs){
        const c=craters[i];
        c.shapeType="lump";
        c.aspect=rnd(0.8,1.1);   // ポリゴン自体が角ばっているので極端な引き伸ばしは不要
        const nPts=rint(7,9);
        c.lumpPts=[]; for(let k=0;k<nPts;k++) c.lumpPts.push(rnd(0.68,1.15));
      }
    }
    // keep craters dormant while a boss owns the arena (also on resize)
    if(bossActive||bossWarnT>0||bossDefeatT>0){
      bossX=api.W/2; bossY=api.H*0.45;
      for(const c of craters){c.growing=false;c.bub=0;c.cd=9999;}
    }
    // ④ ひみつの ほし: 上空右に小さな星(タップでキラッ+コイン。四隅UI帯を避けy>=64)
    sunPos.x=api.W*0.76; sunPos.y=Math.max(api.H*0.14,64); sunPos.r=Math.max(38,api.W*0.075);
    buildAmbient();
  }
  layout();
  // start a few bubbles so the first frame is lively
  for(let i=0;i<craters.length;i++) if(i%2===0){craters[i].growing=true;craters[i].cd=0;craters[i].bub=rnd(0.05,0.2);}

  function burst(c,big){
    const R=R0*(c.scale||1);   // 軸7: 大きいクレーターは判定/演出も一回り大きく
    const hx=c.x, hy=c.y-R*0.2;
    const size=c.bub;
    const gold=!!c.gold;
    const rainbow=!!c.rainbow;
    // ② ラッキー色: 宝石コアが今日のラッキー色と一致したら隠しボーナス
    const isLucky=!gold && !rainbow && c.gemCol===luckyGem.c;
    // bigger bubble = more points + bigger fx (1..4); gold x5 / にじいろ x8 / ラッキー +2
    let gain=(1+Math.round(size*3))*(rainbow?8:(gold?5:1));
    if(isLucky) gain+=2;
    count+=gain; stagePop++; api.setScore(count);
    combo++; comboT=1; flashHue=rainbow?RAINBOW[Math.floor(tsec*6)%RAINBOW.length]:(gold?"#ffe14a":pick(BUB));
    flash=Math.min(1,flash+(rainbow?0.6:(gold?0.7:0.25+size*0.35)));
    // sound scales with size + combo
    api.slide(360+size*180,90,0.18+size*0.12,0.34,"sawtooth");
    api.noise(0.14+size*0.18,0.26,800,"lowpass",0.8);
    api.tone(420*Math.pow(2,clamp(combo,0,10)/12),0.12,"triangle",0.12);
    if(size>0.6){api.boom(0.4+size*0.25);api.shake(6+size*8);api.hitStop(size>0.85?4:3);}
    else{api.shake(3+size*4);api.hitStop(2);}
    // shockwave rings
    rings.push({x:hx,y:hy,r:R*0.4*size,vr:R*(0.5+size*0.5),life:1,decay:0.05,col:flashHue});
    rings.push({x:hx,y:hy,r:R*0.2*size,vr:R*(0.4+size*0.4),life:1,decay:0.06,col:"#fff0a6"});
    // lava shards (gold / にじいろ bursts spray rainbow)
    const n=(big?16:8)+Math.round(size*10)+Math.min(combo,6)+(gold?10:0)+(rainbow?14:0);
    for(let i=0;i<n;i++){const a=rnd(0,TAU),sp=rnd(2.5,7)*(0.6+size);
      shards.push({x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rnd(1,4),
        r:rnd(3,8)*(0.6+size*0.7),life:1,decay:rnd(0.012,0.022),
        col:(gold||rainbow)?RAINBOW[i%RAINBOW.length]:(i%3===0?"#fff0a6":pick(BUB))});}
    // 軸7: 大きいクレーター・角ばった塊(lump)は必ず、通常サイズも低確率(20%)で、丸い破片に加えて
    // 角ばった岩片(chunk)や細長い破片(sliver)も混ぜる →「砕ける」一辺倒でなく壊れ方の違いを画面全体に広げる
    if((c.scale||1)>1.05 || c.shapeType==="lump" || Math.random()<0.2){
      for(let i=0;i<rint(3,5);i++){const a=rnd(0,TAU),sp=rnd(2,6)*(0.6+size);
        shards.push({x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rnd(1,3),
          r:rnd(5,10)*(0.6+size*0.6),life:1,decay:rnd(0.01,0.018),
          col:i%2?"#5a2a14":"#8a4a2a",shape:"chunk",sides:rint(5,7),ang:rnd(0,TAU)});}
      for(let i=0;i<rint(2,4);i++){const a=rnd(0,TAU),sp=rnd(3,7)*(0.6+size);
        shards.push({x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rnd(1,3),
          r:rnd(3,6)*(0.6+size*0.6),life:1,decay:rnd(0.014,0.022),
          col:pick(BUB),shape:"sliver",ang:a});}
    }
    // bright crack sparks
    for(let i=0;i<rint(5,8);i++){const a=rnd(0,TAU),sp=rnd(4,10);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,len:rnd(8,18),life:1,decay:rnd(0.05,0.09)});}
    floats.push({x:hx,y:hy-R*0.6,txt:"+"+gain,life:1,vy:-1.1,
      col:gold?"#ffe14a":(size>0.6?"#ffe14a":"#fff0c0"),size:gold?40:(size>0.6?34:24)});
    if(gold){
      // golden fanfare + extra ring + brief hitStop (cooldown-guarded)
      floats.push({x:hx,y:hy-R*1.15,txt:"ゴールド!!",life:1,vy:-0.8,col:"#fff8c0",size:26});
      rings.push({x:hx,y:hy,r:R*0.3,vr:R*1.1,life:1,decay:0.045,col:"#ffe14a"});
      api.boom(0.5); api.shake(12);
      if(hitCd<=0){api.hitStop(5);hitCd=32;}
      api.tone(784,0.12,"triangle",0.16);
      setTimeout(()=>{api.tone(988,0.12,"triangle",0.16);},90);
      setTimeout(()=>{api.tone(1319,0.22,"triangle",0.18);},190);
      if(shards.length>150)shards.splice(0,shards.length-150);
    }
    // ① にじいろバブル 撃破: 虹の輪ぶわっ+ファンファーレ+大量得点(激レアのごほうび)
    if(rainbow){
      rbMsgT=1.4; rainbowSoonT=0;
      floats.push({x:hx,y:hy-R*1.15,txt:"にじいろ!!",life:1,vy:-0.8,col:"#fff",size:34});
      for(let k=0;k<RAINBOW.length;k++)
        rings.push({x:hx,y:hy,r:R*0.3,vr:R*(0.6+k*0.16),life:1,decay:0.045,col:RAINBOW[k]});
      api.boom(0.6); api.shake(15);
      if(hitCd<=0){api.hitStop(5);hitCd=34;}
      api.slide(660,1320,0.4,0.2,"triangle");
      api.tone(880,0.12,"triangle",0.14);
      setTimeout(()=>{api.tone(1320,0.16,"triangle",0.12);},110);
      if(shards.length>150)shards.splice(0,shards.length-150);
    }
    // ② ラッキー色 命中: 控えめな祝福+頭上に星のキラッ(気づけるヒント/白飛びさせない)
    if(isLucky){
      if(!luckySeen){luckyMsgT=1.9; luckySeen=true;}   // 初回だけ中央上で色名を教える
      floats.push({x:hx,y:hy-R*0.95,txt:"ラッキー!",life:1,vy:-0.9,col:c.gemCol,size:26});
      api.tone(1046,0.12,"triangle",0.12); api.tone(1568,0.14,"triangle",0.09);
      for(let i=0;i<5;i++)lstars.push({x:hx+rnd(-R*0.4,R*0.4),y:hy-R*0.4,
        vy:-rnd(0.8,1.8),vx:rnd(-0.6,0.6),life:1,r:rnd(4,7),rot:rnd(0,TAU),vr:rnd(-0.2,0.2),col:c.gemCol});
    }
    c.bub=0; c.growing=false; c.gold=false; c.rainbow=false; c.gemCol=null; c.pop=1; c.cd=rint(8,spawnInterval());  // 軸4補助: spawnIntervalを反映(旧: rint(18,72)固定)
    // big-hit climax wash
    if(combo>=3){api.tone(220,0.2,"sawtooth",0.07);}
    if(combo>0&&combo%8===0) nova();
    checkStage();
  }
  function fizzle(c){
    // bubble burst on its own (missed). gentle puff, combo resets, NO game over.
    const R=R0*(c.scale||1);
    const hx=c.x, hy=c.y-R*0.2;
    combo=0; comboT=0; stageFizzle++;   // ③ 自然に割れた=このステージのミスとして記録
    api.noise(0.16,0.18,360,"lowpass",0.9); api.slide(200,90,0.16,0.14,"sine"); api.shake(4);
    rings.push({x:hx,y:hy,r:R*0.3,vr:R*0.45,life:1,decay:0.05,col:"#7a3a1a"});
    for(let i=0;i<8;i++){const a=rnd(0,TAU),sp=rnd(1.5,4);
      shards.push({x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,r:rnd(3,6),
        life:1,decay:rnd(0.02,0.03),col:i%2?"#8a4a2a":"#5a2a14"});}
    c.bub=0; c.growing=false; c.gold=false; c.rainbow=false; c.gemCol=null; c.pop=0.6; c.cd=rint(24,80);
  }
  function nova(){
    novaT=1; flash=1; flashHue="#ffd23f"; api.boom(0.7); api.shake(16); api.hitStop(6);
    api.slide(700,120,0.4,0.3,"sawtooth"); api.tone(120,0.4,"sawtooth",0.12);
    for(const c of craters){
      if(c.growing&&c.bub>0.15) burst(c,true);
    }
  }
  function checkStage(){
    if(stagePop<stageGoal||clearT>0||endingT>0||bossActive||bossWarnT>0||bossDefeatT>0) return;
    // boss stages: goal met -> ominous warning -> giant boss bubble, THEN the stage clears
    if(BOSS_HP[stage]&&!bossDone){ startBossWarn(); return; }
    finishStage();
  }
  function startBossWarn(){
    bossWarnT=1.5; bossX=api.W/2; bossY=api.H*0.45;
    api.shake(10); api.slide(90,45,0.9,0.28,"sawtooth"); api.noise(0.6,0.24,320,"lowpass",0.7);
    for(const c of craters){c.growing=false;c.bub=0;c.pop=0;c.gold=false;c.cd=9999;}
  }
  function spawnBoss(){
    bossActive=true; bossMaxHp=BOSS_HP[stage]||6; bossHp=bossMaxHp; bossSquish=1;
    flash=1; flashHue="#ff5b3a"; api.boom(0.7); api.shake(20);
    api.slide(60,180,0.5,0.35,"sawtooth");
    const bR=bossRadius();
    for(let i=0;i<20;i++){const a=rnd(0,TAU),sp=rnd(3,9);
      shards.push({x:bossX,y:bossY,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,r:rnd(4,9),
        life:1,decay:rnd(0.012,0.02),col:pick(BUB)});}
    rings.push({x:bossX,y:bossY,r:bR*0.3,vr:bR,life:1,decay:0.05,col:"#ff8a3a"});
  }
  function bossHit(x,y){
    bossHp--; bossSquish=1; bossHitT=1;
    count+=2; api.setScore(count);
    combo++; comboT=1; flash=Math.min(1,flash+0.3); flashHue="#ff8a3a";
    api.noise(0.25,0.3,900,"lowpass",0.8);
    api.slide(200+(bossMaxHp-bossHp)*40,80,0.2,0.3,"square");
    api.shake(8);
    rings.push({x,y,r:20,vr:R0*0.8,life:1,decay:0.06,col:"#ffb347"});
    for(let i=0;i<10;i++){const a=rnd(0,TAU),sp=rnd(3,8);
      shards.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,r:rnd(4,8),
        life:1,decay:rnd(0.015,0.025),col:pick(BUB)});}
    floats.push({x,y:y-30,txt:"+2",life:1,vy:-1.1,col:"#ffd23f",size:26});
    if(bossHp<=0) bossDefeat();
  }
  function bossDefeat(){
    bossActive=false; bossDone=true; bossDefeatT=1.8;
    count+=10; api.setScore(count);
    flash=1; flashHue="#ffe14a"; novaT=0.8;
    api.boom(0.85); api.shake(26);
    if(hitCd<=0){api.hitStop(6);hitCd=36;}
    api.slide(523,1046,0.5,0.3,"triangle");
    setTimeout(()=>{api.tone(784,0.18,"triangle",0.3);},130);
    setTimeout(()=>{api.tone(1046,0.3,"triangle",0.3);},300);
    const bR=bossRadius();
    for(let i=0;i<34;i++){const a=rnd(0,TAU),sp=rnd(3,11);
      shards.push({x:bossX,y:bossY,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rnd(1,4),
        r:rnd(4,10),life:1,decay:rnd(0.008,0.016),col:RAINBOW[i%RAINBOW.length]});}
    rings.push({x:bossX,y:bossY,r:bR*0.4,vr:bR*0.9,life:1,decay:0.04,col:"#ffe14a"});
    rings.push({x:bossX,y:bossY,r:bR*0.2,vr:bR*0.7,life:1,decay:0.05,col:"#fff"});
    floats.push({x:bossX,y:bossY-bR*0.4,txt:"+10",life:1,vy:-0.9,col:"#ffe14a",size:44});
    if(shards.length>150)shards.splice(0,shards.length-150);
  }
  function finishStage(){
    // ③ ノーミス ボーナス: このステージで1個も自然に割らせなかったら +3 & みどりの星シャワー
    if(stageFizzle===0){
      count+=3; api.setScore(count); noMissT=1.9;
      api.tone(1318,0.16,"triangle",0.12); api.tone(1976,0.18,"triangle",0.08);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),sp=rnd(3,8);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2.5,
          r:rnd(4,8),life:1,decay:rnd(0.012,0.02),col:"#7be08a"});}
    }
    stageFizzle=0;
    if(stage>=STAGES){
      endingT=2.4; flash=1; flashHue="#ffd23f"; api.boom(0.7); api.shake(18);
      api.slide(523,1046,0.5,0.22,"triangle");
    }else{
      clearStage=stage; clearT=1.6; flash=0.7; api.boom(0.5); api.shake(12);
      api.slide(523,784,0.3,0.2,"triangle"); api.tone(660,0.25,"triangle",0.14);
      api.tone(988,0.3,"triangle",0.1);
      for(let i=0;i<22;i++){const a=rnd(0,TAU),sp=rnd(3,9);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,
          r:rnd(4,9),life:1,decay:rnd(0.012,0.02),col:pick(BUB)});}
      stage++; stageGoal=stageGoalFor(stage); stagePop=0; bossDone=false;
      if(stage===3) stage3BoostT=10;   // 軸4(補助): ボス予告直後にご褒美を少し出やすく
      for(const c of craters){c.grow=growRate();}
      buildAmbient();
    }
  }
  return{
    resize:layout,
    input(x,y,type){
      if(type!=="down"||clearT>0||endingT>0||bossWarnT>0||bossDefeatT>0) return;
      // boss phase: whack the giant bubble (generous hit circle)
      if(bossActive&&Math.hypot(x-bossX,y-bossY)<bossRadius()*1.4){ bossHit(x,y); return; }
      // pop the bubble whose grown circle is under the finger; prefer biggest
      let best=null,bestSize=-1;
      for(const c of craters){
        if(!c.growing||c.bub<=0.06) continue;
        const R=R0*(c.scale||1);   // 軸7: 大きいクレーターは当たり判定も一回り大きく
        const by=c.y-R*0.2-c.bub*R*0.5;
        const br=R*(0.35+c.bub*0.85);
        if(Math.hypot(x-c.x,y-by)<br+R*0.2){
          if(c.bub>bestSize){best=c;bestSize=c.bub;}
        }
      }
      if(best){ burst(best,false); return; }
      // ④ ひみつの ほし: バブルに当たらなかったタップが上空の星に届いたら キラッ+金コイン(減点なし)
      if(sunPos.r>0 && Math.hypot(x-sunPos.x,y-sunPos.y)<sunPos.r){
        sunWink=1; api.tone(1568,0.1,"triangle",0.09); api.tone(2093,0.13,"triangle",0.07);
        for(let i=0;i<7;i++)lstars.push({x:sunPos.x+rnd(-8,8),y:sunPos.y+rnd(-8,8),
          vy:rnd(0.3,1.6),vx:rnd(-1.2,1.2),life:1,r:rnd(4,7),rot:rnd(0,TAU),vr:rnd(-0.25,0.25),
          col:pick(["#ffe14a","#fff0a6","#ffd23f"])});
        return;
      }
      // missed tap: tiny ember puff feedback
      api.tone(180,0.05,"sine",0.08);
      for(let i=0;i<5;i++){const a=rnd(0,TAU),sp=rnd(1.5,4);
        sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,len:rnd(5,10),life:1,decay:rnd(0.06,0.1)});}
    },
    frame(dt,now){
      tsec+=0.016*dt;
      if(hitCd>0)hitCd-=dt;
      if(stage3BoostT>0)stage3BoostT=Math.max(0,stage3BoostT-0.016*dt);
      if(bossSquish>0)bossSquish=Math.max(0,bossSquish-0.08*dt);
      if(bossHitT>0)bossHitT=Math.max(0,bossHitT-0.05*dt);
      // 軸3(補助): ステージクリアのバナー(clearT)中も裏でバブル成長は止めない(入力は引き続き無効のまま)。
      // stageGoalFor短縮で転換が増えた分、バナーの間だけ足止めされて無反応時間が延びるのを防ぐ。
      const paused=endingT>0;
      // ---- background: 画像(火山の闘技場)があればそれ。無ければ従来の手描きグラデ ----
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: 後半ステージほど空を少し赤く染めて「熱くなってきた」感を出す(薄く)
        if(stage>=3){g.save();g.globalAlpha=0.06*(stage-2);g.fillStyle="#ff3a1a";g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        // volcanic sky gradient (deep sunset -> lava glow at base)
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,"#2a0a18");
        grd.addColorStop(0.32,"#5e1422");
        grd.addColorStop(0.6,"#9e3a1a");
        grd.addColorStop(0.82,"#d4581a");
        grd.addColorStop(1,"#ffae3a");
        g.fillStyle=grd; g.fillRect(0,0,api.W,api.H);
        // hazy sun low on the horizon
        const sunx=api.W*0.5,suny=api.H*0.92;
        let sun=g.createRadialGradient(sunx,suny,0,sunx,suny,api.W*0.7);
        sun.addColorStop(0,"rgba(255,230,150,.5)");sun.addColorStop(0.4,"rgba(255,150,60,.2)");sun.addColorStop(1,"rgba(255,150,60,0)");
        g.fillStyle=sun; g.fillRect(0,0,api.W,api.H);
      }
      // ④ ひみつの ほし: 上空でチカチカ光る星(タップでキラッと回る=発見のごほうび)
      {
        const twk=0.55+0.45*Math.sin(tsec*3.2), sr=sunPos.r*0.42, spin=tsec*0.6+(1-sunWink)*6;
        g.save(); g.globalCompositeOperation="lighter";
        const sh=g.createRadialGradient(sunPos.x,sunPos.y,0,sunPos.x,sunPos.y,Math.max(0,sr*2.6));
        sh.addColorStop(0,"rgba(255,240,170,"+(0.28+0.22*twk+sunWink*0.35)+")"); sh.addColorStop(1,"rgba(255,240,170,0)");
        g.fillStyle=sh; g.beginPath(); g.arc(sunPos.x,sunPos.y,Math.max(0,sr*2.6),0,TAU); g.fill();
        g.restore(); g.globalCompositeOperation="source-over";
        g.save(); g.translate(sunPos.x,sunPos.y);
        g.shadowColor="rgba(255,220,120,.8)"; g.shadowBlur=10; g.fillStyle="#fff3b0";
        drawStar(0,0,sr*(1+sunWink*0.45),spin); g.fill();
        g.shadowBlur=0; g.fillStyle="rgba(255,255,255,.9)";
        drawStar(0,0,sr*0.5*(1+sunWink*0.45),spin); g.fill();
        g.restore();
        if(sunWink>0){sunWink-=0.02*dt; if(sunWink<0)sunWink=0;}
      }
      // distant smoke puffs drifting up ※画像背景のときは絵の煙を活かして描かない
      g.save(); g.fillStyle="#3a1a16";
      if(!imgBg) for(const s of smokes){
        s.x+=s.sp*dt; s.y-=s.sp*0.18*dt;
        if(s.x>api.W+90*s.s) s.x=-90*s.s;
        if(s.y<-80) s.y=api.H*rnd(0.2,0.35);
        g.globalAlpha=s.a; const w=70*s.s;
        g.beginPath();
        g.ellipse(s.x,s.y,w,w*0.5,0,0,TAU);
        g.ellipse(s.x+w*0.7,s.y+w*0.1,w*0.6,w*0.4,0,0,TAU);
        g.ellipse(s.x-w*0.7,s.y+w*0.12,w*0.55,w*0.36,0,0,TAU);
        g.fill();
      }
      g.restore(); g.globalAlpha=1;
      // volcano silhouettes along the base ※画像背景のときは絵の火山と喧嘩するので描かない
      g.fillStyle="#2a0e12";
      const vc=imgBg?0:3;
      for(let i=0;i<vc;i++){
        const vx=api.W*((i+0.5)/vc), base=api.H*0.82, vw=api.W*0.36, vh=api.H*0.26;
        g.beginPath();
        g.moveTo(vx-vw/2,api.H);
        g.lineTo(vx-vw*0.14,base-vh);
        g.lineTo(vx+vw*0.14,base-vh);
        g.lineTo(vx+vw/2,api.H);
        g.closePath(); g.fill();
        // glowing crater lip
        g.save(); g.globalCompositeOperation="lighter";
        const lg=g.createLinearGradient(vx,base-vh,vx,base-vh+R0*0.6);
        lg.addColorStop(0,"rgba(255,180,60,.7)");lg.addColorStop(1,"rgba(255,120,40,0)");
        g.fillStyle=lg; g.fillRect(vx-vw*0.14,base-vh,vw*0.28,R0*0.6); g.restore();
      }
      // heat shimmer columns (cheap wavy translucent bands, additive)
      g.save(); g.globalCompositeOperation="lighter";
      for(const h of heat){
        h.ph+=h.sp*dt;
        const a=0.04+0.03*Math.sin(h.ph);
        g.globalAlpha=a;
        g.fillStyle="#ffcaa0";
        const xx=h.x+Math.sin(h.ph)*8;
        g.fillRect(xx-h.w/2,api.H*0.5,h.w,api.H*0.5);
      }
      g.restore(); g.globalAlpha=1;
      // rising embers
      g.save(); g.globalCompositeOperation="lighter";
      for(const e of embers){
        e.y-=e.sp*dt; e.sway+=e.sv*dt; e.x+=Math.sin(e.sway)*0.4*dt;
        if(e.y<-6){e.y=api.H+6;e.x=rnd(0,api.W);}
        const tw=0.5+0.5*Math.sin(e.sway*2);
        g.globalAlpha=0.4+0.5*tw; g.fillStyle=e.col;
        g.shadowBlur=6; g.shadowColor=e.col;
        g.beginPath(); g.arc(e.x,e.y,e.r,0,TAU); g.fill();
      }
      g.shadowBlur=0; g.restore(); g.globalAlpha=1;
      // ---- craters: update + draw ----
      // 軸1補助: 開始3秒だけ育つ速さを半分にして、最初の成功までの時間のブレを縮める
      const growGrace=tsec<3?0.5:1;
      for(const c of craters){
        const cR=R0*(c.scale||1);   // 軸7: 大きいクレーターは演出も一回り大きく
        c.wob+=0.06*dt; c.gloop+=0.04*dt;
        if(c.pop>0) c.pop-=0.06*dt;
        if(!paused){
          if(!c.growing){
            c.cd-=dt;
            if(c.cd<=0){c.growing=true;c.bub=0.04;
              c.gold=Math.random()<goldChance(); c.rainbow=false; c.gemCol=null; c.gemName="";
              // rare golden bubble: chime + gold ring so it catches the eye instantly
              if(c.gold){
                api.tone(1568,0.1,"triangle",0.09); api.tone(2093,0.14,"triangle",0.07);
                rings.push({x:c.x,y:c.y-cR*0.2,r:cR*0.2,vr:cR*0.5,life:1,decay:0.06,col:"#ffe14a"});
              }
              // ① にじいろバブル: 予告(よかん)が出ていたら次の1個がにじいろで確定=ドキドキの答え合わせ
              else if(rainbowQueued){
                c.rainbow=true; rainbowQueued=false;
                api.tone(1319,0.1,"triangle",0.08); api.tone(1760,0.12,"triangle",0.07);
                for(let k=0;k<RAINBOW.length;k++)
                  rings.push({x:c.x,y:c.y-cR*0.2,r:cR*0.18,vr:cR*(0.45+k*0.12),life:1,decay:0.06,col:RAINBOW[k]});
              }
              // ときどき「にじいろの よかん…」を先に出す(=次の1個が激レア)。stage2以降だけ。
              else if(stage>=2 && Math.random()<0.03){
                rainbowQueued=true; rainbowSoonT=1.5;
                api.tone(660,0.14,"sine",0.07); api.tone(990,0.16,"sine",0.05);
              }
              // ② ラッキー色: 一部のバブルに宝石コア(5色)を仕込む。ラッキー色を割ると隠しボーナス。
              else if(Math.random()<0.34){
                const gm=pick(GEM); c.gemCol=gm.c; c.gemName=gm.n;
              }}
          }else{
            c.bub+=c.grow*dt*60*0.5*growGrace;
            if(c.bub>=1){ fizzle(c); }
          }
        }
        drawCrater(c);
      }
      // ---- boss (giant magma bubble, above craters / below fx) ----
      if(bossActive) drawBoss();
      // ---- shards (lava blobs, gravity + fade) ----
      for(const s of shards){
        s.vy+=0.4*dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=s.decay*dt;
        g.save(); g.globalAlpha=Math.max(0,s.life);
        g.shadowBlur=8; g.shadowColor=s.col; g.fillStyle=s.col;
        if(s.shape==="chunk"){
          // 角ばった岩片(多角形)。「壊れ方の違い」演出(軸7)
          const rr=Math.max(0,s.r*(0.5+s.life*0.5)), n=s.sides||5;
          g.save(); g.translate(s.x,s.y); g.rotate((s.ang||0)+s.life*2);
          g.beginPath();
          for(let i=0;i<n;i++){const a=i/n*TAU,rad=rr*(i%2?0.7:1);
            const px=Math.cos(a)*rad,py=Math.sin(a)*rad;
            if(i===0)g.moveTo(px,py); else g.lineTo(px,py);}
          g.closePath(); g.fill(); g.restore();
        }else if(s.shape==="sliver"){
          // 細長い破片。「壊れ方の違い」演出(軸7)
          const len=Math.max(0,s.r*(1.6+s.life*0.8)), w=Math.max(0,s.r*0.35);
          g.save(); g.translate(s.x,s.y); g.rotate(s.ang||0);
          g.beginPath(); g.ellipse(0,0,len,w,0,0,TAU); g.fill(); g.restore();
        }else{
          g.beginPath(); g.arc(s.x,s.y,Math.max(0,s.r*(0.5+s.life*0.5)),0,TAU); g.fill();
        }
        g.restore();
      }
      g.shadowBlur=0; g.globalAlpha=1; shards=shards.filter(s=>s.life>0);
      // ---- shockwave rings ----
      for(const ri of rings){ ri.r+=ri.vr*dt; ri.life-=ri.decay*dt;
        g.save(); g.globalAlpha=Math.max(0,ri.life)*0.7; g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3; g.beginPath(); g.arc(ri.x,ri.y,ri.r,0,TAU); g.stroke(); g.restore();}
      rings=rings.filter(ri=>ri.life>0);
      // ---- glint sparks (additive lines) ----
      g.save(); g.globalCompositeOperation="lighter"; g.lineCap="round";
      for(const sp of sparks){ sp.x+=sp.vx*dt; sp.y+=sp.vy*dt; sp.vx*=0.9; sp.vy*=0.9; sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life); g.strokeStyle="#fff0a6"; g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath(); g.moveTo(sp.x,sp.y); g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len); g.stroke();}
      g.restore(); g.globalAlpha=1; sparks=sparks.filter(sp=>sp.life>0);
      // ---- ② ラッキー命中 / ④ ほしタップ の 星キラッ (additive, 短命) ----
      g.save(); g.globalCompositeOperation="lighter";
      for(const ls of lstars){ ls.x+=ls.vx*dt; ls.y+=ls.vy*dt; ls.vy+=0.05*dt; ls.rot+=ls.vr*dt; ls.life-=0.03*dt;
        g.globalAlpha=Math.max(0,ls.life); g.fillStyle=ls.col;
        drawStar(ls.x,ls.y,Math.max(0,ls.r*(0.5+ls.life*0.6)),ls.rot); g.fill();}
      g.restore(); g.globalCompositeOperation="source-over"; g.globalAlpha=1;
      lstars=lstars.filter(ls=>ls.life>0);
      // ---- floating score popups ----
      for(const f of floats){ f.y+=f.vy*dt; f.life-=0.02*dt;
        g.save(); g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.lineWidth=5; g.strokeStyle="rgba(60,20,0,.6)"; g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col; g.fillText(f.txt,f.x,f.y); g.restore();}
      g.globalAlpha=1; g.textAlign="left"; floats=floats.filter(f=>f.life>0);
      // ---- combo timer + text (top-center safe zone) ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save(); g.translate(api.W/2,api.H*0.16); g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(255,140,40,.8)"; g.shadowBlur=14;
        g.fillStyle="#ffd23f"; g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(255,255,255,.6)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
      }
      // ---- ① にじいろの よかん…(接近予告 / top-center安全帯) ----
      if(rainbowSoonT>0){ rainbowSoonT-=0.016*dt;
        const col=RAINBOW[Math.floor(tsec*5)%RAINBOW.length];
        g.save(); g.translate(api.W/2,api.H*0.24); g.textAlign="center";
        g.globalAlpha=clamp(rainbowSoonT,0,1)*0.9; g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col; g.shadowBlur=12; g.fillStyle="#fff"; g.fillText("にじいろの よかん…?",0,0);
        g.restore(); g.shadowBlur=0; g.globalAlpha=1; g.textAlign="left"; if(rainbowSoonT<0)rainbowSoonT=0;}
      // ---- ① にじいろ! 発見バナー ----
      if(rbMsgT>0){ rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.4, col=RAINBOW[Math.floor(tsec*7)%RAINBOW.length];
        g.save(); g.translate(api.W/2,api.H*0.22); g.scale(pop,pop); g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1); g.font="900 36px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col; g.shadowBlur=18; g.fillStyle="#fff"; g.fillText("にじいろ!",0,0);
        g.shadowBlur=0; g.lineWidth=2; g.strokeStyle=col; g.strokeText("にじいろ!",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(rbMsgT<0)rbMsgT=0;}
      // ---- ② きょうのラッキー色 ヒント(初回だけ色名を大きく教える) ----
      if(luckyMsgT>0){ luckyMsgT-=0.016*dt;
        const pop=1+Math.max(0,luckyMsgT-1.2)*1.2;
        g.save(); g.translate(api.W/2,api.H*0.29); g.scale(pop,pop); g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.4,0,1); g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=luckyGem.c; g.shadowBlur=14; g.fillStyle=luckyGem.c;
        g.fillText("きょうの ラッキーは "+luckyGem.n+"!",0,0);
        g.restore(); g.shadowBlur=0; g.globalAlpha=1; g.textAlign="left"; if(luckyMsgT<0)luckyMsgT=0;}
      // ---- ③ ノーミス ボーナス! バナー(下側=クリア文字と重ねない) ----
      if(noMissT>0){ noMissT-=0.014*dt;
        const pop=1+Math.max(0,noMissT-1.3)*1.4;
        g.save(); g.translate(api.W/2,api.H*0.62); g.scale(pop,pop); g.textAlign="center";
        g.globalAlpha=clamp(noMissT*1.3,0,1); g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)"; g.shadowBlur=16; g.fillStyle="#c7ffcf";
        g.fillText("ノーミス ボーナス!",0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(40,120,60,.7)"; g.strokeText("ノーミス ボーナス!",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(noMissT<0)noMissT=0;}
      // ---- impact flash (color bloom) ----
      if(flash>0){ flash-=0.06*dt; const fa=Math.max(0,flash);
        g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=fa*0.3;
        g.fillStyle=flashHue; g.fillRect(0,0,api.W,api.H);
        g.globalAlpha=fa*0.16; g.fillStyle="#fff"; g.fillRect(0,0,api.W,api.H);
        g.restore(); g.globalAlpha=1;}
      // ---- nova white flash ----
      if(novaT>0){ g.save(); g.globalAlpha=novaT*0.5; g.fillStyle="#fff";
        g.fillRect(0,0,api.W,api.H); g.restore(); novaT-=0.06*dt; if(novaT<0)novaT=0;}
      // ---- boss warning: rumble + darkening + growing shadow ----
      if(bossWarnT>0){
        bossWarnT-=0.016*dt;
        if(Math.random()<0.25)api.shake(3);
        const p=1-clamp(bossWarnT/1.5,0,1);
        g.save(); g.globalAlpha=0.28+0.1*Math.sin(tsec*12); g.fillStyle="#1a0400";
        g.fillRect(0,0,api.W,api.H); g.restore();
        const bR=bossRadius();
        g.save(); g.globalAlpha=0.5*p; g.fillStyle="#000";
        g.beginPath(); g.ellipse(bossX,bossY+bR,bR*1.1*p,bR*0.3*p,0,0,TAU); g.fill(); g.restore();
        const jx=rnd(-4,4),jy=rnd(-3,3);
        g.save(); g.translate(api.W/2+jx,api.H*0.36+jy); g.textAlign="center";
        g.font="900 42px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,60,20,.9)"; g.shadowBlur=18; g.fillStyle="#ff5b3a";
        g.fillText("ゴゴゴゴ…",0,0);
        g.shadowBlur=0; g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#fff";
        g.fillText("なにか くるぞ…!",0,40);
        g.restore(); g.textAlign="left"; g.globalAlpha=1;
        if(bossWarnT<=0){bossWarnT=0;spawnBoss();}
      }
      // ---- boss defeated: big celebration, then stage clear ----
      if(bossDefeatT>0){
        bossDefeatT-=0.016*dt;
        const a=clamp(bossDefeatT*1.2,0,1),pop=1+Math.max(0,bossDefeatT-1.4)*2;
        g.save(); g.translate(api.W/2,api.H*0.42); g.scale(pop,pop); g.globalAlpha=a;
        g.textAlign="center"; g.font="900 48px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,220,80,1)"; g.shadowBlur=22; g.fillStyle="#ffe14a";
        g.fillText("ボスを たおした!!",0,0);
        g.shadowBlur=0; g.lineWidth=2; g.strokeStyle="#fff"; g.strokeText("ボスを たおした!!",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
        if(bossDefeatT<=0){bossDefeatT=0;
          for(const c of craters){c.cd=rint(10,spawnInterval()+10);}  // 軸4補助: spawnIntervalを反映(旧: rint(20,90)固定)
          finishStage();}
      }
      // ---- HUD: stage + progress gauge (top-center) ----
      drawHUD();
      // ---- stage clear banner ----
      if(clearT>0){ clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save(); g.globalAlpha=a*0.5; g.fillStyle="#000"; g.fillRect(0,api.H*0.34,api.W,api.H*0.22); g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save(); g.translate(api.W/2,api.H*0.45); g.scale(pop,pop); g.globalAlpha=a;
        g.textAlign="center"; g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,170,40,.9)"; g.shadowBlur=20; g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア!",0,0);
        g.shadowBlur=0; g.lineWidth=2; g.strokeStyle="#fff"; g.strokeText("ステージ"+clearStage+" クリア!",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#fff";
        g.fillText(HINTS[clearStage+1]||("つぎは ステージ"+(clearStage+1)+"!"),0,42);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
        if(clearT<=0)clearT=0;
      }
      // ---- ぜんぶクリア! ending ----
      if(endingT>0){ endingT-=0.012*dt;
        const a=clamp(endingT,0,1);
        g.save(); g.globalAlpha=a*0.45; g.fillStyle="#1a0608"; g.fillRect(0,0,api.W,api.H); g.restore();
        if(tsec*60%1<dt) shards.push({x:rnd(0,api.W),y:-10,vx:rnd(-1,1),vy:rnd(2,5),
          r:rnd(4,9),life:1,decay:0.01,col:pick(BUB)});
        const pop=1+Math.sin(tsec*7)*0.06;
        g.save(); g.translate(api.W/2,api.H*0.42); g.scale(pop,pop); g.globalAlpha=a;
        g.textAlign="center"; g.font="900 56px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,210,60,1)"; g.shadowBlur=26; g.fillStyle="#ffd23f";
        g.fillText("ぜんぶ クリア!",0,0);
        g.shadowBlur=0; g.lineWidth=2.5; g.strokeStyle="#fff"; g.strokeText("ぜんぶ クリア!",0,0);
        g.font="800 26px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#fff";
        g.fillText("すごい! もういちど あそべるよ",0,50);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
        if(endingT<=0){endingT=0;stage=1;stageGoal=stageGoalFor(1);stagePop=0;combo=0;
          bossDone=false;bossActive=false;bossWarnT=0;bossDefeatT=0;bossHp=0;
          stageFizzle=0;rainbowQueued=false;rainbowSoonT=0;stage3BoostT=0;
          for(const c of craters){c.grow=growRate();c.bub=0;c.growing=false;c.gold=false;c.rainbow=false;c.gemCol=null;c.cd=rint(10,80);}
          buildAmbient();}
      }
      // 白飛び防止の総仕上げ: フレーム終端で加算合成を必ず標準に戻す(溜まり漏れゼロ)
      g.globalCompositeOperation="source-over"; g.globalAlpha=1;
    },
    stop(){}
  };
  function drawHUD(){
    const left=clamp(stageGoal-stagePop,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.045;
    const boss=bossActive||bossWarnT>0;
    const label=boss?(bossActive?"ボスを たたけ!!":"…なにか くる!")
      :"ステージ "+stage+" / "+STAGES+"      あと "+left+" こ";
    g.save(); g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle=boss?"#ffd23f":"#fff"; g.shadowColor="rgba(0,0,0,.5)"; g.shadowBlur=6;
    g.fillText(label,api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,0,0,.4)"; roundRect(bx,by,bw,bh,bh/2); g.fill();
    const fr=boss?(bossActive?bossHp/Math.max(1,bossMaxHp):1):clamp(stagePop/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      if(boss){gg.addColorStop(0,"#ff8a3a"); gg.addColorStop(1,"#ff2a3a");}
      else{gg.addColorStop(0,"#ffd23f"); gg.addColorStop(1,"#ff5b3a");}
      g.fillStyle=gg; roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2); g.fill();}
    g.strokeStyle="rgba(255,255,255,.5)"; g.lineWidth=2; roundRect(bx,by,bw,bh,bh/2); g.stroke();
    g.restore(); g.textAlign="left";
  }
  function drawBoss(){
    const bR=bossRadius()*(1+0.03*Math.sin(tsec*3));
    const sq=bossSquish,hurt=bossHitT>0.5;
    const x=bossX,y=bossY+sq*bR*0.06;
    // ground shadow
    g.fillStyle="rgba(0,0,0,.35)"; g.beginPath();
    g.ellipse(x,bossY+bR*1.05,bR*1.1,bR*0.3,0,0,TAU); g.fill();
    // heat halo
    g.save(); g.globalCompositeOperation="lighter";
    const halo=g.createRadialGradient(x,y,bR*0.3,x,y,bR*2);
    halo.addColorStop(0,"rgba(255,120,40,.45)"); halo.addColorStop(1,"rgba(255,80,30,0)");
    g.fillStyle=halo; g.beginPath(); g.arc(x,y,bR*2,0,TAU); g.fill(); g.restore();
    g.save(); g.translate(x,y); g.scale(1+sq*0.16,1-sq*0.2);
    const dmg=1-bossHp/Math.max(1,bossMaxHp);
    // boss.png は生成2回とも足/台座の影が抜けきらず不採用→従来の手描きマグマ玉のみを使う
    const bg=g.createRadialGradient(-bR*0.3,-bR*0.35,bR*0.1,0,0,bR*1.1);
    bg.addColorStop(0,"#ffe6a0"); bg.addColorStop(0.35,"#ff9a2a");
    bg.addColorStop(0.7,"#e03a10"); bg.addColorStop(1,"#701205");
    g.fillStyle=bg; g.beginPath();
    g.ellipse(0,0,bR,bR*(0.97+0.05*Math.sin(tsec*5)),0,0,TAU); g.fill();
    // damage cracks appear as hp drops
    if(dmg>0.3){g.strokeStyle="rgba(40,8,0,.7)"; g.lineWidth=Math.max(3,bR*0.05); g.lineCap="round";
      g.beginPath(); g.moveTo(-bR*0.5,-bR*0.3); g.lineTo(-bR*0.25,0); g.lineTo(-bR*0.4,bR*0.35); g.stroke();
      if(dmg>0.6){g.beginPath(); g.moveTo(bR*0.45,-bR*0.4); g.lineTo(bR*0.25,-bR*0.05); g.lineTo(bR*0.5,bR*0.3); g.stroke();}}
    // rim light
    g.strokeStyle="rgba(255,200,120,.5)"; g.lineWidth=4; g.beginPath(); g.arc(0,0,bR,0,TAU); g.stroke();
    // angry face (ouch face while being whacked)
    const er=bR*0.13;
    g.strokeStyle="#2a0a04"; g.lineWidth=Math.max(3,bR*0.07); g.lineCap="round";
    g.beginPath(); g.moveTo(-bR*0.45,-bR*0.38); g.lineTo(-bR*0.15,-bR*0.24); g.stroke();
    g.beginPath(); g.moveTo(bR*0.45,-bR*0.38); g.lineTo(bR*0.15,-bR*0.24); g.stroke();
    if(hurt){
      g.beginPath(); g.moveTo(-bR*0.38,-bR*0.16); g.lineTo(-bR*0.2,-bR*0.08); g.lineTo(-bR*0.38,0); g.stroke();
      g.beginPath(); g.moveTo(bR*0.38,-bR*0.16); g.lineTo(bR*0.2,-bR*0.08); g.lineTo(bR*0.38,0); g.stroke();
      g.fillStyle="#3a0c04"; g.beginPath(); g.ellipse(0,bR*0.3,bR*0.22,bR*0.26,0,0,TAU); g.fill();
    }else{
      g.fillStyle="#2a0a04";
      g.beginPath(); g.arc(-bR*0.28,-bR*0.08,er,0,TAU); g.arc(bR*0.28,-bR*0.08,er,0,TAU); g.fill();
      g.fillStyle="rgba(255,255,255,.9)";
      g.beginPath(); g.arc(-bR*0.32,-bR*0.12,er*0.35,0,TAU); g.arc(bR*0.24,-bR*0.12,er*0.35,0,TAU); g.fill();
      g.strokeStyle="#2a0a04"; g.beginPath(); g.moveTo(-bR*0.3,bR*0.32);
      g.lineTo(-bR*0.15,bR*0.24); g.lineTo(0,bR*0.32); g.lineTo(bR*0.15,bR*0.24); g.lineTo(bR*0.3,bR*0.32); g.stroke();
    }
    g.restore();
    drawBossPips(x,y,bR);
  }
  function drawBossPips(x,y,bR){
    // hp pips above the boss (画像/手描き共通)
    const n=bossMaxHp,pw=Math.min(18,(bR*2)/Math.max(1,n));
    for(let i=0;i<n;i++){const px=x-(n-1)*pw/2+i*pw,py=y-bR-24;
      g.globalAlpha=0.9; g.fillStyle=i<bossHp?"#ff5b3a":"rgba(0,0,0,.35)";
      g.beginPath(); g.arc(px,py,Math.max(0,pw*0.32),0,TAU); g.fill();
      g.strokeStyle="rgba(255,255,255,.6)"; g.lineWidth=1.5; g.stroke();}
    g.globalAlpha=1;
  }
  function drawCrater(c){
    const x=c.x,y=c.y;
    const R=R0*(c.scale||1);   // 軸7: 大小のクレーター/バブルを混在させる
    // crater bowl: dark rocky ring with glowing molten floor
    g.save();
    // 画像クレーター: 岩のリング+溶岩の池のスプライト(横長に潰して穴に合わせる)。溶岩の脈動だけ薄く重ねる
    const imgCrater=api.drawAsset("crater.png",x,y+R*0.4,R*2.6,R*1.6,{center:true});
    if(!imgCrater){
      // outer rock rim shadow
      g.fillStyle="rgba(0,0,0,.4)"; g.beginPath();
      g.ellipse(x,y+R*0.5,R*1.15,R*0.55,0,0,TAU); g.fill();
      // rocky rim
      const rim=g.createRadialGradient(x-R*0.3,y-R*0.2,R*0.2,x,y,R*1.2);
      rim.addColorStop(0,"#5a3526"); rim.addColorStop(0.6,"#3a2018"); rim.addColorStop(1,"#1e0e0a");
      g.fillStyle=rim; g.beginPath();
      g.ellipse(x,y+R*0.42,R*1.05,R*0.55,0,0,TAU); g.fill();
    }
    // molten lava floor (glowing, gloop animated)
    g.save(); g.globalCompositeOperation="lighter";
    if(imgCrater) g.globalAlpha=0.45;
    const lavaR=R*0.7*(0.95+0.05*Math.sin(c.gloop));
    const lava=g.createRadialGradient(x,y+R*0.3,0,x,y+R*0.3,lavaR);
    lava.addColorStop(0,"#fff0a6"); lava.addColorStop(0.4,"#ff8a3a");
    lava.addColorStop(0.8,"#d4401a"); lava.addColorStop(1,"rgba(180,40,10,0)");
    g.fillStyle=lava; g.beginPath();
    g.ellipse(x,y+R*0.32,lavaR,lavaR*0.5,0,0,TAU); g.fill();
    g.restore();
    g.restore();
    // the magma bubble (only if growing)
    if(c.growing&&c.bub>0.02){
      const s=c.bub;
      const wob=Math.sin(c.wob)*R*0.04*s;
      const br=R*(0.32+s*0.88);
      const by=y-R*0.2-s*R*0.5;
      // warning glow when near bursting
      const danger=s>0.78;
      g.save();
      // outer heat halo
      g.globalCompositeOperation="lighter";
      const halo=g.createRadialGradient(x,by,0,x,by,br*1.8);
      const hp=danger?(0.4+0.4*Math.sin(tsec*16)):((c.gold||c.rainbow)?0.4+0.15*Math.sin(tsec*10):0.3);
      if(c.rainbow){
        halo.addColorStop(0,"rgba(255,255,255,"+hp+")");
        halo.addColorStop(0.5,"rgba(255,235,180,"+(hp*0.4)+")");
        halo.addColorStop(1,"rgba(255,235,180,0)");
      }else if(c.gold){
        halo.addColorStop(0,"rgba(255,235,140,"+hp+")");
        halo.addColorStop(0.5,"rgba(255,200,60,"+(hp*0.45)+")");
        halo.addColorStop(1,"rgba(255,200,60,0)");
      }else{
        halo.addColorStop(0,"rgba(255,180,80,"+hp+")");
        halo.addColorStop(0.5,"rgba(255,90,40,"+(hp*0.4)+")");
        halo.addColorStop(1,"rgba(255,90,40,0)");
      }
      g.fillStyle=halo; g.beginPath(); g.arc(x,by,br*1.8,0,TAU); g.fill();
      g.restore();
      g.save();
      g.translate(x+wob,by);
      // 軸7: c.aspectで縦長/横長を混在させる(丸一辺倒を崩す)。半径は常にMath.maxで非負クランプ。
      const bh=Math.max(0,br*(0.96+0.06*Math.sin(c.wob*1.3))*(c.aspect||1));
      // bubble.png は生成2回とも台座/背景が抜けきらず不採用→従来の手描きマグマ玉のみを使う
      let bimg=null;
      if(bimg){
        api.drawSrc(bimg,0,0,br*2.2,bh*2.2,{center:true});
      }else{
      // bubble body: molten orb with gradient
      const bg=g.createRadialGradient(-br*0.3,-br*0.4,br*0.1,0,0,br*1.1);
      if(c.rainbow){
        const rc=Math.floor(tsec*4)%RAINBOW.length;
        bg.addColorStop(0,"#ffffff"); bg.addColorStop(0.4,RAINBOW[rc]);
        bg.addColorStop(0.75,RAINBOW[(rc+2)%RAINBOW.length]); bg.addColorStop(1,RAINBOW[(rc+4)%RAINBOW.length]);
      }else if(c.gold){
        bg.addColorStop(0,"#fffbe0"); bg.addColorStop(0.35,"#ffe14a");
        bg.addColorStop(0.7,"#ffb020"); bg.addColorStop(1,"#b06a00");
      }else{
        bg.addColorStop(0,"#fff3c0");
        bg.addColorStop(0.35,danger?"#ffcf4a":"#ffb347");
        bg.addColorStop(0.7,"#ff5b2a");
        bg.addColorStop(1,"#c23010");
      }
      const isLump=c.shapeType==="lump"&&c.lumpPts;
      g.fillStyle=bg;
      if(isLump){ drawLump(0,0,br,bh,c.lumpPts,c.wob*0.25); g.fill(); }
      else{ g.beginPath(); g.ellipse(0,0,Math.max(0,br),bh,0,0,TAU); g.fill(); }
      // glossy highlight
      g.fillStyle="rgba(255,255,255,.5)";
      g.beginPath(); g.ellipse(-br*0.32,-br*0.4,br*0.26,br*0.16,-0.5,0,TAU); g.fill();
      }
      // rim light (② ラッキー色は宝石色のリムで色が分かる)
      g.strokeStyle=c.rainbow?"rgba(255,255,255,.8)":(c.gold?"rgba(255,245,200,.7)":(c.gemCol?c.gemCol:"rgba(255,220,150,.4)"));
      g.lineWidth=c.gemCol?2.6:2;
      // 軸7: リムも本体と同じ形に合わせる(丸バブルは楕円/角ばったlumpはポリゴンでズレを防ぐ)
      if(c.shapeType==="lump"&&c.lumpPts){ drawLump(0,0,br,bh,c.lumpPts,c.wob*0.25); g.stroke(); }
      else{ g.beginPath(); g.ellipse(0,0,Math.max(0,br),bh,0,0,TAU); g.stroke(); }
      // ② ラッキー色: 中の宝石コア(色がハッキリ分かる小さな発光。白飛びしないよう小さく)
      if(c.gemCol){
        const gcr=Math.max(0,br*0.24);
        g.save(); g.globalCompositeOperation="lighter";
        g.globalAlpha=0.5+0.25*Math.sin(tsec*6+c.gloop); g.fillStyle=c.gemCol;
        g.beginPath(); g.arc(0,br*0.5,Math.max(0,gcr*1.5),0,TAU); g.fill();
        g.restore(); g.globalAlpha=1;
        g.fillStyle=c.gemCol; g.beginPath(); g.arc(0,br*0.5,gcr,0,TAU); g.fill();
        g.fillStyle="rgba(255,255,255,.85)"; g.beginPath(); g.arc(-gcr*0.3,br*0.5-gcr*0.35,Math.max(0,gcr*0.4),0,TAU); g.fill();
      }
      // gold / にじいろ bubble: orbiting twinkle stars (additive)
      if(c.gold||c.rainbow){
        g.save(); g.globalCompositeOperation="lighter";
        for(let i=0;i<4;i++){
          const a=tsec*3+i*TAU/4;
          const sx2=Math.cos(a)*br*1.2, sy2=Math.sin(a)*br*0.95;
          const tw=0.5+0.5*Math.sin(tsec*8+i*2);
          const ss=br*0.14*(0.6+tw*0.6);
          g.globalAlpha=0.4+0.6*tw; g.fillStyle=c.rainbow?RAINBOW[(i+Math.floor(tsec*5))%RAINBOW.length]:"#fff8c0";
          g.beginPath();
          g.moveTo(sx2,sy2-ss); g.lineTo(sx2+ss*0.35,sy2-ss*0.35); g.lineTo(sx2+ss,sy2);
          g.lineTo(sx2+ss*0.35,sy2+ss*0.35); g.lineTo(sx2,sy2+ss); g.lineTo(sx2-ss*0.35,sy2+ss*0.35);
          g.lineTo(sx2-ss,sy2); g.lineTo(sx2-ss*0.35,sy2-ss*0.35); g.closePath(); g.fill();
        }
        g.restore(); g.globalAlpha=1;
      }
      // cute face on bigger bubbles (kawaii character)
      if(s>0.45){
        const er=br*0.16;
        if(danger){
          // worried squint when about to pop
          g.strokeStyle="#3a1208"; g.lineWidth=Math.max(2,br*0.07); g.lineCap="round";
          g.beginPath(); g.moveTo(-br*0.42,-br*0.18); g.lineTo(-br*0.14,-br*0.1); g.stroke();
          g.beginPath(); g.moveTo(br*0.42,-br*0.18); g.lineTo(br*0.14,-br*0.1); g.stroke();
          // open shout mouth
          g.fillStyle="#5a1408"; g.beginPath();
          g.ellipse(0,br*0.28,br*0.16,br*0.2,0,0,TAU); g.fill();
        }else{
          g.fillStyle="#3a1208";
          g.beginPath(); g.arc(-br*0.28,-br*0.12,er,0,TAU); g.arc(br*0.28,-br*0.12,er,0,TAU); g.fill();
          g.fillStyle="rgba(255,255,255,.9)";
          g.beginPath(); g.arc(-br*0.32,-br*0.16,er*0.4,0,TAU); g.arc(br*0.24,-br*0.16,er*0.4,0,TAU); g.fill();
          // smile
          g.strokeStyle="#3a1208"; g.lineWidth=Math.max(2,br*0.06); g.lineCap="round";
          g.beginPath(); g.arc(0,br*0.06,br*0.22,0.15*Math.PI,0.85*Math.PI); g.stroke();
        }
        // rosy cheeks
        g.fillStyle="rgba(255,120,80,.4)";
        g.beginPath(); g.arc(-br*0.46,br*0.06,br*0.12,0,TAU); g.arc(br*0.46,br*0.06,br*0.12,0,TAU); g.fill();
      }
      g.restore();
    }
    // pop after-glow ring on the crater
    if(c.pop>0){
      g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=c.pop*0.6;
      g.strokeStyle="#ffd23f"; g.lineWidth=3;
      g.beginPath(); g.ellipse(x,y+R*0.2,R*0.8,R*0.4,0,0,TAU); g.stroke();
      g.restore(); g.globalAlpha=1;
    }
  }
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  // 軸7: 角ばった溶岩の塊(lump)用ポリゴン。丸バブルとシルエットが違う破壊対象を作るための専用描画。
  // pts(半径倍率の配列)は生成時に固定してガタガタの輪郭を維持し、rot でゆっくり向きだけ揺らす。
  function drawLump(cx,cy,rx,ry,pts,rot){
    const n=pts.length; rx=Math.max(0,rx); ry=Math.max(0,ry);
    g.beginPath();
    for(let i=0;i<n;i++){
      const a=rot+i/n*TAU, rad=pts[i];
      const px=cx+Math.cos(a)*rx*rad, py=cy+Math.sin(a)*ry*rad;
      if(i===0) g.moveTo(px,py); else g.lineTo(px,py);
    }
    g.closePath();
  }
  // 5とがりの星(隠し発見の キラッ に共用)。半径は負にならないようクランプ。
  function drawStar(cx,cy,r,rot){
    r=Math.max(0,r); g.beginPath();
    for(let i=0;i<5;i++){
      const a1=rot+i*TAU/5-TAU/4, a2=a1+TAU/10;
      g.lineTo(cx+Math.cos(a1)*r, cy+Math.sin(a1)*r);
      g.lineTo(cx+Math.cos(a2)*r*0.44, cy+Math.sin(a2)*r*0.44);
    }
    g.closePath();
  }
}
Engine.register("crater", buildCrater);
