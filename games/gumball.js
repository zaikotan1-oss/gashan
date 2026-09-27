function build_gumball(api){
  const g=api.g;
  api.preload(["bg.jpg","star.png","sun.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)
  // 全状態はここに閉じる
  let W=0,H=0,slopeY0,slopeY1,startX,startY,goalY,unit,tsec=0;
  let ball=null;                 // 転がるガムボール {x,y,vx,vy,r,col,eaten,squash,rot}
  let sweets=[],shards=[],sparks=[],rings=[],floats=[],motes=[],clouds=[],drops=[];
  let count=0,combo=0,comboT=0,flash=0,flashHue="#fff";
  // フィーバー/レア演出用
  let fever=0,feverGauge=0,feverBann=0,hsCd=0;
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  const COLNAME={"#ff7bb5":"ピンク","#5ad0ff":"みずいろ","#ffd23f":"きいろ","#7be08a":"みどり","#ff8c42":"オレンジ","#b58bff":"むらさき","#ff5b8a":"あか","#5be0c0":"みずみどり"};
  let luckyColor=null,luckySeen=false,luckyMsgT=0;          // ② きょうのラッキー色: 秘密の1色(CANDY定義後にlayout付近で確定)
  let rbMsgT=0;                                             // ① にじいろガムボール 発見バナー
  let perfectT=0;                                           // ③ パーフェクトロール 祝福バナー
  let luckStars=[];                                         // ② ラッキー命中の頭上キラッ
  let sunWink=0,sunCd=0;                                    // ④ 太陽ひみつタップ
  const sunPos={x:0,y:0,r:0};                              // 太陽の当たり判定(layoutで確定)
  // ステージ進行
  let stage=1,stageEat=0,stageGoal=10,clearT=0,clearStage=0,endingT=0,celebrate=0;
  const STAGES=5;
  const CANDY=["#ff7bb5","#5ad0ff","#ffd23f","#7be08a","#ff8c42","#b58bff","#ff5b8a","#5be0c0"];
  const SWEET_KINDS=["candy","choco","gummy","cake","donut"];
  const SWEET_SIZE={candy:1.0,choco:1.25,gummy:0.8,cake:1.05,donut:1.15}; // 軸7: 種類ごとの大小コントラスト
  // ステージごとの空グラデ(お菓子の国のパステル)
  const SKY=[
    {a:"#ffe3f1",b:"#ffd0e8",c:"#ffc2a8"}, // いちごミルク
    {a:"#e3f0ff",b:"#cfe6ff",c:"#bfeae0"}, // ソーダ
    {a:"#fff0d6",b:"#ffe3b0",c:"#ffd08a"}, // キャラメル
    {a:"#efe3ff",b:"#e0cfff",c:"#ffc8ec"}, // ぶどうガム
    {a:"#fff7c8","b":"#ffe27a",c:"#ffb86a"}  // はちみつフィナーレ
  ];
  const THEME_NAMES=["いちごミルク","ソーダ","キャラメル","ぶどうガム","はちみつ"];
  function sky(){return SKY[(stage-1)%SKY.length];}
  function goldChance(){return clamp(0.05+stage*0.012,0.05,0.12);} // ステージが進むほどレア出現UP
  function goalFor(s){return 13+(s-1)*4;}     // 13,17,21,25,29（7〜8歳向けに手応えを増やした）

  function layout(){
    W=api.W;H=api.H;
    unit=clamp(Math.min(W,H)*0.06,22,46);
    // 坂: 左上(高い)から右下(低い)へ
    startX=W*0.13;startY=H*0.20;
    slopeY0=H*0.20;slopeY1=H*0.62;
    goalY=H*0.86;                 // ここまで来たら新しいガムボール
    // ④ 太陽ひみつタップの当たり判定(描画位置=太陽グローと一致・寛容に大きめ)
    sunPos.x=W*0.72;sunPos.y=H*0.13;sunPos.r=Math.max(42,W*0.09);
    // 既存のお菓子のX位置だけ画面幅に合わせ直す(再配置はしない)
    sweets.forEach(s=>{ if(s.relx!=null) s.x=clamp(s.relx*W,unit,W-unit); });
    buildBg();
  }
  function buildBg(){
    clouds=[];for(let i=0;i<5;i++)clouds.push({x:rnd(0,W),y:H*rnd(0.05,0.30),s:rnd(0.7,1.5),sp:rnd(0.05,0.16),a:rnd(0.4,0.7),
      col:pick(["#ffffff","#fff0f6","#eef6ff","#fff6e0"])});
    motes=[];for(let i=0;i<22;i++)motes.push({x:rnd(0,W),y:rnd(0,H),r:rnd(1,3),sp:rnd(0.08,0.4),tw:rnd(0,TAU),col:pick(CANDY)});
    drops=[];for(let i=0;i<6;i++)drops.push({x:rnd(0,W),y:rnd(H*0.06,H*0.36),s:rnd(0.7,1.3),ph:rnd(0,TAU),
      kind:pick(SWEET_KINDS),col:pick(CANDY),sp:rnd(0.01,0.03),amp:rnd(8,22)});
  }
  layout();

  // 坂のY座標(x位置に応じて)
  function slopeAt(x){ const t=clamp((x-startX)/Math.max(1,(W-startX*0.5)-startX),0,1.4); return lerp(slopeY0,slopeY1,t); }

  function spawnSweets(){
    // トップアップ式: 生き残りは残したまま目標数まで補充する(尽きてSTALLしない)
    const target=7+Math.min(stage,4)+(fever>0?5:0); // フィーバー中は大量発生
    for(let i=sweets.length;i<target;i++){
      const relx=rnd(0.30,0.92);
      const x=clamp(relx*W,unit,W-unit);
      const onGround=Math.random()<0.7;
      // 空中に出す場合も坂の少し上(必ずボールが届く高さへ落ちてくる)
      const y=onGround? slopeAt(x)-unit*0.5 : slopeAt(x)-unit*rnd(1.2,3.0);
      // ① 激レア にじいろガムボール(ステージ2以降・約3%): 虹色に光り、食べると大量点+虹の大破裂
      const rainbow=(stage>=2)&&Math.random()<0.032;
      // 低確率でゴールドキャンディ(星型・光る・大量点)
      const gold=!rainbow&&Math.random()<goldChance();
      const kind=(rainbow||gold)?"candy":pick(SWEET_KINDS);
      sweets.push({relx,x,y,kind,
        col:rainbow?"#ff5b8a":(gold?"#ffd23f":pick(CANDY)),
        r:unit*(rainbow?1.12:gold?1.0:SWEET_SIZE[kind]*rnd(0.9,1.05)),rot:rnd(0,TAU),vr:rnd(-0.02,0.02),bob:rnd(0,TAU),dead:false,gold,rainbow});
    }
  }
  spawnSweets();
  luckyColor=pick(CANDY);luckyMsgT=2.4;   // ② 秘密のラッキー色を選び、開始時に一度だけ中央上に教える

  function newBall(){
    ball={x:startX,y:startY,vx:0,vy:0,r:unit*0.55,col:pick(CANDY),eaten:0,squash:1,rot:0,rolling:false,done:false};
  }
  newBall();

  function spawnShards(x,y,col,n,opts){
    // opts: 種類ごとに壊れ方を変えるための任意パラメータ(軸7: 砕ける/ぷにっと伸びる/弧状に飛ぶ/クリーム混ざる)
    opts=opts||{};
    const sMin=opts.sMin!=null?opts.sMin:unit*0.18, sMax=opts.sMax!=null?opts.sMax:unit*0.42;
    const decMin=opts.decMin!=null?opts.decMin:0.01, decMax=opts.decMax!=null?opts.decMax:0.02;
    const aMin=opts.aMin!=null?opts.aMin:0, aRange=opts.aRange!=null?opts.aRange:TAU, baseA=opts.baseAngle||0;
    n=Math.min(n,Math.max(0,110-shards.length)); // 上限管理(60fps維持)
    for(let i=0;i<n;i++){const a=baseA+aMin+rnd(0,aRange),sp=rnd(2,7);
      const useCol=(opts.mixCol&&Math.random()<0.4)?opts.mixCol:col;
      shards.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rnd(1,4),s:rnd(sMin,sMax),
        col:useCol,rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(decMin,decMax)});}
  }
  function spawnSparks(x,y,col,n){
    n=Math.min(n,Math.max(0,90-sparks.length)); // 上限管理
    for(let i=0;i<n;i++){const a=rnd(0,TAU),sp=rnd(2,8);
      sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,decay:rnd(0.03,0.06),s:rnd(1.5,3.5),col});}
  }
  function ringAt(x,y,col){ rings.push({x,y,r:unit*0.5,vr:unit*0.6,life:1,decay:0.05,col}); }

  function eatSweet(s){
    if(s.dead) return;
    s.dead=true;
    // ② きょうのラッキー色: 今日の秘密の色(ふつうのお菓子)を食べると +1 の隠しボーナス
    const isLucky=!s.gold&&!s.rainbow&&s.col===luckyColor;
    // にじいろ=8点 / ゴールド=5点 / ラッキー=+1 / フィーバー中=2倍
    let gain=(s.rainbow?8:s.gold?5:1)+(isLucky?1:0);
    gain*=(fever>0?2:1);
    count+=gain;stageEat++;ball.eaten++;combo++;comboT=0.9;
    api.setScore(count);
    // フィーバーゲージ蓄積(レアは大きく進む)
    feverGauge=Math.min(1,feverGauge+(s.rainbow?0.5:s.gold?0.34:0.09));
    if(fever<=0&&feverGauge>=1&&clearT<=0&&endingT<=0) startFever();
    // ガムボールが大きくカラフルに育つ
    ball.r=Math.min(ball.r+unit*0.12, unit*2.0);
    if(ball.eaten%2===0) ball.col=pick(CANDY);
    // 軸3: お菓子を巻き込むたびに少しだけ勢いが落ちる(狙わず取り続けると失速して止まる=打ち直しが要る)
    if(ball.rolling) ball.vx=Math.max(0.6,ball.vx-0.85);
    const hx=s.x,hy=s.y;
    // 軸7: 壊れ方を種類ごとに変える(砕ける/ぷにっと伸びる/弧状に飛ぶ/クリームが混ざる)
    if(s.kind==="choco"){
      spawnShards(hx,hy,s.col,rint(3,5),{sMin:unit*0.32,sMax:unit*0.55,decMin:0.012,decMax:0.02}); // バキッ: 大きめ少数
      spawnSparks(hx,hy,s.col,rint(3,5));
    }else if(s.kind==="gummy"){
      spawnShards(hx,hy,s.col,rint(7,10),{sMin:unit*0.12,sMax:unit*0.26,decMin:0.006,decMax:0.011}); // ぷにっと伸びてゆっくり消える
      spawnSparks(hx,hy,s.col,rint(4,6));
    }else if(s.kind==="donut"){
      spawnShards(hx,hy,s.col,rint(6,9),{aMin:-Math.PI*0.15,aRange:Math.PI*1.3,baseAngle:Math.PI*0.5}); // 輪の弧状に飛ぶ
      spawnSparks(hx,hy,s.col,rint(5,8));
    }else if(s.kind==="cake"){
      spawnShards(hx,hy,s.col,rint(6,9),{mixCol:"#fff4e0"}); // 白いクリーム色が混ざる
      spawnSparks(hx,hy,"#fff4e0",rint(5,8));
    }else{
      spawnShards(hx,hy,s.col,rint(6,9));
      spawnSparks(hx,hy,s.col,rint(5,8));
    }
    ringAt(hx,hy,s.col);
    flash=Math.min(1,flash+0.25);flashHue=s.col;
    api.slide(300+combo*18,150,0.1,0.22,"square");
    api.noise(0.1,0.16,1600);
    api.tone(440*Math.pow(2,clamp(combo,0,12)/12),0.1,"triangle",0.12);
    api.boom(clamp(0.35+ball.eaten*0.03,0.35,0.6));
    api.shake(4+Math.min(combo,8));
    // hitStopはゴールド/コンボ節目のみ+クールダウン30f以上
    if((s.gold||combo===5||combo===10)&&hsCd<=0){api.hitStop(s.gold?4:3);hsCd=34;}
    if(s.gold) goldBurst(hx,hy);
    if(s.rainbow) rainbowBurst(hx,hy);
    // ② ラッキー色命中: 小さめの祝福 + 頭上に小さな星のキラッ(気づけるヒント)
    if(isLucky){
      luckStars.push({x:hx,y:hy-s.r*0.9,vy:-1.2,life:1,r:unit*0.3,rot:0});
      floats.push({x:hx,y:hy-unit*0.9,txt:"ラッキー！",life:1,vy:-0.9,col:luckyColor,size:22});
      api.tone(1046,0.09,"triangle",0.11);api.tone(1568,0.11,"triangle",0.07);
      luckySeen=true;
    }
    if(gain>1) floats.push({x:hx,y:hy-unit*0.2,txt:"+"+gain,life:1,vy:-1,
      col:s.rainbow?"#ff5b8a":s.gold?"#ffd23f":"#ff2bff",size:s.rainbow?36:s.gold?34:26});
    if(combo>1) floats.push({x:hx,y:hy-unit*0.6,txt:"x"+combo,life:1,vy:-1,
      col:combo>=8?"#ff2bff":combo>=5?"#ff5b8a":"#ffd23f",size:combo>=4?38:28});
    if(ball.eaten===4) floats.push({x:hx,y:hy-unit*1.3,txt:"おおきく なった！",life:1,vy:-0.7,col:"#ffe14a",size:22});
    if(ball.eaten===8) floats.push({x:hx,y:hy-unit*1.3,txt:"きょだいガムボール！",life:1,vy:-0.7,col:"#ff2bff",size:22});
    checkStage();
  }

  // ゴールドキャンディ撃破: 虹色大破裂+ファンファーレ
  function goldBurst(x,y){
    for(let i=0;i<3;i++) ringAt(x,y,pick(CANDY));
    spawnSparks(x,y,"#fff6c8",10);
    const nn=Math.min(12,Math.max(0,110-shards.length));
    for(let i=0;i<nn;i++){const a=rnd(0,TAU),sp=rnd(3,9);
      shards.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rnd(1,4),s:rnd(unit*0.2,unit*0.42),
        col:pick(CANDY),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.018)});}
    floats.push({x,y:y-unit*1.4,txt:"ゴールド！",life:1.1,vy:-0.8,col:"#ffd23f",size:34});
    flash=1;flashHue="#ffd23f";
    api.boom(0.55);api.shake(12);
    api.tone(784,0.12,"triangle",0.16);
    setTimeout(()=>api.tone(988,0.12,"triangle",0.16),90);
    setTimeout(()=>api.tone(1319,0.22,"triangle",0.18),180);
  }

  // ① にじいろガムボール撃破: 虹の輪が5色ぶわっと+虹の紙吹雪+ファンファーレ(激レアのごほうび)
  function rainbowBurst(x,y){
    rbMsgT=1.5;celebrate=Math.max(celebrate,1.6);
    flash=Math.min(1,flash+0.4);flashHue="#ff5b8a";   // 加算フラッシュは控えめ(既存decayで速く引く)
    const RB=["#ff5b8a","#ffd23f","#7be08a","#5ad0ff","#b58bff","#ff8c42"];
    for(let i=0;i<RB.length;i++) ringAt(x,y,RB[i]);
    const nn=Math.min(20,Math.max(0,110-shards.length));
    for(let i=0;i<nn;i++){const a=rnd(0,TAU),sp=rnd(3,10);
      shards.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rnd(1,4),s:rnd(unit*0.22,unit*0.46),
        col:pick(CANDY),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.018)});}
    spawnSparks(x,y,"#fff6c8",12);
    floats.push({x,y:y-unit*1.5,txt:"にじいろ！",life:1.2,vy:-0.8,col:"#ff5b8a",size:36});
    api.boom(0.6);api.shake(15);
    if(hsCd<=0){api.hitStop(4);hsCd=34;}   // 激レア=節目なのでヒットストップ(クールダウン付き)
    api.tone(784,0.12,"triangle",0.16);
    setTimeout(()=>api.tone(1046,0.12,"triangle",0.16),90);
    setTimeout(()=>api.tone(1319,0.14,"triangle",0.16),180);
    setTimeout(()=>api.tone(1760,0.2,"triangle",0.16),280);
  }

  // フィーバータイム突入(約9秒: 点数2倍+お菓子大量+吸引パワーUP)
  function startFever(){
    fever=9;feverGauge=0;feverBann=1.7;celebrate=Math.max(celebrate,1.4);
    flash=1;flashHue="#ff2bff";
    api.boom(0.6);api.shake(16);
    api.slide(392,1046,0.45,0.24,"triangle");
    setTimeout(()=>api.tone(1046,0.14,"triangle",0.2),200);
    setTimeout(()=>api.tone(1319,0.24,"triangle",0.2),340);
    spawnSweets();
  }

  function checkStage(){
    if(stageEat<stageGoal||clearT>0||endingT>0) return;
    if(stage>=STAGES){
      endingT=2.6;celebrate=2.4;flash=1;flashHue="#ffd23f";
      api.boom(0.7);api.shake(20);
      api.slide(523,1046,0.5,0.22,"triangle");
    }else{
      clearStage=stage;clearT=1.7;celebrate=1.6;flash=0.8;flashHue=sky().c;
      api.boom(0.5);api.shake(12);
      api.slide(523,784,0.3,0.2,"triangle");api.tone(988,0.3,"triangle",0.1);
      for(let i=0;i<22;i++){const a=rnd(0,TAU),sp=rnd(3,9);
        shards.push({x:W/2,y:H*0.42,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,s:rnd(unit*0.2,unit*0.4),
          col:pick(CANDY),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.02)});}
      stage++;stageGoal=goalFor(stage);stageEat=0;buildBg();
    }
  }

  function launchBall(){
    // タップでガムボールを坂の下へ転がす
    if(!ball||ball.rolling||ball.done) return;
    ball.rolling=true;
    ball.vx=rnd(2.6,3.6);ball.vy=0.6;
    api.slide(180,320,0.18,0.18,"sine");
    api.tone(520,0.08,"triangle",0.1);
    spawnSparks(ball.x,ball.y,ball.col,6);
  }

  return {
    resize:layout,
    input(x,y,type){
      if(type!=="down") return;
      if(clearT>0||endingT>0) return;
      // ④ 太陽ひみつタップ: ボール待機中に太陽をつつくと ウインク+金コインがこぼれる(減点なし)。
      //   転がり中のブースト連打とは衝突しないよう「待機中のみ+クールダウン」で反応。
      if(sunCd<=0 && (!ball||!ball.rolling) && Math.hypot(x-sunPos.x,y-sunPos.y)<sunPos.r){
        sunWink=1;sunCd=48;
        api.tone(1318,0.1,"triangle",0.09);api.tone(1760,0.12,"triangle",0.07);
        for(let i=0;i<7;i++){const a=rnd(-TAU*0.5,0),sp=rnd(2.5,6);
          sparks.push({x:sunPos.x,y:sunPos.y,vx:Math.cos(a)*sp*0.7,vy:Math.sin(a)*sp-1,life:1,decay:0.02,s:rnd(2,3.5),col:"#ffe27a"});}
        floats.push({x:sunPos.x,y:sunPos.y+unit*1.1,txt:"コイン！",life:1,vy:-0.7,col:"#ffd23f",size:18});
        return;
      }
      // タップで転がす。すでに転がり中は「ボールの近くをタップした時だけ」加速が乗る(座標無関係の連打を無効化)
      if(ball&&!ball.rolling&&!ball.done){ launchBall(); return; }
      if(ball&&ball.rolling&&!ball.done){
        const near=Math.hypot(x-ball.x,y-ball.y)<unit*2.0;
        if(near){
          ball.vx=Math.min(ball.vx+1.0,12);ball.vy=Math.min(ball.vy+0.6,6);
          api.tone(620,0.06,"triangle",0.08);
          spawnSparks(ball.x,ball.y-ball.r,ball.col,4);
        }
      }
    },
    frame(dt,now){
      tsec+=0.016*dt;
      if(celebrate>0) celebrate=Math.max(0,celebrate-0.02*dt);
      if(hsCd>0) hsCd=Math.max(0,hsCd-dt);
      if(sunCd>0) sunCd=Math.max(0,sunCd-dt);

      // ---- 背景: 空グラデ (画像があれば cover 表示 + ステージ色を薄く重ねて面ごとの雰囲気を出す) ----
      const sk=sky();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        g.save();g.globalAlpha=0.22;let tg=g.createLinearGradient(0,0,0,H);
        tg.addColorStop(0,sk.a);tg.addColorStop(0.5,sk.b);tg.addColorStop(1,sk.c);
        g.fillStyle=tg;g.fillRect(0,0,W,H);g.restore();
      } else {
        let grd=g.createLinearGradient(0,0,0,H);
        grd.addColorStop(0,sk.a);grd.addColorStop(0.5,sk.b);grd.addColorStop(1,sk.c);
        g.fillStyle=grd;g.fillRect(0,0,W,H);
      }

      // ---- フィーバー中: 虹色に脈打つ空 ----
      if(fever>0){
        g.save();g.globalCompositeOperation="lighter";
        g.globalAlpha=0.15+0.06*Math.sin(tsec*8);
        g.fillStyle="hsl("+(((tsec*160)|0)%360)+",90%,65%)";g.fillRect(0,0,W,H);
        g.restore();g.globalAlpha=1;
      }

      // やわらかな太陽グロー(上)
      let glow=g.createRadialGradient(W*0.72,H*0.12,0,W*0.72,H*0.12,W*0.6);
      glow.addColorStop(0,"rgba(255,255,235,.5)");glow.addColorStop(1,"rgba(255,255,235,0)");
      g.fillStyle=glow;g.fillRect(0,0,W,H);
      // ④ 太陽本体(ひみつタップの的として見える)
      const sunR=Math.max(6,W*0.045);
      g.save();g.shadowColor="rgba(255,240,180,.9)";g.shadowBlur=22;
      if(!api.drawAsset("sun.png",sunPos.x,sunPos.y,sunR*2.4,sunR*2.4,{center:true})){
        g.fillStyle="rgba(255,251,224,.95)";g.beginPath();g.arc(sunPos.x,sunPos.y,sunR,0,TAU);g.fill();
      }
      g.restore();
      // タップされた瞬間だけ ^_^ のウインク顔(発見のごほうび)
      if(sunWink>0){sunWink-=0.02*dt;
        g.save();g.strokeStyle="#e0912a";g.lineWidth=Math.max(2,sunR*0.14);g.lineCap="round";g.globalAlpha=clamp(sunWink*1.4,0,1);
        g.beginPath();
        g.moveTo(sunPos.x-sunR*0.44,sunPos.y-sunR*0.02);g.quadraticCurveTo(sunPos.x-sunR*0.29,sunPos.y-sunR*0.32,sunPos.x-sunR*0.14,sunPos.y-sunR*0.02);
        g.moveTo(sunPos.x+sunR*0.14,sunPos.y-sunR*0.02);g.quadraticCurveTo(sunPos.x+sunR*0.29,sunPos.y-sunR*0.32,sunPos.x+sunR*0.44,sunPos.y-sunR*0.02);
        g.stroke();
        g.beginPath();g.arc(sunPos.x,sunPos.y+sunR*0.16,sunR*0.34,0.12*Math.PI,0.88*Math.PI);g.stroke();
        g.restore();g.globalAlpha=1;if(sunWink<0)sunWink=0;}

      // ---- ふわふわ漂う雲 ---- ※画像背景のときは絵に雲があるので描かない
      if(!imgBg) for(const c of clouds){
        c.x+=c.sp*dt;if(c.x>W+90*c.s)c.x=-90*c.s;
        g.save();g.globalAlpha=c.a;g.fillStyle=c.col;const w=44*c.s;
        g.beginPath();
        g.ellipse(c.x,c.y,w,w*0.55,0,0,TAU);
        g.ellipse(c.x+w*0.8,c.y+w*0.12,w*0.7,w*0.45,0,0,TAU);
        g.ellipse(c.x-w*0.8,c.y+w*0.14,w*0.6,w*0.4,0,0,TAU);
        g.fill();g.restore();
      }
      g.globalAlpha=1;

      // ---- 漂う甘いもの(背景プロップ) ----
      for(const d of drops){
        d.ph+=d.sp*dt;d.x+=0.12*d.sp*dt*60;if(d.x>W+30)d.x=-30;
        const dy=d.y+Math.sin(d.ph)*d.amp;
        g.save();g.globalAlpha=0.5;g.translate(d.x,dy);g.scale(d.s,d.s);
        drawSweet(d.kind,d.col,unit*0.55,tsec);
        g.restore();
      }
      g.globalAlpha=1;

      // ---- きらめき(モート) ----
      g.save();g.globalCompositeOperation="lighter";
      for(const m of motes){
        m.x+=m.sp*0.4*dt;m.y-=m.sp*0.18*dt;m.tw+=0.05*dt;
        if(m.x>W)m.x=0;if(m.y<0)m.y=H;
        g.globalAlpha=0.18+0.22*(0.5+0.5*Math.sin(m.tw));
        g.fillStyle=m.col;g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();
      }
      g.restore();g.globalAlpha=1;

      // ---- 坂(キャンディの坂道) ---- ※画像背景のときはベタ塗り/しましまを省略(絵の坂を活かす)。進路のふちだけは残す
      if(!imgBg){
        g.beginPath();
        g.moveTo(0,slopeY0);
        g.lineTo(W,slopeAt(W));
        g.lineTo(W,H);g.lineTo(0,H);g.closePath();
        let sg=g.createLinearGradient(0,slopeY0,0,H);
        sg.addColorStop(0,"#ffd9a8");sg.addColorStop(0.5,"#ff9ec2");sg.addColorStop(1,"#e06a9a");
        g.fillStyle=sg;g.fill();
        // 坂のしましま(ストライプキャンディ)
        g.save();g.beginPath();
        g.moveTo(0,slopeY0);g.lineTo(W,slopeAt(W));g.lineTo(W,H);g.lineTo(0,H);g.closePath();g.clip();
        g.globalAlpha=0.16;
        for(let x=-H;x<W+H;x+=unit*1.1){
          g.fillStyle=((x/(unit*1.1))|0)%2? "#ffffff":"#ff6aa0";
          g.beginPath();g.moveTo(x,slopeY0-20);g.lineTo(x+unit*0.5,slopeY0-20);
          g.lineTo(x+unit*0.5+ (H-slopeY0),H);g.lineTo(x+(H-slopeY0),H);g.closePath();g.fill();
        }
        g.restore();g.globalAlpha=1;
      }
      // 坂のふち(進路ガイド): 画像時もお菓子とボールが通る道すじが分かるように残す
      g.strokeStyle=imgBg?"rgba(255,255,255,.55)":"rgba(255,255,255,.7)";
      g.lineWidth=Math.max(3,unit*0.16);g.lineCap="round";
      g.beginPath();g.moveTo(0,slopeY0);g.lineTo(W,slopeAt(W));g.stroke();

      const paused=clearT>0||endingT>0;

      // ---- フィーバータイム進行 ----
      if(fever>0&&!paused){
        fever=Math.max(0,fever-0.016*dt);
        // お菓子を絶やさない+キャンディ紙吹雪
        if(sweets.length<11&&Math.random()<0.12) spawnSweets();
        if(shards.length<80&&Math.random()<0.3)
          shards.push({x:rnd(0,W),y:-12,vx:rnd(-1,1),vy:rnd(2,4.5),s:rnd(unit*0.16,unit*0.3),
            col:pick(CANDY),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.008});
        if(fever<=0){ // 終了演出
          floats.push({x:W/2,y:H*0.30,txt:"フィーバー おわり！",life:1,vy:-0.5,col:"#fff",size:24});
          api.slide(784,392,0.35,0.16,"triangle");
        }
      }

      // ---- お菓子たち ----
      for(const s of sweets){
        if(s.dead) continue;
        s.bob+=0.05*dt;s.rot+=s.vr*dt;
        // ふわふわ落下: どの位置のお菓子も坂の上へゆっくり寄っていく(必ず食べられる)
        const sgy=slopeAt(s.x)-unit*0.5;
        if(Math.abs(s.y-sgy)>1){ s.y+=(sgy-s.y)*Math.min(1,0.008*dt); }
        const wob=Math.sin(s.bob)*unit*0.05;
        if(s.rainbow){
          drawRainbowSweet(s,wob);
          if(sparks.length<60&&Math.random()<0.16) spawnSparks(s.x,s.y+wob-s.r,"hsl("+(((tsec*160)|0)%360)+",95%,65%)",1);
        }else if(s.gold){
          // ゴールドキャンディ: 光るオーラ+回る星+パルス(出た瞬間に目を引く)
          const pu=1+0.12*Math.sin(tsec*6+s.bob);
          g.save();g.translate(s.x,s.y+wob);
          g.globalCompositeOperation="lighter";
          const au=g.createRadialGradient(0,0,s.r*0.2,0,0,s.r*2.1);
          au.addColorStop(0,"rgba(255,225,90,.55)");au.addColorStop(1,"rgba(255,225,90,0)");
          g.fillStyle=au;g.beginPath();g.arc(0,0,s.r*2.1,0,TAU);g.fill();
          g.restore();
          g.save();g.translate(s.x,s.y+wob);g.rotate(s.rot*0.6+tsec*0.8);g.scale(pu,pu);
          // star.png は正方形キャンバス内の余白が大きい(実体は幅高さとも約57%)ので、
          // 手描き版(半径0.95*s.r=直径1.9*s.rの星)と見た目の大きさが揃うよう箱を大きめに取る
          if(!api.drawAsset("star.png",0,0,s.r*3.3,s.r*3.3,{center:true})) drawStar(s.r*0.95);
          g.restore();
          if(sparks.length<60&&Math.random()<0.12) spawnSparks(s.x,s.y+wob-s.r,"#ffe27a",1);
        }else{
          g.save();g.translate(s.x,s.y+wob);g.rotate(s.rot*0.2);
          drawSweet(s.kind,s.col,s.r,tsec);
          g.restore();
        }
      }

      // ---- ガムボール 更新 ----
      if(ball){
        if(ball.rolling&&!paused){
          // 坂に沿って加速
          ball.vy+=0.32*dt;
          ball.vx+=0.018*dt; // 軸3: 坂の自然加速を弱め、連打しなくても勝手に速くなる度合いを減らす(手を動かし続ける意味を作る)
          ball.x+=ball.vx*dt;
          ball.y+=ball.vy*dt;
          const gy=slopeAt(ball.x)-ball.r*0.85;
          if(ball.y>gy){ ball.y=gy; if(ball.vy>0)ball.vy*=0.4; }
          ball.rot+=ball.vx*0.04*dt;
          // 軸3: お菓子の巻き込みで失速しきったら一旦止まる(タイミングよく打ち直す意味が生まれる)
          if(ball.vx<1.1 && !ball.done){ ball.rolling=false; ball.vx=0; ball.vy=0; }
          // 当たり判定: お菓子を巻き込む + 近くのお菓子を吸い寄せるマグネット(寛容オートエイム)
          for(const s of sweets){
            if(s.dead) continue;
            const dx=s.x-ball.x,dy=s.y-ball.y,d=Math.hypot(dx,dy)||1;
            if(d < ball.r+s.r*0.7){ eatSweet(s); continue; }
            const pull=ball.r+unit*(fever>0?7:1.0); // フィーバー中は吸引パワーUP(通常時はほぼ接触サイズまで狭めて『狙う』余地を作る)
            if(d<pull){const f=(1-d/pull)*unit*0.6*dt;
              s.x-=dx/d*f;s.y-=dy/d*f;s.relx=s.x/W;}
          }
          // 画面下 or 右端まで到達 -> 完了
          if(ball.x>W+ball.r || ball.y>goalY){
            ball.done=true;
            if(ball.eaten>0){ flash=Math.min(1,flash+0.3); }
            // ③ パーフェクトロール: 1回の転がりで5個以上たいらげたら +3 & 祝福バナー(うまく狙うと得する頭を使う判定)
            if(ball.eaten>=5 && !ball.perfect){
              ball.perfect=true;count+=3;api.setScore(count);
              perfectT=1.7;celebrate=Math.max(celebrate,1.2);
              floats.push({x:clamp(ball.x,unit*2,W-unit*2),y:goalY-unit,txt:"パーフェクト！ +3",life:1.2,vy:-0.8,col:"#7be08a",size:24});
              api.tone(1319,0.12,"triangle",0.12);
              setTimeout(()=>api.tone(1760,0.16,"triangle",0.1),110);
            }
          }
        }
        // squash 戻し
        ball.squash=lerp(ball.squash,1,clamp(0.2*dt,0,1));
        drawBall(ball);
        // 完了したら少し待って次のボールを補充
        if(ball.done){
          ball._wait=(ball._wait||0)+dt;
          if(ball._wait>8){
            spawnSweets();   // 毎回トップアップ補充(的が尽きない)
            newBall();
          }
        }
      }
      sweets=sweets.filter(s=>!s.dead);

      // ---- 破片 ----
      for(const p of shards){p.vy+=0.4*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        g.fillStyle=p.col;
        g.beginPath();g.moveTo(0,-p.s*0.5);g.lineTo(p.s*0.5,0);g.lineTo(0,p.s*0.5);g.lineTo(-p.s*0.5,0);g.closePath();g.fill();
        g.fillStyle="rgba(255,255,255,.4)";g.beginPath();g.arc(-p.s*0.12,-p.s*0.12,p.s*0.14,0,TAU);g.fill();
        g.restore();}
      shards=shards.filter(p=>p.life>0);

      // ---- 衝撃波リング ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);

      // ---- スパーク(発光) ----
      g.save();g.globalCompositeOperation="lighter";
      for(const sp of sparks){sp.vy+=0.16*dt;sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.fillStyle=sp.col;g.shadowBlur=8;g.shadowColor=sp.col;
        g.beginPath();g.arc(sp.x,sp.y,sp.s*Math.max(0,sp.life)+0.4,0,TAU);g.fill();}
      g.restore();g.shadowBlur=0;g.globalAlpha=1;
      sparks=sparks.filter(sp=>sp.life>0);

      // ---- ② ラッキー命中の頭上キラッ(小さな金の星) ----
      for(const ls of luckStars){ls.y+=ls.vy*dt;ls.vy*=Math.pow(0.94,dt);ls.life-=0.02*dt;ls.rot+=0.12*dt;
        g.save();g.globalAlpha=Math.max(0,ls.life);g.translate(ls.x,ls.y);g.rotate(ls.rot);g.scale(0.55,0.55);
        drawStar(Math.max(0.1,ls.r));g.restore();}
      g.globalAlpha=1;luckStars=luckStars.filter(ls=>ls.life>0);

      // ---- フローティング文字 ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.016*dt;
        g.save();g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.restore();}
      g.globalAlpha=1;g.textAlign="left";
      floats=floats.filter(f=>f.life>0);

      // ---- 祝福の色ワッシュ ----
      if(celebrate>0){const ca=Math.min(1,celebrate);
        g.save();g.globalCompositeOperation="lighter";
        const sweep=((tsec*0.5)%1.4-0.2)*W;
        let cw=g.createLinearGradient(sweep,0,sweep+W*0.5,H);
        cw.addColorStop(0,"rgba(255,123,181,0)");
        cw.addColorStop(0.5,"rgba(255,210,63,0.5)");
        cw.addColorStop(1,"rgba(123,224,138,0)");
        g.globalAlpha=ca*0.24;g.fillStyle=cw;g.fillRect(0,0,W,H);
        g.restore();g.globalAlpha=1;}

      // ---- インパクトフラッシュ ----
      if(flash>0){flash-=0.06*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa*0.3;
        g.fillStyle=flashHue;g.fillRect(0,0,W,H);g.restore();g.globalAlpha=1;}

      // ---- ヒント(最初のボールが待機中) ----
      if(ball&&!ball.rolling&&!ball.done&&!paused){
        const a=0.5+0.5*Math.sin(tsec*4);
        g.save();g.globalAlpha=0.5+0.4*a;g.textAlign="center";
        g.font="800 20px 'Hiragino Maru Gothic ProN',system-ui";
        g.fillStyle="#fff";g.strokeStyle="rgba(0,0,0,.4)";g.lineWidth=4;
        g.strokeText("タップで ころがそう！",W/2,H*0.94);
        g.fillText("タップで ころがそう！",W/2,H*0.94);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }

      // ---- HUD(上部中央) ----
      drawHUD();

      // ---- ① にじいろガムボール！ 発見バナー(虹色に色替わり=激レアの大きな祝福) ----
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const a=clamp(rbMsgT*1.4,0,1),pop=1+Math.max(0,rbMsgT-1.1)*1.6;
        const col="hsl("+(((tsec*220)|0)%360)+",95%,64%)";
        g.save();g.translate(W/2,H*0.2);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 40px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=20;g.fillStyle="#fff";
        g.fillText("にじいろガムボール！",0,0);
        g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle=col;g.strokeText("にじいろガムボール！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ---- ② きょうのラッキー色 はっけん！(開始時に一度だけ・中央上) ----
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        const a=clamp(luckyMsgT*1.2,0,1);
        g.save();g.translate(W/2,H*0.27);g.globalAlpha=a;g.textAlign="center";
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(COLNAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.4)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ---- ③ パーフェクトロール！ 祝福バナー(クリア文字と重ならない下側) ----
      if(perfectT>0){perfectT-=0.016*dt;
        const a=clamp(perfectT*1.3,0,1),pop=1+Math.max(0,perfectT-1.2)*1.6;
        g.save();g.translate(W/2,H*0.6);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 32px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=16;g.fillStyle="#c7ffcf";
        g.fillText("パーフェクトロール！",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,120,60,.7)";g.strokeText("パーフェクトロール！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(perfectT<0)perfectT=0;}
      // ---- フィーバー突入バナー ----
      if(feverBann>0){feverBann-=0.016*dt;
        const a=clamp(feverBann*1.5,0,1),pop=1+Math.max(0,feverBann-1.2)*2.2;
        g.save();g.translate(W/2,H*0.35);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,43,255,.9)";g.shadowBlur=24;
        g.fillStyle="hsl("+(((tsec*220)|0)%360)+",95%,66%)";
        g.fillText("フィーバータイム！",0,0);
        g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle="#fff";g.strokeText("フィーバータイム！",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("てんすう 2ばい！",0,40);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }

      // ---- ステージクリア演出 ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.45;g.fillStyle="#000";g.fillRect(0,H*0.34,W,H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.4)*1.8;
        g.save();g.translate(W/2,H*0.45);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,140,200,.9)";g.shadowBlur=20;g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア！",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("つぎは 『"+THEME_NAMES[(stage-1)%THEME_NAMES.length]+"のくに』！",0,40);
        g.font="800 17px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#ffe6a0";
        g.fillText("ゴールドキャンディが でやすくなるよ！",0,68);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;newBall();spawnSweets();}
      }

      // ---- ぜんぶクリア演出 ----
      if(endingT>0){endingT-=0.012*dt;
        const a=clamp(endingT,0,1);
        g.save();g.globalAlpha=a*0.4;g.fillStyle="#3a1030";g.fillRect(0,0,W,H);g.restore();
        if(tsec%0.06<0.016*dt) shards.push({x:rnd(0,W),y:-10,vx:rnd(-1,1),vy:rnd(2,5),
          s:rnd(unit*0.2,unit*0.4),col:pick(CANDY),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.008});
        const pop=1+Math.sin(tsec*6)*0.06;
        g.save();g.translate(W/2,H*0.42);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 52px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,210,60,1)";g.shadowBlur=26;g.fillStyle="#ffd23f";
        g.fillText("ぜんぶ クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle="#fff";g.strokeText("ぜんぶ クリア！",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("すごい！ もういちど あそべるよ",0,46);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(endingT<=0){endingT=0;stage=1;stageGoal=goalFor(1);stageEat=0;combo=0;
          fever=0;feverGauge=0;feverBann=0;rbMsgT=0;perfectT=0;
          luckyColor=pick(CANDY);luckySeen=false;luckyMsgT=2.4;   // 次の周回で新しいラッキー色を教え直す
          buildBg();newBall();spawnSweets();}
      }
      // 白飛び防止の保険: フレーム末で加算合成を必ず素の描画へ戻す(次フレームへ持ち越さない)
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
    },
    stop(){}
  };

  // ====== 描画ヘルパー ======
  function drawHUD(){
    const left=clamp(stageGoal-stageEat,0,stageGoal);
    const bw=Math.min(W*0.6,360),bh=15,bx=(W-bw)/2,by=H*0.05;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(0,0,0,.5)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+" / "+STAGES+"      あと "+left+" こ",W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,0,0,.3)";roundRect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageEat/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#7be08a");gg.addColorStop(1,"#ff7bb5");
      g.fillStyle=gg;roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.55)";g.lineWidth=2;roundRect(bx,by,bw,bh,bh/2);g.stroke();
    // フィーバーゲージ(進行バーの下)
    const fw2=bw*0.66,fx2=(W-fw2)/2,fy2=by+bh+7,fh2=9;
    g.fillStyle="rgba(0,0,0,.28)";roundRect(fx2,fy2,fw2,fh2,fh2/2);g.fill();
    if(fever>0){
      // 残り時間バー(虹色に点滅)
      const fr2=clamp(fever/9,0,1);
      g.save();g.shadowBlur=8+4*Math.sin(tsec*8);g.shadowColor="#ff2bff";
      g.fillStyle="hsl("+(((tsec*200)|0)%360)+",95%,62%)";
      roundRect(fx2,fy2,Math.max(fh2,fw2*fr2),fh2,fh2/2);g.fill();g.restore();
      g.font="800 13px 'Hiragino Maru Gothic ProN',system-ui";
      g.fillStyle="#fff";g.shadowColor="rgba(255,43,255,.8)";g.shadowBlur=6;
      g.fillText("フィーバー！ 2ばい！",W/2,fy2+fh2+15);g.shadowBlur=0;
    }else if(feverGauge>0.02){
      g.save();if(feverGauge>0.85){g.shadowBlur=8+4*Math.sin(tsec*7);g.shadowColor="#ffd23f";}
      const gg2=g.createLinearGradient(fx2,0,fx2+fw2,0);
      gg2.addColorStop(0,"#ffb84a");gg2.addColorStop(1,"#ff2bff");
      g.fillStyle=gg2;roundRect(fx2,fy2,Math.max(fh2,fw2*clamp(feverGauge,0,1)),fh2,fh2/2);g.fill();
      g.restore();
      g.font="800 12px 'Hiragino Maru Gothic ProN',system-ui";
      g.fillStyle="rgba(255,255,255,.85)";
      g.fillText("フィーバーゲージ",W/2,fy2+fh2+13);
    }
    g.strokeStyle="rgba(255,255,255,.4)";g.lineWidth=1.5;roundRect(fx2,fy2,fw2,fh2,fh2/2);g.stroke();
    g.restore();g.textAlign="left";
    // コンボ表示(中央)
    if(combo>1){
      const pop=1+Math.max(0,comboT-0.7)*1.2;
      g.save();g.translate(W/2,H*0.15);g.scale(pop,pop);g.textAlign="center";
      g.font="800 30px 'Hiragino Maru Gothic ProN',system-ui";
      g.globalAlpha=clamp(comboT,0,1);
      g.shadowColor="rgba(255,90,150,.8)";g.shadowBlur=14;
      g.fillStyle="#ffd23f";g.fillText("コンボ x"+combo,0,0);
      g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.6)";
      g.strokeText("コンボ x"+combo,0,0);
      g.restore();g.globalAlpha=1;g.textAlign="left";
    }
  }

  function drawBall(b){
    const r=b.r;
    g.save();g.translate(b.x,b.y);
    // 影
    g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(0,r*0.95,r*0.85,r*0.28,0,0,TAU);g.fill();
    g.scale(1/b.squash,b.squash);
    g.rotate(b.rot);
    // 外側のキラキラオーラ
    g.save();g.globalCompositeOperation="lighter";
    const aur=g.createRadialGradient(0,0,r*0.3,0,0,r*1.8);
    aur.addColorStop(0,hexA(b.col,0.5));aur.addColorStop(1,hexA(b.col,0));
    g.fillStyle=aur;g.beginPath();g.arc(0,0,r*1.8,0,TAU);g.fill();g.restore();
    // 本体(光沢グラデ)
    const grd=g.createRadialGradient(-r*0.35,-r*0.4,r*0.1,0,0,r);
    grd.addColorStop(0,lighten(b.col,90));grd.addColorStop(0.5,lighten(b.col,20));grd.addColorStop(1,shade(b.col,-30));
    g.fillStyle=grd;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    // カラフルな水玉(食べるほど増える)
    const dots=Math.min(3+b.eaten,12);
    for(let i=0;i<dots;i++){const a=i*TAU/dots+b.eaten*0.3,rr=r*0.55;
      g.fillStyle=hexA(CANDY[i%CANDY.length],0.55);
      g.beginPath();g.arc(Math.cos(a)*rr,Math.sin(a)*rr,r*0.13,0,TAU);g.fill();}
    // ハイライト
    g.fillStyle="rgba(255,255,255,.8)";g.beginPath();g.arc(-r*0.35,-r*0.4,r*0.18,0,TAU);g.fill();
    g.restore();
    // かわいい顔(回転と無関係に正面)
    g.save();g.translate(b.x,b.y);g.scale(1/b.squash,b.squash);
    const ex=r*0.3,ey=-r*0.05,er=r*0.15;
    g.fillStyle="#2b2b3a";
    g.beginPath();g.arc(-ex,ey,er,0,TAU);g.arc(ex,ey,er,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.9)";
    g.beginPath();g.arc(-ex+er*0.3,ey-er*0.3,er*0.4,0,TAU);g.arc(ex+er*0.3,ey-er*0.3,er*0.4,0,TAU);g.fill();
    g.fillStyle="rgba(255,120,120,.4)";
    g.beginPath();g.arc(-r*0.5,r*0.2,r*0.12,0,TAU);g.arc(r*0.5,r*0.2,r*0.12,0,TAU);g.fill();
    g.strokeStyle="#2b2b3a";g.lineWidth=Math.max(2,r*0.07);g.lineCap="round";
    g.beginPath();g.arc(0,r*0.1,r*0.2,0.15*Math.PI,0.85*Math.PI);g.stroke();
    g.restore();
  }

  // お菓子の見た目(種類ごと)。中心(0,0)基準でサイズ s。
  function drawSweet(kind,col,s,t){
    g.save();
    g.fillStyle="rgba(0,0,0,.15)";g.beginPath();g.ellipse(0,s*0.85,s*0.8,s*0.22,0,0,TAU);g.fill();
    if(kind==="candy"){
      // ぐるぐるキャンディ
      const grd=g.createRadialGradient(-s*0.25,-s*0.3,s*0.1,0,0,s);
      grd.addColorStop(0,lighten(col,90));grd.addColorStop(1,col);
      g.fillStyle=grd;g.beginPath();g.arc(0,0,s*0.7,0,TAU);g.fill();
      g.save();g.beginPath();g.arc(0,0,s*0.7,0,TAU);g.clip();
      g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=s*0.16;
      for(let k=-2;k<=2;k++){g.beginPath();g.moveTo(-s+k*s*0.5,-s);g.lineTo(s+k*s*0.5,s);g.stroke();}
      g.restore();
      g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(-s*0.25,-s*0.3,s*0.14,0,TAU);g.fill();
    }else if(kind==="choco"){
      // 四角チョコ
      const grd=g.createLinearGradient(-s*0.6,-s*0.6,s*0.6,s*0.6);
      grd.addColorStop(0,"#7a4a2a");grd.addColorStop(0.5,"#5a3018");grd.addColorStop(1,"#3a1c0c");
      g.fillStyle=grd;roundRect(-s*0.6,-s*0.6,s*1.2,s*1.2,s*0.16);g.fill();
      g.strokeStyle="rgba(255,255,255,.12)";g.lineWidth=s*0.06;
      g.beginPath();g.moveTo(0,-s*0.6);g.lineTo(0,s*0.6);g.moveTo(-s*0.6,0);g.lineTo(s*0.6,0);g.stroke();
      g.fillStyle="rgba(255,255,255,.22)";g.fillRect(-s*0.55,-s*0.55,s*1.1,s*0.18);
    }else if(kind==="gummy"){
      // クマグミ
      const grd=g.createRadialGradient(-s*0.2,-s*0.3,s*0.1,0,0,s);
      grd.addColorStop(0,hexA(lighten(col,90),0.9));grd.addColorStop(1,hexA(col,0.9));
      g.fillStyle=grd;
      g.beginPath();g.arc(0,-s*0.35,s*0.32,0,TAU);g.fill();           // 頭
      g.beginPath();g.arc(-s*0.42,-s*0.55,s*0.16,0,TAU);g.fill();     // 耳
      g.beginPath();g.arc(s*0.42,-s*0.55,s*0.16,0,TAU);g.fill();
      g.beginPath();g.ellipse(0,s*0.25,s*0.42,s*0.45,0,0,TAU);g.fill();// 体
      g.beginPath();g.arc(-s*0.5,s*0.1,s*0.16,0,TAU);g.arc(s*0.5,s*0.1,s*0.16,0,TAU);g.fill();
      g.fillStyle="rgba(40,20,20,.7)";
      g.beginPath();g.arc(-s*0.12,-s*0.4,s*0.05,0,TAU);g.arc(s*0.12,-s*0.4,s*0.05,0,TAU);g.fill();
    }else if(kind==="cake"){
      // ショートケーキ(三角)
      g.fillStyle="#fff4e0";
      g.beginPath();g.moveTo(-s*0.6,s*0.5);g.lineTo(s*0.6,s*0.5);g.lineTo(s*0.5,-s*0.1);g.lineTo(-s*0.5,-s*0.1);g.closePath();g.fill();
      g.fillStyle=hexA(col,0.85);g.fillRect(-s*0.55,s*0.05,s*1.1,s*0.16); // ジャム層
      g.fillStyle="#fff";
      g.beginPath();g.moveTo(-s*0.5,-s*0.1);g.lineTo(s*0.5,-s*0.1);g.lineTo(0,-s*0.6);g.closePath();g.fill(); // クリーム
      g.fillStyle="#ff5b8a";g.beginPath();g.arc(0,-s*0.55,s*0.14,0,TAU);g.fill();   // いちご
      g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(-s*0.04,-s*0.6,s*0.04,0,TAU);g.fill();
    }else{
      // ドーナツ
      const grd=g.createRadialGradient(-s*0.2,-s*0.2,s*0.1,0,0,s*0.7);
      grd.addColorStop(0,"#f0c98a");grd.addColorStop(1,"#c98a4a");
      g.fillStyle=grd;g.beginPath();g.arc(0,0,s*0.7,0,TAU);g.fill();
      // アイシング
      g.fillStyle=col;g.beginPath();g.arc(0,-s*0.05,s*0.7,0,Math.PI,true);
      g.arc(0,-s*0.05,s*0.62,Math.PI,0,false);g.closePath();g.fill();
      g.beginPath();g.arc(0,0,s*0.66,0,TAU);g.fill();
      // 穴
      g.fillStyle="#ffe6c8";g.beginPath();g.arc(0,0,s*0.24,0,TAU);g.fill();
      // スプリンクル
      const sc=["#ff5b8a","#5ad0ff","#7be08a","#fff"];
      for(let k=0;k<7;k++){const a=k*TAU/7+1;g.save();g.translate(Math.cos(a)*s*0.45,Math.sin(a)*s*0.45);g.rotate(a);
        g.fillStyle=sc[k%sc.length];g.fillRect(-s*0.04,-s*0.1,s*0.08,s*0.2);g.restore();}
    }
    g.restore();
  }

  // ① にじいろガムボール本体: 虹色のうずまき+回る発光オーラ(激レア・出た瞬間に目を引く)
  function drawRainbowSweet(s,wob){
    const pu=1+0.14*Math.sin(tsec*7+s.bob), hue=((tsec*120)|0)%360;
    g.save();g.translate(s.x,s.y+wob);
    // 影
    g.fillStyle="rgba(0,0,0,.15)";g.beginPath();g.ellipse(0,s.r*0.9,s.r*0.8,s.r*0.22,0,0,TAU);g.fill();
    // 発光オーラ(虹色に回る)
    g.save();g.globalCompositeOperation="lighter";
    const au=g.createRadialGradient(0,0,Math.max(0.1,s.r*0.2),0,0,Math.max(0.2,s.r*2.1));
    au.addColorStop(0,"hsla("+hue+",95%,65%,.5)");au.addColorStop(1,"hsla("+hue+",95%,65%,0)");
    g.fillStyle=au;g.beginPath();g.arc(0,0,Math.max(0.2,s.r*2.1),0,TAU);g.fill();g.restore();
    // 本体(虹のうずまき縞をまるくクリップ)
    const rr=Math.max(0.2,s.r*0.95);
    g.save();g.rotate(s.rot*0.5+tsec*0.6);g.scale(pu,pu);
    g.beginPath();g.arc(0,0,rr,0,TAU);g.save();g.clip();
    for(let k=0;k<7;k++){g.fillStyle="hsl("+((hue+k*40)%360)+",90%,60%)";
      g.beginPath();g.moveTo(-rr*1.4+k*rr*0.42,-rr*1.4);g.lineTo(-rr*1.0+k*rr*0.42,-rr*1.4);
      g.lineTo(rr*0.4+k*rr*0.42,rr*1.4);g.lineTo(rr*0.0+k*rr*0.42,rr*1.4);g.closePath();g.fill();}
    g.restore();
    g.strokeStyle="rgba(255,255,255,.85)";g.lineWidth=Math.max(2,rr*0.12);g.beginPath();g.arc(0,0,rr,0,TAU);g.stroke();
    g.fillStyle="rgba(255,255,255,.85)";g.beginPath();g.arc(-rr*0.3,-rr*0.35,rr*0.16,0,TAU);g.fill();
    g.restore();
    g.restore();
  }

  // 金の星(ゴールドキャンディ本体)
  function drawStar(s){
    g.fillStyle="rgba(0,0,0,.15)";g.beginPath();g.ellipse(0,s*0.9,s*0.8,s*0.22,0,0,TAU);g.fill();
    const grd=g.createRadialGradient(-s*0.25,-s*0.3,s*0.1,0,0,s);
    grd.addColorStop(0,"#fff6c8");grd.addColorStop(0.5,"#ffd23f");grd.addColorStop(1,"#ff9a1f");
    g.fillStyle=grd;
    g.beginPath();
    for(let i=0;i<10;i++){
      const a=-Math.PI/2+i*Math.PI/5,rr=i%2===0?s:s*0.46;
      if(i===0)g.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);
      else g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);
    }
    g.closePath();g.fill();
    g.strokeStyle="rgba(255,255,255,.75)";g.lineWidth=Math.max(2,s*0.09);g.lineJoin="round";g.stroke();
    g.fillStyle="rgba(255,255,255,.85)";g.beginPath();g.arc(-s*0.22,-s*0.3,s*0.14,0,TAU);g.fill();
  }

  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function lighten(hex,amt){const a=amt===undefined?50:amt;const c=parseInt(hex.slice(1),16);
    const r=Math.min(255,((c>>16)&255)+a),gg=Math.min(255,((c>>8)&255)+a),b=Math.min(255,(c&255)+a);
    return "rgb("+r+","+gg+","+b+")";}
  function shade(hex,amt){const c=parseInt(hex.slice(1),16);
    const r=clamp(((c>>16)&255)+amt,0,255),gg=clamp(((c>>8)&255)+amt,0,255),b=clamp((c&255)+amt,0,255);
    return "rgb("+r+","+gg+","+b+")";}
  function hexA(hex,al){
    if(hex.charAt(0)!=="#") return hex; // rgb(...)はそのまま
    const c=parseInt(hex.slice(1),16);
    return "rgba("+((c>>16)&255)+","+((c>>8)&255)+","+(c&255)+","+al+")";}
}
Engine.register("gumball", build_gumball);
