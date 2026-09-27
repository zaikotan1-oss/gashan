function buildHammer(api){
  const g=api.g;
  api.preload(["bg.jpg","robot.png","hammer.png","boss.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)
  let holes=[],targets=[],stars=[],rings=[],sparks=[],arcs=[],chunks=[],groundY,R,spawnT=0,count=0,combo=0,comboT=0,elapsed=0,tGlobal=0;
  let zapMsgT=0;   // "でんき チェイン!" teaching flash timer
  let bossMsgT=0;  // "ピカッたら いまだ!" boss weak-point teaching flash
  // 軸6対策: 共通エンジンの祝福バナー「やったね!」は画面中央やや上(だいたい api.H*0.22〜0.38)に出る。
  // ここに自分のテキストを置くと重なって読めなくなるので、危険帯に入るなら安全な位置(0.4)へ逃がす(jellypop.jsのfloatYと同じ考え方)。
  function safeY(fy0){return (fy0>api.H*0.22&&fy0<api.H*0.38)?api.H*0.4:fy0;}
  let hsCD=0;      // hitStop cooldown (節目限定・30f以上あける)
  function tryHitStop(f){if(hsCD<=0){api.hitStop(f);hsCD=32;}}
  let hammer={x:0,y:0,angle:0,t:1};
  // ---- ボス (ステージ5) ----
  let boss=null,bossSeenWeak=false;
  // ---- 毎プレイの変化: BGの並びシャッフル + ステージごとのモディファイア ----
  let bgOrder=[0,1,2,3,4];
  let modifier="",modName="";
  // stage / progression
  const STAGES=5;                 // 5 stages then "ぜんぶクリア!" -> loop
  let stage=1,stageKill=0,stageGoal=8;
  let clearT=0,clearStage=0;      // "ステージクリア!" banner timer
  let endingT=0;                  // full-clear celebration
  let novaT=0;                    // 必殺どっかん screen-flash timer
  // per-stage palette: shifts the meadow color so each stage looks different
  const STAGE_BG=[
    {sky:"#bfe9f5",mid:"#8fd6c9",g1:"#3fa873",g2:"#2e7d5b",g3:"#103f25"}, // 1 green meadow
    {sky:"#ffe4c2",mid:"#ffc98f",g1:"#e88f4d",g2:"#b85f2e",g3:"#5e2d14"}, // 2 sunset
    {sky:"#cfe0ff",mid:"#9bb6ff",g1:"#5f7fe0",g2:"#3f53b8",g3:"#1c2356"}, // 3 dusk blue
    {sky:"#f5cfff",mid:"#d99bff",g1:"#a85fe0",g2:"#7a3fb8",g3:"#3a1c56"}, // 4 candy purple
    {sky:"#fff0a6","mid":"#ffd23f",g1:"#ffb347",g2:"#e08020",g3:"#7a4010"}  // 5 golden finale
  ];
  function stageGoalFor(s){return 10+(s-1)*3;}     // 10,13,16,19,22（7〜8歳向けに手応えを増やした）
  function curBg(){return STAGE_BG[bgOrder[(stage-1)%STAGE_BG.length]];}
  function shuffleBg(){ // 毎プレイで配色の並びを変える（同じ絵の繰り返し感を消す）
    for(let i=bgOrder.length-1;i>0;i--){const j=rint(0,i);const t=bgOrder[i];bgOrder[i]=bgOrder[j];bgOrder[j]=t;}}
  // ステージ開始ごとに軽いモディファイアを1つ抽選（HUDに小さく表示）。
  // どれも「やさしくなる/派手になる」方向だけ = ④操作の簡単さは損なわない。
  const MODS=[
    {id:"",     name:"ふつう"},
    {id:"gold", name:"きんピカ まつり"},
    {id:"zap",  name:"でんき いっぱい"},
    {id:"slow", name:"ゆっくり モード"},
    {id:"tough",name:"でかロボ たくさん"}
  ];
  function rollModifier(){const m=pick(MODS);modifier=m.id;modName=m.name;}
  // live cursor for follow-hammer + magic glow trail
  let cur={x:0,y:0,has:false,tx:0,ty:0};
  let trail=[];           // sparkle trail behind the hammer head
  let climax=0;           // full-screen color-wash flash on big hits
  const TC=["#ff5b5b","#4db8ff","#ffd23f","#7be08a","#c78bff"];
  const TCNAME=["あか","あお","きいろ","みどり","むらさき"];
  // ⑤⑥⑦ 壊す物のバラエティ: ロボ以外の新シルエット(いわ=丸くて小さい/きばこ=四角/やぐら=積み箱で大きい)。
  // 型ごとの倍率テーブル(未掲載の型=1)。0.62〜1.58まで一目で分かる大小差をつける。
  const SIZE_MUL={rock:0.62,big:1.18,tower:1.58,crate:1.5};
  // ---- 隠し発見レイヤー(クレーン/パンチと同じ思想) ----
  let luckyColor=pick(TC),luckyMsgT=0,luckySeen=false;  // ② きょうのラッキー色: 秘密の1色。叩くとボーナス
  let rbMsgT=0;                                         // ① にじいろロボ 発見バナー
  let stageMiss=0,noMissT=0;                            // ③ ノーミス判定: このステージのばくだん被弾数
  let sunWink=0;                                        // ④ 太陽ひみつタップの目パチ
  const sunPos={x:0,y:0,r:0};                           // 太陽の当たり判定(layoutで確定)
  // ambient background props (built on layout)
  let clouds=[],hills=[],flowers=[],orbs=[],motes=[];
  function buildBg(){
    clouds=[];for(let i=0;i<5;i++)clouds.push({x:rnd(0,api.W),y:api.H*rnd(0.06,0.26),s:rnd(0.7,1.5),sp:rnd(0.06,0.16),a:rnd(0.18,0.34)});
    // two parallax hill layers behind the play field
    hills=[
      {y:api.H*0.30,amp:api.H*0.05,wl:api.W*0.9,col:"#2f8f63",sp:0.004,ph:0},
      {y:api.H*0.40,amp:api.H*0.06,wl:api.W*0.7,col:"#27784f",sp:0.008,ph:1.7}
    ];
    flowers=[];const fn=14;for(let i=0;i<fn;i++)flowers.push({
      x:api.W*((i+0.5)/fn)+rnd(-api.W*0.02,api.W*0.02),y:api.H*rnd(0.82,0.97),
      s:rnd(0.7,1.3),col:pick(["#ff8fb3","#ffd23f","#fff0a6","#c78bff","#9be8ff"]),ph:rnd(0,TAU)});
    orbs=[];for(let i=0;i<7;i++)orbs.push({
      x:rnd(0,api.W),y:rnd(api.H*0.18,api.H*0.85),r:rnd(2.5,5),
      col:pick(["#fff7c2","#bfe9ff","#ffd2f0","#d7ffd0"]),ph:rnd(0,TAU),
      sp:rnd(0.004,0.01),amp:rnd(8,26),drift:rnd(0.02,0.06)});
    motes=[];for(let i=0;i<22;i++)motes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(0.6,2.2),sp:rnd(0.1,0.4),tw:rnd(0,TAU)});
  }
  function layout(){
    groundY=api.H*0.9;
    const cols=3,rows=3;
    R=clamp(Math.min(api.W/(cols+1),api.H/(rows+2))*0.36,30,64);
    holes=[];
    const gw=api.W*0.84, gx=(api.W-gw)/2, gh=api.H*0.5, gy=api.H*0.28;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)
      holes.push({x:gx+gw*(c+0.5)/cols, y:gy+gh*(r+0.5)/rows, occ:false});
    targets.forEach(t=>{const h=holes[t.hi];if(h){t.x=h.x;t.baseY=h.y;}});
    // ④ 太陽ひみつタップの当たり判定(描画位置と一致・寛容に大きめ)
    sunPos.x=api.W*0.78;sunPos.y=api.H*0.13;sunPos.r=Math.max(40,api.W*0.09);
    positionBoss();
    buildBg();
  }
  shuffleBg();rollModifier();layout();
  function pickType(){
    // ① にじいろロボ: ステージ2以降、ときどき(約14分の1)だけ出る激レア。いつ出るか分からない=ドキドキ発見。
    if(stage>=2&&rint(0,13)===0)return "rainbow";
    // stage-gated variety; weighted so normal bots stay the majority
    // ⑤⑥ 壊す物のバラエティ: ロボ(人型)だけにならないよう、いわ(丸・小さい)ときばこ(四角)を
    // ステージ1から混ぜる。「同じ大きさの色違い」で終わらせない。
    const bag=["bot","bot","bot","rock","crate"];
    // でかロボ: 2回叩く / でんきロボ: たてよこ連鎖 / やぐら: 積み箱が3段・でかい構造物(序盤から登場)
    if(stage>=2){bag.push("big");bag.push("zap");bag.push("tower");bag.push("crate");}
    if(stage>=3){bag.push("gold");bag.push("bomb");} // きんピカ + ばくだん(叩くな)
    if(stage>=4){bag.push("bomb");bag.push("zap");} // 後半はトラップ増 + でんきの見せ場
    // モディファイアで“今回はこれが多い”を演出（同じ絵の繰り返し感を消す）
    if(modifier==="gold"){bag.push("gold");bag.push("gold");}
    else if(modifier==="zap"){bag.push("zap");bag.push("zap");}
    else if(modifier==="tough"){bag.push("big");bag.push("big");bag.push("tower");}
    return pick(bag);
  }
  function spawn(){
    const free=holes.map((h,i)=>i).filter(i=>!holes[i].occ);
    if(!free.length)return;
    const hi=pick(free);holes[hi].occ=true;
    // life shrinks per STAGE (not elapsed): constant within a stage, harder across
    let dur=clamp(1500-(stage-1)*180,720,1500);
    if(modifier==="slow")dur*=1.5;  // ゆっくりモード: 長く出ていて さらにやさしい
    const type=pickType();
    let color=pick(TC),hp=1,life=dur;
    if(type==="big"){color="#7a8a99";hp=2;}        // grey tough bot
    else if(type==="gold"){color="#ffd23f";life=dur*0.55;} // shiny + short-lived
    else if(type==="zap"){color="#2fd8f0";life=dur*1.3;}   // でんき: lingers so you can gather neighbors, then たてよこ連鎖
    else if(type==="bomb"){color="#ff4d6d";}       // do NOT hit (pink bomb)
    else if(type==="rainbow"){color="#ff5b5b";life=dur*0.75;} // にじいろロボ: 短命の激レア(描画側で虹色に変化)
    else if(type==="rock"){color="#8a8378";}       // いわ: ロボより小さい丸い的(1回で割れる)
    else if(type==="crate"){color="#b5793a";}      // きばこ: 四角い木箱(1回で割れる)
    else if(type==="tower"){color="#c98a4a";hp=3;life=dur*1.6;} // やぐら: 積み箱3段、1段ずつ崩す(でかい・長めに出る)
    targets.push({hi,x:holes[hi].x,baseY:holes[hi].y,up:0,state:"rise",
      type,color,hp,life,squash:1,blink:0,bob:rnd(0,TAU),flash:0});
  }
  function hitFx(hx,hy,col,big,shape){
    // shockwave rings + burst stars + glints (shared by smash & nova)
    rings.push({x:hx,y:hy,r:R*0.5,vr:R*0.55,life:1,decay:0.06,col});
    rings.push({x:hx,y:hy,r:R*0.2,vr:R*0.38,life:1,decay:0.05,col:"#ffffff"});
    const n=(big?16:10)+Math.min(combo,6);
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(2.5,8);
      stars.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(3,7.5),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.014,0.024),
        col:i%3===0?col:(i%3===1?"#ffd23f":"#ffffff")});}
    for(let i=0;i<rint(6,9);i++){const a=rnd(0,TAU),s=rnd(4,11);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,18),life:1,decay:rnd(0.05,0.09)});}
    // 破片チャンクが重力で飛び散って着地 = 「壊した」手応え。
    // shape で壊れ方の見た目を型ごとに変える: "square"=板がバラける(きばこ/やぐら), "round"=ゴロッと丸い塊(いわ), 既定=ロボの多角形パーツ。
    const cn=big?rint(3,4):rint(2,3);
    for(let i=0;i<cn;i++){const a=rnd(-TAU/2,0),s=rnd(4,9);
      chunks.push({x:hx,y:hy,vx:Math.cos(a)*s*rnd(0.6,1),vy:Math.sin(a)*s-rnd(1,4),
        s:R*rnd(0.22,0.4),col:col,rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.018),
        pts:chunkPts(shape),rest:false});}
    if(chunks.length>60)chunks.splice(0,chunks.length-60);
  }
  function rainbowBurst(hx,hy){
    // ① にじいろロボ 撃破: 虹の輪が5色ぶわっと広がる大盤振る舞い。激レアの爽快ごほうび。
    rbMsgT=1.4;climax=Math.min(0.7,climax+0.5);novaT=Math.min(0.5,novaT+0.4);
    api.boom(0.7);api.shake(16);tryHitStop(5);
    api.slide(660,1320,0.5,0.22,"triangle");api.tone(880,0.14,"triangle",0.12);api.tone(1320,0.16,"triangle",0.1);
    for(let k=0;k<TC.length;k++)rings.push({x:hx,y:hy,r:R*0.4,vr:R*(0.5+k*0.12),life:1,decay:0.05,col:TC[k]});
    for(let i=0;i<26;i++){const a=rnd(0,TAU),s=rnd(3,10);
      stars.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(4,8),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:TC[i%TC.length]});}
    if(stars.length>150)stars.splice(0,stars.length-150);
  }
  function luckySparkle(hx,hy){
    // ② ラッキー色 命中: きらっと小さめの祝福(白飛びしないよう控えめ)
    api.tone(1046,0.16,"triangle",0.12);api.tone(1568,0.18,"triangle",0.09);
    for(let i=0;i<10;i++){const a=rnd(0,TAU),s=rnd(2,6);
      stars.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,6),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:luckyColor});}
  }
  function chunkPts(shape){
    if(shape==="square"){ // きばこ/やぐら: 平たい板がバラける「バキッ」とした壊れ方
      const w=rnd(0.4,0.55),h=rnd(0.3,0.42);return [[-w,-h],[w,-h],[w,h],[-w,h]];}
    if(shape==="round"){ // いわ: ゴロッと丸い塊が転がる壊れ方
      const n=6,a=[];for(let i=0;i<n;i++){const ang=i/n*TAU+rnd(-0.15,0.15),rr=rnd(0.42,0.52);
        a.push([Math.cos(ang)*rr,Math.sin(ang)*rr]);}return a;}
    const n=rint(4,5),a=[];for(let i=0;i<n;i++){
      const ang=i/n*TAU+rnd(-0.35,0.35),rr=rnd(0.34,0.55);a.push([Math.cos(ang)*rr,Math.sin(ang)*rr]);}return a;}
  function debrisShape(type){return (type==="crate"||type==="tower")?"square":(type==="rock"?"round":undefined);}
  function nova(){
    // 必殺どっかん: every robot on screen pops at once (combo reward)
    novaT=1;climax=1;api.boom(0.7);api.shake(16);api.hitStop(6);
    api.slide(700,120,0.4,0.3,"sawtooth");api.tone(120,0.4,"sawtooth",0.12);
    for(const t of targets){
      if(t.state==="smashed"||t.type==="bomb")continue;
      t.state="smashed";t.squash=1;holes[t.hi].occ=false;
      count++;stageKill++;hitFx(t.x,t.baseY-R*0.5,t.color,true,debrisShape(t.type));
    }
    api.setScore(count);checkStage();
  }
  // ---- ボス (ステージ5) ----
  // 中央の大型ロボ(HP6・体力バー)。おなかの「でんきマーク」がピカッと光った瞬間に
  // 叩くと大ダメージ(2)。ふだんは1ダメージ。考えどころ=「光ったら いまだ!」のタイミング。
  // ※気づかず連打しても倒せる(=④はそのまま)。光ると得。
  function positionBoss(){if(boss){boss.x=api.W/2;boss.y=api.H*0.30;boss.r=R*1.7;}}
  function spawnBoss(){boss={hp:6,maxHp:6,weakT:0,weak:false,flash:0,bob:rnd(0,TAU),dead:false};positionBoss();bossSeenWeak=false;}
  function hitBoss(){
    if(!boss||boss.dead)return;
    boss.flash=1;const weak=boss.weak,dmg=weak?2:1;
    boss.hp=Math.max(0,boss.hp-dmg);
    count+=weak?4:1;stageKill++;api.setScore(count);combo++;comboT=0.9;
    hammer.x=boss.x;hammer.y=boss.y+R*0.2;hammer.t=0;
    if(weak){
      api.boom(0.5);api.shake(12);api.slide(520,140,0.18,0.3,"square");
      api.tone(880,0.16,"triangle",0.13);api.tone(1320,0.18,"triangle",0.1);
      climax=Math.min(1,climax+0.5);tryHitStop(4);
      for(let k=0;k<3;k++)hitFx(boss.x+rnd(-boss.r*0.4,boss.r*0.4),boss.y+rnd(-boss.r*0.2,boss.r*0.4),"#ffe23f",true);
    }else{
      api.slide(300,150,0.1,0.24,"square");api.noise(0.08,0.16,1600);
      api.tone(400,0.09,"square",0.09);api.shake(5);
      hitFx(boss.x+rnd(-boss.r*0.3,boss.r*0.3),boss.y+rnd(-boss.r*0.2,boss.r*0.3),"#9fb0c0",false);
    }
    if(boss.hp<=0)defeatBoss();
  }
  function defeatBoss(){
    boss.dead=true;novaT=1;climax=1;api.boom(0.85);api.shake(24);tryHitStop(6);
    api.slide(700,80,0.6,0.4,"sawtooth");
    // 手下をまとめてドカン + 盛大な破片
    for(const t of targets){if(t.state==="smashed"||t.type==="bomb")continue;
      t.state="smashed";t.squash=1;holes[t.hi].occ=false;count++;hitFx(t.x,t.baseY-R*0.5,t.color,true,debrisShape(t.type));}
    for(let i=0;i<10;i++)hitFx(boss.x+rnd(-boss.r,boss.r),boss.y+rnd(-boss.r*0.5,boss.r*0.5),TC[i%TC.length],true);
    api.setScore(count);endingT=2.8;
    api.slide(523,1046,0.5,0.22,"triangle");
  }
  function checkStage(){
    if(clearT>0||endingT>0)return;
    if(stage>=STAGES)return;          // ステージ5はボス戦: クリアはボス撃破時のみ(defeatBoss)
    if(stageKill<stageGoal)return;
    // STAGE CLEAR (1〜4)
    clearStage=stage;clearT=1.6;climax=0.7;api.boom(0.5);api.shake(12);
    api.slide(523,784,0.3,0.2,"triangle");api.tone(660,0.25,"triangle",0.14);
    api.tone(988,0.3,"triangle",0.1);
    // celebratory star burst from center so the clear moment pops
    for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
      stars.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(TC)});}
    // ③ ノーミスボーナス: このステージで ばくだんを1回も叩かなかったら +3 & みどりの星シャワー。
    if(stageMiss===0){count+=3;api.setScore(count);noMissT=1.9;api.tone(1318,0.16,"triangle",0.12);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(3,8);
        stars.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(4,8),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:"#7be08a"});}}
    stageMiss=0;
    stage++;stageGoal=stageGoalFor(stage);stageKill=0;buildBg();rollModifier();
    if(stage>=STAGES)spawnBoss();     // ステージ5突入 = ボス登場
  }
  function bombHit(t){
    // ばくだん: don't hit it. combo resets, gentle "あちゃー" puff, NO game over.
    t.state="smashed";t.squash=1;holes[t.hi].occ=false;
    combo=0;comboT=0;climax=0;stageMiss++;   // ③ ノーミス判定: ばくだんを叩いたら記録
    api.noise(0.18,0.2,400,"lowpass",1);api.slide(200,80,0.18,0.18,"sawtooth");api.shake(6);
    const hx=t.x,hy=t.baseY-R*0.5;
    rings.push({x:hx,y:hy,r:R*0.4,vr:R*0.4,life:1,decay:0.05,col:"#555"});
    for(let i=0;i<12;i++){const a=rnd(0,TAU),s=rnd(2,5);
      stars.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,r:rnd(3,6),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:i%2?"#888":"#444"});}
    hammer.x=t.x;hammer.y=t.baseY-R;hammer.t=0;
  }
  function zapChain(src){
    // でんきロボを叩くと、同じ「たて列 / よこ列」に出ているロボへ電気が走って一緒にドカン。
    // 考えどころ: まわりが出そろってから でんき を叩くと連鎖がのびて大量得点。
    // むずかしい操作は不要 — 気づかなくても普通のロボとして倒せる。
    const srow=Math.floor(src.hi/3), scol=src.hi%3;
    let hit=0;
    for(const t of targets){
      if(t===src||t.state==="smashed"||t.type==="bomb")continue;      // ばくだんには走らせない(安全)
      if(t.state!=="up"&&t.state!=="rise")continue;
      const row=Math.floor(t.hi/3), col=t.hi%3;
      if(row!==srow&&col!==scol)continue;                             // 同じ たて/よこ 列のみ
      t.state="smashed";t.squash=1;holes[t.hi].occ=false;
      const gain=t.type==="gold"?3:1;
      count+=gain;stageKill++;combo++;comboT=0.9;
      hitFx(t.x,t.baseY-R*0.5,t.color,true);
      arcs.push({x1:src.x,y1:src.baseY-R*0.5,x2:t.x,y2:t.baseY-R*0.5,life:1});
      hit++;
    }
    if(hit>0){
      api.setScore(count);
      api.boom(0.55+Math.min(hit,4)*0.06);api.shake(10+Math.min(hit,4)*2);
      api.slide(680,150,0.34,0.26,"sawtooth");api.tone(150,0.3,"sawtooth",0.1);
      climax=Math.min(1,0.55+hit*0.12);novaT=Math.min(1,0.4+hit*0.12);
      if(hit>=2){api.hitStop(4);zapMsgT=1.1;}   // 2匹以上巻き込んだら節目としてヒットストップ+教示表示
    }
    if(arcs.length>40)arcs.splice(0,arcs.length-40);
  }
  function smash(t,px,py){
    // でかロボ: first hit only dents it
    if(t.type==="big"&&t.hp>1){t.hp--;t.flash=1;t.squash=0.82;
      api.slide(260,180,0.08,0.2,"square");api.noise(0.06,0.12,1400);
      api.tone(300,0.08,"square",0.1);api.shake(4);
      hammer.x=t.x;hammer.y=t.baseY-R;hammer.t=0;
      hitFx(t.x,t.baseY-R*0.5,"#cfd8e0",false);return;}
    // やぐら: 積み箱が1段ずつ崩れ落ちる(3回叩いて全部崩す。段が消えるたび軽い着地音+破片)
    if(t.type==="tower"&&t.hp>1){t.hp--;t.flash=1;t.squash=0.88;
      api.slide(240,120,0.1,0.22,"square");api.noise(0.07,0.14,900);
      api.tone(260,0.09,"square",0.1);api.shake(5);
      hammer.x=t.x;hammer.y=t.baseY-R;hammer.t=0;
      hitFx(t.x,t.baseY-R*0.5,"#e0b070",false,"square");return;}
    t.state="smashed";t.squash=1;holes[t.hi].occ=false;
    let gain=t.type==="gold"?3:(t.type==="rainbow"?5:(t.type==="tower"?3:1));
    // ② ラッキー色: 今日の秘密の色(ふつう/でかロボ)を叩くと +1 の隠しボーナス。気づくと得する。
    const isLucky=(t.type==="bot"||t.type==="big")&&t.color===luckyColor;
    if(isLucky){gain+=1;luckyMsgT=luckySeen?Math.max(luckyMsgT,0.7):1.3;luckySeen=true;}
    count+=gain;stageKill++;api.setScore(count);combo++;comboT=0.9;
    api.slide(320,140,0.12,0.32,"square");api.noise(0.1,0.18,1800);
    api.tone(500*Math.pow(2,clamp(combo,0,10)/12),0.12,"triangle",0.12);api.boom(0.4);
    api.shake(6+Math.min(combo,8));api.hitStop(2);
    if(t.type==="gold"){api.tone(1046,0.18,"triangle",0.14);api.tone(1318,0.2,"triangle",0.1);}
    hammer.x=t.x;hammer.y=t.baseY-R;hammer.t=0;
    // big-hit climax: color-wash flash that grows with the combo
    if(combo>=3){climax=Math.min(0.7,0.32+combo*0.05);api.hitStop(combo>=6?4:3);
      api.tone(220,0.22,"sawtooth",0.07);}
    hitFx(t.x,t.baseY-R*0.5,t.type==="rainbow"?"#ffffff":t.color,combo>=5||t.type==="rainbow",debrisShape(t.type));
    // ① にじいろロボ / ② ラッキー色 の特別演出
    if(t.type==="rainbow")rainbowBurst(t.x,t.baseY-R*0.5);
    if(isLucky)luckySparkle(t.x,t.baseY-R*0.5);
    // でんきロボ: たて/よこ列の仲間へ連鎖 (考えどころ = 出そろってから叩くと大連鎖)
    if(t.type==="zap")zapChain(t);
    // combo reward: every 8th combo unleashes the screen-clearing 必殺どっかん
    if(combo>0&&combo%8===0)nova();
    checkStage();
  }
  return{
    resize:layout,
    input(px,py,type){
      // always remember where the cursor/finger is so the hammer can follow it
      cur.tx=px;cur.ty=py;cur.has=true;
      if(!cur.x&&!cur.y){cur.x=px;cur.y=py;}
      if(type!=="down"||clearT>0||endingT>0)return;
      // ボスは大きく寛容に: 体に近ければ吸い付いてダメージ(手下より優先)
      if(boss&&!boss.dead&&Math.hypot(px-boss.x,py-boss.y)<boss.r*1.15){hitBoss();return;}
      // 寛容な当たり判定: ばくだんは「直撃」のみ反応、ロボは最寄りにオートエイム
      let best=null,bd=1e9;
      for(let i=targets.length-1;i>=0;i--){const t=targets[i];
        if(t.state==="smashed")continue;
        const ty=t.baseY-t.up*R*1.6;
        const d=Math.hypot(px-t.x,py-ty);
        if(t.type==="bomb"){if(d<R*1.05){bombHit(t);return;}continue;}
        if(d<bd){bd=d;best=t;}}
      if(best&&bd<R*3){smash(best,px,py);return;}
      // ④ 太陽ひみつタップ: ロボに当たらなかったタップが太陽に届いたら、ウインクしてコインをこぼす(減点なし)
      if(Math.hypot(px-sunPos.x,py-sunPos.y)<sunPos.r){
        sunWink=1;api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.08);
        for(let i=0;i<7;i++){const a=rnd(-TAU*0.5,0),s=rnd(3,7);
          stars.push({x:sunPos.x,y:sunPos.y,vx:Math.cos(a)*s*0.6,vy:Math.sin(a)*s-1,r:rnd(4,7),
            rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.012,col:"#ffd23f"});}
        hammer.x=px;hammer.y=py+R*0.4;hammer.t=0;return;
      }
      // missed swing: still feel the swing where you tapped
      hammer.x=px;hammer.y=py+R*0.4;hammer.t=0;
      api.slide(220,150,0.05,0.16,"square");
      for(let i=0;i<6;i++){const a=rnd(0,TAU),s=rnd(2,5);
        sparks.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(6,12),life:1,decay:rnd(0.06,0.1)});}
    },
    frame(dt,now){
      elapsed+=dt/60;tGlobal+=dt;
      if(hsCD>0)hsCD-=dt;
      // sky-to-meadow gradient (per-stage palette) with extra sky band on top
      const bg=curBg();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージのパレット色を薄く重ねて面ごとの雰囲気を変える(1面=みどりの草原はそのまま)
        const pi=bgOrder[(stage-1)%STAGE_BG.length];
        if(pi!==0){g.save();g.globalAlpha=0.26;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,bg.sky);tg.addColorStop(0.5,bg.mid);tg.addColorStop(1,bg.g2);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,bg.sky);grd.addColorStop(0.22,bg.mid);
        grd.addColorStop(0.44,bg.g1);grd.addColorStop(0.72,bg.g2);grd.addColorStop(1,bg.g3);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // warm sun with soft halo (upper-right)
      const sunx=api.W*0.78,suny=api.H*0.13;
      let sun=g.createRadialGradient(sunx,suny,0,sunx,suny,api.W*0.42);
      sun.addColorStop(0,"rgba(255,250,205,.55)");sun.addColorStop(0.22,"rgba(255,240,170,.28)");sun.addColorStop(1,"rgba(255,240,170,0)");
      g.fillStyle=sun;g.fillRect(0,0,api.W,api.H);
      g.save();g.shadowColor="rgba(255,245,200,.9)";g.shadowBlur=30;
      g.fillStyle="rgba(255,252,225,.9)";g.beginPath();g.arc(sunx,suny,api.W*0.045,0,TAU);g.fill();g.restore();
      // ④ 太陽ひみつタップ: 叩かれた瞬間だけ ^_^ のウインク顔が出る(発見のごほうび)
      if(sunWink>0){sunWink-=0.018*dt;const sr=api.W*0.045;
        g.save();g.strokeStyle="#d09020";g.lineWidth=Math.max(2,sr*0.13);g.lineCap="round";g.globalAlpha=clamp(sunWink*1.4,0,1);
        g.beginPath();
        g.moveTo(sunx-sr*0.44,suny-sr*0.02);g.quadraticCurveTo(sunx-sr*0.29,suny-sr*0.3,sunx-sr*0.14,suny-sr*0.02);
        g.moveTo(sunx+sr*0.14,suny-sr*0.02);g.quadraticCurveTo(sunx+sr*0.29,suny-sr*0.3,sunx+sr*0.44,suny-sr*0.02);
        g.stroke();
        g.beginPath();g.arc(sunx,suny+sr*0.14,sr*0.34,0.12*Math.PI,0.88*Math.PI);g.stroke();
        g.restore();g.globalAlpha=1;if(sunWink<0)sunWink=0;}
      // drifting clouds (soft puffs) ※画像背景のときは絵に雲があるので描かない
      g.save();g.fillStyle="#ffffff";
      if(!imgBg) for(const c of clouds){
        c.x+=c.sp*dt;if(c.x>api.W+90*c.s)c.x=-90*c.s;
        g.globalAlpha=c.a;const w=46*c.s;
        g.beginPath();
        g.ellipse(c.x,c.y,w,w*0.55,0,0,TAU);
        g.ellipse(c.x+w*0.8,c.y+w*0.12,w*0.7,w*0.45,0,0,TAU);
        g.ellipse(c.x-w*0.8,c.y+w*0.14,w*0.62,w*0.4,0,0,TAU);
        g.fill();
      }
      g.restore();g.globalAlpha=1;
      // parallax rolling hills (depth behind the field) ※画像背景のときは絵の丘を活かして描かない
      if(!imgBg) for(const hl of hills){
        hl.ph+=hl.sp*dt;
        g.fillStyle=hl.col;g.beginPath();g.moveTo(0,api.H);
        for(let x=0;x<=api.W;x+=24){
          const yy=hl.y+Math.sin(x/hl.wl*TAU+hl.ph)*hl.amp;
          g.lineTo(x,yy);
        }
        g.lineTo(api.W,api.H);g.closePath();g.fill();
      }
      // soft sun-glow vignette top
      let glow=g.createRadialGradient(api.W*0.5,api.H*0.05,0,api.W*0.5,api.H*0.05,api.W*0.7);
      glow.addColorStop(0,"rgba(255,255,210,.14)");glow.addColorStop(1,"rgba(255,255,210,0)");
      g.fillStyle=glow;g.fillRect(0,0,api.W,api.H);
      // floating glow orbs with gentle bob + soft halo (additive)
      g.save();g.globalCompositeOperation="lighter";
      for(const o of orbs){
        o.ph+=o.sp*dt;o.x+=o.drift*dt;if(o.x>api.W+10)o.x=-10;
        const oy=o.y+Math.sin(o.ph)*o.amp, pr=0.6+Math.sin(o.ph*1.7)*0.4;
        const og=g.createRadialGradient(o.x,oy,0,o.x,oy,o.r*5);
        og.addColorStop(0,o.col);og.addColorStop(0.4,"rgba(255,255,255,0)");
        g.globalAlpha=0.45*pr;g.fillStyle=og;g.beginPath();g.arc(o.x,oy,o.r*5,0,TAU);g.fill();
        g.globalAlpha=0.9*pr;g.fillStyle=o.col;g.beginPath();g.arc(o.x,oy,o.r,0,TAU);g.fill();
      }
      g.restore();g.globalAlpha=1;
      // twinkling drifting motes (cheap dust)
      g.fillStyle="#ffffff";
      for(const m of motes){
        m.x+=m.sp*0.4*dt;m.y-=m.sp*0.18*dt;m.tw+=0.05*dt;
        if(m.x>api.W)m.x=0;if(m.y<0)m.y=api.H;
        g.globalAlpha=0.10+0.10*(0.5+0.5*Math.sin(m.tw));
        g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();
      }
      g.globalAlpha=1;
      // swaying meadow flowers along the base (depth + life)
      for(const f of flowers){
        const sway=Math.sin(tGlobal*0.04+f.ph)*0.12;
        g.save();g.translate(f.x,f.y);g.rotate(sway);g.scale(f.s,f.s);
        // stem
        g.strokeStyle="rgba(40,120,70,.85)";g.lineWidth=3;g.lineCap="round";
        g.beginPath();g.moveTo(0,18);g.quadraticCurveTo(sway*14,2,0,-12);g.stroke();
        // petals
        g.fillStyle=f.col;
        for(let p=0;p<5;p++){const pa=p*TAU/5+f.ph;
          g.beginPath();g.ellipse(Math.cos(pa)*6,-12+Math.sin(pa)*6,4.5,2.6,pa,0,TAU);g.fill();}
        g.fillStyle="#fff3b0";g.beginPath();g.arc(0,-12,2.6,0,TAU);g.fill();
        g.restore();
      }
      g.globalAlpha=1;
      // holes with rim highlight
      for(const h of holes){
        g.fillStyle="rgba(0,0,0,.38)";g.beginPath();
        g.ellipse(h.x,h.y+R*0.72,R*1.08,R*0.52,0,0,TAU);g.fill();
        g.fillStyle="#0f2e20";g.beginPath();g.ellipse(h.x,h.y+R*0.7,R*0.92,R*0.42,0,0,TAU);g.fill();
        // dirt rim highlight
        g.strokeStyle="rgba(120,200,150,.25)";g.lineWidth=2;
        g.beginPath();g.ellipse(h.x,h.y+R*0.66,R*0.95,R*0.44,0,Math.PI*1.05,Math.PI*1.95);g.stroke();
      }
      // spawn (interval driven by STAGE: constant within a stage, faster across)
      const paused=clearT>0||endingT>0;
      if(!paused){spawnT-=dt;if(spawnT<=0){spawn();spawnT=clamp(52-(stage-1)*6,26,52);}
        // 画面が空っぽなら待たずに即補充（連打が空振り続きにならないように）
        if(!targets.some(t=>t.state!=="smashed")&&spawnT>8)spawnT=8;}
      // targets
      for(const t of targets){
        if(t.flash>0)t.flash-=0.08*dt;
        if(t.state==="rise"){t.up=Math.min(1,t.up+0.12*dt);if(t.up>=1)t.state="up";}
        else if(t.state==="up"){t.life-=dt*16;t.blink=t.life<320?t.life:999;if(t.life<=0){t.state="duck";}}
        else if(t.state==="duck"){t.up-=0.12*dt;if(t.up<=0){holes[t.hi].occ=false;t._dead=true;}}
        else if(t.state==="smashed"){t.squash-=0.08*dt;if(t.squash<=0)t._dead=true;}
        t.bob+=0.08*dt;
        const ease=t.state==="rise"?api.ease(t.up):1;
        const bob=t.state==="up"?Math.sin(t.bob)*R*0.05:0;
        const ty=t.baseY-((t.state==="rise"?ease:t.up)*R*1.6)-bob;
        g.save();
        // clip so it emerges from hole (でかい型=やぐら/きばこ は隣接ホールに軽く食い込む分だけ枠を広げる)
        const _cr=R*0.92*(SIZE_MUL[t.type]||1);
        const _cw=Math.max(R*1.4,_cr*1.7),_ch=Math.max(R*0.7,_cr*1.0);
        g.beginPath();g.rect(t.x-_cw,0,_cw*2,t.baseY+_ch);g.clip();
        const _sq=t.state==="smashed"?t.squash:1;
        if(t.type==="bomb")drawBomb(t,t.x,ty,_sq);
        else if(t.type==="crate")drawCrate(t,t.x,ty,_sq);
        else if(t.type==="rock")drawRock(t,t.x,ty,_sq);
        else if(t.type==="tower")drawTower(t,t.x,ty,_sq);
        else drawBot(t,t.x,ty,_sq);
        g.restore();
      }
      targets=targets.filter(t=>!t._dead);
      // ---- ボス: 更新 + 描画 (手下の上に大きく) ----
      if(boss&&!boss.dead){
        boss.weakT+=dt;boss.bob+=0.05*dt;if(boss.flash>0)boss.flash-=0.06*dt;
        boss.weak=(boss.weakT%170)<50;                 // 周期的に弱点(でんきマーク)が光る
        if(boss.weak&&!bossSeenWeak){bossSeenWeak=true;bossMsgT=1.4;}  // 初回だけ教示
        drawBoss();
      }
      // shockwave rings
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.ellipse(ri.x,ri.y,ri.r,ri.r*0.55,0,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);
      // でんき chain lightning arcs (jagged, additive, re-jittered each frame = crackle)
      if(arcs.length){g.save();g.globalCompositeOperation="lighter";g.lineCap="round";g.lineJoin="round";
        g.shadowColor="#4de0ff";g.shadowBlur=12;
        for(const ar of arcs){ar.life-=0.08*dt;
          g.globalAlpha=Math.max(0,ar.life);g.strokeStyle="#c8f6ff";g.lineWidth=3;
          g.beginPath();const seg=5;
          for(let i=0;i<=seg;i++){const tt=i/seg,jit=(i>0&&i<seg)?12:0;
            const x=lerp(ar.x1,ar.x2,tt)+rnd(-jit,jit), y=lerp(ar.y1,ar.y2,tt)+rnd(-jit,jit);
            if(i===0)g.moveTo(x,y);else g.lineTo(x,y);}
          g.stroke();}
        g.restore();g.shadowBlur=0;g.globalAlpha=1;}
      arcs=arcs.filter(ar=>ar.life>0);
      // glint sparks (additive lines)
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#fff7c2";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;
      sparks=sparks.filter(sp=>sp.life>0);
      // stars with soft glow
      for(const s of stars){s.vy+=0.3*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.rot+=s.vr*dt;s.life-=s.decay*dt;
        g.save();g.globalAlpha=Math.max(0,s.life);g.translate(s.x,s.y);g.rotate(s.rot);
        g.shadowColor=s.col;g.shadowBlur=8;g.fillStyle=s.col;
        drawStar(s.r*(0.6+s.life*0.4));g.restore();}
      g.globalAlpha=1;g.shadowBlur=0;stars=stars.filter(s=>s.life>0);
      // debris chunks: robot-colored polygon parts fall with gravity, bounce, settle
      for(const c of chunks){
        if(!c.rest){c.vy+=0.5*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=c.vr*dt;
          if(c.y>=groundY-2){c.y=groundY-2;c.vy*=-0.42;c.vx*=0.7;c.vr*=0.6;
            if(Math.abs(c.vy)<1.3){c.vy=0;c.rest=true;}}}
        if(c.rest)c.life-=c.decay*1.6*dt;else c.life-=c.decay*0.35*dt;
        g.save();g.globalAlpha=Math.max(0,c.life);g.translate(c.x,c.y);g.rotate(c.rot);
        const p=c.pts,s=c.s;
        g.beginPath();g.moveTo(p[0][0]*s,p[0][1]*s);
        for(let i=1;i<p.length;i++)g.lineTo(p[i][0]*s,p[i][1]*s);g.closePath();
        g.fillStyle=c.col;g.fill();
        g.save();g.clip();g.fillStyle="rgba(0,0,0,.28)";
        g.beginPath();g.moveTo(0,-s);g.lineTo(s,s);g.lineTo(-s,s);g.closePath();g.fill();g.restore();
        g.lineWidth=Math.max(1,s*0.09);g.strokeStyle="rgba(255,255,255,.4)";g.stroke();
        g.restore();}
      g.globalAlpha=1;chunks=chunks.filter(c=>c.life>0);
      // cursor follow: glide the hammer toward the pointer (magic-wand feel)
      if(cur.has){cur.x=lerp(cur.x,cur.tx,clamp(0.22*dt,0,1));cur.y=lerp(cur.y,cur.ty,clamp(0.22*dt,0,1));}
      const swinging=hammer.t<1;
      if(swinging)hammer.t+=0.12*dt;
      // hammer rest position follows the cursor when not mid-swing
      // 軸6対策: アイドル時は画面上部の危険帯(祝福バナー付近)に長居させない下限をつける。スイング中はそのまま。
      const hxp=swinging?hammer.x:cur.x, hyp=swinging?hammer.y:Math.max(cur.y+R*0.4,api.H*0.4);
      // sparkle trail dripping off the head while it follows
      if(cur.has&&(swinging||Math.hypot(cur.tx-cur.x,cur.ty-cur.y)>R*0.4)){
        if(tGlobal%2<dt)trail.push({x:hxp+rnd(-R*0.3,R*0.3),y:hyp-R*0.6+rnd(-R*0.3,R*0.3),
          r:rnd(2,5),life:1,col:pick(["#fff7c2","#bfe9ff","#ffd2f0"])});
      }
      g.save();g.globalCompositeOperation="lighter";
      for(const tr of trail){tr.y-=0.4*dt;tr.life-=0.05*dt;
        g.globalAlpha=Math.max(0,tr.life)*0.8;g.fillStyle=tr.col;
        g.beginPath();g.arc(tr.x,tr.y,tr.r,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      trail=trail.filter(tr=>tr.life>0);if(trail.length>60)trail.splice(0,trail.length-60);
      // hammer itself - grows bigger as combo climbs (visible upgrade reward)
      if(cur.has){
        const a=swinging?(-0.8+Math.sin(Math.min(hammer.t,1)*Math.PI)*1.6)
                        :(-0.5+Math.sin(tGlobal*0.05)*0.18); // gentle idle bob
        const hsc=1+clamp(combo,0,8)*0.06; // up to ~1.48x
        drawHammer(hxp,hyp,a,hsc);
      }
      // full-screen climax color-wash (peaks then fades)
      if(climax>0){
        const cw=g.createRadialGradient(api.W/2,api.H*0.45,0,api.W/2,api.H*0.45,api.W*0.6);
        cw.addColorStop(0,"rgba(255,250,210,"+(0.30*climax)+")");
        cw.addColorStop(0.5,"rgba(255,200,120,"+(0.15*climax)+")");
        cw.addColorStop(1,"rgba(255,160,90,0)");
        g.save();g.globalCompositeOperation="lighter";g.fillStyle=cw;g.fillRect(0,0,api.W,api.H);g.restore();
        climax-=0.08*dt;if(climax<0)climax=0;
      }
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      // combo text with pop + glow
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.16);g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(255,140,40,.8)";g.shadowBlur=14;
        g.fillStyle="#ffd23f";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.6)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // でんき チェイン! banner (teaches the row/col chain across plays; center = HUD安全帯)
      if(zapMsgT>0){zapMsgT-=0.016*dt;
        const pop=1+Math.max(0,zapMsgT-0.8)*1.4;
        g.save();g.translate(api.W/2,safeY(api.H*0.25));g.scale(pop,pop);
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(zapMsgT*1.4,0,1);
        g.shadowColor="rgba(77,224,255,.9)";g.shadowBlur=16;
        g.fillStyle="#c8f6ff";g.fillText("でんき チェイン!",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,120,160,.7)";
        g.strokeText("でんき チェイン!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(zapMsgT<0)zapMsgT=0;}
      // ボス弱点の教示: 「ピカッたら いまだ!」(center = HUD安全帯)
      if(bossMsgT>0){bossMsgT-=0.016*dt;
        const pop=1+Math.max(0,bossMsgT-1)*1.4;
        g.save();g.translate(api.W/2,safeY(api.H*0.2));g.scale(pop,pop);
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(bossMsgT*1.4,0,1);
        g.shadowColor="rgba(255,220,60,.9)";g.shadowBlur=16;
        g.fillStyle="#ffe23f";g.fillText("ピカッたら いまだ!",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(160,110,20,.7)";
        g.strokeText("ピカッたら いまだ!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(bossMsgT<0)bossMsgT=0;}
      // ① にじいろロボ! 発見バナー(虹色に色替わり)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.4,col=TC[Math.floor(tGlobal*0.1)%TC.length];
        g.save();g.translate(api.W/2,safeY(api.H*0.22));g.scale(pop,pop);
        g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.shadowColor=col;g.shadowBlur=18;
        g.fillStyle="#ffffff";g.fillText("にじいろロボ!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろロボ!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ② ラッキー! バナー(今日のラッキー色で)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        const pop=1+Math.max(0,luckyMsgT-0.8)*1.3;
        g.save();g.translate(api.W/2,safeY(api.H*0.31));g.scale(pop,pop);
        g.font="900 26px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.5,0,1);g.shadowColor=luckyColor;g.shadowBlur=14;
        g.fillStyle="#fff7c2";g.fillText("ラッキー! "+TCNAME[TC.indexOf(luckyColor)]+"は あたり",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ ノーミス ボーナス! バナー(ステージ突破の下側=クリア文字と重ねない)
      if(noMissT>0){noMissT-=0.014*dt;
        const pop=1+Math.max(0,noMissT-1.3)*1.4;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(noMissT*1.3,0,1);g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=16;
        g.fillStyle="#c7ffcf";g.fillText("ノーミス ボーナス!",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,120,60,.7)";g.strokeText("ノーミス ボーナス!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(noMissT<0)noMissT=0;}
      // 必殺どっかん white screen-flash(まぶしすぎ防止に控えめ+早く引く)
      if(novaT>0){g.save();g.globalAlpha=Math.min(novaT,1)*0.4;g.fillStyle="#ffffff";
        g.fillRect(0,0,api.W,api.H);g.restore();novaT-=0.08*dt;if(novaT<0)novaT=0;}
      // ---- HUD: stage label + "あと◯ぴき" progress gauge ----
      drawHUD();
      // ---- STAGE CLEAR banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.5;g.fillStyle="#000";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,170,40,.9)";g.shadowBlur=20;g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア!",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("つぎは ステージ"+(clearStage+1)+"!",0,42);
        // 次回予告: 次に出る新要素のミニアイコン + ラベル(エスカレート感)
        const nx=clearStage+1;let pvType=null,pvTxt="";
        if(nx===2){pvType="zap";pvTxt="でんきロボ とうじょう!";}
        else if(nx===3){pvType="gold";pvTxt="きんピカロボ とうじょう!";}
        else if(nx===4){pvType="bomb";pvTxt="ばくだんに ちゅうい!";}
        else if(nx>=5){pvType="boss";pvTxt="つぎは ボス!";}
        if(pvType){g.font="800 20px 'Hiragino Maru Gothic ProN',system-ui";
          drawMiniEnemy(-124,82,15,pvType);
          g.textAlign="left";g.fillStyle="#ffe6a0";g.fillText(pvTxt,-100,88);g.textAlign="center";}
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=20;}
      }
      // ---- ぜんぶクリア! ending ----
      if(endingT>0){endingT-=0.012*dt;
        const a=clamp(endingT,0,1);
        g.save();g.globalAlpha=a*0.45;g.fillStyle="#1a0b2e";g.fillRect(0,0,api.W,api.H);g.restore();
        // celebratory confetti rain
        if(tGlobal%1<dt)stars.push({x:rnd(0,api.W),y:-10,vx:rnd(-1,1),vy:rnd(2,5),r:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.01,col:pick(TC)});
        const pop=1+Math.sin(tGlobal*0.12)*0.06;
        g.save();g.translate(api.W/2,api.H*0.42);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 56px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,210,60,1)";g.shadowBlur=26;g.fillStyle="#ffd23f";
        g.fillText("ぜんぶ クリア!",0,0);
        g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle="#fff";g.strokeText("ぜんぶ クリア!",0,0);
        g.font="800 26px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("すごい! もういちど あそべるよ",0,50);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(endingT<=0){endingT=0;stage=1;stageGoal=stageGoalFor(1);stageKill=0;combo=0;
          boss=null;bossSeenWeak=false;stageMiss=0;luckyColor=pick(TC);luckySeen=false;
          shuffleBg();rollModifier();buildBg();spawnT=20;}
      }
    }
  };
  function drawHUD(){
    // top stage label + progress gauge ("あと◯ぴき")。ボス戦はゲージを隠して専用ラベル。
    const bossFight=boss&&!boss.dead;
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.045;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(0,0,0,.5)";g.shadowBlur=6;
    const top=bossFight?("ステージ "+stage+" / "+STAGES+"      ボスを たおせ!")
                       :("ステージ "+stage+" / "+STAGES+"      あと "+left+" ぴき");
    g.fillText(top,api.W/2,by-8);
    g.shadowBlur=0;
    if(!bossFight){
      // gauge track
      g.fillStyle="rgba(0,0,0,.35)";roundRect(bx,by,bw,bh,bh/2);g.fill();
      const fr=clamp(stageKill/stageGoal,0,1);
      if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
        gg.addColorStop(0,"#7be08a");gg.addColorStop(1,"#ffd23f");
        g.fillStyle=gg;roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
      g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;roundRect(bx,by,bw,bh,bh/2);g.stroke();
    }
    // 今回のモディファイア名を小さく表示（毎プレイの変化を見せる / top-center安全帯）
    if(modName){g.font="800 13px 'Hiragino Maru Gothic ProN',system-ui";
      g.fillStyle="rgba(255,255,255,.85)";g.shadowColor="rgba(0,0,0,.4)";g.shadowBlur=4;
      g.fillText("きょうは "+modName,api.W/2,by+bh+16);g.shadowBlur=0;}
    g.restore();g.textAlign="left";
  }
  function drawBot(t,x,y,sq){const big=t.type==="big",gold=t.type==="gold",zap=t.type==="zap",rainbow=t.type==="rainbow";
    // にじいろロボは体色が5色を巡回(にじ色に見える)。lightenが使えるようhexのまま切替。
    const baseCol=rainbow?TC[Math.floor(tGlobal*0.06)%TC.length]:t.color;
    const r=R*0.92*(SIZE_MUL[t.type]||1);
    g.save();g.translate(x,y);g.scale(1,sq);
    // にじいろロボ: 5色の虹の輪が回る華やかオーラ(激レアの合図)
    if(rainbow){g.save();g.globalCompositeOperation="lighter";
      const rp=0.5+0.5*Math.sin(tGlobal*0.5);
      const ag=g.createRadialGradient(0,-r*0.1,0,0,-r*0.1,r*2.0);
      ag.addColorStop(0,"rgba(255,255,255,"+(0.5*rp)+")");
      ag.addColorStop(0.5,"rgba(180,230,255,"+(0.22*rp)+")");
      ag.addColorStop(1,"rgba(180,230,255,0)");
      g.fillStyle=ag;g.beginPath();g.arc(0,-r*0.1,r*2.0,0,TAU);g.fill();
      g.lineWidth=3;
      for(let k=0;k<TC.length;k++){g.strokeStyle=TC[k];g.globalAlpha=0.5*rp;
        g.beginPath();g.arc(0,-r*0.1,r*(1.12+k*0.08),tGlobal*0.05+k,tGlobal*0.05+k+1.1);g.stroke();}
      g.restore();g.globalAlpha=1;}
    // gold/big shiny aura (gold blinks fast since it's short-lived)
    if(gold){g.save();g.globalCompositeOperation="lighter";
      const gp=0.5+0.5*Math.sin(tGlobal*0.4);
      const ag=g.createRadialGradient(0,-r*0.1,0,0,-r*0.1,r*1.8);
      ag.addColorStop(0,"rgba(255,240,150,"+(0.6*gp)+")");ag.addColorStop(1,"rgba(255,240,150,0)");
      g.fillStyle=ag;g.beginPath();g.arc(0,-r*0.1,r*1.8,0,TAU);g.fill();g.restore();}
    // でんき: pulsing electric aura + crackling rim bolts (clearly "special / zappy")
    if(zap){g.save();g.globalCompositeOperation="lighter";
      const zp=0.5+0.5*Math.sin(tGlobal*0.6);
      const ag=g.createRadialGradient(0,-r*0.1,0,0,-r*0.1,r*1.9);
      ag.addColorStop(0,"rgba(130,235,255,"+(0.55*zp)+")");ag.addColorStop(1,"rgba(130,235,255,0)");
      g.fillStyle=ag;g.beginPath();g.arc(0,-r*0.1,r*1.9,0,TAU);g.fill();
      g.strokeStyle="rgba(210,248,255,"+(0.5+0.4*zp)+")";g.lineWidth=2;g.shadowColor="#4de0ff";g.shadowBlur=8;
      for(let b=0;b<3;b++){const a0=tGlobal*0.09+b*TAU/3;
        g.beginPath();g.moveTo(Math.cos(a0)*r*0.9,Math.sin(a0)*r*0.9-r*0.1);
        g.lineTo(Math.cos(a0+0.28)*r*1.28+rnd(-3,3),Math.sin(a0+0.28)*r*1.28-r*0.1+rnd(-3,3));
        g.lineTo(Math.cos(a0)*r*1.5+rnd(-3,3),Math.sin(a0)*r*1.5-r*0.1+rnd(-3,3));g.stroke();}
      g.restore();g.shadowBlur=0;}
    g.fillStyle="rgba(0,0,0,.22)";g.beginPath();g.ellipse(0,r*0.72,r*0.82,r*0.3,0,0,TAU);g.fill();
    // 画像ロボ: 白ベースのスプライトを体色で着色(ラッキー色/にじいろの色替えを画像でも維持)
    const spr=api.tinted("robot.png",baseCol,rainbow?0.6:0.55);
    if(spr){
      api.drawSrc(spr,0,-r*0.05,r*2.25,r*2.25,{center:true});
      if(t.flash>0){g.save();g.globalAlpha=t.flash*0.7;g.fillStyle="#fff";g.beginPath();g.arc(0,-r*0.05,r*0.95,0,TAU);g.fill();g.restore();}
      if(big&&t.hp<=1){g.strokeStyle="rgba(40,40,40,.65)";g.lineWidth=2.5;g.lineCap="round";
        g.beginPath();g.moveTo(-r*0.1,-r*0.7);g.lineTo(r*0.08,-r*0.25);g.lineTo(-r*0.12,r*0.1);g.lineTo(r*0.06,r*0.5);g.stroke();}
      if(zap){g.save();g.shadowColor="#ffe23f";g.shadowBlur=7;g.fillStyle="#fff23f";
        g.beginPath();g.moveTo(r*0.12,r*0.02);g.lineTo(-r*0.16,r*0.34);g.lineTo(0,r*0.34);
        g.lineTo(-r*0.14,r*0.66);g.lineTo(r*0.24,r*0.24);g.lineTo(r*0.05,r*0.24);g.closePath();g.fill();g.restore();}
      if((big||t.type==="bot")&&t.color===luckyColor){
        const lp=0.55+0.45*Math.sin(tGlobal*0.22);
        g.save();g.globalCompositeOperation="lighter";g.translate(r*0.5,-r*1.5);
        g.globalAlpha=lp;g.fillStyle="#fff7c2";drawStar(r*0.18*lp);g.restore();g.globalAlpha=1;}
      g.restore();return;
    }
    // body radial gradient for round soft look
    const grd=g.createRadialGradient(-r*0.25,-r*0.45,r*0.1,0,0,r*1.3);
    grd.addColorStop(0,lighten(baseCol,80));grd.addColorStop(0.55,lighten(baseCol,20));grd.addColorStop(1,baseCol);
    g.fillStyle=grd;roundRect(-r*0.7,-r,r*1.4,r*1.9,r*0.5);g.fill();
    // でかロボ: show a crack after the first dent
    if(big&&t.hp<=1){g.strokeStyle="rgba(40,40,40,.6)";g.lineWidth=2.5;g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.1,-r*0.7);g.lineTo(r*0.08,-r*0.25);g.lineTo(-r*0.12,r*0.1);g.lineTo(r*0.06,r*0.5);g.stroke();}
    // hit-flash overlay (big bot dent)
    if(t.flash>0){g.save();g.globalAlpha=t.flash*0.7;g.fillStyle="#fff";
      roundRect(-r*0.7,-r,r*1.4,r*1.9,r*0.5);g.fill();g.restore();}
    // rim light
    g.strokeStyle="rgba(255,255,255,.25)";g.lineWidth=2;roundRect(-r*0.7,-r,r*1.4,r*1.9,r*0.5);g.stroke();
    // glossy top sheen
    g.fillStyle="rgba(255,255,255,.28)";g.beginPath();
    g.ellipse(-r*0.18,-r*0.55,r*0.4,r*0.22,-0.3,0,TAU);g.fill();
    // でんき: bright lightning-bolt badge on the belly (recognizable at a glance)
    if(zap){g.save();g.shadowColor="#ffe23f";g.shadowBlur=7;g.fillStyle="#fff23f";
      g.beginPath();
      g.moveTo(r*0.12,r*0.02);g.lineTo(-r*0.16,r*0.34);g.lineTo(0,r*0.34);
      g.lineTo(-r*0.14,r*0.66);g.lineTo(r*0.24,r*0.24);g.lineTo(r*0.05,r*0.24);g.closePath();g.fill();
      g.restore();}
    // antenna
    g.strokeStyle="#3a3a3a";g.lineWidth=3;g.beginPath();g.moveTo(0,-r);g.lineTo(0,-r*1.4);g.stroke();
    g.save();g.shadowColor="#ff5b5b";g.shadowBlur=8;
    g.fillStyle="#ff3b3b";g.beginPath();g.arc(0,-r*1.45,r*0.13,0,TAU);g.fill();g.restore();
    // ② ラッキー色のロボだけ、頭の上で小さな星がキラッ(=気づける秘密のヒント)
    if((big||t.type==="bot")&&t.color===luckyColor){
      const lp=0.55+0.45*Math.sin(tGlobal*0.22);
      g.save();g.globalCompositeOperation="lighter";g.translate(r*0.5,-r*1.5);
      g.globalAlpha=lp;g.fillStyle="#fff7c2";drawStar(r*0.18*lp);g.restore();g.globalAlpha=1;}
    // eyes (with blink when about to leave)
    const blinking=t.blink!==undefined&&t.blink!==999&&Math.floor(t.blink/40)%2===0;
    if(blinking){
      g.strokeStyle="#222";g.lineWidth=r*0.08;g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.42,-r*0.2);g.lineTo(-r*0.14,-r*0.2);
      g.moveTo(r*0.14,-r*0.2);g.lineTo(r*0.42,-r*0.2);g.stroke();
    }else{
      g.fillStyle="#fff";g.beginPath();g.arc(-r*0.28,-r*0.2,r*0.23,0,TAU);g.arc(r*0.28,-r*0.2,r*0.23,0,TAU);g.fill();
      g.fillStyle="#222";g.beginPath();g.arc(-r*0.26,-r*0.16,r*0.11,0,TAU);g.arc(r*0.3,-r*0.16,r*0.11,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.9)";g.beginPath();
      g.arc(-r*0.3,-r*0.22,r*0.04,0,TAU);g.arc(r*0.26,-r*0.22,r*0.04,0,TAU);g.fill();
    }
    // cheeks
    g.fillStyle="rgba(255,120,120,.35)";g.beginPath();
    g.arc(-r*0.42,-r*0.02,r*0.12,0,TAU);g.arc(r*0.42,-r*0.02,r*0.12,0,TAU);g.fill();
    g.restore();}
  function drawBomb(t,x,y,sq){const r=R*0.86;
    g.save();g.translate(x,y);g.scale(1,sq);
    g.fillStyle="rgba(0,0,0,.22)";g.beginPath();g.ellipse(0,r*0.78,r*0.8,r*0.28,0,0,TAU);g.fill();
    // round black bomb body
    const grd=g.createRadialGradient(-r*0.3,-r*0.4,r*0.1,0,0,r*1.2);
    grd.addColorStop(0,"#5a5a66");grd.addColorStop(0.6,"#2a2a33");grd.addColorStop(1,"#141419");
    g.fillStyle=grd;g.beginPath();g.arc(0,0,r*0.86,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.3)";g.beginPath();g.ellipse(-r*0.28,-r*0.34,r*0.2,r*0.12,-0.4,0,TAU);g.fill();
    // fuse cap + sparkling fuse (warns "don't hit!")
    g.fillStyle="#8a6a3a";g.fillRect(-r*0.16,-r*1.05,r*0.32,r*0.28);
    g.strokeStyle="#caa15a";g.lineWidth=r*0.1;g.lineCap="round";
    g.beginPath();g.moveTo(0,-r*1.05);g.quadraticCurveTo(r*0.4,-r*1.4,r*0.18,-r*1.6);g.stroke();
    const fp=0.5+0.5*Math.sin(tGlobal*0.5);
    g.save();g.globalCompositeOperation="lighter";g.shadowColor="#ff8a3b";g.shadowBlur=12;
    g.fillStyle="rgba(255,180,80,"+(0.6+0.4*fp)+")";
    g.beginPath();g.arc(r*0.18,-r*1.6,r*0.12*(0.7+0.5*fp),0,TAU);g.fill();g.restore();
    // angry warning face
    g.strokeStyle="#ff5b5b";g.lineWidth=r*0.09;g.lineCap="round";
    g.beginPath();g.moveTo(-r*0.4,-r*0.32);g.lineTo(-r*0.14,-r*0.18);
    g.moveTo(r*0.4,-r*0.32);g.lineTo(r*0.14,-r*0.18);g.stroke();
    g.fillStyle="#ff5b5b";g.beginPath();g.arc(-r*0.27,-r*0.08,r*0.09,0,TAU);g.arc(r*0.27,-r*0.08,r*0.09,0,TAU);g.fill();
    g.restore();}
  // ⑤ いわ: 人型ロボと違う丸い輪郭のシルエット(小さめ・1発で割れる)
  function drawRock(t,x,y,sq){
    const r=R*0.92*SIZE_MUL.rock;
    g.save();g.translate(x,y);g.scale(1,sq);
    g.fillStyle="rgba(0,0,0,.22)";g.beginPath();g.ellipse(0,r*0.7,r*0.78,r*0.28,0,0,TAU);g.fill();
    const pts=[[-0.62,-0.05],[-0.42,-0.62],[0.05,-0.82],[0.55,-0.5],[0.7,0.05],[0.5,0.55],[-0.1,0.72],[-0.6,0.42]];
    const grd=g.createRadialGradient(-r*0.25,-r*0.35,r*0.08,0,0,Math.max(0.01,r*1.2));
    grd.addColorStop(0,lighten(t.color,55));grd.addColorStop(0.6,lighten(t.color,10));grd.addColorStop(1,t.color);
    g.fillStyle=grd;
    g.beginPath();pts.forEach(([px,py],i)=>{const xx=px*r,yy=py*r;if(i===0)g.moveTo(xx,yy);else g.lineTo(xx,yy);});
    g.closePath();g.fill();
    g.strokeStyle="rgba(255,255,255,.22)";g.lineWidth=2;g.stroke();
    // ひび割れ(いわの質感)
    g.strokeStyle="rgba(0,0,0,.28)";g.lineWidth=Math.max(1,r*0.05);g.lineCap="round";
    g.beginPath();g.moveTo(-r*0.2,-r*0.5);g.lineTo(r*0.05,-r*0.1);g.lineTo(-r*0.1,r*0.35);g.stroke();
    g.beginPath();g.moveTo(r*0.3,-r*0.3);g.lineTo(r*0.15,r*0.05);g.stroke();
    if(t.flash>0){g.save();g.globalAlpha=t.flash*0.7;g.fillStyle="#fff";
      g.beginPath();pts.forEach(([px,py],i)=>{const xx=px*r,yy=py*r;if(i===0)g.moveTo(xx,yy);else g.lineTo(xx,yy);});
      g.closePath();g.fill();g.restore();}
    // 目だけ簡単に付けて「叩いてよい的」だと分かるようにする
    const blinking=t.blink!==undefined&&t.blink!==999&&Math.floor(t.blink/40)%2===0;
    if(blinking){
      g.strokeStyle="#222";g.lineWidth=r*0.07;g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.32,-r*0.08);g.lineTo(-r*0.1,-r*0.08);
      g.moveTo(r*0.1,-r*0.08);g.lineTo(r*0.32,-r*0.08);g.stroke();
    }else{
      g.fillStyle="#fff";g.beginPath();g.arc(-r*0.2,-r*0.08,r*0.16,0,TAU);g.arc(r*0.2,-r*0.08,r*0.16,0,TAU);g.fill();
      g.fillStyle="#222";g.beginPath();g.arc(-r*0.18,-r*0.05,r*0.08,0,TAU);g.arc(r*0.22,-r*0.05,r*0.08,0,TAU);g.fill();
    }
    g.restore();
  }
  // ⑥ きばこ: 四角い木箱シルエット(1発で割れる。ロボの色違いではなく別の形)
  function drawCrate(t,x,y,sq){
    const r=R*0.92*SIZE_MUL.crate;
    g.save();g.translate(x,y);g.scale(1,sq);
    g.fillStyle="rgba(0,0,0,.22)";g.beginPath();g.ellipse(0,r*0.86,r*0.86,r*0.3,0,0,TAU);g.fill();
    const w=r*1.5,h=r*1.62,x0=-w/2,y0=-h*0.62;
    const grd=g.createLinearGradient(x0,y0,x0,y0+h);
    grd.addColorStop(0,shade(t.color,60));grd.addColorStop(0.55,t.color);grd.addColorStop(1,shade(t.color,-35));
    g.fillStyle=grd;roundRect(x0,y0,w,h,r*0.14);g.fill();
    g.strokeStyle="rgba(255,255,255,.3)";g.lineWidth=2;roundRect(x0,y0,w,h,r*0.14);g.stroke();
    // 木目の横板 + バッテン板(木箱らしさ)
    g.strokeStyle=shade(t.color,-55);g.lineWidth=Math.max(1.5,r*0.045);
    for(let i=1;i<4;i++){const yy=y0+h*i/4;g.beginPath();g.moveTo(x0+r*0.06,yy);g.lineTo(x0+w-r*0.06,yy);g.stroke();}
    g.lineWidth=Math.max(2,r*0.07);g.strokeStyle="rgba(90,55,20,.55)";
    g.beginPath();g.moveTo(x0+r*0.1,y0+r*0.1);g.lineTo(x0+w-r*0.1,y0+h-r*0.1);
    g.moveTo(x0+w-r*0.1,y0+r*0.1);g.lineTo(x0+r*0.1,y0+h-r*0.1);g.stroke();
    g.fillStyle="rgba(255,255,255,.18)";g.beginPath();g.ellipse(x0+w*0.28,y0+h*0.18,w*0.22,h*0.1,-0.2,0,TAU);g.fill();
    if(t.flash>0){g.save();g.globalAlpha=t.flash*0.7;g.fillStyle="#fff";roundRect(x0,y0,w,h,r*0.14);g.fill();g.restore();}
    g.restore();
  }
  // ⑦ やぐら: 積み箱を3段重ねた「でかい構造物」。1段ずつ崩れ落ちる(t.hpが残り段数)
  function drawTower(t,x,y,sq){
    const r=R*0.92*SIZE_MUL.tower;
    g.save();g.translate(x,y);g.scale(1,sq);
    g.fillStyle="rgba(0,0,0,.24)";g.beginPath();g.ellipse(0,r*0.92,r*0.9,r*0.3,0,0,TAU);g.fill();
    const segW=r*1.3,segH=r*0.78,segs=3,gap=segH*0.06,baseY=r*0.7;
    for(let i=0;i<segs;i++){
      if(i>=t.hp)continue; // 崩れた段はもう描かない
      const y0=baseY-(i+1)*segH-i*gap,x0=-segW/2;
      const grd=g.createLinearGradient(x0,y0,x0,y0+segH);
      grd.addColorStop(0,shade(t.color,55));grd.addColorStop(0.55,t.color);grd.addColorStop(1,shade(t.color,-35));
      g.fillStyle=grd;roundRect(x0,y0,segW,segH,r*0.1);g.fill();
      g.strokeStyle="rgba(255,255,255,.3)";g.lineWidth=2;roundRect(x0,y0,segW,segH,r*0.1);g.stroke();
      g.strokeStyle="rgba(90,55,20,.5)";g.lineWidth=Math.max(1.5,r*0.045);
      g.beginPath();g.moveTo(x0+r*0.08,y0+segH*0.5);g.lineTo(x0+segW-r*0.08,y0+segH*0.5);g.stroke();
      if(i===t.hp-1&&t.flash>0){g.save();g.globalAlpha=t.flash*0.7;g.fillStyle="#fff";roundRect(x0,y0,segW,segH,r*0.1);g.fill();g.restore();}
    }
    g.restore();
  }
  function drawBoss(){
    const b=boss,x=b.x,y=b.y+Math.sin(b.bob)*6,r=b.r,zp=0.5+0.5*Math.sin(tGlobal*0.6);
    // 弱点が光っている時のオーラ(=いまだ!の合図)
    if(b.weak){g.save();g.globalCompositeOperation="lighter";
      const ag=g.createRadialGradient(x,y,0,x,y,r*1.9);
      ag.addColorStop(0,"rgba(255,230,90,"+(0.5*zp)+")");ag.addColorStop(1,"rgba(255,230,90,0)");
      g.fillStyle=ag;g.beginPath();g.arc(x,y,r*1.9,0,TAU);g.fill();g.restore();}
    g.fillStyle="rgba(0,0,0,.25)";g.beginPath();g.ellipse(x,y+r*0.98,r*0.95,r*0.3,0,0,TAU);g.fill();
    g.save();g.translate(x,y);
    // 画像ボス: 弱点が光る時は赤みに着色した複製を描く。被弾フラッシュだけ重ねる
    const bimg=api.asset("boss.png");
    const bsrc=bimg.ready?(b.weak?(api.tinted("boss.png","#ff5a3a",0.45)||bimg):bimg):null;
    const useImg=!!bsrc;
    if(useImg){
      api.drawSrc(bsrc,0,0,r*2.3,r*2.3,{center:true});
      if(b.flash>0){g.save();g.globalAlpha=b.flash*0.6;g.fillStyle="#fff";g.beginPath();g.arc(0,0,r*1.05,0,TAU);g.fill();g.restore();}
    } else {
    const bodyCol=b.weak?"#c9553a":"#5a6a7a";
    // shoulders
    g.fillStyle=bodyCol;g.beginPath();g.arc(-r*0.82,-r*0.05,r*0.34,0,TAU);g.arc(r*0.82,-r*0.05,r*0.34,0,TAU);g.fill();
    // body
    const grd=g.createRadialGradient(-r*0.3,-r*0.4,r*0.1,0,0,r*1.4);
    grd.addColorStop(0,lighten(bodyCol,80));grd.addColorStop(0.6,lighten(bodyCol,20));grd.addColorStop(1,bodyCol);
    g.fillStyle=grd;roundRect(-r*0.78,-r*0.9,r*1.56,r*1.8,r*0.4);g.fill();
    if(b.flash>0){g.save();g.globalAlpha=b.flash*0.6;g.fillStyle="#fff";roundRect(-r*0.78,-r*0.9,r*1.56,r*1.8,r*0.4);g.fill();g.restore();}
    g.strokeStyle="rgba(255,255,255,.3)";g.lineWidth=3;roundRect(-r*0.78,-r*0.9,r*1.56,r*1.8,r*0.4);g.stroke();
    // glossy sheen
    g.fillStyle="rgba(255,255,255,.22)";g.beginPath();g.ellipse(-r*0.2,-r*0.55,r*0.4,r*0.18,-0.3,0,TAU);g.fill();
    // eyes (angry)
    g.fillStyle="#fff";g.beginPath();g.arc(-r*0.3,-r*0.36,r*0.2,0,TAU);g.arc(r*0.3,-r*0.36,r*0.2,0,TAU);g.fill();
    g.fillStyle="#c0202a";g.beginPath();g.arc(-r*0.28,-r*0.34,r*0.09,0,TAU);g.arc(r*0.32,-r*0.34,r*0.09,0,TAU);g.fill();
    g.strokeStyle="#222";g.lineWidth=r*0.08;g.lineCap="round";
    g.beginPath();g.moveTo(-r*0.52,-r*0.62);g.lineTo(-r*0.12,-r*0.46);g.moveTo(r*0.52,-r*0.62);g.lineTo(r*0.12,-r*0.46);g.stroke();
    }
    // でんき弱点マーク(おなか): 光ると大ダメージ(画像/手描き共通)
    g.save();
    if(b.weak){g.shadowColor="#ffe23f";g.shadowBlur=14+8*zp;g.fillStyle="#fff23f";}
    else{g.globalAlpha=0.45;g.fillStyle="#8a97a5";}
    g.beginPath();
    g.moveTo(r*0.14,r*0.02);g.lineTo(-r*0.22,r*0.42);g.lineTo(0,r*0.42);
    g.lineTo(-r*0.2,r*0.82);g.lineTo(r*0.32,r*0.28);g.lineTo(r*0.06,r*0.28);g.closePath();g.fill();
    g.restore();
    if(!useImg){
    // antenna
    g.strokeStyle="#333";g.lineWidth=4;g.beginPath();g.moveTo(0,-r*0.9);g.lineTo(0,-r*1.28);g.stroke();
    g.save();g.shadowColor="#ff5b5b";g.shadowBlur=8;g.fillStyle="#ff3b3b";
    g.beginPath();g.arc(0,-r*1.33,r*0.12,0,TAU);g.fill();g.restore();
    }
    g.restore();
    // HP bar above the boss (centered game element)
    const hw=r*1.7,hx=x-hw/2,hy=y-r*1.55,hh=13;
    g.save();
    g.fillStyle="rgba(0,0,0,.42)";roundRect(hx-3,hy-3,hw+6,hh+6,(hh+6)/2);g.fill();
    const fr=b.hp/b.maxHp;
    if(fr>0){const gg=g.createLinearGradient(hx,0,hx+hw,0);
      gg.addColorStop(0,"#ff5b5b");gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg;roundRect(hx,hy,Math.max(hh,hw*fr),hh,hh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=2;roundRect(hx,hy,hw,hh,hh/2);g.stroke();
    g.restore();
  }
  function drawMiniEnemy(x,y,mr,type){
    g.save();g.translate(x,y);
    if(type==="boss"){
      g.fillStyle="#5a6a7a";roundRect(-mr*0.8,-mr*0.85,mr*1.6,mr*1.6,mr*0.4);g.fill();
      g.fillStyle="#c0202a";g.beginPath();g.arc(-mr*0.3,-mr*0.3,mr*0.13,0,TAU);g.arc(mr*0.3,-mr*0.3,mr*0.13,0,TAU);g.fill();
      g.fillStyle="#fff23f";g.beginPath();g.moveTo(mr*0.1,0);g.lineTo(-mr*0.16,mr*0.3);g.lineTo(0,mr*0.3);
      g.lineTo(-mr*0.14,mr*0.62);g.lineTo(mr*0.24,mr*0.2);g.lineTo(mr*0.05,mr*0.2);g.closePath();g.fill();
    }else if(type==="bomb"){
      g.fillStyle="#1a1a20";g.beginPath();g.arc(0,mr*0.12,mr*0.72,0,TAU);g.fill();
      g.fillStyle="#8a6a3a";g.fillRect(-mr*0.14,-mr*0.85,mr*0.28,mr*0.22);
      g.fillStyle="#ff5b5b";g.beginPath();g.arc(-mr*0.24,mr*0.02,mr*0.09,0,TAU);g.arc(mr*0.24,mr*0.02,mr*0.09,0,TAU);g.fill();
    }else{
      const col=type==="gold"?"#ffd23f":type==="zap"?"#2fd8f0":"#4db8ff";
      g.fillStyle=col;roundRect(-mr*0.6,-mr*0.8,mr*1.2,mr*1.55,mr*0.45);g.fill();
      g.fillStyle="#fff";g.beginPath();g.arc(-mr*0.24,-mr*0.18,mr*0.16,0,TAU);g.arc(mr*0.24,-mr*0.18,mr*0.16,0,TAU);g.fill();
      g.fillStyle="#222";g.beginPath();g.arc(-mr*0.22,-mr*0.15,mr*0.08,0,TAU);g.arc(mr*0.26,-mr*0.15,mr*0.08,0,TAU);g.fill();
      if(type==="zap"){g.fillStyle="#fff23f";g.beginPath();g.moveTo(mr*0.08,mr*0.02);g.lineTo(-mr*0.14,mr*0.3);
        g.lineTo(0,mr*0.3);g.lineTo(-mr*0.12,mr*0.56);g.lineTo(mr*0.2,mr*0.2);g.lineTo(mr*0.04,mr*0.2);g.closePath();g.fill();}
    }
    g.restore();}
  function drawHammer(x,y,ang,scl){g.save();g.translate(x,y-R*0.4);g.rotate(ang);if(scl)g.scale(scl,scl);
    // soft magic aura around the head (additive glow, gently pulsing)
    const pulse=0.6+0.4*Math.sin(tGlobal*0.08);
    g.save();g.globalCompositeOperation="lighter";
    const aura=g.createRadialGradient(0,-R*0.15,0,0,-R*0.15,R*1.3);
    aura.addColorStop(0,"rgba(255,245,180,"+(0.5*pulse)+")");
    aura.addColorStop(0.5,"rgba(180,230,255,"+(0.18*pulse)+")");
    aura.addColorStop(1,"rgba(180,230,255,0)");
    g.fillStyle=aura;g.beginPath();g.arc(0,-R*0.15,R*1.3,0,TAU);g.fill();g.restore();
    // 画像ハンマー(頭が上・柄が下)。きらめき星だけ重ねる
    if(api.drawAsset("hammer.png",0,R*0.5,R*2.4,R*2.4,{center:true})){
      g.save();g.translate(R*0.5,-R*0.62);g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(255,250,200,"+(0.7+0.3*pulse)+")";drawStar(R*0.16*pulse);g.restore();
      g.restore();return;}
    // handle
    g.strokeStyle="#8a5a2a";g.lineWidth=R*0.18;g.lineCap="round";g.beginPath();g.moveTo(0,0);g.lineTo(0,R*1.6);g.stroke();
    g.strokeStyle="rgba(255,220,160,.4)";g.lineWidth=R*0.06;g.beginPath();g.moveTo(-R*0.03,R*0.1);g.lineTo(-R*0.03,R*1.5);g.stroke();
    // head with metal gradient
    const hg=g.createLinearGradient(0,-R*0.5,0,R*0.2);
    hg.addColorStop(0,"#dbe6f0");hg.addColorStop(0.5,"#9aa6b2");hg.addColorStop(1,"#6f7b87");
    g.fillStyle=hg;roundRect(-R*0.7,-R*0.5,R*1.4,R*0.7,8);g.fill();
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;roundRect(-R*0.7,-R*0.5,R*1.4,R*0.7,8);g.stroke();
    g.fillStyle="rgba(255,255,255,.5)";g.fillRect(-R*0.66,-R*0.46,R*1.32,R*0.15);
    // tiny cute face on the hammer head (little buddy)
    g.fillStyle="#2b2b3a";
    g.beginPath();g.arc(-R*0.2,-R*0.16,R*0.07,0,TAU);g.arc(R*0.2,-R*0.16,R*0.07,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.85)";
    g.beginPath();g.arc(-R*0.22,-R*0.19,R*0.025,0,TAU);g.arc(R*0.18,-R*0.19,R*0.025,0,TAU);g.fill();
    g.fillStyle="rgba(255,130,130,.45)";
    g.beginPath();g.arc(-R*0.34,-R*0.04,R*0.06,0,TAU);g.arc(R*0.34,-R*0.04,R*0.06,0,TAU);g.fill();
    g.strokeStyle="#2b2b3a";g.lineWidth=R*0.04;g.lineCap="round";
    g.beginPath();g.arc(0,-R*0.05,R*0.1,0.15*Math.PI,0.85*Math.PI);g.stroke();
    // sparkle star on top of the head
    g.save();g.translate(R*0.5,-R*0.62);g.globalCompositeOperation="lighter";
    g.fillStyle="rgba(255,250,200,"+(0.7+0.3*pulse)+")";drawStar(R*0.16*pulse);g.restore();
    g.restore();}
  function drawStar(r){g.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*0.45:r;
    g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}g.closePath();g.fill();}
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function lighten(hex,amt){const a=amt===undefined?50:amt;const c=parseInt(hex.slice(1),16);
    const r=Math.min(255,((c>>16)&255)+a),gg=Math.min(255,((c>>8)&255)+a),b=Math.min(255,(c&255)+a);
    return "rgb("+r+","+gg+","+b+")";}
  // shade: lighten(+)/darken(-) 両対応。きばこ/やぐらの木目・陰影づけに使う
  function shade(hex,amt){const c=parseInt(hex.slice(1),16);
    const r=clamp(((c>>16)&255)+amt,0,255),gg=clamp(((c>>8)&255)+amt,0,255),b=clamp((c&255)+amt,0,255);
    return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("hammer", buildHammer);
