function buildCannon(api){
  const g=api.g;
  // 画像アセット(assets/cannon/)。無ければ従来の手描きにフォールバック。
  //  bg.jpg=城攻めの草原 / barrel.png=大砲(筒+胴) / ball.png=砲弾 / wheel.png=車輪
  //  ※ block.png は生成が2回とも不良(顔・レンガ模様・影が焼き込まれる)だったため使わず、ブロックは手描きのまま
  api.preload(["bg.jpg","barrel.png","ball.png","wheel.png"]);
  let blocks=[],balls=[],shards=[],dust=[],floats=[],sparks=[],trail=[];
  let groundY,baseX,baseY,S,colsN,castleX,level,count,charging,power,powDir,elev,elevDir,grav,sweptHint,muzzle,tSky,flashWash;
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  let luckyColor=null,luckySeen=false,luckyMsgT=0,rbMsgT=0;   // ① にじいろ ② きょうのラッキー色
  let luckyPops=[];                          // ② ラッキー命中で頭上に出る小さな星(気づけるヒント)
  let shootStar=null,shootTimer=180,sunWink=0; // ④ ながれ星を撃つ / 太陽ひみつ命中
  const sunHit={x:0,y:0,r:0};                // ④ 太陽の当たり判定(描画と一致)
  const RCOLS=["#ff5b5b","#ff9f54","#f7d23c","#54c98c","#4a9cf0","#a87dff"]; // 虹色パレット
  const CNAME={"#ec6a4a":"あか","#4a9cf0":"あお","#f7d23c":"きいろ","#54c98c":"みどり","#ff9f54":"オレンジ","#a87dff":"むらさき"};
  // progression + scoring state
  let castlesCleared,shotsThisCastle,comboChain,winBanner,winTimer,crowns;
  // ⑥ 見やすさ: 「Nれんさ！」は毎ヒットで新規pushせず、この1個のフロートを使い回す(位置固定)。
  let comboFloat=null;
  let starRating=0,starTimer=0;   // 星評価(canvas手描き・絵文字は使わない)
  const GOAL=12; // ぜんぶで12城こわしたらクリア（7〜8歳向けに少し長く）
  // drifting ambient magic motes (deterministic-ish, cheap)
  let motes=null;
  function ensureMotes(){if(motes)return;motes=[];for(let i=0;i<16;i++)motes.push({x:rnd(0,1),y:rnd(0,1),r:rnd(1.2,3.2),sp:rnd(0.02,0.06),ph:rnd(0,TAU),hue:pick(["#ffd6f0","#fff3b0","#cfe8ff","#e3cdff"])});}
  const COLORS=["#ec6a4a","#4a9cf0","#f7d23c","#54c98c","#ff9f54","#a87dff"];
  // ⑦ 壊す物のバラエティ: 四角い同サイズブロック一辺倒をやめ、形/サイズ違いのピースを混ぜる。
  //  square=れんが(従来通り) / circle=まるい岩(丸判定+砕け方も丸) / wide=丸太(横長) / tall=石柱(縦長)
  //  king/iron/rainbow の特別kindは従来通り square 枠のまま(見分けやすさ優先)。
  const SHAPES=[
    {shape:"square",wf:1,hf:1,wgt:0.5},
    {shape:"circle",wf:1.3,hf:1.3,wgt:0.2},
    {shape:"wide",wf:1.9,hf:0.7,wgt:0.17},
    {shape:"tall",wf:0.7,hf:1.8,wgt:0.13}
  ];
  function pickShape(){
    let r=Math.random(),acc=0;
    for(const s of SHAPES){acc+=s.wgt;if(r<acc)return s;}
    return SHAPES[0];
  }
  // pre-baked twinkly star positions for the sky (deterministic, cheap)
  let stars=null;
  function ensureStars(){if(stars)return;stars=[];for(let i=0;i<22;i++)stars.push({x:rnd(0,1),y:rnd(0,0.4),r:rnd(0.6,1.8),p:rnd(0,TAU)});}
  function layout(){
    groundY=api.H*0.84;
    baseX=api.W*0.12;baseY=groundY;
    S=clamp(Math.floor(api.W/10),34,58);
    colsN=clamp(3+level,3,6);
    castleX=api.W*0.52;
    grav=clamp(api.H*0.0006,0.32,0.5);
    sunHit.x=api.W*0.82;sunHit.y=api.H*0.14;sunHit.r=Math.max(32,api.W*0.06); // ④ 太陽の当たり判定
  }
  function buildCastle(){
    layout();blocks=[];shotsThisCastle=0;
    // stage1 is a touch shorter (4 rows) so the first clear lands sooner; grows gently after
    const rows=clamp(3+level,4,8);
    // pick a top-center spot for the special KING block (appears from level 2)
    const kingC=(colsN>=2&&level>=2)?Math.floor(colsN/2):-1;
    const kingR=rows-1;
    // chance of tough IRON blocks grows a little each level (from level 3; 7〜8歳向けに少し多め)
    const ironChance=level>=3?clamp(0.08+level*0.035,0,0.3):0;
    for(let c=0;c<colsN;c++)for(let r=0;r<rows;r++){
      let kind="brick",hp=1,col,shapeDef=SHAPES[0];
      if(c===kingC&&r===kingR){kind="king";hp=3;col="#ffd23f";}
      else if(Math.random()<ironChance){kind="iron";hp=2;col="#9aa6b4";}
      else{col=Math.random()<0.7?COLORS[c%COLORS.length]:pick(COLORS);shapeDef=pickShape();}
      const cellX=castleX+c*S,cellY=groundY-(r+1)*S;
      const bw=Math.max(6,S*shapeDef.wf-2),bh=Math.max(6,S*shapeDef.hf-2);
      blocks.push({x:cellX+(S-bw)/2,y:cellY+(S-bh)/2,w:bw,h:bh,vx:0,vy:0,rot:0,vr:0,
        color:col,loose:false,rest:true,kind:kind,hp:hp,maxhp:hp,shapeKey:shapeDef.shape,r:r,c:c,
        blink:rnd(0,TAU),face:rint(0,2)});
    }
    // ⑦ やぐら: 各お城に必ず1つ、通常の2倍サイズの特大ピースを土台の列(地面いちばん近く)に混ぜる。
    //  king枠とは別。壊す物の大小差を作り、崩れる時だけ専用の大きな演出(loosen内)を出す。
    {
      const groundRowCy=groundY-S/2;
      const cand=blocks.filter(b=>b.kind==="brick"&&Math.abs((b.y+b.h/2)-groundRowCy)<S*0.6);
      if(cand.length){
        const yb=pick(cand);
        const cx=yb.x+yb.w/2,S2=Math.max(12,S*2-4);
        yb.kind="yagura";yb.shapeKey="square";yb.hp=2;yb.maxhp=2;
        yb.w=S2;yb.h=S2;yb.x=cx-S2/2;yb.y=groundY-S2; // 底は地面に揃え、上にそびえる「やぐら」に見せる
      }
    }
    // ① にじいろブロック: レベル2以降、ときどき1個だけ紛れる激レア。虹色に光るので狙って当てると大盤振る舞い。
    if(level>=2&&Math.random()<0.16){
      const cand=blocks.filter(b=>b.kind==="brick");
      if(cand.length){const rb=pick(cand);rb.kind="rainbow";rb.hp=1;rb.maxhp=1;
        // rainbowはking/iron同様、従来通りbrick枠(正方形)で出す(丸太/岩の形のままだと虹演出と噛み合わない)
        if(rb.shapeKey!=="square"){const cx=rb.x+rb.w/2,cy2=rb.y+rb.h/2,sw=S-2;rb.shapeKey="square";rb.w=sw;rb.h=sw;rb.x=cx-sw/2;rb.y=cy2-sw/2;}
        api.tone(1568,0.1,"triangle",0.06);api.tone(2093,0.12,"triangle",0.04);} // 出現の小さなきらめき音
    }
  }
  let rebuilding=false,calmT=0,hsCool=0;
  function reset(){level=1;count=0;charging=false;power=0;powDir=1;elev=0.7;elevDir=1;balls=[];shards=[];dust=[];floats=[];sparks=[];trail=[];muzzle=0;tSky=0;sweptHint=0;flashWash=0;rebuilding=false;calmT=0;hsCool=0;castlesCleared=0;shotsThisCastle=0;comboChain=0;comboFloat=null;winBanner=false;winTimer=0;crowns=[];starRating=0;starTimer=0;luckyColor=pick(COLORS);luckySeen=false;luckyMsgT=0;rbMsgT=0;luckyPops=[];shootStar=null;shootTimer=rnd(150,300);sunWink=0;buildCastle();}
  function burst(x,y,col,n,spread){
    for(let i=0;i<n;i++){const a=rnd(0,TAU),sp=rnd(1.5,spread);
      sparks.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rnd(0,2),r:rnd(1.5,3.4),life:1,decay:rnd(0.03,0.06),col:col});}
  }
  function rainbowBurst(x,y){
    // ① にじいろブロック撃破: 虹色にはじけて大盤振る舞い(白飛び防止に flashWash は上限つき)
    rbMsgT=1.3;count+=8;api.setScore(count);
    for(let k=0;k<RCOLS.length;k++)burst(x,y,RCOLS[k],7,9);
    floats.push({x:x,y:y-10,txt:"にじいろ！",col:"#ff5fae",life:1.2,vy:-0.7,size:40});
    api.boom(0.55);api.shake(12);
    api.tone(880,0.12,"triangle",0.1);api.tone(1320,0.14,"triangle",0.09);api.tone(1760,0.16,"triangle",0.07);
    if(hsCool<=0){api.hitStop(4);hsCool=32;}
    flashWash=Math.min(flashWash+0.4,1);   // 連打で溜まらないよう上限1
  }
  function spawnShootStar(){
    // ④ ながれ星: たまに空を横切る。ボールで撃ち落とすとコイン(減点なし)。
    const fromLeft=Math.random()<0.5,sp=rnd(3,4.6);
    shootStar={x:fromLeft?-30:api.W+30,y:rnd(api.H*0.16,api.H*0.4),
      vx:(fromLeft?1:-1)*sp,vy:rnd(0.3,0.8),r:S*0.34,tail:[]};
  }
  function hitShootStar(x,y){
    count+=6;api.setScore(count);
    floats.push({x:x,y:y-8,txt:"ながれ星ゲット！",col:"#fff3b0",life:1.3,vy:-0.7,size:30});
    burst(x,y,"#fff3b0",16,8);burst(x,y,"#ffd23f",10,7);
    api.tone(1318,0.12,"triangle",0.1);api.tone(1976,0.14,"triangle",0.08);api.shake(6);
  }
  function loosen(b,ix,iy,force){
    if(b.loose)return;
    b.loose=true;b.rest=false;
    b.vx=ix*force+rnd(-1,1);b.vy=iy*force-rnd(1,4);b.vr=rnd(-0.3,0.3);
    count++;api.setScore(count);
    comboChain++;
    // ② きょうのラッキー色: 秘密の色のブロックを倒すと +2 と頭上に小さな星(気づけるヒント)
    if(b.kind==="brick"&&b.color===luckyColor){
      count+=2;api.setScore(count);
      luckyPops.push({x:b.x+b.w/2,y:b.y,life:1});
      api.tone(1046,0.1,"triangle",0.09);api.tone(1568,0.12,"triangle",0.07);
      if(!luckySeen){luckySeen=true;luckyMsgT=1.6;}
    }
    // ① にじいろブロック撃破: 虹のはじけ＋ファンファーレ＋大量得点
    if(b.kind==="rainbow")rainbowBurst(b.x+b.w/2,b.y+b.h/2);
    // ⑦ やぐら(2倍サイズ)崩壊: 普段より大きいburst/shakeで「大きい物が倒れた」手応えを別枠で出す
    if(b.kind==="yagura"){
      count+=6;api.setScore(count);
      floats.push({x:b.x+b.w/2,y:b.y,txt:"どしーん！",col:"#ffb36a",life:1.2,vy:-0.7,size:32});
      burst(b.x+b.w/2,b.y+b.h/2,"#c98b52",26,11);burst(b.x+b.w/2,b.y+b.h/2,"#8a5a34",18,9);
      api.boom(0.6);api.shake(12);
      api.tone(140,0.18,"square",0.12);api.slide(220,80,0.22,0.12,"sine");
    }
    // KING block down: big bonus burst + "どっかんクリア！" + crown souvenir
    if(b.kind==="king"){
      count+=10;api.setScore(count);
      floats.push({x:b.x+b.w/2,y:b.y,txt:"どっかんクリア！",col:"#ffe14a",life:1.2,vy:-0.7,size:34});
      burst(b.x+b.w/2,b.y+b.h/2,"#fff3b0",24,9);burst(b.x+b.w/2,b.y+b.h/2,"#ffd23f",18,8);
      api.boom(0.55);api.shake(9);api.tone(880,0.16,"square",0.12);api.slide(660,1320,0.2,0.1,"sine");
      crowns.push({x:b.x+b.w/2,y:b.y,vy:-2.4,vx:rnd(-1,1),rot:0,vr:rnd(-0.1,0.1),life:1});
    }
    // cascade: blocks resting on top of this one lose support
    // ③ 歯ごたえ(第5ラウンド): 以前はforce>6だったが、shotSpeed()の最低速度clamp(…,8,26)のせいで
    //  どんなに一瞬の適当タップでもball.vx≈6.12となり、force=|vx|*0.6+4≈7.67と常に6を超えて
    //  毎回連鎖してしまっていた。閾値をforce>10まで引き上げ、力の算出元もpower(長押し量)基準に
    //  変えたことで、軽い/雑なタップでは1個だけ崩れて終わり、しっかり溜めた一撃だけ連鎖するようにする。
    if(force>10){
      for(const o of blocks){if(o.rest&&!o.loose){
        if(Math.abs((o.y+o.h)-b.y)<S*0.3 && o.x< b.x+b.w && o.x+o.w> b.x){
          loosen(o,ix*0.5,-0.6,force*0.6);
        }
      }}
    }
  }
  function shotSpeed(){
    // auto-ranged shot: power picks how DEEP into the castle the ball lands,
    // so any sloppy tap/hold from a 5yo always reaches the castle (never overshoots off-screen)
    // ③ 歯ごたえ(第2ラウンド): front もお城のごく手前端まで狭め、適当に離しただけでは
    //  城の一番手前の列にしか届かないようにする。縮小幅は小さく留め、
    //  最小パワーでも必ず手前列には当たる(=軸1の最初の成功)は壊さない。
    // 以前は back がお城の奥+余裕まであり、どのタイミングで離しても必ず命中していた。
    //  back を城幅の65%までに狭め、力を溜めすぎる(power≈1)と奥を通り越して外れるようにする。
    // ③ 歯ごたえ(第3ラウンド): back をさらに縮小(0.9→0.68)。パワーを溜めすぎると
    //  最奥列を通り越して外れるようにし、ちょうどよい強さで狙う必要を作る(frontは軸1維持のため据え置き)。
    const front=castleX-S*0.7, back=castleX+colsN*S*0.68;
    const D=Math.max(60,lerp(front,back,power)-baseX);
    const s2=Math.max(0.5,Math.sin(2*clamp(elev,0.35,1.05)));
    return clamp(Math.sqrt(D*grav/s2),8,26);
  }
  function groundShock(x,pow,shotPower){
    // heavy landing kicks up a ground shockwave that topples nearby standing blocks
    // ③ 歯ごたえ(第2ラウンド): 半径を縮小。低く強い1発で城全体が崩れる「いちげき」が
    //  起きにくくなり、狙って複数箇所を撃つ必要が生まれる(低く狙う裏ワザ自体は残す)。
    // ③ 歯ごたえ(第5ラウンド): 縦方向(高さ)はそのまま全段対象にする(でないと、適当な
    //  瞬間タップが着地点の1列を掘り下げるだけになり無反応区間が伸びすぎると実測で判明)。
    //  代わりに横方向の半径を発射時のpower(長押し量)に連動させる: 適当な瞬間タップ(shotPower≈0)は
    //  着地したその場の柱1本だけを崩し、しっかり溜めた一撃(shotPower≈1)ほど左右の柱まで
    //  巻き込んで崩せる。「狙って強く当てるほど気持ちよく崩れる」歯ごたえに作り替えつつ、
    //  毎ショットどこかしらは崩れるテンポ(=退屈しない)は保つ。
    const R=S*(0.48+0.31*pow+0.5*(shotPower||0));
    api.shake(3+4*pow);api.noise(0.1,0.25,320,"lowpass");
    for(let i=0;i<8;i++)dust.push({x:x+rnd(-R*0.6,R*0.6),y:groundY-rnd(0,6),r:rnd(5,11),vr:rnd(0.7,1.4),life:1,decay:0.05});
    for(const b of blocks){
      if(b.loose)continue;
      const cx=b.x+b.w/2,d=Math.abs(cx-x);
      if(d<R)loosen(b,cx>x?1:-1,-0.5,clamp(8*(1-d/R)+3,3,10));
    }
  }
  function fire(){
    const spd=shotSpeed();
    const mx=baseX+Math.cos(elev)*S*1.8, my=baseY-S*0.7-Math.sin(elev)*S*1.8;
    shotsThisCastle++;comboChain=0;
    // 直前の「れんさ」表示を即座に消してから参照を外す(古い表示が新しいショットの表示と
    // 一瞬でも同時に生き残って二重に見えることがないようにする)
    if(comboFloat)comboFloat.life=0;
    comboFloat=null;
    // ③ 歯ごたえ(第5ラウンド): 連鎖の強さをball.vx(最低速度clampのせいで常に高止まりする)ではなく、
    //  発射時のpower(0〜1、長押し量)そのものに紐づける。長押しで溜めた一撃ほど連鎖しやすくなる。
    balls.push({x:mx,y:my,vx:Math.cos(elev)*spd,vy:-Math.sin(elev)*spd,r:S*0.42,life:1,sq:1.4,power:power});
    api.slide(180,60,0.3,0.5,"sine");api.noise(0.22,0.4,500,"lowpass");api.shake(6+power*6);api.boom(0.4+power*0.4);
    muzzle=1;
    // smoke puffs + bright ember sparks from the muzzle
    for(let i=0;i<7;i++)dust.push({x:mx,y:my,r:rnd(6,12),vr:rnd(0.8,1.6),life:1,decay:0.04});
    burst(mx,my,"#ffd86b",10+Math.floor(power*8),5+power*4);
  }
  reset();
  return{
    resize(){const had=blocks.length;layout();if(!had)buildCastle();},
    input(px,py,type){
      if(type==="down"){charging=true;power=0;powDir=1;}
      else if(type==="up"){if(charging){charging=false;fire();}}
    },
    frame(dt,now){
      tSky+=dt*0.02;ensureStars();
      hsCool=Math.max(0,hsCool-dt);
      // ④ ながれ星: 移動としっぽ更新、画面外で消滅、いない時はときどき再出現
      if(shootStar){shootStar.x+=shootStar.vx*dt;shootStar.y+=shootStar.vy*dt;
        shootStar.tail.push({x:shootStar.x,y:shootStar.y});if(shootStar.tail.length>10)shootStar.tail.shift();
        if(shootStar.x<-60||shootStar.x>api.W+60||shootStar.y>groundY-20)shootStar=null;}
      else{shootTimer-=dt;if(shootTimer<=0){if(Math.random()<0.55)spawnShootStar();shootTimer=rnd(240,520);}}
      if(sunWink>0)sunWink-=0.02*dt;
      // 背景: 画像(城攻めの草原)があればそれを使い、絵と喧嘩する平坦な手描き(空グラデ・丘・雲・地面の帯)は省く
      let imgBg=false;
      if(api.drawCover("bg.jpg")){imgBg=true;}
      else{
        // sky: deeper layered gradient
        let grd=g.createLinearGradient(0,0,0,groundY);
        grd.addColorStop(0,"#3f7fc4");grd.addColorStop(0.55,"#7fb2dd");grd.addColorStop(1,"#dceefb");
        g.fillStyle=grd;g.fillRect(0,0,api.W,groundY);
      }
      // soft sun glow upper-right
      const sx=api.W*0.82,sy=api.H*0.14,sr=api.W*0.28;
      let sg=g.createRadialGradient(sx,sy,0,sx,sy,sr);
      sg.addColorStop(0,"rgba(255,247,214,.85)");sg.addColorStop(0.4,"rgba(255,236,170,.35)");sg.addColorStop(1,"rgba(255,236,170,0)");
      g.fillStyle=sg;g.beginPath();g.arc(sx,sy,sr,0,TAU);g.fill();
      g.fillStyle="rgba(255,252,235,.95)";g.beginPath();g.arc(sx,sy,api.W*0.045,0,TAU);g.fill();
      // faint twinkle specks high in the sky ※画像背景のときは描かない
      if(!imgBg){for(const st of stars){const a=0.25+0.25*Math.sin(tSky*3+st.p);
        g.globalAlpha=a;g.fillStyle="#ffffff";g.beginPath();g.arc(st.x*api.W,st.y*api.H,st.r,0,TAU);g.fill();}}
      g.globalAlpha=1;
      if(!imgBg){
        // distant rolling hills (parallax silhouettes)
        g.fillStyle="rgba(120,170,120,.55)";
        g.beginPath();g.moveTo(0,groundY);
        for(let i=0;i<=8;i++){const hx=i/8*api.W;g.lineTo(hx,groundY-40-30*Math.sin(i*1.3+tSky*0.1));}
        g.lineTo(api.W,groundY);g.closePath();g.fill();
        // clouds (soft, with subtle shadow underside)
        const cloud=(cx,cy,sc)=>{
          g.fillStyle="rgba(255,255,255,.85)";
          g.beginPath();g.arc(cx,cy,30*sc,0,TAU);g.arc(cx+22*sc,cy-6*sc,38*sc,0,TAU);g.arc(cx+50*sc,cy,28*sc,0,TAU);g.arc(cx+24*sc,cy+8*sc,30*sc,0,TAU);g.fill();
          g.fillStyle="rgba(180,205,230,.45)";
          g.beginPath();g.ellipse(cx+24*sc,cy+12*sc,46*sc,10*sc,0,0,TAU);g.fill();
        };
        cloud(api.W*0.28,api.H*0.16,1);cloud(api.W*0.6,api.H*0.1,0.7);
      }
      // drifting magic motes (ambient, additive)
      ensureMotes();
      g.save();g.globalCompositeOperation="lighter";
      for(const m of motes){m.y-=m.sp*dt*0.004;if(m.y<-0.02){m.y=1.02;m.x=rnd(0,1);}
        const mx=(m.x+0.012*Math.sin(tSky*2+m.ph))*api.W,my=m.y*groundY,a=0.35+0.3*Math.sin(tSky*3+m.ph);
        g.globalAlpha=a;g.fillStyle=m.hue;g.beginPath();g.arc(mx,my,m.r,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      // ④ ながれ星の描画(きらめく星＋しっぽ) — 加算はsave/restoreで確実に戻す
      if(shootStar){
        g.save();g.globalCompositeOperation="lighter";
        for(let i=0;i<shootStar.tail.length;i++){const t=shootStar.tail[i],a=(i/shootStar.tail.length)*0.5;
          g.globalAlpha=a;g.fillStyle="#fff3b0";g.beginPath();g.arc(t.x,t.y,shootStar.r*0.5*(i/shootStar.tail.length),0,TAU);g.fill();}
        g.restore();g.globalAlpha=1;
        drawStar(shootStar.x,shootStar.y,shootStar.r*(1+0.12*Math.sin(tSky*10)),"#fff7c2",1,true);
      }
      // ④ 太陽ひみつ命中のウインク顔(^_^)
      if(sunWink>0){const wsr=api.W*0.045;
        g.save();g.strokeStyle="#d09020";g.lineWidth=Math.max(2,wsr*0.13);g.lineCap="round";g.globalAlpha=clamp(sunWink*1.4,0,1);
        g.beginPath();
        g.moveTo(sx-wsr*0.44,sy-wsr*0.02);g.quadraticCurveTo(sx-wsr*0.29,sy-wsr*0.3,sx-wsr*0.14,sy-wsr*0.02);
        g.moveTo(sx+wsr*0.14,sy-wsr*0.02);g.quadraticCurveTo(sx+wsr*0.29,sy-wsr*0.3,sx+wsr*0.44,sy-wsr*0.02);
        g.stroke();
        g.beginPath();g.arc(sx,sy+wsr*0.14,wsr*0.34,0.12*Math.PI,0.88*Math.PI);g.stroke();
        g.restore();g.globalAlpha=1;}
      // ground with grad + grass blades ※画像背景のときは絵の地面を活かして描かない
      if(!imgBg){
        let gg=g.createLinearGradient(0,groundY,0,api.H);gg.addColorStop(0,"#7aa052");gg.addColorStop(1,"#577a3c");
        g.fillStyle=gg;g.fillRect(0,groundY,api.W,api.H-groundY);
        g.fillStyle="#9cc466";g.fillRect(0,groundY,api.W,6);
        g.strokeStyle="rgba(60,90,40,.4)";g.lineWidth=2;g.beginPath();
        for(let i=0;i<api.W;i+=22){g.moveTo(i,groundY+6);g.lineTo(i+3,groundY-3);g.moveTo(i+8,groundY+6);g.lineTo(i+6,groundY-2);}
        g.stroke();
      }
      // dust
      for(const d of dust){d.r+=d.vr*dt;d.y-=0.3*dt;d.life-=d.decay*dt;g.globalAlpha=Math.max(0,d.life)*0.5;
        g.fillStyle="#d8d2c0";g.beginPath();g.arc(d.x,d.y,d.r,0,TAU);g.fill();}
      g.globalAlpha=1;dust=dust.filter(d=>d.life>0);
      // charging meters
      if(charging){
        power+=0.022*dt*powDir;if(power>=1){power=1;powDir=-1;}if(power<=0){power=0;powDir=1;}
        elev+=0.012*dt*elevDir;if(elev>1.05){elev=1.05;elevDir=-1;}if(elev<0.35){elev=0.35;elevDir=1;}
      }
      // blocks physics
      for(const b of blocks){
        b.blink+=0.04*dt;
        if(b.loose){b.vy+=grav*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.rot+=b.vr*dt;
          if(b.y+b.h>groundY){b.y=groundY-b.h;if(Math.abs(b.vy)>3){b.vy*=-0.32;b.vx*=0.7;b.vr*=0.6;}else{b.vy=0;b.vx*=0.8;b.vr*=0.7;if(Math.abs(b.vx)<0.3)b.vx=0;}
            if(Math.abs(b.vy)<2)b.vy=0;}
        }
      }
      // balls
      for(const ball of balls){
        ball.vy+=grav*dt;ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
        if(ball.sq>1)ball.sq=lerp(ball.sq,1,0.18*dt);
        // motion-trail sample (capped so FPS stays high)
        trail.push({x:ball.x,y:ball.y,r:ball.r*0.85,life:1});
        if(trail.length>40)trail.shift();
        // ④ ながれ星ヒット(撃ち落とすとコイン/減点なし)
        if(shootStar&&Math.hypot(ball.x-shootStar.x,ball.y-shootStar.y)<shootStar.r+ball.r){
          hitShootStar(shootStar.x,shootStar.y);shootStar=null;}
        // ④ 太陽ひみつ: 高く撃って太陽に当てるとウインク＋金コイン(減点なし)
        if(sunWink<=0&&Math.hypot(ball.x-sunHit.x,ball.y-sunHit.y)<sunHit.r){
          sunWink=1;count+=1;api.setScore(count);
          burst(sunHit.x,sunHit.y,"#ffe08a",10,6);burst(sunHit.x,sunHit.y,"#fff3b0",6,5);
          api.tone(1318,0.1,"triangle",0.08);api.tone(1760,0.12,"triangle",0.06);}
        for(const b of blocks){if(b.loose)continue;
          // ⑦ boulder(丸)だけは円判定。それ以外は従来通りAABB
          const isRound=b.shapeKey==="circle";
          const hit=isRound
            ? Math.hypot(ball.x-(b.x+b.w/2),ball.y-(b.y+b.h/2))<ball.r+Math.max(0,b.w/2)
            : (ball.x+ball.r>b.x&&ball.x-ball.r<b.x+b.w&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+b.h);
          if(hit){
            const dirx=ball.vx>=0?1:-1;
            // tough blocks (iron/king) survive the first hit: clang + dent, ball bounces
            if(b.hp>1){
              b.hp--;b.flash=1;b.dent=1;ball.sq=1.5;
              burst(ball.x,b.y+b.h*0.3,"#dfe7f0",7,6);burst(ball.x,b.y+b.h*0.3,"#ffe48a",4,5);
              if(hsCool<=0){api.hitStop(2);hsCool=22;}
              api.shake(5);
              api.noise(0.08,0.22,2600,"bandpass",6);api.tone(220,0.07,"square",0.05);
              ball.vx*=-0.45;ball.vy*=0.6;ball.x+=dirx*-2;
              continue;
            }
            loosen(b,dirx,-0.3,clamp((ball.power||0)*14+3,3,16));
            // ⑦ 壊れ方の違い: boulderは丸い破片、logは横に長い木片、それ以外は従来の角ばった破片
            {
              const spShape=b.shapeKey==="circle"?"circle":b.shapeKey==="wide"?"wide":"square";
              for(let k=rint(3,6);k>0;k--){
                const baseS=rnd(b.w*0.14,b.w*0.27);
                const sw=spShape==="wide"?baseS*1.9:baseS, sh=spShape==="wide"?baseS*0.55:baseS;
                shards.push({x:b.x+rnd(0,b.w),y:b.y+rnd(0,b.h),vx:rnd(-5,6),vy:rnd(-8,-1),
                  sw:sw,sh:sh,shape:spShape,color:b.color,rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.008,0.014)});
              }
            }
            // flash of bright sparkles + a hit-flash marker on the block
            burst(ball.x,b.y+b.h*0.3,"#fff6c8",8,6);burst(ball.x,b.y+b.h*0.3,b.color,5,5);
            b.flash=1;ball.sq=1.5;
            if(hsCool<=0){api.hitStop(2);hsCool=22;}
            api.shake(4);
            api.noise(0.1,0.2,1500);api.tone(300*Math.pow(2,clamp(count,0,12)/12),0.08,"square",0.06);
            ball.vx*=0.7;ball.vy*=0.7;
            // combo/chain payoff: when one shot topples a lot, celebrate it
            if(comboChain>=3){
              // ⑥ 見やすさ: 毎ヒットごとにfloatsへ新規pushしていたのをやめ、1個のフロートを
              //  使い回す(位置も画面上部の固定位置に固定)。ヒットの度に違う座標へ増えていくのをやめれば、
              //  複数の「Nれんさ」が別々の場所に積み重なって衝突すること自体が起きなくなる。
              const cfx=api.W/2,cfy=130; // おしろHUD(hudY=58,高さ26)の下に十分な余白を空けて固定
              if(!comboFloat||floats.indexOf(comboFloat)<0){comboFloat={x:cfx,y:cfy,txt:comboChain+"れんさ！",col:comboChain>=6?"#ff5fae":"#ffd23f",life:0.7,vy:0,size:clamp(22+comboChain*2,22,44)};floats.push(comboFloat);}
              else{comboFloat.txt=comboChain+"れんさ！";comboFloat.col=comboChain>=6?"#ff5fae":"#ffd23f";comboFloat.size=clamp(22+comboChain*2,22,44);comboFloat.life=0.7;}
              api.slide(440+comboChain*40,880+comboChain*80,0.14,0.09,"sine");
              if(comboChain>=5){api.shake(6);api.boom(0.4);}
            }
          }
        }
        if(ball.y+ball.r>=groundY){ball.y=groundY-ball.r;
          if(ball.vy>3.5)groundShock(ball.x,clamp(ball.vy/12,0.4,1),ball.power||0);
          ball.vy*=-0.4;ball.vx*=0.6;if(Math.abs(ball.vy)<2){ball.life-=0.05*dt;}}
        if(ball.x>api.W+60||ball.x<-60)ball.life=0;
      }
      balls=balls.filter(b=>b.life>0);
      if(!balls.length)trail.length=0;
      // draw blocks
      for(const b of blocks)drawBlock(b);
      // shards
      for(const p of shards){p.vy+=grav*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
        if(p.y>groundY-2){p.y=groundY-2;p.vy*=-0.4;p.vx*=0.7;if(Math.abs(p.vy)<1.2)p.life-=0.04*dt;}
        p.life-=p.decay*dt;g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        g.fillStyle=p.color;
        if(p.shape==="circle"){g.beginPath();g.arc(0,0,Math.max(0,p.sw/2),0,TAU);g.fill();}
        else g.fillRect(-p.sw/2,-p.sh/2,Math.max(0,p.sw),Math.max(0,p.sh));
        g.restore();}
      shards=shards.filter(p=>p.life>0);
      // sparkles (additive-ish glow via lighter blend)
      g.save();g.globalCompositeOperation="lighter";
      for(const s of sparks){s.vy+=grav*0.4*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=s.decay*dt;
        g.globalAlpha=Math.max(0,s.life);g.fillStyle=s.col;g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;sparks=sparks.filter(s=>s.life>0);
      // ball motion trail
      g.save();g.globalCompositeOperation="lighter";
      for(let i=0;i<trail.length;i++){const t=trail[i],a=(i/trail.length)*0.5;
        g.globalAlpha=a;g.fillStyle="#ffb36a";g.beginPath();g.arc(t.x,t.y,t.r*(i/trail.length),0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      // balls draw: glowing iron sphere with squash/stretch + spec highlight
      for(const ball of balls){
        const dir=Math.atan2(ball.vy,ball.vx),sq=ball.sq||1;
        g.save();g.translate(ball.x,ball.y);g.rotate(dir);g.scale(sq,1/sq);
        // hot glow halo
        g.globalCompositeOperation="lighter";
        const hg=g.createRadialGradient(0,0,ball.r*0.4,0,0,ball.r*1.7);
        hg.addColorStop(0,"rgba(255,180,110,.6)");hg.addColorStop(1,"rgba(255,180,110,0)");
        g.fillStyle=hg;g.beginPath();g.arc(0,0,ball.r*1.7,0,TAU);g.fill();
        g.globalCompositeOperation="source-over";
        // 画像の砲弾(半径に合わせて正方形を center 描画)。無ければ手描きのキャンディ玉
        if(!api.drawAsset("ball.png",0,0,ball.r*2.2,ball.r*2.2,{center:true})){
          const gd=g.createRadialGradient(-ball.r*0.35,-ball.r*0.35,ball.r*0.15,0,0,ball.r);
          gd.addColorStop(0,"#fff3a8");gd.addColorStop(0.5,"#ff9bd2");gd.addColorStop(1,"#a35bd6");
          g.fillStyle=gd;g.beginPath();g.arc(0,0,ball.r,0,TAU);g.fill();
          // candy-swirl rim band
          g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=ball.r*0.12;g.beginPath();g.arc(0,0,ball.r*0.78,TAU*0.05,TAU*0.45);g.stroke();
          g.fillStyle="rgba(255,255,255,.85)";g.beginPath();g.arc(-ball.r*0.35,-ball.r*0.35,ball.r*0.24,0,TAU);g.fill();
        }
        // cute determined face (un-rotate so face stays upright)
        g.rotate(-dir);
        const er=ball.r*0.16;
        g.fillStyle="#fff";
        g.beginPath();g.arc(-ball.r*0.3,-ball.r*0.05,er,0,TAU);g.arc(ball.r*0.3,-ball.r*0.05,er,0,TAU);g.fill();
        g.fillStyle="#5a2a66";
        g.beginPath();g.arc(-ball.r*0.27,-ball.r*0.05,er*0.55,0,TAU);g.arc(ball.r*0.33,-ball.r*0.05,er*0.55,0,TAU);g.fill();
        // brave eyebrows
        g.strokeStyle="#5a2a66";g.lineWidth=Math.max(1.5,ball.r*0.07);g.lineCap="round";
        g.beginPath();g.moveTo(-ball.r*0.46,-ball.r*0.3);g.lineTo(-ball.r*0.14,-ball.r*0.2);
        g.moveTo(ball.r*0.46,-ball.r*0.3);g.lineTo(ball.r*0.14,-ball.r*0.2);g.stroke();
        // open shouting mouth
        g.fillStyle="#ff5a6a";g.beginPath();g.ellipse(0,ball.r*0.32,ball.r*0.2,ball.r*0.26,0,0,TAU);g.fill();
        g.restore();
      }
      // aim guide (dotted arc) while charging — shows exactly where the ball will go
      if(charging)drawAimGuide();
      // cannon
      drawCannon();
      // rebuild check
      const standArr=blocks.filter(b=>!b.loose);
      const standing=standArr.length;
      // last-stragglers forgiveness: leftover blocks wobble for a bit, then tumble by themselves
      // (prevents a soft-lock when the final blocks sit outside any reachable trajectory)
      if(standing>0&&standing<=3&&!rebuilding){
        calmT+=dt;
        for(const b of standArr)b.wob=clamp(calmT/190,0,1);
        if(calmT>=190){
          floats.push({x:standArr[0].x+standArr[0].w/2,y:standArr[0].y-12,txt:"ぐらぐら〜！",col:"#fff",life:1,vy:-0.7,size:24});
          for(const b of standArr)loosen(b,rnd(-1,1),-0.6,rnd(5,8));
          api.shake(6);api.noise(0.16,0.3,360,"lowpass");
          calmT=0;
        }
      }else calmT=0;
      // NOTE: don't wait for balls to disappear — kids spam-tap constantly, so
      // requiring an empty sky would soft-lock the rebuild forever
      if(standing===0&&blocks.length&&!rebuilding){
        rebuilding=true;flashWash=1;
        castlesCleared++;
        // star rating by shots used (fewer = better)
        const stars=shotsThisCastle<=2?3:shotsThisCastle<=4?2:1;
        const perfect=shotsThisCastle<=2;
        floats.push({x:api.W*0.6,y:api.H*0.32,txt:"ぜんかい！",col:"#ffd23f",life:1.1,vy:-0.6,size:46});
        starRating=stars;starTimer=1.3;   // canvas手描きの星でレーティング表示
        burst(api.W*0.6,api.H*0.4,"#fff3b0",26,9);burst(api.W*0.6,api.H*0.4,"#ff9bd2",20,8);
        api.shake(10);
        for(let s=0;s<stars;s++)api.tone(660*Math.pow(1.26,s),0.12,"sine",0.1);
        if(perfect){
          count+=15;api.setScore(count);
          floats.push({x:api.W*0.6,y:api.H*0.58,txt:"パーフェクト！",col:"#ff5fae",life:1.4,vy:-0.5,size:36});
          burst(api.W*0.6,api.H*0.5,"#fff",22,10);api.boom(0.6);api.slide(520,1560,0.3,0.12,"sine");
        }
        // ③ いちげきクリア: たった1発でお城をぜんぶ倒したら大ボーナス(低く狙う=頭を使う発見)
        if(shotsThisCastle===1){count+=12;api.setScore(count);
          floats.push({x:api.W/2,y:api.H*0.2,txt:"いちげき！ぜんぶ！",col:"#5ad1ff",life:1.4,vy:-0.5,size:34});
          burst(api.W*0.6,api.H*0.42,"#bfe9ff",20,9);
          api.tone(784,0.12,"square",0.1);api.tone(1176,0.14,"square",0.08);}
        if(castlesCleared>=GOAL){
          // FINAL WIN: full-screen celebration, then loop with a fresh run
          winBanner=true;winTimer=0;flashWash=1.6;
          for(let s=0;s<6;s++)api.tone(523*Math.pow(1.122,s),0.5,"triangle",0.12);
          api.boom(0.7);api.shake(14);
          burst(api.W*0.5,api.H*0.4,"#fff3b0",40,12);burst(api.W*0.5,api.H*0.4,"#ffd23f",30,11);burst(api.W*0.5,api.H*0.4,"#ff9bd2",30,11);
          // loop with a fresh run — but KEEP the score climbing (resetting it to 0 felt sad)
          setTimeout(()=>{level=1;castlesCleared=0;winBanner=false;buildCastle();rebuilding=false;},2600);
        }else{
          level++;setTimeout(()=>{buildCastle();rebuilding=false;},650);
        }
      }
      // power bar
      // ⑥ 見やすさ: 常時ヒント(下部, H-34〜H-4)とY帯が重ならないよう、パワーバーはさらに上に置く
      if(charging){const w=Math.min(api.W*0.5,240),x=baseX-20,y=api.H-74;
        g.fillStyle="rgba(0,0,0,.4)";rr(x,y,w,16,8);g.fill();
        const pg=g.createLinearGradient(x,0,x+w,0);
        pg.addColorStop(0,"#7ee0a0");pg.addColorStop(0.6,"#ffd23f");pg.addColorStop(1,"#ff3b3b");
        g.save();rr(x+2,y+2,(w-4)*power,12,6);g.clip();
        g.fillStyle=pg;g.fillRect(x,y,w,16);g.restore();
        // glow at the leading edge when nearly full
        if(power>0.85){g.save();g.globalCompositeOperation="lighter";const ex=x+2+(w-4)*power;
          const eg=g.createRadialGradient(ex,y+8,0,ex,y+8,16);eg.addColorStop(0,"rgba(255,80,80,.8)");eg.addColorStop(1,"rgba(255,80,80,0)");
          g.fillStyle=eg;g.beginPath();g.arc(ex,y+8,16,0,TAU);g.fill();g.restore();}
        // cute rounded label pill
        g.save();g.font="800 13px 'Hiragino Maru Gothic ProN',system-ui";
        const lw=((g.measureText("パワー")||0).width||0)+16;
        g.fillStyle="rgba(124,72,196,.85)";rr(x-2,y-24,lw,18,9);g.fill();
        g.fillStyle="rgba(255,255,255,.35)";rr(x,y-22,lw-4,7,5);g.fill();
        g.fillStyle="#fff";g.fillText("パワー",x+6,y-11);g.restore();}
      // climax full-screen color wash on clear
      if(flashWash>0){flashWash=Math.max(0,flashWash-0.03*dt);
        const fw=flashWash;
        g.save();g.globalCompositeOperation="lighter";
        const wg2=g.createRadialGradient(api.W*0.6,api.H*0.4,0,api.W*0.6,api.H*0.4,api.W*0.8);
        wg2.addColorStop(0,"rgba(255,245,200,"+(fw*0.7)+")");
        wg2.addColorStop(0.5,"rgba(255,170,225,"+(fw*0.4)+")");
        wg2.addColorStop(1,"rgba(180,130,255,0)");
        g.fillStyle=wg2;g.fillRect(0,0,api.W,api.H);
        g.restore();}
      // souvenir crowns flying up when a KING block falls
      for(const c of crowns){c.vy+=grav*0.25*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=c.vr*dt;c.life-=0.01*dt;
        g.save();g.globalAlpha=Math.max(0,c.life);g.translate(c.x,c.y);g.rotate(c.rot);
        g.fillStyle="#ffe14a";const cw=S*0.6;
        g.beginPath();g.moveTo(-cw/2,cw*0.32);g.lineTo(-cw/2,0);g.lineTo(-cw*0.25,cw*0.16);g.lineTo(0,-cw*0.08);g.lineTo(cw*0.25,cw*0.16);g.lineTo(cw/2,0);g.lineTo(cw/2,cw*0.32);g.closePath();g.fill();
        g.strokeStyle="#c9941f";g.lineWidth=2;g.stroke();
        g.fillStyle="#ff5fae";g.beginPath();g.arc(0,cw*0.05,cw*0.08,0,TAU);g.fill();
        g.restore();}
      g.globalAlpha=1;crowns=crowns.filter(c=>c.life>0&&c.y>-40);
      // progress HUD: how many castles smashed toward the goal, plus shots used
      // (上部中央・top chrome バーの下に置くので もどる/score と重ならない)
      const hudY=58;
      g.save();g.textAlign="left";g.font="800 15px 'Hiragino Maru Gothic ProN',system-ui";
      const hudT="おしろ "+clamp(castlesCleared,0,GOAL)+"/"+GOAL;
      const hudW=((g.measureText(hudT)||0).width||0)+22;
      const hudX=Math.round(api.W/2-(hudW+14+3*16)/2);
      g.fillStyle="rgba(126,79,196,.85)";rr(hudX,hudY,hudW,26,13);g.fill();
      g.fillStyle="rgba(255,255,255,.35)";rr(hudX+3,hudY+3,hudW-6,8,5);g.fill();
      g.fillStyle="#fff";g.fillText(hudT,hudX+10,hudY+18);
      // tiny shot pips (3 = star-3 window) so kids feel the "few shots" challenge
      for(let i=0;i<3;i++){g.fillStyle=i<shotsThisCastle?"rgba(255,255,255,.35)":"#ffd23f";
        g.beginPath();g.arc(hudX+hudW+14+i*16,hudY+13,6,0,TAU);g.fill();
        g.strokeStyle="rgba(126,79,196,.7)";g.lineWidth=2;g.stroke();}
      g.restore();g.textAlign="left";
      // FINAL WIN full-screen blessing: big crown, banner, drifting confetti feel
      if(winBanner){winTimer+=0.03*dt;
        g.save();
        g.fillStyle="rgba(40,20,70,.35)";g.fillRect(0,0,api.W,api.H);
        const cx=api.W/2,cy=api.H*0.4,pulse=1+0.06*Math.sin(winTimer*4);
        g.translate(cx,cy);g.scale(pulse,pulse);
        // giant crown
        g.fillStyle="#ffe14a";const cw=S*2.2;
        g.beginPath();g.moveTo(-cw/2,cw*0.34);g.lineTo(-cw/2,-cw*0.05);g.lineTo(-cw*0.25,cw*0.14);g.lineTo(0,-cw*0.2);g.lineTo(cw*0.25,cw*0.14);g.lineTo(cw/2,-cw*0.05);g.lineTo(cw/2,cw*0.34);g.closePath();g.fill();
        g.strokeStyle="#c9941f";g.lineWidth=4;g.stroke();
        g.fillStyle="#ff5fae";for(const jx of[-1,0,1]){g.beginPath();g.arc(jx*cw*0.28,cw*0.16,cw*0.07,0,TAU);g.fill();}
        g.restore();
        g.save();g.textAlign="center";g.font="900 "+clamp(api.W*0.07,30,64)+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=8;g.strokeStyle="rgba(90,40,120,.7)";g.strokeText("ぜんぶクリア！",api.W/2,api.H*0.66);
        g.fillStyle="#ffe14a";g.fillText("ぜんぶクリア！",api.W/2,api.H*0.66);
        g.font="800 "+clamp(api.W*0.035,16,28)+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.fillStyle="#fff";g.fillText("おしろを"+GOAL+"こ こわしたよ！",api.W/2,api.H*0.74);
        g.restore();g.textAlign="left";
      }
      // ② ラッキー命中の頭上スター(小さくキラッ=気づけるヒント)
      for(const p of luckyPops){p.y-=1.1*dt;p.life-=0.03*dt;
        drawStar(p.x,p.y,clamp(S*0.16,5,9)*(0.6+p.life*0.6),luckyColor,Math.max(0,p.life),true);}
      luckyPops=luckyPops.filter(p=>p.life>0);
      // floats
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.012*dt;g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,f.x,f.y);g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // star rating (canvas手描き — 絵文字グリフは使わない)
      if(starTimer>0){starTimer-=0.012*dt;
        const a=clamp(starTimer*2,0,1),sr=clamp(api.W*0.04,18,30),gapS=sr*2.4,sy2=api.H*0.46;
        const sx0=api.W*0.6-gapS;
        for(let i=0;i<3;i++){const lit=i<starRating,sx2=sx0+i*gapS;
          const pop=1+(lit?0.12*Math.sin(starTimer*8+i):0);
          drawStar(sx2,sy2,sr*pop,lit?"#ffe14a":"rgba(255,255,255,.22)",a,lit);}
      }
      // ① にじいろ！ 中央バナー(虹色に色替わり=レアの大きな祝福)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-0.9)*1.3,col=RCOLS[Math.floor(tSky*6)%RCOLS.length];
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 38px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText("にじいろブロック！",0,0);
        g.fillStyle=col;g.fillText("にじいろブロック！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 中央ヒント(初回だけ一度だけ教える)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.27);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(CNAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.4)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyMsgT<0)luckyMsgT=0;}
      // hint: cute rounded translucent panel with glow + outline
      g.save();g.textAlign="center";
      g.font="800 15px 'Hiragino Maru Gothic ProN',system-ui";
      const ht="ながおしで パワーをためて、はなして はっしゃ！";
      const hw=((g.measureText(ht)||0).width||0)+34,hh=30,hx=api.W/2-hw/2,hy=api.H-34;
      g.shadowColor="rgba(126,79,196,.5)";g.shadowBlur=14;
      g.fillStyle="rgba(255,255,255,.86)";rr(hx,hy,hw,hh,15);g.fill();
      g.shadowBlur=0;
      g.strokeStyle="rgba(167,121,224,.8)";g.lineWidth=2.5;rr(hx,hy,hw,hh,15);g.stroke();
      g.fillStyle="rgba(255,255,255,.5)";rr(hx+4,hy+3,hw-8,9,6);g.fill();
      g.fillStyle="#7e4fc4";g.fillText(ht,api.W/2,api.H-13);
      g.restore();g.textAlign="left";
      g.globalCompositeOperation="source-over"; // 加算の取り残し防止(白飛び対策の総仕上げ)
    }
  };
  function drawBlock(b){
    if(b.flash)b.flash=Math.max(0,b.flash-0.12);
    if(b.dent)b.dent=Math.max(0,b.dent-0.05);
    g.save();g.translate(b.x+b.w/2,b.y+b.h/2);
    if(b.loose)g.rotate(b.rot);else if(b.wob)g.rotate(Math.sin(b.blink*7)*0.09*b.wob);
    // ⑦ 形のバラエティ: circle=まるい岩(円)/wide=丸太(端を丸く)/tall=石柱(角を丸く)/square=従来のれんが
    const isCircle=b.shapeKey==="circle";
    const x=-b.w/2,y=-b.h/2;
    const r=isCircle?0:b.shapeKey==="wide"?Math.min(b.h*0.45,b.w*0.3):b.shapeKey==="tall"?Math.min(b.w*0.4,b.h*0.3):Math.min(6,b.w*0.18);
    const cRad=Math.max(0,Math.min(b.w,b.h)/2);
    const bodyPath=(ox,oy)=>{ox=ox||0;oy=oy||0;if(isCircle){g.beginPath();g.arc(ox,oy,cRad,0,TAU);}else rr(x+ox,y+oy,b.w,b.h,r);};
    // soft drop shadow
    g.fillStyle="rgba(0,0,0,.16)";bodyPath(3,4);g.fill();
    // ブロックは手描き(生成画像 block.png は不良だったので使わない。imgBlk は将来差し替え用のフラグ)
    const imgBlk=false;
    {
      // body gradient (top-lit)
      const bg=g.createLinearGradient(x,y,x,y+b.h);
      bg.addColorStop(0,shade(b.color,1.22));bg.addColorStop(0.5,b.color);bg.addColorStop(1,shade(b.color,0.74));
      if(b.kind==="rainbow"){
        const rbg=g.createLinearGradient(x,y,x+b.w,y+b.h),off=Math.floor(tSky*2);
        for(let i=0;i<=RCOLS.length;i++)rbg.addColorStop(clamp(i/RCOLS.length,0,1),RCOLS[(i+off)%RCOLS.length]);
        g.fillStyle=rbg;bodyPath();g.fill();
      }else{g.fillStyle=bg;bodyPath();g.fill();}
    }
    // wide(丸太)は木目、tall(石柱)は縦の継ぎ目、circle(岩)はひび割れで見た目を作り分ける
    if(b.shapeKey==="wide"){
      g.strokeStyle="rgba(90,60,30,.35)";g.lineWidth=Math.max(1,b.h*0.07);g.lineCap="round";
      g.beginPath();g.moveTo(x+b.w*0.16,y+b.h*0.32);g.lineTo(x+b.w*0.84,y+b.h*0.32);
      g.moveTo(x+b.w*0.16,y+b.h*0.64);g.lineTo(x+b.w*0.84,y+b.h*0.64);g.stroke();
    }else if(b.shapeKey==="tall"){
      g.strokeStyle="rgba(255,255,255,.25)";g.lineWidth=Math.max(1,b.w*0.09);
      g.beginPath();g.moveTo(0,y+b.h*0.14);g.lineTo(0,y+b.h*0.86);g.stroke();
    }else if(isCircle){
      g.strokeStyle="rgba(0,0,0,.18)";g.lineWidth=Math.max(1,b.w*0.045);
      g.beginPath();g.moveTo(-b.w*0.18,-b.h*0.12);g.lineTo(0,b.h*0.04);g.lineTo(b.w*0.16,-b.h*0.06);g.stroke();
    }
    // tough IRON block: bolt studs in the corners so it reads as metal
    if(b.kind==="iron"){
      g.fillStyle="rgba(60,72,88,.85)";
      const bo=b.w*0.16,br=b.w*0.07;
      for(const sxn of[-1,1])for(const syn of[-1,1]){g.beginPath();g.arc(sxn*(b.w/2-bo),syn*(b.h/2-bo),br,0,TAU);g.fill();}
      if(b.hp<b.maxhp){g.strokeStyle="rgba(30,30,40,.5)";g.lineWidth=2;g.beginPath();g.moveTo(-b.w*0.2,-b.h*0.1);g.lineTo(b.w*0.05,b.h*0.05);g.lineTo(-b.w*0.05,b.h*0.2);g.stroke();}
    }
    // ⑦ やぐら(2倍サイズの特大ピース): 上辺に凹凸(はり出し)を付けて「とう」らしく見せる
    if(b.kind==="yagura"){
      g.fillStyle="rgba(255,255,255,.28)";
      const nw=b.w/5;
      for(let i=0;i<5;i+=2)g.fillRect(x+i*nw,y-nw*0.5,nw,nw*0.5);
      g.strokeStyle="rgba(120,70,30,.4)";g.lineWidth=Math.max(1,b.w*0.03);
      g.beginPath();g.moveTo(x,y+b.h*0.5);g.lineTo(x+b.w,y+b.h*0.5);g.stroke();
      if(b.hp<b.maxhp){g.strokeStyle="rgba(120,70,30,.5)";g.lineWidth=3;g.beginPath();g.moveTo(-b.w*0.15,-b.h*0.1);g.lineTo(b.w*0.1,b.h*0.05);g.lineTo(-b.w*0.05,b.h*0.2);g.stroke();}
    }
    // KING block: little crown on top + sparkle ring so kids aim for it
    if(b.kind==="king"){
      g.fillStyle="#ffe98a";const cw=b.w*0.5,cy=-b.h*0.5-b.h*0.12;
      g.beginPath();g.moveTo(-cw/2,cy+b.h*0.16);g.lineTo(-cw/2,cy);g.lineTo(-cw*0.25,cy+b.h*0.08);g.lineTo(0,cy-b.h*0.04);g.lineTo(cw*0.25,cy+b.h*0.08);g.lineTo(cw/2,cy);g.lineTo(cw/2,cy+b.h*0.16);g.closePath();g.fill();
      g.strokeStyle="#c9941f";g.lineWidth=1.5;g.stroke();
    }
    // ①/② 頭上サイン: にじいろは虹のキラッ、ラッキー色はちいさな星(気づけるヒント)
    if(!b.loose&&b.kind==="rainbow"){
      const tw=0.5+0.5*Math.sin(b.blink*3+tSky*6),yy=-b.h*0.5-8;
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.5+0.5*tw;
      g.fillStyle=RCOLS[Math.floor(b.blink*2+tSky*4)%RCOLS.length];
      const r1=5+3*tw;g.beginPath();
      g.moveTo(0,yy-r1);g.lineTo(r1*0.34,yy);g.lineTo(0,yy+r1);g.lineTo(-r1*0.34,yy);g.closePath();
      g.moveTo(-r1,yy);g.lineTo(0,yy+r1*0.34);g.lineTo(r1,yy);g.lineTo(0,yy-r1*0.34);g.closePath();
      g.fill();g.restore();g.globalAlpha=1;
    }else if(!b.loose&&b.kind==="brick"&&b.color===luckyColor){
      const tw=0.5+0.5*Math.sin(b.blink*2+tSky*4),yy=-b.h*0.5-6;
      g.save();g.globalAlpha=0.35+0.4*tw;g.fillStyle="#fff7c2";
      const r1=3+2*tw;g.beginPath();
      g.moveTo(0,yy-r1);g.lineTo(r1*0.3,yy);g.lineTo(0,yy+r1);g.lineTo(-r1*0.3,yy);g.closePath();
      g.moveTo(-r1,yy);g.lineTo(0,yy+r1*0.3);g.lineTo(r1,yy);g.lineTo(0,yy-r1*0.3);g.closePath();
      g.fill();g.restore();g.globalAlpha=1;
    }
    // glossy top sheen + outline (画像ブロックは絵にツヤがあるので省く)
    if(!imgBlk){
      if(isCircle){
        g.fillStyle="rgba(255,255,255,.32)";
        g.beginPath();g.ellipse(-b.w*0.18,-b.h*0.2,Math.max(0,b.w*0.22),Math.max(0,b.h*0.14),-0.4,0,TAU);g.fill();
        g.strokeStyle="rgba(0,0,0,.28)";g.lineWidth=2;bodyPath();g.stroke();
      }else{
        g.fillStyle="rgba(255,255,255,.3)";rr(x+1,y+1,b.w-2,b.h*0.32,r*0.7);g.fill();
        // inner edge highlight + outline
        g.strokeStyle="rgba(255,255,255,.18)";g.lineWidth=1.5;rr(x+1.5,y+1.5,b.w-3,b.h-3,r*0.7);g.stroke();
        g.strokeStyle="rgba(0,0,0,.28)";g.lineWidth=2;rr(x,y,b.w,b.h,r);g.stroke();
      }
    }
    // cute face on the block
    const hurt=(b.flash>0)||b.loose;
    const ex=b.w*0.22,ey=-b.h*0.06,eyR=b.w*0.1;
    g.lineCap="round";g.lineJoin="round";
    if(hurt){
      // dizzy "x x" eyes + open mouth (oh no!)
      g.strokeStyle="#2a2a33";g.lineWidth=Math.max(2,b.w*0.07);
      g.beginPath();
      g.moveTo(-ex-eyR,ey-eyR);g.lineTo(-ex+eyR,ey+eyR);g.moveTo(-ex+eyR,ey-eyR);g.lineTo(-ex-eyR,ey+eyR);
      g.moveTo(ex-eyR,ey-eyR);g.lineTo(ex+eyR,ey+eyR);g.moveTo(ex+eyR,ey-eyR);g.lineTo(ex-eyR,ey+eyR);
      g.stroke();
      g.fillStyle="#2a2a33";g.beginPath();g.ellipse(0,b.h*0.22,b.w*0.1,b.w*0.12,0,0,TAU);g.fill();
    }else{
      // blinking eyes
      const blink=Math.sin(b.blink)>0.93;
      g.fillStyle="#2a2a33";
      if(blink){
        g.lineWidth=Math.max(2,b.w*0.06);g.strokeStyle="#2a2a33";
        g.beginPath();g.moveTo(-ex-eyR*0.7,ey);g.lineTo(-ex+eyR*0.7,ey);g.moveTo(ex-eyR*0.7,ey);g.lineTo(ex+eyR*0.7,ey);g.stroke();
      }else{
        g.beginPath();g.arc(-ex,ey,eyR,0,TAU);g.arc(ex,ey,eyR,0,TAU);g.fill();
        g.fillStyle="rgba(255,255,255,.9)";
        g.beginPath();g.arc(-ex+eyR*0.3,ey-eyR*0.3,eyR*0.4,0,TAU);g.arc(ex+eyR*0.3,ey-eyR*0.3,eyR*0.4,0,TAU);g.fill();
      }
      // little smile
      g.strokeStyle="#2a2a33";g.lineWidth=Math.max(2,b.w*0.06);
      g.beginPath();g.arc(0,b.h*0.1,b.w*0.16,0.15*Math.PI,0.85*Math.PI);g.stroke();
      // rosy cheeks
      g.fillStyle="rgba(255,120,120,.4)";
      g.beginPath();g.arc(-ex-eyR*1.4,ey+eyR*1.2,eyR*0.7,0,TAU);g.arc(ex+eyR*1.4,ey+eyR*1.2,eyR*0.7,0,TAU);g.fill();
    }
    // bright hit flash overlay
    if(b.flash>0){g.fillStyle="rgba(255,255,255,"+(b.flash*0.7)+")";bodyPath();g.fill();}
    g.restore();
  }
  function rr(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function shade(hex,f){
    const n=parseInt(hex.slice(1),16);
    let R=clamp(Math.round(((n>>16)&255)*f),0,255),G=clamp(Math.round(((n>>8)&255)*f),0,255),B=clamp(Math.round((n&255)*f),0,255);
    return "rgb("+R+","+G+","+B+")";
  }
  function drawStar(cx,cy,r,col,alpha,glow){
    g.save();g.globalAlpha=clamp(alpha==null?1:alpha,0,1);g.translate(cx,cy);
    if(glow){g.shadowColor="#ffd23f";g.shadowBlur=14;}
    g.beginPath();
    for(let i=0;i<5;i++){const a=-Math.PI/2+i*TAU/5;g.lineTo(Math.cos(a)*r,Math.sin(a)*r);
      const a2=a+TAU/10;g.lineTo(Math.cos(a2)*r*0.46,Math.sin(a2)*r*0.46);}
    g.closePath();g.fillStyle=col;g.fill();g.shadowBlur=0;
    g.lineWidth=Math.max(1.5,r*0.08);g.strokeStyle="rgba(120,80,0,.5)";g.stroke();
    g.restore();
  }
  function drawAimGuide(){
    const spd=shotSpeed();
    let px=baseX+Math.cos(elev)*S*1.8, py=baseY-S*0.7-Math.sin(elev)*S*1.8;
    let vx=Math.cos(elev)*spd, vy=-Math.sin(elev)*spd;
    g.save();
    for(let i=0;i<70;i++){
      vy+=grav;px+=vx;py+=vy;
      if(py>groundY-2||px>api.W+20||px<0)break;
      if(i%3===0){const a=clamp(1-i/70,0.12,0.85),rr2=clamp(S*0.13*(1-i/140),2,7);
        g.globalAlpha=a;g.fillStyle="rgba(255,255,255,.95)";g.beginPath();g.arc(px,py,rr2,0,TAU);g.fill();
        g.fillStyle="rgba(255,205,70,.7)";g.beginPath();g.arc(px,py,rr2*0.5,0,TAU);g.fill();}
    }
    g.globalAlpha=1;g.restore();
  }
  function drawCannon(){
    if(muzzle>0)muzzle=Math.max(0,muzzle-0.12);
    const x=baseX,y=baseY;
    g.save();
    // barrel
    g.save();g.translate(x,y-S*0.7);g.rotate(-elev);
    // 画像の大砲(右向き・胴つき)。筒の軸が画像の少し下(0.56H)なので中心を上に寄せ、
    // 筒の長さ S*2 に合わせ正方形を S*2.3 で描く。底の脚/影(下 15%)は clip で切る。無ければ手描きのキャンディ砲
    const bD=S*2.3,bY=-S*0.138;
    let imgBarrel=false;
    if(api.asset("barrel.png").ready){
      g.save();g.beginPath();g.rect(-S*0.2,bY-bD/2,bD+S*0.1,S*0.67-(bY-bD/2));g.clip();
      imgBarrel=api.drawAsset("barrel.png",S*1.0,bY,bD,bD,{center:true});
      g.restore();
    }
    if(!imgBarrel){
      const bg=g.createLinearGradient(0,-S*0.32,0,S*0.32);
      bg.addColorStop(0,"#cfa9ef");bg.addColorStop(0.45,"#a779e0");bg.addColorStop(1,"#7e4fc4");
      g.fillStyle=bg;rr(0,-S*0.32,S*2,S*0.64,S*0.16);g.fill();
      g.fillStyle="rgba(255,255,255,.4)";rr(0,-S*0.3,S*2,S*0.14,S*0.1);g.fill();
      // candy stripe rings down the barrel
      g.fillStyle="rgba(255,247,160,.7)";
      for(let i=1;i<=3;i++){rr(S*(0.4*i)-S*0.05,-S*0.32,S*0.1,S*0.64,S*0.05);g.fill();}
      // golden muzzle ring
      g.fillStyle="#ffd23f";rr(S*1.82,-S*0.4,S*0.22,S*0.8,5);g.fill();
      g.strokeStyle="rgba(180,120,30,.6)";g.lineWidth=2;rr(S*1.82,-S*0.4,S*0.22,S*0.8,5);g.stroke();
    }
    // muzzle flash burst at barrel tip
    if(muzzle>0){g.save();g.globalCompositeOperation="lighter";g.translate(S*2.05,0);
      const fg=g.createRadialGradient(0,0,0,0,0,S*1.1*muzzle);
      fg.addColorStop(0,"rgba(255,250,210,"+muzzle+")");fg.addColorStop(0.5,"rgba(255,170,60,"+(muzzle*0.7)+")");fg.addColorStop(1,"rgba(255,120,40,0)");
      g.fillStyle=fg;g.beginPath();g.arc(0,0,S*1.1*muzzle,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,"+muzzle+")";
      for(let i=0;i<5;i++){const a=(i/5)*TAU+muzzle;g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a)*S*0.9*muzzle,Math.sin(a)*S*0.4*muzzle);g.lineTo(Math.cos(a+0.3)*S*0.3,Math.sin(a+0.3)*S*0.2);g.closePath();g.fill();}
      g.restore();}
    g.restore();
    // body (radial metal) ※画像の大砲は胴つきなので、画像の時は描かない
    if(!imgBarrel){
      const cg=g.createRadialGradient(x-S*0.2,y-S*0.7,S*0.1,x,y-S*0.5,S*0.8);
      cg.addColorStop(0,"#7a5a40");cg.addColorStop(1,"#4a3424");
      g.fillStyle=cg;g.beginPath();g.arc(x,y-S*0.5,S*0.7,0,TAU);g.fill();
      g.strokeStyle="rgba(0,0,0,.3)";g.lineWidth=2;g.beginPath();g.arc(x,y-S*0.5,S*0.7,0,TAU);g.stroke();
    }
    // wheel: 画像の車輪(外形が枠の94%なので半径 S*0.55 に合わせ正方形を 2.2 倍で center 描画)。無ければ手描きのピンク車輪
    if(!api.drawAsset("wheel.png",x,y,S*0.55*2.2,S*0.55*2.2,{center:true})){
      const wg=g.createRadialGradient(x-S*0.15,y-S*0.15,S*0.05,x,y,S*0.55);
      wg.addColorStop(0,"#ff9bc7");wg.addColorStop(1,"#e0568f");
      g.fillStyle=wg;g.beginPath();g.arc(x,y,S*0.55,0,TAU);g.fill();
      g.strokeStyle="rgba(255,255,255,.55)";g.lineWidth=4;for(let i=0;i<4;i++){g.save();g.translate(x,y);g.rotate(i*Math.PI/2);g.beginPath();g.moveTo(0,0);g.lineTo(0,S*0.5);g.stroke();g.restore();}
    }
    // cute hub-face mascot (happy when firing)
    const hubR=S*0.26;
    const hg2=g.createRadialGradient(x-hubR*0.4,y-hubR*0.4,hubR*0.2,x,y,hubR);
    hg2.addColorStop(0,"#ffe08a");hg2.addColorStop(1,"#f3a93b");
    g.fillStyle=hg2;g.beginPath();g.arc(x,y,hubR,0,TAU);g.fill();
    g.strokeStyle="#b9742a";g.lineWidth=2;g.beginPath();g.arc(x,y,hubR,0,TAU);g.stroke();
    const happy=muzzle>0.05;
    g.fillStyle="#3a2a1a";g.lineCap="round";
    if(happy){
      // ^_^ joyful eyes
      g.strokeStyle="#3a2a1a";g.lineWidth=Math.max(2,hubR*0.18);
      g.beginPath();
      g.arc(x-hubR*0.4,y-hubR*0.15,hubR*0.28,1.1*Math.PI,1.9*Math.PI);
      g.arc(x+hubR*0.4,y-hubR*0.15,hubR*0.28,1.1*Math.PI,1.9*Math.PI);g.stroke();
    }else{
      g.beginPath();g.arc(x-hubR*0.4,y-hubR*0.05,hubR*0.16,0,TAU);g.arc(x+hubR*0.4,y-hubR*0.05,hubR*0.16,0,TAU);g.fill();
    }
    // smile (bigger when firing)
    g.strokeStyle="#3a2a1a";g.lineWidth=Math.max(2,hubR*0.16);
    g.beginPath();g.arc(x,y+hubR*0.18,hubR*0.4,0.12*Math.PI,0.88*Math.PI);g.stroke();
    g.fillStyle="rgba(255,110,110,.45)";
    g.beginPath();g.arc(x-hubR*0.62,y+hubR*0.22,hubR*0.18,0,TAU);g.arc(x+hubR*0.62,y+hubR*0.22,hubR*0.18,0,TAU);g.fill();
    g.restore();
  }
}
Engine.register("cannon", buildCannon);
