function build_chocofount(api){
  const g=api.g;
  api.preload(["bg.jpg","choco.png","star.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)
  // ----- all state lives here -----
  let sweets=[],drops=[],shards=[],rings=[],sparks=[],floats=[],bubbles=[],clouds=[];
  let cols,groundY,unit,tsec=0,count=0,combo=0,comboT=0,flash=0,flashHue="#fff";
  let spawnT=0,clearBanner=0,clearTxt="",celebrate=0,fountX=0,fountY=0;
  // stage progression: clear N sweets -> "ステージ クリア！" -> endless harder
  let stage=1,stageKill=0,stageGoal=10,stageClearing=false,clearStage=0,ending=0;
  let fcount=0,lastStop=-99; // frame counter + hitStop throttle
  // A: rare rainbow candy / B: choco-meter fever time
  let fever=0,feverT=0,feverBanner=0,feverRain=[];
  const FEVER_SEC=10;
  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマー/トラックと同じ思想) ----
  let luckyColor,luckySeen=false,luckyMsgT=0;   // ② きょうのラッキー色: 秘密の1色
  let rbMsgT=0;                                  // ① にじいろ 撃破バナー
  let comboKept=true,nonstopT=0;                 // ③ ノーミス判定: このステージ空ぶり無し
  let sunWink=0;                                 // ④ 太陽ひみつタップ
  let luckyStars=[];                             // ② ラッキー色ヒットの頭上ちいさな星
  const sunHit={x:0,y:0,r:0};                    // ④ 太陽の当たり判定(描画と一致)
  // candy-land palettes shift per stage
  const SKIES=[
    {a:"#ffe3f0",b:"#ffd0e6",c:"#c9b8ff",d:"#a8d8ff"}, // 1 strawberry sky
    {a:"#fff0c8",b:"#ffd9a0",c:"#ffb6c8",d:"#c8a0ff"}, // 2 caramel sunset
    {a:"#d8f0ff",b:"#b8e0ff",c:"#c8b8ff",d:"#ffc8e8"}, // 3 minty day
    {a:"#f0e0ff",b:"#e0c8ff",c:"#ffc8e0",d:"#ffe0b0"}, // 4 grape candy
    {a:"#fff7d0",b:"#ffe08a","c":"#ffb86a",d:"#ff9ad0"} // 5 golden cake
  ];
  const SWEETCOL=["#ff6fae","#ffd23f","#7be3c0","#9ab8ff","#ff9a5a","#c79bff","#ff7bd0"];
  const COLNAME={"#ff6fae":"ピンク","#ffd23f":"きいろ","#7be3c0":"みどり","#9ab8ff":"みずいろ","#ff9a5a":"オレンジ","#c79bff":"むらさき","#ff7bd0":"ピンク"};
  luckyColor=pick(SWEETCOL);   // ② 毎プレイ秘密に1色えらぶ(この色の キャンディ/グミ を つぶすと隠しボーナス)
  function sky(){return SKIES[(stage-1)%SKIES.length];}
  function goalFor(s){return 12+(s-1)*4;}   // 12,16,20,24,28（7〜8歳向けに手応えを2〜3割増やした）

  function layout(){
    groundY=api.H*0.9;
    unit=clamp(Math.min(api.W,api.H)*0.072,28,58);
    cols=clamp(Math.floor(api.W/(unit*2.2)),3,6);
    // ④ 太陽ひみつタップの当たり判定(お日さまの描画位置と一致・寛容に大きめ)
    sunHit.x=api.W*0.7;sunHit.y=api.H*0.12;sunHit.r=Math.max(38,api.W*0.085);
    // drifting candy clouds in the background
    clouds=[];
    for(let i=0;i<5;i++)clouds.push({x:rnd(0,api.W),y:api.H*rnd(0.06,0.30),s:rnd(0.7,1.5),
      sp:rnd(0.05,0.15),a:rnd(0.4,0.7),col:pick(["#ffffff","#ffe0f0","#e0f0ff"])});
    // ambient sweet bubbles floating up
    bubbles=[];
    for(let i=0;i<14;i++)bubbles.push(newBubble(rnd(0,api.H)));
  }
  layout();

  function newBubble(y){
    return {x:rnd(0,api.W),y:y==null?api.H+10:y,r:rnd(4,12),sp:rnd(0.25,0.8),
      ph:rnd(0,TAU),amp:rnd(8,26),col:pick(SWEETCOL)};
  }
  function pickType(){
    const bag=["candy","candy","candy","gummy","cake"];
    if(stage>=2)bag.push("choco");          // チョコ: 2回当てる
    if(stage>=3){bag.push("star");bag.push("choco");} // きらきらキャンディ(高得点)
    if(stage>=4)bag.push("star");
    return pick(bag);
  }
  function spawn(){
    // count only live (unlaunched) sweets so flying/falling ones don't block respawn
    let live=0;for(const sw of sweets)if(!sw.launched)live++;
    if(live>cols+3)return;
    const lane=rint(0,cols-1);
    const x=api.W*((lane+0.5)/cols)+rnd(-unit*0.4,unit*0.4);
    let type=pickType();
    // rare rainbow candy (about 7%, at most 1 alive on screen)
    let hasRainbow=false;
    for(const sw of sweets)if(sw.type==="rainbow"&&!sw.launched)hasRainbow=true;
    if(!hasRainbow&&Math.random()<0.07)type="rainbow";
    // 軸7: 同じ大きさが並ばないよう、種類ごとに大きさをはっきりばらつかせる
    let col=pick(SWEETCOL),hp=1,r=unit;
    if(type==="choco"){col="#7a4a28";hp=2;r=unit*1.12;}
    else if(type==="star"){col="#ffe14a";r=unit*rnd(1.1,1.25);} // 大きめ: 高得点で目立つ
    else if(type==="cake"){col="#ff9ec4";r=unit*rnd(1.3,1.4);}  // いちばん大きい
    else if(type==="gummy"){col=pick(["#7be3c0","#9ab8ff","#ff9a5a"]);
      r=Math.random()<0.5?unit*rnd(0.55,0.6):unit*rnd(0.85,1.0);} // 小粒/ふつう粒が混ざる
    else if(type==="rainbow"){col="#ff6fae";r=unit*1.18;}
    let sy=api.H*rnd(0.16,0.40);
    // 軸6: 大きいスイーツ(cake/star/rainbow等)ほど上端(sy-r)がHUD帯に届きやすいので、
    // 決定済みのr(半径)に応じてsyの下限を押し下げ、HUDの文字とバーに重ならないようにする
    const topSafe=api.H*0.075+r;
    sy=Math.max(sy,topSafe);
    sweets.push({x,y:sy,vx:rnd(-0.4,0.4),bob:rnd(0,TAU),
      type,col,hp,r,spin:rnd(0,TAU),vs:rnd(-0.03,0.03),hurt:0,launched:false,vy:0,
      ph:rnd(0,360)});
    // eye-catching entrance for the rare one: chime + callout
    if(type==="rainbow"){
      api.tone(1318,0.12,"triangle",0.12);api.tone(1760,0.18,"triangle",0.1);
      floats.push({x:clamp(x,unit*2,api.W-unit*2),y:sy-unit*1.4,txt:"にじいろキャンディ！",
        life:1,vy:-0.6,col:"#ff2bff",size:26});
    }
  }
  // pre-seed a few
  for(let i=0;i<5;i++)spawn();

  function fountain(px){
    // shoot a column of chocolate up from the bottom at px
    fountX=clamp(px,unit,api.W-unit);fountY=groundY;
    api.slide(160,520,0.22,0.22,"sine");
    api.noise(0.16,0.14,900,"lowpass",0.8);
    for(let i=0;i<rint(10,14);i++){
      drops.push({x:fountX+rnd(-unit*0.5,unit*0.5),y:groundY,
        vx:rnd(-2.2,2.2),vy:rnd(-15,-22),r:rnd(unit*0.16,unit*0.34),
        life:1,col:i%4===0?"#a9683a":"#6b3f22"});
    }
    // splash sparkle at base
    for(let i=0;i<6;i++){const a=rnd(-Math.PI,0),s=rnd(3,7);
      sparks.push({x:fountX,y:groundY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,16),
        life:1,decay:rnd(0.05,0.09),col:"#ffe7c2"});}
    // the rising column can hit sweets above the tap point (resting ones too)
    let hit=false;
    for(const sw of sweets){
      if(sw.launched)continue;
      // 軸3: ふん水の柱そのものの当たり幅も、狙わず連打しても勝ててしまわない程度に少し絞る(旧1.6)
      if(Math.abs(sw.x-fountX)<sw.r*0.85 && sw.y<groundY){ hitSweet(sw); hit=true; }
    }
    // kid-friendly auto-aim: a near miss still splashes the closest sweet
    if(!hit){
      let best=null,bd=unit*1.0; // 軸3: 連打が伸びすぎないよう狭めた「にがて吸着」(旧3.2=画面レーン幅相当だった)
      for(const sw of sweets){
        if(sw.launched)continue;
        const d=Math.abs(sw.x-fountX);
        if(d<bd){bd=d;best=sw;}
      }
      if(best){hitSweet(best);hit=true;}
    }
    if(!hit){combo=0;comboT=0;comboKept=false;}   // ③ 空ぶり=ノーミス失敗
  }
  function hitSweet(sw){
    if(sw.type==="choco"&&sw.hp>1){
      sw.hp--;sw.hurt=1;
      api.tone(300,0.07,"square",0.12);api.noise(0.06,0.1,1400);api.shake(4);
      ringAt(sw.x,sw.y,"#caa078");
      for(let i=0;i<6;i++){const a=rnd(0,TAU),s=rnd(2,5);
        shards.push({x:sw.x,y:sw.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,6),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.02,col:"#5a3318"});}
      return;
    }
    // launch + break
    sw.launched=true;sw.vy=-rnd(14,20);sw.vx=rnd(-3,3);
    let gain=sw.type==="rainbow"?6:sw.type==="star"?3:sw.type==="cake"?2:1;
    // ② きょうのラッキー色: 秘密の色の キャンディ/グミ を つぶすと +1 の隠しボーナス(気づくと得)
    const isLucky=(sw.type==="candy"||sw.type==="gummy")&&sw.col===luckyColor;
    if(isLucky){gain+=1;
      if(!luckySeen){luckyMsgT=1.6;luckySeen=true;}          // 初回だけ中央上に一度おしえる
      floats.push({x:sw.x,y:sw.y-unit*0.6,txt:"ラッキー！",life:1,vy:-0.9,col:luckyColor,size:26});
      luckyStars.push({x:sw.x,y:sw.y-sw.r*1.1,life:1,ph:rnd(0,TAU)}); // 頭上のキラッ
      api.tone(1046,0.12,"triangle",0.11);api.tone(1568,0.14,"triangle",0.07);}
    count+=gain;stageKill+=1;api.setScore(count);
    combo++;comboT=1.0;
    flashHue=sw.col;flash=Math.min(1,flash+0.32+combo*0.02);
    api.boom(0.4+Math.min(combo,8)*0.02);
    api.slide(420*Math.pow(2,clamp(combo,0,12)/14),120,0.16,0.3,"triangle");
    api.noise(0.12,0.18,1600);api.shake(5+Math.min(combo,8));
    // hitStop only on milestone combos or well-spaced big hits (avoid freeze loop)
    if(combo===5||combo===10){api.hitStop(4);lastStop=fcount;}
    else if(fcount-lastStop>=45){api.hitStop(2);lastStop=fcount;}
    burst(sw.x,sw.y,sw.col,combo>=5);
    specialBreak(sw); // 軸7: choco/cakeは通常のshard散布と違う壊れ方を追加
    ringAt(sw.x,sw.y,sw.col);
    if(sw.type==="star"){api.tone(1046,0.16,"triangle",0.14);api.tone(1318,0.18,"triangle",0.1);}
    // ① にじいろキャンディ 撃破: 虹の輪がぶわっと広がる激レアの大盤振る舞い
    if(sw.type==="rainbow")rainbowBurst(sw.x,sw.y);
    if(combo>1)floats.push({x:sw.x,y:sw.y-unit,txt:"x"+combo,life:1,vy:-1.1,
      col:combo>=8?"#ff2bff":combo>=5?"#ff5b5b":combo>=3?"#ff8c42":"#ffd23f",
      size:combo>=4?40:30});
    if(combo>=3)celebrate=Math.min(1.6,celebrate+0.4);
    checkStage();
  }
  function ringAt(x,y,col){
    rings.push({x,y,r:unit*0.5,vr:unit*0.5,life:1,decay:0.05,col});
    rings.push({x,y,r:unit*0.2,vr:unit*0.36,life:1,decay:0.05,col:"#ffffff"});
  }
  function burst(x,y,col,big){
    const n=(big?16:10)+Math.min(combo,6);
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(2.5,8);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(3,8),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.014,0.024),
        col:i%3===0?col:(i%3===1?"#ffffff":"#ffd23f")});}
    for(let i=0;i<rint(5,8);i++){const a=rnd(0,TAU),s=rnd(4,11);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,18),
        life:1,decay:rnd(0.05,0.09),col:"#fff7c2"});}
  }
  function specialBreak(sw){
    // 軸7: choco=上下2つの塊に割れて落ちる／cake=つぶれてfrostingが横に広がる(通常のburst()の丸い破片と違う壊れ方)
    if(sw.type==="choco"){
      for(const s of [-1,1]){
        shards.push({x:sw.x,y:sw.y+s*sw.r*0.15,vx:rnd(-1.2,1.2),vy:s*rnd(1,2)-2,
          r:sw.r*0.5,rot:rnd(0,TAU),vr:rnd(-0.15,0.15),life:1,decay:0.014,
          col:"#5a3318",shape:"block"});
      }
    }else if(sw.type==="cake"){
      for(let i=0;i<8;i++){const a=rnd(-0.3,Math.PI+0.3),s=rnd(3,7);
        shards.push({x:sw.x,y:sw.y+sw.r*0.2,vx:Math.cos(a)*s,vy:Math.sin(a)*-0.6,
          r:rnd(sw.r*0.22,sw.r*0.4),rot:rnd(0,TAU),vr:rnd(-0.2,0.2),life:1,decay:0.02,
          col:"#ffe6f2",shape:"blob"});}
    }
  }
  const RBW=["#ff5b5b","#ff9a5a","#ffd23f","#7be3c0","#9ab8ff","#c79bff"];
  function rainbowBurst(x,y){
    // ① にじいろキャンディ 撃破の特別演出: 虹色の輪+破片。フラッシュは控えめ(白飛び防止)。
    rbMsgT=1.4;celebrate=Math.min(1.8,celebrate+0.5);
    flash=Math.min(1,flash+0.28);flashHue="#ffb0e6";
    api.boom(0.6);api.shake(16);
    if(fcount-lastStop>=32){api.hitStop(4);lastStop=fcount;}   // 節目限定+クールダウン
    api.slide(660,1320,0.5,0.22,"triangle");api.tone(880,0.14,"triangle",0.12);api.tone(1320,0.16,"triangle",0.1);
    for(let k=0;k<RBW.length;k++)rings.push({x,y,r:unit*0.4,vr:unit*(0.5+k*0.12),life:1,decay:0.05,col:RBW[k]});
    for(let i=0;i<26;i++){const a=rnd(0,TAU),s=rnd(3,10);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:RBW[i%RBW.length]});}
    if(shards.length>160)shards.splice(0,shards.length-160);
  }
  function checkStage(){
    if(stageKill<stageGoal||stageClearing||ending>0)return;
    stageClearing=true;
    // ③ ノーミス ボーナス: このステージを 空ぶり(ハズレ)無しで つぶし切ったら +3 & みどりの星シャワー
    if(comboKept){count+=3;api.setScore(count);nonstopT=1.9;
      api.tone(1318,0.16,"triangle",0.12);api.tone(1976,0.18,"triangle",0.08);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(3,8);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,
          r:rnd(4,8),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:"#7be3c0"});}}
    comboKept=true;   // 次ステージ(またはループ)のノーミス判定をリセット
    if(stage>=5){
      ending=2.6;celebrate=1.8;flash=1;flashHue="#ffd23f";
      clearBanner=2.6;clearTxt="ぜんぶ クリア！";
      api.boom(0.7);api.shake(20);
      api.slide(523,1046,0.5,0.22,"triangle");
    }else{
      clearStage=stage;clearBanner=1.7;clearTxt="ステージ "+stage+" クリア！";
      celebrate=1.4;flash=0.7;flashHue=sky().c;
      api.boom(0.5);api.shake(12);
      api.slide(523,784,0.3,0.2,"triangle");api.tone(988,0.3,"triangle",0.1);
      // celebratory candy burst from center
      for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,
          r:rnd(4,9),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),
          col:pick(SWEETCOL)});}
    }
    setTimeout(function(){
      if(ending>0){stage=1;}else{stage=clearStage+1;}
      stageGoal=goalFor(stage);stageKill=0;combo=0;stageClearing=false;
      spawnT=10;
    }, 420);
  }

  return {
    resize:layout,
    input(x,y,type){
      if(type!=="down")return;
      if(clearBanner>0&&stageClearing)return;
      // ④ 太陽ひみつタップ: お日さまに触れたら ウインク＋あまいコインがこぼれる(ふん水は出ない/減点なし)
      if(sunHit.r>0 && Math.hypot(x-sunHit.x,y-sunHit.y)<sunHit.r){
        sunWink=1;api.tone(1318,0.1,"triangle",0.09);api.tone(1760,0.12,"triangle",0.07);
        for(let i=0;i<7;i++){const a=rnd(-Math.PI,0),s=rnd(3,7);
          sparks.push({x:sunHit.x,y:sunHit.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,len:rnd(8,15),
            life:1,decay:rnd(0.04,0.07),col:"#ffe7a0"});}
        for(let i=0;i<6;i++){const a=rnd(-Math.PI,0),s=rnd(2,5);
          shards.push({x:sunHit.x,y:sunHit.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,6),
            rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.018,col:i%2?"#ffd23f":"#fff0a0"});}
        return;
      }
      fountain(x);
    },
    frame(dt,now){
      tsec+=0.016*dt;fcount++;
      if(celebrate>0)celebrate=Math.max(0,celebrate-0.02*dt);
      // ---- background: pastel candy sky gradient ----
      const sk=sky();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージのパレット色を薄く重ねて面ごとの雰囲気を変える(1面はそのまま)
        if((stage-1)%SKIES.length!==0){g.save();g.globalAlpha=0.24;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,sk.a);tg.addColorStop(0.5,sk.c);tg.addColorStop(1,sk.d);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,sk.a);grd.addColorStop(0.34,sk.b);
        grd.addColorStop(0.66,sk.c);grd.addColorStop(1,sk.d);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // soft sun glow upper area
      let sun=g.createRadialGradient(api.W*0.7,api.H*0.12,0,api.W*0.7,api.H*0.12,api.W*0.5);
      sun.addColorStop(0,"rgba(255,250,225,.45)");sun.addColorStop(1,"rgba(255,250,225,0)");
      g.fillStyle=sun;g.fillRect(0,0,api.W,api.H);
      // friendly sun disc (④ ひみつタップの目印) + タップした瞬間だけウインク顔
      const sunx=sunHit.x,suny=sunHit.y,sunr=Math.max(18,api.W*0.042);
      g.save();g.shadowColor="rgba(255,238,180,.85)";g.shadowBlur=22;
      g.fillStyle="rgba(255,250,220,.9)";g.beginPath();g.arc(sunx,suny,sunr,0,TAU);g.fill();g.restore();
      if(sunWink>0){sunWink-=0.018*dt;
        g.save();g.strokeStyle="#e0a030";g.lineWidth=Math.max(2,sunr*0.13);g.lineCap="round";
        g.globalAlpha=clamp(sunWink*1.4,0,1);
        g.beginPath();
        g.moveTo(sunx-sunr*0.44,suny-sunr*0.02);g.quadraticCurveTo(sunx-sunr*0.29,suny-sunr*0.3,sunx-sunr*0.14,suny-sunr*0.02);
        g.moveTo(sunx+sunr*0.14,suny-sunr*0.02);g.quadraticCurveTo(sunx+sunr*0.29,suny-sunr*0.3,sunx+sunr*0.44,suny-sunr*0.02);
        g.stroke();
        g.beginPath();g.arc(sunx,suny+sunr*0.14,sunr*0.34,0.12*Math.PI,0.88*Math.PI);g.stroke();
        g.restore();g.globalAlpha=1;if(sunWink<0)sunWink=0;}
      // drifting candy clouds (cotton-candy puffs) ※画像背景のときは絵に雲があるので描かない
      if(!imgBg) for(const c of clouds){
        c.x+=c.sp*dt;if(c.x>api.W+90*c.s)c.x=-90*c.s;
        g.save();g.globalAlpha=c.a;g.fillStyle=c.col;const w=44*c.s;
        g.beginPath();
        g.ellipse(c.x,c.y,w,w*0.6,0,0,TAU);
        g.ellipse(c.x+w*0.8,c.y+w*0.1,w*0.7,w*0.5,0,0,TAU);
        g.ellipse(c.x-w*0.8,c.y+w*0.12,w*0.6,w*0.42,0,0,TAU);
        g.fill();g.restore();
      }
      g.globalAlpha=1;
      // floating sweet bubbles drifting up (additive glow)
      g.save();g.globalCompositeOperation="lighter";
      for(const b of bubbles){
        b.y-=b.sp*dt;b.ph+=0.03*dt;
        const bx=b.x+Math.sin(b.ph)*b.amp;
        g.globalAlpha=0.4;g.shadowBlur=8;g.shadowColor=b.col;g.fillStyle=b.col;
        g.beginPath();g.arc(bx,b.y,b.r,0,TAU);g.fill();
        g.globalAlpha=0.7;g.shadowBlur=0;g.fillStyle="rgba(255,255,255,.7)";
        g.beginPath();g.arc(bx-b.r*0.3,b.y-b.r*0.3,b.r*0.3,0,TAU);g.fill();
      }
      g.restore();g.globalAlpha=1;
      for(let i=0;i<bubbles.length;i++)if(bubbles[i].y<-20)bubbles[i]=newBubble();
      // ---- ground: chocolate fountain pool ---- ※画像背景のときは平坦な地面帯を描かない(絵と喧嘩する)
      if(!imgBg){
        let gpg=g.createLinearGradient(0,groundY,0,api.H);
        gpg.addColorStop(0,"#7a4a28");gpg.addColorStop(1,"#4a2a14");
        g.fillStyle=gpg;g.fillRect(0,groundY,api.W,api.H-groundY);
        // glossy choco surface waves
        g.save();g.beginPath();g.rect(0,groundY,api.W,18);g.clip();
        g.fillStyle="rgba(255,220,170,.25)";
        for(let x=0;x<api.W;x+=30){
          const wy=groundY+4+Math.sin(x*0.05+tsec*2)*3;
          g.beginPath();g.ellipse(x,wy,16,4,0,0,TAU);g.fill();
        }
        g.restore();
      }

      // ---- spawn sweets ----
      const paused=stageClearing;
      if(!paused){spawnT-=dt;if(spawnT<=0){spawn();spawnT=clamp(46-(stage-1)*6,22,46);}}   // 7〜8歳向け: 出現テンポを2割ほど速く

      // ---- update + draw sweets ----
      for(const sw of sweets){
        if(sw.hurt>0)sw.hurt-=0.06*dt;
        sw.spin+=sw.vs*dt;sw.bob+=0.05*dt;
        if(sw.launched){
          sw.vy+=0.7*dt;sw.x+=sw.vx*dt;sw.y+=sw.vy*dt;
          // remove once off-screen top OR bottom (launched sweets that fall back)
          if(sw.y<-unit*2||sw.y>api.H+unit*2)sw._dead=true;
        }else{
          // gentle horizontal float, soft drift downward, bob
          sw.x+=sw.vx*dt;
          if(sw.x<unit){sw.x=unit;sw.vx*=-1;}
          if(sw.x>api.W-unit){sw.x=api.W-unit;sw.vx*=-1;}
          sw.y+=0.18*dt; // slowly sink so player must shoot them
          if(sw.y>groundY-unit*0.6){sw.y=groundY-unit*0.6;} // rest just above pool
        }
        drawSweet(sw);
      }
      sweets=sweets.filter(s=>!s._dead);

      // ---- chocolate fountain droplets ----
      for(const d of drops){
        d.vy+=0.55*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;
        if(d.y>groundY){d.life-=0.12*dt;}else d.life-=0.006*dt;
        // a rising drop can still clip sweets it passes
        if(d.vy<0){
          for(const sw of sweets){
            if(sw.launched)continue;
            if(Math.abs(sw.x-d.x)<sw.r&&Math.abs(sw.y-d.y)<sw.r){hitSweet(sw);d.life-=0.4;}
          }
        }
      }
      drops=drops.filter(d=>d.life>0);
      // draw choco column glow when active
      g.save();
      for(const d of drops){
        g.globalAlpha=Math.max(0,d.life);
        g.fillStyle=d.col;
        g.beginPath();g.arc(d.x,d.y,d.r*(0.6+d.life*0.4),0,TAU);g.fill();
        g.fillStyle="rgba(255,230,190,.4)";
        g.beginPath();g.arc(d.x-d.r*0.3,d.y-d.r*0.3,d.r*0.25,0,TAU);g.fill();
      }
      g.restore();g.globalAlpha=1;

      // ---- shockwave rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);

      // ---- shards ----
      for(const s of shards){s.vy+=0.3*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.rot+=s.vr*dt;
        s.life-=s.decay*dt;
        const sr=Math.max(0.001,s.r*(0.6+s.life*0.4));
        g.save();g.globalAlpha=Math.max(0,s.life);g.translate(s.x,s.y);g.rotate(s.rot);
        g.shadowColor=s.col;g.shadowBlur=6;g.fillStyle=s.col;
        g.beginPath();
        if(s.shape==="block")rrect(-sr,-sr*0.85,sr*2,sr*1.7,sr*0.3);      // choco: 四角い塊
        else if(s.shape==="blob")g.ellipse(0,0,sr*1.5,sr*0.75,0,0,TAU);    // cake: 横に広がるfrosting
        else g.arc(0,0,sr,0,TAU);                                          // 通常の丸い破片
        g.fill();g.restore();}
      g.shadowBlur=0;g.globalAlpha=1;shards=shards.filter(s=>s.life>0);

      // ---- glint sparks (additive) ----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;
        sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle=sp.col;g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;sparks=sparks.filter(sp=>sp.life>0);

      // ---- ② ラッキー色ヒットの 頭上ちいさな星(気づけるヒント) ----
      for(const ls of luckyStars){ls.y-=0.6*dt;ls.life-=0.02*dt;ls.ph+=0.2*dt;
        const tw=0.7+0.3*Math.sin(ls.ph);
        g.save();g.globalAlpha=Math.max(0,ls.life);g.translate(ls.x,ls.y);
        g.shadowColor=luckyColor;g.shadowBlur=10;g.fillStyle="#fff7c2";
        starPath(Math.max(1,unit*0.26*tw));g.fill();g.restore();}
      g.shadowBlur=0;g.globalAlpha=1;luckyStars=luckyStars.filter(ls=>ls.life>0);

      // ---- floats (combo numbers) ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.018*dt;
        g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(80,40,20,.5)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);

      // ---- climax color-wash on big combos ----
      if(celebrate>0){const ca=Math.min(1,celebrate);
        const cw=g.createRadialGradient(api.W/2,api.H*0.5,0,api.W/2,api.H*0.5,api.W*0.75);
        cw.addColorStop(0,"rgba(255,240,200,"+(0.4*ca)+")");
        cw.addColorStop(0.5,"rgba(255,180,210,"+(0.2*ca)+")");
        cw.addColorStop(1,"rgba(255,180,210,0)");
        g.save();g.globalCompositeOperation="lighter";g.fillStyle=cw;
        g.fillRect(0,0,api.W,api.H);g.restore();}

      // ---- impact flash ----
      if(flash>0){flash-=0.06*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa*0.3;
        g.fillStyle=flashHue;g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}

      // ---- combo text (top-center safe zone) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.16);g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(255,120,180,.8)";g.shadowBlur=14;
        g.fillStyle="#ff7bd0";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.6)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }

      // ---- ① にじいろ ゲット！ バナー(虹色に色替わり・上部中央=HUD安全帯) ----
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=RBW[Math.floor(tsec*6)%RBW.length];
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle="#ffffff";g.fillText("にじいろ ゲット！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろ ゲット！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ---- ② きょうのラッキー色 はっけん！ 中央の小ヒント(初回だけ) ----
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        const pop=1+Math.max(0,luckyMsgT-0.9)*1.3,t2="きょうの ラッキーいろは "+(COLNAME[luckyColor]||"ひみつ")+"！";
        g.save();g.translate(api.W/2,api.H*0.28);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 23px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=luckyColor;g.shadowBlur=14;g.fillStyle="#fff7c2";g.fillText(t2,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(120,60,30,.5)";g.strokeText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ---- ③ ノーミス ボーナス！ バナー(クリア文字より下=重ねない) ----
      if(nonstopT>0){nonstopT-=0.014*dt;
        const pop=1+Math.max(0,nonstopT-1.3)*1.3;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(nonstopT*1.3,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,227,192,.9)";g.shadowBlur=16;g.fillStyle="#c7ffe6";g.fillText("ノーミス ボーナス！",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(30,110,80,.7)";g.strokeText("ノーミス ボーナス！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(nonstopT<0)nonstopT=0;}

      // ---- HUD: stage + progress gauge (top-center) ----
      drawHUD();

      // ---- stage clear / ending banner ----
      if(clearBanner>0){clearBanner-=0.016*dt;
        const a=clamp(clearBanner*1.5,0,1);
        const pop=1+Math.max(0,clearBanner-(ending>0?2.0:1.3))*1.6;
        g.save();g.globalAlpha=a*0.4;g.fillStyle="#3a1428";
        g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 "+(ending>0?52:44)+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,150,200,.9)";g.shadowBlur=20;
        let tg=g.createLinearGradient(0,-30,0,34);
        tg.addColorStop(0,"#fff2c0");tg.addColorStop(1,"#ff8ac0");
        g.fillStyle=tg;g.fillText(clearTxt,0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText(clearTxt,0,0);
        if(ending<=0){g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
          g.fillText("つぎは ステージ "+(clearStage+1)+"!",0,40);}
        else{g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
          g.fillText("もういちど あそべるよ",0,42);}
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearBanner<=0)clearBanner=0;
      }
      if(ending>0)ending=Math.max(0,ending-0.016*dt);
      // 加算合成が次フレームへ漏れないよう明示的に戻す(白飛び防止の保険)
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
    },
    stop(){}
  };

  // ===== drawing helpers =====
  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.045;
    g.save();g.textAlign="center";
    // 軸6の保険: スイーツの端がHUDに触れても文字が読めるよう、文字+バーの背後に薄い帯を敷く
    g.fillStyle="rgba(0,0,0,.15)";rrect(api.W/2-bw/2-14,by-14,bw+28,bh+18,10);g.fill();
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(120,60,30,.6)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(80,40,20,.35)";rrect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#ff9ec4");gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg;rrect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;rrect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }
  function drawSweet(sw){
    const x=sw.x,y=sw.y,r=sw.r,t=sw.type;
    g.save();g.translate(x,y);
    // soft shadow when floating low
    if(!sw.launched){g.fillStyle="rgba(0,0,0,.12)";g.beginPath();
      g.ellipse(0,r*0.95,r*0.7,r*0.22,0,0,TAU);g.fill();}
    g.rotate(Math.sin(sw.bob)*0.12+sw.spin);
    // 軸6: 背景(ピンクの綿あめ木立)と同系色になりがちな標的を、濃い影で浮かせる
    g.shadowColor="rgba(30,15,10,.55)";g.shadowBlur=Math.max(4,r*0.22);
    if(t==="candy")drawCandy(r,sw.col);
    else if(t==="gummy")drawGummy(r,sw.col);
    else if(t==="choco")drawChoco(r,sw);
    else if(t==="cake")drawCake(r,sw.col);
    else if(t==="star")drawStarCandy(r);
    else if(t==="rainbow")drawRainbow(r,sw);
    g.shadowBlur=0;
    // hurt flash overlay
    if(sw.hurt>0){g.globalAlpha=sw.hurt*0.7;g.fillStyle="#fff";
      g.beginPath();g.arc(0,0,r*0.95,0,TAU);g.fill();g.globalAlpha=1;}
    // cute face (shared)
    drawFace(r);
    g.restore();
  }
  function drawFace(r){
    g.fillStyle="#3a2418";
    g.beginPath();g.arc(-r*0.26,-r*0.06,r*0.1,0,TAU);g.arc(r*0.26,-r*0.06,r*0.1,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.85)";
    g.beginPath();g.arc(-r*0.29,-r*0.1,r*0.035,0,TAU);g.arc(r*0.23,-r*0.1,r*0.035,0,TAU);g.fill();
    g.fillStyle="rgba(255,130,160,.4)";
    g.beginPath();g.arc(-r*0.38,r*0.1,r*0.11,0,TAU);g.arc(r*0.38,r*0.1,r*0.11,0,TAU);g.fill();
    g.strokeStyle="#3a2418";g.lineWidth=r*0.05;g.lineCap="round";
    g.beginPath();g.arc(0,r*0.04,r*0.12,0.15*Math.PI,0.85*Math.PI);g.stroke();
  }
  function drawCandy(r,col){
    // round wrapped candy with twisted ends
    const grd=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r);
    grd.addColorStop(0,lighten(col,80));grd.addColorStop(0.6,lighten(col,20));grd.addColorStop(1,col);
    g.fillStyle=grd;g.beginPath();g.arc(0,0,r*0.7,0,TAU);g.fill();
    g.fillStyle=col;
    [-1,1].forEach(s=>{g.beginPath();g.moveTo(s*r*0.6,0);
      g.lineTo(s*r*1.05,-r*0.35);g.lineTo(s*r*1.05,r*0.35);g.closePath();g.fill();});
    g.fillStyle="rgba(255,255,255,.4)";g.beginPath();
    g.ellipse(-r*0.2,-r*0.28,r*0.22,r*0.12,-0.4,0,TAU);g.fill();
    // 軸6: 背景のピンク綿あめと混ざらないよう、縁取りを濃い焦げ茶+太めに
    g.strokeStyle="rgba(60,30,15,.6)";g.lineWidth=3;g.beginPath();g.arc(0,0,r*0.7,0,TAU);g.stroke();
  }
  function drawGummy(r,col){
    // glossy translucent gumdrop
    const grd=g.createLinearGradient(0,-r,0,r);
    grd.addColorStop(0,lighten(col,90));grd.addColorStop(0.5,col);grd.addColorStop(1,lighten(col,-20));
    g.fillStyle=grd;
    g.beginPath();g.moveTo(0,-r*0.85);
    g.quadraticCurveTo(r*0.85,-r*0.6,r*0.7,r*0.55);
    g.quadraticCurveTo(0,r*0.9,-r*0.7,r*0.55);
    g.quadraticCurveTo(-r*0.85,-r*0.6,0,-r*0.85);g.closePath();g.fill();
    g.fillStyle="rgba(255,255,255,.5)";g.beginPath();
    g.ellipse(-r*0.22,-r*0.3,r*0.18,r*0.3,-0.3,0,TAU);g.fill();
    // 軸6: グミも輪郭が薄いと背景に沈むので濃い焦げ茶の縁取りを足す
    g.strokeStyle="rgba(60,30,15,.6)";g.lineWidth=3;g.beginPath();
    g.moveTo(0,-r*0.85);
    g.quadraticCurveTo(r*0.85,-r*0.6,r*0.7,r*0.55);
    g.quadraticCurveTo(0,r*0.9,-r*0.7,r*0.55);
    g.quadraticCurveTo(-r*0.85,-r*0.6,0,-r*0.85);g.closePath();g.stroke();
  }
  function drawChoco(r,sw){
    // 画像choco: 固定の茶色スプライト(色替え不要)。1回目のヒビだけ重ねて描く
    if(api.drawAsset("choco.png",0,0,r*2.2,r*2.2,{center:true})){
      if(sw.hp<2){g.strokeStyle="rgba(30,15,5,.8)";g.lineWidth=2.5;g.lineCap="round";
        g.beginPath();g.moveTo(-r*0.3,-r*0.7);g.lineTo(r*0.08,-r*0.15);g.lineTo(-r*0.15,r*0.3);g.lineTo(r*0.3,r*0.75);g.stroke();}
      return;
    }
    // chocolate square (tough), shows crack after first hit
    const s=r*0.78;
    const grd=g.createLinearGradient(-s,-s,s,s);
    grd.addColorStop(0,"#a9683a");grd.addColorStop(0.5,"#7a4a28");grd.addColorStop(1,"#4a2a14");
    g.fillStyle=grd;rrect(-s,-s,s*2,s*2,r*0.18);g.fill();
    // grid squares
    g.strokeStyle="rgba(40,20,10,.5)";g.lineWidth=2;
    g.beginPath();g.moveTo(0,-s);g.lineTo(0,s);g.moveTo(-s,0);g.lineTo(s,0);g.stroke();
    g.fillStyle="rgba(255,220,180,.25)";rrect(-s,-s,s*2,s*0.4,r*0.1);g.fill();
    if(sw.hp<2){g.strokeStyle="rgba(30,15,5,.8)";g.lineWidth=2.5;g.lineCap="round";
      g.beginPath();g.moveTo(-s*0.4,-s);g.lineTo(s*0.1,-s*0.2);g.lineTo(-s*0.2,s*0.4);g.lineTo(s*0.4,s);g.stroke();}
  }
  function drawCake(r,col){
    // little cake slice / cupcake-ish: pink frosting dome on base
    g.fillStyle="#f3c98a";rrect(-r*0.6,r*0.05,r*1.2,r*0.6,r*0.12);g.fill();
    g.fillStyle="rgba(120,70,30,.3)";
    for(let i=-2;i<=2;i++){g.beginPath();g.moveTo(i*r*0.22,r*0.05);g.lineTo(i*r*0.22,r*0.65);g.stroke();}
    const grd=g.createRadialGradient(-r*0.2,-r*0.3,r*0.1,0,0,r*0.7);
    grd.addColorStop(0,lighten(col,70));grd.addColorStop(1,col);
    g.fillStyle=grd;g.beginPath();
    g.moveTo(-r*0.6,r*0.05);
    g.quadraticCurveTo(-r*0.5,-r*0.7,0,-r*0.7);
    g.quadraticCurveTo(r*0.5,-r*0.7,r*0.6,r*0.05);g.closePath();g.fill();
    // cherry on top
    g.fillStyle="#ff4d6d";g.beginPath();g.arc(0,-r*0.75,r*0.13,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.6)";g.beginPath();g.arc(-r*0.04,-r*0.8,r*0.04,0,TAU);g.fill();
  }
  function drawStarCandy(r){
    // shiny lollipop star (high value): glow + 5-point star
    g.save();g.globalCompositeOperation="lighter";
    const gp=0.5+0.5*Math.sin(tsec*4);
    const ag=g.createRadialGradient(0,0,0,0,0,Math.max(1,r*1.5));
    ag.addColorStop(0,"rgba(255,240,150,"+(0.6*gp)+")");ag.addColorStop(1,"rgba(255,240,150,0)");
    g.fillStyle=ag;g.beginPath();g.arc(0,0,Math.max(1,r*1.5),0,TAU);g.fill();g.restore();
    // 画像star: 固定の金色スプライト(色替え不要)
    if(api.drawAsset("star.png",0,0,r*2.2,r*2.2,{center:true}))return;
    const grd=g.createRadialGradient(-r*0.2,-r*0.2,r*0.1,0,0,Math.max(1,r));
    grd.addColorStop(0,"#fff3b0");grd.addColorStop(1,"#ffc83f");
    g.fillStyle=grd;starPath(r*0.85);g.fill();
    g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=2;starPath(r*0.85);g.stroke();
  }
  function drawRainbow(r,sw){
    // ① にじいろキャンディ(激レア): 虹色に脈打つ本体+きらめきグロー
    g.save();g.globalCompositeOperation="lighter";
    const gp=0.4+0.4*Math.sin(tsec*4+sw.ph);
    const ag=g.createRadialGradient(0,0,0,0,0,Math.max(1,r*1.5));
    ag.addColorStop(0,"rgba(255,200,255,"+(0.5*gp)+")");ag.addColorStop(1,"rgba(255,200,255,0)");
    g.fillStyle=ag;g.beginPath();g.arc(0,0,Math.max(1,r*1.5),0,TAU);g.fill();
    g.restore();g.globalCompositeOperation="source-over";
    const hue=RBW[Math.floor(tsec*8+sw.ph)%RBW.length];
    const grd=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,Math.max(1,r*0.7));
    grd.addColorStop(0,"#ffffff");grd.addColorStop(0.55,hue);grd.addColorStop(1,hue);
    g.fillStyle=grd;g.beginPath();g.arc(0,0,r*0.7,0,TAU);g.fill();
    // twisted wrapper ends
    g.fillStyle=hue;
    [-1,1].forEach(s=>{g.beginPath();g.moveTo(s*r*0.6,0);
      g.lineTo(s*r*1.05,-r*0.35);g.lineTo(s*r*1.05,r*0.35);g.closePath();g.fill();});
    // little rainbow arc bands across the top
    for(let k=0;k<RBW.length;k++){g.strokeStyle=RBW[k];g.lineWidth=Math.max(1,r*0.055);
      g.beginPath();g.arc(0,r*0.1,Math.max(1,r*0.62-k*r*0.08),Math.PI*1.08,Math.PI*1.92);g.stroke();}
    // 軸6: にじいろも本体がピンク寄りに脈打つ瞬間があるので濃い縁取りで輪郭を保つ
    g.strokeStyle="rgba(60,30,15,.6)";g.lineWidth=3;g.beginPath();g.arc(0,0,r*0.7,0,TAU);g.stroke();
  }
  function starPath(r){g.beginPath();
    for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*0.46:r;
      g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}g.closePath();}
  function rrect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function lighten(hex,amt){const a=amt===undefined?50:amt;const c=parseInt(hex.slice(1),16);
    const r=clamp(((c>>16)&255)+a,0,255),gg=clamp(((c>>8)&255)+a,0,255),b=clamp((c&255)+a,0,255);
    return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("chocofount", build_chocofount);
