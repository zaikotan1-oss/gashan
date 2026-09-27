function buildObsidian(api){
  const g=api.g;
  // 画像アセット(無ければ従来の手描きにフォールバック)。ふつうの いわ は色バリエーション(ラッキー色)があるので手描きのまま。
  api.preload(["bg.jpg","spirit.png","gold.png","hardrock.png"]);
  let blocks=[],shards=[],sparks=[],rings=[],embers=[],floats=[],lavaCracks=[];
  let S,cols,rows,bx,by,tsec=0,count=0,combo=0,comboT=0,flash=0,flashHue="#ff6a1a";
  // stage progression: clear all blocks -> "ステージ クリア!" -> harder endless
  let stage=1,clearBanner=0,clearTxt="",celebrate=0,clearing=false,teaser="";
  let face=0; // little volcano-spirit reaction
  // fever time: gauge fills as blocks break -> 9s of "everything 1-hit + score x2"
  let fever=0,feverGauge=0,feverBann=0,hitCd=0;
  const FEVER_LEN=560; // frames (~9.3s)
  // 火山ガラスの宝石トーン(暗いが色みがある=②ラッキー色を見分けられる)
  const COLORS=["#3a2350","#20305a","#1f3d33","#4a2130"]; // むらさき/あお/みどり/あか
  const COLNAME={"#3a2350":"むらさき","#20305a":"あお","#1f3d33":"みどり","#4a2130":"あか"};
  const RAINBOW=["#ff5b5b","#ffd23f","#4db8ff","#7be08a","#ff7bd0","#b58bff"];
  // ---- 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ----
  // ② きょうのラッキー色: 秘密の1色。その色の いわ を こわすと +1 と 頭上に星のキラッ(気づけるヒント)
  let luckyColor=pick(COLORS),luckySeen=false,luckyHintT=2.6,luckyMsgT=0;
  // ① にじいろいし: ステージ2以降 数%で1個だけ隠れる激レア。こわすと虹の大演出＋大量得点
  let rbMsgT=0,rbSeen=false,rbHintT=0;
  // ③ パーフェクト: そのステージを コンボを切らさず 全消し = ボーナス＋祝福
  let comboKept=true;
  // ④ ひみつ: すみっこの ひのこ せいれい を タップすると ごほうび(減点なし)
  let spiritX=0,spiritY=0,spiritR=0,spiritJoy=0;
  // 軸3(歯ごたえ)の安全弁: 連鎖を弱めた代わりに、盤面に迷子の1〜2個だけが残って
  // 何十秒も見つからない…という手持ち無沙汰を防ぐ。しばらく得点が動かず、
  // 残りがわずかなら まとめて回収してあげる(叱らない・詰まらせない)。
  let sinceHit=0,lastCountSeen=0;
  const STRAGGLER_MAX=9,STRAGGLER_WAIT=90;   // のこりN個以下・約1.5秒 無得点で自動回収
  const STRAGGLER_HARD_WAIT=600;             // のこり数に関わらず、約10秒 無得点なら強制回収(詰み防止)
  const TEASERS=["つぎは ゴールドいし が かくれてる！","つぎは かたい くろいわ が ふえる！",
    "つぎは おおきな れんさ を ねらえ！","つぎは フィーバー を だそう！"];
  function layout(){
    S=clamp(Math.floor(api.W/9),34,58);
    // 軸3(歯ごたえ)対策: 連鎖を弱めた分、盤面の左右はしが「よくねらうところ」から
    // 外れすぎない幅に収める(こうしないと はしっこ だけ延々と残って手持ち無沙汰になる)。
    cols=clamp(Math.floor((api.W*0.66)/S),5,8);
    rows=clamp(Math.floor((api.H*0.5)/S),4,8);
    bx=Math.round((api.W-cols*S)/2);
    by=Math.round(api.H*0.26);
    blocks.forEach(b=>{b.x=bx+b.col*S;b.y=by+b.row*S;});
    // ④ せいれい の当たり判定(描画位置と一致・ブロック帯より下＝重ならない・寛容に大きめ)
    spiritX=clamp(api.W*0.12,52,72);spiritY=api.H*0.84;spiritR=clamp(S*0.5,20,30)*1.7;
  }
  layout();
  function buildField(){
    blocks=[];
    // tougher obsidian (2-tap) chance grows with stage; more rows too
    // 7〜8歳向け: 2面目から列が増え、かたい くろいわ も少し多め(2〜3割増し)
    // 軸3対策: 段が進むほど盤面が下に伸びすぎると、ランダムタップが届く帯(画面中央寄り)から
    // 下のほうがはみ出て「見つからない いわ」が長く残ってしまう。段数での縦の増え方は+1までに抑える。
    const r=clamp(rows+(stage>=5?1:0),4,rows+1);
    // 軸3(歯ごたえ)第2ラウンド: stage2以降は既に減速が効いているが、最初の1面だけまだ易しすぎる
    // (seed7実測: stage1のこり40→0がstage2のこり40→9より明らかに速い)。初期値を0.08→0.15へ底上げ。
    const hardChance=clamp(0.15+0.06*(stage-1),0.15,0.45);
    let goldPlaced=0,rbPlaced=0;
    for(let row=0;row<r;row++)for(let col=0;col<cols;col++){
      const hard=Math.random()<hardChance;
      // rare gold ore: shiny 1-hit block worth big points + rainbow burst
      const gold=!hard&&goldPlaced<3&&Math.random()<0.07;
      if(gold)goldPlaced++;
      // ① にじいろいし: 1ステージに最大1個だけ、数%で隠れる激レア(こわすと大当たり)
      const rb=!hard&&!gold&&rbPlaced<1&&stage>=2&&Math.random()<0.02;
      if(rb)rbPlaced++;
      // 軸7(バラエティ): ふつうの いわ の一部を「まるい・大きさ違い」に混ぜる。
      // 見た目と壊れ方の違い(小さい石ころ=一発/大きい丸岩=2発)を出す。当たり判定はセルのまま。
      let round=false,big=false;
      if(!hard&&!gold&&!rb){
        // 軸7(バラエティ)第2ラウンド: 旧しきい値だと約6割が色違いの四角のままだった。
        // 丸い石ころ(小/大)の出現率を引き上げ、四角と丸がほぼ半々になるようにする。
        const sr=Math.random();
        if(sr<0.28)round=true;             // 小さい まるい石ころ(サクッと壊れる)
        else if(sr<0.42){round=true;big=true;} // 大きい まるい岩(2回たたく)
      }
      blocks.push({col,row,x:bx+col*S,y:by+row*S,
        color:gold?"#b8862a":(rb?"#ff5b5b":pick(COLORS)),hp:hard?2:(big?2:1),hard,gold,rainbow:rb,round,big,glow:0,wob:rnd(0,TAU)});
    }
    // always hide at least one gold ore so every stage has a treasure moment
    if(!goldPlaced&&blocks.length){const gb=pick(blocks.filter(b=>!b.rainbow))||blocks[0];
      gb.gold=true;gb.hard=false;gb.hp=1;gb.color="#b8862a";gb.round=false;gb.big=false;}
    comboKept=true;                    // ③ このステージのパーフェクト判定を初期化
    // ① 初回だけ「にじいろいしが かくれてる！」の一言。
    // ⑥予防的: ② ラッキー色の一言(luckyHintT)と表示タイミングが重ならないよう、出ていたら少しずらす。
    if(rbPlaced&&!rbSeen)rbHintT=luckyHintT>0?luckyHintT+0.3:2.4;
  }
  buildField();
  function pushEmber(){embers.push({x:rnd(0,api.W),y:api.H+10,vy:-rnd(0.4,1.4),
    ph:rnd(0,TAU),amp:rnd(6,22),s:rnd(1.2,3.2),life:1,col:pick(["#ff8a2a","#ffce4a","#ff5a2a","#ffae3a"])});}
  function blockAt(c,r){return blocks.find(b=>b.col===c&&b.row===r&&!b._dead);}
  function shatter(b,big){
    // debris chunks (capped so huge fever cascades keep 60fps)
    if(shards.length<130)for(let i=rint(5,9);i>0;i--)shards.push({x:b.x+rnd(4,S-4),y:b.y+rnd(4,S-4),
      vx:rnd(-6,6)+(big?rnd(-2,2):0),vy:rnd(-10,-2),s:rnd(S*0.18,S*0.4),
      rot:rnd(0,TAU),vr:rnd(-0.4,0.4),life:1,decay:rnd(0.006,0.012),
      col:(b.gold||b.rainbow)?pick(RAINBOW):b.color});
    // glowing sparks
    if(sparks.length<130)for(let i=rint(6,10);i>0;i--){const a=rnd(0,TAU),v=rnd(3,9);
      sparks.push({x:b.x+S/2,y:b.y+S/2,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,
        life:1,decay:rnd(0.02,0.04),s:rnd(1.5,3.5),
        col:(b.gold||b.rainbow)?pick(RAINBOW):pick(["#ff8a2a","#ffce4a","#ff5a2a"])});}
    if(rings.length<18)rings.push({x:b.x+S/2,y:b.y+S/2,r:S*0.4,life:1,col:b.rainbow?"#ff7bd0":(b.gold?"#ffd23f":"#ff7a2a")});
  }
  // gold ore smashed: rainbow fanfare + bonus points shout
  function goldBurst(b){
    const px=b.x+S/2,py=b.y+S/2;
    floats.push({x:px,y:py-26,txt:"ゴールド！",life:1,vy:-0.9,col:"#ffd23f",size:34});
    floats.push({x:px,y:py+6,txt:"+"+(fever>0?12:6),life:1,vy:-0.9,col:"#fff6c8",size:26});
    rings.push({x:px,y:py,r:S*0.6,life:1,col:"#ffd23f"});
    flash=Math.min(1,flash+0.5);flashHue="#ffd23f";
    api.shake(10);
    [0,4,7,12].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.14,"triangle",0.22),i*70));
    if(hitCd<=0){api.hitStop(4);hitCd=34;}
  }
  // ① にじいろいし 撃破: 虹のファンファーレ＋大量得点(白飛びしないよう flash は控えめ＋速い減衰)
  function rainbowBurst(b){
    const px=b.x+S/2,py=b.y+S/2;
    rbMsgT=1.4;rbSeen=true;
    floats.push({x:px,y:py-28,txt:"にじいろ！",life:1,vy:-0.9,col:"#ff7bd0",size:36});
    floats.push({x:px,y:py+8,txt:"+"+(fever>0?40:20),life:1,vy:-0.9,col:"#fff",size:28});
    for(let k=0;k<RAINBOW.length&&rings.length<18;k++)rings.push({x:px,y:py,r:S*(0.4+k*0.14),life:1,col:RAINBOW[k]});
    if(sparks.length<150)for(let i=0;i<24;i++){const a=rnd(0,TAU),v=rnd(3,10);
      sparks.push({x:px,y:py,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,life:1,decay:rnd(0.018,0.03),
        s:rnd(2,4),col:RAINBOW[i%RAINBOW.length]});}
    flash=Math.min(1,flash+0.4);flashHue="#ff7bd0";
    api.shake(16);api.boom(0.6);
    api.slide(523,1568,0.5,0.3,"triangle");
    [0,4,7,12,16].forEach((semi,i)=>setTimeout(()=>api.tone(659*Math.pow(2,semi/12),0.14,"triangle",0.2),i*70));
    if(hitCd<=0){api.hitStop(5);hitCd=34;}
  }
  // ② ラッキー色 命中: 頭上に小さな星のキラッ(気づけるヒント)＋小さな祝福音
  function luckySpark(b){
    const px=b.x+S/2,py=b.y;
    for(let i=0;i<5;i++){const a=-TAU*0.25+rnd(-0.6,0.6),v=rnd(1.5,3.5);
      if(sparks.length<150)sparks.push({x:px,y:py,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,
        life:1,decay:rnd(0.02,0.035),s:rnd(1.6,3),col:i%2?"#fff6c8":luckyColor});}
    api.tone(1046,0.12,"triangle",0.12);api.tone(1568,0.14,"triangle",0.08);
    if(!luckySeen){luckySeen=true;luckyMsgT=1.6;}
  }
  // ④ せいれい ごほうび: にっこり＋コインのきらめき(スコアは動かさない=純ごほうび)
  function spiritReward(){
    spiritJoy=1;face=1;
    api.tone(1318,0.1,"triangle",0.1);api.tone(1760,0.12,"triangle",0.07);
    for(let i=0;i<8;i++){const a=-TAU*0.25+rnd(-0.9,0.9),v=rnd(2,5);
      if(sparks.length<150)sparks.push({x:spiritX,y:spiritY-spiritR*0.3,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,
        life:1,decay:rnd(0.015,0.03),s:rnd(2,3.5),col:pick(["#ffd24a","#fff6c8","#ff9a3a"])});}
  }
  function addGauge(v){feverGauge=Math.min(1,feverGauge+v);if(feverGauge>=1)startFever();}
  function startFever(){
    fever=FEVER_LEN;feverGauge=0;feverBann=2;
    flash=1;flashHue="#ffd23f";
    api.boom(0.7);api.shake(20);
    api.slide(392,1568,0.6,0.35,"sawtooth");
    setTimeout(()=>api.tone(1046,0.18,"triangle",0.3),160);
    setTimeout(()=>api.tone(1318,0.28,"triangle",0.3),320);
  }
  function neighbors(b){
    const out=[];
    const at=(c,r)=>{const n=blockAt(c,r);if(n)out.push(n);};
    at(b.col-1,b.row);at(b.col+1,b.row);at(b.col,b.row-1);at(b.col,b.row+1);
    return out;
  }
  // 軸3(歯ごたえ): 連鎖はここで頭打ちにする。直撃+最大2ホップ先までしか伝わらないので
  // 盤面が隙間なく埋まっていても1タップで全消しにならず、複数回タップして狙う遊びに戻る。
  const MAX_CHAIN=2;      // 直撃(depth0)から数えて何ホップ先まで連鎖できるか
  // 軸3(歯ごたえ)第2ラウンド: 0.5だと直撃+2ホップでも盤面が密なステージ1では連打だけで
  // combo x5・全消しまで届いてしまう(seed7実測)。0.3に下げて「連鎖はたまに起きる」程度に弱め、
  // firstScoreSec/maxQuietSec はほぼ変えずに「連打が伸びすぎる」だけを効かせる。
  const CHAIN_PROB=0.3;   // 各ホップが実際に伝わる確率(毎回コイン投げで途中停止しやすくする)
  // tap a block -> break it, then lava cracks spread to adjacent and chain-collapse
  function breakBlock(b,depth){
    if(b._dead)return;
    if((b.hard||b.big)&&b.hp>1&&fever<=0){ // fever: everything breaks in 1 hit
      b.hp--;b.hard=false;b.glow=1;
      api.noise(0.08,0.2,2200,"highpass");api.tone(180,0.07,"square",0.08);api.shake(4);
      flash=Math.min(1,flash+0.16);
      lavaCracks.push({x:b.x+S/2,y:b.y+S/2,life:1});
      return;
    }
    b._dead=true;
    shatter(b,depth>0);
    // ① にじいろ=20点 / ② ラッキー色=+1 / それ以外は1点。フィーバー中はスコア2倍。
    const isLucky=!b.gold&&!b.rainbow&&b.color===luckyColor;
    let base=b.rainbow?20:(b.gold?6:1);
    if(isLucky)base+=1;
    count+=base*(fever>0?2:1);api.setScore(count);
    if(b.gold)goldBurst(b);
    if(b.rainbow)rainbowBurst(b);
    if(isLucky)luckySpark(b);
    if(fever<=0)addGauge(b.rainbow?0.4:(b.gold?0.14:0.018)); // 7〜8歳向け: ゲージは少しゆっくり溜まる
    // crack tendril toward each neighbor that will fall
    const nb=neighbors(b);
    // sound scales gently with chain depth
    const f=clamp(140+depth*30,140,420);
    api.slide(f,48,0.2,0.32,"sawtooth");api.noise(0.14,0.24,900,"lowpass");
    flash=Math.min(1,flash+0.22);
    // chain to neighbors with a tiny delay so the collapse "ripples"
    for(const n of nb){
      if(n._dead)continue;
      if(depth>=MAX_CHAIN)continue;        // 直撃(0)+最大2ホップ先までで頭打ち
      if(Math.random()>=CHAIN_PROB)continue; // 毎ホップ確率で自然に途切れさせる
      lavaCracks.push({x:b.x+S/2,y:b.y+S/2,tx:n.x+S/2,ty:n.y+S/2,life:1});
      const nn=n,nd=depth+1;
      // limit recursion depth via timeout chain feel but keep synchronous-safe
      scheduleBreak(nn,nd);
    }
  }
  // staggered chain so it cascades visibly without deep recursion blowup
  let pending=[];
  function scheduleBreak(b,depth){
    pending.push({b,depth,t:clamp(2+depth*1.2,2,10)});
  }
  function tapAt(px,py){
    const c=Math.floor((px-bx)/S), r=Math.floor((py-by)/S);
    const b=blockAt(c,r);
    if(b){
      face=1;combo++;comboT=1;
      api.shake(6);api.boom(fever>0?0.5:0.4);
      // hitStop only on combo milestones, with a cooldown (keeps flow snappy)
      if(hitCd<=0&&combo>=5&&combo%5===0){api.hitStop(3);hitCd=34;}
      breakBlock(b,0);
      flashHue="#ff7a2a";
      if(combo>1)floats.push({x:px,y:py-20,txt:"x"+combo,life:1,vy:-1.1,
        col:combo>=8?"#ff2bff":combo>=5?"#ff5a2a":"#ffce4a",size:combo>=5?40:30});
      checkClear();
    }else{
      // ④ ひみつ: ブロックに当たらなかったタップが すみっこの せいれい に届いたら ごほうび(減点なし)
      if(spiritR>0&&Math.hypot(px-spiritX,py-spiritY)<spiritR){spiritReward();return;}
      api.tone(160,0.06,"triangle",0.06);
    }
  }
  function checkClear(){
    // count remaining (not dead, not pending)
    const alive=blocks.filter(b=>!b._dead).length;
    if(alive>0||clearing)return;
    clearing=true;
    // ③ パーフェクト: コンボを切らさず全消しできたら ボーナス＋星シャワー(気づくと得する)
    const perfect=comboKept;
    if(perfect){const pb=(fever>0?10:5);count+=pb;api.setScore(count);
      floats.push({x:api.W/2,y:api.H*0.5,txt:"パーフェクト！ ＋"+pb,life:1,vy:-0.7,col:"#7be08a",size:34});
      for(let i=0;i<14;i++){const a=rnd(0,TAU),v=rnd(3,7);
        if(sparks.length<150)sparks.push({x:api.W/2,y:api.H*0.45,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,
          life:1,decay:rnd(0.015,0.03),s:rnd(2,4),col:pick(["#7be08a","#ffd23f","#5ad1ff"])});}
      api.tone(1318,0.14,"triangle",0.1);api.tone(1976,0.16,"triangle",0.07);}
    stage++;
    teaser=pick(TEASERS); // next-stage sneak peek shown in the banner
    celebrate=1.8;clearBanner=1.8;clearTxt=perfect?"パーフェクト クリア!":"ステージ クリア!";
    flash=1;flashHue="#ffce4a";
    api.boom(0.6);api.shake(20);
    api.slide(523,1046,0.5,0.4,"triangle");
    setTimeout(()=>{api.tone(784,0.18,"triangle",0.3);},120);
    setTimeout(()=>{api.tone(1046,0.3,"triangle",0.3);},280);
    setTimeout(()=>{buildField();clearing=false;},520);
  }
  // 軸3の安全弁: のこりが数個だけになって長く得点が動かないとき、まとめてこわして
  // 「迷子を延々さがす」状態を終わらせる(狙って壊す本来の遊びは崩さない=普段は発火しない)。
  function sweepStragglers(){
    for(const rb of blocks){if(!rb._dead)breakBlock(rb,0);}
    checkClear();
  }
  return{
    resize:layout,
    input(px,py,type){
      if(type!=="down")return;
      if(clearing)return;
      tapAt(px,py);
    },
    frame(dt,now){
      tsec+=0.016*dt;
      // 軸3の安全弁: 得点が動いたかどうかを見て、動いていなければ無得点タイマーを進める
      if(count!==lastCountSeen){lastCountSeen=count;sinceHit=0;}else{sinceHit+=dt;}
      if(!clearing){
        const aliveSweep=blocks.filter(b=>!b._dead).length;
        // ふだんは「のこりわずか」だけを対象に早めに回収。
        // それでも(たとえば盤面のはしっこに いわ が固まって連鎖が届かない等で)長く得点が
        // 動かない場合は、のこり数に関係なく回収して「詰み」を必ず解消する(絶対に止まらせない)。
        if(aliveSweep>0&&((aliveSweep<=STRAGGLER_MAX&&sinceHit>=STRAGGLER_WAIT)||sinceHit>=STRAGGLER_HARD_WAIT))sweepStragglers();
      }
      if(face>0)face=Math.max(0,face-0.05*dt);
      if(celebrate>0)celebrate=Math.max(0,celebrate-0.02*dt);
      if(hitCd>0)hitCd-=dt;
      if(spiritJoy>0)spiritJoy=Math.max(0,spiritJoy-0.03*dt);
      if(luckyHintT>0)luckyHintT=Math.max(0,luckyHintT-0.016*dt);
      if(luckyMsgT>0)luckyMsgT=Math.max(0,luckyMsgT-0.016*dt);
      if(rbHintT>0)rbHintT=Math.max(0,rbHintT-0.016*dt);
      if(rbMsgT>0)rbMsgT=Math.max(0,rbMsgT-0.016*dt);
      if(feverBann>0)feverBann=Math.max(0,feverBann-0.016*dt);
      if(fever>0){fever-=dt;
        if(fever<=0){fever=0;
          api.slide(1046,392,0.4,0.25,"triangle");
          floats.push({x:api.W/2,y:api.H*0.5,txt:"フィーバー おわり！",life:1,vy:-0.6,col:"#ffe6c8",size:24});}}
      // ---- background: volcanic dusk sky -> lava ----
      // 画像背景があればそれを使い、絵と喧嘩する平坦な手描き(グラデ・火山シルエット・火口の光)はスキップ
      let imgBg=false;
      if(api.drawCover("bg.jpg")){imgBg=true;
        // ブロック帯の後ろだけ ほんのり暗くして、くらい いわ が絵に埋もれないようにする
        const fr=Math.max(0,api.W*0.75);
        const fv=g.createRadialGradient(api.W/2,by+rows*S*0.5,0,api.W/2,by+rows*S*0.5,fr);
        fv.addColorStop(0,"rgba(20,6,12,.34)");fv.addColorStop(0.6,"rgba(20,6,12,.14)");fv.addColorStop(1,"rgba(20,6,12,0)");
        g.fillStyle=fv;g.fillRect(0,0,api.W,api.H);
      } else {
      let grd=g.createLinearGradient(0,0,0,api.H);
      grd.addColorStop(0,"#1a0a16");grd.addColorStop(0.3,"#3a1020");
      grd.addColorStop(0.58,"#7a2418");grd.addColorStop(0.8,"#c4451a");grd.addColorStop(1,"#ff7a1a");
      g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      // hazy heat glow low on screen
      const hg=g.createRadialGradient(api.W/2,api.H*1.05,0,api.W/2,api.H*1.05,api.W*0.8);
      hg.addColorStop(0,"rgba(255,170,60,.5)");hg.addColorStop(0.5,"rgba(255,110,30,.18)");hg.addColorStop(1,"rgba(255,110,30,0)");
      g.fillStyle=hg;g.fillRect(0,0,api.W,api.H);
      // distant volcano silhouettes
      g.fillStyle="rgba(20,8,14,.6)";
      g.beginPath();g.moveTo(0,api.H*0.62);
      g.lineTo(api.W*0.22,api.H*0.40);g.lineTo(api.W*0.34,api.H*0.46);
      g.lineTo(api.W*0.52,api.H*0.34);g.lineTo(api.W*0.7,api.H*0.48);
      g.lineTo(api.W,api.H*0.42);g.lineTo(api.W,api.H);g.lineTo(0,api.H);g.closePath();g.fill();
      // glowing crater on the tallest peak
      g.save();g.globalCompositeOperation="lighter";
      const cx=api.W*0.52,cy=api.H*0.34;
      const cg=g.createRadialGradient(cx,cy,0,cx,cy,S*1.4);
      const cp=0.6+0.4*Math.sin(tsec*1.5);
      cg.addColorStop(0,"rgba(255,210,90,"+(0.8*cp)+")");cg.addColorStop(0.5,"rgba(255,120,30,"+(0.3*cp)+")");cg.addColorStop(1,"rgba(255,120,30,0)");
      g.fillStyle=cg;g.beginPath();g.arc(cx,cy,S*1.4,0,TAU);g.fill();
      g.restore();
      }
      // fever: rotating rainbow rays + golden wash transform the whole sky
      if(fever>0){
        const fa=clamp((FEVER_LEN-fever)/30,0,1)*clamp(fever/60,0,1);
        g.save();g.globalCompositeOperation="lighter";
        g.translate(api.W/2,api.H*0.32);g.rotate(tsec*0.5);
        g.globalAlpha=0.14*fa;
        for(let i=0;i<12;i++){g.rotate(TAU/12);g.fillStyle=RAINBOW[i%RAINBOW.length];
          g.beginPath();g.moveTo(0,0);g.lineTo(api.W,-S*0.5);g.lineTo(api.W,S*0.5);g.closePath();g.fill();}
        g.restore();
        g.save();g.globalCompositeOperation="lighter";
        const fw2=g.createRadialGradient(api.W/2,api.H*0.4,0,api.W/2,api.H*0.4,api.W*0.75);
        fw2.addColorStop(0,"rgba(255,220,90,"+(0.28*fa)+")");fw2.addColorStop(1,"rgba(255,220,90,0)");
        g.fillStyle=fw2;g.fillRect(0,0,api.W,api.H);g.restore();
      }
      // rising embers (rainbow-tinted during fever)
      if(embers.length<40&&Math.random()<(fever>0?0.85:0.5)){pushEmber();
        if(fever>0)embers[embers.length-1].col=pick(RAINBOW);}
      g.save();g.globalCompositeOperation="lighter";
      for(const e of embers){e.y+=e.vy*dt;e.ph+=0.04*dt;
        const ex=e.x+Math.sin(e.ph)*e.amp;
        const a=clamp(e.y/api.H,0,1);
        g.globalAlpha=a*0.8;g.fillStyle=e.col;g.shadowBlur=8;g.shadowColor=e.col;
        g.beginPath();g.arc(ex,e.y,e.s,0,TAU);g.fill();}
      g.shadowBlur=0;g.globalAlpha=1;g.restore();
      embers=embers.filter(e=>e.y>-20);
      // heat shimmer band (subtle wavy overlay near base) ※画像背景のときは絵の地面を活かして描かない
      if(!imgBg){
      g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.06;
      g.fillStyle="#ffae3a";
      for(let x=0;x<api.W;x+=30){const yy=api.H*0.82+Math.sin(x*0.05+tsec*2)*6;
        g.fillRect(x,yy,30,api.H-yy);}
      g.globalAlpha=1;g.restore();
      }
      // ---- process pending chain collapses ----
      for(const p of pending){p.t-=dt;}
      const ready=pending.filter(p=>p.t<=0);
      pending=pending.filter(p=>p.t>0);
      for(const p of ready){if(!p.b._dead)breakBlock(p.b,p.depth);}
      if(ready.length)checkClear();
      // ---- shockwave rings ----
      g.save();g.globalCompositeOperation="lighter";
      for(const rg of rings){rg.r+=(S*2.4-rg.r)*0.18*dt;rg.life-=0.05*dt;
        const rl=Math.max(0,rg.life);g.globalAlpha=rl*0.7;g.lineWidth=Math.max(1,5*rg.life);
        g.strokeStyle=rg.col;g.shadowBlur=14*rl;g.shadowColor=rg.col;
        g.beginPath();g.arc(rg.x,rg.y,rg.r,0,TAU);g.stroke();}
      g.shadowBlur=0;g.globalAlpha=1;g.restore();
      rings=rings.filter(rg=>rg.life>0);
      // ---- lava cracks (glowing tendrils) ----
      g.save();g.globalCompositeOperation="lighter";
      for(const lc of lavaCracks){lc.life-=0.06*dt;
        const a=Math.max(0,lc.life);g.globalAlpha=a;
        g.strokeStyle="#ff8a2a";g.lineWidth=2.5;g.lineCap="round";
        g.shadowBlur=10*a;g.shadowColor="#ff5a2a";
        if(lc.tx!==undefined){
          g.beginPath();g.moveTo(lc.x,lc.y);
          const mx=(lc.x+lc.tx)/2+rnd(-4,4),my=(lc.y+lc.ty)/2+rnd(-4,4);
          g.quadraticCurveTo(mx,my,lc.tx,lc.ty);g.stroke();
        }else{
          g.beginPath();g.arc(lc.x,lc.y,S*0.3*a+2,0,TAU);g.stroke();
        }}
      g.shadowBlur=0;g.globalAlpha=1;g.restore();
      lavaCracks=lavaCracks.filter(lc=>lc.life>0);
      // ---- obsidian blocks ----
      for(const b of blocks){
        if(b._dead)continue;
        if(b.glow>0)b.glow=Math.max(0,b.glow-0.04*dt);
        drawBlock(b);
      }
      // purge shattered blocks (pending refs hold their own object, _dead is guarded)
      blocks=blocks.filter(b=>!b._dead);
      // ---- shards ----
      for(const p of shards){p.vy+=0.55*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
        if(p.y>api.H*0.84){p.y=api.H*0.84;p.vy*=-0.35;p.vx*=0.7;if(Math.abs(p.vy)<1.2)p.life-=0.04*dt;}
        p.life-=p.decay*dt;
        g.save();g.globalAlpha=Math.max(0,p.life);g.translate(p.x,p.y);g.rotate(p.rot);
        g.fillStyle=p.col;g.fillRect(-p.s/2,-p.s/2,p.s,p.s);
        g.fillStyle="rgba(255,170,80,.4)";g.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.3);
        g.restore();}
      shards=shards.filter(p=>p.life>0);
      // ---- sparks (glowing) ----
      g.save();g.globalCompositeOperation="lighter";
      for(const s of sparks){s.vy+=0.18*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=s.decay*dt;
        const a=Math.max(0,s.life);g.globalAlpha=a;g.fillStyle=s.col;g.shadowBlur=8;g.shadowColor=s.col;
        g.beginPath();g.arc(s.x,s.y,s.s*a+0.5,0,TAU);g.fill();}
      g.shadowBlur=0;g.globalAlpha=1;g.restore();
      sparks=sparks.filter(s=>s.life>0);
      // ---- mascot: little fire spirit watching from corner ----
      drawSpirit();
      // ---- floats (combo) ----
      // ③ コンボが切れたら このステージの パーフェクト判定は失敗
      if(combo>0){comboT-=0.016*dt;if(comboT<=0){combo=0;
        if(!clearing&&blocks.some(b=>!b._dead))comboKept=false;}}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.018*dt;g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(40,10,0,.6)";g.strokeText(f.txt,f.x,f.y);
        g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;floats=floats.filter(f=>f.life>0);g.textAlign="left";
      // ---- climax color-wash on celebrate ----
      if(celebrate>0){const ca=Math.min(1,celebrate);
        g.save();g.globalCompositeOperation="lighter";
        const cw=g.createRadialGradient(api.W/2,api.H*0.45,0,api.W/2,api.H*0.45,api.W*0.8);
        cw.addColorStop(0,"rgba(255,210,90,"+(0.4*ca)+")");
        cw.addColorStop(0.5,"rgba(255,120,30,"+(0.2*ca)+")");
        cw.addColorStop(1,"rgba(255,120,30,0)");
        g.fillStyle=cw;g.fillRect(0,0,api.W,api.H);g.restore();}
      // ---- impact flash ----
      if(flash>0){flash-=0.06*dt;const fa=Math.max(0,flash);
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=fa*0.3;
        g.fillStyle=flashHue;g.fillRect(0,0,api.W,api.H);g.restore();}
      // ---- HUD (top center, safe band) ----
      const alive=blocks.filter(b=>!b._dead).length;
      g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
      g.lineWidth=4;g.lineJoin="round";g.strokeStyle="rgba(40,10,0,.6)";
      const hud="ステージ "+stage+"      のこり "+alive;
      g.strokeText(hud,api.W/2,28);g.fillStyle="#ffe6c8";g.fillText(hud,api.W/2,28);
      g.lineJoin="miter";g.textAlign="left";
      // ---- fever gauge (bottom center) ----
      drawGauge();
      // ---- 隠し発見レイヤーの一言/バナー(すべて上部中央=HUD安全帯) ----
      // ① にじいろいし が かくれてる！(初回だけ)
      if(rbHintT>0){const a=clamp(rbHintT*1.4,0,1);
        g.save();g.globalAlpha=a;g.textAlign="center";
        g.font="800 21px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=5;g.lineJoin="round";g.strokeStyle="rgba(40,10,0,.6)";
        const t="にじいろいしが かくれてる！";
        g.strokeText(t,api.W/2,api.H*0.17);g.fillStyle="#ff7bd0";g.fillText(t,api.W/2,api.H*0.17);
        g.globalAlpha=1;g.lineJoin="miter";g.restore();g.textAlign="left";}
      // ② きょうのラッキー色 を 一度だけ 中央上で教える
      if(luckyHintT>0){const a=clamp(luckyHintT*1.2,0,1);
        g.save();g.globalAlpha=a;g.textAlign="center";
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t="きょうの ラッキーは "+(COLNAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.lineJoin="round";g.strokeStyle="rgba(40,10,0,.6)";
        g.strokeText(t,api.W/2,api.H*0.2);g.fillStyle="#fff6c8";g.fillText(t,api.W/2,api.H*0.2);
        g.globalAlpha=1;g.lineJoin="miter";g.restore();g.textAlign="left";}
      // ② ラッキー！ 小さな祝福(ラッキー色で)
      if(luckyMsgT>0){const a=clamp(luckyMsgT*1.4,0,1),pop=1+Math.max(0,luckyMsgT-1.2)*0.6;
        g.save();g.translate(api.W/2,api.H*0.14);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 26px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=6;g.lineJoin="round";g.strokeStyle="rgba(40,10,0,.6)";
        g.strokeText("ラッキー！",0,0);g.fillStyle=luckyColor;g.fillText("ラッキー！",0,0);
        g.globalAlpha=1;g.lineJoin="miter";g.restore();g.textAlign="left";}
      // ① にじいろ！ 大きな中央バナー(虹色に色替わり)
      if(rbMsgT>0){const a=clamp(rbMsgT*1.4,0,1),pop=1+Math.max(0,rbMsgT-1)*1.2;
        const col=RAINBOW[Math.floor(tsec*6)%RAINBOW.length];
        g.save();g.translate(api.W/2,api.H*0.24);g.scale(pop,pop);g.globalAlpha=a;g.textAlign="center";
        g.font="900 40px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=9;g.lineJoin="round";g.strokeStyle="rgba(40,10,0,.6)";
        g.strokeText("にじいろ いし！",0,0);g.fillStyle=col;g.fillText("にじいろ いし！",0,0);
        g.globalAlpha=1;g.lineJoin="miter";g.restore();g.textAlign="left";}
      // ---- fever banner ----
      // 軸6(見やすさ)第2ラウンド: feverBann(本文H*0.34)とclearBanner(本文H*0.4)は数十pxしか離れておらず、
      // ステージ全消しとフィーバー突入が同一フレームで起きると文字が重なって読めなくなる(seed7実測)。
      // クリアバナーが出ている間はフィーバー文字を止めて重なりを消す(ゲージ・演出自体は止めない)。
      if(feverBann>0&&clearBanner<=0){
        const ba=Math.min(1,feverBann*1.4),pop=1+0.2*Math.sin(tsec*12)*ba;
        g.save();g.translate(api.W/2,api.H*0.34);g.scale(pop,pop);g.globalAlpha=ba;
        g.font="900 44px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineJoin="round";g.lineWidth=10;g.strokeStyle="rgba(40,10,0,.7)";
        g.strokeText("フィーバータイム！",0,0);
        let fg=g.createLinearGradient(-130,0,130,0);
        RAINBOW.forEach((c,i)=>fg.addColorStop(i/(RAINBOW.length-1),c));
        g.fillStyle=fg;g.fillText("フィーバータイム！",0,0);
        g.font="800 20px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=6;g.strokeText("ぜんぶ 1かい！ スコア 2ばい！",0,40);
        g.fillStyle="#fff";g.fillText("ぜんぶ 1かい！ スコア 2ばい！",0,40);
        g.globalAlpha=1;g.lineJoin="miter";g.restore();g.textAlign="left";}
      // ---- clear banner ----
      if(clearBanner>0){clearBanner=Math.max(0,clearBanner-0.016*dt);
        const ba=Math.min(1,clearBanner*1.6),pop=1+0.15*Math.sin(tsec*10)*ba;
        g.save();g.translate(api.W/2,api.H*0.4);g.scale(pop,pop);g.globalAlpha=ba;
        g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineJoin="round";g.lineWidth=10;g.strokeStyle="rgba(40,10,0,.7)";
        g.strokeText(clearTxt,0,0);
        let bg=g.createLinearGradient(0,-28,0,28);
        bg.addColorStop(0,"#fff6c8");bg.addColorStop(0.5,"#ffce4a");bg.addColorStop(1,"#ff7a2a");
        g.fillStyle=bg;g.fillText(clearTxt,0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";g.fillStyle="#fff";
        g.fillText(teaser||("つぎは ステージ "+stage+"!"),0,44);
        g.globalAlpha=1;g.lineJoin="miter";g.restore();g.textAlign="left";}
      // 白飛び/漏れ防止: フレーム終了時に加算合成を必ず source-over へ戻す
      g.globalCompositeOperation="source-over";
    }
  };
  function drawGauge(){
    const w=Math.min(api.W*0.5,230),x=(api.W-w)/2,y=api.H-26,h=12;
    g.fillStyle="rgba(30,8,4,.55)";g.fillRect(x-4,y-3,w+8,h+6);
    g.lineWidth=2;g.strokeStyle="rgba(255,230,200,.4)";g.strokeRect(x-4,y-3,w+8,h+6);
    const frac=fever>0?fever/FEVER_LEN:feverGauge,fw=w*frac;
    if(fw>2){
      let pg=g.createLinearGradient(x,0,x+w,0);
      if(fever>0)RAINBOW.forEach((c,i)=>pg.addColorStop(i/(RAINBOW.length-1),c));
      else{pg.addColorStop(0,"#ffe14a");pg.addColorStop(1,"#ff7a2a");}
      g.save();if(fever>0||feverGauge>0.85){g.shadowBlur=12+6*Math.sin(tsec*8);g.shadowColor="#ffd23f";}
      g.fillStyle=pg;g.fillRect(x,y,fw,h);g.restore();
      g.fillStyle="rgba(255,255,255,.3)";g.fillRect(x,y+1,fw,h*0.35);}
    g.font="800 13px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
    g.lineWidth=4;g.lineJoin="round";g.strokeStyle="rgba(40,10,0,.6)";
    const lb=fever>0?"フィーバー ちゅう！":"フィーバー ゲージ";
    g.strokeText(lb,api.W/2,y-6);g.fillStyle=fever>0?"#fff":"#ffe6c8";g.fillText(lb,api.W/2,y-6);
    g.lineJoin="miter";g.textAlign="left";
  }
  function drawBlock(b){
    if(b.gold||b.rainbow){g.save();g.translate(Math.sin(tsec*5+b.wob)*1.5,0);} // gold/rainbow jiggles to catch the eye
    const x=b.x,y=b.y,s=S;
    // 軸7(バラエティ): まるい石は形も大きさも違うので、影とボディをまとめて円で描く
    if(b.round){
      const dia=Math.max(0,b.big?s*1.15:s*0.8),rad=dia/2,cx=x+s/2,cy=y+s/2;
      g.fillStyle="rgba(0,0,0,.35)";
      g.beginPath();g.arc(cx+3,cy+4,rad,0,TAU);g.fill();
      let bg=g.createRadialGradient(cx-rad*0.35,cy-rad*0.35,0,cx,cy,rad);
      bg.addColorStop(0,shade(b.color,42));bg.addColorStop(0.55,b.color);bg.addColorStop(1,shade(b.color,-22));
      g.fillStyle=bg;g.beginPath();g.arc(cx,cy,rad,0,TAU);g.fill();
      g.fillStyle="rgba(255,255,255,.16)";
      g.beginPath();g.arc(cx-rad*0.32,cy-rad*0.36,Math.max(0,rad*0.36),0,TAU);g.fill();
      g.strokeStyle="rgba(0,0,0,.5)";g.lineWidth=1.5;
      g.beginPath();g.arc(cx,cy,rad,0,TAU);g.stroke();
      // 大きい岩はもう1回たたく必要があると分かるよう、ひび割れの筋を1本足す
      if(b.big&&b.hp>1){g.strokeStyle="rgba(0,0,0,.4)";g.lineWidth=Math.max(1,s*0.05);
        g.beginPath();g.moveTo(cx-rad*0.3,cy-rad*0.5);g.lineTo(cx+rad*0.1,cy);g.lineTo(cx-rad*0.15,cy+rad*0.5);g.stroke();}
      // recently-chipped glow flash (丸い岩は円で光らせる)
      if(b.glow>0){g.save();g.globalCompositeOperation="lighter";g.globalAlpha=b.glow*0.5;
        g.fillStyle="#ff8a2a";g.beginPath();g.arc(cx,cy,rad,0,TAU);g.fill();
        g.globalCompositeOperation="source-over";g.restore();}
      if(b.gold||b.rainbow)g.restore();
      return;
    }
    // shadow
    g.fillStyle="rgba(0,0,0,.35)";g.fillRect(x+3,y+4,s,s);
    // 画像ブロック: ゴールドいし / かたい くろいわ だけ画像(単色で色替え不要)。ふつうの いわ は手描き。
    // マス目にぴったり収まるよう、セル中心に S*1.12 で描く(当たり判定=セル S×S)
    let useImg=false;
    if(b.gold)useImg=api.drawAsset("gold.png",x+s/2,y+s/2,s*1.12,s*1.12,{center:true});
    else if(b.hard)useImg=api.drawAsset("hardrock.png",x+s/2,y+s/2,s*1.12,s*1.12,{center:true});
    if(!useImg){
    // glassy obsidian body
    let bg=g.createLinearGradient(x,y,x+s*0.5,y+s);
    bg.addColorStop(0,shade(b.color,42));bg.addColorStop(0.5,b.color);bg.addColorStop(1,shade(b.color,-22));
    g.fillStyle=bg;g.fillRect(x,y,s,s);
    // sharp facets (volcanic glass look)
    g.fillStyle="rgba(255,255,255,.12)";
    g.beginPath();g.moveTo(x,y);g.lineTo(x+s*0.5,y);g.lineTo(x+s*0.2,y+s*0.5);g.closePath();g.fill();
    g.fillStyle="rgba(0,0,0,.25)";
    g.beginPath();g.moveTo(x+s,y+s);g.lineTo(x+s*0.5,y+s);g.lineTo(x+s*0.8,y+s*0.5);g.closePath();g.fill();
    // glossy diagonal sheen
    g.save();g.globalCompositeOperation="lighter";g.globalAlpha=0.25;
    g.strokeStyle="rgba(180,160,255,.6)";g.lineWidth=2;
    g.beginPath();g.moveTo(x+4,y+s-6);g.lineTo(x+s-6,y+4);g.stroke();g.restore();
    }
    // hard block: molten veins glowing inside (2-tap) ※画像のときは絵に溶岩の筋があるので描かない
    if(b.hard&&!useImg){
      g.save();g.globalCompositeOperation="lighter";
      const vp=0.5+0.5*Math.sin(tsec*2+b.wob);
      g.globalAlpha=0.4+0.3*vp;g.strokeStyle="#ff7a2a";g.lineWidth=Math.max(2,s*0.08);g.lineCap="round";
      g.shadowBlur=8;g.shadowColor="#ff5a2a";
      g.beginPath();g.moveTo(x+s*0.3,y+s*0.15);g.lineTo(x+s*0.5,y+s*0.5);
      g.lineTo(x+s*0.4,y+s*0.7);g.lineTo(x+s*0.65,y+s*0.9);g.stroke();
      g.shadowBlur=0;g.restore();
    }
    // gold ore: pulsing halo + sparkle cross (shouts "tap me!")
    if(b.gold){
      const gp=0.5+0.5*Math.sin(tsec*3+b.wob);
      g.save();g.globalCompositeOperation="lighter";
      g.globalAlpha=0.25+0.35*gp;
      const gl=g.createRadialGradient(x+s/2,y+s/2,0,x+s/2,y+s/2,s*0.85);
      gl.addColorStop(0,"rgba(255,225,100,.95)");gl.addColorStop(1,"rgba(255,225,100,0)");
      g.fillStyle=gl;g.fillRect(x-s*0.35,y-s*0.35,s*1.7,s*1.7);
      // twinkling star
      const sxp=x+s*0.68,syp=y+s*0.3,sr=s*(0.1+0.08*gp);
      g.globalAlpha=0.6+0.4*gp;g.strokeStyle="#fff6c8";g.lineWidth=2;g.lineCap="round";
      g.beginPath();g.moveTo(sxp-sr,syp);g.lineTo(sxp+sr,syp);
      g.moveTo(sxp,syp-sr);g.lineTo(sxp,syp+sr);g.stroke();
      g.restore();
    }
    // ① にじいろいし: 虹色に脈動するハロー＋色替わりの芯(「タップして！」と主張する激レア)
    if(b.rainbow){
      const rp=0.5+0.5*Math.sin(tsec*3+b.wob);
      const rc=RAINBOW[Math.floor(tsec*6+b.wob)%RAINBOW.length];
      g.save();g.globalCompositeOperation="lighter";
      g.globalAlpha=0.3+0.35*rp;
      const gl=g.createRadialGradient(x+s/2,y+s/2,0,x+s/2,y+s/2,Math.max(0,s*0.9));
      gl.addColorStop(0,rc);gl.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=gl;g.fillRect(x-s*0.4,y-s*0.4,s*1.8,s*1.8);
      g.globalAlpha=0.5+0.5*rp;g.fillStyle=rc;g.fillRect(x+s*0.22,y+s*0.22,s*0.56,s*0.56);
      g.globalCompositeOperation="source-over";g.globalAlpha=1;g.restore();
    }
    // recently-chipped glow flash
    if(b.glow>0){g.save();g.globalCompositeOperation="lighter";g.globalAlpha=b.glow*0.5;
      g.fillStyle="#ff8a2a";g.fillRect(x,y,s,s);g.globalCompositeOperation="source-over";g.restore();}
    // outline (画像ブロックは絵の輪郭を活かす)
    if(!useImg){g.strokeStyle="rgba(0,0,0,.5)";g.lineWidth=1.5;g.strokeRect(x+0.5,y+0.5,s-1,s-1);}
    if(b.gold||b.rainbow)g.restore();
  }
  function drawSpirit(){
    // little floating lava blob with a face, in the corner, cheers on chains
    const cx=clamp(api.W*0.12,52,72),cy=api.H*0.84+Math.sin(tsec*2)*4;
    const r=clamp(S*0.5,20,30),cel=Math.min(1,celebrate),hot=Math.min(1,face);
    g.save();g.translate(cx,cy);
    const joy=Math.min(1,spiritJoy);
    const pop=1+0.1*Math.sin(tsec*8)*(cel+hot)+0.2*joy;g.scale(pop,pop);
    // glow halo
    g.save();g.globalCompositeOperation="lighter";
    const hg=g.createRadialGradient(0,0,0,0,0,r*2);
    hg.addColorStop(0,"rgba(255,150,50,.6)");hg.addColorStop(1,"rgba(255,150,50,0)");
    g.fillStyle=hg;g.beginPath();g.arc(0,0,r*2,0,TAU);g.fill();g.restore();
    // 画像せいれい: 絵に顔があるので体・目・口の手描きはスキップ。よろこび(pop)とハローは共通。
    if(api.drawAsset("spirit.png",0,0,r*2.6,r*2.6,{center:true})){
      if(hot>0.4){ // こわした瞬間だけ 頭上に小さな火の粉のキラッ(反応が分かる)
        g.save();g.globalCompositeOperation="lighter";g.globalAlpha=Math.min(1,(hot-0.4)*1.6);
        g.fillStyle="#ffe07a";
        for(let k=0;k<3;k++){const a=-TAU*0.25+(k-1)*0.55,rr=Math.max(0,r*(1.25+0.15*k));
          g.beginPath();g.arc(Math.cos(a)*rr,Math.sin(a)*rr,Math.max(0,r*0.09),0,TAU);g.fill();}
        g.globalCompositeOperation="source-over";g.restore();}
      g.restore();return;
    }
    // body (molten blob)
    const bg=g.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r);
    bg.addColorStop(0,"#ffd24a");bg.addColorStop(0.5,"#ff7a2a");bg.addColorStop(1,"#c4301a");
    g.fillStyle=bg;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    // eyes
    g.fillStyle="#2a1008";
    if(hot>0.4){
      g.lineWidth=Math.max(2,r*0.12);g.strokeStyle="#2a1008";g.lineCap="round";
      g.beginPath();g.moveTo(-r*0.45,-r*0.05);g.lineTo(-r*0.2,-r*0.2);g.lineTo(-r*0.45,-r*0.35);g.stroke();
      g.beginPath();g.moveTo(r*0.45,-r*0.05);g.lineTo(r*0.2,-r*0.2);g.lineTo(r*0.45,-r*0.35);g.stroke();
    }else{
      g.beginPath();g.arc(-r*0.32,-r*0.15,r*0.15,0,TAU);g.arc(r*0.32,-r*0.15,r*0.15,0,TAU);g.fill();
      g.fillStyle="#fff";g.beginPath();g.arc(-r*0.28,-r*0.2,r*0.05,0,TAU);g.arc(r*0.36,-r*0.2,r*0.05,0,TAU);g.fill();
    }
    // mouth
    g.fillStyle="#2a1008";g.strokeStyle="#2a1008";g.lineWidth=Math.max(2,r*0.1);g.lineCap="round";
    if(hot>0.4){g.beginPath();g.ellipse(0,r*0.35,r*0.2,r*0.22,0,0,TAU);g.fill();}
    else{g.beginPath();g.arc(0,r*0.2,r*0.22,0.1*Math.PI,0.9*Math.PI);g.stroke();}
    g.restore();
  }
  function shade(hex,amt){let n=parseInt(hex.slice(1),16);
    let r=clamp((n>>16)+amt,0,255),gg=clamp(((n>>8)&255)+amt,0,255),bb=clamp((n&255)+amt,0,255);
    return"rgb("+r+","+gg+","+bb+")";}
}
Engine.register("obsidian", buildObsidian);
