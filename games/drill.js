function buildDrill(api){
  const g=api.g;
  // 画像アセット(無ければ従来の手描きにフォールバック)。
  // drill.png / rock.png は生成が2回とも不良(別物・マゼンタ被り)だったので使わない=手描きのまま。
  const USE_DRILL_IMG=false, USE_ROCK_IMG=false;
  api.preload(["bg.jpg","chest.png"]);
  let chunks=[],dust=[],sparks=[],shards=[],floats=[],glints=[],rings=[];
  let motes=[];
  let lastType,rockRun,sinceBoulder;
  let drillY,depth,genDepth,chunkH,drilling,spin,boost,count,wob,shaftW,shaftX,flash,heat;
  let stage,combo,comboTimer,fever,feverT,banner,rainbow,cleared,zoneShown,lean,leanT,midBonusDone;
  const GEM=["#ff4d6d","#4db8ff","#7be08a","#ffd23f","#c78bff","#ff8c42"];
  const GEMNAME={"#ff4d6d":"あか","#4db8ff":"あお","#7be08a":"みどり","#ffd23f":"きいろ","#c78bff":"むらさき","#ff8c42":"オレンジ"};
  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマー/トラックと同じ思想) ----
  // ① にじいろジェム(激レア) ② きょうのラッキー色 ③ パーフェクトチェイン ④ ひかりむし ひみつ発見
  let luckyColor,luckySeen,luckyMsgT,rbMsgT,gemsInZone,zoneChain,bug,hsCD;
  let boss,bossHitT,nextBossAt,lastBugZone; // 周回のボス「でっかいドッシー」と、層ごとに必ず来るひかりむし
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
  // クリア後は一周目の層へ戻って周回する(層の色替え+バナーが7秒ごとに続く=後半が空かない)
  function zoneAbs(d){return Math.max(0,Math.floor(d/ZONE_M));}
  function zoneIdx(d){return zoneAbs(d)%ZONES.length;}
  function lapName(n){const k=["","いっ","に","さん","よん","ご","ろく","なな","はち","きゅう","じゅう"];return (k[n]||n)+"しゅうめ";}
  function layout(){
    drillY=api.H*0.3;chunkH=clamp(api.H*0.1,56,90);
    shaftW=clamp(api.W*0.5,220,560);shaftX=(api.W-shaftW)/2;
  }
  function strata(d){return ZONES[zoneIdx(d)].mid;}
  function strataDark(d){return ZONES[zoneIdx(d)].dk;}
  function mkChunk(top){
    const r=Math.random();let type,color,gem=null,hp=1;
    const deep=Math.min(top/(ZONE_M*5),1);
    const deepR=Math.min(top/(ZONE_M*5),1.3); // 周回するほど岩がやや硬く(最大1.3)。一周目(<1)は従来と同じ
    const z=zoneIdx(top);
    // ① にじいろジェム: 少し掘ってから ときどき(約3.5%)だけ出る激レア。いつ出るか分からない=ドキドキ発見。
    if(top>ZONE_M*0.4 && r<0.035){type="rainbow";color="#ff4d6d";gem="rainbow";}
    // 軸7: すいしょうのそう(z===3)限定で「クリスタルスパイク」(縦に長い菱形)を約5.5%で抽選。
    // rainbow/gemより先に判定して排他にする=丸い岩・ダイヤ形ジェムしか無かった形状ラインナップに「長い物」を足す。
    else if(z===3 && r<0.09){type="crystal";color=strata(top);}
    // 周回(2周目〜)のボス「でっかいドッシー」: 周のはじめの少し先に1体だけ。ここだけ「ぽんぽんたたく」遊びに変わる
    else if(top>=nextBossAt){type="boss";color=strata(top);hp=6;nextBossAt+=ZONE_M*5;}
    // 生き物・乗り物: つち/こおり=きょうりゅうのほね、マグマ=おもちゃのくるま、すいしょう=ねぼけたもぐら(約8%・大きい物)
    else if((z===0||z===1) && Math.random()<0.08){type="bone";color=strata(top);}
    else if(z===2 && Math.random()<0.08){type="car";color=strata(top);}
    else if(z===3 && Math.random()<0.08){type="mole";color=strata(top);}
    // 軸7: つちのそう専用「つぼ」(粘土色の縦長シルエット・左右2つに割れて中からジェムがコロン)。最初の層で「岩と宝石だけじゃない」を見せる
    else if(z===0 && Math.random()<0.1){type="pot";color=strata(top);}
    // 軸7: おたからのま専用「たからばこ」(ふたが ぱかっと開いて コインが噴き出す)。クリア後の長い層の主役
    else if(z===4 && Math.random()<0.2){type="chest";color=strata(top);}
    else if(r<0.14+deep*0.1){type="gem";color=strata(top);gem=pick(GEM);}
    else{
      // 7〜8歳向け: 岩(コンボ切れ)を少し増やして、ジェムを「つなぐ」考えどころを濃くする(しきい値は変更前と同じ)
      const rockHi=Math.min(0.9,(z>=1)?(0.38+deepR*0.28+z*0.05):(0.38+deepR*0.28));
      // 軸7: マグマのそう以降(z>=2)は丸岩(boulder)の当たり幅を0.05→0.09に広げ、深く掘るほど大きい物に当たりやすくする。
      const boulderBand=(z>=2)?0.09:0.07;
      if(r<rockHi){
        // 軸7: 「岩」判定の中の一番上を、ひと回り大きい丸岩(boulder)にする。
        // 岩+丸岩の合計出現率は元の岩と同じ=スコアの伸びは変えず、形と大きさのバラエティだけ増やす。
        if(r>=rockHi-boulderBand){type="boulder";color="#6b6b73";hp=3;}
        else{type="rock";color="#6b6b73";hp=z>=2?2:1;}
      }else{
        // 軸7: dirt(装飾のない平らな帯)の半分程度を小さい丸の「小石(pebble)」にして見た目の単調さを減らす。
        // 出現率とスコア(+1)はdirtと完全に同じ=バランスは変えない。
        const pebbleHi=rockHi+(1-rockHi)*0.5;
        // 軸7: そうごとの専用の壊す物。こおりのそう=ガラスの「こおりのかたまり」/マグマのそう=「マグマだま」。
        // やわらかい側(dirt/pebble/fossil)の約6%と入れ替えるだけ=岩とジェムの出現率・チェインは変えない(得点+3/+4)。
        if((z===1||z===2) && Math.random()<0.12){type=z===1?"ice":"magma";color=strata(top);}
        else if(r<pebbleHi){type="pebble";color=strata(top);}
        else{
          // 軸7: 残りのdirtの半分を「かせき(fossil)」= 丸(岩)でもひし形(ジェム)でもない第3の輪郭に差し替える。
          // 出現率・得点(+1)はdirtと完全に同じ=スコアバランスは変えない。
          const fossilHi=pebbleHi+(1-pebbleHi)*0.5;
          if(r<fossilHi){type="fossil";color=strata(top);}
          else{type="dirt";color=strata(top);}
        }
      }
    }
    // 軸7: 岩/丸岩が縦にずらっと並ぶ(同じ灰色の丸が4〜5個)のを止める。
    // 直前も岩系なら50%(3つ目以降は必ず)で小石/かせき/ジェムに差し替える。逆に岩系が長く出ない時は丸岩を1つ入れて大きい物を見せる。
    const isRk=t=>t==="rock"||t==="boulder";
    if(isRk(type) && isRk(lastType) && (rockRun>=2 || Math.random()<0.5)){
      const q=Math.random();hp=1;color=strata(top);
      if(q<0.4)type="pebble";else if(q<0.8)type="fossil";else{type="gem";gem=pick(GEM);}
    }else if(type==="rock" && !isRk(lastType) && sinceBoulder>chunkH*8){type="boulder";color="#6b6b73";hp=3;}
    rockRun=isRk(type)?rockRun+1:0;
    lastType=type;
    // 軸7: boulder/crystal は縦に長い。genDepthはこの実際の高さぶん進める(ensure側で対応)
    // boulderは通常のrock(chunkH*1)との対比を低学年が一目で分かるレベルまで広げる(1.5-2 → 1.8-2.6)
    const h=type==="boulder"?chunkH*rnd(1.8,2.6):(type==="crystal"?chunkH*1.8:(type==="boss"?chunkH*3.5:((type==="bone"||type==="car"||type==="mole")?chunkH*rnd(1.8,2.1):chunkH)));
    sinceBoulder=type==="boulder"?0:sinceBoulder+h;
    const seed=rint(0,9999);
    // 横ずれ(幅の割合): 中央固定をやめて見た目だけ左右にずらす(当たり判定・得点は変えない)。にじいろは中央のまま。
    const fx=(type==="rainbow"||type==="boss")?0:((seed%5)-2)*0.1;
    return{top,h,type,color,gem,hp,done:false,seed,fx};
  }
  function reset(){chunks=[];dust=[];sparks=[];shards=[];floats=[];glints=[];rings=[];depth=0;genDepth=0;lastType="";rockRun=0;sinceBoulder=500;drilling=false;spin=0;boost=0;count=0;wob=0;flash=0;heat=0;stage=0;combo=0;comboTimer=0;fever=false;feverT=0;banner=null;rainbow=0;cleared=false;zoneShown=0;lean=0;leanT=0;midBonusDone=false;boss=null;bossHitT=0;nextBossAt=ZONE_M*5+ZONE_M*0.25;lastBugZone=-1;
    luckyColor=pick(GEM);luckySeen=false;luckyMsgT=0;rbMsgT=0;gemsInZone=0;zoneChain=false;bug=null;hsCD=0;
    layout();ensure();initMotes();}
  // big centered banner for zone arrivals + clear
  function showBanner(txt,col,sub){banner={txt,col,sub:sub||"",life:1,t:0};}
  function initMotes(){motes=[];for(let i=0;i<18;i++)motes.push({x:Math.random()*api.W,y:Math.random()*api.H,r:rnd(1.2,3.6),sp:rnd(0.15,0.5),ph:rnd(0,TAU),drift:rnd(0.2,0.8),hue:pick(["#ffd9a0","#ffc04d","#a0d8ff","#ffb0d0"])});}
  function ensure(){while(genDepth<depth+api.H+200){const c=mkChunk(genDepth);chunks.push(c);genDepth+=c.h;}}
  function dig(c){
    c.done=true;
    const ox=api.W/2+(c.fx||0)*shaftW; // 横にずれた標的は火花・かけらもその位置から出す(見た目だけ)
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
        sparks.push({x:ox,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(3,8),life:1,decay:rnd(0.01,0.02),col:pick(GEM)});}
      for(let k=0;k<8;k++){const a=rnd(0,TAU),s=rnd(1,4);
        glints.push({x:ox+rnd(-30,30),y:drillY+rnd(-10,10),vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:rnd(0.015,0.03),size:rnd(8,14),col:"#ffffff"});}
      for(let k=0;k<GEM.length;k++)rings.push({x:ox,y:drillY,r:8+k*4,life:1,decay:0.04,col:GEM[k]});
      floats.push({x:api.W/2,y:drillY+70,txt:"にじいろ！ +"+gain,col:"#ff66cc",life:1,vy:-1.3,size:40});
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
        sparks.push({x:ox+rnd(-30,30),y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,6),life:1,decay:rnd(0.013,0.028),col:fever?pick(GEM):c.gem});}
      for(let k=rint(5,8);k>0;k--){const a=rnd(0,TAU),s=rnd(1,3);
        glints.push({x:ox+rnd(-24,24),y:drillY+rnd(-8,8),vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:rnd(0.02,0.035),size:rnd(6,12),col:"#ffffff"});}
      rings.push({x:ox,y:drillY,r:8,life:1,decay:0.05,col:c.gem});
      const txt=mult>1?("+"+gain+" x"+mult):("+"+gain);
      floats.push({x:api.W/2,y:drillY-110,txt:txt,col:mult>=4?"#ffd23f":c.gem,life:1,vy:-1.3,size:34+mult*3});
      boost=Math.max(boost,0.7);
      // ② きょうのラッキー色: 秘密の1色のジェムを掘ると 小さめボーナス+頭上に星のキラッ(気づけるヒント)
      if(c.gem===luckyColor){
        const bonus=6+mult*2;count+=bonus;api.setScore(count);
        api.tone(1568,0.14,"triangle",0.1);api.tone(2093,0.12,"triangle",0.06);
        floats.push({x:api.W/2+130,y:drillY-96,txt:"ラッキー！",col:luckyColor,life:1,vy:-1.1,size:24});
        for(let k=0;k<5;k++)glints.push({x:ox+rnd(-18,18),y:drillY-16+rnd(-6,6),vx:rnd(-1.5,1.5),vy:-rnd(1,2.6),life:1,decay:0.03,size:rnd(6,10),col:luckyColor});
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
      for(let k=rint(6,10)+(big?14:c.hp>=2?6:0);k>0;k--)shards.push({x:ox+rnd(-shaftW*0.3,shaftW*0.3),y:drillY,vx:big?flyDir*rnd(4,11):rnd(-7,7),vy:big?rnd(-4,1.5):rnd(-2,5),s:rnd(6,big?18:14),color:pick(["#9aa0aa","#7d8390","#8a8a92"]),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.02)});
      for(let k=rint(3,5)+(big?4:0);k>0;k--){const a=rnd(0,TAU),s=rnd(2,6);
        glints.push({x:ox,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.03,0.05),size:rnd(4,8),col:"#ffe9a8"});}
      rings.push({x:ox,y:drillY,r:big?9:6,life:1,decay:0.07,col:"#ffd27a"});
      if(big)floats.push({x:api.W/2,y:drillY-110,txt:"ドッシーン！",col:"#ffd27a",life:1,vy:-1.2,size:30});
      else if(c.hp>=2)floats.push({x:api.W/2,y:drillY-110,txt:"ガッシャーン！",col:"#ffd27a",life:1,vy:-1.1,size:26});
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
      shards.push({x:ox,y:drillY-3,vx:rnd(-1,1),vy:-rnd(3,5.5),s:16,color:cCol,rot:0,vr:rnd(-0.15,0.15),life:1,decay:0.018,half:"top"});
      shards.push({x:ox,y:drillY+3,vx:rnd(-1,1),vy:rnd(3,5.5),s:16,color:cCol,rot:0,vr:rnd(-0.15,0.15),life:1,decay:0.018,half:"bot"});
      // 段階2: 細かい破片は少なめに(岩の放射状バーストとは差をつける)
      for(let k=rint(4,6);k>0;k--){const a=rnd(0,TAU),s=rnd(2,5);
        shards.push({x:ox+rnd(-shaftW*0.15,shaftW*0.15),y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,s:rnd(3,6),color:cCol,rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.02,0.035)});}
      for(let k=0;k<6;k++){const a=rnd(0,TAU),s=rnd(2,5);
        glints.push({x:ox,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.03,size:rnd(5,9),col:"#e8c8ff"});}
      rings.push({x:ox,y:drillY,r:8,life:1,decay:0.05,col:"#c78bff"});
      floats.push({x:api.W/2,y:drillY-110,txt:"クリスタル！ +"+gain,col:"#c78bff",life:1,vy:-1.2,size:28});
      boost=Math.max(boost,0.6);
    }else if(c.type==="ice"){
      // 軸7: こおりのそう専用「こおりのかたまり」。ガラスのように たくさんの細かい かけらに パリーンと割れる(水色の高い音)。
      count+=3*fmul;api.setScore(count);
      api.tone(2200,0.07,"triangle",0.1);api.tone(3100,0.09,"sine",0.06);api.noise(0.1,0.18,3200,"highpass",0.9);api.shake(8);api.hitStop(2);
      flash=Math.max(flash,0.45);
      for(let k=rint(14,20);k>0;k--){const a=rnd(0,TAU),s=rnd(2,8);
        shards.push({x:ox+rnd(-14,14),y:drillY+rnd(-8,8),vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,s:rnd(3,8),color:pick(["#eafaff","#b8e6ff","#8fd0ff","#ffffff"]),rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.014,0.026)});}
      for(let k=0;k<5;k++){const a=rnd(0,TAU),s=rnd(1,4);
        glints.push({x:ox,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:0.035,size:rnd(5,9),col:"#e8f8ff"});}
      rings.push({x:ox,y:drillY,r:7,life:1,decay:0.06,col:"#bfeaff"});
      floats.push({x:api.W/2,y:drillY-110,txt:"パリーン！ +3",col:"#bfeaff",life:1,vy:-1.1,size:26});
      boost=Math.max(boost,0.45);
    }else if(c.type==="magma"){
      // 軸7: マグマのそう専用「マグマだま」。かけらは出さず オレンジの火の粉が ぼわっと広がり 上へ舞い上がる。
      count+=4*fmul;api.setScore(count);
      api.slide(260,90,0.2,0.26,"sawtooth");api.noise(0.18,0.22,500,"lowpass");api.shake(9);api.hitStop(2);
      flash=Math.max(flash,0.55);
      for(let k=rint(18,26);k>0;k--){const a=rnd(0,TAU),s=rnd(2,9);
        sparks.push({x:ox,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(2,6),life:1,decay:rnd(0.014,0.03),col:pick(["#ff8c42","#ffd23f","#ff4d1a","#ffb347"])});}
      rings.push({x:ox,y:drillY,r:8,life:1,decay:0.05,col:"#ff8c42"});
      floats.push({x:api.W/2,y:drillY-110,txt:"ぼわっ！ +4",col:"#ffb347",life:1,vy:-1.1,size:26});
      boost=Math.max(boost,0.5);
    }else if(c.type==="chest"){
      // 軸7: おたからのま専用「たからばこ」。ふたが上へ ぱかっと跳ね、中から金のコインが上へ噴き出す。
      // 岩の飛散・氷の細片・クリスタルの上下分離のどれとも違う「ふたが開いて中身が飛び出す」壊れ方。
      count+=15*fmul;api.setScore(count);
      api.tone(1568,0.1,"triangle",0.12);api.tone(2093,0.14,"sine",0.08);api.slide(900,1800,0.25,0.16,"triangle");
      api.noise(0.08,0.14,2400,"highpass",0.8);api.shake(7);
      flash=Math.max(flash,0.5);
      shards.push({x:ox,y:drillY-4,vx:rnd(-2,2),vy:-rnd(7,9),s:Math.max(16,chunkH*0.34),color:"#ffce4d",rot:0,vr:rnd(-0.2,0.2),life:1,decay:0.014,half:"lid"});
      for(let k=0;k<20;k++){const a=rnd(-2.5,-0.64),s=rnd(4,11);
        sparks.push({x:ox+rnd(-18,18),y:drillY,vx:Math.cos(a)*s*0.7,vy:Math.sin(a)*s,r:rnd(3,7),life:1,decay:rnd(0.011,0.022),col:pick(["#ffd23f","#ffe27a","#fff0a0"])});}
      for(let k=0;k<8;k++){const a=rnd(0,TAU),s=rnd(1,4);
        glints.push({x:ox+rnd(-20,20),y:drillY+rnd(-10,6),vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,life:1,decay:rnd(0.02,0.035),size:rnd(6,12),col:"#fff6c8"});}
      rings.push({x:ox,y:drillY,r:8,life:1,decay:0.05,col:"#ffd23f"});
      floats.push({x:api.W/2,y:drillY-110,txt:"ぱかっ！ +"+(15*fmul),col:"#ffd23f",life:1,vy:-1.2,size:30});
      boost=Math.max(boost,0.55);
    }else if(c.type==="pot"){
      // 軸7: つちのそう専用「つぼ」。左右2つにパカッと割れ、中から小さなジェムが1個コロンと落ちる。
      count+=3*fmul;api.setScore(count);
      api.noise(0.12,0.2,1400,"lowpass");api.tone(520,0.06,"triangle",0.1);api.tone(1175,0.1,"sine",0.08);api.shake(6);
      const pc="#c98a5a";
      shards.push({x:ox-6,y:drillY,vx:-rnd(2,4),vy:-rnd(1,3),s:Math.max(14,chunkH*0.3),color:pc,rot:0,vr:-rnd(0.05,0.14),life:1,decay:0.016,half:"left"});
      shards.push({x:ox+6,y:drillY,vx:rnd(2,4),vy:-rnd(1,3),s:Math.max(14,chunkH*0.3),color:pc,rot:0,vr:rnd(0.05,0.14),life:1,decay:0.016,half:"right"});
      for(let k=rint(4,6);k>0;k--)shards.push({x:ox+rnd(-14,14),y:drillY+rnd(-6,6),vx:rnd(-4,4),vy:-rnd(1,4),s:rnd(4,8),color:pick(["#c98a5a","#a8683a","#5c3a22"]),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.02,0.035)});
      shards.push({x:ox,y:drillY-6,vx:rnd(-1,1),vy:-rnd(4,6),s:9,color:pick(GEM),rot:0,vr:0,life:1.4,decay:0.012,half:"gem"});
      glints.push({x:ox,y:drillY-6,vx:0,vy:-1,life:1,decay:0.03,size:9,col:"#ffffff"});
      rings.push({x:ox,y:drillY,r:7,life:1,decay:0.06,col:"#e0a878"});
      floats.push({x:api.W/2,y:drillY-110,txt:"ぱりん！ +3",col:"#ffd9a8",life:1,vy:-1.1,size:26});
      boost=Math.max(boost,0.45);
    }else if(c.type==="bone"){
      // 生き物: きょうりゅうのほね。ばらばらの ほねが ガラガラと左右へ倒れて転がる(コンボは切らない=ごほうび寄り)
      const gain=8*fmul;count+=gain;api.setScore(count);
      api.tone(300,0.06,"square",0.1);api.tone(240,0.08,"square",0.08);api.noise(0.16,0.2,2200,"highpass",0.7);api.shake(8);
      flash=Math.max(flash,0.45);
      for(let k=0;k<6;k++){const sd=k%2===0?-1:1;
        shards.push({x:ox+rnd(-shaftW*0.12,shaftW*0.12),y:drillY+rnd(-14,14),vx:sd*rnd(1.5,5),vy:-rnd(0.5,3),s:rnd(chunkH*0.55,chunkH*0.8),color:"#f4ecd8",rot:rnd(-0.6,0.6),vr:sd*rnd(0.12,0.3),life:1,decay:rnd(0.012,0.02),half:"bar"});}
      shards.push({x:ox,y:drillY-6,vx:rnd(-2,2),vy:-rnd(4,6),s:Math.max(14,chunkH*0.3),color:"#f4ecd8",rot:0,vr:rnd(-0.2,0.2),life:1,decay:0.014,half:"skull"});
      for(let k=0;k<5;k++){const a=rnd(0,TAU),s2=rnd(1,4);
        glints.push({x:ox,y:drillY,vx:Math.cos(a)*s2,vy:Math.sin(a)*s2-1,life:1,decay:0.03,size:rnd(5,9),col:"#fff6dc"});}
      rings.push({x:ox,y:drillY,r:8,life:1,decay:0.06,col:"#f4ecd8"});
      floats.push({x:api.W/2,y:drillY-110,txt:"ガラガラ！ +"+gain,col:"#fff3da",life:1,vy:-1.1,size:28});
      boost=Math.max(boost,0.5);
    }else if(c.type==="car"){
      // 乗り物: うもれた おもちゃのくるま。タイヤが左右へコロコロ、ボディが上へぽーんと跳ねる
      const gain=10*fmul;count+=gain;api.setScore(count);
      api.tone(440,0.1,"square",0.1);api.tone(554,0.16,"square",0.09);api.slide(200,700,0.2,0.14,"triangle");api.shake(9);
      flash=Math.max(flash,0.5);
      shards.push({x:ox-14,y:drillY+8,vx:-rnd(3,5.5),vy:-rnd(1,3),s:Math.max(10,chunkH*0.2),color:"#2b2b33",rot:0,vr:-rnd(0.25,0.4),life:1,decay:0.013,half:"wheel"});
      shards.push({x:ox+14,y:drillY+8,vx:rnd(3,5.5),vy:-rnd(1,3),s:Math.max(10,chunkH*0.2),color:"#2b2b33",rot:0,vr:rnd(0.25,0.4),life:1,decay:0.013,half:"wheel"});
      shards.push({x:ox,y:drillY-4,vx:rnd(-1.5,1.5),vy:-rnd(8,10),s:Math.max(18,chunkH*0.4),color:"#e8443a",rot:0,vr:rnd(-0.12,0.12),life:1.2,decay:0.012,half:"carbody"});
      for(let k=0;k<12;k++){const a=rnd(-2.6,-0.5),s2=rnd(3,8);
        sparks.push({x:ox+rnd(-16,16),y:drillY,vx:Math.cos(a)*s2,vy:Math.sin(a)*s2,r:rnd(2,5),life:1,decay:rnd(0.016,0.03),col:pick(["#ffd23f","#ff8c42","#ffffff"])});}
      rings.push({x:ox,y:drillY,r:8,life:1,decay:0.05,col:"#ff7a6a"});
      floats.push({x:api.W/2+shaftW*0.28,y:drillY-110,txt:"ぽーん！ +"+gain,col:"#ff9a8a",life:1,vy:-1.2,size:30});
      boost=Math.max(boost,0.55);
    }else if(c.type==="mole"){
      // 生き物: ねぼけた もぐら。「びっくり！」と上へ飛んで、くるくる落ちる
      const gain=7*fmul;count+=gain;api.setScore(count);
      api.slide(900,1500,0.14,0.14,"triangle");api.tone(1200,0.08,"sine",0.08);api.noise(0.08,0.14,900,"lowpass");api.shake(7);
      flash=Math.max(flash,0.45);
      shards.push({x:ox,y:drillY,vx:rnd(-1.5,1.5),vy:-rnd(9,11),s:Math.max(16,chunkH*0.34),color:"#8a6a5a",rot:0,vr:rnd(-0.2,0.2),life:1.3,decay:0.011,half:"mole"});
      for(let k=0;k<6;k++)shards.push({x:ox+rnd(-16,16),y:drillY+rnd(-4,8),vx:rnd(-3,3),vy:-rnd(2,5),s:rnd(4,8),color:pick(["#8a6a5a","#6b5040","#5c3a22"]),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.02,0.035)});
      for(let k=0;k<5;k++)glints.push({x:ox+rnd(-18,18),y:drillY-14+rnd(-6,6),vx:rnd(-1.5,1.5),vy:-rnd(1,2.6),life:1,decay:0.03,size:rnd(6,10),col:"#ffd0e0"});
      rings.push({x:ox,y:drillY,r:8,life:1,decay:0.06,col:"#ffb0c8"});
      floats.push({x:api.W/2,y:drillY-110,txt:"びっくり！ +"+gain,col:"#ffd0e0",life:1,vy:-1.2,size:30});
      boost=Math.max(boost,0.45);
    }else if(c.type==="fossil"){
      // 軸7: 第3の輪郭「かせき」。丸岩の放射状バーストとも、クリスタルの上下分離とも違う、
      // 数個のかけらがぽろぽろ下に落ちる壊れ方にする。得点(+1)・音の激しさはdirtと同じでバランスは変えない。
      count+=1*fmul;api.setScore(count);
      api.noise(0.1,0.16,700,"lowpass");api.shake(4);
      for(let k=0;k<5;k++)shards.push({x:ox+rnd(-shaftW*0.35,shaftW*0.35),y:drillY+rnd(-4,4),vx:rnd(-1.5,1.5),vy:rnd(1,3.2),s:rnd(5,9),color:"#a89272",rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.035)});
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
  // ---- 周回のボス「でっかいドッシー」: 押しっぱなしでなく ぽんぽんたたく。たたかなくても6秒で じぶんで くずれる(詰まない) ----
  function bossBreak(win){
    const c=boss;if(!c)return;
    boss=null;c.done=true;
    const ox=api.W/2;
    const gain=win?60:15;count+=gain;api.setScore(count);
    api.boom(win?0.65:0.35);api.shake(win?20:10);if(win)bigHitStop(4);
    api.slide(win?240:300,win?70:120,0.3,0.3,"square");api.noise(0.25,0.3,900,"lowpass");
    if(win){api.slide(520,1320,0.4,0.22,"triangle");api.tone(1046,0.4,"sine",0.14);}
    flash=Math.max(flash,0.9);
    for(let k=0;k<(win?30:16);k++)shards.push({x:ox+rnd(-shaftW*0.3,shaftW*0.3),y:drillY+rnd(-30,30),vx:rnd(-9,9),vy:-rnd(1,8),s:rnd(8,22),color:pick(["#9aa0aa","#7d8390","#8a8a92","#b0b4bc"]),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.009,0.018)});
    for(let k=0;k<(win?28:10);k++){const a=rnd(0,TAU),s=rnd(4,12);
      sparks.push({x:ox,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(3,7),life:1,decay:rnd(0.01,0.02),col:pick(GEM)});}
    rings.push({x:ox,y:drillY,r:10,life:1,decay:0.03,col:"#ffd23f"});
    floats.push({x:ox,y:drillY+70,txt:(win?"たおした！ +":"くずれた！ +")+gain,col:"#ffd23f",life:1,vy:-1.2,size:34});
    if(win)showBanner("たおした！","#ffd23f","でっかいドッシー ばいばい！");
    boost=Math.max(boost,0.9);
  }
  function hitBoss(){
    const c=boss;if(!c)return;
    c.hp--;bossHitT=1;count+=2;api.setScore(count);
    api.tone(260+(6-c.hp)*60,0.08,"square",0.12);api.noise(0.1,0.22,700,"lowpass");api.shake(8);
    for(let k=0;k<5;k++)shards.push({x:api.W/2+rnd(-50,50),y:drillY+rnd(-10,20),vx:rnd(-4,4),vy:-rnd(1,5),s:rnd(5,10),color:pick(["#9aa0aa","#7d8390"]),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.02,0.035)});
    floats.push({x:api.W/2+rnd(-40,40),y:drillY+30,txt:"ぽん！ +2",col:"#fff3da",life:1,vy:-1.2,size:24});
    if(c.hp<=0)bossBreak(true);
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
        else if(boss){hitBoss();}   // ボス中は どこを押しても ぽん！とたたける
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
      // 周回のボス: ドリルの先まで来たら そこで止まって「ぽんぽんたたく」遊びに変わる。たたかなくても じぶんで ひびが入り 6秒で崩れる
      if(!boss){const bc=chunks.find(c=>c.type==="boss"&&!c.done);
        if(bc&&depth>=bc.top+bc.h*0.3){boss=bc;boss.t=0;boss.tick=0;boss.hp=6;
          api.boom(0.4);api.shake(14);api.slide(200,90,0.3,0.26,"square");
          floats.push({x:api.W/2,y:api.H*0.6,txt:"でっかいドッシーが でた！",col:"#ffd27a",life:1.2,vy:-0.7,size:30});}}
      if(boss){depth=Math.min(depth,boss.top+boss.h*0.3);boss.t+=ds;boss.tick+=ds;
        if(boss.tick>=2){boss.tick=0;boss.hp--;bossHitT=1;count+=1;api.setScore(count);
          api.tone(200,0.1,"square",0.1);api.shake(6);floats.push({x:api.W/2,y:drillY+30,txt:"ぴし…",col:"#fff3da",life:1,vy:-1,size:22});
          if(boss.hp<=0)bossBreak(false);}
        if(boss&&boss.t>=6)bossBreak(false);}
      if(bossHitT>0)bossHitT=Math.max(0,bossHitT-0.08*dt);
      // 層のまんなかに来たら、まだ見ていない層なら ひかりむしを 必ず1ぴき(つかまえるタップが定期的に入る)
      {const zb=zoneAbs(depth);
        if(zb>lastBugZone&&depth>=zb*ZONE_M+ZONE_M*0.5){lastBugZone=zb;if(!bug)spawnBug();}}
      // zone arrival -> celebrate + banner (the "区切り"); final zone = clear
      const zi=zoneIdx(depth),za=zoneAbs(depth);
      if(za>zoneShown){
        // ③ パーフェクトチェイン: 前のゾーンで コンボx5 まで繋げていたら +40 & 祝福(気づくと得する仕掛け)
        if(zoneChain){count+=40;api.setScore(count);
          floats.push({x:api.W/2,y:(za>=ZONES.length-1&&!cleared)?api.H*0.78:api.H*0.62,txt:"パーフェクトチェイン！ ＋40",col:"#8affb0",life:1,vy:-0.9,size:28});
          api.tone(1318,0.16,"triangle",0.11);api.tone(1976,0.18,"triangle",0.07);
          for(let k=0;k<16;k++){const a=rnd(0,TAU),s=rnd(3,8);
            glints.push({x:api.W/2,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:0.02,size:rnd(6,12),col:"#c7ffcf"});}}
        zoneChain=false;gemsInZone=0;                 // 次ゾーンの判定をリセット
        zoneShown=za;stage=zi;
        if(za>=ZONES.length-1 && !cleared){
          cleared=true;
          showBanner("クリア！おたから はっけん！","#ffd23f","ぜんぶ ほりきった！ ごほうび +100");banner.chest=true;
          // 軸5: 一周目クリアの記念ごほうび(二周目からは出さない=もう一回ほる楽しみ)
          count+=100;api.setScore(count);
          api.boom(0.65);api.shake(20);api.hitStop(5);
          api.slide(520,1320,0.5,0.3,"triangle");api.tone(1046,0.5,"sine",0.18);
          for(let k=0;k<60;k++){const a=rnd(0,TAU),s=rnd(4,14);
            sparks.push({x:api.W/2,y:drillY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(3,8),life:1,decay:rnd(0.008,0.016),col:pick(GEM)});}
        }else if(cleared){
          // 軸4: クリア後も層の色替え+バナーが続く(周回)。にしゅうめ・さんしゅうめ…
          showBanner(ZONES[zi].name+" また！","#ffffff",lapName(Math.floor(za/ZONES.length)+1));
          api.boom(0.35);api.shake(10);api.hitStop(3);
          api.slide(440,900,0.3,0.24,"triangle");
          rings.push({x:api.W/2,y:drillY,r:10,life:1,decay:0.03,col:ZONES[zi].mid});
        }else{
          showBanner(ZONES[zi].name+" とうたつ！","#ffffff",(za*(ZONE_M/10))+"m");
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
        if(!c.done&&c.type!=="boss"&&depth>=c.top+c.h*0.55)dig(c);
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
        if(p.half==="lid"){
          const lw=Math.max(0,p.s*1.7),lh=Math.max(0,p.s*0.5);
          g.fillStyle="#ffce4d";g.fillRect(-lw/2,-lh/2,lw,lh);
          g.fillStyle="#7a4a1c";g.fillRect(-lw/2,lh*0.1,lw,lh*0.4);
          g.lineWidth=2;g.strokeStyle="#3a1c08";g.strokeRect(-lw/2,-lh/2,lw,lh);
        }else if(p.half==="bar"){
          // ほねの かけら: 白い角丸の棒+両はしの丸いこぶ(濃い茶の縁取り)
          const bl=Math.max(2,p.s),bt=Math.max(2,bl*0.22);
          g.fillStyle=p.color;g.lineWidth=3;g.strokeStyle="#4a3420";
          roundRect(-bl/2,-bt/2,bl,bt,Math.max(1,bt/2));g.fill();g.stroke();
          g.beginPath();g.arc(-bl/2,0,bt*0.7,0,TAU);g.arc(bl/2,0,bt*0.7,0,TAU);g.fill();g.stroke();
        }else if(p.half==="skull"){
          const hs=Math.max(2,p.s);
          g.fillStyle=p.color;g.lineWidth=3;g.strokeStyle="#4a3420";
          g.beginPath();g.arc(0,0,hs*0.8,0,TAU);g.fill();g.stroke();
          g.fillStyle="#4a3420";g.beginPath();g.arc(-hs*0.3,-hs*0.1,hs*0.17,0,TAU);g.arc(hs*0.3,-hs*0.1,hs*0.17,0,TAU);g.fill();
        }else if(p.half==="wheel"){
          const hs=Math.max(2,p.s);
          g.fillStyle=p.color;g.beginPath();g.arc(0,0,hs,0,TAU);g.fill();
          g.lineWidth=2.5;g.strokeStyle="#ffffff";g.stroke();
          g.fillStyle="#cfd3da";g.beginPath();g.arc(0,0,hs*0.4,0,TAU);g.fill();
          g.strokeStyle="#6a6f7a";g.lineWidth=2;g.beginPath();g.moveTo(-hs*0.4,0);g.lineTo(hs*0.4,0);g.stroke();
        }else if(p.half==="carbody"){
          const hs=Math.max(2,p.s);
          g.fillStyle=p.color;g.lineWidth=3;g.strokeStyle="#3a0e0a";
          roundRect(-hs*1.1,-hs*0.35,hs*2.2,hs*0.8,hs*0.25);g.fill();g.stroke();
          g.fillStyle="#bfe6ff";roundRect(-hs*0.55,-hs*0.85,hs*1.1,hs*0.55,hs*0.2);g.fill();g.stroke();
        }else if(p.half==="mole"){
          const hs=Math.max(2,p.s);
          g.fillStyle=p.color;g.lineWidth=3;g.strokeStyle="#3a2418";
          g.beginPath();g.arc(0,0,hs,0,TAU);g.fill();g.stroke();
          g.fillStyle="#ff9ab8";g.beginPath();g.arc(0,hs*0.2,hs*0.3,0,TAU);g.fill();g.stroke();
          g.fillStyle="#ffffff";g.beginPath();g.arc(-hs*0.4,-hs*0.3,hs*0.2,0,TAU);g.arc(hs*0.4,-hs*0.3,hs*0.2,0,TAU);g.fill();
          g.fillStyle="#23323f";g.beginPath();g.arc(-hs*0.4,-hs*0.3,hs*0.1,0,TAU);g.arc(hs*0.4,-hs*0.3,hs*0.1,0,TAU);g.fill();
        }else if(p.half==="left"||p.half==="right"){
          const hs=Math.max(0,p.s),sd=p.half==="left"?-1:1;
          g.fillStyle=p.color;g.beginPath();g.moveTo(0,-hs*0.9);g.lineTo(sd*hs*0.35,-hs*0.9);g.lineTo(sd*hs*0.9,-hs*0.1);
          g.lineTo(sd*hs*0.7,hs*0.8);g.lineTo(0,hs*0.9);g.closePath();g.fill();
          g.lineWidth=2;g.strokeStyle="#5c3a22";g.stroke();
        }else if(p.half==="gem"){
          g.fillStyle=p.color;g.shadowColor=p.color;g.shadowBlur=10;drawDiamond(Math.max(0,p.s));g.shadowBlur=0;
          g.fillStyle="rgba(255,255,255,.7)";drawDiamond(Math.max(0,p.s*0.4));
        }else if(p.half){
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
      if(cleared&&banner&&banner.chest&&banner.life>0)drawChest(now);
      // floats
      for(const f of floats){f.y+=f.vy*0.6*dt;f.life-=0.010*dt;g.globalAlpha=Math.max(0,f.life);
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
        const hg=g.createRadialGradient(bug.x,bug.y,1,bug.x,bug.y,48);
        hg.addColorStop(0,bug.hue);hg.addColorStop(1,"rgba(0,0,0,0)");
        g.globalAlpha=0.6*tw;g.fillStyle=hg;g.beginPath();g.arc(bug.x,bug.y,48,0,TAU);g.fill();
        g.globalAlpha=1;g.globalCompositeOperation="source-over";
        // 本体は黒縁つきで 明るい帯の上でも消えない(見かけ約70px)
        g.fillStyle=bug.hue;g.beginPath();g.arc(bug.x,bug.y,14,0,TAU);g.fill();
        g.lineWidth=3;g.strokeStyle="rgba(0,0,0,.55)";g.stroke();
        g.fillStyle="rgba(255,255,255,.9)";g.beginPath();g.arc(bug.x-4,bug.y-4,5,0,TAU);g.fill();
        const wf=Math.sin(bug.ph*6)*0.5;
        g.strokeStyle="rgba(255,255,255,.85)";g.lineWidth=2.5;g.lineCap="round";
        g.beginPath();g.arc(bug.x-14,bug.y-4,11,Math.PI*0.9+wf,Math.PI*1.7+wf);g.stroke();
        g.beginPath();g.arc(bug.x+14,bug.y-4,11,Math.PI*1.3-wf,Math.PI*2.1-wf);g.stroke();
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
        g.save();g.translate(api.W/2,api.H*0.17);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.2,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキーいろは "+(GEMNAME[luckyColor]||"")+"！";
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
    g.save();g.globalAlpha=a;g.translate(api.W/2,b.chest?api.H*0.66:api.H*0.42);g.scale(sc,sc);
    g.textAlign="center";g.textBaseline="middle";
    g.font="900 40px 'Hiragino Maru Gothic ProN',system-ui";
    g.lineWidth=11;g.strokeStyle="rgba(0,0,0,.75)";g.strokeText(b.txt,0,0);
    g.shadowColor=b.col;g.shadowBlur=22;g.fillStyle=b.col;g.fillText(b.txt,0,0);g.shadowBlur=0;
    if(b.sub){g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
      g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(b.sub,0,34);
      g.fillStyle="#fff3da";g.fillText(b.sub,0,34);}
    g.restore();
    g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";
  }
  function drawChunk(c,topY){
    const x=shaftX,w=shaftW;
    const ox=(c.fx||0)*w; // 横ずれ(見た目だけ)
    const isRocky=c.type==="rock"||c.type==="boulder";
    const gone=c.done&&c.type!=="boss"; // 壊した後は本体を描かない(土の帯だけ)=かけらと二重に見えない
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
    if(!gone&&isRocky){
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
        const cx0=x+w/2+ox,cy0=topY+c.h/2;
        // 大きさをseedでばらつかせる(0.75〜1.25倍)。丸岩は帯からはみ出し過ぎないよう上限を付ける
        const szv=0.75+0.5*((c.seed%7)/7);
        const baseR=Math.max(0,Math.min(Math.min(c.h,w)*(big?0.62:(c.hp>=2?0.5:0.4))*szv,c.h*0.56));
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
    if(!gone&&c.type==="pebble"){
      // 軸7: dirt(平らな帯)の半分に小さい丸石を1つ置き、四角い帯ばかりに見えないようにする(既存の丸岩描画を縮小して流用)
      g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
      const cx0=x+w/2+ox,cy0=topY+c.h/2;
      const baseR=Math.max(0,Math.min(c.h,w)*0.22*(0.75+0.5*((c.seed%7)/7)));
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
    if(!gone&&c.type==="fossil"){
      // 軸7: 丸(岩)でもひし形(ジェム)でもない第3の輪郭。横長・角ばった/枝分かれした「かせき」を
      // 線描画(円弧の重ね合わせではない)で表現する。
      g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
      const cy0=topY+c.h*0.55;
      const bw=Math.min(w*0.62,220),bx0=x+w/2+ox-bw/2;
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
    if(!gone&&c.type==="ice"){
      // 軸7: こおりのかたまり。水色の六角形(ガラス)+白いハイライトと濃い青の縁取りで、青い帯の上でも浮いて見える
      g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
      const cx0=x+w/2+ox,cy0=topY+c.h/2;
      const R=Math.max(0,Math.min(c.h,w)*0.4*(0.8+0.4*((c.seed%7)/7)));
      const ig=g.createLinearGradient(cx0-R,cy0-R,cx0+R,cy0+R);
      ig.addColorStop(0,"#ffffff");ig.addColorStop(0.5,"#d2f1ff");ig.addColorStop(1,"#7cc4f0");
      g.shadowColor="rgba(200,240,255,.9)";g.shadowBlur=12;g.fillStyle=ig;
      g.beginPath();for(let i=0;i<6;i++){const a=i/6*TAU+Math.PI/6;const px2=cx0+Math.cos(a)*R,py2=cy0+Math.sin(a)*R*0.92;if(i===0)g.moveTo(px2,py2);else g.lineTo(px2,py2);}
      g.closePath();g.fill();g.shadowBlur=0;
      g.lineWidth=3;g.strokeStyle="#1f5f9a";g.stroke();
      g.strokeStyle="rgba(31,95,154,.45)";g.lineWidth=1.6;g.beginPath();
      g.moveTo(cx0-R*0.5,cy0-R*0.3);g.lineTo(cx0+R*0.1,cy0+R*0.1);g.lineTo(cx0+R*0.45,cy0-R*0.45);g.moveTo(cx0+R*0.1,cy0+R*0.1);g.lineTo(cx0-R*0.1,cy0+R*0.6);g.stroke();
      g.fillStyle="rgba(255,255,255,.85)";g.beginPath();g.moveTo(cx0-R*0.62,cy0-R*0.2);g.lineTo(cx0-R*0.3,cy0-R*0.62);g.lineTo(cx0-R*0.12,cy0-R*0.48);g.lineTo(cx0-R*0.42,cy0-R*0.05);g.closePath();g.fill();
      g.restore();
    }
    if(!gone&&c.type==="magma"){
      // 軸7: マグマだま。黒っぽい殻の縁取り+中の黄色い熱で、赤橙の帯の上でも輪郭が読める
      g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
      const cx0=x+w/2+ox,cy0=topY+c.h/2;
      const R=Math.max(0,Math.min(c.h,w)*0.36*(0.8+0.4*((c.seed%7)/7)));
      const pulse=0.6+0.4*Math.sin(spin*3+c.seed);
      g.shadowColor="#ffb347";g.shadowBlur=14;g.fillStyle="#2a0c06";
      g.beginPath();g.arc(cx0,cy0,R,0,TAU);g.fill();g.shadowBlur=0;
      const mg=g.createRadialGradient(cx0-R*0.2,cy0-R*0.2,Math.max(0,R*0.05),cx0,cy0,Math.max(1,R*0.9));
      mg.addColorStop(0,"#fff3a0");mg.addColorStop(0.5,"#ffb12a");mg.addColorStop(1,"#e8460e");
      g.fillStyle=mg;g.beginPath();g.arc(cx0,cy0,Math.max(0,R*0.82),0,TAU);g.fill();
      g.strokeStyle="rgba(42,12,6,.8)";g.lineWidth=3;g.lineCap="round";g.beginPath();
      g.moveTo(cx0-R*0.5,cy0-R*0.1);g.lineTo(cx0-R*0.1,cy0+R*0.1);g.lineTo(cx0+R*0.2,cy0-R*0.3);g.moveTo(cx0-R*0.1,cy0+R*0.1);g.lineTo(cx0,cy0+R*0.55);g.stroke();
      g.globalCompositeOperation="lighter";g.globalAlpha=0.35*pulse;
      const hg=g.createRadialGradient(cx0,cy0,Math.max(0,R*0.5),cx0,cy0,Math.max(1,R*1.5));hg.addColorStop(0,"#ff9a3c");hg.addColorStop(1,"rgba(0,0,0,0)");
      g.fillStyle=hg;g.beginPath();g.arc(cx0,cy0,Math.max(0,R*1.5),0,TAU);g.fill();
      g.globalAlpha=1;g.globalCompositeOperation="source-over";
      g.restore();
    }
    if(!gone&&c.type==="crystal"){g.save();g.translate(x+w/2+ox,topY+c.h/2);
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
    if(!gone&&c.type==="pot"){
      // 軸7: つぼ。粘土色の丸い胴+細い首+ふちの縦長シルエット。濃い茶の縁取りで茶色の土の帯の上でも浮く
      g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
      const cx0=x+w/2+ox,cy0=topY+c.h*0.58;
      const R=Math.max(0,chunkH*0.34*(0.9+0.2*((c.seed%5)/5)));
      g.shadowColor="rgba(255,225,170,.8)";g.shadowBlur=8;
      g.fillStyle="#c98a5a";g.lineWidth=3;g.strokeStyle="#3a2210";
      g.beginPath();g.arc(cx0,cy0,R,0,TAU);g.fill();g.stroke();
      g.shadowBlur=0;
      g.fillStyle="#c98a5a";
      g.beginPath();g.rect(cx0-R*0.34,cy0-R*1.25,R*0.68,R*0.6);g.fill();g.stroke();
      g.beginPath();g.rect(cx0-R*0.52,cy0-R*1.42,R*1.04,R*0.22);g.fill();g.stroke();
      g.fillStyle="#9a5f36";g.beginPath();g.arc(cx0,cy0,Math.max(0,R*0.97),0.1*Math.PI,0.9*Math.PI);g.lineTo(cx0-R*0.7,cy0+R*0.2);g.closePath();g.fill();
      g.strokeStyle="#5c3a22";g.lineWidth=2.5;g.beginPath();g.arc(cx0,cy0,Math.max(0,R*0.72),Math.PI*1.05,Math.PI*1.95);g.stroke();
      g.fillStyle="rgba(255,240,210,.6)";g.beginPath();g.ellipse(cx0-R*0.42,cy0-R*0.38,Math.max(0,R*0.12),Math.max(0,R*0.26),-0.5,0,TAU);g.fill();
      g.restore();
    }
    if(!gone&&c.type==="chest"){
      // 軸7: たからばこ。金の背景に負けないよう 暗い影の皿+濃い茶の木箱+金の帯と錠前。画像があれば画像、無ければ手描き
      g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
      const cx0=x+w/2+ox,cy0=topY+c.h/2;
      g.fillStyle="rgba(60,30,6,.45)";g.beginPath();g.ellipse(cx0,cy0+c.h*0.3,Math.max(0,c.h*0.62),Math.max(0,c.h*0.18),0,0,TAU);g.fill();
      if(api.asset("chest").ready){
        api.drawAsset("chest",cx0,cy0,chunkH*1.05,chunkH*1.05,{center:true});
      }else{
        const bw=Math.max(8,chunkH*0.86),bh=Math.max(6,chunkH*0.6),bx=cx0-bw/2,by=cy0-bh/2+4;
        g.lineWidth=3;g.strokeStyle="#3a1c08";
        g.fillStyle="#8a4b1f";roundRect(bx,by+bh*0.38,bw,bh*0.62,5);g.fill();g.stroke();
        g.fillStyle="#a85f28";g.beginPath();g.moveTo(bx,by+bh*0.4);g.lineTo(bx,by+bh*0.12);g.quadraticCurveTo(cx0,by-bh*0.22,bx+bw,by+bh*0.12);g.lineTo(bx+bw,by+bh*0.4);g.closePath();g.fill();g.stroke();
        g.fillStyle="#ffce4d";g.fillRect(bx+bw*0.2,by+bh*0.05,bw*0.12,bh*0.95);g.fillRect(bx+bw*0.68,by+bh*0.05,bw*0.12,bh*0.95);
        g.fillStyle="#ffe27a";g.fillRect(cx0-bw*0.07,by+bh*0.32,bw*0.14,bh*0.26);
        g.strokeStyle="#3a1c08";g.lineWidth=1.5;g.strokeRect(cx0-bw*0.07,by+bh*0.32,bw*0.14,bh*0.26);
      }
      const tw=0.5+0.5*Math.sin(spin*2.2+c.seed);
      drawStar(cx0+chunkH*0.34,cy0-chunkH*0.3,3+3*tw,"#ffffff");
      g.restore();
    }
    if(!gone&&c.type==="bone"){
      // 生き物: きょうりゅうの ほねの ほねぐみ。白い角丸の横長ほね3本(あばら)+あたまの丸+しっぽ。暗い影皿と濃い茶の縁取りで土の上でも浮く
      g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
      const cx0=x+w/2+ox,cy0=topY+c.h/2;
      const bw=Math.max(40,Math.min(w*0.62,chunkH*2.8)),bt=Math.max(8,chunkH*0.17),gap=Math.max(14,c.h*0.2);
      g.fillStyle="rgba(40,22,8,.45)";g.beginPath();g.ellipse(cx0,cy0+c.h*0.05,Math.max(0,bw*0.62),Math.max(0,c.h*0.42),0,0,TAU);g.fill();
      g.lineWidth=3;g.strokeStyle="#4a3420";g.fillStyle="#f6efdc";
      for(let k=-1;k<=1;k++){
        const bl=bw*(k===0?0.78:0.62),by=cy0+k*gap,bx=cx0-bw*0.14-bl/2;
        roundRect(bx,by-bt/2,bl,bt,bt/2);g.fill();g.stroke();
        g.beginPath();g.arc(bx,by-bt*0.5,bt*0.6,0,TAU);g.arc(bx,by+bt*0.5,bt*0.6,0,TAU);g.arc(bx+bl,by-bt*0.5,bt*0.6,0,TAU);g.arc(bx+bl,by+bt*0.5,bt*0.6,0,TAU);g.fill();g.stroke();
      }
      // せぼね(たて)としっぽ
      roundRect(cx0-bw*0.14-bt*0.5,cy0-gap-bt*0.5,bt,gap*2+bt,bt/2);g.fill();g.stroke();
      // あたま
      const hr=Math.max(8,chunkH*0.3),hx=cx0+bw*0.5,hy=cy0;
      g.beginPath();g.arc(hx,hy,hr,0,TAU);g.fill();g.stroke();
      roundRect(hx-hr*0.1,hy+hr*0.35,hr*1.5,hr*0.55,hr*0.2);g.fill();g.stroke();
      g.fillStyle="#4a3420";g.beginPath();g.arc(hx+hr*0.2,hy-hr*0.2,hr*0.22,0,TAU);g.fill();
      g.fillStyle="#f6efdc";g.lineWidth=2;
      for(let k=0;k<3;k++){const tx2=hx+hr*0.2+k*hr*0.4;g.beginPath();g.moveTo(tx2,hy+hr*0.35);g.lineTo(tx2+hr*0.12,hy+hr*0.6);g.lineTo(tx2+hr*0.24,hy+hr*0.35);g.closePath();g.fill();g.stroke();}
      g.restore();
    }
    if(!gone&&c.type==="car"){
      // 乗り物: うもれた おもちゃのくるま。赤い角丸ボディ+水色の窓+黒いタイヤ2つ。濃い縁取りと影皿で青/橙の帯の上でも読める
      g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
      const cx0=x+w/2+ox,cy0=topY+c.h/2;
      const cw=Math.max(40,Math.min(w*0.6,chunkH*2.2)),ch2=cw*0.34,wr=Math.max(6,cw*0.14);
      g.fillStyle="rgba(30,10,4,.5)";g.beginPath();g.ellipse(cx0,cy0+ch2*0.9,Math.max(0,cw*0.62),Math.max(0,ch2*0.62),0,0,TAU);g.fill();
      g.lineWidth=3.5;g.strokeStyle="#3a0e0a";
      g.fillStyle="#e8443a";roundRect(cx0-cw/2,cy0-ch2*0.1,cw,ch2*0.85,ch2*0.3);g.fill();g.stroke();
      g.fillStyle="#f26a5c";roundRect(cx0-cw*0.3,cy0-ch2*0.85,cw*0.6,ch2*0.85,ch2*0.3);g.fill();g.stroke();
      g.fillStyle="#bfe6ff";roundRect(cx0-cw*0.24,cy0-ch2*0.7,cw*0.22,ch2*0.55,ch2*0.12);g.fill();g.stroke();
      roundRect(cx0+cw*0.02,cy0-ch2*0.7,cw*0.22,ch2*0.55,ch2*0.12);g.fill();g.stroke();
      g.fillStyle="#ffe27a";g.beginPath();g.arc(cx0+cw*0.45,cy0+ch2*0.2,Math.max(0,wr*0.4),0,TAU);g.fill();
      g.fillStyle="#2b2b33";g.lineWidth=3;
      for(const sx2 of [-0.28,0.28]){g.beginPath();g.arc(cx0+cw*sx2,cy0+ch2*0.8,wr,0,TAU);g.fill();g.stroke();
        g.fillStyle="#cfd3da";g.beginPath();g.arc(cx0+cw*sx2,cy0+ch2*0.8,wr*0.4,0,TAU);g.fill();g.fillStyle="#2b2b33";}
      g.restore();
    }
    if(!gone&&c.type==="mole"){
      // 生き物: ねぼけた もぐら。つちの山から ひょっこり。丸い体+ピンクの鼻+ひげ+とじた目。濃い縁取りで紫の帯の上でも浮く
      g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
      const cx0=x+w/2+ox,cy0=topY+c.h/2;
      const R=Math.max(10,chunkH*0.52*(0.92+0.16*((c.seed%5)/5)));
      g.fillStyle="rgba(30,10,40,.45)";g.beginPath();g.ellipse(cx0,cy0+R*0.9,Math.max(0,R*1.5),Math.max(0,R*0.5),0,0,TAU);g.fill();
      g.lineWidth=3.5;g.strokeStyle="#2e1c12";
      g.fillStyle="#6b4a34";g.beginPath();g.ellipse(cx0,cy0+R*0.9,Math.max(0,R*1.35),Math.max(0,R*0.42),0,0,TAU);g.fill();g.stroke();
      g.fillStyle="#8a6a5a";g.beginPath();g.arc(cx0,cy0,R,0,TAU);g.fill();g.stroke();
      g.fillStyle="#ff9ab8";g.beginPath();g.ellipse(cx0,cy0+R*0.28,Math.max(0,R*0.3),Math.max(0,R*0.22),0,0,TAU);g.fill();g.stroke();
      g.strokeStyle="#2e1c12";g.lineWidth=3;g.lineCap="round";
      g.beginPath();g.arc(cx0-R*0.4,cy0-R*0.2,Math.max(0,R*0.16),0.1*Math.PI,0.9*Math.PI);g.stroke();
      g.beginPath();g.arc(cx0+R*0.4,cy0-R*0.2,Math.max(0,R*0.16),0.1*Math.PI,0.9*Math.PI);g.stroke();
      g.lineWidth=2;
      for(const sd of [-1,1]){for(const dy of [-0.05,0.18]){g.beginPath();g.moveTo(cx0+sd*R*0.38,cy0+R*(0.3+dy));g.lineTo(cx0+sd*R*0.95,cy0+R*(0.2+dy*2.2));g.stroke();}}
      g.fillStyle="#ffc0d4";g.lineWidth=2.5;
      for(const sd of [-1,1]){g.beginPath();g.ellipse(cx0+sd*R*0.62,cy0+R*0.78,Math.max(0,R*0.2),Math.max(0,R*0.14),0,0,TAU);g.fill();g.stroke();}
      g.restore();
    }
    if(c.type==="boss"&&!c.done){
      // 周回のボス「でっかいドッシー」: 大きな石の顔の像。灰色の角丸+まゆ+大きな目+歯。濃い縁取りで背景から浮く。たたくとゆれて ひびが増える
      g.save();g.beginPath();g.rect(x,topY,w,c.h+1);g.clip();
      const shake=(boss===c&&bossHitT>0)?Math.sin(bossHitT*30)*6*bossHitT:0;
      const cx0=x+w/2+shake,cy0=topY+c.h*0.5;
      const bwid=Math.max(80,Math.min(w*0.78,chunkH*3.4)),bhgt=c.h*0.88;
      const hp=Math.max(0,Math.min(6,c.hp));
      g.fillStyle="rgba(10,6,4,.5)";g.beginPath();g.ellipse(cx0,cy0+bhgt*0.46,Math.max(0,bwid*0.58),Math.max(0,bhgt*0.1),0,0,TAU);g.fill();
      const sg=g.createLinearGradient(cx0-bwid/2,cy0-bhgt/2,cx0+bwid/2,cy0+bhgt/2);
      sg.addColorStop(0,"#b6bcc6");sg.addColorStop(1,"#6a707c");
      g.fillStyle=sg;g.lineWidth=5;g.strokeStyle="#22242c";
      roundRect(cx0-bwid/2,cy0-bhgt/2,bwid,bhgt,Math.min(bwid,bhgt)*0.28);g.fill();g.stroke();
      const hit=boss===c&&bossHitT>0.5;
      for(const sd of [-1,1]){
        const ex=cx0+sd*bwid*0.2,ey=cy0-bhgt*0.08,er=Math.max(4,bwid*0.1);
        g.lineWidth=5;g.strokeStyle="#22242c";g.lineCap="round";
        g.beginPath();g.moveTo(ex-sd*er*1.4,ey-er*(sd<0?1.9:1.2));g.lineTo(ex+sd*er*1.2,ey-er*(sd<0?1.2:1.9));g.stroke();
        if(hit){g.lineWidth=4;g.beginPath();g.moveTo(ex-er*0.8,ey-er*0.8);g.lineTo(ex+er*0.8,ey+er*0.8);g.moveTo(ex+er*0.8,ey-er*0.8);g.lineTo(ex-er*0.8,ey+er*0.8);g.stroke();}
        else{g.fillStyle="#ffffff";g.lineWidth=3;g.beginPath();g.arc(ex,ey,er,0,TAU);g.fill();g.stroke();
          g.fillStyle="#22242c";g.beginPath();g.arc(ex+sd*er*0.1,ey+er*0.15,er*0.5,0,TAU);g.fill();}
      }
      g.fillStyle="#ffffff";g.lineWidth=4;g.strokeStyle="#22242c";
      roundRect(cx0-bwid*0.24,cy0+bhgt*0.16,bwid*0.48,bhgt*0.2,8);g.fill();g.stroke();
      g.lineWidth=2.5;for(let k=1;k<5;k++){g.beginPath();g.moveTo(cx0-bwid*0.24+bwid*0.48*k/5,cy0+bhgt*0.16);g.lineTo(cx0-bwid*0.24+bwid*0.48*k/5,cy0+bhgt*0.36);g.stroke();}
      // ひび: たたくほど ふえる
      g.strokeStyle="rgba(20,20,28,.75)";g.lineWidth=3;g.beginPath();
      const cr=[[-0.35,-0.45,-0.2,-0.3,-0.28,-0.12],[0.3,-0.42,0.15,-0.25,0.25,-0.05],[-0.1,0.4,0.05,0.28,-0.05,0.18],[0.4,0.1,0.3,0.25,0.42,0.38],[-0.42,0.15,-0.3,0.3,-0.4,0.4]];
      for(let k=0;k<Math.min(5,6-hp);k++){const q=cr[k];g.moveTo(cx0+q[0]*bwid,cy0+q[1]*bhgt);g.lineTo(cx0+q[2]*bwid,cy0+q[3]*bhgt);g.lineTo(cx0+q[4]*bwid,cy0+q[5]*bhgt);}
      g.stroke();
      // のこりHP(まるが へる)
      for(let k=0;k<6;k++){const px2=cx0+(k-2.5)*bwid*0.11,py2=cy0-bhgt*0.37;
        g.fillStyle=k<hp?"#ffd23f":"rgba(0,0,0,.35)";g.lineWidth=2.5;g.strokeStyle="#22242c";
        g.beginPath();g.arc(px2,py2,Math.max(3,bwid*0.035),0,TAU);g.fill();g.stroke();}
      g.restore();
    }
    if(!gone&&c.type==="rainbow"){g.save();g.translate(x+w/2,topY+c.h/2);
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
    if(!gone&&c.type==="gem"){g.save();g.translate(x+w/2+ox,topY+c.h/2);
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
    g.save();g.translate(cx,cy);g.scale(1.25,1.25);g.translate(-cx,-cy); // 見た目だけ1.25倍(判定は drillY 基準のまま)
    g.translate(cx,cy);g.rotate(lean*Math.max(0,leanT)*0.12);g.translate(-cx,-cy);
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
    g.beginPath();g.arc(cx-3.2,cy-59,2.6,0,TAU);g.arc(cx+3.2,cy-59,2.6,0,TAU);g.fill();
    g.fillStyle="#fff";g.beginPath();g.arc(cx-3.6+eo*0.2,cy-59.6,0.6,0,TAU);g.arc(cx+2.8+eo*0.2,cy-59.6,0.6,0,TAU);g.fill();
    // smile (opens a bit while drilling)
    g.strokeStyle="#23323f";g.lineWidth=2;g.beginPath();g.arc(cx,cy-55,2.4,0.15*Math.PI,0.85*Math.PI);g.stroke();
    // rosy cheeks
    g.fillStyle="rgba(255,130,150,.5)";g.beginPath();g.arc(cx-6,cy-56,2.6,0,TAU);g.arc(cx+6,cy-56,2.6,0,TAU);g.fill();
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
    const hint=boss?"ぽんぽん たたいて やっつけよう！":"おしっぱなしで ほる！ ひだり・みぎで おうえん！";
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
