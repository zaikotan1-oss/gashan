function buildMeteor(api){
  const g=api.g;
  // 画像アセット(無ければ従来の手描きにフォールバック)。いんせき/木は生成が不良続き(風景ごと描かれる)なので手描きのまま
  api.preload(["bg.jpg","ufo.png"]);
  let objs=[],meteors=[],craters=[],rings=[],fire=[],shards=[],dust=[],floats=[],sparks=[],embers=[],motes=[],ufos=[];
  let groundY,slotW,count,combo,comboT,flash,stars,tnow=0,colorWash=0,washHue=0,scorePop=0,bestCombo=0,hitStopT=-999;
  let stage,wave,meteorSp,clearT,clearStars,clearName,banner,banT,ufoT,finalDone,stageBest;
  const BCOL=["#e0563a","#3a8ee6","#f5c518","#9b6bff","#ff8c42","#e85d9a"];
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  let luckyColor,luckySeen,luckyMsgT,rbMsgT,perfMsgT,stageWasted,moonWink;  // ②ラッキー色 ①にじいろ ③パーフェクト ④月ひみつ
  const moonHit={x:0,y:0,r:0};   // ④ 月ひみつタップの当たり判定(描画と一致)
  const COLNAME={"#e0563a":"あか","#3a8ee6":"あお","#f5c518":"きいろ","#9b6bff":"むらさき","#ff8c42":"オレンジ","#e85d9a":"ピンク"};
  // each stage shifts the sky/ground palette so it never looks the same
  const SKIES=[
    {top:"#0e1530",mid:"#2a2a52",bot:"#7a4f72",g0:"#6a5238",g1:"#3e2e1e",name:"よぞらの"},
    {top:"#13243a",mid:"#1f5a6e",bot:"#5fb0a0",g0:"#4a6a4a",g1:"#243e24",name:"うみべの"},
    {top:"#2a1030",mid:"#6a2a52",bot:"#e0905a",g0:"#7a5238",g1:"#4e2e1e",name:"ゆうやけの"},
    {top:"#101a14",mid:"#1f4a2e",bot:"#7ad08a",g0:"#3a5a38",g1:"#1e3a1e",name:"みどりの"},
    {top:"#1a1020",mid:"#3a1f5a",bot:"#9b6bff",g0:"#4a3a6a",g1:"#241e3e",name:"まほうの"},
    {top:"#301010",mid:"#6e1f1f",bot:"#ff6b4a",g0:"#6a3838",g1:"#3e1e1e",name:"かざんの"}
  ];
  const MAXSTAGE=6;
  function skyOf(){return SKIES[(stage-1)%SKIES.length];}
  function layout(){
    groundY=api.H*0.8;
    // more buildings each stage (street gets busier) ※7〜8歳向けに少し増量
    const base=clamp(Math.round(api.W/80),8,13);
    const n=clamp(base+(stage-1),8,16);slotW=api.W/n;
    // ④ 月ひみつタップの当たり判定(frame内の月の描画位置 mx,my,mr と一致させる)
    moonHit.x=api.W*0.84;moonHit.y=groundY*0.2;moonHit.r=Math.min(api.W,api.H)*0.06;
    if(!objs.length){for(let i=0;i<n;i++)objs.push(mkObj(i));}
    else objs.forEach((o,i)=>{o.x=(i+0.5)*slotW;});
  }
  function mkObj(i){
    // 壊す的の種類を増やす: 四角(building)・丸(tree)だけでなく丸い岩(rock)・横長の乗り物(car)も混ぜる(軸7対策)
    const roll=Math.random();
    const kind=roll<0.28?"tree":roll<0.4?"rock":roll<0.48?"car":"building";
    // ① にじいろビル: 低確率(約5%)の激レア。虹色にきらめくので気づける=ドキドキ発見。壊すと大量得点＋虹の爆発。
    const rainbow=kind==="building"&&Math.random()<0.05;
    // from stage 2 some buildings are reinforced (need 2 meteors) -> mannerism breaker (7〜8歳向けに1面早く・少し多め)
    const reinforced=kind==="building"&&!rainbow&&stage>=2&&Math.random()<Math.min(0.4,0.14+stage*0.05);
    // ⑤ たまに(約15%)ふつうよりずっと大きい「ランドマークビル」を混ぜて大小の差をはっきりさせる(軸7対策)
    const landmark=kind==="building"&&!rainbow&&!reinforced&&Math.random()<0.15;
    let w,h,color;
    if(kind==="tree"){w=slotW*0.5;h=rnd(api.H*0.08,api.H*0.13);color="#3a8e4a";}
    else if(kind==="rock"){w=rnd(slotW*0.4,slotW*0.6);h=w;color="#8a7d6e";}
    else if(kind==="car"){w=slotW*0.62;h=rnd(api.H*0.045,api.H*0.06);color=pick(BCOL);}
    else{w=slotW*0.66;h=landmark?rnd(api.H*0.3,api.H*0.42):rnd(api.H*0.1,api.H*0.2);
      color=rainbow?"#ff5da2":(reinforced?"#8a93a8":pick(BCOL));}
    return{x:(i+0.5)*slotW,type:kind,
      w:w,h:h,
      color:color,hp:reinforced?2:1,reinf:reinforced,rainbow:rainbow,
      state:"stand",vx:0,vy:0,rot:0,vr:0,respawnT:0,seed:rint(0,999)};
  }
  function standCount(){let c=0;for(const o of objs)if(o.state==="stand"||o.state==="rise")c++;return c;}
  function mkStars(){stars=[];for(let i=0;i<46;i++)stars.push({x:Math.random(),y:Math.random()*0.78,r:rnd(0.6,1.8),tw:rnd(0,TAU),sp:rnd(1.2,3),col:Math.random()<0.18?"#bcd0ff":"#fff"});}
  function mkMotes(){motes=[];for(let i=0;i<22;i++)motes.push({x:Math.random(),y:Math.random(),r:rnd(1.4,4),ph:rnd(0,TAU),sp:rnd(0.012,0.03),drift:rnd(0.1,0.4),col:pick(["#ffd27a","#ffb24a","#bcd0ff","#ff7ac0"])});}
  function reset(){objs=[];meteors=[];craters=[];rings=[];fire=[];shards=[];dust=[];floats=[];sparks=[];embers=[];ufos=[];count=0;combo=0;comboT=0;flash=0;colorWash=0;scorePop=0;bestCombo=0;
    stage=1;wave=0;meteorSp=14;clearT=0;clearStars=0;clearName="";banner="";banT=0;ufoT=rnd(180,320);finalDone=false;stageBest=0;
    luckyColor=pick(BCOL);luckySeen=false;luckyMsgT=0;rbMsgT=0;perfMsgT=0;stageWasted=0;moonWink=0;
    mkStars();mkMotes();layout();
    banner=skyOf().name+"まちを ぜんぶ こわせ！";banT=2.2;}
  // begin a fresh street for the current stage
  function startStage(){
    stageBest=0;stageWasted=0;   // ③ パーフェクト判定: この街で「1発も外さず(空振り無し)」を数え直す
    meteorSp=clamp(14+stage*1.7,15,27); // meteors fall a touch faster each stage (7〜8歳向けに少し速め)
    objs=[];ufos=[];meteors=[];layout();
    banner=skyOf().name+"まちを ぜんぶ こわせ！";banT=2.2;
    api.slide(330,560,0.22,0.16,"triangle");api.tone(740,0.12,"sine",0.12);
  }
  // a UFO slowly crosses the sky; hit it for a bonus blast
  function spawnUfo(){const dir=Math.random()<0.5?1:-1;
    ufos.push({x:dir<0?api.W+50:-50,y:groundY*rnd(0.18,0.4),dir,vx:dir*rnd(1.4,2.3),r:clamp(api.W*0.045,22,34),bob:rnd(0,TAU),hp:1});}
  function drop(tx){
    // 終盤(残り2体以下)は着弾点を最寄りの残存オブジェクトへ寄せる。ランダムタップでも当たりやすくし、
    // 無反応時間(maxQuietSec)が終盤の低命中率で跳ね上がるのを防ぐ(軸3対策)。狙って外すのは通常どおり自由。
    if(standCount()<=2){
      let best=null,bd=Infinity;
      for(const o of objs){if(o.state!=="stand")continue;
        const d=Math.abs(o.x-tx);if(d<bd){bd=d;best=o;}}
      if(best&&bd<=slotW*4)tx=best.x;
    }
    const ty=groundY-4;
    meteors.push({x:tx-api.H*0.5,y:-60,tx,ty,r:clamp(api.W*0.04,18,30),life:1,trail:0});
    api.slide(700,200,0.5,0.18,"sawtooth");
  }
  function impact(x){
    flash=Math.max(flash,0.55);
    api.slide(150,38,0.7,0.7,"sine");api.noise(0.6,0.55,650,"lowpass");api.tone(rnd(880,1100),0.12,"triangle",0.12);api.shake(28);api.boom(0.7);
    rings.push({x,y:groundY,r:10,max:slotW*2.8,life:1});
    rings.push({x,y:groundY,r:6,max:slotW*1.7,life:1,glow:true});
    // 軸6対策: 乱打すると白い輪が上限なく積み重なり、的や地面が見えなくなる不具合が実機で確認された。
    // 直近8個だけ残す(演出は保ったまま、画面が輪だらけで埋まるのを防ぐ)
    if(rings.length>8)rings.splice(0,rings.length-8);
    craters.push({x,y:groundY,r:rnd(slotW*0.4,slotW*0.7),life:1});
    for(let i=0;i<26;i++){const a=rnd(-Math.PI,0),s=rnd(3,12);
      fire.push({x,y:groundY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(4,11),life:1,decay:rnd(0.015,0.03),col:pick(["#ffd23f","#ff8c2c","#ff5b2c","#fff2a0"])});}
    for(let i=0;i<18;i++){const a=rnd(-Math.PI,0),s=rnd(7,17);
      sparks.push({x,y:groundY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,18),life:1,decay:rnd(0.03,0.06),col:pick(["#fff2a0","#ffd23f","#fff"])});}
    for(let i=0;i<8;i++)dust.push({x:x+rnd(-slotW,slotW),y:groundY,r:rnd(slotW*0.3,slotW*0.6),vr:rnd(1,2.5),vx:rnd(-4,4),life:1,decay:rnd(0.01,0.02)});
    const R=slotW*1.8;let hitCount=0;
    for(const o of objs){if(o.state!=="stand")continue;
      const d=Math.abs(o.x-x);
      if(d<=R){const dir=o.x>=x?1:-1;
        if(o.hp>1){ // reinforced: first hit only cracks it (push-back, not topple)
          o.hp--;o.flash=1;o.color="#b06a5a";
          api.tone(220,0.1,"square",0.18);
          for(let k=rint(2,4);k>0;k--)shards.push({x:o.x+rnd(-o.w/2,o.w/2),y:groundY-rnd(0,o.h),vx:dir*rnd(2,6),vy:rnd(-7,-2),s:rnd(o.w*0.12,o.w*0.24),color:"#9aa3b8",rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.01,0.018),pts:chunkPts()});
          floats.push({x:o.x,y:groundY-o.h-10,txt:"がんじょう！",life:1,vy:-0.9,col:"#cfe0ff",size:24});
          continue;
        }
        o.state="fly";
        // 壊れ方を種類ごとに変える(軸7対策): rockはその場で低く弾む丸い瓦礫、carは横滑りしてスピンしながら消える
        if(o.type==="rock"){o.vx=dir*rnd(2,5)*(1-d/R*0.5);o.vy=-rnd(2,4);o.vr=dir*rnd(0.3,0.6);}
        else if(o.type==="car"){o.vx=dir*rnd(9,15);o.vy=rnd(-2,0.5);o.vr=dir*rnd(0.8,1.4);}
        else{o.vx=dir*rnd(4,10)*(1-d/R*0.5)+rnd(-1,1);o.vy=-rnd(5,11);o.vr=dir*rnd(0.2,0.5);}
        o.flash=1;
        count++;hitCount++;
        if(o.type==="rock"){
          for(let k=rint(6,9);k>0;k--)shards.push({x:o.x+rnd(-o.w/2,o.w/2),y:groundY-rnd(0,o.h),vx:dir*rnd(1,5),vy:rnd(-6,-1),s:rnd(o.w*0.12,o.w*0.26),color:shade(o.color,rnd(-0.2,0.15)),rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.008,0.014),round:true});
        }else{
          for(let k=rint(5,8);k>0;k--)shards.push({x:o.x+rnd(-o.w/2,o.w/2),y:groundY-rnd(0,o.h),vx:dir*rnd(2,8),vy:rnd(-9,-2),s:rnd(o.w*0.16,o.w*0.34),color:o.color,rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.008,0.014),pts:chunkPts()});
        }
        // ① にじいろビル撃破: 追加+5(合計6点)＋虹の大爆発
        if(o.rainbow){count+=5;rainbowBurst(o.x);}
        // ② きょうのラッキー色: 秘密の1色のビルを壊すと +1 ＋ 頭上に星のキラッ(気づけるヒント)
        else if(o.type==="building"&&o.color===luckyColor){
          count++;luckyBurst(o.x,groundY-o.h-6);
          if(!luckySeen){luckyMsgT=1.9;luckySeen=true;}else{luckyMsgT=Math.max(luckyMsgT,0.7);}
        }
      }
    }
    // UFO hit -> bonus blast + extra shards
    for(const u of ufos){if(u.hp<=0)continue;
      if(Math.hypot(u.x-x,u.y-groundY)<R*1.3||Math.abs(u.x-x)<u.r*2.2){u.hp=0;u.boom=1;
        count+=3;hitCount++;colorWash=1;washHue=18;api.shake(34);api.boom(0.5);api.slide(900,120,0.35,0.4,"sawtooth");
        for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(4,12);
          sparks.push({x:u.x,y:u.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,18),life:1,decay:rnd(0.03,0.05),col:pick(["#7affd2","#fff2a0","#fff"])});}
        floats.push({x:u.x,y:u.y-30,txt:"ボーナス！",life:1,vy:-1.2,col:"#7affd2",size:38});}
    }
    // コンボは命中した時だけ伸ばす(空振りでx2等が出ていた実装ミスの修正・軸2/軸3対策)
    if(hitCount>0){combo++;comboT=1;}
    // ③ パーフェクト判定: 何も壊せなかった空振りを1回でもしたら パーフェクトは消える
    if(hitCount===0&&clearT<=0)stageWasted++;
    // hitStop is reserved for standout moments only (multi-destroy, or first impact
    // after a quiet spell) -- spamming it every impact freezes the whole game
    // (節目限定 + 前回から30f以上あける)
    if(hitCount>0&&tnow-hitStopT>30){api.hitStop(hitCount>=4?6:4);hitStopT=tnow;}
    api.setScore(count);scorePop=1;
    if(combo>bestCombo)bestCombo=combo;
    if(combo>stageBest)stageBest=combo;
    if(hitCount>=4){colorWash=1;washHue=hitCount>=6?28:48;api.shake(38);}
    if(hitCount>=3)floats.push({x,y:groundY-100,txt:hitCount+"はかい！",life:1,vy:-1.1,col:hitCount>=6?"#ff3b3b":"#ff8c42",size:hitCount>=6?46:34});
    else if(combo>1)floats.push({x,y:groundY-100,txt:"x"+combo,life:1,vy:-1.1,col:combo>=5?"#ff8c42":"#ffd23f",size:32});
    // stage clear: every building/tree toppled
    if(clearT<=0&&standCount()===0)clearStage();
  }
  // ① にじいろビル撃破の大盤振る舞い(虹の輪＋七色の火花)。派手だが加算は既存の flash/colorWash を使い上限で抑える=白飛びしない。
  function rainbowBurst(x){
    rbMsgT=1.4;colorWash=Math.min(1,colorWash+0.55);washHue=(tnow*3)%360;
    flash=Math.max(flash,0.5);api.boom(0.7);api.shake(22);
    if(tnow-hitStopT>30){api.hitStop(5);hitStopT=tnow;}
    api.slide(660,1320,0.5,0.2,"triangle");api.tone(880,0.14,"triangle",0.12);api.tone(1320,0.16,"triangle",0.1);
    for(let i=0;i<3;i++)rings.push({x,y:groundY,r:12,max:slotW*(2.2+i*0.8),life:1,glow:i===1});
    if(rings.length>8)rings.splice(0,rings.length-8);
    for(let i=0;i<30;i++){const a=rnd(-Math.PI,0),s=rnd(4,14);
      sparks.push({x,y:groundY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(10,20),life:1,decay:rnd(0.02,0.04),
        col:pick(["#ff5da2","#5ad1ff","#ffd23f","#7be08a","#9b6bff","#ff8c42"])});}
    for(let i=0;i<12;i++){const a=rnd(-Math.PI,0),s=rnd(3,10);
      fire.push({x,y:groundY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(4,10),life:1,decay:rnd(0.015,0.03),
        col:pick(["#ff5da2","#5ad1ff","#ffd23f","#7be08a","#9b6bff"])});}
    floats.push({x,y:groundY-120,txt:"にじいろ！",life:1,vy:-1.1,col:"#ff5da2",size:44});
  }
  // ② ラッキー色命中: 頭上に小さな星のキラッ(白飛びしないよう控えめ)
  function luckyBurst(x,y){
    api.tone(1046,0.12,"triangle",0.1);api.tone(1568,0.14,"triangle",0.08);
    for(let i=0;i<7;i++){const a=rnd(0,TAU),s=rnd(2,5);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,len:rnd(5,10),life:1,decay:rnd(0.03,0.05),col:i%2?luckyColor:"#fff7cf"});}
  }
  function clearStage(){
    // star rating from this street's best combo
    clearStars=stageBest>=6?3:stageBest>=3?2:1;
    clearName=skyOf().name+"まち クリア！";clearT=2.6;
    flash=Math.max(flash,0.7);colorWash=1;washHue=48;
    api.shake(30);api.boom(0.6);api.slide(440,880,0.4,0.3,"triangle");api.tone(660,0.18,"sine",0.18);
    // ③ パーフェクト ボーナス: この街を1発も空振りせず壊し切ったら +3 ＆ みどりの祝福(気づくと得する頭を使う仕掛け)
    if(stageWasted===0){count+=3;api.setScore(count);perfMsgT=2;api.tone(1318,0.16,"triangle",0.1);api.tone(1976,0.18,"triangle",0.07);
      for(let i=0;i<16;i++){const a=rnd(-Math.PI,0),s=rnd(4,11);
        sparks.push({x:api.W/2+rnd(-api.W*0.25,api.W*0.25),y:groundY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,14),life:1,decay:rnd(0.02,0.04),col:pick(["#7be08a","#c7ffcf","#ffd23f"])});}}
    // confetti burst from the ground
    for(let i=0;i<24;i++){const a=rnd(-Math.PI,0),s=rnd(5,13);
      sparks.push({x:api.W/2+rnd(-api.W*0.3,api.W*0.3),y:groundY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,16),life:1,decay:rnd(0.02,0.04),col:pick(["#ffd23f","#7affd2","#ff7ac0","#fff2a0","#9b6bff"])});}
    if(stage>=MAXSTAGE&&!finalDone){finalDone=true;banner="ぜんぶ クリア！すごい！";banT=3.4;
      for(let i=0;i<40;i++){const a=rnd(-Math.PI,0),s=rnd(6,16);
        fire.push({x:api.W/2,y:groundY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(5,12),life:1,decay:rnd(0.01,0.022),col:pick(["#ffd23f","#ff8c2c","#7affd2","#ff7ac0","#fff2a0"])});}
      api.boom(0.7);}
  }
  reset();
  return{
    resize:layout,
    input(px,py,type){
      if(type!=="down")return;
      // ④ ひみつ: おそらの お月さまをタップすると ウインク＋きらめき(減点なし・いんせきは落とさない)
      if(moonHit.r>0&&Math.hypot(px-moonHit.x,py-moonHit.y)<moonHit.r*1.15){
        moonWink=1;api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.08);
        for(let i=0;i<9;i++){const a=rnd(0,TAU),s=rnd(2,6);
          sparks.push({x:moonHit.x,y:moonHit.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(6,12),life:1,decay:rnd(0.03,0.05),col:pick(["#fdf3cf","#ffd27a","#fff"])});}
        return;
      }
      drop(clamp(px,slotW*0.5,api.W-slotW*0.5));
    },
    frame(dt,now){
      tnow+=dt;
      // sky (palette shifts per stage)
      const SK=skyOf();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景(1面=よぞら はそのまま)。2面以降はステージの空色を薄く重ねて面ごとの雰囲気を変える
        const si=(stage-1)%SKIES.length;
        if(si!==0){g.save();g.globalAlpha=0.3;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,SK.top);tg.addColorStop(0.4,SK.mid);tg.addColorStop(0.78,SK.bot);tg.addColorStop(1,SK.g1);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        let grd=g.createLinearGradient(0,0,0,groundY);
        grd.addColorStop(0,SK.top);grd.addColorStop(0.45,SK.mid);grd.addColorStop(1,SK.bot);
        g.fillStyle=grd;g.fillRect(0,0,api.W,groundY);
        // nebula glow ※画像背景のときは絵に星雲があるので描かない
        g.globalCompositeOperation="lighter";
        let neb=g.createRadialGradient(api.W*0.72,groundY*0.32,0,api.W*0.72,groundY*0.32,api.W*0.45);
        neb.addColorStop(0,"rgba(120,80,180,.28)");neb.addColorStop(1,"rgba(120,80,180,0)");
        g.fillStyle=neb;g.fillRect(0,0,api.W,groundY);
        let neb2=g.createRadialGradient(api.W*0.2,groundY*0.55,0,api.W*0.2,groundY*0.55,api.W*0.4);
        neb2.addColorStop(0,"rgba(60,120,170,.2)");neb2.addColorStop(1,"rgba(60,120,170,0)");
        g.fillStyle=neb2;g.fillRect(0,0,api.W,groundY);
        g.globalCompositeOperation="source-over";
      }
      // moon
      const mx=api.W*0.84,my=groundY*0.2,mr=Math.min(api.W,api.H)*0.06;
      let mg=g.createRadialGradient(mx,my,mr*0.6,mx,my,mr*2.4);
      mg.addColorStop(0,"rgba(255,245,210,.5)");mg.addColorStop(1,"rgba(255,245,210,0)");
      g.fillStyle=mg;g.beginPath();g.arc(mx,my,mr*2.4,0,TAU);g.fill();
      g.fillStyle="#fdf3cf";g.beginPath();g.arc(mx,my,mr,0,TAU);g.fill();
      g.fillStyle="rgba(210,190,150,.4)";g.beginPath();g.arc(mx+mr*0.3,my-mr*0.2,mr*0.22,0,TAU);g.fill();
      g.beginPath();g.arc(mx-mr*0.25,my+mr*0.3,mr*0.15,0,TAU);g.fill();
      // ④ 月ひみつタップ: 叩かれた瞬間だけ ^_^ のウインク顔(発見のごほうび・加算なし)
      if(moonWink>0){g.save();g.globalAlpha=clamp(moonWink*1.4,0,1);
        g.strokeStyle="#b8a878";g.lineWidth=Math.max(2,mr*0.12);g.lineCap="round";
        // 左目=ウインク(への字)、右目=ぱっちり、下に にっこり
        g.beginPath();g.moveTo(mx-mr*0.5,my-mr*0.02);g.quadraticCurveTo(mx-mr*0.34,my-mr*0.3,mx-mr*0.18,my-mr*0.02);g.stroke();
        g.fillStyle="#b8a878";g.beginPath();g.arc(mx+mr*0.34,my-mr*0.08,mr*0.09,0,TAU);g.fill();
        g.beginPath();g.arc(mx,my+mr*0.2,mr*0.34,0.12*Math.PI,0.88*Math.PI);g.stroke();
        g.restore();g.globalAlpha=1;}
      // twinkling stars ※画像背景のときは絵の星があるので描かない
      if(!imgBg) for(const s of stars){const tw=0.4+0.6*Math.abs(Math.sin(tnow*0.04*s.sp+s.tw));
        g.globalAlpha=tw;g.fillStyle=s.col;g.beginPath();g.arc(s.x*api.W,s.y*groundY,s.r,0,TAU);g.fill();}
      g.globalAlpha=1;
      // drifting glow motes (ambient)
      g.globalCompositeOperation="lighter";
      for(const m of motes){const fl=0.35+0.45*Math.sin(tnow*m.sp+m.ph);
        const mx2=(m.x+Math.sin(tnow*0.01*m.drift+m.ph)*0.04)*api.W;
        const my2=(m.y*0.72+0.04)*groundY+Math.cos(tnow*0.012*m.drift)*8;
        g.globalAlpha=Math.max(0,fl)*0.5;g.fillStyle=m.col;g.shadowColor=m.col;g.shadowBlur=8;
        g.beginPath();g.arc(mx2,my2,m.r,0,TAU);g.fill();}
      g.shadowBlur=0;g.globalCompositeOperation="source-over";g.globalAlpha=1;
      // ground ※画像背景のときは絵の地面を活かし、境目の薄い影だけ落として物が「立っている」線を作る
      if(!imgBg){
        let gg=g.createLinearGradient(0,groundY,0,api.H);gg.addColorStop(0,SK.g0);gg.addColorStop(1,SK.g1);
        g.fillStyle=gg;g.fillRect(0,groundY,api.W,api.H-groundY);
        g.fillStyle="#7a5e40";g.fillRect(0,groundY,api.W,4);
        g.fillStyle="rgba(255,225,170,.25)";g.fillRect(0,groundY,api.W,2);
      } else {
        let gs=g.createLinearGradient(0,groundY-6,0,groundY+10);
        gs.addColorStop(0,"rgba(0,0,0,0)");gs.addColorStop(0.4,"rgba(0,0,0,.28)");gs.addColorStop(1,"rgba(0,0,0,0)");
        g.fillStyle=gs;g.fillRect(0,groundY-6,api.W,16);
      }
      // craters
      for(const c of craters){c.life-=0.003*dt;g.globalAlpha=Math.max(0,c.life)*0.8;
        g.fillStyle="#2a1c12";g.beginPath();g.ellipse(c.x,c.y+4,c.r,c.r*0.4,0,0,TAU);g.fill();
        g.fillStyle="#1a120a";g.beginPath();g.ellipse(c.x,c.y+4,c.r*0.6,c.r*0.24,0,0,TAU);g.fill();}
      g.globalAlpha=1;craters=craters.filter(c=>c.life>0);
      // decay hit-flash
      for(const o of objs){if(o.flash)o.flash=Math.max(0,o.flash-0.08*dt);}
      // rising-in objects (new street appears); gone objects stay gone until next stage
      for(const o of objs){if(o.state==="rise"){o.rise=Math.min(1,(o.rise||0)+0.05*dt);if(o.rise>=1)o.state="stand";}}
      // stage-clear timer -> build the next, harder street
      if(clearT>0){clearT-=0.016*dt;
        if(clearT<=0){stage=stage<MAXSTAGE?stage+1:1;wave++;combo=0;comboT=0;
          for(const o of objs){o.flash=0;}startStage();for(const o of objs){o.state="rise";o.rise=0;}}}
      // UFO spawner (skip during clear)
      if(clearT<=0&&stage>=2){ufoT-=dt;if(ufoT<=0&&ufos.length<1){spawnUfo();ufoT=rnd(280,520);}}
      // objects physics
      for(const o of objs){if(o.state==="fly"){o.vy+=0.5*dt;o.x+=o.vx*dt;o.y=(o.y||0)+o.vy*dt;o.rot+=o.vr*dt;
        if(groundY-o.h+o.y>api.H+40){o.state="gone";o.respawnT=rnd(30,70);o.y=0;}}}
      // draw objects (standing/rising)
      for(const o of objs)drawObj(o);
      // UFOs cross the sky (variety target)
      for(const u of ufos){if(u.hp>0){u.x+=u.vx*dt;u.bob+=0.06*dt;}else{u.boom=(u.boom||0)-0.06*dt;}
        drawUfo(u);}
      ufos=ufos.filter(u=>(u.hp>0&&u.x>-80&&u.x<api.W+80)||(u.boom||0)>0);
      // dust
      for(const d of dust){d.r+=d.vr*dt;d.x+=d.vx*dt;d.y-=0.4*dt;d.life-=d.decay*dt;g.globalAlpha=Math.max(0,d.life)*0.5;
        g.fillStyle="#caa";g.beginPath();g.arc(d.x,d.y,d.r,0,TAU);g.fill();}
      g.globalAlpha=1;dust=dust.filter(d=>d.life>0);
      // meteors
      for(const m of meteors){const dx=m.tx-m.x,dy=m.ty-m.y,d=Math.hypot(dx,dy);
        const sp=meteorSp;m.x+=dx/d*sp*dt;m.y+=dy/d*sp*dt;m.trail+=dt;
        if(Math.random()<0.8)fire.push({x:m.x+rnd(-4,4),y:m.y+rnd(-4,4),vx:rnd(-1,1),vy:rnd(-1,0),r:rnd(4,9),life:0.6,decay:0.04,col:pick(["#ff8c2c","#ffd23f","#ff5b2c"])});
        if(d<sp*dt+6){impact(m.tx);m.life=0;}
        if(m.life>0)drawMeteor(m);
      }
      meteors=meteors.filter(m=>m.life>0);
      // fire particles (additive glow)
      g.globalCompositeOperation="lighter";
      for(const f of fire){f.vy+=0.18*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.life-=f.decay*dt;
        const fr=f.r*Math.max(0.2,f.life);
        g.globalAlpha=Math.max(0,f.life);g.shadowColor=f.col;g.shadowBlur=fr*1.5;
        g.fillStyle=f.col;g.beginPath();g.arc(f.x,f.y,fr,0,TAU);g.fill();}
      g.shadowBlur=0;g.globalCompositeOperation="source-over";g.globalAlpha=1;fire=fire.filter(f=>f.life>0);
      // sparks (additive streaks)
      g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const p of sparks){p.vy+=0.4*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=p.decay*dt;
        const sp=Math.hypot(p.vx,p.vy)||1,nx=p.vx/sp,ny=p.vy/sp;
        g.globalAlpha=Math.max(0,p.life);g.strokeStyle=p.col;g.lineWidth=2;
        g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x-nx*p.len,p.y-ny*p.len);g.stroke();
        if(p.y>groundY){p.life-=0.2*dt;}}
      g.globalCompositeOperation="source-over";g.globalAlpha=1;sparks=sparks.filter(p=>p.life>0);
      // rising embers
      if(Math.random()<0.5)embers.push({x:rnd(0,api.W),y:groundY-rnd(0,api.H*0.1),vy:rnd(-0.5,-1.4),vx:rnd(-0.3,0.3),r:rnd(0.8,2),life:1,decay:rnd(0.004,0.01),col:pick(["#ffb24a","#ffd23f"])});
      g.globalCompositeOperation="lighter";
      for(const e of embers){e.y+=e.vy*dt;e.x+=e.vx*dt;e.life-=e.decay*dt;
        g.globalAlpha=Math.max(0,e.life)*0.7;g.fillStyle=e.col;g.beginPath();g.arc(e.x,e.y,e.r,0,TAU);g.fill();}
      g.globalCompositeOperation="source-over";g.globalAlpha=1;embers=embers.filter(e=>e.life>0&&e.y>-10);
      // rings
      for(const r of rings){r.r+=(r.max-r.r)*0.2*dt;r.life-=0.05*dt;
        if(r.glow){g.globalCompositeOperation="lighter";g.globalAlpha=Math.max(0,r.life)*0.5;
          g.strokeStyle="#ffd27a";g.lineWidth=10;g.shadowColor="#ffb24a";g.shadowBlur=20;
          g.beginPath();g.ellipse(r.x,r.y,r.r,r.r*0.35,0,0,TAU);g.stroke();
          g.shadowBlur=0;g.globalCompositeOperation="source-over";}
        else{g.globalAlpha=Math.max(0,r.life)*0.7;g.strokeStyle="#fff";g.lineWidth=5;
          g.beginPath();g.ellipse(r.x,r.y,r.r,r.r*0.35,0,0,TAU);g.stroke();}}
      g.globalAlpha=1;rings=rings.filter(r=>r.life>0);
      // shards
      for(const p of shards){p.vy+=0.5*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
        if(p.y>groundY-2){p.y=groundY-2;p.vy*=-0.4;p.vx*=0.7;if(Math.abs(p.vy)<1.2)p.life-=0.04*dt;}
        p.life-=p.decay*dt;g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);drawChunk(p);g.restore();}
      shards=shards.filter(p=>p.life>0);
      // flash
      if(flash>0){g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(255,200,120,"+flash*0.35+")";g.fillRect(0,0,api.W,api.H);
        g.globalCompositeOperation="source-over";flash-=0.05*dt;}
      // climax color wash (big hits)
      if(colorWash>0){g.globalCompositeOperation="lighter";
        const cw=g.createRadialGradient(api.W/2,groundY,0,api.W/2,groundY,api.W*0.85);
        cw.addColorStop(0,"hsla("+washHue+",100%,62%,"+colorWash*0.4+")");
        cw.addColorStop(1,"hsla("+washHue+",100%,55%,0)");
        g.fillStyle=cw;g.fillRect(0,0,api.W,api.H);
        g.globalCompositeOperation="source-over";colorWash-=0.025*dt;}
      // combo decay + floats
      if(combo>0){comboT-=0.012*dt;if(comboT<=0)combo=0;}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.014*dt;g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,f.x,f.y);g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // cute HUD
      if(scorePop>0)scorePop=Math.max(0,scorePop-0.06*dt);
      if(banT>0)banT-=0.016*dt;
      // 隠し発見バナー/演出のタイマー減衰
      if(rbMsgT>0){rbMsgT-=0.016*dt;if(rbMsgT<0)rbMsgT=0;}
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;if(luckyMsgT<0)luckyMsgT=0;}
      if(perfMsgT>0){perfMsgT-=0.014*dt;if(perfMsgT<0)perfMsgT=0;}
      if(moonWink>0){moonWink-=0.02*dt;if(moonWink<0)moonWink=0;}
      drawHUD();
    }
  };
  function rrect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  // irregular angular debris chunk (not a plain square)
  function chunkPts(){const n=rint(4,5),a=[];for(let i=0;i<n;i++){const ang=i/n*TAU+rnd(-0.35,0.35),rr=rnd(0.34,0.55);a.push([Math.cos(ang)*rr,Math.sin(ang)*rr]);}return a;}
  function drawChunk(p){const s=Math.max(0,p.s);
    if(p.round){ // rockの瓦礫は角ばった破片でなく丸い石ころにする(壊れ方の違いを見せる=軸7対策)
      g.beginPath();g.arc(0,0,s*0.5,0,TAU);g.closePath();
      g.fillStyle=p.color;g.fill();
      g.save();g.clip();g.fillStyle="rgba(0,0,0,.28)";g.beginPath();g.arc(s*0.16,s*0.16,s*0.4,0,TAU);g.fill();g.restore();
      g.lineWidth=Math.max(1,s*0.08);g.strokeStyle="rgba(255,255,255,.4)";g.stroke();return;}
    const pts=p.pts;
    g.beginPath();g.moveTo(pts[0][0]*s,pts[0][1]*s);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0]*s,pts[i][1]*s);g.closePath();
    g.fillStyle=p.color;g.fill();
    // lower-right facet shade for chunky 3D feel
    g.save();g.clip();g.fillStyle="rgba(0,0,0,.28)";g.beginPath();g.moveTo(0,-s);g.lineTo(s,s);g.lineTo(-s,s);g.closePath();g.fill();g.restore();
    // bright top edge
    g.lineWidth=Math.max(1,s*0.08);g.strokeStyle="rgba(255,255,255,.45)";g.stroke();}
  function measW(txt,fallbackFs){
    const m=g.measureText?g.measureText(txt):null;
    if(m&&typeof m.width==="number"&&isFinite(m.width))return m.width;
    return txt.length*fallbackFs*0.6;
  }
  function drawHUD(){
    g.textAlign="left";g.textBaseline="alphabetic";
    const pad=Math.max(10,api.W*0.02);
    // --- bottom hint pill ---
    const hfs=clamp(api.W*0.04,16,22);
    g.font="800 "+hfs+"px 'Hiragino Maru Gothic ProN',system-ui";
    const ht="タップした ばしょに いんせき おとし！",htw=measW(ht,hfs);
    const hw=htw+hfs*2,hh=hfs*2,hx=api.W/2-hw/2,hy=api.H-hh-hfs*0.6;
    g.globalAlpha=0.85+0.15*Math.sin(tnow*0.05);
    g.fillStyle="rgba(40,30,70,.55)";rrect(hx,hy,hw,hh,hh*0.5);g.fill();
    g.lineWidth=2;g.strokeStyle="rgba(255,210,140,.55)";rrect(hx,hy,hw,hh,hh*0.5);g.stroke();
    g.textAlign="center";g.fillStyle="#fff7e6";g.fillText(ht,api.W/2,hy+hh*0.5+hfs*0.36);
    g.globalAlpha=1;g.textAlign="left";
    // --- stage badge (top-CENTER = engine HUDと衝突しない安全帯) ---
    const sfs=clamp(api.W*0.04,16,24);
    g.font="800 "+sfs+"px 'Hiragino Maru Gothic ProN',system-ui";
    const stxt="ステージ "+stage,sw=measW(stxt,sfs)+sfs*1.4,sh=sfs*1.7,sx=api.W/2-sw/2;
    g.fillStyle="rgba(40,30,70,.55)";rrect(sx,pad,sw,sh,sh*0.4);g.fill();
    g.lineWidth=2;g.strokeStyle="rgba(255,210,140,.5)";rrect(sx,pad,sw,sh,sh*0.4);g.stroke();
    g.textAlign="center";g.fillStyle="#fff7e6";g.fillText(stxt,api.W/2,pad+sh*0.5+sfs*0.36);g.textAlign="left";
    // best combo (centered, just below the stage badge) only once it matters
    if(bestCombo>=2){const cfs=clamp(api.W*0.035,14,20);
      g.font="800 "+cfs+"px 'Hiragino Maru Gothic ProN',system-ui";
      const ct="さいこう x"+bestCombo,cy=pad+sh+cfs+2;
      g.textAlign="center";g.fillStyle="#ffd27a";g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.4)";
      g.strokeText(ct,api.W/2,cy);g.fillText(ct,api.W/2,cy);g.textAlign="left";}
    // --- stage-start / final banner ---
    if(banT>0&&banner){const a=Math.min(1,banT*1.6);const bfs=clamp(api.W*0.06,26,46);
      g.globalAlpha=a;g.font="900 "+bfs+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
      // 軸6対策: engine.js の祝福バナー(_fx.bann, 固定で api.H*0.3 に描画)と帯が重なって
      // 文字が判読不能に混ざる不具合が実機で確認された。ステージ開始バナーは
      // 「ステージN」バッジのすぐ下・0.3H帯より十分上の空きエリアへ上げて衝突を避ける。
      const by=groundY*0.18-Math.max(0,(1-banT)*20);
      g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(banner,api.W/2,by);
      g.fillStyle="#fff2a0";g.fillText(banner,api.W/2,by);g.globalAlpha=1;g.textAlign="left";}
    // --- stage clear panel with stars ---
    if(clearT>0){const a=Math.min(1,clearT*1.4);g.globalAlpha=a;
      const cfs=clamp(api.W*0.07,30,54);g.font="900 "+cfs+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
      // 同じ理由でクリア見出しも 0.3H帯を避けて上寄りに置く(星の並びは見出しの下、engine帯の外に収まる)
      const cy=groundY*0.22;
      g.lineWidth=9;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(clearName,api.W/2,cy);
      g.fillStyle="#fff2a0";g.fillText(clearName,api.W/2,cy);
      // three stars, lit by rating
      const sr=clamp(api.W*0.035,16,28),gap=sr*2.6;
      for(let i=0;i<3;i++){const sx=api.W/2+(i-1)*gap,syy=cy+sr*2.4;
        const lit=i<clearStars;const pop=lit?1+0.12*Math.sin(tnow*0.2+i):1;
        drawStar(sx,syy,sr*pop,lit);}
      g.globalAlpha=1;g.textAlign="left";}
    // ① にじいろビル！ 発見バナー(虹色に色替わり=激レアの大きな祝福・中央上=HUD安全帯)
    if(rbMsgT>0){const pop=1+Math.max(0,rbMsgT-1)*1.3,col=["#ff5da2","#ffd23f","#5ad1ff","#7be08a","#9b6bff"][Math.floor(tnow*0.15)%5];
      g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
      g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 "+clamp(api.W*0.07,30,48)+"px 'Hiragino Maru Gothic ProN',system-ui";
      g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("にじいろビル！",0,0);
      g.fillStyle=col;g.fillText("にじいろビル！",0,0);
      g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";}
    // ② きょうのラッキー色 ヒント(初回だけ大きく・以降は小さく)
    if(luckyMsgT>0){g.save();g.translate(api.W/2,api.H*0.28);g.textAlign="center";g.textBaseline="middle";
      g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 "+clamp(api.W*0.038,18,26)+"px 'Hiragino Maru Gothic ProN',system-ui";
      const t2="きょうのラッキー色は "+(COLNAME[luckyColor]||"")+"！";
      g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(t2,0,0);
      g.fillStyle=luckyColor;g.fillText(t2,0,0);
      g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";}
    // ③ パーフェクト！ ボーナス(クリア文字と重ねない下側)
    if(perfMsgT>0){const pop=1+Math.max(0,perfMsgT-1.3)*1.3;
      g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
      g.globalAlpha=clamp(perfMsgT*1.3,0,1);g.font="900 "+clamp(api.W*0.055,26,38)+"px 'Hiragino Maru Gothic ProN',system-ui";
      g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("パーフェクト！＋3",0,0);
      g.fillStyle="#c7ffcf";g.fillText("パーフェクト！＋3",0,0);
      g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";}
  }
  function drawStar(cx,cy,r,lit){
    g.save();g.translate(cx,cy);g.beginPath();
    for(let i=0;i<10;i++){const ang=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.45:r;
      const px=Math.cos(ang)*rr,py=Math.sin(ang)*rr;i?g.lineTo(px,py):g.moveTo(px,py);}
    g.closePath();
    if(lit){g.shadowColor="#ffd23f";g.shadowBlur=14;g.fillStyle="#ffd23f";}else{g.fillStyle="rgba(120,120,140,.6)";}
    g.fill();g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="rgba(0,0,0,.4)";g.stroke();g.restore();
  }
  function drawObj(o){
    let yo=0,a=1;
    if(o.state==="rise"){yo=(1-o.rise)*o.h;a=o.rise;}
    if(o.state==="gone")return;
    g.save();
    if(o.state==="fly"){g.translate(o.x,groundY-o.h*0.5+(o.y||0));g.rotate(o.rot);g.translate(-o.x,-(groundY-o.h*0.5));}
    g.globalAlpha=a;
    if(o.type==="tree"){
      const cx=o.x,cy=groundY-o.h*0.55+yo,cr=o.w*0.5;
      g.fillStyle="#6a4a2a";g.fillRect(o.x-o.w*0.12,groundY-o.h*0.5+yo,o.w*0.24,o.h*0.5);
      const tg=g.createRadialGradient(cx-cr*0.35,cy-cr*0.35,cr*0.2,cx,cy,cr);
      const dark=shade(o.color,-0.35);
      tg.addColorStop(0,shade(o.color,0.25));tg.addColorStop(1,dark);
      g.fillStyle=tg;g.beginPath();g.arc(cx,cy,cr,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.22)";g.beginPath();g.arc(cx-cr*0.3,cy-cr*0.3,cr*0.3,0,TAU);g.fill();
    }else if(o.rainbow){
      // ① にじいろビル: 七色の帯がゆっくり流れてきらめく(source-over のみ=白飛びしない)。目立つので気づける。
      const x=o.x-o.w/2,y=groundY-o.h+yo,bands=6;
      g.fillStyle="rgba(0,0,0,.25)";g.fillRect(x+3,y+3,o.w,o.h);
      for(let bi=0;bi<bands;bi++){const hue=((bi/bands+tnow*0.008)%1*360)|0;
        g.fillStyle="hsl("+hue+",82%,60%)";g.fillRect(x,y+o.h*bi/bands,o.w,o.h/bands+1);}
      g.fillStyle="rgba(255,255,255,.28)";g.fillRect(x,y,o.w*0.28,o.h);
      g.fillStyle="rgba(255,255,255,.6)";g.fillRect(x,y,o.w,2);
      // ちらちら光る枠(気づきヒント)
      g.strokeStyle="hsla("+((tnow*3)%360|0)+",90%,72%,.95)";g.lineWidth=3;g.strokeRect(x-1.5,y-1.5,o.w+3,o.h+3);
      // lit windows(いつものビルと同じ位置)
      const rows=Math.max(1,Math.floor(o.h/20));
      for(let r=0;r<rows;r++)for(let c=0;c<3;c++){const lit=(o.seed>>((r*3+c)%16))&1;
        g.fillStyle=lit?"rgba(255,255,255,.85)":"rgba(0,0,0,.22)";
        g.fillRect(x+o.w*(0.15+c*0.28),y+8+r*20,o.w*0.16,10);}
    }else if(o.type==="rock"){
      // 丸い岩: ビル/木と違う形・違う質感で見た目のバラエティを出す(軸7対策)
      const cx=o.x,cy=groundY-o.h*0.5+yo,cr=Math.max(0,o.w*0.5);
      g.fillStyle="rgba(0,0,0,.22)";g.beginPath();g.ellipse(cx,groundY-1+yo,cr,cr*0.3,0,0,TAU);g.fill();
      const rg=g.createRadialGradient(cx-cr*0.3,cy-cr*0.3,Math.max(0,cr*0.15),cx,cy,cr);
      rg.addColorStop(0,shade(o.color,0.3));rg.addColorStop(1,shade(o.color,-0.35));
      g.fillStyle=rg;g.beginPath();g.arc(cx,cy,cr,0,TAU);g.fill();
      g.fillStyle="rgba(0,0,0,.18)";g.beginPath();g.arc(cx-cr*0.18,cy+cr*0.3,cr*0.26,0,TAU);g.fill();
      g.beginPath();g.arc(cx+cr*0.28,cy-cr*0.05,cr*0.16,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.22)";g.beginPath();g.arc(cx-cr*0.32,cy-cr*0.32,cr*0.22,0,TAU);g.fill();
    }else if(o.type==="car"){
      // 横長のシルエット: ビル/木/岩と違う形。当たるとその場で横滑りして消える(軸7対策)
      const x=o.x-o.w/2,y=groundY-o.h+yo,by=y+o.h;
      g.fillStyle="rgba(0,0,0,.22)";g.beginPath();g.ellipse(o.x,groundY-1+yo,o.w*0.55,o.h*0.3,0,0,TAU);g.fill();
      const cg=g.createLinearGradient(x,y,x+o.w,y);
      cg.addColorStop(0,shade(o.color,0.18));cg.addColorStop(0.5,o.color);cg.addColorStop(1,shade(o.color,-0.3));
      g.fillStyle=cg;rrect(x,y,o.w,o.h,Math.max(0,o.h*0.4));g.fill();
      g.fillStyle="rgba(190,225,255,.6)";rrect(x+o.w*0.2,y-o.h*0.5,o.w*0.45,o.h*0.55,Math.max(0,o.h*0.18));g.fill();
      g.fillStyle="rgba(255,255,255,.4)";g.fillRect(x,y,o.w,2);
      g.fillStyle="#2a2a2a";
      g.beginPath();g.arc(x+o.w*0.22,by,Math.max(0,o.h*0.32),0,TAU);g.fill();
      g.beginPath();g.arc(x+o.w*0.78,by,Math.max(0,o.h*0.32),0,TAU);g.fill();
      g.fillStyle="#6a6a6a";
      g.beginPath();g.arc(x+o.w*0.22,by,Math.max(0,o.h*0.14),0,TAU);g.fill();
      g.beginPath();g.arc(x+o.w*0.78,by,Math.max(0,o.h*0.14),0,TAU);g.fill();
    }else{
      const x=o.x-o.w/2,y=groundY-o.h+yo;
      g.fillStyle="rgba(0,0,0,.25)";g.fillRect(x+3,y+3,o.w,o.h);
      const bg=g.createLinearGradient(x,y,x+o.w,y);
      bg.addColorStop(0,shade(o.color,0.18));bg.addColorStop(0.5,o.color);bg.addColorStop(1,shade(o.color,-0.3));
      g.fillStyle=bg;g.fillRect(x,y,o.w,o.h);
      g.fillStyle="rgba(255,255,255,.22)";g.fillRect(x,y,o.w*0.28,o.h);
      g.fillStyle="rgba(255,255,255,.5)";g.fillRect(x,y,o.w,2);
      const rows=Math.max(1,Math.floor(o.h/20));
      for(let r=0;r<rows;r++)for(let c=0;c<3;c++){const lit=(o.seed>>((r*3+c)%16))&1;
        if(lit){g.shadowColor="rgba(255,220,120,.9)";g.shadowBlur=5;g.fillStyle="rgba(255,236,150,.9)";}
        else{g.shadowBlur=0;g.fillStyle="rgba(0,0,0,.28)";}
        g.fillRect(x+o.w*(0.15+c*0.28),y+8+r*20,o.w*0.16,10);}
      g.shadowBlur=0;
    }
    if(o.flash){g.globalCompositeOperation="lighter";g.globalAlpha=a*o.flash*0.8;
      g.fillStyle="#fff";
      if(o.type==="tree"){g.beginPath();g.arc(o.x,groundY-o.h*0.55+yo,Math.max(0,o.w*0.5),0,TAU);g.fill();}
      else if(o.type==="rock"){g.beginPath();g.arc(o.x,groundY-o.h*0.5+yo,Math.max(0,o.w*0.5),0,TAU);g.fill();}
      else g.fillRect(o.x-o.w/2,groundY-o.h+yo,o.w,o.h);
      g.globalCompositeOperation="source-over";}
    g.globalAlpha=1;g.restore();
  }
  function shade(hex,f){
    const n=parseInt(hex.slice(1),16);let r=(n>>16)&255,gn=(n>>8)&255,b=n&255;
    if(f>=0){r+=(255-r)*f;gn+=(255-gn)*f;b+=(255-b)*f;}else{r*=1+f;gn*=1+f;b*=1+f;}
    return"rgb("+(r|0)+","+(gn|0)+","+(b|0)+")";
  }
  function drawUfo(u){
    const yy=u.y+Math.sin(u.bob)*6;
    if(u.hp<=0){ // pop flash
      g.globalCompositeOperation="lighter";g.globalAlpha=Math.max(0,u.boom||0);
      g.fillStyle="#7affd2";g.beginPath();g.arc(u.x,yy,u.r*1.8,0,TAU);g.fill();
      g.globalCompositeOperation="source-over";g.globalAlpha=1;return;
    }
    g.save();
    // glow under-beam
    g.globalCompositeOperation="lighter";
    const bm=g.createRadialGradient(u.x,yy,0,u.x,yy,u.r*2.2);
    bm.addColorStop(0,"rgba(120,255,210,.35)");bm.addColorStop(1,"rgba(120,255,210,0)");
    g.fillStyle=bm;g.beginPath();g.arc(u.x,yy,u.r*2.2,0,TAU);g.fill();
    g.globalCompositeOperation="source-over";
    // 画像UFO: 絵は正方形パディング済みで、円盤のふち(最も幅広い行)が画像高さの約62%・胴体は45〜71%にある。
    // 円盤幅≒画像幅なので 辺=r*2.4 とし、ふちの行が yy+0.1r に来るよう中心を yy-0.19r に置く(当たり判定 |dx|<r*2.2 と一致)。
    // 下向きの光は上で描いた。ライトの点滅だけ円盤の下に重ねる
    if(api.drawAsset("ufo.png",u.x,yy-u.r*0.19,u.r*2.4,u.r*2.4,{center:true,flip:u.dir<0})){
      g.fillStyle=(Math.floor(tnow*0.1))%2?"rgba(255,210,63,.75)":"rgba(122,255,210,.75)";
      g.beginPath();g.arc(u.x,yy+u.r*0.36,u.r*0.1,0,TAU);g.fill();
      g.restore();return;}
    // dome
    g.fillStyle="#bfeaff";g.beginPath();g.ellipse(u.x,yy-u.r*0.18,u.r*0.5,u.r*0.42,0,Math.PI,TAU);g.fill();
    // saucer body
    const bg=g.createLinearGradient(u.x-u.r,yy,u.x+u.r,yy);
    bg.addColorStop(0,"#5a6a80");bg.addColorStop(0.5,"#aeb8c8");bg.addColorStop(1,"#5a6a80");
    g.fillStyle=bg;g.beginPath();g.ellipse(u.x,yy,u.r,u.r*0.38,0,0,TAU);g.fill();
    // lights
    for(let i=-2;i<=2;i++){g.fillStyle=(Math.floor(tnow*0.1)+i)%2?"#ffd23f":"#ff7ac0";
      g.beginPath();g.arc(u.x+i*u.r*0.34,yy+u.r*0.18,u.r*0.09,0,TAU);g.fill();}
    g.restore();
  }
  function drawMeteor(m){
    // tail
    const dx=m.tx-m.x,dy=m.ty-m.y,d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d;
    g.globalCompositeOperation="lighter";
    const tg=g.createLinearGradient(m.x,m.y,m.x-nx*m.r*5,m.y-ny*m.r*5);
    tg.addColorStop(0,"rgba(255,220,120,.6)");tg.addColorStop(1,"rgba(255,120,40,0)");
    g.strokeStyle=tg;g.lineWidth=m.r*1.4;g.lineCap="round";
    g.beginPath();g.moveTo(m.x,m.y);g.lineTo(m.x-nx*m.r*5,m.y-ny*m.r*5);g.stroke();
    // outer glow
    const og=g.createRadialGradient(m.x,m.y,m.r*0.4,m.x,m.y,m.r*2.2);
    og.addColorStop(0,"rgba(255,180,80,.5)");og.addColorStop(1,"rgba(255,140,40,0)");
    g.fillStyle=og;g.beginPath();g.arc(m.x,m.y,m.r*2.2,0,TAU);g.fill();
    g.globalCompositeOperation="source-over";
    // いんせき本体は手描き(生成画像は風景ごと描かれ不良続きのため不採用)。尾と発光は上のcanvas描画
    const grd=g.createRadialGradient(m.x-m.r*0.3,m.y-m.r*0.3,m.r*0.15,m.x,m.y,m.r);
    grd.addColorStop(0,"#fffbe0");grd.addColorStop(0.45,"#ff8c2c");grd.addColorStop(1,"#7a2a1a");
    g.fillStyle=grd;g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();
  }
}
Engine.register("meteor", buildMeteor);
