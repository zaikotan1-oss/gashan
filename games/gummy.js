function build_gummy(api){
  const g=api.g;
  api.preload(["bg.jpg","boss.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。gold.png は生成不良のため未使用
  let holes=[],moles=[],bits=[],rings=[],sparks=[],floats=[],puffs=[],motes=[];
  let R,cols,rows,spawnT=0,count=0,combo=0,comboT=0,tGlobal=0,flash=0,flashCol="#fff";
  // stage progression: endless, never game over
  let stage=1,stageKill=0,stageGoal=8,clearT=0,clearStage=0,celebrate=0,hsCool=0;
  // BOSS (king gummy every 3 stages) + FEVER TIME (combo gauge) + next-stage teaser
  let boss=null,bossWarn=0,bossStage=false,feverG=0,feverT=0,clearMsg="";
  const FEVER_LEN=10; // seconds
  // ---- 隠し発見レイヤー(ハンマー/トラックと同じ思想) ----
  // ② きょうのラッキー色: セッション秘密の1色。そのグミを つぶすと 小ボーナス＋頭上に星のキラッ
  let luckyColor,luckyMsgT=0,luckySeen=false;
  let rbMsgT=0;                 // ① にじいろグミ 発見バナー
  let stageEscaped=0,perfectT=0; // ③ パーフェクト: この ステージで 1こも にがさず たおしたら ボーナス
  // per-stage candy palettes (pastel sweet-world backdrops)
  const STAGE_BG=[
    {a:"#ffe3f1",b:"#ffc6e0",c:"#ff9ecb",d:"#ffd9a6"}, // strawberry candy
    {a:"#e6f0ff",b:"#c6dcff",c:"#9ec2ff",d:"#bfeaff"}, // blueberry soda
    {a:"#fff3d6",b:"#ffe2a6",c:"#ffd06a",d:"#ffe9b0"}, // honey lemon
    {a:"#eee0ff",b:"#d8c0ff",c:"#bd9bff",d:"#ffd0ee"}, // grape jelly
    {a:"#d9fbe7","b":"#aef0cf",c:"#7be3b0",d:"#d6fff0"}  // mint cream
  ];
  const GUM=["#ff5b9e","#5bc8ff","#ffd23f","#7be08a","#c78bff","#ff8c42"];
  const GUMNAME=["ピンク","みずいろ","きいろ","みどり","むらさき","オレンジ"];
  luckyColor=pick(GUM);luckyMsgT=2.6; // 起動時に一度だけ「きょうのラッキーいろは◯！」を中央上に教える
  function curBg(){return STAGE_BG[(stage-1)%STAGE_BG.length];}
  function stageGoalFor(s){return 10+(s-1)*3;}   // 8,10,12,14→10,13,16,19（7〜8歳向けに手応えを増やした）
  // floating sweet props drifting in the sky (candies/sprinkles)
  let sweets=[];
  function buildBg(){
    sweets=[];for(let i=0;i<9;i++)sweets.push({
      x:rnd(0,api.W),y:rnd(api.H*0.05,api.H*0.42),s:rnd(0.7,1.5),
      col:pick(GUM),ph:rnd(0,TAU),sp:rnd(0.02,0.06),amp:rnd(8,26),
      drift:rnd(0.03,0.1),kind:rint(0,2),tapped:false});
    motes=[];for(let i=0;i<24;i++)motes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(0.8,2.4),sp:rnd(0.1,0.4),tw:rnd(0,TAU)});
  }
  function layout(){
    cols=3;rows=3;
    R=clamp(Math.min(api.W/(cols+1),api.H/(rows+2))*0.36,28,62);
    holes=[];
    const gw=api.W*0.82,gx=(api.W-gw)/2,gh=api.H*0.5,gy=api.H*0.30;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)
      holes.push({x:gx+gw*(c+0.5)/cols,y:gy+gh*(r+0.5)/rows,occ:false});
    moles.forEach(m=>{const h=holes[m.hi];if(h){m.x=h.x;m.baseY=h.y;}});
    buildBg();
  }
  layout();
  function pickKind(){
    // ① にじいろグミ: ステージ1から出る激レア(約14分の1)。いつ出るか分からない=ドキドキ発見。序盤から大小混在を体感させる。
    if(Math.random()<0.07)return "rainbow";
    // ジャンボ: ステージ1から出る常設バリエーション。同じ形のまま1.6倍サイズ・HP1(すぐ壊れる)で「大小混在」を作る
    if(Math.random()<0.08)return "jumbo";
    const bag=["gum","gum","donut","cookie"]; // ①stage1から丸(gum)一辺倒にしない: 輪っか(donut)とひび割れ円盤(cookie)を最初から混ぜる
    if(stage>=2)bag.push("jelly");          // hard jelly: 2 taps
    if(stage>=2)bag.push("cookie");         // ステージ2以降はクッキーの出現比率をさらに上げる
    if(stage>=3)bag.push("gold");           // shiny sweet: bonus points
    if(stage>=4)bag.push("jelly");
    if(feverT>0)bag.push("gold","gold");    // fever: golden rain
    return pick(bag);
  }
  function spawn(){
    // during a boss fight the center hole belongs to the king
    const free=holes.map((h,i)=>i).filter(i=>!holes[i].occ&&!(bossStage&&i===4));
    if(!free.length)return;
    const hi=pick(free);holes[hi].occ=true;
    const dur=clamp(1500-(stage-1)*170,700,1500);   // 7〜8歳向け: 出現寿命を少し短く
    const kind=pickKind();
    let color=pick(GUM),hp=1,life=dur,size=1;
    if(kind==="jelly"){color="#9be0d2";hp=2;size=1.25;}          // 大きく頑丈
    else if(kind==="gold"){color="#ffd23f";life=dur*0.6;size=0.7;} // 小さく速い
    else if(kind==="rainbow"){color=pick(GUM);life=dur*0.8;} // 色は毎フレーム虹色に切り替わる(update側)
    else if(kind==="cookie"){color="#e8b979";}
    else if(kind==="jumbo"){color=pick(GUM);size=1.6;}       // 見た目は同じ形のまま特大サイズ・1発で壊れる
    moles.push({hi,x:holes[hi].x,baseY:holes[hi].y,up:0,state:"rise",
      kind,color,hp,life,squash:1,blink:0,bob:rnd(0,TAU),flash:0,wob:rnd(0,TAU),size});
    // にじいろグミ 出現の「きらーん」予告音(ドキドキ)
    if(kind==="rainbow"){api.tone(1046,0.1,"triangle",0.08);api.tone(1568,0.12,"triangle",0.06);}
  }
  function smashFx(hx,hy,col,big,kind){
    rings.push({x:hx,y:hy,r:R*0.4,vr:R*0.5,life:1,decay:0.06,col});
    rings.push({x:hx,y:hy,r:R*0.18,vr:R*0.34,life:1,decay:0.05,col:"#ffffff"});
    const n=(big?16:10)+Math.min(combo,6);
    // ⑦ 壊れ方の差: kindごとに破片の形/動きを変える(輪郭は同じでも壊れ方が違うと分かる)
    for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(2.5,8);
      let vy=Math.sin(a)*s-2.5,sq=rnd(0.5,1),r=rnd(3,8),shape="circle";
      if(kind==="jelly"){vy*=0.5;}                 // ジェリー: 勢いを抑えてぷるぷる落ちる
      else if(kind==="cookie"){sq=rnd(0.2,0.4);}   // クッキー: 潰れた楕円=かけら感
      else if(kind==="donut"){shape="rect";r=rnd(4,9);} // ドーナツ: 細長い板状=輪の欠片
      bits.push({x:hx,y:hy,vx:Math.cos(a)*s,vy,r,
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.014,0.024),
        col:i%3===0?col:(i%3===1?"#fff":pick(GUM)),sq,shape});}
    for(let i=0;i<rint(5,8);i++){const a=rnd(0,TAU),s=rnd(4,10);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(7,16),life:1,decay:rnd(0.05,0.09)});}
  }
  function popPuff(hx,hy){
    for(let i=0;i<6;i++)puffs.push({x:hx+rnd(-R*0.4,R*0.4),y:hy+rnd(-R*0.3,R*0.3),
      r:rnd(R*0.2,R*0.45),vr:rnd(0.4,1),life:1,decay:rnd(0.02,0.035)});
  }
  // ① にじいろグミ 撃破: 虹の輪が6色ぶわっ＋大量得点。激レアの爽快ごほうび(まぶしすぎ防止に控えめ)
  function rainbowBurst(hx,hy){
    rbMsgT=1.4;celebrate=Math.max(celebrate,1.4);
    flash=Math.min(1,flash+0.4);flashCol="#ff8ad8";
    api.boom(0.6);api.shake(16);
    api.slide(660,1320,0.4,0.22,"triangle");api.tone(880,0.14,"triangle",0.12);api.tone(1320,0.16,"triangle",0.1);
    if(hsCool<=0){api.hitStop(4);hsCool=45;}
    for(let k=0;k<GUM.length;k++)rings.push({x:hx,y:hy,r:R*0.4,vr:R*(0.5+k*0.1),life:1,decay:0.05,col:GUM[k]});
    const nb=Math.max(0,Math.min(26,150-bits.length));
    for(let i=0;i<nb;i++){const a=rnd(0,TAU),s=rnd(3,10);
      bits.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:GUM[i%GUM.length],sq:rnd(0.5,1)});}
    floats.push({x:hx,y:hy-R,txt:"にじいろグミ！",life:1.4,vy:-0.6,col:"#ff5b9e",size:34});
  }
  // ② ラッキー色 命中: 頭上に小さな星のキラッ＋ちいさな祝福(気づけるヒント)
  function luckyStar(hx,hy){
    api.tone(1046,0.14,"triangle",0.11);api.tone(1568,0.16,"triangle",0.08);
    floats.push({x:hx,y:hy,txt:"ラッキー！",life:1,vy:-0.9,col:luckyColor,size:24});
    for(let i=0;i<8;i++){const a=rnd(-TAU*0.5,0),s=rnd(2,5);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,len:rnd(5,10),life:1,decay:rnd(0.05,0.08)});}
  }
  function checkStage(){
    if(bossStage)return; // boss stage only ends when the king falls
    if(stageKill<stageGoal||clearT>0)return;
    clearStage=stage;clearT=1.6;celebrate=1.4;flash=0.8;flashCol="#fff";
    api.boom(0.5);api.shake(12);
    api.slide(523,784,0.3,0.2,"triangle");api.tone(660,0.25,"triangle",0.14);
    api.tone(988,0.3,"triangle",0.1);
    for(let i=0;i<22;i++){const a=rnd(0,TAU),s=rnd(3,9);
      bits.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,9),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.012,0.02),col:pick(GUM),sq:rnd(0.5,1)});}
    // ③ パーフェクト ボーナス: このステージで グミを 1こも にがさなかったら +3 & みどりの星シャワー
    if(stageEscaped===0){count+=3;api.setScore(count);perfectT=1.9;api.tone(1318,0.16,"triangle",0.12);
      for(let i=0;i<14;i++){const a=rnd(0,TAU),s=rnd(3,8);
        bits.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,r:rnd(4,8),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:"#7be08a",sq:rnd(0.5,1)});}}
    stageEscaped=0;
    stage++;stageGoal=stageGoalFor(stage);stageKill=0;buildBg();
    // next-stage teaser shown inside the clear banner
    bossStage=stage%3===0;
    if(bossStage){bossWarn=2.6;clearMsg="つぎは キンググミが でるぞ…！";}
    else if(stage===2)clearMsg="つぎは かたい ジェリーが とうじょう！";
    else if(stage===4)clearMsg="つぎは ジェリーが ふえるよ！";
    else clearMsg="つぎは もっと はやいよ！";
  }
  // ---- FEVER TIME ----
  function addFever(v){
    if(feverT>0)return;
    feverG=Math.min(1,feverG+v);
    if(feverG>=1)startFever();
  }
  function startFever(){
    feverT=FEVER_LEN;feverG=1;flash=1;flashCol="#ff8ad8";celebrate=Math.max(celebrate,1.4);
    api.boom(0.6);api.shake(14);api.slide(392,1046,0.4,0.3,"triangle");
    setTimeout(()=>api.tone(784,0.15,"triangle",0.15),100);
    setTimeout(()=>api.tone(988,0.15,"triangle",0.15),200);
    setTimeout(()=>api.tone(1318,0.25,"triangle",0.16),300);
    floats.push({x:api.W/2,y:api.H*0.3,txt:"フィーバータイム！",life:1.4,vy:-0.4,col:"#ff2b9e",size:44});
    if(bits.length<120)for(let i=0;i<18;i++){const a=rnd(0,TAU),s=rnd(3,9);
      bits.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(4,8),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:pick(GUM),sq:rnd(0.5,1)});}
  }
  // ---- KING GUMMY BOSS ----
  function spawnBoss(){
    const hp=clamp(10+3*(Math.floor(stage/3)-1),10,22);   // 7〜8歳向け: ボスHPを増量
    boss={hp,maxHp:hp,up:0,state:"rise",hurt:0,dieT:0,
      m:{kind:"boss",color:"#ff4d8d",state:"up",up:1,wob:rnd(0,TAU),bob:rnd(0,TAU),
         flash:0,blink:999,squash:1,hp:9,life:9999,baseY:0,x:0,hi:-1}};
    api.boom(0.55);api.shake(12);api.slide(120,60,0.5,0.4,"sine");
  }
  function hitBoss(){
    if(!boss||boss.state==="die")return;
    boss.hp--;boss.hurt=1;boss.m.flash=1;boss.m.wob=0;
    combo++;comboT=0.9;count++;api.setScore(count);
    flashCol="#ff4d8d";flash=Math.min(1,flash+0.25);
    api.slide(200,90,0.14,0.35,"sine");api.noise(0.12,0.18,900,"bandpass",1.2);api.boom(0.45);
    api.shake(8);
    const h=holes[4],hx=h?h.x:api.W/2,hy=(h?h.y:api.H/2)-R*2.2;
    smashFx(hx,hy,"#ff4d8d",true);
    if(combo>1)floats.push({x:hx,y:hy-R,txt:"x"+combo,life:1,vy:-1.1,
      col:combo>=8?"#ff2b9e":"#ffd23f",size:combo>=5?40:30});
    if(combo>0&&combo%5===0&&hsCool<=0){api.hitStop(combo>=10?4:3);hsCool=45;}
    addFever(0.05);
    if(boss.hp<=0)bossDie();
  }
  function bossDie(){
    boss.state="die";boss.dieT=1.1;celebrate=1.8;flash=1;flashCol="#ffd23f";
    count+=10;api.setScore(count);
    api.boom(0.85);api.shake(24);api.slide(523,1046,0.5,0.3,"triangle");
    setTimeout(()=>api.tone(784,0.2,"triangle",0.2),140);
    setTimeout(()=>api.tone(1046,0.3,"triangle",0.2),300);
    if(hsCool<=0){api.hitStop(5);hsCool=45;}
    const h=holes[4],hx=h?h.x:api.W/2,hy=(h?h.y:api.H/2)-R*2;
    floats.push({x:hx,y:hy-R,txt:"キングを たおした！ ＋10",life:1.4,vy:-0.6,col:"#ffd23f",size:36});
    const nb=Math.max(0,Math.min(30,160-bits.length));
    for(let i=0;i<nb;i++){const a=rnd(0,TAU),s=rnd(3,10);
      bits.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(4,10),
        rot:rnd(0,TAU),vr:rnd(-0.35,0.35),life:1,decay:rnd(0.01,0.02),col:pick(GUM),sq:rnd(0.5,1)});}
  }
  function smash(m){
    // hard jelly: first tap only wobbles it (fever time: everything pops in 1 tap)
    if(m.kind==="jelly"&&m.hp>1&&feverT<=0){m.hp--;m.flash=1;m.squash=0.8;m.wob=0;
      api.slide(360,240,0.1,0.2,"sine");api.noise(0.06,0.1,1200);api.shake(4);
      smashFx(m.x,m.baseY-R*0.5,"#cfeee6",false);return;}
    m.state="smashed";m.squash=1;holes[m.hi].occ=false;
    let gain=m.kind==="gold"?3:(m.kind==="rainbow"?6:1);
    // ② きょうのラッキー色: 秘密の色(ふつうのグミ)を つぶすと +1 の隠しボーナス。気づくと得する。
    const isLucky=(m.kind==="gum")&&m.color===luckyColor;
    if(isLucky){gain+=1;if(!luckySeen){luckySeen=true;}}
    if(feverT>0)gain*=2; // fever: double points
    count+=gain;if(!bossStage)stageKill++;api.setScore(count);combo++;comboT=0.9;
    flashCol=m.color;flash=Math.min(1,flash+0.32);
    api.slide(420,180,0.12,0.3,"sine");api.noise(0.1,0.16,1600,"bandpass",1.4);
    api.tone(520*Math.pow(2,clamp(combo,0,10)/12),0.12,"triangle",0.12);api.boom(0.4);
    api.shake(6+Math.min(combo,8));
    if(m.kind==="gold"){api.tone(1046,0.18,"triangle",0.14);api.tone(1318,0.2,"triangle",0.1);}
    popPuff(m.x,m.baseY-R*0.5);
    smashFx(m.x,m.baseY-R*0.5,m.color,combo>=5||m.kind==="jumbo",m.kind);
    if(combo>1)floats.push({x:m.x,y:m.baseY-R*1.2,txt:"x"+combo,life:1,vy:-1.1,
      col:combo>=8?"#ff2b9e":combo>=5?"#ff5b9e":"#ffd23f",size:combo>=5?40:30});
    if(combo>=3)celebrate=Math.max(celebrate,0.6+combo*0.04);
    // hitStop is a "big single hit" only: combo milestones, with cooldown (avoid freeze loops)
    if(combo>0&&combo%5===0&&hsCool<=0){api.hitStop(combo>=10?4:3);hsCool=45;}
    // ① にじいろグミ / ② ラッキー色 の特別演出
    if(m.kind==="rainbow")rainbowBurst(m.x,m.baseY-R*0.5);
    if(isLucky)luckyStar(m.x,m.baseY-R*1.2);
    addFever(m.kind==="rainbow"?0.2:0.075);
    checkStage();
  }
  return {
    resize:layout,
    input(x,y,type){
      if(type!=="down"||clearT>0)return;
      // king gummy is a huge, generous target: check it first
      if(boss&&boss.state!=="die"){
        const h=holes[4];
        if(h){const by=h.y-R*2.0;
          if(Math.hypot(x-h.x,y-by)<R*3.4){hitBoss();return;}}
      }
      // forgiving aim for little hands: hit the nearest gummy within a big assist radius
      let best=null,bd=1e9;
      for(let i=moles.length-1;i>=0;i--){const m=moles[i];
        if(m.state==="smashed")continue;
        const my=m.baseY-m.up*R*1.6;
        const d=Math.hypot(x-m.x,y-my);
        if(d<bd){bd=d;best=m;}}
      if(best&&bd<Math.max(R*3.2,150)){smash(best);return;}
      // ④ ひみつ発見: そらに ういている おかしを タップすると きらめき＋コイン(＋1)。げんてん なし。
      // 1こにつき1回だけ(画面外へ流れて再登場したら また光る) = 連打の的にならない
      for(const s of sweets){
        const sy=s.y+Math.sin(s.ph)*s.amp;
        if(!s.tapped&&Math.hypot(x-s.x,y-sy)<Math.max(R*0.9,34)){
          s.tapped=true;count+=1;api.setScore(count);
          api.tone(1318,0.1,"triangle",0.09);api.tone(1760,0.12,"triangle",0.07);
          floats.push({x:s.x,y:sy-10,txt:"＋1",life:1,vy:-0.8,col:"#ffd23f",size:22});
          smashFx(s.x,sy,s.col,false); // ④ そらのおかしも壊れた感(リング/破片/スパーク)を出す。得点はgum並みの+1のまま
          return;
        }
      }
      // miss: tiny candy puff feedback
      api.tone(260,0.05,"sine",0.08);
      for(let i=0;i<5;i++){const a=rnd(0,TAU),s=rnd(2,5);
        sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(5,11),life:1,decay:rnd(0.06,0.1)});}
    },
    frame(dt,now){
      tGlobal+=dt;
      // ---- sweet-world sky gradient (per-stage candy palette) ----
      const bg=curBg();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージのキャンディ色を薄く重ねて面ごとの雰囲気を変える(1面=いちご味はそのまま)
        const pi=(stage-1)%STAGE_BG.length;
        if(pi!==0){g.save();g.globalAlpha=0.28;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,bg.a);tg.addColorStop(0.4,bg.b);tg.addColorStop(0.75,bg.c);tg.addColorStop(1,bg.d);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();}
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,bg.a);grd.addColorStop(0.4,bg.b);grd.addColorStop(0.75,bg.c);grd.addColorStop(1,bg.d);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // soft sweet glow upper area
      let glow=g.createRadialGradient(api.W*0.5,api.H*0.1,0,api.W*0.5,api.H*0.1,api.W*0.7);
      glow.addColorStop(0,"rgba(255,255,255,.30)");glow.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=glow;g.fillRect(0,0,api.W,api.H);
      // FEVER: the whole world turns rainbow (additive sweep, cheap)
      if(feverT>0){
        g.save();g.globalCompositeOperation="lighter";
        const fg=g.createLinearGradient(0,0,api.W,api.H*0.4);
        const FC=["#ff5b9e","#ffd23f","#7be08a","#5bc8ff","#c78bff","#ff5b9e"];
        for(let i=0;i<FC.length;i++)
          fg.addColorStop(((i/(FC.length-1))+tGlobal*0.01)%1,FC[i]);
        g.globalAlpha=0.15+0.06*Math.sin(tGlobal*0.35);
        g.fillStyle=fg;g.fillRect(0,0,api.W,api.H);
        g.restore();g.globalCompositeOperation="source-over";
      }
      // floating sweet props (drift + bob, soft shadow)
      for(const s of sweets){
        s.ph+=s.sp*dt;s.x+=s.drift*dt;if(s.x>api.W+30){s.x=-30;s.tapped=false;} // 流れて戻ったら また光る
        const sy=s.y+Math.sin(s.ph)*s.amp,r=R*0.34*s.s;
        g.save();g.translate(s.x,sy);g.globalAlpha=0.85;
        g.fillStyle=s.col;
        if(s.kind===0){ // candy circle with shine
          g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
          g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.ellipse(-r*0.3,-r*0.3,r*0.3,r*0.18,-0.5,0,TAU);g.fill();
        }else if(s.kind===1){ // soft square jelly
          g.beginPath();rr(-r,-r,r*2,r*2,r*0.5);g.fill();
          g.fillStyle="rgba(255,255,255,.4)";g.fillRect(-r*0.7,-r*0.7,r*1.4,r*0.4);
        }else{ // heart-ish blob
          g.beginPath();g.arc(-r*0.4,-r*0.2,r*0.55,0,TAU);g.arc(r*0.4,-r*0.2,r*0.55,0,TAU);
          g.moveTo(-r*0.9,0);g.lineTo(0,r*0.9);g.lineTo(r*0.9,0);g.closePath();g.fill();
        }
        g.restore();
      }
      g.globalAlpha=1;
      // twinkling sugar motes
      g.fillStyle="#ffffff";
      for(const mt of motes){
        mt.x+=mt.sp*0.4*dt;mt.y-=mt.sp*0.18*dt;mt.tw+=0.05*dt;
        if(mt.x>api.W)mt.x=0;if(mt.y<0)mt.y=api.H;
        g.globalAlpha=0.12+0.12*(0.5+0.5*Math.sin(mt.tw));
        g.beginPath();g.arc(mt.x,mt.y,mt.r,0,TAU);g.fill();
      }
      g.globalAlpha=1;
      // ---- chocolate hole/bowls the gummies pop from ----
      for(const h of holes){
        g.fillStyle="rgba(90,50,30,.30)";g.beginPath();
        g.ellipse(h.x,h.y+R*0.74,R*1.08,R*0.5,0,0,TAU);g.fill();
        // chocolate bowl rim
        g.fillStyle="#6b3d22";g.beginPath();g.ellipse(h.x,h.y+R*0.72,R*0.98,R*0.44,0,0,TAU);g.fill();
        g.fillStyle="#3c2113";g.beginPath();g.ellipse(h.x,h.y+R*0.7,R*0.8,R*0.34,0,0,TAU);g.fill();
        g.strokeStyle="rgba(255,210,160,.3)";g.lineWidth=2;
        g.beginPath();g.ellipse(h.x,h.y+R*0.66,R*0.85,R*0.36,0,Math.PI*1.05,Math.PI*1.95);g.stroke();
      }
      // ---- spawning (paused on clear) ----
      if(hsCool>0)hsCool--;
      const paused=clearT>0;
      if(!paused){
        spawnT-=dt;
        // never leave the field empty: refill fast if no live gummy is out
        if(!moles.some(m=>m.state!=="smashed")&&spawnT>8&&!boss)spawnT=8;
        if(spawnT<=0){spawn();
          if(feverT>0&&Math.random()<0.5)spawn(); // fever: gummies flood out
          spawnT=clamp(58-(stage-1)*7,28,58);   // 7〜8歳向け: 出現テンポを少し速く
          if(bossStage&&boss)spawnT*=1.5;         // boss fight: fewer distractions
          if(feverT>0)spawnT=Math.min(spawnT,15);
        }
      }
      // ---- FEVER timer ----
      if(feverT>0){feverT-=0.016*dt;
        if(feverT<=0){feverT=0;feverG=0;api.tone(330,0.2,"sine",0.12);
          floats.push({x:api.W/2,y:api.H*0.3,txt:"フィーバー おしまい",life:1,vy:-0.5,col:"#fff",size:24});}}
      // ---- BOSS: warn rumble -> rise -> fight -> die ----
      if(bossWarn>0){
        bossWarn-=0.016*dt;
        if(Math.random()<0.15)api.shake(2.5);
        const wp=clamp(1-bossWarn/2.6,0,1);
        g.fillStyle="rgba(70,15,60,"+(0.22*wp).toFixed(3)+")";g.fillRect(0,0,api.W,api.H);
        const wh=holes[4];
        if(wh){g.fillStyle="rgba(40,10,35,"+(0.5*wp).toFixed(3)+")";
          g.beginPath();g.ellipse(wh.x,wh.y+R*0.7,R*(1+wp*1.6),R*(0.45+wp*0.6),0,0,TAU);g.fill();}
        if(clearT<=0){
          const pw=1+0.08*Math.sin(tGlobal*0.5);
          g.save();g.translate(api.W/2,api.H*0.2);g.scale(pw,pw);
          g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
          g.lineWidth=6;g.strokeStyle="rgba(40,5,35,.75)";g.strokeText("キンググミが くるぞ…！",0,0);
          g.fillStyle="#ffd23f";g.fillText("キンググミが くるぞ…！",0,0);
          g.restore();g.textAlign="left";
        }
        if(bossWarn<=0){bossWarn=0;spawnBoss();}
      }
      if(boss){
        if(boss.state==="rise"){boss.up=Math.min(1,boss.up+0.02*dt);if(boss.up>=1)boss.state="fight";}
        boss.m.bob+=0.05*dt;boss.m.wob+=0.12*dt;
        if(boss.m.flash>0)boss.m.flash=Math.max(0,boss.m.flash-0.08*dt);
        if(boss.hurt>0)boss.hurt=Math.max(0,boss.hurt-0.04*dt);
        boss.m.blink=boss.hurt>0.45?0:999; // squeezes eyes shut when whacked
        if(boss.state==="die"){boss.dieT-=0.016*dt;
          if(boss.dieT<=0){const dh=holes[4];popPuff(dh?dh.x:api.W/2,(dh?dh.y:api.H/2)-R);
            boss=null;bossStage=false;stageKill=stageGoal;checkStage();}}
        if(boss)drawBoss();
      }
      // ---- update + draw moles ----
      for(const m of moles){
        if(m.flash>0)m.flash-=0.08*dt;
        if(m.kind==="rainbow")m.color=GUM[Math.floor(tGlobal*0.12+m.bob*3)%GUM.length]; // 虹色に色替わり
        if(m.state==="rise"){m.up=Math.min(1,m.up+0.13*dt);if(m.up>=1)m.state="up";}
        // ③ パーフェクト判定: たたけずに にげた(ひっこんだ)グミを このステージ分だけ数える
        else if(m.state==="up"){m.life-=dt*16;m.blink=m.life<320?m.life:999;
          if(m.life<=0){m.state="duck";if(!bossStage)stageEscaped++;}}
        else if(m.state==="duck"){m.up-=0.12*dt;if(m.up<=0){holes[m.hi].occ=false;m._dead=true;}}
        else if(m.state==="smashed"){m.squash-=0.09*dt;if(m.squash<=0)m._dead=true;}
        m.bob+=0.08*dt;m.wob+=0.18*dt;
        const e=m.state==="rise"?api.ease(m.up):1;
        const bob=m.state==="up"?Math.sin(m.bob)*R*0.05:0;
        const my=m.baseY-((m.state==="rise"?e:m.up)*R*1.6)-bob;
        g.save();
        g.beginPath();g.rect(m.x-R*1.5,0,R*3,m.baseY+R*0.66);g.clip();
        drawGummy(m,m.x,my,m.state==="smashed"?m.squash:1);
        g.restore();
      }
      moles=moles.filter(m=>!m._dead);
      // ---- shockwave rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.7;g.strokeStyle=ri.col;
        g.lineWidth=3+ri.life*3;g.beginPath();g.ellipse(ri.x,ri.y,ri.r,ri.r*0.6,0,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);
      // ---- jelly puffs (soft pop clouds) ----
      for(const p of puffs){p.r+=p.vr*dt;p.life-=p.decay*dt;
        g.globalAlpha=Math.max(0,p.life)*0.5;g.fillStyle="#fff";
        g.beginPath();g.arc(p.x,p.y,p.r,0,TAU);g.fill();}
      g.globalAlpha=1;puffs=puffs.filter(p=>p.life>0);
      // ---- glint sparks (additive) ----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#fff7c2";g.lineWidth=2.4;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalCompositeOperation="source-over";g.globalAlpha=1;
      sparks=sparks.filter(sp=>sp.life>0);
      // ---- gummy bits (squishy bouncing debris) ----
      for(const b of bits){b.vy+=0.32*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.rot+=b.vr*dt;b.life-=b.decay*dt;
        g.save();g.globalAlpha=Math.max(0,b.life);g.translate(b.x,b.y);g.rotate(b.rot);
        g.shadowColor=b.col;g.shadowBlur=8;g.fillStyle=b.col;
        if(b.shape==="rect"){ // ドーナツの欠片: 細長い板状(輪の一部が割れた見た目)
          const rw=Math.max(0,b.r*2.4),rh=Math.max(0,b.r*b.sq*0.9);
          g.fillRect(-rw/2,-rh/2,rw,rh);
        } else {
          g.beginPath();g.ellipse(0,0,Math.max(0,b.r),Math.max(0,b.r*b.sq),0,0,TAU);g.fill();
        }
        g.restore();}
      g.globalAlpha=1;g.shadowBlur=0;bits=bits.filter(b=>b.life>0&&b.y<api.H+40);
      // ---- combo timer ----
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      if(celebrate>0)celebrate=Math.max(0,celebrate-0.02*dt);
      // ---- floating combo numbers ----
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.02*dt;
        g.save();g.globalAlpha=Math.max(0,f.life);
        g.font="900 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(120,40,90,.5)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);g.restore();}
      g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // ---- impact flash (color bloom) ----
      if(flash>0){flash-=0.06*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa*0.26;
        g.fillStyle=flashCol;g.fillRect(0,0,api.W,api.H);
        g.globalAlpha=fa*0.14;g.fillStyle="#fff";g.fillRect(0,0,api.W,api.H);g.restore();g.globalCompositeOperation="source-over";}
      // ---- combo banner (top-center, safe zone) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.14);g.scale(pop,pop);
        g.font="800 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(255,90,160,.8)";g.shadowBlur=14;
        g.fillStyle="#ffd23f";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.6)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // ② きょうのラッキー色 教示バナー(起動時に一度だけ・上部中央=安全帯)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        const nm=GUMNAME[GUM.indexOf(luckyColor)]||"",pop=1+Math.max(0,luckyMsgT-2.0)*1.2;
        g.save();g.translate(api.W/2,api.H*0.22);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT,0,1);g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";
        const t="きょうの ラッキーいろは "+nm+"！";
        g.lineWidth=5;g.strokeStyle="rgba(120,40,90,.5)";g.strokeText(t,0,0);
        g.fillStyle=luckyColor;g.fillText(t,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ① にじいろグミ！ 発見バナー(虹色に色替わり=レアの大きな祝福・上部中央)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const col=GUM[Math.floor(tGlobal*0.12)%GUM.length],pop=1+Math.max(0,rbMsgT-1)*1.3;
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=6;g.strokeStyle="rgba(40,5,35,.6)";g.strokeText("にじいろグミ！",0,0);
        g.fillStyle=col;g.fillText("にじいろグミ！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ③ パーフェクト！ ボーナス バナー(クリア文字と重ねない下側)
      if(perfectT>0){perfectT-=0.014*dt;
        const pop=1+Math.max(0,perfectT-1.3)*1.4;
        g.save();g.translate(api.W/2,api.H*0.62);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(perfectT*1.3,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(123,224,138,.9)";g.shadowBlur=14;
        g.fillStyle="#c7ffcf";g.fillText("パーフェクト！＋3",0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(40,120,60,.7)";g.strokeText("パーフェクト！＋3",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(perfectT<0)perfectT=0;}
      // ---- HUD (top-center): stage + remaining gauge / boss HP ----
      drawHUD();
      // ---- fever gauge (bottom-center) ----
      drawFever();
      // ---- STAGE CLEAR banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.4;g.fillStyle="#7a2b55";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(255,120,180,.9)";g.shadowBlur=20;g.fillStyle="#ffd23f";
        g.fillText("ステージ"+clearStage+" クリア！",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア！",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const bossTease=clearMsg.indexOf("キング")>=0;
        g.fillStyle=bossTease?"#ffe3a0":"#fff";
        if(bossTease)g.scale(1+0.05*Math.sin(tGlobal*0.5),1+0.05*Math.sin(tGlobal*0.5));
        g.fillText(clearMsg||("つぎは ステージ"+(clearStage+1)+"！"),0,40);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=18;}
      }
    },
    stop(){}
  };
  function drawHUD(){
    // boss stage: HP bar takes over the top HUD
    if(bossWarn>0||boss){
      const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.05;
      g.save();g.textAlign="center";
      g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
      g.fillStyle="#fff";g.shadowColor="rgba(120,40,90,.5)";g.shadowBlur=6;
      g.fillText(boss?"キンググミを たおせ！":"ステージ "+stage+"  ボスステージ！",api.W/2,by-8);
      g.shadowBlur=0;
      g.fillStyle="rgba(120,40,90,.3)";rr(bx,by,bw,bh,bh/2);g.fill();
      const fr=boss?clamp(boss.hp/boss.maxHp,0,1):1;
      if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
        gg.addColorStop(0,"#ff4d6b");gg.addColorStop(1,"#ff9e4d");
        g.fillStyle=gg;rr(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
      g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=2;rr(bx,by,bw,bh,bh/2);g.stroke();
      g.restore();g.textAlign="left";
      return;
    }
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=16,bx=(api.W-bw)/2,by=api.H*0.05;
    g.save();g.textAlign="center";
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(120,40,90,.5)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left+" こ",api.W/2,by-8);
    g.shadowBlur=0;
    g.fillStyle="rgba(120,40,90,.3)";rr(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#ff9ecb");gg.addColorStop(1,"#ffd23f");
      g.fillStyle=gg;rr(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=2;rr(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }
  function drawFever(){
    const w=Math.min(api.W*0.5,260),x=(api.W-w)/2,y=api.H-30,h=14;
    const on=feverT>0;
    const fr=on?clamp(feverT/FEVER_LEN,0,1):feverG;
    g.save();
    g.fillStyle="rgba(120,40,90,.35)";rr(x-4,y-3,w+8,h+6,(h+6)/2);g.fill();
    if(fr>0.01){
      const gg=g.createLinearGradient(x,0,x+w,0);
      if(on){gg.addColorStop(0,"#ff2b9e");gg.addColorStop(0.5,"#ffd23f");gg.addColorStop(1,"#5bc8ff");}
      else{gg.addColorStop(0,"#ff9ecb");gg.addColorStop(1,"#ff5b9e");}
      if(on){g.shadowBlur=12+6*Math.sin(tGlobal*0.5);g.shadowColor="#ff2b9e";}
      g.fillStyle=gg;rr(x,y,Math.max(h,w*fr),h,h/2);g.fill();g.shadowBlur=0;
    }
    g.strokeStyle="rgba(255,255,255,.55)";g.lineWidth=2;rr(x-4,y-3,w+8,h+6,(h+6)/2);g.stroke();
    g.font="800 14px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
    g.fillStyle=on?"#ffd23f":"#fff";
    g.shadowColor="rgba(120,40,90,.6)";g.shadowBlur=5;
    g.fillText(on?"フィーバーちゅう！！":"フィーバー",api.W/2,y-8);
    g.restore();g.textAlign="left";
  }
  function drawBoss(){
    const h=holes[4];if(!h)return;
    const bx=h.x,base=h.y;
    const e=ease(boss.up);
    const bob=boss.state==="fight"?Math.sin(boss.m.bob)*R*0.05:0;
    const by=lerp(base+R*3.4,base-R*1.45,e)-bob;
    const sq=boss.state==="die"?Math.max(0.05,boss.dieT/1.1):1;
    g.save();
    g.beginPath();g.rect(bx-R*3.4,0,R*6.8,base+R*0.66);g.clip();
    g.translate(bx,by);g.scale(2.3,2.3);g.translate(-bx,-by);
    drawGummy(boss.m,bx,by,sq);
    drawCrown(bx,by-R*1.28*sq);
    g.restore();
  }
  function drawCrown(x,cy){
    const w=R*0.62,hh=R*0.42;
    g.save();
    g.fillStyle="#ffd23f";g.strokeStyle="#c98a12";g.lineWidth=2;
    g.beginPath();
    g.moveTo(x-w,cy);g.lineTo(x-w,cy-hh);g.lineTo(x-w*0.5,cy-hh*0.45);
    g.lineTo(x,cy-hh*1.2);g.lineTo(x+w*0.5,cy-hh*0.45);g.lineTo(x+w,cy-hh);
    g.lineTo(x+w,cy);g.closePath();g.fill();g.stroke();
    g.fillStyle="#ff4d6b";
    g.beginPath();g.arc(x,cy-hh*1.2,R*0.09,0,TAU);g.fill();
    g.fillStyle="#5bc8ff";
    g.beginPath();g.arc(x-w,cy-hh,R*0.07,0,TAU);g.arc(x+w,cy-hh,R*0.07,0,TAU);g.fill();
    g.restore();
  }
  function drawGummy(m,x,y,sq){
    const gold=m.kind==="gold",rainbow=m.kind==="rainbow",bossKind=m.kind==="boss";
    const r=R*0.9*(m.size||1);
    // 専用シルエット: クマ型ブロブを使わない別の壊し物(輪っか/円盤/箱型)はここで分岐して抜ける
    if(m.kind==="jelly")return drawJelly(m,x,y,sq,r);
    if(m.kind==="donut")return drawDonut(m,x,y,sq,r);
    if(m.kind==="cookie")return drawCookie(m,x,y,sq,r);
    // squishy wobble: gummies jiggle as they bob
    const wob=m.state==="up"?Math.sin(m.wob)*0.06:0;
    g.save();g.translate(x,y);g.scale((1+wob),sq*(1-wob*0.6));
    // gold sparkle aura
    if(gold){g.save();g.globalCompositeOperation="lighter";
      const gp=0.5+0.5*Math.sin(tGlobal*0.4);
      const ag=g.createRadialGradient(0,-r*0.1,0,0,-r*0.1,r*1.8);
      ag.addColorStop(0,"rgba(255,240,150,"+(0.6*gp)+")");ag.addColorStop(1,"rgba(255,240,150,0)");
      g.fillStyle=ag;g.beginPath();g.arc(0,-r*0.1,Math.max(0,r*1.8),0,TAU);g.fill();g.restore();g.globalCompositeOperation="source-over";}
    // にじいろグミ: やわらかい虹オーラ(現在の色でふわっと・控えめ)
    if(rainbow){g.save();g.globalCompositeOperation="lighter";
      const gp=0.4+0.3*Math.sin(tGlobal*0.5);
      const ag=g.createRadialGradient(0,-r*0.1,0,0,-r*0.1,r*1.9);
      ag.addColorStop(0,m.color);ag.addColorStop(0.5,"rgba(255,255,255,0)");ag.addColorStop(1,"rgba(255,255,255,0)");
      g.globalAlpha=gp;g.fillStyle=ag;g.beginPath();g.arc(0,-r*0.1,Math.max(0,r*1.9),0,TAU);g.fill();g.restore();g.globalCompositeOperation="source-over";g.globalAlpha=1;}
    // shadow
    g.fillStyle="rgba(60,30,15,.22)";g.beginPath();g.ellipse(0,r*0.78,r*0.78,r*0.28,0,0,TAU);g.fill();
    // 画像: キンググミ(ボス)専用スプライト / きんいろキャンディ専用スプライト
    // → どちらも色が固定(色バリエーション不要)なので画像化に向く。他の色は従来どおり手描き。
    if(bossKind){
      if(api.drawAsset("boss.png",0,-r*0.05,r*2.3,r*2.3,{center:true})){
        if(m.flash>0){g.save();g.globalAlpha=m.flash*0.6;g.fillStyle="#fff";g.beginPath();g.arc(0,-r*0.05,r,0,TAU);g.fill();g.restore();}
        g.restore();return;
      }
    }
    // ※ gold.png は生成2回とも台座/ステム付きの不良のため未使用(手描きのまま)。issues 参照。
    // translucent gummy body (rounded blob, glossy gradient)
    const grd=g.createRadialGradient(-r*0.28,-r*0.5,r*0.1,0,0,r*1.3);
    grd.addColorStop(0,lighten(m.color,90));grd.addColorStop(0.5,lighten(m.color,25));grd.addColorStop(1,m.color);
    g.fillStyle=grd;g.beginPath();rr(-r*0.72,-r,r*1.44,r*1.85,r*0.62);g.fill();
    // hit-flash overlay
    if(m.flash>0){g.save();g.globalAlpha=m.flash*0.7;g.fillStyle="#fff";
      g.beginPath();rr(-r*0.72,-r,r*1.44,r*1.85,r*0.62);g.fill();g.restore();}
    // rim light
    g.strokeStyle="rgba(255,255,255,.3)";g.lineWidth=2;g.beginPath();rr(-r*0.72,-r,r*1.44,r*1.85,r*0.62);g.stroke();
    // glossy top sheen
    g.fillStyle="rgba(255,255,255,.35)";g.beginPath();
    g.ellipse(-r*0.2,-r*0.55,r*0.4,r*0.2,-0.3,0,TAU);g.fill();
    // little nub ears (gummy-bear cuteness)
    g.fillStyle=grd;
    g.beginPath();g.arc(-r*0.5,-r*0.95,r*0.22,0,TAU);g.arc(r*0.5,-r*0.95,r*0.22,0,TAU);g.fill();
    // eyes (blink when about to duck)
    const blinking=m.blink!==undefined&&m.blink!==999&&Math.floor(m.blink/40)%2===0;
    if(blinking){
      g.strokeStyle="#5a2238";g.lineWidth=r*0.08;g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.4,-r*0.18);g.lineTo(-r*0.14,-r*0.18);
      g.moveTo(r*0.14,-r*0.18);g.lineTo(r*0.4,-r*0.18);g.stroke();
    }else{
      g.fillStyle="#5a2238";g.beginPath();g.arc(-r*0.26,-r*0.16,r*0.13,0,TAU);g.arc(r*0.26,-r*0.16,r*0.13,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.95)";g.beginPath();
      g.arc(-r*0.3,-r*0.2,r*0.05,0,TAU);g.arc(r*0.22,-r*0.2,r*0.05,0,TAU);g.fill();
    }
    // smile
    g.strokeStyle="#5a2238";g.lineWidth=r*0.07;g.lineCap="round";
    g.beginPath();g.arc(0,-r*0.02,r*0.2,0.12*Math.PI,0.88*Math.PI);g.stroke();
    // rosy cheeks
    g.fillStyle="rgba(255,120,150,.4)";g.beginPath();
    g.arc(-r*0.42,0,r*0.13,0,TAU);g.arc(r*0.42,0,r*0.13,0,TAU);g.fill();
    g.restore();
  }
  // 硬いジェリー: クマ型ブロブを使わない角の立った箱型シルエット(耳を描かない=別の壊し物と分かる)
  function drawJelly(m,x,y,sq,r){
    const wob=m.state==="up"?Math.sin(m.wob)*0.05:0;
    g.save();g.translate(x,y);g.scale((1+wob),sq*(1-wob*0.6));
    g.fillStyle="rgba(60,30,15,.22)";g.beginPath();
    g.ellipse(0,Math.max(0,r*0.86),Math.max(0,r*0.82),Math.max(0,r*0.28),0,0,TAU);g.fill();
    const grd=g.createRadialGradient(-r*0.3,-r*0.6,Math.max(0,r*0.1),0,0,Math.max(0,r*1.4));
    grd.addColorStop(0,lighten(m.color,90));grd.addColorStop(0.5,lighten(m.color,25));grd.addColorStop(1,m.color);
    g.fillStyle=grd;g.beginPath();rr(-r*0.75,-r,r*1.5,r*1.7,r*0.18);g.fill();
    g.strokeStyle="rgba(255,255,255,.4)";g.lineWidth=2;
    g.beginPath();g.moveTo(-r*0.4,-r*0.7);g.lineTo(-r*0.4,r*0.5);
    g.moveTo(r*0.4,-r*0.7);g.lineTo(r*0.4,r*0.5);g.stroke();
    if(m.hp<2){g.strokeStyle="rgba(80,120,110,.6)";g.lineWidth=2.5;g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.1,-r*0.6);g.lineTo(r*0.06,-r*0.2);g.lineTo(-r*0.1,r*0.15);g.stroke();}
    if(m.flash>0){g.save();g.globalAlpha=m.flash*0.7;g.fillStyle="#fff";
      g.beginPath();rr(-r*0.75,-r,r*1.5,r*1.7,r*0.18);g.fill();g.restore();}
    g.strokeStyle="rgba(255,255,255,.3)";g.lineWidth=2;g.beginPath();rr(-r*0.75,-r,r*1.5,r*1.7,r*0.18);g.stroke();
    g.fillStyle="rgba(255,255,255,.35)";g.beginPath();
    g.ellipse(-r*0.2,-r*0.55,Math.max(0,r*0.35),Math.max(0,r*0.16),-0.3,0,TAU);g.fill();
    const blinking=m.blink!==undefined&&m.blink!==999&&Math.floor(m.blink/40)%2===0;
    if(blinking){
      g.strokeStyle="#274a44";g.lineWidth=r*0.08;g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.4,-r*0.18);g.lineTo(-r*0.14,-r*0.18);
      g.moveTo(r*0.14,-r*0.18);g.lineTo(r*0.4,-r*0.18);g.stroke();
    }else{
      g.fillStyle="#274a44";g.beginPath();g.arc(-r*0.26,-r*0.16,r*0.13,0,TAU);g.arc(r*0.26,-r*0.16,r*0.13,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.95)";g.beginPath();
      g.arc(-r*0.3,-r*0.2,r*0.05,0,TAU);g.arc(r*0.22,-r*0.2,r*0.05,0,TAU);g.fill();
    }
    g.strokeStyle="#274a44";g.lineWidth=r*0.07;g.lineCap="round";
    g.beginPath();g.arc(0,-r*0.02,r*0.2,0.12*Math.PI,0.88*Math.PI);g.stroke();
    g.restore();
  }
  // ドーナツ: 二重の円で穴を開けた輪っか状シルエット(evenoddで中心をくり抜く)
  function drawDonut(m,x,y,sq,r){
    const wob=m.state==="up"?Math.sin(m.wob)*0.06:0;
    const outerR=Math.max(0,r*0.92),innerR=Math.max(0,r*0.4);
    g.save();g.translate(x,y);g.scale((1+wob),sq*(1-wob*0.6));
    g.fillStyle="rgba(60,30,15,.22)";g.beginPath();
    g.ellipse(0,Math.max(0,r*0.72),Math.max(0,r*0.82),Math.max(0,r*0.28),0,0,TAU);g.fill();
    const grd=g.createRadialGradient(-r*0.25,-r*0.4,Math.max(0,r*0.1),0,0,Math.max(0,r*1.1));
    grd.addColorStop(0,lighten(m.color,90));grd.addColorStop(0.5,lighten(m.color,20));grd.addColorStop(1,m.color);
    g.fillStyle=grd;g.beginPath();
    g.arc(0,0,outerR,0,TAU);g.moveTo(innerR,0);g.arc(0,0,innerR,0,TAU,true);
    g.fill("evenodd");
    // icing drizzle
    g.strokeStyle="rgba(255,255,255,.55)";g.lineWidth=Math.max(0,r*0.14);g.lineCap="round";
    g.beginPath();
    for(let i=0;i<3;i++){const a0=-0.6+i*0.9,rr2=r*0.66;
      g.moveTo(Math.cos(a0)*rr2,Math.sin(a0)*rr2-r*0.05);
      g.quadraticCurveTo(Math.cos(a0+0.3)*rr2*0.8,Math.sin(a0+0.3)*rr2*0.8,
        Math.cos(a0+0.6)*rr2,Math.sin(a0+0.6)*rr2-r*0.05);}
    g.stroke();
    if(m.flash>0){g.save();g.globalAlpha=m.flash*0.7;g.fillStyle="#fff";
      g.beginPath();g.arc(0,0,outerR,0,TAU);g.moveTo(innerR,0);g.arc(0,0,innerR,0,TAU,true);g.fill("evenodd");g.restore();}
    g.strokeStyle="rgba(255,255,255,.3)";g.lineWidth=2;
    g.beginPath();g.arc(0,0,outerR,0,TAU);g.stroke();
    g.beginPath();g.arc(0,0,innerR,0,TAU);g.stroke();
    // face on the lower ring
    const fy=r*0.62,blinking=m.blink!==undefined&&m.blink!==999&&Math.floor(m.blink/40)%2===0;
    if(blinking){
      g.strokeStyle="#5a2238";g.lineWidth=r*0.07;g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.35,fy-0.02);g.lineTo(-r*0.15,fy-0.02);
      g.moveTo(r*0.15,fy-0.02);g.lineTo(r*0.35,fy-0.02);g.stroke();
    }else{
      g.fillStyle="#5a2238";g.beginPath();g.arc(-r*0.24,fy,r*0.1,0,TAU);g.arc(r*0.24,fy,r*0.1,0,TAU);g.fill();
    }
    g.strokeStyle="#5a2238";g.lineWidth=r*0.06;g.lineCap="round";
    g.beginPath();g.arc(0,fy+r*0.16,r*0.14,0.15*Math.PI,0.85*Math.PI);g.stroke();
    g.restore();
  }
  // クッキー: 平たい円盤+チョコチップ+ひび割れ模様のシルエット
  function drawCookie(m,x,y,sq,r){
    const wob=m.state==="up"?Math.sin(m.wob)*0.06:0;
    g.save();g.translate(x,y);g.scale((1+wob),sq*(1-wob*0.6));
    g.fillStyle="rgba(60,30,15,.22)";g.beginPath();
    g.ellipse(0,Math.max(0,r*0.65),Math.max(0,r*0.85),Math.max(0,r*0.26),0,0,TAU);g.fill();
    const grd=g.createRadialGradient(-r*0.2,-r*0.3,0,0,0,Math.max(0,r*1.05));
    grd.addColorStop(0,lighten(m.color,60));grd.addColorStop(0.55,lighten(m.color,10));grd.addColorStop(1,m.color);
    g.fillStyle=grd;g.beginPath();g.ellipse(0,0,Math.max(0,r*0.95),Math.max(0,r*0.72),0,0,TAU);g.fill();
    g.fillStyle="rgba(110,60,30,.55)";
    const chips=[[-0.4,-0.3],[0.3,-0.15],[-0.1,0.25],[0.35,0.3],[-0.35,0.15]];
    for(const c of chips){g.beginPath();g.arc(c[0]*r,c[1]*r*0.75,Math.max(0,r*0.09),0,TAU);g.fill();}
    g.strokeStyle="rgba(140,90,40,.5)";g.lineWidth=2;g.lineCap="round";
    g.beginPath();g.moveTo(-r*0.3,-r*0.2);g.lineTo(-r*0.05,r*0.05);g.lineTo(r*0.25,-r*0.05);g.stroke();
    if(m.flash>0){g.save();g.globalAlpha=m.flash*0.7;g.fillStyle="#fff";
      g.beginPath();g.ellipse(0,0,Math.max(0,r*0.95),Math.max(0,r*0.72),0,0,TAU);g.fill();g.restore();}
    g.strokeStyle="rgba(255,255,255,.3)";g.lineWidth=2;
    g.beginPath();g.ellipse(0,0,Math.max(0,r*0.95),Math.max(0,r*0.72),0,0,TAU);g.stroke();
    const blinking=m.blink!==undefined&&m.blink!==999&&Math.floor(m.blink/40)%2===0;
    if(blinking){
      g.strokeStyle="#6b3d22";g.lineWidth=r*0.07;g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.35,-r*0.12);g.lineTo(-r*0.15,-r*0.12);
      g.moveTo(r*0.15,-r*0.12);g.lineTo(r*0.35,-r*0.12);g.stroke();
    }else{
      g.fillStyle="#6b3d22";g.beginPath();g.arc(-r*0.24,-r*0.1,r*0.1,0,TAU);g.arc(r*0.24,-r*0.1,r*0.1,0,TAU);g.fill();
    }
    g.strokeStyle="#6b3d22";g.lineWidth=r*0.06;g.lineCap="round";
    g.beginPath();g.arc(0,r*0.12,r*0.16,0.1*Math.PI,0.9*Math.PI);g.stroke();
    g.restore();
  }
  function rr(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function lighten(hex,amt){const a=amt===undefined?50:amt;const c=parseInt(hex.slice(1),16);
    const r=Math.min(255,((c>>16)&255)+a),gg=Math.min(255,((c>>8)&255)+a),b=Math.min(255,(c&255)+a);
    return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("gummy", build_gummy);
