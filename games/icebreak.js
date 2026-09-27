function buildIcebreak(api){
  const g=api.g;
  api.preload(["bg.jpg","pick.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。氷ブロックは手描き(生成が安定しないため不採用)
  let S,cols,rows,bx,topY,groundY,tsec=0,count=0,combo=0,comboT=0,flash=0,flashHue="#cfefff";
  let axe={x:0,y:0,t:1,side:1};   // タップ位置に振り下ろすアイスピック(見た目だけ・操作は変えない)
  let lastStopT=-9; // hitStopは「大ヒット単発」専用(連打で画面凍結しないよう間隔を空ける)
  // grid[col] = array of cells bottom->top; each cell {col,row,x,y,ty,vy,settled,hp,col0,wob}
  let grid=[],shards=[],sparks=[],rings=[],snow=[],glints=[],floats=[];
  // stage progression (endless): clear all ice -> "ステージ クリア!" -> harder
  let stage=1,clearBanner=0,clearTxt="",celebrate=0,refilling=false;
  // 上乗せ要素: オーロラフィーバー(ゲージMAXで一定時間ぜんぶ2倍!)
  let fever=0,feverGauge=0,feverBanner=0;
  const FEVER_LEN=10; // seconds
  const RAINBOW=["#ff5b5b","#ffd23f","#7be08a","#4db8ff","#b58bff","#ff7bd0"];
  const ICE=["#bfeaff","#9fdcff","#cfe9ff","#a8e6ff","#d6f0ff"];
  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマー/トラックと同じ思想) ----
  const GEM=["#ff6b6b","#ffcf3a","#66d97a","#4db8ff","#c89bff","#ff8fd0"]; // 宝石こおり(はっきり色分け)
  const GEMNAME={"#ff6b6b":"あか","#ffcf3a":"きいろ","#66d97a":"みどり","#4db8ff":"あお","#c89bff":"むらさき","#ff8fd0":"ピンク"};
  let luckyColor=pick(GEM),luckySeen=false,luckyBig=false,luckyMsgT=0; // ② きょうのラッキー色(セッション秘密)
  let rbMsgT=0;                    // ① にじいろ氷 発見バナー
  let noStop=true;                 // ③ ノンストップ判定(コンボを切らさず ステージ完走)
  const moonPos={x:0,y:0,r:0};     // ④ お月さまタップ(減点なしのごほうび)
  let moonWink=0;
  // --- helpers ---
  function spark(x,y,c,n){for(let i=0;i<n;i++){const a=rnd(0,TAU),v=rnd(2,8);
    sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-rnd(0,2.5),life:1,decay:rnd(0.02,0.045),s:rnd(1.5,3.6),col:c});}}
  function ring(x,y,c){rings.push({x,y,r:S*0.35,life:1,col:c});}
  function shatterShards(c){
    // ⑦ 大氷(shape===2)は壊れる規模も大きく見せる(破片数を1.5倍)
    const shardN=c.shape===2?Math.round(rint(6,9)*1.5):rint(6,9);
    for(let i=shardN;i>0;i--)shards.push({x:c.x+rnd(4,S-4),y:c.y+rnd(4,S-4),
      vx:rnd(-6,6),vy:rnd(-10,-2),s:rnd(S*0.18,S*0.36),col:c.rainbow?pick(RAINBOW):c.col0,
      rot:rnd(0,TAU),vr:rnd(-0.45,0.45),life:1,decay:rnd(0.006,0.013),pts:chunkPts()});
  }
  function cellAt(px,py){for(let col=0;col<cols;col++){const arr=grid[col];
    for(const c of arr){if(!c.dead&&px>=c.x&&px<=c.x+S&&py>=c.y&&py<=c.y+S)return true;}}return false;}
  // ① にじいろ氷 撃破: 虹の輪＋虹きらめき＋大量点(激レアの大盤振る舞い)
  function rainbowBreak(c){
    const cx=c.x+S/2,cy=c.y+S/2;
    count+=7; api.setScore(count); rbMsgT=1.5;
    flash=Math.min(1,flash+0.4); flashHue="#ffe6ff";
    api.boom(0.6); api.shake(14);
    if(tsec-lastStopT>0.5){ api.hitStop(4); lastStopT=tsec; }
    api.slide(660,1320,0.4,0.2,"triangle"); api.tone(1320,0.16,"triangle",0.1); api.tone(1760,0.18,"triangle",0.08);
    for(let k=0;k<RAINBOW.length;k++)rings.push({x:cx,y:cy,r:S*0.3,life:1,col:RAINBOW[k]});
    for(let i=0;i<22;i++){const a=rnd(0,TAU),v=rnd(3,9);
      sparks.push({x:cx,y:cy,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,life:1,decay:rnd(0.02,0.04),s:rnd(2,4),col:RAINBOW[i%RAINBOW.length]});}
    floats.push({x:cx,y:cy-40,txt:"にじいろ！",life:1,vy:-0.8,col:"#ff7bd0",size:38});
  }
  // ② ラッキー色 撃破: 小さめボーナス＋頭上に星のキラッ(気づけるヒント)
  function luckyBreak(c){
    const cx=c.x+S/2,cy=c.y+S/2;
    count+=1; api.setScore(count);
    if(!luckySeen){luckySeen=true;luckyBig=true;luckyMsgT=1.8;} else {luckyBig=false;luckyMsgT=Math.max(luckyMsgT,0.8);}
    api.tone(1046,0.14,"triangle",0.11); api.tone(1568,0.16,"triangle",0.08);
    for(let i=0;i<8;i++){const a=rnd(-TAU*0.5,0),v=rnd(2,5);
      sparks.push({x:cx,y:cy-4,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1.5,life:1,decay:rnd(0.02,0.035),s:rnd(2,3.5),col:luckyColor});}
    floats.push({x:cx,y:cy-30,txt:"ラッキー！",life:1,vy:-0.8,col:luckyColor,size:26});
  }
  function layout(){
    groundY=api.H*0.9;
    S=clamp(Math.floor(api.W/9),38,62);
    cols=clamp(Math.floor((api.W*0.7)/S),4,8);
    bx=Math.round((api.W-cols*S)/2);
    for(let col=0;col<cols;col++){const arr=grid[col]; if(!arr)continue;
      arr.forEach((c,i)=>{c.col=col;c.row=i;c.x=bx+col*S;c.ty=cellY(i);c.y=c.ty;c.settled=true;});}
    // (re)build snow field sized to screen
    snow=[];for(let i=0;i<70;i++)snow.push({x:rnd(0,api.W),y:rnd(0,api.H),
      r:rnd(1.2,3.6),sp:rnd(0.3,1.2),drift:rnd(-0.4,0.4),ph:rnd(0,TAU)});
    moonPos.x=api.W*0.8; moonPos.y=api.H*0.15; moonPos.r=S*0.5; // ④ お月さま(描画と当たり判定を一致)
  }
  const cellY=i=>groundY-(i+1)*S;
  function buildField(){
    grid=[]; noStop=true; let rbPlaced=false,bigPlaced=false;   // ③ 新ステージ = ノンストップ判定リセット
    // 7〜8歳向け: 氷を1段多く積み、かたい氷の割合も少し増やした(操作は同じ)
    const baseH=clamp(6+(stage-1),6,Math.floor((groundY-api.H*0.2)/S));
    for(let col=0;col<cols;col++){
      const h=baseH-(Math.random()<0.45?rint(0,2):0);
      const arr=[];
      // hard blocks (need 2 cracks) appear more in later stages
      const hardChance=stage>=2?clamp(0.08+0.06*(stage-2),0.08,0.40):0;
      for(let row=0;row<h;row++){
        let hard=false,gem=false,rainbow=false,c0;
        // ① にじいろ氷: ステージに最大1個の激レア。虹色に光る大当たり。
        if(!rbPlaced && stage>=1 && Math.random()<0.03){ rainbow=true; rbPlaced=true; c0="#ffffff"; }
        // ② 宝石こおり: はっきり色分けした氷。ラッキー色を壊すと隠しボーナス。
        else if(Math.random()<0.12){ gem=true; c0=pick(GEM); }
        else { hard=Math.random()<hardChance; c0=hard?"#9fb6cc":pick(ICE); }
        // ⑦ 形のバラエティ: 0=ふつうの四角 1=角丸の丸氷 2=ひとまわり大きい大氷 3=中に生き物のシルエット氷
        // (当たり判定・グリッド座標は元のSのまま。見た目の描画だけ shape で変える → 他ロジックは無傷)
        const sr=Math.random();
        let shape=sr<0.40?0:sr<0.58?1:sr<0.80?2:3;
        // ⑦ 大氷が一度も出ないステージが確率任せで発生しないよう、最後の列の最後の段で保証する
        if(!bigPlaced && col===cols-1 && row===h-1) shape=2;
        if(shape===2) bigPlaced=true;
        arr.push({col,row,x:bx+col*S,y:cellY(row),ty:cellY(row),vy:0,settled:true,
          hp:hard?2:1,hard:hard,gem:gem,rainbow:rainbow,col0:c0,wob:0,
          shape:shape,sil:shape===3?pick(["fish","penguin","crab","starfish"]):null});
      }
      grid.push(arr);
    }
  }
  function totalCells(){let n=0;for(const a of grid)n+=a.length;return n;}
  // gravity: after removals, re-index each column bottom-up
  function applyGravity(){
    for(let col=0;col<cols;col++){const arr=grid[col];
      arr.forEach((c,i)=>{if(c.row!==i){c.row=i;c.ty=cellY(i);c.settled=false;}});
    }
  }
  // crack a single cell; returns true if it shattered (removed)
  function crack(c,viaChain){
    if(!c||c.dead)return false;
    c.hp--; c.wob=1;
    if(c.hp>0){
      c.col0="#dcefff"; // visually whiter when cracked
      spark(c.x+S/2,c.y+S/2,"#eafaff",4);
      ring(c.x+S/2,c.y+S/2,"#dff4ff");
      api.noise(0.08,0.18,2600,"highpass",1.2); api.tone(900,0.06,"square",0.06);
      api.shake(viaChain?2:3);
      return false;
    }
    // shatter
    c.dead=true;
    // かたい氷(2発目)が割れた瞬間だけ、低い音＋大きめの揺れで「割れ方の違い」を出す
    if(c.hard){ api.tone(220,0.14,"square",0.09); api.shake(viaChain?4:7); }
    if(c.rainbow) rainbowBreak(c);
    else if(c.gem && c.col0===luckyColor) luckyBreak(c);
    shatterShards(c);
    spark(c.x+S/2,c.y+S/2,c.rainbow?pick(RAINBOW):c.col0,viaChain?5:7);
    ring(c.x+S/2,c.y+S/2,c.rainbow?"#ffffff":c.col0);
    // オーロラフィーバー: シャッターのたびにゲージが貯まり、満タンで一定時間ぜんぶ2倍
    if(fever<=0){
      feverGauge=clamp(feverGauge+8,0,100);
      if(feverGauge>=100){ feverGauge=0; fever=FEVER_LEN; feverBanner=1.6;
        flash=Math.min(1,flash+0.6); flashHue="#ffe6ff";
        api.boom(0.6); api.shake(16);
        api.slide(784,1568,0.5,0.25,"triangle");
        floats.push({x:api.W/2,y:api.H*0.5,txt:"オーロラフィーバー！",life:1,vy:-0.5,col:"#ffd9ff",size:32});
      }
    }
    return true;
  }
  // tap: crack the tapped cell; if it shatters, chain a crack into 4-neighbours
  // 直撃がなければ最寄りの氷に作用(オートエイム: テキトー連打でも必ず進む)
  function tapAt(px,py){
    if(refilling)return;
    // 歯ごたえ: 氷がたくさん残っている間は直撃以外に上限距離を設け、狙わないと当たらないようにする。
    // ただし終盤(残りわずか)まで同じ厳しさだと「最後の1個が遠くて延々終わらない」になるので、
    // 残数が減るほど吸着を広げて確実に決着がつくようにする(ノンストップ/クリアの気持ちよさを守る)。
    const remaining=totalCells();
    const capR=remaining<=3?Infinity:remaining<=8?S*2.0:S*0.85;
    // 歯ごたえ(a): 氷の塊のバウンディングボックスから明らかに離れたタップ(空・地面・画面端など)は、
    // capRの吸着に関わらず必ず外れにする(空や地面を叩いても割れてしまう問題の対策)。
    // ただし塊のすぐ外側の「惜しい」タップまで殺すと無反応が伸びすぎるので、余白は広めに取る。
    let minCy=Infinity;
    for(let col=0;col<cols;col++){const arr=grid[col];
      for(const c of arr){ if(!c.dead && c.y<minCy) minCy=c.y; } }
    if(minCy!==Infinity){
      const pad=S*1.6;
      if(px<bx-pad || px>bx+cols*S+pad || py<minCy-pad || py>groundY+pad){
        api.tone(220,0.05,"triangle",0.05); return;
      }
    }
    let target=null,bestD=Infinity;
    for(let col=0;col<cols;col++){const arr=grid[col];
      for(const c of arr){ if(c.dead)continue;
        if(px>=c.x&&px<=c.x+S&&py>=c.y&&py<=c.y+S){target=c;bestD=-1;break;}
        const dx=px-(c.x+S/2),dy=py-(c.y+S/2),d=dx*dx+dy*dy;
        if(d<bestD && d<capR*capR){bestD=d;target=c;}}
      if(bestD<0)break;}
    if(!target){ api.tone(220,0.05,"triangle",0.05); return; }
    axe.x=px; axe.y=py; axe.t=0; axe.side=px<api.W/2?-1:1;   // アイスピックをタップ位置へ振り下ろす
    flashHue="#cfefff";
    const shattered=crack(target,false);
    if(!shattered){ // just a crack, small feedback, no combo growth
      return;
    }
    // it broke -> count, combo, chain to neighbours
    let broke=1;
    // neighbour chain: left/right same row index, up/down within column
    const neigh=neighbours(target);
    for(const n of neigh){ if(n&&!n.dead){ if(crack(n,true)) broke++; } }
    // remove dead cells from grid, then settle
    let removed=0;
    for(let col=0;col<cols;col++){const arr=grid[col];
      for(let i=arr.length-1;i>=0;i--){ if(arr[i].dead){arr.splice(i,1);removed++;} }}
    if(removed>0) applyGravity();
    count+=(fever>0?broke*2:broke); api.setScore(count);
    combo++; comboT=0.9;   // 7〜8歳向け: コンボ猶予をわずかに短く(ノンストップの手応え)
    flash=Math.min(1,flash+0.32+broke*0.06);
    api.shake(5+broke*1.5);
    if(broke>=3&&tsec-lastStopT>0.5){ api.hitStop(3); lastStopT=tsec; }
    api.boom(clamp(0.28+broke*0.06,0.28,0.6));
    api.slide(520*Math.pow(2,clamp(combo,0,12)/14),120,0.18,0.22,"triangle");
    api.noise(0.16,0.26,1500,"bandpass",0.7);
    if(combo>1) floats.push({x:px,y:py-22,txt:"x"+combo,life:1,vy:-1.1,
      col:combo>=8?"#ff8af0":combo>=5?"#7be0ff":"#ffe14a",size:combo>=5?40:30});
    if(broke>=3) floats.push({x:px,y:py-56,txt:"バキバキ！",life:1,vy:-0.7,col:"#9fe8ff",size:24});
    if(totalCells()===0) stageClear();
  }
  function neighbours(c){
    const res=[];
    const colArr=grid[c.col];
    // up/down within column (by current index)
    const idx=colArr.indexOf(c);
    if(idx>=0){ res.push(colArr[idx-1]); res.push(colArr[idx+1]); }
    // left/right: cell at same y in adjacent columns
    for(const dc of [-1,1]){ const nc=c.col+dc; if(nc<0||nc>=cols)continue;
      const arr=grid[nc]; if(!arr)continue;
      for(const o of arr){ if(!o.dead && Math.abs(o.y-c.y)<S*0.6){ res.push(o); break; } } }
    return res;
  }
  function stageClear(){
    if(refilling)return; refilling=true;
    // ③ ノンストップ ボーナス: コンボを一度も切らさず 壊し切ったら +5 & みどりの祝福
    if(noStop){ count+=5; api.setScore(count);
      floats.push({x:api.W/2,y:api.H*0.55,txt:"ノンストップ！＋5",life:1,vy:-0.6,col:"#7be08a",size:34});
      api.tone(1318,0.16,"triangle",0.1); api.tone(1976,0.18,"triangle",0.08); }
    clearBanner=1.8; clearTxt="ステージ クリア！"; celebrate=1.8; flash=1; flashHue="#bfeaff";
    api.boom(0.6); api.shake(20);
    api.slide(523,1046,0.5,0.3,"triangle");
    setTimeout(()=>{ api.tone(784,0.18,"triangle",0.22); },120);
    setTimeout(()=>{ api.tone(1046,0.3,"triangle",0.22); },280);
    setTimeout(()=>{ stage++; combo=0; buildField(); refilling=false; },320);
  }
  layout(); buildField();
  return{
    resize:layout,
    input(px,py,type){ if(type!=="down")return;
      // ④ お月さまタップ: 氷に当たらない高い所をタップして お月さまに触れたら ウインク＋きらめき(減点なし)
      if(!refilling && moonPos.r>0 && Math.hypot(px-moonPos.x,py-moonPos.y)<Math.max(48,moonPos.r*2) && !cellAt(px,py)){
        moonWink=1; api.tone(1318,0.12,"triangle",0.1); api.tone(1760,0.14,"triangle",0.07);
        for(let i=0;i<9;i++){const a=rnd(-TAU*0.5,0),v=rnd(2,5);
          sparks.push({x:moonPos.x,y:moonPos.y,vx:Math.cos(a)*v*0.7,vy:Math.sin(a)*v-1,life:1,decay:0.02,s:rnd(2,4),col:"#eaf6ff"});}
        floats.push({x:moonPos.x,y:moonPos.y+moonPos.r+16,txt:"おつきさま",life:1,vy:-0.5,col:"#dff2ff",size:20});
        return;
      }
      tapAt(px,py); },
    frame(dt,now){
      tsec+=0.016*dt;
      if(celebrate>0)celebrate=Math.max(0,celebrate-0.02*dt);
      // ---- sky (画像背景があればそれを使い、無ければ従来の寒色グラデ) ----
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true; }
      else {
        let sky=g.createLinearGradient(0,0,0,api.H);
        sky.addColorStop(0,"#0e2747"); sky.addColorStop(0.35,"#1f4e7a");
        sky.addColorStop(0.62,"#3f86b8"); sky.addColorStop(0.82,"#a9d8ef"); sky.addColorStop(1,"#e7f6ff");
        g.fillStyle=sky; g.fillRect(0,0,api.W,api.H);
      }
      // aurora ribbons (additive) ※画像背景のときは絵のオーロラを活かして控えめに揺らす
      g.save(); g.globalCompositeOperation="lighter";
      const auroras=[["#7be0ff",0.16,0.20],["#9fffd6",0.26,0.16],["#c8a8ff",0.36,0.18]];
      const auroraMul=imgBg?0.5:1;
      for(let a=0;a<auroras.length;a++){const ah=auroras[a],cy=api.H*ah[1];
        let ag=g.createLinearGradient(0,cy-55,0,cy+55);
        ag.addColorStop(0,"rgba(0,0,0,0)"); ag.addColorStop(0.5,ah[0]); ag.addColorStop(1,"rgba(0,0,0,0)");
        g.globalAlpha=ah[2]*auroraMul*(0.6+0.4*Math.sin(tsec*0.5+a*1.4)); g.fillStyle=ag;
        g.beginPath(); g.moveTo(0,cy);
        for(let x=0;x<=api.W;x+=26)g.lineTo(x,cy+Math.sin(x*0.011+tsec*0.6+a*2)*24);
        g.lineTo(api.W,cy+85); g.lineTo(0,cy+85); g.closePath(); g.fill(); }
      g.restore(); g.globalAlpha=1;
      // moon
      const mx=moonPos.x,my=moonPos.y,mr=moonPos.r;
      let mg=g.createRadialGradient(mx,my,0,mx,my,api.W*0.5);
      mg.addColorStop(0,"rgba(225,245,255,.45)"); mg.addColorStop(0.3,"rgba(190,225,255,.14)"); mg.addColorStop(1,"rgba(190,225,255,0)");
      g.fillStyle=mg; g.fillRect(0,0,api.W,api.H);
      g.save(); g.globalCompositeOperation="lighter"; g.fillStyle="rgba(240,250,255,.92)";
      g.beginPath(); g.arc(mx,my,mr,0,TAU); g.fill(); g.restore();
      // ④ お月さまタップ: 叩かれた瞬間だけ ^_^ のウインク顔(発見のごほうび)
      if(moonWink>0){ g.save(); g.strokeStyle="#6f86a8"; g.lineWidth=Math.max(2,mr*0.14); g.lineCap="round";
        g.globalAlpha=clamp(moonWink*1.4,0,1);
        g.beginPath();
        g.moveTo(mx-mr*0.5,my-mr*0.06); g.quadraticCurveTo(mx-mr*0.33,my-mr*0.34,mx-mr*0.16,my-mr*0.06);
        g.moveTo(mx+mr*0.16,my-mr*0.06); g.quadraticCurveTo(mx+mr*0.33,my-mr*0.34,mx+mr*0.5,my-mr*0.06);
        g.stroke();
        g.beginPath(); g.arc(mx,my+mr*0.16,mr*0.34,0.12*Math.PI,0.88*Math.PI); g.stroke();
        g.restore(); g.globalAlpha=1; }
      // distant snowy mountains + snowy ground ※画像背景のときは絵の山/雪原と喧嘩するので描かない
      if(!imgBg){
        g.fillStyle="rgba(180,210,235,.45)"; g.beginPath(); g.moveTo(0,groundY);
        const baseM=groundY-S*1.4;
        for(let x=0;x<=api.W;x+=40)g.lineTo(x,baseM+Math.sin(x*0.006+1.5)*S*0.9);
        g.lineTo(api.W,groundY); g.closePath(); g.fill();
        g.fillStyle="rgba(150,190,225,.5)"; g.beginPath(); g.moveTo(0,groundY);
        for(let x=0;x<=api.W;x+=46)g.lineTo(x,groundY-S*0.8+Math.sin(x*0.008+3)*S*0.7);
        g.lineTo(api.W,groundY); g.closePath(); g.fill();
        let gr=g.createLinearGradient(0,groundY,0,api.H);
        gr.addColorStop(0,"#f2fbff"); gr.addColorStop(1,"#cfe6f4");
        g.fillStyle=gr; g.fillRect(0,groundY,api.W,api.H-groundY);
        g.fillStyle="rgba(255,255,255,.6)"; g.fillRect(0,groundY,api.W,4);
      } else {
        // 画像時: 氷の山の足元にだけ柔らかい落ち影(接地感・帯は描かない)
        g.fillStyle="rgba(10,30,60,.22)"; g.beginPath();
        g.ellipse(bx+cols*S/2,groundY+S*0.12,Math.max(0,cols*S*0.56),Math.max(0,S*0.22),0,0,TAU); g.fill();
      }
      // shockwave rings (glow)
      g.save(); g.globalCompositeOperation="lighter";
      for(const rg of rings){rg.r+=(S*2.0-rg.r)*0.18*dt; rg.life-=0.05*dt;
        const rl=Math.max(0,rg.life); g.globalAlpha=rl*0.7; g.lineWidth=Math.max(1,5*rg.life);
        g.strokeStyle=rg.col; g.shadowBlur=14*rl; g.shadowColor=rg.col;
        g.beginPath(); g.arc(rg.x,rg.y,rg.r,0,TAU); g.stroke();}
      g.restore(); g.globalAlpha=1; g.shadowBlur=0;
      rings=rings.filter(rg=>rg.life>0);
      // ---- ice blocks ----
      for(let col=0;col<cols;col++){const arr=grid[col];
        for(const c of arr){
          if(!c.settled){ c.vy+=0.85*dt; c.y+=c.vy*dt;
            if(c.y>=c.ty){ c.y=c.ty;
              if(Math.abs(c.vy)>4){ c.vy*=-0.26; if(Math.abs(c.vy)<3){c.vy=0;c.settled=true;}
                spark(c.x+S/2,c.ty+S,"#ffffff",2); }
              else { c.vy=0; c.settled=true; } } }
          if(c.wob>0)c.wob=Math.max(0,c.wob-0.06*dt);
          drawIce(c);
        }
      }
      // shards
      for(const p of shards){ p.vy+=0.5*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt;
        if(p.y>groundY-2){ p.y=groundY-2; p.vy*=-0.36; p.vx*=0.72; if(Math.abs(p.vy)<1.2)p.life-=0.05*dt; }
        p.life-=p.decay*dt;
        g.save(); g.globalAlpha=Math.max(0,p.life); g.translate(p.x,p.y); g.rotate(p.rot); drawChunk(p); g.restore(); }
      shards=shards.filter(p=>p.life>0);
      // sparks (icy glints)
      g.save(); g.globalCompositeOperation="lighter";
      for(const s of sparks){ s.vy+=0.16*dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=s.decay*dt;
        const a=Math.max(0,s.life); g.globalAlpha=a; g.fillStyle=s.col; g.shadowBlur=8; g.shadowColor=s.col;
        g.beginPath(); g.arc(s.x,s.y,s.s*a+0.5,0,TAU); g.fill(); }
      g.restore(); g.globalAlpha=1; g.shadowBlur=0;
      sparks=sparks.filter(s=>s.life>0);
      // ice pick swing at the tap point (見た目の道具・操作は変わらない)
      if(axe.t<1){ axe.t=Math.min(1,axe.t+0.09*dt);
        const ph=axe.t, sw=Math.min(1,ph/0.35);                     // 前半で振り下ろし、後半はフェードアウト
        const ang=(-1.15+Math.sin(sw*Math.PI/2)*1.35)*axe.side;
        const al=ph<0.55?1:clamp(1-(ph-0.55)/0.45,0,1);
        drawPick(axe.x,axe.y,ang,al); }
      // falling snow (foreground)
      g.save(); g.fillStyle="#ffffff";
      for(const f of snow){ f.y+=f.sp*dt; f.x+=f.drift*dt+Math.sin(tsec+f.ph)*0.3;
        if(f.y>api.H+4){f.y=-4;f.x=rnd(0,api.W);} if(f.x<-4)f.x=api.W+4; if(f.x>api.W+4)f.x=-4;
        g.globalAlpha=0.55+0.35*Math.sin(f.ph+tsec*2);
        g.beginPath(); g.arc(f.x,f.y,f.r,0,TAU); g.fill(); }
      g.restore(); g.globalAlpha=1;
      // floats (combo text)  ※コンボが時間切れで0になったら ノンストップ失敗
      if(combo>0){comboT-=0.016*dt; if(comboT<=0){combo=0; if(!refilling)noStop=false;}}
      if(moonWink>0)moonWink=Math.max(0,moonWink-0.02*dt);
      if(luckyMsgT>0){luckyMsgT-=0.016*dt; if(luckyMsgT<=0){luckyMsgT=0;luckyBig=false;}}
      if(rbMsgT>0){rbMsgT-=0.016*dt; if(rbMsgT<0)rbMsgT=0;}
      if(fever>0)fever=Math.max(0,fever-0.016*dt);
      if(feverBanner>0){feverBanner-=0.016*dt; if(feverBanner<0)feverBanner=0;}
      for(const f of floats){ f.y+=f.vy*dt; f.life-=0.018*dt;
        g.globalAlpha=Math.max(0,f.life); g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.textAlign="center"; g.lineWidth=6; g.strokeStyle="rgba(10,30,60,.5)";
        g.strokeText(f.txt,f.x,f.y); g.fillStyle=f.col; g.fillText(f.txt,f.x,f.y); }
      g.globalAlpha=1; g.textAlign="left"; floats=floats.filter(f=>f.life>0);
      // impact flash
      if(flash>0){ flash-=0.06*dt; const fa=Math.max(0,flash);
        g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=fa*0.3; g.fillStyle=flashHue;
        g.fillRect(0,0,api.W,api.H); g.globalAlpha=fa*0.16; g.fillStyle="#fff"; g.fillRect(0,0,api.W,api.H);
        g.restore(); g.globalAlpha=1; }
      // celebrate sweep
      if(celebrate>0){ const ca=Math.min(1,celebrate);
        g.save(); g.globalCompositeOperation="lighter";
        const sweep=((tsec*0.5)%1.4-0.2)*api.W,bw=api.W*0.5;
        let cw=g.createLinearGradient(sweep,0,sweep+bw,api.H);
        cw.addColorStop(0,"rgba(123,224,255,0)"); cw.addColorStop(0.5,"rgba(200,245,255,0.5)"); cw.addColorStop(1,"rgba(159,255,214,0)");
        g.globalAlpha=ca*0.24; g.fillStyle=cw; g.fillRect(0,0,api.W,api.H);
        g.restore(); g.globalAlpha=1; }
      // フィーバーゲージ(文字HUDとは別の細い帯・1行構成のHUDは崩さない)
      g.save();
      g.fillStyle="rgba(255,255,255,.18)"; g.fillRect(0,0,api.W,4);
      const fw=Math.max(0,api.W*clamp(fever>0?1:feverGauge/100,0,1));
      g.fillStyle=fever>0?"#ffe14a":"#bfeaff"; g.fillRect(0,0,fw,4);
      g.restore();
      // ---- HUD (top center: safe zone) ----
      g.save(); g.font="800 17px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
      g.lineWidth=5; g.lineJoin="round"; g.strokeStyle="rgba(10,30,60,.55)";
      const hud="ステージ "+stage+"   こおり "+totalCells();
      g.strokeText(hud,api.W/2,30); g.fillStyle="#eafaff"; g.fillText(hud,api.W/2,30);
      g.lineJoin="miter"; g.restore(); g.textAlign="left";
      // combo big text (top center, below HUD)
      if(combo>1){ const pop=1+Math.max(0,comboT-0.7)*1.2;
        g.save(); g.translate(api.W/2,api.H*0.15); g.scale(pop,pop);
        g.font="900 32px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center";
        g.globalAlpha=clamp(comboT,0,1); g.shadowColor="rgba(80,200,255,.85)"; g.shadowBlur=14;
        g.fillStyle="#9fe8ff"; g.fillText("コンボ x"+combo,0,0);
        g.shadowBlur=0; g.lineWidth=1.5; g.strokeStyle="rgba(255,255,255,.6)"; g.strokeText("コンボ x"+combo,0,0);
        g.restore(); g.globalAlpha=1; g.textAlign="left"; }
      // ① にじいろ！ 発見バナー(虹色に色替わり・上部中央=安全帯)
      if(rbMsgT>0){ const pop=1+Math.max(0,rbMsgT-1)*1.3, rc=RAINBOW[Math.floor(tsec*6)%RAINBOW.length];
        g.save(); g.translate(api.W/2,api.H*0.22); g.scale(pop,pop); g.textAlign="center"; g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1); g.font="900 40px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=8; g.lineJoin="round"; g.strokeStyle="rgba(10,30,60,.55)"; g.strokeText("にじいろ！",0,0);
        g.fillStyle="#ffffff"; g.shadowColor=rc; g.shadowBlur=16; g.fillText("にじいろ！",0,0);
        g.shadowBlur=0; g.lineJoin="miter"; g.restore(); g.globalAlpha=1; g.textAlign="left"; g.textBaseline="alphabetic"; }
      // ② きょうのラッキー色 はっけん(初回だけ大きく教える・以降は小さく)
      if(luckyMsgT>0){ const t2=luckyBig?("きょうのラッキー色は "+(GEMNAME[luckyColor]||"")+"！"):"ラッキー！";
        g.save(); g.translate(api.W/2,api.H*0.29); g.textAlign="center"; g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1); g.font="800 "+(luckyBig?23:26)+"px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=5; g.lineJoin="round"; g.strokeStyle="rgba(10,30,60,.5)"; g.strokeText(t2,0,0);
        g.fillStyle=luckyColor; g.fillText(t2,0,0);
        g.lineJoin="miter"; g.restore(); g.globalAlpha=1; g.textAlign="left"; g.textBaseline="alphabetic"; }
      // オーロラフィーバー 発見バナー(ステージクリアの帯(H*0.4〜)とは十分離し、重ならないようにする)
      if(feverBanner>0){ const pop=1+Math.max(0,feverBanner-1.2)*1.4, fc=RAINBOW[Math.floor(tsec*7)%RAINBOW.length];
        g.save(); g.translate(api.W/2,api.H*0.6); g.scale(pop,pop); g.textAlign="center"; g.textBaseline="middle";
        g.globalAlpha=clamp(feverBanner*1.3,0,1); g.font="900 30px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7; g.lineJoin="round"; g.strokeStyle="rgba(10,30,60,.6)"; g.strokeText("フィーバー！ぜんぶ2ばい！",0,0);
        g.fillStyle="#ffffff"; g.shadowColor=fc; g.shadowBlur=14; g.fillText("フィーバー！ぜんぶ2ばい！",0,0);
        g.shadowBlur=0; g.lineJoin="miter"; g.restore(); g.globalAlpha=1; g.textAlign="left"; g.textBaseline="alphabetic"; }
      // ---- stage clear banner ----
      if(clearBanner>0){ clearBanner=Math.max(0,clearBanner-0.016*dt);
        const ba=Math.min(1,clearBanner*1.6),pop=1+0.14*Math.sin(tsec*10)*ba;
        g.save(); g.translate(api.W/2,api.H*0.4); g.scale(pop,pop); g.globalAlpha=ba;
        g.font="900 46px 'Hiragino Maru Gothic ProN',system-ui"; g.textAlign="center"; g.lineJoin="round";
        g.lineWidth=10; g.strokeStyle="rgba(10,30,60,.7)"; g.strokeText(clearTxt,0,0);
        let bg=g.createLinearGradient(0,-28,0,28);
        bg.addColorStop(0,"#ffffff"); bg.addColorStop(0.5,"#bfeaff"); bg.addColorStop(1,"#7be0ff");
        g.fillStyle=bg; g.fillText(clearTxt,0,0);
        g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui"; g.fillStyle="#eafaff";
        g.fillText("つぎは ステージ "+(stage+1)+"！",0,42);
        g.globalAlpha=1; g.lineJoin="miter"; g.restore(); g.textAlign="left"; }
      // 白飛び防止の保険: フレーム終わりで加算合成を必ず通常に戻す
      g.globalCompositeOperation="source-over"; g.globalAlpha=1; g.shadowBlur=0;
    },
    stop(){}
  };
  // --- drawing ---
  function drawIce(c){
    // ⑦ 形のバラエティ: 当たり判定・グリッド座標(c.x,c.y,S)は変えず、見た目の描画サイズ/形だけ shape で変える
    let x=c.x,y=c.y,s=S;
    if(c.shape===2){ const bs=s*1.75; x=c.x-(bs-s)/2; y=c.y-(bs-s)/2; s=bs; }
    // ① にじいろ氷は虹色に色が回る/② 宝石こおりは col0 の鮮やかな色
    let base=c.col0;
    if(c.rainbow) base=RAINBOW[Math.floor(tsec*3+c.col+c.row)%RAINBOW.length];
    const wob=c.wob*Math.sin(tsec*40)*2;
    g.save();
    if(c.wob>0)g.translate(wob,0);
    if(c.shape===1){ roundRectPath(g,x,y,s,s,Math.max(0,s*0.26)); g.clip(); } // 角丸の丸氷: 以降の描画を丸くクリップ
    // drop shadow
    g.fillStyle="rgba(20,50,80,.28)"; g.fillRect(x+3,y+4,s,s);
    // ※氷ブロックは手描きのまま(生成画像は床影/欠け/縁の残りが直らず不採用。色分け仕掛けも手描きで無傷)
    // body gradient (translucent ice)
    let bg=g.createLinearGradient(x,y,x+s*0.4,y+s);
    bg.addColorStop(0,shade(base,40)); bg.addColorStop(0.55,base); bg.addColorStop(1,shade(base,-25));
    g.fillStyle=bg; g.fillRect(x,y,s,s);
    // bright top-left facets
    g.fillStyle="rgba(255,255,255,.4)";
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+s,y); g.lineTo(x+s-7,y+7); g.lineTo(x+7,y+7); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+7,y+7); g.lineTo(x+7,y+s-7); g.lineTo(x,y+s); g.closePath(); g.fill();
    // dark bottom-right facets
    g.fillStyle="rgba(20,60,100,.26)";
    g.beginPath(); g.moveTo(x+s,y); g.lineTo(x+s,y+s); g.lineTo(x+s-7,y+s-7); g.lineTo(x+s-7,y+7); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x,y+s); g.lineTo(x+s,y+s); g.lineTo(x+s-7,y+s-7); g.lineTo(x+7,y+s-7); g.closePath(); g.fill();
    // diagonal shine streak
    g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=0.5;
    g.strokeStyle="rgba(255,255,255,.9)"; g.lineWidth=Math.max(2,s*0.06);
    g.beginPath(); g.moveTo(x+s*0.2,y+s*0.85); g.lineTo(x+s*0.85,y+s*0.2); g.stroke();
    g.beginPath(); g.moveTo(x+s*0.5,y+s*0.9); g.lineTo(x+s*0.9,y+s*0.5); g.stroke();
    g.restore(); g.globalAlpha=1;
    // glossy highlight blob
    g.globalAlpha=0.55; g.fillStyle="rgba(255,255,255,.85)";
    g.beginPath(); g.ellipse(x+s*0.3,y+s*0.26,Math.max(0,s*0.18),Math.max(0,s*0.09),-0.5,0,TAU); g.fill(); g.globalAlpha=1;
    // ③ 生き物シルエット氷: 氷にとじこめられたペンギン/さかな/かに/ひとでのかげ(壊す対象のバラエティ)
    if(c.shape===3){
      g.save(); g.globalAlpha=0.55; g.fillStyle="rgba(15,35,65,.55)";
      const cx=x+s*0.5, cy=y+s*0.58;
      if(c.sil==="fish"){
        g.beginPath(); g.ellipse(cx,cy,Math.max(0,s*0.28),Math.max(0,s*0.16),0,0,TAU); g.fill();
        g.beginPath(); g.moveTo(cx-s*0.26,cy); g.lineTo(cx-s*0.42,cy-s*0.13); g.lineTo(cx-s*0.42,cy+s*0.13); g.closePath(); g.fill();
      } else if(c.sil==="penguin"){
        g.beginPath(); g.ellipse(cx,cy+s*0.06,Math.max(0,s*0.2),Math.max(0,s*0.27),0,0,TAU); g.fill();
        g.beginPath(); g.arc(cx,cy-s*0.28,Math.max(0,s*0.13),0,TAU); g.fill();
        g.fillStyle="rgba(255,200,90,.6)";
        g.beginPath(); g.moveTo(cx,cy-s*0.26); g.lineTo(cx+s*0.14,cy-s*0.2); g.lineTo(cx,cy-s*0.16); g.closePath(); g.fill();
      } else if(c.sil==="crab"){
        // body + claws + legs (かにのシルエット)
        g.beginPath(); g.ellipse(cx,cy,Math.max(0,s*0.24),Math.max(0,s*0.15),0,0,TAU); g.fill();
        g.beginPath(); g.arc(cx-s*0.32,cy-s*0.1,Math.max(0,s*0.1),0,TAU); g.fill();
        g.beginPath(); g.arc(cx+s*0.32,cy-s*0.1,Math.max(0,s*0.1),0,TAU); g.fill();
        g.strokeStyle="rgba(15,35,65,.55)"; g.lineWidth=Math.max(1,s*0.035); g.lineCap="round";
        for(const dx of[-1,1]){
          g.beginPath(); g.moveTo(cx+dx*s*0.18,cy+s*0.08); g.lineTo(cx+dx*s*0.34,cy+s*0.2); g.stroke();
          g.beginPath(); g.moveTo(cx+dx*s*0.14,cy+s*0.14); g.lineTo(cx+dx*s*0.28,cy+s*0.27); g.stroke();
        }
      } else {
        // starfish (ひとで)
        const spikes=5,outerR=Math.max(0,s*0.28),innerR=Math.max(0,s*0.12);
        g.beginPath();
        for(let i=0;i<spikes*2;i++){
          const rr=i%2===0?outerR:innerR, ang=-Math.PI/2+i*Math.PI/spikes;
          const px=cx+Math.cos(ang)*rr, py=cy+Math.sin(ang)*rr;
          if(i===0)g.moveTo(px,py); else g.lineTo(px,py);
        }
        g.closePath(); g.fill();
      }
      g.restore(); g.globalAlpha=1;
    }
    // neon edge
    g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=0.3+0.12*Math.sin(tsec*2+c.col+c.row*0.6);
    g.lineWidth=2; g.strokeStyle="#dff4ff"; g.shadowBlur=6; g.shadowColor="#9fdcff";
    g.strokeRect(x+1.5,y+1.5,s-3,s-3); g.restore();
    // ② 宝石こおり: 中心にきらめく小さな星(色ではっきり見分けられる)
    if(c.gem){ g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=0.4+0.3*Math.sin(tsec*3+c.col+c.row);
      g.fillStyle=base; g.beginPath(); g.arc(x+s*0.5,y+s*0.5,s*0.13,0,TAU); g.fill();
      g.restore(); g.globalAlpha=1; }
    // ① にじいろ氷: 虹の光の縁取りで目立たせる(発見のドキドキ)
    if(c.rainbow){ g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=0.3+0.22*Math.sin(tsec*4+c.col);
      g.lineWidth=3; g.strokeStyle=base; g.shadowBlur=10; g.shadowColor=base;
      g.strokeRect(x+2,y+2,s-4,s-4); g.restore(); g.globalAlpha=1; g.shadowBlur=0; }
    // ⑦ 大氷(shape===2): 金色に光る太い縁取りで「大きい」だけでなく「特別」なのが一目で分かるようにする
    if(c.shape===2){ g.save(); g.globalCompositeOperation="lighter"; g.globalAlpha=0.5+0.25*Math.sin(tsec*2.4+c.col);
      g.lineWidth=Math.max(3,s*0.05); g.strokeStyle="#ffd23f"; g.shadowBlur=12; g.shadowColor="#ffd23f";
      g.strokeRect(x+3,y+3,s-6,s-6); g.restore(); g.globalAlpha=1; g.shadowBlur=0; }
    // hard block: frosty bevel + crack when chipped
    if(c.hard){
      g.fillStyle="rgba(230,242,255,.85)"; const rr=Math.max(2,s*0.06);
      [[x+s*0.2,y+s*0.2],[x+s*0.8,y+s*0.2],[x+s*0.2,y+s*0.8],[x+s*0.8,y+s*0.8]].forEach(p=>{g.beginPath();g.arc(p[0],p[1],rr,0,TAU);g.fill();});
    }
    // crack lines once hp dropped below original
    if(c.hp<(c.hard?2:1)){
      g.strokeStyle="rgba(255,255,255,.85)"; g.lineWidth=Math.max(1.5,s*0.06); g.lineCap="round";
      g.beginPath(); g.moveTo(x+s*0.5,y+s*0.12); g.lineTo(x+s*0.4,y+s*0.42); g.lineTo(x+s*0.6,y+s*0.6); g.lineTo(x+s*0.45,y+s*0.9); g.stroke();
      g.beginPath(); g.moveTo(x+s*0.5,y+s*0.45); g.lineTo(x+s*0.8,y+s*0.55); g.stroke();
    }
    g.restore();
  }
  // アイスピック: 先端(x,y)を軸に振り下ろす。画像があればそれを、無ければ簡単な手描き
  function drawPick(x,y,ang,al){
    const s=S||40;
    g.save(); g.translate(x,y); g.rotate(ang); g.globalAlpha=al;
    // 画像ピック(頭が上・柄が下・先端は画像の右上寄り 約(+0.19,-0.22)/辺)。先端が回転軸(0,0)に来るよう中心をずらし、
    // 左半分タップ時は左右反転して先端が内側を向くようにする(当たり判定・操作は変わらない)
    const pd=s*2.4, flip=axe.side<0;
    if(api.drawAsset("pick.png",-pd*0.186*(flip?-1:1),pd*0.217,pd,pd,{center:true,flip:flip})){ g.restore(); g.globalAlpha=1; return; }
    // handle (down-right from the tip)
    g.strokeStyle="#22335a"; g.lineWidth=Math.max(3,s*0.16); g.lineCap="round";
    g.beginPath(); g.moveTo(0,s*0.15); g.lineTo(0,s*1.7); g.stroke();
    g.strokeStyle="rgba(255,255,255,.35)"; g.lineWidth=Math.max(1,s*0.05);
    g.beginPath(); g.moveTo(-s*0.03,s*0.3); g.lineTo(-s*0.03,s*1.55); g.stroke();
    // curved steel head
    g.strokeStyle="#ff8c2a"; g.lineWidth=Math.max(4,s*0.2);
    g.beginPath(); g.moveTo(-s*0.05,0); g.quadraticCurveTo(s*0.35,-s*0.5,s*0.95,s*0.1); g.stroke();
    g.beginPath(); g.moveTo(s*0.05,0); g.quadraticCurveTo(-s*0.3,-s*0.35,-s*0.6,s*0.1); g.stroke();
    g.strokeStyle="rgba(255,240,200,.6)"; g.lineWidth=Math.max(1.5,s*0.06);
    g.beginPath(); g.moveTo(0,-s*0.08); g.quadraticCurveTo(s*0.35,-s*0.5,s*0.85,s*0.02); g.stroke();
    g.restore(); g.globalAlpha=1;
  }
  // ⑦ 角丸の丸氷(shape1)用: 四角い描画をそのまま丸くクリップするための下地パス
  function roundRectPath(ctx,x,y,w,h,r){
    r=Math.max(0,Math.min(r,w/2,h/2));
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
    ctx.closePath();
  }
  function chunkPts(){const n=rint(4,5),a=[];for(let i=0;i<n;i++){const ang=i/n*TAU+rnd(-0.35,0.35),rr=rnd(0.34,0.55);a.push([Math.cos(ang)*rr,Math.sin(ang)*rr]);}return a;}
  function drawChunk(p){const pts=p.pts,s=p.s;
    g.beginPath(); g.moveTo(pts[0][0]*s,pts[0][1]*s);
    for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0]*s,pts[i][1]*s); g.closePath();
    g.fillStyle=p.col; g.fill();
    g.save(); g.clip(); g.fillStyle="rgba(20,60,100,.3)";
    g.beginPath(); g.moveTo(0,-s); g.lineTo(s,s); g.lineTo(-s,s); g.closePath(); g.fill(); g.restore();
    g.lineWidth=Math.max(1,s*0.08); g.strokeStyle="rgba(255,255,255,.7)"; g.stroke();
  }
  function shade(hex,amt){let n=parseInt(hex.slice(1),16);
    let r=clamp((n>>16)+amt,0,255),gg=clamp(((n>>8)&255)+amt,0,255),bb=clamp((n&255)+amt,0,255);
    return"rgb("+r+","+gg+","+bb+")";}
}
Engine.register("icebreak", buildIcebreak);
