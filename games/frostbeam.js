function build_frostbeam(api){
  const g=api.g;
  // 画像アセット(無ければ従来の手描きにフォールバック): 背景 + ゴールドスター + ジェム + おおきいこおりくん
  api.preload(["bg.jpg","gold.png","gem.png","bigice.png"]);
  // ===== all state lives here (build is called multiple times) =====
  let targets=[],shards=[],rings=[],sparks=[],snow=[],glints=[],beams=[],pops=[];
  let count=0,combo=0,comboT=0,tsec=0,spawnT=0,R=40,flash=0;
  // fever + rare-gold + hitstop cooldown state
  let fever=0,feverGauge=0,feverBann=0,hsCd=0;
  // stage progression (endless, never game-over)
  let stage=1,stageKill=0,stageGoal=8,clearT=0,clearStage=0;
  let firstSpawnDone=false;   // ① 最初の1体だけ大きく・中央近くに出し、開始10秒以内の最初の成功を確実にする
  const PREVIEWS=["おおきい こおりくん","きらきら ジェム","はやい こおりくん","ゴールドスター","オーロラの そら"];
  function nextPreview(s){return PREVIEWS[(s-2)%PREVIEWS.length];}
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  let luckyColor=pick(["#ff8aa8","#7be0a8","#ffd86b","#8ad4ff","#c79bff","#ff9b6b"]);
  let luckySeen=false,luckyMsgT=0;   // ② きょうのラッキー色: 秘密の1色。凍らせると頭上に星ヒント、砕くとボーナス
  let rbMsgT=0;                       // ① にじいろジェム 発見バナー
  let stageEscape=0,perfectT=0;      // ③ パーフェクトフリーズ: 逃がさず(ノーミスで)ステージ突破
  let sunWink=0;                      // ④ 太陽ひみつタップ
  const sunHit={x:0,y:0,r:0};        // ④ 太陽の当たり判定(描画と一致)
  const TCNAME={"#ff8aa8":"ピンク","#7be0a8":"みどり","#ffd86b":"きいろ","#8ad4ff":"みずいろ","#c79bff":"むらさき","#ff9b6b":"オレンジ"};
  function colName(c){return TCNAME[c]||"にじ";}
  // per-stage winter palettes
  const STAGE_BG=[
    {top:"#9fd4f0",mid:"#cfeaf7",lo:"#eef7fc",g1:"#dcefff",g2:"#bfe0f2"},
    {top:"#7fb8e8",mid:"#aed4f0",lo:"#dceefb",g1:"#cfe6fb",g2:"#a9cdec"},
    {top:"#6f8fd0",mid:"#9fb4e6",lo:"#cfdcf6",g1:"#c4d4f4",g2:"#9fb0e0"},
    {top:"#8a6fd0",mid:"#b89fe6",lo:"#e0d4f6",g1:"#d4c4f4",g2:"#b09fe0"},
    {top:"#3f5a9a",mid:"#6f8fd0",lo:"#aec4ec",g1:"#bcd0f4",g2:"#8fa6e0"}
  ];
  const TC=["#ff8aa8","#7be0a8","#ffd86b","#8ad4ff","#c79bff","#ff9b6b"];
  function curBg(){return STAGE_BG[(stage-1)%STAGE_BG.length];}
  function stageGoalFor(s){return 10+(s-1)*3;}   // 10,13,16,...（7〜8歳向けに手応えを増やした）
  // ambient
  let mounts=[],trees=[],orbs=[];
  function buildBg(){
    mounts=[
      {y:api.H*0.62,amp:api.H*0.10,wl:api.W*1.1,col:"#dcebf7",ph:0.4},
      {y:api.H*0.70,amp:api.H*0.08,wl:api.W*0.8,col:"#c4dcf0",ph:1.9}
    ];
    trees=[];const tn=7;
    for(let i=0;i<tn;i++)trees.push({x:api.W*((i+0.5)/tn)+rnd(-api.W*0.03,api.W*0.03),
      y:api.H*rnd(0.84,0.93),s:rnd(0.7,1.25)});
    orbs=[];for(let i=0;i<6;i++)orbs.push({x:rnd(0,api.W),y:rnd(api.H*0.18,api.H*0.8),
      r:rnd(2.5,5),ph:rnd(0,TAU),sp:rnd(0.004,0.01),amp:rnd(8,26),drift:rnd(0.02,0.06)});
    snow=[];for(let i=0;i<70;i++)snow.push({x:rnd(0,api.W),y:rnd(0,api.H),
      r:rnd(1.2,3.6),sp:rnd(0.4,1.4),sway:rnd(0,TAU),sa:rnd(0.01,0.03),a:rnd(0.4,0.9)});
  }
  function layout(){
    R=clamp(Math.min(api.W,api.H)*0.06,26,52);
    sunHit.x=api.W*0.74;sunHit.y=api.H*0.15;sunHit.r=Math.max(40,api.W*0.1); // ④ 太陽の当たり判定
    buildBg();
  }
  layout();
  // ----- spawn moving targets -----
  function pickType(){
    // ① にじいろジェム: ステージ2以降、ごくまれ(約3%)に出る激レア。いつ来るか分からない=ドキドキ発見。
    if(stage>=2&&Math.random()<0.03)return "rainbow";
    if(Math.random()<0.07)return "gold";   // rare golden star
    const bag=["star","star","heart","heart"];
    if(stage>=1)bag.push("big");
    if(stage>=2)bag.push("gem");
    return pick(bag);
  }
  function spawn(){
    if(targets.length>(fever>0?15:12))return;
    const isFirstEver=!firstSpawnDone;
    const type=isFirstEver?"star":pickType();
    const fromLeft=Math.random()<0.5;
    const y=isFirstEver?api.H*0.5:rnd(api.H*0.22,api.H*0.78);
    let sp=clamp(1.35+(stage-1)*0.3,1.35,4.0)*(fromLeft?1:-1);   // 7〜8歳向け: 少し速め
    let color=pick(TC),hp=1,rr=R;
    if(type==="big"){color="#8ad4ff";rr=R*1.4;hp=1;}
    else if(type==="gem"){color="#ffd86b";rr=R*0.9;}
    else if(type==="star"){rr=R*rnd(0.8,1.35);}   // ⑦ おなじ形でも大小差をつける(軸7)
    else if(type==="gold"){color="#ffd23f";rr=R*1.05;sp*=1.35;
      // announce the rare one: chime + sparkle burst at entry side
      api.tone(1568,0.14,"triangle",0.1);api.tone(2093,0.18,"triangle",0.07);
      const gx=fromLeft?rr:api.W-rr;
      for(let i=0;i<6;i++){const a=rnd(0,TAU),s=rnd(2,5);
        glints.push({x:gx,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.05,col:"#fff2a0"});}}
    else if(type==="rainbow"){color="#ff5b5b";rr=R*1.15;sp*=0.8;   // 激レア: 大きめ・ゆっくり出て捕まえやすい
      // にじいろの登場ファンファーレ(3音の上昇)＋虹のきらめき
      api.tone(1568,0.12,"triangle",0.08);api.tone(2093,0.14,"triangle",0.06);api.tone(2637,0.16,"triangle",0.05);
      const gx=fromLeft?rr:api.W-rr,RB=["#ff5b5b","#ffd23f","#7be08a","#4db8ff","#b58bff"];
      for(let i=0;i<10;i++){const a=rnd(0,TAU),s=rnd(2,6);
        glints.push({x:gx,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.05,col:pick(RB)});}}
    let startX=fromLeft?-rr:api.W+rr;
    if(isFirstEver){
      // 最初の1体は大きく・画面中央にほぼ静止気味で出す(=何をすればいいかが一目で分かる/最初の成功が早く来る)
      rr=R*2.6;sp*=0.02;startX=api.W*0.5;firstSpawnDone=true;
    }
    targets.push({x:startX,y,vx:sp,r:rr,type,color,
      frozen:false,freezeT:0,bob:rnd(0,TAU),spin:rnd(0,TAU),vs:rnd(-0.02,0.02),
      dead:false,wob:0,shapeVariant:rint(0,2)});   // ⑦ starの輪郭差(丸/横長/縦長)に使う
  }
  // ----- freeze a moving target -----
  function freeze(t,px,py){
    t.frozen=true;t.freezeT=1;t.vx*=0.0;t.frozenAge=0;
    // 1回目のタップで既に点が動く(2回目のshatterで大きい得点+演出が来る「2段階のご褒美」)
    count+=1;api.setScore(count);
    beams.push({x0:api.W/2,y0:-20,x1:t.x,y1:t.y,life:1});
    rings.push({x:t.x,y:t.y,r:t.r*0.5,vr:t.r*0.5,life:1,decay:0.06,col:"#bfeaff"});
    for(let i=0;i<8;i++){const a=rnd(0,TAU),s=rnd(2,5);
      glints.push({x:t.x,y:t.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.03,0.06),col:"#dff4ff"});}
    api.slide(900,1500,0.18,0.16,"sine");
    api.noise(0.12,0.12,3000,"highpass",2);
    api.tone(1320,0.1,"triangle",0.08);
    api.shake(3);
    flash=Math.min(1,flash+0.12);
  }
  // ----- shatter a frozen target (chain to nearby frozen) -----
  function shatter(t,depth){
    if(t.dead)return;
    t.dead=true;
    let gain=t.type==="rainbow"?8:t.type==="gold"?5:t.type==="gem"?3:t.type==="big"?2:1;
    // ② ラッキー色: 今日の秘密の色(ふつうの子/ハート)を砕くと +1 の隠しボーナス。気づくと得する。
    const isLucky=(t.type==="star"||t.type==="heart")&&t.color===luckyColor;
    if(isLucky){gain+=1;luckyMsgT=luckySeen?Math.max(luckyMsgT,0.7):1.6;luckySeen=true;}
    if(fever>0)gain*=2;   // fever = double score
    count+=gain;stageKill++;api.setScore(count);
    // ④ 壊れ方のバラエティ: big=重力優勢でドサッと崩れる / heart=砕ける直前に一瞬ふくらんで弾む
    const isBig=t.type==="big",isHeart=t.type==="heart";
    if(isHeart)pops.push({x:t.x,y:t.y,r:t.r,color:t.color,life:1,decay:0.07});
    // shards
    const burstLift=isBig?-0.5:-2;   // bigは初速の上向きを弱め、重い物がドサッと落ちる感じにする
    for(let i=shards.length>120?4:rint(7,11);i>0;i--){const a=rnd(0,TAU),s=rnd(2.5,7);
      shards.push({x:t.x,y:t.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s+burstLift,r:rnd(t.r*0.16,t.r*0.34),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.02),col:i%3===0?t.color:"#eaf7ff"});}
    if(isBig)api.tone(180,0.16,"sine",0.12);   // 低いトーンで「重い」を耳でも表す
    rings.push({x:t.x,y:t.y,r:t.r*0.6,vr:t.r*0.7,life:1,decay:0.055,col:"#ffffff"});
    rings.push({x:t.x,y:t.y,r:t.r*0.3,vr:t.r*0.5,life:1,decay:0.05,col:t.color});
    for(let i=0;i<rint(8,12);i++){const a=rnd(0,TAU),s=rnd(3,9);
      sparks.push({x:t.x,y:t.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,18),life:1,decay:rnd(0.05,0.09)});}
    // rare gold: rainbow burst + fanfare
    if(t.type==="gold"){
      const RB=["#ff5b5b","#ffb14d","#ffd23f","#7be08a","#4db8ff","#b58bff"];
      for(let i=shards.length>110?6:16;i>0;i--){const a=rnd(0,TAU),s=rnd(3,9);
        shards.push({x:t.x,y:t.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.018),col:pick(RB)});}
      rings.push({x:t.x,y:t.y,r:t.r*0.4,vr:t.r*1.1,life:1,decay:0.04,col:"#ffd23f"});
      flash=1;api.shake(10);
      [0,4,7,12].forEach((semi,i)=>setTimeout(()=>api.tone(659.25*Math.pow(2,semi/12),0.18,"triangle",0.12),i*70));
    }
    // ① にじいろジェム撃破: 虹の輪が広がる大盤振る舞い＋ファンファーレ＋大量得点(8)
    if(t.type==="rainbow"){
      rbMsgT=1.4;
      const RB=["#ff5b5b","#ffb14d","#ffd23f","#7be08a","#4db8ff","#b58bff"];
      for(let k=0;k<RB.length;k++)rings.push({x:t.x,y:t.y,r:t.r*0.4,vr:t.r*(0.6+k*0.14),life:1,decay:0.045,col:RB[k]});
      for(let i=shards.length>110?8:22;i>0;i--){const a=rnd(0,TAU),s=rnd(3,10);
        shards.push({x:t.x,y:t.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.018),col:pick(RB)});}
      flash=Math.min(1,flash+0.35);api.shake(12);
      if(hsCd<=0){api.hitStop(4);hsCd=30;}
      [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(659.25*Math.pow(2,semi/12),0.16,"triangle",0.12),i*70));
    }
    // ② ラッキー色命中: きらっと小さめの祝福(白飛びしないよう控えめ)
    if(isLucky){
      api.tone(1046,0.14,"triangle",0.1);api.tone(1568,0.16,"triangle",0.08);
      for(let i=0;i<8;i++){const a=rnd(0,TAU),s=rnd(2,5);
        glints.push({x:t.x,y:t.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,life:1,decay:0.025,col:luckyColor});}
    }
    combo++;comboT=1;
    flash=Math.min(1,flash+0.3);
    api.slide(380,140,0.14,0.3,"square");
    api.noise(0.14,0.2,2400,"highpass",1.5);
    api.tone(420*Math.pow(2,clamp(combo,0,10)/12),0.12,"triangle",0.12);
    api.shake(5+Math.min(combo,8));
    if(depth===0){api.boom(clamp(0.4+combo*0.03,0.4,0.7));
      // hitStop only on combo milestones / gold, with 30f cooldown
      if(hsCd<=0&&(combo>=4||t.type==="gold")){api.hitStop(3);hsCd=30;}}
    // fever gauge builds from every shatter (gold gives a big chunk)
    if(fever<=0)feverGauge=Math.min(1,feverGauge+(t.type==="gold"?0.35:0.09)+depth*0.02);
    // chain: nearby frozen targets also shatter
    const reach=t.r*2.6;
    for(const o of targets){
      if(o===t||o.dead||!o.frozen)continue;
      if(Math.hypot(o.x-t.x,o.y-t.y)<reach){
        beams.push({x0:t.x,y0:t.y,x1:o.x,y1:o.y,life:1});
        shatter(o,depth+1);
      }
    }
    if(depth===0){
      if(fever<=0&&feverGauge>=1)startFever();
      checkStage();
    }
  }
  // ----- AURORA FEVER: sky transforms, everything one-tap, double score -----
  function startFever(){
    fever=600;feverGauge=0;feverBann=1.5;flash=1;
    api.boom(0.85);api.shake(14);
    api.slide(392,1568,0.5,0.22,"sawtooth");
    [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(523.25*Math.pow(2,semi/12),0.16,"triangle",0.12),i*60));
    for(let i=0;i<3;i++)spawn();
    spawnT=10;
  }
  function checkStage(){
    if(stageKill<stageGoal||clearT>0)return;
    clearStage=stage;clearT=1.6;flash=Math.min(1,flash+0.5);
    api.boom(0.55);api.shake(12);
    api.slide(659,988,0.3,0.2,"triangle");api.tone(1318,0.3,"triangle",0.1);
    for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
      shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(TC)});}
    // ③ パーフェクトフリーズ ボーナス: このステージで1匹も逃がさなかったら +3 & 水色の星シャワー。
    if(stageEscape===0){count+=3;api.setScore(count);perfectT=1.9;api.tone(1760,0.16,"triangle",0.12);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(3,8);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(4,8),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:"#aef0ff"});}}
    stageEscape=0;
    stage++;stageGoal=stageGoalFor(stage);stageKill=0;buildBg();
  }
  // ===== main object =====
  return{
    resize:layout,
    input(x,y,type){
      if(type!=="down")return;
      if(clearT>0)return;
      // find topmost target under tap
      for(let i=targets.length-1;i>=0;i--){
        const t=targets[i];
        if(t.dead)continue;
        const hitR=t.frozen?t.r*1.6:t.r*1.15;   // 凍結中は再タップの当たりを広げ、狙った通り砕けるようにする
        if(Math.hypot(x-t.x,y-t.y)<hitR){
          if(t.frozen)shatter(t,0);
          else if(fever>0){t.frozen=true;t.freezeT=1;shatter(t,0);}   // fever: one tap!
          else freeze(t,x,y);
          return;
        }
      }
      // ④ 太陽ひみつタップ: 何にも当たらなかったタップが太陽に届いたら、ウインクしてキラキラをこぼす(減点なし)
      if(Math.hypot(x-sunHit.x,y-sunHit.y)<sunHit.r){
        sunWink=1;api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.08);
        for(let i=0;i<8;i++){const a=rnd(-TAU*0.5,0),s=rnd(2,6);
          glints.push({x:sunHit.x,y:sunHit.y,vx:Math.cos(a)*s*0.7,vy:Math.sin(a)*s,life:1,decay:0.02,col:"#ffe6a0"});}
        return;
      }
      // missed tap: small icy puff
      api.tone(700,0.05,"sine",0.07);
      for(let i=0;i<5;i++){const a=rnd(0,TAU),s=rnd(2,4);
        glints.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.06,col:"#cfeaff"});}
    },
    frame(dt,now){
      tsec+=0.016*dt;
      if(hsCd>0)hsCd-=dt;
      if(fever>0){fever-=dt;
        if(fever<=0){fever=0;flash=Math.min(1,flash+0.3);
          api.slide(880,220,0.4,0.15,"sine");}}
      // ----- background: winter sky gradient (画像背景があればそれを使い、平坦な手描き要素はスキップ) -----
      const bg=curBg();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージのパレット色を薄く重ねて面ごとの雰囲気を変える(1面=昼の雪原はそのまま)
        const pi=(stage-1)%STAGE_BG.length;
        if(pi!==0){g.save();g.globalAlpha=0.28;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,bg.top);tg.addColorStop(0.5,bg.mid);tg.addColorStop(1,bg.g2);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,bg.top);grd.addColorStop(0.4,bg.mid);grd.addColorStop(0.7,bg.lo);
        grd.addColorStop(0.72,bg.g1);grd.addColorStop(1,bg.g2);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // pale sun halo
      const sx=api.W*0.74,sy=api.H*0.15;
      let sun=g.createRadialGradient(sx,sy,0,sx,sy,api.W*0.4);
      sun.addColorStop(0,"rgba(255,255,255,.55)");sun.addColorStop(0.3,"rgba(230,245,255,.22)");sun.addColorStop(1,"rgba(230,245,255,0)");
      g.fillStyle=sun;g.fillRect(0,0,api.W,api.H);
      // pale sun disk (so the secret-tap target is visible)
      g.save();g.shadowColor="rgba(230,245,255,.9)";g.shadowBlur=24;
      g.fillStyle="rgba(255,255,255,.85)";g.beginPath();g.arc(sx,sy,api.W*0.05,0,TAU);g.fill();g.restore();
      // ④ 太陽ひみつタップ: 叩かれた瞬間だけ ^_^ のウインク顔(発見のごほうび)
      if(sunWink>0){sunWink-=0.018*dt;const sr=api.W*0.05;
        g.save();g.strokeStyle="#7fb0d8";g.lineWidth=Math.max(2,sr*0.13);g.lineCap="round";g.globalAlpha=clamp(sunWink*1.4,0,1);
        g.beginPath();
        g.moveTo(sx-sr*0.44,sy-sr*0.02);g.quadraticCurveTo(sx-sr*0.29,sy-sr*0.3,sx-sr*0.14,sy-sr*0.02);
        g.moveTo(sx+sr*0.14,sy-sr*0.02);g.quadraticCurveTo(sx+sr*0.29,sy-sr*0.3,sx+sr*0.44,sy-sr*0.02);
        g.stroke();
        g.beginPath();g.arc(sx,sy+sr*0.14,sr*0.34,0.12*Math.PI,0.88*Math.PI);g.stroke();
        g.restore();g.globalAlpha=1;if(sunWink<0)sunWink=0;}
      // ----- AURORA FEVER sky: darken + waving rainbow curtains -----
      if(fever>0){
        const fa=clamp(fever/60,0,1);   // fade out during last second
        g.fillStyle="rgba(15,25,70,"+(0.35*fa).toFixed(3)+")";g.fillRect(0,0,api.W,api.H);
        g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
        for(let b=0;b<3;b++){
          const hue=Math.floor((tsec*60+b*110)%360);
          g.strokeStyle="hsla("+hue+",85%,70%,"+(0.22*fa).toFixed(3)+")";
          g.lineWidth=api.H*0.055;
          g.beginPath();
          for(let x=0;x<=api.W;x+=32){
            const yy=api.H*(0.14+b*0.09)+Math.sin(x*0.006+tsec*(1.5+b*0.5)+b*2.1)*api.H*0.045;
            if(x===0)g.moveTo(x,yy);else g.lineTo(x,yy);
          }
          g.stroke();
        }
        g.restore();
      }
      // snowy mountains (parallax) ※画像背景のときは絵の山を活かして描かない
      if(!imgBg) for(const m of mounts){
        g.fillStyle=m.col;g.beginPath();g.moveTo(0,api.H);
        for(let x=0;x<=api.W;x+=24){
          const yy=m.y+Math.sin(x/m.wl*TAU+m.ph)*m.amp;
          g.lineTo(x,yy);
        }
        g.lineTo(api.W,api.H);g.closePath();g.fill();
      }
      // snowy ground sheen line ※画像背景のときは不要
      if(!imgBg){
        let gl=g.createLinearGradient(0,api.H*0.72,0,api.H);
        gl.addColorStop(0,"rgba(255,255,255,.35)");gl.addColorStop(1,"rgba(255,255,255,0)");
        g.fillStyle=gl;g.fillRect(0,api.H*0.72,api.W,api.H*0.28);
      }
      // little pine trees along base ※画像背景のときは絵の木と喧嘩するので描かない
      if(!imgBg) for(const tr of trees){
        g.save();g.translate(tr.x,tr.y);g.scale(tr.s,tr.s);
        const ts=R*0.9;
        g.fillStyle="#6b4a2e";g.fillRect(-ts*0.08,0,ts*0.16,ts*0.3);
        g.fillStyle="#2f7a52";
        for(let k=0;k<3;k++){const ky=-k*ts*0.32,kw=ts*(0.5-k*0.12);
          g.beginPath();g.moveTo(0,ky-ts*0.5);g.lineTo(kw,ky);g.lineTo(-kw,ky);g.closePath();g.fill();}
        g.fillStyle="rgba(255,255,255,.85)";
        for(let k=0;k<3;k++){const ky=-k*ts*0.32,kw=ts*(0.5-k*0.12);
          g.beginPath();g.moveTo(0,ky-ts*0.5);g.lineTo(kw*0.4,ky-ts*0.2);g.lineTo(-kw*0.4,ky-ts*0.2);g.closePath();g.fill();}
        g.restore();
      }
      // floating glow orbs (additive)
      g.save();g.globalCompositeOperation="lighter";
      for(const o of orbs){
        o.ph+=o.sp*dt;o.x+=o.drift*dt;if(o.x>api.W+10)o.x=-10;
        const oy=o.y+Math.sin(o.ph)*o.amp, pr=0.6+Math.sin(o.ph*1.7)*0.4;
        const og=g.createRadialGradient(o.x,oy,0,o.x,oy,o.r*5);
        og.addColorStop(0,"rgba(210,240,255,"+(0.5*pr)+")");og.addColorStop(1,"rgba(210,240,255,0)");
        g.fillStyle=og;g.beginPath();g.arc(o.x,oy,o.r*5,0,TAU);g.fill();
        g.fillStyle="rgba(245,252,255,"+(0.8*pr)+")";g.beginPath();g.arc(o.x,oy,o.r,0,TAU);g.fill();
      }
      g.restore();g.globalAlpha=1;
      // ----- spawn loop -----
      if(clearT<=0){spawnT-=dt;if(spawnT<=0){spawn();spawnT=clamp(64-(stage-1)*8,30,64);}}   // 7〜8歳向け: 出現を2割速く
      // ----- update + draw targets -----
      for(const t of targets){
        if(t.dead)continue;
        if(!t.frozen){
          t.x+=t.vx*dt;
          t.bob+=0.06*dt;t.spin+=t.vs*dt;
          // wrap off-screen movers (no game over). ③ 逃がしたら記録(パーフェクト判定用)
          if(t.vx>0&&t.x>api.W+t.r*1.5){t.dead=true;stageEscape++;}
          if(t.vx<0&&t.x<-t.r*1.5){t.dead=true;stageEscape++;}
        }else{
          if(t.freezeT<1)t.freezeT=Math.min(1,t.freezeT+0.12*dt);
          t.wob=Math.sin(tsec*8)*0.02;
          // 保険: 2回目のタップを外し続けても無得点区間が伸びすぎないよう約3.3秒で自動的に砕ける
          t.frozenAge=(t.frozenAge||0)+dt;
          if(t.frozenAge>200){shatter(t,0);continue;}
        }
        const yb=t.frozen?t.y:t.y+Math.sin(t.bob)*t.r*0.12;
        drawTarget(t,t.x,yb);
      }
      targets=targets.filter(t=>!t.dead);
      // ① にじいろ接近の予告: レアがまだ画面ふち(入ってくる途中)なら そのふちに虹のシェブロン=「次くるかも」
      const rbApp=targets.find(t=>!t.dead&&t.type==="rainbow"&&(t.x<t.r||t.x>api.W-t.r));
      if(rbApp){
        const fromLeftSide=rbApp.vx>0,dir=fromLeftSide?1:-1;
        const ex=fromLeftSide?16:api.W-16,yy=clamp(rbApp.y,api.H*0.2,api.H*0.9);
        const pulse=0.5+0.5*Math.sin(tsec*6);
        g.save();g.globalAlpha=0.5+0.4*pulse;g.lineWidth=5;g.lineCap="round";g.lineJoin="round";
        for(let k=0;k<3;k++){g.strokeStyle=["#ff5b5b","#ffd23f","#4db8ff"][k];const ox=ex+dir*k*13;
          g.beginPath();g.moveTo(ox-dir*12,yy-16);g.lineTo(ox,yy);g.lineTo(ox-dir*12,yy+16);g.stroke();}
        g.restore();g.globalAlpha=1;
      }
      // ----- freeze beams (icy lines from top) -----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const b of beams){
        b.life-=0.12*dt;
        g.globalAlpha=Math.max(0,b.life)*0.8;
        g.strokeStyle="#cdeeff";g.lineWidth=3+b.life*4;
        g.shadowColor="#9fd8ff";g.shadowBlur=12*b.life;
        g.beginPath();g.moveTo(b.x0,b.y0);g.lineTo(b.x1,b.y1);g.stroke();
      }
      g.shadowBlur=0;g.restore();g.globalAlpha=1;
      beams=beams.filter(b=>b.life>0);
      // ----- shockwave rings -----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=2.5+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);
      // ----- glint sparks (additive lines) -----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#eaf7ff";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;
      sparks=sparks.filter(sp=>sp.life>0);
      // ----- ice shards -----
      for(const s of shards){s.vy+=0.32*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.rot+=s.vr*dt;s.life-=s.decay*dt;
        g.save();g.globalAlpha=Math.max(0,s.life);g.translate(s.x,s.y);g.rotate(s.rot);
        g.fillStyle=s.col;g.shadowColor="#cfeaff";g.shadowBlur=6;
        drawDiamond(s.r*(0.6+s.life*0.4));g.restore();}
      g.globalAlpha=1;g.shadowBlur=0;shards=shards.filter(s=>s.life>0);
      // ----- heart pop (砕ける直前に一瞬ふくらんで弾む余韻) -----
      for(const p of pops){p.life-=p.decay*dt;
        const bounce=1+Math.max(0,Math.sin((1-clamp(p.life,0,1))*Math.PI))*0.4;
        g.save();g.globalAlpha=Math.max(0,p.life)*0.8;g.translate(p.x,p.y);g.scale(bounce,bounce);
        g.fillStyle=p.color;g.shadowColor="#ffffff";g.shadowBlur=8;drawHeart(Math.max(0,p.r));
        g.restore();}
      g.globalAlpha=1;g.shadowBlur=0;pops=pops.filter(p=>p.life>0);
      // ----- small twinkle glints -----
      g.save();g.globalCompositeOperation="lighter";
      for(const gp of glints){gp.x+=gp.vx*dt;gp.y+=gp.vy*dt;gp.vx*=0.92;gp.vy*=0.92;gp.life-=gp.decay*dt;
        g.globalAlpha=Math.max(0,gp.life);g.fillStyle=gp.col;
        g.beginPath();g.arc(gp.x,gp.y,2*gp.life+0.5,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      glints=glints.filter(gp=>gp.life>0);
      // ----- falling snow (foreground) -----
      g.fillStyle="#ffffff";
      for(const s of snow){
        s.y+=s.sp*dt;s.sway+=s.sa*dt;s.x+=Math.sin(s.sway)*0.6*dt;
        if(s.y>api.H+4){s.y=-4;s.x=rnd(0,api.W);}
        if(s.x>api.W+4)s.x=-4;else if(s.x<-4)s.x=api.W+4;
        g.globalAlpha=s.a;g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();
      }
      g.globalAlpha=1;
      // ----- combo timer + text (top center, safe zone) -----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.16);g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(80,170,255,.8)";g.shadowBlur=14;
        g.fillStyle="#aef0ff";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.7)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // ① にじいろジェム! 発見バナー(虹色に色替わり・上部中央=安全帯)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.4,col="hsl("+Math.floor((tsec*120)%360)+",90%,64%)";
        g.save();g.translate(api.W/2,api.H*0.22);g.scale(pop,pop);g.textAlign="center";
        g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.shadowColor=col;g.shadowBlur=18;
        g.fillStyle="#ffffff";g.fillText("にじいろジェム!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろジェム!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 バナー(今日のラッキー色で・初回だけ大きく)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        const pop=1+Math.max(0,luckyMsgT-0.9)*1.3;
        g.save();g.translate(api.W/2,api.H*0.30);g.scale(pop,pop);g.textAlign="center";
        g.font="900 24px 'Hiragino Maru Gothic ProN',system-ui";
        g.globalAlpha=clamp(luckyMsgT*1.4,0,1);g.shadowColor=luckyColor;g.shadowBlur=14;
        g.fillStyle="#fff7c2";g.fillText("きょうの ラッキー色は "+colName(luckyColor)+"!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ パーフェクトフリーズ! バナー(クリア文字と重ねない下側)
      if(perfectT>0){perfectT-=0.014*dt;
        const pop=1+Math.max(0,perfectT-1.3)*1.4;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.textAlign="center";
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.globalAlpha=clamp(perfectT*1.3,0,1);g.shadowColor="rgba(140,220,255,.9)";g.shadowBlur=16;
        g.fillStyle="#c7f0ff";g.fillText("パーフェクト フリーズ!",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,110,160,.7)";g.strokeText("パーフェクト フリーズ!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(perfectT<0)perfectT=0;}
      // ----- HUD: stage + progress (top center) -----
      drawHUD();
      // ----- impact flash (cool white bloom) -----
      if(flash>0){flash-=0.06*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa*0.22;
        g.fillStyle="#dff2ff";g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      // ----- STAGE CLEAR banner -----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.45;g.fillStyle="#0a2a44";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(120,200,255,.9)";g.shadowBlur=20;g.fillStyle="#aef0ff";
        g.fillText("ステージ"+clearStage+" クリア!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア!",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("つぎは ステージ"+(clearStage+1)+"!",0,40);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=18;}
      }
    },
    stop(){}
  };
  // ===== drawing helpers =====
  function drawTarget(t,x,y){
    const r=t.r;
    g.save();g.translate(x,y);
    // soft shadow
    g.fillStyle="rgba(40,70,110,.14)";g.beginPath();g.ellipse(0,r*0.95,r*0.7,r*0.22,0,0,TAU);g.fill();
    // 画像スプライト(色が固定の種類だけ): ゴールドスター / ジェム / おおきいこおりくん。
    // 色バリエーションのある ふつうの子/ハート/にじいろ は手描きのまま(ラッキー色の仕掛けを維持)。
    // 一覧表で測った余白に合わせて描画サイズ/中心をずらす:
    //  gold  = 星が正方形をほぼ満たす → 2.3r(先端が当たり半径1.15rに一致)
    //  gem   = 丸い宝石が正方形いっぱい → 2.1r
    //  bigice= 体の芯は幅の56%・右に9%寄り・下に足 → 3.2r で描き、中心を左に8%ずらす
    const sprName=t.type==="gold"?"gold.png":t.type==="gem"?"gem.png":t.type==="big"?"bigice.png":null;
    const sw=t.type==="big"?r*3.2:t.type==="gem"?r*2.1:r*2.3;
    const sdx=t.type==="big"?-sw*0.08:0, sdy=t.type==="gold"?-sw*0.02:0;
    // 顔つきのスプライトは一回転させず、ゆらゆら揺れる程度に(手描き版の spin をそのまま位相に使う)
    const srot=Math.sin(t.spin*2)*0.18+(t.frozen?t.wob:0);
    const sprDrawn=!!sprName&&api.drawAsset(sprName,sdx,sdy,sw,sw,{center:true,rot:srot});
    if(!sprDrawn){
    g.rotate(t.spin+(t.frozen?t.wob:0));
    // base creature body
    const grd=g.createRadialGradient(-r*0.25,-r*0.3,r*0.1,0,0,r*1.2);
    if(t.type==="rainbow"){   // ① 虹色に脈打つ体で「激レア!」がひと目で分かる
      const h=Math.floor((tsec*90+x*0.4)%360);
      grd.addColorStop(0,"hsl("+h+",100%,86%)");
      grd.addColorStop(0.6,"hsl("+((h+45)%360)+",90%,66%)");
      grd.addColorStop(1,"hsl("+((h+90)%360)+",85%,56%)");
    }else{
      grd.addColorStop(0,lighten(t.color,80));grd.addColorStop(0.6,lighten(t.color,15));grd.addColorStop(1,t.color);
    }
    g.fillStyle=grd;
    if(t.type==="heart")drawHeart(r);
    else if(t.type==="gem")drawGemShape(r);
    else if(t.type==="star"){
      // ⑦ 同じ「ふつうの子」でも輪郭を まる/よこなが/たてなが の3種に分け、色違いだけで終わらせない
      g.save();
      if(t.shapeVariant===1)g.scale(1.3,0.8);
      else if(t.shapeVariant===2)g.scale(0.85,1.2);
      drawBlob(r);
      g.restore();
    }
    else drawBlob(r);
    // glossy sheen
    g.fillStyle="rgba(255,255,255,.32)";
    g.beginPath();g.ellipse(-r*0.22,-r*0.4,r*0.3,r*0.16,-0.4,0,TAU);g.fill();
    // cute face
    g.fillStyle="#2b3a4a";
    g.beginPath();g.arc(-r*0.26,-r*0.08,r*0.12,0,TAU);g.arc(r*0.26,-r*0.08,r*0.12,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.9)";
    g.beginPath();g.arc(-r*0.29,-r*0.12,r*0.04,0,TAU);g.arc(r*0.23,-r*0.12,r*0.04,0,TAU);g.fill();
    g.fillStyle="rgba(255,140,150,.4)";
    g.beginPath();g.arc(-r*0.4,r*0.08,r*0.1,0,TAU);g.arc(r*0.4,r*0.08,r*0.1,0,TAU);g.fill();
    g.strokeStyle="#2b3a4a";g.lineWidth=r*0.06;g.lineCap="round";
    g.beginPath();g.arc(0,r*0.04,r*0.14,0.15*Math.PI,0.85*Math.PI);g.stroke();
    }   // end hand-drawn body
    // ゴールドスター: 画像でもきらめきオーラは重ねる(レア感の合図・加算は必ず戻す)
    if(sprDrawn&&t.type==="gold"){g.save();g.globalCompositeOperation="lighter";
      const gp=0.5+0.5*Math.sin(tsec*5);
      const ag=g.createRadialGradient(0,0,0,0,0,Math.max(0,r*1.6));
      ag.addColorStop(0,"rgba(255,240,150,"+(0.45*gp).toFixed(3)+")");ag.addColorStop(1,"rgba(255,240,150,0)");
      g.fillStyle=ag;g.beginPath();g.arc(0,0,Math.max(0,r*1.6),0,TAU);g.fill();
      g.restore();g.globalAlpha=1;}
    g.restore();
    // ② ラッキー色ヒント: 今日のラッキー色の子には頭上に小さな星がキラッ(気づけるヒント・凍る前だけ)
    if(!t.frozen&&(t.type==="star"||t.type==="heart")&&t.color===luckyColor){
      const tw=0.55+0.45*Math.sin(tsec*6+t.bob*3);
      g.save();g.translate(x,y-r*1.35);g.globalAlpha=tw;
      g.fillStyle="#fff6c0";g.shadowColor="#ffe08a";g.shadowBlur=8;
      drawStar4(r*0.24);g.restore();g.globalAlpha=1;g.shadowBlur=0;
    }
    // ----- frozen overlay: ice block -----
    if(t.frozen){
      const ft=t.freezeT;
      g.save();g.translate(x,y);
      g.globalAlpha=0.55*ft;
      const ig=g.createLinearGradient(-r,-r,r,r);
      ig.addColorStop(0,"rgba(220,245,255,.9)");ig.addColorStop(0.5,"rgba(160,215,250,.55)");ig.addColorStop(1,"rgba(120,185,235,.85)");
      g.fillStyle=ig;
      const s=r*1.25;
      g.beginPath();
      g.moveTo(0,-s);g.lineTo(s*0.85,-s*0.45);g.lineTo(s*0.7,s*0.7);g.lineTo(0,s);
      g.lineTo(-s*0.7,s*0.7);g.lineTo(-s*0.85,-s*0.45);g.closePath();g.fill();
      // ice facets
      g.globalAlpha=0.5*ft;g.strokeStyle="rgba(255,255,255,.85)";g.lineWidth=1.6;
      g.beginPath();g.moveTo(0,-s);g.lineTo(0,s);g.moveTo(-s*0.85,-s*0.45);g.lineTo(s*0.7,s*0.7);
      g.moveTo(s*0.85,-s*0.45);g.lineTo(-s*0.7,s*0.7);g.stroke();
      // sparkle on ice
      g.globalAlpha=0.8*ft;g.fillStyle="#ffffff";
      g.save();g.translate(-r*0.4,-r*0.5);g.globalCompositeOperation="lighter";drawDiamond(r*0.18);g.restore();
      g.restore();g.globalAlpha=1;
    }
  }
  function drawBlob(r){
    g.beginPath();
    for(let i=0;i<=12;i++){const a=i/12*TAU;const rr=r*(0.92+Math.sin(a*5)*0.06);
      const px=Math.cos(a)*rr,py=Math.sin(a)*rr;
      if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}
    g.closePath();g.fill();
  }
  function drawHeart(r){
    g.beginPath();
    g.moveTo(0,r*0.5);
    g.bezierCurveTo(r*1.1,-r*0.3,r*0.5,-r,0,-r*0.35);
    g.bezierCurveTo(-r*0.5,-r,-r*1.1,-r*0.3,0,r*0.5);
    g.closePath();g.fill();
  }
  function drawGemShape(r){
    g.beginPath();
    g.moveTo(0,-r);g.lineTo(r*0.8,-r*0.2);g.lineTo(r*0.5,r*0.9);
    g.lineTo(-r*0.5,r*0.9);g.lineTo(-r*0.8,-r*0.2);g.closePath();g.fill();
  }
  function drawDiamond(r){
    g.beginPath();g.moveTo(0,-r);g.lineTo(r*0.6,0);g.lineTo(0,r);g.lineTo(-r*0.6,0);g.closePath();g.fill();
  }
  function drawStar4(r){   // 4方向にとがったキラッ星
    g.beginPath();
    for(let i=0;i<8;i++){const a=i/8*TAU-Math.PI/2,rr=(i%2===0)?r:r*0.38;
      const px=Math.cos(a)*rr,py=Math.sin(a)*rr;
      if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}
    g.closePath();g.fill();
  }
  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=15,bx=(api.W-bw)/2,by=api.H*0.05;
    g.save();g.textAlign="center";
    g.font="800 17px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(20,60,100,.6)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(20,50,90,.3)";rrect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#8ad4ff");gg.addColorStop(1,"#dff7ff");
      g.fillStyle=gg;rrect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=2;rrect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }
  function rrect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function lighten(hex,amt){const a=amt===undefined?50:amt;const c=parseInt(hex.slice(1),16);
    const r=Math.min(255,((c>>16)&255)+a),gg=Math.min(255,((c>>8)&255)+a),b=Math.min(255,(c&255)+a);
    return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("frostbeam", build_frostbeam);
