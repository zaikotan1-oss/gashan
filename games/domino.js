function buildDomino(api){
  const g=api.g;
  api.preload(["bg.jpg","bomb.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。特大は生成不良のため手描き固定
  // bomb.png の実測(512角): 球の中心 = (0.582,0.52)・球の直径 = 0.575・導火線の先端 ≈ (0.617,0.156)・足元 ≈ 0.88
  //   → 球の直径が当たり判定 2r より一回り大きい 2.1r になるよう、スプライトを 3.65r 角で描き、球中心が原点に来るようずらす。
  const IMG_S=3.65,IMG_OX=-(0.582-0.5)*IMG_S,IMG_OY=-(0.52-0.5)*IMG_S,IMG_FX=(0.617-0.582)*IMG_S,IMG_FY=(0.156-0.52)*IMG_S-0.12;
  function drawBombImg(r){return api.drawAsset("bomb.png",IMG_OX*r,IMG_OY*r,IMG_S*r,IMG_S*r,{center:true});}
  let bombs=[],pending=[],rings=[],shards=[],sparks=[],floats=[],glints=[],motes=[],crumbles=[],topples=[];
  let bestChain=0,clearBest=0,clearNewRecord=false;   // 軸5: この遊びの中での さいこうれんさ(保存はしない)
  let CONNR,baseConnR,count,total,chain,maxChain,flash,megaFlash,hintT,bgT,hitCd;
  // stage / progression state
  const MAXSTAGE=5;
  let stage,stageBombs,banner,clearT,clearStars,clearChain,clearCount,allClear,clearPerfect,ambientT;
  let lap=0,goldMode=false,lapPerfect=true,nextGold=false,hudStars=0,starPop=[0,0,0];   // 軸5: 2しゅうめ・きんいろ・HUDの★目標
  // per-stage warm/cool accent palette so the board "looks different" over time
  const STAGE_TINT=["#ffd9a0","#a7d8ff","#cdb6ff","#9bff9b","#ff9bd0"];
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  // ② きょうのラッキー色: 色ばくだんが持つ色相の中から毎プレイ1色を秘密に選ぶ
  const LHUES=[0,120,200,300,40];
  const HUENAME={0:"あか",120:"みどり",200:"あお",300:"むらさき",40:"きいろ"};
  let luckyHue,luckyName,luckyTaught,luckyMsgT;   // ②
  let rbMsgT;                                     // ① にじいろばくだん 発見バナー
  let chainStarts;                                // ③ パーフェクト(ワンチェイン)判定用
  let shootStar,starTimer;                        // ④ ながれ星 ひみつ発見
  function layout(){baseConnR=clamp(api.W*0.10,55,120);applyConnR();}
  function applyConnR(){const sh=stage?stage:1;CONNR=baseConnR*clamp(1.0-sh*0.06,0.62,1);} // 7〜8歳向け: 吸着半径を狭め、面が進んでも広がりすぎないようにする
  function reset(){bombs=[];pending=[];rings=[];shards=[];sparks=[];floats=[];glints=[];motes=[];crumbles=[];topples=[];lap=0;goldMode=false;lapPerfect=true;nextGold=false;hudStars=0;starPop=[0,0,0];bestChain=0;clearBest=0;clearNewRecord=false;count=0;total=0;chain=0;maxChain=0;flash=0;megaFlash=0;hintT=0;bgT=0;hitCd=0;
    stage=1;banner=0;clearT=0;clearStars=0;allClear=false;clearPerfect=false;
    luckyHue=pick(LHUES);luckyName=HUENAME[luckyHue];luckyTaught=false;luckyMsgT=0;rbMsgT=0;
    shootStar=null;starTimer=rint(280,520);
    layout();
    // ambient drifting light motes (parallax)
    for(let i=0;i<26;i++)motes.push(mkMote());
    startStage(1);}
  function startStage(n){
    stage=n;applyConnR();bombs=[];pending=[];chain=0;maxChain=0;count=0;allClear=false;
    hintT=0;crumbles=[];topples=[];hudStars=0;
    chainStarts=0; // ③ このステージで火をつけた回数(=1なら ワンチェイン=パーフェクト)
    stageBombs=4+n*2+Math.floor(n/2)+Math.min(lap,3)*2; // 6,9,11,14,16（7〜8歳向けに 5,7,9,11,13 から約25%増）。2しゅうめ以降は+2ずつ
    banner=150;
    // 軸5修正(外れタップでの無限増殖を撤廃)で盤面が疎になった分、狙いが下手でも一定間隔で何かが起きるよう
    // 「時限ばくだん」の呼び水を1個だけ時間差で撒く(仕組みは既存のtimed型そのまま・演出/スコアは増やさない)。
    ambientT=rint(200,300);
    api.tone(520,0.1,"sine",0.12);api.tone(780,0.12,"sine",0.1);api.slide(400,820,0.25,0.1,"triangle");
    // 配置: 見た目が重ならない下限(約2.5r)まで詰めて置き、さらに「クラスター」(既に置いた爆弾から CONNR*0.55〜0.85 の距離)を
    // 混ぜて、どの面にも 2〜4 個のつながる鎖が必ず1本以上できるようにする(ドミノの名前どおり1タップで次々つながる)。
    const XL=api.W*0.16,XR=api.W*0.84,YT=api.H*0.18,YB=api.H*0.78;
    const tries=stageBombs*12;let placed=0;
    const fits=(x,y,r,k)=>{for(const o of bombs){if(Math.hypot(o.x-x,o.y-y)<(o.r+r)*k)return false;}return true;};
    for(let a=0;a<tries&&placed<stageBombs;a++){
      // 1面は 最初に特大(木箱)・2個目に積み木箱・3個目にドミノの列を保証: 最初の10秒から丸以外が4形見える
      const type=(n===1&&placed===0)?"big":(n===1&&placed===1)?"stack":(n===1&&placed===2)?"row":rollType(n);
      const nb=mkBomb(0,0,type);
      // 最初の2個は必ず鎖に(連鎖を最初に体験させる)、以降は約1/3をクラスターに
      const cluster=placed>0&&(placed<3||placed%3===1||Math.random()<0.25);
      let x,y,ok=false;
      if(cluster){
        const an=bombs[rint(0,bombs.length-1)];
        const lo=Math.max(CONNR*0.55,(an.r+nb.r)*1.12),hi=Math.min(reachOf(an),CONNR*nb.sz)*0.95;
        const d=hi>lo?rnd(lo,hi):Math.min(lo,hi*1.0);
        const ang=rnd(0,TAU);x=an.x+Math.cos(ang)*d;y=an.y+Math.sin(ang)*d;
        ok=x>=XL&&x<=XR&&y>=YT&&y<=YB&&fits(x,y,nb.r,1.1);
      }else{
        x=rnd(XL,XR);y=rnd(YT,YB);ok=fits(x,y,nb.r,1.25);
      }
      if(ok){nb.x=x;nb.y=y;bombs.push(nb);placed++;}
    }
    while(bombs.length<stageBombs)bombs.push(mkBomb(rnd(XL,XR),rnd(YT,YB),rollType(n)));
  }
  // stage cleared: tally results, star rating, fire celebration
  function clearStage(){
    // ③ パーフェクト(ワンチェイン): たった一度の点火でステージ全部を片づけたらボーナス。
    //    「どこに火をつけると全部つながるか」を考える隠しごほうび(気づかなくてもクリアは可能)。
    // 軸6: 古い文字(れんさ！など)がクリア画面の題字・星と重ならないよう、上の安全帯より下の文字は片づける
    floats=floats.filter(f=>f.life>0&&f.y<api.H*0.2);luckyMsgT=0;rbMsgT=Math.min(rbMsgT,25);
    clearPerfect=(chainStarts===1);
    if(clearPerfect){count+=5;total+=5;api.setScore(total);}
    clearChain=maxChain;clearCount=count;
    // 星の条件は「その面の爆弾の数」に対する割合(1面6個でも・5面16個でも 3つ/2つに届く)
    clearStars=maxChain>=Math.max(4,Math.ceil(stageBombs*0.7))?3:maxChain>=Math.max(3,Math.ceil(stageBombs*0.4))?2:1;
    // さいこうれんさ(きろく): 前より伸びたら「しんきろく！」
    if(clearStars<3)lapPerfect=false;   // 5面ぜんぶ★3の周だけ 次の周が きんいろ
    clearNewRecord=(bestChain>=2&&maxChain>bestChain);
    if(maxChain>bestChain)bestChain=maxChain;
    clearBest=bestChain;
    allClear=(stage>=MAXSTAGE);
    nextGold=allClear&&lapPerfect;
    clearT=allClear?260:160;
    flash=Math.max(flash,0.7);megaFlash=Math.max(megaFlash,allClear?1:0.7);
    api.shake(allClear?40:24);api.boom(allClear?0.7:0.5);
    if(api._celebrate)try{api._celebrate();}catch(e){}
    // victory fanfare (ascending arpeggio)
    const notes=allClear?[523,659,784,1047,1319]:[523,659,784,1047];
    for(let i=0;i<notes.length;i++)api.tone(notes[i],0.16,"triangle",0.13);
    api.slide(400,allClear?1500:1100,0.35,0.12,"sine");
    // celebratory glints burst from center
    for(let k=0;k<(allClear?40:24);k++){const a=rnd(0,TAU),s=rnd(2,7);
      glints.push({x:api.W/2,y:api.H*0.45,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.01,0.02),size:rnd(9,18),rot:rnd(0,TAU)});}
  }
  // choose a bomb type; rarer specials appear more as stages progress
  function rollType(n){
    const r=rnd(0,1);
    // ① にじいろばくだん: 2〜5%の激レア。虹色に光り、割ると虹の大演出＋大量得点。2しゅうめ以降は lap 倍(上限8%)
    const rainbow=clamp((0.02+n*0.006)*(1+lap),0.02,lap>0?0.08:0.05);
    if(r<rainbow)return"rainbow";
    // 軸7: ドミノの列(倒れる)・くるま(タイヤが転がる)は独立のくじで足す(他の種類の確率は動かさない)
    const r2=rnd(0,1);
    const row=clamp(0.04+n*0.02,0,0.12);
    if(r2<row)return"row";
    const car=n>=2?clamp(0.03*n,0,0.1):0;
    if(r2<row+car)return"car";
    const big=clamp(0.05+n*0.04,0,0.28); // 特大爆弾(大連鎖の起点)
    const stack=clamp(0.06+n*0.015,0,0.14); // 積み木箱(3段・崩れるように壊れる)
    const timed=clamp(0.18+n*0.04,0,0.4); // 時限自動着火。軸5修正(外れタップでの増殖廃止)で盤面が疎になった分、
    // タップに頼らず自動で連鎖が進む機会を増やし、狙いが下手でも詰まらないようにする(軸3のmaxQuietSec対策)。
    const color=clamp(0.04+n*0.03,0,0.24); // 色違い高得点(1面から低確率で登場)
    if(r<big)return"big";
    if(r<big+stack)return"stack";
    if(r<big+stack+timed)return"timed";
    if(r<big+stack+timed+color)return"color";
    return"normal";
  }
  function mkMote(){const z=rnd(0.3,1);return{x:rnd(0,api.W),y:rnd(0,api.H),z,r:lerp(1.2,4.5,z),vy:-lerp(0.08,0.32,z),drift:rnd(0,TAU),ds:rnd(0.004,0.01),col:pick(["#ffd9a0","#cdb6ff","#ffe27a","#a7d8ff"]),tw:rnd(0,TAU)};}
  function mkBomb(x,y,type){type=type||"normal";
    const baseR=clamp(api.W*0.04,20,32);
    // 軸7: 大きさに差をつける(ふつうは0.8〜1.25倍・特大は1.5倍)。reachOf も大きさに比例させる
    const sz=type==="big"?1.5:type==="normal"?rnd(0.8,1.25):1;
    // 軸7: ドミノの列は細長いので r を少し大きく(当たりの円 1.6r を指より大きく保つ)。くるまは横長なので r を更に大きく
    const r=type==="row"?baseR*1.15:type==="car"?baseR*1.25:baseR*sz;
    return{x,y,r,sz,type,state:"idle",t:0,fuse:rnd(0,TAU),sx:1,sy:1,born:1,bob:rnd(0,TAU),
      hue:type==="color"?pick([0,120,200,300,40]):0,
      armT:type==="timed"?rnd(70,150):0}; // timed: auto-ignite countdown (frames)。軸3/5対策で更に短縮(130-260→70-150)し、
      // タップが下手でも一定間隔で自動着火→連鎖が起きるようにする(=無反応タップが続く時間の保険)
  }
  // connection radius for a given bomb (big bombs reach 2x)
  function reachOf(b){return b.type==="big"?CONNR*1.4:CONNR*b.sz;}
  // 軸3: near()を1.6→1.3へ狭める案も試したが、軸5(盤面を0まで減らしてステージを進める)の到達率が
  // 90%→55%まで悪化したため見送り、1.6のまま据え置く(CONNRは変えていない)。
  // 軸3(a)の「雑タップでもろくに狙わず得点できる」対策は、外れタップでの無限増殖を止めたこと自体で
  // scorePerTapが0.79〜0.86→約0.25〜0.30まで下がっており、この効果で十分と判断した。
  function near(x,y){for(const b of bombs){if(Math.hypot(b.x-x,b.y-y)<b.r*1.6)return b;}return null;}
  function ignite(b,delay){if(b.state!=="idle")return;b.state="lit";b.t=delay||10;}
  function explode(b){
    b.state="boom";
    chain++;if(chain>maxChain)maxChain=chain;
    // scoring per type: rainbow=激レア大量 / color=high bonus / big=worth more
    const gain=b.type==="rainbow"?(goldMode?12:8):b.type==="row"||b.type==="car"?2:b.type==="color"?5:b.type==="big"?3:b.type==="stack"?2:1;
    // ② ラッキー色: 今日の秘密の色相の色ばくだんを割ると隠しボーナス(+2)
    const isLucky=b.type==="color"&&b.hue===luckyHue;
    const bonus=isLucky?2:0;
    count+=gain+bonus;total+=gain+bonus;api.setScore(total); // 表示は累計(ステージで下がらない)
    const isBig=b.type==="big";
    checkHudStars();
    const big=Math.min(0.2+chain*0.04,0.8)*(isBig?1.4:1);flash=Math.max(flash,big);
    api.slide(150-Math.min(chain*5,90),40,0.4,0.55,"sine");api.noise(0.3,0.45,700,"lowpass");
    api.tone(120+chain*8,0.12,"sine",0.25);
    if(isBig)api.boom(0.6);else if(chain>=4)api.boom(0.4);
    api.shake(clamp(8+chain*1.5,8,34)*(isBig?1.3:1));
    // hitStop は単発の大ヒットのみ: 特大爆弾かつ前回発動から30f以上あいたとき
    if(isBig&&hitCd<=0){api.hitStop(3);hitCd=30;}
    const rmul=b.sz||1;
    rings.push({x:b.x,y:b.y,r:b.r,max:b.r*4.2*rmul,life:1});
    rings.push({x:b.x,y:b.y,r:b.r*0.5,max:b.r*2.6*rmul,life:1});
    const cols=b.type==="color"?[hsl(b.hue,90,60),hsl(b.hue+30,90,70),"#ffffff","#ffd23f"]:b.type==="timed"?["#bcd4ff","#7ad8ff","#ffffff","#ffd23f"]:b.type==="stack"?["#c68b4e","#8f5a2a","#e0b070","#ffd23f"]:b.type==="row"?["#ffffff","#d8dcec","#2a2a35","#ffd23f"]:b.type==="car"?["#e8503a","#ffd23f","#ffffff","#3a3a40"]:["#ff8c2c","#ffd23f","#ff5b3b","#3a3a40"];
    // 軸7: 破片の形も種類ごとに変える(全て同じ矩形の割れ方だった)。木箱=木片(細長い矩形)/色ばくだん=星のかけら/その他=矩形。
    const shardShape=(isBig||b.type==="stack"||b.type==="row")?"plank":b.type==="color"?"star":b.type==="timed"?"gear":"rect";
    for(let k=rint(9,14)*(isBig?1.6:1)|0;k>0;k--){const a=rnd(0,TAU),s=rnd(3,9.5)*rmul;
      shards.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,s:rnd(4,10)*rmul,color:pick(cols),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.01,0.02),shape:shardShape});}
    for(let k=rint(12,18)*(isBig?1.5:1)|0;k>0;k--){const a=rnd(0,TAU),s=rnd(2,8)*rmul;
      sparks.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5.5)*rmul,life:1,decay:rnd(0.02,0.04),col:pick(b.type==="color"?[hsl(b.hue,95,70),hsl(b.hue+40,95,75),"#fff2a0"]:["#fff2a0","#ffd23f","#ff8c2c"])});}
    for(let k=rint(4,7);k>0;k--){const a=rnd(0,TAU),s=rnd(0.5,2.5);
      glints.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:rnd(0.018,0.03),size:rnd(7,14)*rmul,rot:rnd(0,TAU)});}
    // chain to neighbors (use this bomb's reach so big bombs spread wide)
    const reach=reachOf(b);
    // 軸7: ドミノの列は 隣へ向かって タイルが順に倒れる。倒れる向き=いちばん近い隣の向き。その向きの隣へは倒れ終わるころに火が移る
    let tdir=Math.random()<0.5?-1:1;
    if(b.type==="row"){let nd=1e9;for(const o of bombs){if(o.state!=="idle")continue;const d=Math.hypot(o.x-b.x,o.y-b.y);if(d<reach&&d<nd&&Math.abs(o.x-b.x)>2){nd=d;tdir=o.x>b.x?1:-1;}}}
    for(const o of bombs){if(o.state==="idle"&&Math.hypot(o.x-b.x,o.y-b.y)<reach){
      const fall=b.type==="row"&&(o.x-b.x)*tdir>=0;
      pending.push({b:o,delay:b.type==="row"?(fall?rnd(24,30):rnd(10,16)):rnd(6,12)});
    }}
    if(b.type==="row")makeTopples(b,tdir);
    if(b.type==="car")carWheels(b);
    // ① にじいろばくだん / ② ラッキー色 の特別演出
    if(b.type==="rainbow")rainbowBurst(b);
    if(isLucky)luckySparkle(b);
    // big-chain escalation: extra spectacle + a rain of bonus bombs
    // 軸5: 大連鎖の山は その面の爆弾の数に合わせる(1面6個なら 3連鎖と5連鎖)
    const m1=Math.max(3,Math.ceil(stageBombs*0.4)),m2=Math.max(m1+1,Math.ceil(stageBombs*0.7));
    if(chain===m1)megaChain(b,false);else if(chain===m2)megaChain(b,true);
    // 軸7: 積み木箱は「崩れる」: 段ごとに時間差でバラバラ崩れ落ちる
    if(b.type==="stack"){crumbles.push({x:b.x,y:b.y-b.r,delay:4},{x:b.x,y:b.y+b.r,delay:8},{x:b.x,y:b.y,delay:12});}
  }
  // HUDの★目標: 今の さいだいれんさ が 1/2/3つ目の条件に届いたら★を塗って小さく鳴らす
  function starTh(){return[1,Math.max(3,Math.ceil(stageBombs*0.4)),Math.max(4,Math.ceil(stageBombs*0.7))];}
  function checkHudStars(){const th=starTh();let ns=0;for(let i=0;i<3;i++)if(maxChain>=th[i])ns=i+1;
    if(ns>hudStars){for(let i=hudStars;i<ns;i++)starPop[i]=1;hudStars=ns;api.tone(1046,0.12,"triangle",0.1);if(ns>=2)api.tone(1318,0.14,"triangle",0.08);}}
  // ドミノの列: 細長いタイル4枚が 順に 80度まで倒れる(板状の破片と小さい輪つき)
  function makeTopples(b,dir){
    const h=b.r*1.7,w=b.r*0.4;
    for(let i=0;i<4;i++){const k=dir>0?i:3-i;
      topples.push({x:b.x+(i-1.5)*b.r*0.52,y:b.y+h/2,w,h,dir,k,delay:3+k*5,rot:0,vr:0.03,started:false,landed:false,fade:1});}
  }
  // くるま: タイヤが外れて飛び、地面で一度はねる
  function carWheels(b){
    for(const sg of[-1,1]){
      shards.push({x:b.x+sg*b.r*0.7,y:b.y+b.r*0.45,vx:sg*rnd(2.2,4.5),vy:-rnd(5,8),s:Math.max(4,b.r*0.34),color:"#2a2a30",rot:rnd(0,TAU),vr:sg*rnd(0.2,0.35),life:1,decay:0.006,shape:"wheel",bn:false});}
  }
  // ① にじいろばくだん 撃破: 虹の輪＋虹色スパーク＋大バナー(激レアの爽快ごほうび)。
  //    白飛び防止のためフラッシュは上限つき・短命。
  function rainbowBurst(b){
    rbMsgT=120;
    flash=Math.min(Math.max(flash,0.6),0.8);megaFlash=Math.max(megaFlash,0.6);
    api.boom(0.6);api.shake(18);
    api.slide(660,1320,0.4,0.16,"triangle");api.tone(880,0.14,"triangle",0.12);api.tone(1320,0.16,"triangle",0.1);
    for(let k=0;k<6;k++)rings.push({x:b.x,y:b.y,r:b.r,max:b.r*(3.2+k*0.8),life:1,col:goldMode?hsl(36+k*5,95,62):hsl(k*60,90,66)});
    for(let k=0;k<26;k++){const a=rnd(0,TAU),s=rnd(3,10);
      sparks.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(3,6),life:1,decay:rnd(0.02,0.035),col:goldMode?hsl(36+(k%5)*6,95,66):hsl(k*40,95,68)});}
    if(sparks.length>240)sparks.splice(0,sparks.length-240);
  }
  // ② ラッキー色 命中: 頭上に小さな星のキラッ＋控えめな祝福(白飛びしない)。
  function luckySparkle(b){
    api.tone(1046,0.14,"triangle",0.11);api.tone(1568,0.16,"triangle",0.08);
    floats.push({x:b.x,y:b.y-b.r*1.7,txt:"ラッキー！",col:hsl(luckyHue,90,66),life:0.9,vy:-0.7,size:28,pop:0});
    for(let k=0;k<3;k++)glints.push({x:b.x+rnd(-b.r,b.r),y:b.y-b.r-rnd(0,b.r*0.8),vx:rnd(-1,1),vy:-rnd(1,2),life:1,decay:0.02,size:rnd(8,13),rot:rnd(0,TAU)});
  }
  function hsl(h,s,l){return"hsl("+((h%360)+360)%360+","+s+"%,"+l+"%)";}
  // mega-chain reward: huge flash, slow-mo, fanfare, bonus bombs rain in
  function megaChain(b,hi){
    const c=hi?10:5;
    megaFlash=Math.max(megaFlash,c>=10?1:0.8);
    api.shake(c>=10?38:30);if(hitCd<=0){api.hitStop(c>=10?10:7);hitCd=40;}api.boom(c>=10?0.7:0.55);
    // ascending fanfare
    const base=c>=10?523:392;
    api.tone(base,0.12,"triangle",0.18);
    api.slide(base,base*1.5,0.18,0.16,"triangle");
    api.tone(base*2,0.2,"sine",0.14);
    floats=floats.filter(f=>f.txt!=="おおれんさ！"&&f.txt!=="だいばくはつ！");
    floats.push({x:api.W/2,y:api.H*0.3,txt:c>=10?"だいばくはつ！":"おおれんさ！",col:c>=10?"#ff3b3b":"#ff8c42",life:1.3,vy:-0.6,size:c>=10?64:52,pop:0});
    // bonus bombs rain down (collapse back into the board for a positive loop)
    const n=c>=10?3:2;
    for(let i=0;i<n;i++){
      const nb=mkBomb(rnd(api.W*0.2,api.W*0.8),rnd(api.H*0.15,api.H*0.7),pick(c>=10?["color","big","color"]:["color","normal","color"]));
      nb.born=1.4;bombs.push(nb);
      glints.push({x:nb.x,y:nb.y,vx:0,vy:-1.5,life:1,decay:0.02,size:16,rot:0});
    }
  }
  // soft 4-point star glint
  function star(x,y,sz,rot,alpha,col){
    g.save();g.globalAlpha=alpha;g.translate(x,y);g.rotate(rot);
    g.fillStyle=col;g.beginPath();
    for(let i=0;i<4;i++){const a=i*(TAU/4);
      g.lineTo(Math.cos(a)*sz,Math.sin(a)*sz);
      g.lineTo(Math.cos(a+TAU/8)*sz*0.22,Math.sin(a+TAU/8)*sz*0.22);}
    g.closePath();g.fill();
    g.globalAlpha=alpha*0.9;g.beginPath();g.arc(0,0,sz*0.22,0,TAU);g.fill();
    g.restore();
  }
  // ④ ながれ星の描画: 尾を引く小さな流星(加算合成は控えめ・すぐ消える)
  function drawShootStar(ss){
    g.save();g.globalCompositeOperation="lighter";
    for(let i=0;i<ss.tail.length;i++){const t=ss.tail[i],a=i/ss.tail.length;
      g.globalAlpha=a*0.5*ss.life;g.fillStyle="#bfe3ff";g.beginPath();g.arc(t.x,t.y,1+a*2.4,0,TAU);g.fill();}
    g.globalAlpha=Math.max(0,ss.life);g.fillStyle="#fff6c8";g.beginPath();g.arc(ss.x,ss.y,3.2,0,TAU);g.fill();
    star(ss.x,ss.y,7*ss.life,bgT*0.02,0.75*ss.life,"#fff2a0");
    g.restore();g.globalAlpha=1;
  }
  reset();
  return{
    resize:layout,
    input(px,py,type){
      if(type!=="down")return;
      if(clearT>0)return; // ignore taps during clear celebration
      // ④ ながれ星タップ: ばくだん判定より先に。空を横切る星をタップできたら小さなごほうび(減点なし)。
      if(shootStar&&Math.hypot(px-shootStar.x,py-shootStar.y)<Math.max(36,api.W*0.07)){
        const ss=shootStar;total+=1;count+=1;api.setScore(total);
        api.tone(1318,0.1,"triangle",0.1);api.tone(1976,0.12,"triangle",0.07);
        for(let k=0;k<10;k++){const a=rnd(0,TAU),s=rnd(2,6);
          glints.push({x:ss.x,y:ss.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.015,0.03),size:rnd(8,15),rot:rnd(0,TAU)});}
        floats.push({x:ss.x,y:ss.y-18,txt:"コイン＋1",col:"#ffe27a",life:0.9,vy:-0.8,size:26,pop:0});
        shootStar=null;return;
      }
      const b=near(px,py);
      if(b){if(b.state==="idle"){chain=0;chainStarts++;ignite(b,4);api.tone(900,0.06,"square",0.08);api.tone(1300,0.05,"sine",0.05);}}
      // 軸5: 外れタップのたびに新しい爆弾が増え続け(上限44)、撃破速度を上回ってステージが一度も進まなかった不具合を修正。
      // 上限をどれだけ下げても「外れれば増える」仕組みが残る限り0に落ちきらない(=常にクリア不能になり得る)ため、
      // 外れタップでは的を増やさないことにする。無反応タップ(音も無し)にしないよう、当たり音(900→1300上昇)とは
      // はっきり違う「すかっ」という下降2音を鳴らし、当たり/外れの違いも音で分かるようにする(軸2のsfxPerMin維持)。
      else{api.tone(240,0.05,"triangle",0.07);api.tone(150,0.05,"sine",0.05);}
    },
    frame(dt,now){
      bgT+=dt;if(hitCd>0)hitCd-=1; // 実フレーム基準で減算(凍結中もカウント)
      // bg: 画像(夜の草原)があればそれを敷き、ステージ色をごく薄く重ねて面ごとの雰囲気を変える。
      //     無ければ従来の手描き(グラデ+中央のほのかな紫光)。
      let imgBg=false;
      if(api.drawCover("bg.jpg")){imgBg=true;
        if(stage>1){g.save();g.globalAlpha=0.10;g.fillStyle=STAGE_TINT[(stage-1)%STAGE_TINT.length];g.fillRect(0,0,api.W,api.H);g.restore();}
      }
      if(!imgBg){
        let grd=g.createLinearGradient(0,0,0,api.H);grd.addColorStop(0,"#2e2742");grd.addColorStop(0.55,"#1d1730");grd.addColorStop(1,"#100c1a");
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
        const rg=g.createRadialGradient(api.W*0.5,api.H*0.42,0,api.W*0.5,api.H*0.42,Math.max(0,Math.max(api.W,api.H)*0.7));
        rg.addColorStop(0,"rgba(120,90,180,0.18)");rg.addColorStop(1,"rgba(0,0,0,0)");
        g.fillStyle=rg;g.fillRect(0,0,api.W,api.H);
      }
      // ambient drifting light motes (parallax, additive)
      g.save();g.globalCompositeOperation="lighter";
      for(const m of motes){m.y+=m.vy*dt;m.drift+=m.ds*dt;m.tw+=0.04*dt;
        m.x+=Math.sin(m.drift)*0.3*m.z*dt;
        if(m.y<-8){m.y=api.H+8;m.x=rnd(0,api.W);}
        const tw=0.45+0.55*(0.5+0.5*Math.sin(m.tw));
        g.globalAlpha=0.10*m.z*tw;g.fillStyle=m.col;g.beginPath();g.arc(m.x,m.y,m.r*2.6,0,TAU);g.fill();
        g.globalAlpha=0.5*m.z*tw;g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;
      // connections (fuses between idle bombs) with animated dash + glow
      g.lineCap="round";
      const dashPhase=-(bgT*0.6)%13;
      for(let i=0;i<bombs.length;i++)for(let j=i+1;j<bombs.length;j++){
        const a=bombs[i],b=bombs[j];if(a.state==="boom"||b.state==="boom")continue;
        const d=Math.hypot(a.x-b.x,a.y-b.y);const rch=Math.max(reachOf(a),reachOf(b));if(d<rch){
          const k=1-d/rch;
          // soft glow underlay
          g.strokeStyle="rgba(255,190,110,"+(0.06+0.10*k)+")";g.lineWidth=8;
          g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
          // crisp animated fuse dash
          g.strokeStyle="rgba(225,180,100,"+(0.30+0.30*k)+")";g.lineWidth=3;
          g.setLineDash([6,7]);g.lineDashOffset=dashPhase;
          g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();g.setLineDash([]);g.lineDashOffset=0;
        }
      }
      // bomb timers
      for(const b of bombs){if(b.state==="lit"){b.t-=dt;b.fuse+=0.4*dt;if(b.t<=0)explode(b);}
        // timed bomb: counts down while idle, then auto-ignites itself
        if(b.type==="timed"&&b.state==="idle"&&clearT<=0&&banner<=0){b.armT-=dt;if(b.armT<=40){b.fuse+=0.5*dt;}if(b.armT<=0){chain=0;chainStarts++;ignite(b,4);api.tone(700,0.06,"square",0.07);}}
        b.born=Math.max(0,b.born-0.08*dt);b.bob+=0.05*dt;
        b.sx+=(1-b.sx)*0.2*dt;b.sy+=(1-b.sy)*0.2*dt;}
      // ② きょうのラッキー色の初回ヒント: 今日の色の色ばくだんが盤に現れたら一度だけ中央上に教える
      if(!luckyTaught&&banner<=0&&clearT<=0&&bombs.some(b=>b.type==="color"&&b.hue===luckyHue&&b.state==="idle")){
        luckyTaught=true;luckyMsgT=150;api.tone(880,0.1,"sine",0.09);api.tone(1320,0.12,"sine",0.07);
      }
      // 軸3/5対策: 外れタップでの増殖(旧仕様)を撤廃した代わりに、時間経過だけで低頻度に
      // 「時限ばくだん」を1個だけ差し込む呼び水。仕組み・演出・当たり判定は既存のtimed型を丸ごと再利用するだけで、
      // 新しいゲーム性は増やさない。自分で短時間のうちに着火するので盤面に居座って増え続けることはない。
      if(clearT<=0&&banner<=0&&bombs.length>0){
        ambientT-=dt;
        if(ambientT<=0){
          const nb=mkBomb(rnd(api.W*0.2,api.W*0.8),rnd(api.H*0.2,api.H*0.75),"timed");
          nb.armT=rnd(50,110);bombs.push(nb);
          ambientT=rint(200,300);
        }
      }
      // pending chain
      for(const p of pending)p.delay-=dt;
      const go=pending.filter(p=>p.delay<=0);pending=pending.filter(p=>p.delay>0);
      for(const p of go)ignite(p.b,4);
      // remove boomed after a tick (keep ring/shards)
      bombs=bombs.filter(b=>b.state!=="boom");
      // 積み木箱の崩れ: 段ごとに時間差で木片がバラバラ落ちる
      for(const c of crumbles)c.delay-=dt;
      for(const c of crumbles){if(c.delay>0)continue;
        api.tone(200+rint(0,60),0.07,"triangle",0.1);api.noise(0.12,0.2,900,"lowpass");api.shake(7);
        rings.push({x:c.x,y:c.y,r:6,max:34,life:0.8});
        for(let k=rint(5,8);k>0;k--){const a=rnd(0,TAU),s2=rnd(2,6);
          shards.push({x:c.x,y:c.y,vx:Math.cos(a)*s2,vy:Math.sin(a)*s2-1,s:rnd(4,9),color:pick(["#c68b4e","#8f5a2a","#e0b070"]),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.012,0.022),shape:"plank"});}
        for(let k=0;k<4;k++){const a=rnd(0,TAU),s2=rnd(1.5,5);
          sparks.push({x:c.x,y:c.y,vx:Math.cos(a)*s2,vy:Math.sin(a)*s2,r:rnd(2,4),life:1,decay:rnd(0.03,0.05),col:pick(["#fff2a0","#ffd23f"])});}}
      crumbles=crumbles.filter(c=>c.delay>0);
      // ドミノの列のタイル: 順にバタバタ倒れる(倒れた先で板片がはじける)
      for(const t of topples){t.delay-=dt;
        if(t.delay<=0){
          if(!t.started){t.started=true;api.tone(260+t.k*70,0.06,"triangle",0.1);
            for(let k=0;k<3;k++){const a=rnd(0,TAU),s2=rnd(1.5,4);
              shards.push({x:t.x,y:t.y-t.h*0.5,vx:Math.cos(a)*s2+t.dir*2,vy:Math.sin(a)*s2-1.5,s:rnd(4,8),color:pick(["#ffffff","#d8dcec","#2a2a35"]),rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.014,0.024),shape:"plank"});}}
          if(!t.landed){t.vr+=0.014*dt;t.rot+=t.vr*dt;
            if(t.rot>=1.4){t.rot=1.4;t.landed=true;api.noise(0.08,0.2,900,"lowpass");api.shake(4);
              rings.push({x:t.x+t.dir*t.h*0.8,y:t.y-t.h*0.1,r:5,max:Math.max(24,t.h*0.5),life:0.8});
              for(let k=0;k<3;k++)sparks.push({x:t.x+t.dir*t.h*0.8,y:t.y-4,vx:rnd(-2,2),vy:-rnd(1,3),r:rnd(2,3.5),life:1,decay:rnd(0.03,0.05),col:"#fff2a0"});}}
          else t.fade-=0.03*dt;}
        const al=clamp(t.fade,0,1);
        g.save();g.globalAlpha=al;g.translate(t.x+t.dir*t.w/2,t.y);g.rotate(t.dir*t.rot);
        drawTile(t.dir>0?-t.w:0,-t.h,t.w,t.h,t.w*0.5);
        g.restore();}
      topples=topples.filter(t=>t.fade>0);
      // 最初の3秒 何も着火していない時だけ、いちばん真ん中に近いばくだんのまわりに脈打つ輪(「ここをタッチ」の合図)
      if(stage===1&&chainStarts===0&&banner<=0&&clearT<=0)hintT+=dt;
      // draw bombs
      for(const b of bombs)drawBomb(b);
      if(hintT>180&&chainStarts===0&&clearT<=0){
        let hb=null,hd=1e9;
        for(const b of bombs){if(b.state!=="idle")continue;const d=Math.hypot(b.x-api.W/2,b.y-api.H/2);if(d<hd){hd=d;hb=b;}}
        if(hb){const ph=(hintT-180)*0.07,k=ph-Math.floor(ph);
          g.save();g.lineWidth=5-3*k;
          g.strokeStyle="rgba(255,236,150,"+(0.9-0.7*k)+")";
          g.beginPath();g.arc(hb.x,hb.y,Math.max(0,hb.r*(1.5+k*1.0)),0,TAU);g.stroke();
          g.strokeStyle="rgba(255,150,60,"+(0.7-0.5*k)+")";g.lineWidth=3;
          g.beginPath();g.arc(hb.x,hb.y,Math.max(0,hb.r*(1.3+k*0.7)),0,TAU);g.stroke();
          g.restore();}
      }
      // rings: bright core + warm halo, additive feel
      g.save();g.globalCompositeOperation="lighter";
      for(const r of rings){r.r+=(r.max-r.r)*0.2*dt;r.life-=0.05*dt;
        const al=Math.max(0,r.life);
        g.globalAlpha=al*0.5;g.strokeStyle=r.col||"rgba(255,140,50,1)";g.lineWidth=14*al;g.beginPath();g.arc(r.x,r.y,r.r*0.72,0,TAU);g.stroke();
        g.globalAlpha=al;g.strokeStyle=r.col||"#ffe27a";g.lineWidth=5*al+1;g.beginPath();g.arc(r.x,r.y,r.r,0,TAU);g.stroke();}
      g.restore();g.globalAlpha=1;rings=rings.filter(r=>r.life>0);
      // shards (軸7: 種類ごとに壊れ方の形も変える)
      for(const p of shards){p.vy+=0.25*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.life-=p.decay*dt;
        // くるまのタイヤ: 地面で一度はねる
        if(p.shape==="wheel"&&!p.bn&&p.vy>0&&p.y>api.H*0.85){p.y=api.H*0.85;p.vy=-Math.abs(p.vy)*0.6;p.bn=true;api.tone(180,0.07,"triangle",0.1);
          for(let k=0;k<3;k++)sparks.push({x:p.x,y:p.y+p.s,vx:rnd(-2,2),vy:-rnd(0.5,2),r:rnd(2,3.5),life:1,decay:rnd(0.04,0.06),col:"#e0c98a"});}
        const al=Math.max(0,p.life);
        if(p.shape==="star"){star(p.x,p.y,Math.max(0,p.s*0.75),p.rot,al,p.color);continue;}
        g.save();g.globalAlpha=al;g.translate(p.x,p.y);g.rotate(p.rot);g.fillStyle=p.color;
        if(p.shape==="wheel"){const wr=Math.max(0,p.s);g.fillStyle="#26262c";g.beginPath();g.arc(0,0,wr,0,TAU);g.fill();
          g.strokeStyle="rgba(255,255,255,.55)";g.lineWidth=2;g.stroke();
          g.fillStyle="#b9bcc8";g.beginPath();g.arc(0,0,wr*0.38,0,TAU);g.fill();
          g.strokeStyle="#b9bcc8";g.lineWidth=2;for(let t=0;t<4;t++){g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(t*TAU/4)*wr*0.9,Math.sin(t*TAU/4)*wr*0.9);g.stroke();}}
        else if(p.shape==="plank")g.fillRect(-p.s*1.3,-p.s*0.35,Math.max(0,p.s*2.6),Math.max(0,p.s*0.7));
        else if(p.shape==="gear"){const gr=Math.max(0,p.s*0.55);g.beginPath();g.arc(0,0,gr,0,TAU);g.fill();
          for(let t=0;t<6;t++){g.save();g.rotate(t*TAU/6);g.fillRect(-gr*0.28,-gr*1.45,gr*0.56,gr*0.7);g.restore();}
          g.fillStyle="rgba(20,30,60,.55)";g.beginPath();g.arc(0,0,gr*0.32,0,TAU);g.fill();}
        else g.fillRect(-p.s/2,-p.s/2,p.s,p.s);
        g.restore();}
      shards=shards.filter(p=>p.life>0);
      // sparks (glowing, additive)
      g.save();g.globalCompositeOperation="lighter";
      for(const s of sparks){s.vy+=0.15*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=s.decay*dt;
        const al=Math.max(0,s.life);
        g.globalAlpha=al*0.4;g.fillStyle=s.col;g.beginPath();g.arc(s.x,s.y,s.r*2.2,0,TAU);g.fill();
        g.globalAlpha=al;g.beginPath();g.arc(s.x,s.y,s.r,0,TAU);g.fill();}
      g.restore();g.globalAlpha=1;sparks=sparks.filter(s=>s.life>0);
      // glints (sparkle stars)
      g.save();g.globalCompositeOperation="lighter";
      for(const gl of glints){gl.vy+=0.06*dt;gl.x+=gl.vx*dt;gl.y+=gl.vy*dt;gl.life-=gl.decay*dt;gl.rot+=0.06*dt;
        const al=Math.max(0,gl.life);star(gl.x,gl.y,gl.size*al,gl.rot,al,"#fff6c8");}
      g.restore();g.globalAlpha=1;glints=glints.filter(gl=>gl.life>0);
      // ④ ながれ星: ときどき空をスッと横切る。タップできれば小さなごほうび(input側で処理)。
      if(!shootStar&&clearT<=0){starTimer-=dt;if(starTimer<=0){
        const fromL=Math.random()<0.5;
        shootStar={x:fromL?-24:api.W+24,y:rnd(api.H*0.10,api.H*0.38),
          vx:(fromL?1:-1)*rnd(5,8),vy:rnd(1.4,2.8),life:1,tail:[]};
        starTimer=rint(360,680);
      }}
      if(shootStar){const ss=shootStar;ss.x+=ss.vx*dt;ss.y+=ss.vy*dt;ss.life-=0.006*dt;
        ss.tail.push({x:ss.x,y:ss.y});if(ss.tail.length>10)ss.tail.shift();
        if(ss.x<-48||ss.x>api.W+48||ss.y>api.H*0.62||ss.life<=0)shootStar=null;else drawShootStar(ss);}
      // flash (warm full-screen bloom)
      if(flash>0){g.save();g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(255,180,90,"+flash*0.45+")";g.fillRect(0,0,api.W,api.H);
        g.restore();flash-=0.05*dt;}
      // mega flash (extra big-chain bloom over the whole screen)
      if(megaFlash>0){g.save();g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(255,230,150,"+megaFlash*0.5+")";g.fillRect(0,0,api.W,api.H);
        g.restore();megaFlash-=0.035*dt;}
      // end of chain -> show count
      const active=pending.length>0||bombs.some(b=>b.state==="lit");
      if(!active&&chain>0){
        if(chain>=2)floats.push({x:api.W/2,y:api.H*0.4,txt:chain+"れんさ！",col:chain>=10?"#ff3b3b":chain>=5?"#ff8c42":"#ffd23f",life:1,vy:-0.7,size:chain>=8?56:42,pop:0});
        chain=0;
      }
      // stage clear: all bombs cleared during this stage (and none mid-flight)
      if(clearT<=0&&banner<=0&&bombs.length===0&&!active&&pending.length===0){
        clearStage();
      }
      // stage banner countdown
      if(banner>0)banner-=dt;
      // clear-celebration handling
      if(clearT>0){clearT-=dt;if(clearT<=0){
        if(allClear){lap++;goldMode=nextGold;lapPerfect=true;startStage(1);} else {startStage(stage+1);}
      }}
      // floats (with pop-in scale + glow)
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.012*dt;f.pop+=(1-f.pop)*0.25*dt;
        const al=Math.max(0,f.life),sc=0.6+0.4*f.pop+(1-Math.min(f.pop,1))*0.15;
        g.save();g.globalAlpha=al;g.translate(f.x,f.y);g.scale(sc,sc);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=al*0.5;g.fillStyle=f.col;
        g.shadowColor=f.col;g.shadowBlur=24;g.fillText(f.txt,0,0);g.restore();
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,0,0);g.fillStyle=f.col;g.fillText(f.txt,0,0);
        g.restore();}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // ① にじいろ！ 中央バナー(虹色に色替わり=激レアの大きな祝福 / 上部中央=安全帯)
      if(rbMsgT>0){rbMsgT-=dt;
        const p=clamp(rbMsgT/120,0,1),pop=1+Math.max(0,p-0.7)*1.3,col=goldMode?hsl(45,95,62):hsl((bgT*4)%360,90,68);
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(p*1.6,0,1);g.font="900 "+clamp(api.W*0.1,40,72)+"px 'Hiragino Maru Gothic ProN',system-ui";
        const rbt=goldMode?"きんいろ！":"にじいろ！";
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=clamp(p,0,1)*0.5;g.shadowColor=col;g.shadowBlur=26;g.fillStyle=col;g.fillText(rbt,0,0);g.restore();
        g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(rbt,0,0);
        g.fillStyle=col;g.fillText(rbt,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色は◯！ 中央上のヒント(初回だけ)
      if(luckyMsgT>0){luckyMsgT-=dt;
        const p=clamp(luckyMsgT/150,0,1);
        g.save();g.translate(api.W/2,api.H*0.26);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(p*1.6,0,1);g.font="800 "+clamp(api.W*0.052,20,28)+"px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキーいろは "+luckyName+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(t2,0,0);
        g.fillStyle=hsl(luckyHue,85,66);g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyMsgT<0)luckyMsgT=0;}
      // top-left stage HUD (always visible, shows progress)
      drawStageHud(now);
      // stage start banner
      if(banner>0)drawBanner(now);
      // clear celebration overlay (results + stars / all-clear)
      if(clearT>0)drawClear(now);
      // hint only on stage 1 while idle, to teach the tap; then it gets out of the way
      else if(stage===1&&banner<=0)drawHint(now);
      // 加算合成を必ず既定へ戻す(白飛び防止の保険 / フレーム末に source-over を明示)
      g.globalCompositeOperation="source-over";
    }
  };
  function rrect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  // filled 5-point star (for rating)
  function star5(x,y,R,rot,fill,stroke,lw){
    g.save();g.translate(x,y);g.rotate(rot);g.beginPath();
    for(let i=0;i<5;i++){const a=-Math.PI/2+i*(TAU/5);
      g.lineTo(Math.cos(a)*R,Math.sin(a)*R);
      const a2=a+TAU/10;g.lineTo(Math.cos(a2)*R*0.45,Math.sin(a2)*R*0.45);}
    g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.lineWidth=lw||3;g.strokeStyle=stroke;g.stroke();}
    g.restore();
  }
  // small bomb-cluster icons showing how many remain this stage
  function drawStageHud(now){
    const y=12;
    g.save();
    g.font="800 "+clamp(api.W*0.045,18,26)+"px 'Hiragino Maru Gothic ProN',system-ui";
    g.textAlign="center";g.textBaseline="top";
    const tint=STAGE_TINT[(stage-1)%STAGE_TINT.length];
    g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("ステージ "+stage,api.W/2,y);
    g.fillStyle=tint;g.fillText("ステージ "+stage,api.W/2,y);
    // 残りの爆弾=小さな点(左そろえ・横幅は固定) + ★の目標 + きろく を同じ行に並べる(HUDは2段のまま)
    // 軸5補助: stageBombsで頭打ちにせず実際のremainを見せる(想定数を超えた分は赤いドット)。
    const remain=bombs.filter(b=>b.state!=="boom").length;
    const shown=Math.min(remain,30);
    const fs=clamp(api.W*0.045,18,26);
    const dotY=y+fs+10,dr=5,gap=14,sr=10,sgap=24;
    const dotsN=Math.min(Math.max(stageBombs,shown),30),dotsW=dotsN*gap,starsW=3*sgap;
    const live=Math.max(bestChain,maxChain);
    g.font="800 "+clamp(api.W*0.032,13,16)+"px 'Hiragino Maru Gothic ProN',system-ui";
    const rec="きろく "+live+"れんさ";let recW=live>=2?g.measureText(rec).width+12:0;
    let total=dotsW+10+starsW+recW;if(total>api.W-24){recW=0;total=dotsW+10+starsW;}
    const x0=api.W/2-total/2;
    for(let i=0;i<shown;i++){
      g.fillStyle=i>=stageBombs?"#ff6b5b":"#ffd23f";g.beginPath();g.arc(x0+dr+i*gap,dotY+dr,dr,0,TAU);g.fill();
      g.strokeStyle="rgba(0,0,0,.4)";g.lineWidth=1.5;g.stroke();
    }
    // ★3つ(その面のクリア目標): 今の さいだいれんさ が条件に届いた分だけ塗る
    const sx0=x0+dotsW+10+sgap/2-2;
    for(let i=0;i<3;i++){
      const on=i<hudStars,pp=starPop[i];if(pp>0)starPop[i]=Math.max(0,pp-0.03);
      const R=sr*(1+pp*0.6);
      star5(sx0+i*sgap,dotY+dr,R,0,on?"#ffd23f":"rgba(0,0,0,.35)",on?"rgba(0,0,0,.55)":"rgba(255,226,122,.85)",on?2.5:2);
    }
    if(recW>0){g.textAlign="left";g.textBaseline="middle";
      const rx=x0+dotsW+10+starsW+8,ry2=dotY+dr;
      g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(rec,rx,ry2);g.fillStyle="#c9b8ff";g.fillText(rec,rx,ry2);}
    g.restore();g.textAlign="left";g.textBaseline="alphabetic";
  }
  function drawBanner(now){
    const p=banner/150,a=p>0.85?(1-p)/0.15:p<0.25?p/0.25:1; // ease in/out
    const cx=api.W/2,cy=api.H*0.34,sc=0.8+0.2*Math.min(1,(1-p)*5);
    g.save();g.globalAlpha=clamp(a,0,1);g.translate(cx,cy);g.scale(sc,sc);g.textAlign="center";
    const tint=STAGE_TINT[(stage-1)%STAGE_TINT.length];
    g.font="900 "+clamp(api.W*0.13,48,90)+"px 'Hiragino Maru Gothic ProN',system-ui";
    g.save();g.globalCompositeOperation="lighter";g.globalAlpha=clamp(a,0,1)*0.5;
    g.shadowColor=tint;g.shadowBlur=30;g.fillStyle=tint;g.fillText("ステージ "+stage,0,0);g.restore();
    g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText("ステージ "+stage,0,0);
    g.fillStyle=tint;g.fillText("ステージ "+stage,0,0);
    // 2しゅうめ以降(5面ぜんぶ★3の次の周は きんいろ)
    if(lap>0){const lt=(lap+1)+"しゅうめ"+(goldMode?"　きんいろ！":"");
      g.font="900 "+clamp(api.W*0.05,24,40)+"px 'Hiragino Maru Gothic ProN',system-ui";
      g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(lt,0,clamp(api.W*0.07,34,56));
      g.fillStyle=goldMode?"#ffd23f":"#ffffff";g.fillText(lt,0,clamp(api.W*0.07,34,56));}
    g.restore();g.globalAlpha=1;g.textAlign="left";
  }
  function drawClear(now){
    const dur=allClear?260:160,p=1-clearT/dur;
    const cx=api.W/2,cy=api.H*0.4;
    // dim backdrop
    g.save();g.globalAlpha=clamp(p*3,0,1)*0.5;g.fillStyle="rgba(10,8,18,1)";g.fillRect(0,0,api.W,api.H);g.restore();
    // title
    const pop=Math.min(1,p*4),sc=0.6+0.4*ease(pop);
    g.save();g.translate(cx,cy-api.H*0.12);g.scale(sc,sc);g.textAlign="center";
    const col=allClear?"#ffe27a":"#9bff9b";
    g.font="900 "+clamp(api.W*0.12,46,84)+"px 'Hiragino Maru Gothic ProN',system-ui";
    g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.5;g.shadowColor=col;g.shadowBlur=28;
    g.fillStyle=col;g.fillText(allClear?"ぜんぶクリア！":"クリア！",0,0);g.restore();
    g.lineWidth=8;g.strokeStyle="rgba(0,0,0,.6)";g.strokeText(allClear?"ぜんぶクリア！":"クリア！",0,0);
    g.fillStyle=col;g.fillText(allClear?"ぜんぶクリア！":"クリア！",0,0);g.restore();
    // stars (pop in one by one)
    const R=clamp(api.W*0.06,28,46),sgap=R*2.6;
    for(let i=0;i<3;i++){
      const filled=i<clearStars,sp=clamp((p-0.18-i*0.12)*6,0,1);
      const sx=cx+(i-1)*sgap,sy=cy+api.H*0.02,ssc=filled?(0.3+0.7*ease(sp)):1;
      const wob=filled?Math.sin(now*0.006+i)*0.06:0;
      g.save();g.globalAlpha=filled?clamp(sp*2,0,1):0.4;
      if(filled){g.save();g.globalCompositeOperation="lighter";g.globalAlpha=clamp(sp,0,1)*0.6;
        star5(sx,sy,R*ssc*1.3,wob,"#ffec8a",null);g.restore();}
      star5(sx,sy,R*ssc,wob,filled?"#ffd23f":"#3a3550","rgba(0,0,0,.4)");
      g.restore();
    }
    // results: max chain + boom count
    g.save();g.globalAlpha=clamp((p-0.3)*4,0,1);g.textAlign="center";
    g.font="800 "+clamp(api.W*0.05,20,30)+"px 'Hiragino Maru Gothic ProN',system-ui";
    const ry=cy+api.H*0.14;
    g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.55)";
    const l1="さいだいれんさ "+clearChain,l2="ばくはした "+clearCount;
    g.strokeText(l1,cx,ry);g.fillStyle="#ff8c42";g.fillText(l1,cx,ry);
    g.strokeText(l2,cx,ry+clamp(api.W*0.06,30,44));g.fillStyle="#ffd23f";g.fillText(l2,cx,ry+clamp(api.W*0.06,30,44));
    // 軸5: きろく(この遊びでのさいこうれんさ)。前より伸びたら「しんきろく！」
    const step=clamp(api.W*0.06,30,44);
    const l3=clearNewRecord?"しんきろく！ "+clearBest+"れんさ":"きろく "+clearBest+"れんさ";
    g.strokeText(l3,cx,ry+step*2);g.fillStyle=clearNewRecord?"#ff7ad9":"#c9b8ff";g.fillText(l3,cx,ry+step*2);
    // ③ パーフェクト(ワンチェイン)達成のごほうび表示
    if(clearPerfect){const py2=ry+step*3;
      g.strokeText("パーフェクト！＋5",cx,py2);g.fillStyle="#9bff9b";g.fillText("パーフェクト！＋5",cx,py2);}
    if(allClear){const ny=ry+step*(clearPerfect?4:3),nt=nextGold?"つぎは きんいろの "+(lap+2)+"しゅうめ！":"つぎは "+(lap+2)+"しゅうめ！";
      g.strokeText(nt,cx,ny);g.fillStyle=nextGold?"#ffd23f":"#ffffff";g.fillText(nt,cx,ny);}
    g.restore();g.textAlign="left";g.globalAlpha=1;
  }
  // little bomb icon for the hint panel
  function iconBomb(x,y,r,lit,t){
    g.save();g.translate(x,y);
    // 画像ばくだんがあればヒントのアイコンも同じ絵にする(火だけ重ねる)
    if(drawBombImg(r)){
      if(lit){const fl=0.5+Math.sin(t*0.012)*0.5,fx=r*IMG_FX,fy=r*IMG_FY;
        g.save();g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(255,150,40,.7)";g.beginPath();g.arc(fx,fy,7+fl*2.5,0,TAU);g.fill();
        g.fillStyle="#fff2c0";g.beginPath();g.arc(fx,fy,3.2+fl,0,TAU);g.fill();g.restore();}
      g.restore();return;}
    const grd=g.createRadialGradient(-r*0.35,-r*0.38,r*0.15,0,0,r*1.05);
    grd.addColorStop(0,"#5a5866");grd.addColorStop(0.6,"#2f2e38");grd.addColorStop(1,"#101016");
    g.fillStyle=grd;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.4)";g.beginPath();g.arc(-r*0.34,-r*0.36,r*0.16,0,TAU);g.fill();
    g.fillStyle="#8a7752";g.fillRect(-r*0.22,-r*1.12,r*0.44,r*0.32);
    g.strokeStyle="#8a5a2a";g.lineWidth=2.5;g.lineCap="round";g.beginPath();g.moveTo(0,-r*1.08);g.quadraticCurveTo(r*0.5,-r*1.5,r*0.3,-r*1.8);g.stroke();
    if(lit){const fl=0.5+Math.sin(t*0.012)*0.5,fx=r*0.3,fy=-r*1.8;
      g.save();g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(255,150,40,.7)";g.beginPath();g.arc(fx,fy,7+fl*2.5,0,TAU);g.fill();
      g.fillStyle="#fff2c0";g.beginPath();g.arc(fx,fy,3.2+fl,0,TAU);g.fill();g.restore();}
    g.restore();
  }
  // pointing finger pictogram
  function iconTap(x,y,s,t){
    const bob=Math.sin(t*0.006)*s*0.18;
    g.save();g.translate(x,y+bob);
    g.fillStyle="#ffe2b8";g.strokeStyle="rgba(90,50,20,.55)";g.lineWidth=2;
    rrect(-s*0.28,-s*0.1,s*0.56,s*0.95,s*0.26);g.fill();g.stroke();
    g.beginPath();g.arc(0,-s*0.1,s*0.3,Math.PI,TAU);g.fill();g.stroke();
    g.restore();
  }
  function drawHint(now){
    const cx=api.W/2,h=clamp(api.W*0.11,46,64),y=api.H-h-12,w=clamp(api.W*0.82,260,560),x=cx-w/2;
    const pulse=0.5+Math.sin(now*0.003)*0.5;
    g.save();
    // soft drop shadow
    g.shadowColor="rgba(0,0,0,.4)";g.shadowBlur=18;g.shadowOffsetY=5;
    // panel body (warm translucent, rounded)
    rrect(x,y,w,h,h*0.5);
    const pg=g.createLinearGradient(0,y,0,y+h);pg.addColorStop(0,"rgba(74,58,108,.82)");pg.addColorStop(1,"rgba(44,34,66,.82)");
    g.fillStyle=pg;g.fill();
    g.shadowColor="transparent";g.shadowBlur=0;g.shadowOffsetY=0;
    // glowing rounded border
    g.lineWidth=3;g.strokeStyle="rgba(255,210,120,"+(0.55+0.3*pulse)+")";
    g.shadowColor="rgba(255,180,90,.7)";g.shadowBlur=10+8*pulse;
    rrect(x+1.5,y+1.5,w-3,h-3,(h-3)*0.5);g.stroke();
    g.shadowColor="transparent";g.shadowBlur=0;
    // inner top sheen
    g.globalAlpha=0.18;g.fillStyle="#fff";rrect(x+h*0.3,y+h*0.16,w-h*0.6,h*0.26,h*0.13);g.fill();g.globalAlpha=1;
    g.restore();
    // pictograms inside: [tap] [bomb] (arrow) [lit bomb] (burst)
    const r=h*0.32,gap=w*0.2,baseX=x+w*0.16,my=y+h*0.55;
    iconTap(baseX,my-r*0.7,r*1.5,now);
    iconBomb(baseX+gap*0.78,my,r,false,now);
    // arrow
    g.save();g.strokeStyle="rgba(255,230,160,.9)";g.fillStyle="rgba(255,230,160,.9)";g.lineWidth=3.5;g.lineCap="round";
    const ax=baseX+gap*1.35;g.beginPath();g.moveTo(ax,my);g.lineTo(ax+gap*0.26,my);g.stroke();
    g.beginPath();g.moveTo(ax+gap*0.3,my);g.lineTo(ax+gap*0.18,my-6);g.lineTo(ax+gap*0.18,my+6);g.closePath();g.fill();g.restore();
    iconBomb(ax+gap*0.62,my,r,true,now);
    // burst star (climax cue)
    const sx=ax+gap*1.2,sp=0.5+Math.sin(now*0.008)*0.5;
    g.save();g.globalCompositeOperation="lighter";
    star(sx,my,r*(0.9+sp*0.3),now*0.001,0.9,"#ffd23f");
    g.fillStyle="rgba(255,90,60,.5)";g.beginPath();g.arc(sx,my,r*0.5,0,TAU);g.fill();
    g.restore();
  }
  // 特大(big)ばくだん専用: 丸ではなく木箱のTNTクレート(矩形+板目+赤いバツ)を描く(軸7: 形のバラエティ)
  function drawCrate(r,lit){
    const w=Math.max(0,r*1.7),h=Math.max(0,r*1.55);
    g.save();
    const grd=g.createLinearGradient(-w/2,-h/2,w/2,h/2);
    grd.addColorStop(0,lit?"#c98a4a":"#b97b3e");grd.addColorStop(0.5,lit?"#a5672f":"#8f5a2a");grd.addColorStop(1,"#6b431c");
    g.fillStyle=grd;rrect(-w/2,-h/2,w,h,Math.max(0,r*0.14));g.fill();
    g.lineWidth=Math.max(1,r*0.06);g.strokeStyle="rgba(0,0,0,.35)";
    rrect(-w/2,-h/2,w,h,Math.max(0,r*0.14));g.stroke();
    // 板目線(木箱らしさ)
    g.strokeStyle="rgba(60,35,10,.5)";g.lineWidth=Math.max(1,r*0.05);
    for(let i=1;i<3;i++){const yy=-h/2+h*i/3;g.beginPath();g.moveTo(-w/2+r*0.08,yy);g.lineTo(w/2-r*0.08,yy);g.stroke();}
    // 四隅の鋲
    g.fillStyle="rgba(40,25,10,.6)";
    const nx=w/2-r*0.16,ny=h/2-r*0.16;
    for(const sxg of[-1,1])for(const syg of[-1,1]){g.beginPath();g.arc(sxg*nx,syg*ny,Math.max(0,r*0.06),0,TAU);g.fill();}
    // 赤いバツ印(危険=連鎖の起点の合図)
    g.strokeStyle="#e23b2e";g.lineWidth=Math.max(2,r*0.16);g.lineCap="round";
    const ix=w*0.32,iy=h*0.32;
    g.beginPath();g.moveTo(-ix,-iy);g.lineTo(ix,iy);g.stroke();
    g.beginPath();g.moveTo(ix,-iy);g.lineTo(-ix,iy);g.stroke();
    // 上面ハイライト
    g.fillStyle="rgba(255,255,255,.18)";g.fillRect(-w/2+r*0.08,-h/2+r*0.08,Math.max(0,w-r*0.16),Math.max(0,h*0.16));
    g.restore();
  }
  // 時限(timed)ばくだん専用: 丸のbomb.pngと全く同じ見た目だった(軸7: 丸型3種の偏り)のを脱するため、
  // 四角い目覚まし時計モチーフ(ベル耳+針)で描く。針は残り時間(frac)に合わせて実際に回るので、
  // 「もうすぐ勝手に爆発する」ことが形でも伝わる。
  function drawClockBomb(r,lit,frac){
    const w=Math.max(0,r*1.5),h=Math.max(0,r*1.5);
    g.save();
    const grd=g.createRadialGradient(-r*0.3,-r*0.3,Math.max(0,r*0.1),0,0,Math.max(0,r*0.95));
    grd.addColorStop(0,lit?"#fff2c0":"#eef3ff");grd.addColorStop(0.6,lit?"#ffb84d":"#bcd4ff");grd.addColorStop(1,lit?"#e8862a":"#5b7bc4");
    g.fillStyle=grd;rrect(-w/2,-h/2,w,h,Math.max(0,r*0.24));g.fill();
    g.lineWidth=Math.max(1,r*0.08);g.strokeStyle="#2b3a66";
    rrect(-w/2+r*0.04,-h/2+r*0.04,Math.max(0,w-r*0.08),Math.max(0,h-r*0.08),Math.max(0,r*0.2));g.stroke();
    // ベル耳(目覚まし時計らしさ)
    g.fillStyle="#7d90c9";
    g.beginPath();g.arc(-w*0.32,-h*0.4,Math.max(0,r*0.2),Math.PI*0.9,Math.PI*1.9);g.fill();
    g.beginPath();g.arc(w*0.32,-h*0.4,Math.max(0,r*0.2),Math.PI*1.1,Math.PI*2.1);g.fill();
    // 脚
    g.fillStyle="#4a5aa0";
    g.beginPath();g.arc(-w*0.3,h*0.47,Math.max(0,r*0.09),0,TAU);g.fill();
    g.beginPath();g.arc(w*0.3,h*0.47,Math.max(0,r*0.09),0,TAU);g.fill();
    // 針(残り時間に合わせて回る)
    const ang=TAU*(1-clamp(frac,0,1));
    g.strokeStyle="#20264a";g.lineCap="round";
    g.lineWidth=Math.max(1,r*0.09);g.beginPath();g.moveTo(0,0);g.lineTo(Math.sin(ang)*r*0.4,-Math.cos(ang)*r*0.4);g.stroke();
    g.lineWidth=Math.max(1,r*0.07);g.beginPath();g.moveTo(0,0);g.lineTo(Math.sin(ang*2.3)*r*0.26,-Math.cos(ang*2.3)*r*0.26);g.stroke();
    g.fillStyle="#20264a";g.beginPath();g.arc(0,0,Math.max(0,r*0.06),0,TAU);g.fill();
    // 目盛り(12/3/6/9時)
    g.fillStyle="rgba(32,38,74,.6)";
    for(const a of[0,Math.PI/2,Math.PI,Math.PI*1.5]){g.beginPath();g.arc(Math.sin(a)*r*0.66,-Math.cos(a)*r*0.66,Math.max(0,r*0.045),0,TAU);g.fill();}
    g.restore();
  }
  // 色(color)ばくだん専用: 丸の色違いから脱するため、トゲを生やしたウニ/星形シルエットで描く(軸7)
  function drawSpikyBomb(r,hue){
    const grd=g.createRadialGradient(-r*0.35,-r*0.38,Math.max(0,r*0.15),0,0,Math.max(0,r*1.05));
    grd.addColorStop(0,hsl(hue,85,72));grd.addColorStop(0.6,hsl(hue,80,52));grd.addColorStop(1,hsl(hue,70,28));
    g.fillStyle=grd;
    const n=7;g.beginPath();
    for(let i=0;i<n*2;i++){
      const a=i*Math.PI/n-Math.PI/2;
      const rad=Math.max(0,i%2===0?r:r*0.6);
      const px=Math.cos(a)*rad,py=Math.sin(a)*rad;
      if(i===0)g.moveTo(px,py);else g.lineTo(px,py);
    }
    g.closePath();g.fill();
  }
  // にじいろ(rainbow)ばくだん専用: 丸の色替えオーラだけだった(軸7)のを脱するため、雫(しずく)型シルエットで描く。
  function drawDropBomb(r,hue){
    const rr=Math.max(0,r);
    g.save();
    const grd=g.createRadialGradient(-rr*0.3,-rr*0.1,Math.max(0,rr*0.1),0,0,Math.max(0,rr*1.15));
    grd.addColorStop(0,hsl(hue,90,80));grd.addColorStop(0.55,hsl(hue+60,85,60));grd.addColorStop(1,hsl(hue+140,75,42));
    g.fillStyle=grd;
    g.beginPath();
    g.moveTo(0,-rr*1.25);
    g.bezierCurveTo(rr*0.95,-rr*0.15,rr*0.85,rr*0.95,0,rr*0.95);
    g.bezierCurveTo(-rr*0.85,rr*0.95,-rr*0.95,-rr*0.15,0,-rr*1.25);
    g.closePath();g.fill();
    g.restore();
  }
  // 導火線の火(row/car共通)
  function drawFlame(fx,fy,fl){
    g.save();g.globalCompositeOperation="lighter";
    g.fillStyle="rgba(255,120,30,.55)";g.beginPath();g.arc(fx,fy,Math.max(0,11+fl*3),0,TAU);g.fill();
    g.fillStyle="rgba(255,180,60,.8)";g.beginPath();g.arc(fx,fy,7,0,TAU);g.fill();
    g.fillStyle="#fff2c0";g.beginPath();g.arc(fx,fy,Math.max(0,3.5+fl*1.5),0,TAU);g.fill();
    g.restore();
  }
  // ドミノのタイル1枚(白地・黒ふち・黒い点2つ)。x,y は左上
  function drawTile(x,y,w,h,rad){
    g.fillStyle="#f6f6fa";rrect(x,y,w,h,Math.max(0,rad));g.fill();
    g.lineWidth=Math.max(1.5,w*0.12);g.strokeStyle="#1d1d28";rrect(x,y,w,h,Math.max(0,rad));g.stroke();
    g.beginPath();g.moveTo(x+w*0.12,y+h/2);g.lineTo(x+w*0.88,y+h/2);g.lineWidth=Math.max(1,w*0.07);g.stroke();
    g.fillStyle="#1d1d28";
    g.beginPath();g.arc(x+w/2,y+h*0.27,Math.max(0,w*0.16),0,TAU);g.fill();
    g.beginPath();g.arc(x+w/2,y+h*0.73,Math.max(0,w*0.16),0,TAU);g.fill();
  }
  // ドミノの列: 細長いタイル4枚(点火すると ゆらゆら傾く)
  function drawDominoRow(r,lit,fuse){
    const w=r*0.4,h=r*1.7;
    g.save();
    for(let i=0;i<4;i++){
      const x=(i-1.5)*r*0.52,lean=lit?Math.sin(fuse*5+i*0.9)*0.07:0;
      g.save();g.translate(x,h/2);g.rotate(lean);
      if(lit){g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.25;g.fillStyle="#ff9b3a";rrect(-w/2-3,-h-3,w+6,h+6,w*0.5);g.fill();g.restore();}
      drawTile(-w/2,-h,w,h,w*0.5);g.restore();
    }
    g.restore();
  }
  // くるま: 赤い車体+窓+ライト+タイヤ2つ
  function drawCar(r,lit){
    g.save();
    // 車体の屋根(キャビン)
    g.fillStyle=lit?"#ee6a52":"#c43a28";
    g.beginPath();g.moveTo(-0.62*r,-0.2*r);g.lineTo(-0.36*r,-0.72*r);g.lineTo(0.4*r,-0.72*r);g.lineTo(0.72*r,-0.2*r);g.closePath();g.fill();
    g.lineWidth=Math.max(1.5,r*0.07);g.strokeStyle="#2a1410";g.stroke();
    g.fillStyle="#bfe6ff";
    g.beginPath();g.moveTo(-0.46*r,-0.24*r);g.lineTo(-0.28*r,-0.6*r);g.lineTo(0.3*r,-0.6*r);g.lineTo(0.54*r,-0.24*r);g.closePath();g.fill();
    g.strokeStyle="#2a1410";g.lineWidth=Math.max(1,r*0.05);g.beginPath();g.moveTo(0.02*r,-0.6*r);g.lineTo(0.02*r,-0.24*r);g.stroke();
    // 本体
    const grd=g.createLinearGradient(0,-0.2*r,0,0.5*r);grd.addColorStop(0,lit?"#ff8a6a":"#f0604a");grd.addColorStop(1,lit?"#d8503a":"#b8321f");
    g.fillStyle=grd;rrect(-1.15*r,-0.22*r,2.3*r,0.72*r,Math.max(0,r*0.22));g.fill();
    g.lineWidth=Math.max(1.5,r*0.07);g.strokeStyle="#2a1410";rrect(-1.15*r,-0.22*r,2.3*r,0.72*r,Math.max(0,r*0.22));g.stroke();
    // ライト・ドアの線
    g.fillStyle="#ffe27a";g.beginPath();g.arc(1.0*r,0.06*r,Math.max(0,r*0.12),0,TAU);g.fill();
    g.fillStyle="#fff";g.fillRect(-1.12*r,0.02*r,r*0.1,r*0.16);
    // タイヤ
    for(const sx of[-0.68,0.68]){
      g.fillStyle="#26262c";g.beginPath();g.arc(sx*r,0.5*r,Math.max(0,r*0.34),0,TAU);g.fill();
      g.lineWidth=Math.max(1,r*0.05);g.strokeStyle="rgba(255,255,255,.5)";g.stroke();
      g.fillStyle="#b9bcc8";g.beginPath();g.arc(sx*r,0.5*r,Math.max(0,r*0.13),0,TAU);g.fill();}
    g.restore();
  }
  // 積み木箱: 木箱3段(少しずつ横にずれて「積んである」感じ)。真ん中の段に赤い帯=危険の合図
  function drawStack(r,lit,fuse){
    const w=Math.max(0,r*1.35),h=Math.max(0,r*1.02);
    const off=[r*0.07,-r*0.09,r*0.05],cols=lit?["#d9a05a","#c98a4a","#e0ae68"]:["#c68b4e","#b47a3d","#c99556"];
    g.save();
    for(let i=0;i<3;i++){
      const cx=off[i]+(lit?Math.sin(fuse*5+i)*r*0.03:0),cy=(i-1)*r*1.0;
      g.fillStyle=cols[i];rrect(cx-w/2,cy-h/2,w,h,Math.max(0,r*0.1));g.fill();
      g.lineWidth=Math.max(1,r*0.07);g.strokeStyle="rgba(50,28,8,.7)";rrect(cx-w/2,cy-h/2,w,h,Math.max(0,r*0.1));g.stroke();
      g.strokeStyle="rgba(60,35,10,.45)";g.lineWidth=Math.max(1,r*0.05);
      g.beginPath();g.moveTo(cx-w/2+r*0.1,cy-h*0.12);g.lineTo(cx+w/2-r*0.1,cy-h*0.12);g.stroke();
      g.beginPath();g.moveTo(cx-w/2+r*0.1,cy+h*0.22);g.lineTo(cx+w/2-r*0.1,cy+h*0.22);g.stroke();
      g.fillStyle="rgba(255,255,255,.2)";g.fillRect(cx-w/2+r*0.08,cy-h/2+r*0.06,Math.max(0,w-r*0.16),Math.max(0,h*0.14));
    }
    // 真ん中の段の赤い帯
    g.fillStyle="#e23b2e";g.fillRect(off[1]-w/2+r*0.04,-r*0.12,Math.max(0,w-r*0.08),r*0.24);
    g.restore();
  }
  function drawBomb(b){
    g.save();g.translate(b.x,b.y);
    const lit=b.state==="lit";
    const bob=Math.sin(b.bob)*1.5;
    g.translate(0,bob);
    // pop-in birth scale
    const bs=1+b.born*0.6;
    let sxx=b.sx*bs,syy=b.sy*bs;
    if(lit){const pulse=Math.sin(b.fuse*3)*0.06;sxx*=1+pulse;syy*=1+pulse;}
    g.scale(sxx,syy);
    // contact shadow (画像ばくだんは足が生えているので少し下に落とす)
    const useImg=b.type==="normal"&&api.asset("bomb.png").ready;
    g.save();g.globalAlpha=0.35;g.fillStyle="#000";g.beginPath();g.ellipse(0,b.r*(b.type==="stack"?1.62:b.type==="row"?0.95:b.type==="car"?0.85:useImg?1.32:1.05),Math.max(0,b.r*(b.type==="car"?1.25:b.type==="row"?1.15:0.85)),Math.max(0,b.r*0.3),0,0,TAU);g.fill();g.restore();
    // type cue: color bomb radiates a soft colored halo; big bomb a warm one
    if(b.type==="color"){g.save();g.globalCompositeOperation="lighter";
      g.globalAlpha=0.16;g.fillStyle=hsl(b.hue,90,60);g.beginPath();g.arc(0,0,b.r*1.5,0,TAU);g.fill();g.restore();}
    // ① にじいろばくだん: 虹色に脈打つオーラ(=「なにか特別なのが居る」ドキドキの予告)
    const rbHue=goldMode?45:(bgT*3+b.x*0.7)%360;
    if(b.type==="rainbow"){g.save();g.globalCompositeOperation="lighter";
      const rp=0.55+0.45*Math.sin(b.fuse+bgT*0.06);
      g.globalAlpha=0.18*rp;g.fillStyle=hsl(rbHue,95,62);g.beginPath();g.arc(0,0,b.r*1.7,0,TAU);g.fill();g.restore();}
    // lit aura glow
    if(lit){const fl=0.5+Math.sin(b.fuse*5)*0.5;g.save();g.globalCompositeOperation="lighter";
      g.globalAlpha=0.18+fl*0.18;g.fillStyle="#ff9b3a";g.beginPath();g.arc(0,0,b.r*1.7,0,TAU);g.fill();g.restore();}
    // 特大(big)ばくだん: 「丸を1.5倍にしただけ」から脱するため、木箱のTNTクレート(矩形+板目+赤いバツ)で描く。
    //   爆発ロジック(explode/reachOf)はrをそのまま使うため一切変えず、見た目だけの差し替え。
    if(b.type==="big"){
      drawCrate(b.r,lit);
      // fuse cap(丸ばくだんと同じ位置・演出。点火の合図を統一する)
      g.fillStyle="#8a7752";g.fillRect(-b.r*0.22,-b.r*1.15,b.r*0.44,b.r*0.35);
      g.fillStyle="#6a5a3c";g.fillRect(-b.r*0.22,-b.r*0.86,b.r*0.44,b.r*0.06);
      g.strokeStyle="#8a5a2a";g.lineWidth=3;g.lineCap="round";g.beginPath();g.moveTo(0,-b.r*1.1);g.quadraticCurveTo(b.r*0.5,-b.r*1.5,b.r*0.3,-b.r*1.8);g.stroke();
      if(lit){const fx=b.r*0.3,fy=-b.r*1.8,fl=Math.sin(b.fuse*5);
        g.save();g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(255,120,30,.55)";g.beginPath();g.arc(fx,fy,Math.max(0,11+fl*3),0,TAU);g.fill();
        g.fillStyle="rgba(255,180,60,.8)";g.beginPath();g.arc(fx,fy,7,0,TAU);g.fill();
        g.fillStyle="#fff2c0";g.beginPath();g.arc(fx,fy,Math.max(0,3.5+fl*1.5),0,TAU);g.fill();
        g.restore();
        g.globalAlpha=0.5+fl*0.3;g.fillStyle="#ffd23f";g.beginPath();g.arc(fx+fl*2,fy-8-fl*3,Math.max(0,1.6),0,TAU);g.fill();g.globalAlpha=1;}
      g.restore();return;
    }
    // ドミノの列(row): 細長い白いタイル4枚が並ぶ。壊れる時は順にバタバタ倒れる(軸7)
    if(b.type==="row"){
      drawDominoRow(b.r,lit,b.fuse);
      const fx=-b.r*0.78+b.r*0.3,fy=-b.r*1.55;
      g.strokeStyle="#8a5a2a";g.lineWidth=3;g.lineCap="round";g.beginPath();g.moveTo(-b.r*0.78,-b.r*0.85);g.quadraticCurveTo(-b.r*0.5,-b.r*1.4,fx,fy);g.stroke();
      if(lit)drawFlame(fx,fy,Math.sin(b.fuse*5));
      g.restore();return;
    }
    // くるま(car): 横長の車体と丸いタイヤ2つ。壊れる時はタイヤが飛んで地面ではねる(軸7)
    if(b.type==="car"){
      drawCar(b.r,lit);
      const fx=b.r*0.3,fy=-b.r*1.3;
      g.strokeStyle="#8a5a2a";g.lineWidth=3;g.lineCap="round";g.beginPath();g.moveTo(0,-b.r*0.72);g.quadraticCurveTo(b.r*0.5,-b.r*1.0,fx,fy);g.stroke();
      if(lit)drawFlame(fx,fy,Math.sin(b.fuse*5));
      g.restore();return;
    }
    // 積み木箱(stack): 木箱を3段積んだ背の高い形。壊れる時は段ごとに時間差で崩れる(軸7)
    if(b.type==="stack"){
      drawStack(b.r,lit,b.fuse);
      const fx=b.r*0.3,fy=-b.r*2.25;
      g.strokeStyle="#8a5a2a";g.lineWidth=3;g.lineCap="round";g.beginPath();g.moveTo(0,-b.r*1.75);g.quadraticCurveTo(b.r*0.5,-b.r*2.0,fx,fy);g.stroke();
      if(lit){const fl=Math.sin(b.fuse*5);
        g.save();g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(255,120,30,.55)";g.beginPath();g.arc(fx,fy,Math.max(0,11+fl*3),0,TAU);g.fill();
        g.fillStyle="rgba(255,180,60,.8)";g.beginPath();g.arc(fx,fy,7,0,TAU);g.fill();
        g.fillStyle="#fff2c0";g.beginPath();g.arc(fx,fy,Math.max(0,3.5+fl*1.5),0,TAU);g.fill();
        g.restore();}
      g.restore();return;
    }
    // 画像ばくだん: ふつう=bomb.png。色ばくだん・にじいろ・時限は色替え/別シルエットが要るので手描きのまま。
    //   特大(big)は生成が2回とも不良(台座付き/球でない)だったので、星マーク付きの手描きのまま(連鎖の起点という役割が一目で分かる)。
    //   画像は「球+キャップ+導火線+足」を含むので、球の中心が原点に来るよう drawBombImg でずらして描く。
    //   火はゲーム要素なので画像の上に重ねる。
    if(b.type==="normal"){
      if(drawBombImg(b.r)){
        if(lit){const fx=b.r*IMG_FX,fy=b.r*IMG_FY,fl=Math.sin(b.fuse*5);
          g.save();g.globalCompositeOperation="lighter";
          g.fillStyle="rgba(255,120,30,.55)";g.beginPath();g.arc(fx,fy,Math.max(0,11+fl*3),0,TAU);g.fill();
          g.fillStyle="rgba(255,180,60,.8)";g.beginPath();g.arc(fx,fy,7,0,TAU);g.fill();
          g.fillStyle="#fff2c0";g.beginPath();g.arc(fx,fy,Math.max(0,3.5+fl*1.5),0,TAU);g.fill();
          g.restore();
          g.globalAlpha=0.5+fl*0.3;g.fillStyle="#ffd23f";g.beginPath();g.arc(fx+fl*2,fy-8-fl*3,1.6,0,TAU);g.fill();g.globalAlpha=1;}
        g.restore();return;
      }
    }
    // 時限(timed)ばくだん: 丸のbomb.pngをふつうと共有していた(軸7)のをやめ、目覚まし時計モチーフを常に使う
    // (画像の有無に関係なく専用シルエット。ふつう爆弾との丸型かぶりを解消する)。
    if(b.type==="timed"){
      const frac=clamp(b.armT/260,0,1);
      drawClockBomb(b.r,lit,frac);
      if(lit){const fx=0,fy=-b.r*0.9,fl=Math.sin(b.fuse*5);
        g.save();g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(255,120,30,.55)";g.beginPath();g.arc(fx,fy,Math.max(0,11+fl*3),0,TAU);g.fill();
        g.fillStyle="rgba(255,180,60,.8)";g.beginPath();g.arc(fx,fy,7,0,TAU);g.fill();
        g.fillStyle="#fff2c0";g.beginPath();g.arc(fx,fy,Math.max(0,3.5+fl*1.5),0,TAU);g.fill();
        g.restore();}
      if(b.state==="idle"){
        const danger=b.armT<60;const blink=danger?(0.4+0.6*Math.abs(Math.sin(b.fuse*4))):1;
        g.save();g.globalAlpha=0.85*blink;
        g.strokeStyle=danger?"#ff5b3b":"#7ad8ff";g.lineWidth=Math.max(1,b.r*0.1);g.lineCap="round";
        g.beginPath();g.arc(0,0,Math.max(0,b.r*0.86),-Math.PI/2,-Math.PI/2+TAU*frac);g.stroke();
        g.restore();
      }
      g.restore();return;
    }
    // body (rich radial) - color/rainbow bombs use their own silhouette so they read as different objects, not just a color swap
    if(b.type==="color"){
      drawSpikyBomb(b.r,b.hue);
    } else if(b.type==="rainbow"){
      drawDropBomb(b.r,rbHue);
    } else {
      const grd=g.createRadialGradient(-b.r*0.35,-b.r*0.38,b.r*0.15,0,0,b.r*1.05);
      grd.addColorStop(0,lit?"#6b6472":"#454552");grd.addColorStop(0.6,lit?"#33313c":"#28282f");grd.addColorStop(1,"#101016");
      g.fillStyle=grd;g.beginPath();g.arc(0,0,b.r,0,TAU);g.fill();
    }
    // rim light
    g.strokeStyle="rgba(150,150,180,.25)";g.lineWidth=1.5;g.beginPath();g.arc(0,0,b.r*0.96,0,TAU);g.stroke();
    // main highlight
    g.fillStyle="rgba(255,255,255,.32)";g.beginPath();g.arc(-b.r*0.32,-b.r*0.34,b.r*0.22,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(-b.r*0.38,-b.r*0.4,b.r*0.09,0,TAU);g.fill();
    // cute face: eyes + mouth (idle smile / lit worried)
    {const ex=b.r*0.26,ey=b.r*0.08,er=lit?b.r*0.15:b.r*0.12;
      g.fillStyle="#fff";g.beginPath();g.arc(-ex,ey,er,0,TAU);g.arc(ex,ey,er,0,TAU);g.fill();
      const pj=lit?Math.sin(b.fuse*5)*er*0.25:0;
      g.fillStyle="#1a1620";g.beginPath();g.arc(-ex,ey+pj,er*0.55,0,TAU);g.arc(ex,ey+pj,er*0.55,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.85)";g.beginPath();g.arc(-ex-er*0.2,ey-er*0.2+pj,er*0.18,0,TAU);g.arc(ex-er*0.2,ey-er*0.2+pj,er*0.18,0,TAU);g.fill();
      g.strokeStyle="#1a1620";g.lineWidth=b.r*0.07;g.lineCap="round";g.beginPath();
      const my=b.r*0.42;
      if(lit)g.arc(0,my+b.r*0.12,b.r*0.16,0.15*Math.PI,0.85*Math.PI);
      else g.arc(0,my-b.r*0.05,b.r*0.18,0.15*Math.PI,0.85*Math.PI);
      g.stroke();
      // rosy cheeks for idle
      if(!lit){g.fillStyle="rgba(255,140,150,.45)";g.beginPath();g.arc(-b.r*0.5,b.r*0.28,b.r*0.12,0,TAU);g.arc(b.r*0.5,b.r*0.28,b.r*0.12,0,TAU);g.fill();}}
    // cap
    g.fillStyle="#8a7752";g.fillRect(-b.r*0.22,-b.r*1.15,b.r*0.44,b.r*0.35);
    g.fillStyle="#6a5a3c";g.fillRect(-b.r*0.22,-b.r*0.86,b.r*0.44,b.r*0.06);
    // fuse
    g.strokeStyle="#8a5a2a";g.lineWidth=3;g.lineCap="round";g.beginPath();g.moveTo(0,-b.r*1.1);g.quadraticCurveTo(b.r*0.5,-b.r*1.5,b.r*0.3,-b.r*1.8);g.stroke();
    if(lit){const fx=b.r*0.3,fy=-b.r*1.8,fl=Math.sin(b.fuse*5);
      g.save();g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(255,120,30,.55)";g.beginPath();g.arc(fx,fy,11+fl*3,0,TAU);g.fill();
      g.fillStyle="rgba(255,180,60,.8)";g.beginPath();g.arc(fx,fy,7,0,TAU);g.fill();
      g.fillStyle="#fff2c0";g.beginPath();g.arc(fx,fy,3.5+fl*1.5,0,TAU);g.fill();
      g.restore();
      // tiny ember spark above flame
      g.globalAlpha=0.5+fl*0.3;g.fillStyle="#ffd23f";g.beginPath();g.arc(fx+fl*2,fy-8-fl*3,1.6,0,TAU);g.fill();g.globalAlpha=1;}
    // にじいろばくだん: おなかにキラキラ回る虹の星(=激レアの合図)
    if(b.type==="rainbow"&&!lit){g.save();g.globalCompositeOperation="lighter";
      const sp=0.6+0.4*Math.sin(b.fuse*2+bgT*0.08);
      star(0,b.r*0.05,b.r*(0.32+sp*0.12),b.fuse+bgT*0.03,0.95,hsl(rbHue,95,72));g.restore();}
    // (timed型は上でdrawClockBombへ分岐して早期returnするため、ここには来ない)
    g.restore();
  }
}
Engine.register("domino", buildDomino);
