function buildBalloon(api){
  const g=api.g;
  // 画像アセットは背景のみ(無ければ従来の手描き空にフォールバック)。
  // ボス/にじいろ ふうせんのスプライトは生成が2回とも不良(背景抜きの穴・複数個・台座)だったので手描きのまま。
  api.preload(["bg.jpg"]);
  let hsCD=0;      // hitStop cooldown (節目限定・30f以上あける)
  function tryHitStop(f){if(hsCD<=0){api.hitStop(f);hsCD=32;}}
  let balloons=[],pending=[],confetti=[],rings=[],floats=[],sparks=[],shines=[],links=[],motes=[];
  let ghosts=[],puddles=[],gondolas=[]; // 壊れ方のバラエティ(軸7): 空気が抜けて飛ぶどうぶつ / みずたまり / 落ちるボスのゴンドラ
  let CHAINR,spawnT,count,waveN,clouds=[],hintPulse=0,flash=0,flashCol="#fff";
  let quietT=0,pityCD=0,bigT=0; // bigT: 大きな熱気球(2タップ)の出現タイマー
  // // 軸3向けピティ: 無得点の経過フレーム(約60/秒)
  const PITY_T=240,PITY_CD=80; // 無得点がPITY_T(約5秒)続いたら的カラーを画面の中ほどに差し込み、次はPITY_CD(約1.3秒)空ける
  const QUIET_ASSIST=240;       // 無得点が約4秒続いたら当たり判定を広げる(静かな時間だけ)
  const COLORS=["#e85d75","#4aa6c0","#7be08a","#ffd23f","#b58bff","#ff8c42"];
  const CNAME=["あか","みずいろ","みどり","きいろ","むらさき","オレンジ"];
  // ---- 隠し発見レイヤー(ハンマー/トラックと同じ思想) ----
  let luckyColor=pick(COLORS),luckyIntroT=0,luckyIntroShown=false; // ① きょうのラッキー色(セッション秘密の1色)
  let superRareT=0,megaWarnT=0;       // ② だいあたり ふうせん(激レア)＋接近予告
  let escaped=0,perfectT=0;           // ③ パーフェクト判定(このステージで的の色をにがさない)
  let sunWink=0,sunX=0,sunY=0,sunR=0; // ④ おひさま ひみつタップ
  // stage / progression state
  let stage,stageClears,target,targetLeft,banner,skyShift,bossT,rainbowT,feverT;
  const SKY=[["#7bb8e8","#aee0f5","#eafaff"],["#f5b8d0","#fde0ef","#fff4fb"],["#ffcf8a","#ffe9c2","#fffaf0"],
    ["#9a8bff","#c5b8ff","#efeaff"],["#5ad0c0","#a8eee2","#ecfffb"],["#b58bff","#ffb3d9","#fff0fa"]];
  function stageColors(){return COLORS.slice(0,clamp(2+stage,3,6));}
  // 7〜8歳向けに手応えを少し増やした: 出現間隔 -13% / 上昇速度 +25%程度 / ボスの必要タップ 3→4
  // 軸3(歯ごたえ)向け: N=1..20再測でmaxQuietSecの裾(12秒超え)が本数を増やすほど崩れたため下限を10→8に詰めた
  function stageSpawn(){return clamp(26-stage*3,8,26);}
  function stageSpeedMul(){return 1+stage*0.2;}
  const BOSS_HP=4,BOSS_COL="#2f4fb8";   // ボスふうせんは色固定(紺)。COLORSに無い色なので連鎖/的の判定には巻き込まれない
  function layout(){sunX=api.W*0.82;sunY=api.H*0.12;sunR=Math.max(40,api.W*0.09);}
  // 連鎖の吸着半径: ステージが進むほど少し狭め、後半ほど「たまたま隣接」で連鎖しにくくする(軸3向け・様子見)
  function chainR(){return clamp(api.W*0.2-stage*6,90,240);}
  // 見た目のバラエティ(軸7向け): まる中心に、細長い風船と、縦に連なる「つみかさなりふうせん」を低確率で混ぜる
  // stack(つみかさなり)を目に留まりやすく: 0.1→0.18(軸7向け)
  // round/long/stackに加え、低確率で「ハートふうせん」を混ぜて輪郭のバリエーションをもう1種類増やす(軸7向け)
  // みずふうせん(下ぶくれ・割れると水しぶき)を約8%追加(軸7向け)
  function pickShape(){const r=Math.random();return r<0.18?'stack':(r<0.38?'long':(r<0.50?'heart':(r<0.62?'water':'round')));}
  function mk(y0,forceTarget){const r=clamp(api.W*0.06,28,50)*rnd(0.6,1.5); // 大小の差を広げる(軸7向け)。小さい物の押しやすさは at() の最小半径で守る
    return{x:rnd(r*1.5,api.W-r*1.5),y:y0!=null?y0:api.H+r*1.5,vy:-rnd(0.6,1.4)*stageSpeedMul(),r,
      // 無反応が続く時間(軸3)を縮めるため、一定確率で今の的の色を優先して出す。狙う必要性(missRate)自体は変えない
      // N=1..20再測でmaxQuietSecの裾が崩れたため0.35→0.42に増量(ランダム連打のscorePerTapは変えず、単に的色の巡り合わせを早める)
      color:(forceTarget||Math.random()<0.42)&&target?target:pick(stageColors()),phase:rnd(0,TAU),amp:rnd(8,22),popped:false,
      sq:1,wob:rnd(0,TAU),shimmer:rnd(0,TAU),rainbow:false,boss:0,shape:pickShape(),an:Math.random()};}
  // rainbow balloon: matches ANY colour in a chain
  function mkRainbow(){const b=mk();b.rainbow=true;b.r*=1.05;return b;}
  // boss balloon: needs a few taps, then a huge burst(乗り物寄りの輪郭にするため形は固定)
  function mkBoss(){const b=mk(api.H+90);b.boss=BOSS_HP;b.r=clamp(api.W*0.06,28,50)*1.9;b.vy=-rnd(0.3,0.6)*stageSpeedMul();b.color=BOSS_COL;b.shape='round';return b;}
  // 大きな熱気球(軸7向け): 的の色・2タップで壊れ、ゴンドラが落ちる。ボスより軽い「乗り物」枠
  function mkBig(){const b=mk(api.H+110,true);b.big=true;b.boss=2;b.r=clamp(api.W*0.06,28,50)*1.8;b.vy=-rnd(0.4,0.7)*stageSpeedMul();b.shape='round';return b;}
  // ② だいあたり ふうせん(激レア): 虹色に光る大きめ。割ると虹の大盤振る舞い＋大量得点。連鎖には巻き込まれない(直接タップ専用)
  function mkMega(){const b=mk(api.H+120);b.mega=true;b.rainbow=true;b.r=clamp(api.W*0.06,28,50)*1.5;b.vy=-rnd(0.35,0.55)*stageSpeedMul();b.shape='round';return b;}
  function hitMega(b){
    if(b.popped)return;b.popped=true;megaWarnT=0;quietT=0;
    count+=8;api.setScore(count);
    showBanner("だいあたり！","#ffd23f",true);
    api.boom(0.9);api.shake(12);tryHitStop(5);
    flash=Math.max(flash,0.6);flashCol="#fff2cc";feverT=Math.max(feverT,70);
    api.slide(500,1600,0.3,0.09,"triangle");api.tone(880,0.16,"triangle",0.12);api.tone(1320,0.2,"triangle",0.1);
    for(let k=0;k<6;k++)rings.push({x:b.x,y:b.y,r:b.r*0.5,max:b.r*(2.2+k*0.5),life:1,col:"hsl("+(k*60)+",85%,62%)",lw:5});
    for(let k=44;k>0;k--){const a=rnd(0,TAU),s=rnd(3,12);
      confetti.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(5,12),color:pick(COLORS),rot:rnd(0,TAU),vr:rnd(-0.6,0.6),life:1,decay:rnd(0.01,0.02)});}
    for(let k=16;k>0;k--){const a=rnd(0,TAU),s=rnd(3,9);
      sparks.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.02,0.04),sz:rnd(3,6),col:"#fff"});}
    floats.push({x:b.x,y:b.y-40,txt:"だいあたり ＋8",life:1,vy:-1.1,t:0,col:"#ffd23f",size:34});
    if(targetLeft>0){targetLeft=Math.max(0,targetLeft-1);if(targetLeft<=0)clearStage();}
  }
  // ピティ用: 画面の中ほど(中央寄り)にふわっと現れる的カラーの丸ふうせん。下から上ってくるのを待たずに押せる(軸3向け)
  function mkPity(){const b=mk(rnd(api.H*0.5,api.H*0.82),true);b.x=rnd(api.W*0.25,api.W*0.75);b.shape='round';b.sq=0.3;return b;}
  function mkClouds(){clouds=[];for(let i=0;i<4;i++)clouds.push({x:rnd(0,api.W),y:rnd(api.H*0.08,api.H*0.4),s:rnd(0.7,1.5),vx:rnd(0.05,0.18)});}
  function mkMotes(){motes=[];const n=clamp(Math.round(api.W/34),14,30);for(let i=0;i<n;i++)motes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(1.5,4.5),vy:-rnd(0.08,0.3),ph:rnd(0,TAU),drift:rnd(0.1,0.5)});}
  function newTarget(){const cols=stageColors();target=pick(cols);targetLeft=clamp(3+stage,4,8);}   // 7〜8歳向け: 的の数を1こ増やした
  function showBanner(txt,col,big){banner={txt,col:col||"#fff",life:1,t:0,big:!!big};}
  function nextStage(first){
    if(!first)stage++;
    skyShift=0;
    if(stage>=6){
      // final celebration loop point
      showBanner("ぜんぶ クリア！",("#ffd23f"),true);
      api.boom(1);api.shake(14);tryHitStop(6);flash=Math.max(flash,0.85);flashCol="#fff5cc";
      for(let k=0;k<70;k++){const a=rnd(0,TAU),s=rnd(3,11);
        confetti.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(5,11),color:pick(COLORS),rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.008,0.016)});}
      stage=0; // loop back but keep playing
    } else {
      showBanner("ステージ "+(stage+1)+"！",pick(["#ff8c42","#4aa6c0","#b58bff","#7be08a"]),true);
      if(!first)api.shake(7);
    }
    spawnT=stageSpawn();bossT=rint(360,540);rainbowT=rint(300,460);
    escaped=0;   // ③ パーフェクト判定を毎ステージ初期化
    newTarget();
  }
  function reset(){balloons=[];pending=[];confetti=[];rings=[];floats=[];sparks=[];shines=[];links=[];count=0;spawnT=0;waveN=0;flash=0;hintPulse=0;quietT=0;pityCD=0;
    stage=0;stageClears=0;banner=null;skyShift=0;bossT=420;rainbowT=380;feverT=0;layout();mkClouds();mkMotes();
    bigT=rint(300,420);superRareT=rint(560,820);megaWarnT=0;perfectT=0;sunWink=0;escaped=0;
    luckyIntroT=luckyIntroShown?0:2.8;   // ① ラッキー色は初回だけ中央に教える
    nextStage(true);
    ghosts=[];puddles=[];gondolas=[];
    // 最初の10こは画面を10等分した帯に1こずつ(順番はシャッフル)。端に偏って押せない出だしを減らす(軸3向け)
    const xo=[0,1,2,3,4,5,6,7,8,9];for(let i=xo.length-1;i>0;i--){const j=rint(0,i),t=xo[i];xo[i]=xo[j];xo[j]=t;}
    for(let i=0;i<10;i++){const b=mk(rnd(api.H*0.3,api.H*0.85),i<3);b.x=clamp(api.W*(xo[i]+0.5)/10,b.r*1.2,api.W-b.r*1.2);balloons.push(b);}
    quietT=QUIET_ASSIST;}   // 最初の1こ目を割るまでは判定を広めに(最初の成功を早く)。最初に割れたらquietTは0に戻り普段の判定へ
  // 無得点が続いている間だけ判定を広げる(普段のタップ命中率は変えない)
  function at(x,y){const k=quietT>=QUIET_ASSIST+180?2.2:(quietT>=QUIET_ASSIST?1.6:1.05);let best=null,bd=1e9;for(const b of balloons){if(b.popped)continue;const d=Math.hypot(b.x-x,b.y-y);const hr=Math.max(b.r*k,22*(k>1.2?1.2:1));if(d<hr&&d<bd){bd=d;best=b;}}return best;}
  function pop(b,scores){
    if(b.popped)return;b.popped=true;
    // 軸3: 色えらびを点数に結びつける。的の色・にじいろ・3こ以上のれんさ・しばらく無得点の時だけ点が入る
    // (単発の外れ色も割れる演出はそのまま・点だけ入らない。叱る文言は出さない)
    if(scores!==false){
      quietT=0; // 軸3向けピティ: 得点が動いたので無得点タイマーをリセット
      count++;api.setScore(count);
    }
    // ① きょうのラッキー色: 秘密の色を割ると小ボーナス＋頭上に星のキラッ(気づけるヒント)
    if(scores!==false&&!b.rainbow&&!b.mega&&b.color===luckyColor){
      count++;api.setScore(count);
      for(let k=3;k>0;k--)sparks.push({x:b.x+rnd(-b.r*0.3,b.r*0.3),y:b.y-b.r*0.95,vx:rnd(-0.8,0.8),vy:-rnd(1,2.2),life:1,decay:0.025,sz:rnd(3,5.5),col:"#fff0a0"});
      api.tone(1568,0.07,"triangle",0.05);
    }
    // count toward the stage target colour
    if(targetLeft>0&&b.color===target){   // にじいろは的を進めない(連鎖の吸着には今まで通り加わる)
      targetLeft--;
      if(!banner&&targetLeft>0)floats.push({x:b.x,y:b.y-34,txt:"せいかい！",life:1,vy:-1.2,t:0,col:target,size:26});
      if(targetLeft<=0)clearStage();
    }
    const big=waveN>=6;
    api.tone(500*Math.pow(2,clamp(waveN,0,18)/12),0.08,"triangle",0.1);api.noise(0.05,0.12,1800);
    api.slide(900,1500,0.06,0.05,"sine");
    api.shake(2+Math.min(waveN*0.4,7));
    if(big){flash=Math.max(flash,0.55);flashCol=lightenC(b.color,80);}   // ヒットストップは連鎖開始時(startChain)の1回だけ
    // 壊れ方のバラエティ(軸7向け): 形ごとに壊れ方を変える(バラバラ/空気が抜けて飛ぶ/ハートが昇る/水しぶき/2段われ)
    if(b.shape==='stack'){
      // つみかさなり: 上の小玉が先にパン! 6フレームおくれて下の大玉がドサッと割れる(「2つ割れた」と見える)
      burst(b,b.x,b.y-b.r*0.85,b.r*0.62,big,5,3,false);
      api.tone(1100,0.05,"triangle",0.07);
      setTimeout2(()=>{
        burst(b,b.x,b.y,b.r,big,rint(8,12),rint(5,8),false);
        for(let k=rint(4,7);k>0;k--){const a=rnd(Math.PI*0.15,Math.PI*0.85),s=rnd(1.5,4);
          confetti.push({x:b.x+rnd(-b.r*0.4,b.r*0.4),y:b.y+rnd(-b.r*0.4,b.r*0.4),vx:Math.cos(a)*s*0.4,vy:Math.abs(Math.sin(a))*s+2.2,s:rnd(5,9),color:b.color,rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.008,0.014)});}
        api.tone(330,0.09,"triangle",0.09);api.noise(0.06,0.12,900);api.shake(3);
      },6);
    } else if(b.shape==='long'){
      // どうぶつふうせん: 割れずに「ぷしゅー」と空気が抜けて、ジグザグに飛び回りながら小さくなって消える
      burst(b,b.x,b.y,b.r,big,2,rint(3,5),true);
      ghosts.push({x:0,y:0,gx:b.x,gy:b.y,r:b.r,color:b.color,shape:'long',an:b.an,phase:b.phase,wob:b.wob,shimmer:b.shimmer,sq:1,boss:0,rainbow:false,
        ang:rnd(0,TAU),sp:rnd(3.2,4.6),t:0,life:1,rot:rnd(-0.4,0.4)});
      if(ghosts.length<=3){api.noise(0.45,0.1,1500,"bandpass",0.8);api.slide(900,260,0.4,0.05,"sawtooth");}
    } else if(b.shape==='heart'){
      // ハートふうせん: 小さなハートが上へふわっと昇る
      burst(b,b.x,b.y,b.r,big,rint(3,5),rint(5,8),false);
      for(let k=rint(6,8);k>0;k--){
        confetti.push({x:b.x+rnd(-b.r*0.5,b.r*0.5),y:b.y+rnd(-b.r*0.3,b.r*0.3),vx:rnd(-0.9,0.9),vy:-rnd(1.1,2.4),g:0,s:rnd(8,14),color:Math.random()<0.6?b.color:"#ff9ec4",
          rot:rnd(-0.3,0.3),vr:rnd(-0.04,0.04),life:1,decay:rnd(0.007,0.012),heart:true});}
      api.tone(1318,0.08,"sine",0.06);
    } else if(b.shape==='water'){
      // みずふうせん: 青い水しぶきが下へ飛び、みずたまりが少し残る
      burst(b,b.x,b.y,b.r,big,3,rint(4,6),false);
      for(let k=rint(14,18);k>0;k--){
        confetti.push({x:b.x+rnd(-b.r*0.4,b.r*0.4),y:b.y+rnd(-b.r*0.2,b.r*0.3),vx:rnd(-4,4),vy:rnd(-1.5,4),g:0.3,s:rnd(5,10),color:Math.random()<0.6?"#6ec6ff":"#c4ecff",
          rot:0,vr:0,life:1,decay:rnd(0.014,0.022),drop:true});}
      puddles.push({x:b.x,y:b.y+b.r*0.75,r:b.r*0.3,max:b.r*1.4,life:1});
      api.noise(0.16,0.1,3200,"bandpass",1.2);api.slide(700,300,0.12,0.05,"sine");
    } else {
      burst(b,b.x,b.y,b.r,big,rint(8,13),rint(5,9),false);
    }
  }
  // 割れた時の共通の見せ場: 輪っか・光のにじみ・紙吹雪・キラキラ(x,y,r は割れる場所と大きさ)
  function burst(b,x,y,r,big,nc,ns,long){
    rings.push({x,y,r:r*0.6,max:r*(big?2.6:1.9),life:1,col:b.color,lw:big?6:4});
    shines.push({x,y,r:r*1.2,max:r*(big?3.4:2.4),life:1,col:lightenC(b.color)});
    for(let k=nc;k>0;k--){const a=rnd(0,TAU),s=rnd(2,7);
      confetti.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,s:rnd(4,9),color:Math.random()<0.5?b.color:"#fff",rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.012,0.022),long:long});}
    for(let k=ns;k>0;k--){const a=rnd(0,TAU),s=rnd(3,9);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.03,0.06),sz:rnd(2,5),col:Math.random()<0.4?"#fff":lightenC(b.color)});}
  }
  // boss balloon takes several taps; final tap = big explosion
  function hitBoss(b){
    b.boss--;b.sq=1.4;b.r*=0.9;
    api.tone(220,0.1,"square",0.12);api.noise(0.06,0.16,900);api.shake(5);
    rings.push({x:b.x,y:b.y,r:b.r*0.5,max:b.r*2.2,life:1,col:lightenC(b.color,60),lw:6});
    for(let k=6;k>0;k--){const a=rnd(0,TAU),s=rnd(3,7);
      sparks.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.03,0.05),sz:rnd(3,6),col:"#fff"});}
    if(b.boss<=0){
      b.popped=true;quietT=0;count+=b.big?2:1;api.setScore(count);
      api.boom(0.85);api.shake(13);tryHitStop(5);flash=Math.max(flash,0.7);flashCol=lightenC(b.color,80);
      if(b.big){if(targetLeft>0&&b.color===target){targetLeft=Math.max(0,targetLeft-1);if(targetLeft<=0)clearStage();}}
      else if(targetLeft>0){targetLeft=Math.max(0,targetLeft-2);if(targetLeft<=0)clearStage();}
      // 熱気球が壊れて、ゴンドラが切り離されて下へ落ちる(別の壊れ方)
      {const brx=b.r*0.85,bry=b.r;
       gondolas.push({x:b.x,y:b.y+bry*0.62+bry*0.21,w:Math.max(6,brx*0.34),h:Math.max(6,bry*0.42),vx:rnd(-1.2,1.2),vy:-2.2,rot:0,vr:rnd(-0.08,0.08),life:1});
       api.slide(500,120,0.5,0.08,"triangle");}
      floats.push({x:b.x,y:b.y-30,txt:b.big?"ねっききゅう どかーん！":"ボス どっかーん！",life:1,vy:-1.1,t:0,col:b.big?"#ffd23f":"#ff3b3b",size:b.big?34:42});
      for(let k=40;k>0;k--){const a=rnd(0,TAU),s=rnd(3,12);
        confetti.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(5,11),color:pick(COLORS),rot:rnd(0,TAU),vr:rnd(-0.6,0.6),life:1,decay:rnd(0.01,0.02)});}
    }
  }
  // stage target cleared -> celebrate + advance
  function clearStage(){
    stageClears++;
    api.boom(0.9);api.shake(11);tryHitStop(4);flash=Math.max(flash,0.7);flashCol="#fff0c8";
    showBanner("ステージ クリア！",target,true);
    // ③ パーフェクト: このステージで的の色を1こもにがさなかったら +3 & みどりの祝福
    if(escaped===0){count+=3;api.setScore(count);perfectT=2.2;api.tone(1760,0.14,"triangle",0.1);
      for(let k=18;k>0;k--){const a=rnd(0,TAU),s=rnd(3,8);
        confetti.push({x:api.W/2,y:api.H*0.52,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,s:rnd(4,9),color:"#7be08a",rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.01,0.02)});}}
    for(let k=50;k>0;k--){const a=rnd(0,TAU),s=rnd(3,11);
      confetti.push({x:api.W/2,y:api.H*0.45,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(5,11),color:pick(COLORS),rot:rnd(0,TAU),vr:rnd(-0.6,0.6),life:1,decay:rnd(0.008,0.016)});}
    setTimeout2(nextStage,56);
  }
  // tiny frame-based delay helper (no real timers; queued in frame loop)
  let queued=[];
  function setTimeout2(fn,frames){queued.push({fn,f:frames});}
  function chainMatch(o,cur,seedColor){
    // rainbow balloons join any chain; matching colour joins normally
    return o.rainbow||cur.rainbow||o.color===seedColor;
  }
  function startChain(b){
    waveN=0;const p0=pending.length,assisted=quietT>=QUIET_ASSIST;
    const seedColor=b.rainbow?null:b.color;
    const seen=new Set([b]);let frontier=[b],depth=0;
    while(frontier.length){
      const next=[];
      for(const cur of frontier){pending.push({b:cur,delay:depth*3});waveN++;
        for(const o of balloons){if(o.popped||o.boss>0||o.mega||seen.has(o))continue;
          const sc=seedColor||cur.color;
          if(chainMatch(o,cur,sc)&&Math.hypot(o.x-cur.x,o.y-cur.y)<chainR()){seen.add(o);next.push(o);
            // show the magic thread connecting same-color balloons
            links.push({a:cur,b2:o,col:lightenC(o.color,50),life:1,delay:depth*3,wob:rnd(0,TAU)});}}}
      frontier=next;depth++;
    }
    const total=seen.size;
    // 点が入るれんさ: 的の色/にじいろ/3こ以上/しばらく無得点(最初の1こ目や詰まった時の救済)
    const sc=assisted||total>=6||b.rainbow||seedColor===target;
    for(let i=p0;i<pending.length;i++)pending[i].sc=sc;
    // tiered chain reward: 3 / 6 / 10+
    if(total>=6){
      const pw=clamp(total/12,0.3,1);api.boom(pw);tryHitStop(clamp(2+Math.floor(total/4),2,6));
      flash=Math.max(flash,total>=10?0.7:0.5);flashCol=total>=10?"#ffffff":lightenC(b.rainbow?"#ffd23f":b.color,80);
    }
    if(total>=10){
      feverT=Math.max(feverT,60); // rainbow fever burst
      api.slide(400,1400,0.25,0.08,"sawtooth");
      for(let k=46;k>0;k--){const a=rnd(0,TAU),s=rnd(3,11);
        confetti.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,s:rnd(5,11),color:pick(COLORS),rot:rnd(0,TAU),vr:rnd(-0.6,0.6),life:1,decay:rnd(0.01,0.02)});}
    }
    if(total>=3)floats.push({x:b.x,y:b.y-40,txt:total+"こ どかん！",life:1,vy:-1.1,t:0,
      col:total>=10?"#ff3b3b":total>=6?"#ff8c42":"#ffd23f",size:total>=8?48:34});
  }
  reset();
  return{
    resize:function(){layout();mkClouds();mkMotes();},
    input(px,py,type){if(type!=="down")return;const b=at(px,py);
      if(b){b.sq=1.35;if(b.mega){hitMega(b);}else if(b.boss>0){hitBoss(b);}else{startChain(b);}return;}
      // ④ おひさま ひみつタップ(減点なしのごほうび): ふうせんに当たらなかったタップだけ反応
      if(Math.hypot(px-sunX,py-sunY)>=sunR){
        // 外れにも小さな反応(得点にはしない・quietTは触らない): 押せていることだけは伝える
        rings.push({x:px,y:py,r:6,max:26,life:1,col:'rgba(255,255,255,.8)',lw:3});api.tone(300,0.04,'sine',0.04);
        return;}
      {
        sunWink=1;api.tone(1318,0.1,"triangle",0.08);api.tone(1760,0.12,"triangle",0.06);
        for(let k=8;k>0;k--){const a=rnd(-TAU*0.5,0.2),s=rnd(2.5,6);
          sparks.push({x:sunX,y:sunY,vx:Math.cos(a)*s*0.7,vy:Math.sin(a)*s,life:1,decay:0.02,sz:rnd(3,6),col:"#ffe08a"});}
        for(let k=5;k>0;k--){const a=rnd(0,TAU),s=rnd(2,5);
          confetti.push({x:sunX,y:sunY,vx:Math.cos(a)*s,vy:Math.sin(a)*s+1,s:rnd(4,7),color:"#ffd23f",rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:0.014});}
      }}
    ,
    frame(dt,now){
      // process tiny queued delays (stage advance etc.)
      if(queued.length){for(const q of queued)q.f-=dt;const ready=queued.filter(q=>q.f<=0);queued=queued.filter(q=>q.f>0);for(const q of ready)q.fn();}
      if(hsCD>0)hsCD-=dt;
      quietT+=dt;if(pityCD>0)pityCD-=dt; // 軸3向けピティ: 無得点の経過を計測(得点が動いたらpop()側で0に戻る)
      // bg sky gradient (changes per stage)
      const sk=SKY[clamp(stage,0,SKY.length-1)];
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージの空色を薄く重ねて面ごとの雰囲気を変える(1面=あおぞらはそのまま)
        if(stage>0){g.save();g.globalAlpha=0.3;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,sk[0]);tg.addColorStop(0.55,sk[1]);tg.addColorStop(1,sk[2]);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,sk[0]);grd.addColorStop(0.55,sk[1]);grd.addColorStop(1,sk[2]);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // soft sun glow top
      let sun=g.createRadialGradient(api.W*0.82,api.H*0.12,0,api.W*0.82,api.H*0.12,api.W*0.5);
      sun.addColorStop(0,"rgba(255,250,225,.55)");sun.addColorStop(1,"rgba(255,250,225,0)");
      g.fillStyle=sun;g.fillRect(0,0,api.W,api.H);
      // おひさま本体(④ ひみつタップの的) + タップされたら ^_^ のウインク
      {const dR=Math.max(16,api.W*0.045);
        g.save();g.globalAlpha=0.92;g.fillStyle="rgba(255,247,205,.95)";g.shadowColor="rgba(255,240,180,.9)";g.shadowBlur=22;
        g.beginPath();g.arc(sunX,sunY,dR,0,TAU);g.fill();g.restore();
        if(sunWink>0){sunWink-=0.02*dt;
          g.save();g.globalAlpha=clamp(sunWink*1.4,0,1);g.strokeStyle="#e0a020";g.lineWidth=Math.max(2,dR*0.13);g.lineCap="round";
          g.beginPath();
          g.moveTo(sunX-dR*0.45,sunY-dR*0.05);g.quadraticCurveTo(sunX-dR*0.28,sunY-dR*0.34,sunX-dR*0.11,sunY-dR*0.05);
          g.moveTo(sunX+dR*0.11,sunY-dR*0.05);g.quadraticCurveTo(sunX+dR*0.28,sunY-dR*0.34,sunX+dR*0.45,sunY-dR*0.05);
          g.stroke();
          g.beginPath();g.arc(sunX,sunY+dR*0.12,dR*0.34,0.12*Math.PI,0.88*Math.PI);g.stroke();
          g.restore();g.globalAlpha=1;if(sunWink<0)sunWink=0;}}
      // drifting clouds ※画像背景のときは絵に雲があるので描かない
      if(!imgBg) for(const cl of clouds){cl.x+=cl.vx*dt;if(cl.x-90*cl.s>api.W)cl.x=-90*cl.s;
        g.save();g.globalAlpha=0.7;g.fillStyle="rgba(255,255,255,.9)";
        const s=cl.s;
        g.beginPath();g.arc(cl.x,cl.y,26*s,0,TAU);g.arc(cl.x+30*s,cl.y-6*s,34*s,0,TAU);
        g.arc(cl.x+62*s,cl.y,24*s,0,TAU);g.arc(cl.x+30*s,cl.y+10*s,30*s,0,TAU);g.fill();
        g.restore();}
      g.globalAlpha=1;
      // ambient floating light motes (always alive)
      g.save();g.globalCompositeOperation="lighter";
      for(const m of motes){m.ph+=0.03*dt;m.y+=m.vy*dt;m.x+=Math.sin(m.ph)*m.drift*dt;
        if(m.y<-6){m.y=api.H+6;m.x=rnd(0,api.W);}
        const tw=0.3+0.5*(0.5+0.5*Math.sin(m.ph*1.7));
        g.globalAlpha=tw*0.5;g.fillStyle="rgba(255,255,245,1)";
        g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";
      // spawn (rate tightens with stage)
      // 同時密度の上限を下げ(軸3向け): 非照準タップの命中率を下げ、狙って選ぶ意味を増やす
      // (下げすぎるとmaxQuietSecが伸びてしまうため15/14に調整。変更後は必ずN=1..12再測)
      spawnT-=dt;if(spawnT<=0&&balloons.length<15){balloons.push(mk(null,quietT>=PITY_T));spawnT=stageSpawn();}
      // 軸3向けピティ: 無得点がPITY_T続いたら、通常の間隔/上限を少し越えてでも的カラーのふうせんを差し込む(連発しないようPITY_CDのクールダウン)
      // 通常spawnの上限(15)は「非照準タップの命中率を下げる」ための意図的な制限なので、ピティだけは専用の高めの上限(20)を使い分ける
      if(quietT>=PITY_T&&pityCD<=0&&balloons.length<20){balloons.push(mkPity());pityCD=PITY_CD;}
      // occasional rainbow balloon (stage 2+)
      if(stage>=1){rainbowT-=dt;if(rainbowT<=0){if(balloons.length<15)balloons.push(mkRainbow());rainbowT=rint(360,560);}}
      // occasional boss balloon (stage 3+)
      if(stage>=2){bossT-=dt;if(bossT<=0){if(balloons.filter(b=>b.boss>0&&!b.big).length===0&&balloons.length<14)balloons.push(mkBoss());bossT=rint(520,760);}}
      // 大きな熱気球(stage 2+): 2タップで壊れる乗り物ふうせん
      if(stage>=1){bigT-=dt;if(bigT<=0){if(!balloons.some(b=>b.big)&&balloons.length<14)balloons.push(mkBig());bigT=rint(420,620);}}
      // ② だいあたり ふうせん(全ステージ・激レア): 接近予告→出現。割ると虹の大盤振る舞い＋大量得点
      superRareT-=dt;
      if(superRareT<=60&&megaWarnT<=0&&!balloons.some(b=>b.mega)){megaWarnT=1.4;api.tone(1568,0.1,"triangle",0.06);}
      if(superRareT<=0){if(!balloons.some(b=>b.mega)&&balloons.length<15)balloons.push(mkMega());superRareT=rint(640,940);}
      // move
      for(const b of balloons){if(b.popped)continue;b.phase+=0.04*dt;b.y+=b.vy*dt;b.x+=Math.sin(b.phase)*0.4*dt;
        b.wob+=0.08*dt;b.shimmer+=0.06*dt;b.sq+=(1-b.sq)*0.12*dt;}
      // ③ パーフェクト判定: 的の色のふうせんを画面上に にがしたら記録
      for(const b of balloons){if(!b.popped&&b.y<=-b.r*2.5&&!b.rainbow&&!b.mega&&!b.big&&b.color===target)escaped++;}
      balloons=balloons.filter(b=>!b.popped&&b.y>-b.r*2.5);
      // pending pops (wave)
      for(const p of pending)p.delay-=dt;
      const go=pending.filter(p=>p.delay<=0);pending=pending.filter(p=>p.delay>0);
      for(const p of go)pop(p.b,p.sc);
      balloons=balloons.filter(b=>!b.popped);
      // みずたまり(みずふうせんが割れた跡・しばらく残る)
      for(const pd of puddles){pd.r+=(pd.max-pd.r)*0.12*dt;pd.life-=0.011*dt;
        const a=Math.max(0,pd.life);if(a<=0)continue;
        g.save();g.globalAlpha=a*0.5;g.fillStyle="#8fd4ff";
        g.beginPath();g.ellipse(pd.x,pd.y,Math.max(0.5,pd.r),Math.max(0.5,pd.r*0.3),0,0,TAU);g.fill();
        g.globalAlpha=a*0.8;g.strokeStyle="#e8f8ff";g.lineWidth=2;g.stroke();g.restore();}
      puddles=puddles.filter(pd=>pd.life>0);
      // glow shines (under balloons)
      for(const s of shines){s.r+=(s.max-s.r)*0.18*dt;s.life-=0.05*dt;
        const a=Math.max(0,s.life)*0.5;if(a<=0)continue;
        let rg=g.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r);
        rg.addColorStop(0,"rgba(255,255,255,"+a+")");rg.addColorStop(0.5,s.col.replace("rgb(","rgba(").replace(")",","+(a*0.6)+")"));
        rg.addColorStop(1,"rgba(255,255,255,0)");
        g.fillStyle=rg;g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();}
      shines=shines.filter(s=>s.life>0);
      // chain links: glowing magic threads between same-color balloons
      g.save();g.globalCompositeOperation="lighter";
      for(const ln of links){
        if(ln.delay>0)ln.delay-=dt; else ln.life-=0.045*dt;
        ln.wob+=0.25*dt;
        const a=ln.a,b2=ln.b2;if(a.popped||b2.popped){ln.life-=0.12*dt;}
        const al=Math.max(0,ln.life);if(al<=0)continue;
        const mx=(a.x+b2.x)/2+Math.sin(ln.wob)*8,my=(a.y+b2.y)/2+Math.cos(ln.wob)*8;
        g.globalAlpha=al*0.9;g.strokeStyle=ln.col;g.lineWidth=3.5;g.lineCap="round";
        g.shadowColor=ln.col;g.shadowBlur=14;
        g.beginPath();g.moveTo(a.x,a.y);g.quadraticCurveTo(mx,my,b2.x,b2.y);g.stroke();
        // a little sparkle riding the thread
        g.globalAlpha=al;g.fillStyle="#fff";g.shadowBlur=10;
        g.beginPath();g.arc(mx,my,2.6,0,TAU);g.fill();
      }
      g.restore();g.globalAlpha=1;g.shadowBlur=0;g.globalCompositeOperation="source-over";
      links=links.filter(ln=>ln.life>0);
      // draw balloons (sorted by y so lower in front)
      const order=balloons.slice().sort((a,b)=>a.y-b.y);
      for(const b of order)drawBalloon(b);
      // 空気が抜けて ぷしゅーと飛ぶどうぶつふうせん(ジグザグに飛んで小さくなって消える)
      for(const gh of ghosts){gh.t+=dt;gh.life-=0.0085*dt;gh.ang+=Math.sin(gh.t*0.35)*0.22*dt;
        gh.gx+=Math.cos(gh.ang)*gh.sp*dt;gh.gy+=Math.sin(gh.ang)*gh.sp*dt-0.4*dt;gh.r=Math.max(3,gh.r*Math.pow(0.987,dt));gh.rot+=0.12*dt*Math.sin(gh.t*0.35);
        gh.phase+=0.3*dt;gh.wob+=0.3*dt;gh.shimmer+=0.06*dt;
        if(gh.life<=0)continue;
        g.save();g.globalAlpha=clamp(gh.life*1.6,0,1);g.translate(gh.gx,gh.gy);g.rotate(gh.rot+gh.ang*0.5);drawBalloon(gh);g.restore();}
      g.globalAlpha=1;ghosts=ghosts.filter(gh=>gh.life>0&&gh.gx>-80&&gh.gx<api.W+80&&gh.gy>-120&&gh.gy<api.H+80);
      // 落ちていくボスのゴンドラ
      for(const gd of gondolas){gd.vy+=0.35*dt;gd.x+=gd.vx*dt;gd.y+=gd.vy*dt;gd.rot+=gd.vr*dt;gd.life-=0.011*dt;
        if(gd.life<=0)continue;
        g.save();g.globalAlpha=clamp(gd.life*1.5,0,1);g.translate(gd.x,gd.y);g.rotate(gd.rot);
        g.strokeStyle="rgba(60,45,30,.6)";g.lineWidth=1.5;g.beginPath();g.moveTo(-gd.w,-gd.h*0.5);g.lineTo(-gd.w*0.6,-gd.h*1.4);g.moveTo(gd.w,-gd.h*0.5);g.lineTo(gd.w*0.6,-gd.h*1.4);g.stroke();
        g.fillStyle="#7a5a3a";g.fillRect(-gd.w,-gd.h*0.5,gd.w*2,gd.h);
        g.strokeStyle="rgba(0,0,0,.4)";g.lineWidth=1.5;g.strokeRect(-gd.w,-gd.h*0.5,gd.w*2,gd.h);g.restore();}
      g.globalAlpha=1;gondolas=gondolas.filter(gd=>gd.life>0&&gd.y<api.H+80);
      // rings
      g.save();
      for(const r of rings){r.r+=(r.max-r.r)*0.25*dt;r.life-=0.06*dt;
        g.globalAlpha=Math.max(0,r.life);g.strokeStyle=r.col;g.lineWidth=r.lw||4;
        g.shadowColor=r.col;g.shadowBlur=12;
        g.beginPath();g.arc(r.x,r.y,r.r,0,TAU);g.stroke();}
      g.restore();g.globalAlpha=1;rings=rings.filter(r=>r.life>0);
      // confetti
      for(const c of confetti){c.vy+=(c.g==null?0.18:c.g)*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=c.vr*dt;c.life-=c.decay*dt;
        g.save();g.globalAlpha=Math.max(0,c.life);g.translate(c.x,c.y);g.rotate(c.rot);g.fillStyle=c.color;
        if(c.heart){const hs=c.s;g.beginPath();g.moveTo(0,hs*0.45);g.bezierCurveTo(hs*0.9,-hs*0.1,hs*0.45,-hs*0.7,0,-hs*0.25);
          g.bezierCurveTo(-hs*0.45,-hs*0.7,-hs*0.9,-hs*0.1,0,hs*0.45);g.closePath();g.fill();}
        else if(c.drop){g.beginPath();g.arc(0,0,Math.max(0.5,c.s*0.45),0,TAU);g.fill();}
        else if(c.long)g.fillRect(-c.s*0.18,-c.s*0.9,Math.max(0.5,c.s*0.36),Math.max(0.5,c.s*1.8));
        else g.fillRect(-c.s/2,-c.s/3,c.s,c.s*0.66);
        g.restore();}
      g.globalAlpha=1;confetti=confetti.filter(c=>c.life>0);
      // sparkles (4-point twinkle)
      g.save();g.globalCompositeOperation="lighter";
      for(const sp of sparks){sp.vx*=0.94;sp.vy*=0.94;sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.life-=sp.decay*dt;
        const a=Math.max(0,sp.life),z=sp.sz*(0.4+a*0.9);
        g.globalAlpha=a;g.fillStyle=sp.col;g.translate(sp.x,sp.y);
        g.beginPath();g.moveTo(0,-z*2);g.lineTo(z*0.5,0);g.lineTo(0,z*2);g.lineTo(-z*0.5,0);g.closePath();
        g.moveTo(-z*2,0);g.lineTo(0,z*0.5);g.lineTo(z*2,0);g.lineTo(0,-z*0.5);g.closePath();g.fill();
        g.setTransform(api.dpr,0,0,api.dpr,0,0);}
      g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";sparks=sparks.filter(sp=>sp.life>0);
      // floats
      for(const f of floats){f.t+=dt;f.y+=f.vy*dt;f.life-=0.014*dt;
        const pop=1+Math.max(0,0.4-f.t*0.05)*2;
        g.save();g.globalAlpha=Math.max(0,f.life);g.translate(f.x,f.y);g.scale(pop,pop);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.shadowColor=f.col;g.shadowBlur=18;
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,0,0);
        g.shadowBlur=0;g.fillStyle=f.col;g.fillText(f.txt,0,0);g.restore();}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // rainbow fever wash (big chains)
      if(feverT>0){feverT-=dt;const fa=Math.max(0,Math.min(1,feverT/60))*0.35;
        g.save();g.globalCompositeOperation="lighter";
        let fg=g.createLinearGradient(0,0,api.W,api.H);
        const hue=(now*0.12)%360;
        fg.addColorStop(0,"hsla("+hue+",90%,65%,"+fa+")");
        fg.addColorStop(0.5,"hsla("+((hue+120)%360)+",90%,65%,"+fa+")");
        fg.addColorStop(1,"hsla("+((hue+240)%360)+",90%,65%,"+fa+")");
        g.fillStyle=fg;g.fillRect(0,0,api.W,api.H);g.restore();g.globalCompositeOperation="source-over";}
      // climax full-screen colour wash
      if(flash>0){flash-=0.04*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa;
        g.fillStyle=flashCol;g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;g.globalCompositeOperation="source-over";}
      // top HUD: current goal (上部中央＝engine HUDと衝突しない安全帯)
      if(targetLeft>0){
        g.save();g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="left";g.textBaseline="middle";
        const label="この いろを あと "+targetLeft+"こ！";
        const mt=g.measureText(label),tw=(mt&&mt.width)||label.length*10;
        const bw=tw+58,bh=34,px0=api.W/2-bw/2,py0=10;
        roundRect(px0,py0,bw,bh,bh/2);g.fillStyle="rgba(40,60,100,.62)";g.fill();
        g.beginPath();g.arc(px0+24,py0+bh/2,11,0,TAU);g.fillStyle=target;g.shadowColor=target;g.shadowBlur=10;g.fill();g.shadowBlur=0;
        g.fillStyle="#fff";g.fillText(label,px0+44,py0+bh/2+1);g.restore();g.textAlign="left";g.textBaseline="alphabetic";
      }
      // stage banner (big, brief)
      if(banner){banner.t+=dt;banner.life-=0.012*dt;
        const a=Math.max(0,Math.min(1,banner.life*1.3)),pop=1+Math.max(0,0.5-banner.t*0.045)*1.6;
        g.save();g.globalAlpha=a;g.translate(api.W/2,api.H*0.46);g.scale(pop,pop);
        g.font="900 "+(banner.big?54:40)+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
        g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(banner.txt,0,0);
        g.shadowColor=banner.col;g.shadowBlur=24;g.fillStyle=banner.col;g.fillText(banner.txt,0,0);
        g.restore();g.textAlign="left";g.textBaseline="alphabetic";
        if(banner.life<=0)banner=null;
      }
      // ② だいあたり ふうせん 接近予告バナー(虹色・上部中央=HUD安全帯)
      if(megaWarnT>0){megaWarnT-=0.016*dt;
        const a=clamp(megaWarnT,0,1),col="hsl("+((now*0.2)%360)+",85%,62%)";
        g.save();g.globalAlpha=a;g.translate(api.W/2,api.H*0.2);
        g.font="900 24px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.35)";g.strokeText("キラキラ ふうせん せっきん！",0,0);
        g.shadowColor=col;g.shadowBlur=16;g.fillStyle=col;g.fillText("キラキラ ふうせん せっきん！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(megaWarnT<0)megaWarnT=0;}
      // ① きょうのラッキー色 お知らせ(初回だけ・中央)
      if(luckyIntroT>0){luckyIntroT-=0.016*dt;
        const a=clamp(luckyIntroT*1.2,0,1),pop=1+Math.max(0,luckyIntroT-2.2)*1.5;
        g.save();g.globalAlpha=a;g.translate(api.W/2,api.H*0.5);g.scale(pop,pop);
        g.font="900 26px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
        const txt="きょうの ラッキーいろは "+CNAME[COLORS.indexOf(luckyColor)]+"！";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.4)";g.strokeText(txt,0,0);
        g.shadowColor=luckyColor;g.shadowBlur=16;g.fillStyle="#fff";g.fillText(txt,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";
        if(luckyIntroT<=0){luckyIntroShown=true;luckyIntroT=0;}}
      // ③ パーフェクト！ バナー(クリア文字の下=重ねない)
      if(perfectT>0){perfectT-=0.014*dt;
        const a=clamp(perfectT*1.3,0,1),pop=1+Math.max(0,perfectT-1.6)*1.5;
        g.save();g.globalAlpha=a;g.translate(api.W/2,api.H*0.68);g.scale(pop,pop);
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
        g.lineWidth=6;g.strokeStyle="rgba(20,90,40,.6)";g.strokeText("パーフェクト！",0,0);
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=18;g.fillStyle="#c7ffcf";g.fillText("パーフェクト！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(perfectT<0)perfectT=0;}
      hintPulse+=0.05*dt;
      // cute rounded HUD: hint pill (bottom)
      g.save();const hint="うえの いろを タップ！ おなじ いろが れんさで われる！";
      g.font="800 19px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
      const mt=g.measureText(hint),tw2=(mt&&mt.width)||hint.length*11,pw=tw2+40,ph2=40,pulse=1+Math.sin(hintPulse)*0.02;
      g.translate(api.W/2,api.H-30);g.scale(pulse,pulse);
      roundRect(-pw/2,-ph2/2,pw,ph2,ph2/2);
      g.fillStyle="rgba(60,90,140,.7)";g.shadowColor="rgba(0,0,0,.25)";g.shadowBlur=8;g.fill();
      g.shadowBlur=0;g.lineWidth=2.5;g.strokeStyle="rgba(255,255,255,.6)";g.stroke();
      g.fillStyle="#fff";g.shadowColor="rgba(80,120,180,.9)";g.shadowBlur=6;
      g.fillText(hint,0,1);g.restore();g.textAlign="left";g.textBaseline="alphabetic";
      g.globalCompositeOperation="source-over";
    }
  };
  function drawBalloon(b){
    const sq=b.sq||1,wob=Math.sin(b.wob)*0.04;
    let rx=b.r*0.85*(2-sq)*(1+wob),ry=b.r*sq*(1-wob);
    // 形のバラエティ(軸7向け): 細長い風船(動物風船っぽい二段ふくらみ)を混ぜる
    if(b.shape==='long'){rx*=0.55;ry*=1.7;}
    rx=Math.max(0.5,rx);ry=Math.max(0.5,ry);
    g.save();g.translate(b.x,b.y);
    // soft drop shadow under body
    g.save();g.globalAlpha=0.18;g.fillStyle="#1a3a5a";
    g.beginPath();g.ellipse(b.r*0.12,b.r*0.16,rx,ry,0,0,TAU);g.fill();g.restore();
    // string (gentle curve)
    g.strokeStyle="rgba(40,60,90,.35)";g.lineWidth=1.5;g.beginPath();g.moveTo(0,ry*0.95);
    g.quadraticCurveTo(Math.sin(b.phase*2)*6,ry*1.4,Math.sin(b.phase)*4,ry*1.85);g.stroke();
    // knot
    g.fillStyle=b.color;g.beginPath();g.moveTo(-4,ry*0.92);g.lineTo(4,ry*0.92);g.lineTo(0,ry*1.05);g.closePath();g.fill();
    // ふうせん本体は全て手描き(色バリエーション/ラッキー色/連鎖の仕掛みを無傷で保つ)。
    // ボス(紺)/にじいろは画像スプライトの生成が不良続きだったため、画像は使わない。
    // body with rich radial gradient
    let grd;
    if(b.rainbow){
      // shifting rainbow fill
      const hue=(b.shimmer*40)%360;
      grd=g.createRadialGradient(-rx*0.35,-ry*0.4,b.r*0.1,0,0,b.r*1.05);
      grd.addColorStop(0,"#ffffff");
      grd.addColorStop(0.4,"hsl("+hue+",90%,70%)");
      grd.addColorStop(0.75,"hsl("+((hue+90)%360)+",85%,60%)");
      grd.addColorStop(1,"hsl("+((hue+180)%360)+",80%,55%)");
      g.save();g.shadowColor="hsl("+hue+",90%,65%)";g.shadowBlur=16;g.fillStyle=grd;
      g.beginPath();g.ellipse(0,0,rx,ry,0,0,TAU);g.fill();g.restore();
    } else {
      grd=g.createRadialGradient(-rx*0.35,-ry*0.4,b.r*0.1,0,0,b.r*1.05);
      grd.addColorStop(0,lightenC(b.color,90));grd.addColorStop(0.45,lightenC(b.color,30));
      grd.addColorStop(1,b.color);
      g.save();g.shadowColor=b.color;g.shadowBlur=b.boss>0?18:10;g.fillStyle=grd;
      if(b.shape==='long'){
        // 動物風船らしい二段ふくらみ(軸7向け): 丸いだけの輪郭差を出すため下の大玉+上の小玉+くびれの陰で表現
        const loY=ry*0.30,loRx=Math.max(0.5,rx*1.05),loRy=Math.max(0.5,ry*0.62);
        const hiY=-ry*0.55,hiRx=Math.max(0.5,rx*0.72),hiRy=Math.max(0.5,ry*0.42);
        g.beginPath();g.ellipse(0,loY,loRx,loRy,0,0,TAU);g.fill();
        g.beginPath();g.ellipse(0,hiY,hiRx,hiRy,0,0,TAU);g.fill();
        // どうぶつの耳(軸7向け): ねこ(三角)とうさぎ(長い耳)を風船ごとに出し分ける
        if((b.an||0)<0.5){
          for(const sg of[-1,1]){g.beginPath();g.moveTo(sg*hiRx*0.95,hiY-hiRy*0.15);g.lineTo(sg*hiRx*0.75,hiY-hiRy*1.45);g.lineTo(sg*hiRx*0.12,hiY-hiRy*0.85);g.closePath();g.fill();}
        } else {
          for(const sg of[-1,1]){g.beginPath();g.ellipse(sg*hiRx*0.5,hiY-hiRy*1.25,Math.max(0.5,hiRx*0.26),Math.max(0.5,hiRy*0.85),sg*0.18,0,TAU);g.fill();}
        }
        g.save();g.globalAlpha=0.3;g.strokeStyle="rgba(30,50,80,.6)";g.lineWidth=Math.max(1,rx*0.14);
        g.beginPath();g.ellipse(0,-ry*0.05,Math.max(0.5,rx*0.42),Math.max(0.5,ry*0.15),0,0,TAU);g.stroke();g.restore();
      } else if(b.shape==='water'){
        // みずふうせん(軸7向け): 下ぶくれのしずく形。白いしずくの模様つき
        g.beginPath();g.moveTo(0,-ry);
        g.bezierCurveTo(rx*0.75,-ry,rx*1.35,ry*0.15,rx,ry*0.62);
        g.bezierCurveTo(rx*0.7,ry*1.05,-rx*0.7,ry*1.05,-rx,ry*0.62);
        g.bezierCurveTo(-rx*1.35,ry*0.15,-rx*0.75,-ry,0,-ry);
        g.closePath();g.fill();
        g.save();g.globalAlpha=0.7;g.fillStyle="#fff";g.beginPath();g.moveTo(rx*0.12,ry*0.05);
        g.quadraticCurveTo(rx*0.42,ry*0.42,rx*0.12,ry*0.55);g.quadraticCurveTo(-rx*0.18,ry*0.42,rx*0.12,ry*0.05);g.fill();g.restore();
      } else if(b.shape==='heart'){
        // ハートふうせん(軸7向け): round/long/stackと明確に違う輪郭をもう1種類混ぜる
        const hw=rx,hh=ry;
        g.beginPath();g.moveTo(0,hh*0.62);
        g.bezierCurveTo(hw*1.35,hh*0.05,hw*0.85,-hh*1.05,0,-hh*0.28);
        g.bezierCurveTo(-hw*0.85,-hh*1.05,-hw*1.35,hh*0.05,0,hh*0.62);
        g.closePath();g.fill();
      } else {
        g.beginPath();g.ellipse(0,0,rx,ry,0,0,TAU);g.fill();
      }
      g.restore();
      // どうぶつの顔(軸7向け): 目2つ+はな+口。ghost(空気が抜けて飛ぶ)も同じ絵なので飛び回る動物に見える
      if(b.shape==='long'){
        const hiY2=-ry*0.55,hiRx2=Math.max(0.5,rx*0.72),hiRy2=Math.max(0.5,ry*0.42),er=Math.max(1.5,hiRx2*0.2);
        g.save();
        for(const sg of[-1,1]){g.fillStyle="#fff";g.beginPath();g.arc(sg*hiRx2*0.42,hiY2-hiRy2*0.05,er,0,TAU);g.fill();
          g.fillStyle="#2a2a3a";g.beginPath();g.arc(sg*hiRx2*0.42,hiY2-hiRy2*0.02,Math.max(0.8,er*0.55),0,TAU);g.fill();}
        g.fillStyle="#ff8aa8";g.beginPath();g.ellipse(0,hiY2+hiRy2*0.28,Math.max(0.8,er*0.55),Math.max(0.6,er*0.4),0,0,TAU);g.fill();
        g.strokeStyle="rgba(40,30,50,.7)";g.lineWidth=Math.max(1,er*0.3);g.lineCap="round";
        g.beginPath();g.arc(0,hiY2+hiRy2*0.3,Math.max(0.8,er*1.0),0.15*Math.PI,0.85*Math.PI);g.stroke();
        g.restore();
      }
      // つみかさなりふうせん(軸7向け): 同じ色の小さい風船を上に重ねて連なった輪郭にする(あたり判定は1個のまま)
      if(b.shape==='stack'){
        const r2=Math.max(0.5,rx*0.62),ry2=Math.max(0.5,ry*0.62),oy=-ry*0.85;
        let g2=g.createRadialGradient(-r2*0.35,oy-ry2*0.4,b.r*0.05,0,oy,r2*1.05);
        g2.addColorStop(0,lightenC(b.color,90));g2.addColorStop(0.45,lightenC(b.color,30));g2.addColorStop(1,b.color);
        g.save();g.shadowColor=b.color;g.shadowBlur=8;g.fillStyle=g2;
        g.beginPath();g.ellipse(0,oy,r2,ry2,0,0,TAU);g.fill();g.restore();
        g.strokeStyle="rgba(40,60,90,.35)";g.lineWidth=1.2;g.beginPath();
        g.moveTo(0,oy+ry2*0.9);g.lineTo(0,-ry*0.95);g.stroke();
      }
      if(b.boss>0){
        // ボス=乗り物寄りの輪郭を強調(軸7向け): ゴンドラを大きく・ロープを2本→4本にして熱気球らしさを出す
        const gw=Math.max(0.5,rx*0.34),gh=Math.max(0.5,ry*0.42),gy=ry*0.62;
        g.save();g.strokeStyle="rgba(60,45,30,.55)";g.lineWidth=1.4;
        g.beginPath();
        g.moveTo(-gw,gy);g.lineTo(-rx*0.6,ry*0.55);
        g.moveTo(gw,gy);g.lineTo(rx*0.6,ry*0.55);
        g.moveTo(-gw*0.5,gy);g.lineTo(-rx*0.2,ry*0.62);
        g.moveTo(gw*0.5,gy);g.lineTo(rx*0.2,ry*0.62);
        g.stroke();g.restore();
        g.save();g.fillStyle="#7a5a3a";
        g.fillRect(-gw,gy,gw*2,gh);
        g.strokeStyle="rgba(0,0,0,.35)";g.lineWidth=1.5;
        g.strokeRect(-gw,gy,gw*2,gh);
        g.restore();
        if(b.big){ // 大きな熱気球: 白いたてじまで「乗り物」らしく(ボスの紺の無地と見分ける)
          g.save();g.strokeStyle="rgba(255,255,255,.75)";g.lineWidth=Math.max(2,rx*0.07);
          for(const k of[-0.5,0,0.5]){g.beginPath();g.moveTo(0,-ry*0.98);g.quadraticCurveTo(rx*k*2.2,0,rx*k*0.9,ry*0.78);g.stroke();}
          g.restore();}
        // boss face: show remaining taps as little dots
        g.fillStyle="rgba(255,255,255,.9)";
        for(let i=0;i<b.boss;i++){g.beginPath();g.arc((i-(b.boss-1)/2)*rx*0.32,ry*0.18,rx*0.09,0,TAU);g.fill();}
      }
    }
    // rim light (bottom edge)
    g.save();g.globalAlpha=0.35;g.strokeStyle=lightenC(b.color,50);g.lineWidth=2;
    g.beginPath();g.ellipse(0,ry*0.06,rx*0.96,ry*0.96,0,0.3,Math.PI-0.3);g.stroke();g.restore();
    // main highlight
    g.fillStyle="rgba(255,255,255,.6)";g.beginPath();g.ellipse(-rx*0.32,-ry*0.34,rx*0.2,ry*0.28,-0.4,0,TAU);g.fill();
    // tiny shimmer spot
    const sh=0.5+0.5*Math.sin(b.shimmer);
    g.globalAlpha=0.4+sh*0.4;g.fillStyle="#fff";
    g.beginPath();g.ellipse(rx*0.28,-ry*0.18,rx*0.07,ry*0.1,0.5,0,TAU);g.fill();g.globalAlpha=1;
    g.restore();
  }
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function lightenC(hex,amt){const a=amt==null?60:amt;const c=parseInt(hex.slice(1),16);const r=clamp(((c>>16)&255)+a,0,255),gg=clamp(((c>>8)&255)+a,0,255),b=clamp((c&255)+a,0,255);return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("balloon", buildBalloon);
