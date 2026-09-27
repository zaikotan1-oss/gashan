function build_blizzard(api){
  const g=api.g;
  // 画像アセット(無ければ従来の手描きにフォールバック)。ice/vortex は生成不良(床の残り・複数物)のため手描きのまま
  api.preload(["bg.jpg","gold.png"]);
  let snows=[],vortices=[],shards=[],sparks=[],rings=[],flakes=[],glints=[],floats=[];
  let R,tsec=0,count=0,combo=0,comboT=0,flash=0,spawnT=0;
  let fcount=0,lastHS=-999; // frame counter + last hitStop frame (throttle: milestone only)
  // stage progression: clear a quota of blocks -> "ステージ クリア!" -> harder, endless
  let stage=1,stageKill=0,stageGoal=15,clearT=0,clearStage=0,clearSub="";
  // FEVER TIME: gauge fills per break -> 10s rainbow fever (all 1-hit / 2x points / fast spawns)
  const FEVER_LEN=10;
  const RAIN=["#ff5b5b","#ffd23f","#7be08a","#4db8ff","#b58bff","#ff7bd0"];
  let fever=0,feverGauge=0,feverBanner=0;
  // ---- 隠し発見レイヤー(ハンマー/トラックと同じ思想) ----
  // ② きょうのラッキー色: ゆきだるまの あたまの「ぼんぼり」色。毎プレイ1色を秘密に選ぶ。
  const POM=["#ff6b6b","#ffd23f","#7be08a","#4db8ff","#b58bff","#ff7bd0"];
  const POMNAME={"#ff6b6b":"あか","#ffd23f":"きいろ","#7be08a":"みどり","#4db8ff":"あお","#b58bff":"むらさき","#ff7bd0":"ピンク"};
  let luckyColor=pick(POM),luckySeen=false,luckyMsgT=0;
  let rbMsgT=0;            // ① にじいろブロック 発見バナー
  let stageNonstop=true;  // ③ ノンストップ判定(コンボを切らさずステージ突破)
  let shootStar=null,shootT=rnd(300,560); // ④ ながれ星 ひみつキャッチ
  function stageGoalFor(s){return 15+(s-1)*5;}   // 15,20,25,...（7〜8歳向けに手応えを増やした）
  // per-stage sky palette (always wintery, shifts cool tones)
  const SKY=[
    {a:"#bfe4f5",b:"#8fc4e8",c:"#5e9ad0",d:"#cfeefe"},
    {a:"#cfd8f0",b:"#9fb0e0",c:"#6f80c0",d:"#e6ecff"},
    {a:"#bfeef0",b:"#8fd8d8",c:"#5fb0b8",d:"#d8fbfb"},
    {a:"#d8c8f0",b:"#b0a0e0",c:"#8070c0",d:"#efe6ff"},
    {a:"#ffe0ea","b":"#d8a8d0",c:"#a878c0",d:"#ffe8f6"}
  ];
  function sky(){return SKY[(stage-1)%SKY.length];}
  const SNOWCOL=["#eaf6ff","#dff0ff","#cfe8ff","#e8f2ff","#f4faff"];
  // ambient background props (built on layout)
  let drift=[],hills=[],sparkleBg=[];
  function buildBg(){
    drift=[];for(let i=0;i<70;i++)drift.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(1,3.6),
      sp:rnd(0.3,1.1),sw:rnd(0,TAU),sa:rnd(0.4,1),al:rnd(0.25,0.7)});
    hills=[
      {y:api.H*0.66,amp:api.H*0.05,wl:api.W*0.9,col:"#dff0fb",sp:0.003,ph:0},
      {y:api.H*0.76,amp:api.H*0.06,wl:api.W*0.7,col:"#eef8ff",sp:0.006,ph:1.5}
    ];
    sparkleBg=[];for(let i=0;i<24;i++)sparkleBg.push({x:rnd(0,api.W),y:rnd(0,api.H*0.7),
      ph:rnd(0,TAU),sp:rnd(0.04,0.12),r:rnd(0.8,2.2)});
  }
  function layout(){
    R=clamp(Math.min(api.W,api.H)*0.05,22,40);
    buildBg();
  }
  layout();
  // 形のバラエティ(軸7): 丸/立方体だけでなく つらら・大きな雪ブロック・2段だるまも混ぜる
  const SHAPE_POOL=["round","round","round","icicle","block","snowman"]; // ふつうの雪玉は丸多め
  const SHAPE_POOL_RARE=["icicle","block","snowman","round"]; // キン/にじは丸に偏らせない
  function pickShape(rare){return rare?pick(SHAPE_POOL_RARE):pick(SHAPE_POOL);}
  // spawn a snow block somewhere on the field (avoid the engine HUD corners)
  function spawnSnow(){
    if(snows.length>=46)return;
    let x=rnd(api.W*0.1,api.W*0.9), y=rnd(api.H*0.22,api.H*0.86);
    // keep clear of top corners (engine chrome zone): y<70 near edges
    if(y<90){ x=clamp(x,140,api.W-140); }
    // ① にじいろブロック: 数%の激レア。虹色に脈打ち 一撃で大量得点＋ゲージが一気にたまる。
    const rainbow=stage>=2&&Math.random()<0.035;
    // gold = rare jackpot (glows / big points / fills fever gauge fast)
    const gold=!rainbow&&Math.random()<(fever>0?0.12:0.07);
    const type=rainbow?"rainbow":gold?"gold":(stage>=3&&Math.random()<0.22?"ice":"snow"); // ice = tougher, worth more
    const shape=type==="ice"?"cube":pickShape(type==="gold"||type==="rainbow");
    // 大きさのバラエティ(軸7): 大玉・小玉を混ぜて同じ大きさばかりにしない
    const szr=Math.random();
    const r=szr<0.2?rnd(R*1.3,R*1.7):szr<0.4?rnd(R*0.45,R*0.65):rnd(R*0.7,R*1.05);
    // ぼんぼり(ラッキー色の手がかり)は 顔のある丸/だるまのときだけ意味を持つ
    const hasPom=type==="snow"&&(shape==="round"||shape==="snowman");
    snows.push({x,y,vx:0,vy:0,r,type,shape,
      rot:rnd(0,TAU),vr:rnd(-0.04,0.04),wob:rnd(0,TAU),flung:false,
      face:Math.random()<0.5,col:pick(SNOWCOL),pom:hasPom?pick(POM):null});
    if(type==="gold"){ // announce the rare one: chime + gold ring + glints
      rings.push({x,y,r:R*0.4,vr:R*0.55,life:1,decay:0.04,col:"#ffd23f"});
      api.slide(880,1760,0.18,0.09,"triangle");
      for(let k=0;k<4;k++){const a=rnd(0,TAU);
        glints.push({x,y,vx:Math.cos(a)*3,vy:Math.sin(a)*3,life:1,r:3});}
    }
    if(type==="rainbow"){ // 激レア出現の予告: にじ色の輪＋のぼり音＋きらめき(さがしてね=ドキドキ)
      for(let k=0;k<RAIN.length;k++)rings.push({x,y,r:R*0.4,vr:R*(0.5+k*0.12),life:1,decay:0.05,col:RAIN[k]});
      api.slide(660,1320,0.3,0.1,"triangle");api.tone(1320,0.12,"triangle",0.09);
      for(let k=0;k<8;k++){const a=rnd(0,TAU);
        glints.push({x,y,vx:Math.cos(a)*rnd(3,6),vy:Math.sin(a)*rnd(3,6),life:1,r:rnd(2,4)});}
    }
  }
  // pre-seed a field
  for(let i=0;i<14;i++)spawnSnow();
  function shatter(b){
    const gold=b.type==="gold";
    const hx=b.x,hy=b.y,col=gold?"#ffd23f":b.type==="ice"?"#bfe8ff":"#ffffff";
    const shape=b.shape||(b.type==="ice"?"cube":"round");
    rings.push({x:hx,y:hy,r:b.r*0.5,vr:b.r*0.6,life:1,decay:0.05,col});
    rings.push({x:hx,y:hy,r:b.r*0.2,vr:b.r*0.45,life:1,decay:0.045,col:"#ffffff"});
    function burst(n){
      for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(3,9);
        shards.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,s:rnd(b.r*0.2,b.r*0.4),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.022),
          col:gold?pick(RAIN):i%3===0?col:(i%3===1?"#dff0ff":"#ffffff")});}
      if(shards.length>240)shards.splice(0,shards.length-240);
    }
    // 壊れ方のバラエティ(軸7): 形によって砕け方を変える
    if(shape==="icicle"){
      // つらら: 細かく砕けず、真っ二つの大きい破片が上下に飛ぶ
      const nBig=rint(2,3);
      for(let i=0;i<nBig;i++){const dir=i%2===0?-1:1;
        shards.push({x:hx,y:hy+i*b.r*0.25,vx:dir*rnd(2,4.5),vy:-rnd(2,5),s:rnd(b.r*0.5,b.r*0.75),
          rot:dir*0.3,vr:dir*rnd(0.08,0.18),life:1,decay:rnd(0.01,0.016),
          col:gold?pick(RAIN):"#dff0ff"});}
      for(let i=0;i<rint(4,6);i++){const a=rnd(0,TAU),s=rnd(3,7);
        shards.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,s:rnd(b.r*0.12,b.r*0.2),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.02,0.03),col:"#ffffff"});}
      api.tone(220,0.08,"square",0.07);
    }else if(shape==="block"){
      // 四角い雪ブロック: 一瞬 へこんでから 少し遅れて砕ける(氷キューブは従来どおり即砕け)
      const n=gold?18:8+Math.min(combo,6);
      setTimeout(()=>burst(n),90);
    }else{
      const n=gold?18:8+Math.min(combo,6);
      burst(n);
    }
    for(let i=0;i<rint(5,8);i++){const a=rnd(0,TAU),s=rnd(4,10);
      sparks.push({x:hx,y:hy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(7,16),life:1,decay:rnd(0.05,0.09)});}
  }
  // next-stage teaser line shown during the clear banner ("what comes next?")
  function teaser(s){
    if(s===3)return "つぎは こおりブロックが あらわれる!";
    return pick(["キンいろの ゆきだるまを さがせ!","ゲージを ためて フィーバーだ!",
      "ふぶきが もっと つよくなるぞ!","つぎは ステージ"+s+"!"]);
  }
  // FEVER TIME: rainbow sky / everything 1-hit / double points / fast spawns
  function startFever(){
    fever=FEVER_LEN;feverBanner=1.8;flash=1;
    api.boom(0.7);api.shake(16);api.slide(300,1200,0.5,0.22,"sawtooth");
    [0,4,7,12,16].forEach((s,i)=>setTimeout(()=>api.tone(659*Math.pow(2,s/12),0.15,"triangle",0.12),i*80));
    for(let i=0;i<12;i++)spawnSnow();
    for(let i=0;i<20;i++){const a=rnd(0,TAU),sp2=rnd(4,10);
      shards.push({x:api.W/2,y:api.H*0.35,vx:Math.cos(a)*sp2,vy:Math.sin(a)*sp2-2,s:rnd(5,10),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:pick(RAIN)});}
  }
  function checkStage(){
    if(stageKill<stageGoal||clearT>0)return;
    clearStage=stage;clearT=1.6;flash=Math.min(1,flash+0.6);
    clearSub=teaser(stage+1);
    api.boom(0.5);api.shake(12);
    api.slide(523,880,0.3,0.2,"triangle");api.tone(1046,0.3,"triangle",0.12);
    for(let i=0;i<26;i++){const a=rnd(0,TAU),s=rnd(3,9);
      shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,s:rnd(5,11),
        rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:pick(["#bfe8ff","#ffffff","#dff0ff"])});}
    // ③ ノンストップ ボーナス: このステージを コンボを切らさず突破したら +5 & みどりの星シャワー。
    if(stageNonstop){count+=5;api.setScore(count);
      floats.push({x:api.W/2,y:api.H*0.6,txt:"ノンストップ! +5",life:1,vy:-0.6,col:"#7be08a",size:30});
      api.tone(1318,0.16,"triangle",0.1);api.tone(1976,0.18,"triangle",0.07);
      for(let i=0;i<16;i++){const a=rnd(0,TAU),s=rnd(3,8);
        shards.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,s:rnd(5,9),
          rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:"#7be08a"});}}
    stageNonstop=true;
    stage++;stageGoal=stageGoalFor(stage);stageKill=0;buildBg();
  }
  // create a vortex at the tapped spot (or grow a nearby existing one)
  function makeVortex(x,y){
    for(const v of vortices){
      if(Math.hypot(v.x-x,v.y-y)<R*1.6){
        v.power=Math.min(v.power+0.5,3.2);v.life=Math.max(v.life,1);v.tx=x;v.ty=y;
        api.tone(360+v.power*60,0.07,"sine",0.08);api.noise(0.12,0.1,2200,"highpass",1);
        return;
      }
    }
    if(vortices.length>=5)vortices.shift();
    vortices.push({x,y,tx:x,ty:y,power:1,life:1,spin:rnd(0,TAU),age:0});
    api.slide(280,520,0.18,0.12,"sine");api.noise(0.16,0.12,2000,"highpass",1);
    for(let i=0;i<6;i++){const a=rnd(0,TAU);
      sparks.push({x,y,vx:Math.cos(a)*4,vy:Math.sin(a)*4,len:rnd(6,12),life:1,decay:0.07});}
  }
  // ④ ながれ星 ひみつキャッチ: 流れ星の近くをタップすると コインがこぼれる(減点なし・操作は普通のまま)
  function catchStar(){
    if(!shootStar||shootStar.caught)return;
    shootStar.caught=true;shootStar.life=Math.min(shootStar.life,0.3);
    count+=3;api.setScore(count);
    api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.08);api.tone(2093,0.16,"triangle",0.06);
    for(let k=0;k<14;k++){const a=rnd(0,TAU);
      glints.push({x:shootStar.x,y:shootStar.y,vx:Math.cos(a)*rnd(4,9),vy:Math.sin(a)*rnd(4,9),life:1,r:rnd(2,4.5)});}
    floats.push({x:clamp(shootStar.x,api.W*0.2,api.W*0.8),y:shootStar.y+R,txt:"ながれ星 +3!",life:1,vy:-0.8,col:"#ffe89a",size:26});
  }
  return{
    resize:layout,
    input(x,y,type){
      if(type!=="down")return;
      // ④ ながれ星が 近くにいたら キャッチ(タップは そのままトルネードも作る=操作は変わらない)
      if(shootStar&&!shootStar.caught&&Math.hypot(x-shootStar.x,y-shootStar.y)<R*2.4)catchStar();
      makeVortex(x,y);
    },
    frame(dt,now){
      tsec+=0.016*dt;fcount++;
      // ---- background: wintry sky gradient ----
      const sk=sky();
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景: ステージの空パレットを薄く重ねて面ごとの雰囲気を変える(1面=素の雪原はそのまま)
        if((stage-1)%SKY.length!==0){g.save();g.globalAlpha=0.26;const tg=g.createLinearGradient(0,0,0,api.H);
          tg.addColorStop(0,sk.a);tg.addColorStop(0.5,sk.b);tg.addColorStop(1,sk.c);
          g.fillStyle=tg;g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,sk.a);grd.addColorStop(0.4,sk.b);grd.addColorStop(0.78,sk.c);grd.addColorStop(1,sk.d);
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
        // pale cold sun halo upper area
        let sun=g.createRadialGradient(api.W*0.5,api.H*0.12,0,api.W*0.5,api.H*0.12,api.W*0.6);
        sun.addColorStop(0,"rgba(255,255,255,.5)");sun.addColorStop(0.3,"rgba(230,245,255,.18)");sun.addColorStop(1,"rgba(230,245,255,0)");
        g.fillStyle=sun;g.fillRect(0,0,api.W,api.H);
      }
      // distant snowy hills (parallax) ※画像背景のときは絵の山を活かして描かない
      if(!imgBg) for(const hl of hills){
        hl.ph+=hl.sp*dt;
        g.fillStyle=hl.col;g.beginPath();g.moveTo(0,api.H);
        for(let xx=0;xx<=api.W;xx+=26){const yy=hl.y+Math.sin(xx/hl.wl*TAU+hl.ph)*hl.amp;g.lineTo(xx,yy);}
        g.lineTo(api.W,api.H);g.closePath();g.fill();
      }
      // twinkling background sparkles (additive)
      g.save();g.globalCompositeOperation="lighter";
      for(const s of sparkleBg){s.ph+=s.sp*dt;const tw=0.4+0.6*Math.abs(Math.sin(s.ph));
        g.globalAlpha=tw*0.6;g.fillStyle="#eaf6ff";
        g.beginPath();g.arc(s.x,s.y,s.r*tw,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      // ---- ④ ながれ星 描画(細い尾を引く光の粒) ----
      if(shootStar){
        const s=shootStar,a=clamp(s.life,0,1);
        g.save();g.globalCompositeOperation="lighter";
        const tl=g.createLinearGradient(s.x,s.y,s.x-s.vx*6,s.y-s.vy*6);
        tl.addColorStop(0,"rgba(255,248,200,"+(0.9*a)+")");tl.addColorStop(1,"rgba(255,248,200,0)");
        g.strokeStyle=tl;g.lineWidth=3;g.lineCap="round";
        g.beginPath();g.moveTo(s.x,s.y);g.lineTo(s.x-s.vx*6,s.y-s.vy*6);g.stroke();
        g.fillStyle="rgba(255,255,255,"+a+")";g.shadowColor="#fff3b0";g.shadowBlur=10;
        g.beginPath();g.arc(s.x,s.y,3.2,0,TAU);g.fill();
        g.restore();g.shadowBlur=0;g.globalAlpha=1;
      }
      // drifting ambient snow (behind play field)
      g.fillStyle="#ffffff";
      for(const d of drift){
        d.sw+=0.03*dt;d.y+=d.sp*dt;d.x+=Math.sin(d.sw)*0.5*dt;
        if(d.y>api.H+4){d.y=-4;d.x=rnd(0,api.W);}
        if(d.x>api.W+4)d.x=-4;else if(d.x<-4)d.x=api.W+4;
        g.globalAlpha=d.al;g.beginPath();g.arc(d.x,d.y,d.r,0,TAU);g.fill();
      }
      g.globalAlpha=1;
      // ---- FEVER TIME: countdown + rainbow sky wash ----
      if(fever>0){
        fever-=0.016*dt;
        if(fever<=0){fever=0;feverGauge=0;api.slide(1046,330,0.4,0.14,"sine");
          floats.push({x:api.W/2,y:api.H*0.3,txt:"フィーバー おわり",life:1,vy:-0.5,col:"#ffffff",size:24});}
        else{
          const fa=clamp(fever,0,1)*clamp((FEVER_LEN-fever)*2,0,1); // fade in/out
          const hue=(tsec*120)%360;
          g.save();g.globalCompositeOperation="lighter";
          const fg=g.createLinearGradient(0,0,api.W,api.H);
          fg.addColorStop(0,"hsla("+hue+",90%,62%,"+(0.20*fa).toFixed(3)+")");
          fg.addColorStop(0.5,"hsla("+((hue+120)%360)+",90%,62%,"+(0.14*fa).toFixed(3)+")");
          fg.addColorStop(1,"hsla("+((hue+240)%360)+",90%,62%,"+(0.20*fa).toFixed(3)+")");
          g.fillStyle=fg;g.fillRect(0,0,api.W,api.H);
          g.restore();
        }
      }
      // ---- spawn snow blocks over time ----
      if(clearT<=0){
        spawnT-=dt;
        if(spawnT<=0){spawnSnow();spawnT=fever>0?9:clamp(30-(stage-1)*2,14,30);}   // 7〜8歳向け: 出現を少し速く
      }
      // keep field populated even if smoke spams clears
      if(snows.length<6&&clearT<=0)spawnSnow();
      // ---- ④ ながれ星: たまに空を流れる(近くをタップでキャッチ=ひみつのごほうび) ----
      shootT-=dt;
      if(!shootStar&&shootT<=0&&clearT<=0){
        shootStar={x:rnd(api.W*0.55,api.W*0.95),y:rnd(api.H*0.06,api.H*0.2),vx:-rnd(5,8),vy:rnd(2.2,3.6),life:1,caught:false};
        shootT=rnd(360,620);
      }
      if(shootStar){
        shootStar.x+=shootStar.vx*dt;shootStar.y+=shootStar.vy*dt;
        if(shootStar.caught)shootStar.life-=0.06*dt;
        if(shootStar.x<-40||shootStar.y>api.H*0.92||shootStar.life<=0)shootStar=null;
      }
      // ---- update vortices ----
      for(const v of vortices){
        v.age+=dt;v.spin+=(0.16+v.power*0.05)*dt;
        v.life-=0.012*dt;
        v.x=lerp(v.x,v.tx,clamp(0.2*dt,0,1));v.y=lerp(v.y,v.ty,clamp(0.2*dt,0,1));
      }
      vortices=vortices.filter(v=>v.life>0);
      // ---- snow physics: pull toward vortices, fling out when too close ----
      for(let i=snows.length-1;i>=0;i--){
        const b=snows[i];
        b.wob+=0.05*dt;b.rot+=b.vr*dt;
        let nearest=null,nd=1e9;
        for(const v of vortices){
          const dx=v.x-b.x,dy=v.y-b.y,d=Math.hypot(dx,dy)||1;
          const reach=R*(1.2+v.power*0.9);
          if(d<reach){
            const f=(1-d/reach)*(0.5+v.power*0.45);
            // swirl: pull inward + tangential spin
            b.vx+=(dx/d)*f*0.9*dt;
            b.vy+=(dy/d)*f*0.9*dt;
            b.vx+=(-dy/d)*f*0.7*dt;
            b.vy+=(dx/d)*f*0.7*dt;
            if(d<nd){nd=d;nearest=v;}
          }
        }
        // friction
        b.vx*=0.94;b.vy*=0.94;
        b.x+=b.vx*dt;b.y+=b.vy*dt;
        // bounds: keep on screen, soft bounce
        if(b.x<b.r){b.x=b.r;b.vx*=-0.4;}
        if(b.x>api.W-b.r){b.x=api.W-b.r;b.vx*=-0.4;}
        if(b.y<b.r){b.y=b.r;b.vy*=-0.4;}
        if(b.y>api.H-b.r){b.y=api.H-b.r;b.vy*=-0.4;}
        // sucked into the eye -> shatter + fling
        if(nearest&&nd<R*0.4+nearest.power*3){
          b.hp=(b.hp||1)-1;
          const tough=(b.type==="ice"&&fever<=0)?2:1; // fever: everything pops in 1 hit
          if((b.hits=(b.hits||0)+1)>=tough){
            shatter(b);
            let gain=b.type==="ice"?2:b.type==="gold"?5:b.type==="rainbow"?8:1;
            // ② ラッキー色: 今日の秘密のぼんぼり色の ゆきだるまを こわすと +1 の隠しボーナス。
            const isLucky=b.type==="snow"&&b.pom===luckyColor;
            if(isLucky){gain+=1;if(!luckySeen){luckyMsgT=1.8;luckySeen=true;}}
            if(fever>0)gain*=2; // fever: double points
            count+=gain;stageKill++;api.setScore(count);
            if(b.type==="gold"){ // jackpot! fanfare + big flash
              flash=Math.min(1,flash+0.5);api.boom(0.6);api.shake(12);
              [0,4,7,12].forEach((s2,i2)=>setTimeout(()=>api.tone(784*Math.pow(2,s2/12),0.14,"triangle",0.12),i2*70));
              floats.push({x:b.x,y:b.y-R*1.4,txt:"キンいろ +"+gain+"!",life:1,vy:-0.9,col:"#ffd23f",size:34});
            }
            if(b.type==="rainbow"){ // ① にじいろブロック撃破: 虹の大盤振る舞い(激レアの爽快ごほうび)
              rbMsgT=1.4;flash=Math.min(1,flash+0.4);api.boom(0.7);api.shake(16);
              if(fcount-lastHS>=30){api.hitStop(4);lastHS=fcount;} // 節目限定ヒットストップ
              api.slide(660,1320,0.4,0.16,"triangle");api.tone(880,0.14,"triangle",0.12);api.tone(1320,0.16,"triangle",0.1);
              for(let k=0;k<RAIN.length;k++)rings.push({x:b.x,y:b.y,r:R*0.4,vr:R*(0.55+k*0.13),life:1,decay:0.05,col:RAIN[k]});
              for(let i2=0;i2<26;i2++){const a=rnd(0,TAU),s2=rnd(3,10);
                shards.push({x:b.x,y:b.y,vx:Math.cos(a)*s2,vy:Math.sin(a)*s2-2,s:rnd(5,9),
                  rot:rnd(0,TAU),vr:rnd(-0.3,0.3),life:1,decay:rnd(0.012,0.02),col:pick(RAIN)});}
              floats.push({x:clamp(b.x,api.W*0.2,api.W*0.8),y:b.y-R*1.4,txt:"にじいろ +"+gain+"!",life:1,vy:-0.9,col:"#ff7bd0",size:34});
            }
            if(isLucky){ // ② ラッキー色 命中: きらっと小さめの祝福(白飛びしないよう控えめ)
              api.tone(1046,0.14,"triangle",0.11);api.tone(1568,0.16,"triangle",0.08);
              for(let k=0;k<8;k++){const a=rnd(0,TAU);
                glints.push({x:b.x,y:b.y,vx:Math.cos(a)*rnd(3,6),vy:Math.sin(a)*rnd(3,6),life:1,r:rnd(2,4)});}
              floats.push({x:b.x,y:b.y-R*1.3,txt:"ラッキー!",life:1,vy:-0.8,col:luckyColor,size:26});
            }
            if(fever<=0){ // charge the fever gauge (gold/rainbow charge a big chunk)
              feverGauge=Math.min(1,feverGauge+(b.type==="gold"?0.35:b.type==="rainbow"?0.5:0.085));
              if(feverGauge>=1)startFever();
            }
            combo++;comboT=0.9;
            const pitch=400*Math.pow(2,clamp(combo,0,12)/12);
            api.tone(pitch,0.1,"triangle",0.12);
            api.slide(700+nearest.power*80,200,0.12,0.16,"sine");
            api.noise(0.14,0.18,1600,"highpass",0.9);
            api.shake(4+Math.min(combo,8));
            flash=Math.min(1,flash+0.18+nearest.power*0.05);
            if(combo>=3){
              // hitStop は「コンボ節目(5,10,15...)の単発の大ヒット」のみ + 30f間隔
              if(combo%5===0&&fcount-lastHS>=30){api.hitStop(combo>=10?3:2);lastHS=fcount;}
              api.boom(clamp(0.3+combo*0.04,0.3,0.6));
              floats.push({x:b.x,y:b.y-R,txt:"x"+combo,life:1,vy:-1.1,
                col:combo>=8?"#7be0ff":combo>=5?"#ffd23f":"#ffffff",size:combo>=6?40:30});}
            nearest.power=Math.min(nearest.power+0.25,3.2);
            // glints fly from the eye
            for(let k=0;k<3;k++){const a=rnd(0,TAU);
              glints.push({x:nearest.x,y:nearest.y,vx:Math.cos(a)*rnd(4,8),vy:Math.sin(a)*rnd(4,8),life:1,r:rnd(2,4)});}
            snows.splice(i,1);
            checkStage();
          }else{
            // ice cracked but survives: fling it away once
            const a=rnd(0,TAU),s=rnd(6,10);
            b.vx=Math.cos(a)*s;b.vy=Math.sin(a)*s;
            b.col="#bfe8ff";
            api.noise(0.08,0.14,2400,"highpass",1);api.tone(300,0.06,"square",0.08);
            api.shake(3);
          }
        }
      }
      // ---- draw snow blocks ----
      for(const b of snows){
        const bobx=Math.sin(b.wob)*1.5;
        g.save();g.translate(b.x+bobx,b.y);g.rotate(b.rot);
        // shadow
        g.fillStyle="rgba(80,110,150,.18)";g.beginPath();g.ellipse(0,b.r*0.7,b.r*0.8,b.r*0.3,0,0,TAU);g.fill();
        if(b.type==="ice"){
          // crystalline ice cube (手描き: 生成画像は床の残りが取れず不採用)
          const ig=g.createLinearGradient(-b.r,-b.r,b.r,b.r);
          ig.addColorStop(0,"#eaffff");ig.addColorStop(0.5,b.col);ig.addColorStop(1,"#7fc8e8");
          g.fillStyle=ig;roundRect(-b.r*0.8,-b.r*0.8,b.r*1.6,b.r*1.6,b.r*0.25);g.fill();
          g.strokeStyle="rgba(255,255,255,.7)";g.lineWidth=2;
          roundRect(-b.r*0.8,-b.r*0.8,b.r*1.6,b.r*1.6,b.r*0.25);g.stroke();
          g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=1.5;
          g.beginPath();g.moveTo(-b.r*0.4,-b.r*0.6);g.lineTo(b.r*0.2,b.r*0.5);
          g.moveTo(b.r*0.5,-b.r*0.4);g.lineTo(-b.r*0.2,b.r*0.6);g.stroke();
        }else if(b.type==="gold"){
          // rare golden snowball: pulsing glow + rotating sparkle rays
          const pu=1+0.08*Math.sin(tsec*6+b.wob);
          g.scale(pu,pu);
          g.save();g.globalCompositeOperation="lighter";
          const gg2=g.createRadialGradient(0,0,0,0,0,b.r*1.9);
          gg2.addColorStop(0,"rgba(255,220,80,.55)");gg2.addColorStop(1,"rgba(255,200,60,0)");
          g.fillStyle=gg2;g.beginPath();g.arc(0,0,b.r*1.9,0,TAU);g.fill();g.restore();
          // 画像の キンいろ玉(顔つき、丸のときだけ)。無ければ従来の手描き玉+顔。丸以外の形は手描き専用。
          // 実測: 玉の直径は正方形の約0.82、玉の中心は上のひも分だけ下(+0.085)にある
          //  → 直径≒1.9r(当たり判定 r に一致)になるよう 2.3r で描き、玉の中心が 0 に来るよう 0.2r 上へずらす
          let goldImg=false;
          if(b.shape==="round"){
            goldImg=api.drawAsset("gold.png",0,-b.r*0.2,b.r*2.3,b.r*2.3,{center:true});
            if(!goldImg){
            const ggr=g.createRadialGradient(-b.r*0.3,-b.r*0.35,b.r*0.1,0,0,b.r);
            ggr.addColorStop(0,"#fff8d0");ggr.addColorStop(0.6,"#ffd23f");ggr.addColorStop(1,"#e8960a");
            g.fillStyle=ggr;g.beginPath();g.arc(0,0,b.r*0.95,0,TAU);g.fill();
            g.fillStyle="rgba(255,255,255,.85)";
            g.beginPath();g.ellipse(-b.r*0.3,-b.r*0.35,b.r*0.25,b.r*0.16,-0.4,0,TAU);g.fill();
            }
          }else if(b.shape==="icicle"){ drawIcicle(b,"#ffe27a"); }
          else if(b.shape==="block"){ drawSnowBlock(b,"#ffe9a8"); }
          else{ drawSnowman(b,"#ffe9a8","#7a4a00"); }
          g.save();g.globalCompositeOperation="lighter";g.rotate(tsec*2);
          g.strokeStyle="rgba(255,255,255,.9)";g.lineWidth=2;g.lineCap="round";
          for(let k=0;k<4;k++){g.rotate(TAU/4);
            g.beginPath();g.moveTo(b.r*0.55,0);g.lineTo(b.r*1.25,0);g.stroke();}
          g.restore();
          // happy face (画像には顔が描いてあるので手描き丸のときのみ。だるまは drawSnowman が顔を描く)
          if(b.shape==="round"&&!goldImg){
          g.fillStyle="#7a4a00";
          g.beginPath();g.arc(-b.r*0.25,-b.r*0.05,b.r*0.1,0,TAU);g.arc(b.r*0.25,-b.r*0.05,b.r*0.1,0,TAU);g.fill();
          g.strokeStyle="#7a4a00";g.lineWidth=Math.max(1.5,b.r*0.06);g.lineCap="round";
          g.beginPath();g.arc(0,b.r*0.1,b.r*0.2,0.15*Math.PI,0.85*Math.PI);g.stroke();
          }
        }else if(b.type==="rainbow"){
          // ① 激レア にじいろブロック: 虹色に脈打つ + 回るきらめき(見つけたら すぐ分かる)。丸以外の形にも化ける。
          const pu=1+0.1*Math.sin(tsec*6+b.wob);g.scale(pu,pu);
          const hue=(tsec*140+b.wob*40)%360;
          g.save();g.globalCompositeOperation="lighter";
          const ag=g.createRadialGradient(0,0,0,0,0,b.r*1.9);
          ag.addColorStop(0,"hsla("+hue+",95%,70%,.5)");ag.addColorStop(1,"hsla("+hue+",95%,70%,0)");
          g.fillStyle=ag;g.beginPath();g.arc(0,0,b.r*1.9,0,TAU);g.fill();g.restore();
          const rainCol="hsl("+hue+",95%,65%)";
          if(b.shape==="icicle"){ drawIcicle(b,rainCol); }
          else if(b.shape==="block"){ drawSnowBlock(b,rainCol); }
          else if(b.shape==="snowman"){ drawSnowman(b,rainCol,"#5a2a5a"); }
          else{
            const rg=g.createRadialGradient(-b.r*0.3,-b.r*0.35,b.r*0.1,0,0,b.r);
            rg.addColorStop(0,"#ffffff");rg.addColorStop(0.5,rainCol);rg.addColorStop(1,"hsl("+((hue+60)%360)+",90%,45%)");
            g.fillStyle=rg;g.beginPath();g.arc(0,0,b.r*0.95,0,TAU);g.fill();
            g.fillStyle="rgba(255,255,255,.85)";
            g.beginPath();g.ellipse(-b.r*0.3,-b.r*0.35,b.r*0.25,b.r*0.16,-0.4,0,TAU);g.fill();
          }
          g.save();g.globalCompositeOperation="lighter";g.rotate(tsec*2);
          g.lineWidth=2;g.lineCap="round";
          for(let k=0;k<6;k++){g.rotate(TAU/6);g.strokeStyle="hsl("+((hue+k*60)%360)+",95%,70%)";
            g.beginPath();g.moveTo(b.r*0.55,0);g.lineTo(b.r*1.25,0);g.stroke();}
          g.restore();
          if(b.shape==="round"){
          g.fillStyle="#5a2a5a";
          g.beginPath();g.arc(-b.r*0.25,-b.r*0.05,b.r*0.1,0,TAU);g.arc(b.r*0.25,-b.r*0.05,b.r*0.1,0,TAU);g.fill();
          g.strokeStyle="#5a2a5a";g.lineWidth=Math.max(1.5,b.r*0.06);g.lineCap="round";
          g.beginPath();g.arc(0,b.r*0.1,b.r*0.2,0.15*Math.PI,0.85*Math.PI);g.stroke();
          }
        }else if(b.shape==="icicle"){
          drawIcicle(b,b.col);
        }else if(b.shape==="block"){
          drawSnowBlock(b,b.col);
        }else if(b.shape==="snowman"){
          drawSnowman(b,b.col);
        }else{
          // round snowball
          const sg=g.createRadialGradient(-b.r*0.3,-b.r*0.35,b.r*0.1,0,0,b.r);
          sg.addColorStop(0,"#ffffff");sg.addColorStop(0.7,b.col);sg.addColorStop(1,"#bcd6ee");
          g.fillStyle=sg;g.beginPath();g.arc(0,0,b.r*0.95,0,TAU);g.fill();
          g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.ellipse(-b.r*0.3,-b.r*0.35,b.r*0.25,b.r*0.16,-0.4,0,TAU);g.fill();
          // sparkle dots
          g.fillStyle="rgba(255,255,255,.6)";
          g.beginPath();g.arc(b.r*0.3,b.r*0.2,b.r*0.08,0,TAU);g.arc(b.r*0.1,-b.r*0.4,b.r*0.06,0,TAU);g.fill();
        }
        // cute face on some round snowballs (つらら/ブロックは無表情、だるまは自前で顔を描く)
        if(b.face&&b.type==="snow"&&b.shape==="round"){
          g.fillStyle="#3a5a78";
          g.beginPath();g.arc(-b.r*0.25,-b.r*0.05,b.r*0.1,0,TAU);g.arc(b.r*0.25,-b.r*0.05,b.r*0.1,0,TAU);g.fill();
          g.fillStyle="rgba(255,140,140,.4)";
          g.beginPath();g.arc(-b.r*0.4,b.r*0.15,b.r*0.1,0,TAU);g.arc(b.r*0.4,b.r*0.15,b.r*0.1,0,TAU);g.fill();
          g.strokeStyle="#3a5a78";g.lineWidth=Math.max(1.5,b.r*0.06);g.lineCap="round";
          g.beginPath();g.arc(0,b.r*0.05,b.r*0.18,0.15*Math.PI,0.85*Math.PI);g.stroke();
        }
        // ② ラッキー色ヒント: ゆきだるまの あたまの「ぼんぼり」(色つき)。今日のラッキー色を さがす手がかり。
        if(b.type==="snow"&&b.pom){
          g.fillStyle=b.pom;
          g.beginPath();g.arc(0,-b.r*0.92,b.r*0.26,0,TAU);g.fill();
          g.fillStyle="rgba(255,255,255,.5)";
          g.beginPath();g.arc(-b.r*0.08,-b.r,b.r*0.1,0,TAU);g.fill();
        }
        g.restore();
        // ② ラッキー色: 今日のラッキーぼんぼりの ゆきだるまには 小さな星がキラッ(気づけるヒント)
        if(b.type==="snow"&&b.pom===luckyColor){
          const tw=0.5+0.5*Math.sin(tsec*5+b.wob);
          g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.5+0.5*tw;
          g.translate(b.x+Math.sin(b.wob)*1.5,b.y-b.r*1.35);
          g.fillStyle="#fff3b0";g.shadowColor="#ffe07a";g.shadowBlur=8;
          drawTwinkle(b.r*0.22*(0.7+0.3*tw));
          g.restore();g.shadowBlur=0;g.globalAlpha=1;
        }
      }
      // ---- draw vortices (swirling blizzard tornadoes) ----
      // うずまきは手描きのまま(生成画像は画面いっぱいの模様になり単体物にならず不採用)
      g.save();g.globalCompositeOperation="lighter";
      for(const v of vortices){
        const rad=Math.max(0,R*(1.6+v.power*0.9)), fade=clamp(v.life*1.4,0,1);
        // outer glow
        const ag=g.createRadialGradient(v.x,v.y,0,v.x,v.y,rad*1.5);
        ag.addColorStop(0,"rgba(220,245,255,"+(0.5*fade)+")");
        ag.addColorStop(0.5,"rgba(150,210,255,"+(0.2*fade)+")");
        ag.addColorStop(1,"rgba(150,210,255,0)");
        g.fillStyle=ag;g.beginPath();g.arc(v.x,v.y,rad*1.5,0,TAU);g.fill();
        // swirling arms
        g.save();g.translate(v.x,v.y);g.rotate(v.spin);
        for(let arm=0;arm<3;arm++){
          g.save();g.rotate(arm*TAU/3);
          g.globalAlpha=fade*0.6;g.strokeStyle="rgba(255,255,255,.9)";g.lineWidth=2.5;g.lineCap="round";
          g.beginPath();
          for(let t=0;t<1;t+=0.06){const ang=t*5,rr=rad*t;
            const px=Math.cos(ang)*rr,py=Math.sin(ang)*rr;
            if(t===0)g.moveTo(px,py);else g.lineTo(px,py);}
          g.stroke();g.restore();
        }
        g.restore();
        // bright spinning eye
        g.globalAlpha=fade;
        const eg=g.createRadialGradient(v.x,v.y,0,v.x,v.y,R*0.5);
        eg.addColorStop(0,"#ffffff");eg.addColorStop(1,"rgba(200,235,255,0)");
        g.fillStyle=eg;g.beginPath();g.arc(v.x,v.y,R*0.5,0,TAU);g.fill();
        // orbiting flakes
        for(let k=0;k<5;k++){const a=v.spin*1.5+k*TAU/5,rr=rad*0.6;
          g.globalAlpha=fade*0.8;g.fillStyle="#eaf6ff";
          g.beginPath();g.arc(v.x+Math.cos(a)*rr,v.y+Math.sin(a)*rr,2.5,0,TAU);g.fill();}
      }
      g.restore();g.globalAlpha=1;
      // ---- shards ----
      for(const p of shards){p.vy+=0.22*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        g.fillStyle=p.col;g.beginPath();
        for(let i=0;i<6;i++){const a=i*TAU/6,rr=i%2?p.s*0.5:p.s;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}
        g.closePath();g.fill();g.restore();}
      shards=shards.filter(p=>p.life>0&&p.y<api.H+30);
      // ---- glint sparks (additive lines) ----
      g.save();g.globalCompositeOperation="lighter";g.lineCap="round";
      for(const sp of sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vx*=0.9;sp.vy*=0.9;sp.life-=sp.decay*dt;
        g.globalAlpha=Math.max(0,sp.life);g.strokeStyle="#eaf6ff";g.lineWidth=2.5;
        const a=Math.atan2(sp.vy,sp.vx);
        g.beginPath();g.moveTo(sp.x,sp.y);g.lineTo(sp.x-Math.cos(a)*sp.len,sp.y-Math.sin(a)*sp.len);g.stroke();}
      g.restore();g.globalAlpha=1;
      sparks=sparks.filter(sp=>sp.life>0);
      // ---- glints (twinkling stars from the eye) ----
      g.save();g.globalCompositeOperation="lighter";
      for(const gl of glints){gl.x+=gl.vx*dt;gl.y+=gl.vy*dt;gl.vx*=0.92;gl.vy*=0.92;gl.life-=0.04*dt;
        g.globalAlpha=Math.max(0,gl.life);g.fillStyle="#ffffff";g.shadowColor="#bfe8ff";g.shadowBlur=8;
        g.beginPath();g.arc(gl.x,gl.y,Math.max(0,gl.r*gl.life),0,TAU);g.fill();}
      g.restore();g.shadowBlur=0;g.globalAlpha=1;
      glints=glints.filter(gl=>gl.life>0);
      // ---- shockwave rings ----
      for(const ri of rings){ri.r+=ri.vr*dt;ri.life-=ri.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ri.life)*0.6;g.strokeStyle=ri.col;
        g.lineWidth=2+ri.life*3;g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();g.restore();}
      rings=rings.filter(ri=>ri.life>0);
      // ---- combo floats ----
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.02*dt;g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(40,70,110,.6)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // ---- combo timer ---- (コンボが切れたら ③ ノンストップ失敗)
      if(combo>0){comboT-=0.016*dt;if(comboT<=0){combo=0;stageNonstop=false;}}
      // ---- impact flash ----
      if(flash>0){flash-=0.06*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa*0.28;
        g.fillStyle="#ffffff";g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      // ---- combo text (top center, safe zone) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save();g.translate(api.W/2,api.H*0.16);g.scale(pop,pop);
        g.font="800 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(120,210,255,.8)";g.shadowBlur=14;
        g.fillStyle="#7be0ff";g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0;g.lineWidth=1.5;g.strokeStyle="rgba(255,255,255,.6)";
        g.strokeText("コンボ x"+combo,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";
      }
      // ① にじいろブロック! 発見バナー(虹色に色替わり・中央上=HUD安全帯)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=RAIN[Math.floor(tsec*8)%RAIN.length];
        g.save();g.translate(api.W/2,api.H*0.22);g.scale(pop,pop);g.textAlign="center";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor=col;g.shadowBlur=18;g.fillStyle="#ffffff";g.fillText("にじいろブロック!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle=col;g.strokeText("にじいろブロック!",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん! (初回だけ中央に一度教える)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.29);g.textAlign="center";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうの ラッキーは "+(POMNAME[luckyColor]||"")+" の ぼんぼり!";
        g.lineWidth=5;g.strokeStyle="rgba(40,70,110,.5)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";if(luckyMsgT<0)luckyMsgT=0;}
      // ---- HUD: stage + progress (top center safe zone) ----
      drawHUD();
      // ---- STAGE CLEAR banner ----
      if(clearT>0){clearT-=0.016*dt;
        const a=clamp(clearT*1.4,0,1);
        g.save();g.globalAlpha=a*0.42;g.fillStyle="#0c2a44";g.fillRect(0,api.H*0.34,api.W,api.H*0.22);g.restore();
        const pop=1+Math.max(0,clearT-1.3)*1.8;
        g.save();g.translate(api.W/2,api.H*0.45);g.scale(pop,pop);g.globalAlpha=a;
        g.textAlign="center";g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="rgba(120,210,255,.9)";g.shadowBlur=20;g.fillStyle="#bfe8ff";
        g.fillText("ステージ"+clearStage+" クリア!",0,0);
        g.shadowBlur=0;g.lineWidth=2;g.strokeStyle="#fff";g.strokeText("ステージ"+clearStage+" クリア!",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText("つぎは ステージ"+(clearStage+1)+"!",0,40);
        g.restore();g.globalAlpha=1;g.textAlign="left";
        if(clearT<=0){clearT=0;spawnT=12;}
      }
      // 加算合成を必ず標準へ戻す(発光が溜まって画面が明るいまま残るのを防ぐ=白飛び対策)
      g.globalCompositeOperation="source-over";g.globalAlpha=1;
    },
    stop(){}
  };
  // ---- 軸7向け追加形状(手描き。既存の丸雪玉/氷キューブと混ざって出現する) ----
  function drawIcicle(b,tintCol){
    const r=b.r;
    const ig=g.createLinearGradient(0,-r*1.1,0,r*1.5);
    ig.addColorStop(0,"#ffffff");ig.addColorStop(0.5,tintCol||"#dff0ff");ig.addColorStop(1,"#8fd0ec");
    g.fillStyle=ig;
    g.beginPath();
    g.moveTo(-r*0.55,-r*1.05);g.lineTo(r*0.55,-r*1.05);g.lineTo(r*0.14,r*1.5);g.lineTo(-r*0.14,r*1.5);
    g.closePath();g.fill();
    g.strokeStyle="rgba(255,255,255,.75)";g.lineWidth=2;g.stroke();
    g.strokeStyle="rgba(255,255,255,.55)";g.lineWidth=1.4;
    g.beginPath();g.moveTo(-r*0.18,-r*0.7);g.lineTo(-r*0.06,r*0.9);g.stroke();
    g.beginPath();g.moveTo(r*0.22,-r*0.6);g.lineTo(r*0.08,r*0.5);g.stroke();
  }
  function drawSnowBlock(b,col){
    const r=b.r;
    const bg=g.createLinearGradient(-r,-r*0.85,r,r*0.85);
    bg.addColorStop(0,"#ffffff");bg.addColorStop(0.55,col||"#eaf6ff");bg.addColorStop(1,"#bcd6ee");
    g.fillStyle=bg;
    roundRect(-r*0.98,-r*0.82,r*1.96,r*1.64,r*0.14);g.fill();
    g.strokeStyle="rgba(140,175,205,.55)";g.lineWidth=2;
    roundRect(-r*0.98,-r*0.82,r*1.96,r*1.64,r*0.14);g.stroke();
    g.strokeStyle="rgba(140,175,205,.35)";g.lineWidth=1.4;
    g.beginPath();g.moveTo(-r*0.98,0);g.lineTo(r*0.98,0);g.moveTo(0,-r*0.82);g.lineTo(0,r*0.82);g.stroke();
  }
  function drawSnowman(b,col,faceCol){
    const r=b.r,fc=faceCol||"#3a5a78";
    const lowerG=g.createRadialGradient(-r*0.2,r*0.25,r*0.1,0,r*0.42,r*0.75);
    lowerG.addColorStop(0,"#ffffff");lowerG.addColorStop(0.7,col||"#eaf6ff");lowerG.addColorStop(1,"#bcd6ee");
    g.fillStyle=lowerG;g.beginPath();g.arc(0,r*0.42,r*0.72,0,TAU);g.fill();
    const upperG=g.createRadialGradient(-r*0.15,-r*0.48,r*0.08,0,-r*0.32,r*0.5);
    upperG.addColorStop(0,"#ffffff");upperG.addColorStop(0.7,col||"#eaf6ff");upperG.addColorStop(1,"#cfe6f7");
    g.fillStyle=upperG;g.beginPath();g.arc(0,-r*0.32,r*0.5,0,TAU);g.fill();
    g.fillStyle=fc;
    g.beginPath();g.arc(-r*0.16,-r*0.4,r*0.07,0,TAU);g.arc(r*0.16,-r*0.4,r*0.07,0,TAU);g.fill();
    g.strokeStyle=fc;g.lineWidth=Math.max(1.3,r*0.05);g.lineCap="round";
    g.beginPath();g.arc(0,-r*0.24,r*0.14,0.15*Math.PI,0.85*Math.PI);g.stroke();
  }
  function drawHUD(){
    const left=clamp(stageGoal-stageKill,0,stageGoal);
    const bw=Math.min(api.W*0.6,360),bh=14,bx=(api.W-bw)/2,by=api.H*0.05;
    g.save();g.textAlign="center";
    g.font="800 17px 'Hiragino Maru Gothic ProN',system-ui";
    g.fillStyle="#fff";g.shadowColor="rgba(20,50,90,.6)";g.shadowBlur=6;
    g.fillText("ステージ "+stage+"      あと "+left,api.W/2,by-7);
    g.shadowBlur=0;
    g.fillStyle="rgba(20,50,90,.35)";roundRect(bx,by,bw,bh,bh/2);g.fill();
    const fr=clamp(stageKill/stageGoal,0,1);
    if(fr>0){const gg=g.createLinearGradient(bx,0,bx+bw,0);
      gg.addColorStop(0,"#9be8ff");gg.addColorStop(1,"#ffffff");
      g.fillStyle=gg;roundRect(bx,by,Math.max(bh,bw*fr),bh,bh/2);g.fill();}
    g.strokeStyle="rgba(255,255,255,.55)";g.lineWidth=2;roundRect(bx,by,bw,bh,bh/2);g.stroke();
    g.restore();g.textAlign="left";
  }
  function roundRect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function drawTwinkle(s){g.beginPath();
    for(let i=0;i<8;i++){const a=i*TAU/8,rr=i%2?s*0.4:s;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}
    g.closePath();g.fill();}
}
Engine.register("blizzard", build_blizzard);
