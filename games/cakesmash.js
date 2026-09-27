function build_cakesmash(api){
  const g=api.g;
  api.preload(["bg.jpg"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。cherry/cupcake は生成2回とも不良のため手描き専用
  let imgBg=false;   // 今フレーム、画像背景が使えたか(平坦な手描き背景の抑制に使う)
  let W=0,H=0,baseX=0,baseY=0,tierW=0,tierH=0;
  let tiers=[],crumbs=[],creams=[],berries=[],rings=[],sparks=[],motes=[],floats=[],rolls=[],shards=[],halves=[];
  let count=0,combo=0,comboT=0,tsec=0,flash=0,flashCol="#fff",shockT=0;
  let stage=1,clearT=0,clearTxt="",clearSub="",finaleT=0;
  // fever time + rare gold tier + hitStop cooldown
  let fever=0,feverGauge=0,hsCd=0,cupcakes=[];
  let cupIdleT=rnd(12,18); // 軸7補助: フィーバー外でも低頻度でカップケーキを出すための待ち時間
  const FEVER_LEN=10;
  function hstop(f){ if(hsCd<=0){ api.hitStop(f); hsCd=30; } }
  // dessert-land palette per stage (sky gradient shifts each stage)
  const SKIES=[
    ["#ffe6f2","#ffd0e6","#ffc0dd","#ffb3c8"], // strawberry milk
    ["#e6f3ff","#cfe6ff","#bcd9ff","#a8c8ff"], // soda blue
    ["#fff4d6","#ffe6a8","#ffd98f","#ffcf7a"], // honey gold
    ["#efe6ff","#ddc8ff","#cdb3ff","#bea0ff"]  // grape candy
  ];
  function sky(){return SKIES[(stage-1)%SKIES.length];}
  const SPONGE=["#ffe0b0","#ffd49a","#ffce8a","#f7c885"];
  const CREAMC=["#fff6ea","#ffeede","#fff0f4","#fdeede"];
  const FRUIT=["#ff4d6d","#ff8a3a","#ffd23f","#b066ff","#36c9ff","#ff7aa8"];
  // stage flavors: each stage brings a new-looking cake (sponge+cream palette)
  const FLAVORS=[
    {name:"いちご",  sponge:SPONGE,                                     cream:CREAMC},
    {name:"チョコ",  sponge:["#8a5a34","#96653c","#7a4c2a","#a06a40"],  cream:["#f2e2d0","#ffe9d0","#f7ead8","#eadbc4"]},
    {name:"メロン",  sponge:["#cdeaa0","#bfe28e","#d8f0b0","#b2d97e"],  cream:["#f4ffe6","#eaffd6","#f8fff0","#e6f8d0"]},
    {name:"ももいろ",sponge:["#ffc9d8","#ffb9cc","#ffd4e0","#ffaec4"],  cream:["#fff0f4","#ffe6ee","#fff6f8","#ffdce8"]},
    {name:"ソーダ",  sponge:["#b0e0ff","#9ed6ff","#c4e8ff","#8accff"],  cream:["#eef8ff","#e0f2ff","#f4fbff","#d6ecff"]}
  ];
  function flavor(){return FLAVORS[(stage-1)%FLAVORS.length];}
  function goalFor(s){return 4+Math.min(s,5);}      // 5,6,7,8,9, then 9（7〜8歳向けに手応えを増やした）
  let stageGoal=goalFor(1),stageSmash=0;

  // ---- 隠し発見レイヤー(ハンマー/トラックと同じ思想) ----
  const FRUITNAME=["あか","オレンジ","きいろ","むらさき","みずいろ","ピンク"]; // FRUIT と同じ並び
  let luckyColor=rint(0,FRUIT.length-1); // ② きょうのラッキー色: セッションの秘密の1色(FRUIT の index)
  let luckySeen=false,luckyMsgT=0;       //    初回だけ中央上に一度教える
  let rbMsgT=0;                          // ① にじいろケーキ 発見バナー(虹色に色替わり)
  let stageMiss=0,perfectT=0;            // ③ パーフェクト: このステージ ミスタップ0でクリア

  function layout(){
    W=api.W;H=api.H;
    tierW=clamp(W*0.5,150,360);
    tierH=clamp(H*0.07,30,64);
    baseX=W/2;
    baseY=H*0.86;
    // reposition any existing tiers to the new geometry
    for(let i=0;i<tiers.length;i++){const t=tiers[i];
      t.w=tierW*(0.55+0.5*(i/Math.max(tiers.length-1,1)))*(t.big?1.4:1);
      t.x=baseX; t.y=baseY-(i+0.5)*tierH;}
    buildMotes();
  }
  function buildMotes(){
    motes=[];
    for(let i=0;i<16;i++)motes.push({
      x:rnd(0,W),y:rnd(0,H),r:rnd(6,16),sp:rnd(0.1,0.4),ph:rnd(0,TAU),
      kind:i%3, col:pick(["#fff0f6","#ffe6c2","#e6f3ff","#f0e6ff"])});
  }

  function newCake(){
    tiers=[];
    const n=clamp(3+Math.floor((stage-1)/1),3,7);   // 3..7 tiers, grows with stage（7〜8歳向けに手応えを増やした）
    const fl=flavor();
    let hasGold=false,hasRb=false;
    for(let i=0;i<n;i++){
      const frac=i/Math.max(n-1,1);
      // ① にじいろ段: 激レア(約4%・ケーキに最大1段・ステージ2以降)。いつ入ってるか分からない=ドキドキ発見。
      const rb=!hasRb&&stage>=2&&Math.random()<0.04;
      if(rb)hasRb=true;
      // rare golden tier (about 8%, max 1 per cake): shiny, huge bonus when smashed
      const gold=!rb&&!hasGold&&Math.random()<0.08;
      if(gold)hasGold=true;
      tiers.push({
        i, x:baseX, y:baseY-(i+0.5)*tierH,
        w:tierW*(0.55+0.5*frac),     // wider at bottom（軸7: レンジを広げて段差をはっきり）
        sponge:rb?"#ff5da2":(gold?"#ffd23f":pick(fl.sponge)), cream:rb?"#ffffff":(gold?"#fff2b0":pick(fl.cream)),
        hp:(!gold&&!rb&&stage>=3&&i<n-1&&Math.random()<0.4)?2:1,  // some tiers need 2 taps later（7〜8歳向けに手応えを増やした）
        wob:0, hit:0, bob:rnd(0,TAU), dead:false, gold, rb, big:false, shape:"block",
        deco:Math.floor(rnd(0,FRUIT.length))
      });
    }
    // 軸7(壊す物のバラエティ)対策: 段の形を block(台形)/donut(丸)/roll(横長ロール)の3種に混ぜる。
    // 以前は奇数ステージのみドーナツ1段だったため、実プレイの大半が台形の色違いのままでB止まりだった。
    // 今回は全ステージで最低1段はドーナツ化し、段数が多いステージはドーナツ2段+ロール1段まで増やす。
    // 見た目(丸/横長 vs 角の台形)も壊れ方(転がる/真っ二つ vs 砕ける)も普通の段と別物にする。
    {
      const mid=Math.floor(n/2),order=[];
      for(let d=0;d<n;d++){
        const cand=clamp(mid+((d%2===0)?d/2:-(d+1)/2),0,n-1);
        if(!tiers[cand].gold&&!tiers[cand].rb&&order.indexOf(cand)<0)order.push(cand);
      }
      const donutSlots=n>=5?2:1, rollSlots=n>=4?1:0;
      let oi=0;
      for(let k=0;k<donutSlots&&oi<order.length;k++,oi++)tiers[order[oi]].shape="donut";
      for(let k=0;k<rollSlots&&oi<order.length;k++,oi++)tiers[order[oi]].shape="roll";
      // 台形(block)が3段以上ぶっ続けにならないよう、間にロールを差し込んで交代させる
      let run=0;
      for(let i=0;i<n;i++){
        if(tiers[i].shape==="block"){
          run++;
          if(run>=3&&!tiers[i].gold&&!tiers[i].rb){tiers[i].shape="roll";run=0;}
        }else run=0;
      }
    }
    // 軸7: 段どうしの大きさ差をもっとはっきり見せる特大段(ステージ5以降・1段だけ幅1.4倍)
    if(stage>=5){
      let cand=[];
      for(let i=0;i<n;i++)if(!tiers[i].gold&&!tiers[i].rb&&tiers[i].shape==="block")cand.push(i);
      if(!cand.length)for(let i=0;i<n;i++)if(!tiers[i].gold&&!tiers[i].rb)cand.push(i);
      if(cand.length){const bi=pick(cand);tiers[bi].big=true;tiers[bi].w*=1.4;}
    }
    stageGoal=goalFor(stage);
    stageSmash=0;
    stageMiss=0;   // ③ パーフェクト判定: 新しいステージの ミスタップ数をリセット
  }
  layout();
  newCake();

  function popFx(x,y,w,col,big){
    rings.push({x,y,r:w*0.3,vr:w*0.5,life:1,decay:0.05,col:"#fff"});
    rings.push({x,y,r:w*0.15,vr:w*0.4,life:1,decay:0.045,col});
    const n=(big?20:12)+Math.min(combo,8);
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(2.5,8);
      crumbs.push({x:x+rnd(-w*0.4,w*0.4),y:y+rnd(-tierH*0.4,tierH*0.4),
        vx:Math.cos(a)*s,vy:Math.sin(a)*s-rnd(2,5),s:rnd(tierH*0.16,tierH*0.34),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.008,0.014),col:pick(flavor().sponge)});}
    for(let i=0;i<(big?14:9);i++){const a=rnd(-TAU*0.5,0),s=rnd(3,9);
      creams.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rnd(1,4),
        r:rnd(tierH*0.12,tierH*0.28),life:1,decay:rnd(0.01,0.018),col:col});}
    for(let i=0;i<(big?7:4);i++){const a=rnd(0,TAU),s=rnd(4,10);
      berries.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rnd(3,6),
        r:rnd(tierH*0.14,tierH*0.24),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),
        life:1,decay:0.006,col:pick(FRUIT)});}
    for(let i=0;i<rint(6,10);i++){const a=rnd(0,TAU),s=rnd(4,12);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,18),life:1,decay:rnd(0.05,0.09)});}
  }

  // 軸7(壊す物のバラエティ): ドーナツ段は「砕ける」のではなく、輪っかの破片が
  // ぐらっと傾いてコロコロ転がっていく。crumbs(角の破片)ではなく丸いリング片=見た目からして別物。
  function popFxDonut(x,y,w,col,big){
    rings.push({x,y,r:w*0.3,vr:w*0.45,life:1,decay:0.05,col:"#fff"});
    const n=big?7:5;
    for(let i=0;i<n;i++){
      const a=rnd(-TAU*0.15,TAU*1.15),s=rnd(3,7);
      rolls.push({
        x:x+rnd(-w*0.3,w*0.3),y:y+rnd(-tierH*0.2,tierH*0.2),
        vx:Math.cos(a)*s*(rnd(0,1)<0.5?1:-1),vy:-rnd(1,3),
        r:rnd(tierH*0.16,tierH*0.28),rot:rnd(0,TAU),vr:rnd(2,5)*(rnd(0,1)<0.5?1:-1),
        life:1,decay:rnd(0.006,0.01),col:pick(flavor().sponge),glaze:col
      });
    }
    for(let i=0;i<(big?10:6);i++){const a=rnd(0,TAU),s=rnd(3,8);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,len:rnd(6,14),life:1,decay:rnd(0.05,0.09)});}
  }

  // 軸7(壊す物のバラエティ): ロール段は crumbs(砕ける)でも rolls(転がる)でもなく、
  // 真っ二つに割れて左右にちぎれ飛ぶ専用演出(halves)。渦巻き断面が見えたまま吹っ飛ぶ。
  function popFxRoll(x,y,w,col,big){
    rings.push({x,y,r:w*0.3,vr:w*0.5,life:1,decay:0.05,col:"#fff"});
    rings.push({x,y,r:w*0.15,vr:w*0.4,life:1,decay:0.045,col});
    const hr=Math.max(6,tierH*0.42*(big?1.15:1));
    const spg=pick(flavor().sponge);
    halves.push({x:x-hr*0.1,y,vx:-rnd(4,7)*(big?1.2:1),vy:-rnd(3,5),r:hr,side:-1,
      rot:rnd(-0.2,0.2),vr:-rnd(3,6),life:1,decay:rnd(0.008,0.013),sponge:spg,cream:col});
    halves.push({x:x+hr*0.1,y,vx:rnd(4,7)*(big?1.2:1),vy:-rnd(3,5),r:hr,side:1,
      rot:rnd(-0.2,0.2),vr:rnd(3,6),life:1,decay:rnd(0.008,0.013),sponge:spg,cream:col});
    for(let i=0;i<(big?10:6);i++){const a=rnd(0,TAU),s=rnd(3,8);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,len:rnd(6,14),life:1,decay:rnd(0.05,0.09)});}
  }
  // 軸7: 段の形(block/donut/roll)に応じて壊れ方の演出を出し分ける
  function shapeFx(t,x,y,w,col,big){
    if(t.shape==="donut")popFxDonut(x,y,w,col,big);
    else if(t.shape==="roll")popFxRoll(x,y,w,col,big);
    else popFx(x,y,w,col,big);
  }

  // 軸7補助: フィーバー中のカップケーキは cream splat ではなく、パリッと殻が弾け割れる専用演出。
  function popFxCrisp(x,y,r,col){
    rings.push({x,y,r:r*0.4,vr:r*1.1,life:1,decay:0.07,col:"#fff"});
    const n=10;
    for(let i=0;i<n;i++){const a=(i/n)*TAU+rnd(-0.2,0.2),s=rnd(4,10);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rnd(1,3),
        s:rnd(r*0.3,r*0.55),rot:a,vr:rnd(-0.5,0.5),life:1,decay:rnd(0.03,0.05),col});}
    for(let i=0;i<6;i++){const a=rnd(0,TAU),s=rnd(3,7);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(6,12),life:1,decay:rnd(0.06,0.1)});}
  }

  function topTier(){
    for(let i=tiers.length-1;i>=0;i--) if(!tiers[i].dead) return tiers[i];
    return null;
  }
  function aliveCount(){let c=0;for(const t of tiers)if(!t.dead)c++;return c;}

  function smashTier(t,last){
    const x=t.x,y=t.y,w=t.w;
    const col=pick(t.gold?["#fff6c0","#ffe98a"]:flavor().cream);
    if(t.hp>1&&fever<=0){   // during fever everything smashes in 1 tap
      t.hp--; t.hit=1; t.wob=1;
      api.slide(360,240,0.08,0.18,"sine");api.noise(0.06,0.12,1400);
      api.shake(4);
      shapeFx(t,x,y,w,col,false);
      flash=Math.min(1,flash+0.18);flashCol=t.cream;
      return;
    }
    t.dead=true;
    // ② きょうのラッキー色: このケーキの飾りが秘密の色なら小さめボーナス(気づくと得する)
    const isLucky=!t.gold&&!t.rb&&t.deco===luckyColor;
    let base=t.rb?8:(t.gold?5:1);           // にじいろ=+8, gold=+5, ふつう=+1
    if(isLucky)base+=1;
    const pts=base*(fever>0?2:1);           // fever doubles everything
    count+=pts;stageSmash++;api.setScore(count);
    combo++;comboT=1;
    // squishy splat sound, pitch rises with combo
    api.slide(300-Math.min(combo*6,80),120,0.14,0.3,"sine");
    api.noise(0.12,0.22,900,"lowpass",0.8);
    api.tone(440*Math.pow(2,clamp(combo,0,12)/12),0.12,"triangle",0.12);
    api.shake(6+Math.min(combo,8));
    if(combo>0&&combo%6===0)hstop(2);   // hitStop only on combo milestones (cooldown guarded)
    flash=Math.min(1,flash+0.4);flashCol=t.cream;
    if(t.rb){
      // ① にじいろ段 撃破: 虹の輪が6色ぶわっと + ファンファーレ + 大量得点。激レアの爽快ごほうび。
      rbMsgT=1.4;
      api.shake(16);hstop(5);flash=Math.min(1,flash+0.5);flashCol="#ffe6f2";shockT=Math.min(1,shockT+0.7);
      const RBC=["#ff5da2","#ff8a3a","#ffd23f","#7be08a","#36c9ff","#b066ff"];
      for(let k=0;k<RBC.length;k++)rings.push({x,y,r:w*0.2,vr:w*(0.5+k*0.13),life:1,decay:0.04,col:RBC[k]});
      for(let i=0;i<30;i++){const a=rnd(0,TAU),s=rnd(3,11);
        berries.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rnd(2,5),
          r:rnd(tierH*0.12,tierH*0.26),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),
          life:1,decay:0.006,col:RBC[i%RBC.length]});}
      [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.16,"triangle",0.13),i*60));
      floats.push({x,y:y-tierH*1.4,txt:"にじいろ！ +"+pts,life:1,vy:-0.9,col:"#ff5da2",size:36});
      feverGauge=Math.min(1,feverGauge+0.4);
    }else if(t.gold){
      // rainbow burst + fanfare + big bonus float
      api.shake(14);hstop(4);flash=Math.min(1,flash+0.6);flashCol="#ffd23f";
      rings.push({x,y,r:w*0.2,vr:w*0.7,life:1,decay:0.03,col:"#ffd23f"});
      for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,10);
        berries.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rnd(2,5),
          r:rnd(tierH*0.12,tierH*0.24),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),
          life:1,decay:0.006,col:FRUIT[i%FRUIT.length]});}
      [0,4,7,12].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.16,"triangle",0.14),i*70));
      floats.push({x,y:y-tierH*1.4,txt:"ゴールド！ +"+pts,life:1,vy:-0.9,col:"#ffd23f",size:34});
      feverGauge=Math.min(1,feverGauge+0.35);
    }else{
      feverGauge=Math.min(1,feverGauge+0.12);
      if(pts>1)floats.push({x,y:y-tierH*0.6,txt:"+"+pts,life:1,vy:-1.2,col:"#ff7ad0",size:24});
    }
    // ② ラッキー色 命中: きらっと小さめの祝福(白飛びしない控えめ) + 頭上に星のキラッ
    if(isLucky){
      api.tone(1046,0.14,"triangle",0.1);api.tone(1568,0.16,"triangle",0.08);
      for(let i=0;i<7;i++){const a=rnd(-TAU*0.5,0),s=rnd(2,6);
        sparks.push({x,y:y-tierH*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,len:rnd(6,12),life:1,decay:rnd(0.04,0.07)});}
      if(!luckySeen){luckyMsgT=1.8;luckySeen=true;}else luckyMsgT=Math.max(luckyMsgT,0.7);
      floats.push({x,y:y-tierH*0.7,txt:"ラッキー！",life:1,vy:-1,col:FRUIT[luckyColor],size:22});
    }
    if(feverGauge>=1&&fever<=0)startFever();
    const isLast=last||aliveCount()===0;
    if(isLast){
      // last tier: big celebratory smash
      api.boom(0.6);api.shake(16);hstop(6);
      shockT=1;
      api.slide(523,1046,0.5,0.2,"triangle");
      shapeFx(t,x,y,w,col,true);
      for(let i=0;i<24;i++){const a=rnd(0,TAU),s=rnd(3,9);
        berries.push({x:baseX,y:baseY-tierH,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,
          r:rnd(tierH*0.16,tierH*0.3),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),
          life:1,decay:0.006,col:pick(FRUIT)});}
    }else{
      api.boom(0.4);
      shapeFx(t,x,y,w,col,combo>=5);
    }
    if(combo>1)floats.push({x,y:y-tierH,txt:"x"+combo,life:1,vy:-1.1,
      col:combo>=8?"#ff2bff":combo>=5?"#ff3b6b":"#ffd23f",size:combo>=5?40:30});
    if(combo>0&&combo%6===0)floats.push({x:baseX,y:baseY-tierH*2,txt:"あまーい！",
      life:1,vy:-0.7,col:"#ff7aa8",size:26});
    checkStage();
  }

  function startFever(){
    fever=FEVER_LEN;feverGauge=0;
    flash=1;flashCol="#ff9af0";shockT=1;
    api.boom(0.7);api.shake(18);hstop(6);
    api.slide(392,1568,0.6,0.25,"triangle");
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(523*Math.pow(2,s/12),0.15,"triangle",0.13),i*60));
    floats.push({x:W/2,y:H*0.32,txt:"あまあま フィーバー！",life:1,vy:-0.4,col:"#ff2bff",size:40});
    floats.push({x:W/2,y:H*0.32+34,txt:"ぜんぶ 1ぱつ！ てんすう 2ばい！",life:1,vy:-0.4,col:"#fff",size:20});
  }
  function endFever(){
    fever=0;
    api.slide(880,220,0.5,0.15,"sine");
    floats.push({x:W/2,y:H*0.32,txt:"フィーバー おしまい",life:1,vy:-0.5,col:"#fff",size:24});
  }
  function checkStage(){
    if(aliveCount()>0||clearT>0||finaleT>0)return;
    // ③ パーフェクト: このステージを ミスタップ0(むだ打ちなし)で全部つぶしたら +3 & 祝福。
    //    気づくと得する考えどころ。ミスタップ0でなければ何も起きない(減点なし)。
    if(stageMiss===0){
      count+=3;api.setScore(count);perfectT=1.7;
      api.tone(1318,0.14,"triangle",0.12);api.tone(1976,0.16,"triangle",0.09);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(3,8);
        berries.push({x:baseX,y:baseY-tierH*1.6,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,
          r:rnd(tierH*0.12,tierH*0.2),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.008,col:"#7be08a"});}
    }
    if(stage>=8){
      fever=0;
      finaleT=2.6;flash=1;flashCol=sky()[3];
      api.boom(0.7);api.shake(20);
      api.slide(523,1318,0.6,0.22,"triangle");
    }else if(fever>0){
      // during fever: no waiting, next cake appears instantly to keep smashing
      stage++;
      flash=Math.min(1,flash+0.6);flashCol="#fff6c8";
      api.boom(0.4);api.shake(8);
      floats.push({x:W/2,y:H*0.5,txt:"つぎの ケーキ！",life:1,vy:-0.8,col:"#ffd23f",size:30});
      newCake();
    }else{
      clearTxt="ステージ"+stage+" クリア！";
      clearT=1.7;flash=1;flashCol="#fff6c8";
      api.boom(0.5);api.shake(12);
      api.slide(523,784,0.3,0.2,"triangle");api.tone(988,0.3,"triangle",0.1);
      stage++;
      // next-stage teaser: what flavor is coming
      clearSub="つぎは "+flavor().name+"の ケーキ！"+(stage===3?" かたいのも でるよ！":"");
    }
  }

  return {
    resize:layout,
    input(x,y,type){
      if(type!=="down")return;
      if(clearT>0||finaleT>0)return;
      // fever cupcakes: generous tap radius, +2 each
      if(cupcakes.length){
        let bi=-1,bd=1e9;
        for(let i=0;i<cupcakes.length;i++){const c=cupcakes[i];
          const d=Math.hypot(x-c.x,y-c.y);if(d<bd){bd=d;bi=i;}}
        if(bi>=0&&bd<cupcakes[bi].r*2.6){
          const c=cupcakes.splice(bi,1)[0];
          count+=2;api.setScore(count);combo++;comboT=1;
          api.tone(880,0.1,"triangle",0.12);api.slide(600,1200,0.15,0.15,"sine");
          popFxCrisp(c.x,c.y,c.r*1.6,c.col);   // 軸7補助: タワーの crumbs+cream+berries とは別の「ぱりんと弾け割れる」演出
          floats.push({x:c.x,y:c.y-20,txt:"+2",life:1,vy:-1,col:"#ff7ad0",size:26});
          api.shake(3);
          return;
        }
      }
      // tap hits the topmost remaining tier near the touch (forgiving column)
      const t=topTier();
      if(t){
        // 軸3(歯ごたえ): 連打で当たり続けないよう吸着範囲を絞る(縦方向の余白が特に広かった)
        const within=Math.abs(x-t.x)<t.w*0.5 && Math.abs(y-t.y)<tierH*0.9+H*0.04;
        if(within){ smashTier(t,false); return; }
      }
      // ④ ひみつ発見: ケーキに当たらなかったタップが 空にただよう おかし に届いたら、
      //    コインがキラッ(減点なし)。ミスタップのときだけ判定=既存操作と衝突しない。むだ打ち扱いにもならない。
      let mi=-1,md=1e9;
      for(let i=0;i<motes.length;i++){const m=motes[i];const d=Math.hypot(x-m.x,y-m.y);if(d<md){md=d;mi=i;}}
      if(mi>=0&&md<motes[mi].r+H*0.05){
        const m=motes[mi];
        count+=1;api.setScore(count);
        api.tone(1318,0.1,"triangle",0.1);api.tone(1760,0.12,"triangle",0.07);
        floats.push({x:m.x,y:m.y-14,txt:"ひみつ！",life:1,vy:-1,col:"#ffd23f",size:20});
        for(let k=0;k<8;k++){const a=rnd(0,TAU),s=rnd(2,6);
          sparks.push({x:m.x,y:m.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(6,12),life:1,decay:rnd(0.05,0.08)});}
        m.y=H+20;m.x=rnd(0,W);   // 見つけた おかし は下から出直す
        return;
      }
      // missed tap: tiny crumb puff, gentle tap sound, no penalty
      stageMiss++;   // ③ パーフェクト判定: むだ打ちを記録(むだ打ちがあると パーフェクトにならない)
      api.tone(220,0.05,"triangle",0.07);
      for(let i=0;i<5;i++){const a=rnd(0,TAU),s=rnd(2,5);
        sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(5,11),life:1,decay:rnd(0.06,0.1)});}
    },
    frame(dt,now){
      tsec+=0.016*dt;
      hsCd=Math.max(0,hsCd-dt);
      if(fever>0){fever-=0.016*dt;if(fever<=0)endFever();}
      if(!W||!H)layout();

      // ---- sky gradient(画像背景があれば cover で敷き、面パレットは薄い重ねで表現) ----
      const sk=sky();
      imgBg=api.drawCover("bg.jpg");
      if(imgBg){
        g.save();g.globalAlpha=0.22;
        const tg=g.createLinearGradient(0,0,0,H);
        tg.addColorStop(0,sk[0]);tg.addColorStop(0.4,sk[1]);
        tg.addColorStop(0.75,sk[2]);tg.addColorStop(1,sk[3]);
        g.fillStyle=tg;g.fillRect(0,0,W,H);g.restore();
      }else{
        const grd=g.createLinearGradient(0,0,0,H);
        grd.addColorStop(0,sk[0]);grd.addColorStop(0.4,sk[1]);
        grd.addColorStop(0.75,sk[2]);grd.addColorStop(1,sk[3]);
        g.fillStyle=grd;g.fillRect(0,0,W,H);
      }

      // ---- fever: rainbow sky wash (hue cycles) ----
      if(fever>0){
        const fa=clamp(fever>FEVER_LEN-0.6?(FEVER_LEN-fever)/0.6:fever<1?fever:1,0,1);
        const hue=(tsec*90)%360;
        const rg2=g.createLinearGradient(0,0,0,H);
        for(let i=0;i<=4;i++)rg2.addColorStop(i/4,"hsla("+((hue+i*60)%360)+",85%,78%,"+(0.5*fa)+")");
        g.fillStyle=rg2;g.fillRect(0,0,W,H);
      }

      // soft sweet glow upper area
      let glow=g.createRadialGradient(W*0.5,H*0.12,0,W*0.5,H*0.12,W*0.7);
      glow.addColorStop(0,"rgba(255,255,255,.35)");glow.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=glow;g.fillRect(0,0,W,H);

      // ---- floating sweets (candy/donut/gumdrop) drifting up ----
      for(const m of motes){
        m.y-=m.sp*dt; m.x+=Math.sin(tsec+m.ph)*0.3*dt; m.ph+=0.02*dt;
        if(m.y<-20){m.y=H+20;m.x=rnd(0,W);}
        g.save();g.globalAlpha=0.55;g.translate(m.x,m.y);g.rotate(Math.sin(tsec*0.5+m.ph)*0.3);
        if(m.kind===0){ // gumdrop
          g.fillStyle=m.col;g.beginPath();g.arc(0,0,m.r,Math.PI,TAU);g.lineTo(m.r,m.r*0.7);
          g.lineTo(-m.r,m.r*0.7);g.closePath();g.fill();
          g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(-m.r*0.3,-m.r*0.2,m.r*0.22,0,TAU);g.fill();
        }else if(m.kind===1){ // candy circle
          g.fillStyle=m.col;g.beginPath();g.arc(0,0,m.r,0,TAU);g.fill();
          g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=m.r*0.3;
          g.beginPath();g.arc(0,0,m.r*0.55,0.3,2.2);g.stroke();
        }else{ // donut
          g.fillStyle=m.col;g.beginPath();g.arc(0,0,m.r,0,TAU);g.fill();
          g.fillStyle="rgba(255,255,255,.35)";g.beginPath();g.arc(0,0,m.r*0.4,0,TAU);g.fill();
        }
        g.restore();
      }
      g.globalAlpha=1;

      // ---- ground (chocolate floor) ---- 画像背景の時は絵の床を活かして平坦な帯は描かない
      if(!imgBg){
        let fg=g.createLinearGradient(0,baseY,0,H);
        fg.addColorStop(0,"#a86a3a");fg.addColorStop(1,"#6e3f1e");
        g.fillStyle=fg;g.fillRect(0,baseY,W,H-baseY);
        g.fillStyle="rgba(255,255,255,.12)";g.fillRect(0,baseY,W,3);
      }
      // cake plate
      g.fillStyle="rgba(255,255,255,.85)";
      g.beginPath();g.ellipse(baseX,baseY+4,tierW*0.78,tierH*0.4,0,0,TAU);g.fill();
      g.fillStyle="rgba(0,0,0,.12)";
      g.beginPath();g.ellipse(baseX,baseY+tierH*0.18,tierW*0.62,tierH*0.26,0,0,TAU);g.fill();

      // ---- update + draw tiers (bottom to top) ----
      const aliveBefore=tiers.filter(t=>!t.dead);
      for(const t of tiers){
        if(t.dead)continue;
        if(t.wob>0)t.wob=Math.max(0,t.wob-0.06*dt);
        if(t.hit>0)t.hit=Math.max(0,t.hit-0.08*dt);
        t.bob+=0.05*dt;
        if(t.shape==="donut")drawDonutTier(t);else if(t.shape==="roll")drawRollTier(t);else drawTier(t);
      }
      // little cherry on the very top (if a top tier exists)
      const tt=topTier();
      if(tt) drawCherry(tt);

      // ① にじいろ接近の予告: このケーキに にじいろ段 が残っていたら、上に虹の予告マーク(=次くるかもの ドキドキ)
      const rbTier=tiers.find(t=>!t.dead&&t.rb);
      if(rbTier&&clearT<=0&&finaleT<=0){
        const mx=baseX, my=(tt?tt.y:baseY)-tierH*1.5, pulse=0.5+0.5*Math.sin(tsec*6);
        const RBC=["#ff5da2","#ff8a3a","#ffd23f","#7be08a","#36c9ff","#b066ff"];
        g.save();g.lineCap="round";g.lineJoin="round";
        g.globalAlpha=0.4+0.35*pulse;g.lineWidth=3;
        for(let k=0;k<3;k++){g.strokeStyle=RBC[(Math.floor(tsec*4)+k)%RBC.length];
          g.beginPath();g.arc(mx,my,Math.max(0,tierH*0.5+k*4+pulse*3),0,TAU);g.stroke();}
        for(let k=0;k<3;k++){g.strokeStyle=RBC[(k*2)%RBC.length];
          const oy=my+tierH*0.7+k*9+pulse*3;
          g.beginPath();g.moveTo(mx-12,oy-9);g.lineTo(mx,oy);g.lineTo(mx+12,oy-9);g.stroke();}
        g.restore();g.globalAlpha=1;
        g.save();g.globalAlpha=0.5+0.4*pulse;g.textAlign="center";
        g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=4;g.strokeStyle="rgba(120,40,80,.4)";g.strokeText("にじいろ入り！",mx,my-tierH*0.7);
        g.fillStyle="#ff5da2";g.fillText("にじいろ入り！",mx,my-tierH*0.7);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }

      // ---- crumbs (sponge chunks) ----
      for(const c of crumbs){c.vy+=0.4*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=c.vr*dt;
        if(c.y>baseY-2){c.y=baseY-2;c.vy*=-0.4;c.vx*=0.7;c.life-=0.05*dt;}
        c.life-=c.decay*dt;
        g.save();g.globalAlpha=Math.max(0,c.life);g.translate(c.x,c.y);g.rotate(c.rot);
        g.fillStyle=c.col;roundRect(-c.s/2,-c.s/2,c.s,c.s*0.8,c.s*0.2);g.fill();
        g.fillStyle="rgba(255,255,255,.25)";g.fillRect(-c.s/2,-c.s/2,c.s,c.s*0.25);
        g.restore();}
      crumbs=crumbs.filter(c=>c.life>0);
      if(crumbs.length>140)crumbs.splice(0,crumbs.length-140);

      // ---- cream blobs ----
      for(const cr of creams){cr.vy+=0.34*dt;cr.x+=cr.vx*dt;cr.y+=cr.vy*dt;cr.life-=cr.decay*dt;
        g.save();g.globalAlpha=Math.max(0,cr.life);g.fillStyle=cr.col;
        g.beginPath();g.arc(cr.x,cr.y,cr.r*(0.6+cr.life*0.4),0,TAU);g.fill();
        g.fillStyle="rgba(255,255,255,.5)";
        g.beginPath();g.arc(cr.x-cr.r*0.25,cr.y-cr.r*0.25,cr.r*0.25,0,TAU);g.fill();
        g.restore();}
      creams=creams.filter(cr=>cr.life>0);

      // ---- berries (bouncy fruit) ----
      for(const b of berries){b.vy+=0.35*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.rot+=b.vr*dt;
        if(b.y>baseY-2){b.y=baseY-2;b.vy*=-0.45;b.vx*=0.72;if(Math.abs(b.vy)<1.4)b.life-=0.03*dt;}
        b.life-=b.decay*dt;
        g.save();g.globalAlpha=Math.max(0,b.life);g.translate(b.x,b.y);g.rotate(b.rot);
        g.fillStyle=b.col;g.beginPath();g.arc(0,0,b.r,0,TAU);g.fill();
        g.fillStyle="rgba(255,255,255,.55)";g.beginPath();g.arc(-b.r*0.3,-b.r*0.3,b.r*0.28,0,TAU);g.fill();
        g.restore();}
      berries=berries.filter(b=>b.life>0);
      if(berries.length>80)berries.splice(0,berries.length-80);

      // ---- rolling donut-ring debris (軸7: 砕けるでなく転がる壊れ方) ----
      for(const r of rolls){
        r.vy+=0.32*dt;r.x+=r.vx*dt;r.y+=r.vy*dt;r.rot+=r.vr*dt;
        if(r.y>baseY-2){r.y=baseY-2;r.vy*=-0.35;r.vx*=0.88;if(Math.abs(r.vx)<0.6)r.vr*=0.94;else r.life-=0.006*dt;}
        r.life-=r.decay*dt;
        const rr=Math.max(0,r.r*(0.7+r.life*0.3));
        g.save();g.globalAlpha=Math.max(0,r.life);g.translate(r.x,r.y);g.rotate(r.rot);
        g.fillStyle=r.col;g.beginPath();g.arc(0,0,rr,0,TAU);g.fill();
        g.fillStyle="rgba(0,0,0,.16)";g.beginPath();g.arc(0,0,Math.max(0,rr*0.42),0,TAU);g.fill();
        g.fillStyle=r.glaze;g.beginPath();g.arc(0,-rr*0.15,Math.max(0,rr*0.7),TAU*0.05,TAU*0.5);g.fill();
        g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(-rr*0.3,-rr*0.3,Math.max(0,rr*0.16),0,TAU);g.fill();
        g.restore();
      }
      rolls=rolls.filter(r=>r.life>0);
      if(rolls.length>40)rolls.splice(0,rolls.length-40);

      // ---- split roll-cake halves flying apart (軸7: crumbs/rolls とも別の壊れ方) ----
      halves=halves.filter(hf=>{
        hf.vy+=0.3*dt;hf.x+=hf.vx*dt;hf.y+=hf.vy*dt;hf.rot+=hf.vr*dt;hf.life-=hf.decay*dt;
        if(hf.life<=0)return false;
        drawHalfRoll(hf);
        return true;
      });
      if(halves.length>20)halves.splice(0,halves.length-20);

      // ---- crisp shell shards (軸7補助: フィーバーカップケーキ専用のパリッと弾け割れる破片) ----
      g.save();g.globalCompositeOperation="lighter";
      for(const s of shards){
        s.vy+=0.3*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.rot+=s.vr*dt;s.life-=s.decay*dt;
        const sl=Math.max(0,s.s);
        g.save();g.globalAlpha=Math.max(0,s.life)*0.85;g.translate(s.x,s.y);g.rotate(s.rot);
        g.fillStyle=s.col;
        g.beginPath();g.moveTo(0,-sl*0.5);g.lineTo(sl*0.22,sl*0.4);g.lineTo(-sl*0.22,sl*0.4);g.closePath();g.fill();
        g.restore();
      }
      g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";
      shards=shards.filter(s=>s.life>0);
      if(shards.length>60)shards.splice(0,shards.length-60);

      // ---- fever cupcakes raining from the sky (tappable bonus) ----
      if(fever>0){
        if(cupcakes.length<6&&Math.random()<0.035*dt)
          cupcakes.push({x:rnd(W*0.12,W*0.88),y:-40,vy:rnd(1.1,2),
            rot:rnd(0,TAU),vr:rnd(0.03,0.08),col:pick(FRUIT),r:clamp(H*0.035,18,30)});
      }else{
        // 軸7補助: フィーバー以外の通常プレイ中も低頻度(だいたい20秒に1個・同時1個まで)で紛れ込ませる
        cupIdleT-=0.016*dt;
        if(cupIdleT<=0&&cupcakes.length<1&&clearT<=0&&finaleT<=0){
          cupcakes.push({x:rnd(W*0.12,W*0.88),y:-40,vy:rnd(1.0,1.7),
            rot:rnd(0,TAU),vr:rnd(0.03,0.08),col:pick(FRUIT),r:clamp(H*0.035,18,30)});
          cupIdleT=rnd(17,23);
        }
      }
      cupcakes=cupcakes.filter(c=>{
        c.y+=c.vy*dt;c.rot+=c.vr*dt;
        if(c.y>baseY-c.r*0.3){   // reached ground: little cream splat, gone
          for(let i=0;i<4;i++)creams.push({x:c.x+rnd(-6,6),y:baseY-4,vx:rnd(-2,2),vy:-rnd(1,3),
            r:rnd(6,10),life:1,decay:0.02,col:"#fff6ea"});
          return false;
        }
        drawCupcake(c);
        return true;
      });

      // ---- shockwave rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*4;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);

      // ---- glint sparks (additive) ----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#fff7c2";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;
      sparks=sparks.filter(sp=>sp.life>0);

      // ---- floats (combo text) ----
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.018*dt;
        g.save();g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(120,40,80,.5)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.restore();}
      g.globalAlpha=1;g.textAlign="left";
      floats=floats.filter(f=>f.life>0);

      // ---- big finale shock flash ----
      if(shockT>0){
        const cw=g.createRadialGradient(baseX,baseY-tierH*2,0,baseX,baseY-tierH*2,W*0.8);
        cw.addColorStop(0,"rgba(255,240,210,"+(0.5*shockT)+")");
        cw.addColorStop(0.5,"rgba(255,190,220,"+(0.26*shockT)+")");
        cw.addColorStop(1,"rgba(255,190,220,0)");
        g.save();g.globalCompositeOperation="lighter";g.fillStyle=cw;g.fillRect(0,0,W,H);g.restore();
        shockT-=0.04*dt;if(shockT<0)shockT=0;
      }

      // ---- impact flash ----
      if(flash>0){flash-=0.06*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa*0.3;
        g.fillStyle=flashCol;g.fillRect(0,0,W,H);g.restore();g.globalAlpha=1;}

      // ---- combo timer + combo text (top center) ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.1;
        g.save();g.translate(W/2,H*0.17);g.scale(pop,pop);
        g.font="800 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(255,120,160,.8)";g.shadowBlur=14;
        g.fillStyle="#ff5b8a";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.7)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }

      // ① にじいろケーキ！ 中央バナー(虹色に色替わり=レアの大きな祝福)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3;
        const RBC=["#ff5da2","#ff8a3a","#ffd23f","#7be08a","#36c9ff","#b066ff"];
        const col=RBC[Math.floor(tsec*8)%RBC.length];
        g.save();g.translate(W/2,H*0.24);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 38px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle="#ffffff";g.fillText("にじいろケーキ！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろケーキ！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央の小ヒント(初回は長め・以降は小さく)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(W/2,H*0.30);g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2=luckySeen&&luckyMsgT>1.2?"きょうのラッキー色は "+FRUITNAME[luckyColor]+"！":"ラッキー色 はっけん！";
        g.lineWidth=5;g.strokeStyle="rgba(120,40,80,.4)";g.strokeText(t2,0,0);
        g.fillStyle=FRUIT[luckyColor];g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ パーフェクト！ バナー(クリア文字 H*0.44 と重ねない下側)
      if(perfectT>0){perfectT-=0.014*dt;
        const pop=1+Math.max(0,perfectT-1.3)*1.4;
        g.save();g.translate(W/2,H*0.62);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(perfectT*1.3,0,1);g.font="900 32px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=16;g.fillStyle="#c7ffcf";
        g.fillText("パーフェクト！ ＋3",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,120,60,.7)";g.strokeText("パーフェクト！ ＋3",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(perfectT<0)perfectT=0;}

      // ---- HUD (top center) ----
      drawHUD();

      // ---- stage clear banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.4;g.fillStyle="#7a2a4a";g.fillRect(0,H*0.34,W,H*0.2);g.restore();
        const pop=1+Math.max(0,clearT-1.4)*1.8;
        g.save();g.translate(W/2,H*0.44);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,140,180,.9)";g.shadowBlur=20;g.fillStyle="#ffd23f";
        g.fillText(clearTxt,0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText(clearTxt,0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText(clearSub||"つぎは おおきい ケーキ！",0,42);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;newCake();}
      }

      // ---- finale (all clear) ----
      if(finaleT>0){finaleT-=0.012*dt;
        const a=clamp(finaleT,0,1);
        g.save();g.globalAlpha=a*0.4;g.fillStyle="#3a1030";g.fillRect(0,0,W,H);g.restore();
        // confetti rain reusing berries
        if(tsec*60%1<dt)berries.push({x:rnd(0,W),y:-10,vx:rnd(-1,1),vy:rnd(2,5),
          r:rnd(tierH*0.12,tierH*0.24),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.008,col:pick(FRUIT)});
        const pop=1+Math.sin(tsec*7)*0.06;
        g.save();g.translate(W/2,H*0.42);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 52px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,200,80,1)";g.shadowBlur=26;g.fillStyle="#ffd23f";
        g.fillText("ぜんぶ ドッカン！",0,0);
        g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle="#fff";g.strokeText("ぜんぶ ドッカン！",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("すごい！ もういちど あそべるよ",0,48);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(finaleT<=0){finaleT=0;stage=1;newCake();}
      }

      // 白飛び安全: 加算(lighter)ブロックが save/restore 頼みでも、フレーム終わりに必ず通常合成へ戻す
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
    },
    stop(){}
  };

  function drawTier(t){
    const x=t.x,y=t.y,w=t.w,h=tierH;
    // gold / にじいろ tiers shimmy constantly so they catch the eye immediately
    const wob=Math.sin(tsec*8)*t.wob*0.12+((t.gold||t.rb)?Math.sin(tsec*5+t.i)*0.03:0);
    const sx=1+t.wob*0.1, sy=1-t.wob*0.08;
    g.save();g.translate(x,y);g.rotate(wob);g.scale(sx,sy);
    if(t.gold||t.rb){
      // pulsing halo (gold=きんいろ / rb=にじいろに色が流れる)
      const hc=t.rb?["#ff5da2","#ffd23f","#36c9ff","#b066ff"][Math.floor(tsec*6)%4]:"#ffd23f";
      g.save();g.globalCompositeOperation="lighter";
      g.globalAlpha=0.4+0.3*Math.sin(tsec*6+t.i);
      g.shadowBlur=18;g.shadowColor=hc;
      g.strokeStyle=t.rb?"#ffffff":"#ffe98a";g.lineWidth=4;
      roundRect(-w/2,-h*0.5,w,h,h*0.32);g.stroke();
      // twinkling star sparkle
      const sp=0.6+0.4*Math.sin(tsec*7+t.i*2),sr=Math.max(0,h*0.22*sp);
      g.translate(-w*0.3,-h*0.05);g.rotate(tsec*1.5);
      g.fillStyle="#fff";g.globalAlpha=sp;
      g.beginPath();
      for(let k=0;k<4;k++){g.rotate(TAU/4);g.moveTo(0,0);g.lineTo(sr*0.25,-sr*0.25);g.lineTo(0,-sr);g.lineTo(-sr*0.25,-sr*0.25);g.closePath();}
      g.fill();
      g.restore();
    }
    // shadow under this tier
    g.fillStyle="rgba(0,0,0,.12)";
    g.beginPath();g.ellipse(0,h*0.5,w*0.52,h*0.22,0,0,TAU);g.fill();
    // sponge body (rounded slab) — にじいろ段 は虹のグラデーションが横に流れる
    let bg;
    if(t.rb){
      bg=g.createLinearGradient(-w/2,0,w/2,0);
      const RBC=["#ff5da2","#ff8a3a","#ffd23f","#7be08a","#36c9ff","#b066ff"];
      const shk=Math.floor(tsec*4)%RBC.length;
      for(let k=0;k<=RBC.length;k++)bg.addColorStop(k/RBC.length,RBC[(k+shk)%RBC.length]);
    }else{
      bg=g.createLinearGradient(0,-h*0.6,0,h*0.6);
      bg.addColorStop(0,lighten(t.sponge,40));bg.addColorStop(0.5,t.sponge);bg.addColorStop(1,shade(t.sponge,-26));
    }
    g.fillStyle=bg;roundRect(-w/2,-h*0.5,w,h,h*0.32);g.fill();
    // cream layer near top of the sponge
    g.fillStyle=t.cream;
    g.beginPath();g.moveTo(-w/2,-h*0.18);
    g.quadraticCurveTo(0,-h*0.34,w/2,-h*0.18);
    g.lineTo(w/2,-h*0.5+h*0.32);
    g.quadraticCurveTo(w/2,-h*0.5,w/2-h*0.32,-h*0.5);
    g.lineTo(-w/2+h*0.32,-h*0.5);
    g.quadraticCurveTo(-w/2,-h*0.5,-w/2,-h*0.5+h*0.32);
    g.closePath();g.fill();
    // dripping cream scallops along top edge
    const drips=Math.max(3,Math.round(w/(h*0.7)));
    g.fillStyle=t.cream;
    for(let d=0;d<drips;d++){
      const dx=-w/2+w*(d+0.5)/drips;
      const dl=h*(0.16+0.12*Math.abs(Math.sin(d*1.7+t.i)));
      g.beginPath();g.arc(dx,-h*0.18,h*0.16,0,TAU);g.fill();
      g.beginPath();g.moveTo(dx-h*0.13,-h*0.18);g.lineTo(dx+h*0.13,-h*0.18);
      g.lineTo(dx,-h*0.18+dl);g.closePath();g.fill();
    }
    // top sheen
    g.fillStyle="rgba(255,255,255,.3)";
    g.beginPath();g.ellipse(-w*0.18,-h*0.32,w*0.18,h*0.08,-0.2,0,TAU);g.fill();
    // rim light
    g.strokeStyle="rgba(255,255,255,.25)";g.lineWidth=2;
    roundRect(-w/2,-h*0.5,w,h,h*0.32);g.stroke();
    // crack hint if this tier still needs another tap
    if(t.hp>1){
      g.strokeStyle="rgba(120,70,40,.5)";g.lineWidth=2;g.lineCap="round";
      g.beginPath();g.moveTo(-w*0.05,-h*0.1);g.lineTo(w*0.04,h*0.05);g.lineTo(-w*0.04,h*0.2);g.stroke();
    }
    // little fruit decorations sitting on the cream
    g.fillStyle=FRUIT[t.deco%FRUIT.length];
    for(let f=0;f<3;f++){
      const fx=-w*0.28+w*0.28*f, fy=-h*0.2;
      g.beginPath();g.arc(fx,fy,h*0.12,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.6)";g.beginPath();g.arc(fx-h*0.04,fy-h*0.04,h*0.04,0,TAU);g.fill();
      g.fillStyle=FRUIT[t.deco%FRUIT.length];
    }
    // hit flash overlay
    if(t.hit>0){g.save();g.globalAlpha=t.hit*0.7;g.fillStyle="#fff";
      roundRect(-w/2,-h*0.5,w,h,h*0.32);g.fill();g.restore();}
    g.restore();
  }

  // 軸7(壊す物のバラエティ): 丸いドーナツ形の段。台形の箱ではなく輪っか状=シルエットからして別物。
  function drawDonutTier(t){
    const x=t.x,y=t.y,h=tierH;
    const rOuter=Math.max(2,Math.min(t.w,H*0.34)*0.46);
    const rInner=Math.max(0,rOuter*0.4);
    const wob=Math.sin(tsec*8)*t.wob*0.14;
    const sx=1+t.wob*0.12, sy=1-t.wob*0.1;
    g.save();g.translate(x,y);g.rotate(wob);g.scale(sx,sy);
    // shadow
    g.fillStyle="rgba(0,0,0,.14)";
    g.beginPath();g.ellipse(0,h*0.42,rOuter*0.95,h*0.22,0,0,TAU);g.fill();
    // dough ring
    const bg=g.createRadialGradient(-rOuter*0.2,-rOuter*0.25,Math.max(0,rOuter*0.1),0,0,rOuter);
    bg.addColorStop(0,lighten(t.sponge,36));bg.addColorStop(0.7,t.sponge);bg.addColorStop(1,shade(t.sponge,-24));
    g.fillStyle=bg;
    g.beginPath();g.arc(0,0,rOuter,0,TAU);g.arc(0,0,rInner,0,TAU,true);g.fill("evenodd");
    // glaze topping on the upper half only (chocolate/flavor cream drizzle look)
    g.fillStyle=t.cream;
    g.beginPath();g.arc(0,0,rOuter*0.94,Math.PI*1.08,Math.PI*1.96);
    g.arc(0,0,rInner*1.1,Math.PI*1.96,Math.PI*1.08,true);g.fill();
    // sprinkles instead of fruit dots
    g.save();
    for(let k=0;k<6;k++){
      const ang=(k/6)*TAU+t.bob*0.2;
      const rr=(rOuter+rInner)/2;
      const px=Math.cos(ang)*rr, py=Math.sin(ang)*rr*0.9-rOuter*0.12;
      g.save();g.translate(px,py);g.rotate(ang+k);
      g.fillStyle=FRUIT[(t.deco+k)%FRUIT.length];
      g.fillRect(-h*0.05,-h*0.015,h*0.1,h*0.03);
      g.restore();
    }
    g.restore();
    // rim light
    g.strokeStyle="rgba(255,255,255,.3)";g.lineWidth=2;
    g.beginPath();g.arc(0,0,rOuter,0,TAU);g.stroke();
    g.strokeStyle="rgba(120,70,40,.35)";g.lineWidth=1.5;
    g.beginPath();g.arc(0,0,rInner,0,TAU);g.stroke();
    // crack hint if this tier still needs another tap
    if(t.hp>1){
      g.strokeStyle="rgba(120,70,40,.5)";g.lineWidth=2;g.lineCap="round";
      g.beginPath();g.moveTo(-rOuter*0.3,-rOuter*0.3);g.lineTo(rOuter*0.1,0);g.lineTo(-rOuter*0.1,rOuter*0.4);g.stroke();
    }
    // hit flash overlay
    if(t.hit>0){g.save();g.globalAlpha=t.hit*0.7;g.fillStyle="#fff";
      g.beginPath();g.arc(0,0,rOuter,0,TAU);g.arc(0,0,rInner,0,TAU,true);g.fill("evenodd");g.restore();}
    g.restore();
  }

  // 軸7(壊す物のバラエティ): 横長のロール段。台形の箱でも丸いドーナツでもなく、
  // 寝かせた円柱+渦巻きの断面=シルエットも壊れ方(popFxRoll)も別物。
  function drawRollTier(t){
    const x=t.x,y=t.y,w=t.w,h=tierH;
    const wob=Math.sin(tsec*8)*t.wob*0.12;
    const sx=1+t.wob*0.1, sy=1-t.wob*0.08;
    g.save();g.translate(x,y);g.rotate(wob);g.scale(sx,sy);
    // shadow
    g.fillStyle="rgba(0,0,0,.12)";
    g.beginPath();g.ellipse(0,h*0.46,Math.max(0,w*0.5),Math.max(0,h*0.2),0,0,TAU);g.fill();
    const rW=w*0.5, rH=Math.max(2,h*0.42);
    // cylindrical body (long roll, lying sideways)
    const bg=g.createLinearGradient(0,-rH,0,rH);
    bg.addColorStop(0,lighten(t.sponge,34));bg.addColorStop(0.5,t.sponge);bg.addColorStop(1,shade(t.sponge,-22));
    g.fillStyle=bg;
    roundRect(-rW,-rH,rW*2,rH*2,rH);g.fill();
    // spiral cut face at one end — the swirl pattern reads as "roll", not a block
    const cx=rW*0.78, cr=Math.max(0,rH*0.92);
    for(let k=4;k>=1;k--){
      g.fillStyle=(k%2===0)?t.cream:t.sponge;
      g.beginPath();g.arc(cx,0,Math.max(0,cr*k/4.3),0,TAU);g.fill();
    }
    g.strokeStyle="rgba(120,70,40,.35)";g.lineWidth=1.5;
    g.beginPath();g.arc(cx,0,cr,0,TAU);g.stroke();
    // rim light
    g.strokeStyle="rgba(255,255,255,.3)";g.lineWidth=2;
    roundRect(-rW,-rH,rW*2,rH*2,rH);g.stroke();
    // powdered sugar dusting along the top
    g.fillStyle="rgba(255,255,255,.7)";
    for(let d=0;d<5;d++){const dx=-rW*0.7+rW*1.4*(d/4);g.beginPath();g.arc(dx,-rH*0.6,Math.max(0,h*0.03),0,TAU);g.fill();}
    // crack hint if this tier still needs another tap
    if(t.hp>1){
      g.strokeStyle="rgba(120,70,40,.5)";g.lineWidth=2;g.lineCap="round";
      g.beginPath();g.moveTo(-w*0.1,-rH*0.3);g.lineTo(w*0.02,rH*0.1);g.lineTo(-w*0.06,rH*0.35);g.stroke();
    }
    // hit flash overlay
    if(t.hit>0){g.save();g.globalAlpha=t.hit*0.7;g.fillStyle="#fff";
      roundRect(-rW,-rH,rW*2,rH*2,rH);g.fill();g.restore();}
    g.restore();
  }

  function drawCherry(t){
    const x=t.x,y=t.y-tierH*0.5,bob=Math.sin(tsec*3+t.i)*tierH*0.04;
    g.save();g.translate(x,y+bob);
    // cherry.png は生成2回とも不良(茎の付け根に台座/二重出力)のため手描き固定
    // stem
    g.strokeStyle="#7a4a20";g.lineWidth=tierH*0.06;g.lineCap="round";
    g.beginPath();g.moveTo(0,-tierH*0.12);g.quadraticCurveTo(tierH*0.14,-tierH*0.4,tierH*0.04,-tierH*0.5);g.stroke();
    // cherry
    const cg=g.createRadialGradient(-tierH*0.06,-tierH*0.06,tierH*0.02,0,0,tierH*0.2);
    cg.addColorStop(0,"#ff6b8a");cg.addColorStop(1,"#d11f4a");
    g.fillStyle=cg;g.beginPath();g.arc(0,0,tierH*0.16,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(-tierH*0.05,-tierH*0.05,tierH*0.05,0,TAU);g.fill();
    g.restore();
  }

  function drawCupcake(c){
    const r=c.r;
    g.save();g.translate(c.x,c.y);g.rotate(Math.sin(c.rot)*0.25);
    // soft glow so it reads as "bonus"
    g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.4;
    g.shadowBlur=14;g.shadowColor="#fff";g.fillStyle="rgba(255,255,255,.25)";
    g.beginPath();g.arc(0,0,Math.max(0,r*1.15),0,TAU);g.fill();g.restore();
    // cupcake.png は生成2回とも不良(色違い/影/ラッパー色が指定と不一致)のため手描き固定
    // paper cup
    g.fillStyle=c.col;
    g.beginPath();g.moveTo(-r*0.7,0);g.lineTo(r*0.7,0);g.lineTo(r*0.45,r*0.9);g.lineTo(-r*0.45,r*0.9);g.closePath();g.fill();
    g.fillStyle="rgba(255,255,255,.35)";
    for(let i=-1;i<=1;i++)g.fillRect(i*r*0.3-r*0.05,0,r*0.1,r*0.8);
    // cream swirl
    g.fillStyle="#fff6ea";
    g.beginPath();g.arc(0,-r*0.25,r*0.6,0,TAU);g.fill();
    g.beginPath();g.arc(-r*0.32,-r*0.05,r*0.34,0,TAU);g.fill();
    g.beginPath();g.arc(r*0.32,-r*0.05,r*0.34,0,TAU);g.fill();
    g.beginPath();g.arc(0,-r*0.62,r*0.34,0,TAU);g.fill();
    // cherry on top
    g.fillStyle="#ff4d6d";g.beginPath();g.arc(0,-r*0.95,r*0.2,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(-r*0.06,-r*1.0,r*0.07,0,TAU);g.fill();
    g.restore();
  }

  // 軸7: ロール段が割れた片方(渦巻き断面のまま左右に吹っ飛ぶ、crumbs/rolls とは別の絵)
  function drawHalfRoll(hf){
    const r=Math.max(0,hf.r*(0.7+hf.life*0.3));
    g.save();g.globalAlpha=Math.max(0,hf.life);g.translate(hf.x,hf.y);g.rotate(hf.rot);
    g.save();g.beginPath();g.rect(hf.side<0?-r:0,-r,r,r*2);g.clip();
    for(let k=5;k>=1;k--){
      g.fillStyle=(k%2===0)?hf.cream:hf.sponge;
      g.beginPath();g.arc(0,0,Math.max(0,r*k/5.2),0,TAU);g.fill();
    }
    g.restore();
    g.strokeStyle="rgba(120,70,40,.4)";g.lineWidth=1.5;
    g.beginPath();g.arc(0,0,r,hf.side<0?Math.PI*0.5:-Math.PI*0.5,hf.side<0?Math.PI*1.5:Math.PI*0.5);g.stroke();
    g.fillStyle="rgba(255,255,255,.3)";
    g.beginPath();g.ellipse(hf.side<0?-r*0.3:r*0.3,-r*0.35,Math.max(0,r*0.18),Math.max(0,r*0.1),0,0,TAU);g.fill();
    g.restore();
  }

  function drawHUD(){
    const left=clamp(stageGoal-stageSmash,0,stageGoal);
    const bw=Math.min(W*0.6,360),bh=15,bx=(W-bw)/2,by=H*0.045;
    g.save();g.textAlign="center";
    g.font="800 17px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#7a2a4a";g.shadowColor="rgba(255,255,255,.6)";g.shadowBlur=5;
    g.fillText("ステージ "+stage+"      ケーキ あと "+left,W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(120,40,80,.25)";roundRect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageSmash/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#ff9ac2");gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg;roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=2;roundRect(bx,by,bw,bh,bh/2);g.stroke();
    // ---- fever gauge (fills as you smash; during fever = remaining time, rainbow) ----
    const gw=bw*0.72,gh=9,gx=(W-gw)/2,gy=by+bh+7;
    g.fillStyle="rgba(120,40,80,.22)";roundRect(gx,gy,gw,gh,gh/2);g.fill();
    const gf=fever>0?clamp(fever/FEVER_LEN,0,1):feverGauge;
    if(gf>0.01){
      const cg=g.createLinearGradient(gx,0,gx+gw,0);
      if(fever>0){const hu=(tsec*200)%360;
        cg.addColorStop(0,"hsl("+hu+",90%,65%)");cg.addColorStop(1,"hsl("+((hu+90)%360)+",90%,65%)");}
      else{cg.addColorStop(0,"#ff7ad0");cg.addColorStop(1,"#ff2bff");}
      g.save();if(fever>0){g.shadowBlur=10+5*Math.sin(tsec*8);g.shadowColor="#ff2bff";}
      g.fillStyle=cg;roundRect(gx,gy,Math.max(gh,gw*gf),gh,gh/2);g.fill();g.restore();
    }
    g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=1.5;roundRect(gx,gy,gw,gh,gh/2);g.stroke();
    g.font="800 12px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle=fever>0?"#ff2bff":"#a8447a";
    g.fillText(fever>0?"フィーバーちゅう！":"フィーバー",W/2,gy+gh+13);
    g.restore();g.textAlign="left";
  }

  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function lighten(hex,amt){const a=amt===undefined?50:amt;const c=parseInt(hex.slice(1),16);
    const r=Math.min(255,((c>>16)&255)+a),gg=Math.min(255,((c>>8)&255)+a),b=Math.min(255,(c&255)+a);
    return "rgb("+r+","+gg+","+b+")";}
  function shade(hex,amt){const c=parseInt(hex.slice(1),16);
    const r=clamp(((c>>16)&255)+amt,0,255),gg=clamp(((c>>8)&255)+amt,0,255),b=clamp((c&255)+amt,0,255);
    return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("cakesmash", build_cakesmash);
