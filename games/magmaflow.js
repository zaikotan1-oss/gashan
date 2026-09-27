function build_magmaflow(api){
  const g=api.g;
  api.preload(["bg.jpg","rock.png","tree.png","crate.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)
  let imgBg=false;   // 今フレーム 背景画像が出ているか(平坦な手描き背景要素をスキップする判定)
  // ---- state (all closed inside build) ----
  let src,laneY,laneH,dir,lanes,items,blobs,sparks,embers,smokes,rings,heatT,tGlobal;
  let count,combo,comboT,flash,erupt,eruptT,clearT,clearStage,paused;
  let stage,stageEat,stageGoal,spawnT;
  let fever,feverGauge,feverBanner,hsCool,floats;
  let dirCool;   // 軸3対策: タップ成立後の短いクールダウン(連打だけで勝てないように)
  // ---- 隠し発見レイヤー(ハンマー/トラックと同じ思想) ----
  let luckyType,luckyName,luckyCol,luckyMsgT;   // ② きょうのラッキー色(=ラッキーな種類の色)
  let rbMsgT,rbComingT;                          // ① にじいろ ようがん: 発見/接近の告知
  let stageWaste,perfectT;                       // ③ パーフェクト: 冷えたレーンへ流し切って捨てた数=0で祝福
  let shootStar,starSeen;                         // ④ ながれ星ひみつ: 夜空をよぎる星をタッチでごほうび
  const STAGES=5;
  const FEVER_LEN=10;   // seconds
  const RAINBOW=["#ff5b5b","#ff8c42","#ffd23f","#7be08a","#4db8ff","#b58bff","#ff7bd0"];
  const STAGE_NAMES=["あかい かざん","ばらいろの かざん","むらさきの かざん","よるの かざん","きんいろの かざん"];
  const PAL=[
    {sky1:"#3a0a14",sky2:"#7a1a10",sky3:"#c24a14",rock:"#2a1410",rock2:"#160a08"},
    {sky1:"#2a0820",sky2:"#6a142e",sky3:"#c2304a",rock:"#241018",rock2:"#120608"},
    {sky1:"#1a0820",sky2:"#4a1050",sky3:"#a0307a",rock:"#1e0e1c",rock2:"#0e0610"},
    {sky1:"#0a0818",sky2:"#2a1850",sky3:"#5a3aa0",rock:"#161028",rock2:"#080612"},
    {sky1:"#3a1404",sky2:"#9a4008",sky3:"#ffb020",rock:"#2e1606",rock2:"#160a04"}
  ];
  // 軸7対策: rock/tree/crate だけだと大きさも壊れ方も揃いすぎる。
  // big_boulder(でっかい・どっしり壊れる)と pebble(ちいさい・パッと消える)を混ぜてバラエティを出す
  const ITEMS=["rock","tree","rock","crate","rock","tree","pebble","pebble","big_boulder"];
  // ② きょうのラッキー色: ふつうの3種は それぞれ自然な色を持つ。毎プレイ1つを秘密に選ぶ
  const LTNAME={rock:"はいいろ",tree:"みどり",crate:"ちゃいろ"};
  const LTCOL={rock:"#c0c8d0",tree:"#7be08a",crate:"#e0a24a"};
  // 軸7対策: 種類ごとに壊れ方の色を変える(同じ橙しぶき一辺倒にしない)。最後の色は溶岩の橙で共通に馴染ませる
  const TYPE_SPLASH={
    rock:["#c9ccd2","#9aa0a8","#ff8a20"],
    big_boulder:["#c9ccd2","#6a6e76","#4a4e56","#ff8a20"],
    tree:["#8fe0a0","#4fae66","#2f8f4a","#ff8a20"],
    crate:["#e0b878","#b8853a","#8a5a24","#ff8a20"],
    pebble:["#d8dce2","#aab0b8","#ff8a20"]
  };
  function pal(){return PAL[(stage-1)%PAL.length];}
  function goalFor(s){return 7+(s-1)*3;}   // 7,10,13,16,19（7〜8歳向けに手応えを増やした / 旧 6,8,10,12,14）

  function layout(){
    laneY=api.H*0.5;
    laneH=clamp(api.H*0.16,70,150);
    src={x:api.W*0.5,y:api.H*0.20};
    // two diverging lava lanes (left / right) sloping down from the source
    lanes=[
      {dir:-1,x0:src.x,y0:src.y+laneH*0.3,x1:api.W*0.10,y1:laneY+api.H*0.26},
      {dir: 1,x0:src.x,y0:src.y+laneH*0.3,x1:api.W*0.90,y1:laneY+api.H*0.26}
    ];
  }
  layout();
  // initial state
  dir=1;
  items=[];blobs=[];sparks=[];embers=[];smokes=[];rings=[];heatT=0;tGlobal=0;
  count=0;combo=0;comboT=0;flash=0;erupt=0;eruptT=0;clearT=0;clearStage=0;paused=false;
  stage=1;stageEat=0;stageGoal=goalFor(1);spawnT=20;
  fever=0;feverGauge=0;feverBanner=0;hsCool=0;floats=[];dirCool=0;
  luckyType=pick(["rock","tree","crate"]);luckyName=LTNAME[luckyType];luckyCol=LTCOL[luckyType];luckyMsgT=2.2;
  rbMsgT=0;rbComingT=0;stageWaste=0;perfectT=0;shootStar=null;starSeen=false;

  // hitStop wrapper: only fires on big moments, with a 30+ frame cooldown
  function hs(f){if(hsCool>0)return;hsCool=34;api.hitStop(f);}

  function laneFor(d){return d<0?lanes[0]:lanes[1];}
  function lavaPos(d,t){const L=laneFor(d);return {x:lerp(L.x0,L.x1,t),y:lerp(L.y0,L.y1,t)};}

  function spawn(){
    if(items.length>14)return;
    let type=pick(ITEMS);
    // ① にじいろ ようがん: 数%の激レア。虹色に光り 大量得点。いつ流れてくるか分からない=ドキドキ
    const rbP=0.02+(stage-1)*0.004;
    // rare GOLD nugget: big points + fanfare when eaten. slightly more common late-stage / in fever
    const goldP=fever>0?0.16:0.07+(stage-1)*0.012;
    if(Math.random()<rbP)type="rainbow";
    else if(Math.random()<goldP)type="gold";
    // items roll in from above the source, drift toward whichever lane the flow points
    // 軸3対策: いま流れている向き(dir)と「逆」になりやすくする。こうしないと、何もタップしなくても
    // 半分の アイテムが 自動で流れ込んでしまい、狙わない連打でもスコアが伸び続けてしまう。
    // 少し(22%)は そのまま流れ込むので、何もしなくても時々は成果が出る(低学年の安心設計は保つ)。
    // 軸3対策(3R): 0.74→0.78に引き上げ、タップ不要で流れ込む「自動得点」の割合を約26%→約22%に下げる
    // (0.85まで上げるとfirstScoreSec/maxQuietSecが悪化することをN=12計測で確認したため、やり過ぎない範囲に留める)
    const d=Math.random()<0.78?-dir:dir;
    const gold=type==="gold",rb=type==="rainbow";
    // 軸7対策: big_boulder は特大、pebble は極小(サイズ差をはっきりつける)
    let s;
    if(gold||rb)s=rnd(1.08,1.3);
    else if(type==="big_boulder")s=rnd(1.6,2.0);
    else if(type==="pebble")s=rnd(0.5,0.6);
    else s=rnd(0.85,1.15);
    items.push({type,d,t:rnd(0.05,0.22),s,
      rot:(gold||rb)?0:rnd(0,TAU),vr:(gold||rb)?rnd(-0.02,0.02):rnd(-0.06,0.06),
      burn:0,eaten:false,bob:rnd(0,TAU),life:1});
    const p0=lavaPos(d,items[items.length-1].t);
    if(gold){ // キラーン: eye-catching spawn cue (chime + golden ring)
      api.tone(1318,0.12,"triangle",0.07);api.tone(1760,0.18,"triangle",0.06);
      rings.push({x:p0.x,y:p0.y-laneH*0.2,r:6,vr:laneH*0.45,life:1,decay:0.05,col:"#ffe14a"});
    }else if(rb){ // にじいろ 接近予告: 上り階名のチャイム + 虹の輪 + 「でた！」の一言
      api.tone(880,0.1,"triangle",0.08);api.tone(1320,0.12,"triangle",0.07);api.tone(1760,0.14,"triangle",0.06);
      rings.push({x:p0.x,y:p0.y-laneH*0.2,r:6,vr:laneH*0.5,life:1,decay:0.05,col:"#ff7bd0"});
      rings.push({x:p0.x,y:p0.y-laneH*0.2,r:6,vr:laneH*0.34,life:1,decay:0.05,col:"#4db8ff"});
      rbComingT=1.3;
    }
  }

  function eat(it){
    it.eaten=true;it.burn=1;
    const p=lavaPos(it.d,it.t);
    const gold=it.type==="gold",rb=it.type==="rainbow";
    // ② ラッキー色: ふつうの3種(rock/tree/crate)で 今日のラッキー種類なら +1 の隠しボーナス
    const lucky=!gold&&!rb&&it.type===luckyType;
    let pts=(gold?5:(rb?10:1))*(fever>0?2:1);   // fever = double points
    if(lucky)pts+=1;
    count+=pts;stageEat++;combo++;comboT=1;
    api.setScore(count);
    // 軸7対策: big_boulder はどっしり重い手応え、pebble は軽くパッと消える手応え(rock/tree/crateは従来どおり)
    const heavy=it.type==="big_boulder",light=it.type==="pebble";
    // sizzle + chunky lava splash
    api.slide(heavy?130:180,heavy?45:70,0.18,0.22,"sawtooth");
    api.noise(light?0.10:0.22,0.22,light?760:520,"lowpass",light?0.5:0.8);
    api.tone((heavy?300:420)*Math.pow(2,clamp(combo,0,10)/14),0.1,"triangle",0.1);
    api.boom(light?0.16:(heavy?0.55:0.4));api.shake((light?2:(heavy?9:5))+Math.min(combo,8));
    flash=Math.min(1,flash+(light?0.15:(heavy?0.4:0.3)));
    if(gold){ // GOLD! rainbow splash + fanfare + big float
      flash=Math.min(1,flash+0.5);api.shake(10);hs(5);api.boom(0.6);
      [0,4,7,12].forEach((s,i)=>setTimeout(()=>api.tone(659.25*Math.pow(2,s/12),0.16,"triangle",0.11),i*70));
      rings.push({x:p.x,y:p.y,r:8,vr:laneH*0.8,life:1,decay:0.04,col:"#ffe14a"});
      for(let i=0;i<22;i++){const a=rnd(0,TAU),sp=rnd(3,9);
        blobs.push({x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,r:rnd(3,8),
          life:1,decay:rnd(0.015,0.03),col:pick(RAINBOW)});}
      floats.push({x:clamp(p.x,70,api.W-70),y:p.y-laneH*0.6,txt:"ゴールド！ +"+pts,life:1,vy:-0.9,col:"#ffe14a",size:30});
    }else if(rb){ // ① にじいろ ようがん撃破: 虹のしぶき + ファンファーレ + 大量得点(白飛びは控えめ)
      rbMsgT=1.6;rbComingT=0;flash=Math.min(1,flash+0.4);api.shake(14);hs(5);api.boom(0.7);
      [0,4,7,11,14].forEach((s,i)=>setTimeout(()=>api.tone(659.25*Math.pow(2,s/12),0.16,"triangle",0.1),i*70));
      rings.push({x:p.x,y:p.y,r:8,vr:laneH*0.9,life:1,decay:0.035,col:"#ff7bd0"});
      rings.push({x:p.x,y:p.y,r:8,vr:laneH*0.6,life:1,decay:0.04,col:"#4db8ff"});
      for(let i=0;i<30;i++){const a=rnd(0,TAU),sp=rnd(3,11);
        blobs.push({x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,r:rnd(3,9),
          life:1,decay:rnd(0.015,0.03),col:RAINBOW[i%RAINBOW.length]});}
      floats.push({x:clamp(p.x,80,api.W-80),y:p.y-laneH*0.6,txt:"にじいろ ようがん！ +"+pts,life:1,vy:-0.9,col:"#ff7bd0",size:26});
    }else if(fever>0){
      floats.push({x:clamp(p.x,50,api.W-50),y:p.y-laneH*0.5,txt:"+"+pts,life:1,vy:-1,col:"#fff",size:20});
    }
    if(lucky){ // ② ラッキー色命中: 頭上に小さな星のキラッ(気づけるヒント)+ 小さめ祝福
      api.tone(1046,0.12,"triangle",0.1);api.tone(1568,0.14,"triangle",0.08);
      for(let i=0;i<6;i++){const a=-TAU/4+rnd(-0.5,0.5),sp=rnd(1.5,3.5);
        embers.push({x:p.x,y:p.y-laneH*0.3,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,r:rnd(1.6,3),life:1,decay:rnd(0.02,0.035)});}
      floats.push({x:clamp(p.x,60,api.W-60),y:p.y-laneH*0.55,txt:"ラッキー！",life:1,vy:-0.9,col:luckyCol,size:22});
    }
    // fever gauge charges from eating; full gauge auto-triggers FEVER TIME
    if(fever<=0){feverGauge=Math.min(1,feverGauge+(gold?0.34:0.1));
      if(feverGauge>=1&&clearT<=0)startFever();}
    // 軸7対策: 壊れ方の色を種類ごとに変え(rock/big_boulderは灰,treeは緑,crateは茶,pebbleは白っぽい)、
    // big_boulderは破片を多く大きく・長めの余韻、pebbleは一瞬でパッと消えるだけにする
    const splashCol=TYPE_SPLASH[it.type]||["#ffd23f","#ff8a20","#ff5b14"];
    rings.push({x:p.x,y:p.y,r:laneH*(light?0.16:0.3),vr:laneH*(light?0.28:0.5),life:1,decay:0.06,col:heavy?"#c9ccd2":"#ff8a20"});
    for(let i=0;i<(light?4:rint(8,12))+(heavy?8:0);i++){const a=rnd(-TAU/2,0),sp=rnd(3,8);
      blobs.push({x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,r:rnd(4,9)*(heavy?1.3:(light?0.55:1)),
        life:1,decay:(heavy?rnd(0.012,0.022):rnd(0.02,0.04)),col:pick(splashCol)});}
    for(let i=0;i<(light?1:rint(4,7));i++)smokes.push({x:p.x+rnd(-10,10),y:p.y,r:rnd(8,18)*(heavy?1.2:1),
      vy:-rnd(0.6,1.6),vx:rnd(-0.5,0.5),life:1,decay:rnd(0.01,0.02)});
    for(let i=0;i<(light?2:6);i++){const a=rnd(0,TAU),sp=rnd(2,6);
      embers.push({x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,r:rnd(1.5,3.5),life:1,decay:rnd(0.02,0.035)});}
    if(combo>=3){flash=Math.min(1,0.4+combo*0.05);if(combo%4===0)hs(3);}
    if(combo>0&&combo%8===0)bigErupt();
    checkStage();
  }

  function startFever(){
    // FEVER TIME: golden sky, rapid spawns, double points
    fever=FEVER_LEN;feverGauge=1;feverBanner=1.8;flash=1;
    api.boom(0.7);api.shake(18);hs(6);
    api.slide(200,880,0.5,0.3,"square");
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(523.25*Math.pow(2,s/12),0.18,"triangle",0.12),i*80));
    for(let i=0;i<30;i++){const a=rnd(0,TAU),sp=rnd(4,10);
      embers.push({x:src.x,y:src.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,r:rnd(2,4),life:1,decay:rnd(0.01,0.02)});}
    rings.push({x:src.x,y:src.y,r:10,vr:laneH*0.9,life:1,decay:0.03,col:"#ffe14a"});
    spawnT=1;
  }
  function endFever(){
    fever=0;feverGauge=0;flash=Math.min(1,flash+0.5);
    api.boom(0.4);api.slide(880,220,0.4,0.2,"triangle");
    rings.push({x:src.x,y:src.y,r:10,vr:laneH*0.7,life:1,decay:0.035,col:"#ff8a20"});
    floats.push({x:api.W/2,y:api.H*0.3,txt:"フィーバー おしまい！ また ためよう！",life:1,vy:-0.4,col:"#ffd23f",size:22});
  }

  function bigErupt(){
    // 大噴火: source blows, fountains of lava + smoke, screen flash
    erupt=1;eruptT=1.4;flash=1;api.boom(0.7);api.shake(20);hs(6);
    if(fever<=0)feverGauge=Math.min(1,feverGauge+0.15);
    api.slide(120,40,0.6,0.4,"sawtooth");api.noise(0.7,0.4,300,"lowpass",0.7);
    api.tone(90,0.5,"sawtooth",0.12);
    for(let i=0;i<46;i++){const a=rnd(-TAU*0.5-0.5,-TAU*0.5+0.5)+rnd(-0.6,0.6),sp=rnd(6,15);
      blobs.push({x:src.x,y:src.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:rnd(5,12),
        life:1,decay:rnd(0.012,0.025),col:pick(["#fff0a0","#ffd23f","#ff8a20","#ff5b14"])});}
    for(let i=0;i<18;i++)smokes.push({x:src.x+rnd(-30,30),y:src.y,r:rnd(14,30),
      vy:-rnd(1,3),vx:rnd(-1,1),life:1,decay:rnd(0.006,0.014)});
    for(let i=0;i<24;i++){const a=rnd(0,TAU),sp=rnd(4,11);
      embers.push({x:src.x,y:src.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-4,r:rnd(2,4.5),life:1,decay:rnd(0.012,0.025)});}
  }

  function checkStage(){
    if(stageEat<stageGoal||clearT>0)return;
    clearStage=stage;clearT=1.7;flash=Math.min(1,flash+0.5);
    api.boom(0.6);api.shake(14);
    api.slide(523,880,0.35,0.2,"triangle");api.tone(784,0.25,"triangle",0.12);
    for(let i=0;i<26;i++){const a=rnd(0,TAU),sp=rnd(3,9);
      embers.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,r:rnd(2,4.5),life:1,decay:rnd(0.01,0.02)});}
    // ③ パーフェクト ボーナス: このステージで 1つも冷えたレーンへ流し捨てなかったら +3 & みどりの祝福。
    // 考えどころ=方向を切り替えて 全部を まぐまに たべさせる。気づくと得する隠し判定。
    if(stageWaste===0){count+=3;api.setScore(count);perfectT=1.9;
      api.tone(1318,0.16,"triangle",0.12);api.tone(1976,0.18,"triangle",0.09);
      for(let i=0;i<16;i++){const a=rnd(0,TAU),sp=rnd(3,8);
        embers.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2.5,r:rnd(2,4),life:1,decay:rnd(0.01,0.02)});}}
    stageWaste=0;
    if(stage<STAGES){stage++;}else{stage=1;}
    stageGoal=goalFor(stage);stageEat=0;
  }

  // ---------- drawing helpers ----------
  function drawSource(){
    const p=src,r=laneH*0.62*(1+erupt*0.25);
    // crater mound ※画像背景のときは絵の火山を活かして平坦な手描きの山は描かない(光る火口と顔だけ重ねる)
    if(!imgBg){
      g.fillStyle=pal().rock;
      g.beginPath();g.moveTo(p.x-r*1.8,p.y+r*0.8);
      g.quadraticCurveTo(p.x,p.y-r*0.4,p.x+r*1.8,p.y+r*0.8);g.closePath();g.fill();
    }
    // glowing mouth
    g.save();g.globalCompositeOperation="lighter";
    const gm=g.createRadialGradient(p.x,p.y,0,p.x,p.y,r*1.6);
    gm.addColorStop(0,"rgba(255,240,160,"+(0.7+erupt*0.3)+")");
    gm.addColorStop(0.4,"rgba(255,120,30,0.5)");gm.addColorStop(1,"rgba(255,80,20,0)");
    g.fillStyle=gm;g.beginPath();g.arc(p.x,p.y,r*1.6,0,TAU);g.fill();g.restore();
    g.fillStyle="#ff8a20";g.beginPath();g.ellipse(p.x,p.y,r*0.7,r*0.42,0,0,TAU);g.fill();
    g.fillStyle="#ffd23f";g.beginPath();g.ellipse(p.x,p.y,r*0.42,r*0.24,0,0,TAU);g.fill();
    // cute face on the volcano
    g.fillStyle="#2a0a04";
    const ey=p.y-r*0.05,ex=r*0.34;
    g.beginPath();g.arc(p.x-ex,ey,r*0.1,0,TAU);g.arc(p.x+ex,ey,r*0.1,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.8)";
    g.beginPath();g.arc(p.x-ex+r*0.03,ey-r*0.03,r*0.03,0,TAU);g.arc(p.x+ex+r*0.03,ey-r*0.03,r*0.03,0,TAU);g.fill();
    g.strokeStyle="#2a0a04";g.lineWidth=Math.max(2,r*0.06);g.lineCap="round";
    g.beginPath();g.arc(p.x,ey+r*0.12,r*0.16,0.12*Math.PI,0.88*Math.PI);g.stroke();
  }

  function drawLane(L,active){
    // glowing lava channel from source toward its mouth
    const steps=10;
    g.save();
    g.lineCap="round";
    // dark channel bed
    g.strokeStyle=pal().rock2;g.lineWidth=laneH*0.9;
    g.beginPath();g.moveTo(L.x0,L.y0);g.lineTo(L.x1,L.y1);g.stroke();
    if(active){
      g.globalCompositeOperation="lighter";
      // outer glow
      g.strokeStyle="rgba(255,90,20,0.35)";g.lineWidth=laneH*0.95;
      g.beginPath();g.moveTo(L.x0,L.y0);g.lineTo(L.x1,L.y1);g.stroke();
      // molten core with flowing color bands
      for(let i=0;i<steps;i++){
        const t0=i/steps,t1=(i+1)/steps;
        const a0={x:lerp(L.x0,L.x1,t0),y:lerp(L.y0,L.y1,t0)};
        const a1={x:lerp(L.x0,L.x1,t1),y:lerp(L.y0,L.y1,t1)};
        const ph=0.5+0.5*Math.sin(tGlobal*0.15-i*0.7);
        g.strokeStyle="rgba(255,"+Math.round(140+90*ph)+","+Math.round(20+40*ph)+",0.9)";
        g.lineWidth=laneH*0.55;
        g.beginPath();g.moveTo(a0.x,a0.y);g.lineTo(a1.x,a1.y);g.stroke();
      }
      // bright center line
      g.strokeStyle="rgba(255,235,150,0.7)";g.lineWidth=laneH*0.18;
      g.beginPath();g.moveTo(L.x0,L.y0);g.lineTo(L.x1,L.y1);g.stroke();
    }else{
      // cooled lava (dim)
      g.strokeStyle="rgba(120,40,20,0.5)";g.lineWidth=laneH*0.5;
      g.beginPath();g.moveTo(L.x0,L.y0);g.lineTo(L.x1,L.y1);g.stroke();
    }
    g.restore();
  }

  function drawItem(it){
    const p=lavaPos(it.d,it.t),r=laneH*0.34*it.s*(it.eaten?clamp(it.life,0,1):1);
    g.save();g.translate(p.x,p.y-(it.eaten?0:laneH*0.18)+Math.sin(it.bob)*3);g.rotate(it.rot);
    if(it.burn>0){g.save();g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(255,150,40,"+(it.burn*0.7)+")";
      g.beginPath();g.arc(0,0,r*1.6,0,TAU);g.fill();g.restore();}
    if(it.type==="gold"){
      // glowing golden star nugget: pulses so it grabs the eye instantly
      const tw=0.6+0.4*Math.sin(tGlobal*0.4+it.bob*3);
      g.save();g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(255,225,90,"+(0.3+0.3*tw)+")";
      g.beginPath();g.arc(0,0,r*1.9,0,TAU);g.fill();g.restore();
      const gg=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r);
      gg.addColorStop(0,"#fff6c0");gg.addColorStop(0.5,"#ffd23f");gg.addColorStop(1,"#c98a10");
      g.fillStyle=gg;
      g.beginPath();
      for(let i=0;i<10;i++){const a=i/10*TAU-TAU/4,rr=i%2===0?r*(0.92+0.1*tw):r*0.55;
        g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}
      g.closePath();g.fill();
      g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=Math.max(2,r*0.07);g.stroke();
      g.fillStyle="rgba(255,255,255,.9)";g.beginPath();g.arc(-r*0.22,-r*0.28,r*0.13,0,TAU);g.fill();
    }else if(it.type==="rainbow"){
      // ① にじいろ ようがん: 虹色に回る円盤。脈動する光でひとめで分かる激レア
      const tw=0.6+0.4*Math.sin(tGlobal*0.4+it.bob*3);
      g.save();g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(255,180,220,"+(0.22+0.28*tw)+")";
      g.beginPath();g.arc(0,0,Math.max(0,r*1.95),0,TAU);g.fill();g.restore();
      g.rotate(tGlobal*0.05);
      const rr=Math.max(0,r*(0.95+0.1*tw));
      for(let k=0;k<RAINBOW.length;k++){
        g.fillStyle=RAINBOW[k];const a0=k/RAINBOW.length*TAU;
        g.beginPath();g.moveTo(0,0);g.arc(0,0,rr,a0,a0+TAU/RAINBOW.length+0.02);g.closePath();g.fill();}
      g.fillStyle="#fff";g.beginPath();g.arc(0,0,Math.max(0,r*0.32),0,TAU);g.fill();
      g.strokeStyle="rgba(255,255,255,.8)";g.lineWidth=Math.max(2,r*0.06);
      g.beginPath();g.arc(0,0,rr,0,TAU);g.stroke();
    }else if(drawItemImg(it,r)){
      // 画像スプライト(rock/tree/crate)を描けた → 手描きはスキップ
    }else if(it.type==="tree"){
      g.fillStyle="#5a3a18";g.fillRect(-r*0.16,0,r*0.32,r*0.9);
      g.fillStyle=it.burn>0?"#7a4010":"#2f8f4a";
      g.beginPath();g.arc(0,-r*0.3,r*0.7,0,TAU);g.fill();
      g.beginPath();g.arc(-r*0.4,r*0.1,r*0.5,0,TAU);g.arc(r*0.4,r*0.1,r*0.5,0,TAU);g.fill();
    }else if(it.type==="crate"){
      g.fillStyle=it.burn>0?"#8a4a1a":"#b8853a";g.fillRect(-r*0.7,-r*0.7,r*1.4,r*1.4);
      g.strokeStyle="rgba(90,50,20,.8)";g.lineWidth=Math.max(2,r*0.1);
      g.strokeRect(-r*0.7,-r*0.7,r*1.4,r*1.4);
      g.beginPath();g.moveTo(-r*0.7,-r*0.7);g.lineTo(r*0.7,r*0.7);
      g.moveTo(r*0.7,-r*0.7);g.lineTo(-r*0.7,r*0.7);g.stroke();
    }else if(it.type==="big_boulder"){
      // 軸7対策: ふつうの rock よりずっと大きく、いびつな輪郭とヒビで「どっしり重い」見た目にする
      const grd=g.createRadialGradient(-r*0.32,-r*0.32,Math.max(0,r*0.12),0,0,Math.max(0.01,r));
      grd.addColorStop(0,"#9aa0a8");grd.addColorStop(0.6,"#5a5e66");grd.addColorStop(1,"#262428");
      g.fillStyle=it.burn>0?"#8a5a2e":grd;
      g.beginPath();
      for(let i=0;i<9;i++){const a=i/9*TAU,rr=Math.max(0,r*(0.78+0.24*Math.sin(i*1.7+it.bob)));
        g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}
      g.closePath();g.fill();
      g.strokeStyle="rgba(20,18,20,.55)";g.lineWidth=Math.max(2,r*0.05);g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.28,-r*0.5);g.lineTo(-r*0.04,r*0.08);g.lineTo(-r*0.34,r*0.5);g.stroke();
      g.fillStyle="rgba(255,255,255,.2)";g.beginPath();g.arc(-r*0.32,-r*0.34,Math.max(0,r*0.24),0,TAU);g.fill();
    }else if(it.type==="pebble"){
      // 軸7対策: 小さくコロンとした小石。当たると一瞬でパッと消える軽い演出用のターゲット
      const grd=g.createRadialGradient(-r*0.3,-r*0.3,Math.max(0,r*0.05),0,0,Math.max(0.01,r));
      grd.addColorStop(0,"#ccd0d6");grd.addColorStop(1,"#7a7f88");
      g.fillStyle=it.burn>0?"#c07a3a":grd;
      g.beginPath();g.arc(0,0,Math.max(0,r),0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.3)";g.beginPath();g.arc(-r*0.28,-r*0.28,Math.max(0,r*0.26),0,TAU);g.fill();
    }else{
      // rock: lumpy grey boulder
      const grd=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r);
      grd.addColorStop(0,"#9aa0a8");grd.addColorStop(1,"#4a4e56");
      g.fillStyle=grd;
      g.beginPath();
      for(let i=0;i<7;i++){const a=i/7*TAU,rr=r*(0.8+0.2*Math.sin(i*2.3));
        g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}
      g.closePath();g.fill();
      g.fillStyle="rgba(255,255,255,.25)";g.beginPath();g.arc(-r*0.3,-r*0.3,r*0.22,0,TAU);g.fill();
    }
    g.restore();
  }
  // 画像スプライト版の標的(rock/tree/crate)。translate/rotate 済みの座標系で呼ばれる。
  // 燃えている間(burn>0)は tinted で橙〜赤に染めた複製を描き「溶けていく」感じを出す。
  // 画像未準備なら false → 呼び出し側が従来の手描きへ。
  function drawItemImg(it,r){
    const name=it.type==="rock"?"rock.png":it.type==="tree"?"tree.png":it.type==="crate"?"crate.png":null;
    if(!name)return false;
    let srcImg=null;
    // 着色の強さは3段階に量子化(tinted はキー別にキャッシュするので連続値だと複製が増え続ける)
    if(it.burn>0){srcImg=api.tinted(name,"#ff6a14",it.burn>0.66?0.7:(it.burn>0.33?0.5:0.3));}
    else{const im=api.asset(name);if(im.ready)srcImg=im;}
    if(!srcImg)return false;
    const sz=Math.max(0,r*2.3);
    g.save();
    // 木と木箱は くるくる回さず、流れに揺れる程度(画像だと回転が不自然なので手描き側の回転を打ち消す)
    if(it.type!=="rock"){g.rotate(-it.rot);g.rotate(Math.sin(it.bob*0.7)*0.12);}
    // 足元の薄い影(奥行き)
    g.fillStyle="rgba(0,0,0,.22)";g.beginPath();g.ellipse(0,r*0.85,Math.max(0,r*0.8),Math.max(0,r*0.22),0,0,TAU);g.fill();
    api.drawSrc(srcImg,0,0,sz,sz,{center:true});
    // ② ラッキー種類のヒント: 頭上で小さな星がキラッ(手描きの ラッキー! 演出と同じ気づきの導線)
    if(it.type===luckyType&&!it.eaten){
      const lp=0.55+0.45*Math.sin(tGlobal*0.22);
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=lp;g.fillStyle="#fff7c2";
      g.translate(r*0.55,-r*1.05);
      g.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*0.08*lp:r*0.18*lp;
        g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}g.closePath();g.fill();
      g.restore();g.globalAlpha=1;
    }
    g.restore();
    return true;
  }

  // ---------- main hooks ----------
  return{
    resize:layout,
    input(x,y,type){
      if(type!=="down")return;
      if(clearT>0)return;
      // ④ ながれ星ひみつ: よぎる ながれ星に タッチできたら ごほうび(減点なし)。方向転換はそのまま。
      if(shootStar&&Math.hypot(x-shootStar.x,y-shootStar.y)<Math.max(42,api.W*0.08)){
        const sx=shootStar.x,sy=shootStar.y;shootStar=null;
        count+=1;api.setScore(count);
        api.tone(1568,0.1,"triangle",0.09);api.tone(2093,0.12,"triangle",0.06);
        for(let i=0;i<12;i++){const a=rnd(0,TAU),sp=rnd(2,6);
          embers.push({x:sx,y:sy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:rnd(1.5,3),life:1,decay:rnd(0.02,0.04)});}
        rings.push({x:sx,y:sy,r:4,vr:laneH*0.4,life:1,decay:0.05,col:"#ffe14a"});
        floats.push({x:clamp(sx,80,api.W-80),y:clamp(sy,70,api.H-90),txt:starSeen?"ながれ星！ ＋1":"ながれ星 はっけん！ ＋1",life:1,vy:-0.9,col:"#fff0a0",size:starSeen?22:26});
        starSeen=true;
      }
      // 軸3対策: 画面のどこを叩いても効くと連打が最適戦略になってしまうので、
      // 「レーンを進んでいるアイテムの近く」を叩いたときだけ切り替える(狙いが要る)
      let near=false;
      for(const it of items){
        if(it.eaten)continue;
        const p=lavaPos(it.d,it.t);
        // 軸3対策(2R): 1.5→1.1に絞り、アイテムの すぐ近くでないと「狙った」扱いにしない
        // 軸3対策(3R): ①②だけではscorePerTapの下がりが足りなかったため、1.1→0.95・下限34→28にもう一段絞る
        // (missRateの上振れをN=1..20で確認済み。firstScoreSec/maxQuietSecの合格ラインは崩れていない)
        const rr=Math.max(28,laneH*0.34*it.s*0.95);
        if(Math.hypot(x-p.x,y-p.y)<rr){near=true;break;}
      }
      if(!near){ // 狙いが外れたタップ: 音だけ鳴らして切り替えは起きない(壊れた入力に見せないため)
        api.tone(280,0.05,"sine",0.05);
        return;
      }
      // 軸3の補助策: 距離条件をくぐった連打にも短いクールダウンを追加(効果は座標条件が主)
      if(dirCool>0){api.tone(280,0.05,"sine",0.05);return;}
      dirCool=22;   // 軸3対策(2R): 10→22(約350〜370ms)にして連打の切替頻度そのものを下げる
      // tap toggles flow direction; but only items near the tap point snap into the new lane
      // (軸3対策(2R): 全アイテム一括切替をやめ、当たり判定を「叩いた場所の近く」だけに絞る。
      //  遠くのアイテムは連動しないので、1回当てただけで画面上の全部が得点化される連鎖を防ぐ)
      dir=-dir;
      api.slide(300,520,0.12,0.18,"square");api.tone(660,0.08,"triangle",0.08);
      api.shake(3);
      // 軸3対策(3R): 140/0.22→100/0.14に縮小し、1タップで同時に向きが変わるアイテム数を減らす
      // (1タップ=1個のはずのscorePerTapが高止まりしていたのは、この半径が広すぎて連鎖していたのが主因。
      //  100/0.15まで絞るとfirstScoreSec/maxQuietSecが悪化したため、104/0.14相当に留める)
      const infR=Math.max(100,api.W*0.14);
      for(const it of items){
        if(it.eaten)continue;
        const p=lavaPos(it.d,it.t);
        if(Math.hypot(x-p.x,y-p.y)<infR)it.d=dir;
      }
    },
    frame(dt,now){
      tGlobal+=dt;heatT+=dt;
      if(hsCool>0)hsCool-=dt;
      if(dirCool>0)dirCool-=dt;
      paused=clearT>0;
      if(fever>0&&!paused){fever-=0.016*dt;if(fever<=0)endFever();}
      const P=pal();
      // ---- sky: 画像背景(cover-fit) or 従来の火山グラデ ----
      imgBg=api.drawCover("bg.jpg");
      if(imgBg){
        // 画像背景: ステージのパレット色を薄く重ねて面ごとの雰囲気を変える(1面=あかい かざんは絵のまま)
        const pi=(stage-1)%PAL.length;
        if(pi!==0){g.save();g.globalAlpha=0.26;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,P.sky1);tg.addColorStop(0.5,P.sky2);tg.addColorStop(1,P.sky3);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      }else{
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,P.sky1);grd.addColorStop(0.4,P.sky2);grd.addColorStop(0.72,P.sky3);grd.addColorStop(1,P.rock);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // distant glow from the crater
      let cg=g.createRadialGradient(src.x,src.y,0,src.x,src.y,api.W*0.6);
      cg.addColorStop(0,"rgba(255,120,40,0.28)");cg.addColorStop(1,"rgba(255,120,40,0)");
      g.fillStyle=cg;g.fillRect(0,0,api.W,api.H);
      // FEVER: whole sky turns molten gold (pulsing additive wash)
      if(fever>0){g.save();g.globalCompositeOperation="lighter";
        const fa=0.14+0.06*Math.sin(tGlobal*0.3);
        let fg=g.createLinearGradient(0,0,0,api.H);
        fg.addColorStop(0,"rgba(255,220,80,"+fa+")");fg.addColorStop(1,"rgba(255,120,40,"+(fa*0.5)+")");
        g.fillStyle=fg;g.fillRect(0,0,api.W,api.H);g.restore();}
      // heat shimmer band (cheap horizontal wobble strips, additive)
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.05;
      for(let i=0;i<6;i++){const yy=api.H*(0.3+i*0.07)+Math.sin(heatT*0.06+i)*6;
        g.fillStyle="#ff8a40";g.fillRect(0,yy,api.W,3);}
      g.restore();g.globalAlpha=1;
      // background volcano silhouettes + ground rock ※画像背景のときは絵の山と地面を活かして描かない
      if(!imgBg){
        g.fillStyle=P.rock2;
        g.beginPath();g.moveTo(0,api.H);g.lineTo(api.W*0.18,api.H*0.42);g.lineTo(api.W*0.36,api.H);g.closePath();g.fill();
        g.beginPath();g.moveTo(api.W*0.62,api.H);g.lineTo(api.W*0.84,api.H*0.38);g.lineTo(api.W,api.H);g.closePath();g.fill();
        g.fillStyle=P.rock;g.fillRect(0,api.H*0.82,api.W,api.H*0.18);
      }

      // ④ ながれ星: ときどき 火山の夜空を すーっと よぎる(タッチで隠しごほうび)
      if(!paused&&!shootStar&&Math.random()<0.0016*dt){
        const fromLeft=Math.random()<0.5;
        shootStar={x:fromLeft?-20:api.W+20,y:api.H*rnd(0.08,0.22),
          vx:(fromLeft?1:-1)*rnd(2.4,3.6),vy:rnd(0.5,1.1),trail:[]};}
      if(shootStar){
        const s=shootStar;if(!paused){s.x+=s.vx*dt;s.y+=s.vy*dt;}
        s.trail.push({x:s.x,y:s.y});if(s.trail.length>10)s.trail.shift();
        g.save();g.globalCompositeOperation="lighter";
        for(let i=0;i<s.trail.length;i++){const tp=s.trail[i],a=i/s.trail.length;
          g.globalAlpha=a*0.55;g.fillStyle="#fff0a0";
          g.beginPath();g.arc(tp.x,tp.y,Math.max(0,3*a),0,TAU);g.fill();}
        g.globalAlpha=1;g.shadowColor="#ffe14a";g.shadowBlur=10;g.fillStyle="#fff";
        g.beginPath();g.arc(s.x,s.y,Math.max(0,3.2),0,TAU);g.fill();
        g.shadowBlur=0;g.restore();g.globalAlpha=1;
        if(s.x<-40||s.x>api.W+40||s.y>api.H*0.42)shootStar=null;}

      // ---- lava lanes (active = current dir) ----
      drawLane(laneFor(-dir),false);
      drawLane(laneFor(dir),true);
      drawSource();

      // ---- spawn + advance items ----
      // 7〜8歳向け: 出現間隔 60→48f、流れ 0.006→0.0072 と 2割ほど速く(操作は変えない)
      if(!paused){spawnT-=dt;if(spawnT<=0){spawn();
        spawnT=fever>0?rint(8,13):clamp(48-(stage-1)*5,24,48);}}
      const flowSpd=(0.0072+(stage-1)*0.001)*(fever>0?1.7:1);
      // FEVER: rainbow lava fountain from the crater
      if(fever>0&&!paused&&tGlobal%3<dt){const a=-TAU/4+rnd(-0.7,0.7),sp=rnd(6,11);
        blobs.push({x:src.x,y:src.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:rnd(3,7),
          life:1,decay:rnd(0.015,0.03),col:pick(RAINBOW)});}
      for(const it of items){
        it.bob+=0.1*dt;it.rot+=it.vr*dt;
        // gold nugget leaves a sparkle trail while riding
        if(it.type==="gold"&&!it.eaten&&Math.random()<0.12*dt){const pp=lavaPos(it.d,it.t);
          embers.push({x:pp.x+rnd(-8,8),y:pp.y-laneH*0.25,vx:rnd(-0.4,0.4),vy:-rnd(0.5,1.2),
            r:rnd(1.2,2.4),life:1,decay:rnd(0.02,0.04)});}
        if(it.eaten){
          it.burn=Math.max(0,it.burn-0.04*dt);it.life-=0.05*dt;
          if(it.life<=0)it._dead=true;
          continue;
        }
        if(!paused){
          // items only flow if they're riding the active lane
          if(it.d===dir){it.t+=flowSpd*dt;}
          else{it.t+=flowSpd*0.25*dt;}
        }
        // reaching the molten mouth zone -> consumed
        if(it.d===dir&&it.t>=0.42){eat(it);continue;}
        // items that ride a cold lane all the way just slide off the edge (no penalty)
        // ③ パーフェクト判定: 流し捨てた=まぐまに たべさせ そこねた として記録(ゲームオーバーには しない)
        if(it.t>=1){it._dead=true;stageWaste++;}
      }
      // draw cold-lane items first (behind), then active
      // 軸6対策: ステージクリア演出中(clearT>0)はアイテムが静止したままバナー文字に重なって読みにくくなるため、描かない
      if(clearT<=0){
        for(const it of items){if(it.eaten||it.d!==dir)drawItem(it);}
        for(const it of items){if(!it.eaten&&it.d===dir)drawItem(it);}
      }
      items=items.filter(it=>!it._dead);
      if(items.length>40)items.splice(0,items.length-40);

      // ---- lava blobs (splash) ----
      g.save();g.globalCompositeOperation="lighter";
      for(const b of blobs){b.vy+=0.4*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=b.decay*dt;
        g.globalAlpha=Math.max(0,b.life);g.fillStyle=b.col;g.shadowColor=b.col;g.shadowBlur=8;
        g.beginPath();g.arc(b.x,b.y,b.r*(0.5+b.life*0.5),0,TAU);g.fill();}
      g.shadowBlur=0;g.restore();g.globalAlpha=1;
      blobs=blobs.filter(b=>b.life>0&&b.y<api.H+40);
      if(blobs.length>140)blobs.splice(0,blobs.length-140);

      // ---- shockwave rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.6;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);

      // ---- embers (sparks rising) ----
      g.save();g.globalCompositeOperation="lighter";
      for(const e of embers){e.vy+=0.06*dt;e.x+=e.vx*dt;e.y+=e.vy*dt;e.vx*=0.98;e.life-=e.decay*dt;
        g.globalAlpha=Math.max(0,e.life);g.fillStyle="#ffd23f";g.shadowColor="#ff8a20";g.shadowBlur=6;
        g.beginPath();g.arc(e.x,e.y,e.r*Math.max(0.3,e.life),0,TAU);g.fill();}
      g.shadowBlur=0;g.restore();g.globalAlpha=1;
      embers=embers.filter(e=>e.life>0&&e.y>-20);
      if(embers.length>160)embers.splice(0,embers.length-160);

      // ambient embers drifting up from lava
      if(!paused&&tGlobal%4<dt){const L=laneFor(dir),t=rnd(0,0.45),p=lavaPos(dir,t);
        embers.push({x:p.x,y:p.y,vx:rnd(-0.6,0.6),vy:-rnd(0.8,2),r:rnd(1.2,2.6),life:1,decay:rnd(0.01,0.02)});}

      // ---- smoke puffs ----
      for(const s of smokes){s.y+=s.vy*dt;s.x+=s.vx*dt;s.r+=0.3*dt;s.life-=s.decay*dt;
        g.globalAlpha=Math.max(0,s.life)*0.4;g.fillStyle="#3a3030";
        g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();}
      g.globalAlpha=1;
      smokes=smokes.filter(s=>s.life>0&&s.y>-40);
      if(smokes.length>90)smokes.splice(0,smokes.length-90);

      // ---- combo timer ----
      if(combo>0){comboT-=0.014*dt;if(comboT<=0)combo=0;}

      // ---- big eruption full-screen glow + flash ----
      if(eruptT>0){eruptT-=0.016*dt;const ea=clamp(eruptT,0,1);
        g.save();g.globalCompositeOperation="lighter";
        const ew=g.createRadialGradient(src.x,src.y,0,src.x,src.y,api.W*0.8);
        ew.addColorStop(0,"rgba(255,230,150,"+(0.5*ea)+")");
        ew.addColorStop(0.5,"rgba(255,140,40,"+(0.28*ea)+")");
        ew.addColorStop(1,"rgba(255,120,30,0)");
        g.fillStyle=ew;g.fillRect(0,0,api.W,api.H);g.restore();
        if(eruptT<=0){eruptT=0;erupt=0;}}
      if(erupt>0)erupt=Math.max(0,erupt-0.02*dt);

      // impact flash
      if(flash>0){flash-=0.06*dt;
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=Math.max(0,flash)*0.3;
        g.fillStyle="#ff8a30";g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}

      // ---- HUD (top center only) ----
      drawHUD();

      // ---- combo text (top center) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.13);g.scale(pop,pop);
        g.font="800 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(255,140,40,.9)";g.shadowBlur=14;
        g.fillStyle="#ffd23f";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.6)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }

      // ---- floating point texts (gold / fever) ----
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.018*dt;
        g.save();g.globalAlpha=clamp(f.life,0,1);g.textAlign="center";
        g.font="900 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=4;g.lineJoin="round";g.strokeStyle="rgba(30,10,4,.6)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.restore();}
      g.globalAlpha=1;g.textAlign="left";
      floats=floats.filter(f=>f.life>0);
      if(floats.length>10)floats.splice(0,floats.length-10);

      // ---- FEVER banner (entry) + rainbow title ----
      if(feverBanner>0){feverBanner-=0.016*dt;
        const a=clamp(feverBanner*1.4,0,1),pop=1+Math.max(0,feverBanner-1.4)*2+0.06*Math.sin(tGlobal*0.6);
        g.save();g.translate(api.W/2,api.H*0.30);g.scale(pop,pop);g.globalAlpha=a;
        g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.lineJoin="round";g.strokeStyle="rgba(40,10,4,.7)";
        g.strokeText("フィーバー タイム！",0,0);
        let rg2=g.createLinearGradient(-170,0,170,0);
        for(let i=0;i<RAINBOW.length;i++)rg2.addColorStop(i/(RAINBOW.length-1),RAINBOW[i]);
        g.shadowColor="rgba(255,200,50,.95)";g.shadowBlur=22;
        g.fillStyle=rg2;g.fillText("フィーバー タイム！",0,0);
        g.shadowBlur=0;g.font="800 20px 'Hiragino Maru Gothic ProN',system-ui";
        g.fillStyle="#fff";g.fillText("てんすう 2ばい！",0,34);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.lineJoin="miter";
      }

      // ---- big-eruption banner ----
      // 軸6対策(3R): フィーバー開始バナー(H*0.30)と同座標に重なっていた欠陥を修正。
      // フィーバー中はだいふんか!バナーを出さない(コンボ8達成とフィーバーゲージ満タンは
      // 「たくさん当てた直後」に同時に起きやすく、実プレイで重なる余地があった)
      if(eruptT>0.5&&feverBanner<=0){
        g.save();g.translate(api.W/2,api.H*0.30);
        g.globalAlpha=clamp((eruptT-0.5)*2,0,1);
        g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.shadowColor="rgba(255,120,20,1)";g.shadowBlur=22;g.fillStyle="#ffd23f";
        g.fillText("だいふんか！",0,0);
        g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle="#fff";g.strokeText("だいふんか！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }

      // ② きょうのラッキー色 はっけん: 中央上に一度だけ そっと教える
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        const a=clamp(luckyMsgT*1.3,0,1);
        g.save();g.translate(api.W/2,api.H*0.24);g.globalAlpha=a;g.textAlign="center";
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうの ラッキーいろは 「"+luckyName+"」！";
        g.lineWidth=5;g.lineJoin="round";g.strokeStyle="rgba(30,10,4,.6)";g.strokeText(t2,0,0);
        g.fillStyle=luckyCol;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.lineJoin="miter";if(luckyMsgT<0)luckyMsgT=0;}
      // ① にじいろ ようがん が でた！ 接近予告(下寄り=上部バナーと重ねない)
      if(rbComingT>0){rbComingT-=0.016*dt;
        const col=RAINBOW[Math.floor(tGlobal*0.12)%RAINBOW.length];
        g.save();g.translate(api.W/2,api.H*0.66);g.textAlign="center";
        g.globalAlpha=clamp(rbComingT*1.4,0,1);g.font="800 21px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=4;g.lineJoin="round";g.strokeStyle="rgba(30,10,4,.6)";g.strokeText("にじいろ ようがん が でた！",0,0);
        g.fillStyle=col;g.fillText("にじいろ ようがん が でた！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.lineJoin="miter";if(rbComingT<0)rbComingT=0;}
      // ① にじいろ ようがん！ 撃破バナー(虹色に色替わり)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=RAINBOW[Math.floor(tGlobal*0.12)%RAINBOW.length];
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 38px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=6;g.lineJoin="round";g.strokeStyle="rgba(30,10,4,.6)";g.strokeText("にじいろ ようがん！",0,0);
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle="#fff";g.fillText("にじいろ ようがん！",0,0);
        g.shadowBlur=0;g.restore();g.globalAlpha=1;g.textAlign="left";g.lineJoin="miter";if(rbMsgT<0)rbMsgT=0;}
      // ③ パーフェクト！ ボーナス(ステージクリア文字の下=重ねない)
      if(perfectT>0){perfectT-=0.014*dt;
        const pop=1+Math.max(0,perfectT-1.3)*1.4;
        g.save();g.translate(api.W/2,api.H*0.6);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(perfectT*1.3,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=16;
        g.fillStyle="#c7ffcf";g.fillText("パーフェクト！ ＋3",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,120,60,.7)";g.strokeText("パーフェクト！ ＋3",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(perfectT<0)perfectT=0;}

      // ---- stage clear banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        // 軸6対策(2R): 暗幕を0.62→0.8に濃くして、後ろの発光レーンをしっかり隠す土台にする
        g.save();g.globalAlpha=a*0.8;g.fillStyle="#000";g.fillRect(0,api.H*0.34,api.W,api.H*0.2);g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save();g.translate(api.W/2,api.H*0.44);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        // 軸6対策(2R): 金色(#ffd23f)は背後の発光レーン(黄〜白)と同系色で埋もれるため、
        // 暖色の背景と確実に分離する寒色系(#4db8ff)に変更(白フチはそのまま維持し二重の縁取りで可読性を出す)
        g.shadowColor="rgba(20,40,70,.9)";g.shadowBlur=20;g.fillStyle="#4db8ff";
        g.fillText("ステージ クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ クリア！",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("つぎは 「"+STAGE_NAMES[(stage-1)%STAGE_NAMES.length]+"」！",0,40);
        g.font="800 17px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#ffe14a";
        g.fillText(stage>1?"ゴールドいわが でやすく なるよ！":"また あたらしい たびの はじまり！",0,68);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=18;}
      }
      // 加算合成をフレーム末で確実に既定へ戻す(白飛び漏れ防止・実ブラウザでは各blockがsave/restore済み)
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
    },
    stop(){}
  };

  function drawHUD(){
    const left=clamp(stageGoal-stageEat,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=15,bx=(api.W-bw)/2,by=api.H*0.045;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(0,0,0,.6)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+" / "+STAGES+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,0,0,.4)";roundRect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageEat/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#ff5b14");gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg;roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;roundRect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
    drawFeverBar();
  }
  function drawFeverBar(){
    // bottom-center fever gauge: fills by eating, drains as fever timer runs
    const fw=Math.min(api.W*0.5,240),fh=14,fx=(api.W-fw)/2,fy=api.H-32;
    const active=fever>0,fr=active?clamp(fever/FEVER_LEN,0,1):clamp(feverGauge,0,1);
    g.save();g.textAlign="center";
    g.fillStyle="rgba(0,0,0,.45)";roundRect(fx-4,fy-3,fw+8,fh+6,(fh+6)/2);g.fill();
    if(fr>0.01){
      if(active){let pg=g.createLinearGradient(fx,0,fx+fw,0);
        for(let i=0;i<RAINBOW.length;i++)pg.addColorStop(i/(RAINBOW.length-1),RAINBOW[i]);
        g.shadowColor="#ffe14a";g.shadowBlur=12+6*Math.sin(tGlobal*0.5);g.fillStyle=pg;}
      else{let pg=g.createLinearGradient(fx,0,fx+fw,0);
        pg.addColorStop(0,"#ff8a20");pg.addColorStop(1,"#ffe14a");
        if(fr>=0.99){g.shadowColor="#ffe14a";g.shadowBlur=10+6*Math.sin(tGlobal*0.5);}
        g.fillStyle=pg;}
      roundRect(fx,fy,Math.max(fh,fw*fr),fh,fh/2);g.fill();g.shadowBlur=0;}
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;roundRect(fx-4,fy-3,fw+8,fh+6,(fh+6)/2);g.stroke();
    g.font="800 14px 'Hiragino Maru Gothic ProN',system-ui";
    g.lineWidth=4;g.lineJoin="round";g.strokeStyle="rgba(30,10,4,.6)";
    const label=active?"フィーバーちゅう！ 2ばい！":"フィーバー ゲージ";
    g.strokeText(label,api.W/2,fy-8);
    g.fillStyle=active?"#ffe14a":"#fff5d6";g.fillText(label,api.W/2,fy-8);
    g.restore();g.textAlign="left";g.lineJoin="miter";
  }
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
}
Engine.register("magmaflow", build_magmaflow);
