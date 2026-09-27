function build_icecream(api){
  const g=api.g;
  api.preload(["bg.jpg"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。
  // cone.png/cannon.png は生成を2回試したが (アイスが乗った状態で生成される/ホイールの縁にマゼンタのにじみが残る)
  // 直らなかったため使用しない(手描きのみ)。bg.jpg は良好なので使用する。
  let scoops=[],balls=[],shards=[],rings=[],sparks=[],floats=[],puffs=[],bgItems=[],motes=[];
  let towerX,towerBaseY,R,tsec=0,count=0,combo=0,comboT=0,launchT=0;
  // ③ 軸3対策: タップ座標が塔から大きく外れたら空振りにする当たり半径の倍率と、連射間隔の下限
  const HIT_MULT=4.5,SHOT_CD=0.14;
  let lastShotAt=-999;
  // stage progression
  let stage=1,stageGoal=0,stageBroken=0,clearT=0,clearTxt="",strikeT=0,celebrate=0,flash=0,flashHue="#fff";
  // (軸3) ステージが進むほど goalFor(stage) が伸び続けるが、塔を毎回そこまで積むと画面外に出て
  // 「見えない的」ができてしまう(当たり判定を足す前は座標を見ずに命中していたので隠れていた不具合)。
  // 塔の高さは画面に収まる段数で頭打ちにし、目標こ数に届くまで無音で積み増す(ステージ表示はそのまま伸び続ける)。
  let maxTower=8;
  // fever time: gauge fills as you break scoops; full gauge = 10s of double-score rainbow mayhem
  let fever=0,gauge=0,feverBanner=0;
  // 画像の candy cannon (左右の発射台)。位置は layout() で確定、発射時に反動アニメ。
  let cannonL={x:0,y:0},cannonR={x:0,y:0},canRecoil={L:0,R:0};
  // candy-land pastel palettes per stage (sky gradient + accent)
  const THEMES=[
    {name:"いちご",  sky:["#ffe1ef","#ffd1e8","#ffc0dd","#f7b5d8"],acc:"#ff8ac4",grd:"#f9a8d4"}, // strawberry
    {name:"ソーダ",  sky:["#dff4ff","#c9ecff","#bfe4ff","#ffe9c2"],acc:"#7fd0ff",grd:"#bfe4ff"}, // soda
    {name:"ぶどう",  sky:["#efe3ff","#e2cfff","#d6c0ff","#ffd9ee"],acc:"#c49bff",grd:"#d6c0ff"}, // grape
    {name:"メロン",  sky:["#e6ffe9","#d2f7d8","#c2f0cc","#fff3c2"],acc:"#86e29a",grd:"#c2f0cc"}, // melon
    {name:"キャラメル",sky:["#fff0d6","#ffe2b0","#ffd089","#ffc0dd"],acc:"#ffb14a",grd:"#ffd089"}  // caramel
  ];
  const RAINBOW=["#ff5b8a","#ff9a3a","#ffd23f","#5ee27a","#4fc3ff","#b06aff"];
  const SCOOP=["#ff8ac4","#7fd0ff","#c49bff","#86e29a","#ffd23f","#ff9a6a","#ffffff"];
  function theme(){return THEMES[(stage-1)%THEMES.length];}
  function goalFor(s){return Math.round((5+s)*1.25);}  // 7〜8歳向けに目標こ数を約25%増やした
  const SCOOPNAME={"#ff8ac4":"ピンク","#7fd0ff":"みずいろ","#c49bff":"むらさき","#86e29a":"みどり","#ffd23f":"きいろ","#ff9a6a":"オレンジ","#ffffff":"しろ"};
  // ---- 隠し発見レイヤー(hammer/truck と同じ思想) ----
  // ② きょうのラッキー色: 毎プレイ秘密に1色。金(#ffd23f)と白は紛らわしいので候補から外す。
  let luckyColor=pick(SCOOP.filter(c=>c!=="#ffffff"&&c!=="#ffd23f"));
  let luckySeen=false,luckyMsgT=0,luckyMsg="";
  let rbMsgT=0;                        // ① にじいろアイス 発見バナー
  let nonstopBroken=false,perfectT=0;  // ③ ノンストップ判定(このタワー中にコンボが切れたか)
  let sunWink=0; const sunPos={x:0,y:0,r:0}; // ④ おひさま ひみつタップ

  function buildBg(){
    bgItems=[];
    const kinds=["candy","choco","gummy","cake","donut"];
    for(let i=0;i<9;i++)bgItems.push({x:rnd(0,api.W),y:rnd(api.H*0.08,api.H*0.62),
      s:rnd(0.7,1.5),sp:rnd(0.05,0.18),ph:rnd(0,TAU),bob:rnd(8,26),
      kind:pick(kinds),col:pick(SCOOP),rot:rnd(0,TAU),vr:rnd(-0.01,0.01)});
    motes=[];
    for(let i=0;i<24;i++)motes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(0.8,2.4),
      sp:rnd(0.1,0.4),tw:rnd(0,TAU),col:pick(["#ffffff","#fff0a6","#ffd2f0","#bfe9ff"])});
  }
  function layout(){
    R=clamp(Math.min(api.W,api.H)*0.07,26,54);
    towerX=api.W/2;
    towerBaseY=api.H*0.82;
    // re-stack any existing scoops onto the new geometry
    rebuild(scoops.filter(s=>!s.broken).length||0);
    buildBg();
    // ④ おひさま の当たり判定(描画と一致)
    sunPos.x=api.W*0.80;sunPos.y=api.H*0.14;sunPos.r=Math.max(18,api.W*0.05);
    // candy cannon の位置(左右・地面ちかく=タワーの手前に立っている見た目)
    cannonL.x=api.W*0.10;cannonL.y=api.H*0.74;
    cannonR.x=api.W*0.90;cannonR.y=api.H*0.70;
    // 画面に収まる最大段数(段数を無限に伸ばすと的が画面外に出るため)
    maxTower=Math.max(6,Math.min(9,Math.floor((towerBaseY-api.H*0.20)/(R*1.18))));
  }

  function rebuild(n){
    // build a fresh tower of n scoops on a cone, bottom->top
    scoops=[];
    const want=n>0?n:goalFor(stage);
    for(let i=0;i<want;i++){
      const isFace=i===want-1; // 一番上=顔つき。形の演出とかぶらないよう常にまる型のまま。
      const gold=Math.random()<0.08; // rare golden scoop: big bonus + rainbow burst
      const rb=!gold && stage>=2 && Math.random()<0.05; // ① 激レア にじいろアイス
      // ⑦ 形のバラつき: 丸のスコープ以外に、平たいウエハースと輪っかドーナツも混ぜる(色違いだけにしない)
      // 0.16→0.32に倍増(低学年には1タワーに平均1個程度では『ほぼ全部まる』に見えるため)
      const kind=(isFace||gold||rb)?"scoop":(Math.random()<0.32?(Math.random()<0.5?"wafer":"donut"):"scoop");
      // ⑦ 大きさのバラつき: 段が上がるほど少し小さくなるのに加え、3段おきに1.4倍の『おおきいアイス』を混ぜる。
      // 丸スコープだけでなく wafer/donut にも別リズムでサイズ差をかけ、形×大きさの組合せを増やす。
      const big=!isFace&&(i%3===2||(kind!=="scoop"&&i%2===1));
      const rBase=R*(1-i*0.045);
      const r=big?rBase*1.4:rBase;
      scoops.push({i,x:towerX,baseY:towerBaseY-R*0.7-i*(R*1.18),r:Math.max(R*0.5,r),
        col:rb?"#ff5b8a":(gold?"#ffd23f":pick(SCOOP)),gold:gold,rb:rb,kind:kind,big:big,broken:false,wob:rnd(0,TAU),sway:0,
        face:isFace,blink:rnd(0,TAU)});
    }
  }

  function announceBatch(){
    // 積み増した段の中に きん／にじいろ があれば知らせる(新規タワーでも 途中の積み増しでも共通)
    const gs=scoops.find(s=>s.gold);
    if(gs){floats.push({x:gs.x,y:gs.baseY-gs.r*1.6,txt:"きんの アイス だ！",vy:-0.5,life:1.2,col:"#ffb400",size:26});
      api.tone(1568,0.12,"triangle",0.1);setTimeout(()=>api.tone(2093,0.16,"triangle",0.08),90);}
    // ① にじいろアイス を予告(タワーの上の方に見える=たどり着くまでドキドキ)
    const rbs=scoops.find(s=>s.rb);
    if(rbs){floats.push({x:rbs.x,y:rbs.baseY-rbs.r*1.7,txt:"にじいろ アイス はっけん！",vy:-0.5,life:1.4,col:"#ff5b8a",size:24});
      api.tone(1318,0.1,"triangle",0.08);setTimeout(()=>api.tone(1760,0.14,"triangle",0.07),90);}
  }
  function newTower(){
    stageGoal=goalFor(stage);
    stageBroken=0;
    rebuild(Math.min(stageGoal,maxTower));
    nonstopBroken=false; // ③ 新しいタワーは ノンストップ 判定リセット
    announceBatch();
  }

  function spawnBall(tx,ty){
    // fly a candy ball from a side candy-cannon toward target, then resolve hit
    const fromLeft=tx<api.W/2?false:true;
    const launcher=fromLeft?cannonR:cannonL;
    const sx=launcher.x,sy=launcher.y;
    balls.push({x:sx,y:sy,tx,ty,t:0,col:pick(SCOOP),done:false,rot:rnd(0,TAU)});
    launchT=1;
    if(fromLeft)canRecoil.R=1;else canRecoil.L=1;   // 発射した側の砲台が反動でちょっと縮む
    api.slide(420,820,0.16,0.16,"triangle");api.noise(0.05,0.08,2600,"highpass");
  }

  function topAlive(){
    let best=-1,bi=-1;
    for(const s of scoops){if(!s.broken&&s.i>best){best=s.i;bi=scoops.indexOf(s);}}
    return bi;
  }

  function breakScoop(s,big){
    s.broken=true;
    const hx=s.x,hy=s.baseY;
    rings.push({x:hx,y:hy,r:s.r*0.5,vr:s.r*0.7,life:1,decay:0.05,col:s.col});
    rings.push({x:hx,y:hy,r:s.r*0.2,vr:s.r*0.5,life:1,decay:0.045,col:"#ffffff"});
    const n=(big?16:10)+Math.min(combo,6);
    // ⑦ 壊れ方も形に合わせて変える: ウエハースは四角いクランブル、ドーナツは輪っか状の欠片。
    // 一番出現頻度の高い丸スコープには、はじけ飛ぶ chunk に加えて一瞬つぶれて平たくなってから消える
    // squash(へこむ)を確率つきで混ぜ、壊れ方のバリエーションを主要ケースにも広げる。
    const isSquash=s.kind==="scoop"&&!s.rb&&!s.gold&&Math.random()<0.4;
    const shardKind=s.kind==="wafer"?"crumble":(s.kind==="donut"?"ring":(isSquash?"squash":"chunk"));
    for(let k=0;k<n;k++){const a=rnd(0,TAU),sp=rnd(2.5,8.5);
      shards.push({x:hx,y:hy,vx:Math.cos(a)*(isSquash?sp*0.3:sp),vy:isSquash?rnd(-0.3,1.2):Math.sin(a)*sp-3,r:rnd(R*0.16,R*0.34),
        rot:isSquash?0:rnd(0,TAU),vr:isSquash?0:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.02),kind:shardKind,
        col:k%4===0?"#ffffff":(k%4===1?s.col:pick(SCOOP))});}
    for(let k=0;k<rint(5,8);k++){const a=rnd(0,TAU),sp=rnd(4,11);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,len:rnd(7,16),life:1,decay:rnd(0.05,0.09)});}
    puffs.push({x:hx,y:hy,r:s.r*0.6,vr:rnd(1,2),life:1,decay:0.02});
    // scoring: rainbow=10, gold=6, ラッキー色=+1, fever doubles everything
    let base=s.rb?10:(s.gold?6:1);
    const isLucky=!s.gold&&!s.rb&&s.col===luckyColor; // ② きょうのラッキー色
    if(isLucky)base+=1;
    const pts=base*(fever>0?2:1);
    count+=pts;stageBroken++;combo++;comboT=0.9;api.setScore(count);
    if(s.rb)rainbowScoop(hx,hy,pts); // ① にじいろアイス 大盤振る舞い
    if(isLucky)luckyHit(hx,hy);      // ② ラッキー色 小さめ祝福＋星のキラッ
    if(s.gold){
      // rainbow burst + fanfare for the golden scoop
      for(let k=0;k<14&&shards.length<90;k++){const a=rnd(0,TAU),sp2=rnd(3,9);
        shards.push({x:hx,y:hy,vx:Math.cos(a)*sp2,vy:Math.sin(a)*sp2-3.5,r:rnd(R*0.14,R*0.3),
          rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.008,0.014),col:RAINBOW[k%RAINBOW.length]});}
      rings.push({x:hx,y:hy,r:s.r*0.3,vr:s.r*0.9,life:1,decay:0.035,col:"#ffd23f"});
      floats.push({x:hx,y:hy-s.r*1.4,txt:"ゴールド！ +"+pts,vy:-0.9,life:1.2,col:"#ffb400",size:34});
      api.tone(1046,0.12,"triangle",0.16);
      setTimeout(()=>api.tone(1318,0.12,"triangle",0.14),90);
      setTimeout(()=>api.tone(1568,0.2,"triangle",0.14),180);
      celebrate=Math.min(2,celebrate+0.8);
    }
    // fever gauge fills outside fever; full = FEVER TIME
    if(fever<=0){gauge=Math.min(1,gauge+((s.gold||s.rb)?0.34:0.13));if(gauge>=1)startFever();}
    flash=Math.min(1,flash+0.32);flashHue=s.gold?"#ffd23f":s.col;
    api.slide(360-Math.min(combo*6,80),150,0.12,0.3,"square");
    api.noise(0.1,0.16,1500,"bandpass",1);
    api.tone(520*Math.pow(2,clamp(combo,0,10)/12),0.12,"triangle",0.12);
    api.boom(0.4+Math.min(combo,6)*0.03);api.shake(6+Math.min(combo,8));api.hitStop(2);
    if(combo>1)floats.push({x:hx,y:hy-s.r,txt:"x"+combo,vy:-1.1,life:1,
      col:combo>=8?"#ff2bff":combo>=5?"#ff5b5b":combo>=3?"#ff8c42":"#ffd23f",size:combo>=4?40:30});
    if(combo>=3){celebrate=Math.min(2,celebrate+0.5);}
    // make the scoops above tumble (gravity feel) by un-anchoring them
    for(const o of scoops){if(!o.broken&&o.i>s.i&&!o.falling){o.falling=true;o.fvy=rnd(-2,-5);o.fvx=rnd(-3,3);o.fr=rnd(-0.2,0.2);}}
    checkStage();
  }

  function startFever(){
    fever=10;gauge=0;feverBanner=2;celebrate=2.2;flash=1;flashHue="#ffd23f";
    api.boom(0.6);api.shake(16);
    api.slide(523,1568,0.5,0.22,"triangle");
    setTimeout(()=>api.tone(880,0.15,"triangle",0.16),120);
    setTimeout(()=>api.tone(1174,0.15,"triangle",0.15),240);
    setTimeout(()=>api.tone(1568,0.28,"triangle",0.14),380);
  }

  function rainbowScoop(hx,hy,pts){
    // ① にじいろアイス撃破: 虹の輪＋大量きらきら＋祝福バナー(激レアの大盤振る舞い)
    rbMsgT=1.5;celebrate=Math.min(2.2,celebrate+0.9);
    api.boom(0.6);api.shake(16);api.hitStop(4);
    api.slide(660,1568,0.5,0.22,"triangle");
    setTimeout(()=>api.tone(988,0.14,"triangle",0.12),80);
    setTimeout(()=>api.tone(1318,0.18,"triangle",0.1),180);
    for(let k=0;k<RAINBOW.length;k++)rings.push({x:hx,y:hy,r:Math.max(1,R*0.3),vr:R*(0.6+k*0.14),life:1,decay:0.04,col:RAINBOW[k]});
    for(let k=0;k<22&&shards.length<90;k++){const a=rnd(0,TAU),sp=rnd(3,10);
      shards.push({x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3.5,r:rnd(R*0.16,R*0.34),
        rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.008,0.014),col:RAINBOW[k%RAINBOW.length]});}
    floats.push({x:hx,y:hy-R*1.5,txt:"にじいろ！ +"+pts,vy:-0.9,life:1.3,col:"#ff5b8a",size:34});
  }
  function luckyHit(hx,hy){
    // ② ラッキー色命中: 小さめの祝福。初回だけ中央上で「きょうの ラッキーは ◯」を教える。
    if(!luckySeen){luckySeen=true;luckyMsg="きょうの ラッキーは "+(SCOOPNAME[luckyColor]||"?")+"！";luckyMsgT=1.9;}
    else{luckyMsg="ラッキー！";luckyMsgT=Math.max(luckyMsgT,0.8);}
    api.tone(1046,0.12,"triangle",0.1);setTimeout(()=>api.tone(1568,0.14,"triangle",0.08),70);
    for(let k=0;k<8;k++){const a=rnd(0,TAU),sp=rnd(2,6);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,len:rnd(6,12),life:1,decay:rnd(0.05,0.08)});}
    floats.push({x:hx,y:hy-R*0.9,txt:"ラッキー！",vy:-0.9,life:1,col:luckyColor,size:24});
  }

  function checkStage(){
    if(clearT>0||strikeT>0)return;
    const alive=scoops.filter(s=>!s.broken).length;
    if(alive<=0){
      // (軸3) 目標こ数にまだ届いていなければ、ステージは進めず静かに積み増すだけ(画面外の的を作らない)
      if(stageBroken<stageGoal){
        rebuild(Math.min(stageGoal-stageBroken,maxTower));
        announceBatch();
        return;
      }
      // STRIKE! whole tower down
      // ③ ノンストップ ボーナス: このタワーを コンボを切らさず 崩しきったら +5 & 祝福バナー。
      if(!nonstopBroken&&stageBroken>=3){count+=5;api.setScore(count);perfectT=2.0;
        api.tone(1318,0.16,"triangle",0.12);setTimeout(()=>api.tone(1760,0.18,"triangle",0.1),110);}
      stage++;
      strikeT=2.2;celebrate=2.4;flash=1;flashHue=theme().acc;
      clearTxt="ストライク！";
      api.boom(0.7);api.shake(22);
      api.slide(523,1046,0.5,0.24,"triangle");
      setTimeout(()=>api.tone(784,0.2,"triangle",0.18),130);
      setTimeout(()=>api.tone(1046,0.3,"triangle",0.16),300);
      for(let k=0;k<30;k++){const a=rnd(0,TAU),sp=rnd(3,10);
        shards.push({x:towerX,y:api.H*0.5,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,r:rnd(R*0.2,R*0.4),
          rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.008,0.016),col:pick(SCOOP)});}
    }else if(stageBroken>=stageGoal){
      // safety: goal met though some remain
      clearT=1.6;clearTxt="ステージ クリア！";stage++;
      celebrate=1.6;api.boom(0.5);api.shake(12);
      api.slide(523,784,0.3,0.2,"triangle");api.tone(988,0.3,"triangle",0.12);
    }
  }

  layout();
  newTower();

  return {
    resize:layout,
    input(px,py,type){
      if(type!=="down")return;
      if(clearT>0||strikeT>0)return;
      // ④ おひさま ひみつタップ: 減点なしのごほうび(きらめき)。連打farm防止にクールダウン。
      if(sunWink<=0.2&&Math.hypot(px-sunPos.x,py-sunPos.y)<sunPos.r*1.2){
        sunWink=1;api.tone(1318,0.1,"triangle",0.08);setTimeout(()=>api.tone(1760,0.12,"triangle",0.07),70);
        for(let k=0;k<7;k++){const a=rnd(-TAU*0.5,0),sp=rnd(2,6);
          sparks.push({x:sunPos.x,y:sunPos.y,vx:Math.cos(a)*sp*0.7,vy:Math.sin(a)*sp-1,len:rnd(6,12),life:1,decay:0.05});}
        return;
      }
      // tap to launch a ball; it always heads for the top-most surviving scoop
      const bi=topAlive();
      if(bi<0)return;
      const tgt=scoops[bi];
      // (軸3) タワーから大きく外れたタップは空振り(得点にしない)。低学年の指でも当てやすい余裕は残す。
      if(Math.hypot(px-tgt.x,py-tgt.baseY)>tgt.r*HIT_MULT){
        api.tone(220,0.06,"sine",0.05);
        return;
      }
      // (軸3) 連射間隔の下限。連打の速さだけでは伸びず、狙いの精度がスコアに効くようにする。
      if(tsec-lastShotAt<SHOT_CD)return;
      lastShotAt=tsec;
      spawnBall(tgt.x,tgt.baseY);
    },
    frame(dt,now){
      tsec+=0.016*dt;
      if(launchT>0)launchT=Math.max(0,launchT-0.06*dt);
      if(celebrate>0)celebrate=Math.max(0,celebrate-0.02*dt);
      if(fever>0){
        const nf=Math.max(0,fever-0.016*dt);
        if(nf<=0){ // fever just ended
          floats.push({x:api.W/2,y:api.H*0.35,txt:"フィーバー おわり",vy:-0.5,life:1,col:"#ff8ac4",size:26});
          api.slide(880,440,0.3,0.12,"triangle");
        }
        fever=nf;
      }
      if(feverBanner>0)feverBanner=Math.max(0,feverBanner-0.016*dt);
      if(canRecoil.L>0)canRecoil.L=Math.max(0,canRecoil.L-0.05*dt);
      if(canRecoil.R>0)canRecoil.R=Math.max(0,canRecoil.R-0.05*dt);

      // ----- background: candy sky gradient (or ComfyUI 画像背景 + ステージ色の薄い重ね) -----
      const th=theme();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        g.save();g.globalAlpha=0.28;const tg=g.createLinearGradient(0,0,0,api.H);
        tg.addColorStop(0,th.sky[0]);tg.addColorStop(0.5,th.sky[2]);tg.addColorStop(1,th.grd);
        g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,th.sky[0]);grd.addColorStop(0.4,th.sky[1]);
        grd.addColorStop(0.72,th.sky[2]);grd.addColorStop(1,th.sky[3]);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // soft sun-candy glow upper area
      let glow=g.createRadialGradient(api.W*0.5,api.H*0.1,0,api.W*0.5,api.H*0.1,api.W*0.7);
      glow.addColorStop(0,"rgba(255,255,240,.3)");glow.addColorStop(1,"rgba(255,255,240,0)");
      g.fillStyle=glow;g.fillRect(0,0,api.W,api.H);
      // ----- おひさま (④ ひみつタップの的) -----
      {const sx=sunPos.x,sy=sunPos.y,sr=Math.max(1,sunPos.r);
       let sg=g.createRadialGradient(sx,sy,0,sx,sy,Math.max(1,sr*4));
       sg.addColorStop(0,"rgba(255,246,190,.5)");sg.addColorStop(0.4,"rgba(255,238,170,.2)");sg.addColorStop(1,"rgba(255,238,170,0)");
       g.fillStyle=sg;g.beginPath();g.arc(sx,sy,Math.max(1,sr*4),0,TAU);g.fill();
       g.save();g.shadowColor="rgba(255,240,190,.9)";g.shadowBlur=18;
       g.fillStyle="rgba(255,250,225,.95)";g.beginPath();g.arc(sx,sy,sr,0,TAU);g.fill();g.restore();
       // 叩かれた瞬間だけ ^_^ のウインク顔(発見のごほうび)
       if(sunWink>0){sunWink-=0.02*dt;
         g.save();g.strokeStyle="#e59a3a";g.lineWidth=Math.max(2,sr*0.13);g.lineCap="round";g.globalAlpha=clamp(sunWink*1.4,0,1);
         g.beginPath();
         g.moveTo(sx-sr*0.46,sy-sr*0.04);g.quadraticCurveTo(sx-sr*0.3,sy-sr*0.32,sx-sr*0.14,sy-sr*0.04);
         g.moveTo(sx+sr*0.14,sy-sr*0.04);g.quadraticCurveTo(sx+sr*0.3,sy-sr*0.32,sx+sr*0.46,sy-sr*0.04);
         g.stroke();
         g.beginPath();g.arc(sx,sy+sr*0.16,Math.max(1,sr*0.34),0.12*Math.PI,0.88*Math.PI);g.stroke();
         g.restore();g.globalAlpha=1;if(sunWink<0)sunWink=0;}
      }
      // FEVER: sliding rainbow bands transform the whole sky
      if(fever>0){
        const fa=Math.min(1,fever)*Math.min(1,(10-fever)*2+0.2); // fade in/out
        g.save();g.globalCompositeOperation="lighter";
        const bw2=api.W/6;
        for(let i=0;i<8;i++){
          const x0=((i*bw2+tsec*60)%(api.W+bw2*2))-bw2;
          g.globalAlpha=0.13*fa;
          g.fillStyle=RAINBOW[i%RAINBOW.length];
          g.beginPath();g.moveTo(x0,0);g.lineTo(x0+bw2,0);
          g.lineTo(x0+bw2-api.H*0.25,api.H);g.lineTo(x0-api.H*0.25,api.H);g.closePath();g.fill();
        }
        g.restore();g.globalAlpha=1;
        // fever confetti rain (bounded)
        if(Math.random()<0.35&&shards.length<70)
          shards.push({x:rnd(0,api.W),y:-10,vx:rnd(-1.5,1.5),vy:rnd(2,5),
            r:rnd(R*0.14,R*0.28),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.01,col:pick(RAINBOW)});
      }
      // drifting sweets ※画像背景のときは絵の中に十分な情景があるので描かない(平坦な手描きが絵と喧嘩しないように)
      if(!imgBg) for(const it of bgItems){
        it.x+=it.sp*dt;if(it.x>api.W+60)it.x=-60;it.ph+=0.02*dt;it.rot+=it.vr*dt;
        const yy=it.y+Math.sin(it.ph)*it.bob;
        g.save();g.globalAlpha=0.55;g.translate(it.x,yy);g.rotate(it.rot);g.scale(it.s,it.s);
        drawSweet(it.kind,it.col);g.restore();
      }
      g.globalAlpha=1;
      // twinkling motes
      for(const m of motes){
        m.y-=m.sp*0.2*dt;m.x+=m.sp*0.18*dt;m.tw+=0.05*dt;
        if(m.y<0)m.y=api.H;if(m.x>api.W)m.x=0;
        g.globalAlpha=0.12+0.14*(0.5+0.5*Math.sin(m.tw));
        g.fillStyle=m.col;g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();
      }
      g.globalAlpha=1;

      // ----- ground: pastel candy floor ※画像背景のときは絵の地面をそのまま活かして描かない -----
      if(!imgBg){
        const gy=api.H*0.86;
        g.fillStyle=th.grd;g.fillRect(0,gy,api.W,api.H-gy);
        g.fillStyle="rgba(255,255,255,.35)";g.fillRect(0,gy,api.W,6);
        // sprinkle dots on floor
        for(let i=0;i<18;i++){const sx=((i*97+13)%100)/100*api.W,sy=gy+12+((i*53)%3)*10;
          g.save();g.translate(sx,sy);g.rotate(i*1.3);
          g.fillStyle=SCOOP[i%SCOOP.length];g.fillRect(-5,-1.6,10,3.2);g.restore();}
      }

      // ----- the cone + tower base -----
      drawCone();

      // ----- 左右の candy cannon(発射台。反動アニメつき) -----
      drawCannon(cannonL.x,cannonL.y,canRecoil.L,false);
      drawCannon(cannonR.x,cannonR.y,canRecoil.R,true);

      // ----- scoops (bottom alive ones support; falling ones tumble) -----
      // ground shadow of the tower
      const aliveCount=scoops.filter(s=>!s.broken).length;
      if(aliveCount>0){g.fillStyle="rgba(120,60,90,.18)";g.beginPath();
        g.ellipse(towerX,towerBaseY+R*0.35,R*1.3,R*0.35,0,0,TAU);g.fill();}
      for(const s of scoops){
        if(s.broken)continue;
        s.wob+=0.05*dt;s.blink+=0.04*dt;
        if(s.falling){s.fvy+=0.5*dt;s.baseY+=s.fvy*dt;s.x+=(s.fvx||0)*dt;s.wob+=s.fr*dt;
          if(s.baseY>api.H+R*2){s.broken=true;}
        }else{
          s.sway=Math.sin(tsec*1.5+s.i*0.5)*R*0.04*(s.i/Math.max(1,scoops.length));
        }
        const dx=s.falling?0:s.sway;
        drawScoop(s,s.x+dx,s.baseY);
      }
      // prune fully gone & re-check
      scoops=scoops.filter(s=>!(s.broken&&s._counted));
      scoops.forEach(s=>{if(s.broken)s._counted=true;});

      // ----- flying balls -----
      for(const b of balls){
        if(b.done)continue;
        b.t+=0.06*dt;b.rot+=0.3*dt;
        const t=ease(Math.min(b.t,1));
        b.x=lerp(b.x,b.tx,clamp(0.18*dt,0,1));
        const arc=Math.sin(Math.min(b.t,1)*Math.PI)*R*1.4;
        b.y=lerp(b.y,b.ty-arc,clamp(0.18*dt,0,1));
        drawBall(b);
        if(b.t>=1||Math.hypot(b.x-b.tx,b.y-b.ty)<R*0.4){
          b.done=true;
          const bi=topAlive();
          if(bi>=0){
            // hit the current top scoop (it may differ if changed; recompute target)
            const tgt=scoops[bi];
            breakScoop(tgt,combo>=4);
          }
        }
      }
      balls=balls.filter(b=>!b.done);

      // ----- puffs (creamy poofs) -----
      g.save();
      for(const p of puffs){p.r+=p.vr*dt;p.life-=p.decay*dt;
        g.globalAlpha=Math.max(0,p.life)*0.5;g.fillStyle="#fff";
        g.beginPath();g.arc(p.x,p.y,p.r,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;puffs=puffs.filter(p=>p.life>0);

      // ----- rings -----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);

      // ----- shards (creamy chunks / ⑦ かたち違いの欠片) -----
      for(const p of shards){p.vy+=0.4*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        if(p.kind==="crumble"){
          const s2=Math.max(0.6,p.r*(0.5+p.life*0.5));
          g.fillStyle=p.col;g.fillRect(-s2,-s2*0.6,s2*2,s2*1.2);
          g.fillStyle="rgba(255,255,255,.4)";g.fillRect(-s2*0.55,-s2*0.3,s2*0.5,s2*0.3);
        }else if(p.kind==="ring"){
          const s2=Math.max(0.6,p.r*(0.5+p.life*0.5));
          g.strokeStyle=p.col;g.lineWidth=Math.max(1,s2*0.5);g.lineCap="round";
          g.beginPath();g.arc(0,0,s2,0,Math.PI*1.3);g.stroke();
        }else if(p.kind==="squash"){
          // ⑦ 丸スコープの もう一種類の壊れ方: だんだん横に潰れて平たくなり、そのまま消える(『へこむ』演出)
          const sx=Math.max(0.6,p.r*(0.8+(1-p.life)*1.3));
          const sy=Math.max(0.6,p.r*(0.55*p.life+0.12));
          g.fillStyle=p.col;g.beginPath();g.ellipse(0,0,sx,sy,0,0,TAU);g.fill();
          g.fillStyle="rgba(255,255,255,.4)";g.beginPath();g.ellipse(-sx*0.25,-sy*0.35,sx*0.3,sy*0.4,0,0,TAU);g.fill();
        }else{
          g.fillStyle=p.col;g.beginPath();g.arc(0,0,p.r*(0.5+p.life*0.5),0,TAU);g.fill();
          g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(-p.r*0.2,-p.r*0.2,p.r*0.22,0,TAU);g.fill();
        }
        g.restore();}
      shards=shards.filter(p=>p.life>0&&p.y<api.H+40);

      // ----- glint sparks -----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#fff7c2";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;sparks=sparks.filter(sp=>sp.life>0);

      // ----- floats (combo numbers) -----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0){combo=0;
        // ③ コンボが切れたら このタワーの ノンストップ は失敗
        if(stageBroken>0&&scoops.some(s=>!s.broken))nonstopBroken=true;}}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.018*dt;
        g.globalAlpha=Math.max(0,f.life);g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.textAlign="center";g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.4)";
        g.strokeText(f.txt,f.x,f.y);g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);

      // ----- celebrate color sweep -----
      if(celebrate>0){const ca=Math.min(1,celebrate);
        g.save();g.globalCompositeOperation="lighter";
        const cw=g.createRadialGradient(towerX,api.H*0.5,0,towerX,api.H*0.5,api.W*0.7);
        cw.addColorStop(0,"rgba(255,240,200,"+(0.3*ca)+")");
        cw.addColorStop(0.5,"rgba(255,180,220,"+(0.16*ca)+")");
        cw.addColorStop(1,"rgba(255,180,220,0)");
        g.fillStyle=cw;g.fillRect(0,0,api.W,api.H);g.restore();}

      // ----- impact flash -----
      if(flash>0){flash-=0.06*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa*0.28;
        g.fillStyle=flashHue;g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}

      // spawn fresh tower once everything is gone & no banner running
      if(scoops.filter(s=>!s.broken).length===0&&clearT<=0&&strikeT<=0&&balls.length===0){
        newTower();
      }

      // ----- HUD (top-center safe band) -----
      drawHUD();

      // ----- STRIKE banner -----
      if(strikeT>0){strikeT-=0.016*dt;
        const a=clamp(strikeT*1.4,0,1),pop=1+Math.max(0,strikeT-1.7)*1.6;
        // confetti rain during strike
        if(tsec%0.05<dt*0.016)shards.push({x:rnd(0,api.W),y:-10,vx:rnd(-1.5,1.5),vy:rnd(2,5),
          r:rnd(R*0.18,R*0.34),rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:0.008,col:pick(SCOOP)});
        g.save();g.translate(api.W/2,api.H*0.4);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 "+Math.round(clamp(api.W*0.12,44,80))+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=10;g.lineJoin="round";g.strokeStyle="rgba(120,40,90,.7)";g.strokeText(clearTxt,0,0);
        let bg=g.createLinearGradient(0,-40,0,44);bg.addColorStop(0,"#fff2a0");bg.addColorStop(1,"#ff7ac0");
        g.fillStyle=bg;g.fillText(clearTxt,0,0);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("つぎは ステージ"+stage+"！",0,52);
        g.globalAlpha=1;g.lineJoin="miter";g.restore();g.textAlign="left";
        if(strikeT<=0){strikeT=0;newTower();}
      }
      // ----- generic stage-clear banner -----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1),pop=1+Math.max(0,clearT-1.3)*1.6;
        g.save();g.translate(api.W/2,api.H*0.42);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,150,200,.9)";g.shadowBlur=18;g.fillStyle="#ffd23f";
        g.fillText(clearTxt,0,0);g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText(clearTxt,0,0);
        g.globalAlpha=1;g.restore();g.textAlign="left";
        if(clearT<=0){clearT=0;newTower();}
      }
      // ① にじいろアイス! 発見バナー(虹色に色替わり・上部中央=安全帯)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const a=clamp(rbMsgT*1.4,0,1),pop=1+Math.max(0,rbMsgT-1)*1.4,col=RAINBOW[Math.floor(tsec*6)%RAINBOW.length];
        g.save();g.translate(api.W/2,api.H*0.24);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle="#ffffff";g.fillText("にじいろアイス！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろアイス！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうの ラッキーいろ バナー(上部中央=安全帯)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        const a=clamp(luckyMsgT*1.5,0,1),pop=1+Math.max(0,luckyMsgT-1.2)*1.3;
        g.save();g.translate(api.W/2,api.H*0.30);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 24px 'Hiragino Maru Gothic ProN',system-ui";g.shadowColor=luckyColor;g.shadowBlur=14;
        g.fillStyle="#fff7c2";g.fillText(luckyMsg,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ ノンストップ ボーナス! バナー(ストライク文字と重ねないよう下側)
      if(perfectT>0){perfectT-=0.014*dt;
        const a=clamp(perfectT*1.3,0,1),pop=1+Math.max(0,perfectT-1.4)*1.4;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=16;
        g.fillStyle="#c7ffcf";g.fillText("ノンストップ ボーナス！",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,120,60,.7)";g.strokeText("ノンストップ ボーナス！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(perfectT<0)perfectT=0;}
      // 加算合成を確実に戻す(白飛び漏れ防止)
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
    },
    stop(){}
  };

  // ---------- drawing helpers ----------
  function drawHUD(){
    const left=clamp(stageGoal-stageBroken,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.05;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#7a3a5e";g.shadowColor="rgba(255,255,255,.6)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(255,255,255,.5)";rr(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageBroken/Math.max(1,stageGoal),0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#ff8ac4");gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg;rr(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.8)";g.lineWidth=2;rr(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }
  function drawCone(){
    const cx=towerX,cy=towerBaseY+R*0.2,w=R*1.5,h=R*2.2;
    g.save();
    const cg=g.createLinearGradient(cx-w,cy,cx+w,cy);
    cg.addColorStop(0,"#caa15a");cg.addColorStop(0.5,"#e8c47a");cg.addColorStop(1,"#a8803f");
    g.fillStyle=cg;
    g.beginPath();g.moveTo(cx-w*0.7,cy);g.lineTo(cx+w*0.7,cy);g.lineTo(cx,cy+h);g.closePath();g.fill();
    // waffle lines
    g.strokeStyle="rgba(120,80,30,.4)";g.lineWidth=1.5;
    for(let k=-3;k<=3;k++){g.beginPath();g.moveTo(cx+k*w*0.2,cy);g.lineTo(cx,cy+h);g.stroke();}
    for(let yy=cy+8;yy<cy+h;yy+=10){const f=(yy-cy)/h,ww=w*0.7*(1-f);
      g.beginPath();g.moveTo(cx-ww,yy);g.lineTo(cx+ww,yy);g.stroke();}
    g.restore();
  }
  function drawCannon(x,y,recoil,flip){
    // 左右の candy cannon: 発射の反動でわずかに縮む。画像が無ければ簡易な手描き大砲にフォールバック。
    const s=Math.max(24,R*1.3),kick=1-0.14*clamp(recoil,0,1);
    g.save();g.translate(x,y);g.scale(flip?-kick:kick,kick);
    g.fillStyle="rgba(0,0,0,.18)";g.beginPath();g.ellipse(0,s*0.5,s*0.9,s*0.22,0,0,TAU);g.fill();
    // barrel
    const bg2=g.createLinearGradient(-s*0.9,0,s*0.7,0);
    bg2.addColorStop(0,"#3a7d7a");bg2.addColorStop(1,"#245552");
    g.fillStyle=bg2;rr(-s*0.9,-s*0.32,s*1.6,s*0.62,s*0.28);g.fill();
    g.fillStyle="#e8933f";
    for(let k=0;k<3;k++){rr(-s*0.82+k*s*0.5,-s*0.32,s*0.2,s*0.62,4);g.fill();}
    g.fillStyle="rgba(255,255,255,.3)";g.fillRect(-s*0.85,-s*0.28,s*1.5,s*0.14);
    // wheel/base
    g.fillStyle="#2a2a2a";g.beginPath();g.arc(-s*0.55,s*0.4,s*0.36,0,TAU);g.fill();
    g.fillStyle="#6a6a6a";g.beginPath();g.arc(-s*0.55,s*0.4,s*0.15,0,TAU);g.fill();
    g.restore();
  }
  function drawScoop(s,x,y){
    const r=s.r;
    // ① にじいろアイスは体色が虹色を巡回して見える(lightenが使えるようhexのまま切替)
    const col=s.rb?RAINBOW[Math.floor((tsec*4+s.i))%RAINBOW.length]:s.col;
    g.save();g.translate(x,y);
    // にじいろアイス: 虹色の脈動ハロー(激レアを一目で見つけられる)
    if(s.rb){
      const pl=0.5+0.5*Math.sin(tsec*7+s.wob);
      g.save();g.globalCompositeOperation="lighter";
      const ha=g.createRadialGradient(0,0,Math.max(1,r*0.3),0,0,Math.max(1,r*2));
      ha.addColorStop(0,"rgba(255,180,220,"+(0.25+0.2*pl).toFixed(3)+")");
      ha.addColorStop(1,"rgba(255,180,220,0)");
      g.fillStyle=ha;g.beginPath();g.arc(0,0,Math.max(1,r*2),0,TAU);g.fill();
      g.restore();g.globalAlpha=1;
    }
    // golden scoop: pulsing halo + orbiting sparkles so it pops immediately
    if(s.gold){
      const pl=0.5+0.5*Math.sin(tsec*6+s.wob);
      g.save();g.globalCompositeOperation="lighter";
      const ha=g.createRadialGradient(0,0,r*0.3,0,0,r*2);
      ha.addColorStop(0,"rgba(255,225,110,"+(0.3+0.25*pl).toFixed(3)+")");
      ha.addColorStop(1,"rgba(255,225,110,0)");
      g.fillStyle=ha;g.beginPath();g.arc(0,0,r*2,0,TAU);g.fill();
      g.fillStyle="#fffbe0";
      for(let k=0;k<4;k++){const a=tsec*2.5+k*TAU/4,rr2=r*1.35;
        const sx2=Math.cos(a)*rr2,sy2=Math.sin(a)*rr2*0.7;
        g.globalAlpha=0.55+0.45*Math.sin(tsec*7+k*2);
        g.save();g.translate(sx2,sy2);g.rotate(a);
        g.fillRect(-r*0.12,-r*0.03,r*0.24,r*0.06);g.fillRect(-r*0.03,-r*0.12,r*0.06,r*0.24);
        g.restore();}
      g.restore();g.globalAlpha=1;
    }
    // ⑦ 形のバラつき: 丸スコープ以外に 平たいウエハース と 輪っかドーナツ を混ぜる(色違いだけにしない)
    if(s.kind==="wafer"){
      // 平たい円盤(ウエハースクッキー)。丸スコープと違い、まん丸ではなく縦につぶれた形。
      const rr3=Math.max(1,r);
      g.save();g.scale(1,0.58);
      const grd=g.createRadialGradient(-rr3*0.3,-rr3*0.3,rr3*0.1,0,0,rr3*1.2);
      grd.addColorStop(0,lighten(col,70));grd.addColorStop(0.6,lighten(col,15));grd.addColorStop(1,col);
      g.fillStyle=grd;g.beginPath();g.arc(0,0,rr3,0,TAU);g.fill();
      g.strokeStyle="rgba(120,80,30,.35)";g.lineWidth=1.5;
      for(let k=-2;k<=2;k++){g.beginPath();g.moveTo(-rr3*0.9,k*rr3*0.36);g.lineTo(rr3*0.9,k*rr3*0.36);g.stroke();}
      for(let k=-2;k<=2;k++){g.beginPath();g.moveTo(k*rr3*0.36,-rr3*0.9);g.lineTo(k*rr3*0.36,rr3*0.9);g.stroke();}
      g.fillStyle="rgba(255,255,255,.35)";g.beginPath();g.ellipse(-rr3*0.3,-rr3*0.35,rr3*0.35,rr3*0.5,0,0,TAU);g.fill();
      g.restore();
      // 側面(厚み)を少し見せて円盤らしく
      g.fillStyle=shade(col,-18);g.fillRect(-rr3*0.9,rr3*0.02,rr3*1.8,rr3*0.16);
    }else if(s.kind==="donut"){
      // 輪っか(ドーナツ)型。中央に穴があるので丸スコープとはっきり違うシルエット。
      const outer=Math.max(2,r),inner=Math.max(1,r*0.42);
      g.save();
      const grd=g.createRadialGradient(-outer*0.3,-outer*0.3,outer*0.1,0,0,outer);
      grd.addColorStop(0,lighten(col,60));grd.addColorStop(0.7,col);grd.addColorStop(1,shade(col,-10));
      g.fillStyle=grd;g.beginPath();g.arc(0,0,outer,0,TAU);g.arc(0,0,inner,0,TAU,true);g.fill("evenodd");
      g.fillStyle="rgba(255,255,255,.35)";g.beginPath();g.ellipse(-outer*0.32,-outer*0.32,outer*0.26,outer*0.14,-0.3,0,TAU);g.fill();
      g.restore();
      // グレーズのしずく(輪の縁から少し垂れる=ドーナツらしさ)
      g.fillStyle=col;
      for(let k=0;k<3;k++){const a=s.wob+k*2.1;g.save();g.rotate(a);g.beginPath();
        g.moveTo(outer*0.7,0);g.quadraticCurveTo(outer*0.95,outer*0.25,outer*0.75,outer*0.4);
        g.quadraticCurveTo(outer*0.6,outer*0.25,outer*0.6,0);g.closePath();g.fill();g.restore();}
    }else{
      // soft round scoop body
      const grd=g.createRadialGradient(-r*0.3,-r*0.4,r*0.1,0,0,r*1.2);
      grd.addColorStop(0,lighten(col,70));grd.addColorStop(0.6,lighten(col,15));grd.addColorStop(1,col);
      g.fillStyle=grd;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
      // glossy top sheen
      g.fillStyle="rgba(255,255,255,.4)";g.beginPath();
      g.ellipse(-r*0.25,-r*0.4,r*0.4,r*0.22,-0.4,0,TAU);g.fill();
      // little drip at bottom
      g.fillStyle=col;g.beginPath();g.moveTo(-r*0.4,r*0.5);
      g.quadraticCurveTo(-r*0.5,r*1.0,-r*0.2,r*0.9);
      g.quadraticCurveTo(0,r*1.05,r*0.2,r*0.9);
      g.quadraticCurveTo(r*0.5,r*1.0,r*0.4,r*0.5);g.closePath();g.fill();
      // sprinkles
      for(let k=0;k<5;k++){const a=s.wob+k*1.25,rr2=r*0.55;
        g.save();g.translate(Math.cos(a)*rr2,Math.sin(a)*rr2*0.7-r*0.1);g.rotate(a);
        g.fillStyle=SCOOP[(s.i+k)%SCOOP.length];g.fillRect(-r*0.16,-r*0.05,r*0.32,r*0.1);g.restore();}
    }
    // cute face on the top scoop
    if(s.face){
      const bl=(Math.sin(s.blink)>0.95)?0.15:1;
      g.fillStyle="#5a3a4a";
      g.beginPath();g.ellipse(-r*0.3,-r*0.05,r*0.1,r*0.13*bl,0,0,TAU);g.fill();
      g.beginPath();g.ellipse(r*0.3,-r*0.05,r*0.1,r*0.13*bl,0,0,TAU);g.fill();
      g.fillStyle="#fff";g.beginPath();g.arc(-r*0.26,-r*0.1,r*0.04,0,TAU);g.arc(r*0.34,-r*0.1,r*0.04,0,TAU);g.fill();
      g.fillStyle="rgba(255,130,160,.5)";g.beginPath();
      g.arc(-r*0.45,r*0.12,r*0.12,0,TAU);g.arc(r*0.45,r*0.12,r*0.12,0,TAU);g.fill();
      g.strokeStyle="#5a3a4a";g.lineWidth=Math.max(2,r*0.07);g.lineCap="round";
      g.beginPath();g.arc(0,r*0.05,r*0.18,0.12*Math.PI,0.88*Math.PI);g.stroke();
      // cherry on top
      g.fillStyle="#ff3b5b";g.beginPath();g.arc(0,-r-r*0.18,r*0.18,0,TAU);g.fill();
      g.strokeStyle="#3a7a3a";g.lineWidth=2;g.beginPath();g.moveTo(0,-r-r*0.3);g.lineTo(r*0.12,-r-r*0.6);g.stroke();
    }
    // ② ラッキー色ヒント: 頭上に小さな星がキラッ(気づけるように)
    if(luckyColor&&s.col===luckyColor&&!s.gold&&!s.rb){
      const tw=0.5+0.5*Math.sin(tsec*5+s.wob);
      g.save();g.translate(0,-r-r*0.5);g.globalAlpha=0.45+0.5*tw;
      g.fillStyle="#fff7c2";g.shadowColor="#ffe27a";g.shadowBlur=8;g.beginPath();
      for(let k=0;k<5;k++){const ang=-Math.PI/2+k*TAU/5,ro=Math.max(1,r*0.22),ri=Math.max(1,r*0.09);
        g.lineTo(Math.cos(ang)*ro,Math.sin(ang)*ro);
        const a2=ang+TAU/10;g.lineTo(Math.cos(a2)*ri,Math.sin(a2)*ri);}
      g.closePath();g.fill();g.restore();g.globalAlpha=1;g.shadowBlur=0;
    }
    g.restore();
  }
  function drawBall(b){
    const r=R*0.42;
    g.save();g.translate(b.x,b.y);
    g.save();g.globalCompositeOperation="lighter";
    const aur=g.createRadialGradient(0,0,r*0.2,0,0,r*2);
    aur.addColorStop(0,"rgba(255,255,255,.5)");aur.addColorStop(1,"rgba(255,255,255,0)");
    g.fillStyle=aur;g.beginPath();g.arc(0,0,r*2,0,TAU);g.fill();g.restore();
    const grd=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r);
    grd.addColorStop(0,lighten(b.col,90));grd.addColorStop(0.6,b.col);grd.addColorStop(1,shade(b.col,-40));
    g.fillStyle=grd;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(-r*0.32,-r*0.34,r*0.22,0,TAU);g.fill();
    g.restore();
  }
  function drawSweet(kind,col){
    // small pastel sweet icons for the floating background
    if(kind==="candy"){
      g.fillStyle=col;g.beginPath();g.arc(0,0,11,0,TAU);g.fill();
      g.fillStyle=lighten(col,90);g.beginPath();g.arc(-3,-3,3.5,0,TAU);g.fill();
      g.fillStyle=col;g.beginPath();g.moveTo(11,0);g.lineTo(20,-7);g.lineTo(20,7);g.closePath();
      g.moveTo(-11,0);g.lineTo(-20,-7);g.lineTo(-20,7);g.closePath();g.fill();
    }else if(kind==="choco"){
      g.fillStyle=shade("#7a4a2a",10);g.fillRect(-12,-9,24,18);
      g.strokeStyle="rgba(0,0,0,.25)";g.lineWidth=1.5;
      g.strokeRect(-12,-9,12,9);g.strokeRect(0,-9,12,9);g.strokeRect(-12,0,12,9);g.strokeRect(0,0,12,9);
    }else if(kind==="gummy"){
      g.fillStyle=col;g.globalAlpha*=0.85;
      g.beginPath();g.arc(0,-2,9,Math.PI,0);g.lineTo(9,9);g.lineTo(-9,9);g.closePath();g.fill();
      g.globalAlpha/=0.85;g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(-3,-3,2.5,0,TAU);g.fill();
    }else if(kind==="cake"){
      g.fillStyle="#ffe6b0";g.fillRect(-11,-2,22,12);
      g.fillStyle=col;g.beginPath();g.moveTo(-11,-2);g.quadraticCurveTo(0,-12,11,-2);g.closePath();g.fill();
      g.fillStyle="#ff3b5b";g.beginPath();g.arc(0,-8,3,0,TAU);g.fill();
    }else{ // donut
      g.fillStyle="#f0c080";g.beginPath();g.arc(0,0,12,0,TAU);g.fill();
      g.fillStyle=col;g.beginPath();g.arc(0,0,12,Math.PI*1.1,Math.PI*2.1);g.arc(0,-1,7,Math.PI*2.1,Math.PI*1.1,true);g.closePath();g.fill();
      g.fillStyle="#7a4a2a";g.beginPath();g.arc(0,0,4.5,0,TAU);g.fill();
    }
  }
  function rr(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function lighten(hex,amt){const a=amt===undefined?50:amt;const c=parseInt(hex.slice(1),16);
    const r=Math.min(255,((c>>16)&255)+a),gg=Math.min(255,((c>>8)&255)+a),b=Math.min(255,(c&255)+a);
    return "rgb("+r+","+gg+","+b+")";}
  function shade(hex,amt){const c=parseInt(hex.slice(1),16);
    const r=clamp(((c>>16)&255)+amt,0,255),gg=clamp(((c>>8)&255)+amt,0,255),b=clamp((c&255)+amt,0,255);
    return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("icecream", build_icecream);
