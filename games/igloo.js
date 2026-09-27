function build_igloo(api){
  const g=api.g;
  // 画像アセット(無ければ従来の手描きにフォールバック): 背景 / 氷イグルー
  // ※ゴールド/ボスは生成が2回とも「雪景色ごと」になり不採用 → 手描きのまま(レアが逆に目立って良い)
  api.preload(["bg.jpg","igloo.png"]);
  let igls=[],ice=[],sparks=[],rings=[],puffs=[],snow=[],glints=[],hills=[],floats=[],debris=[];
  let count=0,combo=0,comboT=0,tsec=0,spawnT=0,flash=0,flashHue="#cfe8ff",spawnCount=0;
  let chainT=0,chainN=0;            // 大連鎖の全画面演出
  // stage progression (endless)
  let stage=1,stageKill=0,stageGoal=8,clearT=0,clearStage=0,celebrate=0;
  // --- new spice: gold igloo / boss igloo / next-stage tease ---
  let hsT=0;                                    // hitStop cooldown (30f rule)
  let boss=null,bossWarn=0,pendingBoss=false,bossCele=0,bossJust=false;
  let nextTxt="";
  const GOLD_RB=["#ff5b5b","#ffd23f","#7be08a","#4db8ff","#b58bff"];
  const COLORS=["#bfe9ff","#9fd0f5","#dff3ff","#a8e6ff","#cfd8ff"];
  // 軸7: 壊す物のバラエティ。丸(dome)だけでなく 塔(tower)/だるま(stack)/つらら(icicle) を混ぜる。
  // ボスは常にドーム型のまま(kind未指定→"dome"扱い)なので、でっかい敵の分かりやすさは変えない。
  const KIND_POOL=["dome","dome","tower","stack","icicle"];
  const SNOWN=70;
  // ---- 隠し発見レイヤー(crane/punch/hammer/truck と同じ思想) ----
  // イグルーはどれも氷色で見分けづらいので、ふつうのイグルーには先っぽに小さな旗を立てる。
  // ② きょうのラッキー色 は「旗の色」で当てる(氷色本体では見分けられないため)。
  const FLAGS=[{c:"#ff5b5b",n:"あか"},{c:"#4db8ff",n:"あお"},{c:"#ffd23f",n:"きいろ"},
    {c:"#7be08a",n:"みどり"},{c:"#b58bff",n:"むらさき"},{c:"#ff8ad2",n:"ピンク"}];
  const lucky=pick(FLAGS);let luckyMsgT=0,luckySeen=false;   // ② 秘密の1色(旗)
  let rbMsgT=0,rbEscT=0;                                     // ① にじいろイグルー バナー/にげた
  let comboKept=true;                                        // ③ ノンストップ判定(コンボを切らさず走破)
  const sunHit={x:0,y:0,r:0};let sunWink=0;                  // ④ 太陽ひみつタップ
  function hs(f){ if(hsT<=0){ api.hitStop(f); hsT=30; } }   // gated hit-stop
  function layout(){
    snow=[];for(let i=0;i<SNOWN;i++)snow.push({x:rnd(0,api.W),y:rnd(0,api.H),
      r:rnd(1.2,3.6),sp:rnd(0.3,1.1),sw:rnd(0,TAU),amp:rnd(6,22)});
    hills=[
      {y:api.H*0.66,amp:api.H*0.04,wl:api.W*0.9,col:"#dff0fb",sp:0.003,ph:0},
      {y:api.H*0.74,amp:api.H*0.05,wl:api.W*0.7,col:"#c7e4f6",sp:0.006,ph:1.4}
    ];
    // reposition existing igloos so resize never throws / leaves them off-screen
    for(const it of igls){ it.x=clamp(it.x,it.r,api.W-it.r); it.y=clamp(it.y,api.H*0.34,api.H*0.86); }
    if(boss){ boss.x=api.W/2; boss.y=api.H*0.56; }
    // ④ 太陽ひみつタップ: 描画中のお日さまグロー(0.72W,0.16H)に合わせ、寛容に大きめ判定
    sunHit.x=api.W*0.72;sunHit.y=api.H*0.16;sunHit.r=Math.max(46,api.W*0.11);
  }
  layout();
  spawn();spawn();   // 軸3: 開始直後から的を2個にして最初の成功までの待ちを短くする(cap=5なので安全)
  function stageGoalFor(s){return 10+(s-1)*3;}   // 10,13,16,...（7〜8歳向けに 2〜3割 増量）
  function rFor(){return clamp(Math.min(api.W,api.H)*0.09,28,58);}
  function spawn(){
    const cap=boss?3:Math.min(7,4+stage);
    if(igls.length>=cap)return;                       // cap on screen igloos
    const kind=pick(KIND_POOL);                        // 軸7: 丸/塔/だるま/つらら をランダム付与
    const kmul=kind==="tower"?1.4:kind==="stack"?0.85:kind==="icicle"?0.55:1;
    // 軸3: 開始直後の最初の2個だけ心持ち大きめにして、初手成功までのバラつきを縮める
    const sizeRnd=spawnCount<2?rnd(1.0,1.15):rnd(0.85,1.15);
    spawnCount++;
    const r=rFor()*kmul*sizeRnd;
    // keep clear of the engine HUD corners (top-left/top-right y<56)
    let x=rnd(r+20,api.W-r-20), y=rnd(api.H*0.34,api.H*0.84);
    const gold=Math.random()<0.08;                    // レア: ゴールドイグルー
    const rainbow=!gold&&Math.random()<0.045;         // ① 激レア: にじいろイグルー(数%・短命で逃げる=ドキドキ)
    igls.push({x,y,r,born:0,wob:rnd(0,TAU),kind,
      col:rainbow?"#ff5b5b":(gold?"#ffd23f":pick(COLORS)),
      hp:1,blink:rnd(0,TAU),gold,rainbow,
      flag:(!gold&&!rainbow)?pick(FLAGS):null,        // ② ふつうのイグルーだけ旗つき
      ttl:rainbow?4.2:rnd(8,11),esc:0});              // 通常/ゴールドにも寿命(放置飽和ソフトロック防止)・7〜8歳向けに少し短め
    if(rainbow){ api.tone(1318,0.1,"triangle",0.09); api.tone(1760,0.12,"triangle",0.07); api.tone(2093,0.12,"triangle",0.05); }
    else if(gold){ api.tone(1046,0.12,"triangle",0.1); api.tone(1318,0.14,"triangle",0.08); }
  }
  function makeIce(x,y,col,n,spd){
    for(let i=0;i<n;i++){const a=rnd(0,TAU),v=rnd(spd*0.45,spd);
      ice.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-rnd(1,4),
        s:rnd(7,18),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.02),col});}
  }
  function makeSparks(x,y,col,n){
    for(let i=0;i<n;i++){const a=rnd(0,TAU),v=rnd(2,8);
      sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,life:1,decay:rnd(0.02,0.04),
        s:rnd(1.5,3.5),col:i%2?col:"#ffffff"});}
  }
  function blow(it){
    // 爆破！: ice flies four ways + shockwave + flash
    it.dead=true;
    const hx=it.x,hy=it.y;
    const isRainbow=!!it.rainbow;
    // ② ラッキー色: 今日の秘密の旗色を割ると +1 の隠しボーナス(気づくと得する)
    const isLucky=!it.gold&&!isRainbow&&it.flag&&it.flag.c===lucky.c;
    let gain=isRainbow?8:(it.gold?5:1); if(isLucky)gain+=1;
    count+=gain;stageKill++;api.setScore(count);
    combo++;comboT=1;
    rings.push({x:hx,y:hy,r:it.r*0.4,vr:it.r*0.6,life:1,decay:0.05,col:"#ffffff"});
    rings.push({x:hx,y:hy,r:it.r*0.2,vr:it.r*0.45,life:1,decay:0.045,col:it.col});
    makeIce(hx,hy,it.col,12+Math.min(combo,8),it.r*0.28);
    makeSparks(hx,hy,it.col,8);
    puffs.push({x:hx,y:hy,r:it.r*0.5,vr:1.3,life:1,decay:0.02});
    flash=Math.min(1,flash+0.4);flashHue=it.col;
    api.boom(0.45);api.noise(0.16,0.28,1400);
    api.tone(420*Math.pow(2,clamp(combo,0,12)/12),0.12,"triangle",0.12);
    api.slide(180,70,0.18,0.22,"sawtooth");
    api.shake(6+Math.min(combo,8));hs(2);
    if(combo>=3){flash=Math.min(1,flash+0.2);api.tone(220,0.18,"sawtooth",0.07);hs(3);}
    if(it.gold){
      // ゴールド！ 虹色破片 + ファンファーレ + 金フラッシュ
      for(const c of GOLD_RB) makeSparks(hx,hy,c,5);
      makeIce(hx,hy,"#ffd23f",10,it.r*0.32);
      rings.push({x:hx,y:hy,r:it.r*0.5,vr:it.r*0.8,life:1,decay:0.04,col:"#ffd23f"});
      floats.push({x:hx,y:hy-it.r,txt:"ゴールド！+5",life:1,vy:-1,col:"#ffd23f",size:30});
      [0,4,7,12].forEach((s,i)=>setTimeout(()=>api.tone(659.25*Math.pow(2,s/12),0.18,"triangle",0.12),i*60));
      flash=Math.min(1,flash+0.4);flashHue="#ffd23f";
      api.shake(12);hs(4);
    }
    if(isRainbow){
      // ① にじいろイグルー撃破: 虹の輪が5色ぶわっと + ファンファーレ + 大量得点(激レアごほうび)
      rbMsgT=1.4;
      for(let k=0;k<GOLD_RB.length;k++)rings.push({x:hx,y:hy,r:it.r*0.4,vr:it.r*(0.55+k*0.14),life:1,decay:0.045,col:GOLD_RB[k]});
      for(const c of GOLD_RB) makeSparks(hx,hy,c,6);
      makeIce(hx,hy,"#ffffff",14,it.r*0.34);
      floats.push({x:hx,y:hy-it.r,txt:"にじいろ！+8",life:1,vy:-1,col:"#ff5b5b",size:32});
      flash=Math.min(1,flash+0.3);flashHue="#ffffff";
      api.boom(0.7);api.shake(16);hs(5);
      [0,4,7,12].forEach((s,i)=>setTimeout(()=>api.tone(880*Math.pow(2,s/12),0.16,"triangle",0.12),i*55));
    }
    if(isLucky){
      // ② ラッキー色命中: 小さめの祝福(白飛びしないよう控えめ)＋頭上に星のキラッ
      luckyMsgT=luckySeen?Math.max(luckyMsgT,0.7):1.6;luckySeen=true;
      api.tone(1046,0.14,"triangle",0.11);api.tone(1568,0.16,"triangle",0.08);
      makeSparks(hx,hy-it.r*0.5,lucky.c,6);
      floats.push({x:hx,y:hy-it.r*0.9,txt:"ラッキー！",life:1,vy:-0.9,col:lucky.c,size:24});
    }
    // 軸7: 壊れ方も形で変える(全部「砕ける」だけにしない)。dome/icicleは既存の氷の破片のまま(=砕ける)。
    if(it.kind==="tower"){
      debris.push({kind:"tower",x:hx,y:hy,r:it.r,col:it.col,rot:0,
        vr:rnd(3.0,4.2)*(Math.random()<0.5?-1:1),life:1,decay:0.026});
    }else if(it.kind==="stack"){
      debris.push({kind:"stack",x:hx,y:hy,r:it.r,col:it.col,sy:1,sx:1,life:1,decay:0.045});
    }
    checkStage();
  }
  function bigChain(hits){
    // 複数同時=大連鎖: full-screen burst
    chainT=1.4;chainN=hits;
    flash=1;flashHue="#fff";
    api.boom(0.7);api.shake(20+Math.min(hits*3,18));hs(6);
    api.slide(700,120,0.45,0.3,"sawtooth");
    [0,4,7,12].forEach((semi,i)=>setTimeout(()=>api.tone(523.25*Math.pow(2,semi/12),0.2,"triangle",0.12),i*60));
  }
  function tapAt(px,py){
    if(clearT>0)return;
    // boss first: giant igloo soaks up taps near it (寛容な当たり=5歳児にもやさしい)
    if(boss&&Math.hypot(px-boss.x,py-boss.y)<=boss.r*1.4){ bossHit(px,py); return; }
    // find igloos near the tap (allow multiple = chain)
    // 軸7で大きさを形ごとに変えた分、当たり判定の寛容さも形で補正する(小さい的=つらら/だるまが
    // 見た目どおりの難度になり過ぎて 軸3(c)のmaxQuietSecが悪化しないように)。塔は元々大きいので控えめ。
    const hit=[];
    for(const it of igls){ if(it.dead)continue;
      const tol=it.kind==="icicle"?1.9:it.kind==="stack"?1.45:it.kind==="tower"?1.05:1.25;
      if(Math.hypot(px-it.x,py-it.y)<=it.r*tol) hit.push(it); }
    if(!hit.length){
      // ④ 太陽ひみつタップ: イグルーに当たらなかった空タップが お日さまに届いたら
      //    ウインク＋金コインがこぼれる(減点なし・スコアも変えない=純粋なごほうび)
      if(sunHit.r>0&&Math.hypot(px-sunHit.x,py-sunHit.y)<sunHit.r){
        sunWink=1;api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.08);
        for(let i=0;i<8;i++){const a=rnd(-TAU*0.5,0),v=rnd(2,6);
          sparks.push({x:sunHit.x,y:sunHit.y,vx:Math.cos(a)*v*0.7,vy:Math.sin(a)*v-1,life:1,decay:0.012,s:rnd(2,3.5),col:"#ffd23f"});}
        floats.push({x:sunHit.x,y:sunHit.y+api.W*0.07,txt:"きらっ",life:1,vy:-0.8,col:"#ffe08a",size:22});
        return;
      }
      // miss: tiny snow puff so the tap still feels responsive
      api.tone(200,0.05,"triangle",0.06);
      for(let i=0;i<5;i++){const a=rnd(0,TAU),v=rnd(1,3);
        sparks.push({x:px,y:py,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,decay:0.05,s:rnd(1,2.5),col:"#dff3ff"});}
      return;
    }
    hit.forEach(blow);
    if(hit.length>=2) bigChain(hit.length);
  }
  // ---- boss igloo (every 3rd stage) ----
  function spawnBoss(){
    const r=clamp(Math.min(api.W,api.H)*0.19,70,120);
    const hpN=clamp(10+(Math.floor(stage/3)-1)*3,10,20);   // 7〜8歳向けに 2〜3割 タフに
    boss={x:api.W/2,y:api.H*0.56,r,born:0,wob:0,blink:rnd(0,TAU),col:"#9fd0f5",
      hp:hpN,hpMax:hpN,hurt:0,gold:false,boss:true};
    api.boom(0.7);api.shake(18);hs(5);
    flash=Math.min(1,flash+0.5);flashHue="#9fd0f5";
    makeIce(boss.x,boss.y+r*0.2,"#dff3ff",14,7);
    puffs.push({x:boss.x,y:boss.y,r:r*0.7,vr:1.8,life:1,decay:0.02});
    api.slide(60,180,0.4,0.3,"sawtooth");
  }
  function bossHit(px,py){
    boss.hp--;boss.hurt=1;
    combo++;comboT=1;
    count++;api.setScore(count);
    makeSparks(px,py,"#bfe9ff",8);makeIce(px,py,"#bfe9ff",6,5);
    rings.push({x:px,y:py,r:boss.r*0.15,vr:boss.r*0.28,life:1,decay:0.06,col:"#ffffff"});
    api.boom(0.35);api.noise(0.12,0.25,1600);
    api.tone(360+(boss.hpMax-boss.hp)*40,0.1,"square",0.1);
    api.shake(7);flash=Math.min(1,flash+0.15);flashHue="#bfe9ff";
    if(boss.hp===Math.ceil(boss.hpMax/2))
      floats.push({x:boss.x,y:boss.y-boss.r*1.2,txt:"あと はんぶん！",life:1,vy:-0.8,col:"#fff",size:26});
    if(boss.hp<=0) bossDie(); else hs(2);
  }
  function bossDie(){
    const hx=boss.x,hy=boss.y,r=boss.r;
    count+=10;api.setScore(count);
    makeIce(hx,hy,"#bfe9ff",28,r*0.16);
    for(const c of GOLD_RB) makeSparks(hx,hy,c,7);
    rings.push({x:hx,y:hy,r:r*0.3,vr:r*0.5,life:1,decay:0.035,col:"#ffffff"});
    rings.push({x:hx,y:hy,r:r*0.5,vr:r*0.4,life:1,decay:0.03,col:"#ffd23f"});
    puffs.push({x:hx,y:hy,r:r*0.6,vr:2.2,life:1,decay:0.015});
    floats.push({x:hx,y:hy-r,txt:"+10！",life:1,vy:-1,col:"#ffd23f",size:36});
    boss=null;bossCele=1.8;
    flash=1;flashHue="#fff";
    api.boom(0.85);api.shake(26);hs(8);
    api.slide(523,1046,0.5,0.4,"triangle");
    [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(523.25*Math.pow(2,semi/12),0.22,"triangle",0.13),i*70));
    doClear(true);
  }
  function checkStage(){
    if(boss||bossWarn>0)return;                        // boss stage clears only via boss
    if(stageKill<stageGoal||clearT>0)return;
    doClear(false);
  }
  function doClear(fromBoss){
    clearStage=stage;clearT=fromBoss?2.0:1.6;celebrate=clearT;flash=Math.min(1,flash+0.5);
    bossJust=!!fromBoss;
    api.boom(fromBoss?0.7:0.55);api.shake(14);
    api.slide(523,784,0.3,0.2,"triangle");api.tone(660,0.25,"triangle",0.14);api.tone(988,0.3,"triangle",0.1);
    for(let i=0;i<22;i++){const a=rnd(0,TAU),v=rnd(3,9);
      sparks.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,life:1,decay:rnd(0.012,0.02),
        s:rnd(2,4),col:pick(COLORS)});}
    // ③ ノンストップ ボーナス: このステージを コンボを一度も切らさず走破したら +3 & みどりの祝福
    if(!fromBoss&&comboKept){
      count+=3;api.setScore(count);
      floats.push({x:api.W/2,y:api.H*0.3,txt:"ノンストップ！＋3",life:1,vy:-0.7,col:"#7be08a",size:30});
      for(let i=0;i<16;i++){const a=rnd(0,TAU),v=rnd(3,8);
        sparks.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2.4,life:1,decay:rnd(0.014,0.022),
          s:rnd(2,4),col:"#7be08a"});}
      api.tone(1318,0.14,"triangle",0.1);api.tone(1976,0.16,"triangle",0.07);
    }
    stage++;stageGoal=stageGoalFor(stage);stageKill=0;comboKept=true;   // 次ステージの判定をリセット
    pendingBoss=(stage%3===0);
    // 次ステージ予告 (チラ見せ)
    nextTxt=pendingBoss?"つぎは… でっかい ボスが くるぞ！"
      :pick(["キラキラの ゴールドを さがせ！","ステージ"+stage+"も ぜんぶ こわそう！"]);
  }
  return{
    resize:layout,
    input(x,y,type){ if(type!=="down")return; tapAt(x,y); },
    frame(dt,now){
      tsec+=0.016*dt;
      if(hsT>0)hsT-=dt;
      if(celebrate>0)celebrate=Math.max(0,celebrate-0.02*dt);
      // ---- background: winter sky gradient (画像背景があればそれを使い、平坦な手描き要素はスキップ) ----
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true; }
      else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,"#9fc8ec");grd.addColorStop(0.4,"#bfe0f5");
        grd.addColorStop(0.72,"#e6f4fc");grd.addColorStop(1,"#f4fbff");
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // boss stage: sky darkens slightly for tension
      if(boss||bossWarn>0){ g.fillStyle="rgba(20,40,80,"+(boss?0.18:0.12)+")";g.fillRect(0,0,api.W,api.H); }
      // pale sun glow upper area (画像時は絵の太陽を邪魔しないよう控えめ)
      let sun=g.createRadialGradient(api.W*0.72,api.H*0.16,0,api.W*0.72,api.H*0.16,Math.max(0,api.W*0.5));
      if(imgBg){ sun.addColorStop(0,"rgba(255,255,255,.28)");sun.addColorStop(0.3,"rgba(230,245,255,.1)"); }
      else { sun.addColorStop(0,"rgba(255,255,255,.5)");sun.addColorStop(0.3,"rgba(230,245,255,.2)"); }
      sun.addColorStop(1,"rgba(230,245,255,0)");
      g.fillStyle=sun;g.fillRect(0,0,api.W,api.H);
      // ④ 太陽ひみつタップ: 叩かれた瞬間だけ ^_^ のウインク顔が出る(発見のごほうび)
      if(sunWink>0){ sunWink-=0.02*dt; const sx=api.W*0.72,sy=api.H*0.16,sr=api.W*0.05;
        g.save();g.globalAlpha=clamp(sunWink*1.3,0,1);
        g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(255,248,210,.5)";g.beginPath();g.arc(sx,sy,sr,0,TAU);g.fill();
        g.globalCompositeOperation="source-over";
        g.strokeStyle="#e0a030";g.lineWidth=Math.max(2,sr*0.13);g.lineCap="round";
        g.beginPath();
        g.moveTo(sx-sr*0.5,sy-sr*0.05);g.quadraticCurveTo(sx-sr*0.32,sy-sr*0.33,sx-sr*0.14,sy-sr*0.05);
        g.moveTo(sx+sr*0.14,sy-sr*0.05);g.quadraticCurveTo(sx+sr*0.32,sy-sr*0.33,sx+sr*0.5,sy-sr*0.05);
        g.stroke();
        g.beginPath();g.arc(sx,sy+sr*0.16,sr*0.34,0.12*Math.PI,0.88*Math.PI);g.stroke();
        g.restore();g.globalAlpha=1;g.lineCap="butt";g.globalCompositeOperation="source-over";
        if(sunWink<0)sunWink=0; }
      // snowy parallax hills ※画像背景のときは絵の丘を活かして描かない
      if(!imgBg) for(const hl of hills){ hl.ph+=hl.sp*dt;
        g.fillStyle=hl.col;g.beginPath();g.moveTo(0,api.H);
        for(let x=0;x<=api.W;x+=24){const yy=hl.y+Math.sin(x/hl.wl*TAU+hl.ph)*hl.amp;g.lineTo(x,yy);}
        g.lineTo(api.W,api.H);g.closePath();g.fill(); }
      // sparkly snow ground sheen (画像時も雪のきらめきは残す・小さな点なので絵と喧嘩しない)
      g.save();g.globalCompositeOperation="lighter";
      for(let i=0;i<14;i++){const px=((i*97+tsec*10)%api.W),py=api.H*0.82+((i*37)%(api.H*0.16));
        const tw=0.4+0.4*Math.sin(tsec*3+i);g.globalAlpha=Math.max(0,tw)*0.4;
        g.fillStyle="#ffffff";g.beginPath();g.arc(px,py,1.6,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";
      // ---- falling snow ----
      g.fillStyle="#ffffff";
      for(const s of snow){ s.y+=s.sp*dt; s.sw+=0.03*dt; s.x+=Math.sin(s.sw)*0.4*dt;
        if(s.y>api.H+4){s.y=-4;s.x=rnd(0,api.W);}
        if(s.x<-4)s.x=api.W+4; if(s.x>api.W+4)s.x=-4;
        g.globalAlpha=0.6;g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill(); }
      g.globalAlpha=1;
      // ---- spawn igloos ----
      if(clearT<=0&&bossWarn<=0){ spawnT-=dt; if(spawnT<=0){ spawn(); spawnT=clamp(40-(stage-1)*4,18,40); } }   // 出現テンポ 2割増
      // ---- boss warning: ゴゴゴ… + growing shadow ----
      if(bossWarn>0){
        bossWarn-=0.016*dt;
        api.shake(2);
        const t=clamp(1-bossWarn/1.6,0,1),bx=api.W/2,by=api.H*0.56;
        g.fillStyle="rgba(20,40,70,"+(0.3*t)+")";
        g.beginPath();g.ellipse(bx,by+30,110*t+10,34*t+4,0,0,TAU);g.fill();
        g.save();g.translate(bx+rnd(-3,3),api.H*0.22+rnd(-2,2));
        g.textAlign="center";g.font="900 42px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=9;g.lineJoin="round";g.strokeStyle="rgba(10,30,60,.8)";
        g.strokeText("ゴゴゴゴ…",0,0);g.fillStyle="#cfe8ff";g.fillText("ゴゴゴゴ…",0,0);
        g.restore();g.lineJoin="miter";g.textAlign="left";
        if(bossWarn<=0){ bossWarn=0; spawnBoss(); }
      }
      // ---- draw igloos ----
      for(const it of igls){ if(it.dead)continue;
        it.born=Math.min(1,it.born+0.1*dt); it.wob+=0.05*dt; it.blink+=0.04*dt;
        // ① にじいろイグルーは短命: 出しっぱなしだと ふわっと逃げる(減点なし・急いで狙う=ドキドキ)
        if(it.rainbow){
          if(it.esc>0){ it.esc-=0.02*dt; it.y-=2.4*dt; if(it.esc<=0){it.dead=true;continue;} }
          else if(it.born>=1){ it.ttl-=0.016*dt;
            if(it.ttl<=0){ it.esc=1;rbEscT=1.0;
              for(const c of GOLD_RB)makeSparks(it.x,it.y,c,3);
              api.tone(880,0.1,"sine",0.06);api.tone(660,0.12,"sine",0.05); } }
        }else{
          // 通常/ゴールドにも寿命: 期限切れは小さくふわっと消滅(減点なし)。放置で盤面が
          // cap まで飽和して spawn が止まる=進行ソフトロックを自動で解消し、鮮度も保つ。
          // ※消えかけ(esc>0)でも当たり判定は生きているので、ギリギリ叩けば普通にごほうび。
          if(it.esc>0){ it.esc-=0.03*dt; it.y-=0.6*dt; if(it.esc<=0){it.dead=true;continue;} }
          else if(it.born>=1){ it.ttl-=0.016*dt; if(it.ttl<=0)it.esc=1; }
        }
        drawIgloo(it); }
      igls=igls.filter(it=>!it.dead);
      // ---- boss igloo ----
      if(boss){
        boss.born=Math.min(1,boss.born+0.06*dt);boss.wob+=0.04*dt;boss.blink+=0.03*dt;
        if(boss.hurt>0)boss.hurt=Math.max(0,boss.hurt-0.06*dt);
        drawIgloo(boss);
      }
      // ---- shockwave rings ----
      for(const ri of rings){ ri.r+=ri.vr*dt; ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore(); }
      rings=rings.filter(ri=>ri.life>0);
      // ---- snow puffs ----
      for(const p of puffs){ p.r+=p.vr*dt; p.life-=p.decay*dt;
        g.globalAlpha=Math.max(0,p.life)*0.5;g.fillStyle="#ffffff";
        g.beginPath();g.arc(p.x,p.y,p.r,0,TAU);g.fill(); }
      g.globalAlpha=1;puffs=puffs.filter(p=>p.life>0);
      // ---- ice shards ----
      for(const c of ice){ c.vy+=0.4*dt; c.x+=c.vx*dt; c.y+=c.vy*dt; c.rot+=c.vr*dt; c.life-=c.decay*dt;
        if(c.y>api.H-2){c.y=api.H-2;c.vy*=-0.4;c.vx*=0.7;if(Math.abs(c.vy)<1.2)c.life-=0.05*dt;}
        g.save();g.globalAlpha=Math.max(0,c.life);g.translate(c.x,c.y);g.rotate(c.rot);
        drawShard(c);g.restore(); }
      g.globalAlpha=1;ice=ice.filter(c=>c.life>0);
      if(ice.length>240)ice.splice(0,ice.length-240);
      // ---- kind別のこわれ方(塔=回転して倒れる/だるま=つぶれる) ----
      for(const d of debris){ d.life-=d.decay*dt;
        g.save();g.globalAlpha=Math.max(0,d.life);g.translate(d.x,d.y);
        if(d.kind==="tower"){
          d.rot+=d.vr*dt*0.05;
          g.translate(0,d.r*0.3);g.rotate(d.rot);g.translate(0,-d.r*0.3);
          drawTowerDebris(d.r,d.col);
        }else if(d.kind==="stack"){
          d.sy=Math.max(0.12,d.sy-0.05*dt);d.sx=Math.min(1.6,d.sx+0.03*dt);
          g.scale(d.sx,d.sy);
          drawStackDebris(d.r,d.col);
        }
        g.restore(); }
      g.globalAlpha=1;debris=debris.filter(d=>d.life>0);
      // ---- sparks (additive) ----
      g.save();g.globalCompositeOperation="lighter";
      for(const s of sparks){ s.vy+=0.18*dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=s.decay*dt;
        const a=Math.max(0,s.life);g.globalAlpha=a;g.fillStyle=s.col;g.shadowBlur=8;g.shadowColor=s.col;
        g.beginPath();g.arc(s.x,s.y,s.s*a+0.5,0,TAU);g.fill(); }
      g.restore();g.shadowBlur=0;g.globalAlpha=1;g.globalCompositeOperation="source-over";
      sparks=sparks.filter(s=>s.life>0);
      if(sparks.length>300)sparks.splice(0,sparks.length-300);
      // ---- floating text (ゴールド！/+10 etc.) ----
      for(const f of floats){ f.y+=f.vy*dt; f.life-=0.02*dt;
        g.save();g.globalAlpha=Math.max(0,f.life);g.textAlign="center";
        g.font="900 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=6;g.lineJoin="round";g.strokeStyle="rgba(20,60,100,.7)";
        g.strokeText(f.txt,f.x,f.y);g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.restore(); }
      g.globalAlpha=1;g.textAlign="left";g.lineJoin="miter";
      floats=floats.filter(f=>f.life>0);
      // ---- combo countdown ----  (③ コンボが切れたら このステージのノンストップは失敗)
      if(combo>0){ comboT-=0.016*dt; if(comboT<=0){combo=0;comboKept=false;} }
      // ---- impact flash ----
      if(flash>0){ flash-=0.06*dt; const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa*0.3;
        g.fillStyle=flashHue;g.fillRect(0,0,api.W,api.H);
        g.globalAlpha=fa*0.18;g.fillStyle="#fff";g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over"; }
      // ---- big chain full-screen burst ----
      if(chainT>0){ chainT=Math.max(0,chainT-0.016*dt); const tc=Math.min(1,chainT);
        g.save();g.globalCompositeOperation="lighter";g.translate(api.W/2,api.H*0.45);
        g.globalAlpha=tc*0.5;
        for(let i=0;i<16;i++){ g.rotate(TAU/16); g.fillStyle=COLORS[i%COLORS.length];
          const rl=api.W*0.7*(0.5+0.5*Math.sin(tsec*5+i));
          g.beginPath();g.moveTo(0,0);g.lineTo(rl,-12);g.lineTo(rl,12);g.closePath();g.fill(); }
        g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";
        // chain banner (top-center safe zone)
        const pop=1+0.12*Math.sin(tsec*9)*tc;
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.globalAlpha=tc;
        g.textAlign="center";g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=9;g.lineJoin="round";g.strokeStyle="rgba(20,60,100,.7)";
        const txt="れんさ x"+chainN+"！";
        g.strokeText(txt,0,0);
        let bg=g.createLinearGradient(0,-26,0,26);bg.addColorStop(0,"#ffffff");bg.addColorStop(1,"#7fd0ff");
        g.fillStyle=bg;g.fillText(txt,0,0);
        g.restore();g.globalAlpha=1;g.lineJoin="miter";g.textAlign="left"; }
      // ---- boss defeat full-screen golden rays ----
      if(bossCele>0){ bossCele=Math.max(0,bossCele-0.016*dt); const tc=Math.min(1,bossCele);
        g.save();g.globalCompositeOperation="lighter";g.translate(api.W/2,api.H*0.5);
        g.globalAlpha=tc*0.45;
        for(let i=0;i<14;i++){ g.rotate(TAU/14); g.fillStyle=GOLD_RB[i%GOLD_RB.length];
          const rl=api.W*0.75*(0.5+0.5*Math.sin(tsec*4+i));
          g.beginPath();g.moveTo(0,0);g.lineTo(rl,-14);g.lineTo(rl,14);g.closePath();g.fill(); }
        g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over"; }
      // ---- combo text (top-center) ----
      if(combo>1&&chainT<=0){ const cp=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.16);g.scale(cp,cp);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);g.shadowColor="rgba(80,160,255,.8)";g.shadowBlur=14;
        g.fillStyle="#ffffff";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(120,200,255,.7)";g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left"; }
      // ① にじいろイグルー！ 発見バナー(虹色に色替わり・上部中央=HUD安全帯)
      if(rbMsgT>0){ rbMsgT-=0.016*dt; const pop=1+Math.max(0,rbMsgT-1)*1.3;
        const rc=GOLD_RB[Math.floor(tsec*6)%GOLD_RB.length];
        g.save();g.translate(api.W/2,api.H*0.24);g.scale(pop,pop);g.globalAlpha=clamp(rbMsgT*1.4,0,1);
        g.textAlign="center";g.font="900 40px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=8;g.lineJoin="round";g.strokeStyle="rgba(20,60,100,.6)";
        g.strokeText("にじいろイグルー！",0,0);g.fillStyle=rc;g.fillText("にじいろイグルー！",0,0);
        g.restore();g.globalAlpha=1;g.lineJoin="miter";g.textAlign="left";if(rbMsgT<0)rbMsgT=0; }
      // ① にじいろが にげた の小表示
      if(rbEscT>0){ rbEscT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.37);g.globalAlpha=clamp(rbEscT,0,1);
        g.textAlign="center";g.font="800 20px 'Hiragino Maru Gothic ProN',system-ui";
        g.fillStyle="#7fb0d8";g.fillText("にじいろ にげちゃった…",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbEscT<0)rbEscT=0; }
      // ② きょうのラッキー色 ヒント(初回だけ大きく中央上に教える)
      if(luckyMsgT>0){ luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.31);g.globalAlpha=clamp(luckyMsgT*1.3,0,1);
        g.textAlign="center";g.font="800 23px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうの ラッキーな はたは "+lucky.n+"！";
        g.lineWidth=5;g.lineJoin="round";g.strokeStyle="rgba(20,60,100,.5)";g.strokeText(t2,0,0);
        g.fillStyle=lucky.c;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.lineJoin="miter";g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0; }
      // ---- HUD: stage + progress gauge (top-center safe zone) ----
      drawHUD();
      // ---- STAGE CLEAR banner ----
      if(clearT>0){ clearT-=0.016*dt; const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.45;g.fillStyle="#0b2a44";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-(bossJust?1.7:1.3))*1.8;
        const main=bossJust?"ボスを たおした！":"ステージ"+clearStage+" クリア！";
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=bossJust?"rgba(255,210,63,.9)":"rgba(120,200,255,.9)";g.shadowBlur=20;g.fillStyle="#eaf6ff";
        g.fillText(main,0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=bossJust?"#ffd23f":"#7fd0ff";g.strokeText(main,0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText(nextTxt||("つぎは ステージ"+(clearStage+1)+"！"),0,42);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=14;
          if(pendingBoss){pendingBoss=false;bossWarn=1.6;
            api.slide(80,45,1.4,0.35,"sine");api.noise(1.2,0.18,150,"lowpass");}} }
    },
    stop(){}
  };
  function drawHUD(){
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.045;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#0b3a5a";g.shadowColor="rgba(255,255,255,.6)";g.shadowBlur=6;
    if(boss||bossWarn>0){
      g.fillText(boss?"ボスイグルー を たたけ！":"なにか くるぞ…！",api.W/2,by-8);
      g.shadowBlur=0;
      g.fillStyle="rgba(10,50,80,.28)";rrect(bx,by,bw,bh,bh/2);g.fill();
      const fr=boss?clamp(boss.hp/boss.hpMax,0,1):1;
      if(fr>0){ const gg=g.createLinearGradient(bx,0,bx+bw,0);
        gg.addColorStop(0,"#ff8a3a");gg.addColorStop(1,"#ff5b5b");
        g.fillStyle=gg;rrect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill(); }
    }else{
      const left=clamp(stageGoal-stageKill,0,stageGoal);
      g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
      g.shadowBlur=0;
      g.fillStyle="rgba(10,50,80,.28)";rrect(bx,by,bw,bh,bh/2);g.fill();
      const fr=clamp(stageKill/stageGoal,0,1);
      if(fr>0){ const gg=g.createLinearGradient(bx,0,bx+bw,0);
        gg.addColorStop(0,"#aee6ff");gg.addColorStop(1,"#ffffff");
        g.fillStyle=gg;rrect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill(); }
    }
    g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=2;rrect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }
  function drawIgloo(it){
    const x=it.x,y=it.y,r=it.r,e=ease(it.born),hq=it.hurt||0;
    const sc=e*(1+Math.sin(it.wob)*0.02);
    const jx=(it.gold||it.rainbow)?Math.sin(it.blink*10)*1.5:0;   // gold/rainbow: excited jiggle
    // にじいろは体色を虹色に巡回(旗の色とは別)
    const col=it.rainbow?GOLD_RB[Math.floor(tsec*6+it.wob)%GOLD_RB.length]:it.col;
    // 軸7: 形ちがい。it.kind未指定(ボス)は従来どおりドーム扱い。
    const kind=it.kind||"dome";
    // 各形の「頭のてっぺん」Y(旗・スターの位置あわせに使う。dome/ボスは従来どおり-r)
    const topY=kind==="tower"?-r*1.25:kind==="stack"?-r*1.02:kind==="icicle"?-r*1.05:-r;
    g.save();g.translate(x+jx,y);g.scale(sc*(1+hq*0.14),sc*(1-hq*0.11));
    if(it.esc>0)g.globalAlpha=clamp(it.esc,0,1);   // ① 逃げる にじいろの フェード
    // aura glow (makes rare ones pop instantly) — gold=金 / rainbow=虹色巡回
    if(it.gold||it.rainbow){ g.save();g.globalCompositeOperation="lighter";
      const ga=0.3+0.2*Math.sin(it.blink*6);
      const ac=it.rainbow?col:"#ffe15a";
      const gr=g.createRadialGradient(0,-r*0.2,0,0,-r*0.2,Math.max(0,r*1.6));
      gr.addColorStop(0,hexA(ac,ga));gr.addColorStop(1,hexA(ac,0));
      g.fillStyle=gr;g.beginPath();g.arc(0,-r*0.2,Math.max(0,r*1.6),0,TAU);g.fill();g.restore(); }
    // ground shadow (形なりに横幅を変える)
    const shW=kind==="icicle"?r*0.55:kind==="tower"?r*0.75:r*1.05;
    g.fillStyle="rgba(40,80,120,.18)";g.beginPath();g.ellipse(0,r*0.5,Math.max(0,shW),Math.max(0,r*0.3),0,0,TAU);g.fill();
    // 画像イグルー: ふつう(dome)=氷ブロックの絵。ゴールド/ボス/にじいろ/塔/だるま/つららは手描き。
    // 絵は「ドーム(幅≈全体の7割)＋雪の台座(幅いっぱい)」で、内容は正方形の縦64%(上18%〜下82%)に収まる。
    // 当たり判定(半径r)にドーム幅≈2rを合わせるため 一辺 r*2.6・中心 y=-0.3r で描く
    //  → ドーム天辺≈-1.1r(旗の根元が乗る)/台座の底≈+0.5r(手描きの影楕円の上)。
    const sprName=(!it.rainbow&&!it.gold&&!it.boss&&kind==="dome")?"igloo.png":null;
    const useImg=!!(sprName&&api.drawAsset(sprName,0,-r*0.3,r*2.6,r*2.6,{center:true}));
    if(!useImg){
      if(kind==="tower") drawTowerBody(it,r,col);
      else if(kind==="stack") drawStackBody(it,r,col);
      else if(kind==="icicle") drawIcicleBody(it,r,col);
      else drawDomeBody(it,r,col);
    }
    // ↓ここから下(目・ほっぺ・ボスのまゆ/ひび/HPバー・旗・星)は画像時も重ねる = 仕掛けと表情は無傷
    // cute eyes (little face)。つらら(icicle)はただの氷なので顔なし=壊れ方の違う物という手触りを出す。
    if(kind!=="icicle"){
      const faceY=kind==="tower"?-r*0.95:kind==="stack"?-r*0.62:-r*0.5;
      const faceX=kind==="tower"?r*0.26:kind==="stack"?r*0.24:r*0.34;
      const blink=Math.sin(it.blink*4)>0.94?0.15:1;
      g.fillStyle="#1a3550";
      g.beginPath();g.ellipse(-faceX,faceY,r*0.07,Math.max(0,r*0.09*blink),0,0,TAU);g.fill();
      g.beginPath();g.ellipse(faceX,faceY,r*0.07,Math.max(0,r*0.09*blink),0,0,TAU);g.fill();
      g.fillStyle="#fff";g.beginPath();g.arc(-faceX*0.94,faceY-r*0.03,r*0.025,0,TAU);g.arc(faceX*0.94,faceY-r*0.03,r*0.025,0,TAU);g.fill();
      // rosy cheeks
      g.fillStyle="rgba(255,150,170,.4)";g.beginPath();
      g.arc(-faceX*1.45,faceY+r*0.14,r*0.09,0,TAU);g.arc(faceX*1.45,faceY+r*0.14,r*0.09,0,TAU);g.fill();
    }
    if(it.boss){
      // angry eyebrows: this one means business
      g.strokeStyle="#1a3550";g.lineWidth=Math.max(2,r*0.06);g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.5,-r*0.7);g.lineTo(-r*0.22,-r*0.62);g.stroke();
      g.beginPath();g.moveTo(r*0.5,-r*0.7);g.lineTo(r*0.22,-r*0.62);g.stroke();
      // cracks appear as damage builds ("きいてるぞ" feedback)
      const dmg=1-it.hp/it.hpMax;
      g.strokeStyle="rgba(25,55,90,.7)";g.lineWidth=Math.max(2,r*0.04);
      if(dmg>0.2){ g.beginPath();g.moveTo(-r*0.6,-r*0.12);g.lineTo(-r*0.4,-r*0.32);g.lineTo(-r*0.5,-r*0.5);g.stroke(); }
      if(dmg>0.5){ g.beginPath();g.moveTo(r*0.55,-r*0.18);g.lineTo(r*0.35,-r*0.42);g.lineTo(r*0.5,-r*0.6);g.stroke(); }
      if(dmg>0.75){ g.beginPath();g.moveTo(0,-r*0.85);g.lineTo(-r*0.12,-r*0.62);g.lineTo(r*0.08,-r*0.45);g.stroke(); }
      // hp bar above head
      const bw2=r*1.7,bh2=Math.max(6,r*0.13),bx2=-bw2/2,by2=-r*1.5;
      g.fillStyle="rgba(10,40,70,.5)";rrect(bx2,by2,bw2,bh2,bh2/2);g.fill();
      const fr2=clamp(it.hp/it.hpMax,0,1);
      if(fr2>0){ g.fillStyle=fr2>0.5?"#7be08a":fr2>0.25?"#ffd23f":"#ff5b5b";
        rrect(bx2,by2,Math.max(bh2,bw2*fr2),bh2,bh2/2);g.fill(); }
      g.strokeStyle="rgba(255,255,255,.8)";g.lineWidth=2;rrect(bx2,by2,bw2,bh2,bh2/2);g.stroke();
    }
    // ② ふつうのイグルーの旗(色の見分けがつく目印)。ラッキー色はこの旗色で当てる。
    if(it.flag){
      const fy=topY;
      g.strokeStyle="#7a5a34";g.lineWidth=Math.max(1.5,r*0.05);g.lineCap="round";
      g.beginPath();g.moveTo(0,fy+r*0.04);g.lineTo(0,fy-r*0.44);g.stroke();
      const sw=0.6+0.4*Math.sin(it.wob*1.5);   // ゆらぐ布
      g.fillStyle=it.flag.c;g.beginPath();
      g.moveTo(0,fy-r*0.44);
      g.quadraticCurveTo(r*0.22*sw,fy-r*0.4,r*0.36,fy-r*0.34);
      g.quadraticCurveTo(r*0.22*sw,fy-r*0.3,0,fy-r*0.24);
      g.closePath();g.fill();
      g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=1;g.stroke();
    }
    if(it.gold||it.rainbow){
      // spinning sparkle star above the rare igloo (gold=金 / rainbow=虹色)
      g.save();g.globalCompositeOperation="lighter";
      g.translate(0,topY-r*0.3);g.rotate(it.wob*2);
      g.fillStyle=it.rainbow?col:"#fff2a0";g.shadowBlur=10;g.shadowColor=it.rainbow?col:"#ffd23f";
      starPath(r*0.24,r*0.1);g.fill();
      g.restore();
    }
    g.restore();g.lineCap="butt";g.globalAlpha=1;
  }
  // 軸7: 形ごとの見た目(いずれも it.gold/it.rainbow の枠色わけと共存できるよう col/it.col を使う)
  function drawDomeBody(it,r,col){
    // dome body
    const grd=g.createRadialGradient(-r*0.3,-r*0.35,Math.max(0,r*0.1),0,0,Math.max(0,r*1.3));
    grd.addColorStop(0,"#ffffff");grd.addColorStop(0.6,col);grd.addColorStop(1,shade(col,-28));
    g.fillStyle=grd;g.beginPath();g.arc(0,0,r,Math.PI,TAU);g.closePath();g.fill();
    // flat base
    g.fillStyle=shade(col,-18);g.fillRect(-r,-1,r*2,Math.max(0,r*0.18));
    // snow-block grid lines on the dome (arc rows + radial seams)
    g.strokeStyle=it.gold?"rgba(200,150,40,.5)":(it.rainbow?"rgba(255,255,255,.6)":"rgba(120,160,200,.5)");g.lineWidth=Math.max(1.5,r*0.04);
    for(let row=1;row<=2;row++){ const rr=Math.max(0,r*(1-row*0.32));
      g.beginPath();g.arc(0,0,rr,Math.PI,TAU);g.stroke(); }
    for(let i=-2;i<=2;i++){ const a=Math.PI+(i+2.5)/5*Math.PI;
      g.beginPath();g.moveTo(Math.cos(a)*r*0.34,Math.sin(a)*r*0.34);g.lineTo(Math.cos(a)*r,Math.sin(a)*r);g.stroke(); }
    // glossy top sheen
    g.fillStyle="rgba(255,255,255,.45)";g.beginPath();
    g.ellipse(-r*0.28,-r*0.5,Math.max(0,r*0.32),Math.max(0,r*0.16),-0.4,0,TAU);g.fill();
    // entrance tunnel
    g.fillStyle=shade(it.col,-22);g.beginPath();
    g.moveTo(-r*0.28,0);g.lineTo(-r*0.28,-r*0.34);g.arc(0,-r*0.34,Math.max(0,r*0.28),Math.PI,TAU);g.lineTo(r*0.28,0);g.closePath();g.fill();
    g.fillStyle="#16334d";g.beginPath();
    g.moveTo(-r*0.18,0);g.lineTo(-r*0.18,-r*0.28);g.arc(0,-r*0.28,Math.max(0,r*0.18),Math.PI,TAU);g.lineTo(r*0.18,0);g.closePath();g.fill();
  }
  function drawTowerBody(it,r,col){
    // 塔(tower): 縦長の四角 + てっぺんの雪帽子(丸だけじゃない・大きめの標的)
    const w=Math.max(0,r*0.86),top=-r*1.2,bot=r*0.32,rad=Math.max(0,Math.min(r*0.16,w/2));
    const grd=g.createLinearGradient(-w/2,top,w/2,bot);
    grd.addColorStop(0,"#ffffff");grd.addColorStop(0.55,col);grd.addColorStop(1,shade(col,-28));
    g.fillStyle=grd;g.beginPath();
    g.moveTo(-w/2+rad,top);g.lineTo(w/2-rad,top);g.arcTo(w/2,top,w/2,top+rad,rad);
    g.lineTo(w/2,bot);g.lineTo(-w/2,bot);g.lineTo(-w/2,top+rad);g.arcTo(-w/2,top,-w/2+rad,top,rad);
    g.closePath();g.fill();
    // flat base
    g.fillStyle=shade(col,-18);g.fillRect(-w*0.62,bot-1,w*1.24,Math.max(0,r*0.16));
    // horizontal seams (積み木感)
    g.strokeStyle=it.gold?"rgba(200,150,40,.5)":(it.rainbow?"rgba(255,255,255,.6)":"rgba(120,160,200,.5)");
    g.lineWidth=Math.max(1.5,r*0.035);
    for(let i=1;i<=3;i++){ const yy=top+(bot-top)*(i/4);
      g.beginPath();g.moveTo(-w/2+2,yy);g.lineTo(w/2-2,yy);g.stroke(); }
    // 雪帽子(てっぺんのふわっと)
    g.fillStyle="#ffffff";g.beginPath();g.ellipse(0,top,Math.max(0,w*0.62),Math.max(0,r*0.22),0,0,TAU);g.fill();
    // small window (見分け用)
    g.fillStyle=shade(it.col,-30);g.beginPath();g.arc(0,bot-r*0.5,Math.max(0,r*0.14),0,TAU);g.fill();
  }
  function drawStackBody(it,r,col){
    // だるま(stack): 丸を2段重ね(でこぼこの標的・丸だけじゃない)
    const rb=Math.max(0,r*0.6),rt=Math.max(0,r*0.42),cyB=r*0.14,cyT=-r*0.56;
    const g1=g.createRadialGradient(-rb*0.3,cyB-rb*0.3,Math.max(0,rb*0.1),0,cyB,Math.max(0,rb*1.2));
    g1.addColorStop(0,"#ffffff");g1.addColorStop(0.6,col);g1.addColorStop(1,shade(col,-28));
    g.fillStyle=g1;g.beginPath();g.arc(0,cyB,rb,0,TAU);g.fill();
    const g2=g.createRadialGradient(-rt*0.3,cyT-rt*0.3,Math.max(0,rt*0.1),0,cyT,Math.max(0,rt*1.2));
    g2.addColorStop(0,"#ffffff");g2.addColorStop(0.6,col);g2.addColorStop(1,shade(col,-28));
    g.fillStyle=g2;g.beginPath();g.arc(0,cyT,rt,0,TAU);g.fill();
    g.strokeStyle=it.gold?"rgba(200,150,40,.5)":(it.rainbow?"rgba(255,255,255,.6)":"rgba(120,160,200,.5)");
    g.lineWidth=Math.max(1.5,r*0.035);
    g.beginPath();g.arc(0,cyT,rt,0,TAU);g.stroke();
    g.beginPath();g.arc(0,cyB,rb,0,TAU);g.stroke();
    // 下だまの小さな扉(見分け用)
    g.fillStyle=shade(it.col,-30);g.beginPath();g.arc(0,cyB+rb*0.3,Math.max(0,rb*0.22),0,TAU);g.fill();
  }
  function drawIcicleBody(it,r,col){
    // つらら(icicle): 細い三角(小さくて速く狙う標的・大きさのバラエティ)
    const top=-r*1.05,bw=Math.max(0,r*0.3),bot=r*0.4;
    const grd=g.createLinearGradient(0,top,0,bot);
    grd.addColorStop(0,"#ffffff");grd.addColorStop(0.55,col);grd.addColorStop(1,shade(col,-24));
    g.fillStyle=grd;g.beginPath();g.moveTo(0,top);g.lineTo(bw,bot);g.lineTo(-bw,bot);g.closePath();g.fill();
    g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=Math.max(1,r*0.03);
    g.beginPath();g.moveTo(-bw*0.25,top+r*0.2);g.lineTo(-bw*0.1,bot-r*0.1);g.stroke();
  }
  // ---- こわれ方の演出用の簡易シルエット(debris) ----
  function drawTowerDebris(r,col){
    const w=Math.max(0,r*0.86),top=-r*1.2,bot=r*0.32;
    g.fillStyle=shade(col,-6);g.fillRect(-w/2,top,w,bot-top);
    g.fillStyle="#ffffff";g.beginPath();g.ellipse(0,top,Math.max(0,w*0.55),Math.max(0,r*0.18),0,0,TAU);g.fill();
  }
  function drawStackDebris(r,col){
    const rb=Math.max(0,r*0.6),rt=Math.max(0,r*0.42);
    g.fillStyle=shade(col,-6);
    g.beginPath();g.arc(0,r*0.14,rb,0,TAU);g.fill();
    g.beginPath();g.arc(0,-r*0.56,rt,0,TAU);g.fill();
  }
  function starPath(R,r2){ g.beginPath();
    for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r2:R;
      if(i)g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);else g.moveTo(Math.cos(a)*rr,Math.sin(a)*rr); }
    g.closePath(); }
  function drawShard(c){ const s=c.s;
    g.beginPath();g.moveTo(0,-s*0.6);g.lineTo(s*0.5,0);g.lineTo(0,s*0.6);g.lineTo(-s*0.5,0);g.closePath();
    const grd=g.createLinearGradient(-s*0.5,-s*0.6,s*0.5,s*0.6);
    grd.addColorStop(0,"#ffffff");grd.addColorStop(1,c.col);
    g.fillStyle=grd;g.fill();
    g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=1;g.stroke();
  }
  function rrect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function shade(hex,amt){let n=parseInt(hex.slice(1),16);
    let r=clamp((n>>16)+amt,0,255),gg=clamp(((n>>8)&255)+amt,0,255),bb=clamp((n&255)+amt,0,255);
    return"rgb("+r+","+gg+","+bb+")";}
  function hexA(hex,a){let n=parseInt(hex.slice(1),16);
    return"rgba("+(n>>16)+","+((n>>8)&255)+","+(n&255)+","+a+")";}
}
Engine.register("igloo", build_igloo);
