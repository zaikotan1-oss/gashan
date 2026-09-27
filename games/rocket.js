function buildRocket(api){
  const g=api.g;
  // 画像アセット: 背景のみ採用。スプライト4種(block/rocket/launcher/core)は生成が2回とも不良
  // (床影・マゼンタ被り・向き違い・別物)だったため、当面は手描きのまま。IMG_SPRITES を true にすれば画像に切替。
  const IMG_SPRITES=false;
  api.preload(IMG_SPRITES?["bg.jpg","block.png","rocket.png","launcher.png","core.png"]:["bg.jpg"]);
  let imgBg=false;                             // 今フレーム背景画像が出ているか(平坦な手描き背景要素をスキップする合図)
  let blocks=[],rockets=[],pending=[],rings=[],sparks=[],shards=[],floats=[],trails=[],stars=[],embers=[],clouds=[],motes=[];
  let bigFlash=0,flashCol="255,240,200";
  let S,fortX,fortTop,cols,rows,descend,level,count,launchX,launchY,firing,aimX,aimY,fireT,warnT;
  let tNow=0,muzzle=0;
  let chainCount=0,chainT=0,bestChain=0;      // combo tracking per blast wave
  let bossCore=null,bannerT=0,bannerTxt="",bannerSub="";
  let stageClearing=false;
  const MAXLV=5;                               // final stage
  const COLORS=["#ff6b4a","#4aa6ff","#ffd23f","#4fd99a","#ff9e54","#b07cff","#ff77b4"];
  const COLNAME={"#ff6b4a":"あか","#4aa6ff":"あお","#ffd23f":"きいろ","#4fd99a":"みどり","#ff9e54":"オレンジ","#b07cff":"むらさき","#ff77b4":"ピンク"};
  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマー/トラックと同じ思想) ----
  let luckyColor=pick(COLORS),luckySeen=false,luckyMsgT=0,rbMsgT=0;  // ②きょうのラッキー色
  let stagePushed=false;                        // ③ パーフェクト判定(この砦で おしもどせ! が起きたか)
  let pushBackActive=false;                      // 軸3: 「おしもどせ！」演出の連続再発火を防ぐ状態フラグ
  let star=null;                                // ④ ながれ星
  function initStars(){stars=[];for(let i=0;i<70;i++)stars.push({x:rnd(0,1),y:rnd(0,1),r:rnd(0.6,2.2),tw:rnd(0,TAU),sp:rnd(0.02,0.06)});}
  function initAmbient(){
    clouds=[];for(let i=0;i<5;i++)clouds.push({x:rnd(0,1),y:rnd(0.15,0.6),sc:rnd(0.7,1.5),sp:rnd(0.0006,0.0018)*(Math.random()<0.5?1:-1)});
    motes=[];for(let i=0;i<26;i++)motes.push({x:rnd(0,1),y:rnd(0,1),r:rnd(1,3),vy:rnd(-0.12,-0.04),drift:rnd(0,TAU),ds:rnd(0.01,0.03),hue:pick(["#ffe7a0","#bfe6ff","#ffd0e6","#d8ffe0"])});}
  initStars();initAmbient();
  function layout(){
    launchX=api.W/2; launchY=api.H*0.85;               // 軸6: 大砲を少し上げて画面下端に埋もれさせない
    S=clamp(Math.floor(api.W/9),42,68);                 // 軸6: ブロックを一回り大きく見せる
    cols=clamp(4+level,4,Math.floor(api.W*0.8/S));
    fortX=Math.round((api.W-cols*S)/2);
    blocks.forEach(b=>{b.x=fortX+b.col*S;});
  }
  function newFort(){
    stageClearing=false;
    stagePushed=false;                        // ③ パーフェクト判定リセット
    pushBackActive=false;                     // 軸3: 新しい砦では押し戻しフラグもリセット
    level++; rows=clamp(4+level,5,8);
    layout();
    blocks=[];bossCore=null;
    const isBoss=(level%4===0);            // every 4th stage is a boss fort
    const tint=COLORS[(level-1)%COLORS.length];   // palette steps each stage
    for(let r=0;r<rows;r++){
      let skipNext=false;
      for(let c=0;c<cols;c++){
        if(skipNext){skipNext=false;continue;}
        if(level>2&&Math.random()<0.12)continue;
        const b={col:c,row:r,x:fortX+c*S,color:Math.random()<0.7?tint:pick(COLORS),hp:1,kind:"square",w:S,h:S};
        // 軸7 形のバラエティ: 四角いブロック一色にしない。丸いタンク的/UFO的/でっかい2マス箱を混ぜる(出現率アップ)
        const kv=Math.random();
        if(c<cols-1 && kv<0.10){                 // でっかい箱(2マス幅・耐久3)。右隣のマスを予約する
          b.kind="big";b.w=S*2;b.h=S;b.hp=3;skipNext=true;
        } else if(kv<0.20){
          b.kind="round";                        // 丸いタンク的(見た目だけ違う。あたり判定は通常マスと同じ)
        } else if(kv<0.30){
          b.kind="ufo";                          // 横長のUFO/ドーム型(丸タンクとも輪郭が違う)
        }
        // variety at higher levels: iron blocks (2 hits) + bomb blocks (splash) ※四角の的にだけ乗せる
        if(level>=3 && b.kind==="square"){
          const rv=Math.random();
          if(rv<0.10){b.bomb=true;b.color="#ff4444";}
          else if(rv<0.32){b.iron=true;b.hp=2;b.color="#9aa6b8";}   // 7〜8歳向け: 鉄ブロック少し多め(0.18→0.22)
        }
        blocks.push(b);
      }
    }
    // 軸7 保証: この砦に「でっかい的」が1つも無ければ、1個だけ big に差し替える(毎ステージ最低1種類は違う大きさを見せる)
    if(blocks.length && !blocks.some(b=>b.kind==="big")){
      const cand=blocks.filter(b=>b.kind==="square"&&!b.bomb&&!b.iron&&b.col<cols-1);
      if(cand.length){
        const bigB=pick(cand);
        const ni=blocks.findIndex(o=>o!==bigB&&o.row===bigB.row&&o.col===bigB.col+1);
        if(ni>=0)blocks.splice(ni,1);
        bigB.kind="big";bigB.w=S*2;bigB.h=S;bigB.hp=3;bigB.bomb=false;bigB.iron=false;
      }
    }
    // 軸7 保証②: 「物」らしい形(square以外)が1砦に最低2〜3個は混ざるように、足りなければ四角を丸/UFOへ差し替える
    {
      const haveVariety=blocks.filter(b=>b.kind!=="square").length;
      const need=clamp(3-haveVariety,0,3);
      if(need>0){
        const cand=blocks.filter(b=>b.kind==="square"&&!b.bomb&&!b.iron);
        for(let i=0;i<need&&cand.length;i++){
          const idx=rint(0,cand.length-1);
          const bb=cand.splice(idx,1)[0];
          bb.kind=Math.random()<0.5?"round":"ufo";
        }
      }
    }
    // ① にじいろブロック: ときどき砦に1個だけ紛れ込む(激レアの当たり・鉄/爆弾を上書き、big/roundは対象外)
    if(blocks.length && Math.random()<0.4){
      const cands2=blocks.filter(b=>b.kind==="square");
      if(cands2.length){
        const rb=pick(cands2);
        rb.rainbow=true; rb.iron=false; rb.bomb=false; rb.hp=1;
      }
    }
    // ⑤ たまごブロック(軸7補助): 生き物っぽい壊れ方が違う新オブジェクト。2発当てるとヒビ→ぱりんと割れる
    if(blocks.length && Math.random()<0.5){
      const cands3=blocks.filter(b=>b.kind==="square"&&!b.bomb&&!b.iron&&!b.rainbow);
      if(cands3.length){
        const eb=pick(cands3);
        eb.kind="egg";eb.hp=2;eb.cracked=false;
      }
    }
    // boss core: a big tough HP block in the centre top that needs many hits/chains
    if(isBoss){
      const cc=Math.floor(cols/2);
      const bossHp=(level===4?5:9);   // 軸3: 初回ボスをさらに柔らかく(『おしもどせ！』で長時間詰まる問題の再対処)
      bossCore={col:cc,row:0,x:fortX+cc*S,hp:bossHp,maxhp:bossHp,flash:0};
    }
    // start partly on-screen so the kid can hit it almost immediately (less dead time)
    fortTop=-Math.round(rows*S*(level===1?0.10:0.16))-10;   // 軸6: HUD帯の通過時間を短縮(0.42→0.16)。レベル1だけさらに浅く(0.10)して砦出現直後に的が見えない時間を短縮
    descend=0.2+level*0.044;                  // 7〜8歳向け: 降下を約25%速く(0.16+0.035L → 0.2+0.044L)
    if(isBoss)descend=Math.min(descend,0.30); // 軸3: ボス戦だけ降下を頭打ちにして『おしもどせ！』までの猶予を増やす
    aimX=api.W/2;aimY=api.H*0.4;
    // stage banner + fanfare (engine handles its own banners; this is our in-game one)
    bannerTxt=isBoss?"ボスとりで！":"ステージ "+level;
    bannerSub=isBoss?"おおきいコアを れんさで わろう！":"";
    bannerT=1;
    if(isBoss){api.slide(220,560,0.5,0.16,"square");api.tone(330,0.5,"sawtooth",0.1);api.boom(0.4);api.shake(8);}
    else{api.tone(523,0.12,"square",0.12);api.tone(659,0.12,"square",0.1);setTimeout(()=>api.tone(784,0.2,"square",0.12),120);}
  }
  function blockY(b){return fortTop+b.row*S;}
  function coreActive(){return bossCore&&bossCore.hp>0;}
  function fortEmpty(){return blocks.length===0&&!coreActive();}
  function clearStage(){
    if(stageClearing)return; stageClearing=true;
    if(level>=MAXLV){
      // final all-stage victory: full-screen celebration
      floats.push({x:api.W/2,y:api.H*0.42,txt:"ぜんステージ クリア！",col:"#ffd23f",life:1.4,vy:-0.5,size:46});
      bigFlash=Math.max(bigFlash,0.7);flashCol="255,240,200";api.boom(0.6);api.shake(26);api.hitStop(4);
      api.slide(523,1047,0.6,0.18,"square");setTimeout(()=>api.slide(659,1319,0.6,0.16,"square"),140);
      setTimeout(()=>{level=0;newFort();},1900);   // loop again (score kept)
    }else{
      floats.push({x:api.W/2,y:api.H*0.4,txt:"ステージ クリア！",col:"#ffd23f",life:1,vy:-0.7,size:48});
      // give every clear a little reward burst (shake + warm flash), not just boss kills
      bigFlash=Math.max(bigFlash,0.4);flashCol="255,238,190";api.boom(0.4);api.shake(16);api.hitStop(2);
      api.tone(784,0.14,"square",0.13);setTimeout(()=>api.tone(1047,0.22,"square",0.13),130);
      setTimeout(()=>api.tone(1319,0.2,"square",0.11),260);
      // burst of celebratory sparks around the banner
      for(let i=rint(14,20);i>0;i--){const a=rnd(0,TAU),s=rnd(3,9);
        sparks.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(2,5),life:1,decay:rnd(0.012,0.03),col:pick(["#ffe89a","#ffd23f","#ff8ad6","#9fe0ff","#fff"]),glow:1});}
      // ③ パーフェクト: 一度も おしもどせ! させずにクリア → ＋5 & 祝福
      if(!stagePushed){count+=5;api.setScore(count);
        floats.push({x:api.W/2,y:api.H*0.5,txt:"パーフェクト！＋5",col:"#7be08a",life:1,vy:-0.7,size:38});
        api.tone(1318,0.14,"triangle",0.1);api.tone(1976,0.16,"triangle",0.07);}
      setTimeout(newFort,650);
    }
  }
  function fire(){
    const dx=aimX-launchX, dy=aimY-launchY, d=Math.hypot(dx,dy)||1;
    const sp=11;
    const nx=dx/d,ny=dy/d;
    rockets.push({x:launchX,y:launchY-30,vx:nx*sp,vy:ny*sp,a:Math.atan2(dy,dx),life:1,trail:0,hue:pick(["#ffd23f","#ff9e54","#9fe0ff"])});
    muzzle=1;
    for(let i=rint(2,3);i>0;i--){const a=Math.atan2(dy,dx)+rnd(-0.5,0.5),s=rnd(1,3);
      embers.push({x:launchX-nx*8,y:launchY-30-ny*8,vx:-nx*s+rnd(-1,1),vy:-ny*s+rnd(-1,1),r:rnd(2,4),life:1,decay:rnd(0.04,0.07),col:pick(["#ffce3a","#ff8c42"])});}
    api.slide(720,300,0.16,0.11,"sawtooth");api.noise(0.06,0.05,2600);
  }
  function shatter(bx,by,r,color,kind){
    // 軸7 壊れ方のバラエティ: 種類ごとに砕け方を変える(いつも同じ正方形の破片にしない)
    if(kind==="big"){                          // でっかい箱: ゆっくり真下に崩れ落ちる
      for(let k=rint(5,8);k>0;k--)shards.push({x:bx+rnd(-S*0.7,S*0.7),y:by+rnd(-S/3,S/3),
        vx:rnd(-2,2),vy:rnd(-2,0.5),s:rnd(S*0.2,S*0.4),color:color,rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.007,0.011),heavy:true});
    } else if(kind==="round"){                 // 丸いタンク: 丸い粒が飛び散る
      for(let k=rint(4,7);k>0;k--)shards.push({x:bx+rnd(-S/3,S/3),y:by+rnd(-S/3,S/3),
        vx:rnd(-7,7),vy:rnd(-10,-2),s:rnd(S*0.12,S*0.24),color:color,rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.008,0.014),round:true});
    } else if(kind==="ufo"){                   // UFO: 円盤のかけらが水平に吹っ飛ぶ(いつもと違う軌道)
      for(let k=rint(5,8);k>0;k--)shards.push({x:bx+rnd(-S*0.5,S*0.5),y:by+rnd(-S*0.15,S*0.15),
        vx:rnd(-9,9),vy:rnd(-5,-1),s:rnd(S*0.1,S*0.2),color:color,rot:rnd(0,TAU),vr:rnd(-0.6,0.6),life:1,decay:rnd(0.01,0.016),round:true});
    } else if(kind==="egg"){                   // たまご: 殻の破片(白)と黄身(黄色)が別々に飛び散る、いつもと違う壊れ方
      for(let k=rint(3,5);k>0;k--)shards.push({x:bx+rnd(-S*0.3,S*0.3),y:by+rnd(-S*0.3,S*0.3),
        vx:rnd(-5,5),vy:rnd(-8,-1),s:rnd(S*0.12,S*0.22),color:"#fff7e0",rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.018),round:true});
      for(let k=rint(3,5);k>0;k--)shards.push({x:bx+rnd(-S*0.2,S*0.2),y:by+rnd(-S*0.15,S*0.15),
        vx:rnd(-3,3),vy:rnd(-4,0.5),s:rnd(S*0.08,S*0.15),color:"#ffd23f",rot:0,vr:0,life:1,decay:rnd(0.012,0.02),round:true});
    } else {
      for(let k=rint(4,7);k>0;k--)shards.push({x:bx+rnd(-S/3,S/3),y:by+rnd(-S/3,S/3),
        vx:rnd(-7,7),vy:rnd(-10,-2),s:rnd(S*0.14,S*0.3),color:color,rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:rnd(0.008,0.014)});
    }
  }
  function rainbowFx(x,y,r){
    // ① にじいろブロック撃破: 虹色のきらめき＋ワイド誘爆＋大量得点
    rbMsgT=1.3;count+=8;bigFlash=Math.max(bigFlash,0.32);flashCol="255,220,240";
    api.boom(0.5);api.shake(14);
    api.tone(880,0.1,"triangle",0.1);api.tone(1320,0.12,"triangle",0.09);api.tone(1760,0.14,"triangle",0.07);
    for(let k=0;k<6;k++)rings.push({x,y,r:r*0.3,max:r*(1.15+k*0.13),life:1,flash:0});
    for(let i=0;i<28;i++){const a=rnd(0,TAU),s=rnd(3,10);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(2,5),life:1,decay:rnd(0.014,0.03),col:COLORS[i%COLORS.length],glow:1});}
    pending.push({x,y,r:r*1.0,gen:1,delay:2});   // 虹の誘爆(まわりも巻き込む)
    floats.push({x,y:y-10,txt:"にじいろ！",col:"#ff8ad6",life:1,vy:-0.8,size:36});
  }
  function eggFx(x,y){
    // ⑤ たまご はかい: 破片(殻/黄身)は shatter() 側、ここは可愛い演出だけ担当
    floats.push({x,y:y-8,txt:"ぴよっ！",col:"#fff7d8",life:0.9,vy:-0.9,size:24});
    api.tone(1200,0.07,"triangle",0.08);api.tone(900,0.07,"triangle",0.06);
    for(let i=0;i<10;i++){const a=rnd(0,TAU),s=rnd(2,6);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(2,4),life:1,decay:rnd(0.02,0.035),col:pick(["#ffe89a","#fff7e0","#fff"]),glow:1});}
  }
  function luckyFx(x,y,col){
    // ② ラッキー色命中: 小さな祝福(控えめ)。初回だけ色を教える
    count+=1;if(!luckySeen){luckyMsgT=1.6;luckySeen=true;}
    api.tone(1046,0.09,"triangle",0.09);api.tone(1568,0.11,"triangle",0.07);
    for(let i=0;i<7;i++){const a=rnd(0,TAU),s=rnd(2,6);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(2,4),life:1,decay:rnd(0.02,0.04),col:col,glow:1});}
  }
  function spawnStar(){
    // ④ ながれ星: 上空を横切る。ロケットで撃つとラッキースター
    const fromLeft=Math.random()<0.5, y=rnd(api.H*0.12,api.H*0.4);
    star={x:fromLeft?-20:api.W+20,y,vx:(fromLeft?1:-1)*rnd(3.2,5),vy:rnd(0.4,1.1),tw:0,hit:false};
  }
  function hitStar(){
    if(!star)return;star.hit=true;
    count+=5;api.setScore(count);
    floats.push({x:star.x,y:star.y,txt:"ラッキースター！＋5",col:"#9fe0ff",life:1,vy:-0.7,size:34});
    bigFlash=Math.max(bigFlash,0.28);flashCol="200,230,255";api.boom(0.4);api.shake(10);
    api.tone(1318,0.1,"triangle",0.1);api.tone(1976,0.12,"triangle",0.08);
    for(let i=0;i<20;i++){const a=rnd(0,TAU),s=rnd(2,8);
      sparks.push({x:star.x,y:star.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(2,5),life:1,decay:rnd(0.015,0.03),col:pick(["#9fe0ff","#fff","#ffd23f","#ff8ad6"]),glow:1});}
    star=null;
  }
  function explode(x,y,r,gen){
    if(gen===0&&pending.length===0)chainCount=0;   // fresh wave (no chain in flight): reset combo
    rings.push({x,y,r:r*0.35,max:r*1.35,life:1,flash:1});
    if(gen===0){api.hitStop(2);bigFlash=Math.max(bigFlash,0.28);flashCol="255,236,180";}
    else if(gen>=2){bigFlash=Math.max(bigFlash,0.5);flashCol="255,210,120";}
    api.slide(150-gen*15,42,0.4-gen*0.04,0.5,"sine");api.noise(0.3,0.4/(gen+1),700,"lowpass");api.boom(clamp(0.6-gen*0.14,0.2,0.6));
    api.shake(clamp(r*0.2,5,32));
    for(let i=rint(10,18);i>0;i--){const a=rnd(0,TAU),s=rnd(3,11);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5.5),life:1,decay:rnd(0.018,0.04),col:pick(["#ffe89a","#ffd23f","#ff8c42","#fff","#ff5b3b"]),glow:1});}
    for(let i=rint(4,7);i>0;i--){const a=rnd(0,TAU),s=rnd(1,4);
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(1,2.5),life:1,decay:rnd(0.01,0.025),col:"#fff",glow:1,star:1});}
    let destroyed=0;
    for(let i=blocks.length-1;i>=0;i--){const b=blocks[i];
      const bw=b.w||S,bh=b.h||S;
      const bx=b.x+bw/2,by=blockY(b)+bh/2;
      const hitR=r+(b.kind==="big"?S*0.35:0);   // でっかい的は少し当たり判定を広めに(端でも拾える)
      if(Math.hypot(bx-x,by-y)<=hitR){
        if((b.iron||b.kind==="big"||b.kind==="egg")&&b.hp>1){   // iron/big/egg block: takes multiple hits, no full break yet
          b.hp--; if(b.iron)b.color="#6b7585";
          if(b.kind==="egg"){ b.cracked=true; api.tone(300,0.05,"square",0.06); }
          else {
            for(let k=rint(2,3);k>0;k--)shards.push({x:bx,y:by,vx:rnd(-4,4),vy:rnd(-6,-1),s:rnd(Math.min(bw,bh)*0.1,Math.min(bw,bh)*0.18),color:b.iron?"#cfd6e0":shade(b.color,-20),rot:rnd(0,TAU),vr:rnd(-0.5,0.5),life:1,decay:0.02});
            api.tone(b.iron?180:140,0.06,"square",0.08);
          }
          continue;
        }
        shatter(bx,by,r,b.rainbow?"#ffd23f":b.color,b.kind);
        const wasBomb=b.bomb, wasRainbow=b.rainbow, wasLucky=(!b.rainbow&&b.color===luckyColor), wasEgg=(b.kind==="egg");
        blocks.splice(i,1);count++;destroyed++;
        const maxGen=Math.min(4,1+Math.floor(level/2));   // 軸3: 序盤ほど誘爆の連鎖世代を短くする(レベルが上がるほど元の4世代に戻す)
        if(gen<maxGen&&r*0.66>26)pending.push({x:bx,y:by,r:r*0.66,gen:gen+1,delay:rnd(2,6)});
        if(wasRainbow)rainbowFx(bx,by,r);       // ① にじいろ: 虹チェイン誘爆＋大量得点
        else if(wasLucky)luckyFx(bx,by,b.color); // ② ラッキー色: +1＆きらめき
        else if(wasEgg)eggFx(bx,by);            // ⑤ たまご: ぴよっと可愛い演出
        if(wasBomb){                   // bomb block: extra wide splash chain
          api.boom(0.45);api.shake(14);
          pending.push({x:bx,y:by,r:r*0.9,gen:Math.min(gen+1,2),delay:rnd(1,4)});
        }
      }
    }
    // boss core damage (sits at top centre)
    if(coreActive()){
      const cx=bossCore.x+S/2,cy=fortTop+0*S+S/2;
      if(Math.hypot(cx-x,cy-y)<=r+S*0.65){   // 軸3: コアの当たり判定をさらに広げ、連鎖がコアから外れても着弾扱いにする
        bossCore.hp--;bossCore.flash=1;destroyed++;
        api.tone(120+gen*30,0.1,"square",0.12);api.shake(10);
        for(let k=rint(6,9);k>0;k--){const a=rnd(0,TAU),s=rnd(2,7);
          sparks.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,4),life:1,decay:0.03,col:"#ff66cc",glow:1});}
        if(bossCore.hp<=0){           // core destroyed: special big payoff
          bigFlash=Math.max(bigFlash,0.6);flashCol="255,180,220";api.boom(0.6);api.shake(28);api.hitStop(3);
          shatter(cx,cy,r,"#ff66cc");shatter(cx,cy,r,"#ffd23f");
          floats.push({x:cx,y:cy,txt:"コア はかい！",col:"#ff8ad6",life:1,vy:-0.8,size:40});
          count+=20;pending.push({x:cx,y:cy,r:r*1.1,gen:1,delay:2});
        }
      }
    }
    // combo: count blocks broken across the whole chain
    if(destroyed>0){
      chainCount+=destroyed;chainT=1;
      if(chainCount>bestChain)bestChain=chainCount;
      if(chainCount>=3){
        const tier=clamp(Math.floor(chainCount/3),1,6);
        const bang=chainCount>=9?"！！！":(chainCount>=6?"！！":"！");
        // 軸6: ステージバナー表示中(bannerT>0)はバナー帯(概ね0.24H〜0.32H)と重ならない位置に逃がす
        floats.push({x:api.W/2,y:bannerT>0?api.H*0.58:api.H*0.32,txt:chainCount+"れんさ"+bang,col:pick(["#ffd23f","#ff8ad6","#9fe0ff"]),life:0.9,vy:-0.7,size:34+Math.min(chainCount,12)});
        // rising musical tones the longer the chain
        const note=520+chainCount*48;api.tone(note,0.1,"square",0.12);api.tone(note*1.5,0.08,"sine",0.06);
        if(chainCount>=5){count+=chainCount;bigFlash=Math.max(bigFlash,0.4);api.boom(clamp(0.3+chainCount*0.03,0.3,0.6));}
      }
    }
    api.setScore(count);
    if(gen===0&&fortEmpty())clearStage();
  }
  level=0;count=0;newFort();
  return{
    resize:layout,
    input(px,py,type){
      if(type==="down"){firing=true;aimX=px;aimY=py;fire();fireT=9;}
      else if(type==="move"){if(firing){aimX=px;aimY=py;}}
      else if(type==="up"){firing=false;}
    },
    frame(dt,now){
      tNow+=dt;
      // bg: 画像背景(星空→夜明け)があればそれを使い、平坦な手描き(グラデ/星雲/雲/地面帯)はスキップ
      imgBg=api.drawCover("bg.jpg");
      if(!imgBg){
        // bg space-ish (deep dawn gradient)
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,"#10183a");grd.addColorStop(0.45,"#243a6e");grd.addColorStop(0.78,"#3f5e98");grd.addColorStop(1,"#6a86b8");
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
        // soft nebula glow near horizon
        let neb=g.createRadialGradient(api.W*0.5,api.H*0.95,0,api.W*0.5,api.H*0.95,api.W*0.7);
        neb.addColorStop(0,"rgba(120,160,230,.35)");neb.addColorStop(1,"rgba(120,160,230,0)");
        g.fillStyle=neb;g.fillRect(0,0,api.W,api.H);
      }
      // twinkling stars (画像時は絵の星に控えめに重ねる)
      const starA=imgBg?0.55:1;
      for(const st of stars){st.tw+=st.sp*dt;const tw=0.4+0.6*(0.5+0.5*Math.sin(st.tw));
        const sx=st.x*api.W,sy=st.y*api.H*0.72;
        g.globalAlpha=tw*starA;g.fillStyle="#fff";g.beginPath();g.arc(sx,sy,st.r,0,TAU);g.fill();}
      g.globalAlpha=1;
      // drifting soft clouds (parallax ambient) ※画像背景のときは絵と喧嘩するので描かない
      if(!imgBg) for(const c of clouds){c.x+=c.sp*dt;if(c.x>1.25)c.x-=1.5;if(c.x<-0.25)c.x+=1.5;
        const cx=c.x*api.W,cy=c.y*api.H,w=70*c.sc,h=26*c.sc;
        g.globalAlpha=0.16;g.fillStyle="#cfe0ff";
        g.beginPath();g.ellipse(cx,cy,w,h,0,0,TAU);g.ellipse(cx+w*0.7,cy+h*0.3,w*0.7,h*0.8,0,0,TAU);
        g.ellipse(cx-w*0.7,cy+h*0.35,w*0.6,h*0.7,0,0,TAU);g.fill();}
      g.globalAlpha=1;
      // floating glowing motes
      g.globalCompositeOperation="lighter";
      for(const m of motes){m.y+=m.vy*0.004*dt;m.drift+=m.ds*dt;if(m.y<-0.02){m.y=1.02;m.x=rnd(0,1);}
        const mx=(m.x+Math.sin(m.drift)*0.012)*api.W,my=m.y*api.H;
        const tw=0.4+0.6*(0.5+0.5*Math.sin(m.drift*2));
        g.globalAlpha=tw*0.5;g.fillStyle=m.hue;g.beginPath();g.arc(mx,my,m.r,0,TAU);g.fill();}
      g.globalAlpha=1;g.globalCompositeOperation="source-over";
      // ④ ながれ星: たまに上空を横切る。ロケットで撃つとラッキースター
      if(!star && Math.random()<0.0025*dt) spawnStar();
      if(star){
        star.x+=star.vx*dt; star.y+=star.vy*dt; star.tw+=0.3*dt;
        if(star.x<-40||star.x>api.W+40||star.y>api.H*0.62) star=null; else drawStar2(star);
      }
      // ④ 飽きない変化: 新しい背景画像を増やせない制約下で、ステージ帯ごとに空の色味を変えて「同じ景色」感を減らす
      const SKY_TINTS=["rgba(255,205,140,.13)","rgba(255,150,195,.15)","rgba(150,190,255,.15)","rgba(160,255,205,.16)","rgba(255,225,140,.16)"];
      g.fillStyle=SKY_TINTS[(level-1+SKY_TINTS.length)%SKY_TINTS.length];g.fillRect(0,0,api.W,api.H);
      // ground (画像背景のときは絵の発射場を活かし、薄い影だけ落とす)
      if(!imgBg){
        let gg=g.createLinearGradient(0,launchY+8,0,api.H);gg.addColorStop(0,"#33283c");gg.addColorStop(1,"#1c1626");
        g.fillStyle=gg;g.fillRect(0,launchY+8,api.W,api.H-launchY);
        g.fillStyle="rgba(255,255,255,.06)";g.fillRect(0,launchY+8,api.W,3);
      } else {
        g.fillStyle="rgba(0,0,0,.22)";g.fillRect(0,launchY+8,api.W,api.H-launchY);
      }
      // fort descend
      fortTop+=descend*dt;
      // soft "fail": if fort reaches launcher, shove back up (no game over)
      const lowest=fortTop+rows*S;
      if(lowest>launchY-20){
        fortTop-=(lowest-(launchY-20));descend=Math.max(0.12,descend*0.5);
        if(!pushBackActive){   // 軸3: 押し戻し中は毎フレーム再発火させない。安全圏に戻るまで1回だけ演出する
          pushBackActive=true;
          api.shake(10);warnT=1;
          chainCount=0;chainT=0;stagePushed=true;   // soft-fail: combo reset + パーフェクト失敗
          floats.push({x:api.W/2,y:api.H*0.5,txt:"おしもどせ！",col:"#ff6b6b",life:1,vy:-0.6,size:36});
        }
      } else if(pushBackActive && lowest<launchY-40){
        pushBackActive=false;   // 安全圏まで戻ったら次の押し戻しで再発火できるようにする
      }
      if(warnT>0)warnT-=0.02*dt;
      if(chainT>0)chainT-=0.02*dt;
      if(bannerT>0)bannerT-=0.012*dt;
      if(bossCore&&bossCore.flash>0)bossCore.flash-=0.06*dt;
      if(muzzle>0)muzzle-=0.12*dt;
      // blocks
      for(const b of blocks)drawBlock(b);
      // boss core
      if(coreActive())drawCore();
      // rapid fire while held
      if(firing){fireT-=dt;if(fireT<=0){fire();fireT=9;}}
      // smoke trails (drawn under rockets)
      for(const t of trails){t.life-=t.decay*dt;t.r+=0.4*dt;
        g.globalAlpha=Math.max(0,t.life)*0.5;g.fillStyle=t.col;g.beginPath();g.arc(t.x,t.y,t.r,0,TAU);g.fill();}
      g.globalAlpha=1;trails=trails.filter(t=>t.life>0);
      // rockets
      for(const rk of rockets){rk.x+=rk.vx*dt;rk.y+=rk.vy*dt;rk.trail+=dt;
        // seed trail puff
        trails.push({x:rk.x-rk.vx*0.6,y:rk.y-rk.vy*0.6,r:rnd(2,4),life:1,decay:0.06,col:rk.hue});
        // ④ ながれ星に命中?
        if(star && !star.hit && Math.hypot(rk.x-star.x,rk.y-star.y)<S*0.95){ hitStar(); rk.life=0; continue; }
        let hit=false;
        for(const b of blocks){const bx=b.x,by=blockY(b),bw=b.w||S,bh=b.h||S;if(rk.x>=bx&&rk.x<=bx+bw&&rk.y>=by&&rk.y<=by+bh){hit=true;break;}}
        if(!hit&&coreActive()){const cx=bossCore.x-S*0.4,cy=fortTop-S*0.4,cw=S*1.8;
          if(rk.x>=cx&&rk.x<=cx+cw&&rk.y>=cy&&rk.y<=cy+cw)hit=true;}
        // 軸3 歯ごたえ: 早いステージほど爆風を絞って「どこを撃っても勝てる」を弱める
        const blastR=S*clamp(1.05-level*0.04,0.78,1.05);
        if(hit){explode(rk.x,rk.y,blastR,0);rk.life=0;}
        else if(rk.y<-40||rk.x<-40||rk.x>api.W+40){rk.life=0;}
        if(rk.life>0)drawRocket(rk);
      }
      rockets=rockets.filter(r=>r.life>0);
      // launch embers
      for(const e of embers){e.vy+=0.18*dt;e.x+=e.vx*dt;e.y+=e.vy*dt;e.life-=e.decay*dt;
        g.globalAlpha=Math.max(0,e.life);g.fillStyle=e.col;g.beginPath();g.arc(e.x,e.y,e.r,0,TAU);g.fill();}
      g.globalAlpha=1;embers=embers.filter(e=>e.life>0);
      // pending chain explosions
      for(const p of pending)p.delay-=dt;
      const go=pending.filter(p=>p.delay<=0);pending=pending.filter(p=>p.delay>0);
      for(const p of go)explode(p.x,p.y,p.r,p.gen);
      // chain finished and fort cleared -> stage clear (covers multi-wave clears)
      if(go.length>0&&pending.length===0&&fortEmpty())clearStage();
      // rings + core flash
      for(const ri of rings){ri.r+=(ri.max-ri.r)*0.2*dt;ri.life-=0.05*dt;ri.flash-=0.18*dt;
        if(ri.flash>0){const fr=ri.r*1.2;const fg=g.createRadialGradient(ri.x,ri.y,0,ri.x,ri.y,fr);
          fg.addColorStop(0,"rgba(255,255,230,"+Math.max(0,ri.flash)*0.9+")");fg.addColorStop(0.5,"rgba(255,180,80,"+Math.max(0,ri.flash)*0.5+")");fg.addColorStop(1,"rgba(255,140,60,0)");
          g.fillStyle=fg;g.beginPath();g.arc(ri.x,ri.y,fr,0,TAU);g.fill();}
        g.globalAlpha=Math.max(0,ri.life);g.strokeStyle="#fff3c0";g.lineWidth=4;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();
        g.strokeStyle="rgba(255,140,60,.6)";g.lineWidth=12;g.beginPath();g.arc(ri.x,ri.y,ri.r*0.7,0,TAU);g.stroke();}
      g.globalAlpha=1;rings=rings.filter(r=>r.life>0);
      // sparks (additive glow)
      g.globalCompositeOperation="lighter";
      for(const s of sparks){s.vy+=0.25*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=s.decay*dt;
        const a=Math.max(0,s.life);g.globalAlpha=a;
        if(s.star){g.fillStyle=s.col;g.save();g.translate(s.x,s.y);g.rotate(tNow*0.1);
          const R=s.r*2.4;g.beginPath();g.moveTo(0,-R);g.lineTo(R*0.25,0);g.lineTo(0,R);g.lineTo(-R*0.25,0);g.closePath();
          g.moveTo(-R,0);g.lineTo(0,R*0.25);g.lineTo(R,0);g.lineTo(0,-R*0.25);g.closePath();g.fill();g.restore();}
        else{g.fillStyle=s.col;g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();}}
      g.globalAlpha=1;g.globalCompositeOperation="source-over";sparks=sparks.filter(s=>s.life>0);
      // shards
      for(const p of shards){p.vy+=(p.heavy?0.9:0.5)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);g.fillStyle=p.color;
        if(p.round){g.beginPath();g.arc(0,0,Math.max(0,p.s/2),0,TAU);g.fill();}
        else{g.fillRect(-p.s/2,-p.s/2,p.s,p.s);}
        g.restore();}
      shards=shards.filter(p=>p.life>0);
      // aim guide + reticle (warm, bright, glowing so 5yo can see the target on the bright sky)
      if(firing){
        // soft dark backing line for contrast against bright lower sky
        g.strokeStyle="rgba(40,20,10,.35)";g.lineWidth=8;g.lineCap="round";
        g.beginPath();g.moveTo(launchX,launchY-30);g.lineTo(aimX,aimY);g.stroke();
        // glowing warm dashed line
        g.globalCompositeOperation="lighter";
        g.strokeStyle="rgba(255,180,60,.5)";g.lineWidth=6;g.setLineDash([10,12]);g.lineDashOffset=-tNow*1.6;
        g.beginPath();g.moveTo(launchX,launchY-30);g.lineTo(aimX,aimY);g.stroke();
        g.globalCompositeOperation="source-over";
        g.strokeStyle="#fff2c0";g.lineWidth=2.5;
        g.beginPath();g.moveTo(launchX,launchY-30);g.lineTo(aimX,aimY);g.stroke();
        g.setLineDash([]);g.lineDashOffset=0;g.lineCap="butt";
        // travelling dots along the guide to lead the eye to the target
        const gdx=aimX-launchX,gdy=aimY-(launchY-30),gd=Math.hypot(gdx,gdy)||1;
        for(let i=0;i<4;i++){const tt=((tNow*0.02+i*0.25)%1);
          const px=launchX+gdx*tt,py=(launchY-30)+gdy*tt;
          g.globalAlpha=0.8*(1-tt*0.4);g.fillStyle="#fff7d8";g.beginPath();g.arc(px,py,3.2,0,TAU);g.fill();}
        g.globalAlpha=1;
        // reticle: glowing warm halo + bold ring + crosshair, high contrast
        const rc=16+Math.sin(tNow*0.22)*3;
        g.globalCompositeOperation="lighter";
        const hg=g.createRadialGradient(aimX,aimY,0,aimX,aimY,rc*2.2);
        hg.addColorStop(0,"rgba(255,210,90,.55)");hg.addColorStop(1,"rgba(255,160,40,0)");
        g.fillStyle=hg;g.beginPath();g.arc(aimX,aimY,rc*2.2,0,TAU);g.fill();
        g.globalCompositeOperation="source-over";
        // dark outline ring for contrast
        g.strokeStyle="rgba(50,25,10,.55)";g.lineWidth=6;g.beginPath();g.arc(aimX,aimY,rc,0,TAU);g.stroke();
        // bright warm ring
        g.strokeStyle="#ffcf3a";g.lineWidth=3.5;g.beginPath();g.arc(aimX,aimY,rc,0,TAU);g.stroke();
        // rotating tick ring for liveliness
        g.strokeStyle="#fff7d8";g.lineWidth=2;
        for(let i=0;i<4;i++){const a=tNow*0.05+i*(TAU/4);
          g.beginPath();g.moveTo(aimX+Math.cos(a)*(rc+4),aimY+Math.sin(a)*(rc+4));
          g.lineTo(aimX+Math.cos(a)*(rc+10),aimY+Math.sin(a)*(rc+10));g.stroke();}
        // crosshair with dark backing
        g.lineCap="round";
        g.strokeStyle="rgba(50,25,10,.5)";g.lineWidth=5;
        g.beginPath();g.moveTo(aimX-rc-6,aimY);g.lineTo(aimX-rc+5,aimY);g.moveTo(aimX+rc-5,aimY);g.lineTo(aimX+rc+6,aimY);
        g.moveTo(aimX,aimY-rc-6);g.lineTo(aimX,aimY-rc+5);g.moveTo(aimX,aimY+rc-5);g.lineTo(aimX,aimY+rc+6);g.stroke();
        g.strokeStyle="#fff2c0";g.lineWidth=2.5;
        g.beginPath();g.moveTo(aimX-rc-6,aimY);g.lineTo(aimX-rc+5,aimY);g.moveTo(aimX+rc-5,aimY);g.lineTo(aimX+rc+6,aimY);
        g.moveTo(aimX,aimY-rc-6);g.lineTo(aimX,aimY-rc+5);g.moveTo(aimX,aimY+rc-5);g.lineTo(aimX,aimY+rc+6);g.stroke();
        // center dot
        g.fillStyle="#fff7d8";g.beginPath();g.arc(aimX,aimY,2.4,0,TAU);g.fill();
        g.lineCap="butt";}
      // launcher
      drawLauncher();
      // floats
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.012*dt;g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,f.x,f.y);g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // ① にじいろブロック！ バナー(虹色に色替わり=レアの大きな祝福)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3, col=COLORS[Math.floor(tNow*0.1)%COLORS.length];
        // 軸6: ステージバナー帯(概ね0.20H〜0.30H)と重ならない位置(0.10H)に変更
        g.save();g.translate(api.W/2,api.H*0.10);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 36px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("にじいろブロック！",0,0);
        g.fillStyle=col;g.fillText("にじいろブロック！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！(初回だけ)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        // 軸6: ステージバナー帯(概ね0.20H〜0.30H)と重ならない位置(0.36H)に変更
        g.save();g.translate(api.W/2,api.H*0.36);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(COLNAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyMsgT<0)luckyMsgT=0;}
      // big climax flash / colour wash (full screen)
      if(bigFlash>0){bigFlash-=0.04*dt;
        g.fillStyle="rgba("+flashCol+","+Math.max(0,bigFlash)+")";g.fillRect(0,0,api.W,api.H);}
      // HUD: current stage level (always visible, top-left)
      drawLevelHud();
      // big stage banner on new fort
      if(bannerT>0)drawBanner();
      // cute UI hint pill (rounded, translucent, outlined, glowing)
      drawHintPill("おしたまま すきな ほうこうへ ロケット れんしゃ！",api.W/2,api.H-22);
    }
  };
  function rr(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function drawHintPill(txt,cx,cy){
    g.font="800 15px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
    const tm=g.measureText(txt),tw=(tm&&tm.width)||txt.length*9;
    const w=Math.min(api.W-24,tw+44),h=34,x=cx-w/2,y=cy-h/2;
    const bob=Math.sin(tNow*0.06)*1.5;
    g.save();g.translate(0,bob);
    // soft glow
    g.globalCompositeOperation="lighter";
    g.fillStyle="rgba(120,170,255,.10)";rr(x-4,y-4,w+8,h+8,(h+8)/2);g.fill();
    g.globalCompositeOperation="source-over";
    // shadow
    g.fillStyle="rgba(0,0,0,.28)";rr(x,y+3,w,h,h/2);g.fill();
    // body
    const pg=g.createLinearGradient(0,y,0,y+h);pg.addColorStop(0,"rgba(60,90,150,.82)");pg.addColorStop(1,"rgba(30,50,95,.82)");
    g.fillStyle=pg;rr(x,y,w,h,h/2);g.fill();
    // top sheen
    g.fillStyle="rgba(255,255,255,.16)";rr(x+8,y+4,w-16,h*0.4,h*0.3);g.fill();
    // outline
    g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=2;rr(x,y,w,h,h/2);g.stroke();
    // text with dark outline
    g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(txt,cx,cy);
    g.fillStyle="#fff7d8";g.fillText(txt,cx,cy);
    g.restore();
    g.textAlign="left";g.textBaseline="alphabetic";}
  function drawBlock(b){
    const x=b.x,y=blockY(b),bw=b.w||S,bh=b.h||S,kind=b.kind||"square";
    if(y<-bh||y>api.H)return;
    const rad=Math.max(4,Math.min(bw,bh)*0.16);
    const round=(kind==="round"&&!b.bomb&&!b.iron);
    const ovalShadow=round||b.bomb||kind==="ufo"||kind==="egg";
    // drop shadow: 丸い的/爆弾/UFO/たまごは影も丸く(輪郭のバラエティが影にも出る)
    g.fillStyle="rgba(0,0,0,.28)";
    if(ovalShadow){g.beginPath();g.arc(x+bw/2+3,y+bh/2+4,Math.max(0,Math.min(bw,bh)*0.46),0,TAU);g.fill();}
    else{rr(x+3,y+4,bw,bh,rad);g.fill();}
    // ① にじいろブロック: 体色が7色を巡回＋発光オーラ(激レアの合図)
    const baseCol=b.rainbow?COLORS[Math.floor(tNow*0.05+b.col+b.row)%COLORS.length]:b.color;
    if(b.rainbow){g.save();g.globalCompositeOperation="lighter";
      const rp=0.5+0.5*Math.sin(tNow*0.15+b.col);
      const ag=g.createRadialGradient(x+bw/2,y+bh/2,bw*0.1,x+bw/2,y+bh/2,bw*1.15);
      ag.addColorStop(0,"rgba(255,255,255,"+(0.4*rp)+")");ag.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=ag;g.beginPath();g.arc(x+bw/2,y+bh/2,bw*1.15,0,TAU);g.fill();g.restore();}
    // 画像ブロック: 白ベースのスプライトを体色で着色(ラッキー色/にじいろ/鉄/爆弾の色替えを画像でも維持)
    const spr=IMG_SPRITES?api.tinted("block.png",baseCol,b.rainbow?0.62:0.58):null;
    if(spr){
      api.drawSrc(spr,x+bw/2,y+bh/2,bw*1.04,bh*1.04,{center:true});
    } else if(b.bomb){
      drawBombBody(x,y,bw,bh);              // 軸7: 爆弾は正方形ではなく丸い本体
    } else if(b.iron){
      drawIronBody(x,y,bw,bh,baseCol);      // 軸7: 鉄は横長ドラム缶シルエット
    } else if(kind==="ufo"){
      drawUfoBody(x,y,bw,bh,baseCol);       // 軸7: UFO/ドーム型(丸タンクとも輪郭が違う)
    } else if(kind==="egg"){
      drawEggBody(x,y,bw,bh,baseCol,b.cracked); // 軸7: たまご型(生き物っぽい壊れ方の的)
    } else if(round){
      drawRoundBody(x,y,bw,bh,baseCol);     // 軸7: 丸いタンク的
    } else {
      // body gradient (square/big)
      const grd=g.createLinearGradient(x,y,x,y+bh);grd.addColorStop(0,shade(baseCol,40));grd.addColorStop(0.5,baseCol);grd.addColorStop(1,shade(baseCol,-40));
      g.fillStyle=grd;rr(x,y,bw,bh,rad);g.fill();
      // top glossy highlight
      g.fillStyle="rgba(255,255,255,.30)";rr(x+bw*0.12,y+bh*0.1,bw*0.76,bh*0.26,rad*0.6);g.fill();
      // inner rim
      g.strokeStyle="rgba(255,255,255,.18)";g.lineWidth=2;rr(x+1.5,y+1.5,bw-3,bh-3,rad*0.8);g.stroke();
      if(kind==="square"){   // 軸7: 木箱風の横板ライン＋鋲(ただの四角ブロックに見せない)
        g.strokeStyle="rgba(90,55,25,.35)";g.lineWidth=Math.max(1,bh*0.05);
        for(let i=1;i<3;i++){const ly=y+bh*i/3;g.beginPath();g.moveTo(x+3,ly);g.lineTo(x+bw-3,ly);g.stroke();}
        g.fillStyle="rgba(60,35,15,.35)";
        [[0.14,0.16],[0.86,0.16],[0.14,0.84],[0.86,0.84]].forEach(function(p){
          g.beginPath();g.arc(x+bw*p[0],y+bh*p[1],Math.max(1,bw*0.03),0,TAU);g.fill();});
      }
      if(kind==="big"){   // 軸7: でっかい箱と分かるよう中央に仕切り線(大きさも輪郭も通常ブロックと違う)
        g.strokeStyle="rgba(0,0,0,.28)";g.lineWidth=3;
        g.beginPath();g.moveTo(x+bw/2,y+4);g.lineTo(x+bw/2,y+bh-4);g.stroke();
      }
    }
    // ② ラッキー色ヒント: 今日のラッキー色のブロックは 右上で小さな星がキラッ
    if(!b.rainbow&&!b.iron&&!b.bomb&&b.color===luckyColor){
      const lp=0.5+0.5*Math.sin(tNow*0.12+b.col+b.row),rr2=Math.max(0,Math.min(bw,bh)*0.14*(0.6+0.4*lp));
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.5+0.5*lp;g.fillStyle="#fff7c2";
      g.translate(x+bw*0.85,y+bh*0.18);
      g.beginPath();g.moveTo(0,-rr2);g.lineTo(rr2*0.28,0);g.lineTo(0,rr2);g.lineTo(-rr2*0.28,0);g.closePath();
      g.moveTo(-rr2,0);g.lineTo(0,rr2*0.28);g.lineTo(rr2,0);g.lineTo(0,-rr2*0.28);g.closePath();g.fill();
      g.restore();g.globalAlpha=1;
    }
  }
  function drawBombBody(x,y,w,h){
    // 爆弾: 正方形の土台をやめて丸い本体にする(輪郭だけで見分けられるように)
    const cx=x+w/2,cy=y+h/2,rad=Math.max(0,Math.min(w,h)*0.42);
    const bgr=g.createRadialGradient(cx-rad*0.3,cy-rad*0.3,Math.max(0.01,rad*0.1),cx,cy,rad);
    bgr.addColorStop(0,"#5a5a5a");bgr.addColorStop(0.55,"#2b2b2b");bgr.addColorStop(1,"#111");
    g.fillStyle=bgr;g.beginPath();g.arc(cx,cy,rad,0,TAU);g.fill();
    g.strokeStyle="rgba(255,80,60,.7)";g.lineWidth=2;g.beginPath();g.arc(cx,cy,Math.max(0,rad*0.96),0,TAU);g.stroke();
    g.strokeStyle="rgba(255,255,255,.18)";g.lineWidth=1.5;g.beginPath();g.arc(cx,cy,Math.max(0,rad*0.86),0,TAU);g.stroke();
    g.fillStyle="rgba(255,255,255,.22)";g.beginPath();g.ellipse(cx-rad*0.3,cy-rad*0.35,Math.max(0,rad*0.32),Math.max(0,rad*0.18),-0.5,0,TAU);g.fill();
    g.strokeStyle="#ffb84a";g.lineWidth=Math.max(1,rad*0.14);
    g.beginPath();g.moveTo(cx,cy-rad*0.85);g.lineTo(cx+rad*0.4,cy-rad*1.25);g.stroke();
    const fk=0.6+0.4*Math.sin(tNow*0.3+x*0.05);
    g.save();g.globalCompositeOperation="lighter";g.fillStyle="rgba(255,220,120,"+fk+")";
    g.beginPath();g.arc(cx+rad*0.4,cy-rad*1.25,Math.max(0,rad*0.22),0,TAU);g.fill();
    g.restore();
  }
  function drawIronBody(x,y,w,h,baseCol){
    // 鉄ブロック: 正方形の土台をやめて横長のドラム缶シルエットにする(色だけでなく輪郭でも見分けられるように)
    const dy=h*0.14,dh=Math.max(1,h*0.72),rad=Math.max(3,Math.min(w,dh)*0.22);
    const grd=g.createLinearGradient(x,y+dy,x,y+dy+dh);
    grd.addColorStop(0,shade(baseCol,40));grd.addColorStop(0.5,baseCol);grd.addColorStop(1,shade(baseCol,-40));
    g.fillStyle=grd;rr(x,y+dy,w,dh,rad);g.fill();
    g.strokeStyle="rgba(0,0,0,.35)";g.lineWidth=Math.max(1,dh*0.08);
    g.beginPath();g.moveTo(x+w*0.16,y+dy);g.lineTo(x+w*0.16,y+dy+dh);g.moveTo(x+w*0.84,y+dy);g.lineTo(x+w*0.84,y+dy+dh);g.stroke();
    g.fillStyle="rgba(255,255,255,.55)";
    const bb=Math.max(0,Math.min(w,dh)*0.09);
    g.beginPath();g.arc(x+w*0.22,y+dy+dh*0.5,bb,0,TAU);g.arc(x+w*0.78,y+dy+dh*0.5,bb,0,TAU);g.fill();
    g.strokeStyle="rgba(255,255,255,.18)";g.lineWidth=2;rr(x+1.5,y+dy+1.5,Math.max(0,w-3),Math.max(0,dh-3),rad*0.8);g.stroke();
  }
  function drawRoundBody(x,y,w,h,baseCol){
    // 丸いタンク的: 四角の的とはっきり違う輪郭にする
    const cx=x+w/2,cy=y+h/2,rad=Math.max(0,Math.min(w,h)/2*0.94);
    const grd=g.createRadialGradient(cx-rad*0.3,cy-rad*0.35,Math.max(0.01,rad*0.15),cx,cy,rad);
    grd.addColorStop(0,shade(baseCol,45));grd.addColorStop(0.55,baseCol);grd.addColorStop(1,shade(baseCol,-35));
    g.fillStyle=grd;g.beginPath();g.arc(cx,cy,rad,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.28)";g.beginPath();g.ellipse(cx-rad*0.32,cy-rad*0.38,Math.max(0,rad*0.34),Math.max(0,rad*0.2),-0.5,0,TAU);g.fill();
    g.strokeStyle="rgba(255,255,255,.22)";g.lineWidth=2;g.beginPath();g.arc(cx,cy,Math.max(0,rad*0.94),0,TAU);g.stroke();
  }
  function drawUfoBody(x,y,w,h,baseCol){
    // UFO/ドーム型: 横長の受け皿＋ガラスドーム。丸タンクとも一目で違う輪郭にする(軸7)
    const cx=x+w/2,cy=y+h*0.6,rw=Math.max(0,w*0.56),rh=Math.max(0,h*0.26);
    const grd=g.createLinearGradient(x,cy-rh,x,cy+rh);
    grd.addColorStop(0,shade(baseCol,40));grd.addColorStop(0.5,baseCol);grd.addColorStop(1,shade(baseCol,-40));
    g.fillStyle=grd;g.beginPath();g.ellipse(cx,cy,rw,rh,0,0,TAU);g.fill();
    g.strokeStyle="rgba(255,255,255,.22)";g.lineWidth=1.5;g.beginPath();g.ellipse(cx,cy,Math.max(0,rw*0.96),Math.max(0,rh*0.9),0,0,TAU);g.stroke();
    const domeR=Math.max(0,w*0.26),domeY=cy-h*0.24;
    const dg=g.createRadialGradient(cx-domeR*0.3,domeY-domeR*0.3,Math.max(0.01,domeR*0.15),cx,domeY,domeR);
    dg.addColorStop(0,"rgba(225,250,255,.92)");dg.addColorStop(1,"rgba(150,205,225,.55)");
    g.fillStyle=dg;g.beginPath();g.arc(cx,domeY,domeR,Math.PI,0);g.fill();
    g.strokeStyle="rgba(255,255,255,.45)";g.lineWidth=1.5;g.beginPath();g.arc(cx,domeY,domeR,Math.PI,0);g.stroke();
    g.fillStyle="rgba(255,255,255,.7)";
    for(let i=0;i<3;i++){const lx=cx+(i-1)*rw*0.5;g.beginPath();g.arc(lx,cy+rh*0.35,Math.max(0,rw*0.05),0,TAU);g.fill();}
  }
  function drawEggBody(x,y,w,h,baseCol,cracked){
    // たまご型: 生き物っぽい壊れ方をする新オブジェクト(軸7補助)。ヒビ有無で1発目の手応えを見せる
    const cx=x+w/2,cy=y+h/2,rw=Math.max(0,w*0.36),rh=Math.max(0,h*0.46);
    g.save();g.translate(cx,cy);
    const grd=g.createLinearGradient(0,-rh,0,rh);
    grd.addColorStop(0,"#fff7e0");grd.addColorStop(0.6,cracked?"#ffe2a0":"#fff1cf");grd.addColorStop(1,shade(baseCol,-10));
    g.fillStyle=grd;g.beginPath();g.moveTo(0,-rh);
    g.bezierCurveTo(rw,-rh,rw*1.05,rh*0.3,0,rh);
    g.bezierCurveTo(-rw*1.05,rh*0.3,-rw,-rh,0,-rh);
    g.closePath();g.fill();
    g.strokeStyle=shade(baseCol,-25);g.lineWidth=Math.max(1,rw*0.12);
    g.beginPath();g.moveTo(0,-rh);g.bezierCurveTo(rw,-rh,rw*1.05,rh*0.3,0,rh);
    g.bezierCurveTo(-rw*1.05,rh*0.3,-rw,-rh,0,-rh);g.stroke();
    if(cracked){
      g.strokeStyle="rgba(90,60,20,.65)";g.lineWidth=Math.max(1,rw*0.09);g.lineCap="round";
      g.beginPath();g.moveTo(-rw*0.35,-rh*0.15);g.lineTo(-rw*0.05,rh*0.05);g.lineTo(rw*0.3,-rh*0.05);g.lineTo(rw*0.05,rh*0.3);g.stroke();
      g.lineCap="butt";
    }
    g.fillStyle="rgba(255,255,255,.3)";g.beginPath();g.ellipse(-rw*0.32,-rh*0.35,Math.max(0,rw*0.22),Math.max(0,rh*0.14),-0.4,0,TAU);g.fill();
    g.restore();
  }
  function shade(hex,amt){let n=parseInt(hex.slice(1),16);let r=clamp((n>>16)+amt,0,255),gg=clamp(((n>>8)&255)+amt,0,255),bb=clamp((n&255)+amt,0,255);return"rgb("+r+","+gg+","+bb+")";}
  function drawStar2(s){
    const dir=Math.atan2(s.vy,s.vx);
    g.save();g.globalCompositeOperation="lighter";
    const tg=g.createLinearGradient(s.x,s.y,s.x-Math.cos(dir)*42,s.y-Math.sin(dir)*42);
    tg.addColorStop(0,"rgba(200,235,255,.9)");tg.addColorStop(1,"rgba(200,235,255,0)");
    g.strokeStyle=tg;g.lineWidth=5;g.lineCap="round";
    g.beginPath();g.moveTo(s.x,s.y);g.lineTo(s.x-Math.cos(dir)*42,s.y-Math.sin(dir)*42);g.stroke();g.lineCap="butt";
    const gg2=g.createRadialGradient(s.x,s.y,0,s.x,s.y,16);
    gg2.addColorStop(0,"rgba(255,255,255,.95)");gg2.addColorStop(0.5,"rgba(180,225,255,.6)");gg2.addColorStop(1,"rgba(180,225,255,0)");
    g.fillStyle=gg2;g.beginPath();g.arc(s.x,s.y,16,0,TAU);g.fill();
    const tw=6+Math.sin(s.tw)*2;g.fillStyle="#ffffff";
    g.save();g.translate(s.x,s.y);g.rotate(s.tw*0.2);
    g.beginPath();g.moveTo(0,-tw);g.lineTo(tw*0.28,0);g.lineTo(0,tw);g.lineTo(-tw*0.28,0);g.closePath();
    g.moveTo(-tw,0);g.lineTo(0,tw*0.28);g.lineTo(tw,0);g.lineTo(0,-tw*0.28);g.closePath();g.fill();g.restore();
    g.restore();g.globalCompositeOperation="source-over";
  }
  function drawRocket(rk){g.save();g.translate(rk.x,rk.y);g.rotate(rk.a);
    const fl=10+Math.sin(rk.trail)*5;
    // flame glow (additive)
    g.globalCompositeOperation="lighter";
    const fg=g.createRadialGradient(-12,0,0,-12,0,fl*1.8);fg.addColorStop(0,"rgba(255,210,120,.8)");fg.addColorStop(1,"rgba(255,120,40,0)");
    g.fillStyle=fg;g.beginPath();g.arc(-12,0,fl*1.8,0,TAU);g.fill();
    g.globalCompositeOperation="source-over";
    // flame layers
    g.fillStyle="#ffe07a";g.beginPath();g.moveTo(-10,0);g.lineTo(-10-fl,5);g.lineTo(-10-fl*1.7,0);g.lineTo(-10-fl,-5);g.closePath();g.fill();
    g.fillStyle="#ff7a2c";g.beginPath();g.moveTo(-10,0);g.lineTo(-10-fl*0.7,3);g.lineTo(-10-fl*1.1,0);g.lineTo(-10-fl*0.7,-3);g.closePath();g.fill();
    g.fillStyle="#fff6d8";g.beginPath();g.moveTo(-10,0);g.lineTo(-10-fl*0.35,1.6);g.lineTo(-10-fl*0.55,0);g.lineTo(-10-fl*0.35,-1.6);g.closePath();g.fill();
    // 画像ロケット(先端が上向き=upright)。進行方向(+x)に向くよう +90° 回して描く。炎は上の手描きを共有
    if(IMG_SPRITES&&api.drawAsset("rocket.png",5,0,32,32,{center:true,rot:Math.PI/2})){g.restore();return;}
    // body with gradient
    const bg=g.createLinearGradient(0,-6,0,6);bg.addColorStop(0,"#ffffff");bg.addColorStop(0.5,"#dfe6ee");bg.addColorStop(1,"#9fb0c2");
    g.fillStyle=bg;g.beginPath();g.moveTo(15,0);g.lineTo(2,-5);g.lineTo(-10,-5);g.lineTo(-10,5);g.lineTo(2,5);g.closePath();g.fill();
    // fins
    g.fillStyle="#c0392b";g.beginPath();g.moveTo(-10,-5);g.lineTo(-15,-9);g.lineTo(-8,-5);g.closePath();g.fill();
    g.beginPath();g.moveTo(-10,5);g.lineTo(-15,9);g.lineTo(-8,5);g.closePath();g.fill();
    // nose
    g.fillStyle="#e74c3c";g.beginPath();g.moveTo(15,0);g.lineTo(4,-4);g.lineTo(4,4);g.closePath();g.fill();
    // window
    g.fillStyle="#bfe6ff";g.beginPath();g.arc(-2,0,2.6,0,TAU);g.fill();
    g.strokeStyle="rgba(0,0,0,.25)";g.lineWidth=1;g.stroke();
    g.restore();}
  function drawLauncher(){const x=launchX,y=launchY;
    g.save();g.translate(x,y);
    const ang=Math.atan2(aimY-(y-30),aimX-x);
    g.rotate(ang);
    // 画像ランチャー(砲身・右向き)。手描きの砲身(46x24, 根元が原点)と同じ長さになるよう横長に描く
    const imgL=IMG_SPRITES&&api.drawAsset("launcher.png",24,0,64,64,{center:true});
    if(!imgL){                                // 軸6: 砲身を約1.3倍に拡大して大砲の存在感を強める
    const bgr=g.createLinearGradient(0,-15,0,15);bgr.addColorStop(0,"#6b7689");bgr.addColorStop(0.5,"#4a5568");bgr.addColorStop(1,"#333b49");
    g.fillStyle=bgr;rr(0,-15,60,31,8);g.fill();
    g.fillStyle="#2c3340";g.fillRect(49,-15,12,31);
    g.fillStyle="rgba(255,255,255,.18)";g.fillRect(3,-13,55,5);
    }
    // cute mascot face on the cannon body (drawn upright regardless of barrel angle)
    if(!imgL){g.save();g.rotate(-ang);
    const blink=(tNow*0.02%6)<0.18?0.18:1;
    g.fillStyle="#fff";g.beginPath();g.ellipse(9,-2.6,4.7,4.7*blink,0,0,TAU);g.ellipse(22,-2.6,4.7,4.7*blink,0,0,TAU);g.fill();
    g.fillStyle="#26303f";g.beginPath();g.arc(10.1,-2.6,2.3,0,TAU);g.arc(23.1,-2.6,2.3,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.9)";g.beginPath();g.arc(10.9,-3.5,0.9,0,TAU);g.arc(23.9,-3.5,0.9,0,TAU);g.fill();
    g.fillStyle="rgba(255,140,150,.55)";g.beginPath();g.arc(5.2,3.9,3.1,0,TAU);g.arc(26,3.9,3.1,0,TAU);g.fill();
    g.strokeStyle="#26303f";g.lineWidth=2.1;g.lineCap="round";g.beginPath();g.arc(15.6,2.6,3.9,0.15,Math.PI-0.15);g.stroke();g.lineCap="butt";
    g.restore();}
    // muzzle flash
    if(muzzle>0){g.globalCompositeOperation="lighter";const m=Math.max(0,muzzle);
      const mg=g.createRadialGradient(65,0,0,65,0,36*m);mg.addColorStop(0,"rgba(255,240,180,"+m+")");mg.addColorStop(1,"rgba(255,140,40,0)");
      g.fillStyle=mg;g.beginPath();g.arc(65,0,36*m,0,TAU);g.fill();g.globalCompositeOperation="source-over";}
    g.restore();
    // base
    const baseg=g.createLinearGradient(0,y,0,y+40);baseg.addColorStop(0,"#4a5161");baseg.addColorStop(1,"#262b36");
    g.fillStyle=baseg;g.beginPath();g.moveTo(x-34,y+34);g.lineTo(x+34,y+34);g.lineTo(x+22,y);g.lineTo(x-22,y);g.closePath();g.fill();
    g.fillStyle="#2a2f3a";rr(x-40,y+30,80,10,4);g.fill();
    g.fillStyle="#1c1c22";g.beginPath();g.arc(x-22,y+40,9,0,TAU);g.arc(x+22,y+40,9,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.12)";g.beginPath();g.arc(x-24,y+38,3,0,TAU);g.arc(x+20,y+38,3,0,TAU);g.fill();}
  function drawCore(){
    const cx=bossCore.x+S/2,cy=fortTop+S/2,R=S*0.78;
    if(cy<-R||cy>api.H+R)return;
    const fl=Math.max(0,bossCore.flash);
    // glow
    g.globalCompositeOperation="lighter";
    const gg2=g.createRadialGradient(cx,cy,0,cx,cy,R*2);
    gg2.addColorStop(0,"rgba(255,120,210,"+(0.4+fl*0.5)+")");gg2.addColorStop(1,"rgba(255,120,210,0)");
    g.fillStyle=gg2;g.beginPath();g.arc(cx,cy,R*2,0,TAU);g.fill();
    g.globalCompositeOperation="source-over";
    // 画像コア(当たり半径R の丸 → R*2.2 で center 描画)。被弾フラッシュだけ重ねる
    if(IMG_SPRITES&&api.drawAsset("core.png",cx,cy,R*2.0,R*2.0,{center:true})){
      if(fl>0){g.save();g.globalAlpha=fl*0.6;g.fillStyle="#fff";g.beginPath();g.arc(cx,cy,R*0.95,0,TAU);g.fill();g.restore();}
    } else {
    // armoured shell
    const cg=g.createRadialGradient(cx-R*0.3,cy-R*0.3,R*0.1,cx,cy,R);
    cg.addColorStop(0,"#ffd0ee");cg.addColorStop(0.5,"#ff5bbf");cg.addColorStop(1,"#a01a6e");
    g.fillStyle=cg;g.beginPath();g.arc(cx,cy,R,0,TAU);g.fill();
    g.strokeStyle="#fff";g.lineWidth=3;g.beginPath();g.arc(cx,cy,R*0.96,0,TAU);g.stroke();
    // pulsing inner core
    const pr=R*0.4*(0.85+0.15*Math.sin(tNow*0.2));
    g.fillStyle="rgba(255,255,255,"+(0.6+fl*0.4)+")";g.beginPath();g.arc(cx,cy,pr,0,TAU);g.fill();
    }
    // HP pips
    for(let i=0;i<bossCore.maxhp;i++){const a=-TAU/4+i*(TAU/bossCore.maxhp);
      g.fillStyle=i<bossCore.hp?"#fff":"rgba(0,0,0,.35)";
      g.beginPath();g.arc(cx+Math.cos(a)*(R+8),cy+Math.sin(a)*(R+8),2.6,0,TAU);g.fill();}
  }
  function drawLevelHud(){
    // 上部中央＝engine HUDのもどる/スコアと衝突しない安全帯
    const txt="ステージ "+level+(level%4===0?" ボス":"")+"／"+MAXLV;
    g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
    const tw=g.measureText(txt).width,w=tw+22,h=24,x=api.W/2-w/2,y=20;   // 軸6: 帯を少し薄くして(28→24)通過時間そのものを縮める
    // 軸6: 新しい砦の最上段がこの帯を通過中は、的(ブロック)が不透明バッジの下に隠れて見えなくなるのを防ぐ。
    // 通過中だけ背板を薄くし、文字は縁取り(stroke)で十分読めるので数字が読めなくなる瞬間は作らない。
    const bandTop=y-h/2,bandBottom=y+h/2;
    const rowBottom=fortTop+S;
    const transiting=(blocks.length>0||coreActive())&&rowBottom>bandTop&&fortTop<bandBottom;
    g.fillStyle=transiting?"rgba(15,20,45,.32)":"rgba(15,20,45,.92)";rr(x,y-h/2,w,h,h/2);g.fill();
    g.strokeStyle="rgba(255,255,255,.4)";g.lineWidth=1.5;rr(x,y-h/2,w,h,h/2);g.stroke();
    g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(txt,api.W/2,y);
    g.fillStyle="#fff7d8";g.fillText(txt,api.W/2,y);
    if(bestChain>=3){const bt="さいこう "+bestChain+"れんさ";
      g.font="800 13px 'Hiragino Maru Gothic ProN',system-ui";
      const bw=g.measureText(bt).width;
      g.fillStyle="rgba(15,20,45,.9)";rr(api.W/2-(bw+18)/2,y+18,bw+18,22,11);g.fill();
      g.fillStyle="#9fe0ff";g.fillText(bt,api.W/2,y+29);}
    g.textAlign="left";g.textBaseline="alphabetic";
  }
  function drawBanner(){
    const a=bannerT>0.85?ease((1-bannerT)/0.15):(bannerT<0.2?ease(bannerT/0.2):1);
    const cy=api.H*0.24;
    g.save();g.globalAlpha=Math.max(0,Math.min(1,a));
    const big=level%4===0;
    g.font="900 "+(big?52:46)+"px 'Hiragino Maru Gothic ProN',system-ui";
    g.textAlign="center";g.textBaseline="middle";
    g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(bannerTxt,api.W/2,cy);
    g.fillStyle=big?"#ff8ad6":"#ffd23f";g.fillText(bannerTxt,api.W/2,cy);
    if(bannerSub){g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
      g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(bannerSub,api.W/2,cy+40);
      g.fillStyle="#fff7d8";g.fillText(bannerSub,api.W/2,cy+40);}
    g.restore();g.textAlign="left";g.textBaseline="alphabetic";
  }
}
Engine.register("rocket", buildRocket);
