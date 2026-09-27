function buildDino(api){
  const g=api.g;
  api.preload(["bg.jpg","dino.png","castle.png","tree.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)
  let objs=[],shards=[],dust=[],arcs=[],floats=[],sparks=[],rings=[],clouds=[],motes=[];
  let groundY,slotW,cx,facing,sweepT,sweeping,sweepHit,sweepDir,bob,count,combo,comboT,flash,tNow,squash,wash,washHue,blink;
  // progression/super-gauge/banner state
  let stage,stageHits,stageGoal,banner,gauge,superFlash,roar,grow,finaleT,superCD;
  const BCOL=["#e0563a","#3a8ee6","#f5c518","#ff8c42","#9b6bff","#e85d9a"];
  // ---- 隠し発見レイヤー(crane/punch/hammer/truck と同じ思想) ----
  // ① にじいろビル(激レア) ② きょうのラッキー色 ③ ノンストップ判定 ④ 太陽ひみつタップ
  let luckyColor,luckySeen,luckyMsgT,rbMsgT,comboKept,sunWink,luckyStars=[];
  const sunHit={x:0,y:0,r:0};   // ④ 太陽ひみつタップの当たり判定(描画と一致)
  const COLNAME={"#e0563a":"あか","#3a8ee6":"あお","#f5c518":"きいろ","#ff8c42":"オレンジ","#9b6bff":"むらさき","#e85d9a":"ピンク"};
  const STAGE_MAX=5; // 5ステージ目=お城クリアで特大フィナーレ、そしてループ
  // ステージごとのテーマ: 名前/背景空色/登場物の最低～最高サイズ倍率/お城出現率
  const STAGES=[
    // hmin/hmaxの幅をステージごとに広げ、同一面内でも大小の対比が出るようにした(軸7対策)
    {name:"ちいさな むら",sky:["#5fa8e0","#8ec5e8","#e6f4ff"],hmin:0.05,hmax:0.20,castle:0,hard:0.0},
    {name:"まちなか",     sky:["#5b9bd8","#8bbfe6","#e2f1ff"],hmin:0.06,hmax:0.24,castle:0,hard:0.15},
    {name:"たかい ビル",  sky:["#7e8fd6","#a6b3e6","#e8ecff"],hmin:0.08,hmax:0.28,castle:0,hard:0.36},
    {name:"ゆうやけ タウン",sky:["#e07a5f","#f2a07a","#ffe0c0"],hmin:0.09,hmax:0.32,castle:0.15,hard:0.36},
    {name:"おしろの くに", sky:["#7b6bd6","#a78fe6","#ffe6f4"],hmin:0.10,hmax:0.34,castle:0.4,hard:0.42}
  ];
  // 7〜8歳向けの手応え: ステージ目標 12,16,20,24,28 → 15,20,25,30,35 (約2〜3割増)。操作はそのまま。
  function stageGoalFor(s){return 15+s*5;}
  function stageDef(){return STAGES[Math.min(stage,STAGE_MAX-1)];}
  function layout(){
    groundY=api.H*0.82;cx=api.W/2;
    sunHit.x=api.W*0.82;sunHit.y=api.H*0.16;sunHit.r=Math.max(42,api.W*0.10); // ④ 太陽の当たり判定(描画の sun と一致)
    const n=clamp(Math.round(api.W/86),7,13);slotW=api.W/n;
    if(!objs.length){for(let i=0;i<n;i++)objs.push(mkObj(i));}
    else objs.forEach((o,i)=>{o.x=(i+0.5)*slotW;});
    clouds=[];for(let i=0;i<4;i++)clouds.push({x:rnd(0,api.W),y:rnd(api.H*0.08,api.H*0.32),s:rnd(0.7,1.5),sp:rnd(0.05,0.18)});
    motes=[];const mn=clamp(Math.round(api.W/40),12,28);
    for(let i=0;i<mn;i++)motes.push({x:rnd(0,api.W),y:rnd(0,groundY),r:rnd(1.5,4),ph:rnd(0,TAU),sp:rnd(0.18,0.5),drift:rnd(0.1,0.35),hue:rnd(44,58)});
  }
  function mkObj(i){
    const sd=stageDef();
    // お城 / 黄金 / 硬い / 木 / ビル の抽選
    if(Math.random()<sd.castle){
      return{x:(i+0.5)*slotW,slot:i,type:"castle",
        w:slotW*0.72,h:rnd(api.H*sd.hmax*0.9,api.H*sd.hmax),
        color:"#cfc6b0",state:"stand",vx:0,vy:0,rot:0,vr:0,respawnT:0,rise:1,seed:rint(0,999),sway:rnd(0,TAU),hp:2,maxhp:2}; // お城は2回なぎで崩れる(手応え)
    }
    const tree=stage===0?Math.random()<0.4:Math.random()<0.22;
    if(tree)return{x:(i+0.5)*slotW,slot:i,type:"tree",
      w:slotW*0.5,h:rnd(api.H*0.07,api.H*0.12),
      color:"#3a8e4a",state:"stand",vx:0,vy:0,rot:0,vr:0,respawnT:0,rise:1,seed:rint(0,999),sway:rnd(0,TAU),hp:1};
    // ③ 街灯(lamp): castleが出ない序盤ステージ(0〜2)でも丸い/縦長のシルエットが混ざるよう追加(軸7=箱型ビルの色違いばかりを解消)
    if(stage<3&&Math.random()<0.2){
      return{x:(i+0.5)*slotW,slot:i,type:"lamp",
        w:slotW*0.3,h:rnd(api.H*sd.hmax*0.7,api.H*sd.hmax*1.05),
        color:pick(BCOL),state:"stand",vx:0,vy:0,rot:0,vr:0,respawnT:0,rise:1,seed:rint(0,999),sway:rnd(0,TAU),hp:1,maxhp:1};
    }
    // ① にじいろビル: ステージ2以降、ときどき(約22分の1)だけ建つ激レア。いつ出るか分からない=ドキドキ発見。
    if(stage>=1&&Math.random()<0.045){
      return{x:(i+0.5)*slotW,slot:i,type:"rainbow",
        w:slotW*0.66,h:rnd(api.H*sd.hmin*1.05,api.H*sd.hmax),
        color:"#ff5da2",state:"stand",vx:0,vy:0,rot:0,vr:0,respawnT:0,rise:1,
        seed:rint(0,999),sway:rnd(0,TAU),hp:1,maxhp:1};
    }
    const golden=Math.random()<0.07;
    const hard=!golden&&Math.random()<sd.hard;
    return{x:(i+0.5)*slotW,slot:i,type:golden?"gold":"building",
      w:slotW*0.66,h:rnd(api.H*sd.hmin,api.H*sd.hmax),
      color:golden?"#f5c518":(hard?"#7f8694":pick(BCOL)),state:"stand",vx:0,vy:0,rot:0,vr:0,respawnT:0,rise:1,
      seed:rint(0,999),sway:rnd(0,TAU),hp:hard?2:1,maxhp:hard?2:1,golden:golden,hard:hard};
  }
  function reset(){objs=[];shards=[];dust=[];arcs=[];floats=[];sparks=[];rings=[];facing=1;sweepT=0;sweeping=false;sweepDir=1;bob=0;count=0;combo=0;comboT=0;flash=0;tNow=0;squash=0;wash=0;washHue=48;blink=0;
    stage=0;stageHits=0;stageGoal=stageGoalFor(0);banner=null;gauge=0;superFlash=0;roar=0;grow=0;finaleT=0;superCD=0;
    luckyColor=pick(BCOL);luckySeen=false;luckyMsgT=0;rbMsgT=0;comboKept=true;sunWink=0;luckyStars=[];
    layout();}
  // ステージクリア演出-次ステージへ
  function nextStage(){
    const last=stage>=STAGE_MAX-1;
    // ③ ノンストップ ボーナス: このステージをコンボ切らさず走り切ったら +5 & みどりのキラキラ祝福。
    // 考えどころ=「テンポよく なぎ続けると 得」。気づかなくてもクリアはできる(操作はそのまま)。
    if(comboKept){count+=5;api.setScore(count);
      floats.push({x:cx,y:groundY-api.H*0.28,txt:"ノンストップ！＋5",life:1,vy:-0.8,col:"#7be08a",size:38,t:0});
      api.tone(1318,0.14,"triangle",0.12);api.tone(1976,0.16,"triangle",0.08);
      for(let k=0;k<18;k++){const a=rnd(0,TAU),sp=rnd(3,8);sparks.push({x:cx,y:groundY-api.H*0.25,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,life:1,decay:rnd(0.02,0.04),hue:rnd(95,150)});}}
    roar=1;api.shake(last?28:18);api.hitStop(8);api.boom(last?0.7:0.5);
    api.slide(180,520,0.5,0.45,"sawtooth");api.tone(660,0.25,"square",0.3);
    // 咆哮ファンファーレ
    api.tone(523,0.16,"triangle",0.25);api.tone(784,0.2,"triangle",0.22);api.tone(1046,0.24,"triangle",0.18);
    if(last){
      finaleT=1;grow=1.0;banner={txt:"ぜんぶ こわした！ キングきょうりゅう！",sub:"もっと あそべるよ！",life:1,t:0,big:true};
      // 全画面紙吹雪を sparks で大量噴出
      for(let k=0;k<60;k++){const a=rnd(0,TAU),sp=rnd(3,12);sparks.push({x:cx,y:groundY-api.H*0.3,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-4,life:1,decay:rnd(0.012,0.025),hue:rnd(0,60)});}
      wash=1;washHue=46;
      stage=0;stageHits=0;stageGoal=stageGoalFor(0); // ループ: もっと長く
    }else{
      stage++;
      grow=Math.min(0.8,(grow||0)+0.16); // ステージごとに恐竜が少しずつ大きく
      stageHits=0;stageGoal=stageGoalFor(stage);
      banner={txt:"ステージ クリア！",sub:"つぎは「"+stageDef().name+"」",life:1,t:0,big:false};
      wash=1;washHue=stage>=3?28:48;
    }
    comboKept=true; // 次ステージのノンストップ判定をリセット
    // 一斉建て替え: 全部 gone にしてすぐ rise させる
    objs.forEach(o=>{o.state="gone";o.respawnT=rnd(8,28);});
    layout(); // 背景空色を更新
  }
  function doSweep(dir){
    if(sweeping)return;
    facing=dir;sweeping=true;sweepHit=false;sweepT=0;sweepDir=dir;
    api.slide(260,90,0.3,0.4,"sawtooth");api.noise(0.18,0.3,700,"lowpass");
  }
  function smash(o,extraStrong){
    o.state="fly";o.fy=0;
    const isTree=o.type==="tree",isCastle=o.type==="castle";
    if(isTree){
      // 木は吹っ飛ばず、力を弱めて横に倒れる(軸7=壊れ方のバラエティ)
      o.vx=sweepDir*rnd(2,4);o.vy=-rnd(0.4,1.6);o.vr=sweepDir*rnd(0.35,0.6);
    }else{
      o.vx=sweepDir*rnd(6,13);o.vy=-rnd(4,9);o.vr=sweepDir*rnd(0.2,0.5);
    }
    const gold=o.type==="gold";
    const rainbow=o.type==="rainbow";
    // ② きょうのラッキー色: 今日の秘密の色のビルを なぎ倒すと +1 の隠しボーナス＋頭上に星のキラッ。気づくと得する。
    const isLucky=o.type==="building"&&o.color===luckyColor;
    let gain=rainbow?8:(gold?5:1);
    if(isLucky){gain+=1;luckyStars.push({x:o.x,y:groundY-o.h-14,life:1});
      api.tone(1046,0.1,"triangle",0.12);api.tone(1568,0.12,"triangle",0.08);
      if(!luckySeen){luckySeen=true;luckyMsgT=1.8;}}   // 初回だけ中央に「きょうのラッキー色は◯！」
    count+=gain;combo++;comboT=0.9;stageHits++;
    if(rainbow)rainbowFx(o);
    const sn=gold?rint(10,15):rint(5,8);
    // お城は瓦礫(shard/dust)の消えるスピードを遅くして、崩れた跡を少し長く残す(軸7=壊れ方のバラエティ)
    const shardDecay=isCastle?[0.004,0.007]:[0.008,0.014];
    for(let k=sn;k>0;k--)shards.push({x:o.x+rnd(-o.w/2,o.w/2),y:groundY-rnd(0,o.h),vx:sweepDir*rnd(2,9),vy:rnd(-9,-2),s:rnd(o.w*0.1,o.w*0.22),color:o.color,rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(shardDecay[0],shardDecay[1])});
    for(let k=(gold?rint(12,18):rint(4,7));k>0;k--){const a=rnd(0,TAU),sp=rnd(2,7);sparks.push({x:o.x,y:groundY-o.h*0.6,vx:Math.cos(a)*sp+sweepDir*2,vy:Math.sin(a)*sp-2,life:1,decay:rnd(0.03,0.06),hue:gold?rnd(44,52):rnd(38,54)});}
    rings.push({x:o.x,y:groundY-o.h*0.4,r:o.w*0.3,life:1});
    dust.push({x:o.x,y:groundY,r:rnd(slotW*0.3,slotW*0.5),vr:rnd(1,2),vx:sweepDir*rnd(1,3),life:1,decay:isCastle?0.01:0.02});
    if(superCD<=0)gauge=clamp(gauge+(gold?0.22:0.07),0,1); // クールダウン中はゲージを溜めない(連発の準白飛び防止)
    if(gold){floats.push({x:o.x,y:groundY-o.h-12,txt:"+5 きん！",life:1,vy:-1.3,col:"#ffd23f",size:40,t:0});api.tone(880,0.12,"triangle",0.3);api.tone(1320,0.14,"triangle",0.22);api.boom(0.5);}
  }
  // ① にじいろビル 撃破: 虹のキラキラ大放出＋発見バナー(激レアの爽快ごほうび)。
  // wash/flash は既存の減衰で必ず消えるので白飛びしない。加算は各パーティクルの life で短く消える。
  function rainbowFx(o){
    rbMsgT=1.4;wash=1;washHue=(tNow*3)%360;
    api.boom(0.6);api.shake(16);
    api.slide(660,1320,0.4,0.22,"triangle");api.tone(880,0.12,"triangle",0.16);api.tone(1320,0.14,"triangle",0.12);api.tone(1760,0.16,"triangle",0.09);
    floats.push({x:o.x,y:groundY-o.h-16,txt:"+8 にじいろ！",life:1,vy:-1.1,col:"#ff5da2",size:40,t:0});
    rings.push({x:o.x,y:groundY-o.h*0.5,r:o.w*0.3,life:1});
    for(let k=0;k<34;k++){const a=rnd(0,TAU),sp=rnd(3,11);
      sparks.push({x:o.x,y:groundY-o.h*0.55,vx:Math.cos(a)*sp+sweepDir*2,vy:Math.sin(a)*sp-3,life:1,decay:rnd(0.014,0.028),hue:(k*45)%360});}
  }
  function applyHits(){
    // reach/背面判定を縮小: 以前は片側の大半(4〜5棟)がまとめて壊れていたのを、狙った側の2〜3棟だけに絞る(軸3対策)
    const reach=slotW*2.4;let hit=0,contact=false;
    arcs.push({dir:sweepDir,life:1});
    for(const o of objs){if(o.state!=="stand")continue;
      const rel=(o.x-cx)*sweepDir;
      if(rel>-slotW*0.3&&rel<reach){
        contact=true;
        // 硬いビル/お城は複数回ヒット
        if((o.hp||1)>1){o.hp--;o.flash=1;combo++;comboT=0.9;
          for(let k=rint(3,5);k>0;k--){const a=rnd(0,TAU),sp=rnd(2,6);sparks.push({x:o.x,y:groundY-o.h*0.6,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,life:1,decay:rnd(0.04,0.07),hue:rnd(0,40)});}
          rings.push({x:o.x,y:groundY-o.h*0.4,r:o.w*0.25,life:1});
          dust.push({x:o.x,y:groundY,r:rnd(slotW*0.2,slotW*0.35),vr:rnd(1,1.6),vx:0,life:1,decay:0.03});
          api.tone(150,0.08,"square",0.25);
          continue;
        }
        smash(o,false);hit++;
      }
    }
    // 当たった時だけ揺れ/フラッシュ/スクワッシュを発火(空振りと当たりの体感差をはっきりさせる。軸2対策)
    if(contact){api.shake(12);flash=1;squash=1;}
    api.setScore(count);
    if(hit>=2)floats.push({x:cx+sweepDir*slotW*2,y:groundY-api.H*0.2,txt:hit+"なぎ！",life:1,vy:-1.1,
      col:hit>=5?"#ff3b3b":hit>=3?"#ff8c42":"#ffd23f",size:hit>=4?44:32,t:0});
    // climax color-wash on big sweeps（ステージが進むほど派手に）
    const intens=Math.min(stage,2); // 終盤ほど加算が溜まらないよう escalation を弱めにクランプ
    if(hit>=3){wash=1;washHue=hit>=5?0:hit>=4?28:48;api.shake(20+intens*3);api.hitStop(7);api.boom(clamp((hit>=5?0.75:0.55)+intens*0.03,0,0.85));
      for(let k=rint(10,16)+intens*2;k>0;k--){const a=rnd(0,TAU),sp=rnd(4,11);sparks.push({x:cx,y:groundY-api.H*0.12,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,life:1,decay:rnd(0.02,0.04),hue:rnd(washHue,washHue+30)});}}
    // 必殺ゲージ満タンで 超ドラゴンブレス
    if(gauge>=1&&superCD<=0)superBreath();
    // ステージ目標達成で クリア演出
    else if(stageHits>=stageGoal&&!banner)nextStage();
  }
  // 超ドラゴンブレス: 画面全部を一掃
  function superBreath(){
    gauge=0;superCD=120; // 連発防止のクールダウン(このあいだゲージは溜まらない)
    // 同一フレームで白フラッシュ+加算ウォッシュ+超ブレスが重なると準白飛びするため、点火alphaを抑える
    api.shake(30);api.hitStop(9);api.boom(0.8);flash=0.55;wash=0.7;washHue=12;superFlash=0.85;roar=1;
    api.slide(120,900,0.6,0.5,"sawtooth");api.noise(0.35,0.4,500,"lowpass");api.tone(1046,0.2,"triangle",0.3);
    floats.push({x:cx,y:groundY-api.H*0.35,txt:"ちょうドラゴンブレス！！",life:1,vy:-0.7,col:"#ff5a2a",size:46,t:0});
    let n=0;
    for(const o of objs){if(o.state!=="stand")continue;
      sweepDir=o.x<cx?-1:1;o.hp=1;smash(o,true);n++;}
    api.setScore(count);
    for(let k=0;k<50;k++){const a=rnd(0,TAU),sp=rnd(5,14);sparks.push({x:cx,y:groundY-api.H*0.2,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,life:1,decay:rnd(0.015,0.03),hue:rnd(0,50)});}
    if(stageHits>=stageGoal&&!banner)nextStage();
  }
  reset();
  return{
    resize:layout,
    input(px,py,type){if(type!=="down")return;
      // ④ 太陽ひみつタップ: 太陽に触れると ウインク＋金のキラキラがこぼれる(減点なし・なぎ操作はそのまま)
      if(sunHit.r>0&&Math.hypot(px-sunHit.x,py-sunHit.y)<sunHit.r){
        sunWink=1;api.tone(1318,0.1,"triangle",0.1);api.tone(1760,0.12,"triangle",0.08);
        for(let i=0;i<8;i++){const a=rnd(-TAU*0.5,0),sp=rnd(2,6);
          sparks.push({x:sunHit.x,y:sunHit.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,life:1,decay:rnd(0.018,0.03),hue:rnd(44,52)});}}
      doSweep(px<cx?-1:1);}
    ,
    frame(dt,now){
      tNow+=dt;
      blink+=dt;
      // sky (ステージごとに配色変化)
      const sky=stageDef().sky;
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージの空色を薄く重ねて面ごとの雰囲気を変える(1面=昼の町はそのまま)
        if(stage>0){g.save();g.globalAlpha=stage>=3?0.30:0.22;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,sky[0]);tg.addColorStop(0.5,sky[1]);tg.addColorStop(1,sky[2]);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        let grd=g.createLinearGradient(0,0,0,groundY);
        grd.addColorStop(0,sky[0]);grd.addColorStop(0.45,sky[1]);grd.addColorStop(1,sky[2]);
        g.fillStyle=grd;g.fillRect(0,0,api.W,groundY);
      }
      // sun glow
      g.save();const sgx=api.W*0.82,sgy=api.H*0.16;
      let sg=g.createRadialGradient(sgx,sgy,0,sgx,sgy,api.W*0.3);
      sg.addColorStop(0,"rgba(255,250,220,.75)");sg.addColorStop(0.4,"rgba(255,244,200,.25)");sg.addColorStop(1,"rgba(255,244,200,0)");
      g.fillStyle=sg;g.fillRect(0,0,api.W,groundY);
      g.fillStyle="rgba(255,253,235,.9)";g.beginPath();g.arc(sgx,sgy,30,0,TAU);g.fill();g.restore();
      // ④ 太陽ひみつタップ: 叩かれた瞬間だけ ^_^ のウインク顔(発見のごほうび)
      if(sunWink>0){sunWink-=0.018*dt;const sr=30;
        g.save();g.strokeStyle="#d09020";g.lineWidth=Math.max(2,sr*0.13);g.lineCap="round";g.globalAlpha=clamp(sunWink*1.4,0,1);
        g.beginPath();
        g.moveTo(sgx-sr*0.44,sgy-sr*0.02);g.quadraticCurveTo(sgx-sr*0.29,sgy-sr*0.3,sgx-sr*0.14,sgy-sr*0.02);
        g.moveTo(sgx+sr*0.14,sgy-sr*0.02);g.quadraticCurveTo(sgx+sr*0.29,sgy-sr*0.3,sgx+sr*0.44,sgy-sr*0.02);
        g.stroke();
        g.beginPath();g.arc(sgx,sgy+sr*0.14,sr*0.34,0.12*Math.PI,0.88*Math.PI);g.stroke();
        g.restore();g.globalAlpha=1;if(sunWink<0)sunWink=0;}
      // drifting clouds ※画像背景のときは絵に雲があるので描かない
      if(!imgBg) for(const c of clouds){c.x+=c.sp*dt;if(c.x-80*c.s>api.W)c.x=-80*c.s;
        g.save();g.globalAlpha=0.85;g.fillStyle="#ffffff";
        g.beginPath();g.arc(c.x,c.y,24*c.s,0,TAU);g.arc(c.x+30*c.s,c.y+4*c.s,32*c.s,0,TAU);g.arc(c.x+62*c.s,c.y,22*c.s,0,TAU);g.arc(c.x+30*c.s,c.y-12*c.s,24*c.s,0,TAU);g.fill();
        g.globalAlpha=0.35;g.fillStyle="#cfe6f7";g.beginPath();g.arc(c.x+20*c.s,c.y+14*c.s,28*c.s,0,TAU);g.arc(c.x+50*c.s,c.y+12*c.s,24*c.s,0,TAU);g.fill();
        g.restore();}
      g.globalAlpha=1;
      // ambient floating light motes (always-on, soft glow)
      g.save();g.globalCompositeOperation="lighter";
      for(const m of motes){m.ph+=m.sp*0.04*dt;m.y-=m.drift*dt;m.x+=Math.sin(m.ph)*0.4*dt;
        if(m.y<-6){m.y=groundY+6;m.x=rnd(0,api.W);}
        const tw=0.35+0.3*(Math.sin(m.ph)*0.5+0.5);g.globalAlpha=tw;
        g.fillStyle="hsl("+m.hue+",100%,80%)";g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();}
      g.restore();g.globalCompositeOperation="source-over";g.globalAlpha=1;
      if(!imgBg){
        // distant hills
        g.fillStyle="rgba(120,170,110,.45)";g.beginPath();g.moveTo(0,groundY);
        for(let x=0;x<=api.W;x+=40)g.lineTo(x,groundY-api.H*0.06-Math.sin(x*0.012+1.3)*api.H*0.04);
        g.lineTo(api.W,groundY);g.closePath();g.fill();
        // ground (gradient + grass blades)
        let ggr=g.createLinearGradient(0,groundY,0,api.H);
        ggr.addColorStop(0,"#7aa055");ggr.addColorStop(1,"#5a7a3e");
        g.fillStyle=ggr;g.fillRect(0,groundY,api.W,api.H-groundY);
        g.fillStyle="#8cb863";g.fillRect(0,groundY,api.W,6);
        g.fillStyle="rgba(255,255,255,.18)";g.fillRect(0,groundY,api.W,2);
        g.strokeStyle="rgba(74,110,60,.5)";g.lineWidth=2;g.beginPath();
        for(let x=6;x<api.W;x+=18){const sw=Math.sin(x*0.5+tNow*0.04)*2;g.moveTo(x,groundY+5);g.lineTo(x+sw,groundY-5);}
        g.stroke();
      } else {
        // 画像背景: 平坦な丘/地面帯は描かず、物が接地して見える薄い影の帯だけ足す(絵と喧嘩しない)
        let gs=g.createLinearGradient(0,groundY-2,0,groundY+Math.max(1,api.H*0.05));
        gs.addColorStop(0,"rgba(20,40,20,.22)");gs.addColorStop(1,"rgba(20,40,20,0)");
        g.fillStyle=gs;g.fillRect(0,groundY-2,api.W,Math.max(1,api.H*0.05)+2);
      }
      // dust
      for(const d of dust){d.r+=d.vr*dt;d.x+=d.vx*dt;d.y-=0.4*dt;d.life-=d.decay*dt;g.globalAlpha=Math.max(0,d.life)*0.5;
        g.fillStyle="#cdbfa8";g.beginPath();g.arc(d.x,d.y,d.r,0,TAU);g.fill();}
      g.globalAlpha=1;dust=dust.filter(d=>d.life>0);
      // regen + physics
      for(const o of objs){
        if(o.state==="gone"){o.respawnT-=dt;if(o.respawnT<=0){const fr=mkObj(o.slot);o.type=fr.type;o.w=fr.w;o.h=fr.h;o.color=fr.color;o.seed=fr.seed;o.hp=fr.hp;o.maxhp=fr.maxhp||fr.hp;o.golden=fr.golden;o.hard=fr.hard;o.flash=0;
          o.x=(o.slot+0.5)*slotW;o.vx=0;o.vy=0;o.rot=0;o.vr=0;o.fy=0; // 飛ばされた位置から必ずスロットに戻す
          o.state="rise";o.rise=0;}}
        else if(o.state==="rise"){o.rise=Math.min(1,o.rise+0.05*dt);if(o.rise>=1)o.state="stand";}
        else if(o.state==="fly"){o.vy+=0.5*dt;o.x+=o.vx*dt;o.fy=(o.fy||0)+o.vy*dt;o.rot+=o.vr*dt;
          if(groundY-o.h+o.fy>api.H+40||o.x<-o.w*2||o.x>api.W+o.w*2){o.state="gone";o.respawnT=rnd(30,70);o.fy=0;}}
        o.sway+=0.03*dt;
      }
      // draw objects behind dino
      for(const o of objs)drawObj(o);
      // sweep animation
      bob*=Math.pow(0.85,dt);
      squash*=Math.pow(0.82,dt);
      if(sweeping){sweepT+=0.08*dt;if(sweepT>=0.5&&!sweepHit){applyHits();sweepHit=true;bob=8;}
        if(sweepT>=1){sweeping=false;}}
      drawDino();
      // arcs (sweep trail, glowing)
      for(const a of arcs){a.life-=0.06*dt;const al=Math.max(0,a.life);
        g.save();g.globalAlpha=al*0.45;g.strokeStyle="#bfe9ff";g.lineWidth=16;g.lineCap="round";g.shadowColor="#7fd0ff";g.shadowBlur=24;
        g.beginPath();g.arc(cx,groundY-api.H*0.1,slotW*3,a.dir>0?-1.1:Math.PI+0.1,a.dir>0?0.6:Math.PI+1.7,a.dir<0);g.stroke();
        g.globalAlpha=al*0.8;g.strokeStyle="#ffffff";g.lineWidth=5;g.shadowBlur=10;
        g.beginPath();g.arc(cx,groundY-api.H*0.1,slotW*3,a.dir>0?-1.1:Math.PI+0.1,a.dir>0?0.6:Math.PI+1.7,a.dir<0);g.stroke();
        g.restore();}
      g.globalAlpha=1;arcs=arcs.filter(a=>a.life>0);
      // impact rings
      for(const rg of rings){rg.life-=0.05*dt;rg.r+=4*dt;const rl=Math.max(0,rg.life);
        g.save();g.globalAlpha=rl*0.6;g.strokeStyle="#fff7d6";g.lineWidth=3+rl*3;
        g.beginPath();g.arc(rg.x,rg.y,rg.r,0,TAU);g.stroke();g.restore();}
      g.globalAlpha=1;rings=rings.filter(r=>r.life>0);
      // shards
      for(const p of shards){p.vy+=0.5*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
        if(p.y>groundY-2){p.y=groundY-2;p.vy*=-0.4;p.vx*=0.7;if(Math.abs(p.vy)<1.2)p.life-=0.04*dt;}
        p.life-=p.decay*dt;g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        g.fillStyle=p.color;g.fillRect(-p.s/2,-p.s/2,p.s,p.s);
        g.fillStyle="rgba(255,255,255,.35)";g.fillRect(-p.s/2,-p.s/2,p.s*0.4,p.s*0.4);g.restore();}
      shards=shards.filter(p=>p.life>0);
      // sparks (glowing kira-kira)
      g.save();g.globalCompositeOperation="lighter";
      for(const sp of sparks){sp.vy+=0.18*dt;sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.life-=sp.decay*dt;
        const sl=Math.max(0,sp.life);g.globalAlpha=sl;
        g.fillStyle="hsl("+sp.hue+",100%,72%)";
        const r=2+sl*3;g.beginPath();g.arc(sp.x,sp.y,r,0,TAU);g.fill();
        g.globalAlpha=sl*0.6;g.fillStyle="#fff";g.beginPath();g.arc(sp.x,sp.y,r*0.45,0,TAU);g.fill();}
      g.restore();g.globalCompositeOperation="source-over";g.globalAlpha=1;sparks=sparks.filter(s=>s.life>0);
      // ② ラッキー色 命中の目印: なぎ倒したビルの頭上に小さな星がキラッ(気づけるヒント)。加算は短命で消す。
      if(luckyStars.length){g.save();g.globalCompositeOperation="lighter";
        for(const ls of luckyStars){ls.life-=0.03*dt;ls.y-=0.5*dt;
          const a=Math.max(0,ls.life),rr=6+a*4;g.globalAlpha=a;g.fillStyle=luckyColor;
          g.save();g.translate(ls.x,ls.y);g.beginPath();
          for(let i=0;i<8;i++){const an=i/8*TAU-TAU/4,r2=i%2?rr*0.4:rr;g.lineTo(Math.cos(an)*r2,Math.sin(an)*r2);}
          g.closePath();g.fill();
          g.globalAlpha=a*0.9;g.fillStyle="#fffbe6";g.beginPath();g.arc(0,0,rr*0.28,0,TAU);g.fill();g.restore();}
        g.restore();g.globalCompositeOperation="source-over";g.globalAlpha=1;luckyStars=luckyStars.filter(ls=>ls.life>0);}
      // combo decay + floats（③ コンボ切れ=ノンストップ失敗）
      if(combo>0){comboT-=0.016*dt;if(comboT<=0){combo=0;comboKept=false;}}
      // roar/grow decay
      if(roar>0)roar=Math.max(0,roar-0.03*dt);
      if(superCD>0)superCD=Math.max(0,superCD-dt); // 超ブレスのクールダウン消化
      // grow はステージごとの成長段階なので、ここでは減衰させずそのまま維持する
      if(finaleT>0)finaleT=Math.max(0,finaleT-0.006*dt);
      for(const f of floats){f.t=(f.t||0)+dt;f.y+=f.vy*dt;f.life-=0.016*dt;
        const pop=1+Math.max(0,0.4-f.t*0.05);g.save();g.globalAlpha=Math.max(0,f.life);
        g.translate(f.x,f.y);g.scale(pop,pop);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.shadowColor=f.col;g.shadowBlur=18;
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,0,0);
        g.fillStyle=f.col;g.fillText(f.txt,0,0);g.restore();}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // full-screen impact flash
      if(flash>0){flash-=0.08*dt;g.save();g.globalAlpha=Math.max(0,flash)*0.35;
        g.fillStyle="#ffffff";g.fillRect(0,0,api.W,api.H);g.restore();}
      // climax color-wash (big-hit special)
      if(wash>0){wash-=0.045*dt;const wl=Math.max(0,wash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=wl*0.5;
        let wg=g.createRadialGradient(cx,groundY-api.H*0.15,0,cx,groundY-api.H*0.15,api.W*0.75);
        wg.addColorStop(0,"hsla("+washHue+",100%,72%,1)");wg.addColorStop(0.5,"hsla("+(washHue+24)+",100%,60%,.5)");wg.addColorStop(1,"hsla("+washHue+",100%,60%,0)");
        g.fillStyle=wg;g.fillRect(0,0,api.W,api.H);g.restore();g.globalCompositeOperation="source-over";}
      // 超ブレスの全画面フラッシュ（オレンジの息）
      if(superFlash>0){superFlash-=0.04*dt;const sl=Math.max(0,superFlash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=sl*0.55;
        let bg2=g.createLinearGradient(0,groundY,0,0);
        bg2.addColorStop(0,"rgba(255,120,20,.0)");bg2.addColorStop(0.5,"rgba(255,170,40,.9)");bg2.addColorStop(1,"rgba(255,240,120,.0)");
        g.fillStyle=bg2;g.fillRect(0,0,api.W,api.H);g.restore();g.globalCompositeOperation="source-over";}
      // ① にじいろビル！ 発見バナー(虹色に色替わり・中央上=HUD安全帯)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col="hsl("+((tNow*4)%360)+",90%,62%)";
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 38px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText("にじいろビル！",0,0);
        g.fillStyle="#ffffff";g.fillText("にじいろビル！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";g.shadowBlur=0;if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央の小ヒント(初回だけ・下側でクリア文字と重ねない)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.28);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 23px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(COLNAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.4)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyMsgT<0)luckyMsgT=0;}
      // 必殺ゲージ + ステージ進捗HUD
      drawHUD();
      // ステージクリア/フィナーレ バナー
      if(banner)drawBanner(dt);
      // cute rounded hint panel
      drawHint();
    }
  };
  function drawObj(o){
    if(o.state==="gone")return;
    let yo=0,a=1;
    if(o.state==="rise"){yo=(1-o.rise)*o.h;a=ease?ease(o.rise):o.rise;}
    g.save();g.globalAlpha=a;
    if(o.state==="fly"){g.translate(o.x,groundY-o.h*0.5+(o.fy||0));g.rotate(o.rot);g.translate(-o.x,-(groundY-o.h*0.5));}
    // soft ground shadow
    if(o.state!=="fly"){g.save();g.globalAlpha=a*0.18;g.fillStyle="#000";
      g.beginPath();g.ellipse(o.x,groundY+4,o.w*0.55,o.h*0.05+6,0,0,TAU);g.fill();g.restore();}
    if(o.type==="castle"){
      drawCastle(o,yo);
    }else if(o.type==="tree"){
      const swx=Math.sin(o.sway)*o.w*0.04;
      // 画像の木(細長い鉢植え型・不透明部は幅0.6/高さ0.99): 高さ基準の正方形で、鉢の底(0.99)が地面に来るよう配置
      const ts=Math.max(1,Math.max(o.h*1.15,o.w*1.5));
      if(api.drawAsset("tree.png",o.x+swx,groundY+yo-ts*0.49,ts,ts,{center:true,rot:Math.sin(o.sway)*0.03})){
        g.globalAlpha=1;g.restore();return;}
      g.fillStyle="#6a4a2a";g.fillRect(o.x-o.w*0.12,groundY-o.h*0.5+yo,o.w*0.24,o.h*0.5);
      g.fillStyle="#5a3e22";g.fillRect(o.x-o.w*0.12,groundY-o.h*0.5+yo,o.w*0.08,o.h*0.5);
      // foliage with radial shading
      const fx=o.x+swx,fy=groundY-o.h*0.55+yo,fr=o.w*0.5;
      let lg=g.createRadialGradient(fx-fr*0.3,fy-fr*0.3,fr*0.1,fx,fy,fr);
      lg.addColorStop(0,"#6fce78");lg.addColorStop(0.6,o.color);lg.addColorStop(1,"#2c6e38");
      g.fillStyle=lg;g.beginPath();g.arc(fx,fy,fr,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.22)";g.beginPath();g.arc(fx-fr*0.3,fy-fr*0.35,fr*0.28,0,TAU);g.fill();
    }else if(o.type==="rainbow"){
      drawRainbow(o,yo);
    }else if(o.type==="lamp"){
      drawLamp(o,yo);
    }else{
      const x=o.x-o.w/2,y=groundY-o.h+yo;
      g.fillStyle="rgba(0,0,0,.2)";g.fillRect(x+3,y+3,o.w,o.h);
      // body gradient
      let bg=g.createLinearGradient(x,y,x+o.w,y);
      bg.addColorStop(0,shade(o.color,1.18));bg.addColorStop(0.5,o.color);bg.addColorStop(1,shade(o.color,0.78));
      g.fillStyle=bg;g.fillRect(x,y,o.w,o.h);
      // roof highlight
      g.fillStyle="rgba(255,255,255,.25)";g.fillRect(x,y,o.w,3);
      g.fillStyle="rgba(255,255,255,.16)";g.fillRect(x,y,o.w*0.28,o.h);
      const rows=Math.max(1,Math.floor(o.h/20));
      for(let r=0;r<rows;r++)for(let c=0;c<3;c++){const on=(o.seed>>((r*3+c)%16))&1;
        g.fillStyle=on?"rgba(255,236,150,.85)":"rgba(0,0,0,.28)";
        g.fillRect(x+o.w*(0.15+c*0.28),y+8+r*20,o.w*0.16,10);
        if(on){g.fillStyle="rgba(255,255,255,.4)";g.fillRect(x+o.w*(0.15+c*0.28),y+8+r*20,o.w*0.16,3);}}
      // 黄金ビルのキラキラ縁
      if(o.type==="gold"){
        g.save();g.globalCompositeOperation="lighter";
        const gl=0.5+0.5*Math.sin(tNow*0.12+o.seed);g.globalAlpha=0.4+gl*0.4;
        g.strokeStyle="#fff7c0";g.lineWidth=3;g.strokeRect(x,y,o.w,o.h);
        g.fillStyle="rgba(255,255,255,.9)";const stx=x+o.w*0.7,sty=y+o.h*0.3,sr=o.w*0.12*(0.6+gl*0.6);
        g.beginPath();for(let i=0;i<8;i++){const an=i/8*TAU,rr2=i%2?sr*0.4:sr;g.lineTo(stx+Math.cos(an)*rr2,sty+Math.sin(an)*rr2);}g.closePath();g.fill();
        g.restore();g.globalCompositeOperation="source-over";}
      // 硬いビルのヒビ（ダメージ受けたら）
      if(o.hard&&o.hp<o.maxhp){
        g.strokeStyle="rgba(20,20,20,.6)";g.lineWidth=2.5;g.beginPath();
        g.moveTo(x+o.w*0.5,y);g.lineTo(x+o.w*0.4,y+o.h*0.4);g.lineTo(x+o.w*0.55,y+o.h*0.55);g.lineTo(x+o.w*0.45,y+o.h);
        g.moveTo(x+o.w*0.4,y+o.h*0.4);g.lineTo(x+o.w*0.2,y+o.h*0.5);g.stroke();
      }
      // ヒット白フラッシュ
      if(o.flash>0){g.save();g.globalAlpha=o.flash*0.7;g.fillStyle="#fff";g.fillRect(x,y,o.w,o.h);g.restore();o.flash-=0.12;}
    }
    g.globalAlpha=1;g.restore();
  }
  function drawCastle(o,yo){
    const x=o.x-o.w/2,y=groundY-o.h+yo,w=o.w,h=o.h;
    // 画像のお城(不透明部は幅0.75/高さ0.97): 高さ基準で少し縦長に描き(横0.8倍)、隣スロットへのはみ出しを抑える。
    // 壁の底(0.97)が地面に来るよう配置。被弾フラッシュは共通で重ねる
    const imH=Math.max(1,Math.max(h,w*1.5)),imW=Math.max(1,imH*0.8);
    if(api.drawAsset("castle.png",o.x,groundY+yo-imH*0.47,imW,imH,{center:true})){
      if(o.flash>0){g.save();g.globalAlpha=o.flash*0.6;g.fillStyle="#fff";
        g.beginPath();g.ellipse(o.x,groundY+yo-h*0.5,Math.max(0,w*0.75),Math.max(0,h*0.55),0,0,TAU);g.fill();g.restore();o.flash-=0.12;}
      return;}
    g.fillStyle="rgba(0,0,0,.2)";g.fillRect(x+3,y+3,w,h);
    // 本体
    let bg=g.createLinearGradient(x,y,x+w,y);
    bg.addColorStop(0,"#e8e0c8");bg.addColorStop(0.5,"#cfc6b0");bg.addColorStop(1,"#b3aa92");
    g.fillStyle=bg;g.fillRect(x,y+h*0.18,w,h*0.82);
    // 胸壁（凸凹）
    const cn=4,cw=w/cn;
    for(let i=0;i<cn;i++)if(i%2===0)g.fillRect(x+i*cw,y+h*0.1,cw,h*0.12);
    // 左右の塔
    g.fillStyle="#bdb49c";g.fillRect(x-w*0.06,y+h*0.05,w*0.18,h*0.95);g.fillRect(x+w*0.88,y+h*0.05,w*0.18,h*0.95);
    // 塔の三角屋根
    g.fillStyle="#c0392b";
    g.beginPath();g.moveTo(x-w*0.08,y+h*0.05);g.lineTo(x+w*0.03,y-h*0.08);g.lineTo(x+w*0.14,y+h*0.05);g.closePath();g.fill();
    g.beginPath();g.moveTo(x+w*0.86,y+h*0.05);g.lineTo(x+w*0.97,y-h*0.08);g.lineTo(x+w*1.08,y+h*0.05);g.closePath();g.fill();
    // 中央の大屋根
    g.fillStyle="#9b59b6";g.beginPath();g.moveTo(x,y+h*0.18);g.lineTo(x+w*0.5,y-h*0.02);g.lineTo(x+w,y+h*0.18);g.closePath();g.fill();
    // 旗
    g.strokeStyle="#6a4a2a";g.lineWidth=2;g.beginPath();g.moveTo(x+w*0.5,y-h*0.02);g.lineTo(x+w*0.5,y-h*0.16);g.stroke();
    g.fillStyle="#f5c518";g.beginPath();g.moveTo(x+w*0.5,y-h*0.16);g.lineTo(x+w*0.66,y-h*0.12);g.lineTo(x+w*0.5,y-h*0.08);g.closePath();g.fill();
    // 門
    g.fillStyle="#5a3e22";g.beginPath();g.moveTo(x+w*0.38,y+h);g.lineTo(x+w*0.38,y+h*0.55);g.arc(x+w*0.5,y+h*0.55,w*0.12,Math.PI,0);g.lineTo(x+w*0.62,y+h);g.closePath();g.fill();
    g.fillStyle="rgba(255,255,255,.2)";g.fillRect(x,y+h*0.18,w,3);
    // 1回目のなぎでヒビ + 白フラッシュ(お城は2回で崩れる)
    if(o.maxhp&&o.hp<o.maxhp){g.strokeStyle="rgba(20,20,20,.6)";g.lineWidth=2.5;g.beginPath();
      g.moveTo(x+w*0.5,y+h*0.2);g.lineTo(x+w*0.4,y+h*0.5);g.lineTo(x+w*0.55,y+h*0.65);g.lineTo(x+w*0.45,y+h);g.stroke();}
    if(o.flash>0){g.save();g.globalAlpha=o.flash*0.7;g.fillStyle="#fff";g.fillRect(x-w*0.06,y-h*0.1,w*1.12,h*1.1);g.restore();o.flash-=0.12;}
  }
  // ① にじいろビル: 虹色に脈打つビル。rise 中は drawObj の alpha 立ち上がりで「くるぞ!」の予告になる。
  function drawRainbow(o,yo){
    const x=o.x-o.w/2,y=groundY-o.h+yo,w=o.w,h=o.h,base=(tNow*3+o.seed)%360;
    g.fillStyle="rgba(0,0,0,.2)";g.fillRect(x+3,y+3,w,h);
    let bg=g.createLinearGradient(x,y,x,y+h);
    for(let i=0;i<=5;i++)bg.addColorStop(i/5,"hsl("+((base+i*60)%360)+",85%,60%)");
    g.fillStyle=bg;g.fillRect(x,y,w,h);
    g.fillStyle="rgba(255,255,255,.30)";g.fillRect(x,y,w,3);
    // 窓(白くきらめく)
    const rows=Math.max(1,Math.floor(h/20));
    for(let r=0;r<rows;r++)for(let c=0;c<3;c++){
      g.fillStyle="rgba(255,255,255,.6)";g.fillRect(x+w*(0.15+c*0.28),y+8+r*20,w*0.16,10);}
    // 光る縁＋きらめき(加算・毎フレーム消えるので溜まらない)
    g.save();g.globalCompositeOperation="lighter";
    const gl=0.5+0.5*Math.sin(tNow*0.15+o.seed);g.globalAlpha=0.35+gl*0.4;
    g.strokeStyle="#ffffff";g.lineWidth=3;g.strokeRect(x,y,w,h);
    const stx=x+w*0.68,sty=y+h*0.28,sr=w*0.13*(0.6+gl*0.6);g.globalAlpha=0.5+gl*0.4;g.fillStyle="#fff7d6";
    g.beginPath();for(let i=0;i<8;i++){const an=i/8*TAU,rr2=i%2?sr*0.4:sr;g.lineTo(stx+Math.cos(an)*rr2,sty+Math.sin(an)*rr2);}g.closePath();g.fill();
    g.restore();g.globalCompositeOperation="source-over";g.globalAlpha=1;
  }
  // ③ 街灯(lamp): 箱型ビルばかりにならないよう、丸い頭+細長い柱のシルエットを追加(軸7対策)
  function drawLamp(o,yo){
    const x=o.x,topY=groundY-o.h+yo,poleW=Math.max(3,o.w*0.16);
    // pole (縦長)
    g.fillStyle="rgba(0,0,0,.2)";g.fillRect(x-poleW/2+2,topY+o.h*0.16+2,poleW,o.h*0.84);
    let pg=g.createLinearGradient(x-poleW/2,0,x+poleW/2,0);
    pg.addColorStop(0,shade(o.color,0.5));pg.addColorStop(0.5,shade(o.color,0.75));pg.addColorStop(1,shade(o.color,0.45));
    g.fillStyle=pg;g.fillRect(x-poleW/2,topY+o.h*0.16,poleW,o.h*0.84);
    // lamp head (まる)
    const headY=topY+o.h*0.1,headR=Math.max(4,o.w*0.5);
    g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.arc(x+2,headY+2,headR,0,TAU);g.fill();
    let lg=g.createRadialGradient(x-headR*0.3,headY-headR*0.3,Math.max(0,headR*0.1),x,headY,headR);
    lg.addColorStop(0,shade(o.color,1.3));lg.addColorStop(1,shade(o.color,0.8));
    g.fillStyle=lg;g.beginPath();g.arc(x,headY,headR,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.4)";g.beginPath();g.arc(x-headR*0.32,headY-headR*0.32,Math.max(0,headR*0.32),0,TAU);g.fill();
    // ほんのり灯る光(常時・加算で短く)
    g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.25+0.15*Math.sin(tNow*0.1+o.seed);
    g.fillStyle="rgba(255,244,200,.8)";g.beginPath();g.arc(x,headY,Math.max(0,headR*1.5),0,TAU);g.fill();
    g.restore();g.globalCompositeOperation="source-over";
    if(o.flash>0){g.save();g.globalAlpha=o.flash*0.7;g.fillStyle="#fff";g.beginPath();g.arc(x,headY,headR*1.1,0,TAU);g.fill();
      g.fillRect(x-poleW/2,topY+o.h*0.16,poleW,o.h*0.84);g.restore();o.flash-=0.12;}
  }
  function drawHUD(){
    // ステージ表示（上部中央＝engine HUDと衝突しない安全帯）
    g.save();g.font="800 15px 'Hiragino Maru Gothic ProN',system-ui";g.textBaseline="middle";g.textAlign="left";
    const st="ステージ "+(stage+1)+"／"+STAGE_MAX+"  「"+stageDef().name+"」";
    const m=g.measureText(st),tw=(m&&m.width)||120,pw=tw+24,px=api.W/2-pw/2,py=8,ph=28;
    g.fillStyle="rgba(58,142,74,.82)";roundRect(px,py,pw,ph,ph/2);g.fill();
    g.fillStyle="#fffce8";g.fillText(st,px+12,py+ph/2);
    // 進捗バー（中央）
    const prog=clamp(stageHits/stageGoal,0,1);
    const bx=px,by=py+ph+5,bw=pw,bh=8;
    g.fillStyle="rgba(0,0,0,.25)";roundRect(bx,by,bw,bh,bh/2);g.fill();
    g.fillStyle="#ffd23f";roundRect(bx,by,bw*prog,bh,bh/2);g.fill();
    g.restore();
    // 必殺ゲージ（中央・ステージ表示の下）
    g.save();g.textBaseline="middle";
    const gw=clamp(api.W*0.32,120,220),gx=api.W/2-gw/2,gy=py+ph+5+bh+8,gh=20;
    g.fillStyle="rgba(0,0,0,.3)";roundRect(gx,gy,gw,gh,gh/2);g.fill();
    if(gauge>0){
      const full=gauge>=1,pulse=full?0.5+0.5*Math.sin(tNow*0.3):0;
      let gg=g.createLinearGradient(gx,0,gx+gw,0);
      gg.addColorStop(0,"#ff8c42");gg.addColorStop(1,full?"#ff3b3b":"#ffd23f");
      g.fillStyle=gg;roundRect(gx,gy,gw*gauge,gh,gh/2);g.fill();
      if(full){g.save();g.globalCompositeOperation="lighter";g.globalAlpha=pulse*0.6;g.fillStyle="#fff";roundRect(gx,gy,gw,gh,gh/2);g.fill();g.restore();g.globalCompositeOperation="source-over";}
    }
    g.font="800 13px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";g.textAlign="left";
    g.fillStyle="rgba(0,0,0,.4)";g.fillText("ひっさつ",gx+9,gy+gh/2+1);
    g.fillStyle="#fffce8";g.fillText("ひっさつ",gx+8,gy+gh/2);
    g.restore();g.textAlign="left";g.textBaseline="alphabetic";
  }
  function drawBanner(dt){
    banner.t+=dt;banner.life-=(banner.big?0.006:0.012)*dt;
    if(banner.life<=0){banner=null;return;}
    const pop=banner.t<10?ease?ease(clamp(banner.t/10,0,1)):clamp(banner.t/10,0,1):1;
    const sc=0.6+pop*0.4,al=Math.max(0,Math.min(1,banner.life*2));
    g.save();g.globalAlpha=al;g.translate(api.W/2,api.H*0.32);
    if(banner.big){g.rotate(Math.sin(banner.t*0.06)*0.03);}
    g.scale(sc,sc);
    g.font="900 "+(banner.big?34:40)+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
    g.shadowColor=banner.big?"#ff5a2a":"#ffd23f";g.shadowBlur=24;
    g.lineWidth=9;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(banner.txt,0,0);
    let tg=g.createLinearGradient(0,-30,0,30);tg.addColorStop(0,"#fff7c0");tg.addColorStop(1,banner.big?"#ffb347":"#ffd23f");
    g.fillStyle=tg;g.fillText(banner.txt,0,0);
    if(banner.sub){g.shadowBlur=8;g.font="800 20px 'Hiragino Maru Gothic ProN',system-ui";
      g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(banner.sub,0,42);
      g.fillStyle="#fffce8";g.fillText(banner.sub,0,42);}
    g.restore();g.textAlign="left";g.textBaseline="alphabetic";
  }
  function shade(hex,f){
    const n=parseInt(hex.slice(1),16);
    let r=clamp(Math.round((n>>16&255)*f),0,255),gg=clamp(Math.round((n>>8&255)*f),0,255),b=clamp(Math.round((n&255)*f),0,255);
    return"rgb("+r+","+gg+","+b+")";
  }
  function drawHint(){
    const txt="ひだり/みぎ タップ！ きょうりゅうが しっぽで なぎはらう！";
    g.save();g.font="800 15px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
    const m=g.measureText(txt),tw=(m&&m.width)||txt.length*8,pw=tw+34,ph=34,px=api.W/2-pw/2,py=api.H-ph-8;
    const bobY=Math.sin(tNow*0.06)*2;
    g.translate(0,bobY);
    g.shadowColor="rgba(0,0,0,.28)";g.shadowBlur=10;g.shadowOffsetY=3;
    g.fillStyle="rgba(58,142,74,.86)";roundRect(px,py,pw,ph,ph/2);g.fill();
    g.shadowColor="transparent";g.shadowBlur=0;g.shadowOffsetY=0;
    g.lineWidth=2.5;g.strokeStyle="rgba(255,255,255,.85)";roundRect(px+1.5,py+1.5,pw-3,ph-3,(ph-3)/2);g.stroke();
    g.fillStyle="rgba(255,255,255,.16)";roundRect(px+5,py+4,pw-10,ph*0.4,ph*0.2);g.fill();
    g.fillStyle="rgba(0,0,0,.3)";g.fillText(txt,api.W/2+1,py+ph/2+1.5);
    g.fillStyle="#fffce8";g.fillText(txt,api.W/2,py+ph/2);
    g.restore();g.textAlign="left";g.textBaseline="alphabetic";
  }
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function drawDino(){
    const s=clamp(api.W*0.16,90,200)*(1+(grow||0)*0.35+(roar||0)*0.06);
    // idle breathing/sway when not sweeping
    const breathe=sweeping?0:Math.sin(tNow*0.07)*0.022;
    const idleBob=sweeping?0:Math.sin(tNow*0.07+1)*3;
    const by=groundY+bob+idleBob;
    // squash & stretch on impact (+gentle idle breath)
    const sq=(1-squash*0.12)*(1-breathe),st=(1+squash*0.14)*(1+breathe*0.6);
    const lean=sweeping?0:Math.sin(tNow*0.035)*0.018;
    g.save();g.translate(cx,by);g.rotate(lean*facing);g.scale(facing*st,sq);
    // soft body shadow on ground
    g.save();g.globalAlpha=0.2;g.fillStyle="#000";g.beginPath();g.ellipse(0,2,s*0.6,s*0.1,0,0,TAU);g.fill();g.restore();
    // 画像の恐竜(生成物は左向き・全身。不透明部: 横ほぼ全幅、足の底は高さ0.87)。flip:true で右向きにし、
    // 向きは既に g.scale(facing,..) で反転済み。足の底が地面(y=0)に来るよう中心を -0.37ds に置く。
    // なぎ中はしっぽの残光をふわっと重ね、咆哮の息と王冠は手描きのまま口/頭の位置に重ねる。
    const ds=s*1.95,dimgReady=!!api.asset("dino.png").ready;
    if(dimgReady&&sweeping){g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.35*Math.sin(clamp(sweepT,0,1)*Math.PI);
      const tg0=g.createRadialGradient(-s*0.8,-s*0.8,0,-s*0.8,-s*0.8,Math.max(0,s*0.7));
      tg0.addColorStop(0,"rgba(123,210,138,.9)");tg0.addColorStop(1,"rgba(123,210,138,0)");
      g.fillStyle=tg0;g.beginPath();g.arc(-s*0.8,-s*0.8,Math.max(0,s*0.7),0,TAU);g.fill();g.restore();g.globalCompositeOperation="source-over";}
    if(dimgReady&&api.drawAsset("dino.png",0,-ds*0.37,ds,ds,{center:true,flip:true})){
      if(roar>0){const rr=roar;
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=rr*0.8;
        let rg=g.createRadialGradient(s*0.85,-s*0.62,0,s*0.85,-s*0.62,Math.max(0,s*0.5*rr));
        rg.addColorStop(0,"rgba(255,240,180,.9)");rg.addColorStop(0.5,"rgba(255,150,40,.5)");rg.addColorStop(1,"rgba(255,120,20,0)");
        g.fillStyle=rg;g.beginPath();g.arc(s*0.85,-s*0.62,Math.max(0,s*0.5*rr),0,TAU);g.fill();g.restore();g.globalCompositeOperation="source-over";}
      if((grow||0)>=0.6){
        g.fillStyle="#ffd23f";const cyx=s*0.58,cyy=-s*1.46;
        g.beginPath();g.moveTo(cyx-s*0.16,cyy);g.lineTo(cyx-s*0.16,cyy-s*0.1);g.lineTo(cyx-s*0.08,cyy-s*0.02);g.lineTo(cyx,cyy-s*0.13);g.lineTo(cyx+s*0.08,cyy-s*0.02);g.lineTo(cyx+s*0.16,cyy-s*0.1);g.lineTo(cyx+s*0.16,cyy);g.closePath();g.fill();
        g.fillStyle="#ff5a8a";g.beginPath();g.arc(cyx,cyy-s*0.05,s*0.025,0,TAU);g.fill();}
      g.restore();return;
    }
    // tail (swings during sweep) with motion glow
    let tailA=-0.3;
    if(sweeping){tailA=lerp(-1.0,1.4,ease?ease(clamp(sweepT,0,1)):clamp(sweepT,0,1));}
    g.save();g.translate(-s*0.5,-s*0.45);g.rotate(tailA);
    if(sweeping){g.save();g.globalAlpha=0.4;g.shadowColor="#7bd28a";g.shadowBlur=20;}
    let tg=g.createLinearGradient(-s*1.05,0,0,0);
    tg.addColorStop(0,"#3a8e4a");tg.addColorStop(1,"#5cb068");
    g.fillStyle=tg;
    g.beginPath();g.moveTo(0,-s*0.18);g.quadraticCurveTo(-s*0.8,-s*0.1,-s*1.05,s*0.05);g.quadraticCurveTo(-s*0.8,s*0.05,0,s*0.18);g.closePath();g.fill();
    if(sweeping)g.restore();
    g.restore();
    // legs
    g.fillStyle="#3a8e4a";
    g.fillRect(-s*0.28,-s*0.35,s*0.18,s*0.42);g.fillRect(s*0.05,-s*0.35,s*0.18,s*0.42);
    g.fillStyle="#2e7a3e";g.fillRect(-s*0.3,-s*0.02,s*0.24,s*0.1);g.fillRect(s*0.03,-s*0.02,s*0.24,s*0.1);
    // body with radial shading
    let bgr=g.createRadialGradient(-s*0.2,-s*0.7,s*0.05,-s*0.05,-s*0.55,s*0.55);
    bgr.addColorStop(0,"#6fc578");bgr.addColorStop(0.7,"#4a9e54");bgr.addColorStop(1,"#3a8244");
    g.fillStyle=bgr;g.beginPath();g.ellipse(-s*0.05,-s*0.55,s*0.5,s*0.4,0,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.16)";g.beginPath();g.ellipse(-s*0.15,-s*0.7,s*0.25,s*0.16,0,0,TAU);g.fill();
    // belly
    g.fillStyle="#7bd28a";g.beginPath();g.ellipse(-s*0.0,-s*0.42,s*0.3,s*0.22,0,0,TAU);g.fill();
    // neck + head
    g.fillStyle="#4a9e54";
    g.beginPath();g.moveTo(s*0.2,-s*0.7);g.quadraticCurveTo(s*0.5,-s*1.0,s*0.55,-s*1.15);g.lineTo(s*0.4,-s*1.15);g.quadraticCurveTo(s*0.3,-s*0.9,s*0.1,-s*0.7);g.closePath();g.fill();
    let hgr=g.createRadialGradient(s*0.48,-s*1.26,s*0.04,s*0.55,-s*1.18,s*0.28);
    hgr.addColorStop(0,"#6fc578");hgr.addColorStop(1,"#4a9e54");
    g.fillStyle=hgr;g.beginPath();g.ellipse(s*0.55,-s*1.18,s*0.26,s*0.2,0,0,TAU);g.fill();
    // snout
    g.fillStyle="#4a9e54";
    g.beginPath();g.moveTo(s*0.7,-s*1.22);g.quadraticCurveTo(s*0.95,-s*1.2,s*0.92,-s*1.08);g.lineTo(s*0.62,-s*1.08);g.closePath();g.fill();
    // nostril
    g.fillStyle="#2e7a3e";g.beginPath();g.arc(s*0.86,-s*1.14,s*0.02,0,TAU);g.fill();
    // eye with shine (blinks occasionally)
    const bp=(blink*0.02)%6.0,blinking=bp<0.18;
    if(blinking){g.strokeStyle="#1a1a1a";g.lineWidth=s*0.025;g.lineCap="round";
      g.beginPath();g.moveTo(s*0.53,-s*1.24);g.lineTo(s*0.67,-s*1.24);g.stroke();
    }else{
      g.fillStyle="#fff";g.beginPath();g.arc(s*0.6,-s*1.24,s*0.07,0,TAU);g.fill();
      g.fillStyle="#1a1a1a";g.beginPath();g.arc(s*0.62,-s*1.24,s*0.035,0,TAU);g.fill();
      g.fillStyle="#fff";g.beginPath();g.arc(s*0.605,-s*1.255,s*0.015,0,TAU);g.fill();}
    // 咆哮: 口が開いて光の息
    if(roar>0){const rr=roar;
      g.fillStyle="#7a1f1f";g.beginPath();g.ellipse(s*0.8,-s*1.1,s*0.12*rr+s*0.04,s*0.09*rr+s*0.03,0,0,TAU);g.fill();
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=rr*0.8;
      let rg=g.createRadialGradient(s*0.95,-s*1.12,0,s*0.95,-s*1.12,s*0.5*rr);
      rg.addColorStop(0,"rgba(255,240,180,.9)");rg.addColorStop(0.5,"rgba(255,150,40,.5)");rg.addColorStop(1,"rgba(255,120,20,0)");
      g.fillStyle=rg;g.beginPath();g.arc(s*1.0,-s*1.12,s*0.5*rr,0,TAU);g.fill();g.restore();g.globalCompositeOperation="source-over";}
    // キング: 王冠（grow が大きいとき=おしろステージ以降のご褒美）
    if((grow||0)>=0.6){
      g.fillStyle="#ffd23f";const cyx=s*0.55,cyy=-s*1.42;
      g.beginPath();g.moveTo(cyx-s*0.16,cyy);g.lineTo(cyx-s*0.16,cyy-s*0.1);g.lineTo(cyx-s*0.08,cyy-s*0.02);g.lineTo(cyx,cyy-s*0.13);g.lineTo(cyx+s*0.08,cyy-s*0.02);g.lineTo(cyx+s*0.16,cyy-s*0.1);g.lineTo(cyx+s*0.16,cyy);g.closePath();g.fill();
      g.fillStyle="#ff5a8a";g.beginPath();g.arc(cyx,cyy-s*0.05,s*0.025,0,TAU);g.fill();}
    // back spikes (with highlight)
    for(let i=0;i<4;i++){const sx=-s*0.45+i*s*0.22;
      g.fillStyle="#2e7a3e";g.beginPath();g.moveTo(sx,-s*0.9);g.lineTo(sx+s*0.08,-s*1.05);g.lineTo(sx+s*0.16,-s*0.9);g.closePath();g.fill();
      g.fillStyle="rgba(255,255,255,.2)";g.beginPath();g.moveTo(sx+s*0.06,-s*0.92);g.lineTo(sx+s*0.08,-s*1.05);g.lineTo(sx+s*0.1,-s*0.92);g.closePath();g.fill();}
    g.restore();
  }
}
Engine.register("dino", buildDino);
