function build_geyser(api){
  const g=api.g;
  // 画像アセット(無ければ従来の手描きにフォールバック): 夜の火山背景のみ使用
  // ※ゴールドいわ/おつきさまの生成画像は2回の作り直しでも不良(単体物にならない/マゼンタ被り)だったため
  //   コード側では使わず手描きのまま(issues参照)。ふつう/でかいわ も色替えが要るので手描きのまま。
  api.preload(["bg.jpg"]);
  // ---- all state lives here ----
  let rocks=[],jets=[],chunks=[],sparks=[],rings=[],embers=[],heat=[],floats=[];
  let groundY,R,tsec=0,count=0,combo=0,comboT=0,spawnT=0,flash=0,flashCol="#ffae3a";
  // stage progression
  const STAGES=5;
  let stage=1,stageKill=0,stageGoal=10,clearT=0,clearStage=0,endingT=0,climax=0;
  let novaT=0;
  // fever / gold / hitstop-cooldown state
  let feverG=0,feverT=0,hitCd=0;
  const RAINBOW=["#ff5b5b","#ffd23f","#7be08a","#4db8ff","#b58bff","#ff7bd0"];
  // 次ステージ予告 (index = 次のステージ番号)
  const TEASE=["","","おおきな いわが とうじょう！","いわが スピードアップ！",
    "ゴールドいわが ふえる！","きんいろ カルデラ が まってる！"];
  function hstop(f){if(hitCd<=0){api.hitStop(f);hitCd=30;}}
  // per-stage volcano palette (sky top -> lava bottom)
  const BG=[
    {s0:"#3a1640",s1:"#7a2a3a",s2:"#c24a1e",s3:"#ff8a2a"}, // 1 dusk eruption
    {s0:"#2a0f33",s1:"#6e1f3a",s2:"#b83a18",s3:"#ff6a1a"}, // 2 deep red
    {s0:"#10060f",s1:"#4a1330",s2:"#a02814",s3:"#ff5410"}, // 3 night lava
    {s0:"#3a1020",s1:"#8a2420",s2:"#d84a16",s3:"#ffb030"}, // 4 inferno
    {s0:"#1a0820",s1:"#5a1838",s2:"#c8340e",s3:"#ffd23f"}  // 5 golden caldera
  ];
  function curBg(){return BG[(stage-1)%BG.length];}
  function stageGoalFor(s){return 10+(s-1)*3;}   // 10,13,16,19,22（7〜8歳向けに手応えを2〜3割増し）
  const ROCKCOL=["#7a6a5a","#8a5a3a","#6a5a6a","#5a6a5a","#9a6a4a"];
  // ⑦ とげとげいわ 専用配色(黒っぽい溶岩ガラス質・他4色とは別系統)
  const SPIKYCOL=["#241422","#1c2432","#231616"];
  // ---- 隠し発見レイヤー (crane/punch/hammer/truck と同じ思想) ----
  const LUCKYNAME={"#7a6a5a":"はいいろ","#8a5a3a":"ちゃいろ","#6a5a6a":"むらさき","#5a6a5a":"みどり","#9a6a4a":"だいだい"};
  let luckyColor=pick(ROCKCOL),luckySeen=false,luckyMsgT=0,luckyIntro=false; // ② きょうのラッキー色: 秘密の1色。倒すとボーナス
  let rbMsgT=0;                                               // ① にじいろいわ 発見バナー
  const moon={x:0,y:0,r:0};let moonWink=0,moonCd=0;           // ④ おつきさま ひみつタップ

  function layout(){
    groundY=api.H*0.86;
    R=clamp(Math.min(api.W,api.H)*0.062,26,44); // 軸6: 標的を一回り大きく(背景に埋もれにくく)
    // keep existing rocks on-screen if resized
    for(const rk of rocks){ if(rk.x<R)rk.x=R; if(rk.x>api.W-R)rk.x=api.W-R; }
    // ④ おつきさま の当たり判定(描画位置と一致・寛容に大きめ)。四隅のUI帯を避ける。
    moon.x=api.W*0.16;moon.y=api.H*0.16;moon.r=Math.max(18,api.W*0.04);
    buildBg();
  }
  // ambient background props
  let mountains=[],bgEmber=[],glowSpots=[];
  function buildBg(){
    mountains=[
      {y:api.H*0.58,h:api.H*0.34,col:"#2a0e1a",peak:0.5},
      {y:api.H*0.66,h:api.H*0.30,col:"#3a1420",peak:0.28}
    ];
    bgEmber=[];for(let i=0;i<28;i++)bgEmber.push({x:rnd(0,api.W),y:rnd(0,api.H),
      r:rnd(1,2.8),sp:rnd(0.2,0.7),sw:rnd(8,26),ph:rnd(0,TAU),col:pick(["#ffae3a","#ff6a1a","#ffd23f"])});
    glowSpots=[];for(let i=0;i<4;i++)glowSpots.push({x:rnd(api.W*0.15,api.W*0.85),
      y:api.H*rnd(0.6,0.82),r:rnd(api.W*0.08,api.W*0.16),ph:rnd(0,TAU)});
  }
  layout();

  function spawnRock(){
    // 軸3: 同時出現の的を減らし、どこを叩いても当たる状態を無くす(16→10。9まで絞ると初得点が遅れすぎたため調整)
    if(rocks.length>10)return;
    // ① 激レアな にじいろいわ (ステージ2以降・約3%)。虹色に光り、倒すと虹の大盤振る舞い＋大量点。
    const rainbow=stage>=2&&Math.random()<0.035;
    // レアなゴールドいわ (壊すと大量点+虹色破片+ファンファーレ)
    const gold=!rainbow&&Math.random()<(stage>=4?0.12:0.07);
    const big=!rainbow&&!gold&&stage>=2&&Math.random()<0.34;   // でかいわ 少し多め(7〜8歳向け)
    // ⑦ 形のバラエティ: ふつう/でかいわ は まる・ながい・つみかさなり・とげとげ の4形状
    let shape="round";
    if(!rainbow&&!gold){
      const sroll=Math.random();
      if(sroll<0.24)shape="long";
      else if(sroll<0.46)shape="stack";
      else if(sroll<0.64)shape="spiky";
    }
    const r=R*(rainbow?1.1:gold?1.05:big?1.35:rnd(0.85,1.1));
    const dir=Math.random()<0.5?1:-1;
    const hp=(shape==="stack")?2:(big?2:1); // つみかさなりいわ も でかいわ と同じ2段仕様
    rocks.push({
      x:rnd(R*1.5,api.W-R*1.5), y:rnd(api.H*0.18,api.H*0.5),
      vx:dir*rnd(0.25,0.7)*(1+(stage-1)*0.15), vy:rnd(-0.2,0.2),
      r, hp, type:rainbow?"rainbow":gold?"gold":big?"big":"rock", shape,
      col:rainbow?"#ff5b5b":gold?"#ffd23f":shape==="spiky"?pick(SPIKYCOL):pick(ROCKCOL),
      rot:rnd(0,TAU), vr:rnd(-0.02,0.02),
      flash:0, spin:rnd(0,TAU)
    });
    if(gold){ // 出た瞬間「キラーン」と鳴らして目を引く
      api.tone(1318,0.1,"triangle",0.1);api.tone(1568,0.16,"triangle",0.1);
    }
    if(rainbow){ // 出た瞬間「くるかも！」の予告チャイム(上り3音)=ドキドキ発見
      [0,4,7].forEach((s,i)=>setTimeout(()=>api.tone(880*Math.pow(2,s/12),0.11,"triangle",0.1),i*60));
    }
  }

  function goldHit(rk,hx,hy,gain){
    flash=Math.min(1,flash+0.6);flashCol="#ffd23f";climax=1;
    api.boom(0.7);api.shake(14);hstop(5);
    [0,4,7,12].forEach((s,i)=>setTimeout(()=>api.tone(784*Math.pow(2,s/12),0.16,"triangle",0.14),i*70));
    for(let i=0;i<22;i++){if(chunks.length>=180)break;
      const a=rnd(0,TAU),s=rnd(3,9);
      chunks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.018),
        col:RAINBOW[i%RAINBOW.length]});}
    for(let i=0;i<10;i++){if(sparks.length>=80)break;
      const a=rnd(0,TAU),s=rnd(5,12);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(10,20),life:1,decay:rnd(0.04,0.07)});}
    rings.push({x:hx,y:hy,r:rk.r*0.4,vr:rk.r*0.8,life:1,decay:0.04,col:"#ffd23f"});
    rings.push({x:hx,y:hy,r:rk.r*0.2,vr:rk.r*0.5,life:1,decay:0.05,col:"#ffffff"});
    floats.push({x:hx,y:hy-rk.r,txt:"ゴールド！+"+gain,life:1,vy:-1,col:"#ffd23f",size:34});
  }

  function jetAt(x){
    // erupt a magma geyser from the ground up
    jets.push({x:clamp(x,R,api.W-R), y:groundY, h:0, maxH:api.H*rnd(0.62,0.82),
      w:R*0.52, life:1, vy:rnd(15,19), peaked:false, age:0}); // 軸3: 捕捉幅を狭めて狙いを要求(0.48まで絞ると初得点が遅れすぎたため調整)
    api.slide(120,520,0.3,0.28,"sawtooth");
    api.noise(0.35,0.32,520,"lowpass",0.7);
    api.tone(90,0.3,"sine",0.18);
    api.shake(5);
    // launch ember spray at base
    for(let i=0;i<10;i++){const a=-Math.PI/2+rnd(-0.5,0.5),s=rnd(6,13);
      embers.push({x:clamp(x,R,api.W-R)+rnd(-R*0.4,R*0.4),y:groundY,
        vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5),life:1,decay:rnd(0.02,0.04),
        col:pick(["#ffd23f","#ff8a2a","#ff5410"])});}
  }

  function hitRock(rk,hx,hy,jet){
    rk.flash=1;
    const fever=feverT>0;
    if(rk.hp>1&&!fever){ // でかいわ/つみかさなりいわ 1段目: フィーバー中は なんでも1発
      rk.hp--; rk.vy-=6;
      api.noise(0.08,0.16,1600,"highpass");api.tone(260,0.08,"square",0.12);api.shake(4);
      burst(hx,hy,"#cfc0b0",6,false);
      return;
    }
    // destroyed: blast it upward and pop
    rk._dead=true;
    const base=rk.type==="rainbow"?7:rk.type==="gold"?5:rk.type==="big"?3:1;
    // ② きょうのラッキー色: ふつう/でかいわ が秘密の色なら +2 の隠しボーナス。気づくと得する。
    const isLucky=(rk.type==="rock"||rk.type==="big")&&rk.col===luckyColor;
    let gain=(base+(isLucky?2:0))*(fever?2:1); // フィーバー中は てんすう2ばい
    count+=gain;stageKill++;api.setScore(count);
    combo++;comboT=1.0;
    api.slide(360,150,0.14,0.34,"square");
    api.noise(0.14,0.22,1400,"bandpass",0.8);
    api.tone(480*Math.pow(2,clamp(combo,0,12)/12),0.13,"triangle",0.13);
    api.boom(combo>=5?0.55:0.4);
    api.shake(7+Math.min(combo,8));
    if(rk.type==="rainbow"){
      rainbowHit(rk,hx,hy,gain);
    }else if(rk.type==="gold"){
      goldHit(rk,hx,hy,gain);
    }else{
      flash=Math.min(1,flash+0.4);flashCol=fever?"#ffd23f":rk.col;
      // ⑦ 壊れ方のバラエティ: ながいわ=まっぷたつ / つみかさなりいわ=くずれ落ちる / それ以外=いつもの飛び散り
      if(rk.shape==="long")splitLong(rk,hx,hy,fever);
      else if(rk.shape==="stack")crumbleStack(rk,hx,hy,fever);
      else if(rk.shape==="spiky")shatterSpiky(rk,hx,hy,fever);
      else burst(hx,hy,fever?pick(RAINBOW):rk.col,combo>=5?16:11,true);
      rings.push({x:hx,y:hy,r:rk.r*0.5,vr:rk.r*0.6,life:1,decay:0.05,col:"#ffd23f"});
      rings.push({x:hx,y:hy,r:rk.r*0.2,vr:rk.r*0.4,life:1,decay:0.06,col:"#ffffff"});
    }
    // ② ラッキー色 命中: 頭上に小さな星のキラッ(気づけるヒント)＋初回だけ中央で教える
    if(isLucky)luckySparkle(hx,hy-rk.r*0.6);
    // 軸6: 天面常設の「コンボ xN」と情報が重複しないよう、個別浮遊テキストは早めに消す
    if(combo>1)floats.push({x:hx,y:hy-rk.r,txt:"x"+combo,life:0.65,vy:-0.6,
      col:combo>=8?"#ff3bd0":combo>=5?"#ff5b5b":"#ffd23f",size:combo>=5?40:30});
    if(combo>=3){climax=Math.min(1,0.5+combo*0.06);hstop(combo>=6?4:3);}
    // ③ まとめ噴火(考えどころ): ひとつの噴火で 3こ以上まとめて打ち上げたら ボーナス＋祝福。
    // かたまってから噴くと大量得点=気づくと得する仕掛け。連打では狙えない。
    if(jet){jet.kills=(jet.kills||0)+1;
      if(jet.kills===3&&!jet.rewarded){jet.rewarded=true;multiReward(jet);}}
    // フィーバーゲージ (壊すほどたまる / ゴールドは大チャージ)
    if(!fever){
      feverG=Math.min(1,feverG+(rk.type==="gold"||rk.type==="rainbow"?0.34:rk.type==="big"?0.15:0.085));
      if(feverG>=1&&clearT<=0&&endingT<=0)startFever();
    }
    if(combo>0&&combo%8===0)nova();
    checkStage();
  }

  function rainbowHit(rk,hx,hy,gain){
    // ① にじいろいわ 撃破: 虹の輪が5色ぶわっと広がる大盤振る舞い(白飛びしないよう短命)。
    rbMsgT=1.4;flash=Math.min(1,flash+0.5);flashCol="#ffd23f";climax=1;
    api.boom(0.75);api.shake(16);hstop(5);
    api.slide(660,1320,0.5,0.22,"triangle");
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(784*Math.pow(2,s/12),0.15,"triangle",0.12),i*70));
    for(let k=0;k<RAINBOW.length;k++)
      rings.push({x:hx,y:hy,r:rk.r*0.35,vr:rk.r*(0.55+k*0.14),life:1,decay:0.045,col:RAINBOW[k]});
    for(let i=0;i<26;i++){if(chunks.length>=180)break;const a=rnd(0,TAU),s=rnd(3,10);
      chunks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.018),col:RAINBOW[i%RAINBOW.length]});}
    for(let i=0;i<10;i++){if(sparks.length>=80)break;const a=rnd(0,TAU),s=rnd(5,12);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(10,20),life:1,decay:rnd(0.04,0.07)});}
    floats.push({x:hx,y:hy-rk.r,txt:"にじいろ！+"+gain,life:1,vy:-1,col:"#ff7bd0",size:36});
  }

  function luckySparkle(hx,hy){
    // ② ラッキー色 命中: きらっと小さめの祝福(白飛びしないよう控えめ・上向きの星)
    api.tone(1046,0.14,"triangle",0.1);api.tone(1568,0.16,"triangle",0.08);
    for(let i=0;i<6;i++){if(sparks.length>=80)break;const a=-Math.PI/2+rnd(-0.7,0.7),s=rnd(3,7);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(6,12),life:1,decay:rnd(0.05,0.08)});}
    for(let i=0;i<5;i++){if(chunks.length>=180)break;const a=-Math.PI/2+rnd(-0.8,0.8),s=rnd(2,5);
      chunks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,5),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:luckyColor});}
    if(!luckySeen){luckyMsgT=1.7;luckyIntro=true;luckySeen=true;} // 初回だけ ラッキー色名 を中央で教える
    else{luckyMsgT=Math.max(luckyMsgT,0.7);luckyIntro=false;}
  }

  function multiReward(jet){
    // ③ まとめ噴火 ボーナス: この噴火で3こ以上まとめた ごほうび +3
    count+=3;api.setScore(count);
    api.tone(1318,0.14,"triangle",0.11);api.tone(1976,0.16,"triangle",0.08);
    rings.push({x:jet.x,y:groundY-Math.min(jet.h,api.H*0.5),r:R*0.5,vr:R*1.1,life:1,decay:0.04,col:"#7be08a"});
    floats.push({x:jet.x,y:groundY-Math.min(jet.h,api.H*0.5)-R,txt:"まとめて "+jet.kills+"こ！ +3",life:1,vy:-0.9,col:"#7be08a",size:30});
  }

  function startFever(){
    feverG=0;feverT=10;climax=1;flash=1;flashCol="#ffd23f";
    api.boom(0.8);api.shake(16);hstop(5);
    api.slide(392,1568,0.5,0.28,"sawtooth");
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(523*Math.pow(2,s/12),0.18,"triangle",0.14),i*80));
    floats.push({x:api.W/2,y:api.H*0.42,txt:"フィーバータイム！",life:1,vy:-0.5,col:"#ffd23f",size:44});
    floats.push({x:api.W/2,y:api.H*0.42+46,txt:"てんすう 2ばい！ ぜんぶ 1ぱつ！",life:1,vy:-0.5,col:"#fff",size:22});
    for(let i=0;i<5;i++)spawnRock(); // 的が大量発生
  }

  function nova(){
    novaT=1;climax=1;api.boom(0.7);api.shake(18);hstop(6);
    api.slide(700,120,0.4,0.3,"sawtooth");api.tone(110,0.4,"sawtooth",0.12);
    const mul=feverT>0?2:1;
    for(const rk of rocks){
      if(rk._dead)continue;
      rk._dead=true;count+=(rk.type==="rainbow"?7:rk.type==="gold"?5:1)*mul;stageKill++;
      burst(rk.x,rk.y,rk.type==="rainbow"?pick(RAINBOW):rk.col,14,true);
    }
    api.setScore(count);
    floats.push({x:api.W/2,y:api.H*0.5,txt:"だいふんか！",life:1,vy:-0.6,col:"#ffd23f",size:36});
    checkStage();
  }

  function burst(x,y,col,n,big){
    for(let i=0;i<n;i++){if(chunks.length>=180)break;const a=rnd(0,TAU),s=rnd(2.5,8);
      chunks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(3,8),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.022),
        col:i%3===0?col:(i%3===1?"#ff8a2a":"#ffd23f")});}
    for(let i=0;i<rint(5,8);i++){if(sparks.length>=80)break;const a=rnd(0,TAU),s=rnd(4,11);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,18),life:1,decay:rnd(0.05,0.09)});}
  }

  // ⑦ ながいわ: 四角い粒バラマキでなく、まっぷたつに割れた細長い2枚が左右へ飛ぶ
  function splitLong(rk,hx,hy,fever){
    const col=fever?pick(RAINBOW):rk.col;
    for(const side of [-1,1]){if(chunks.length>=180)break;
      chunks.push({x:hx,y:hy,vx:side*rnd(3,6),vy:rnd(-6,-3),r:rk.r*0.9,
        rot:rk.rot,vr:side*rnd(0.15,0.3),life:1,decay:rnd(0.012,0.018),
        col,wide:rk.r*0.32,tall:rk.r*1.5});}
    for(let i=0;i<6;i++){if(chunks.length>=180)break;const a=rnd(0,TAU),s=rnd(2.5,7);
      chunks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,6),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.014,0.02),col});}
    for(let i=0;i<rint(4,7);i++){if(sparks.length>=80)break;const a=rnd(0,TAU),s=rnd(4,10);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,16),life:1,decay:rnd(0.05,0.08)});}
  }

  // ⑦ つみかさなりいわ: 打ち上げず、段ごとの破片が下へバラバラとくずれ落ちる
  function crumbleStack(rk,hx,hy,fever){
    const col=fever?pick(RAINBOW):rk.col;
    for(let i=0;i<3;i++){if(chunks.length>=180)break;
      const rr=rk.r*(0.55-i*0.12);
      chunks.push({x:hx+rnd(-rk.r*0.3,rk.r*0.3),y:hy+i*rk.r*0.25,
        vx:rnd(-2,2),vy:rnd(1,4)+i*0.6,r:Math.max(3,rr),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.014,0.02),col});}
    for(let i=0;i<8;i++){if(chunks.length>=180)break;const a=rnd(0,TAU),s=rnd(2,6);
      chunks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,r:rnd(3,6),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.014,0.02),col});}
    for(let i=0;i<rint(4,7);i++){if(sparks.length>=80)break;const a=rnd(0,TAU),s=rnd(3,8);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(6,14),life:1,decay:rnd(0.05,0.08)});}
  }

  // ⑦ とげとげいわ: 丸/ながい/つみかさなり とは別の壊れ方=細い棘状の破片が四方へ勢いよく飛び散る
  function shatterSpiky(rk,hx,hy,fever){
    const col=fever?pick(RAINBOW):rk.col;
    for(let i=0;i<9;i++){if(chunks.length>=180)break;
      const a=i/9*TAU+rnd(-0.15,0.15),s=rnd(6,12);
      chunks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rk.r*0.2,
        rot:a,vr:rnd(-0.3,0.3),life:1,decay:rnd(0.014,0.022),
        col,wide:rk.r*0.16,tall:rk.r*0.95});}
    for(let i=0;i<6;i++){if(chunks.length>=180)break;const a=rnd(0,TAU),s=rnd(2.5,6);
      chunks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,r:rnd(3,5),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.016,0.024),col});}
    for(let i=0;i<rint(5,8);i++){if(sparks.length>=80)break;const a=rnd(0,TAU),s=rnd(5,12);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(9,17),life:1,decay:rnd(0.045,0.075)});}
  }

  function checkStage(){
    if(stageKill<stageGoal||clearT>0||endingT>0)return;
    if(stage>=STAGES){
      endingT=2.4;climax=1;api.boom(0.7);api.shake(18);
      api.slide(523,1046,0.5,0.22,"triangle");
    }else{
      clearStage=stage;clearT=1.6;climax=0.7;api.boom(0.5);api.shake(12);
      api.slide(523,784,0.3,0.2,"triangle");api.tone(660,0.25,"triangle",0.14);
      api.tone(988,0.3,"triangle",0.1);
      for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
        chunks.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(ROCKCOL)});}
      stage++;stageGoal=stageGoalFor(stage);stageKill=0;buildBg();
    }
  }

  // seed a few rocks
  for(let i=0;i<4;i++)spawnRock();

  return{
    resize:layout,
    input(x,y,type){
      if(type!=="down")return;
      if(clearT>0||endingT>0)return;
      // ④ おつきさま ひみつタップ: 月に触れたら ウインク＋金コインがこぼれる(噴火はそのまま/減点なし)
      if(moon.r>0&&Math.hypot(x-moon.x,y-moon.y)<moon.r*1.4){
        moonWink=1;api.tone(1318,0.12,"triangle",0.09);api.tone(1760,0.14,"triangle",0.07);
        for(let i=0;i<7;i++){if(chunks.length>=180)break;const a=-Math.PI/2+rnd(-0.9,0.9),s=rnd(2,5);
          chunks.push({x:moon.x+rnd(-moon.r*0.4,moon.r*0.4),y:moon.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s+1,
            r:rnd(3,5),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),
            col:pick(["#ffd23f","#fff0a0","#ffe08a"])});}
        if(moonCd<=0){moonCd=90;count+=1;api.setScore(count);   // ごほうびコイン(farm防止に間隔クールダウン)
          floats.push({x:moon.x,y:moon.y-moon.r*1.2,txt:"コイン！",life:1,vy:-0.8,col:"#ffe08a",size:22});}
      }
      jetAt(x);
    },
    frame(dt,now){
      tsec+=0.016*dt;
      if(hitCd>0)hitCd-=dt;
      if(moonCd>0)moonCd-=dt;
      const bg=curBg();
      // ---- 背景: 画像(夜の火山)があれば cover-fit + ステージ色を薄く重ねる / 無ければ従来の手描きグラデ ----
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 2面以降はステージのパレット色を薄く重ねて面ごとの雰囲気を変える(1面=絵そのまま)
        if(stage>1){g.save();g.globalAlpha=0.24;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,bg.s0);tg.addColorStop(0.5,bg.s1);tg.addColorStop(1,bg.s3);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      } else {
        // ---- sky -> lava gradient ----
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,bg.s0);grd.addColorStop(0.38,bg.s1);
        grd.addColorStop(0.68,bg.s2);grd.addColorStop(1,bg.s3);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // ---- distant volcano peaks ※画像背景のときは絵の火山を活かして描かない ----
      if(!imgBg) for(const m of mountains){
        g.fillStyle=m.col;g.beginPath();g.moveTo(0,api.H);
        const px=api.W*m.peak;
        g.lineTo(px-api.W*0.4,m.y);g.lineTo(px,m.y-m.h*0.4);g.lineTo(px+api.W*0.4,m.y);
        g.lineTo(api.W,m.y+m.h*0.3);g.lineTo(api.W,api.H);g.closePath();g.fill();
        // glowing crater tip
        g.save();g.globalCompositeOperation="lighter";
        const cg=g.createRadialGradient(px,m.y-m.h*0.4,0,px,m.y-m.h*0.4,m.h*0.4);
        cg.addColorStop(0,"rgba(255,160,40,0.4)");cg.addColorStop(1,"rgba(255,160,40,0)");
        g.fillStyle=cg;g.beginPath();g.arc(px,m.y-m.h*0.4,m.h*0.4,0,TAU);g.fill();g.restore();
      }
      // ---- ④ おつきさま (夜のふんか空に浮かぶ・ひみつタップの的) ----
      {
        const mx=moon.x,my=moon.y,mr=moon.r;
        g.save();g.globalCompositeOperation="lighter";  // やわらかな月あかり(短命でなく常時だが弱く=溜まらない)
        const halo=g.createRadialGradient(mx,my,0,mx,my,Math.max(0.01,mr*2.6));
        halo.addColorStop(0,"rgba(255,244,210,0.28)");halo.addColorStop(1,"rgba(255,244,210,0)");
        g.fillStyle=halo;g.beginPath();g.arc(mx,my,Math.max(0.01,mr*2.6),0,TAU);g.fill();
        g.restore();
        g.save();
        // 月(生成画像は不良のため常に手描き: 月+クレーター)
        {
          const mg=g.createRadialGradient(mx-mr*0.3,my-mr*0.3,mr*0.2,mx,my,Math.max(0.01,mr));
          mg.addColorStop(0,"#fff7e0");mg.addColorStop(1,"#e8c98a");
          g.fillStyle=mg;g.beginPath();g.arc(mx,my,Math.max(0.01,mr),0,TAU);g.fill();
          // craters
          g.fillStyle="rgba(190,160,110,0.5)";
          g.beginPath();g.arc(mx-mr*0.3,my-mr*0.2,Math.max(0.01,mr*0.18),0,TAU);
          g.arc(mx+mr*0.28,my+mr*0.1,Math.max(0.01,mr*0.13),0,TAU);
          g.arc(mx+mr*0.05,my-mr*0.38,Math.max(0.01,mr*0.1),0,TAU);g.fill();
        }
        // タップした瞬間だけ ^_^ のウインク顔(発見のごほうび)
        if(moonWink>0){moonWink-=0.02*dt;
          g.strokeStyle="#8a6a3a";g.lineWidth=Math.max(1.5,mr*0.12);g.lineCap="round";g.globalAlpha=clamp(moonWink*1.4,0,1);
          g.beginPath();
          g.moveTo(mx-mr*0.42,my-mr*0.04);g.quadraticCurveTo(mx-mr*0.28,my-mr*0.3,mx-mr*0.12,my-mr*0.04);
          g.moveTo(mx+mr*0.12,my-mr*0.04);g.quadraticCurveTo(mx+mr*0.28,my-mr*0.3,mx+mr*0.42,my-mr*0.04);
          g.stroke();
          g.beginPath();g.arc(mx,my+mr*0.16,Math.max(0.01,mr*0.32),0.12*Math.PI,0.88*Math.PI);g.stroke();
          g.globalAlpha=1;if(moonWink<0)moonWink=0;}
        g.restore();
      }
      // ---- soft lava glow spots near ground ----
      g.save();g.globalCompositeOperation="lighter";
      for(const sp of glowSpots){
        const pr=0.5+0.5*Math.sin(tsec*1.5+sp.ph);
        const og=g.createRadialGradient(sp.x,sp.y,0,sp.x,sp.y,sp.r);
        og.addColorStop(0,"rgba(255,120,30,"+(0.3*pr)+")");og.addColorStop(1,"rgba(255,120,30,0)");
        g.fillStyle=og;g.beginPath();g.arc(sp.x,sp.y,sp.r,0,TAU);g.fill();
      }
      g.restore();
      // ---- rising background embers / 火の粉 ----
      g.save();g.globalCompositeOperation="lighter";
      for(const e of bgEmber){
        e.y-=e.sp*dt;e.ph+=0.05*dt;
        if(e.y<-6){e.y=api.H+6;e.x=rnd(0,api.W);}
        const ex=e.x+Math.sin(e.ph)*e.sw*0.1;
        g.globalAlpha=0.35+0.35*Math.sin(e.ph*2);
        g.fillStyle=e.col;g.shadowBlur=6;g.shadowColor=e.col;
        g.beginPath();g.arc(ex,e.y,e.r,0,TAU);g.fill();
      }
      g.shadowBlur=0;g.globalAlpha=1;g.restore();
      // ---- molten ground ※画像背景のときは絵の溶岩床を活かして平坦な帯は描かない ----
      if(!imgBg){
        let gg2=g.createLinearGradient(0,groundY,0,api.H);
        gg2.addColorStop(0,"#ff8a2a");gg2.addColorStop(0.4,"#d8340e");gg2.addColorStop(1,"#5a1006");
        g.fillStyle=gg2;g.fillRect(0,groundY,api.W,api.H-groundY);
      }
      // bubbling lava crust line (wobble) = 噴火が出る地面の目印なので画像時も残す
      g.save();g.globalCompositeOperation="lighter";g.strokeStyle="rgba(255,210,80,0.6)";
      g.lineWidth=3;g.beginPath();
      for(let x=0;x<=api.W;x+=14){const yy=groundY+Math.sin(x*0.05+tsec*3)*4;
        if(x===0)g.moveTo(x,yy);else g.lineTo(x,yy);}
      g.stroke();g.restore();

      // ---- spawn rocks (per stage cadence) ----
      const paused=clearT>0||endingT>0;
      if(!paused){spawnT-=dt;if(spawnT<=0){spawnRock();
        spawnT=feverT>0?22:clamp(76-(stage-1)*9,36,76);}}   // 出現テンポ 約15%速め(7〜8歳向け)
      // ---- フィーバータイム進行 + 黄金の空気演出 ----
      if(feverT>0){
        feverT-=0.016*dt;
        g.save();g.globalCompositeOperation="lighter";
        const fp=0.5+0.5*Math.sin(tsec*6);
        let fg=g.createLinearGradient(0,0,0,api.H);
        fg.addColorStop(0,"rgba(255,210,80,"+(0.10+0.10*fp)+")");
        fg.addColorStop(0.5,"rgba(255,160,40,0.04)");
        fg.addColorStop(1,"rgba(255,220,100,"+(0.12+0.10*fp)+")");
        g.fillStyle=fg;g.fillRect(0,0,api.W,api.H);g.restore();
        // 金の火の粉が舞い上がる
        if(embers.length<120&&Math.random()<0.6*dt)
          embers.push({x:rnd(0,api.W),y:groundY,vx:rnd(-1,1),vy:-rnd(3,6),
            r:rnd(2,4),life:1,decay:rnd(0.012,0.02),col:pick(["#ffd23f","#fff0a0","#ffb030"])});
        if(feverT<=0){
          feverT=0;
          api.tone(659,0.18,"triangle",0.12);api.tone(523,0.28,"triangle",0.1);
          floats.push({x:api.W/2,y:api.H*0.4,txt:"フィーバー おわり！ またためよう",life:1,vy:-0.5,col:"#fff",size:22});
        }
      }

      // ---- update + draw geysers (and collide with rocks) ----
      for(const j of jets){
        j.age+=dt;
        if(!j.peaked){
          j.h+=j.vy*dt;j.vy=Math.max(2,j.vy-0.45*dt);
          if(j.h>=j.maxH){j.peaked=true;}
        }else{
          j.life-=0.06*dt; // 軸3: 噴火の居座り時間を短縮(漂ってきた岩まで拾わないように)
        }
        const topY=groundY-j.h;
        // collide: any rock whose body the column reaches gets launched
        if(j.life>0){
          for(const rk of rocks){
            if(rk._dead)continue;
            if(Math.abs(rk.x-j.x)<j.w*0.28+rk.r*0.32 && rk.y+rk.r>topY-R && rk.y<groundY){
              // push upward strongly; register a hit when near the jet head
              rk.vy=Math.min(rk.vy,-rnd(7,11));
              rk.vx+=(rk.x-j.x)*0.04;
              if(rk.y<topY+rk.r*1.4){ hitRock(rk,rk.x,rk.y,j); }
            }
          }
        }
        // draw column
        if(j.h>2){
          const a=clamp(j.life,0,1);
          g.save();g.globalCompositeOperation="lighter";
          // outer glow
          const og=g.createLinearGradient(j.x,groundY,j.x,topY);
          og.addColorStop(0,"rgba(255,90,20,"+(0.5*a)+")");
          og.addColorStop(0.6,"rgba(255,170,50,"+(0.5*a)+")");
          og.addColorStop(1,"rgba(255,240,150,"+(0.2*a)+")");
          g.fillStyle=og;
          const wob=Math.sin(j.age*0.4)*j.w*0.15;
          g.beginPath();
          g.moveTo(j.x-j.w*0.6,groundY);
          g.quadraticCurveTo(j.x-j.w*0.5+wob,(groundY+topY)/2,j.x-j.w*0.25,topY);
          g.lineTo(j.x+j.w*0.25,topY);
          g.quadraticCurveTo(j.x+j.w*0.5+wob,(groundY+topY)/2,j.x+j.w*0.6,groundY);
          g.closePath();g.fill();
          // bright core
          g.fillStyle="rgba(255,250,200,"+(0.7*a)+")";
          g.fillRect(j.x-j.w*0.16,topY,j.w*0.32,j.h);
          // splashing head
          g.fillStyle="rgba(255,210,90,"+(0.8*a)+")";
          g.beginPath();g.arc(j.x,topY,j.w*0.55*a,0,TAU);g.fill();
          g.restore();
          // spray droplets at head
          if(j.life>0.4&&Math.random()<0.5*dt){
            const a2=-Math.PI/2+rnd(-0.9,0.9),s=rnd(4,9);
            embers.push({x:j.x,y:topY,vx:Math.cos(a2)*s,vy:Math.sin(a2)*s,r:rnd(2,5),
              life:1,decay:rnd(0.02,0.04),col:pick(["#ffd23f","#ff8a2a","#fff0a0"])});
          }
        }
      }
      jets=jets.filter(j=>j.life>0);

      // ---- update + draw rocks ----
      for(const rk of rocks){
        if(rk.flash>0)rk.flash-=0.08*dt;
        if(rk.type==="gold"||rk.type==="rainbow")rk.spin+=0.08*dt;
        rk.vy+=0.18*dt; // gravity pulls them back
        rk.x+=rk.vx*dt;rk.y+=rk.vy*dt;rk.rot+=rk.vr*dt;
        // drift bounds (horizontal wrap-bounce, only when falling/floating)
        if(rk.x<R){rk.x=R;rk.vx=Math.abs(rk.vx);}
        if(rk.x>api.W-R){rk.x=api.W-R;rk.vx=-Math.abs(rk.vx);}
        // ceiling clamp
        if(rk.y<-rk.r*2){rk.vy=Math.abs(rk.vy)*0.3;}
        // if it falls back below ground while floating, settle to a hover band
        if(rk.y>groundY-rk.r){
          if(rk.vy>0){rk.y=groundY-rk.r;rk.vy=-rk.vy*0.2;}
        }
        // gentle hover toward mid screen so there are always targets
        if(Math.abs(rk.vy)<0.4 && rk.y>api.H*0.55){rk.vy-=0.06*dt;}
        drawRock(rk);
      }
      rocks=rocks.filter(rk=>!rk._dead);
      while(rocks.length<3 && !paused)spawnRock();

      // ---- embers ----
      g.save();g.globalCompositeOperation="lighter";
      for(const e of embers){e.vy+=0.25*dt;e.x+=e.vx*dt;e.y+=e.vy*dt;e.life-=e.decay*dt;
        g.globalAlpha=Math.max(0,e.life);g.fillStyle=e.col;g.shadowBlur=8;g.shadowColor=e.col;
        g.beginPath();g.arc(e.x,e.y,e.r*Math.max(0.3,e.life),0,TAU);g.fill();}
      g.shadowBlur=0;g.globalAlpha=1;g.restore();
      embers=embers.filter(e=>e.life>0&&e.y<api.H+10);

      // ---- rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);

      // ---- spark lines ----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#fff7c2";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;
      sparks=sparks.filter(sp=>sp.life>0);

      // ---- rock chunks (debris) ----
      for(const c of chunks){c.vy+=0.3*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=c.vr*dt;c.life-=c.decay*dt;
        const cw=Math.max(0,c.wide||c.r),ch=Math.max(0,c.tall||c.r); // ながいわ の破片は細長い専用サイズ
        g.save();g.globalAlpha=Math.max(0,c.life);g.translate(c.x,c.y);g.rotate(c.rot);
        g.fillStyle=c.col;g.fillRect(-cw/2,-ch/2,cw,ch);
        g.fillStyle="rgba(255,255,255,.25)";g.fillRect(-cw/2,-ch/2,cw,ch*0.35);g.restore();}
      g.globalAlpha=1;chunks=chunks.filter(c=>c.life>0&&c.y<api.H+20);

      // ---- floats (combo / event text) ----
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.018*dt;
        g.save();g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(60,10,0,.6)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.restore();}
      g.textAlign="left";floats=floats.filter(f=>f.life>0);

      // ---- climax color-wash ----
      if(climax>0){
        const cw=g.createRadialGradient(api.W/2,api.H*0.5,0,api.W/2,api.H*0.5,api.W*0.75);
        cw.addColorStop(0,"rgba(255,210,120,"+(0.5*climax)+")");
        cw.addColorStop(0.5,"rgba(255,120,50,"+(0.26*climax)+")");
        cw.addColorStop(1,"rgba(255,90,40,0)");
        g.save();g.globalCompositeOperation="lighter";g.fillStyle=cw;g.fillRect(0,0,api.W,api.H);g.restore();
        climax-=0.06*dt;if(climax<0)climax=0;
      }
      // ---- impact flash ----
      if(flash>0){flash-=0.06*dt;
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=Math.max(0,flash)*0.3;
        g.fillStyle=flashCol;g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      // ---- nova white flash ----
      if(novaT>0){g.save();g.globalAlpha=novaT*0.5;g.fillStyle="#fff";
        g.fillRect(0,0,api.W,api.H);g.restore();novaT-=0.06*dt;if(novaT<0)novaT=0;}

      // ---- combo text (top-center safe band) ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        const comboLabel="コンボ x"+combo;
        g.save();g.translate(api.W/2,api.H*0.16);g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        // 軸6: 背後を明るい間欠泉の光柱が通っても数字が読めるよう、暗い背板を先に敷く
        const ctw=g.measureText(comboLabel).width;
        g.save();g.globalAlpha=clamp(comboT,0,1)*0.6;g.fillStyle="rgba(15,6,4,.62)";
        rrect(-ctw/2-16,-27,ctw+32,46,14);g.fill();g.restore();
        g.shadowColor="rgba(255,120,30,.8)";g.shadowBlur=14;
        g.fillStyle="#ffd23f";g.fillText(comboLabel,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.6)";
        g.strokeText(comboLabel,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }

      // ---- ① にじいろいわ！ 発見バナー(虹色に色替わり・上部中央=HUD安全帯) ----
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.4,col=RAINBOW[Math.floor(tsec*6)%RAINBOW.length];
        g.save();g.translate(api.W/2,api.H*0.24);g.scale(pop,pop);
        g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.shadowColor=col;g.shadowBlur=18;
        g.fillStyle="#ffffff";g.fillText("にじいろいわ！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろいわ！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ---- ② きょうのラッキー色 はっけん！(初回だけ大きく・上部中央) ----
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        const pop=1+Math.max(0,luckyMsgT-1)*1.2;
        g.save();g.translate(api.W/2,api.H*0.3);g.scale(pop,pop);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.4,0,1);g.shadowColor="rgba(255,240,160,.9)";g.shadowBlur=12;
        const t2=luckyIntro?"きょうのラッキー色は "+(LUCKYNAME[luckyColor]||"")+"！":"ラッキー！";
        g.lineWidth=5;g.strokeStyle="rgba(60,10,0,.5)";g.strokeText(t2,0,0);
        g.fillStyle="#fff0a0";g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ---- HUD (top-center) + フィーバーゲージ (bottom-center) ----
      drawHUD();
      drawFever();

      // ---- stage clear banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.5;g.fillStyle="#000";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,150,40,.9)";g.shadowBlur=20;g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア！",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("つぎは "+(TEASE[clearStage+1]||"もっと あつくなる！"),0,42);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=20;}
      }
      // ---- ぜんぶクリア ending ----
      if(endingT>0){endingT-=0.012*dt;
        const a=clamp(endingT,0,1);
        g.save();g.globalAlpha=a*0.45;g.fillStyle="#2a0810";g.fillRect(0,0,api.W,api.H);g.restore();
        if(tsec*60%1<dt)chunks.push({x:rnd(0,api.W),y:-10,vx:rnd(-1,1),vy:rnd(2,5),r:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.01,col:pick(ROCKCOL)});
        const pop=1+Math.sin(tsec*7)*0.06;
        g.save();g.translate(api.W/2,api.H*0.42);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 56px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,200,60,1)";g.shadowBlur=26;g.fillStyle="#ffd23f";
        g.fillText("ぜんぶ クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle="#fff";g.strokeText("ぜんぶ クリア！",0,0);
        g.font="800 26px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("すごい！ もういちど あそべるよ",0,50);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(endingT<=0){endingT=0;stage=1;stageGoal=stageGoalFor(1);stageKill=0;combo=0;
          feverG=0;feverT=0;buildBg();spawnT=20;}
      }
      // 加算合成を必ず source-over に戻して次フレームへ持ち越さない(白飛び漏れ防止)
      g.globalCompositeOperation="source-over";
    },
    stop(){}
  };

  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.045;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(0,0,0,.5)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+" / "+STAGES+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(0,0,0,.35)";rrect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gd=g.createLinearGradient(bx,0,bx+bw,0);
      gd.addColorStop(0,"#ff8a2a");gd.addColorStop(1,"#ffd23f");
      g.fillStyle=gd;rrect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;rrect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }

  function drawFever(){
    const w=Math.min(api.W*0.5,240),x=(api.W-w)/2,y=api.H-30,h=14;
    const active=feverT>0;
    // panel
    g.save();
    g.fillStyle="rgba(40,10,10,.55)";rrect(x-5,y-3,w+10,h+6,(h+6)/2);g.fill();
    g.lineWidth=2;g.strokeStyle="rgba(255,255,255,.35)";rrect(x-5,y-3,w+10,h+6,(h+6)/2);g.stroke();
    const fr=active?clamp(feverT/10,0,1):feverG;
    if(fr>0.01){
      const fw=Math.max(h,w*fr);
      let pg=g.createLinearGradient(x,0,x+w,0);
      if(active){pg.addColorStop(0,"#ff5b5b");pg.addColorStop(0.3,"#ffd23f");
        pg.addColorStop(0.6,"#7be08a");pg.addColorStop(1,"#4db8ff");}
      else{pg.addColorStop(0,"#ff8a2a");pg.addColorStop(1,"#ffd23f");}
      g.save();
      if(active||feverG>0.85){g.shadowBlur=12+6*Math.sin(tsec*8);g.shadowColor="#ffd23f";}
      g.fillStyle=pg;rrect(x,y,fw,h,h/2);g.fill();g.restore();
      // glossy sheen
      g.save();rrect(x,y,fw,h,h/2);g.clip();g.fillStyle="rgba(255,255,255,.3)";
      g.fillRect(x,y+1,fw,h*0.35);g.restore();
    }
    g.font="800 14px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
    g.lineWidth=4;g.lineJoin="round";g.strokeStyle="rgba(60,10,0,.65)";
    const label=active?"フィーバーちゅう！ 2ばい！":feverG>0.85?"もうすぐ フィーバー！":"フィーバーゲージ";
    g.save();if(active||feverG>0.85){g.shadowBlur=8+4*Math.sin(tsec*8);g.shadowColor="#ffd23f";}
    g.strokeText(label,api.W/2,y-7);
    g.fillStyle=active?"#fff":"#ffe9c2";g.fillText(label,api.W/2,y-7);g.restore();
    g.restore();g.textAlign="left";g.lineJoin="miter";
  }

  function drawRock(rk){
    const r=rk.r,big=rk.type==="big",gold=rk.type==="gold",rainbow=rk.type==="rainbow";
    // ① にじいろいわ: 体の色をゆっくり虹色に巡回させる(常時 虹に光る)
    const rbCol=rainbow?RAINBOW[Math.floor(rk.spin*2)%RAINBOW.length]:rk.col;
    g.save();g.translate(rk.x,rk.y);g.rotate(rk.rot);
    // shadow / molten underglow (gold/rainbow = strong pulsing halo)
    g.save();g.globalCompositeOperation="lighter";
    if(rainbow){
      const pu=0.7+0.3*Math.sin(rk.spin*3),rr=Math.max(0.01,r*2.2*pu);
      const ug=g.createRadialGradient(0,0,0,0,0,rr);
      const c=RAINBOW[Math.floor(rk.spin*2+1)%RAINBOW.length];
      ug.addColorStop(0,c);ug.addColorStop(0.5,"rgba(255,255,255,0)");ug.addColorStop(1,"rgba(255,255,255,0)");
      g.globalAlpha=0.5;g.fillStyle=ug;g.beginPath();g.arc(0,0,rr,0,TAU);g.fill();g.globalAlpha=1;
    }else if(gold){
      const pu=0.7+0.3*Math.sin(rk.spin*3),rr=Math.max(0.01,r*2.1*pu);
      const ug=g.createRadialGradient(0,0,0,0,0,rr);
      ug.addColorStop(0,"rgba(255,225,90,0.55)");ug.addColorStop(1,"rgba(255,200,60,0)");
      g.fillStyle=ug;g.beginPath();g.arc(0,0,rr,0,TAU);g.fill();
    }else{
      const ug=g.createRadialGradient(0,0,0,0,0,Math.max(0.01,r*1.6));
      ug.addColorStop(0,"rgba(255,120,30,0.35)");ug.addColorStop(1,"rgba(255,120,30,0)");
      g.fillStyle=ug;g.beginPath();g.arc(0,0,Math.max(0.01,r*1.6),0,TAU);g.fill();
    }
    g.restore();
    // ゴールドいわ(生成画像は不良のため常に手描き): 体・顔・キラキラは下の通常処理で描く
    // rock body (lumpy)
    const grd=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,Math.max(0.01,r*1.2));
    grd.addColorStop(0,lighten(rbCol,60));grd.addColorStop(0.6,rbCol);grd.addColorStop(1,shadeHex(rbCol,-40));
    g.fillStyle=grd;
    const lumps=7;
    // ⑦ 形のバラエティ: 丸(いつもの でこぼこ多角形) / ながい(縦に伸ばして描く) / つみかさなり(丸を段重ね)
    if(rk.shape==="long"){
      g.beginPath();
      g.save();g.scale(0.56,1.75);
      for(let i=0;i<lumps;i++){const a=i/lumps*TAU,rr=r*(0.86+((i*37)%5)*0.04);
        const px=Math.cos(a)*rr,py=Math.sin(a)*rr;if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}
      g.closePath();
      g.restore();
      g.fill();
    }else if(rk.shape==="stack"){
      const segs=rk.hp>=2?3:2; // 1発目で上段が弾け飛んだ後は段数を減らして見せる
      g.beginPath();
      for(let s=0;s<segs;s++){
        const sr=Math.max(0.01,r*(0.72-s*0.16)),sy=r*0.55-s*r*0.5;
        g.moveTo(sr,sy);g.arc(0,sy,sr,0,TAU);
      }
      g.fill();
    }else if(rk.shape==="spiky"){
      // ⑦ とげとげいわ: 丸/ながい/つみかさなりと違う星形シルエット(黒っぽい溶岩ガラス質)
      g.beginPath();
      const spikes=8;
      for(let i=0;i<spikes*2;i++){
        const a=i/(spikes*2)*TAU,rr=(i%2===0)?r*1.08:r*0.5;
        const px=Math.cos(a)*rr,py=Math.sin(a)*rr;
        if(i===0)g.moveTo(px,py);else g.lineTo(px,py);
      }
      g.closePath();g.fill();
    }else{
      g.beginPath();
      for(let i=0;i<lumps;i++){const a=i/lumps*TAU,rr=r*(0.86+((i*37)%5)*0.04);
        const px=Math.cos(a)*rr,py=Math.sin(a)*rr;if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}
      g.closePath();g.fill();
    }
    // 軸6: 写実的な火山背景と同系色でも輪郭で浮くように縁取り
    g.save();g.lineWidth=Math.max(2,r*0.08);g.strokeStyle="rgba(20,8,4,.55)";g.stroke();g.restore();
    // glowing lava cracks
    g.save();g.globalCompositeOperation="lighter";g.strokeStyle="rgba(255,140,40,0.8)";
    g.lineWidth=Math.max(1.5,r*0.08);g.lineCap="round";g.shadowBlur=6;g.shadowColor="#ff6a1a";
    g.beginPath();g.moveTo(-r*0.4,-r*0.2);g.lineTo(-r*0.05,r*0.1);g.lineTo(r*0.3,-r*0.05);
    g.moveTo(-r*0.05,r*0.1);g.lineTo(0,r*0.5);g.stroke();g.restore();
    // big-rock dent crack
    if(big&&rk.hp<=1){g.strokeStyle="rgba(20,10,0,.6)";g.lineWidth=2.5;g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.1,-r*0.6);g.lineTo(r*0.1,-r*0.2);g.lineTo(-r*0.1,r*0.2);g.stroke();}
    // hit flash
    if(rk.flash>0){g.save();g.globalAlpha=rk.flash*0.7;g.fillStyle="#fff";
      g.beginPath();g.arc(0,0,r,0,TAU);g.fill();g.restore();}
    // little face (kawaii)
    g.fillStyle="#1a0e08";
    g.beginPath();g.arc(-r*0.28,-r*0.1,r*0.13,0,TAU);g.arc(r*0.28,-r*0.1,r*0.13,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.85)";
    g.beginPath();g.arc(-r*0.31,-r*0.14,r*0.04,0,TAU);g.arc(r*0.25,-r*0.14,r*0.04,0,TAU);g.fill();
    g.fillStyle="rgba(255,120,90,.4)";
    g.beginPath();g.arc(-r*0.4,r*0.08,r*0.1,0,TAU);g.arc(r*0.4,r*0.08,r*0.1,0,TAU);g.fill();
    g.strokeStyle="#1a0e08";g.lineWidth=Math.max(2,r*0.05);g.lineCap="round";
    g.beginPath();g.arc(0,r*0.05,r*0.14,0.15*Math.PI,0.85*Math.PI);g.stroke();
    // gold/rainbow: rotating sparkle glints (キラキラ回る十字の光)
    if(gold||rainbow){
      g.save();g.globalCompositeOperation="lighter";
      for(let i=0;i<3;i++){
        const a=rk.spin*2+i*TAU/3,sx=Math.cos(a)*r*0.9,sy=Math.sin(a)*r*0.9;
        const sl=Math.max(0.01,r*(0.22+0.1*Math.sin(rk.spin*5+i*2)));
        g.strokeStyle="rgba(255,255,220,0.9)";g.lineWidth=2;g.lineCap="round";
        g.beginPath();g.moveTo(sx-sl,sy);g.lineTo(sx+sl,sy);
        g.moveTo(sx,sy-sl);g.lineTo(sx,sy+sl);g.stroke();
      }
      g.restore();
    }
    g.restore();
  }

  function rrect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function lighten(hex,amt){const a=amt===undefined?50:amt;const c=parseInt(hex.slice(1),16);
    const r=Math.min(255,((c>>16)&255)+a),gg=Math.min(255,((c>>8)&255)+a),b=Math.min(255,(c&255)+a);
    return "rgb("+r+","+gg+","+b+")";}
  function shadeHex(hex,amt){const c=parseInt(hex.slice(1),16);
    const r=clamp(((c>>16)&255)+amt,0,255),gg=clamp(((c>>8)&255)+amt,0,255),b=clamp((c&255)+amt,0,255);
    return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("geyser", build_geyser);
