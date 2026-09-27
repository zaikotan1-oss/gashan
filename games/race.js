function buildRace(api){
  const g=api.g;
  api.preload(["bg.jpg","player.png","cone.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)
  // ※ボス(トレーラー)は生成が2回とも不良(情景ごと出る/横向き)だったので 画像は使わず 従来の手描きのまま
  let imgBg=false;   // 今フレーム 画像背景が描けたか(平坦な手描き背景要素をスキップする判定)
  // 生成スプライトの外形比 asp=幅/高さ(一覧表 _sheet.jpg の実測)。gen_assets の recrop_square は物の長辺が
  // 正方形の約98%を占めるので、長辺を当たり判定に合わせ、短辺は当たり判定へ軽く伸縮(±15%まで)して寄せる
  // player.png は鼻先が右向きに生成されたので quarter=true で -90°回して上向きに(asp は回した後の 幅/高さ)
  const SPR={player:{asp:0.91,quarter:true},cone:{asp:0.93}};
  function drawFit(name,sp,x,y,hw,hh,pad,opts){
    const oh=0.98*Math.min(1,1/sp.asp), ow=0.98*Math.min(1,sp.asp);   // 正方形1あたりの物の高さ/幅(表示時の向き)
    const S=hh*pad/oh; const kx=clamp((hw*pad)/(S*ow),0.85,1.15);
    opts=opts||{}; opts.center=true;
    if(sp.quarter){opts.rot=(opts.rot||0)-Math.PI/2; return api.drawAsset(name,x,y,S,S*kx,opts);}   // 回す前は 幅↔高さ が入れ替わる
    return api.drawAsset(name,x,y,S*kx,S,opts);
  }
  let enemies=[],sparks=[],shards=[],lines=[],floats=[],rings=[],dust=[],motes=[],clouds=[];
  let roadX,roadW,lanes,laneW,player,scroll,scrollSpd,count,combo,comboT,spawnT,boost,tick,flash,wash;
  let stage,stageKills,stageNeed,clearT,clearMsg,bannerCol,finaleT,spin,boss,beat;
  const CARCOL=["#e85d75","#4aa6c0","#7be08a","#ffb347","#b58bff","#ff7bd0","#5a9af0"];
  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマー/トラックと同じ思想) ----
  let luckyColor,luckySeen,luckyTeachT,rbMsgT,stageMiss,sunWink,sunCD;
  const sunHit={x:0,y:0,r:0};   // ④ おひさま ひみつタップの当たり判定(描画と一致)
  const COLNAME={"#e85d75":"あか","#4aa6c0":"みずいろ","#7be08a":"みどり","#ffb347":"オレンジ","#b58bff":"むらさき","#ff7bd0":"ピンク","#5a9af0":"あお","#ffd23f":"きいろ"};
  // per-stage themes: grass/sky tints + road tone + accent. loops after last.
  const THEMES=[
    {name:"そうげん",g0:"#46905a",g1:"#3a7a3e",g2:"#2f6636",rd:"#54545e",acc:"#ffd23f"},
    {name:"さばく",  g0:"#e3b463",g1:"#cf9a47",g2:"#b07f34",rd:"#6b5e4a",acc:"#ff8c2c"},
    {name:"よる",    g0:"#26305a",g1:"#1c2546",g2:"#141a34",rd:"#3a3a48",acc:"#7be0ff"},
    {name:"ゆき",    g0:"#cfe6f2",g1:"#b6d6ec",g2:"#9cc3df",rd:"#6a7480",acc:"#9be0ff"},
    {name:"マグマ",  g0:"#7a2620",g1:"#5e1a16",g2:"#420f0d",rd:"#4a3030",acc:"#ff5a3c"}
  ];
  function theme(){return THEMES[(stage-1)%THEMES.length];}
  const LAST=THEMES.length; // finale stage number
  function layout(){
    roadW=clamp(api.W*0.74,260,560);roadX=(api.W-roadW)/2;lanes=4;laneW=roadW/lanes;
    if(!player){player={x:laneCx(1),tx:laneCx(1),lane:1,y:api.H*0.76,w:laneW*0.62,h:laneW*1.0,sq:0};}
    else{player.w=laneW*0.62;player.h=laneW*1.0;player.y=api.H*0.76;player.tx=laneCx(player.lane);}
    // ④ おひさま: 道の外(左の草地)の上空に置く=走行/よけには当たらない安全な位置
    sunHit.r=clamp(roadX*0.42,26,api.W*0.06);
    sunHit.x=Math.max(sunHit.r+8,roadX*0.5);
    sunHit.y=api.H*0.14;
  }
  function laneCx(i){return roadX+laneW*(i+0.5);}
  // 7〜8歳向けの手応え: ステージ目標 6→8台(以降 +2/面・上限+8)、ボスHP 3→4、出現間隔 少し短く
  function needFor(s){return 8+Math.min((s-1)*2,8);}
  const BOSS_HP=4;
  function reset(){enemies=[];sparks=[];shards=[];lines=[];floats=[];rings=[];dust=[];player=null;scroll=0;scrollSpd=4;count=0;combo=0;comboT=0;spawnT=0;boost=0;tick=0;flash=0;wash=0;
    stage=1;stageKills=0;stageNeed=needFor(1);clearT=0;clearMsg="";bannerCol="#ffd23f";finaleT=0;spin=0;boss=null;beat=0;
    luckyColor=pick(CARCOL);luckySeen=false;luckyTeachT=0;rbMsgT=0;stageMiss=0;sunWink=0;sunCD=0;
    motes=[];for(let i=0;i<18;i++)motes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(2,5),sp:rnd(0.3,1.1),ph:rnd(0,TAU),hue:pick(["#fff7c8","#ffd6f0","#cdeaff","#d7ffd0"])});
    clouds=[];for(let i=0;i<4;i++)clouds.push({x:rnd(0,api.W),y:rnd(0,api.H*0.9),r:rnd(40,80),sp:rnd(0.2,0.5)});
    layout();}
  function spawn(){
    if(clearT>0||finaleT>0||boss)return;
    // 得点0のあいだ(=まだ一度も当たっていない)は 完全ランダムをやめ 自機のレーン(±1)へ寄せる。
    // ただし出現地点だけ寄せても、上から降りてくる間(1〜2秒)に自機が何度もタップで動くため
    // 結局ズレて外れることを実測で確認した→ 加えて 降下中も自機へ ごく弱く寄っていく homing を
    // 得点0の間だけ付ける(frame側)ことで、最初の成功を安定して3秒以内に近づける(軸3)
    const earlyGame=(count===0);
    const lane=earlyGame?clamp(player.lane+rint(-1,1),0,lanes-1):rint(0,lanes-1);
    const w=laneW*0.62,h=laneW*1.0;
    // avoid stacking too close in same lane
    for(const e of enemies){if(e.lane===lane&&e.y<h*1.5)return;}
    // stage2以降、ごくまれに2車線ぶちの『ミニトラック』(HP2)を割り込ませる。ボス以外にも
    // 大きい/複数ヒットが要る的を用意する(軸7)。得点0のうちは出さない(軸1優先/最初の成功を邪魔しない)。
    if(!earlyGame&&stage>=2&&lanes>=2){
      if(rnd(0,1)<0.02){
        const mlane=Math.min(lane,lanes-2);
        let blocked=false;
        for(const e of enemies){if((e.lane===mlane||e.lane===mlane+1)&&e.y<laneW*2.2){blocked=true;break;}}
        if(!blocked){
          const mw=laneW*1.55,mh=laneW*1.5;
          enemies.push({x:roadX+laneW*(mlane+1),y:-mh,lane:mlane,w:mw,h:mh,color:"#4a6fa5",state:"drive",kind:"minitruck",vx:0,vy:0,rot:0,vr:0,ownSpd:0.1,hp:2,maxhp:2,hurt:0,sq:0});
          return;
        }
      }
    }
    // decide kind based on stage (gentle escalation of variety)
    const r=rnd(0,1);
    let kind="car";
    if(stage>=2&&r<0.045)kind="rainbow";          // ① 激レア にじいろカー(数%だけ・いつ来るか分からない)
    else if(stage>=2&&r<0.185)kind="coin";        // bonus coin car (stage2+)
    else if(stage>=2&&r<0.345)kind="cone";        // unbreakable obstacle (avoid)
    if(kind==="cone"){
      enemies.push({x:laneCx(lane),y:-h,lane,w:w*0.5,h:h*0.7,color:"#ff7a18",state:"drive",kind:"cone",vx:0,vy:0,rot:0,vr:0,ownSpd:0});
      return;
    }
    if(kind==="coin"){
      enemies.push({x:laneCx(lane),y:-h,lane,w,h,color:"#ffd23f",state:"drive",kind:"coin",vx:0,vy:0,rot:0,vr:0,ownSpd:rnd(-0.3,0.6)});
      return;
    }
    if(kind==="rainbow"){
      enemies.push({x:laneCx(lane),y:-h,lane,w,h,color:pick(CARCOL),state:"drive",kind:"rainbow",vx:0,vy:0,rot:0,vr:0,ownSpd:rnd(-0.3,0.5),shine:rnd(0,TAU)});
      return;
    }
    // ② 普通のcarを 幅高比の違う派生に振り分け(同じ矩形の色違いだけ、を脱する/軸7)
    const cv=rnd(0,1);
    if(cv<0.22){
      const tw=laneW*0.55,th=laneW*1.3;   // 荷台の長いトラック型(縦長)
      // ③ 得点0のあいだだけ 出現Yを浅く(助走距離を短縮)。count>=1の通常出現には触れない(軸3aの難度は不変)
      enemies.push({x:laneCx(lane),y:earlyGame?-th*0.55:-th,lane,w:tw,h:th,color:pick(CARCOL),state:"drive",kind:"truck",vx:0,vy:0,rot:0,vr:0,ownSpd:rnd(-0.5,0.6),homing:earlyGame});
      return;
    }
    if(cv<0.40){
      const bw=laneW*0.75,bh=laneW*0.85;  // 幅広バス型(横広)
      enemies.push({x:laneCx(lane),y:earlyGame?-bh*0.55:-bh,lane,w:bw,h:bh,color:pick(CARCOL),state:"drive",kind:"bus",vx:0,vy:0,rot:0,vr:0,ownSpd:rnd(-0.5,0.7),homing:earlyGame});
      return;
    }
    enemies.push({x:laneCx(lane),y:earlyGame?-h*0.55:-h,lane,w,h,color:pick(CARCOL),state:"drive",kind:"car",vx:0,vy:0,rot:0,vr:0,ownSpd:rnd(-0.6,0.8),homing:earlyGame});
  }
  function spawnBoss(){
    // giant trailer spanning two lanes; needs a few hits (7〜8歳向け: 4)
    const w=laneW*1.7,h=laneW*2.1;
    boss={x:roadX+roadW/2,y:-h,w,h,color:"#c0392b",state:"drive",kind:"boss",hp:BOSS_HP,maxhp:BOSS_HP,vx:0,vy:0,rot:0,sq:0,ownSpd:0.4,hurt:0};
  }
  function bumpCone(e){
    // hitting an unbreakable cone: gentle spin-out, combo lost (soft miss, not game over)
    if(e.state!=="drive")return;e.state="hit";
    e.vx=(e.x>=player.x?1:-1)*rnd(3,6);e.vy=rnd(-2,1);e.vr=rnd(-0.3,0.3);e.sq=1;
    combo=0;comboT=0;spin=Math.max(spin,0.9);player.sq=1;
    stageMiss++;   // ③ ノーミス判定: このステージで コーンにぶつかった回数
    api.shake(7);api.noise(0.2,0.25,500,"lowpass");api.slide(300,140,0.22,0.25,"sawtooth");
    for(let k=rint(4,6);k>0;k--)dust.push({x:player.x+rnd(-10,10),y:player.y+rnd(-6,6),vx:rnd(-1.4,1.4),vy:rnd(-1.6,-0.3),r:rnd(8,16),life:1,decay:rnd(0.015,0.03)});
  }
  function grabCoin(e){
    if(e.state!=="drive")return;e.state="hit";
    const dir=e.x>=player.x?1:-1;
    e.vx=dir*rnd(4,8);e.vy=rnd(-3,2);e.vr=dir*rnd(0.2,0.4);e.sq=1;
    count+=3;api.setScore(count);player.sq=1;flash=Math.min(flash+0.4,1);
    boost=Math.min(boost+0.3,1.4);
    api.tone(1320,0.08,"triangle",0.22);api.tone(1760,0.1,"triangle",0.16);
    for(let k=rint(10,14);k>0;k--){const a=rnd(0,TAU),s=rnd(3,9);
      sparks.push({x:e.x,y:e.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5),life:1,decay:rnd(0.02,0.04),col:pick(["#ffe23f","#fff7b0","#ffd23f"])});}
    floats.push({x:e.x,y:e.y-20,txt:"+3",life:1,vy:-1.3,col:"#ffd23f",size:36});
  }
  function minitruckHit(e){
    // ミニトラック: ボスと同じ考え方(hurtの一瞬だけ無敵)で 1接触=1ヒットに揃え、HP2で複数ヒットが要る的にする(軸7)
    if(e.state!=="drive"||e.hurt>0.001)return;
    e.hp--;e.hurt=1;e.sq=1;
    player.sq=1;flash=Math.min(flash+0.5,1);boost=Math.min(boost+0.35,1.4);
    api.slide(220,80,0.2,0.45,"square");api.noise(0.18,0.35,900,"lowpass");
    api.shake(10);api.hitStop(4);
    rings.push({x:e.x,y:e.y,r:e.w*0.45,life:1,decay:0.045,col:"#dfe8ff"});
    for(let k=rint(10,14);k>0;k--){const a=rnd(0,TAU),s=rnd(3,9);
      sparks.push({x:e.x,y:e.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5),life:1,decay:rnd(0.02,0.04),col:pick(["#dfe8ff","#fff","#9fc4ff"])});}
    for(let k=rint(3,5);k>0;k--)dust.push({x:e.x+rnd(-8,8),y:e.y+rnd(-8,8),vx:rnd(-1,1),vy:rnd(-1.6,-0.3),r:rnd(8,16),life:1,decay:rnd(0.015,0.03)});
    if(e.hp<=0){
      e.state="hit";
      const dir=e.x>=player.x?1:-1;
      e.vx=dir*rnd(5,9);e.vy=rnd(-3,2);e.vr=dir*rnd(0.2,0.4);
      count+=2;combo++;comboT=0.9;api.setScore(count);stageKills++;
      api.boom(0.4);api.shake(14);api.hitStop(5);
      for(let k=rint(6,9);k>0;k--)shards.push({x:e.x,y:e.y,vx:rnd(-6,6),vy:rnd(-6,2),s:rnd(5,10),color:e.color,rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:0.012});
      floats.push({x:e.x,y:e.y-24,txt:"+2",life:1,vy:-1.2,col:"#dfe8ff",size:32});
      if(stageKills>=stageNeed&&clearT<=0&&!boss&&finaleT<=0){
        if(stage===LAST){spawnBoss();}else clearStage();
      }
    }else{
      floats.push({x:e.x,y:e.y-24,txt:"あと"+e.hp+"！",life:1,vy:-1.2,col:"#fff",size:28});
    }
  }
  function smash(e){
    if(e.state!=="drive")return;
    if(e.kind==="cone"){bumpCone(e);return;}
    if(e.kind==="coin"){grabCoin(e);return;}
    if(e.kind==="minitruck"){minitruckHit(e);return;}
    e.state="hit";
    const dir=e.x>=player.x?1:-1;
    e.vx=dir*rnd(7,12);e.vy=rnd(-3,3);e.vr=dir*rnd(0.25,0.5);e.sq=1;
    const isRainbow=e.kind==="rainbow";
    const isLucky=!isRainbow&&e.color===luckyColor;   // ② きょうのラッキー色を つぶすと +1
    let gain=isRainbow?7:1;
    if(isLucky){gain+=1;if(!luckySeen){luckySeen=true;luckyTeachT=2.4;}}
    count+=gain;combo++;comboT=0.9;api.setScore(count);
    stageKills++;
    boost=Math.min(boost+0.4,1.4);
    player.sq=1;flash=Math.min(flash+0.55,1);
    // climax color-wash on big combos
    if(combo>=4)wash=Math.min(wash+0.8,1);
    api.slide(260,90,0.18,0.4,"square");api.noise(0.16,0.3,1200,"lowpass");
    api.tone(combo>=4?880:660,0.07,"triangle",0.18);
    api.shake(6+Math.min(combo*1.4,16));
    api.hitStop(combo>=4?4:3);
    // expanding shockwave ring
    rings.push({x:e.x,y:e.y,r:e.w*0.4,life:1,decay:0.05,col:combo>=4?"#fff2a8":"#ffffff"});
    // bright spark burst
    for(let k=rint(12,17);k>0;k--){const a=rnd(0,TAU),s=rnd(3,10);
      sparks.push({x:e.x,y:e.y+e.h*0.3*dir,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5),life:1,decay:rnd(0.02,0.04),col:pick(["#ffd23f","#ff8c2c","#fff","#fff4c0"])});}
    // smoke puffs
    for(let k=rint(3,5);k>0;k--)dust.push({x:e.x+rnd(-8,8),y:e.y+rnd(-8,8),vx:rnd(-1,1),vy:rnd(-1.6,-0.3),r:rnd(8,16),life:1,decay:rnd(0.015,0.03)});
    for(let k=rint(4,7);k>0;k--)shards.push({x:e.x,y:e.y,vx:dir*rnd(2,7),vy:rnd(-6,2),s:rnd(4,9),color:e.color,rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:0.015});
    if(combo>1)floats.push({x:e.x,y:e.y-20,txt:"x"+combo,life:1,vy:-1.2,col:combo>=8?"#ff3b3b":combo>=4?"#ff8c42":"#ffd23f",size:combo>=5?44:30});
    // ① にじいろカー / ② ラッキー色 の特別演出
    if(isRainbow)rainbowBurst(e);
    else if(isLucky)luckySparkle(e);
    // stage clear check
    if(stageKills>=stageNeed&&clearT<=0&&!boss&&finaleT<=0){
      // on the last theme stage, spawn the BOSS trailer instead of clearing
      if(stage===LAST){spawnBoss();}
      else clearStage();
    }
  }
  function clearStage(){
    clearT=2.0;clearMsg="ステージ "+stage+" クリア！";bannerCol=theme().acc;
    api.boom(0.5);api.shake(14);api.hitStop(6);
    fanfare();
    // ③ ノーミス ボーナス: このステージで一度も コーンにぶつからず走り切ったら +3 & みどりの祝福
    if(stageMiss===0){count+=3;api.setScore(count);
      floats.push({x:api.W/2,y:api.H*0.56,txt:"ノーミス ボーナス！＋３",life:1.5,vy:-0.5,col:"#7be08a",size:28});
      api.tone(1318,0.14,"triangle",0.1);api.tone(1976,0.16,"triangle",0.07);}
    // burst of confetti shards across the road
    for(let k=0;k<40;k++)shards.push({x:rnd(roadX,roadX+roadW),y:rnd(-20,api.H*0.4),vx:rnd(-3,3),vy:rnd(-2,4),s:rnd(5,11),color:pick(CARCOL),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:0.01});
    for(let k=0;k<3;k++)rings.push({x:player.x,y:player.y,r:20+k*30,life:1,decay:0.04,col:theme().acc});
  }
  function fanfare(){
    api.tone(523,0.1,"triangle",0.2);
    api.tone(659,0.1,"triangle",0.18);
    api.tone(784,0.14,"triangle",0.2);
    api.slide(784,1046,0.2,0.16,"triangle");
  }
  function rainbowBurst(e){
    // ① にじいろカー撃破: 虹の輪＋虹色スパーク＋大量得点(激レアの爽快ごほうび)
    rbMsgT=1.5;wash=Math.min(wash+1.0,1.4);
    api.tone(880,0.12,"triangle",0.12);api.tone(1320,0.14,"triangle",0.1);api.tone(1760,0.16,"triangle",0.08);
    api.slide(660,1320,0.3,0.2,"triangle");
    for(let k=0;k<CARCOL.length;k++)rings.push({x:e.x,y:e.y,r:e.w*0.4,life:1,decay:0.045,col:CARCOL[k]});
    for(let i=0;i<28;i++){const a=rnd(0,TAU),s=rnd(3,11);
      sparks.push({x:e.x,y:e.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(3,6),life:1,decay:rnd(0.015,0.03),col:CARCOL[i%CARCOL.length]});}
    for(let k=rint(10,14);k>0;k--)shards.push({x:e.x,y:e.y,vx:rnd(-8,8),vy:rnd(-8,2),s:rnd(6,12),color:pick(CARCOL),rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:0.01});
    floats.push({x:e.x,y:e.y-26,txt:"にじいろ！",life:1,vy:-1,col:"#fff",size:38});
    if(sparks.length>220)sparks.splice(0,sparks.length-220);
  }
  function luckySparkle(e){
    // ② ラッキー色命中: 小さめの祝福(白飛びしないよう控えめ)
    api.tone(1046,0.1,"triangle",0.12);api.tone(1568,0.12,"triangle",0.08);
    floats.push({x:e.x,y:e.y-38,txt:"ラッキー！",life:1,vy:-1,col:luckyColor,size:28});
    for(let i=0;i<8;i++){const a=rnd(0,TAU),s=rnd(2,6);
      sparks.push({x:e.x,y:e.y-e.h*0.3,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,r:rnd(2,4),life:1,decay:rnd(0.02,0.035),col:luckyColor});}
  }
  function bossHit(){
    if(boss.state!=="drive"||boss.hurt>0.001)return; // hurt-flash = brief invuln so each touch = ONE hit (not 3/frame)
    boss.hp--;boss.hurt=1;boss.sq=1;count++;stageKills++;api.setScore(count);
    player.sq=1;flash=Math.min(flash+0.6,1);boost=Math.min(boost+0.4,1.4);
    api.boom(0.45);api.shake(16);api.hitStop(5);
    api.slide(200,70,0.22,0.5,"square");api.noise(0.22,0.4,800,"lowpass");
    rings.push({x:boss.x,y:boss.y,r:boss.w*0.5,life:1,decay:0.045,col:"#fff2a8"});
    for(let k=rint(16,22);k>0;k--){const a=rnd(0,TAU),s=rnd(4,12);
      sparks.push({x:boss.x,y:boss.y+rnd(-boss.h*0.3,boss.h*0.3),vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,6),life:1,decay:rnd(0.02,0.04),col:pick(["#ffd23f","#ff8c2c","#fff","#fff4c0"])});}
    for(let k=rint(6,9);k>0;k--)shards.push({x:boss.x,y:boss.y,vx:rnd(-7,7),vy:rnd(-7,3),s:rnd(5,11),color:boss.color,rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:0.012});
    if(boss.hp<=0){
      // boss destroyed -> finale celebration
      boss.state="hit";boss.vy=8;boss.vr=0.1;
      finaleT=2.6;wash=1.4;api.boom(0.7);api.shake(22);api.hitStop(8);fanfare();
      // ③ 最終ステージも ノーミス(コーン無事故)なら ボーナス
      if(stageMiss===0){count+=3;api.setScore(count);
        floats.push({x:api.W/2,y:api.H*0.58,txt:"ノーミス ボーナス！＋３",life:1.6,vy:-0.4,col:"#7be08a",size:28});}
      for(let k=0;k<70;k++)shards.push({x:rnd(0,api.W),y:rnd(-30,api.H*0.5),vx:rnd(-4,4),vy:rnd(-2,5),s:rnd(5,13),color:pick(CARCOL),rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:0.008});
    }else{
      floats.push({x:boss.x,y:boss.y-30,txt:"あと"+boss.hp+"！",life:1,vy:-1.2,col:"#fff",size:38});
    }
  }
  reset();
  return{
    resize:layout,
    input(px,py,type){
      if(type!=="down")return;
      // ④ おひさま ひみつタップ: 太陽に触れたら ウインク＋金コインがこぼれる(ハンドルはそのまま/減点なし)
      // クールダウンあり=連打で量産できない ちょっとした発見のごほうび
      if(sunCD<=0&&sunHit.r>0&&Math.hypot(px-sunHit.x,py-sunHit.y)<sunHit.r){
        sunWink=1;sunCD=180;
        api.tone(1318,0.1,"triangle",0.09);api.tone(1760,0.12,"triangle",0.07);
        for(let i=0;i<8;i++){const a=rnd(-TAU*0.5,0.2),s=rnd(3,7);
          sparks.push({x:sunHit.x,y:sunHit.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(3,6),life:1,decay:rnd(0.015,0.03),col:pick(["#ffe23f","#fff0a0","#ffd23f"])});}
        count+=1;api.setScore(count);
        floats.push({x:sunHit.x,y:sunHit.y-sunHit.r,txt:"+1",life:1,vy:-1,col:"#ffd23f",size:24});
      }
      if(px<api.W/2)player.lane=clamp(player.lane-1,0,lanes-1);
      else player.lane=clamp(player.lane+1,0,lanes-1);
      player.tx=laneCx(player.lane);
      api.tone(220,0.05,"square",0.05);
    },
    frame(dt,now){
      tick+=dt;beat+=dt;
      if(sunCD>0)sunCD-=dt;
      if(sunWink>0){sunWink-=0.02*dt;if(sunWink<0)sunWink=0;}
      const TH=theme();
      // spin-out: player briefly stunned (no speed gain), eases out
      if(spin>0){spin=Math.max(0,spin-0.012*dt);}
      const stunned=spin>0;
      // stage difficulty nudges speed up a touch each stage
      scrollSpd=4+Math.min(count*0.05,5)+boost*8+(stage-1)*0.65+(count===0?2.5:0);
      if(stunned)scrollSpd*=0.55;
      boost*=Math.pow(0.95,dt);
      scroll+=scrollSpd*dt;
      // clear / finale timers
      if(clearT>0){clearT-=0.016*dt;if(clearT<=0){stage++;stageKills=0;stageNeed=needFor(stage);stageMiss=0;enemies=enemies.filter(e=>e.state!=="drive");}}
      if(finaleT>0){finaleT-=0.016*dt;if(finaleT<=0){stage=1;stageKills=0;stageNeed=needFor(1);stageMiss=0;boss=null;count=0;api.setScore(0);enemies=[];luckyColor=pick(CARCOL);luckySeen=false;}}
      // grass/ground: 画像背景(真上から見た草原)があればそれを敷き、ステージのテーマ色を薄く重ねる。
      // 1面(そうげん)は絵のまま。無ければ従来のテーマ縦グラデ。
      imgBg=api.drawCover("bg.jpg");
      if(imgBg){
        const ti=(stage-1)%THEMES.length;
        if(ti!==0){g.save();g.globalAlpha=ti===2?0.55:0.34;   // よる は少し濃く
          let tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,TH.g0);tg.addColorStop(0.5,TH.g1);tg.addColorStop(1,TH.g2);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        let gg=g.createLinearGradient(0,0,0,api.H);
        gg.addColorStop(0,TH.g0);gg.addColorStop(0.5,TH.g1);gg.addColorStop(1,TH.g2);
        g.fillStyle=gg;g.fillRect(0,0,api.W,api.H);
      }
      // ambient drifting clouds (soft, over grass) ※画像背景のときは絵と喧嘩するので描かない
      if(!imgBg) for(const c of clouds){c.y+=c.sp*dt;if(c.y-c.r>api.H){c.y=-c.r;c.x=rnd(0,api.W);}
        g.globalAlpha=0.10;g.fillStyle="#ffffff";
        g.beginPath();g.arc(c.x,c.y,c.r,0,TAU);g.arc(c.x+c.r*0.7,c.y+c.r*0.2,c.r*0.7,0,TAU);g.arc(c.x-c.r*0.6,c.y+c.r*0.15,c.r*0.6,0,TAU);g.fill();}
      g.globalAlpha=1;
      // ④ おひさま(ひみつタップ対象): 左の草地の上空に。走行の邪魔にならない
      drawSun();
      // roadside hedges (scrolling) ※画像背景のときは絵の木々を活かして描かない
      if(!imgBg){g.fillStyle="#2c6233";for(let i=0;i<6;i++){const yy=((i*120 - scroll*0.5)%(api.H+120)+api.H+120)%(api.H+120);
        g.beginPath();g.ellipse(roadX-roadW*0.09,yy+30,roadW*0.05,32,0,0,TAU);g.fill();
        g.beginPath();g.ellipse(roadX+roadW+roadW*0.09,yy+70,roadW*0.05,32,0,0,TAU);g.fill();}}
      // 画像背景のとき: 道の両脇に柔らかい影を落として道が絵から浮かないようにする(ゲーム要素の道は残す)
      if(imgBg){g.save();g.globalAlpha=0.28;g.fillStyle="#000";
        g.fillRect(roadX-10,0,10,api.H);g.fillRect(roadX+roadW,0,10,api.H);g.restore();}
      // road with subtle sheen gradient (theme-tinted)
      let rg=g.createLinearGradient(roadX,0,roadX+roadW,0);
      rg.addColorStop(0,shadeC(TH.rd,-22));rg.addColorStop(0.5,TH.rd);rg.addColorStop(1,shadeC(TH.rd,-22));
      g.fillStyle=rg;g.fillRect(roadX,0,roadW,api.H);
      // glowing curbs
      g.save();g.shadowColor="rgba(255,255,255,.6)";g.shadowBlur=10;
      g.fillStyle="#f2f2f6";g.fillRect(roadX-4,0,5,api.H);g.fillRect(roadX+roadW-1,0,5,api.H);g.restore();
      // lane dashes with glow
      g.save();g.shadowColor="rgba(255,255,255,.5)";g.shadowBlur=6;
      g.fillStyle="rgba(255,255,255,.78)";const dash=40,off=scroll%(dash*2);
      for(let l=1;l<lanes;l++){const lx=roadX+laneW*l-3;
        for(let y=-dash*2;y<api.H+dash;y+=dash*2)g.fillRect(lx,y+off,6,dash);}
      g.restore();
      // speed lines when boosting (streaks)
      if(boost>0.2||scrollSpd>7){const al=Math.min(0.12+boost*0.25,0.4);
        g.strokeStyle="rgba(255,255,255,"+al+")";g.lineWidth=3;g.lineCap="round";
        for(let i=0;i<8;i++){const lx=roadX+rnd(8,roadW-8),ly=rnd(0,api.H);g.beginPath();g.moveTo(lx,ly);g.lineTo(lx,ly+rnd(40,90));g.stroke();}
        g.lineCap="butt";}
      // player ease
      player.x+=(player.tx-player.x)*0.25*dt;
      if(player.sq>0)player.sq=Math.max(0,player.sq-0.08*dt);
      if(flash>0)flash=Math.max(0,flash-0.08*dt);
      if(wash>0)wash=Math.max(0,wash-0.04*dt);
      // ambient floating light motes (glow, additive)
      g.save();g.globalCompositeOperation="lighter";
      for(const m of motes){m.y+=(m.sp+scrollSpd*0.15)*dt;m.x+=Math.sin(tick*0.04+m.ph)*0.4*dt;
        if(m.y>api.H+6){m.y=-6;m.x=rnd(0,api.W);}
        const tw=0.35+0.3*Math.sin(tick*0.08+m.ph);
        g.globalAlpha=tw;g.fillStyle=m.hue;g.shadowColor=m.hue;g.shadowBlur=8;
        g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      // enemies
      spawnT-=dt;if(spawnT<=0){spawn();spawnT=clamp(30-count*0.1-(stage-1)*1.8,12,30);}
      for(const e of enemies){
        if(e.state==="drive"){e.y+=(scrollSpd*0.6+e.ownSpd)*dt;
          if(e.hurt>0)e.hurt=Math.max(0,e.hurt-0.06*dt);   // ミニトラックのヒット無敵(未定義の他kindには影響なし)
          if(e.sq>0)e.sq=Math.max(0,e.sq-0.08*dt);
          // ③ 得点0のあいだだけ ごく弱く自機へ寄っていく(降下中に自機がタップで動いても最初の成功を逃さない/軸3)
          if(e.homing&&count===0)e.x+=(player.x-e.x)*0.08*dt;
          // collide with player (not while spinning out)
          if(!stunned&&Math.abs(e.x-player.x)<(e.w+player.w)/2-6 && Math.abs(e.y-player.y)<(e.h+player.h)/2-8) smash(e);
        }else{e.x+=e.vx*dt;e.y+=(e.vy+scrollSpd*0.4)*dt;e.rot+=e.vr*dt;e.vx*=0.99;if(e.sq>0)e.sq=Math.max(0,e.sq-0.06*dt);}
      }
      enemies=enemies.filter(e=>e.y<api.H+e.h*2&&e.x>-e.w*3&&e.x<api.W+e.w*3);
      // BOSS update
      if(boss){
        if(boss.hurt>0)boss.hurt=Math.max(0,boss.hurt-0.06*dt);
        if(boss.sq>0)boss.sq=Math.max(0,boss.sq-0.04*dt);
        if(boss.state==="drive"){
          if(boss.y<api.H*0.34)boss.y+=(scrollSpd*0.45+boss.ownSpd)*dt; // roll in then hold
          else boss.x=roadX+roadW/2+Math.sin(beat*0.03)*roadW*0.18; // weave side to side
          if(!stunned&&Math.abs(boss.x-player.x)<(boss.w+player.w)/2-10 && Math.abs(boss.y-player.y)<(boss.h+player.h)/2-10) bossHit();
        }else{boss.y+=(boss.vy+scrollSpd*0.4)*dt;boss.rot+=boss.vr*dt;if(boss.y>api.H+boss.h*1.5)boss=null;}
      }
      // smoke puffs (behind cars)
      for(const d of dust){d.x+=d.vx*dt;d.y+=d.vy*dt;d.r+=0.6*dt;d.life-=d.decay*dt;
        g.globalAlpha=Math.max(0,d.life)*0.5;g.fillStyle="#dcdce2";g.beginPath();g.arc(d.x,d.y,d.r,0,TAU);g.fill();}
      g.globalAlpha=1;dust=dust.filter(d=>d.life>0);
      // draw enemies then boss then player
      for(const e of enemies){
        if(e.kind==="cone")drawCone(e.x,e.y,e.w,e.h,e.rot||0);
        else if(e.kind==="coin")drawCoin(e.x,e.y,e.w,e.h,e.rot||0,e.sq||0);
        else if(e.kind==="rainbow")drawRainbowCar(e);
        else if(e.kind==="minitruck")drawMiniTruck(e);
        else{
          if(e.kind==="truck")drawTruckCar(e.x,e.y,e.w,e.h,e.color,e.rot,e.sq||0);
          else if(e.kind==="bus")drawBusCar(e.x,e.y,e.w,e.h,e.color,e.rot,e.sq||0);
          else drawCar(e.x,e.y,e.w,e.h,e.color,e.rot,false,e.sq||0);
          // ② ラッキー色の車には頭上に小さな星のキラッ(気づけるヒント。トラック/バスにも適用)
          if(e.state==="drive"&&e.color===luckyColor)drawLuckyStar(e);
        }
      }
      if(boss)drawBoss(boss);
      drawPlayer(player.x,player.y,player.w,player.h,player.sq||0);
      // shockwave rings
      for(const ri of rings){ri.r+=4.5*dt;ri.life-=ri.decay*dt;
        g.globalAlpha=Math.max(0,ri.life)*0.8;g.strokeStyle=ri.col;g.lineWidth=Math.max(1,4*ri.life);
        g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();}
      g.globalAlpha=1;g.lineWidth=1;rings=rings.filter(ri=>ri.life>0);
      // sparks (glowing)
      g.save();g.globalCompositeOperation="lighter";
      for(const s of sparks){s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=0.95;s.vy*=0.95;s.life-=s.decay*dt;
        g.globalAlpha=Math.max(0,s.life);g.fillStyle=s.col;g.shadowColor=s.col;g.shadowBlur=8;
        g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;sparks=sparks.filter(s=>s.life>0);
      // shards
      for(const p of shards){p.vy+=0.3*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);g.fillStyle=p.color;g.fillRect(-p.s/2,-p.s/2,p.s,p.s);g.restore();}
      shards=shards.filter(p=>p.life>0);
      // combo decay + floats
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.016*dt;g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,f.x,f.y);g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // impact flash overlay
      if(flash>0.01){g.fillStyle="rgba(255,255,255,"+(flash*0.22)+")";g.fillRect(0,0,api.W,api.H);}
      // climax color-wash (big-combo full-screen tint with vignette burst)
      if(wash>0.01){
        g.save();g.globalCompositeOperation="lighter";
        let wg=g.createRadialGradient(player.x,player.y,0,player.x,player.y,api.H*0.9);
        const wcol=combo>=8?"255,80,120":combo>=6?"255,150,60":"120,220,255";
        wg.addColorStop(0,"rgba("+wcol+","+(wash*0.5)+")");
        wg.addColorStop(0.55,"rgba("+wcol+","+(wash*0.18)+")");
        wg.addColorStop(1,"rgba("+wcol+",0)");
        g.fillStyle=wg;g.fillRect(0,0,api.W,api.H);g.restore();
      }
      // spin-out dizzy stars overlay on the player
      if(spin>0){g.save();g.globalAlpha=Math.min(1,spin);g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        for(let i=0;i<3;i++){const a=beat*0.12+i*TAU/3,sx=player.x+Math.cos(a)*22,sy=player.y-player.h*0.55+Math.sin(a)*8;
          g.fillStyle="#ffe23f";g.fillText("*",sx,sy);}g.restore();g.textAlign="left";}
      // stage progress + mini-goal HUD (top)
      drawStageHud();
      // cute HUD hint panel (rounded, translucent, glowing border)
      drawHud();
      // stage-clear banner
      if(clearT>0)drawBanner(clearMsg,clearT,bannerCol);
      // ① にじいろカー 接近予告: レアが上のほうを走っていたら 中央上に脈打つ虹シェブロン(ドキドキ)
      if(rbMsgT<=0&&enemies.some(e=>e.kind==="rainbow"&&e.state==="drive"&&e.y<api.H*0.34)){
        const pulse=0.5+0.5*Math.sin(tick*0.25),yy=api.H*0.1;
        g.save();g.globalAlpha=0.45+0.4*pulse;g.lineWidth=5;g.lineCap="round";g.lineJoin="round";
        for(let k=0;k<3;k++){g.strokeStyle=["#ff5da2","#ffd23f","#5ad1ff"][k];
          const oy=yy+k*11;g.beginPath();g.moveTo(api.W/2-14,oy);g.lineTo(api.W/2,oy+12);g.lineTo(api.W/2+14,oy);g.stroke();}
        g.restore();g.globalAlpha=1;g.lineCap="butt";}
      // ① にじいろカー！ 中央バナー(虹色に色替わり=レアの大きな祝福)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=CARCOL[Math.floor(tick*0.15)%CARCOL.length];
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 38px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("にじいろカー！",0,0);
        g.fillStyle=col;g.fillText("にじいろカー！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央の小ヒント(初回だけ一度おしえる)
      if(luckyTeachT>0){luckyTeachT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.28);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyTeachT*1.2,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const txt="きょうのラッキー色は "+(COLNAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(txt,0,0);
        g.fillStyle=luckyColor;g.fillText(txt,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyTeachT<0)luckyTeachT=0;}
      // finale: full-screen celebration
      if(finaleT>0)drawFinale(finaleT);
      // 白飛び対策: 加算合成が次フレームへ漏れないよう明示的に戻す
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
    }
  };
  function drawStageHud(){
    g.save();
    const TH=theme();
    const label=(stage>=LAST?"さいしゅう ステージ "+stage+" ("+TH.name+")":"ステージ "+stage+" ("+TH.name+")");
    g.textBaseline="middle";
    // label centered on top (engine HUDと衝突しない安全帯)
    g.font="800 14px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
    g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(label,api.W/2,14);
    g.fillStyle="#fff7d6";g.fillText(label,api.W/2,14);
    // mini-goal progress bar + goal text, centered as one unit below the label
    const goal=(boss?"ボスを たおせ！":"あと "+Math.max(0,stageNeed-stageKills)+"だい！");
    g.font="800 12px 'Hiragino Maru Gothic ProN',system-ui";
    const gm=g.measureText(goal),gw=(gm&&gm.width)||goal.length*12;
    const bw=Math.min(api.W*0.42,160),bh=10,gap=8,totalW=bw+gap+gw,bx=api.W/2-totalW/2,byy=28;
    g.fillStyle="rgba(0,0,0,.35)";roundRect(bx,byy,bw,bh,5);g.fill();
    const prog=boss?(boss.maxhp-boss.hp)/boss.maxhp:clamp(stageKills/stageNeed,0,1);
    g.fillStyle=boss?"#ff6a4a":TH.acc;roundRect(bx,byy,Math.max(6,bw*prog),bh,5);g.fill();
    g.textAlign="left";
    g.lineWidth=3;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(goal,bx+bw+gap,byy+bh/2);
    g.fillStyle="#fff";g.fillText(goal,bx+bw+gap,byy+bh/2);
    g.restore();g.textAlign="left";g.textBaseline="alphabetic";
  }
  function drawBanner(msg,t,col){
    g.save();
    const a=Math.min(1,t*1.4),cy=api.H*0.4;
    g.globalAlpha=a;
    // checkered flag strips
    const sq=20;for(let row=0;row<2;row++)for(let c=0;c<Math.ceil(api.W/sq);c++){
      g.fillStyle=((c+row)%2===0)?"#111":"#fff";g.fillRect(c*sq,cy-44+row*sq,sq,sq);
      g.fillStyle=((c+row)%2===0)?"#111":"#fff";g.fillRect(c*sq,cy+24+row*sq,sq,sq);}
    const pop=1+0.12*Math.sin(t*8);
    g.translate(api.W/2,cy+10);g.scale(pop,pop);
    g.font="900 40px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
    g.lineWidth=10;g.strokeStyle="rgba(0,0,0,.6)";g.strokeText(msg,0,0);
    g.fillStyle=col;g.fillText(msg,0,0);
    g.restore();g.textAlign="left";g.textBaseline="alphabetic";g.globalAlpha=1;
  }
  function drawFinale(t){
    g.save();
    const a=Math.min(1,t);
    // warm radiant glow
    g.globalCompositeOperation="lighter";
    let fg=g.createRadialGradient(api.W/2,api.H/2,0,api.W/2,api.H/2,api.H);
    fg.addColorStop(0,"rgba(255,210,80,"+(a*0.5)+")");fg.addColorStop(0.6,"rgba(255,120,60,"+(a*0.2)+")");fg.addColorStop(1,"rgba(255,120,60,0)");
    g.fillStyle=fg;g.fillRect(0,0,api.W,api.H);
    g.restore();
    g.save();g.globalAlpha=a;
    const pop=1+0.1*Math.sin(t*7);
    g.translate(api.W/2,api.H*0.42);g.scale(pop,pop);
    g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
    g.lineWidth=12;g.strokeStyle="rgba(0,0,0,.6)";g.strokeText("ぜんステージ クリア！",0,0);
    g.fillStyle="#fff200";g.fillText("ぜんステージ クリア！",0,0);
    g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
    g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.6)";g.strokeText("また はじめから あそべるよ！",0,42);
    g.fillStyle="#fff";g.fillText("また はじめから あそべるよ！",0,42);
    g.restore();g.textAlign="left";g.textBaseline="alphabetic";g.globalAlpha=1;
  }
  function drawHud(){
    g.save();
    const cx=api.W/2, by=api.H-14, fs=15, txt="ひだり/みぎ タップで よせて たいあたり！";
    g.font="800 "+fs+"px 'Hiragino Maru Gothic ProN',system-ui";
    const tm=g.measureText(txt), tw=(tm&&tm.width)||txt.length*fs*0.6, pw=tw+34, ph=fs+18, px=cx-pw/2, py=by-ph+4;
    // soft drop shadow + glow border
    g.shadowColor="rgba(0,0,0,.3)";g.shadowBlur=10;g.shadowOffsetY=3;
    g.fillStyle="rgba(60,40,90,.62)";roundRect(px,py,pw,ph,ph/2);g.fill();
    g.shadowColor="transparent";g.shadowBlur=0;g.shadowOffsetY=0;
    g.lineWidth=3;g.strokeStyle="rgba(255,225,120,.9)";roundRect(px,py,pw,ph,ph/2);g.stroke();
    // gentle pulse so it never feels static
    const pulse=0.85+0.15*Math.sin(tick*0.07);
    g.globalAlpha=pulse;g.textAlign="center";g.textBaseline="middle";
    g.lineWidth=4;g.strokeStyle="rgba(90,50,30,.65)";g.strokeText(txt,cx,py+ph/2+1);
    g.fillStyle="#fff7d6";g.fillText(txt,cx,py+ph/2+1);
    g.restore();g.textAlign="left";g.textBaseline="alphabetic";g.globalAlpha=1;
  }
  function drawPlayer(x,y,w,h,sq){
    sq=sq||0;
    const sx=1+sq*0.28,sy=1-sq*0.22;w=w*sx;h=h*sy;
    g.save();g.translate(x,y);
    // bright under-glow halo so the hero car always pops
    g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.5+0.25*Math.sin(tick*0.1);
    let hg=g.createRadialGradient(0,0,0,0,0,w*0.95);
    hg.addColorStop(0,"rgba(120,235,255,.6)");hg.addColorStop(1,"rgba(120,235,255,0)");
    g.fillStyle=hg;g.beginPath();g.arc(0,0,w*0.95,0,TAU);g.fill();g.restore();
    // 画像プレイヤー(真上から・前が上): 当たり判定 w×h に外形を合わせて(1.18倍=主役なので少し大きめ)center 描画。
    // 影とヘッドライトの光だけ重ねる(顔・ボディは絵に任せる)
    if(api.asset("player.png").ready){
      g.fillStyle="rgba(0,0,0,.25)";g.beginPath();g.ellipse(0,h*0.08,Math.max(0,w*0.55),Math.max(0,h*0.5),0,0,TAU);g.fill();
      drawFit("player.png",SPR.player,0,0,w,h,1.18);
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.5;
      const lg=g.createRadialGradient(0,-h*0.5,0,0,-h*0.5,Math.max(0,w*0.45));
      lg.addColorStop(0,"rgba(255,245,180,.8)");lg.addColorStop(1,"rgba(255,245,180,0)");
      g.fillStyle=lg;g.beginPath();g.arc(0,-h*0.5,Math.max(0,w*0.45),0,TAU);g.fill();g.restore();
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
      g.restore();return;
    }
    // drop shadow
    g.save();g.shadowColor="rgba(0,0,0,.35)";g.shadowBlur=10;g.shadowOffsetY=4;
    g.fillStyle="rgba(0,0,0,.3)";roundRect(-w/2,-h/2,w,h,11);g.fill();g.restore();
    // rear wing (distinct silhouette vs enemies)
    g.fillStyle="#1b9bd6";roundRect(-w*0.5,h*0.4,w,h*0.12,4);g.fill();
    // chunky cyan/white body with sheen
    let bg=g.createLinearGradient(-w/2,0,w/2,0);
    bg.addColorStop(0,"#1f9fe0");bg.addColorStop(0.5,"#7fe0ff");bg.addColorStop(1,"#1f9fe0");
    g.fillStyle=bg;roundRect(-w/2,-h/2,w,h,11);g.fill();
    // white racing stripe down the middle
    g.fillStyle="rgba(255,255,255,.9)";roundRect(-w*0.13,-h/2,w*0.26,h,4);g.fill();
    // headlights glow
    g.save();g.shadowColor="rgba(255,245,180,.9)";g.shadowBlur=12;g.fillStyle="#fff6c8";
    g.beginPath();g.arc(-w*0.3,-h*0.46,3.4,0,TAU);g.arc(w*0.3,-h*0.46,3.4,0,TAU);g.fill();g.restore();
    // big friendly windshield = face area
    g.fillStyle="#dff4ff";roundRect(-w*0.32,-h*0.34,w*0.64,h*0.3,7);g.fill();
    // eyes
    g.fillStyle="#1c2740";const ey=-h*0.22,ex=w*0.15,er=Math.max(2.2,w*0.072);
    g.beginPath();g.arc(-ex,ey,er,0,TAU);g.arc(ex,ey,er,0,TAU);g.fill();
    g.fillStyle="#fff";g.beginPath();g.arc(-ex+er*0.4,ey-er*0.4,er*0.4,0,TAU);g.arc(ex+er*0.4,ey-er*0.4,er*0.4,0,TAU);g.fill();
    // smile (squashes into open "wow" on impact)
    g.strokeStyle="#1c2740";g.lineWidth=Math.max(2,w*0.05);g.lineCap="round";
    g.beginPath();g.arc(0,-h*0.12,w*0.16,0.15*Math.PI,0.85*Math.PI);g.stroke();g.lineCap="butt";
    // rosy cheeks
    g.fillStyle="rgba(255,120,140,.5)";g.beginPath();g.arc(-w*0.27,-h*0.13,w*0.06,0,TAU);g.arc(w*0.27,-h*0.13,w*0.06,0,TAU);g.fill();
    // taillights
    g.fillStyle="rgba(255,60,60,.85)";g.beginPath();g.arc(-w*0.3,h*0.46,2.6,0,TAU);g.arc(w*0.3,h*0.46,2.6,0,TAU);g.fill();
    // wheels
    g.fillStyle="#16161c";g.fillRect(-w*0.5-3,-h*0.32,5,h*0.2);g.fillRect(w*0.5-2,-h*0.32,5,h*0.2);
    g.fillRect(-w*0.5-3,h*0.12,5,h*0.2);g.fillRect(w*0.5-2,h*0.12,5,h*0.2);
    g.restore();
  }
  function drawCar(x,y,w,h,color,rot,isPlayer,sq){
    sq=sq||0;
    // squash&stretch: wider+shorter on impact
    const sx=1+sq*0.28,sy=1-sq*0.22;w=w*sx;h=h*sy;
    g.save();g.translate(x,y);g.rotate(rot);
    // soft drop shadow
    g.save();g.shadowColor="rgba(0,0,0,.35)";g.shadowBlur=10;g.shadowOffsetY=4;
    g.fillStyle="rgba(0,0,0,.3)";roundRect(-w/2,-h/2,w,h,9);g.fill();g.restore();
    // body with vertical sheen gradient
    let bg=g.createLinearGradient(-w/2,0,w/2,0);
    bg.addColorStop(0,shadeC(color,-26));bg.addColorStop(0.5,shadeC(color,18));bg.addColorStop(1,shadeC(color,-26));
    g.fillStyle=bg;roundRect(-w/2,-h/2,w,h,9);g.fill();
    // headlights (front glow) for player
    if(isPlayer){g.save();g.shadowColor="rgba(255,245,180,.9)";g.shadowBlur=12;g.fillStyle="#fff6c8";
      g.beginPath();g.arc(-w*0.28,-h*0.46,3.2,0,TAU);g.arc(w*0.28,-h*0.46,3.2,0,TAU);g.fill();g.restore();}
    // taillights
    g.fillStyle="rgba(255,60,60,.85)";g.beginPath();g.arc(-w*0.3,h*0.46,2.6,0,TAU);g.arc(w*0.3,h*0.46,2.6,0,TAU);g.fill();
    // windows (top-down)
    g.fillStyle="rgba(40,60,90,.85)";roundRect(-w*0.34,-h*0.34,w*0.68,h*0.22,4);g.fill();
    roundRect(-w*0.34,h*0.12,w*0.68,h*0.22,4);g.fill();
    // roof
    g.fillStyle=isPlayer?"#ffe98a":shadeC(color,30);roundRect(-w*0.3,-h*0.08,w*0.6,h*0.2,4);g.fill();
    // glossy highlight stripe
    g.fillStyle="rgba(255,255,255,.32)";roundRect(-w*0.4,-h*0.45,w*0.16,h*0.9,4);g.fill();
    g.fillStyle="rgba(255,255,255,.14)";roundRect(w*0.24,-h*0.45,w*0.1,h*0.9,4);g.fill();
    // cute startled face on the windshield (rival cars about to get crashed)
    const fy=-h*0.22,er=Math.max(2.2,w*0.085),ex=w*0.16;
    g.fillStyle="#fff";g.beginPath();g.arc(-ex,fy,er,0,TAU);g.arc(ex,fy,er,0,TAU);g.fill();
    g.fillStyle="#1b2436";const pr=er*0.55;   // pupils up = looking ahead nervously
    g.beginPath();g.arc(-ex,fy-er*0.2,pr,0,TAU);g.arc(ex,fy-er*0.2,pr,0,TAU);g.fill();
    g.fillStyle="#fff";g.beginPath();g.arc(-ex-pr*0.3,fy-er*0.2-pr*0.3,pr*0.4,0,TAU);g.arc(ex-pr*0.3,fy-er*0.2-pr*0.3,pr*0.4,0,TAU);g.fill();
    // small worried open mouth
    g.fillStyle="#1b2436";g.beginPath();g.ellipse(0,-h*0.06,w*0.06,h*0.04,0,0,TAU);g.fill();
    // wheels
    g.fillStyle="#16161c";g.fillRect(-w*0.5-3,-h*0.32,5,h*0.2);g.fillRect(w*0.5-2,-h*0.32,5,h*0.2);
    g.fillRect(-w*0.5-3,h*0.12,5,h*0.2);g.fillRect(w*0.5-2,h*0.12,5,h*0.2);
    g.restore();
  }
  function drawFancyCar(x,y,w,h,color,rot,sq){
    // コイン/にじいろカー専用: drawCarの単純な色違いをやめ、丸い角+オーバル窓で形からして『特別』と分かるようにする(軸7)
    sq=sq||0;const sx=1+sq*0.28,sy=1-sq*0.22;w=w*sx;h=h*sy;
    g.save();g.translate(x,y);g.rotate(rot||0);
    const rad=Math.min(w,h)*0.42;
    g.save();g.shadowColor="rgba(0,0,0,.35)";g.shadowBlur=10;g.shadowOffsetY=4;
    g.fillStyle="rgba(0,0,0,.3)";roundRect(-w/2,-h/2,w,h,rad);g.fill();g.restore();
    let bg=g.createLinearGradient(-w/2,0,w/2,0);
    bg.addColorStop(0,shadeC(color,-26));bg.addColorStop(0.5,shadeC(color,18));bg.addColorStop(1,shadeC(color,-26));
    g.fillStyle=bg;roundRect(-w/2,-h/2,w,h,rad);g.fill();
    // 一枚のオーバル窓(drawCarの2枚の角窓とはっきり違うシルエット)
    g.fillStyle="rgba(40,60,90,.85)";g.beginPath();g.ellipse(0,-h*0.08,Math.max(0,w*0.32),Math.max(0,h*0.32),0,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.30)";roundRect(-w*0.4,-h*0.45,w*0.14,h*0.9,rad*0.5);g.fill();
    g.fillStyle="rgba(255,60,60,.85)";g.beginPath();g.arc(-w*0.28,h*0.44,2.4,0,TAU);g.arc(w*0.28,h*0.44,2.4,0,TAU);g.fill();
    g.fillStyle="#16161c";g.fillRect(-w*0.5-3,-h*0.28,5,h*0.18);g.fillRect(w*0.5-2,-h*0.28,5,h*0.18);
    g.fillRect(-w*0.5-3,h*0.1,5,h*0.18);g.fillRect(w*0.5-2,h*0.1,5,h*0.18);
    g.restore();
  }
  function drawTruckCar(x,y,w,h,color,rot,sq){
    // 荷台の長いトラック型: 縦長シルエット+短いキャブ+荷台のリブ線(drawCarのセダン型と別の絵/軸7)
    sq=sq||0;const sx=1+sq*0.28,sy=1-sq*0.22;w=w*sx;h=h*sy;
    g.save();g.translate(x,y);g.rotate(rot||0);
    g.save();g.shadowColor="rgba(0,0,0,.35)";g.shadowBlur=10;g.shadowOffsetY=4;
    g.fillStyle="rgba(0,0,0,.3)";roundRect(-w/2,-h/2,w,h,7);g.fill();g.restore();
    let bg=g.createLinearGradient(-w/2,0,w/2,0);
    bg.addColorStop(0,shadeC(color,-26));bg.addColorStop(0.5,shadeC(color,14));bg.addColorStop(1,shadeC(color,-26));
    g.fillStyle=bg;roundRect(-w/2,-h/2,w,h,7);g.fill();
    g.fillStyle="rgba(40,60,90,.85)";roundRect(-w*0.4,-h*0.46,w*0.8,h*0.16,4);g.fill();
    g.fillStyle="rgba(255,255,255,.18)";g.fillRect(-w/2,-h*0.26,w,3);
    g.strokeStyle="rgba(0,0,0,.22)";g.lineWidth=2;
    for(let yy=-h*0.16;yy<h*0.42;yy+=h*0.13){g.beginPath();g.moveTo(-w*0.42,yy);g.lineTo(w*0.42,yy);g.stroke();}
    g.fillStyle="rgba(255,255,255,.28)";roundRect(-w*0.38,-h*0.44,w*0.1,h*0.86,3);g.fill();
    g.fillStyle="rgba(255,60,60,.85)";g.beginPath();g.arc(-w*0.3,h*0.46,2.4,0,TAU);g.arc(w*0.3,h*0.46,2.4,0,TAU);g.fill();
    g.fillStyle="#16161c";g.fillRect(-w*0.5-3,-h*0.34,5,h*0.16);g.fillRect(w*0.5-2,-h*0.34,5,h*0.16);
    g.fillRect(-w*0.5-3,h*0.16,5,h*0.16);g.fillRect(w*0.5-2,h*0.16,5,h*0.16);
    g.restore();
  }
  function drawBusCar(x,y,w,h,color,rot,sq){
    // 幅広バス型: 横広シルエット+横並び3枚窓(drawCarの2枚窓とは違う配置/軸7)
    sq=sq||0;const sx=1+sq*0.28,sy=1-sq*0.22;w=w*sx;h=h*sy;
    g.save();g.translate(x,y);g.rotate(rot||0);
    g.save();g.shadowColor="rgba(0,0,0,.35)";g.shadowBlur=10;g.shadowOffsetY=4;
    g.fillStyle="rgba(0,0,0,.3)";roundRect(-w/2,-h/2,w,h,14);g.fill();g.restore();
    let bg=g.createLinearGradient(-w/2,0,w/2,0);
    bg.addColorStop(0,shadeC(color,-22));bg.addColorStop(0.5,shadeC(color,16));bg.addColorStop(1,shadeC(color,-22));
    g.fillStyle=bg;roundRect(-w/2,-h/2,w,h,14);g.fill();
    g.fillStyle="rgba(40,60,90,.85)";
    for(let i=-1;i<=1;i++){roundRect(i*w*0.28-w*0.09,-h*0.3,w*0.18,h*0.24,3);g.fill();}
    g.fillStyle="rgba(255,255,255,.3)";roundRect(-w*0.44,-h*0.42,w*0.12,h*0.84,6);g.fill();
    g.fillStyle="rgba(255,60,60,.85)";g.beginPath();g.arc(-w*0.32,h*0.4,2.6,0,TAU);g.arc(w*0.32,h*0.4,2.6,0,TAU);g.fill();
    g.fillStyle="#16161c";g.fillRect(-w*0.5-3,-h*0.3,5,h*0.2);g.fillRect(w*0.5-2,-h*0.3,5,h*0.2);
    g.fillRect(-w*0.5-3,h*0.06,5,h*0.2);g.fillRect(w*0.5-2,h*0.06,5,h*0.2);
    g.restore();
  }
  function drawMiniTruck(e){
    // 2車線ぶちのミニトラック(HP2)。ボスより小さく色も違う手描き(画像フォールバック不要=既存のcone/playerと独立)
    const sq=e.sq||0;const sx=1+sq*0.2,sy=1-sq*0.16;const w=e.w*sx,h=e.h*sy;
    g.save();g.translate(e.x,e.y);g.rotate(e.rot||0);
    g.save();g.shadowColor="rgba(0,0,0,.35)";g.shadowBlur=12;g.shadowOffsetY=5;
    g.fillStyle="rgba(0,0,0,.3)";roundRect(-w/2,-h/2,w,h,10);g.fill();g.restore();
    const hc=e.hurt>0.01?"#fff":e.color;
    let bg=g.createLinearGradient(-w/2,0,w/2,0);
    bg.addColorStop(0,shadeC(hc,-20));bg.addColorStop(0.5,hc);bg.addColorStop(1,shadeC(hc,-20));
    g.fillStyle=bg;roundRect(-w/2,-h/2,w,h,10);g.fill();
    g.fillStyle="rgba(40,60,90,.85)";roundRect(-w*0.36,-h*0.4,w*0.72,h*0.2,5);g.fill();
    g.strokeStyle="rgba(0,0,0,.22)";g.lineWidth=2.5;
    for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(i*w*0.22,-h*0.05);g.lineTo(i*w*0.22,h*0.42);g.stroke();}
    const ey=-h*0.24,ex=w*0.16,er=Math.max(3,w*0.06);
    g.fillStyle="#fff";g.beginPath();g.arc(-ex,ey,er,0,TAU);g.arc(ex,ey,er,0,TAU);g.fill();
    g.fillStyle="#1b2436";g.beginPath();g.arc(-ex,ey+er*0.2,er*0.55,0,TAU);g.arc(ex,ey+er*0.2,er*0.55,0,TAU);g.fill();
    g.fillStyle="#16161c";g.fillRect(-w*0.5-3,-h*0.26,6,h*0.16);g.fillRect(w*0.5-3,-h*0.26,6,h*0.16);
    g.fillRect(-w*0.5-3,h*0.1,6,h*0.16);g.fillRect(w*0.5-3,h*0.1,6,h*0.16);
    g.restore();
    drawBossPips(e,h);
  }
  function drawCone(x,y,w,h,rot){
    g.save();g.translate(x,y);
    // shadow
    g.fillStyle="rgba(0,0,0,.25)";g.beginPath();g.ellipse(0,h*0.42,Math.max(0,w*0.7),Math.max(0,h*0.12),0,0,TAU);g.fill();
    // 画像コーン: 高さを当たり判定 h に合わせて center 描画(幅は判定より広め=よけ判定は甘いまま)。ぶつかった後は回転
    if(drawFit("cone.png",SPR.cone,0,0,w,h,1.1,{rot:rot||0})){g.restore();return;}
    // orange cone body (triangle) with white band
    g.fillStyle="#ff7a18";g.beginPath();g.moveTo(0,-h*0.5);g.lineTo(w*0.55,h*0.4);g.lineTo(-w*0.55,h*0.4);g.closePath();g.fill();
    g.fillStyle="#fff";g.beginPath();g.moveTo(-w*0.34,-h*0.02);g.lineTo(w*0.34,-h*0.02);g.lineTo(w*0.42,h*0.16);g.lineTo(-w*0.42,h*0.16);g.closePath();g.fill();
    g.fillStyle="#ff7a18";g.fillRect(-w*0.07,-h*0.5,w*0.14,h*0.9);
    // base
    g.fillStyle="#d65e0a";roundRect(-w*0.6,h*0.34,w*1.2,h*0.16,4);g.fill();
    // little cross "avoid me" eyes
    g.strokeStyle="#3a1c00";g.lineWidth=2.5;g.lineCap="round";
    g.beginPath();g.moveTo(-w*0.16,0);g.lineTo(-w*0.06,h*0.08);g.moveTo(-w*0.06,0);g.lineTo(-w*0.16,h*0.08);
    g.moveTo(w*0.06,0);g.lineTo(w*0.16,h*0.08);g.moveTo(w*0.16,0);g.lineTo(w*0.06,h*0.08);g.stroke();g.lineCap="butt";
    g.restore();
  }
  function drawCoin(x,y,w,h,rot,sq){
    sq=sq||0;const sx=1+sq*0.28,sy=1-sq*0.22;
    g.save();g.translate(x,y);g.rotate(rot||0);
    // body = golden car, but rounder silhouette + oval window(色だけでなく形も特別/軸7)
    drawFancyCar(0,0,w,h,"#ffd23f",0,sq);
    // glowing coin badge on the roof
    g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.6+0.3*Math.sin(tick*0.12);
    g.fillStyle="rgba(255,225,80,.9)";g.beginPath();g.arc(0,0,w*0.28*sx,0,TAU);g.fill();g.restore();
    g.fillStyle="#ffec8a";g.beginPath();g.arc(0,0,w*0.2,0,TAU);g.fill();
    g.fillStyle="#caa12a";g.font="800 "+Math.round(w*0.26)+"px system-ui";g.textAlign="center";g.textBaseline="middle";
    g.fillText("$",0,1);g.textAlign="left";g.textBaseline="alphabetic";
    g.restore();
  }
  function drawBoss(b){
    const sq=b.sq||0;const sx=1+sq*0.18,sy=1-sq*0.14;const w=b.w*sx,h=b.h*sy;
    g.save();g.translate(b.x,b.y);g.rotate(b.rot||0);
    // shadow
    g.save();g.shadowColor="rgba(0,0,0,.4)";g.shadowBlur=14;g.shadowOffsetY=6;
    g.fillStyle="rgba(0,0,0,.3)";roundRect(-w/2,-h/2,w,h,12);g.fill();g.restore();
    // ボスは手描きのまま(画像生成が不良だったため。HPピップは drawBossPips で共通)
    // hurt flash
    const hc=b.hurt>0.01?"#fff":"#c0392b";
    let bg=g.createLinearGradient(-w/2,0,w/2,0);
    bg.addColorStop(0,shadeC(hc==="#fff"?"#ffffff":"#8e241a",10));bg.addColorStop(0.5,hc);bg.addColorStop(1,shadeC(hc==="#fff"?"#ffffff":"#8e241a",10));
    g.fillStyle=bg;roundRect(-w/2,-h/2,w,h,12);g.fill();
    // cab + container divide
    g.fillStyle="rgba(255,255,255,.18)";g.fillRect(-w/2,-h*0.12,w,4);
    g.fillStyle="rgba(40,60,90,.85)";roundRect(-w*0.4,-h*0.44,w*0.8,h*0.22,6);g.fill();
    // container ridges
    g.strokeStyle="rgba(0,0,0,.25)";g.lineWidth=3;
    for(let i=-2;i<=2;i++){g.beginPath();g.moveTo(i*w*0.18,-h*0.05);g.lineTo(i*w*0.18,h*0.46);g.stroke();}
    // angry boss eyes
    const ey=-h*0.3,ex=w*0.18,er=Math.max(4,w*0.07);
    g.fillStyle="#fff";g.beginPath();g.arc(-ex,ey,er,0,TAU);g.arc(ex,ey,er,0,TAU);g.fill();
    g.fillStyle="#1b2436";g.beginPath();g.arc(-ex,ey+er*0.2,er*0.55,0,TAU);g.arc(ex,ey+er*0.2,er*0.55,0,TAU);g.fill();
    // angry brows
    g.strokeStyle="#1b2436";g.lineWidth=Math.max(3,w*0.03);g.lineCap="round";
    g.beginPath();g.moveTo(-ex-er,ey-er*1.1);g.lineTo(-ex+er*0.6,ey-er*0.4);
    g.moveTo(ex+er,ey-er*1.1);g.lineTo(ex-er*0.6,ey-er*0.4);g.stroke();g.lineCap="butt";
    // wheels
    g.fillStyle="#16161c";g.fillRect(-w*0.5-4,-h*0.3,7,h*0.18);g.fillRect(w*0.5-3,-h*0.3,7,h*0.18);
    g.fillRect(-w*0.5-4,h*0.1,7,h*0.18);g.fillRect(w*0.5-3,h*0.1,7,h*0.18);
    g.restore();
    drawBossPips(b,h);
  }
  function drawBossPips(b,h){
    // hp pips above boss (画像/手描き共通)
    g.save();g.textAlign="center";
    for(let i=0;i<b.maxhp;i++){g.fillStyle=i<b.hp?"#ff5a4a":"rgba(255,255,255,.3)";
      g.beginPath();g.arc(b.x-(b.maxhp-1)*9+i*18,b.y-h*0.5-14,6,0,TAU);g.fill();}
    g.restore();g.textAlign="left";
  }
  function drawSun(){
    const sx=sunHit.x,sy=sunHit.y,sr=sunHit.r;
    // soft halo (additive・小面積・毎フレーム戻す=溜まらない)
    g.save();g.globalCompositeOperation="lighter";
    const halo=g.createRadialGradient(sx,sy,sr*0.3,sx,sy,sr*2.4);
    halo.addColorStop(0,"rgba(255,244,190,.45)");halo.addColorStop(0.5,"rgba(255,236,170,.14)");halo.addColorStop(1,"rgba(255,244,190,0)");
    g.fillStyle=halo;g.beginPath();g.arc(sx,sy,sr*2.4,0,TAU);g.fill();
    g.restore();g.globalCompositeOperation="source-over";
    // body
    g.save();g.shadowColor="rgba(255,230,150,.9)";g.shadowBlur=16;
    const sg=g.createRadialGradient(sx-sr*0.3,sy-sr*0.3,sr*0.2,sx,sy,sr);
    sg.addColorStop(0,"#fffce8");sg.addColorStop(1,"#ffdf85");
    g.fillStyle=sg;g.beginPath();g.arc(sx,sy,sr,0,TAU);g.fill();g.restore();
    // ひみつタップの瞬間だけ ^_^ のウインク顔(発見のごほうび)
    if(sunWink>0){
      g.save();g.strokeStyle="#d09020";g.lineWidth=Math.max(2,sr*0.13);g.lineCap="round";g.globalAlpha=clamp(sunWink*1.4,0,1);
      g.beginPath();
      g.moveTo(sx-sr*0.44,sy-sr*0.02);g.quadraticCurveTo(sx-sr*0.29,sy-sr*0.3,sx-sr*0.14,sy-sr*0.02);
      g.moveTo(sx+sr*0.14,sy-sr*0.02);g.quadraticCurveTo(sx+sr*0.29,sy-sr*0.3,sx+sr*0.44,sy-sr*0.02);
      g.stroke();
      g.beginPath();g.arc(sx,sy+sr*0.14,sr*0.34,0.12*Math.PI,0.88*Math.PI);g.stroke();
      g.restore();g.globalAlpha=1;g.lineCap="butt";}
  }
  function drawRainbowCar(e){
    const col=CARCOL[Math.floor(tick*0.12+e.shine)%CARCOL.length];
    // 虹の揺らめきオーラ(加算・小面積・車1台ぶん)
    g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.3+0.2*Math.sin(tick*0.2+e.shine);
    const ag=g.createRadialGradient(e.x,e.y,0,e.x,e.y,e.w*0.9);
    ag.addColorStop(0,col);ag.addColorStop(1,"rgba(255,255,255,0)");
    g.fillStyle=ag;g.beginPath();g.arc(e.x,e.y,e.w*0.9,0,TAU);g.fill();
    g.restore();g.globalCompositeOperation="source-over";g.globalAlpha=1;
    // 丸みの強いシルエット+オーバル窓(色だけでなく形も特別/軸7)
    drawFancyCar(e.x,e.y,e.w,e.h,col,e.rot,e.sq||0);
    // ルーフの虹アーチ(レアだと一目で分かる)
    g.save();g.lineWidth=Math.max(2,e.w*0.06);g.lineCap="round";
    for(let k=0;k<3;k++){g.strokeStyle=["#ff5da2","#ffd23f","#5ad1ff"][k];
      g.beginPath();g.arc(e.x,e.y+e.h*0.02,e.w*(0.16+k*0.07),Math.PI*1.08,Math.PI*1.92);g.stroke();}
    g.restore();g.lineCap="butt";
  }
  function drawLuckyStar(e){
    const yy=e.y-e.h*0.62+Math.sin(tick*0.15+e.x*0.05)*2,tw=0.55+0.45*Math.sin(tick*0.2+e.x*0.05);
    g.save();g.globalCompositeOperation="lighter";g.globalAlpha=Math.max(0,tw);
    g.fillStyle="#fff7c8";g.shadowColor="#ffe23f";g.shadowBlur=8;
    drawTinyStar(e.x,yy,e.w*0.15);
    g.restore();g.globalCompositeOperation="source-over";g.globalAlpha=1;g.shadowBlur=0;
  }
  function drawTinyStar(cx,cy,r){
    g.beginPath();
    for(let i=0;i<5;i++){const a=-Math.PI/2+i*TAU/5;
      g.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);
      const a2=a+TAU/10;g.lineTo(cx+Math.cos(a2)*r*0.45,cy+Math.sin(a2)*r*0.45);}
    g.closePath();g.fill();
  }
  function roundRect(x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function shadeC(hex,amt){const c=parseInt(hex.slice(1),16);const r=clamp(((c>>16)&255)+amt,0,255),gg=clamp(((c>>8)&255)+amt,0,255),b=clamp((c&255)+amt,0,255);return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("race", buildRace);
