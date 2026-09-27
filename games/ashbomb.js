function build_ashbomb(api){
  const g=api.g;
  api.preload(["bg.jpg","gold.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。rockは生成が単体物にならず不採用(手描き継続)
  let bombs=[],shards=[],sparks=[],rings=[],embers=[],smoke=[],floats=[],lavabubs=[];
  let groundY,R,spawnT,tsec=0,count=0,combo=0,comboT=0,flash=0,heat=0;
  // stage progression: clear a quota of bombs -> "ステージ クリア!" -> endless harder
  let stage=1,stageKill=0,stageGoal=8,clearT=0,clearStage=0,quakeT=0;
  // fever eruption + gold bomb + next-stage hint
  let fever=0,feverGauge=0,feverBanner=0,hsCd=0,hintTxt="";
  const TC=["#ffd23f","#ff8a3a","#ff5b3a","#ffb347","#ff6a3a"];
  const TCNAME=["きいろ","オレンジ","あか","やまぶき","だいだい"];
  const RAINBOW=["#ff5b5b","#ffd23f","#4db8ff","#7be08a","#ff7bd0","#b58bff"];
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  let luckyColor=pick(TC),luckySeen=false,luckyMsgT=0;   // ② きょうのラッキー色: 秘密の1色
  let rbMsgT=0;                                          // ① にじいろ ばくだん 発見バナー
  let stageMiss=0,noMissT=0;                             // ③ ノーミス判定(このステージの取りこぼし数)
  let shoots=[],shootT=rint(160,340);                    // ④ ながれ星 ひみつ
  let missStreak=0;                                      // ハズレ連打の音を間引くカウンタ
  let dryT=0;                                            // ① 最後に得点してからの秒数(無反応が続くほど「当てやすさ」を上げる救済)
  function stageGoalFor(s){return 10+(s-1)*3;}   // 10,13,16,...（7〜8歳向けに手応えを増やした）
  function layout(){
    groundY=api.H*0.86;
    R=clamp(Math.min(api.W,api.H)*0.06,22,46);
    // lava bubbles along the crater glow line
    lavabubs=[];for(let i=0;i<10;i++)lavabubs.push({
      x:api.W*((i+0.5)/10)+rnd(-api.W*0.03,api.W*0.03),ph:rnd(0,TAU),
      sp:rnd(0.03,0.08),r:rnd(R*0.2,R*0.45)});
  }
  layout();
  function craterX(){return api.W/2;}
  function craterY(){return api.H*0.94;}
  function spawn(){
    // ① 長く無反応なら同時に飛ぶ岩の上限も少し増やす(画面が寂しくならないように)
    const cap=fever>0?14:(dryT>3?12:10);
    if(bombs.length>=cap)return;
    const cx=craterX(),cy=craterY();
    // launch from crater up into the air, arcs back down (gravity)
    const peak=clamp(api.H*(0.18+rnd(0,0.16))-(stage*4),api.H*0.1,api.H*0.5);
    const vy=-Math.sqrt(2*0.26*(cy-peak));   // velocity to reach peak height
    const vx=rnd(-api.W*0.012,api.W*0.012);
    const big=stage>=2&&fever<=0&&Math.random()<0.28;  // tougher 2-tap molten boulder（少し多め）
    // ① 激レア にじいろばくだん: stage2以降 ごくまれ(約3%)。虹色に光り 撃つと大量得点+虹演出。
    const rainbow=!big&&stage>=2&&Math.random()<0.03;
    // rare gold nugget: big points + rainbow burst. more common during fever
    const gold=!big&&!rainbow&&Math.random()<(fever>0?0.16:0.08);
    const baseCol=pick(TC);   // ② ラッキー色判定用に本来の色を覚えておく(でかいわは被弾で色が変わるため)
    // ⑤ 軸7(バラエティ): 岩ごとに輪郭/壊れ方が違う形状バリアントを持たせる(色替え以外の見た目差)
    const shape=pick(["blob","ball","pillar","stack"]);
    // 軸7: 形状ごとにサイズ係数を変えて「大きい/小さい」の対比を作る(gold/big/rainbowの特別サイズは維持)
    const shapeMul=shape==="ball"?0.75:shape==="pillar"?1.15:shape==="stack"?1.05:1;
    // 軸3(b): ステージ1だけ的をひとまわり大きくして最初の数秒を当てやすくする(stage2以降は元のRに戻り歯ごたえは変えない)
    const R1=stage===1?R*1.12:R;
    bombs.push({x:cx+rnd(-R1,R1),y:cy,vx,vy,r:gold?R1*1.15:big?R1*1.3:rainbow?R1*1.2:R1*shapeMul,big,gold,rainbow,hp:big?2:1,
      rot:rnd(0,TAU),vr:rnd(-0.12,0.12),spin:rnd(0,TAU),baseCol,shape,
      col:gold?"#ffd23f":rainbow?"#ff5b5b":baseCol,trail:0,dead:false,landed:false});
    api.slide(160,420,0.18,0.16,"sawtooth");
    api.noise(0.12,0.12,500,"lowpass",0.8);
    if(gold){api.tone(1318,0.12,"triangle",0.12);api.tone(1760,0.16,"triangle",0.1);}
    if(rainbow){ // 接近ドキドキ: にじいろが飛び立つ瞬間 クレーターから虹の火花(気づける予告)
      api.tone(988,0.1,"triangle",0.1);api.tone(1319,0.12,"triangle",0.09);
      for(let i=0;i<10;i++){const a=rnd(0,TAU),s=rnd(3,8);
        sparks.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:-Math.abs(Math.sin(a)*s)-2,
          len:rnd(8,18),life:1,decay:rnd(0.02,0.04),col:pick(RAINBOW)});}}
  }
  spawnT=20;
  function blast(b,px,py){
    dryT=0;   // ① 得点したので無反応タイマーをリセット
    const high=clamp((groundY-b.y)/groundY,0,1);          // 0 ground .. 1 top
    const tier=high>0.62?3:high>0.36?2:1;                  // higher = more points
    let gain=tier*(b.big?2:1);
    if(b.gold)gain=tier*5;                                 // gold nugget = jackpot
    if(b.rainbow)gain=tier*8;                              // ① にじいろ = 特大ジャックポット
    // ② きょうのラッキー色: 今日の秘密の色の いわを こわすと +2 の隠しボーナス(気づくと得)
    const isLucky=!b.gold&&!b.rainbow&&b.baseCol===luckyColor;
    if(isLucky)gain+=2;
    if(fever>0)gain*=2;                                    // fever doubles everything
    count+=gain;stageKill++;api.setScore(count);
    combo++;comboT=1.0;
    // fever gauge fills from blasts (gold gives a big chunk)
    if(fever<=0){feverGauge=Math.min(1,feverGauge+(b.gold?0.3:0.09+tier*0.02));
      if(feverGauge>=1)startFever();}
    // juice scales with height + combo
    flash=Math.min(1,flash+0.3+tier*0.12);
    heat=Math.min(1,heat+0.2);
    api.boom(0.35+tier*0.12);
    api.slide(420-tier*40,90,0.18,0.32,"square");
    api.noise(0.16,0.22,1600+tier*400,"bandpass",0.9);
    api.tone(440*Math.pow(2,clamp(combo,0,12)/12),0.12,"triangle",0.12);
    api.shake(5+tier*2+Math.min(combo,6));
    // hitStop only for top-tier / gold hits, with a 30-frame cooldown
    if((tier>=3||b.gold)&&hsCd<=0){api.hitStop(4);hsCd=30;}
    // shockwave rings
    rings.push({x:px,y:py,r:b.r*0.5,vr:b.r*0.7,life:1,decay:0.05,col:"#fff7c2"});
    rings.push({x:px,y:py,r:b.r*0.2,vr:b.r*0.5,life:1,decay:0.045,col:b.col});
    // glowing rock shards (gold explodes into rainbow)
    // ⑤ 軸7: 形状ごとに壊れ方(粉砕/しぶき/へこむ+倒れる)を変える
    const shardKind=b.shape==="ball"?"circle":b.shape==="pillar"?"shard":"rect";
    const n=(b.big?16:11)+Math.min(combo,6);
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(3,9);
      shards.push({x:px,y:py,vx:Math.cos(a)*s+b.vx*0.4,vy:Math.sin(a)*s-rnd(1,4),
        s:rnd(b.r*0.16,b.r*0.4),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),
        life:1,decay:rnd(0.01,0.02),kind:shardKind,
        col:(b.gold||b.rainbow)?pick(RAINBOW):i%3===0?"#3a2218":b.col});}
    if(b.shape==="pillar"){
      // 黒曜石柱: 真っ二つに割れて左右にたおれる大きな破片を追加
      for(const dir of[-1,1])shards.push({x:px,y:py,vx:dir*rnd(2,4),vy:-rnd(1,2.5),
        s:Math.max(4,b.r*0.9),rot:dir*0.25,vr:dir*rnd(0.12,0.22),life:1,decay:0.014,
        kind:"half",col:(b.gold||b.rainbow)?pick(RAINBOW):b.col});
    }else if(b.shape==="ball"){
      // 丸い溶岩玉: 潰れてつぶれた跡がその場に残る
      shards.push({x:px,y:py,vx:0,vy:0.3,s:Math.max(4,b.r*1.1),rot:0,vr:0,
        life:1,decay:0.02,kind:"squash",col:(b.gold||b.rainbow)?pick(RAINBOW):b.col});
    }else if(b.shape==="stack"){
      // ⑤ 軸7: 積み岩(2〜3個重なった岩)は上の段ほど早く消えつつ順に崩れ落ちる(倒れる/砕けるとは違う崩落)
      const tiers=3;
      for(let k=0;k<tiers;k++){const sz=Math.max(4,b.r*(0.72-k*0.14));
        shards.push({x:px+rnd(-b.r*0.15,b.r*0.15),y:py-b.r*0.55+k*b.r*0.42,
          vx:rnd(-0.8,0.8),vy:-rnd(0.3,0.8)-(tiers-1-k)*0.35,
          s:sz,rot:rnd(-0.2,0.2),vr:rnd(-0.15,0.15),
          life:1,decay:0.009+k*0.006,kind:"block",
          col:(b.gold||b.rainbow)?pick(RAINBOW):b.col});}
    }
    if(b.gold){
      // fanfare + extra rainbow rings + big float
      [0,4,7,12].forEach((semi,i)=>setTimeout(()=>api.tone(880*Math.pow(2,semi/12),0.16,"triangle",0.12),i*70));
      rings.push({x:px,y:py,r:b.r*0.3,vr:b.r*0.9,life:1,decay:0.04,col:"#ffd23f"});
      rings.push({x:px,y:py,r:b.r*0.1,vr:b.r*0.6,life:1,decay:0.035,col:pick(RAINBOW)});
      floats.push({x:px,y:py-b.r*1.4,txt:"ゴールド！ +"+gain,life:1,vy:-1,col:"#ffd23f",size:32});
    }
    // ① にじいろ撃破: 虹の輪が5色ぶわっと + ファンファーレ + 大量得点(激レアの爽快ごほうび)
    if(b.rainbow){
      rbMsgT=1.5;flash=Math.min(1,flash+0.32);
      if(hsCd<=0){api.hitStop(5);hsCd=30;}
      api.boom(0.6);api.shake(16);
      [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(880*Math.pow(2,semi/12),0.16,"triangle",0.12),i*60));
      for(let k=0;k<RAINBOW.length;k++)rings.push({x:px,y:py,r:Math.max(2,b.r*0.3),vr:b.r*(0.6+k*0.16),life:1,decay:0.045,col:RAINBOW[k]});
      for(let i=0;i<24;i++){const a=rnd(0,TAU),s=rnd(3,10);
        sparks.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,len:rnd(10,22),
          life:1,decay:rnd(0.02,0.04),col:RAINBOW[i%RAINBOW.length]});}
      floats.push({x:px,y:py-b.r*1.5,txt:"にじいろ！ +"+gain,life:1,vy:-1,col:"#ff7bd0",size:34});
    }
    // ② ラッキー色命中: 小さめの祝福(白飛びしないよう控えめ)+頭上に星のキラッ
    if(isLucky){
      if(!luckySeen){luckyMsgT=1.6;luckySeen=true;}
      api.tone(1046,0.14,"triangle",0.11);api.tone(1568,0.16,"triangle",0.08);
      floats.push({x:px,y:py-b.r*1.3,txt:"ラッキー！",life:1,vy:-1,col:luckyColor,size:26});
      for(let i=0;i<7;i++){const a=rnd(-Math.PI,0),s=rnd(2,6);
        sparks.push({x:px,y:py-b.r*0.5,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,len:rnd(6,12),
          life:1,decay:rnd(0.03,0.05),col:luckyColor});}
    }
    // bright sparks
    for(let i=0;i<rint(8,12);i++){const a=rnd(0,TAU),s=rnd(4,12);
      sparks.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,len:rnd(8,20),
        life:1,decay:rnd(0.04,0.08),col:i%2?"#ffd23f":"#fff"});}
    // smoke puff
    for(let i=0;i<rint(3,5);i++)smoke.push({x:px+rnd(-8,8),y:py+rnd(-8,8),
      r:rnd(b.r*0.4,b.r*0.8),vr:rnd(0.5,1.2),vy:rnd(-0.6,-1.4),
      life:1,decay:rnd(0.01,0.018)});
    // height bonus float
    if(tier>=2)floats.push({x:px,y:py-b.r,txt:tier>=3?"たかい！ x"+gain:"+"+gain,
      life:1,vy:-1.1,col:tier>=3?"#ff3b3b":"#ffd23f",size:tier>=3?34:26});
    if(combo>1&&combo%5===0)floats.push({x:api.W/2,y:api.H*0.22,txt:"コンボ x"+combo,
      life:1,vy:-0.6,col:"#ffe14a",size:30});
    checkStage();
  }
  function landMiss(b){
    // hit the ground before tapped: no game over, just a dull thud + dust, combo resets
    b.dead=true;combo=0;comboT=0;stageMiss++;   // ③ ノーミス判定: 取りこぼしを記録
    api.noise(0.22,0.22,260,"lowpass",0.7);api.slide(180,70,0.2,0.16,"sine");api.shake(5);
    const px=b.x,py=groundY;
    rings.push({x:px,y:py,r:b.r*0.4,vr:b.r*0.5,life:1,decay:0.05,col:"#6a4a30"});
    for(let i=0;i<8;i++){const a=rnd(-Math.PI,0),s=rnd(2,5);
      shards.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s,s:rnd(b.r*0.14,b.r*0.3),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.014,0.024),col:"#4a3526"});}
    for(let i=0;i<4;i++)smoke.push({x:px+rnd(-12,12),y:py,r:rnd(b.r*0.5,b.r*0.9),
      vr:rnd(0.6,1.3),vy:rnd(-0.4,-1),life:1,decay:rnd(0.012,0.02)});
  }
  function startFever(){
    feverGauge=0;fever=10;feverBanner=1.8;quakeT=0.8;flash=1;
    api.boom(0.8);api.shake(20);
    api.slide(220,880,0.5,0.3,"sawtooth");
    [0,4,7,12].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.18,"triangle",0.13),i*80));
    for(const b of bombs)b.hp=1;   // everything breaks in one tap during fever
    const cx=craterX(),cy=craterY();
    for(let i=0;i<24;i++){const a=rnd(0,TAU),s=rnd(3,10);
      sparks.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:-Math.abs(Math.sin(a)*s)-3,
        len:rnd(10,24),life:1,decay:rnd(0.01,0.02),col:pick(RAINBOW)});}
  }
  function hintFor(s){
    if(s===2)return"でっかい いわが とんでくる！";
    const h=["いわが もっと はやくなる！","きんいろの いわを さがせ！",
      "ゲージを ためて だいふんか！","たかい ところで こわすと おおもり！"];
    return h[(s-3)%h.length];
  }
  function checkStage(){
    if(stageKill<stageGoal||clearT>0)return;
    hintTxt=hintFor(stage+1);
    clearStage=stage;clearT=1.9;quakeT=0.6;flash=Math.min(1,flash+0.5);
    api.boom(0.6);api.shake(16);
    api.slide(523,880,0.35,0.22,"triangle");
    api.tone(659,0.25,"triangle",0.14);api.tone(988,0.3,"triangle",0.1);
    for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
      sparks.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,
        len:rnd(10,22),life:1,decay:rnd(0.012,0.02),col:pick(TC)});}
    // ③ ノーミス ボーナス: このステージで いわを 1つも 落とさなかったら +3 & みどりの星シャワー
    if(stageMiss===0){count+=3;api.setScore(count);noMissT=1.9;
      api.tone(1318,0.16,"triangle",0.12);api.tone(1976,0.18,"triangle",0.09);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(3,8);
        sparks.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,
          len:rnd(8,18),life:1,decay:rnd(0.015,0.025),col:"#7be08a"});}}
    stageMiss=0;
    stage++;stageGoal=stageGoalFor(stage);stageKill=0;
  }
  return{
    resize:layout,
    input(px,py,type){
      if(type!=="down"||clearT>0)return;
      // ① 無反応が長いほど当たり判定を広げる「救済」(通常時は狙いが要る低学年向け難度を保つ)
      // 軸3(b)対策: 無反応0秒目から緩やかに当たり判定を広げる(1秒待たずに効き始め、firstScoreSecの遅いテールを縮める)。
      // すぐ当たっている試行はdryTが小さいままなのでassistもほぼ0→scorePerTap(軸3a)は悪化しない。
      const assist=clamp(dryT*0.12,0,0.55);
      for(let i=bombs.length-1;i>=0;i--){const b=bombs[i];
        if(b.dead)continue;
        if(Math.hypot(px-b.x,py-b.y)<b.r*(1.45+assist)){
          if(b.big&&b.hp>1){
            b.hp--;b.col="#ff8a3a";flash=Math.min(1,flash+0.18);
            api.noise(0.08,0.16,1800,"highpass",0.9);api.tone(300,0.08,"square",0.12);
            api.shake(4);
            for(let k=0;k<6;k++){const a=rnd(0,TAU),s=rnd(2,6);
              sparks.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(6,12),
                life:1,decay:0.07,col:"#ffd23f"});}
            return;
          }
          missStreak=0;b.dead=true;blast(b,b.x,b.y);return;
        }
      }
      // ④ ながれ星 ひみつタップ: 流れ星に当たったら コインがこぼれる(減点なし・ボムより後判定)
      for(let i=shoots.length-1;i>=0;i--){const st=shoots[i];
        if(st.life>0&&Math.hypot(px-st.x,py-st.y)<Math.max(30,R)){
          missStreak=0;dryT=0;st.life=0;count+=1;api.setScore(count);
          api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.08);
          for(let k=0;k<10;k++){const a=rnd(-Math.PI,0),s=rnd(2,6);
            sparks.push({x:st.x,y:st.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(6,14),
              life:1,decay:rnd(0.03,0.05),col:k%2?"#ffd23f":"#fff7d6"});}
          floats.push({x:st.x,y:st.y-R*0.6,txt:"ながれ星！ +1",life:1,vy:-1,col:"#fff7d6",size:24});
          return;
        }}
      // missed tap: small spark where you touched(連続ハズレは音を間引いてうるさくしない)
      missStreak++;
      if(missStreak<=1||missStreak%2===0)api.tone(240,0.05,"square",0.05);
      for(let k=0;k<5;k++){const a=rnd(0,TAU),s=rnd(2,5);
        sparks.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(5,10),
          life:1,decay:0.08,col:"#ffb347"});}
    },
    frame(dt,now){
      tsec+=0.016*dt;dryT+=0.016*dt;
      if(quakeT>0){quakeT-=0.016*dt;api.shake(2);}
      if(hsCd>0)hsCd-=dt;
      // fever countdown + end chime
      if(fever>0){fever-=0.016*dt;
        if(fever<=0){fever=0;
          api.tone(523,0.2,"triangle",0.12);api.tone(392,0.28,"triangle",0.1);
          floats.push({x:api.W/2,y:api.H*0.3,txt:"ふんか おわり！",life:1,vy:-0.5,col:"#fff",size:26});}}
      // ---- background: volcanic dusk sky ----
      // 画像背景があればそれを使い、絵と喧嘩する平坦な手描き(空グラデ・太陽・遠景の山・山体)はスキップ
      const imgBg=api.drawCover("bg.jpg");
      if(!imgBg){
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,"#2a0a2e");grd.addColorStop(0.32,"#5e1530");
        grd.addColorStop(0.58,"#a8341f");grd.addColorStop(0.8,"#e0631f");
        grd.addColorStop(1,"#ffb347");
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
        // smoldering sun low on the horizon
        const sx=api.W*0.5,sy=api.H*0.74;
        let sun=g.createRadialGradient(sx,sy,0,sx,sy,Math.max(1,api.W*0.55));
        sun.addColorStop(0,"rgba(255,220,120,.5)");sun.addColorStop(0.3,"rgba(255,140,50,.22)");
        sun.addColorStop(1,"rgba(255,120,40,0)");
        g.fillStyle=sun;g.fillRect(0,0,api.W,api.H);
        // distant volcanic peaks silhouette
        g.fillStyle="rgba(40,12,28,.7)";
        g.beginPath();g.moveTo(0,groundY);
        g.lineTo(api.W*0.18,api.H*0.6);g.lineTo(api.W*0.32,groundY);
        g.lineTo(api.W*0.62,api.H*0.55);g.lineTo(api.W*0.86,groundY);
        g.lineTo(api.W,api.H*0.64);g.lineTo(api.W,api.H);g.lineTo(0,api.H);g.closePath();g.fill();
      }
      // heat shimmer band near horizon (cheap sine wobble)
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.06;
      for(let i=0;i<3;i++){const yy=api.H*0.7+i*api.H*0.04+Math.sin(tsec*2+i)*4;
        g.strokeStyle="#ffce6a";g.lineWidth=10;g.beginPath();
        for(let x=0;x<=api.W;x+=20)g.lineTo(x,yy+Math.sin(x*0.02+tsec*3+i)*5);g.stroke();}
      g.restore();g.globalAlpha=1;
      // ---- fever: whole sky burns gold-red (background transforms) ----
      if(fever>0){g.save();g.globalCompositeOperation="lighter";
        g.globalAlpha=0.13+0.07*Math.sin(tsec*6);
        let fg=g.createLinearGradient(0,0,0,api.H);
        fg.addColorStop(0,"#ff3b3b");fg.addColorStop(1,"#ffd23f");
        g.fillStyle=fg;g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      // ---- the volcano mountain ----
      const cx=craterX(),cy=craterY();
      if(!imgBg){   // 手描き山体(画像時は絵の地面を活かし、火口の光と口だけ残す)
        let mg=g.createLinearGradient(0,groundY,0,api.H);
        mg.addColorStop(0,"#3a1410");mg.addColorStop(1,"#1c0808");
        g.fillStyle=mg;
        g.beginPath();g.moveTo(0,api.H);
        g.lineTo(api.W*0.16,groundY+api.H*0.04);
        g.lineTo(cx-R*1.8,groundY-api.H*0.02);
        g.lineTo(cx+R*1.8,groundY-api.H*0.02);
        g.lineTo(api.W*0.84,groundY+api.H*0.04);
        g.lineTo(api.W,api.H);g.closePath();g.fill();
      } else {      // 画像時: 火口まわりだけ岩の盛り上がりを薄く描いて、口が地面に馴染むようにする
        g.fillStyle="rgba(30,10,8,.55)";g.beginPath();
        g.ellipse(cx,cy+R*0.2,Math.max(1,R*2.6),Math.max(1,R*1.0),0,0,TAU);g.fill();
      }
      // glowing crater mouth
      let cg=g.createRadialGradient(cx,cy,0,cx,cy,R*3);
      cg.addColorStop(0,"rgba(255,240,150,.9)");cg.addColorStop(0.4,"rgba(255,120,40,.5)");
      cg.addColorStop(1,"rgba(255,80,30,0)");
      g.save();g.globalCompositeOperation="lighter";g.fillStyle=cg;
      g.fillRect(cx-R*3,cy-R*3,R*6,R*3.4);g.restore();
      g.fillStyle="#ff7a2a";g.beginPath();g.ellipse(cx,cy,R*1.7,R*0.6,0,0,TAU);g.fill();
      g.fillStyle="#ffd23f";g.beginPath();g.ellipse(cx,cy,R*1.0,R*0.34,0,0,TAU);g.fill();
      // bubbling lava blobs in the crater
      g.save();g.globalCompositeOperation="lighter";
      for(const lb of lavabubs){lb.ph+=lb.sp*dt;
        const by=cy-Math.abs(Math.sin(lb.ph))*R*0.4,ba=0.4+0.4*Math.abs(Math.sin(lb.ph));
        g.globalAlpha=ba;g.fillStyle="#ffce6a";
        g.beginPath();g.arc(lb.x,by,lb.r*(0.6+0.4*Math.abs(Math.sin(lb.ph))),0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      // ---- spawn embers rising from crater (crater boils over during fever) ----
      if(embers.length<(fever>0?64:48)&&Math.random()<(fever>0?0.9:0.5))embers.push({
        x:cx+rnd(-R*1.5,R*1.5),y:cy,vy:-rnd(0.6,2.2),vx:rnd(-0.4,0.4),
        r:rnd(1,3),life:1,decay:rnd(0.006,0.014),tw:rnd(0,TAU)});
      g.save();g.globalCompositeOperation="lighter";
      for(const e of embers){e.y+=e.vy*dt;e.x+=e.vx*dt;e.vy*=0.995;e.tw+=0.1*dt;e.life-=e.decay*dt;
        const a=Math.max(0,e.life)*(0.6+0.4*Math.sin(e.tw));
        g.globalAlpha=a;g.fillStyle=e.r>2?"#ffd23f":"#ff7a3a";g.shadowBlur=8;g.shadowColor="#ff8a3a";
        g.beginPath();g.arc(e.x,e.y,e.r,0,TAU);g.fill();}
      g.shadowBlur=0;g.restore();g.globalAlpha=1;
      embers=embers.filter(e=>e.life>0&&e.y>-10);
      // ---- ④ ながれ星(ひみつ): ときどき 空を すーっと流れる。撃つと コイン(減点なし) ----
      shootT-=dt;
      if(shootT<=0&&shoots.length<2){shootT=rint(220,460);
        const fromL=Math.random()<0.5,y0=rnd(api.H*0.08,api.H*0.3);
        shoots.push({x:fromL?-20:api.W+20,y:y0,vx:(fromL?1:-1)*rnd(3.2,4.6),vy:rnd(0.5,1.3),life:1});}
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const st of shoots){st.x+=st.vx*dt;st.y+=st.vy*dt;st.life-=0.006*dt;
        g.globalAlpha=Math.max(0,st.life)*0.9;
        g.strokeStyle="#fff7d6";g.lineWidth=2.5;g.shadowColor="#ffe98a";g.shadowBlur=8;
        g.beginPath();g.moveTo(st.x,st.y);g.lineTo(st.x-st.vx*4,st.y-st.vy*4);g.stroke();
        g.fillStyle="#fffbe0";g.beginPath();g.arc(st.x,st.y,2.4,0,TAU);g.fill();}
      g.shadowBlur=0;g.restore();g.globalAlpha=1;
      shoots=shoots.filter(st=>st.life>0&&st.x>-40&&st.x<api.W+40&&st.y<api.H*0.6);
      // ---- spawn flying bombs ----
      const paused=clearT>0;
      if(!paused){spawnT-=dt;if(spawnT<=0){spawn();
        // ① 出現間隔を少し縮め、さらに無反応が続くほど早く追加する(軸1・軸3の待たされ対策)
        const baseSpawn=clamp(42-(stage-1)*4,20,42);
        // 軸1/軸3(b): 開始直後(dryT=0)から前倒しで効かせ、2本目以降の岩を早く出して最初の成功を早める
        const dryBoost=clamp(dryT*20,0,40);
        // 軸3(b): ゲーム開始直後(tsec<2)だけ2本目の岩をすぐ足し、画面に岩が2つ以上ある時間を増やす
        // (ランダムタップでも早く当たりやすくして firstScoreSec の遅いテールを縮める。開始直後限定なので歯ごたえは変えない)
        spawnT=fever>0?rint(10,16):(tsec<2?24:Math.max(16,baseSpawn-dryBoost));}}
      // ---- update + draw bombs ----
      for(const b of bombs){
        if(b.dead)continue;
        b.vy+=0.26*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.spin+=b.vr*dt;b.trail+=dt;
        if(b.y>=groundY&&b.vy>0){landMiss(b);continue;}
        // fire trail behind the rising/falling rock
        if(b.trail>1.5){b.trail=0;
          embers.push({x:b.x+rnd(-b.r*0.3,b.r*0.3),y:b.y+b.r*0.3,vy:rnd(0.2,0.8),
            vx:rnd(-0.3,0.3),r:rnd(1.5,3),life:1,decay:0.03,tw:rnd(0,TAU)});}
        drawBomb(b);
      }
      bombs=bombs.filter(b=>!b.dead);
      // ---- smoke ----
      for(const s of smoke){s.r+=s.vr*dt;s.y+=s.vy*dt;s.life-=s.decay*dt;
        g.globalAlpha=Math.max(0,s.life)*0.4;g.fillStyle="#3a2a28";
        g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();}
      g.globalAlpha=1;smoke=smoke.filter(s=>s.life>0);
      // ---- shockwave rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);
      // ---- rock shards ----
      for(const p of shards){p.vy+=0.42*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        if(p.kind==="circle"){   // 丸い溶岩玉の粒: しぶきは丸い玉のまま飛び散る
          g.fillStyle=p.col;g.beginPath();g.arc(0,0,Math.max(0,p.s/2),0,TAU);g.fill();
          g.fillStyle="rgba(255,200,90,.4)";g.beginPath();g.arc(-p.s*0.12,-p.s*0.12,Math.max(0,p.s*0.28),0,TAU);g.fill();
        }else if(p.kind==="shard"){   // 黒曜石柱のかけら: 細長い破片
          g.fillStyle=p.col;g.fillRect(-p.s*0.16,-p.s/2,p.s*0.32,p.s);
          g.fillStyle="rgba(255,200,90,.4)";g.fillRect(-p.s*0.16,-p.s/2,p.s*0.32,p.s*0.25);
        }else if(p.kind==="half"){   // 柱が真っ二つに割れて倒れる大きな半分
          g.fillStyle=p.col;g.fillRect(-p.s*0.2,-p.s*0.55,p.s*0.4,p.s*1.1);
          g.fillStyle="rgba(255,200,90,.35)";g.fillRect(-p.s*0.2,-p.s*0.55,p.s*0.4,p.s*0.3);
        }else if(p.kind==="squash"){   // 玉が潰れた跡
          g.fillStyle=p.col;g.beginPath();g.ellipse(0,0,Math.max(0,p.s*0.55),Math.max(0,p.s*0.2),0,0,TAU);g.fill();
        }else{
          g.fillStyle=p.col;g.fillRect(-p.s/2,-p.s/2,p.s,p.s);
          g.fillStyle="rgba(255,200,90,.4)";g.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.3);
        }
        g.restore();}
      g.globalAlpha=1;shards=shards.filter(p=>p.life>0&&p.y<api.H+40);
      if(shards.length>150)shards.splice(0,shards.length-150);   // fever safety cap
      // ---- bright sparks (additive) ----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vy+=0.15*dt;sp.vx*=0.94;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle=sp.col;g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;sparks=sparks.filter(sp=>sp.life>0);
      if(sparks.length>120)sparks.splice(0,sparks.length-120);   // fever safety cap
      // ---- floating texts ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.018*dt;
        g.globalAlpha=Math.max(0,f.life);g.textAlign="center";
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=6;g.strokeStyle="rgba(40,8,4,.6)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // ---- impact heat flash ----
      if(flash>0){flash-=0.05*dt;
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=Math.max(0,flash)*0.3;
        g.fillStyle="#ff8a3a";g.fillRect(0,0,api.W,api.H);g.restore();}
      if(heat>0)heat-=0.02*dt;
      // ---- combo text (top-center safe zone) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.14);g.scale(pop,pop);
        g.font="800 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(255,120,40,.9)";g.shadowBlur=14;
        g.fillStyle="#ffd23f";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.6)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // ---- ① にじいろ ばくだん！ 発見バナー(虹色に色替わり・上部中央=安全帯) ----
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.4,col=RAINBOW[Math.floor(tsec*6)%RAINBOW.length];
        g.save();g.translate(api.W/2,api.H*0.22);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle="#fff";g.fillText("にじいろ ばくだん！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろ ばくだん！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ---- ② きょうのラッキー色 はっけん！(初回だけ中央上に一度教える) ----
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.29);g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 23px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(TCNAME[TC.indexOf(luckyColor)]||"")+"！";
        g.shadowColor=luckyColor;g.shadowBlur=12;
        g.lineWidth=5;g.strokeStyle="rgba(40,8,4,.5)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ---- ③ ノーミス ボーナス！(クリア文字と重ねない下側) ----
      if(noMissT>0){noMissT-=0.014*dt;
        const pop=1+Math.max(0,noMissT-1.3)*1.4;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(noMissT*1.3,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=16;g.fillStyle="#c7ffcf";
        g.fillText("ノーミス ボーナス！",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(20,80,40,.7)";g.strokeText("ノーミス ボーナス！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(noMissT<0)noMissT=0;}
      // ---- HUD: stage + progress gauge (top-center) ----
      drawHUD();
      // ---- fever gauge / fever timer (bottom-center) ----
      drawFeverGauge();
      // ---- FEVER banner ----
      if(feverBanner>0){feverBanner-=0.016*dt;
        const a=clamp(feverBanner*1.4,0,1),pop=1+Math.max(0,feverBanner-1.4)*2;
        g.save();g.translate(api.W/2,api.H*0.38);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,80,30,.95)";g.shadowBlur=26;g.fillStyle="#ffd23f";
        g.fillText("だいふんか タイム！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";
        g.strokeText("だいふんか タイム！",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("てんすう 2ばい！ ぜんぶ 1かいで こわせる！",0,38);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // ---- STAGE CLEAR banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.45;g.fillStyle="#1a0408";
        g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.4)*1.8;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,150,40,.9)";g.shadowBlur=22;g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";
        g.strokeText("ステージ"+clearStage+" クリア！",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("つぎは ステージ"+(clearStage+1)+"！",0,42);
        // next-stage teaser (a peek at what's coming keeps them playing)
        g.font="800 20px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#ffe14a";
        g.fillText("つぎは… "+hintTxt,0,74);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=18;}
      }
      // 加算合成を確実に元へ(白飛び漏れ防止): このフレームの発光描画をここで締める
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
    },
    stop(){}
  };
  function drawBomb(b){
    g.save();g.translate(b.x,b.y);g.rotate(b.spin);
    const r=(b.gold||b.rainbow)?b.r*(1+0.07*Math.sin(tsec*8)):b.r;   // gold/rainbow pulse to catch the eye
    const rbc=b.rainbow?RAINBOW[Math.floor(tsec*6)%RAINBOW.length]:null;  // にじいろ: 時間で色替わり
    // outer heat aura (additive) — gold shines yellow-white, rainbow shines pink-white
    g.save();g.globalCompositeOperation="lighter";
    const au=g.createRadialGradient(0,0,Math.max(1,r*0.3),0,0,Math.max(2,r*1.8));
    if(b.rainbow){au.addColorStop(0,"rgba(255,255,255,.7)");au.addColorStop(0.5,"rgba(255,180,220,.28)");
      au.addColorStop(1,"rgba(255,180,220,0)");}
    else if(b.gold){au.addColorStop(0,"rgba(255,235,140,.8)");au.addColorStop(0.5,"rgba(255,200,60,.3)");
      au.addColorStop(1,"rgba(255,200,60,0)");}
    else{au.addColorStop(0,"rgba(255,160,60,.55)");au.addColorStop(0.5,"rgba(255,90,40,.2)");
      au.addColorStop(1,"rgba(255,90,40,0)");}
    g.fillStyle=au;g.beginPath();g.arc(0,0,Math.max(1,r*1.8),0,TAU);g.fill();g.restore();
    // 画像スプライト: きんいろ=gold.png のみ。rockは生成が単体物にならず不採用(手描き継続)。にじいろも色替わりなので手描きのまま。
    // 画像が未準備なら false → 従来の手描き岩へフォールバック
    let usedImg=false;
    if(b.gold&&!b.rainbow){
      usedImg=api.drawAsset("gold.png",0,0,r*2.2,r*2.2,{center:true});
    }
    if(!usedImg){
    // rock body (gold nugget = shiny golden material)
    const grd=g.createRadialGradient(-r*0.3,-r*0.35,Math.max(1,r*0.1),0,0,Math.max(2,r*1.15));
    if(b.rainbow){grd.addColorStop(0,"#ffffff");grd.addColorStop(0.5,rbc);grd.addColorStop(1,"#5a2a6a");}
    else if(b.gold){grd.addColorStop(0,"#fff2b0");grd.addColorStop(0.55,"#e8a83a");grd.addColorStop(1,"#8a5a10");}
    else{grd.addColorStop(0,"#6a4030");grd.addColorStop(0.55,"#3a201a");grd.addColorStop(1,"#1c0e0a");}
    g.fillStyle=grd;
    // ⑤ 軸7(バラエティ): 岩ごとに輪郭を変える(丸い溶岩玉/縦長の黒曜石柱/でこぼこブロブ)
    if(b.shape==="ball"){
      // 丸い溶岩玉: つるんとした真円シルエット
      g.beginPath();g.arc(0,0,Math.max(0,r*0.95),0,TAU);g.fill();
    }else if(b.shape==="pillar"){
      // 縦長の黒曜石柱: 細長い六角柱シルエット(倒れて真っ二つに割れる)
      const pw=r*0.6,ph=r*1.35;
      g.beginPath();
      g.moveTo(-pw*0.72,ph);g.lineTo(-pw,-ph*0.25);g.lineTo(-pw*0.45,-ph);
      g.lineTo(pw*0.45,-ph);g.lineTo(pw,-ph*0.25);g.lineTo(pw*0.72,ph);
      g.closePath();g.fill();
    }else if(b.shape==="stack"){
      // 積み岩: 大きさの違う岩が縦に2〜3段重なったシルエット(壊すと上から順に崩れ落ちる)
      for(let k=2;k>=0;k--){const sy=r*0.5-k*r*0.42,sr=r*(0.62-k*0.06);
        g.beginPath();g.arc(0,sy,Math.max(0,sr),0,TAU);g.fill();}
    }else{
      // でこぼこブロブ(従来形状)
      g.beginPath();
      for(let i=0;i<10;i++){const a=i/10*TAU;const rr=r*(0.86+0.16*Math.sin(a*3+b.spin*2));
        const px=Math.cos(a)*rr,py=Math.sin(a)*rr;
        if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}
      g.closePath();g.fill();
    }
    }
    // gold/rainbow: rotating sparkle diamonds around the body
    if(b.gold||b.rainbow){g.save();g.globalCompositeOperation="lighter";g.fillStyle="#fff";
      for(let i=0;i<4;i++){const a=tsec*3+i*TAU/4;
        const px=Math.cos(a)*r*1.35,py=Math.sin(a)*r*1.35;
        g.globalAlpha=0.5+0.5*Math.sin(tsec*6+i*1.6);
        g.beginPath();g.moveTo(px,py-5);g.lineTo(px+3.5,py);g.lineTo(px,py+5);g.lineTo(px-3.5,py);
        g.closePath();g.fill();}
      g.restore();g.globalAlpha=1;}
    // glowing magma cracks (rainbow uses its shifting colour)
    // ※画像の岩の上にも重ねる: ラッキー色(baseCol)の見分けは この割れ目の色で残す
    g.save();g.globalCompositeOperation="lighter";g.strokeStyle=(b.gold||b.rainbow)?"#fff":b.col;g.lineWidth=Math.max(2,r*0.12);
    g.lineCap="round";g.shadowColor=b.rainbow?rbc:b.col;g.shadowBlur=10;
    g.beginPath();g.moveTo(-r*0.5,-r*0.3);g.lineTo(-r*0.1,0);g.lineTo(-r*0.3,r*0.5);g.stroke();
    g.beginPath();g.moveTo(r*0.5,-r*0.4);g.lineTo(r*0.15,-r*0.05);g.lineTo(r*0.4,r*0.4);g.stroke();
    g.restore();
    // hot top highlight (手描き時のみ: 画像には元から陰影がある)
    if(!usedImg){g.fillStyle="rgba(255,200,120,.3)";
      g.beginPath();g.ellipse(-r*0.25,-r*0.4,Math.max(1,r*0.3),Math.max(1,r*0.16),-0.4,0,TAU);g.fill();}
    // big boulder: extra crack ring after first hit
    if(b.big&&b.hp<=1){g.strokeStyle="rgba(255,220,120,.8)";g.lineWidth=Math.max(2,r*0.1);
      g.lineCap="round";g.beginPath();
      g.moveTo(-r*0.6,r*0.1);g.lineTo(0,-r*0.2);g.lineTo(r*0.2,r*0.3);g.lineTo(r*0.6,-r*0.1);g.stroke();}
    g.restore();
  }
  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.06;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(0,0,0,.6)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,0,0,.4)";roundRect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#ff8a3a");gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg;roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;roundRect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }
  function drawFeverGauge(){
    const w=Math.min(api.W*0.5,240),h=14,x=(api.W-w)/2,y=api.H-28;
    g.save();
    g.fillStyle="rgba(20,6,4,.55)";roundRect(x-4,y-3,w+8,h+6,(h+6)/2);g.fill();
    g.strokeStyle="rgba(255,255,255,.35)";g.lineWidth=2;roundRect(x-4,y-3,w+8,h+6,(h+6)/2);g.stroke();
    const fr=fever>0?clamp(fever/10,0,1):clamp(feverGauge,0,1);
    if(fr>0.02){const gg=g.createLinearGradient(x,0,x+w,0);
      if(fever>0){gg.addColorStop(0,"#ff3b3b");gg.addColorStop(1,"#ffd23f");}
      else{gg.addColorStop(0,"#ff8a3a");gg.addColorStop(1,"#ffe14a");}
      g.save();if(fever>0){g.shadowBlur=12+6*Math.sin(tsec*8);g.shadowColor="#ff5b3a";}
      g.fillStyle=gg;roundRect(x,y,Math.max(h,w*fr),h,h/2);g.fill();g.restore();}
    g.font="800 14px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
    g.lineWidth=4;g.lineJoin="round";g.strokeStyle="rgba(40,8,4,.6)";
    const label=fever>0?"だいふんか タイム！":"ふんかゲージ";
    g.save();if(fever>0){g.shadowBlur=8+4*Math.sin(tsec*8);g.shadowColor="#ffd23f";}
    g.strokeText(label,api.W/2,y-7);g.fillStyle=fever>0?"#ffd23f":"#fff";
    g.fillText(label,api.W/2,y-7);g.restore();
    g.restore();g.textAlign="left";g.lineJoin="miter";
  }
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
}
Engine.register("ashbomb", build_ashbomb);
