function buildGlass(api){
  const g=api.g;
  api.preload(["bg.jpg","star.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。玉(ball)は生成が2回とも不良だったので手描きのまま
  let pane,shards=[],glints=[],floats=[],sparks=[],rings=[],flash=0,wash=0,washCol="#ffffff";
  let balls=[];    // タップで投げた玉の着弾演出(画像 or 手描きの小玉)
  let hsCD=0;      // hitStop cooldown (節目限定・30f以上あける)
  function tryHitStop(f){if(hsCD<=0){api.hitStop(f);hsCD=32;}}
  let round,count,settled,tms=0;
  let stage,paneInStage,combo,comboTimer,finaleDone,banner=0,bannerTxt="",bannerCol="#ffffff",bannerSub="";
  const GOLD={f:"rgba(255,225,130,",e:"#fff0c0",glow:"#ffd860"};
  // ① にじいろガラス: 激レアの虹色の窓。割ると虹の大盤振る舞い+大量得点。
  const RAINBOW={f:"rgba(255,180,220,",e:"#ffffff",glow:"#ff8fd0"};
  const RBHEX=["#ff5da2","#ffd23f","#5ad1ff","#7be08a","#b69cff"];
  // ② きょうのラッキー色: ステージtintのglow色に名前をつけ、そこから毎プレイ1色を秘密に選ぶ
  const TINTNAME={"#7fc4ff":"あお","#84e6b0":"みどり","#ff96c8":"ピンク","#b69cff":"むらさき",
    "#ffc864":"きいろ","#ff9b5c":"オレンジ","#74ead8":"みずいろ","#88e6a4":"みどり","#9cb6ff":"あお","#ff9cd2":"ピンク"};
  const LUCKYKEYS=Object.keys(TINTNAME);
  const PER_STAGE=6;                 // 6枚割るとステージクリア(7〜8歳向けに手応えを増やした)
  const FINALE_SCORE=60;             // スコア60で特大フィナーレ窓
  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマー/トラックと同じ思想) ----
  let luckyColor,luckyName,luckySeen,luckyMsgT,rbMsgT,stageWaste,shoot,shootCD;
  // ステージごとの配色パレット(背景2色 + ガラスtint群)
  // ⑦ 壊す物のバラエティ: 板ガラス(pane)以外に瓶(bottle)/瓶の3段重ね(jarstack)/壺(vase)を混ぜる。
  //   大きさ・壊れ方をkindごとに変え、色違いの板ガラスだけで終わらせない。
  const STAGES=[
    {bg:["#3a4458","#161b27"],shape:"rect",kinds:["pane","pane","bottle"],tints:[
      {f:"rgba(120,190,255,",e:"#bfe3ff",glow:"#7fc4ff"},
      {f:"rgba(130,230,170,",e:"#c8f5d8",glow:"#84e6b0"}]},
    {bg:["#4a3a58","#1d1627"],shape:"tall",kinds:["pane","bottle","bottle"],tints:[
      {f:"rgba(255,150,200,",e:"#ffd0e6",glow:"#ff96c8"},
      {f:"rgba(190,160,255,",e:"#e0d0ff",glow:"#b69cff"}]},
    {bg:["#58503a","#271f16"],shape:"wide",kinds:["pane","jarstack"],tints:[
      {f:"rgba(255,210,120,",e:"#ffe9b0",glow:"#ffc864"},
      {f:"rgba(255,170,110,",e:"#ffe0c0",glow:"#ff9b5c"}]},
    {bg:["#2f5852","#152722"],shape:"round",kinds:["pane","vase","vase"],tints:[
      {f:"rgba(120,235,220,",e:"#c6fff6",glow:"#74ead8"},
      {f:"rgba(150,230,170,",e:"#cdf6d8",glow:"#88e6a4"}]},
    {bg:["#3a3a58","#16162b"],shape:"grid",kinds:["pane","bottle","jarstack","vase"],tints:[
      {f:"rgba(180,200,255,",e:"#dfe6ff",glow:"#9cb6ff"},
      {f:"rgba(255,180,220,",e:"#ffd8ee",glow:"#ff9cd2"}]}
  ];
  function curStage(){return STAGES[stage%STAGES.length];}
  function paneSize(shape,finale,kind){
    let w=clamp(api.W*0.74,240,560),h=clamp(api.H*0.6,300,640);
    if(shape==="tall"){w=clamp(api.W*0.5,200,420);h=clamp(api.H*0.7,320,700);}
    else if(shape==="wide"){w=clamp(api.W*0.82,260,620);h=clamp(api.H*0.46,220,520);}
    else if(shape==="round"){const d=clamp(Math.min(api.W*0.72,api.H*0.62),260,560);w=d;h=d;}
    // kindごとに明確な大小差(小物=素早く壊せる/大物=finaleでそのまま残す)
    if(kind==="bottle"){w=clamp(api.W*0.26,110,220);h=clamp(api.H*0.5,260,460);}
    else if(kind==="jarstack"){w=clamp(api.W*0.34,150,300);h=clamp(api.H*0.62,320,620);}
    else if(kind==="vase"){w=clamp(api.W*0.4,170,340);h=clamp(api.H*0.52,260,480);}
    if(finale){w=clamp(api.W*0.86,280,640);h=clamp(api.H*0.66,320,680);}
    return{w,h};
  }
  function layout(){if(pane){const s=paneSize(pane.shape,pane.finale,pane.kind);pane.w=s.w;pane.h=s.h;pane.x=(api.W-pane.w)/2;pane.ty=(api.H-pane.h)/2;}}
  function newPane(){
    const st=curStage();
    const finale=(count>=FINALE_SCORE&&!finaleDone);
    const shape=finale?"grid":st.shape;
    // ⑦ finale(特大パネル)は従来どおり板ガラスの大物として残し、それ以外はステージのkinds群からランダム選択
    // 軸3/軸1対策: ゲーム開始直後の1枚目は必ず瓶(2〜3打の小物)にして、最初の成功を確実に早める
    const kind=finale?"pane":(round===0?"bottle":pick(st.kinds||["pane"]));
    const{w,h}=paneSize(shape,finale,kind);
    const baseNeed=clamp(4+Math.floor(round/2),4,7)+stage;          // ステージごとに少しずつ手応え増(7〜8歳向け: 開始4・上限9)。無得点区間が伸びすぎないよう上限を8→7に
    // ⑦ 小物(bottle)はneedを2〜3固定にして、サッと壊せる的として大物と混在させる
    const need=kind==="bottle"?rint(2,3):(finale?18:clamp(baseNeed,4,9));
    pane={x:(api.W-w)/2,y:-h-20,ty:(api.H-h)/2,w,h,
      tint:st.tints[paneInStage%st.tints.length],shape,kind,round:false,grid:shape==="grid",
      need,hits:0,cracks:[],sx:1,sy:1,gold:false,finale,jarsFallen:0,squashed:false};
    if(shape==="round")pane.round=true;
    // ① にじいろガラス: ステージ2以降、ときどき(約5%)だけ出る激レア。いつ出るか分からない=ドキドキ発見。
    if(!finale&&stage>=1&&rnd(0,1)<0.05){pane.rainbow=true;pane.tint=RAINBOW;if(kind!=="bottle")pane.need=clamp(baseNeed,4,6);}
    // コンボが乗っているとたまに金の特別窓が出る(ボーナス)。虹より優先させない。
    if(!finale&&!pane.rainbow&&combo>=3&&rnd(0,1)<0.5){pane.gold=true;pane.tint=GOLD;}
    // ⑦ jarstack: 1段ずつ崩れ落ちる演出のための、段あたりの必要タップ数
    if(kind==="jarstack")pane.segNeed=Math.max(1,Math.round(pane.need/3));
    settled=false;
  }
  function reset(){round=0;count=0;stage=0;paneInStage=0;combo=0;comboTimer=0;finaleDone=false;banner=0;shards=[];glints=[];floats=[];sparks=[];rings=[];balls=[];flash=0;wash=0;
    luckyColor=pick(LUCKYKEYS);luckyName=TINTNAME[luckyColor];luckySeen=false;luckyMsgT=0;rbMsgT=0;stageWaste=0;shoot=null;shootCD=rint(180,360);
    newPane();}
  function addCrack(x,y){
    const lines=[];const n=rint(5,8);
    for(let i=0;i<n;i++){const a=rnd(0,TAU),len=rnd(pane.w*0.12,pane.w*0.4);
      const segs=[];let cx=x,cy=y,ca=a;
      const steps=rint(2,4);
      for(let s=0;s<steps;s++){ca+=rnd(-0.4,0.4);const sl=len/steps;cx+=Math.cos(ca)*sl;cy+=Math.sin(ca)*sl;segs.push({x:cx,y:cy});}
      lines.push({segs});}
    pane.cracks.push({x,y,lines,t:0});
  }
  function burstSparks(x,y,n,spd,tint){
    for(let k=n;k>0;k--){const a=rnd(0,TAU),s=rnd(spd*0.3,spd);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:rnd(0.03,0.06),
        r:rnd(1.5,3.5),tint});}
  }
  function chip(x,y){
    for(let k=rint(4,7);k>0;k--)shards.push({x,y,vx:rnd(-5,5),vy:rnd(-7,-1),r:rnd(5,12),
      rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.02),tint:pane.tint});
    glints.push({x,y,life:1,rot:rnd(0,TAU)});
    burstSparks(x,y,rint(6,10),5,pane.tint);
    rings.push({x,y,r:6,vr:2.4,life:1,col:pane.tint.glow,lw:3});
    pane.sx=0.92;pane.sy=1.08;
  }
  function hitShoot(){
    // ④ ながれ星ヒット: きらめき+ほし。減点なしのごほうび(小さな加点)。
    if(!shoot)return;
    api.tone(1568,0.1,"triangle",0.1);api.tone(2093,0.12,"triangle",0.07);
    burstSparks(shoot.x,shoot.y,12,7,{glow:"#ffe27a"});
    rings.push({x:shoot.x,y:shoot.y,r:6,vr:3,life:1,col:"#ffe27a",lw:3});
    glints.push({x:shoot.x,y:shoot.y,life:1,rot:rnd(0,TAU)});
    floats.push({x:shoot.x,y:shoot.y-14,txt:"ほし ゲット！",col:"#ffe27a",life:1,vy:-0.7,size:24,pop:0});
    count+=1;api.setScore(count);
    shoot=null;
  }
  function shatter(){
    const isFinale=pane.finale;
    // コンボ更新: 素早く割ると連鎖
    if(comboTimer>0)combo++;else combo=1;
    comboTimer=80;                     // れんさ猶予を少し短く(7〜8歳向け)
    const rainbow=pane.rainbow;
    const gold=pane.gold;
    const t=rainbow?RAINBOW:(gold?GOLD:pane.tint);
    // ② きょうのラッキー色: 秘密の1色(ふつうの窓)を割ると +1 の隠しボーナス。気づくと得。
    const isLucky=!rainbow&&!gold&&!isFinale&&pane.tint.glow===luckyColor;
    // コンボに応じてシェイク/シャード/音を増幅
    const cAmp=clamp(combo,1,6);
    api.slide(2200,900,0.25,0.16,"triangle");api.tone(1600+combo*60,0.18,"sine",0.12);api.noise(0.3,0.25,3000,"highpass");
    api.boom(isFinale?0.6:clamp(0.32+combo*0.04,0.32,0.55));
    api.shake(isFinale?34:14+cAmp*2);tryHitStop(isFinale?10:7);flash=1;wash=1;washCol=t.glow;
    const cx0=pane.x+pane.w/2,cy0=pane.ty+pane.h/2;
    const cols=isFinale?16:10,rows=isFinale?13:8;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const cx=pane.x+pane.w*(c+0.5)/cols,cy=pane.ty+pane.h*(r+0.5)/rows;
      shards.push({x:cx,y:cy,vx:(cx-cx0)*0.06+rnd(-3,3),vy:rnd(-6,2)+(cy-cy0)*0.025,
        r:rnd(pane.w*0.03,pane.w*0.07),rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.004,0.009),tint:t,tri:true});
    }
    const nGl=18+cAmp*4;
    for(let i=0;i<nGl;i++)glints.push({x:pane.x+rnd(0,pane.w),y:pane.ty+rnd(0,pane.h),life:1,rot:rnd(0,TAU)});
    burstSparks(cx0,cy0,46+cAmp*8,11,t);
    rings.push({x:cx0,y:cy0,r:pane.w*0.18,vr:9,life:1,col:t.glow,lw:6});
    rings.push({x:cx0,y:cy0,r:8,vr:6,life:1,col:"#ffffff",lw:4});
    floats.push({x:api.W/2,y:api.H*0.4,txt:rainbow?"にじいろ！":gold?"きんピカ！":"パリーン！",col:t.e,life:1,vy:-0.7,size:48,pop:0});
    if(combo>=2)floats.push({x:api.W/2,y:api.H*0.4+40,txt:combo+"れんさ！",col:"#ffe27a",life:1,vy:-0.5,size:30,pop:0});
    // ① にじいろガラス撃破: 虹の輪が5色ぶわっと広がる大盤振る舞い(激レアの爽快ごほうび)
    if(rainbow){
      rbMsgT=1.4;
      for(let k=0;k<RBHEX.length;k++)rings.push({x:cx0,y:cy0,r:pane.w*0.12,vr:8+k*1.3,life:1,col:RBHEX[k],lw:5});
      for(let i=0;i<40;i++){const a=rnd(0,TAU),s=rnd(4,11);
        sparks.push({x:cx0,y:cy0,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:1,decay:rnd(0.02,0.04),r:rnd(2,4),tint:{glow:RBHEX[i%RBHEX.length]}});}
      api.tone(880,0.16,"triangle",0.12);api.tone(1320,0.18,"triangle",0.1);api.tone(1760,0.2,"triangle",0.07);
    }
    // ② ラッキー色命中: きらっと小さめの祝福(白飛びしないよう控えめ)+頭上に星
    if(isLucky){
      luckyMsgT=luckySeen?Math.max(luckyMsgT,0.7):1.6;luckySeen=true;
      burstSparks(cx0,pane.ty-8,8,6,pane.tint);
      floats.push({x:api.W/2,y:api.H*0.4+80,txt:"ラッキー！",col:pane.tint.e,life:1,vy:-0.5,size:26,pop:0});
      api.tone(1046,0.12,"triangle",0.1);api.tone(1568,0.14,"triangle",0.08);
    }
    // スコア: 通常+1, コンボ/金/にじ/フィナーレ/ラッキーでボーナス
    let gain=1+(gold?2:0)+(rainbow?5:0)+(isFinale?5:0)+(combo>=3?1:0)+(isLucky?1:0);
    count+=gain;api.setScore(count);round++;

    if(isFinale){
      finaleDone=true;
      // 全画面シャード豪雨
      for(let i=0;i<90;i++)shards.push({x:rnd(0,api.W),y:rnd(-api.H*0.5,0),vx:rnd(-2,2),vy:rnd(1,5),
        r:rnd(6,16),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.003,0.006),tint:t,tri:true});
      for(let i=0;i<3;i++)rings.push({x:api.W/2,y:api.H/2,r:20+i*40,vr:11,life:1,col:t.glow,lw:7});
      showBanner("ぜんぶ わった！",GOLD.e,"だいせいこう！");
      api.tone(880,0.3,"sine",0.14);api.slide(660,1320,0.4,0.12,"triangle");
      paneInStage++;newPane();return;
    }

    paneInStage++;
    if(paneInStage>=PER_STAGE){
      // ③ ノーミス ボーナス: このステージで的をはずすタップ(ガラスの外)を1度もしなかったら +3 & 祝福。
      //   気づくと得する頭を使う仕掛け(狙って当てるほどごほうび)。
      const noMiss=stageWaste===0;
      if(noMiss){count+=3;api.setScore(count);
        burstSparks(api.W/2,api.H*0.42,18,8,{glow:"#7be08a"});
        api.tone(1318,0.14,"triangle",0.1);api.tone(1976,0.16,"triangle",0.07);}
      stageWaste=0;
      // ステージクリア演出
      stage++;paneInStage=0;
      const ns=curStage();
      // ノーミス達成時は副題に統合して1本のテキストにまとめる(割れテキスト/コンボと重なって読めなくなるのを防ぐ)
      showBanner("ステージ "+(stage+1),ns.tints[0].e,noMiss?"クリア！ ノーミス+3":"クリア！");
      for(let i=0;i<3;i++)rings.push({x:api.W/2,y:api.H/2,r:16+i*30,vr:8,life:1,col:ns.tints[0].glow,lw:6});
      burstSparks(api.W/2,api.H/2,30,9,ns.tints[0]);
      api.shake(18);tryHitStop(6);
      api.slide(520,1040,0.35,0.12,"triangle");api.tone(784,0.22,"sine",0.12);api.tone(988,0.26,"sine",0.1);api.boom(0.46);
    }
    newPane();
  }
  function showBanner(txt,col,sub){banner=1;bannerTxt=txt;bannerCol=col;bannerSub=sub||"";wash=1;washCol=col;}
  reset();
  return{
    resize:layout,
    input(px,py,type){
      if(type!=="down")return;
      // ④ ひみつ発見: ながれ星を撃つと ごほうび(きらめき+ほし+1)。減点なし・ガラス操作と衝突しない。
      if(shoot&&Math.hypot(px-shoot.x,py-shoot.y)<Math.max(46,api.W*0.08)){hitShoot();return;}
      if(!settled)return;
      // 投げた玉がその場でコツンと当たる小演出(操作は変えない・見た目だけ)
      balls.push({x:px,y:py,t:0,rot:rnd(0,TAU)});if(balls.length>8)balls.splice(0,balls.length-8);
      if(px>=pane.x&&px<=pane.x+pane.w&&py>=pane.ty&&py<=pane.ty+pane.h){
        // 弱点タップ: 既存のヒビの近くを狙うと一撃で大きく割れる
        let weak=false;
        for(const cr of pane.cracks){if(Math.hypot(px-cr.x,py-cr.y)<pane.w*0.16){weak=true;break;}}
        const dmg=weak?2:1;
        pane.hits+=dmg;addCrack(px,py);chip(px,py);
        if(weak){
          // ご褒美演出(連射ではないのでhitStopは入れない)
          burstSparks(px,py,16,9,pane.tint);rings.push({x:px,y:py,r:8,vr:5,life:1,col:"#ffffff",lw:4});
          floats.push({x:px,y:py-10,txt:"きゅうしょ！",col:pane.tint.e,life:1,vy:-0.8,size:26,pop:0});
          api.tone(1500,0.1,"triangle",0.13);api.slide(1200,2000,0.1,0.1,"sine");api.shake(7);
        }
        api.tone(900+pane.hits*180,0.09,"triangle",0.12);api.noise(0.05,0.1,2600,"highpass");api.shake(4);
        // ⑦ jarstack: 砕けるだけでなく「1段ずつ崩れ落ちる」壊れ方(hammer.jsのtowerと同じ思想)
        if(pane.kind==="jarstack"){
          const nf=Math.min(2,Math.floor(pane.hits/pane.segNeed));
          if(nf>pane.jarsFallen){pane.jarsFallen=nf;
            burstSparks(px,py,10,7,pane.tint);rings.push({x:px,y:py,r:8,vr:5,life:1,col:pane.tint.glow,lw:3});
            api.tone(260,0.1,"square",0.1);api.shake(6);}
        }
        // ⑦ vase: 割れる直前に軽く「へこむ」演出を挟んでから最後の一撃で割れる(既存の潰し戻りアニメを流用)
        if(pane.kind==="vase"&&pane.hits===pane.need-1&&!pane.squashed){
          pane.squashed=true;pane.sx=1.35;pane.sy=0.6;api.tone(210,0.09,"square",0.09);
        }
        if(pane.hits>=pane.need)shatter();
      }else{api.tone(200,0.05,"triangle",0.05);stageWaste++;}  // ③ 的はずし=このステージのノーミス失敗
    },
    frame(dt,now){
      tms+=dt;
      if(hsCD>0)hsCD-=dt;
      if(comboTimer>0){comboTimer-=dt;if(comboTimer<=0)combo=0;}
      // bg (ステージごとに配色チェンジ)
      const bg=curStage().bg;
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージの配色を薄く重ねて面ごとの雰囲気を変える(1面=夜の街そのまま)
        if(stage%STAGES.length!==0){g.save();g.globalAlpha=0.28;
          let tg=g.createLinearGradient(0,0,0,api.H);tg.addColorStop(0,bg[0]);tg.addColorStop(1,bg[1]);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);grd.addColorStop(0,bg[0]);grd.addColorStop(1,bg[1]);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // soft ambient glow behind pane (tinted)
      const t=pane.tint,cx0=pane.x+pane.w/2,cy0=pane.ty+pane.h/2;
      const halo=g.createRadialGradient(cx0,cy0,10,cx0,cy0,Math.max(pane.w,pane.h)*0.75);
      halo.addColorStop(0,t.f+(0.16+0.04*Math.sin(tms*0.05))+")");halo.addColorStop(1,t.f+"0)");
      g.fillStyle=halo;g.fillRect(0,0,api.W,api.H);
      // drifting backdrop sparkles ※画像背景のときは絵の星空があるので描かない
      g.save();
      if(!imgBg) for(let i=0;i<7;i++){const bx=(i*137.5+tms*0.3)%api.W,by=(i*89.3+Math.sin(tms*0.02+i)*30)%api.H;
        g.globalAlpha=0.06+0.05*(1+Math.sin(tms*0.04+i*2))/2;g.fillStyle="#ffffff";
        g.beginPath();g.arc(bx,by,1.6,0,TAU);g.fill();}
      g.restore();
      // ④ ながれ星: ときどき空を斜めに流れる。撃つ(タップ)とごほうび。バナー中は出さない。
      if(shootCD>0)shootCD-=dt;
      else if(!shoot&&banner<=0){
        const fromLeft=rnd(0,1)<0.5;
        shoot={x:fromLeft?-30:api.W+30,y:api.H*rnd(0.1,0.3),vx:(fromLeft?1:-1)*rnd(7,10),vy:rnd(1.5,3),trail:[],spin:rnd(0,TAU)};
        shootCD=rint(200,380);          // 軸3対策: 出現間隔を詰めて無得点区間の保険にする
      }
      if(shoot){
        shoot.x+=shoot.vx*dt;shoot.y+=shoot.vy*dt;shoot.spin+=0.08*dt;
        shoot.trail.push({x:shoot.x,y:shoot.y});if(shoot.trail.length>10)shoot.trail.shift();
        g.save();g.globalCompositeOperation="lighter";
        for(let i=0;i<shoot.trail.length;i++){const tp=shoot.trail[i],a=i/shoot.trail.length;
          g.globalAlpha=a*0.5;g.fillStyle="#bfe3ff";g.beginPath();g.arc(tp.x,tp.y,1.5+a*2.2,0,TAU);g.fill();}
        g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";
        // 画像の星(スプライトは正方形いっぱいの星。当たり判定 半径max(46,W*0.08) の直径の約7割に合わせる)。無ければ従来の白い点
        //  顔つきの星なのでぐるぐる回さず、ゆらゆら揺れる+進行方向で左右反転
        const ss=Math.max(60,Math.min(96,api.W*0.11));
        if(!api.drawAsset("star.png",shoot.x,shoot.y,ss,ss,{center:true,rot:Math.sin(shoot.spin)*0.25,flip:shoot.vx<0})){
          g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.9;g.fillStyle="#ffffff";
          g.beginPath();g.arc(shoot.x,shoot.y,3,0,TAU);g.fill();g.restore();g.globalAlpha=1;}
        if(shoot.x<-60||shoot.x>api.W+60||shoot.y>api.H*0.62)shoot=null;
      }
      // pane entrance
      if(pane.y<pane.ty){pane.y=Math.min(pane.ty,pane.y+(pane.ty-pane.y)*0.18*dt+2);}
      else {pane.y=pane.ty;settled=true;}
      // squash recovery
      pane.sx+=(1-pane.sx)*0.18*dt;pane.sy+=(1-pane.sy)*0.18*dt;
      drawPane();
      // ② ラッキー色の窓には頭上に小さな星がキラッ(気づけるヒント)
      if(settled&&!pane.gold&&!pane.rainbow&&!pane.finale&&pane.tint.glow===luckyColor){
        const sx=pane.x+pane.w/2,sy=pane.y-40+Math.sin(tms*0.1)*3,s=7;
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.55+0.35*Math.max(0,Math.sin(tms*0.14));
        g.translate(sx,sy);g.rotate(tms*0.02);g.fillStyle=luckyColor;
        g.beginPath();g.moveTo(0,-s);g.lineTo(s*0.2,-s*0.2);g.lineTo(s,0);g.lineTo(s*0.2,s*0.2);
        g.lineTo(0,s);g.lineTo(-s*0.2,s*0.2);g.lineTo(-s,0);g.lineTo(-s*0.2,-s*0.2);g.closePath();g.fill();
        g.restore();g.globalAlpha=1;
      }
      // 投げた玉の着弾: ぶつかった位置で ぷにっと潰れて薄れる(手描き: 生成画像は背景抜きで欠けたので使わない)
      for(const b of balls){b.t+=0.09*dt;const k=clamp(b.t,0,1);
        const bs=Math.max(1,clamp(pane.w*0.09,22,44)*(1.25-k*0.45)),al=1-k*k;
        g.save();g.globalAlpha=al;g.translate(b.x,b.y);g.rotate(b.rot+k*0.6);
        g.fillStyle="#26355c";g.beginPath();g.arc(0,0,bs*0.42,0,TAU);g.fill();
        g.fillStyle="#ff9a3c";g.beginPath();g.ellipse(0,0,bs*0.42,Math.max(0,bs*0.1),0,0,TAU);g.fill();
        g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(-bs*0.14,-bs*0.16,Math.max(0,bs*0.1),0,TAU);g.fill();
        g.restore();g.globalAlpha=1;}
      balls=balls.filter(b=>b.t<1);
      // shards
      for(const p of shards){p.vy+=0.4*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life)*0.9;g.translate(p.x,p.y);g.rotate(p.rot);
        g.shadowColor=p.tint.glow;g.shadowBlur=8;
        g.fillStyle=p.tint.f+"0.85)";
        if(p.tri){g.beginPath();g.moveTo(0,-p.r);g.lineTo(p.r*0.9,p.r*0.7);g.lineTo(-p.r*0.8,p.r*0.6);g.closePath();g.fill();
          g.shadowBlur=0;g.fillStyle="rgba(255,255,255,.55)";g.beginPath();g.moveTo(0,-p.r);g.lineTo(p.r*0.3,-p.r*0.2);g.lineTo(-p.r*0.2,-p.r*0.2);g.closePath();g.fill();}
        else{g.beginPath();g.moveTo(0,-p.r);g.lineTo(p.r,p.r);g.lineTo(-p.r,p.r);g.closePath();g.fill();}
        g.restore();}
      shards=shards.filter(p=>p.life>0&&p.y<api.H+40);
      // sparks (additive twinkles)
      g.save();g.globalCompositeOperation="lighter";
      for(const sp of sparks){sp.vy+=0.18*dt;sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.96;sp.life-=sp.decay*dt;
        const a=Math.max(0,sp.life);g.globalAlpha=a;g.fillStyle=sp.tint.glow;
        g.beginPath();g.arc(sp.x,sp.y,sp.r*(0.5+a),0,TAU);g.fill();}
      g.restore();sparks=sparks.filter(s=>s.life>0&&s.y<api.H+30);
      // rings (shockwaves)
      g.save();g.globalCompositeOperation="lighter";
      for(const rg of rings){rg.r+=rg.vr*dt;rg.life-=0.04*dt;
        g.globalAlpha=Math.max(0,rg.life)*0.6;g.strokeStyle=rg.col;g.lineWidth=rg.lw*Math.max(0.2,rg.life);
        g.beginPath();g.arc(rg.x,rg.y,rg.r,0,TAU);g.stroke();}
      g.restore();rings=rings.filter(r=>r.life>0);
      // glints (4-point sparkle stars)
      for(const gl of glints){gl.life-=0.04*dt;const a=Math.max(0,gl.life),s=a*9+3;
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=a;
        g.translate(gl.x,gl.y);g.rotate(gl.rot);g.fillStyle="#ffffff";
        g.beginPath();g.moveTo(0,-s);g.lineTo(s*0.18,-s*0.18);g.lineTo(s,0);g.lineTo(s*0.18,s*0.18);
        g.lineTo(0,s);g.lineTo(-s*0.18,s*0.18);g.lineTo(-s,0);g.lineTo(-s*0.18,-s*0.18);g.closePath();g.fill();
        g.restore();}
      g.globalAlpha=1;glints=glints.filter(g2=>g2.life>0);
      // screen flash on shatter
      if(wash>0){g.save();g.globalCompositeOperation="lighter";g.globalAlpha=wash*0.3;
        const wg=g.createRadialGradient(api.W/2,api.H/2,0,api.W/2,api.H/2,Math.max(api.W,api.H)*0.7);
        wg.addColorStop(0,washCol);wg.addColorStop(1,"rgba(0,0,0,0)");
        g.fillStyle=wg;g.fillRect(0,0,api.W,api.H);g.restore();wash-=0.035*dt;}
      if(flash>0){g.save();g.globalCompositeOperation="lighter";g.globalAlpha=flash*0.35;
        g.fillStyle="#ffffff";g.fillRect(0,0,api.W,api.H);g.restore();flash-=0.06*dt;}
      // 加算合成をここで確実に元へ戻す(白飛び対策・以降のUIは通常合成で描く)
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
      // floats
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.012*dt;f.pop=Math.min(1,f.pop+0.12*dt);
        const sc=1+(1-f.pop)*0.6;g.save();g.globalAlpha=Math.max(0,f.life);
        g.translate(f.x,f.y);g.scale(sc,sc);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.shadowColor=f.col;g.shadowBlur=20;
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,0,0);
        g.fillStyle=f.col;g.fillText(f.txt,0,0);g.restore();}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // combo counter (上部中央＝engine HUDのスコア/ミュートと衝突しない安全帯)
      if(combo>=2&&comboTimer>0){
        const cs=1+0.15*Math.sin(tms*0.3)+clamp(combo,0,8)*0.04;
        g.save();g.textAlign="center";g.translate(api.W/2,54);g.scale(cs,cs);
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="#ffd860";g.shadowBlur=16;
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(combo+" コンボ",0,0);
        g.fillStyle="#ffe27a";g.fillText(combo+" コンボ",0,0);g.restore();
        g.textAlign="left";
      }
      // stage / finale banner
      if(banner>0){
        banner-=0.006*dt;const a=Math.max(0,banner);
        const pop=ease?ease(clamp((1-banner)*2,0,1)):clamp((1-banner)*2,0,1);
        const sc=0.6+pop*0.5;
        g.save();g.textAlign="center";g.globalAlpha=clamp(a*2,0,1);
        g.translate(api.W/2,api.H*0.28);g.scale(sc,sc);
        g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=bannerCol;g.shadowBlur=26;
        g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(bannerTxt,0,0);
        g.fillStyle=bannerCol;g.fillText(bannerTxt,0,0);
        g.font="800 20px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#ffffff";g.shadowBlur=12;
        g.fillText(bannerSub,0,40);
        g.restore();g.textAlign="left";g.globalAlpha=1;
      }
      // ① にじいろガラス！ 発見バナー(虹色に色替わり=レアの大きな祝福・上部中央=HUD安全帯)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,rc=RBHEX[Math.floor(tms*0.15)%RBHEX.length];
        g.save();g.textAlign="center";g.translate(api.W/2,api.H*0.19);g.scale(pop,pop);
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 40px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=rc;g.shadowBlur=20;
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText("にじいろガラス！",0,0);
        g.fillStyle="#ffffff";g.fillText("にじいろガラス！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央の小ヒント(初回だけ大きく教える)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.textAlign="center";g.translate(api.W/2,api.H*0.37);
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 23px 'Hiragino Maru Gothic ProN',system-ui";
        const t3="きょうのラッキー色は "+luckyName+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.4)";g.strokeText(t3,0,0);
        g.fillStyle=luckyColor;g.fillText(t3,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // hint (cute rounded glass pill)
      {const t2=pane.tint;
        g.save();g.textAlign="center";
        g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";
        const msg="タップして ガラスを わろう！";
        const tm=g.measureText(msg);const tw=(tm&&tm.width)||msg.length*8;
        const pw=tw+44,ph=38,px=api.W/2-pw/2,py=api.H-ph-14;
        const bob=Math.sin(tms*0.06)*2;
        g.translate(0,bob);
        // pill body
        let pg=g.createLinearGradient(px,py,px,py+ph);
        pg.addColorStop(0,"rgba(60,72,92,0.82)");pg.addColorStop(1,"rgba(34,42,58,0.82)");
        g.fillStyle=pg;g.shadowColor="rgba(0,0,0,0.5)";g.shadowBlur=14;g.shadowOffsetY=3;
        roundRect(px,py,pw,ph,ph/2);g.fill();
        g.shadowBlur=0;g.shadowOffsetY=0;
        // glowing rim
        g.strokeStyle=t2.e;g.lineWidth=2;g.shadowColor=t2.glow;g.shadowBlur=10;
        roundRect(px,py,pw,ph,ph/2);g.stroke();g.shadowBlur=0;
        // top sheen
        g.fillStyle="rgba(255,255,255,.16)";
        roundRect(px+6,py+4,pw-12,ph*0.4,ph*0.2);g.fill();
        // text
        g.fillStyle=t2.e;g.shadowColor=t2.glow;g.shadowBlur=8;
        g.fillText(msg,api.W/2,py+ph/2+6);
        g.restore();}
      g.textAlign="left";
    }
  };
  function drawPane(){
    const t=pane.tint,w=pane.w,h=pane.h;
    const cx=pane.x+w/2,cy=pane.y+h/2;
    g.save();g.translate(cx,cy);g.scale(pane.sx,pane.sy);g.translate(-cx,-cy);
    const x=pane.x,y=pane.y,rnd9=pane.round?Math.min(w,h)/2:9;
    // ⑦ kindごとに描き分け: pane=従来の板ガラス。bottle/vase=別シルエット。jarstackは専用関数(3段重ね)。
    if(pane.kind==="bottle"){drawShapeBody(bottlePath,x,y,w,h,t);}
    else if(pane.kind==="vase"){drawShapeBody(vasePath,x,y,w,h,t);}
    else if(pane.kind==="jarstack"){drawJarstack(x,y,w,h,t);}
    else {
    // 形ごとのパス(round=楕円, それ以外=角丸四角)
    const path=(ix,iy,iw,ih,rr)=>{if(pane.round){g.beginPath();g.ellipse(ix+iw/2,iy+ih/2,Math.max(0,iw/2),Math.max(0,ih/2),0,0,TAU);}else roundRect(ix,iy,iw,ih,rr);};
    // outer glow
    g.save();g.shadowColor=t.glow;g.shadowBlur=26;g.fillStyle="rgba(0,0,0,0.001)";
    path(x-12,y-12,w+24,h+24,16);g.fill();g.restore();
    // border frame (metallic gradient)
    let fr=g.createLinearGradient(x,y-12,x,y+h+12);
    fr.addColorStop(0,"#737f93");fr.addColorStop(0.5,"#4c5668");fr.addColorStop(1,"#39414f");
    g.fillStyle=fr;path(x-12,y-12,w+24,h+24,16);g.fill();
    g.fillStyle="#2c3340";path(x-6,y-6,w+12,h+12,11);g.fill();
    // glass body (vertical gradient for depth)
    let gb=g.createLinearGradient(x,y,x,y+h);
    gb.addColorStop(0,t.f+"0.42)");gb.addColorStop(0.5,t.f+"0.26)");gb.addColorStop(1,t.f+"0.40)");
    g.fillStyle=gb;path(x,y,w,h,rnd9);g.fill();
    // inner rim glow
    g.save();g.strokeStyle=t.e;g.lineWidth=2.5;g.shadowColor=t.glow;g.shadowBlur=12;
    path(x,y,w,h,rnd9);g.stroke();g.restore();
    // clipped interior effects
    g.save();path(x,y,w,h,rnd9);g.clip();
    // diagonal highlights
    g.fillStyle="rgba(255,255,255,.18)";
    g.beginPath();g.moveTo(x,y+h*0.2);g.lineTo(x+w*0.4,y);g.lineTo(x+w*0.6,y);g.lineTo(x,y+h*0.5);g.closePath();g.fill();
    g.fillStyle="rgba(255,255,255,.12)";
    g.beginPath();g.moveTo(x+w*0.7,y+h);g.lineTo(x+w,y+h*0.6);g.lineTo(x+w,y+h*0.75);g.lineTo(x+w*0.82,y+h);g.closePath();g.fill();
    // moving sheen sweep
    const sweep=((tms*0.6)%(w+h*2))-h;
    let sg=g.createLinearGradient(x+sweep-40,y,x+sweep+40,y+h);
    sg.addColorStop(0,"rgba(255,255,255,0)");sg.addColorStop(0.5,"rgba(255,255,255,0.14)");sg.addColorStop(1,"rgba(255,255,255,0)");
    g.fillStyle=sg;g.fillRect(x,y,w,h);
    // faint vertical reflection streaks (reads as polished glass)
    g.fillStyle="rgba(255,255,255,.07)";
    g.fillRect(x+w*0.2,y,3,h);g.fillRect(x+w*0.27,y,1.5,h);g.fillRect(x+w*0.64,y,2,h);
    // crisp specular line along the very top edge
    g.fillStyle="rgba(255,255,255,.55)";g.fillRect(x+6,y+4,w-12,2);
    // soft edge darkening = glass thickness
    let ev=g.createLinearGradient(x,y,x+w,y);
    ev.addColorStop(0,"rgba(0,0,0,.14)");ev.addColorStop(0.5,"rgba(0,0,0,0)");ev.addColorStop(1,"rgba(0,0,0,.14)");
    g.fillStyle=ev;g.fillRect(x,y,w,h);
    // ① にじいろガラス: 虹色の帯がゆっくり流れる(source-overの低alphaなので白飛びしない)
    if(pane.rainbow){
      const RBF=["rgba(255,93,162,","rgba(255,210,63,","rgba(90,209,255,","rgba(123,224,138,","rgba(182,156,255,"];
      const bh=h/RBF.length,off=(tms*0.4)%bh;
      for(let i=0;i<RBF.length;i++){g.fillStyle=RBF[i]+"0.16)";g.fillRect(x,y+i*bh-off,w,bh*0.72);}
    }
    // ステンドグラス風の格子(gridシェイプのみ)
    if(pane.grid){
      g.strokeStyle="rgba(255,255,255,.22)";g.lineWidth=3;
      const gc=4,gr=5;
      for(let i=1;i<gc;i++){g.beginPath();g.moveTo(x+w*i/gc,y);g.lineTo(x+w*i/gc,y+h);g.stroke();}
      for(let j=1;j<gr;j++){g.beginPath();g.moveTo(x,y+h*j/gr);g.lineTo(x+w,y+h*j/gr);g.stroke();}
      // 格子マスをほんのり色付け
      for(let i=0;i<gc;i++)for(let j=0;j<gr;j++){if((i+j)%2===0){g.fillStyle=t.f+"0.16)";g.fillRect(x+w*i/gc,y+h*j/gr,w/gc,h/gr);}}
    }
    g.restore();
    }
    // cracks (animated grow + glow)
    // ⑦ bottle/vase/jarstackは実シルエットでクリップしてから描く(瓶の首の脇など透明な角へのヒビのはみ出しを防ぐ)
    g.save();
    if(pane.kind==="bottle"){bottlePath(x,y,w,h);g.clip();}
    else if(pane.kind==="vase"){vasePath(x,y,w,h);g.clip();}
    else if(pane.kind==="jarstack"){const jw=w*0.9,jx=x+(w-jw)/2;g.beginPath();g.rect(jx,y,jw,h);g.clip();}
    g.shadowColor=t.glow;g.shadowBlur=6;g.lineCap="round";
    for(const cr of pane.cracks){cr.t=Math.min(1,cr.t+0.25);const a=cr.t;
      g.strokeStyle="rgba(255,255,255,"+(0.85*a)+")";g.lineWidth=2;
      for(const ln of cr.lines){g.beginPath();g.moveTo(cr.x,cr.y);
        for(const s of ln.segs)g.lineTo(cr.x+(s.x-cr.x)*a,cr.y+(s.y-cr.y)*a);g.stroke();}
      g.fillStyle="rgba(255,255,255,"+(0.6*a)+")";g.beginPath();g.arc(cr.x,cr.y,3,0,TAU);g.fill();}
    g.restore();
    g.restore();
    // hits indicator (cute round pips above pane)
    const left=Math.max(0,pane.need-pane.hits),gap=pane.need>8?15:20,startx=pane.x+w/2-(pane.need-1)*gap/2,py=pane.y-22;
    g.save();
    for(let i=0;i<pane.need;i++){const px=startx+i*gap,alive=i<left;
      const pls=alive?1+0.12*Math.sin(tms*0.12+i):1;
      g.save();g.translate(px,py);g.scale(pls,pls);
      if(alive){g.shadowColor=t.glow;g.shadowBlur=8;g.fillStyle=t.e;}
      else{g.shadowBlur=0;g.fillStyle="rgba(255,255,255,.18)";}
      g.beginPath();g.arc(0,0,5,0,TAU);g.fill();
      if(alive){g.shadowBlur=0;g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(-1.4,-1.4,1.6,0,TAU);g.fill();}
      g.restore();}
    g.restore();
  }
  function roundRect(x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  // ⑦ 瓶(bottle)のシルエット: 首が細く、肩から胴が丸く広がる小物。tallステージにも合う縦長シルエット。
  function bottlePath(x,y,w,h){
    const cx=x+w/2,neckW=w*0.30,bodyW=w*0.92;
    const neckTop=y+h*0.02,neckBot=y+h*0.22,shoulderY=y+h*0.38,bottomY=y+h*0.98,rB=Math.min(bodyW,h)*0.06;
    g.beginPath();
    g.moveTo(cx-neckW/2,neckTop);g.lineTo(cx+neckW/2,neckTop);g.lineTo(cx+neckW/2,neckBot);
    g.bezierCurveTo(cx+neckW/2,shoulderY-h*0.04,cx+bodyW/2,shoulderY,cx+bodyW/2,shoulderY+h*0.06);
    g.lineTo(cx+bodyW/2,bottomY-rB);
    g.quadraticCurveTo(cx+bodyW/2,bottomY,cx+bodyW/2-rB,bottomY);
    g.lineTo(cx-bodyW/2+rB,bottomY);
    g.quadraticCurveTo(cx-bodyW/2,bottomY,cx-bodyW/2,bottomY-rB);
    g.lineTo(cx-bodyW/2,shoulderY+h*0.06);
    g.bezierCurveTo(cx-bodyW/2,shoulderY,cx-neckW/2,shoulderY-h*0.04,cx-neckW/2,neckBot);
    g.closePath();
  }
  // ⑦ 壺(vase)のシルエット: 上下が細く胴が丸く張り出す。round系ステージに合わせた丸み担当。
  function vasePath(x,y,w,h){
    const cx=x+w/2,topW=w*0.36,midW=w*0.98,botW=w*0.52;
    const topY=y+h*0.04,midY=y+h*0.52,botY=y+h*0.96;
    g.beginPath();
    g.moveTo(cx-topW/2,topY);
    g.bezierCurveTo(cx-midW/2,y+h*0.18,cx-midW/2,midY-h*0.1,cx-midW/2,midY);
    g.bezierCurveTo(cx-midW/2,midY+h*0.24,cx-botW/2,botY-h*0.08,cx-botW/2,botY);
    g.lineTo(cx+botW/2,botY);
    g.bezierCurveTo(cx+botW/2,botY-h*0.08,cx+midW/2,midY+h*0.24,cx+midW/2,midY);
    g.bezierCurveTo(cx+midW/2,midY-h*0.1,cx+midW/2,y+h*0.18,cx+topW/2,topY);
    g.closePath();
  }
  // ⑦ bottle/vase 共通の描画(枠+グロー+ガラス胴+ハイライト)。板ガラスと同じ「背景から浮く」見た目を保つ。
  function drawShapeBody(pathFn,x,y,w,h,t){
    const cx=x+w/2,cy=y+h/2;
    // outer glow
    g.save();g.shadowColor=t.glow;g.shadowBlur=22;g.fillStyle="rgba(0,0,0,0.001)";
    pathFn(x,y,w,h);g.fill();g.restore();
    // metallic frame (少し大きい同じシルエットを下敷きにして縁取りにする)
    g.save();g.translate(cx,cy);g.scale(1.08,1.08);g.translate(-cx,-cy);
    let fr=g.createLinearGradient(x,y,x,y+h);
    fr.addColorStop(0,"#737f93");fr.addColorStop(0.5,"#4c5668");fr.addColorStop(1,"#39414f");
    g.fillStyle=fr;pathFn(x,y,w,h);g.fill();
    g.restore();
    // glass body
    let gb=g.createLinearGradient(x,y,x,y+h);
    gb.addColorStop(0,t.f+"0.42)");gb.addColorStop(0.5,t.f+"0.26)");gb.addColorStop(1,t.f+"0.40)");
    g.fillStyle=gb;pathFn(x,y,w,h);g.fill();
    // rim glow
    g.save();g.strokeStyle=t.e;g.lineWidth=2.5;g.shadowColor=t.glow;g.shadowBlur=12;
    pathFn(x,y,w,h);g.stroke();g.restore();
    // clipped sheen + edge darkening (板ガラスと同じ質感の簡易版)
    g.save();pathFn(x,y,w,h);g.clip();
    g.fillStyle="rgba(255,255,255,.18)";
    g.beginPath();g.moveTo(x,y+h*0.2);g.lineTo(x+w*0.4,y);g.lineTo(x+w*0.55,y);g.lineTo(x,y+h*0.45);g.closePath();g.fill();
    g.fillStyle="rgba(255,255,255,.5)";g.fillRect(x+w*0.14,y+h*0.06,Math.max(0,w*0.08),h*0.5);
    let ev=g.createLinearGradient(x,y,x+w,y);
    ev.addColorStop(0,"rgba(0,0,0,.14)");ev.addColorStop(0.5,"rgba(0,0,0,0)");ev.addColorStop(1,"rgba(0,0,0,.14)");
    g.fillStyle=ev;g.fillRect(x,y,w,h);
    g.restore();
  }
  // ⑦ jarstack: 丸い瓶を3段重ね。hammer.jsのtower(hp)と同じ思想で1段ずつ崩れ落ちる(下から積み上がり、上から崩れる)
  function drawJarstack(x,y,w,h,t){
    const segs=3,gap=h*0.05,segH=Math.max(1,(h-gap*(segs-1))/segs),jw=w*0.9,jx=x+(w-jw)/2;
    const fallen=pane.jarsFallen||0,remaining=segs-fallen;
    const jpath=(ix,iy,iw,ih)=>roundRect(ix,iy,iw,ih,Math.min(iw,ih)*0.24);
    for(let i=0;i<segs;i++){
      if(i>=remaining)continue; // 崩れた上段はもう描かない
      const sy=y+h-(i+1)*segH-i*gap;
      g.save();g.shadowColor=t.glow;g.shadowBlur=16;g.fillStyle="rgba(0,0,0,0.001)";jpath(jx-6,sy-6,jw+12,segH+12);g.fill();g.restore();
      let fr=g.createLinearGradient(jx,sy,jx,sy+segH);
      fr.addColorStop(0,"#737f93");fr.addColorStop(1,"#39414f");
      g.fillStyle=fr;jpath(jx-4,sy-4,jw+8,segH+8);g.fill();
      let gb=g.createLinearGradient(jx,sy,jx,sy+segH);
      gb.addColorStop(0,t.f+"0.42)");gb.addColorStop(1,t.f+"0.28)");
      g.fillStyle=gb;jpath(jx,sy,jw,segH);g.fill();
      g.save();g.strokeStyle=t.e;g.lineWidth=2;g.shadowColor=t.glow;g.shadowBlur=8;jpath(jx,sy,jw,segH);g.stroke();g.restore();
      g.save();jpath(jx,sy,jw,segH);g.clip();
      g.fillStyle="rgba(255,255,255,.2)";g.fillRect(jx+jw*0.1,sy+segH*0.08,Math.max(0,jw*0.14),Math.max(0,segH*0.7));
      g.restore();
    }
  }
}
Engine.register("glass", buildGlass);
