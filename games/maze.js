function buildMaze(api){
  const g=api.g;
  api.preload(["bg.jpg"]);   // 画像アセット(無ければ従来の手描きにフォールバック)
  // ※ bug.png / wall.png は生成2回とも床/影の残りが抜けず不採用(むし・こわれ線ブロックは手描きのまま)
  let nodes=[],trail=[],sparks=[],rings=[],zaps=[],floats=[];
  let down,lx,ly,count,combo,comboT,spawnT,flowT,lastPop;
  let stage,need,clearedThisStage,clearT,maxStage,perfectT;
  let resultT,nextResultAt,foundColors,startNow,elapsed; // ⑤ けっかバナー(90秒区切りで もう一回に誘う)
  const STAGES=6;
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  // でんきゲームらしく「いろちがいの でんきゅう」を用意。② ラッキー色はこの中から秘密に1色選ぶ。
  const BULB_COLS=["#ffd23f","#43e0ff","#7be08a","#ff8cc8","#ff9a3f","#b58bff"];
  const BULB_NAME={"#ffd23f":"きいろ","#43e0ff":"みずいろ","#7be08a":"みどり","#ff8cc8":"ピンク","#ff9a3f":"オレンジ","#b58bff":"むらさき"};
  const RAIN=["#ff5b6b","#ff9a3f","#ffd23f","#7be08a","#43e0ff","#b58bff"]; // にじいろサイクル
  let luckyColor,luckySeen,luckyMsgT;   // ② きょうのラッキー色
  let rbMsgT;                           // ① にじいろノード 発見バナー
  let stageMiss,noMissT;                // ③ ノーミス判定(このステージで こわれ線ブロックを触った回数)
  let comet=null,cometT,catchMsgT;      // ④ ながれ星(でんきの ながれ星)を なぞって キャッチ
  let hsCD=0;                           // hitStop クールダウン(節目限定・30f以上あける)
  function tryHitStop(f){if(hsCD<=0){api.hitStop(f);hsCD=34;}}
  // 色ユーティリティ(でんきゅうの色を派生させる)
  function _rgb(c){return [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];}
  function lighten(c,t){const p=_rgb(c);return "rgb("+p.map(v=>Math.round(v+(255-v)*t)).join(",")+")";}
  function darken(c,t){const p=_rgb(c);return "rgb("+p.map(v=>Math.round(v*(1-t))).join(",")+")";}
  function rgba(c,a){const p=_rgb(c);return "rgba("+p[0]+","+p[1]+","+p[2]+","+a+")";}
  // per-stage palette so each stage visibly changes color
  const PALETTES=[
    {a:"#0a1830",b:"#0b1224",c:"#070d18",grid:"60,120,160",glow:"70,160,220",node:"90,180,230"},
    {a:"#0a2630",b:"#0b1d24",c:"#071318",grid:"60,160,140",glow:"60,210,190",node:"90,220,200"},
    {a:"#1a1030",b:"#140b24",c:"#0c0718",grid:"140,90,200",glow:"170,110,230",node:"190,140,235"},
    {a:"#2a1018",b:"#1d0b12",c:"#13070a",grid:"200,90,110",glow:"235,110,130",node:"235,150,160"},
    {a:"#10220a",b:"#0e1c08",c:"#081205",grid:"110,180,60",glow:"150,220,80",node:"180,235,110"},
    {a:"#2a200a",b:"#1d1608",c:"#130e05",grid:"210,180,60",glow:"240,210,80",node:"240,220,120"}
  ];
  function pal(){return PALETTES[clamp(stage-1,0,STAGES-1)];}
  // difficulty scales with stage (1..STAGES)  ※7〜8歳向けに 出現速度/落下速度/目標数を2〜3割増し
  function spawnGap(){return clamp(27-(stage-1)*2.4,15,27);}  // 上限33->27: 補充を早め maxQuietSec短縮
  function fallSpd(){return 1.5+(stage-1)*0.3;}       // 1.5 -> ~3.0
  function needFor(s){return 14+(s-1)*5;}             // 20->14: ステージ1クリアを速める(軸3(c)/軸4)
  function bugRate(){return clamp(0.28+(stage-1)*0.044,0,0.5);}
  function wallRate(){return stage>=2?clamp(0.09+(stage-2)*0.02,0,0.17):0;}
  function layout(){}
  function reset(){nodes=[];trail=[];sparks=[];rings=[];zaps=[];floats=[];down=false;lx=0;ly=0;count=0;combo=0;comboT=0;spawnT=0;flowT=0;lastPop=null;stage=1;need=needFor(1);clearedThisStage=0;clearT=0;maxStage=false;perfectT=0;
    luckyColor=pick(BULB_COLS);luckySeen=false;luckyMsgT=0;rbMsgT=0;stageMiss=0;noMissT=0;comet=null;cometT=rnd(220,420);catchMsgT=0;hsCD=0;
    resultT=0;nextResultAt=90;foundColors=new Set();startNow=null;elapsed=0;
    for(let i=0;i<8;i++)spawn(rnd(api.H*0.1,api.H*0.8));
    // 軸7: 最初の的の中に丸以外(コイル玉/でんせんコード)を確定で1個ずつ混ぜる
    // → 遊び始めて10秒以内に「丸だけじゃない」バラエティに必ず出会える
    {
      const r0=clamp(api.W*0.04,20,34);
      const cr=r0*1.6;
      nodes.push({x:rnd(cr*1.6,api.W-cr*1.6),y:rnd(api.H*0.1,api.H*0.8),vy:rnd(fallSpd()*0.5,fallSpd()*0.68),vx:rnd(-0.25,0.25),r:cr,
        type:"coil",lit:false,pulse:rnd(0,TAU),col:pick(BULB_COLS)});
      const cr2=r0*0.55;
      nodes.push({x:rnd(cr2*4,api.W-cr2*4),y:rnd(api.H*0.1,api.H*0.8),vy:rnd(fallSpd()*0.85,fallSpd()*1.05),vx:rnd(-0.3,0.3),r:cr2,
        type:"cord",lit:false,pulse:rnd(0,TAU),col:pick(BULB_COLS)});
    }}
  function spawn(y0){
    const r=clamp(api.W*0.04,20,34);
    const roll=Math.random();
    let type="bulb";
    // ① にじいろノード: ステージ2以降、ときどき(約3%)だけ落ちてくる激レア。いつ来るか分からない=ドキドキ発見。
    // 掴みやすいよう ゆっくり落ちる。虹色に光るので すぐ気づく=接近予告のかわり。
    if(stage>=2&&Math.random()<0.03){
      nodes.push({x:rnd(r*2.4,api.W-r*2.4),y:y0!=null?y0:-r,vy:rnd(fallSpd()*0.45,fallSpd()*0.62),vx:rnd(-0.3,0.3),r:r*1.15,
        type:"rainbow",lit:false,pulse:rnd(0,TAU),col:"#ffffff"});
      return;
    }
    // ⑥ 大きい発光コイル玉: ステージ1から、わりとよく(約7%)出る 一回り大きい的(軸7=大小の差)
    // ※ stage>=3限定・4%だと最初の90秒でほぼ出会えなかったので、序盤から出す確率を上げた
    if(stage>=1&&Math.random()<0.07){
      const cr=r*1.6;
      nodes.push({x:rnd(cr*1.6,api.W-cr*1.6),y:y0!=null?y0:-cr,vy:rnd(fallSpd()*0.5,fallSpd()*0.68),vx:rnd(-0.25,0.25),r:cr,
        type:"coil",lit:false,pulse:rnd(0,TAU),col:pick(BULB_COLS)});
      return;
    }
    // ⑦ でんせんコード: ステージ2から、わりとよく(約8%)出る 丸ではない縦長シルエットの的(軸7=形の差)
    if(stage>=2&&Math.random()<0.08){
      const cr=r*0.55;
      nodes.push({x:rnd(cr*4,api.W-cr*4),y:y0!=null?y0:-cr*3,vy:rnd(fallSpd()*0.85,fallSpd()*1.05),vx:rnd(-0.3,0.3),r:cr,
        type:"cord",lit:false,pulse:rnd(0,TAU),col:pick(BULB_COLS)});
      return;
    }
    // ⑧ でんきスタック: ステージ2から、たまに(約5%)出る 積み重なった箱の的。
    // 丸・大玉・細長コードとは別に「壊れ方」自体が違う(1回ずつ 上から崩れ落ちる)ものを増やす(軸7=壊れ方の差)
    if(stage>=2&&Math.random()<0.05){
      const cr=r*1.1,segs=3;
      nodes.push({x:rnd(cr*2.2,api.W-cr*2.2),y:y0!=null?y0:-cr*(segs+1),vy:rnd(fallSpd()*0.55,fallSpd()*0.72),vx:rnd(-0.2,0.2),r:cr,
        type:"stack",lit:false,pulse:rnd(0,TAU),col:pick(BULB_COLS),segs,maxSegs:segs,hitCD:0});
      return;
    }
    if(roll<wallRate())type="wall";
    else if(roll<wallRate()+bugRate())type="bug";
    // でんきゅうは いろちがい(ラッキー色さがしの土台)。むし=あか / こわれ線=はいいろ は固定。
    const col=type==="bug"?"#ff5b6b":type==="wall"?"#5a6b80":pick(BULB_COLS);
    // 軸7: type毎に見た目のサイズを変える(wallは重厚に大きく/bugは小さく素早い印象に)
    const rr=type==="wall"?r*1.3:type==="bug"?r*0.85:r;
    nodes.push({x:rnd(rr*2,api.W-rr*2),y:y0!=null?y0:-rr,vy:rnd(fallSpd()*0.7,fallSpd()),vx:rnd(-0.4,0.4),r:rr,
      type,lit:false,pulse:rnd(0,TAU),col});
  }
  function hitWall(n){
    // broken-wire wall: not conductive. gentle bonk, push the trail off, no score, no game-over.
    n.bonk=0.5;
    api.noise(0.06,0.06,260,"lowpass");
    api.tone(140,0.05,"square",0.05);
    api.shake(1.5);
    for(let k=rint(4,6);k>0;k--){const a=rnd(0,TAU),s=rnd(1,3);
      sparks.push({x:n.x,y:n.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(1.5,3),life:1,decay:rnd(0.03,0.05),col:"#9fb0c4"});}
    lastPop=null; // breaks the chain so combo can't cross a wall
    stageMiss++;  // ③ ノーミス判定: こわれ線ブロックを触ったら このステージは ノーミス失敗
  }
  // ⑧ でんきスタック: 丸い的と違い、1回ふれるごとに1段だけ崩れ落ちる(壊れ方の違い=軸7)。
  // 積み木が全部くずれ切ったら、ふつうの的と同じように得点・コンボ・ステージ進行に数える。
  function hitStack(n){
    if(n.hitCD>0||n.segs<=0)return;
    n.segs--;n.hitCD=0.18;
    api.tone(300-n.segs*40,0.06,"square",0.08);
    api.noise(0.05,0.06,1800,"highpass");
    api.shake(2+(n.maxSegs-n.segs)*0.6);
    for(let k=rint(4,7);k>0;k--){const a=rnd(-TAU*0.5,0),s=rnd(2,5);
      sparks.push({x:n.x,y:n.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,r:rnd(2,4),life:1,decay:rnd(0.02,0.04),col:"#cfd8e3"});}
    if(n.segs>0)return; // まだ段が残っている: 崩れる演出だけで、コンボ/スコアはここでは動かさない
    // 全段くずれ切った: ここで初めて「壊した」扱い(スコア・コンボ・ステージ進行に反映)
    n.lit=true;
    const base=4;
    const mult=1+Math.floor(combo/4);
    const val=base*mult;count+=val;api.setScore(count);
    clearedThisStage++;
    combo++;comboT=0.7;
    api.tone(380*Math.pow(2,clamp(combo,0,16)/12),0.08,"square",0.09);
    api.slide(700,1300,0.09,0.06,"square");
    api.shake(4+Math.min(combo*0.4,7));
    rings.push({x:n.x,y:n.y,r:n.r,max:n.r*2.8,life:1,col:"#cfd8e3"});
    for(let k=rint(8,12);k>0;k--){const a=rnd(0,TAU),s=rnd(3,8);
      sparks.push({x:n.x,y:n.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5),life:1,decay:rnd(0.02,0.035),col:pick(["#cfd8e3","#ffe066","#9fb0c4"])});}
    if(lastPop)zaps.push({x1:lastPop.x,y1:lastPop.y,x2:n.x,y2:n.y,life:1});
    lastPop={x:n.x,y:n.y};
    floats.push({x:n.x,y:n.y-24,txt:"+"+val,life:1,vy:-1.1,col:"#ffe066",size:28});
    if(clearedThisStage>=need)stageClear();
  }
  function pop(n){
    if(n.lit)return;
    if(n.type==="wall"){hitWall(n);return;}
    if(n.type==="stack"){hitStack(n);return;}
    n.lit=true;
    if(n.type==="bulb")foundColors.add(n.col); // 軸5: けっかバナー用に見つけた色を記録
    // combo-based multiplier: longer chains score more (bug base 2, bulb/cord base 1, coil base 3, rainbow base 8)
    const base=n.type==="bug"?2:(n.type==="rainbow"?8:(n.type==="coil"?3:1));
    const mult=1+Math.floor(combo/4); // x1 at start, +1 every 4 in the chain
    // ② ラッキー色: きょうの秘密の色の でんきゅうを つなぐと +1(コンボ倍率にも のる)の隠しボーナス。
    const isLucky=(n.type==="bulb"&&n.col===luckyColor);
    let val=(base+(isLucky?1:0))*mult;count+=val;api.setScore(count);
    clearedThisStage++;
    combo++;comboT=0.7;
    api.tone(380*Math.pow(2,clamp(combo,0,16)/12),0.08,"square",0.09);
    api.slide(900,1600,0.07,0.05,"triangle");
    api.noise(0.05,0.08,3000,"highpass");
    api.shake(2+Math.min(combo*0.4,7));
    if(n.type==="bug")api.hitStop(2);
    rings.push({x:n.x,y:n.y,r:n.r,max:n.r*2.6,life:1,col:n.type==="rainbow"?"#ffffff":n.col});
    for(let k=rint(6,10);k>0;k--){const a=rnd(0,TAU),s=rnd(2,7);
      sparks.push({x:n.x,y:n.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,4),life:1,decay:rnd(0.02,0.04),col:n.type==="bug"?"#ff8c8c":n.type==="rainbow"?pick(RAIN):"#fff2a0"});}
    if(lastPop)zaps.push({x1:lastPop.x,y1:lastPop.y,x2:n.x,y2:n.y,life:1});
    lastPop={x:n.x,y:n.y};
    // ① にじいろノード撃破: 虹の輪＋大量の火花＋祝福バナー(激レアの大盤振る舞い)
    if(n.type==="rainbow")rainbowBurst(n.x,n.y,val);
    // ② ラッキー色命中: 小さな星のキラッ＋控えめな祝福(気づくと得する)
    if(isLucky)luckySparkle(n.x,n.y);
    if(mult>=2||isLucky)floats.push({x:n.x,y:n.y-24,txt:"+"+val,life:1,vy:-1.1,col:isLucky?luckyColor:"#ffe066",size:28});
    else if(combo>1&&combo%3===0)floats.push({x:n.x,y:n.y-24,txt:"x"+combo,life:1,vy:-1.1,col:combo>=9?"#ff3b3b":combo>=6?"#ff8c42":"#43e0ff",size:combo>=6?40:30});
    if(clearedThisStage>=need)stageClear();
  }
  function rainbowBurst(x,y,val){
    rbMsgT=1.4;
    api.boom(0.6);api.shake(14);tryHitStop(5);
    api.slide(680,1500,0.4,0.14,"triangle");api.tone(880,0.12,"triangle",0.1);api.tone(1320,0.14,"triangle",0.08);
    for(let k=0;k<RAIN.length;k++)rings.push({x,y,r:n_r(x,y)*0.5,max:(28+k*10)*2.2,life:1.1,col:RAIN[k]});
    for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,10);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5),life:1,decay:rnd(0.012,0.024),col:RAIN[i%RAIN.length]});}
    floats.push({x,y:y-40,txt:"にじいろ ノード！",life:1.3,vy:-0.7,col:"#ffffff",size:38});
    if(sparks.length>160)sparks.splice(0,sparks.length-160);
  }
  // rainbowBurst の輪の初期半径に使うだけの小ヘルパ(node半径概算)
  function n_r(){return clamp(api.W*0.04,20,34);}
  function luckySparkle(x,y){
    api.tone(1046,0.12,"triangle",0.11);api.tone(1568,0.14,"triangle",0.08);
    // 頭上に小さな星が キラッ(発見のヒント/ごほうび)
    for(let i=0;i<6;i++){const a=rnd(-TAU*0.5,0),s=rnd(1.6,4);
      sparks.push({x,y:y-6,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.4,r:rnd(2,3.6),life:1,decay:rnd(0.02,0.03),col:luckyColor});}
    if(!luckySeen){luckyMsgT=1.6;luckySeen=true;}  // 初回だけ「きょうのラッキー色は◯！」を中央上に一度教える
  }
  function perfectClear(){
    if(perfectT>0)return;
    perfectT=1; // brief lock so it fires once per empty board
    const bonus=combo*3;count+=bonus;api.setScore(count);
    api.boom(0.55);api.shake(12);
    // big cross-screen zap cascade between last pops
    api.slide(600,1800,0.35,0.09,"sawtooth");
    api.noise(0.2,0.1,2200,"highpass");
    floats.push({x:api.W/2,y:api.H*0.34,txt:"PERFECT ぜんけし！",life:1.4,vy:-0.5,col:"#fff2a0",size:44});
    floats.push({x:api.W/2,y:api.H*0.34+44,txt:"+"+bonus,life:1.3,vy:-0.6,col:"#ffe066",size:34});
    for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(4,11);
      sparks.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5),life:1,decay:rnd(0.012,0.025),col:"#fff2a0"});}
  }
  function stageClear(){
    if(clearT>0)return;
    clearT=2.2;
    api.boom(maxStage?0.7:0.5);api.shake(14);api.hitStop(4);
    api.slide(500,1500,0.5,0.09,"sawtooth");
    // chain-blast every lit-able node still on screen
    let d=0;
    for(const n of nodes){if(n.lit||n.type==="wall")continue;
      n.lit=true;
      rings.push({x:n.x,y:n.y,r:n.r,max:n.r*3,life:1.2,col:n.col});
      for(let k=rint(8,12);k>0;k--){const a=rnd(0,TAU),s=rnd(3,9);
        sparks.push({x:n.x,y:n.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5),life:1,decay:rnd(0.015,0.03),col:n.type==="bug"?"#ff8c8c":"#fff2a0"});}
      d++;if(d<10)api.tone(500+d*90,0.06,"square",0.06);}
    floats.push({x:api.W/2,y:api.H*0.4,txt:maxStage?"ぜんぶ クリア！":"ステージ "+stage+" クリア！",life:1.4,vy:-0.5,col:"#ffe066",size:46});
    // ③ ノーミス ボーナス: このステージで こわれ線ブロックを1回も触らなかったら +5 & みどりの祝福。
    if(stageMiss===0){count+=5;api.setScore(count);noMissT=1.9;
      api.tone(1318,0.14,"triangle",0.1);api.tone(1976,0.16,"triangle",0.07);
      for(let i=0;i<12;i++){const a=rnd(0,TAU),s=rnd(3,8);
        sparks.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(2.5,5),life:1,decay:rnd(0.014,0.024),col:"#7be08a"});}}
  }
  function nextStage(){
    if(maxStage){ // loop forever but keep escalating feel
      stage=STAGES;clearedThisStage=0;need=Math.min(need+7,56);
    }else{
      stage++;clearedThisStage=0;need=needFor(stage);
      if(stage>=STAGES)maxStage=true;
    }
    stageMiss=0;   // ③ 次ステージの ノーミス判定を リセット
    // refill the board for the new stage
    nodes=nodes.filter(n=>!n.lit);
    for(let i=nodes.length;i<7;i++)spawn(rnd(-api.H*0.4,api.H*0.4));
    floats.push({x:api.W/2,y:api.H*0.5,txt:maxStage?"さいしゅう ステージ！":"ステージ "+stage,life:1.2,vy:-0.4,col:"#ffffff",size:40});
    api.tone(880,0.12,"triangle",0.08);
  }
  function touch(ax,ay,bx,by){
    for(const n of nodes){if(n.lit||n.bonk||n.hitCD>0)continue;
      const dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy;
      let t=L2?((n.x-ax)*dx+(n.y-ay)*dy)/L2:0;t=clamp(t,0,1);
      const cx=ax+dx*t,cy=ay+dy*t;
      if(Math.hypot(n.x-cx,n.y-cy)<=n.r+(n.type==="cord"?20:n.type==="stack"?16:10))pop(n);
    }
  }
  function star4(rr){g.beginPath();for(let i=0;i<8;i++){const a=i/8*TAU-Math.PI/2,rad=i%2?rr*0.4:rr;
    const x=Math.cos(a)*rad,y=Math.sin(a)*rad;if(i===0)g.moveTo(x,y);else g.lineTo(x,y);}g.closePath();}
  function catchComet(){
    if(!comet||comet.got)return;
    comet.got=true;catchMsgT=1.1;
    const cx=comet.x,cy=comet.y;
    count+=3;api.setScore(count);   // コイン(得点)ごほうび・減点なし
    api.tone(1318,0.1,"triangle",0.1);api.tone(1760,0.12,"triangle",0.08);api.tone(2093,0.12,"triangle",0.05);
    for(let i=0;i<12;i++){const a=rnd(0,TAU),s=rnd(2,6);
      sparks.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,4),life:1,decay:rnd(0.02,0.03),col:pick(["#fff2a0","#bfe9ff","#ffd23f"])});}
    floats.push({x:cx,y:cy-24,txt:"＋3 コイン！",life:1.1,vy:-0.8,col:"#fff2a0",size:26});
    comet=null;cometT=rnd(300,520);
  }
  function cometTouch(ax,ay,bx,by){
    if(!comet||comet.got)return;
    const dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy;
    let t=L2?((comet.x-ax)*dx+(comet.y-ay)*dy)/L2:0;t=clamp(t,0,1);
    const cx=ax+dx*t,cy=ay+dy*t;
    if(Math.hypot(comet.x-cx,comet.y-cy)<=comet.r*2.4+12)catchComet();
  }
  reset();
  return{
    resize:layout,
    input(px,py,type){
      if(type==="down"){down=true;lx=px;ly=py;trail=[{x:px,y:py,life:1}];lastPop=null;
        for(const n of nodes){if(!n.lit&&!n.bonk&&!(n.hitCD>0)&&Math.hypot(n.x-px,n.y-py)<n.r+(n.type==="cord"?20:n.type==="stack"?16:12))pop(n);}
        cometTouch(px,py,px,py);}   // ④ タップで ながれ星を キャッチ
      else if(type==="move"){if(!down){lx=px;ly=py;return;}
        trail.push({x:px,y:py,life:1});if(trail.length>18)trail.shift();
        cometTouch(lx,ly,px,py);   // ④ なぞりで ながれ星を キャッチ
        touch(lx,ly,px,py);lx=px;ly=py;
        // PERFECT all-clear: this stroke linked every linkable node at once (need a real chain)
        if(combo>=4&&clearT<=0&&!nodes.some(n=>!n.lit&&n.type!=="wall"))perfectClear();}
      else if(type==="up"){down=false;lastPop=null;}
    },
    frame(dt,now){
      // circuit bg (deep gradient + drifting glow)
      flowT+=dt;
      if(hsCD>0)hsCD-=dt;
      // ⑤ 90秒ごとの「けっか」チェックポイント(軸5=もう一回に誘う締め)
      if(startNow===null)startNow=now;
      elapsed=(now-startNow)/1000;
      if(elapsed>=nextResultAt&&resultT<=0&&clearT<=0){
        resultT=3.4;nextResultAt+=90;
        api.tone(660,0.12,"triangle",0.08);api.tone(990,0.14,"triangle",0.07);api.tone(1320,0.16,"triangle",0.05);
      }
      if(resultT>0)resultT=Math.max(0,resultT-0.016*dt);
      const P=pal();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景(基板の絵): 絵が細かいので少し暗く落として 落ちてくるノードを目立たせる。
        // 2面以降は ステージのパレット色を薄く重ねて面ごとの雰囲気を変える(1面=紺の基板はそのまま)
        g.save();g.globalAlpha=0.2;g.fillStyle="#000814";g.fillRect(0,0,api.W,api.H);g.restore();
        if(stage>1){g.save();g.globalAlpha=0.34;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,P.a);tg.addColorStop(0.5,P.b);tg.addColorStop(1,P.c);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        const bg=g.createLinearGradient(0,0,0,api.H);
        bg.addColorStop(0,P.a);bg.addColorStop(0.5,P.b);bg.addColorStop(1,P.c);
        g.fillStyle=bg;g.fillRect(0,0,api.W,api.H);
      }
      // soft aurora glow that breathes
      const aglow=g.createRadialGradient(api.W*0.5,api.H*0.32,0,api.W*0.5,api.H*0.32,api.W*0.7);
      const ab=0.05+Math.sin(flowT*0.03)*0.02;
      aglow.addColorStop(0,"rgba("+P.glow+","+ab.toFixed(3)+")");aglow.addColorStop(1,"rgba(0,0,0,0)");
      g.fillStyle=aglow;g.fillRect(0,0,api.W,api.H);
      // 手描きの格子と基板ノード ※画像背景のときは絵に回路があるので描かない
      if(!imgBg){
      g.strokeStyle="rgba("+P.grid+",.13)";g.lineWidth=2;
      const gs=60;
      for(let x=gs/2;x<api.W;x+=gs){g.beginPath();g.moveTo(x,0);g.lineTo(x,api.H);g.stroke();}
      for(let y=((flowT*0.4)%gs);y<api.H;y+=gs){g.beginPath();g.moveTo(0,y);g.lineTo(api.W,y);g.stroke();}
      // glowing circuit nodes that twinkle along the flow
      for(let x=gs/2;x<api.W;x+=gs)for(let y=((flowT*0.4)%gs);y<api.H;y+=gs){
        const tw=0.18+Math.sin(flowT*0.06+x*0.05+y*0.04)*0.16;
        g.fillStyle="rgba("+P.node+","+Math.max(0.04,tw).toFixed(3)+")";
        g.beginPath();g.arc(x,y,2.4,0,TAU);g.fill();}
      }
      if(perfectT>0)perfectT=Math.max(0,perfectT-0.016*dt);
      // stage-clear hold: count down, then advance to next stage
      if(clearT>0){clearT-=0.016*dt;if(clearT<=0){clearT=0;nextStage();}}
      // spawn flow (gap shortens as stage rises); pause spawns during clear hold
      spawnT-=dt;if(clearT<=0&&spawnT<=0&&nodes.length<16){spawn();spawnT=spawnGap();}
      // move nodes
      for(const n of nodes){n.y+=n.vy*dt;n.x+=n.vx*dt;n.pulse+=0.12*dt;
        if(n.bonk)n.bonk=Math.max(0,n.bonk-0.04*dt);
        if(n.hitCD)n.hitCD=Math.max(0,n.hitCD-0.05*dt);
        if(n.x<n.r||n.x>api.W-n.r)n.vx*=-1;}
      nodes=nodes.filter(n=>!n.lit&&n.y<api.H+n.r*2);
      // ④ でんきの ながれ星: たまに 画面を すーっと 横切る。ノードの後ろを流れる ひみつのごほうび。
      cometT-=dt;
      if(!comet&&cometT<=0&&clearT<=0){
        const dir=Math.random()<0.5?1:-1;
        comet={x:dir>0?-30:api.W+30,y:rnd(api.H*0.16,api.H*0.5),vx:dir*rnd(3.2,4.6),vy:rnd(0.2,0.7),
          r:clamp(api.W*0.02,9,15),got:false,tail:[]};
      }
      if(comet){
        comet.x+=comet.vx*dt;comet.y+=comet.vy*dt;
        comet.tail.unshift({x:comet.x,y:comet.y});if(comet.tail.length>10)comet.tail.pop();
        g.save();g.globalCompositeOperation="lighter";
        for(let i=comet.tail.length-1;i>=0;i--){const t=comet.tail[i],a=(1-i/comet.tail.length);
          g.globalAlpha=a*0.4;g.fillStyle="#bfe9ff";g.beginPath();g.arc(t.x,t.y,comet.r*a*0.7,0,TAU);g.fill();}
        const hg=g.createRadialGradient(comet.x,comet.y,0,comet.x,comet.y,comet.r*2.2);
        hg.addColorStop(0,"rgba(255,255,255,.85)");hg.addColorStop(0.4,"rgba(180,240,255,.4)");hg.addColorStop(1,"rgba(120,200,255,0)");
        g.globalAlpha=1;g.fillStyle=hg;g.beginPath();g.arc(comet.x,comet.y,comet.r*2.2,0,TAU);g.fill();
        g.restore();g.globalAlpha=1;
        g.save();g.translate(comet.x,comet.y);g.fillStyle="#eaffff";star4(comet.r*0.95);g.fill();g.restore();
        if(comet.x<-60||comet.x>api.W+60){comet=null;cometT=rnd(260,480);}
      }
      for(const n of nodes)drawNode(n);
      // zaps (between consecutive pops)
      for(const z of zaps){z.life-=0.08*dt;drawZap(z);}
      zaps=zaps.filter(z=>z.life>0);
      // rings (double halo: bright core ring + soft glow ring)
      for(const r of rings){r.r+=(r.max-r.r)*0.25*dt;r.life-=0.06*dt;
        const a=Math.max(0,r.life);
        g.globalAlpha=a*0.5;g.strokeStyle=r.col;g.lineWidth=10;g.beginPath();g.arc(r.x,r.y,r.r,0,TAU);g.stroke();
        g.globalAlpha=a;g.strokeStyle="#ffffff";g.lineWidth=2.5;g.beginPath();g.arc(r.x,r.y,r.r,0,TAU);g.stroke();}
      g.globalAlpha=1;rings=rings.filter(r=>r.life>0);
      // sparks (glowing additive blobs with bright core)
      g.globalCompositeOperation="lighter";
      for(const s of sparks){s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=0.95;s.vy*=0.95;s.life-=s.decay*dt;
        const a=Math.max(0,s.life);
        g.globalAlpha=a*0.6;g.fillStyle=s.col;g.beginPath();g.arc(s.x,s.y,s.r*2,0,TAU);g.fill();
        g.globalAlpha=a;g.fillStyle="#ffffff";g.beginPath();g.arc(s.x,s.y,s.r*0.55,0,TAU);g.fill();}
      g.globalCompositeOperation="source-over";
      g.globalAlpha=1;sparks=sparks.filter(s=>s.life>0);
      // trail
      for(const p of trail)p.life-=0.07*dt;
      trail=trail.filter(p=>p.life>0);
      if(trail.length>1){g.lineCap="round";g.lineJoin="round";
        const tLife=trail[trail.length-1].life;
        g.globalCompositeOperation="lighter";
        // 3 passes: wide soft glow, cyan body, hot white core
        const passes=[["rgba(40,150,255,.35)",22],["rgba(90,220,255,.65)",10],["#eaffff",3.5]];
        for(let p=0;p<passes.length;p++){
          g.beginPath();g.moveTo(trail[0].x,trail[0].y);
          for(let i=1;i<trail.length;i++)g.lineTo(trail[i].x,trail[i].y);
          g.strokeStyle=passes[p][0];g.lineWidth=passes[p][1];
          g.globalAlpha=tLife;g.stroke();}
        g.globalCompositeOperation="source-over";
        g.globalAlpha=1;
        // crackle at tip
        const tip=trail[trail.length-1];
        g.strokeStyle="rgba(180,240,255,.8)";g.lineWidth=2;
        g.globalCompositeOperation="lighter";
        for(let i=0;i<4;i++){g.beginPath();g.moveTo(tip.x,tip.y);
          let bx=tip.x,by=tip.y;const a=rnd(0,TAU),len=rnd(10,20);
          bx+=Math.cos(a)*len*0.5;by+=Math.sin(a)*len*0.5;g.lineTo(bx,by);
          g.lineTo(bx+rnd(-9,9),by+rnd(-9,9));g.stroke();}
        g.globalCompositeOperation="source-over";
        // bright tip flash
        const tg=g.createRadialGradient(tip.x,tip.y,0,tip.x,tip.y,16);
        tg.addColorStop(0,"rgba(255,255,255,.7)");tg.addColorStop(1,"rgba(120,220,255,0)");
        g.fillStyle=tg;g.globalAlpha=tLife;g.beginPath();g.arc(tip.x,tip.y,16,0,TAU);g.fill();g.globalAlpha=1;
      }
      // combo decay
      if(combo>0){comboT-=0.016*dt;if(comboT<=0){combo=0;lastPop=null;}}
      // floats
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.016*dt;g.globalAlpha=Math.max(0,f.life);
        const sc=1+(1-clamp(f.life,0,1))*0.15;
        g.save();g.translate(f.x,f.y);g.scale(sc,sc);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(f.txt,0,0);
        g.shadowColor=f.col;g.shadowBlur=14;g.fillStyle="#ffffff";g.fillText(f.txt,0,0);
        g.shadowBlur=0;g.fillStyle=f.col;g.globalAlpha=Math.max(0,f.life)*0.85;g.fillText(f.txt,0,0);
        g.restore();}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // climax flash on big combo (full-screen color wash) ※閾値8->5: 通常プレイでも到達しやすく(軸4)
      if(combo>=5){
        const fa=clamp(comboT,0,0.7)*(combo>=12?0.4:0.26);
        const fw=g.createRadialGradient(api.W/2,api.H*0.42,0,api.W/2,api.H*0.42,api.W*0.8);
        const fc=combo>=12?"255,90,140":"90,210,255";
        fw.addColorStop(0,"rgba("+fc+","+fa.toFixed(3)+")");fw.addColorStop(1,"rgba("+fc+",0)");
        g.globalCompositeOperation="lighter";g.fillStyle=fw;g.fillRect(0,0,api.W,api.H);
        g.globalCompositeOperation="source-over";}
      // combo banner (magical electric capsule)
      if(combo>2){
        const ba=clamp(comboT+0.3,0,1);
        const bx=api.W/2,by=api.H*0.11;
        const txt="ビリビリ x"+combo;
        const hot=combo>=9,warm=combo>=6;
        const accent=hot?"#ff5b8c":warm?"#ffb24a":"#43e0ff";
        const pop=1+Math.max(0,comboT-0.4)*0.5;
        g.save();g.translate(bx,by);g.scale(pop,pop);g.globalAlpha=ba;
        g.font="800 26px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
        const tw=g.measureText(txt).width,pw=tw/2+26,ph=24;
        // capsule body
        const cap=g.createLinearGradient(0,-ph,0,ph);
        cap.addColorStop(0,"rgba(20,46,80,.92)");cap.addColorStop(1,"rgba(8,20,40,.92)");
        g.fillStyle=cap;roundRect(-pw,-ph,pw*2,ph*2,ph);g.fill();
        // glowing rim
        g.lineWidth=3;g.strokeStyle=accent;g.shadowColor=accent;g.shadowBlur=18;
        roundRect(-pw,-ph,pw*2,ph*2,ph);g.stroke();g.shadowBlur=0;
        // tiny electric sparkles flanking the text
        g.globalCompositeOperation="lighter";g.strokeStyle="rgba(180,240,255,.85)";g.lineWidth=2;
        for(let s=0;s<2;s++){const sx=(s?1:-1)*(pw-8);
          g.beginPath();g.moveTo(sx,-6+Math.sin(flowT*0.4+s)*4);
          g.lineTo(sx+(s?6:-6),2);g.lineTo(sx+(s?-2:2),8);g.stroke();}
        g.globalCompositeOperation="source-over";
        // text: dark outline + white core + colored glow
        g.lineWidth=6;g.strokeStyle="rgba(0,10,24,.7)";g.strokeText(txt,0,1);
        g.shadowColor=accent;g.shadowBlur=14;g.fillStyle="#ffffff";g.fillText(txt,0,0);
        g.shadowBlur=0;g.fillStyle=accent;g.globalAlpha=ba*0.8;g.fillText(txt,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";}
      // ① にじいろノード！ 発見バナー(虹色に色替わり=レアの大きな祝福)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=RAIN[Math.floor(flowT*0.12)%RAIN.length];
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 36px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7;g.strokeStyle="rgba(0,10,24,.5)";g.strokeText("にじいろ ノード！",0,0);
        g.fillStyle=col;g.fillText("にじいろ ノード！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央の小ヒント(初回だけ)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.28);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(BULB_NAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,10,24,.5)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyMsgT<0)luckyMsgT=0;}
      // ④ ながれ星 はっけん！ 小さな中央ヒント
      if(catchMsgT>0){catchMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.16);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(catchMsgT*1.4,0,1);g.font="800 20px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=5;g.strokeStyle="rgba(0,10,24,.5)";g.strokeText("ながれ星 はっけん！",0,0);
        g.fillStyle="#bfe9ff";g.fillText("ながれ星 はっけん！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(catchMsgT<0)catchMsgT=0;}
      // ③ ノーミス ボーナス！ バナー(ステージクリア文字の下=重ねない)
      if(noMissT>0){noMissT-=0.014*dt;
        const pop=1+Math.max(0,noMissT-1.3)*1.3;
        g.save();g.translate(api.W/2,api.H*0.6);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(noMissT*1.3,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=6;g.strokeStyle="rgba(0,10,24,.5)";g.strokeText("ノーミス ボーナス！＋5",0,0);
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=14;
        g.fillStyle="#c7ffcf";g.fillText("ノーミス ボーナス！＋5",0,0);g.shadowBlur=0;
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(noMissT<0)noMissT=0;}
      // ⑤ けっか バナー(90秒ごと): スコア・ステージ・見つけた色をまとめて見せ「もう一回」に誘う(軸5)
      if(resultT>0){
        const ra=clamp(resultT*1.6,0,1);
        const pop=1+Math.max(0,resultT-3.0)*2.2;
        const bx=api.W/2,by=api.H*0.42;
        const pw=Math.min(api.W*0.42,150),ph=86;
        g.save();g.translate(bx,by);g.scale(pop,pop);g.globalAlpha=ra;
        const panel=g.createLinearGradient(0,-ph,0,ph);
        panel.addColorStop(0,"rgba(10,26,48,.92)");panel.addColorStop(1,"rgba(4,10,22,.92)");
        g.fillStyle=panel;roundRect(-pw,-ph,pw*2,ph*2,18);g.fill();
        g.lineWidth=3;g.strokeStyle="#ffe066";g.shadowColor="#ffe066";g.shadowBlur=16;
        roundRect(-pw,-ph,pw*2,ph*2,18);g.stroke();g.shadowBlur=0;
        g.textAlign="center";g.textBaseline="middle";
        g.font="900 26px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=5;g.strokeStyle="rgba(0,10,24,.6)";g.strokeText("けっか",0,-52);
        g.fillStyle="#ffe066";g.fillText("けっか",0,-52);
        g.font="800 20px 'Hiragino Maru Gothic ProN',system-ui";
        const l1="スコア "+count;
        g.lineWidth=4;g.strokeStyle="rgba(0,10,24,.6)";g.strokeText(l1,0,-14);
        g.fillStyle="#eaf7ff";g.fillText(l1,0,-14);
        const l2="ステージ "+stage+"　いろ "+foundColors.size+"/"+BULB_COLS.length;
        g.strokeText(l2,0,18);g.fillStyle="#bfe9ff";g.fillText(l2,0,18);
        g.font="800 17px 'Hiragino Maru Gothic ProN',system-ui";
        g.strokeText("もう いっかい あそぼう！",0,52);
        g.fillStyle="#7be08a";g.fillText("もう いっかい あそぼう！",0,52);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";
      }
      // stage HUD (top-CENTER = 衝突しない安全帯): stage number + progress bar toward clear
      {const P2=pal();
        g.save();g.translate(api.W/2,8);
        g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="top";
        const label=maxStage?"さいしゅう":"ステージ "+stage;
        g.lineWidth=5;g.strokeStyle="rgba(0,10,24,.6)";g.strokeText(label,0,0);
        g.fillStyle="#eaf7ff";g.fillText(label,0,0);
        // progress bar (centered)
        const bw=128,bh=10,by=26;
        g.fillStyle="rgba(8,18,36,.7)";roundRect(-bw/2,by,bw,bh,bh/2);g.fill();
        const prog=clamp(clearedThisStage/need,0,1);
        if(prog>0){const pg=g.createLinearGradient(-bw/2,0,bw/2,0);
          pg.addColorStop(0,"rgba("+P2.node+",1)");pg.addColorStop(1,"#ffffff");
          g.fillStyle=pg;roundRect(-bw/2,by,Math.max(bh,bw*prog),bh,bh/2);g.fill();}
        g.lineWidth=1.5;g.strokeStyle="rgba("+P2.node+",.6)";roundRect(-bw/2,by,bw,bh,bh/2);g.stroke();
        g.restore();g.textAlign="left";g.textBaseline="alphabetic";}
      // hint (rounded glowing pill, gently breathing)
      {const txt="ゆびで なぞって ビリビリ つなげろ！";
        const hb=0.85+Math.sin(flowT*0.05)*0.12;
        g.save();g.translate(api.W/2,api.H-22);
        g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
        const tw=g.measureText(txt).width,pw=tw/2+18,ph=15;
        const pill=g.createLinearGradient(0,-ph,0,ph);
        pill.addColorStop(0,"rgba(18,40,70,.78)");pill.addColorStop(1,"rgba(8,18,36,.78)");
        g.fillStyle=pill;roundRect(-pw,-ph,pw*2,ph*2,ph);g.fill();
        g.lineWidth=2.2;g.strokeStyle="rgba(90,200,255,"+hb.toFixed(3)+")";
        g.shadowColor="#43e0ff";g.shadowBlur=12;roundRect(-pw,-ph,pw*2,ph*2,ph);g.stroke();g.shadowBlur=0;
        g.lineWidth=4;g.strokeStyle="rgba(0,10,24,.6)";g.strokeText(txt,0,1);
        g.fillStyle="#eaf7ff";g.fillText(txt,0,0);
        g.restore();g.textAlign="left";g.textBaseline="alphabetic";}
    }
  };
  function drawWall(n){
    // broken-wire block: dull metal plate with a red cracked gap. clearly "do not touch".
    const pr=n.r*0.94;
    const shake=n.bonk?Math.sin(n.bonk*60)*n.bonk*4:0;
    g.save();g.translate(n.x+shake,n.y);
    g.fillStyle="rgba(0,0,0,.3)";roundRect(-pr*0.9+2,-pr*0.9+4,pr*1.8,pr*1.8,pr*0.4);g.fill();
    // (こわれ線プレートは手描き。生成画像は床/影の残りが抜けず不採用)
    const plate=g.createLinearGradient(0,-pr,0,pr);
    plate.addColorStop(0,"#6a7a90");plate.addColorStop(1,"#3a4658");
    g.fillStyle=plate;roundRect(-pr*0.9,-pr*0.9,pr*1.8,pr*1.8,pr*0.4);g.fill();
    g.lineWidth=2.5;g.strokeStyle="#2a3340";roundRect(-pr*0.9,-pr*0.9,pr*1.8,pr*1.8,pr*0.4);g.stroke();
    // bolts
    g.fillStyle="#8a98ac";for(const s of [[-1,-1],[1,-1],[-1,1],[1,1]]){g.beginPath();g.arc(s[0]*pr*0.62,s[1]*pr*0.62,pr*0.1,0,TAU);g.fill();}
    // cracked broken-wire zigzag (red = no current)
    g.strokeStyle=n.bonk?"#ff5b6b":"#c4435a";g.lineWidth=3;g.lineCap="round";g.lineJoin="round";
    g.beginPath();g.moveTo(-pr*0.55,0);g.lineTo(-pr*0.18,-pr*0.28);g.lineTo(-pr*0.05,pr*0.1);g.stroke();
    g.beginPath();g.moveTo(pr*0.55,0);g.lineTo(pr*0.18,pr*0.28);g.lineTo(pr*0.05,-pr*0.1);g.stroke();
    // broken gap spark dots
    g.fillStyle="#ff8c8c";g.globalAlpha=0.6+0.4*Math.sin(n.pulse*1.5);
    g.beginPath();g.arc(-pr*0.05,pr*0.1,pr*0.07,0,TAU);g.arc(pr*0.05,-pr*0.1,pr*0.07,0,TAU);g.fill();
    g.globalAlpha=1;
    g.restore();
  }
  function drawCord(n){
    // ⑦ でんせんコード: 丸ではない縦長シルエットの的(軸7=形の差)。ジグザグの配線+先端の光る差込口。
    const pr=n.r,h=pr*4.2,w=pr*1.2;
    const shake=n.bonk?Math.sin(n.bonk*60)*n.bonk*4:0;
    g.save();g.translate(n.x+shake,n.y);
    g.fillStyle="rgba(0,0,0,.28)";g.beginPath();g.ellipse(pr*0.16,h*0.42,Math.max(0,w*0.7),Math.max(0,pr*0.5),0,0,TAU);g.fill();
    const aR=Math.max(0,pr*2.6+Math.sin(n.pulse)*pr*0.15);
    const gl=g.createRadialGradient(0,0,0,0,0,aR);
    gl.addColorStop(0,rgba(n.col,0.5));gl.addColorStop(0.5,rgba(n.col,0.2));gl.addColorStop(1,"rgba(0,0,0,0)");
    g.globalCompositeOperation="lighter";g.fillStyle=gl;g.beginPath();g.arc(0,0,aR,0,TAU);g.fill();
    g.globalCompositeOperation="source-over";
    const segs=5,pts=[];
    for(let i=0;i<=segs;i++){const t=i/segs,yy=-h*0.5+h*t,xx=Math.sin(t*Math.PI*2.4+n.pulse*0.3)*w*0.9;pts.push({x:xx,y:yy});}
    g.lineCap="round";g.lineJoin="round";
    g.lineWidth=Math.max(0,w*0.55);g.strokeStyle=darken(n.col,0.25);
    g.beginPath();g.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);g.stroke();
    g.lineWidth=Math.max(0,w*0.32);g.strokeStyle=lighten(n.col,0.2);
    g.beginPath();g.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);g.stroke();
    // 先端の光る差込口(電源プラグ風)
    const tip=pts[pts.length-1];
    g.shadowColor=lighten(n.col,0.5);g.shadowBlur=10;
    g.fillStyle="#fff6c0";g.beginPath();g.arc(tip.x,tip.y,Math.max(0,pr*0.4),0,TAU);g.fill();
    g.shadowBlur=0;
    g.fillStyle="rgba(255,255,255,.6)";g.beginPath();g.arc(tip.x-pr*0.1,tip.y-pr*0.1,Math.max(0,pr*0.14),0,TAU);g.fill();
    g.restore();
  }
  function drawStack(n){
    // ⑧ でんきスタック: 四角い箱を積み重ねた的。丸・大玉・縦長コードとは「壊れ方」自体が違う
    // (連打では一気に壊れず、当てるたびに1段ずつ崩れ落ちる=軸7の変化)
    const bw=n.r*1.9,bh=n.r*1.15,gap=bh*0.14;
    const totalH=(bh+gap)*n.maxSegs-gap;
    const shake=n.hitCD?Math.sin(n.hitCD*50)*n.hitCD*18:0;
    g.save();g.translate(n.x+shake,n.y);
    g.fillStyle="rgba(0,0,0,.28)";g.beginPath();
    g.ellipse(bw*0.12,totalH*0.42,Math.max(0,bw*0.55),Math.max(0,bh*0.35),0,0,TAU);g.fill();
    for(let i=0;i<n.maxSegs;i++){
      if(i>=n.segs)continue; // この段はもう崩れ落ちた
      const top=i===n.segs-1; // いちばん上の段=次に崩れる段(少し明るく光らせて予告)
      const yy=totalH*0.5-bh*0.5-i*(bh+gap);
      const bcol=top?lighten(n.col,0.18):n.col;
      const bg=g.createLinearGradient(-bw*0.5,yy-bh*0.5,-bw*0.5,yy+bh*0.5);
      bg.addColorStop(0,lighten(bcol,0.35));bg.addColorStop(1,darken(bcol,0.25));
      g.fillStyle=bg;roundRect(-bw*0.5,yy-bh*0.5,bw,Math.max(0,bh),Math.max(0,bh*0.18));g.fill();
      g.lineWidth=2;g.strokeStyle=darken(bcol,0.45);roundRect(-bw*0.5,yy-bh*0.5,bw,Math.max(0,bh),Math.max(0,bh*0.18));g.stroke();
      // でんき模様(ジグザグ)で「でんきの箱」だと分かるように
      g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=1.6;g.beginPath();
      g.moveTo(-bw*0.26,yy);g.lineTo(-bw*0.05,yy-bh*0.22);g.lineTo(bw*0.05,yy+bh*0.14);g.lineTo(bw*0.26,yy-bh*0.1);g.stroke();
      if(top){g.globalAlpha=0.5+0.4*Math.sin(n.pulse*1.4);g.fillStyle="#fff6c0";
        g.beginPath();g.arc(0,yy,Math.max(0,bh*0.09),0,TAU);g.fill();g.globalAlpha=1;}
    }
    g.restore();
  }
  function drawNode(n){
    if(n.type==="wall"){drawWall(n);return;}
    if(n.type==="cord"){drawCord(n);return;}
    if(n.type==="stack"){drawStack(n);return;}
    const breathe=Math.sin(n.pulse);
    const pr=n.r*(1+breathe*0.06);
    const isRb=n.type==="rainbow";
    const isCoil=n.type==="coil";
    // にじいろノードの現在色(ゆっくり色替わり)。でんきゅうの色は n.col。
    const bc=isRb?RAIN[Math.floor(flowT*0.08+n.pulse)%RAIN.length]:n.col;
    g.save();g.translate(n.x,n.y);
    // soft drop shadow
    g.fillStyle="rgba(0,0,0,.28)";g.beginPath();g.arc(pr*0.16,pr*0.34,Math.max(0,pr*0.96),0,TAU);g.fill();
    // pulsing aura glow (additive, breathes brighter). レアは少し大きめの光=気づかせる接近予告。
    const aR=Math.max(0,pr*((isRb||isCoil?2.35:2)+breathe*0.18));
    const gl=g.createRadialGradient(0,0,Math.max(0,pr*0.3),0,0,aR);
    if(n.type==="bug"){gl.addColorStop(0,"rgba(255,90,120,.55)");gl.addColorStop(0.5,"rgba(255,60,90,.22)");}
    else{gl.addColorStop(0,rgba(bc,0.55));gl.addColorStop(0.5,rgba(bc,0.22));}
    gl.addColorStop(1,"rgba(0,0,0,0)");
    g.globalCompositeOperation="lighter";g.fillStyle=gl;g.beginPath();g.arc(0,0,aR,0,TAU);g.fill();
    g.globalCompositeOperation="source-over";
    if(n.type==="bulb"||isRb||isCoil){
      // glassy bulb body with radial shading (色は n.col / にじいろは循環色から派生)
      const bg=g.createRadialGradient(-pr*0.3,-pr*0.35,Math.max(0,pr*0.1),0,0,Math.max(0,pr*1.1));
      bg.addColorStop(0,lighten(bc,0.78));bg.addColorStop(0.55,bc);bg.addColorStop(1,darken(bc,0.3));
      g.fillStyle=bg;g.beginPath();g.arc(0,0,Math.max(0,pr),0,TAU);g.fill();
      // にじいろは輪郭に虹色リング(レアの特別感/予告)
      if(isRb){g.lineWidth=2.6;g.strokeStyle=lighten(bc,0.4);g.beginPath();g.arc(0,0,Math.max(0,pr*1.02),0,TAU);g.stroke();}
      // ⑥ 大きい発光コイル玉: 内側にコイル(渦)模様を描いて ただの大きい豆電球と区別する(軸7=形の差)
      if(isCoil){
        g.save();g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=2.2;g.beginPath();
        for(let a=0;a<Math.PI*5;a+=0.22){
          const rad=Math.max(0,pr*0.12+(a/(Math.PI*5))*pr*0.72);
          const x=Math.cos(a+n.pulse*0.4)*rad,y=Math.sin(a+n.pulse*0.4)*rad;
          if(a===0)g.moveTo(x,y);else g.lineTo(x,y);
        }
        g.stroke();g.restore();
      }
      // glowing filament
      g.shadowColor=lighten(bc,0.5);g.shadowBlur=10;
      g.strokeStyle="#fff6c0";g.lineWidth=2.4;g.lineCap="round";
      g.beginPath();g.moveTo(-pr*0.32,pr*0.22);g.lineTo(0,-pr*0.32);g.lineTo(pr*0.32,pr*0.22);g.stroke();
      g.shadowBlur=0;
      // metal base
      const mb=g.createLinearGradient(0,pr*0.7,0,pr*1.25);
      mb.addColorStop(0,"#cdb46a");mb.addColorStop(1,"#7a611f");
      g.fillStyle=mb;g.fillRect(-pr*0.4,pr*0.78,pr*0.8,pr*0.42);
      // specular shine
      g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.ellipse(-pr*0.32,-pr*0.36,Math.max(0,pr*0.22),Math.max(0,pr*0.32),-0.5,0,TAU);g.fill();
      // ② ラッキー色の でんきゅうには 頭上に 小さな星の キラッ(気づけるヒント)
      if(n.type==="bulb"&&n.col===luckyColor){
        const tw=0.55+0.45*Math.sin(flowT*0.14+n.pulse);
        g.save();g.translate(0,-pr*1.5);g.globalAlpha=tw;
        g.fillStyle=luckyColor;star4(pr*0.32);g.fill();
        g.globalAlpha=tw*0.9;g.fillStyle="#ffffff";star4(pr*0.15);g.fill();
        g.restore();g.globalAlpha=1;
      }
    }else{
      // bug body with shading (むしは手描き。生成画像は床の残りが抜けず不採用)
      const bg=g.createRadialGradient(-pr*0.3,-pr*0.35,pr*0.1,0,0,pr*1.1);
      bg.addColorStop(0,"#ff8a98");bg.addColorStop(0.6,"#ff5b6b");bg.addColorStop(1,"#c22a3c");
      g.fillStyle=bg;g.beginPath();g.arc(0,0,pr,0,TAU);g.fill();
      // legs
      g.strokeStyle="#aa2a3a";g.lineWidth=2.5;g.lineCap="round";
      for(let i=0;i<3;i++){const a=i*0.8-0.8;g.beginPath();g.moveTo(Math.cos(a)*pr,Math.sin(a+1.6)*pr*0.6);g.lineTo(Math.cos(a)*pr*1.5,Math.sin(a+1.6)*pr);g.stroke();
        g.beginPath();g.moveTo(-Math.cos(a)*pr,Math.sin(a+1.6)*pr*0.6);g.lineTo(-Math.cos(a)*pr*1.5,Math.sin(a+1.6)*pr);g.stroke();}
      // eyes
      g.fillStyle="#fff";g.beginPath();g.arc(-pr*0.3,-pr*0.2,pr*0.18,0,TAU);g.arc(pr*0.3,-pr*0.2,pr*0.18,0,TAU);g.fill();
      g.fillStyle="#222";g.beginPath();g.arc(-pr*0.3,-pr*0.2,pr*0.08,0,TAU);g.arc(pr*0.3,-pr*0.2,pr*0.08,0,TAU);g.fill();
      // shine
      g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.ellipse(-pr*0.34,-pr*0.42,pr*0.18,pr*0.26,-0.5,0,TAU);g.fill();
    }
    g.restore();
  }
  function roundRect(x,y,w,h,r){
    r=Math.min(r,w/2,h/2);
    g.beginPath();
    g.moveTo(x+r,y);
    g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r);
    g.arcTo(x,y,x+w,y,r);
    g.closePath();
  }
  function drawZap(z){
    const segs=6,dx=(z.x2-z.x1)/segs,dy=(z.y2-z.y1)/segs;
    const a=Math.max(0,z.life);
    // precompute a jittered path so both glow + core align
    const pts=[{x:z.x1,y:z.y1}];
    for(let i=1;i<segs;i++)pts.push({x:z.x1+dx*i+rnd(-9,9),y:z.y1+dy*i+rnd(-9,9)});
    pts.push({x:z.x2,y:z.y2});
    g.lineCap="round";g.lineJoin="round";g.globalCompositeOperation="lighter";
    // outer glow
    g.globalAlpha=a*0.5;g.strokeStyle="rgba(80,200,255,.9)";g.lineWidth=8;
    g.beginPath();g.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);g.stroke();
    // bright core
    g.globalAlpha=a;g.strokeStyle="#eaffff";g.lineWidth=2.5;
    g.beginPath();g.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);g.stroke();
    g.globalCompositeOperation="source-over";g.globalAlpha=1;
  }
}
Engine.register("maze", buildMaze);
