function buildPenguin(api){
  const g=api.g;
  api.preload(["bg.jpg","penguin.png","goldpin.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)
  // ---- all mutable state closed inside build ----
  let groundY,laneX0,laneX1,startX,startY,pinR,penR;
  let peng={x:0,y:0,vx:0,vy:0,sliding:false,roll:0,sq:1};
  let aim={active:false,x:0,y:0};            // drag aim line while charging
  let pins=[],shards=[],sparks=[],rings=[],puffs=[],snow=[],motes=[],floats=[];
  let count=0,combo=0,comboT=0,tsec=0;
  let strikeT=0,strikeTxt="",flash=0,settleT=0;
  // stage progression: clear a number of throws-with-hits to advance; endless
  let stage=1,stageDown=0,stageGoal=15,clearT=0,clearStage=0,clearSub="";   // 7〜8歳向け: 目標本数を約2割増
  function stageGoalFor(s){return 15+(s-1)*4;}     // 15,19,23,27...
  function rackSizeFor(s){return clamp(7+s,8,10);} // 8..10本(最初から1本多い)
  // gold pin (rare bonus) + fever time state
  let goldPity=0;                              // racks since last gold (pity timer)
  let fever=0,feverGauge=0,feverBann=0,feverEndT=0;
  let hsCd=0;                                  // hitStop cooldown (frames) — never spam freeze
  const FEVER_LEN=12;                          // seconds of fever
  const RAINBOW=["#ff5b5b","#ff8c42","#ffd23f","#7be08a","#4db8ff","#b58bff","#ff7bd0"];
  const PINCOLS=["#bfe9f5","#dff6ff","#cfeeff","#eaf7ff"];
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  const BANDCOLS=["#ff6b6b","#4db8ff","#ffd23f","#7be08a","#ff8fb3"];   // ピンの帯(しま)の色
  const BANDNAME={"#ff6b6b":"あか","#4db8ff":"あお","#ffd23f":"きいろ","#7be08a":"みどり","#ff8fb3":"ピンク"};
  let luckyBand=pick(BANDCOLS),luckyMsgT=2.2;   // ② きょうのラッキー色: 秘密の1色(最初に一度だけ教える)
  let rbMsgT=0;                                  // ① にじいろピン 発見バナー
  let stageWhiff=0,noMissT=0;                    // ③ ノーミス(毎投1本以上)判定
  let sunWink=0;                                 // ④ 太陽ひみつタップ
  let twinkles=[];                               // ② ④ 小さな星のキラッ
  let aimDX=0,aimDY=0;                           // タップ判定用(ダウン位置)
  const sunPos={x:0,y:0,r:0};                    // ④ 太陽の当たり判定(layoutで確定)
  // per-stage sky palette (winter moods) + name for "next stage" teaser
  const STAGE_SKY=[
    {a:"#bfe9f5",b:"#7fc6e6",c:"#4a93c4",name:"はれ の そら"},     // 1 clear day
    {a:"#cfe0ff",b:"#9bb6ff",c:"#5f7fe0",name:"こおり の あお"},   // 2 cold blue
    {a:"#ffe4f0",b:"#d9a8e6",c:"#9a6fc4",name:"ピンク の ゆうぐれ"},// 3 pink dusk
    {a:"#dfe9f5",b:"#aab8d6",c:"#6a7aa8",name:"ふぶき の まち"},   // 4 snowstorm grey
    {a:"#fff0c8",b:"#ffd28a",c:"#e08a5a",name:"ゆうやけ ファイナル"} // 5 sunset finale
  ];
  function sky(){return STAGE_SKY[(stage-1)%STAGE_SKY.length];}

  function layout(){
    groundY=api.H*0.86;
    laneX0=api.W*0.16; laneX1=api.W*0.84;
    startX=api.W*0.5; startY=api.H*0.78;
    pinR=clamp(Math.min(api.W,api.H)*0.035,16,30);
    penR=clamp(Math.min(api.W,api.H)*0.05,22,40);
    // place pins if a rack exists, else rebuild
    if(pins.length===0) setupRack(); else positionRack();
    // ④ 太陽ひみつタップの当たり判定(描画位置と一致・寛容に大きめ)
    sunPos.x=api.W*0.74; sunPos.y=api.H*0.14; sunPos.r=Math.max(42,api.W*0.085);
    buildSnow();
  }
  function pinSpot(i){
    // triangle rack of up to 10 pins near the top of the lane
    const rows=[1,2,3,4];
    let idx=0,row=0;
    for(let r=0;r<rows.length;r++){ if(i<idx+rows[r]){row=r;break;} idx+=rows[r]; }
    const inRow=i-idx, cnt=rows[row];
    const apexY=api.H*0.30, rowGap=pinR*2.6;
    const spread=pinR*2.4;
    const y=apexY+row*rowGap;
    const x=api.W*0.5+(inRow-(cnt-1)/2)*spread;
    return {x,y};
  }
  function setupRack(){
    const n=rackSizeFor(stage);    // 8..10 pins, more as stages climb
    pins=[];
    for(let i=0;i<n;i++){ const s=pinSpot(i);
      // 軸7(壊す物のバラエティ): 先頭に一回り大きい『ボスピン』、4本おきに丸い雪玉、5本おきに角ばった氷ブロックを混ぜて3形状を常時混在させる
      const kind=i===0?'big':(i%5===4?'block':(i%4===2?'ball':'pin'));
      pins.push({hx:s.x,hy:s.y,x:s.x,y:s.y,vx:0,vy:0,down:false,kind:kind,
        wob:rnd(0,TAU),fall:0,col:pick(PINCOLS),band:pick(BANDCOLS),rot:0,vr:0,gold:false,rainbow:false}); }
    // rare GOLD pin: sparkling, worth big points; fever racks glitter far more often
    // 金/虹の特別演出は絵柄の一貫性のため通常ピン(kind==='pin')だけに乗せる
    const normalPins=pins.filter(p=>p.kind==='pin');
    goldPity++;
    const gch=fever>0?0.4:clamp(0.08+stage*0.01,0.08,0.18);
    if(normalPins.length&&(goldPity>=5||Math.random()<gch)){
      const gp=pick(normalPins); gp.gold=true; gp.col="#ffd23f"; goldPity=0;
      api.tone(1318,0.12,"triangle",0.09);
      setTimeout(()=>api.tone(1568,0.16,"triangle",0.09),90);
    }
    // ① にじいろピン: ゴールドより さらにレアな激レア(数%)。虹色に光り、当てると虹の大演出＋大量得点。
    const rch=fever>0?0.14:0.05;
    if(Math.random()<rch){
      const cand=normalPins.filter(p=>!p.gold);
      if(cand.length){ const rp=pick(cand); rp.rainbow=true; rp.col="#ff8fb3";
        api.tone(988,0.1,"triangle",0.08);
        setTimeout(()=>api.tone(1480,0.14,"triangle",0.08),80); }
    }
  }
  function positionRack(){
    for(let i=0;i<pins.length;i++){ const s=pinSpot(i);
      pins[i].hx=s.x; pins[i].hy=s.y;
      if(!pins[i].down){ pins[i].x=s.x; pins[i].y=s.y; } }
  }
  function buildSnow(){
    snow=[]; for(let i=0;i<70;i++) snow.push({x:rnd(0,api.W),y:rnd(0,api.H),
      r:rnd(1.2,4),sp:rnd(0.4,1.6),drift:rnd(-0.4,0.4),ph:rnd(0,TAU),sw:rnd(0.01,0.04)});
    motes=[]; for(let i=0;i<16;i++) motes.push({x:rnd(0,api.W),y:rnd(0,groundY),
      r:rnd(1.5,3.5),ph:rnd(0,TAU),sp:rnd(0.01,0.03),amp:rnd(8,22),col:pick(["#fffbe8","#cdeeff","#ffe6f4"])});
  }
  layout();

  function resetThrow(){
    peng.x=startX; peng.y=startY; peng.vx=0; peng.vy=0; peng.sliding=false; peng.roll=0; peng.sq=1;
    aim.active=false;
  }
  resetThrow();

  function fxBurst(x,y,col,big,mode){
    // 軸7(壊す物のバラエティ): kindごとに壊れ方の演出を変える
    // mode==='ball' → 白い粉雪のパフ主体(砕けずポフッと散る) / mode==='block' → 角ばった破片主体(バキッと砕ける)
    rings.push({x,y,r:pinR*0.6,vr:pinR*0.7,life:1,decay:0.06,col});
    rings.push({x,y,r:pinR*0.3,vr:pinR*0.5,life:1,decay:0.05,col:"#ffffff"});
    const n=mode==='block'?(big?20:13):(big?14:8);
    if(shards.length<150) for(let i=0;i<n;i++){ const a=rnd(0,TAU),s=rnd(2,7);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,s:mode==='block'?rnd(4,9):rnd(3,7),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.022),
        col:i%3===0?col:(i%3===1?"#ffffff":"#9be8ff")}); }
    if(sparks.length<60) for(let i=0;i<rint(4,7);i++){ const a=rnd(0,TAU),s=rnd(4,10);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(7,16),life:1,decay:rnd(0.05,0.09)}); }
    const puffN=mode==='ball'?9:3;
    if(puffs.length<40) for(let i=0;i<puffN;i++) puffs.push({x:x+rnd(-10,10),y:y+rnd(-8,8),
      r:mode==='ball'?rnd(pinR*0.5,pinR*1.05):rnd(pinR*0.4,pinR*0.8),vr:rnd(0.5,1.2),life:1,decay:rnd(0.02,0.035)});
  }
  // rainbow explosion + fanfare for the gold pin
  function goldBurst(x,y){
    rings.push({x,y,r:pinR*0.5,vr:pinR*1.1,life:1,decay:0.045,col:"#ffd23f"});
    rings.push({x,y,r:pinR*0.3,vr:pinR*0.8,life:1,decay:0.04,col:"#ffffff"});
    if(shards.length<140) for(let i=0;i<20;i++){ const a=rnd(0,TAU),s=rnd(3,9);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.016),
        col:RAINBOW[i%RAINBOW.length]}); }
    if(sparks.length<60) for(let i=0;i<9;i++){ const a=rnd(0,TAU),s=rnd(5,12);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(9,18),life:1,decay:rnd(0.04,0.07)}); }
    flash=Math.min(1,flash+0.7);
    api.boom(0.5); api.shake(12);
    [0,4,7,12].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.16,"triangle",0.12),i*70));
  }
  // ① にじいろピン撃破: 虹の輪が7色ぶわっと + 大量きらめき。激レアの爽快ごほうび。
  function rainbowBurst(x,y){
    for(let k=0;k<RAINBOW.length;k++) rings.push({x,y,r:pinR*0.4,vr:pinR*(0.7+k*0.16),life:1,decay:0.05,col:RAINBOW[k]});
    if(shards.length<150) for(let i=0;i<24;i++){ const a=rnd(0,TAU),s=rnd(3,10);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.017),col:RAINBOW[i%RAINBOW.length]}); }
    if(sparks.length<70) for(let i=0;i<10;i++){ const a=rnd(0,TAU),s=rnd(5,12);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(9,18),life:1,decay:rnd(0.04,0.07)}); }
    for(let i=0;i<3;i++) twinkles.push({x:x+rnd(-pinR,pinR),y:y+rnd(-pinR,pinR),r:rnd(5,9),life:1,decay:0.02,col:pick(RAINBOW)});
    flash=Math.min(1,flash+0.5); api.boom(0.6); api.shake(14);
    if(hsCd<=0){ api.hitStop(4); hsCd=30; }
    [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.16,"triangle",0.12),i*70));
  }
  // ② ラッキー色 命中: きらっと小さめの祝福 + 頭上に小さな星(気づけるヒント)
  function luckyHit(p){
    api.tone(1046,0.14,"triangle",0.1); api.tone(1568,0.16,"triangle",0.07);
    twinkles.push({x:p.x,y:p.y-pinR*1.8,r:rnd(6,9),life:1,decay:0.02,col:luckyBand});
    if(floats.length<10) floats.push({x:clamp(p.x,60,api.W-60),y:p.y-pinR*2.2,txt:"ラッキー！",life:1,vy:-1,col:luckyBand,size:22});
  }
  // ④ 太陽ひみつタップ: 太陽に触れたら ウインク＋金のきらめき(減点なし・ごほうび)
  function sunSecret(){
    sunWink=1; api.tone(1318,0.12,"triangle",0.1); api.tone(1760,0.14,"triangle",0.08);
    for(let i=0;i<7;i++) twinkles.push({x:sunPos.x+rnd(-pinR,pinR),y:sunPos.y+rnd(-pinR*0.6,pinR),r:rnd(4,7),life:1,decay:0.014,col:"#ffe08a"});
  }
  function knockPin(p,dirx,force){
    if(p.down) return;
    p.down=true;
    if(p.kind==='ball'){
      // ③ 丸い雪玉は倒れず、勢いよく転がって画面外へ飛ぶ(通常ピンの重力落下とは別挙動)
      p.vx=dirx*(force*1.5+2)+rnd(-1,1); p.vy=-rnd(0,0.6); p.vr=(dirx>=0?1:-1)*rnd(0.4,0.7);
    } else {
      p.vx=dirx*force+rnd(-1,1); p.vy=-rnd(2,4); p.vr=rnd(-0.5,0.5);
    }
    let pts=fever>0?2:1;                     // fever = double score
    if(p.gold) pts+=4;                       // gold pin = big bonus
    if(p.rainbow) pts+=6;                    // ① にじいろピン = 激レア大量得点
    const isLucky=!p.gold&&!p.rainbow&&p.band===luckyBand;   // ② きょうのラッキー色
    if(isLucky) pts+=1;
    count+=pts; stageDown++; combo++; comboT=1; api.setScore(count);
    if(p.rainbow){
      rainbowBurst(p.x,p.y-pinR); rbMsgT=1.4;
      if(floats.length<10) floats.push({x:clamp(p.x,70,api.W-70),y:p.y-pinR*2,txt:"にじいろ！ +"+pts,life:1,vy:-1,col:"#ff7bd0",size:30});
      feverGauge=Math.min(1,feverGauge+0.5);
    } else if(p.gold){
      goldBurst(p.x,p.y-pinR);
      if(floats.length<10) floats.push({x:clamp(p.x,60,api.W-60),y:p.y-pinR*2,txt:"ゴールド！ +"+pts,life:1,vy:-1,col:"#ffd23f",size:26});
      feverGauge=Math.min(1,feverGauge+0.4);
    } else {
      // ③ ボスピン(big)は壊れる瞬間の破片を通常の1.5倍にして違いを強調。ball/blockは壊れ方の演出じたいを変える
      fxBurst(p.x,p.y-pinR,p.col,p.kind==='big'?true:combo>=4,
        p.kind==='ball'?'ball':(p.kind==='block'?'block':undefined));
      feverGauge=Math.min(1,feverGauge+0.07);
      if(isLucky) luckyHit(p);              // ② ラッキー色: 小さめ祝福＋頭上の星
    }
    api.slide(360+combo*12,150,0.12,0.26,"triangle");
    api.noise(0.1,0.16,1600,"highpass",1);
    api.tone(520*Math.pow(2,clamp(combo,0,10)/12),0.1,"sine",0.1);
    api.shake(4+Math.min(combo,8));
    if(combo>=3) flash=Math.min(1,0.4+combo*0.05);
    if((combo>=4||p.gold)&&hsCd<=0){ api.hitStop(2); hsCd=30; }   // big-hit only + cooldown
    if(fever<=0&&feverGauge>=1) startFever();
  }
  function startFever(){
    fever=FEVER_LEN; feverGauge=0; feverBann=1.8; flash=1;
    api.boom(0.7); api.shake(18);
    api.slide(392,1568,0.5,0.3,"triangle");
    [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(523*Math.pow(2,semi/12),0.15,"triangle",0.12),i*80));
    if(hsCd<=0){ api.hitStop(4); hsCd=30; }
  }
  function endFever(){
    fever=0; feverEndT=1.5; flash=Math.min(1,flash+0.4);
    api.slide(1046,392,0.5,0.2,"triangle");
  }
  function standing(){ let n=0; for(const p of pins) if(!p.down) n++; return n; }

  function endThrow(){
    const downNow=pins.length-standing();
    if(downNow===0) stageWhiff++;   // ③ 空振り(1本も倒せなかった投球)= ノーミス失敗
    const allDown=standing()===0;
    if(allDown && pins.length>0){
      // STRIKE
      strikeT=1.8; strikeTxt=pick(["ストライク！","パーフェクト！","ぜんぶ たおした！"]);
      flash=1; api.boom(0.6); api.shake(18);
      if(hsCd<=0){ api.hitStop(5); hsCd=30; }
      feverGauge=Math.min(1,feverGauge+0.25);
      if(fever<=0&&feverGauge>=1) startFever();
      api.slide(523,1046,0.45,0.24,"triangle");
      api.tone(784,0.2,"triangle",0.16);
      if(shards.length<140) for(let i=0;i<26;i++){ const a=rnd(0,TAU),s=rnd(3,9);
        shards.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,s:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.01,0.018),col:pick(PINCOLS.concat(["#ffd23f","#ff8fb3"]))}); }
    }
    checkStage();
    settleT=fever>0?0.45:0.9;   // brief pause then re-rack (fever = fast re-rack!)
  }
  function checkStage(){
    if(stageDown<stageGoal || clearT>0) return;
    clearStage=stage; clearT=2.0; flash=Math.min(1,flash+0.6);
    api.boom(0.5); api.shake(14);
    api.slide(523,784,0.3,0.2,"triangle"); api.tone(988,0.3,"triangle",0.12);
    // ③ ノーミス ボーナス: この ステージ 中 ずっと 毎投1本以上たおしたら +5 & みどりの星シャワー(気づくと得)
    if(stageWhiff===0){ count+=5; api.setScore(count); noMissT=1.9;
      api.tone(1318,0.16,"triangle",0.1);
      if(shards.length<150) for(let i=0;i<14;i++){ const a=rnd(0,TAU),s=rnd(3,8);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,s:rnd(4,8),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:"#7be08a"}); } }
    stageWhiff=0;
    stage++; stageGoal=stageGoalFor(stage); stageDown=0;
    // next-stage teaser: name the new sky + pin count so kids want "one more"
    const nm=STAGE_SKY[(stage-1)%STAGE_SKY.length].name;
    clearSub="つぎは 「"+nm+"」！ ピンが "+rackSizeFor(stage)+"ほん でてくる！";
  }

  return{
    resize:layout,
    input(px,py,type){
      // tap-and-release aim OR simple tap to fire toward the pins.
      if(type==="down"){
        if(peng.sliding||settleT>0) return;
        aim.active=true; aim.x=px; aim.y=py; aimDX=px; aimDY=py;
        return;
      }
      if(type==="move"){
        if(aim.active){ aim.x=px; aim.y=py; }
        return;
      }
      if(type==="up"){
        if(!aim.active || peng.sliding || settleT>0){ aim.active=false; return; }
        aim.active=false;
        // ④ 太陽ひみつタップ: ほぼ動かないタップが太陽に届いたら ごほうび(発射しない/減点なし)
        if(Math.hypot(px-aimDX,py-aimDY)<14 && Math.hypot(px-sunPos.x,py-sunPos.y)<sunPos.r){ sunSecret(); return; }
        // direction from penguin toward where finger lifted; if tiny drag, shoot straight up
        let dx=aim.x-peng.x, dy=aim.y-peng.y;
        let d=Math.hypot(dx,dy);
        if(d<14){ dx=0; dy=-1; d=1; }
        // clamp to mostly-forward (upward) so the penguin always heads to the pins
        const nx=dx/d; let ny=dy/d; if(ny>-0.25) ny=-0.25;
        const re=Math.hypot(nx,ny)||1;
        const power=clamp(d/(api.H*0.4),0.45,1)*18;
        peng.vx=(nx/re)*power; peng.vy=(ny/re)*power;
        peng.sliding=true; peng.roll=0;
        api.slide(180,420,0.18,0.2,"sine"); api.noise(0.18,0.12,900,"lowpass",0.7);
        api.shake(3);
        return;
      }
    },
    frame(dt,now){
      tsec+=0.016*dt;
      if(hsCd>0) hsCd-=dt;
      if(fever>0){ fever-=0.016*dt; if(fever<=0) endFever(); }
      // ---------- background ----------
      const s=sky();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージの空パレットを薄く重ねて面ごとの雰囲気を変える(1面=はれの空はそのまま)
        const si=(stage-1)%STAGE_SKY.length;
        if(si!==0){ g.save(); g.globalAlpha=0.28; const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,s.a); tg.addColorStop(0.5,s.b); tg.addColorStop(1,s.c);
          g.fillStyle=tg; g.fillRect(0,0,api.W,api.H); g.restore(); }
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,s.a); grd.addColorStop(0.45,s.b); grd.addColorStop(0.7,s.c);
        grd.addColorStop(0.86,"#eaf6ff"); grd.addColorStop(1,"#cfe7f5");
        g.fillStyle=grd; g.fillRect(0,0,api.W,api.H);
      }
      // soft sun/halo (画像時は控えめに)
      const sunx=api.W*0.74,suny=api.H*0.14;
      let sun=g.createRadialGradient(sunx,suny,0,sunx,suny,Math.max(0,api.W*(imgBg?0.3:0.4)));
      sun.addColorStop(0,imgBg?"rgba(255,255,245,.3)":"rgba(255,255,245,.5)"); sun.addColorStop(1,"rgba(255,255,245,0)");
      g.fillStyle=sun; g.fillRect(0,0,api.W,api.H);
      // small sun disk (④ タップできる ひみつ)
      g.save(); g.shadowColor="rgba(255,245,200,.9)"; g.shadowBlur=24;
      g.fillStyle="rgba(255,252,225,.92)"; g.beginPath(); g.arc(sunx,suny,api.W*0.045,0,TAU); g.fill(); g.restore();
      // ④ 太陽ひみつタップ: 叩かれた瞬間だけ ^_^ のウインク顔(発見のごほうび)
      if(sunWink>0){ sunWink-=0.018*dt; const sr=api.W*0.045;
        g.save(); g.strokeStyle="#d09020"; g.lineWidth=Math.max(2,sr*0.13); g.lineCap="round"; g.globalAlpha=clamp(sunWink*1.4,0,1);
        g.beginPath();
        g.moveTo(sunx-sr*0.44,suny-sr*0.02); g.quadraticCurveTo(sunx-sr*0.29,suny-sr*0.3,sunx-sr*0.14,suny-sr*0.02);
        g.moveTo(sunx+sr*0.14,suny-sr*0.02); g.quadraticCurveTo(sunx+sr*0.29,suny-sr*0.3,sunx+sr*0.44,suny-sr*0.02);
        g.stroke();
        g.beginPath(); g.arc(sunx,suny+sr*0.14,sr*0.34,0.12*Math.PI,0.88*Math.PI); g.stroke();
        g.restore(); g.globalAlpha=1; if(sunWink<0)sunWink=0; }
      // distant snowy hills ※画像背景のときは絵の山を活かして描かない
      if(!imgBg){
        g.fillStyle="rgba(255,255,255,.55)";
        g.beginPath(); g.moveTo(0,api.H*0.5);
        for(let x=0;x<=api.W;x+=30) g.lineTo(x,api.H*0.46+Math.sin(x*0.006+1)*api.H*0.03);
        g.lineTo(api.W,groundY); g.lineTo(0,groundY); g.closePath(); g.fill();
        g.fillStyle="rgba(235,246,255,.8)";
        g.beginPath(); g.moveTo(0,api.H*0.56);
        for(let x=0;x<=api.W;x+=24) g.lineTo(x,api.H*0.54+Math.sin(x*0.009+3)*api.H*0.025);
        g.lineTo(api.W,groundY); g.lineTo(0,groundY); g.closePath(); g.fill();
      }
      // floating glow motes (additive)
      g.save(); g.globalCompositeOperation="lighter";
      for(const m of motes){ m.ph+=m.sp*dt; const mx=m.x+Math.sin(m.ph)*m.amp, my=m.y+Math.cos(m.ph*0.7)*m.amp*0.4;
        const og=g.createRadialGradient(mx,my,0,mx,my,m.r*4);
        og.addColorStop(0,m.col); og.addColorStop(1,"rgba(255,255,255,0)");
        g.globalAlpha=0.4+0.3*Math.sin(m.ph*2); g.fillStyle=og;
        g.beginPath(); g.arc(mx,my,m.r*4,0,TAU); g.fill(); }
      g.restore(); g.globalAlpha=1;

      // ---------- ice lane ----------
      const ltop=api.H*0.24, lbot=groundY;
      const ltopW=(laneX1-laneX0)*0.45, midX=api.W*0.5;
      // レーン(ゲーム要素: 壁の位置が分かるように残す)。画像時は絵の氷を透かす半透明にする
      let lg=g.createLinearGradient(0,ltop,0,lbot);
      lg.addColorStop(0,"#bfe9f5"); lg.addColorStop(0.5,"#d8f3ff"); lg.addColorStop(1,"#a7d8ee");
      g.fillStyle=lg;
      if(imgBg) g.globalAlpha=0.3;
      g.beginPath();
      g.moveTo(midX-ltopW/2,ltop); g.lineTo(midX+ltopW/2,ltop);
      g.lineTo(laneX1,lbot); g.lineTo(laneX0,lbot); g.closePath(); g.fill();
      g.globalAlpha=1;
      // lane edge highlights
      g.strokeStyle="rgba(255,255,255,.7)"; g.lineWidth=3;
      g.beginPath(); g.moveTo(midX-ltopW/2,ltop); g.lineTo(laneX0,lbot); g.stroke();
      g.beginPath(); g.moveTo(midX+ltopW/2,ltop); g.lineTo(laneX1,lbot); g.stroke();
      // sheen streaks on ice
      g.save();
      g.beginPath();
      g.moveTo(midX-ltopW/2,ltop); g.lineTo(midX+ltopW/2,ltop);
      g.lineTo(laneX1,lbot); g.lineTo(laneX0,lbot); g.closePath(); g.clip();
      g.globalAlpha=0.25; g.strokeStyle="#ffffff"; g.lineWidth=6;
      for(let i=0;i<4;i++){ const t=(tsec*0.2+i*0.27)%1; const yy=lerp(ltop,lbot,t);
        g.beginPath(); g.moveTo(0,yy); g.lineTo(api.W,yy+20); g.stroke(); }
      g.restore(); g.globalAlpha=1;
      // snowy ground at the bottom ※画像背景のときは絵の雪原を活かし、地面線だけ薄く残す
      if(!imgBg){
        g.fillStyle="#eef8ff"; g.fillRect(0,groundY,api.W,api.H-groundY);
        g.fillStyle="rgba(180,215,235,.5)"; g.fillRect(0,groundY,api.W,4);
      } else {
        g.fillStyle="rgba(255,255,255,.35)"; g.fillRect(0,groundY,api.W,3);
      }

      // ---------- pins ----------
      const downAll=standing()===0;
      for(const p of pins){
        if(p.down){
          if(p.kind==='ball'){
            // ③ 雪玉は重力を受けず、地面すれすれを転がって画面外へ抜けていく
            p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt; p.vx*=0.995; p.vy*=0.9;
            p.fall=Math.min(1,p.fall+0.08*dt);
            const groundLine=groundY-pinR*0.7;
            if(p.y>groundLine){ p.y=groundLine; p.vy=0; }
          } else {
            p.vy+=0.5*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt; p.vx*=0.96;
            p.fall=Math.min(1,p.fall+0.08*dt);
            if(p.y>groundY-pinR){ p.y=groundY-pinR; p.vy*=-0.3; p.vx*=0.8; if(Math.abs(p.vy)<1)p.vy=0; }
          }
        } else {
          p.wob+=0.05*dt; p.x=p.hx+Math.sin(p.wob)*0.6;
        }
        drawPin(p);
      }
      // pin re-rack handling after settle
      if(settleT>0){ settleT-=0.016*dt; if(settleT<=0){ setupRack(); positionRack(); resetThrow(); } }

      // ---------- penguin physics ----------
      if(peng.sliding){
        peng.x+=peng.vx*dt; peng.y+=peng.vy*dt;
        peng.vx*=0.992; peng.vy*=0.992;   // ice friction (slight)
        peng.roll+=0.2*dt;
        peng.sq=1+Math.sin(peng.roll*2)*0.04;
        // perspective shrink as it goes up the lane is faked via collision only
        // collide with standing pins
        for(const p of pins){ if(p.down) continue;
          if(Math.hypot(p.x-peng.x,p.y-peng.y)<penR*0.7+pinR){
            const dirx=(p.x-peng.x)>=0?1:-1;
            knockPin(p,dirx,Math.max(3,Math.abs(peng.vx)*0.5+4));
            // small chain shove to neighbors
            for(const q of pins){ if(q.down||q===p) continue;
              if(Math.hypot(q.x-p.x,q.y-p.y)<pinR*3.2){
                knockPin(q,(q.x-p.x)>=0?1:-1,3); } }
          }
        }
        // wall bounce inside lane
        if(peng.x<laneX0+penR){ peng.x=laneX0+penR; peng.vx=Math.abs(peng.vx)*0.6; api.tone(200,0.06,"sine",0.08); }
        if(peng.x>laneX1-penR){ peng.x=laneX1-penR; peng.vx=-Math.abs(peng.vx)*0.6; api.tone(200,0.06,"sine",0.08); }
        // ice trail puffs
        if(tsec*60%3<dt && puffs.length<40) puffs.push({x:peng.x+rnd(-6,6),y:peng.y+penR*0.6,r:rnd(penR*0.2,penR*0.4),vr:0.6,life:0.7,decay:0.04});
        // fever: rainbow spark trail behind the sliding penguin
        if(fever>0 && sparks.length<60){ const a=rnd(0,TAU);
          sparks.push({x:peng.x+rnd(-8,8),y:peng.y+rnd(-6,10),vx:Math.cos(a)*1.5,vy:Math.sin(a)*1.5+1,
            len:rnd(6,12),life:1,decay:rnd(0.05,0.08)}); }
        // stop conditions: too slow, or reached top, or off bottom
        const slow=Math.hypot(peng.vx,peng.vy)<0.8;
        if(slow || peng.y<api.H*0.18){ peng.sliding=false; endThrow(); }
      }
      // aim guide line while charging
      if(aim.active && !peng.sliding){
        let dx=aim.x-peng.x, dy=aim.y-peng.y, d=Math.hypot(dx,dy)||1;
        let nx=dx/d, ny=dy/d; if(ny>-0.25) ny=-0.25; const re=Math.hypot(nx,ny)||1; nx/=re; ny/=re;
        const len=clamp(d,30,api.H*0.4);
        g.save(); g.globalAlpha=0.6; g.strokeStyle="#ffffff"; g.lineWidth=4; g.setLineDash([10,10]);
        g.beginPath(); g.moveTo(peng.x,peng.y);
        g.lineTo(peng.x+nx*len,peng.y+ny*len); g.stroke();
        g.setLineDash([]);
        // arrow head
        g.fillStyle="#ffd23f"; const ax=peng.x+nx*len, ay=peng.y+ny*len, pa=Math.atan2(ny,nx);
        g.beginPath(); g.moveTo(ax+Math.cos(pa)*12,ay+Math.sin(pa)*12);
        g.lineTo(ax+Math.cos(pa+2.5)*10,ay+Math.sin(pa+2.5)*10);
        g.lineTo(ax+Math.cos(pa-2.5)*10,ay+Math.sin(pa-2.5)*10); g.closePath(); g.fill();
        g.restore(); g.globalAlpha=1;
      }
      drawPenguin(peng.x,peng.y,peng.sliding,peng.sq);

      // ---------- particles ----------
      // shockwave rings
      for(const ri of rings){ ri.r+=ri.vr*dt; ri.life-=ri.decay*dt;
        g.save(); g.globalAlpha=Math.max(0,ri.life)*0.7; g.strokeStyle=ri.col;
        g.lineWidth=2+ri.life*3; g.beginPath(); g.arc(ri.x,ri.y,ri.r,0,TAU); g.stroke(); g.restore(); }
      rings=rings.filter(ri=>ri.life>0);
      // puffs (snow dust)
      for(const pf of puffs){ pf.r+=pf.vr*dt; pf.life-=pf.decay*dt;
        g.globalAlpha=Math.max(0,pf.life)*0.6; g.fillStyle="#ffffff";
        g.beginPath(); g.arc(pf.x,pf.y,pf.r,0,TAU); g.fill(); }
      g.globalAlpha=1; puffs=puffs.filter(pf=>pf.life>0);
      // sparks
      g.save(); g.globalCompositeOperation="lighter"; g.lineCap="round";
      for(const sp of sparks){ sp.x+=sp.vx*dt; sp.y+=sp.vy*dt; sp.vx*=0.9; sp.vy*=0.9; sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life); g.strokeStyle="#fff7c2"; g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath(); g.moveTo(sp.x,sp.y); g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len); g.stroke(); }
      g.restore(); g.globalAlpha=1;
      sparks=sparks.filter(sp=>sp.life>0);
      // shards (ice chips)
      for(const sh of shards){ sh.vy+=0.3*dt; sh.x+=sh.vx*dt; sh.y+=sh.vy*dt; sh.rot+=sh.vr*dt; sh.life-=sh.decay*dt;
        g.save(); g.globalAlpha=Math.max(0,sh.life); g.translate(sh.x,sh.y); g.rotate(sh.rot);
        g.fillStyle=sh.col; g.shadowColor=sh.col; g.shadowBlur=6;
        g.beginPath(); g.moveTo(0,-sh.s); g.lineTo(sh.s*0.7,0); g.lineTo(0,sh.s); g.lineTo(-sh.s*0.7,0); g.closePath(); g.fill();
        g.restore(); }
      g.shadowBlur=0; g.globalAlpha=1; shards=shards.filter(sh=>sh.life>0);
      // ② ④ 小さな星のキラッ(加算・すぐ消える)
      if(twinkles.length){ g.save(); g.globalCompositeOperation="lighter";
        for(const w of twinkles){ w.y-=0.4*dt; w.life-=(w.decay||0.02)*dt;
          const a=Math.max(0,w.life), rr2=w.r*(0.5+a*0.6);
          g.save(); g.globalAlpha=a; g.fillStyle=w.col; g.translate(w.x,w.y);
          g.beginPath();
          g.moveTo(0,-rr2); g.lineTo(rr2*0.28,-rr2*0.28); g.lineTo(rr2,0); g.lineTo(rr2*0.28,rr2*0.28);
          g.lineTo(0,rr2); g.lineTo(-rr2*0.28,rr2*0.28); g.lineTo(-rr2,0); g.lineTo(-rr2*0.28,-rr2*0.28);
          g.closePath(); g.fill(); g.restore(); }
        g.restore(); g.globalCompositeOperation="source-over"; g.globalAlpha=1; }
      twinkles=twinkles.filter(w=>w.life>0);

      // ---------- falling snow (foreground) ----------
      g.fillStyle="#ffffff";
      for(const f of snow){ f.ph+=f.sw*dt; f.x+=(f.drift+Math.sin(f.ph)*0.5)*dt; f.y+=f.sp*dt;
        if(f.y>api.H){ f.y=-4; f.x=rnd(0,api.W); }
        if(f.x<0)f.x=api.W; if(f.x>api.W)f.x=0;
        g.globalAlpha=0.5+0.4*Math.sin(f.ph); g.beginPath(); g.arc(f.x,f.y,f.r,0,TAU); g.fill(); }
      g.globalAlpha=1;

      // ---------- fever rainbow wash (over the scene, under HUD) ----------
      if(fever>0){
        const hue=(tsec*130)%360;
        g.save(); g.globalCompositeOperation="lighter";
        g.globalAlpha=0.12+0.05*Math.sin(tsec*6);
        g.fillStyle="hsl("+hue+",90%,60%)"; g.fillRect(0,0,api.W,api.H);
        // spinning celebration rays from mid-lane
        g.translate(api.W/2,api.H*0.35); g.rotate(tsec*0.5);
        for(let i=0;i<8;i++){ g.rotate(TAU/8);
          g.globalAlpha=0.06+0.04*Math.sin(tsec*4+i);
          g.fillStyle=RAINBOW[i%RAINBOW.length];
          g.beginPath(); g.moveTo(0,0); g.lineTo(api.W*0.8,-14); g.lineTo(api.W*0.8,14); g.closePath(); g.fill(); }
        g.restore(); g.globalAlpha=1;
      }
      // ---------- floating bonus texts ----------
      for(const f of floats){ f.y+=f.vy*dt; f.life-=0.02*dt;
        g.save(); g.globalAlpha=clamp(f.life,0,1); g.textAlign="center";
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=5; g.strokeStyle="rgba(0,40,80,.6)"; g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col; g.fillText(f.txt,f.x,f.y);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; }
      floats=floats.filter(f=>f.life>0);
      // ---------- combo + flash + HUD ----------
      if(combo>0){ comboT-=0.016*dt; if(comboT<=0)combo=0; }
      if(flash>0){ flash-=0.05*dt;
        g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=Math.max(0,flash)*0.3;
        g.fillStyle="#ffffff"; g.fillRect(0,0,api.W,api.H); g.restore(); g.globalAlpha=1; }
      g.globalCompositeOperation="source-over";   // 加算合成を確実に戻す(白飛び/漏れ防止)
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.6)*1.2;
        g.save(); g.translate(api.W/2,api.H*0.15); g.scale(pop,pop);
        g.font="800 30px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1); g.shadowColor="rgba(60,160,220,.8)"; g.shadowBlur=14;
        g.fillStyle="#ffd23f"; g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(255,255,255,.6)"; g.strokeText("コンボ x"+combo,0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
      }
      drawHUD();
      // strike banner
      if(strikeT>0){ strikeT-=0.016*dt;
        const a=clamp(strikeT*1.4,0,1), pop=1+Math.max(0,strikeT-1.4)*2;
        g.save(); g.translate(api.W/2,api.H*0.42); g.scale(pop,pop); g.globalAlpha=a; g.textAlign="center";
        g.font="900 50px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(80,180,240,.9)"; g.shadowBlur=22; g.fillStyle="#ffd23f";
        g.fillText(strikeTxt,0,0);
        g.shadowBlur=0; g.lineWidth=2.5; g.strokeStyle="#fff"; g.strokeText(strikeTxt,0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
      }
      // stage clear banner
      if(clearT>0){ clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1), pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save(); g.globalAlpha=a*0.45; g.fillStyle="#0a2a44"; g.fillRect(0,api.H*0.34,api.W,api.H*0.2); g.restore();
        g.save(); g.translate(api.W/2,api.H*0.45); g.scale(pop,pop); g.globalAlpha=a; g.textAlign="center";
        g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(80,180,240,.9)"; g.shadowBlur=20; g.fillStyle="#9be8ff";
        g.fillText("ステージ"+clearStage+" クリア！",0,0);
        g.shadowBlur=0; g.lineWidth=2; g.strokeStyle="#fff"; g.strokeText("ステージ"+clearStage+" クリア！",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#fff";
        g.fillText("つぎは ステージ"+(clearStage+1)+"！",0,40);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
      }
      // ① にじいろピン！ 発見バナー(虹色に色替わり)
      if(rbMsgT>0){ rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3, col=RAINBOW[Math.floor(tsec*7)%RAINBOW.length];
        g.save(); g.translate(api.W/2,api.H*0.20); g.scale(pop,pop); g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1); g.font="900 36px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col; g.shadowBlur=18; g.fillStyle="#ffffff"; g.fillText("にじいろピン！",0,0);
        g.shadowBlur=0; g.lineWidth=2; g.strokeStyle=col; g.strokeText("にじいろピン！",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(rbMsgT<0)rbMsgT=0; }
      // ② きょうのラッキー色 の紹介(最初に一度だけ、中央上に)
      if(luckyMsgT>0){ luckyMsgT-=0.016*dt;
        g.save(); g.translate(api.W/2,api.H*0.24); g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1); g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうの ラッキーは "+(BANDNAME[luckyBand]||"")+"の しま！";
        g.lineWidth=5; g.strokeStyle="rgba(0,40,80,.5)"; g.strokeText(t2,0,0);
        g.fillStyle=luckyBand; g.fillText(t2,0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(luckyMsgT<0)luckyMsgT=0; }
      // ③ ノーミス ボーナス！ バナー(クリア文字と重ねない下側)
      if(noMissT>0){ noMissT-=0.014*dt;
        const pop=1+Math.max(0,noMissT-1.3)*1.4;
        g.save(); g.translate(api.W/2,api.H*0.60); g.scale(pop,pop); g.textAlign="center";
        g.globalAlpha=clamp(noMissT*1.3,0,1); g.font="900 28px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)"; g.shadowBlur=16; g.fillStyle="#c7ffcf"; g.fillText("ノーミス ボーナス！",0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(40,120,60,.7)"; g.strokeText("ノーミス ボーナス！",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(noMissT<0)noMissT=0; }
    },
    stop(){}
  };

  // ---------- drawing helpers ----------
  function drawHUD(){
    const left=clamp(stageGoal-stageDown,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=14,bx=(api.W-bw)/2,by=api.H*0.05;
    g.save(); g.textAlign="center";
    g.font="800 17px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff"; g.shadowColor="rgba(0,40,80,.5)"; g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" ぼん",api.W/2,by-7);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,40,80,.3)"; rr(bx,by,bw,bh,bh/2); g.fill();
    const fr=clamp(stageDown/stageGoal,0,1);
    if(fr>0){ const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#9be8ff"); gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg; rr(bx,by,Math.max(bh,bw*fr),bh,bh/2); g.fill(); }
    g.strokeStyle="rgba(255,255,255,.6)"; g.lineWidth=2; rr(bx,by,bw,bh,bh/2); g.stroke();
    g.restore(); g.textAlign="left";
  }
  function drawPin(p){
    const r=pinR;
    const bigScale=p.kind==='big'?1.4:1;   // ③ ボスピンは一回り大きく描く(見た目のバラエティ)
    g.save(); g.translate(p.x,p.y);
    if(p.down) g.rotate(p.rot);
    // shadow under standing pin(ボスピンは影も一回り大きく)
    if(!p.down){ g.fillStyle="rgba(0,40,80,.18)"; g.beginPath();
      g.ellipse(0,r*0.9*bigScale,Math.max(0,r*0.9*bigScale),Math.max(0,r*0.3*bigScale),0,0,TAU); g.fill(); }
    // ③ 丸い雪玉ピン: ボウリングピンとは別シルエット(円)で描き、四角/同一形状の繰り返しを崩す
    if(p.kind==='ball'){
      drawSnowballPin(p,r);
      g.restore(); return;
    }
    // ③ 氷ブロック: 角ばった四角のシルエット(ピン/丸とは別の3つ目の形)
    if(p.kind==='block'){
      drawBlockPin(p,r);
      g.restore(); return;
    }
    // ③ ボスピン: 拡大コピーではなく雪だるま風の別シルエットにして『別の大きい物』と分かるようにする
    if(p.kind==='big'){
      drawBossPin(p,r);
      g.restore(); return;
    }
    // ① にじいろピンは 虹のオーラで光って自己主張(ドキドキの発見ビーコン)
    if(p.rainbow && !p.down){
      g.save(); g.globalCompositeOperation="lighter";
      const pr=r*(2.0+Math.sin(tsec*5)*0.35);
      const ag=g.createRadialGradient(0,-r*0.2,0,0,-r*0.2,pr);
      ag.addColorStop(0,"rgba(255,180,240,.5)"); ag.addColorStop(0.5,"rgba(120,200,255,.18)"); ag.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=ag; g.beginPath(); g.arc(0,-r*0.2,pr,0,TAU); g.fill();
      g.restore(); g.globalCompositeOperation="source-over";
    }
    // 画像ゴールドピン: 金色の単体スプライト(ふつうのピンは帯色=ラッキー色の仕掛けがあるので手描きのまま)
    if(p.gold && !p.rainbow){
      const gp=0.5+0.5*Math.sin(tsec*5);
      if(!p.down){ g.save(); g.globalCompositeOperation="lighter";
        const ag=g.createRadialGradient(0,-r*0.2,0,0,-r*0.2,Math.max(0,r*1.7));
        ag.addColorStop(0,"rgba(255,240,150,"+(0.45*gp)+")"); ag.addColorStop(1,"rgba(255,240,150,0)");
        g.fillStyle=ag; g.beginPath(); g.arc(0,-r*0.2,Math.max(0,r*1.7),0,TAU); g.fill();
        g.restore(); g.globalCompositeOperation="source-over"; }
      // 一覧表の実測: 透過PNG内でピンは 幅209/高505(512角)。高さ2.8r・中心-0.3r → 上-1.7r〜下+1.1r(手描きピンと同じ足元・影の上)
      if(api.drawAsset("goldpin.png",0,-r*0.3,r*2.8,r*2.8,{center:true})){
        // きらっと星(立っている間だけ)
        if(!p.down){ g.save(); g.globalCompositeOperation="lighter"; g.translate(r*0.55,-r*1.25);
          g.globalAlpha=0.5+0.5*gp; g.fillStyle="#fff7c2"; const sr=Math.max(0,r*0.28*gp);
          g.beginPath(); g.moveTo(0,-sr); g.lineTo(sr*0.3,-sr*0.3); g.lineTo(sr,0); g.lineTo(sr*0.3,sr*0.3);
          g.lineTo(0,sr); g.lineTo(-sr*0.3,sr*0.3); g.lineTo(-sr,0); g.lineTo(-sr*0.3,-sr*0.3); g.closePath(); g.fill();
          g.restore(); g.globalCompositeOperation="source-over"; g.globalAlpha=1; }
        g.restore(); return;
      }
    }
    // bowling-pin body: bulb bottom, narrow neck, small head (にじいろピンは体色が虹色を巡回)
    const bodyCol=p.rainbow?RAINBOW[Math.floor(tsec*6)%RAINBOW.length]:p.col;
    const grd=g.createLinearGradient(-r*0.6,0,r*0.6,0);
    grd.addColorStop(0,bodyCol); grd.addColorStop(0.4,"#ffffff"); grd.addColorStop(1,bodyCol);
    g.fillStyle=grd;
    g.beginPath();
    g.moveTo(0,-r*1.4);
    g.bezierCurveTo(r*0.5,-r*1.3, r*0.42,-r*0.6, r*0.28,-r*0.4);
    g.bezierCurveTo(r*0.15,-r*0.25, r*0.7,r*0.2, r*0.6,r*0.7);
    g.bezierCurveTo(r*0.45,r*1.1, -r*0.45,r*1.1, -r*0.6,r*0.7);
    g.bezierCurveTo(-r*0.7,r*0.2, -r*0.15,-r*0.25, -r*0.28,-r*0.4);
    g.bezierCurveTo(-r*0.42,-r*0.6, -r*0.5,-r*1.3, 0,-r*1.4);
    g.closePath(); g.fill();
    // colored stripes (帯の色 = ② きょうのラッキー色さがしのヒント)
    g.save(); g.globalAlpha=0.78; g.fillStyle=(p.rainbow?"rgba(255,255,255,.5)":(p.band||"#50aadc"));
    g.fillRect(-r*0.5,-r*0.75,r*1.0,r*0.16);
    g.fillRect(-r*0.55,-r*0.5,r*1.1,r*0.13);
    g.restore(); g.globalAlpha=1;
    // glossy highlight
    g.fillStyle="rgba(255,255,255,.6)";
    g.beginPath(); g.ellipse(-r*0.22,r*0.2,r*0.16,r*0.5,-0.2,0,TAU); g.fill();
    // cute face on standing pins
    if(!p.down){
      g.fillStyle="#2b3a4a";
      g.beginPath(); g.arc(-r*0.18,r*0.25,r*0.1,0,TAU); g.arc(r*0.18,r*0.25,r*0.1,0,TAU); g.fill();
      g.fillStyle="rgba(255,150,150,.5)";
      g.beginPath(); g.arc(-r*0.32,r*0.45,r*0.1,0,TAU); g.arc(r*0.32,r*0.45,r*0.1,0,TAU); g.fill();
      g.strokeStyle="#2b3a4a"; g.lineWidth=r*0.08; g.lineCap="round";
      g.beginPath(); g.arc(0,r*0.45,r*0.18,0.15*Math.PI,0.85*Math.PI); g.stroke();
    }
    g.restore();
  }
  // ③ 丸い雪玉ピン: ボウリングピン形とは違う円のシルエット(kind==='ball')
  function drawSnowballPin(p,r){
    const rr2=Math.max(0,r*0.85);
    const grd=g.createRadialGradient(-rr2*0.3,-rr2*0.3,Math.max(0,rr2*0.1),0,0,Math.max(0,rr2*1.05));
    grd.addColorStop(0,"#ffffff"); grd.addColorStop(0.65,p.col||"#eaf7ff"); grd.addColorStop(1,"#cfeeff");
    g.fillStyle=grd;
    g.beginPath(); g.arc(0,0,rr2,0,TAU); g.fill();
    // 帯の色をリング状に残す(② きょうのラッキー色さがしのヒントは丸にも残す)
    g.save(); g.globalAlpha=0.7; g.strokeStyle=p.band||"#50aadc"; g.lineWidth=Math.max(1,rr2*0.16);
    g.beginPath(); g.arc(0,rr2*0.08,Math.max(0,rr2*0.7),0.15*Math.PI,0.85*Math.PI); g.stroke();
    g.restore(); g.globalAlpha=1;
    // glossy highlight
    g.fillStyle="rgba(255,255,255,.7)";
    g.beginPath(); g.ellipse(-rr2*0.3,-rr2*0.28,Math.max(0,rr2*0.22),Math.max(0,rr2*0.14),-0.3,0,TAU); g.fill();
    // cute face on standing snowballs
    if(!p.down){
      g.fillStyle="#2b3a4a";
      g.beginPath(); g.arc(-rr2*0.22,rr2*0.05,Math.max(0,rr2*0.1),0,TAU); g.arc(rr2*0.22,rr2*0.05,Math.max(0,rr2*0.1),0,TAU); g.fill();
      g.fillStyle="rgba(255,150,150,.5)";
      g.beginPath(); g.arc(-rr2*0.36,rr2*0.28,Math.max(0,rr2*0.1),0,TAU); g.arc(rr2*0.36,rr2*0.28,Math.max(0,rr2*0.1),0,TAU); g.fill();
    }
  }
  // ③ 氷ブロック(kind==='block'): 角ばった四角のシルエット。丸(雪玉)・ピン形とは別の3つ目の形で、
  // ラック内に常時「丸・ピン・角ブロック」の3形状が混ざるようにする(軸7対策)
  function drawBlockPin(p,r){
    const w=Math.max(0,r*1.15), h=Math.max(0,r*1.55), rad=Math.max(0,w*0.16);
    const grd=g.createLinearGradient(-w*0.5,0,w*0.5,0);
    grd.addColorStop(0,p.col||"#eaf7ff"); grd.addColorStop(0.5,"#ffffff"); grd.addColorStop(1,p.col||"#eaf7ff");
    g.fillStyle=grd;
    g.beginPath();
    g.moveTo(-w*0.5+rad,-h*0.5);
    g.lineTo(w*0.5-rad,-h*0.5); g.arcTo(w*0.5,-h*0.5,w*0.5,-h*0.5+rad,rad);
    g.lineTo(w*0.5,h*0.5-rad); g.arcTo(w*0.5,h*0.5,w*0.5-rad,h*0.5,rad);
    g.lineTo(-w*0.5+rad,h*0.5); g.arcTo(-w*0.5,h*0.5,-w*0.5,h*0.5-rad,rad);
    g.lineTo(-w*0.5,-h*0.5+rad); g.arcTo(-w*0.5,-h*0.5,-w*0.5+rad,-h*0.5,rad);
    g.closePath(); g.fill();
    // 帯の色(② きょうのラッキー色さがしのヒントはブロックにも残す)
    g.save(); g.globalAlpha=0.75; g.fillStyle=p.band||"#50aadc";
    g.fillRect(-w*0.5,-h*0.1,w,h*0.18);
    g.restore(); g.globalAlpha=1;
    // glossy highlight
    g.fillStyle="rgba(255,255,255,.6)";
    g.beginPath(); g.ellipse(-w*0.22,-h*0.16,Math.max(0,w*0.16),Math.max(0,h*0.26),-0.15,0,TAU); g.fill();
    // cute face on standing blocks
    if(!p.down){
      g.fillStyle="#2b3a4a";
      g.beginPath(); g.arc(-w*0.2,h*0.08,Math.max(0,r*0.1),0,TAU); g.arc(w*0.2,h*0.08,Math.max(0,r*0.1),0,TAU); g.fill();
      g.fillStyle="rgba(255,150,150,.5)";
      g.beginPath(); g.arc(-w*0.3,h*0.26,Math.max(0,r*0.1),0,TAU); g.arc(w*0.3,h*0.26,Math.max(0,r*0.1),0,TAU); g.fill();
      g.strokeStyle="#2b3a4a"; g.lineWidth=Math.max(1,r*0.08); g.lineCap="round";
      g.beginPath(); g.arc(0,h*0.26,Math.max(0,r*0.16),0.15*Math.PI,0.85*Math.PI); g.stroke();
    }
  }
  // ③ ボスピン(kind==='big'): 同じ絵の拡大コピーではなく、雪玉を2段重ねた雪だるま風の別シルエットにして
  // 『別の大きい物』と一目で分かるようにする(軸7対策)
  function drawBossPin(p,r){
    const bodyR=Math.max(0,r*0.62*1.4), headR=Math.max(0,r*0.44*1.4);
    const bodyY=r*0.5, headY=-r*0.55;
    // 下段の大きな玉
    const bg=g.createRadialGradient(-bodyR*0.3,bodyY-bodyR*0.3,Math.max(0,bodyR*0.1),0,bodyY,Math.max(0,bodyR*1.05));
    bg.addColorStop(0,"#ffffff"); bg.addColorStop(0.65,p.col||"#eaf7ff"); bg.addColorStop(1,"#cfeeff");
    g.fillStyle=bg; g.beginPath(); g.arc(0,bodyY,bodyR,0,TAU); g.fill();
    // 帯の色(頭上のボス感を邪魔しない位置)
    g.save(); g.globalAlpha=0.7; g.strokeStyle=p.band||"#50aadc"; g.lineWidth=Math.max(1,bodyR*0.14);
    g.beginPath(); g.arc(0,bodyY+bodyR*0.1,Math.max(0,bodyR*0.72),0.15*Math.PI,0.85*Math.PI); g.stroke();
    g.restore(); g.globalAlpha=1;
    // 上段(頭)の玉
    const hg=g.createRadialGradient(-headR*0.3,headY-headR*0.3,Math.max(0,headR*0.1),0,headY,Math.max(0,headR*1.05));
    hg.addColorStop(0,"#ffffff"); hg.addColorStop(0.65,p.col||"#eaf7ff"); hg.addColorStop(1,"#cfeeff");
    g.fillStyle=hg; g.beginPath(); g.arc(0,headY,headR,0,TAU); g.fill();
    // glossy highlight
    g.fillStyle="rgba(255,255,255,.7)";
    g.beginPath(); g.ellipse(-bodyR*0.3,bodyY-bodyR*0.28,Math.max(0,bodyR*0.22),Math.max(0,bodyR*0.14),-0.3,0,TAU); g.fill();
    if(!p.down){
      // ボスの目印: 小さな三角の旗
      g.fillStyle="#ff5b5b";
      g.beginPath(); g.moveTo(0,headY-headR*0.95); g.lineTo(headR*0.4,headY-headR*1.35); g.lineTo(-headR*0.05,headY-headR*1.35); g.closePath(); g.fill();
      // cute face
      g.fillStyle="#2b3a4a";
      g.beginPath(); g.arc(-headR*0.28,headY+headR*0.08,Math.max(0,headR*0.12),0,TAU); g.arc(headR*0.28,headY+headR*0.08,Math.max(0,headR*0.12),0,TAU); g.fill();
      g.fillStyle="rgba(255,150,150,.5)";
      g.beginPath(); g.arc(-headR*0.4,headY+headR*0.32,Math.max(0,headR*0.11),0,TAU); g.arc(headR*0.4,headY+headR*0.32,Math.max(0,headR*0.11),0,TAU); g.fill();
      g.strokeStyle="#2b3a4a"; g.lineWidth=Math.max(1,headR*0.09); g.lineCap="round";
      g.beginPath(); g.arc(0,headY+headR*0.34,Math.max(0,headR*0.22),0.15*Math.PI,0.85*Math.PI); g.stroke();
    }
  }
  function drawPenguin(x,y,sliding,sq){
    const r=penR;
    g.save(); g.translate(x,y);
    // shadow
    g.fillStyle="rgba(0,40,80,.2)"; g.beginPath();
    g.ellipse(0,r*0.95,r*0.9,r*0.28,0,0,TAU); g.fill();
    g.scale(1,sq||1);
    // 画像ペンギン: 正面向きの単体スプライト。滑走中は少し左右に揺れて「滑ってる」感を出す
    // 一覧表の実測: 透過PNG内でペンギンは 幅490/高505(512角)=ほぼ全面。2.2r角・中心-0.1r → 足元+1.0r(影の楕円 0.95r に乗る)、幅±1.05r
    if(api.drawAsset("penguin.png",0,-r*0.1,r*2.2,r*2.2,{center:true,rot:sliding?Math.sin(peng.roll)*0.12:0})){
      g.restore(); return;
    }
    // body (dark blue-black)
    const bg=g.createRadialGradient(-r*0.25,-r*0.35,r*0.1,0,0,r*1.2);
    bg.addColorStop(0,"#3a4a66"); bg.addColorStop(0.6,"#1f2940"); bg.addColorStop(1,"#141b2e");
    g.fillStyle=bg;
    g.beginPath(); g.ellipse(0,0,r*0.82,r*0.95,0,0,TAU); g.fill();
    // white belly
    g.fillStyle="#f4fbff";
    g.beginPath(); g.ellipse(0,r*0.12,r*0.52,r*0.72,0,0,TAU); g.fill();
    // wings (flap a little when sliding)
    const flap=sliding?Math.sin(peng.roll)*0.3:0.1;
    g.fillStyle="#1b2438";
    g.save(); g.translate(-r*0.7,-r*0.05); g.rotate(-0.5-flap);
    g.beginPath(); g.ellipse(0,0,r*0.22,r*0.5,0,0,TAU); g.fill(); g.restore();
    g.save(); g.translate(r*0.7,-r*0.05); g.rotate(0.5+flap);
    g.beginPath(); g.ellipse(0,0,r*0.22,r*0.5,0,0,TAU); g.fill(); g.restore();
    // feet
    g.fillStyle="#ff9a3a";
    g.beginPath(); g.ellipse(-r*0.28,r*0.85,r*0.22,r*0.12,0.2,0,TAU); g.fill();
    g.beginPath(); g.ellipse(r*0.28,r*0.85,r*0.22,r*0.12,-0.2,0,TAU); g.fill();
    // eyes
    g.fillStyle="#fff"; g.beginPath();
    g.arc(-r*0.2,-r*0.3,r*0.16,0,TAU); g.arc(r*0.2,-r*0.3,r*0.16,0,TAU); g.fill();
    g.fillStyle="#1a2238"; g.beginPath();
    g.arc(-r*0.17,-r*0.28,r*0.08,0,TAU); g.arc(r*0.23,-r*0.28,r*0.08,0,TAU); g.fill();
    g.fillStyle="rgba(255,255,255,.9)"; g.beginPath();
    g.arc(-r*0.2,-r*0.32,r*0.03,0,TAU); g.arc(r*0.2,-r*0.32,r*0.03,0,TAU); g.fill();
    // beak
    g.fillStyle="#ff9a3a";
    g.beginPath(); g.moveTo(-r*0.12,-r*0.05); g.lineTo(r*0.12,-r*0.05); g.lineTo(0,r*0.12); g.closePath(); g.fill();
    // cheeks
    g.fillStyle="rgba(255,150,150,.4)";
    g.beginPath(); g.arc(-r*0.42,-r*0.05,r*0.12,0,TAU); g.arc(r*0.42,-r*0.05,r*0.12,0,TAU); g.fill();
    g.restore();
  }
  function rr(x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
}
Engine.register("penguin", buildPenguin);
