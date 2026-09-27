function buildBowl(api){
  const g=api.g;
  // 画像アセット: 背景だけ使う(無ければ従来の手描きにフォールバック)。
  // ball/goldpin/bombpin は生成が2回とも不良(床の残り・マゼンタの穴・背景残り)だったので手描きのまま(意図的に読み込まない)
  api.preload(["bg.jpg"]);
  let pins=[],ball,sparks=[],floats=[],trail=[],glints=[];
  let topY,botY,laneTopW,laneBotW,pinN,round,count,combo,sx,sy,lx,ly,aiming,resetT,tms=0,flash=0,wash=0;
  // stage progression
  let stage,stageGoal,stageDown,clearT,bigT,shocks=[];
  const MAXSTAGE=5;
  // ---- 隠し発見レイヤー(crane/punch/hammer/truck と同じ思想) ----
  const LC=[{c:"#ff5a5a",n:"あか"},{c:"#4aa6ff",n:"あお"},{c:"#ffd23f",n:"きいろ"},{c:"#7be08a",n:"みどり"},{c:"#c79aff",n:"むらさき"},{c:"#ff8ac0",n:"ピンク"}];
  const lucky=pick(LC);                    // ② きょうのラッキー色: セッション秘密の1色(build時に確定)
  let luckySeen=false,luckyMsgT=0;         // 初回だけ中央上に教える
  let rbMsgT=0;                            // ① にじいろピン 発見バナー
  let streak=0,streakMsgT=0,streakTxt="";  // ③ 連続ストライク(ダブル/ターキー)
  let stageGutter=false,gutterThisBall=false,perfMsgT=0; // ③ パーフェクト(ノーガター)判定
  // 【軸6】祝福バナー(にじいろ/連続ストライク/パーフェクト/ラッキー色)の同時多発対策:
  // それぞれ固定y座標で独立に光るため重なって読めなくなることがあった。
  // 優先順位(にじいろ＞連続ストライク＞パーフェクト＞ラッキー色)を決め、
  // 上位が表示中の間は下位の開始を少し遅らせることで、同時に文字が重なるのを防ぐ。
  const BANNER_PRI={rainbow:4,streak:3,perfect:2,lucky:1};
  const BANNER_ORDER=["rainbow","streak","perfect","lucky"];
  const bannerDelay={rainbow:0,streak:0,perfect:0,lucky:0};   // 開始までの待ち時間
  const bannerPending={rainbow:0,streak:0,perfect:0,lucky:0}; // 待ち終わったら適用する表示時間
  function bannerCurT(name){return name==="rainbow"?rbMsgT:name==="streak"?streakMsgT:name==="perfect"?perfMsgT:luckyMsgT;}
  function bannerRemaining(name){let t=bannerCurT(name);if(bannerDelay[name]>0)t=Math.max(t,bannerDelay[name]+bannerPending[name]);return t;}
  function startBannerNow(name,dur){if(name==="rainbow")rbMsgT=dur;else if(name==="streak")streakMsgT=dur;else if(name==="perfect")perfMsgT=dur;else luckyMsgT=dur;}
  function triggerBanner(name,dur){
    let wait=0;
    for(const other of BANNER_ORDER){
      if(other===name||BANNER_PRI[other]<=BANNER_PRI[name])continue;
      wait=Math.max(wait,bannerRemaining(other));
    }
    if(wait>0){bannerDelay[name]=wait+0.15;bannerPending[name]=dur;}
    else startBannerNow(name,dur);
  }
  let star=null,starT=200;                 // ④ ながれ星ひみつタップ
  // per-stage flavor: name + accent + which special pins appear
  // (7〜8歳向けに目標本数を約25%増やした: 11/16/22/26/30 → 14/20/27/32/37)
  const STAGES=[
    {name:"ボウリングじょう", goal:14, accent:"#ffd23f", gold:false, bomb:false},
    {name:"ゴールドレーン",   goal:20, accent:"#ffcf3a", gold:true,  bomb:false},
    {name:"ばくはつレーン",   goal:27, accent:"#ff7a4a", gold:true,  bomb:true},
    {name:"ネオンシティ",     goal:32, accent:"#7ad8ff", gold:true,  bomb:true},
    {name:"だいばくはつ！",   goal:37, accent:"#ff5aa0", gold:true,  bomb:true}
  ];
  function stageDef(){return STAGES[clamp(stage-1,0,MAXSTAGE-1)];}
  function layout(){
    topY=api.H*0.2;botY=api.H*0.92;
    laneTopW=clamp(api.W*0.16,80,150);laneBotW=clamp(api.W*0.62,300,640);
  }
  function sc(y){return lerp(0.4,1.18,clamp((y-topY)/(botY-topY),0,1));}
  function laneHalf(y){return lerp(laneTopW,laneBotW,clamp((y-topY)/(botY-topY),0,1))/2;}
  function rack(){
    pins=[];
    const def=stageDef();
    const rows=clamp(3+Math.floor(round/2),3,6);
    const cy=topY+api.H*0.06, gap=api.W*0.06; // 【軸3(a)対策】三角形の横幅を少し広げ、狙わないタップでは端まで届きにくくする
    let id=0;
    const cells=[];
    for(let r=0;r<rows;r++){
      const y=cy+r*api.H*0.045;
      const cnt=r+1;
      for(let c=0;c<cnt;c++){
        const x=api.W/2+(c-(cnt-1)/2)*gap;
        cells.push({x,y});
      }
    }
    // assign special pin types (kind: normal/gold/bomb). Keep it gentle: only a few specials.
    const goldN=def.gold?clamp(1+Math.floor(stage/2),1,3):0;
    const bombN=def.bomb?clamp(stage-2,1,2):0;
    const idx=cells.map((_,i)=>i);
    for(let i=idx.length-1;i>0;i--){const j=rint(0,i);const t=idx[i];idx[i]=idx[j];idx[j]=t;}
    const goldSet=new Set(idx.slice(0,goldN));
    const bombSet=new Set(idx.slice(goldN,goldN+bombN));
    // ① にじいろピン: ステージ2以降、低確率で1本だけ混ざる激レア(虹色に光る)
    const restForRare=idx.slice(goldN+bombN);
    let rbi=-1;
    if(stage>=2&&rint(0,11)===0){if(restForRare.length)rbi=pick(restForRare);}
    // 【軸7】壊す物のバラエティ: 2投に1回ほど、通常ピンの代わりに樽(丸くて太い・大きい)や
    // 積み木(縦2段・段ごとに崩れる)、豆ピン(通常の半分サイズ・小さい)を2〜4本混ぜる。
    // 色違いだけでなく形/大きさ/壊れ方を変え、「大きい/小さい」の対比もはっきりさせる。
    const varietyRoll=(round%2===0);
    const barrelSet=new Set(),stackSet=new Set(),beanSet=new Set();
    if(varietyRoll){
      const restForVariety=restForRare.filter(i=>i!==rbi);
      const n=Math.min(rint(2,4),restForVariety.length);
      for(let k=0;k<n;k++){
        const ci=restForVariety[k];
        const m=k%3;
        if(m===0)barrelSet.add(ci); else if(m===1)stackSet.add(ci); else beanSet.add(ci);
      }
    }
    for(let i=0;i<cells.length;i++){
      const {x,y}=cells[i];
      let kind="normal";
      if(i===rbi)kind="rainbow";
      else if(goldSet.has(i))kind="gold"; else if(bombSet.has(i))kind="bomb";
      else if(barrelSet.has(i))kind="barrel"; else if(stackSet.has(i))kind="stack"; else if(beanSet.has(i))kind="bean";
      // ② きょうのラッキー色: ふつうのピンだけ色ちがいのリボンを付ける(色は毎本ランダム)
      const hue=kind==="normal"?pick(LC).c:null;
      const tier=kind==="stack"?2:undefined;
      pins.push({x,y,bx:x,by:y,state:"stand",vx:0,vy:0,rot:0,vr:0,id:id++,sq:0,wob:rnd(0,TAU),kind,hue,blink:rnd(0,TAU),tier,tierCd:0});
    }
    pinN=pins.length;
  }
  function newBall(){ball={x:api.W/2,y:botY-10,vx:0,vy:0,state:"idle",spin:0};trail.length=0;}
  function reset(){round=1;count=0;combo=0;aiming=false;resetT=0;stage=1;stageDown=0;stageGoal=stageDef().goal;clearT=0;bigT=0;shocks=[];stageGutter=false;gutterThisBall=false;streak=0;layout();rack();newBall();}
  function knock(p,fx,fy,power){
    if(p.state!=="stand")return;
    if(p.kind==="stack"){
      if(p.tierCd>0)return;
      if((p.tier===undefined?2:p.tier)>1){
        // 【軸7】積み木: 1段目のヒットでは倒れきらず、上段だけ崩れて消える(2段階の崩落演出)
        p.tier=(p.tier===undefined?2:p.tier)-1;p.tierCd=14;p.sq=1;
        count+=1;combo++;api.setScore(count);
        api.slide(360,140,0.09,0.18,"square");api.noise(0.07,0.12,900);api.shake(2);
        for(let k=6;k>0;k--){const a2=rnd(0,TAU),sp=rnd(2,6);sparks.push({x:p.x,y:p.y-14,vx:Math.cos(a2)*sp,vy:Math.sin(a2)*sp-rnd(1,3),r:rnd(2,4),life:1,decay:rnd(0.03,0.06),col:"#f4b183"});}
        pushFloat({x:p.x,y:p.y-26,txt:"+1",col:"#ffe27a",life:0.7,vy:-1,size:20});
        return; // 下段はまだ立っている(次のヒットで最終崩落)
      }
    }
    p.state="fly";
    const a=Math.atan2(p.y-fy,p.x-fx)+rnd(-0.3,0.3);
    p.vx=Math.cos(a)*power+rnd(-1,1);p.vy=Math.sin(a)*power-rnd(2,5);p.vr=rnd(-0.5,0.5);p.sq=1;
    if(p.kind==="barrel"){
      // 【軸7】樽: 遠くへ飛ばず、その場で砕けて木片が飛ぶ(通常ピンと壊れ方を変える)
      p.vx*=0.4;p.vy*=0.5;p.vr=rnd(-1.6,1.6);
    }
    const gold=p.kind==="gold", rainbow=p.kind==="rainbow", barrel=p.kind==="barrel";
    const isLucky=p.kind==="normal"&&p.hue===lucky.c;   // ② ラッキー色ヒット
    let gain=rainbow?7:gold?3:barrel?2:1; if(isLucky)gain+=1;
    count+=gain;combo++;stageDown++;api.setScore(count);
    api.slide(420,160,0.1,0.22,"triangle");api.noise(0.08,0.16,1600);
    api.shake(2+Math.min(combo*0.5,8));
    if(combo>=2)api.hitStop(1);
    flash=Math.min(flash+(gold?0.5:0.35),1);
    let col=combo>=8?"#ff5a5a":combo>=4?"#ffb24a":"#ffe27a";
    if(gold)col="#ffe14a"; if(rainbow)col="#ffffff";
    const sN=gold?rint(10,14):rint(5,8);
    for(let k=sN;k>0;k--){const a2=rnd(0,TAU),sp=rnd(2,gold?9:7);sparks.push({x:p.x,y:p.y,vx:Math.cos(a2)*sp,vy:Math.sin(a2)*sp-rnd(0,3),r:rnd(2,gold?6:5),life:1,decay:rnd(0.025,0.05),col});}
    for(let k=rint(2,gold?6:4);k>0;k--)glints.push({x:p.x+rnd(-10,10),y:p.y+rnd(-12,4),r:rnd(4,gold?12:9),life:1,decay:rnd(0.04,0.07),rot:rnd(0,TAU)});
    if(gold){api.tone(880,0.16,"triangle",0.13);api.slide(700,1200,0.12,0.22,"square");pushFloat({x:p.x,y:p.y-20,txt:"+3",col:"#ffe14a",life:1,vy:-1.4,size:30});}
    if(rainbow)rainbowBurst(p);
    if(isLucky)luckySparkle(p);
    if(barrel)barrelBreak(p);
    if(p.kind==="bomb")explode(p);
    if(sparks.length>240)sparks.splice(0,sparks.length-240);
    if(glints.length>120)glints.splice(0,glints.length-120);
  }
  // 【軸7】樽の破壊演出: 木片が砕け散る(通常ピンの回転して飛ぶ壊れ方と区別する)
  function barrelBreak(p){
    api.slide(200,60,0.1,0.22,"sawtooth");api.noise(0.1,0.2,700);
    for(let k=12;k>0;k--){const a2=rnd(0,TAU),sp=rnd(3,9);sparks.push({x:p.x,y:p.y,vx:Math.cos(a2)*sp,vy:Math.sin(a2)*sp-rnd(1,4),r:rnd(2,5),life:1,decay:rnd(0.02,0.045),col:pick(["#a9722f","#c68a3e","#7a5222"])});}
    for(let k=4;k>0;k--)glints.push({x:p.x+rnd(-10,10),y:p.y+rnd(-10,6),r:rnd(4,8),life:1,decay:rnd(0.05,0.08),rot:rnd(0,TAU)});
  }
  // 固定バナー(にじいろ/ラッキー色/連続ストライク/パーフェクト)の現在の表示y座標。
  // 表示中(MsgT>0)のものだけ挙げる。pushFloatがこれらとも重ならないようにするために使う。
  function activeBannerYs(){
    const ys=[];
    if(rbMsgT>0)ys.push(api.H*0.2);
    if(luckyMsgT>0)ys.push(api.H*0.27);
    if(streakMsgT>0)ys.push(api.H*0.35);
    if(perfMsgT>0)ys.push(api.H*0.6);
    return ys;
  }
  // floatが同じy帯に重なって読めなくなるのを防ぐ(【軸6】): 直近0.3秒級で表示中のfloatや、
  // 表示中の固定バナー(にじいろ/ラッキー色/連続ストライク/パーフェクト)とy帯(±44px)が近ければずらす
  function pushFloat(f){
    let tries=0;
    while(tries<6 && (floats.some(o=>Math.abs(o.y-f.y)<44) || activeBannerYs().some(y=>Math.abs(y-f.y)<44))){f.y+=44;tries++;}
    floats.push(f);
  }
  // ① にじいろピン撃破: 虹の輪＋大量得点＋祝福(白飛び防止に加算は局所・短命)
  function rainbowBurst(p){
    triggerBanner("rainbow",1.4);api.boom(0.55);api.shake(12);api.hitStop(3);
    api.slide(660,1320,0.18,0.16,"triangle");api.tone(1046,0.16,"triangle",0.11);api.tone(1568,0.18,"triangle",0.09);
    flash=Math.min(flash+0.4,1);
    const RB=["#ff5a5a","#ff9a3f","#ffd23f","#7be08a","#4aa6ff","#c79aff"];
    for(let k=0;k<RB.length;k++)shocks.push({x:p.x,y:p.y,r:8+k*6,life:1,col:RB[k]});
    for(let k=22;k>0;k--){const a2=rnd(0,TAU),sp=rnd(3,10);sparks.push({x:p.x,y:p.y,vx:Math.cos(a2)*sp,vy:Math.sin(a2)*sp-rnd(0,3),r:rnd(3,7),life:1,decay:rnd(0.02,0.04),col:RB[k%RB.length]});}
    for(let k=8;k>0;k--)glints.push({x:p.x+rnd(-16,16),y:p.y+rnd(-16,8),r:rnd(6,13),life:1,decay:rnd(0.03,0.06),rot:rnd(0,TAU)});
    pushFloat({x:p.x,y:p.y-24,txt:"にじいろ！",col:"#ff8ac0",life:1.1,vy:-1.2,size:34});
  }
  // ② ラッキー色ヒット: 小さめの祝福＋頭上に星のキラッ
  function luckySparkle(p){
    if(!luckySeen){triggerBanner("lucky",1.6);luckySeen=true;}else triggerBanner("lucky",Math.max(luckyMsgT,0.6));
    api.tone(1318,0.14,"triangle",0.1);api.tone(1976,0.16,"triangle",0.07);
    pushFloat({x:p.x,y:p.y-18,txt:"ラッキー！",col:lucky.c,life:0.9,vy:-1.1,size:26});
    for(let k=6;k>0;k--)glints.push({x:p.x+rnd(-8,8),y:p.y+rnd(-14,2),r:rnd(4,8),life:1,decay:rnd(0.04,0.07),rot:rnd(0,TAU)});
  }
  // bomb pin: knocks everything nearby, big boom + shockwave ring
  function explode(p){
    api.boom(0.5);api.shake(10);api.slide(180,40,0.16,0.5,"sawtooth");api.noise(0.16,0.3,400);
    flash=Math.min(flash+0.6,1);
    shocks.push({x:p.x,y:p.y,r:10,life:1});
    for(let k=18;k>0;k--){const a2=rnd(0,TAU),sp=rnd(4,12);sparks.push({x:p.x,y:p.y,vx:Math.cos(a2)*sp,vy:Math.sin(a2)*sp-rnd(0,3),r:rnd(3,7),life:1,decay:rnd(0.02,0.04),col:"#ff8a3a"});}
    for(const q of pins){if(q.state==="stand"&&Math.hypot(q.x-p.x,q.y-p.y)<150){knock(q,p.x,p.y,11);}}
  }
  reset();
  return{
    resize:layout,
    input(px,py,type){
      if(type==="down"){
        // ④ ながれ星ひみつタップ: コイン+きらめき(減点なし・照準はしない)
        if(star&&Math.hypot(px-star.x,py-star.y)<Math.max(36,api.W*0.06)){
          count+=1;api.setScore(count);
          api.tone(1318,0.12,"triangle",0.1);api.tone(1760,0.14,"triangle",0.08);
          for(let k=8;k>0;k--)glints.push({x:star.x+rnd(-10,10),y:star.y+rnd(-10,10),r:rnd(5,11),life:1,decay:rnd(0.03,0.06),rot:rnd(0,TAU)});
          pushFloat({x:clamp(star.x,130,api.W-130),y:Math.max(star.y-14,72),txt:"+1",col:"#fff3a0",life:0.9,vy:-1,size:24});
          star=null;return;
        }
        if(ball.state==="idle"){sx=lx=px;sy=ly=py;aiming=true;}
      }
      else if(type==="move"){if(aiming){lx=px;ly=py;}}
      else if(type==="up"){
        if(aiming&&ball.state==="idle"){
          aiming=false;
          let dx=lx-sx, dy=ly-sy;
          if(dy>-20){dy=-200;dx=rnd(-170,170);} // 【軸3対策】上まで指を動かしていない=狙いを付けていないタップなので、さらに大きく左右にブレさせてラックを外しやすくする(130→170)
          else dx*=0.55; // 【軸3対策】しっかり上へスワイプした本筋の操作は、横ブレの影響を弱めて中央のレーンへ通りやすくする(狙う努力がちゃんと報われるように)
          const power=clamp(Math.hypot(dx,dy)*0.06,9,26);
          const ang=Math.atan2(dy,dx);
          ball.vx=Math.cos(ang)*power*0.5;ball.vy=-Math.abs(Math.sin(ang)*power)-6;
          ball.vx=clamp(ball.vx,-12,12);
          ball.state="roll";combo=0;gutterThisBall=false;
          api.slide(120,90,0.3,0.3,"sine");
        }
      }
    },
    frame(dt,now){
      tms+=dt;
      // 背景: 画像(ボウリング場の写真風)があればそれを使い、平坦な手描き(グラデ壁・電飾・光だまり)はスキップ
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // ステージのアクセント色を薄く重ねて面ごとの雰囲気を変える(1面はそのまま)
        if(stage>1){g.save();g.globalAlpha=0.14;g.fillStyle=stageDef().accent;g.fillRect(0,0,api.W,api.H);g.restore();}
        // 下側をほんのり暗くしてレーンと手前のボールを浮かせる
        const vg=g.createLinearGradient(0,topY,0,api.H);
        vg.addColorStop(0,"rgba(10,6,20,0)");vg.addColorStop(1,"rgba(10,6,20,0.35)");
        g.fillStyle=vg;g.fillRect(0,topY,api.W,api.H-topY);
      } else {
      // bg gradient
      const bgr=g.createLinearGradient(0,0,0,api.H);
      bgr.addColorStop(0,"#1b1426");bgr.addColorStop(0.5,"#2a2230");bgr.addColorStop(1,"#352a3c");
      g.fillStyle=bgr;g.fillRect(0,0,api.W,api.H);
      // back wall with soft glow
      const wallg=g.createLinearGradient(0,0,0,topY);
      wallg.addColorStop(0,"#1a1030");wallg.addColorStop(1,"#2c1f44");
      g.fillStyle=wallg;g.fillRect(0,0,api.W,topY);
      // slow shifting color wash on the wall (ambient)
      g.save();g.globalCompositeOperation="lighter";
      for(let i=0;i<3;i++){
        const ph=tms*0.012+i*2.1;
        const gx=api.W*(0.25+i*0.25)+Math.sin(tms*0.01+i)*api.W*0.05,gy=topY*0.42;
        const hue=0.5+0.5*Math.sin(ph);
        const r=Math.floor(lerp(90,210,hue)),gg2=Math.floor(lerp(110,90,hue)),b=Math.floor(lerp(210,200,hue));
        const gr=g.createRadialGradient(gx,gy,0,gx,gy,api.W*0.2);
        gr.addColorStop(0,"rgba("+r+","+gg2+","+b+",0.2)");gr.addColorStop(1,"rgba("+r+","+gg2+","+b+",0)");
        g.fillStyle=gr;g.fillRect(0,0,api.W,topY);}
      g.restore();
      }
      // hanging string-light bunting across the wall ※画像背景のときは絵の電飾を活かして描かない
      const bN=9;
      if(!imgBg){
      g.save();
      g.strokeStyle="rgba(20,12,30,0.5)";g.lineWidth=2;
      g.beginPath();
      for(let i=0;i<=bN;i++){const x=api.W*(i/bN),dip=Math.sin((i/bN)*Math.PI)*16;
        if(i===0)g.moveTo(x,8+dip);else g.lineTo(x,8+dip);}
      g.stroke();
      g.globalCompositeOperation="lighter";
      for(let i=0;i<=bN;i++){
        const x=api.W*(i/bN),dip=Math.sin((i/bN)*Math.PI)*16,y=8+dip;
        const tw=0.55+0.45*Math.sin(tms*0.06+i*1.3);
        const cols=["#ff7ab0","#ffd23f","#7ad8ff","#9affb0","#c79aff"];
        const c=cols[i%cols.length];
        const lg=g.createRadialGradient(x,y+6,0,x,y+6,11);
        lg.addColorStop(0,c);lg.addColorStop(1,"rgba(0,0,0,0)");
        g.globalAlpha=tw;g.fillStyle=lg;g.beginPath();g.arc(x,y+6,11,0,TAU);g.fill();
        g.globalAlpha=tw*0.9;g.fillStyle=c;g.beginPath();g.arc(x,y+6,3,0,TAU);g.fill();
      }
      g.globalAlpha=1;g.restore();
      }
      // neon "BOWL" arc sign with glow pointing down the lane
      g.save();g.globalCompositeOperation="lighter";
      const npx=api.W/2,npy=topY*0.5;
      const npulse=0.7+0.3*Math.sin(tms*0.05);
      g.shadowColor=stageDef().accent;g.shadowBlur=18*npulse;
      g.strokeStyle="rgba(255,120,190,"+(0.6*npulse)+")";g.lineWidth=6;g.lineCap="round";
      g.beginPath();g.arc(npx,npy+30,api.W*0.13,Math.PI*1.18,Math.PI*1.82);g.stroke();
      g.shadowColor="#7ad8ff";g.shadowBlur=14*npulse;
      g.strokeStyle="rgba(140,220,255,"+(0.7*npulse)+")";g.lineWidth=3;
      g.beginPath();g.arc(npx,npy+30,api.W*0.13-7,Math.PI*1.22,Math.PI*1.78);g.stroke();
      // little neon pin in the center of the arc
      g.shadowColor="#fff";g.shadowBlur=10*npulse;g.fillStyle="rgba(255,255,255,"+(0.55*npulse)+")";
      g.beginPath();g.ellipse(npx,npy,5,11,0,0,TAU);g.fill();
      g.fillStyle="rgba(255,90,120,"+(0.7*npulse)+")";g.fillRect(npx-4,npy-3,8,3);
      g.restore();
      // ① にじいろピンが立っている間は ネオンサインが虹色に脈打つ(発見のドキドキ予告)
      if(pins.some(p=>p.kind==="rainbow"&&p.state==="stand")){
        const RB=["#ff5a5a","#ffd23f","#7be08a","#4aa6ff","#c79aff"],col=RB[Math.floor(tms*0.03)%RB.length];
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.3+0.2*Math.sin(tms*0.1);
        g.strokeStyle=col;g.lineWidth=4;g.lineCap="round";
        g.beginPath();g.arc(npx,npy+30,api.W*0.13+10,Math.PI*1.15,Math.PI*1.85);g.stroke();
        g.restore();g.globalAlpha=1;
      }
      // ④ ながれ星: ときどき空を流れる。タップでコイン(ひみつ発見・減点なし)
      starT-=dt;
      if(!star&&starT<=0&&ball.state!=="roll"&&clearT<=0){
        const fromL=Math.random()<0.5;
        star={x:fromL?-20:api.W+20,y:rnd(topY*0.55,topY*0.85),vx:(fromL?1:-1)*rnd(1.4,2.4),tw:rnd(0,TAU)};
        starT=rnd(420,720);
      }
      if(star){star.x+=star.vx*dt;star.tw+=0.2*dt;if(star.x<-40||star.x>api.W+40)star=null;}
      if(star){
        const tw=0.6+0.4*Math.sin(star.tw);
        g.save();g.globalCompositeOperation="lighter";
        g.globalAlpha=0.5*tw;g.strokeStyle="#fff3c0";g.lineWidth=2.5;g.lineCap="round";
        g.beginPath();g.moveTo(star.x,star.y);g.lineTo(star.x-star.vx*10,star.y);g.stroke();
        const sr=g.createRadialGradient(star.x,star.y,0,star.x,star.y,16);
        sr.addColorStop(0,"rgba(255,246,190,"+(0.8*tw)+")");sr.addColorStop(1,"rgba(255,246,190,0)");
        g.globalAlpha=1;g.fillStyle=sr;g.beginPath();g.arc(star.x,star.y,16,0,TAU);g.fill();
        g.fillStyle="rgba(255,255,255,"+(0.9*tw)+")";g.translate(star.x,star.y);
        const r=5+tw*2;g.beginPath();g.moveTo(0,-r);g.lineTo(r*0.2,-r*0.2);g.lineTo(r,0);g.lineTo(r*0.2,r*0.2);g.lineTo(0,r);g.lineTo(-r*0.2,r*0.2);g.lineTo(-r,0);g.lineTo(-r*0.2,-r*0.2);g.closePath();g.fill();
        g.restore();g.globalAlpha=1;
      }
      // mascot scoreboard panel (top-left): cute pin face showing fallen count
      drawScoreboard();
      // stage destruction progress bar (right edge) + stage badge
      drawProgress();
      // distant ambient light pools on back wall ※画像背景のときは絵の照明があるので描かない
      if(!imgBg){
      g.save();g.globalCompositeOperation="lighter";
      for(let i=0;i<3;i++){const gx=api.W*(0.25+i*0.25),gy=topY*0.7;
        const gr=g.createRadialGradient(gx,gy,0,gx,gy,api.W*0.16);
        gr.addColorStop(0,"rgba(120,90,180,0.14)");gr.addColorStop(1,"rgba(120,90,180,0)");
        g.fillStyle=gr;g.fillRect(0,0,api.W,topY);}
      g.restore();
      }
      // drifting glow orbs (ambient, always moving)
      g.save();g.globalCompositeOperation="lighter";
      for(let i=0;i<6;i++){
        const ox=(Math.sin(tms*0.008+i*1.7)*0.5+0.5)*api.W;
        const oy=topY*(0.2+((i*0.13+tms*0.0006)%0.7));
        const oa=0.10+0.06*Math.sin(tms*0.03+i*2);
        const orr=8+i*3;
        const og2=g.createRadialGradient(ox,oy,0,ox,oy,orr);
        og2.addColorStop(0,"rgba(255,240,200,"+oa+")");og2.addColorStop(1,"rgba(255,240,200,0)");
        g.fillStyle=og2;g.beginPath();g.arc(ox,oy,orr,0,TAU);g.fill();
      }
      g.restore();
      // gutters with gradient
      const gutg=g.createLinearGradient(0,topY,0,botY);
      gutg.addColorStop(0,"#2a2433");gutg.addColorStop(1,"#453d52");
      g.fillStyle=gutg;
      g.beginPath();g.moveTo(api.W/2-laneTopW/2,topY);g.lineTo(api.W/2-laneBotW/2,botY);g.lineTo(api.W/2-laneBotW/2-30,botY);g.lineTo(api.W/2-laneTopW/2-8,topY);g.closePath();g.fill();
      g.beginPath();g.moveTo(api.W/2+laneTopW/2,topY);g.lineTo(api.W/2+laneBotW/2,botY);g.lineTo(api.W/2+laneBotW/2+30,botY);g.lineTo(api.W/2+laneTopW/2+8,topY);g.closePath();g.fill();
      // lane (perspective trapezoid) with warm wood gradient
      const laneg=g.createLinearGradient(0,topY,0,botY);
      laneg.addColorStop(0,"#b88c4e");laneg.addColorStop(0.5,"#d6ad6e");laneg.addColorStop(1,"#e9c587");
      g.fillStyle=laneg;g.beginPath();
      g.moveTo(api.W/2-laneTopW/2,topY);g.lineTo(api.W/2+laneTopW/2,topY);
      g.lineTo(api.W/2+laneBotW/2,botY);g.lineTo(api.W/2-laneBotW/2,botY);g.closePath();g.fill();
      // lane boards
      g.strokeStyle="rgba(70,40,10,.16)";g.lineWidth=2;
      for(let i=1;i<8;i++){const t=i/8;g.beginPath();
        g.moveTo(lerp(api.W/2-laneTopW/2,api.W/2-laneBotW/2,0)+t*laneTopW,topY);
        g.lineTo(api.W/2-laneBotW/2+t*laneBotW,botY);g.stroke();}
      // glossy lane shine (center sheen)
      g.save();g.globalCompositeOperation="lighter";
      const sheen=g.createLinearGradient(api.W/2-laneBotW*0.18,0,api.W/2+laneBotW*0.18,0);
      sheen.addColorStop(0,"rgba(255,255,255,0)");sheen.addColorStop(0.5,"rgba(255,248,220,0.22)");sheen.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=sheen;g.beginPath();
      g.moveTo(api.W/2-laneTopW*0.22,topY);g.lineTo(api.W/2+laneTopW*0.22,topY);
      g.lineTo(api.W/2+laneBotW*0.22,botY);g.lineTo(api.W/2-laneBotW*0.22,botY);g.closePath();g.fill();
      g.restore();
      // foul line glow
      g.save();g.globalCompositeOperation="lighter";
      g.strokeStyle="rgba(255,210,90,0.35)";g.lineWidth=3;
      g.beginPath();g.moveTo(api.W/2-laneBotW/2+8,botY-6);g.lineTo(api.W/2+laneBotW/2-8,botY-6);g.stroke();
      g.restore();
      // pins (sort by y for depth)
      const order=pins.slice().sort((a,b)=>a.y-b.y);
      // ball rolling
      if(ball.state==="roll"){
        ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.vy*=Math.pow(0.995,dt);ball.spin+=Math.abs(ball.vy)*0.04*dt;
        const half=laneHalf(ball.y);
        if(ball.x<api.W/2-half-22||ball.x>api.W/2+half+22){/* gutter, keep going slower */ball.vx*=0.9; // 【軸3対策】ガター判定の余白を広げ、狙って振った一投がガターで無駄になりにくくする
          if(!gutterThisBall){gutterThisBall=true;stageGutter=true;}}  // ③ ガター=このステージのパーフェクト判定を失う
        const bs=sc(ball.y);
        trail.push({x:ball.x,y:ball.y,r:26*bs,life:1});
        if(trail.length>14)trail.shift();
        for(const p of pins){if(p.state==="stand"){
          const rHit=p.kind==="barrel"?55*1.6:p.kind==="bean"?55*0.7:55; // 【軸3(a)対策】ボールの直撃判定を少し絞り、狙わない一投で全部倒れきらないようにする(樽は的が大きい分1.6倍、豆ピンは小さい的なので0.7倍)
          if(Math.hypot(p.x-ball.x,p.y-ball.y)<rHit){knock(p,ball.x,ball.y,Math.max(8,Math.abs(ball.vy)*1.0));}}}
        if(ball.y<topY-20||Math.abs(ball.vy)<1){ball.state="done";resetT=40;}
      }
      for(const t of trail)t.life-=0.09*dt;
      trail=trail.filter(t=>t.life>0);
      // flying pins (can knock others)
      for(const p of pins){if(p.state==="fly"){
        p.vy+=0.4*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
        if(p.sq>0)p.sq=Math.max(0,p.sq-0.06*dt);
        for(const q of pins){if(q.state==="stand"&&Math.hypot(q.x-p.x,q.y-p.y)<26){knock(q,p.x,p.y,7);}} // 【軸3(a)対策】隣のピンへの連鎖半径をさらに絞り(34→26)、1投で密集ラック全体がドミノで倒れきらないようにする
        if(p.y>api.H+60||p.y<-60||p.x<-60||p.x>api.W+60)p.state="gone";
      }}
      // ball trail (behind pins)
      g.save();g.globalCompositeOperation="lighter";
      for(const t of trail){g.globalAlpha=t.life*0.4;
        const tr=g.createRadialGradient(t.x,t.y,0,t.x,t.y,t.r*1.2);
        tr.addColorStop(0,"rgba(120,150,255,0.7)");tr.addColorStop(1,"rgba(60,80,200,0)");
        g.fillStyle=tr;g.beginPath();g.arc(t.x,t.y,t.r*1.2,0,TAU);g.fill();}
      g.globalAlpha=1;g.restore();
      // draw pins back-to-front
      for(const p of order){if(p.state==="stand"){p.wob+=0.05*dt;if(p.tierCd>0)p.tierCd-=dt;drawPin(p.x+Math.sin(p.wob)*0.4,p.y,sc(p.y),0,0,p.kind,p.blink+=0.06*dt,p.hue,p.tier);
        // ② ラッキー色のピンは頭上でときどき星がキラッ(気づけるヒント)
        if(p.kind==="normal"&&p.hue===lucky.c){const tw=0.4+0.6*Math.sin(tms*0.08+p.blink);
          if(tw>0.78){const ss=sc(p.y),ty=p.y-26*ss,r=2.6+tw*1.4;
            g.save();g.globalCompositeOperation="lighter";g.globalAlpha=(tw-0.78)*2.4;g.fillStyle="#fff";g.translate(p.x,ty);
            g.beginPath();g.moveTo(0,-r);g.lineTo(r*0.2,-r*0.2);g.lineTo(r,0);g.lineTo(r*0.2,r*0.2);g.lineTo(0,r);g.lineTo(-r*0.2,r*0.2);g.lineTo(-r,0);g.lineTo(-r*0.2,-r*0.2);g.closePath();g.fill();
            g.restore();g.globalAlpha=1;}}}}
      for(const p of order){if(p.state==="fly")drawPin(p.x,p.y,sc(p.y),p.rot,p.sq,p.kind,0,p.hue,p.tier);}
      // ball
      if(ball.state==="roll"||ball.state==="idle"||ball.state==="done"){
        const bs=sc(ball.y);drawBall(ball.x,ball.y,26*bs,ball.spin||0);
      }
      // aim guide
      if(aiming){
        g.save();g.globalCompositeOperation="lighter";
        g.strokeStyle="rgba(160,200,255,.45)";g.lineWidth=3;g.setLineDash([10,9]);g.lineDashOffset=-tms*1.2;
        g.beginPath();g.moveTo(sx,sy);g.lineTo(lx,ly);g.stroke();g.setLineDash([]);g.lineDashOffset=0;
        g.restore();
        // arrow at ball
        const dx=lx-sx,dy=Math.min(ly-sy,-1);const ang=Math.atan2(dy,dx);
        const ex=api.W/2+Math.cos(ang)*80,ey=botY-10+Math.sin(ang)*80;
        g.save();g.globalCompositeOperation="lighter";g.shadowColor="#ffd23f";g.shadowBlur=14;
        g.strokeStyle="#ffd23f";g.lineWidth=5;g.lineCap="round";
        g.beginPath();g.moveTo(api.W/2,botY-10);g.lineTo(ex,ey);g.stroke();
        // arrowhead
        g.beginPath();g.moveTo(ex,ey);g.lineTo(ex-Math.cos(ang-0.5)*16,ey-Math.sin(ang-0.5)*16);
        g.moveTo(ex,ey);g.lineTo(ex-Math.cos(ang+0.5)*16,ey-Math.sin(ang+0.5)*16);g.stroke();
        g.restore();
      }
      // sparks (additive glow)
      g.save();g.globalCompositeOperation="lighter";
      for(const s of sparks){s.vy+=0.2*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=s.decay*dt;
        g.globalAlpha=Math.max(0,s.life);
        const sr=g.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*2.2);
        sr.addColorStop(0,s.col);sr.addColorStop(1,"rgba(0,0,0,0)");
        g.fillStyle=sr;g.beginPath();g.arc(s.x,s.y,s.r*2.2,0,TAU);g.fill();}
      g.globalAlpha=1;g.restore();
      sparks=sparks.filter(s=>s.life>0);
      // shockwave rings (bomb pins + stage clear)
      g.save();g.globalCompositeOperation="lighter";
      for(const w of shocks){w.r+=8*dt;w.life-=0.03*dt;
        g.globalAlpha=Math.max(0,w.life)*0.6;
        g.strokeStyle=w.col||"rgba(255,200,120,1)";g.lineWidth=6*Math.max(0.2,w.life);
        g.beginPath();g.arc(w.x,w.y,w.r,0,TAU);g.stroke();}
      g.globalAlpha=1;g.restore();
      shocks=shocks.filter(w=>w.life>0);
      // glints (four-point sparkle stars)
      for(const gl of glints){gl.life-=gl.decay*dt;
        const a=Math.max(0,gl.life),r=gl.r*(0.6+a*0.8);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=a;g.fillStyle="rgba(255,255,255,0.95)";
        g.translate(gl.x,gl.y);g.rotate(gl.rot);
        g.beginPath();g.moveTo(0,-r);g.lineTo(r*0.18,-r*0.18);g.lineTo(r,0);g.lineTo(r*0.18,r*0.18);
        g.lineTo(0,r);g.lineTo(-r*0.18,r*0.18);g.lineTo(-r,0);g.lineTo(-r*0.18,-r*0.18);g.closePath();g.fill();
        g.restore();}
      glints=glints.filter(gl=>gl.life>0);
      // hit flash overlay
      if(flash>0){flash=Math.max(0,flash-0.08*dt);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=flash*0.25;
        g.fillStyle="#fff7d8";g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      // reset round (blocked while a stage-clear celebration is playing)
      if(ball.state==="done"&&clearT<=0){resetT-=dt;
        const downCount=pins.filter(p=>p.state!=="stand").length;
        if(resetT<=0){
          // ③ ストライク＋連続ストライク判定(ダブル/ターキー): 気づくと得する頭の使いどころ
          const strike=downCount>=pinN&&pinN>0;
          if(strike){
            streak++;count+=5;api.setScore(count);
            pushFloat({x:api.W/2,y:api.H*0.5,txt:"ストライク！",col:"#ffd23f",life:1,vy:-0.7,size:46});
            wash=1;api.shake(10);api.slide(300,800,0.06,0.5,"square");api.tone(660,0.4,"triangle",0.16);api.boom(0.55);
            if(streak>=2){streakTxt=streak>=4?"クワッド！":streak===3?"ターキー！":"ダブル！";triggerBanner("streak",1.4);
              const bonus=streak>=3?5:3;count+=bonus;api.setScore(count);
              api.tone(880,0.16,"triangle",0.12);api.tone(1320,0.18,"triangle",0.09);}
          }else streak=0;
          // stage clear check: hit the destruction goal -> celebrate + escalate
          if(stageDown>=stageGoal){
            const last=stage>=MAXSTAGE;
            clearT=last?150:96;bigT=last?1:0;wash=1;
            pushFloat({x:api.W/2,y:api.H*0.42,txt:last?"ぜんぶ こわした！":"ステージ クリア！",col:last?"#ff5aa0":"#ffd23f",life:1.4,vy:-0.5,size:last?52:42});
            // ③ パーフェクト(ノーガター)ボーナス: このステージで一度もガターしなければ +8 & 祝福
            if(!stageGutter){count+=8;api.setScore(count);triggerBanner("perfect",1.8);
              for(let k=0;k<3;k++)shocks.push({x:api.W/2,y:api.H*0.4,r:14+k*10,life:1,col:["#7be08a","#ffd23f","#4aa6ff"][k]});}
            shocks.push({x:api.W/2,y:api.H*0.45,r:20,life:1});
            api.shake(last?16:11);api.boom(last?0.7:0.55);api.slide(400,1100,0.18,0.45,"square");api.tone(784,0.4,"triangle",0.16);
          }else{
            round++;rack();newBall();
          }
        }
      }
      // stage-clear hold: count down, then advance to the (slightly harder) next stage
      if(clearT>0){clearT-=dt;
        if(clearT<=0){
          stage=stage>=MAXSTAGE?1:stage+1; // loop back but keep playing
          round=1;stageDown=0;stageGoal=stageDef().goal;bigT=0;
          stageGutter=false;gutterThisBall=false;streak=0; // 新ステージ: パーフェクト判定リセット
          rack();newBall();
        }
      }
      // combo float when big knockdown
      if(combo>=3&&ball.state==="roll"&&!floats.some(f=>f._c)){
        pushFloat({x:api.W/2,y:api.H*0.3,txt:combo+"ほんたおし！",col:combo>=8?"#ff3b3b":"#ff8c42",life:1,vy:-1,size:36,_c:1});
      }
      // 【軸6】祝福テキスト(コンボ/にじいろ/ラッキー/ストライク/パーフェクト)は、この下の
      // climax color-wash と ステージクリア演出(加算合成のフラッシュ)より必ず後で描く。
      // 先に光エフェクトを描き切ってから文字を最前面に重ねることで、演出中も文字が白飛びで消えない。
      // climax color-wash overlay (big strike celebration)
      if(wash>0){wash=Math.max(0,wash-0.02*dt);
        const a=wash;
        g.save();g.globalCompositeOperation="lighter";
        const wg=g.createRadialGradient(api.W/2,api.H*0.45,0,api.W/2,api.H*0.45,api.W*0.8);
        const hue=Math.sin(tms*0.08);
        wg.addColorStop(0,"rgba(255,"+Math.floor(180+60*hue)+",90,"+(a*0.5)+")");
        wg.addColorStop(0.6,"rgba(255,120,200,"+(a*0.28)+")");
        wg.addColorStop(1,"rgba(120,90,255,0)");
        g.fillStyle=wg;g.fillRect(0,0,api.W,api.H);
        // radiating burst rays
        g.translate(api.W/2,api.H*0.45);g.rotate(tms*0.02);
        g.globalAlpha=a*0.4;g.fillStyle="rgba(255,240,180,1)";
        for(let i=0;i<10;i++){g.rotate(TAU/10);g.beginPath();g.moveTo(0,0);
          g.lineTo(api.W*0.7,-22);g.lineTo(api.W*0.7,22);g.closePath();g.fill();}
        g.restore();g.globalAlpha=1;}
      // stage-clear celebration overlay (full-screen blessing; final stage = extra big)
      if(clearT>0){
        const big=bigT>0;
        // pulsing neon flash of the whole scene
        const pf=0.18+0.16*Math.abs(Math.sin(tms*0.12));
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=pf*(big?1.4:1);
        g.fillStyle=big?"#ff5aa0":"#ffe27a";g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;
        // confetti burst from top (cheap: reuse glints positions)
        if(rnd(0,1)<(big?0.9:0.5)){
          const cx=rnd(0,api.W);
          glints.push({x:cx,y:rnd(0,api.H*0.3),r:rnd(5,11),life:1,decay:0.03,rot:rnd(0,TAU)});
        }
        // big rays for final stage
        if(big){
          g.save();g.globalCompositeOperation="lighter";g.translate(api.W/2,api.H*0.45);g.rotate(tms*0.03);
          g.globalAlpha=0.28;g.fillStyle="rgba(255,230,160,1)";
          for(let i=0;i<12;i++){g.rotate(TAU/12);g.beginPath();g.moveTo(0,0);g.lineTo(api.W,-26);g.lineTo(api.W,26);g.closePath();g.fill();}
          g.restore();g.globalAlpha=1;
        }
      }
      // 【軸6】ここから祝福テキストを最前面に描く(上の光エフェクトの後に描くことで文字が消えないようにする)
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.014*dt;
        const a=Math.max(0,f.life);g.globalAlpha=a;
        const pop=1+(1-a)*0.12;
        g.save();g.translate(f.x,f.y);g.scale(pop,pop);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.shadowColor=f.col;g.shadowBlur=18;
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(f.txt,0,0);
        g.fillStyle=f.col;g.fillText(f.txt,0,0);
        g.restore();}
      g.globalAlpha=1;g.shadowBlur=0;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // 【軸6】優先度の低いバナーの開始待ち(bannerDelay)を消化する: 上位バナーの表示が終わったら順に立ち上げる
      for(const bn of BANNER_ORDER){
        if(bannerDelay[bn]>0){
          bannerDelay[bn]-=0.016*dt;
          if(bannerDelay[bn]<=0){startBannerNow(bn,bannerPending[bn]);bannerPending[bn]=0;bannerDelay[bn]=0;}
        }
      }
      // ① にじいろピン！ 中央上のバナー(虹色に色替わり=レアの大祝福)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,RB=["#ff5a5a","#ffd23f","#7be08a","#4aa6ff","#c79aff"],col=RB[Math.floor(tms*0.02)%RB.length];
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 38px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("にじいろピン！",0,0);
        g.fillStyle=col;g.fillText("にじいろピン！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央の小ヒント(初回だけ大きく)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.27);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+lucky.n+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(t2,0,0);
        g.fillStyle=lucky.c;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyMsgT<0)luckyMsgT=0;}
      // ③ 連続ストライク(ダブル/ターキー) バナー
      if(streakMsgT>0){streakMsgT-=0.016*dt;
        const pop=1+Math.max(0,streakMsgT-1)*1.3;
        g.save();g.translate(api.W/2,api.H*0.35);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(streakMsgT*1.4,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="#ff8c42";g.shadowBlur=14;
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(streakTxt,0,0);
        g.fillStyle="#ffd23f";g.fillText(streakTxt,0,0);
        g.restore();g.shadowBlur=0;g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(streakMsgT<0)streakMsgT=0;}
      // ③ パーフェクト(ノーガター) バナー(下寄り=クリア文字と重ねない)
      if(perfMsgT>0){perfMsgT-=0.014*dt;
        const pop=1+Math.max(0,perfMsgT-1.3)*1.3;
        g.save();g.translate(api.W/2,api.H*0.6);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(perfMsgT*1.3,0,1);g.font="900 28px 'Hiragino Maru Gothic ProN',system-ui";
        g.shadowColor="#7be08a";g.shadowBlur=14;
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("パーフェクト！ノーガター",0,0);
        g.fillStyle="#c7ffcf";g.fillText("パーフェクト！ノーガター",0,0);
        g.restore();g.shadowBlur=0;g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(perfMsgT<0)perfMsgT=0;}
      // hint (cute rounded panel)
      const ht="したから スワイプで ボールを ころがせ！";
      g.save();g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
      const hm=g.measureText(ht),hw=(hm&&hm.width)||ht.length*11,hx=api.W/2,hy=api.H-24,pad=18;
      g.beginPath();roundRect(hx-hw/2-pad,hy-18,hw+pad*2,34,17);
      g.fillStyle="rgba(40,24,60,0.62)";g.fill();
      g.lineWidth=2;g.strokeStyle="rgba(255,210,120,0.55)";g.stroke();
      g.shadowColor="#ffcf6b";g.shadowBlur=8;
      g.fillStyle="#fff3cf";g.fillText(ht,hx,hy);
      g.restore();g.textAlign="left";
      // 白飛び防止: フレーム終わりで必ず通常合成に戻す(加算エフェクトが溜まって残らないように)
      g.globalCompositeOperation="source-over";g.globalAlpha=1;g.shadowBlur=0;
    }
  };
  function roundRect(x,y,w,h,r){
    r=Math.min(r,w/2,h/2);
    g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();
  }
  function drawScoreboard(){
    // round/remaining info pill, top-center (score lives in the shared HUD)
    const down=(pins.filter(p=>p.state!=="stand").length)||0;
    g.save();
    g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="left";g.textBaseline="middle";
    const label=stageDef().name+"   のこり "+(pinN-down);
    const lm=g.measureText(label),lw=(lm&&lm.width)||label.length*9;
    const pw=lw+62,ph=42,bx=api.W/2-pw/2,by=10;
    roundRect(bx,by,pw,ph,ph/2);
    g.fillStyle="rgba(36,22,54,0.66)";g.fill();
    g.lineWidth=2.5;g.strokeStyle="rgba(255,210,120,0.5)";g.stroke();
    // mascot pin face on the left of the panel
    const mx=bx+26,my=by+ph/2;
    g.save();g.translate(mx,my);
    const bob=Math.sin(tms*0.05)*1.5;g.translate(0,bob);
    // pin body
    const pg=g.createLinearGradient(-10,0,10,0);
    pg.addColorStop(0,"#dfe3ec");pg.addColorStop(0.45,"#ffffff");pg.addColorStop(1,"#c6cbd6");
    g.fillStyle=pg;
    g.beginPath();g.moveTo(-6,-15);g.quadraticCurveTo(-11,-2,-8,9);g.quadraticCurveTo(-9,16,0,16);
    g.quadraticCurveTo(9,16,8,9);g.quadraticCurveTo(11,-2,6,-15);g.quadraticCurveTo(0,-19,-6,-15);g.closePath();g.fill();
    g.fillStyle="#e74c3c";g.fillRect(-7,-9,14,4);
    // eyes + smile
    g.fillStyle="#2a2030";
    g.beginPath();g.arc(-3.2,1,1.7,0,TAU);g.arc(3.2,1,1.7,0,TAU);g.fill();
    g.fillStyle="#fff";g.beginPath();g.arc(-2.7,0.4,0.6,0,TAU);g.arc(3.7,0.4,0.6,0,TAU);g.fill();
    g.fillStyle="rgba(255,150,160,0.6)";g.beginPath();g.arc(-5,4,2,0,TAU);g.arc(5,4,2,0,TAU);g.fill();
    g.strokeStyle="#2a2030";g.lineWidth=1.3;g.lineCap="round";
    g.beginPath();g.arc(0,4,3,0.15*Math.PI,0.85*Math.PI);g.stroke();
    g.restore();
    // text: round + remaining
    g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="left";g.textBaseline="middle";
    g.shadowColor="#ffcf6b";g.shadowBlur=6;
    g.fillStyle="#fff3cf";g.fillText(label,bx+46,by+ph/2+1);
    g.shadowBlur=0;
    g.textBaseline="alphabetic";g.textAlign="left";
    g.restore();
  }
  function drawProgress(){
    const def=stageDef();
    // vertical destruction bar on the right edge
    const bw=14,bh=api.H*0.42,bx=api.W-bw-12,by=api.H*0.5-bh/2;
    const frac=clamp(stageDown/stageGoal,0,1);
    g.save();
    // track
    roundRect(bx,by,bw,bh,bw/2);g.fillStyle="rgba(20,12,30,0.55)";g.fill();
    g.lineWidth=2;g.strokeStyle="rgba(255,210,120,0.4)";g.stroke();
    // fill (grows from bottom)
    const fh=bh*frac;
    if(fh>2){
      g.save();roundRect(bx,by,bw,bh,bw/2);g.clip();
      const fg=g.createLinearGradient(0,by+bh,0,by);
      fg.addColorStop(0,def.accent);fg.addColorStop(1,"#fff3cf");
      g.fillStyle=fg;g.fillRect(bx,by+bh-fh,bw,fh);
      // shine sweep
      g.globalCompositeOperation="lighter";g.globalAlpha=0.35+0.25*Math.sin(tms*0.08);
      g.fillStyle="#ffffff";g.fillRect(bx,by+bh-fh,bw,4);
      g.restore();
    }
    // little medal cap on top when full
    if(frac>=1){g.fillStyle="#ffd23f";g.beginPath();g.arc(bx+bw/2,by-2,7,0,TAU);g.fill();
      g.strokeStyle="#b8821a";g.lineWidth=2;g.stroke();}
    // stage badge above bar
    g.font="800 13px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
    g.shadowColor=def.accent;g.shadowBlur=6;g.fillStyle="#fff3cf";
    g.fillText("STAGE "+stage,bx+bw/2,by-22);
    g.shadowBlur=0;
    g.font="800 11px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="rgba(255,243,207,0.85)";
    g.fillText(stageDown+"/"+stageGoal,bx+bw/2,by+bh+14);
    g.textBaseline="alphabetic";g.textAlign="left";
    g.restore();
  }
  function drawPin(x,y,s,rot,sq,kind,blink,hue,tier){
    g.save();g.translate(x,y);g.rotate(rot);
    // squash & stretch on impact: wider + shorter
    const sxk=s*(1+(sq||0)*0.35),syk=s*(1-(sq||0)*0.28);
    g.scale(sxk,syk);
    // soft drop shadow
    g.fillStyle="rgba(0,0,0,.22)";g.beginPath();g.ellipse(0,18,12,4.5,0,0,TAU);g.fill();
    // 【軸7】壊す物のバラエティ: ピンとは形も大きさも違う樽/積み木/豆ピン(色替えだけでなく形状差を持たせる)
    if(kind==="barrel"){drawBarrel();g.restore();return;}
    if(kind==="stack"){drawStack(tier===undefined?2:tier);g.restore();return;}
    if(kind==="bean")g.scale(0.55,0.55); // 豆ピン: 通常ピンの半分サイズ(樽=大きい/豆ピン=小さいの対比)
    // special pin glow (gold = shiny pulse, bomb = warning red pulse)
    if(kind==="gold"||kind==="bomb"){
      g.save();g.globalCompositeOperation="lighter";
      const pul=0.5+0.5*Math.sin(blink||0);
      const gc=kind==="gold"?"rgba(255,220,90,":"rgba(255,90,60,";
      const gg=g.createRadialGradient(0,-4,0,0,-4,20);
      gg.addColorStop(0,gc+(0.4+pul*0.35)+")");gg.addColorStop(1,gc+"0)");
      g.fillStyle=gg;g.beginPath();g.arc(0,-4,20,0,TAU);g.fill();g.restore();
    }
    // ピンは全種とも手描き(生成スプライトは不良のため不採用。外形 y -26..18・幅約20)
    // body with vertical gradient + rim light (gold pins are golden, bomb pins dark)
    const bg=g.createLinearGradient(-9,0,9,0);
    if(kind==="gold"){bg.addColorStop(0,"#c8961f");bg.addColorStop(0.45,"#ffe98a");bg.addColorStop(1,"#b8821a");}
    else if(kind==="bomb"){bg.addColorStop(0,"#3a3340");bg.addColorStop(0.45,"#5b525f");bg.addColorStop(1,"#2c2632");}
    else{bg.addColorStop(0,"#d9dde6");bg.addColorStop(0.45,"#ffffff");bg.addColorStop(1,"#c2c7d2");}
    g.fillStyle=bg;
    g.beginPath();g.moveTo(-5,-22);g.quadraticCurveTo(-10,-6,-7,8);g.quadraticCurveTo(-9,18,0,18);g.quadraticCurveTo(9,18,7,8);g.quadraticCurveTo(10,-6,5,-22);g.quadraticCurveTo(0,-26,-5,-22);g.closePath();g.fill();
    // red neck stripes with glossy band
    const rg=g.createLinearGradient(0,-15,0,-9);
    if(kind==="bomb"){rg.addColorStop(0,"#ffb24a");rg.addColorStop(1,"#e07a1a");}
    else{rg.addColorStop(0,"#ff6b5e");rg.addColorStop(1,"#d6322a");}
    g.fillStyle=rg;g.fillRect(-6,-14,12,5);
    g.fillStyle=kind==="bomb"?"#ffb24a":kind==="gold"?"#fff2b0":"#e74c3c";g.fillRect(-5.5,-7,11,2.4);
    // bomb pin: little fuse spark mark on the belly
    if(kind==="bomb"){g.fillStyle="#ffd23f";g.beginPath();g.arc(0,3,2.3,0,TAU);g.fill();g.fillStyle="#ff5a3a";g.beginPath();g.arc(0,3,1.1,0,TAU);g.fill();}
    // ② ふつうのピンの色リボン(きょうのラッキー色を見分けるヒント)
    else if(kind==="rainbow"){const rc=["#ff5a5a","#ffd23f","#7be08a","#4aa6ff","#c79aff"];for(let i=0;i<rc.length;i++){g.fillStyle=rc[i];g.fillRect(-5.5,-2+i*2.1,11,2.1);}}
    else if(hue){g.fillStyle=hue;g.beginPath();g.arc(0,2.5,2.7,0,TAU);g.fill();g.fillStyle="rgba(255,255,255,.55)";g.beginPath();g.arc(-0.9,1.6,1,0,TAU);g.fill();}
    // highlight streak
    g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.ellipse(-3,-4,2,11,0.05,0,TAU);g.fill();
    // subtle ambient occlusion on right
    g.fillStyle="rgba(40,30,60,.12)";g.beginPath();g.ellipse(4.5,2,2.6,9,0,0,TAU);g.fill();
    g.restore();
  }
  // 【軸7】樽: 丸くて太い(ピンの約1.6倍)。木目の樽で、壊れ方も専用(barrelBreak)にして違いを出す
  function drawBarrel(){
    const R=15,H2=17;
    g.fillStyle="rgba(0,0,0,.18)";g.beginPath();g.ellipse(0,H2*0.95,R*0.9,4,0,0,TAU);g.fill();
    const bg=g.createLinearGradient(-R,0,R,0);
    bg.addColorStop(0,"#5e3816");bg.addColorStop(0.42,"#c9843f");bg.addColorStop(1,"#4a2c10");
    g.fillStyle=bg;
    roundRect(-R,-H2,R*2,H2*2,7);g.fill();
    // 金属の帯(上下2本)
    g.fillStyle="#8a8a92";g.fillRect(-R,-H2*0.55,R*2,4);g.fillRect(-R,H2*0.35,R*2,4);
    g.fillStyle="rgba(255,255,255,.25)";g.fillRect(-R,-H2*0.55,R*2,1.4);g.fillRect(-R,H2*0.35,R*2,1.4);
    // 縦の木目ライン
    g.strokeStyle="rgba(0,0,0,.2)";g.lineWidth=1.3;
    for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(i*R*0.5,-H2*0.85);g.lineTo(i*R*0.5,H2*0.85);g.stroke();}
    // ハイライト
    g.fillStyle="rgba(255,255,255,.3)";g.beginPath();g.ellipse(-R*0.4,-2,3,H2*0.72,0,0,TAU);g.fill();
  }
  // 【軸7】積み木: 縦2段の箱。1段目のヒットで上段(オレンジ)だけ先に崩れ、2段目のヒットで下段(青)が飛ぶ
  function drawBox(cy,w,h,top,side){
    const bg=g.createLinearGradient(-w,cy,w,cy);
    bg.addColorStop(0,side);bg.addColorStop(0.5,top);bg.addColorStop(1,side);
    g.fillStyle=bg;roundRect(-w,cy-h,w*2,h*2,4);g.fill();
    g.strokeStyle="rgba(0,0,0,.25)";g.lineWidth=1.2;g.strokeRect(-w,cy-h,w*2,h*2);
    g.fillStyle="rgba(255,255,255,.25)";g.fillRect(-w+2,cy-h+2,Math.max(0,w*2-4),3);
  }
  function drawStack(tier){
    g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(0,17,13,4,0,0,TAU);g.fill();
    drawBox(6,13,11,"#8fc4f4","#3d6fa5"); // 下段(青)
    if(tier>1)drawBox(6-11-2,11,9.5,"#f7c79a","#c47f3e"); // 上段(オレンジ・まだ崩れていない時だけ)
  }
  function drawBall(x,y,r,spin){
    // contact shadow
    g.save();g.globalAlpha=0.3;g.fillStyle="#000";g.beginPath();g.ellipse(x,y+r*0.7,r*0.95,r*0.35,0,0,TAU);g.fill();g.restore();
    // outer glow
    g.save();g.globalCompositeOperation="lighter";
    const og=g.createRadialGradient(x,y,r*0.6,x,y,r*1.5);
    og.addColorStop(0,"rgba(110,142,255,0.35)");og.addColorStop(1,"rgba(110,142,255,0)");
    g.fillStyle=og;g.beginPath();g.arc(x,y,r*1.5,0,TAU);g.fill();g.restore();
    // ボールは手描き(生成スプライトは床の残り・顔の混入で不採用)
    // body
    const grd=g.createRadialGradient(x-r*0.3,y-r*0.35,r*0.15,x,y,r);
    grd.addColorStop(0,"#9db4ff");grd.addColorStop(0.55,"#5570e6");grd.addColorStop(1,"#1f2c82");
    g.fillStyle=grd;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();
    // finger holes (rotate with spin)
    g.save();g.translate(x,y);g.rotate(spin*0.3);
    g.fillStyle="rgba(10,14,50,.55)";
    g.beginPath();g.arc(-r*0.2,-r*0.25,r*0.13,0,TAU);g.arc(r*0.1,-r*0.3,r*0.11,0,TAU);g.arc(-r*0.05,-r*0.05,r*0.1,0,TAU);g.fill();
    g.restore();
    // bright specular highlight
    g.save();g.globalCompositeOperation="lighter";
    const hl=g.createRadialGradient(x-r*0.35,y-r*0.4,0,x-r*0.35,y-r*0.4,r*0.45);
    hl.addColorStop(0,"rgba(255,255,255,0.85)");hl.addColorStop(1,"rgba(255,255,255,0)");
    g.fillStyle=hl;g.beginPath();g.arc(x-r*0.35,y-r*0.4,r*0.45,0,TAU);g.fill();g.restore();
  }
}
Engine.register("bowl", buildBowl);
