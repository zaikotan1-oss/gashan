function buildRobot(api){
  const g=api.g;
  api.preload(["bg.jpg","robot.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。足(foot)は生成不良のため手描きのまま
  let imgRobot=false,robotImgS=0;        // 今フレーム、画像ロボを描いたか / その描画サイズ(踏み足の付け根を絵の腰に合わせる)
  let hsCD=0;      // hitStop cooldown (節目限定・30f以上あける)
  function tryHitStop(f){if(hsCD<=0){api.hitStop(f);hsCD=32;}}
  let builds=[],feet=[],waves=[],dust=[],shards=[],floats=[],sparks=[],flash=0,timeT=0;
  let groundY,slotW,hipX,hipY,bodyBob,count,combo,comboT,comboMax;
  let scoreShown=0,comboBar=0,hudPop=0,colorWash=0,washHue="#ffd23f",clouds=[];
  // --- stage / progression state ---
  let stage,stageNeed,stageDone,stageBanner,stageBannerT,finale,finaleT;
  let rampage,rampageT,rampagePulse;
  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマー/トラックと同じ思想) ----
  let luckyColor,luckySeen,luckyMsgT;   // ② きょうのラッキー色: 秘密の1色。その色のビルを踏むと隠しボーナス
  let rbMsgT;                           // ① にじいろビル 発見バナー
  let comboKept,nonstopT;               // ③ ノンストップ判定: このステージでコンボを切らさずクリア
  let shooter=null,shootCD=0,shootMsgT=0;// ④ ながれ星ひみつタップ
  const STAGES=5;
  // each stage tweaks palette + difficulty; final loops back but keeps top difficulty
  const SKY=[
    ["#2c3e6b","#5a72a3","#e8a98c"], // 1 dusk
    ["#3b2a5e","#7a5aa0","#ffb27a"], // 2 violet
    ["#102a4a","#2e6a8e","#f0a55c"], // 3 ocean
    ["#3a1530","#8a2f55","#ff9a5a"], // 4 sunset red
    ["#0c1230","#243a7a","#b56cff"]  // 5 night neon
  ];
  function curSky(){return SKY[(stage-1)%SKY.length];}
  const COLORS=["#e0563a","#3a8ee6","#f5c518","#43b97f","#ff8c42","#9b6bff","#e85d9a"];
  const COLNAME={"#e0563a":"あか","#3a8ee6":"あお","#f5c518":"きいろ","#43b97f":"みどり","#ff8c42":"オレンジ","#9b6bff":"むらさき","#e85d9a":"ピンク"};
  function shade(hex,amt){
    const n=parseInt(hex.slice(1),16);let r=(n>>16)&255,gg=(n>>8)&255,b=n&255;
    r=clamp(Math.round(r+255*amt),0,255);gg=clamp(Math.round(gg+255*amt),0,255);b=clamp(Math.round(b+255*amt),0,255);
    return"rgb("+r+","+gg+","+b+")";
  }
  function layout(){
    groundY=api.H*0.84;
    // later stages pack in MORE, slightly thinner buildings
    const extra=Math.min(stage?stage-1:0,4);
    const n=clamp(Math.round(api.W/110)+extra,5,11);
    slotW=api.W/n;
    hipX=api.W/2;hipY=api.H*0.34;
    if(!builds.length){for(let i=0;i<n;i++)builds.push(mkBuild(i));}
    else builds.forEach((b,i)=>{b.x=(i+0.5)*slotW;});
  }
  function mkBuild(i){
    // taller range as stages climb
    const s=stage||1,grow=1+(s-1)*0.12;
    let type="normal",hp=1,w=slotW*0.74,h=rnd(api.H*0.1,api.H*0.26*grow);
    // special building types appear from stage 2; rarer = juicier
    const r=Math.random();
    if(s>=2&&r<0.035){type="rainbow";}        // ① 激レア にじいろビル: ステージ2以降ときどきだけ。踏むと虹の大盤振る舞い
    else if(r<(s>=2?0.12:0.10)){type="gold";} // high-value sparkler (also in stage 1 for early sparkle)
    else if(s>=2&&r<0.22){type="tough";hp=2;} // needs 2 stomps
    else if(s>=3&&r<0.30){type="chain";}      // tall, triggers chain collapse
    // --- 軸7: 四角いビルの色違いだけにならないよう、形・大きさが違う壊す対象を混ぜる ---
    else if(r<0.36){type="tank";w=slotW*0.5;h=rnd(api.H*0.14,api.H*0.20);}                    // 丸い給水タンク(小さめ・円形)
    else if(r<0.44){type="bus";w=slotW*1.5;h=rnd(api.H*0.07,api.H*0.09);}                     // 横長のバス(低い・幅広)
    else if(r<0.50){type="stack";hp=3;w=slotW*0.62;h=rnd(api.H*0.16,api.H*0.24*grow);}        // 積みコンテナ(3段・上から1段ずつ崩れる)
    else if(r<0.62){type="small";w=slotW*0.35;h=rnd(api.H*0.08,api.H*0.12);}                  // 小さな木箱(小型オブジェクト)
    const color=type==="gold"?"#ffd23f":type==="tank"?"#cfd8e6":pick(COLORS);
    return{x:(i+0.5)*slotW,w,baseH:h,h,color,state:"up",squash:1,respawnT:0,seed:rint(0,999),type,hp};
  }
  function reset(){builds=[];feet=[];waves=[];dust=[];shards=[];floats=[];sparks=[];flash=0;timeT=0;count=0;combo=0;comboT=0;comboMax=0;bodyBob=0;scoreShown=0;comboBar=0;hudPop=0;colorWash=0;clouds=[];
    stage=1;stageDone=0;stageNeed=stageQuota(1);stageBanner="";stageBannerT=0;finale=0;finaleT=0;rampage=0;rampageT=0;rampagePulse=0;
    luckyColor=pick(COLORS);luckySeen=false;luckyMsgT=0;rbMsgT=0;comboKept=true;nonstopT=0;shooter=null;shootCD=rnd(3,6);shootMsgT=0;
    for(let i=0;i<4;i++)clouds.push({x:rnd(0,1),y:rnd(0.08,0.4),s:rnd(0.6,1.3),sp:rnd(0.004,0.012)});layout();}
  function stageQuota(s){return 8+(s-1)*4;} // 8,12,16,20,24 buildings per stage（7〜8歳向けに手応えを増やした）
  function clearStage(){
    // ③ ノンストップ ボーナス: このステージをコンボを切らさずクリアしたら +5 & みどりの祝福。気づくと得する隠し判定。
    if(comboKept){count+=5;api.setScore(count);nonstopT=1.8;
      floats.push({x:api.W/2,y:api.H*0.56,txt:"ノンストップ！＋5",life:1.3,vy:-0.7,col:"#7be08a",size:38,pop:1.7});
      api.tone(1318,0.14,"triangle",0.1);setTimeout(()=>api.tone(1976,0.16,"triangle",0.08),110);}
    comboKept=true;   // 次ステージのノンストップ判定をリセット
    // big payoff: full-screen wash + ファンファーレ, then advance
    const last=stage>=STAGES;
    colorWash=1;washHue=last?"#ff3b6b":"#ffd23f";flash=1;
    api.shake(22);api.boom(0.7);tryHitStop(8);
    api.slide(300,900,0.4,0.16,"sine");api.tone(523,0.12,"triangle",0.16);
    setTimeout(()=>api.tone(659,0.12,"triangle",0.16),120);
    setTimeout(()=>api.tone(784,0.2,"triangle",0.18),240);
    if(last){
      // 最終ステージ突破: 特大全画面祝福
      finale=1;finaleT=0;stageBanner="ぜんぶ こわした！ クリア！";stageBannerT=1.0;
      setTimeout(()=>{api.slide(400,1200,0.5,0.18,"sawtooth");api.boom(0.7);},360);
      // loop on at top difficulty so kids can keep playing
      stage=STAGES;stageDone=0;stageNeed=stageQuota(stage);
    }else{
      stage++;stageDone=0;stageNeed=stageQuota(stage);
      stageBanner="ステージ "+stage+"！";stageBannerT=1.0;
      // rebuild the new (busier) skyline
      builds=[];layout();
    }
  }
  function stomp(b,perfect){
    if(b.state!=="up")return;
    b.state="stomping";
    feet.push({b,tx:b.x,ty:groundY-b.h,y:hipY,state:"down",t:0,perfect:!!perfect});
  }
  function impact(b,perfect,chained){
    // tough buildings need a 2nd stomp: first hit just cracks them
    if(b.type==="tough"&&b.hp>1){
      b.hp--;b.squash=0.78;b.state="up";
      api.slide(200,90,0.18,0.4,"square");api.noise(0.18,0.3,800,"lowpass");
      api.shake(8);bodyBob=6;
      for(let k=rint(4,7);k>0;k--)shards.push({x:b.x+rnd(-b.w/2,b.w/2),y:groundY-b.h*rnd(0.3,1),vx:rnd(-5,5),vy:rnd(-8,-2),s:rnd(b.w*0.06,b.w*0.14),color:"#9aa6b6",rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.01,0.016)});
      floats.push({x:b.x,y:groundY-b.h-16,txt:"カチン！",life:0.8,vy:-1,col:"#cfd8e6",size:24,pop:1.4});
      return;
    }
    // 積みコンテナは上から1段ずつへこんで落ちる(3段→2段→1段→最後で崩壊)。tough(カチン)とは別の壊れ方
    if(b.type==="stack"&&b.hp>1){
      b.hp--;
      const tierH=b.baseH/(b.hp+1);
      b.baseH-=tierH;b.h=b.baseH;b.squash=1;
      api.slide(220,90,0.16,0.35,"square");api.noise(0.16,0.28,700,"lowpass");
      api.shake(8);bodyBob=6;
      // 崩れ落ちる1段分の箱(四角い破片ではなく大きめの箱として落とす=とがった破片と違う壊れ方)
      shards.push({x:b.x+rnd(-b.w*0.25,b.w*0.25),y:groundY-b.h-tierH*0.5,vx:rnd(-2.5,2.5),vy:rnd(-1.5,0.5),s:Math.max(4,b.w*0.55),color:shade(b.color,-0.08*b.hp),rot:0,vr:rnd(-0.12,0.12),life:1,decay:rnd(0.01,0.016)});
      floats.push({x:b.x,y:groundY-b.h-tierH-16,txt:"ガコン！",life:0.8,vy:-1,col:"#cfe6ff",size:24,pop:1.4});
      return;
    }
    b.state="flat";b.squash=0.16;b.respawnT=rnd(50,100);   // 立て直しが少し遅い=空振りしないよう見て狙う(7〜8歳向け)
    // --- scoring: type + perfect multipliers ---
    let gain=1;
    if(b.type==="gold")gain=5;
    else if(b.type==="chain")gain=2;
    else if(b.type==="rainbow")gain=8;   // ① にじいろビル: 一撃で大量得点
    else if(b.type==="stack")gain=3;     // 3段がんばった分のボーナス
    if(perfect)gain=Math.round(gain*2.4);   // 軸3: 通常命中とPERFECTの差をはっきりさせる(2倍→2.4倍。整数得点を保つためRound)
    // ② きょうのラッキー色: ふつう/でかビル/れんさビル/バス/木箱が今日の秘密の色なら +1 の隠しボーナス
    const isLucky=(b.type==="normal"||b.type==="tough"||b.type==="chain"||b.type==="small"||b.type==="bus")&&b.color===luckyColor;
    if(isLucky){gain+=1;if(!luckySeen){luckyMsgT=1.8;luckySeen=true;}}  // 初回だけ中央上で教える
    count+=gain;api.setScore(count);
    combo++;comboT=rampage?1.4:0.9;bodyBob=rampage?16:10;hudPop=1;
    if(combo>comboMax)comboMax=combo;
    // --- stage progress ---
    stageDone++;
    if(stageDone>=stageNeed&&!finale){clearStage();}
    // --- rampage(無双) trigger: high combo makes robot huge & multi-stomp ---
    if(combo===8&&!rampage){startRampage();}
    if(combo===3||combo===6||combo>=9&&combo%3===0){colorWash=1;washHue=combo>=9?"#ff3b6b":combo>=6?"#ff8c42":"#ffd23f";api.tone(660,0.18,"triangle",0.16);api.slide(300,700,0.25,0.12,"sine");}
    api.slide(120,38,0.5,0.6,"sine");api.noise(0.45,0.45,500,"lowpass");api.boom(b.type==="chain"?0.7:0.55);
    api.tone(880+Math.min(combo,8)*40,0.08,"square",0.18);
    api.shake(14+Math.min(combo*2,18)+(perfect?6:0));
    if(!chained&&(perfect||b.type!=="normal"||combo%3===0))tryHitStop(5);   // 節目(PERFECT/特別ビル/コンボ3の倍数)だけ止める
    flash=Math.min(1,0.55+combo*0.04);
    waves.push({x:b.x,y:groundY,r:b.w*0.4,max:slotW*2.4,life:1});
    waves.push({x:b.x,y:groundY,r:b.w*0.2,max:slotW*1.6,life:1});
    const burst=perfect?1.6:1,glow=b.type==="gold";
    for(let k=0;k<6;k++)dust.push({x:b.x+rnd(-b.w/2,b.w/2),y:groundY,r:rnd(b.w*0.2,b.w*0.4),vr:rnd(1,2.2),vx:rnd(-3,3),life:1,decay:rnd(0.012,0.02)});
    for(let k=Math.round(rint(6,10)*burst);k>0;k--)shards.push({x:b.x+rnd(-b.w/2,b.w/2),y:groundY-b.h*rnd(0,1),vx:rnd(-7,7),vy:rnd(-11,-3),s:rnd(b.w*0.08,b.w*0.18),color:glow?"#ffe680":(Math.random()<0.5?b.color:"#bfe3ff"),rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.008,0.014)});
    for(let k=Math.round(rint(10,16)*burst);k>0;k--){const a=rnd(0,TAU),sp=rnd(2,7);sparks.push({x:b.x,y:groundY-b.h*0.5,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,life:1,decay:rnd(0.02,0.04),col:glow?"#fff4c2":(Math.random()<0.5?"#fff4c2":b.color),r:rnd(1.5,3.5)});}
    // --- 軸7: type別に壊れ方を変える(丸は転がる/バスは潰れて跳ねる/積みは上で処理済み) ---
    if(b.type==="tank"){
      // 丸い給水タンク: 横に大きく転がって画面外へ消えるイメージ(丸い破片が高速で飛ぶ)
      const dir=Math.random()<0.5?-1:1;
      for(let k=0;k<3;k++)shards.push({x:b.x,y:groundY-b.h*0.4,vx:dir*rnd(9,15),vy:rnd(-6,-2),s:Math.max(4,b.w*rnd(0.3,0.5)),color:b.color,rot:0,vr:dir*rnd(1.2,2.2),shape:"circle",life:1,decay:rnd(0.01,0.018)});
      floats.push({x:b.x,y:groundY-b.h-30,txt:"ゴロゴロ〜！",life:0.9,vy:-1,col:"#cfe6ff",size:22,pop:1.4});
    }else if(b.type==="bus"){
      // バス/トラック: 前後にぺしゃんこに潰れて跳ねる(描画側でバウンド、ここでは低い横破片を撒く)
      b.bounceStart=timeT;
      for(let k=0;k<6;k++)shards.push({x:b.x+rnd(-b.w/2,b.w/2),y:groundY-rnd(2,10),vx:rnd(-9,9),vy:rnd(-5,-1),s:rnd(b.w*0.08,b.w*0.14),color:shade(b.color,-0.15),rot:rnd(0,TAU),vr:rnd(-0.6,0.6),life:1,decay:rnd(0.012,0.02)});
      floats.push({x:b.x,y:groundY-b.h-30,txt:"ベコッ！",life:0.8,vy:-1,col:"#ffd9a0",size:24,pop:1.4});
    }
    if(perfect){
      api.tone(1320,0.1,"square",0.2);api.slide(700,1400,0.18,0.14,"sine");
      floats.push({x:b.x,y:groundY-b.h-44,txt:"PERFECT!",life:1.1,vy:-1.4,col:"#fff04a",size:38,pop:1.8});
    }
    if(b.type==="gold")floats.push({x:b.x,y:groundY-b.h-44,txt:"+"+gain,life:1.1,vy:-1.3,col:"#ffd23f",size:40,pop:1.7});
    // ① にじいろビル 撃破: 虹色の破片＋にじ色のカラーウォッシュ＋大きな祝福バナー(激レアの爽快ごほうび)
    if(b.type==="rainbow"){
      rbMsgT=1.4;colorWash=Math.min(1,colorWash+0.7);washHue="#ff5da2";
      api.boom(0.7);api.shake(18);api.tone(880,0.12,"triangle",0.14);
      setTimeout(()=>api.tone(1320,0.14,"triangle",0.12),90);setTimeout(()=>api.tone(1760,0.16,"triangle",0.1),180);
      const RB=["#ff5da2","#ff8c42","#f5c518","#43b97f","#3a8ee6","#9b6bff"];
      for(let k=Math.round(rint(16,22));k>0;k--){const a=rnd(0,TAU),sp=rnd(3,9);
        sparks.push({x:b.x,y:groundY-b.h*0.6,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,life:1,decay:rnd(0.016,0.03),col:RB[k%RB.length],r:rnd(2,4.5)});}
      for(let k=Math.round(rint(8,12));k>0;k--)shards.push({x:b.x+rnd(-b.w/2,b.w/2),y:groundY-b.h*rnd(0,1),vx:rnd(-8,8),vy:rnd(-12,-3),s:rnd(b.w*0.1,b.w*0.2),color:RB[k%RB.length],rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.008,0.014)});
      waves.push({x:b.x,y:groundY,r:b.w*0.3,max:slotW*3,life:1});
      floats.push({x:b.x,y:groundY-b.h-70,txt:"にじいろ！",life:1.2,vy:-1.1,col:"#ff5da2",size:44,pop:1.9});
    }
    // ② ラッキー色 命中: 頭上に星がキラッ＋小さな祝福(白飛びしないよう控えめ)
    if(isLucky){
      api.tone(1046,0.1,"triangle",0.11);api.tone(1568,0.12,"triangle",0.08);
      const ty=groundY-b.h-24;
      for(let k=0;k<5;k++){const a=-TAU*0.5*rnd(0.2,0.8),sp=rnd(2,5);
        sparks.push({x:b.x,y:ty,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,life:1,decay:rnd(0.02,0.035),col:luckyColor,r:rnd(2,4)});}
      floats.push({x:b.x,y:ty,txt:"ラッキー！",life:1,vy:-1.1,col:luckyColor,size:26,pop:1.5});
    }
    if(combo>1)floats.push({x:b.x,y:groundY-b.h-20,txt:"x"+combo,life:1,vy:-1.2,col:combo>=6?"#ff3b3b":combo>=3?"#ff8c42":"#ffd23f",size:combo>=4?42:30,pop:1.6});
    // --- chain collapse: tall chain-building topples its neighbours ---
    if(b.type==="chain"&&!chained){
      const idx=builds.indexOf(b);
      [idx-1,idx+1].forEach((j,n)=>{const nb=builds[j];if(nb&&nb.state==="up"){setTimeout(()=>{if(nb.state==="up")impact(nb,false,true);},120+n*90);}});
      floats.push({x:b.x,y:groundY-b.h-70,txt:"れんさ！",life:1.1,vy:-1.2,col:"#ff7adb",size:34,pop:1.7});
    }
  }
  function startRampage(){
    rampage=1;rampageT=4.0;rampagePulse=1;
    colorWash=1;washHue="#ff3b6b";api.shake(20);api.boom(0.6);tryHitStop(6);
    api.slide(200,800,0.4,0.18,"sawtooth");api.tone(440,0.2,"square",0.16);
    floats.push({x:api.W/2,y:groundY-api.H*0.32,txt:"むそうモード！",life:1.4,vy:-0.8,col:"#ff3b6b",size:50,pop:2});
  }
  function rampageW(){return rampage?1.5:1;} // robot size multiplier
  reset();
  return{
    resize:layout,
    input(px,py,type){
      if(type!=="down")return;
      // 軸3: 列さえ合えば画面のどこを叩いても勝てないよう、1段目の許容幅をさらに狭め(0.6→0.48)、
      // 2段目のフォールバックの高さ条件も「画面の30%より下ならどこでもOK」という緩すぎる下限をやめ、
      // 建物の実際の縦位置(groundYからその建物の高さ分さかのぼった付近)に連動させて救済範囲を狭める。
      // 低学年向けの取りやすさは残すため、フォールバックは「明らかに空しかない領域だけ弾く」ゆるい下限に留める
      // (ビルの高さぴったりに絞ると、バスのように低いオブジェクトが極端に狙いづらくなってしまう)
      let best=null,bestD=Infinity;
      for(const b of builds){
        if(b.state!=="up")continue;
        const th=Math.max(slotW*0.48,b.w*0.42),vFloor=Math.max(b.h,60);
        const d=Math.abs(b.x-px);
        if(d<th&&d<bestD&&py>groundY-vFloor-40){bestD=d;best=b;}
      }
      if(!best){
        for(const b of builds){
          if(b.state!=="up")continue;
          const th2=Math.max(slotW*0.5,b.w*0.4);
          if(Math.abs(b.x-px)<th2&&py>groundY-Math.max(b.h,60)-60){best=b;break;}
        }
      }
      // ④ ながれ星ひみつタップ: ロボに当たらなかったタップが ながれ星に届いたら 金コインをこぼす(減点なし・ひみつ)
      if(!best&&shooter&&Math.hypot(px-shooter.x,py-shooter.y)<Math.max(52,slotW*0.6)){
        count+=2;api.setScore(count);shootMsgT=1.1;
        api.tone(1318,0.1,"triangle",0.1);setTimeout(()=>api.tone(1760,0.12,"triangle",0.08),80);
        for(let k=0;k<10;k++){const a=rnd(0,TAU),sp=rnd(2,6);
          sparks.push({x:shooter.x,y:shooter.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,life:1,decay:rnd(0.02,0.035),col:k%2?"#ffd23f":"#fff4c2",r:rnd(2,4)});}
        floats.push({x:shooter.x,y:shooter.y-10,txt:"＋2",life:1,vy:-1.2,col:"#ffd23f",size:30,pop:1.6});
        shooter=null;return;
      }
      if(!best)return;
      // PERFECT = tap close to the building's centre
      const perfect=Math.abs(best.x-px)<best.w*0.22;
      stomp(best,perfect);
      // 無双モード: one tap flattens nearby buildings too
      if(rampage){
        const idx=builds.indexOf(best);
        [idx-1,idx+1].forEach((j,n)=>{const nb=builds[j];if(nb&&nb.state==="up")setTimeout(()=>{if(nb.state==="up")stomp(nb,false);},60+n*60);});
      }
    },
    frame(dt,now){
      timeT+=dt*0.016;
      if(hsCD>0)hsCD-=dt;
      // timers: stage banner / finale / rampage
      if(stageBannerT>0)stageBannerT-=0.016*dt;
      if(finale>0){finaleT+=0.016*dt;if(finaleT>3.2)finale=0;}
      if(rampage){rampageT-=0.016*dt;rampagePulse=0.5+0.5*Math.sin(timeT*8);if(rampageT<=0){rampage=0;rampagePulse=0;}}
      // sky (per-stage gradient)
      const sk=curSky();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景(夕暮れの街): ステージのパレット色を薄く重ねて面ごとの雰囲気を変える(1面=夕暮れはそのまま)
        const si=(stage-1)%SKY.length;
        if(si!==0){g.save();g.globalAlpha=0.28;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,sk[0]);tg.addColorStop(0.55,sk[1]);tg.addColorStop(1,sk[2]);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
      let grd=g.createLinearGradient(0,0,0,groundY);
      grd.addColorStop(0,sk[0]);grd.addColorStop(0.5,sk[1]);grd.addColorStop(1,sk[2]);
      g.fillStyle=grd;g.fillRect(0,0,api.W,groundY);
      // soft sun glow
      const sunX=api.W*0.5,sunY=groundY*0.74;
      let sun=g.createRadialGradient(sunX,sunY,0,sunX,sunY,api.W*0.5);
      sun.addColorStop(0,"rgba(255,224,170,.55)");sun.addColorStop(0.4,"rgba(255,180,120,.18)");sun.addColorStop(1,"rgba(255,180,120,0)");
      g.fillStyle=sun;g.fillRect(0,0,api.W,groundY);
      // twinkle stars (upper sky)
      for(let i=0;i<14;i++){const sx=((i*97)%api.W),sy=(i*53)%(groundY*0.4);
        g.globalAlpha=0.3+0.3*(0.5+0.5*Math.sin(timeT*2+i));g.fillStyle="#fff";g.fillRect(sx,sy,2,2);}
      g.globalAlpha=1;
      // drifting clouds (ambient parallax) ※画像背景のときは絵の空を活かして描かない
      for(const c of clouds){c.x+=c.sp*c.s*dt*0.04;if(c.x>1.2)c.x=-0.2;
        const cx=c.x*api.W,cy=c.y*groundY,cs=c.s*api.W*0.06;
        g.globalAlpha=0.16;g.fillStyle="#fff";
        g.beginPath();g.arc(cx,cy,cs,0,TAU);g.arc(cx+cs*1.1,cy+cs*0.2,cs*0.8,0,TAU);g.arc(cx-cs*1.0,cy+cs*0.25,cs*0.7,0,TAU);g.arc(cx+cs*0.3,cy-cs*0.4,cs*0.6,0,TAU);g.fill();}
      g.globalAlpha=1;
      }
      // ④ ながれ星: たまに上空を流れる隠しごほうび。撃つとコイン。(source-over+影で描画=白飛びしない)
      shootCD-=dt*0.016;
      if(!shooter&&shootCD<=0){const fromL=Math.random()<0.5;
        shooter={x:fromL?-40:api.W+40,y:rnd(api.H*0.06,api.H*0.34),vx:(fromL?1:-1)*rnd(3.5,5.5),vy:rnd(0.6,1.4),trail:[]};
        shootCD=rnd(6,11);}
      if(shooter){shooter.x+=shooter.vx*dt;shooter.y+=shooter.vy*dt;
        shooter.trail.push({x:shooter.x,y:shooter.y});if(shooter.trail.length>10)shooter.trail.shift();
        g.save();g.lineCap="round";g.shadowColor="#bfe8ff";g.shadowBlur=12;
        for(let i=1;i<shooter.trail.length;i++){const a=i/shooter.trail.length;
          g.globalAlpha=a*0.7;g.strokeStyle="#dff3ff";g.lineWidth=1+a*3;
          g.beginPath();g.moveTo(shooter.trail[i-1].x,shooter.trail[i-1].y);g.lineTo(shooter.trail[i].x,shooter.trail[i].y);g.stroke();}
        g.globalAlpha=1;g.fillStyle="#ffffff";g.beginPath();g.arc(shooter.x,shooter.y,3.2,0,TAU);g.fill();
        g.restore();g.shadowBlur=0;g.globalAlpha=1;
        if(shooter.x<-60||shooter.x>api.W+60||shooter.y>api.H*0.5)shooter=null;}
      // distant skyline (two layers w/ depth) + ground ※画像背景のときは絵の街並み/地面を活かして描かない
      if(!imgBg){
      const bw=api.W/12;
      g.fillStyle="rgba(48,60,92,.45)";
      for(let i=0;i<13;i++){const hh=([70,120,85,140,95,130,75,125,100,150,90,115,105][i]||90);g.fillRect(i*bw-bw*0.3,groundY-hh*0.7,bw*0.9,hh*0.7);}
      g.fillStyle="rgba(60,80,110,.55)";
      for(let i=0;i<13;i++){const hh=([50,90,60,110,70,100,55,95,75,120,65,85,80][i]||70);g.fillRect(i*bw,groundY-hh*0.5,bw*0.85,hh*0.5);}
      // ground (gradient + light strip)
      let gg=g.createLinearGradient(0,groundY,0,api.H);gg.addColorStop(0,"#6b645c");gg.addColorStop(1,"#43403b");
      g.fillStyle=gg;g.fillRect(0,groundY,api.W,api.H-groundY);
      let edge=g.createLinearGradient(0,groundY,0,groundY+10);edge.addColorStop(0,"#8a8278");edge.addColorStop(1,"#4a4540");
      g.fillStyle=edge;g.fillRect(0,groundY,api.W,10);
      } else {
        // 画像背景: ビルの足元に薄い接地影だけ(地面の帯は絵に任せる)
        g.fillStyle="rgba(0,0,0,.22)";g.fillRect(0,groundY,api.W,4);
      }
      // robot body (behind buildings)
      bodyBob*=Math.pow(0.85,dt);
      drawRobot();
      // regrow / squash
      for(let bi=0;bi<builds.length;bi++){
        const b=builds[bi];
        if(b.state==="flat"){b.respawnT-=dt;if(b.respawnT<=0){
          // 立て直す度に種類/大きさを引き直す(mkBuildを再利用)=同じ形ばかりが並ばず、丸/横長/積み/小型がずっと入れ替わる
          const nb=mkBuild(bi);
          Object.assign(b,nb,{state:"regrow",h:0,squash:1});
        }}
        else if(b.state==="regrow"){b.h=Math.min(b.baseH,b.h+b.baseH*0.06*dt);if(b.h>=b.baseH){b.h=b.baseH;b.state="up";}}
      }
      // buildings
      for(const b of builds)drawBuild(b);
      // feet
      for(const f of feet){
        if(f.state==="down"){f.t+=0.14*dt;f.y=lerp(hipY,f.ty,ease(Math.min(f.t,1)));
          if(f.t>=1){impact(f.b,f.perfect,false);f.state="up";f.t=0;}}
        else{f.t+=0.1*dt;f.y=lerp(f.ty,hipY,ease(Math.min(f.t,1)));}
        drawLegFoot(f);
      }
      feet=feet.filter(f=>!(f.state==="up"&&f.t>=1));
      // waves
      for(const w of waves){w.r+=(w.max-w.r)*0.16*dt;w.life-=0.04*dt;
        g.globalAlpha=Math.max(0,w.life)*0.6;g.strokeStyle="#fff";g.lineWidth=5*Math.max(0,w.life);
        g.shadowColor="rgba(255,255,255,.7)";g.shadowBlur=10;
        g.beginPath();g.ellipse(w.x,w.y,w.r,w.r*0.3,0,0,TAU);g.stroke();}
      g.shadowBlur=0;g.globalAlpha=1;waves=waves.filter(w=>w.life>0);
      // dust
      for(const d of dust){d.r+=d.vr*dt;d.x+=d.vx*dt;d.y-=0.5*dt;d.life-=d.decay*dt;g.globalAlpha=Math.max(0,d.life)*0.55;
        g.fillStyle="#cdbfa8";g.beginPath();g.arc(d.x,d.y,d.r,0,TAU);g.fill();}
      g.globalAlpha=1;dust=dust.filter(d=>d.life>0);
      // shards (丸い破片=タンクが転がるイメージはshape:"circle"で円を描く)
      for(const p of shards){p.vy+=0.55*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
        if(p.y>groundY-2){p.y=groundY-2;p.vy*=-0.4;p.vx*=0.7;if(Math.abs(p.vy)<1.2)p.life-=0.04*dt;}
        p.life-=p.decay*dt;g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        g.fillStyle=p.color;
        if(p.shape==="circle"){g.beginPath();g.arc(0,0,Math.max(0,p.s/2),0,TAU);g.fill();}
        else{g.fillRect(-p.s/2,-p.s/2,p.s,p.s);}
        g.restore();}
      shards=shards.filter(p=>p.life>0);
      // sparks (glowing)
      g.shadowBlur=8;
      for(const s of sparks){s.vy+=0.18*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=s.decay*dt;
        g.globalAlpha=Math.max(0,s.life);g.shadowColor=s.col;g.fillStyle=s.col;
        g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();}
      g.shadowBlur=0;g.globalAlpha=1;sparks=sparks.filter(s=>s.life>0);
      // combo decay + floats
      if(combo>0){comboT-=0.016*dt;if(comboT<=0){combo=0;comboKept=false;}}  // ③ コンボ切れ=ノンストップ失敗
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.016*dt;if(f.pop>1)f.pop+=(1-f.pop)*0.2*dt;
        g.save();g.globalAlpha=Math.max(0,f.life);g.translate(f.x,f.y);g.scale(f.pop,f.pop);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.shadowColor=f.col;g.shadowBlur=14;
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,0,0);g.fillStyle=f.col;g.fillText(f.txt,0,0);
        g.restore();}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // impact flash overlay
      if(flash>0){flash-=0.12*dt;g.globalAlpha=Math.max(0,flash)*0.35;g.fillStyle="#fff";g.fillRect(0,0,api.W,api.H);g.globalAlpha=1;}
      // climax color wash (full-screen, big payoff)
      if(colorWash>0){colorWash-=0.04*dt;const cw=Math.max(0,colorWash);
        let wg=g.createRadialGradient(api.W/2,groundY*0.7,0,api.W/2,groundY*0.7,api.W*0.75);
        wg.addColorStop(0,"rgba(255,255,255,"+(cw*0.5)+")");
        const wn=parseInt(washHue.slice(1),16);
        wg.addColorStop(0.4,"rgba("+((wn>>16)&255)+","+((wn>>8)&255)+","+(wn&255)+","+(cw*0.4)+")");
        wg.addColorStop(1,"rgba("+((wn>>16)&255)+","+((wn>>8)&255)+","+(wn&255)+",0)");
        g.fillStyle=wg;g.fillRect(0,0,api.W,api.H);
        // radial light rays
        g.save();g.globalAlpha=cw*0.25;g.translate(api.W/2,groundY*0.7);g.rotate(timeT*0.4);
        g.fillStyle=washHue;for(let i=0;i<10;i++){g.rotate(TAU/10);g.beginPath();g.moveTo(0,0);g.lineTo(api.W*0.6,-api.W*0.04);g.lineTo(api.W*0.6,api.W*0.04);g.closePath();g.fill();}
        g.restore();g.globalAlpha=1;}
      // --- finale: 最終ステージ突破の特大全画面祝福 ---
      if(finale>0){
        const ph=Math.min(finaleT/0.3,1),fade=finaleT>2.6?Math.max(0,(3.2-finaleT)/0.6):1;
        g.save();g.globalAlpha=fade*0.5;
        let fg=g.createRadialGradient(api.W/2,api.H*0.45,0,api.W/2,api.H*0.45,api.W*0.8);
        fg.addColorStop(0,"rgba(255,240,180,.9)");fg.addColorStop(0.5,"rgba(255,90,150,.45)");fg.addColorStop(1,"rgba(120,80,255,0)");
        g.fillStyle=fg;g.fillRect(0,0,api.W,api.H);g.globalAlpha=1;
        // spinning rays
        g.globalAlpha=fade*0.3;g.translate(api.W/2,api.H*0.45);g.rotate(timeT*0.6);
        for(let i=0;i<14;i++){g.rotate(TAU/14);g.fillStyle=i%2?"#ffd23f":"#ff7adb";g.beginPath();g.moveTo(0,0);g.lineTo(api.W,-api.W*0.03);g.lineTo(api.W,api.W*0.03);g.closePath();g.fill();}
        g.restore();
      }
      // --- stage clear / finale banner text ---
      if(stageBannerT>0&&stageBanner){
        const a=Math.min(stageBannerT*2,1),sc=ease(Math.min((1-stageBannerT)*2.5,1))*0.4+0.8;
        g.save();g.globalAlpha=a;g.translate(api.W/2,api.H*0.4);g.scale(sc,sc);
        g.textAlign="center";g.textBaseline="middle";
        g.font="900 "+clamp(api.W*0.075,30,64)+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="#ff3b6b";g.shadowBlur=24;
        g.lineWidth=9;g.strokeStyle="rgba(0,0,0,.6)";g.strokeText(stageBanner,0,0);
        g.fillStyle="#fff04a";g.fillText(stageBanner,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";
      }
      // ① にじいろビル！ 発見バナー(虹色に色替わり=レアの大きな祝福・中央上=HUD安全帯)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=["#ff5da2","#ff8c42","#f5c518","#43b97f","#3a8ee6","#9b6bff"][Math.floor(timeT*6)%6];
        g.save();g.translate(api.W/2,api.H*0.22);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 38px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("にじいろビル！",0,0);
        g.fillStyle=col;g.fillText("にじいろビル！",0,0);
        g.restore();g.globalAlpha=1;g.shadowBlur=0;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央の小ヒント(初回だけ)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.3);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 23px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(COLNAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ ノンストップ ボーナス！ バナー(ステージクリア文字の下=重ねない)
      if(nonstopT>0){nonstopT-=0.014*dt;
        const pop=1+Math.max(0,nonstopT-1.3)*1.3;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(nonstopT*1.3,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=16;
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("ノンストップ ボーナス！",0,0);
        g.fillStyle="#c7ffcf";g.fillText("ノンストップ ボーナス！",0,0);
        g.restore();g.globalAlpha=1;g.shadowBlur=0;g.textAlign="left";g.textBaseline="alphabetic";if(nonstopT<0)nonstopT=0;}
      // ④ ながれ星ゲット！ 小バナー(中央上・控えめ)
      if(shootMsgT>0){shootMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.15);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(shootMsgT*1.3,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("ながれ星ゲット！",0,0);
        g.fillStyle="#ffe9a8";g.fillText("ながれ星ゲット！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(shootMsgT<0)shootMsgT=0;}
      drawHUD(dt);
    }
  };
  function drawHUD(dt){
    // --- stage progress bar (top) : "ビルを N棟ふみつぶせ！" ---
    {
      const bw=clamp(api.W*0.5,200,360),bh=18,bx=api.W/2-bw/2,by=8;
      const prog=clamp(stageDone/stageNeed,0,1);
      g.save();
      g.fillStyle="rgba(20,16,34,.55)";roundRect(bx,by,bw,bh,bh/2);g.fill();
      const sc=["#ffd23f","#7adcff","#ff8c42","#ff5d8a","#b56cff"][(stage-1)%5];
      g.fillStyle=sc;g.shadowColor=sc;g.shadowBlur=10;roundRect(bx,by,Math.max(bh,bw*prog),bh,bh/2);g.fill();g.shadowBlur=0;
      g.textAlign="center";g.textBaseline="middle";g.font="900 12px 'Hiragino Maru Gothic ProN',system-ui";
      const left=Math.max(0,stageNeed-stageDone);
      const lbl="ステージ"+stage+"  のこり "+left+"棟！";
      g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.6)";g.strokeText(lbl,api.W/2,by+bh/2+1);
      g.fillStyle="#fff";g.fillText(lbl,api.W/2,by+bh/2+1);
      g.restore();
    }
    // --- rampage badge ---
    if(rampage){
      g.save();g.textAlign="center";g.textBaseline="middle";
      g.font="900 20px 'Hiragino Maru Gothic ProN',system-ui";
      g.shadowColor="#ff3b6b";g.shadowBlur=16;
      g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.6)";g.strokeText("むそう！ "+Math.ceil(rampageT),api.W/2,52);
      g.fillStyle="#ffd23f";g.fillText("むそう！ "+Math.ceil(rampageT),api.W/2,52);
      g.restore();
    }
    const target=combo>0?clamp(comboT/0.9,0,1):0;comboBar+=(target-comboBar)*0.25*dt;
    // combo meter (top-center) when active — score lives in the shared HUD
    if(combo>1&&comboBar>0.02){
      const bw=clamp(api.W*0.4,160,300),bh=14,bx=api.W/2-bw/2,by=32;
      g.save();
      g.fillStyle="rgba(40,30,60,.5)";roundRect(bx,by,bw,bh,bh/2);g.fill();
      const col=combo>=9?"#ff3b6b":combo>=6?"#ff8c42":"#ffd23f";
      const fw2=Math.max(bh,bw*comboBar);
      g.fillStyle=col;g.shadowColor=col;g.shadowBlur=10;roundRect(bx,by,fw2,bh,bh/2);g.fill();g.shadowBlur=0;
      g.textAlign="center";g.textBaseline="middle";g.font="900 12px 'Hiragino Maru Gothic ProN',system-ui";
      g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText("れんぞく x"+combo,api.W/2,by+bh/2+1);
      g.fillStyle="#fff";g.fillText("れんぞく x"+combo,api.W/2,by+bh/2+1);
      g.restore();
    }
    // cute hint pill (bottom)
    g.save();
    const hint="ビルを タップ！ ロボが ふみつぶす！";
    g.font="800 17px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
    const tm=g.measureText(hint),tw=(tm&&tm.width)||hint.length*8,hpw=tw+34,hph=32,hpx=api.W/2-hpw/2,hpy=api.H-hph-8;
    const bob=Math.sin(timeT*2)*2;
    g.shadowColor="rgba(0,0,0,.3)";g.shadowBlur=10;g.shadowOffsetY=3;
    g.fillStyle="rgba(60,40,90,.6)";roundRect(hpx,hpy+bob,hpw,hph,hph/2);g.fill();
    g.shadowBlur=0;g.shadowOffsetY=0;
    g.lineWidth=2.5;g.strokeStyle="rgba(255,224,120,.7)";roundRect(hpx+1.5,hpy+bob+1.5,hpw-3,hph-3,hph/2-2);g.stroke();
    g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.4)";g.strokeText(hint,api.W/2,hpy+bob+hph/2+1);
    g.fillStyle="#fff";g.fillText(hint,api.W/2,hpy+bob+hph/2+1);
    g.restore();
    g.textAlign="left";g.textBaseline="alphabetic";
  }
  function drawRobot(){
    const rs=rampage?(1.4+rampagePulse*0.1):1;
    const bw=clamp(api.W*0.26,180,360)*rs,bh=api.H*0.26*rs,bx=hipX-bw/2,by=hipY-bh+bodyBob;
    g.save();
    if(rampage){g.shadowColor="#ff3b6b";g.shadowBlur=24+rampagePulse*16;}
    // 画像ロボ(全身・正面 640x640、絵の中でロボは横幅≈0.76S・腰≈上から0.5S・足裏=最下端)。
    // むそうモード中は赤みに着色した複製を描く。目/胸の光は絵に含まれるので重ねない
    imgRobot=false;
    {
      const rim=api.asset("robot.png");
      const rsrc=rim.ready?(rampage?(api.tinted("robot.png","#ff3b6b",0.3)||rim):rim):null;
      if(rsrc){
        // 高さ基準(bh*1.9)。縦長画面では横幅が画面を埋めすぎないよう幅でも抑える
        const S=Math.max(1,Math.min(bh*1.9,api.W*0.8));
        // 絵の腰(0.5S)が hipY+bh*0.4 に来るよう中央配置 → 足裏は hipY+bh*0.4+S/2(≈画面の0.69H=絵の街の地平線あたり。浮いて見えない)
        api.drawSrc(rsrc,hipX,hipY+bh*0.4+bodyBob,S,S,{center:true});
        imgRobot=true;robotImgS=S;
        g.restore();return;
      }
    }
    // legs base (static thick) drawn lighter behind
    g.strokeStyle="#3a4456";g.lineWidth=bw*0.16;g.lineCap="round";
    g.beginPath();g.moveTo(hipX-bw*0.22,hipY-6);g.lineTo(hipX-bw*0.22,hipY+bh*0.2);g.moveTo(hipX+bw*0.22,hipY-6);g.lineTo(hipX+bw*0.22,hipY+bh*0.2);g.stroke();
    // arms
    g.strokeStyle="#5a6678";g.lineWidth=bw*0.13;
    g.beginPath();g.moveTo(bx,by+bh*0.3);g.lineTo(bx-bw*0.18,by+bh*0.7);g.moveTo(bx+bw,by+bh*0.3);g.lineTo(bx+bw+bw*0.18,by+bh*0.7);g.stroke();
    g.fillStyle="#6a7688";g.beginPath();g.arc(bx-bw*0.18,by+bh*0.72,bw*0.1,0,TAU);g.arc(bx+bw+bw*0.18,by+bh*0.72,bw*0.1,0,TAU);g.fill();
    // body (metal gradient + highlight)
    let bg=g.createLinearGradient(bx,by,bx+bw,by+bh);bg.addColorStop(0,"#838fa1");bg.addColorStop(0.5,"#6a7688");bg.addColorStop(1,"#4f5b6d");
    g.fillStyle=bg;roundRect(bx,by,bw,bh,16);g.fill();
    g.shadowBlur=0;
    g.fillStyle="rgba(255,255,255,.16)";roundRect(bx+bw*0.06,by+bh*0.05,bw*0.3,bh*0.85,10);g.fill();
    g.fillStyle="#4a5566";roundRect(bx+bw*0.12,by+bh*0.5,bw*0.76,bh*0.42,10);g.fill();
    // bolts
    g.fillStyle="#3a4456";for(const bp of[[0.08,0.08],[0.92,0.08],[0.08,0.92],[0.92,0.92]]){g.beginPath();g.arc(bx+bw*bp[0],by+bh*bp[1],3,0,TAU);g.fill();}
    // head
    const hw=bw*0.5,hh=bh*0.34,hx=hipX-hw/2,hy=by-hh*0.8;
    let hg=g.createLinearGradient(hx,hy,hx,hy+hh);hg.addColorStop(0,"#929eb0");hg.addColorStop(1,"#6a7688");
    g.fillStyle=hg;roundRect(hx,hy,hw,hh,10);g.fill();
    // eyes (glowing)
    const eyePulse=0.5+0.5*Math.sin(timeT*4);
    g.shadowColor="#ff5555";g.shadowBlur=12+eyePulse*8;
    g.fillStyle="rgba(255,120,120,.5)";g.beginPath();g.arc(hx+hw*0.32,hy+hh*0.5,hw*0.18,0,TAU);g.arc(hx+hw*0.68,hy+hh*0.5,hw*0.18,0,TAU);g.fill();
    g.fillStyle="#ff4040";g.beginPath();g.arc(hx+hw*0.32,hy+hh*0.5,hw*0.1,0,TAU);g.arc(hx+hw*0.68,hy+hh*0.5,hw*0.1,0,TAU);g.fill();
    g.shadowBlur=0;
    g.fillStyle="#fff";g.beginPath();g.arc(hx+hw*0.30,hy+hh*0.44,hw*0.035,0,TAU);g.arc(hx+hw*0.66,hy+hh*0.44,hw*0.035,0,TAU);g.fill();
    // antenna
    g.strokeStyle="#444";g.lineWidth=4;g.beginPath();g.moveTo(hipX,hy);g.lineTo(hipX,hy-hh*0.4);g.stroke();
    g.shadowColor="#ffd23f";g.shadowBlur=10+eyePulse*10;
    g.fillStyle="#ffe680";g.beginPath();g.arc(hipX,hy-hh*0.45,5+eyePulse*1.5,0,TAU);g.fill();
    // chest light (glow)
    g.fillStyle="#ffd23f";g.shadowColor="#ffd23f";g.shadowBlur=14;
    g.beginPath();g.arc(hipX,by+bh*0.3,bw*0.07,0,TAU);g.fill();
    g.shadowBlur=0;
    g.restore();
  }
  function drawLegFoot(f){
    // leg from hip to foot (画像ロボのときは絵の腰の位置・幅に付け根を合わせる)
    const rs=rampage?(1.4+rampagePulse*0.1):1,bhR=api.H*0.26*rs;
    const hx0=imgRobot?hipX+(f.tx>hipX?1:-1)*robotImgS*0.09:hipX+(f.tx>hipX?40:-40);
    const hy0=imgRobot?hipY+bhR*0.4+bodyBob:hipY+10;
    g.strokeStyle="#4a5568";g.lineWidth=clamp(api.W*0.05,18,40);g.lineCap="round";
    g.beginPath();g.moveTo(hx0,hy0);g.lineTo(f.tx,f.y);g.stroke();
    // foot (bigger during 無双モード) ※画像ブーツは生成不良(丸ごとロボが出る)のため手描きのまま
    const fw=clamp(slotW*0.9,60,140)*(rampage?1.4:1),fh=fw*0.4;
    g.fillStyle="#3a4456";roundRect(f.tx-fw/2,f.y,fw,fh,8);g.fill();
    g.fillStyle="#586474";roundRect(f.tx-fw/2,f.y,fw,fh*0.4,8);g.fill();
    g.fillStyle="#2c3340";for(let i=0;i<3;i++)g.fillRect(f.tx-fw*0.36+i*fw*0.28,f.y+fh*0.55,fw*0.16,fh*0.3);
  }
  function drawBuild(b){
    // バス(前後に潰れて跳ねる)は「壊れた後もしばらく描画時にバウンドさせる」ため、squashを描画専用に上書きする
    let squashDraw=b.squash;
    if(b.type==="bus"&&b.state==="flat"){
      const t=Math.max(0,timeT-(b.bounceStart||0));
      const bounce=Math.exp(-t*3.5)*Math.abs(Math.sin(t*16));
      squashDraw=clamp(0.16+bounce*0.6,0.05,1);
    }
    const w=b.w,h=b.h*squashDraw,x=b.x-w/2,y=groundY-h;
    if(h<2){ // rubble
      g.fillStyle="#7a6a5a";g.fillRect(x,groundY-6,w,6);return;
    }
    // --- 軸7: 型ごとに形の違う本体を描く(四角ばかりにしない) ---
    if(b.type==="tank"){drawTankBody(b,x,y,w,h);}
    else if(b.type==="bus"){drawBusBody(b,x,y,w,h);}
    else if(b.type==="stack"){drawStackBody(b,x,y,w,h);}
    else if(b.type==="small"){drawCrateBody(b,x,y,w,h);}
    else{
      // --- 従来の四角いビル(normal/gold/tough/chain/rainbow) ---
      g.fillStyle="rgba(0,0,0,.22)";g.fillRect(x+4,y+4,w,h);
      let bgr=g.createLinearGradient(x,y,x+w,y);
      if(b.type==="rainbow"){ // にじいろに縦じま(少しずつ色がずれてゆらめく)
        const RB=["#ff5da2","#ff8c42","#f5c518","#43b97f","#3a8ee6","#9b6bff"],sh=(timeT*0.5)%1;
        for(let i=0;i<=6;i++){const t2=i/6;bgr.addColorStop(t2,RB[(i+Math.floor(sh*6))%RB.length]);}
      }else{bgr.addColorStop(0,shade(b.color,0.1));bgr.addColorStop(0.5,b.color);bgr.addColorStop(1,shade(b.color,-0.18));}
      // 軸6: 生成背景(夕暮れ写真)にビルの色が埋もれないよう、本体に外周の暗い影を足して輪郭を浮かせる
      g.shadowColor="rgba(0,0,0,.4)";g.shadowBlur=6;
      g.fillStyle=bgr;g.fillRect(x,y,w,h);
      g.shadowBlur=0;
      g.fillStyle="rgba(255,255,255,.22)";g.fillRect(x,y,w*0.22,h);
      // rooftop trim
      g.fillStyle=shade(b.color,-0.25);g.fillRect(x,y,w,Math.min(5,h*0.1));
      // windows (lit ones glow)
      const cols=3,rows=Math.max(1,Math.floor(h/22));
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
        const on=((b.seed>>((r*cols+c)%16))&1);
        const wx=x+w*(0.16+c*0.28),wy=y+10+r*22*squashDraw,ww=w*0.16,wh=Math.min(12,h*0.25);
        if(on){g.shadowColor="rgba(255,225,140,.9)";g.shadowBlur=6;g.fillStyle="rgba(255,236,150,.92)";}
        else{g.shadowBlur=0;g.fillStyle="rgba(0,0,0,.28)";}
        g.fillRect(wx,wy,ww,wh);
      }
      g.shadowBlur=0;
      g.strokeStyle="rgba(0,0,0,.32)";g.lineWidth=3;g.strokeRect(x,y,w,h);
    }
    // --- special-type decoration ---
    if(b.type==="gold"){
      // golden glow + twinkling stars to lure the eye
      g.save();g.strokeStyle="#fff6c2";g.lineWidth=3;g.shadowColor="#ffd23f";g.shadowBlur=16;g.strokeRect(x,y,w,h);
      for(let i=0;i<3;i++){const tw=0.4+0.6*(0.5+0.5*Math.sin(timeT*5+i*2+b.seed));
        g.globalAlpha=tw;g.fillStyle="#fffbe0";const sx=x+w*(0.25+0.25*i),sy=y+h*(0.2+0.3*((i+b.seed)%3));
        g.beginPath();g.moveTo(sx,sy-5);g.lineTo(sx+1.5,sy-1.5);g.lineTo(sx+5,sy);g.lineTo(sx+1.5,sy+1.5);g.lineTo(sx,sy+5);g.lineTo(sx-1.5,sy+1.5);g.lineTo(sx-5,sy);g.lineTo(sx-1.5,sy-1.5);g.closePath();g.fill();}
      g.restore();
    }else if(b.type==="tough"){
      // bolted steel plates + crack if already hit once
      g.strokeStyle="rgba(220,228,240,.5)";g.lineWidth=2;
      for(let yy=y+8;yy<y+h-4;yy+=Math.max(16,h*0.25)){g.beginPath();g.moveTo(x,yy);g.lineTo(x+w,yy);g.stroke();}
      g.fillStyle="#7c8696";for(const bp of[[0.12,0.12],[0.88,0.12]]){g.beginPath();g.arc(x+w*bp[0],y+h*bp[1],2.5,0,TAU);g.fill();}
      if(b.hp<2){g.strokeStyle="rgba(0,0,0,.55)";g.lineWidth=2;g.beginPath();g.moveTo(x+w*0.5,y);g.lineTo(x+w*0.4,y+h*0.4);g.lineTo(x+w*0.6,y+h*0.7);g.lineTo(x+w*0.45,y+h);g.stroke();}
    }else if(b.type==="chain"){
      // top warning beacon: this one chains
      const bx2=x+w/2,by2=y-6,pul=0.5+0.5*Math.sin(timeT*6+b.seed);
      g.fillStyle="#ff7adb";g.shadowColor="#ff7adb";g.shadowBlur=8+pul*8;
      g.beginPath();g.arc(bx2,by2,3+pul*1.5,0,TAU);g.fill();g.shadowBlur=0;
    }else if(b.type==="rainbow"){
      // ① にじいろビル: 脈打つ虹の枠＋てっぺんの光る星(のぼってくる間から光る=「くるぞ！」の予告)
      const pul=0.5+0.5*Math.sin(timeT*7+b.seed),rc=["#ff5da2","#f5c518","#3a8ee6"][Math.floor(timeT*5)%3];
      g.save();g.lineWidth=3+pul*2;g.strokeStyle="#ffffff";g.shadowColor=rc;g.shadowBlur=14+pul*10;
      g.strokeRect(x,y,w,h);
      const sx=x+w/2,sy=y-8;g.fillStyle="#fffbe0";
      g.beginPath();g.moveTo(sx,sy-6);g.lineTo(sx+2,sy-2);g.lineTo(sx+6,sy);g.lineTo(sx+2,sy+2);g.lineTo(sx,sy+6);g.lineTo(sx-2,sy+2);g.lineTo(sx-6,sy);g.lineTo(sx-2,sy-2);g.closePath();g.fill();
      g.restore();g.shadowBlur=0;
    }
  }
  // --- 軸7: 丸い給水タンク(g.arc/ellipseで胴を描く。四角いビルとはっきり違う輪郭) ---
  function drawTankBody(b,x,y,w,h){
    const cx=b.x,rx=Math.max(0,w/2),ry=Math.max(1,Math.min(rx*0.5,h*0.22));
    const bodyTop=y+ry,bodyBot=Math.max(bodyTop,groundY-ry*0.5);
    // legs
    g.strokeStyle="#5a6678";g.lineWidth=Math.max(2,w*0.07);g.lineCap="round";
    g.beginPath();g.moveTo(cx-rx*0.55,groundY-2);g.lineTo(cx-rx*0.4,bodyBot);g.moveTo(cx+rx*0.55,groundY-2);g.lineTo(cx+rx*0.4,bodyBot);g.stroke();
    // shadow
    g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(cx+3,groundY-1,rx,Math.max(0,ry*0.35),0,0,TAU);g.fill();
    // cylindrical body (side wall + bottom cap + top cap)
    let bg=g.createLinearGradient(x,y,x+w,y);
    bg.addColorStop(0,shade(b.color,0.18));bg.addColorStop(0.5,b.color);bg.addColorStop(1,shade(b.color,-0.22));
    g.fillStyle=bg;g.shadowColor="rgba(0,0,0,.4)";g.shadowBlur=6;
    g.beginPath();g.moveTo(x,bodyTop);g.lineTo(x,bodyBot);g.ellipse(cx,bodyBot,rx,ry,0,0,Math.PI);g.lineTo(x+w,bodyTop);g.ellipse(cx,bodyTop,rx,ry,0,Math.PI,0,true);g.closePath();g.fill();
    g.shadowBlur=0;
    // top cap highlight
    g.fillStyle=shade(b.color,0.28);g.beginPath();g.ellipse(cx,bodyTop,rx,ry,0,0,TAU);g.fill();
    // rivet band + outline
    g.strokeStyle="rgba(0,0,0,.22)";g.lineWidth=2;
    g.beginPath();g.ellipse(cx,y+h*0.55,rx,Math.max(0,ry*0.85),0,0,TAU);g.stroke();
    g.beginPath();g.moveTo(x,bodyTop);g.lineTo(x,bodyBot);g.moveTo(x+w,bodyTop);g.lineTo(x+w,bodyBot);g.stroke();
  }
  // --- 軸7: 横長のバス/トラック(g.arcで車輪を描く。窓帯は横一列) ---
  function drawBusBody(b,x,y,w,h){
    const r=Math.max(2,Math.min(h*0.32,10));
    let bg=g.createLinearGradient(x,y,x,y+h);
    bg.addColorStop(0,shade(b.color,0.16));bg.addColorStop(1,shade(b.color,-0.16));
    g.fillStyle="rgba(0,0,0,.22)";roundRect(x+3,y+3,w,h,r);g.fill();
    g.fillStyle=bg;g.shadowColor="rgba(0,0,0,.4)";g.shadowBlur=6;roundRect(x,y,w,h,r);g.fill();g.shadowBlur=0;
    // window strip
    g.fillStyle="rgba(190,225,255,.85)";roundRect(x+w*0.06,y+h*0.14,w*0.88,h*0.38,4);g.fill();
    g.strokeStyle="rgba(0,0,0,.25)";g.lineWidth=2;
    const divs=4;for(let i=1;i<divs;i++){const dx=x+w*0.06+(w*0.88)*(i/divs);g.beginPath();g.moveTo(dx,y+h*0.14);g.lineTo(dx,y+h*0.52);g.stroke();}
    // bumper stripe
    g.fillStyle="rgba(255,255,255,.3)";g.fillRect(x,y+h*0.72,w,Math.min(h*0.14,h));
    // wheels
    const wr=Math.max(0,Math.min(h*0.55,w*0.09));
    g.fillStyle="#2c3340";g.beginPath();g.arc(x+w*0.22,groundY-2,wr,0,TAU);g.arc(x+w*0.78,groundY-2,wr,0,TAU);g.fill();
    g.fillStyle="#8a94a4";g.beginPath();g.arc(x+w*0.22,groundY-2,Math.max(0,wr*0.42),0,TAU);g.arc(x+w*0.78,groundY-2,Math.max(0,wr*0.42),0,TAU);g.fill();
    g.strokeStyle="rgba(0,0,0,.25)";g.lineWidth=2;roundRect(x,y,w,h,r);g.stroke();
  }
  // --- 軸7: 積みコンテナ(3段まで。b.hpの数だけ箱を積む=1段ずつ崩れたのが見える) ---
  function drawStackBody(b,x,y,w,h){
    const tiers=Math.max(1,b.hp||1),th=h/tiers;
    const pal=["#e0563a","#3a8ee6","#f5c518"];
    for(let i=0;i<tiers;i++){
      const ty=y+i*th,col=pal[(i+b.seed)%pal.length];
      g.fillStyle="rgba(0,0,0,.18)";g.fillRect(x+3,ty+3,w,Math.max(0,th-4));
      let bg=g.createLinearGradient(x,ty,x+w,ty);
      bg.addColorStop(0,shade(col,0.14));bg.addColorStop(0.5,col);bg.addColorStop(1,shade(col,-0.2));
      g.fillStyle=bg;g.shadowColor="rgba(0,0,0,.4)";g.shadowBlur=5;g.fillRect(x+2,ty+2,Math.max(0,w-4),Math.max(0,th-4));g.shadowBlur=0;
      g.strokeStyle="rgba(0,0,0,.32)";g.lineWidth=2;g.strokeRect(x+2,ty+2,Math.max(0,w-4),Math.max(0,th-4));
      g.strokeStyle="rgba(255,255,255,.25)";g.lineWidth=1;
      for(let cx=x+w*0.18;cx<x+w*0.9;cx+=w*0.2){g.beginPath();g.moveTo(cx,ty+4);g.lineTo(cx,ty+th-4);g.stroke();}
    }
  }
  // --- 軸7: 小さな木箱(小型オブジェクト。ビルの窓ではなく十字の板で「クレート感」を出す) ---
  function drawCrateBody(b,x,y,w,h){
    g.fillStyle="rgba(0,0,0,.2)";g.fillRect(x+3,y+3,w,h);
    let bg=g.createLinearGradient(x,y,x,y+h);
    bg.addColorStop(0,shade(b.color,0.16));bg.addColorStop(1,shade(b.color,-0.2));
    g.fillStyle=bg;g.shadowColor="rgba(0,0,0,.4)";g.shadowBlur=5;g.fillRect(x,y,w,h);g.shadowBlur=0;
    g.fillStyle="rgba(255,255,255,.18)";g.fillRect(x,y,w*0.3,h);
    g.strokeStyle="rgba(0,0,0,.35)";g.lineWidth=Math.max(2,w*0.06);
    g.strokeRect(x+2,y+2,Math.max(0,w-4),Math.max(0,h-4));
    g.beginPath();g.moveTo(x+2,y+2);g.lineTo(x+w-2,y+h-2);g.moveTo(x+w-2,y+2);g.lineTo(x+2,y+h-2);g.stroke();
  }
  function roundRect(x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
}
Engine.register("robot", buildRobot);
