function buildPunch(api){
  const g=api.g;
  // 画像アセット(assets/punch/): 背景 / こぶし(グローブ) / ボス(ロボ)。無ければ従来の手描きにフォールバック。
  //  ブロック(種類色・テーマ色で色替え)は方針どおり手描きのまま。
  //  かいじゅう/だいぶつ は手描き(かいじゅう画像は生成2回とも床・影が残ったので不採用)。
  api.preload(["bg.jpg","glove.png","robo.png"]);
  let bricks=[],shards=[],dust=[],sparks=[],rings=[],clouds=[],motes=[],fallers=[],groundY,S,wallX,fist,level=1,count=0,flash=0,wash=0,washCol="#fff",tnow=0,theme;
  // stage/wave progression: clear all walls in a stage -> "STAGE CLEAR" -> next stage gets a touch harder + a new gimmick
  let stage=1,wave=1,wavesPerStage=1,aimY=0,aimT=0;
  const FINAL_STAGE=5;
  // combo: consecutive punches that hit keep a chain alive; higher combo = bigger reward + escalating wash
  let combo=0,comboTimer=0,bestCombo=0,stageBanner=0,stageBannerTxt="",finale=0,clearing=false;
  // デカボス: たまに上から降ってくる巨大ボス(大仏/怪獣/ロボ)。多段HPをこぶしでちょっとずつ削る→撃破でドカン。
  let boss=null,bossWarn=0,bossWarnTxt="",bossCooldown=1;
  // 詰み撲滅ガード: 直近で「壊した/削った(=前進)」が無いフレーム数。閾値超で残りを自動で崩す。
  let noBreak=0,lastProg=-1,lastCount=0;
  const STUCK=480;                 // 約8秒 前進が無ければ自動クラッシュ(かたい壁が増えた分、詰み防止のタイミングを少し早める)
  // hitStop はクールダウン付きでのみ発火（節目/大ヒットだけ・連打で画面が凍らないように）
  let hsCD=0;
  function tryHitStop(f){if(hsCD<=0){api.hitStop(f);hsCD=34;}}
  // 壁のテーマ(レシピ): 壁ごとに「つぎは何かな？」を作る核。size=1マスの大きさ倍率(縦横の範囲は一定に保つ)。
  //  curRecipe=いま建っている壁 / nextRecipe=次壁の予告用（先に抽選しておく）。
  let sizeScale=1,curRecipe=null,nextRecipe=null,spawnTitle=0,spawnTxt="";
  function comboCol(){return combo>=15?"#ff5a3b":combo>=10?"#ffd23f":combo>=5?"#ffae5e":"#fff";}
  // each level cycles a themed palette + face -> visual variety as you progress (wash色/かおの色に使う)
  const THEMES=[
    {name:"brick",cols:["#d4633f","#c44a3a","#9a6440","#b5602f","#869099"],face:"#3a2018",blush:"#ff9b6b"},
    {name:"ice", cols:["#7fd6ff","#9fe6ff","#bff0ff","#6cc4f5","#aee9ff"],face:"#1c4a66",blush:"#7fb8e0"},
    {name:"candy",cols:["#ff8fcf","#ffb3d9","#a7e0ff","#ffd86b","#b8ff9a"],face:"#7a2f55",blush:"#ff7fb0"},
    {name:"gold", cols:["#ffd23f","#ffe07a","#f5b53f","#ffc94d","#e8a23a"],face:"#6a4810",blush:"#ff9b4b"},
    {name:"slime",cols:["#7be07b","#a8f08a","#5fcf6a","#cdf59a","#8ad6a0"],face:"#1f5a2a",blush:"#7fe07f"}
  ];
  function pickTheme(){return THEMES[(level-1)%THEMES.length];}
  let COLORS=THEMES[0].cols;
  // ==== 壁のレシピ(種類/大きさ/硬さ) ==========================================
  //  kind=殴る対象の種類 / size=マス目倍率(範囲は一定) / hp=硬さ / allBomb=1発で総ふっとぶ当たり壁。w=抽選の重み。
  const KINDS=["block","rock","face","ice","crate","tire","cake","toy"];
  // tower/car は形(たて2マス/よこ2マス)そのものが違う建物/乗り物カテゴリ。専用レシピの壁でのみ使う(mixedには混ぜない=座標が2マス単位のため)。
  //  sizeFixed=このレシピは意図した極端サイズを固定（big=でか少数 / fine=つぶつぶ）。
  //  それ以外は毎壁 sizeLottery() で1マスの大きさを抽選し、「デカい/つぶつぶ」を体感1/3で出す。
  const RECIPES=[
    {id:"mix",   name:"ごちゃまぜ",     w:16, mixed:true },
    {id:"rock",  name:"いわの かべ",    w:11, kind:"rock" },
    {id:"face",  name:"かおの かべ",    w:11, kind:"face" },
    {id:"ice",   name:"こおりの かべ",  w:10, kind:"ice",  iceThick:true},
    {id:"crate", name:"きばこ",         w:9,  kind:"crate"},
    {id:"toy",   name:"つみき",         w:9,  kind:"toy"  },
    {id:"cake",  name:"おかしの かべ",  w:8,  kind:"cake" },
    {id:"tire",  name:"タイヤ",         w:6,  kind:"tire" },
    {id:"tower", name:"とうの かべ",    w:7,  kind:"tower"},
    {id:"car",   name:"くるまの かべ",  w:7,  kind:"car"  },
    {id:"big",   name:"でか ブロック",  w:10, kind:"block",hp:2, size:1.2, sizeFixed:true},
    {id:"fine",  name:"つぶつぶ",       w:10, kind:"block",size:0.8, sizeFixed:true},
    {id:"bomb",  name:"ぜんぶ ばくだん",w:5,  allBomb:true }
  ];
  // 1マスの大きさ抽選（範囲=targetH/Wは一定のまま、粒の大小だけ変える）。
  //  デカ(1.3/1.7)を約3割・つぶ(0.7)を約3割で出す＝ユーザー最重視の「大きさの変化」を毎壁効かせる。
  const SIZE_TABLE=[[0.8,3],[1.0,4],[1.15,2],[1.3,1]];
  function sizeLottery(){
    let t=0;for(const s of SIZE_TABLE)t+=s[1];
    let n=Math.random()*t;for(const s of SIZE_TABLE){n-=s[1];if(n<=0)return s[0];}
    return 1;
  }
  function pickRecipe(){
    // 最初の1壁だけは やさしい「ごちゃまぜ」で始める（すぐ楽しい）
    if(level<=1&&!curRecipe)return RECIPES[0];
    // 序盤(level<=3)は極端サイズ(big/fine)や当たり壁(bomb)を出さず、中くらいの壁で慣らす。
    //  ＝開始直後の1フレーム描画数が安定し、時間経過での偏りを防ぐ(変化は level4 以降で解禁)。
    const early=level<=3;
    let tot=0;for(const r of RECIPES){if(early&&(r.sizeFixed||r.allBomb))continue;tot+=r.w;}
    let n=Math.random()*tot;for(const r of RECIPES){if(early&&(r.sizeFixed||r.allBomb))continue;n-=r.w;if(n<=0)return r;}
    return RECIPES[0];
  }
  // 種類ごとの色（見た目の土台）
  function kindColor(kind){
    switch(kind){
      case"rock": return pick(["#8a8f99","#7c828d","#9aa0aa","#6f7580"]);
      case"ice":  return pick(["#9fe0ff","#bfeeff","#8fd4f5"]);
      case"crate":return pick(["#c98a4b","#b87a3d","#d69a5a"]);
      case"tire": return "#2b2f38";
      case"cake": return pick(["#ffd9e6","#ffe6b8","#ffc2d6","#fff0c8"]);
      case"toy":  return pick(COLORS);
      case"face": return pick(["#ffcf6a","#ff9ec2","#9ad6ff","#b7e88a","#ffb27a"]);
      case"tower":return pick(["#c9b28a","#b89a72","#d9c39c","#a8895f"]);
      case"car":  return pick(["#ff5a5a","#4ea8ff","#ffd23f","#5fd68a"]);
      default:    return pick(COLORS);
    }
  }
  // 種類×レシピ×ステージで硬さ(hp)を決める。ゴンゴン系(rock/crate)ほど多段。
  //  多段HPの発生率を底上げ(軸3): 連打だけでは崩れにくく、ながおしに意味を持たせる。
  function kindHp(kind,rec){
    if(rec.allBomb)return 1;
    if(rec.hp&&rec.kind===kind)return rec.hp;                  // でかブロック等
    if(kind==="rock") return stage>=2&&Math.random()<0.45?3:2; // いわ=ゴンゴン(stage2から・3段を4割→45%に)
    if(kind==="ice")  return rec.iceThick&&Math.random()<0.35?2:1;
    if(kind==="crate")return Math.random()<0.42?2:1;           // きばこの2段HPを3割→42%に
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
    else{api.tone(320,0.05,"square",0.18);}
  }
  // 破壊時の種類アクセント音（generic音に一味足すだけ・連射で重くしない）
  function kindAccent(kind){
    if(kind==="ice")api.noise(0.12,0.22,3800,"highpass",1);
    else if(kind==="rock")api.noise(0.14,0.2,300,"lowpass");
    else if(kind==="cake")api.tone(520,0.08,"sine",0.1);
    else if(kind==="tire")api.tone(120,0.1,"sine",0.12);
    else if(kind==="tower")api.noise(0.16,0.22,220,"lowpass");
    else if(kind==="car")api.tone(200,0.09,"square",0.14);
  }
  function layout(){
    groundY=api.H*0.84;
    const baseS=clamp(Math.floor(api.W/9),34,52);
    S=clamp(Math.round(baseS*sizeScale),24,88);
    wallX=Math.round(api.W*0.56);
    bricks.forEach(b=>{b.x=wallX+b.col*S;b.y=groundY-(b.row+1)*S;});
  }
  function newWall(){
    clearing=false;noBreak=0;
    // たまに「デカボス」を出す（最初の壁は出さない・連続もしない）。
    if(bossCooldown<=0&&level>1&&Math.random()<0.3){spawnBoss();return;}
    if(bossCooldown>0)bossCooldown--;
    // 前壁で予告したレシピを消費（無ければ抽選）→ 次壁の予告を先に決めておく。
    curRecipe=nextRecipe||pickRecipe();
    nextRecipe=pickRecipe();
    const rec=curRecipe;
    // 各壁へサイズ抽選: 意図した極端サイズ(big/fine)は固定、他は毎回ゆらぎ→「デカい/つぶつぶ」を出す。
    //  序盤(level<=3)は中くらいで固定＝開始直後の描画数を安定させる(序盤サンプルのブレ防止)。
    sizeScale=rec.sizeFixed?(rec.size||1):(level<=3?1:sizeLottery());
    theme=pickTheme();COLORS=theme.cols;
    bricks=[];layout();                       // sizeScaleを反映してからレイアウト
    // 縦横の範囲は一定に保ちつつ、1マスの大きさ(S)だけ変える→でか少数/こまか粒を同じ範囲で作り分け
    const baseS=clamp(Math.floor(api.W/9),34,52);
    const maxH=groundY-api.H*0.16;
    // 壁の大きさは level で変えず一定に保つ(=描画数が時間で右肩上がりに増えない)。
    //  難度の上げ幅は「1ステージあたりの壁数(wavesPerStage)」「ボス出現」「ステージ数」で表現。
    const L=2;
    const targetH=clamp((6+L)*baseS*0.9,baseS*5,maxH);
    let rows=clamp(Math.round(targetH/S),4,Math.max(4,Math.floor(maxH/S)));
    const targetW=clamp((2+L)*baseS,baseS*3,api.W-wallX-baseS*1.2);
    let cols=clamp(Math.round(targetW/S),2,7);
    // ブロック総数の帯を狭める(描画数を安定化): 上限32・下限26。
    //  「つぶつぶ」で跳ねないよう段を減らし、寂しい壁は物理限界まで段を足す。
    const maxRows=Math.max(4,Math.floor(maxH/S));
    while(rows*cols>29&&rows>4)rows--;
    while(rows*cols<24&&rows<maxRows)rows++;
    // とう(たて2マス)/くるま(よこ2マス)は形そのものが違う専用壁として組む(通常グリッドとは別枠)。
    if(rec.kind==="tower")buildTowerWall(rows,cols);
    else if(rec.kind==="car")buildCarWall(rows,cols);
    else for(let col=0;col<cols;col++)for(let row=0;row<rows;row++){
      const kind=rec.allBomb?"block":(rec.mixed?pick(KINDS):(rec.kind||"block"));
      const hp=kindHp(kind,rec);
      const b={col,row,x:wallX+col*S,y:groundY-(row+1)*S,kind,
        color:kindColor(kind),sh:1,tint:rnd(-0.06,0.06),hp,maxHp:hp,bomb:false,gold:false,react:0};
      if(kind==="face"){b.blink=rnd(0,160);b.bt=rnd(0,TAU);}
      bricks.push(b);
    }
    // 壁内サイズ混在: 細かめの壁に 2〜3個の でかいボス塊(2x2・hp高め)を混ぜ、
    //  1画面内で「1個の大きさ」の対比を作る（何度もゴンゴン→最後ドカンの手応えも兼ねる）。
    //  しきい値を1.05→1.3に緩和(size1.15/1.3の壁でも大小差が出る頻度UP)。塔/くるまは座標が2マス単位なので対象外。
    if(!rec.allBomb&&rec.kind!=="tower"&&rec.kind!=="car"&&sizeScale<=1.3&&cols>=2&&rows>=3)addBossBlocks(rows,cols);
    if(rec.allBomb){
      // 当たり壁: ぜんぶ ばくだん。1発当てると総ふっとび。硬さ/隠しは無し（純粋な爽快）。
      for(const b of bricks){b.bomb=true;b.kind="block";b.hp=1;b.maxHp=1;b.color="#ff3b6b";}
      announceBomb();
    }else{
      // 顔が無い壁には マスコットの顔を1つ仕込む（狙う的）。塔/くるまは形が違うので対象外。
      if(!bricks.some(b=>b.kind==="face")&&bricks.length&&rec.kind!=="tower"&&rec.kind!=="car"){
        const fb=bricks[Math.floor(bricks.length*0.6)]||bricks[bricks.length-1];
        fb.kind="face";fb.hp=1;fb.maxHp=1;fb.gold=false;
        fb.color=pick(["#ffcf6a","#ff9ec2","#9ad6ff","#b7e88a"]);fb.blink=rnd(0,160);fb.bt=rnd(0,TAU);
      }
      // ゴールド(発見): たまに1個が金→壊すと小ボーナス（気づくと得の小さな判定）
      if(Math.random()<0.5){
        const cand=bricks.filter(b=>!b.bomb&&b.hp<=1&&b.kind!=="face");
        if(cand.length)pick(cand).gold=true;
      }
    }
    // 出現の瞬間わくわく: テーマ名を大きくチラ見せ（allBombは専用告知が出ている）
    spawnTxt=rec.name;spawnTitle=rec.allBomb?0:80;
  }
  // でかいボス塊(2x2)を混ぜる: 4マス分を1個の大きな塊に置き換え(hp高め)。1画面に大小の対比を作る。
  //  boss=true / bs=2(描画・当たりの倍率)。col,rowは2x2の左上マスに合わせて格納しlayout互換。
  function addBossBlocks(rows,cols){
    if(cols<2||rows<3)return;
    const used=new Set();
    const n=Math.min(rint(2,3),Math.max(1,Math.floor(cols*rows/9)));
    let placed=0,tries=0;
    while(placed<n&&tries<24){
      tries++;
      const c=rint(0,cols-2),r=rint(0,rows-2);
      let ok=true;
      for(let dc=0;dc<2&&ok;dc++)for(let dr=0;dr<2;dr++)if(used.has((c+dc)+"_"+(r+dr))){ok=false;break;}
      if(!ok)continue;
      for(let dc=0;dc<2;dc++)for(let dr=0;dr<2;dr++)used.add((c+dc)+"_"+(r+dr));
      // 覆う4マスを取り除いてから、その位置に大きな塊を1個置く
      for(const cell of [[c,r],[c+1,r],[c,r+1],[c+1,r+1]]){
        const idx=bricks.findIndex(b=>b.col===cell[0]&&b.row===cell[1]&&!b.boss);
        if(idx>=0)bricks.splice(idx,1);
      }
      const bk=pick(["rock","block","crate"]);
      const hp=stage>=2?3:2;                        // ゴンゴン→最後ドカンの多段（ヒビが見える）。3段はステージ2から
      bricks.push({col:c,row:r+1,x:wallX+c*S,y:groundY-((r+1)+1)*S,kind:bk,
        color:kindColor(bk),sh:1,tint:rnd(-0.05,0.05),hp,maxHp:hp,bomb:false,gold:false,react:0,boss:true,bs:2});
      placed++;
    }
  }
  // とう: たて2マス分の建物。殴ると根元から倒れる『トップル』アニメ(destroyBrickのfallerで実装)。
  function buildTowerWall(rows,cols){
    const pairs=Math.max(1,Math.floor(rows/2));
    for(let col=0;col<cols;col++)for(let pr=0;pr<pairs;pr++){
      const r=pr*2,hp=1;
      bricks.push({col,row:r,x:wallX+col*S,y:groundY-(r+2)*S,kind:"tower",
        color:kindColor("tower"),sh:1,tint:rnd(-0.06,0.06),hp,maxHp:hp,bomb:false,gold:false,react:0,pw:S,ph:S*2});
    }
  }
  // くるま: よこ2マス分の乗り物。殴ると横に吹っ飛ぶアニメ(destroyBrickのfallerで実装)。
  function buildCarWall(rows,cols){
    const pairs=Math.max(1,Math.floor(cols/2));
    for(let row=0;row<rows;row++)for(let pc=0;pc<pairs;pc++){
      const c=pc*2,hp=1;
      bricks.push({col:c,row,x:wallX+c*S,y:groundY-(row+1)*S,kind:"car",
        color:kindColor("car"),sh:1,tint:rnd(-0.06,0.06),hp,maxHp:hp,bomb:false,gold:false,react:0,pw:S*2,ph:S});
    }
  }
  function announceBomb(){
    flash=Math.min(1,flash+0.4);
    floats(api.W/2,api.H*0.34,"ぜんぶ ばくだん！","#ffd23f");
    api.tone(660,0.1,"square",0.12);setTimeout(()=>api.tone(990,0.12,"square",0.1),90);
  }
  // ============ デカボス（大仏 / 怪獣 / ロボ） ==================================
  //  上から降下→着地→こぶしで多段HPをちょっとずつ削る→撃破で特大ドカン＋祝福。
  //  ボス中もオートで必ず当たる（狙わなくてもこぶしがボスへ向かう）＝5歳児でも詰まらない。
  const BOSS_TYPES=[
    {id:"daibutsu",name:"だいぶつ",  col:"#e8b84a",dark:"#a9822a"},
    {id:"kaiju",   name:"かいじゅう",col:"#6fca5a",dark:"#3f8f36"},
    {id:"robo",    name:"ロボ",      col:"#9fb0c4",dark:"#5f7185"}
  ];
  function spawnBoss(){
    const t=pick(BOSS_TYPES);
    const w=clamp(api.W*0.42,200,api.W*0.6),h=w*1.12;
    const hp=clamp(8+stage*2,9,17);                 // ステージが進むほど手応え(7〜8歳向けに約2割増・でも短め)
    boss={type:t,w,h,cx:wallX+S*1.2,y:-h-20,vy:0,landed:false,
      hp,maxHp:hp,react:0,hitFlash:0,seed:rint(0,999),blink:0,dying:false,dieT:0,mad:0};
    boss.cx=clamp(boss.cx,w*0.5+api.W*0.34,api.W-w*0.5-8);
    bossWarn=90;bossWarnTxt="ボスが くるぞ！";noBreak=0;
    flash=Math.min(1,flash+0.3);
    api.tone(180,0.18,"square",0.14);setTimeout(()=>api.tone(140,0.22,"square",0.14),140);
  }
  function bossImpactY(){return clamp(fist.y,boss.y+boss.h*0.2,boss.y+boss.h*0.85);}
  function hitBoss(charge){
    if(!boss||boss.dying)return;
    const dmg=1+(charge>0.72?1:0);
    boss.hp=Math.max(0,boss.hp-dmg);
    boss.react=1;boss.hitFlash=1;boss.mad=Math.min(1,boss.mad+0.18);
    count+=2*dmg;api.setScore(count);noBreak=0;
    combo++;comboTimer=120;if(combo>bestCombo)bestCombo=combo;
    fist.sx=1.45;fist.sy=0.6;
    const ix=boss.cx-boss.w*0.28,iy=bossImpactY();
    // “ちょっとずつ壊れる”手応え: 欠片＋火花＋リング＋こぶし側シェイク
    for(let i=rint(3,5);i>0;i--){const sz=rnd(S*0.18,S*0.4);
      shards.push({x:ix+rnd(-S,S),y:iy+rnd(-S,S),vx:rnd(-9,3)*(1+charge),vy:rnd(-11,-2)*(1+charge*0.5),
        s:sz,w:sz*rnd(0.7,1.3),color:boss.type.dark,depth:rnd(0.25,0.6),
        rot:rnd(0,TAU),vr:rnd(-0.5,0.5),spin:1,life:1,decay:rnd(0.022,0.036)});}
    for(let i=rint(3,5);i>0;i--)sparks.push({x:ix,y:iy,vx:rnd(-7,7),vy:rnd(-9,2),life:1,decay:rnd(0.04,0.07),
      col:pick(["#ffffff","#fff3c4","#ffd23f","#ffae5e"])});
    rings.push({x:ix,y:iy,r:S*0.5,vr:S*0.9,life:1,decay:0.05,w:5});
    dust.push({x:ix,y:iy,r:rnd(S*0.4,S*0.7),vr:rnd(0.9,1.6),life:1,decay:0.02,hue:rnd(0,1)});
    flash=Math.min(1,0.4+charge*0.4);api.shake(9+charge*12);
    if(boss.type.id==="robo"){api.tone(200,0.08,"square",0.12);api.noise(0.07,0.16,900,"bandpass");}
    else if(boss.type.id==="kaiju"){api.tone(240,0.09,"sawtooth",0.12);api.noise(0.08,0.18,600,"lowpass");}
    else{api.tone(300,0.08,"sine",0.14);api.noise(0.08,0.2,400,"lowpass");}
    api.slide(160,80,0.1,0.18,"square");
    // 節目ごとにドカッと（多段の“ゴンゴン→ドカン”）
    if(combo>0&&combo%5===0){wash=Math.min(1,0.5);washCol=comboCol();api.boom(0.4);api.shake(14);
      floats(api.W*0.32,api.H*0.32,combo+" COMBO!",comboCol());tryHitStop(4);}
    else if(charge>0.75||dmg>=2)tryHitStop(3);
    if(boss.hp<=0)killBoss();
  }
  function killBoss(){
    boss.dying=true;boss.dieT=0;
    wash=1;washCol=boss.type.col;finale=1;
    api.boom(0.85);api.shake(38);tryHitStop(5);
    api.slide(520,1100,0.2,0.32,"square");api.tone(920,0.18,"triangle",0.22);
    const cx=boss.cx,cy=boss.y+boss.h*0.5;
    for(let i=0;i<18;i++){const sz=rnd(S*0.2,S*0.55);
      shards.push({x:cx+rnd(-boss.w*0.4,boss.w*0.4),y:cy+rnd(-boss.h*0.4,boss.h*0.4),
        vx:rnd(-14,14),vy:rnd(-16,-2),s:sz,w:sz*rnd(0.7,1.3),color:i%2?boss.type.col:boss.type.dark,
        depth:rnd(0.25,0.6),rot:rnd(0,TAU),vr:rnd(-0.6,0.6),spin:1,life:1,decay:rnd(0.016,0.026)});}
    for(let i=0;i<5;i++)rings.push({x:cx,y:cy,r:S*0.6,vr:S*(1.4+rnd(0,0.9)),life:1,decay:0.03,w:9});
    for(let i=0;i<16;i++)sparks.push({x:cx,y:cy,vx:rnd(-12,12),vy:rnd(-13,3),life:1,decay:rnd(0.03,0.06),
      col:pick(["#fff","#ffd23f","#ff8f6b","#fff3c4"])});
    count+=20;api.setScore(count);
    floats(api.W/2,api.H*0.28,"ドッカーン！","#ffd23f");
    floats(api.W/2,api.H*0.42,"ボス げきは！","#fff");
    setTimeout(()=>{boss=null;bossCooldown=1;proceedNext();},600);
  }
  // 壁クリア/ボス撃破の共通の“次へ進む”処理（wave/stage を進める）
  function proceedNext(){
    level++;
    if(wave<wavesPerStage){
      wave++;floats(api.W/2,api.H*0.4,"つぎは "+(nextRecipe?nextRecipe.name:"？")+"！","#fff");
      setTimeout(newWall,60);
    }else{clearStage();}
  }
  // 詰み撲滅: 一定時間 前進が無ければ 残りを自動で崩して必ず先へ進める。
  function autoCrumble(){
    if(boss&&boss.landed&&!boss.dying){
      // ボス: 自動でちょっと削る（放置でも必ず倒れる）
      boss.hp=Math.max(0,boss.hp-1);boss.react=1;boss.hitFlash=1;
      const ix=boss.cx-boss.w*0.2,iy=boss.y+boss.h*0.5;
      for(let i=rint(4,6);i>0;i--)sparks.push({x:ix,y:iy,vx:rnd(-6,6),vy:rnd(-8,1),life:1,decay:0.05,col:"#fff3c4"});
      rings.push({x:ix,y:iy,r:S*0.4,vr:S*0.8,life:1,decay:0.05,w:4});
      api.shake(6);noBreak=STUCK-40;                // 少し待ってまた削る
      if(boss.hp<=0)killBoss();
      return;
    }
    if(bricks.length){
      // 壁: 全ブロックを1発で崩せる状態にし、前列から数個を自動で破壊。数フレーム後にまた発火して必ず全滅。
      for(const b of bricks){b.hp=1;b.maxHp=1;}
      const sorted=bricks.slice().sort((a,b)=>(a.x-b.x)||(a.y-b.y));
      const n=Math.min(7,sorted.length);   // かたい壁が増えた分、1回の自動崩しで進む量を少し増やす(大きい壁でも早く抜ける)
      for(let i=0;i<n;i++){const b=sorted[i];if(bricks.indexOf(b)>=0)destroyBrick(b,1.2);}
      count+=n;api.setScore(count);api.shake(8);flash=Math.min(1,flash+0.2);
      floats(api.W*0.5,api.H*0.3,"じどうで ドカン！","#ffd23f");
      noBreak=bricks.length?STUCK-40:0;             // 残ってればすぐ再発火
      if(bricks.length===0&&!clearing){
        clearing=true;wash=1;washCol=theme?theme.cols[0]:"#ffd23f";api.boom(0.6);api.shake(18);
        proceedNext();
      }
    }
  }
  fist={x:0,y:0,state:"idle",charge:0,t:0,sx:1,sy:1,tx:0};
  let pressed=false;
  function resetFist(){fist.x=api.W*0.12;if(!aimY)aimY=groundY-S*3;fist.y=aimY;fist.state="idle";fist.charge=0;fist.t=0;fist.sx=1;fist.sy=1;}
  function clampAimY(py){return clamp(py,api.H*0.16,groundY-S*0.5);}
  // front face of the remaining wall: the punch always lands on whatever is left,
  // so kids never get stuck once the first column is gone (auto-advance aim)
  function faceX(){if(boss)return boss.cx-boss.w*0.42;let m=Infinity;for(const b of bricks)if(b.x<m)m=b.x;return m===Infinity?wallX:m;}
  function destroyBrick(b,force){
    const bw=b.pw||S*(b.bs||1),bh=b.ph||S*(b.bs||1),SS=Math.max(bw,bh),cx=b.x+bw/2,cy=b.y+bh/2,
      f=(force||1)*(b.boss?1.4:1),sc=shardCol(b),ice=b.kind==="ice";
    // かおは まわりの かおが びっくり（react）＝反応が伝播する
    if(b.kind==="face")for(const o of bricks){if(o.kind==="face"&&o!==b&&Math.hypot(o.x-b.x,o.y-b.y)<=S*1.7)o.react=1;}
    // ボス塊は でかいぶん だけ ドカンと大きく崩れる（欠片・リング増し）
    if(b.boss){rings.push({x:cx,y:cy,r:SS*0.4,vr:SS*1.1,life:1,decay:0.04,w:8});
      dust.push({x:cx,y:cy,r:rnd(SS*0.5,SS*0.8),vr:rnd(1.2,2),life:1,decay:0.016,hue:rnd(0,1)});}
    // 壊れ方の違い(軸7): rock/tire/crate/tower/car は破片一本槍をやめ、専用のトップル/転がり/へこみアニメを追加で出す。
    //  その分だけ通常の破片は少なめにして描画量を揃える(節度を維持)。
    const special=!b.boss&&(b.kind==="rock"||b.kind==="tire"||b.kind==="crate"||b.kind==="tower"||b.kind==="car");
    if(special)addFaller(b,bw,bh);
    // chunky 3D fragments: each carries a face shade + depth for a tumbling, blocky look
    //  数控えめ＋速く消える(短命)→連打しても破片が溜まって描画が増え続けない。
    for(let i=(special?rint(1,2):rint(2,4))+(b.boss?2:0);i>0;i--){
      const sz=rnd(SS*0.16,SS*0.40);
      shards.push({x:b.x+rnd(2,bw),y:b.y+rnd(2,bh),
        vx:rnd(1,10)*f*(Math.random()<0.5?-0.35:1),vy:rnd(-11,-2)*f,
        s:sz,w:sz*rnd(0.7,1.3),color:sc,depth:rnd(0.25,0.6),
        rot:rnd(0,TAU),vr:rnd(-0.55,0.55),spin:rnd(0.6,1.0),
        life:1,decay:rnd(0.017,0.026)});
    }
    // one heavy core chunk for visual weight（約0.7〜1秒で消える）。専用アニメがある種類は省く。
    if(!special)shards.push({x:cx,y:cy,vx:rnd(-4,4)*f,vy:rnd(-7,-3)*f,
      s:rnd(S*0.42,S*0.58),w:rnd(S*0.42,S*0.58),color:sc,depth:0.62,
      rot:rnd(0,TAU),vr:rnd(-0.3,0.3),spin:1,life:1,decay:0.02});
    // hot embers / sparks (数控えめ・速く消える)
    for(let i=rint(2,4);i>0;i--)sparks.push({x:cx,y:cy,
      vx:rnd(-7,7)*f,vy:rnd(-10,2)*f,life:1,decay:rnd(0.09,0.14),
      col:ice?pick(["#ffffff","#cdefff","#a8e0ff"]):pick(["#ffffff","#fff3c4","#ffd23f","#ffae5e","#ff8f6b"])});
    // warm dust puff + a quick bloom flare at the break point（控えめ・短命）
    dust.push({x:cx,y:cy,r:rnd(S*0.4,S*0.7),vr:rnd(0.8,1.6),life:1,decay:0.024,hue:rnd(0,1)});
    sparks.push({x:cx,y:cy,vx:0,vy:0,life:1,decay:0.16,bloom:rnd(S*1.0,S*1.5),col:ice?"#e0f6ff":"#fff7e0"});
    bricks.splice(bricks.indexOf(b),1);
  }
  // 壊れ方の違い(軸7): 種類ごとに崩壊アニメを差し替える。上限つきの独立配列(fallers)で60fps安全を維持。
  function addFaller(b,w,h){
    if(fallers.length>=6)fallers.splice(0,fallers.length-5);
    const dir=Math.random()<0.5?-1:1;
    if(b.kind==="rock"){
      // いわ: 根元を軸に横に『倒れる』
      fallers.push({kind:"rock",x:b.x,y:b.y,S:Math.max(w,h),color:b.color,rot:0,vr:dir*0.09,life:1,decay:0.014});
    }else if(b.kind==="tire"){
      // タイヤ: 勢いよく『転がって』画面外へ
      fallers.push({kind:"tire",x:b.x,y:b.y,S:Math.max(w,h),vx:dir*rnd(6,10),vy:-rnd(2,5),rot:0,vr:dir*0.5,life:1,decay:0.014});
    }else if(b.kind==="crate"){
      // きばこ: y方向スケールを潰して『へこむ』
      fallers.push({kind:"crate",x:b.x,y:b.y,S:Math.max(w,h),color:b.color,sq:1,life:1,decay:0.03});
    }else if(b.kind==="tower"){
      // とう: 根元から大きく『トップル』
      fallers.push({kind:"tower",x:b.x,y:b.y,w,h,color:b.color,rot:0,vr:dir*0.055,life:1,decay:0.012});
    }else if(b.kind==="car"){
      // くるま: 横に大きく『吹っ飛ぶ』
      fallers.push({kind:"car",x:b.x,y:b.y,w,h,vx:dir*rnd(9,14),vy:-rnd(3,6),rot:0,vr:dir*0.35,color:b.color,life:1,decay:0.016});
    }
  }
  // ゴールド解放(発見): 金火花＋上昇音＋小ボーナス
  function rewardGold(x,y){
    const bonus=8;count+=bonus;api.setScore(count);
    for(let k=0;k<6;k++)sparks.push({x,y,vx:rnd(-6,6),vy:rnd(-8,1),life:1,decay:rnd(0.03,0.05),col:pick(["#ffe14a","#fff2a0","#ffb03a"])});
    rings.push({x,y,r:S*0.4,vr:S*0.7,life:1,decay:0.05,w:5});
    flash=Math.min(1,flash+0.4);wash=Math.min(1,wash+0.3);washCol="#ffe14a";
    floats(x,y-20,"きんピカ！ +"+bonus,"#ffe14a");
    api.slide(880,1760,0.22,0.16,"triangle");tryHitStop(3);
  }
  // 当たり壁「ぜんぶ ばくだん」: 1発で総ふっとび。派手だが破片は総量を抑えて60fps維持。
  function blowUpWall(charge){
    const n=bricks.length;count+=n;api.setScore(count);
    const per=clamp(Math.floor(150/Math.max(1,n)),1,4);
    for(const b of bricks){
      const cx=b.x+S/2,cy=b.y+S/2;
      for(let i=0;i<per;i++){const sz=rnd(S*0.18,S*0.42);
        shards.push({x:cx,y:cy,vx:rnd(-12,12),vy:rnd(-14,-2),s:sz,w:sz*rnd(0.7,1.3),
          color:pick(["#ff3b6b","#ff8f5b","#ffd23f"]),depth:rnd(0.25,0.6),
          rot:rnd(0,TAU),vr:rnd(-0.6,0.6),spin:1,life:1,decay:rnd(0.02,0.032)});}
      if(Math.random()<0.3)sparks.push({x:cx,y:cy,vx:rnd(-8,8),vy:rnd(-10,2),life:1,decay:rnd(0.03,0.06),col:pick(["#fff","#ffd23f","#ff8f6b"])});
    }
    bricks=[];
    wash=1;washCol="#ff3b6b";api.boom(0.7);api.shake(30);tryHitStop(4);
    api.slide(520,1100,0.18,0.3,"square");api.tone(880,0.14,"triangle",0.2);
    rings.push({x:wallX+S,y:fist.y,r:S,vr:S*1.6,life:1,decay:0.03,w:10});
    flash=Math.min(1,flash+0.7);
    floats(api.W/2,api.H*0.34,"ドッカーン！","#ffd23f");
  }
  function punch(){
    const charge=fist.charge;
    api.slide(150-charge*60,40,0.3+charge*0.5,0.5+charge*0.3,"sine");
    api.noise(0.25+charge*0.3,0.4,900,"lowpass");
    api.shake(8+charge*26);
    // デカボスがいる時はボスを殴る（オートで必ず当たる）
    if(boss&&!boss.dying){if(boss.landed||boss.y+boss.h>groundY-S)hitBoss(charge);return;}
    // impact lands on the centre of the frontmost remaining column (auto-advance)
    let ix=bricks.length?faceX()+S*0.5:wallX, iy=fist.y;
    const R=lerp(S*1.1,S*3.6,charge);
    // オートエイム(軸3で調整): 完全な必中ではなく「近ければ吸着/ちょっと外れたら弱いかすり/大きく外れたら素通り」の3段に。
    //  詰み防止(自動崩し)は別のガード(noBreak/autoCrumble)が担うので、1発ごとの空振りは許容してよい。
    let grazed=false;
    if(bricks.length){
      const fx=faceX();let tgt=null,md=Infinity,th=S;
      for(const b of bricks){if(b.x<=fx+S*0.5+1){th=b.ph||S;const d=Math.abs(b.y+th/2-iy);if(d<md){md=d;tgt=b;}}}
      if(tgt){
        const th2=tgt.ph||S;
        if(md<=R*0.4)iy=tgt.y+th2/2;          // ねらいが近い→ちゃんと吸着(狙った通りに当たる)
        else if(md<=R*0.6)grazed=true;        // 少し外れた→吸着なし＋当たり判定を弱める『かすり』
        // md>R*0.6 は完全に外れ扱い(吸着なし)。狙いの意味を残す(軸3: 吸着範囲を絞って狙いをより問う・2026-09-22さらに強化)。
      }
    }
    const effR=grazed?R*0.8:R;
    const inRange=bricks.filter(b=>{const bw=b.pw||S*(b.bs||1),bh=b.ph||S*(b.bs||1);
      return Math.hypot(b.x+bw/2-ix,b.y+bh/2-iy)<=effR;});
    if(curRecipe&&curRecipe.allBomb&&inRange.length){
      // 当たり壁: 1発で総ふっとび
      combo++;comboTimer=120;if(combo>bestCombo)bestCombo=combo;
      fist.sx=1.5;fist.sy=0.55;
      blowUpWall(charge);
    }else{
      // hard bricks take a hit (crack + clink) instead of breaking on the first punch
      let broke=0,chipped=false,chipKind=null,brokeKind=null,goldHit=false;
      inRange.forEach(b=>{
        // ながおしに意味を持たせる(軸3): 低ため打ち(charge<0.3)は種類を問わず威力半分＝連打だけでは崩れにくい。
        const dmg=(charge<0.3)?0.5:1;
        if(b.hp-dmg>0.001){b.hp-=dmg;b.react=1;chipped=true;chipKind=b.kind;
          sparks.push({x:b.x+(b.pw||S)/2,y:b.y+(b.ph||S)/2,vx:rnd(-3,3),vy:rnd(-4,0),life:1,decay:0.08,col:b.kind==="ice"?"#cdefff":"#fff"});}
        else{if(b.gold)goldHit=true;brokeKind=b.kind;destroyBrick(b,1+charge*1.5);broke++;}
      });
      if(chipped){chipSound(chipKind);api.shake(5);flash=Math.min(0.6,flash+0.1);}
      count+=broke;api.setScore(count);
      if(broke||chipped)noBreak=0;               // 前進あり→詰みガードのカウンタをリセット
      // combo: any punch that broke at least one brick extends the chain
      if(broke){
        combo++;comboTimer=120;if(combo>bestCombo)bestCombo=combo;
        const cf=Math.min(combo/12,1);
        flash=Math.min(0.6,0.28+charge*0.28+cf*0.18);
        fist.sx=1.45;fist.sy=0.6;
        rings.push({x:ix,y:iy,r:S*0.6,vr:charge>0.7?S*0.9:S*0.6,life:1,decay:0.05,w:charge>0.7?7:4});
        api.tone(140+combo*8,0.08,"triangle",0.25);
        if(brokeKind)kindAccent(brokeKind);
        if(charge>0.75||broke>=3)tryHitStop(broke>=3?4:3);
        // combo milestones: bigger boom + wash flash + shout the further you go
        if(combo>0&&combo%5===0){
          wash=Math.min(1,0.4+cf*0.6);washCol=comboCol();
          api.boom(clamp(0.35+cf*0.35,0,0.7));api.shake(10+combo);
          api.slide(440+combo*20,880+combo*20,0.14,0.28,"square");
          floats(api.W*0.32,api.H*0.34,combo+" COMBO!",comboCol());
          tryHitStop(4);
        }
      }
      if(goldHit)rewardGold(ix,iy);
      if(charge>0.92&&broke)floats(ix,iy,"PERFECT!","#ffd23f");
    }
    if(bricks.length===0&&!boss&&!clearing){
      clearing=true;
      // big-finish: full-screen colour wash + cheer + extra ring when a wall is cleared
      wash=1;washCol=theme?theme.cols[0]:"#ffd23f";
      api.shake(22);api.tone(660,0.12,"triangle",0.22);api.slide(660,990,0.12,0.3,"sine");api.boom(0.6);
      rings.push({x:wallX,y:fist.y,r:S*0.8,vr:S*1.4,life:1,decay:0.03,w:9});
      proceedNext();
    }
  }
  function clearStage(){
    const isFinal=stage>=FINAL_STAGE;
    // celebratory burst of shards/rings across the screen
    for(let i=0;i<(isFinal?5:3);i++){
      rings.push({x:rnd(api.W*0.3,api.W*0.8),y:rnd(api.H*0.25,api.H*0.6),r:S*0.5,vr:S*(1.2+rnd(0,0.8)),life:1,decay:0.025,w:8});
    }
    api.boom(isFinal?0.7:0.6);api.shake(isFinal?34:24);
    api.slide(520,1100,0.18,0.3,"square");api.tone(880,0.16,"triangle",0.22);
    if(isFinal){
      // FINAL STAGE conquered -> full-screen celebration, show records, then loop into endless (stages keep counting up)
      finale=1;wash=1;washCol="#ffd23f";
      floats(api.W/2,api.H*0.30,"ぜんステージ クリア！","#ffd23f");
      floats(api.W/2,api.H*0.46,"こわした かず "+count,"#fff");
      floats(api.W/2,api.H*0.58,"さいこう コンボ "+bestCombo,"#aef0ff");
      stageBanner=200;stageBannerTxt="ALL CLEAR!";
      stage++;wave=1;wavesPerStage=Math.min(wavesPerStage+1,4);
      setTimeout(newWall,1100);
    }else{
      stage++;wave=1;
      // gentle ramp: stage1=1 wall, then +1 wall per stage up to 4 (7〜8歳向けに1壁ぶん手応えを足した)
      wavesPerStage=Math.min(wavesPerStage+1,4);
      stageBanner=140;stageBannerTxt="ステージ "+(stage-1)+" クリア！";
      floats(api.W/2,api.H*0.30,"すごい！","#aef0ff");
      floats(api.W/2,api.H*0.42,"つぎは "+(nextRecipe?nextRecipe.name:"？")+"！","#fff");
      setTimeout(newWall,110);
    }
  }
  let fl=[];
  function floats(x,y,txt,col){fl.push({x,y,txt,col,life:1,vy:-1.2,size:40});if(fl.length>8)fl.splice(0,fl.length-8);}
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function starShape(rad){g.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+i*TAU/5;g.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);const a2=a+TAU/10;g.lineTo(Math.cos(a2)*rad*0.45,Math.sin(a2)*rad*0.45);}g.closePath();}
  function shade(hex,amt){
    const n=parseInt(hex.slice(1),16);
    let r=(n>>16)&255,gg=(n>>8)&255,b=n&255;
    r=clamp(Math.round(r+255*amt),0,255);gg=clamp(Math.round(gg+255*amt),0,255);b=clamp(Math.round(b+255*amt),0,255);
    return "rgb("+r+","+gg+","+b+")";
  }
  function initAmbient(){
    clouds=[];for(let i=0;i<5;i++)clouds.push({x:rnd(0,api.W),y:rnd(api.H*0.08,api.H*0.4),s:rnd(0.5,1.2),sp:rnd(0.06,0.16)});
    motes=[];for(let i=0;i<6;i++)motes.push({x:rnd(0,api.W),y:rnd(0,groundY),r:rnd(1,3),sp:rnd(0.15,0.5),ph:rnd(0,TAU),drift:rnd(-0.2,0.2)});
  }
  newWall();resetFist();initAmbient();
  return{
    resize(){layout();initAmbient();},
    input(px,py,type){
      // aim: where you press (vertically) is where the fist will punch -> choose top/bottom/edges of the wall
      if(type==="down"){pressed=true;aimY=clampAimY(py);if(fist.state==="idle"){fist.y=aimY;fist.state="charging";fist.charge=0;}}
      else if(type==="move"){if(fist.state==="charging"){aimY=clampAimY(py);}}
      else if(type==="up"){pressed=false;if(fist.state==="charging"){aimY=clampAimY(py);fist.y=aimY;fist.state="punch";fist.t=0;fist.tx=faceX()-S*0.8;}}
    },
    frame(dt,now){
      tnow+=dt;
      if(hsCD>0)hsCD-=dt;
      if(spawnTitle>0)spawnTitle-=dt;
      // combo decays if you wait too long between hits (forgiving window for 5yo)
      if(combo>0){comboTimer-=dt;if(comboTimer<=0)combo=0;}
      if(stageBanner>0)stageBanner-=dt;
      if(bossWarn>0)bossWarn-=dt;
      if(finale>0)finale=Math.max(0,finale-0.03*dt);
      // ---- デカボス更新（降下→着地→反応/撃破アニメ） ----
      if(boss){
        if(boss.hitFlash>0)boss.hitFlash=Math.max(0,boss.hitFlash-0.08*dt);
        if(boss.react>0)boss.react=Math.max(0,boss.react-0.05*dt);
        boss.blink=(boss.blink||0)-1;if(boss.blink<-40)boss.blink=rnd(60,200);
        if(!boss.landed){
          boss.vy+=0.9*dt;boss.y+=boss.vy*dt;
          if(boss.y+boss.h>=groundY-4){
            boss.y=groundY-4-boss.h;boss.landed=true;boss.vy=0;
            api.boom(0.6);api.shake(26);tryHitStop(3);
            for(let i=0;i<10;i++)dust.push({x:boss.cx+rnd(-boss.w*0.5,boss.w*0.5),y:groundY-6,
              r:rnd(S*0.5,S*0.9),vr:rnd(1,2),life:1,decay:0.018,hue:rnd(0,1)});
            rings.push({x:boss.cx,y:groundY-6,r:S,vr:S*1.6,life:1,decay:0.03,w:8});
            floats(api.W/2,api.H*0.24,boss.type.name+"が おりた！","#fff");noBreak=0;
          }
        }
        if(boss.dying){boss.dieT+=0.04*dt;boss.y+=2*dt;}
      }
      // ---- 詰み撲滅ガード: 前進が無いまま一定時間経過→残りを自動で崩す ----
      const prog=bricks.length+(boss&&!boss.dying?boss.hp:0);
      if(prog<lastProg||count>lastCount)noBreak=0;
      lastProg=prog;lastCount=count;
      const hasTarget=bricks.length>0||(boss&&boss.landed&&!boss.dying);
      if(hasTarget&&!clearing){noBreak+=dt;if(noBreak>STUCK)autoCrumble();}
      else noBreak=0;
      // particle caps (60fps安全 + 積み上がり防止): 上限を超えたら古いものから捨てる。
      //  連打でも描画数が右肩上がりに増えないよう、寿命(decay)を短め＋上限を低めに保つ。
      if(shards.length>20)shards.splice(0,shards.length-20);
      if(sparks.length>14)sparks.splice(0,sparks.length-14);
      if(dust.length>14)dust.splice(0,dust.length-14);
      if(rings.length>8)rings.splice(0,rings.length-8);
      if(fallers.length>6)fallers.splice(0,fallers.length-6);
      // bg: 画像背景(夕焼けの解体場)があればそれを使い、ステージのテーマ色を薄く重ねる。
      //  無ければ従来の手描き(空グラデ/太陽/雲/星/地面)へフォールバック。
      let imgBg=false;
      if(api.drawCover("bg.jpg")){imgBg=true;
        if(theme&&theme.name!=="brick"){g.save();g.globalAlpha=0.16;g.fillStyle=theme.cols[0];g.fillRect(0,0,api.W,api.H);g.restore();}
      }else{
        let grd=g.createLinearGradient(0,0,0,groundY);
        grd.addColorStop(0,"#5a3a7a");grd.addColorStop(0.45,"#a05a8a");grd.addColorStop(1,"#f0a86a");
        g.fillStyle=grd;g.fillRect(0,0,api.W,groundY);
        // soft sun glow behind the wall
        const sx=wallX+S*1.5,sy=groundY*0.38;
        let sun=g.createRadialGradient(sx,sy,0,sx,sy,api.W*0.45);
        sun.addColorStop(0,"rgba(255,236,180,.5)");sun.addColorStop(0.5,"rgba(255,200,140,.15)");sun.addColorStop(1,"rgba(255,200,140,0)");
        g.fillStyle=sun;g.fillRect(0,0,api.W,groundY);
      }
      // drifting soft clouds (ambient parallax) ※画像背景のときは絵の雲を活かして描かない
      if(!imgBg)for(const c of clouds){c.x+=c.sp*dt;if(c.x>api.W+80*c.s)c.x=-80*c.s;
        const cw=70*c.s,ch=26*c.s;g.globalAlpha=0.16;g.fillStyle="#fff";
        g.beginPath();g.ellipse(c.x,c.y,cw,ch,0,0,TAU);g.ellipse(c.x+cw*0.6,c.y+ch*0.2,cw*0.7,ch*0.8,0,0,TAU);g.ellipse(c.x-cw*0.55,c.y+ch*0.25,cw*0.6,ch*0.7,0,0,TAU);g.fill();}
      g.globalAlpha=1;
      // floating glowing motes (always-on life)
      g.globalCompositeOperation="lighter";
      for(const m of motes){m.y-=m.sp*dt;m.x+=m.drift*dt;if(m.y<-4){m.y=groundY;m.x=rnd(0,api.W);}
        const tw=0.3+0.3*(0.5+0.5*Math.sin(tnow*0.05+m.ph));g.globalAlpha=tw*0.5;
        let mg=g.createRadialGradient(m.x,m.y,0,m.x,m.y,m.r*3);
        mg.addColorStop(0,"rgba(255,240,200,.9)");mg.addColorStop(1,"rgba(255,220,160,0)");
        g.fillStyle=mg;g.beginPath();g.arc(m.x,m.y,m.r*3,0,TAU);g.fill();}
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
      // twinkle stars in the upper sky ※画像背景のときは絵の星に任せる
      if(!imgBg){g.fillStyle="#fff";
        for(let i=0;i<14;i++){
          const tx=(i*97)%api.W, ty=(i*53)%Math.floor(groundY*0.4)+8;
          const tw=0.25+0.35*(0.5+0.5*Math.sin(tnow*0.06+i));
          g.globalAlpha=tw;const ts=1+tw*1.6;g.fillRect(tx,ty,ts,ts);
        }
        g.globalAlpha=1;}
      // ground
      if(imgBg){
        // 画像背景: 破片が跳ねる床の位置だけ分かるよう、薄い影の帯と細い線にとどめる(絵の地面を活かす)
        let gg=g.createLinearGradient(0,groundY,0,api.H);gg.addColorStop(0,"rgba(20,10,30,.22)");gg.addColorStop(1,"rgba(20,10,30,.42)");
        g.fillStyle=gg;g.fillRect(0,groundY,api.W,api.H-groundY);
        g.fillStyle="rgba(255,255,255,.14)";g.fillRect(0,groundY,api.W,2);
      }else{
        let gg=g.createLinearGradient(0,groundY,0,api.H);gg.addColorStop(0,"#3a2a44");gg.addColorStop(1,"#1c1424");
        g.fillStyle=gg;g.fillRect(0,groundY,api.W,api.H-groundY);
        g.fillStyle="#6a4a72";g.fillRect(0,groundY,api.W,4);
        g.fillStyle="rgba(255,255,255,.12)";g.fillRect(0,groundY,api.W,2);
      }
      // dust (soft warm puffs)
      for(const d of dust){d.r+=d.vr*dt;d.life-=d.decay*dt;
        const a=Math.max(0,d.life);g.globalAlpha=a*0.5;
        let dg=g.createRadialGradient(d.x,d.y,0,d.x,d.y,d.r);
        dg.addColorStop(0,"rgba(240,224,196,.9)");dg.addColorStop(1,"rgba(216,196,168,0)");
        g.fillStyle=dg;g.beginPath();g.arc(d.x,d.y,d.r,0,TAU);g.fill();}
      g.globalAlpha=1;dust=dust.filter(d=>d.life>0);
      // shockwave rings
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.globalAlpha=Math.max(0,ri.life)*0.8;g.strokeStyle="#fff7d6";g.lineWidth=ri.w*ri.life;
        g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();}
      g.globalAlpha=1;rings=rings.filter(r=>r.life>0);
      // aim guide: a soft target line at the chosen height so kids see WHERE the punch will land
      if(fist.state==="idle"||fist.state==="charging"){
        const ay=fist.y;g.save();
        g.globalAlpha=0.25+0.15*Math.sin(tnow*0.14);g.strokeStyle="#fff7d6";g.lineWidth=3;
        g.setLineDash([8,8]);g.beginPath();g.moveTo(fist.x+S,ay);g.lineTo(wallX+S*5,ay);g.stroke();
        g.setLineDash([]);
        // little chevron target on the wall
        g.globalAlpha=0.5+0.2*Math.sin(tnow*0.18);g.fillStyle="#ffd23f";
        g.beginPath();g.moveTo(wallX-S*0.5,ay);g.lineTo(wallX-S*0.9,ay-S*0.22);g.lineTo(wallX-S*0.9,ay+S*0.22);g.closePath();g.fill();
        g.restore();g.globalAlpha=1;
      }
      // bricks (種類ごとに描き分け。react=たたかれた反応でぷにっと変形)
      for(const b of bricks){
        if(b.sh<1)b.sh=Math.min(1,b.sh+0.12*dt);
        if(b.react>0)b.react=Math.max(0,b.react-0.06*dt);
        // ボス塊は 2x2 の大きさで描く（Sを一時的に拡大→即復帰。描画のみ）
        if(b.bs&&b.bs!==1){const oS=S;S=oS*b.bs;drawPiece(b);S=oS;}
        else drawPiece(b);
      }
      if(boss)drawBoss(boss);
      // fist logic
      if(fist.state==="charging"){fist.charge=Math.min(1,fist.charge+0.018*dt);
        fist.x=lerp(fist.x,api.W*0.12-fist.charge*40,0.2);
        fist.y=lerp(fist.y,aimY,0.25*dt);
        if(Math.random()<0.04+fist.charge*0.1)api.tone(200+fist.charge*400,0.05,"square",0.05);
        // gathering energy sparks toward the fist
        if(Math.random()<0.3+fist.charge*0.5){const ang=rnd(0,TAU),rr=S*(1.6+rnd(0,1.4));
          sparks.push({x:fist.x+Math.cos(ang)*rr,y:fist.y+Math.sin(ang)*rr,
            vx:-Math.cos(ang)*rnd(3,6),vy:-Math.sin(ang)*rnd(3,6),life:1,decay:rnd(0.05,0.09),
            col:fist.charge>0.9?"#ff8f6b":"#ffe08a"});}}
      else if(fist.state==="punch"){fist.t+=0.22*dt;fist.x=lerp(api.W*0.12-fist.charge*40,fist.tx||wallX-S*0.8,ease(Math.min(fist.t,1)));
        fist.sx=lerp(1,1.3,Math.min(fist.t,1));fist.sy=lerp(1,0.85,Math.min(fist.t,1));
        if(fist.t>=1){punch();fist.state="return";fist.t=0;}}
      else if(fist.state==="return"){fist.t+=0.1*dt;fist.x=lerp(fist.tx||wallX-S*0.8,api.W*0.12,ease(Math.min(fist.t,1)));
        fist.sx=lerp(fist.sx,1,0.18*dt);fist.sy=lerp(fist.sy,1,0.18*dt);
        // buffered input: if the finger is still (or was) held during the return,
        // roll straight into charging so mashing/holding never gets eaten
        if(fist.t>=1){resetFist();if(pressed){fist.y=aimY;fist.state="charging";fist.charge=0;}}}
      else{fist.sx=lerp(fist.sx,1,0.2*dt);fist.sy=lerp(fist.sy,1,0.2*dt);}
      drawFist(fist);
      // shards (chunky, tumbling, lit faces for a 3D feel)
      for(const p of shards){p.vy+=0.55*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
        if(p.y>groundY-2){p.y=groundY-2;p.vy*=-0.4;p.vx*=0.7;p.vr*=0.6;if(Math.abs(p.vy)<1.2)p.life-=0.04*dt;}
        p.life-=p.decay*dt;
        // squash on the tumble axis for a sense of rotation/volume
        const sq=0.78+0.22*Math.abs(Math.cos(p.rot*(p.spin||1)));
        const hw=(p.w||p.s)/2,hh=p.s/2,d=(p.depth||0.35)*p.s;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);g.scale(1,sq);
        // shaded side face (extruded depth) — 破片1個あたりの塗りを絞って描画数を抑制
        g.fillStyle=shade(p.color,-0.26);g.fillRect(-hw+d,-hh+d,p.w||p.s,p.s);
        // lit front face gradient
        let fg=g.createLinearGradient(-hw,-hh,-hw,hh);
        fg.addColorStop(0,shade(p.color,0.22));fg.addColorStop(1,shade(p.color,-0.14));
        g.fillStyle=fg;g.fillRect(-hw,-hh,p.w||p.s,p.s);
        // top sheen (残す=立体感)
        g.fillStyle="rgba(255,255,255,.34)";g.fillRect(-hw,-hh,p.w||p.s,Math.max(2,p.s*0.16));
        g.restore();}
      shards=shards.filter(p=>p.life>0);
      // 壊れ方の違い(軸7): rock=倒れる/tire=転がる/crate=へこむ/tower=トップル/car=吹っ飛ぶ
      for(const p of fallers){
        if(p.kind==="rock"){
          p.rot+=p.vr*dt;if(Math.abs(p.rot)>1.2)p.vr*=0.7;p.life-=p.decay*dt;
          const oS=S;S=p.S;g.save();g.globalAlpha=Math.max(0,p.life);
          g.translate(p.x+S*0.5,p.y+S);g.rotate(p.rot);g.translate(-(p.x+S*0.5),-(p.y+S));
          drawRock({x:p.x,y:p.y,color:p.color});g.restore();S=oS;
        }else if(p.kind==="tire"){
          p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=0.4*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
          const oS=S;S=p.S;g.save();g.globalAlpha=Math.max(0,p.life);
          g.translate(p.x+S*0.5,p.y+S*0.5);g.rotate(p.rot);g.translate(-S*0.5,-S*0.5);
          drawTire({x:0,y:0});g.restore();S=oS;
        }else if(p.kind==="crate"){
          p.sq=Math.max(0.12,p.sq-0.05*dt);p.life-=p.decay*dt;
          const oS=S;S=p.S;g.save();g.globalAlpha=Math.max(0,p.life);
          g.translate(p.x+S*0.5,p.y+S);g.scale(1,p.sq);g.translate(-(p.x+S*0.5),-(p.y+S));
          drawCrate({x:p.x,y:p.y,color:p.color});g.restore();S=oS;
        }else if(p.kind==="tower"){
          p.rot+=p.vr*dt;if(Math.abs(p.rot)>1.3)p.vr=0;p.life-=p.decay*dt;
          g.save();g.globalAlpha=Math.max(0,p.life);
          g.translate(p.x+p.w*0.5,p.y+p.h);g.rotate(p.rot);g.translate(-(p.x+p.w*0.5),-(p.y+p.h));
          drawTower({x:p.x,y:p.y,pw:p.w,ph:p.h,color:p.color});g.restore();
        }else if(p.kind==="car"){
          p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=0.5*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
          g.save();g.globalAlpha=Math.max(0,p.life);
          g.translate(p.x+p.w*0.5,p.y+p.h*0.5);g.rotate(p.rot);g.translate(-p.w*0.5,-p.h*0.5);
          drawCar({x:p.x,y:p.y,pw:p.w,ph:p.h,color:p.color});g.restore();
        }
      }
      g.globalAlpha=1;fallers=fallers.filter(p=>p.life>0);
      // sparks + bloom flares (additive glow)
      g.globalCompositeOperation="lighter";
      for(const p of sparks){
        if(p.bloom){
          // soft expanding bloom burst at the break point (控えめ・短命)
          const a=Math.max(0,p.life),rr=p.bloom*(1.0-a*0.5);
          g.globalAlpha=a*0.45;
          let bgr=g.createRadialGradient(p.x,p.y,0,p.x,p.y,rr);
          bgr.addColorStop(0,p.col);bgr.addColorStop(0.4,"rgba(255,220,150,.4)");bgr.addColorStop(1,"rgba(255,180,80,0)");
          g.fillStyle=bgr;g.beginPath();g.arc(p.x,p.y,rr,0,TAU);g.fill();
          continue;
        }
        p.vy+=0.2*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=p.decay*dt;
        const a=Math.max(0,p.life);g.globalAlpha=a*0.8;
        const r=1.6+a*1.9;
        let sg=g.createRadialGradient(p.x,p.y,0,p.x,p.y,r*2.1);
        sg.addColorStop(0,p.col);sg.addColorStop(0.5,p.col);sg.addColorStop(1,"rgba(255,180,80,0)");
        g.fillStyle=sg;g.beginPath();g.arc(p.x,p.y,r*2.1,0,TAU);g.fill();}
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
      sparks=sparks.filter(p=>p.life>(p.bloom?0.001:0));
      // impact flash: 全画面加算をやめ、着弾点まわりの小さな加算ブルームだけ（白飛び防止）
      if(flash>0){
        const fv=Math.min(flash,0.6);
        g.globalCompositeOperation="lighter";
        const fx=wallX,fy=fist.y,R=Math.min(api.W*0.26,S*3.6);
        let fgr=g.createRadialGradient(fx,fy,0,fx,fy,R);
        fgr.addColorStop(0,"rgba(255,248,230,"+(fv*0.42)+")");
        fgr.addColorStop(0.5,"rgba(255,225,170,"+(fv*0.16)+")");
        fgr.addColorStop(1,"rgba(255,200,140,0)");
        g.fillStyle=fgr;g.beginPath();g.arc(fx,fy,R,0,TAU);g.fill();
        g.globalCompositeOperation="source-over";
        g.globalAlpha=1;flash-=0.16*dt;}
      // big-finish colour wash: うっすら＆速く消える（中身が常に見える）
      if(wash>0){
        g.globalAlpha=Math.min(wash,1)*0.2;g.fillStyle=washCol;g.fillRect(0,0,api.W,api.H);
        g.globalAlpha=1;wash-=0.05*dt;
      }
      // finale overlay: 全画面加算は薄く・短命に（白飛びさせない）
      if(finale>0){
        g.globalCompositeOperation="lighter";
        const hue=(tnow*4)%360;
        g.globalAlpha=finale*0.16;
        g.fillStyle="hsl("+hue+",90%,60%)";g.fillRect(0,0,api.W,api.H);
        g.globalCompositeOperation="source-over";g.globalAlpha=1;
      }
      // stage / wave indicator (top-CENTER = engine HUDのもどる/スコアと衝突しない安全帯)
      g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
      const stg="ステージ "+stage+(stage>FINAL_STAGE?"":"/"+FINAL_STAGE)+"  かべ "+wave+"/"+wavesPerStage;
      g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(stg,api.W/2,26);
      g.fillStyle="#fff7e6";g.fillText(stg,api.W/2,26);
      g.textAlign="left";
      // 出現テーマの予告表示（数字/名前だけ・短時間チラ見せ）
      if(spawnTitle>0){
        g.save();g.textAlign="center";
        const a=clamp(spawnTitle/30,0,1);g.globalAlpha=a;
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(spawnTxt+"！",api.W/2,api.H*0.30);
        g.fillStyle="#fff2a0";g.fillText(spawnTxt+"！",api.W/2,api.H*0.30);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // ボス予告（大きくチラ見せ）
      if(bossWarn>0){
        g.save();g.textAlign="center";
        const a=clamp(bossWarn/30,0,1),pl=1+0.06*Math.sin(tnow*0.4);g.globalAlpha=a;
        g.translate(api.W/2,api.H*0.2);g.scale(pl,pl);
        g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(bossWarnTxt,0,0);
        g.fillStyle="#ff5a3b";g.fillText(bossWarnTxt,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // combo counter (big, punchy, escalates in size/colour)
      //  ボス予告/ステージクリアのバナーとy座標が近接(H*0.16 vs H*0.2/H*0.22)するため、
      //  それらの表示中はコンボ数字を一時的に隠して重なり読みにくくなる瞬間を消す(軸6対策)。
      if(combo>=2&&bossWarn<=0&&stageBanner<=0){
        const cc=comboCol(),sz=26+Math.min(combo,20)*1.6;
        const pulse=1+0.12*Math.max(0,(comboTimer-100)/20);
        g.save();g.translate(api.W*0.5,api.H*0.16);g.scale(pulse,pulse);g.textAlign="center";
        g.font="900 "+Math.round(sz)+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(combo+" コンボ",0,0);
        g.fillStyle=cc;g.fillText(combo+" コンボ",0,0);
        // thin draining timer bar under the combo text
        const bw=120,frac=clamp(comboTimer/120,0,1);
        g.fillStyle="rgba(0,0,0,.35)";g.fillRect(-bw/2,sz*0.35,bw,5);
        g.fillStyle=cc;g.fillRect(-bw/2,sz*0.35,bw*frac,5);
        g.restore();g.textAlign="left";
      }
      // stage-clear banner
      if(stageBanner>0){
        g.save();g.textAlign="center";
        const a=clamp(stageBanner/40,0,1);g.globalAlpha=a;
        g.font="900 40px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(stageBannerTxt,api.W/2,api.H*0.22);
        g.fillStyle="#ffd23f";g.fillText(stageBannerTxt,api.W/2,api.H*0.22);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // charge meter
      if(fist.state==="charging"){const w=api.W*0.6,x=(api.W-w)/2,y=api.H-30;
        g.fillStyle="rgba(0,0,0,.45)";g.fillRect(x-2,y-2,w+4,20);
        let mg=g.createLinearGradient(x,0,x+w,0);
        if(fist.charge>0.9){mg.addColorStop(0,"#ff5a3b");mg.addColorStop(1,"#ffd23f");}
        else{mg.addColorStop(0,"#ffd23f");mg.addColorStop(1,"#ffae5e");}
        g.fillStyle=mg;g.fillRect(x+2,y+2,(w-4)*fist.charge,12);
        if(fist.charge>0.9){g.globalAlpha=0.4+0.4*Math.sin(tnow*0.4);g.fillStyle="#fff";g.fillRect(x+2,y+2,(w-4)*fist.charge,12);g.globalAlpha=1;}
        g.fillStyle="rgba(255,255,255,.25)";g.fillRect(x+2,y+2,(w-4)*fist.charge,4);}
      else{
        // cute rounded translucent hint panel with glow + outline
        const msg="ながおしで ためて、はなして パンチ！";
        g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        const tm=g.measureText(msg),tw=(tm&&tm.width)||msg.length*9;
        const pw=Math.min(api.W*0.86,tw+44),ph=34,px=api.W/2-pw/2,py=api.H-44;
        const bob=Math.sin(tnow*0.08)*2;
        g.save();g.translate(0,bob);
        g.shadowColor="rgba(255,200,120,.6)";g.shadowBlur=14;
        roundRect(px,py,pw,ph,ph/2);g.fillStyle="rgba(60,30,70,.55)";g.fill();
        g.shadowBlur=0;g.lineWidth=3;g.strokeStyle="rgba(255,230,180,.85)";g.stroke();
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.4)";g.strokeText(msg,api.W/2,py+ph/2+6);
        g.fillStyle="#fff7e6";g.fillText(msg,api.W/2,py+ph/2+6);
        g.restore();g.textAlign="left";
      }
      for(const f of fl){f.y+=f.vy*dt;f.life-=0.02*dt;g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,f.x,f.y);g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.textAlign="left";}
      g.globalAlpha=1;fl=fl.filter(f=>f.life>0);
    }
  };
  // ============ 種類ごとの手描き ============
  function drawPiece(b){
    const react=b.react||0,k=b.kind;
    if(react>0){const sc=1+0.12*react;g.save();g.translate(b.x+S/2,b.y+S/2);g.scale(sc,2-sc);g.translate(-(b.x+S/2),-(b.y+S/2));}
    if(k==="rock")drawRock(b);
    else if(k==="ice")drawIce(b);
    else if(k==="crate")drawCrate(b);
    else if(k==="tire")drawTire(b);
    else if(k==="cake")drawCake(b);
    else if(k==="toy")drawToy(b);
    else if(k==="face")drawFacePiece(b);
    else if(k==="tower")drawTower(b);
    else if(k==="car")drawCar(b);
    else drawCube(b);
    if(b.hp<b.maxHp&&k!=="face"&&!b.bomb)drawCracks(b);
    if(b.bomb)drawBombMark(b);
    if(b.gold)drawGoldMark(b);
    if(react>0)g.restore();
  }
  // ブロック: 面取り＋つや＋石の質感
  function drawCube(b){
    const x=b.x,y=b.y;
    const top=shade(b.color,0.20+b.tint),bot=shade(b.color,-0.20+b.tint);
    // 3D body (グラデ) — 斑点だけ省いて描画数を抑えつつ、面取りは残して立体感キープ。
    //  ブロックは1マスが少ない「でか壁」で多用されるため、面取りを残して1マス当たりの
    //  描画量を他の種類と揃える(=どの壁でも1フレームの総描画数が近くなり、時間で偏らない)。
    let bg=g.createLinearGradient(x,y,x,y+S);
    bg.addColorStop(0,top);bg.addColorStop(0.5,shade(b.color,b.tint));bg.addColorStop(1,bot);
    g.fillStyle=bg;g.fillRect(x+1,y+1,S-2,S-2);
    let rg=g.createRadialGradient(x+S*0.36,y+S*0.34,1,x+S*0.5,y+S*0.5,S*0.8);
    rg.addColorStop(0,"rgba(255,255,255,.16)");rg.addColorStop(0.6,"rgba(255,255,255,0)");rg.addColorStop(1,"rgba(0,0,0,.14)");
    g.fillStyle=rg;g.fillRect(x+1,y+1,S-2,S-2);
    g.fillStyle="rgba(255,255,255,.34)";g.fillRect(x+2,y+2,S-4,4);
    g.fillStyle="rgba(255,255,255,.16)";g.fillRect(x+2,y+2,4,S-4);
    g.fillStyle="rgba(0,0,0,.26)";g.fillRect(x+2,y+S-5,S-4,4);
    g.fillStyle="rgba(0,0,0,.18)";g.fillRect(x+S-5,y+2,3,S-4);
  }
  // いわ: ごつごつした多角形＋ファセット陰影＋斑点
  function drawRock(b){
    const x=b.x,y=b.y,cx=x+S/2,cy=y+S/2;
    let bg=g.createLinearGradient(x,y,x,y+S);
    bg.addColorStop(0,shade(b.color,0.22));bg.addColorStop(1,shade(b.color,-0.22));
    g.fillStyle=bg;
    g.beginPath();g.moveTo(x+S*0.5,y+S*0.06);g.lineTo(x+S*0.9,y+S*0.28);g.lineTo(x+S*0.82,y+S*0.86);
    g.lineTo(x+S*0.5,y+S*0.96);g.lineTo(x+S*0.16,y+S*0.82);g.lineTo(x+S*0.08,y+S*0.3);g.closePath();g.fill();
    // 上部ハイライトの帯だけで陰影(ファセット2枚＋斑点は省いて描画数を揃える)
    g.fillStyle="rgba(255,255,255,.18)";g.fillRect(x+S*0.16,y+S*0.12,S*0.5,Math.max(2,S*0.1));
  }
  // こおり: 半透明の青＋白いふち＋ヒビ状の光沢
  function drawIce(b){
    const x=b.x,y=b.y;
    g.fillStyle="rgba(0,0,0,.18)";g.fillRect(x+3,y+4,S-2,S-2);
    let bg=g.createLinearGradient(x,y,x+S,y+S);
    bg.addColorStop(0,shade(b.color,0.28));bg.addColorStop(1,shade(b.color,-0.1));
    g.globalAlpha=0.9;g.fillStyle=bg;g.fillRect(x+1,y+1,S-2,S-2);g.globalAlpha=1;
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;g.strokeRect(x+2,y+2,S-4,S-4);
    g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=Math.max(2,S*0.06);g.lineCap="round";
    g.beginPath();g.moveTo(x+S*0.24,y+S*0.16);g.lineTo(x+S*0.4,y+S*0.5);g.stroke();
    g.fillStyle="rgba(255,255,255,.4)";g.fillRect(x+3,y+3,S-6,3);
  }
  // きばこ: 木のふちどり＋X字＋くぎ
  function drawCrate(b){
    const x=b.x,y=b.y;
    g.fillStyle="rgba(0,0,0,.3)";g.fillRect(x+3,y+4,S-2,S-2);
    let bg=g.createLinearGradient(x,y,x,y+S);
    bg.addColorStop(0,shade(b.color,0.2));bg.addColorStop(1,shade(b.color,-0.2));
    g.fillStyle=bg;g.fillRect(x+1,y+1,S-2,S-2);
    g.strokeStyle="rgba(80,50,18,.6)";g.lineWidth=Math.max(2,S*0.06);g.strokeRect(x+3,y+3,S-6,S-6);
    g.beginPath();g.moveTo(x+3,y+3);g.lineTo(x+S-3,y+S-3);g.moveTo(x+S-3,y+3);g.lineTo(x+3,y+S-3);g.stroke();
    g.fillStyle="rgba(255,255,255,.2)";g.fillRect(x+3,y+3,S-6,3);
  }
  // タイヤ: 黒いドーナツ＋トレッド＋銀のハブ
  function drawTire(b){
    const x=b.x,y=b.y,cx=x+S/2,cy=y+S/2;
    g.fillStyle="#23262e";g.beginPath();g.arc(cx,cy,S*0.46,0,TAU);g.fill();
    // トレッドは1本のリング線に集約(8本ストロークのループを廃止して描画数を圧縮)
    g.strokeStyle="#3a3f48";g.lineWidth=Math.max(2,S*0.08);g.beginPath();g.arc(cx,cy,S*0.4,0,TAU);g.stroke();
    g.fillStyle="#9aa0aa";g.beginPath();g.arc(cx,cy,S*0.2,0,TAU);g.fill();
    g.fillStyle="#6f7580";g.beginPath();g.arc(cx,cy,S*0.09,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.18)";g.beginPath();g.arc(cx-S*0.13,cy-S*0.13,S*0.09,0,TAU);g.fill();
  }
  // ケーキ: スポンジ＋クリーム＋さくらんぼ
  function drawCake(b){
    const x=b.x,y=b.y;
    g.fillStyle="rgba(0,0,0,.28)";g.fillRect(x+3,y+S*0.34+3,S-2,S*0.66);
    let bg=g.createLinearGradient(x,y,x,y+S);bg.addColorStop(0,shade(b.color,0.18));bg.addColorStop(1,shade(b.color,-0.16));
    g.fillStyle=bg;g.fillRect(x,y+S*0.34,S,S*0.66);
    g.fillStyle="#f6c9a0";g.fillRect(x,y+S*0.56,S,S*0.05);
    g.fillStyle="#fff2f8";roundRect(x+1,y+S*0.12,S-2,S*0.34,S*0.1);g.fill();
    g.fillStyle="#ffdcec";g.fillRect(x+2,y+S*0.3,S-4,S*0.12);
    g.fillStyle="#ff3b6b";g.beginPath();g.arc(x+S*0.5,y+S*0.16,S*0.09,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(x+S*0.46,y+S*0.13,S*0.03,0,TAU);g.fill();
  }
  // つみき: ふちどりキューブに丸/星のスタンプ（文字は使わない）
  function drawToy(b){
    const x=b.x,y=b.y,cx=x+S/2,cy=y+S/2;
    let bg=g.createLinearGradient(x,y,x,y+S);bg.addColorStop(0,shade(b.color,0.28));bg.addColorStop(1,shade(b.color,-0.2));
    g.fillStyle=bg;roundRect(x+1,y+1,S-2,S-2,S*0.14);g.fill();
    // スタンプは丸に統一(星は頂点10個ぶんパスが重いので廃止)＋中丸で凹凸感
    g.fillStyle="#fff";g.beginPath();g.arc(cx,cy,S*0.17,0,TAU);g.fill();
    g.fillStyle=shade(b.color,-0.08);g.beginPath();g.arc(cx,cy,S*0.08,0,TAU);g.fill();
  }
  // かお: まるいキューブに目・ほっぺ・口。react中は目をまるく口をおどろきに。
  function drawFacePiece(b){
    const x=b.x,y=b.y,cx=x+S/2,cy=y+S/2,react=b.react||0;
    g.fillStyle="rgba(0,0,0,.28)";g.fillRect(x+3,y+4,S-2,S-2);
    let bg=g.createLinearGradient(x,y,x,y+S);bg.addColorStop(0,shade(b.color,0.3));bg.addColorStop(1,shade(b.color,-0.18));
    g.fillStyle=bg;roundRect(x+1,y+1,S-2,S-2,S*0.2);g.fill();
    // eyes (blink) — ほっぺ/白目ハイライトは省いて描画数を圧縮(目と口でかわいさは維持)
    b.bt=(b.bt||0)+0.04;
    b.blink=(b.blink==null?rnd(0,160):b.blink)-1;if(b.blink<-40)b.blink=rnd(60,180);
    const open=b.blink>0?1:0.15;
    const er=S*(react>0.3?0.14:0.1),ey=cy-S*0.06;
    g.fillStyle=theme.face;
    g.beginPath();g.ellipse(cx-S*0.18,ey,er*0.7,er*open,0,0,TAU);g.fill();g.beginPath();g.ellipse(cx+S*0.18,ey,er*0.7,er*open,0,0,TAU);g.fill();
    g.strokeStyle=theme.face;g.fillStyle=theme.face;g.lineWidth=Math.max(2,S*0.05);g.lineCap="round";
    if(react>0.3){g.beginPath();g.arc(cx,cy+S*0.22,S*0.1,0,TAU);g.fill();}
    else{g.beginPath();g.arc(cx,cy+S*0.12,S*0.13,0.15*Math.PI,0.85*Math.PI);g.stroke();}
  }
  // 多段ヒットのヒビ（欠けるほど濃く/枝分かれ）。壊し応えを視覚化。
  function drawCracks(b){const x=b.x,y=b.y,d=(b.maxHp-b.hp)/Math.max(1,b.maxHp);
    g.save();g.strokeStyle="rgba(15,10,20,"+(0.5+0.3*d)+")";g.lineWidth=Math.max(1.5,S*0.05);g.lineCap="round";g.lineJoin="round";
    g.beginPath();g.moveTo(x+S*0.5,y+S*0.08);g.lineTo(x+S*0.4,y+S*0.45);g.lineTo(x+S*0.6,y+S*0.6);g.lineTo(x+S*0.45,y+S*0.92);
    if(d>0.5){g.moveTo(x+S*0.4,y+S*0.45);g.lineTo(x+S*0.14,y+S*0.5);g.moveTo(x+S*0.6,y+S*0.6);g.lineTo(x+S*0.86,y+S*0.55);}
    g.stroke();g.restore();}
  // ばくだんマーク: 脈打つ発光コア（一目で「ここを狙え」）
  function drawBombMark(b){
    const cx=b.x+S/2,cy=b.y+S/2,pulse=0.5+0.5*Math.sin(tnow*0.1+b.row*0.7+b.col);
    // 加算をやめ通常合成の脈打つコア（狙う的は見えるが白飛びしない）
    g.save();g.globalAlpha=0.55+0.3*pulse;
    let cg=g.createRadialGradient(cx,cy,1,cx,cy,S*0.5);
    cg.addColorStop(0,"rgba(255,245,200,.95)");cg.addColorStop(0.5,"rgba(255,120,60,.7)");cg.addColorStop(1,"rgba(255,60,90,0)");
    g.fillStyle=cg;g.beginPath();g.arc(cx,cy,S*(0.34+0.06*pulse),0,TAU);g.fill();
    g.restore();g.globalAlpha=1;
  }
  // 金マーク: 金色グロー（発見の的）。塔/くるまなどS以外のサイズでも中心に合わせる。
  function drawGoldMark(b){
    const w=b.pw||S,h=b.ph||S,cx=b.x+w/2,cy=b.y+h/2,rad=Math.max(0,Math.min(w,h)*0.5),pl=0.6+0.4*Math.sin(tnow*0.12+b.col);
    // 加算をやめ通常合成の金グロー（発見の的は見えるが白飛びしない）
    g.save();
    let gg2=g.createRadialGradient(cx,cy,1,cx,cy,Math.max(0.01,rad*1.1));
    gg2.addColorStop(0,"rgba(255,240,170,.9)");gg2.addColorStop(0.6,"rgba(255,196,60,.5)");gg2.addColorStop(1,"rgba(255,150,30,0)");
    g.globalAlpha=0.5+0.3*pl;g.fillStyle=gg2;g.beginPath();g.arc(cx,cy,rad,0,TAU);g.fill();
    g.restore();g.globalAlpha=1;
  }
  // とう: 屋根＋2段の胴＋窓（縦2マス＝建物カテゴリ）
  function drawTower(b){
    const x=b.x,y=b.y,w=b.pw,h=b.ph,roofH=h*0.16,bodyY=y+roofH,bodyH=Math.max(2,h-roofH);
    g.fillStyle=shade(b.color,-0.1);
    g.beginPath();g.moveTo(x+w*0.5,y);g.lineTo(x+w*0.06,y+roofH);g.lineTo(x+w*0.94,y+roofH);g.closePath();g.fill();
    let bg=g.createLinearGradient(x,bodyY,x+w,bodyY);
    bg.addColorStop(0,shade(b.color,0.2));bg.addColorStop(1,shade(b.color,-0.18));
    g.fillStyle=bg;g.fillRect(x+3,bodyY,Math.max(0,w-6),Math.max(0,bodyH-3));
    g.fillStyle="rgba(0,0,0,.18)";g.fillRect(x+3,bodyY+bodyH*0.5-1,Math.max(0,w-6),2);
    g.fillStyle="rgba(255,255,255,.5)";
    g.fillRect(x+w*0.32,bodyY+bodyH*0.18,w*0.36,bodyH*0.14);
    g.fillRect(x+w*0.32,bodyY+bodyH*0.62,w*0.36,bodyH*0.14);
    g.fillStyle="rgba(255,255,255,.3)";g.fillRect(x+3,bodyY,Math.max(0,w-6),3);
  }
  // くるま: 車体＋キャビン＋タイヤ2つ（横2マス＝乗り物カテゴリ）
  function drawCar(b){
    const x=b.x,y=b.y,w=b.pw,h=b.ph;
    let bg=g.createLinearGradient(x,y,x,y+h);
    bg.addColorStop(0,shade(b.color,0.22));bg.addColorStop(1,shade(b.color,-0.16));
    g.fillStyle=bg;roundRect(x+2,y+h*0.28,Math.max(0,w-4),h*0.5,h*0.14);g.fill();
    g.fillStyle=shade(b.color,0.1);roundRect(x+w*0.24,y+h*0.06,w*0.5,h*0.32,h*0.12);g.fill();
    g.fillStyle="rgba(200,230,255,.7)";g.fillRect(x+w*0.3,y+h*0.12,w*0.38,h*0.16);
    const wr=Math.max(0,h*0.2);
    g.fillStyle="#23262e";g.beginPath();g.arc(x+w*0.26,y+h*0.82,wr,0,TAU);g.arc(x+w*0.74,y+h*0.82,wr,0,TAU);g.fill();
    g.fillStyle="#9aa0aa";g.beginPath();g.arc(x+w*0.26,y+h*0.82,wr*0.45,0,TAU);g.arc(x+w*0.74,y+h*0.82,wr*0.45,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.3)";g.fillRect(x+4,y+h*0.3,Math.max(0,w-8),3);
  }
  function drawFist(f){const r=S*1.1,x=f.x,y=f.y;
    g.save();g.translate(x,y);g.scale(f.sx,f.sy);
    // glow when charged
    if(f.state==="charging"&&f.charge>0.3){
      g.globalAlpha=(f.charge-0.3)*0.9;
      let gl=g.createRadialGradient(0,0,r*0.4,0,0,r*2.2);
      gl.addColorStop(0,f.charge>0.9?"rgba(255,120,90,.8)":"rgba(255,210,120,.7)");
      gl.addColorStop(1,"rgba(255,180,80,0)");
      g.fillStyle=gl;g.beginPath();g.arc(0,0,r*2.2,0,TAU);g.fill();g.globalAlpha=1;}
    // arm
    g.strokeStyle="#33405e";g.lineWidth=r*0.86;g.lineCap="round";
    g.beginPath();g.moveTo(-r*2,0);g.lineTo(0,0);g.stroke();
    g.strokeStyle="#4a5c84";g.lineWidth=r*0.5;
    g.beginPath();g.moveTo(-r*2,-r*0.1);g.lineTo(0,-r*0.1);g.stroke();
    // 画像グローブ: 生成物は縦向き(こぶし頭が上・upright補正済み、横幅≒高さ×0.65)なので +90° 回して右向きに。
    //  当たり判定=半径r の円に合わせ、長さ r*2.6 の正方形を少し左(-0.3r)寄せで中央描画→ナックル先端が ≒ +r に来る。
    //  腕/チャージ光は手描きのまま重ねる(カフ側が腕の付け根を覆う)。
    if(api.drawAsset("glove.png",-r*0.3,0,r*2.6,r*2.6,{center:true,rot:Math.PI/2})){g.restore();return;}
    // glove
    const grd=g.createRadialGradient(-r*0.35,-r*0.4,r*0.15,0,0,r*1.1);
    grd.addColorStop(0,"#ffb38f");grd.addColorStop(0.55,"#ff7f5b");grd.addColorStop(1,"#c43e26");
    g.fillStyle=grd;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    // knuckle creases
    g.strokeStyle="rgba(0,0,0,.22)";g.lineWidth=r*0.12;g.lineCap="round";
    for(let i=0;i<3;i++){g.beginPath();g.moveTo(r*0.25,-r*0.42+i*r*0.42);g.lineTo(r*0.9,-r*0.42+i*r*0.42);g.stroke();}
    // glossy highlight
    g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(-r*0.32,-r*0.36,r*0.24,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.25)";g.beginPath();g.arc(-r*0.1,-r*0.55,r*0.1,0,TAU);g.fill();
    g.restore();}
  // ============ デカボス手描き ============
  function drawBoss(bo){
    const w=bo.w,h=bo.h,x=bo.cx-w/2,y=bo.y,dmg=1-bo.hp/bo.maxHp,react=bo.react||0;
    g.save();
    if(react>0){const sc=1+0.06*react;g.translate(bo.cx,y+h*0.5);g.scale(2-sc,sc);g.translate(-bo.cx,-(y+h*0.5));}
    if(bo.landed){g.globalAlpha=0.28;g.fillStyle="#000";g.beginPath();g.ellipse(bo.cx,groundY-4,w*0.5,h*0.06,0,0,TAU);g.fill();g.globalAlpha=1;}
    // 画像ボス(ロボ): 当たり枠(w×h)の底に足を合わせて正方形スプライトを描く。
    //  生成物は縦長(横幅≒高さ×0.69)で正方形の高さいっぱい→ side=h*1.08 で 見た目の高さ≒h・幅≒0.84w(枠内に収まる)。
    //  ダメージが進むと赤みに着色した複製(tinted)で「怒り」を表現。だいぶつ/かいじゅうは手描きのまま。
    const bimgName=bo.type.id==="robo"?"robo.png":null;
    const bimg=bimgName?api.asset(bimgName):null;
    if(bimg&&bimg.ready){
      const side=Math.max(0,h*1.08);
      const src=(dmg>0.5?api.tinted(bimgName,"#ff5a3a",0.28):null)||bimg;
      api.drawSrc(src,bo.cx,y+h-side/2,side,side,{center:true});
    }
    else if(bo.type.id==="daibutsu")drawDaibutsu(bo,x,y,w,h,dmg);
    else if(bo.type.id==="kaiju")drawKaiju(bo,x,y,w,h,dmg);
    else drawRobo(bo,x,y,w,h,dmg);
    // ダメージのヒビ（欠けるほど濃く枝分かれ）
    if(dmg>0.12){g.strokeStyle="rgba(20,12,26,"+(0.35+0.4*dmg)+")";g.lineWidth=Math.max(2,w*0.02);g.lineCap="round";g.lineJoin="round";
      g.beginPath();g.moveTo(x+w*0.5,y+h*0.14);g.lineTo(x+w*0.42,y+h*0.42);g.lineTo(x+w*0.56,y+h*0.56);g.lineTo(x+w*0.46,y+h*0.86);
      if(dmg>0.4){g.moveTo(x+w*0.42,y+h*0.42);g.lineTo(x+w*0.2,y+h*0.5);g.moveTo(x+w*0.56,y+h*0.56);g.lineTo(x+w*0.82,y+h*0.5);}
      if(dmg>0.7){g.moveTo(x+w*0.3,y+h*0.3);g.lineTo(x+w*0.16,y+h*0.7);g.moveTo(x+w*0.66,y+h*0.3);g.lineTo(x+w*0.8,y+h*0.72);}
      g.stroke();}
    if(bo.hitFlash>0){g.save();g.globalCompositeOperation="lighter";g.globalAlpha=bo.hitFlash*0.55;
      g.fillStyle="#fff";roundRect(x+w*0.08,y+h*0.06,w*0.84,h*0.9,w*0.14);g.fill();g.restore();}
    g.restore();
    drawBossHP(bo);
  }
  function drawBossHP(bo){
    const w=bo.w,segs=bo.maxHp,bw=Math.min(w*0.9,segs*14),x=bo.cx-bw/2,
      y=clamp(bo.y-16,api.H*0.09,groundY-bo.h-14),sw=bw/segs;
    g.save();g.globalAlpha=0.95;
    for(let i=0;i<segs;i++){g.fillStyle=i<bo.hp?(bo.hp<=bo.maxHp*0.3?"#ff5a3b":"#ffd23f"):"rgba(0,0,0,.4)";
      g.fillRect(x+i*sw+1,y,sw-2,7);}
    g.strokeStyle="rgba(0,0,0,.5)";g.lineWidth=1.5;g.strokeRect(x,y-1,bw,9);
    g.restore();g.globalAlpha=1;
  }
  // 大仏: 金色の座像（頭・肉髻・穏やか→ダメージで困り顔）
  function drawDaibutsu(bo,x,y,w,h,dmg){
    const col=bo.type.col,dk=bo.type.dark,cx=bo.cx,hr=w*0.3,hy=y+h*0.28;
    // 体（衣）
    let bg=g.createLinearGradient(x,y,x,y+h);bg.addColorStop(0,shade(col,0.16));bg.addColorStop(1,shade(dk,-0.06));
    g.fillStyle=bg;g.beginPath();
    g.moveTo(x+w*0.16,y+h);g.lineTo(x+w*0.26,y+h*0.5);g.quadraticCurveTo(cx,y+h*0.34,x+w*0.74,y+h*0.5);
    g.lineTo(x+w*0.84,y+h);g.closePath();g.fill();
    // ひざ
    g.fillStyle=shade(col,0.08);g.beginPath();g.ellipse(x+w*0.3,y+h*0.9,w*0.16,h*0.09,0,0,TAU);
    g.ellipse(x+w*0.7,y+h*0.9,w*0.16,h*0.09,0,0,TAU);g.fill();
    // 頭
    let hg=g.createRadialGradient(cx-hr*0.3,hy-hr*0.3,hr*0.2,cx,hy,hr*1.2);
    hg.addColorStop(0,shade(col,0.22));hg.addColorStop(1,shade(dk,-0.02));
    g.fillStyle=hg;g.beginPath();g.arc(cx,hy,hr,0,TAU);g.fill();
    // 肉髻（頭頂の盛り上がり）
    g.beginPath();g.arc(cx,hy-hr*0.86,hr*0.34,0,TAU);g.fill();
    // 耳
    g.fillStyle=shade(dk,0.02);g.beginPath();g.ellipse(cx-hr,hy,hr*0.2,hr*0.42,0,0,TAU);
    g.ellipse(cx+hr,hy,hr*0.2,hr*0.42,0,0,TAU);g.fill();
    // 顔
    const ey=hy-hr*0.05,ex=hr*0.42,mad=dmg>0.6;
    g.strokeStyle="#3a2a10";g.lineWidth=Math.max(2,hr*0.08);g.lineCap="round";
    if(mad){g.beginPath();g.moveTo(cx-ex-hr*0.14,ey-hr*0.18);g.lineTo(cx-ex+hr*0.14,ey+hr*0.06);
      g.moveTo(cx+ex-hr*0.14,ey+hr*0.06);g.lineTo(cx+ex+hr*0.14,ey-hr*0.18);g.stroke();}
    else{g.beginPath();g.arc(cx-ex,ey,hr*0.12,0.1*Math.PI,0.9*Math.PI);g.arc(cx+ex,ey,hr*0.12,0.1*Math.PI,0.9*Math.PI);g.stroke();}
    // 眉間の白毫
    g.fillStyle="#fff4c0";g.beginPath();g.arc(cx,hy-hr*0.32,hr*0.08,0,TAU);g.fill();
    // 口
    g.strokeStyle="#7a3a20";g.lineWidth=Math.max(2,hr*0.07);
    g.beginPath();if(mad)g.arc(cx,hy+hr*0.5,hr*0.2,1.15*Math.PI,1.85*Math.PI);
    else g.arc(cx,hy+hr*0.28,hr*0.22,0.12*Math.PI,0.88*Math.PI);g.stroke();
  }
  // 怪獣: 緑のずんぐり＋大きな目＋牙＋背びれ
  function drawKaiju(bo,x,y,w,h,dmg){
    const col=bo.type.col,dk=bo.type.dark,cx=bo.cx,cy=y+h*0.56;
    // 背びれ
    g.fillStyle=shade(dk,0.04);
    for(let i=-2;i<=2;i++){const sx=cx+i*w*0.14;g.beginPath();g.moveTo(sx-w*0.06,y+h*0.36);g.lineTo(sx,y+h*0.12);g.lineTo(sx+w*0.06,y+h*0.36);g.closePath();g.fill();}
    // 体
    let bg=g.createLinearGradient(x,y,x,y+h);bg.addColorStop(0,shade(col,0.18));bg.addColorStop(1,shade(dk,-0.08));
    g.fillStyle=bg;roundRect(x+w*0.12,y+h*0.28,w*0.76,h*0.68,w*0.24);g.fill();
    // おなか
    g.fillStyle=shade(col,0.3);roundRect(x+w*0.3,y+h*0.5,w*0.4,h*0.4,w*0.14);g.fill();
    // あし
    g.fillStyle=shade(dk,0.02);g.beginPath();g.ellipse(x+w*0.32,y+h*0.98,w*0.12,h*0.05,0,0,TAU);
    g.ellipse(x+w*0.68,y+h*0.98,w*0.12,h*0.05,0,0,TAU);g.fill();
    // 目（大きい・ダメージで怒り）
    const ey=y+h*0.42,ex=w*0.16,er=w*0.11,mad=dmg>0.5;
    g.fillStyle="#fff";g.beginPath();g.arc(cx-ex,ey,er,0,TAU);g.arc(cx+ex,ey,er,0,TAU);g.fill();
    g.fillStyle="#1c1c22";g.beginPath();g.arc(cx-ex+(mad?er*0.2:0),ey+er*0.1,er*0.5,0,TAU);g.arc(cx+ex-(mad?er*0.2:0),ey+er*0.1,er*0.5,0,TAU);g.fill();
    if(mad){g.strokeStyle=dk;g.lineWidth=Math.max(2,w*0.03);g.lineCap="round";
      g.beginPath();g.moveTo(cx-ex-er,ey-er*1.1);g.lineTo(cx-ex+er*0.6,ey-er*0.5);
      g.moveTo(cx+ex+er,ey-er*1.1);g.lineTo(cx+ex-er*0.6,ey-er*0.5);g.stroke();}
    // 口＋牙
    g.fillStyle="#5a1020";roundRect(cx-w*0.18,y+h*0.6,w*0.36,h*0.1,w*0.05);g.fill();
    g.fillStyle="#fff";
    for(let i=0;i<4;i++){const tx=cx-w*0.14+i*w*0.093;g.beginPath();g.moveTo(tx,y+h*0.6);g.lineTo(tx+w*0.045,y+h*0.6);g.lineTo(tx+w*0.022,y+h*0.66);g.closePath();g.fill();}
  }
  // ロボ: 箱型の頭＋胴＋アンテナ＋ボルト目
  function drawRobo(bo,x,y,w,h,dmg){
    const col=bo.type.col,dk=bo.type.dark,cx=bo.cx;
    // アンテナ
    g.strokeStyle=dk;g.lineWidth=Math.max(2,w*0.02);g.beginPath();g.moveTo(cx,y+h*0.1);g.lineTo(cx,y-h*0.02);g.stroke();
    g.fillStyle=dmg>0.5?"#ff5a3b":"#ff3b6b";g.beginPath();g.arc(cx,y-h*0.03,w*0.05,0,TAU);g.fill();
    // 胴
    let bg=g.createLinearGradient(x,y,x,y+h);bg.addColorStop(0,shade(col,0.16));bg.addColorStop(1,shade(dk,-0.06));
    g.fillStyle=bg;roundRect(x+w*0.2,y+h*0.44,w*0.6,h*0.54,w*0.08);g.fill();
    // 頭
    g.fillStyle=shade(col,0.1);roundRect(x+w*0.26,y+h*0.1,w*0.48,h*0.36,w*0.1);g.fill();
    // 顔パネル
    g.fillStyle="#20242e";roundRect(x+w*0.32,y+h*0.16,w*0.36,h*0.22,w*0.05);g.fill();
    // 目（ボルト）
    const ey=y+h*0.26,ex=w*0.1,mad=dmg>0.5;
    g.fillStyle=mad?"#ff5a3b":"#7fe0ff";g.beginPath();g.arc(cx-ex,ey,w*0.05,0,TAU);g.arc(cx+ex,ey,w*0.05,0,TAU);g.fill();
    g.fillStyle="#fff";g.beginPath();g.arc(cx-ex-w*0.015,ey-w*0.015,w*0.018,0,TAU);g.arc(cx+ex-w*0.015,ey-w*0.015,w*0.018,0,TAU);g.fill();
    // 口グリル
    g.fillStyle=mad?"#ff8f6b":"#9fe0ff";for(let i=0;i<4;i++)g.fillRect(cx-w*0.12+i*w*0.065,y+h*0.33,w*0.04,h*0.03);
    // 胸のランプ
    g.fillStyle=dmg>0.7?"#ff5a3b":"#ffd23f";g.beginPath();g.arc(cx,y+h*0.62,w*0.06,0,TAU);g.fill();
    // ボルト（肩）
    g.fillStyle=shade(dk,0.06);g.beginPath();g.arc(x+w*0.26,y+h*0.5,w*0.04,0,TAU);g.arc(x+w*0.74,y+h*0.5,w*0.04,0,TAU);g.fill();
    // うで
    g.strokeStyle=shade(dk,0.02);g.lineWidth=w*0.09;g.lineCap="round";
    g.beginPath();g.moveTo(x+w*0.22,y+h*0.55);g.lineTo(x+w*0.1,y+h*0.72);g.moveTo(x+w*0.78,y+h*0.55);g.lineTo(x+w*0.9,y+h*0.72);g.stroke();
  }
}
Engine.register("punch", buildPunch);
