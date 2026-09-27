function buildTruck(api){
  const g=api.g;
  // 画像アセット(assets/truck/)。無ければ従来の手描きにフォールバック(nodeテストは常に手描き側)
  // ※ box/car/boss は生成2回とも不良(マゼンタ被り・床の残り)だったため画像は使わず手描きのまま(IMG_OBS/IMG_BOSS=false)
  api.preload(["bg.jpg","truck.png"]);
  const IMG_OBS=false, IMG_BOSS=false;
  // 軸6(見やすさ)対策: bg.jpgは写実的な写真調でトゥーンの箱・車・トラックと画風がケンカするため、
  // IMG_OBS/IMG_BOSSと同じ判断で使用を止め、手描きグラデーション背景に統一する(下のframe()内のimgBg分岐参照)。
  // api.drawCover呼び出し自体はコードに残す(画像が直ったら true に戻すだけで復活できるように)。
  const IMG_BG=false;
  let hsCD=0;      // hitStop クールダウン(節目限定・30f以上あける)
  function tryHitStop(f){if(hsCD<=0){api.hitStop(f);hsCD=32;}}
  let obs=[],shards=[],dust=[],smoke=[],floats=[],sparks=[],rings=[],clouds=[],birds=[],poles=[],motes=[],flyers=[];
  let groundY,truckX,truckW,truckH,wheelR,speed,baseSpeed,boost,bounce,bt,spawnX,distance,combo,comboT,count,wheelRot,parallax,paraFar,paraMid,flash,sky;
  // stage / progression
  let stage,stageHits,stageGoal,banner,bannerT,fever,feverT,boss,confetti;
  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマーと同じ思想) ----
  let luckyColor,luckySeen,luckyMsgT,rbMsgT,comboKept,sunWink;
  const sunHit={x:0,y:0,r:0};   // ④ 太陽ひみつタップの当たり判定
  const STAGES=5;        // 5ステージ周回（昼→夕方→夜→…）
  const HITS_PER=10;     // 区間クリアに必要な撃破数（ボス前）※7〜8歳向けに 8→10
  const BASE_SPD=3.7;    // 基本スピード ※7〜8歳向けに 3.4→3.7
  const BOSS_HP=5;       // 区間ボスのHP ※7〜8歳向けに 4→5
  const MISS_THRESH=0.45;// タップ直後(boostが高い間)しかつぶせない=タイミングが要る閾値。低いと素通り(ミス扱い)
  // ※ 2026-09-22 軸3(歯ごたえ)改修: 0.25→0.45に引き上げ。ランダム連打でのscorePerTapをさらに下げ、
  //   タイミングが結果に効く度合いを強める(0.35でmaxQuietSec/firstScoreSecにまだ余裕があったため、
  //   合格線を崩さない範囲でさらに寄せた。playtestでmaxQuietSec<=12秒を確認済み)。
  const RBC=["#ff5da2","#ff8c42","#ffd23f","#7be08a","#5ad1ff","#9b6bff"];  // にじいろの色相(画像着色にも使う)
  // ステージごとの空パレット（昼→夕→夜→深夜→朝）と路面の色
  const PAL=[
    {top:"#3f8ad6",mid:"#74b6e8",low:"#bfe3f5",hor:"#fdf3df",name:"だい1ちく あさ"},
    {top:"#e98a3a",mid:"#f0a85e",low:"#f6c98a",hor:"#ffe6b0",name:"だい2ちく ゆうがた"},
    {top:"#243a78",mid:"#3a4f9a",low:"#6a5fb0",hor:"#caa0d8",name:"だい3ちく よる"},
    {top:"#10162e",mid:"#1c2548",low:"#2e3a66",hor:"#5a4f8a",name:"だい4ちく しんや"},
    {top:"#5fa0d8",mid:"#9ec8ec",low:"#cfe6f7",hor:"#fff2d6",name:"だい5ちく あさやけ"}
  ];
  // ⑦ 軸7(壊す物のバラエティ)対策: 矩形系(box/drum/crate)の重みを下げ、丸/三角/複合シルエットを増やす。
  // weight = 出やすさの重み(相対値)。box/drum/crateだけ低め、それ以外は高めにして「四角ばかり」を崩す。
  const OB=[
    {k:"box",cols:["#e0563a","#3a8ee6","#f5c518","#43b97f","#ff8c42","#9b6bff"],weight:1},
    {k:"drum",cols:["#d24b3a","#e6a93a","#5566cc","#3a9e6b"],weight:1},
    {k:"car",cols:["#e85d75","#4aa6c0","#7be08a","#ffb347","#b58bff"],weight:2},
    {k:"crate",cols:["#caa15a","#b9874a","#d9b56b"],weight:1},
    {k:"ball",cols:["#ff5da2","#5ad1ff","#ffd23f","#7be08a","#ff8c42"],weight:2},
    {k:"cone",cols:["#ff7a2f","#ff9a3f"],weight:2},
    {k:"cantower",cols:["#d24b3a","#3a9e6b","#5566cc","#e6a93a"],weight:2},   // 缶タワー: 円柱を3段重ねた背の高いシルエット
    {k:"sign",cols:["#ff3b3b","#2ecc71","#3a8ee6","#f5c518"],weight:2}       // 看板: 細いポール+ひし形の頭。とても細長い
  ];
  function pickW(list){
    let total=0;for(const it of list)total+=it.weight||1;
    let r=Math.random()*total;
    for(const it of list){ r-=(it.weight||1); if(r<=0) return it; }
    return list[list.length-1];
  }
  // ② きょうのラッキー色: 障害物に実在する色の中から毎プレイ1色を秘密に選ぶ
  const ALLCOLS=[];OB.forEach(t=>t.cols.forEach(c=>{if(ALLCOLS.indexOf(c)<0)ALLCOLS.push(c);}));
  const COLNAME={"#e0563a":"あか","#3a8ee6":"あお","#f5c518":"きいろ","#43b97f":"みどり","#ff8c42":"オレンジ","#9b6bff":"むらさき","#d24b3a":"あか","#e6a93a":"きいろ","#5566cc":"あお","#3a9e6b":"みどり","#e85d75":"ピンク","#4aa6c0":"みずいろ","#7be08a":"みどり","#ffb347":"オレンジ","#b58bff":"むらさき","#caa15a":"きいろ","#b9874a":"ちゃいろ","#d9b56b":"きいろ","#ff5da2":"ピンク","#5ad1ff":"みずいろ","#ffd23f":"きいろ","#ff7a2f":"オレンジ","#ff9a3f":"オレンジ","#ff3b3b":"あか","#2ecc71":"みどり"};
  function layout(){
    groundY=api.H*0.82;
    truckW=clamp(api.W*0.26,150,300);
    truckH=truckW*0.62;
    wheelR=truckW*0.17;
    truckX=api.W*0.06;
    spawnX=api.W+truckW*0.4;
    sunHit.x=api.W*0.82;sunHit.y=api.H*0.16;sunHit.r=Math.max(44,api.W*0.11); // ④ 太陽の当たり判定(描画と一致)
  }
  function reset(){
    obs=[];shards=[];dust=[];smoke=[];floats=[];sparks=[];rings=[];clouds=[];birds=[];poles=[];motes=[];flyers=[];
    baseSpeed=BASE_SPD;speed=baseSpeed;boost=0;bounce=0;bt=0;hsCD=0;
    distance=0;combo=0;comboT=0;count=0;wheelRot=0;parallax=0;paraFar=0;paraMid=0;flash=0;sky=0;
    stage=0;stageHits=0;stageGoal=HITS_PER;banner="";bannerT=0;fever=0;feverT=0;boss=null;confetti=[];
    luckyColor=pick(ALLCOLS);luckySeen=false;luckyMsgT=0;rbMsgT=0;comboKept=true;sunWink=0;
    layout();
    for(let i=0;i<5;i++)clouds.push({x:rnd(0,api.W),y:rnd(api.H*0.06,api.H*0.4),r:rnd(api.W*0.04,api.W*0.09),sp:rnd(0.05,0.16),f:rnd(0.6,1)});
    // a small flock of distant birds
    for(let i=0;i<3;i++)birds.push({x:rnd(0,api.W),y:rnd(api.H*0.1,api.H*0.3),sp:rnd(0.18,0.32),ph:rnd(0,TAU),sc:rnd(0.7,1.2)});
    // roadside poles (mid-foreground rhythm, recycled by x)
    for(let i=0;i<4;i++)poles.push({x:rnd(0,api.W*1.4),lamp:i%2===0});
    // ※ 2026-09-22 軸3(歯ごたえ)改修: 0.8→0.55に短縮。最初の障害物到達を早め、firstScoreSecを3秒未満に収める。
    let x=api.W*0.55;
    for(let i=0;i<6;i++){ x+=rnd(api.W*0.32,api.W*0.5); spawnOb(x); }
  }
  function spawnOb(x){
    // 後半区間ほど特殊障害物（氷=ice / 金の宝箱=gold）が混ざる。stage 0は普通だけ。
    let special=null;
    if(stage>=1 && Math.random()<0.045) special="rainbow";   // ① 激レア にじいろブロック
    else if(stage>=2 && Math.random()<0.18) special="ice";
    else if(stage>=1 && Math.random()<0.17) special="gold";
    if(special==="rainbow"){
      const w=rnd(truckW*0.34,truckW*0.44),h=w*rnd(0.92,1.08);
      obs.push({x,k:"rainbow",col:"#ff5da2",w,h,crushed:0,bob:rnd(0,TAU)}); return;
    }
    if(special==="ice"){
      const w=rnd(truckW*0.3,truckW*0.4),h=w*rnd(0.9,1.1);
      obs.push({x,k:"ice",col:"#bdecff",w,h,crushed:0,bob:rnd(0,TAU)}); return;
    }
    if(special==="gold"){
      const w=rnd(truckW*0.32,truckW*0.4),h=w*0.78;
      obs.push({x,k:"gold",col:"#ffd23f",w,h,crushed:0,bob:rnd(0,TAU)}); return;
    }
    const t=pickW(OB),col=pick(t.cols);
    let w,h;
    // ⑦ サイズ帯を種類ごとにはっきり変える(大小差をつくる)
    if(t.k==="box"){w=rnd(truckW*0.22,truckW*0.38);h=w*rnd(0.85,1.25);}
    else if(t.k==="drum"){w=rnd(truckW*0.26,truckW*0.34);h=w*1.4;}
    else if(t.k==="crate"){w=rnd(truckW*0.5,truckW*0.7);h=w*rnd(0.75,0.95);}   // 大きめ(積み重なった木箱)
    else if(t.k==="ball"){w=rnd(truckW*0.2,truckW*0.4);h=w;}                  // 小玉〜大玉まで幅広く
    else if(t.k==="cone"){w=rnd(truckW*0.16,truckW*0.2);h=truckW*rnd(0.28,0.34);}  // 小さめに
    else if(t.k==="cantower"){w=rnd(truckW*0.22,truckW*0.3);h=w*rnd(1.7,2.1);}     // 背が高い缶タワー
    else if(t.k==="sign"){w=rnd(truckW*0.24,truckW*0.3);h=truckW*rnd(0.5,0.62);}   // 細長い看板
    else{w=rnd(truckW*0.5,truckW*0.62);h=truckW*0.3;}   // car
    obs.push({x,k:t.k,col,w,h,crushed:0,passed:0,bob:rnd(0,TAU)});
  }
  // 区間ボス（おおきなビル風ブロック）をスポーン。HPゲージあり、数回で粉砕。
  function spawnBoss(){
    const w=truckW*0.9,h=truckH*1.9;
    boss={x:api.W+w,w,h,hp:BOSS_HP,hpMax:BOSS_HP,col:PAL[stage].mid,bob:rnd(0,TAU),hitT:0,cool:0};
  }
  function lastX(){ let m=spawnX; for(const o of obs) if(o.x>m)m=o.x; return m; }
  // ① タップのタイミングが悪くて素通りしたときの「はずれ」演出。地味な音だけでコンボが切れる(叱る演出はしない)。
  function missObstacle(o){
    combo=0;comboT=0;comboKept=false;
    api.tone(190,0.07,"sine",0.045);
    dust.push({x:o.x,y:groundY,r:Math.max(4,o.w*0.16),vr:0.5,life:1,decay:0.05});
  }
  // ⑤ 種類ごとの壊れ方(横転・バウンド・転倒・転がる)。box/crate/ice/gold/rainbow以外がここを通る。
  function spawnBreakAnim(o,heavy,fev){
    const cx=o.x;
    if(o.k==="car"){ // 横転して回転しながら吹っ飛ぶ
      flyers.push({kind:"car",x:cx,y:groundY-o.h*0.5,vx:rnd(6,9)*heavy+speed*0.6,vy:-rnd(6,10),
        rot:0,vr:rnd(0.32,0.5)*(Math.random()<0.5?1:-1),w:o.w,h:o.h,col:o.col,life:1,decay:rnd(0.012,0.018)});
    }else if(o.k==="ball"){ // 潰れず大きくバウンドして消える
      flyers.push({kind:"ball",x:cx,y:groundY-o.h*0.5,vx:rnd(2,5)+speed*0.3,vy:-rnd(13,17)*heavy,
        rot:0,vr:0,w:o.w,h:o.h,col:o.col,life:1,decay:rnd(0.01,0.016),bounces:0});
    }else if(o.k==="cone"||o.k==="sign"){ // 倒れて(看板は根元から)転がる
      flyers.push({kind:"topple",x:cx,y:groundY,vx:rnd(1,3)+speed*0.15,vy:0,ang:0,
        dir:Math.random()<0.5?1:-1,w:o.w,h:o.h,col:o.col,life:1,decay:rnd(0.012,0.018)});
    }else{ // drum / cantower: 横に転がって画面外へ(缶タワーはバラけて複数転がる)
      const n=o.k==="cantower"?3:1;
      for(let i=0;i<n;i++)flyers.push({kind:"roll",x:cx+rnd(-o.w*0.3,o.w*0.3),y:groundY,
        vx:(rnd(7,11)+speed*0.5)*(n>1?rnd(0.8,1.2):1),vy:0,rot:rnd(0,TAU),vr:rnd(0.4,0.7)*fev,
        w:n>1?o.w*0.5:o.w,h:n>1?o.h*0.4:o.h,col:o.col,life:1,decay:rnd(0.014,0.02)});
    }
  }
  function crush(o){
    o.crushed=1;
    // ① にじいろ=一撃6点 / ② ラッキー色=+2の隠しボーナス
    const isRainbow=o.k==="rainbow";
    const isLucky=!isRainbow && o.k!=="ice" && o.k!=="gold" && o.col===luckyColor;
    let gain=isRainbow?6:1;
    if(isLucky){gain+=2;if(!luckySeen){luckyMsgT=1.8;luckySeen=true;}}  // 初回だけ大きく教える
    count+=gain;api.setScore(count);combo++;comboT=1;
    const fev=fever>0?1.7:1;                 // フィーバー中は破片倍増
    const heavy=(o.k!=="box"?1.4:1)*fev;
    api.slide(110-Math.min(combo*3,50),46,0.22,0.5,"sine");
    if(o.k==="ice"){ // 氷は「パリーン」と高い割れ音
      api.noise(0.12,0.3,3600,"highpass");api.slide(1400,520,0.18,0.16,"triangle");
    }else{
      api.noise(0.16,0.32*heavy,1100,"lowpass");
    }
    api.boom(0.35*heavy);
    api.tone(360*Math.pow(2,clamp(combo,0,12)/12),0.1,"square",0.09);
    api.tone(180*Math.pow(2,clamp(combo,0,12)/12),0.12,"sine",0.06);
    api.shake(6+combo*1.2+(heavy>1?4:0));
    tryHitStop(heavy>1?3:2);
    flash=Math.min(flash+(heavy>1?0.34:0.24),0.6);   // まぶしすぎ防止に控えめ(連打で溜まらない上限)
    const cx=o.x,cy=groundY-o.h*0.4;
    // ⑤ 軸7(壊れ方の違い)対策: box/crate/ice/gold/rainbowは従来通りの粉砕(shards)。
    // それ以外(car/ball/cone/drum/cantower/sign)は種類ごとに違う壊れ方(横転/バウンド/転倒/転がる)にする。
    const SHATTER_KIND={box:1,crate:1,ice:1,gold:1,rainbow:1};
    if(SHATTER_KIND[o.k]){
      // chunky debris (フィーバー中は数も増える)
      for(let i=Math.round(rint(7,11)*fev);i>0;i--)shards.push({x:cx+rnd(-o.w/2,o.w/2),y:cy+rnd(-o.h/2,o.h/2),
        vx:rnd(2,11)+speed,vy:rnd(-11,-2),s:rnd(o.w*0.16,o.w*0.32),color:o.col,
        rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.006,0.012),pts:chunkPts()});
    } else {
      spawnBreakAnim(o,heavy,fev);
    }
    // bright sparks (additive glow)
    for(let i=Math.round(rint(8,13)*fev);i>0;i--){const a=rnd(0,TAU),sp=rnd(3,9)*heavy;
      sparks.push({x:cx,y:cy,vx:Math.cos(a)*sp+speed*0.4,vy:Math.sin(a)*sp-rnd(1,4),
        life:1,decay:rnd(0.03,0.06),col:pick(["#fff7cf","#ffd23f","#ffae3a",o.col])});}
    for(let i=0;i<4;i++)dust.push({x:cx+rnd(-15,15),y:groundY,r:rnd(o.w*0.2,o.w*0.4),vr:rnd(0.8,1.8),life:1,decay:rnd(0.012,0.02)});
    // shockwave ring
    rings.push({x:cx,y:cy,r:o.w*0.3,vr:rnd(3.2,4.4)+speed*0.2,life:1,decay:0.05});
    boost=Math.min(boost+0.16,1);
    bounce=-7;
    if(combo>1)floats.push({x:cx,y:cy-30,txt:"x"+combo,life:1,vy:-1.2,
      col:combo>=8?"#ff3b3b":combo>=4?"#ff8c42":"#ffd23f",size:combo>=5?44:32});
    // 金の宝箱を割るとボーナス紙吹雪＋ファンファーレ
    if(o.k==="gold"){
      for(let i=0;i<26;i++)confetti.push({x:cx,y:cy,vx:rnd(-6,6)+speed*0.3,vy:rnd(-12,-3),
        s:rnd(4,8),col:pick(["#ffd23f","#ff6bd0","#5ad1ff","#7be08a","#ff8c42"]),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.008,0.014)});
      api.tone(880,0.1,"square",0.1);api.tone(1320,0.12,"square",0.08);
      floats.push({x:cx,y:cy-50,txt:"ボーナス！",life:1,vy:-1,col:"#ffd23f",size:36});
    }
    // ① にじいろブロック撃破: 虹の紙吹雪＋ファンファーレ＋大量得点
    if(isRainbow){
      rbMsgT=1.4;
      for(let i=0;i<40;i++)confetti.push({x:cx,y:cy,vx:rnd(-8,8)+speed*0.3,vy:rnd(-14,-3),
        s:rnd(5,10),col:pick(["#ff5da2","#5ad1ff","#ffd23f","#7be08a","#ff8c42","#9b6bff"]),
        rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.006,0.012)});
      api.tone(880,0.1,"triangle",0.1);api.tone(1320,0.12,"triangle",0.09);api.tone(1760,0.14,"triangle",0.07);
      api.shake(14);flash=Math.min(flash+0.28,0.7);
      floats.push({x:cx,y:cy-54,txt:"にじいろ！",life:1,vy:-1,col:"#ff5da2",size:44});
    }
    // ② ラッキー色命中: 小さな祝福(控えめ)
    if(isLucky){
      api.tone(1046,0.1,"triangle",0.1);api.tone(1568,0.12,"triangle",0.08);
      floats.push({x:cx,y:cy-46,txt:"ラッキー！",life:1,vy:-1,col:luckyColor,size:34});
      for(let i=0;i<8;i++){const a=rnd(0,TAU),sp=rnd(3,7);
        sparks.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,life:1,decay:rnd(0.03,0.05),col:luckyColor});}
    }
    // 高コンボでフィーバー発動：一定時間つぶし放題で破片倍増＋スピードブースト
    if(combo>=8 && fever<=0){
      fever=1;feverT=1;baseSpeed=Math.min(baseSpeed+0.6,6.5);
      api.boom(0.6);api.shake(14);flash=Math.min(flash+0.4,0.7);
      api.slide(300,900,0.3,0.16,"sawtooth");
      // 軸6(見やすさ)対策: engine.js共通の祝福バナー_fx.bann(y=H*0.3固定・全ゲーム共通で編集不可)と
      // 同時に出ると文字が重なって読めなくなるため、自前のフロート文字はH*0.55前後まで下げてずらす。
      floats.push({x:api.W*0.5,y:api.H*0.55,txt:"フィーバー！",life:1,vy:-0.7,col:"#ff3b3b",size:54});
    }
    // 区間の撃破カウント。一定数つぶしたらボス出現（ボスはframe側で削る）。
    stageHits++;
    if(!boss && stageHits>=stageGoal){
      // ③ ノンストップ ボーナス: 障害物フェーズをコンボ切らさず走り切ったら +5 & 祝福
      if(comboKept){count+=5;api.setScore(count);
        // 軸6対策: 同上。_fx.bann(y=H*0.3)と重なって読めなくなっていたのでH*0.55前後に下げる。
        floats.push({x:api.W*0.5,y:api.H*0.55,txt:"ノンストップ！＋5",life:1,vy:-0.7,col:"#7be08a",size:40});
        for(let i=0;i<24;i++)confetti.push({x:rnd(api.W*0.3,api.W*0.7),y:api.H*0.3,vx:rnd(-5,5),vy:rnd(-4,4),
          s:rnd(4,8),col:pick(["#7be08a","#ffd23f","#5ad1ff"]),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:0.008});
        api.tone(1318,0.14,"triangle",0.1);api.tone(1976,0.16,"triangle",0.07);}
      spawnBoss();
    }
  }
  // ボスに当たり判定。HPを削り、0でステージクリア演出へ。
  function hitBoss(){
    if(!boss) return;
    boss.hp--; boss.hitT=1;
    api.shake(16);api.boom(0.5);flash=Math.min(flash+0.32,0.7);
    api.slide(160,70,0.2,0.4,"sine");
    const bx=boss.x,by=groundY-boss.h*0.5;
    for(let i=0;i<24;i++)shards.push({x:bx+rnd(-boss.w/2,boss.w/2),y:by+rnd(-boss.h/2,boss.h/2),
      vx:rnd(2,13)+speed,vy:rnd(-13,-2),s:rnd(10,22),color:boss.col,
      rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.006,0.011),pts:chunkPts()});
    for(let i=0;i<18;i++){const a=rnd(0,TAU),sp=rnd(4,11);
      sparks.push({x:bx,y:by,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rnd(1,4),
        life:1,decay:rnd(0.03,0.05),col:pick(["#fff7cf","#ffd23f","#ffae3a",boss.col])});}
    rings.push({x:bx,y:by,r:boss.w*0.3,vr:6+speed*0.2,life:1,decay:0.045});
    if(boss.hp<=0){
      tryHitStop(5);
      for(let i=0;i<40;i++)confetti.push({x:bx,y:by,vx:rnd(-9,9),vy:rnd(-15,-4),
        s:rnd(5,10),col:pick(["#ffd23f","#ff6bd0","#5ad1ff","#7be08a","#ff8c42"]),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.006,0.012)});
      boss=null;
      stageClear();
    }
  }
  // ステージクリア：演出バナー＋次区間へ。最終区間到達は特大祝福。
  function stageClear(){
    stage++;
    stageHits=0;stageGoal=HITS_PER+stage*3;   // 少しずつ撃破数を増やす(10,13,16,19)
    combo=0;comboT=0;comboKept=true;          // 次区間のノンストップ判定をリセット
    if(fever>0)baseSpeed=Math.max(BASE_SPD,baseSpeed-0.6);   // フィーバー中にクリアした時のスピード加算を戻す
    fever=0;feverT=0;
    if(stage>=STAGES){
      // 全区間クリア：特大の全画面祝福。その後ループ（最初の昼へ）。
      banner="ぜんぶ クリア！おめでとう！";bannerT=1.6;
      for(let i=0;i<70;i++)confetti.push({x:rnd(0,api.W),y:rnd(0,api.H*0.5),vx:rnd(-7,7),vy:rnd(-4,8),
        s:rnd(5,11),col:pick(["#ffd23f","#ff6bd0","#5ad1ff","#7be08a","#ff8c42","#fff"]),
        rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.004,0.008)});
      api.boom(0.7);api.shake(20);flash=0.95;
      api.slide(400,1200,0.5,0.18,"square");
      stage=0;baseSpeed=BASE_SPD;   // 周回：また昼からやさしく
    }else{
      banner="げんかいとっぱ！ "+PAL[stage].name;bannerT=1.4;
      for(let i=0;i<56;i++)confetti.push({x:rnd(0,api.W),y:rnd(0,api.H*0.4),vx:rnd(-6,6),vy:rnd(-3,7),
        s:rnd(4,9),col:pick(["#ffd23f","#ff6bd0","#5ad1ff","#7be08a","#ff8c42"]),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.005,0.01)});
      api.boom(0.55);api.shake(16);flash=0.88;
      api.slide(300,800,0.35,0.16,"square");
      baseSpeed=Math.min(baseSpeed+0.25,6);   // 次区間はほんの少し速い
    }
  }
  reset();
  return{
    resize(){ const oldG=groundY; layout(); if(oldG) for(const o of obs){} },
    input(px,py,type){
      if(type!=="down")return;
      boost=Math.min(boost+0.45,1.4);
      bounce=-5;
      api.slide(220,360,0.12,0.12,"sawtooth");
      smoke.push({x:truckX-truckW*0.05,y:groundY-wheelR,r:wheelR*0.5,vr:rnd(1.2,2),vx:-rnd(2,4),life:1,decay:0.03});
      // ④ 太陽ひみつタップ: 太陽に触れたら ウインク＋金コインがこぼれる(加速はそのまま/減点なし)
      if(sunHit.r>0 && Math.hypot(px-sunHit.x,py-sunHit.y)<sunHit.r){
        sunWink=1;api.tone(1318,0.1,"triangle",0.09);api.tone(1760,0.12,"triangle",0.07);
        for(let i=0;i<8;i++)confetti.push({x:sunHit.x,y:sunHit.y,vx:rnd(-4,4),vy:rnd(-2,4),
          s:rnd(5,9),col:pick(["#ffd23f","#fff0a0","#ffe08a"]),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:0.01});
      }
    },
    frame(dt,now){
      // physics
      // ③ 軸3(歯ごたえ)対策: 放っておくと勝手に加速して進む「distance*0.0006」を撤廃。
      // 前進の主因はタップ(boost)だけにする＝連打を止めると本当に失速する。
      speed=baseSpeed+boost*7;
      boost*=Math.pow(0.92,dt);
      distance+=speed*dt;
      wheelRot+=speed*dt/wheelR;
      parallax+=speed*dt*0.18;
      paraFar+=speed*dt*0.05;   // distant skyline (slow)
      paraMid+=speed*dt*0.34;   // near roadside (fast)
      sky+=dt;
      bt+=0.25*dt; bounce+=( -Math.sin(bt)*1.4 - bounce)*0.15*dt;
      flash*=Math.pow(0.82,dt);
      // フィーバー / バナーのタイマー
      if(fever>0){feverT-=0.0045*dt;if(feverT<=0){fever=0;baseSpeed=Math.max(BASE_SPD,baseSpeed-0.6);}}
      if(bannerT>0)bannerT-=0.006*dt;
      if(hsCD>0)hsCD-=dt;
      // sky (ステージのパレットで昼→夕方→夜→…と切り替わる)
      const pal=PAL[stage];
      let imgBg=false;
      if(IMG_BG && api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景(昼の街): ステージの空パレットを薄く重ねて 夕方/夜/深夜/あさやけ を出す(1区間=あさ はそのまま)
        const ov=[0,0.34,0.62,0.74,0.22][stage]||0;
        if(ov>0){g.save();g.globalAlpha=ov;const tg=g.createLinearGradient(0,0,0,groundY);
          tg.addColorStop(0,pal.top);tg.addColorStop(0.5,pal.mid);tg.addColorStop(1,pal.low);
          g.fillStyle=tg;g.fillRect(0,0,api.W,groundY);g.restore();g.globalAlpha=1;}
      } else {
        let grd=g.createLinearGradient(0,0,0,groundY);
        grd.addColorStop(0,pal.top);grd.addColorStop(0.4,pal.mid);grd.addColorStop(0.78,pal.low);grd.addColorStop(1,pal.hor);
        g.fillStyle=grd;g.fillRect(0,0,api.W,groundY);
      }
      const night=(stage===2||stage===3); // 夜は星をきらめかせる（poles/lampが活きる）
      if(night){g.save();g.globalCompositeOperation="lighter";
        for(let i=0;i<26;i++){const sx2=(i*97.3+sky*0.2)%api.W,sy2=(i*53.7)%(groundY*0.55);
          const tw=0.3+0.7*(Math.sin(sky*0.06+i)*0.5+0.5);
          g.globalAlpha=tw*0.8;g.fillStyle="#fff";g.fillRect(sx2,sy2,1.6,1.6);}
        g.restore();g.globalAlpha=1;}
      // sun with soft glow halo
      const sunX=api.W*0.82,sunY=api.H*0.16,sunR=api.W*0.06;
      const halo=g.createRadialGradient(sunX,sunY,sunR*0.4,sunX,sunY,sunR*3.4);
      halo.addColorStop(0,"rgba(255,244,200,.6)");halo.addColorStop(0.5,"rgba(255,236,180,.22)");halo.addColorStop(1,"rgba(255,244,200,0)");
      g.fillStyle=halo;g.beginPath();g.arc(sunX,sunY,sunR*3.4,0,TAU);g.fill();
      g.save();g.shadowColor="rgba(255,230,150,.9)";g.shadowBlur=30;
      const sg=g.createRadialGradient(sunX-sunR*0.3,sunY-sunR*0.3,sunR*0.2,sunX,sunY,sunR);
      sg.addColorStop(0,"#fffce8");sg.addColorStop(1,"#ffe08a");
      g.fillStyle=sg;g.beginPath();g.arc(sunX,sunY,sunR,0,TAU);g.fill();g.restore();
      // ④ 太陽ひみつタップ: 叩かれた瞬間だけ ^_^ のウインク顔(発見のごほうび)
      if(sunWink>0){sunWink-=0.018*dt;
        g.save();g.strokeStyle="#d09020";g.lineWidth=Math.max(2,sunR*0.13);g.lineCap="round";g.globalAlpha=clamp(sunWink*1.4,0,1);
        g.beginPath();
        g.moveTo(sunX-sunR*0.44,sunY-sunR*0.02);g.quadraticCurveTo(sunX-sunR*0.29,sunY-sunR*0.3,sunX-sunR*0.14,sunY-sunR*0.02);
        g.moveTo(sunX+sunR*0.14,sunY-sunR*0.02);g.quadraticCurveTo(sunX+sunR*0.29,sunY-sunR*0.3,sunX+sunR*0.44,sunY-sunR*0.02);
        g.stroke();
        g.beginPath();g.arc(sunX,sunY+sunR*0.14,sunR*0.34,0.12*Math.PI,0.88*Math.PI);g.stroke();
        g.restore();g.globalAlpha=1;if(sunWink<0)sunWink=0;}
      // ① にじいろブロック接近の予告: 画面外(右)にレアが控えていたら 右ふちに虹のシェブロン
      if(obs.some(o=>o.k==="rainbow"&&!o.crushed&&o.x>api.W)){
        const yy=api.H*0.5, pulse=0.5+0.5*Math.sin(sky*0.25);
        g.save();g.globalAlpha=0.5+0.4*pulse;g.lineWidth=5;g.lineCap="round";g.lineJoin="round";
        for(let k=0;k<3;k++){g.strokeStyle=["#ff5da2","#ffd23f","#5ad1ff"][k];
          const ox=api.W-14-k*13;g.beginPath();g.moveTo(ox-12,yy-16);g.lineTo(ox,yy);g.lineTo(ox-12,yy+16);g.stroke();}
        g.restore();g.globalAlpha=1;}
      // distant birds (simple flapping V shapes)
      for(const b of birds){b.x-=b.sp*dt; if(b.x<-30){b.x=api.W+rnd(20,api.W*0.4);b.y=rnd(api.H*0.1,api.H*0.3);}
        const fl=Math.sin(sky*0.18+b.ph)*0.5+0.5, wsp=6*b.sc*(0.5+fl*0.7);
        g.strokeStyle="rgba(70,90,120,.5)";g.lineWidth=1.6*b.sc;g.beginPath();
        g.moveTo(b.x-wsp,b.y);g.lineTo(b.x,b.y+wsp*0.5);g.lineTo(b.x+wsp,b.y);g.stroke();}
      // drifting soft clouds (two-tone for volume) ※画像背景のときは絵の雲を活かして描かない
      if(!imgBg) for(const c of clouds){c.x-=c.sp*dt; if(c.x<-c.r*2.2){c.x=api.W+c.r*2.2;c.y=rnd(api.H*0.06,api.H*0.4);}
        g.fillStyle="rgba(220,235,250,.55)";
        g.beginPath();g.arc(c.x,c.y+c.r*0.18,c.r,0,TAU);g.arc(c.x+c.r*0.95,c.y+c.r*0.3,c.r*0.7,0,TAU);
        g.arc(c.x-c.r*0.95,c.y+c.r*0.32,c.r*0.62,0,TAU);g.fill();
        g.fillStyle="rgba(255,255,255,"+(0.6*c.f+0.25)+")";
        g.beginPath();g.arc(c.x,c.y,c.r*0.92,0,TAU);g.arc(c.x+c.r*0.82,c.y+c.r*0.12,c.r*0.62,0,TAU);
        g.arc(c.x-c.r*0.82,c.y+c.r*0.14,c.r*0.55,0,TAU);g.fill();}
      // LAYER 1: far hazy skyline (slow parallax, low contrast) ※画像背景のときは絵の街並みを活かして描かない
      const fbw=92;
      if(!imgBg){g.save();g.globalAlpha=0.5;
      for(let i=-1;i<api.W/fbw+2;i++){const bx=(i*fbw-(paraFar%fbw));const hh=[60,110,80,130,95,72][((i%6)+6)%6];
        g.fillStyle="rgba(150,176,206,.7)";g.fillRect(bx,groundY-hh,fbw*0.85,hh);}
      g.restore();}
      // LAYER 2: near buildings (main parallax, gradient + lit windows + rooftops) ※画像背景のときはスキップ
      const bw=120;
      if(!imgBg) for(let i=-1;i<api.W/bw+2;i++){const bx=(i*bw-(parallax%bw));const ix=((i%5)+5)%5;const hh=[70,120,90,140,100][ix];
        const bg=g.createLinearGradient(0,groundY-hh,0,groundY);
        bg.addColorStop(0,"rgba(98,126,160,.82)");bg.addColorStop(1,"rgba(64,90,124,.7)");
        g.fillStyle=bg;g.fillRect(bx,groundY-hh,bw*0.8,hh);
        // rooftop trim
        g.fillStyle="rgba(120,148,182,.85)";g.fillRect(bx,groundY-hh-6,bw*0.8,6);
        if(ix%2===0){g.fillStyle="rgba(120,148,182,.85)";g.fillRect(bx+bw*0.3,groundY-hh-18,bw*0.16,14);}
        // windows: some warmly lit, deterministic per cell so they don't flicker
        for(let wy=groundY-hh+14,ry=0;wy<groundY-12;wy+=22,ry++)for(let wx=bx+10,rx=0;wx<bx+bw*0.8-12;wx+=20,rx++){
          const lit=((ix*7+ry*3+rx*5)%4===0);
          g.fillStyle=lit?"rgba(255,232,160,.55)":"rgba(210,228,245,.18)";g.fillRect(wx,wy,8,10);}}
      // road with gradient + soft top edge + curb
      const rg=g.createLinearGradient(0,groundY,0,api.H);
      rg.addColorStop(0,"#4a4b56");rg.addColorStop(0.5,"#3a3a44");rg.addColorStop(1,"#2a2a32");
      g.fillStyle=rg;g.fillRect(0,groundY,api.W,api.H-groundY);
      // curb strip
      g.fillStyle="#5a5d68";g.fillRect(0,groundY-3,api.W,6);
      g.fillStyle="#23232a";g.fillRect(0,groundY+3,api.W,5);
      g.fillStyle="rgba(255,255,255,.08)";g.fillRect(0,groundY+8,api.W,3);
      // subtle road sheen sweep near top
      const sheen=g.createLinearGradient(0,groundY+8,0,groundY+(api.H-groundY)*0.4);
      sheen.addColorStop(0,"rgba(255,255,255,.05)");sheen.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=sheen;g.fillRect(0,groundY+8,api.W,(api.H-groundY)*0.4);
      // center dashes (glowing)
      g.save();g.shadowColor="rgba(255,210,63,.5)";g.shadowBlur=10;g.fillStyle="#ffd23f";
      const dash=46,off=(distance)%(dash*2);
      for(let x=-dash*2;x<api.W+dash;x+=dash*2){g.fillRect(x-off,groundY+(api.H-groundY)*0.5-4,dash,8);}
      g.restore();
      // LAYER 3: roadside poles / street lamps (fast parallax, drawn behind dust)
      for(const p of poles){p.x-=speed*dt*0.55;
        if(p.x<-30){let mx=0;for(const q of poles)if(q.x>mx)mx=q.x;p.x=mx+rnd(api.W*0.4,api.W*0.7);p.lamp=Math.random()<0.5;}
        const px=p.x,topY=groundY-api.H*0.18;
        g.fillStyle="#4b4f59";g.fillRect(px-3,topY,6,groundY-topY-3);
        g.fillStyle="rgba(0,0,0,.18)";g.beginPath();g.ellipse(px,groundY,12,4,0,0,TAU);g.fill();
        if(p.lamp){g.fillStyle="#4b4f59";g.fillRect(px,topY-4,api.W*0.05,5);
          const lx=px+api.W*0.05;
          g.save();g.globalCompositeOperation="lighter";
          const ll=g.createRadialGradient(lx,topY,1,lx,topY,18);
          ll.addColorStop(0,"rgba(255,238,180,.7)");ll.addColorStop(1,"rgba(255,238,180,0)");
          g.fillStyle=ll;g.beginPath();g.arc(lx,topY,18,0,TAU);g.fill();g.restore();
          g.fillStyle="#ffe9a8";g.beginPath();g.arc(lx,topY+1,3.5,0,TAU);g.fill();}}
      // dust
      for(const d of dust){d.r+=d.vr*dt;d.y-=0.4*dt;d.life-=d.decay*dt;g.globalAlpha=Math.max(0,d.life)*0.5;
        g.fillStyle="#cdbfa8";g.beginPath();g.arc(d.x-speed*dt*0.0,d.y,d.r,0,TAU);g.fill();}
      g.globalAlpha=1;dust=dust.filter(d=>{d.x-=speed*dt;return d.life>0;});
      // obstacles
      for(const o of obs){o.x-=speed*dt;}
      // collisions
      // ① 軸3(歯ごたえ)対策: タップ直後(boostが高い間)しか壊せない。ボーナス系(ice/gold/rainbow)は
      // これまで通り確実につぶれる(ご褒美の手応えを壊さないため)。それ以外はタイミングが悪いと素通り(ミス)になる。
      const frontX=truckX+truckW*0.94;
      const SPECIAL_KIND={ice:1,gold:1,rainbow:1};
      for(const o of obs){
        if(o.crushed) continue;
        const inZone=o.x-o.w*0.5<frontX && o.x+o.w*0.5>truckX;
        if(inZone){
          if(SPECIAL_KIND[o.k] || boost>MISS_THRESH) crush(o);
        } else if(!SPECIAL_KIND[o.k] && !o.passed && o.x+o.w*0.5<=truckX){
          o.passed=1; missObstacle(o);
        }
      }
      // draw + recycle obstacles
      for(const o of obs){ if(o.crushed) continue; drawOb(o); }
      obs=obs.filter(o=>o.x>-o.w*1.5 && !o.crushed);
      // ボス待機中は新しい障害物の追加を控えめにして、ボスが前に出るようにする
      const cap=boss?4:7;
      while(obs.length<cap){ spawnOb(lastX()+rnd(api.W*0.3,api.W*0.52)); }
      // 区間ボス（おおきなビル）の移動・描画・連続クラッシュ
      if(boss){
        if(boss.hitT>0)boss.hitT-=0.06*dt;
        if(boss.cool>0)boss.cool-=dt;
        // 前進してトラックの少し先で止まり、連続スラムで削る（クールダウンで4回の節目を出す）
        const stopX=truckX+truckW*0.96+boss.w*0.5;
        if(boss.x>stopX) boss.x-=speed*dt; else boss.x=stopX;
        drawBoss(boss);
        // ③ 軸3(歯ごたえ)対策: タップしてboostをMISS_THRESHより高く保っていないとボスに一切ダメージが入らない
        // (放置しても自動で削れない)。連打の頻度差(boost高低)で削れる速さの差が体感できるよう係数も強める。
        if(boss.x<=stopX+2 && boss.cool<=0 && boost>MISS_THRESH){ boss.cool=Math.max(3,18-boost*14); hitBoss(); }
      }
      // smoke from exhaust
      smoke.push({x:truckX+truckW*0.02,y:groundY-truckH*0.78,r:rnd(6,11),vr:rnd(0.5,1),vx:-rnd(0.6,1.6),life:1,decay:rnd(0.02,0.035)});
      for(const s of smoke){s.x+=s.vx*dt;s.y-=0.5*dt;s.r+=s.vr*dt;s.life-=s.decay*dt;
        g.globalAlpha=Math.max(0,s.life)*0.35;g.fillStyle="#9aa0aa";g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();}
      g.globalAlpha=1;smoke=smoke.filter(s=>s.life>0);
      // truck
      drawTruck();
      // shockwave rings
      for(const r of rings){r.r+=r.vr*dt;r.x-=speed*dt;r.life-=r.decay*dt;
        g.save();g.globalAlpha=Math.max(0,r.life)*0.7;g.strokeStyle="rgba(255,255,255,.9)";
        g.lineWidth=Math.max(1,4*r.life);g.beginPath();g.arc(r.x,r.y,r.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(r=>r.life>0);
      // shards
      for(const p of shards){p.vy+=0.55*dt;p.x+=(p.vx-speed)*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
        if(p.y>groundY-2){p.y=groundY-2;p.vy*=-0.4;p.vx*=0.7;if(Math.abs(p.vy)<1.2)p.life-=0.04*dt;}
        p.life-=p.decay*dt;g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        drawChunk(p);g.restore();}
      shards=shards.filter(p=>p.life>0&&p.x>-30);
      // ⑤ 種類ごとの壊れ方アニメ(横転/バウンド/転倒/転がる)
      for(const f of flyers){
        f.x+=(f.vx-speed)*dt;
        if(f.kind==="car"){ f.y+=f.vy*dt; f.vy+=0.55*dt; f.rot+=f.vr*dt; }
        else if(f.kind==="ball"){ f.y+=f.vy*dt; f.vy+=0.6*dt;
          const floorY=groundY-f.h*0.3;
          if(f.y>floorY){ f.y=floorY; f.vy*=-0.55; f.bounces=(f.bounces||0)+1; } }
        else if(f.kind==="topple"){ f.ang=Math.min(1,f.ang+0.045*dt); }
        else if(f.kind==="roll"){ f.rot+=f.vr*dt; }
        f.life-=f.decay*dt;
      }
      flyers=flyers.filter(f=>f.life>0&&f.x>-80);
      for(const f of flyers){
        g.save();g.globalAlpha=Math.max(0,f.life);
        if(f.kind==="car"){
          g.translate(f.x,f.y);g.rotate(f.rot);
          g.fillStyle=f.col;roundR(-f.w*0.4,-f.h*0.3,f.w*0.8,f.h*0.6,6);g.fill();
          g.fillStyle="rgba(255,255,255,.4)";roundR(-f.w*0.22,-f.h*0.24,f.w*0.44,f.h*0.2,4);g.fill();
        }else if(f.kind==="ball"){
          const shrink=Math.max(0.25,1-(f.bounces||0)*0.14);
          const rr=Math.max(1,f.w*0.5*shrink);
          g.translate(f.x,f.y);
          g.fillStyle=f.col;g.beginPath();g.arc(0,0,rr,0,TAU);g.fill();
          g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(-rr*0.3,-rr*0.3,Math.max(0.5,rr*0.25),0,TAU);g.fill();
        }else if(f.kind==="topple"){
          g.translate(f.x,groundY);g.rotate(f.dir*f.ang*Math.PI*0.48);
          g.fillStyle=f.col;g.beginPath();g.moveTo(0,-f.h);g.lineTo(f.w*0.5,0);g.lineTo(-f.w*0.5,0);g.closePath();g.fill();
        }else if(f.kind==="roll"){
          g.translate(f.x,groundY-f.h*0.5);g.rotate(f.rot);
          const rw=Math.max(1,f.w*0.5),rh=Math.max(1,f.h*0.5);
          g.fillStyle=f.col;g.beginPath();g.ellipse(0,0,rw,rh,0,0,TAU);g.fill();
          g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(0,0,Math.max(0.5,rw*0.55),Math.max(0.5,rh*0.55),0,0,TAU);g.fill();
        }
        g.restore();
      }
      // glowing sparks (additive)
      g.save();g.globalCompositeOperation="lighter";
      for(const s of sparks){s.vy+=0.32*dt;s.x+=(s.vx-speed)*dt;s.y+=s.vy*dt;s.life-=s.decay*dt;
        const a=Math.max(0,s.life);g.globalAlpha=a;g.fillStyle=s.col;
        g.beginPath();g.arc(s.x,s.y,1.5+a*3,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      sparks=sparks.filter(s=>s.life>0&&s.x>-20);
      // ambient sun motes drifting in the light (fills quiet gaps, additive sparkle)
      if(motes.length<14 && Math.random()<0.08)motes.push({x:api.W+10,y:rnd(api.H*0.2,groundY-20),r:rnd(1,2.6),sp:rnd(0.3,0.9),ph:rnd(0,TAU),tw:rnd(2,4)});
      g.save();g.globalCompositeOperation="lighter";
      for(const m of motes){m.x-=(speed*0.12+m.sp)*dt;m.y+=Math.sin(sky*0.05+m.ph)*0.3*dt;
        const tw=0.4+0.6*(Math.sin(sky*0.12*m.tw+m.ph)*0.5+0.5);
        g.globalAlpha=tw*0.5;g.fillStyle="#fff4cf";g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      motes=motes.filter(m=>m.x>-10);
      // confetti (ボーナス/区間クリアの紙吹雪)
      for(const p of confetti){p.vy+=0.4*dt;p.x+=(p.vx-speed*0.3)*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        g.fillStyle=p.col;g.fillRect(-p.s*0.5,-p.s*0.5,p.s,p.s*0.6);g.restore();}
      g.globalAlpha=1;confetti=confetti.filter(p=>p.life>0&&p.y<api.H+20);
      // floats + combo decay
      if(combo>0){comboT-=0.014*dt;if(comboT<=0){combo=0;comboKept=false;}}  // ③ コンボ切れ=ノンストップ失敗
      for(const f of floats){f.x-=speed*dt*0.5;f.y+=f.vy*dt;f.life-=0.016*dt;g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,f.x,f.y);g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // impact flash overlay (additive bloom / まぶしすぎ防止に控えめ)
      if(flash>0.01){g.save();g.globalCompositeOperation="lighter";
        g.globalAlpha=Math.min(0.3,flash*0.34);g.fillStyle="#fff6d8";g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      // BIG climax color-wash on big combos (vignette of warm color, scales with combo)
      if(combo>=5){
        const cw=clamp((combo-4)/8,0,1)*flash;
        if(cw>0.02){g.save();
          const vg=g.createRadialGradient(api.W*0.5,api.H*0.5,api.H*0.2,api.W*0.5,api.H*0.5,api.W*0.7);
          const cc=combo>=10?"255,80,90":combo>=8?"255,140,60":"255,210,80";
          vg.addColorStop(0,"rgba("+cc+",0)");vg.addColorStop(1,"rgba("+cc+","+(0.32*cw)+")");
          g.fillStyle=vg;g.fillRect(0,0,api.W,api.H);g.restore();}
      }
      // フィーバー中は画面ふちが脈打つ暖色グロー
      if(fever>0){g.save();const pulse=0.18+0.12*(Math.sin(sky*0.3)*0.5+0.5);
        const fv=g.createRadialGradient(api.W*0.5,api.H*0.5,api.H*0.25,api.W*0.5,api.H*0.5,api.W*0.75);
        fv.addColorStop(0,"rgba(255,120,40,0)");fv.addColorStop(1,"rgba(255,80,30,"+pulse*feverT+")");
        g.fillStyle=fv;g.fillRect(0,0,api.W,api.H);g.restore();}
      // ① にじいろブロック！ 中央バナー(虹色に色替わり=レアの大きな祝福)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3, col=["#ff5da2","#ffd23f","#5ad1ff","#7be08a","#9b6bff"][Math.floor(sky*0.15)%5];
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 40px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText("にじいろブロック！",0,0);
        g.fillStyle=col;g.fillText("にじいろブロック！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央の小ヒント(初回だけ)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.28);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 23px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(COLNAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.4)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyMsgT<0)luckyMsgT=0;}
      g.globalCompositeOperation="source-over";g.globalAlpha=1;   // 加算合成の戻し忘れ保険(HUD/バナーは通常合成で)
      drawBanner();
      drawHUD();
    }
  };
  function drawHUD(){
    // cute rounded HUD pill: score badge (left) + hint pill (bottom center)
    g.save();
    // bottom hint pill
    const txt="タップで アクセル！ つぶせ！";
    g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";
    const tm=g.measureText(txt), tw=(tm&&tm.width)||txt.length*16, pw=tw+38, ph=34, px=api.W/2-pw/2, py=api.H-ph-10;
    g.shadowColor="rgba(0,0,0,.25)";g.shadowBlur=10;g.shadowOffsetY=3;
    // ⑥ 軸6対策: PAL[0](あさ)のような明るいステージでもヒント文字が薄くならないよう地の濃さを上げる(.62→.72)
    roundR(px,py,pw,ph,ph/2);g.fillStyle="rgba(40,60,90,.72)";g.fill();
    g.shadowColor="transparent";g.shadowBlur=0;g.shadowOffsetY=0;
    roundR(px+1.5,py+1.5,pw-3,ph-3,(ph-3)/2);g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;g.stroke();
    g.textAlign="center";g.textBaseline="middle";
    g.fillStyle="#ffe9a8";g.fillText(txt,api.W/2,py+ph/2+1);
    g.restore();
    // 区間プログレス（上部中央＝engine HUDのもどる/スコアと衝突しない安全帯）
    const big=stage>=STAGES-1;
    const lbl=PAL[stage].name;
    g.font="800 15px 'Hiragino Maru Gothic ProN',system-ui";
    const lm=g.measureText(lbl),lw=(lm&&lm.width)||lbl.length*15,lpw=lw+26,lx=api.W/2-lpw/2;
    g.shadowColor="rgba(0,0,0,.25)";g.shadowBlur=8;g.shadowOffsetY=2;
    roundR(lx,8,lpw,28,14);g.fillStyle=big?"rgba(120,40,60,.7)":"rgba(40,60,90,.62)";g.fill();
    g.shadowColor="transparent";g.shadowBlur=0;g.shadowOffsetY=0;
    g.textAlign="center";g.textBaseline="middle";g.fillStyle="#ffe9a8";g.fillText(lbl,api.W/2,22);
    // 残りメーター（ボス前は撃破数、ボス中はHP）
    const remW=lpw,remX=lx,remY=39;
    g.fillStyle="rgba(255,255,255,.18)";roundR(remX,remY,remW,7,3.5);g.fill();
    let prog;
    if(boss) prog=boss.hp/boss.hpMax; else prog=clamp(stageHits/stageGoal,0,1);
    g.fillStyle=boss?"#ff5d5d":"#7be08a";roundR(remX,remY,Math.max(4,remW*(boss?prog:prog)),7,3.5);g.fill();
    g.restore();
    g.textAlign="left";g.textBaseline="alphabetic";
  }
  // 区間クリア／全クリアの大きな祝福バナー
  function drawBanner(){
    if(bannerT<=0||!banner) return;
    g.save();
    const a=clamp(bannerT*1.4,0,1), pop=1+0.12*Math.sin((1-Math.min(bannerT,1))*Math.PI);
    const full=banner.indexOf("ぜんぶ")===0;
    g.globalAlpha=a*0.55;g.fillStyle=full?"rgba(255,180,60,1)":"rgba(20,30,50,1)";
    // 軸6(見やすさ)対策: engine.js共通の祝福バナー_fx.bann(y=H*0.3固定・全ゲーム共通で編集不可)と
    // 同時に出ると文字が重なって読めなくなっていたため、帯とバナー文字をH*0.47〜0.69(中心0.58)へ下げてずらす。
    g.fillRect(0,api.H*0.47,api.W,api.H*0.22);
    g.globalAlpha=a;
    g.translate(api.W*0.5,api.H*0.58);g.scale(pop,pop);
    g.font="900 "+Math.round(api.W*(full?0.07:0.055))+"px 'Hiragino Maru Gothic ProN',system-ui";
    g.textAlign="center";g.textBaseline="middle";
    g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(banner,0,0);
    g.fillStyle=full?"#fff4c0":"#ffe9a8";g.fillText(banner,0,0);
    g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";
  }
  // 区間ボス：おおきなビル風ブロック。窓＋顔つき、被弾でフラッシュ。
  function drawBoss(b){
    const yb=groundY,x=b.x,h=b.h,w=b.w,y=yb-h;
    g.save();
    g.fillStyle="rgba(0,0,0,.25)";g.beginPath();g.ellipse(x,yb+3,w*0.6,w*0.16,0,0,TAU);g.fill();
    // 画像ボス: 白ベースのビル怪人を区間の空色で着色。被弾フラッシュだけ重ねる
    const bspr=IMG_BOSS?api.tinted("boss.png",b.col,0.42):null;
    if(bspr){
      api.drawSrc(bspr,x,yb-h*0.5+h*0.03,w*1.18,h*1.06,{center:true});
      if(b.hitT>0){g.globalAlpha=clamp(b.hitT,0,1)*0.6;g.fillStyle="#fff";g.fillRect(x-w*0.59,y,w*1.18,h);g.globalAlpha=1;}
      g.restore();return;
    }
    const bg=g.createLinearGradient(0,y,0,yb);
    bg.addColorStop(0,shadeC(b.col,26));bg.addColorStop(1,shadeC(b.col,-24));
    g.fillStyle=bg;g.fillRect(x-w/2,y,w,h);
    // 屋上のへり
    g.fillStyle=shadeC(b.col,40);g.fillRect(x-w/2-3,y-8,w+6,10);
    // 窓
    for(let wy=y+22,ry=0;wy<yb-18;wy+=26,ry++)for(let wx=x-w/2+12,rx=0;wx<x+w/2-14;wx+=22,rx++){
      const lit=((ry*3+rx*5)%3===0);
      g.fillStyle=lit?"rgba(255,232,160,.7)":"rgba(180,210,240,.25)";g.fillRect(wx,wy,12,15);}
    g.strokeStyle="rgba(0,0,0,.3)";g.lineWidth=3;g.strokeRect(x-w/2,y,w,h);
    // 大きな顔
    drawFace(x,y+h*0.42,w*0.16,b.hp<=1);
    // 被弾フラッシュ（白く光る）
    if(b.hitT>0){g.globalAlpha=b.hitT*0.6;g.fillStyle="#fff";g.fillRect(x-w/2,y,w,h);g.globalAlpha=1;}
    g.restore();
  }
  // cute little face: two eyes with highlights + a tiny mouth, centered at (fx,fy)
  function drawFace(fx,fy,sc,open){
    const er=Math.max(2.2,sc*0.5), ex=sc*1.15;
    g.fillStyle="#2a2530";
    g.beginPath();g.arc(fx-ex,fy,er,0,TAU);g.arc(fx+ex,fy,er,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.92)";
    g.beginPath();g.arc(fx-ex-er*0.3,fy-er*0.35,er*0.4,0,TAU);g.arc(fx+ex-er*0.3,fy-er*0.35,er*0.4,0,TAU);g.fill();
    // rosy cheeks
    g.fillStyle="rgba(255,130,140,.4)";
    g.beginPath();g.arc(fx-ex*1.5,fy+er*0.9,er*0.55,0,TAU);g.arc(fx+ex*1.5,fy+er*0.9,er*0.55,0,TAU);g.fill();
    // mouth
    g.strokeStyle="#2a2530";g.lineWidth=Math.max(1.4,sc*0.28);g.lineCap="round";
    g.beginPath();
    if(open){g.fillStyle="#2a2530";g.ellipse(fx,fy+er*1.7,er*0.7,er*0.85,0,0,TAU);g.fill();}
    else{g.arc(fx,fy+er*0.8,ex*0.8,0.15*Math.PI,0.85*Math.PI);g.stroke();}
  }
  // 画像スプライトで描ける障害物(箱系=白い箱を着色 / 車=白い車を着色)。描けたら true、未準備なら false→手描きへ
  function drawObImg(o){
    if(!IMG_OBS) return false;   // 画像不良のため手描きへ(生成が直ったら true に戻す)
    const yb=groundY, x=o.x, y=yb-o.h;
    if(o.k==="box"||o.k==="crate"||o.k==="ice"||o.k==="rainbow"){
      let col=o.col,al=0.5;
      if(o.k==="crate")al=0.6;
      else if(o.k==="ice"){col="#bdecff";al=0.4;}
      else if(o.k==="rainbow")col=RBC[Math.floor(sky*0.1)%RBC.length];   // にじいろ: 色相が巡る
      const spr=api.tinted("box.png",col,al); if(!spr)return false;
      if(o.k==="rainbow"){ // 発光オーラ(激レアの合図)は canvas のまま
        g.save();g.globalCompositeOperation="lighter";
        const rp=0.5+0.5*Math.sin(sky*0.2+o.bob);
        const ag=g.createRadialGradient(x,y+o.h*0.5,Math.max(0,o.w*0.1),x,y+o.h*0.5,Math.max(0,o.w*1.15));
        ag.addColorStop(0,"rgba(255,255,255,"+(0.45*rp)+")");ag.addColorStop(1,"rgba(255,255,255,0)");
        g.fillStyle=ag;g.beginPath();g.arc(x,y+o.h*0.5,Math.max(0,o.w*1.15),0,TAU);g.fill();g.restore();g.globalAlpha=1;}
      g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(x,yb+2,o.w*0.55,o.w*0.14,0,0,TAU);g.fill();
      const sw=o.w*1.12,sh=o.h*1.1;
      api.drawSrc(spr,x,yb-sh*0.5+o.h*0.05,sw,sh,{center:true,alpha:o.k==="ice"?0.9:1});
      if(o.k==="ice"){g.strokeStyle="rgba(255,255,255,.85)";g.lineWidth=2;g.lineCap="round";
        g.beginPath();g.moveTo(x-o.w*0.1,y+o.h*0.05);g.lineTo(x+o.w*0.05,y+o.h*0.5);g.lineTo(x-o.w*0.05,y+o.h*0.95);g.stroke();}
      if(o.k==="rainbow"){g.save();g.globalCompositeOperation="lighter";
        for(let s=0;s<3;s++){const tw=0.4+0.6*(Math.sin(sky*0.25+o.bob+s*2)*0.5+0.5);
          g.globalAlpha=tw;g.fillStyle="#fff";g.beginPath();
          g.arc(x+(s-1)*o.w*0.28,y+o.h*(0.25+s*0.28),2.6,0,TAU);g.fill();}
        g.restore();g.globalAlpha=1;}
      drawFace(x,y+o.h*0.5,o.w*0.1,o.k==="rainbow");
      return true;
    }
    if(o.k==="car"){
      const spr=api.tinted("car.png",o.col,0.5); if(!spr)return false;
      g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(x,yb+2,o.w*0.5,o.w*0.1,0,0,TAU);g.fill();
      const S=o.w*1.1;
      api.drawSrc(spr,x,yb-S*0.32,S,S,{center:true});
      return true;
    }
    return false;   // drum / ball / cone / gold は手描きのまま
  }
  function drawOb(o){
    const yb=groundY, x=o.x;
    g.save();
    if(drawObImg(o)){}
    else if(o.k==="box"){
      const y=yb-o.h;
      g.fillStyle="rgba(0,0,0,.2)";g.fillRect(x-o.w/2+3,y+3,o.w,o.h);
      g.fillStyle=o.col;g.fillRect(x-o.w/2,y,o.w,o.h);
      g.fillStyle="rgba(255,255,255,.25)";g.fillRect(x-o.w/2,y,o.w,o.h*0.18);
      g.fillStyle="rgba(0,0,0,.18)";g.fillRect(x-o.w/2,yb-o.h*0.18,o.w,o.h*0.18);
      // ⑥ 軸6(見やすさ)対策: 実写調bg.jpgの上でも輪郭が沈まないよう太め統一(概ねo.w*0.06)
      g.strokeStyle="rgba(0,0,0,.4)";g.lineWidth=Math.max(2,o.w*0.06);g.strokeRect(x-o.w/2,y,o.w,o.h);
      drawFace(x,y+o.h*0.5,o.w*0.1,false);
    }else if(o.k==="drum"){
      const y=yb-o.h;
      g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(x,yb+2,o.w*0.5,o.w*0.16,0,0,TAU);g.fill();
      const grd=g.createLinearGradient(x-o.w/2,0,x+o.w/2,0);grd.addColorStop(0,shadeC(o.col,-30));grd.addColorStop(.5,o.col);grd.addColorStop(1,shadeC(o.col,-30));
      g.fillStyle=grd;g.fillRect(x-o.w/2,y,o.w,o.h);
      g.fillStyle="rgba(0,0,0,.25)";g.fillRect(x-o.w/2,y+o.h*0.28,o.w,o.h*0.1);g.fillRect(x-o.w/2,y+o.h*0.62,o.w,o.h*0.1);
      g.fillStyle="rgba(255,255,255,.2)";g.beginPath();g.ellipse(x,y,o.w*0.5,o.w*0.14,0,0,TAU);g.fill();
      // ⑥ drumには元々アウトラインが無く実写背景に沈みやすかったので追加
      g.strokeStyle="rgba(0,0,0,.4)";g.lineWidth=Math.max(2,o.w*0.06);g.strokeRect(x-o.w/2,y,o.w,o.h);
      drawFace(x,y+o.h*0.46,o.w*0.1,false);
    }else if(o.k==="crate"){
      // wooden crate with plank lines + diagonal braces
      const y=yb-o.h;
      g.fillStyle="rgba(0,0,0,.2)";g.fillRect(x-o.w/2+3,y+3,o.w,o.h);
      const cg=g.createLinearGradient(0,y,0,y+o.h);cg.addColorStop(0,shadeC(o.col,18));cg.addColorStop(1,shadeC(o.col,-18));
      g.fillStyle=cg;g.fillRect(x-o.w/2,y,o.w,o.h);
      g.strokeStyle="rgba(90,60,30,.55)";g.lineWidth=Math.max(2,o.w*0.05);
      g.strokeRect(x-o.w/2,y,o.w,o.h);
      // diagonal braces
      g.beginPath();g.moveTo(x-o.w/2,y);g.lineTo(x+o.w/2,y+o.h);g.moveTo(x+o.w/2,y);g.lineTo(x-o.w/2,y+o.h);g.stroke();
      // edge frame
      g.lineWidth=Math.max(2.5,o.w*0.07);g.strokeRect(x-o.w/2+1,y+1,o.w-2,o.h-2);
      g.fillStyle="rgba(255,255,255,.18)";g.fillRect(x-o.w/2,y,o.w,o.h*0.12);
      drawFace(x,y+o.h*0.36,o.w*0.1,false);
    }else if(o.k==="ball"){
      // bouncy beach ball with stripes, gentle bob
      const r=o.w*0.5, cy=yb-r-Math.abs(Math.sin(sky*0.08+o.bob))*r*0.22;
      g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(x,yb+2,r*0.9,r*0.22,0,0,TAU);g.fill();
      const bg=g.createRadialGradient(x-r*0.35,cy-r*0.35,r*0.2,x,cy,r);
      bg.addColorStop(0,shadeC(o.col,55));bg.addColorStop(1,o.col);
      g.fillStyle=bg;g.beginPath();g.arc(x,cy,r,0,TAU);g.fill();
      // colored wedges
      g.save();g.beginPath();g.arc(x,cy,r,0,TAU);g.clip();
      g.fillStyle="rgba(255,255,255,.5)";
      g.beginPath();g.moveTo(x,cy);g.arc(x,cy,r,-0.35,0.35);g.closePath();g.fill();
      g.beginPath();g.moveTo(x,cy);g.arc(x,cy,r,Math.PI-0.35,Math.PI+0.35);g.closePath();g.fill();
      g.restore();
      g.fillStyle="rgba(255,255,255,.6)";g.beginPath();g.arc(x-r*0.32,cy-r*0.32,r*0.22,0,TAU);g.fill();
      // ⑥ ボールも元々アウトライン無し。丸いシルエットが実写背景と区別できるよう縁取りを追加
      g.strokeStyle="rgba(0,0,0,.35)";g.lineWidth=Math.max(2,r*0.12);g.beginPath();g.arc(x,cy,r,0,TAU);g.stroke();
      drawFace(x,cy-r*0.05,r*0.18,true);
    }else if(o.k==="cone"){
      // traffic cone, friendly
      const baseY=yb, topY=yb-o.h, hw=o.w*0.5;
      g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(x,yb+2,hw*1.1,o.w*0.13,0,0,TAU);g.fill();
      const cg=g.createLinearGradient(0,topY,0,baseY);cg.addColorStop(0,shadeC(o.col,40));cg.addColorStop(1,o.col);
      g.fillStyle=cg;
      g.beginPath();g.moveTo(x,topY);g.lineTo(x+hw,baseY);g.lineTo(x-hw,baseY);g.closePath();g.fill();
      // white reflective bands
      g.fillStyle="rgba(255,255,255,.85)";
      for(let t=0.34;t<=0.6;t+=0.26){const yy=topY+o.h*t, ww=hw*t*1.05;
        g.beginPath();g.moveTo(x-ww,yy);g.lineTo(x+ww,yy);g.lineTo(x+ww*1.18,yy+o.h*0.08);g.lineTo(x-ww*1.18,yy+o.h*0.08);g.closePath();g.fill();}
      // base slab
      g.fillStyle=shadeC(o.col,-25);g.fillRect(x-hw*1.1,baseY-o.h*0.08,hw*2.2,o.h*0.08);
      // ⑥ コーンも三角シルエットの縁取りを追加(背景の建物と混ざらないように)
      g.strokeStyle="rgba(0,0,0,.35)";g.lineWidth=Math.max(2,o.w*0.06);
      g.beginPath();g.moveTo(x,topY);g.lineTo(x+hw,baseY);g.lineTo(x-hw,baseY);g.closePath();g.stroke();
      drawFace(x,topY+o.h*0.5,o.w*0.09,false);
    }else if(o.k==="ice"){
      // 氷ブロック：半透明の青、ハイライトと割れ目つき
      const y=yb-o.h;
      g.fillStyle="rgba(0,0,0,.15)";g.fillRect(x-o.w/2+3,y+3,o.w,o.h);
      const ig=g.createLinearGradient(0,y,0,y+o.h);
      ig.addColorStop(0,"rgba(220,248,255,.92)");ig.addColorStop(1,"rgba(150,210,240,.85)");
      g.fillStyle=ig;g.fillRect(x-o.w/2,y,o.w,o.h);
      g.fillStyle="rgba(255,255,255,.6)";g.fillRect(x-o.w/2,y,o.w*0.3,o.h);
      g.strokeStyle="rgba(255,255,255,.8)";g.lineWidth=2;
      g.beginPath();g.moveTo(x-o.w*0.1,y);g.lineTo(x+o.w*0.05,y+o.h*0.5);g.lineTo(x-o.w*0.05,y+o.h);g.stroke();
      g.strokeStyle="rgba(120,180,220,.6)";g.lineWidth=Math.max(2,o.w*0.06);g.strokeRect(x-o.w/2,y,o.w,o.h);
      drawFace(x,y+o.h*0.42,o.w*0.1,false);
    }else if(o.k==="gold"){
      // 金の宝箱：きらきら光る、つぶすとボーナス
      const y=yb-o.h;
      g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(x,yb+2,o.w*0.5,o.w*0.12,0,0,TAU);g.fill();
      const gg2=g.createLinearGradient(0,y,0,y+o.h);
      gg2.addColorStop(0,"#fff0a0");gg2.addColorStop(0.5,"#ffd23f");gg2.addColorStop(1,"#e0a020");
      g.fillStyle=gg2;roundR(x-o.w/2,y+o.h*0.28,o.w,o.h*0.72,5);g.fill();
      // ふた
      g.fillStyle="#ffdf6a";g.beginPath();g.moveTo(x-o.w/2,y+o.h*0.3);g.quadraticCurveTo(x,y-o.h*0.1,x+o.w/2,y+o.h*0.3);g.closePath();g.fill();
      // 留め金
      g.fillStyle="#b07810";g.fillRect(x-o.w*0.08,y+o.h*0.22,o.w*0.16,o.h*0.3);
      g.strokeStyle="rgba(150,100,10,.6)";g.lineWidth=Math.max(2.5,o.w*0.06);g.strokeRect(x-o.w/2,y+o.h*0.28,o.w,o.h*0.72);
      // きらめき
      g.save();g.globalCompositeOperation="lighter";
      const tw=0.4+0.6*(Math.sin(sky*0.2+o.bob)*0.5+0.5);
      g.globalAlpha=tw;g.fillStyle="#fff";g.beginPath();g.arc(x-o.w*0.2,y+o.h*0.45,2.5,0,TAU);g.fill();g.restore();g.globalAlpha=1;
      drawFace(x,y+o.h*0.55,o.w*0.1,false);
    }else if(o.k==="rainbow"){
      // ① にじいろブロック：横しまの虹がスクロール＋発光オーラ＋きらめき(激レアの合図)
      const y=yb-o.h, base=["#ff5da2","#ff8c42","#ffd23f","#7be08a","#5ad1ff","#9b6bff"];
      g.save();g.globalCompositeOperation="lighter";
      const rp=0.5+0.5*Math.sin(sky*0.2+o.bob);
      const ag=g.createRadialGradient(x,y+o.h*0.5,o.w*0.1,x,y+o.h*0.5,o.w*1.15);
      ag.addColorStop(0,"rgba(255,255,255,"+(0.45*rp)+")");ag.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=ag;g.beginPath();g.arc(x,y+o.h*0.5,o.w*1.15,0,TAU);g.fill();g.restore();
      g.fillStyle="rgba(0,0,0,.2)";g.fillRect(x-o.w/2+3,y+3,o.w,o.h);
      const bandsN=base.length, bh=o.h/bandsN, shift=Math.floor(sky*0.1)%bandsN;
      for(let i=0;i<bandsN;i++){g.fillStyle=base[(i+shift)%bandsN];g.fillRect(x-o.w/2,y+i*bh,o.w,bh+1);}
      g.fillStyle="rgba(255,255,255,.25)";g.fillRect(x-o.w/2,y,o.w,o.h*0.14);
      g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=Math.max(2,o.w*0.06);g.strokeRect(x-o.w/2,y,o.w,o.h);
      g.save();g.globalCompositeOperation="lighter";
      for(let s=0;s<3;s++){const tw=0.4+0.6*(Math.sin(sky*0.25+o.bob+s*2)*0.5+0.5);
        g.globalAlpha=tw;g.fillStyle="#fff";g.beginPath();
        g.arc(x+(s-1)*o.w*0.28,y+o.h*(0.25+s*0.28),2.6,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      drawFace(x,y+o.h*0.45,o.w*0.1,true);
    }else if(o.k==="cantower"){
      // ⑦ 缶タワー: 円柱を3段重ねた背の高いシルエット(箱とは違う積み重ねの形)
      const y=yb-o.h;
      g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(x,yb+2,o.w*0.55,o.w*0.14,0,0,TAU);g.fill();
      const canH=o.h/3;
      for(let i=0;i<3;i++){
        const cy0=y+i*canH, cw=o.w*(1-i*0.1);
        const grd=g.createLinearGradient(x-cw/2,0,x+cw/2,0);
        grd.addColorStop(0,shadeC(o.col,-30));grd.addColorStop(0.5,o.col);grd.addColorStop(1,shadeC(o.col,-30));
        g.fillStyle=grd;g.fillRect(x-cw/2,cy0,cw,canH*0.92);
        g.fillStyle="rgba(255,255,255,.25)";g.fillRect(x-cw/2,cy0,cw,canH*0.16);
        g.fillStyle="rgba(255,255,255,.18)";g.beginPath();g.ellipse(x,cy0,cw*0.5,canH*0.1,0,0,TAU);g.fill();
        g.strokeStyle="rgba(0,0,0,.4)";g.lineWidth=Math.max(2,cw*0.06);g.strokeRect(x-cw/2,cy0,cw,canH*0.92);
      }
      drawFace(x,y+canH*0.55,o.w*0.09,false);
    }else if(o.k==="sign"){
      // ⑦ 看板: 細いポール+ひし形の頭。四角いブロック群とは輪郭が全く違う(細長い)
      const poleW=Math.max(3,o.w*0.14),poleH=o.h*0.62,headR=o.w*0.5,py=yb-poleH,headY=py-headR*0.85;
      g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(x,yb+2,o.w*0.28,o.w*0.08,0,0,TAU);g.fill();
      g.fillStyle="#8a8f98";g.fillRect(x-poleW/2,py,poleW,poleH);
      g.fillStyle="rgba(255,255,255,.25)";g.fillRect(x-poleW/2,py,poleW*0.4,poleH);
      g.save();g.translate(x,headY);g.rotate(Math.PI/4);
      const hg=g.createLinearGradient(-headR*0.62,-headR*0.62,headR*0.62,headR*0.62);
      hg.addColorStop(0,shadeC(o.col,26));hg.addColorStop(1,shadeC(o.col,-16));
      g.fillStyle=hg;g.fillRect(-headR*0.62,-headR*0.62,headR*1.24,headR*1.24);
      g.strokeStyle="rgba(255,255,255,.8)";g.lineWidth=Math.max(2,headR*0.12);g.strokeRect(-headR*0.42,-headR*0.42,headR*0.84,headR*0.84);
      g.restore();
      drawFace(x,headY,headR*0.16,false);
    }else{ // car
      const y=yb-o.h;
      g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(x,yb+2,o.w*0.5,o.w*0.1,0,0,TAU);g.fill();
      g.fillStyle=o.col;roundR(x-o.w/2,y+o.h*0.3,o.w,o.h*0.7,8);g.fill();
      // ⑥ 車も元々アウトライン無し。車体の輪郭を太めに縁取りして実写背景に沈まないように
      g.strokeStyle="rgba(0,0,0,.35)";g.lineWidth=Math.max(2,o.w*0.05);roundR(x-o.w/2,y+o.h*0.3,o.w,o.h*0.7,8);g.stroke();
      g.fillStyle=shadeC(o.col,30);roundR(x-o.w*0.32,y,o.w*0.64,o.h*0.5,6);g.fill();
      g.fillStyle="rgba(180,220,255,.85)";roundR(x-o.w*0.24,y+o.h*0.07,o.w*0.48,o.h*0.34,4);g.fill();
      // headlight + cheeky face on the windscreen
      g.fillStyle="#fff3b0";g.beginPath();g.arc(x-o.w*0.44,y+o.h*0.5,o.h*0.1,0,TAU);g.fill();
      g.fillStyle="#222";g.beginPath();g.arc(x-o.w*0.28,yb,o.h*0.22,0,TAU);g.arc(x+o.w*0.28,yb,o.h*0.22,0,TAU);g.fill();
      g.fillStyle="#555";g.beginPath();g.arc(x-o.w*0.28,yb,o.h*0.1,0,TAU);g.arc(x+o.w*0.28,yb,o.h*0.1,0,TAU);g.fill();
      drawFace(x,y+o.h*0.22,o.h*0.12,false);
    }
    // ② ラッキー色ヒント: 今日のラッキー色の障害物は 頭の上で小さな星がキラッ(=気づける秘密のヒント)
    if(o.col===luckyColor && o.k!=="rainbow" && o.k!=="ice" && o.k!=="gold"){
      const ly=groundY-o.h-10, lp=0.5+0.5*Math.sin(sky*0.2+o.bob), rr=Math.max(4,o.w*0.14)*(0.6+0.4*lp);
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.5+0.5*lp;g.fillStyle="#fff7c2";g.translate(x,ly);
      g.beginPath();g.moveTo(0,-rr);g.lineTo(rr*0.28,-rr*0.28);g.lineTo(rr,0);g.lineTo(rr*0.28,rr*0.28);
      g.lineTo(0,rr);g.lineTo(-rr*0.28,rr*0.28);g.lineTo(-rr,0);g.lineTo(-rr*0.28,-rr*0.28);g.closePath();g.fill();
      g.restore();g.globalAlpha=1;}
    g.restore();
  }
  function drawTruck(){
    const yb=groundY, w=truckW;
    // squash&stretch: when slammed down (bounce<0) widen+flatten briefly
    const sq=clamp(-bounce*0.012,0,0.12);
    const h=truckH*(1-sq), bx=truckX, by=yb+bounce;
    g.save();
    // shadow (tighter when airborne)
    const lift=clamp(-bounce*0.02,0,0.5);
    g.fillStyle="rgba(0,0,0,"+(0.22-lift*0.1)+")";
    g.beginPath();g.ellipse(bx+w*0.5,yb+4,w*0.5*(1+sq*0.5),wheelR*0.4*(1-lift),0,0,TAU);g.fill();
    // 画像トラック(右向き・タイヤ込み)。スクワッシュは w/h で表現し、ヘッドライトの光だけ重ねる
    // 実測: 車体は正方形の全幅(x 2..509)、縦は y 98..411 → 底辺は中心から +0.30S。S≒当たり判定幅、底辺=地面に合わせる
    const S=w*1.04;
    if(api.drawAsset("truck.png",bx+w*0.5,by-S*0.31,S*(1+sq*0.4),S*(1-sq),{center:true})){
      g.save();g.globalCompositeOperation="lighter";
      const lr=Math.max(1,w*0.16*(0.7+boost*0.4)), hy=by-h*0.34;
      const lg=g.createRadialGradient(bx+w*1.0,hy,1,bx+w*1.0,hy,lr);
      lg.addColorStop(0,"rgba(255,245,200,.9)");lg.addColorStop(1,"rgba(255,245,200,0)");
      g.fillStyle=lg;g.beginPath();g.arc(bx+w*1.0,hy,lr,0,TAU);g.fill();g.restore();
      g.restore();return;
    }
    // cargo box (vertical gradient)
    const cg=g.createLinearGradient(0,by-h,0,by);
    cg.addColorStop(0,"#d8483a");cg.addColorStop(0.5,"#c0392b");cg.addColorStop(1,"#9e2c20");
    g.fillStyle=cg;g.fillRect(bx,by-h,w*0.6,h);
    g.fillStyle="rgba(255,255,255,.22)";g.fillRect(bx,by-h,w*0.6,h*0.14);
    g.fillStyle="rgba(0,0,0,.22)";g.fillRect(bx,by-h*0.18,w*0.6,h*0.18);
    // diagonal warning stripe panel (decal)
    g.save();g.beginPath();g.rect(bx,by-h*0.62,w*0.6,h*0.2);g.clip();
    const sw=Math.max(8,w*0.05);
    for(let sx=bx-h;sx<bx+w*0.6;sx+=sw*2){g.fillStyle="#f5c518";g.beginPath();
      g.moveTo(sx,by-h*0.42);g.lineTo(sx+sw,by-h*0.42);g.lineTo(sx+sw+h*0.2,by-h*0.62);g.lineTo(sx+h*0.2,by-h*0.62);g.closePath();g.fill();}
    g.restore();
    g.strokeStyle="rgba(0,0,0,.28)";g.lineWidth=2;g.strokeRect(bx,by-h*0.62,w*0.6,h*0.2);
    // panel rivets
    g.fillStyle="rgba(255,255,255,.4)";
    for(let rx=bx+w*0.06;rx<bx+w*0.58;rx+=w*0.12){g.beginPath();g.arc(rx,by-h*0.92,1.8,0,TAU);g.fill();g.beginPath();g.arc(rx,by-h*0.08,1.8,0,TAU);g.fill();}
    g.strokeStyle="rgba(0,0,0,.3)";g.lineWidth=3;g.strokeRect(bx,by-h,w*0.6,h);
    // cab (trapezoid, gradient)
    const cabg=g.createLinearGradient(0,by-h,0,by);
    cabg.addColorStop(0,"#f06b4a");cabg.addColorStop(1,"#d24a30");
    g.fillStyle=cabg;
    g.beginPath();g.moveTo(bx+w*0.6,by-h);g.lineTo(bx+w*0.78,by-h);g.lineTo(bx+w,by-h*0.55);g.lineTo(bx+w,by);g.lineTo(bx+w*0.6,by);g.closePath();g.fill();
    // window (glassy gradient)
    const wg=g.createLinearGradient(bx+w*0.66,by-h*0.92,bx+w*0.95,by-h*0.56);
    wg.addColorStop(0,"#dff1ff");wg.addColorStop(1,"#8fc4ef");
    g.fillStyle=wg;g.beginPath();g.moveTo(bx+w*0.66,by-h*0.92);g.lineTo(bx+w*0.78,by-h*0.92);g.lineTo(bx+w*0.95,by-h*0.56);g.lineTo(bx+w*0.66,by-h*0.56);g.closePath();g.fill();
    g.fillStyle="rgba(255,255,255,.45)";g.beginPath();g.moveTo(bx+w*0.66,by-h*0.92);g.lineTo(bx+w*0.72,by-h*0.92);g.lineTo(bx+w*0.72,by-h*0.56);g.lineTo(bx+w*0.66,by-h*0.56);g.closePath();g.fill();
    // bumper / grille
    g.fillStyle="#3a4150";g.fillRect(bx+w*0.96,by-h*0.5,w*0.06,h*0.5);
    // headlight glow (additive, pulses with boost)
    g.save();g.globalCompositeOperation="lighter";
    const lg=g.createRadialGradient(bx+w*1.0,by-h*0.28,1,bx+w*1.0,by-h*0.28,w*0.16*(0.7+boost*0.4));
    lg.addColorStop(0,"rgba(255,245,200,.9)");lg.addColorStop(1,"rgba(255,245,200,0)");
    g.fillStyle=lg;g.beginPath();g.arc(bx+w*1.0,by-h*0.28,w*0.16*(0.7+boost*0.4),0,TAU);g.fill();g.restore();
    // wheels
    drawWheel(bx+w*0.16,yb,wheelR);
    drawWheel(bx+w*0.74,yb,wheelR);
    g.restore();
  }
  function drawWheel(cx,cy,r){
    g.fillStyle="#1c1c22";g.beginPath();g.arc(cx,cy,r,0,TAU);g.fill();
    g.fillStyle="#5a5f6a";g.beginPath();g.arc(cx,cy,r*0.45,0,TAU);g.fill();
    g.save();g.translate(cx,cy);g.rotate(wheelRot);
    g.strokeStyle="#2c2f37";g.lineWidth=r*0.16;
    for(let i=0;i<4;i++){g.rotate(Math.PI/2);g.beginPath();g.moveTo(0,0);g.lineTo(0,r*0.4);g.stroke();}
    g.restore();
    g.fillStyle="#888d96";g.beginPath();g.arc(cx,cy,r*0.13,0,TAU);g.fill();
  }
  function roundR(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  // irregular angular debris chunk (not a plain square)
  function chunkPts(){const n=rint(4,5),a=[];for(let i=0;i<n;i++){const ang=i/n*TAU+rnd(-0.35,0.35),rr=rnd(0.34,0.55);a.push([Math.cos(ang)*rr,Math.sin(ang)*rr]);}return a;}
  function drawChunk(p){const pts=p.pts,s=p.s;
    g.beginPath();g.moveTo(pts[0][0]*s,pts[0][1]*s);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0]*s,pts[i][1]*s);g.closePath();
    g.fillStyle=p.color;g.fill();
    g.save();g.clip();g.fillStyle="rgba(0,0,0,.28)";g.beginPath();g.moveTo(0,-s);g.lineTo(s,s);g.lineTo(-s,s);g.closePath();g.fill();g.restore();
    g.lineWidth=Math.max(1,s*0.08);g.strokeStyle="rgba(255,255,255,.45)";g.stroke();}
  function shadeC(hex,amt){const c=parseInt(hex.slice(1),16);const r=clamp(((c>>16)&255)+amt,0,255),gg=clamp(((c>>8)&255)+amt,0,255),b=clamp((c&255)+amt,0,255);return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("truck", buildTruck);
