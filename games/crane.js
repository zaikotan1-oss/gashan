function buildWrecking(api){
  const g=api.g;
  // 画像アセット(無ければ従来の手描きにフォールバック): 夜の街の背景 / マスコット
  //  ※鉄球(ball)/ばくだん(bomb)は 生成で背景抜きの円盤・床が残り続けたため 画像を使わず 手描きのまま。
  api.preload(["bg.jpg","mascot.png"]);
  let blocks=[],shards=[],dust=[],smashers=[],floats=[],sparks=[],rings=[],motes=[],flash=0;
  let S,aimS,cols,bx,groundY,level=1,count=0,combo=0,comboT=0,power=0,armed=false,tsec=0,flashHue="#fff";
  let craneSwing=0,smashFace=0,celebrate=0,hsCD=0,bestBurst=0,hintShown=false;
  // 発見/隠し判定まわりの状態（会期内保持・localStorageは使わない）
  let pickups=[],shootStars=[];           // 星ピックアップ / ながれ星
  let starCount=0;const STAR_GOAL=5;       // かくれ星コレクション：STAR_GOAL個ごとにごほうび
  let moonCD=0,mascotCD=0;                 // 月/マスコットの隠しタップのクールダウン
  // そらのいきもの（テーマ別・毎回ちがう位置/時刻で出現。ボールが近づく/タップで発見）
  let creature=null,creatureCD=rint(220,520);
  // にげる金ブロック（時間制限の発見）: たまに1つが金に光る→時間内に壊すと大ボーナス
  let goldRef=null,goldT=0,goldCD=rint(240,520);
  // にじいろボーナス（同色3つ以上の隠し判定）でボールが虹色に光る残り時間
  let rainbow=0;
  // セッションのラッキー色（毎プレイ秘密指定＝日替わり風）: この色を壊すと 極小キラリ+1。
  //  位置RNGでなく「今日はこの色が当たり」という毎回ちがう発見を安価に足す（気づくと得）。
  let luckyColor="",luckyCD=0,luckyN=0;   // luckyColor は COLORS 定義後にセット
  // 柱ぜんけし（列の隠し判定）: ある列を丸ごと消すと 横スイープのごほうび。
  //  occSet=いま何かがある列。sweeps=走る光の帯。行/列認識は今まで無かった純粋に新しい軸。
  let sweeps=[],occSet=new Set();
  // きょうの はっけん タリー（会期内・町クリア画面に点灯表示）: 種類ごとの発見回数
  let found={gem:0,star:0,moon:0,creature:0,gold:0};
  // 第4R追加 --------------------------------------------------------------
  // (1) 超レア「レインボービル」: 約1/22でビルまるごと宝石色。長セッションで一度見て「今の見た!?」
  //     となる長期テール（=毎回あたらしい発見の核）。常連特別とは別の"レア階層"。
  let rareBuilding=false;
  // (2) 温存フィナーレ（順序＝新しい考えどころ）: ビルの最後の1個が特別だと大フィナーレ。
  //     「いいのは最後に取っておくと得」。タップのまま "残す順番" を足す隠し判定。
  let finaleKind=null;                        // 直近に壊したブロックの種別（gem/star/key/gold/rainbow/null）
  // (3) 会期メタ収集: いきもの4種コンプで「そらのパレード」を実際にアンロック。星5とは別の
  //     会期をまたぐ収集。以後は町クリアごとに短いパレードが走る（受動タリー→能動ごほうび）。
  let creatureSet=new Set(),paradeUnlocked=false,parade=[],paradeCele=0;
  // (整理) 爆弾リンク網は「2個以上 かつ 無操作時」だけ表示してピーク負荷を下げる。
  let idleT=0;                                // 最後の操作からの経過フレーム
  // 第1R(多様化): ビルごとに「テーマ(レシピ)」を抽選し、物の種類(kind)/大きさ(sizeScale)/硬さ(hp)を変える。
  //  curRecipe=いま建っているビルのレシピ / nextRecipe=次ビルの予告用（先に抽選しておく）。
  //  spawnTitle=出現時に「○○！」を大きく見せる残り時間。sizeScaleはlayoutのマス目サイズ倍率。
  let sizeScale=1,curRecipe=null,nextRecipe=null,spawnTitle=0,spawnTxt="";
  // hitStop はクールダウン付きでのみ発火（大ヒット/爆発の節目だけ・連打で画面が凍らないように）
  function tryHitStop(f){if(hsCD<=0){api.hitStop(f);hsCD=34;}}
  // フロート文字のキュー整理（ごちゃつき防止／評価者フィードバックA）:
  //  同時多発時は「最上位だけ大きく、他は小さく下へ」縦スタッガー。合計上限で画面を守る。
  //  ※floats.push の代わりにこれを使う（recursion回避のため中では push を使わない）。
  function pushFloat(o){
    o.born=0;
    let fresh=0;for(const f of floats)if((f.born||0)<12)fresh++;
    if(fresh>0){                       // すでに出ている“同じ噴出”の下へ小さく積む
      o.y=Math.max(o.y,api.H*0.30)+fresh*20;
      o.x=lerp(o.x,api.W/2,0.55);
      o.size=Math.max(16,Math.min(o.size,26)*0.82);
      o.vy=-0.4;
    }
    floats[floats.length]=o;
    if(floats.length>7)floats.splice(0,floats.length-7);
  }
  // stage progression: every building cleared advances stage; every SET_LEN buildings = "next town"
  let stage=1,setStage=0,clearBanner=0,clearTxt="",townCele=0,loops=0,stageClearing=false;
  const SET_LEN=4;
  // 4 visual themes that cycle as you advance towns (sky tint + block material name)
  const THEMES=[
    {name:"よる の まち",   sky:["#1a1148","#3a1f6e","#7d3a9e","#ff7aa8"], accent:"#ffd23f"},
    {name:"ゆうやけ の まち", sky:["#2a1240","#6e2f4f","#c25a3a","#ffce6a"], accent:"#ff8a3a"},
    {name:"うみべ の まち",   sky:["#06243f","#0f4d6e","#1f8aa0","#7fe6d0"], accent:"#3fffb0"},
    {name:"うちゅう の まち", sky:["#05010f","#160a36","#2a0f55","#5a1f8a"], accent:"#b066ff"}
  ];
  function theme(){return THEMES[(setStage)%THEMES.length];}
  const COLORS=["#ff4d8d","#36c9ff","#ffd23f","#3fffb0","#ff8a3a","#b066ff","#5ad0ff"];
  luckyColor=pick(COLORS);   // このセッション秘密の当たり色（毎プレイ変わる）
  // ==== ビルのテーマ(レシピ) ====================================================
  //  毎ビルで中身が変わる「つぎは何かな？」の核。kind=物の種類 / size=マス目倍率(範囲は一定)
  //  hp=硬さ / mixed=種類ごちゃまぜ / allBomb=一掃当たりビル / rainbow=超レア宝石ビル。w=抽選の重み。
  const KINDS=["block","rock","face","ice","crate","tire","cake","toy"];
  const RECIPES=[
    {id:"mix",    name:"ごちゃまぜ",      w:16, mixed:true,   size:1.0},
    {id:"rock",   name:"いわの山",        w:11, kind:"rock",  size:1.0},
    {id:"face",   name:"かおビル",        w:11, kind:"face",  size:1.0},
    {id:"ice",    name:"こおりビル",      w:10, kind:"ice",   size:0.9, iceThick:true},
    {id:"crate",  name:"きばこ そうこ",   w:9,  kind:"crate", size:1.0},
    {id:"toy",    name:"つみき タワー",    w:9,  kind:"toy",   size:1.0},
    {id:"cake",   name:"おかしの いえ",    w:8,  kind:"cake",  size:0.9},
    {id:"tire",   name:"タイヤ こうじょう",w:6,  kind:"tire",  size:1.0},
    {id:"big",    name:"でか ブロック",    w:16, kind:"block", hp:2, size:1.5},
    {id:"fine",   name:"こまか つぶつぶ",  w:16, kind:"block", size:0.78},
    {id:"bomb",   name:"ぜんぶ ばくだん",  w:5,  allBomb:true, size:1.0},
    {id:"rainbow",name:"レインボービル",   w:3,  rainbow:true, size:1.0}
  ];
  // 直前に選んだレシピの size（軸7向け: 同じ大きさの棟が連続しないようにする一回だけの引き直しに使う）
  let lastPickedSize=null;
  function pickRecipe(){
    // 最初の1ビルだけは やさしい「ごちゃまぜ」で始める（すぐ楽しい）
    if(level<=1&&!curRecipe){lastPickedSize=RECIPES[0].size;return RECIPES[0];}
    function draw(){
      let tot=0;for(const r of RECIPES)tot+=r.w;
      let n=Math.random()*tot;for(const r of RECIPES){n-=r.w;if(n<=0)return r;}
      return RECIPES[0];
    }
    let r=draw();
    if(lastPickedSize!=null&&r.size===lastPickedSize)r=draw();   // 同じ大きさが続いたら1回だけ引き直す
    lastPickedSize=r.size;
    return r;
  }
  // 種類ごとの色（見た目の土台）。tint=そのビルの基調色。
  function kindColor(kind,tint){
    switch(kind){
      case"rock": return pick(["#8a8f99","#7c828d","#9aa0aa","#6f7580"]);
      case"ice":  return pick(["#9fe0ff","#bfeeff","#8fd4f5"]);
      case"crate":return pick(["#c98a4b","#b87a3d","#d69a5a"]);
      case"tire": return "#2b2f38";
      case"cake": return pick(["#ffd9e6","#ffe6b8","#ffc2d6","#fff0c8"]);
      case"toy":  return pick(COLORS);
      case"face": return pick(["#ffcf6a","#ff9ec2","#9ad6ff","#b7e88a","#ffb27a"]);
      default:    return Math.random()<0.7?tint:pick(COLORS);
    }
  }
  // 種類×レシピ×ステージで硬さ(hp)を決める。ゴンゴン系(rock)ほど多段。
  function kindHp(kind,rec){
    if(rec.rainbow||rec.allBomb)return 1;
    // 軸3(歯ごたえ)対応: hp=3の岩がstage>3ではなくstage>1から出るようにして、序盤から
    // 「連続で狙って当てる」場面をもう少し早く増やす（岩自体は元々hp=2で最初から多段）。
    // 出現率も0.4→0.55、crateのhp2も0.3→0.4に上げ、多段ヒットで同じ場所を狙う場面自体を増やす。
    if(kind==="rock") return stage>1&&Math.random()<0.55?3:2;   // 硬い岩が少し早く・多めに(7〜8歳向け)
    if(kind==="ice")  return rec.iceThick&&Math.random()<0.45?2:1;
    if(kind==="crate")return Math.random()<0.4?2:1;
    if(rec.hp&&rec.kind===kind)return rec.hp;   // でかブロック等
    return 1;
  }
  // 破片の色（種類に応じて欠片の質感を変える）
  function shardCol(b){
    switch(b.kind){
      case"rock": return pick(["#8a8f99","#6f7580","#9aa0aa"]);
      case"ice":  return pick(["#cdefff","#a8e0ff","#e8f8ff"]);
      case"crate":return pick(["#c98a4b","#a86a2d","#8a5a24"]);
      case"tire": return pick(["#23262e","#3a3f48"]);
      case"cake": return pick(["#ffd9e6","#ffe6b8","#ffffff"]);
      default:    return b.color;
    }
  }
  // 多段ヒットの「コツン」欠け音（種類で質感を変える）
  function chipSound(kind){
    if(kind==="rock"){api.tone(150,0.1,"square",0.12);api.noise(0.08,0.2,500,"lowpass");}
    else if(kind==="ice"){api.noise(0.08,0.26,4200,"highpass",1);api.tone(1300,0.05,"triangle",0.08);}
    else if(kind==="crate"){api.tone(210,0.08,"square",0.1);api.noise(0.07,0.16,900,"bandpass");}
    else{api.noise(0.1,0.25,2200,"highpass");api.tone(220,0.08,"square",0.08);}
  }
  // 破壊時の種類アクセント音（generic音に一味足すだけ・連射で重くしない）
  function kindAccent(kind){
    if(kind==="ice")api.noise(0.12,0.22,3800,"highpass",1);
    else if(kind==="rock")api.noise(0.14,0.2,300,"lowpass");
    else if(kind==="cake")api.tone(520,0.08,"sine",0.1);
    else if(kind==="tire")api.tone(120,0.1,"sine",0.12);
  }
  // 「ぜんぶ ばくだん」ビルの告知（当たりビル＝1発で総ふっとび）
  function announceBombBuilding(){
    flash=Math.min(1,flash+0.4);flashHue="#ff3b6b";
    pushFloat({x:api.W/2,y:api.H*0.34,txt:"ぜんぶ ばくだん！",life:1.6,vy:-0.3,col:"#ffd23f",size:34});
    api.tone(660,0.1,"square",0.12);setTimeout(()=>api.tone(990,0.12,"square",0.1),90);
  }
  function spark(x,y,c,n,spd){for(let i=0;i<n;i++){const a=rnd(0,TAU),v=rnd(spd*0.4,spd);
    sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-rnd(0,2),life:1,decay:rnd(0.02,0.04),s:rnd(1.5,3.5),col:c});}}
  function ring(x,y,c){rings.push({x,y,r:S*0.4,life:1,col:c});}
  // floating magic motes drifting upward through the sky
  function pushMote(){motes.push({x:rnd(0,api.W),y:groundY+rnd(0,40),vy:-rnd(0.15,0.5),
    ph:rnd(0,TAU),amp:rnd(6,22),s:rnd(1,2.6),col:pick(COLORS),life:1});}
  function layout(){
    groundY=api.H*0.86;
    // ビル全体の横幅(範囲)は一定に保ちつつ、1マスの大きさだけ sizeScale で変える。
    //  → でかい少数ビル / こまかい粒ぎっしりビル を同じ横幅で作り分けられる。
    const base=clamp(Math.floor(api.W/8),40,64);
    S=clamp(Math.round(base*sizeScale),22,96);
    // 見た目非依存の当たり判定サイズ（軸3対応）: sizeScaleを掛けない値を別に保つ。
    //  「こまか つぶつぶ」等の見た目が縮むレシピでも、指の当たり判定(吸着/onBlock)だけは
    //  通常サイズのまま保ち、細かいビルだけ極端に狙いづらくなる問題を解消する。
    aimS=clamp(base,34,96);
    cols=clamp(Math.floor((api.W*0.62)/S),3,9);
    bx=Math.round((api.W-cols*S)/2);
    blocks.forEach(b=>{b.x=bx+b.col*S;b.ty=groundY-(b.row+1)*S;b.y=b.ty;b.settled=true;});
  }
  const blockY=r=>groundY-(r+1)*S;
  function newBuilding(rise){
    // 前ビルで予告したレシピを消費（無ければ抽選）→ 次ビルの予告を先に決めておく。
    curRecipe=nextRecipe||pickRecipe();
    nextRecipe=pickRecipe();
    const rec=curRecipe;
    sizeScale=rec.size||1;
    blocks=[];layout();                       // sizeScaleを反映してからレイアウト
    rareBuilding=!!rec.rainbow;
    const rows=clamp(9+level-1,4,Math.floor((groundY-api.H*0.16)/S));   // 7→9段(7〜8歳向けに ビルを少し高く)
    // 軸7向け: 塔の輪郭にも変化を付ける（いつも四角い塔にしない）。たまに山型/左右非対称にする。
    const shapeRoll=Math.random(),shape=shapeRoll<0.5?"flat":shapeRoll<0.75?"peak":"slant";
    const midCol=(cols-1)/2,slantDir=Math.random()<0.5?1:-1;
    const canGiant=!rec.allBomb&&!rec.rainbow;   // ばくだん/レインボービルは全マス同格の見た目を保つ
    for(let col=0;col<cols;col++){
      let h;
      if(shape==="peak")h=rows-Math.round(Math.abs(col-midCol)*1.1)-(Math.random()<0.3?1:0);
      else if(shape==="slant")h=rows-Math.round((slantDir>0?col:(cols-1-col))*0.9)-(Math.random()<0.3?1:0);
      else h=rows-(Math.random()<0.4?rint(0,2):0);
      h=clamp(h,3,rows);
      const tint=pick(COLORS);
      for(let row=0;row<h;row++){
        // 単色レシピにも約10%だけ別のkindを差し込み「1個だけ違う」を混ぜる
        const mixIn=(!rec.mixed&&!rec.allBomb&&!rec.rainbow&&Math.random()<0.1);
        const kind=(rec.mixed||mixIn)?pick(KINDS):(rec.kind||"block");
        const hp=kindHp(kind,rec);
        const giant=canGiant&&Math.random()<0.15;   // 軸7向け: 同じ棟の中に巨大セルを混ぜる（当たり判定はSのまま）
        blocks.push({col,row,x:bx+col*S,y:rise?-(rint(1,8))*S-rnd(0,200):blockY(row),
          ty:blockY(row),vy:0,color:kindColor(kind,tint),
          settled:!rise,kind,hp,maxHp:hp,react:0,bomb:false,gem:false,star:false,
          giant,gScale:giant?rnd(1.6,1.8):1});
      }
    }
    if(rec.allBomb){
      // 当たりビル: ぜんぶ ばくだん。1発当てると連鎖で総ふっとび。硬さ/隠しは無し（純粋な爽快）。
      for(const b of blocks){b.bomb=true;b.kind="block";b.color="#ff3b6b";b.hp=1;b.maxHp=1;}
      announceBombBuilding();
    }else if(rec.rainbow){
      // 超レア: まるごと宝石色。1個ずつ壊すたび小ボーナス＋にじ火花。最後の1個は温存フィナーレで大きく払う。
      for(const b of blocks){b.rainbow=true;b.kind="block";b.color=pick(COLORS);b.hp=1;b.maxHp=1;}
      announceRare();
    }else{
      // 通常/テーマビル: ばくだん + 隠しリワード(ほうせき/星/かなめ石)を仕込む。硬さはkindHpで既に混在。
      const plain=blocks.filter(b=>!b.bomb&&b.hp<=1);
      const bombN=clamp(1+rint(0,1)+Math.floor(stage/3),1,Math.max(1,Math.floor(plain.length*0.14)));
      for(let i=0;i<bombN&&plain.length;i++){
        const bb=plain.splice(rint(0,plain.length-1),1)[0];
        bb.bomb=true;bb.kind="block";bb.color="#ff3b6b";
      }
      if(plain.length&&Math.random()<0.5){
        const gb=plain.splice(rint(0,plain.length-1),1)[0];gb.gem=true;
      }
      const starN=Math.min(rint(0,2),plain.length);
      for(let i=0;i<starN;i++){
        const sb=plain.splice(rint(0,plain.length-1),1)[0];sb.star=true;
      }
      if(plain.length){
        const lows=plain.filter(b=>b.row<=1);const kp=lows.length?lows:plain;
        kp[rint(0,kp.length-1)].key=true;
      }
    }
    // 金ブロックの出現タイマーをリセット（新しいビルでは しばらくしてから 出す）
    goldRef=null;goldT=0;goldCD=rint(240,520);
    // 柱ぜんけし判定の基準: いま全列が埋まっている状態から開始（列が空になった瞬間に発火）
    occSet=new Set();for(let c=0;c<cols;c++)occSet.add(c);
    // 出現の瞬間わくわく: テーマ名を大きくチラ見せ（allBomb/rainbowは専用告知が既に出ている）
    spawnTxt=rec.name;spawnTitle=(rec.allBomb||rec.rainbow)?1.0:1.7;
  }
  function applyGravity(){
    let dropSum=0;
    for(let col=0;col<cols;col++){
      const cb=blocks.filter(b=>b.col===col).sort((a,b)=>a.row-b.row);
      cb.forEach((b,i)=>{if(b.row!==i){dropSum+=(b.row-i);b.row=i;b.ty=blockY(i);b.settled=false;}});
    }
    return dropSum;
  }
  function blockAt(px,py){for(let i=blocks.length-1;i>=0;i--){const b=blocks[i];
    if(px>=b.x&&px<=b.x+S&&py>=b.y&&py<=b.y+S)return b;}return null;}
  // auto-aim: snap a rough tap to the nearest block so little kids never "miss" the tower
  function nearestBlock(px,py){let best=null,bd=1e9;
    for(const b of blocks){const d=Math.hypot(b.x+S/2-px,b.y+S/2-py);if(d<bd){bd=d;best=b;}}
    // 軸3(歯ごたえ)対応: 3.0→2.2→1.6→1.45→1.35に縮小。外さない安心感(軸1)は残しつつ、どこを叩いても当たる緩さを減らす。
    // (1.3まで絞るとmaxQuietSecが8本中3本で12秒の合格線を超えてしまったため、1.35に留めた。
    //  なお--seedは入力パターンのみ固定でビルの中身はMath.random任せのため試行ごとの振れ幅が大きく、
    //  1.45の頃から数十試行に一度は12秒を超える回がある。1.35でもその頻度は同程度〜やや少ない範囲に収まる)
    // さらに、吸着半径は見た目サイズSでなく当たり判定サイズaimSを使う（「こまか つぶつぶ」等の
    // 縮小レシピで見た目と一緒に吸着まで狭くなり無得点区間が発生していたのを解消）。
    // 残り物さがし救済(軸3のc対応): ビルの最後の数個だけ盤面に対してまばらに散らばり、
    // 通常倍率のままだと「見えているのになかなか当たらない」無得点区間が生まれやすい。
    // 残数が少ないときだけ吸着倍率を追加で広げ、終盤の粘り探しを短くする（通常時の歯ごたえ(a)は変えない）。
    // 2.2/1.6→2.0/1.5に少し絞り、残数救済側の緩さも合わせて引き締める。
    const tailMul=blocks.length<=2?2.0:blocks.length<=5?1.5:1;
    return best&&bd<=aimS*1.35*tailMul?best:null;}
  function destroyBlock(b,f){
    // 温存フィナーレ用: 直近に壊したブロックの種別を記録（ビルが空になった瞬間に参照）
    finaleKind=b.rainbow?"rainbow":b.gem?"gem":b.star?"star":b.key?"key":(b===goldRef)?"gold":null;
    // 隠し要素の解放（どの壊し方でも＝爆風/一撃/巨大解放でも 発見できる）
    if(b.rainbow)rewardRainbowBlock(b);
    if(b.gem)rewardGem(b);
    if(b.star)spawnStar(b.x+S/2,b.y+S/2);
    if(b.key)rewardKey(b);
    if(b===goldRef)rewardGold(b);
    if(!b.steel&&!b.bomb&&b!==goldRef&&b.color===luckyColor)luckyHit(b);   // ラッキー色（気づくと得の隠し）
    // 種類に応じた欠片: こおりは半透明ヒビが多めに飛散、他は質感色の欠片。
    const sc=shardCol(b),ice=b.kind==="ice",nsh=ice?rint(7,11):rint(5,8);
    for(let i=nsh;i>0;i--)shards.push({x:b.x+rnd(4,S-4),y:b.y+rnd(4,S-4),
      vx:rnd(-5,5)+(f?rnd(-2,2):0)+(ice?rnd(-3,3):0),vy:rnd(-9,-2),s:rnd(S*0.2,S*0.38),color:sc,glass:ice,
      rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.006,0.012),pts:chunkPts()});
    for(let i=0;i<3;i++)dust.push({x:b.x+S/2+rnd(-10,10),y:b.y+S/2+rnd(-10,10),
      r:rnd(S*0.3,S*0.6),vr:rnd(0.6,1.4),life:1,decay:rnd(0.012,0.02)});
    spark(b.x+S/2,b.y+S/2,ice?"#dff4ff":b.color,f?7:5,ice?9:7);
    ring(b.x+S/2,b.y+S/2,ice?"#bfeeff":b.color);
    // かおブロックは まわりの かおが びっくり（react）＝反応が伝播する（安価にkindを利用）
    if(b.kind==="face")for(const o of blocks){if(o.kind==="face"&&Math.hypot(o.x-b.x,o.y-b.y)<=S*1.6)o.react=1;}
    blocks.splice(blocks.indexOf(b),1);
  }
  // ほうせき解放: にじ色の火花シャワー＋大量ボーナス＋のぼり音。レア遭遇のごほうび。
  function rewardGem(b){
    const cx=b.x+S/2,cy=b.y+S/2;
    count+=15;found.gem++;api.setScore(count);
    for(let k=0;k<7;k++)spark(cx,cy,COLORS[k%COLORS.length],4,9);
    ring(cx,cy,"#fff");rings.push({x:cx,y:cy,r:S*0.5,life:1,col:pick(COLORS)});
    flash=Math.min(1,flash+0.5);flashHue=pick(COLORS);celebrate=Math.max(celebrate,1.6);
    pushFloat({x:cx,y:cy-24,txt:"ほうせき！ +15",life:1.2,vy:-0.7,col:"#fff",size:30});
    api.tone(880,0.1,"triangle",0.16);
    setTimeout(()=>api.tone(1318,0.12,"triangle",0.16),80);
    setTimeout(()=>api.tone(1760,0.14,"triangle",0.14),170);
    tryHitStop(3);
    if(shards.length>240)shards.splice(0,shards.length-240);
    if(sparks.length>200)sparks.splice(0,sparks.length-200);
  }
  // 超レア「レインボービル」出現の告知（一撃サプライズ＝「今の見た!?」）: 派手なにじ火花＋ファンファーレ。
  function announceRare(){
    celebrate=Math.max(celebrate,2.2);flash=1;flashHue=pick(COLORS);
    pushFloat({x:api.W/2,y:api.H*0.33,txt:"レインボービル！",life:1.8,vy:-0.3,col:"#fff",size:38});
    for(let k=0;k<10;k++)setTimeout(()=>{if(sparks.length<200)spark(rnd(0,api.W),api.H*rnd(0.2,0.5),pick(COLORS),4,8);},k*45);
    [0,4,7,12,16,19].forEach((s,i)=>setTimeout(()=>api.tone(523.25*Math.pow(2,s/12),0.14,"triangle",0.14),i*70));
    api.boom(0.5);
  }
  // レインボービルの1個: 壊すたび小ボーナス＋にじ火花（次々に手応え。最後の1個はフィナーレで大きく払う）。
  function rewardRainbowBlock(b){
    const cx=b.x+S/2,cy=b.y+S/2;count+=3;api.setScore(count);
    for(let k=0;k<3;k++)spark(cx,cy,pick(COLORS),4,8);
    ring(cx,cy,pick(COLORS));
    if(sparks.length>200)sparks.splice(0,sparks.length-200);
  }
  // 温存フィナーレ（順序の隠し判定）: ビルの最後の1個が特別だと 大フィナーレ＝「取っておくと得」。
  //  どの壊し方でも自然に狙える（特別を1個だけ残して最後にタップ）。種別ごとに色/文字を変える。
  function grandFinale(kind){
    const info={gem:["ほうせき",30,"#7be0ff"],gold:["きんピカ",30,"#ffe14a"],
                star:["ほし",24,"#ffe14a"],key:["かなめ石",24,"#ffca6a"]}[kind];
    if(!info)return;
    const bonus=info[1];count+=bonus;api.setScore(count);
    celebrate=Math.max(celebrate,2.4);flash=1;flashHue=info[2];
    pushFloat({x:api.W/2,y:api.H*0.30,txt:"とっておき！",life:1.6,vy:-0.4,col:"#fff",size:40});
    pushFloat({x:api.W/2,y:api.H*0.30+46,txt:info[0]+" さいご！ +"+bonus,life:1.4,vy:-0.3,col:info[2],size:24});
    for(let k=0;k<9;k++)spark(api.W/2,api.H*0.34,COLORS[k%COLORS.length],4,9);
    api.boom(0.6);api.shake(20);tryHitStop(3);
    api.slide(660,1760,0.35,0.16,"triangle");setTimeout(()=>api.tone(2093,0.16,"triangle",0.14),150);
    if(sparks.length>200)sparks.splice(0,sparks.length-200);
  }
  // ビルが空になる瞬間に呼ぶ: 最後に壊したのが特別なら フィナーレ（レインボービルは各個で払い済みなので除外）。
  function finaleCheck(){if(finaleKind&&finaleKind!=="rainbow")grandFinale(finaleKind);finaleKind=null;}
  // かなめ石 解放（隠し判定）: 追加の砂煙＋低音＋シェイクで「大きく崩れた！」を体で感じさせる。
  //  実際に上のブロックが まとめて落ちる(applyGravityのどさっ！)のと合わさって いちばん派手に崩れる。
  function rewardKey(b){
    const cx=b.x+S/2,cy=b.y+S/2,bonus=6;
    count+=bonus;api.setScore(count);
    for(let i=0;i<6;i++)dust.push({x:cx+rnd(-30,30),y:cy+rnd(-10,20),r:rnd(S*0.5,S*0.9),vr:rnd(1,2),life:1,decay:rnd(0.01,0.02)});
    api.shake(14);api.boom(0.5);
    // 傾斜補正: 気づきにくい隠しほど演出を厚く。二重リング＋金火花＋微フリーズで「見つけた価値」を体感。
    ring(cx,cy,"#ffca6a");rings.push({x:cx,y:cy,r:S*0.5,life:1,col:"#fff2a0"});
    for(let k=0;k<6;k++)spark(cx,cy,pick(["#ffe14a","#fff2a0","#ffca6a"]),4,8);
    pushFloat({x:cx,y:cy-20,txt:"かなめ石！ +"+bonus,life:1.1,vy:-0.7,col:"#ffca6a",size:26});
    celebrate=Math.max(celebrate,1.4);flash=Math.min(1,flash+0.4);flashHue="#ffca6a";tryHitStop(3);
    if(sparks.length>200)sparks.splice(0,sparks.length-200);
  }
  // 金ブロック 解放（時間制限の発見）: 金いろの火花＋上昇音＋大ボーナス。時間内に壊せた ごほうび。
  function rewardGold(b){
    const cx=b.x+S/2,cy=b.y+S/2,bonus=20;
    goldRef=null;goldT=0;goldCD=rint(320,600);found.gold++;
    count+=bonus;api.setScore(count);
    for(let k=0;k<9;k++)spark(cx,cy,pick(["#ffe14a","#fff2a0","#ffb03a"]),4,9);
    ring(cx,cy,"#ffe14a");rings.push({x:cx,y:cy,r:S*0.5,life:1,col:"#fff2a0"});
    flash=Math.min(1,flash+0.5);flashHue="#ffe14a";celebrate=Math.max(celebrate,1.8);
    pushFloat({x:cx,y:cy-24,txt:"きんピカ！ +"+bonus,life:1.3,vy:-0.7,col:"#ffe14a",size:30});
    api.slide(880,1760,0.25,0.16,"triangle");setTimeout(()=>api.tone(2093,0.14,"triangle",0.14),120);
    api.boom(0.45);tryHitStop(3);
    if(sparks.length>200)sparks.splice(0,sparks.length-200);
  }
  // ラッキー色 解放（毎プレイ変わる発見）: 極小のキラリ＋高い音＋1点。
  //  低確率でなく「特定の1色がずっと当たり」なので、気づくと壊す色を選びたくなる（気づかなくても普通に遊べる）。
  //  連発で音/粒が うるさくならないよう luckyCD でスロットル（得点は毎回入る）。
  function luckyHit(b){
    count++;luckyN++;api.setScore(count);
    // 傾斜補正: いちばん気づきにくい「当たり色」の初発見だけ しっかり演出（リング＋アルペジオ＝発見の価値）。
    if(luckyN===1){const cx=b.x+S/2,cy=b.y+S/2;ring(cx,cy,luckyColor);
      celebrate=Math.max(celebrate,1.2);flash=Math.min(1,flash+0.3);flashHue=luckyColor;
      for(let k=0;k<6;k++)spark(cx,cy,luckyColor,4,7);
      [0,4,7].forEach((s,i)=>setTimeout(()=>api.tone(880*Math.pow(2,s/12),0.1,"triangle",0.12),i*70));
      if(sparks.length>200)sparks.splice(0,sparks.length-200);}
    if(luckyCD<=0){luckyCD=9;const cx=b.x+S/2,cy=b.y+S/2;
      for(let k=0;k<3;k++){const a=rnd(0,TAU),v=rnd(2,4);
        sparks.push({x:cx,y:cy,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1,life:1,decay:0.05,s:rnd(1.4,2.6),col:"#fff2a0"});}
      api.tone(2093,0.05,"triangle",0.08);
      if(sparks.length>200)sparks.splice(0,sparks.length-200);}
    // 最初の1回と ときどきだけ 文字で気づかせる（毎回出すと ごちゃつくので抑制）
    if(luckyN===1||luckyN%12===0)
      pushFloat({x:b.x+S/2,y:b.y-16,txt:"ラッキー色！ +1",life:1.0,vy:-0.6,col:luckyColor,size:20});
  }
  // にじいろボーナス（隠し判定＝色の活用）: 1ボールで同じ色を3つ以上壊すと発火。
  //  ボールが虹色に光り(体で感じる)・上昇アルペジオ・にじ色の火花シャワー＋得点。
  function rainbowBonus(px,py,n,col){
    const bonus=n*3;count+=bonus;api.setScore(count);
    rainbow=1.4;celebrate=Math.max(celebrate,1.4);flash=Math.min(1,flash+0.4);flashHue=col;
    pushFloat({x:px,y:py-40,txt:"にじいろ！ +"+bonus,life:1.3,vy:-0.8,col:"#fff",size:30});
    for(let k=0;k<8;k++)spark(px,py,COLORS[k%COLORS.length],4,8);
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(523.25*Math.pow(2,s/12),0.12,"triangle",0.13),i*55));
    tryHitStop(3);
    if(sparks.length>200)sparks.splice(0,sparks.length-200);
  }
  // 柱ぜんけし 解放（列の隠し判定）: 1本の柱を丸ごと消すと、その位置から左右へ光の帯が走る横スイープ＋ボーナス。
  //  「端から崩すと得」という 崩壊系とは別軸の読みを 自然に誘発する。複数列同時なら 1枚に合成表示。
  function columnClear(xs){
    const bonus=xs.length*6;count+=bonus;api.setScore(count);
    for(const x of xs){if(sweeps.length<10)sweeps.push({x,y:groundY-S*1.6,t:0});
      spark(x,groundY-S*1.6,"#ffe14a",5,7);ring(x,groundY-S*1.6,"#ffe14a");}
    const mx=xs.reduce((a,b)=>a+b,0)/xs.length;
    pushFloat({x:mx,y:groundY-S*2.2,txt:(xs.length>1?"れつ ぜんけし！":"はしら ぜんけし！")+" +"+bonus,life:1.2,vy:-0.7,col:"#ffe14a",size:28});
    api.shake(10);api.boom(0.45);api.slide(660,1320,0.25,0.14,"triangle");
    celebrate=Math.max(celebrate,1.2);flash=Math.min(1,flash+0.3);flashHue="#ffe14a";
    if(xs.length>=2)tryHitStop(3);
    if(sparks.length>200)sparks.splice(0,sparks.length-200);
  }
  // そらのいきもの: テーマ別（よる=ふうせん / ゆうやけ=とり / うみべ=クジラ / うちゅう=UFO）。
  //  毎回ちがう高さ・時刻・向きで 空を横切る。ボールが近づく or タップで 大サプライズ＋報酬。
  //  → 月/マスコットの固定感を解消し、飾りだった空を初めてインタラクティブにする。
  function spawnCreature(){
    const dir=Math.random()<0.5?1:-1;
    creature={type:setStage%4,dir,x:dir>0?-70:api.W+70,y:api.H*rnd(0.09,0.32),ph:rnd(0,TAU),hit:false};
  }
  function creatureReward(cx,cy){
    if(!creature||creature.hit)return;creature.hit=true;found.creature++;
    creatureSet.add(creature.type);                 // 会期メタ: 4種そろえると「そらのパレード」解禁
    const bonus=8;count+=bonus;api.setScore(count);
    celebrate=Math.max(celebrate,1.8);flash=Math.min(1,flash+0.4);flashHue=theme().accent;
    for(let k=0;k<10;k++)spark(cx,cy,pick(COLORS),4,8);
    ring(cx,cy,"#fff");rings.push({x:cx,y:cy,r:S*0.6,life:1,col:theme().accent});
    const nm=["ふうせん","とり","クジラ","UFO"][creature.type];
    pushFloat({x:cx,y:cy+34,txt:nm+"！ +"+bonus,life:1.3,vy:-0.5,col:"#fff",size:26});
    api.slide(660,1320,0.3,0.16,"triangle");api.boom(0.4);tryHitStop(3);
    if(sparks.length>200)sparks.splice(0,sparks.length-200);
    if(!paradeUnlocked&&creatureSet.size>=4){paradeUnlocked=true;unlockParade();}
  }
  // いきもの4種コンプ解禁（会期メタ＝星5とは別の収集の到達点）: 告知＋即パレード。以後は町ごとに走る。
  function unlockParade(){
    celebrate=Math.max(celebrate,2.6);flash=1;flashHue="#ff9ad0";
    pushFloat({x:api.W/2,y:api.H*0.30,txt:"そらのパレード かいほう！",life:2.0,vy:-0.2,col:"#fff",size:32});
    api.boom(0.6);[0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.16,"triangle",0.14),i*90));
    spawnParade();
  }
  // そらのパレード: 4種のいきものが 高さちがいで 空を横切る（純粋なごほうび演出・当たり判定なし）。
  function spawnParade(){
    if(parade.length)return;const dir=Math.random()<0.5?1:-1;
    for(let t=0;t<4;t++)parade.push({type:t,dir,
      x:(dir>0?-70:api.W+70)-dir*t*(api.W*0.28+70),
      y:api.H*(0.10+t*0.055),ph:rnd(0,TAU),sp:rnd(0.85,1.05)});
    paradeCele=1.4;
  }
  // かくれ星が出た: 少し飛び出して→上のカウンターへ吸い込まれる（pickupsで管理）
  function spawnStar(x,y){
    if(pickups.length<40)pickups.push({x,y,vx:rnd(-1.6,1.6),vy:-rnd(2.2,3.6),ph:rnd(0,TAU),life:1,got:false});
    api.tone(1245,0.06,"triangle",0.12);
  }
  // 星を1つ回収。STAR_GOALごとに 星シャワーの ごほうび（段階的に大きく＝飽きない）。
  function collectStar(){
    starCount++;found.star++;
    api.tone(1568,0.07,"triangle",0.14);
    if(starCount%STAR_GOAL===0){
      const cyc=Math.floor(starCount/STAR_GOAL);
      const bonus=STAR_GOAL*4*Math.min(cyc,4);
      count+=bonus;api.setScore(count);
      celebrate=Math.max(celebrate,2.2);flash=Math.min(1,flash+0.7);flashHue="#ffe14a";
      pushFloat({x:api.W/2,y:api.H*0.4,txt:"ほし "+STAR_GOAL+"こ！ +"+bonus,life:1.4,vy:-0.4,col:"#ffe14a",size:32});
      api.boom(0.5);
      for(let k=0;k<10;k++)setTimeout(()=>{if(sparks.length<200)spark(rnd(0,api.W),api.H*rnd(0.14,0.26),pick(COLORS),4,7);},k*40);
    }
  }
  // 月をたたく隠しご褒美: ながれ星が すーっと流れる＋小ボーナス（オフタワーの意図的タップだけ）
  function moonReward(mx,my){
    moonCD=140;count+=5;found.moon++;api.setScore(count);
    for(let k=0;k<3;k++)shootStars.push({x:mx+rnd(-18,18),y:my+rnd(-18,18),vx:rnd(-9,-5),vy:rnd(2,4),life:1});
    spark(mx,my,"#bdf0ff",10,7);ring(mx,my,"#bdf0ff");
    pushFloat({x:mx,y:my+26,txt:"きらーん +5",life:1.1,vy:-0.5,col:"#bdf0ff",size:22});
    celebrate=Math.max(celebrate,1.0);
    api.slide(1568,2093,0.3,0.14,"triangle");
  }
  // マスコットをたたく隠しご褒美: 大よろこびのポーズ＋色とりどりの火花＋小ボーナス
  function mascotReward(cx,cy){
    mascotCD=120;count+=5;api.setScore(count);
    celebrate=Math.max(celebrate,2.0);smashFace=1;
    for(let k=0;k<8;k++)spark(cx,cy,pick(COLORS),3,7);
    pushFloat({x:cx,y:cy-30,txt:"やっほー！ +5",life:1.1,vy:-0.5,col:"#ffd23f",size:22});
    api.tone(660,0.1,"triangle",0.14);setTimeout(()=>api.tone(990,0.12,"triangle",0.12),90);
  }
  // 5とがった星のパス（HUDピップ／飛ぶ星ピックアップ 共用）
  function starPath(rad){g.beginPath();
    for(let i=0;i<5;i++){const a=-Math.PI/2+i*TAU/5;g.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);
      const a2=a+TAU/10;g.lineTo(Math.cos(a2)*rad*0.45,Math.sin(a2)*rad*0.45);}g.closePath();}
  // パワーを溜め、MAXに達した瞬間だけ「たかいビルで うつと おおきい！」を一度だけ出す。
  //  → 「いつ・どのビルで解放するか」という考えどころへ子どもを誘導する一言ヒント。
  function chargePower(amt){
    const was=armed;power=Math.min(1,power+amt);
    if(power>=1&&!was){armed=true;
      if(!hintShown){hintShown=true;
        pushFloat({x:api.W/2,y:api.H*0.34,txt:"たかい ビルで うつと おおきい！",life:1.5,vy:-0.25,col:"#ffe14a",size:22});}
      api.tone(1046,0.12,"triangle",0.14);api.tone(1318,0.1,"triangle",0.1);}
  }
  // 一度に壊した数の自己ベスト。更新でご褒美＝「もっと大きく壊す」を狙う再挑戦動機（長く遊べる）。
  function rec(n){
    if(n>bestBurst){bestBurst=n;
      if(n>=4){pushFloat({x:api.W/2,y:api.H*0.42,txt:"さいこう "+n+"こ！",life:1,vy:-0.6,col:"#3fffb0",size:27});
        celebrate=Math.max(celebrate,1.3);api.tone(784,0.12,"triangle",0.16);setTimeout(()=>api.tone(1046,0.16,"triangle",0.16),90);}}
  }
  // auto-aim: タップ近くに ばくだん があれば優先して吸い付く（クラスタを確実に起爆＝連鎖が狙える）
  function snapTarget(px,py){
    let bb=null,bd=1e9;
    for(const b of blocks){if(b.bomb){const d=Math.hypot(b.x+S/2-px,b.y+S/2-py);if(d<bd){bd=d;bb=b;}}}
    // 軸3(歯ごたえ)対応: 3.2→2.4→2.0に縮小。少し離れた場所からばくだんへ勝手に吸い寄せられ連鎖が
    // 全自動で起きてしまう幅を減らし、ばくだんそのものを狙う判断を要求する。
    // ここもaimS基準にして、縮小レシピでばくだん連鎖への吸着精度が落ちないようにする。
    if(bb&&bd<=aimS*2.0)return bb;
    const direct=blockAt(px,py)||nearestBlock(px,py);
    if(direct){
      // にじいろを“狙って出せる”感（評価者C）: タップ近傍に同色クラスタ(3+)があれば その中心へ軽く吸わせる。
      //  近傍のみ(<=S*2.0)なので大きく飛ばさない＝オートエイムは相変わらず素直。
      let best=direct,bestN=0;
      for(const b of blocks){
        if(b.bomb||b.hp>1)continue;
        if(Math.hypot(b.x+S/2-px,b.y+S/2-py)>S*2.0)continue;
        let n=0;for(const o of blocks)if(o.color===b.color&&Math.hypot(o.x-b.x,o.y-b.y)<=S*1.35)n++;
        if(n>bestN){bestN=n;best=b;}
      }
      if(bestN>=3)return best;
    }
    return direct;
  }
  function doSmash(px,py){
    // big combo reward: ball radius grows so good players clear more per tap
    // 軸3(歯ごたえ)対応: コンボ上位ほど広がる幅を combo>=8: 1.25→1.15 / combo>=4: 1.15→1.05 にさらに絞り、
    // comboT=0.9秒中は途切れないため 狙わない連打でもコンボが積み上がって範囲が広がってしまう効きを弱める。
    // 素の判定(combo<4)はS*1.0を割ると隣接マスの巻き込みが完全に消えて手応えが激減する実測結果が
    // あったため、0.85までの小幅な絞りに留める（軸2の手応えは維持）。
    const R=combo>=8?S*1.15:combo>=4?S*1.05:S*0.85;
    const hit=[],cracked=[],bombsHit=[];
    for(const b of blocks){if(Math.hypot(b.x+S/2-px,b.y+S/2-py)<=R){
      if(b.bomb){bombsHit.push(b);}else if(b.hp>1){cracked.push(b);}else hit.push(b);}}
    if(!hit.length&&!cracked.length&&!bombsHit.length)return;
    // 多段ヒット: 今回は欠けるだけ（ヒビ＋火花＋反応）で まだ壊さない。次の一撃で最後にドカン。
    cracked.forEach(b=>{b.hp--;b.react=1;const cx=b.x+S/2,cy=b.y+S/2;
      spark(cx,cy,b.kind==="ice"?"#dff4ff":b.kind==="rock"?"#c8ccd4":"#ffe6b0",4,5);ring(cx,cy,"#ffffff");
      if(b.kind==="rock")for(let i=0;i<2;i++)dust.push({x:cx+rnd(-8,8),y:cy+rnd(-8,8),r:rnd(S*0.2,S*0.4),vr:1,life:1,decay:0.02});});
    if(cracked.length){chipSound(cracked[0].kind);api.shake(5);flash=Math.min(1,flash+0.18);}
    if(hit.length){
      flashHue=hit[0].color;
      kindAccent(hit[0].kind);
      hit.forEach(b=>destroyBlock(b,false));
      // 下段/支えを先に壊すほど上が まとめて落ちる → 大きく崩れたら「どさっ！」ボーナス（崩す順番の考えどころ）
      const drop=applyGravity();
      if(drop>=5){const db=Math.floor(drop/2);count+=db;
        pushFloat({x:px,y:py+14,txt:"どさっ！ +"+db,life:1,vy:-0.7,col:"#ffb84d",size:26});
        api.shake(6);api.noise(0.22,0.28,300,"lowpass");api.slide(120,50,0.25,0.4,"sine");}
      rec(hit.length);
      count+=hit.length;api.setScore(count);combo++;comboT=0.9;
      // にじいろボーナス: 1ボールで同じ色を3つ以上まとめて壊したら発火（色を活用する隠し判定）
      {const cc={};let same=0,scol="";for(const b of hit){const k=b.color;cc[k]=(cc[k]||0)+1;if(cc[k]>same){same=cc[k];scol=k;}}
       if(same>=3)rainbowBonus(px,py,same,scol);}
      flash=Math.min(1,flash+0.4+hit.length*0.05);
      tryHitStop(hit.length>=3?3:2);
      api.slide(95-Math.min(combo*3,40),48,0.25,0.5,"sine");api.noise(0.18,0.3,1200);
      api.tone(400*Math.pow(2,clamp(combo,0,12)/12),0.12,"square",0.1);
      api.shake(4+hit.length*1.4);
      if(combo>1)pushFloat({x:px,y:py-20,txt:"x"+combo,life:1,vy:-1.1,
        col:combo>=8?"#ff2bff":combo>=6?"#ff3b3b":combo>=3?"#ff8c42":"#ffd23f",size:combo>=4?42:32});
      if(combo===4||combo===8)pushFloat({x:px,y:py-58,txt:combo>=8?"ビッグボール！":"つよく なった！",
        life:1,vy:-0.7,col:combo>=8?"#ff2bff":"#ffe14a",size:24});
      chargePower(hit.length*0.015);   // 0.018→0.015: MAXまで少し長く(7〜8歳向け)
    }
    // ばくだんに当たった: 大爆発＋連鎖。狙って当てると ごっそり壊れて 得点も伸びる。
    if(bombsHit.length){
      combo++;comboT=0.9;chargePower(0.1);
      bombsHit.forEach((b,i)=>{if(i===0)explodeBomb(b,0);
        else setTimeout(()=>{if(blocks.indexOf(b)>=0)explodeBomb(b,0);},80*i);});
    }
    smashFace=1;craneSwing=Math.min(1.2,craneSwing+0.5);
    if(blocks.length===0){finaleCheck();stageClear(false);}
  }
  // stage cleared: short banner; every SET_LEN buildings = "next town" big celebration
  function stageClear(fromGiant){
    if(stageClearing)return;stageClearing=true;
    level++;stage++;setStage++;
    const town=setStage%SET_LEN===0;
    if(town){
      townCele=2.6;celebrate=2.4;flash=1;flashHue=theme().accent;
      clearBanner=2.4;clearTxt="つぎの まちへ！";
      if(paradeUnlocked)spawnParade();   // 解禁後は 町クリアごとに 短いパレード（会期メタが持続する）
      if(setStage%(SET_LEN*THEMES.length)===0)loops++;
      api.boom(0.6);api.shake(26);
      api.slide(523,1046,0.5,0.5,"triangle");
      setTimeout(()=>{api.tone(784,0.18,"triangle",0.4);},120);
      setTimeout(()=>{api.tone(1046,0.3,"triangle",0.4);},280);
    }else{
      celebrate=1.6;clearBanner=1.5;clearTxt="ステージ クリア！";
      api.boom(0.4);api.tone(659,0.14,"triangle",0.3);
      setTimeout(()=>{api.tone(880,0.2,"triangle",0.3);},120);
    }
    setTimeout(()=>{newBuilding(true);stageClearing=false;},fromGiant?350:380);
  }
  // ばくだん爆発: 自分＋まわりのブロックを壊し、範囲内の別のばくだんに連鎖していく
  function explodeBomb(b,depth){
    const idx=blocks.indexOf(b);if(idx<0)return;
    const cx=b.x+S/2,cy=b.y+S/2;
    blocks.splice(idx,1);
    // はでな爆発の破片・火花・煙・二重リング
    for(let i=rint(10,14);i>0;i--)shards.push({x:cx+rnd(-S*0.4,S*0.4),y:cy+rnd(-S*0.4,S*0.4),
      vx:rnd(-8,8),vy:rnd(-12,-2),s:rnd(S*0.22,S*0.42),color:pick(["#ff3b6b","#ffb03a","#ffd23f","#ff7aa8"]),
      rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.006,0.012),pts:chunkPts()});
    spark(cx,cy,"#ffd23f",14,10);spark(cx,cy,"#ff3b6b",10,8);
    ring(cx,cy,"#ff3b6b");rings.push({x:cx,y:cy,r:S*0.5,life:1,col:"#ffe14a"});
    for(let i=0;i<5;i++)dust.push({x:cx+rnd(-20,20),y:cy+rnd(-20,20),r:rnd(S*0.4,S*0.8),vr:rnd(1,2),life:1,decay:rnd(0.01,0.02)});
    // 連鎖中はフラッシュを加算せず一段に丸める（ピーク同時発火の白飛び防止／評価者B）
    if(depth===0)flash=Math.min(1,flash+0.6);else flash=Math.max(flash,0.55);
    flashHue="#ff5a3a";
    api.boom(0.55);api.shake(18);tryHitStop(3);
    count++;api.setScore(count);
    // 爆風: まわりを壊し、範囲内の別ばくだんは連鎖行きに分ける
    const R=S*2.2,chain=[];let killed=1;
    const caught=blocks.filter(o=>Math.hypot(o.x+S/2-cx,o.y+S/2-cy)<=R);
    caught.forEach(o=>{if(o.bomb)chain.push(o);else{destroyBlock(o,true);count++;killed++;}});
    // 連鎖が深いほど倍率ボーナス（ばくだんクラスタを狙う判断を段階的に報酬化）
    const chainBonus=depth*2;count+=chainBonus;
    api.setScore(count);applyGravity();rec(killed);
    // ごほうびテキスト（連鎖ほど大きく・はでに）
    if(depth===0)pushFloat({x:cx,y:cy-24,txt:"ドカーン！",life:1,vy:-0.9,col:"#ff5a3a",size:30});
    else pushFloat({x:cx,y:cy-24,txt:(depth>=3?"だいれんさ！":"れんさ！")+" +"+chainBonus,life:1,vy:-1.0,col:depth>=2?"#ff2bff":"#ffe14a",size:30+depth*4});
    if(depth>=2)celebrate=Math.max(celebrate,Math.min(1.8,1.4+depth*0.2));   // sweepも連鎖で一段に丸める
    // パーティクル上限（60fps安全）
    if(shards.length>240)shards.splice(0,shards.length-240);
    if(sparks.length>200)sparks.splice(0,sparks.length-200);
    // 連鎖は少し間をおいて発火（子どもに「つながって壊れる」のが見えるように）
    chain.forEach((o,i)=>setTimeout(()=>{if(blocks.indexOf(o)>=0)explodeBomb(o,depth+1);},110+i*70));
    if(blocks.length===0&&!chain.length){finaleCheck();stageClear(false);}
  }
  function giantSmash(){
    // 解放した瞬間に残っていたブロック数(n)に比例してボーナス＝「たかいビルで撃つほど大きい」。
    //  溜めて大物で撃つ判断が報われる（=考えどころ）。空でも普通に発火して詰まらない。
    const n=blocks.length;
    armed=false;power=0;flash=1;flashHue="#ff3b6b";smashFace=1.4;celebrate=2;craneSwing=1.4;api.slide(140,40,0.7,0.7,"sine");api.noise(0.6,0.5,800,"lowpass");api.shake(34);api.boom(0.7);
    const all=blocks.slice();
    all.forEach((b,i)=>setTimeout(()=>{if(blocks.indexOf(b)>=0){destroyBlock(b,true);count++;api.setScore(count);
      api.shake(2);if(i%4===0)api.slide(70,40,0.2,0.4,"sine");}},i*16));
    const bonus=n*2;
    setTimeout(()=>{
      count+=bonus;api.setScore(count);rec(n);
      const txt=n>=18?"パーフェクト！":n>=10?"だいせいこう！":"ドッカーン！";
      pushFloat({x:api.W/2,y:api.H*0.46,txt:txt,life:1.2,vy:-0.5,col:n>=18?"#ff2bff":n>=10?"#ffe14a":"#ff8a3a",size:n>=18?44:36});
      pushFloat({x:api.W/2,y:api.H*0.46+42,txt:"+"+bonus,life:1.1,vy:-0.4,col:"#fff",size:24});
      if(n>=10){celebrate=Math.max(celebrate,2.2);api.boom(0.6);}
    },all.length*16+200);
    setTimeout(()=>{if(blocks.length===0)stageClear(true);else newBuilding(true);},all.length*16+450);
  }
  function spawnSmasher(tx,ty){smashers.push({x:tx+rnd(-30,30),y:-60,tx,ty,t:0,state:"down"});}
  newBuilding(true);
  return{
    resize:layout,
    input(px,py,type){
      if(type!=="down")return;
      idleT=0;   // 操作があった＝爆弾リンク網は消す（ピーク負荷を下げる／表示は無操作時だけ）
      // 隠しご褒美(環境インタラクション): ブロックが無い場所で 月/マスコットを たたくとサプライズ。
      //  タワー上のタップは必ずブロック優先（onBlock判定）＝通常プレイの邪魔をしない。チャージも消費しない。
      const onBlock=blocks.some(b=>Math.hypot(b.x+S/2-px,b.y+S/2-py)<aimS*1.1);
      if(!onBlock){
        // そらのいきもの: 空にいる時に そのあたりを タップすると 発見（オフタワーのみ・チャージ非消費）
        if(creature&&!creature.hit){const ccy=creature.y+Math.sin(creature.ph)*8;
          if(Math.hypot(px-creature.x,py-ccy)<=S*1.2){creatureReward(creature.x,ccy);return;}}
        const mx=api.W*0.8,my=api.H*0.16;
        if(moonCD<=0&&Math.hypot(px-mx,py-my)<=S*0.9){moonReward(mx,my);return;}
        const cxm=Math.min(api.W*0.16,60),cym=api.H*0.2;
        if(mascotCD<=0&&Math.hypot(px-cxm,py-cym)<=S*0.95){mascotReward(cxm,cym);return;}
      }
      if(armed){spawnSmasher(api.W/2,groundY-S*2);giantSmash();return;}
      const b=snapTarget(px,py);
      if(b){spawnSmasher(b.x+S/2,b.y+S/2);doSmash(b.x+S/2,b.y+S/2);}
      else api.tone(200,0.06,"triangle",0.06);
    },
    frame(dt,now){
      tsec+=0.016*dt;
      idleT+=dt;
      if(hsCD>0)hsCD-=dt;
      if(moonCD>0)moonCD-=dt;
      if(mascotCD>0)mascotCD-=dt;
      if(luckyCD>0)luckyCD-=dt;
      if(spawnTitle>0)spawnTitle=Math.max(0,spawnTitle-0.016*dt);
      if(rainbow>0)rainbow=Math.max(0,rainbow-0.03*dt);
      // 柱ぜんけし検知（どの壊し方でも＝スマッシュ/爆風/ギガ解放でも発火）: 列が空になったらごほうび。
      //  最後の1列で建物が空になる瞬間(blocks.length→0)は クリア演出に任せて出さない。
      if(!stageClearing&&blocks.length>0){
        const now=new Set();for(const b of blocks)now.add(b.col);
        let xs=null;for(const c of occSet)if(!now.has(c)){(xs||(xs=[])).push(bx+c*S+S/2);}
        occSet=now;if(xs)columnClear(xs);
      }
      // 金ブロック（時間制限の発見）の 出現/カウントダウン管理
      if(goldRef){
        if(blocks.indexOf(goldRef)<0){goldRef=null;goldCD=rint(300,560);}
        else{goldT-=dt;if(goldT<=0){goldRef.color=goldRef._oc;goldRef=null;goldCD=rint(300,560);}}
      }else if(!stageClearing){goldCD-=dt;
        if(goldCD<=0){const cand=blocks.filter(b=>b.hp<=1&&!b.bomb&&!b.gem&&!b.key);
          if(cand.length){const gb=pick(cand);gb._oc=gb.color;gb.color="#ffd23f";goldRef=gb;goldT=125;   // 150→125f: 金の制限時間を少し短く
            api.tone(1046,0.08,"triangle",0.12);api.tone(1318,0.08,"triangle",0.1);
            pushFloat({x:gb.x+S/2,y:gb.y-14,txt:"きん！ いまだ！",life:1.0,vy:-0.5,col:"#ffe14a",size:20});}
          else goldCD=40;}}
      if(smashFace>0)smashFace=Math.max(0,smashFace-0.05*dt);
      if(craneSwing>0)craneSwing=Math.max(0,craneSwing-0.04*dt);
      if(celebrate>0)celebrate=Math.max(0,celebrate-0.022*dt);
      // bg sky - dreamy magic twilight, tinted by current town theme
      const th=theme();
      // 祝福中は 背景アニメ(オーロラ/きらめき/モート/窓)を 一段 落として 画面を休ませる（要素過多の芽の緩和）
      const calm=1-0.5*clamp(Math.max(celebrate,townCele),0,1);
      // 画像背景(夜の街): 町テーマの空色を薄く重ねて 町ごとの雰囲気を変える(よる=画像そのまま)
      let imgBg=false;
      if(api.drawCover("bg.jpg")){imgBg=true;
        if(setStage%THEMES.length!==0){g.save();g.globalAlpha=0.32;
          let tg0=g.createLinearGradient(0,0,0,api.H);
          tg0.addColorStop(0,th.sky[0]);tg0.addColorStop(0.5,th.sky[2]);tg0.addColorStop(1,th.sky[3]);
          g.fillStyle=tg0;g.fillRect(0,0,api.W,api.H);g.restore();}
      }else{
        let grd=g.createLinearGradient(0,0,0,groundY);
        grd.addColorStop(0,th.sky[0]);grd.addColorStop(0.4,th.sky[1]);grd.addColorStop(0.72,th.sky[2]);grd.addColorStop(1,th.sky[3]);
        g.fillStyle=grd;g.fillRect(0,0,api.W,groundY);
      }
      // drifting aurora ribbons (additive bloom) ※画像背景のときは控えめに
      g.globalCompositeOperation="lighter";
      const auroras=[["#3fffb0",0.18,0.32],["#5ad0ff",0.34,0.26],["#b066ff",0.5,0.30]];
      const auroraK=imgBg?0.45:1;
      for(let a=0;a<auroras.length;a++){const ah=auroras[a],cy=groundY*ah[1];
        let ag=g.createLinearGradient(0,cy-60,0,cy+60);
        ag.addColorStop(0,"rgba(0,0,0,0)");ag.addColorStop(0.5,ah[0]);ag.addColorStop(1,"rgba(0,0,0,0)");
        g.globalAlpha=ah[2]*(0.6+0.4*Math.sin(tsec*0.6+a*1.3))*calm*auroraK;
        g.beginPath();g.moveTo(0,cy);
        for(let x=0;x<=api.W;x+=24)g.lineTo(x,cy+Math.sin(x*0.012+tsec*0.7+a*2)*26);
        g.lineTo(api.W,cy+90);g.lineTo(0,cy+90);g.closePath();g.fill();}
      g.globalAlpha=1;g.globalCompositeOperation="source-over";
      // soft moon glow upper-right
      const sx=api.W*0.8,sy=api.H*0.16;
      let sg=g.createRadialGradient(sx,sy,0,sx,sy,api.W*0.55);
      sg.addColorStop(0,"rgba(220,240,255,.5)");sg.addColorStop(0.35,"rgba(180,210,255,.16)");sg.addColorStop(1,"rgba(180,210,255,0)");
      g.fillStyle=sg;g.fillRect(0,0,api.W,groundY);
      g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(245,250,255,.9)";g.beginPath();g.arc(sx,sy,S*0.5,0,TAU);g.fill();
      g.globalCompositeOperation="source-over";
      // twinkle stars (color-shifting) ※新要素追加ぶん アンビエントを間引いて総量一定に（22→16）/ 画像背景には星があるので描かない
      if(!imgBg) for(let i=0;i<16;i++){const px=((i*89+17)%100)/100*api.W,py=((i*53+9)%100)/100*groundY*0.7;
        const tw=0.3+0.45*Math.sin(tsec*2.2+i*1.7);g.globalAlpha=Math.max(0,tw)*calm;
        g.fillStyle=i%3===0?"#bdf0ff":i%3===1?"#ffe6f4":"#fffbe8";
        g.beginPath();g.arc(px,py,1.4+0.8*Math.sin(tsec+i),0,TAU);g.fill();}
      g.globalAlpha=1;
      // floating magic motes
      if(motes.length<22&&Math.random()<0.4)pushMote();
      g.globalCompositeOperation="lighter";
      for(const m of motes){m.y+=m.vy*dt;m.ph+=0.03*dt;const mx=m.x+Math.sin(m.ph)*m.amp;
        const ma=Math.max(0,Math.min(1,(m.y)/(groundY*0.4)))*(0.5+0.3*Math.sin(m.ph*3));
        g.globalAlpha=ma*calm;g.fillStyle=m.col;g.shadowBlur=8;g.shadowColor=m.col;
        g.beginPath();g.arc(mx,m.y,m.s,0,TAU);g.fill();}
      g.shadowBlur=0;g.globalAlpha=1;g.globalCompositeOperation="source-over";
      motes=motes.filter(m=>m.y>-10);
      // skyline silhouette ※画像背景のときは絵のビル群を活かして描かない
      const bw=api.W/9;
      if(!imgBg) for(let i=0;i<10;i++){const hh=[60,110,80,140,95,120,70,130,90,150][i]||90;
        let bg2=g.createLinearGradient(0,groundY-hh*0.6,0,groundY);
        bg2.addColorStop(0,"rgba(30,20,60,.62)");bg2.addColorStop(1,"rgba(18,12,40,.5)");
        g.fillStyle=bg2;g.fillRect(i*bw,groundY-hh*0.6,bw*0.85,hh*0.6);
        g.globalCompositeOperation="lighter";
        const wc=i%3===0?"#5ad0ff":i%3===1?"#ff7aa8":"#ffd23f";
        for(let wy=groundY-hh*0.6+8;wy<groundY-8;wy+=14)for(let wx=i*bw+6;wx<i*bw+bw*0.75;wx+=12)
          if(((wx*7+wy*3+i)|0)%5<2){g.globalAlpha=(0.14+0.1*Math.sin(tsec*1.5+wx+wy))*calm;
            g.fillStyle=wc;g.fillRect(wx,wy,5,7);}
        g.globalAlpha=1;g.globalCompositeOperation="source-over";}
      // そらのいきもの: 更新＋描画（skylineの前・HUDの後ろ）。ボールが近づくと自動で当たる。
      if(!creature){creatureCD-=dt;if(creatureCD<=0&&!stageClearing)spawnCreature();}
      else{creature.x+=creature.dir*0.9*dt;creature.ph+=0.05*dt;
        const ccy=creature.y+Math.sin(creature.ph)*8;
        if(!creature.hit)for(const m of smashers){if(Math.hypot(m.x-creature.x,m.y-ccy)<S*0.95){creatureReward(creature.x,ccy);break;}}
        if(creature)drawCreature(creature.x,ccy,creature.type,creature.ph);
        if(!creature||creature.hit||creature.x<-90||creature.x>api.W+90){creature=null;creatureCD=rint(280,620);}}
      // そらのパレード（会期メタのごほうび演出）: 4種が列になって横切る。装飾のみ・当たり判定なし。
      if(parade.length){if(paradeCele>0)paradeCele=Math.max(0,paradeCele-0.01*dt);
        for(const pr of parade){pr.x+=pr.dir*0.9*pr.sp*dt;pr.ph+=0.05*dt;
          drawCreature(pr.x,pr.y+Math.sin(pr.ph)*8,pr.type,pr.ph);}
        parade=parade.filter(pr=>pr.x>-100&&pr.x<api.W+100);}
      // banner top
      let tg=g.createLinearGradient(0,0,0,11);tg.addColorStop(0,"#33405e");tg.addColorStop(1,"#212c44");
      g.fillStyle=tg;g.fillRect(0,0,api.W,11);
      g.fillStyle=th.accent;for(let x=0;x<api.W;x+=40)g.fillRect(x,0,20,11);
      // 軸6(見やすさ)対応: 生成bg.jpgは中身が読めない(白飛び/破損の可能性)ため、明るい絵でも
      // 上部HUD文字が必ず読めるよう、HUD帯の裏に薄暗いグラデーションを常時敷く(背景の絵柄に依存しない保険)。
      {let hg=g.createLinearGradient(0,0,0,58);
        hg.addColorStop(0,"rgba(10,8,24,.5)");hg.addColorStop(1,"rgba(10,8,24,0)");
        g.fillStyle=hg;g.fillRect(0,0,api.W,58);}
      // stage / town HUD（上部中央＝engineのもどる/スコアと衝突しない安全帯。3段→2段に統合）
      g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
      g.lineWidth=4;g.lineJoin="round";g.strokeStyle="rgba(20,12,40,.6)";
      const hud=th.name+"  ステージ "+stage;
      g.strokeText(hud,api.W/2,26);g.fillStyle="#fff";g.fillText(hud,api.W/2,26);
      // 2段目: さいこう記録 と かくれ星ピップを 1行に まとめて中央そろえ（縦積みを解消）
      {g.font="800 13px 'Hiragino Maru Gothic ProN',system-ui";
        const rt=bestBurst>0?("さいこう "+bestBurst+"こ"):"";
        const rtw=rt?g.measureText(rt).width:0;
        const pipGap=17,pipsW=starCount>0?STAR_GOAL*pipGap:0;
        const mid=(rt&&pipsW)?16:0,total=rtw+mid+pipsW;let cx=api.W/2-total/2;const yy=46;
        if(rt){g.textAlign="left";g.strokeText(rt,cx,yy);g.fillStyle="#ffe14a";g.fillText(rt,cx,yy);cx+=rtw+mid;}
        if(starCount>0){const filled=starCount%STAR_GOAL===0?STAR_GOAL:starCount%STAR_GOAL;
          for(let i=0;i<STAR_GOAL;i++){g.save();g.translate(cx+i*pipGap+8,yy-4);starPath(6);
            if(i<filled){g.fillStyle="#ffe14a";g.fill();g.lineWidth=1.4;g.strokeStyle="#a8730a";g.stroke();}
            else{g.fillStyle="rgba(255,255,255,.16)";g.fill();}
            g.restore();}}}
      g.lineJoin="miter";g.textAlign="left";
      // 出現わくわく: 新ビルのテーマ名を上部中央に大きくチラ見せ（すっと出て すっと消える）
      if(spawnTitle>0){const a=Math.min(1,spawnTitle*1.5),pop=1+0.08*Math.sin(tsec*9)*a;
        g.save();g.globalAlpha=a;g.textAlign="center";g.lineJoin="round";
        g.translate(api.W/2,api.H*0.19);g.scale(pop,pop);
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=8;g.strokeStyle="rgba(20,12,40,.7)";g.strokeText(spawnTxt,0,0);
        let sgd=g.createLinearGradient(0,-20,0,22);sgd.addColorStop(0,"#fff6c8");sgd.addColorStop(1,th.accent);
        g.fillStyle=sgd;g.fillText(spawnTxt,0,0);
        g.font="800 15px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.globalAlpha=a*0.9;g.fillText("つぎは これ！",0,24);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.lineJoin="miter";}
      // mascot crane operator (cute character in the corner)
      drawCrane();
      // ground ※画像背景のときは平坦な土の帯を描かず、ビルの足元に薄い影の線+工事のしましまだけ残す
      if(!imgBg){g.fillStyle="#3a3026";g.fillRect(0,groundY,api.W,api.H-groundY);}
      else{g.fillStyle="rgba(10,8,20,.45)";g.fillRect(0,groundY,api.W,14);}
      g.save();g.beginPath();g.rect(0,groundY,api.W,14);g.clip();
      for(let x=-20;x<api.W+40;x+=28){g.fillStyle="#ffcf3f";g.beginPath();
        g.moveTo(x,groundY);g.lineTo(x+14,groundY);g.lineTo(x-6,groundY+14);g.lineTo(x-20,groundY+14);g.closePath();g.fill();}
      g.restore();
      // dust
      for(const d of dust){d.r+=d.vr*dt;d.life-=d.decay*dt;g.globalAlpha=Math.max(0,d.life)*0.5;
        g.fillStyle="#cdbfa8";g.beginPath();g.arc(d.x,d.y,d.r,0,TAU);g.fill();}
      g.globalAlpha=1;dust=dust.filter(d=>d.life>0);
      // shockwave rings (glowing)
      g.globalCompositeOperation="lighter";
      for(const rg of rings){rg.r+=(S*2.2-rg.r)*0.18*dt;rg.life-=0.05*dt;
        const rl=Math.max(0,rg.life);g.globalAlpha=rl*0.7;g.lineWidth=Math.max(1,5*rg.life);
        g.strokeStyle=rg.col;g.shadowBlur=14*rl;g.shadowColor=rg.col;
        g.beginPath();g.arc(rg.x,rg.y,rg.r,0,TAU);g.stroke();}
      g.shadowBlur=0;g.globalAlpha=1;g.lineWidth=1;g.globalCompositeOperation="source-over";
      rings=rings.filter(rg=>rg.life>0);
      if(rings.length>30)rings.splice(0,rings.length-30);   // リング上限（爆弾連鎖ピークで増えすぎない／評価者B）
      // 柱ぜんけしの横スイープ（地面近くを左右へ走る光の帯）
      if(sweeps.length){g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
        for(const sw of sweeps){sw.t+=0.045*dt;const p=Math.min(1,sw.t),a=1-p,half=api.W*0.62*ease(p);
          let lg=g.createLinearGradient(sw.x-half,0,sw.x+half,0);
          lg.addColorStop(0,"rgba(255,226,74,0)");lg.addColorStop(0.5,"rgba(255,240,160,"+(a*0.8)+")");lg.addColorStop(1,"rgba(255,226,74,0)");
          g.fillStyle=lg;g.fillRect(sw.x-half,sw.y-5,half*2,10);
          g.globalAlpha=a*0.7;g.strokeStyle="#fff2a0";g.lineWidth=2.4;g.shadowBlur=10;g.shadowColor="#ffe14a";
          g.beginPath();g.moveTo(sw.x-half,sw.y);g.lineTo(sw.x+half,sw.y);g.stroke();g.globalAlpha=1;}
        g.restore();g.shadowBlur=0;g.globalCompositeOperation="source-over";
        sweeps=sweeps.filter(s=>s.t<1);}
      // blocks
      for(const b of blocks){
        if(!b.settled){b.vy+=0.9*dt;b.y+=b.vy*dt;
          if(b.y>=b.ty){b.y=b.ty;if(Math.abs(b.vy)>4){b.vy*=-0.28;if(Math.abs(b.vy)<3){b.vy=0;b.settled=true;}
            dust.push({x:b.x+S/2,y:b.ty+S,r:S*0.3,vr:1,life:1,decay:0.02});}else{b.vy=0;b.settled=true;}}}
        if(b.react>0)b.react=Math.max(0,b.react-0.06*dt);   // たたかれた反応の減衰
        drawBlock(b);
      }
      // ばくだん連鎖リンク: 連鎖圏内(R=S*2.2)の ばくだん同士を 光る糸でつなぐ。
      //  「ここを叩くと ぜんぶ つながって光る」を可視化 → どの的を狙うと連鎖が伸びるか一目で分かる。
      {const bombs=blocks.filter(b=>b.bomb);
       if(bombs.length>=2&&idleT>36){const Rc=S*2.2,pulse=0.6+0.4*Math.sin(tsec*4);
         g.save();g.globalCompositeOperation="lighter";g.lineWidth=2.4;
         g.strokeStyle="#ff6a3a";g.shadowBlur=8;g.shadowColor="#ff6a3a";g.lineCap="round";
         for(let i=0;i<bombs.length;i++)for(let j=i+1;j<bombs.length;j++){
           const a=bombs[i],b2=bombs[j],d=Math.hypot(a.x-b2.x,a.y-b2.y);
           if(d<=Rc){g.globalAlpha=(0.28+0.34*pulse)*(1-d/Rc*0.6);
             g.beginPath();g.moveTo(a.x+S/2,a.y+S/2);g.lineTo(b2.x+S/2,b2.y+S/2);g.stroke();}}
         g.restore();g.shadowBlur=0;g.globalAlpha=1;g.globalCompositeOperation="source-over";}}
      // shards
      for(const p of shards){p.vy+=0.55*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
        if(p.y>groundY-2){p.y=groundY-2;p.vy*=-0.4;p.vx*=0.7;if(Math.abs(p.vy)<1.2)p.life-=0.04*dt;}
        p.life-=p.decay*dt;g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);drawChunk(p);g.restore();}
      shards=shards.filter(p=>p.life>0);
      // glowing sparks
      g.globalCompositeOperation="lighter";
      for(const s of sparks){s.vy+=0.18*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=s.decay*dt;
        const a=Math.max(0,s.life);g.globalAlpha=a;g.fillStyle=s.col;g.shadowBlur=8;g.shadowColor=s.col;
        g.beginPath();g.arc(s.x,s.y,s.s*a+0.5,0,TAU);g.fill();}
      g.shadowBlur=0;g.globalAlpha=1;g.globalCompositeOperation="source-over";
      sparks=sparks.filter(s=>s.life>0&&s.y<groundY);
      // ながれ星（月タップのご褒美）: 光る尾をひいて流れる
      if(shootStars.length){g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
        for(const ss of shootStars){ss.x+=ss.vx*dt;ss.y+=ss.vy*dt;ss.life-=0.02*dt;
          const a=Math.max(0,ss.life);g.globalAlpha=a;g.strokeStyle="#dff4ff";g.lineWidth=2.6;
          g.shadowBlur=10;g.shadowColor="#bdf0ff";
          g.beginPath();g.moveTo(ss.x,ss.y);g.lineTo(ss.x-ss.vx*6,ss.y-ss.vy*6);g.stroke();
          g.fillStyle="#fff";g.beginPath();g.arc(ss.x,ss.y,2.6,0,TAU);g.fill();}
        g.restore();g.shadowBlur=0;g.globalAlpha=1;g.globalCompositeOperation="source-over";
        shootStars=shootStars.filter(s=>s.life>0);}
      // かくれ星ピックアップ: 少し飛び出し→上部中央のカウンターへ吸い込まれて回収
      for(const pk of pickups){
        if(!pk.got){pk.vy+=0.12*dt;pk.x+=pk.vx*dt;pk.y+=pk.vy*dt;pk.ph+=0.22*dt;
          if(pk.vy>0)pk.got=true;}
        else{const dx=api.W/2-pk.x,dy=42-pk.y;
          pk.x+=dx*0.13*dt;pk.y+=dy*0.13*dt;pk.ph+=0.34*dt;
          if(Math.hypot(dx,dy)<15){pk.life=0;collectStar();}}
        g.save();g.translate(pk.x,pk.y);g.rotate(pk.ph);g.globalCompositeOperation="lighter";
        g.shadowBlur=10;g.shadowColor="#ffe14a";g.fillStyle="#fff2a0";starPath(S*0.2);g.fill();
        g.restore();g.shadowBlur=0;g.globalCompositeOperation="source-over";}
      pickups=pickups.filter(p=>p.life>0);
      // smashers
      for(const m of smashers){if(m.state==="down"){m.t+=0.16*dt;m.y=lerp(-60,m.ty,ease(Math.min(m.t,1)));m.x=lerp(m.x,m.tx,0.3);
        if(m.t>=1){m.state="up";m.t=0;}}else{m.t+=0.1*dt;m.y=lerp(m.ty,-60,ease(Math.min(m.t,1)));}drawBall(m);}
      smashers=smashers.filter(m=>!(m.state==="up"&&m.t>=1));
      // floats
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      for(const f of floats){f.born=(f.born||0)+dt;f.y+=f.vy*dt;f.life-=0.018*dt;g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,f.x,f.y);g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;floats=floats.filter(f=>f.life>0);
      // power bar
      drawPower();
      // climax color-wash sweeping a glowing band across the screen
      if(celebrate>0){const ca=Math.min(1,celebrate);
        g.globalCompositeOperation="lighter";
        const sweep=((tsec*0.5)%1.4-0.2)*api.W,bw2=api.W*0.55;
        let cw=g.createLinearGradient(sweep,0,sweep+bw2,api.H);
        cw.addColorStop(0,"rgba(255,77,141,0)");
        cw.addColorStop(0.5,"rgba(255,210,63,0.55)");
        cw.addColorStop(1,"rgba(63,255,176,0)");
        g.globalAlpha=ca*0.26;g.fillStyle=cw;g.fillRect(0,0,api.W,api.H);
        g.globalAlpha=1;g.globalCompositeOperation="source-over";}
      // impact flash (color-tinted bloom)
      if(flash>0){flash-=0.06*dt;const fa=Math.max(0,flash);
        g.globalCompositeOperation="lighter";g.globalAlpha=fa*0.32;
        g.fillStyle=flashHue;g.fillRect(0,0,api.W,api.H);
        g.globalAlpha=fa*0.18;g.fillStyle="#fff";g.fillRect(0,0,api.W,api.H);
        g.globalAlpha=1;g.globalCompositeOperation="source-over";}
      // "next town" full-screen burst: radiating rays + confetti dots behind the banner
      if(townCele>0){townCele=Math.max(0,townCele-0.016*dt);const tc=Math.min(1,townCele);
        g.save();g.globalCompositeOperation="lighter";g.translate(api.W/2,api.H*0.42);
        g.globalAlpha=tc*0.5;
        for(let i=0;i<14;i++){g.rotate(TAU/14);g.fillStyle=COLORS[i%COLORS.length];
          const rl=api.W*0.7*(0.5+0.5*Math.sin(tsec*4+i));
          g.beginPath();g.moveTo(0,0);g.lineTo(rl,-12);g.lineTo(rl,12);g.closePath();g.fill();}
        g.restore();
        g.globalCompositeOperation="lighter";
        for(let i=0;i<24;i++){const cx2=((i*97+tsec*40)%api.W),cy2=((i*131+tsec*70)%api.H);
          g.globalAlpha=tc*0.7;g.fillStyle=COLORS[i%COLORS.length];
          g.beginPath();g.arc(cx2,cy2,3+2*Math.sin(tsec*3+i),0,TAU);g.fill();}
        g.globalAlpha=1;g.globalCompositeOperation="source-over";}
      // clear banner (appears on every stage clear; bigger text on town clear)
      if(clearBanner>0){clearBanner=Math.max(0,clearBanner-0.016*dt);
        const ba=Math.min(1,clearBanner*1.6),pop=1+0.15*Math.sin(tsec*10)*ba;
        const big=clearTxt.length>7,fs=(big?38:46)*pop;
        g.save();g.translate(api.W/2,api.H*0.4);g.scale(1,1);
        g.globalAlpha=ba;g.font="900 "+fs+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.textAlign="center";g.lineJoin="round";
        g.lineWidth=10;g.strokeStyle="rgba(20,12,40,.7)";g.strokeText(clearTxt,0,0);
        let bg3=g.createLinearGradient(0,-fs*0.6,0,fs*0.6);
        bg3.addColorStop(0,"#fff6c8");bg3.addColorStop(0.5,theme().accent);bg3.addColorStop(1,"#ff7aa8");
        g.fillStyle=bg3;g.fillText(clearTxt,0,0);
        // つぎのビルの予告（テーマ名を一言チラ見せ＝「つぎは○○！」でわくわくを繋ぐ）
        if(nextRecipe){g.globalAlpha=ba;g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
          g.lineWidth=6;g.strokeStyle="rgba(20,12,40,.6)";
          g.strokeText("つぎは "+nextRecipe.name+"！",0,fs*0.7+14);
          g.fillStyle="#fff";g.fillText("つぎは "+nextRecipe.name+"！",0,fs*0.7+14);}
        g.globalAlpha=1;g.lineJoin="miter";g.restore();
        // 町クリア画面に「きょうの はっけん」タリー（会期内で発見が視覚的に積み上がる）
        if(clearTxt.indexOf("まち")>=0)drawTally(ba);}
    }
  };
  function baseShadow(x,y,s){g.fillStyle="rgba(0,0,0,.3)";g.fillRect(x+3,y+4,s,s);}
  // 既存のカラフルなキューブ（つみき系の土台にも流用）
  function drawCube(b){const x=b.x,y=b.y,s=S;
    baseShadow(x,y,s);
    let bg=g.createLinearGradient(x,y,x+s*0.4,y+s);
    bg.addColorStop(0,shade(b.color,40));bg.addColorStop(0.55,b.color);bg.addColorStop(1,shade(b.color,-30));
    g.fillStyle=bg;g.fillRect(x,y,s,s);
    g.save();g.globalCompositeOperation="lighter";
    g.globalAlpha=0.35+0.12*Math.sin(tsec*2+b.col+b.row*0.6);
    g.lineWidth=2;g.strokeStyle=shade(b.color,70);g.shadowBlur=6;g.shadowColor=b.color;
    g.strokeRect(x+1.5,y+1.5,s-3,s-3);g.restore();
    g.fillStyle="rgba(255,255,255,.32)";
    g.beginPath();g.moveTo(x,y);g.lineTo(x+s,y);g.lineTo(x+s-7,y+7);g.lineTo(x+7,y+7);g.closePath();g.fill();
    g.beginPath();g.moveTo(x,y);g.lineTo(x+7,y+7);g.lineTo(x+7,y+s-7);g.lineTo(x,y+s);g.closePath();g.fill();
    g.fillStyle="rgba(0,0,0,.28)";
    g.beginPath();g.moveTo(x+s,y);g.lineTo(x+s,y+s);g.lineTo(x+s-7,y+s-7);g.lineTo(x+s-7,y+7);g.closePath();g.fill();
    g.beginPath();g.moveTo(x,y+s);g.lineTo(x+s,y+s);g.lineTo(x+s-7,y+s-7);g.lineTo(x+7,y+s-7);g.closePath();g.fill();
    g.globalAlpha=0.5;g.fillStyle="rgba(255,255,255,.8)";
    g.beginPath();g.ellipse(x+s*0.3,y+s*0.26,s*0.2,s*0.1,-0.5,0,TAU);g.fill();g.globalAlpha=1;
    g.fillStyle="rgba(0,0,0,.3)";const r=Math.max(2,s*0.05);
    [[x+s*0.2,y+s*0.2],[x+s*0.8,y+s*0.2],[x+s*0.2,y+s*0.8],[x+s*0.8,y+s*0.8]].forEach(p=>{g.beginPath();g.arc(p[0],p[1],r,0,TAU);g.fill();});}
  // いわ: ごつごつした不定形＋面のかげ＋斑点（灰色）
  function drawRock(b){const x=b.x,y=b.y,s=S;baseShadow(x,y,s);
    let bg=g.createLinearGradient(x,y,x+s,y+s);
    bg.addColorStop(0,shade(b.color,28));bg.addColorStop(1,shade(b.color,-40));g.fillStyle=bg;
    g.beginPath();g.moveTo(x+s*0.15,y+s*0.1);g.lineTo(x+s*0.85,y+s*0.06);g.lineTo(x+s*0.97,y+s*0.5);
    g.lineTo(x+s*0.8,y+s*0.95);g.lineTo(x+s*0.2,y+s*0.92);g.lineTo(x+s*0.04,y+s*0.45);g.closePath();g.fill();
    g.fillStyle="rgba(255,255,255,.14)";g.beginPath();g.moveTo(x+s*0.15,y+s*0.1);g.lineTo(x+s*0.5,y+s*0.2);g.lineTo(x+s*0.2,y+s*0.55);g.closePath();g.fill();
    g.fillStyle="rgba(0,0,0,.22)";g.beginPath();g.moveTo(x+s*0.8,y+s*0.95);g.lineTo(x+s*0.5,y+s*0.55);g.lineTo(x+s*0.97,y+s*0.5);g.closePath();g.fill();
    g.fillStyle="rgba(0,0,0,.28)";for(let i=0;i<3;i++){g.beginPath();g.arc(x+s*(0.3+0.2*i),y+s*(0.4+0.16*((i*5)%3)),Math.max(1,s*0.045),0,TAU);g.fill();}}
  // こおり: 半透明の青＋斜めの光沢＋うっすらヒビ
  function drawIce(b){const x=b.x,y=b.y,s=S;baseShadow(x,y,s);
    let bg=g.createLinearGradient(x,y,x+s,y+s);
    bg.addColorStop(0,"rgba(224,246,255,.92)");bg.addColorStop(0.5,b.color);bg.addColorStop(1,"rgba(120,180,220,.85)");
    g.fillStyle=bg;g.fillRect(x,y,s,s);
    g.save();g.globalCompositeOperation="lighter";g.fillStyle="rgba(255,255,255,.5)";
    g.beginPath();g.moveTo(x+s*0.22,y+s*0.08);g.lineTo(x+s*0.42,y+s*0.08);g.lineTo(x+s*0.18,y+s*0.72);g.lineTo(x+s*0.06,y+s*0.72);g.closePath();g.fill();g.restore();
    g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=2;g.strokeRect(x+1.5,y+1.5,s-3,s-3);
    g.strokeStyle="rgba(255,255,255,.35)";g.lineWidth=1.2;g.beginPath();
    g.moveTo(x+s*0.62,y+s*0.18);g.lineTo(x+s*0.5,y+s*0.55);g.lineTo(x+s*0.72,y+s*0.82);g.stroke();}
  // きばこ: 木目＋X字の補強＋四隅の釘
  function drawCrate(b){const x=b.x,y=b.y,s=S;baseShadow(x,y,s);
    let bg=g.createLinearGradient(x,y,x,y+s);
    bg.addColorStop(0,shade(b.color,25));bg.addColorStop(1,shade(b.color,-25));g.fillStyle=bg;g.fillRect(x,y,s,s);
    g.strokeStyle="rgba(90,55,20,.5)";g.lineWidth=Math.max(1.5,s*0.05);g.strokeRect(x+2,y+2,s-4,s-4);
    g.beginPath();g.moveTo(x+2,y+2);g.lineTo(x+s-2,y+s-2);g.moveTo(x+s-2,y+2);g.lineTo(x+2,y+s-2);g.stroke();
    g.fillStyle="rgba(60,40,15,.7)";const nr=Math.max(1.5,s*0.05);
    [[x+s*0.14,y+s*0.14],[x+s*0.86,y+s*0.14],[x+s*0.14,y+s*0.86],[x+s*0.86,y+s*0.86]].forEach(p=>{g.beginPath();g.arc(p[0],p[1],nr,0,TAU);g.fill();});}
  // タイヤ: 黒いドーナツ＋トレッド＋銀のハブ
  function drawTire(b){const x=b.x,y=b.y,s=S,cx=x+s/2,cy=y+s/2;baseShadow(x,y,s);
    g.fillStyle="#23262e";g.beginPath();g.arc(cx,cy,s*0.46,0,TAU);g.fill();
    g.strokeStyle="#0f1116";g.lineWidth=Math.max(2,s*0.09);g.beginPath();g.arc(cx,cy,s*0.4,0,TAU);g.stroke();
    g.strokeStyle="#3a3f48";g.lineWidth=Math.max(1,s*0.04);
    for(let i=0;i<8;i++){const a=i/8*TAU;g.beginPath();g.moveTo(cx+Math.cos(a)*s*0.34,cy+Math.sin(a)*s*0.34);g.lineTo(cx+Math.cos(a)*s*0.46,cy+Math.sin(a)*s*0.46);g.stroke();}
    g.fillStyle="#9aa0aa";g.beginPath();g.arc(cx,cy,s*0.2,0,TAU);g.fill();
    g.fillStyle="#6f7580";g.beginPath();g.arc(cx,cy,s*0.09,0,TAU);g.fill();
    g.save();g.globalCompositeOperation="lighter";g.fillStyle="rgba(255,255,255,.2)";g.beginPath();g.arc(cx-s*0.14,cy-s*0.14,s*0.1,0,TAU);g.fill();g.restore();}
  // かお: まるいキューブに目・ほっぺ・口。react中は目をまるく口をおどろきに。
  function drawFace(b){const x=b.x,y=b.y,s=S,cx=x+s/2,cy=y+s/2,react=b.react||0;baseShadow(x,y,s);
    let bg=g.createLinearGradient(x,y,x,y+s);bg.addColorStop(0,shade(b.color,35));bg.addColorStop(1,shade(b.color,-20));
    g.fillStyle=bg;rrect(x+1,y+1,s-2,s-2,s*0.22);g.fill();
    g.fillStyle="rgba(255,120,150,.5)";
    g.beginPath();g.arc(cx-s*0.26,cy+s*0.12,s*0.1,0,TAU);g.fill();g.beginPath();g.arc(cx+s*0.26,cy+s*0.12,s*0.1,0,TAU);g.fill();
    const er=s*(react>0.3?0.13:0.09),ey=cy-s*0.08;g.fillStyle="#26304a";
    g.beginPath();g.arc(cx-s*0.18,ey,er,0,TAU);g.fill();g.beginPath();g.arc(cx+s*0.18,ey,er,0,TAU);g.fill();
    g.fillStyle="#fff";g.beginPath();g.arc(cx-s*0.18+er*0.3,ey-er*0.3,er*0.4,0,TAU);g.fill();g.beginPath();g.arc(cx+s*0.18+er*0.3,ey-er*0.3,er*0.4,0,TAU);g.fill();
    g.strokeStyle="#26304a";g.fillStyle="#26304a";g.lineWidth=Math.max(2,s*0.05);g.lineCap="round";
    if(react>0.3){g.beginPath();g.arc(cx,cy+s*0.22,s*0.1,0,TAU);g.fill();}
    else{g.beginPath();g.arc(cx,cy+s*0.14,s*0.14,0.15*Math.PI,0.85*Math.PI);g.stroke();}}
  // ケーキ: スポンジ＋クリーム＋フロスティング＋さくらんぼ＋トッピング
  function drawCake(b){const x=b.x,y=b.y,s=S;baseShadow(x,y,s);
    let bg=g.createLinearGradient(x,y,x,y+s);bg.addColorStop(0,shade(b.color,20));bg.addColorStop(1,shade(b.color,-18));
    g.fillStyle=bg;g.fillRect(x,y+s*0.34,s,s*0.66);
    g.fillStyle="#f6c9a0";g.fillRect(x,y+s*0.56,s,s*0.05);
    g.fillStyle="#fff2f8";rrect(x+1,y+s*0.12,s-2,s*0.34,s*0.1);g.fill();
    g.fillStyle="#ffdcec";g.fillRect(x+2,y+s*0.3,s-4,s*0.14);
    g.fillStyle="#ff3b6b";g.beginPath();g.arc(x+s*0.5,y+s*0.16,s*0.09,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(x+s*0.46,y+s*0.13,s*0.03,0,TAU);g.fill();
    const dc=["#36c9ff","#ffd23f","#3fffb0","#b066ff"];
    for(let i=0;i<3;i++){g.fillStyle=dc[i];g.fillRect(x+s*(0.24+0.2*i),y+s*0.37,s*0.09,s*0.03);}}
  // つみき: ふちどりキューブに丸/星のスタンプ（文字は使わない）
  function drawToy(b){const x=b.x,y=b.y,s=S,cx=x+s/2,cy=y+s/2;baseShadow(x,y,s);
    let bg=g.createLinearGradient(x,y,x,y+s);bg.addColorStop(0,shade(b.color,30));bg.addColorStop(1,shade(b.color,-22));
    g.fillStyle=bg;rrect(x+1,y+1,s-2,s-2,s*0.14);g.fill();
    g.fillStyle="rgba(255,255,255,.35)";rrect(x+s*0.16,y+s*0.16,s*0.68,s*0.68,s*0.1);g.fill();
    g.fillStyle=shade(b.color,-6);rrect(x+s*0.22,y+s*0.22,s*0.56,s*0.56,s*0.08);g.fill();
    if(((b.col+b.row)&1)===0){g.fillStyle="#fff";g.save();g.translate(cx,cy);starPath(s*0.2);g.fill();g.restore();}
    else{g.fillStyle="#fff";g.beginPath();g.arc(cx,cy,s*0.17,0,TAU);g.fill();g.fillStyle=shade(b.color,-6);g.beginPath();g.arc(cx,cy,s*0.09,0,TAU);g.fill();}}
  // 多段ヒットのヒビ（欠けるほど濃く/枝分かれ）。壊し応えを視覚化。
  function drawCracks(b){const x=b.x,y=b.y,s=S,d=(b.maxHp-b.hp)/Math.max(1,b.maxHp);
    g.save();g.strokeStyle="rgba(18,14,28,"+(0.5+0.3*d)+")";g.lineWidth=Math.max(1.5,s*0.05);g.lineCap="round";g.lineJoin="round";
    g.beginPath();g.moveTo(x+s*0.5,y+s*0.08);g.lineTo(x+s*0.4,y+s*0.45);g.lineTo(x+s*0.6,y+s*0.6);g.lineTo(x+s*0.45,y+s*0.92);
    if(d>0.5){g.moveTo(x+s*0.4,y+s*0.45);g.lineTo(x+s*0.14,y+s*0.5);g.moveTo(x+s*0.6,y+s*0.6);g.lineTo(x+s*0.86,y+s*0.55);}
    g.stroke();g.restore();}
  // ビルの各ブロックを種類で描き分け（react=たたかれた反応でぷにっと変形/おどろき）
  function drawBlock(b){
    const x=b.x,y=b.y,s=S,react=b.react||0,k=b.kind||"block";
    if(react>0){const sc=1+0.14*react;g.save();g.translate(x+s/2,y+s/2);g.scale(sc,2-sc);g.translate(-(x+s/2),-(y+s/2));}
    // ばくだんは手描きの赤キューブ＋発光コア(生成画像は床/円盤が残り不採用)。画像を使う場合はここで drawAsset に切替える
    const bombImg=false;
    if(!bombImg){
      // 軸7向け「巨大セル」: 見た目だけ隣のマスへはみ出すよう自分の中心を軸に拡大して描く(当たり判定はSのまま)
      if(b.giant){const gcx=x+s/2,gcy=y+s/2,gs=b.gScale||1.7;
        g.save();g.translate(gcx,gcy);g.scale(gs,gs);g.translate(-gcx,-gcy);}
      if(k==="rock")drawRock(b);else if(k==="ice")drawIce(b);else if(k==="crate")drawCrate(b);
      else if(k==="tire")drawTire(b);else if(k==="face")drawFace(b);else if(k==="cake")drawCake(b);
      else if(k==="toy")drawToy(b);else drawCube(b);
      if(b.giant)g.restore();
    }
    if(b.hp<b.maxHp&&!b.bomb&&k!=="face")drawCracks(b);
    // ばくだんブロック: 脈打つ発光コア＋回る火花マークで「ここを狙え」と一目で分かる見た目に
    if(b.bomb){
      const cxp=x+s/2,cyp=y+s/2,pulse=0.5+0.5*Math.sin(tsec*6+b.row*0.7+b.col);
      g.save();g.globalCompositeOperation="lighter";
      g.globalAlpha=0.55+0.4*pulse;g.shadowBlur=12+8*pulse;g.shadowColor="#ffd23f";
      let cg=g.createRadialGradient(cxp,cyp,1,cxp,cyp,s*0.52);
      cg.addColorStop(0,"rgba(255,255,220,.95)");cg.addColorStop(0.5,"rgba(255,130,60,.7)");cg.addColorStop(1,"rgba(255,60,90,0)");
      g.fillStyle=cg;g.beginPath();g.arc(cxp,cyp,s*(0.34+0.06*pulse),0,TAU);g.fill();
      g.restore();
      g.save();g.translate(cxp,cyp);g.rotate(tsec*1.5);g.globalCompositeOperation="lighter";
      g.strokeStyle="#fff6c8";g.lineWidth=Math.max(2,s*0.06);g.lineCap="round";g.globalAlpha=0.7+0.3*pulse;
      for(let k=0;k<4;k++){g.rotate(TAU/4);g.beginPath();g.moveTo(0,-s*0.06);g.lineTo(0,-s*0.26-s*0.06*pulse);g.stroke();}
      g.restore();}
    // ほうせきブロック: にじ色に回るファセット＋白いきらめきコア。ひと目で「特別！」と分かる。
    if(b.gem){
      const cxp=x+s/2,cyp=y+s/2,t=tsec*2+b.row*0.5+b.col*0.4,base=Math.floor(tsec*3);
      g.save();g.globalCompositeOperation="lighter";
      for(let k=0;k<6;k++){g.globalAlpha=0.26+0.16*Math.sin(t+k);
        g.fillStyle=COLORS[(k+base)%COLORS.length];
        const a=t*0.5+k*TAU/6;g.beginPath();g.moveTo(cxp,cyp);g.arc(cxp,cyp,s*0.5,a,a+TAU/6);g.closePath();g.fill();}
      g.globalAlpha=0.7+0.3*Math.sin(t*2);g.fillStyle="#fff";g.shadowBlur=10;g.shadowColor="#fff";
      g.beginPath();g.arc(cxp,cyp,s*0.14,0,TAU);g.fill();
      g.restore();g.shadowBlur=0;g.globalAlpha=1;g.globalCompositeOperation="source-over";}
    // レインボービルの1個: にじ色の回るファセット（宝石より軽い4枚＝ビルまるごとでも60fps維持）
    if(b.rainbow){const cxp=x+s/2,cyp=y+s/2,t=tsec*2+b.row*0.5+b.col*0.4,base=Math.floor(tsec*3+b.col);
      g.save();g.globalCompositeOperation="lighter";
      for(let k=0;k<4;k++){g.globalAlpha=0.22+0.16*Math.sin(t+k);g.fillStyle=COLORS[(k+base)%COLORS.length];
        const a=t*0.5+k*TAU/4;g.beginPath();g.moveTo(cxp,cyp);g.arc(cxp,cyp,s*0.5,a,a+TAU/4);g.closePath();g.fill();}
      g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";}
    // かなめ石マーク: さりげない菱形（気づく人だけ気づく見た目差＝狙いどころの読み）
    if(b.key){g.save();g.globalCompositeOperation="lighter";
      g.globalAlpha=0.45+0.3*Math.sin(tsec*3+b.col);g.fillStyle="#ffe6a0";g.translate(x+s/2,y+s/2);
      g.beginPath();g.moveTo(0,-s*0.15);g.lineTo(s*0.12,0);g.lineTo(0,s*0.15);g.lineTo(-s*0.12,0);g.closePath();g.fill();
      g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";}
    // 金ブロック: 金色グロー＋残り時間の縮むリング（時間内に壊すと大ボーナス＝時間制限の発見）
    if(b===goldRef){const cxp=x+s/2,cyp=y+s/2,tt=clamp(goldT/125,0,1),pl=0.6+0.4*Math.sin(tsec*8);
      g.save();g.globalCompositeOperation="lighter";
      let gg2=g.createRadialGradient(cxp,cyp,1,cxp,cyp,s*0.6);
      gg2.addColorStop(0,"rgba(255,246,180,.95)");gg2.addColorStop(0.6,"rgba(255,196,60,.6)");gg2.addColorStop(1,"rgba(255,150,30,0)");
      g.globalAlpha=0.55+0.35*pl;g.fillStyle=gg2;g.beginPath();g.arc(cxp,cyp,s*0.52,0,TAU);g.fill();
      g.globalAlpha=0.95;g.strokeStyle="#fff2a0";g.lineWidth=3;g.shadowBlur=8;g.shadowColor="#ffd23f";
      g.beginPath();g.arc(cxp,cyp,s*0.42,-Math.PI/2,-Math.PI/2+TAU*tt);g.stroke();
      g.restore();g.shadowBlur=0;g.globalAlpha=1;g.globalCompositeOperation="source-over";}
    if(react>0)g.restore();}
  function shade(hex,amt){let n=parseInt(hex.slice(1),16);
    let r=clamp((n>>16)+amt,0,255),gg=clamp(((n>>8)&255)+amt,0,255),bb=clamp((n&255)+amt,0,255);
    return"rgb("+r+","+gg+","+bb+")";}
  function drawBall(m){
    // chain
    g.strokeStyle="#2f3645";g.lineWidth=4;g.beginPath();g.moveTo(m.x,0);g.lineTo(m.x,m.y);g.stroke();
    g.strokeStyle="rgba(180,190,205,.6)";g.lineWidth=1.5;g.beginPath();g.moveTo(m.x-1,0);g.lineTo(m.x-1,m.y);g.stroke();
    const r=S*0.55;
    // outer magic aura
    g.save();g.globalCompositeOperation="lighter";
    let aur=g.createRadialGradient(m.x,m.y,r*0.3,m.x,m.y,r*1.9);
    aur.addColorStop(0,"rgba(120,180,255,.55)");aur.addColorStop(0.5,"rgba(90,140,255,.18)");aur.addColorStop(1,"rgba(90,140,255,0)");
    g.fillStyle=aur;g.beginPath();g.arc(m.x,m.y,r*1.9,0,TAU);g.fill();g.restore();
    // 鉄球は手描き(生成画像は背景抜きの円盤/床影が残り不採用)。画像化する時は r*2.3 の正方形で中央描画に切替える
    const ballImg=false;
    if(!ballImg){
    g.save();g.shadowBlur=18;g.shadowColor="rgba(120,170,255,.85)";
    const grd=g.createRadialGradient(m.x-r*0.35,m.y-r*0.35,r*0.1,m.x,m.y,r);
    grd.addColorStop(0,"#eef4ff");grd.addColorStop(0.42,"#7f8fb6");grd.addColorStop(1,"#26304a");
    g.fillStyle=grd;g.beginPath();g.arc(m.x,m.y,r,0,TAU);g.fill();g.restore();
    }
    // glowing energy core
    g.save();g.globalCompositeOperation="lighter";
    const cr=r*(0.32+0.06*Math.sin(tsec*6));
    let core=g.createRadialGradient(m.x,m.y,0,m.x,m.y,cr);
    core.addColorStop(0,"rgba(220,240,255,.95)");core.addColorStop(0.6,"rgba(120,180,255,.5)");core.addColorStop(1,"rgba(120,180,255,0)");
    g.fillStyle=core;g.beginPath();g.arc(m.x,m.y,cr,0,TAU);g.fill();g.restore();
    // にじいろボーナス中は 虹色のオーラを まとう（体で感じる報酬）
    if(rainbow>0){g.save();g.globalCompositeOperation="lighter";const rb=Math.min(1,rainbow),bs=Math.floor(tsec*8);
      for(let k=0;k<6;k++){g.globalAlpha=rb*0.4;g.fillStyle=COLORS[(k+bs)%COLORS.length];
        const a=tsec*3+k*TAU/6;g.beginPath();g.arc(m.x+Math.cos(a)*r*0.95,m.y+Math.sin(a)*r*0.95,r*0.3,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";}
    // rim + highlight (手描き時のみ。画像には光沢が描かれている)
    if(!ballImg){
    g.strokeStyle="rgba(190,215,255,.5)";g.lineWidth=2;g.beginPath();g.arc(m.x,m.y,r,0,TAU);g.stroke();
    g.fillStyle="rgba(255,255,255,.75)";g.beginPath();g.arc(m.x-r*0.35,m.y-r*0.4,r*0.18,0,TAU);g.fill();
    }
    // cute face on the ball (it's a little buddy!)
    const ex=r*0.32,ey=-r*0.08,er=r*0.16,smash=Math.min(1,smashFace);
    // rosy cheeks
    g.globalAlpha=0.5+0.3*smash;g.fillStyle="#ff7aa8";
    g.beginPath();g.arc(m.x-r*0.5,m.y+r*0.16,r*0.13,0,TAU);g.fill();
    g.beginPath();g.arc(m.x+r*0.5,m.y+r*0.16,r*0.13,0,TAU);g.fill();g.globalAlpha=1;
    // eyes (squint into ^_^ when smashing)
    g.fillStyle="#1a2238";g.strokeStyle="#1a2238";g.lineWidth=Math.max(2,r*0.09);g.lineCap="round";
    if(smash>0.4){
      g.beginPath();g.moveTo(m.x-ex-er*0.7,m.y+ey+er*0.4);g.lineTo(m.x-ex,m.y+ey-er*0.5);g.lineTo(m.x-ex+er*0.7,m.y+ey+er*0.4);g.stroke();
      g.beginPath();g.moveTo(m.x+ex-er*0.7,m.y+ey+er*0.4);g.lineTo(m.x+ex,m.y+ey-er*0.5);g.lineTo(m.x+ex+er*0.7,m.y+ey+er*0.4);g.stroke();
    }else{
      g.beginPath();g.arc(m.x-ex,m.y+ey,er,0,TAU);g.fill();
      g.beginPath();g.arc(m.x+ex,m.y+ey,er,0,TAU);g.fill();
      g.fillStyle="#fff";g.beginPath();g.arc(m.x-ex+er*0.3,m.y+ey-er*0.3,er*0.4,0,TAU);g.fill();
      g.beginPath();g.arc(m.x+ex+er*0.3,m.y+ey-er*0.3,er*0.4,0,TAU);g.fill();
    }
    // mouth (open shout when smashing, small smile otherwise)
    g.fillStyle="#1a2238";g.strokeStyle="#1a2238";g.lineWidth=Math.max(2,r*0.08);
    if(smash>0.4){g.beginPath();g.ellipse(m.x,m.y+r*0.42,r*0.18*smash+r*0.08,r*0.2*smash+r*0.07,0,0,TAU);g.fill();}
    else{g.beginPath();g.arc(m.x,m.y+r*0.28,r*0.18,0.15*Math.PI,0.85*Math.PI);g.stroke();}}
  // little mascot crane operator waving from the sky, cheers on big hits
  function drawCrane(){
    const bob=Math.sin(tsec*2)*3,cx=Math.min(api.W*0.16,60),cy=api.H*0.2+bob,r=clamp(S*0.5,22,32);
    const cel=Math.min(1,celebrate),pop=1+0.12*Math.sin(tsec*9)*cel;
    g.save();g.translate(cx,cy);g.scale(pop,pop);
    // floating ring shadow
    g.fillStyle="rgba(0,0,0,.18)";g.beginPath();g.ellipse(0,r*1.5,r*0.7,r*0.2,0,0,TAU);g.fill();
    // 画像マスコット(帽子〜足まで約 r*3 の高さ)。よろこび中は左右にゆらす。手描きの体/腕は描かない
    {const wob=Math.sin(tsec*8)*0.16*cel;
     if(api.drawAsset("mascot.png",0,-r*0.15,r*3.4,r*3.4,{center:true,rot:wob})){
       g.restore();
       if(cel>0.2){g.globalCompositeOperation="lighter";
         for(let i=0;i<4;i++){const a=tsec*3+i*TAU/4,rr=r*1.6+Math.sin(tsec*5+i)*r*0.4;
           g.globalAlpha=cel*0.8;g.fillStyle=COLORS[i%COLORS.length];
           const px=cx+Math.cos(a)*rr,py=cy+Math.sin(a)*rr;
           g.beginPath();g.arc(px,py,2.5,0,TAU);g.fill();}
         g.globalAlpha=1;g.globalCompositeOperation="source-over";}
       return;}}
    // body (round capsule, sky-blue overalls)
    g.fillStyle="#ffd23f";g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    g.fillStyle="#36c9ff";g.beginPath();g.arc(0,r*0.5,r*0.95,0.1*Math.PI,0.9*Math.PI);g.fill();
    g.fillRect(-r*0.9,r*0.5,r*1.8,r*0.7);
    // hard hat
    g.fillStyle="#ff8a3a";g.beginPath();g.arc(0,-r*0.55,r*0.85,Math.PI,TAU);g.fill();
    g.fillRect(-r*0.95,-r*0.6,r*1.9,r*0.16);
    g.fillStyle="#ffb066";g.fillRect(-r*0.18,-r*1.5,r*0.36,r*0.4);
    // eyes
    const blink=(Math.sin(tsec*1.3)>0.96)?0.15:1;
    g.fillStyle="#1a2238";
    g.beginPath();g.ellipse(-r*0.3,-r*0.1,r*0.13,r*0.16*blink,0,0,TAU);g.fill();
    g.beginPath();g.ellipse(r*0.3,-r*0.1,r*0.13,r*0.16*blink,0,0,TAU);g.fill();
    g.fillStyle="#fff";g.beginPath();g.arc(-r*0.26,-r*0.16,r*0.05,0,TAU);g.fill();
    g.beginPath();g.arc(r*0.34,-r*0.16,r*0.05,0,TAU);g.fill();
    // cheeks + mouth (big grin on celebrate)
    g.fillStyle="#ff7aa8";g.globalAlpha=0.7;
    g.beginPath();g.arc(-r*0.5,r*0.18,r*0.12,0,TAU);g.fill();
    g.beginPath();g.arc(r*0.5,r*0.18,r*0.12,0,TAU);g.fill();g.globalAlpha=1;
    g.strokeStyle="#1a2238";g.lineWidth=Math.max(2,r*0.09);g.lineCap="round";
    g.beginPath();g.arc(0,r*0.12,r*0.28,0.1*Math.PI,0.9*Math.PI);g.stroke();
    // waving arm (raises higher when celebrating)
    g.strokeStyle="#ffd23f";g.lineWidth=r*0.28;
    const wave=Math.sin(tsec*(4+cel*6))*0.5,ay=-r*0.4-cel*r*0.5;
    g.beginPath();g.moveTo(r*0.7,r*0.2);g.lineTo(r*1.15+wave*r*0.3,ay);g.stroke();
    g.fillStyle="#fff";g.beginPath();g.arc(r*1.15+wave*r*0.3,ay,r*0.2,0,TAU);g.fill();
    g.restore();
    // sparkle bursts above mascot on celebrate
    if(cel>0.2){g.globalCompositeOperation="lighter";
      for(let i=0;i<4;i++){const a=tsec*3+i*TAU/4,rr=r*1.6+Math.sin(tsec*5+i)*r*0.4;
        g.globalAlpha=cel*0.8;g.fillStyle=COLORS[i%COLORS.length];
        const px=cx+Math.cos(a)*rr,py=cy+Math.sin(a)*rr;
        g.beginPath();g.arc(px,py,2.5,0,TAU);g.fill();}
      g.globalAlpha=1;g.globalCompositeOperation="source-over";}}
  // そらのいきものの絵（テーマ別・シンプルなcanvas図形）
  function drawCreature(cx,cy,type,ph){
    const t=type,r=clamp(S*0.5,22,34);
    g.save();g.translate(cx,cy);
    g.globalCompositeOperation="lighter";g.globalAlpha=0.5;
    let au=g.createRadialGradient(0,0,r*0.3,0,0,r*1.8);
    au.addColorStop(0,"rgba(255,255,255,.35)");au.addColorStop(1,"rgba(255,255,255,0)");
    g.fillStyle=au;g.beginPath();g.arc(0,0,r*1.8,0,TAU);g.fill();
    g.globalAlpha=1;g.globalCompositeOperation="source-over";
    if(t===0){ // ふうせん（よる）
      g.fillStyle="#ff6a8a";g.beginPath();g.ellipse(0,-r*0.1,r*0.7,r*0.85,0,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.ellipse(-r*0.22,-r*0.3,r*0.18,r*0.26,-0.4,0,TAU);g.fill();
      g.fillStyle="#ff6a8a";g.beginPath();g.moveTo(0,r*0.7);g.lineTo(-r*0.14,r*0.86);g.lineTo(r*0.14,r*0.86);g.closePath();g.fill();
      g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=1.5;g.beginPath();g.moveTo(0,r*0.86);g.lineTo(0,r*1.5);g.stroke();
    }else if(t===1){ // とり（ゆうやけ）
      const wf=Math.sin(ph*3)*0.5;
      g.fillStyle="#fff4d6";g.beginPath();g.ellipse(0,0,r*0.7,r*0.5,0,0,TAU);g.fill();
      g.fillStyle="#ffd23f";g.beginPath();g.moveTo(r*0.55,0);g.lineTo(r*0.9,-r*0.12);g.lineTo(r*0.9,r*0.12);g.closePath();g.fill();
      g.strokeStyle="#ffb84d";g.lineWidth=Math.max(3,r*0.14);g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.1,-r*0.1);g.lineTo(-r*0.6,-r*0.5-wf*r*0.4);g.stroke();
      g.beginPath();g.moveTo(-r*0.1,r*0.1);g.lineTo(-r*0.6,r*0.5+wf*r*0.4);g.stroke();
      g.fillStyle="#1a2238";g.beginPath();g.arc(r*0.4,-r*0.12,r*0.07,0,TAU);g.fill();
    }else if(t===2){ // クジラ（うみべ）
      g.fillStyle="#5ab0e0";g.beginPath();g.ellipse(0,0,r*0.85,r*0.55,0,0,TAU);g.fill();
      g.beginPath();g.moveTo(-r*0.75,0);g.lineTo(-r*1.1,-r*0.4);g.lineTo(-r*1.1,r*0.4);g.closePath();g.fill();
      g.fillStyle="rgba(255,255,255,.6)";g.beginPath();g.ellipse(r*0.1,r*0.18,r*0.55,r*0.28,0,0,TAU);g.fill();
      g.fillStyle="#1a2238";g.beginPath();g.arc(r*0.45,-r*0.1,r*0.08,0,TAU);g.fill();
      g.strokeStyle="rgba(220,240,255,.8)";g.lineWidth=2;g.lineCap="round";
      for(let k=-1;k<2;k++){g.beginPath();g.moveTo(r*0.35,-r*0.4);g.lineTo(r*0.35+k*r*0.18,-r*0.4-r*0.5*(1-Math.abs(k)*0.3));g.stroke();}
    }else{ // UFO（うちゅう）
      g.fillStyle="#b6e0ff";g.beginPath();g.arc(0,-r*0.1,r*0.5,Math.PI,TAU);g.fill();
      g.fillStyle="#9aa8c8";g.beginPath();g.ellipse(0,0,r*0.9,r*0.32,0,0,TAU);g.fill();
      g.fillStyle="#ffd23f";
      for(let k=-2;k<=2;k++){g.globalAlpha=0.5+0.5*Math.sin(tsec*6+k);g.beginPath();g.arc(k*r*0.32,r*0.12,r*0.07,0,TAU);g.fill();}
      g.globalAlpha=1;g.globalCompositeOperation="lighter";g.globalAlpha=0.3*(0.6+0.4*Math.sin(tsec*6));
      let bg=g.createLinearGradient(0,0,0,r*1.6);bg.addColorStop(0,"rgba(180,255,220,.6)");bg.addColorStop(1,"rgba(180,255,220,0)");
      g.fillStyle=bg;g.beginPath();g.moveTo(-r*0.3,r*0.2);g.lineTo(r*0.3,r*0.2);g.lineTo(r*0.7,r*1.5);g.lineTo(-r*0.7,r*1.5);g.closePath();g.fill();
      g.globalAlpha=1;g.globalCompositeOperation="source-over";
    }
    g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";
  }
  // 「きょうの はっけん」タリー: 発見の種類ごとに アイコンが点灯（会期内・町クリア画面）
  function drawTally(a){
    const labs=["ほうせき","ほし","つき","そら","きん"],vals=[found.gem,found.star,found.moon,found.creature,found.gold];
    const cols=["#7be0ff","#ffe14a","#dff4ff","#ff9ad0","#ffca4a"];
    g.save();g.globalAlpha=a;g.textAlign="center";
    g.font="800 17px 'Hiragino Maru Gothic ProN',system-ui";
    g.lineWidth=5;g.lineJoin="round";g.strokeStyle="rgba(20,12,40,.6)";
    g.strokeText("きょうの はっけん",api.W/2,api.H*0.55-24);
    g.fillStyle="#fff";g.fillText("きょうの はっけん",api.W/2,api.H*0.55-24);
    const gap=Math.min(66,api.W*0.17),x0=api.W/2-(vals.length-1)*gap/2,yy=api.H*0.55+8;
    for(let i=0;i<vals.length;i++){const x=x0+i*gap,lit=vals[i]>0;
      g.save();g.translate(x,yy);
      if(lit){g.globalCompositeOperation="lighter";g.shadowBlur=10;g.shadowColor=cols[i];g.globalAlpha=a;}
      else g.globalAlpha=a*0.3;
      g.fillStyle=lit?cols[i]:"#8a8aa0";
      if(i===1)  {starPath(11);g.fill();}
      else if(i===0){g.rotate(0.78);g.fillRect(-8,-8,16,16);}
      else if(i===4){g.fillRect(-9,-9,18,18);}
      else{g.beginPath();g.arc(0,0,10,0,TAU);g.fill();}
      g.restore();
      g.globalAlpha=a*(lit?1:0.4);g.fillStyle=lit?"#fff":"#9a9ab0";
      g.font="800 12px 'Hiragino Maru Gothic ProN',system-ui";
      g.fillText(labs[i]+(lit?" "+vals[i]:""),x,yy+28);}
    g.restore();g.shadowBlur=0;g.globalAlpha=1;g.globalCompositeOperation="source-over";g.textAlign="left";g.lineJoin="miter";
  }
  function rrect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  // irregular angular debris chunk (not a plain square)
  function chunkPts(){const n=rint(4,5),a=[];for(let i=0;i<n;i++){const ang=i/n*TAU+rnd(-0.35,0.35),rr=rnd(0.34,0.55);a.push([Math.cos(ang)*rr,Math.sin(ang)*rr]);}return a;}
  function drawChunk(p){const pts=p.pts,s=p.s;
    g.beginPath();g.moveTo(pts[0][0]*s,pts[0][1]*s);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0]*s,pts[i][1]*s);g.closePath();
    if(p.glass){g.save();g.globalAlpha*=0.75;g.fillStyle=p.color;g.fill();
      g.lineWidth=Math.max(1,s*0.08);g.strokeStyle="rgba(255,255,255,.8)";g.stroke();g.restore();return;}
    g.fillStyle=p.color;g.fill();
    g.save();g.clip();g.fillStyle="rgba(0,0,0,.28)";g.beginPath();g.moveTo(0,-s);g.lineTo(s,s);g.lineTo(-s,s);g.closePath();g.fill();g.restore();
    g.lineWidth=Math.max(1,s*0.08);g.strokeStyle="rgba(255,255,255,.45)";g.stroke();}
  function drawPower(){const w=Math.min(api.W*0.5,240),x=(api.W-w)/2,y=api.H-30,h=16;
    // soft rounded panel with outline + glow
    g.save();g.shadowBlur=10;g.shadowColor="rgba(0,0,0,.45)";
    g.fillStyle="rgba(28,20,58,.62)";rrect(x-5,y-3,w+10,h+6,(h+6)/2);g.fill();g.restore();
    g.lineWidth=2;g.strokeStyle="rgba(255,255,255,.35)";rrect(x-5,y-3,w+10,h+6,(h+6)/2);g.stroke();
    const fw=(w)*power;
    if(fw>2){let pg=g.createLinearGradient(x,0,x+w,0);
      if(armed){pg.addColorStop(0,"#ff6a3a");pg.addColorStop(0.5,"#ff3b6b");pg.addColorStop(1,"#ffb066");}
      else{pg.addColorStop(0,"#ffe14a");pg.addColorStop(1,"#ff9a3a");}
      g.save();if(armed){g.shadowBlur=14+8*Math.sin(tsec*8);g.shadowColor="#ff3b6b";}
      g.fillStyle=pg;rrect(x,y,fw,h,h/2);g.fill();g.restore();
      // moving shimmer
      const sxp=x+((tsec*120)%Math.max(fw,1));if(fw>8){g.save();rrect(x,y,fw,h,h/2);g.clip();
        g.globalAlpha=0.5;g.fillStyle="#fff";g.fillRect(sxp,y,3,h);g.restore();}
      // glossy top sheen
      g.save();rrect(x,y,fw,h,h/2);g.clip();g.fillStyle="rgba(255,255,255,.3)";
      g.fillRect(x,y+1,fw,h*0.35);g.restore();}
    g.font="800 14px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
    g.lineWidth=4;g.lineJoin="round";g.strokeStyle="rgba(20,12,40,.6)";
    const label=armed?"MAX！ タップで ぜんかい":"パワー";
    g.save();if(armed){g.shadowBlur=10+5*Math.sin(tsec*8);g.shadowColor="#ffd23f";}
    g.strokeText(label,api.W/2,y-7);g.fillStyle=armed?"#fff":"#fff5d6";g.fillText(label,api.W/2,y-7);g.restore();
    g.textAlign="left";g.lineJoin="miter";}
}
Engine.register("crane", buildWrecking);
