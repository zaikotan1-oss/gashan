function build_cookiebreak(api){
  const g=api.g;
  api.preload(["bg.jpg"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。gold/starは生成不良のため未使用(issues参照)
  let blocks=[],shards=[],sparks=[],rings=[],crumbs=[],floats=[],clouds=[],orbs=[],motes=[];
  let S,cols,rows,bx,by,tsec=0,count=0,combo=0,comboT=0,flash=0,flashHue="#fff";
  // stage progression: clear all blocks -> "ステージ クリア!" -> harder endless
  let stage=1,clearBanner=0,clearing=false,clearScale=0;
  let clearTease=""; // F) 次ステージ予告のひとこと
  let clearNext=2;   // バナーに出す次ステージ番号(doClear時に固定。stage++後も読み替わらない)
  let firstBreak=false,lastBreakF=0; // 最初の1回が割れるまでは自動吸着の距離を無制限にする(最初の成功を必ず届ける安全網)
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
    {key:"stick", col:"#ffd9ec",chip:"#ff5b8a"},  // 軸7対策: キャンディスティック(細長いシルエット)
    {key:"gingerbread",col:"#d9955a",chip:"#fff"}, // 軸7: ジンジャーマン(人型の生き物)
    {key:"donut", col:"#ff9fcf",chip:"#fff"}       // 軸7: ドーナツ(穴のあいた輪っか)
  ];
  const PARTS=TYPES.map(t=>t.col);
  // A) rare GOLD cookie: 7% — glowing star cookie, big bonus + rainbow burst on break
  const GOLD={key:"gold",col:"#ffd23f",chip:"#fff7c2"};
  const RB={key:"rainbow",col:"#ff5b8a",chip:"#fff"}; // ① 激レア にじいろクッキー
  // 軸7対策: TYPESとは別枠の『おおきいアメ』(1列×2マス分の縦長の大玉。マス目1x1固定だった見た目に大小の対比を出す)
  const BIGTYPE={key:"bigcandy",col:"#ff9ecb",chip:"#ff5b9a"};
  // 軸7: 縦3マスの『ソフトクリーム』(いちばん背が高い物。ステージ2から塔に出る)
  const TALLTYPE={key:"icecream",col:"#fff0d6",chip:"#ff8fb3"};
  const RAINBOW=["#ff5b8a","#ff8c42","#ffd23f","#7be08a","#4db8ff","#b58bff","#ff7bd0"];
  // ---- 隠し発見レイヤー(ハンマー/トラックと同じ思想) ----
  // ② きょうのラッキーおかし: build時に1種を秘密に選ぶ。その味を割ると小ボーナス＋頭上に星のヒント
  const FLAVNAME={cookie:"クッキー",choco:"チョコ",gummy:"ピンクグミ",gummyb:"みずいろグミ",cake:"きいろケーキ",mint:"ミント",stick:"スティック",gingerbread:"ジンジャーマン",donut:"ドーナツ"};
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
    // 軸6対策: ステージ1は塔が3段だけなので、マスを大きくして画面の主役にする(最大84px。2段目以降は従来どおり62px)
    S=stage===1?clamp(Math.floor(Math.min(api.W/7.5,avail/6)),34,84):clamp(Math.floor(Math.min(api.W/9,avail/9)),34,62);
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
  function mergeBigIn(c,n){
    n=n||2;
    const colBlocks=blocks.filter(b=>b.col===c && !b.hard && !b.gold && !b.rb && (b.h||1)===1).sort((a,z)=>a.row-z.row);
    // n マス縦にならんでいる並びを全部さがし、その中からランダムに1つ選ぶ
    const starts=[];
    for(let i=0;i+n-1<colBlocks.length;i++){
      let ok=true;
      for(let k=1;k<n;k++){ if(colBlocks[i+k].row!==colBlocks[i].row+k){ok=false;break;} }
      if(ok)starts.push(i);
    }
    if(!starts.length)return false;
    const i=pick(starts), top=colBlocks[i];
    top.type=(n>=3?TALLTYPE:BIGTYPE); top.h=n; top.hard=false; top.gold=false; top.rb=false; top.hp=1;
    for(let k=1;k<n;k++){ const idx=blocks.indexOf(colBlocks[i+k]); if(idx>=0)blocks.splice(idx,1); }
    return true;
  }
  function maybeAddBig(){
    let made=0;
    const done={};
    // 軸7: ステージ2以降は、縦3マスの『ソフトクリーム』を各塔にちょうど1個(増やしすぎると狙う得が薄れて軸3の線が崩れるので1個まで)
    if(stage>1){
      const o2=[]; for(let c=0;c<cols;c++)o2.push(c);
      for(let k=o2.length-1;k>0;k--){const j=rint(0,k); const t=o2[k]; o2[k]=o2[j]; o2[j]=t;}
      for(const c of o2){ if(mergeBigIn(c,3)){ done[c]=1; break; } }
    }
    else if(Math.random()<0.5){
      // 軸7: ステージ1(最初の約23秒)でも半分の確率で縦3マスのソフトクリームを1個。3段そろった列だけが対象(足りなければ何もしない)
      const o1=[]; for(let c=0;c<cols;c++)o1.push(c);
      for(let k=o1.length-1;k>0;k--){const j=rint(0,k); const t=o1[k]; o1[k]=o1[j]; o1[j]=t;}
      for(const c of o1){ if(mergeBigIn(c,3)){ done[c]=1; break; } }
    }
    for(let c=0;c<cols;c++){
      if(done[c]) continue;
      if(Math.random()>=(stage>1?0.3:0.35)) continue;
      if(mergeBigIn(c,2)){ made++; done[c]=1; }
    }
    // 軸7: 大玉が足りない時は、どれかの列で必ず合体させて「大きい物」が画面に出るようにする(ステージ1は最初から2個以上、2以降は1個以上)
    const need=stage===1?2:1;
    if(made<need){
      const order=[]; for(let c=0;c<cols;c++)order.push(c);
      for(let k=order.length-1;k>0;k--){const j=rint(0,k); const t=order[k]; order[k]=order[j]; order[j]=t;}
      for(const c of order){ if(made>=need)break; if(done[c])continue; if(mergeBigIn(c,2)){ made++; done[c]=1; } }
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
    const isTall=b.type.key==="icecream";                        // 軸7: ソフトクリーム(縦3マス)は大破片が倒れて崩れる
    // particle caps: keep 60fps even on fever flood-breaks
    const capped=shards.length>140;
    let shN,shSzLo,shSzHi,shVLo,shVHi,shDeLo,shDeHi;
    if(isSoft&&b.type.key==="gummyb"){ shN=capped?2:rint(3,5); shSzLo=S*0.16; shSzHi=S*0.3; shVLo=-2.5; shVHi=2.5; shDeLo=0.005; shDeHi=0.009; } // ちびグミ: 小さなふにゃ破片
    else if(isSoft){ shN=capped?2:rint(3,5); shSzLo=S*0.26; shSzHi=S*0.48; shVLo=-2.5; shVHi=2.5; shDeLo=0.005; shDeHi=0.009; }
    else if(isHardBreak){ shN=capped?3:rint(8,12); shSzLo=S*0.09; shSzHi=S*0.2; shVLo=-7.5; shVHi=7.5; shDeLo=0.01; shDeHi=0.02; }
    else if(isTall){ shN=capped?4:rint(10,14); shSzLo=S*0.24; shSzHi=S*0.44; shVLo=-6; shVHi=6; shDeLo=0.008; shDeHi=0.014; }
    else if(isBig){ shN=capped?3:rint(7,10); shSzLo=S*0.22; shSzHi=S*0.4; shVLo=-6; shVHi=6; shDeLo=0.008; shDeHi=0.014; }
    else{ shN=capped?2:rint(5,8); shSzLo=S*0.16; shSzHi=S*0.34; shVLo=-5; shVHi=5; shDeLo=0.006; shDeHi=0.012; }
    // 軸7対策③: ケーキは砕けるだけでなく『倒れる』動きを足す。大きめの破片1個を強く回転させて落とし、
    // 飛び散る細かい破片(下の通常処理)と混ぜて「倒れて崩れる」見え方にする。
    if(isCake) shards.push({x:cx,y:cy,vx:rnd(-1,1),vy:rnd(0.4,1.4),s:Math.max(1,S*0.7),col,
      rot:0,vr:rnd(4,5.5)*(Math.random()<0.5?-1:1),life:1,decay:0.022});
    if(isTall) shards.push({x:cx,y:cy-heff*0.2,vx:rnd(-1.2,1.2),vy:rnd(0.2,1.2),s:Math.max(1,S*0.95),col,
      rot:0,vr:rnd(3.5,5)*(Math.random()<0.5?-1:1),life:1,decay:0.02});   // 軸7: 大きい破片1個が強く回って『倒れる』
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
      // 軸3: 最初の1回が割れたあとは、おかしの近く(S以内)を狙った時だけ割れる。遠いタップは「ぽよん」だけ(減点・ゲームオーバー無し)
      if(firstBreak && fcount-lastBreakF<150 && Math.sqrt(bd)>S*1.0){  // 2.5秒以上何も割れていない時は距離無制限に戻す(遠くの最後の1個で詰まらない安全網)
        api.tone(260,0.06,"triangle",0.06);
        rings.push({x:px,y:py,r:S*0.18,life:0.7,col:"#fff"});
        return;
      }
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
    firstBreak=true; lastBreakF=fcount;
    chain.forEach((blk,i)=>breakOne(blk,i===0));
    applyGravity();
    let gained=chain.length+goldN*5+rbN*10;  // gold=+5, にじいろ=+10
    if(isLucky)gained+=1;                     // ② ラッキーおかし: 小さめボーナス
    if(direct && fever<=0 && chain.length>=3)gained+=1; // 軸3: 同じ味を3つ以上つなげて直接ねらって割ると+1(吸着で割った時は単体のまま)
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
      floats.push({x:cx,y:cy-70,txt:"ゴールド！ +"+(goldN*5),life:1,vy:-0.9,col:"#ffd23f",size:34});
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
      if(feverBanner<=0){   // 軸6: フィーバー開始バナー中はラッキーの帯・文字を出さない(重なり防止)
        if(blocks.length>0) luckyMsgT=luckySeen?Math.max(luckyMsgT,0.7):1.6; luckySeen=true;
      }
      api.tone(1046,0.14,"triangle",0.1); api.tone(1568,0.16,"triangle",0.08);
      if(feverBanner<=0) floats.push({x:offsetFloatX(cx),y:cy-84,txt:"ラッキー！",life:1,vy:-0.9,col:b.type.chip,size:26});
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
    if(combo>1&&combo%5===0)floats.push({x:offsetFloatX(Math.min(cx+S*0.9,api.W-40)),y:cy-18,txt:"x"+combo,life:1,vy:-1.1,
      col:combo>=8?"#ff5bd0":combo>=5?"#ff8c42":"#ffb0e0",size:combo>=5?40:30});
    if(gained>=3&&!goldN&&!rbN&&!isLucky)floats.push({x:cx,y:cy-50,txt:"バキバキ！",life:1,vy:-0.7,col:"#ff7bd0",size:24});
    if(blocks.length===0)doClear();
  }
  function startFever(){
    luckyMsgT=0; rbMsgT=0;   // 軸6: フィーバー開始バナーと重ならないよう他のバナーを消す
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
    feverBanner=0; luckyMsgT=0; rbMsgT=0;   // 軸6: 最後の1個でフィーバーが満タンになってもクリア文字と重ねない(フィーバー本体は持ち越す)
    clearNext=stage+1;
    // ③ ノンストップ クリア: コンボを一度も切らさず塔を割り切ったら +5 & 祝福(考えどころ=手を止めず一気に)
    if(comboKept){ count+=5; api.setScore(count); nonstopT=1.9;
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
          floats.push({x:api.W/2,y:api.H*0.5,txt:"フィーバー おわり",life:1,vy:-0.5,col:"#fff",size:24});
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
        g.lineWidth=6; g.lineJoin="round"; g.strokeStyle="rgba(120,60,90,.8)"; g.strokeText(f.txt,f.x,f.y);
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
      const hudY=Math.max(api.H*0.06,30);
      {
        const hud="ステージ "+stage+"      のこり "+blocks.length;
        g.save(); g.textAlign="center";
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";
        const hw=Math.min(api.W-24,g.measureText(hud).width+36);
        g.fillStyle="rgba(90,42,68,.35)"; roundRect(api.W/2-hw/2,hudY-26,hw,36,18); g.fill();
        g.lineWidth=7; g.lineJoin="round"; g.strokeStyle="rgba(90,30,60,.75)";
        g.strokeText(hud,api.W/2,hudY);
        g.fillStyle="#fff"; g.fillText(hud,api.W/2,hudY);
        g.restore(); g.textAlign="left"; g.lineJoin="miter";
      }
      // ---- combo big text (top center band) ----
      if(combo>1){
        const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save(); g.translate(api.W/2,Math.max(api.H*0.115,hudY+42)); g.scale(pop,pop);
        g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.globalAlpha=clamp(comboT*2.5,0,1);
        g.shadowColor="rgba(255,140,200,.8)"; g.shadowBlur=14;
        g.shadowBlur=0; g.lineWidth=7; g.lineJoin="round"; g.strokeStyle="rgba(90,30,60,.75)"; g.strokeText("コンボ x"+combo,0,0);
        g.fillStyle="#ffe0f4"; g.fillText("コンボ x"+combo,0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; g.lineJoin="miter";
      }
      // ---- FEVER gauge bar (bottom center) ----
      {
        const bw=Math.min(api.W*0.5,220),bxg=(api.W-bw)/2,byg=api.H-30,bh=13;
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
        g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.lineWidth=5; g.lineJoin="round"; g.strokeStyle="rgba(90,42,68,.75)";
        const lbl=fever>0?"フィーバー ちゅう！！":feverGauge>0.8?"もうすこしで フィーバー！":"フィーバー";
        g.strokeText(lbl,api.W/2,byg-8);
        g.fillStyle=fever>0?"#fff":"#fff0f8"; g.fillText(lbl,api.W/2,byg-8);
        g.restore(); g.textAlign="left"; g.lineJoin="miter";
      }
      // ---- FEVER start banner ----
      if(feverBanner>0){ feverBanner=Math.max(0,feverBanner-0.016*dt);
        const a=clamp(feverBanner,0,1),pop=1+0.12*Math.sin(tsec*11);
        g.save(); g.translate(api.W/2,api.H*0.46); g.scale(pop,pop); g.globalAlpha=a;
        g.textAlign="center"; g.font="900 52px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=11; g.lineJoin="round"; g.strokeStyle="rgba(120,20,80,.75)";
        g.strokeText("フィーバー！！",0,0);
        let fg=g.createLinearGradient(-140,0,140,0);
        RAINBOW.forEach((c,i)=>fg.addColorStop(i/(RAINBOW.length-1),c));
        g.fillStyle=fg; g.fillText("フィーバー！！",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#fff";
        g.lineWidth=5; g.lineJoin="round"; g.strokeStyle="rgba(120,20,80,.75)";
        g.strokeText("ぜんぶ 1ぱつ！ てんすう 2ばい！",0,36);
        g.fillText("ぜんぶ 1ぱつ！ てんすう 2ばい！",0,36);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; g.lineJoin="miter";
      }
      // ---- STAGE CLEAR banner ----
      if(clearBanner>0){ clearBanner=Math.max(0,clearBanner-0.016*dt);
        clearScale=Math.min(1,clearScale+0.12*dt);
        const a=clamp(clearBanner*1.5,0,1), pop=ease(clearScale)*(1+0.06*Math.sin(tsec*9));
        g.save(); g.globalAlpha=a*0.4; g.fillStyle="#5a2a44"; g.fillRect(0,api.H*0.34,api.W,api.H*0.22); g.restore();
        g.save(); g.translate(api.W/2,api.H*0.44); g.scale(pop,pop); g.globalAlpha=a;
        g.textAlign="center"; g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=10; g.lineJoin="round"; g.strokeStyle="rgba(120,50,80,.7)";
        g.strokeText("ステージ クリア！",0,0);
        let bg=g.createLinearGradient(0,-30,0,34);
        bg.addColorStop(0,"#fff2a0"); bg.addColorStop(0.5,"#ffd23f"); bg.addColorStop(1,"#ff8fb3");
        g.fillStyle=bg; g.fillText("ステージ クリア！",0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#fff";
        g.fillText("つぎは ステージ "+clearNext,0,40);
        if(clearTease){
          g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
          g.lineWidth=5; g.strokeStyle="rgba(120,50,80,.6)";
          g.strokeText(clearTease,0,74);
          g.fillStyle="#fff2a0"; g.fillText(clearTease,0,74);
        }
        g.restore(); g.globalAlpha=1; g.textAlign="left"; g.lineJoin="miter";
      }
      // ① にじいろクッキー！ 発見バナー(虹色に色替わり・上部中央=HUD安全帯)
      if(rbMsgT>0){ rbMsgT-=0.016*dt;
        if(feverBanner>0){ if(rbMsgT<0)rbMsgT=0; } else {
        const pop=1+Math.max(0,rbMsgT-1)*1.3, col=RAINBOW[Math.floor(tsec*6)%RAINBOW.length];
        // 軸6対策①: 後ろを浮遊するコンボ数字等と重なっても読めるよう、clearBannerと同様の半透明バンドを敷く
        g.save(); g.globalAlpha=clamp(rbMsgT*1.4,0,1)*0.4; g.fillStyle="#5a2a44"; g.fillRect(0,api.H*0.2-34,api.W,68); g.restore();
        g.save(); g.translate(api.W/2,api.H*0.2); g.scale(pop,pop); g.textAlign="center"; g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1); g.font="900 38px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7; g.lineJoin="round"; g.strokeStyle="rgba(90,30,60,.5)"; g.strokeText("にじいろクッキー！",0,0);
        g.fillStyle=col; g.fillText("にじいろクッキー！",0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; g.textBaseline="alphabetic"; g.lineJoin="miter"; if(rbMsgT<0)rbMsgT=0; } }
      // ② きょうのラッキーおかし はっけん！ 中央の小ヒント(初回だけ大きく)
      if(luckyMsgT>0){ luckyMsgT-=0.016*dt;
        if(feverBanner>0){ luckyMsgT=0; } else {
        // 軸6対策①: 半透明バンドで背後の浮遊テキストと重なっても文字がにじまないようにする
        g.save(); g.globalAlpha=clamp(luckyMsgT*1.3,0,1)*0.4; g.fillStyle="#5a2a44"; g.fillRect(0,api.H*0.30-28,api.W,56); g.restore();
        g.save(); g.translate(api.W/2,api.H*0.30); g.textAlign="center"; g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1); g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキーは "+(FLAVNAME[luckyKey]||"")+"！";
        g.lineWidth=5; g.lineJoin="round"; g.strokeStyle="rgba(90,40,60,.45)"; g.strokeText(t2,0,0);
        g.fillStyle="#fff2a0"; g.fillText(t2,0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; g.textBaseline="alphabetic"; g.lineJoin="miter"; if(luckyMsgT<0)luckyMsgT=0; } }
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
    const isChibi=t.key==="gummyb";                    // 軸7: ちびグミ(小さい・マスの下に座る)
    const isJelly=(t.key==="gummy"||isChibi);          // 丸いジェリー玉
    const isRoundCandy=t.key==="mint";                 // 丸い飴玉
    const isChocoBar=t.key==="choco";                  // 軸7: 板チョコ(横長の板＋溝)
    const isRoundCookie=t.key==="cookie";              // 軸7: まんまるクッキー(いちばん大きく膨らむ)
    const isBig=t.key==="bigcandy";                    // おおきい丸玉(1x2マス)
    const isStick=t.key==="stick";                     // 細長いキャンディスティック
    const isTall=t.key==="icecream";                   // 軸7: 縦3マスのソフトクリーム
    const isGinger=t.key==="gingerbread";              // 軸7: ジンジャーマン(人型)
    const isDonut=t.key==="donut";                     // 軸7: ドーナツ(穴あき)
    const isGoldBody=(t.key==="gold"||t.key==="rainbow");   // 軸7: ゴールド/にじいろは星形で別格に
    const isCake=t.key==="cake";                       // 軸7: カップケーキは台形の紙カップの輪郭
    function starPath(px,py,pw,ph){
      const cx=px+pw/2, cy=py+ph/2;
      for(let i=0;i<10;i++){const rr=Math.max(0,i%2===0?pw*0.5:pw*0.23),a=i/10*TAU-Math.PI/2;
        if(i===0)g.moveTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr); else g.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);}
      g.closePath();
    }
    const isSmallMint=isRoundCandy;                    // 軸7: ちびアメ玉(0.7倍・マスの下に座る。当たり判定はマス全体のまま)
    function bodyPath(px,py,pw,ph,inset){
      if(isGoldBody){ g.beginPath(); starPath(px,py,pw,ph); }
      else if(isCake){ g.beginPath(); g.moveTo(px+pw*0.05,py+ph*0.38); g.lineTo(px+pw*0.95,py+ph*0.38); g.lineTo(px+pw*0.83,py+ph*0.99); g.lineTo(px+pw*0.17,py+ph*0.99); g.closePath(); }
      else if(isChibi) g.ellipse(px+pw/2,py+ph*0.68,Math.max(0,pw*0.30),Math.max(0,ph*0.28),0,0,TAU);
      else if(isJelly) g.ellipse(px+pw/2,py+ph/2,Math.max(0,pw*0.46),Math.max(0,ph*0.42),0,0,TAU);
      else if(isChocoBar) roundRect(px+inset,py+ph*0.12,Math.max(0,pw-2*inset),ph*0.76,pw*0.1);
      else if(isRoundCookie) g.arc(px+pw/2,py+ph/2,Math.max(0,pw*0.49),0,TAU);
      else if(isRoundCandy) g.arc(px+pw/2,py+ph*0.66,Math.max(0,pw*0.31),0,TAU);
      else if(isDonut){ const dcx=px+pw/2,dcy=py+ph/2; g.arc(dcx,dcy,Math.max(0,pw*0.47),0,TAU); g.moveTo(dcx+pw*0.16,dcy); g.arc(dcx,dcy,Math.max(0,pw*0.16),0,TAU,true); }
      else if(isGinger){
        const X=u=>px+pw*u, Y=v=>py+ph*v;
        g.beginPath(); g.moveTo(X(0.42),Y(0.35));
        g.arc(X(0.5),Y(0.2),Math.max(0,pw*0.16),2.06,Math.PI*2+1.08);
        g.lineTo(X(0.78),Y(0.37)); g.quadraticCurveTo(X(0.97),Y(0.3),X(0.96),Y(0.5)); g.lineTo(X(0.8),Y(0.52));
        g.lineTo(X(0.68),Y(0.54)); g.lineTo(X(0.84),Y(0.84)); g.quadraticCurveTo(X(0.86),Y(0.98),X(0.7),Y(0.96));
        g.lineTo(X(0.58),Y(0.92)); g.lineTo(X(0.5),Y(0.72)); g.lineTo(X(0.42),Y(0.92)); g.lineTo(X(0.3),Y(0.96));
        g.quadraticCurveTo(X(0.14),Y(0.98),X(0.16),Y(0.84)); g.lineTo(X(0.32),Y(0.54)); g.lineTo(X(0.2),Y(0.52));
        g.quadraticCurveTo(X(0.03),Y(0.5),X(0.04),Y(0.4)); g.quadraticCurveTo(X(0.05),Y(0.3),X(0.22),Y(0.37)); g.closePath();
      }
      else if(isTall){
        const X=u=>px+pw*u, Y=v=>py+ph*v;
        g.beginPath(); g.moveTo(X(0.5),Y(0.01));
        g.quadraticCurveTo(X(0.7),Y(0.04),X(0.7),Y(0.17)); g.quadraticCurveTo(X(0.84),Y(0.19),X(0.85),Y(0.33));
        g.quadraticCurveTo(X(1.0),Y(0.36),X(0.97),Y(0.5)); g.quadraticCurveTo(X(1.0),Y(0.58),X(0.9),Y(0.6));
        g.lineTo(X(0.5),Y(0.99)); g.lineTo(X(0.1),Y(0.6));
        g.quadraticCurveTo(X(0),Y(0.58),X(0.03),Y(0.5)); g.quadraticCurveTo(X(0),Y(0.36),X(0.15),Y(0.33));
        g.quadraticCurveTo(X(0.16),Y(0.19),X(0.3),Y(0.17)); g.quadraticCurveTo(X(0.3),Y(0.04),X(0.5),Y(0.01)); g.closePath();
      }
      else if(isBig) roundRect(px+inset,py+inset,Math.max(0,pw-2*inset),Math.max(0,ph-2*inset),Math.max(0,pw-2*inset)*0.5);   // 2マス分の高さいっぱいの縦長カプセル(大小の対比)
      else if(isStick) roundRect(px+pw*0.3,py+inset*0.5,pw*0.4,ph-inset,pw*0.2);
      else roundRect(px+inset,py+inset,pw-2*inset,ph-2*inset,pw*0.28);
    }
    // soft drop shadow
    g.fillStyle="rgba(80,30,60,.32)"; g.beginPath(); bodyPath(x+3,y+4,s,heff,0); g.fill();
    if(!useGoldImg){
      // body ※画像ゴールドの時は絵と喧嘩する形は描かない
      let bg=g.createLinearGradient(x,y,x+s*0.4,y+heff);
      bg.addColorStop(0,lighten(t.col,55)); bg.addColorStop(0.55,t.col); bg.addColorStop(1,shade(t.col,-28));
      g.fillStyle=bg; g.beginPath(); bodyPath(x,y,s,heff,1); g.fill();
      // glossy top sheen
      g.save(); g.beginPath(); bodyPath(x,y,s,heff,1); g.clip();
      g.fillStyle="rgba(255,255,255,.4)";
      g.beginPath();
      if(isChibi) g.ellipse(x+s*0.4,y+s*0.58,Math.max(0,s*0.12),Math.max(0,s*0.06),-0.5,0,TAU);
      else if(isSmallMint) g.ellipse(x+s*0.4,y+s*0.54,Math.max(0,s*0.1),Math.max(0,s*0.05),-0.5,0,TAU);
      else g.ellipse(x+s*0.32,y+s*0.26,Math.max(0,s*0.26),Math.max(0,s*0.13),-0.5,0,TAU);
      g.fill();
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
      g.save(); g.beginPath(); starPath(x,y,s,s); g.clip();
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
    } else if(isChocoBar){
      // 板チョコ: たて2本・よこ1本の溝＋各ブロックのてかり
      g.save(); g.beginPath(); bodyPath(x,y,s,heff,1); g.clip();
      g.strokeStyle=shade(t.col,-45); g.lineWidth=Math.max(1.5,s*0.045); g.lineCap="round";
      g.beginPath(); g.moveTo(x+s/3,y+s*0.12); g.lineTo(x+s/3,y+s*0.88);
      g.moveTo(x+s*2/3,y+s*0.12); g.lineTo(x+s*2/3,y+s*0.88);
      g.moveTo(x+s*0.04,y+s*0.5); g.lineTo(x+s*0.96,y+s*0.5); g.stroke();
      g.strokeStyle="rgba(255,235,210,.28)"; g.lineWidth=Math.max(1,s*0.03);
      g.beginPath(); g.moveTo(x+s/3+2,y+s*0.15); g.lineTo(x+s/3+2,y+s*0.46);
      g.moveTo(x+s*2/3+2,y+s*0.15); g.lineTo(x+s*2/3+2,y+s*0.46);
      g.moveTo(x+s*0.06,y+s*0.52); g.lineTo(x+s*0.3,y+s*0.52); g.stroke();
      g.restore();
    } else if(isRoundCookie){
      // まんまるクッキー: チョコチップ
      g.fillStyle=t.chip;
      const cp=[[0.28,0.34],[0.66,0.3],[0.46,0.6],[0.74,0.68],[0.3,0.72]];
      for(const p of cp){ g.beginPath(); g.arc(x+s*p[0],y+s*p[1],s*0.08,0,TAU); g.fill(); }
    } else if(t.key==="cake"){
      // 軸7対策: roundRectの上に絞りクリーム(ellipse)を足して『カップケーキ』の輪郭にする
      g.save();
      let cg=g.createLinearGradient(x,y-s*0.06,x,y+s*0.28);
      cg.addColorStop(0,"#ffffff"); cg.addColorStop(1,lighten(t.col,25));
      g.fillStyle=cg;
      g.beginPath(); g.ellipse(x+s*0.5,y+s*0.23,Math.max(0,s*0.34),Math.max(0,s*0.22),0,0,TAU); g.fill();
      g.beginPath(); g.ellipse(x+s*0.5,y+s*0.06,Math.max(0,s*0.2),Math.max(0,s*0.15),0,0,TAU); g.fill();
      g.restore();
      // sprinkles
      const cols=["#ff5b8a","#4db8ff","#7be08a","#ff8c42"];
      for(let i=0;i<4;i++){ g.save(); g.translate(x+s*(0.3+0.16*i),y+s*(0.4+0.15*(i%2)));
        g.rotate(b.wob+i); g.fillStyle=cols[i%cols.length];
        g.fillRect(-s*0.07,-s*0.02,s*0.14,s*0.04); g.restore(); }
    } else if(t.key==="mint"){
      // 軸7対策: まんまるアメ玉+ねじり線(caramelツイスト)
      g.save(); g.strokeStyle="rgba(255,255,255,.6)"; g.lineWidth=Math.max(1.5,s*0.05); g.lineCap="round";
      g.beginPath(); g.moveTo(x+s*0.36,y+s*0.55); g.quadraticCurveTo(x+s*0.5,y+s*0.66,x+s*0.64,y+s*0.55); g.stroke();
      g.beginPath(); g.moveTo(x+s*0.36,y+s*0.8); g.quadraticCurveTo(x+s*0.5,y+s*0.66,x+s*0.64,y+s*0.8); g.stroke();
      g.restore();
    } else if(isStick){
      // 軸7対策: キャンディスティック = 細長い縦シルエット＋ねじり縞(丸・四角に加えて『長い』形)
      g.save(); g.beginPath(); bodyPath(x,y,s,heff,1); g.clip();
      g.strokeStyle="#ff5b8a"; g.lineWidth=Math.max(2,s*0.1); g.lineCap="round";
      for(let i=-1;i<6;i++){ g.beginPath(); g.moveTo(x+s*0.28+i*s*0.16,y-heff*0.1); g.lineTo(x+s*0.28+i*s*0.16-heff*0.3,y+heff*1.1); g.stroke(); }
      g.restore();
      g.fillStyle="#fff"; g.beginPath(); g.arc(x+s*0.5,y+heff*0.08,Math.max(0,s*0.06),0,TAU); g.fill();
      g.beginPath(); g.arc(x+s*0.5,y+heff*0.94,Math.max(0,s*0.06),0,TAU); g.fill();
    } else if(isDonut){
      // ドーナツ: 生地のふち＋カラフルなスプリンクル(輪っか＝穴があいた形)
      const dcx=x+s/2,dcy=y+s/2;
      g.save(); g.beginPath(); bodyPath(x,y,s,heff,1); g.clip();
      g.strokeStyle="#e8b873"; g.lineWidth=Math.max(2,s*0.1);
      g.beginPath(); g.arc(dcx,dcy,Math.max(0,s*0.47),0,TAU); g.stroke();
      g.beginPath(); g.arc(dcx,dcy,Math.max(0,s*0.16),0,TAU); g.stroke();
      g.restore();
      const sc=["#fff","#4db8ff","#ffd23f","#7be08a","#b58bff"];
      for(let i=0;i<8;i++){ const a=i/8*TAU+0.3, rr4=s*(0.26+0.03*(i%2));
        g.save(); g.translate(dcx+Math.cos(a)*rr4,dcy+Math.sin(a)*rr4); g.rotate(a*2+i);
        g.fillStyle=sc[i%sc.length]; g.fillRect(-s*0.06,-s*0.022,s*0.12,s*0.044); g.restore(); }
    } else if(isGinger){
      // ジンジャーマン: 目・口・白いボタン3つ・手足の白いアイシング
      g.fillStyle="#5a3420";
      g.beginPath(); g.arc(x+s*0.43,y+s*0.18,Math.max(0,s*0.03),0,TAU); g.arc(x+s*0.57,y+s*0.18,Math.max(0,s*0.03),0,TAU); g.fill();
      g.strokeStyle="#5a3420"; g.lineWidth=Math.max(1.4,s*0.03); g.lineCap="round";
      g.beginPath(); g.arc(x+s*0.5,y+s*0.21,Math.max(0,s*0.06),0.2*Math.PI,0.8*Math.PI); g.stroke();
      g.fillStyle="#fff";
      for(let i=0;i<3;i++){ g.beginPath(); g.arc(x+s*0.5,y+s*(0.42+0.1*i),Math.max(0,s*0.04),0,TAU); g.fill(); }
      g.strokeStyle="rgba(255,255,255,.9)"; g.lineWidth=Math.max(1.5,s*0.035);
      g.beginPath(); g.moveTo(x+s*0.1,y+s*0.44); g.lineTo(x+s*0.2,y+s*0.44);
      g.moveTo(x+s*0.8,y+s*0.44); g.lineTo(x+s*0.9,y+s*0.44);
      g.moveTo(x+s*0.22,y+s*0.88); g.lineTo(x+s*0.32,y+s*0.88);
      g.moveTo(x+s*0.68,y+s*0.88); g.lineTo(x+s*0.78,y+s*0.88); g.stroke();
    } else if(isTall){
      // ソフトクリーム: 下はワッフルのコーン、上はピンクの渦のクリームと赤いさくらんぼ
      g.save(); g.beginPath(); bodyPath(x,y,s,heff,1); g.clip();
      g.fillStyle="#e0a458"; g.fillRect(x,y+heff*0.6,s,heff*0.4+2);
      g.strokeStyle="rgba(120,70,30,.6)"; g.lineWidth=Math.max(1.5,s*0.035);
      for(let i=-3;i<=4;i++){ g.beginPath(); g.moveTo(x+s*(0.5+i*0.2),y+heff*0.6); g.lineTo(x+s*(0.5+i*0.2-0.35),y+heff); g.stroke();
        g.beginPath(); g.moveTo(x+s*(0.5+i*0.2),y+heff*0.6); g.lineTo(x+s*(0.5+i*0.2+0.35),y+heff); g.stroke(); }
      g.strokeStyle="rgba(255,143,179,.75)"; g.lineWidth=Math.max(2,s*0.07); g.lineCap="round";
      for(let i=0;i<3;i++){ const yy=y+heff*(0.22+0.15*i); g.beginPath(); g.moveTo(x+s*0.1,yy+s*0.1); g.quadraticCurveTo(x+s*0.5,yy-s*0.1,x+s*0.9,yy+s*0.1); g.stroke(); }
      g.restore();
      g.fillStyle="#ff3d5a"; g.beginPath(); g.arc(x+s*0.5,y+heff*0.02,Math.max(0,s*0.1),0,TAU); g.fill();
      g.fillStyle="rgba(255,255,255,.7)"; g.beginPath(); g.arc(x+s*0.47,y+heff*0.02-s*0.03,Math.max(0,s*0.03),0,TAU); g.fill();
    } else if(isBig){
      // 軸7対策: おおきいアメ = うずまき模様のジャイアントキャンディ玉(大小の対比)
      g.save(); g.beginPath(); bodyPath(x,y,s,heff,1); g.clip();
      g.strokeStyle="rgba(255,255,255,.55)"; g.lineWidth=Math.max(2,s*0.07);
      for(let i=0;i<3;i++){ g.beginPath(); g.ellipse(x+s/2,y+heff/2,Math.max(0,s*(0.12+i*0.11)),Math.max(0,heff*(0.12+i*0.14)),0,0,TAU); g.stroke(); }
      g.restore();
      // 頭に小さなキャンディの結び目(ラッピングの端)を付けて「アメ玉」感を出す
      g.fillStyle=lighten(t.col,20);
      g.beginPath(); g.moveTo(x+s*0.5,y); g.lineTo(x+s*0.36,y-heff*0.06); g.lineTo(x+s*0.64,y-heff*0.06); g.closePath(); g.fill();
    } else {
      // gummy/gummyb: ふにゃっと丸いジェリー玉 = jelly shine dot + soft inner glow
      g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=0.4;
      g.fillStyle=lighten(t.col,40);
      g.beginPath(); g.arc(x+s*0.5,isChibi?y+s*0.72:y+s*0.55,Math.max(0,isChibi?s*0.12:s*0.22),0,TAU); g.fill();
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
      // 軸6対策: 濃い輪郭線で背景(ピンクの道・緑の芝)から浮かせる
      g.strokeStyle="rgba(90,42,68,.55)"; g.lineWidth=3; g.lineJoin="round";
      g.beginPath(); bodyPath(x,y,s,heff,1); g.stroke();
      g.lineJoin="miter";
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
