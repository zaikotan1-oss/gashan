function buildLavaball(api){
  const g=api.g;
  // 画像アセット(assets/lavaball/)。無ければ従来の手描きにフォールバック
  // ※ ball/rock/hut/gold は生成2回とも不良(顔が出る/単体にならない/背景が写り込む)だったため
  //   コード側では使わず手描きのままにしている(下の issues 参照)。bg のみ画像を使う。
  api.preload(["bg.jpg"]);
  // ---- all state lives here (closed over build) ----
  let ball,objs=[],shards=[],sparks=[],rings=[],embers=[],heatW=[],floats=[];
  let slopeY0,slopeY1,startX,groundY;
  let count=0,combo=0,comboT=0,tsec=0,flash=0,launchT=0,celebrate=0;
  // stage progression: clear a quota of objects -> "ステージ クリア！" -> harder endless
  let stage=1,stageKill=0,stageGoal=10,clearBanner=0,banScale=0,stageClearing=false;
  // fever time (gauge fills by crushing; full -> 12s of 2x points + one-hit + rainbow)
  let fever=0,feverGauge=0,feverBanner=0;
  let hitCd=0;                                       // hitStop cooldown (frames) - never spam freeze
  let laneHintShown=false;                           // ③ 一度だけ「うえ/した」のヒントを出す
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  const CANDY=["#ff5b5b","#4db8ff","#7be08a","#ff8c42","#ff5da2","#5ad1ff"];  // ② いろいわ用の あかるい色
  const CNAME={"#ff5b5b":"あか","#4db8ff":"あお","#7be08a":"みどり","#ff8c42":"オレンジ","#ff5da2":"ピンク","#5ad1ff":"みずいろ"};
  let luckyColor=pick(CANDY),luckySeen=false,luckyMsgT=0;  // ② きょうのラッキー色: 秘密の1色
  let rbMsgT=0;                                            // ① にじいろいわ 発見バナー
  let stageWhiff=0,perfectT=0;                             // ③ パーフェクト判定: からぶり回数
  let twinkles=[];                                         // ② ラッキー命中の星キラッ
  let sunWink=0; const sunHit={x:0,y:0,r:0};               // ④ 太陽ひみつタップ
  const TYPES=["rock","rock","hut","rock"];          // weighted bag, more variety later
  function goalFor(s){return 10+(s-1)*3;}     // 10,13,16,...（7〜8歳向けに手応えを2〜3割増）
  // F. next-stage teaser shown during the clear banner
  function teaser(s){
    if(s===2)return "つぎは きの おうちが でてくる！";
    if(s===3)return "つぎは ひかる クリスタル とうじょう！";
    if(s===4)return "つぎは ゴールドいわが でやすい！";
    const t=["つぎは てきが もっと ふえる！","つぎは ゴールドいわの チャンス！","つぎは ボールが もっと あつくなる！"];
    return t[s%t.length];
  }

  function layout(){
    groundY=api.H*0.9;
    slopeY0=api.H*0.30;                // top of slope (left, high)
    slopeY1=api.H*0.74;               // bottom of slope (right, low)
    startX=api.W*0.16;
    // ④ 太陽ひみつタップ の当たり判定(描画位置 sunx/suny と一致・寛容に大きめ)
    sunHit.x=api.W*0.72; sunHit.y=api.H*0.16; sunHit.r=Math.max(44,api.W*0.12);
    // re-anchor any live objects onto the new slope so resize never strands them
    for(const o of objs){ if(o.onSlope) o.y=slopeYAt(o.x)-o.r-(o.lane?laneGap():0); }
  }
  layout();

  // y of the slope surface at world x (linear ramp left-high to right-low)
  function slopeYAt(x){
    const t=clamp((x-startX)/(api.W-startX-api.W*0.06),0,1);
    return lerp(slopeY0,slopeY1,t);
  }
  // ①③ 上段/下段レーンの見た目の間隔(タップの高さで選ぶ2本の坂)
  function laneGap(){ return clamp(api.W*0.13,55,95); }
  // floats はほぼ同じ位置に何個も積み重なると読めなくなるので、少しだけxをばらけさせる
  function pushFloat(o){ o.x=(o.x||0)+rnd(-16,16); floats.push(o); }

  function spawnRow(){
    // line objects along the slope so the rolling ball sweeps through them
    objs=[];
    const n=clamp(5+stage+(fever>0?2:0),5,12);   // 1列の数も少し多め(7〜8歳向け)
    const x0=startX+api.W*0.18, x1=api.W*0.92;
    const bag=TYPES.slice();
    if(stage>=2) bag.push("hut");
    if(stage>=3) bag.push("crystal");        // shiny lava crystal = bonus points
    if(stage>=6) bag.push("boulder");        // ④ 長時間プレイ用の新顔: 2発必要な でかい岩
    // A. rare golden rock: low chance, huge points, rainbow burst on crush
    // ④ ずっと0.10で頭打ちにせず、長く遊ぶほど少しずつ増やす(見た目・確率が変化し続ける)
    const goldCh=stage>=12?0.16:stage>=8?0.13:stage>=4?0.10:0.06;
    for(let i=0;i<n;i++){
      const x=lerp(x0,x1,n<=1?0.5:i/(n-1))+rnd(-api.W*0.02,api.W*0.02);
      let type=pick(bag);
      if(Math.random()<goldCh) type="gold";
      // A. 激レア にじいろいわ: いつ出るか分からない=ドキドキ発見。ステージ2以降 数%だけ。
      if(stage>=2 && Math.random()<0.045) type="rainbow";
      const base=clamp(api.W*0.04,22,40);
      let r=base,hp=1,pts=1;
      if(type==="hut"){ r=base*1.25; hp=stage>=4?3:2; pts=2; }   // 後半の おうち は 3回(手応え)
      else if(type==="crystal"){ r=base*0.95; hp=1; pts=4; }
      else if(type==="gold"){ r=base*1.1; hp=1; pts=10; }
      else if(type==="rainbow"){ r=base*1.15; hp=1; pts=18; }
      else if(type==="boulder"){ r=base*1.6; hp=2; pts=5; }      // ④ 大きい・2回叩かないと壊れない
      else { // ⑦ ただの いわ にも大小差(小さめ25%・大きめ25%・ふつう50%)
        const sc=Math.random(); r=sc<0.25?base*0.6:sc<0.5?base*1.6:base;
      }
      // ② いろいわ: ふつうの いわ の一部が あかるい色で塗られる。この色が ラッキー色かも。
      const paint=(type==="rock"&&Math.random()<0.3)?pick(CANDY):null;
      // ⑦ rock/gold/にじいろは色違いだけでなく輪郭も変える(ごつごつ/丸い/とがった岩柱)
      const shape=rint(0,2);
      // ①③ 上段/下段の2レーンにランダム配置。ボールは launch 時に選んだレーンの的しか壊せない。
      const lane=Math.random()<0.5?0:1;
      objs.push({x,y:slopeYAt(x)-r-(lane?laneGap():0),r,type,hp,pts,paint,shape,lane,onSlope:true,dead:false,
        hue:type==="rock"?rint(18,34):type==="crystal"?rint(280,320):type==="gold"?rint(42,52):rint(8,22),
        wob:rnd(0,TAU),flash:0});
    }
    // announce the lucky find so the kid spots it right away
    const gg=objs.find(o=>o.type==="gold");
    if(gg){ pushFloat({x:gg.x,y:gg.y-gg.r*1.8,txt:"ゴールドいわ！",life:1,vy:-0.5,col:"#ffd23f",size:24});
      api.tone(1318,0.12,"triangle",0.1); }
    // A. にじいろいわ が並んだ瞬間の予告(見つけて!のワクワク)
    const rb=objs.find(o=>o.type==="rainbow");
    if(rb){ pushFloat({x:rb.x,y:rb.y-rb.r*1.9,txt:"にじいろいわ！",life:1,vy:-0.5,col:"#ff5da2",size:26});
      api.tone(1046,0.1,"triangle",0.1); api.tone(1568,0.12,"triangle",0.08); }
  }
  spawnRow();

  function makeBall(){
    ball={x:startX,y:slopeYAt(startX)-clamp(api.W*0.05,26,46),
      r:clamp(api.W*0.05,26,46),baseR:clamp(api.W*0.05,26,46),
      vx:0,vy:0,rolling:false,heat:0,spin:0,eaten:0,lane:0};
    if(fever>0){ ball.heat=1; ball.r=ball.baseR*1.6; }   // fever: born white-hot & big
  }
  makeBall();

  function ember(x,y,up){
    if(embers.length>120) return;
    embers.push({x,y,vx:rnd(-1.2,1.2),vy:up?rnd(-3.2,-1.2):rnd(-1.6,-0.4),
      r:rnd(2,5),life:1,decay:rnd(0.01,0.024),hue:rint(8,40)});
  }
  function burst(x,y,col,n,big,shape){
    shape=shape||"rock";
    rings.push({x,y,r:ball.r*0.5,vr:ball.r*(big?0.7:0.5),life:1,decay:0.05,col});
    // ② 軸2: 種類ごとに破片の大きさ・重さ・寿命を変えて「壊れ方の違い」を出す
    //   (いわ=従来 / いえ=大きめ板 / ボルダー=一回り大きく重い / クリスタル=薄く軽く短命)
    const rMin=shape==="boulder"?5:shape==="crystal"?2.5:shape==="hut"?4:3;
    const rMax=shape==="boulder"?12:shape==="crystal"?6:shape==="hut"?10:8;
    const gw=shape==="boulder"?1.6:shape==="crystal"?0.65:1;
    const decMul=shape==="crystal"?1.6:shape==="boulder"?0.7:1;
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(2.5,big?10:7);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rnd(1,4),r:rnd(rMin,rMax),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.02)*decMul,gw,shape,
        col:i%3===0?col:(i%3===1?"#ffb347":"#7a3a1a")});}
    for(let i=0;i<rint(5,9);i++){const a=rnd(0,TAU),s=rnd(4,11);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.05,0.09),col:"#ffe08a"});}
    for(let i=0;i<6;i++) ember(x+rnd(-ball.r*0.4,ball.r*0.4),y,true);
  }

  function crush(o){
    if(fever>0) o.hp=1;                        // fever: everything one-hit
    o.hp--; o.flash=1;
    if(o.hp>0){
      api.tone(220,0.07,"square",0.1); api.noise(0.07,0.12,1400); api.shake(4);
      burst(o.x,o.y,"#caa",6,false); return;
    }
    o.dead=true;
    // ② きょうのラッキー色: 秘密の色の いろいわ を つぶすと +2 の隠しボーナス。気づくと得。
    const isLucky=o.type==="rock"&&o.paint===luckyColor;
    let gain=o.pts*(fever>0?2:1);              // B. fever = 2x points
    if(isLucky){ gain+=2; luckyMsgT=luckySeen?Math.max(luckyMsgT,0.6):1.6; luckySeen=true; }
    count+=gain; stageKill++; combo++; comboT=1.0; api.setScore(count);
    if(fever<=0) feverGauge=clamp(feverGauge+((o.type==="gold"||o.type==="rainbow")?0.34:0.09),0,1);
    // ball grows + heats up the more it eats (food = power)
    ball.eaten++; ball.heat=clamp(ball.heat+0.12,0,1);
    ball.r=clamp(ball.r+o.r*0.10,ball.baseR,ball.baseR*2.0);
    flash=Math.min(1,flash+0.3+0.04*combo);
    const col=o.type==="gold"?"#ffd23f":o.type==="rainbow"?"#fff":o.type==="crystal"?"#c78bff":o.type==="hut"?"#ff8c42":(isLucky?luckyColor:"#ff5b2e");
    // ② 軸2: 種類ごとに破片の形を変える(いえ=板/ボルダー=塊/クリスタル=薄い菱形/いわ=従来のダイヤ型)
    const shardShape=o.type==="hut"?"hut":o.type==="boulder"?"boulder":o.type==="crystal"?"crystal":"rock";
    burst(o.x,o.y-o.r*0.3,col,12+Math.min(combo,8),combo>=4,shardShape);
    api.slide(300,120,0.14,0.3,"sawtooth"); api.noise(0.14,0.2,900,"lowpass");
    api.tone(420*Math.pow(2,clamp(combo,0,10)/12),0.12,"triangle",0.12);
    // ② 軸2: ボルダーは壊した瞬間の衝撃を強く長め・クリスタルは軽く短くして手応えの違いを出す
    const shakeAmt=o.type==="boulder"?12+Math.min(combo,8):o.type==="crystal"?Math.max(3,4+Math.min(combo,4)):6+Math.min(combo,8);
    api.boom(clamp(0.4+combo*0.03,0.4,0.7)); api.shake(shakeAmt);
    // hitStop only on real highlights, with a 30-frame cooldown (never freeze-spam)
    if(hitCd<=0&&(o.type==="gold"||o.type==="boulder"||combo===3||combo===6||combo===10)){
      api.hitStop(o.type==="gold"?4:o.type==="boulder"?5:3); hitCd=o.type==="boulder"?34:30;
    }
    if(o.type==="gold") goldBurst(o.x,o.y-o.r*0.3);
    if(o.type==="rainbow") rainbowBurst(o.x,o.y-o.r*0.3);   // A. 激レア撃破: 虹の大盤振る舞い
    if(isLucky) luckySparkle(o.x,o.y-o.r);                  // ② 頭上に星のキラッ
    if(o.type==="crystal"){ api.tone(1046,0.18,"triangle",0.14); api.tone(1318,0.2,"triangle",0.1); }
    if(combo>1) pushFloat({x:o.x,y:o.y-o.r,txt:"x"+combo,life:1,vy:-1.0,
      col:combo>=6?"#ff3b3b":combo>=3?"#ff8c42":"#ffd23f",size:combo>=4?40:30});
    if(gain>=4) pushFloat({x:o.x,y:o.y-o.r*2.1,txt:"+"+gain,life:1,vy:-0.8,
      col:o.type==="gold"?"#ffd23f":"#c78bff",size:o.type==="gold"?36:26});
    checkStage();
  }

  // A. golden rock crushed: rainbow shards + fanfare + big flash
  function goldBurst(x,y){
    for(let i=0;i<20&&shards.length<150;i++){const a=rnd(0,TAU),s=rnd(3,10);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rnd(2,5),r:rnd(3,8),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.008,0.015),
        col:"hsl("+(i*18)+",95%,60%)"});}
    rings.push({x,y,r:20,vr:26,life:1,decay:0.04,col:"#ffd23f"});
    [0,4,7,12].forEach((s,i)=>setTimeout(()=>api.tone(659.25*Math.pow(2,s/12),0.16,"triangle",0.15),i*70));
    pushFloat({x,y:y-44,txt:"ゴールド！",life:1,vy:-0.8,col:"#ffd23f",size:34});
    flash=1;
  }

  // A. にじいろいわ 撃破: 虹の輪＋にじ色の破片＋ファンファーレ(激レアの爽快ごほうび)
  function rainbowBurst(x,y){
    rbMsgT=Math.max(rbMsgT,1.4);
    for(let k=0;k<6;k++) rings.push({x,y,r:Math.max(0,ball.r*0.4),vr:ball.r*(0.55+k*0.12),life:1,decay:0.05,col:"hsl("+(k*60)+",90%,60%)"});
    for(let i=0;i<26&&shards.length<160;i++){const a=rnd(0,TAU),s=rnd(3,10);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rnd(2,5),r:rnd(3,8),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.008,0.015),col:"hsl("+(i*14)+",95%,62%)"});}
    for(let i=0;i<10;i++) ember(x+rnd(-ball.r*0.5,ball.r*0.5),y,true);
    pushFloat({x,y:y-46,txt:"にじいろ！",life:1,vy:-0.8,col:"#ff5da2",size:34});
    api.boom(0.7); api.shake(16);
    api.slide(660,1320,0.5,0.22,"triangle"); api.tone(880,0.14,"triangle",0.12); api.tone(1320,0.16,"triangle",0.1);
    if(hitCd<=0){ api.hitStop(5); hitCd=32; }   // 節目限定＋クールダウン
    flash=Math.min(1,flash+0.4);
  }
  // ② ラッキー色 命中: きらっと小さめの祝福(白飛びしないよう控えめ)+ 頭上に星
  function luckySparkle(x,y){
    api.tone(1046,0.14,"triangle",0.11); api.tone(1568,0.16,"triangle",0.08);
    twinkles.push({x,y:y-8,life:1,r:rnd(8,12),col:luckyColor});
    for(let i=0;i<8;i++){const a=rnd(0,TAU),s=rnd(2,6);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:1,decay:rnd(0.03,0.05),col:luckyColor});}
  }

  // B. fever time: 12s of 2x points, one-hit targets, rainbow sky, big ball
  function startFever(){
    fever=12; feverGauge=0; feverBanner=1.8; flash=1;
    api.boom(0.7); api.shake(18);
    api.slide(392,1568,0.55,0.25,"sawtooth");
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(523.25*Math.pow(2,s/12),0.18,"triangle",0.14),i*80));
    for(let i=0;i<26&&shards.length<150;i++){const a=rnd(0,TAU),s=rnd(3,9);
      shards.push({x:api.W/2,y:api.H*0.45,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.01,0.018),
        col:"hsl("+(i*14)+",95%,60%)"});}
    if(hitCd<=0){ api.hitStop(4); hitCd=30; }
    ball.heat=1; ball.r=Math.max(ball.r,ball.baseR*1.6);
    spawnRow();                                  // instantly refill a bigger row
  }

  function checkStage(){
    if(stageKill<stageGoal||clearBanner>0||stageClearing) return;
    stageClearing=true; clearBanner=1.8; banScale=0; celebrate=1.6;
    // ③ パーフェクト: このステージで「からぶり(0こ つぶし の ころがし)」が 0回なら +5 & みどりの祝福
    if(stageWhiff===0){ count+=5; api.setScore(count); perfectT=1.9;
      api.tone(1318,0.16,"triangle",0.12); api.tone(1976,0.18,"triangle",0.09);
      for(let i=0;i<16;i++){const a=rnd(0,TAU),s=rnd(3,8);
        shards.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(4,8),
          rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:"#7be08a"});} }
    flash=1; api.boom(0.6); api.shake(16);
    api.slide(523,1046,0.45,0.22,"triangle");
    setTimeout(()=>{api.tone(784,0.2,"triangle",0.18);},120);
    for(let i=0;i<24;i++){const a=rnd(0,TAU),s=rnd(3,9);
      shards.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(["#ff5b2e","#ffd23f","#ff8c42"])});}
  }

  function launch(lane){
    if(ball.rolling||clearBanner>0){
      // ② 転がり中のタップも完全に無視しない。短い低音1回だけ返す(押しても無反応感を減らす)
      if(ball.rolling) api.tone(300,0.05,"sine",0.05);
      return;
    }
    ball.rolling=true; launchT=1; combo=0; comboT=0; ball.lane=lane||0;
    ball.vx=clamp(api.W*0.012,5,11)*(fever>0?1.25:1); ball.vy=0;
    api.slide(160,90,0.25,0.3,"sine"); api.noise(0.2,0.18,700,"lowpass"); api.shake(5);
  }

  return {
    resize:layout,
    input(x,y,type){
      if(type!=="down") return;
      // ④ 太陽ひみつタップ: 太陽に触れたら ウインク＋きんの きらきら(減点なし・ころがしはそのまま)
      if(sunHit.r>0 && Math.hypot(x-sunHit.x,y-sunHit.y)<sunHit.r){
        sunWink=1; api.tone(1318,0.1,"triangle",0.09); api.tone(1760,0.12,"triangle",0.07);
        for(let i=0;i<8;i++){const a=rnd(-TAU*0.5,0),s=rnd(2,6);
          sparks.push({x:sunHit.x,y:sunHit.y,vx:Math.cos(a)*s*0.7,vy:Math.sin(a)*s-1,life:1,decay:rnd(0.02,0.035),col:pick(["#ffd23f","#fff0a0","#ffe08a"])});}
      }
      // ①③ タップした高さで レーン(上段/下段)を選ぶ: 狙って打ち分ける歯ごたえ
      launch(y<api.H*0.52?1:0);
    },
    frame(dt,now){
      tsec+=0.016*dt;
      if(celebrate>0) celebrate=Math.max(0,celebrate-0.02*dt);
      if(hitCd>0) hitCd=Math.max(0,hitCd-dt);
      // fever timer: run down, then a gentle wind-down cue
      if(fever>0){
        fever-=0.016*dt;
        if(fever<=0){ fever=0;
          api.slide(880,220,0.5,0.2,"sine");
          pushFloat({x:api.W/2,y:api.H*0.3,txt:"フィーバー おわり",life:1,vy:-0.5,col:"#fff",size:24});
        }
      } else if(feverGauge>=1&&clearBanner<=0){ startFever(); }

      // ---------- BACKGROUND: volcanic sky + magma ----------
      // 画像背景(bg.jpg)があれば cover 描画。無ければ従来の手描きグラデ
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // フィーバー中は画像の上に暖色を薄く重ねて「あつい!」感を出す(平坦な帯ではなく薄いグラデ)
        if(fever>0){ g.save(); g.globalAlpha=0.18+0.06*Math.sin(tsec*6);
          const fg=g.createLinearGradient(0,0,0,api.H); fg.addColorStop(0,"#ff3b3b"); fg.addColorStop(1,"#ffd23f");
          g.fillStyle=fg; g.fillRect(0,0,api.W,api.H); g.restore(); g.globalAlpha=1; }
      } else {
        let sky=g.createLinearGradient(0,0,0,api.H);
        sky.addColorStop(0,"#2a0a16"); sky.addColorStop(0.32,"#5e1320");
        sky.addColorStop(0.55,"#9e3318"); sky.addColorStop(0.78,"#d6601f");
        sky.addColorStop(1,"#ffb347");
        g.fillStyle=sky; g.fillRect(0,0,api.W,api.H);
      }
      // hazy sun/glow upper area
      const sunx=api.W*0.72,suny=api.H*0.16;
      let sun=g.createRadialGradient(sunx,suny,0,sunx,suny,api.W*0.5);
      sun.addColorStop(0,"rgba(255,210,120,.45)"); sun.addColorStop(0.3,"rgba(255,150,60,.2)");
      sun.addColorStop(1,"rgba(255,150,60,0)");
      g.fillStyle=sun; g.fillRect(0,0,api.W,api.H);
      // ④ 太陽ひみつタップ: 叩かれた瞬間だけ ^_^ のウインク顔(発見のごほうび)
      if(sunWink>0){ sunWink-=0.02*dt; const sr=Math.max(20,api.W*0.05);
        g.save(); g.strokeStyle="#ffcf7a"; g.lineWidth=Math.max(2,sr*0.14); g.lineCap="round";
        g.globalAlpha=clamp(sunWink*1.4,0,1); g.shadowColor="rgba(255,220,140,.9)"; g.shadowBlur=10;
        g.beginPath();
        g.moveTo(sunx-sr*0.5,suny-sr*0.02); g.quadraticCurveTo(sunx-sr*0.32,suny-sr*0.32,sunx-sr*0.14,suny-sr*0.02);
        g.moveTo(sunx+sr*0.14,suny-sr*0.02); g.quadraticCurveTo(sunx+sr*0.32,suny-sr*0.32,sunx+sr*0.5,suny-sr*0.02);
        g.stroke();
        g.beginPath(); g.arc(sunx,suny+sr*0.16,sr*0.36,0.12*Math.PI,0.88*Math.PI); g.stroke();
        g.shadowBlur=0; g.restore(); g.globalAlpha=1; if(sunWink<0)sunWink=0; }
      // distant volcano silhouettes ※画像背景のときは絵の火山があるので描かない(喧嘩する平坦要素)
      g.fillStyle="#3a0d12";
      if(!imgBg) for(let i=0;i<3;i++){const vx=api.W*(0.2+i*0.32),vw=api.W*0.3,vy=api.H*0.55;
        g.beginPath(); g.moveTo(vx-vw,vy); g.lineTo(vx-vw*0.16,api.H*0.30);
        g.lineTo(vx+vw*0.16,api.H*0.30); g.lineTo(vx+vw,vy); g.closePath(); g.fill();
        // glowing crater + rising smoke
        g.save(); g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(255,120,40,.5)"; g.beginPath();
        g.ellipse(vx,api.H*0.305,vw*0.16,vw*0.05,0,0,TAU); g.fill(); g.restore();}
      // rising smoke columns ※画像背景のときはスキップ
      g.save(); g.globalAlpha=0.16; g.fillStyle="#1a0608";
      if(!imgBg) for(let i=0;i<3;i++){const vx=api.W*(0.2+i*0.32);
        for(let s=0;s<4;s++){const sy=api.H*0.30-s*40-((tsec*14+i*20)%160);
          const ox=Math.sin(tsec*0.5+s+i)*18;
          g.beginPath(); g.arc(vx+ox,sy,18+s*6,0,TAU); g.fill();}}
      g.restore(); g.globalAlpha=1;

      // ---------- THE SLOPE (volcanic rock ramp) ----------
      // 坂はボールが転がるゲーム要素なので画像時も残す。ただし半透明にして絵の地面の質感を透かす
      g.fillStyle=imgBg?"rgba(28,10,8,.62)":"#2b1410";
      g.beginPath();
      g.moveTo(startX-api.W*0.2,slopeY0);
      for(let x=startX-api.W*0.2;x<=api.W;x+=20) g.lineTo(x,x<startX?slopeY0:slopeYAt(x));
      g.lineTo(api.W,api.H); g.lineTo(0,api.H); g.closePath(); g.fill();
      // glowing lava cracks along the slope surface
      g.save(); g.globalCompositeOperation="lighter"; g.lineCap="round";
      for(let i=0;i<6;i++){const fx=startX+ (api.W-startX)*((i+0.5)/6);
        const fy=slopeYAt(fx); const pul=0.4+0.4*Math.sin(tsec*2+i);
        g.strokeStyle="rgba(255,90,30,"+(0.3*pul)+")"; g.lineWidth=3;
        g.beginPath(); g.moveTo(fx-14,fy+8); g.lineTo(fx,fy+2); g.lineTo(fx+12,fy+12); g.stroke();}
      g.restore();
      // surface rim highlight (hot edge)
      g.strokeStyle="rgba(255,150,60,.5)"; g.lineWidth=3;
      g.beginPath(); g.moveTo(startX-api.W*0.2,slopeY0);
      for(let x=startX;x<=api.W;x+=20) g.lineTo(x,slopeYAt(x)); g.stroke();

      // ---------- MAGMA POOL at the bottom ----------
      const lavaY=api.H*0.93;
      let lava=g.createLinearGradient(0,lavaY,0,api.H);
      lava.addColorStop(0,"#ffec5c"); lava.addColorStop(0.4,"#ff8c1a"); lava.addColorStop(1,"#c21807");
      g.fillStyle=lava; g.beginPath(); g.moveTo(0,lavaY);
      for(let x=0;x<=api.W;x+=16) g.lineTo(x,lavaY+Math.sin(x*0.03+tsec*3)*5);
      g.lineTo(api.W,api.H); g.lineTo(0,api.H); g.closePath(); g.fill();
      g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=0.5;
      g.fillStyle="#fff2a0"; g.beginPath(); g.moveTo(0,lavaY);
      for(let x=0;x<=api.W;x+=16) g.lineTo(x,lavaY+Math.sin(x*0.05+tsec*3.5)*4);
      g.lineTo(api.W,lavaY+8); g.lineTo(0,lavaY+8); g.closePath(); g.fill();
      g.restore(); g.globalAlpha=1;
      // ambient embers rising from lava
      if(embers.length<60 && Math.random()<0.5) ember(rnd(0,api.W),lavaY,true);

      // ---------- OBJECTS on slope ----------
      for(const o of objs){
        if(o.dead) continue;
        if(o.flash>0) o.flash-=0.08*dt;
        o.wob+=0.05*dt;
        drawObj(o);
      }
      objs=objs.filter(o=>!o.dead);
      // auto-refill: a stage needs more objects than one row holds, so
      // respawn a fresh row whenever the slope is empty (never during clear banner)
      if(objs.length===0&&!stageClearing&&clearBanner<=0) spawnRow();

      // ---------- BALL physics + draw ----------
      if(ball.rolling){
        ball.x+=ball.vx*dt; ball.spin+=ball.vx*0.05*dt;
        ball.vx+=0.08*dt;                 // accelerate downhill
        const sy=slopeYAt(ball.x)-ball.r-(ball.lane?laneGap():0);
        ball.y=lerp(ball.y,sy,clamp(0.3*dt,0,1));
        // collide with objects (①③ 同じレーンの的だけ。レーンを外すと からぶり=狙う歯ごたえ)
        for(const o of objs){
          if(o.dead||o.lane!==ball.lane) continue;
          if(Math.hypot(ball.x-o.x,ball.y-o.y)<ball.r+o.r*0.7){
            crush(o);
          }
        }
        // off the right edge or into lava -> finish run, respawn ball
        if(ball.x>api.W+ball.r || ball.y>lavaY-ball.r*0.2){
          if(ball.eaten>0){ api.boom(0.5); api.shake(8);
            for(let i=0;i<14;i++) ember(ball.x,ball.y,true); }
          else if(!stageClearing&&clearBanner<=0){ stageWhiff++;   // ③ からぶり=パーフェクト失敗
            if(!laneHintShown){ laneHintShown=true;                // 一度だけ狙い方のヒント(叱らず案内)
              pushFloat({x:api.W/2,y:api.H*0.42,txt:"うえ したで ねらいを かえてみよう！",life:1.6,vy:-0.3,col:"#fff5d6",size:20});
            }
          }
          makeBall();
        }
      } else {
        // idle ball wobbles a touch at the top, inviting a tap
        ball.y=slopeYAt(ball.x)-ball.r+Math.sin(tsec*3)*2;
      }
      drawBall();
      if(launchT>0) launchT=Math.max(0,launchT-0.05*dt);

      // ---------- shockwave rings ----------
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save(); g.globalAlpha=Math.max(0,ri.life)*0.7; g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3; g.beginPath(); g.arc(ri.x,ri.y,ri.r,0,TAU); g.stroke(); g.restore();}
      rings=rings.filter(ri=>ri.life>0);

      // ---------- shards ----------
      // ② 軸2: 種類ごとに重さ(gw)と形(shape)を変えて「壊れ方の違い」を見せる
      for(const p of shards){p.vy+=0.45*dt*(p.gw||1);p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save(); g.globalAlpha=Math.max(0,p.life); g.translate(p.x,p.y); g.rotate(p.rot);
        g.fillStyle=p.col; g.beginPath();
        const pr=Math.max(0,p.r);
        if(p.shape==="hut"){                          // いえ: 細長い板状のかけら
          g.rect(-pr*1.3,-pr*0.35,pr*2.6,pr*0.7);
        } else if(p.shape==="boulder"){                // ボルダー: 一回り大きい ごつごつの塊
          g.moveTo(-pr*1.1,-pr*0.3); g.lineTo(-pr*0.2,-pr*1.1); g.lineTo(pr*1.0,-pr*0.5);
          g.lineTo(pr*0.9,pr*0.7); g.lineTo(-pr*0.5,pr*1.0); g.closePath();
        } else if(p.shape==="crystal"){                // クリスタル: 薄く尖った菱形
          g.moveTo(0,-pr*1.4); g.lineTo(pr*0.55,0); g.lineTo(0,pr*1.4); g.lineTo(-pr*0.55,0); g.closePath();
        } else {                                       // 従来のダイヤ型(いわ・ゴールド・にじいろ等)
          g.moveTo(-pr,-pr*0.4); g.lineTo(pr*0.6,-pr); g.lineTo(pr,pr*0.5); g.lineTo(-pr*0.4,pr); g.closePath();
        }
        g.fill();
        g.restore();}
      shards=shards.filter(p=>p.life>0);

      // ---------- sparks (additive) ----------
      g.save(); g.globalCompositeOperation="lighter";
      for(const s of sparks){s.vy+=0.2*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=0.92;s.life-=s.decay*dt;
        g.globalAlpha=Math.max(0,s.life); g.fillStyle=s.col; g.shadowBlur=8; g.shadowColor=s.col;
        g.beginPath(); g.arc(s.x,s.y,2.4*s.life+0.5,0,TAU); g.fill();}
      g.shadowBlur=0; g.restore(); g.globalAlpha=1;
      sparks=sparks.filter(s=>s.life>0);

      // ---------- embers (additive) ----------
      g.save(); g.globalCompositeOperation="lighter";
      for(const e of embers){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy+=0.02*dt;e.life-=e.decay*dt;
        g.globalAlpha=Math.max(0,e.life)*0.9; g.fillStyle="hsl("+e.hue+",100%,60%)";
        g.shadowBlur=8; g.shadowColor="#ff8c1a";
        g.beginPath(); g.arc(e.x,e.y,Math.max(0,e.r*e.life),0,TAU); g.fill();}
      g.shadowBlur=0; g.restore(); g.globalAlpha=1;
      embers=embers.filter(e=>e.life>0&&e.y>-20);

      // ---------- ② ラッキー色の星キラッ(短命・加算・すぐ消える) ----------
      if(twinkles.length){ g.save(); g.globalCompositeOperation="lighter";
        for(const t of twinkles){ t.life-=0.03*dt; t.y-=0.4*dt;
          const rr=Math.max(0,t.r*t.life);
          g.globalAlpha=Math.max(0,t.life); g.fillStyle=t.col; g.shadowBlur=10; g.shadowColor=t.col;
          drawTwinkle(t.x,t.y,rr); }
        g.shadowBlur=0; g.restore(); g.globalAlpha=1;
        twinkles=twinkles.filter(t=>t.life>0); }

      // ---------- combo timeout + floats ----------
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.02*dt;
        g.save(); g.globalAlpha=Math.max(0,f.life); g.textAlign="center";
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=6; g.strokeStyle="rgba(0,0,0,.5)"; g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col; g.fillText(f.txt,f.x,f.y); g.restore();}
      floats=floats.filter(f=>f.life>0);

      // ---------- combo text (top center, safe zone) ----------
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save(); g.translate(api.W/2,api.H*0.14); g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1); g.shadowColor="rgba(255,120,30,.9)"; g.shadowBlur=14;
        g.fillStyle="#ffd23f"; g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(255,255,255,.6)";
        g.strokeText("コンボ x"+combo,0,0); g.restore(); g.globalAlpha=1; g.textAlign="left";
      }

      // ---------- A. にじいろいわ！ バナー(虹色に色替わり=激レアの大きな祝福) ----------
      if(rbMsgT>0){ rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.4, col="hsl("+((tsec*120)%360)+",90%,62%)";
        // ⑥ 0.24Hだとコンボ/ラッキー/共通エンジンの祝福バナーと重なるので下寄りに逃がす
        g.save(); g.translate(api.W/2,api.H*0.7); g.scale(pop,pop); g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1); g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col; g.shadowBlur=18; g.fillStyle="#fff"; g.fillText("にじいろいわ！",0,0);
        g.shadowBlur=0; g.lineWidth=2; g.strokeStyle=col; g.strokeText("にじいろいわ！",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(rbMsgT<0)rbMsgT=0; }
      // ---------- ② きょうのラッキー色 ヒント(初回は色名つき・以後は短く) ----------
      if(luckyMsgT>0){ luckyMsgT-=0.016*dt;
        const pop=1+Math.max(0,luckyMsgT-0.8)*1.2;
        g.save(); g.translate(api.W/2,api.H*0.32); g.scale(pop,pop); g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.4,0,1); g.font="900 23px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=luckyColor; g.shadowBlur=14;
        const t2=luckyMsgT>1?("きょうのラッキー色は "+(CNAME[luckyColor]||"")+"！"):"ラッキー！";
        g.fillStyle="#fff5d6"; g.fillText(t2,0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(luckyMsgT<0)luckyMsgT=0; }
      // ---------- ③ パーフェクト！ バナー(クリア文字と重ならない下側) ----------
      if(perfectT>0){ perfectT-=0.014*dt;
        const pop=1+Math.max(0,perfectT-1.3)*1.3;
        g.save(); g.translate(api.W/2,api.H*0.6); g.scale(pop,pop); g.textAlign="center";
        g.globalAlpha=clamp(perfectT*1.3,0,1); g.shadowColor="rgba(123,224,138,.9)"; g.shadowBlur=16;
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.fillStyle="#c7ffcf"; g.fillText("パーフェクト！",0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(40,120,60,.7)"; g.strokeText("パーフェクト！",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(perfectT<0)perfectT=0; }

      // ---------- impact flash ----------
      if(flash>0){flash-=0.06*dt;
        g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=Math.max(0,flash)*0.3;
        g.fillStyle="#ff6a1a"; g.fillRect(0,0,api.W,api.H); g.restore(); g.globalAlpha=1;}

      // ---------- HUD (top center) ----------
      drawHUD();

      // ---------- stage clear banner ----------
      if(clearBanner>0){
        clearBanner=Math.max(0,clearBanner-0.016*dt);
        banScale=Math.min(1,banScale+0.12*dt);
        const a=clamp(clearBanner*1.5,0,1), pop=ease(banScale);
        g.save(); g.globalAlpha=a*0.45; g.fillStyle="#1a0608";
        g.fillRect(0,api.H*0.32,api.W,api.H*0.24); g.restore();
        g.save(); g.translate(api.W/2,api.H*0.44); g.scale(pop,pop); g.globalAlpha=a;
        g.textAlign="center"; g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,120,30,.9)"; g.shadowBlur=22; g.fillStyle="#ffd23f";
        g.fillText("ステージ "+stage+" クリア！",0,0);
        g.shadowBlur=0; g.lineWidth=2; g.strokeStyle="#fff"; g.strokeText("ステージ "+stage+" クリア！",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#fff";
        g.fillText("つぎは ステージ "+(stage+1)+"！",0,44);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
        if(clearBanner<=0){
          // advance to next, harder stage; endless
          stage++; stageGoal=goalFor(stage); stageKill=0; stageClearing=false; stageWhiff=0;
          spawnRow(); makeBall();
        }
      }
      // 加算合成が次フレームへ漏れないよう明示的に戻す(白飛び防止・保険)
      g.globalCompositeOperation="source-over"; g.globalAlpha=1;
    },
    stop(){}
  };

  // ===================== drawing helpers =====================
  function drawObj(o){
    g.save(); g.translate(o.x,o.y);
    // ①③ 上段レーンの的は坂の地面までを岩柱でつなぎ、宙に浮いて見えないようにする
    if(o.lane){
      const pillarLen=Math.max(0,slopeYAt(o.x)-o.y-o.r*0.5);
      if(pillarLen>0){
        const pw=Math.max(2,o.r*0.5);
        const pg=g.createLinearGradient(0,o.r*0.5,0,o.r*0.5+pillarLen);
        pg.addColorStop(0,"#4a3a34"); pg.addColorStop(1,"#20100a");
        g.fillStyle=pg; g.fillRect(-pw/2,o.r*0.5,pw,pillarLen);
        g.fillStyle="rgba(255,120,40,.22)"; g.fillRect(-pw/2,o.r*0.5,pw*0.3,pillarLen);
      }
    }
    // shadow
    g.fillStyle="rgba(0,0,0,.3)"; g.beginPath();
    g.ellipse(0,o.r*0.85,o.r*0.9,o.r*0.3,0,0,TAU); g.fill();
    if(o.type==="hut") drawHut(o);
    else if(o.type==="crystal") drawCrystal(o);
    else if(o.type==="boulder") drawBoulder(o);
    else if(o.type==="rainbow") drawRainbowRock(o);
    else if(o.type==="gold") drawGold(o);
    else drawRock(o);
    // hit flash overlay
    if(o.flash>0){ g.save(); g.globalAlpha=o.flash*0.7; g.globalCompositeOperation="lighter";
      g.fillStyle="#fff"; g.beginPath(); g.arc(0,0,o.r,0,TAU); g.fill(); g.restore(); }
    g.restore();
  }
  // ⑦ rock/gold/にじいろ の輪郭を共有(0=ごつごつ岩 従来 / 1=丸い岩 / 2=とがった岩柱)。
  // 色違いだけでなく形も変えて「壊す物のバラエティ」を作る。
  function rockBodyPath(r,shape){
    g.beginPath();
    if(shape===1){                      // 丸い岩
      g.arc(0,0,Math.max(0,r),0,TAU);
    } else if(shape===2){               // とがった岩柱
      g.moveTo(-r*0.45,r*0.9); g.lineTo(-r*0.55,-r*0.15); g.lineTo(-r*0.12,-r*1.25);
      g.lineTo(r*0.1,-r*1.15); g.lineTo(r*0.5,-r*0.05); g.lineTo(r*0.4,r*0.9); g.closePath();
    } else {                            // ごつごつ岩(従来)
      g.moveTo(-r,0); g.lineTo(-r*0.6,-r*0.8); g.lineTo(r*0.2,-r); g.lineTo(r,-r*0.4);
      g.lineTo(r*0.7,r*0.6); g.lineTo(-r*0.3,r*0.7); g.closePath();
    }
  }
  function drawRock(o){const r=o.r,shape=o.shape||0;
    // 画像いわ(rock.png)は2回生成しても単体物にならなかった(石の山になる)ため未使用。手描きのまま。
    const grd=g.createRadialGradient(-r*0.3,-r*0.4,Math.max(0,r*0.1),0,0,Math.max(0,r*1.2));
    if(o.paint){ grd.addColorStop(0,"#ffffff"); grd.addColorStop(0.45,o.paint); grd.addColorStop(1,"#2a201c"); }
    else { grd.addColorStop(0,"#7a6a60"); grd.addColorStop(0.6,"#4a3a34"); grd.addColorStop(1,"#2a201c"); }
    g.fillStyle=grd; rockBodyPath(r,shape); g.fill();
    g.strokeStyle="rgba(255,170,90,.3)"; g.lineWidth=2; g.stroke();
    // small glowing seams(丸い岩は放射状のひび、それ以外は従来の斜めの筋)
    g.save(); g.globalCompositeOperation="lighter";
    g.strokeStyle="rgba(255,100,40,.5)"; g.lineWidth=1.5;
    if(shape===1){
      g.beginPath(); g.moveTo(-r*0.4,-r*0.3); g.lineTo(0,0); g.lineTo(r*0.35,r*0.25); g.stroke();
      g.beginPath(); g.moveTo(0,0); g.lineTo(-r*0.1,r*0.5); g.stroke();
    } else {
      g.beginPath(); g.moveTo(-r*0.3,-r*0.5); g.lineTo(0,0); g.lineTo(r*0.3,r*0.3); g.stroke();
    }
    g.restore();
  }
  // ④ でかい岩(2発必要): 転がしても1発では壊れない大きめの障害物。ひびは hut と同じ思想。
  function drawBoulder(o){const r=o.r;
    const grd=g.createRadialGradient(-r*0.25,-r*0.3,Math.max(0,r*0.15),0,0,Math.max(0,r*1.15));
    grd.addColorStop(0,"#8a7a6e"); grd.addColorStop(0.55,"#57453c"); grd.addColorStop(1,"#241209");
    g.fillStyle=grd;
    g.beginPath();
    g.ellipse(-r*0.32,r*0.15,Math.max(0,r*0.62),Math.max(0,r*0.55),0,0,TAU);
    g.ellipse(r*0.28,r*0.05,Math.max(0,r*0.7),Math.max(0,r*0.62),0,0,TAU);
    g.ellipse(0,-r*0.35,Math.max(0,r*0.55),Math.max(0,r*0.5),0,0,TAU);
    g.fill();
    g.strokeStyle="rgba(255,150,70,.35)"; g.lineWidth=2; g.stroke();
    if(o.hp<2){ // 1発当てて ひび割れ
      g.strokeStyle="rgba(20,10,8,.75)"; g.lineWidth=3; g.lineCap="round";
      g.beginPath(); g.moveTo(-r*0.3,-r*0.4); g.lineTo(r*0.05,r*0.05); g.lineTo(-r*0.15,r*0.5); g.stroke();
      g.beginPath(); g.moveTo(r*0.1,-r*0.5); g.lineTo(r*0.3,r*0.1); g.stroke();
    }
  }
  // A. ゴールドいわ: きんいろに光る いわ(画像 gold.png / 無ければ金色グラデの手描き)
  function drawGold(o){const r=o.r,shape=o.shape||0,pul=0.5+0.5*Math.sin(tsec*3+o.wob);
    // きんいろのオーラ(加算・脈動)=見つけやすく
    g.save(); g.globalCompositeOperation="lighter";
    const aR=Math.max(0,r*1.6);
    const ag=g.createRadialGradient(0,0,Math.max(0,r*0.3),0,0,aR);
    ag.addColorStop(0,"rgba(255,220,80,"+(0.35*pul)+")"); ag.addColorStop(1,"rgba(255,220,80,0)");
    g.fillStyle=ag; g.beginPath(); g.arc(0,0,aR,0,TAU); g.fill(); g.restore();
    // 画像いわ(gold.png)は2回生成しても単体物にならず(金塊の山+マゼンタ被り)未使用。手描きのまま。
    const grd=g.createRadialGradient(-r*0.3,-r*0.4,Math.max(0,r*0.1),0,0,Math.max(0,r*1.2));
    grd.addColorStop(0,"#fff3b0"); grd.addColorStop(0.45,"#ffd23f"); grd.addColorStop(1,"#8a5a10");
    g.fillStyle=grd; rockBodyPath(r,shape); g.fill();
    g.strokeStyle="rgba(255,240,180,.6)"; g.lineWidth=2; g.stroke();
    g.fillStyle="rgba(255,255,255,.5)"; g.beginPath();
    g.moveTo(-r*0.3,-r*0.6); g.lineTo(r*0.05,-r*0.2); g.lineTo(-r*0.15,r*0.2); g.closePath(); g.fill();
  }
  // A. にじいろいわ: 虹色に脈動する激レアの いわ(見つけたら つぶすと大量得点)
  function drawRainbowRock(o){const r=o.r,shape=o.shape||0,pul=0.5+0.5*Math.sin(tsec*4+o.wob),h=(tsec*120)%360;
    // にじ の オーラ(加算・脈動)= 目を引く
    g.save(); g.globalCompositeOperation="lighter";
    const aR=Math.max(0,r*1.9);
    const ag=g.createRadialGradient(0,0,Math.max(0,r*0.3),0,0,aR);
    ag.addColorStop(0,"hsla("+h+",95%,65%,"+(0.5*pul)+")");
    ag.addColorStop(1,"hsla("+h+",95%,65%,0)");
    g.fillStyle=ag; g.beginPath(); g.arc(0,0,aR,0,TAU); g.fill(); g.restore();
    // 本体(虹の帯)
    const grd=g.createLinearGradient(-r,-r,r,r);
    for(let k=0;k<=6;k++) grd.addColorStop(k/6,"hsl("+((h+k*60)%360)+",90%,60%)");
    g.fillStyle=grd; rockBodyPath(r,shape); g.fill();
    g.strokeStyle="rgba(255,255,255,.75)"; g.lineWidth=2; g.stroke();
    g.fillStyle="rgba(255,255,255,.55)"; g.beginPath();
    g.moveTo(-r*0.3,-r*0.6); g.lineTo(r*0.05,-r*0.2); g.lineTo(-r*0.15,r*0.2); g.closePath(); g.fill();
  }
  // ② ラッキー命中の 4方向の星のキラッ
  function drawTwinkle(x,y,r){ if(r<=0) return;
    g.beginPath();
    g.moveTo(x,y-r); g.lineTo(x+r*0.28,y-r*0.28); g.lineTo(x+r,y);
    g.lineTo(x+r*0.28,y+r*0.28); g.lineTo(x,y+r); g.lineTo(x-r*0.28,y+r*0.28);
    g.lineTo(x-r,y); g.lineTo(x-r*0.28,y-r*0.28); g.closePath(); g.fill();
  }
  function drawHut(o){const r=o.r;
    // 画像おうち(hut.png)は2回生成しても単体物にならず(庭+木+道の情景が写り込む)未使用。手描きのまま。
    // little wooden hut
    g.fillStyle="#7a4a26"; g.fillRect(-r*0.7,-r*0.2,r*1.4,r*0.9);
    g.fillStyle="#5a3418"; g.fillRect(-r*0.7,-r*0.2,r*1.4,r*0.16);
    // plank lines
    g.strokeStyle="rgba(0,0,0,.3)"; g.lineWidth=1.5;
    for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(i*r*0.35,-r*0.2);g.lineTo(i*r*0.35,r*0.7);g.stroke();}
    // door
    g.fillStyle="#3a2210"; g.fillRect(-r*0.18,r*0.18,r*0.36,r*0.52);
    // roof
    g.fillStyle="#a85a2a"; g.beginPath();
    g.moveTo(-r*0.95,-r*0.18); g.lineTo(0,-r*1.0); g.lineTo(r*0.95,-r*0.18); g.closePath(); g.fill();
    g.strokeStyle="rgba(255,180,90,.4)"; g.lineWidth=2; g.stroke();
    if(o.hp<2){ // cracked once
      g.strokeStyle="rgba(20,10,8,.7)"; g.lineWidth=2; g.lineCap="round";
      g.beginPath(); g.moveTo(-r*0.2,-r*0.1); g.lineTo(r*0.05,r*0.2); g.lineTo(-r*0.1,r*0.5); g.stroke();
    }
  }
  function drawCrystal(o){const r=o.r,pul=0.5+0.5*Math.sin(tsec*4+o.wob);
    g.save(); g.globalCompositeOperation="lighter";
    const ag=g.createRadialGradient(0,0,0,0,0,r*1.8);
    ag.addColorStop(0,"rgba(220,150,255,"+(0.5*pul)+")"); ag.addColorStop(1,"rgba(220,150,255,0)");
    g.fillStyle=ag; g.beginPath(); g.arc(0,0,r*1.8,0,TAU); g.fill(); g.restore();
    const grd=g.createLinearGradient(0,-r,0,r);
    grd.addColorStop(0,"#f0c8ff"); grd.addColorStop(0.5,"#c78bff"); grd.addColorStop(1,"#7a3fb8");
    g.fillStyle=grd; g.beginPath();
    g.moveTo(0,-r*1.1); g.lineTo(r*0.7,-r*0.2); g.lineTo(r*0.4,r); g.lineTo(-r*0.4,r); g.lineTo(-r*0.7,-r*0.2); g.closePath();
    g.fill();
    g.strokeStyle="rgba(255,255,255,.6)"; g.lineWidth=2; g.stroke();
    g.fillStyle="rgba(255,255,255,.5)"; g.beginPath();
    g.moveTo(0,-r*0.9); g.lineTo(r*0.2,-r*0.1); g.lineTo(-r*0.1,r*0.6); g.closePath(); g.fill();
  }
  function drawBall(){
    const b=ball,r=b.r;
    g.save(); g.translate(b.x,b.y);
    // squash a bit horizontally while rolling fast
    const sq=b.rolling?1+clamp(b.vx*0.01,0,0.18):1;
    // shadow on slope
    g.fillStyle="rgba(0,0,0,.3)"; g.beginPath();
    g.ellipse(0,r*0.95,r*0.95,r*0.28,0,0,TAU); g.fill();
    // heat aura (grows with eaten)
    g.save(); g.globalCompositeOperation="lighter";
    const aR=r*(1.7+0.5*b.heat), pul=0.6+0.4*Math.sin(tsec*5);
    const aur=g.createRadialGradient(0,0,r*0.4,0,0,aR);
    aur.addColorStop(0,"rgba(255,200,80,"+(0.5*pul)+")");
    aur.addColorStop(0.5,"rgba(255,90,30,"+(0.2*pul)+")");
    aur.addColorStop(1,"rgba(255,90,30,0)");
    g.fillStyle=aur; g.beginPath(); g.arc(0,0,aR,0,TAU); g.fill(); g.restore();
    // molten body (hotter -> brighter core)
    g.rotate(b.spin*0.1);
    g.scale(sq,1/Math.sqrt(sq));
    const hot=0.4+0.6*b.heat;
    // 画像ボール(ball.png)は2回生成しても顔が出て単体物にならなかったため未使用。手描きのまま。
    const grd=g.createRadialGradient(-r*0.3,-r*0.3,Math.max(0,r*0.1),0,0,Math.max(0,r));
    grd.addColorStop(0,"#fff6c0");
    grd.addColorStop(0.4,"hsl("+(40-20*hot)+",100%,"+(55+10*hot)+"%)");
    grd.addColorStop(0.8,"#e8430f"); grd.addColorStop(1,"#8a1a06");
    g.fillStyle=grd; g.beginPath(); g.arc(0,0,r,0,TAU); g.fill();
    // crusty dark patches that swirl with spin
    g.fillStyle="rgba(40,16,10,.55)";
    for(let i=0;i<4;i++){const a=i*TAU/4+b.spin*0.1;
      g.beginPath(); g.arc(Math.cos(a)*r*0.5,Math.sin(a)*r*0.5,r*0.22,0,TAU); g.fill();}
    // glowing cracks between crust
    g.save(); g.globalCompositeOperation="lighter"; g.strokeStyle="rgba(255,200,60,.7)"; g.lineWidth=2;
    for(let i=0;i<4;i++){const a=i*TAU/4+b.spin*0.1+0.4;
      g.beginPath(); g.moveTo(0,0); g.lineTo(Math.cos(a)*r,Math.sin(a)*r); g.stroke();}
    g.restore();
    // rim
    g.strokeStyle="rgba(255,150,60,.6)"; g.lineWidth=2; g.beginPath(); g.arc(0,0,r,0,TAU); g.stroke();
    // cute face (determined when rolling)
    g.scale(Math.sqrt(sq),Math.sqrt(sq)); // unskew face a bit
    const ex=r*0.34,ey=-r*0.05,er=r*0.15;
    g.fillStyle="#2a0c06";
    if(b.rolling){
      g.lineWidth=Math.max(2,r*0.09); g.strokeStyle="#2a0c06"; g.lineCap="round";
      g.beginPath(); g.moveTo(-ex-er*0.7,ey-er*0.4); g.lineTo(-ex+er*0.7,ey+er*0.4); g.stroke();
      g.beginPath(); g.moveTo(ex+er*0.7,ey-er*0.4); g.lineTo(ex-er*0.7,ey+er*0.4); g.stroke();
    } else {
      g.beginPath(); g.arc(-ex,ey,er,0,TAU); g.arc(ex,ey,er,0,TAU); g.fill();
      g.fillStyle="#fff"; g.beginPath(); g.arc(-ex+er*0.3,ey-er*0.3,er*0.4,0,TAU);
      g.arc(ex+er*0.3,ey-er*0.3,er*0.4,0,TAU); g.fill();
    }
    g.fillStyle="#2a0c06"; g.lineWidth=Math.max(2,r*0.08); g.strokeStyle="#2a0c06";
    if(b.rolling){ g.beginPath(); g.ellipse(0,r*0.42,r*0.16,r*0.14,0,0,TAU); g.fill(); }
    else { g.beginPath(); g.arc(0,r*0.28,r*0.18,0.15*Math.PI,0.85*Math.PI); g.stroke(); }
    g.restore();
  }
  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.05;
    g.save(); g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff"; g.shadowColor="rgba(0,0,0,.55)"; g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,0,0,.4)"; roundRect(bx,by,bw,bh,bh/2); g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#ff8c42"); gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg; roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2); g.fill();}
    g.strokeStyle="rgba(255,255,255,.5)"; g.lineWidth=2; roundRect(bx,by,bw,bh,bh/2); g.stroke();
    g.restore(); g.textAlign="left";
    // bottom hint
    g.save(); g.textAlign="center"; g.globalAlpha=0.6+0.3*Math.sin(tsec*3);
    g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#fff5d6";
    if(!ball.rolling) g.fillText("タップで ころがそう！",api.W/2,api.H-22);
    g.restore(); g.globalAlpha=1; g.textAlign="left";
  }
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
}
Engine.register("lavaball", buildLavaball);
