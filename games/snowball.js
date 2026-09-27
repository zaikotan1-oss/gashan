function build_snowball(api){
  const g=api.g;
  api.preload(["bg.jpg","barrel.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。とりでは生成不良のため手描きのまま
  let balls=[],forts=[],shards=[],sparks=[],rings=[],puffs=[],flakes=[],sparkle=[];
  let launchX,launchY,groundY,U;                 // U = unit size
  let count=0,combo=0,comboT=0,tsec=0,flash=0,flashCol="#fff";
  let charging=false,chargeP=0,aimX=0,aimY=0,cannonA=-Math.PI/2,cannonRecoil=0;
  let spawnT=0;
  // fever time / rare gold fort / float texts / hitStop cooldown
  let fever=0,feverT=0,feverGauge=0,feverBannT=0,hitCd=0,floats=[];
  let pendingFeverStart=false;   // 軸6: フィーバー開始とステージクリアのバナーが同時発火して文字が重なるのを防ぐ持ち越しフラグ
  const FEVER_LEN=10;
  const RAINBOW=["#ff5b5b","#ffd23f","#4db8ff","#7be08a","#ff7bd0","#b58bff"];
  // stage progression (endless)
  let stage=1,stageKill=0,stageGoal=10,clearT=0,clearStage=0;
  // ---- 隠し発見レイヤー(crane/punch/hammer/truck と同じ思想) ----
  const FLAGCOLS=["#ff5b5b","#ffd23f","#4db8ff","#7be08a","#ff7bd0","#b58bff"];
  const FLAGNAME={"#ff5b5b":"あか","#ffd23f":"きいろ","#4db8ff":"あお","#7be08a":"みどり","#ff7bd0":"ピンク","#b58bff":"むらさき"};
  let luckyFlag=pick(FLAGCOLS),luckySeen=false,luckyTeachT=0;   // ② きょうのラッキー色(はた)
  let rbMsgT=0,pendingRB=null;                                 // ① にじいろ とりで + 接近予告
  let comboKept=true,nonstopT=0;                               // ③ ノンストップ(コンボ継続)判定
  const moonHit={x:0,y:0,r:0}; let moonWink=0,moonCd=0;        // ④ お月さまひみつタップ
  // 軸6(見やすさ): 雪原/フラッシュの白背景に沈まないよう、薄い水色一辺倒からもう少し彩度・明度に幅を持たせた配色に変更
  const COLS=["#6fb8dc","#3f8fc2","#5aa8d6","#7fc4e8","#4a94c8"];
  // per-stage sky palette (cold winter shifts)
  const SKY=[
    ["#8fd0e8","#bfe9f5","#e8f7ff"],  // 1 day
    ["#7fb8e0","#a6d6ee","#dbeeff"],  // 2 brighter
    ["#5f7fb8","#8fb0d8","#cfe0f5"],  // 3 dusk
    ["#3a4f8a","#6a78b8","#b0c0e8"],  // 4 evening
    ["#2a2f66","#5a4f9a","#9a8ad8"]   // 5 night aurora
  ];
  function sky(){return SKY[(stage-1)%SKY.length];}
  function stageGoalFor(s){return 10+(s-1)*4;}   // 10,14,18,22...（7〜8歳向けに手応えを増やした）

  function layout(){
    groundY=api.H*0.86;
    launchX=api.W/2; launchY=groundY-api.H*0.02;
    U=clamp(Math.min(api.W,api.H)*0.05,20,40);
    // ④ お月さまの当たり判定(描画位置 lx,ly と一致・寛容に大きめ)
    moonHit.x=api.W*0.76; moonHit.y=api.H*0.16; moonHit.r=Math.max(44,api.W*0.075);
    // build snowflakes (drifting)
    flakes=[];
    for(let i=0;i<70;i++)flakes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(1.2,4.2),
      sp:rnd(0.3,1.3),sway:rnd(0,TAU),sa:rnd(0.01,0.03),amp:rnd(6,26)});
    sparkle=[];
    for(let i=0;i<26;i++)sparkle.push({x:rnd(0,api.W),y:rnd(0,groundY*0.7),tw:rnd(0,TAU),sp:rnd(0.04,0.1)});
  }
  layout();

  function spawnFort(){
    if(forts.length>=(fever>0?8:5))return;
    // place along the upper play area, avoid the safe HUD corners (y<56 near edges)
    const x=rnd(api.W*0.14,api.W*0.86);
    const y=rnd(api.H*0.20,api.H*0.55);
    const gold=Math.random()<0.08;                 // rare golden fort (A)
    const big=!gold&&stage>=2&&Math.random()<clamp(0.22+0.07*(stage-2),0.22,0.55);  // でか砦は少し多め(7〜8歳向け)
    const tiny=!gold&&!big&&Math.random()<0.25;    // 軸7: 大中小の3段階サイズにして大きさ差をはっきりさせる
    const r=U*(big?1.55:(tiny?0.72:1.05));
    // ② ラッキー旗: ふつう/でか砦には色つきの小旗を立てる(色さがしのヒント)
    // 軸7(壊す物のバラエティ): 見た目の形そのものを角丸四角/丸/つらら/だんご3段でランダムに変える
    const shape=pick(["cube","round","tall","stack"]);
    forts.push({x,y,r,hp:(gold||fever>0)?1:(big?2:1),maxhp:big?2:1,
      col:gold?"#ffd23f":pick(COLS),bob:rnd(0,TAU),wob:0,flash:0,big,tiny,gold,rainbow:false,
      flag:gold?null:pick(FLAGCOLS),shape});
    if(gold){ // eye-catching arrival: chime + golden ring
      api.tone(1318,0.12,"triangle",0.12); api.tone(1760,0.2,"triangle",0.1);
      ring(x,y,r*1.5,"#ffd23f");
    }
  }
  // ① にじいろ とりで: たまに(stage>=2・約5%)予告してから出現する激レア。いつ来るか分からない=ドキドキ発見。
  function trySpawn(){
    if(stage>=2 && !pendingRB && fever<=0 && !forts.some(f=>f.rainbow) && Math.random()<0.05){
      const x=rnd(api.W*0.18,api.W*0.82), y=rnd(api.H*0.22,api.H*0.5);
      pendingRB={x,y,t:0.75};
      api.tone(880,0.08,"triangle",0.08);   // 予告のちいさなキラン
      return;
    }
    spawnFort();
  }
  function makeRainbow(x,y){
    const r=U*1.15;
    forts.push({x,y,r,hp:1,maxhp:1,col:"#ff5b5b",bob:rnd(0,TAU),wob:0,flash:0,big:false,gold:false,rainbow:true,flag:null,
      shape:pick(["cube","round","tall"])});
    ring(x,y,r*1.7,"#ffd23f");
    api.tone(1046,0.1,"triangle",0.1); api.tone(1568,0.16,"triangle",0.09);
  }
  function rainbowBurst(f){
    // ① にじいろ とりで 撃破: 虹の輪が6色ぶわっと広がる大盤振る舞い(白飛び防止に flash は控えめ)
    rbMsgT=1.4; flash=Math.min(1,flash+0.3); flashCol="#ffffff";
    api.boom(0.6); api.shake(14);
    if(hitCd<=0){api.hitStop(4); hitCd=30;}
    api.slide(660,1320,0.4,0.22,"triangle"); api.tone(1318,0.16,"triangle",0.1); api.tone(1760,0.18,"triangle",0.08);
    for(let k=0;k<RAINBOW.length;k++)ring(f.x,f.y,f.r*(1.2+k*0.34),RAINBOW[k]);
    for(let i=0;i<24;i++){const a=rnd(0,TAU),sv=rnd(3,9);
      sparks.push({x:f.x,y:f.y,vx:Math.cos(a)*sv,vy:Math.sin(a)*sv-2,life:1,decay:rnd(0.012,0.02),
        r:rnd(3,7),col:RAINBOW[i%RAINBOW.length]});}
    if(sparks.length>140)sparks.splice(0,sparks.length-140);
  }
  function moonSecret(){
    // ④ お月さまひみつタップ: 何もない空でお月さまを離したら ウインク＋金コイン(減点なし・発射しない)
    moonWink=1;
    api.tone(1318,0.1,"triangle",0.1); api.tone(1760,0.14,"triangle",0.08);
    const mx=moonHit.x,my=moonHit.y;
    for(let i=0;i<8;i++){const a=rnd(-TAU/2,0),sv=rnd(2,6);
      sparks.push({x:mx,y:my,vx:Math.cos(a)*sv*0.7,vy:Math.sin(a)*sv+1,life:1,decay:0.016,
        r:rnd(3,6),col:pick(["#ffd23f","#fff0a0","#ffe08a"])});}
    if(moonCd<=0){ count+=2; api.setScore(count); moonCd=90;
      floats.push({x:mx,y:my+U*0.6,txt:"+2",life:1,vy:-0.9,col:"#ffd23f",size:26});
      while(floats.length>10)floats.shift();
    }
  }
  function startFever(){
    fever=1; feverT=FEVER_LEN; feverGauge=0; feverBannT=1.6;
    flash=1; flashCol="#ffd23f";
    api.boom(0.65); api.shake(14);
    api.slide(392,1568,0.5,0.3,"triangle");
    setTimeout(()=>api.tone(1046,0.2,"triangle",0.14),150);
    setTimeout(()=>api.tone(1568,0.25,"triangle",0.12),300);
    forts.forEach(f=>f.hp=1);                      // everything one-shot!
    for(let i=0;i<4;i++)spawnFort();               // instant crowd of targets
    spawnT=10;
  }
  // auto-aim + gravity-compensated shot: snap to the fort nearest to the tap
  // and solve the launch velocity so the ball passes exactly through it.
  function calcShot(tx,ty,p){
    let ax=tx, ay=ty, bd=1e9;
    for(const f of forts){const d=Math.hypot(f.x-tx,f.y-ty);
      if(d<bd){bd=d; ax=f.x; ay=f.y;}}
    // 軸3(歯ごたえ): 吸着には距離上限を設ける。タップが砦から離れすぎていたら
    // 生のタップ座標へ撃つ(=狙わない連打は外れる)。狙って撃てば従来通り確実に当たる。
    const MAG=U*1.6;
    if(bd>MAG){ax=tx; ay=ty;}
    const sx=launchX, sy=launchY-U*0.6;
    const dx=ax-sx, dy=ay-sy;
    const d=Math.max(40,Math.hypot(dx,dy));
    const sp=11+p*7;                  // charge -> faster
    const T=Math.max(6,d/sp);         // flight frames to reach the target
    // y(T)=vy*T+0.14*T^2 == dy  ->  vy = dy/T - 0.14*T
    return {vx:dx/T, vy:dy/T-0.14*T};
  }
  function launch(tx,ty,p){
    const v=calcShot(tx,ty,p);
    const r=U*(0.5+p*1.0);            // charge -> bigger (base is kid-friendly big)。軸3: 無チャージの即撃ちは判定を絞り、狙わない連打が伸びすぎないようにする
    balls.push({x:launchX,y:launchY-U*0.6,vx:v.vx,vy:v.vy,r,big:p>0.55,life:1});
    cannonA=Math.atan2(v.vy,v.vx); cannonRecoil=1;
    api.slide(p>0.55?260:360,120,0.14,0.22,"sine");
    api.noise(0.1,0.16,p>0.55?900:1500,"bandpass",0.8);
    if(p>0.55){api.boom(0.35+p*0.2);api.shake(4);}
    // launch puff
    for(let i=0;i<8;i++){const a=cannonA+rnd(-0.6,0.6);
      puffs.push({x:launchX,y:launchY-U*0.4,vx:Math.cos(a)*rnd(1,4),vy:Math.sin(a)*rnd(1,4),
        r:rnd(U*0.2,U*0.5),life:1,decay:rnd(0.03,0.05)});}
  }
  function smashFort(f,bx,by,big){
    f.hp--;
    if(f.hp>0){
      // big fort: first hit only cracks it
      f.flash=1; f.wob=1;
      api.noise(0.08,0.16,2200,"highpass",1); api.tone(300,0.08,"square",0.1); api.shake(4);
      ring(bx,by,U*0.5,"#dff4ff");
      burst(bx,by,f.col,6,4);
      return false;
    }
    // destroyed!
    const base=f.rainbow?8:(f.gold?5:(f.big?3:1));
    let pts=base*(fever>0?2:1);                     // fever = double points
    // ② ラッキー色: きょうの秘密の旗色を倒すと +1 の隠しボーナス。気づくと得する。
    const isLucky=!f.gold&&!f.rainbow&&f.flag===luckyFlag;
    if(isLucky){pts+=1; if(!luckySeen){luckySeen=true; luckyTeachT=2.0;}}
    count+=pts; stageKill++; api.setScore(count);
    combo++; comboT=1;
    const power=clamp(0.35+combo*0.05,0.35,0.7);
    api.boom(power); api.shake(6+Math.min(combo,8));
    // hitStop: big-hit/milestone only + 30f cooldown (never every frame-event)
    if(hitCd<=0&&(f.gold||f.big||(combo>=5&&combo%5===0))){
      api.hitStop(f.gold?4:3); hitCd=30;
    }
    api.slide(420*Math.pow(2,clamp(combo,0,10)/14),120,0.16,0.3,"triangle");
    api.noise(0.22,0.3,800,"lowpass",0.7);
    flash=Math.min(1,flash+0.4); flashCol=f.gold?"#ffd23f":f.col;
    ring(f.x,f.y,f.r*1.2,"#ffffff"); ring(f.x,f.y,f.r*0.6,f.col);
    burst(f.x,f.y,f.col,big?18:12,8);
    if(f.rainbow){
      rainbowBurst(f);
      floats.push({x:f.x,y:Math.max(f.y-f.r,api.H*0.20),txt:"+"+pts,life:1,vy:-1.1,col:"#ff7bd0",size:36});
    }else if(f.gold){
      // rainbow shower + fanfare (special reward moment)
      [0,4,7,12].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.16,"triangle",0.12),i*70));
      for(let i=0;i<20;i++){const a=rnd(0,TAU),sv=rnd(3,9);
        sparks.push({x:f.x,y:f.y,vx:Math.cos(a)*sv,vy:Math.sin(a)*sv-2,life:1,
          decay:rnd(0.012,0.02),r:rnd(3,7),col:RAINBOW[i%RAINBOW.length]});}
      ring(f.x,f.y,f.r*2,"#ffd23f");
      floats.push({x:f.x,y:Math.max(f.y-f.r,api.H*0.20),txt:"+"+pts,life:1,vy:-1.1,col:"#ffd23f",size:36});
    }else if(fever>0){
      floats.push({x:f.x,y:Math.max(f.y-f.r,api.H*0.20),txt:"+"+pts,life:1,vy:-0.9,col:"#ff7bd0",size:24});
    }
    // ② ラッキー旗 命中: きらっと小さめの祝福＋頭上の星のキラッ(白飛びしないよう控えめ)
    if(isLucky){
      api.tone(1175,0.12,"triangle",0.11); api.tone(1568,0.14,"triangle",0.08);
      for(let i=0;i<9;i++){const a=rnd(0,TAU),sv=rnd(2,6);
        sparks.push({x:f.x,y:f.y-f.r*0.4,vx:Math.cos(a)*sv,vy:Math.sin(a)*sv-2,life:1,
          decay:rnd(0.02,0.03),r:rnd(3,6),col:luckyFlag});}
      floats.push({x:f.x,y:Math.max(f.y-f.r*1.2,api.H*0.20),txt:"ラッキー！",life:1,vy:-0.9,col:luckyFlag,size:22});
    }
    while(floats.length>10)floats.shift();
    if(sparks.length>140)sparks.splice(0,sparks.length-140);
    // fever gauge charges while not in fever (B)
    if(fever<=0){
      feverGauge=Math.min(1,feverGauge+(f.gold?0.3:f.big?0.15:0.09));
      if(feverGauge>=1){
        // 軸6: このヒットでステージクリアも同時に成立する(またはクリア演出が出ている)場合は
        // フィーバー開始を持ち越し、「フィーバータイム！」と「ステージX クリア！」の重複表示を避ける
        if(stageKill>=stageGoal||clearT>0)pendingFeverStart=true;
        else startFever();
      }
    }
    // snowy shards ― 軸7(壊す物のバラエティ): 形によって壊れ方も変える
    // つらら(tall)は縦に長い破片がまっすぐ下に落ちる。丸(round)/四角(cube)は従来通り放射状に飛び散る。
    if(f.shape==="tall"){
      for(let i=rint(6,9);i>0;i--){
        shards.push({x:f.x+rnd(-f.r*0.25,f.r*0.25),y:f.y+rnd(-f.r*0.5,f.r*0.2),
          vx:rnd(-1.4,1.4),vy:rnd(2,6),r:rnd(f.r*0.14,f.r*0.24),
          rot:rnd(-0.15,0.15),vr:rnd(-0.05,0.05),life:1,decay:rnd(0.01,0.016),col:f.col,long:true});
      }
    }else{
      for(let i=rint(7,11);i>0;i--){const a=rnd(0,TAU),s=rnd(3,9);
        shards.push({x:f.x+rnd(-f.r*0.4,f.r*0.4),y:f.y+rnd(-f.r*0.4,f.r*0.4),
          vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(f.r*0.16,f.r*0.34),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.01,0.018),col:f.col});}
    }
    if(shards.length>70)shards.splice(0,shards.length-70);
    forts.splice(forts.indexOf(f),1);
    checkStage();
    return true;
  }
  function ring(x,y,r,col){rings.push({x,y,r:r*0.4,vr:r*0.9,life:1,col});}
  function burst(x,y,col,n,spd){
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(spd*0.4,spd);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:1,decay:rnd(0.015,0.03),
        r:rnd(2,5),col:i%3===0?col:(i%3===1?"#ffffff":"#dff4ff")});}
  }
  function checkStage(){
    if(stageKill<stageGoal||clearT>0)return;
    clearStage=stage; clearT=1.6; flash=Math.min(1,flash+0.6); flashCol="#dff4ff";
    api.boom(0.5); api.shake(12);
    api.slide(523,784,0.3,0.2,"triangle"); api.tone(660,0.25,"triangle",0.14);
    api.tone(988,0.3,"triangle",0.1);
    for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
      sparks.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,
        life:1,decay:rnd(0.012,0.02),r:rnd(4,9),col:pick(["#ffd23f","#ffffff","#9fd8ee","#7be08a"])});}
    // ③ ノンストップ ボーナス: このステージをコンボ切らさず走り切ったら +3 & みどりの星シャワー。
    if(comboKept){count+=3; api.setScore(count); nonstopT=1.8;
      api.tone(1318,0.16,"triangle",0.12); api.tone(1976,0.18,"triangle",0.08);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(3,8);
        sparks.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,
          life:1,decay:rnd(0.012,0.02),r:rnd(4,8),col:"#7be08a"});}}
    stage++; stageGoal=stageGoalFor(stage); stageKill=0; comboKept=true;
  }

  return{
    resize:layout,
    input(x,y,type){
      if(type==="down"){
        charging=true; chargeP=0; aimX=x; aimY=y;
      }else if(type==="move"){
        if(charging){aimX=x; aimY=y;}
      }else if(type==="up"){
        if(!charging)return;
        charging=false;
        // ④ お月さまひみつタップ: 何もない空でお月さまを離したら ウインク＋コイン(発射しない/減点なし)
        if(Math.hypot(aimX-moonHit.x,aimY-moonHit.y)<moonHit.r &&
           !forts.some(f=>Math.hypot(f.x-aimX,f.y-aimY)<U*2.6)){
          moonSecret(); chargeP=0; return;
        }
        // guard: if aim is at the cannon, shoot straight up
        if(Math.hypot(aimX-launchX,aimY-launchY)<6){aimX=launchX; aimY=launchY-100;}
        launch(aimX,aimY,chargeP);
        chargeP=0;
      }
    },
    frame(dt,now){
      tsec+=0.016*dt;
      if(comboT>0){comboT-=0.016*dt;if(comboT<=0){combo=0; comboKept=false;}}  // ③ コンボ切れ=ノンストップ失敗
      if(cannonRecoil>0)cannonRecoil=Math.max(0,cannonRecoil-0.08*dt);
      if(hitCd>0)hitCd-=dt;
      if(moonCd>0)moonCd-=dt;
      // fever countdown + flashy exit
      if(fever>0){feverT-=0.016*dt;
        if(feverT<=0){fever=0; feverT=0;
          flash=Math.min(1,flash+0.5); flashCol="#ffffff";
          api.slide(1046,392,0.4,0.2,"triangle"); api.noise(0.3,0.2,600,"lowpass",0.7);
        }}
      // charging build-up
      if(charging){chargeP=Math.min(1,chargeP+0.018*dt);
        const cv=calcShot(aimX,aimY,chargeP);
        cannonA=Math.atan2(cv.vy,cv.vx);
        if(tsec%0.06<0.016*dt&&chargeP<1)api.tone(300+chargeP*500,0.04,"sine",0.05);}

      // ---- background sky (fever = magic twilight takeover) ----
      const s=fever>0?["#3a1060","#a03a9a","#ff9ad8"]:sky();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージの空色 / フィーバーの夕焼けを薄く重ねて雰囲気だけ変える(1面=昼はそのまま)
        const si=(stage-1)%SKY.length;
        if(fever>0||si!==0){
          g.save(); g.globalAlpha=fever>0?0.4:0.28;
          const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,s[0]); tg.addColorStop(0.5,s[1]); tg.addColorStop(1,s[2]);
          g.fillStyle=tg; g.fillRect(0,0,api.W,api.H); g.restore(); g.globalAlpha=1;
        }
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,s[0]); grd.addColorStop(0.5,s[1]); grd.addColorStop(1,s[2]);
        g.fillStyle=grd; g.fillRect(0,0,api.W,api.H);
      }
      // fever: rainbow aurora ribbons waving across the sky
      if(fever>0){
        g.save(); g.globalCompositeOperation="lighter";
        for(let a2=0;a2<3;a2++){const cy=api.H*(0.16+a2*0.14);
          g.globalAlpha=0.2*(0.6+0.4*Math.sin(tsec*2+a2*1.3));
          g.fillStyle=RAINBOW[(a2*2)%RAINBOW.length];
          g.beginPath(); g.moveTo(0,cy);
          for(let x2=0;x2<=api.W;x2+=28)g.lineTo(x2,cy+Math.sin(x2*0.014+tsec*2.4+a2*2)*20);
          g.lineTo(api.W,cy+70); g.lineTo(0,cy+70); g.closePath(); g.fill();}
        g.restore(); g.globalAlpha=1; g.globalCompositeOperation="source-over";
      }
      // soft sun/moon glow upper area
      const lx=api.W*0.76,ly=api.H*0.16;
      let lg=g.createRadialGradient(lx,ly,0,lx,ly,api.W*0.5);
      lg.addColorStop(0,"rgba(255,255,245,.5)"); lg.addColorStop(0.3,"rgba(255,255,245,.18)"); lg.addColorStop(1,"rgba(255,255,245,0)");
      g.fillStyle=lg; g.fillRect(0,0,api.W,api.H);
      g.save(); g.shadowColor="rgba(255,255,235,.8)"; g.shadowBlur=26;
      g.fillStyle="rgba(255,255,240,.92)"; g.beginPath(); g.arc(lx,ly,api.W*0.04,0,TAU); g.fill(); g.restore();
      // ④ お月さまウインク顔(ひみつタップのごほうび)
      if(moonWink>0){moonWink-=0.02*dt; const mr=api.W*0.04;
        g.save(); g.strokeStyle="#8aa0c8"; g.lineWidth=Math.max(2,mr*0.14); g.lineCap="round";
        g.globalAlpha=clamp(moonWink*1.4,0,1);
        g.beginPath();
        g.moveTo(lx-mr*0.44,ly-mr*0.02); g.quadraticCurveTo(lx-mr*0.29,ly-mr*0.32,lx-mr*0.14,ly-mr*0.02);
        g.moveTo(lx+mr*0.14,ly-mr*0.02); g.quadraticCurveTo(lx+mr*0.29,ly-mr*0.32,lx+mr*0.44,ly-mr*0.02);
        g.stroke();
        g.beginPath(); g.arc(lx,ly+mr*0.16,mr*0.32,0.12*Math.PI,0.88*Math.PI); g.stroke();
        g.restore(); g.globalAlpha=1; if(moonWink<0)moonWink=0;}
      // twinkling sky sparkles
      g.fillStyle="#ffffff";
      for(const sp of sparkle){sp.tw+=sp.sp*dt;
        g.globalAlpha=0.12+0.18*(0.5+0.5*Math.sin(sp.tw));
        g.beginPath(); g.arc(sp.x,sp.y,1.4,0,TAU); g.fill();}
      g.globalAlpha=1;
      // distant snowy hills + snowy ground ※画像背景のときは絵の雪原を活かして描かない(平坦な帯は絵と喧嘩する)
      if(!imgBg){
        g.fillStyle="rgba(235,247,255,.7)";
        g.beginPath(); g.moveTo(0,groundY);
        for(let x=0;x<=api.W;x+=30)g.lineTo(x,groundY-api.H*0.06-Math.sin(x/api.W*6+1)*api.H*0.04);
        g.lineTo(api.W,groundY); g.closePath(); g.fill();

        // ---- snowy ground ----
        let gg=g.createLinearGradient(0,groundY,0,api.H);
        gg.addColorStop(0,"#ffffff"); gg.addColorStop(1,"#cfe2ee");
        g.fillStyle=gg; g.fillRect(0,groundY,api.W,api.H-groundY);
        // snow bumps on the ground edge
        g.fillStyle="#ffffff";
        g.beginPath(); g.moveTo(0,groundY+6);
        for(let x=0;x<=api.W;x+=40)g.lineTo(x,groundY-Math.abs(Math.sin(x*0.05))*8);
        g.lineTo(api.W,groundY+6); g.closePath(); g.fill();
      }

      // ---- spawn forts ----
      if(clearT<=0){spawnT-=dt; if(spawnT<=0){trySpawn(); spawnT=fever>0?12:clamp(58-(stage-1)*6,20,58);}}  // 出現は少し速め(7〜8歳向け)。軸3: 吸着/球を絞った分、無反応が延びすぎないよう下限を20に
      // ensure there is always something to shoot
      if(forts.length===0&&clearT<=0&&!pendingRB)spawnFort();
      // ① にじいろ とりで 接近予告: 出現位置で虹色がキラキラ集まる(次くるかも のドキドキ)
      if(pendingRB){pendingRB.t-=0.016*dt;
        const p=pendingRB, prog=clamp(1-p.t/0.75,0,1), pulse=0.5+0.5*Math.sin(tsec*14);
        g.save(); g.globalCompositeOperation="lighter";
        for(let k=0;k<3;k++){
          g.globalAlpha=(0.22+0.28*pulse)*(0.4+0.6*prog);
          g.strokeStyle=RAINBOW[(k+Math.floor(tsec*8))%RAINBOW.length]; g.lineWidth=3;
          g.beginPath(); g.arc(p.x,p.y,U*(1.6-prog*0.7)+k*6,0,TAU); g.stroke();}
        g.restore(); g.globalCompositeOperation="source-over"; g.globalAlpha=1;
        if(p.t<=0){makeRainbow(p.x,p.y); pendingRB=null;}}

      // ---- forts ----
      for(const f of forts){
        f.bob+=0.05*dt;
        if(f.flash>0)f.flash-=0.08*dt;
        if(f.wob>0)f.wob-=0.06*dt;
        drawFort(f);
      }

      // ---- balls (gravity arc) ----
      for(const b of balls){
        b.vy+=0.28*dt; b.x+=b.vx*dt; b.y+=b.vy*dt;
        // collide with forts
        for(let i=forts.length-1;i>=0;i--){const f=forts[i];
          if(Math.hypot(b.x-f.x,b.y-f.y)<b.r+f.r){
            smashFort(f,b.x,b.y,b.big);
            b.life=0; break;
          }
        }
        // tiny trail puff
        if(tsec%0.04<0.016*dt)puffs.push({x:b.x,y:b.y,vx:0,vy:0,r:b.r*0.5,life:0.7,decay:0.05});
        drawBall(b);
      }
      balls=balls.filter(b=>b.life>0&&b.y<api.H+60&&b.x>-60&&b.x<api.W+60);

      // ---- puffs (soft snow clouds) ----
      for(const p of puffs){p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.92; p.vy*=0.92; p.r+=0.6*dt; p.life-=p.decay*dt;
        g.globalAlpha=Math.max(0,p.life)*0.5; g.fillStyle="#ffffff";
        g.beginPath(); g.arc(p.x,p.y,p.r,0,TAU); g.fill();}
      g.globalAlpha=1; puffs=puffs.filter(p=>p.life>0);

      // ---- shards ----
      for(const sh of shards){sh.vy+=0.4*dt; sh.x+=sh.vx*dt; sh.y+=sh.vy*dt; sh.rot+=sh.vr*dt;
        if(sh.y>groundY-2){sh.y=groundY-2; sh.vy*=-0.3; sh.vx*=0.7; sh.life-=0.04*dt;}
        sh.life-=sh.decay*dt;
        g.save(); g.globalAlpha=Math.max(0,sh.life); g.translate(sh.x,sh.y); g.rotate(sh.rot);
        if(sh.long){
          g.fillStyle=sh.col; g.beginPath(); g.ellipse(0,0,Math.max(0,sh.r*0.5),Math.max(0,sh.r*1.8),0,0,TAU); g.fill();
          g.fillStyle="rgba(255,255,255,.6)"; g.beginPath(); g.ellipse(-sh.r*0.15,-sh.r*0.5,Math.max(0,sh.r*0.2),Math.max(0,sh.r*0.6),0,0,TAU); g.fill();
        }else{
          g.fillStyle=sh.col; g.beginPath(); g.arc(0,0,Math.max(0,sh.r),0,TAU); g.fill();
          g.fillStyle="rgba(255,255,255,.6)"; g.beginPath(); g.arc(-sh.r*0.3,-sh.r*0.3,Math.max(0,sh.r*0.4),0,TAU); g.fill();
        }
        g.restore();}
      shards=shards.filter(sh=>sh.life>0);

      // ---- rings (shockwave) ----
      for(const ri of rings){ri.r+=ri.vr*dt; ri.life-=0.05*dt;
        g.save(); g.globalAlpha=Math.max(0,ri.life)*0.7; g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3; g.beginPath(); g.arc(ri.x,ri.y,ri.r,0,TAU); g.stroke(); g.restore();}
      rings=rings.filter(ri=>ri.life>0);

      // ---- sparks (additive) ----
      g.save(); g.globalCompositeOperation="lighter";
      for(const sp of sparks){sp.vy+=0.22*dt; sp.x+=sp.vx*dt; sp.y+=sp.vy*dt; sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life); g.fillStyle=sp.col; g.shadowBlur=8; g.shadowColor=sp.col;
        g.beginPath(); g.arc(sp.x,sp.y,sp.r*(0.5+sp.life*0.5),0,TAU); g.fill();}
      g.restore(); g.globalAlpha=1; g.shadowBlur=0; g.globalCompositeOperation="source-over";
      sparks=sparks.filter(sp=>sp.life>0);

      // ---- cannon ----
      drawCannon();

      // ---- aim guide while charging ----
      if(charging){
        g.save(); g.globalAlpha=0.5; g.strokeStyle="#ffffff"; g.lineWidth=2; g.setLineDash([8,8]);
        let px=launchX,py=launchY-U*0.6;
        const gv=calcShot(aimX,aimY,chargeP);
        let vx=gv.vx, vy=gv.vy;
        g.beginPath(); g.moveTo(px,py);
        for(let i=0;i<30;i++){vy+=0.28*1.5; px+=vx*1.5; py+=vy*1.5; g.lineTo(px,py); if(py>api.H||py<-40)break;}
        g.stroke(); g.setLineDash([]); g.restore();
      }

      // ---- drifting snowflakes (foreground) ----
      g.fillStyle="#ffffff";
      for(const fl of flakes){fl.y+=fl.sp*dt; fl.sway+=fl.sa*dt; fl.x+=Math.sin(fl.sway)*0.4*dt;
        if(fl.y>api.H+6){fl.y=-6; fl.x=rnd(0,api.W);}
        g.globalAlpha=0.55;
        g.beginPath(); g.arc(fl.x+Math.sin(fl.sway)*fl.amp*0.1,fl.y,fl.r,0,TAU); g.fill();}
      g.globalAlpha=1;

      // ---- impact flash ----
      if(flash>0){flash-=0.06*dt;
        g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=Math.max(0,flash)*0.3;
        g.fillStyle=flashCol;
        // 軸6(見やすさ): 上部HUD帯(ステージ文字/フィーバーゲージ)はフラッシュの白飛びから外し、常に読めるようにする
        const hudBand=api.H*0.13;
        g.fillRect(0,hudBand,api.W,api.H-hudBand);
        g.restore(); g.globalAlpha=1; g.globalCompositeOperation="source-over";}

      // ---- combo text (top center safe zone) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save(); g.translate(api.W/2,api.H*0.14); g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(80,160,255,.8)"; g.shadowBlur=14;
        g.fillStyle="#ffffff"; g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(120,180,255,.7)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
      }

      // ---- floating point texts ----
      for(const ft of floats){ft.y+=ft.vy*dt; ft.life-=0.02*dt;
        g.save(); g.globalAlpha=Math.max(0,ft.life); g.textAlign="center";
        g.font="800 "+ft.size+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=4; g.strokeStyle="rgba(0,0,0,.45)"; g.strokeText(ft.txt,ft.x,ft.y);
        g.fillStyle=ft.col; g.fillText(ft.txt,ft.x,ft.y); g.restore();}
      floats=floats.filter(ft=>ft.life>0);
      g.globalAlpha=1; g.textAlign="left";

      // ---- fever entry banner ----
      if(feverBannT>0){feverBannT-=0.016*dt;
        const fa=clamp(feverBannT*1.5,0,1),pop=1+Math.max(0,feverBannT-1.2)*2.2;
        g.save(); g.translate(api.W/2,api.H*0.4); g.scale(pop,pop); g.globalAlpha=fa;
        g.textAlign="center"; g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,210,63,.95)"; g.shadowBlur=24;
        g.fillStyle="#fff6c8"; g.fillText("フィーバータイム！",0,0);
        g.shadowBlur=0; g.lineWidth=2; g.strokeStyle="#ff7bd0"; g.strokeText("フィーバータイム！",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#fff";
        g.fillText("ぜんぶ 1ぱつ！ てんすう 2ばい！",0,40);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
      }

      // ① にじいろ とりで！ 中央バナー(虹色に色替わり=レアの大きな祝福)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3, col=RAINBOW[Math.floor(tsec*6)%RAINBOW.length];
        g.save(); g.translate(api.W/2,api.H*0.22); g.scale(pop,pop); g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1); g.font="900 40px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7; g.strokeStyle="rgba(0,0,0,.45)"; g.strokeText("にじいろ とりで！",0,0);
        g.fillStyle=col; g.fillText("にじいろ とりで！",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央の小ヒント(初回だけ)
      if(luckyTeachT>0){luckyTeachT-=0.016*dt;
        g.save(); g.translate(api.W/2,api.H*0.3); g.textAlign="center";
        g.globalAlpha=clamp(luckyTeachT*1.2,0,1); g.font="800 23px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキーは "+(FLAGNAME[luckyFlag]||"")+"の はた！";
        g.lineWidth=5; g.strokeStyle="rgba(0,0,0,.45)"; g.strokeText(t2,0,0);
        g.fillStyle=luckyFlag; g.fillText(t2,0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(luckyTeachT<0)luckyTeachT=0;}
      // ③ ノンストップ ボーナス！(ステージクリアの下側=クリア文字と重ねない)
      if(nonstopT>0){nonstopT-=0.014*dt;
        const pop=1+Math.max(0,nonstopT-1.3)*1.3;
        g.save(); g.translate(api.W/2,api.H*0.62); g.scale(pop,pop); g.textAlign="center";
        g.globalAlpha=clamp(nonstopT*1.3,0,1); g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)"; g.shadowBlur=14;
        g.fillStyle="#c7ffcf"; g.fillText("ノンストップ ボーナス！",0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(40,120,60,.7)"; g.strokeText("ノンストップ ボーナス！",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; if(nonstopT<0)nonstopT=0;}

      // ---- HUD (top center) ----
      drawHUD();

      // ---- stage clear banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save(); g.globalAlpha=a*0.45; g.fillStyle="#1a2a4a"; g.fillRect(0,api.H*0.34,api.W,api.H*0.22); g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save(); g.translate(api.W/2,api.H*0.45); g.scale(pop,pop); g.globalAlpha=a;
        g.textAlign="center"; g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(120,200,255,.9)"; g.shadowBlur=20; g.fillStyle="#eaf7ff";
        g.fillText("ステージ"+clearStage+" クリア！",0,0);
        g.shadowBlur=0; g.lineWidth=2; g.strokeStyle="#8fc6ff"; g.strokeText("ステージ"+clearStage+" クリア！",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#fff";
        g.fillText("つぎは ステージ"+(clearStage+1)+"！",0,42);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
        if(clearT<=0){clearT=0; spawnT=20;
          if(pendingFeverStart){pendingFeverStart=false; startFever();}
        }
      }
    },
    stop(){}
  };

  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.05;
    g.save(); g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff"; g.shadowColor="rgba(0,0,0,.5)"; g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,0,0,.30)"; roundRect(bx,by,bw,bh,bh/2); g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const lgr=g.createLinearGradient(bx,0,bx+bw,0);
      lgr.addColorStop(0,"#9fd8ee"); lgr.addColorStop(1,"#ffffff");
      g.fillStyle=lgr; roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2); g.fill();}
    g.strokeStyle="rgba(255,255,255,.6)"; g.lineWidth=2; roundRect(bx,by,bw,bh,bh/2); g.stroke();
    // fever gauge / fever timer (thin bar under the stage bar)
    const gw=bw*0.72,gx=(api.W-gw)/2,gy=by+bh+6,gh=9;
    g.fillStyle="rgba(0,0,0,.28)"; roundRect(gx,gy,gw,gh,gh/2); g.fill();
    if(fever>0){
      const fr2=clamp(feverT/FEVER_LEN,0,1);
      const blink=feverT<2?(Math.sin(tsec*16)>0?1:0.4):1;   // ending warning blink
      const lg2=g.createLinearGradient(gx,0,gx+gw,0);
      lg2.addColorStop(0,"#ff7bd0"); lg2.addColorStop(0.5,"#ffd23f"); lg2.addColorStop(1,"#4db8ff");
      g.globalAlpha=blink;
      if(fr2>0){g.fillStyle=lg2; roundRect(gx,gy,Math.max(gh,gw*fr2),gh,gh/2); g.fill();}
      g.font="800 14px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#ffd23f";
      g.shadowColor="rgba(0,0,0,.5)"; g.shadowBlur=4;
      g.fillText("フィーバー！ てんすう 2ばい",api.W/2,gy+gh+16);
      g.shadowBlur=0; g.globalAlpha=1;
    }else if(feverGauge>0){
      const lg2=g.createLinearGradient(gx,0,gx+gw,0);
      lg2.addColorStop(0,"#ffb84d"); lg2.addColorStop(1,"#ffd23f");
      g.fillStyle=lg2; roundRect(gx,gy,Math.max(gh,gw*feverGauge),gh,gh/2); g.fill();
    }
    g.strokeStyle="rgba(255,255,255,.45)"; g.lineWidth=1.5; roundRect(gx,gy,gw,gh,gh/2); g.stroke();
    g.restore(); g.textAlign="left";
  }

  function drawCannon(){
    const x=launchX,y=launchY;
    const recoil=cannonRecoil*U*0.4;
    // snow mound base
    g.fillStyle="#ffffff";
    g.beginPath(); g.ellipse(x,y+U*0.2,U*1.3,U*0.55,0,0,TAU); g.fill();
    g.fillStyle="rgba(180,210,230,.5)";
    g.beginPath(); g.ellipse(x,y+U*0.35,U*1.1,U*0.35,0,0,TAU); g.fill();
    // barrel — 画像(右向きの筒)を砲身の向きに回して描く。未準備なら従来の手描き。
    // 画像は正方形いっぱいに右向きの太い筒(長さ≒幅の0.95・太さ≒幅の0.85): 中心を支点から前に出し、筒先≒U*1.7(チャージ光の位置)に合わせる
    const bl=U*0.9-recoil;                              // 支点→筒の中心までの距離(反動で引っ込む)。筒は 支点+0.07U 〜 +1.73U
    const bcx=x+Math.cos(cannonA)*bl, bcy=(y-U*0.2)+Math.sin(cannonA)*bl;
    if(!api.drawAsset("barrel.png",bcx,bcy,U*1.75,U*1.75,{center:true,rot:cannonA})){
      g.save(); g.translate(x,y-U*0.2); g.rotate(cannonA+Math.PI/2);
      g.translate(0,recoil);
      const bg=g.createLinearGradient(-U*0.4,0,U*0.4,0);
      bg.addColorStop(0,"#5a6e8a"); bg.addColorStop(0.5,"#aec6e0"); bg.addColorStop(1,"#5a6e8a");
      g.fillStyle=bg; roundRect(-U*0.4,-U*1.5,U*0.8,U*1.5,U*0.2); g.fill();
      g.strokeStyle="rgba(255,255,255,.5)"; g.lineWidth=2; roundRect(-U*0.4,-U*1.5,U*0.8,U*1.5,U*0.2); g.stroke();
      // muzzle ice ring
      g.fillStyle="#dff4ff"; g.beginPath(); g.ellipse(0,-U*1.5,U*0.42,U*0.16,0,0,TAU); g.fill();
      g.restore();
    }
    // cute round body with face
    const r=U*0.7;
    const bgr=g.createRadialGradient(x-r*0.3,y-r*0.5,r*0.1,x,y-U*0.1,r*1.3);
    bgr.addColorStop(0,"#ffffff"); bgr.addColorStop(0.6,"#dff0fa"); bgr.addColorStop(1,"#a9cee6");
    g.fillStyle=bgr; g.beginPath(); g.arc(x,y-U*0.1,r,0,TAU); g.fill();
    g.strokeStyle="rgba(255,255,255,.7)"; g.lineWidth=2; g.beginPath(); g.arc(x,y-U*0.1,r,0,TAU); g.stroke();
    // eyes
    g.fillStyle="#22384f";
    g.beginPath(); g.arc(x-r*0.32,y-U*0.18,r*0.13,0,TAU); g.arc(x+r*0.32,y-U*0.18,r*0.13,0,TAU); g.fill();
    g.fillStyle="rgba(255,255,255,.9)";
    g.beginPath(); g.arc(x-r*0.34,y-U*0.22,r*0.04,0,TAU); g.arc(x+r*0.3,y-U*0.22,r*0.04,0,TAU); g.fill();
    // cheeks + smile
    g.fillStyle="rgba(255,150,170,.45)";
    g.beginPath(); g.arc(x-r*0.46,y-U*0.02,r*0.13,0,TAU); g.arc(x+r*0.46,y-U*0.02,r*0.13,0,TAU); g.fill();
    g.strokeStyle="#22384f"; g.lineWidth=Math.max(2,r*0.08); g.lineCap="round";
    g.beginPath(); g.arc(x,y-U*0.06,r*0.26,0.15*Math.PI,0.85*Math.PI); g.stroke();
    // charge glow on the muzzle
    if(charging&&chargeP>0.05){
      g.save(); g.globalCompositeOperation="lighter";
      const mx=x+Math.cos(cannonA)*U*1.7, my=(y-U*0.2)+Math.sin(cannonA)*U*1.7;
      const cr=U*(0.3+chargeP*0.9)*(0.85+0.15*Math.sin(tsec*12));
      const cg=g.createRadialGradient(mx,my,0,mx,my,cr);
      cg.addColorStop(0,"rgba(220,244,255,.95)"); cg.addColorStop(0.5,"rgba(140,200,255,.5)"); cg.addColorStop(1,"rgba(140,200,255,0)");
      g.fillStyle=cg; g.beginPath(); g.arc(mx,my,cr,0,TAU); g.fill();
      g.restore(); g.globalCompositeOperation="source-over";
      // charge bar above cannon (bottom-area safe)
      const w=U*2,bx=x-w/2,by=y+U*0.7,h=8;
      g.fillStyle="rgba(0,0,0,.3)"; roundRect(bx,by,w,h,h/2); g.fill();
      const pgr=g.createLinearGradient(bx,0,bx+w,0);
      pgr.addColorStop(0,"#9fd8ee"); pgr.addColorStop(1,"#ffffff");
      g.fillStyle=pgr; roundRect(bx,by,Math.max(h,w*chargeP),h,h/2); g.fill();
    }
  }

  function drawBall(b){
    g.save();
    // aura for big charged ball
    if(b.big){g.globalCompositeOperation="lighter";
      const ag=g.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r*1.9);
      ag.addColorStop(0,"rgba(200,235,255,.5)"); ag.addColorStop(1,"rgba(200,235,255,0)");
      g.fillStyle=ag; g.beginPath(); g.arc(b.x,b.y,b.r*1.9,0,TAU); g.fill();
      g.globalCompositeOperation="source-over";}
    const bgr=g.createRadialGradient(b.x-b.r*0.35,b.y-b.r*0.35,b.r*0.1,b.x,b.y,b.r);
    bgr.addColorStop(0,"#ffffff"); bgr.addColorStop(0.6,"#eaf6ff"); bgr.addColorStop(1,"#bcd9ec");
    g.fillStyle=bgr; g.beginPath(); g.arc(b.x,b.y,b.r,0,TAU); g.fill();
    g.fillStyle="rgba(255,255,255,.9)"; g.beginPath(); g.arc(b.x-b.r*0.3,b.y-b.r*0.35,b.r*0.25,0,TAU); g.fill();
    g.strokeStyle="rgba(170,205,225,.6)"; g.lineWidth=1.5; g.beginPath(); g.arc(b.x,b.y,b.r,0,TAU); g.stroke();
    g.restore();
  }

  function drawFort(f){
    const x=f.x, y=f.y+Math.sin(f.bob)*f.r*0.04;
    const wob=1+Math.sin(f.wob*20)*f.wob*0.08;
    g.save(); g.translate(x,y); g.scale(wob,2-wob);
    // ① にじいろ とりで は虹色に色替わり
    const col=f.rainbow?RAINBOW[Math.floor(tsec*6+f.bob*2)%RAINBOW.length]:f.col;
    const shape=f.shape||"cube";
    // 軸7(壊す物のバラエティ): 形ごとに半径の縦横比を変える(角丸四角/丸い雪玉/縦長のつらら)
    const bw=Math.max(1,shape==="round"?f.r*0.92:(shape==="tall"?f.r*0.55:(shape==="stack"?f.r*0.78:f.r*0.85)));
    const bh=Math.max(1,shape==="round"?f.r*0.92:(shape==="tall"?f.r*1.15:(shape==="stack"?f.r*1.25:f.r*0.85)));
    function bodyPath(){
      if(shape==="round"){
        g.beginPath(); g.ellipse(0,0,bw,Math.max(0,bh*0.94),0,0,TAU);
      }else if(shape==="tall"){
        g.beginPath();
        g.moveTo(-bw,-bh*0.55);
        g.quadraticCurveTo(-bw,-bh,0,-bh);
        g.quadraticCurveTo(bw,-bh,bw,-bh*0.55);
        g.lineTo(bw*0.6,bh*0.55);
        g.lineTo(0,bh);
        g.lineTo(-bw*0.6,bh*0.55);
        g.closePath();
      }else if(shape==="stack"){
        // だんご3段の雪だるま: 大小3つの丸を積み重ねたシルエット(軸7の「積み重なった物」)
        g.beginPath();
        g.arc(0,bh*0.62,Math.max(0,bw*0.62),0,TAU);
        g.moveTo(bw*0.42,bh*0.08); g.arc(0,bh*0.08,Math.max(0,bw*0.42),0,TAU);
        g.moveTo(bw*0.26,-bh*0.62); g.arc(0,-bh*0.62,Math.max(0,bw*0.26),0,TAU);
      }else{
        roundRect(-bw,-bh,bw*2,bh*2,bw*0.35);
      }
    }
    // shadow (shape幅に合わせる)
    const shW=shape==="tall"?f.r*0.55:(shape==="stack"?f.r*0.7:f.r*0.9);
    g.fillStyle="rgba(120,150,180,.25)"; g.beginPath(); g.ellipse(0,f.r*0.9,Math.max(0,shW),Math.max(0,f.r*0.28),0,0,TAU); g.fill();
    // rainbow fort: soft glowing halo (short-lived rare = 白飛びしない)
    if(f.rainbow){g.save(); g.globalCompositeOperation="lighter";
      const hg=g.createRadialGradient(0,0,Math.max(0,f.r*0.2),0,0,Math.max(0,f.r*1.7));
      hg.addColorStop(0,"rgba(255,255,255,.3)"); hg.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=hg; g.beginPath(); g.arc(0,0,Math.max(0,f.r*1.7),0,TAU); g.fill();
      g.restore(); g.globalCompositeOperation="source-over";}
    // とりでは手描きのまま(色バリエーション: ふつう色/きんピカ/にじいろ に加え、形も角丸四角/丸/つらら型で変える。生成画像は城/積み木化して不良)
    const bgr=g.createRadialGradient(-bw*0.3,-bh*0.4,Math.max(0,f.r*0.1),0,0,Math.max(0,f.r*1.4));
    bgr.addColorStop(0,"#ffffff"); bgr.addColorStop(0.6,col); bgr.addColorStop(1,shade(col,-30));
    // 軸6(見やすさ): 塗りの前に濃色の薄いアウトラインを1本敷き、背景が明るい/フラッシュ中でも輪郭で確実に浮くようにする
    g.save(); g.strokeStyle="rgba(30,55,90,.45)"; g.lineWidth=U*0.12; bodyPath(); g.stroke(); g.restore();
    g.fillStyle=bgr; bodyPath(); g.fill();
    // ② ラッキー旗: てっぺんに小さな色つきの旗(色さがしのヒント)
    if(f.flag){
      const fx=bw*0.55, fy0=-bh*0.6, fy1=-bh*1.15;
      g.strokeStyle="#8a94a0"; g.lineWidth=Math.max(1.5,bw*0.06); g.lineCap="round";
      g.beginPath(); g.moveTo(fx,fy0); g.lineTo(fx,fy1); g.stroke();
      g.fillStyle=f.flag;
      g.beginPath(); g.moveTo(fx,fy1); g.lineTo(fx+bw*0.5,fy1+bh*0.12); g.lineTo(fx,fy1+bh*0.26); g.closePath(); g.fill();
      g.strokeStyle="rgba(255,255,255,.6)"; g.lineWidth=1; g.stroke();
    }
    g.strokeStyle="rgba(255,255,255,.7)"; g.lineWidth=2; bodyPath(); g.stroke();
    if(shape==="cube"){
      // brick lines (角丸四角=従来どおりの砦らしい積みブロック模様)
      g.strokeStyle="rgba(150,180,205,.5)"; g.lineWidth=1.5;
      g.beginPath();
      g.moveTo(-bw,-bh*0.3); g.lineTo(bw,-bh*0.3);
      g.moveTo(-bw,bh*0.4); g.lineTo(bw,bh*0.4);
      g.moveTo(0,-bh); g.lineTo(0,-bh*0.3);
      g.moveTo(-bw*0.47,-bh*0.3); g.lineTo(-bw*0.47,bh*0.4);
      g.moveTo(bw*0.47,-bh*0.3); g.lineTo(bw*0.47,bh*0.4);
      g.moveTo(0,bh*0.4); g.lineTo(0,bh);
      g.stroke();
      // snow cap on top
      g.fillStyle="#ffffff";
      g.beginPath(); g.moveTo(-bw,-bh*0.7);
      g.quadraticCurveTo(-bw*0.47,-bh*1.18,0,-bh);
      g.quadraticCurveTo(bw*0.47,-bh*1.18,bw,-bh*0.7);
      g.lineTo(bw,-bh*0.53); g.lineTo(-bw,-bh*0.53); g.closePath(); g.fill();
    }else if(shape==="round"){
      // 丸い雪玉: ゆるいくぼみラインとてっぺんのつやハイライト
      g.strokeStyle="rgba(150,180,205,.45)"; g.lineWidth=1.5;
      g.beginPath(); g.arc(0,bh*0.05,Math.max(0,bw*0.72),0.15*Math.PI,0.85*Math.PI); g.stroke();
      g.fillStyle="rgba(255,255,255,.85)";
      g.beginPath(); g.arc(-bw*0.35,-bh*0.5,Math.max(0,bw*0.22),0,TAU); g.fill();
    }else if(shape==="stack"){
      // だんご3段: 段の継ぎ目のうっすら線＋てっぺんの小さな縞ぼうし
      g.strokeStyle="rgba(150,180,205,.45)"; g.lineWidth=1.5;
      g.beginPath();
      g.arc(0,bh*0.33,Math.max(0,bw*0.5),0.1*Math.PI,0.9*Math.PI);
      g.moveTo(bw*0.42,-bh*0.24); g.arc(0,-bh*0.24,Math.max(0,bw*0.32),0.1*Math.PI,0.9*Math.PI);
      g.stroke();
      g.fillStyle="#ff5b5b";
      roundRect(-bw*0.22,-bh*0.9,bw*0.44,bh*0.16,3); g.fill();
    }else{
      // つらら型: 縦の筋とアイスのハイライト
      g.strokeStyle="rgba(255,255,255,.55)"; g.lineWidth=1.5;
      g.beginPath();
      g.moveTo(-bw*0.35,-bh*0.75); g.lineTo(-bw*0.2,bh*0.7);
      g.moveTo(bw*0.3,-bh*0.6); g.lineTo(bw*0.15,bh*0.5);
      g.stroke();
      g.fillStyle="rgba(255,255,255,.9)";
      g.beginPath(); g.ellipse(0,-bh*0.75,Math.max(0,bw*0.35),Math.max(0,bh*0.14),0,0,TAU); g.fill();
    }
    // crack on big fort that took a hit
    if(f.big&&f.hp<f.maxhp){
      g.strokeStyle="rgba(90,120,150,.7)"; g.lineWidth=2.5; g.lineCap="round";
      g.beginPath(); g.moveTo(-bw*0.12,-bh*0.45); g.lineTo(bw*0.09,0); g.lineTo(-bw*0.12,bh*0.45); g.stroke();
    }
    // hit flash
    if(f.flash>0){g.globalAlpha=f.flash*0.7; g.fillStyle="#fff";
      bodyPath(); g.fill(); g.globalAlpha=1;}
    // little face (どの形でも同じ表情=キャラの一貫性は保つ)
    g.fillStyle="#22384f";
    g.beginPath(); g.arc(-bw*0.3,-bw*0.02,Math.max(0,bw*0.12),0,TAU); g.arc(bw*0.3,-bw*0.02,Math.max(0,bw*0.12),0,TAU); g.fill();
    g.fillStyle="rgba(255,140,150,.4)";
    g.beginPath(); g.arc(-bw*0.47,bw*0.16,Math.max(0,bw*0.12),0,TAU); g.arc(bw*0.47,bw*0.16,Math.max(0,bw*0.12),0,TAU); g.fill();
    g.strokeStyle="#22384f"; g.lineWidth=Math.max(1.5,bw*0.07); g.lineCap="round";
    g.beginPath(); g.arc(0,bw*0.09,Math.max(0,bw*0.21),0.15*Math.PI,0.85*Math.PI); g.stroke();
    g.restore();
  }

  function roundRect(x,y,w,h,r){g.beginPath(); g.moveTo(x+r,y);
    g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath();}
  function shade(hex,amt){const c=parseInt(hex.slice(1),16);
    const r=clamp(((c>>16)&255)+amt,0,255),gg=clamp(((c>>8)&255)+amt,0,255),b=clamp((c&255)+amt,0,255);
    return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("snowball", build_snowball);
