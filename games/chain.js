function buildChain(api){
  const g=api.g;
  api.preload(["bg.jpg","star.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック) ※orb.png は生成不良のため不使用(手描き)
  let orbs=[],chain=[],sparks=[],rings=[],floats=[],motes=[],bolts=[];
  let holding,growT,spawnT,count,LINKR,curLinkR,flash,flashCol,t,bigWash,bigWashX,bigWashY,bigWashCol;
  // --- stage progression state ---
  let stage,stageTarget,stageScore,orbCap,orbSpeed,spawnGap,targetCol,clearAnim,clearWon;
  // ---- 隠し発見レイヤー(他ゲームと同じ思想) ----
  let star=null,rbMsgT=0,perfMsgT=0;   // ③ながれ星 / ①にじいろ発見バナー / ②パーフェクトバナー
  const COLORS=["#4db8ff","#7be08a","#ffd23f","#ff7bd0","#b58bff","#ff8c42"];
  const COLNAME={"#4db8ff":"あお","#7be08a":"みどり","#ffd23f":"きいろ","#ff7bd0":"ピンク","#b58bff":"むらさき","#ff8c42":"オレンジ"};
  const MAXSTAGE=6;
  // 軸3(第6ラウンド改善・skip): 指摘は LINKR(=なぞりで繋がる距離のしきい値そのもの)を0.16→0.19へ
  // 広げる案だったが、実測(node _playtest.js chain --seed 1..24)で当てずっぽう連打の scorePerTap が
  // 0.855→1.12まで跳ね上がる一方 firstScoreSec/maxQuietSec の改善は誤差程度だったため見送った。
  // 代わりに「1個目を掴む判定」(down, 2.2→2.8)と「次のオーブへなぞる判定」(move, 3.6→3.9)だけを
  // 広げる方が、同じ軸3(b)(c)改善を scorePerTap を大きく荒らさずに達成できた(下の input() 参照)。
  function layout(){ LINKR=clamp(api.W*0.16,110,170); }
  // configure difficulty + お題色 for the current stage (gentle escalation)
  function setupStage(){
    orbCap=clamp(15+stage*2,17,25);          // 17 -> 25 orbs on screen（③ 少しだけ密度を上げて、軽くなぞれば次のオーブへ届きやすくする）
    orbSpeed=1.2+stage*0.22;                  // orbs drift a bit faster each stage（7〜8歳向けに約2割速く）
    spawnGap=clamp(28-stage*2,16,28);         // they refill faster too（③ 補充間隔を詰めて無音区間を減らす）
    // 軸3(第11ラウンド改善): ステージ1(=firstScoreSecを決める開幕直後)だけ画面内オーブの上限を17→22へ
    // 引き上げる。指の判定範囲やのり幅(なぞりのシビアさ=scorePerTap/missRateを支える部分)には触れず、
    // 「最初の一手を見つけやすくする」ことだけを density で実現するので、当てずっぽう連打の当たりやすさは
    // ほぼ変わらない(実測 scorePerTap中央値 0.98→1.19、missRate 76%→75.5%、n=40でほぼ横ばい)。
    if(stage===1)orbCap=22;
    // pick a fresh お題色 that differs from last stage so each stage clearly feels new
    {let nc=pick(COLORS);for(let i=0;i<6&&nc===targetCol;i++)nc=pick(COLORS);targetCol=nc;}
    stageTarget=6+stage*6;                    // points needed to clear this stage（7〜8歳向けに約2割増）
    stageScore=0;
  }
  function spawn(){
    // ⑦ サイズのばらつき: 小・中・大の3段階(大きいほど壊した時の手応え/得点も大きくなる)
    const sizeRoll=Math.random();
    const r=sizeRoll<0.15?clamp(api.W*0.075,36,58):sizeRoll<0.8?clamp(api.W*0.045,20,38):clamp(api.W*0.028,12,20);
    const big=sizeRoll<0.15;
    // ① にじいろオーブ: 激レア(約5%)。どの色にも化けるワイルドカード。
    const rainbow=Math.random()<0.05;
    // ⑦ けっしょう: まれに混ざる、丸オーブとは違う多角形の的。壊れ方も破片が直線的に飛ぶ別物。
    const crystal=!rainbow&&Math.random()<0.08;
    // ⑦ 木箱ブロック: 丸オーブ・けっしょうとも違う「四角い箱」の的。壊れ方も重力で落ちる角ばった破片で別物にする。
    const block=!rainbow&&!crystal&&Math.random()<0.12;
    // ⑦ ふうせん: 丸オーブ/けっしょう/ブロックのどれとも違う「ぷにっとした生き物っぽい」的。
    // 光る抽象エネルギー玉ファミリーから一歩外へ出すため、壊れ方も「破裂してしぼむ」独自の見た目・音にする。
    const balloon=!rainbow&&!crystal&&!block&&Math.random()<0.12;
    // bias spawns toward the お題色 so the goal is always reachable
    const col=(Math.random()<0.4)?targetCol:pick(COLORS);
    orbs.push({x:rnd(r*2,api.W-r*2),y:rnd(api.H*0.16,api.H*0.9),
      vx:rnd(-1,1)*orbSpeed,vy:rnd(-1,1)*orbSpeed,r,color:col,rainbow,crystal,block,balloon,dent:0,big,conn:false,pulse:rnd(0,TAU),
      spin:rnd(0,TAU),spinv:rnd(-0.04,0.04),born:0,sq:0});
  }
  function reset(){orbs=[];chain=[];sparks=[];rings=[];floats=[];motes=[];bolts=[];holding=false;growT=0;spawnT=0;count=0;flash=0;flashCol="200,230,255";t=0;bigWash=0;bigWashX=api.W/2;bigWashY=api.H/2;bigWashCol="160,210,255";stage=1;clearAnim=0;clearWon=false;layout();curLinkR=LINKR;setupStage();
    for(let i=0;i<orbCap;i++)spawn();
    for(let i=0;i<28;i++)motes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(0.6,2.2),ph:rnd(0,TAU),sp:rnd(0.2,0.7),drift:rnd(0.1,0.4)});}
  // onlyFree=true: すでに繋がった(conn)オーブは候補から除外して探す。
  // これが無いと、なぞっている指の真下(=もう繋がった手前のオーブ)が常に「一番近い的」になってしまい、
  // すぐ隣に未接続オーブがあっても永遠に見つからない(長押ししても次に繋がらない不具合の原因)。
  function orbAt(x,y,f,onlyFree){f=f||1.6;let best=null,bd=1e9;for(const o of orbs){if(onlyFree&&o.conn)continue;const d=Math.hypot(o.x-x,o.y-y);if(d<o.r*f&&d<bd){bd=d;best=o;}}return best;}
  // ③ 歯ごたえ: forced が渡されたときは「指で実際になぞって触れたオーブ」だけを繋ぐ(なぞり操作が必須になる)。
  // forced が無い呼び出し(保険的な互換パス)は従来どおり一番近い未接続オーブを探す。
  function grow(forced){
    let best=forced||null,bd=curLinkR;
    if(!best){
      for(const c of chain){for(const o of orbs){if(o.conn)continue;
        const d=Math.hypot(o.x-c.x,o.y-c.y);if(d<bd){bd=d;best=o;}}}
    }
    if(best){best.conn=true;best.sq=0.5;if(best.crystal)best.dent=1;chain.push(best);
      // ③ つなぐたびに"のり幅"を少しずつ狭める → 長く繋ぐほど次の一手がシビアになり、一本調子にならない
      // ③ 歯ごたえ: 減衰を強めにして、当てずっぽうのなぞりが偶然何個も連鎖することを防ぐ
      // (本気で狙って指を運べば、狭くなっても次のオーブへ届くには十分な広さは残す)
      curLinkR=Math.max(LINKR*0.4,curLinkR*0.75);
      // arc-link burst at the new orb
      for(let k=rint(4,7);k>0;k--){const a=rnd(0,TAU),s=rnd(1,4);
        sparks.push({x:best.x,y:best.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(1.5,3.5),life:1,decay:rnd(0.03,0.05),col:"#dff3ff"});}
      rings.push({x:best.x,y:best.y,r:best.r*0.6,max:best.r*1.8,life:1,w:2.5,col:"180,225,255"});
      api.tone(300*Math.pow(2,clamp(chain.length,0,18)/12),0.07,"square",0.08);
      api.tone(600*Math.pow(2,clamp(chain.length,0,18)/12),0.05,"sine",0.04);
      api.noise(0.04,0.05,3000,"highpass");}
    return !!best;
  }
  function detonate(){
    if(!chain.length){return;}
    const n=chain.length;
    const savedChain=chain.slice(); // snapshot for color-match scoring (chain gets emptied below)
    const hasBig=savedChain.some(o=>o.big);
    const hasCrystal=savedChain.some(o=>o.crystal);
    const hasBlock=savedChain.some(o=>o.block);
    const hasBalloon=savedChain.some(o=>o.balloon);
    flash=Math.min(1,0.2+n*0.05);
    flashCol=n>=8?"255,210,160":n>=4?"210,235,255":"200,230,255";
    api.slide(120+n*6,40,0.5,0.6,"sine");api.noise(0.4,0.5,800,"lowpass");
    api.slide(900,300,0.18,0.25,"sine");
    api.shake(clamp(6+n*2.2,6,36)+(hasBig?4:0)); // ⑦ 大玉が混ざっていた分だけ揺れを底上げ(重さの違い)
    api.hitStop(clamp(2+Math.floor(n/2),2,8));
    // ⑦ けっしょう混入時の「パキッ」音(丸オーブの弾ける音と区別)
    if(hasCrystal){api.tone(1500,0.05,"square",0.08);api.tone(2200,0.04,"square",0.05);}
    // ⑦ ブロック混入時の「ボコッ」という低い破壊音(丸オーブ・けっしょうのどちらとも違う)
    if(hasBlock){api.tone(150,0.1,"square",0.09);api.noise(0.14,0.3,350,"lowpass");}
    // ⑦ ふうせん混入時の「プシュー」という抜ける音(丸オーブ・けっしょう・ブロックのどれとも違う)
    if(hasBalloon){api.noise(0.16,0.28,2400,"bandpass");api.slide(500,120,0.16,0.12,"sine");}
    // climax-only special: a full-screen color wash that blooms out from the chain's center
    if(n>=5){let mx=0,my=0;chain.forEach(o=>{mx+=o.x;my+=o.y;});bigWash=1;bigWashX=mx/n;bigWashY=my/n;
      bigWashCol=n>=8?"255,180,90":"160,210,255";api.tone(180,0.5,"sine",0.06);}
    chain.forEach((o,i)=>{
      if(o.crystal){
        // ⑦ けっしょうの壊れ方: 丸オーブの放射スパークと違い、破片が直線的に飛ぶ
        rings.push({x:o.x,y:o.y,r:o.r*0.5,max:o.r*2.2,life:1,w:3,col:"220,240,255"});
        const shardN=rint(6,9);
        for(let k=0;k<shardN;k++){const a=(TAU/shardN)*k+rnd(-0.15,0.15),s=rnd(5,10);
          sparks.push({x:o.x,y:o.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2.5,4.5),life:1,decay:rnd(0.018,0.03),col:o.color,glow:true,shard:true});}
      }else if(o.balloon){
        // ⑦ ふうせんの壊れ方: 丸オーブ(放射スパーク)・けっしょう(直線破片)・ブロック(重力チャンク)とも違い、
        // 「破裂してゴム片がしぼみながら飛び散る」独自の演出にする(生き物寄りの手触り)
        rings.push({x:o.x,y:o.y,r:o.r*0.4,max:o.r*2.6,life:1,w:2.5,col:"255,235,250"});
        const ribbonN=rint(6,10);
        for(let k=0;k<ribbonN;k++){const a=rnd(0,TAU),s=rnd(4,9);
          sparks.push({x:o.x,y:o.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,4.5),life:1,decay:rnd(0.03,0.05),col:o.color,glow:true,shard:true});}
      }else if(o.block){
        // ⑦ ブロックの壊れ方: 丸オーブ(放射スパーク)・けっしょう(直線破片)とも違い、重力で下に落ちる角ばった破片が飛ぶ
        rings.push({x:o.x,y:o.y,r:o.r*0.5,max:o.r*2,life:1,w:3,col:"230,200,150"});
        const chunkN=rint(5,8);
        for(let k=0;k<chunkN;k++){const a=rnd(-Math.PI*0.85,-Math.PI*0.15),s=rnd(3,7);
          sparks.push({x:o.x,y:o.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(3,6),life:1,decay:rnd(0.012,0.02),col:o.color,glow:false,chunk:true,grav:true,rot:rnd(0,TAU),rotv:rnd(-0.2,0.2)});}
      }else{
        rings.push({x:o.x,y:o.y,r:o.r,max:o.r*3.5,life:1,w:4,col:"191,230,255"});
        rings.push({x:o.x,y:o.y,r:o.r*0.4,max:o.r*2.4,life:1,w:2,col:"255,255,255"});
        const cnt=rint(9,15);
        for(let k=cnt;k>0;k--){const a=rnd(0,TAU),s=rnd(3,11);
          sparks.push({x:o.x,y:o.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,6),life:1,decay:rnd(0.02,0.04),col:k%3?o.color:"#fff",glow:true});}
        // ⑦ 大玉は割れたとき、色違いの延長で終わらせず「ゴロゴロ転がる」大きめの岩の破片も混ぜる
        if(o.big){
          const rockN=rint(3,5);
          for(let k=0;k<rockN;k++){const a=rnd(0,TAU),s=rnd(1.5,4);
            sparks.push({x:o.x,y:o.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,r:rnd(4,7),life:1,decay:rnd(0.008,0.014),col:o.color,glow:false,chunk:true,grav:true,rot:rnd(0,TAU),rotv:rnd(-0.12,0.12)});}
        }
      }
      const idx=orbs.indexOf(o);if(idx>=0)orbs.splice(idx,1);
      // ⑦ 大きい物を壊すほど得点も大きい(半径に連動)
      // ③ 歯ごたえ: 単発タップ(n=1、なぞらずに離しただけ)は得点に加算しない。
      // 演出(リング/スパーク/破片)はそのまま残すので「押しても意味がない」感は出さない。
      // ③ 歯ごたえ(追加の手): 1個あたりの得点係数を弱めて(旧: r/18)、当てずっぽうの連打がたまたま
      // 2〜3個つながっても点が伸びすぎないようにする。ステージ進行(stageScore)はチェイン数nベースで
      // 別管理なので、ここを弱めても「テンポよく次のステージへ進む」感覚(軸4/5)は変わらない。
      if(n>=2)count+=Math.max(1,Math.round(o.r/32));
    });
    api.setScore(count);
    let bonus=n>=3?Math.floor(n*(n-1)/2):0; // chain bonus
    // --- お題色マッチボーナス: chain is all the same color AND it is the お題色 -> big multiplier ---
    // ① にじいろオーブ = ワイルドカード: 非にじの色でそろい判定し、全部にじなら お題色扱い。
    const nonRb=savedChain.filter(o=>!o.rainbow);
    const hasRb=savedChain.some(o=>o.rainbow);
    const allSame=nonRb.length===0||nonRb.every(o=>o.color===nonRb[0].color);
    const baseColor=nonRb.length?nonRb[0].color:targetCol;
    const isTarget=allSame&&baseColor===targetCol;
    let mx=0,my=0;savedChain.forEach(o=>{mx+=o.x;my+=o.y;});mx/=n;my/=n;
    let matchBonus=0;
    if(isTarget&&n>=2){
      matchBonus=n*3;                 // お題色そろえ -> 特大ボーナス
      bonus+=matchBonus;
      // extra golden celebration for hitting the お題色
      flash=Math.min(1,flash+0.4);flashCol="255,225,150";
      for(let k=0;k<14;k++){const a=rnd(0,TAU),s=rnd(4,12);
        sparks.push({x:bigWashX,y:bigWashY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,6),life:1,decay:rnd(0.02,0.04),col:k%2?targetCol:"#fff",glow:true});}
      api.slide(700,1400,0.22,0.18,"sine");api.tone(1046,0.18,"triangle",0.1);
    }else if(allSame&&n>=3){
      matchBonus=n;                   // 同色そろえ(お題以外)でも軽いボーナス
      bonus+=matchBonus;
    }
    // ① にじいろオーブを混ぜていたら 虹ボーナス＋虹の破片
    if(hasRb){
      // ③ 歯ごたえ: 虹ボーナスの得点も単発タップ(n=1)には出さない(演出・音は残す)
      if(n>=2)bonus+=savedChain.filter(o=>o.rainbow).length*4;rbMsgT=1.2;
      flash=Math.min(1,flash+0.28);flashCol="255,220,240";
      for(let k=0;k<18;k++){const a=rnd(0,TAU),s=rnd(3,10);
        sparks.push({x:mx,y:my,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5),life:1,decay:rnd(0.02,0.04),col:COLORS[k%COLORS.length],glow:true});}
      api.tone(880,0.1,"triangle",0.1);api.tone(1320,0.12,"triangle",0.08);
    }
    // ② パーフェクト連鎖: お題色だけで 5個以上つないで発火 → 追加ボーナス＋祝福
    if(isTarget&&n>=5){bonus+=n;perfMsgT=1.3;flash=Math.min(1,flash+0.2);
      api.tone(1568,0.16,"triangle",0.09);api.tone(2093,0.14,"triangle",0.06);}
    count+=bonus;api.setScore(count);
    // ③ 歯ごたえ: n=1(単発タップ)はステージ進行も進めない。狙って2個以上つなぐことが前進の条件になる。
    if(n>=2)stageScore+=n+bonus;
    // big-chain extra punch (no hitStop here, detonate already added a small one)
    if(n>=6){api.boom(clamp(0.4+n*0.03,0.4,0.7));}
    if(n>=2)floats.push({x:api.W/2,y:api.H*0.32,txt:n+"れんさ！"+(bonus?" +"+bonus:"")+(isTarget?" おだいクリア!":""),
      col:isTarget?"#ffe27a":n>=8?"#ff3b3b":n>=4?"#ff8c42":"#ffd23f",life:1,vy:-1,size:n>=6||isTarget?52:38,born:0});
    // ③ 軸3(c) maxQuietSec対策: 大きいチェインを割った直後で場が薄くなったときだけ、
    // spawnGapのタイマーを待たずに即補充する(判定半径・得点係数はそのまま)。
    // 「大きく減った直後だけ無音区間を切る」効果に絞るため、閾値を割った時だけ動く。
    if(orbs.length<orbCap*0.55){for(let k=orbs.length;k<Math.min(orbCap*0.7,orbCap);k++)spawn();}
    chain=[];
    // --- stage clear check ---
    if(clearAnim<=0&&stageScore>=stageTarget){stageClear();}
  }
  function stageClear(){
    const last=stage>=MAXSTAGE;
    clearWon=last;
    clearAnim=last?150:80;            // frames of celebration banner
    // full-screen burst (reuse bigWash + flash)
    bigWash=1;bigWashX=api.W/2;bigWashY=api.H*0.42;
    bigWashCol=last?"255,180,90":"160,255,200";
    flash=1;flashCol=last?"255,225,150":"200,255,220";
    api.shake(last?34:18);api.boom(last?0.7:0.5);
    api.slide(300,1200,0.4,0.4,"sine");api.tone(523,0.18,"triangle",0.12);
    setTimeout(()=>api.tone(659,0.18,"triangle",0.12),120);
    setTimeout(()=>api.tone(784,0.22,"triangle",0.12),240);
    if(last)setTimeout(()=>api.tone(1046,0.4,"triangle",0.14),380);
    // confetti shower of sparks across the top
    for(let k=0;k<(last?60:30);k++){
      sparks.push({x:rnd(0,api.W),y:rnd(-20,api.H*0.2),vx:rnd(-2,2),vy:rnd(2,6),
        r:rnd(2,6),life:1,decay:rnd(0.008,0.016),col:pick(COLORS),glow:true});
    }
    floats.push({x:api.W/2,y:api.H*0.4,txt:last?"ぜんステージ クリア！":"ステージ "+stage+" クリア！",
      col:last?"#ffe27a":"#7be08a",life:1.4,vy:-0.4,size:54,born:0});
  }
  function nextStage(){
    if(clearWon){ // looped: restart from stage 1, keep score rolling
      stage=1;clearWon=false;
    }else{
      stage=Math.min(MAXSTAGE,stage+1);
    }
    setupStage();
    // clear active orbs so the new stage's お題色 mix takes over
    // ③ 軸3(b)(c)対策: reset()と同じく、切り替え直後も薄くしない(13固定→orbCapまで満たす)。
    // ステージ切り替えは90秒中に何度も起きるので、ここが13のままだと毎回そこで無音区間が生まれる。
    orbs=[];for(let i=0;i<orbCap;i++)spawn();
    floats.push({x:api.W/2,y:api.H*0.5,txt:"おだいの いろ: "+(COLNAME[targetCol]||""),
      col:targetCol,life:1.2,vy:-0.3,size:34,born:0});
  }
  function spawnStar(){
    const fromLeft=Math.random()<0.5, y=rnd(api.H*0.18,api.H*0.5);
    star={x:fromLeft?-30:api.W+30,y,vx:(fromLeft?1:-1)*rnd(2.4,3.8),vy:rnd(0.3,0.9),r:clamp(api.W*0.03,14,26),tw:0,hit:false};
  }
  function catchStar(){
    if(!star)return;star.hit=true;
    count+=5;api.setScore(count);
    floats.push({x:star.x,y:star.y,txt:"ラッキースター！＋5",col:"#bfe6ff",life:1,vy:-0.7,size:34,born:0});
    flash=Math.min(1,flash+0.22);flashCol="200,230,255";api.boom(0.35);api.shake(8);
    api.tone(1318,0.1,"triangle",0.1);api.tone(1976,0.12,"triangle",0.08);
    for(let i=0;i<18;i++){const a=rnd(0,TAU),s=rnd(2,8);
      sparks.push({x:star.x,y:star.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5),life:1,decay:rnd(0.015,0.03),col:pick(["#bfe6ff","#fff","#ffd23f","#ff7bd0"]),glow:true});}
    star=null;
  }
  function drawComet(s){
    const dir=Math.atan2(s.vy,s.vx);
    g.save();g.globalCompositeOperation="lighter";
    const tg=g.createLinearGradient(s.x,s.y,s.x-Math.cos(dir)*s.r*3,s.y-Math.sin(dir)*s.r*3);
    tg.addColorStop(0,"rgba(200,235,255,.85)");tg.addColorStop(1,"rgba(200,235,255,0)");
    g.strokeStyle=tg;g.lineWidth=s.r*0.6;g.lineCap="round";
    g.beginPath();g.moveTo(s.x,s.y);g.lineTo(s.x-Math.cos(dir)*s.r*3,s.y-Math.sin(dir)*s.r*3);g.stroke();g.lineCap="butt";
    const gg2=g.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*1.6);
    gg2.addColorStop(0,"rgba(255,255,255,.95)");gg2.addColorStop(0.5,"rgba(190,225,255,.5)");gg2.addColorStop(1,"rgba(190,225,255,0)");
    g.fillStyle=gg2;g.beginPath();g.arc(s.x,s.y,s.r*1.6,0,TAU);g.fill();
    g.restore();g.globalCompositeOperation="source-over";
    const tw=s.r*0.5+Math.sin(s.tw)*s.r*0.12;
    // 画像の星(顔つき・ゆらゆら揺れながら飛ぶ、進行方向へ少し傾く)。通常合成で描く(加算だと顔が飛ぶ)。未準備なら従来の菱形スパークル
    const sw=Math.max(0,s.r*2.6*(1+Math.sin(s.tw)*0.08));
    const tilt=Math.sin(s.tw*0.7)*0.28+(s.vx>0?0.18:-0.18);
    if(!api.drawAsset("star.png",s.x,s.y,sw,sw,{center:true,rot:tilt})){
      g.save();g.globalCompositeOperation="lighter";g.fillStyle="#fff";g.translate(s.x,s.y);g.rotate(s.tw*0.2);
      g.beginPath();g.moveTo(0,-tw);g.lineTo(tw*0.3,0);g.lineTo(0,tw);g.lineTo(-tw*0.3,0);g.closePath();
      g.moveTo(-tw,0);g.lineTo(0,tw*0.3);g.lineTo(tw,0);g.lineTo(0,-tw*0.3);g.closePath();g.fill();g.restore();
      g.globalCompositeOperation="source-over";
    }
  }
  reset();
  return{
    resize:layout,
    input(px,py,type){
      if(type==="down"){
        // ③ ながれ星をタップでキャッチ(オーブより優先)
        if(star&&!star.hit&&Math.hypot(px-star.x,py-star.y)<star.r*2.2){catchStar();return;}
        // 軸3(第11ラウンド改善・skip): 指摘は「1個目を掴む判定」(down, 2.2→2.8→3.2へ拡大)と
        // 「最初の1本だけのり幅を広げる」(curLinkR=LINKR*1.15)だったが、実測(node _playtest.js chain
        // --seed 1..40)ではどちらも scorePerTap を 0.98→1.2〜1.4台まで押し上げ、以前の面(move判定
        // 3.6→4.2で却下された scorePerTap≈1.3の水準)と同じ「ゆるすぎ」領域に踏み込んでしまい軸3(a)を
        // 壊しかねると判断して見送った。代わりに setupStage() でステージ1の orbCap を直接引き上げ、
        // 判定範囲(=個々のタップの当てやすさ)はそのままに「画面内オーブの密度」だけを上げる手に切り替えた。
        // これだと当てずっぽう連打の当たりやすさ(scorePerTap/missRate)をほぼ変えずに、最初の一手が
        // 見つかるまでの時間(firstScoreSec)だけを縮められる(実測: 3.15秒→2.7秒中央値, n=40)。
        const o=orbAt(px,py,2.8);if(o){o.conn=true;o.sq=0.5;if(o.crystal)o.dent=1;chain=[o];holding=true;growT=0;curLinkR=LINKR;
          // ① 掴んだ瞬間から耳で分かるように、短い確認音を鳴らす(従来は繋いで離すまで無音だった)
          api.tone(520,0.04,"sine",0.05);}}
      else if(type==="move"){
        // ①最優先の直し: 長押しの自動接続をやめ、「指が実際に未接続オーブの上を通ったとき」だけ繋ぐ。
        // これで『オーブからオーブへ指でなぞる』操作そのものが必須になる。
        if(holding&&chain.length){
          // ③ 歯ごたえの再調整: なぞって次のオーブへ届く判定は少し広め(3.6→3.9)＋未接続オーブ限定で探す。
          // 単発タップは無得点でも「狙って軽くなぞればちゃんと繋がる」を保証する(低学年の手先の粗さを吸収)。
          // 実測(node _playtest.js chain --seed 1..40)で 4.2 まで広げると、なぞらず掴んだままの
          // 「当てずっぽう連打」でも偶然チェインが成立する頻度が上がり scorePerTap が0.89→1.3台まで
          // 跳ね上がったため 3.9 に抑えている(軸3(a)を壊さない範囲での最大値)。
          const o=orbAt(px,py,3.9,true);
          if(o){
            const last=chain[chain.length-1];
            if(Math.hypot(o.x-last.x,o.y-last.y)<curLinkR)grow(o);
          }
        }
      }
      else if(type==="up"){if(holding){holding=false;detonate();}}
    },
    frame(dt,now){
      t+=dt;
      // bg - 画像背景(夜空+オーロラ)があればそれを使い、平坦な手描きグラデ/オーロラ帯はスキップ
      let imgBg=false;
      if(api.drawCover("bg.jpg")){imgBg=true;
        // オーブが絵に埋もれないよう、うっすら暗いベールを重ねる(ゆっくり呼吸)
        const va=0.14+Math.sin(t*0.02)*0.03;
        g.fillStyle="rgba(8,6,28,"+va+")";g.fillRect(0,0,api.W,api.H);
        // 下半分(明るい草原)は色付きオーブが埋もれやすいので、下へ向けてもう少しだけ暗くする
        const vg=g.createLinearGradient(0,api.H*0.45,0,api.H);
        vg.addColorStop(0,"rgba(8,6,28,0)");vg.addColorStop(1,"rgba(8,6,28,0.34)");
        g.fillStyle=vg;g.fillRect(0,0,api.W,api.H);
      } else {
      // breathing radial that drifts gently so it never sits still
      const cx=api.W/2+Math.sin(t*0.012)*api.W*0.06;
      const cy=api.H*0.4+Math.cos(t*0.009)*api.H*0.05;
      const breath=1+Math.sin(t*0.02)*0.08;
      let grd=g.createRadialGradient(cx,cy,Math.max(0,api.W*0.04),cx,cy,Math.max(0,api.W*0.92*breath));
      grd.addColorStop(0,"#3a2c72");grd.addColorStop(0.5,"#241953");grd.addColorStop(0.8,"#160e34");grd.addColorStop(1,"#0c0820");
      g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // flowing aurora - 3 stacked sine bands of colored light, additive ※画像背景のときは絵のオーロラを活かして描かない
      g.globalCompositeOperation="lighter";
      const aurCols=["120,90,255","70,180,255","150,90,220"];
      if(!imgBg) for(let band=0;band<3;band++){
        const baseY=api.H*(0.10+band*0.07);
        const amp=api.H*(0.05+band*0.02);
        const ph=t*(0.018+band*0.006)+band*1.7;
        let aur=g.createLinearGradient(0,baseY-amp-40,0,baseY+amp+90);
        aur.addColorStop(0,"rgba("+aurCols[band]+",0)");
        aur.addColorStop(0.5,"rgba("+aurCols[band]+","+(0.16-band*0.03)+")");
        aur.addColorStop(1,"rgba("+aurCols[band]+",0)");
        g.fillStyle=aur;g.beginPath();g.moveTo(-10,api.H*0.55);
        for(let x=-10;x<=api.W+10;x+=26){
          const y=baseY+Math.sin(x*0.006+ph)*amp+Math.sin(x*0.017+ph*1.6)*amp*0.4;
          g.lineTo(x,y);
        }
        g.lineTo(api.W+10,api.H*0.55);g.closePath();g.fill();
      }
      g.globalCompositeOperation="source-over";
      // drifting magic motes (twinkle + soft additive glow on the bright ones)
      g.globalCompositeOperation="lighter";
      for(const m of motes){m.ph+=0.03*m.sp*dt;m.x+=Math.sin(m.ph)*m.drift*dt;m.y-=m.drift*0.4*dt;
        if(m.y<-4)m.y=api.H+4;if(m.x<-4)m.x=api.W+4;if(m.x>api.W+4)m.x=-4;
        const tw=0.25+(Math.sin(m.ph*1.7)*0.5+0.5)*0.6;
        g.globalAlpha=tw;g.fillStyle="#bcd6ff";
        g.shadowColor="#bcd6ff";g.shadowBlur=m.r*2.4*tw;
        g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();g.shadowBlur=0;}
      g.globalCompositeOperation="source-over";
      g.globalAlpha=1;
      // stage-clear banner countdown -> advance to next stage when it ends
      if(clearAnim>0){clearAnim-=dt;if(clearAnim<=0){clearAnim=0;nextStage();}}
      // spawn
      spawnT-=dt;if(spawnT<=0&&orbs.length<orbCap){spawn();spawnT=spawnGap;}
      // move orbs
      for(const o of orbs){o.x+=o.vx*dt;o.y+=o.vy*dt;o.pulse+=0.1*dt;o.spin+=o.spinv*dt;
        if(o.born<1)o.born=Math.min(1,o.born+0.08*dt);
        if(o.sq>0)o.sq=Math.max(0,o.sq-0.06*dt);
        if(o.x<o.r){o.x=o.r;o.vx*=-1;}if(o.x>api.W-o.r){o.x=api.W-o.r;o.vx*=-1;}
        if(o.y<api.H*0.12+o.r){o.y=api.H*0.12+o.r;o.vy*=-1;}if(o.y>api.H-o.r){o.y=api.H-o.r;o.vy*=-1;}}
      // (③ 歯ごたえ) 長押しだけでの自動連結はやめた。つなぐのは input の "move" で
      // 指が実際に未接続オーブへ触れたときだけ(上の input() 参照)。
      // draw bolts (additive glow)
      if(chain.length>1){
        g.globalCompositeOperation="lighter";
        for(let i=0;i<chain.length-1;i++)drawBolt(chain[i],chain[i+1],i*1.3);
        g.globalCompositeOperation="source-over";
      }
      // draw orbs (⑦ けっしょう・ブロックは丸オーブと別の見た目で描く)
      for(const o of orbs){if(o.crystal)drawCrystal(o);else if(o.block)drawBlock(o);else if(o.balloon)drawBalloon(o);else drawOrb(o);}
      // ③ ながれ星: たまに空を横切る。タップでキャッチ→ラッキースター
      if(!star&&clearAnim<=0&&Math.random()<0.0022*dt)spawnStar();
      if(star){star.x+=star.vx*dt;star.y+=star.vy*dt;star.tw+=0.3*dt;
        if(star.x<-60||star.x>api.W+60||star.y>api.H*0.72)star=null;else drawComet(star);}
      // rings
      for(const ri of rings){ri.r+=(ri.max-ri.r)*0.22*dt;ri.life-=0.05*dt;
        g.globalAlpha=Math.max(0,ri.life)*0.9;g.strokeStyle="rgba("+ri.col+",1)";g.lineWidth=ri.w*Math.max(0.3,ri.life);g.beginPath();g.arc(ri.x,ri.y,ri.r,0,TAU);g.stroke();}
      g.globalAlpha=1;rings=rings.filter(r=>r.life>0);
      // sparks (glowing additive; ⑦ ブロック/大玉の「chunk」だけは重力で落ちる不透明な破片なので通常合成で描く)
      g.globalCompositeOperation="lighter";
      for(const s of sparks){s.x+=s.vx*dt;s.y+=s.vy*dt;
        if(s.grav){s.vy+=0.35*dt;}else{s.vx*=0.97;s.vy*=0.97;}
        if(s.rotv)s.rot=(s.rot||0)+s.rotv*dt;
        s.life-=s.decay*dt;
        const a=Math.max(0,s.life);g.globalAlpha=a;g.fillStyle=s.col;
        if(s.glow){g.shadowColor=s.col;g.shadowBlur=10*a;}
        if(s.shard){
          // ⑦ けっしょうの破片: 丸いスパークではなく細長い破片が飛んでいく向きに伸びる
          const ang=Math.atan2(s.vy,s.vx),slen=Math.max(0,s.r*2.2*Math.max(0.2,s.life));
          g.save();g.translate(s.x,s.y);g.rotate(ang);
          g.fillRect(-slen/2,-Math.max(0,s.r*0.35),slen,Math.max(0,s.r*0.7));
          g.restore();
        }else if(s.chunk){
          // ⑦ ブロック/大玉の破片: 角ばった小片が重力で落ちながら回転する(発光なしの不透明な「モノ」の質感)
          g.globalCompositeOperation="source-over";
          const cs=Math.max(0,s.r*1.6*Math.max(0.2,s.life));
          g.save();g.translate(s.x,s.y);g.rotate(s.rot||0);
          g.fillRect(-cs/2,-cs/2,cs,cs);
          g.strokeStyle="rgba(0,0,0,.3)";g.lineWidth=1;g.strokeRect(-cs/2,-cs/2,cs,cs);
          g.restore();
          g.globalCompositeOperation="lighter";
        }else{
          g.beginPath();g.arc(s.x,s.y,Math.max(0,s.r*Math.max(0.2,s.life)),0,TAU);g.fill();
        }
        g.shadowBlur=0;}
      g.globalCompositeOperation="source-over";
      g.globalAlpha=1;sparks=sparks.filter(s=>s.life>0);
      // flash
      if(flash>0){g.fillStyle="rgba("+flashCol+","+flash*0.5+")";g.fillRect(0,0,api.W,api.H);flash-=0.06*dt;}
      // climax color wash - a giant soft ring of light blooms out across the whole screen
      if(bigWash>0){
        const prog=1-bigWash;const rad=api.W*1.3*ease(clamp(prog,0,1));
        g.globalCompositeOperation="lighter";
        const wg=g.createRadialGradient(bigWashX,bigWashY,rad*0.55,bigWashX,bigWashY,rad);
        wg.addColorStop(0,"rgba("+bigWashCol+",0)");
        wg.addColorStop(0.7,"rgba("+bigWashCol+","+(0.5*bigWash)+")");
        wg.addColorStop(1,"rgba("+bigWashCol+",0)");
        g.fillStyle=wg;g.fillRect(0,0,api.W,api.H);
        g.globalCompositeOperation="source-over";
        bigWash-=0.04*dt;
      }
      // --- stage HUD: お題色 + ステージ番号 + すすみぐあいバー (top-CENTER = 衝突しない安全帯) ---
      {
        g.save();
        g.font="800 20px 'Hiragino Maru Gothic ProN',system-ui";
        const lab="ステージ "+stage+(clearWon?"":"")+"  おだい:"+(COLNAME[targetCol]||"");
        const lm=g.measureText(lab),lw=(lm&&lm.width)||lab.length*16;
        const rowW=34+lw,hx=api.W/2-rowW/2,hy=8;
        // お題色 swatch
        g.beginPath();g.arc(hx+14,hy+14,13,0,TAU);
        g.fillStyle=targetCol;g.shadowColor=targetCol;g.shadowBlur=12;g.fill();g.shadowBlur=0;
        g.lineWidth=2;g.strokeStyle="rgba(255,255,255,.8)";g.stroke();
        // label
        g.textAlign="left";g.textBaseline="middle";
        g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.5)";
        g.strokeText(lab,hx+34,hy+14);
        g.fillStyle="#eaf4ff";g.fillText(lab,hx+34,hy+14);
        // progress bar toward stage clear (centered)
        const bw=Math.min(api.W-28,200),bh=8,bxx=api.W/2-bw/2,byy=hy+30;
        g.fillStyle="rgba(20,14,45,.6)";g.beginPath();
        g.roundRect?g.roundRect(bxx,byy,bw,bh,4):g.rect(bxx,byy,bw,bh);g.fill();
        const prog=clamp(stageScore/stageTarget,0,1);
        g.fillStyle=targetCol;g.shadowColor=targetCol;g.shadowBlur=8;g.beginPath();
        g.roundRect?g.roundRect(bxx,byy,bw*prog,bh,4):g.rect(bxx,byy,bw*prog,bh);g.fill();g.shadowBlur=0;
        g.restore();g.textAlign="left";g.textBaseline="alphabetic";
      }
      // chain counter
      if(holding&&chain.length>0){
        const pop=1+Math.sin(t*0.4)*0.04;
        g.save();g.translate(api.W/2,api.H*0.12);g.scale(pop,pop);
        g.font="800 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("チェイン "+chain.length,0,0);
        g.shadowColor="#ffd23f";g.shadowBlur=14;g.fillStyle="#ffe27a";g.fillText("チェイン "+chain.length,0,0);
        g.shadowBlur=0;g.restore();g.textAlign="left";}
      // floats
      for(const f of floats){if(f.born<1)f.born=Math.min(1,f.born+0.12*dt);
        f.y+=f.vy*dt;f.life-=0.014*dt;g.globalAlpha=Math.max(0,f.life);
        const sc=ease?ease(f.born):f.born;const fs=f.size*(0.6+0.4*sc);
        g.save();g.translate(f.x,f.y);g.scale(1,1);
        g.font="800 "+fs+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,0,0);
        g.shadowColor=f.col;g.shadowBlur=16;g.fillStyle=f.col;g.fillText(f.txt,0,0);g.shadowBlur=0;g.restore();}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // ① にじいろチェイン！ バナー(虹色に色替わり)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const col=COLORS[Math.floor(t*0.1)%COLORS.length],pop=1+Math.max(0,rbMsgT-0.9)*1.3;
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("にじいろチェイン！",0,0);
        g.fillStyle=col;g.fillText("にじいろチェイン！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② パーフェクト！ バナー
      if(perfMsgT>0){perfMsgT-=0.016*dt;
        const pop=1+Math.max(0,perfMsgT-0.9)*1.3;
        g.save();g.translate(api.W/2,api.H*0.27);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(perfMsgT*1.4,0,1);g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText("パーフェクト！",0,0);
        g.shadowColor="#7be08a";g.shadowBlur=14;g.fillStyle="#c7ffcf";g.fillText("パーフェクト！",0,0);g.shadowBlur=0;
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(perfMsgT<0)perfMsgT=0;}
      // --- stage-clear overlay: soft dim + sub-line so the 区切り is unmistakable ---
      if(clearAnim>0){
        const a=clamp(clearAnim/30,0,1)*0.35;
        g.fillStyle="rgba(10,6,26,"+a+")";g.fillRect(0,0,api.W,api.H);
        const sub=clearWon?"おめでとう！ もういちど あそべるよ":"つぎの ステージへ！";
        const pop=1+Math.sin(t*0.3)*0.05;
        g.save();g.translate(api.W/2,api.H*0.56);g.scale(pop,pop);
        g.font="800 24px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.55)";g.strokeText(sub,0,0);
        g.shadowColor="#ffe27a";g.shadowBlur=14;g.fillStyle="#fff3c4";g.fillText(sub,0,0);
        g.shadowBlur=0;g.restore();g.textAlign="left";g.textBaseline="alphabetic";
      }
      // hint - cute rounded translucent panel with glow + outline
      const ht="オーブを おして つなげて、はなして ドカン！";
      g.font="800 19px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
      const hw=(g.measureText(ht)||{}).width||ht.length*11,hpx=22,hph=14;
      const hcx=api.W/2,hcy=api.H-28,bx=hcx-hw/2-hpx,by=hcy-hph,bw=hw+hpx*2,bh=hph*2,br=bh/2;
      const hb=1+Math.sin(t*0.06)*0.04;
      g.save();
      g.beginPath();
      g.moveTo(bx+br,by);g.arcTo(bx+bw,by,bx+bw,by+bh,br);g.arcTo(bx+bw,by+bh,bx,by+bh,br);
      g.arcTo(bx,by+bh,bx,by,br);g.arcTo(bx,by,bx+bw,by,br);g.closePath();
      g.fillStyle="rgba(40,30,80,.55)";g.shadowColor="rgba(120,180,255,"+(0.5*hb)+")";g.shadowBlur=14;g.fill();g.shadowBlur=0;
      g.lineWidth=2;g.strokeStyle="rgba(170,215,255,.7)";g.stroke();
      g.lineWidth=4;g.strokeStyle="rgba(20,12,45,.55)";g.strokeText(ht,hcx,hcy);
      g.fillStyle="#eaf4ff";g.fillText(ht,hcx,hcy);
      g.restore();
      g.textAlign="left";g.textBaseline="alphabetic";
    }
  };
  function drawOrb(o){
    const lit=o.conn;
    // ① にじいろオーブ: 体色が7色を巡回(どの色にも化けるワイルドカードの見た目)
    const dispCol=o.rainbow?COLORS[Math.floor(t*0.06+o.pulse*2)%COLORS.length]:o.color;
    const grow=1+(o.sq>0?o.sq:0);
    const pr=o.r*(1+Math.sin(o.pulse)*0.06)*(0.5+0.5*o.born)*grow;
    g.save();
    // outer glow (additive for soft bloom)
    g.globalCompositeOperation="lighter";
    const gl=g.createRadialGradient(o.x,o.y,pr*0.2,o.x,o.y,pr*2.1);
    gl.addColorStop(0,(lit?"rgba(255,255,255,.55)":"rgba(190,220,255,.22)"));
    gl.addColorStop(0.5,(lit?"rgba(200,235,255,.28)":"rgba(150,190,255,.10)"));
    gl.addColorStop(1,"rgba(0,0,0,0)");
    g.fillStyle=gl;g.beginPath();g.arc(o.x,o.y,pr*2.1,0,TAU);g.fill();
    g.globalCompositeOperation="source-over";
    // ※オーブ画像(orb.png)は生成が2回とも不良(台座/マゼンタ被り)だったので使わず、手描きのまま
    // body（⑦ 大玉は丸オーブの拡大コピーで終わらせず、ゴツゴツした岩肌の多角形にして「違う物」だと分かるようにする）
    const bg=g.createRadialGradient(o.x-pr*0.32,o.y-pr*0.34,Math.max(0,pr*0.15),o.x,o.y,Math.max(0,pr));
    bg.addColorStop(0,lit?"#ffffff":lightenC(dispCol));
    bg.addColorStop(0.55,dispCol);
    bg.addColorStop(1,darkenC(dispCol));
    g.fillStyle=bg;g.beginPath();
    if(o.big){
      const sides=9;
      for(let i=0;i<=sides;i++){
        const a=TAU/sides*i+o.spin*0.15;
        const rr=Math.max(0,pr*(0.82+0.22*Math.sin(i*2.7+o.pulse*0.3)));
        const x=o.x+Math.cos(a)*rr,y=o.y+Math.sin(a)*rr;
        if(i===0)g.moveTo(x,y);else g.lineTo(x,y);
      }
      g.closePath();
    }else{
      g.arc(o.x,o.y,pr,0,TAU);
    }
    g.fill();
    // にじいろオーブ: まわりを7色の光の弧が回る(激レアの合図)
    if(o.rainbow){g.save();g.globalCompositeOperation="lighter";g.lineWidth=Math.max(1.5,pr*0.12);
      for(let k=0;k<COLORS.length;k++){g.strokeStyle=COLORS[k];g.globalAlpha=0.6;
        const a0=o.spin*2+k*TAU/COLORS.length;g.beginPath();g.arc(o.x,o.y,pr*1.16,a0,a0+0.7);g.stroke();}
      g.restore();g.globalAlpha=1;}
    // inner rim light
    g.lineWidth=Math.max(1,pr*0.07);g.strokeStyle="rgba(255,255,255,"+(lit?0.5:0.45)+")";
    g.beginPath();g.arc(o.x,o.y,pr*0.92,0,TAU);g.stroke();
    // crescent shimmer (rotates)
    g.globalAlpha=0.35;g.strokeStyle="rgba(255,255,255,.9)";g.lineWidth=Math.max(1,pr*0.08);
    g.beginPath();g.arc(o.x,o.y,pr*0.7,o.spin,o.spin+1.1);g.stroke();g.globalAlpha=1;
    // electric core: a little lightning glyph + crackling micro-arcs so each orb reads as "electricity" before it is linked
    g.save();
    g.translate(o.x,o.y);
    if(!lit){
      // crackling micro-arcs orbiting the orb (additive) -> alive, electric feel even at rest
      g.globalCompositeOperation="lighter";
      const arcs=3;
      for(let a=0;a<arcs;a++){
        const base=o.spin*2.2+a*TAU/arcs+Math.sin(o.pulse*1.3+a)*0.4;
        const rr=pr*(0.46+0.18*Math.sin(o.pulse*2+a*2.1));
        g.strokeStyle="rgba(190,235,255,.7)";g.lineWidth=Math.max(1,pr*0.05);
        g.shadowColor="#bfe6ff";g.shadowBlur=pr*0.5;
        g.beginPath();
        for(let s=0;s<=5;s++){
          const ang=base+s*0.5;
          const jr=rr+(s%2?pr*0.1:-pr*0.07);
          const x=Math.cos(ang)*jr,y=Math.sin(ang)*jr;
          if(s===0)g.moveTo(x,y);else g.lineTo(x,y);
        }
        g.stroke();g.shadowBlur=0;
      }
      g.globalCompositeOperation="source-over";
    }
    // bolt glyph in the middle (a zig-zag): the universal "electricity" sign, brighter once linked
    const gs=pr*0.5,jab=pr*0.2;
    g.lineCap="round";g.lineJoin="round";
    g.shadowColor=lit?"#fff":"#ffe27a";g.shadowBlur=lit?pr*0.6:pr*0.45;
    g.strokeStyle=lit?"rgba(255,255,255,.95)":"rgba(255,238,150,.92)";
    g.lineWidth=Math.max(1.4,pr*0.13);
    g.beginPath();
    g.moveTo(jab*0.3,-gs);
    g.lineTo(-jab,-gs*0.1);
    g.lineTo(jab*0.5,gs*0.05);
    g.lineTo(-jab*0.3,gs);
    g.stroke();g.shadowBlur=0;
    g.restore();
    // primary highlight
    g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(o.x-pr*0.32,o.y-pr*0.34,pr*0.22,0,TAU);g.fill();
    g.fillStyle="rgba(255,255,255,.45)";g.beginPath();g.arc(o.x+pr*0.28,o.y+pr*0.3,pr*0.1,0,TAU);g.fill();
    g.restore();
  }
  // ⑦ けっしょう: 丸オーブとは違う多角形の的(壊れ方も見た目も別物にして「いろんな物を壊す」を厚くする)
  function drawCrystal(o){
    const lit=o.conn;
    const dispCol=o.color;
    const pr=Math.max(0,o.r*(1+Math.sin(o.pulse)*0.05)*(0.5+0.5*o.born));
    g.save();
    g.translate(o.x,o.y);g.rotate(o.spin*0.3);
    // outer glow
    g.globalCompositeOperation="lighter";
    const gl=g.createRadialGradient(0,0,Math.max(0,pr*0.2),0,0,Math.max(0,pr*2));
    gl.addColorStop(0,lit?"rgba(255,255,255,.5)":"rgba(210,240,255,.22)");
    gl.addColorStop(1,"rgba(0,0,0,0)");
    g.fillStyle=gl;g.beginPath();g.arc(0,0,Math.max(0,pr*2),0,TAU);g.fill();
    g.globalCompositeOperation="source-over";
    // hexagonal facet body(丸ではなく多角形=形の違う的)
    const sides=6;
    g.beginPath();
    for(let i=0;i<=sides;i++){
      const a=TAU/sides*i-Math.PI/2;
      const rr=pr*(i%2?0.62:1);
      const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
      if(i===0)g.moveTo(x,y);else g.lineTo(x,y);
    }
    g.closePath();
    const bg=g.createLinearGradient(-pr,-pr,pr,pr);
    bg.addColorStop(0,lit?"#ffffff":lightenC(dispCol));
    bg.addColorStop(0.55,dispCol);
    bg.addColorStop(1,darkenC(dispCol));
    g.fillStyle=bg;g.fill();
    g.lineWidth=Math.max(1,pr*0.08);g.strokeStyle="rgba(255,255,255,"+(lit?0.6:0.35)+")";g.stroke();
    // facet lines
    g.globalAlpha=0.4;g.strokeStyle="rgba(255,255,255,.8)";g.lineWidth=Math.max(1,pr*0.05);
    for(let i=0;i<3;i++){const a=TAU/3*i;g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a)*pr*0.8,Math.sin(a)*pr*0.8);g.stroke();}
    g.globalAlpha=1;
    // ひび: タップ/連結されると亀裂が入る(壊れる予告=丸オーブと違う手触り)
    if(o.dent>0){
      g.strokeStyle="rgba(255,255,255,.9)";g.lineWidth=Math.max(1,pr*0.09);
      g.shadowColor="#fff";g.shadowBlur=pr*0.3;
      g.beginPath();
      g.moveTo(-pr*0.5,-pr*0.3);g.lineTo(-pr*0.05,pr*0.05);g.lineTo(-pr*0.3,pr*0.5);
      g.moveTo(-pr*0.05,pr*0.05);g.lineTo(pr*0.45,-pr*0.15);
      g.stroke();g.shadowBlur=0;
    }
    g.restore();
  }
  // ⑦ ブロック: 丸オーブ・けっしょうとも違う「四角い木箱」の的(壊れ方も重力落下の角ばった破片で別物にする)
  function drawBlock(o){
    const lit=o.conn;
    const dispCol=o.color;
    const pr=Math.max(0,o.r*(1+Math.sin(o.pulse)*0.05)*(0.5+0.5*o.born));
    const half=Math.max(0,pr*0.86);
    g.save();
    g.translate(o.x,o.y);g.rotate(Math.sin(o.spin*0.3)*0.05);
    // outer glow
    g.globalCompositeOperation="lighter";
    const gl=g.createRadialGradient(0,0,Math.max(0,pr*0.2),0,0,Math.max(0,pr*1.9));
    gl.addColorStop(0,lit?"rgba(255,255,255,.5)":"rgba(255,225,180,.22)");
    gl.addColorStop(1,"rgba(0,0,0,0)");
    g.fillStyle=gl;g.beginPath();g.arc(0,0,Math.max(0,pr*1.9),0,TAU);g.fill();
    g.globalCompositeOperation="source-over";
    // 四角い木箱ボディ(丸ではなく角ばった輪郭=形の違う的)
    const bg=g.createLinearGradient(-half,-half,half,half);
    bg.addColorStop(0,lit?"#ffffff":lightenC(dispCol));
    bg.addColorStop(0.55,dispCol);
    bg.addColorStop(1,darkenC(dispCol));
    g.fillStyle=bg;g.beginPath();
    if(g.roundRect)g.roundRect(-half,-half,half*2,half*2,Math.max(0,half*0.18));else g.rect(-half,-half,half*2,half*2);
    g.fill();
    g.lineWidth=Math.max(1,pr*0.08);g.strokeStyle="rgba(255,255,255,"+(lit?0.6:0.35)+")";g.stroke();
    // 板の継ぎ目 + 斜めの補強材(木箱らしさ)
    g.globalAlpha=0.4;g.strokeStyle="rgba(0,0,0,.35)";g.lineWidth=Math.max(1,pr*0.06);
    g.beginPath();
    g.moveTo(-half,-half*0.33);g.lineTo(half,-half*0.33);
    g.moveTo(-half,half*0.33);g.lineTo(half,half*0.33);
    g.moveTo(-half*0.8,-half*0.8);g.lineTo(half*0.8,half*0.8);
    g.moveTo(half*0.8,-half*0.8);g.lineTo(-half*0.8,half*0.8);
    g.stroke();
    g.globalAlpha=1;
    g.restore();
  }
  // ⑦ ふうせん: 丸オーブ/けっしょう/ブロックのどれとも違う「生き物っぽい、ぷにっとした」的。
  // 光る抽象エネルギー玉の仲間から一歩外へ出す狙いで、体型(縦長の卵形+むすび目+顔)を丸オーブと明確に変える。
  function drawBalloon(o){
    const lit=o.conn;
    const dispCol=o.color;
    const pr=Math.max(0,o.r*(1+Math.sin(o.pulse)*0.05)*(0.5+0.5*o.born));
    const rw=Math.max(0,pr*0.86),rh=Math.max(0,pr*1.12);
    g.save();
    g.translate(o.x,o.y);g.rotate(Math.sin(o.pulse*0.5)*0.06);
    // outer glow
    g.globalCompositeOperation="lighter";
    const gl=g.createRadialGradient(0,0,Math.max(0,pr*0.2),0,0,Math.max(0,pr*2));
    gl.addColorStop(0,lit?"rgba(255,255,255,.5)":"rgba(255,210,240,.22)");
    gl.addColorStop(1,"rgba(0,0,0,0)");
    g.fillStyle=gl;g.beginPath();g.arc(0,0,Math.max(0,pr*2),0,TAU);g.fill();
    g.globalCompositeOperation="source-over";
    // 卵形ボディ(丸オーブとは輪郭がはっきり違う=別の生き物に見える)
    const bg=g.createRadialGradient(-rw*0.3,-rh*0.35,Math.max(0,pr*0.12),0,0,Math.max(0,Math.max(rw,rh)));
    bg.addColorStop(0,lit?"#ffffff":lightenC(dispCol));
    bg.addColorStop(0.55,dispCol);
    bg.addColorStop(1,darkenC(dispCol));
    g.fillStyle=bg;g.beginPath();g.ellipse(0,0,rw,rh,0,0,TAU);g.fill();
    g.lineWidth=Math.max(1,pr*0.07);g.strokeStyle="rgba(255,255,255,"+(lit?0.6:0.4)+")";g.stroke();
    // むすび目(下)としっぽ(ふうせんらしさ・生き物らしさの目印)
    g.fillStyle=darkenC(dispCol);g.beginPath();
    g.moveTo(-rw*0.16,rh*0.94);g.lineTo(rw*0.16,rh*0.94);g.lineTo(0,rh*1.18);g.closePath();g.fill();
    // 顔(丸オーブには無い目/口=「壊す対象そのものが変わる」手触り)
    g.fillStyle="rgba(20,10,25,.8)";
    g.beginPath();g.arc(-rw*0.28,-rh*0.05,Math.max(0,pr*0.09),0,TAU);g.fill();
    g.beginPath();g.arc(rw*0.28,-rh*0.05,Math.max(0,pr*0.09),0,TAU);g.fill();
    g.lineWidth=Math.max(1,pr*0.06);g.strokeStyle="rgba(20,10,25,.7)";g.beginPath();
    g.arc(0,rh*0.12,Math.max(0,pr*0.22),0.15*Math.PI,0.85*Math.PI);g.stroke();
    // primary highlight
    g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(-rw*0.32,-rh*0.4,Math.max(0,pr*0.16),0,TAU);g.fill();
    g.restore();
  }
  function drawBolt(a,b,seed){
    const segs=8,dx=(b.x-a.x)/segs,dy=(b.y-a.y)/segs;
    // perpendicular unit vector so the wander pushes sideways (a real "running" arc)
    const len=Math.max(1,Math.hypot(b.x-a.x,b.y-a.y));
    const nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;
    g.lineCap="round";g.lineJoin="round";
    // precompute the smooth, time-flowing point list once; reuse for all passes
    const pts=[];
    for(let i=0;i<=segs;i++){
      const f=i/segs;
      // envelope: zero at both ends, fat in the middle
      const env=Math.sin(f*Math.PI);
      // travelling waves -> the kink pattern slides along the bolt over time
      const w=(Math.sin(f*9-t*0.34+seed)*1.0+Math.sin(f*17+t*0.22+seed*1.7)*0.5)*env;
      const off=w*(8+len*0.05);
      pts.push([a.x+dx*i+nx*off,a.y+dy*i+ny*off]);
    }
    // 3 passes: wide soft halo, mid glow, bright core
    for(let pass=0;pass<3;pass++){
      const jit=pass===0?2:pass===1?3.5:1.2;
      g.beginPath();g.moveTo(pts[0][0],pts[0][1]);
      for(let i=1;i<pts.length;i++){
        const p=pts[i],spread=Math.sin(i/segs*Math.PI);
        g.lineTo(p[0]+rnd(-jit,jit)*spread,p[1]+rnd(-jit,jit)*spread);
      }
      if(pass===0){g.strokeStyle="rgba(90,160,255,.45)";g.lineWidth=12;g.shadowColor="rgba(120,180,255,.9)";g.shadowBlur=16;}
      else if(pass===1){g.strokeStyle="rgba(150,210,255,.8)";g.lineWidth=5;g.shadowBlur=8;}
      else{g.strokeStyle="rgba(255,255,255,.95)";g.lineWidth=2.2;g.shadowBlur=0;}
      g.stroke();
    }
    g.shadowBlur=0;
    // travelling energy pulse: a bright bead that races from a -> b along the arc
    const pf=((t*0.05+seed*0.13)%1);
    const seg=Math.min(segs-1,Math.floor(pf*segs)),frac=pf*segs-seg;
    const pa=pts[seg],pb=pts[seg+1];
    const px=pa[0]+(pb[0]-pa[0])*frac,py=pa[1]+(pb[1]-pa[1])*frac;
    g.fillStyle="rgba(255,255,255,.95)";g.shadowColor="#bfe6ff";g.shadowBlur=18;
    g.beginPath();g.arc(px,py,3.2,0,TAU);g.fill();g.shadowBlur=0;
    // node glints at endpoints
    g.fillStyle="rgba(255,255,255,.85)";
    g.beginPath();g.arc(b.x,b.y,3,0,TAU);g.fill();
  }
  function lightenC(hex){const c=parseInt(hex.slice(1),16);const r=clamp(((c>>16)&255)+70,0,255),gg=clamp(((c>>8)&255)+70,0,255),b=clamp((c&255)+70,0,255);return "rgb("+r+","+gg+","+b+")";}
  function darkenC(hex){const c=parseInt(hex.slice(1),16);const r=clamp(((c>>16)&255)-55,0,255),gg=clamp(((c>>8)&255)-55,0,255),b=clamp((c&255)-55,0,255);return "rgb("+r+","+gg+","+b+")";}
}
Engine.register("chain", buildChain);
