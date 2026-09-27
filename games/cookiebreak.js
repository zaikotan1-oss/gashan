function build_cookiebreak(api){
  const g=api.g;
  api.preload(["bg.jpg"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。gold/starは生成不良のため未使用(issues参照)
  let blocks=[],shards=[],sparks=[],rings=[],crumbs=[],floats=[],clouds=[],orbs=[],motes=[];
  let S,cols,rows,bx,by,tsec=0,count=0,combo=0,comboT=0,flash=0,flashHue="#fff";
  // stage progression: clear all blocks -> "ステージ クリア!" -> harder endless
  let stage=1,clearBanner=0,clearing=false,clearScale=0;
  let clearTease=""; // F) 次ステージ予告のひとこと
  let fcount=0,lastHitStop=-999; // hitStop throttle (big hits only)
  // B) FEVER TIME: gauge fills as you smash; full gauge -> 12s rainbow rampage
  let fever=0,feverGauge=0,feverBanner=0;
  // candy-land pastel palette: cookie / choco / gummy / cake colors
  const TYPES=[
    {key:"cookie",col:"#e8b873",chip:"#7a4a26"},  // クッキー (chips)
    {key:"choco", col:"#8a5a3a",chip:"#5a3420"},  // チョコ
    {key:"gummy", col:"#ff8fb3",chip:"#ff5b8a"},  // グミ(ピンク)
    {key:"gummyb",col:"#8fd0ff",chip:"#4db8ff"},  // グミ(みず)
    {key:"cake",  col:"#fff0a6",chip:"#ffd23f"},  // ケーキ(きいろ)
    {key:"mint",  col:"#a8f0c8",chip:"#5ad6a0"},  // ミント
    {key:"stick", col:"#ffd9ec",chip:"#ff5b8a"}   // 軸7対策: キャンディスティック(細長いシルエット)
  ];
  const PARTS=TYPES.map(t=>t.col);
  // A) rare GOLD cookie: 7% — glowing star cookie, big bonus + rainbow burst on break
  const GOLD={key:"gold",col:"#ffd23f",chip:"#fff7c2"};
  const RB={key:"rainbow",col:"#ff5b8a",chip:"#fff"}; // ① 激レア にじいろクッキー
  // 軸7対策: TYPESとは別枠の『おおきいアメ』(1列×2マス分の縦長の大玉。マス目1x1固定だった見た目に大小の対比を出す)
  const BIGTYPE={key:"bigcandy",col:"#ff9ecb",chip:"#ff5b9a"};
  const RAINBOW=["#ff5b8a","#ff8c42","#ffd23f","#7be08a","#4db8ff","#b58bff","#ff7bd0"];
  // ---- 隠し発見レイヤー(ハンマー/トラックと同じ思想) ----
  // ② きょうのラッキーおかし: build時に1種を秘密に選ぶ。その味を割ると小ボーナス＋頭上に星のヒント
  const FLAVNAME={cookie:"クッキー",choco:"チョコ",gummy:"ピンクグミ",gummyb:"みずいろグミ",cake:"きいろケーキ",mint:"ミント"};
  let luckyKey=pick(TYPES).key, luckySeen=false, luckyMsgT=0;
  let rbMsgT=0;                    // ① にじいろクッキー 発見バナー
  let comboKept=true, nonstopT=0;  // ③ ノンストップ クリア判定
  const mascot={x:0,y:0,r:0,wink:0,cd:0}; // ④ ひみつの おほしさま
  function pickType(){
    // 軸4対策: ステージ1はまだクリア演出に届いていないプレイヤーが多いので「発見」頻度を少し上げる
    const rbCh=stage===1?0.04:0.03, goldCh=stage===1?0.09:0.07;
    // ① 激レア にじいろクッキー(約3〜4%): 一撃で虹ドッカン＋大量得点。いつ塔に混ざるか分からない=ドキドキ発見
    if(Math.random()<rbCh) return {t:RB,hard:false,gold:false,rb:true};
    // rare gold cookie (never hard, breaks alone with fanfare)
    if(Math.random()<goldCh) return {t:GOLD,hard:false,gold:true,rb:false};
    // hard candy(2タップ)が後半に増える
    let t=pick(TYPES);
    const hardCh=clamp(0.065+0.065*(stage-1),0.065,0.45); // 7〜8歳向け: かたいキャンディの出現を約3割増やした
    const hard=stage>1&&Math.random()<hardCh;
    return {t,hard,gold:false,rb:false};
  }
  function layout(){
    by=api.H*0.16;
    const avail=api.H*0.66;
    S=clamp(Math.floor(Math.min(api.W/9,avail/9)),34,62);
    cols=clamp(Math.floor((api.W*0.78)/S),4,8);
    rows=clamp(Math.floor(avail/S),5,9);
    bx=Math.round((api.W-cols*S)/2);
    blocks.forEach(b=>{ b.tx=bx+b.col*S; b.x=b.tx; b.ty=by+b.row*S; if(b.settled)b.y=b.ty; });
    // ④ ひみつの おほしさま: 空の右上。ハロー(半径1.7r)＋上下ゆれ込みで y<56 の四隅UI帯に触れないよう床を確保
    mascot.r=Math.max(22,api.W*0.058);
    mascot.x=api.W*0.84;
    mascot.y=Math.max(api.H*0.12, mascot.r*1.7+64);
    buildBg();
  }
  function buildBg(){
    clouds=[]; for(let i=0;i<5;i++)clouds.push({x:rnd(0,api.W),y:api.H*rnd(0.06,0.3),s:rnd(0.7,1.6),sp:rnd(0.05,0.16),a:rnd(0.5,0.85),col:pick(["#fff","#ffe7f2","#fff6d6","#e8f4ff"])});
    orbs=[]; for(let i=0;i<7;i++)orbs.push({x:rnd(0,api.W),y:rnd(api.H*0.1,api.H*0.85),r:rnd(3,7),col:pick(["#ffd2f0","#fff7c2","#d7ffe6","#bfe9ff"]),ph:rnd(0,TAU),sp:rnd(0.004,0.012),amp:rnd(8,26),drift:rnd(0.02,0.07)});
    motes=[]; for(let i=0;i<20;i++)motes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(0.7,2.3),sp:rnd(0.1,0.4),tw:rnd(0,TAU)});
  }
  function fillTower(){
    blocks=[];
    comboKept=true;   // ③ ノンストップ判定を新しい塔でリセット
    layout();
    // 軸4対策: ステージ1だけ塔を小さくして、初回プレイの90秒前後で必ず「ステージ クリア！」に届くようにする
    const useRows=stage===1?clamp(rows-6,3,rows):clamp(rows-1+Math.min(stage-1,3),4,rows); // 7〜8歳向け: ステージ2以降はやや高く育つ(約3割増)
    for(let c=0;c<cols;c++){
      // jagged top: some columns shorter for a fun candy stack silhouette
      const h=useRows-(Math.random()<0.5?rint(0,2):0);
      for(let r=rows-h;r<rows;r++){
        const pt=pickType();
        blocks.push({col:c,row:r,x:bx+c*S,y:by+r*S,tx:bx+c*S,ty:by+r*S,vy:0,settled:true,
          type:pt.t,hard:pt.hard,gold:pt.gold,rb:pt.rb,hp:pt.hard?2:1,h:1,wob:rnd(0,TAU),flash:0});
      }
    }
    maybeAddBig();
  }
  // 軸7対策: 稀に(1列につき約5%)、縦に並んだ普通のおかし2マスを合体させて『おおきいアメ』(1x2マス)にする。
  // 別の列で新規生成し直すのではなく既存ブロックの合体にすることで、列ごとに独立した重力ロジックを壊さない。
  function maybeAddBig(){
    for(let c=0;c<cols;c++){
      if(Math.random()>=0.05) continue;
      const colBlocks=blocks.filter(b=>b.col===c && !b.hard && !b.gold && !b.rb && (b.h||1)===1).sort((a,z)=>a.row-z.row);
      for(let i=0;i<colBlocks.length-1;i++){
        if(colBlocks[i+1].row===colBlocks[i].row+1){
          const top=colBlocks[i], bot=colBlocks[i+1];
          top.type=BIGTYPE; top.h=2; top.hard=false; top.gold=false; top.rb=false; top.hp=1;
          const idx=blocks.indexOf(bot); if(idx>=0)blocks.splice(idx,1);
          break;
        }
      }
    }
  }
  function blockY(r){return by+r*S;}
  function applyGravity(){
    for(let c=0;c<cols;c++){
      // h(マス高さ)を考慮して並べる。h=1のときは従来と同じ挙動。
      const cb=blocks.filter(b=>b.col===c).sort((a,z)=>(z.row+((z.h||1)-1))-(a.row+((a.h||1)-1))); // bottom-up
      let target=rows-1;
      for(const b of cb){
        const h=b.h||1, newRow=target-h+1;
        if(b.row!==newRow){ b.row=newRow; b.ty=blockY(newRow); b.settled=false; }
        target=newRow-1;
      }
    }
  }
  function neighbors(b){
    return blocks.filter(o=>o!==b && o.col===b.col && Math.abs(o.row-b.row)<=1) // vertical adj
      .concat(blocks.filter(o=>o!==b && o.row===b.row && Math.abs(o.col-b.col)===1)); // horizontal adj
  }
  function blockAt(px,py){
    for(let i=blocks.length-1;i>=0;i--){const b=blocks[i];
      if(px>=b.x&&px<=b.x+S&&py>=b.y&&py<=b.y+S*(b.h||1))return b;}
    return null;
  }
  function breakOne(b,big){
    const heff=S*(b.h||1);
    const cx=b.x+S/2, cy=b.y+heff/2, col=b.type.col;
    const rr=b.gold||b.rb;   // gold と にじいろ は虹色の破片で豪華に
    // 軸7対策: 味ごとに壊れ方そのものを変える(色だけでなく物理も変える)
    const isSoft=(b.type.key==="gummy"||b.type.key==="gummyb"); // グミ: ふにゃっと潰れる(大きく少ない破片・遅い)
    const isHardBreak=(b.hard||b.type.key==="mint")&&!isSoft;    // かたいアメ: パリンと砕ける(小さく多い破片・速い)
    const isCake=b.type.key==="cake";                            // ケーキ: バーンと広く散らばる
    const isBig=b.type.key==="bigcandy";                         // 軸7対策: おおきいアメは破片も一回り大きく・多く
    // particle caps: keep 60fps even on fever flood-breaks
    const capped=shards.length>140;
    let shN,shSzLo,shSzHi,shVLo,shVHi,shDeLo,shDeHi;
    if(isSoft){ shN=capped?2:rint(3,5); shSzLo=S*0.26; shSzHi=S*0.48; shVLo=-2.5; shVHi=2.5; shDeLo=0.005; shDeHi=0.009; }
    else if(isHardBreak){ shN=capped?3:rint(8,12); shSzLo=S*0.09; shSzHi=S*0.2; shVLo=-7.5; shVHi=7.5; shDeLo=0.01; shDeHi=0.02; }
    else if(isBig){ shN=capped?3:rint(7,10); shSzLo=S*0.22; shSzHi=S*0.4; shVLo=-6; shVHi=6; shDeLo=0.008; shDeHi=0.014; }
    else{ shN=capped?2:rint(5,8); shSzLo=S*0.16; shSzHi=S*0.34; shVLo=-5; shVHi=5; shDeLo=0.006; shDeHi=0.012; }
    // 軸7対策③: ケーキは砕けるだけでなく『倒れる』動きを足す。大きめの破片1個を強く回転させて落とし、
    // 飛び散る細かい破片(下の通常処理)と混ぜて「倒れて崩れる」見え方にする。
    if(isCake) shards.push({x:cx,y:cy,vx:rnd(-1,1),vy:rnd(0.4,1.4),s:Math.max(1,S*0.7),col,
      rot:0,vr:rnd(4,5.5)*(Math.random()<0.5?-1:1),life:1,decay:0.022});
    const spN=sparks.length>160?2:(big?8:5);
    for(let i=shN;i>0;i--)shards.push({x:cx+rnd(-S*0.3,S*0.3),y:cy+rnd(-S*0.3,S*0.3),
      vx:rnd(shVLo,shVHi)+(big?rnd(-3,3):0),vy:rnd(isHardBreak?-11:-9,-2),s:Math.max(1,rnd(shSzLo,shSzHi)),col:rr?pick(RAINBOW):col,
      rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(shDeLo,shDeHi)});
    const crumbSpread=isCake?13:6;
    if(crumbs.length<90)for(let i=0;i<rint(3,5);i++)crumbs.push({x:cx+rnd(-crumbSpread,crumbSpread),y:cy+rnd(-crumbSpread,crumbSpread),
      vx:rnd(-2,2)*(isCake?2:1),vy:rnd(-3,1),r:rnd(2,4),col:b.type.chip,life:1,decay:rnd(0.012,0.02)});
    for(let i=0;i<(rr?spN+8:spN);i++){const a=rnd(0,TAU),v=rnd(2,rr?9:7);
      sparks.push({x:cx,y:cy,vx:Math.cos(a)*v,vy:Math.sin(a)*v-rnd(0,2),life:1,decay:rnd(0.02,0.04),s:rnd(1.5,3.5),
        col:rr?pick(RAINBOW):pick(["#fff7c2","#ffd2f0",col])});}
    rings.push({x:cx,y:cy,r:S*0.4,life:1,col});
    if(rr)rings.push({x:cx,y:cy,r:S*0.7,life:1,col:"#fff"});
    const idx=blocks.indexOf(b); if(idx>=0)blocks.splice(idx,1);
  }
  // 軸6対策③: 固定バナー(ラッキー/にじいろ)が出ている間は、浮遊テキストの初期xを画面中央から離して
  // 空間的な重なり自体を減らす(バナーは中央固定なので、浮遊側だけ中央±80px帯を避ける)
  function offsetFloatX(x){
    if(luckyMsgT<=0 && rbMsgT<=0) return x;
    const cx0=api.W/2, d=x-cx0;
    if(Math.abs(d)<80) return cx0+(d<0?-80:80);
    return x;
  }
  function tap(px,py){
    if(clearing)return;
    if(!blocks.length)return;
    // ④ ひみつの おほしさま: おかしに直接あたらないタップが お星さまに届いたら ウインク＋きらめき(減点なし)
    if(mascot.r>0 && mascot.cd<=0 && !blockAt(px,py) && Math.hypot(px-mascot.x,py-mascot.y)<mascot.r){
      mascot.wink=1; mascot.cd=22;
      api.tone(1318,0.1,"triangle",0.09); api.tone(1760,0.12,"triangle",0.07);
      for(let i=0;i<9;i++){const a=rnd(-TAU*0.5,0),v=rnd(2.5,6);
        sparks.push({x:mascot.x,y:mascot.y,vx:Math.cos(a)*v*0.7,vy:Math.sin(a)*v-1,life:1,decay:0.014,s:rnd(2.5,4.5),col:pick(["#ffd23f","#fff7c2","#ffd2f0"])});}
      return;
    }
    let direct=true;
    let b=blockAt(px,py);
    if(!b){
      direct=false;
      // auto-aim: 5歳児がテキトーに叩いても最寄りのおかしがこわれる(安全網。ここは絶対に残す)
      let bd=Infinity;
      for(const o of blocks){const dx=o.x+S/2-px,dy=o.y+S*(o.h||1)/2-py,d=dx*dx+dy*dy;
        if(d<bd){bd=d;b=o;}}
      if(!b){ api.tone(220,0.05,"triangle",0.05); return; }
    }
    // hard candy: first tap only cracks it (FEVER中は1発で割れる！)
    if(b.hard&&b.hp>1&&fever<=0){
      b.hp--; b.flash=1;
      api.noise(0.08,0.2,2400,"highpass"); api.tone(300,0.07,"square",0.08); api.shake(4);
      flash=Math.min(1,flash+0.16);
      const cx=b.x+S/2,cy=b.y+S/2;
      rings.push({x:cx,y:cy,r:S*0.3,life:1,col:"#fff"});
      for(let i=0;i<4;i++){const a=rnd(0,TAU),v=rnd(2,5);
        sparks.push({x:cx,y:cy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,decay:0.03,s:rnd(1.5,3),col:"#fff7c2"});}
      return;
    }
    // chain break: this block + adjacent blocks of the SAME flavor (one ripple)
    // FEVER中: 同じ味の「つながり全部」がまとめて弾ける(flood-fill)
    const sameKey=b.type.key;
    const chain=[b];
    if(fever>0){
      // 軸3対策①: フィーバー中でも同色連鎖の一括破壊に上限を付け、乱打が無条件で大量得点にならないようにする
      const seen=new Set([b]);
      const q=[b];
      while(q.length && chain.length<5){
        const cur=q.pop();
        for(const n of neighbors(cur)){
          if(chain.length>=5) break;
          if(!seen.has(n)&&n.type.key===sameKey){seen.add(n);chain.push(n);q.push(n);}
        }
      }
    }else if(direct){
      // 軸3対策: 同色連鎖は「的を直接タップした」時だけ。自動吸着で選ばれた時は単体1個のみ割る
      for(const n of neighbors(b)){
        if(n.type.key===sameKey && !(n.hard&&n.hp>1)) chain.push(n);
      }
    }
    flashHue=b.type.col;
    const cx=b.x+S/2,cy=b.y+S*(b.h||1)/2;
    const goldN=chain.filter(o=>o.gold).length;
    const rbN=chain.filter(o=>o.rb).length;                           // ① にじいろ
    const isLucky=b.type.key===luckyKey && !b.gold && !b.rb;          // ② ラッキーおかし
    chain.forEach((blk,i)=>breakOne(blk,i===0));
    applyGravity();
    let gained=chain.length+goldN*5+rbN*10;  // gold=+5, にじいろ=+10
    if(isLucky)gained+=1;                     // ② ラッキーおかし: 小さめボーナス
    // 軸3対策③: フィーバー中の2倍ボーナスは「まとまりを割った時」だけにし、単体1個割りは等倍のままにする
    if(fever>0 && chain.length>=2)gained*=2;
    count+=gained; api.setScore(count);
    // fever gauge: breaks fill it, gold/にじいろ fills it a LOT
    if(fever<=0){
      // 軸3対策②: 連鎖なしの単発ヒットのゲージ加算をさらに下げ、90秒中にフィーバーへ複数回届きにくくする
      const baseGain=chain.length>1?chain.length*0.055:0.016;
      feverGauge=clamp(feverGauge+baseGain+goldN*0.3+rbN*0.5,0,1);
      if(feverGauge>=1)startFever();
    }
    if(goldN>0){
      // gold fanfare: rising arpeggio + big float
      [0,4,7,12].forEach((semi,i)=>setTimeout(()=>{try{api.tone(659*Math.pow(2,semi/12),0.14,"triangle",0.13);}catch(e){}},i*60));
      floats.push({x:cx,y:cy-34,txt:"ゴールド！ +"+(goldN*5),life:1,vy:-0.9,col:"#ffd23f",size:34});
      flash=Math.min(1,flash+0.4); flashHue="#ffd23f";
    }
    // ① にじいろクッキー撃破: 虹の輪＋虹きらめき＋ファンファーレ＋大量得点
    if(rbN>0){
      rbMsgT=1.4; flash=Math.min(1,flash+0.34); flashHue="#ff5b8a";
      api.boom(0.6); api.shake(14);
      [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>{try{api.tone(659*Math.pow(2,semi/12),0.13,"triangle",0.1);}catch(e){}},i*55));
      floats.push({x:cx,y:cy-54,txt:"にじいろ！ +"+(rbN*10),life:1,vy:-0.9,col:"#ff5b8a",size:38});
      for(let i=0;i<20&&sparks.length<180;i++){const a=rnd(0,TAU),v=rnd(3,10);
        sparks.push({x:cx,y:cy,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,life:1,decay:rnd(0.012,0.02),s:rnd(2,5),col:pick(RAINBOW)});}
      for(let k=0;k<RAINBOW.length;k++)rings.push({x:cx,y:cy,r:S*(0.3+k*0.12),life:1,col:RAINBOW[k]});
    }
    // ② きょうのラッキーおかし命中: 小さな祝福(白飛びしないよう控えめ)＋初回だけ中央に教示
    if(isLucky){
      luckyMsgT=luckySeen?Math.max(luckyMsgT,0.7):1.6; luckySeen=true;
      api.tone(1046,0.14,"triangle",0.1); api.tone(1568,0.16,"triangle",0.08);
      floats.push({x:offsetFloatX(cx),y:cy-40,txt:"ラッキー！",life:1,vy:-0.9,col:b.type.chip,size:26});
      for(let i=0;i<7;i++){const a=rnd(-TAU*0.5,0),v=rnd(2,5);
        sparks.push({x:cx,y:cy,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1.5,life:1,decay:0.03,s:rnd(2,3.5),col:"#fff7c2"});}
    }
    combo++; comboT=0.9;
    // juice scaled by chain size
    flash=Math.min(1,flash+0.3+gained*0.06);
    api.boom(clamp(0.3+gained*0.08,0.3,0.7));
    api.slide(380-Math.min(combo*8,120),120,0.14,0.3,"sine");
    api.noise(0.12,0.22,1600,"bandpass",0.9);
    api.tone(440*Math.pow(2,clamp(combo,0,12)/12),0.12,"triangle",0.1);
    api.shake(5+gained*1.5);
    // hitStop is reserved for the rare BIG hit (3+ chain / combo milestones), throttled
    if((gained>=3||combo===5||combo===10)&&fcount-lastHitStop>=30){
      api.hitStop(3); lastHitStop=fcount;
    }
    // 軸6対策②: combo2〜4の色はラッキー/ケーキ祝福と同じ黄(#ffd23f)を避け、桃系にして衝突を減らす
    if(combo>1)floats.push({x:offsetFloatX(cx),y:cy-18,txt:"x"+combo,life:1,vy:-1.1,
      col:combo>=8?"#ff5bd0":combo>=5?"#ff8c42":"#ffb0e0",size:combo>=5?40:30});
    if(gained>=3)floats.push({x:cx,y:cy-50,txt:"バキバキ！",life:1,vy:-0.7,col:"#ff7bd0",size:24});
    if(blocks.length===0)doClear();
  }
  function startFever(){
    fever=12; feverGauge=0; feverBanner=2;
    flash=1; flashHue="#ff5bd0";
    api.boom(0.7); api.shake(18);
    api.slide(392,1568,0.5,0.3,"triangle");
    [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>{try{api.tone(523*Math.pow(2,semi/12),0.14,"square",0.08);}catch(e){}},i*70));
    if(fcount-lastHitStop>=30){ api.hitStop(4); lastHitStop=fcount; }
    // burst of rainbow sparks from center
    for(let i=0;i<24&&sparks.length<180;i++){const a=rnd(0,TAU),v=rnd(3,10);
      sparks.push({x:api.W/2,y:api.H*0.45,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,life:1,decay:rnd(0.012,0.02),s:rnd(2,5),col:pick(RAINBOW)});}
  }
  function doClear(){
    if(clearing)return; clearing=true;
    // ③ ノンストップ クリア: コンボを一度も切らさず塔を割り切ったら +5 & 祝福(考えどころ=手を止めず一気に)
    if(comboKept){ count+=5; api.setScore(count); nonstopT=1.9;
      floats.push({x:api.W/2,y:api.H*0.3,txt:"ノンストップ！ ＋5",life:1,vy:-0.6,col:"#7be08a",size:34});
      for(let i=0;i<16&&sparks.length<180;i++){const a=rnd(0,TAU),v=rnd(3,8);
        sparks.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,life:1,decay:rnd(0.012,0.02),s:rnd(2,5),col:"#7be08a"});}
      api.tone(1318,0.14,"triangle",0.1); setTimeout(()=>{try{api.tone(1976,0.16,"triangle",0.08);}catch(e){}},120);
    }
    // F) next-stage tease: pick a hint that matches what's actually coming
    if(feverGauge>0.65) clearTease="フィーバーまで もうすこし！";
    else if(stage===1) clearTease="つぎは かたい キャンディが でてくる！";
    else clearTease=pick([
      "つぎは かたい キャンディが ふえる！",
      "ゴールドクッキーを さがしてね！",
      "ゴールドを わると フィーバーが ちかづく！"]);
    clearBanner=1.8; clearScale=0; flash=1; flashHue="#ffd23f";
    combo=0; comboT=0;
    api.boom(0.6); api.shake(20);
    api.slide(523,1046,0.4,0.22,"triangle");
    setTimeout(()=>{ try{api.tone(784,0.18,"triangle",0.16);}catch(e){} },120);
    setTimeout(()=>{ try{api.tone(1046,0.3,"triangle",0.14);}catch(e){} },260);
    // celebratory crumb burst
    for(let i=0;i<22;i++){const a=rnd(0,TAU),v=rnd(3,9);
      sparks.push({x:api.W/2,y:api.H*0.42,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,life:1,decay:rnd(0.012,0.02),s:rnd(2,5),col:pick(PARTS)});}
    setTimeout(()=>{ stage++; fillTower(); clearing=false; },560);
  }
  layout();
  fillTower();
  return {
    resize:layout,
    input(x,y,type){ if(type!=="down")return; tap(x,y); },
    frame(dt,now){
      tsec+=0.016*dt; fcount++;
      // ④ ひみつの おほしさま: クールダウン/ウインクの減衰
      if(mascot.cd>0)mascot.cd-=dt;
      if(mascot.wink>0){mascot.wink-=0.02*dt; if(mascot.wink<0)mascot.wink=0;}
      // fever countdown (ends with a soft chime + float)
      if(fever>0){
        fever-=0.016*dt;
        if(fever<=0){ fever=0;
          api.tone(660,0.15,"triangle",0.1);
          setTimeout(()=>{try{api.tone(440,0.2,"triangle",0.09);}catch(e){}},130);
          floats.push({x:api.W/2,y:api.H*0.3,txt:"フィーバー おわり",life:1,vy:-0.5,col:"#fff",size:24});
        }
      }
      // ---- background: image cover(candy-land) + fallback candy sky gradient (fever = rainbow disco sky!) ----
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // フィーバー中は虹色ディスコの薄いオーバーレイを絵の上に重ねる(絵でも切替が分かるように)
        if(fever>0){
          g.save(); g.globalAlpha=0.3;
          const hu=(tsec*90)%360;
          let ovg=g.createLinearGradient(0,0,0,api.H);
          ovg.addColorStop(0,"hsl("+hu+",85%,80%)");
          ovg.addColorStop(0.5,"hsl("+((hu+60)%360)+",85%,78%)");
          ovg.addColorStop(1,"hsl("+((hu+120)%360)+",85%,80%)");
          g.fillStyle=ovg; g.fillRect(0,0,api.W,api.H); g.restore();
        }
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        if(fever>0){
          const hu=(tsec*90)%360;
          grd.addColorStop(0,"hsl("+hu+",85%,80%)");
          grd.addColorStop(0.5,"hsl("+((hu+60)%360)+",85%,78%)");
          grd.addColorStop(1,"hsl("+((hu+120)%360)+",85%,80%)");
        }else{
          grd.addColorStop(0,"#ffe3f2"); grd.addColorStop(0.4,"#ffd6ec");
          grd.addColorStop(0.7,"#d8e4ff"); grd.addColorStop(1,"#c8f0e0");
        }
        g.fillStyle=grd; g.fillRect(0,0,api.W,api.H);
      }
      // fever ambient: rainbow confetti sparks raining
      if(fever>0&&sparks.length<120&&Math.random()<0.5){
        sparks.push({x:rnd(0,api.W),y:-6,vx:rnd(-1,1),vy:rnd(1,3),life:1,decay:rnd(0.008,0.014),s:rnd(2,4),col:pick(RAINBOW)});
      }
      // soft top glow
      let glow=g.createRadialGradient(api.W*0.5,api.H*0.08,0,api.W*0.5,api.H*0.08,api.W*0.7);
      glow.addColorStop(0,"rgba(255,255,235,.3)"); glow.addColorStop(1,"rgba(255,255,235,0)");
      g.fillStyle=glow; g.fillRect(0,0,api.W,api.H);
      // floating sweet clouds (cotton-candy puffs) ※画像背景のときは絵に雲があるので描かない
      if(!imgBg) for(const c of clouds){
        c.x+=c.sp*dt; if(c.x>api.W+90*c.s)c.x=-90*c.s;
        g.save(); g.globalAlpha=c.a; g.fillStyle=c.col;
        const w=44*c.s;
        g.beginPath();
        g.ellipse(c.x,c.y,w,w*0.6,0,0,TAU);
        g.ellipse(c.x+w*0.8,c.y+w*0.12,w*0.7,w*0.45,0,0,TAU);
        g.ellipse(c.x-w*0.8,c.y+w*0.14,w*0.62,w*0.4,0,0,TAU);
        g.fill(); g.restore();
      }
      g.globalAlpha=1;
      // floating glow candy orbs (additive)
      g.save(); g.globalCompositeOperation="lighter";
      for(const o of orbs){
        o.ph+=o.sp*dt; o.x+=o.drift*dt; if(o.x>api.W+10)o.x=-10;
        const oy=o.y+Math.sin(o.ph)*o.amp, pr=0.6+Math.sin(o.ph*1.7)*0.4;
        const og=g.createRadialGradient(o.x,oy,0,o.x,oy,o.r*5);
        og.addColorStop(0,o.col); og.addColorStop(0.4,"rgba(255,255,255,0)");
        g.globalAlpha=0.4*pr; g.fillStyle=og; g.beginPath(); g.arc(o.x,oy,o.r*5,0,TAU); g.fill();
        g.globalAlpha=0.85*pr; g.fillStyle=o.col; g.beginPath(); g.arc(o.x,oy,o.r,0,TAU); g.fill();
      }
      g.restore(); g.globalAlpha=1;
      // twinkling sugar motes
      g.fillStyle="#ffffff";
      for(const m of motes){
        m.x+=m.sp*0.4*dt; m.y-=m.sp*0.18*dt; m.tw+=0.05*dt;
        if(m.x>api.W)m.x=0; if(m.y<0)m.y=api.H;
        g.globalAlpha=0.12+0.12*(0.5+0.5*Math.sin(m.tw));
        g.beginPath(); g.arc(m.x,m.y,m.r,0,TAU); g.fill();
      }
      g.globalAlpha=1;
      // ④ ひみつの おほしさま(空の右上・塔の上)
      drawMascot();
      // ---- shockwave rings (glowing) ----
      g.save(); g.globalCompositeOperation="lighter";
      for(const ri of rings){ ri.r+=(S*2.0-ri.r)*0.18*dt; ri.life-=0.05*dt;
        const rl=Math.max(0,ri.life); g.globalAlpha=rl*0.7; g.lineWidth=Math.max(1,5*ri.life);
        g.strokeStyle=ri.col; g.shadowBlur=12*rl; g.shadowColor=ri.col;
        g.beginPath(); g.arc(ri.x,ri.y,ri.r,0,TAU); g.stroke(); }
      g.restore(); g.shadowBlur=0; g.globalAlpha=1; g.lineWidth=1;
      rings=rings.filter(ri=>ri.life>0);
      // ---- blocks (settle with gravity bounce) ----
      for(const b of blocks){
        if(b.flash>0)b.flash-=0.08*dt;
        if(!b.settled){ b.vy+=0.9*dt; b.y+=b.vy*dt;
          if(b.y>=b.ty){ b.y=b.ty;
            if(Math.abs(b.vy)>4){ b.vy*=-0.28; if(Math.abs(b.vy)<3){ b.vy=0; b.settled=true; } }
            else{ b.vy=0; b.settled=true; } } }
        b.wob+=0.05*dt;
        drawCandy(b);
      }
      // ---- shards (candy chunks) ----
      const groundY=api.H*0.97;
      for(const p of shards){ p.vy+=0.55*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt;
        if(p.y>groundY){ p.y=groundY; p.vy*=-0.4; p.vx*=0.7; if(Math.abs(p.vy)<1.2)p.life-=0.04*dt; }
        p.life-=p.decay*dt;
        g.save(); g.globalAlpha=Math.max(0,p.life); g.translate(p.x,p.y); g.rotate(p.rot);
        g.fillStyle=p.col; roundRect(-p.s/2,-p.s/2,p.s,p.s,p.s*0.28); g.fill();
        g.fillStyle="rgba(255,255,255,.4)"; roundRect(-p.s/2,-p.s/2,p.s*0.5,p.s*0.5,p.s*0.18); g.fill();
        g.restore(); }
      g.globalAlpha=1; shards=shards.filter(p=>p.life>0);
      // ---- crumbs (small bits) ----
      for(const c of crumbs){ c.vy+=0.4*dt; c.x+=c.vx*dt; c.y+=c.vy*dt; c.life-=c.decay*dt;
        g.globalAlpha=Math.max(0,c.life); g.fillStyle=c.col;
        g.beginPath(); g.arc(c.x,c.y,c.r,0,TAU); g.fill(); }
      g.globalAlpha=1; crumbs=crumbs.filter(c=>c.life>0);
      // ---- glowing sparks ----
      g.save(); g.globalCompositeOperation="lighter";
      for(const s of sparks){ s.vy+=0.18*dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=s.decay*dt;
        const a=Math.max(0,s.life); g.globalAlpha=a; g.fillStyle=s.col; g.shadowBlur=8; g.shadowColor=s.col;
        g.beginPath(); g.arc(s.x,s.y,s.s*a+0.5,0,TAU); g.fill(); }
      g.restore(); g.shadowBlur=0; g.globalAlpha=1;
      sparks=sparks.filter(s=>s.life>0);
      // ---- floating combo / bakibaki texts ----
      if(combo>0){ comboT-=0.016*dt; if(comboT<=0){combo=0; comboKept=false;} } // ③ コンボ切れ=ノンストップ失敗
      for(const f of floats){ f.y+=f.vy*dt; f.life-=0.018*dt;
        g.save(); g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.lineWidth=6; g.lineJoin="round"; g.strokeStyle="rgba(120,60,90,.5)"; g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col; g.fillText(f.txt,f.x,f.y);
        g.restore(); }
      g.globalAlpha=1; g.textAlign="left"; g.lineJoin="miter";
      floats=floats.filter(f=>f.life>0);
      // ---- impact flash ----
      if(flash>0){ flash-=0.06*dt; const fa=Math.max(0,flash);
        g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=fa*0.3;
        g.fillStyle=flashHue; g.fillRect(0,0,api.W,api.H);
        g.globalAlpha=fa*0.16; g.fillStyle="#fff"; g.fillRect(0,0,api.W,api.H);
        g.restore(); g.globalAlpha=1; }
      // ---- HUD: stage + remaining (top center) ----
      g.save(); g.textAlign="center";
      g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";
      g.lineWidth=5; g.lineJoin="round"; g.strokeStyle="rgba(120,60,90,.45)";
      const hud="ステージ "+stage+"      のこり "+blocks.length;
      g.strokeText(hud,api.W/2,api.H*0.06);
      g.fillStyle="#fff"; g.fillText(hud,api.W/2,api.H*0.06);
      g.restore(); g.textAlign="left"; g.lineJoin="miter";
      // ---- combo big text (top center band) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save(); g.translate(api.W/2,api.H*0.115); g.scale(pop,pop);
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1);
        g.shadowColor="rgba(255,140,200,.8)"; g.shadowBlur=14;
        g.fillStyle="#ff5bd0"; g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(255,255,255,.7)"; g.strokeText("コンボ x"+combo,0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left";
      }
      // ---- FEVER gauge bar (bottom center) ----
      {
        const bw=Math.min(api.W*0.5,220),bxg=(api.W-bw)/2,byg=api.H-26,bh=13;
        g.save();
        g.fillStyle="rgba(90,42,68,.5)"; roundRect(bxg-4,byg-3,bw+8,bh+6,(bh+6)/2); g.fill();
        g.lineWidth=2; g.strokeStyle="rgba(255,255,255,.4)"; roundRect(bxg-4,byg-3,bw+8,bh+6,(bh+6)/2); g.stroke();
        const fr=fever>0?clamp(fever/12,0,1):feverGauge;
        if(fr>0.02){
          let pg=g.createLinearGradient(bxg,0,bxg+bw,0);
          if(fever>0){ RAINBOW.forEach((c,i)=>pg.addColorStop(i/(RAINBOW.length-1),c)); }
          else{ pg.addColorStop(0,"#ff8fb3"); pg.addColorStop(1,"#ff5bd0"); }
          if(fever>0||feverGauge>0.8){ g.shadowBlur=12+6*Math.sin(tsec*8); g.shadowColor="#ff5bd0"; }
          g.fillStyle=pg; roundRect(bxg,byg,bw*fr,bh,bh/2); g.fill(); g.shadowBlur=0;
        }
        g.font="800 13px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.lineWidth=4; g.lineJoin="round"; g.strokeStyle="rgba(90,42,68,.55)";
        const lbl=fever>0?"フィーバー ちゅう！！":feverGauge>0.8?"もうすこしで フィーバー！":"フィーバー";
        g.strokeText(lbl,api.W/2,byg-6);
        g.fillStyle=fever>0?"#fff":"#fff0f8"; g.fillText(lbl,api.W/2,byg-6);
        g.restore(); g.textAlign="left"; g.lineJoin="miter";
      }
      // ---- FEVER start banner ----
      if(feverBanner>0){ feverBanner=Math.max(0,feverBanner-0.016*dt);
        const a=clamp(feverBanner,0,1),pop=1+0.12*Math.sin(tsec*11);
        g.save(); g.translate(api.W/2,api.H*0.36); g.scale(pop,pop); g.globalAlpha=a;
        g.textAlign="center"; g.font="900 52px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=11; g.lineJoin="round"; g.strokeStyle="rgba(120,20,80,.75)";
        g.strokeText("フィーバー！！",0,0);
        let fg=g.createLinearGradient(-140,0,140,0);
        RAINBOW.forEach((c,i)=>fg.addColorStop(i/(RAINBOW.length-1),c));
        g.fillStyle=fg; g.fillText("フィーバー！！",0,0);
        g.font="800 20px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#fff";
        g.fillText("ぜんぶ 1ぱつ！ てんすう 2ばい！",0,36);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; g.lineJoin="miter";
      }
      // ---- STAGE CLEAR banner ----
      if(clearBanner>0){ clearBanner=Math.max(0,clearBanner-0.016*dt);
        clearScale=Math.min(1,clearScale+0.12*dt);
        const a=clamp(clearBanner*1.5,0,1), pop=ease(clearScale)*(1+0.06*Math.sin(tsec*9));
        g.save(); g.globalAlpha=a*0.4; g.fillStyle="#5a2a44"; g.fillRect(0,api.H*0.34,api.W,api.H*0.2); g.restore();
        g.save(); g.translate(api.W/2,api.H*0.44); g.scale(pop,pop); g.globalAlpha=a;
        g.textAlign="center"; g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=10; g.lineJoin="round"; g.strokeStyle="rgba(120,50,80,.7)";
        g.strokeText("ステージ クリア！",0,0);
        let bg=g.createLinearGradient(0,-30,0,34);
        bg.addColorStop(0,"#fff2a0"); bg.addColorStop(0.5,"#ffd23f"); bg.addColorStop(1,"#ff8fb3");
        g.fillStyle=bg; g.fillText("ステージ クリア！",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#fff";
        g.fillText("つぎは ステージ "+(stage+1),0,40);
        if(clearTease){
          g.font="800 17px 'Hiragino Maru Gothic ProN',system-ui";
          g.lineWidth=5; g.strokeStyle="rgba(120,50,80,.6)";
          g.strokeText(clearTease,0,70);
          g.fillStyle="#fff2a0"; g.fillText(clearTease,0,70);
        }
        g.restore(); g.globalAlpha=1; g.textAlign="left"; g.lineJoin="miter";
      }
      // ① にじいろクッキー！ 発見バナー(虹色に色替わり・上部中央=HUD安全帯)
      if(rbMsgT>0){ rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3, col=RAINBOW[Math.floor(tsec*6)%RAINBOW.length];
        // 軸6対策①: 後ろを浮遊するコンボ数字等と重なっても読めるよう、clearBannerと同様の半透明バンドを敷く
        g.save(); g.globalAlpha=clamp(rbMsgT*1.4,0,1)*0.4; g.fillStyle="#5a2a44"; g.fillRect(0,api.H*0.2-34,api.W,68); g.restore();
        g.save(); g.translate(api.W/2,api.H*0.2); g.scale(pop,pop); g.textAlign="center"; g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1); g.font="900 38px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7; g.lineJoin="round"; g.strokeStyle="rgba(90,30,60,.5)"; g.strokeText("にじいろクッキー！",0,0);
        g.fillStyle=col; g.fillText("にじいろクッキー！",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; g.textBaseline="alphabetic"; g.lineJoin="miter"; if(rbMsgT<0)rbMsgT=0; }
      // ② きょうのラッキーおかし はっけん！ 中央の小ヒント(初回だけ大きく)
      if(luckyMsgT>0){ luckyMsgT-=0.016*dt;
        // 軸6対策①: 半透明バンドで背後の浮遊テキストと重なっても文字がにじまないようにする
        g.save(); g.globalAlpha=clamp(luckyMsgT*1.3,0,1)*0.4; g.fillStyle="#5a2a44"; g.fillRect(0,api.H*0.28-28,api.W,56); g.restore();
        g.save(); g.translate(api.W/2,api.H*0.28); g.textAlign="center"; g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1); g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキーは "+(FLAVNAME[luckyKey]||"")+"！";
        g.lineWidth=5; g.lineJoin="round"; g.strokeStyle="rgba(90,40,60,.45)"; g.strokeText(t2,0,0);
        g.fillStyle="#fff2a0"; g.fillText(t2,0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; g.textBaseline="alphabetic"; g.lineJoin="miter"; if(luckyMsgT<0)luckyMsgT=0; }
      // ③ ノンストップ ボーナス！ バナー(クリア文字の下=重ねない)
      if(nonstopT>0){ nonstopT-=0.014*dt;
        const pop=1+Math.max(0,nonstopT-1.3)*1.3;
        // 軸6対策①: 半透明バンドで背後の浮遊テキストと重なっても文字がにじまないようにする
        g.save(); g.globalAlpha=clamp(nonstopT*1.3,0,1)*0.4; g.fillStyle="#1a4a2a"; g.fillRect(0,api.H*0.6-32,api.W,64); g.restore();
        g.save(); g.translate(api.W/2,api.H*0.6); g.scale(pop,pop); g.textAlign="center"; g.textBaseline="middle";
        g.globalAlpha=clamp(nonstopT*1.3,0,1); g.font="900 28px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=6; g.lineJoin="round"; g.strokeStyle="rgba(40,110,60,.6)"; g.strokeText("ノンストップ ボーナス！",0,0);
        g.fillStyle="#c7ffcf"; g.fillText("ノンストップ ボーナス！",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; g.textBaseline="alphabetic"; g.lineJoin="miter"; if(nonstopT<0)nonstopT=0; }
      // 白飛び防止: フレーム終わりに加算合成を必ず source-over へ戻す(光を溜めない)
      g.globalCompositeOperation="source-over"; g.globalAlpha=1;
    },
    stop(){}
  };
  function drawCandy(b){
    const x=b.x,y=b.y,s=S,t=b.type;
    const heff=S*(b.h||1); // 軸7対策: おおきいアメ(h=2)は縦に2マス分の高さで描く
    // gold.png は生成が「単体物」にならず(複数クッキーの模様)不採用。手描きのみ使用(issues参照)。
    const useGoldImg=false;
    // 軸7対策: 味ごとに輪郭そのものを変える(全部おなじ角丸正方形にしない)
    const isJelly=(t.key==="gummy"||t.key==="gummyb"); // 丸いジェリー玉
    const isRoundCandy=t.key==="mint";                 // 丸い飴玉
    const isBig=t.key==="bigcandy";                    // おおきい丸玉(1x2マス)
    const isStick=t.key==="stick";                     // 細長いキャンディスティック
    function bodyPath(px,py,pw,ph,inset){
      if(isJelly) g.ellipse(px+pw/2,py+ph/2,Math.max(0,pw*0.46),Math.max(0,ph*0.42),0,0,TAU);
      else if(isRoundCandy) g.arc(px+pw/2,py+ph/2,Math.max(0,pw*0.44),0,TAU);
      else if(isBig) g.arc(px+pw/2,py+ph/2,Math.max(0,Math.min(pw,ph)*0.46),0,TAU);
      else if(isStick) roundRect(px+pw*0.3,py+inset*0.5,pw*0.4,ph-inset,pw*0.2);
      else roundRect(px+inset,py+inset,pw-2*inset,ph-2*inset,pw*0.28);
    }
    // soft drop shadow
    g.fillStyle="rgba(120,70,90,.18)"; g.beginPath(); bodyPath(x+3,y+4,s,heff,0); g.fill();
    if(!useGoldImg){
      // body ※画像ゴールドの時は絵と喧嘩する形は描かない
      let bg=g.createLinearGradient(x,y,x+s*0.4,y+heff);
      bg.addColorStop(0,lighten(t.col,55)); bg.addColorStop(0.55,t.col); bg.addColorStop(1,shade(t.col,-28));
      g.fillStyle=bg; g.beginPath(); bodyPath(x,y,s,heff,1); g.fill();
      // glossy top sheen
      g.save(); g.beginPath(); bodyPath(x,y,s,heff,1); g.clip();
      g.fillStyle="rgba(255,255,255,.4)";
      g.beginPath(); g.ellipse(x+s*0.32,y+s*0.26,Math.max(0,s*0.26),Math.max(0,s*0.13),-0.5,0,TAU); g.fill();
      g.restore();
    }
    // per-flavor decoration
    if(b.rb){
      // ① にじいろクッキー: 虹のストライプ＋回る星＋脈打つ光。塔の中でひときわ目立つ=発見しやすい
      const pl=0.6+0.4*Math.sin(tsec*5+b.wob);
      g.save(); g.globalCompositeOperation="lighter";
      const gr=Math.max(0,s*0.95);
      let rg2=g.createRadialGradient(x+s/2,y+s/2,0,x+s/2,y+s/2,gr);
      rg2.addColorStop(0,"rgba(255,255,255,"+(0.45*pl).toFixed(2)+")"); rg2.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=rg2; g.beginPath(); g.arc(x+s/2,y+s/2,gr,0,TAU); g.fill();
      g.restore();
      g.save(); roundRect(x+1,y+1,s-2,s-2,s*0.28); g.clip();
      for(let i=0;i<RAINBOW.length;i++){ g.globalAlpha=0.55;
        g.fillStyle=RAINBOW[(i+Math.floor(tsec*4))%RAINBOW.length];
        g.fillRect(x+s*(i/RAINBOW.length),y,s/RAINBOW.length+1,s); }
      g.restore(); g.globalAlpha=1;
      g.save(); g.translate(x+s/2,y+s/2); g.rotate(Math.sin(tsec*2+b.wob)*0.3);
      g.fillStyle="#fff"; g.beginPath();
      for(let i=0;i<10;i++){const rr2=Math.max(0,i%2===0?s*0.26:s*0.11),a=i/10*TAU-Math.PI/2;
        if(i===0)g.moveTo(Math.cos(a)*rr2,Math.sin(a)*rr2); else g.lineTo(Math.cos(a)*rr2,Math.sin(a)*rr2);}
      g.closePath(); g.fill(); g.restore();
    } else if(t.key==="gold"){
      // GOLD cookie: pulsing halo + spinning star = instantly eye-catching
      const pl=0.6+0.4*Math.sin(tsec*5+b.wob);
      g.save(); g.globalCompositeOperation="lighter";
      let gg2=g.createRadialGradient(x+s/2,y+s/2,0,x+s/2,y+s/2,s*0.9);
      gg2.addColorStop(0,"rgba(255,240,150,"+(0.5*pl).toFixed(2)+")"); gg2.addColorStop(1,"rgba(255,240,150,0)");
      g.fillStyle=gg2; g.beginPath(); g.arc(x+s/2,y+s/2,s*0.9,0,TAU); g.fill();
      g.restore();
      if(useGoldImg){
        api.drawAsset("gold.png",x+s/2,y+s/2,s*1.15,s*1.15,{center:true});
      } else {
        g.save(); g.translate(x+s/2,y+s/2); g.rotate(Math.sin(tsec*2+b.wob)*0.25);
        g.fillStyle="#fff"; g.beginPath();
        for(let i=0;i<10;i++){const rr=i%2===0?s*0.3:s*0.13,a=i/10*TAU-Math.PI/2;
          if(i===0)g.moveTo(Math.cos(a)*rr,Math.sin(a)*rr); else g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}
        g.closePath(); g.fill();
        g.restore();
      }
      // orbiting sparkle dot
      const oa=tsec*3+b.wob;
      g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=0.9;
      g.fillStyle="#fff7c2"; g.beginPath();
      g.arc(x+s/2+Math.cos(oa)*s*0.42,y+s/2+Math.sin(oa)*s*0.42,s*0.06,0,TAU); g.fill();
      g.restore(); g.globalAlpha=1;
    } else if(t.key==="cookie"||t.key==="choco"){
      // chocolate chips
      g.fillStyle=t.chip;
      const cp=[[0.28,0.34],[0.66,0.3],[0.46,0.6],[0.74,0.68],[0.3,0.72]];
      for(const p of cp){ g.beginPath(); g.arc(x+s*p[0],y+s*p[1],s*0.08,0,TAU); g.fill(); }
    } else if(t.key==="cake"){
      // 軸7対策: roundRectの上に絞りクリーム(ellipse)を足して『カップケーキ』の輪郭にする
      g.save();
      let cg=g.createLinearGradient(x,y-s*0.24,x,y+s*0.1);
      cg.addColorStop(0,"#ffffff"); cg.addColorStop(1,lighten(t.col,25));
      g.fillStyle=cg;
      g.beginPath(); g.ellipse(x+s*0.5,y+s*0.05,Math.max(0,s*0.34),Math.max(0,s*0.22),0,0,TAU); g.fill();
      g.beginPath(); g.ellipse(x+s*0.5,y-s*0.12,Math.max(0,s*0.2),Math.max(0,s*0.15),0,0,TAU); g.fill();
      g.restore();
      // sprinkles
      const cols=["#ff5b8a","#4db8ff","#7be08a","#ff8c42"];
      for(let i=0;i<4;i++){ g.save(); g.translate(x+s*(0.3+0.16*i),y+s*(0.4+0.15*(i%2)));
        g.rotate(b.wob+i); g.fillStyle=cols[i%cols.length];
        g.fillRect(-s*0.07,-s*0.02,s*0.14,s*0.04); g.restore(); }
    } else if(t.key==="mint"){
      // 軸7対策: まんまるアメ玉+ねじり線(caramelツイスト)
      g.save(); g.strokeStyle="rgba(255,255,255,.6)"; g.lineWidth=Math.max(1.5,s*0.05); g.lineCap="round";
      g.beginPath(); g.moveTo(x+s*0.26,y+s*0.3); g.quadraticCurveTo(x+s*0.5,y+s*0.5,x+s*0.74,y+s*0.3); g.stroke();
      g.beginPath(); g.moveTo(x+s*0.26,y+s*0.7); g.quadraticCurveTo(x+s*0.5,y+s*0.5,x+s*0.74,y+s*0.7); g.stroke();
      g.restore();
    } else if(isStick){
      // 軸7対策: キャンディスティック = 細長い縦シルエット＋ねじり縞(丸・四角に加えて『長い』形)
      g.save(); g.beginPath(); bodyPath(x,y,s,heff,1); g.clip();
      g.strokeStyle="#ff5b8a"; g.lineWidth=Math.max(2,s*0.1); g.lineCap="round";
      for(let i=-1;i<6;i++){ g.beginPath(); g.moveTo(x+s*0.28+i*s*0.16,y-heff*0.1); g.lineTo(x+s*0.28+i*s*0.16-heff*0.3,y+heff*1.1); g.stroke(); }
      g.restore();
      g.fillStyle="#fff"; g.beginPath(); g.arc(x+s*0.5,y+heff*0.08,Math.max(0,s*0.06),0,TAU); g.fill();
      g.beginPath(); g.arc(x+s*0.5,y+heff*0.94,Math.max(0,s*0.06),0,TAU); g.fill();
    } else if(isBig){
      // 軸7対策: おおきいアメ = うずまき模様のジャイアントキャンディ玉(大小の対比)
      g.save(); g.beginPath(); bodyPath(x,y,s,heff,1); g.clip();
      g.strokeStyle="rgba(255,255,255,.55)"; g.lineWidth=Math.max(2,s*0.07);
      for(let i=0;i<3;i++){ g.beginPath(); g.arc(x+s/2,y+heff/2,Math.max(0,s*(0.14+i*0.13)),0,TAU); g.stroke(); }
      g.restore();
      // 頭に小さなキャンディの結び目(ラッピングの端)を付けて「アメ玉」感を出す
      g.fillStyle=lighten(t.col,20);
      g.beginPath(); g.moveTo(x+s*0.5,y); g.lineTo(x+s*0.36,y-heff*0.06); g.lineTo(x+s*0.64,y-heff*0.06); g.closePath(); g.fill();
    } else {
      // gummy/gummyb: ふにゃっと丸いジェリー玉 = jelly shine dot + soft inner glow
      g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=0.4;
      g.fillStyle=lighten(t.col,40);
      g.beginPath(); g.arc(x+s*0.5,y+s*0.55,Math.max(0,s*0.22),0,TAU); g.fill();
      g.restore(); g.globalAlpha=1;
    }
    // hard candy: shiny wrapper sparkle + crack line once chipped
    if(b.hard){
      g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=0.5+0.2*Math.sin(tsec*3+b.wob);
      g.strokeStyle="#ffffff"; g.lineWidth=Math.max(2,s*0.06);
      g.beginPath(); g.moveTo(x+s*0.2,y+s*0.2); g.lineTo(x+s*0.4,y+s*0.4); g.stroke();
      g.restore(); g.globalAlpha=1;
      if(b.hp<2){ g.strokeStyle="rgba(90,40,30,.7)"; g.lineWidth=Math.max(2,s*0.07); g.lineCap="round";
        g.beginPath(); g.moveTo(x+s*0.32,y+s*0.16); g.lineTo(x+s*0.46,y+s*0.5);
        g.lineTo(x+s*0.36,y+s*0.72); g.lineTo(x+s*0.6,y+s*0.88); g.stroke(); }
    }
    // ② ラッキーおかしの ヒント: 頭上で 小さな星が そろって キラッ(気づけるが うるさくない)
    if(t.key===luckyKey && !b.gold && !b.rb){
      const tw=Math.sin(tsec*3+b.wob);
      if(tw>0.35){ g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=(tw-0.35)*0.85;
        g.translate(x+s*0.5,y-s*0.14); g.fillStyle="#fff7c2";
        const sr=Math.max(0,s*0.09);
        g.beginPath(); for(let i=0;i<8;i++){const rr3=Math.max(0,i%2===0?sr:sr*0.4),a=i/8*TAU-Math.PI/2;
          if(i===0)g.moveTo(Math.cos(a)*rr3,Math.sin(a)*rr3); else g.lineTo(Math.cos(a)*rr3,Math.sin(a)*rr3);}
        g.closePath(); g.fill(); g.restore(); g.globalAlpha=1; }
    }
    // hit flash overlay (crack) ※画像ゴールドは丸いスプライトに合わせて円のフラッシュにする
    if(b.flash>0){ g.save(); g.globalAlpha=b.flash*0.7; g.fillStyle="#fff";
      if(useGoldImg){ g.beginPath(); g.arc(x+s/2,y+s/2,Math.max(0,s*0.5),0,TAU); g.fill(); }
      else { g.beginPath(); bodyPath(x,y,s,heff,1); g.fill(); }
      g.restore(); }
    // rim light ※画像ゴールドは縁取りを描かない(絵と喧嘩するため)
    if(!useGoldImg){
      g.strokeStyle="rgba(255,255,255,.3)"; g.lineWidth=2;
      g.beginPath(); bodyPath(x,y,s,heff,1); g.stroke();
    }
  }
  function drawMascot(){
    const r=mascot.r; if(r<=0)return;
    const mx=mascot.x, my=mascot.y+Math.sin(tsec*1.6)*4;
    g.save();
    // soft halo (additive)
    g.globalCompositeOperation="lighter";
    const hr=Math.max(0,r*1.7);
    let hg=g.createRadialGradient(mx,my,0,mx,my,hr);
    hg.addColorStop(0,"rgba(255,240,170,.5)"); hg.addColorStop(1,"rgba(255,240,170,0)");
    g.fillStyle=hg; g.beginPath(); g.arc(mx,my,hr,0,TAU); g.fill();
    g.restore();
    // star body: star.png は「顔つきバルーン」化してしまい生成不採用のため手描きのみ(issues参照)
    g.save(); g.translate(mx,my); g.rotate(Math.sin(tsec*0.6)*0.08);
    {
      let sg=g.createRadialGradient(0,-r*0.2,Math.max(0,r*0.1),0,0,Math.max(0.1,r));
      sg.addColorStop(0,"#fff7c2"); sg.addColorStop(1,"#ffd23f");
      g.fillStyle=sg; g.beginPath();
      for(let i=0;i<10;i++){const rr=Math.max(0,i%2===0?r:r*0.46),a=i/10*TAU-Math.PI/2;
        if(i===0)g.moveTo(Math.cos(a)*rr,Math.sin(a)*rr); else g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}
      g.closePath(); g.fill();
      g.lineWidth=Math.max(1.5,r*0.06); g.strokeStyle="rgba(210,150,30,.6)"; g.stroke();
    }
    // face: eyes + smile (wink closes one eye)
    const ex=r*0.28, ey=-r*0.02, er=Math.max(1.6,r*0.09);
    g.fillStyle="#7a4a26";
    if(mascot.wink>0){
      g.lineWidth=Math.max(1.6,r*0.07); g.strokeStyle="#7a4a26"; g.lineCap="round";
      g.beginPath(); g.moveTo(-ex-er,ey-er*0.2); g.quadraticCurveTo(-ex,ey-er,-ex+er,ey-er*0.2); g.stroke();
      g.beginPath(); g.arc(ex,ey,er,0,TAU); g.fill();
    }else{
      g.beginPath(); g.arc(-ex,ey,er,0,TAU); g.arc(ex,ey,er,0,TAU); g.fill();
    }
    g.fillStyle="rgba(255,255,255,.9)";
    g.beginPath(); g.arc(ex-er*0.3,ey-er*0.3,Math.max(0.8,er*0.35),0,TAU); g.fill();
    // rosy cheeks
    g.fillStyle="rgba(255,140,150,.4)";
    g.beginPath(); g.arc(-ex*1.5,ey+er*1.2,Math.max(1,er*0.6),0,TAU); g.arc(ex*1.5,ey+er*1.2,Math.max(1,er*0.6),0,TAU); g.fill();
    // smile
    g.strokeStyle="#7a4a26"; g.lineWidth=Math.max(1.4,r*0.06); g.lineCap="round";
    g.beginPath(); g.arc(0,ey+er*0.8,Math.max(0,r*0.2),0.15*Math.PI,0.85*Math.PI); g.stroke();
    g.restore();
  }
  function roundRect(x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
  function shade(hex,amt){ const n=parseInt(hex.slice(1),16);
    const r=clamp(((n>>16)&255)+amt,0,255), gg=clamp(((n>>8)&255)+amt,0,255), b=clamp((n&255)+amt,0,255);
    return "rgb("+r+","+gg+","+b+")"; }
  function lighten(hex,amt){ return shade(hex,amt); }
}
Engine.register("cookiebreak", build_cookiebreak);
