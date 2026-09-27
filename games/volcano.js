function buildVolcano(api){
  const g=api.g;
  // 画像アセット(無ければ従来の手描きにフォールバック)。
  // ufo.png / bossblimp.png は生成が2回とも不良(床影・灰色の円が残る)だったので使わず、雑魚/ボスは従来の手描きのまま。
  api.preload(["bg.jpg","volcano.png"]);
  let imgBg=false;   // このフレームで背景画像が出ているか(平坦な手描き背景要素をスキップする判定)
  let flyers=[],bombs=[],smoke=[],shards=[],dust=[],floats=[],sparks=[],stars=[],embers=[],fountain=[],rings=[],motes=[],clouds=[];
  let groundY,craterX,craterY,coneW,charging,magma,grav,count,combo,comboT,flash,spawnT,glow,tick,column,wash;
  let downX; // ③ 直前に「おした」画面X座標(噴火の狙い方向に使う)
  // wave/stage progression state
  let stage,wave,need,killWave,banner,bannerT,bonus,bonusFlashT,cleared,confetti,boss,bossT;
  let meteorT; // ⑦ 隕石(重量物カテゴリ)の出現タイマー
  let eruptKills=0,eruptWin=0; // 大噴火ボーナス window after a full-charge eruption
  let lastStop=-999; // last tick api.hitStop was fired (throttle: only rare big hits freeze)
  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマー/トラックと同じ思想) ----
  let luckyColor,luckySeen,luckyMsgT,rbMsgT; // ②ラッキー色 / ①にじいろ祝福バナー
  let waveEscaped,noMissT;                    // ③ノーミス ウェーブ判定
  let shoot,shootT,rareOmen;                  // ④ながれ星 / ①にじいろ の予告→出現
  const FLY=["cloud","blimp","balloon","ufo"];
  const BCOL=["#4aa0ff","#ff6b8a","#74e89a","#ffd64a","#c79bff"];
  // ② きょうのラッキー色: てきの色名(初回だけ中央上に教える)
  const COLNAME={"#4aa0ff":"あお","#ff6b8a":"ピンク","#74e89a":"みどり","#ffd64a":"きいろ","#c79bff":"むらさき"};
  const RB=["#ff5b6e","#ffae2e","#ffd23f","#74e89a","#5bd6ff","#c79bff"]; // にじいろ順
  const MAXSTAGE=5;
  // per-stage accent tint for the sky horizon (variety as you progress)
  const STAGEHUE=["255,140,60","255,90,120","150,120,255","90,220,160","255,200,60"];
  function layout(){
    groundY=api.H*0.94;craterX=api.W/2;craterY=api.H*0.5;coneW=clamp(api.W*0.5,260,560);
    grav=clamp(api.H*0.0005,0.28,0.44);
    stars=[];for(let i=0;i<46;i++)stars.push({x:rnd(0,api.W),y:rnd(0,api.H*0.55),r:rnd(0.6,1.8),tw:rnd(0,TAU),sp:rnd(0.02,0.06)});
    // drifting magical light motes (always-on ambient)
    motes=[];for(let i=0;i<26;i++)motes.push({x:rnd(0,api.W),y:rnd(api.H*0.1,groundY),r:rnd(1.2,3.2),sp:rnd(0.1,0.4),sw:rnd(0.3,1.0),tw:rnd(0,TAU),hue:Math.random()<0.5?"255,220,150":"255,170,120"});
    // slow parallax background clouds (soft, far away)
    clouds=[];for(let i=0;i<4;i++)clouds.push({x:rnd(0,api.W),y:rnd(api.H*0.16,api.H*0.4),r:rnd(api.W*0.12,api.W*0.22),sp:rnd(0.04,0.12)});
  }
  function reset(){flyers=[];bombs=[];smoke=[];shards=[];dust=[];floats=[];sparks=[];embers=[];fountain=[];rings=[];motes=[];clouds=[];confetti=[];charging=false;magma=0;count=0;combo=0;comboT=0;flash=0;spawnT=0;glow=0;tick=0;column=0;wash=0;
    stage=1;wave=1;killWave=0;bonus=0;bonusFlashT=0;banner=null;bannerT=0;cleared=false;boss=null;bossT=0;downX=api.W/2;meteorT=rint(420,680);
    luckyColor=pick(BCOL);luckySeen=false;luckyMsgT=0;rbMsgT=0;waveEscaped=0;noMissT=0;shoot=null;shootT=rint(240,520);rareOmen=null;
    // 軸3(歯ごたえ): 開始直後3体は火口に近い高さへ寄せ、噴火の弾が届くまでの時間を縮めてfirstScoreSecの外れ値を減らす
    need=waveNeed();layout();for(let i=0;i<5;i++)spawnFlyer(rnd(0,api.W),false,i<3);
    // 軸3(歯ごたえ): さらに火口の真上近くに低速の的を1体だけ必ず置く。
    // downXの初期値はcraterXでbias≈0なので、最初の1発が自然に当たりやすくなりfirstScoreSecの外れ値を縮める。
    spawnFlyer(craterX+rnd(-50,50),false,true);}
  // how many kills to clear the current wave (grows gently with stage)
  // ※最初のウェーブだけ少し短く＝最初の「やった！」が早く来る
  function waveNeed(){return (stage===1&&wave===1)?6:7+stage*2;}   // 7〜8歳向けに 2割ほど増量
  // current target speed multiplier (escalates each stage)
  function speedMul(){return 1+(stage-1)*0.28;}
  function showBanner(txt,sub,t,col){banner={txt,sub,col:col||"#ffd23f",t0:t};bannerT=t;}
  function burstConfetti(n,big){for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(big?5:3,big?13:8);
    confetti.push({x:rnd(api.W*0.2,api.W*0.8),y:rnd(api.H*0.2,api.H*0.5),vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,
      s:rnd(5,11),color:pick(["#ff5b6e","#ffd23f","#5bd6ff","#74e89a","#c79bff","#ffffff"]),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.006,0.012)});}}
  function nextWave(){
    // ③ ノーミス ウェーブ: このウェーブで にげられた てきが 0 なら かくれボーナス(+3 と みどりの祝福)
    if(waveEscaped===0){bonus+=1;bonusFlashT=1.6;count+=3;api.setScore(count);noMissT=1.6;
      api.tone(1318,0.14,"triangle",0.1);api.tone(1976,0.16,"triangle",0.08);burstConfetti(14,false);}
    waveEscaped=0;
    killWave=0;
    if(wave>=3){ // stage complete -> clear演出 + escalate
      if(stage>=MAXSTAGE){
        cleared=true;showBanner("火山 せいふく！","ぜんステージ クリア！",260,"#fff");
        wash=Math.max(wash,1.0);api.boom(0.7);api.shake(22);api.hitStop(6);
        burstConfetti(90,true);api.slide(440,880,0.5,0.4,"square");
        stage=1;wave=1; // loop on but flag stays for the big screen
      }else{
        stage++;wave=1;
        showBanner("ステージ "+stage,"だい"+stage+"ステージ かいし！",170,"#ffd23f");
        wash=Math.max(wash,0.8);api.boom(0.55);api.shake(16);burstConfetti(46,false);
        api.slide(330,660,0.4,0.35,"square");
      }
    }else{
      wave++;showBanner("ウェーブ "+wave,"つぎの てき！",110,"#7fe0ff");
      api.tone(660,0.12,"square",0.18);api.tone(990,0.12,"square",0.16);
      // 毎回のウェーブクリアにも小さなご褒美（紙ふぶき＋軽い揺れ）＝一番ひんぱんな達成を地味にしない
      burstConfetti(20,false);api.shake(7);
    }
    need=waveNeed();
    // sprinkle in fresh flyers for the new wave
    for(let i=0;i<3;i++)spawnFlyer();
    bossT++; // every 2 waves, queue a boss
    if(bossT>=2){bossT=0;spawnBoss();}
  }
  function spawnBoss(){
    if(boss)return;
    const big=stage%2===0; // alternate giant blimp / giant ufo
    const fromL=Math.random()<0.5;
    const r=clamp(api.W*0.13,80,150);
    boss={x:fromL?-r:api.W+r,y:rnd(api.H*0.16,api.H*0.32),vx:(fromL?1:-1)*0.5*speedMul(),
      t:big?"blimp":"ufo",r,color:big?"#ff6b8a":"#9be0ff",hp:7+stage,maxhp:7+stage,bob:rnd(0,TAU),hitT:0,boss:true,zig:rnd(0,TAU)};
    showBanner("ボスとうじょう！","なんども ふんかで たおせ！",120,"#ff6b6b");
    api.slide(200,90,0.5,0.4,"sawtooth");api.boom(0.5);api.shake(12);
  }
  function spawnFlyer(x0,rare,nearCrater){
    // ① にじいろ の激レアは バルーン/UFO/ブリンプ(雲以外)で 見つけやすく
    let t=rare?pick(["balloon","ufo","blimp"]):pick(FLY);
    // ⑦ 大きさに差をつける: 小さめ/ふつう/大きめ が混ざって出るように重み付き抽選(激レアはサイズ固定で見つけやすさ優先)
    const sizeMul=rare?1:pick([0.65,0.65,1,1,1,1.5]);
    const big=sizeMul>=1.5;
    const r=clamp(api.W*0.05,26,52)*(t==="cloud"?1.4:1)*sizeMul;
    const fromL=Math.random()<0.5;
    const sm=speedMul();
    // 軸3(歯ごたえ): 開始直後の数体だけ火口に近い高さへ寄せ、噴火の弾が届くまでの時間そのものを縮める
    // (firstScoreSecの外れ値=噴火が届く前に的が流れ去ってしまう試行を減らす)
    const y=nearCrater?rnd(Math.max(api.H*0.1,craterY-r*3),craterY-r*1.5):rnd(api.H*0.12,craterY-r*1.5);
    flyers.push({x:x0!=null?x0:(fromL?-r:api.W+r),y,
      vx:(fromL?1:-1)*rnd(0.5,1.4)*(t==="ufo"?1.5:1)*sm*(big?0.72:1),t,r,color:pick(BCOL),bob:rnd(0,TAU),
      hp:(rare?1:(t==="blimp"?2:1))+(big?1:0),hitT:0,zig:rnd(0,TAU),rare:!!rare,offset:rnd(0,10),big});
  }
  // ⑦ 新カテゴリ「隕石」: 空を横切る乗り物/生き物 とは別の"重量物"。ゆっくり落下・多段ヒット・地面で土煙
  function spawnMeteor(){
    const r=clamp(api.W*0.075,40,74);
    flyers.push({x:rnd(api.W*0.18,api.W*0.82),y:-r,t:"meteor",r,
      vx:rnd(-0.15,0.15),vy:rnd(0.5,0.8)*speedMul(),color:"#8a7358",bob:0,
      hp:3,hitT:0,zig:0,rare:false,offset:rnd(0,10),big:true});
  }
  function erupt(power){
    if(cleared){cleared=false;banner=null;bannerT=0;} // tap after全クリ restarts the run cleanly
    // 軸3(歯ごたえ): ノーチャージ(power≈0)の一瞬タップは1発だけにして、狙わない連打では伸びにくくする
    // 軸3(歯ごたえ): フルチャージでも同時弾数を絞り、狙わない連打では複数の的に当たりにくくする(19→12)
    const n=Math.min(Math.floor(1+power*12),Math.max(0,50-bombs.length));
    // full-charge eruption: arm the 大噴火ボーナス window (kills in the next moments multiply)
    if(power>0.6){eruptKills=0;eruptWin=70;}
    flash=Math.max(flash,0.25+power*0.5);
    api.slide(150,40,0.6+power*0.3,0.7,"sine");api.noise(0.5+power*0.3,0.5,700,"lowpass");api.boom(0.45+power*0.45);
    api.shake(10+power*26);
    // hitStop only on rare full-charge blasts (spam-tap eruptions must not chain-freeze the game)
    if(power>0.55&&tick-lastStop>45){api.hitStop(2+Math.round(power*3));lastStop=tick;}
    combo=0;comboT=1.2;
    // big lava-fountain column that rises then arches outward (climax)
    column=Math.max(column,0.8+power*1.1);
    // climax: a big bright golden screen wash on strong eruptions
    if(power>0.6)wash=Math.max(wash,0.55+(power-0.6)*1.1);
    // ③ 歯ごたえ: 「おした」画面X位置から狙い方向をつける(どこを押しても真上ではなく、押した側に飛ぶ)
    const bias=clamp((downX-craterX)/(api.W*0.5),-0.7,0.7);
    const cw=coneW*0.13;
    const nf=Math.min(Math.floor(14+power*60),Math.max(0,220-fountain.length));
    for(let i=0;i<nf;i++){
      const a=-Math.PI/2+bias+rnd(-0.5,0.5)*(0.4+power*0.6);
      const sp=rnd(7,13)*(0.8+power*0.9);
      fountain.push({x:craterX+rnd(-cw*0.5,cw*0.5),y:craterY-8,vx:Math.cos(a)*sp*0.55,vy:Math.sin(a)*sp,
        life:1,decay:rnd(0.01,0.022),size:rnd(2.5,6.5),tw:rnd(0,TAU)});
    }
    // shock rings out of the mouth
    rings.push({x:craterX,y:craterY,r0:cw*0.5,grow:5+power*5,life:1,col:"rgba(255,200,90,"});
    if(power>0.55)rings.push({x:craterX,y:craterY,r0:cw*0.3,grow:7+power*7,life:1,col:"rgba(255,120,40,"});
    for(let i=0;i<n;i++){
      // 軸3(歯ごたえ): 速度ばらつき幅を狭め(9-15→10-13)、着弾のX方向の広がりを減らす
      const ang=-Math.PI/2+bias+rnd(-0.07,0.07);const sp=rnd(10,13)*(0.5+power*0.8);
      bombs.push({x:craterX+rnd(-coneW*0.08,coneW*0.08),y:craterY-10,
        vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,r:rnd(7,14),life:1,trail:rnd(0,TAU)});
    }
    for(let i=0;i<14&&smoke.length<90;i++)smoke.push({x:craterX+rnd(-coneW*0.12,coneW*0.12),y:craterY,r:rnd(14,30),vx:rnd(-1.5,1.5),vy:-rnd(1,3),life:1,decay:rnd(0.006,0.012),dark:Math.random()<0.5});
    // burst of bright sparks straight up at the crater mouth
    const ns=Math.floor(10+power*22);
    for(let i=0;i<ns&&sparks.length<160;i++){const a=-Math.PI/2+bias+rnd(-0.8,0.8),s=rnd(4,12)*(0.6+power*0.8);
      sparks.push({x:craterX+rnd(-coneW*0.06,coneW*0.06),y:craterY-6,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.018,0.04),size:rnd(1.6,3.4),hot:Math.random()<0.6});}
    // lingering rising embers
    for(let i=0;i<Math.floor(6+power*10)&&embers.length<80;i++)embers.push({x:craterX+rnd(-coneW*0.1,coneW*0.1),y:craterY,vx:rnd(-0.6,0.6),vy:-rnd(1.4,3.2),life:1,decay:rnd(0.006,0.014),tw:rnd(0,TAU),size:rnd(1.2,2.6)});
  }
  function hitFlyer(f,bx,by){
    const i=flyers.indexOf(f);if(i<0)return;
    f.hitT=6;
    // blimp/大きい的/隕石は複数ヒット: 途中は へこむ/かける演出だけ
    if((f.hp=(f.hp||1)-1)>0){
      api.tone(280,0.08,"square",0.08);api.noise(0.08,0.15,900);
      const chipCol=f.t==="meteor"?"#b7a68a":null;
      for(let k=rint(4,7);k>0;k--){const a=rnd(0,TAU),s=rnd(2,5);
        sparks.push({x:bx,y:by,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.04,0.07),size:rnd(1.2,2.2),hot:true,col:chipCol});}
      return;
    }
    flyers.splice(i,1);
    count++;api.setScore(count);combo++;comboT=1.1;killWave++;
    // ⑦ 大きい的/隕石は 重い分だけ得点も少し多め
    if(f.big){count+=1;api.setScore(count);}
    // ① にじいろ げきは: 大量得点 + 虹の大盤振る舞い / ② ラッキー色: 小さめボーナス
    if(f.rare){count+=6;api.setScore(count);rainbowBurst(f.x,f.y);}
    else if(f.color===luckyColor){count+=1;api.setScore(count);bonus+=1;bonusFlashT=1.6;
      if(!luckySeen){luckySeen=true;luckyMsgT=1.8;}luckyReward(f.x,f.y);}
    // 大噴火ボーナス: multiple kills inside the full-charge window
    if(eruptWin>0){eruptKills++;
      if(eruptKills===2){bonus+=1;bonusFlashT=1.6;count+=2;api.setScore(count);showBanner("だいふんか ボーナス！","",70,"#ffd23f");api.tone(740,0.12,"square",0.2);}
      else if(eruptKills>2){bonus+=1;bonusFlashT=1.6;count+=2;api.setScore(count);api.tone(740+eruptKills*60,0.1,"square",0.18);}
    }
    api.tone(400*Math.pow(2,clamp(combo,0,12)/12),0.1,"square",0.09);api.noise(0.12,0.2,1400);
    api.shake(4+Math.min(combo,8));
    // ⑦ 壊れ方の違い: type別に破片の形/重さ/色を変える(cloud=綿がふわっと漂う, balloon=一瞬で縮んでパチン, blimp=重く黒い破片が落ちる, ufo=とがった破片, meteor=重い岩)
    const shape=f.t==="cloud"?"puff":f.t==="balloon"?"pop":f.t==="blimp"?"crash":f.t==="meteor"?"rock":"spark";
    const shardN=f.t==="meteor"?rint(14,20):rint(8,13);
    for(let k=shardN;k>0;k--){const a=rnd(0,TAU),s=rnd(3,8)*(f.t==="meteor"?1.3:1);
      shards.push({x:f.x,y:f.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s*(shape==="puff"?0.5:1),
        s:rnd(f.r*0.12,f.r*0.28)*((shape==="rock"||shape==="crash")?1.3:1),
        color:shape==="puff"?"#ffffff":shape==="rock"?"#6b5847":f.color,
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.02)*(shape==="puff"?0.6:1),shape});}
    // blimp: 墜落する黒い煙を追加 / meteor: 地面へ落ちる大きな土煙を追加 / ufo: 青いスパークを追加
    if(f.t==="blimp"){for(let k=0;k<6&&smoke.length<90;k++)smoke.push({x:f.x+rnd(-f.r*0.4,f.r*0.4),y:f.y,r:rnd(10,20),vx:rnd(-1,1),vy:rnd(0.2,1.2),life:1,decay:rnd(0.012,0.02),dark:true});api.shake(3);}
    else if(f.t==="meteor"){for(let k=rint(10,16);k>0;k--)dust.push({x:f.x+rnd(-f.r*0.5,f.r*0.5),y:Math.min(f.y+f.r,groundY),r:rnd(8,18),vr:rnd(0.8,2),life:1,decay:rnd(0.02,0.035)});api.shake(6);}
    else if(f.t==="ufo"){for(let k=rint(6,9);k>0;k--){const a=rnd(0,TAU),s=rnd(3,7);
      sparks.push({x:f.x,y:f.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.03,0.05),size:rnd(1.4,2.6),col:"rgba(120,200,255,1)"});}}
    // bright pop sparks at the hit point
    for(let k=rint(6,10);k>0;k--){const a=rnd(0,TAU),s=rnd(2.5,6);
      sparks.push({x:f.x,y:f.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.03,0.06),size:rnd(1.4,2.8),hot:true});}
    // expanding ring flash
    floats.push({ring:true,x:f.x,y:f.y,r0:f.r*0.6,life:1,vy:0,col:f.t==="cloud"?"#ffffff":f.color});
    // 軸6(見やすさ): コンボ数字は生きている的の顔の上に長居しないよう、素早く上へ抜けて早めに消えるようにする
    if(combo>1)floats.push({x:f.x,y:f.y-20,txt:"x"+combo,life:1,vy:-1.6,col:combo>=6?"#ff3b3b":combo>=3?"#ff8c42":"#ffd23f",size:combo>=4?40:30});
    // balloon pops a chain reaction into nearby neighbors
    if(f.t==="balloon"){
      const near=flyers.filter(o=>o.t==="balloon"&&Math.hypot(o.x-f.x,o.y-f.y)<f.r*3.6).slice(0,2);
      for(const o of near){floats.push({ring:true,x:o.x,y:o.y,r0:o.r*0.5,life:1,vy:0,col:o.color});hitFlyer(o,o.x,o.y);}
    }
    // wave clear check
    if(!cleared&&killWave>=need)nextWave();
  }
  // damage the boss; returns true when destroyed
  function hitBoss(bx,by,amt){
    if(!boss)return;
    boss.hitT=7;boss.hp-=(amt||1);
    api.tone(180,0.1,"square",0.12);api.noise(0.12,0.25,700,"lowpass");api.shake(6);
    for(let k=rint(8,12);k>0;k--){const a=rnd(0,TAU),s=rnd(3,8);
      sparks.push({x:bx,y:by,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.03,0.06),size:rnd(1.6,3),hot:true});}
    if(boss.hp<=0){
      // boss defeated: golden wash + confetti 山場
      count+=10;api.setScore(count);
      wash=Math.max(wash,1.0);api.boom(0.65);api.shake(20);api.hitStop(5);
      burstConfetti(70,true);api.slide(400,900,0.5,0.4,"square");
      showBanner("ボス げきは！","だいせいこう！",150,"#ffd23f");
      for(let k=24;k>0;k--){const a=rnd(0,TAU),s=rnd(4,11);
        shards.push({x:boss.x,y:boss.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,s:rnd(8,18),color:pick(BCOL),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.008,0.016)});}
      boss=null;
    }
  }
  // ① にじいろ げきは の演出: 虹の輪 + 紙ふぶき + 金の画面wash(控えめ・すぐ引く)
  function rainbowBurst(x,y){
    rbMsgT=Math.max(rbMsgT,1.3);wash=Math.max(wash,0.55);api.boom(0.55);api.shake(14);
    if(tick-lastStop>45){api.hitStop(3);lastStop=tick;} // 節目のみ(throttle)
    api.slide(660,1320,0.4,0.3,"triangle");api.tone(880,0.12,"triangle",0.12);api.tone(1320,0.14,"triangle",0.1);
    for(let k=0;k<RB.length;k++)floats.push({ring:true,x,y,r0:14+k*9,life:1,vy:0,col:RB[k]});
    for(let i=0;i<26;i++){const a=rnd(0,TAU),s=rnd(3,10);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.025,0.05),size:rnd(1.6,3.2),hot:i%2===0});}
    burstConfetti(20,false);
    // 軸6(見やすさ): コンボ数字(y-20)/ラッキー表示(y-46)と重ならないよう、さらに高く出す
    floats.push({x,y:y-64,txt:"にじいろ！",life:1,vy:-1,col:"#ff5b6e",size:44});
  }
  // ② ラッキー色 命中: きらっと小さめの祝福(頭上に星のヒントも出る)
  function luckyReward(x,y){
    api.tone(1046,0.12,"triangle",0.1);api.tone(1568,0.14,"triangle",0.08);
    floats.push({ring:true,x,y,r0:8,life:1,vy:0,col:luckyColor});
    // 軸6(見やすさ): コンボ数字(y-20)と縦に重ならないよう、より高い位置に出す
    floats.push({x,y:y-46,txt:"ラッキー！",life:1,vy:-1,col:luckyColor,size:30});
    for(let i=0;i<8;i++){const a=rnd(-TAU*0.5,0),s=rnd(2,5);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,life:1,decay:rnd(0.03,0.05),size:rnd(1.4,2.4),hot:true});}
  }
  // ④ ながれ星を ばくだんで 撃った: 減点なしの ごほうび(コインきらめき)
  function shootReward(x,y){
    count+=2;api.setScore(count);bonus+=1;bonusFlashT=1.6;
    api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.08);api.tone(2093,0.12,"triangle",0.06);
    for(let i=0;i<12;i++)confetti.push({x,y,vx:rnd(-5,5),vy:rnd(-7,2),s:rnd(5,9),
      color:pick(["#ffd23f","#fff0a0","#ffffff"]),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:0.01});
    for(let i=0;i<8;i++){const a=rnd(0,TAU),s=rnd(2,5);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.04,size:rnd(1.4,2.4),hot:true});}
    floats.push({x,y:y-16,txt:"ながれ星ゲット！",life:1,vy:-1,col:"#ffd23f",size:30});
  }
  reset();
  return{
    resize:layout,
    input(px,py,type){
      if(type==="down"){charging=true;magma=0;downX=px;}
      else if(type==="up"){if(charging){charging=false;erupt(magma);magma=0;}}
    },
    frame(dt,now){
      tick+=dt;
      // 画像背景(夕暮れの火山地帯)。出ている時は平坦な手描き(空グラデ・星・遠雲・地面の帯)を描かない
      imgBg=api.drawCover("bg.jpg");
      if(!imgBg){
        // dusk sky: deep indigo to warm volcanic horizon
        let grd=g.createLinearGradient(0,0,0,groundY);
        grd.addColorStop(0,"#1a1f4a");grd.addColorStop(0.35,"#3d2f6e");grd.addColorStop(0.66,"#8a5688");grd.addColorStop(0.86,"#e08456");grd.addColorStop(1,"#ffb066");
        g.fillStyle=grd;g.fillRect(0,0,api.W,groundY);
        // twinkling stars (upper sky only)
        for(const st of stars){st.tw+=st.sp*dt;const a=(0.35+0.45*(0.5+0.5*Math.sin(st.tw)))*(1-st.y/(api.H*0.6));
          g.globalAlpha=Math.max(0,a);g.fillStyle="#fff";g.beginPath();g.arc(st.x,st.y,st.r,0,TAU);g.fill();}
        g.globalAlpha=1;
      }
      // ④ ながれ星: 明るい尾を引く一筋(additive・毎フレーム描き直しなので溜まらない)
      if(shoot){g.save();g.globalCompositeOperation="lighter";
        const tx=shoot.x-shoot.vx*6,ty=shoot.y-shoot.vy*6;
        const sgd=g.createLinearGradient(shoot.x,shoot.y,tx,ty);
        sgd.addColorStop(0,"rgba(255,250,220,0.95)");sgd.addColorStop(1,"rgba(255,220,140,0)");
        g.strokeStyle=sgd;g.lineWidth=3;g.lineCap="round";g.beginPath();g.moveTo(shoot.x,shoot.y);g.lineTo(tx,ty);g.stroke();
        g.fillStyle="#fff6d0";g.beginPath();g.arc(shoot.x,shoot.y,2.6,0,TAU);g.fill();
        g.restore();g.globalCompositeOperation="source-over";}
      // ① にじいろ の予告うず: 虹の輪が脈打つ(まもなく激レア出現)
      if(rareOmen){g.save();g.globalCompositeOperation="lighter";
        const pu=0.5+0.5*Math.sin(tick*0.4),rr=16+pu*10;
        for(let k=0;k<3;k++){g.globalAlpha=(0.5-k*0.12)*(0.6+0.4*pu);
          g.strokeStyle=RB[(Math.floor(tick*0.2)+k)%RB.length];g.lineWidth=3;
          g.beginPath();g.arc(rareOmen.x,rareOmen.y,rr+k*7,0,TAU);g.stroke();}
        g.restore();g.globalCompositeOperation="source-over";g.globalAlpha=1;}
      // far parallax clouds (soft purple-pink wisps drifting) ※画像背景のときは絵の霞を活かして描かない
      if(!imgBg) for(const c of clouds){c.x+=c.sp*dt;if(c.x-c.r>api.W)c.x=-c.r;
        const cg=g.createRadialGradient(c.x,c.y,c.r*0.2,c.x,c.y,c.r);
        cg.addColorStop(0,"rgba(180,140,200,0.16)");cg.addColorStop(1,"rgba(180,140,200,0)");
        g.fillStyle=cg;g.beginPath();g.ellipse(c.x,c.y,c.r,c.r*0.5,0,0,TAU);g.fill();}
      // drifting magical light motes (gentle bob + float up, additive)
      g.globalCompositeOperation="lighter";
      for(const m of motes){m.tw+=0.02*dt;m.y-=m.sp*dt;m.x+=Math.sin(m.tw)*m.sw*dt;
        if(m.y<api.H*0.06){m.y=groundY;m.x=rnd(0,api.W);}
        const a=0.18+0.22*(0.5+0.5*Math.sin(m.tw*1.7));
        const mg=g.createRadialGradient(m.x,m.y,0,m.x,m.y,m.r*3);
        mg.addColorStop(0,"rgba("+m.hue+","+a+")");mg.addColorStop(1,"rgba("+m.hue+",0)");
        g.fillStyle=mg;g.beginPath();g.arc(m.x,m.y,m.r*3,0,TAU);g.fill();}
      g.globalCompositeOperation="source-over";
      // soft horizon haze behind the cone (tinted per stage for variety)
      const shue=STAGEHUE[(stage-1)%STAGEHUE.length];
      const hz=g.createRadialGradient(craterX,craterY,10,craterX,craterY,Math.max(api.W,api.H)*0.55);
      hz.addColorStop(0,"rgba("+shue+","+(0.10+glow*0.12)+")");hz.addColorStop(1,"rgba("+shue+",0)");
      g.fillStyle=hz;g.fillRect(0,0,api.W,groundY);
      // charge magma
      if(charging){magma=Math.min(1,magma+0.018*dt);glow=lerp(glow,0.5+magma*0.5,0.2);
        if(Math.random()<0.1+magma*0.2){api.tone(60+magma*60,0.1,"sawtooth",0.05);
          smoke.push({x:craterX+rnd(-coneW*0.1,coneW*0.1),y:craterY,r:rnd(8,16),vx:rnd(-1,1),vy:-rnd(1,2),life:1,decay:0.02,dark:true});}
      } else glow=lerp(glow,0.35,0.1);
      // bonus window countdown
      if(eruptWin>0)eruptWin-=dt;
      // spawn flyers (a touch denser at higher stages)
      spawnT-=dt;if(spawnT<=0&&flyers.length<10&&!cleared){spawnFlyer();spawnT=Math.max(28,46-stage*4);}
      // ⑦ 隕石(重量物)を たまに落とす。空にいる間は増やさない
      meteorT-=dt;if(meteorT<=0&&!cleared&&!flyers.some(f=>f.t==="meteor")){spawnMeteor();meteorT=rint(480,760);}
      // ① にじいろ の予告→出現: まれに 空に虹のうずが灯り、少し待つと 激レアが現れる(ドキドキ)
      if(rareOmen){rareOmen.t-=dt;
        if(rareOmen.t<=0){spawnFlyer(rareOmen.x,true);
          floats.push({x:rareOmen.x,y:rareOmen.y-30,txt:"にじいろ はっけん！",life:1,vy:-1,col:"#ff5b6e",size:28});
          api.tone(1200,0.1,"triangle",0.1);api.tone(1600,0.12,"triangle",0.08);rareOmen=null;}}
      else if(!cleared&&stage>=1&&!flyers.some(f=>f.rare)&&Math.random()<0.0016*dt){
        const rr=clamp(api.W*0.05,26,52),fromL=Math.random()<0.5;
        rareOmen={x:fromL?rr*1.6:api.W-rr*1.6,y:rnd(api.H*0.16,craterY-rr*2),t:46};
        api.tone(900,0.08,"triangle",0.06);}
      // ④ ながれ星(ひみつ): たまに 上空を流れる。ばくだんを 当てると ごほうび(減点なし)
      shootT-=dt;
      if(!shoot&&shootT<=0&&!cleared){const fromL=Math.random()<0.5;
        shoot={x:fromL?-24:api.W+24,y:rnd(api.H*0.08,api.H*0.3),vx:(fromL?1:-1)*rnd(3,5),vy:rnd(0.6,1.4)};
        shootT=rint(360,720);}
      if(shoot){shoot.x+=shoot.vx*dt;shoot.y+=shoot.vy*dt;
        if(shoot.x<-40||shoot.x>api.W+40||shoot.y>craterY)shoot=null;}
      // flyers move (ufo zig-zags, others gently bob / meteor falls slowly straight down)
      for(const f of flyers){
        if(f.t==="meteor"){f.x+=f.vx*dt;f.y+=f.vy*dt;f.bob+=0.03*dt;if(f.hitT>0)f.hitT-=dt;continue;}
        f.x+=f.vx*dt;f.bob+=0.05*dt;
        if(f.t==="ufo"){f.zig+=0.09*dt;f.y+=Math.sin(f.zig)*1.1*dt;}
        else f.y+=Math.sin(f.bob)*0.3*dt;
        f.y=clamp(f.y,api.H*0.1,craterY-f.r);
        if(f.hitT>0)f.hitT-=dt;
      }
      // ③ ノーミス判定: たおせず にげた てきを数える(このウェーブで 0 ならボーナス)。隕石は倒せず地面に落ちたら土煙を残して消える(ノーミス判定には数えない)
      flyers=flyers.filter(f=>{
        if(f.t==="meteor"){
          if(f.y-f.r>groundY){
            for(let k=rint(8,14);k>0;k--)dust.push({x:f.x+rnd(-f.r*0.6,f.r*0.6),y:groundY,r:rnd(10,20),vr:rnd(1,2.2),life:1,decay:rnd(0.018,0.03)});
            api.shake(8);api.noise(0.18,0.22,450,"lowpass");
            return false;
          }
          return true;
        }
        const keep=f.x>-f.r*3&&f.x<api.W+f.r*3;if(!keep)waveEscaped++;return keep;
      });
      // boss move (draw happens later, after the lava fx layers — see below, 軸6)
      if(boss){
        boss.x+=boss.vx*dt;boss.bob+=0.04*dt;boss.zig+=0.05*dt;
        boss.y+=Math.sin(boss.zig)*0.5*dt;boss.y=clamp(boss.y,api.H*0.12,api.H*0.36);
        if(boss.x<-boss.r*1.5)boss.x=-boss.r*1.4,boss.vx=Math.abs(boss.vx);
        if(boss.x>api.W+boss.r*1.5)boss.x=api.W+boss.r*1.4,boss.vx=-Math.abs(boss.vx);
        if(boss.hitT>0)boss.hitT-=dt;
      }
      // smoke (soft puffs, slight glow tint near crater)
      for(const s of smoke){s.x+=s.vx*dt;s.y+=s.vy*dt;s.r+=0.6*dt;s.life-=s.decay*dt;
        const sg=g.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r);
        const base=s.dark?"58,48,56":"206,198,190";
        sg.addColorStop(0,"rgba("+base+","+(Math.max(0,s.life)*0.55)+")");
        sg.addColorStop(1,"rgba("+base+",0)");
        g.fillStyle=sg;g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();}
      g.globalAlpha=1;smoke=smoke.filter(s=>s.life>0);
      // ground band ※画像背景のときは絵の地面をそのまま使う
      if(!imgBg){
        const gg=g.createLinearGradient(0,groundY,0,api.H);
        gg.addColorStop(0,"#5a3826");gg.addColorStop(1,"#2e1c14");
        g.fillStyle=gg;g.fillRect(0,groundY,api.W,api.H-groundY);
        g.fillStyle="rgba(255,150,80,0.18)";g.fillRect(0,groundY,api.W,3);
      }
      // volcano cone
      drawCone();
      // bombs
      for(const b of bombs){b.vy+=grav*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.trail+=dt;
        if(Math.random()<0.5&&smoke.length<90)smoke.push({x:b.x,y:b.y,r:rnd(3,6),vx:0,vy:-0.3,life:0.6,decay:0.04,dark:true});
        // collide flyers
        // 軸3(歯ごたえ): 当たり判定を絞り(0.7→0.6)、的のすぐ近くを通っただけでは当たらないようにする
        // ※0.55まで絞るとfirstScoreSecの中央値が3秒を超えたため0.6へ戻し(a)(b)(c)を両立させる
        // 開始直後(tick<180=約3秒)だけ判定を0.78へ広げ、最初の成功が来るまでの時間のばらつきだけを縮める。
        // それ以降は0.6のままなので、狙わない連打が伸びない基準は変えない。
        const rf=tick<180?0.78:0.6;
        for(const f of flyers){if(Math.hypot(f.x-b.x,f.y-b.y)<f.r*rf+b.r){hitFlyer(f,b.x,b.y);b.life-=0.4;}}
        // collide boss
        if(boss&&Math.hypot(boss.x-b.x,boss.y-b.y)<boss.r+b.r+6){hitBoss(b.x,b.y,1);b.life-=0.6;}
        // ④ ながれ星に ばくだんが当たった: ごほうび
        if(shoot&&Math.hypot(shoot.x-b.x,shoot.y-b.y)<b.r+16){shootReward(shoot.x,shoot.y);shoot=null;b.life-=0.3;}
        // land
        if(b.y+b.r>=groundY){b.life=0;api.shake(2);
          for(let k=rint(3,6);k>0;k--)dust.push({x:b.x,y:groundY,r:rnd(6,12),vr:rnd(0.8,1.6),life:1,decay:0.03});
          api.noise(0.1,0.15,600,"lowpass");}
      }
      for(const b of bombs){if(b.life>0)drawBomb(b);}
      bombs=bombs.filter(b=>b.life>0&&b.x>-30&&b.x<api.W+30);
      // dust
      for(const d of dust){d.r+=d.vr*dt;d.y-=0.3*dt;d.life-=d.decay*dt;g.globalAlpha=Math.max(0,d.life)*0.5;
        g.fillStyle="#caa";g.beginPath();g.arc(d.x,d.y,d.r,0,TAU);g.fill();}
      g.globalAlpha=1;dust=dust.filter(d=>d.life>0);
      // shards (type別に壊れ方を変える: cloud=綿がふわっと漂う/balloon=一瞬で縮んでパチン/blimp・meteor=重い破片が落ちる/既定=とがった破片)
      for(const p of shards){
        const gmul=p.shape==="puff"?0.12:(p.shape==="crash"||p.shape==="rock")?1.5:0.3;
        p.vy+=gmul*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        const pa=Math.max(0,p.life);
        g.save();g.globalAlpha=pa;g.translate(p.x,p.y);g.rotate(p.rot);g.fillStyle=p.color;
        if(p.shape==="puff"){g.beginPath();g.arc(0,0,Math.max(0,p.s*0.6),0,TAU);g.fill();}
        else if(p.shape==="pop"){const sh=Math.max(0,p.s*(0.3+pa*0.7));g.fillRect(-sh/2,-sh/2,sh,sh);}
        else{g.fillRect(-p.s/2,-p.s/2,p.s,p.s);}
        g.restore();}
      shards=shards.filter(p=>p.life>0);
      // lava fountain column (rises in an arch, additive molten glow)
      column=Math.max(0,column-0.02*dt);
      g.globalCompositeOperation="lighter";
      for(const p of fountain){p.vy+=grav*0.85*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.tw+=0.2*dt;p.life-=p.decay*dt;
        if(p.y+p.size>=groundY){p.life=0;for(let k=2;k>0;k--)dust.push({x:p.x,y:groundY,r:rnd(5,10),vr:rnd(0.8,1.5),life:1,decay:0.035});continue;}
        const a=Math.max(0,p.life),sz=p.size*(0.6+a*0.6);
        const fg=g.createRadialGradient(p.x,p.y,0,p.x,p.y,sz*2.6);
        fg.addColorStop(0,"rgba(255,250,210,"+a+")");fg.addColorStop(0.4,"rgba(255,170,60,"+(a*0.85)+")");fg.addColorStop(1,"rgba(255,70,20,0)");
        g.globalAlpha=1;g.fillStyle=fg;g.beginPath();g.arc(p.x,p.y,sz*2.6,0,TAU);g.fill();
        g.fillStyle="rgba(255,255,235,"+(a*0.9)+")";g.beginPath();g.arc(p.x,p.y,sz*0.55,0,TAU);g.fill();}
      g.globalAlpha=1;g.globalCompositeOperation="source-over";
      fountain=fountain.filter(p=>p.life>0);
      // shock rings expanding from the mouth (additive)
      g.globalCompositeOperation="lighter";
      for(const rg of rings){rg.r0+=rg.grow*dt;rg.life-=0.03*dt;const a=Math.max(0,rg.life);
        g.globalAlpha=a*0.7;g.lineWidth=2+a*5;g.strokeStyle=rg.col+a+")";
        g.beginPath();g.ellipse(rg.x,rg.y,rg.r0,rg.r0*0.5,0,0,TAU);g.stroke();}
      g.globalAlpha=1;g.globalCompositeOperation="source-over";rings=rings.filter(rg=>rg.life>0);
      // rising embers (additive glow, gentle drift)
      g.globalCompositeOperation="lighter";
      for(const e of embers){e.tw+=0.08*dt;e.x+=(e.vx+Math.sin(e.tw)*0.3)*dt;e.y+=e.vy*dt;e.vy+=0.01*dt;e.life-=e.decay*dt;
        const a=Math.max(0,e.life);g.globalAlpha=a;
        const eg=g.createRadialGradient(e.x,e.y,0,e.x,e.y,e.size*3);
        eg.addColorStop(0,"rgba(255,240,180,1)");eg.addColorStop(0.4,"rgba(255,150,40,0.8)");eg.addColorStop(1,"rgba(255,80,20,0)");
        g.fillStyle=eg;g.beginPath();g.arc(e.x,e.y,e.size*3,0,TAU);g.fill();}
      // bright sparks with short trails (additive)
      for(const p of sparks){p.vy+=grav*0.5*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=p.decay*dt;
        const a=Math.max(0,p.life);g.globalAlpha=a;
        g.strokeStyle=p.col?p.col:(p.hot?"rgba(255,245,200,1)":"rgba(255,160,60,1)");g.lineWidth=p.size;g.lineCap="round";
        g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x-p.vx*1.6,p.y-p.vy*1.6);g.stroke();
        g.fillStyle=p.col?p.col:(p.hot?"#fff6c8":"#ffb04a");g.beginPath();g.arc(p.x,p.y,Math.max(0,p.size*0.9),0,TAU);g.fill();}
      g.globalAlpha=1;g.globalCompositeOperation="source-over";
      sparks=sparks.filter(p=>p.life>0&&p.y<groundY);embers=embers.filter(e=>e.life>0&&e.y>-20);
      // 軸6(見やすさ): 的の描画は噴水/スパーク/エンバーより後(手前)に回し、フルチャージ噴火の演出中でも
      // どれが敵でどれが演出か分かるよう的の視認性を優先する(良い点=壊す対象の見た目は不変、描く順番だけ変更)
      for(const f of flyers)drawFlyer(f);
      if(boss){drawFlyer(boss);drawBossBar();}
      // red flash
      if(flash>0){g.fillStyle="rgba(255,80,30,"+flash*0.4+")";g.fillRect(0,0,api.W,groundY);flash-=0.05*dt;}
      // climax golden screen wash (additive, fades fast — the big "山場" moment)
      if(wash>0){g.save();g.globalCompositeOperation="lighter";
        const wg=g.createRadialGradient(craterX,craterY,10,craterX,craterY,Math.max(api.W,api.H));
        wg.addColorStop(0,"rgba(255,240,190,"+(wash*0.7)+")");wg.addColorStop(0.5,"rgba(255,180,90,"+(wash*0.35)+")");wg.addColorStop(1,"rgba(255,140,60,0)");
        g.fillStyle=wg;g.fillRect(0,0,api.W,api.H);g.restore();g.globalCompositeOperation="source-over";wash-=0.06*dt;}
      // combo decay
      if(combo>0){comboT-=0.012*dt;if(comboT<=0)combo=0;}
      // magma meter (rounded, glowing fill)
      if(charging){const w=Math.min(api.W*0.5,240),x=(api.W-w)/2,y=api.H-26,h=14;
        g.fillStyle="rgba(0,0,0,.45)";roundRect(x,y,w,h,7);g.fill();
        const fw=(w-4)*magma;
        if(fw>0){const mg=g.createLinearGradient(x,0,x+w,0);mg.addColorStop(0,"#ff5b2c");mg.addColorStop(0.7,"#ffae2e");mg.addColorStop(1,"#ffec6a");
          g.save();g.shadowColor=magma>0.85?"#ffec3a":"#ff7b2c";g.shadowBlur=8+magma*8;
          g.fillStyle=mg;roundRect(x+2,y+2,fw,h-4,5);g.fill();g.restore();}
        g.fillStyle="#fff";g.font="800 13px system-ui";g.textAlign="center";
        g.shadowColor="rgba(0,0,0,.6)";g.shadowBlur=4;g.fillText("マグマ",api.W/2,y-4);g.shadowBlur=0;g.textAlign="left";}
      // floats (combo text + expanding ring flashes)
      g.textAlign="center";
      for(const f of floats){
        if(f.ring){f.life-=0.05*dt;const a=Math.max(0,f.life),rr=f.r0+(1-f.life)*46;
          g.globalAlpha=a*0.8;g.lineWidth=3+a*3;g.strokeStyle=f.col;
          g.beginPath();g.arc(f.x,f.y,rr,0,TAU);g.stroke();continue;}
        f.y+=f.vy*dt;f.life-=0.022*dt;const a=Math.max(0,f.life);g.globalAlpha=a;
        const pop=1+0.3*Math.max(0,1-(1-f.life)*5);
        g.font="800 "+(f.size*pop|0)+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,f.x,f.y);
        g.shadowColor=f.col;g.shadowBlur=12;g.fillStyle="#fff";g.fillText(f.txt,f.x,f.y);g.shadowBlur=0;
        g.globalAlpha=a;g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // hint (cute rounded glassy panel, fades while charging so it doesn't fight the meter)
      const hintA=charging?0.35:1;
      g.save();g.globalAlpha=hintA;
      g.font="800 15px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
      const htxt="ながおしで マグマをためて、はなして ふんか！";
      const hw2=(g.measureText(htxt)||{}).width||htxt.length*13,pw=hw2+34,px2=(api.W-pw)/2,py2=api.H-34,ph=26;
      g.fillStyle="rgba(40,24,48,0.55)";roundRect(px2,py2,pw,ph,13);g.fill();
      g.strokeStyle="rgba(255,200,120,0.5)";g.lineWidth=2;roundRect(px2,py2,pw,ph,13);g.stroke();
      const ty=py2+ph*0.62+5;
      g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(htxt,api.W/2,ty);
      g.shadowColor="rgba(255,180,80,0.7)";g.shadowBlur=8;g.fillStyle="#fff7e6";g.fillText(htxt,api.W/2,ty);
      g.shadowBlur=0;g.textAlign="left";g.restore();
      // confetti (clear/boss celebration, gravity + tumble)
      for(const c of confetti){c.vy+=0.18*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=c.vr*dt;c.life-=c.decay*dt;
        g.save();g.globalAlpha=Math.max(0,c.life);g.translate(c.x,c.y);g.rotate(c.rot);g.fillStyle=c.color;
        g.fillRect(-c.s/2,-c.s*0.3,c.s,c.s*0.6);g.restore();}
      g.globalAlpha=1;confetti=confetti.filter(c=>c.life>0&&c.y<api.H+20);
      // ① にじいろ！ げきは の中央バナー(虹色に色替わり)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=RB[Math.floor(tick*0.12)%RB.length];
        g.save();g.translate(api.W/2,api.H*0.34);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("にじいろ！",0,0);
        g.fillStyle=col;g.fillText("にじいろ！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央の小ヒント(初回だけ)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.28);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(COLNAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ ノーミス！ バナー(ウェーブ/ステージ バナーと重ねない下段)
      if(noMissT>0){noMissT-=0.014*dt;
        const pop=1+Math.max(0,noMissT-1.2)*1.3;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(noMissT*1.3,0,1);g.font="900 28px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("ノーミス！",0,0);
        g.shadowColor="rgba(120,255,150,.8)";g.shadowBlur=14;g.fillStyle="#c7ffcf";g.fillText("ノーミス！",0,0);g.shadowBlur=0;
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(noMissT<0)noMissT=0;}
      // top HUD: stage + wave pips + れんさ(combo) gauge + bonus
      drawHUD(dt);
      // big stage/wave/clear banner
      if(bannerT>0){bannerT-=dt;drawBanner();}
    }
  };
  function drawHUD(dt){
    // 全HUDを上部中央のスタックに集約（engine HUDのもどる/タイトル/スコアと衝突させない）
    g.save();g.textBaseline="middle";
    // stage label
    g.textAlign="center";g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";
    const lab="ステージ "+stage;
    g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(lab,api.W/2,16);
    g.fillStyle="#fff7e6";g.fillText(lab,api.W/2,16);
    // wave pips + progress bar（中央そろえ）
    const pw=120,pipsW=3*15,gap=8,unitW=pipsW+gap+pw,ux=api.W/2-unitW/2,uy=32;
    for(let i=0;i<3;i++){const px=ux+7+i*15,on=i<wave;
      g.fillStyle=on?"#ffd23f":"rgba(255,255,255,0.25)";g.beginPath();g.arc(px,uy,5,0,TAU);g.fill();
      if(on){g.strokeStyle="rgba(0,0,0,0.4)";g.lineWidth=1.4;g.stroke();}}
    const barX=ux+pipsW+gap,frac=clamp(killWave/Math.max(1,need),0,1);
    g.fillStyle="rgba(0,0,0,0.4)";roundRect(barX,uy-4,pw,8,4);g.fill();
    if(frac>0){const pg=g.createLinearGradient(barX,0,barX+pw,0);pg.addColorStop(0,"#ff8c42");pg.addColorStop(1,"#ffd23f");
      g.fillStyle=pg;roundRect(barX+1,uy-3,(pw-2)*frac,6,3);g.fill();}
    // れんさゲージ (combo) — 中央下段。軸6(見やすさ): コンボが無い間は描かず、常時HUDを「ステージ+進捗バー」の1段だけにして情報量を減らす
    const cw=130,cgx=api.W/2-cw/2,cy=50,cgy=cy+10;
    if(combo>0){
      const cmax=8,cf=clamp(combo/cmax,0,1);
      g.textAlign="center";g.font="800 13px 'Hiragino Maru Gothic ProN',system-ui";
      g.lineWidth=3.5;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("れんさ",api.W/2,cy);
      g.fillStyle=combo>=4?"#ff6b6b":"#fff7e6";g.fillText("れんさ",api.W/2,cy);
      g.fillStyle="rgba(0,0,0,0.4)";roundRect(cgx,cgy,cw,9,4);g.fill();
      if(cf>0){const cg=g.createLinearGradient(cgx,0,cgx+cw,0);cg.addColorStop(0,"#5bd6ff");cg.addColorStop(0.6,"#ffd23f");cg.addColorStop(1,"#ff5b6e");
        g.save();if(combo>=4){g.shadowColor="#ffd23f";g.shadowBlur=8;}g.fillStyle=cg;roundRect(cgx+1,cgy+1,(cw-2)*cf,7,3);g.fill();g.restore();}
    }
    // 軸6(見やすさ): ボーナスは「加算された瞬間だけ光る」一時表示にする(常時居座らせない=常時HUDは2段のまま)
    if(bonusFlashT>0){bonusFlashT-=0.016*dt;const a=clamp(bonusFlashT*1.3,0,1);
      g.globalAlpha=a;g.font="800 12px 'Hiragino Maru Gothic ProN',system-ui";
      g.lineWidth=3;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("ボーナス x"+bonus,api.W/2,cgy+20);
      g.fillStyle="#ffd23f";g.fillText("ボーナス x"+bonus,api.W/2,cgy+20);
      g.globalAlpha=1;if(bonusFlashT<0)bonusFlashT=0;}
    g.restore();g.textAlign="left";g.textBaseline="alphabetic";
  }
  function drawBanner(){
    if(!banner)return;
    const t=bannerT,fade=clamp(t/22,0,1);
    g.save();g.textAlign="center";
    // 軸6(見やすさ): 的が飛ぶ帯(spawnFlyerのy=H*0.12〜craterY-r*1.5)に被らない高さへ(達成バナーが的の顔に重ならないように)
    const cy=api.H*0.20;
    // big celebratory glow if a全クリ banner
    if(cleared){g.globalCompositeOperation="lighter";
      const wg=g.createRadialGradient(api.W/2,cy,10,api.W/2,cy,Math.max(api.W,api.H)*0.6);
      wg.addColorStop(0,"rgba(255,240,190,"+(fade*0.5)+")");wg.addColorStop(1,"rgba(255,200,90,0)");
      g.fillStyle=wg;g.fillRect(0,0,api.W,api.H);g.globalCompositeOperation="source-over";}
    g.globalAlpha=fade;
    const pop=1+0.18*Math.max(0,1-(banner.t0-t)/14);
    g.font="800 "+((cleared?52:40)*pop|0)+"px 'Hiragino Maru Gothic ProN',system-ui";
    g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(banner.txt,api.W/2,cy);
    g.shadowColor=banner.col;g.shadowBlur=18;g.fillStyle="#fff";g.fillText(banner.txt,api.W/2,cy);g.shadowBlur=0;
    g.fillStyle=banner.col;g.globalAlpha=fade*0.9;g.fillText(banner.txt,api.W/2,cy);
    if(banner.sub){g.globalAlpha=fade;g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
      g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(banner.sub,api.W/2,cy+34);
      g.fillStyle="#fff7e6";g.fillText(banner.sub,api.W/2,cy+34);}
    g.restore();g.textAlign="left";g.globalAlpha=1;
  }
  function drawBossBar(){
    if(!boss)return;
    const w=Math.min(api.W*0.6,300),x=(api.W-w)/2,y=54,h=12,frac=clamp(boss.hp/boss.maxhp,0,1);
    g.save();g.textAlign="center";
    g.font="800 13px 'Hiragino Maru Gothic ProN',system-ui";
    g.lineWidth=3.5;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("ボス",api.W/2,y-4);
    g.fillStyle="#ff6b6b";g.fillText("ボス",api.W/2,y-4);
    g.fillStyle="rgba(0,0,0,0.5)";roundRect(x,y,w,h,6);g.fill();
    if(frac>0){const bg=g.createLinearGradient(x,0,x+w,0);bg.addColorStop(0,"#ff3b3b");bg.addColorStop(1,"#ff8c42");
      g.fillStyle=bg;roundRect(x+2,y+2,(w-4)*frac,h-4,4);g.fill();}
    g.restore();g.textAlign="left";
  }
  function roundRect(x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function drawCone(){
    const bx=craterX,topY=craterY,baseY=groundY,hw=coneW/2,tw=coneW*0.13;
    const heat=Math.min(1,glow+column*0.4);
    const pulse=0.5+heat*0.5+(charging?Math.sin(tick*0.3)*0.12:0);
    // left & right slopes with a few rocky jags for a craggy silhouette
    const lj=[[bx-tw,topY],[bx-tw*1.7,topY+(baseY-topY)*0.26],[bx-hw*0.62,topY+(baseY-topY)*0.55],[bx-hw*0.82,topY+(baseY-topY)*0.78],[bx-hw,baseY]];
    const rj=[[bx+tw,topY],[bx+tw*1.55,topY+(baseY-topY)*0.22],[bx+hw*0.6,topY+(baseY-topY)*0.5],[bx+hw*0.86,topY+(baseY-topY)*0.8],[bx+hw,baseY]];
    function conePath(){g.beginPath();g.moveTo(lj[0][0],lj[0][1]);for(const p of lj)g.lineTo(p[0],p[1]);g.lineTo(bx-hw,baseY);g.lineTo(bx+hw,baseY);for(let i=rj.length-1;i>=0;i--)g.lineTo(rj[i][0],rj[i][1]);g.closePath();}
    // ambient ground glow pooled at the base when hot
    g.save();g.globalCompositeOperation="lighter";
    const bgGlow=g.createRadialGradient(bx,baseY,4,bx,baseY,hw*1.3);
    bgGlow.addColorStop(0,"rgba(255,110,40,"+(0.18+heat*0.22)+")");bgGlow.addColorStop(1,"rgba(255,90,30,0)");
    g.fillStyle=bgGlow;g.beginPath();g.ellipse(bx,baseY,hw*1.3,hw*0.4,0,0,TAU);g.fill();g.restore();
    // body with vertical rocky gradient (画像があっても下地として描く: 画像の岩肌の隙間を暗い岩色で埋める)
    const bg=g.createLinearGradient(bx,topY,bx,baseY);
    bg.addColorStop(0,"#6b5249");bg.addColorStop(0.5,"#4a3730");bg.addColorStop(1,"#2c2019");
    g.fillStyle=bg;conePath();g.fill();
    // 画像の火山(溶岩の山頂+灰色の岩肌)。当たり判定のコーン形(conePath)でクリップして、
    // 火口(topY, 幅 2*tw)は画像の尖った山頂の少し下(画像高さの15%)に来るよう上に張り出させ、下端は地面の少し下まで
    const coneH=baseY-topY,imgW=coneW*1.08,imgH=coneH*1.22;
    let coneImg=false;
    if(api.asset("volcano.png").ready){
      g.save();conePath();g.clip();
      coneImg=api.drawAsset("volcano.png",bx-imgW/2+imgW*0.01,topY-imgH*0.15,imgW,imgH);
      g.restore();
    }
    if(!coneImg){
    // rock strata bands (clipped to the cone) for layered detail
    g.save();conePath();g.clip();
    for(let i=1;i<=4;i++){const yy=topY+(baseY-topY)*(i/4.8);
      g.strokeStyle=i%2?"rgba(255,180,120,0.06)":"rgba(0,0,0,0.16)";g.lineWidth=baseY*0.012;
      g.beginPath();g.moveTo(bx-hw,yy+Math.sin(i)*6);g.bezierCurveTo(bx-hw*0.3,yy-5,bx+hw*0.3,yy+7,bx+hw,yy-Math.cos(i)*6);g.stroke();}
    // shaded right face
    g.fillStyle="rgba(18,12,10,0.42)";g.beginPath();g.moveTo(bx,topY);g.lineTo(bx+hw,topY);g.lineTo(bx+hw,baseY);g.lineTo(bx,baseY);g.closePath();g.fill();
    // sunlit left rim
    g.fillStyle="rgba(255,170,100,0.18)";g.beginPath();g.moveTo(bx-tw,topY);g.lineTo(bx-tw*0.4,topY);g.lineTo(bx-hw*0.45,baseY);g.lineTo(bx-hw,baseY);g.closePath();g.fill();
    g.restore();
    }
    // glowing lava-crack network (soft, multi-branch)
    g.save();g.shadowColor="rgba(255,90,30,0.9)";g.shadowBlur=8+heat*14;
    g.strokeStyle="rgba(255,120,40,"+(0.5+heat*0.5)+")";g.lineWidth=4;g.lineCap="round";g.lineJoin="round";
    g.beginPath();
    g.moveTo(bx-tw*0.5,topY+8);g.lineTo(bx-tw*0.9,topY+(baseY-topY)*0.4);g.lineTo(bx-hw*0.55,topY+(baseY-topY)*0.7);g.lineTo(bx-hw*0.42,baseY-10);
    g.moveTo(bx+tw*0.4,topY+8);g.lineTo(bx+tw*0.7,topY+(baseY-topY)*0.38);g.lineTo(bx+hw*0.5,topY+(baseY-topY)*0.72);g.lineTo(bx+hw*0.5,baseY-16);
    g.moveTo(bx,topY+10);g.lineTo(bx-tw*0.2,topY+(baseY-topY)*0.45);g.lineTo(bx+tw*0.1,baseY-22);
    g.stroke();
    // hot inner thread
    g.lineWidth=1.8;g.strokeStyle="rgba(255,225,140,"+(0.45+heat*0.5)+")";
    g.beginPath();
    g.moveTo(bx-tw*0.5,topY+8);g.lineTo(bx-tw*0.9,topY+(baseY-topY)*0.4);g.lineTo(bx-hw*0.42,baseY-12);
    g.moveTo(bx+tw*0.4,topY+8);g.lineTo(bx+hw*0.5,baseY-18);
    g.stroke();g.restore();
    // crater outer glow halo
    g.save();g.globalCompositeOperation="lighter";
    const gr=g.createRadialGradient(bx,topY,2,bx,topY,tw*2.2);
    gr.addColorStop(0,"rgba(255,235,140,"+(0.7*pulse)+")");gr.addColorStop(0.45,"rgba(255,110,40,"+(0.5*pulse)+")");gr.addColorStop(1,"rgba(255,90,30,0)");
    g.fillStyle=gr;g.beginPath();g.ellipse(bx,topY,tw*2.2,tw*1.2,0,0,TAU);g.fill();
    g.restore();
    // dark crater rim lip
    g.strokeStyle="rgba(30,18,14,0.7)";g.lineWidth=3;g.beginPath();g.ellipse(bx,topY,tw*0.82,tw*0.46,0,0,TAU);g.stroke();
    // molten crater mouth
    const mr=g.createRadialGradient(bx,topY,1,bx,topY,tw*(0.8+heat*0.3));
    mr.addColorStop(0,"#fff7c8");mr.addColorStop(0.5,"#ffc24a");mr.addColorStop(1,"#ff6a1e");
    g.fillStyle=mr;g.beginPath();g.ellipse(bx,topY,tw*(0.72+heat*0.3),tw*0.42,0,0,TAU);g.fill();
    // bright bubbling specks on the molten surface
    g.save();g.globalCompositeOperation="lighter";
    for(let i=0;i<4;i++){const px=bx+Math.sin(tick*0.13+i*1.7)*tw*0.4,py=topY+Math.cos(tick*0.17+i*2.1)*tw*0.13;
      g.fillStyle="rgba(255,245,200,"+(0.4+0.4*Math.abs(Math.sin(tick*0.2+i)))+")";g.beginPath();g.arc(px,py,tw*0.07,0,TAU);g.fill();}
    g.restore();
  }
  function drawBomb(b){
    g.save();g.translate(b.x,b.y);
    // additive heat halo
    g.globalCompositeOperation="lighter";
    const hl=g.createRadialGradient(0,0,b.r*0.3,0,0,b.r*2.4);
    hl.addColorStop(0,"rgba(255,150,50,0.55)");hl.addColorStop(1,"rgba(255,80,20,0)");
    g.fillStyle=hl;g.beginPath();g.arc(0,0,b.r*2.4,0,TAU);g.fill();
    g.globalCompositeOperation="source-over";
    // molten rock core
    const gr=g.createRadialGradient(-b.r*0.3,-b.r*0.3,b.r*0.15,0,0,b.r);
    gr.addColorStop(0,"#fff6c0");gr.addColorStop(0.45,"#ff9a3a");gr.addColorStop(0.8,"#e2531c");gr.addColorStop(1,"#7a2410");
    g.fillStyle=gr;g.beginPath();g.arc(0,0,b.r,0,TAU);g.fill();
    // hot specular dot
    g.fillStyle="rgba(255,255,235,0.85)";g.beginPath();g.arc(-b.r*0.32,-b.r*0.32,b.r*0.22,0,TAU);g.fill();
    g.restore();
  }
  // little face: two shiny eyes + a happy smile, gives every target a cute mascot vibe
  function drawFace(cx,cy,sc,look){
    const ex=sc*0.42,ey=sc*0.08,er=sc*0.26;
    // whites
    g.fillStyle="#fff";
    g.beginPath();g.arc(cx-ex,cy-ey,er,0,TAU);g.arc(cx+ex,cy-ey,er,0,TAU);g.fill();
    // pupils (drift slightly toward look dir)
    const px=(look||0)*er*0.4;
    g.fillStyle="#23303a";
    g.beginPath();g.arc(cx-ex+px,cy-ey,er*0.55,0,TAU);g.arc(cx+ex+px,cy-ey,er*0.55,0,TAU);g.fill();
    // catchlights
    g.fillStyle="rgba(255,255,255,0.95)";
    g.beginPath();g.arc(cx-ex+px-er*0.18,cy-ey-er*0.2,er*0.18,0,TAU);g.arc(cx+ex+px-er*0.18,cy-ey-er*0.2,er*0.18,0,TAU);g.fill();
    // rosy cheeks
    g.fillStyle="rgba(255,140,150,0.45)";
    g.beginPath();g.arc(cx-ex*1.35,cy+sc*0.34,sc*0.16,0,TAU);g.arc(cx+ex*1.35,cy+sc*0.34,sc*0.16,0,TAU);g.fill();
    // smile
    g.strokeStyle="#23303a";g.lineWidth=Math.max(1.4,sc*0.1);g.lineCap="round";
    g.beginPath();g.arc(cx,cy+sc*0.18,sc*0.34,0.18*Math.PI,0.82*Math.PI);g.stroke();
  }
  function drawFlyer(f){
    g.save();g.translate(f.x,f.y);
    // 軸6(見やすさ): 生成背景の明暗に関わらず的が埋もれないよう、輪郭の下に柔らかい暗色の縁取りを敷く(どんな背景でもコントラストを確保)
    g.save();g.globalAlpha=0.22;g.fillStyle="#0a0e18";g.beginPath();g.arc(0,0,Math.max(0,f.r*1.12),0,TAU);g.fill();g.restore();
    const look=Math.sign(f.vx)||1;
    // ① にじいろ激レア: 体の色を虹に巡回 + やわらかな白い光輪(毎フレーム描き直しで溜まらない)
    if(f.rare){f.color=RB[Math.floor(tick*0.12+(f.offset||0))%RB.length];
      g.save();g.globalCompositeOperation="lighter";
      const hg=g.createRadialGradient(0,0,f.r*0.3,0,0,f.r*1.9);
      hg.addColorStop(0,"rgba(255,255,255,0.30)");hg.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=hg;g.beginPath();g.arc(0,0,f.r*1.9,0,TAU);g.fill();
      g.restore();g.globalCompositeOperation="source-over";}
    // 飛ぶ標的(雲/飛行船/風船/UFO)は色バリエーション(ラッキー色・にじいろ)があるので全て手描きのまま
    {
    // soft drop shadow on the body fill
    g.shadowColor="rgba(20,20,40,0.30)";g.shadowBlur=12;g.shadowOffsetY=5;
    if(f.t==="cloud"){
      // fluffy puff with a gentle blue underside for volume
      const cg=g.createLinearGradient(0,-f.r*0.7,0,f.r*0.7);
      cg.addColorStop(0,"#ffffff");cg.addColorStop(1,"#d6e2f5");
      g.fillStyle=cg;
      g.beginPath();g.arc(-f.r*0.5,0,f.r*0.5,0,TAU);g.arc(0,-f.r*0.22,f.r*0.62,0,TAU);g.arc(f.r*0.52,0,f.r*0.5,0,TAU);g.arc(0,f.r*0.2,f.r*0.56,0,TAU);g.fill();
      g.shadowColor="transparent";
      // glossy top highlight
      g.fillStyle="rgba(255,255,255,0.9)";g.beginPath();g.arc(-f.r*0.05,-f.r*0.32,f.r*0.34,0,TAU);g.fill();
      drawFace(0,-f.r*0.02,f.r*0.5,look);
    }else if(f.t==="blimp"){
      const bg=g.createLinearGradient(0,-f.r*0.55,0,f.r*0.55);
      bg.addColorStop(0,shade(f.color,28));bg.addColorStop(0.5,f.color);bg.addColorStop(1,shade(f.color,-30));
      g.fillStyle=bg;g.beginPath();g.ellipse(0,0,f.r,f.r*0.58,0,0,TAU);g.fill();
      g.shadowColor="transparent";
      // body stripe + glossy band
      g.fillStyle="rgba(255,255,255,.25)";g.beginPath();g.ellipse(0,-f.r*0.16,f.r*0.92,f.r*0.16,0,0,TAU);g.fill();
      g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=Math.max(1.5,f.r*0.06);g.beginPath();g.moveTo(-f.r*0.1,-f.r*0.55);g.lineTo(-f.r*0.1,f.r*0.55);g.stroke();
      // gondola
      g.fillStyle="#5a4636";roundRect(-f.r*0.22,f.r*0.5,f.r*0.44,f.r*0.32,f.r*0.1);g.fill();
      // tail fin
      g.fillStyle=shade(f.color,-18);g.beginPath();g.moveTo(f.r*0.78,0);g.lineTo(f.r*1.12,-f.r*0.32);g.lineTo(f.r*1.12,f.r*0.32);g.closePath();g.fill();
      drawFace(-f.r*0.18,-f.r*0.02,f.r*0.5,look);
    }else if(f.t==="balloon"){
      const rg=g.createRadialGradient(-f.r*0.22,-f.r*0.3,f.r*0.1,0,0,f.r*0.95);
      rg.addColorStop(0,shade(f.color,55));rg.addColorStop(0.55,f.color);rg.addColorStop(1,shade(f.color,-25));
      g.fillStyle=rg;g.beginPath();g.ellipse(0,0,f.r*0.72,f.r*0.86,0,0,TAU);g.fill();
      g.shadowColor="transparent";
      // knot + curly string
      g.fillStyle=shade(f.color,-25);g.beginPath();g.moveTo(-f.r*0.1,f.r*0.82);g.lineTo(f.r*0.1,f.r*0.82);g.lineTo(0,f.r*0.98);g.closePath();g.fill();
      g.strokeStyle="rgba(255,255,255,.4)";g.lineWidth=1.4;g.beginPath();
      g.moveTo(0,f.r*0.98);g.quadraticCurveTo(f.r*0.22,f.r*1.2,0,f.r*1.4);g.quadraticCurveTo(-f.r*0.2,f.r*1.6,f.r*0.05,f.r*1.75);g.stroke();
      // shine
      g.fillStyle="rgba(255,255,255,.6)";g.beginPath();g.ellipse(-f.r*0.24,-f.r*0.32,f.r*0.13,f.r*0.2,-0.5,0,TAU);g.fill();
      drawFace(0,-f.r*0.04,f.r*0.5,look);
    }else if(f.t==="meteor"){
      // ⑦ 隕石(重量物): ごつごつした岩肌 + うっすら燃える尾。乗り物/生き物とは違う"重い塊"の見た目
      g.shadowColor="transparent";
      g.save();g.globalCompositeOperation="lighter";
      const tail=g.createRadialGradient(0,-f.r*0.55,2,0,-f.r*0.55,f.r*1.3);
      tail.addColorStop(0,"rgba(255,150,60,0.32)");tail.addColorStop(1,"rgba(255,150,60,0)");
      g.fillStyle=tail;g.beginPath();g.arc(0,-f.r*0.5,Math.max(0,f.r*1.3),0,TAU);g.fill();
      g.restore();
      const rg=g.createRadialGradient(-f.r*0.25,-f.r*0.25,f.r*0.1,0,0,Math.max(0,f.r));
      rg.addColorStop(0,"#a08868");rg.addColorStop(0.55,"#7a624a");rg.addColorStop(1,"#4a3a2c");
      g.fillStyle=rg;g.beginPath();
      const jag=8;for(let i=0;i<=jag;i++){const aa=i/jag*TAU,rr=f.r*(0.86+0.14*Math.sin(aa*3+(f.offset||0)));
        const jx=Math.cos(aa)*rr,jy=Math.sin(aa)*rr;if(i===0)g.moveTo(jx,jy);else g.lineTo(jx,jy);}
      g.closePath();g.fill();
      g.shadowColor="transparent";
      // craters
      g.fillStyle="rgba(30,22,16,0.4)";g.beginPath();
      g.arc(-f.r*0.28,-f.r*0.1,Math.max(0,f.r*0.16),0,TAU);
      g.arc(f.r*0.2,f.r*0.22,Math.max(0,f.r*0.12),0,TAU);
      g.arc(f.r*0.05,-f.r*0.3,Math.max(0,f.r*0.09),0,TAU);g.fill();
      drawFace(0,f.r*0.02,f.r*0.42,look);
    }else{ // ufo
      // additive glow underbeam, makes it feel magical like the lava fx
      g.shadowColor="transparent";
      g.save();g.globalCompositeOperation="lighter";
      const beam=g.createRadialGradient(0,f.r*0.2,2,0,f.r*0.2,f.r*1.4);
      beam.addColorStop(0,"rgba(120,255,200,0.5)");beam.addColorStop(1,"rgba(120,255,200,0)");
      g.fillStyle=beam;g.beginPath();g.moveTo(-f.r*0.6,f.r*0.2);g.lineTo(f.r*0.6,f.r*0.2);g.lineTo(f.r*1.1,f.r*1.5);g.lineTo(-f.r*1.1,f.r*1.5);g.closePath();g.fill();
      g.restore();
      // dome
      const dg=g.createLinearGradient(0,-f.r*0.6,0,0);
      dg.addColorStop(0,"#e6f7ff");dg.addColorStop(1,"#7fb8d8");
      g.fillStyle=dg;g.beginPath();g.arc(0,-f.r*0.05,f.r*0.52,Math.PI,0);g.fill();
      // saucer body
      const sg=g.createLinearGradient(0,-f.r*0.1,0,f.r*0.3);
      sg.addColorStop(0,"#c3ccd6");sg.addColorStop(1,"#7d8794");
      g.fillStyle=sg;g.beginPath();g.ellipse(0,f.r*0.08,f.r,f.r*0.36,0,0,TAU);g.fill();
      // rim
      g.strokeStyle="rgba(255,255,255,0.4)";g.lineWidth=Math.max(1.4,f.r*0.06);g.beginPath();g.ellipse(0,f.r*0.08,f.r*0.98,f.r*0.34,0,0,TAU);g.stroke();
      // blinking lights
      g.save();g.globalCompositeOperation="lighter";
      for(let i=-2;i<=2;i++){const bl=0.4+0.6*Math.abs(Math.sin(tick*0.18+i*1.3));
        g.fillStyle="rgba(255,220,90,"+bl+")";g.beginPath();g.arc(i*f.r*0.36,f.r*0.16,f.r*0.09,0,TAU);g.fill();}
      g.restore();
      // little alien face inside the dome
      drawFace(0,-f.r*0.12,f.r*0.42,look);
    }
    }
    g.shadowColor="transparent";g.shadowBlur=0;g.shadowOffsetY=0;
    // white hit-flash overlay (feedback for non-fatal hits / boss damage)
    if(f.hitT>0){g.globalCompositeOperation="lighter";g.globalAlpha=clamp(f.hitT/6,0,1)*0.7;
      g.fillStyle="#fff";g.beginPath();g.arc(0,0,f.r*1.05,0,TAU);g.fill();g.globalAlpha=1;g.globalCompositeOperation="source-over";}
    // ② きょうのラッキー色: この てきが 秘密の色なら 頭上に 小さな星がキラッ(気づけるヒント)
    if(!f.rare&&!f.boss&&f.color===luckyColor){const tw=0.5+0.5*Math.sin(tick*0.2+(f.offset||0));
      g.save();g.globalAlpha=0.45+0.4*tw;g.fillStyle="#fff2a0";g.translate(0,-f.r*1.25);
      const sr=3+tw*1.6;g.beginPath();
      for(let i=0;i<5;i++){const aa=-Math.PI/2+i*TAU/5;g.lineTo(Math.cos(aa)*sr,Math.sin(aa)*sr);
        const ab=aa+TAU/10;g.lineTo(Math.cos(ab)*sr*0.45,Math.sin(ab)*sr*0.45);}
      g.closePath();g.fill();g.restore();g.globalAlpha=1;}
    g.restore();
  }
  // lighten(+) / darken(-) a #rrggbb hex by amt
  function shade(hex,amt){
    let n=parseInt(hex.slice(1),16);
    let r=clamp((n>>16)+amt,0,255)|0,gc=clamp((n>>8&255)+amt,0,255)|0,b=clamp((n&255)+amt,0,255)|0;
    return"rgb("+r+","+gc+","+b+")";
  }
}
Engine.register("volcano", buildVolcano);
