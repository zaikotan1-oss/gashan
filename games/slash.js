function buildSlash(api){
  const g=api.g;
  api.preload(["bg.jpg","barrel.png","boss.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)
  // フルーツ画像は白ベース生成が2回とも失敗(桃色/緑リンゴ+台)したため不採用。手描きフルーツを使う(後日良い画像ができたら true に)
  const USE_FRUIT_IMG=false;
  let objs=[],halves=[],shards=[],trail=[],juice=[],floats=[],sparks=[],flashes=[],stars=[],motes=[],wisps=[],twinkles=[];
  let spawnT,count,combo,comboT,slow,grav,lx,ly,down,elapsed,flashT,charge,auraPh,bgPh;
  let lastNow=0;   // 直近フレームの now(ms)。にじいろフルーツ画像の色巡回に使う
  const RB_COLS=["#ff5aa0","#ff9d2e","#ffe14d","#7dff9a","#5ad6ff","#c07dff"];   // にじいろフルーツ画像の着色巡回(return後に置くとTDZになるので先頭で宣言)
  // stage/progression + fever + lives + boss
  let stage,stageCut,stageQuota,banner,fever,feverT,lives,hurtT,boss,winT,confetti;
  // 軸1(さわって分かるか)向け: 開始直後のステージバナー中にスポーンが完全停止しないよう、最初の1体だけは例外で出す為のフラグ
  let openedOnce;
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  // ① にじいろフルーツ(激レア・予告付き) ② きょうのラッキー色 ③ パーフェクト面 ④ ながれ星
  let luckyColor,luckyName,luckySeen,luckyMsgT,rbMsgT,stageClean,perfectT,rbTele,shootStar,shootT;
  const FRUIT_COLS=[["#e7402c","#ff7a5c"],["#ff9d2e","#ffd08a"],["#8bd23a","#cdf08a"],["#c84bd0","#f0a8f5"]];
  const ICE_COLS=[["#3aa6d2","#bdeaff"],["#5ac8e0","#d6f6ff"]];
  // 7. 軸7(壊す物のバラエティ)向け: 丸(フルーツ)・いびつ五角形(岩)・縦長矩形(樽)以外の新しい形を増やす
  const BOX_COLS=[["#b5793a","#e8c88a"]];              // 木箱(四角、マトリクス状に砕ける)
  const DANGO_COLS=[["#ffb6c1","#fff4e0"],["#8bd23a","#e8ffcf"],["#fff4e0","#ffffff"]]; // 積み重ねだんご(丸へバラける)
  const GEM_COLS=[["#5ad6ff","#eafcff"],["#ffd23f","#fff6c8"],["#ff5ad6","#ffe0f7"]];    // 軸3向け: 小さく速いが高得点のレアだま
  // ② ラッキー色の名前(フルーツの skin 色 → こども向けの色名)
  const LUCKY_NAMES={"#e7402c":"あか","#ff9d2e":"オレンジ","#8bd23a":"みどり","#c84bd0":"むらさき"};
  const KINDS=[
    {t:"fruit",cols:FRUIT_COLS},
    {t:"rock",cols:[["#7a818c","#b3bac4"]]},
    {t:"barrel",cols:[["#9a5a2a","#caa06a"]]},
    {t:"box",cols:BOX_COLS},
    {t:"dango",cols:DANGO_COLS}
  ];
  // each stage: how many cuts to clear, palette accent, gimmick flag, label
  const STAGES=[
    // 軸4(飽きない変化)向け: 短いセッションでもステージ2以降に届くよう目標数を控えめに戻した(22/30/34/38 → 13/20/24/28)
    {need:13,acc:[120,200,255],gim:"none",  name:"はじまり"},
    {need:20,acc:[150,255,160],gim:"cluster",name:"れんけつ"},
    {need:24,acc:[120,200,255],gim:"swarm",  name:"あらし"},
    {need:28,acc:[150,220,255],gim:"ice",    name:"こおり"},
    {need:1, acc:[255,210,120],gim:"boss",   name:"ボス"}
  ];
  function layout(){ grav=clamp(api.H*0.00045,0.26,0.4); buildStars(); buildMotes(); }
  function buildStars(){stars=[];for(let i=0;i<46;i++)stars.push({x:rnd(0,api.W),y:rnd(0,api.H*0.9),r:rnd(0.6,1.8),ph:rnd(0,TAU),sp:rnd(0.6,1.8),tw:rnd(0,TAU),big:Math.random()<0.18});}
  // drifting ambient light-motes that float upward, always present
  function buildMotes(){motes=[];const n=Math.round(clamp(api.W*api.H/26000,22,40));
    for(let i=0;i<n;i++)motes.push(newMote(rnd(0,api.H)));}
  function newMote(y){return{x:rnd(0,api.W),y:y==null?api.H+rnd(0,40):y,
    vx:rnd(-0.18,0.18),vy:-rnd(0.18,0.5),r:rnd(0.8,2.6),ph:rnd(0,TAU),sp:rnd(0.8,2.2),
    hue:pick([[150,210,255],[180,160,255],[255,210,150],[170,255,220]])};}
  function reset(){objs=[];halves=[];shards=[];trail=[];juice=[];floats=[];sparks=[];flashes=[];wisps=[];twinkles=[];spawnT=0;count=0;combo=0;comboT=0;slow=0;down=false;elapsed=0;flashT=0;charge=0;auraPh=0;bgPh=0;
    stage=0;stageCut=0;stageQuota=STAGES[0].need;banner=null;fever=0;feverT=0;lives=3;hurtT=0;boss=null;winT=0;confetti=[];
    luckyColor=pick(FRUIT_COLS)[0];luckyName=LUCKY_NAMES[luckyColor]||"";luckySeen=false;luckyMsgT=0;rbMsgT=0;
    stageClean=true;perfectT=0;rbTele=null;shootStar=null;shootT=rnd(4,9);openedOnce=false;layout();
    // 軸3(歯ごたえ)向け: バナーの滞在(hold)を1.4→1.0に短縮し、開始直後の無スポーン区間を縮める
    spawnBanner("ステージ1 "+STAGES[0].name,1.0);}
  function curStage(){return STAGES[Math.min(stage,STAGES.length-1)];}
  function spawnBanner(txt,hold,big){banner={txt,life:1,hold:hold||1.2,t:0,big:!!big,scl:0};}
  // advance to next stage with a short celebration; loops on final
  function nextStage(){
    // ③ パーフェクト: この面をバレル(あぶない樽)被弾なしでクリアしたら +5 & 中央下に祝福
    if(stageClean){count+=5;api.setScore(count);perfectT=1.9;
      api.tone(1318,0.14,"triangle",0.1);api.tone(1976,0.16,"triangle",0.07);
      for(let i=0;i<16;i++)confetti.push(newConfetti());}
    stageClean=true;   // 次の面のパーフェクト判定をリセット
    const last=stage>=STAGES.length-1;
    if(last){
      // final stage cleared: big full-screen blessing, then loop a touch harder
      winT=2.6;spawnBanner("ぜんステージ クリア！",2.2,true);
      for(let i=0;i<70;i++)confetti.push(newConfetti());
      api.boom&&api.boom(0.7);api.shake(14);if(api.hitStop)api.hitStop(6);
      api.slide(500,1100,0.5,0.2,"triangle");api.slide(700,1500,0.6,0.16,"square");
      stage=0;stageCut=0;stageQuota=STAGES[0].need;elapsed=0;objs=[];boss=null;
      return;
    }
    stage++;stageCut=0;stageQuota=curStage().need;objs=[];
    // 軸3(歯ごたえ)向け: ステージ間バナーの滞在(hold)を1.5→1.0に短縮(バナー中はspawn()停止のため無反応区間を減らす)
    spawnBanner("ステージ"+(stage+1)+" "+curStage().name,1.0);
    for(let i=0;i<26;i++)confetti.push(newConfetti());
    api.boom&&api.boom(0.5);api.shake(9);if(api.hitStop)api.hitStop(4);
    api.slide(520,960,0.34,0.18,"triangle");api.tone(1320,0.18,"square",0.1);
  }
  function newConfetti(){return{x:rnd(0,api.W),y:rnd(-api.H*0.3,0),vx:rnd(-2,2),vy:rnd(2,6),
    r:rnd(4,9),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,
    col:pick(["#ff5a5a","#ffd23f","#5ad6ff","#7dff9a","#ff8cff","#ffa94d"])};}
  function spawnBoss(){
    const r=clamp(api.W*0.12,60,96);
    boss={x:api.W/2,y:api.H+r,vx:0,vy:-Math.sqrt(2*grav*(api.H*0.62)),r,t:"boss",
      skin:"#c0392b",flesh:"#ffcaa0",rot:0,vr:0.02,hp:8,maxhp:8,flash:0,settled:false};   // HP 6→8(7〜8歳向け)
  }
  // 7. 的の大きさをばらつかせる共通ヘルパー: rBase(従来固定値)を核に毎回サイズをランダム化する。
  // 下限は16(狙いが難しくなりすぎない配慮)・上限は70(軸3/軸6向け: 90だと画面を占有しすぎ、的同士も重なって見づらかったため引き下げ)。
  function randR(mul){const rBase=clamp(api.W*0.055,24,46);return clamp(rBase*rnd(0.6,1.6),16,70)*(mul||1);}
  // spawn one object; ice fruits are faster & glassy, cluster spawns a tight bunch
  // big: 4. ステージ1のうちから混ぜる巨大フルーツ(命中でボーナス点)
  // gem: 軸3(歯ごたえ)向け: 小さく速いが高得点の「レアだま」。大きい的=当てやすいが低得点/小さい的=当てにくいが高得点、のトレードオフを作る
  // bigMul: forceBig(開始直後の最初の的)専用の拡大倍率。未指定時は通常の巨大フルーツ倍率(1.5)のまま。
  function pushFruit(x,extra,big,bigMul){
    const gim=curStage().gim;
    const ice=gim==="ice"&&Math.random()<0.55;
    const gem=!ice&&!big&&Math.random()<0.1;
    const col=ice?pick(ICE_COLS):gem?pick(GEM_COLS):pick(FRUIT_COLS);
    const r=gem?clamp(randR(0.5),16,24):randR(ice?0.9:1)*(big?(bigMul||1.5):1);   // 軸3/軸6向け: 巨大フルーツ倍率 1.8→1.5(通常時)。firstOpenだけbigMulで1.8に拡大
    // ice/gem fruits fly faster/higher; later stages add a touch of speed
    const speedMul=(ice?1.18:gem?1.35:1)+stage*0.03;
    const vy=-Math.sqrt(2*grav*(api.H*rnd(0.55,0.82)))*speedMul;
    objs.push({x,y:api.H+r,vx:(rnd(-2.5,2.5)+(api.W/2-x)*0.004)*(extra?extra:1)*(gem?1.4:1),vy,r,
      t:gem?"gem":(ice?"ice":"fruit"),skin:col[0],flesh:col[1],rot:rnd(0,TAU),vr:rnd(-0.12,0.12),big:!!big});
  }
  // ① にじいろフルーツ: 虹色に光る激レア。予告(rbTele)から遅れて打ち上がる
  function pushRainbow(x){
    const r=randR(1.12);
    const vy=-Math.sqrt(2*grav*(api.H*rnd(0.6,0.8)));
    objs.push({x,y:api.H+r,vx:(rnd(-1.5,1.5)+(api.W/2-x)*0.004),vy,r,
      t:"rainbow",skin:"#ff5aa0",flesh:"#fff0a0",rot:rnd(0,TAU),vr:rnd(-0.12,0.12)});
  }
  // 2. 未使用だったKINDS[1]('rock')を実際に出現させる: 丸い果物と違い、いびつな5〜6角形の岩。
  // 壊れ方も halves(真っ二つ)ではなく shards(欠片が四方へ飛ぶ)にして質感を変える。
  function pushRock(x){
    const col=KINDS[1].cols[0];
    const r=randR(rnd(0.8,1.3));
    const vy=-Math.sqrt(2*grav*(api.H*rnd(0.55,0.8)));
    const nSeg=rint(5,6),pts=[];for(let i=0;i<nSeg;i++)pts.push(rnd(0.76,1.14));
    objs.push({x,y:api.H+r,vx:rnd(-2,2)+(api.W/2-x)*0.004,vy,r,
      t:"rock",skin:col[0],flesh:col[1],rot:rnd(0,TAU),vr:rnd(-0.1,0.1),pts});
  }
  // 7. 木箱(box): 丸いフルーツ/いびつな岩/縦長の樽とは違う、四角い"建物・積み荷"寄りの的。壊れ方もマトリクス状の破片にする
  function pushBox(x){
    const col=pick(BOX_COLS);
    const r=randR(rnd(0.85,1.15));
    const vy=-Math.sqrt(2*grav*(api.H*rnd(0.55,0.8)));
    objs.push({x,y:api.H+r,vx:rnd(-2,2)+(api.W/2-x)*0.004,vy,r,
      t:"box",skin:col[0],flesh:col[1],rot:rnd(0,TAU),vr:rnd(-0.08,0.08)});
  }
  // 7. だんご(dango): 積み重なった3つの丸が串に刺さった的。1つの当たり判定だが斬ると3つの丸へバラける(halvesの真っ二つとは違う崩れ方)
  function pushDango(x){
    const cols=[pick(DANGO_COLS),pick(DANGO_COLS),pick(DANGO_COLS)].map(c=>c[0]);
    const r=randR(rnd(0.75,1.05));
    const vy=-Math.sqrt(2*grav*(api.H*rnd(0.5,0.75)));
    objs.push({x,y:api.H+r,vx:rnd(-1.6,1.6)+(api.W/2-x)*0.004,vy,r,
      t:"dango",skin:cols[0],flesh:cols[1],dcols:cols,rot:rnd(0,TAU),vr:rnd(-0.1,0.1)});
  }
  // forceBig: 軸1(さわって分かるか)/軸3(b)向け。開始直後の最初の1体だけは、樽/岩/箱/だんご等の抽選を通さず
  // 確実に大きい(big=true)フルーツを1つ出す。最初の的が大きく・当てやすくなり firstScoreSec を底上げする。
  function spawn(forceBig,bigMul){
    const gim=curStage().gim;
    if(forceBig){pushFruit(rnd(api.W*0.18,api.W*0.82),undefined,true,bigMul);return;}
    // ① 低確率でにじいろフルーツを予告(すぐには出さず、打ち上げ位置がきらめく=次くるかものドキドキ)
    // 軸4(飽きない変化)向け: ステージ1以降限定だったのを外し、ステージ0滞在中でもレア演出に当たるチャンスを残す
    // 軸3(歯ごたえ)向け: 予告演出が出た瞬間でも的の供給が途切れないよう、returnせず通常スポーンへ続ける
    if(!rbTele&&!objs.some(o=>o.t==="rainbow")&&Math.random()<0.03){
      rbTele={x:rnd(api.W*0.28,api.W*0.72),t:0.75};
    }
    // hazard barrels: 軸7(バラエティ)向け、ステージ0(はじまり)からも出す(以前はstage>=1限定で序盤が丸フルーツ+岩だけになっていた)
    if(Math.random()<0.16){
      const r=randR();const x=rnd(api.W*0.2,api.W*0.8);
      const vy=-Math.sqrt(2*grav*(api.H*rnd(0.55,0.78)));
      // 3. 一部は『安全な樽』: 危険な樽(このまま被弾ペナルティ)とは別に、色を差し替えて斬るとボーナスになる的も混ぜる
      // 軸7で樽をステージ0から出すようにした分、初回の面(stage0)は安全な樽の比率を上げ、慣れないうちの被弾連鎖(ライフ0→リスタート)を避ける
      const safe=Math.random()<(stage===0?0.62:0.3);
      objs.push({x,y:api.H+r,vx:rnd(-2,2)+(api.W/2-x)*0.004,vy,r,
        t:safe?"barrel_safe":"barrel",
        skin:safe?"#4a9d3a":"#9a5a2a",flesh:safe?"#bdf29a":"#caa06a",
        rot:rnd(0,TAU),vr:rnd(-0.1,0.1)});
      return;
    }
    // 2. いびつな岩(rock)を混ぜる: 丸い果物とは違う形・違う壊れ方で見た目の単調さを崩す
    if(Math.random()<0.22){pushRock(rnd(api.W*0.18,api.W*0.82));return;}
    // 7. 木箱(box): 四角い的をマトリクス状の破片で
    if(Math.random()<0.15){pushBox(rnd(api.W*0.18,api.W*0.82));return;}
    // 7. だんご(dango): 積み重ね物。1つの的が3つの丸へバラける
    if(Math.random()<0.12){pushDango(rnd(api.W*0.18,api.W*0.82));return;}
    const x=rnd(api.W*0.18,api.W*0.82);
    if(gim==="cluster"&&Math.random()<0.5){
      // connected bunch: a tight cluster a single swipe can clear for a big combo
      const n=rint(3,4);for(let i=0;i<n;i++)pushFruit(clamp(x+(i-(n-1)/2)*42,api.W*0.12,api.W*0.88),0.4);
    }else if(gim==="swarm"){
      const n=rint(2,3);for(let i=0;i<n;i++)pushFruit(rnd(api.W*0.14,api.W*0.86));
    }else{
      // 4. ステージ1のうちから低確率(10%)で巨大フルーツを混ぜ、序盤から大小の対比を体験させる
      pushFruit(x,undefined,stage===0&&Math.random()<0.1);
    }
  }
  function slice(o,ang){
    const i=objs.indexOf(o);if(i<0)return;objs.splice(i,1);
    // barrel = hazard: hit it and lose a life (gentle), no score
    if(o.t==="barrel"){hitHazard(o,ang);return;}
    combo++;comboT=0.7;
    // combo-scaled score; fever doubles it. ice fruits worth a bit more.
    const isRainbow=o.t==="rainbow";
    const isLucky=o.t==="fruit"&&o.skin===luckyColor;   // ② きょうのラッキー色に一致
    const isRock=o.t==="rock";                           // 2. いびつな岩
    const isSafeBarrel=o.t==="barrel_safe";              // 3. 安全な樽(斬るとボーナス)
    const isBox=o.t==="box";                              // 7. 木箱
    const isDango=o.t==="dango";                          // 7. だんご(積み重ね物)
    const isGem=o.t==="gem";                              // 軸3: 小さく速いが高得点のレアだま
    let gain=(1+Math.floor(combo/3))*(fever>0?2:1)*(o.t==="ice"?2:1);
    if(isRainbow)gain+=12;                               // ① 激レア大量得点
    if(isLucky)gain+=2;                                  // ② こっそりボーナス
    if(isSafeBarrel)gain+=6;                             // 3. 安全な樽ボーナス
    if(o.big)gain+=6;                                    // 4. 序盤の巨大フルーツボーナス
    if(isGem)gain+=4;                                    // 軸3: 小さい的ほど得点効率を上げる
    count+=gain;api.setScore(count);
    stageCut++;
    // build the fever gauge with each cut (faster on big combos)
    feverGain(0.05+combo*0.006);
    api.slide(900,300,0.12,0.18,"sawtooth");api.noise(0.12,0.22,2600,"highpass");
    api.tone((o.t==="ice"?700:500)*Math.pow(2,clamp(combo,0,12)/12),0.1,"triangle",0.08);
    if(o.t==="ice")api.tone(1800,0.06,"square",0.05);
    api.shake(4+Math.min(combo,8));
    if(api.hitStop)api.hitStop(combo>=4?3:2);
    slow=Math.max(slow,0.55);
    // burst of light at the cut
    flashes.push({x:o.x,y:o.y,r:o.r*0.9,life:1,col:o.flesh});
    flashT=Math.max(flashT,0.5);
    // feed the persistent energy aura; tops up and decays slowly in frame()
    charge=clamp(charge+0.16+combo*0.012,0,1);
    // curling magic wisps that linger and drift after a cut
    for(let k=rint(2,3);k>0;k--){const a=rnd(0,TAU),s=rnd(1.2,2.8);
      wisps.push({x:o.x,y:o.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.2,life:1,decay:rnd(0.012,0.02),
        r:rnd(5,11),ph:rnd(0,TAU),spin:rnd(-0.06,0.06),hue:combo>=5?[255,235,160]:[160,225,255]});}
    // 2/3/7. 岩は欠片(shard)、安全な樽は矩形の木片、木箱はマトリクス状の破片、だんごは3つの丸へ。丸い果物の halves(真っ二つ)とそれぞれ質感を分ける
    if(isRock){spawnRockShards(o,ang);}
    else if(isSafeBarrel){spawnWoodShards(o,ang);}
    else if(isBox){spawnBoxShards(o,ang);}
    else if(isDango){spawnDangoBalls(o,ang);}
    else{
      const perp=ang+Math.PI/2, push=rnd(2.2,3.6);
      for(const side of [1,-1]){
        halves.push({x:o.x,y:o.y,vx:o.vx+Math.cos(perp)*push*side,vy:o.vy*0.5+Math.sin(perp)*push*side-1,
          r:o.r,skin:o.skin,flesh:o.flesh,t:o.t,cut:ang,side,rot:o.rot,vr:o.vr+rnd(-0.2,0.2)*side,life:1,
          sx:1,sy:1});
      }
    }
    // juicy flesh droplets(岩は果汁でなく粉っぽい破片色にする)
    for(let k=rint(8,13);k>0;k--){const a=rnd(0,TAU),s=rnd(1.5,5.5);
      juice.push({x:o.x,y:o.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(2,5.5),life:1,decay:rnd(0.02,0.035),col:isRock?"#c7cdd6":o.flesh});}
    // bright sparks along the blade direction
    for(let k=rint(7,11);k>0;k--){const a=ang+rnd(-0.5,0.5)+(Math.random()<0.5?0:Math.PI),s=rnd(4,9);
      sparks.push({x:o.x,y:o.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.05,0.09),len:rnd(6,14),
        col:combo>=5?"#fff0a0":"#ffffff"});}
    // ① にじいろフルーツ 撃破: 虹の大きめ演出＋大量得点(フラッシュは低め・すぐ引く)
    if(isRainbow){
      rbMsgT=1.5;charge=clamp(charge+0.3,0,1);
      api.boom&&api.boom(0.55);api.shake(13);if(api.hitStop)api.hitStop(5);
      api.slide(660,1320,0.45,0.2,"triangle");api.tone(1320,0.14,"triangle",0.1);api.tone(1760,0.16,"triangle",0.08);
      flashes.push({x:o.x,y:o.y,r:o.r*1.5,life:1,col:"#fff0a0"});flashT=Math.max(flashT,0.45);
      const rc=["#ff5aa0","#ffd23f","#5ad6ff","#7dff9a","#ff8cff","#ffa94d"];
      for(let k=rint(22,28);k>0;k--){const a=rnd(0,TAU),s=rnd(3,10);
        sparks.push({x:o.x,y:o.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.03,0.06),len:rnd(8,18),col:pick(rc)});}
      for(let k=rint(10,14);k>0;k--){const a=rnd(0,TAU),s=rnd(2,6);
        juice.push({x:o.x,y:o.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,6),life:1,decay:rnd(0.02,0.035),col:pick(rc)});}
      for(let i=0;i<22;i++)confetti.push(newConfetti());
      floats.push({x:o.x,y:o.y-44,txt:"にじいろ！",life:1,vy:-1.1,col:"#ff5aa0",size:40,scl:0});
    }
    // ② ラッキー色 命中: 小さめボーナス＋頭上に小さな星のキラッ(気づけるヒント)。初回だけ中央で色名を教える
    if(isLucky){
      api.tone(1046,0.1,"triangle",0.09);api.tone(1568,0.12,"triangle",0.07);
      twinkles.push({x:o.x,y:o.y-o.r*1.2,r:clamp(api.W*0.03,10,16),life:1,col:"#fff2a0"});
      for(let k=6;k>0;k--){const a=-TAU/4+rnd(-0.7,0.7),s=rnd(2,5);
        sparks.push({x:o.x,y:o.y-o.r*0.5,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:rnd(0.03,0.05),len:rnd(6,12),col:luckyColor});}
      floats.push({x:o.x,y:o.y-40,txt:"ラッキー！",life:1,vy:-1.1,col:luckyColor,size:30,scl:0});
      // 軸6(見やすさ)向け: にじいろメッセージ(rbMsgT)表示中は同時発火させず、1テンポ遅らせて文字の重なりを防ぐ
      if(!luckySeen&&rbMsgT<=0){luckyMsgT=1.9;luckySeen=true;}
    }
    // 3. 安全な樽 命中: 木の香りのする低めの心地よい音＋緑のごほうび表示(危険な樽との違いを音でも明示)
    if(isSafeBarrel){
      api.tone(880,0.1,"triangle",0.09);api.tone(1320,0.08,"triangle",0.06);
      floats.push({x:o.x,y:o.y-o.r-6,txt:"あんぜん！",life:1,vy:-1.1,col:"#7dff9a",size:28,scl:0});
    }
    // 4. 巨大フルーツ 命中: ひときわ大きい表示でボーナスに気づかせる
    if(o.big)floats.push({x:o.x,y:o.y-o.r-14,txt:"おおきい！",life:1,vy:-1.1,col:"#ffd23f",size:36,scl:0});
    if(combo>1)floats.push({x:o.x,y:o.y-30,txt:"x"+combo,life:1,vy:-1.1,col:fever>0?"#ffd23f":combo>=6?"#ff3b3b":combo>=3?"#ff8c42":"#ffd23f",size:combo>=4?42:30,scl:0});
  }
  // 2. 岩の欠片: いびつな向きへ3〜4個飛び散る(丸い果物のhalvesとは別の壊れ方)
  function spawnRockShards(o,ang){
    for(let k=rint(3,4);k>0;k--){
      const a=ang+Math.PI/2*(Math.random()<0.5?1:-1)+rnd(-0.7,0.7),s=rnd(2.5,5.5);
      shards.push({x:o.x,y:o.y,vx:Math.cos(a)*s+o.vx*0.3,vy:Math.sin(a)*s+o.vy*0.3-1,
        rot:rnd(0,TAU),vr:rnd(-0.25,0.25),size:Math.max(4,o.r*rnd(0.32,0.55)),
        skin:o.skin,flesh:o.flesh,shape:"rock",life:1,decay:rnd(0.012,0.02)});
    }
  }
  // 3. 安全な樽の木片: 矩形の破片が飛ぶ(丸い果物・岩とも違う壊れ方)
  function spawnWoodShards(o,ang){
    for(let k=rint(3,4);k>0;k--){
      const a=ang+Math.PI/2*(Math.random()<0.5?1:-1)+rnd(-0.6,0.6),s=rnd(3,6);
      shards.push({x:o.x,y:o.y,vx:Math.cos(a)*s+o.vx*0.3,vy:Math.sin(a)*s+o.vy*0.3-1.4,
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),w:Math.max(4,o.r*rnd(0.5,0.8)),h:Math.max(3,o.r*rnd(0.16,0.26)),
        skin:o.skin,shape:"wood",life:1,decay:rnd(0.012,0.02)});
    }
  }
  // 7. 木箱の破片: 3x3のマス目状(マトリクス)に、それぞれのマスの位置に応じた向きへ飛び散る
  function spawnBoxShards(o,ang){
    for(let ix=0;ix<3;ix++)for(let iy=0;iy<3;iy++){
      const dx=ix-1,dy=iy-1,a=Math.atan2(dy,dx||0.0001)+rnd(-0.25,0.25);
      const s=rnd(2,4)+Math.hypot(dx,dy)*1.1;
      shards.push({x:o.x+dx*o.r*0.28,y:o.y+dy*o.r*0.28,vx:Math.cos(a)*s+o.vx*0.3,vy:Math.sin(a)*s+o.vy*0.3-1.2,
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),w:Math.max(3,o.r*0.34),h:Math.max(3,o.r*0.34),
        skin:o.skin,shape:"wood",life:1,decay:rnd(0.012,0.02)});
    }
  }
  // 7. だんご: halves のような真っ二つでなく、串に刺さっていた3つの丸い団子がそれぞれ別方向へ転がっていく
  function spawnDangoBalls(o,ang){
    const cols=o.dcols||["#ffb6c1","#fff4e0","#8bd23a"];
    const offs=[-1,0,1];
    for(let i=0;i<3;i++){
      const a=ang+Math.PI/2*offs[i]*0.6+rnd(-0.35,0.35),s=rnd(2,4.2);
      halves.push({x:o.x,y:o.y+offs[i]*o.r*0.7,vx:o.vx*0.4+Math.cos(a)*s,vy:o.vy*0.4+Math.sin(a)*s-1.4,
        r:o.r*0.62,skin:cols[i],flesh:tint(cols[i],0.3),t:"dango",cut:0,side:1,rot:rnd(0,TAU),vr:rnd(-0.2,0.2),
        life:1,sx:1,sy:1,full:true});
    }
  }
  // a cut object can also be a boss segment: route boss hits separately
  function hitBoss(ang){
    if(!boss||!boss.settled)return;
    boss.hp--;boss.flash=1;combo++;comboT=0.7;
    feverGain(0.1);
    api.shake(10);api.boom&&api.boom(0.35);if(api.hitStop)api.hitStop(4);
    api.slide(700,260,0.16,0.2,"sawtooth");api.tone(300,0.12,"square",0.1);
    flashes.push({x:boss.x,y:boss.y,r:boss.r*0.9,life:1,col:"#ffd0a0"});
    flashT=Math.max(flashT,0.6);
    for(let k=rint(14,20);k>0;k--){const a=rnd(0,TAU),s=rnd(2,7);
      juice.push({x:boss.x,y:boss.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,7),life:1,decay:rnd(0.02,0.035),col:boss.flesh});}
    for(let k=rint(10,14);k>0;k--){const a=ang+rnd(-0.6,0.6)+(Math.random()<0.5?0:Math.PI),s=rnd(5,11);
      sparks.push({x:boss.x,y:boss.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.05,0.09),len:rnd(8,16),col:"#fff0a0"});}
    floats.push({x:boss.x,y:boss.y-boss.r,txt:boss.hp>0?"のこり"+boss.hp:"やった！",life:1,vy:-1.1,col:"#ffd23f",size:40,scl:0});
    if(boss.hp<=0){
      // boss defeated: huge celebration, count toward clear
      count+=50;api.setScore(count);stageCut++;
      for(let i=0;i<50;i++)confetti.push(newConfetti());
      api.boom&&api.boom(0.7);api.shake(16);if(api.hitStop)api.hitStop(6);
      api.slide(400,1200,0.5,0.22,"triangle");
      for(let k=0;k<30;k++){const a=rnd(0,TAU),s=rnd(4,12);
        sparks.push({x:boss.x,y:boss.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.03,0.06),len:rnd(10,20),col:"#fff0a0"});}
      boss=null;
    }
  }
  // hazard barrel hit: lose a life, soft penalty, no game-over dump
  function hitHazard(o,ang){
    combo=0;stageClean=false;   // ③ この面のパーフェクトは失敗
    if(lives>0)lives--;
    hurtT=0.7;
    api.boom&&api.boom(0.45);api.shake(12);if(api.hitStop)api.hitStop(5);
    api.noise(0.3,0.3,500,"lowpass");api.slide(300,90,0.3,0.22,"sawtooth");
    flashT=Math.max(flashT,0.7);
    for(let k=rint(14,20);k>0;k--){const a=rnd(0,TAU),s=rnd(2,8);
      sparks.push({x:o.x,y:o.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.04,0.08),len:rnd(8,16),col:"#ff7a3a"});}
    for(let k=rint(10,14);k>0;k--){const a=rnd(0,TAU),s=rnd(1.5,5);
      juice.push({x:o.x,y:o.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(2,5),life:1,decay:rnd(0.02,0.035),col:"#3a2a12"});}
    floats.push({x:o.x,y:o.y-30,txt:"いてっ",life:1,vy:-1.1,col:"#ff6a4a",size:34,scl:0});
    if(lives<=0){
      // gentle reset: refill hearts, restart from stage 1, keep playing
      // 軸3(歯ごたえ)向け: このバナー中もspawn()が完全停止するため、hold 1.6→1.0に短縮(無反応区間の追加を防ぐ)
      spawnBanner("もういちど チャレンジ！",1.0);
      lives=3;stage=0;stageCut=0;stageQuota=STAGES[0].need;objs=[];boss=null;fever=0;feverT=0;elapsed=0;stageClean=true;
      for(let i=0;i<20;i++)confetti.push(newConfetti());
    }
  }
  function feverGain(a){
    if(feverT>0)return; // already in fever, gauge holds
    fever=clamp(fever+a,0,1);
    if(fever>=1){feverT=6;api.boom&&api.boom(0.6);api.shake(12);
      // 軸3(歯ごたえ)向け: フィーバー突入時もspawn()が止まるため、hold 1.4→0.9に短縮(盛り上がり直後の無反応区間を防ぐ)
      spawnBanner("フィーバー タイム！",0.9);
      api.slide(600,1400,0.4,0.2,"triangle");api.slide(900,1800,0.5,0.14,"square");
      for(let i=0;i<24;i++)confetti.push(newConfetti());}
  }
  // 軸1/軸3向け: tol は単発タップ(down)由来の呼び出しだけに渡す当たり判定の許容半径の上乗せ(px)。
  // ドラッグして斬るswipe(move側のsegHit呼び出し)はtol無指定=0のままで、連打で伸びすぎないようにする。
  function segHit(ax,ay,bx,by,tol){
    const dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy,ang=Math.atan2(dy,dx)||0,rTol=tol||0;
    for(const o of objs){
      let t=L2?((o.x-ax)*dx+(o.y-ay)*dy)/L2:0;t=clamp(t,0,1);
      const cx=ax+dx*t,cy=ay+dy*t;
      if(Math.hypot(o.x-cx,o.y-cy)<=o.r+rTol){slice(o,ang);}
    }
    // boss is a separate big target with HP
    if(boss&&boss.settled){
      let t=L2?((boss.x-ax)*dx+(boss.y-ay)*dy)/L2:0;t=clamp(t,0,1);
      const cx=ax+dx*t,cy=ay+dy*t;
      if(Math.hypot(boss.x-cx,boss.y-cy)<=boss.r+rTol){hitBoss(ang);}
    }
    // ④ ながれ星: 空をよぎる星をスワイプがかすめたら ごほうび(コイン)。減点なし・既存操作と衝突しない
    if(shootStar&&!shootStar.hit){
      let t=L2?((shootStar.x-ax)*dx+(shootStar.y-ay)*dy)/L2:0;t=clamp(t,0,1);
      const cx=ax+dx*t,cy=ay+dy*t;
      if(Math.hypot(shootStar.x-cx,shootStar.y-cy)<=22+rTol){catchStar();}
    }
  }
  // ④ ながれ星を斬った: 小さなコイン＋きらめき(ペナルティなし)
  function catchStar(){
    if(!shootStar||shootStar.hit)return;
    const sx=shootStar.x,sy=shootStar.y;shootStar.hit=true;shootStar=null;
    count+=3;api.setScore(count);
    api.tone(1318,0.1,"triangle",0.09);api.tone(1976,0.12,"triangle",0.07);
    floats.push({x:sx,y:sy-20,txt:"ながれ星！",life:1,vy:-1.1,col:"#fff2a0",size:30,scl:0});
    for(let k=10;k>0;k--){const a=rnd(0,TAU),s=rnd(2,6);
      sparks.push({x:sx,y:sy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.03,0.05),len:rnd(6,12),col:"#fff2a0"});}
    for(let k=6;k>0;k--)twinkles.push({x:sx+rnd(-14,14),y:sy+rnd(-10,10),r:clamp(api.W*0.03,10,16),life:1,col:"#fff2a0"});
  }
  reset();
  return{
    resize:layout,
    input(px,py,type){
      // 軸1(さわって分かるか)向け: 「スワイプ」を知らない子がその場をタップするだけの入力(down/up 直後で move が来ない)でも、
      // 触れた位置に的があれば1回だけ判定する。ドラッグして斬る操作はこれまで通り move側の segHit がそのまま処理する。
      // 軸1(さわって分かるか)/軸3(a): 狙いがブレがちな低学年の単発タップでも拾えるよう、down由来のsegHitだけ
      // 許容半径を+8px広げる(スワイプ側のsegHit呼び出しはtol無しのまま=連打しても伸びすぎない)
      if(type==="down"){down=true;lx=px;ly=py;trail=[{x:px,y:py,life:1}];segHit(px-1,py,px+1,py,8);}
      else if(type==="move"){if(!down){lx=px;ly=py;return;}
        trail.push({x:px,y:py,life:1});if(trail.length>16)trail.shift();
        if(lx!=null)segHit(lx,ly,px,py);lx=px;ly=py;}
      else if(type==="up"){down=false;}
    },
    frame(dt,now){
      elapsed+=dt/60;lastNow=now||0;
      // fever slows time slightly for that satisfying bullet-time feel
      if(feverT>0){feverT-=dt/60;if(feverT<=0){feverT=0;fever=0;}}
      const feverSlow=feverT>0?0.28:0;
      const f=dt*(1-slow*0.75)*(1-feverSlow); slow*=Math.pow(0.86,dt);
      auraPh+=0.02*dt;bgPh+=0.006*dt;
      // charge slowly decays so the aura breathes back down between flurries
      charge*=Math.pow(0.992,dt);
      // bg: 画像(夜空)があればそれを敷き、ステージの差し色を薄く重ねる。無ければ従来の手描き夜空。
      let imgBg=false;
      if(api.drawCover("bg.jpg")){imgBg=true;
        if(stage>0){const acc=curStage().acc;g.save();g.globalAlpha=0.14;
          g.fillStyle="rgb("+acc[0]+","+acc[1]+","+acc[2]+")";g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
      // bg: deep dusk gradient
      let grd=g.createLinearGradient(0,0,0,api.H);
      grd.addColorStop(0,"#23314f");grd.addColorStop(0.5,"#172642");grd.addColorStop(1,"#0a1322");
      g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      // slow-drifting aurora nebula (two soft hue-shifting blobs, always present)
      g.globalCompositeOperation="lighter";
      const nb1x=api.W*(0.32+0.14*Math.sin(bgPh)),nb1y=api.H*(0.3+0.08*Math.cos(bgPh*0.8));
      let nb1=g.createRadialGradient(nb1x,nb1y,0,nb1x,nb1y,api.H*0.55);
      nb1.addColorStop(0,"rgba(80,130,220,.13)");nb1.addColorStop(1,"rgba(80,130,220,0)");
      g.fillStyle=nb1;g.fillRect(0,0,api.W,api.H);
      const nb2x=api.W*(0.7+0.12*Math.cos(bgPh*0.7)),nb2y=api.H*(0.42+0.1*Math.sin(bgPh*1.1));
      let nb2=g.createRadialGradient(nb2x,nb2y,0,nb2x,nb2y,api.H*0.5);
      nb2.addColorStop(0,"rgba(150,90,210,.11)");nb2.addColorStop(1,"rgba(150,90,210,0)");
      g.fillStyle=nb2;g.fillRect(0,0,api.W,api.H);
      g.globalCompositeOperation="source-over";
      // soft glow up top (moonlight)
      let mg=g.createRadialGradient(api.W*0.5,-api.H*0.18,0,api.W*0.5,-api.H*0.18,api.H*0.85);
      mg.addColorStop(0,"rgba(120,170,230,.22)");mg.addColorStop(1,"rgba(120,170,230,0)");
      g.fillStyle=mg;g.fillRect(0,0,api.W,api.H);
      }
      // twinkling stars (brighter sparkle + cross-glints on the big ones) ※画像背景のときは絵の星と喧嘩するので描かない
      const tw=now*0.001;
      g.globalCompositeOperation="lighter";
      if(!imgBg) for(const s of stars){const tk=0.5+0.5*Math.sin(tw*s.sp+s.ph),a=0.3+0.55*tk;
        g.globalAlpha=a;g.fillStyle="#dce8ff";g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();
        if(s.big){const gl=s.r*(2.4+1.6*tk);g.globalAlpha=a*0.55;g.fillStyle="rgba(190,220,255,1)";
          g.fillRect(s.x-gl,s.y-0.6,gl*2,1.2);g.fillRect(s.x-0.6,s.y-gl,1.2,gl*2);}}
      g.globalAlpha=1;g.globalCompositeOperation="source-over";
      // drifting ambient light-motes (gentle upward float, soft pulse)
      g.globalCompositeOperation="lighter";
      for(const m of motes){m.x+=m.vx*f+Math.sin(auraPh*0.4+m.ph)*0.12*f;m.y+=m.vy*f;m.ph+=0.02*m.sp*dt;
        if(m.y<-10){const nm=newMote();m.x=nm.x;m.y=api.H+8;m.vx=nm.vx;m.vy=nm.vy;m.r=nm.r;m.hue=nm.hue;}
        const pa=0.18+0.22*(0.5+0.5*Math.sin(m.ph)),rr=m.r*(1+0.3*Math.sin(m.ph)),c=m.hue;
        const mgr=g.createRadialGradient(m.x,m.y,0,m.x,m.y,rr*3);
        mgr.addColorStop(0,"rgba("+c[0]+","+c[1]+","+c[2]+","+pa+")");
        mgr.addColorStop(1,"rgba("+c[0]+","+c[1]+","+c[2]+",0)");
        g.fillStyle=mgr;g.beginPath();g.arc(m.x,m.y,rr*3,0,TAU);g.fill();}
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
      // ④ ながれ星: 尾を引く小さな流星(加算・面積ごく小さいので白飛びしない)
      if(shootStar){const s=shootStar;g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
        g.globalAlpha=0.9;g.strokeStyle="rgba(255,245,205,.95)";g.lineWidth=2.4;
        g.beginPath();g.moveTo(s.x,s.y);g.lineTo(s.x-s.vx*6,s.y-s.vy*6);g.stroke();
        g.fillStyle="#ffffff";g.beginPath();g.arc(s.x,s.y,3,0,TAU);g.fill();
        g.restore();g.globalCompositeOperation="source-over";g.globalAlpha=1;}
      // ① にじいろフルーツ 予告: 打ち上げ位置(下ふち)から虹色のきらめきが立ちのぼる
      if(rbTele){const bx=rbTele.x,by=api.H,tt=clamp(rbTele.t/0.75,0,1),pulse=0.5+0.5*Math.sin(now*0.02);
        g.save();g.globalCompositeOperation="lighter";
        const rg=g.createRadialGradient(bx,by,0,bx,by,api.H*0.16);
        rg.addColorStop(0,"rgba(255,225,150,"+(0.06+0.14*(1-tt))+")");rg.addColorStop(1,"rgba(255,225,150,0)");
        g.fillStyle=rg;g.beginPath();g.arc(bx,by,api.H*0.16,0,TAU);g.fill();
        const rc=["#ff5aa0","#ffd23f","#5ad6ff","#7dff9a"];
        for(let k=0;k<4;k++){g.globalAlpha=(0.35+0.45*pulse)*(1-tt*0.4);g.fillStyle=rc[k];
          const yy=by-(0.12+k*0.15+(1-tt)*0.32)*api.H*0.42;
          g.beginPath();g.arc(bx+Math.sin(now*0.01+k*1.6)*10,yy,3.4,0,TAU);g.fill();}
        g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";}
      // boss stage: spawn the boss once, no normal spawns until it's gone
      const isBoss=curStage().gim==="boss";
      if(isBoss&&!boss&&banner==null&&winT<=0&&stageCut<stageQuota){spawnBoss();}
      // spawn (paused during banner pauses and boss fights for a calmer beat)
      // 軸1(さわって分かるか)向け: 開始直後のステージ1バナー(hold中はspawn()停止)でも、1回だけは例外で的を出し
      // 「ゲーム開始1秒以内に最初の的が画面に出る」ようにする(2回目以降のバナーは従来通り完全停止)
      if(!isBoss&&(banner==null||!openedOnce)){
        spawnT-=dt;if(spawnT<=0){
          const firstOpen=!openedOnce;
          if(firstOpen){
            // 軸1/軸3(b)向け: 開始直後だけは、画面のあちこちに大きいフルーツ(forceBig)を必ず3体出す(確率抽選なし)。
            // 以前は3体目が60%抽選だったため運悪く2体しか出ない回があり、firstScoreSecの中央値が3.15秒と
            // 合格線(<=3秒)をわずかに超えていた。数を固定した上で、さらにbigMul=1.8で通常のbig(1.5倍)より
            // 一回り大きく・当てやすくして最初のタップの命中率を底上げする。
            spawn(true,1.8);spawn(true,1.8);spawn(true,1.8);
          }else{
            spawn();if(Math.random()<0.35+Math.min(stage*0.06,0.3))spawn();
          }
          spawnT=clamp(36-stage*4-elapsed*0.2,16,36);openedOnce=true;}   // 出現間隔 56→48→36(軸3(c) maxQuietSecの中央値を合格線<=12秒内に収めるため詰めた)
      }
      // ① にじいろフルーツ 予告 → 打ち上げ
      if(rbTele){rbTele.t-=dt/60;if(rbTele.t<=0){pushRainbow(rbTele.x);rbTele=null;}}
      // ④ ながれ星: たまに空をよぎる。当たると catchStar(斬れなかったら消える・ペナルティなし)
      if(shootStar){shootStar.x+=shootStar.vx*f;shootStar.y+=shootStar.vy*f;
        if(shootStar.x<-40||shootStar.x>api.W+40||shootStar.y>api.H*0.52)shootStar=null;}
      else if(banner==null&&winT<=0){shootT-=dt/60;if(shootT<=0){
        const fromL=Math.random()<0.5;
        shootStar={x:fromL?-20:api.W+20,y:rnd(api.H*0.08,api.H*0.3),
          vx:(fromL?1:-1)*rnd(3,4.5),vy:rnd(0.6,1.4),hit:false};
        shootT=rnd(6,12);}}
      // stage clear check (boss stage clears when boss is defeated)
      if(stageCut>=stageQuota&&banner==null&&winT<=0&&boss==null){nextStage();}
      // update + draw boss
      if(boss){
        boss.flash*=Math.pow(0.86,dt);
        if(!boss.settled){
          boss.vy+=grav*f*0.6;boss.y+=boss.vy*f;
          if(boss.vy>=0&&boss.y>=api.H*0.34){boss.settled=true;boss.vy=0;spawnBanner("ボスを なんかい きろう！",0.9);}
        }else{
          boss.y=api.H*0.34+Math.sin(auraPh*1.2)*10;boss.rot+=boss.vr*f;
        }
        drawBoss(boss);
      }
      // objects
      for(const o of objs){o.vy+=grav*f;o.x+=o.vx*f;o.y+=o.vy*f;o.rot+=o.vr*f;}
      objs=objs.filter(o=>o.y<api.H+o.r*2.5);
      for(const o of objs)drawWhole(o);
      // halves (squash relaxes back to round after the cut)
      for(const h of halves){h.vy+=grav*f;h.x+=h.vx*f;h.y+=h.vy*f;h.rot+=h.vr*f;
        h.sx=lerp(h.sx,1,0.12*f);h.sy=lerp(h.sy,1,0.12*f);if(h.y>api.H+h.r*2)h.life=0;}
      halves=halves.filter(h=>h.life>0);
      for(const h of halves)drawHalf(h);
      // 2/3. 岩の欠片・安全な樽の木片(halvesとは別の壊れ方の粒)
      for(const sd of shards){sd.vy+=grav*f;sd.x+=sd.vx*f;sd.y+=sd.vy*f;sd.rot+=sd.vr*f;sd.life-=sd.decay*f;
        if(sd.y>api.H+60)sd.life=0;}
      shards=shards.filter(sd=>sd.life>0);
      for(const sd of shards)drawShard(sd);
      // flash bursts at cut points (additive glow)
      g.globalCompositeOperation="lighter";
      for(const fb of flashes){fb.life-=0.07*dt;const a=Math.max(0,fb.life);const rr=fb.r*(1+(1-fb.life)*2.4);
        const fg=g.createRadialGradient(fb.x,fb.y,0,fb.x,fb.y,rr);
        fg.addColorStop(0,"rgba(255,255,255,"+(a*0.9)+")");fg.addColorStop(0.4,"rgba(255,245,200,"+(a*0.5)+")");fg.addColorStop(1,"rgba(255,200,120,0)");
        g.fillStyle=fg;g.beginPath();g.arc(fb.x,fb.y,rr,0,TAU);g.fill();}
      g.globalCompositeOperation="source-over";
      flashes=flashes.filter(fb=>fb.life>0);
      // juice droplets (glossy, with highlight)
      for(const j of juice){j.vy+=grav*f;j.x+=j.vx*f;j.y+=j.vy*f;j.life-=j.decay*f;
        const a=Math.max(0,j.life);g.globalAlpha=a;g.fillStyle=j.col;g.beginPath();g.arc(j.x,j.y,j.r,0,TAU);g.fill();
        g.globalAlpha=a*0.6;g.fillStyle="rgba(255,255,255,.8)";g.beginPath();g.arc(j.x-j.r*0.3,j.y-j.r*0.3,j.r*0.35,0,TAU);g.fill();}
      g.globalAlpha=1;juice=juice.filter(j=>j.life>0&&j.y<api.H+20);
      // sparks (bright streaks, additive)
      g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*f;sp.y+=sp.vy*f;sp.vx*=Math.pow(0.9,dt);sp.vy*=Math.pow(0.9,dt);sp.life-=sp.decay*f;
        const a=Math.max(0,sp.life);g.globalAlpha=a;g.strokeStyle=sp.col;g.lineWidth=2.2;
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-sp.vx*sp.len*0.12,sp.y-sp.vy*sp.len*0.12);g.stroke();}
      g.globalAlpha=1;g.globalCompositeOperation="source-over";
      sparks=sparks.filter(sp=>sp.life>0);
      // ② ラッキー色/④ ながれ星 の小さな星のキラッ(加算・4点星・ごく小面積)
      if(twinkles.length){g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
        for(const tk of twinkles){tk.y-=0.3*f;tk.life-=0.03*dt;const a=Math.max(0,tk.life),r=tk.r*(0.5+a*0.8);
          g.globalAlpha=a;g.strokeStyle=tk.col;g.lineWidth=2;
          g.beginPath();g.moveTo(tk.x-r,tk.y);g.lineTo(tk.x+r,tk.y);g.moveTo(tk.x,tk.y-r);g.lineTo(tk.x,tk.y+r);g.stroke();
          g.globalAlpha=a*0.85;g.fillStyle="#ffffff";g.beginPath();g.arc(tk.x,tk.y,r*0.26,0,TAU);g.fill();}
        g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";}
      twinkles=twinkles.filter(t=>t.life>0);
      // lingering magic wisps (soft curling orbs left after a cut)
      g.globalCompositeOperation="lighter";
      for(const w of wisps){w.vy+=0.012*f;w.x+=w.vx*f;w.y+=w.vy*f;w.vx*=Math.pow(0.96,dt);w.vy*=Math.pow(0.96,dt);
        w.ph+=w.spin*dt;w.life-=w.decay*f;const a=Math.max(0,w.life),c=w.hue,rr=w.r*(0.6+a*0.7);
        const wg=g.createRadialGradient(w.x,w.y,0,w.x,w.y,rr);
        wg.addColorStop(0,"rgba("+c[0]+","+c[1]+","+c[2]+","+(a*0.5)+")");
        wg.addColorStop(1,"rgba("+c[0]+","+c[1]+","+c[2]+",0)");
        g.fillStyle=wg;g.beginPath();g.arc(w.x,w.y,rr,0,TAU);g.fill();}
      g.globalCompositeOperation="source-over";
      wisps=wisps.filter(w=>w.life>0);
      // persistent charge aura: energy ribbon glow that swells with combo flow
      if(charge>0.02){
        g.globalCompositeOperation="lighter";
        const ca=charge,pulse=0.85+0.15*Math.sin(auraPh*1.4);
        // ground-up energy glow rising from the bottom edge
        let ag=g.createLinearGradient(0,api.H,0,api.H*(1-0.32*ca));
        ag.addColorStop(0,"rgba(120,200,255,"+(0.22*ca*pulse)+")");
        ag.addColorStop(0.5,"rgba(150,120,255,"+(0.1*ca*pulse)+")");
        ag.addColorStop(1,"rgba(150,120,255,0)");
        g.fillStyle=ag;g.fillRect(0,api.H*(1-0.32*ca),api.W,api.H*0.32*ca);
        // soft top crown glow to frame the play field
        let tg=g.createLinearGradient(0,0,0,api.H*0.22);
        tg.addColorStop(0,"rgba(140,180,255,"+(0.12*ca*pulse)+")");
        tg.addColorStop(1,"rgba(140,180,255,0)");
        g.fillStyle=tg;g.fillRect(0,0,api.W,api.H*0.22);
        g.globalCompositeOperation="source-over";
      }
      // trail: glowing tapered blade
      for(const p of trail)p.life-=0.08*dt;
      trail=trail.filter(p=>p.life>0);
      if(trail.length>1){
        g.lineCap="round";g.lineJoin="round";
        const n=trail.length,tipA=trail[n-1].life;
        g.globalCompositeOperation="lighter";
        // outer soft glow (cyan halo)
        g.strokeStyle="rgba(120,210,255,.32)";g.globalAlpha=tipA;
        g.beginPath();g.moveTo(trail[0].x,trail[0].y);for(let i=1;i<n;i++)g.lineTo(trail[i].x,trail[i].y);
        g.lineWidth=22;g.stroke();
        g.globalCompositeOperation="source-over";
        // tapered body segments (thin at tail, wide near tip)
        for(let i=1;i<n;i++){
          const t=i/(n-1);
          g.strokeStyle="rgba(190,235,255,.55)";g.globalAlpha=trail[i].life;
          g.lineWidth=3+13*t;
          g.beginPath();g.moveTo(trail[i-1].x,trail[i-1].y);g.lineTo(trail[i].x,trail[i].y);g.stroke();
          g.strokeStyle="rgba(255,255,255,.98)";g.lineWidth=1.5+5*t;
          g.beginPath();g.moveTo(trail[i-1].x,trail[i-1].y);g.lineTo(trail[i].x,trail[i].y);g.stroke();
        }
        // bright tip dot
        g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(255,255,255,"+tipA+")";g.beginPath();g.arc(trail[n-1].x,trail[n-1].y,5,0,TAU);g.fill();
        g.globalCompositeOperation="source-over";
        g.globalAlpha=1;
      }
      // combo floats (pop-in scale + glow)
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      for(const fl of floats){fl.y+=fl.vy*dt;fl.life-=0.016*dt;fl.scl=lerp(fl.scl,1,0.25*dt);
        const a=Math.max(0,fl.life),pop=ease?ease(clamp(fl.scl,0,1)):fl.scl;
        g.save();g.translate(fl.x,fl.y);g.scale(0.6+pop*0.5,0.6+pop*0.5);g.globalAlpha=a;
        g.font="800 "+fl.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.shadowColor=fl.col;g.shadowBlur=18;
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(fl.txt,0,0);
        g.fillStyle=fl.col;g.fillText(fl.txt,0,0);g.shadowBlur=0;g.restore();}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // brief whole-screen flash on a cut
      if(flashT>0){flashT-=0.05*dt;g.globalAlpha=Math.max(0,flashT)*0.16;g.fillStyle="#fff";g.fillRect(0,0,api.W,api.H);g.globalAlpha=1;}
      // fever overlay: warm golden vignette pulsing while active
      if(feverT>0){
        g.globalCompositeOperation="lighter";
        const fp=0.10+0.06*Math.sin(now*0.02);
        let fv=g.createRadialGradient(api.W/2,api.H/2,api.H*0.2,api.W/2,api.H/2,api.H*0.75);
        fv.addColorStop(0,"rgba(255,210,60,0)");fv.addColorStop(1,"rgba(255,180,40,"+fp+")");
        g.fillStyle=fv;g.fillRect(0,0,api.W,api.H);
        g.globalCompositeOperation="source-over";
      }
      // confetti (stage clear / fever / win celebrations)
      for(const c of confetti){c.vy+=0.12*f;c.x+=c.vx*f;c.y+=c.vy*f;c.rot+=c.vr*f;c.life-=0.006*dt;
        if(c.y>api.H+20)c.life=0;}
      confetti=confetti.filter(c=>c.life>0);
      for(const c of confetti){g.save();g.translate(c.x,c.y);g.rotate(c.rot);g.globalAlpha=Math.max(0,c.life);
        g.fillStyle=c.col;g.fillRect(-c.r/2,-c.r/2,c.r,c.r*0.6);g.restore();}
      g.globalAlpha=1;
      // ① にじいろフルーツ！ 中央バナー(虹色に色替わり=レアの大きな祝福)
      if(rbMsgT>0){rbMsgT-=dt/60;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,cols=["#ff5aa0","#ffd23f","#5ad6ff","#7dff9a","#ff8cff"];
        const col=cols[Math.floor(now*0.006)%cols.length];
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 "+Math.round(clamp(api.W*0.075,28,46))+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("にじいろフルーツ！",0,0);
        g.fillStyle=col;g.fillText("にじいろフルーツ！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央上の小ヒント(初回だけ)
      if(luckyMsgT>0){luckyMsgT-=dt/60;
        g.save();g.translate(api.W/2,api.H*0.27);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 "+Math.round(clamp(api.W*0.045,18,26))+"px 'Hiragino Maru Gothic ProN',system-ui";
        // 軸6(見やすさ)向け: 「色」は2年生配当漢字で1年生には読みにくいため、ひらがなの「いろ」に統一
        const t2="きょうのラッキーいろは "+luckyName+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ パーフェクト！ 中央下(ステージ名バナーと重ねない位置)
      if(perfectT>0){perfectT-=dt/60;
        const pop=1+Math.max(0,perfectT-1.4)*1.3;
        g.save();g.translate(api.W/2,api.H*0.64);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(perfectT*1.3,0,1);g.font="900 "+Math.round(clamp(api.W*0.06,24,38))+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("パーフェクト！",0,0);
        g.shadowColor="rgba(125,255,154,.9)";g.shadowBlur=14;g.fillStyle="#c7ffd0";g.fillText("パーフェクト！",0,0);g.shadowBlur=0;
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(perfectT<0)perfectT=0;}
      // HUD: hearts (lives) + stage label + fever gauge
      drawHUD(now);
      // stage / fever banner
      if(banner){banner.t+=dt/60;banner.scl=lerp(banner.scl,1,0.22*dt);
        if(banner.t>banner.hold)banner.life-=0.04*dt;
        if(banner.life<=0)banner=null;else drawBanner(banner,now);}
      // hint: cute rounded glowing panel with a tiny ninja-blade mascot (hide during banners/boss)
      if(banner==null&&!boss&&winT<=0)drawHint(now);
      if(winT>0)winT-=dt/60;
    }
  };
  // rounded-rect path helper
  function rrect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  // cozy floating hint pill with soft glow, outline, and a little blade mascot that bobs
  function drawHint(now){
    const txt="ゆびで スワイプして スパッと きろう！";
    const bob=Math.sin(now*0.004),pulse=0.5+0.5*Math.sin(now*0.003);
    const fs=clamp(api.W*0.04,15,20);
    g.font="800 "+fs+"px 'Hiragino Maru Gothic ProN',system-ui";
    const tm=g.measureText?g.measureText(txt):null;
    const tw=(tm&&tm.width)?tm.width:txt.length*fs*0.95;
    const padX=fs*1.1,iconW=fs*1.5;
    const w=tw+padX*2+iconW, h=fs*2.2;
    const x=api.W/2-w/2, y=api.H-h-fs*0.7+bob*3;
    g.save();
    // outer soft glow halo
    g.globalCompositeOperation="lighter";
    const hg=g.createRadialGradient(api.W/2,y+h/2,0,api.W/2,y+h/2,w*0.7);
    hg.addColorStop(0,"rgba(130,200,255,"+(0.14+0.06*pulse)+")");hg.addColorStop(1,"rgba(130,200,255,0)");
    g.fillStyle=hg;g.fillRect(x-w*0.3,y-h,w*1.6,h*3);
    g.globalCompositeOperation="source-over";
    // panel body: translucent rounded pill with vertical sheen
    rrect(x,y,w,h,h/2);
    const bg=g.createLinearGradient(0,y,0,y+h);
    bg.addColorStop(0,"rgba(46,64,104,.82)");bg.addColorStop(1,"rgba(26,40,72,.82)");
    g.fillStyle=bg;g.fill();
    // top inner shine
    rrect(x+4,y+3,w-8,h*0.42,h*0.3);
    g.fillStyle="rgba(255,255,255,.10)";g.fill();
    // glowing rounded border
    rrect(x,y,w,h,h/2);
    g.lineWidth=2.5;g.strokeStyle="rgba(150,215,255,"+(0.6+0.3*pulse)+")";
    g.shadowColor="rgba(120,200,255,.9)";g.shadowBlur=10;g.stroke();g.shadowBlur=0;
    // little blade mascot (rounded sword with a smiley face) on the left, gently swinging
    const mx=x+padX*0.7+iconW*0.4,my=y+h/2,sw=fs*0.18*bob;
    g.save();g.translate(mx,my);g.rotate(-0.5+sw);
    // blade
    const bl=fs*1.0;
    g.fillStyle="#dff1ff";rrect(-fs*0.16,-bl,fs*0.32,bl*1.2,fs*0.16);g.fill();
    g.fillStyle="rgba(180,225,255,.7)";rrect(-fs*0.16,-bl,fs*0.13,bl*1.2,fs*0.13);g.fill();
    // guard + handle
    g.fillStyle="#ffcf5a";rrect(-fs*0.34,bl*0.2,fs*0.68,fs*0.16,fs*0.08);g.fill();
    g.fillStyle="#b06a2c";rrect(-fs*0.1,bl*0.36,fs*0.2,fs*0.4,fs*0.08);g.fill();
    // happy face on the blade
    g.fillStyle="#1a2a4a";
    g.beginPath();g.arc(-fs*0.05,-bl*0.45,fs*0.06,0,TAU);g.fill();
    g.beginPath();g.arc(fs*0.05,-bl*0.45,fs*0.06,0,TAU);g.fill();
    g.lineWidth=fs*0.05;g.strokeStyle="#1a2a4a";g.lineCap="round";
    g.beginPath();g.arc(0,-bl*0.34,fs*0.09,0.15*Math.PI,0.85*Math.PI);g.stroke();
    g.restore();
    // text with outline + soft glow
    g.textAlign="left";g.textBaseline="middle";
    const tx=mx+iconW*0.55,ty=y+h/2+1;
    g.lineWidth=fs*0.4;g.strokeStyle="rgba(15,25,45,.7)";g.strokeText(txt,tx,ty);
    g.shadowColor="rgba(140,210,255,.8)";g.shadowBlur=8;
    g.fillStyle="#eaf6ff";g.fillText(txt,tx,ty);g.shadowBlur=0;
    g.restore();
    g.textAlign="left";g.textBaseline="alphabetic";
  }
  // big arcade banner (stage names, fever, win). big=full-screen blessing.
  function drawBanner(b,now){
    const pop=ease?ease(clamp(b.scl,0,1)):b.scl;
    const a=Math.max(0,Math.min(1,b.life));
    g.save();
    if(b.big){g.globalAlpha=a*0.5;g.fillStyle="rgba(20,14,40,1)";g.fillRect(0,0,api.W,api.H);g.globalAlpha=1;}
    const cy=b.big?api.H*0.42:api.H*0.32;
    const fs=clamp(api.W*(b.big?0.1:0.075),28,b.big?72:54)*(0.6+pop*0.5);
    g.translate(api.W/2,cy);g.globalAlpha=a;
    g.font="900 "+fs+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
    // glow behind text
    g.globalCompositeOperation="lighter";
    const acc=curStage().acc;
    const gg=g.createRadialGradient(0,0,0,0,0,fs*4);
    gg.addColorStop(0,"rgba("+acc[0]+","+acc[1]+","+acc[2]+","+(0.4*a)+")");
    gg.addColorStop(1,"rgba("+acc[0]+","+acc[1]+","+acc[2]+",0)");
    g.fillStyle=gg;g.fillRect(-fs*5,-fs*2,fs*10,fs*4);
    g.globalCompositeOperation="source-over";
    g.lineWidth=fs*0.18;g.strokeStyle="rgba(15,20,40,.85)";g.strokeText(b.txt,0,0);
    g.shadowColor="rgba("+acc[0]+","+acc[1]+","+acc[2]+",.95)";g.shadowBlur=20;
    g.fillStyle="#ffffff";g.fillText(b.txt,0,0);g.shadowBlur=0;
    g.restore();g.textAlign="left";g.textBaseline="alphabetic";g.globalAlpha=1;
  }
  // HUD: hearts top-left, stage badge top-center, fever bar top-right
  function drawHUD(now){
    const m=clamp(api.W*0.03,10,18),hs=clamp(api.W*0.035,16,26);
    // hearts（gバー(もどるボタン)の下に降ろして衝突回避）
    for(let i=0;i<3;i++){
      const hx=m+i*(hs*1.25),hy=62+hs*0.6,full=i<lives;
      g.save();g.translate(hx,hy);
      if(hurtT>0&&i===lives)g.globalAlpha=0.4+0.4*Math.sin(now*0.04);
      g.fillStyle=full?"#ff4d6d":"rgba(255,255,255,.18)";
      heartPath(hs);g.fill();
      if(full){g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(-hs*0.18,-hs*0.05,hs*0.12,0,TAU);g.fill();}
      g.restore();
    }
    g.globalAlpha=1;
    // stage badge
    const sName=curStage().gim==="boss"?"ボス":("ステージ"+(stage+1));
    const fs=clamp(api.W*0.035,14,20);
    g.font="800 "+fs+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
    // 軸6(見やすさ)向け: 生成背景(夜空写真)が明るい/賑やかな場合でも埋もれないよう、HUDパネルの不透明度を上げた(.6→.78)
    g.fillStyle="rgba(20,30,55,.78)";const bw=g.measureText(sName).width+fs*1.4;
    rrect(api.W/2-bw/2,m*0.5,bw,fs*1.8,fs*0.9);g.fill();
    g.fillStyle="#dceeff";g.fillText(sName,api.W/2,m*0.5+fs*0.9+1);
    g.textAlign="left";g.textBaseline="alphabetic";
    // fever gauge (right side, gバーの下に降ろして衝突回避)
    const gw=clamp(api.W*0.22,90,160),gh=clamp(api.H*0.012,8,14),gx=api.W-m-gw,gy=66+gh*0.4;
    rrect(gx,gy,gw,gh,gh/2);g.fillStyle="rgba(0,0,0,.35)";g.fill();
    const fillW=gw*clamp(fever,0,1);
    if(fillW>2){rrect(gx,gy,fillW,gh,gh/2);
      const fgr=g.createLinearGradient(gx,0,gx+gw,0);
      if(feverT>0){fgr.addColorStop(0,"#fff2a0");fgr.addColorStop(1,"#ffb13a");}
      else{fgr.addColorStop(0,"#7de1ff");fgr.addColorStop(1,"#5a8cff");}
      g.fillStyle=fgr;g.fill();}
    rrect(gx,gy,gw,gh,gh/2);g.lineWidth=1.5;g.strokeStyle="rgba(180,220,255,.5)";g.stroke();
    g.font="700 "+(gh*1.1)+"px system-ui";g.textAlign="right";g.fillStyle=feverT>0?"#ffd23f":"rgba(200,225,255,.8)";
    g.fillText(feverT>0?"フィーバー!":"フィーバー",gx+gw,gy-gh*0.4);g.textAlign="left";
  }
  function heartPath(s){g.beginPath();g.moveTo(0,s*0.32);
    g.bezierCurveTo(-s*0.55,-s*0.18,-s*0.32,-s*0.55,0,-s*0.22);
    g.bezierCurveTo(s*0.32,-s*0.55,s*0.55,-s*0.18,0,s*0.32);g.closePath();}
  // big boss fruit with an HP bar
  function drawBoss(b){
    g.save();g.translate(b.x,b.y);g.rotate(b.rot);
    g.fillStyle="rgba(0,0,0,.25)";g.beginPath();g.arc(5,7,b.r,0,TAU);g.fill();
    // 画像ボス(王さまフルーツ): 王冠+足込みで胴体は画像幅の約0.83・中心はやや下(0.52) → r*2.4 で描き、少し上(-0.05r)にずらすと胴≒当たり円
    if(api.drawAsset("boss.png",0,-b.r*0.05,b.r*2.4,b.r*2.4,{center:true})){
      if(b.flash>0.02){g.globalCompositeOperation="lighter";g.globalAlpha=b.flash;
        g.fillStyle="rgba(255,240,200,.8)";g.beginPath();g.arc(0,0,b.r,0,TAU);g.fill();
        g.globalAlpha=1;g.globalCompositeOperation="source-over";}
      g.restore();drawBossHp(b);return;
    }
    const grd=g.createRadialGradient(-b.r*0.3,-b.r*0.35,b.r*0.15,b.r*0.15,b.r*0.2,b.r*1.05);
    grd.addColorStop(0,b.flesh);grd.addColorStop(0.5,b.skin);grd.addColorStop(1,shade(b.skin,-0.3));
    g.fillStyle=grd;g.beginPath();g.arc(0,0,b.r,0,TAU);g.fill();
    // crown spikes for a bossy look
    g.fillStyle="#ffd23f";for(let i=0;i<7;i++){const a=-Math.PI/2+(i-3)*0.28;
      g.beginPath();g.moveTo(Math.cos(a-0.08)*b.r*0.85,Math.sin(a-0.08)*b.r*0.85);
      g.lineTo(Math.cos(a)*b.r*1.18,Math.sin(a)*b.r*1.18);
      g.lineTo(Math.cos(a+0.08)*b.r*0.85,Math.sin(a+0.08)*b.r*0.85);g.closePath();g.fill();}
    // face
    g.fillStyle="#2a1410";g.beginPath();g.arc(-b.r*0.3,-b.r*0.1,b.r*0.12,0,TAU);g.fill();
    g.beginPath();g.arc(b.r*0.3,-b.r*0.1,b.r*0.12,0,TAU);g.fill();
    g.lineWidth=b.r*0.07;g.strokeStyle="#2a1410";g.lineCap="round";
    g.beginPath();g.arc(0,b.r*0.18,b.r*0.3,0.12*Math.PI,0.88*Math.PI);g.stroke();
    g.fillStyle="rgba(255,255,255,.45)";g.beginPath();g.arc(-b.r*0.3,-b.r*0.32,b.r*0.2,0,TAU);g.fill();
    if(b.flash>0.02){g.globalCompositeOperation="lighter";g.globalAlpha=b.flash;
      g.fillStyle="rgba(255,240,200,.8)";g.beginPath();g.arc(0,0,b.r,0,TAU);g.fill();
      g.globalAlpha=1;g.globalCompositeOperation="source-over";}
    g.restore();
    drawBossHp(b);
  }
  function drawBossHp(b){
    // HP bar above the boss
    const bw=b.r*2,bx=b.x-b.r,by=b.y-b.r-22;
    rrect(bx,by,bw,10,5);g.fillStyle="rgba(0,0,0,.45)";g.fill();
    const hpW=bw*clamp(b.hp/b.maxhp,0,1);
    if(hpW>1){rrect(bx,by,hpW,10,5);g.fillStyle="#ff4d4d";g.fill();}
    rrect(bx,by,bw,10,5);g.lineWidth=2;g.strokeStyle="rgba(255,220,180,.7)";g.stroke();
  }
  function bandFor(o){return o.t;}
  // 2/3. 岩の欠片・安全な樽の木片を描く(丸い果物のdrawHalfとは別の壊れ方の見た目)
  function drawShard(sd){
    const a=Math.max(0,sd.life);
    g.save();g.translate(sd.x,sd.y);g.rotate(sd.rot);g.globalAlpha=a;
    if(sd.shape==="wood"){
      const w=Math.max(1,sd.w),h=Math.max(1,sd.h);
      g.fillStyle=sd.skin;g.fillRect(-w/2,-h/2,w,h);
      g.fillStyle="rgba(255,255,255,.25)";g.fillRect(-w/2,-h/2,w,h*0.3);
      g.strokeStyle="rgba(40,20,5,.4)";g.lineWidth=1;g.strokeRect(-w/2,-h/2,w,h);
    }else{
      const s=Math.max(1,sd.size);
      g.beginPath();g.moveTo(0,-s);g.lineTo(s*0.8,-s*0.1);g.lineTo(s*0.5,s*0.9);g.lineTo(-s*0.6,s*0.7);g.lineTo(-s*0.8,-s*0.3);g.closePath();
      g.fillStyle=sd.skin;g.fill();
      g.fillStyle="rgba(255,255,255,.2)";g.beginPath();g.arc(-s*0.15,-s*0.25,Math.max(0,s*0.25),0,TAU);g.fill();
    }
    g.restore();
  }
  // 画像フルーツ: 白ベースのスプライトを皮の色で着色した複製(にじいろは色を巡回)。未準備なら null → 手描き
  function fruitSprite(o,nowMs){
    if(!USE_FRUIT_IMG||o.t==="barrel"||o.t==="barrel_safe"||o.t==="rock")return null;
    const col=o.t==="rainbow"?RB_COLS[Math.floor((nowMs||0)*0.008)%RB_COLS.length]:o.skin;
    return api.tinted("fruit.png",col,o.t==="ice"?0.4:0.55);
  }
  function drawWhole(o){
    g.save();g.translate(o.x,o.y);g.rotate(o.rot);
    // soft drop shadow
    g.fillStyle="rgba(0,0,0,.22)";g.beginPath();g.arc(3,4,Math.max(0,o.r),0,TAU);g.fill();
    // 4. 巨大フルーツの金色ハロー(画像/手描きどちらの経路でも見える位置に先に描く)
    if(o.big){g.globalCompositeOperation="lighter";g.strokeStyle="rgba(255,214,79,.55)";g.lineWidth=3;
      g.beginPath();g.arc(0,0,Math.max(0,o.r+4),0,TAU);g.stroke();g.globalCompositeOperation="source-over";}
    // ---- 画像スプライト(当たり判定 r に合わせたサイズで中央描画)。未準備なら下の手描きへ ----
    if(o.t==="barrel"||o.t==="barrel_safe"){
      // 樽画像は正方形内で幅0.89・高さ1.0 → 幅2.2r/高さ2.4r で描くと胴の見た目≒当たり判定の円(直径2r)
      if(o.t==="barrel_safe"){
        // 3. 安全な樽は画像も色替え(危険な樽の茶色と混同しないよう緑に着色)
        const spr=api.tinted("barrel.png",o.skin,0.55);
        if(spr){api.drawSrc(spr,0,0,o.r*2.2,o.r*2.4,{center:true});g.restore();return;}
      }else if(api.drawAsset("barrel.png",0,0,o.r*2.2,o.r*2.4,{center:true})){g.restore();return;}
    }else{
      const spr=fruitSprite(o,lastNow);
      if(spr){
        if(o.t==="rainbow"){g.globalCompositeOperation="lighter";
          const rg=g.createRadialGradient(0,0,0,0,0,Math.max(0,o.r*1.5));
          rg.addColorStop(0,"rgba(255,255,255,.35)");rg.addColorStop(1,"rgba(255,255,255,0)");
          g.fillStyle=rg;g.beginPath();g.arc(0,0,Math.max(0,o.r*1.5),0,TAU);g.fill();
          g.globalCompositeOperation="source-over";}
        api.drawSrc(spr,0,0,o.r*2.3,o.r*2.3,{center:true});
        if(o.t==="ice"){g.globalCompositeOperation="lighter";g.strokeStyle="rgba(220,245,255,.7)";g.lineWidth=1.5;
          for(let i=0;i<3;i++){const a=i*2.1;g.beginPath();
            g.moveTo(Math.cos(a)*o.r*0.2,Math.sin(a)*o.r*0.2);g.lineTo(Math.cos(a)*o.r*0.7,Math.sin(a)*o.r*0.7);g.stroke();}
          g.globalCompositeOperation="source-over";}
        g.restore();return;
      }
    }
    if(o.t==="barrel"||o.t==="barrel_safe"){
      const bg=g.createLinearGradient(-o.r*0.8,0,o.r*0.8,0);
      bg.addColorStop(0,o.skin);bg.addColorStop(0.45,o.flesh);bg.addColorStop(1,o.skin);
      g.fillStyle=bg;g.fillRect(-o.r*0.8,-o.r,o.r*1.6,o.r*2);
      g.fillStyle="rgba(40,20,5,.35)";g.fillRect(-o.r*0.8,-o.r*0.5,o.r*1.6,o.r*0.16);g.fillRect(-o.r*0.8,o.r*0.34,o.r*1.6,o.r*0.16);
      g.fillStyle="rgba(255,230,180,.5)";g.fillRect(-o.r*0.8,-o.r*0.12,o.r*1.6,o.r*0.08);
      g.fillStyle="rgba(255,255,255,.28)";g.fillRect(-o.r*0.68,-o.r,o.r*0.16,o.r*2);
    }else if(o.t==="rock"){
      // 2. いびつな5〜6角形の岩(丸い果物と一目で区別できる輪郭)
      const pts=o.pts||[1,1,1,1,1];const n=pts.length;
      g.beginPath();
      for(let i=0;i<n;i++){const a=(i/n)*TAU,rr=Math.max(2,o.r*pts[i]);
        const px=Math.cos(a)*rr,py=Math.sin(a)*rr;if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}
      g.closePath();
      const rg=g.createRadialGradient(-Math.max(0,o.r*0.28),-Math.max(0,o.r*0.3),Math.max(0,o.r*0.12),Math.max(0,o.r*0.1),Math.max(0,o.r*0.15),Math.max(0,o.r*1.05));
      rg.addColorStop(0,o.flesh);rg.addColorStop(0.55,o.skin);rg.addColorStop(1,shade(o.skin,-0.3));
      g.fillStyle=rg;g.fill();
      g.lineWidth=Math.max(1,o.r*0.05);g.strokeStyle="rgba(20,20,26,.4)";g.stroke();
      g.fillStyle="rgba(255,255,255,.18)";g.beginPath();g.arc(-o.r*0.3,-o.r*0.32,Math.max(0,o.r*0.16),0,TAU);g.fill();
    }else if(o.t==="box"){
      // 7. 木箱: 丸・岩・樽とは別の四角い輪郭。バツ印の当て木で"積み荷/建物"らしさを出す
      const s=Math.max(2,o.r*1.5);
      const bg=g.createLinearGradient(-s/2,-s/2,s/2,s/2);
      bg.addColorStop(0,o.flesh);bg.addColorStop(1,o.skin);
      g.fillStyle=bg;g.fillRect(-s/2,-s/2,s,s);
      g.strokeStyle="rgba(60,35,10,.5)";g.lineWidth=Math.max(1,s*0.05);g.strokeRect(-s/2,-s/2,s,s);
      g.beginPath();g.moveTo(-s/2,-s/2);g.lineTo(s/2,s/2);g.moveTo(s/2,-s/2);g.lineTo(-s/2,s/2);g.stroke();
      g.fillStyle="rgba(255,255,255,.18)";g.fillRect(-s/2,-s/2,s,s*0.22);
    }else if(o.t==="dango"){
      // 7. だんご: 串に刺さった3色の丸(積み重ね物)。斬ると spawnDangoBalls で3つの丸へバラける
      const cols=o.dcols||["#ffb6c1","#fff4e0","#8bd23a"];
      const rr=Math.max(2,o.r*0.6),ys=[-o.r*0.82,0,o.r*0.82];
      g.fillStyle="#c9915a";g.fillRect(-Math.max(1,o.r*0.06),-o.r*1.3,Math.max(2,o.r*0.12),o.r*2.7);
      for(let i=0;i<3;i++){
        const gr=g.createRadialGradient(-rr*0.3,ys[i]-rr*0.3,Math.max(0.1,rr*0.1),0,ys[i],rr);
        gr.addColorStop(0,tint(cols[i],0.3));gr.addColorStop(1,cols[i]);
        g.fillStyle=gr;g.beginPath();g.arc(0,ys[i],rr,0,TAU);g.fill();
      }
    }else if(o.t==="gem"){
      // 軸3: 小さく速いが高得点のレアだま。4方向にきらめく光条で"特別な的"だと分かるようにする
      const grd=g.createRadialGradient(-o.r*0.3,-o.r*0.3,Math.max(0.1,o.r*0.1),0,0,Math.max(0,o.r));
      grd.addColorStop(0,tint(o.skin,0.6));grd.addColorStop(0.6,o.skin);grd.addColorStop(1,shade(o.skin,-0.3));
      g.fillStyle=grd;g.beginPath();g.arc(0,0,Math.max(0,o.r),0,TAU);g.fill();
      g.globalCompositeOperation="lighter";g.strokeStyle="rgba(255,255,255,.9)";g.lineWidth=1.5;
      for(let i=0;i<4;i++){const a=o.rot+i*(TAU/4);
        g.beginPath();g.moveTo(Math.cos(a)*o.r*0.2,Math.sin(a)*o.r*0.2);g.lineTo(Math.cos(a)*o.r*1.3,Math.sin(a)*o.r*1.3);g.stroke();}
      g.globalCompositeOperation="source-over";
    }else if(o.t==="rainbow"){
      // ① にじいろのたま: 同心の虹バンド＋つや。斬るのが待ちきれない見た目
      const cols=["#ff5aa0","#ff9d2e","#ffe14d","#7dff9a","#5ad6ff","#c07dff"];
      for(let i=0;i<cols.length;i++){g.fillStyle=cols[i];
        g.beginPath();g.arc(0,0,o.r*(1-i/cols.length),0,TAU);g.fill();}
      g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(-o.r*0.32,-o.r*0.34,o.r*0.22,0,TAU);g.fill();
      g.globalCompositeOperation="source-over";
      g.fillStyle="rgba(255,255,255,.85)";g.beginPath();g.arc(-o.r*0.42,-o.r*0.42,o.r*0.08,0,TAU);g.fill();
      g.fillStyle="#3f7a22";g.fillRect(-2.5,-o.r-5,5,8);
    }else{
      // base body with deep radial shading
      const grd=g.createRadialGradient(-o.r*0.32,-o.r*0.34,o.r*0.15,o.r*0.15,o.r*0.2,o.r*1.05);
      grd.addColorStop(0,o.flesh);grd.addColorStop(0.55,o.skin);
      grd.addColorStop(1,shade(o.skin,-0.28));
      g.fillStyle=grd;g.beginPath();g.arc(0,0,o.r,0,TAU);g.fill();
      // rim micro-glow
      g.globalCompositeOperation="lighter";
      g.strokeStyle="rgba(255,255,255,.12)";g.lineWidth=2;g.beginPath();g.arc(0,0,o.r-1,0,TAU);g.stroke();
      g.globalCompositeOperation="source-over";
      // glossy main highlight + tiny sparkle
      g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(-o.r*0.32,-o.r*0.34,o.r*0.22,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.85)";g.beginPath();g.arc(-o.r*0.42,-o.r*0.42,o.r*0.08,0,TAU);g.fill();
      if(o.t==="fruit"){g.fillStyle="#3f7a22";g.fillRect(-2.5,-o.r-5,5,8);
        g.fillStyle="#7fc23a";g.beginPath();g.ellipse(o.r*0.18,-o.r-2,o.r*0.22,o.r*0.12,0.5,0,TAU);g.fill();}
      if(o.t==="ice"){g.globalCompositeOperation="lighter";g.strokeStyle="rgba(220,245,255,.7)";g.lineWidth=1.5;
        for(let i=0;i<3;i++){const a=o.rot*0+i*2.1;g.beginPath();
          g.moveTo(Math.cos(a)*o.r*0.2,Math.sin(a)*o.r*0.2);g.lineTo(Math.cos(a)*o.r*0.7,Math.sin(a)*o.r*0.7);g.stroke();}
        g.globalCompositeOperation="source-over";}
    }
    g.restore();
  }
  function drawHalf(h){
    g.save();g.translate(h.x,h.y);g.rotate(h.rot);g.rotate(h.cut);
    if(h.sx&&h.sy)g.scale(h.sx,h.sy);
    // 7. だんご: 真っ二つではなく、丸ごと1個の団子が転がっていく(積み重ね崩壊の質感)
    if(h.full){
      const rg=g.createRadialGradient(-h.r*0.25,-h.r*0.25,Math.max(0.1,h.r*0.1),0,0,Math.max(0,h.r));
      rg.addColorStop(0,h.flesh);rg.addColorStop(1,h.skin);
      g.fillStyle=rg;g.beginPath();g.arc(0,0,Math.max(0,h.r),0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.35)";g.beginPath();g.arc(-h.r*0.28,-h.r*0.3,Math.max(0,h.r*0.18),0,TAU);g.fill();
      g.restore();return;
    }
    // 画像フルーツの半分: 半円でクリップしてスプライトを描き、切り口に果肉の帯を重ねる。未準備なら手描き
    const spr=(h.t==="barrel"||h.t==="dango")?null:fruitSprite(h,lastNow);
    if(spr){
      g.save();g.beginPath();
      if(h.side>0)g.arc(0,0,h.r,0,Math.PI);else g.arc(0,0,h.r,Math.PI,TAU);
      g.closePath();g.clip();
      api.drawSrc(spr,0,0,h.r*2.3,h.r*2.3,{center:true});
      g.restore();
      // cut face (flesh band along the cut edge)
      g.beginPath();g.ellipse(0,h.side>0?h.r*0.08:-h.r*0.08,Math.max(0,h.r*0.98),Math.max(0,h.r*0.16),0,0,TAU);
      g.fillStyle=h.flesh;g.fill();
      g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(255,255,255,.45)";g.fillRect(-h.r,h.side>0?0:-2.5,h.r*2,2.5);
      g.globalCompositeOperation="source-over";
      g.restore();return;
    }
    // skin shell
    g.beginPath();
    if(h.side>0)g.arc(0,0,h.r,0,Math.PI);else g.arc(0,0,h.r,Math.PI,TAU);
    g.closePath();
    const sg=g.createRadialGradient(-h.r*0.2,0,h.r*0.1,0,0,h.r);
    sg.addColorStop(0,h.skin);sg.addColorStop(1,shade(h.skin,-0.25));
    g.fillStyle=sg;g.fill();
    // inner flesh
    g.beginPath();
    if(h.side>0)g.arc(0,0,h.r*0.82,0,Math.PI);else g.arc(0,0,h.r*0.82,Math.PI,TAU);
    g.closePath();
    const fg=g.createRadialGradient(0,h.side>0?h.r*0.1:-h.r*0.1,h.r*0.05,0,0,h.r*0.82);
    fg.addColorStop(0,tint(h.flesh,0.25));fg.addColorStop(1,h.flesh);
    g.fillStyle=fg;g.fill();
    // glowing cut face
    g.globalCompositeOperation="lighter";
    g.fillStyle="rgba(255,255,255,.45)";g.fillRect(-h.r,h.side>0?0:-2.5,h.r*2,2.5);
    g.globalCompositeOperation="source-over";
    g.restore();
  }
  // color helpers: shade darkens, tint lightens toward white
  function shade(hex,amt){return mix(hex,amt<0?"#000000":"#ffffff",Math.abs(amt));}
  function tint(hex,amt){return mix(hex,"#ffffff",amt);}
  function mix(a,b,t){
    const ca=hx(a),cb=hx(b);
    const r=Math.round(ca[0]+(cb[0]-ca[0])*t),gg=Math.round(ca[1]+(cb[1]-ca[1])*t),bb=Math.round(ca[2]+(cb[2]-ca[2])*t);
    return "rgb("+r+","+gg+","+bb+")";
  }
  function hx(h){h=h.replace("#","");if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
}
Engine.register("slash", buildSlash);
