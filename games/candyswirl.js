function build_candyswirl(api){
  const g=api.g;
  api.preload(["bg.jpg","comet.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)
  // goldstar.png はレビューで2回作り直しても影/穴の不良が残ったため不使用(手描きのまま。issues参照)
  let sweets=[],vortices=[],shards=[],sparks=[],rings=[],floats=[],puffs=[],motes=[],clouds=[];
  let tsec=0,count=0,combo=0,comboT=0,spawnT=0,flash=0;
  // stage progression: clear a quota -> "ステージ クリア!" -> harder endless
  // 7〜8歳向けに手応えを増量(旧: 12+(s-1)*3 → 約25%増)
  let stage=1,stageKill=0,stageGoal=15,clearT=0,clearStage=0;
  // fever gauge (fills per pop) / fever mode timer(sec) / banner / hitStop cooldown
  let fever=0,feverOn=0,feverBanner=0,hsCD=0;
  const SWEETS=[
    {col:"#ff8fb3",ac:"#ffd1e0",kind:"candy"},   // pink candy
    {col:"#8a5a3a",ac:"#c79a6a",kind:"choco"},    // chocolate
    {col:"#7be08a",ac:"#d0ffd6",kind:"gummy"},    // green gummy
    {col:"#9be8ff",ac:"#e0f7ff",kind:"candy"},    // blue candy
    {col:"#ffd23f",ac:"#fff0a6",kind:"cake"},     // cake
    {col:"#c78bff",ac:"#ecd6ff",kind:"gummy"}     // purple gummy
  ];
  const SWIRLCOL=["#ff7bd0","#ffd23f","#9be8ff","#7be08a","#c78bff","#ffffff"];
  // rare golden star candy: glows, big bonus on pop
  const GOLD={col:"#ffd23f",ac:"#fff6c0",kind:"star"};
  // ① 激レア にじいろキャンディ: goldより さらにレア。虹色に回り、割ると虹の大盤振る舞い
  const RAINBOW={col:"#ff5b7e",ac:"#ffffff",kind:"rainbow"};
  let R=40; // base sweet radius (set in layout)

  // ---- 隠し発見レイヤー(ハンマー/トラックと同じ思想) ----
  // ② きょうのラッキー色: セッションで秘密の1色を選ぶ。その色を割ると小ボーナス＋頭上に星のキラッ
  const SWNAME={"#ff8fb3":"ももいろ","#8a5a3a":"チョコいろ","#7be08a":"みどり","#9be8ff":"みずいろ","#ffd23f":"きいろ","#c78bff":"むらさき"};
  let luckyColor=pick(SWEETS).col, luckySeen=false, luckyMsgT=0, luckyTeachT=0;
  let rbMsgT=0;                       // ① にじいろキャンディ 発見バナー
  // ③ ノンストップ判定: このステージ中にコンボを一度も切らさなかったらボーナス
  let nonstopBroken=false, nonstopT=0;
  // ④ ながれ星: たまに空を横切る。ちかくに うずまきを おくとキャッチ = ごほうび(減点なし)
  let comet=null, cometT=rnd(5,10), catchMsgT=0;

  function layout(){
    R=clamp(Math.min(api.W,api.H)*0.045,22,46);
    clouds=[];
    for(let i=0;i<5;i++)clouds.push({x:rnd(0,api.W),y:api.H*rnd(0.05,0.3),s:rnd(0.7,1.5),sp:rnd(0.05,0.16),a:rnd(0.4,0.8),col:pick(["#ffffff","#ffe4f2","#fff4c8","#e0f7ff"])});
    motes=[];
    for(let i=0;i<24;i++)motes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(0.8,2.6),sp:rnd(0.08,0.4),tw:rnd(0,TAU),col:pick(["#fff","#ffe0f0","#fff0b0"])});
  }
  layout();

  function stageGoalFor(s){return 15+(s-1)*4;}

  function newSweet(){
    // rare gold star: chance grows a little each stage (kept low so it feels special)
    const gold=Math.random()<clamp(0.05+stage*0.01,0.06,0.12);
    // ① にじいろキャンディ: goldより さらにレア(約3%)。ステージ2以降だけ = 「いつ出るか分からない」ドキドキ
    const rainbow=!gold && stage>=2 && Math.random()<0.03;
    const def=rainbow?RAINBOW:(gold?GOLD:pick(SWEETS));
    const special=gold||rainbow;
    const a=rnd(0,TAU), spd=rnd(0.24,0.58)+stage*0.05; // 7〜8歳向けに少しキビキビ(旧より約2割速い)
    // 軸7(バラエティ): 特殊レア以外にも「大きい/小さい」の対比を混ぜる(通常枠の20%を大玉、15%を小玉に)
    let sizeRoll;
    if(special) sizeRoll=rnd(1.05,1.22);
    else { const rr=Math.random();
      sizeRoll = rr<0.20 ? rnd(1.5,1.8) : rr<0.35 ? rnd(0.5,0.65) : rnd(0.82,1.18); }
    return {x:rnd(R,api.W-R), y:rnd(api.H*0.16,api.H*0.92),
      vx:Math.cos(a)*spd, vy:Math.sin(a)*spd, r:R*sizeRoll,
      def, gold, rainbow, rot:rnd(0,TAU), vr:special?rnd(-0.06,0.06):rnd(-0.04,0.04), bob:rnd(0,TAU),
      caught:null, state:"free", squash:1};
  }
  function fill(){
    const want=clamp(9+stage,9,20); // 7〜8歳向けに画面のおかしをやや多めに
    while(sweets.length<want) sweets.push(newSweet());
  }
  fill();

  function spawnVortex(x,y){
    api.tone(560,0.1,"sine",0.12); api.slide(300,620,0.18,0.12,"triangle");
    api.noise(0.14,0.1,2200,"highpass",0.8);
    for(let i=0;i<7;i++){const a=rnd(0,TAU),s=rnd(2,5);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(6,12),life:1,decay:rnd(0.05,0.09),col:pick(SWIRLCOL)});}
    vortices.push({x,y,t:0,life:1,grow:0,pull:R*2.0,spin:0,col:pick(SWIRLCOL),held:0,kills:0});
  }

  function fling(s,vx,vy){
    s.caught=null; s.state="free"; s.vx=vx; s.vy=vy; s.squash=1.4;
  }

  function popSweet(s,vortCol){
    // a sweet that was flung hits a wall (or another sweet) -> shatters
    s.state="dead";
    const gold=s.def.kind==="star";
    const rainbow=s.def.kind==="rainbow";
    // ② きょうのラッキー色: 今日の秘密の色(ふつうのおかし)を割ると +1 の隠しボーナス
    const isLucky=!gold&&!rainbow&&s.def.col===luckyColor;
    let gain=(rainbow?10:gold?5:1)*(feverOn>0?2:1);   // fever = everything x2
    if(isLucky) gain+=1*(feverOn>0?2:1);
    count+=gain; stageKill+=rainbow?3:gold?2:1; combo++; comboT=1.0; api.setScore(count);
    // fever gauge fills per pop (gold/rainbow gives a big chunk)
    if(feverOn<=0){ fever=Math.min(1,fever+(rainbow?0.4:gold?0.3:0.08)); if(fever>=1) startFever(); }
    const ct=clamp(combo,0,12);
    api.slide(360+ct*22,150,0.12,0.26,"square");
    api.noise(0.1,0.16,1500,"bandpass",0.9);
    api.tone(520*Math.pow(2,ct/12),0.12,"triangle",0.12);
    api.boom(0.4+Math.min(combo,8)*0.02); api.shake(5+Math.min(combo,8));
    // hitStop only on big moments (gold / combo milestones) with cooldown
    if((gold||combo===5||combo===10)&&hsCD<=0){ api.hitStop(gold?4:3); hsCD=32; }
    flash=Math.min(1,flash+0.3);
    const col=s.def.col;
    rings.push({x:s.x,y:s.y,r:s.r*0.6,vr:s.r*0.7,life:1,decay:0.06,col});
    rings.push({x:s.x,y:s.y,r:s.r*0.3,vr:s.r*0.5,life:1,decay:0.05,col:"#fff"});
    // 軸7(バラエティ): 壊れ方をkindごとに変える(丸シャード一辺倒をやめる)
    const kind=s.def.kind;
    if(kind==="choco"){
      // 四角いチョコの欠片
      const n=6+Math.min(combo,4);
      for(let i=0;i<n;i++){const a=rnd(0,TAU),sp=rnd(2,7);
        shards.push({x:s.x,y:s.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,r:rnd(4,8),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.014,0.022),
          shape:"square",col:i%2===0?col:s.def.ac});}
    } else if(kind==="gummy"){
      // 伸びる楕円が2〜3個に裂ける
      const n=rint(2,3);
      for(let i=0;i<n;i++){const a=rnd(0,TAU),sp=rnd(2,6);
        shards.push({x:s.x,y:s.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,r:rnd(6,10),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.01,0.016),
          shape:"oval",col:i%2===0?col:s.def.ac});}
    } else if(kind==="cake"){
      // クリーム色の細長い飛沫
      const n=7+Math.min(combo,5);
      for(let i=0;i<n;i++){const a=rnd(0,TAU),sp=rnd(3,8);
        shards.push({x:s.x,y:s.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2.5,r:rnd(3,6),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.016,0.026),
          shape:"drip",col:i%2===0?"#fff3f7":"#ffd6ea"});}
    } else {
      const n=9+Math.min(combo,6);
      for(let i=0;i<n;i++){const a=rnd(0,TAU),sp=rnd(2.5,8);
        shards.push({x:s.x,y:s.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,r:rnd(3,7),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.014,0.024),
          col:i%3===0?col:(i%3===1?s.def.ac:"#ffffff")});}
    }
    for(let i=0;i<rint(5,8);i++){const a=rnd(0,TAU),sp=rnd(4,10);
      sparks.push({x:s.x,y:s.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,len:rnd(8,16),life:1,decay:rnd(0.05,0.09),col:pick(SWIRLCOL)});}
    puffs.push({x:s.x,y:s.y,r:s.r*0.5,vr:1.2,life:1,decay:0.03,col:s.def.ac});
    if(gold){
      // GOLD celebration: rainbow triple ring + shard shower + fanfare
      flash=Math.min(1,flash+0.5); api.boom(0.7); api.shake(12);
      [0,4,7,12].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.16,"triangle",0.11),i*70));
      for(let i=0;i<3;i++)rings.push({x:s.x,y:s.y,r:s.r*(0.35+i*0.3),vr:s.r*(0.5+i*0.2),life:1,decay:0.04,col:SWIRLCOL[i]});
      for(let i=0;i<16;i++){const a=rnd(0,TAU),sp=rnd(3,9);
        shards.push({x:s.x,y:s.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2.5,r:rnd(4,8),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.02),col:pick(SWIRLCOL)});}
      floats.push({x:s.x,y:s.y-s.r*1.3,txt:"ゴールド +"+gain,life:1,vy:-1,col:"#ffd23f",size:38});
    } else if(rainbow){
      // ① にじいろキャンディ 撃破: 虹の輪が6色ぶわっと + 大量きらめき + 発見バナー(激レアの爽快ごほうび)
      rbMsgT=1.5; flash=Math.min(1,flash+0.5); api.boom(0.75); api.shake(15);
      if(hsCD<=0){ api.hitStop(5); hsCD=32; }
      api.slide(660,1320,0.5,0.22,"triangle");
      [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.16,"triangle",0.1),i*60));
      for(let i=0;i<SWIRLCOL.length;i++)
        rings.push({x:s.x,y:s.y,r:Math.max(1,s.r*0.4),vr:s.r*(0.5+i*0.14),life:1,decay:0.045,col:SWIRLCOL[i]});
      for(let i=0;i<24;i++){const a=rnd(0,TAU),sp=rnd(3,10);
        shards.push({x:s.x,y:s.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2.5,r:rnd(4,8),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.02),col:SWIRLCOL[i%SWIRLCOL.length]});}
      floats.push({x:s.x,y:s.y-s.r*1.3,txt:"にじいろ +"+gain,life:1,vy:-1,col:"#ff7bd0",size:38});
    } else if(gain>1){
      floats.push({x:s.x,y:s.y-s.r*1.2,txt:"+"+gain,life:1,vy:-0.9,col:"#fff",size:24});
    }
    // ② ラッキー色: 割った瞬間 頭上に小さな星のキラッ(気づけるヒント)＋初回だけ中央で教える
    if(isLucky){
      if(!luckySeen){ luckyTeachT=2.0; }   // 初回だけ「きょうのラッキーいろは◯!」を中央上に一度
      else { luckyMsgT=Math.max(luckyMsgT,0.9); }
      luckySeen=true;
      api.tone(1046,0.14,"triangle",0.1); api.tone(1568,0.16,"triangle",0.08);
      for(let i=0;i<7;i++){const a=rnd(-TAU*0.5,0),sp=rnd(1.5,4);
        shards.push({x:s.x,y:s.y-s.r*0.6,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,r:rnd(3,5.5),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:luckyColor});}
    }
    if(combo>1)floats.push({x:s.x,y:s.y-s.r,txt:"x"+combo,life:1,vy:-1.1,
      col:combo>=8?"#ff2bff":combo>=5?"#ff8c42":"#ffd23f",size:combo>=5?40:30});
    checkStage();
  }

  function startFever(){
    fever=0; feverOn=10; feverBanner=2.0; flash=1;
    api.boom(0.7); api.shake(18);
    api.slide(400,1200,0.4,0.22,"sawtooth");
    [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(523*Math.pow(2,semi/12),0.15,"triangle",0.12),i*60));
    // sweets swarm in for the party
    while(sweets.filter(s=>s.state!=="dead").length<clamp(9+stage,9,20)+5&&sweets.length<26)
      sweets.push(newSweet());
    for(let i=0;i<20;i++){const a=rnd(0,TAU),sp=rnd(3,9);
      sparks.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,len:rnd(8,18),life:1,decay:rnd(0.03,0.06),col:pick(SWIRLCOL)});}
  }

  function checkStage(){
    if(stageKill<stageGoal||clearT>0)return;
    clearStage=stage; clearT=1.7; flash=Math.min(1,flash+0.5);
    api.boom(0.6); api.shake(14);
    api.slide(523,784,0.3,0.2,"triangle"); api.tone(660,0.25,"triangle",0.14);
    api.tone(988,0.3,"triangle",0.1);
    for(let i=0;i<22;i++){const a=rnd(0,TAU),sp=rnd(3,9);
      shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(SWIRLCOL)});}
    // ③ ノンストップ ボーナス: このステージ中に一度もコンボを切らさなかったら +3 & 祝福バナー(気づくと得)
    if(!nonstopBroken){
      count+=3; api.setScore(count); nonstopT=1.9;
      api.tone(1318,0.16,"triangle",0.12); api.tone(1760,0.18,"triangle",0.09);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),sp=rnd(3,8);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2.5,r:rnd(4,8),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:"#ffd23f"});}
    }
    nonstopBroken=false;   // 次のステージ用にリセット
    stage++; stageGoal=stageGoalFor(stage); stageKill=0;
  }

  return {
    resize:layout,
    input(x,y,type){
      if(type!=="down"||clearT>0)return;
      // tap: drop a candy vortex; it sucks in nearby sweets and flings them
      // 軸3(歯ごたえ): 同時うずまき数を絞り、適当な連打では画面全体をカバーできないようにする
      if(vortices.length<4) spawnVortex(x,y);
      else { vortices.shift(); spawnVortex(x,y); }
      // ④ ながれ星キャッチ: うずまきを ながれ星の ちかくに おけると ごほうび(減点なし・操作は普通のまま)
      if(comet&&!comet.caught&&Math.hypot(x-comet.x,y-comet.y)<Math.max(R*2.6,70)){
        comet.caught=true; catchMsgT=1.4;
        const bonus=2*(feverOn>0?2:1); count+=bonus; api.setScore(count);
        api.tone(1046,0.12,"triangle",0.11); api.tone(1568,0.14,"triangle",0.09); api.tone(2093,0.16,"triangle",0.06);
        for(let i=0;i<16;i++){const a=rnd(0,TAU),sp=rnd(3,9);
          sparks.push({x:comet.x,y:comet.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,len:rnd(8,16),life:1,decay:rnd(0.04,0.07),col:pick(SWIRLCOL)});}
        for(let i=0;i<10;i++){const a=rnd(0,TAU),sp=rnd(2,6);
          shards.push({x:comet.x,y:comet.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,r:rnd(3,6),
            rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.016,0.026),col:i%2?"#ffd23f":"#fff7c2"});}
        floats.push({x:comet.x,y:comet.y-14,txt:"ながれ星 +"+bonus,life:1,vy:-1,col:"#ffd23f",size:26});
      }
    },
    frame(dt,now){
      tsec+=0.016*dt;
      // ---- background: 画像があれば cover-fit、無ければ従来の手描きパステル背景 ----
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景の上に薄くキャンディ色を重ねてほんのり彩度を足す(絵と喧嘩しない程度)
        g.save(); g.globalAlpha=0.14;
        let tg=g.createLinearGradient(0,0,0,api.H);
        tg.addColorStop(0,"#ffd6ea"); tg.addColorStop(0.6,"#e7d4ff"); tg.addColorStop(1,"#d6ecff");
        g.fillStyle=tg; g.fillRect(0,0,api.W,api.H); g.restore();
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,"#ffe3f1"); grd.addColorStop(0.4,"#ffd6ea");
        grd.addColorStop(0.72,"#e7d4ff"); grd.addColorStop(1,"#d6ecff");
        g.fillStyle=grd; g.fillRect(0,0,api.W,api.H);
      }
      // sun-glow upper area (画像でもふんわり光を足す軽い効果なのでそのまま)
      let glow=g.createRadialGradient(api.W*0.5,api.H*0.08,0,api.W*0.5,api.H*0.08,api.W*0.7);
      glow.addColorStop(0,"rgba(255,255,230,.5)"); glow.addColorStop(1,"rgba(255,255,230,0)");
      g.fillStyle=glow; g.fillRect(0,0,api.W,api.H);
      // 画像背景のときは絵の中の丘/雲を活かして、平坦な手描きの丘と雲はスキップ
      if(!imgBg){
        // soft candy hills at the bottom
        g.save();
        const hills=[["#ffc6e6",0.86,0.05],["#ffb3dc",0.93,0.06]];
        for(const hl of hills){const y0=api.H*hl[1];
          g.fillStyle=hl[0]; g.beginPath(); g.moveTo(0,api.H);
          for(let xx=0;xx<=api.W;xx+=26)g.lineTo(xx,y0+Math.sin(xx/api.W*TAU*1.5+tsec*0.3+hl[1])*api.H*hl[2]);
          g.lineTo(api.W,api.H); g.closePath(); g.fill();}
        g.restore();
        // drifting fluffy candy clouds
        for(const c of clouds){
          c.x+=c.sp*dt; if(c.x>api.W+90*c.s)c.x=-90*c.s;
          g.globalAlpha=c.a; g.fillStyle=c.col; const w=44*c.s;
          g.beginPath();
          g.ellipse(c.x,c.y,w,w*0.55,0,0,TAU);
          g.ellipse(c.x+w*0.8,c.y+w*0.12,w*0.7,w*0.45,0,0,TAU);
          g.ellipse(c.x-w*0.8,c.y+w*0.14,w*0.62,w*0.4,0,0,TAU);
          g.fill();
        }
        g.globalAlpha=1;
      }
      // twinkling sugar motes (additive sparkle)
      g.save(); g.globalCompositeOperation="lighter";
      for(const m of motes){
        m.x+=m.sp*0.4*dt; m.y-=m.sp*0.18*dt; m.tw+=0.05*dt;
        if(m.x>api.W)m.x=0; if(m.y<0)m.y=api.H;
        g.globalAlpha=0.2+0.4*(0.5+0.5*Math.sin(m.tw));
        g.fillStyle=m.col; g.beginPath(); g.arc(m.x,m.y,m.r,0,TAU); g.fill();
      }
      g.restore(); g.globalAlpha=1;

      // ④ ながれ星: たまに空を横切る(接近予告=空に光が現れる)。うずまきで キャッチすると ごほうび
      const paused0=clearT>0;
      if(!paused0){
        if(!comet){ cometT-=0.016*dt; if(cometT<=0){
          const dir=Math.random()<0.5?1:-1;
          comet={dir, x:dir>0?-40:api.W+40, y:api.H*rnd(0.08,0.2),
            vx:dir*rnd(2.6,3.6), vy:rnd(0.3,0.7), life:1, caught:false, tw:0};
          cometT=rnd(7,13);
        }}
        else{
          comet.x+=comet.vx*dt; comet.y+=comet.vy*dt; comet.tw+=0.3*dt;
          if(comet.caught) comet.life-=0.06*dt;
          if(comet.life<=0 || comet.x<-60 || comet.x>api.W+60 || comet.y>api.H*0.45) comet=null;
        }
      }
      if(comet && !comet.caught){
        // twinkling star head + tail of sparkles (drawn in the sky, behind sweets)
        const cx=comet.x, cy=comet.y, tw=0.7+0.3*Math.sin(comet.tw);
        g.save(); g.globalCompositeOperation="lighter";
        const halo=g.createRadialGradient(cx,cy,0,cx,cy,Math.max(1,R*1.4));
        halo.addColorStop(0,"rgba(255,246,200,"+(0.5*tw)+")");
        halo.addColorStop(1,"rgba(255,246,200,0)");
        g.fillStyle=halo; g.beginPath(); g.arc(cx,cy,Math.max(1,R*1.4),0,TAU); g.fill();
        // trailing tail
        g.strokeStyle="rgba(255,240,180,.55)"; g.lineCap="round";
        for(let i=1;i<=6;i++){ g.globalAlpha=0.5*(1-i/7);
          g.lineWidth=Math.max(1,R*0.18*(1-i/7));
          g.beginPath(); g.moveTo(cx-comet.dir*R*0.3*i,cy-comet.vy*R*0.09*i);
          g.lineTo(cx-comet.dir*R*0.3*(i+1),cy-comet.vy*R*0.09*(i+1)); g.stroke(); }
        g.restore(); g.globalAlpha=1;
        // 星本体(画像があれば差し替え。dir<0=左向きに動く時は左右反転)
        if(!api.drawAsset("comet.png",cx,cy,R*2.6,R*2.6,{center:true,rot:comet.tw*0.4,flip:comet.dir<0})){
          // little 4-point star head (手描きフォールバック)
          g.save(); g.translate(cx,cy); g.rotate(comet.tw*0.4);
          g.fillStyle="#fff7c2"; g.shadowColor="#ffd23f"; g.shadowBlur=10;
          g.beginPath();
          for(let i=0;i<8;i++){ const ang=i*Math.PI/4, rr=i%2===0?Math.max(1,R*0.5):Math.max(1,R*0.2);
            const px=Math.cos(ang)*rr, py=Math.sin(ang)*rr; if(i===0)g.moveTo(px,py); else g.lineTo(px,py);}
          g.closePath(); g.fill(); g.shadowBlur=0; g.restore();
        }
      }

      const paused=clearT>0;
      // ---- spawn sweets to keep the field lively ----
      if(!paused){ spawnT-=dt; if(spawnT<=0){ if(sweets.filter(s=>s.state!=="dead").length<clamp(9+stage,9,20)) sweets.push(newSweet()); spawnT=clamp(52-stage*3,16,52); } }

      // ---- update vortices ----
      for(const v of vortices){
        v.t+=0.016*dt; v.spin+=0.34*dt;
        v.grow=Math.min(1,v.grow+0.04*dt);
        v.held=Math.min(3,v.held); // count of currently caught
        // life: lives ~2.6s, fades out
        if(v.t>2.0) v.life-=0.03*dt;
        v.pull=R*(2.0+v.grow*1.8+v.kills*0.4); // grows as it catches more(軸3: 吸引範囲を弱め、狙いを必要にする)
      }
      vortices=vortices.filter(v=>v.life>0);

      // ---- update sweets ----
      for(const s of sweets){
        if(s.state==="dead")continue;
        s.bob+=0.05*dt; s.rot+=s.vr*dt;
        if(s.squash>1) s.squash=Math.max(1,s.squash-0.04*dt);
        if(s.state==="caught"){
          const v=s.caught;
          if(!v||v.life<=0||!vortices.includes(v)){ s.state="free"; s.caught=null; }
          else {
            // spiral inward around the vortex center
            s.orbit-= (0.06+ (1-s.orbR/Math.max(v.pull,1))*0.12) *dt;
            s.orbR-= (0.6+v.grow*0.9)*dt;
            const cx=v.x+Math.cos(s.orbit)*s.orbR;
            const cy=v.y+Math.sin(s.orbit)*s.orbR;
            s.vx=cx-s.x; s.vy=cy-s.y;
            s.x=cx; s.y=cy;
            if(s.orbR< s.r*0.7){
              // reached the eye -> get flung outward fast
              v.kills++; v.held=Math.max(0,v.held-1);
              const fa=rnd(0,TAU), fs=rnd(9,14)+v.kills*0.4;
              fling(s,Math.cos(fa)*fs,Math.sin(fa)*fs);
              api.tone(420+v.kills*30,0.07,"square",0.08);
            }
            continue;
          }
        }
        // free or flung: move + bounce, look for a vortex to be caught by
        s.x+=s.vx*dt; s.y+=s.vy*dt;
        const flung=Math.hypot(s.vx,s.vy)>6;
        // wall collision
        let hitWall=false;
        if(s.x<s.r){s.x=s.r;s.vx=Math.abs(s.vx);hitWall=true;}
        else if(s.x>api.W-s.r){s.x=api.W-s.r;s.vx=-Math.abs(s.vx);hitWall=true;}
        if(s.y<api.H*0.14+s.r){s.y=api.H*0.14+s.r;s.vy=Math.abs(s.vy);hitWall=true;}
        else if(s.y>api.H-s.r){s.y=api.H-s.r;s.vy=-Math.abs(s.vy);hitWall=true;}
        if(flung&&hitWall){ popSweet(s,null); continue; }
        if(!flung){
          // gentle drift slows down
          s.vx*=Math.pow(0.992,dt); s.vy*=Math.pow(0.992,dt);
          // try to get caught by the nearest vortex within pull radius
          for(const v of vortices){
            if(v.held>=3)continue; // 軸3: 1うずまきが同時に捕まえられる数を絞る
            const d=Math.hypot(s.x-v.x,s.y-v.y);
            if(d<v.pull){
              s.state="caught"; s.caught=v; v.held++;
              s.orbit=Math.atan2(s.y-v.y,s.x-v.x); s.orbR=Math.max(d,s.r);
              break;
            }
          }
        } else {
          // flung but didn't hit a wall yet: slight drag, keep flying
          s.vx*=Math.pow(0.985,dt); s.vy*=Math.pow(0.985,dt);
        }
      }
      sweets=sweets.filter(s=>s.state!=="dead");
      fill();

      // ---- draw sweets ----
      for(const s of sweets){ if(s.state!=="dead") drawSweet(s); }

      // ---- draw vortices (above sweets so the swirl reads on top) ----
      for(const v of vortices) drawVortex(v);

      // ---- puffs (sugar dust) ----
      for(const p of puffs){ p.r+=p.vr*dt; p.life-=p.decay*dt;
        g.globalAlpha=Math.max(0,p.life)*0.5; g.fillStyle=p.col;
        g.beginPath(); g.arc(p.x,p.y,p.r,0,TAU); g.fill(); }
      g.globalAlpha=1; puffs=puffs.filter(p=>p.life>0);

      // ---- shockwave rings ----
      for(const ri of rings){ ri.r+=ri.vr*dt; ri.life-=ri.decay*dt;
        g.save(); g.globalAlpha=Math.max(0,ri.life)*0.7; g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3; g.beginPath(); g.arc(ri.x,ri.y,ri.r,0,TAU); g.stroke(); g.restore(); }
      rings=rings.filter(ri=>ri.life>0);

      // ---- glint sparks (additive) ----
      g.save(); g.globalCompositeOperation="lighter"; g.lineCap="round";
      for(const sp of sparks){ sp.x+=sp.vx*dt; sp.y+=sp.vy*dt; sp.vx*=0.9; sp.vy*=0.9; sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life); g.strokeStyle=sp.col; g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath(); g.moveTo(sp.x,sp.y); g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len); g.stroke(); }
      g.restore(); g.globalAlpha=1; sparks=sparks.filter(sp=>sp.life>0);

      // ---- shards (candy bits): kindごとに形を変える(丸/四角/伸びる楕円/細長い飛沫) ----
      for(const sh of shards){ sh.vy+=0.3*dt; sh.x+=sh.vx*dt; sh.y+=sh.vy*dt; sh.rot+=sh.vr*dt; sh.life-=sh.decay*dt;
        g.save(); g.globalAlpha=Math.max(0,sh.life); g.translate(sh.x,sh.y); g.rotate(sh.rot);
        g.shadowColor=sh.col; g.shadowBlur=6; g.fillStyle=sh.col;
        const shr=Math.max(0,sh.r*(0.6+sh.life*0.4));
        if(sh.shape==="square"){ rrect(-shr*0.6,-shr*0.6,shr*1.2,shr*1.2,Math.max(0,shr*0.2)); g.fill(); }
        else if(sh.shape==="oval"){ g.beginPath(); g.ellipse(0,0,Math.max(0,shr*1.3),Math.max(0,shr*0.6),0,0,TAU); g.fill(); }
        else if(sh.shape==="drip"){ g.beginPath(); g.ellipse(0,0,Math.max(0,shr*1.7),Math.max(0,shr*0.4),0,0,TAU); g.fill(); }
        else { g.beginPath(); g.arc(0,0,shr,0,TAU); g.fill(); }
        g.restore(); }
      g.globalAlpha=1; g.shadowBlur=0; shards=shards.filter(sh=>sh.life>0);

      // ---- floats (combo text) ----
      // ③ ノンストップ判定: 積み上げたコンボが切れたら「切らした」と記録(このステージはボーナス対象外に)
      if(combo>0){ comboT-=0.016*dt; if(comboT<=0){ if(combo>1)nonstopBroken=true; combo=0; } }
      for(const f of floats){ f.y+=f.vy*dt; f.life-=0.02*dt;
        g.globalAlpha=Math.max(0,f.life); g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.textAlign="center"; g.lineWidth=6; g.strokeStyle="rgba(120,40,90,.5)";
        g.strokeText(f.txt,f.x,f.y); g.fillStyle=f.col; g.fillText(f.txt,f.x,f.y); }
      g.globalAlpha=1; g.textAlign="left"; floats=floats.filter(f=>f.life>0);

      // ---- impact flash (soft pink bloom) ----
      if(flash>0){ flash-=0.06*dt; const fa=Math.max(0,flash);
        g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=fa*0.28;
        g.fillStyle="#ffd6ea"; g.fillRect(0,0,api.W,api.H);
        g.globalAlpha=fa*0.12; g.fillStyle="#fff"; g.fillRect(0,0,api.W,api.H);
        g.restore(); g.globalAlpha=1; }

      // ---- combo banner (top center) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save(); g.translate(api.W/2,api.H*0.12); g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(255,123,208,.8)"; g.shadowBlur=14;
        g.fillStyle="#ff7bd0"; g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(255,255,255,.7)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
      }

      // ① にじいろキャンディ! 発見バナー(虹色に色替わり・top-center安全帯)
      if(rbMsgT>0){ rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.4, col=SWIRLCOL[Math.floor(tsec*6)%SWIRLCOL.length];
        g.save(); g.translate(api.W/2,api.H*0.28); g.scale(pop,pop);
        g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1); g.shadowColor=col; g.shadowBlur=18;
        g.fillStyle="#ffffff"; g.fillText("にじいろキャンディ!",0,0);
        g.shadowBlur=0; g.lineWidth=2; g.strokeStyle=col; g.strokeText("にじいろキャンディ!",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(rbMsgT<0)rbMsgT=0; }
      // ② きょうのラッキーいろは◯! (初回だけ中央上に教える)
      if(luckyTeachT>0){ luckyTeachT-=0.016*dt;
        const pop=1+Math.max(0,luckyTeachT-1.5)*1.4;
        g.save(); g.translate(api.W/2,api.H*0.20); g.scale(pop,pop);
        g.font="900 28px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.globalAlpha=clamp(luckyTeachT,0,1); g.shadowColor=luckyColor; g.shadowBlur=16;
        g.fillStyle="#fff7c2"; g.fillText("きょうの ラッキーいろは "+(SWNAME[luckyColor]||"")+"!",0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(120,40,90,.6)";
        g.strokeText("きょうの ラッキーいろは "+(SWNAME[luckyColor]||"")+"!",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(luckyTeachT<0)luckyTeachT=0; }
      // ② ラッキー! 小バナー(2回目以降)
      if(luckyMsgT>0){ luckyMsgT-=0.016*dt;
        const pop=1+Math.max(0,luckyMsgT-0.6)*1.3;
        g.save(); g.translate(api.W/2,api.H*0.44); g.scale(pop,pop);
        g.font="900 26px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.5,0,1); g.shadowColor=luckyColor; g.shadowBlur=14;
        g.fillStyle="#fff7c2"; g.fillText("ラッキー! "+(SWNAME[luckyColor]||"")+"は あたり",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(luckyMsgT<0)luckyMsgT=0; }
      // ④ ながれ星 キャッチ! バナー
      if(catchMsgT>0){ catchMsgT-=0.016*dt;
        const pop=1+Math.max(0,catchMsgT-0.9)*1.3;
        g.save(); g.translate(api.W/2,api.H*0.36); g.scale(pop,pop);
        g.font="900 28px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.globalAlpha=clamp(catchMsgT*1.4,0,1); g.shadowColor="rgba(255,210,60,.9)"; g.shadowBlur=16;
        g.fillStyle="#ffd23f"; g.fillText("ながれ星 キャッチ!",0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(120,40,90,.6)";
        g.strokeText("ながれ星 キャッチ!",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(catchMsgT<0)catchMsgT=0; }
      // ③ ノンストップ ボーナス! バナー(クリア文字の下=重ねない)
      if(nonstopT>0){ nonstopT-=0.014*dt;
        const pop=1+Math.max(0,nonstopT-1.3)*1.4;
        g.save(); g.translate(api.W/2,api.H*0.60); g.scale(pop,pop);
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.globalAlpha=clamp(nonstopT*1.3,0,1); g.shadowColor="rgba(255,210,60,.9)"; g.shadowBlur=16;
        g.fillStyle="#ffe6a0"; g.fillText("ノンストップ ボーナス!",0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(120,40,90,.7)";
        g.strokeText("ノンストップ ボーナス!",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(nonstopT<0)nonstopT=0; }

      // ---- HUD: stage + progress (top center safe band) ----
      drawHUD();

      // ---- STAGE CLEAR banner ----
      if(clearT>0){ clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save(); g.globalAlpha=a*0.4; g.fillStyle="#7a1f55"; g.fillRect(0,api.H*0.34,api.W,api.H*0.22); g.restore();
        const pop=1+Math.max(0,clearT-1.4)*1.8;
        g.save(); g.translate(api.W/2,api.H*0.45); g.scale(pop,pop); g.globalAlpha=a;
        g.textAlign="center"; g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,123,208,.9)"; g.shadowBlur=20; g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア!",0,0);
        g.shadowBlur=0; g.lineWidth=2; g.strokeStyle="#fff"; g.strokeText("ステージ"+clearStage+" クリア!",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#fff";
        g.fillText("つぎは ステージ"+(clearStage+1)+"!",0,42);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
        if(clearT<=0){ clearT=0; }
      }
      // 加算合成の後始末: フレーム終了時は必ず source-over に戻す(白飛び漏れ防止)
      g.globalCompositeOperation="source-over"; g.globalAlpha=1;
    },
    stop(){}
  };

  // ---------- drawing helpers ----------
  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.045;
    g.save(); g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff"; g.shadowColor="rgba(120,40,90,.5)"; g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(120,40,90,.3)"; rrect(bx,by,bw,bh,bh/2); g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){ const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#ff7bd0"); gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg; rrect(bx,by,Math.max(bh,bw*fr),bh,bh/2); g.fill(); }
    g.strokeStyle="rgba(255,255,255,.6)"; g.lineWidth=2; rrect(bx,by,bw,bh,bh/2); g.stroke();
    g.restore(); g.textAlign="left";
  }

  function drawSweet(s){
    const def=s.def, r=s.r;
    g.save(); g.translate(s.x,s.y); g.rotate(s.rot);
    g.scale(s.squash,1/s.squash);
    // soft shadow
    g.fillStyle="rgba(120,60,100,.16)"; g.beginPath(); g.ellipse(0,r*0.85,r*0.8,r*0.3,0,0,TAU); g.fill();
    if(def.kind==="candy"){
      // wrapped round candy with twist ends
      g.fillStyle=def.ac; g.beginPath();
      g.moveTo(-r*1.3,0); g.lineTo(-r*0.6,-r*0.5); g.lineTo(-r*0.6,r*0.5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(r*1.3,0); g.lineTo(r*0.6,-r*0.5); g.lineTo(r*0.6,r*0.5); g.closePath(); g.fill();
      const grd=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r);
      grd.addColorStop(0,lighten(def.col,80)); grd.addColorStop(0.6,def.col); grd.addColorStop(1,shadec(def.col,-30));
      g.fillStyle=grd; g.beginPath(); g.arc(0,0,r*0.8,0,TAU); g.fill();
      g.strokeStyle="rgba(255,255,255,.5)"; g.lineWidth=2;
      g.beginPath(); g.arc(0,0,r*0.8,0,TAU); g.stroke();
      g.fillStyle="rgba(255,255,255,.5)"; g.beginPath(); g.ellipse(-r*0.22,-r*0.28,r*0.22,r*0.13,-0.5,0,TAU); g.fill();
      drawFace(0,0,r*0.42);
    } else if(def.kind==="choco"){
      // chocolate square with bite-shine
      const grd=g.createLinearGradient(-r,-r,r,r);
      grd.addColorStop(0,lighten(def.col,50)); grd.addColorStop(0.5,def.col); grd.addColorStop(1,shadec(def.col,-40));
      g.fillStyle=grd; rrect(-r*0.8,-r*0.8,r*1.6,r*1.6,r*0.25); g.fill();
      g.strokeStyle="rgba(255,255,255,.25)"; g.lineWidth=2; rrect(-r*0.8,-r*0.8,r*1.6,r*1.6,r*0.25); g.stroke();
      // grid grooves
      g.strokeStyle="rgba(60,30,15,.5)"; g.lineWidth=2;
      g.beginPath(); g.moveTo(0,-r*0.8); g.lineTo(0,r*0.8); g.moveTo(-r*0.8,0); g.lineTo(r*0.8,0); g.stroke();
      g.fillStyle="rgba(255,255,255,.3)"; g.beginPath(); g.ellipse(-r*0.35,-r*0.4,r*0.22,r*0.12,-0.4,0,TAU); g.fill();
      drawFace(0,0,r*0.4);
    } else if(def.kind==="cake"){
      // little cake slice / cupcake top
      g.fillStyle="#fff3f7"; rrect(-r*0.75,-r*0.1,r*1.5,r*0.85,r*0.18); g.fill(); // cup
      g.strokeStyle="rgba(200,130,170,.4)"; g.lineWidth=2;
      for(let i=-2;i<=2;i++){g.beginPath(); g.moveTo(i*r*0.3,-r*0.05); g.lineTo(i*r*0.3,r*0.7); g.stroke();}
      const grd=g.createRadialGradient(-r*0.2,-r*0.5,r*0.1,0,-r*0.3,r);
      grd.addColorStop(0,lighten(def.col,70)); grd.addColorStop(1,def.col);
      g.fillStyle=grd; g.beginPath(); g.arc(0,-r*0.25,r*0.78,Math.PI,TAU); g.fill();
      g.fillRect(-r*0.78,-r*0.25,r*1.56,r*0.18);
      // cherry
      g.fillStyle="#ff5b7e"; g.beginPath(); g.arc(0,-r*0.85,r*0.18,0,TAU); g.fill();
      g.fillStyle="rgba(255,255,255,.7)"; g.beginPath(); g.arc(-r*0.05,-r*0.9,r*0.05,0,TAU); g.fill();
      drawFace(0,-r*0.2,r*0.38);
    } else if(def.kind==="star"){
      // GOLD star candy: pulsing halo + 5-point star(画像があれば差し替え)
      const tw=0.7+0.3*Math.sin(s.bob*2.2);
      g.save(); g.globalCompositeOperation="lighter";
      const halo=g.createRadialGradient(0,0,0,0,0,Math.max(1,r*1.7));
      halo.addColorStop(0,"rgba(255,232,120,"+(0.5*tw)+")");
      halo.addColorStop(1,"rgba(255,232,120,0)");
      g.fillStyle=halo; g.beginPath(); g.arc(0,0,Math.max(1,r*1.7),0,TAU); g.fill();
      g.restore();
      // goldstar.png はレビューで不良(影の焼き込み/穴)が残り不採用。常に手描きの星本体を使う。
      {
      g.shadowColor="#ffd23f"; g.shadowBlur=14*tw;
      const grd=g.createRadialGradient(-r*0.2,-r*0.25,r*0.1,0,0,r);
      grd.addColorStop(0,"#fffbe0"); grd.addColorStop(0.55,"#ffd23f"); grd.addColorStop(1,"#ffa000");
      g.fillStyle=grd; g.beginPath();
      for(let i=0;i<10;i++){const ang=-Math.PI/2+i*Math.PI/5, rr=i%2===0?r*1.05:r*0.52;
        const px=Math.cos(ang)*rr, py=Math.sin(ang)*rr;
        if(i===0)g.moveTo(px,py); else g.lineTo(px,py);}
      g.closePath(); g.fill();
      g.shadowBlur=0;
      g.strokeStyle="rgba(255,255,255,.75)"; g.lineWidth=2; g.stroke();
      g.fillStyle="rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(-r*0.2,-r*0.3,r*0.2,r*0.11,-0.5,0,TAU); g.fill();
      drawFace(0,r*0.06,r*0.4);
      }
    } else if(def.kind==="rainbow"){
      // ① にじいろキャンディ: 6色の風車がまわる激レア。glow + 回転する虹色スライス
      const tw=0.7+0.3*Math.sin(s.bob*2.6);
      g.save(); g.globalCompositeOperation="lighter";
      const halo=g.createRadialGradient(0,0,0,0,0,Math.max(1,r*1.7));
      halo.addColorStop(0,"rgba(255,255,255,"+(0.42*tw)+")");
      halo.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=halo; g.beginPath(); g.arc(0,0,Math.max(1,r*1.7),0,TAU); g.fill();
      g.restore();
      // twist wrapper ends
      g.fillStyle="#fff"; g.beginPath();
      g.moveTo(-r*1.3,0); g.lineTo(-r*0.6,-r*0.5); g.lineTo(-r*0.6,r*0.5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(r*1.3,0); g.lineTo(r*0.6,-r*0.5); g.lineTo(r*0.6,r*0.5); g.closePath(); g.fill();
      // rainbow pie slices (spin with rot from the outer transform)
      const seg=SWIRLCOL.length, rr=Math.max(1,r*0.82);
      for(let i=0;i<seg;i++){ g.fillStyle=SWIRLCOL[i];
        g.beginPath(); g.moveTo(0,0); g.arc(0,0,rr,i/seg*TAU,(i+1)/seg*TAU); g.closePath(); g.fill(); }
      g.strokeStyle="rgba(255,255,255,.7)"; g.lineWidth=2; g.beginPath(); g.arc(0,0,rr,0,TAU); g.stroke();
      g.fillStyle="rgba(255,255,255,.5)"; g.beginPath(); g.ellipse(-r*0.22,-r*0.28,r*0.22,r*0.13,-0.5,0,TAU); g.fill();
      drawFace(0,0,r*0.42);
    } else { // gummy
      const grd=g.createRadialGradient(-r*0.25,-r*0.3,r*0.1,0,0,r);
      grd.addColorStop(0,lighten(def.col,90)); grd.addColorStop(0.55,def.col); grd.addColorStop(1,shadec(def.col,-20));
      g.fillStyle=grd; g.globalAlpha=0.95;
      // bear-ish blob
      g.beginPath(); g.arc(-r*0.5,-r*0.65,r*0.3,0,TAU); g.arc(r*0.5,-r*0.65,r*0.3,0,TAU); g.fill();
      g.beginPath(); g.ellipse(0,0,r*0.82,r*0.9,0,0,TAU); g.fill();
      g.globalAlpha=1;
      g.strokeStyle="rgba(255,255,255,.4)"; g.lineWidth=2; g.beginPath(); g.ellipse(0,0,r*0.82,r*0.9,0,0,TAU); g.stroke();
      g.fillStyle="rgba(255,255,255,.5)"; g.beginPath(); g.ellipse(-r*0.28,-r*0.3,r*0.2,r*0.28,-0.4,0,TAU); g.fill();
      drawFace(0,0,r*0.42);
    }
    g.restore();
  }

  function drawFace(cx,cy,r){
    // tiny cute face
    g.fillStyle="#3a2030";
    g.beginPath(); g.arc(cx-r*0.5,cy-r*0.1,r*0.22,0,TAU); g.arc(cx+r*0.5,cy-r*0.1,r*0.22,0,TAU); g.fill();
    g.fillStyle="rgba(255,255,255,.9)";
    g.beginPath(); g.arc(cx-r*0.56,cy-r*0.18,r*0.07,0,TAU); g.arc(cx+r*0.44,cy-r*0.18,r*0.07,0,TAU); g.fill();
    g.fillStyle="rgba(255,120,150,.4)";
    g.beginPath(); g.arc(cx-r*0.7,cy+r*0.25,r*0.18,0,TAU); g.arc(cx+r*0.7,cy+r*0.25,r*0.18,0,TAU); g.fill();
    g.strokeStyle="#3a2030"; g.lineWidth=Math.max(1.5,r*0.12); g.lineCap="round";
    g.beginPath(); g.arc(cx,cy+r*0.1,r*0.3,0.15*Math.PI,0.85*Math.PI); g.stroke();
  }

  function drawVortex(v){
    const a=clamp(v.life,0,1);
    const baseR=v.pull*v.grow*0.55+v.pull*0.18;
    g.save(); g.translate(v.x,v.y);
    // pull-radius soft halo (additive)
    g.save(); g.globalCompositeOperation="lighter";
    const hg=g.createRadialGradient(0,0,0,0,0,v.pull);
    hg.addColorStop(0,"rgba(255,255,255,"+(0.18*a)+")");
    hg.addColorStop(0.5,"rgba(255,180,230,"+(0.1*a)+")");
    hg.addColorStop(1,"rgba(255,180,230,0)");
    g.fillStyle=hg; g.beginPath(); g.arc(0,0,v.pull,0,TAU); g.fill();
    g.restore();
    // spiral arms
    g.save(); g.rotate(v.spin); g.globalAlpha=a;
    const arms=3;
    for(let k=0;k<arms;k++){
      g.save(); g.rotate(k*TAU/arms);
      g.strokeStyle=v.col; g.lineWidth=clamp(baseR*0.16,2,8); g.lineCap="round";
      g.shadowColor=v.col; g.shadowBlur=10;
      g.beginPath();
      for(let i=0;i<=24;i++){
        const t=i/24;
        const ang=t*TAU*1.1;
        const rr=t*baseR;
        const px=Math.cos(ang)*rr, py=Math.sin(ang)*rr;
        if(i===0)g.moveTo(px,py); else g.lineTo(px,py);
      }
      g.stroke();
      g.restore();
    }
    g.restore();
    // bright eye core
    g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=a;
    const cr=baseR*0.32*(0.85+0.15*Math.sin(v.spin*2));
    const core=g.createRadialGradient(0,0,0,0,0,Math.max(cr,1));
    core.addColorStop(0,"rgba(255,255,255,.95)");
    core.addColorStop(0.5,v.col);
    core.addColorStop(1,"rgba(255,255,255,0)");
    g.fillStyle=core; g.beginPath(); g.arc(0,0,Math.max(cr,1),0,TAU); g.fill();
    g.restore();
    g.restore();
  }

  function rrect(x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
  function lighten(hex,amt){ const a=amt===undefined?50:amt; const c=parseInt(hex.slice(1),16);
    const r=Math.min(255,((c>>16)&255)+a),gg=Math.min(255,((c>>8)&255)+a),b=Math.min(255,(c&255)+a);
    return "rgb("+r+","+gg+","+b+")"; }
  function shadec(hex,amt){ const c=parseInt(hex.slice(1),16);
    const r=clamp(((c>>16)&255)+amt,0,255),gg=clamp(((c>>8)&255)+amt,0,255),b=clamp((c&255)+amt,0,255);
    return "rgb("+r+","+gg+","+b+")"; }
}
Engine.register("candyswirl", build_candyswirl);
