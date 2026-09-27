/* ショベルカーくずし (excavator)
   ユーザー提供の単体HTMLゲームを ガッシャンランド のエンジン規約に移植したもの。
   - 描画は api.g / サイズは api.W,api.H / 音は api.tone,slide,noise,boom(ミュート連動)
   - DOMのUI(ステージ/コンボ/パワー/クリア表示/移動ボタン)は全てcanvas手描きに置換
   - 操作: 画面をさわると アームが指を追う。自機は一定速度でゆっくり自動的に前進し続けるので、
     指は狙い(アーム操作)だけに専念できる(第3ラウンド改善: 旧仕様は指の左右位置で前進/後退が
     決まり、狙いを微調整するほど正味の移動が伸びない問題があったため分離した)。 */
function buildExcavator(api){
  const ctx=api.g;
  let W=api.W,H=api.H;
  let stars=[];                 // 手描きキラキラ(旧DOM星の置換)
  let pendingLoop=false, loopCount=0;   // 全クリア後に まちを作り直して エンドレス化
  // --- 旧DOM UI のシム(状態だけ保持し、描画は drawHUD が canvas で行う) ---
  const scoreEl={ set textContent(v){ api.setScore(Number(v)||0); }, get textContent(){ return score; } };
  const stNumEl={textContent:1};
  const comboNumEl={textContent:0};
  const comboBox={style:{display:'none'}};
  const feverLabel={style:{display:'none'}};
  const powerFill={style:{width:'0%',background:''}};
  const clearMsg={textContent:'',_show:false,
    classList:{add:function(){clearMsg._show=true;},remove:function(){clearMsg._show=false;}}};
  function layout(){ W=api.W; H=api.H; }
  layout();
  // ── 画像アセット(ComfyUI生成)。無ければ従来の手描きにフォールバック ──
  // ※ ufo.png は生成が2回とも情景つきで不良だったため使わない(UFOは手描きのまま)
  api.preload(["bg.jpg","excavator.png","tree.png","helicopter.png"]);
  let imgBg=false;          // このフレームで背景画像が出たか(平坦な手描き空/雲をスキップ)
  // 7〜8歳向けの手応え: 壊す対象の体力を 25% 増し(操作・当たり判定はそのまま)
  const HPM=1.25;
  // 第3ラウンド改善(軸6余地): 地面の基準線(画面高さに対する割合)。getTerrainY()とUFOビームで共有。
  const TERRAIN_BASE=0.72;
  // 画像背景のとき、面ごとの空色を薄く重ねて雰囲気を変える(1面は絵そのまま/最終面は夜)
  const STAGE_TINT=[0,0.30,0.30,0.42,0.62];




const EXCAV_SCR=()=>W*0.13;

// ── BOSS SYSTEM ──────────────────────────────────────────────
let bossSpawned=[false,false,false,false,false];
// このフレームでボスHPバーを描いたか(drawHUD側でコンボ表示のY座標をずらして重なりを避けるため)。
// frame()の描画開始時に毎回リセットし、drawBoss→drawBossHPBar呼び出し時にtrueへ。
let bossHudShown=false;
const BOSS_INFO=[
  {name:'東京タワー',type:'tokyotower',w:180},
  {name:'浅草寺',type:'temple',w:200},
  {name:'姫路城',type:'castle',w:240},
  {name:'巨大ロボット',type:'robot',w:210},
  {name:'宇宙母艦',type:'mothership',w:480},
];
function mkBossSections(type,gY){
  // 超巨大ボス: 各セクションが300-500px → 画面に足しか見えないレベル
  const C={
    tokyotower:[
      {h:380,hp:700,c:'#FF4500',d:'#CC2200'},
      {h:420,hp:800,c:'#FF4500',d:'#CC2200'},
      {h:460,hp:850,c:'#FFFFFF',d:'#CCCCCC'},
      {h:420,hp:750,c:'#FF4500',d:'#CC2200'},
      {h:360,hp:650,c:'#FF4500',d:'#CC2200'},
      {h:300,hp:550,c:'#FF6600',d:'#CC4400'},
      {h:240,hp:400,c:'#FF6600',d:'#CC4400'},
    ],
    temple:[
      {h:360,hp:3000,c:'#CC3300',d:'#991100'},
      {h:320,hp:2800,c:'#CC4400',d:'#AA2200'},
      {h:280,hp:2500,c:'#CC3300',d:'#991100'},
      {h:240,hp:2200,c:'#CC4400',d:'#AA2200'},
      {h:200,hp:1800,c:'#CC3300',d:'#991100'},
      {h:160,hp:1400,c:'#CC4400',d:'#AA2200'},
    ],
    castle:[
      {h:450,hp:4000,c:'#E8E0D0',d:'#B0A870'},
      {h:380,hp:3500,c:'#DDDAC8',d:'#A09860'},
      {h:320,hp:3000,c:'#E8E0D0',d:'#B0A870'},
      {h:260,hp:2500,c:'#DDDAC8',d:'#A09860'},
      {h:200,hp:2000,c:'#E8E0D0',d:'#B0A870'},
    ],
    robot:[
      {h:400,hp:3500,c:'#5060A0',d:'#304080'},
      {h:620,hp:5000,c:'#505060',d:'#303040'},
      {h:320,hp:2800,c:'#606070',d:'#404050'},
      {h:260,hp:2200,c:'#4080C0',d:'#206090'},
    ],
    mothership:[
      {h:200,hp:2500,c:'#707080',d:'#505060'},
      {h:300,hp:4000,c:'#606070',d:'#404050'},
      {h:200,hp:2500,c:'#808090',d:'#606070'},
    ],
  };
  const cfg=C[type]||C.tokyotower;
  let cumH=0;
  return cfg.map(s=>{
    const sec={h:s.h,hp:s.hp,maxHp:s.hp,col:s.c,dark:s.d,
      alive:true,shakeDx:0,wins:[],
      drawTopY:gY-cumH-s.h,targetTopY:gY-cumH-s.h,fallVY:0,falling:false};
    cumH+=s.h;return sec;
  });
}
function mkBoss(si,wx){
  const info=BOSS_INFO[si]||BOSS_INFO[0];
  const gY=mkGY(wx+info.w/2);
  const secs=mkBossSections(info.type,gY);
  // 低学年の集中力に対してボス総HPが重すぎた反省: 全ボスのHPを大幅に軽くする。
  // 一番早く出会うステージ1(東京タワー)は特に軽く、以降のボス(あさくさでら/姫路城/ロボット/宇宙母艦)も
  // 現実的に倒し切れる総量まで下げる(セクション構成・崩れ方・見た目は変えない)。
  // 第3ラウンド改善(軸3): 初回ボス(東京タワー)の決着が約40発前後と長すぎたため、さらに軽量化。
  const disc=si===0?0.24:0.6;
  secs.forEach(s=>{s.hp=s.maxHp=Math.round(s.hp*disc);});
  const totalH=secs.reduce((s,sec)=>s+sec.h,0);
  return{kind:'boss',bossType:info.type,bossName:info.name,stageIdx:si,
    wx,w:info.w,totalH,groundY:gY,
    col:secs[0].col,dark:secs[0].dark,roof:'#555',
    type:'concrete',sections:secs,alive:true,shakeDx:0};
}
// ステージ1だけはボスを大幅に前倒し(短い1プレイでも最初のボスに出会えるように)。
// spawnScene() 側の「ボスゾーンを避ける」判定も必ずこの関数を使って揃えること。
function bossWXFor(si){
  return si===0 ? STAGE_X[0]+1400 : STAGE_X[si]+STAGES[si].len-600;
}
function spawnAllBosses(){
  // 全ボスを最初から配置（ステージ後半に固定。ステージ1のみ前倒し）
  for(let si=0;si<5;si++){
    const bossWX=bossWXFor(si);
    worldObjs.push(mkBoss(si,bossWX));
    bossSpawned[si]=true;
  }
}
// 低学年でも「今なにと戦っているか」が読めるように、漢字を含むボス名にふりがなを添える
const BOSS_KANA={tokyotower:'とうきょうタワー',temple:'あさくさでら',castle:'ひめじじょう',robot:'ロボット',mothership:'うちゅうぼかん'};
function drawBossHPBar(obj){
  const totMax=obj.sections.reduce((s,sec)=>s+sec.maxHp,0);
  const totHP=obj.sections.filter(s=>s.alive).reduce((s,sec)=>s+sec.hp,0);
  const ratio=totHP/totMax;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(W*0.05,66,W*0.9,46);
  ctx.fillStyle='#FFEE99';ctx.font='11px Arial';ctx.textAlign='center';
  ctx.fillText(BOSS_KANA[obj.bossType]||obj.bossName,W/2,78);
  ctx.fillStyle='#FFD700';ctx.font='bold 15px Arial';ctx.textAlign='center';
  ctx.fillText('BOSS: '+obj.bossName,W/2,95);
  ctx.fillStyle='#222';ctx.fillRect(W*0.07,102,W*0.86,13);
  const g=ctx.createLinearGradient(W*0.07,0,W*0.93,0);
  g.addColorStop(0,'#FF2200');g.addColorStop(0.5,'#FF8800');g.addColorStop(1,'#FFEE00');
  ctx.fillStyle=g;ctx.fillRect(W*0.07,102,W*0.86*ratio,13);
  // Pulse when low
  if(ratio<0.3){ctx.globalAlpha=0.3+Math.abs(Math.sin(Date.now()*0.008))*0.4;
    ctx.fillStyle='#FF0000';ctx.fillRect(W*0.07,102,W*0.86*ratio,13);}
  ctx.restore();
}
function drawTokyoTower(obj,sx,gY){
  const cx=sx+obj.w/2;let cumH=0;
  obj.sections.forEach((sec,i)=>{
    if(!sec.alive){cumH+=sec.h;return;}
    const r=sec.hp/sec.maxHp,st=sec.drawTopY+(sec.shakeDx||0)*0.3;
    const pct=cumH/obj.totalH,pctT=(cumH+sec.h)/obj.totalH;
    const bw=obj.w*(0.95-pct*0.78)+6,tw=obj.w*(0.95-pctT*0.78)+6;
    ctx.save();ctx.globalAlpha=0.3+r*0.7;
    ctx.fillStyle=sec.col;
    ctx.beginPath();ctx.moveTo(cx-bw/2,st+sec.h);ctx.lineTo(cx+bw/2,st+sec.h);
    ctx.lineTo(cx+tw/2,st);ctx.lineTo(cx-tw/2,st);ctx.closePath();ctx.fill();
    ctx.strokeStyle=sec.dark;ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(cx-bw/2,st+sec.h);ctx.lineTo(cx+tw/2,st);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx+bw/2,st+sec.h);ctx.lineTo(cx-tw/2,st);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-(bw+tw)/4,st+sec.h*0.5);ctx.lineTo(cx+(bw+tw)/4,st+sec.h*0.5);ctx.stroke();
    if(i%2===1){ctx.fillStyle='rgba(255,255,255,0.2)';ctx.fillRect(cx-tw/2,st,tw,sec.h*0.35);}
    // Observation deck
    if(i===2){ctx.fillStyle='#FFFFFF';ctx.fillRect(cx-bw*0.55,st+sec.h*0.3,bw*1.1,12);}
    // Crumble
    if(r<0.6&&Math.random()<0.05){spawnHitFx(cx+(Math.random()-0.5)*bw,st+Math.random()*sec.h,sec.col,3);}
    if(r<0.35){ctx.strokeStyle='rgba(80,20,0,0.7)';ctx.lineWidth=1.5;
      for(let k=0;k<3;k++){ctx.beginPath();ctx.moveTo(cx+(Math.random()-0.5)*bw,st);
        ctx.lineTo(cx+(Math.random()-0.5)*bw*0.5,st+sec.h*0.6);ctx.stroke();}}
    ctx.restore();sec.shakeDx=(sec.shakeDx||0)*0.75;cumH+=sec.h;
  });
  const top=obj.sections.filter(s=>s.alive).pop();
  if(top){ctx.fillStyle='#FF4500';ctx.fillRect(cx-3,top.drawTopY-38,6,40);
    ctx.fillStyle='#FF0000';ctx.beginPath();ctx.arc(cx,top.drawTopY-42,5,0,Math.PI*2);ctx.fill();}
}
function drawTemple(obj,sx,gY){
  const cx=sx+obj.w/2;
  obj.sections.forEach((sec,i)=>{
    if(!sec.alive)return;
    const r=sec.hp/sec.maxHp,st=sec.drawTopY,sh=sec.h;
    const shrink=i*0.14;
    const tw=obj.w*(1-shrink),tx=cx-tw/2;
    ctx.save();ctx.globalAlpha=0.3+r*0.7;ctx.translate(sec.shakeDx||0,0);

    // 石の基壇（最下層）
    if(i===0){
      const sg=ctx.createLinearGradient(tx,st+sh*0.75,tx+tw,st+sh);
      sg.addColorStop(0,'#888880');sg.addColorStop(0.5,'#AAAAAA');sg.addColorStop(1,'#777770');
      ctx.fillStyle=sg;ctx.fillRect(tx-6,st+sh*0.72,tw+12,sh*0.28);
      // 石ブロックのライン
      ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=1;
      for(let bx=tx-6;bx<tx+tw+12;bx+=20){ctx.beginPath();ctx.moveTo(bx,st+sh*0.72);ctx.lineTo(bx,st+sh);ctx.stroke();}
      ctx.beginPath();ctx.moveTo(tx-6,st+sh*0.86);ctx.lineTo(tx+tw+12,st+sh*0.86);ctx.stroke();
    }

    // 壁（赤漆塗り）
    const wg=ctx.createLinearGradient(tx,st+sh*0.3,tx+tw,st+sh*0.75);
    wg.addColorStop(0,'#AA1800');wg.addColorStop(0.3,'#CC2200');wg.addColorStop(0.7,'#BB1800');wg.addColorStop(1,'#881000');
    ctx.fillStyle=wg;ctx.fillRect(tx,st+sh*0.3,tw,sh*(i===0?0.44:0.5));

    // 柱（等間隔）
    const nCols=Math.max(2,Math.floor(tw/30));
    for(let c=0;c<=nCols;c++){
      const cpx=tx+c*(tw/nCols);
      const cg=ctx.createLinearGradient(cpx-4,0,cpx+4,0);
      cg.addColorStop(0,'#881000');cg.addColorStop(0.4,'#EE2200');cg.addColorStop(1,'#881000');
      ctx.fillStyle=cg;ctx.fillRect(cpx-4,st+sh*0.3,8,sh*(i===0?0.44:0.5));
    }

    // 組物（肘木）- 屋根直下の木組み
    const kg=ctx.createLinearGradient(tx-4,st+sh*0.26,tx+tw+4,st+sh*0.32);
    kg.addColorStop(0,'#663300');kg.addColorStop(0.5,'#AA5500');kg.addColorStop(1,'#553300');
    ctx.fillStyle=kg;ctx.fillRect(tx-4,st+sh*0.25,tw+8,sh*0.08);

    // 屋根（本瓦葺き）
    const roofY=st+sh*0.3;
    // 屋根の本体（大きな曲線）
    const rg=ctx.createLinearGradient(cx,roofY-sh*0.25,cx,roofY+4);
    rg.addColorStop(0,'#1A1218');rg.addColorStop(0.6,'#2A2028');rg.addColorStop(1,'#111010');
    ctx.fillStyle=rg;
    ctx.beginPath();
    const ew=tw*0.7; // 軒の張り出し
    ctx.moveTo(tx-ew,roofY+4);
    // 左端の反り上がり
    ctx.quadraticCurveTo(tx-ew*0.7,roofY-4,tx-ew*0.3,roofY-sh*0.1);
    ctx.quadraticCurveTo(cx-tw*0.2,roofY-sh*0.25,cx,roofY-sh*0.26);
    ctx.quadraticCurveTo(cx+tw*0.2,roofY-sh*0.25,tx+tw+ew*0.3,roofY-sh*0.1);
    // 右端の反り上がり
    ctx.quadraticCurveTo(tx+tw+ew*0.7,roofY-4,tx+tw+ew,roofY+4);
    ctx.lineTo(tx+tw+ew,roofY+sh*0.06);ctx.lineTo(tx-ew,roofY+sh*0.06);
    ctx.closePath();ctx.fill();

    // 棟（屋根の頂上の稜線）
    ctx.fillStyle='#3A3038';ctx.fillRect(cx-tw*0.08,roofY-sh*0.26,tw*0.16,sh*0.06);

    // 瓦のライン
    ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1;
    for(let tile=0;tile<8;tile++){
      const ty2=roofY-sh*0.02+tile*sh*0.01;
      ctx.beginPath();ctx.moveTo(tx-ew+tile*8,ty2);ctx.lineTo(tx+tw+ew-tile*8,ty2);ctx.stroke();
    }

    // 破風（鬼瓦）
    ctx.fillStyle='#222';
    ctx.beginPath();ctx.arc(cx,roofY-sh*0.24,sh*0.04,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#FF8800';ctx.beginPath();ctx.arc(cx,roofY-sh*0.24,sh*0.02,0,Math.PI*2);ctx.fill();

    // 軒の金色の飾り
    ctx.strokeStyle='#CC8800';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(tx-ew,roofY+sh*0.04);ctx.lineTo(tx+tw+ew,roofY+sh*0.04);ctx.stroke();

    // 提灯（中央）
    if(i===0){
      const lanY=st+sh*0.5;
      const lg=ctx.createRadialGradient(cx,lanY,3,cx,lanY,14);
      lg.addColorStop(0,'#FFFFFF');lg.addColorStop(0.5,'#FF4400');lg.addColorStop(1,'#880000');
      ctx.fillStyle=lg;ctx.beginPath();ctx.ellipse(cx,lanY,14,18,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#AA2200';ctx.lineWidth=2;
      for(let bl=0;bl<4;bl++){ctx.beginPath();ctx.moveTo(cx-14,lanY-8+bl*5);ctx.lineTo(cx+14,lanY-8+bl*5);ctx.stroke();}
      ctx.fillStyle='#222';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText('浅草',cx,lanY+4);
    }

    // HPバー
    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(tx,st,tw,5);
    ctx.fillStyle=r>0.6?'#44DD44':r>0.3?'#FFCC00':'#FF3300';ctx.fillRect(tx,st,tw*r,5);

    if(r<0.6&&Math.random()<0.05)spawnHitFx(cx+(Math.random()-0.5)*tw,st+Math.random()*sh,'#AA2200',4);
    ctx.restore();sec.shakeDx=(sec.shakeDx||0)*0.75;
  });
}
function drawCastle(obj,sx,gY){
  const cx=sx+obj.w/2;
  obj.sections.forEach((sec,i)=>{
    if(!sec.alive)return;
    const r=sec.hp/sec.maxHp,st=sec.drawTopY,sh=sec.h;
    const shrink=i*0.16;
    const fw=obj.w*(1-shrink),fx=cx-fw/2;
    ctx.save();ctx.globalAlpha=0.3+r*0.7;ctx.translate(sec.shakeDx||0,0);

    // 石垣（最下層）
    if(i===0){
      const iH=sh*0.35;
      const ig=ctx.createLinearGradient(fx,st+sh*0.65,fx+fw,st+sh);
      ig.addColorStop(0,'#5A5A52');ig.addColorStop(0.5,'#7A7A70');ig.addColorStop(1,'#4A4A42');
      ctx.fillStyle=ig;ctx.fillRect(fx-8,st+sh*0.65,fw+16,sh*0.35);
      // 石ブロックのパターン
      ctx.strokeStyle='rgba(0,0,0,0.25)';ctx.lineWidth=1.5;
      const bw=22,bh=16;
      for(let row=0;row<3;row++){
        const offset=(row%2)*bw*0.5;
        for(let col=-1;col<(fw+16)/bw+1;col++){
          const bx=fx-8+col*bw+offset,by=st+sh*0.65+row*bh;
          ctx.beginPath();ctx.roundRect(bx+1,by+1,bw-2,bh-2,2);ctx.stroke();
        }
      }
    }

    // 白漆喰の壁
    const wg=ctx.createLinearGradient(fx,st+sh*0.28,fx+fw,st+sh*0.65);
    wg.addColorStop(0,'#F5F0E8');wg.addColorStop(0.4,'#FFFAF2');wg.addColorStop(0.8,'#E8E0D0');wg.addColorStop(1,'#D0C8B8');
    ctx.fillStyle=wg;ctx.fillRect(fx,st+sh*(i===0?0.28:0.3),fw,sh*(i===0?0.37:0.42));

    // 狭間（矢狭間・鉄砲狭間）- 壁の小窓
    const nSama=Math.max(2,Math.floor(fw/35));
    for(let s=0;s<nSama;s++){
      const smx=fx+8+s*(fw-16)/Math.max(1,nSama-1);
      const smy=st+sh*(i===0?0.42:0.44);
      ctx.fillStyle='#1A1820';
      // 縦長狭間
      ctx.beginPath();ctx.roundRect(smx-5,smy,10,sh*0.12,[2,2,0,0]);ctx.fill();
      // 横狭間
      ctx.beginPath();ctx.roundRect(smx-8,smy+sh*0.04,16,sh*0.04,1);ctx.fill();
    }

    // 窓（武者窓）
    if(fw>60){
      const muW=20,muH=sh*0.1;
      [0.25,0.75].forEach(pos=>{
        const mx=fx+fw*pos-muW/2,my=st+sh*(i===0?0.35:0.37);
        ctx.fillStyle='#1A1820';ctx.beginPath();ctx.roundRect(mx,my,muW,muH,3);ctx.fill();
        ctx.fillStyle='rgba(150,180,220,0.4)';ctx.beginPath();ctx.roundRect(mx+2,my+2,muW-4,muH-4,2);ctx.fill();
      });
    }

    // 入母屋屋根（城の特徴的な屋根）
    const roofTopY=st+sh*(i===0?0.26:0.28);
    const roofEave=fw*0.55;
    const rg=ctx.createLinearGradient(cx,roofTopY-sh*0.22,cx,roofTopY+sh*0.04);
    rg.addColorStop(0,'#0A0810');rg.addColorStop(0.5,'#1A1828');rg.addColorStop(1,'#0E0C18');
    ctx.fillStyle=rg;

    // 大屋根
    ctx.beginPath();
    ctx.moveTo(fx-roofEave,roofTopY+sh*0.03);
    ctx.quadraticCurveTo(fx-roofEave*0.6,roofTopY-sh*0.04,fx-roofEave*0.2,roofTopY-sh*0.1);
    ctx.lineTo(cx,roofTopY-sh*0.22);
    ctx.lineTo(fx+fw+roofEave*0.2,roofTopY-sh*0.1);
    ctx.quadraticCurveTo(fx+fw+roofEave*0.6,roofTopY-sh*0.04,fx+fw+roofEave,roofTopY+sh*0.03);
    ctx.lineTo(fx+fw+roofEave,roofTopY+sh*0.06);
    ctx.lineTo(fx-roofEave,roofTopY+sh*0.06);
    ctx.closePath();ctx.fill();

    // 小屋根（破風）- 中央に三角の妻側
    ctx.fillStyle='#12101E';
    ctx.beginPath();ctx.moveTo(cx-fw*0.22,roofTopY+sh*0.03);ctx.lineTo(cx,roofTopY-sh*0.12);
    ctx.lineTo(cx+fw*0.22,roofTopY+sh*0.03);ctx.closePath();ctx.fill();

    // 棟・鴟尾（しびき）
    ctx.fillStyle='#111018';ctx.fillRect(cx-fw*0.06,roofTopY-sh*0.22,fw*0.12,sh*0.04);
    // 鯱（最上層のみ）
    if(!obj.sections.slice(obj.sections.indexOf(sec)+1).some(s=>s.alive)){
      // 金のシャチホコ
      const shX=cx,shY=roofTopY-sh*0.24;
      ctx.fillStyle='#FFD700';
      ctx.save();ctx.translate(shX-fw*0.06,shY);
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(8,-12);ctx.lineTo(5,-8);ctx.lineTo(14,-18);ctx.lineTo(10,-10);ctx.lineTo(16,-6);ctx.lineTo(8,0);ctx.closePath();ctx.fill();
      ctx.translate(fw*0.12,0);ctx.scale(-1,1);
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(8,-12);ctx.lineTo(5,-8);ctx.lineTo(14,-18);ctx.lineTo(10,-10);ctx.lineTo(16,-6);ctx.lineTo(8,0);ctx.closePath();ctx.fill();
      ctx.restore();
    }

    // 瓦ライン
    ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=1;
    for(let t=0;t<5;t++){
      const ty2=roofTopY-sh*0.18+t*sh*0.04;
      ctx.beginPath();ctx.moveTo(fx-roofEave+t*4,ty2);ctx.lineTo(fx+fw+roofEave-t*4,ty2);ctx.stroke();
    }

    // 懸魚（けぎょ）- 破風中央の飾り
    ctx.fillStyle='#FFD700';ctx.beginPath();ctx.arc(cx,roofTopY-sh*0.08,4,0,Math.PI*2);ctx.fill();

    // HPバー
    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(fx,st,fw,5);
    ctx.fillStyle=r>0.6?'#44DD44':r>0.3?'#FFCC00':'#FF3300';ctx.fillRect(fx,st,fw*r,5);

    if(r<0.6&&Math.random()<0.05)spawnHitFx(cx+(Math.random()-0.5)*fw,st+Math.random()*sh,'#E8E0D0',4);
    ctx.restore();sec.shakeDx=(sec.shakeDx||0)*0.75;
  });
}
function drawRobot(obj,sx,gY){
  const cx=sx+obj.w/2;const secs=obj.sections;
  secs.forEach((sec,i)=>{
    if(!sec.alive)return;
    const r=sec.hp/sec.maxHp,st=sec.drawTopY;
    ctx.save();ctx.globalAlpha=0.3+r*0.7;ctx.translate(sec.shakeDx||0,0);
    ctx.fillStyle=sec.col;
    if(i===0){// legs
      ctx.fillRect(cx-55,st,42,sec.h);ctx.fillRect(cx+13,st,42,sec.h);
      ctx.fillStyle=sec.dark;ctx.fillRect(cx-55,st,42,10);ctx.fillRect(cx+13,st,42,10);
      ctx.fillStyle='#808898';ctx.fillRect(cx-40,st+sec.h-15,28,15);ctx.fillRect(cx+12,st+sec.h-15,28,15);
    } else if(i===1){// torso
      ctx.beginPath();ctx.roundRect(cx-obj.w*0.42,st,obj.w*0.84,sec.h,8);ctx.fill();
      ctx.fillStyle='#2060FF';ctx.fillRect(cx-22,st+18,44,28);
      ctx.fillStyle='#80EEFF';ctx.beginPath();ctx.arc(cx,st+32,11,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=sec.col;ctx.fillRect(cx-obj.w*0.44-24,st+8,24,sec.h*0.65);ctx.fillRect(cx+obj.w*0.44,st+8,24,sec.h*0.65);
      ctx.fillStyle='#FF3300';ctx.fillRect(cx-obj.w*0.44-28,st+sec.h*0.5,28,12);ctx.fillRect(cx+obj.w*0.44,st+sec.h*0.5,28,12);
    } else if(i===2){// shoulders
      ctx.fillRect(cx-obj.w*0.46,st,obj.w*0.92,sec.h);
      ctx.fillStyle='#FF2200';ctx.fillRect(cx-obj.w*0.42,st+6,20,9);ctx.fillRect(cx+obj.w*0.42-20,st+6,20,9);
    } else {// head
      ctx.beginPath();ctx.roundRect(cx-32,st,64,sec.h,10);ctx.fill();
      ctx.fillStyle=sec.dark;ctx.fillRect(cx-24,st+sec.h*0.6,48,sec.h*0.25);
      const eyeC=r<0.4?'#FF0000':r<0.7?'#FF6600':'#FF4400';
      ctx.fillStyle=eyeC;ctx.globalAlpha*=(0.6+Math.abs(Math.sin(Date.now()*0.012))*0.4);
      ctx.beginPath();ctx.ellipse(cx-14,st+sec.h*0.38,10,6,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(cx+14,st+sec.h*0.38,10,6,0,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=0.3+r*0.7;
      ctx.fillStyle='#888';ctx.fillRect(cx-5,st,10,8);
    }
    if(r<0.6&&Math.random()<0.05)spawnHitFx(cx+(Math.random()-0.5)*obj.w*0.8,st+Math.random()*sec.h,'#8888AA',4);
    if(r<0.35){ctx.strokeStyle='rgba(30,30,60,0.7)';ctx.lineWidth=2;
      for(let k=0;k<2;k++){ctx.beginPath();ctx.moveTo(cx+(Math.random()-0.5)*obj.w*0.8,st);
        ctx.lineTo(cx+(Math.random()-0.5)*obj.w*0.5,st+sec.h);ctx.stroke();}}
    ctx.restore();sec.shakeDx=(sec.shakeDx||0)*0.75;
  });
}
function drawMothership(obj,sx,gY){
  const cx=sx+obj.w/2;
  obj.sections.forEach((sec,i)=>{
    if(!sec.alive)return;
    const r=sec.hp/sec.maxHp,st=sec.drawTopY;
    const ry=sec.h*0.48;const rx=obj.w*(i===1?0.5:0.36);
    ctx.save();ctx.globalAlpha=0.3+r*0.7;ctx.translate(sec.shakeDx||0,0);
    const g2=ctx.createRadialGradient(cx,st+ry,5,cx,st+ry,rx);
    g2.addColorStop(0,'#A0A0B8');g2.addColorStop(1,sec.col);
    ctx.fillStyle=g2;ctx.beginPath();ctx.ellipse(cx,st+ry,rx,ry,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=sec.dark;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(cx,st+ry,rx,ry,0,0,Math.PI*2);ctx.stroke();
    const t=Date.now()*0.004+i;const ln=8+i*3;
    for(let l=0;l<ln;l++){
      const a=l/ln*Math.PI*2+t;
      ctx.fillStyle=['#FF4040','#40FF40','#4040FF','#FFFF40','#FF40FF'][l%5];
      ctx.globalAlpha=(0.5+Math.sin(t+l)*0.5)*(0.3+r*0.7);
      ctx.beginPath();ctx.arc(cx+Math.cos(a)*rx*0.9,st+ry+Math.sin(a)*ry*0.6,5,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=0.3+r*0.7;
    if(i===1){ctx.fillStyle='#80FF80';ctx.globalAlpha=0.12;
      ctx.fillRect(cx-16,st+ry*1.9,32,gY-(st+ry*1.9));}
    if(r<0.6&&Math.random()<0.05)spawnHitFx(cx+(Math.random()-0.5)*rx*1.5,st+Math.random()*ry*2,'#8080BB',4);
    if(r<0.35){ctx.strokeStyle='rgba(40,40,80,0.7)';ctx.lineWidth=2;
      for(let k=0;k<2;k++){ctx.beginPath();ctx.moveTo(cx+(Math.random()-0.5)*rx,st);
        ctx.lineTo(cx+(Math.random()-0.5)*rx*0.5,st+ry*2);ctx.stroke();}}
    ctx.restore();sec.shakeDx=(sec.shakeDx||0)*0.75;
  });
}
function drawBoss(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx);if(sx>W+80||sx+obj.w<-80)return;
  const gY=toSY(obj.groundY);
  switch(obj.bossType){
    case 'tokyotower':drawTokyoTower(obj,sx,gY);break;
    case 'temple':drawTemple(obj,sx,gY);break;
    case 'castle':drawCastle(obj,sx,gY);break;
    case 'robot':drawRobot(obj,sx,gY);break;
    case 'mothership':drawMothership(obj,sx,gY);break;
  }
  bossHudShown=true;
  drawBossHPBar(obj);
  if(obj.sections.every(s=>!s.alive)){
    obj.alive=false;addScore(1500);spawnStar(sx+obj.w/2,gY-120);playExplode();addShake(25);
  }
}

// 前方に生き残っているオブジェクトがあれば進めない（主要オブジェクトのみ）
const BLOCKING_KINDS=new Set(['building','megabuilding','watertower','house','boss']);
// 前をふさぐ建物に押しあて続けたときの自動掘削(進行不能を防ぐ保険)
let stuckT=0, assistCD=0, idleT=0, assisting=false;
function assistBreak(){
  if(assistCD>0){ assistCD--; return; }
  let target=null,best=Infinity;
  for(let i=0;i<worldObjs.length;i++){const o=worldObjs[i];
    if(!o.alive||!BLOCKING_KINDS.has(o.kind))continue;
    if(o.wx>exWorldX+20&&o.wx<best){best=o.wx;target=o;}}
  if(!target)return;
  assistCD=(target.kind==='boss')?5:8;
  const sx=toS(target.wx),gY=toSY(target.groundY);
  // ボス戦は合計HPが大きいので、詰まったときの保険(自動掘削)が早めに効くようダメージを1.5倍にする
  const dmg=(feverActive?70:26)*(target.kind==='boss'?1.5:1);
  if(target.sections&&target.sections.length){
    let sec=null;
    for(let i=0;i<target.sections.length;i++){ if(target.sections[i].alive){sec=target.sections[i];break;} }
    if(!sec)return;
    sec.hp=Math.max(0,sec.hp-dmg); sec.shakeDx=(rng()-0.5)*12;
    spawnHitFx(sx+target.w/2,gY-20,target.col||'#CCC',10);
    addScore(6); playHit(false); addShake(5);
    if(sec.hp<=0){ sec.alive=false;
      spawnFrag(sx,gY-target.h*0.5,target.w,sec.h||30,[target.col||'#CCC','#AAA','#888'],1.0);
      addShake(12);
      if(target.sections.every(function(s){return !s.alive;})){
        target.alive=false; addScore(80); spawnStar(sx+target.w/2,gY-40); playExplode(); assisting=false; }
    }
  }else{
    target.hp=(target.hp||30)-dmg;
    spawnHitFx(sx+target.w/2,gY-20,target.col||'#CCC',10);
    addScore(6); playHit(false); addShake(5);
    if(target.hp<=0){ target.alive=false; addScore(60); spawnStar(sx+target.w/2,gY-40); playExplode(); assisting=false; }
  }
}
function getForwardBlockX(){
  let minBlock=Infinity;
  worldObjs.forEach(obj=>{
    if(!obj.alive)return;
    if(!BLOCKING_KINDS.has(obj.kind))return; // 小物・フェンスはブロックしない
    if(obj.wx>exWorldX+80){
      minBlock=Math.min(minBlock,obj.wx);
    }
  });
  return minBlock===Infinity?Infinity:minBlock-100;
}

// ── RNG ──────────────────────────────────────────────────────
let _s=42;
function rng(){_s|=0;_s=_s+0x6D2B79F5|0;let t=Math.imul(_s^_s>>>15,1|_s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}

// ── AUDIO ─────────────────────────────────────────────────────
function initAudio(){}
function beep(freq,dur,type,vol,fEnd){
  if(fEnd) api.slide(freq,Math.max(fEnd,20),dur,(vol||0.3)*0.5,type==='sawtooth'?'sawtooth':(type||'sine'));
  else api.tone(freq,dur,type||'sine',(vol||0.3)*0.5);
}
function playHit(hard){ if(hard) api.noise(0.12,0.22,900,'lowpass',0.8); beep(hard?280:160,0.14,'sawtooth',hard?0.32:0.2,30); }
function playExplode(){ api.boom(0.5); }
function playPop(){ beep(900,0.06,'sine',0.35,80); }
function playFever(){ api.boom(0.55); [440,550,660,880].forEach(function(f,i){setTimeout(function(){api.tone(f,0.12,'square',0.16);},i*90);}); }
function playStageClear(){ api.boom(0.6); [523,659,784,1047].forEach(function(f,i){setTimeout(function(){api.tone(f,0.2,'triangle',0.2);},i*120);}); }

// ── TERRAIN / STAGES ──────────────────────────────────────────
const STAGES=[
  { name:'ステージ1', sub:'郊外', len:2600,
    sky:['#87CEEB','#B3E5FC'], gCol:'#4A8A22', dCol:'#7A5C10',
    ter:[[0,0],[500,0],[800,-60],[1200,-55],[1500,0],[2000,0],[2300,-70],[2700,-65],[3000,0],[3500,30],[4000,0]] },
  { name:'ステージ2', sub:'丘陵地帯', len:4500,
    sky:['#FF9966','#FFD580'], gCol:'#5A9A28', dCol:'#8A6A18',
    ter:[[0,0],[300,-80],[700,-75],[1000,50],[1400,45],[1700,-110],[2100,-105],[2500,70],[2900,65],[3200,-80],[3600,-75],[4000,30],[4500,0]] },
  { name:'ステージ3', sub:'山岳地帯', len:5000,
    sky:['#6090C0','#90B8E0'], gCol:'#3A6A18', dCol:'#5A3C08',
    ter:[[0,0],[200,-40],[500,-130],[900,-125],[1200,30],[1500,25],[1800,-150],[2200,-145],[2600,90],[3000,85],[3300,-120],[3700,-115],[4100,40],[4500,-80],[5000,0]] },
  { name:'ステージ4', sub:'工場地帯', len:4500,
    sky:['#607080','#9098A8'], gCol:'#585850', dCol:'#484840',
    ter:[[0,0],[400,-50],[700,-110],[1000,-105],[1300,-40],[1600,-35],[1900,60],[2200,55],[2500,-80],[2900,-130],[3300,-125],[3600,-50],[3900,0],[4500,0]] },
  { name:'ステージ5', sub:'最終決戦', len:5500,
    sky:['#1A0A3A','#3A1A6A'], gCol:'#3A285A', dCol:'#2A1840',
    ter:[[0,0],[300,-60],[600,-140],[900,-135],[1200,80],[1500,75],[1800,-160],[2200,-155],[2600,100],[3000,95],[3400,-140],[3800,-135],[4200,80],[4600,-80],[5000,-120],[5500,0]] },
];
const STAGE_X=[];
(function(){let x=0;STAGES.forEach((s,i)=>{STAGE_X[i]=x;x+=s.len;})})();
const TOTAL_LEN=STAGE_X[4]+STAGES[4].len;

function cosLerp(a,b,t){const f=(1-Math.cos(t*Math.PI))*0.5;return a+(b-a)*f;}

function getStageIdx(wx){
  for(let i=STAGES.length-1;i>=0;i--)if(wx>=STAGE_X[i])return i;
  return 0;
}

function getTerrainY(wx){
  const si=getStageIdx(wx);
  const s=STAGES[si];
  const lx=wx-STAGE_X[si];
  const pts=s.ter;
  let p0=pts[0],p1=pts[pts.length-1];
  for(let i=0;i<pts.length-1;i++){
    if(lx>=pts[i][0]&&lx<=pts[i+1][0]){p0=pts[i];p1=pts[i+1];break;}
  }
  const t=Math.max(0,Math.min(1,(lx-p0[0])/Math.max(1,p1[0]-p0[0])));
  // 第3ラウンド改善(軸6余地): 地面の基準線を下げ、装飾のない下部の空白帯を減らして
  // 標的/自機がより縦方向を使うようにする(0.63→0.72。HUD下部のパワーバーとは干渉しない範囲)。
  return H*TERRAIN_BASE+cosLerp(p0[1],p1[1],t);
}

function getSlopeAngle(wx){
  const d=20;
  return Math.atan2(getTerrainY(wx+d)-getTerrainY(wx-d),d*2);
}

// ── STATE ─────────────────────────────────────────────────────
let score=0,power=0,feverActive=false,feverTimer=0;
let camX=0,camY=0,exWorldX=80;
let particles=[],fragments=[],smokes=[],shockwaves=[],worldObjs=[],flyingObjs=[],clouds=[];
let nextSpawnX=250;
let hitCD=0;
let fingerX=-999,fingerY=-999,armTouching=false,moveLeft=false,moveRight=false;
let currentStage=0,stageClearing=false,stageClearTimer=0;
let comboCount=0,comboTimer=0;
const MOVE_SPEED=5.5;
const toS=wx=>wx-camX;
const toSY=wy=>wy-camY;

// ── 隠し発見レイヤー(クレーン/ハンマー/トラックと同じ思想) ──────────
// ① にじいろジェム: たまに1個だけ空に浮かぶ激レア。バケットで割ると虹の大盤振る舞い+大量得点。
// ② きょうのラッキー色: セッションで1色を秘密に選ぶ。その色の車をこわすと小ボーナス+頭上に星のキラッ。
// ③ パーフェクト区間: おたすけ自動掘削を使わず自力でゴールしたらボーナス。
// ④ おひさま/おつきさま タップ: 空の太陽(夜は月)にさわると ウインク+きらめき(減点なし)。
const LUCKY_POOL=[{c:'#E03030',n:'あか'},{c:'#3060E0',n:'あお'},{c:'#30A030',n:'みどり'},{c:'#E0A020',n:'きいろ'},{c:'#A030A0',n:'むらさき'}];
const _lp=pick(LUCKY_POOL);
let luckyColor=_lp.c, luckyName=_lp.n, luckySeen=false, luckyMsgT=0;   // ②
let rbMsgT=0;              // ① にじいろジェム 発見バナー
let perfectMsgT=0;        // ③ パーフェクト区間 祝福バナー
let stageUsedAssist=false;// この区間で おたすけ自動掘削 を使ったか
let sunWinkT=0;           // ④ おひさま/おつきさま タップの目パチ
const sunScreen={x:0,y:0,r:0};   // ④ 太陽/月の画面上の当たり判定(drawSunMoonで確定)

// ── SHAKE/COMBO/POWER ──────────────────────────────────────────
let shakeX=0,shakeY=0;
function addShake(a){shakeX+=(rng()-0.5)*a;shakeY+=(rng()-0.5)*a*0.6;}
function addPower(n){
  if(feverActive)return;
  power=Math.min(1,power+n);
  powerFill.style.width=(power*100)+'%';
  if(power>=1){activateFever();}
}
function activateFever(){
  feverActive=true;feverTimer=480;power=1;
  feverLabel.style.display='block';
  playFever();addShake(20);
  powerFill.style.background='linear-gradient(90deg,#FF00FF,#FFFF00)';
}
function updateFever(dt){
  if(!feverActive)return;
  feverTimer-=dt;
  if(feverTimer<=0){
    feverActive=false;power=0;
    feverLabel.style.display='none';
    powerFill.style.width='0%';
    powerFill.style.background='linear-gradient(90deg,#FF6600,#FFD700)';
  }
}
function addCombo(){
  comboCount++;comboTimer=80;
  if(comboCount>=2){
    comboBox.style.display='block';
    comboNumEl.textContent=comboCount;
  }
}
function resetCombo(){comboCount=0;comboBox.style.display='none';}
function addScore(n){
  const m=feverActive?3:comboCount>=8?2:1;
  score+=n*m;scoreEl.textContent=score;
  addPower(n*0.0007);
  idleT=0;   // 何か壊せている間は「やさしさ自動掘削」を出さない
}

// ── ARM (3-joint FABRIK) ─────────────────────────────────────
const SEG=[92,78,62],BKT=48;
const SEG_TOTAL=SEG[0]+SEG[1]+SEG[2];
let smoothTX=300,smoothTY=400,fabPts=null;

function pivScreen(){
  const wx=exWorldX+40,gy=toSY(getTerrainY(wx)),ang=getSlopeAngle(wx),sx=toS(wx);
  const lx=8,ly=-50;
  return{x:sx+lx*Math.cos(ang)-ly*Math.sin(ang),y:gy+lx*Math.sin(ang)+ly*Math.cos(ang)};
}
function runFABRIK(tx,ty){
  const pv=pivScreen();
  let dx=tx-pv.x,dy=ty-pv.y,d=Math.hypot(dx,dy);
  const mx=SEG_TOTAL+BKT-4,mn=22;
  if(d>mx){const s=mx/d;tx=pv.x+dx*s;ty=pv.y+dy*s;}
  else if(d<mn){const s=mn/Math.max(d,0.01);tx=pv.x+dx*s;ty=pv.y+dy*s;}
  if(!fabPts){
    fabPts=[pv,{x:pv.x+SEG[0]*0.6,y:pv.y-SEG[0]*0.5},
               {x:pv.x+SEG[0]+SEG[1]*0.5,y:pv.y-SEG[1]*0.3},
               {x:tx,y:ty}];
  } else { fabPts[0]=pv; }
  for(let it=0;it<10;it++){
    fabPts[3]={x:tx,y:ty};
    for(let i=2;i>=0;i--){
      const dx2=fabPts[i].x-fabPts[i+1].x,dy2=fabPts[i].y-fabPts[i+1].y;
      const d2=Math.max(0.01,Math.hypot(dx2,dy2)),lm=SEG[i]/d2;
      fabPts[i]={x:fabPts[i+1].x+dx2*lm,y:fabPts[i+1].y+dy2*lm};
    }
    fabPts[0]=pv;
    for(let i=0;i<3;i++){
      const dx2=fabPts[i+1].x-fabPts[i].x,dy2=fabPts[i+1].y-fabPts[i].y;
      const d2=Math.max(0.01,Math.hypot(dx2,dy2)),lm=SEG[i]/d2;
      fabPts[i+1]={x:fabPts[i].x+dx2*lm,y:fabPts[i].y+dy2*lm};
    }
  }
  return fabPts;
}
function updateArmTarget(){
  const tx=armTouching&&fingerX>0?fingerX-shakeX:toS(exWorldX)+220;
  const ty=armTouching&&fingerY>0?fingerY-shakeY:toSY(getTerrainY(exWorldX+40))-70;
  smoothTX+=(tx-smoothTX)*0.22;smoothTY+=(ty-smoothTY)*0.22;
}
function getTip(){
  const pts=runFABRIK(smoothTX,smoothTY);
  const j3=pts[3];
  const dx=smoothTX-j3.x,dy=smoothTY-j3.y,d=Math.max(1,Math.hypot(dx,dy));
  return{x:j3.x+dx/d*BKT,y:j3.y+dy/d*BKT+BKT*0.3,pts};
}

// ── OBJECT CONSTRUCTORS ───────────────────────────────────────
const BCOLS=[
  ['#E8C87C','#C89040','#A06010','brick',1.4],['#B0D8F0','#78B0D8','#5090B8','glass',0.55],
  ['#C8C8C8','#A0A0A0','#808080','concrete',2.0],['#F7C59F','#D78058','#B05830','brick',1.1],
  ['#C3B1E1','#9068C0','#7050A0','glass',0.6],['#FF9999','#D05050','#A03030','brick',1.0],
  ['#FFD580','#E0A030','#C07810','concrete',1.8],['#A8E8A8','#68C068','#40A040','brick',0.9],
];

function mkGY(wx){return getTerrainY(wx);}

function mkBuilding(wx,hm=1){
  const cs=BCOLS[Math.floor(rng()*BCOLS.length)];
  const bw=50+rng()*55,tot=(90+rng()*200)*hm;
  const gY=mkGY(wx+bw/2),nSec=2+Math.floor(rng()*3);
  const secs=[];let rem=tot;
  for(let i=0;i<nSec;i++){
    const last=i===nSec-1,h=last?rem:Math.round(rem*(0.25+rng()*0.35));
    rem-=h;const hp=(65+rng()*110)*cs[4]*hm*HPM;
    const fl=Math.max(1,Math.floor(h/38)),per=Math.max(1,Math.floor((bw-14)/24));
    const wins=[];
    for(let f=0;f<fl;f++)for(let w=0;w<per;w++)wins.push({lx:8+w*24+3,ly:8+f*38+5,lit:rng()>0.4});
    secs.push({h,hp,maxHp:hp,alive:true,shakeDx:0,wins,
      drawTopY:0,targetTopY:0,fallVY:0,falling:false});
  }
  // Compute initial drawTopY from bottom up
  let cumH=0;
  for(let i=0;i<secs.length;i++){
    secs[i].drawTopY=gY-cumH-secs[i].h;
    secs[i].targetTopY=secs[i].drawTopY;
    cumH+=secs[i].h;
  }
  return{kind:'building',wx,w:bw,totalH:tot,groundY:gY,col:cs[0],dark:cs[1],roof:cs[2],type:cs[3],sections:secs,alive:true,shakeDx:0};
}
function mkCar(wx){
  const cs=['#E03030','#3060E0','#30A030','#E0A020','#909090','#A030A0'];
  const gY=mkGY(wx+40);
  return{kind:'car',wx,w:82,h:36,groundY:gY,col:cs[Math.floor(rng()*cs.length)],hp:38*HPM,maxHp:38*HPM,alive:true,vx:0,shakeDx:0,mech:true};
}
function mkBus(wx){
  const gY=mkGY(wx+55);
  return{kind:'bus',wx,w:110,h:44,groundY:gY,col:'#FFD700',hp:75*HPM,maxHp:75*HPM,alive:true,vx:0,shakeDx:0,mech:true};
}
function mkTruck(wx){
  const gY=mkGY(wx+55);
  return{kind:'truck',wx,w:120,h:50,groundY:gY,col:'#C0C0C0',hp:90*HPM,maxHp:90*HPM,alive:true,vx:0,shakeDx:0,mech:true};
}
function mkWaterTower(wx){
  const gY=mkGY(wx+25);
  return{kind:'watertower',wx,w:50,h:90+rng()*40,groundY:gY,col:'#A05030',dark:'#703818',alive:true,
    sections:[{h:42,hp:85*HPM,maxHp:85*HPM,alive:true},{h:52,hp:65*HPM,maxHp:65*HPM,alive:true}],shakeDx:0,mech:true};
}
function mkRocket(wx){
  const gY=mkGY(wx+18);
  return{kind:'rocket',wx,w:36,h:88+rng()*44,groundY:gY,col:'#C8C8C8',alive:true,hp:60*HPM,maxHp:60*HPM,shakeDx:0,mech:true};
}
function mkTree(wx){
  const gY=mkGY(wx+28);
  return{kind:'tree',wx,w:56,h:55+rng()*55,groundY:gY,trunk:12+rng()*8,col:'#228B22',dark:'#145214',trunkCol:'#8B4513',hp:(45+rng()*30)*HPM,maxHp:75*HPM,alive:true,shakeDx:0};
}
function mkCactus(wx){const gY=mkGY(wx+18);return{kind:'cactus',wx,w:36,h:48+rng()*38,groundY:gY,col:'#2E8B57',alive:true,hp:30*HPM,maxHp:30*HPM,shakeDx:0};}
function mkSnowman(wx){const gY=mkGY(wx+22);return{kind:'snowman',wx,w:44,h:72,groundY:gY,alive:true,hp:32*HPM,maxHp:32*HPM,shakeDx:0};}
function mkBarrel(wx){const gY=mkGY(wx+15);return{kind:'barrel',wx,w:30,h:40,groundY:gY,col:'#8B0000',alive:true,hp:25*HPM,maxHp:25*HPM,shakeDx:0,mech:true};}
function mkBalloon(wx){
  const cs=['#FF4040','#4040FF','#FF8C00','#40C040','#FF40C0','#40C8C8'];
  const gY=mkGY(wx+25);
  return{kind:'balloon',wx,w:50,h:70,groundY:gY,col:cs[Math.floor(rng()*cs.length)],floatH:130+rng()*80,wobble:rng()*Math.PI*2,alive:true,hp:1,maxHp:1};
}
// ① にじいろジェム: 空に ふわっと浮かぶ激レア。移動をふさがない(BLOCKING_KINDS外)。
function mkGem(wx){
  const gY=mkGY(wx+22);
  return{kind:'gem',wx,w:46,h:54,groundY:gY,floatH:110+rng()*70,wobble:rng()*Math.PI*2,alive:true,hp:1,maxHp:1};
}

function mkHouse(wx){
  const cs=[['#E8A87C','#C87850','#8B4513'],['#F7D080','#D8A040','#8B6010'],
            ['#FF9999','#D06060','#A03030'],['#B0D8F0','#78A8D0','#4880B0'],['#A8E8A8','#68C068','#308030']];
  const c=cs[Math.floor(rng()*cs.length)];
  const gY=mkGY(wx+35);
  const bh=40+rng()*25,wh=30+rng()*15; // body + roof
  const secs=[
    {h:bh,hp:(45+rng()*25)*HPM,maxHp:70*HPM,alive:true,shakeDx:0,wins:[{lx:8,ly:8,lit:true},{lx:38,ly:8,lit:rng()>0.3}],
     drawTopY:gY-bh,targetTopY:gY-bh,fallVY:0,falling:false},
    {h:wh,hp:(30+rng()*15)*HPM,maxHp:45*HPM,alive:true,shakeDx:0,wins:[],
     drawTopY:gY-bh-wh,targetTopY:gY-bh-wh,fallVY:0,falling:false,isRoof:true}
  ];
  return{kind:'house',wx,w:70,totalH:bh+wh,groundY:gY,col:c[0],dark:c[1],roof:c[2],
    type:'brick',sections:secs,alive:true,shakeDx:0,roofH:wh,bodyH:bh};
}
function mkCrane(wx){
  const gY=mkGY(wx+25);
  const secDefs=[{h:80,hp:60*HPM,maxHp:60*HPM},{h:80,hp:50*HPM,maxHp:50*HPM},{h:60,hp:40*HPM,maxHp:40*HPM}];
  let cumH=0;
  const secs=secDefs.map(d=>{
    const s={...d,alive:true,shakeDx:0,wins:[],
      drawTopY:gY-cumH-d.h,targetTopY:gY-cumH-d.h,fallVY:0,falling:false};
    cumH+=d.h;return s;
  });
  return{kind:'building',wx,w:50,totalH:220,groundY:gY,col:'#FFD700',dark:'#CC9900',roof:'#AA7700',type:'concrete',sections:secs,alive:true,shakeDx:0,mech:true};
}
function mkTrain(wx){
  const gY=mkGY(wx+60);
  return{kind:'train',wx,w:160,h:52,groundY:gY,col:'#C0392B',dark:'#922B21',hp:110*HPM,maxHp:110*HPM,alive:true,shakeDx:0,mech:true};
}
function mkLighthouse(wx){
  const gY=mkGY(wx+20);const h=130+rng()*60;
  const secs=[];let cum=0;
  const cols=['#FFFFFF','#FF4444','#FFFFFF','#FF4444'];
  const nS=4;const sh=h/nS;
  for(let i=0;i<nS;i++){
    secs.push({h:sh,hp:(35+rng()*20)*HPM,maxHp:55*HPM,alive:true,shakeDx:0,wins:[],
      col:cols[i],drawTopY:gY-cum-sh,targetTopY:gY-cum-sh,fallVY:0,falling:false});
    cum+=sh;
  }
  return{kind:'building',wx,w:36,totalH:h,groundY:gY,col:'#FFFFFF',dark:'#DDDDDD',roof:'#FF8800',type:'brick',sections:secs,alive:true,shakeDx:0};
}
function mkCrates(wx){
  const gY=mkGY(wx+30);const n=2+Math.floor(rng()*3);const sh=28;
  const secs=[];let cum=0;
  for(let i=0;i<n;i++){
    secs.push({h:sh,hp:(22+rng()*15)*HPM,maxHp:37*HPM,alive:true,shakeDx:0,wins:[],
      col:'#C8A050',drawTopY:gY-cum-sh,targetTopY:gY-cum-sh,fallVY:0,falling:false});
    cum+=sh;
  }
  return{kind:'building',wx,w:56,totalH:n*sh,groundY:gY,col:'#C8A050',dark:'#A07830',roof:'#8B6020',type:'brick',sections:secs,alive:true,shakeDx:0};
}
function mkHelicopter(wx){
  return{kind:'helicopter',wx,w:80,h:30,
    baseY:H*0.25+rng()*70,  // screen Y
    vx:-(1+rng()*1.2),wobble:rng()*Math.PI*2,
    w:80,h:30,hp:18*HPM,maxHp:18*HPM,alive:true,mech:true,rotorAngle:0};
}
function mkFence(wx,n=5){
  const gY=mkGY(wx+n*14);const posts=[];for(let i=0;i<n;i++)posts.push({alive:true,hp:8,maxHp:8});
  return{kind:'fence',wx,w:n*28,h:40,groundY:gY,posts,alive:true};
}
// Mega building: daruma-otoshi style tower, 50 floors with normal section height
const MEGA_COLS=['#E87C7C','#E8C87C','#7CE87C','#7CC8E8','#C87CE8','#E87CC8','#FFD580','#B0D8F0'];
function mkMegaBuilding(wx){
  const bw=65+rng()*35;
  const nSec=46+Math.floor(rng()*8); // 46-54 floors
  const secH=36+rng()*10;            // same height as normal building floor
  const totalH=nSec*secH;
  const gY=mkGY(wx+bw/2);
  const per=Math.max(1,Math.floor((bw-14)/24));
  const secs=[];let cumH=0;
  for(let i=0;i<nSec;i++){
    const hp=(20+rng()*25)*HPM;
    const topY=gY-cumH-secH;
    const wins=[];
    for(let w=0;w<per;w++)wins.push({lx:8+w*24+3,ly:8,lit:rng()>0.4});
    secs.push({h:secH,hp,maxHp:hp,alive:true,shakeDx:0,wins,
      col:MEGA_COLS[i%MEGA_COLS.length],
      drawTopY:topY,targetTopY:topY,fallVY:0,falling:false});
    cumH+=secH;
  }
  return{kind:'megabuilding',wx,w:bw,totalH,groundY:gY,sections:secs,alive:true,shakeDx:0};
}

function spawnFlyingHelicopter(){
  flyingObjs.push(mkHelicopter(camX+W+120+rng()*100));
}
function spawnFlyingUFO(){
  const si=getStageIdx(camX);
  flyingObjs.push({kind:'ufo',wx:camX+W+150+rng()*100,
    baseY:H*0.28+rng()*80,vx:-(1.8+rng()*1.8),
    wobble:rng()*Math.PI*2,w:90,h:38,hp:12*HPM,maxHp:12*HPM,alive:true,mech:true});
}

// ── SCENE TEMPLATES ───────────────────────────────────────────
const SCENES=[
  wx=>[mkBuilding(wx),mkBuilding(wx+60+rng()*20),mkBarrel(wx+130)],
  wx=>[mkBuilding(wx),mkBuilding(wx+65),mkBuilding(wx+130+rng()*20),mkTree(wx+200)],
  wx=>[mkBuilding(wx,1.5),mkBuilding(wx+75,0.6),mkCar(wx+140)],
  wx=>[mkBuilding(wx),mkTree(wx+70),mkCar(wx-15)],
  wx=>[mkTree(wx),mkTree(wx+55),mkTree(wx+110),mkTree(wx+165)],
  wx=>[mkCactus(wx),mkCactus(wx+38),mkCactus(wx+76),mkCactus(wx+114),mkCactus(wx+152)],
  wx=>[mkWaterTower(wx),mkBuilding(wx+65),mkBuilding(wx+135,0.7)],
  wx=>[mkBuilding(wx),mkBalloon(wx+20),mkBalloon(wx+55)],
  wx=>[mkRocket(wx),mkBuilding(wx+55),mkBuilding(wx+120,1.2)],
  wx=>[mkSnowman(wx),mkBarrel(wx+50),mkBarrel(wx+80),mkFence(wx+115,5)],
  wx=>[mkTree(wx),mkTree(wx+55),mkCactus(wx+120),mkCactus(wx+160)],
  wx=>[mkCar(wx),mkCar(wx+90),mkBarrel(wx+50),mkBarrel(wx+180)],
  wx=>[mkBuilding(wx,1.2),mkCar(wx-10),mkTree(wx+75),mkBalloon(wx+40),mkBuilding(wx+135,0.8)],
  wx=>[mkFence(wx,8),mkBuilding(wx+20),mkBuilding(wx+110),mkBarrel(wx+180)],
  wx=>[mkBus(wx),mkBuilding(wx+120),mkBarrel(wx+60)],
  wx=>[mkTruck(wx),mkTruck(wx+130),mkBarrel(wx+65),mkBarrel(wx+85)],
  wx=>[mkBuilding(wx,2.0),mkBuilding(wx+80,1.5),mkBuilding(wx+160,1.0),mkCar(wx+230)],  // tall city
  wx=>[mkRocket(wx),mkRocket(wx+50),mkWaterTower(wx+100)],
  wx=>[mkCar(wx),mkBus(wx+90),mkTruck(wx+210),mkBarrel(wx+340)],
  wx=>[mkMegaBuilding(wx)],   // rare mega tower
  wx=>[mkHouse(wx),mkHouse(wx+80),mkHouse(wx+160)],
  wx=>[mkTrain(wx)],
  wx=>[mkCrates(wx),mkCrates(wx+70),mkCrates(wx+140)],
  wx=>[mkLighthouse(wx),mkBuilding(wx+55)],
  wx=>[mkHouse(wx),mkTree(wx+80),mkCar(wx-10)],
  wx=>[mkCrates(wx),mkBarrel(wx+65),mkCrates(wx+100),mkBarrel(wx+165)],
  wx=>[mkTrain(wx),mkBarrel(wx+170),mkCrates(wx+200)],
];
// Stage 4-5 heavy scenes
const HEAVY_SCENES=[
  wx=>[mkBuilding(wx,2.2),mkBuilding(wx+85,1.8),mkBuilding(wx+170,2.0),mkBuilding(wx+255,1.5)],
  wx=>[mkTruck(wx),mkTruck(wx+130),mkBus(wx+270),mkBarrel(wx+65),mkBarrel(wx+195)],
  wx=>[mkRocket(wx),mkRocket(wx+55),mkRocket(wx+110),mkWaterTower(wx+165)],
  wx=>[mkMegaBuilding(wx)],
  wx=>[mkMegaBuilding(wx),mkBuilding(wx+120,0.8)],
  wx=>[mkMegaBuilding(wx),mkMegaBuilding(wx+130)],
];

function spawnScene(){
  // ボスゾーンには大きな建物などは置かない(ボスと重ならないように)。
  // ただしボス手前は軽い的(樽/車)だけ挟んで「近づく間も何か壊せる」空白を埋める。
  for(let bi=0;bi<5;bi++){
    const bossWX=bossWXFor(bi);
    if(nextSpawnX>bossWX-250&&nextSpawnX<bossWX+400){
      worldObjs.push(mkBarrel(nextSpawnX));
      if(rng()<0.5)worldObjs.push(mkCar(nextSpawnX+90));
      nextSpawnX+=120+rng()*60;
      return;
    }
    // ボス撃破直後: 完全な無スポーン区間を縮め、軽い的を2個(樽2個、片方は少し先)混ぜて得点の空白を埋める
    // 注: ジャンプ先はゾーンの外(>=bossWX+520)でなければならない。ゾーン内の値を代入すると
    // 次のspawnScene()呼び出しで同じ条件に再度ひっかかり、nextSpawnXが進まず無限ループ・
    // worldObjs際限なく増殖 → メモリ枯渇のバグになるため、ゾーン自体(550→520)を縮めて対応。
    if(nextSpawnX>=bossWX+400&&nextSpawnX<bossWX+520){
      worldObjs.push(mkBarrel(nextSpawnX));
      worldObjs.push(mkBarrel(nextSpawnX+120));
      nextSpawnX=bossWX+520; return;
    }
  }
  const si=getStageIdx(nextSpawnX);
  const useHeavy=si>=3&&rng()<0.4;
  const pool=useHeavy?HEAVY_SCENES:SCENES;
  const fn=pool[Math.floor(rng()*pool.length)];
  fn(nextSpawnX).forEach(o=>{if(o)worldObjs.push(o);});
  // Extra density for later stages
  if(si>=2&&rng()<0.3){
    const fn2=SCENES[Math.floor(rng()*SCENES.length)];
    fn2(nextSpawnX+30).forEach(o=>{if(o)worldObjs.push(o);});
  }
  // ① にじいろジェム: 画面に1個も無いとき たまに(約5%)空へ1個だけ出す激レア
  if(!worldObjs.some(o=>o.kind==='gem'&&o.alive)&&rng()<0.05){
    worldObjs.push(mkGem(nextSpawnX+rng()*100));
  }
  const spacing=si>=3?110+rng()*50:120+rng()*70;
  nextSpawnX+=spacing;
  if(rng()<0.07+si*0.02)setTimeout(spawnFlyingUFO,1000+rng()*3000);
  if(rng()<0.06+si*0.015)setTimeout(spawnFlyingHelicopter,2000+rng()*3000);
}

// ── EFFECTS SPAWNERS ──────────────────────────────────────────
function spawnExplosion(x,y,size=1){
  for(let i=0;i<22*size;i++){
    const a=rng()*Math.PI*2,spd=(4+rng()*14)*size;
    particles.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-6*size,
      size:(7+rng()*14)*size,col:['#FF4400','#FF8800','#FFCC00','#FF2200','#FF6600'][Math.floor(rng()*5)],alpha:1});
  }
  for(let i=0;i<14*size;i++){
    smokes.push({x:x+(rng()-0.5)*30*size,y,vx:(rng()-0.5)*1.5,vy:-(0.6+rng()*1.8),
      r:5+rng()*10*size,alpha:0.13,grow:0.8+rng()*1.0,
      col:`rgb(${190+Math.floor(rng()*50)},${188+Math.floor(rng()*40)},${185+Math.floor(rng()*40)})`});
  }
  shockwaves.push({x,y,r:8,maxR:70+40*size,alpha:0.9,size});
  addShake(16*size);playExplode();
}
function spawnFrag(sx,sy,w,h,cols,force=1){
  const cn=Math.max(2,Math.floor(w/13)),rn=Math.max(2,Math.floor(h/15));
  const cw=w/cn,ch=h/rn;
  for(let ci=0;ci<cn;ci++)for(let ri=0;ri<rn;ri++){
    const fx=sx+ci*cw+cw*0.5,fy=sy+ri*ch+ch*0.5,fc=fx-(sx+w/2);
    fragments.push({x:fx,y:fy,vx:fc*(0.04+rng()*0.08)+(rng()-0.5)*6*force,
      vy:-(3+rng()*11+(rn-ri)/rn*6)*force,w:cw*(0.4+rng()*0.9),h:ch*(0.4+rng()*0.9),
      rot:rng()*Math.PI*2,rotv:(rng()-0.5)*0.4,col:cols[Math.floor(rng()*cols.length)],alpha:1,grounded:false});
  }
}
function spawnHitFx(x,y,col,n=12){
  for(let i=0;i<n;i++){const a=rng()*Math.PI*2,s=2+rng()*9;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-4,size:3+rng()*9,col,alpha:1});}
}
function spawnStar(sx,sy){
  stars.push({x:sx,y:sy,vy:-2.4,life:1,rot:rng()*6.28,vr:(rng()-0.5)*0.25,
    s:16+rng()*14,col:['#FFE14A','#FF7ACB','#7BE0FF','#FFFFFF','#FFB03A'][Math.floor(rng()*5)]});
  if(stars.length>60) stars.splice(0,stars.length-60);
}

// ── 隠し発見: エフェクト ───────────────────────────────────────
const RBCOL=['#FF3B6B','#FF9A3B','#FFE14A','#5BE07B','#3BA6FF','#B06BFF'];
// ① にじいろジェム 撃破: 虹の粒がぶわっと広がる大盤振る舞い(加算合成は使わず source-over のみ = 白飛びしない)
function rainbowGemBurst(x,y){
  rbMsgT=1.8;addScore(300);
  for(let i=0;i<30;i++){const a=rng()*Math.PI*2,s=3+rng()*10;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-4,size:5+rng()*11,col:RBCOL[i%6],alpha:1});}
  spawnStar(x,y);spawnStar(x-22,y-8);spawnStar(x+22,y-8);
  shockwaves.push({x,y,r:10,maxR:130,alpha:0.9,size:1.4});
  addShake(16);playExplode();
  api.slide(660,1320,0.5,0.2,'triangle');api.tone(880,0.14,'triangle',0.11);api.tone(1320,0.16,'triangle',0.09);
}
// ② きょうのラッキー色: 秘密の色の対象をこわすと小ボーナス+頭上に星のキラッ。初回だけ中央上で教える。
function maybeLucky(obj,cx,cy){
  if(!obj||obj.col!==luckyColor)return;
  addScore(10);
  if(!luckySeen){luckySeen=true;luckyMsgT=2.2;}else luckyMsgT=Math.max(luckyMsgT,0.9);
  api.tone(1046,0.12,'triangle',0.1);api.tone(1568,0.14,'triangle',0.07);
  for(let i=0;i<4;i++)stars.push({x:cx+(rng()-0.5)*20,y:cy-10,vy:-1.4-rng(),life:1,rot:rng()*6,vr:(rng()-0.5)*0.2,s:11+rng()*5,col:luckyColor});
  if(stars.length>60)stars.splice(0,stars.length-60);
}
// ① にじいろジェム 描画: 空に浮かぶ虹色のダイヤ(source-overのみ)
function drawGem(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx),gY=toSY(obj.groundY);if(sx>W+20||sx+obj.w<-20)return;
  obj.wobble+=0.04;
  const cx=sx+obj.w/2,cy=gY-obj.floatH+Math.sin(obj.wobble)*8;
  const hw=obj.w*0.46,hh=obj.h*0.52,t=Date.now()*0.004;
  ctx.save();
  const halo=ctx.createRadialGradient(cx,cy,2,cx,cy,obj.w);
  halo.addColorStop(0,'rgba(255,255,255,0.42)');halo.addColorStop(0.5,'rgba(180,230,255,0.15)');halo.addColorStop(1,'rgba(180,230,255,0)');
  ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,obj.w,0,Math.PI*2);ctx.fill();
  const rg=ctx.createLinearGradient(cx-hw,cy-hh,cx+hw,cy+hh);
  for(let k=0;k<=6;k++)rg.addColorStop(k/6,RBCOL[(k+Math.floor(t))%6]);
  ctx.fillStyle=rg;
  ctx.beginPath();ctx.moveTo(cx,cy-hh);ctx.lineTo(cx+hw,cy-hh*0.15);ctx.lineTo(cx,cy+hh);ctx.lineTo(cx-hw,cy-hh*0.15);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.55)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(cx-hw,cy-hh*0.15);ctx.lineTo(cx+hw,cy-hh*0.15);ctx.moveTo(cx,cy-hh);ctx.lineTo(cx,cy+hh);ctx.stroke();
  ctx.strokeStyle='rgba(60,20,80,0.35)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(cx,cy-hh);ctx.lineTo(cx+hw,cy-hh*0.15);ctx.lineTo(cx,cy+hh);ctx.lineTo(cx-hw,cy-hh*0.15);ctx.closePath();ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.9)';ctx.beginPath();ctx.arc(cx-hw*0.25,cy-hh*0.32,2.5,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
// ④ おひさま/おつきさま: 空に描き、タップ判定を sunScreen に確定。夜ステージ(最終)は月。
function drawSunMoon(){
  const isNight=(currentStage>=4);
  const cxp=W*0.72,cyp=H*0.17,rr=clamp(W*0.05,26,46);
  sunScreen.x=cxp;sunScreen.y=cyp;sunScreen.r=Math.max(48,rr*1.7);
  ctx.save();
  const halo=ctx.createRadialGradient(cxp,cyp,rr*0.4,cxp,cyp,rr*3.2);
  if(isNight){halo.addColorStop(0,'rgba(220,230,255,0.38)');halo.addColorStop(0.5,'rgba(200,215,255,0.13)');halo.addColorStop(1,'rgba(200,215,255,0)');}
  else{halo.addColorStop(0,'rgba(255,244,190,0.5)');halo.addColorStop(0.5,'rgba(255,232,150,0.18)');halo.addColorStop(1,'rgba(255,244,190,0)');}
  ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cxp,cyp,rr*3.2,0,Math.PI*2);ctx.fill();
  const disc=ctx.createRadialGradient(cxp-rr*0.3,cyp-rr*0.3,rr*0.2,cxp,cyp,rr);
  if(isNight){disc.addColorStop(0,'#FDFCF0');disc.addColorStop(1,'#CBD6EE');}
  else{disc.addColorStop(0,'#FFFCE8');disc.addColorStop(1,'#FFD86A');}
  ctx.fillStyle=disc;ctx.beginPath();ctx.arc(cxp,cyp,rr,0,Math.PI*2);ctx.fill();
  if(isNight){ctx.fillStyle='rgba(160,175,205,0.5)';
    ctx.beginPath();ctx.arc(cxp+rr*0.3,cyp-rr*0.2,rr*0.16,0,Math.PI*2);ctx.arc(cxp-rr*0.25,cyp+rr*0.25,rr*0.12,0,Math.PI*2);ctx.fill();}
  if(sunWinkT>0){sunWinkT-=0.02;
    ctx.strokeStyle=isNight?'#7a86aa':'#d09020';ctx.lineWidth=Math.max(2,rr*0.13);ctx.lineCap='round';
    ctx.globalAlpha=clamp(sunWinkT*1.4,0,1);
    ctx.beginPath();
    ctx.moveTo(cxp-rr*0.44,cyp-rr*0.02);ctx.quadraticCurveTo(cxp-rr*0.29,cyp-rr*0.3,cxp-rr*0.14,cyp-rr*0.02);
    ctx.moveTo(cxp+rr*0.14,cyp-rr*0.02);ctx.quadraticCurveTo(cxp+rr*0.29,cyp-rr*0.3,cxp+rr*0.44,cyp-rr*0.02);
    ctx.stroke();
    ctx.beginPath();ctx.arc(cxp,cyp+rr*0.16,rr*0.32,0.12*Math.PI,0.88*Math.PI);ctx.stroke();
    ctx.globalAlpha=1;if(sunWinkT<0)sunWinkT=0;}
  ctx.restore();
}

// ── HIT DETECTION ─────────────────────────────────────────────
function checkHit(){
  if(hitCD>0)return;
  const tp=getTip(),m=feverActive?120:34;

  flyingObjs.forEach(obj=>{
    if(!obj.alive)return;
    // ヘリは画面Y固定で動く
    const sx=toS(obj.wx);
    const fy=obj.kind==='helicopter'?H*0.3+Math.sin(obj.wobble||0)*16:obj.baseY+Math.sin(obj.wobble)*14;
    if(Math.hypot(tp.x-(sx+obj.w/2),tp.y-(fy+obj.h/2))>m+100)return;
    const dmg=feverActive?50:20;
    obj.hp=Math.max(0,obj.hp-dmg);
    spawnHitFx(tp.x,tp.y,'#88FF88',14);addShake(10);hitCD=feverActive?2:7;
    if(obj.hp<=0){obj.alive=false;spawnExplosion(sx+obj.w/2,fy+obj.h/2,1.4);spawnStar(sx+obj.w/2,fy);addScore(250);addCombo();}
    else playHit(true);
  });

  worldObjs.forEach(obj=>{
    if(!obj.alive)return;
    const sx=toS(obj.wx),gY=toSY(obj.groundY);
    if(tp.x<sx-m||tp.x>sx+obj.w+m)return;
    if(obj.kind==='building'||obj.kind==='watertower'||obj.kind==='house'||obj.kind==='boss'){hitBuilding(obj,tp,sx,gY,m);}
    else if(obj.kind==='megabuilding'){hitMegaBuilding(obj,tp,sx);}
    else if(obj.kind==='balloon'){
      const fy=gY-obj.floatH+Math.sin(obj.wobble)*10;
      if(tp.y<fy-50||tp.y>fy+obj.h+50)return;
      obj.alive=false;spawnFrag(sx,fy,obj.w,obj.h,[obj.col,'#FFF','#FFD700'],1.2);
      spawnHitFx(tp.x,tp.y,obj.col,18);spawnStar(sx+obj.w/2,fy);
      addScore(60);addCombo();playPop();addShake(6);hitCD=4;
    } else if(obj.kind==='gem'){
      // ① にじいろジェム: 割ると虹の大盤振る舞い(移動をふさがないので通り抜けも可)
      const fy=gY-obj.floatH+Math.sin(obj.wobble||0)*10;
      if(tp.y<fy-60||tp.y>fy+obj.h+60)return;
      obj.alive=false;rainbowGemBurst(sx+obj.w/2,fy+obj.h*0.5);addCombo();hitCD=6;
    } else if(obj.kind==='fence'){
      obj.posts.forEach((p,i)=>{
        if(!p.alive)return;const px=sx+i*28;
        if(tp.x<px-40||tp.x>px+56)return;
        p.alive=false;spawnFrag(px,gY-obj.h,20,obj.h,['#8B4513','#6B3010'],1.0);
        addScore(15);addCombo();playHit(false);addShake(4);hitCD=3;
      });
      if(obj.posts.every(p=>!p.alive))obj.alive=false;
    } else {
      if(tp.y<gY-obj.h-m||tp.y>gY+m)return;
      const dmg=feverActive?40:16+rng()*10;
      obj.hp=Math.max(0,obj.hp-dmg);
      if(obj.shakeDx!==undefined)obj.shakeDx=(rng()-0.5)*14;
      if(obj.kind==='car'||obj.kind==='bus'||obj.kind==='truck')obj.vx=(rng()-0.5)*80;
      spawnHitFx(tp.x,tp.y,obj.col||'#AAA',12);
      addScore(12);addCombo();playHit(false);addShake(7);hitCD=feverActive?2:7;
      if(obj.hp<=0)destroyObj(obj,sx,gY);
    }
  });
}

function hitBuilding(obj,tp,sx,gY,m){
  // sections index 0=bottom, last=top; drawTopY tracks position
  for(let i=0;i<obj.sections.length;i++){
    const sec=obj.sections[i];if(!sec.alive)continue;
    const st=sec.drawTopY,sb=st+sec.h;
    // 上方向は小さいマージン（幽霊当たり防止）、下・横は通常マージン
    // ボスのセクションは巨大でシェイクもあり低学年には狙いが外れやすいので上方向マージンを広げる
    const topM=(obj.kind==='boss')?28:16,botM=m;
    if(tp.y<st-topM||tp.y>sb+botM)continue;
    // ボスは総HPが重いので、フィーバー中でなくても1発あたりのダメージを底上げして詰まり感を減らす
    // 第3ラウンド改善: ボスは総HPが重く長い無得点区間の主因だったため、1発ダメージの下限を底上げ。
    const dmg=feverActive?50:(obj.kind==='boss'?22+rng()*14:15+rng()*10);
    sec.hp=Math.max(0,sec.hp-dmg);sec.shakeDx=(rng()-0.5)*14;obj.shakeDx=(rng()-0.5)*6;
    spawnHitFx(tp.x,tp.y,obj.col,14);addScore(12);addCombo();
    playHit(sec.hp/sec.maxHp<0.3);addShake(8);hitCD=feverActive?2:7;
    if(sec.hp<=0&&sec.alive){
      sec.alive=false;
      spawnFrag(sx+obj.shakeDx,st,obj.w,sec.h,[obj.col,obj.dark,obj.roof,'#CCC','#AAA'],1.3);
      // Daruma otoshi: sections ABOVE (higher indices) fall down by this section's height
      for(let j=i+1;j<obj.sections.length;j++){
        if(!obj.sections[j].alive)continue;
        obj.sections[j].targetTopY+=sec.h;
        obj.sections[j].falling=true;
      }
      addShake(14);
      if(obj.sections.every(s=>!s.alive)){
        obj.alive=false;spawnStar(sx+obj.w/2,gY-obj.totalH*0.5);addScore(120);addShake(18);
      }
    }
    break;
  }
}

function collapseFrom(obj,from,sx,gY){
  // Destroy section[from] and make everything above fall (fever mode / chain)
  const sec=obj.sections[from];
  if(sec&&sec.alive){
    sec.alive=false;
    spawnFrag(sx,sec.drawTopY,obj.w,sec.h,[obj.col,obj.dark,obj.roof||'#888','#CCC','#AAA'],1.3);
    for(let j=from+1;j<obj.sections.length;j++){
      if(!obj.sections[j].alive)continue;
      obj.sections[j].targetTopY+=sec.h;
      obj.sections[j].falling=true;
    }
  }
}

function hitMegaBuilding(obj,tp,sx){
  // index 0=bottom, last=top; hit lowest visible section at tip position
  for(let i=0;i<obj.sections.length;i++){
    const sec=obj.sections[i];if(!sec.alive)continue;
    const st=sec.drawTopY,sb=st+sec.h;
    // 上方向は小さいマージン（幽霊当たり防止）
    if(tp.y<st-16||tp.y>sb+40)continue;
    const dmg=feverActive?999:18+rng()*14;
    sec.hp=Math.max(0,sec.hp-dmg);
    sec.shakeDx=(rng()-0.5)*10;
    spawnHitFx(tp.x,tp.y,sec.col,10);
    addScore(8);addCombo();playHit(false);addShake(6);hitCD=feverActive?2:7;
    if(sec.hp<=0){
      sec.alive=false;
      spawnFrag(sx,sec.drawTopY,obj.w,sec.h,[sec.col,'#CCC','#DDD'],0.9);
      // Daruma otoshi: ALL sections ABOVE (higher indices) fall
      for(let j=i+1;j<obj.sections.length;j++){
        if(!obj.sections[j].alive)continue;
        obj.sections[j].targetTopY+=sec.h;
        obj.sections[j].falling=true;
      }
      addShake(12);addScore(30);
      if(obj.sections.every(s=>!s.alive)){
        obj.alive=false;
        spawnStar(sx+obj.w/2,toSY(obj.groundY)-100);
        addScore(500);addShake(25);playExplode();
      }
    }
    break;
  }
}

function destroyObj(obj,sx,gY){
  obj.alive=false;
  const h=obj.h||60;
  if(obj.mech){spawnExplosion(sx+obj.w/2,gY-h*0.5,1.1);}
  else{spawnFrag(sx,gY-h,obj.w,h,[obj.col||'#888','#CCC','#AAA'],1.3);}
  spawnStar(sx+obj.w/2,gY-h*0.5);addScore(80);
  maybeLucky(obj,sx+obj.w/2,gY-h*0.6);   // ② きょうのラッキー色(車などの色一致で小ボーナス)
}

// ── FEVER AUTO-ATTACK ──────────────────────────────────────────
function feverAttack(){
  if(!feverActive)return;
  const tp=getTip();
  const radius=160;
  worldObjs.forEach(obj=>{
    if(!obj.alive)return;
    const sx=toS(obj.wx),gY=toSY(obj.groundY);
    const cx=sx+obj.w/2,cy=gY-(obj.totalH||obj.h||50)*0.5;
    if(Math.hypot(tp.x-cx,tp.y-cy)>radius)return;
    if(obj.kind==='building'||obj.kind==='watertower'||obj.kind==='megabuilding'||obj.kind==='house'||obj.kind==='boss'){
      // damage lowest alive section (daruma-otoshi: knock out foundation)
      for(let i=0;i<obj.sections.length;i++){
        const sec=obj.sections[i];if(!sec.alive)continue;
        sec.hp-=2;
        if(sec.hp<=0){
          collapseFrom(obj,i,sx,gY);
          addScore(20);
        }
        break;
      }
      if(obj.sections.every(s=>!s.alive)){obj.alive=false;addScore(80);spawnStar(sx+obj.w/2,gY-50);}
    } else {
      obj.hp-=1.5;
      if(obj.hp<=0){destroyObj(obj,sx,gY);addScore(40);}
    }
  });
}

// ── STAGE GOALS ───────────────────────────────────────────────
function checkStageGoal(){
  if(stageClearing||currentStage>=5)return;
  const goalX=STAGE_X[currentStage]+STAGES[currentStage].len-150;
  if(exWorldX>goalX){
    stageClearing=true;stageClearTimer=160;
    // ③ パーフェクト区間: おたすけ自動掘削を使わず自力でゴールしたら +ボーナス & 祝福
    if(!stageUsedAssist){addScore(50);perfectMsgT=2.2;spawnStar(W*0.5,H*0.5);
      api.tone(1318,0.14,'triangle',0.1);api.tone(1976,0.16,'triangle',0.07);}
    stageUsedAssist=false;
    const isLast=currentStage>=4;
    clearMsg.textContent=isLast?'ぜんぶ クリア！':STAGES[currentStage].name+' クリア！';
    clearMsg.classList.add('show');
    playStageClear();addShake(25);power=0;feverActive=false;
    feverLabel.style.display='none';powerFill.style.width='0%';
    powerFill.style.background='linear-gradient(90deg,#FF6600,#FFD700)';
    if(!isLast){currentStage++;stNumEl.textContent=currentStage+1;}
    else{ pendingLoop=true; }   // 全クリア -> まちを作り直して エンドレスに続く(スコアは持ち越し)
  }
}

// ── DRAW FUNCTIONS ─────────────────────────────────────────────
function drawTerrain(){
  const si=getStageIdx(camX+W/2);
  const stage=STAGES[Math.min(si,4)];
  // Sky (画像背景があれば cover-fit + 面の空色を薄く重ねる / 無ければ従来のグラデ)
  imgBg=false;
  if(api.drawCover("bg.jpg")){
    imgBg=true;
    const ta=STAGE_TINT[Math.min(si,4)]||0;
    if(ta>0){
      ctx.save();ctx.globalAlpha=ta;
      const tg=ctx.createLinearGradient(0,0,0,H);
      tg.addColorStop(0,stage.sky[0]);tg.addColorStop(1,stage.sky[1]);
      ctx.fillStyle=tg;ctx.fillRect(0,0,W,H);
      ctx.restore();ctx.globalAlpha=1;
    }
  } else {
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,stage.sky[0]);sky.addColorStop(1,stage.sky[1]);
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  }
  // Clouds ※画像背景のときは絵の雲を活かして描かない(位置更新だけ続ける)
  clouds.forEach(c=>{
    const sx=toS(c.wx);
    if(!imgBg&&sx>=-200&&sx<=W+200){
      ctx.save();ctx.globalAlpha=0.85;ctx.fillStyle='rgba(255,255,255,0.9)';
      const s=c.sz;
      [[0,0,s],[s*.5,-s*.18,s*.72],[s*.9,0,s*.62],[s*1.35,s*.1,s*.48]].forEach(([dx,dy,r])=>{
        ctx.beginPath();ctx.arc(sx+dx,c.y+dy,r,0,Math.PI*2);ctx.fill();
      });
      ctx.restore();
    }
    c.wx+=c.spd*(1/60);
    if(c.wx>camX+W+400)c.wx=camX-200;
  });
  drawSunMoon();   // ④ おひさま/おつきさま(空・雲の上/地面の後ろ)
  // Ground polygon
  ctx.beginPath();ctx.moveTo(-5,H+5);
  for(let sx=-5;sx<=W+5;sx+=8){ctx.lineTo(sx,toSY(getTerrainY(sx+camX)));}
  ctx.lineTo(W+5,H+5);ctx.closePath();
  ctx.fillStyle=stage.dCol;ctx.fill();
  // Grass line
  ctx.beginPath();
  for(let sx=-5;sx<=W+5;sx+=8){
    sx===(-5)?ctx.moveTo(sx,toSY(getTerrainY(sx+camX))):ctx.lineTo(sx,toSY(getTerrainY(sx+camX)));
  }
  ctx.strokeStyle=stage.gCol;ctx.lineWidth=18;ctx.stroke();
  // Scrolling road dashes
  const p=80,off=camX%p;
  ctx.fillStyle='rgba(150,120,50,0.25)';
  for(let x=-p+(p-off);x<W+p;x+=p){const sy=toSY(getTerrainY(x+camX));ctx.fillRect(x,sy+6,46,5);}
}

function drawStageGoalBanner(){
  if(currentStage>=5||stageClearing)return;
  const goalX=STAGE_X[currentStage]+STAGES[currentStage].len-150;
  const sx=toS(goalX);
  if(sx<-100||sx>W+100)return;
  const gY=toSY(getTerrainY(goalX));
  ctx.save();
  // Arch pillars
  ctx.fillStyle='#FFD700';ctx.fillRect(sx-10,gY-180,20,180);ctx.fillRect(sx+80,gY-180,20,180);
  // Crossbar
  ctx.fillStyle='#FF4500';ctx.fillRect(sx-15,gY-190,115,25);
  // Text
  ctx.fillStyle='white';ctx.font='bold 16px Arial';ctx.textAlign='center';
  ctx.fillText('GOAL',sx+45,gY-173);
  // Flag
  ctx.fillStyle=['#FF4500','#4CAF50','#2196F3','#9C27B0','#FFD700'][currentStage];
  ctx.beginPath();ctx.moveTo(sx+5,gY-180);ctx.lineTo(sx+40,gY-165);ctx.lineTo(sx+5,gY-148);ctx.fill();
  ctx.restore();
}

// 軸6(見やすさ): 絵画調の生成背景(bg.jpg)とベクター調の壊す物が噛み合っていない対策。
// ① 接地シャドウ: 足元に淡い影の楕円を敷いて「地面に乗っている」感を足す(低コスト)。
// ② ステージトーン: 面ごとの空気感(STAGE_TINT)を素材の色に薄く乗算(multiply)して馴染ませる。
function drawGroundShadow(cx,gY,halfW){
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.22)';
  ctx.beginPath();ctx.ellipse(cx,gY+3,Math.max(0,halfW),6,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function applyStageTone(x,y,w,h,wx){
  if(!imgBg)return; // 手描き背景(画像が無いフォールバック)の面は既存の塗り色のままでよい
  const si=getStageIdx(wx),ta=(STAGE_TINT[Math.min(si,4)]||0)*0.35;
  if(ta<=0)return;
  const stage=STAGES[Math.min(si,4)];
  ctx.save();
  ctx.globalCompositeOperation='multiply';ctx.globalAlpha=ta;
  ctx.fillStyle=stage.sky[1];
  ctx.fillRect(x,y,Math.max(0,w),Math.max(0,h));
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  ctx.restore();
}
function drawBuilding(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx),gY=toSY(obj.groundY);
  if(sx>W+20||sx+obj.w<-20)return;
  drawGroundShadow(sx+obj.w/2,gY,obj.w*0.48);
  let st=gY-obj.totalH;
  for(let i=0;i<obj.sections.length;i++){
    const sec=obj.sections[i];if(!sec.alive){st+=sec.h;continue;}
    const r=sec.hp/sec.maxHp;
    ctx.save();ctx.globalAlpha=0.28+r*0.72;ctx.translate(sec.shakeDx,0);
    ctx.fillStyle=obj.col;ctx.fillRect(sx,st,obj.w,sec.h);
    ctx.fillStyle=obj.dark;ctx.fillRect(sx+obj.w-7,st,7,sec.h);
    if(obj.type==='glass'){ctx.fillStyle='rgba(255,255,255,0.14)';ctx.fillRect(sx+2,st,obj.w*0.35,sec.h);}
    if(i===obj.sections.length-1||(i<obj.sections.length-1&&!obj.sections[i+1].alive)){
      ctx.fillStyle=obj.roof;ctx.fillRect(sx-3,st-7,obj.w+6,10);
    }
    if(i>0&&r<0.75){ctx.strokeStyle='rgba(40,15,0,0.65)';ctx.lineWidth=3;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(sx,st);ctx.lineTo(sx+obj.w,st);ctx.stroke();ctx.setLineDash([]);}
    sec.wins.forEach(w=>{
      ctx.fillStyle=w.lit?'#FFFACD':'#6080A0';ctx.fillRect(sx+w.lx,st+w.ly,13,16);
      if(w.lit){ctx.fillStyle='rgba(255,255,190,0.28)';ctx.fillRect(sx+w.lx-1,st+w.ly-1,15,18);}
    });
    ctx.fillStyle='rgba(0,0,0,0.38)';ctx.fillRect(sx,st,obj.w,5);
    ctx.fillStyle=r>0.6?'#4CAF50':r>0.3?'#FFC107':'#F44336';ctx.fillRect(sx,st,obj.w*r,5);
    ctx.restore();sec.shakeDx*=0.7;
    st+=sec.h;
  }
  applyStageTone(sx,gY-obj.totalH,obj.w,obj.totalH,obj.wx);
  obj.shakeDx*=0.75;
}

function drawWaterTower(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx),gY=toSY(obj.groundY);if(sx>W+10||sx+obj.w<-10)return;
  const s=obj.sections;
  ctx.strokeStyle='#5A3010';ctx.lineWidth=5;
  [[10],[25],[40]].forEach(([lx])=>{ctx.beginPath();ctx.moveTo(sx+lx,gY-s[0].h);ctx.lineTo(sx+lx,gY);ctx.stroke();});
  if(s[0].alive){const r=s[0].hp/s[0].maxHp;ctx.save();ctx.globalAlpha=0.28+r*0.72;ctx.translate(obj.shakeDx,0);ctx.fillStyle=obj.dark;ctx.fillRect(sx,gY-s[0].h,obj.w,10);ctx.fillStyle=r>0.5?'#4CAF50':'#F44336';ctx.fillRect(sx,gY-s[0].h,obj.w*r,4);ctx.restore();}
  if(s[1].alive){const r=s[1].hp/s[1].maxHp,ty=gY-s[0].h-s[1].h;ctx.save();ctx.globalAlpha=0.28+r*0.72;ctx.translate(obj.shakeDx,0);ctx.fillStyle=obj.col;ctx.fillRect(sx+2,ty,obj.w-4,s[1].h);ctx.fillStyle=obj.dark;ctx.fillRect(sx+obj.w-6,ty,6,s[1].h);ctx.strokeStyle='#4A2010';ctx.lineWidth=3;[0.2,0.5,0.8].forEach(t=>{ctx.beginPath();ctx.moveTo(sx,ty+s[1].h*t);ctx.lineTo(sx+obj.w,ty+s[1].h*t);ctx.stroke();});ctx.fillStyle=r>0.5?'#4CAF50':'#F44336';ctx.fillRect(sx,ty,obj.w*r,4);ctx.restore();}
  obj.shakeDx*=0.75;
}

function drawTree(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx),gY=toSY(obj.groundY);if(sx>W+10||sx+obj.w<-10)return;
  const r=obj.hp/obj.maxHp,cx=sx+obj.w/2;
  drawGroundShadow(cx,gY,obj.w*0.42);
  ctx.save();ctx.globalAlpha=0.3+r*0.7;ctx.translate(obj.shakeDx||0,0);
  // 画像の木: 生成画像は下部(72%以下)に草の土台が残っているので、そこを clip で切り落とし
  //   幹の根元(=画像の72%位置)を地面に合わせる。見た目は当たり判定(w×h)より少し大きめ。
  {
    const dh=obj.h*1.7, dw=Math.max(obj.w*1.7,dh*0.62), top=gY+2-dh*0.72;
    ctx.save();ctx.beginPath();ctx.rect(cx-dw/2-2,top-2,dw+4,dh*0.72+4);ctx.clip();
    const ok=api.drawAsset("tree.png",cx,top+dh/2,dw,dh,{center:true});
    ctx.restore();
    if(ok){ctx.restore();applyStageTone(cx-dw/2,top,dw,dh*0.72,obj.wx);obj.shakeDx=(obj.shakeDx||0)*0.75;return;}
  }
  // 幹のグラデ
  const tg=ctx.createLinearGradient(cx-obj.trunk/2,0,cx+obj.trunk/2,0);
  tg.addColorStop(0,'#6B3A10');tg.addColorStop(0.4,'#9B5A2A');tg.addColorStop(1,'#5A2E08');
  ctx.fillStyle=tg;ctx.beginPath();ctx.roundRect(cx-obj.trunk/2,gY-obj.h*0.46,obj.trunk,obj.h*0.46,[3,3,6,6]);ctx.fill();
  // 幹の節
  ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=1.5;
  [0.2,0.5,0.75].forEach(t=>{ctx.beginPath();ctx.moveTo(cx-obj.trunk/2+2,gY-obj.h*0.46*t);ctx.quadraticCurveTo(cx,gY-obj.h*0.46*(t+0.05),cx+obj.trunk/2-2,gY-obj.h*0.46*t);ctx.stroke();});
  // 葉の重なりレイヤー（下から影→上にハイライト）
  const layers=[
    {yo:0,r:obj.w*0.46,col:'#1A6B20'},
    {yo:obj.h*0.2,r:obj.w*0.41,col:'#228B22'},
    {yo:obj.h*0.38,r:obj.w*0.34,col:'#2AAA2A'},
    {yo:obj.h*0.52,r:obj.w*0.26,col:'#38CC38'},
    {yo:obj.h*0.64,r:obj.w*0.16,col:'#44DD44'},
  ];
  layers.forEach(l=>{
    const g=ctx.createRadialGradient(cx-l.r*0.15,gY-obj.h+l.yo-l.r*0.2,1,cx,gY-obj.h+l.yo,l.r);
    g.addColorStop(0,'rgba(255,255,255,0.15)');g.addColorStop(0.3,l.col);g.addColorStop(1,l.col);
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,gY-obj.h+l.yo,l.r,0,Math.PI*2);ctx.fill();
    // 葉の縁の暗い輪郭
    ctx.strokeStyle='rgba(0,60,0,0.25)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,gY-obj.h+l.yo,l.r,0,Math.PI*2);ctx.stroke();
  });
  ctx.restore();applyStageTone(cx-obj.w*0.5,gY-obj.h*1.1,obj.w,obj.h*1.1,obj.wx);obj.shakeDx=(obj.shakeDx||0)*0.75;
}

function drawCactus(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx),gY=toSY(obj.groundY);if(sx>W+10||sx+obj.w<-10)return;
  const r=obj.hp/obj.maxHp,cx=sx+obj.w/2;
  drawGroundShadow(cx,gY,obj.w*0.6);
  ctx.save();ctx.globalAlpha=0.28+r*0.72;ctx.translate(obj.shakeDx,0);
  ctx.fillStyle=obj.col;ctx.beginPath();ctx.roundRect(cx-7,gY-obj.h,14,obj.h,7);ctx.fill();
  ctx.beginPath();ctx.roundRect(cx-22,gY-obj.h*0.65,13,obj.h*0.35,6);ctx.fill();
  ctx.beginPath();ctx.roundRect(cx+9,gY-obj.h*0.5,12,obj.h*0.3,6);ctx.fill();
  ctx.restore();applyStageTone(cx-22,gY-obj.h,44,obj.h,obj.wx);obj.shakeDx*=0.75;
}

function drawVehicle(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx),gY=toSY(obj.groundY);if(sx>W+10||sx+obj.w<-10)return;
  const r=obj.hp/obj.maxHp,isBus=obj.kind==='bus',isTruck=obj.kind==='truck';
  drawGroundShadow(sx+obj.w/2,gY,obj.w*0.5);
  ctx.save();ctx.globalAlpha=0.3+r*0.7;ctx.translate((obj.shakeDx||0)+(obj.vx||0)*0.02,0);
  // ── 車体グラデ ──
  const cg=ctx.createLinearGradient(sx,gY-obj.h*1.6,sx,gY);
  cg.addColorStop(0,'rgba(255,255,255,0.35)');cg.addColorStop(0.3,obj.col);cg.addColorStop(1,obj.col);
  if(isBus){
    // バス: 長方形ボディ
    ctx.fillStyle=obj.col;ctx.beginPath();ctx.roundRect(sx+3,gY-obj.h*1.55,obj.w-6,obj.h*1.3,10);ctx.fill();
    const bg2=ctx.createLinearGradient(sx,gY-obj.h*1.55,sx+obj.w,gY-obj.h*1.55);
    bg2.addColorStop(0,'rgba(255,255,255,0.2)');bg2.addColorStop(0.5,'rgba(255,255,255,0)');
    ctx.fillStyle=bg2;ctx.beginPath();ctx.roundRect(sx+3,gY-obj.h*1.55,obj.w-6,obj.h*1.3,10);ctx.fill();
    // 窓帯
    ctx.fillStyle='rgba(180,230,255,0.75)';ctx.beginPath();ctx.roundRect(sx+8,gY-obj.h*1.42,obj.w-16,obj.h*0.58,4);ctx.fill();
    // 窓の仕切り
    ctx.strokeStyle='rgba(0,80,140,0.5)';ctx.lineWidth=2;
    for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(sx+8+i*(obj.w-16)/5,gY-obj.h*1.42);ctx.lineTo(sx+8+i*(obj.w-16)/5,gY-obj.h*0.84);ctx.stroke();}
    // 行先表示
    ctx.fillStyle='#FFD700';ctx.fillRect(sx+8,gY-obj.h*1.58,60,12);
    ctx.fillStyle='#333';ctx.font='bold 8px Arial';ctx.textAlign='left';ctx.fillText('TOKYO',sx+11,gY-obj.h*1.5);
    // ドア
    ctx.fillStyle='rgba(0,0,0,0.2)';ctx.fillRect(sx+obj.w*0.15,gY-obj.h*0.84,22,obj.h*0.55);
  } else if(isTruck){
    // トラック: キャブ+荷台
    ctx.fillStyle='#888';ctx.beginPath();ctx.roundRect(sx,gY-obj.h*0.7,obj.w*0.52,obj.h*0.4,4);ctx.fill();
    // 荷台
    const tg=ctx.createLinearGradient(sx,gY-obj.h*0.7,sx+obj.w,gY-obj.h*0.7);
    tg.addColorStop(0,obj.col);tg.addColorStop(1,obj.col);
    ctx.fillStyle=tg;ctx.beginPath();ctx.roundRect(sx+2,gY-obj.h*0.9,obj.w*0.5,obj.h*0.6,4);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=1.5;
    for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(sx+2+i*obj.w*0.12,gY-obj.h*0.9);ctx.lineTo(sx+2+i*obj.w*0.12,gY-obj.h*0.3);ctx.stroke();}
    // キャブ
    ctx.fillStyle=obj.col;ctx.beginPath();ctx.roundRect(sx+obj.w*0.52,gY-obj.h*1.45,obj.w*0.46,obj.h*1.15,8);ctx.fill();
    ctx.fillStyle='rgba(180,230,255,0.8)';ctx.beginPath();ctx.roundRect(sx+obj.w*0.55,gY-obj.h*1.38,obj.w*0.38,obj.h*0.65,5);ctx.fill();
    // グリル
    ctx.fillStyle='#AAA';ctx.fillRect(sx+obj.w*0.96,gY-obj.h*0.65,8,obj.h*0.35);
    ctx.strokeStyle='#888';ctx.lineWidth=1.5;
    for(let g=0;g<4;g++){ctx.beginPath();ctx.moveTo(sx+obj.w*0.97,gY-obj.h*0.62+g*5);ctx.lineTo(sx+obj.w+4,gY-obj.h*0.62+g*5);ctx.stroke();}
  } else {
    // 乗用車
    ctx.fillStyle=obj.col;
    ctx.beginPath();ctx.roundRect(sx,gY-obj.h,obj.w,obj.h*0.7,6);ctx.fill();
    // ボンネット傾斜
    ctx.beginPath();ctx.moveTo(sx+8,gY-obj.h);ctx.lineTo(sx+obj.w*0.35,gY-obj.h*1.55);
    ctx.lineTo(sx+obj.w*0.78,gY-obj.h*1.55);ctx.lineTo(sx+obj.w-5,gY-obj.h);ctx.closePath();
    ctx.fill();
    // ガラス
    ctx.fillStyle='rgba(180,230,255,0.8)';
    ctx.beginPath();ctx.moveTo(sx+14,gY-obj.h*1.02);ctx.lineTo(sx+obj.w*0.38,gY-obj.h*1.52);
    ctx.lineTo(sx+obj.w*0.72,gY-obj.h*1.52);ctx.lineTo(sx+obj.w-10,gY-obj.h*1.02);ctx.closePath();ctx.fill();
    // ガラス反射
    ctx.fillStyle='rgba(255,255,255,0.35)';
    ctx.beginPath();ctx.moveTo(sx+16,gY-obj.h*1.02);ctx.lineTo(sx+obj.w*0.38,gY-obj.h*1.52);
    ctx.lineTo(sx+obj.w*0.5,gY-obj.h*1.52);ctx.lineTo(sx+26,gY-obj.h*1.02);ctx.closePath();ctx.fill();
    // ドアライン
    ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(sx+obj.w*0.5,gY-obj.h);ctx.lineTo(sx+obj.w*0.5,gY-obj.h*0.35);ctx.stroke();
    // ヘッドライト
    ctx.fillStyle='#FFFFCC';ctx.beginPath();ctx.ellipse(sx+obj.w-5,gY-obj.h*0.65,6,4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#FF4444';ctx.beginPath();ctx.ellipse(sx+5,gY-obj.h*0.65,5,3.5,0,0,Math.PI*2);ctx.fill();
  }
  // 車体下部シャドウ
  ctx.fillStyle='rgba(0,0,0,0.15)';ctx.fillRect(sx+4,gY-obj.h*0.32,obj.w-8,6);
  // ホイール（リアルな多層）
  const wpos=isBus?[[22,0],[obj.w-22,0]]:isTruck?[[22,0],[obj.w-22,0]]:[[18,0],[obj.w-18,0]];
  wpos.forEach(([dx])=>{
    // タイヤ
    ctx.fillStyle='#1A1A1A';ctx.beginPath();ctx.arc(sx+dx,gY,15,0,Math.PI*2);ctx.fill();
    // タイヤ側面
    ctx.fillStyle='#2A2A2A';ctx.beginPath();ctx.arc(sx+dx,gY,13,0,Math.PI*2);ctx.fill();
    // ホイール
    const wg=ctx.createRadialGradient(sx+dx,gY,2,sx+dx,gY,9);
    wg.addColorStop(0,'#DDDDDD');wg.addColorStop(1,'#888888');
    ctx.fillStyle=wg;ctx.beginPath();ctx.arc(sx+dx,gY,9,0,Math.PI*2);ctx.fill();
    // スポーク
    ctx.strokeStyle='#AAA';ctx.lineWidth=2;
    for(let s=0;s<5;s++){const a=s/5*Math.PI*2;
      ctx.beginPath();ctx.moveTo(sx+dx+Math.cos(a)*3,gY+Math.sin(a)*3);
      ctx.lineTo(sx+dx+Math.cos(a)*8,gY+Math.sin(a)*8);ctx.stroke();}
    ctx.fillStyle='#555';ctx.beginPath();ctx.arc(sx+dx,gY,3,0,Math.PI*2);ctx.fill();
  });
  // HPバー
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(sx,gY-obj.h-18,obj.w,6);
  ctx.fillStyle=r>0.6?'#44DD44':r>0.3?'#FFCC00':'#FF3300';ctx.fillRect(sx,gY-obj.h-18,obj.w*r,6);
  ctx.restore();
  applyStageTone(sx,gY-obj.h*1.6,obj.w,obj.h*1.6,obj.wx);
  if(obj.vx){obj.wx+=obj.vx*0.016;obj.vx*=0.88;if(Math.abs(obj.vx)<0.5)obj.vx=0;}
  if(obj.shakeDx)obj.shakeDx*=0.75;
}

function drawSnowman(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx),gY=toSY(obj.groundY);if(sx>W+10||sx+obj.w<-10)return;
  const r=obj.hp/obj.maxHp,cx=sx+obj.w/2;
  ctx.save();ctx.globalAlpha=0.28+r*0.72;ctx.translate(obj.shakeDx,0);
  [[0,20,24],[0,-13,18],[0,-36,12]].forEach(([dx,dy,rad])=>{ctx.fillStyle='#F0F8FF';ctx.beginPath();ctx.arc(cx+dx,gY+dy-16,rad,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#B0C8D8';ctx.lineWidth=1.5;ctx.stroke();});
  ctx.fillStyle='#333';[-24,-14,-4].forEach(dy=>{ctx.beginPath();ctx.arc(cx,gY+dy-16,2.5,0,Math.PI*2);ctx.fill();});
  ctx.beginPath();ctx.arc(cx-5,gY-50,2.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx+5,gY-50,2.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#FF6600';ctx.beginPath();ctx.moveTo(cx,gY-47);ctx.lineTo(cx+10,gY-46);ctx.lineTo(cx,gY-44);ctx.closePath();ctx.fill();
  ctx.fillStyle='#222';ctx.fillRect(cx-12,gY-68,24,4);ctx.fillRect(cx-8,gY-82,16,16);
  ctx.restore();obj.shakeDx*=0.75;
}

function drawRocket(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx),gY=toSY(obj.groundY);if(sx>W+10||sx+obj.w<-10)return;
  const r=obj.hp/obj.maxHp,cx=sx+obj.w/2;
  ctx.save();ctx.globalAlpha=0.3+r*0.7;ctx.translate(obj.shakeDx||0,0);
  const bw=obj.w*0.42;
  // ロケット本体（メタリックグラデ）
  const mg=ctx.createLinearGradient(cx-bw,gY-obj.h,cx+bw,gY-obj.h);
  mg.addColorStop(0,'#888');mg.addColorStop(0.3,'#EEE');mg.addColorStop(0.7,'#CCC');mg.addColorStop(1,'#666');
  ctx.fillStyle=mg;ctx.beginPath();ctx.roundRect(cx-bw,gY-obj.h*0.9,bw*2,obj.h*0.65,6);ctx.fill();
  // 先端コーン
  const cg=ctx.createLinearGradient(cx-bw,gY-obj.h*0.95,cx+bw,gY-obj.h*0.95);
  cg.addColorStop(0,'#CC1111');cg.addColorStop(0.4,'#FF3333');cg.addColorStop(1,'#AA0000');
  ctx.fillStyle=cg;ctx.beginPath();ctx.moveTo(cx,gY-obj.h);ctx.lineTo(cx-bw,gY-obj.h*0.88);ctx.lineTo(cx+bw,gY-obj.h*0.88);ctx.closePath();ctx.fill();
  // フィン
  [[-1],[1]].forEach(([d])=>{
    const fg=ctx.createLinearGradient(cx+d*bw,gY-obj.h*0.25,cx+d*bw*1.8,gY);
    fg.addColorStop(0,'#CC2222');fg.addColorStop(1,'#881111');
    ctx.fillStyle=fg;ctx.beginPath();ctx.moveTo(cx+d*bw,gY-obj.h*0.28);ctx.lineTo(cx+d*bw*1.7,gY-2);ctx.lineTo(cx+d*bw,gY-2);ctx.closePath();ctx.fill();
  });
  // 帯（カラーリング）
  ['#E03030','#FFFFFF','#E03030'].forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(cx-bw,gY-obj.h*(0.55-i*0.1),bw*2,6);});
  // ポートホール
  const pwg=ctx.createRadialGradient(cx,gY-obj.h*0.68,1,cx,gY-obj.h*0.68,9);
  pwg.addColorStop(0,'#E8F8FF');pwg.addColorStop(0.6,'#90D8F8');pwg.addColorStop(1,'#306090');
  ctx.fillStyle=pwg;ctx.beginPath();ctx.arc(cx,gY-obj.h*0.68,9,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#AAA';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,gY-obj.h*0.68,9,0,Math.PI*2);ctx.stroke();
  // 炎（アニメーション）
  const fl=0.5+Math.abs(Math.sin(Date.now()*0.03))*0.5;
  ctx.save();ctx.globalAlpha*=fl;
  const fg2=ctx.createRadialGradient(cx,gY-obj.h*0.25,2,cx,gY+10,16);
  fg2.addColorStop(0,'#FFFF80');fg2.addColorStop(0.4,'#FF8C00');fg2.addColorStop(1,'rgba(255,50,0,0)');
  ctx.fillStyle=fg2;ctx.beginPath();ctx.ellipse(cx,gY-obj.h*0.25+10,10,22,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
  // HPバー
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(sx,gY-obj.h-16,obj.w,5);
  ctx.fillStyle=r>0.5?'#44DD44':'#FF3300';ctx.fillRect(sx,gY-obj.h-16,obj.w*r,5);
  ctx.restore();obj.shakeDx=(obj.shakeDx||0)*0.75;
}


function drawHelicopter(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx);if(sx>W+60||sx+obj.w<-60)return;
  obj.wobble+=0.025;obj.rotorAngle=(obj.rotorAngle||0)+0.3;
  const fy=H*0.3+Math.sin(obj.wobble)*16,cx=sx+obj.w/2,r=obj.hp/obj.maxHp;
  ctx.save();ctx.globalAlpha=0.3+r*0.7;
  // 画像のヘリ(進行方向=左向き)。回るローターだけ canvas で上に重ねる
  const heliImg=api.drawAsset("helicopter.png",cx,fy+2,obj.w*1.4,obj.w*1.4,{center:true});
  if(!heliImg){
  // Body
  ctx.fillStyle='#4A90D9';ctx.beginPath();ctx.ellipse(cx,fy,obj.w*0.38,obj.h*0.42,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#2A70B9';ctx.fillRect(cx+obj.w*0.2,fy-5,obj.w*0.35,14);
  ctx.fillStyle='rgba(180,230,255,0.6)';ctx.beginPath();ctx.ellipse(cx-5,fy-4,16,10,0,0,Math.PI*2);ctx.fill();
  // Tail
  ctx.fillStyle='#4A90D9';ctx.beginPath();ctx.moveTo(cx-obj.w*0.38,fy);ctx.lineTo(cx-obj.w*0.62,fy-8);ctx.lineTo(cx-obj.w*0.62,fy+5);ctx.closePath();ctx.fill();
  }
  // Main rotor
  const rotY=heliImg?fy-obj.w*0.4:fy-obj.h*0.45;   // 画像のローター位置(上から約2割)に合わせる
  ctx.strokeStyle=heliImg?'rgba(40,40,50,0.55)':'#333';ctx.lineWidth=heliImg?3:4;ctx.lineCap='round';
  for(let i=0;i<3;i++){
    const a=obj.rotorAngle+i/3*Math.PI*2;
    ctx.beginPath();ctx.moveTo(cx,rotY);
    ctx.lineTo(cx+Math.cos(a)*obj.w*0.55,rotY+Math.sin(a)*8);ctx.stroke();
  }
  // HP bar
  ctx.fillStyle='#333';ctx.fillRect(sx,fy-28,obj.w,5);
  ctx.fillStyle=r>0.5?'#4CAF50':'#F44336';ctx.fillRect(sx,fy-28,obj.w*r,5);
  ctx.restore();
}
function drawUFO(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx);if(sx>W+60||sx+obj.w<-60)return;
  obj.wobble+=0.03;
  const fy=obj.baseY+Math.sin(obj.wobble)*14,cx=sx+obj.w/2,r=obj.hp/obj.maxHp;
  ctx.save();ctx.globalAlpha=0.3+r*0.7;
  const g2=ctx.createLinearGradient(cx,fy+obj.h/2,cx,toSY(getTerrainY(obj.wx+obj.w/2)));
  g2.addColorStop(0,'rgba(100,255,100,0.28)');g2.addColorStop(1,'rgba(100,255,100,0)');
  ctx.fillStyle=g2;
  ctx.beginPath();ctx.moveTo(cx-15,fy+obj.h/2);ctx.lineTo(cx+15,fy+obj.h/2);ctx.lineTo(cx+38,H*TERRAIN_BASE);ctx.lineTo(cx-38,H*TERRAIN_BASE);ctx.closePath();ctx.fill();
  // UFO本体は手描き(生成画像 ufo.png は情景が写り込む不良が続いたため不採用)
  {
    ctx.fillStyle='#888';ctx.beginPath();ctx.ellipse(cx,fy+8,obj.w/2,obj.h*.38,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#B3E5FC';ctx.beginPath();ctx.ellipse(cx,fy-2,obj.w*.28,obj.h*.46,0,0,Math.PI*2);ctx.fill();
    const t=Date.now()*.003;
    ['#FF4040','#40FF40','#4040FF','#FFD700'].forEach((c,i)=>{const ang=i/4*Math.PI*2+t;ctx.fillStyle=c;ctx.beginPath();ctx.arc(cx+Math.cos(ang)*obj.w*.35,fy+8+Math.sin(ang)*4,5,0,Math.PI*2);ctx.fill();});
  }
  ctx.fillStyle='#333';ctx.fillRect(sx,fy-16,obj.w,5);ctx.fillStyle=r>0.5?'#4CAF50':'#F44336';ctx.fillRect(sx,fy-16,obj.w*r,5);
  ctx.restore();
}

function drawBalloon(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx),gY=toSY(obj.groundY);if(sx>W+10||sx+obj.w<-10)return;
  obj.wobble+=0.018;
  const fy=gY-obj.floatH+Math.sin(obj.wobble)*10,cx=sx+obj.w/2;
  ctx.save();ctx.strokeStyle='#888';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cx,fy+obj.h);ctx.lineTo(cx,gY-5);ctx.stroke();
  ctx.fillStyle=obj.col;ctx.beginPath();ctx.ellipse(cx,fy+obj.h*.4,obj.w*.42,obj.h*.52,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.28)';ctx.beginPath();ctx.ellipse(cx-8,fy+obj.h*.22,8,13,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#8B4513';ctx.fillRect(cx-10,fy+obj.h-3,20,14);
  ctx.restore();
}

function drawBarrel(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx),gY=toSY(obj.groundY);if(sx>W+10||sx+obj.w<-10)return;
  const r=obj.hp/obj.maxHp,cx=sx+obj.w/2;
  ctx.save();ctx.globalAlpha=0.3+r*0.7;ctx.translate(obj.shakeDx||0,0);
  const bg=ctx.createLinearGradient(sx,0,sx+obj.w,0);
  bg.addColorStop(0,'#660000');bg.addColorStop(0.25,'#CC1111');bg.addColorStop(0.7,'#AA0000');bg.addColorStop(1,'#550000');
  ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(sx+3,gY-obj.h,obj.w-6,obj.h,6);ctx.fill();
  // 金属タガ
  ['#FFD700','#DAA520'].forEach((c,idx)=>{
    const ty=gY-obj.h*(idx===0?0.78:0.28);
    const hg=ctx.createLinearGradient(sx,ty,sx+obj.w,ty);
    hg.addColorStop(0,'#888');hg.addColorStop(0.3,c);hg.addColorStop(0.7,c);hg.addColorStop(1,'#666');
    ctx.fillStyle=hg;ctx.fillRect(sx,ty,obj.w,8);
    ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1;ctx.strokeRect(sx,ty,obj.w,8);
  });
  // 上面楕円
  const tg=ctx.createRadialGradient(cx,gY-obj.h,1,cx,gY-obj.h,obj.w/2);
  tg.addColorStop(0,'#FF4444');tg.addColorStop(1,'#880000');
  ctx.fillStyle=tg;ctx.beginPath();ctx.ellipse(cx,gY-obj.h,obj.w/2-3,7,0,0,Math.PI*2);ctx.fill();
  // 危険マーク
  ctx.fillStyle='#FFD700';ctx.beginPath();
  ctx.moveTo(cx,gY-obj.h*0.5-6);ctx.lineTo(cx+7,gY-obj.h*0.5+6);ctx.lineTo(cx-7,gY-obj.h*0.5+6);
  ctx.closePath();ctx.fill();
  ctx.fillStyle='#7A3000';ctx.fillRect(cx-1,gY-obj.h*0.5-3,2,5);ctx.fillRect(cx-1,gY-obj.h*0.5+3,2,2);
  ctx.restore();obj.shakeDx=(obj.shakeDx||0)*0.75;
}

function drawFence(obj){
  const sx=toS(obj.wx),gY=toSY(obj.groundY);if(sx>W+10||sx+obj.w<-10)return;
  ctx.fillStyle='#C8A060';ctx.fillRect(sx,gY-obj.h*0.7,obj.w,7);ctx.fillRect(sx,gY-obj.h*0.3,obj.w,7);
  obj.posts.forEach((p,i)=>{if(!p.alive)return;ctx.fillStyle='#8B6030';ctx.fillRect(sx+i*28,gY-obj.h,22,obj.h);ctx.fillStyle='#6B4020';ctx.fillRect(sx+i*28+18,gY-obj.h,4,obj.h);});
}

function drawHouse(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx),gY=toSY(obj.groundY);
  if(sx>W+10||sx+obj.w<-10)return;
  // Body section
  const body=obj.sections[0],roof=obj.sections[1];
  if(body&&body.alive){
    const r=body.hp/body.maxHp;
    ctx.save();ctx.globalAlpha=0.3+r*0.7;ctx.translate(body.shakeDx||0,0);
    ctx.fillStyle=obj.col;ctx.fillRect(sx,body.drawTopY,obj.w,body.h);
    ctx.fillStyle=obj.dark;ctx.fillRect(sx+obj.w-6,body.drawTopY,6,body.h);
    body.wins.forEach(w=>{ctx.fillStyle=w.lit?'#FFFACD':'#6080A0';ctx.fillRect(sx+w.lx,body.drawTopY+w.ly,18,22);});
    ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(sx,body.drawTopY,obj.w,5);
    ctx.fillStyle=r>0.6?'#4CAF50':r>0.3?'#FFC107':'#F44336';ctx.fillRect(sx,body.drawTopY,obj.w*r,5);
    ctx.restore();body.shakeDx=(body.shakeDx||0)*0.7;
  }
  if(roof&&roof.alive){
    const r=roof.hp/roof.maxHp;
    const rt=roof.drawTopY;
    ctx.save();ctx.globalAlpha=0.3+r*0.7;ctx.translate(roof.shakeDx||0,0);
    // Triangle roof
    ctx.fillStyle=obj.roof;
    ctx.beginPath();ctx.moveTo(sx-6,rt+roof.h);ctx.lineTo(sx+obj.w/2,rt);ctx.lineTo(sx+obj.w+6,rt+roof.h);ctx.closePath();ctx.fill();
    // Chimney
    ctx.fillStyle='#886644';ctx.fillRect(sx+obj.w*0.7,rt-18,12,22);
    ctx.restore();roof.shakeDx=(roof.shakeDx||0)*0.7;
  }
  if(obj.sections.every(s=>!s.alive))obj.alive=false;
}
function drawTrain(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx),gY=toSY(obj.groundY);
  if(sx>W+10||sx+obj.w<-10)return;
  const r=obj.hp/obj.maxHp;
  ctx.save();ctx.globalAlpha=0.3+r*0.7;ctx.translate(obj.shakeDx||0,0);
  // Carriages
  ctx.fillStyle=obj.col;ctx.beginPath();ctx.roundRect(sx,gY-obj.h,obj.w,obj.h*0.7,6);ctx.fill();
  // Cab
  ctx.fillStyle=obj.dark;ctx.beginPath();ctx.roundRect(sx+obj.w*0.7,gY-obj.h*1.35,obj.w*0.28,obj.h*1.05,6);ctx.fill();
  // Windows
  ctx.fillStyle='rgba(180,230,255,0.7)';
  [0.08,0.28,0.48].forEach(t=>ctx.fillRect(sx+obj.w*t,gY-obj.h*0.85,22,18));
  ctx.fillRect(sx+obj.w*0.72,gY-obj.h*1.28,22,18);
  // Wheels
  ctx.fillStyle='#222';
  [0.12,0.32,0.52,0.72,0.88].forEach(t=>{
    ctx.beginPath();ctx.arc(sx+obj.w*t,gY,14,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#888';ctx.beginPath();ctx.arc(sx+obj.w*t,gY,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#222';
  });
  // Smoke stack
  ctx.fillStyle='#444';ctx.fillRect(sx+obj.w*0.82,gY-obj.h*1.6,10,obj.h*0.35);
  // HP
  ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(sx,gY-obj.h-18,obj.w,6);
  ctx.fillStyle=r>0.6?'#4CAF50':r>0.3?'#FFC107':'#F44336';ctx.fillRect(sx,gY-obj.h-18,obj.w*r,6);
  ctx.restore();if(obj.shakeDx)obj.shakeDx*=0.75;
}
function drawObj(obj){
  if(!obj.alive&&obj.kind!=='fence')return;
  switch(obj.kind){
    case 'building':drawBuilding(obj);break;
    case 'watertower':drawWaterTower(obj);break;
    case 'tree':drawTree(obj);break;
    case 'cactus':drawCactus(obj);break;
    case 'car':case 'bus':case 'truck':drawVehicle(obj);break;
    case 'snowman':drawSnowman(obj);break;
    case 'rocket':drawRocket(obj);break;
    case 'balloon':drawBalloon(obj);break;
    case 'gem':drawGem(obj);break;
    case 'barrel':drawBarrel(obj);break;
    case 'fence':drawFence(obj);break;
    case 'megabuilding':drawMegaBuilding(obj);break;
    case 'boss':drawBoss(obj);break;
    case 'house':drawHouse(obj);break;
    case 'train':drawTrain(obj);break;
  }
}

function drawMegaBuilding(obj){
  if(!obj.alive)return;
  const sx=toS(obj.wx);if(sx>W+20||sx+obj.w<-20)return;
  obj.sections.forEach(sec=>{
    if(!sec.alive)return;
    const r=sec.hp/sec.maxHp;
    ctx.save();ctx.globalAlpha=0.3+r*0.7;
    ctx.fillStyle=sec.col;
    ctx.fillRect(sx+sec.shakeDx,sec.drawTopY,obj.w,sec.h);
    // Thin border for depth
    ctx.strokeStyle='rgba(0,0,0,0.28)';ctx.lineWidth=1;
    ctx.strokeRect(sx+sec.shakeDx,sec.drawTopY,obj.w,sec.h);
    // Crack line when damaged
    if(r<0.55){
      ctx.strokeStyle='rgba(80,30,0,0.55)';ctx.lineWidth=2;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.moveTo(sx+sec.shakeDx,sec.drawTopY+sec.h);
      ctx.lineTo(sx+sec.shakeDx+obj.w,sec.drawTopY+sec.h);ctx.stroke();ctx.setLineDash([]);
    }
    // HP bar
    ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(sx,sec.drawTopY,obj.w,4);
    ctx.fillStyle=r>0.6?'#4CAF50':r>0.3?'#FFC107':'#F44336';
    ctx.fillRect(sx,sec.drawTopY,obj.w*r,4);
    ctx.restore();
    sec.shakeDx*=0.7;
  });
}

function updateBuildingPhysics(dt){
  worldObjs.forEach(obj=>{
    if((obj.kind!=='building'&&obj.kind!=='megabuilding'&&obj.kind!=='house'&&obj.kind!=='boss')||!obj.alive)return;
    const sx=toS(obj.wx);
    let lowestLanded=-1;
    obj.sections.forEach((sec,i)=>{
      if(!sec.alive||!sec.falling)return;
      sec.fallVY=(sec.fallVY||0)+1.6*dt;
      sec.drawTopY+=sec.fallVY*dt;
      if(sec.drawTopY>=sec.targetTopY){
        sec.drawTopY=sec.targetTopY;
        const impactV=sec.fallVY;
        sec.falling=false;sec.fallVY=0;
        // Hard landing damage: if fell fast, section itself cracks
        if(impactV>10){
          sec.hp=Math.max(0,sec.hp-impactV*2.5);
          if(sec.hp<=0&&sec.alive){
            sec.alive=false;
            spawnFrag(sx,sec.drawTopY,obj.w,sec.h,[sec.col||obj.col,'#CCC','#AAA'],0.8);
            // Chain: sections above now need to fall further
            for(let j=i+1;j<obj.sections.length;j++){
              if(!obj.sections[j].alive)continue;
              obj.sections[j].targetTopY+=sec.h;
              obj.sections[j].falling=true;
            }
          }
        }
        if(i<lowestLanded||lowestLanded<0)lowestLanded=i;
      }
    });
    if(lowestLanded>=0){
      addShake(7);
      spawnHitFx(sx+obj.w/2,obj.sections[lowestLanded].drawTopY,'#FF8800',5);
    }
    if(obj.sections.every(s=>!s.alive)){
      obj.alive=false;
      if(obj.kind==='megabuilding'){addScore(200);playExplode();addShake(20);}
    }
  });
}
function drawExcavator(){
  const tcwx=exWorldX+55;
  const gY=toSY(getTerrainY(tcwx));
  const ang=getSlopeAngle(tcwx);
  const pv=pivScreen(),tp=getTip();
  // Fever rainbow cycle
  const feverHue=feverActive?(Date.now()*0.4%360):0;
  const feverColor=feverActive?`hsl(${feverHue},100%,55%)`:'#FFE033';
  const feverColor2=feverActive?`hsl(${(feverHue+40)%360},100%,45%)`:'#FFAA00';
  const feverCab=feverActive?`hsl(${(feverHue+80)%360},100%,60%)`:'#FFD700';
  const feverWindow=feverActive?`hsl(${(feverHue+160)%360},100%,75%)`:'#B3E5FC';
  const feverTrack=feverActive?`hsl(${(feverHue+200)%360},80%,35%)`:'#2A2A2A';
  ctx.save();ctx.translate(toS(tcwx),gY);ctx.rotate(ang);
  // Outer fever glow (画像/手描き共通・車体の後ろ)
  if(feverActive){
    ctx.save();ctx.globalAlpha=0.35+Math.sin(Date.now()*0.012)*0.2;
    ctx.shadowBlur=30;ctx.shadowColor=`hsl(${feverHue},100%,60%)`;
    ctx.fillStyle=`hsl(${feverHue},100%,65%)`;
    ctx.beginPath();ctx.roundRect(-62,-66,128,50,14);ctx.fill();
    ctx.restore();
  }
  // 画像の車体(キャブ+キャタピラ)。フィーバー中は色相を12段階に量子化して着色複製(キャッシュ肥大防止)
  //   生成画像は上部(42%より上)に余分なブーム、最下部(94%より下)に影の残りがあるため、
  //   その範囲を clip で切り落とし、キャタピラの底(=画像の94%位置)を地面(y=0)に合わせる。
  //   ゲーム側のアーム支点は画像のブーム根元(キャブ屋根)付近に来る。
  let bodyImg=false;
  {
    const exImg=api.asset("excavator.png");
    if(exImg.ready){
      let src=exImg;
      if(feverActive){const qh=Math.floor(feverHue/30)*30;src=api.tinted("excavator.png",`hsl(${qh},100%,55%)`,0.4)||exImg;}
      const S=140, top=-S*0.94;
      ctx.save();ctx.beginPath();ctx.rect(-S/2-2,top+S*0.42,S+4,S*(0.94-0.42)+1);ctx.clip();
      api.drawSrc(src,0,top+S/2,S,S,{center:true});
      ctx.restore();
      bodyImg=true;
    }
  }
  if(!bodyImg){
  // Tracks
  ctx.fillStyle=feverTrack;ctx.beginPath();ctx.roundRect(-65,-24,130,24,12);ctx.fill();
  ctx.fillStyle=feverActive?`hsl(${(feverHue+220)%360},70%,50%)`:'#444';
  for(let i=0;i<8;i++)ctx.fillRect(-63+i*16,-22,12,20);
  // Body
  const bg=ctx.createLinearGradient(0,-58,0,-22);bg.addColorStop(0,feverColor);bg.addColorStop(1,feverColor2);
  ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(-54,-58,112,36,8);ctx.fill();
  // Cab
  ctx.fillStyle=feverCab;ctx.beginPath();ctx.roundRect(-50,-94,60,40,8);ctx.fill();
  ctx.fillStyle=feverWindow;ctx.beginPath();ctx.roundRect(-46,-91,52,34,5);ctx.fill();
  ctx.strokeStyle=feverActive?`hsl(${(feverHue+30)%360},100%,60%)`:'#FFB300';ctx.lineWidth=2;ctx.strokeRect(-46,-91,52,34);
  }
  ctx.restore();
  // Arms in screen space — 3-joint FABRIK
  const segOuter=feverActive?[`hsl(${(feverHue+100)%360},100%,38%)`,`hsl(${(feverHue+130)%360},100%,35%)`,`hsl(${(feverHue+160)%360},100%,32%)`]:['#993300','#883000','#772800'];
  const segInner=feverActive?[`hsl(${(feverHue+110)%360},100%,55%)`,`hsl(${(feverHue+140)%360},100%,52%)`,`hsl(${(feverHue+170)%360},100%,48%)`]:['#FF8C00','#FF6600','#FF4400'];
  const segW=[[15,9],[12,7],[10,6]];
  ctx.save();ctx.lineCap='round';
  for(let i=0;i<3;i++){
    ctx.strokeStyle=segOuter[i];ctx.lineWidth=segW[i][0];
    ctx.beginPath();ctx.moveTo(tp.pts[i].x,tp.pts[i].y);ctx.lineTo(tp.pts[i+1].x,tp.pts[i+1].y);ctx.stroke();
    ctx.strokeStyle=segInner[i];ctx.lineWidth=segW[i][1];
    ctx.beginPath();ctx.moveTo(tp.pts[i].x,tp.pts[i].y);ctx.lineTo(tp.pts[i+1].x,tp.pts[i+1].y);ctx.stroke();
  }
  // Bucket
  const j3=tp.pts[3];
  ctx.save();ctx.translate(j3.x,j3.y);ctx.rotate(Math.atan2(tp.x-j3.x,-(tp.y-j3.y)));
  // スクエアバケット（トゲなし）
  const bkCol=feverActive?`hsl(${feverHue},100%,50%)`:'#993300';
  const bkStroke=feverActive?`hsl(${(feverHue+30)%360},100%,35%)`:'#661100';
  ctx.fillStyle=bkCol;
  ctx.beginPath();ctx.roundRect(-22,-4,44,40,[2,2,10,10]);ctx.fill();
  ctx.strokeStyle=bkStroke;ctx.lineWidth=2.5;ctx.stroke();
  // 内側の暗い部分（深さの表現）
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ctx.beginPath();ctx.roundRect(-15,2,30,26,[1,1,7,7]);ctx.fill();
  // 上端の補強バー
  ctx.fillStyle=feverActive?`hsl(${(feverHue+20)%360},100%,45%)`:'#7A2800';
  ctx.fillRect(-24,-4,48,8);
  ctx.restore();
  // Joints (3 joints)
  tp.pts.forEach((pt,i)=>{
    if(i===0)return;
    const r=7-i;
    ctx.fillStyle='#333';ctx.beginPath();ctx.arc(pt.x,pt.y,r+2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=feverActive?`hsl(${(feverHue+i*40)%360},100%,65%)`:'#999';
    ctx.beginPath();ctx.arc(pt.x,pt.y,r,0,Math.PI*2);ctx.fill();
  });
  // Fever sparks
  if(feverActive){
    for(let i=0;i<4;i++){
      const a=rng()*Math.PI*2,r=15+rng()*55;
      ctx.fillStyle=`hsl(${(feverHue+rng()*60)%360},100%,65%)`;
      ctx.globalAlpha=0.5+rng()*0.5;ctx.beginPath();ctx.arc(tp.x+Math.cos(a)*r*0.4,tp.y+Math.sin(a)*r*0.4,2+rng()*5,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  ctx.restore();
}

// ── MAIN LOOP ──────────────────────────────────────────────────
function frame(dt,now){
  W=api.W;H=api.H;
  bossHudShown=false;   // 毎フレームリセット。drawBoss()で描いたときだけtrueにしてコンボ表示の位置を下げる
  try{

  // Move
  // 第3ラウンド改善(軸3): 前後移動を指の位置から切り離し、常に一定速度でゆっくり自動前進させる。
  // 旧仕様(指が画面中心よりどちらにあるかで前進/後退・速度まで決まる)は、狙いを微調整するほど
  // 前進後退が入れ替わって正味の移動距離が伸びず、無得点区間が長引く実害があったため撤去。
  // 指の役割はアーム(バケット)の狙いだけに専念できるようにする。
  {
    const CRUISE_SPEED=MOVE_SPEED*0.58; // 旧仕様の中間〜やや速め程度の巡航速度
    const blockX=getForwardBlockX();
    exWorldX+=CRUISE_SPEED*dt;
    if(exWorldX>blockX) exWorldX=blockX;
  }

  // やさしさ保険: 前をふさぐ建物のところまで来て動けない状態が続いたら、
  // バケットが自動で削って必ず先へ進める(狙って壊すと後退してしまう操作なので、
  // 5歳児が同じ場所で詰まり続けないようにする)。手で壊せば当然そちらが速い。
  {
    idleT+=dt;
    const _bx=getForwardBlockX();
    const nearWall=(_bx!==Infinity)&&(_bx-exWorldX<420);
    // 第3ラウンド改善: 常時自動前進になった結果、壁(建物等)に着く頻度そのものが上がった。
    // 旧しきい値(90フレーム=1.5秒)のままだと「壁に着けば即おたすけ」が主戦術になり、
    // ランダム連打でもスコアが伸びてしまう(軸3(a)に反する)ため、しきい値を大幅に引き上げ、
    // 自力のタップで壊す時間をきちんと確保してから保険が効くようにする。
    if(!assisting && nearWall && idleT>420){ assisting=true; stageUsedAssist=true; }   // しばらく何も壊せず前がふさがっている(=③パーフェクトは崩れる)
    if(assisting){ if(nearWall) assistBreak(); else assisting=false; }
    // やさしさ保険その2: 次の壊す対象がまだ遠く(壁際の保険が働く距離の外)にあり、
    // それでも長く何も壊せていない(=タップが弾を結ばず迷子になっている)ときは、
    // 得点を一切増やさずゆっくり前ににじり寄らせる(連打を有利にしない/狙う楽しさは変えない)。
    // 第3ラウンド改善: 通常の自動前進(CRUISE_SPEED)で大半はカバーされるが、万一に備えた
    // 保険としてクロール速度と発動しきい値を強化(旧: 1.0*dt / 300フレーム→ 3.0*dt / 180フレーム)。
    if(!nearWall && idleT>180){
      exWorldX+=3.0*dt;
      if(_bx!==Infinity && exWorldX>_bx) exWorldX=_bx;
    }
  }

  // Camera
  const tcX=exWorldX-EXCAV_SCR();
  camX+=(tcX-camX)*0.12;camX=Math.max(0,camX);
  // Gentle Y follow
  // カメラの縦追従は行わない(camY=0固定)。
  // 理由: 当たり判定(hitBuilding)はセクションのワールドY(drawTopY)を、指先tpは画面Yを使っており、
  // camYが0でないと最大110pxずれてバケットが当たらず、坂で進行不能になる(移植元からの不具合)。
  // 地形の起伏は±110pxなのでcamY=0でも画面内に収まる。
  camY=0;

  // Spawn
  while(nextSpawnX<camX+W+700)spawnScene();
  // 通常オブジェクト: 500px後ろで消去, ボス: 2000px後ろまで保持
  worldObjs=worldObjs.filter(o=>o.kind==='boss'?toS(o.wx)>-2000:toS(o.wx)>-500);
  flyingObjs.forEach(o=>{o.wx+=o.vx*dt;});
  flyingObjs=flyingObjs.filter(o=>o.alive&&toS(o.wx)>-200&&toS(o.wx)<W+200);

  // Combo/fever
  if(comboTimer>0){comboTimer-=dt;if(comboTimer<=0)resetCombo();}
  updateFever(dt);
  updateArmTarget();
  if(feverActive)feverAttack();
  updateBuildingPhysics(dt);

  // Shake
  shakeX*=0.78;shakeY*=0.78;

  ctx.clearRect(0,0,W,H);
  drawTerrain();

  ctx.save();ctx.translate(Math.round(shakeX),Math.round(shakeY));

  drawStageGoalBanner();
  worldObjs.forEach(drawObj);
  flyingObjs.forEach(o=>o.kind==='helicopter'?drawHelicopter(o):drawUFO(o));

  // IK
  // arm target updated via updateArmTarget() above

  drawExcavator();
  // (旧: 移動方向インジケーターはここにあったが、前後移動を自動化した第3ラウンド改善で
  //  「指の位置が方向を決める」という前提が無くなったため撤去。狙い中は下記の当たり判定のみ。)
  if(armTouching)checkHit();
  if(hitCD>0)hitCD--;

  const gY=H*TERRAIN_BASE;

  // Shockwaves
  shockwaves=shockwaves.filter(sw=>sw.alpha>0.01);
  shockwaves.forEach(sw=>{sw.r+=7*dt;sw.alpha-=0.03*dt;ctx.save();ctx.strokeStyle=`rgba(255,140,50,${sw.alpha})`;ctx.lineWidth=4;ctx.beginPath();ctx.arc(sw.x,sw.y,sw.r,0,Math.PI*2);ctx.stroke();ctx.restore();});

  // Smokes
  smokes=smokes.filter(s=>s.alpha>0.01);
  smokes.forEach(s=>{s.x+=s.vx*dt;s.y+=s.vy*dt;s.r+=s.grow*dt;s.alpha-=0.006*dt;ctx.save();ctx.globalAlpha=Math.max(0,s.alpha);ctx.fillStyle=s.col;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.restore();});

  // Particles
  particles=particles.filter(p=>p.alpha>0.02);
  particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=0.6*dt;p.alpha-=0.04*dt;ctx.save();ctx.globalAlpha=Math.max(0,p.alpha);ctx.fillStyle=p.col;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);ctx.restore();});

  // Fragments
  const gYscreen=toSY(getTerrainY(exWorldX+55));
  fragments=fragments.filter(f=>f.alpha>0.02&&f.y<H+80);
  fragments.forEach(f=>{
    f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=0.7*dt;f.vx*=0.99;f.rot+=f.rotv*dt;
    if(f.y>gYscreen&&!f.grounded){f.vy*=-0.3;f.vx*=0.6;f.rotv*=0.4;f.grounded=true;}
    if(f.y>gYscreen+28)f.alpha-=0.025*dt;
    ctx.save();ctx.globalAlpha=Math.max(0,f.alpha);ctx.translate(f.x,f.y);ctx.rotate(f.rot);
    ctx.fillStyle=f.col;ctx.fillRect(-f.w/2,-f.h/2,f.w,f.h);
    ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=1;ctx.strokeRect(-f.w/2,-f.h/2,f.w,f.h);
    ctx.restore();
  });
  ctx.restore();

  checkStageGoal();
  if(stageClearing){stageClearTimer-=dt;
    if(stageClearTimer<=0){ stageClearing=false; clearMsg.classList.remove('show');
      if(pendingLoop){ pendingLoop=false; loopCount++; initScene(true); } }}

  drawHUD(dt);
  }catch(e){ throw e; }
}



function initScene(keepScore){
  worldObjs=[];flyingObjs=[];fragments=[];particles=[];smokes=[];shockwaves=[];clouds=[];
  bossSpawned=[false,false,false,false,false];
  exWorldX=80;camX=0;camY=0;
  if(!keepScore){ score=0;scoreEl.textContent=0; }
  power=0;feverActive=false;feverTimer=0;feverLabel.style.display='none';
  powerFill.style.width='0%';powerFill.style.background='linear-gradient(90deg,#FF6600,#FFD700)';
  currentStage=0;stNumEl.textContent=1;stageClearing=false;stageClearTimer=0;
  stageUsedAssist=false;   // ③ パーフェクト区間の判定をリセット
  clearMsg.classList.remove('show');nextSpawnX=260;_s=Date.now()|0;
  resetCombo();
  while(nextSpawnX<camX+W+700)spawnScene();
  spawnAllBosses(); // 全ボスを事前配置
  for(let i=0;i<8;i++)clouds.push({wx:rng()*2000,y:25+rng()*110,spd:0.35+rng()*0.4,sz:45+rng()*55});
}


  // ── HUD(canvas手描き) ────────────────────────────────────────
  // 鉄則: 画面の隅(x<120 / x>W-120 かつ y<56)は engine の もどる/スコア/ミュート 領域なので描かない。
  function rrect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function drawHUD(dt){
    // キラキラ(旧DOM星)
    for(let i=0;i<stars.length;i++){const s=stars[i];
      s.y+=s.vy*dt; s.vy*=0.97; s.rot+=s.vr*dt; s.life-=0.016*dt;
      if(s.life<=0)continue;
      ctx.save();ctx.globalAlpha=Math.max(0,s.life);ctx.translate(s.x,s.y);ctx.rotate(s.rot);
      ctx.fillStyle=s.col;ctx.shadowBlur=10;ctx.shadowColor=s.col;
      ctx.beginPath();
      for(let k=0;k<5;k++){const a=-Math.PI/2+k*Math.PI*2/5;
        ctx.lineTo(Math.cos(a)*s.s*0.5,Math.sin(a)*s.s*0.5);
        const a2=a+Math.PI/5; ctx.lineTo(Math.cos(a2)*s.s*0.2,Math.sin(a2)*s.s*0.2);}
      ctx.closePath();ctx.fill();ctx.restore();}
    ctx.shadowBlur=0;ctx.globalAlpha=1;
    stars=stars.filter(function(s){return s.life>0;});

    const cx=W/2;
    // 上部中央: ステージ + 目的地までのゲージ
    const stName=(STAGES[currentStage]&&STAGES[currentStage].name)||'';
    ctx.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";ctx.textAlign='center';
    ctx.lineWidth=5;ctx.lineJoin='round';ctx.strokeStyle='rgba(10,25,45,.65)';
    const head='ステージ '+(currentStage+1)+' / 5   '+stName;
    ctx.strokeText(head,cx,26);ctx.fillStyle='#fff';ctx.fillText(head,cx,26);
    // 進行ゲージ
    const gw=Math.min(W*0.5,240),gx=cx-gw/2,gy=34;
    const sx0=STAGE_X[currentStage],slen=(STAGES[currentStage]&&STAGES[currentStage].len)||1;
    const prog=clamp((exWorldX-sx0)/slen,0,1);
    ctx.fillStyle='rgba(10,25,45,.45)';rrect(gx,gy,gw,7,3.5);ctx.fill();
    ctx.fillStyle='#7be0ff';rrect(gx,gy,gw*prog,7,3.5);ctx.fill();
    // コンボ(ボスHPバー表示中はその下(132px)へずらして重ならないようにする)
    if(comboCount>=2){
      const comboY=bossHudShown?132:72;
      ctx.font="900 22px 'Hiragino Maru Gothic ProN',system-ui";
      ctx.lineWidth=6;ctx.strokeStyle='rgba(60,10,0,.6)';
      const ct='コンボ x'+comboCount;
      ctx.strokeText(ct,cx,comboY);
      ctx.fillStyle=comboCount>=5?'#ff5b5b':'#ffd23f';ctx.fillText(ct,cx,comboY);
    }
    // 下部中央: パワー / フィーバー
    const pw=Math.min(W*0.5,220),px=cx-pw/2,py=H-30;
    ctx.fillStyle='rgba(0,0,0,.45)';rrect(px-4,py-4,pw+8,20,10);ctx.fill();
    ctx.lineWidth=2;ctx.strokeStyle='rgba(255,255,255,.5)';rrect(px-4,py-4,pw+8,20,10);ctx.stroke();
    if(power>0.01){
      const pg=ctx.createLinearGradient(px,0,px+pw,0);
      if(feverActive){pg.addColorStop(0,'#ff00ff');pg.addColorStop(1,'#ffff00');}
      else{pg.addColorStop(0,'#ff6600');pg.addColorStop(1,'#ffd23f');}
      ctx.fillStyle=pg;rrect(px,py,pw*power,12,6);ctx.fill();
    }
    ctx.font="800 13px 'Hiragino Maru Gothic ProN',system-ui";ctx.textAlign='center';
    ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.55)';
    const plabel=feverActive?'フィーバー！ てんすう 3ばい':'パワー';
    ctx.strokeText(plabel,cx,py-9);
    ctx.fillStyle=feverActive?'#ffe14a':'#fff';ctx.fillText(plabel,cx,py-9);
    // クリア バナー
    if(clearMsg._show){
      const t=clamp(stageClearTimer/160,0,1),pop=1+0.12*Math.sin(now01*9);
      ctx.save();ctx.globalAlpha=Math.min(1,t*3);
      ctx.translate(cx,H*0.4);ctx.scale(pop,pop);
      ctx.font="900 "+Math.round(clamp(W*0.085,30,60))+"px 'Hiragino Maru Gothic ProN',system-ui";
      ctx.textAlign='center';ctx.lineJoin='round';
      ctx.lineWidth=10;ctx.strokeStyle='rgba(20,12,40,.7)';ctx.strokeText(clearMsg.textContent,0,0);
      const bg=ctx.createLinearGradient(0,-30,0,34);
      bg.addColorStop(0,'#fff6c8');bg.addColorStop(1,'#ffb000');
      ctx.fillStyle=bg;ctx.fillText(clearMsg.textContent,0,0);
      ctx.restore();ctx.globalAlpha=1;
    }
    // ① にじいろジェム 接近予告: 画面右外にジェムが控えていたら右ふちに虹のシェブロン(ドキドキ)
    if(worldObjs.some(o=>o.kind==='gem'&&o.alive&&toS(o.wx)>W)){
      const yy=H*0.5,pulse=0.5+0.5*Math.sin(Date.now()*0.006),cc=['#FF3B6B','#FFE14A','#3BA6FF'];
      ctx.save();ctx.globalAlpha=0.45+0.4*pulse;ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';
      for(let k=0;k<3;k++){ctx.strokeStyle=cc[k];const ox=W-12-k*13;
        ctx.beginPath();ctx.moveTo(ox-12,yy-16);ctx.lineTo(ox,yy);ctx.lineTo(ox-12,yy+16);ctx.stroke();}
      ctx.restore();ctx.globalAlpha=1;
    }
    // ① にじいろジェム! 発見バナー(虹色に色替わり)
    if(rbMsgT>0){rbMsgT-=0.016*dt;
      const col=RBCOL[Math.floor(Date.now()*0.008)%6],pop=1+Math.max(0,rbMsgT-1)*0.4;
      ctx.save();ctx.translate(cx,H*0.2);ctx.scale(pop,pop);ctx.textAlign='center';
      ctx.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
      ctx.globalAlpha=clamp(rbMsgT*1.4,0,1);ctx.lineWidth=7;ctx.lineJoin='round';
      ctx.strokeStyle='rgba(30,10,40,.6)';ctx.strokeText('にじいろジェム！',0,0);
      ctx.fillStyle=col;ctx.fillText('にじいろジェム！',0,0);
      ctx.restore();ctx.globalAlpha=1;if(rbMsgT<0)rbMsgT=0;}
    // ② きょうのラッキー色 はっけん!(初回だけ中央上で教える)
    if(luckyMsgT>0){luckyMsgT-=0.016*dt;
      ctx.save();ctx.translate(cx,H*0.28);ctx.textAlign='center';
      ctx.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
      ctx.globalAlpha=clamp(luckyMsgT*1.3,0,1);
      const tt='きょうのラッキー色は '+luckyName+'！';
      ctx.lineWidth=5;ctx.lineJoin='round';ctx.strokeStyle='rgba(0,0,0,.5)';ctx.strokeText(tt,0,0);
      ctx.fillStyle=luckyColor;ctx.fillText(tt,0,0);
      ctx.restore();ctx.globalAlpha=1;if(luckyMsgT<0)luckyMsgT=0;}
    // ③ パーフェクト区間 バナー(クリア文字と重ねない下側)
    if(perfectMsgT>0){perfectMsgT-=0.014*dt;
      const pop=1+Math.max(0,perfectMsgT-1.4)*0.5;
      ctx.save();ctx.translate(cx,H*0.6);ctx.scale(pop,pop);ctx.textAlign='center';
      ctx.font="900 26px 'Hiragino Maru Gothic ProN',system-ui";
      ctx.globalAlpha=clamp(perfectMsgT*1.3,0,1);ctx.lineWidth=6;ctx.lineJoin='round';
      ctx.strokeStyle='rgba(20,60,20,.6)';ctx.strokeText('パーフェクト！じぶんでクリア！',0,0);
      ctx.fillStyle='#7be08a';ctx.fillText('パーフェクト！じぶんでクリア！',0,0);
      ctx.restore();ctx.globalAlpha=1;if(perfectMsgT<0)perfectMsgT=0;}
    ctx.textAlign='left';ctx.lineJoin='miter';
    now01+=0.016*dt;
  }
  let now01=0;

  initScene();
  return {
    resize:function(){ layout(); },   // 画面サイズ更新のみ(initSceneを呼ぶと進行が消える)
    input:function(x,y,type){
      if(type==='down'){ armTouching=true; fingerX=x; fingerY=y;
        // ④ おひさま/おつきさま タップ: ウインク+きらめき(移動はそのまま/減点なし)
        if(sunScreen.r>0&&Math.hypot(x-sunScreen.x,y-sunScreen.y)<sunScreen.r){
          sunWinkT=1;addScore(5);
          api.tone(1318,0.12,'triangle',0.09);api.tone(1760,0.14,'triangle',0.07);
          for(let i=0;i<5;i++)stars.push({x:sunScreen.x+(rng()-0.5)*24,y:sunScreen.y,vy:-1.3-rng(),life:1,rot:rng()*6,vr:(rng()-0.5)*0.2,s:12+rng()*6,col:'#FFE14A'});
          if(stars.length>60)stars.splice(0,stars.length-60);
        }
      }
      else if(type==='move'){ if(armTouching){ fingerX=x; fingerY=y; } }
      else { armTouching=false; }
    },
    frame:frame,
    stop:function(){}
  };
}
Engine.register("excavator", buildExcavator);
