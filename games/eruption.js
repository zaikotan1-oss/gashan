function build_eruption(api){
  const g=api.g;
  // 画像アセット(無ければ従来の手描きにフォールバック): 背景 / 火山 / ドラゴン / ロケット
  // dragon.png は生成2回とも「立ちポーズ+影残り」になり不採用。手描きドラゴンのまま使う(issues参照)。
  api.preload(["bg.jpg","volcano.png","rocket.png"]);
  let volImg=false;   // 今フレーム 画像火山を描いたか(火口の位置が手描きより高くなる)
  let rocks=[],sky=[],shards=[],sparks=[],rings=[],embers=[],smoke=[],motes=[],floats=[],debris=[];
  let groundY,volX,volY,volR,charge=0,armed=false,heat=0,tsec=0,flash=0,flashHue="#ffae3a";
  let count=0,combo=0,comboT=0,shakeMouth=0,fume=0,hsCool=0,introType=null;
  // ⑤ タイミングボーナス: 空てきが中央付近に集まった瞬間に「いまだ!」を出し、そのタイミングでタップすると加点(失敗しても無罰)
  let bonusReadyT=0,bonusHintCd=6;
  // stage progression: clear a quota of targets per stage, then "ステージ クリア!"; endless harder loop
  let stage=1,stageKill=0,stageGoal=12,clearT=0,clearStage=0,endingT=0,megaT=0;
  const STAGES=5;
  const TC=["#ff5b2e","#ffb73f","#ff3b6b","#ffd23f","#ff7a2e","#ff4d4d"];
  // per-stage sky palette so each stage looks different (dusk -> deep night -> dawn)
  const STAGE_BG=[
    {top:"#3a1a55",mid:"#7a2a44",low:"#c2502a",glow:"#ff9a3a"},
    {top:"#1a1140",mid:"#4a1f4a",low:"#a83a2e",glow:"#ff7a2e"},
    {top:"#0a0820",mid:"#2a0f33",low:"#7a2422",glow:"#ff5b2e"},
    {top:"#2a0f2a",mid:"#5a1f33",low:"#b04a22",glow:"#ffb050"},
    {top:"#401040",mid:"#8a2a3a",low:"#d2602a",glow:"#ffd23f"}
  ];
  function curBg(){return STAGE_BG[(stage-1)%STAGE_BG.length];}
  function stageGoalFor(s){return 12+(s-1)*4;}   // 12,16,20,24,28（7〜8歳向けに手応えを2〜3割増やした）
  // 火口の位置: 画像火山はコーンが高いので火口も上へ(岩・火の粉の出どころを揃える)
  function craterY(){return volImg?groundY-volR*1.15:volY-volR*0.7;}
  // stage unlocks: each new stage introduces a brand-new sky target ("next is what?" hook)
  const UNLOCK_TYPE={2:"blimp",3:"star",4:"dragon",5:"rocket"};
  const UNLOCK_NAME={2:"ひこうせん",3:"ながれぼし",4:"ドラゴン",5:"ロケット"};
  // hitStop guard: only fire on big moments, with a 30-frame cooldown (avoid freeze from same-frame chains)
  function tryHitStop(f){ if(hsCool<=0){ api.hitStop(f); hsCool=30; } }

  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマー/トラックと同じ思想) ----
  const SKYCOLS=["#7be0ff","#ffd23f","#ff7bd0","#b58bff","#9be88a"];
  const COLNAME={"#7be0ff":"みずいろ","#ffd23f":"きいろ","#ff7bd0":"ピンク","#b58bff":"むらさき","#9be88a":"みどり"};
  // ② きょうのラッキー色: この回だけの秘密の1色。その色の空てきを落とすと小ボーナス＋頭上に星のキラッ
  let luckyColor=pick(SKYCOLS),luckySeen=false,luckyMsgT=0;
  // ① にじいろ(激レア)発見バナー
  let rbMsgT=0;
  // ③ ノンストップ判定: このステージ コンボを切らさず走り切ったら祝福ボーナス
  let comboKept=true;
  // ④ ひみつ: お月さまタップ(ふんかはそのまま/減点なしのごほうび)
  let moon={x:0,y:0,r:0,wink:0,seen:false,cool:0};

  function layout(){
    groundY=api.H*0.82;
    volR=clamp(Math.min(api.W,api.H)*0.16,60,150);
    volX=api.W*0.5;
    volY=groundY+volR*0.1;
    // sky targets float across the upper area (above HUD danger zone)
    sky.forEach(s=>{ if(s.y<api.H*0.12) s.y=api.H*0.14; });
    // ④ お月さま: 上部やや左(四隅UI帯 y<56 を避けて y>=70)。ボリューム(中央)とも重ならない
    moon.x=clamp(api.W*0.2,80,api.W*0.42);moon.y=Math.max(70,api.H*0.15);moon.r=clamp(api.W*0.05,22,40);
    buildAmbient();
  }
  function buildAmbient(){
    motes=[];for(let i=0;i<26;i++)motes.push({x:rnd(0,api.W),y:rnd(0,groundY),r:rnd(0.8,2.4),sp:rnd(0.1,0.5),tw:rnd(0,TAU)});
    smoke=[];
  }
  layout();

  function rockGain(){ return combo>=8?3:combo>=4?2:1; }

  // spawn a flying rock from the volcano mouth
  // aimX: タップx座標(火山との左右位置)。あれば飛ぶ向きをそちらへ寄せる(狙う操作)。無ければ従来の広い乱数(megaEruptのご褒美演出用)
  function spawnRock(power,aimX){
    const big=power>0.7;
    // 軸3 指摘1(狙いバイアスを±0.2→±0.35〜0.4に広げる)は実測の結果 見送り。
    // N=20実測: ±0.38まで広げるとタップ計測のmissRateはむしろ下がり(28%→26%=当たりやすくなる)、
    // --dragのfirstScoreSec中央値は2.25秒→3.2秒超まで悪化し合格線(3秒)を割った(over3s多発)。
    // 原因: _playtest.jsの入力モデルは画面中央寄りに偏るため、バイアスを広げるほど通常のタップの弾道が
    // 横に伸びて的の先まで飛び越えやすくなり、狙いの効果より「素通り/的中の両方が増減する」ノイズが勝った。
    // 代わりに buildBuildings/hitBuilding 側の「ステージ2以降だけ遠ざけて狭める」方式で歯ごたえを作る。
    const ang=(aimX==null)?(-TAU/4+rnd(-0.55,0.55))
      :(-TAU/4+clamp((aimX-volX)/(api.W*0.5),-0.2,0.2)+rnd(-0.06,0.06));
    const spd=rnd(9,15)*(0.7+power*0.9);
    rocks.push({x:volX+rnd(-volR*0.25,volR*0.25),y:craterY(),
      vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
      r:big?rnd(14,22):rnd(9,15),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),
      hot:1,life:1,big:big,col:pick(TC),seed:rnd(0,99)});
  }
  // floating sky targets (clouds/balloons/buildings to smash)
  function spawnSky(){
    if(sky.length>=7+stage)return;   // 7〜8歳向け: 空の的を1つ多く
    const types=["balloon","cloud","ufo"];
    if(stage>=2)types.push("blimp");
    if(stage>=3)types.push("star");
    if(stage>=4)types.push("dragon");
    if(stage>=5)types.push("rocket");
    // guaranteed debut spawn of the newly unlocked type right after a stage clear
    let type,debut=false;
    if(introType&&types.indexOf(introType)>=0){type=introType;introType=null;debut=true;}
    else type=pick(types);
    // ① にじいろ(激レア 約3.5%): 金より珍しい大当たり。虹色に光り、落とすと虹の大盤振る舞い＋大量得点。stage2以降。
    const rainbow=(stage>=2)&&Math.random()<0.035;
    // rare GOLD target (8%): glows, jiggles, huge bonus on kill
    const gold=!rainbow&&Math.random()<0.08;
    const fromLeft=Math.random()<0.5;
    const y=rnd(api.H*0.14,groundY*0.55);
    const r=rainbow?rnd(24,32):type==="blimp"?rnd(30,44):type==="dragon"?rnd(24,32):rnd(20,32);
    let sp=rnd(0.6,1.5)*(1+(stage-1)*0.15);   // 7〜8歳向け: 少し速く
    if(rainbow)sp*=1.05; else if(type==="star")sp*=1.5; else if(type==="rocket")sp*=2.1; else if(type==="dragon")sp*=0.7;
    const hp=rainbow?1:type==="blimp"?2:type==="dragon"?4:1; // にじいろは一撃で パッと ごほうび / ドラゴンは4発
    const s={type,x:fromLeft?-r:api.W+r,y,r,
      vx:(fromLeft?1:-1)*sp,hp,maxhp:hp,gold,rainbow,
      bob:rnd(0,TAU),col:rainbow?"#ff5da2":gold?"#ffd23f":pick(SKYCOLS),
      hit:0,_dead:false};
    sky.push(s);
    if(rainbow){ // にじいろ登場: 高い予告チャイム(端から予告シェブロンも出る)
      api.tone(1318,0.1,"triangle",0.1);api.tone(1760,0.12,"triangle",0.09);api.tone(2349,0.14,"triangle",0.08);
      floats.push({x:clamp(s.x,80,api.W-80),y:s.y-28,txt:"にじいろ が きた！",life:1,vy:-0.5,col:"#ff5da2",size:24});
    }else if(gold){ // sparkle chime so kids look up ("!")
      api.tone(1568,0.1,"triangle",0.1);api.tone(2093,0.16,"triangle",0.09);
      floats.push({x:clamp(s.x,70,api.W-70),y:s.y-26,txt:"ゴールド！",life:1,vy:-0.5,col:"#ffd23f",size:26});
    }else if(debut){ // announce the brand-new target
      floats.push({x:clamp(s.x,80,api.W-80),y:s.y-26,txt:"あたらしい なかま！",life:1,vy:-0.5,col:"#7be0ff",size:24});
      api.tone(880,0.12,"triangle",0.1);
    }
  }
  // ground buildings the rocks can crush
  // 軸7: 形の違うビル(塔/ドーム/横広)を混ぜる。大きい建物だけ「倒れる」演出にする
  const BTYPES=["tower","dome","wide"];
  function buildBuildings(){
    debris=[];
    const n=clamp(Math.floor(api.W/130),3,7);
    // 軸3 指摘3: ステージ1だけは低学年がすぐ当てられる近さを残し(軸1のfirstScoreSecを守る)、
    // ステージ2以降は火山まわりの空き半径を1.4→1.9に広げてビルを遠ざけ、狙いのない連打では届きにくくする。
    // (2.0以上はスマホ縦幅375〜480px相当でビルが0棟になり軸7が崩れるため1.9止まり)
    const hard=stage>=2, kc=hard?1.9:1.4;
    for(let i=0;i<n;i++){
      const bx=api.W*((i+0.5)/n);
      if(Math.abs(bx-volX)<volR*kc)continue; // keep clear of volcano
      const type=pick(BTYPES);   // 軸7: ステージごとに並び順をシャッフル(再配置後の見た目の単調さを減らす)
      const w=type==="tower"?rnd(24,34):type==="dome"?rnd(38,50):rnd(50,70);
      const h=type==="tower"?rnd(api.H*0.10,api.H*0.20):type==="dome"?rnd(api.H*0.07,api.H*0.13):rnd(api.H*0.05,api.H*0.09);
      debris.push({x:bx,h,w,type,tightHit:hard,
        col:pick(["#5a4a6a","#4a3a5a","#6a4a5a"]),hp:2,hit:0,tilt:0,falling:false,_dead:false});
    }
  }
  buildBuildings();

  function burst(x,y,col,n,big){
    rings.push({x,y,r:big?18:10,vr:big?7:4.5,life:1,decay:0.06,col});
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(2,big?9:6);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(2,big?6:4),
        life:1,decay:rnd(0.02,0.04),col:i%3===0?"#ffd23f":i%3===1?col:"#fff"});}
    for(let i=0;i<(big?5:3);i++)smoke.push({x:x+rnd(-8,8),y:y+rnd(-8,8),r:rnd(8,18),
      vr:rnd(0.6,1.4),vy:-rnd(0.4,1.2),life:1,decay:rnd(0.012,0.022)});
  }
  function shatter(x,y,col){
    for(let i=rint(5,8);i>0;i--){const a=rnd(0,TAU),s=rnd(3,8);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(5,12),col,
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.02)});}
  }

  function killSky(s){
    s._dead=true;
    const isRainbow=s.rainbow;
    // ② ラッキー色: 秘密の色の空てき(金/にじ以外)を落とすと +1 の隠しボーナス
    const isLucky=!isRainbow&&!s.gold&&s.col===luckyColor;
    const bonus=(s.gold?7:0)+(isRainbow?10:0)+(s.type==="dragon"?2:0)+(isLucky?1:0);
    const gain=rockGain()+bonus;
    count+=gain;stageKill++;combo++;comboT=1;api.setScore(count);
    burst(s.x,s.y,s.col,isRainbow?20:s.gold?18:12,true);shatter(s.x,s.y,s.col);
    api.slide(420,140,0.16,0.3,"square");api.noise(0.14,0.2,1600);
    api.tone(520*Math.pow(2,clamp(combo,0,10)/12),0.12,"triangle",0.12);
    if(isRainbow){
      rainbowBurst(s.x,s.y,gain);
    }else if(s.gold){
      // rainbow spark shower + fanfare: the jackpot moment
      for(let i=0;i<14;i++){const a=rnd(0,TAU),sp2=rnd(3,9);
        sparks.push({x:s.x,y:s.y,vx:Math.cos(a)*sp2,vy:Math.sin(a)*sp2-2,r:rnd(3,7),life:1,
          decay:rnd(0.012,0.02),col:pick(["#ff5b5b","#ffd23f","#4db8ff","#7be08a","#ff7bd0","#b58bff"])});}
      [0,4,7,12].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.16,"triangle",0.12),i*60));
      floats.push({x:clamp(s.x,70,api.W-70),y:s.y-46,txt:"ゴールド！ +"+gain,life:1,vy:-0.8,col:"#ffd23f",size:32});
      api.boom(0.6);api.shake(12);tryHitStop(4);
      flash=Math.min(1,flash+0.6);flashHue="#ffd23f";
    }else{
      if(s.type==="dragon")floats.push({x:clamp(s.x,80,api.W-80),y:s.y-46,txt:"ドラゴン たいじ！ +"+gain,life:1,vy:-0.8,col:"#7be08a",size:28});
      api.boom(0.4);api.shake(7);
      if(combo===4||combo===8||s.type==="dragon")tryHitStop(3);
      flash=Math.min(1,flash+0.4);flashHue=s.col;
    }
    if(isLucky)luckySparkle(s.x,s.y);
    if(combo>1)floats.push({x:clamp(s.x,70,api.W-70),y:s.y-70,txt:"x"+combo,life:1,vy:-1.1,
      col:combo>=8?"#ff2bff":combo>=4?"#ff8c42":"#ffd23f",size:combo>=4?40:30});
    checkStage();
  }
  // ① にじいろ撃破: 虹の輪＋虹の火花＋ファンファーレの大盤振る舞い(激レアの爽快ごほうび)
  function rainbowBurst(x,y,gain){
    rbMsgT=1.4;
    const RB=["#ff5da2","#ffd23f","#5ad1ff","#7be08a","#9b6bff"];
    for(let k=0;k<RB.length;k++)rings.push({x,y,r:12+k*4,vr:5+k*1.1,life:1,decay:0.05,col:RB[k]});
    for(let i=0;i<24;i++){const a=rnd(0,TAU),sp2=rnd(3,10);
      sparks.push({x,y,vx:Math.cos(a)*sp2,vy:Math.sin(a)*sp2-2,r:rnd(3,7),life:1,
        decay:rnd(0.01,0.02),col:pick(RB.concat(["#ff8c42","#fff"]))});}
    if(sparks.length>140)sparks.splice(0,sparks.length-140);
    [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.16,"triangle",0.11),i*55));
    floats.push({x:clamp(x,80,api.W-80),y:y-46,txt:"にじいろ！ +"+gain,life:1,vy:-0.8,col:"#ff5da2",size:32});
    api.boom(0.6);api.shake(14);tryHitStop(4);
    flash=Math.min(0.9,flash+0.5);flashHue="#ff8cd0";   // 白飛び防止に控えめ上限
  }
  // ② ラッキー色 命中: 控えめの祝福＋頭上に小さな星のキラッ(初回だけ中央にヒント)
  function luckySparkle(x,y){
    api.tone(1046,0.12,"triangle",0.11);api.tone(1568,0.14,"triangle",0.08);
    for(let i=0;i<8;i++){const a=rnd(-TAU/2,0),sp2=rnd(2,5);
      sparks.push({x,y:y-6,vx:Math.cos(a)*sp2,vy:Math.sin(a)*sp2-1.5,r:rnd(2,4),life:1,decay:rnd(0.02,0.03),col:luckyColor});}
    if(!luckySeen){luckySeen=true;luckyMsgT=1.8;}else luckyMsgT=Math.max(luckyMsgT,0.7);
    floats.push({x:clamp(x,70,api.W-70),y:y-30,txt:"ラッキー！",life:1,vy:-0.7,col:luckyColor,size:24});
  }
  // 小さな4点星(ラッキー色ヒント用)
  function drawTwinkle(cx,cy,r){
    r=Math.max(0.5,r);
    g.beginPath();
    for(let i=0;i<8;i++){const a=i/8*TAU-TAU/4,rr=(i%2===0)?r:r*0.4;
      const px=cx+Math.cos(a)*rr,py=cy+Math.sin(a)*rr;
      if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}
    g.closePath();g.fill();
  }
  // ④ お月さま(発見のごほうび源): 上部やや左。タップで ウインク＋きんの こな
  function drawMoon(){
    const mx=moon.x,my=moon.y,mr=Math.max(6,moon.r);
    g.save();
    // soft halo (source-over で 加算たまりを避ける)
    const gl=g.createRadialGradient(mx,my,0,mx,my,mr*2.4);
    gl.addColorStop(0,"rgba(255,245,210,0.28)");gl.addColorStop(1,"rgba(255,245,210,0)");
    g.fillStyle=gl;g.beginPath();g.arc(mx,my,mr*2.4,0,TAU);g.fill();
    // body
    g.fillStyle="#f7ecc8";g.beginPath();g.arc(mx,my,mr,0,TAU);g.fill();
    // craters
    g.fillStyle="rgba(198,178,138,0.5)";
    g.beginPath();g.arc(mx-mr*0.3,my-mr*0.2,mr*0.18,0,TAU);g.arc(mx+mr*0.25,my+mr*0.28,mr*0.13,0,TAU);
    g.arc(mx+mr*0.1,my-mr*0.35,mr*0.1,0,TAU);g.fill();
    // wink face on discovery (^_^)
    if(moon.wink>0){
      g.strokeStyle="#b89a5a";g.lineWidth=Math.max(2,mr*0.12);g.lineCap="round";g.globalAlpha=clamp(moon.wink*1.4,0,1);
      g.beginPath();
      g.moveTo(mx-mr*0.44,my-mr*0.04);g.quadraticCurveTo(mx-mr*0.29,my-mr*0.32,mx-mr*0.14,my-mr*0.04);
      g.moveTo(mx+mr*0.14,my-mr*0.04);g.quadraticCurveTo(mx+mr*0.29,my-mr*0.32,mx+mr*0.44,my-mr*0.04);
      g.stroke();
      g.beginPath();g.arc(mx,my+mr*0.14,mr*0.34,0.12*Math.PI,0.88*Math.PI);g.stroke();
      g.globalAlpha=1;
    }
    g.restore();
  }
  function moonTap(){
    moon.wink=1;
    if(moon.cool>0)return;              // 連打farm防止: 見た目のウインクだけ返す
    moon.cool=40;
    count+=1;api.setScore(count);       // 小さなコイン(減点なし)
    api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.08);
    for(let i=0;i<8;i++){const a=rnd(-TAU/2,0),sp2=rnd(2,5);
      sparks.push({x:moon.x,y:moon.y,vx:Math.cos(a)*sp2,vy:Math.sin(a)*sp2-1,r:rnd(2,4),life:1,decay:0.02,
        col:pick(["#ffd23f","#fff0a0","#ffe08a"])});}
    if(!moon.seen){moon.seen=true;
      floats.push({x:clamp(moon.x,70,api.W-70),y:moon.y-moon.r-14,txt:"おつきさま！",life:1,vy:-0.6,col:"#ffe08a",size:22});}
  }
  function hitBuilding(b,x,y){
    b.hit=1;b.hp--;
    burst(x,y,"#caa",8,false);
    api.noise(0.12,0.18,900,"lowpass");api.tone(180,0.08,"square",0.1);api.shake(5);
    for(let i=0;i<6;i++)smoke.push({x:b.x+rnd(-b.w/2,b.w/2),y:groundY-rnd(0,b.h),r:rnd(8,16),
      vr:rnd(0.6,1.2),vy:-rnd(0.4,1),life:1,decay:0.02});
    if(b.hp<=0&&!b.falling){
      // 軸3 指摘2: 地上ビルの得点だけ下げ、ばらまきより空の的を狙う方が明確に得になるようにする(空の的の得点式は変えない)
      const gain=Math.max(1,Math.ceil(rockGain()*0.6));count+=gain;stageKill++;combo++;comboT=1;api.setScore(count);
      api.boom(0.5);api.shake(10);tryHitStop(3);flash=Math.min(1,flash+0.45);flashHue="#ffb73f";
      api.slide(300,90,0.3,0.3,"sawtooth");
      if(combo>1)floats.push({x:b.x,y:groundY-b.h,txt:"x"+combo,life:1,vy:-1.1,
        col:combo>=4?"#ff8c42":"#ffd23f",size:combo>=4?40:30});
      // 軸7: 大きい建物(画面高さの12%以上)は数フレームかけて倒れてから消える。小さい建物は現状どおり即シャッター
      if(b.h>=api.H*0.12){
        b.falling=true;
      }else{
        b._dead=true;shatter(b.x,groundY-b.h*0.5,b.col);burst(b.x,groundY-b.h*0.4,"#fff",14,true);
      }
      checkStage();
    }
  }

  function checkStage(){
    if(stageKill<stageGoal||clearT>0||endingT>0)return;
    if(stage>=STAGES){
      endingT=2.6;flash=1;flashHue="#ffd23f";api.boom(0.7);api.shake(20);
      api.slide(523,1046,0.5,0.22,"triangle");
    }else{
      clearStage=stage;clearT=1.7;flash=0.8;flashHue="#ffd23f";api.boom(0.5);api.shake(13);
      api.slide(523,784,0.3,0.2,"triangle");api.tone(660,0.25,"triangle",0.14);
      for(let i=0;i<24;i++){const a=rnd(0,TAU),s=rnd(3,9);
        sparks.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,8),
          life:1,decay:rnd(0.012,0.02),col:pick(TC)});}
      // ③ ノンストップ ボーナス: このステージ コンボを切らさず走り切ったら +4 & みどりの星シャワー
      if(comboKept){count+=4;api.setScore(count);
        floats.push({x:api.W/2,y:api.H*0.56,txt:"ノンストップ！ ＋4",life:1,vy:-0.7,col:"#7be08a",size:30});
        for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(3,8);
          sparks.push({x:api.W/2,y:api.H*0.44,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,7),
            life:1,decay:rnd(0.012,0.02),col:"#7be08a"});}
        api.tone(1318,0.16,"triangle",0.1);}
      stage++;stageGoal=stageGoalFor(stage);stageKill=0;buildAmbient();
      buildBuildings();   // 軸7: ステージクリアごとに地上の建物を再配置(序盤で壊し切ると以降ずっと出ない問題への対策)
      introType=UNLOCK_TYPE[stage]||null;comboKept=true;   // 次ステージのノンストップ判定をリセット
    }
  }

  // big eruption: many rocks at once
  // aimX: タップx(火山との左右位置)。狙った側へ岩が飛ぶ(軸3: 連打一辺倒からの脱却)
  function erupt(power,aimX){
    fume=1;shakeMouth=1;
    const n=Math.round(3+power*10);
    for(let i=0;i<n;i++)spawnRock(power,aimX);
    api.slide(160,40,0.4+0.3*power,0.5,"sine");
    api.noise(0.4+0.4*power,0.35,500,"lowpass",0.7);
    api.boom(0.4+0.3*power);api.shake(8+power*14);
    const cy=craterY();
    for(let i=0;i<Math.round(8+power*16);i++)embers.push({x:volX+rnd(-volR*0.4,volR*0.4),y:cy+volR*0.1,
      vx:rnd(-3,3),vy:-rnd(5,12)*(0.6+power),r:rnd(2,5),life:1,decay:rnd(0.01,0.02),col:pick(TC)});
    for(let i=0;i<6;i++)smoke.push({x:volX+rnd(-volR*0.4,volR*0.4),y:cy,r:rnd(14,28),
      vr:rnd(0.8,1.8),vy:-rnd(1,2.4),life:1,decay:0.01});
  }
  function megaErupt(){
    armed=false;charge=0;megaT=1;fume=1.5;shakeMouth=1.4;flash=1;flashHue="#ff5b2e";
    api.slide(120,38,0.9,0.7,"sine");api.noise(0.7,0.5,420,"lowpass",0.6);
    api.boom(0.7);api.shake(34);tryHitStop(6);
    for(let i=0;i<32;i++)spawnRock(1);
    const cy=craterY();
    for(let i=0;i<40;i++)embers.push({x:volX+rnd(-volR*0.5,volR*0.5),y:cy+volR*0.1,
      vx:rnd(-6,6),vy:-rnd(8,18),r:rnd(2,6),life:1,decay:rnd(0.008,0.016),col:pick(TC)});
    for(let i=0;i<12;i++)smoke.push({x:volX+rnd(-volR*0.5,volR*0.5),y:cy,r:rnd(20,40),
      vr:rnd(1,2.4),vy:-rnd(1.4,3),life:1,decay:0.008});
  }

  let spawnSkyT=40,tapPulse=0;
  return{
    resize:layout,
    input(x,y,type){
      if(type!=="down")return;
      if(clearT>0||endingT>0)return;
      tapPulse=1;
      if(armed){ megaErupt(); return; }
      // ⑤ タイミングボーナス: 「いまだ!」の直後のタップは追加ボーナス(失敗しても現状通り無罰)
      if(bonusReadyT>0){
        bonusReadyT=0;count+=2;api.setScore(count);
        api.tone(1046,0.12,"triangle",0.12);api.tone(1568,0.12,"triangle",0.09);
        floats.push({x:clamp(x,70,api.W-70),y:clamp(y,60,api.H*0.5)-30,txt:"ナイス！ +2",life:1,vy:-0.8,col:"#7be0ff",size:24});
      }
      // each tap charges the volcano and triggers a small eruption
      charge=clamp(charge+0.16,0,1);
      const pwr=0.25+charge*0.6;
      erupt(pwr,x);   // 軸3: タップx(火山との左右位置)に岩の飛ぶ向きを寄せる → 狙う操作が生まれる
      if(charge>=1){ armed=true; }
      // ④ ひみつ: お月さまタップ = ふんかはそのまま + ウインクして きんの こな(減点なしのごほうび)
      if(moon.r>0&&Math.hypot(x-moon.x,y-moon.y)<moon.r*1.3)moonTap();
    },
    frame(dt,now){
      tsec+=0.016*dt;
      if(hsCool>0)hsCool-=dt;
      if(shakeMouth>0)shakeMouth=Math.max(0,shakeMouth-0.04*dt);
      if(fume>0)fume=Math.max(0,fume-0.02*dt);
      if(tapPulse>0)tapPulse=Math.max(0,tapPulse-0.06*dt);
      if(moon.wink>0)moon.wink=Math.max(0,moon.wink-0.02*dt);
      if(moon.cool>0)moon.cool-=dt;
      if(bonusReadyT>0)bonusReadyT=Math.max(0,bonusReadyT-0.016*dt);
      if(bonusHintCd>0)bonusHintCd-=0.016*dt;
      if(heat<charge)heat+=0.02*dt; else heat=charge;
      const paused=clearT>0||endingT>0;
      const bg=curBg();

      // 画像火山が使えるか(火口位置に効く)を毎フレーム確認(読み込みは非同期)
      volImg=!!(api.asset("volcano.png").ready);
      // 画像背景(cover): ステージ2以降はパレット色を薄く重ねて面ごとの雰囲気を変える。無ければ従来の空グラデ
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        if(stage>1){g.save();g.globalAlpha=0.24;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,bg.top);tg.addColorStop(0.5,bg.mid);tg.addColorStop(1,bg.low);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        // sky gradient (dusk/night over a volcanic land)
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,bg.top);grd.addColorStop(0.42,bg.mid);
        grd.addColorStop(0.74,bg.low);grd.addColorStop(1,"#2a0f10");
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }

      // hot horizon glow rising from the volcano
      let hg=g.createRadialGradient(volX,groundY,0,volX,groundY,api.W*0.7);
      hg.addColorStop(0,"rgba(255,120,40,0.4)");hg.addColorStop(0.4,"rgba(255,90,30,0.16)");hg.addColorStop(1,"rgba(255,90,30,0)");
      g.save();g.globalCompositeOperation="lighter";g.fillStyle=hg;g.fillRect(0,0,api.W,api.H);g.restore();

      // twinkle stars in the upper sky
      for(let i=0;i<20;i++){const px=((i*97+13)%100)/100*api.W,py=((i*61+7)%100)/100*api.H*0.4;
        const tw=0.2+0.5*Math.sin(tsec*2+i*1.6);g.globalAlpha=Math.max(0,tw)*0.7;
        g.fillStyle="#fff6d6";g.beginPath();g.arc(px,py,1.2,0,TAU);g.fill();}
      g.globalAlpha=1;

      // ④ お月さま(ひみつタップの発見源) — 星の上に描く
      drawMoon();

      // drifting motes (ash specks)
      g.fillStyle="#ffcf9a";
      for(const m of motes){m.x+=m.sp*0.3*dt;m.y-=m.sp*0.15*dt;m.tw+=0.05*dt;
        if(m.x>api.W)m.x=0;if(m.y<0)m.y=groundY;
        g.globalAlpha=0.08+0.12*(0.5+0.5*Math.sin(m.tw));
        g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();}
      g.globalAlpha=1;

      // distant mountain silhouettes ※画像背景のときは絵の山を活かして描かない
      if(!imgBg){
        g.fillStyle="rgba(20,8,16,0.6)";
        for(let i=0;i<5;i++){const mx=api.W*(i/4),mw=api.W*0.36,mh=api.H*(0.1+((i*37)%5)*0.02);
          g.beginPath();g.moveTo(mx-mw/2,groundY);g.lineTo(mx,groundY-mh);g.lineTo(mx+mw/2,groundY);g.closePath();g.fill();}
      }

      // ground (dark volcanic rock with lava cracks) ※地面の帯は画像背景と喧嘩するので画像時はスキップ(溶岩のひびは残す)
      if(!imgBg){
        let gg=g.createLinearGradient(0,groundY,0,api.H);
        gg.addColorStop(0,"#3a1810");gg.addColorStop(1,"#160606");
        g.fillStyle=gg;g.fillRect(0,groundY,api.W,api.H-groundY);
      }
      g.save();g.globalCompositeOperation="lighter";g.strokeStyle="rgba(255,90,30,0.5)";g.lineWidth=2;
      for(let i=0;i<6;i++){const lx=api.W*((i+0.5)/6);
        g.globalAlpha=0.3+0.3*Math.sin(tsec*2+i);
        g.beginPath();g.moveTo(lx,groundY+6);g.lineTo(lx+rnd(-6,6),api.H);g.stroke();}
      g.restore();g.globalAlpha=1;

      // ground buildings (behind volcano)
      for(const b of debris){
        if(b.hit>0)b.hit=Math.max(0,b.hit-0.06*dt);
        if(b.falling){
          // 軸7: 大きい建物は倒れてから消える(小さい建物は即シャッターのまま=壊れ方の違い)
          b.tilt=Math.min(0.3,b.tilt+0.05*dt);
          if(b.tilt>=0.3){
            shatter(b.x,groundY-b.h*0.5,b.col);burst(b.x,groundY-b.h*0.4,"#fff",14,true);
            b._dead=true;continue;
          }
        }
        const dir=b.x<volX?-1:1;   // 火山から外向きに倒れる
        const x=-b.w/2,y=-b.h;
        g.save();g.translate(b.x,groundY);g.rotate(b.tilt*dir);
        g.fillStyle="rgba(0,0,0,.3)";drawBuildingShape(b.type,x+3,y+3,b.w,b.h);
        g.fillStyle=b.hp<=1?"#7a5a6a":b.col;drawBuildingShape(b.type,x,y,b.w,b.h);
        // windows lit by lava
        g.fillStyle="rgba(255,180,80,0.5)";
        for(let wy=y+8;wy<-8;wy+=14)for(let wx=x+6;wx<x+b.w-6;wx+=12)
          if(((wx*3+wy*5)|0)%4<2)g.fillRect(wx,wy,5,7);
        if(b.hp<=1){g.strokeStyle="rgba(20,10,10,.7)";g.lineWidth=2;
          g.beginPath();g.moveTo(x+b.w*0.3,y);g.lineTo(x+b.w*0.5,y+b.h*0.5);g.lineTo(x+b.w*0.35,b.h+y);g.stroke();}
        if(b.hit>0){g.save();g.globalAlpha=b.hit*0.6;g.fillStyle="#fff";drawBuildingShape(b.type,x,y,b.w,b.h);g.restore();}
        g.restore();
      }
      debris=debris.filter(b=>!b._dead);

      // sky targets
      if(!paused){spawnSkyT-=dt;if(spawnSkyT<=0){spawnSky();spawnSkyT=clamp(62-(stage-1)*7,30,62);}}   // 7〜8歳向け: 少し速く出る
      for(const s of sky){
        if(s.hit>0)s.hit=Math.max(0,s.hit-0.08*dt);
        if(!paused){
          s.x+=s.vx*dt;s.bob+=0.05*dt*(s.type==="star"?2:1);
          // rocket flame trail / gold sparkle trail (cheap, capped below)
          if(s.type==="rocket"&&Math.random()<0.35)sparks.push({x:s.x-(s.vx>0?1:-1)*s.r,y:s.y,
            vx:-s.vx*0.4,vy:rnd(-0.5,0.5),r:rnd(2,4),life:0.6,decay:0.05,col:"#ff8c42"});
          if(s.gold&&Math.random()<0.2)sparks.push({x:s.x+rnd(-s.r,s.r),y:s.y+rnd(-s.r,s.r),
            vx:0,vy:-0.5,r:rnd(1.5,3),life:0.7,decay:0.04,col:"#ffd23f"});
        }
        if(s.x<-s.r*2||s.x>api.W+s.r*2)s._dead=true;
        drawSky(s);
      }
      sky=sky.filter(s=>!s._dead);

      // ⑤ タイミングヒント: 空てきが画面中央付近に集まった瞬間に「いまだ!」を出す(狙うと得なタイミングの可視化)
      if(!paused&&bonusReadyT<=0&&bonusHintCd<=0){
        const near=sky.filter(s=>!s.rainbow&&Math.abs(s.x-volX)<api.W*0.26);
        if(near.length>=1){
          bonusReadyT=0.9;bonusHintCd=rnd(6,10);
          const hx=near.reduce((a,s2)=>a+s2.x,0)/near.length;
          floats.push({x:clamp(hx,70,api.W-70),y:api.H*0.3,txt:"いまだ！",life:0.9,vy:-0.4,col:"#7be0ff",size:22});
          api.tone(988,0.08,"triangle",0.08);
        }
      }

      // ---- VOLCANO ----
      drawVolcano();

      // embers shooting up from the mouth
      g.save();g.globalCompositeOperation="lighter";
      for(const e of embers){e.vy+=0.25*dt;e.x+=e.vx*dt;e.y+=e.vy*dt;e.life-=e.decay*dt;
        g.globalAlpha=Math.max(0,e.life);g.fillStyle=e.col;g.shadowBlur=8;g.shadowColor=e.col;
        g.beginPath();g.arc(e.x,e.y,e.r,0,TAU);g.fill();}
      g.shadowBlur=0;g.restore();g.globalAlpha=1;
      embers=embers.filter(e=>e.life>0&&e.y<api.H+20);

      // ---- flying rocks: check collisions with sky + buildings ----
      for(const r of rocks){
        r.vy+=0.32*dt;r.x+=r.vx*dt;r.y+=r.vy*dt;r.rot+=r.vr*dt;
        if(r.hot>0)r.hot=Math.max(0,r.hot-0.01*dt);
        // hit sky targets
        for(const s of sky){
          if(s._dead)continue;
          if(Math.hypot(r.x-s.x,r.y-s.y)<r.r+s.r){
            s.hit=1;s.hp--;burst(r.x,r.y,r.col,6,false);r.life=0;
            if(s.hp<=0)killSky(s); else {api.tone(300,0.06,"square",0.08);api.shake(3);}
            break;
          }
        }
        if(r.life<=0)continue;
        // hit ground / buildings
        if(r.y>groundY-r.r*0.5){
          let crushed=false;
          for(const b of debris){
            if(b._dead||b.falling)continue;
            // 軸3 追加策(指摘1の代替): 狙いバイアスは据え置いた代わりに、ステージ2以降の遠ざけたビルだけ当たり判定を幅の6割に狭める。
            // ステージ1のビルは判定そのまま(軸1のfirstScoreSecを崩さない)。
            if(Math.abs(r.x-b.x)<b.w*(b.tightHit?0.6:1)/2+r.r&&r.y>groundY-b.h-r.r){hitBuilding(b,r.x,groundY-b.h*0.5);crushed=true;break;}
          }
          burst(r.x,groundY-2,"#caa",5,false);
          for(let i=0;i<3;i++)smoke.push({x:r.x+rnd(-6,6),y:groundY-rnd(0,8),r:rnd(6,12),vr:rnd(0.5,1),vy:-rnd(0.3,0.8),life:1,decay:0.02});
          if(!crushed){api.noise(0.08,0.1,700,"lowpass");}
          r.life=0;
        }
      }
      // draw rocks
      for(const r of rocks){ if(r.life<=0)continue; drawRock(r); }
      rocks=rocks.filter(r=>r.life>0&&r.y<api.H+40&&r.x>-60&&r.x<api.W+60);
      if(rocks.length>120)rocks.splice(0,rocks.length-120);

      // smoke puffs
      for(const s of smoke){s.r+=s.vr*dt;s.y+=s.vy*dt;s.life-=s.decay*dt;
        g.globalAlpha=Math.max(0,s.life)*0.4;g.fillStyle="#7a6a66";
        g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();}
      g.globalAlpha=1;smoke=smoke.filter(s=>s.life>0);
      if(smoke.length>80)smoke.splice(0,smoke.length-80);

      // shards
      for(const p of shards){p.vy+=0.45*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        g.fillStyle=p.col;g.fillRect(-p.s/2,-p.s/2,p.s,p.s);
        g.fillStyle="rgba(0,0,0,.3)";g.fillRect(0,0,p.s/2,p.s/2);g.restore();}
      g.globalAlpha=1;shards=shards.filter(p=>p.life>0);

      // shockwave rings
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=2+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);

      // glowing sparks
      g.save();g.globalCompositeOperation="lighter";
      for(const s of sparks){s.vy+=0.2*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=s.decay*dt;
        g.globalAlpha=Math.max(0,s.life);g.fillStyle=s.col;g.shadowBlur=8;g.shadowColor=s.col;
        g.beginPath();g.arc(s.x,s.y,s.r*Math.max(0,s.life)+0.5,0,TAU);g.fill();}
      g.shadowBlur=0;g.restore();g.globalAlpha=1;sparks=sparks.filter(s=>s.life>0);
      if(sparks.length>140)sparks.splice(0,sparks.length-140);

      // floats (combo numbers)  ※コンボが途切れたら ③ノンストップ判定は失敗
      if(combo>0){comboT-=0.016*dt;if(comboT<=0){combo=0;comboKept=false;}}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.018*dt;
        g.globalAlpha=Math.max(0,f.life);g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.textAlign="center";g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);

      // heat-haze shimmer band above the volcano (cheap wobble overlay)
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.05+heat*0.05;
      const hb=g.createLinearGradient(0,volY-volR*2,0,volY);
      hb.addColorStop(0,"rgba(255,120,40,0)");hb.addColorStop(1,"rgba(255,120,40,0.5)");
      g.fillStyle=hb;g.fillRect(volX-volR*1.5,volY-volR*2,volR*3,volR*2);g.restore();g.globalAlpha=1;

      // charge / power bar (bottom-center safe band)
      drawPower();

      // impact flash
      if(flash>0){flash-=0.06*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa*0.3;g.fillStyle=flashHue;
        g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}

      // mega eruption white flash
      if(megaT>0){g.save();g.globalAlpha=megaT*0.5;g.fillStyle="#fff";g.fillRect(0,0,api.W,api.H);g.restore();
        megaT-=0.05*dt;if(megaT<0)megaT=0;}

      // ① にじいろ接近の予告: 端から入ってくる にじいろを ふちの矢印で知らせる(次くるかも のドキドキ)
      for(const s of sky){ if(!s.rainbow||s._dead)continue;
        const fromLeft=s.vx>0, near=fromLeft?s.x<api.W*0.24:s.x>api.W*0.76;
        if(!near)continue;
        const yy=api.H*0.45, pulse=0.5+0.5*Math.sin(tsec*8), dir=fromLeft?1:-1;
        const RB=["#ff5da2","#ffd23f","#5ad1ff"];
        g.save();g.globalAlpha=0.5+0.4*pulse;g.lineWidth=5;g.lineCap="round";g.lineJoin="round";
        for(let k=0;k<3;k++){g.strokeStyle=RB[k];
          const ox=fromLeft?(16+k*13):(api.W-16-k*13);
          g.beginPath();g.moveTo(ox,yy-16);g.lineTo(ox+dir*12,yy);g.lineTo(ox,yy+16);g.stroke();}
        g.restore();g.globalAlpha=1;
      }

      // ① にじいろ！ 中央バナー(虹色に色替わり=激レアの大きな祝福)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=["#ff5da2","#ffd23f","#5ad1ff","#7be08a","#9b6bff"][Math.floor(tsec*6)%5];
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 38px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText("にじいろ！",0,0);
        g.shadowColor=col;g.shadowBlur=16;g.fillStyle="#fff";g.fillText("にじいろ！",0,0);
        g.shadowBlur=0;g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 中央ヒント(初回だけ大きく教える)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.28);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(COLNAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyMsgT<0)luckyMsgT=0;}

      // ---- HUD (top-center safe band) ----
      drawHUD();

      // ---- STAGE CLEAR banner ----
      if(clearT>0){clearT-=0.016*dt;const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.5;g.fillStyle="#000";g.fillRect(0,api.H*0.34,api.W,api.H*0.2);g.restore();
        const pop=1+Math.max(0,clearT-1.4)*1.8;
        g.save();g.translate(api.W/2,api.H*0.44);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,150,40,.9)";g.shadowBlur=20;g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア！",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        const nxNm=UNLOCK_NAME[clearStage+1];
        g.fillText(nxNm?("つぎは "+nxNm+"が でてくる！"):("つぎは ステージ"+(clearStage+1)+"！"),0,40);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnSkyT=18;}
      }

      // ---- ENDING (全部クリア) ----
      if(endingT>0){endingT-=0.012*dt;const a=clamp(endingT,0,1);
        g.save();g.globalAlpha=a*0.45;g.fillStyle="#1a0608";g.fillRect(0,0,api.W,api.H);g.restore();
        if(tsec*60%1<dt)sparks.push({x:rnd(0,api.W),y:-10,vx:rnd(-1,1),vy:rnd(2,5),r:rnd(3,7),
          life:1,decay:0.01,col:pick(TC)});
        const pop=1+Math.sin(tsec*7)*0.06;
        g.save();g.translate(api.W/2,api.H*0.42);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 52px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,200,60,1)";g.shadowBlur=26;g.fillStyle="#ffd23f";
        g.fillText("ぜんぶ クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle="#fff";g.strokeText("ぜんぶ クリア！",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("すごい！ もういちど あそべるよ",0,46);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(endingT<=0){endingT=0;stage=1;stageGoal=stageGoalFor(1);stageKill=0;combo=0;comboKept=true;
          charge=0;armed=false;buildAmbient();buildBuildings();spawnSkyT=18;}
      }

      // 白飛び防止の保険: 毎フレームの最後に加算合成を必ず source-over へ戻す
      g.globalCompositeOperation="source-over";
    }
  };

  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=15,bx=(api.W-bw)/2,by=api.H*0.05;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(0,0,0,.6)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+" / "+STAGES+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,0,0,.4)";roundRect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gr=g.createLinearGradient(bx,0,bx+bw,0);
      gr.addColorStop(0,"#ff7a2e");gr.addColorStop(1,"#ffd23f");
      g.fillStyle=gr;roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;roundRect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }

  function drawPower(){
    const w=Math.min(api.W*0.5,240),x=(api.W-w)/2,y=api.H-30,h=16;
    g.save();g.shadowBlur=10;g.shadowColor="rgba(0,0,0,.5)";
    g.fillStyle="rgba(40,12,8,.65)";roundRect(x-5,y-3,w+10,h+6,(h+6)/2);g.fill();g.restore();
    g.lineWidth=2;g.strokeStyle="rgba(255,255,255,.35)";roundRect(x-5,y-3,w+10,h+6,(h+6)/2);g.stroke();
    const fw=w*charge;
    if(fw>2){const pg=g.createLinearGradient(x,0,x+w,0);
      if(armed){pg.addColorStop(0,"#ff3b2e");pg.addColorStop(0.5,"#ff5b6b");pg.addColorStop(1,"#ffd23f");}
      else{pg.addColorStop(0,"#ff7a2e");pg.addColorStop(1,"#ffd23f");}
      g.save();if(armed){g.shadowBlur=14+8*Math.sin(tsec*8);g.shadowColor="#ff3b2e";}
      g.fillStyle=pg;roundRect(x,y,fw,h,h/2);g.fill();g.restore();}
    g.font="800 14px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
    g.lineWidth=4;g.lineJoin="round";g.strokeStyle="rgba(20,8,6,.6)";
    const label=armed?"だいふんか！ タップ！":"チャージ";
    g.save();if(armed){g.shadowBlur=10+5*Math.sin(tsec*8);g.shadowColor="#ffd23f";}
    g.strokeText(label,api.W/2,y-7);g.fillStyle=armed?"#fff":"#ffe0b0";g.fillText(label,api.W/2,y-7);g.restore();
    g.textAlign="left";g.lineJoin="miter";
  }

  function drawVolcano(){
    const shx=shakeMouth>0?rnd(-shakeMouth*4,shakeMouth*4):0;
    g.save();g.translate(shx,0);
    // cone silhouette
    const baseW=volR*2.4;
    g.fillStyle="rgba(0,0,0,.3)";
    g.beginPath();g.ellipse(volX,groundY+volR*0.1,baseW*0.6,volR*0.25,0,0,TAU);g.fill();
    // 画像火山: 底辺を地面に合わせて描く(コーンが手描きより高い→火口 craterY も上に寄る)。
    // 無ければ従来の手描きコーン+溶岩すじ+火口のふち。
    const useImg=volImg&&api.drawAsset("volcano.png",volX,groundY+volR*0.3-volR*0.85,volR*2.8,volR*1.7,{center:true});
    if(!useImg){
    const cg=g.createLinearGradient(0,volY-volR*1.2,0,groundY+volR*0.4);
    cg.addColorStop(0,"#5a2a1a");cg.addColorStop(0.5,"#3a1810");cg.addColorStop(1,"#1a0808");
    g.fillStyle=cg;
    g.beginPath();
    g.moveTo(volX-baseW/2,groundY+volR*0.3);
    g.lineTo(volX-volR*0.55,volY-volR*0.7);
    g.lineTo(volX+volR*0.55,volY-volR*0.7);
    g.lineTo(volX+baseW/2,groundY+volR*0.3);
    g.closePath();g.fill();
    // lava streaks down the slopes
    g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
    for(let i=-1;i<=1;i++){
      g.strokeStyle="rgba(255,90,30,"+(0.5+0.3*Math.sin(tsec*3+i))+")";g.lineWidth=volR*0.08;
      g.beginPath();g.moveTo(volX+i*volR*0.3,volY-volR*0.6);
      g.quadraticCurveTo(volX+i*volR*0.5,volY,volX+i*volR*0.7,groundY);g.stroke();
    }
    g.restore();
    }
    // glowing crater (charge brightens it) — 画像/手描き共通(火口の位置は craterY に従う)
    const gyc=craterY()+volR*0.1;
    g.save();g.globalCompositeOperation="lighter";
    const cr=volR*0.55,glow=0.5+heat*0.5+0.15*Math.sin(tsec*5);
    const lg=g.createRadialGradient(volX,gyc,0,volX,gyc,Math.max(0,cr*1.8));
    lg.addColorStop(0,"rgba(255,230,120,"+(0.9*glow)+")");
    lg.addColorStop(0.4,"rgba(255,120,40,"+(0.6*glow)+")");
    lg.addColorStop(1,"rgba(255,90,30,0)");
    g.fillStyle=lg;g.beginPath();g.arc(volX,gyc,Math.max(0,cr*1.8),0,TAU);g.fill();
    g.restore();
    if(!useImg){
    // crater rim
    g.fillStyle="#2a1008";
    g.beginPath();g.ellipse(volX,volY-volR*0.7,volR*0.55,volR*0.16,0,0,TAU);g.fill();
    g.fillStyle="rgba(255,150,60,"+(0.6+heat*0.4)+")";
    g.beginPath();g.ellipse(volX,volY-volR*0.7,volR*0.42,volR*0.11,0,0,TAU);g.fill();
    }

    // cute volcano face (a little buddy who erupts!)
    const fy=volY-volR*0.1;
    const angry=heat;
    g.fillStyle="#fff";
    g.beginPath();g.arc(volX-volR*0.28,fy,volR*0.15,0,TAU);g.arc(volX+volR*0.28,fy,volR*0.15,0,TAU);g.fill();
    g.fillStyle="#2a1008";
    g.beginPath();g.arc(volX-volR*0.26,fy+volR*0.02,volR*0.07,0,TAU);g.arc(volX+volR*0.3,fy+volR*0.02,volR*0.07,0,TAU);g.fill();
    // angry brows when charged
    g.strokeStyle="#2a1008";g.lineWidth=volR*0.05;g.lineCap="round";
    g.beginPath();
    g.moveTo(volX-volR*0.42,fy-volR*0.18-angry*volR*0.06);g.lineTo(volX-volR*0.14,fy-volR*0.08);
    g.moveTo(volX+volR*0.42,fy-volR*0.18-angry*volR*0.06);g.lineTo(volX+volR*0.14,fy-volR*0.08);
    g.stroke();
    // mouth (open shout when erupting)
    const mo=fume>0?fume:0;
    g.fillStyle="#1a0606";
    g.beginPath();g.ellipse(volX,fy+volR*0.32,volR*0.18+mo*volR*0.1,volR*0.12+mo*volR*0.14,0,0,TAU);g.fill();
    // rosy cheeks
    g.fillStyle="rgba(255,120,80,.4)";
    g.beginPath();g.arc(volX-volR*0.45,fy+volR*0.18,volR*0.1,0,TAU);g.arc(volX+volR*0.45,fy+volR*0.18,volR*0.1,0,TAU);g.fill();
    g.restore();
  }

  function drawRock(r){
    g.save();g.translate(r.x,r.y);g.rotate(r.rot);
    if(r.hot>0){g.save();g.globalCompositeOperation="lighter";g.globalAlpha=r.hot;
      g.shadowBlur=12;g.shadowColor="#ff6a2e";g.fillStyle="rgba(255,120,50,0.7)";
      g.beginPath();g.arc(0,0,r.r*1.4,0,TAU);g.fill();g.restore();}
    // chunky rock body
    g.fillStyle="#2a1810";
    g.beginPath();
    const n=6;
    for(let i=0;i<n;i++){const a=i/n*TAU,rr=r.r*(0.8+0.3*Math.sin(i*2.3+r.seed));
      const px=Math.cos(a)*rr,py=Math.sin(a)*rr;
      if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}
    g.closePath();g.fill();
    // 軸6: 暖色背景(橙〜赤)に溶け込まないよう、まず暗い縁取りでシルエットを立たせる
    g.strokeStyle="rgba(0,0,0,.55)";g.lineWidth=2;g.stroke();
    // molten core glow
    if(r.hot>0.2){g.save();g.globalCompositeOperation="lighter";g.globalAlpha=r.hot;
      g.fillStyle=r.col;g.beginPath();g.arc(0,0,r.r*0.5,0,TAU);g.fill();g.restore();}
    g.strokeStyle="rgba(255,90,30,"+(0.3+r.hot*0.5)+")";g.lineWidth=2;g.stroke();
    g.restore();
  }

  function drawSky(s){
    g.save();
    if(s.hit>0){g.shadowBlur=14;g.shadowColor="#fff";}
    const by=s.y+Math.sin(s.bob)*4;
    // 画像スプライト: ロケット(横向き・右向き基準、左へ飛ぶときは反転)。にじいろは常に手描きオーブ。
    // ドラゴンは生成が「立ちポーズ+影残り」続きで不採用のため手描きのまま(issues参照)。
    const useImg=!s.rainbow&&s.type==="rocket"&&api.asset(s.type+".png").ready;
    if(useImg){
      if(s.gold){ // ゴールド個体: 画像は金色でないので、後ろに脈動する金の光輪を足して分からせる
        g.save();g.globalCompositeOperation="lighter";
        const gp=0.5+0.5*Math.sin(tsec*5+s.bob),gr=Math.max(1,s.r*1.9);
        const ag=g.createRadialGradient(s.x,by,0,s.x,by,gr);
        ag.addColorStop(0,"rgba(255,225,110,"+(0.65*gp)+")");ag.addColorStop(1,"rgba(255,225,110,0)");
        g.fillStyle=ag;g.beginPath();g.arc(s.x,by,gr,0,TAU);g.fill();g.restore();
      }
      api.drawAsset(s.type+".png",s.x,by,s.r*2.4,s.r*2.4,{center:true,flip:s.vx<0});
      if(s.hit>0){g.save();g.globalAlpha=s.hit*0.5;g.fillStyle="#fff";
        g.beginPath();g.arc(s.x,by,Math.max(1,s.r*0.95),0,TAU);g.fill();g.restore();}
    }else if(s.rainbow){
      // ① にじいろオーブ: 虹色に脈動する激レア(半径は0付近を通らないようクランプ)
      const cols=["#ff5da2","#ff8c42","#ffd23f","#7be08a","#5ad1ff","#9b6bff"];
      const t=tsec*3+s.bob;
      for(let k=cols.length-1;k>=0;k--){
        const rr=Math.max(1,s.r*(0.45+k*0.11)*(1+0.06*Math.sin(t+k)));
        g.fillStyle=cols[(k+Math.floor(t))%cols.length];
        g.beginPath();g.arc(s.x,by,rr,0,TAU);g.fill();
      }
      g.fillStyle="rgba(255,255,255,.55)";g.beginPath();g.arc(s.x-s.r*0.28,by-s.r*0.3,Math.max(1,s.r*0.16),0,TAU);g.fill();
    }else if(s.type==="balloon"){
      g.fillStyle=s.col;g.beginPath();g.ellipse(s.x,by,s.r*0.85,s.r,0,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.4)";g.beginPath();g.ellipse(s.x-s.r*0.3,by-s.r*0.35,s.r*0.25,s.r*0.35,-0.4,0,TAU);g.fill();
      g.strokeStyle="rgba(0,0,0,.3)";g.lineWidth=1.5;g.beginPath();g.moveTo(s.x,by+s.r);g.lineTo(s.x,by+s.r*1.6);g.stroke();
    }else if(s.type==="cloud"){
      g.fillStyle=s.col;
      g.beginPath();g.arc(s.x-s.r*0.5,by,s.r*0.6,0,TAU);g.arc(s.x+s.r*0.5,by,s.r*0.6,0,TAU);
      g.arc(s.x,by-s.r*0.3,s.r*0.7,0,TAU);g.fill();
    }else if(s.type==="ufo"){
      g.fillStyle="#9aa6c0";g.beginPath();g.ellipse(s.x,by,s.r,s.r*0.4,0,0,TAU);g.fill();
      g.fillStyle=s.col;g.beginPath();g.arc(s.x,by-s.r*0.2,s.r*0.5,Math.PI,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(s.x-s.r*0.2,by-s.r*0.3,s.r*0.12,0,TAU);g.fill();
    }else if(s.type==="star"){
      // 手描き ながれぼし: すすむ向きに尾を引く星型(drawTwinkleを流用)
      const dir=s.vx<0?-1:1;
      g.save();g.globalAlpha=0.5;g.fillStyle=s.col;
      g.beginPath();g.moveTo(-dir*s.r*2.4,-s.r*0.15);g.lineTo(-dir*s.r*0.6,-s.r*0.32);
      g.lineTo(-dir*s.r*0.6,s.r*0.32);g.lineTo(-dir*s.r*2.4,s.r*0.15);g.closePath();g.fill();
      g.restore();
      g.fillStyle=s.col;g.shadowBlur=10;g.shadowColor=s.col;drawTwinkle(s.x,by,s.r*0.9);g.shadowBlur=0;
      g.fillStyle="rgba(255,255,255,.6)";drawTwinkle(s.x,by,s.r*0.4);
    }else if(s.type==="dragon"){
      // 手描きドラゴン(生成画像は「立ちポーズ+影残り」続きで不採用。issues参照)
      const fl=s.vx<0?-1:1;
      g.save();g.translate(s.x,by);g.scale(fl,1);
      g.strokeStyle="#3a9a3a";g.lineWidth=Math.max(1,s.r*0.2);g.lineCap="round";
      g.beginPath();g.moveTo(-s.r*0.55,s.r*0.05);g.quadraticCurveTo(-s.r*1.15,s.r*0.45,-s.r*0.85,s.r*0.9);g.stroke();
      g.fillStyle="#ff9a3a";
      g.beginPath();g.moveTo(-s.r*0.15,-s.r*0.05);g.lineTo(-s.r*1.05,-s.r*0.85);g.lineTo(-s.r*0.3,-s.r*0.02);g.closePath();g.fill();
      g.fillStyle="#6bc24a";
      g.beginPath();g.ellipse(0,0,s.r*0.62,s.r*0.48,0,0,TAU);g.fill();
      g.fillStyle="#ffb35a";
      g.beginPath();g.ellipse(s.r*0.05,s.r*0.18,s.r*0.38,s.r*0.26,0,0,TAU);g.fill();
      g.fillStyle="#6bc24a";
      g.beginPath();g.arc(s.r*0.55,-s.r*0.05,s.r*0.32,0,TAU);g.fill();
      g.fillStyle="#ffd23f";
      g.beginPath();g.moveTo(s.r*0.42,-s.r*0.3);g.lineTo(s.r*0.36,-s.r*0.5);g.lineTo(s.r*0.5,-s.r*0.32);g.closePath();g.fill();
      g.fillStyle="#222";g.beginPath();g.arc(s.r*0.66,-s.r*0.08,s.r*0.075,0,TAU);g.fill();
      g.restore();
    }else{ // blimp
      g.fillStyle=s.col;g.beginPath();g.ellipse(s.x,by,s.r,s.r*0.5,0,0,TAU);g.fill();
      g.fillStyle=s.hp<=1?"#fff":"rgba(0,0,0,.2)";g.fillRect(s.x-s.r*0.2,by+s.r*0.4,s.r*0.4,s.r*0.25);
      g.fillStyle="rgba(255,255,255,.3)";g.beginPath();g.ellipse(s.x-s.r*0.3,by-s.r*0.2,s.r*0.3,s.r*0.15,-0.3,0,TAU);g.fill();
    }
    // tiny eyes for charm (画像/星/ドラゴンは専用の目を描いた ので付けない)
    if(!useImg&&s.type!=="star"&&s.type!=="dragon"){g.fillStyle="#222";g.beginPath();g.arc(s.x-s.r*0.18,by-s.r*0.05,s.r*0.08,0,TAU);g.arc(s.x+s.r*0.18,by-s.r*0.05,s.r*0.08,0,TAU);g.fill();}
    // ② ラッキー色ヒント: 秘密の色の空てきの頭上に 小さな星がキラッ(気づけるヒント/減点なし)
    if(!s.gold&&!s.rainbow&&s.col===luckyColor){
      const tw=0.5+0.5*Math.sin(tsec*6+s.bob);
      g.globalAlpha=0.55+0.45*tw;g.fillStyle="#fff6d6";g.shadowBlur=8;g.shadowColor=luckyColor;
      drawTwinkle(s.x,by-s.r-9,3+tw*1.6);g.shadowBlur=0;g.globalAlpha=1;
    }
    g.restore();
  }

  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  // 軸7: 建物の輪郭バリエーション(塔=先端三角/ドーム=上部半円/wide=四角のまま)
  function drawBuildingShape(type,x,y,w,h){
    if(type==="tower"){
      const apex=h*0.22;
      g.beginPath();g.moveTo(x,y+apex);g.lineTo(x+w/2,y);g.lineTo(x+w,y+apex);
      g.lineTo(x+w,y+h);g.lineTo(x,y+h);g.closePath();g.fill();
    }else if(type==="dome"){
      const domeH=Math.min(w*0.5,h*0.35);
      g.beginPath();g.moveTo(x,y+domeH);
      g.arc(x+w/2,y+domeH,Math.max(0,w/2),Math.PI,0);
      g.lineTo(x+w,y+h);g.lineTo(x,y+h);g.closePath();g.fill();
    }else{
      g.fillRect(x,y,w,h);
    }
  }
}
Engine.register("eruption", build_eruption);
