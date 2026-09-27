function build_snowman(api){
  const g=api.g;
  // 画像アセット(無ければ従来の手描きにフォールバック)。白い雪だるま本体は手描きのまま(マフラー色の仕掛けを守る)
  api.preload(["bg.jpg","goldman.png","rainbowman.png","helmet.png"]);
  let mans=[],shards=[],rings=[],sparks=[],glints=[],floats=[];
  let R,count=0,combo=0,comboT=0,spawnT=0,tGlobal=0,flash=0,climax=0;
  // stage progression (endless)
  let stage=1,stageKill=0,stageGoal=8,clearT=0,clearStage=0,teaser="";
  // fever time (gauge fills on kills -> 10s of gold rush) + hitStop cooldown
  let fever=0,feverG=0,feverBann=0,hsCool=0;
  const FEVER_LEN=600;
  const COLD=["#bfeaff","#9fd8f5","#dff3ff","#c7e8ff","#a9defc"];
  const RAINBOW=["#ff5b5b","#ff8c42","#ffd23f","#7be08a","#4db8ff","#b58bff","#ff7bd0"];
  // ---- 隠し発見レイヤー(ハンマー/トラックと同じ思想) ----
  const SCARF=["#ff5b5b","#4db8ff","#ffd23f","#7be08a","#b58bff","#ff7bd0"];
  const SCARFNAME=["あか","あお","きいろ","みどり","むらさき","ももいろ"];
  let luckyColor=pick(SCARF),luckySeen=false,luckyMsgT=0; // ② きょうのラッキー色: マフラーの色
  let rbMsgT=0,pendingRare=null;                                       // ① にじいろ ゆきだるま(激レア・予告つき)
  let stageMelt=0,perfectT=0;                                          // ③ パーフェクト(だれも とけずに クリア)
  let bunny=null,bunnyT=240;                                           // ④ ひみつの ゆきうさぎ(みっけ でごほうび)
  // ---- 無反応アシスト(理不尽な"詰み時間"を防ぐ保険。ふだんの当たり判定は変えない) ----
  let idleF=0,assistMR=1,firstScored=false,started2=false;
  function stageGoalFor(s){return 10+(s-1)*3;}     // 10,13,16...（7〜8歳向けに手応えを増やした）
  function spawnInt(){return clamp(54-(stage-1)*5,30,54);}
  function lifeFor(){return clamp(132-(stage-1)*12,110,132);}
  // background props (built on layout)
  let bgFlakes=[],sparkles=[],hills=[];
  function buildBg(){
    bgFlakes=[];for(let i=0;i<60;i++)bgFlakes.push({x:rnd(0,api.W),y:rnd(0,api.H),
      r:rnd(1,3.4),sp:rnd(0.2,0.9),sway:rnd(0,TAU),sv:rnd(0.01,0.03),amp:rnd(6,22)});
    sparkles=[];for(let i=0;i<26;i++)sparkles.push({x:rnd(0,api.W),y:rnd(0,api.H*0.7),
      ph:rnd(0,TAU),sp:rnd(0.03,0.08),r:rnd(1,2.4)});
    hills=[
      {y:api.H*0.62,amp:api.H*0.05,wl:api.W*0.9,col:"#eef7ff",ph:0.3},
      {y:api.H*0.72,amp:api.H*0.06,wl:api.W*0.7,col:"#dcefff",ph:1.6},
      {y:api.H*0.82,amp:api.H*0.05,wl:api.W*1.1,col:"#cbe6fb",ph:2.4}
    ];
  }
  function layout(){
    R=clamp(Math.min(api.W,api.H)*0.085,34,72);
    buildBg();
  }
  layout();
  function spawn(){
    if(mans.length>=(fever>0?10:9))return;
    const x=rnd(R*1.4,api.W-R*1.4);
    const y=rnd(api.H*0.34,api.H*0.86);
    // ① にじいろ ゆきだるま: ステージ2以降、ごくまれ(約5%)。予告のきらめきが集まってから出る激レア。
    // count>0(既に1回は得点済み)を条件に足し、開始直後の最初のスポーン機会が予告で潰れないようにする
    if(stage>=2&&count>0&&!pendingRare&&!mans.some(m=>m.type==="rainbow")&&Math.random()<0.05){
      pendingRare={x,y,t:34};
      api.tone(523,0.12,"triangle",0.08);api.tone(784,0.14,"triangle",0.06);
      return;
    }
    // rare golden snowman (8%): glows, worth 5, rainbow burst on smash
    if(Math.random()<0.08){
      // 最初の得点が来るまでは他タイプと同じく大きめ固定にする(小さいと最初の成功が遠のく)
      mans.push({x,y,type:"gold",hp:1,mR:firstScored?R*rnd(0.85,1.2):R*1.25,born:0,state:"rise",pop:0,squash:1,flash:0,
        bob:rnd(0,TAU),life:lifeFor()*0.8,wobble:0});
      api.tone(1568,0.1,"triangle",0.09);api.tone(2093,0.16,"triangle",0.07);
      for(let i=0;i<4;i++)glints.push({x:x+rnd(-R,R),y:y+rnd(-R,R),r:rnd(5,10),life:1,decay:rnd(0.02,0.035)});
      return;
    }
    // iron-helmet snowman appears from stage 2; needs 2 taps
    const iron=stage>=2&&Math.random()<clamp(0.16+(stage-2)*0.06,0.16,0.30);
    // ⑤/⑥/⑦ 大小・形のバリエーション: 鉄かぶと以外は 雪だるま/雪玉/つらら/積みだるま の4種の見た目からランダムに選ぶ
    // (積みだるま=丸を3段重ねたシルエット。他の丸1〜2個の形とはっきり違う「積み重なった物」)
    let shape="snow";
    if(!iron){const sr=Math.random();shape=sr<0.35?"snow":(sr<0.6?"ball":(sr<0.85?"icy":"tower"));}
    // ⑦ とびきり大きな雪だるま: 得点後・ステージ2以降だけ ごくまれ(6%)。2回叩かないと倒れない特大サイズ。
    // 大小差(0.6〜2.1倍=最大3.5倍差)をさらに強調し、低学年にも「特別に大きい」と一目で分かる驚きを作る
    const big=!iron&&firstScored&&stage>=2&&Math.random()<0.06;
    // 最初の得点が来るまでは 大小バリエーションを出さず 大きめ固定にして最初の成功を早める
    // 得点後は大小差をはっきりさせる(0.6〜1.5倍、まれに1.9〜2.1倍の特大)。形の違いと合わせて壊す物の見分けを強くする
    const mr=big?R*rnd(1.9,2.1):(firstScored?R*rnd(0.6,1.5):R*1.25);
    mans.push({x,y,type:iron?"iron":(big?"snow":shape),hp:iron?2:(big?2:1),mR:mr,big,
      born:0,state:"rise",pop:0,squash:1,flash:0,bob:rnd(0,TAU),
      life:lifeFor(),wobble:0,scarf:pick(SCARF),fallDir:Math.random()<0.5?-1:1});
  }
  function spawnRainbowAt(x,y){
    // 予告が満ちて出現: 虹色に光る ゆきだるま。倒すと大量得点＋虹の大盤振る舞い。
    mans.push({x,y,type:"rainbow",hp:1,born:0,state:"rise",pop:0,squash:1,flash:0,
      bob:rnd(0,TAU),life:lifeFor()*0.85,wobble:0,scarf:null});
    api.tone(1046,0.12,"triangle",0.1);api.tone(1568,0.16,"triangle",0.08);
    for(let i=0;i<8;i++)glints.push({x:x+rnd(-R,R),y:y+rnd(-R,R),r:rnd(5,10),life:1,decay:rnd(0.02,0.035)});
  }
  function startFever(){
    fever=FEVER_LEN;feverG=0;feverBann=1.6;flash=1;climax=1;
    api.boom(0.8);api.shake(18);
    api.slide(392,1568,0.5,0.28,"sawtooth");
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.18,"triangle",0.13),i*80));
    if(hsCool<=0){api.hitStop(5);hsCool=30;}
    for(let i=0;i<28;i++){const a=rnd(0,TAU),s=rnd(3,10);
      shards.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(RAINBOW)});}
  }
  function burst(x,y,col,big){
    rings.push({x,y,r:R*0.4,vr:R*0.5,life:1,decay:0.05,col:"#ffffff"});
    rings.push({x,y,r:R*0.2,vr:R*0.4,life:1,decay:0.06,col});
    const n=(big?20:13)+Math.min(combo,8);
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(2.5,9);
      shards.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(3,8),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.022),
        col:i%4===0?col:"#ffffff"});}
    for(let i=0;i<rint(6,10);i++){const a=rnd(0,TAU),s=rnd(4,12);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(8,20),life:1,decay:rnd(0.05,0.09)});}
    for(let i=0;i<rint(3,5);i++)glints.push({x:x+rnd(-R,R),y:y+rnd(-R,R),r:rnd(4,9),life:1,decay:rnd(0.03,0.05)});
  }
  function checkStage(){
    if(stageKill<stageGoal||clearT>0)return;
    clearStage=stage;clearT=1.6;climax=Math.max(climax,0.7);
    api.boom(0.5);api.shake(12);
    api.slide(523,784,0.3,0.2,"triangle");api.tone(660,0.25,"triangle",0.14);
    api.tone(988,0.3,"triangle",0.1);
    for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
      shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(COLD)});}
    // ③ パーフェクト: このステージで だれも とけずに クリアしたら +3 & きんの星シャワー
    if(stageMelt===0){count+=3;api.setScore(count);perfectT=1.9;
      api.tone(1318,0.16,"triangle",0.12);api.tone(1976,0.18,"triangle",0.08);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(3,8);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(4,8),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:"#ffd23f"});}}
    stageMelt=0;
    const ns=stage+1;
    teaser=ns===2?"つぎは てつかぶとが でてくる！":
      pick(["きんいろ ゆきだるまを さがせ！","コンボで フィーバーを ためよう！",
            "つぎは もっと はやく でてくるよ！"]);
    stage++;stageGoal=stageGoalFor(stage);stageKill=0;buildBg();
  }
  function smash(m){
    // during fever everything dies in one hit
    if((m.type==="iron"||m.big)&&m.hp>1&&fever<=0){
      m.hp--;m.flash=1;m.squash=0.8;m.wobble=1;
      api.slide(420,260,0.08,0.2,"square");api.noise(0.06,0.14,2200,"highpass",1);
      api.tone(520,0.07,"square",0.1);api.shake(5);
      rings.push({x:m.x,y:m.y,r:R*0.5,vr:R*0.4,life:1,decay:0.06,col:"#dfeeff"});
      return;
    }
    m.state="smashed";m.squash=1;m.pop=1;
    const gold=m.type==="gold";
    const rbw=m.type==="rainbow";
    // ② ラッキー色: きょうの秘密のマフラー色を倒すと隠しボーナス。気づくと得する。
    const isLucky=!gold&&!rbw&&m.scarf===luckyColor;
    let gain=rbw?8:(gold?5:(m.type==="iron"?3:(m.big?4:1)));
    if(isLucky)gain+=1;
    if(fever>0)gain*=2;
    count+=gain;stageKill++;api.setScore(count);combo++;comboT=1;
    idleF=0;assistMR=1;firstScored=true; // 得点が来たので 無反応アシストは解除
    api.slide(300,120,0.14,0.32,"square");
    api.noise(0.14,0.2,900,"lowpass",0.8);
    api.tone(480*Math.pow(2,clamp(combo,0,10)/12),0.12,"triangle",0.12);
    api.boom(gold?0.7:0.4);api.shake(6+Math.min(combo,8));
    // hitStop: big-hit / combo milestone only, with 30f cooldown (avoid freeze)
    if(hsCool<=0&&(gold||m.type==="iron"||combo===3||combo===6||combo===10)){
      api.hitStop(gold?5:3);hsCool=30;}
    flash=Math.min(1,flash+0.4);
    if(m.type==="iron"){api.tone(1046,0.16,"triangle",0.13);api.tone(1318,0.2,"triangle",0.09);}
    if(gold){
      climax=Math.max(climax,0.85);
      [0,4,7,12].forEach((s,i)=>setTimeout(()=>api.tone(784*Math.pow(2,s/12),0.16,"triangle",0.12),i*70));
      for(let i=0;i<24;i++){const a=rnd(0,TAU),s=rnd(3,10);
        shards.push({x:m.x,y:m.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(4,9),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.02),col:pick(RAINBOW)});}
      for(let i=0;i<5;i++)glints.push({x:m.x+rnd(-R*1.2,R*1.2),y:m.y+rnd(-R*1.2,R*1.2),
        r:rnd(6,11),life:1,decay:rnd(0.02,0.04)});
      floats.push({x:m.x,y:m.y-R*1.2,txt:"＋"+gain+"！",life:1,vy:-1.1,col:"#ffd23f",size:36});
    }
    if(combo>=3){climax=Math.min(1,Math.max(climax,0.5+combo*0.06));
      api.tone(220,0.2,"sawtooth",0.07);}
    // ① にじいろ ゆきだるま 撃破: 虹の輪＋虹の破片＋祝福バナー(激レアの爽快ごほうび)
    if(rbw){
      rbMsgT=1.4;climax=Math.min(1,Math.max(climax,0.8));
      api.boom(0.7);api.shake(16);
      [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.16,"triangle",0.12),i*70));
      for(let i=0;i<3;i++)rings.push({x:m.x,y:m.y,r:R*0.4,vr:R*(0.5+i*0.18),life:1,decay:0.05,col:RAINBOW[(i*2)%RAINBOW.length]});
      for(let i=0;i<30;i++){const a=rnd(0,TAU),s=rnd(3,11);
        shards.push({x:m.x,y:m.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(4,10),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.02),col:pick(RAINBOW)});}
      for(let i=0;i<6;i++)glints.push({x:m.x+rnd(-R*1.3,R*1.3),y:m.y+rnd(-R*1.3,R*1.3),r:rnd(6,12),life:1,decay:rnd(0.02,0.04)});
      floats.push({x:m.x,y:m.y-R*1.2,txt:"にじいろ！＋"+gain,life:1,vy:-1.1,col:"#ff7bd0",size:38});
      if(hsCool<=0){api.hitStop(5);hsCool=30;}
    }
    // ② ラッキー色 命中: きらっと小さめの祝福(白飛びしないよう控えめ)
    if(isLucky){
      luckyMsgT=luckySeen?Math.max(luckyMsgT,0.7):1.6;luckySeen=true;
      api.tone(1046,0.14,"triangle",0.11);api.tone(1568,0.16,"triangle",0.08);
      for(let i=0;i<3;i++)glints.push({x:m.x+rnd(-R,R),y:m.y-R*0.5+rnd(-R*0.5,R*0.5),r:rnd(4,8),life:1,decay:rnd(0.03,0.05)});
      floats.push({x:m.x,y:m.y-R*1.1,txt:"ラッキー！",life:1,vy:-1,col:luckyColor,size:30});
    }
    burst(m.x,m.y,rbw?"#ff7bd0":(gold?"#ffd23f":(m.type==="iron"?"#ffe7a0":"#cfeeff")),gold||rbw||combo>=5);
    // fever gauge (fills only outside fever)
    if(fever<=0){feverG=Math.min(1,feverG+(rbw?0.3:(gold?0.25:(m.type==="iron"?0.18:0.1))));
      if(feverG>=1)startFever();}
    checkStage();
  }
  return{
    resize:layout,
    input(x,y,type){
      if(type!=="down"||clearT>0)return;
      for(let i=mans.length-1;i>=0;i--){const m=mans[i];
        if(m.state==="smashed")continue;
        const mr=m.mR||R;
        const ry=m.y-(1-ease(m.born))*mr*0.6;
        if(Math.hypot(x-m.x,y-ry)<mr*1.25*assistMR){ smash(m); return; }
      }
      // ④ ひみつの ゆきうさぎ: ゆきだるまに当たらなかったタップが うさぎに届いたら みっけ!(減点なし)
      if(bunny&&!bunny.caught){
        const by=bunny.base-Math.abs(Math.sin(bunny.hop))*R*0.5;
        if(Math.hypot(x-bunny.x,y-by)<R*1.1){ catchBunny(); return; }
      }
      // missed swing: gentle puff
      api.slide(260,180,0.05,0.12,"square");
      for(let i=0;i<5;i++){const a=rnd(0,TAU),s=rnd(2,5);
        sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(5,11),life:1,decay:rnd(0.06,0.1)});}
    },
    frame(dt,now){
      tGlobal+=dt;
      if(hsCool>0)hsCool-=dt;
      // fever countdown (paused during clear banner)
      if(fever>0&&clearT<=0){fever-=dt;
        if(fever<=0){fever=0;api.slide(880,330,0.35,0.15,"triangle");}}
      // ---- sky gradient (winter) ----
      // 画像背景があればそれを敷き、絵と喧嘩する平坦な手描き(空グラデ・丘)はスキップ。雪・きらめきは動くので残す
      let imgBg=false;
      if(api.drawCover("bg.jpg")){imgBg=true;
        // ステージが進むと夕方→夜へ うっすら色味を変える(1面はそのまま)。3面周期
        const ph=(stage-1)%3;
        if(ph!==0){g.save();g.globalAlpha=ph===1?0.16:0.22;const tg=g.createLinearGradient(0,0,0,api.H);
          if(ph===1){tg.addColorStop(0,"#ffb070");tg.addColorStop(1,"#ffe0b0");}
          else{tg.addColorStop(0,"#2a3f8a");tg.addColorStop(1,"#8fb0e0");}
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      }else{
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,"#7fb8e6");grd.addColorStop(0.32,"#a9d6f2");
        grd.addColorStop(0.62,"#d6eefc");grd.addColorStop(1,"#f2faff");
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // cold sun halo (upper-left, away from chrome corner via center bias) ※画像時は控えめ
      const sunx=api.W*0.5,suny=api.H*0.1;
      let sun=g.createRadialGradient(sunx,suny,0,sunx,suny,Math.max(0,api.W*0.5));
      const sa=imgBg?0.5:1;
      sun.addColorStop(0,"rgba(255,255,255,"+(0.5*sa)+")");sun.addColorStop(0.3,"rgba(220,240,255,"+(0.22*sa)+")");sun.addColorStop(1,"rgba(220,240,255,0)");
      g.fillStyle=sun;g.fillRect(0,0,api.W,api.H);
      // twinkle sparkles in sky
      g.save();g.globalCompositeOperation="lighter";g.fillStyle="#ffffff";
      for(const s of sparkles){s.ph+=s.sp*dt;const tw=Math.max(0,Math.sin(s.ph));
        g.globalAlpha=tw*0.6;g.beginPath();g.arc(s.x,s.y,s.r*(0.6+tw*0.6),0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      // snowy rolling hills (parallax) ※画像背景のときは絵の丘を活かして描かない
      if(!imgBg) for(const hl of hills){
        g.fillStyle=hl.col;g.beginPath();g.moveTo(0,api.H);
        for(let x=0;x<=api.W;x+=22){const yy=hl.y+Math.sin(x/hl.wl*TAU+hl.ph)*hl.amp;g.lineTo(x,yy);}
        g.lineTo(api.W,api.H);g.closePath();g.fill();
      }
      // drifting background snow
      g.fillStyle="#ffffff";
      for(const f of bgFlakes){
        f.y+=f.sp*dt;f.sway+=f.sv*dt;f.x+=Math.sin(f.sway)*0.4*dt;
        if(f.y>api.H+4){f.y=-4;f.x=rnd(0,api.W);}
        if(f.x<-4)f.x=api.W+4;else if(f.x>api.W+4)f.x=-4;
        g.globalAlpha=0.65;g.beginPath();g.arc(f.x,f.y,f.r,0,TAU);g.fill();
      }
      g.globalAlpha=1;
      // ---- spawn ----
      if(clearT<=0){spawnT-=dt;if(spawnT<=0){spawn();spawnT=spawnInt();
        // 最初の得点が来るまでは 最初のスポーンだけ的を2体同時に出し、外れ確率を下げて最初の成功を早める
        if(!firstScored&&!started2){spawn();started2=true;}}}
      // ---- 無反応アシスト: しばらく得点が無ければ 出現を早め、さらに続くなら 当たり判定を広げる ----
      // (ふだんの手応え・歯ごたえは変えず、理不尽に何も起きない時間だけを保険で断ち切る)
      if(clearT<=0){
        idleF+=dt;
        const forceAt=firstScored?360:90,assistAt=firstScored?600:180;
        if(idleF>forceAt&&mans.length<(fever>0?10:9)&&spawnT>12)spawnT=12;
        if(idleF>assistAt)assistMR=1.6;
      }
      // ① にじいろ 予告: 満ちたら出現(ドキドキの間)
      if(pendingRare){
        if(clearT<=0)pendingRare.t-=dt;
        if(pendingRare.t<=0){const p=pendingRare;pendingRare=null;spawnRainbowAt(p.x,p.y);}
      }
      // ④ ゆきうさぎ: ときどき そっと はねて よこぎる
      if(bunnyT>0)bunnyT-=dt;
      if(!bunny&&clearT<=0&&bunnyT<=0&&Math.random()<0.02){
        const dir=Math.random()<0.5?1:-1;
        bunny={x:dir>0?-R:api.W+R,dir,base:api.H*0.92,hop:rnd(0,TAU),caught:false};
        bunnyT=360;
      }
      if(bunny){bunny.hop+=0.12*dt;bunny.x+=bunny.dir*1.6*dt;
        if(bunny.x<-R*1.6||bunny.x>api.W+R*1.6)bunny=null;}
      // ---- update + draw snowmen ----
      for(const m of mans){
        if(m.flash>0)m.flash-=0.08*dt;
        if(m.wobble>0)m.wobble-=0.06*dt;
        if(m.state==="rise"){m.born=Math.min(1,m.born+0.08*dt);if(m.born>=1)m.state="up";}
        else if(m.state==="up"){m.life-=dt;if(m.life<=0){m.state="melt";if(clearT<=0)stageMelt++;}}
        else if(m.state==="melt"){m.born-=0.06*dt;if(m.born<=0)m._dead=true;}
        else if(m.state==="smashed"){m.squash-=0.1*dt;if(m.squash<=0)m._dead=true;}
        m.bob+=0.06*dt;
        if(m.state==="smashed"){
          if(m.type==="ball")drawBallSmash(m);
          else if(m.type==="icy")drawIcySmash(m);
          else if(m.type==="tower")drawTowerTopple(m);
          else if(m.type==="iron")drawIronSmash(m);
          else if(m.type==="gold"||m.type==="rainbow")drawGoldSmash(m);
          else drawSmash(m);
        }else{
          if(m.type==="ball")drawSnowball(m);
          else if(m.type==="icy")drawIcicle(m);
          else if(m.type==="tower")drawTower(m);
          else drawSnowman(m);
        }
      }
      mans=mans.filter(m=>!m._dead);
      // ① にじいろ 予告: あつまる にじの きらめき(もうすぐ 激レアが でるよ の合図)
      if(pendingRare){
        const p=pendingRare,prog=1-clamp(p.t/34,0,1);
        g.save();g.globalCompositeOperation="lighter";
        for(let k=0;k<7;k++){const ang=tGlobal*0.13+k*TAU/7,rr=R*(1.5-prog*1.0);
          const gx=p.x+Math.cos(ang)*rr,gy=p.y-R*0.4+Math.sin(ang)*rr*0.7;
          g.globalAlpha=(0.4+0.4*Math.sin(tGlobal*0.3+k))*(0.5+prog*0.5);
          g.fillStyle=RAINBOW[k%RAINBOW.length];
          g.beginPath();g.arc(gx,gy,2.4+prog*2.2,0,TAU);g.fill();}
        g.restore();g.globalAlpha=1;
      }
      // ④ ゆきうさぎ を えがく(ゆきだるまの手前・そっと)
      if(bunny)drawBunny(bunny);
      // ---- shockwave rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);
      // ---- spark streaks (additive) ----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#eaf6ff";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;
      sparks=sparks.filter(sp=>sp.life>0);
      // ---- ice shards ----
      for(const s of shards){s.vy+=0.32*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.rot+=s.vr*dt;s.life-=s.decay*dt;
        g.save();g.globalAlpha=Math.max(0,s.life);g.translate(s.x,s.y);g.rotate(s.rot);
        g.shadowColor="#bfeaff";g.shadowBlur=6;g.fillStyle=s.col;
        const r=s.r*(0.6+s.life*0.4);
        g.beginPath();g.moveTo(0,-r);g.lineTo(r*0.7,0);g.lineTo(0,r);g.lineTo(-r*0.7,0);g.closePath();g.fill();
        g.restore();}
      g.globalAlpha=1;g.shadowBlur=0;shards=shards.filter(s=>s.life>0);
      // ---- glints (star sparkles) ----
      g.globalCompositeOperation="lighter";g.fillStyle="#ffffff";
      for(const gl of glints){gl.life-=gl.decay*dt;
        g.save();g.globalAlpha=Math.max(0,gl.life);g.translate(gl.x,gl.y);
        drawStar(gl.r*Math.max(0,gl.life));g.restore();}
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
      glints=glints.filter(gl=>gl.life>0);
      // ---- floats (＋点 / ラッキー！ / みっけ！ の 浮き文字) ----
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.016*dt;
        g.save();g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=5;g.strokeStyle="rgba(10,40,70,.5)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.restore();}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // ---- combo timer ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      // ---- impact flash ----
      if(flash>0){flash-=0.06*dt;g.save();g.globalCompositeOperation="lighter";
        g.globalAlpha=Math.max(0,flash)*0.28;g.fillStyle="#ffffff";g.fillRect(0,0,api.W,api.H);
        g.restore();g.globalAlpha=1;}
      // ---- climax color-wash ----
      if(climax>0){const cw=g.createRadialGradient(api.W/2,api.H*0.45,0,api.W/2,api.H*0.45,api.W*0.75);
        cw.addColorStop(0,"rgba(220,245,255,"+(0.5*climax)+")");
        cw.addColorStop(0.5,"rgba(160,215,255,"+(0.26*climax)+")");
        cw.addColorStop(1,"rgba(160,215,255,0)");
        g.save();g.globalCompositeOperation="lighter";g.fillStyle=cw;g.fillRect(0,0,api.W,api.H);g.restore();
        climax-=0.06*dt;if(climax<0)climax=0;}
      // 全画面加算のあとは必ず source-over に戻す(加算が溜まって白飛びしないように)
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
      // ---- combo text (top center) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.75)*1.2;
        g.save();g.translate(api.W/2,api.H*0.18);g.scale(pop,pop);
        g.font="800 32px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(120,200,255,.9)";g.shadowBlur=14;
        g.fillStyle="#eaf6ff";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.7)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // ① にじいろ ゆきだるま！ 発見バナー(虹色に色替わり)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=RAINBOW[Math.floor(tGlobal*0.1)%RAINBOW.length];
        g.save();g.translate(api.W/2,api.H*0.24);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle="#ffffff";g.fillText("にじいろ ゆきだるま！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろ ゆきだるま！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうの ラッキー色 はっけん(初回だけ 大きく色名を教える)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.30);g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.4,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうの ラッキー色は "+(SCARFNAME[SCARF.indexOf(luckyColor)]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(10,40,70,.45)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ パーフェクト！ バナー(クリア文字の下=重ねない)
      if(perfectT>0){perfectT-=0.014*dt;
        const pop=1+Math.max(0,perfectT-1.3)*1.4;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(perfectT*1.3,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,210,63,.9)";g.shadowBlur=16;g.fillStyle="#fff0a6";
        g.fillText("パーフェクト！",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(150,110,20,.7)";g.strokeText("パーフェクト！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(perfectT<0)perfectT=0;}
      // ---- HUD (top center) ----
      drawHUD();
      // ---- stage clear banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.45;g.fillStyle="#0a2540";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(120,200,255,.9)";g.shadowBlur=20;g.fillStyle="#eaf6ff";
        g.fillText("ステージ"+clearStage+" クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア！",0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("つぎは ステージ"+(clearStage+1)+"！",0,42);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=18;}
      }
    },
    stop(){}
  };
  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.055;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#0a3a5a";g.shadowColor="rgba(255,255,255,.6)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(10,40,70,.3)";roundRect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#7be0ff");gg.addColorStop(1,"#eaf6ff");
      g.fillStyle=gg;roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=2;roundRect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }
  function drawSnowman(m){
    const rad=m.mR||R;
    const rise=ease(m.state==="rise"?m.born:(m.state==="melt"?m.born:1));
    const y=m.y-(1-rise)*rad*0.6;
    const sq=clamp(m.squash,0.4,1.2);
    const wob=Math.sin(tGlobal*0.4)*m.wobble*0.12;
    const bob=m.state==="up"?Math.sin(m.bob)*rad*0.04:0;
    const iron=m.type==="iron";
    const rbw=m.type==="rainbow";
    const gold=m.type==="gold";
    const fade=m.state==="melt"?clamp(m.born,0,1):1;
    // にじいろは 体を 虹色に ゆっくり色替わり＋やわらかいグロー
    const ci=Math.floor(tGlobal*0.06+m.bob*2);
    const rc1=RAINBOW[((ci%RAINBOW.length)+RAINBOW.length)%RAINBOW.length];
    const rc2=RAINBOW[(((ci+3)%RAINBOW.length)+RAINBOW.length)%RAINBOW.length];
    g.save();g.globalAlpha=fade;
    g.translate(m.x,y+bob);g.rotate(wob);g.scale(rise,rise*sq);
    const gp=0.5+0.5*Math.sin(tGlobal*0.3+m.bob);
    if(rbw){g.shadowColor=rc1;g.shadowBlur=16;}
    else if(gold){g.shadowColor="#ffd23f";g.shadowBlur=10+8*gp;}
    // shadow
    g.save();g.shadowBlur=0;g.fillStyle="rgba(60,110,150,.25)";g.beginPath();
    g.ellipse(0,rad*1.5,rad*0.95,rad*0.28,0,0,TAU);g.fill();g.restore();
    const lr=rad*0.85,hr=rad*0.6;
    // 画像スプライト(きんいろ/にじいろ): 当たり判定(半径R*1.25)に合わせた正方形で丸ごと描く。
    // 白い雪だるま本体は背景抜きに弱いので手描きのまま(マフラー色=ラッキー色の仕掛けも無傷)
    if(gold||rbw){
      const name=gold?"goldman.png":"rainbowman.png";
      // 一覧表で確認: 絵はほぼ正方形いっぱい(高さ 2..510)。手描きの縦幅(-1.1R〜1.45R)に合わせ 2.7R・中心 0.12R で敷く
      if(api.drawAsset(name,0,rad*0.12,rad*2.7,rad*2.7,{center:true})){
        g.shadowBlur=0;
        if(m.flash>0){g.globalAlpha=m.flash*0.6*fade;g.fillStyle="#fff";
          g.beginPath();g.arc(0,rad*0.6,lr,0,TAU);g.arc(0,-rad*0.5,hr,0,TAU);g.fill();}
        g.restore();g.globalAlpha=1;return;
      }
    }
    // body (lower)
    let bg=g.createRadialGradient(-lr*0.3,rad*0.4,lr*0.2,0,rad*0.6,lr*1.4);
    if(rbw){bg.addColorStop(0,"#ffffff");bg.addColorStop(0.55,rc1);bg.addColorStop(1,rc2);}
    else if(gold){bg.addColorStop(0,"#fff6c8");bg.addColorStop(0.55,"#ffd23f");bg.addColorStop(1,"#c98a10");}
    else{bg.addColorStop(0,"#ffffff");bg.addColorStop(0.6,"#eaf4ff");bg.addColorStop(1,"#c7ddf0");}
    g.fillStyle=bg;g.beginPath();g.arc(0,rad*0.6,lr,0,TAU);g.fill();
    // head (upper)
    let hg=g.createRadialGradient(-hr*0.3,-rad*0.7,hr*0.2,0,-rad*0.5,hr*1.4);
    if(rbw){hg.addColorStop(0,"#ffffff");hg.addColorStop(0.55,rc2);hg.addColorStop(1,rc1);}
    else if(gold){hg.addColorStop(0,"#fff6c8");hg.addColorStop(0.55,"#ffd23f");hg.addColorStop(1,"#d49a18");}
    else{hg.addColorStop(0,"#ffffff");hg.addColorStop(0.6,"#eaf4ff");hg.addColorStop(1,"#cfe2f4");}
    g.fillStyle=hg;g.beginPath();g.arc(0,-rad*0.5,hr,0,TAU);g.fill();
    if(rbw||gold)g.shadowBlur=0;
    // buttons
    g.fillStyle="#5a3a2a";
    g.beginPath();g.arc(0,rad*0.35,rad*0.07,0,TAU);g.arc(0,rad*0.7,rad*0.07,0,TAU);g.arc(0,rad*1.05,rad*0.07,0,TAU);g.fill();
    // arms (twigs)
    g.strokeStyle="#7a5230";g.lineWidth=rad*0.07;g.lineCap="round";
    g.beginPath();g.moveTo(lr*0.7,rad*0.45);g.lineTo(lr*1.5,rad*0.1);g.moveTo(lr*1.1,rad*0.3);g.lineTo(lr*1.4,rad*0.45);g.stroke();
    g.beginPath();g.moveTo(-lr*0.7,rad*0.45);g.lineTo(-lr*1.5,rad*0.1);g.moveTo(-lr*1.1,rad*0.3);g.lineTo(-lr*1.4,rad*0.45);g.stroke();
    // ② マフラー(色つき): ラッキー色を見分ける手がかり
    if(m.scarf){
      g.fillStyle=m.scarf;
      g.beginPath();g.ellipse(0,-rad*0.02,hr*1.02,rad*0.19,0,0,TAU);g.fill();
      g.fillStyle="rgba(0,0,0,.14)";g.beginPath();g.ellipse(0,rad*0.05,hr*1.0,rad*0.08,0,0,TAU);g.fill();
      g.fillStyle=m.scarf;g.beginPath();
      g.moveTo(hr*0.5,rad*0.0);g.lineTo(hr*0.86,rad*0.02);g.lineTo(hr*0.72,rad*0.6);g.lineTo(hr*0.4,rad*0.55);g.closePath();g.fill();
      g.fillStyle="rgba(255,255,255,.18)";g.fillRect(hr*0.46,rad*0.02,hr*0.1,rad*0.5);
    }
    // face: eyes (coal)
    g.fillStyle="#2b2b2b";
    g.beginPath();g.arc(-hr*0.38,-rad*0.6,hr*0.13,0,TAU);g.arc(hr*0.38,-rad*0.6,hr*0.13,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.8)";
    g.beginPath();g.arc(-hr*0.42,-rad*0.64,hr*0.04,0,TAU);g.arc(hr*0.34,-rad*0.64,hr*0.04,0,TAU);g.fill();
    // carrot nose
    g.fillStyle="#ff8a3a";g.beginPath();
    g.moveTo(0,-rad*0.5);g.lineTo(hr*0.7,-rad*0.42);g.lineTo(0,-rad*0.36);g.closePath();g.fill();
    // smile (coal dots)
    g.fillStyle="#2b2b2b";
    for(let i=-1;i<=1;i++){g.beginPath();g.arc(i*hr*0.3,-rad*0.28,hr*0.06,0,TAU);g.fill();}
    // cheeks
    g.fillStyle="rgba(255,150,150,.4)";
    g.beginPath();g.arc(-hr*0.55,-rad*0.42,hr*0.16,0,TAU);g.arc(hr*0.55,-rad*0.42,hr*0.16,0,TAU);g.fill();
    if(iron){
      // iron helmet on head: 画像かぶと(生成物は顔まで覆う全頭かぶとなので、頭(直径1.2R)を丸ごと覆う大きさで被せる)。無ければ手描き
      if(!api.drawAsset("helmet.png",0,-rad*0.55,rad*1.5,rad*1.5,{center:true})){
      g.fillStyle="#9aa6b4";
      g.beginPath();g.arc(0,-rad*0.72,hr*1.05,Math.PI,TAU);g.closePath();g.fill();
      let mg=g.createLinearGradient(0,-rad*1.3,0,-rad*0.7);
      mg.addColorStop(0,"#cfd8e2");mg.addColorStop(1,"#6f7b89");
      g.fillStyle=mg;g.beginPath();g.arc(0,-rad*0.72,hr*0.98,Math.PI,TAU);g.closePath();g.fill();
      g.fillStyle="#7a8794";g.fillRect(-hr*1.1,-rad*0.78,hr*2.2,rad*0.12);
      // rivets
      g.fillStyle="#d6dee8";
      g.beginPath();g.arc(-hr*0.7,-rad*0.78,hr*0.08,0,TAU);g.arc(hr*0.7,-rad*0.78,hr*0.08,0,TAU);
      g.arc(0,-rad*1.15,hr*0.09,0,TAU);g.fill();
      // shine
      g.fillStyle="rgba(255,255,255,.5)";
      g.beginPath();g.ellipse(-hr*0.3,-rad*0.95,hr*0.25,hr*0.12,-0.4,0,TAU);g.fill();
      }
      // crack after first hit
      if(m.hp<=1){g.strokeStyle="rgba(40,50,60,.7)";g.lineWidth=rad*0.05;g.lineCap="round";
        g.beginPath();g.moveTo(-hr*0.2,-rad*1.1);g.lineTo(hr*0.05,-rad*0.85);g.lineTo(-hr*0.1,-rad*0.7);g.stroke();}
    }
    // ⑦ とびきり大きな雪だるま: 1回目のヒットでヒビが入り「もう1回！」が分かる(鉄かぶとのクラックと同じ思想)
    if(m.big&&m.hp<=1){
      g.strokeStyle="rgba(120,160,190,.65)";g.lineWidth=Math.max(0,rad*0.045);g.lineCap="round";
      g.beginPath();g.moveTo(-lr*0.35,rad*0.25);g.lineTo(lr*0.05,rad*0.55);g.lineTo(-lr*0.2,rad*0.95);g.stroke();
      g.beginPath();g.moveTo(hr*0.1,-rad*0.15);g.lineTo(-hr*0.15,rad*0.05);g.stroke();
    }
    // hit-flash overlay
    if(m.flash>0){g.globalAlpha=m.flash*0.6;g.fillStyle="#fff";
      g.beginPath();g.arc(0,rad*0.6,lr,0,TAU);g.arc(0,-rad*0.5,hr,0,TAU);g.fill();}
    // ② ラッキー色ヒント: きょうの色のマフラーには 頭上に 小さな星が きらッ(気づける)
    if(m.scarf===luckyColor&&(m.state==="up"||m.state==="rise")){
      const tw=0.5+0.5*Math.sin(tGlobal*0.2+m.bob*3);
      g.save();g.globalAlpha=(0.45+0.45*tw)*fade;g.translate(hr*0.7,-rad*1.25);
      g.fillStyle="#fff0a6";g.shadowColor="#ffd23f";g.shadowBlur=7;
      const sr=rad*0.2*(0.8+tw*0.3);
      g.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?sr*0.4:sr;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}g.closePath();g.fill();
      g.restore();
    }
    g.restore();g.globalAlpha=1;
  }
  function drawSmash(m){
    // collapsing snow pile as it shatters
    const rad=m.mR||R;
    const sq=clamp(m.squash,0,1);
    g.save();g.globalAlpha=sq;
    g.translate(m.x,m.y);
    g.fillStyle="rgba(60,110,150,.2)";g.beginPath();
    g.ellipse(0,rad*1.5,Math.max(0,rad*1.1*(1.4-sq*0.4)),Math.max(0,rad*0.3),0,0,TAU);g.fill();
    g.fillStyle="#eaf4ff";
    g.beginPath();g.ellipse(0,rad*1.2,Math.max(0,rad*(1.2-sq*0.4)),Math.max(0,rad*0.5*sq),0,0,TAU);g.fill();
    g.restore();g.globalAlpha=1;
  }
  // 共通パーツ: 白い雪玉(積みだるまで使い回す)
  function drawWhiteBall(cx,cy,r){
    let bg=g.createRadialGradient(cx-r*0.3,cy-r*0.3,Math.max(0,r*0.15),cx,cy,Math.max(0,r*1.3));
    bg.addColorStop(0,"#ffffff");bg.addColorStop(0.6,"#eaf4ff");bg.addColorStop(1,"#c7ddf0");
    g.fillStyle=bg;g.beginPath();g.arc(cx,cy,Math.max(0,r),0,TAU);g.fill();
  }
  // ⑦ 積みだるま(丸3段重ね): 雪だるま/雪玉/つららとはっきり違う「積み重なった物」のシルエット
  function drawTower(m){
    const rad=m.mR||R;
    const rise=ease(m.state==="rise"?m.born:(m.state==="melt"?m.born:1));
    const y=m.y-(1-rise)*rad*0.6;
    const sq=clamp(m.squash,0.4,1.2);
    const wob=Math.sin(tGlobal*0.4)*m.wobble*0.12;
    const bob=m.state==="up"?Math.sin(m.bob)*rad*0.04:0;
    const fade=m.state==="melt"?clamp(m.born,0,1):1;
    const r1=rad*0.95,r2=rad*0.68,r3=rad*0.46;
    const y1=rad*0.6,y2=y1-(r1+r2)*0.62,y3=y2-(r2+r3)*0.62;
    g.save();g.globalAlpha=fade;
    g.translate(m.x,y+bob);g.rotate(wob);g.scale(rise,rise*sq);
    g.save();g.shadowBlur=0;g.fillStyle="rgba(60,110,150,.25)";g.beginPath();
    g.ellipse(0,r1*1.35,Math.max(0,r1*0.95),Math.max(0,r1*0.26),0,0,TAU);g.fill();g.restore();
    drawWhiteBall(0,y1,r1);drawWhiteBall(0,y2,r2);drawWhiteBall(0,y3,r3);
    // 段差の縁(積み木らしさ)
    g.strokeStyle="rgba(140,190,220,.4)";g.lineWidth=Math.max(1,rad*0.03);
    g.beginPath();g.arc(0,y1,Math.max(0,r1*0.98),Math.PI*0.15,Math.PI*0.85);g.stroke();
    g.beginPath();g.arc(0,y2,Math.max(0,r2*0.98),Math.PI*0.15,Math.PI*0.85);g.stroke();
    // 顔(いちばん上の玉)
    g.fillStyle="#2b2b2b";
    g.beginPath();g.arc(-r3*0.32,y3-r3*0.1,Math.max(0,r3*0.12),0,TAU);g.arc(r3*0.32,y3-r3*0.1,Math.max(0,r3*0.12),0,TAU);g.fill();
    g.beginPath();g.arc(0,y3+r3*0.22,Math.max(0,r3*0.06),0,TAU);g.fill();
    // マフラー(段の境目・ラッキー色の手がかり)
    if(m.scarf){g.fillStyle=m.scarf;g.beginPath();g.ellipse(0,y2-r2*0.55,Math.max(0,r2*0.9),Math.max(0,r2*0.18),0,0,TAU);g.fill();}
    if(m.flash>0){g.globalAlpha=m.flash*0.6*fade;g.fillStyle="#fff";
      g.beginPath();g.arc(0,y1,Math.max(0,r1),0,TAU);g.arc(0,y2,Math.max(0,r2),0,TAU);g.arc(0,y3,Math.max(0,r3),0,TAU);g.fill();}
    if(m.scarf===luckyColor&&(m.state==="up"||m.state==="rise")){
      luckyHintStar(r3*0.9,y3-r3*1.3,fade,rad);
    }
    g.restore();g.globalAlpha=1;
  }
  // ⑦ 積みだるま 崩壊: 積み木のように回転しながら横に倒れて崩れる(白い雪山崩れとは別の壊れ方)
  function drawTowerTopple(m){
    const rad=m.mR||R;
    const sq=clamp(m.squash,0,1);
    const fall=1-sq;
    const ang=fall*(Math.PI*0.5)*(m.fallDir||1);
    const r1=rad*0.95,r2=rad*0.68,r3=rad*0.46;
    const y1=rad*0.6;
    g.save();g.globalAlpha=sq;
    g.fillStyle="rgba(60,110,150,.2)";g.beginPath();
    g.ellipse(m.x,m.y+r1*1.35,Math.max(0,r1*(1.1+fall*0.4)),Math.max(0,r1*0.26),0,0,TAU);g.fill();
    g.translate(m.x,m.y+y1);g.rotate(ang);
    drawWhiteBall(0,0,r1);
    drawWhiteBall(0,-(r1+r2)*0.62,r2);
    drawWhiteBall(0,-(r1+r2)*0.62-(r2+r3)*0.62,r3);
    g.restore();g.globalAlpha=1;
  }
  // てつかぶと 崩壊: 白い雪山とは違う「クラン！」と金属片が飛び散る壊れ方
  function drawIronSmash(m){
    const rad=m.mR||R;
    const sq=clamp(m.squash,0,1);
    const jag=1-sq;
    g.save();g.globalAlpha=sq;g.translate(m.x,m.y);
    g.fillStyle="rgba(60,70,80,.22)";g.beginPath();
    g.ellipse(0,rad*1.5,Math.max(0,rad*1.1*(1.4-sq*0.4)),Math.max(0,rad*0.3),0,0,TAU);g.fill();
    g.fillStyle="#6f7b89";g.beginPath();
    g.ellipse(0,rad*1.2,Math.max(0,rad*(1.0-sq*0.3)),Math.max(0,rad*0.4*sq),0,0,TAU);g.fill();
    g.fillStyle="#9aa6b4";
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2+jag*2.4,dx=Math.cos(a)*rad*0.7*jag,dy=Math.sin(a)*rad*0.5*jag-jag*rad*0.6;
      const s=Math.max(0,rad*0.32*sq);
      g.save();g.translate(dx,rad*0.9+dy);g.rotate(a+jag*3);
      g.beginPath();g.moveTo(-s,-s*0.5);g.lineTo(s,-s*0.3);g.lineTo(s*0.6,s*0.6);g.lineTo(-s*0.7,s*0.5);g.closePath();g.fill();
      g.restore();
    }
    g.restore();g.globalAlpha=1;
  }
  // きんいろ/にじいろ 崩壊: 白い雪山ではなく きらめきが弾けて消える壊れ方
  function drawGoldSmash(m){
    const rad=m.mR||R;
    const sq=clamp(m.squash,0,1);
    const rbw=m.type==="rainbow";
    const baseCol=rbw?"#ff7bd0":"#ffd23f";
    g.save();g.globalAlpha=sq;g.translate(m.x,m.y);
    g.globalCompositeOperation="lighter";
    let gg=g.createRadialGradient(0,rad*0.6,0,0,rad*0.6,Math.max(0,rad*1.3));
    gg.addColorStop(0,"#ffffff");gg.addColorStop(0.5,baseCol);gg.addColorStop(1,"rgba(255,255,255,0)");
    g.fillStyle=gg;g.beginPath();g.arc(0,rad*0.6,Math.max(0,rad*(1.1-sq*0.3)),0,TAU);g.fill();
    const cols=rbw?RAINBOW:["#ffd23f","#fff6c8","#ffe7a0"];
    for(let i=0;i<6;i++){
      const a=i*TAU/6+(1-sq)*1.5,rr=rad*(0.4+(1-sq)*1.1);
      g.fillStyle=cols[i%cols.length];
      g.beginPath();g.arc(Math.cos(a)*rr,rad*0.6+Math.sin(a)*rr*0.6,Math.max(0,rad*0.14*sq),0,TAU);g.fill();
    }
    g.globalCompositeOperation="source-over";
    g.restore();g.globalAlpha=1;
  }
  // ⑥ 雪玉(丸1個): ころころ揺れて 転がって砕ける
  function drawSnowball(m){
    const rad=m.mR||R;
    const rise=ease(m.state==="rise"?m.born:(m.state==="melt"?m.born:1));
    const y=m.y-(1-rise)*rad*0.6;
    const sq=clamp(m.squash,0.4,1.2);
    const roll=m.state==="up"?Math.sin(m.bob*1.4)*0.22:0; // ころころ回転しているような揺れ
    const bob=m.state==="up"?Math.sin(m.bob)*rad*0.03:0;
    const fade=m.state==="melt"?clamp(m.born,0,1):1;
    const br=rad*0.78;
    g.save();g.globalAlpha=fade;
    g.translate(m.x,y+bob);g.rotate(roll*0.3);g.scale(rise,rise*sq);
    g.save();g.shadowBlur=0;g.fillStyle="rgba(60,110,150,.25)";g.beginPath();
    g.ellipse(0,br*1.15,br*0.95,br*0.26,0,0,TAU);g.fill();g.restore();
    let bg=g.createRadialGradient(-br*0.3,-br*0.3,br*0.15,0,0,br*1.3);
    bg.addColorStop(0,"#ffffff");bg.addColorStop(0.6,"#eaf4ff");bg.addColorStop(1,"#bcd8ee");
    g.fillStyle=bg;g.beginPath();g.arc(0,0,br,0,TAU);g.fill();
    // ころころ感: 転がる方向にうっすら縞
    g.strokeStyle="rgba(140,190,220,.35)";g.lineWidth=Math.max(1,br*0.06);
    for(const off of [-0.4,0,0.4]){g.beginPath();g.ellipse(0,0,br*0.9,br*0.9,0,off-0.5,off+0.5);g.stroke();}
    // マフラーの結び目(小さめのリボン): ラッキー色の当たり
    if(m.scarf){
      g.fillStyle=m.scarf;g.beginPath();g.ellipse(0,br*0.15,br*0.32,br*0.16,0.15,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.2)";g.beginPath();g.ellipse(-br*0.08,br*0.08,br*0.1,br*0.05,0.15,0,TAU);g.fill();
    }
    // 顔(かわいさ維持)
    g.fillStyle="#2b2b2b";
    g.beginPath();g.arc(-br*0.3,-br*0.15,br*0.1,0,TAU);g.arc(br*0.3,-br*0.15,br*0.1,0,TAU);g.fill();
    g.beginPath();g.arc(0,br*0.15,br*0.05,0,TAU);g.fill();
    if(m.flash>0){g.globalAlpha=m.flash*0.6*fade;g.fillStyle="#fff";g.beginPath();g.arc(0,0,br,0,TAU);g.fill();}
    if(m.scarf===luckyColor&&(m.state==="up"||m.state==="rise")){
      luckyHintStar(br*0.6,-br*1.05,fade,rad);
    }
    g.restore();g.globalAlpha=1;
  }
  function drawBallSmash(m){
    // 転がって真っ二つに割れる
    const rad=m.mR||R,br=rad*0.78;
    const sq=clamp(m.squash,0,1);
    const gap=(1-sq)*br*0.9;
    g.save();g.globalAlpha=sq;g.translate(m.x,m.y);
    g.fillStyle="rgba(60,110,150,.18)";g.beginPath();
    g.ellipse(0,br*1.1,Math.max(0,br*1.05),Math.max(0,br*0.24),0,0,TAU);g.fill();
    g.fillStyle="#eaf4ff";
    g.save();g.translate(-gap,0);g.rotate(-0.3*(1-sq));
    g.beginPath();g.arc(0,0,Math.max(0,br*sq),Math.PI*0.5,Math.PI*1.5);g.closePath();g.fill();g.restore();
    g.save();g.translate(gap,0);g.rotate(0.3*(1-sq));
    g.beginPath();g.arc(0,0,Math.max(0,br*sq),-Math.PI*0.5,Math.PI*0.5);g.closePath();g.fill();g.restore();
    g.restore();g.globalAlpha=1;
  }
  // ⑥ つらら(縦長三角): ぶらさがっていて 落下して割れる
  function drawIcicle(m){
    const rad=m.mR||R;
    const rise=ease(m.state==="rise"?m.born:(m.state==="melt"?m.born:1));
    const y=m.y-(1-rise)*rad*0.6;
    const sq=clamp(m.squash,0.4,1.2);
    const wob=Math.sin(tGlobal*0.5+m.bob)*m.wobble*0.15+Math.sin(m.bob*0.7)*0.05;
    const bob=m.state==="up"?Math.sin(m.bob)*rad*0.03:0;
    const fade=m.state==="melt"?clamp(m.born,0,1):1;
    const w=rad*0.62,h=rad*1.9;
    g.save();g.globalAlpha=fade;
    g.translate(m.x,y+bob);g.rotate(wob);g.scale(rise,rise*sq);
    g.save();g.shadowBlur=0;g.fillStyle="rgba(60,110,150,.22)";g.beginPath();
    g.ellipse(0,h*0.55,Math.max(0,w*0.9),Math.max(0,w*0.3),0,0,TAU);g.fill();g.restore();
    let ig=g.createLinearGradient(-w,0,w,0);
    ig.addColorStop(0,"#eaf6ff");ig.addColorStop(0.5,"#ffffff");ig.addColorStop(1,"#bfe0f2");
    g.fillStyle=ig;g.beginPath();
    g.moveTo(-w,-h*0.4);g.lineTo(w,-h*0.4);g.lineTo(w*0.28,h*0.55);g.lineTo(0,h*0.62);g.lineTo(-w*0.28,h*0.55);
    g.closePath();g.fill();
    // つやハイライト
    g.fillStyle="rgba(255,255,255,.7)";
    g.beginPath();g.moveTo(-w*0.5,-h*0.35);g.lineTo(-w*0.2,-h*0.35);g.lineTo(-w*0.32,h*0.2);g.lineTo(-w*0.55,h*0.15);g.closePath();g.fill();
    // 上部の リボン(マフラー色): ラッキー色ヒント
    if(m.scarf){
      g.fillStyle=m.scarf;g.beginPath();g.ellipse(0,-h*0.42,w*1.05,w*0.24,0,0,TAU);g.fill();
    }
    // 目鼻(かわいさ維持)
    g.fillStyle="#2b2b2b";
    g.beginPath();g.arc(-w*0.3,-h*0.15,w*0.14,0,TAU);g.arc(w*0.3,-h*0.15,w*0.14,0,TAU);g.fill();
    if(m.flash>0){g.globalAlpha=m.flash*0.6*fade;g.fillStyle="#fff";
      g.beginPath();g.moveTo(-w,-h*0.4);g.lineTo(w,-h*0.4);g.lineTo(0,h*0.6);g.closePath();g.fill();}
    if(m.scarf===luckyColor&&(m.state==="up"||m.state==="rise")){
      luckyHintStar(w*0.9,-h*0.55,fade,rad);
    }
    g.restore();g.globalAlpha=1;
  }
  function drawIcySmash(m){
    // 落下して 真ん中から 割れる
    const rad=m.mR||R;
    const sq=clamp(m.squash,0,1);
    const w=rad*0.62,h=rad*1.9,drop=(1-sq)*rad*0.7,split=(1-sq)*rad*0.5;
    g.save();g.globalAlpha=sq;g.translate(m.x,m.y);
    g.fillStyle="rgba(60,110,150,.18)";g.beginPath();
    g.ellipse(0,h*0.55+drop,Math.max(0,w*0.9),Math.max(0,w*0.26),0,0,TAU);g.fill();
    g.fillStyle="#eaf6ff";
    g.beginPath();g.moveTo(-w,-h*0.4-split);g.lineTo(w,-h*0.4-split);g.lineTo(w*0.5,-h*0.05-split);g.lineTo(-w*0.5,-h*0.05-split);
    g.closePath();g.fill();
    g.beginPath();g.moveTo(-w*0.4,h*0.0+drop);g.lineTo(w*0.4,h*0.0+drop);g.lineTo(0,h*0.6+drop);g.closePath();g.fill();
    g.restore();g.globalAlpha=1;
  }
  function luckyHintStar(hx,hy,fade,rad){
    const tw=0.5+0.5*Math.sin(tGlobal*0.2);
    g.save();g.globalAlpha=(0.45+0.45*tw)*fade;g.translate(hx,hy);
    g.fillStyle="#fff0a6";g.shadowColor="#ffd23f";g.shadowBlur=7;
    const sr=Math.max(0,(rad*0.2)*(0.8+tw*0.3));
    g.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?sr*0.4:sr;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}g.closePath();g.fill();
    g.restore();
  }
  // ④ ひみつの ゆきうさぎ: 雪原を はねて よこぎる。タップで みっけ(減点なしのごほうび)
  function drawBunny(b){
    const hop=Math.abs(Math.sin(b.hop))*R*0.5,bx=b.x,by=b.base-hop,s=R*0.5;
    g.save();g.translate(bx,by);
    g.fillStyle="rgba(60,110,150,.18)";g.beginPath();g.ellipse(0,s*0.9+hop*0.5,s*0.7,s*0.16,0,0,TAU);g.fill();
    // ears (white with pink inner)
    for(const ex of [-s*0.26,s*0.26]){const tl=ex<0?-0.18:0.18;
      g.fillStyle="#ffffff";g.beginPath();g.ellipse(ex,-s*0.72,s*0.14,s*0.42,tl,0,TAU);g.fill();
      g.fillStyle="#ffd2e0";g.beginPath();g.ellipse(ex,-s*0.7,s*0.06,s*0.26,tl,0,TAU);g.fill();}
    // body
    g.fillStyle="#ffffff";g.beginPath();g.arc(0,0,s*0.6,0,TAU);g.fill();
    // eye + nose
    g.fillStyle="#3a3a3a";g.beginPath();g.arc(-s*0.18,-s*0.05,s*0.08,0,TAU);g.arc(s*0.18,-s*0.05,s*0.08,0,TAU);g.fill();
    g.fillStyle="#ff9ab0";g.beginPath();g.arc(0,s*0.12,s*0.07,0,TAU);g.fill();
    // fluffy tail
    g.fillStyle="#eef6ff";g.beginPath();g.arc(-s*0.55*b.dir,s*0.2,s*0.16,0,TAU);g.fill();
    g.restore();
  }
  function catchBunny(){
    if(!bunny)return;
    const bx=bunny.x,by=bunny.base-Math.abs(Math.sin(bunny.hop))*R*0.5;
    api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.08);api.tone(2093,0.12,"triangle",0.06);
    for(let i=0;i<10;i++){const a=rnd(-TAU*0.5,0),s=rnd(3,7);
      shards.push({x:bx,y:by,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,6),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:i%2?"#ffd23f":"#fff0a6"});}
    for(let i=0;i<4;i++)glints.push({x:bx+rnd(-R*0.6,R*0.6),y:by+rnd(-R*0.6,R*0.6),r:rnd(4,8),life:1,decay:0.03});
    floats.push({x:bx,y:by-R*0.8,txt:"みっけ！",life:1,vy:-1,col:"#ffd23f",size:28});
    bunny=null;
  }
  function drawStar(r){g.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*0.45:r;
    g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}g.closePath();g.fill();}
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
}
Engine.register("snowman", build_snowman);
