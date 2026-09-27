function buildDrill(api){
  const g=api.g;
  // 画像アセット(無ければ従来の手描きにフォールバック)。
  // drill.png / rock.png は生成が2回とも不良(別物・マゼンタ被り)だったので使わない=手描きのまま。
  const USE_DRILL_IMG=false, USE_ROCK_IMG=false;
  api.preload(["bg.jpg","chest.png"]);
  let chunks=[],dust=[],sparks=[],shards=[],floats=[],glints=[],rings=[];
  let motes=[];
  let drillY,depth,genDepth,chunkH,drilling,spin,boost,count,wob,shaftW,shaftX,flash,heat;
  let stage,combo,comboTimer,fever,feverT,banner,rainbow,cleared,zoneShown,lean,leanT,midBonusDone;
  const GEM=["#ff4d6d","#4db8ff","#7be08a","#ffd23f","#c78bff","#ff8c42"];
  const GEMNAME={"#ff4d6d":"あか","#4db8ff":"あお","#7be08a":"みどり","#ffd23f":"きいろ","#c78bff":"むらさき","#ff8c42":"オレンジ"};
  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマー/トラックと同じ思想) ----
  // ① にじいろジェム(激レア) ② きょうのラッキー色 ③ パーフェクトチェイン ④ ひかりむし ひみつ発見
  let luckyColor,luckySeen,luckyMsgT,rbMsgT,gemsInZone,zoneChain,bug,hsCD;
  function bigHitStop(f){if(hsCD<=0){api.hitStop(f);hsCD=32;}}  // 節目/大ヒット限定(30f以上あける)
  function spawnBug(){const fromL=Math.random()<0.5;
    bug={x:fromL?-24:api.W+24,baseY:rnd(api.H*0.22,api.H*0.7),y:0,ph:rnd(0,TAU),amp:rnd(14,30),
      vx:(fromL?1:-1)*rnd(0.5,1.0),hue:pick(["#fff3a0","#a0ffd0","#a0d8ff","#ffb0e0"])};bug.y=bug.baseY;}
  function catchBug(){
    // ④ ひかりむし ひみつ発見: つかまえると コイン+きらめき(減点なし)
    count+=8;api.setScore(count);
    api.tone(1318,0.1,"triangle",0.1);api.tone(1760,0.12,"triangle",0.08);api.tone(2093,0.14,"triangle",0.06);
    floats.push({x:bug.x,y:bug.y-16,txt:"つかまえた！ +8",col:"#ffe9a8",life:1,vy:-1,size:22});
    for(let k=0;k<12;k++){const a=rnd(0,TAU),s=rnd(2,6);
      glints.push({x:bug.x,y:bug.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.03,size:rnd(5,10),col:"#fff3c0"});}
    rings.push({x:bug.x,y:bug.y,r:6,life:1,decay:0.06,col:"#ffe9a8"});
    bug=null;
  }
  // depth zones: each 800m (=80m shown) a brand-new look. last zone = treasure.
  const ZONES=[
    {name:"つちのそう", top:"#8a5a36",mid:"#7a6a4a",bot:"#6a5a52", dk:"#5c3a22", glow:"rgba(255,180,90,0.16)"},
    {name:"こおりのそう", top:"#bfeaff",mid:"#8fc8ef",bot:"#5fa3d8", dk:"#2f6aa0", glow:"rgba(120,200,255,0.20)"},
    {name:"マグマのそう", top:"#ff7a3c",mid:"#e04a22",bot:"#a02810", dk:"#5a1606", glow:"rgba(255,120,40,0.22)"},
    {name:"すいしょうのそう", top:"#d8a0ff",mid:"#a86ae0",bot:"#7a3ec0", dk:"#421a78", glow:"rgba(200,130,255,0.22)"},
    {name:"おたからのま", top:"#ffe9a0",mid:"#ffce4d",bot:"#d8a020", dk:"#7a5810", glow:"rgba(255,215,90,0.28)"}
  ];
  const ZONE_M=400; // depth units per zone (shown as 40m)。90秒の実測で最大到達がdepth540〜580どまりだったため
                    // 1000→400 に短縮し、通常セッション内で必ず「とうたつ！」が複数回来るようにする(軸4/5)
  function zoneIdx(d){return clamp(Math.floor(d/ZONE_M),0,ZONES.length-1);}
  function layout(){
    drillY=api.H*0.3;chunkH=clamp(api.H*0.1,56,90);
    shaftW=clamp(api.W*0.5,220,440);shaftX=(api.W-shaftW)/2;
  }
  function strata(d){return ZONES[zoneIdx(d)].mid;}
  function strataDark(d){return ZONES[zoneIdx(d)].dk;}
  function mkChunk(top){
    const r=Math.random();let type,color,gem=null,hp=1;
    const deep=Math.min(top/(ZONE_M*5),1);
    const z=zoneIdx(top);
    // ① にじいろジェム: 少し掘ってから ときどき(約3.5%)だけ出る激レア。いつ出るか分からない=ドキドキ発見。
    if(top>ZONE_M*0.4 && r<0.035){type="rainbow";color="#ff4d6d";gem="rainbow";}
    // 軸7: すいしょうのそう(z===3)限定で「クリスタルスパイク」(縦に長い菱形)を約5.5%で抽選。
    // rainbow/gemより先に判定して排他にする=丸い岩・ダイヤ形ジェムしか無かった形状ラインナップに「長い物」を足す。
    else if(z===3 && r<0.09){type="crystal";color=strata(top);}
    else if(r<0.14+deep*0.1){type="gem";color=strata(top);gem=pick(GEM);}
    else{
      // 7〜8歳向け: 岩(コンボ切れ)を少し増やして、ジェムを「つなぐ」考えどころを濃くする(しきい値は変更前と同じ)
      const rockHi=(z>=1)?(0.38+deep*0.28+z*0.05):(0.38+deep*0.28);
      // 軸7: マグマのそう以降(z>=2)は丸岩(boulder)の当たり幅を0.05→0.09に広げ、深く掘るほど大きい物に当たりやすくする。
      const boulderBand=(z>=2)?0.09:0.05;
      if(r<rockHi){
        // 軸7: 「岩」判定の中の一番上を、ひと回り大きい丸岩(boulder)にする。
        // 岩+丸岩の合計出現率は元の岩と同じ=スコアの伸びは変えず、形と大きさのバラエティだけ増やす。
        if(r>=rockHi-boulderBand){type="boulder";color="#6b6b73";hp=3;}
        else{type="rock";color="#6b6b73";hp=z>=2?2:1;}
      }else{
        // 軸7: dirt(装飾のない平らな帯)の半分程度を小さい丸の「小石(pebble)」にして見た目の単調さを減らす。
        // 出現率とスコア(+1)はdirtと完全に同じ=バランスは変えない。
        const pebbleHi=rockHi+(1-rockHi)*0.5;
        if(r<pebbleHi){type="pebble";color=strata(top);}
        else{
          // 軸7: 残りのdirtの半分を「かせき(fossil)」= 丸(岩)でもひし形(ジェム)でもない第3の輪郭に差し替える。
          // 出現率・得点(+1)はdirtと完全に同じ=スコアバランスは変えない。
          const fossilHi=pebbleHi+(1-pebbleHi)*0.5;
          if(r<fossilHi){type="fossil";color=strata(top);}
          else{type="dirt";color=strata(top);}
        }
      }
    }
    // 軸7: boulder/crystal は縦に長い。genDepthはこの実際の高さぶん進める(ensure側で対応)
    // boulderは通常のrock(chunkH*1)との対比を低学年が一目で分かるレベルまで広げる(1.5-2 → 1.8-2.6)
    const h=type==="boulder"?chunkH*rnd(1.8,2.6):(type==="crystal"?chunkH*1.8:chunkH);
    return{top,h,type,color,gem,hp,done:false,seed:rint(0,9999)};
  }
  function reset(){chunks=[];dust=[];sparks=[];shards=[];floats=[];glints=[];rings=[];depth=0;genDepth=0;drilling=false;spin=0;boost=0;count=0;wob=0;flash=0;heat=0;stage=0;combo=0;comboTimer=0;fever=false;feverT=0;banner=null;rainbow=0;cleared=false;zoneShown=0;lean=0;leanT=0;midBonusDone=false;
    luckyColor=pick(GEM);luckySeen=false;luckyMsgT=0;rbMsgT=0;gemsInZone=0;zoneChain=false;bug=null;hsCD=0;
    layout();ensure();initMotes();}
  // big centered banner for zone arrivals + clear
  function showBanner(txt,col,sub){banner={txt,col,sub:sub||"",life:1,t:0};}
  function initMotes(){motes=[];for(let i=0;i<18;i++)motes.push({x:Math.random()*api.W,y:Math.random()*api.H,r:rnd(1.2,3.6),sp:rnd(0.15,0.5),ph:rnd(0,TAU),drift:rnd(0.2,0.8),hue:pick(["#ffd9a0","#ffc04d","#a0d8ff","#ffb0d0"])});}
  function ensure(){while(genDepth<depth+api.H+200){const c=mkChunk(genDepth);chunks.push(c);genDepth+=c.h;}}
  function dig(c){
    c.done=true;
    const fmul=fever?2:1; // fever doubles everything
    if(c.type==="rainbow"){
      // ① にじいろジェム 撃破: 虹の輪がぶわっと広がる大盤振る舞い。激レアの爽快ごほうび+大量得点。
      combo++;comboTimer=2.6;gemsInZone++;if(combo>=5)zoneChain=true;
      const gain=120*fmul;
      count+=gain;api.setScore(count);
      rbMsgT=1.6;rainbow=Math.min(1,rainbow+0.45);       // 短時間だけ虹ウォッシュ(自動で減衰=溜まらない)
      api.boom(0.6);api.shake(16);bigHitStop(5);
      api.slide(560,1320,0.4,0.26,"triangle");api.tone(880,0.16,"triangle",0.14);
      api.tone(1320,0.18,"triangle",0.1);api.tone(1760,0.2,"triangle",0.07);
      flash=Math.max(flash,0.85);
      for(let k=0;k<30;k++){const a=rnd(0,TAU),s=rnd(4,13);
        sparks.push({x:api.W/2,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(3,8),life:1,decay:rnd(0.01,0.02),col:pick(GEM)});}
      for(let k=0;k<8;k++){const a=rnd(0,TAU),s=rnd(1,4);
        glints.push({x:api.W/2+rnd(-30,30),y:drillY+rnd(-10,10),vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:rnd(0.015,0.03),size:rnd(8,14),col:"#ffffff"});}
      for(let k=0;k<GEM.length;k++)rings.push({x:api.W/2,y:drillY,r:8+k*4,life:1,decay:0.04,col:GEM[k]});
      floats.push({x:api.W/2,y:drillY-24,txt:"にじいろ！ +"+gain,col:"#ff66cc",life:1,vy:-1.3,size:40});
      boost=Math.max(boost,0.9);
      for(let k=0;k<6;k++)dust.push({x:api.W/2+rnd(-shaftW*0.4,shaftW*0.4),y:drillY+rnd(-10,10),r:rnd(8,18),vx:rnd(-3,3),vy:-rnd(1,3),life:1,decay:rnd(0.012,0.025)});
      return;
    }
    if(c.type==="gem"){
      // combo: chain gems for a rising multiplier
      combo++;comboTimer=2.6;gemsInZone++;
      const mult=Math.min(combo,5); // x1..x5
      if(combo>=5)zoneChain=true;   // ③ パーフェクトチェイン: このゾーンで x5 まで繋げた記録
      const gain=10*mult*fmul;
      count+=gain;api.setScore(count);
      // pitch rises with combo for a satisfying ladder
      api.tone(760+combo*70,0.08,"triangle",0.12);api.tone(1320+combo*90,0.12,"sine",0.1);
      api.shake(5+Math.min(combo,5));api.hitStop(3);
      flash=Math.max(flash,0.9);
      for(let k=rint(16,22);k>0;k--){const a=rnd(0,TAU),s=rnd(3,10);
        sparks.push({x:api.W/2+rnd(-30,30),y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,6),life:1,decay:rnd(0.013,0.028),col:fever?pick(GEM):c.gem});}
      for(let k=rint(5,8);k>0;k--){const a=rnd(0,TAU),s=rnd(1,3);
        glints.push({x:api.W/2+rnd(-24,24),y:drillY+rnd(-8,8),vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:rnd(0.02,0.035),size:rnd(6,12),col:"#ffffff"});}
      rings.push({x:api.W/2,y:drillY,r:8,life:1,decay:0.05,col:c.gem});
      const txt=mult>1?("+"+gain+" x"+mult):("+"+gain);
      floats.push({x:api.W/2,y:drillY-20,txt:txt,col:mult>=4?"#ffd23f":c.gem,life:1,vy:-1.3,size:34+mult*3});
      boost=Math.max(boost,0.7);
      // ② きょうのラッキー色: 秘密の1色のジェムを掘ると 小さめボーナス+頭上に星のキラッ(気づけるヒント)
      if(c.gem===luckyColor){
        const bonus=6+mult*2;count+=bonus;api.setScore(count);
        api.tone(1568,0.14,"triangle",0.1);api.tone(2093,0.12,"triangle",0.06);
        floats.push({x:api.W/2+46,y:drillY-46,txt:"ラッキー！",col:luckyColor,life:1,vy:-1.1,size:24});
        for(let k=0;k<5;k++)glints.push({x:api.W/2+rnd(-18,18),y:drillY-16+rnd(-6,6),vx:rnd(-1.5,1.5),vy:-rnd(1,2.6),life:1,decay:0.03,size:rnd(6,10),col:luckyColor});
        if(!luckySeen){luckySeen=true;luckyMsgT=2.2;}   // 初回だけ中央上に「きょうのラッキー色は◯！」
      }
      // fever trigger: enough gems in a chain -> go wild (実測でフィーバーが出なかったため6→4に緩和)
      if(combo>=4 && !fever)startFever();
    }else if(c.type==="rock"||c.type==="boulder"){
      const big=c.type==="boulder"; // 軸7: ひと回り大きい丸岩は普通の岩よりさらに派手に壊れる
      const gain=(big?4:c.hp>=2?5:2)*fmul;
      count+=gain;api.setScore(count);
      api.slide(180,60,0.18,0.3,"square");api.noise(0.16,0.3,900,"lowpass");api.shake(big?18:c.hp>=2?12:9);api.hitStop(big?3:2);
      if(c.hp>=2||big){api.boom(big?0.55:0.45);api.shake(big?20:14);}
      flash=Math.max(flash,big?0.85:c.hp>=2?0.7:0.5);
      // 軸7: boulderだけは左右どちらか一方(seedで固定)に破片を偏らせ「吹っ飛ぶ」見た目にする。
      // ふつうのrockは従来通り四方八方(=同じ壊れ方の繰り返しにならないよう演出差をつける)。
      const flyDir=big?(c.seed%2===0?1:-1):0;
      for(let k=rint(6,10)+(big?14:c.hp>=2?6:0);k>0;k--)shards.push({x:api.W/2+rnd(-shaftW*0.3,shaftW*0.3),y:drillY,vx:big?flyDir*rnd(4,11):rnd(-7,7),vy:big?rnd(-4,1.5):rnd(-2,5),s:rnd(6,big?18:14),color:pick(["#9aa0aa","#7d8390","#8a8a92"]),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.02)});
      for(let k=rint(3,5)+(big?4:0);k>0;k--){const a=rnd(0,TAU),s=rnd(2,6);
        glints.push({x:api.W/2,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.03,0.05),size:rnd(4,8),col:"#ffe9a8"});}
      rings.push({x:api.W/2,y:drillY,r:big?9:6,life:1,decay:0.07,col:"#ffd27a"});
      if(big)floats.push({x:api.W/2,y:drillY-18,txt:"ドッシーン！",col:"#ffd27a",life:1,vy:-1.2,size:30});
      else if(c.hp>=2)floats.push({x:api.W/2,y:drillY-18,txt:"ガッシャーン！",col:"#ffd27a",life:1,vy:-1.1,size:26});
      combo=0; // rocks break the gem chain (gentle)
      boost=Math.max(boost,big?0.7:0.5);
    }else if(c.type==="crystal"){
      // 軸7: すいしょうのそう限定の「長い物」。丸い岩(四方八方に飛散)とは違い、
      // 上半分/下半分の2枚に分離してから離れて消える2段階の壊れ方にする。
      combo=0; // 岩と同じ「固い物」扱い=ジェムのチェインは切る
      const gain=14*fmul;
      count+=gain;api.setScore(count);
      api.slide(700,220,0.22,0.26,"triangle");api.tone(1500,0.14,"sine",0.1);api.shake(11);api.hitStop(2);
      flash=Math.max(flash,0.65);
      const cCol=pick(["#d8a0ff","#a86ae0","#f0d9ff"]);
      // 段階1: 大きな上半分/下半分が生まれてすぐ上下に離れていく(halfフラグで専用描画)
      shards.push({x:api.W/2,y:drillY-3,vx:rnd(-1,1),vy:-rnd(3,5.5),s:16,color:cCol,rot:0,vr:rnd(-0.15,0.15),life:1,decay:0.018,half:"top"});
      shards.push({x:api.W/2,y:drillY+3,vx:rnd(-1,1),vy:rnd(3,5.5),s:16,color:cCol,rot:0,vr:rnd(-0.15,0.15),life:1,decay:0.018,half:"bot"});
      // 段階2: 細かい破片は少なめに(岩の放射状バーストとは差をつける)
      for(let k=rint(4,6);k>0;k--){const a=rnd(0,TAU),s=rnd(2,5);
        shards.push({x:api.W/2+rnd(-shaftW*0.15,shaftW*0.15),y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,s:rnd(3,6),color:cCol,rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.02,0.035)});}
      for(let k=0;k<6;k++){const a=rnd(0,TAU),s=rnd(2,5);
        glints.push({x:api.W/2,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.03,size:rnd(5,9),col:"#e8c8ff"});}
      rings.push({x:api.W/2,y:drillY,r:8,life:1,decay:0.05,col:"#c78bff"});
      floats.push({x:api.W/2,y:drillY-20,txt:"クリスタル！ +"+gain,col:"#c78bff",life:1,vy:-1.2,size:28});
      boost=Math.max(boost,0.6);
    }else if(c.type==="fossil"){
      // 軸7: 第3の輪郭「かせき」。丸岩の放射状バーストとも、クリスタルの上下分離とも違う、
      // 数個のかけらがぽろぽろ下に落ちる壊れ方にする。得点(+1)・音の激しさはdirtと同じでバランスは変えない。
      count+=1*fmul;api.setScore(count);
      api.noise(0.1,0.16,700,"lowpass");api.shake(4);
      for(let k=0;k<5;k++)shards.push({x:api.W/2+rnd(-shaftW*0.35,shaftW*0.35),y:drillY+rnd(-4,4),vx:rnd(-1.5,1.5),vy:rnd(1,3.2),s:rnd(5,9),color:"#a89272",rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.035)});
    }else{
      // dirt / pebble: 見た目だけ違い、得点・手応えはどちらも同じ(+1)。バランスは変えない。
      count+=1*fmul;api.setScore(count);
      api.noise(0.08,0.14,500,"lowpass");api.shake(3);
    }
    for(let k=0;k<6;k++)dust.push({x:api.W/2+rnd(-shaftW*0.4,shaftW*0.4),y:drillY+rnd(-10,10),r:rnd(8,18),vx:rnd(-3,3),vy:-rnd(1,3),life:1,decay:rnd(0.012,0.025)});
  }
  function startFever(){
    fever=true;feverT=5;rainbow=1;
    api.boom(0.5);api.shake(16);api.hitStop(4);
    api.slide(440,1100,0.35,0.28,"sawtooth");api.tone(880,0.4,"triangle",0.16);
    showBanner("フィーバー！！","#ff66cc","ドリル むそうモード！");
    for(let k=0;k<26;k++){const a=rnd(0,TAU),s=rnd(4,12);
      sparks.push({x:api.W/2,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(3,7),life:1,decay:rnd(0.01,0.02),col:pick(GEM)});}
  }
  reset();
  return{
    resize:layout,
    input(px,py,type){
      if(type==="down"){
        // 軸3(歯ごたえ): 画面のどこを押しても掘れてしまっていたのをやめ、掘削シャフトの中を押した時だけ掘る。
        // シャフト外(左右のよける操作エリア)は従来通り掘削を止めない=(a)連打が伸びない土台。
        if(px>=shaftX && px<=shaftX+shaftW)drilling=true;
        // ④ ひかりむし ひみつ発見: ドリルとは別に、光る虫にタップが届いたら つかまえる(掘りは止めない/減点なし)
        if(bug && Math.hypot(px-bug.x,py-bug.y)<46){catchBug();}
        // tap the left/right third to make the driller lean & cheer that way
        else if(px<api.W*0.33){lean=-1;leanT=0.5;api.tone(520,0.05,"sine",0.06);}
        else if(px>api.W*0.67){lean=1;leanT=0.5;api.tone(620,0.05,"sine",0.06);}
      }else if(type==="up")drilling=false;
    },
    frame(dt,now){
      // underground bg (excavated cave above drill, solid below handled by chunks)
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: 層(こおり/マグマ/すいしょう/おたから)の色を薄く重ねて雰囲気を変える(1層目=つちはそのまま)
        const zi0=zoneIdx(depth);
        if(zi0>0){g.save();g.globalAlpha=0.36;g.fillStyle=ZONES[zi0].dk;g.fillRect(0,0,api.W,api.H);g.restore();}
        // 掘りぬいたトンネル(ドリルより上の縦穴)はゲーム要素なので画像の上に描く
        let tun=g.createLinearGradient(shaftX,0,shaftX+shaftW,0);
        tun.addColorStop(0,"rgba(8,5,3,.72)");tun.addColorStop(0.5,"rgba(8,5,3,.5)");tun.addColorStop(1,"rgba(8,5,3,.72)");
        g.fillStyle=tun;g.fillRect(shaftX,0,shaftW,drillY+4);
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);grd.addColorStop(0,"#1a0f0c");grd.addColorStop(0.5,"#2a1a13");grd.addColorStop(1,"#3f2c20");
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // soft cave glow around the drill column (tinted by the current depth zone)
      const zGlow=ZONES[zoneIdx(depth)].glow;
      let cave=g.createRadialGradient(api.W/2,drillY,20,api.W/2,drillY,Math.max(shaftW,api.H*0.6));
      cave.addColorStop(0,zGlow);cave.addColorStop(1,zGlow.replace(/[\d.]+\)$/,"0)"));
      g.fillStyle=cave;g.fillRect(0,0,api.W,api.H);
      // ambient floating light motes (always-on, parallax with depth)
      g.globalCompositeOperation="lighter";
      for(const m of motes){
        m.ph+=m.sp*0.04*dt;
        const mx=m.x+Math.sin(m.ph)*8*m.drift;
        let my=(m.y-depth*0.12*m.drift)%(api.H+40);if(my<-20)my+=api.H+40;
        const tw=0.35+0.35*Math.sin(m.ph*1.7);
        g.globalAlpha=tw;g.fillStyle=m.hue;g.beginPath();g.arc(mx,my,m.r,0,TAU);g.fill();
      }
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
      // side walls texture (scrolling) with subtle shading
      g.fillStyle="rgba(0,0,0,.28)";
      for(let i=0;i<14;i++){const y=((i*70 - depth*0.5)%(api.H+70)+api.H+70)%(api.H+70);g.fillRect(0,y,shaftX,3);g.fillRect(shaftX+shaftW,y,api.W-shaftX-shaftW,3);}
      // timers (dt is ~1 at 60fps; convert to seconds)
      const ds=dt/60;
      if(hsCD>0)hsCD-=dt;
      if(comboTimer>0){comboTimer-=ds;if(comboTimer<=0)combo=0;}
      if(fever){feverT-=ds;rainbow=Math.min(1,rainbow+0.1*dt);if(feverT<=0){fever=false;}}
      else rainbow=Math.max(0,rainbow-0.04*dt);
      if(leanT>0){leanT-=ds;if(leanT<=0)lean=0;}
      if(banner){banner.t+=ds;banner.life-=ds*0.5;}
      // drilling advance (fever = faster & unstoppable)
      spin+=(drilling?0.9:0.25)*(fever?1.7:1)*dt;
      const fevSpd=fever?1.7:1;
      // gentler base + slower depth-ramp so each zone lasts long enough for a 5yo
      // to notice the new colors/gems before the next "とうたつ！" (was too fast).
      const speed=(drilling||fever)?clamp(1.7+depth*0.00022,1.7,5.4)*(1+boost*0.8)*fevSpd:0;
      boost*=Math.pow(0.92,dt);
      heat=lerp(heat,(drilling||fever)?Math.min(1,0.4+boost+(fever?0.5:0)):0,0.12);
      flash*=Math.pow(0.82,dt);
      depth+=speed*dt;wob=(drilling||fever)?Math.sin(spin*2)*2:lerp(wob,0,0.2);
      ensure();
      // zone arrival -> celebrate + banner (the "区切り"); final zone = clear
      const zi=zoneIdx(depth);
      if(zi>zoneShown){
        // ③ パーフェクトチェイン: 前のゾーンで コンボx5 まで繋げていたら +40 & 祝福(気づくと得する仕掛け)
        if(zoneChain){count+=40;api.setScore(count);
          floats.push({x:api.W/2,y:api.H*0.52,txt:"パーフェクトチェイン！ ＋40",col:"#8affb0",life:1,vy:-0.9,size:28});
          api.tone(1318,0.16,"triangle",0.11);api.tone(1976,0.18,"triangle",0.07);
          for(let k=0;k<16;k++){const a=rnd(0,TAU),s=rnd(3,8);
            glints.push({x:api.W/2,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:0.02,size:rnd(6,12),col:"#c7ffcf"});}}
        zoneChain=false;gemsInZone=0;                 // 次ゾーンの判定をリセット
        zoneShown=zi;stage=zi;
        if(zi>=ZONES.length-1 && !cleared){
          cleared=true;
          showBanner("クリア！おたから はっけん！","#ffd23f","ぜんぶ ほりきった！");
          api.boom(0.65);api.shake(20);api.hitStop(5);
          api.slide(520,1320,0.5,0.3,"triangle");api.tone(1046,0.5,"sine",0.18);
          for(let k=0;k<60;k++){const a=rnd(0,TAU),s=rnd(4,14);
            sparks.push({x:api.W/2,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(3,8),life:1,decay:rnd(0.008,0.016),col:pick(GEM)});}
        }else{
          showBanner(ZONES[zi].name+" とうたつ！","#ffffff",(zi*(ZONE_M/10))+"m");
          api.boom(0.4);api.shake(12);api.hitStop(3);
          api.slide(440,900,0.3,0.24,"triangle");
          rings.push({x:api.W/2,y:drillY,r:10,life:1,decay:0.03,col:ZONES[zi].mid});
        }
      }
      // 軸5: 宝箱(cleared)は depth4000超が必要で90秒の通常セッションでは絶対に届かないため、
      // 半分くらい掘った所で一度だけ小さめのごほうびを出し、必ず一区切りの達成感が来るようにする。
      if(!midBonusDone && !cleared && depth>=ZONE_M*0.6){
        midBonusDone=true;
        count+=20;api.setScore(count);
        api.tone(988,0.14,"triangle",0.1);api.tone(1318,0.12,"triangle",0.06);
        floats.push({x:api.W/2,y:api.H*0.46,txt:"よくがんばった！ +20",col:"#8affb0",life:1,vy:-1,size:26});
        for(let k=0;k<10;k++){const a=rnd(0,TAU),s=rnd(2,6);
          glints.push({x:api.W/2,y:api.H*0.46,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:0.03,size:rnd(6,10),col:"#c7ffcf"});}
        rings.push({x:api.W/2,y:api.H*0.46,r:8,life:1,decay:0.05,col:"#8affb0"});
      }
      // chunks
      for(const c of chunks){
        const topY=drillY+(c.top-depth);
        if(!c.done&&depth>=c.top+c.h*0.55)dig(c);
        if(topY>api.H||topY+c.h<0)continue;
        drawChunk(c,topY);
      }
      chunks=chunks.filter(c=>drillY+(c.top+c.h-depth)>-20);
      // speed lines when boosting
      if(speed>5||boost>0.2){g.strokeStyle="rgba(255,235,200,.28)";g.lineWidth=2;
        for(let i=0;i<6;i++){const lx=shaftX+rnd(10,shaftW-10),ly=rnd(0,api.H);g.beginPath();g.moveTo(lx,ly);g.lineTo(lx,ly+rnd(20,50));g.stroke();}}
      // shockwave rings
      for(const ri of rings){ri.r+=6*dt;ri.life-=ri.decay*dt;
        g.globalAlpha=Math.max(0,ri.life)*0.6;g.strokeStyle=ri.col;g.lineWidth=3;
        g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();}
      g.globalAlpha=1;rings=rings.filter(ri=>ri.life>0);
      // dust (soft glow)
      g.globalCompositeOperation="lighter";
      for(const d of dust){d.x+=d.vx*dt;d.y+=d.vy*dt;d.r+=0.5*dt;d.life-=d.decay*dt;
        g.globalAlpha=Math.max(0,d.life)*0.32;g.fillStyle="#caa978";g.beginPath();g.arc(d.x,d.y,d.r,0,TAU);g.fill();}
      g.globalCompositeOperation="source-over";
      g.globalAlpha=1;dust=dust.filter(d=>d.life>0);
      // shards
      for(const p of shards){p.vy+=0.4*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        if(p.half){
          // 軸7: クリスタルの上下2段階の分離アニメ用(菱形を半分に割った三角形)
          const hs=Math.max(0,p.s);
          g.fillStyle=p.color;g.beginPath();
          if(p.half==="top"){g.moveTo(0,-hs);g.lineTo(hs*0.7,0);g.lineTo(-hs*0.7,0);}
          else{g.moveTo(0,hs);g.lineTo(hs*0.7,0);g.lineTo(-hs*0.7,0);}
          g.closePath();g.fill();
          g.fillStyle="rgba(255,255,255,.3)";g.beginPath();
          if(p.half==="top"){g.moveTo(0,-hs*0.5);g.lineTo(hs*0.3,0);g.lineTo(-hs*0.3,0);}
          else{g.moveTo(0,hs*0.5);g.lineTo(hs*0.3,0);g.lineTo(-hs*0.3,0);}
          g.closePath();g.fill();
        }else{
          g.fillStyle=p.color;g.fillRect(-p.s/2,-p.s/2,p.s,p.s);
          g.fillStyle="rgba(255,255,255,.25)";g.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.35);
        }
        g.restore();}
      shards=shards.filter(p=>p.life>0);
      // sparks (gems) - additive glow diamonds
      g.globalCompositeOperation="lighter";
      for(const s of sparks){s.vy+=0.2*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=s.decay*dt;
        g.globalAlpha=Math.max(0,s.life);g.fillStyle=s.col;g.save();g.translate(s.x,s.y);g.rotate(s.life*6);
        g.shadowColor=s.col;g.shadowBlur=8;drawDiamond(s.r);g.shadowBlur=0;g.restore();}
      // glints - twinkling stars
      for(const gl of glints){gl.vy+=0.08*dt;gl.x+=gl.vx*dt;gl.y+=gl.vy*dt;gl.life-=gl.decay*dt;
        g.globalAlpha=Math.max(0,gl.life);drawStar(gl.x,gl.y,gl.size*Math.max(0,gl.life),gl.col);}
      g.globalCompositeOperation="source-over";
      g.globalAlpha=1;sparks=sparks.filter(s=>s.life>0);glints=glints.filter(gl=>gl.life>0);
      // drill
      drawDrill();
      // おたから: クリアの瞬間だけ ドリルの下に宝箱がポンと出る(画像のみ。無ければ従来の星シャワーだけ)
      if(cleared&&banner&&banner.life>0)drawChest(now);
      // floats
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.014*dt;g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,f.x,f.y);
        g.shadowColor=f.col;g.shadowBlur=12;g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.shadowBlur=0;}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // full-screen flash on big hits
      if(flash>0.02){g.globalAlpha=Math.min(0.4,flash*0.4);g.fillStyle="#fff";g.fillRect(0,0,api.W,api.H);g.globalAlpha=1;}
      // rainbow wash during fever (peak excitement)
      if(rainbow>0.02){g.globalCompositeOperation="lighter";g.globalAlpha=0.16*rainbow;
        const hue=(now/8)%360;
        let rb=g.createLinearGradient(0,0,api.W,api.H);
        rb.addColorStop(0,"hsl("+hue+",90%,60%)");
        rb.addColorStop(0.5,"hsl("+((hue+120)%360)+",90%,60%)");
        rb.addColorStop(1,"hsl("+((hue+240)%360)+",90%,60%)");
        g.fillStyle=rb;g.fillRect(0,0,api.W,api.H);
        g.globalCompositeOperation="source-over";g.globalAlpha=1;}
      // vignette for depth/focus
      let vig=g.createRadialGradient(api.W/2,api.H/2,api.H*0.3,api.W/2,api.H/2,api.H*0.75);
      vig.addColorStop(0,"rgba(0,0,0,0)");vig.addColorStop(1,"rgba(0,0,0,0.45)");
      g.fillStyle=vig;g.fillRect(0,0,api.W,api.H);
      // ④ ひかりむし: たまに暗がりを ふわりと横切る。タップで つかまえると コイン(ひみつ発見・減点なし)
      if(!bug && Math.random()<0.005)spawnBug();
      if(bug){bug.ph+=0.05*dt;bug.x+=bug.vx*dt;bug.baseY+=Math.sin(bug.ph*0.5)*0.3*dt;
        bug.y=bug.baseY+Math.sin(bug.ph)*bug.amp;
        if(bug.x<-40||bug.x>api.W+40)bug=null;}
      if(bug){const tw=0.55+0.45*Math.sin(bug.ph*2);
        g.save();g.globalCompositeOperation="lighter";
        const hg=g.createRadialGradient(bug.x,bug.y,1,bug.x,bug.y,18);
        hg.addColorStop(0,bug.hue);hg.addColorStop(1,"rgba(0,0,0,0)");
        g.globalAlpha=0.6*tw;g.fillStyle=hg;g.beginPath();g.arc(bug.x,bug.y,18,0,TAU);g.fill();
        g.globalAlpha=1;g.globalCompositeOperation="source-over";
        g.fillStyle=bug.hue;g.beginPath();g.arc(bug.x,bug.y,4,0,TAU);g.fill();
        g.fillStyle="rgba(255,255,255,.9)";g.beginPath();g.arc(bug.x-1,bug.y-1,1.6,0,TAU);g.fill();
        const wf=Math.sin(bug.ph*6)*0.5;
        g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=1.4;g.lineCap="round";
        g.beginPath();g.arc(bug.x-3,bug.y-1,3,Math.PI*0.9+wf,Math.PI*1.7+wf);g.stroke();
        g.beginPath();g.arc(bug.x+3,bug.y-1,3,Math.PI*1.3-wf,Math.PI*2.1-wf);g.stroke();
        g.restore();}
      // ① にじいろジェム 接近予告: したから レアが近づいたら 画面下ちゅうおうに 虹のシェブロン(ドキドキ)
      if(chunks.some(c=>c.type==="rainbow"&&!c.done&&c.top>depth&&c.top<depth+api.H*1.3)){
        const yy=api.H*0.8,pulse=0.5+0.5*Math.sin(now/120);
        g.save();g.globalAlpha=0.4+0.4*pulse;g.lineWidth=5;g.lineCap="round";g.lineJoin="round";
        for(let k=0;k<3;k++){g.strokeStyle=GEM[(Math.floor(now/150)+k)%GEM.length];
          const oy=yy+k*12;g.beginPath();g.moveTo(api.W/2-16,oy-10);g.lineTo(api.W/2,oy);g.lineTo(api.W/2+16,oy-10);g.stroke();}
        g.restore();g.globalAlpha=1;}
      // ① にじいろジェム！ 発見バナー(虹色に色替わり=レアの大きな祝福・中央上=HUD安全帯)
      if(rbMsgT>0){rbMsgT-=ds;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=GEM[Math.floor(now/120)%GEM.length];
        g.save();g.translate(api.W/2,api.H*0.24);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("にじいろジェム！",0,0);
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle=col;g.fillText("にじいろジェム！",0,0);g.shadowBlur=0;
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央上に一度だけ教える
      if(luckyMsgT>0){luckyMsgT-=ds;
        g.save();g.translate(api.W/2,api.H*0.31);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.2,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(GEMNAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyMsgT<0)luckyMsgT=0;}
      // cute HUD: rounded glowing depth gauge (top) + hint pill (bottom)
      drawHUD(now);
      // big centered zone/clear banner
      if(banner&&banner.life>0)drawBanner(now);
    }
  };
  function drawBanner(now){
    const b=banner;const a=Math.min(1,b.life*1.6);
    const pop=b.t<0.25?ease(b.t/0.25):1; // quick pop-in
    const sc=0.6+0.4*pop+0.02*Math.sin(now/120);
    g.save();g.globalAlpha=a;g.translate(api.W/2,api.H*0.42);g.scale(sc,sc);
    g.textAlign="center";g.textBaseline="middle";
    g.font="900 40px 'Hiragino Maru Gothic ProN',system-ui";
    g.lineWidth=9;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(b.txt,0,0);
    g.shadowColor=b.col;g.shadowBlur=22;g.fillStyle=b.col;g.fillText(b.txt,0,0);g.shadowBlur=0;
    if(b.sub){g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
      g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(b.sub,0,34);
      g.fillStyle="#fff3da";g.fillText(b.sub,0,34);}
    g.restore();
    g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";
  }
  function drawChunk(c,topY){
    const x=shaftX,w=shaftW;
    const isRocky=c.type==="rock"||c.type==="boulder";
    // base fill with vertical shading gradient
    const cg=g.createLinearGradient(0,topY,0,topY+c.h);
    // 軸7: 岩の背景は周りの土と同じ色にして、丸いシルエットの方が主役として浮くようにする
    if(isRocky){cg.addColorStop(0,strata(c.top));cg.addColorStop(1,strataDark(c.top));}
    else{cg.addColorStop(0,c.color);cg.addColorStop(1,strataDark(c.top));}
    g.fillStyle=cg;g.fillRect(x,topY,w,c.h+1);
    // texture speckles
    g.fillStyle="rgba(0,0,0,.12)";
    for(let i=0;i<5;i++){const px=x+((c.seed*7+i*53)%w),py=topY+((c.seed*3+i*37)%c.h);g.beginPath();g.arc(px,py,3+(i%3),0,TAU);g.fill();}
    // top highlight ridge
    g.fillStyle="rgba(255,255,255,.08)";g.fillRect(x,topY,w,3);
    if(isRocky){
      const big=c.type==="boulder";
      // 画像の岩: 帯にクリップして ごつい岩を置く(かたい岩=大きい1個 / ふつう=2個)。無ければ手描きの丸い岩
      if(USE_ROCK_IMG && api.asset("rock").ready){
        g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
        const sz=Math.max(1,c.h);
        if(big)api.drawAsset("rock",x+w/2,topY+c.h/2,sz*2.1,sz*1.5,{center:true});
        else if(c.hp>=2)api.drawAsset("rock",x+w/2,topY+c.h/2,sz*1.9,sz*1.25,{center:true});
        else{api.drawAsset("rock",x+w*0.3,topY+c.h/2,sz*1.15,sz*1.15,{center:true});
          api.drawAsset("rock",x+w*0.7,topY+c.h/2+2,sz*1.05,sz*1.05,{center:true,flip:true});}
        g.restore();
      }else{
        // 軸7: 矩形+ヒビではなく、半径をランダムに変えた円を重ねて丸みのある岩シルエットにする
        g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
        const cx0=x+w/2,cy0=topY+c.h/2;
        const baseR=Math.max(0,Math.min(c.h,w)*(big?0.62:(c.hp>=2?0.5:0.4)));
        const bumps=big?5:3;
        const rg=g.createRadialGradient(cx0-baseR*0.3,cy0-baseR*0.3,Math.max(0,baseR*0.05),cx0,cy0,Math.max(1,baseR*1.25));
        rg.addColorStop(0,"#9aa0aa");rg.addColorStop(1,"#4c4c56");
        g.fillStyle=rg;g.beginPath();
        for(let i=0;i<bumps;i++){
          const a=(i/bumps)*TAU+c.seed;
          const rr=Math.max(0,baseR*(0.68+0.28*Math.abs(Math.sin(c.seed*2.7+i*1.9))));
          const bx=cx0+Math.cos(a)*baseR*0.3,by=cy0+Math.sin(a)*baseR*0.22;
          g.moveTo(bx+rr,by);g.arc(bx,by,rr,0,TAU);
        }
        g.fill();
        g.lineWidth=1.5;g.strokeStyle="rgba(20,20,26,.35)";g.stroke();
        g.strokeStyle="rgba(0,0,0,.28)";g.lineWidth=2;
        g.beginPath();g.moveTo(cx0-baseR*0.32,cy0-baseR*0.5);g.lineTo(cx0+baseR*0.1,cy0+baseR*0.42);
        if(c.hp>=2||big){g.moveTo(cx0+baseR*0.35,cy0-baseR*0.2);g.lineTo(cx0+baseR*0.02,cy0+baseR*0.5);}
        g.stroke();
        g.restore();
      }}
    if(c.type==="pebble"){
      // 軸7: dirt(平らな帯)の半分に小さい丸石を1つ置き、四角い帯ばかりに見えないようにする(既存の丸岩描画を縮小して流用)
      g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
      const cx0=x+w/2,cy0=topY+c.h/2;
      const baseR=Math.max(0,Math.min(c.h,w)*0.22);
      const bumps=2;
      const rg=g.createRadialGradient(cx0-baseR*0.3,cy0-baseR*0.3,Math.max(0,baseR*0.05),cx0,cy0,Math.max(1,baseR*1.25));
      rg.addColorStop(0,"#b7ab8e");rg.addColorStop(1,"#7a6a4e");
      g.fillStyle=rg;g.beginPath();
      for(let i=0;i<bumps;i++){
        const a=(i/bumps)*TAU+c.seed;
        const rr=Math.max(0,baseR*(0.68+0.28*Math.abs(Math.sin(c.seed*2.7+i*1.9))));
        const bx=cx0+Math.cos(a)*baseR*0.3,by=cy0+Math.sin(a)*baseR*0.22;
        g.moveTo(bx+rr,by);g.arc(bx,by,rr,0,TAU);
      }
      g.fill();
      g.lineWidth=1;g.strokeStyle="rgba(20,20,26,.3)";g.stroke();
      g.restore();
    }
    if(c.type==="fossil"){
      // 軸7: 丸(岩)でもひし形(ジェム)でもない第3の輪郭。横長・角ばった/枝分かれした「かせき」を
      // 線描画(円弧の重ね合わせではない)で表現する。
      g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
      const cy0=topY+c.h*0.55;
      const bw=Math.min(w*0.62,220),bx0=x+w/2-bw/2;
      const bh=Math.max(6,c.h*0.22);
      g.fillStyle="#c9b48a";
      g.beginPath();
      g.moveTo(bx0,cy0-bh*0.3);
      g.lineTo(bx0+bw*0.18,cy0-bh*0.9);
      g.lineTo(bx0+bw*0.38,cy0-bh*0.2);
      g.lineTo(bx0+bw*0.55,cy0-bh*1.0);
      g.lineTo(bx0+bw*0.72,cy0-bh*0.15);
      g.lineTo(bx0+bw*0.9,cy0-bh*0.8);
      g.lineTo(bx0+bw,cy0);
      g.lineTo(bx0+bw*0.82,cy0+bh*0.9);
      g.lineTo(bx0+bw*0.6,cy0+bh*0.25);
      g.lineTo(bx0+bw*0.4,cy0+bh*0.95);
      g.lineTo(bx0+bw*0.2,cy0+bh*0.3);
      g.lineTo(bx0,cy0+bh*0.8);
      g.closePath();g.fill();
      g.lineWidth=1.5;g.strokeStyle="rgba(70,55,30,.5)";g.stroke();
      // 枝分かれ(ねっこ)の小枝を2本足して「岩(丸)/ジェム(ひし形)」に無い輪郭を強調する
      g.strokeStyle="rgba(70,55,30,.55)";g.lineWidth=3;g.lineCap="round";
      g.beginPath();g.moveTo(bx0+bw*0.3,cy0);g.lineTo(bx0+bw*0.22,cy0+bh*1.6);g.stroke();
      g.beginPath();g.moveTo(bx0+bw*0.68,cy0);g.lineTo(bx0+bw*0.78,cy0-bh*1.7);g.stroke();
      g.restore();
    }
    if(c.type==="crystal"){g.save();g.translate(x+w/2,topY+c.h/2);
      // 軸7: すいしょうのそう限定の「長い物」。丸い岩・ダイヤ形ジェムしか無かった形状に、縦長の菱形を1種類足す。
      const pulse=0.6+0.4*Math.sin(spin*2.4+c.seed);
      const hh=Math.max(1,c.h*0.42),ww=Math.max(1,chunkH*0.225);
      g.globalCompositeOperation="lighter";
      let halo=g.createRadialGradient(0,0,2,0,0,Math.max(1,hh*1.3));
      halo.addColorStop(0,"#d8a0ff");halo.addColorStop(1,"rgba(0,0,0,0)");
      g.globalAlpha=0.35*pulse;g.fillStyle=halo;g.beginPath();g.arc(0,0,Math.max(0,hh*1.3),0,TAU);g.fill();
      g.globalAlpha=1;g.globalCompositeOperation="source-over";
      g.shadowColor="#c78bff";g.shadowBlur=16;g.fillStyle="#c78bff";
      g.beginPath();g.moveTo(0,-hh);g.lineTo(ww,0);g.lineTo(0,hh);g.lineTo(-ww,0);g.closePath();g.fill();
      g.shadowBlur=0;g.fillStyle="rgba(255,255,255,.55)";
      g.beginPath();g.moveTo(0,-hh*0.55);g.lineTo(ww*0.4,0);g.lineTo(0,hh*0.55);g.lineTo(-ww*0.4,0);g.closePath();g.fill();
      drawStar(-ww*0.3,-hh*0.4,3+1.5*pulse,"#ffffff");
      g.restore();}
    if(c.type==="rainbow"){g.save();g.translate(x+w/2,topY+c.h/2);
      // ① にじいろジェム: 虹色に流れる大きな宝石。ふつうのジェムより目立つ=見つけると うれしい。
      const pulse=0.6+0.4*Math.sin(spin*3+c.seed);
      const col=GEM[Math.floor(spin*4+c.seed)%GEM.length];
      g.globalCompositeOperation="lighter";
      let halo=g.createRadialGradient(0,0,2,0,0,c.h*0.78);
      halo.addColorStop(0,col);halo.addColorStop(1,"rgba(0,0,0,0)");
      g.globalAlpha=0.4*pulse;g.fillStyle=halo;g.beginPath();g.arc(0,0,c.h*0.78,0,TAU);g.fill();
      g.globalAlpha=1;g.globalCompositeOperation="source-over";
      const R2=Math.min(c.h,w)*0.32;
      g.shadowColor=col;g.shadowBlur=22;g.fillStyle=col;drawDiamond(R2);
      g.shadowBlur=0;g.fillStyle=GEM[(Math.floor(spin*4+c.seed)+3)%GEM.length];drawDiamond(R2*0.62);
      g.fillStyle="rgba(255,255,255,.9)";drawDiamond(R2*0.28);
      drawStar(-R2*0.2,-R2*0.28,5+3*pulse,"#ffffff");
      g.restore();}
    if(c.type==="gem"){g.save();g.translate(x+w/2,topY+c.h/2);
      // pulsing halo
      const pulse=0.6+0.4*Math.sin(spin*3+c.seed);
      g.globalCompositeOperation="lighter";
      let halo=g.createRadialGradient(0,0,2,0,0,c.h*0.6);
      halo.addColorStop(0,c.gem);halo.addColorStop(1,"rgba(0,0,0,0)");
      g.globalAlpha=0.35*pulse;g.fillStyle=halo;g.beginPath();g.arc(0,0,c.h*0.6,0,TAU);g.fill();
      g.globalAlpha=1;g.globalCompositeOperation="source-over";
      g.shadowColor=c.gem;g.shadowBlur=18;g.fillStyle=c.gem;drawDiamond(Math.min(c.h,w)*0.28);
      g.shadowBlur=0;g.fillStyle="rgba(255,255,255,.7)";drawDiamond(Math.min(c.h,w)*0.12);
      // sparkle on facet
      drawStar(-Math.min(c.h,w)*0.08,-Math.min(c.h,w)*0.1,4+2*pulse,"#ffffff");
      // ② きょうのラッキー色: この色のジェムには 頭上に 小さな星のキラッ(気づけるヒント)
      if(c.gem===luckyColor){g.globalCompositeOperation="source-over";
        drawStar(0,-Math.min(c.h,w)*0.36,3+1.4*pulse,"#ffffff");}
      g.restore();}
    // walls edges (soft shadow)
    g.fillStyle="rgba(0,0,0,.32)";g.fillRect(x-4,topY,4,c.h+1);g.fillRect(x+w,topY,4,c.h+1);
  }
  function drawDrill(){
    const leanX=lean*Math.max(0,leanT)*40; // tap-left/right nudges the driller
    const cx=api.W/2+wob+leanX,cy=drillY;
    // squash & stretch on impact (heat as proxy for active drilling)
    const sx=1+heat*0.06,sy=1-heat*0.05;
    g.save();g.translate(cx,cy);g.rotate(lean*Math.max(0,leanT)*0.12);g.translate(-cx,-cy);
    g.translate(cx,cy);g.scale(sx,sy);g.translate(-cx,-cy);
    // 画像ドリル(上=そうじゅうせき / 下=ぎんいろの きり)。手描きの本体(cy-70..cy+28)と同じ大きさに合わせる
    const useImg=USE_DRILL_IMG && api.drawAsset("drill",cx,cy-21,118,118,{center:true});
    if(!useImg){
    // body with metallic gradient
    const bg=g.createLinearGradient(cx-26,0,cx+26,0);
    bg.addColorStop(0,"#c97f12");bg.addColorStop(0.4,"#ffc04d");bg.addColorStop(0.6,"#f5a623");bg.addColorStop(1,"#a8660a");
    g.fillStyle=bg;g.beginPath();g.moveTo(cx-26,cy-70);g.lineTo(cx+26,cy-70);g.lineTo(cx+20,cy-18);g.lineTo(cx-20,cy-18);g.closePath();g.fill();
    g.fillStyle="#c97f12";g.fillRect(cx-20,cy-50,40,10);
    // glowing cockpit window
    g.save();g.shadowColor="#9fd6ff";g.shadowBlur=10;
    let wg=g.createRadialGradient(cx-2,cy-60,1,cx,cy-58,10);
    wg.addColorStop(0,"#eaf6ff");wg.addColorStop(1,"#7fb8e8");
    g.fillStyle=wg;g.beginPath();g.arc(cx,cy-58,9,0,TAU);g.fill();g.restore();
    // cute mascot face inside the cockpit (little driller pal)
    g.fillStyle="#23323f";
    const eo=heat>0.05?1.6:0;
    g.beginPath();g.arc(cx-3.2,cy-59,1.5,0,TAU);g.arc(cx+3.2,cy-59,1.5,0,TAU);g.fill();
    g.fillStyle="#fff";g.beginPath();g.arc(cx-3.6+eo*0.2,cy-59.6,0.6,0,TAU);g.arc(cx+2.8+eo*0.2,cy-59.6,0.6,0,TAU);g.fill();
    // smile (opens a bit while drilling)
    g.strokeStyle="#23323f";g.lineWidth=1.2;g.beginPath();g.arc(cx,cy-55,2.4,0.15*Math.PI,0.85*Math.PI);g.stroke();
    // rosy cheeks
    g.fillStyle="rgba(255,130,150,.5)";g.beginPath();g.arc(cx-6,cy-56,1.6,0,TAU);g.arc(cx+6,cy-56,1.6,0,TAU);g.fill();
    }
    // hot glow at the drilling tip when active (画像/手描き共通のエフェクト)
    if(heat>0.05){g.globalCompositeOperation="lighter";
      let hot=g.createRadialGradient(cx,cy+24,2,cx,cy+24,40);
      hot.addColorStop(0,"rgba(255,200,120,"+(0.5*heat).toFixed(3)+")");hot.addColorStop(1,"rgba(255,120,40,0)");
      g.fillStyle=hot;g.beginPath();g.arc(cx,cy+24,40,0,TAU);g.fill();
      g.globalCompositeOperation="source-over";}
    // drill bit (spinning auger cone)
    g.save();g.translate(cx,cy-18);
    const BW=22,BL=46;
    if(!useImg){
    const grd=g.createLinearGradient(-BW,0,BW,0);grd.addColorStop(0,"#6d7585");grd.addColorStop(0.5,"#eaf0f7");grd.addColorStop(1,"#5a626f");
    g.fillStyle=grd;g.beginPath();g.moveTo(-BW,0);g.lineTo(BW,0);g.lineTo(0,BL);g.closePath();g.fill();
    // clip to the cone, then scroll chevron flutes downward to sell the auger spin
    g.save();g.beginPath();g.moveTo(-BW,0);g.lineTo(BW,0);g.lineTo(0,BL);g.closePath();g.clip();
    const off=((spin*9)%13+13)%13;
    for(let y=-13;y<BL+13;y+=13){const yy=y+off;
      g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.30)";
      g.beginPath();g.moveTo(-BW,yy);g.lineTo(0,yy+7);g.lineTo(BW,yy);g.stroke();
      g.lineWidth=2;g.strokeStyle="rgba(255,255,255,.4)";
      g.beginPath();g.moveTo(-BW,yy-3);g.lineTo(0,yy+4);g.lineTo(BW,yy-3);g.stroke();}
    // specular highlight that sweeps side to side as it turns
    const sxp=Math.cos(spin*0.7)*BW*0.45;
    g.globalAlpha=0.55;g.fillStyle="rgba(255,255,255,.85)";
    g.beginPath();g.moveTo(sxp-3,2);g.lineTo(sxp+4,2);g.lineTo(0,BL);g.closePath();g.fill();g.globalAlpha=1;
    g.restore();
    // crisp cone outline
    g.lineWidth=1.5;g.strokeStyle="rgba(40,44,54,.55)";g.beginPath();g.moveTo(-BW,0);g.lineTo(BW,0);g.lineTo(0,BL);g.closePath();g.stroke();
    }
    // spin-blur arcs at the tip while actively drilling (画像/手描き共通)
    if(heat>0.05){g.globalCompositeOperation="lighter";g.globalAlpha=0.45*heat;
      g.strokeStyle="rgba(255,235,190,.9)";g.lineWidth=2;g.lineCap="round";
      for(let i=0;i<2;i++){const rr=BL*0.42+i*6;g.beginPath();g.arc(0,BL*0.5,rr,0.08*TAU+spin,0.42*TAU+spin);g.stroke();}
      g.globalAlpha=1;g.globalCompositeOperation="source-over";}
    g.restore();
    g.restore();
  }
  function drawChest(now){
    // クリア時の宝箱: ドリルの下でポンと出て きんいろに光る(画像が無ければ何も描かない=従来通り)
    const im=api.asset("chest");if(!im.ready)return;
    const b=banner,pop=b.t<0.35?ease(b.t/0.35):1;
    // 画像の宝箱は 正方形の中で 横いっぱい×高さ7割(中央寄せ)なので、少し大きめに描き ドリルの先(drillY+28)より下に置く
    const sz=Math.max(1,clamp(shaftW*0.46,100,190))*(0.5+0.5*pop);
    const cx=api.W/2,cy=drillY+sz*0.72+Math.sin(now/180)*4;
    g.save();g.globalCompositeOperation="lighter";
    const hg=g.createRadialGradient(cx,cy,Math.max(0,sz*0.1),cx,cy,Math.max(0,sz*0.95));
    hg.addColorStop(0,"rgba(255,225,120,"+(0.4*pop).toFixed(3)+")");hg.addColorStop(1,"rgba(255,200,80,0)");
    g.fillStyle=hg;g.beginPath();g.arc(cx,cy,Math.max(0,sz*0.95),0,TAU);g.fill();
    g.globalCompositeOperation="source-over";g.restore();
    api.drawAsset("chest",cx,cy,sz,sz,{center:true,alpha:Math.min(1,b.life*1.6)});
    for(let k=0;k<3;k++){const a=now/400+k*TAU/3;
      drawStar(cx+Math.cos(a)*sz*0.55,cy-sz*0.2+Math.sin(a)*sz*0.35,5+3*Math.sin(now/90+k),"#fff3b0");}
    g.globalCompositeOperation="source-over";g.globalAlpha=1;
  }
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function drawHUD(now){
    const t=now/1000;
    // --- top: rounded glowing depth gauge ---
    const m=Math.floor(depth/10);
    g.textAlign="center";g.textBaseline="middle";
    g.font="800 17px 'Hiragino Maru Gothic ProN',system-ui";
    const label="ふかさ "+m+"m";
    const tw=(g.measureText(label)||{}).width||label.length*9;
    const pw=tw+58,ph=38,px=api.W/2-pw/2,py=16;
    // soft glow behind panel
    g.save();g.shadowColor="rgba(255,180,90,.6)";g.shadowBlur=16;
    let pg=g.createLinearGradient(0,py,0,py+ph);pg.addColorStop(0,"rgba(60,38,26,.82)");pg.addColorStop(1,"rgba(36,22,15,.82)");
    g.fillStyle=pg;roundRect(px,py,pw,ph,ph/2);g.fill();g.restore();
    // glowing rim
    g.lineWidth=2.5;g.strokeStyle="rgba(255,200,120,"+(0.55+0.25*Math.sin(t*2.5)).toFixed(3)+")";
    roundRect(px,py,pw,ph,ph/2);g.stroke();
    // little gem icon on the left of the gauge
    g.save();g.translate(px+22,py+ph/2);g.globalCompositeOperation="lighter";
    g.shadowColor="#ffd23f";g.shadowBlur=10;g.fillStyle="#ffd23f";drawDiamond(8);
    g.fillStyle="rgba(255,255,255,.8)";drawDiamond(3.5);g.restore();
    g.globalCompositeOperation="source-over";g.shadowBlur=0;   // 加算を必ず戻す(白飛び/lighter漏れ防止)
    // depth text with warm fill + dark outline
    g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(label,api.W/2+12,py+ph/2+1);
    g.shadowColor="rgba(255,210,120,.8)";g.shadowBlur=8;g.fillStyle="#fff3da";
    g.fillText(label,api.W/2+12,py+ph/2);g.shadowBlur=0;
    // combo / fever badge under the gauge (only when active)
    if(fever||combo>=2){
      const cy2=py+ph+18;
      const txt=fever?("フィーバー "+Math.ceil(Math.max(0,feverT))):("コンボ x"+Math.min(combo,5));
      const col=fever?"hsl("+((t*120)%360)+",90%,62%)":"#ffd23f";
      const ps=1+0.12*Math.sin(t*9);
      g.save();g.translate(api.W/2,cy2);g.scale(ps,ps);
      g.font="900 22px 'Hiragino Maru Gothic ProN',system-ui";
      g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(txt,0,0);
      g.shadowColor=col;g.shadowBlur=14;g.fillStyle=col;g.fillText(txt,0,0);g.shadowBlur=0;g.restore();
    }
    // --- bottom: rounded hint pill (gently bobbing) ---
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    const hint="おしっぱなしで ほる！ ひだり・みぎで よける！";
    const hw=(g.measureText(hint)||{}).width||hint.length*10;
    const bw=hw+48,bh=40,bx=api.W/2-bw/2,bob=Math.sin(t*2)*2;
    const by=api.H-bh-12+bob;
    g.save();g.shadowColor="rgba(160,210,255,.45)";g.shadowBlur=14;
    let bg2=g.createLinearGradient(0,by,0,by+bh);bg2.addColorStop(0,"rgba(40,55,72,.78)");bg2.addColorStop(1,"rgba(26,36,48,.78)");
    g.fillStyle=bg2;roundRect(bx,by,bw,bh,bh/2);g.fill();g.restore();
    g.lineWidth=2;g.strokeStyle="rgba(180,220,255,.5)";roundRect(bx,by,bw,bh,bh/2);g.stroke();
    g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.4)";g.strokeText(hint,api.W/2,by+bh/2+1);
    g.fillStyle="#eaf2ff";g.fillText(hint,api.W/2,by+bh/2);
    g.textAlign="left";g.textBaseline="alphabetic";
  }
  function drawDiamond(r){g.beginPath();g.moveTo(0,-r);g.lineTo(r*0.7,0);g.lineTo(0,r);g.lineTo(-r*0.7,0);g.closePath();g.fill();}
  function drawStar(x,y,r,col){
    g.save();g.translate(x,y);g.fillStyle=col;g.globalCompositeOperation="lighter";
    g.beginPath();
    g.moveTo(0,-r);g.lineTo(r*0.22,-r*0.22);g.lineTo(r,0);g.lineTo(r*0.22,r*0.22);
    g.lineTo(0,r);g.lineTo(-r*0.22,r*0.22);g.lineTo(-r,0);g.lineTo(-r*0.22,-r*0.22);
    g.closePath();g.fill();g.restore();
  }
}
Engine.register("drill", buildDrill);
