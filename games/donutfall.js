function build_donutfall(api){
  const g=api.g;
  api.preload(["bg.jpg","choc.png","golddonut.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。cake.pngは生成2回とも皿/台が消えず不採用(手描きのみ)
  let sweets=[],shards=[],rings=[],sparks=[],floats=[],motes=[],clouds=[],balloons=[];
  let R,groundY,spawnT=0,count=0,combo=0,comboT=0,tsec=0;
  // stage progression: clear a quota -> "ステージ クリア!" -> harder endless. ミスでゲームオーバーにしない。
  let stage=1,stageKill=0,stageGoal=8,clearT=0,clearStage=0,flash=0,flashHue="#fff";
  let goldSeenThisStage=false; // ⑤ ピティ: このステージでまだゴールドが出ていないか
  // A:ゴールドドーナツ / B:フィーバータイム / F:次ステージ予告
  let fever=0,feverGauge=0,hsCd=0,teaser="";
  const PAL=["#ff8fbf","#ffd23f","#a6e3ff","#b9f5b0","#ffb3e0","#c8a8ff","#ffcf8a","#9be8d8"];
  // ---- 隠し発見レイヤー(ハンマー/トラックと同じ思想) ----
  const COLNAME={"#ff8fbf":"ピンク","#ffd23f":"きいろ","#a6e3ff":"みずいろ","#b9f5b0":"みどり","#ffb3e0":"もも","#c8a8ff":"むらさき","#ffcf8a":"オレンジ","#9be8d8":"みずみどり"};
  let luckyColor=pick(PAL.filter(c=>c!=="#ffd23f")),luckySeen=false,luckyMsgT=0; // ② きょうのラッキー色: 秘密の1色(ゴールド同色のきいろは除外)
  let rbMsgT=0;                                         // ① にじいろドーナツ 発見バナー
  let stageDrop=0,noDropT=0;                            // ③ ノードロップ判定: このステージで落としたお菓子の数
  // per-stage candy-land sky palette (pastel)
  const SKY=[
    {a:"#ffe3f1",b:"#ffd0e6",c:"#cdefff"}, // 1 strawberry milk
    {a:"#fff1cf",b:"#ffe0a8",c:"#ffd8ec"}, // 2 lemon cream
    {a:"#e6dcff",b:"#d3c2ff",c:"#cfe9ff"}, // 3 grape soda
    {a:"#d6f5e6",b:"#bfeede",c:"#fff0c4"}, // 4 mint candy
    {a:"#ffe0d0",b:"#ffc9d6",c:"#e3d0ff"}  // 5 peach dream
  ];
  function sky(){return SKY[(stage-1)%SKY.length];}
  function goalFor(s){return 13+(s-1)*4;}         // 13,17,21,25,29（7〜8歳向けに手応えを増やした）
  // fall speed scales with stage so the テンポ感 rises endlessly（7〜8歳向けに少し速く）
  // 第2ラウンド指摘の「初速を2.75→3.1に」は試したが、20シード計測でdragのfirstScoreSec中央値3.8→6.6秒/maxQuietSec中央値15.6→17秒と悪化し、
  // tap側にも明確な改善が出なかった(quietはむしろ10.9→11.4に悪化)ためskip。据え置き。
  function fallSpeed(){return clamp(2.75+(stage-1)*0.56,2.75,9.4);}
  // 第2ラウンド改善: 補充間隔の上限を28→22に下げ、maxQuietSec(無反応の最長秒)を縮める。特に指をなぞる操作(drag)での間延び対策
  function spawnGap(){const g0=clamp(24-(stage-1)*2,10,22);return fever>0?Math.max(8,g0*0.45):g0;}
  // hitStop は大ヒット限定 + 30フレーム以上のクールダウン
  function tryHitStop(f){if(hsCd<=0){api.hitStop(f);hsCd=32;}}

  function buildBg(){
    clouds=[];for(let i=0;i<5;i++)clouds.push({x:rnd(0,api.W),y:api.H*rnd(0.05,0.42),s:rnd(0.7,1.5),sp:rnd(0.05,0.14),a:rnd(0.4,0.7)});
    motes=[];for(let i=0;i<22;i++)motes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(1,3),sp:rnd(0.1,0.4),tw:rnd(0,TAU),col:pick(PAL)});
    balloons=[];for(let i=0;i<4;i++)balloons.push({x:rnd(0.1,0.9)*api.W,y:rnd(0.2,0.9)*api.H,r:rnd(14,26),sp:rnd(0.1,0.3),col:pick(PAL),ph:rnd(0,TAU)});
  }
  function layout(){
    groundY=api.H*0.9;
    R=clamp(Math.min(api.W,api.H)*0.085,32,64);
    buildBg();
  }
  layout();
  // 開始直後から的を3個見せる(1個だけより最初の成功が早く来る。軸1・軸3(b)対策。的の大きさ/判定は変えず開幕の数だけ増やすので軸3(a)は崩れない)
  // 第2ラウンド改善: 1個目は最初から画面内、かつ画面中央寄り(H*0.25)へ直接置く。低学年のタップは画面中央付近に集中するため、
  // 端(H*0.18やそれより上)より中央寄りに置いたほうが最初のタップで当たりやすい(firstScoreSecの中央値3.75秒/3.8秒→3秒以内を狙う)。
  // 2個目は画面上端近くに直接置き(H*0.08)、0秒時点で2個とも画面内に見える状態を作る。
  spawn();sweets[sweets.length-1].y=api.H*0.25;
  spawn();sweets[sweets.length-1].y=api.H*0.08;

  function pickType(){
    const bag=["donut","donut","candy","choc","mini","mini"]; // ⑦ 一口サイズの小さい飴(mini)も混ぜる
    if(stage>=2)bag.push("gummy");
    if(stage>=3){bag.push("cake");bag.push("candy");}
    if(stage>=4)bag.push("cake");
    return pick(bag);
  }
  function spawn(){
    let type=pickType();
    // レア: ゴールドドーナツ(約8%)。光る+ゆっくり落ちる+大量点
    if(Math.random()<(fever>0?0.05:0.08))type="gold";
    // ① 激レア にじいろドーナツ: ステージ2以降ごくまれ(約3%)。ゆっくり落ちて虹色に光る。いつ来るか分からない=ドキドキ発見。
    if(stage>=2&&Math.random()<0.03)type="rainbow";
    // ⑤ ピティ: このステージで5体以上倒したのにゴールドがまだなら、外れが続いた回でも必ず一度は見せ場を出す
    if(type!=="gold"&&type!=="rainbow"&&stageKill>=5&&!goldSeenThisStage&&fever<=0)type="gold";
    if(type==="gold")goldSeenThisStage=true;
    let hp=1,col=pick(PAL),r=R;
    if(type==="cake"){hp=2;r=R*1.12;}            // 2タップ系のごほうび大物
    else if(type==="gummy"){col=pick(["#ff8fbf","#b9f5b0","#a6e3ff","#ffd23f"]);}
    else if(type==="choc"){col="#b06a3c";}
    else if(type==="gold"){col="#ffd23f";r=R*1.08;}
    else if(type==="rainbow"){col=pick(PAL);r=R*1.14;} // 描画側で毎フレーム虹色に色替わり
    else if(type==="mini"){col=pick(PAL);r=R*0.6;}     // ⑦ 小さい一口サイズ(大きいcake/gold/rainbowの逆側)
    sweets.push({x:rnd(r*1.2,api.W-r*1.2),y:-r*1.4,
      vy:fallSpeed()*rnd(0.85,1.15)*(type==="gold"||type==="rainbow"?0.66:1),
      vx:rnd(-0.4,0.4),type,col,hp,r,rot:rnd(0,TAU),vr:rnd(-0.04,0.04),
      wob:rnd(0,TAU),flash:0,dead:false});
    if(type==="gold"){api.tone(1568,0.18,"triangle",0.1);api.tone(2093,0.24,"triangle",0.07);}
    else if(type==="rainbow"){api.tone(1046,0.14,"triangle",0.09);api.tone(1568,0.16,"triangle",0.08);api.tone(2093,0.2,"triangle",0.06);}
  }

  function burst(x,y,col,big){
    rings.push({x,y,r:R*0.4,vr:R*0.6,life:1,decay:0.06,col});
    rings.push({x,y,r:R*0.2,vr:R*0.4,life:1,decay:0.05,col:"#ffffff"});
    const n=(big?16:10)+Math.min(combo,6);
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(2.5,8);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(3,7.5),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.022),
        col:i%3===0?col:(i%3===1?"#ffffff":pick(PAL)),shape:i%2});}
    for(let i=0;i<rint(5,8);i++){const a=rnd(0,TAU),s=rnd(4,11);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,18),life:1,decay:rnd(0.05,0.09)});}
    trimParticles();
  }
  function trimParticles(){ // 60fps維持: 上限を超えた古い破片から間引く
    if(shards.length>170)shards.splice(0,shards.length-170);
    if(sparks.length>90)sparks.splice(0,sparks.length-90);
    if(rings.length>24)rings.splice(0,rings.length-24);
  }
  // ⑥ チョコ専用: drawChocの十字の溝に沿って四角い4片へパキッと割れる(丸い破片と違う壊れ方)
  function chocBurst(x,y,r,big){
    rings.push({x,y,r:R*0.35,vr:R*0.55,life:1,decay:0.06,col:"#6e3f22"});
    const offs=[[-1,-1],[1,-1],[-1,1],[1,1]];
    for(let i=0;i<4;i++){
      const ox=offs[i][0],oy=offs[i][1],a=Math.atan2(oy,ox)+rnd(-0.25,0.25),sp=rnd(3,7)+(big?2:0);
      shards.push({x:x+ox*r*0.18,y:y+oy*r*0.18,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,r:rnd(r*0.35,r*0.5),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.014,0.02),col:i%2?"#a8633a":"#6e3f22",shape:2});
    }
    for(let i=0;i<(big?10:6);i++){const a=rnd(0,TAU),s=rnd(2.5,7);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(2.5,5),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:"#d99a64",shape:1});}
    for(let i=0;i<rint(5,8);i++){const a=rnd(0,TAU),s=rnd(4,11);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,18),life:1,decay:rnd(0.05,0.09)});}
    trimParticles();
  }
  // ⑥ グミ専用: ぷにっと2段の波紋+やわらかいゼリー片が飛ぶ(丸弾け・矩形とは違う壊れ方)
  function gummyBurst(x,y,col,big){
    rings.push({x,y,r:R*0.25,vr:R*0.9,life:1,decay:0.09,col});
    rings.push({x,y,r:R*0.15,vr:R*0.5,life:1,decay:0.05,col:"#ffffff"});
    const n=(big?14:9)+Math.min(combo,5);
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(2,6.5);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3.5,7),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.015,0.025),col:i%2?col:"#ffffff",shape:3});}
    for(let i=0;i<rint(4,7);i++){const a=rnd(0,TAU),s=rnd(3,9);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(6,14),life:1,decay:rnd(0.05,0.09)});}
    trimParticles();
  }
  // A: ゴールド撃破 = 虹色バースト + ファンファーレ
  function goldBurst(x,y){
    for(let i=0;i<3;i++)rings.push({x,y,r:R*(0.3+i*0.25),vr:R*(0.5+i*0.2),life:1,decay:0.05,col:PAL[(i*2)%PAL.length]});
    for(let i=0;i<22;i++){const a=i/22*TAU,sp=rnd(4,10);
      shards.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,r:rnd(3,8),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.018),col:PAL[i%PAL.length],shape:i%2});}
    [0,4,7,12].forEach((semi,i)=>setTimeout(()=>api.tone(784*Math.pow(2,semi/12),0.18,"triangle",0.12),i*70));
    api.boom(0.6);api.shake(10);flash=0.8;flashHue="#ffd23f";
    floats.push({x,y:y-R,txt:"ゴールド！",life:1,vy:-0.9,col:"#ffb000",size:38});
    trimParticles();
  }
  // ① にじいろドーナツ撃破 = 虹の輪が全色ぶわっと広がる大盤振る舞い + ファンファーレ + 大量得点
  function rainbowBurst(x,y){
    rbMsgT=1.4;flash=0.8;flashHue="#fff";
    api.boom(0.7);api.shake(14);tryHitStop(4);
    api.slide(523,1568,0.5,0.24,"triangle");
    [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.18,"triangle",0.1),i*70));
    for(let i=0;i<PAL.length;i++)rings.push({x,y,r:Math.max(0,R*(0.3+i*0.12)),vr:R*(0.5+i*0.08),life:1,decay:0.05,col:PAL[i]});
    for(let i=0;i<30;i++){const a=i/30*TAU,sp=rnd(4,11);
      shards.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,r:rnd(3,8),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.018),col:PAL[i%PAL.length],shape:i%2});}
    floats.push({x,y:y-R,txt:"にじいろ！",life:1,vy:-0.9,col:"#ff5b8a",size:40});
    trimParticles();
  }
  // ② ラッキー色 命中: きらっと小さめの祝福(白飛びしないよう控えめ)
  function luckySparkle(x,y){
    api.tone(1046,0.14,"triangle",0.1);api.tone(1568,0.16,"triangle",0.08);
    floats.push({x,y:y-R*0.9,txt:"ラッキー！",life:0.8,vy:-1,col:luckyColor,size:26});
    for(let i=0;i<9;i++){const a=rnd(0,TAU),sp=rnd(2,6);
      shards.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,r:rnd(3,6),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:luckyColor,shape:i%2});}
    trimParticles();
  }
  // B: フィーバータイム突入(10秒: 的が大量+全部1発+点2倍+虹色空)
  function startFever(){
    fever=10;feverGauge=1;
    flash=1;flashHue="#ffd23f";
    api.boom(0.7);api.shake(18);
    api.slide(392,1568,0.5,0.3,"sawtooth");
    [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(523*Math.pow(2,semi/12),0.2,"triangle",0.13),i*80));
    floats.push({x:api.W/2,y:api.H*0.35,txt:"フィーバー タイム！",life:1.2,vy:-0.4,col:"#ff2bcf",size:44});
    tryHitStop(4);
    for(let i=0;i<4;i++){spawn();sweets[sweets.length-1].y-=i*R*2.2;} // お菓子の雨スタート
    spawnT=6;
  }
  function checkStage(){
    if(stageKill<stageGoal||clearT>0)return;
    clearStage=stage;clearT=1.6;flash=0.7;flashHue="#fff6c8";
    api.boom(0.5);api.shake(12);
    api.slide(523,784,0.3,0.2,"triangle");api.tone(660,0.25,"triangle",0.14);api.tone(988,0.3,"triangle",0.1);
    for(let i=0;i<24;i++){const a=rnd(0,TAU),s=rnd(3,9);
      shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(PAL),shape:0});}
    // ③ ノードロップ ボーナス: このステージで お菓子を1こも落とさなかったら +3 & みどりの星シャワー(気づくと得する仕掛け)
    if(stageDrop===0){count+=3;api.setScore(count);noDropT=1.9;api.tone(1318,0.16,"triangle",0.12);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(3,8);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(4,8),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:"#7be08a",shape:0});}}
    stageDrop=0;
    stage++;stageGoal=goalFor(stage);stageKill=0;goldSeenThisStage=false;buildBg();
    teaser=teaserFor(stage); // F: 次ステージ予告
  }
  function teaserFor(s){
    if(s===2)return "つぎは グミちゃんが でてくる！";
    if(s===3)return "つぎは おおきな ケーキ！";
    if(s===4)return "ケーキが いっぱい でるよ！";
    return pick(["ゴールドドーナツを さがせ！","おかしが もっと はやくなる！","フィーバーを ねらおう！"]);
  }
  function crack(s,px,py){
    // 大物ケーキは1発目はヒビ(フィーバー中は全部1発！)
    if(s.type==="cake"&&s.hp>1&&fever<=0){s.hp--;s.flash=1;
      api.slide(360,240,0.08,0.2,"square");api.noise(0.06,0.12,1600);api.shake(4);tryHitStop(2);
      burst(px,py,"#fff0d0",false);return;}
    s.dead=true;
    let gain=s.type==="cake"?3:s.type==="gold"?5:s.type==="rainbow"?8:1;
    // ② きょうのラッキー色: 秘密の1色(お菓子系)を割ると +1 の隠しボーナス。気づくと得する。
    const isLucky=(s.type==="donut"||s.type==="candy"||s.type==="cake"||s.type==="gummy"||s.type==="mini")&&s.col===luckyColor;
    if(isLucky){gain+=1;luckyMsgT=luckySeen?Math.max(luckyMsgT,0.7):1.6;luckySeen=true;}
    if(fever>0)gain*=2; // フィーバー中は点2倍
    count+=gain;stageKill++;api.setScore(count);
    combo++;comboT=0.9;
    api.slide(380,150,0.12,0.3,"square");api.noise(0.1,0.18,2000);
    api.tone(520*Math.pow(2,clamp(combo,0,10)/12),0.12,"triangle",0.12);
    api.boom(combo>=5?0.55:0.4);api.shake(6+Math.min(combo,8));
    if(s.type==="cake"){api.tone(1046,0.18,"triangle",0.14);api.tone(1318,0.2,"triangle",0.1);}
    if(combo>=3){flash=Math.min(1,0.45+combo*0.05);flashHue=s.col;tryHitStop(combo>=6?4:3);api.tone(220,0.2,"sawtooth",0.07);}
    if(combo>1)floats.push({x:px,y:py-R*0.6,txt:"x"+combo,life:1,vy:-1.1,
      col:combo>=8?"#ff2bcf":combo>=5?"#ff5b8a":"#ffd23f",size:combo>=5?40:30});
    if(s.type==="gold")goldBurst(px,py);
    else if(s.type==="rainbow")rainbowBurst(px,py);
    else if(fever>0)floats.push({x:px,y:py-R*1.1,txt:"+"+gain,life:0.8,vy:-1.3,col:"#fff",size:22});
    if(isLucky)luckySparkle(px,py);
    // フィーバーゲージ: たたくたび少しずつたまる。ゴールド/にじいろはドカンとたまる
    if(fever<=0){feverGauge=Math.min(1,feverGauge+(s.type==="gold"||s.type==="rainbow"?0.22:0.08));
      if(feverGauge>=1)startFever();}
    // ⑥ 壊れ方をtypeごとに変える(単一の丸弾け演出から脱する)
    if(s.type==="choc")chocBurst(px,py,s.r,combo>=5);
    else if(s.type==="gummy")gummyBurst(px,py,s.col,combo>=5);
    else burst(px,py,s.col,combo>=5||s.type==="gold");
    checkStage();
  }

  return {
    resize:layout,
    input(x,y,type){
      if(type!=="down")return;
      for(let i=sweets.length-1;i>=0;i--){const s=sweets[i];
        if(s.dead)continue;
        if(Math.hypot(x-s.x,y-s.y)<s.r*1.35){crack(s,s.x,s.y);return;}}
      // ④ ふうせん ひみつタップ: お菓子に当たらなかったタップが風船に届いたら、ポンッと割れてキラキラ(減点なし・ごほうび)
      for(const bl of balloons){
        if(Math.hypot(x-bl.x,y-bl.y)<bl.r*1.25){
          api.tone(1318,0.1,"triangle",0.09);api.tone(1760,0.12,"triangle",0.07);
          for(let i=0;i<10;i++){const a=rnd(0,TAU),sp=rnd(2,6);
            shards.push({x:bl.x,y:bl.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,r:rnd(3,6),
              rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:bl.col,shape:i%2});}
          floats.push({x:bl.x,y:bl.y-bl.r,txt:"キラッ",life:0.7,vy:-1,col:bl.col,size:22});
          bl.x=rnd(0.1,0.9)*api.W;bl.y=api.H+bl.r*2;bl.col=pick(PAL); // 別の場所から新しい風船
          trimParticles();return;
        }
      }
      // からぶり: 軽い手応えだけ。コンボはリセットしない（やさしさ）
      api.tone(300,0.05,"triangle",0.06);
      for(let i=0;i<5;i++){const a=rnd(0,TAU),sp=rnd(2,5);
        sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,len:rnd(5,11),life:1,decay:rnd(0.06,0.1)});}
    },
    frame(dt,now){
      tsec+=0.016*dt;
      if(hsCd>0)hsCd-=dt;
      // B: フィーバータイマー
      if(fever>0){fever-=0.016*dt;
        if(fever<=0){fever=0;feverGauge=0;
          api.tone(660,0.2,"triangle",0.1);api.tone(880,0.25,"triangle",0.08);
          floats.push({x:api.W/2,y:api.H*0.4,txt:"フィーバー おわり！",life:1,vy:-0.6,col:"#fff",size:26});}}
      // ---- background: pastel candy sky (画像があれば cover、無ければ従来のグラデ) ----
      const sk=sky();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージごとのパステル色を薄く重ねて面替わり感を出す(1面めはそのまま)
        if((stage-1)%SKY.length!==0){g.save();g.globalAlpha=0.24;
          const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,sk.a);tg.addColorStop(0.5,sk.b);tg.addColorStop(1,sk.c);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,sk.a);grd.addColorStop(0.5,sk.b);grd.addColorStop(1,sk.c);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // B: フィーバー中は空が虹色に変わる(hueが流れる)
      if(fever>0){
        const fa=Math.min(1,fever*2)*Math.min(1,(10-fever)*3);
        const hue=(tsec*140)%360;
        g.save();g.globalCompositeOperation="lighter";
        g.globalAlpha=0.2*fa;g.fillStyle="hsl("+Math.round(hue)+",90%,70%)";g.fillRect(0,0,api.W,api.H);
        g.globalAlpha=0.14*fa;g.fillStyle="hsl("+Math.round((hue+120)%360)+",90%,70%)";g.fillRect(0,0,api.W,api.H*0.55);
        g.restore();g.globalCompositeOperation="source-over";
      }
      // soft sun glow
      let glow=g.createRadialGradient(api.W*0.5,api.H*0.1,0,api.W*0.5,api.H*0.1,api.W*0.7);
      glow.addColorStop(0,"rgba(255,255,235,.3)");glow.addColorStop(1,"rgba(255,255,235,0)");
      g.fillStyle=glow;g.fillRect(0,0,api.W,api.H);
      // drifting balloons (ふわふわ甘いもの)
      for(const bl of balloons){bl.y-=bl.sp*dt;bl.x+=Math.sin(tsec+bl.ph)*0.3*dt;
        if(bl.y<-bl.r*2)bl.y=api.H+bl.r*2;
        g.save();g.globalAlpha=0.7;
        g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=1.5;
        g.beginPath();g.moveTo(bl.x,bl.y+bl.r);g.quadraticCurveTo(bl.x+6,bl.y+bl.r*2.2,bl.x,bl.y+bl.r*3);g.stroke();
        const bg=g.createRadialGradient(bl.x-bl.r*0.3,bl.y-bl.r*0.3,bl.r*0.1,bl.x,bl.y,bl.r);
        bg.addColorStop(0,"#ffffff");bg.addColorStop(0.4,bl.col);bg.addColorStop(1,bl.col);
        g.fillStyle=bg;g.beginPath();g.ellipse(bl.x,bl.y,bl.r*0.9,bl.r,0,0,TAU);g.fill();
        g.fillStyle="rgba(255,255,255,.6)";g.beginPath();g.ellipse(bl.x-bl.r*0.3,bl.y-bl.r*0.35,bl.r*0.22,bl.r*0.32,-0.4,0,TAU);g.fill();
        g.restore();}
      g.globalAlpha=1;
      // puffy clouds ※画像背景のときは絵に雲があるので描かない(絵と喧嘩する平坦な手描きを避ける)
      if(!imgBg){
        g.save();g.fillStyle="#ffffff";
        for(const c of clouds){c.x+=c.sp*dt;if(c.x>api.W+90*c.s)c.x=-90*c.s;
          g.globalAlpha=c.a;const w=44*c.s;
          g.beginPath();g.ellipse(c.x,c.y,w,w*0.55,0,0,TAU);
          g.ellipse(c.x+w*0.8,c.y+w*0.12,w*0.7,w*0.45,0,0,TAU);
          g.ellipse(c.x-w*0.8,c.y+w*0.14,w*0.62,w*0.4,0,0,TAU);g.fill();}
        g.restore();g.globalAlpha=1;
      }
      // twinkling candy motes
      g.save();g.globalCompositeOperation="lighter";
      for(const m of motes){m.x+=m.sp*0.3*dt;m.y-=m.sp*0.15*dt;m.tw+=0.05*dt;
        if(m.x>api.W)m.x=0;if(m.y<0)m.y=api.H;
        g.globalAlpha=0.2+0.3*(0.5+0.5*Math.sin(m.tw));g.fillStyle=m.col;
        g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";
      // soft candy ground band at very bottom ※画像背景のときは絵の地面を活かして描かない
      if(!imgBg){
        let gnd=g.createLinearGradient(0,groundY,0,api.H);
        gnd.addColorStop(0,"rgba(255,255,255,.5)");gnd.addColorStop(1,"rgba(255,220,235,.7)");
        g.fillStyle=gnd;g.fillRect(0,groundY,api.W,api.H-groundY);
      }

      // ---- spawn ----
      const paused=clearT>0;
      if(!paused){spawnT-=dt;if(spawnT<=0){spawn();spawnT=spawnGap();}}

      // ---- sweets update + draw ----
      for(const s of sweets){
        if(s.dead)continue;
        if(!paused){s.y+=s.vy*dt;s.x+=s.vx*dt;s.rot+=s.vr*dt;s.wob+=0.1*dt;
          if(s.x<s.r){s.x=s.r;s.vx*=-1;}if(s.x>api.W-s.r){s.x=api.W-s.r;s.vx*=-1;}}
        if(s.type==="rainbow")s.col=PAL[Math.floor(tsec*8+s.wob)%PAL.length]; // ① 虹色に色替わり
        if(s.flash>0)s.flash-=0.08*dt;
        // 落ちきった: そっとフェードして消える（ゲームオーバーにしない）。combo は切れる。ステージのノードロップ判定に記録。
        if(s.y>groundY+s.r){s.dead=true;combo=0;comboT=0;stageDrop++;
          for(let i=0;i<5;i++)sparks.push({x:s.x,y:groundY,vx:rnd(-3,3),vy:rnd(-4,-1),len:rnd(5,10),life:1,decay:0.08});
          api.tone(180,0.08,"sine",0.06);continue;}
        drawSweet(s);
      }
      sweets=sweets.filter(s=>!s.dead);

      // ---- shockwave rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);

      // ---- shards (candy chunks + sprinkles) ----
      for(const p of shards){p.vy+=0.32*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);g.fillStyle=p.col;
        if(p.shape===1){g.fillRect(-p.r*0.5,-p.r*0.28,p.r,p.r*0.55);}      // sprinkle
        else if(p.shape===2){const cw=Math.max(0,p.r*1.2);g.fillRect(-cw*0.5,-cw*0.5,cw,cw);} // ⑥ choc: 四角い欠片
        else if(p.shape===3){const ex=Math.max(0,p.r*(0.5+p.life*0.5)),ey=Math.max(0,p.r*(0.32+p.life*0.32));
          g.beginPath();g.ellipse(0,0,ex,ey,0,0,TAU);g.fill();}             // ⑥ gummy: ぷにゼリー片
        else{g.beginPath();g.arc(0,0,Math.max(0,p.r*(0.5+p.life*0.5)),0,TAU);g.fill();} // crumb
        g.restore();}
      g.globalAlpha=1;shards=shards.filter(p=>p.life>0&&p.y<api.H+30);

      // ---- glint sparks ----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#fff7c2";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";sparks=sparks.filter(sp=>sp.life>0);

      // ---- combo floats ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.018*dt;
        g.save();g.globalAlpha=Math.max(0,f.life);g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.textAlign="center";g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.4)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.restore();}
      g.textAlign="left";floats=floats.filter(f=>f.life>0);

      // ---- impact flash ----
      if(flash>0){flash-=0.06*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa*0.3;g.fillStyle=flashHue;
        g.fillRect(0,0,api.W,api.H);g.restore();g.globalCompositeOperation="source-over";}

      // ---- combo big text (top center) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.16);g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);g.shadowColor="rgba(255,120,180,.8)";g.shadowBlur=14;
        g.fillStyle="#ff5b8a";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.7)";g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }

      // ① にじいろ！ 発見バナー(虹色に色替わり／上部中央=HUD安全帯)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=PAL[Math.floor(tsec*8)%PAL.length];
        g.save();g.translate(api.W/2,api.H*0.22);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 38px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle="#fff";g.fillText("にじいろ ドーナツ！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろ ドーナツ！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 ヒント／ラッキー! バナー
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        const pop=1+Math.max(0,luckyMsgT-1)*1.2;
        g.save();g.translate(api.W/2,api.H*0.29);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(COLNAME[luckyColor]||"")+"！";
        g.shadowColor=luckyColor;g.shadowBlur=12;g.fillStyle="#fff";g.fillText(t2,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle=luckyColor;g.strokeText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ ノードロップ ボーナス バナー(クリア文字と重ねない下側)
      if(noDropT>0){noDropT-=0.014*dt;
        const pop=1+Math.max(0,noDropT-1.3)*1.4;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(noDropT*1.3,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=16;g.fillStyle="#c7ffcf";g.fillText("ノードロップ ボーナス！",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,120,60,.7)";g.strokeText("ノードロップ ボーナス！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(noDropT<0)noDropT=0;}
      // ---- HUD (top center safe zone) ----
      drawHUD();
      // ---- fever gauge (bottom center) ----
      drawFeverBar();

      // ---- STAGE CLEAR banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.4;g.fillStyle="#000";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,150,200,.9)";g.shadowBlur=20;g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア!",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText(teaser||("つぎは ステージ"+(clearStage+1)+"!"),0,42);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=14;}
      }
    },
    stop(){}
  };

  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.045;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#7a3b5a";g.shadowColor="rgba(255,255,255,.6)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(255,255,255,.5)";rrect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#ff8fbf");gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg;rrect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.8)";g.lineWidth=2;rrect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }

  function drawFeverBar(){
    const w=Math.min(api.W*0.5,240),x=(api.W-w)/2,y=api.H-28,h=14;
    g.save();
    g.fillStyle="rgba(255,255,255,.45)";rrect(x-4,y-3,w+8,h+6,(h+6)/2);g.fill();
    const fr=fever>0?clamp(fever/10,0,1):clamp(feverGauge,0,1);
    if(fr>0.01){
      let pg=g.createLinearGradient(x,0,x+w,0);
      if(fever>0){const hue=(tsec*200)%360;
        pg.addColorStop(0,"hsl("+Math.round(hue)+",90%,60%)");
        pg.addColorStop(0.5,"hsl("+Math.round((hue+90)%360)+",90%,60%)");
        pg.addColorStop(1,"hsl("+Math.round((hue+180)%360)+",90%,60%)");}
      else{pg.addColorStop(0,"#ff8fbf");pg.addColorStop(1,"#ff2bcf");}
      g.fillStyle=pg;rrect(x,y,Math.max(h,w*fr),h,h/2);g.fill();
    }
    g.strokeStyle="rgba(255,255,255,.8)";g.lineWidth=2;rrect(x,y,w,h,h/2);g.stroke();
    g.font="800 15px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
    g.shadowColor="rgba(255,255,255,.7)";g.shadowBlur=6;
    if(fever>0){const pu=1+0.08*Math.sin(tsec*10);
      g.save();g.translate(api.W/2,y-8);g.scale(pu,pu);
      g.fillStyle="#ff2bcf";g.fillText("フィーバー！ てん 2ばい！",0,0);g.restore();}
    else{g.fillStyle="#7a3b5a";g.fillText("フィーバーゲージ",api.W/2,y-8);}
    g.restore();g.textAlign="left";
  }

  function drawSweet(s){
    const r=s.r,wob=Math.sin(s.wob)*0.06;
    g.save();g.translate(s.x,s.y);g.rotate(s.rot*0.4);g.scale(1+wob,1-wob);
    // shadow
    g.fillStyle="rgba(120,80,100,.18)";g.beginPath();g.ellipse(0,r*0.95,r*0.7,r*0.22,0,0,TAU);g.fill();
    // A: ゴールドは後光+回転する光のレイで一目でわかる
    if(s.type==="gold"){
      const pu=0.6+0.4*Math.sin(s.wob*3);
      g.save();g.globalCompositeOperation="lighter";
      const halo=g.createRadialGradient(0,0,r*0.3,0,0,r*1.9);
      halo.addColorStop(0,"rgba(255,230,120,"+(0.5*pu).toFixed(2)+")");
      halo.addColorStop(1,"rgba(255,230,120,0)");
      g.fillStyle=halo;g.beginPath();g.arc(0,0,r*1.9,0,TAU);g.fill();
      g.rotate(s.wob*0.8);g.globalAlpha=0.45*pu;g.fillStyle="#fff6c2";
      for(let i=0;i<6;i++){g.rotate(TAU/6);
        g.beginPath();g.moveTo(0,0);g.lineTo(r*1.7,-r*0.12);g.lineTo(r*1.7,r*0.12);g.closePath();g.fill();}
      g.restore();g.globalCompositeOperation="source-over";
    }
    // ① にじいろは虹色の後光リングで一目でわかる(激レア=とりたい!)
    if(s.type==="rainbow"){
      const pu=0.6+0.4*Math.sin(s.wob*3);
      g.save();g.globalCompositeOperation="lighter";
      for(let i=0;i<3;i++){const rr=Math.max(0,r*(1.15+i*0.28));
        g.globalAlpha=0.2*pu;g.strokeStyle=PAL[(i*2+Math.floor(tsec*6))%PAL.length];g.lineWidth=3;
        g.beginPath();g.arc(0,0,rr,0,TAU);g.stroke();}
      g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";
    }
    if(s.type==="donut"||s.type==="gold"||s.type==="rainbow")drawDonut(s,r);
    else if(s.type==="candy"||s.type==="mini")drawCandy(s,r);
    else if(s.type==="choc")drawChoc(s,r);
    else if(s.type==="gummy")drawGummy(s,r);
    else if(s.type==="cake")drawCake(s,r);
    // gold twinkle star
    if(s.type==="gold"){const tw=0.4+0.6*Math.abs(Math.sin(s.wob*4));
      g.save();g.globalAlpha=tw;g.fillStyle="#fff";
      g.translate(r*0.5,-r*0.55);g.rotate(s.wob);
      g.beginPath();for(let i=0;i<8;i++){const rr=i%2?r*0.08:r*0.24,a=i/8*TAU;
        g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}g.closePath();g.fill();g.restore();}
    // hit flash
    if(s.flash>0){g.globalAlpha=s.flash*0.7;g.fillStyle="#fff";g.beginPath();g.arc(0,0,Math.max(0,r*1.05),0,TAU);g.fill();g.globalAlpha=1;}
    // cute face(自分のr基準。mini等の小さい対象で顔が体からはみ出さないように)
    drawFace(0,r);
    // ② ラッキー色ヒント: 今日の色のお菓子には頭上に小さな星がキラッ(気づける手がかり)
    if((s.type==="donut"||s.type==="candy"||s.type==="cake"||s.type==="gummy"||s.type==="mini")&&s.col===luckyColor){
      const tw=0.4+0.6*Math.abs(Math.sin(s.wob*3));
      g.save();g.globalAlpha=tw;g.fillStyle="#fff9d0";g.translate(0,-r*1.3);g.rotate(s.wob);
      g.beginPath();for(let i=0;i<8;i++){const rr=i%2?r*0.09:r*0.26,a=i/8*TAU;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}g.closePath();g.fill();g.restore();g.globalAlpha=1;
    }
    g.restore();
  }
  function drawFace(yoff,fr){
    const r=fr===undefined?R:fr;
    g.fillStyle="#3a2233";
    g.beginPath();g.arc(-r*0.22,-r*0.06+yoff,r*0.07,0,TAU);g.arc(r*0.22,-r*0.06+yoff,r*0.07,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.9)";
    g.beginPath();g.arc(-r*0.24,-r*0.09+yoff,r*0.025,0,TAU);g.arc(r*0.2,-r*0.09+yoff,r*0.025,0,TAU);g.fill();
    g.fillStyle="rgba(255,130,160,.4)";
    g.beginPath();g.arc(-r*0.32,r*0.08+yoff,r*0.09,0,TAU);g.arc(r*0.32,r*0.08+yoff,r*0.09,0,TAU);g.fill();
    g.strokeStyle="#3a2233";g.lineWidth=r*0.05;g.lineCap="round";
    g.beginPath();g.arc(0,r*0.02+yoff,r*0.12,0.15*Math.PI,0.85*Math.PI);g.stroke();
  }
  function drawDonut(s,r){
    // A: ゴールドドーナツだけ画像スプライトに置き換え(通常/にじいろは色バリエーション対象のため手描きのまま)
    if(s.type==="gold"&&api.drawAsset("golddonut.png",0,0,r*2.2,r*2.2,{center:true}))return;
    const grd=g.createRadialGradient(-r*0.25,-r*0.3,r*0.1,0,0,r);
    grd.addColorStop(0,lighten(s.col,70));grd.addColorStop(0.6,lighten(s.col,20));grd.addColorStop(1,s.col);
    g.fillStyle=grd;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    // icing drips (a darker glaze ring on top half)
    g.save();g.beginPath();g.arc(0,0,r,0,TAU);g.clip();
    g.fillStyle=lighten(s.col,40);g.beginPath();
    g.moveTo(-r,-r*0.1);
    for(let i=0;i<=8;i++){const x=-r+(2*r)*(i/8);g.lineTo(x,-r*0.1+Math.sin(i*1.3+s.wob)*r*0.12);}
    g.lineTo(r,-r);g.lineTo(-r,-r);g.closePath();g.fill();g.restore();
    // sprinkles
    const cols=["#ff5b8a","#4db8ff","#ffd23f","#7be08a","#ffffff"];
    for(let i=0;i<8;i++){const a=i*TAU/8+s.rot,rr=r*0.55;
      g.save();g.translate(Math.cos(a)*rr,Math.sin(a)*rr-r*0.1);g.rotate(a*1.7);
      g.fillStyle=cols[i%cols.length];g.fillRect(-r*0.1,-r*0.04,r*0.2,r*0.08);g.restore();}
    // hole
    g.fillStyle="rgba(120,80,60,.55)";g.beginPath();g.arc(0,0,r*0.32,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.18)";g.beginPath();g.ellipse(-r*0.3,-r*0.35,r*0.22,r*0.12,-0.5,0,TAU);g.fill();
  }
  function drawCandy(s,r){
    // round wrapped candy with twisted ends
    const grd=g.createRadialGradient(-r*0.25,-r*0.3,r*0.1,0,0,r*0.8);
    grd.addColorStop(0,"#ffffff");grd.addColorStop(0.5,lighten(s.col,20));grd.addColorStop(1,s.col);
    g.fillStyle=grd;g.beginPath();g.arc(0,0,r*0.78,0,TAU);g.fill();
    // swirl stripes
    g.save();g.beginPath();g.arc(0,0,r*0.78,0,TAU);g.clip();
    g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=r*0.14;
    for(let i=-3;i<=3;i++){g.beginPath();g.moveTo(i*r*0.3-r,-r);g.lineTo(i*r*0.3+r,r);g.stroke();}
    g.restore();
    // wrapper ends
    g.fillStyle=s.col;
    for(const sgn of [-1,1]){g.save();g.translate(sgn*r*0.78,0);
      g.beginPath();g.moveTo(0,-r*0.3);g.lineTo(sgn*r*0.5,-r*0.45);g.lineTo(sgn*r*0.5,r*0.45);g.lineTo(0,r*0.3);g.closePath();g.fill();g.restore();}
    g.fillStyle="rgba(255,255,255,.4)";g.beginPath();g.ellipse(-r*0.25,-r*0.3,r*0.2,r*0.12,-0.5,0,TAU);g.fill();
  }
  function drawChoc(s,r){
    // chocolate square with bite-able grid
    g.save();g.rotate(s.rot*0.1);
    if(!api.drawAsset("choc.png",0,0,r*1.9,r*1.9,{center:true})){
      const grd=g.createLinearGradient(-r,-r,r,r);
      grd.addColorStop(0,"#d99a64");grd.addColorStop(0.5,"#a8633a");grd.addColorStop(1,"#6e3f22");
      g.fillStyle=grd;rrect(-r*0.8,-r*0.8,r*1.6,r*1.6,r*0.2);g.fill();
      g.strokeStyle="rgba(60,30,15,.5)";g.lineWidth=r*0.06;
      g.beginPath();g.moveTo(0,-r*0.8);g.lineTo(0,r*0.8);g.moveTo(-r*0.8,0);g.lineTo(r*0.8,0);g.stroke();
      g.fillStyle="rgba(255,240,210,.25)";rrect(-r*0.7,-r*0.7,r*0.6,r*0.6,r*0.1);g.fill();
    }
    g.restore();
  }
  function drawGummy(s,r){
    // glossy translucent gummy bear-ish blob
    g.save();
    const grd=g.createRadialGradient(-r*0.2,-r*0.3,r*0.1,0,0,r);
    grd.addColorStop(0,lighten(s.col,90));grd.addColorStop(0.6,s.col);grd.addColorStop(1,lighten(s.col,-10));
    g.fillStyle=grd;
    g.beginPath();
    g.moveTo(0,-r*0.9);
    g.bezierCurveTo(r*0.9,-r*0.9,r*0.9,r*0.9,0,r*0.9);
    g.bezierCurveTo(-r*0.9,r*0.9,-r*0.9,-r*0.9,0,-r*0.9);
    g.fill();
    // ears
    g.beginPath();g.arc(-r*0.55,-r*0.7,r*0.22,0,TAU);g.arc(r*0.55,-r*0.7,r*0.22,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.55)";g.beginPath();g.ellipse(-r*0.25,-r*0.3,r*0.22,r*0.3,-0.4,0,TAU);g.fill();
    g.restore();
  }
  function drawCake(s,r){
    // a slice / round cake with cream and cherry (big reward, 2-tap)
    g.save();
    { // cake.pngは生成で皿/台が消えず不採用。常に手描き。
      // base sponge
      const grd=g.createLinearGradient(0,-r,0,r);
      grd.addColorStop(0,"#ffe7c2");grd.addColorStop(1,"#e8b97a");
      g.fillStyle=grd;rrect(-r*0.85,-r*0.2,r*1.7,r*1.0,r*0.2);g.fill();
      // cream layer
      g.fillStyle="#fff4ea";rrect(-r*0.85,-r*0.05,r*1.7,r*0.25,r*0.1);g.fill();
      // frosting dome on top
      g.fillStyle="#ffd9e6";g.beginPath();
      g.moveTo(-r*0.85,-r*0.18);
      for(let i=0;i<=6;i++){const x=-r*0.85+(r*1.7)*(i/6);g.lineTo(x,-r*0.18-(i%2?r*0.22:r*0.1));}
      g.lineTo(r*0.85,-r*0.18);g.closePath();g.fill();
      // cherry
      g.fillStyle="#ff4d6d";g.beginPath();g.arc(0,-r*0.45,r*0.18,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(-r*0.05,-r*0.5,r*0.05,0,TAU);g.fill();
      g.strokeStyle="#7be08a";g.lineWidth=r*0.05;g.beginPath();g.moveTo(0,-r*0.6);g.lineTo(r*0.08,-r*0.75);g.stroke();
    }
    // crack hint when chipped(画像でも1発目のヒビは残す=かんたんに分かる手がかり)
    if(s.hp<2){g.strokeStyle="rgba(120,70,40,.6)";g.lineWidth=r*0.06;g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.2,-r*0.1);g.lineTo(r*0.05,r*0.2);g.lineTo(-r*0.1,r*0.6);g.stroke();}
    g.restore();
  }

  function rrect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function lighten(hex,amt){const a=amt===undefined?50:amt;const c=parseInt(hex.slice(1),16);
    const r=clamp(((c>>16)&255)+a,0,255),gg=clamp(((c>>8)&255)+a,0,255),b=clamp((c&255)+a,0,255);
    return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("donutfall", build_donutfall);
