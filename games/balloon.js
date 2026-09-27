function buildBalloon(api){
  const g=api.g;
  // 画像アセットは背景のみ(無ければ従来の手描き空にフォールバック)。
  // ボス/にじいろ ふうせんのスプライトは生成が2回とも不良(背景抜きの穴・複数個・台座)だったので手描きのまま。
  api.preload(["bg.jpg"]);
  let hsCD=0;      // hitStop cooldown (節目限定・30f以上あける)
  function tryHitStop(f){if(hsCD<=0){api.hitStop(f);hsCD=32;}}
  let balloons=[],pending=[],confetti=[],rings=[],floats=[],sparks=[],shines=[],links=[],motes=[];
  let CHAINR,spawnT,count,waveN,clouds=[],hintPulse=0,flash=0,flashCol="#fff";
  let quietT=0,pityCD=0; // 軸3向けピティ: 無得点の経過フレーム(約60/秒)
  const PITY_T=400,PITY_CD=80; // 無得点がPITY_T(約6.7秒)続いたら的カラーを差し込み、次はPITY_CD(約1.3秒)空ける
  const COLORS=["#e85d75","#4aa6c0","#7be08a","#ffd23f","#b58bff","#ff8c42"];
  const CNAME=["あか","みずいろ","みどり","きいろ","むらさき","オレンジ"];
  // ---- 隠し発見レイヤー(ハンマー/トラックと同じ思想) ----
  let luckyColor=pick(COLORS),luckyIntroT=0,luckyIntroShown=false; // ① きょうのラッキー色(セッション秘密の1色)
  let superRareT=0,megaWarnT=0;       // ② だいあたり ふうせん(激レア)＋接近予告
  let escaped=0,perfectT=0;           // ③ パーフェクト判定(このステージで的の色をにがさない)
  let sunWink=0,sunX=0,sunY=0,sunR=0; // ④ おひさま ひみつタップ
  // stage / progression state
  let stage,stageClears,target,targetLeft,banner,skyShift,bossT,rainbowT,feverT;
  const SKY=[["#7bb8e8","#aee0f5","#eafaff"],["#f5b8d0","#fde0ef","#fff4fb"],["#ffcf8a","#ffe9c2","#fffaf0"],
    ["#9a8bff","#c5b8ff","#efeaff"],["#5ad0c0","#a8eee2","#ecfffb"],["#b58bff","#ffb3d9","#fff0fa"]];
  function stageColors(){return COLORS.slice(0,clamp(2+stage,3,6));}
  // 7〜8歳向けに手応えを少し増やした: 出現間隔 -13% / 上昇速度 +25%程度 / ボスの必要タップ 3→4
  // 軸3(歯ごたえ)向け: N=1..20再測でmaxQuietSecの裾(12秒超え)が本数を増やすほど崩れたため下限を10→8に詰めた
  function stageSpawn(){return clamp(26-stage*3,8,26);}
  function stageSpeedMul(){return 1+stage*0.2;}
  const BOSS_HP=4,BOSS_COL="#2f4fb8";   // ボスふうせんは色固定(紺)。COLORSに無い色なので連鎖/的の判定には巻き込まれない
  function layout(){sunX=api.W*0.82;sunY=api.H*0.12;sunR=Math.max(40,api.W*0.09);}
  // 連鎖の吸着半径: ステージが進むほど少し狭め、後半ほど「たまたま隣接」で連鎖しにくくする(軸3向け・様子見)
  function chainR(){return clamp(api.W*0.2-stage*6,90,240);}
  // 見た目のバラエティ(軸7向け): まる中心に、細長い風船と、縦に連なる「つみかさなりふうせん」を低確率で混ぜる
  // stack(つみかさなり)を目に留まりやすく: 0.1→0.18(軸7向け)
  // round/long/stackに加え、低確率で「ハートふうせん」を混ぜて輪郭のバリエーションをもう1種類増やす(軸7向け)
  function pickShape(){const r=Math.random();return r<0.18?'stack':(r<0.38?'long':(r<0.46?'heart':'round'));}
  function mk(y0,forceTarget){const r=clamp(api.W*0.06,28,50)*rnd(0.75,1.35); // 通常の丸ふうせんにも大小差をつける(軸7向け)
    return{x:rnd(r*1.5,api.W-r*1.5),y:y0!=null?y0:api.H+r*1.5,vy:-rnd(0.6,1.4)*stageSpeedMul(),r,
      // 無反応が続く時間(軸3)を縮めるため、一定確率で今の的の色を優先して出す。狙う必要性(missRate)自体は変えない
      // N=1..20再測でmaxQuietSecの裾が崩れたため0.35→0.42に増量(ランダム連打のscorePerTapは変えず、単に的色の巡り合わせを早める)
      color:(forceTarget||Math.random()<0.42)&&target?target:pick(stageColors()),phase:rnd(0,TAU),amp:rnd(8,22),popped:false,
      sq:1,wob:rnd(0,TAU),shimmer:rnd(0,TAU),rainbow:false,boss:0,shape:pickShape()};}
  // rainbow balloon: matches ANY colour in a chain
  function mkRainbow(){const b=mk();b.rainbow=true;b.r*=1.05;return b;}
  // boss balloon: needs a few taps, then a huge burst(乗り物寄りの輪郭にするため形は固定)
  function mkBoss(){const b=mk(api.H+90);b.boss=BOSS_HP;b.r=clamp(api.W*0.06,28,50)*1.9;b.vy=-rnd(0.3,0.6)*stageSpeedMul();b.color=BOSS_COL;b.shape='round';return b;}
  // ② だいあたり ふうせん(激レア): 虹色に光る大きめ。割ると虹の大盤振る舞い＋大量得点。連鎖には巻き込まれない(直接タップ専用)
  function mkMega(){const b=mk(api.H+120);b.mega=true;b.rainbow=true;b.r=clamp(api.W*0.06,28,50)*1.5;b.vy=-rnd(0.35,0.55)*stageSpeedMul();b.shape='round';return b;}
  function hitMega(b){
    if(b.popped)return;b.popped=true;megaWarnT=0;quietT=0;
    count+=8;api.setScore(count);
    showBanner("だいあたり！","#ffd23f",true);
    api.boom(0.9);api.shake(12);tryHitStop(5);
    flash=Math.max(flash,0.6);flashCol="#fff2cc";feverT=Math.max(feverT,70);
    api.slide(500,1600,0.3,0.09,"triangle");api.tone(880,0.16,"triangle",0.12);api.tone(1320,0.2,"triangle",0.1);
    for(let k=0;k<6;k++)rings.push({x:b.x,y:b.y,r:b.r*0.5,max:b.r*(2.2+k*0.5),life:1,col:"hsl("+(k*60)+",85%,62%)",lw:5});
    for(let k=44;k>0;k--){const a=rnd(0,TAU),s=rnd(3,12);
      confetti.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(5,12),color:pick(COLORS),rot:rnd(0,TAU),vr:rnd(-0.6,0.6),life:1,decay:rnd(0.01,0.02)});}
    for(let k=16;k>0;k--){const a=rnd(0,TAU),s=rnd(3,9);
      sparks.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.02,0.04),sz:rnd(3,6),col:"#fff"});}
    floats.push({x:b.x,y:b.y-40,txt:"だいあたり ＋8",life:1,vy:-1.1,t:0,col:"#ffd23f",size:34});
    if(targetLeft>0){targetLeft=Math.max(0,targetLeft-1);if(targetLeft<=0)clearStage();}
  }
  function mkClouds(){clouds=[];for(let i=0;i<4;i++)clouds.push({x:rnd(0,api.W),y:rnd(api.H*0.08,api.H*0.4),s:rnd(0.7,1.5),vx:rnd(0.05,0.18)});}
  function mkMotes(){motes=[];const n=clamp(Math.round(api.W/34),14,30);for(let i=0;i<n;i++)motes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(1.5,4.5),vy:-rnd(0.08,0.3),ph:rnd(0,TAU),drift:rnd(0.1,0.5)});}
  function newTarget(){const cols=stageColors();target=pick(cols);targetLeft=clamp(3+stage,4,8);}   // 7〜8歳向け: 的の数を1こ増やした
  function showBanner(txt,col,big){banner={txt,col:col||"#fff",life:1,t:0,big:!!big};}
  function nextStage(first){
    if(!first)stage++;
    skyShift=0;
    if(stage>=6){
      // final celebration loop point
      showBanner("ぜんぶ クリア！",("#ffd23f"),true);
      api.boom(1);api.shake(14);tryHitStop(6);flash=Math.max(flash,0.85);flashCol="#fff5cc";
      for(let k=0;k<70;k++){const a=rnd(0,TAU),s=rnd(3,11);
        confetti.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(5,11),color:pick(COLORS),rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.008,0.016)});}
      stage=0; // loop back but keep playing
    } else {
      showBanner("ステージ "+(stage+1)+"！",pick(["#ff8c42","#4aa6c0","#b58bff","#7be08a"]),true);
      if(!first)api.shake(7);
    }
    spawnT=stageSpawn();bossT=rint(360,540);rainbowT=rint(300,460);
    escaped=0;   // ③ パーフェクト判定を毎ステージ初期化
    newTarget();
  }
  function reset(){balloons=[];pending=[];confetti=[];rings=[];floats=[];sparks=[];shines=[];links=[];count=0;spawnT=0;waveN=0;flash=0;hintPulse=0;quietT=0;pityCD=0;
    stage=0;stageClears=0;banner=null;skyShift=0;bossT=420;rainbowT=380;feverT=0;layout();mkClouds();mkMotes();
    superRareT=rint(560,820);megaWarnT=0;perfectT=0;sunWink=0;escaped=0;
    luckyIntroT=luckyIntroShown?0:2.8;   // ① ラッキー色は初回だけ中央に教える
    nextStage(true);
    for(let i=0;i<10;i++)balloons.push(mk(rnd(api.H*0.2,api.H)));}
  function at(x,y){let best=null,bd=1e9;for(const b of balloons){if(b.popped)continue;const d=Math.hypot(b.x-x,b.y-y);if(d<b.r*1.05&&d<bd){bd=d;best=b;}}return best;}
  function pop(b){
    if(b.popped)return;b.popped=true;
    quietT=0; // 軸3向けピティ: 得点が動いたので無得点タイマーをリセット
    count++;api.setScore(count);
    // ① きょうのラッキー色: 秘密の色を割ると小ボーナス＋頭上に星のキラッ(気づけるヒント)
    if(!b.rainbow&&!b.mega&&b.color===luckyColor){
      count++;api.setScore(count);
      for(let k=3;k>0;k--)sparks.push({x:b.x+rnd(-b.r*0.3,b.r*0.3),y:b.y-b.r*0.95,vx:rnd(-0.8,0.8),vy:-rnd(1,2.2),life:1,decay:0.025,sz:rnd(3,5.5),col:"#fff0a0"});
      api.tone(1568,0.07,"triangle",0.05);
    }
    // count toward the stage target colour
    if(targetLeft>0&&(b.color===target||b.rainbow)){
      targetLeft--;
      floats.push({x:b.x,y:b.y-34,txt:"せいかい！",life:1,vy:-1.2,t:0,col:target,size:26});
      if(targetLeft<=0)clearStage();
    }
    const big=waveN>=6;
    rings.push({x:b.x,y:b.y,r:b.r*0.6,max:b.r*(big?2.6:1.9),life:1,col:b.color,lw:big?6:4});
    // soft glow flash
    shines.push({x:b.x,y:b.y,r:b.r*1.2,max:b.r*(big?3.4:2.4),life:1,col:lightenC(b.color)});
    api.tone(500*Math.pow(2,clamp(waveN,0,18)/12),0.08,"triangle",0.1);api.noise(0.05,0.12,1800);
    api.slide(900,1500,0.06,0.05,"sine");
    api.shake(2+Math.min(waveN*0.4,7));
    if(big){flash=Math.max(flash,0.55);flashCol=lightenC(b.color,80);}   // ヒットストップは連鎖開始時(startChain)の1回だけ
    // 壊れ方のバラエティ(軸7向け): つみかさなりふうせんは「砕け散る」の前に少し重めの粒がドサッと崩れ落ちる
    if(b.shape==='stack'){
      for(let k=rint(4,7);k>0;k--){const a=rnd(Math.PI*0.15,Math.PI*0.85),s=rnd(1.5,4);
        confetti.push({x:b.x+rnd(-b.r*0.4,b.r*0.4),y:b.y+rnd(-b.r*0.4,b.r*0.4),vx:Math.cos(a)*s*0.4,vy:Math.abs(Math.sin(a))*s+2.2,s:rnd(5,9),color:b.color,rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.008,0.014)});}
    }
    // 壊れ方のバラエティ(軸7向け): 細長い風船は矩形でなく縦の破片が上下に千切れて飛ぶ
    for(let k=rint(8,13);k>0;k--){const a=rnd(0,TAU),s=rnd(2,7);
      confetti.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,s:rnd(4,9),color:Math.random()<0.5?b.color:"#fff",rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.012,0.022),long:b.shape==='long'});}
    // sparkle burst
    for(let k=rint(5,9);k>0;k--){const a=rnd(0,TAU),s=rnd(3,9);
      sparks.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.03,0.06),sz:rnd(2,5),col:Math.random()<0.4?"#fff":lightenC(b.color)});}
  }
  // boss balloon takes several taps; final tap = big explosion
  function hitBoss(b){
    b.boss--;b.sq=1.4;b.r*=0.9;
    api.tone(220,0.1,"square",0.12);api.noise(0.06,0.16,900);api.shake(5);
    rings.push({x:b.x,y:b.y,r:b.r*0.5,max:b.r*2.2,life:1,col:lightenC(b.color,60),lw:6});
    for(let k=6;k>0;k--){const a=rnd(0,TAU),s=rnd(3,7);
      sparks.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.03,0.05),sz:rnd(3,6),col:"#fff"});}
    if(b.boss<=0){
      b.popped=true;quietT=0;count++;api.setScore(count);
      api.boom(0.85);api.shake(13);tryHitStop(5);flash=Math.max(flash,0.7);flashCol=lightenC(b.color,80);
      if(targetLeft>0){targetLeft=Math.max(0,targetLeft-2);if(targetLeft<=0)clearStage();}
      floats.push({x:b.x,y:b.y-30,txt:"ボス どっかーん！",life:1,vy:-1.1,t:0,col:"#ff3b3b",size:42});
      for(let k=40;k>0;k--){const a=rnd(0,TAU),s=rnd(3,12);
        confetti.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(5,11),color:pick(COLORS),rot:rnd(0,TAU),vr:rnd(-0.6,0.6),life:1,decay:rnd(0.01,0.02)});}
    }
  }
  // stage target cleared -> celebrate + advance
  function clearStage(){
    stageClears++;
    api.boom(0.9);api.shake(11);tryHitStop(4);flash=Math.max(flash,0.7);flashCol="#fff0c8";
    showBanner("ステージ クリア！",target,true);
    // ③ パーフェクト: このステージで的の色を1こもにがさなかったら +3 & みどりの祝福
    if(escaped===0){count+=3;api.setScore(count);perfectT=2.2;api.tone(1760,0.14,"triangle",0.1);
      for(let k=18;k>0;k--){const a=rnd(0,TAU),s=rnd(3,8);
        confetti.push({x:api.W/2,y:api.H*0.52,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,s:rnd(4,9),color:"#7be08a",rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.01,0.02)});}}
    for(let k=50;k>0;k--){const a=rnd(0,TAU),s=rnd(3,11);
      confetti.push({x:api.W/2,y:api.H*0.45,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(5,11),color:pick(COLORS),rot:rnd(0,TAU),vr:rnd(-0.6,0.6),life:1,decay:rnd(0.008,0.016)});}
    setTimeout2(nextStage,38);
  }
  // tiny frame-based delay helper (no real timers; queued in frame loop)
  let queued=[];
  function setTimeout2(fn,frames){queued.push({fn,f:frames});}
  function chainMatch(o,cur,seedColor){
    // rainbow balloons join any chain; matching colour joins normally
    return o.rainbow||cur.rainbow||o.color===seedColor;
  }
  function startChain(b){
    waveN=0;
    const seedColor=b.rainbow?null:b.color;
    const seen=new Set([b]);let frontier=[b],depth=0;
    while(frontier.length){
      const next=[];
      for(const cur of frontier){pending.push({b:cur,delay:depth*3});waveN++;
        for(const o of balloons){if(o.popped||o.boss>0||o.mega||seen.has(o))continue;
          const sc=seedColor||cur.color;
          if(chainMatch(o,cur,sc)&&Math.hypot(o.x-cur.x,o.y-cur.y)<chainR()){seen.add(o);next.push(o);
            // show the magic thread connecting same-color balloons
            links.push({a:cur,b2:o,col:lightenC(o.color,50),life:1,delay:depth*3,wob:rnd(0,TAU)});}}}
      frontier=next;depth++;
    }
    const total=seen.size;
    // tiered chain reward: 3 / 6 / 10+
    if(total>=6){
      const pw=clamp(total/12,0.3,1);api.boom(pw);tryHitStop(clamp(2+Math.floor(total/4),2,6));
      flash=Math.max(flash,total>=10?0.7:0.5);flashCol=total>=10?"#ffffff":lightenC(b.rainbow?"#ffd23f":b.color,80);
    }
    if(total>=10){
      feverT=Math.max(feverT,60); // rainbow fever burst
      api.slide(400,1400,0.25,0.08,"sawtooth");
      for(let k=46;k>0;k--){const a=rnd(0,TAU),s=rnd(3,11);
        confetti.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(5,11),color:pick(COLORS),rot:rnd(0,TAU),vr:rnd(-0.6,0.6),life:1,decay:rnd(0.01,0.02)});}
    }
    if(total>=3)floats.push({x:b.x,y:b.y-40,txt:total+"こ どかん！",life:1,vy:-1.1,t:0,
      col:total>=10?"#ff3b3b":total>=6?"#ff8c42":"#ffd23f",size:total>=8?48:34});
  }
  reset();
  return{
    resize:function(){layout();mkClouds();mkMotes();},
    input(px,py,type){if(type!=="down")return;const b=at(px,py);
      if(b){b.sq=1.35;if(b.mega){hitMega(b);}else if(b.boss>0){hitBoss(b);}else{startChain(b);}return;}
      // ④ おひさま ひみつタップ(減点なしのごほうび): ふうせんに当たらなかったタップだけ反応
      if(Math.hypot(px-sunX,py-sunY)<sunR){
        sunWink=1;api.tone(1318,0.1,"triangle",0.08);api.tone(1760,0.12,"triangle",0.06);
        for(let k=8;k>0;k--){const a=rnd(-TAU*0.5,0.2),s=rnd(2.5,6);
          sparks.push({x:sunX,y:sunY,vx:Math.cos(a)*s*0.7,vy:Math.sin(a)*s,life:1,decay:0.02,sz:rnd(3,6),col:"#ffe08a"});}
        for(let k=5;k>0;k--){const a=rnd(0,TAU),s=rnd(2,5);
          confetti.push({x:sunX,y:sunY,vx:Math.cos(a)*s,vy:Math.sin(a)*s+1,s:rnd(4,7),color:"#ffd23f",rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:0.014});}
      }}
    ,
    frame(dt,now){
      // process tiny queued delays (stage advance etc.)
      if(queued.length){for(const q of queued)q.f-=dt;const ready=queued.filter(q=>q.f<=0);queued=queued.filter(q=>q.f>0);for(const q of ready)q.fn();}
      if(hsCD>0)hsCD-=dt;
      quietT+=dt;if(pityCD>0)pityCD-=dt; // 軸3向けピティ: 無得点の経過を計測(得点が動いたらpop()側で0に戻る)
      // bg sky gradient (changes per stage)
      const sk=SKY[clamp(stage,0,SKY.length-1)];
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージの空色を薄く重ねて面ごとの雰囲気を変える(1面=あおぞらはそのまま)
        if(stage>0){g.save();g.globalAlpha=0.3;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,sk[0]);tg.addColorStop(0.55,sk[1]);tg.addColorStop(1,sk[2]);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,sk[0]);grd.addColorStop(0.55,sk[1]);grd.addColorStop(1,sk[2]);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // soft sun glow top
      let sun=g.createRadialGradient(api.W*0.82,api.H*0.12,0,api.W*0.82,api.H*0.12,api.W*0.5);
      sun.addColorStop(0,"rgba(255,250,225,.55)");sun.addColorStop(1,"rgba(255,250,225,0)");
      g.fillStyle=sun;g.fillRect(0,0,api.W,api.H);
      // おひさま本体(④ ひみつタップの的) + タップされたら ^_^ のウインク
      {const dR=Math.max(16,api.W*0.045);
        g.save();g.globalAlpha=0.92;g.fillStyle="rgba(255,247,205,.95)";g.shadowColor="rgba(255,240,180,.9)";g.shadowBlur=22;
        g.beginPath();g.arc(sunX,sunY,dR,0,TAU);g.fill();g.restore();
        if(sunWink>0){sunWink-=0.02*dt;
          g.save();g.globalAlpha=clamp(sunWink*1.4,0,1);g.strokeStyle="#e0a020";g.lineWidth=Math.max(2,dR*0.13);g.lineCap="round";
          g.beginPath();
          g.moveTo(sunX-dR*0.45,sunY-dR*0.05);g.quadraticCurveTo(sunX-dR*0.28,sunY-dR*0.34,sunX-dR*0.11,sunY-dR*0.05);
          g.moveTo(sunX+dR*0.11,sunY-dR*0.05);g.quadraticCurveTo(sunX+dR*0.28,sunY-dR*0.34,sunX+dR*0.45,sunY-dR*0.05);
          g.stroke();
          g.beginPath();g.arc(sunX,sunY+dR*0.12,dR*0.34,0.12*Math.PI,0.88*Math.PI);g.stroke();
          g.restore();g.globalAlpha=1;if(sunWink<0)sunWink=0;}}
      // drifting clouds ※画像背景のときは絵に雲があるので描かない
      if(!imgBg) for(const cl of clouds){cl.x+=cl.vx*dt;if(cl.x-90*cl.s>api.W)cl.x=-90*cl.s;
        g.save();g.globalAlpha=0.7;g.fillStyle="rgba(255,255,255,.9)";
        const s=cl.s;
        g.beginPath();g.arc(cl.x,cl.y,26*s,0,TAU);g.arc(cl.x+30*s,cl.y-6*s,34*s,0,TAU);
        g.arc(cl.x+62*s,cl.y,24*s,0,TAU);g.arc(cl.x+30*s,cl.y+10*s,30*s,0,TAU);g.fill();
        g.restore();}
      g.globalAlpha=1;
      // ambient floating light motes (always alive)
      g.save();g.globalCompositeOperation="lighter";
      for(const m of motes){m.ph+=0.03*dt;m.y+=m.vy*dt;m.x+=Math.sin(m.ph)*m.drift*dt;
        if(m.y<-6){m.y=api.H+6;m.x=rnd(0,api.W);}
        const tw=0.3+0.5*(0.5+0.5*Math.sin(m.ph*1.7));
        g.globalAlpha=tw*0.5;g.fillStyle="rgba(255,255,245,1)";
        g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";
      // spawn (rate tightens with stage)
      // 同時密度の上限を下げ(軸3向け): 非照準タップの命中率を下げ、狙って選ぶ意味を増やす
      // (下げすぎるとmaxQuietSecが伸びてしまうため15/14に調整。変更後は必ずN=1..12再測)
      spawnT-=dt;if(spawnT<=0&&balloons.length<15){balloons.push(mk(null,quietT>=PITY_T));spawnT=stageSpawn();}
      // 軸3向けピティ: 無得点がPITY_T続いたら、通常の間隔/上限を少し越えてでも的カラーのふうせんを差し込む(連発しないようPITY_CDのクールダウン)
      // 通常spawnの上限(15)は「非照準タップの命中率を下げる」ための意図的な制限なので、ピティだけは専用の高めの上限(20)を使い分ける
      if(quietT>=PITY_T&&pityCD<=0&&balloons.length<20){balloons.push(mk(null,true));pityCD=PITY_CD;}
      // occasional rainbow balloon (stage 2+)
      if(stage>=1){rainbowT-=dt;if(rainbowT<=0){if(balloons.length<15)balloons.push(mkRainbow());rainbowT=rint(360,560);}}
      // occasional boss balloon (stage 3+)
      if(stage>=2){bossT-=dt;if(bossT<=0){if(balloons.filter(b=>b.boss>0).length===0&&balloons.length<14)balloons.push(mkBoss());bossT=rint(520,760);}}
      // ② だいあたり ふうせん(全ステージ・激レア): 接近予告→出現。割ると虹の大盤振る舞い＋大量得点
      superRareT-=dt;
      if(superRareT<=60&&megaWarnT<=0&&!balloons.some(b=>b.mega)){megaWarnT=1.4;api.tone(1568,0.1,"triangle",0.06);}
      if(superRareT<=0){if(!balloons.some(b=>b.mega)&&balloons.length<15)balloons.push(mkMega());superRareT=rint(640,940);}
      // move
      for(const b of balloons){if(b.popped)continue;b.phase+=0.04*dt;b.y+=b.vy*dt;b.x+=Math.sin(b.phase)*0.4*dt;
        b.wob+=0.08*dt;b.shimmer+=0.06*dt;b.sq+=(1-b.sq)*0.12*dt;}
      // ③ パーフェクト判定: 的の色のふうせんを画面上に にがしたら記録
      for(const b of balloons){if(!b.popped&&b.y<=-b.r*2.5&&!b.rainbow&&!b.mega&&b.color===target)escaped++;}
      balloons=balloons.filter(b=>!b.popped&&b.y>-b.r*2.5);
      // pending pops (wave)
      for(const p of pending)p.delay-=dt;
      const go=pending.filter(p=>p.delay<=0);pending=pending.filter(p=>p.delay>0);
      for(const p of go)pop(p.b);
      balloons=balloons.filter(b=>!b.popped);
      // glow shines (under balloons)
      for(const s of shines){s.r+=(s.max-s.r)*0.18*dt;s.life-=0.05*dt;
        const a=Math.max(0,s.life)*0.5;if(a<=0)continue;
        let rg=g.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r);
        rg.addColorStop(0,"rgba(255,255,255,"+a+")");rg.addColorStop(0.5,s.col.replace("rgb(","rgba(").replace(")",","+(a*0.6)+")"));
        rg.addColorStop(1,"rgba(255,255,255,0)");
        g.fillStyle=rg;g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();}
      shines=shines.filter(s=>s.life>0);
      // chain links: glowing magic threads between same-color balloons
      g.save();g.globalCompositeOperation="lighter";
      for(const ln of links){
        if(ln.delay>0)ln.delay-=dt; else ln.life-=0.045*dt;
        ln.wob+=0.25*dt;
        const a=ln.a,b2=ln.b2;if(a.popped||b2.popped){ln.life-=0.12*dt;}
        const al=Math.max(0,ln.life);if(al<=0)continue;
        const mx=(a.x+b2.x)/2+Math.sin(ln.wob)*8,my=(a.y+b2.y)/2+Math.cos(ln.wob)*8;
        g.globalAlpha=al*0.9;g.strokeStyle=ln.col;g.lineWidth=3.5;g.lineCap="round";
        g.shadowColor=ln.col;g.shadowBlur=14;
        g.beginPath();g.moveTo(a.x,a.y);g.quadraticCurveTo(mx,my,b2.x,b2.y);g.stroke();
        // a little sparkle riding the thread
        g.globalAlpha=al;g.fillStyle="#fff";g.shadowBlur=10;
        g.beginPath();g.arc(mx,my,2.6,0,TAU);g.fill();
      }
      g.restore();g.globalAlpha=1;g.shadowBlur=0;g.globalCompositeOperation="source-over";
      links=links.filter(ln=>ln.life>0);
      // draw balloons (sorted by y so lower in front)
      const order=balloons.slice().sort((a,b)=>a.y-b.y);
      for(const b of order)drawBalloon(b);
      // rings
      g.save();
      for(const r of rings){r.r+=(r.max-r.r)*0.25*dt;r.life-=0.06*dt;
        g.globalAlpha=Math.max(0,r.life);g.strokeStyle=r.col;g.lineWidth=r.lw||4;
        g.shadowColor=r.col;g.shadowBlur=12;
        g.beginPath();g.arc(r.x,r.y,r.r,0,TAU);g.stroke();}
      g.restore();g.globalAlpha=1;rings=rings.filter(r=>r.life>0);
      // confetti
      for(const c of confetti){c.vy+=0.18*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=c.vr*dt;c.life-=c.decay*dt;
        g.save();g.globalAlpha=Math.max(0,c.life);g.translate(c.x,c.y);g.rotate(c.rot);g.fillStyle=c.color;
        if(c.long)g.fillRect(-c.s*0.18,-c.s*0.9,Math.max(0.5,c.s*0.36),Math.max(0.5,c.s*1.8));
        else g.fillRect(-c.s/2,-c.s/3,c.s,c.s*0.66);
        g.restore();}
      g.globalAlpha=1;confetti=confetti.filter(c=>c.life>0);
      // sparkles (4-point twinkle)
      g.save();g.globalCompositeOperation="lighter";
      for(const sp of sparks){sp.vx*=0.94;sp.vy*=0.94;sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.life-=sp.decay*dt;
        const a=Math.max(0,sp.life),z=sp.sz*(0.4+a*0.9);
        g.globalAlpha=a;g.fillStyle=sp.col;g.translate(sp.x,sp.y);
        g.beginPath();g.moveTo(0,-z*2);g.lineTo(z*0.5,0);g.lineTo(0,z*2);g.lineTo(-z*0.5,0);g.closePath();
        g.moveTo(-z*2,0);g.lineTo(0,z*0.5);g.lineTo(z*2,0);g.lineTo(0,-z*0.5);g.closePath();g.fill();
        g.setTransform(api.dpr,0,0,api.dpr,0,0);}
      g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";sparks=sparks.filter(sp=>sp.life>0);
      // floats
      for(const f of floats){f.t+=dt;f.y+=f.vy*dt;f.life-=0.014*dt;
        const pop=1+Math.max(0,0.4-f.t*0.05)*2;
        g.save();g.globalAlpha=Math.max(0,f.life);g.translate(f.x,f.y);g.scale(pop,pop);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.shadowColor=f.col;g.shadowBlur=18;
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,0,0);
        g.shadowBlur=0;g.fillStyle=f.col;g.fillText(f.txt,0,0);g.restore();}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // rainbow fever wash (big chains)
      if(feverT>0){feverT-=dt;const fa=Math.max(0,Math.min(1,feverT/60))*0.35;
        g.save();g.globalCompositeOperation="lighter";
        let fg=g.createLinearGradient(0,0,api.W,api.H);
        const hue=(now*0.12)%360;
        fg.addColorStop(0,"hsla("+hue+",90%,65%,"+fa+")");
        fg.addColorStop(0.5,"hsla("+((hue+120)%360)+",90%,65%,"+fa+")");
        fg.addColorStop(1,"hsla("+((hue+240)%360)+",90%,65%,"+fa+")");
        g.fillStyle=fg;g.fillRect(0,0,api.W,api.H);g.restore();g.globalCompositeOperation="source-over";}
      // climax full-screen colour wash
      if(flash>0){flash-=0.04*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa;
        g.fillStyle=flashCol;g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";}
      // top HUD: current goal (上部中央＝engine HUDと衝突しない安全帯)
      if(targetLeft>0){
        g.save();g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="left";g.textBaseline="middle";
        const label="この いろを あと "+targetLeft+"こ！";
        const mt=g.measureText(label),tw=(mt&&mt.width)||label.length*10;
        const bw=tw+58,bh=34,px0=api.W/2-bw/2,py0=10;
        roundRect(px0,py0,bw,bh,bh/2);g.fillStyle="rgba(40,60,100,.62)";g.fill();
        g.beginPath();g.arc(px0+24,py0+bh/2,11,0,TAU);g.fillStyle=target;g.shadowColor=target;g.shadowBlur=10;g.fill();g.shadowBlur=0;
        g.fillStyle="#fff";g.fillText(label,px0+44,py0+bh/2+1);g.restore();g.textAlign="left";g.textBaseline="alphabetic";
      }
      // stage banner (big, brief)
      if(banner){banner.t+=dt;banner.life-=0.012*dt;
        const a=Math.max(0,Math.min(1,banner.life*1.3)),pop=1+Math.max(0,0.5-banner.t*0.045)*1.6;
        g.save();g.globalAlpha=a;g.translate(api.W/2,api.H*0.32);g.scale(pop,pop);
        g.font="900 "+(banner.big?54:40)+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
        g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(banner.txt,0,0);
        g.shadowColor=banner.col;g.shadowBlur=24;g.fillStyle=banner.col;g.fillText(banner.txt,0,0);
        g.restore();g.textAlign="left";g.textBaseline="alphabetic";
        if(banner.life<=0)banner=null;
      }
      // ② だいあたり ふうせん 接近予告バナー(虹色・上部中央=HUD安全帯)
      if(megaWarnT>0){megaWarnT-=0.016*dt;
        const a=clamp(megaWarnT,0,1),col="hsl("+((now*0.2)%360)+",85%,62%)";
        g.save();g.globalAlpha=a;g.translate(api.W/2,api.H*0.2);
        g.font="900 24px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.35)";g.strokeText("キラキラ ふうせん せっきん！",0,0);
        g.shadowColor=col;g.shadowBlur=16;g.fillStyle=col;g.fillText("キラキラ ふうせん せっきん！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(megaWarnT<0)megaWarnT=0;}
      // ① きょうのラッキー色 お知らせ(初回だけ・中央)
      if(luckyIntroT>0){luckyIntroT-=0.016*dt;
        const a=clamp(luckyIntroT*1.2,0,1),pop=1+Math.max(0,luckyIntroT-2.2)*1.5;
        g.save();g.globalAlpha=a;g.translate(api.W/2,api.H*0.5);g.scale(pop,pop);
        g.font="900 26px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
        const txt="きょうの ラッキーいろは "+CNAME[COLORS.indexOf(luckyColor)]+"！";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.4)";g.strokeText(txt,0,0);
        g.shadowColor=luckyColor;g.shadowBlur=16;g.fillStyle="#fff";g.fillText(txt,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";
        if(luckyIntroT<=0){luckyIntroShown=true;luckyIntroT=0;}}
      // ③ パーフェクト！ バナー(クリア文字の下=重ねない)
      if(perfectT>0){perfectT-=0.014*dt;
        const a=clamp(perfectT*1.3,0,1),pop=1+Math.max(0,perfectT-1.6)*1.5;
        g.save();g.globalAlpha=a;g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
        g.lineWidth=6;g.strokeStyle="rgba(20,90,40,.6)";g.strokeText("パーフェクト！",0,0);
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=18;g.fillStyle="#c7ffcf";g.fillText("パーフェクト！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(perfectT<0)perfectT=0;}
      hintPulse+=0.05*dt;
      // cute rounded HUD: hint pill (bottom)
      g.save();const hint="ふうせんを タップ！ おなじ いろが れんさで われる！";
      g.font="800 19px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
      const mt=g.measureText(hint),tw2=(mt&&mt.width)||hint.length*11,pw=tw2+40,ph2=40,pulse=1+Math.sin(hintPulse)*0.02;
      g.translate(api.W/2,api.H-30);g.scale(pulse,pulse);
      roundRect(-pw/2,-ph2/2,pw,ph2,ph2/2);
      g.fillStyle="rgba(60,90,140,.7)";g.shadowColor="rgba(0,0,0,.25)";g.shadowBlur=8;g.fill();
      g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle="rgba(255,255,255,.6)";g.stroke();
      g.fillStyle="#fff";g.shadowColor="rgba(80,120,180,.9)";g.shadowBlur=6;
      g.fillText(hint,0,1);g.restore();g.textAlign="left";g.textBaseline="alphabetic";
      g.globalCompositeOperation="source-over";
    }
  };
  function drawBalloon(b){
    const sq=b.sq||1,wob=Math.sin(b.wob)*0.04;
    let rx=b.r*0.85*(2-sq)*(1+wob),ry=b.r*sq*(1-wob);
    // 形のバラエティ(軸7向け): 細長い風船(動物風船っぽい二段ふくらみ)を混ぜる
    if(b.shape==='long'){rx*=0.55;ry*=1.7;}
    rx=Math.max(0.5,rx);ry=Math.max(0.5,ry);
    g.save();g.translate(b.x,b.y);
    // soft drop shadow under body
    g.save();g.globalAlpha=0.18;g.fillStyle="#1a3a5a";
    g.beginPath();g.ellipse(b.r*0.12,b.r*0.16,rx,ry,0,0,TAU);g.fill();g.restore();
    // string (gentle curve)
    g.strokeStyle="rgba(40,60,90,.35)";g.lineWidth=1.5;g.beginPath();g.moveTo(0,ry*0.95);
    g.quadraticCurveTo(Math.sin(b.phase*2)*6,ry*1.4,Math.sin(b.phase)*4,ry*1.85);g.stroke();
    // knot
    g.fillStyle=b.color;g.beginPath();g.moveTo(-4,ry*0.92);g.lineTo(4,ry*0.92);g.lineTo(0,ry*1.05);g.closePath();g.fill();
    // ふうせん本体は全て手描き(色バリエーション/ラッキー色/連鎖の仕掛みを無傷で保つ)。
    // ボス(紺)/にじいろは画像スプライトの生成が不良続きだったため、画像は使わない。
    // body with rich radial gradient
    let grd;
    if(b.rainbow){
      // shifting rainbow fill
      const hue=(b.shimmer*40)%360;
      grd=g.createRadialGradient(-rx*0.35,-ry*0.4,b.r*0.1,0,0,b.r*1.05);
      grd.addColorStop(0,"#ffffff");
      grd.addColorStop(0.4,"hsl("+hue+",90%,70%)");
      grd.addColorStop(0.75,"hsl("+((hue+90)%360)+",85%,60%)");
      grd.addColorStop(1,"hsl("+((hue+180)%360)+",80%,55%)");
      g.save();g.shadowColor="hsl("+hue+",90%,65%)";g.shadowBlur=16;g.fillStyle=grd;
      g.beginPath();g.ellipse(0,0,rx,ry,0,0,TAU);g.fill();g.restore();
    } else {
      grd=g.createRadialGradient(-rx*0.35,-ry*0.4,b.r*0.1,0,0,b.r*1.05);
      grd.addColorStop(0,lightenC(b.color,90));grd.addColorStop(0.45,lightenC(b.color,30));
      grd.addColorStop(1,b.color);
      g.save();g.shadowColor=b.color;g.shadowBlur=b.boss>0?18:10;g.fillStyle=grd;
      if(b.shape==='long'){
        // 動物風船らしい二段ふくらみ(軸7向け): 丸いだけの輪郭差を出すため下の大玉+上の小玉+くびれの陰で表現
        const loY=ry*0.30,loRx=Math.max(0.5,rx*1.05),loRy=Math.max(0.5,ry*0.62);
        const hiY=-ry*0.55,hiRx=Math.max(0.5,rx*0.72),hiRy=Math.max(0.5,ry*0.42);
        g.beginPath();g.ellipse(0,loY,loRx,loRy,0,0,TAU);g.fill();
        g.beginPath();g.ellipse(0,hiY,hiRx,hiRy,0,0,TAU);g.fill();
        g.save();g.globalAlpha=0.3;g.strokeStyle="rgba(30,50,80,.6)";g.lineWidth=Math.max(1,rx*0.14);
        g.beginPath();g.ellipse(0,-ry*0.05,Math.max(0.5,rx*0.42),Math.max(0.5,ry*0.15),0,0,TAU);g.stroke();g.restore();
      } else if(b.shape==='heart'){
        // ハートふうせん(軸7向け): round/long/stackと明確に違う輪郭をもう1種類混ぜる
        const hw=rx,hh=ry;
        g.beginPath();g.moveTo(0,hh*0.62);
        g.bezierCurveTo(hw*1.35,hh*0.05,hw*0.85,-hh*1.05,0,-hh*0.28);
        g.bezierCurveTo(-hw*0.85,-hh*1.05,-hw*1.35,hh*0.05,0,hh*0.62);
        g.closePath();g.fill();
      } else {
        g.beginPath();g.ellipse(0,0,rx,ry,0,0,TAU);g.fill();
      }
      g.restore();
      // つみかさなりふうせん(軸7向け): 同じ色の小さい風船を上に重ねて連なった輪郭にする(あたり判定は1個のまま)
      if(b.shape==='stack'){
        const r2=Math.max(0.5,rx*0.62),ry2=Math.max(0.5,ry*0.62),oy=-ry*0.85;
        let g2=g.createRadialGradient(-r2*0.35,oy-ry2*0.4,b.r*0.05,0,oy,r2*1.05);
        g2.addColorStop(0,lightenC(b.color,90));g2.addColorStop(0.45,lightenC(b.color,30));g2.addColorStop(1,b.color);
        g.save();g.shadowColor=b.color;g.shadowBlur=8;g.fillStyle=g2;
        g.beginPath();g.ellipse(0,oy,r2,ry2,0,0,TAU);g.fill();g.restore();
        g.strokeStyle="rgba(40,60,90,.35)";g.lineWidth=1.2;g.beginPath();
        g.moveTo(0,oy+ry2*0.9);g.lineTo(0,-ry*0.95);g.stroke();
      }
      if(b.boss>0){
        // ボス=乗り物寄りの輪郭を強調(軸7向け): ゴンドラを大きく・ロープを2本→4本にして熱気球らしさを出す
        const gw=Math.max(0.5,rx*0.34),gh=Math.max(0.5,ry*0.42),gy=ry*0.62;
        g.save();g.strokeStyle="rgba(60,45,30,.55)";g.lineWidth=1.4;
        g.beginPath();
        g.moveTo(-gw,gy);g.lineTo(-rx*0.6,ry*0.55);
        g.moveTo(gw,gy);g.lineTo(rx*0.6,ry*0.55);
        g.moveTo(-gw*0.5,gy);g.lineTo(-rx*0.2,ry*0.62);
        g.moveTo(gw*0.5,gy);g.lineTo(rx*0.2,ry*0.62);
        g.stroke();g.restore();
        g.save();g.fillStyle="#7a5a3a";
        g.fillRect(-gw,gy,gw*2,gh);
        g.strokeStyle="rgba(0,0,0,.35)";g.lineWidth=1.5;
        g.strokeRect(-gw,gy,gw*2,gh);
        g.restore();
        // boss face: show remaining taps as little dots
        g.fillStyle="rgba(255,255,255,.9)";
        for(let i=0;i<b.boss;i++){g.beginPath();g.arc((i-(b.boss-1)/2)*rx*0.32,ry*0.18,rx*0.09,0,TAU);g.fill();}
      }
    }
    // rim light (bottom edge)
    g.save();g.globalAlpha=0.35;g.strokeStyle=lightenC(b.color,50);g.lineWidth=2;
    g.beginPath();g.ellipse(0,ry*0.06,rx*0.96,ry*0.96,0,0.3,Math.PI-0.3);g.stroke();g.restore();
    // main highlight
    g.fillStyle="rgba(255,255,255,.6)";g.beginPath();g.ellipse(-rx*0.32,-ry*0.34,rx*0.2,ry*0.28,-0.4,0,TAU);g.fill();
    // tiny shimmer spot
    const sh=0.5+0.5*Math.sin(b.shimmer);
    g.globalAlpha=0.4+sh*0.4;g.fillStyle="#fff";
    g.beginPath();g.ellipse(rx*0.28,-ry*0.18,rx*0.07,ry*0.1,0.5,0,TAU);g.fill();g.globalAlpha=1;
    g.restore();
  }
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function lightenC(hex,amt){const a=amt==null?60:amt;const c=parseInt(hex.slice(1),16);const r=clamp(((c>>16)&255)+a,0,255),gg=clamp(((c>>8)&255)+a,0,255),b=clamp((c&255)+a,0,255);return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("balloon", buildBalloon);
