function buildRockfall(api){
  const g=api.g;
  api.preload(["bg.jpg","goldrock.png","boss.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。
  // rock.png はレビューで背景(地面/草)の残りが2回の再生成でも取れず不採用。ふつう/でか/にじいろは手描きのまま。
  let rocks=[],shards=[],sparks=[],rings=[],embers=[],heat=[],lavaBub=[];
  let groundY,R,spawnT=0,count=0,combo=0,comboT=0,tsec=0,flash=0,flashHue="#fff";
  // stage progression: break N rocks -> "ステージ クリア！" -> harder endless
  let stage=1,stageKill=0,stageGoal=8,clearT=0,clearStage=0;
  // boss / gold / preview state
  let boss=null,bossWarn=0,pendingBoss=false,floats=[],hsCool=0;
  let clearTitle="",clearMsg="";
  const ROCK_COLS=["#7a5a4a","#6e4f42","#8a6450","#5e4438"];
  const RAINBOW=["#ff5b5b","#ffd23f","#4db8ff","#7be08a","#ff7bd0","#b066ff"];
  // ---- 隠し発見レイヤー(ハンマー/トラックと同じ思想) ----
  const GEMS=["#ff5b5b","#4db8ff","#7be08a","#ffd23f","#ff7bd0"];   // ② 宝石いわの色
  const GEMNAME={"#ff5b5b":"あか","#4db8ff":"あお","#7be08a":"みどり","#ffd23f":"きいろ","#ff7bd0":"ピンク"};
  let luckyColor=pick(GEMS),luckyMsgT=0,luckyBigT=0,luckySeen=false; // ② きょうのラッキー色(秘密の宝石色)
  let rbMsgT=0,rbHintT=0;                                            // ① にじいろいわ 発見/予告
  let stageMiss=0,noMissT=0;                                         // ③ ノーミス(いわを ようがんに おとさない)
  let meteor=null,meteorT=rnd(300,600);                             // ④ ながれ星 ひみつ発見
  let initBurst=6;   // 軸3: 開始直後は画面上端からの落下待ちなしで最初から見えている位置に出す(4→6、最初のどれかに当たる確率を底上げ)
  let earlyBoost=5;  // 軸3: 開始直後だけ次の出現間隔を短くし、定常時の密度は上げすぎない
  // hitStop discipline: big-hit only + cooldown so freezes never chain
  function hstop(n){if(hsCool<=0){api.hitStop(n);hsCool=34;}}
  function stageGoalFor(s){return 10+(s-1)*3;}   // 10,13,16...（7〜8歳向けに手応えを少し増やした）
  function rockPts(){const n=rint(6,8),a=[];for(let i=0;i<n;i++){
    const ang=i/n*TAU+rnd(-0.22,0.22),rr=rnd(0.72,1.05);a.push([Math.cos(ang)*rr,Math.sin(ang)*rr]);}return a;}
  // ⑤ 軸7: 丸い溶岩玉(ほぼ真円の頂点列。ジッター極小)
  function roundPts(){const n=12,a=[];for(let i=0;i<n;i++){
    const ang=i/n*TAU+rnd(-0.05,0.05),rr=rnd(0.92,1.02);a.push([Math.cos(ang)*rr,Math.sin(ang)*rr]);}return a;}
  // ⑤ 軸7: 積み重ね岩(縦長・くびれ入りの頂点列で「段」があるように見せる)
  function stackPts(){
    const w=rnd(0.38,0.48),wa=rnd(0.26,0.34);
    return [[-w,-1.02],[w,-1.02],[w+0.06,-0.56],[wa,-0.5],
      [w+0.02,-0.1],[wa,-0.04],[w+0.05,0.36],[w,1.02],
      [-w,1.02],[-w-0.05,0.36],[-wa,-0.04],[-w-0.02,-0.1],
      [-wa,-0.5],[-w-0.06,-0.56]];
  }
  function layout(){
    groundY=api.H*0.9;
    R=clamp(Math.min(api.W,api.H)*0.06,26,52);
    // rebuild ambient bg props sized to screen
    embers=[];for(let i=0;i<26;i++)embers.push({x:rnd(0,api.W),y:rnd(0,api.H),
      vy:-rnd(0.3,1.1),r:rnd(1,3.4),tw:rnd(0,TAU),sp:rnd(0.05,0.14),col:pick(["#ffce5a","#ff8a3a","#ff5b3a"])});
    heat=[];for(let i=0;i<5;i++)heat.push({y:groundY-i*30-rnd(0,20),ph:rnd(0,TAU),amp:rnd(4,12)});
    lavaBub=[];for(let i=0;i<9;i++)lavaBub.push({x:rnd(0,api.W),t:rnd(0,1),sp:rnd(0.004,0.012),r:rnd(4,11)});
    if(boss){boss.ty=api.H*0.3;boss.size=R*2.3;}
  }
  layout();
  spawn();spawn();spawn();spawn();spawn();   // 軸3: 開始した瞬間から複数のいわが画面にある状態にする(6個目はframe内でspawnT=0により即時)
  function spawn(){
    // ① にじいろいわ: ステージ1以降、ときどき(約3%)だけ落ちてくる激レア。ゆっくり落ちて虹色に光る。
    const rainbow=!boss&&stage>=1&&Math.random()<0.03;
    // rare golden king rock: slower, sparkling, worth +5 with a fanfare
    const gold=!boss&&!rainbow&&Math.random()<0.07;
    // 軸3: 開始直後の初期いわ(initBurst分)は2発叩かないと壊れない「でか」を外す。
    // crack()は得点が入らないため、最初の的がでかだと firstScoreSec が跳ねて不安定になる実測に対応。
    const big=!gold&&!rainbow&&initBurst<=0&&Math.random()<clamp(0.08+stage*0.03,0.08,0.4);
    // ⑤ 軸7: ふつうサイズのいわの一部を「丸い溶岩玉」「積み重ね岩」の形に(見た目のバラエティ)
    const shape=(!gold&&!rainbow&&!big&&Math.random()<0.4)?(Math.random()<0.5?"round":"tower"):"normal";
    const sz=rainbow?R*1.2:gold?R*1.12:big?R*2.0:R*(0.85+Math.random()*0.4);
    const margin=Math.max(R*1.4,sz*0.75);
    // 軸3: 開始直後のいわは画面中央寄りに出す(低学年は最初 画面中央を連打しがちなので、その手が届く位置に的を置く)
    const x=initBurst>0?rnd(api.W*0.32,api.W*0.68):rnd(margin,api.W-margin);
    const fallV=clamp(1.7+stage*0.22,1.7,5.0)*(big?0.78:gold?0.68:rainbow?0.58:1);   // 落下速度 約2割増
    // ② 宝石いわ: ふつうのいわの一部(約22%)が色つきの宝石を抱いて落ちてくる。ラッキー色なら得。
    const gem=(!gold&&!big&&!rainbow&&Math.random()<0.22)?pick(GEMS):null;
    const pts=shape==="round"?roundPts():shape==="tower"?stackPts():rockPts();
    // 軸3: 開始直後の初期いわは画面外からの落下待ちを作らず、すでに見えている位置から始める
    const immediate=initBurst>0;if(immediate)initBurst--;
    // 軸3: 初期いわのy位置は「低学年がまず狙う画面中央あたり(自動プレイの非ミスタップが飛ぶ0.25H〜0.75H帯)」に収める。
    // 旧0.2H〜0.5Hは上端が範囲外にはみ出し、そこに出た初期いわが最初の数タップで拾われにくかった(firstScoreSec中央値3.45秒まで上振れの一因)。
    const y0=immediate?rnd(api.H*0.3,api.H*0.58):-sz-rnd(0,120);
    rocks.push({x,y:y0,vy:fallV,vx:rnd(-0.3,0.3),size:sz,
      rot:rnd(0,TAU),vr:gold?rnd(-0.012,0.012):rainbow?rnd(-0.02,0.02):rnd(-0.04,0.04),
      hp:big?2:1,big,gold,rainbow,gem,shape,flash:0,
      col:rainbow?"#ff5b5b":gold?"#ffd23f":pick(ROCK_COLS),pts,wob:rnd(0,TAU)});
    if(gold){api.tone(1568,0.1,"triangle",0.08);
      setTimeout(()=>api.tone(2093,0.12,"triangle",0.07),90);}
    if(rainbow){rbHintT=1.2;api.tone(880,0.1,"triangle",0.08);
      setTimeout(()=>api.tone(1320,0.12,"triangle",0.07),90);}
  }
  function burst(x,y,col,n,spd){
    n=Math.min(n,Math.max(0,130-shards.length));   // particle cap (keep 60fps)
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(spd*0.4,spd);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rnd(1,3),
        size:rnd(R*0.18,R*0.4),col:Array.isArray(col)?pick(col):col,rot:rnd(0,TAU),vr:rnd(-0.4,0.4),
        life:1,decay:rnd(0.012,0.024),pts:rockPts()});}
    const sn=Math.min(rint(5,8),Math.max(0,110-sparks.length));
    for(let i=0;i<sn;i++){const a=rnd(0,TAU),s=rnd(4,10);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(1.5,3.5),
        life:1,decay:rnd(0.03,0.06),col:pick(["#ffd23f","#ff8a3a","#fff2a0"])});}
  }
  // ⑤ 軸7: 形ごとに壊れ方の軌道を変える(丸=横に転がる/積み重ね=段々崩れ落ちる)
  function burstDir(x,y,col,n,spd,centerAngle,spread,vyBias){
    n=Math.min(n,Math.max(0,130-shards.length));
    for(let i=0;i<n;i++){const a=centerAngle+rnd(-spread,spread),s=rnd(spd*0.4,spd);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s+(vyBias||0),
        size:rnd(R*0.18,R*0.4),col:Array.isArray(col)?pick(col):col,rot:rnd(0,TAU),vr:rnd(-0.4,0.4),
        life:1,decay:rnd(0.012,0.024),pts:rockPts()});}
    const sn=Math.min(rint(5,8),Math.max(0,110-sparks.length));
    for(let i=0;i<sn;i++){const a=rnd(0,TAU),s=rnd(4,10);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(1.5,3.5),
        life:1,decay:rnd(0.03,0.06),col:pick(["#ffd23f","#ff8a3a","#fff2a0"])});}
  }
  function ring(x,y,col,big){rings.push({x,y,r:R*0.4,vr:big?R*0.7:R*0.5,life:1,decay:big?0.045:0.06,col});}
  function checkStage(){
    if(stageKill<stageGoal||clearT>0||boss||bossWarn>0||pendingBoss)return;
    clearStage=stage;clearT=1.6;flash=Math.min(1,flash+0.6);flashHue="#ffce5a";
    clearTitle="ステージ"+clearStage+" クリア！";
    api.boom(0.55);api.shake(14);
    api.slide(523,880,0.3,0.2,"triangle");api.tone(660,0.25,"triangle",0.13);
    setTimeout(()=>api.tone(988,0.28,"triangle",0.1),120);
    for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
      sparks.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,
        r:rnd(2.5,5),life:1,decay:rnd(0.012,0.02),col:pick(["#ffd23f","#ff8a3a","#fff2a0"])});}
    awardNoMiss();
    stage++;stageGoal=stageGoalFor(stage);stageKill=0;
    setClearMsg();
  }
  // ③ ノーミス ボーナス: このステージで いわを 1つも ようがんに おとさなかったら +3 & みどりの星シャワー。
  function awardNoMiss(){
    if(stageMiss===0){count+=3;api.setScore(count);noMissT=1.9;
      api.tone(1318,0.16,"triangle",0.11);setTimeout(()=>api.tone(1976,0.16,"triangle",0.08),110);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(3,8);
        sparks.push({x:api.W/2,y:api.H*0.44,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,
          r:rnd(2.5,5),life:1,decay:rnd(0.012,0.02),col:"#7be08a"});}}
    stageMiss=0;
  }
  // next-stage teaser shown inside the clear banner
  function setClearMsg(){
    if(stage%3===0){pendingBoss=true;clearMsg="つぎは… ボスいわ が くる！！";}
    else if(stage%3===1)clearMsg="つぎは きんの いわを さがせ！";
    else clearMsg="つぎは いわが もっと ふってくる！";
  }
  function crack(rk){
    rk.hp--;rk.flash=1;rk.size*=0.86;
    api.slide(300,200,0.08,0.2,"square");api.noise(0.06,0.14,1400);
    api.tone(280,0.08,"square",0.1);api.shake(4);
    ring(rk.x,rk.y,"#cdbfa8",false);
    burst(rk.x,rk.y,rk.col,5,5);
  }
  // ② ラッキー色 命中: いわの上に 小さな星が キラッ(白飛びしない控えめ演出)
  function luckySparkle(x,y){
    api.tone(1046,0.14,"triangle",0.1);api.tone(1568,0.16,"triangle",0.07);
    for(let i=0;i<4;i++){const a=-TAU/4+rnd(-0.6,0.6);
      sparks.push({x,y,vx:Math.cos(a)*rnd(1,3),vy:Math.sin(a)*rnd(2,4)-1,r:rnd(2,3.5),
        life:1,decay:0.03,col:luckyColor});}
  }
  function smash(rk){
    rk._dead=true;
    let gain=rk.rainbow?8:rk.gold?5:rk.big?2:1;
    // ② ラッキー色: きょうの秘密の宝石色を割ると +1 の隠しボーナス。気づくと得する。
    const isLucky=rk.gem&&rk.gem===luckyColor;
    if(isLucky){gain+=1;if(!luckySeen){luckySeen=true;luckyBigT=2.0;}else luckyMsgT=Math.max(luckyMsgT,0.9);}
    count+=gain;stageKill+=1;api.setScore(count);
    combo++;comboT=0.9;
    api.slide(340-Math.min(combo*8,120),120,0.14,0.32,"square");
    api.noise(0.12,0.2,1600);
    api.tone(440*Math.pow(2,clamp(combo,0,12)/12),0.12,"triangle",0.12);
    api.boom(rk.rainbow?0.7:rk.gold?0.7:rk.big?0.6:0.4);
    api.shake(6+Math.min(combo,8));
    if(rk.rainbow||rk.gold||rk.big||combo===5||combo===10)hstop(rk.rainbow||rk.gold?4:3);
    if(rk.rainbow){
      // ① にじいろいわ 撃破: 虹の輪が大きく広がる大盤振る舞い＋大量得点(まぶしすぎ防止に flash 控えめ)
      flash=Math.min(1,flash+0.4);flashHue="#ff7bd0";rbMsgT=1.4;
      for(let k=0;k<RAINBOW.length;k++)ring(rk.x,rk.y,RAINBOW[k],true);
      burst(rk.x,rk.y,RAINBOW,18,12);
      floats.push({x:rk.x,y:rk.y-rk.size,txt:"にじいろ！ +8",life:1,vy:-1,col:"#ff7bd0",size:32});
      api.shake(16);
      [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.14,"triangle",0.11),i*70));
    }else if(rk.gold){
      // GOLD! rainbow shards + fanfare + big flash
      flash=1;flashHue="#ffd23f";
      ring(rk.x,rk.y,"#fff2a0",true);ring(rk.x,rk.y,"#ffd23f",true);
      burst(rk.x,rk.y,RAINBOW,16,11);
      floats.push({x:rk.x,y:rk.y-rk.size,txt:"きんいわ！ +5",life:1,vy:-1,col:"#ffd23f",size:30});
      [0,4,7,12].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.16,"triangle",0.12),i*70));
    }else{
      flash=Math.min(1,flash+(rk.big?0.45:0.3));flashHue=rk.big?"#ff7b3a":"#ffce5a";
      ring(rk.x,rk.y,"#ffce5a",rk.big);ring(rk.x,rk.y,"#fff2a0",false);
      if(rk.shape==="round"){
        // 丸い溶岩玉: 横に転がるように破片が飛ぶ(進行方向寄り)
        const dir=rk.vx>=0?0:Math.PI;
        burstDir(rk.x,rk.y,rk.col,rk.big?14:9,rk.big?11:8,dir,0.55,-1);
      }else if(rk.shape==="tower"){
        // 積み重ね岩: 段々に崩れ落ちる(下向き中心)
        burstDir(rk.x,rk.y,rk.col,rk.big?14:9,rk.big?11:8,Math.PI/2,0.5,0.5);
      }else{
        burst(rk.x,rk.y,rk.col,rk.big?14:9,rk.big?11:8);
      }
    }
    if(isLucky)luckySparkle(rk.x,rk.y-rk.size*0.9);
    if(combo>=3){flash=Math.min(1,flash+combo*0.04);
      api.tone(220,0.2,"sawtooth",0.06);}
    checkStage();
  }
  // ---- BOSS ROCK: every 3rd stage a huge multi-HP rock hovers and must be pounded down ----
  function spawnBoss(){
    bossWarn=0;
    const hpMax=8+Math.min(6,Math.floor(stage/3));   // ボスHP 6→8 (約3割増)
    boss={x:api.W/2,y:-R*3,ty:api.H*0.3,size:R*2.3,hp:hpMax,hpMax,
      drift:0,wob:rnd(0,TAU),hurt:0,pts:rockPts()};
    api.slide(80,45,0.7,0.45,"sawtooth");api.noise(0.5,0.3,300,"lowpass",1);
    api.shake(14);api.boom(0.5);
  }
  function bossHit(){
    boss.hp--;boss.hurt=1;
    count++;api.setScore(count);combo++;comboT=0.9;
    api.noise(0.08,0.2,900);api.slide(240,140,0.1,0.25,"square");api.shake(5);
    ring(boss.x,boss.y,"#ff6a2a",true);
    burst(boss.x+rnd(-R,R),boss.y+rnd(-R,R),"#6e4f42",6,7);
    flash=Math.min(1,flash+0.15);flashHue="#ff6a2a";
    if(boss.hp<=0){bossDefeat();return;}
    if(boss.hp===Math.ceil(boss.hpMax/2)){hstop(3);api.tone(160,0.22,"sawtooth",0.1);}
  }
  function bossDefeat(){
    const bx=boss.x,by=boss.y;boss=null;
    count+=10;api.setScore(count);
    api.boom(0.85);api.shake(24);hstop(6);
    flash=1;flashHue="#ffd23f";
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(523*Math.pow(2,s/12),0.22,"triangle",0.13),i*90));
    burst(bx,by,"#6e4f42",20,12);burst(bx,by,RAINBOW,14,10);
    ring(bx,by,"#ffd23f",true);ring(bx,by,"#fff2a0",true);ring(bx,by,"#ff6a2a",false);
    floats.push({x:bx,y:by-R*2,txt:"+10！",life:1,vy:-1,col:"#ffd23f",size:34});
    awardNoMiss();
    clearStage=stage;clearT=2.0;
    clearTitle="ボスいわ たおした！";
    stage++;stageGoal=stageGoalFor(stage);stageKill=0;
    setClearMsg();
  }
  function drawBoss(){
    const b=boss,s=b.size,dmg=1-b.hp/b.hpMax;
    g.save();g.translate(b.x,b.y+Math.sin(b.wob)*8);
    g.scale(1+b.hurt*0.1,1-b.hurt*0.1);
    // menacing red aura
    g.save();g.globalCompositeOperation="lighter";
    const gp=0.5+0.3*Math.sin(b.wob*2);
    const ag=g.createRadialGradient(0,0,s*0.3,0,0,s*1.6);
    ag.addColorStop(0,"rgba(255,60,40,"+(0.45*gp)+")");ag.addColorStop(1,"rgba(255,60,40,0)");
    g.fillStyle=ag;g.beginPath();g.arc(0,0,s*1.6,0,TAU);g.fill();g.restore();
    const hurt=Math.min(1,Math.max(0,b.hurt));
    // 画像ボス: boss.png を当たり判定(size*1.25)に合わせ size*2.4 で中央描画。ヒビと被弾フラッシュだけ重ねる
    if(api.drawAsset("boss.png",0,0,s*2.4,s*2.4,{center:true})){
      g.strokeStyle="rgba(20,8,4,.75)";g.lineWidth=Math.max(2,s*0.05);g.lineCap="round";
      if(dmg>0.25){g.beginPath();g.moveTo(-s*0.1,-s*0.65);g.lineTo(s*0.05,-s*0.2);g.lineTo(-s*0.1,s*0.15);g.stroke();}
      if(dmg>0.5){g.beginPath();g.moveTo(s*0.55,-s*0.1);g.lineTo(s*0.2,s*0.1);g.lineTo(s*0.35,s*0.5);g.stroke();}
      if(dmg>0.75){g.beginPath();g.moveTo(-s*0.6,s*0.1);g.lineTo(-s*0.25,s*0.25);g.lineTo(-s*0.35,s*0.6);g.stroke();}
      if(b.hurt>0){g.globalAlpha=hurt*0.5;g.fillStyle="#fff";
        g.beginPath();g.arc(0,0,Math.max(0,s*1.05),0,TAU);g.fill();g.globalAlpha=1;}
      g.restore();return;
    }
    // body
    g.beginPath();
    for(let i=0;i<b.pts.length;i++){const p=b.pts[i];
      if(i===0)g.moveTo(p[0]*s,p[1]*s);else g.lineTo(p[0]*s,p[1]*s);}
    g.closePath();
    const bg=g.createRadialGradient(-s*0.3,-s*0.35,s*0.1,0,0,s*1.2);
    bg.addColorStop(0,lighten("#5e4438",45));bg.addColorStop(0.6,"#5e4438");bg.addColorStop(1,shadeHex("#5e4438",-30));
    g.fillStyle=bg;g.fill();
    g.lineWidth=Math.max(3,s*0.06);g.strokeStyle="rgba(30,12,8,.6)";g.stroke();
    // magma veins burn brighter as it takes damage
    g.save();g.clip();g.globalCompositeOperation="lighter";
    g.strokeStyle="#ff4a1a";g.lineWidth=Math.max(3,s*0.08);g.lineCap="round";
    g.globalAlpha=clamp(0.4+0.3*Math.sin(b.wob*3)+dmg*0.3,0,1);
    g.beginPath();g.moveTo(-s*0.5,-s*0.2);g.lineTo(-s*0.1,s*0.1);g.lineTo(s*0.3,-s*0.05);g.lineTo(s*0.5,s*0.4);g.stroke();
    g.beginPath();g.moveTo(-s*0.2,s*0.5);g.lineTo(0,0);g.lineTo(s*0.4,-s*0.4);g.stroke();
    g.restore();g.globalAlpha=1;
    // cracks appear with damage
    g.strokeStyle="rgba(20,8,4,.75)";g.lineWidth=Math.max(2,s*0.05);g.lineCap="round";
    if(dmg>0.25){g.beginPath();g.moveTo(-s*0.1,-s*0.65);g.lineTo(s*0.05,-s*0.2);g.lineTo(-s*0.1,s*0.15);g.stroke();}
    if(dmg>0.5){g.beginPath();g.moveTo(s*0.55,-s*0.1);g.lineTo(s*0.2,s*0.1);g.lineTo(s*0.35,s*0.5);g.stroke();}
    if(dmg>0.75){g.beginPath();g.moveTo(-s*0.6,s*0.1);g.lineTo(-s*0.25,s*0.25);g.lineTo(-s*0.35,s*0.6);g.stroke();}
    // angry face (opens mouth + eyes pop when hurt)
    g.strokeStyle="#1a0d08";g.lineWidth=Math.max(3,s*0.05);g.lineCap="round";
    g.beginPath();g.moveTo(-s*0.42,-s*0.3);g.lineTo(-s*0.12,-s*0.16);g.stroke();
    g.beginPath();g.moveTo(s*0.42,-s*0.3);g.lineTo(s*0.12,-s*0.16);g.stroke();
    g.fillStyle="#1a0d08";
    g.beginPath();g.arc(-s*0.26,-s*0.02,s*0.1*(1+hurt*0.5),0,TAU);g.arc(s*0.26,-s*0.02,s*0.1*(1+hurt*0.5),0,TAU);g.fill();
    g.fillStyle="#ff4a1a";
    g.beginPath();g.arc(-s*0.26,-s*0.02,s*0.04,0,TAU);g.arc(s*0.26,-s*0.02,s*0.04,0,TAU);g.fill();
    g.strokeStyle="#1a0d08";g.lineWidth=Math.max(3,s*0.05);
    if(hurt>0.4){g.fillStyle="#1a0d08";g.beginPath();g.ellipse(0,s*0.24,s*0.14,s*0.16,0,0,TAU);g.fill();}
    else{g.beginPath();g.arc(0,s*0.34,s*0.18,1.15*Math.PI,1.85*Math.PI);g.stroke();}
    // hurt white flash
    if(b.hurt>0){g.globalAlpha=b.hurt*0.5;g.fillStyle="#fff";
      g.beginPath();
      for(let i=0;i<b.pts.length;i++){const p=b.pts[i];
        if(i===0)g.moveTo(p[0]*s,p[1]*s);else g.lineTo(p[0]*s,p[1]*s);}
      g.closePath();g.fill();g.globalAlpha=1;}
    g.restore();
  }
  return{
    resize:layout,
    input(x,y,type){
      if(type!=="down"||clearT>0)return;
      // boss first (generous radius so little hands never miss it)
      if(boss&&boss.y>0&&Math.hypot(x-boss.x,y-boss.y)<boss.size*1.25){bossHit();return;}
      // hit-test topmost rock first
      // 軸3: まだ一度も得点していない間だけ的を大きく取り、最初の成功を早める。得点後は通常判定に戻すので
      // 以降の連打耐性(scorePerTap)には影響しない。
      const hitMul=count===0?1.6:(stage===1?1.25:1.15);
      for(let i=rocks.length-1;i>=0;i--){const rk=rocks[i];
        if(rk._dead)continue;
        if(Math.hypot(x-rk.x,y-rk.y)<rk.size*hitMul){
          if(rk.hp>1){crack(rk);return;}
          smash(rk);return;}}
      // ④ ながれ星タップ: いわに 当たらなかった タップが ながれ星に届いたら ごほうび(減点なし)
      if(meteor&&Math.hypot(x-meteor.x,y-meteor.y)<meteor.r*1.7){
        count+=1;api.setScore(count);
        api.tone(1318,0.12,"triangle",0.1);api.tone(1976,0.14,"triangle",0.08);
        for(let i=0;i<9;i++){const a=rnd(0,TAU),s=rnd(2,6);
          sparks.push({x:meteor.x,y:meteor.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,r:rnd(2,3.5),
            life:1,decay:rnd(0.02,0.04),col:pick(["#fff2a0","#ffd23f","#fff"])});}
        floats.push({x:meteor.x,y:meteor.y-R,txt:"ほし＋1",life:1,vy:-1,col:"#fff2a0",size:24});
        meteor=null;return;
      }
      // missed tap: little spark where tapped, no penalty
      api.tone(200,0.05,"triangle",0.06);
      for(let i=0;i<5;i++){const a=rnd(0,TAU),s=rnd(2,5);
        sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(1,2.5),
          life:1,decay:rnd(0.05,0.08),col:"#ff8a3a"});}
    },
    frame(dt,now){
      tsec+=0.016*dt;
      // ---- background: 画像(bg.jpg)があれば cover 描画。無ければ従来の手描き火山グラデ ----
      const imgBg=api.drawCover("bg.jpg");
      if(!imgBg){
      let grd=g.createLinearGradient(0,0,0,api.H);
      grd.addColorStop(0,"#2a0d1a");grd.addColorStop(0.28,"#5e1f24");
      grd.addColorStop(0.55,"#a83b1f");grd.addColorStop(0.78,"#d96a22");grd.addColorStop(1,"#ff9a3a");
      g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      // hazy heat sun low on horizon
      const sx=api.W*0.5,sy=groundY;
      let sun=g.createRadialGradient(sx,sy,0,sx,sy,api.W*0.6);
      sun.addColorStop(0,"rgba(255,220,120,.45)");sun.addColorStop(0.4,"rgba(255,150,60,.18)");sun.addColorStop(1,"rgba(255,150,60,0)");
      g.fillStyle=sun;g.fillRect(0,0,api.W,api.H);
      // distant volcano silhouettes
      g.fillStyle="rgba(40,14,22,.7)";
      g.beginPath();g.moveTo(0,groundY);
      g.lineTo(api.W*0.18,groundY-api.H*0.22);g.lineTo(api.W*0.3,groundY-api.H*0.1);
      g.lineTo(api.W*0.5,groundY-api.H*0.3);g.lineTo(api.W*0.7,groundY-api.H*0.12);
      g.lineTo(api.W*0.84,groundY-api.H*0.26);g.lineTo(api.W,groundY-api.H*0.05);
      g.lineTo(api.W,groundY);g.closePath();g.fill();
      // glowing lava cracks on the volcano (additive)
      g.save();g.globalCompositeOperation="lighter";g.strokeStyle="#ff5b2a";g.lineWidth=2;
      g.globalAlpha=0.4+0.2*Math.sin(tsec*2);
      g.beginPath();g.moveTo(api.W*0.5,groundY-api.H*0.3);g.lineTo(api.W*0.47,groundY-api.H*0.16);g.lineTo(api.W*0.52,groundY-api.H*0.05);g.stroke();
      g.beginPath();g.moveTo(api.W*0.18,groundY-api.H*0.22);g.lineTo(api.W*0.2,groundY-api.H*0.08);g.stroke();
      g.restore();g.globalAlpha=1;
      }
      // rising embers (additive glow)
      g.save();g.globalCompositeOperation="lighter";
      for(const e of embers){e.y+=e.vy*dt;e.x+=Math.sin(tsec+e.tw)*0.3*dt;e.tw+=e.sp*dt;
        if(e.y<-6){e.y=api.H+6;e.x=rnd(0,api.W);}
        const tw=0.5+0.5*Math.sin(e.tw*3);
        g.globalAlpha=0.4+0.4*tw;g.fillStyle=e.col;g.shadowBlur=8;g.shadowColor=e.col;
        g.beginPath();g.arc(e.x,e.y,e.r*(0.7+0.4*tw),0,TAU);g.fill();}
      g.shadowBlur=0;g.restore();g.globalAlpha=1;
      // ---- lava ground (いわが沈む境界 = ゲーム要素) ----
      if(!imgBg){
        let lg=g.createLinearGradient(0,groundY,0,api.H);
        lg.addColorStop(0,"#ff7b1f");lg.addColorStop(0.5,"#e8431a");lg.addColorStop(1,"#7a1208");
        g.fillStyle=lg;g.fillRect(0,groundY,api.W,api.H-groundY);
      } else {
        // 画像背景: 絵の溶岩湖を活かし、境界線だけ半透明の熱い光で示す(平坦な帯は描かない)
        let lg=g.createLinearGradient(0,groundY-R*0.6,0,api.H);
        lg.addColorStop(0,"rgba(255,140,40,0)");lg.addColorStop(0.25,"rgba(255,150,50,.34)");lg.addColorStop(1,"rgba(255,90,20,.12)");
        g.save();g.globalCompositeOperation="lighter";g.fillStyle=lg;g.fillRect(0,groundY-R*0.6,api.W,api.H-groundY+R*0.6);g.restore();
      }
      // molten surface shimmer band
      g.save();g.globalCompositeOperation="lighter";
      for(let x=0;x<api.W;x+=18){
        const yy=groundY+Math.sin(x*0.04+tsec*2)*3;
        g.globalAlpha=0.18+0.12*Math.sin(x*0.08+tsec*3);
        g.fillStyle="#ffd23f";g.fillRect(x,yy,12,4);}
      g.restore();g.globalAlpha=1;
      // lava bubbles popping
      for(const b of lavaBub){b.t+=b.sp*dt;
        if(b.t>=1){b.t=0;b.x=rnd(0,api.W);b.r=rnd(4,11);}
        const by=groundY+(api.H-groundY)*0.3*Math.sin(b.t*Math.PI);
        g.globalAlpha=Math.sin(b.t*Math.PI)*0.7;
        g.fillStyle="#ffce5a";g.beginPath();g.arc(b.x,groundY+6-by*0.0,b.r*Math.sin(b.t*Math.PI),0,TAU);g.fill();}
      g.globalAlpha=1;
      // heat haze lines just above lava (subtle)
      g.save();g.globalCompositeOperation="lighter";g.strokeStyle="rgba(255,200,120,.10)";g.lineWidth=6;
      for(const h of heat){h.ph+=0.04*dt;
        g.beginPath();g.moveTo(0,h.y);
        for(let x=0;x<=api.W;x+=24)g.lineTo(x,h.y+Math.sin(x*0.03+h.ph)*h.amp);
        g.stroke();}
      g.restore();
      // ---- spawning ----
      const paused=clearT>0;
      if(!paused){spawnT-=dt;if(spawnT<=0){spawn();
        spawnT=(earlyBoost>0?(earlyBoost--,9):clamp(16-(stage-1)*1.5,9,16))*(boss||bossWarn>0?1.6:1);}}   // 軸3: 開始直後だけ間隔を短く、以降も無反応が続きすぎない上限に縮める
      // ---- boss warning: rumbling screen + looming shadow + red pulse ----
      if(bossWarn>0&&!paused){
        bossWarn-=0.016*dt;api.shake(0.9);
        const sh=1-clamp(bossWarn/1.6,0,1);
        g.save();g.globalAlpha=0.2+0.1*Math.sin(tsec*12);g.fillStyle="#2a0508";g.fillRect(0,0,api.W,api.H);g.restore();
        g.save();g.globalAlpha=0.5*sh;g.fillStyle="#1a0505";
        g.beginPath();g.ellipse(api.W/2,api.H*0.1,R*2.6*sh+8,R*1.5*sh+5,0,0,TAU);g.fill();g.restore();
        const wp=1+0.1*Math.sin(tsec*14);
        g.save();g.translate(api.W/2,api.H*0.38);g.scale(wp,wp);g.textAlign="center";
        g.font="900 40px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,40,40,.9)";g.shadowBlur=18;g.fillStyle="#ff4d4d";
        g.fillText("ボスいわ が くる！！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ボスいわ が くる！！",0,0);
        g.restore();g.textAlign="left";g.globalAlpha=1;
        if(bossWarn<=0)spawnBoss();
      }
      // ---- update & draw rocks ----
      for(const rk of rocks){
        if(rk._dead)continue;
        if(rk.flash>0)rk.flash-=0.08*dt;
        if(!paused){rk.y+=rk.vy*dt;rk.x+=rk.vx*dt;rk.rot+=rk.vr*dt;rk.wob+=0.06*dt;}
        // landed in lava: sink with a splash, no penalty
        if(rk.y-rk.size*0.4>groundY){
          rk._dead=true;
          api.noise(0.16,0.14,500,"lowpass",1);api.slide(180,90,0.16,0.12,"sawtooth");
          ring(rk.x,groundY,"#ff8a3a",false);
          for(let i=0;i<6;i++){const a=rnd(-Math.PI,0),s=rnd(2,6);
            sparks.push({x:rk.x,y:groundY,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(1.5,3),
              life:1,decay:rnd(0.03,0.05),col:"#ff8a3a"});}
          combo=0;comboT=0;stageMiss++;   // ③ ノーミス判定: ようがんに おとしたら 記録
          continue;
        }
        drawRock(rk);
      }
      rocks=rocks.filter(r=>!r._dead);
      // ---- boss update & draw (in front of falling rocks) ----
      if(boss){
        boss.wob+=0.05*dt;
        if(boss.hurt>0)boss.hurt-=0.06*dt;
        if(!paused){
          if(boss.y<boss.ty)boss.y+=Math.min(2.4*dt,boss.ty-boss.y);
          else boss.drift+=0.012*dt;
          boss.x=api.W/2+Math.sin(boss.drift)*api.W*0.05;
        }
        drawBoss();
      }
      // ---- ④ ながれ星: たまに 空を よこぎる。タップで ほし＋きらめき(減点なし) ----
      if(!paused){
        if(meteor){
          meteor.trail.unshift({x:meteor.x,y:meteor.y});if(meteor.trail.length>8)meteor.trail.pop();
          meteor.x+=meteor.vx*dt;meteor.y+=meteor.vy*dt;meteor.life-=0.008*dt;
          if(meteor.x<-40||meteor.y>groundY-R||meteor.life<=0)meteor=null;
        }else{meteorT-=dt;if(meteorT<=0){
          meteor={x:api.W+30,y:rnd(api.H*0.08,api.H*0.3),vx:-rnd(3,5),vy:rnd(1.1,2.2),
            r:R*0.36,life:1,trail:[]};
          meteorT=rnd(360,720);api.tone(1760,0.1,"sine",0.05);}}
      }
      if(meteor){
        g.save();g.globalCompositeOperation="lighter";
        for(let i=0;i<meteor.trail.length;i++){const t=meteor.trail[i],a=1-i/meteor.trail.length;
          g.globalAlpha=a*0.45;g.fillStyle="#fff2a0";
          g.beginPath();g.arc(t.x,t.y,Math.max(0,meteor.r*0.5*a),0,TAU);g.fill();}
        g.globalAlpha=0.9;g.fillStyle="#fff7c2";g.shadowBlur=12;g.shadowColor="#ffd23f";
        g.beginPath();g.arc(meteor.x,meteor.y,Math.max(0,meteor.r*0.5),0,TAU);g.fill();
        g.shadowBlur=0;g.restore();g.globalAlpha=1;
      }
      // ---- shockwave rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=2+ri.life*3;g.shadowBlur=8*ri.life;g.shadowColor=ri.col;
        g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      g.shadowBlur=0;g.globalAlpha=1;rings=rings.filter(ri=>ri.life>0);
      // ---- shards ----
      for(const p of shards){p.vy+=0.45*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        drawChunk(p);g.restore();}
      g.globalAlpha=1;shards=shards.filter(p=>p.life>0&&p.y<api.H+40);
      // ---- sparks (additive) ----
      g.save();g.globalCompositeOperation="lighter";
      for(const s of sparks){s.vy+=0.18*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=s.decay*dt;
        const a=Math.max(0,s.life);g.globalAlpha=a;g.fillStyle=s.col;g.shadowBlur=8;g.shadowColor=s.col;
        g.beginPath();g.arc(s.x,s.y,s.r*a+0.4,0,TAU);g.fill();}
      g.shadowBlur=0;g.restore();g.globalAlpha=1;sparks=sparks.filter(s=>s.life>0);
      // ---- combo timer / hitStop cooldown ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      if(hsCool>0)hsCool-=dt;
      // ---- floating bonus texts ----
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.016*dt;
        g.save();g.globalAlpha=clamp(f.life,0,1);g.textAlign="center";
        g.font="900 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=5;g.lineJoin="round";g.strokeStyle="rgba(40,10,5,.7)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.restore();}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // ---- impact flash ----
      if(flash>0){flash-=0.06*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";
        g.globalAlpha=fa*0.3;g.fillStyle=flashHue;g.fillRect(0,0,api.W,api.H);
        g.globalAlpha=fa*0.14;g.fillStyle="#fff";g.fillRect(0,0,api.W,api.H);
        g.restore();g.globalAlpha=1;}
      // ---- HUD: stage + progress gauge (top-center safe band) ----
      drawHUD();
      // ---- combo text (top-center) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.16);g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(255,140,40,.9)";g.shadowBlur=14;
        g.fillStyle="#ffd23f";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.6)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // ① にじいろ 予告バナー(落下中に「くるよ！」/中央=HUD安全帯)
      if(rbHintT>0){rbHintT-=0.016*dt;
        const pop=1+Math.max(0,rbHintT-0.9)*1.2,col=RAINBOW[Math.floor(tsec*4)%RAINBOW.length];
        g.save();g.translate(api.W/2,api.H*0.24);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbHintT*1.4,0,1);g.font="900 26px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=14;g.fillStyle="#fff";
        g.fillText("にじいろ が おちてくる！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろ が おちてくる！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbHintT<0)rbHintT=0;}
      // ① にじいろいわ！ 撃破バナー(虹色に色替わり)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.4,col=RAINBOW[Math.floor(tsec*5)%RAINBOW.length];
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 36px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle="#fff";
        g.fillText("にじいろいわ！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろいわ！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！(初回だけ 大きく教える)
      if(luckyBigT>0){luckyBigT-=0.016*dt;
        const pop=1+Math.max(0,luckyBigT-1.4)*1.2;
        g.save();g.translate(api.W/2,api.H*0.28);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(luckyBigT*1.2,0,1);g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうの ラッキー色は "+(GEMNAME[luckyColor]||"")+"！";
        g.shadowColor=luckyColor;g.shadowBlur=12;g.fillStyle="#fff2a0";g.fillText(t2,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle=luckyColor;g.strokeText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyBigT<0)luckyBigT=0;}
      // ② ラッキー！(2回目以降の小さな祝福)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.34);g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.5,0,1);g.font="900 22px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=luckyColor;g.shadowBlur=12;g.fillStyle="#fff2a0";g.fillText("ラッキー！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ ノーミス ボーナス！(クリア文字と重ねない下側)
      if(noMissT>0){noMissT-=0.014*dt;
        const pop=1+Math.max(0,noMissT-1.3)*1.4;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(noMissT*1.3,0,1);g.font="900 28px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=16;g.fillStyle="#c7ffcf";
        g.fillText("ノーミス ボーナス！",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,120,60,.7)";g.strokeText("ノーミス ボーナス！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(noMissT<0)noMissT=0;}
      // ---- STAGE CLEAR banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.5;g.fillStyle="#000";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        const fs=clearTitle.length>9?38:46;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 "+fs+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,150,40,.9)";g.shadowBlur=20;g.fillStyle="#ffd23f";
        g.fillText(clearTitle,0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText(clearTitle,0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";
        g.fillStyle=pendingBoss?"#ff8a6a":"#fff";
        g.fillText(clearMsg,0,42);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=pendingBoss?40:18;
          if(pendingBoss){pendingBoss=false;bossWarn=1.6;
            api.slide(200,60,0.5,0.3,"sawtooth");}}
      }
      // 加算(lighter)の後始末: mock/実機どちらでも次フレームへ加算状態を持ち越さない(白飛び漏れ0)
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
    }
  };
  function drawHUD(){
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.045;
    if(boss){
      // boss HP bar (red, pulsing) replaces the stage gauge
      g.save();g.textAlign="center";
      g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
      g.fillStyle="#ffdada";g.shadowColor="rgba(255,40,40,.8)";g.shadowBlur=8;
      g.fillText("ボスいわ を たたけ！",api.W/2,by-8);
      g.shadowBlur=0;
      g.fillStyle="rgba(0,0,0,.45)";rr(bx,by,bw,bh,bh/2);g.fill();
      const fr=clamp(boss.hp/boss.hpMax,0,1);
      if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
        gg.addColorStop(0,"#ff3b3b");gg.addColorStop(1,"#ff8a3a");
        g.fillStyle=gg;rr(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
      g.strokeStyle="rgba(255,200,200,.6)";g.lineWidth=2;rr(bx,by,bw,bh,bh/2);g.stroke();
      g.restore();g.textAlign="left";
      return;
    }
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    g.save();g.textAlign="center";
    // 軸6: 降下中のいわがHUD帯を横切っても数字が埋もれないよう、文字の背後に不透明な背景板を先に敷く
    g.fillStyle="rgba(20,8,10,.6)";rr(bx-14,by-30,bw+28,28,10);g.fill();
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(0,0,0,.5)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,0,0,.4)";rr(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#ff8a3a");gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg;rr(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;rr(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }
  function drawRock(rk){
    const s=rk.size;
    // ① にじいろいわ: 胴体の色を虹色にゆっくり回して「特別感」を出す
    const bcol=rk.rainbow?RAINBOW[Math.floor(tsec*4+rk.wob)%RAINBOW.length]:rk.col;
    g.save();g.translate(rk.x,rk.y);g.rotate(rk.rot+Math.sin(rk.wob)*0.04);
    // hot glowing aura (gold rocks shine brighter & warmer)
    g.save();g.globalCompositeOperation="lighter";
    const gp=0.4+0.3*Math.sin(rk.wob*2);
    const ac=rk.rainbow?"255,180,240":rk.gold?"255,215,80":"255,120,40";
    const ag=g.createRadialGradient(0,0,s*0.2,0,0,s*1.5);
    ag.addColorStop(0,"rgba("+ac+","+((rk.rainbow?0.6:rk.gold?0.6:0.4)*gp)+")");ag.addColorStop(1,"rgba("+ac+",0)");
    g.fillStyle=ag;g.beginPath();g.arc(0,0,s*1.5,0,TAU);g.fill();g.restore();
    // 画像いわ: goldrock.png(きん)のみ採用。ふつう/でか/にじいろは rock.png が背景残り不良で不採用のため手描き。
    // 未準備なら null → 従来の手描き多角形へ(顔も手描き側にだけある)
    let src=null;
    if(rk.gold){const gi=api.asset("goldrock.png");src=gi.ready?gi:null;}
    const useImg=!!src, goldImg=rk.gold&&useImg&&api.asset("goldrock.png").ready;
    if(useImg){
      // 当たり判定 size*1.15 に合わせ、正方形スプライトを size*2.2 で中央描画
      api.drawSrc(src,0,0,s*2.2,s*2.2,{center:true});
    } else {
    // rock body (irregular polygon)
    g.beginPath();
    for(let i=0;i<rk.pts.length;i++){const p=rk.pts[i];
      if(i===0)g.moveTo(p[0]*s,p[1]*s);else g.lineTo(p[0]*s,p[1]*s);}
    g.closePath();
    const bg=g.createRadialGradient(-s*0.3,-s*0.35,s*0.1,0,0,s*1.2);
    bg.addColorStop(0,lighten(bcol,55));bg.addColorStop(0.6,bcol);bg.addColorStop(1,shadeHex(bcol,-30));
    g.fillStyle=bg;g.fill();
    // dark rim
    g.lineWidth=Math.max(2,s*0.08);g.strokeStyle="rgba(30,12,8,.55)";g.stroke();
    // glowing magma veins inside (white-gold veins on gold rocks)
    g.save();g.clip();g.globalCompositeOperation="lighter";
    g.strokeStyle=rk.gold?"#fff2a0":"#ff6a2a";g.lineWidth=Math.max(2,s*0.1);g.lineCap="round";
    g.globalAlpha=0.5+0.3*Math.sin(rk.wob*3);
    g.beginPath();g.moveTo(-s*0.5,-s*0.2);g.lineTo(-s*0.1,s*0.1);g.lineTo(s*0.3,-s*0.05);g.lineTo(s*0.5,s*0.4);g.stroke();
    g.beginPath();g.moveTo(-s*0.2,s*0.5);g.lineTo(0,0);g.lineTo(s*0.4,-s*0.4);g.stroke();
    g.restore();
    // cute face
    g.fillStyle="#1a0d08";
    g.beginPath();g.arc(-s*0.26,-s*0.06,s*0.12,0,TAU);g.arc(s*0.26,-s*0.06,s*0.12,0,TAU);g.fill();
    g.fillStyle="rgba(255,240,200,.9)";
    g.beginPath();g.arc(-s*0.29,-s*0.1,s*0.04,0,TAU);g.arc(s*0.23,-s*0.1,s*0.04,0,TAU);g.fill();
    g.strokeStyle="#1a0d08";g.lineWidth=Math.max(2,s*0.05);g.lineCap="round";
    g.beginPath();g.arc(0,s*0.06,s*0.16,0.15*Math.PI,0.85*Math.PI);g.stroke();
    g.fillStyle="rgba(255,120,80,.4)";
    g.beginPath();g.arc(-s*0.42,s*0.04,s*0.1,0,TAU);g.arc(s*0.42,s*0.04,s*0.1,0,TAU);g.fill();
    }
    // big rock = tougher; show a crack when chipped (画像/手描き共通で線を重ねる)
    if(rk.big&&rk.hp<=1){g.strokeStyle="rgba(20,8,4,.7)";g.lineWidth=Math.max(2,s*0.08);g.lineCap="round";
      g.beginPath();g.moveTo(-s*0.1,-s*0.6);g.lineTo(s*0.05,-s*0.1);g.lineTo(-s*0.1,s*0.2);g.lineTo(s*0.1,s*0.6);g.stroke();}
    // ② 宝石いわ: おでこに 色つきの ダイヤ(ラッキー色は これが 今日の あたり)
    if(rk.gem){
      const gs=Math.max(0,s*0.26),gy=-s*0.5;
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.4+0.3*Math.sin(rk.wob*3);
      g.fillStyle=rk.gem;g.beginPath();
      g.moveTo(0,gy-gs);g.lineTo(gs*0.72,gy);g.lineTo(0,gy+gs);g.lineTo(-gs*0.72,gy);g.closePath();g.fill();
      g.restore();g.globalAlpha=1;
      g.fillStyle=rk.gem;g.beginPath();
      g.moveTo(0,gy-gs*0.72);g.lineTo(gs*0.5,gy);g.lineTo(0,gy+gs*0.72);g.lineTo(-gs*0.5,gy);g.closePath();g.fill();
      g.fillStyle="rgba(255,255,255,.75)";g.beginPath();
      g.moveTo(0,gy-gs*0.42);g.lineTo(gs*0.2,gy-gs*0.05);g.lineTo(0,gy);g.lineTo(-gs*0.2,gy-gs*0.05);g.closePath();g.fill();
    }
    // gold king rock: crown + orbiting sparkles (instantly eye-catching)
    if(rk.gold){
      if(!goldImg){   // 王冠は goldrock.png に描き込み済み。画像が無い時だけ手描き
      g.fillStyle="#fff2a0";g.strokeStyle="rgba(120,80,10,.6)";g.lineWidth=Math.max(1.5,s*0.04);
      g.beginPath();g.moveTo(-s*0.3,-s*0.55);g.lineTo(-s*0.3,-s*0.85);g.lineTo(-s*0.12,-s*0.65);
      g.lineTo(0,-s*0.9);g.lineTo(s*0.12,-s*0.65);g.lineTo(s*0.3,-s*0.85);g.lineTo(s*0.3,-s*0.55);
      g.closePath();g.fill();g.stroke();
      }
      g.save();g.globalCompositeOperation="lighter";g.fillStyle="#fff2a0";
      for(let i=0;i<3;i++){const a=rk.wob*1.6+i*TAU/3,px=Math.cos(a)*s*1.35,py=Math.sin(a)*s*1.35;
        const tw2=0.5+0.5*Math.sin(rk.wob*4+i);g.globalAlpha=0.4+0.6*tw2;
        g.beginPath();g.moveTo(px,py-s*0.15*tw2-s*0.04);g.lineTo(px+s*0.05,py);
        g.lineTo(px,py+s*0.15*tw2+s*0.04);g.lineTo(px-s*0.05,py);g.closePath();g.fill();}
      g.restore();g.globalAlpha=1;
    }
    // hit flash overlay (画像時は丸、手描き時は多角形に合わせる)
    if(rk.flash>0){g.save();g.globalAlpha=rk.flash*0.7;g.fillStyle="#fff";
      g.beginPath();
      if(useImg)g.arc(0,0,Math.max(0,s*0.95),0,TAU);
      else for(let i=0;i<rk.pts.length;i++){const p=rk.pts[i];
        if(i===0)g.moveTo(p[0]*s,p[1]*s);else g.lineTo(p[0]*s,p[1]*s);}
      g.closePath();g.fill();g.restore();}
    g.restore();
    // ② ラッキー色の宝石いわには 頭上に 小さな星が キラッ(気づけるヒント)
    if(rk.gem===luckyColor){
      const ty=rk.y-s*1.3,tw=0.5+0.5*Math.sin(tsec*6+rk.wob),tr=Math.max(0,s*0.16*(0.7+tw*0.5));
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.45+0.5*tw;g.fillStyle="#fff2a0";
      g.beginPath();
      g.moveTo(rk.x,ty-tr);g.lineTo(rk.x+tr*0.34,ty-tr*0.34);g.lineTo(rk.x+tr,ty);
      g.lineTo(rk.x+tr*0.34,ty+tr*0.34);g.lineTo(rk.x,ty+tr);g.lineTo(rk.x-tr*0.34,ty+tr*0.34);
      g.lineTo(rk.x-tr,ty);g.lineTo(rk.x-tr*0.34,ty-tr*0.34);g.closePath();g.fill();
      g.restore();g.globalAlpha=1;
    }
  }
  function drawChunk(p){const pts=p.pts,s=p.size;
    g.beginPath();
    for(let i=0;i<pts.length;i++){if(i===0)g.moveTo(pts[i][0]*s,pts[i][1]*s);else g.lineTo(pts[i][0]*s,pts[i][1]*s);}
    g.closePath();
    g.fillStyle=p.col;g.fill();
    g.save();g.clip();g.fillStyle="rgba(0,0,0,.3)";
    g.beginPath();g.moveTo(0,-s);g.lineTo(s,s);g.lineTo(-s,s);g.closePath();g.fill();g.restore();
    g.lineWidth=Math.max(1,s*0.1);g.strokeStyle="rgba(255,140,60,.5)";g.stroke();}
  function rr(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function lighten(hex,amt){const a=amt===undefined?50:amt;const c=parseInt(hex.slice(1),16);
    const r=Math.min(255,((c>>16)&255)+a),gg=Math.min(255,((c>>8)&255)+a),b=Math.min(255,(c&255)+a);
    return "rgb("+r+","+gg+","+b+")";}
  function shadeHex(hex,amt){const c=parseInt(hex.slice(1),16);
    const r=clamp(((c>>16)&255)+amt,0,255),gg=clamp(((c>>8)&255)+amt,0,255),b=clamp((c&255)+amt,0,255);
    return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("rockfall", buildRockfall);
