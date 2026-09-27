function buildJet(api){
  const g=api.g;
  api.preload(["bg.jpg","planet.png"]);   // 画像アセット(無ければ従来の手描きにフォールバック)。ロケット/いんせきは生成不良(傾き・床)のため手描きのまま
  let obs=[],puffs=[],sparks=[],floats=[],stars=[],rings=[],glints=[],trail=[],motes=[],shards=[],feathers=[],chunks=[];
  let playerY,px,aimX,vy,alt,maxGenAlt,thrusting,thrustViz,grav,count,combo,comboT,bestAlt,tk,flash,jetTilt,wash,boost,lastHS;
  let stage,nextGate,banner,bannerT,clearBurst,clearBurstT,meteors;
  // ---- 隠し発見レイヤー(クレーン/パンチ/ハンマー/トラックと同じ思想) ----
  let luckyColor,luckySeen,luckyMsgT,rbMsgT,clusterId,clusters;
  let moonX,moonY,moonR,moonOn,moonWink;   // ④ 月(星)ひみつタップ
  // stage checkpoints (altitude in alt-units = meters*10): 1200m,3100m,7400m,10000m(final)
  // 7〜8歳向けに各ゲートを2割ほど遠くした(操作はそのまま・道のりだけ少し長い)
  // 【軸4改善】最初の2ゲートを近くして、連打/ホールドどちらでも90秒前後で最初のステージクリアが体験できるようにする
  const GATES=[{alt:6000,name:"くもの うみ とっぱ！",col:"#7be08a"},{alt:16000,name:"せいそうけん とうたつ！",col:"#4cc6e8"},{alt:74000,name:"うちゅう とうたつ！",col:"#b58bff"},{alt:100000,name:"ぎんが クリア！",col:"#ffd23f",final:true}];
  const BCOL=["#ff6b8b","#4cc6e8","#7be08a","#ffd23f","#b58bff","#ff7bd0"];
  const BHI={"#ff6b8b":"#ffd0db","#4cc6e8":"#cdf2ff","#7be08a":"#d6ffdc","#ffd23f":"#fff3c2","#b58bff":"#e7d6ff","#ff7bd0":"#ffd6ef"};
  // ⑦ とり用の色(バルーンのBCOLとは別パレット=同じ色違いの丸に見せないため)
  const BIRDCOL=["#8a5a3a","#6b7a8f","#c9995a","#4a90d9"];
  // ② きょうのラッキー色: バルーンの色から毎プレイ1色を秘密に選ぶ(色名で一度だけ教える)
  const CNAME={"#ff6b8b":"ピンク","#4cc6e8":"みずいろ","#7be08a":"みどり","#ffd23f":"きいろ","#b58bff":"むらさき","#ff7bd0":"ももいろ"};
  function layout(){playerY=api.H*0.46;if(px==null)px=api.W/2;aimX=px;grav=clamp(api.H*0.0004,0.22,0.36);}
  function reset(){obs=[];puffs=[];sparks=[];floats=[];rings=[];glints=[];trail=[];meteors=[];shards=[];feathers=[];chunks=[];px=null;vy=0;alt=0;maxGenAlt=0;thrusting=false;thrustViz=0;count=0;combo=0;comboT=0;bestAlt=0;tk=0;flash=0;jetTilt=0;wash=0;boost=0;lastHS=-99;
    stage=0;nextGate=0;banner="";bannerT=0;clearBurst=[];clearBurstT=0;
    luckyColor=pick(BCOL);luckySeen=false;luckyMsgT=0;rbMsgT=0;clusterId=0;clusters={};
    moonX=0;moonY=0;moonR=0;moonOn=false;moonWink=0;
    motes=[];for(let i=0;i<16;i++)motes.push({x:rnd(0,api.W),y:rnd(0,api.H),r:rnd(1.2,3.4),sp:rnd(0.15,0.55),ph:rnd(0,TAU),drift:rnd(0.2,0.6)});
    layout();ensure();}
  function ensure(){
    while(maxGenAlt<alt+api.H*1.4){
      maxGenAlt+=rnd(60,120);
      // ZONE depends on current generation altitude (alt-units = meters*10)
      // use raw maxGenAlt: 0-6000 low, 6000-16000 mid, 16000-68000 high, 68000+ space (GATES[0]/[1]短縮に合わせてゾーン境界も同じ値に更新。ズレるとゲート通過後もzone0の敵しか出ない)
      const z=maxGenAlt<GATES[0].alt?0:maxGenAlt<GATES[1].alt?1:maxGenAlt<68000?2:3;
      // ① にじいろバルーン: 約4%の激レア。虹色に光り、つらぬくと大量得点＋虹の大盤振る舞い。
      if(Math.random()<0.04){
        obs.push({alt:maxGenAlt,x:rnd(api.W*0.2,api.W*0.8),r:rnd(api.W*0.062,api.W*0.078),type:"balloon",color:pick(BCOL),rainbow:true,dead:false});
        continue;
      }
      // every so often drop a BONUS cluster (dense balloon house) as a combo-reward target
      if(Math.random()<0.14){
        const cx=rnd(api.W*0.25,api.W*0.75),col=pick(BCOL),cid=++clusterId,n=rint(4,6);
        clusters[cid]=n;   // ③ パーフェクト判定: このかたまりを1つも逃さず全部つぶすとボーナス
        for(let i=0;i<n;i++)obs.push({alt:maxGenAlt+rnd(-26,26),x:cx+rnd(-api.W*0.12,api.W*0.12),r:rnd(api.W*0.035,api.W*0.05),type:"balloon",color:Math.random()<0.5?col:pick(BCOL),bonus:true,cid,dead:false});
        continue;
      }
      if(z===0){ // LOW: sparse balloons, occasional small cloud, たまに たこ(凧)ととり
        const r0=Math.random();
        if(r0<0.22){const n=rint(1,2);for(let i=0;i<n;i++)obs.push({alt:maxGenAlt+rnd(-20,20),x:rnd(api.W*0.1,api.W*0.9),r:rnd(api.W*0.05,api.W*0.09),type:"cloud",dead:false});}
        else if(r0<0.36){ // ⑤ たこ(凧): 横長のひし形+しっぽ。当てると紙ふぶきに壊れる(風船とは違う壊れ方)
          obs.push({alt:maxGenAlt,x:rnd(api.W*0.15,api.W*0.85),r:rnd(api.W*0.06,api.W*0.085),type:"kite",color:pick(BCOL),vx:rnd(-0.4,0.4),dead:false});
        }
        else if(r0<0.55){ // ⑦ とり: 横長のW字翼シルエット。丸系(風船・雲)/ひし形(凧)とは違う形で当たり判定も横長
          const bw=rnd(api.W*0.05,api.W*0.065);
          obs.push({alt:maxGenAlt,x:rnd(api.W*0.15,api.W*0.85),r:bw,hw:bw*1.5,hh:bw*0.55,type:"bird",color:pick(BIRDCOL),vx:rnd(-0.7,0.7),ph:rnd(0,TAU),dead:false});
        }
        else obs.push({alt:maxGenAlt,x:rnd(api.W*0.12,api.W*0.88),r:rnd(api.W*0.04,api.W*0.06),type:"balloon",color:pick(BCOL),dead:false});
      }else if(z===1){ // MID: cloud walls with a gap to thread + some balloons + たまに大きな入道雲(数回ヒットで壊れる)・とり
        const r1=Math.random();
        if(r1<0.09){ // ⑥ 大きな入道雲: 3回当てて壊す的。壊れ方・大きさが他と違う
          obs.push({alt:maxGenAlt,x:rnd(api.W*0.25,api.W*0.75),r:rnd(api.W*0.13,api.W*0.16),type:"bigcloud",hp:3,maxHp:3,dead:false});
        }else if(r1<0.09+0.56){const gap=rnd(api.W*0.28,api.W*0.72),gw=api.W*0.22;   // くもの壁を少し多めに(7〜8歳向け)
          for(let i=0;i<5;i++){const cxw=api.W*0.1+i*api.W*0.2;if(Math.abs(cxw-gap)<gw)continue;obs.push({alt:maxGenAlt+rnd(-16,16),x:cxw,r:rnd(api.W*0.07,api.W*0.1),type:"cloud",dead:false});}
        }else if(r1<0.09+0.56+0.13){ // ⑦ とり: 雲の壁の合間を飛ぶ1〜2羽(丸・ひし形以外の形のバリエーション)
          const n=rint(1,2);for(let i=0;i<n;i++){const bw=rnd(api.W*0.05,api.W*0.065);
            obs.push({alt:maxGenAlt+rnd(-16,16),x:rnd(api.W*0.15,api.W*0.85),r:bw,hw:bw*1.5,hh:bw*0.55,type:"bird",color:pick(BIRDCOL),vx:rnd(-0.7,0.7),ph:rnd(0,TAU),dead:false});}
        }else for(let i=0;i<rint(1,2);i++)obs.push({alt:maxGenAlt+rnd(-20,20),x:rnd(api.W*0.12,api.W*0.88),r:rnd(api.W*0.045,api.W*0.06),type:"balloon",color:pick(BCOL),dead:false});
      }else if(z===2){ // HIGH: side-drifting balloons + clouds + とり + まれにひこうせん(大きい物)
        const r2=Math.random();
        if(r2<0.05){ // ⑧ ひこうせん/UFO: 横長・大きい・矩形寄りの当たり判定(丸系・ひし形とは違う『大きい乗り物』)
          const dir=Math.random()<0.5?-1:1,bw2=api.W*0.15;
          obs.push({alt:maxGenAlt,x:dir<0?api.W*0.8:api.W*0.2,r:bw2,hw:bw2,hh:bw2*0.42,type:"blimp",color:pick(BCOL),vx:dir*rnd(0.5,0.9),dead:false});
        }else if(r2<0.05+0.18){const n=rint(1,2);for(let i=0;i<n;i++){const bw=rnd(api.W*0.05,api.W*0.065);
            obs.push({alt:maxGenAlt+rnd(-18,18),x:rnd(api.W*0.15,api.W*0.85),r:bw,hw:bw*1.5,hh:bw*0.55,type:"bird",color:pick(BIRDCOL),vx:rnd(-0.8,0.8),ph:rnd(0,TAU),dead:false});}
        }else if(r2<0.05+0.18+0.4){const dir=Math.random()<0.5?-1:1;obs.push({alt:maxGenAlt,x:dir<0?api.W*0.85:api.W*0.15,r:rnd(api.W*0.045,api.W*0.06),type:"balloon",color:pick(BCOL),vx:dir*rnd(0.8,1.6),dead:false});}
        else{const n=rint(1,3);for(let i=0;i<n;i++)obs.push({alt:maxGenAlt+rnd(-18,18),x:rnd(api.W*0.1,api.W*0.9),r:rnd(api.W*0.05,api.W*0.09),type:"cloud",dead:false});}
      }else{ // SPACE: drifting balloons + meteors to dodge + まれにひこうせん + 終盤の隕石シャワー
        if(maxGenAlt>85000&&Math.random()<0.3){ // 【軸4】最終ゲート(100000)直前でもう一段の盛り上がり: 隕石を1個ではなく3〜4個まとめて出す
          const n=rint(3,4);for(let i=0;i<n;i++)meteors.push({alt:maxGenAlt+rnd(-40,40)+i*16,x:rnd(api.W*0.12,api.W*0.88),r:rnd(api.W*0.028,api.W*0.042),vx:rnd(-2.8,2.8)*(Math.random()<0.5?1:-1),sp:rnd(0.2,0.5),ph:rnd(0,TAU),dead:false});
        }else{
          const r3=Math.random();
          if(r3<0.06){ // ⑧ ひこうせん/UFO: 宇宙ゾーンにも大きい物を混ぜる
            const dir=Math.random()<0.5?-1:1,bw3=api.W*0.16;
            obs.push({alt:maxGenAlt,x:dir<0?api.W*0.78:api.W*0.22,r:bw3,hw:bw3,hh:bw3*0.42,type:"blimp",color:pick(BCOL),vx:dir*rnd(0.5,0.9),dead:false});
          }else if(r3<0.06+0.44)meteors.push({alt:maxGenAlt+rnd(-30,30),x:rnd(api.W*0.1,api.W*0.9),r:rnd(api.W*0.03,api.W*0.045),vx:rnd(-2.6,2.6)*(Math.random()<0.5?1:-1),sp:rnd(0.2,0.5),ph:rnd(0,TAU),dead:false});   // いんせき少し多め・少し速め(7〜8歳向け)
          else{const dir=Math.random()<0.5?-1:1;obs.push({alt:maxGenAlt,x:dir<0?api.W*0.85:api.W*0.15,r:rnd(api.W*0.045,api.W*0.06),type:"balloon",color:pick(BCOL),vx:dir*rnd(1,2),dead:false});}
        }
      }
    }
    // 落下などで視界内の的が完全に尽きたときだけの保険(=完全な空振りゾーンを防ぐが、常時3個は供給しない)
    let near=0;
    for(const o of obs){if(!o.dead&&o.alt>alt&&o.alt<alt+api.H*1.1)near++;}
    while(near<1){
      // 今ねらっている場所(px)からは離れた場所に置く=適当に飛んでも当たらない
      let bx=rnd(api.W*0.15,api.W*0.85),tries=0;
      while(Math.abs(bx-px)<api.W*0.3&&tries<8){bx=rnd(api.W*0.15,api.W*0.85);tries++;}
      obs.push({alt:alt+rnd(api.H*0.25,api.H*1.0),x:bx,r:rnd(api.W*0.05,api.W*0.07),type:"balloon",color:pick(BCOL),dead:false});
      near++;
    }
  }
  function sy(o){return playerY-(o.alt-alt);}
  function pierce(o){
    if(o.dead)return;
    if(o.type==="bigcloud"){ // ⑥ 大きな入道雲: 3回当てて壊す(壊れ方・大きさが他の的と違う)
      const oy=sy(o);
      o.hp=(o.hp==null?3:o.hp)-1;o.hitCd=22; // 通り抜ける間に一気に3ヒットしないよう連続当たりを防ぐ
      api.noise(0.1,0.13,1200,"lowpass");api.shake(2.5);api.boom(0.32);
      rings.push({x:o.x,y:oy,r:Math.max(0,o.r*0.3),vr:rnd(3,4.5),life:0.7,decay:0.05,col:"#ffffff"});
      for(let k=rint(7,10);k>0;k--)puffs.push({x:o.x+rnd(-o.r,o.r),y:oy+rnd(-o.r,o.r),r:Math.max(0,rnd(o.r*0.25,o.r*0.5)),vx:rnd(-3,3),vy:rnd(-2,2),life:1,decay:rnd(0.02,0.035)});
      if(o.hp<=0){
        o.dead=true;count+=2;api.setScore(count);combo++;comboT=0.6;
        api.boom(0.6);api.shake(5);api.tone(660,0.1,"triangle",0.08);
        for(let k=rint(18,24);k>0;k--){const a=rnd(0,TAU),s=rnd(3,8);puffs.push({x:o.x+rnd(-o.r,o.r),y:oy+rnd(-o.r,o.r),r:Math.max(0,rnd(o.r*0.3,o.r*0.6)),vx:Math.cos(a)*2,vy:Math.sin(a)*2-2,life:1,decay:rnd(0.018,0.03)});}
        floats.push({x:o.x,y:oy-20,txt:"やった！",life:1,vy:-1.1,col:"#cfe2ff",size:26});
      }
      return;
    }
    o.dead=true;
    const oy=sy(o);
    let val=o.type==="balloon"?2:o.type==="kite"?2:o.type==="bird"?3:o.type==="blimp"?5:0;if(o.bonus)val+=1;
    // ① にじいろ = +8の大量得点 / ② ラッキー色 = +1の隠しボーナス
    const isRainbow=!!o.rainbow;
    const isLucky=o.type==="balloon"&&!isRainbow&&o.color===luckyColor;
    if(isRainbow)val+=8;
    if(isLucky){val+=1;if(!luckySeen){luckyMsgT=1.6;luckySeen=true;}} // 初回だけ中央上に色を教える
    if(wash>0.2)val*=2; // FEVER: x6 wash doubles score
    count+=val;api.setScore(count);combo++;comboT=0.6;
    // low-end "ズドン" that thickens with combo
    api.boom(clamp(0.3+combo*0.04,0.3,0.6));
    if(o.type==="balloon"){api.slide(700,300,0.08,0.16,"square");api.noise(0.06,0.12,2000);api.tone(880+combo*40,0.08,"triangle",0.06);
      flash=Math.min(1,flash+0.5);if(tk-lastHS>14){api.hitStop(2);lastHS=tk;} // 連続ヒット時はhitStopを間引く(凍結ループ防止)
      if(wash>0.2){vy=Math.max(vy,5.5);} // fever up-boost while climaxing
      rings.push({x:o.x,y:oy,r:o.r*0.5,vr:rnd(4,5.5),life:1,decay:0.045,col:o.color});
      for(let k=rint(14,20);k>0;k--){const a=rnd(0,TAU),s=rnd(2,8.5);sparks.push({x:o.x,y:oy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5),life:1,decay:rnd(0.02,0.04),col:Math.random()<0.4?(BHI[o.color]||"#fff"):o.color});}
      for(let k=rint(2,4);k>0;k--)glints.push({x:o.x+rnd(-o.r,o.r),y:oy+rnd(-o.r,o.r),r:rnd(4,8),life:1,decay:rnd(0.03,0.05)});}
    else if(o.type==="kite"){ // ⑤ たこ(凧): 紙が破ける壊れ方(風船のはじける音/雲のもこもこ とは別物)
      api.tone(520,0.08,"square",0.05);api.noise(0.05,0.1,1600);
      flash=Math.min(1,flash+0.3);
      rings.push({x:o.x,y:oy,r:Math.max(0,o.r*0.4),vr:rnd(3.5,5),life:1,decay:0.045,col:o.color});
      for(let k=rint(10,14);k>0;k--){const a=rnd(0,TAU),s=rnd(2,7);
        shards.push({x:o.x,y:oy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,rot:rnd(0,TAU),vr:rnd(-0.22,0.22),sz:rnd(4,9),life:1,decay:rnd(0.018,0.032),col:Math.random()<0.5?o.color:(BHI[o.color]||"#fff")});}
    }
    else if(o.type==="bird"){ // ⑦ とり: 羽根が散る壊れ方(feathers=風船のsparks/凧のshardsとは別の専用パーティクル)
      api.tone(700,0.07,"square",0.05);api.noise(0.04,0.09,2400);
      flash=Math.min(1,flash+0.3);
      rings.push({x:o.x,y:oy,r:Math.max(0,o.r*0.35),vr:rnd(3,4.2),life:0.8,decay:0.05,col:"#fff3e0"});
      for(let k=rint(8,12);k>0;k--){const a=rnd(0,TAU),s=rnd(1.5,5);
        feathers.push({x:o.x,y:oy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,rot:rnd(0,TAU),vr:rnd(-0.15,0.15),sz:rnd(5,9),life:1,decay:rnd(0.012,0.022),col:Math.random()<0.5?o.color:"#fff7ea",ph:rnd(0,TAU)});}
    }
    else if(o.type==="blimp"){ // ⑧ ひこうせん/UFO: バラバラに砕けて落ちる壊れ方(chunks=四角い破片。凧のshards(三角)とも違う)
      api.noise(0.15,0.16,900,"lowpass");api.boom(0.5);
      rings.push({x:o.x,y:oy,r:Math.max(0,(o.hw||o.r)*0.4),vr:rnd(4,5.5),life:0.9,decay:0.04,col:"#ffffff"});
      for(let k=rint(10,14);k>0;k--){const a=rnd(0,TAU),s=rnd(2,6);
        chunks.push({x:o.x+rnd(-(o.hw||o.r)*0.5,(o.hw||o.r)*0.5),y:oy+rnd(-(o.hh||o.r)*0.4,(o.hh||o.r)*0.4),vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,rot:rnd(0,TAU),vr:rnd(-0.2,0.2),w:rnd(6,12),h:rnd(4,8),life:1,decay:rnd(0.014,0.024),col:o.color});}
      floats.push({x:o.x,y:oy-30,txt:"やった！",life:1,vy:-1.1,col:"#cfe2ff",size:26});
    }
    else{api.noise(0.12,0.14,1400,"lowpass");
      rings.push({x:o.x,y:oy,r:Math.max(0,o.r*0.4),vr:rnd(3,4.5),life:0.8,decay:0.05,col:"#ffffff"});
      for(let k=rint(8,12);k>0;k--)puffs.push({x:o.x+rnd(-o.r,o.r),y:oy+rnd(-o.r,o.r),r:Math.max(0,rnd(o.r*0.3,o.r*0.6)),vx:rnd(-3,3),vy:rnd(-2,2),life:1,decay:rnd(0.02,0.035)});}
    api.shake(2+Math.min(combo*0.3,5));vy+=1.2; // push-through accel
    if(combo>2&&combo%3===0){flash=Math.min(1,flash+0.35);floats.push({x:o.x,y:oy-20,txt:"x"+combo,life:1,vy:-1.1,col:combo>=9?"#ff3b3b":"#ffd23f",size:32});}
    if(combo>=6&&combo%3===0){ // climax: full-screen color wash + burst
      wash=1;api.shake(7);if(tk-lastHS>14){api.hitStop(3);lastHS=tk;}api.boom(1);api.tone(440+combo*18,0.18,"sawtooth",0.05);api.slide(300,1200,0.05,0.22,"triangle");
      for(let k=rint(20,28);k>0;k--){const a=rnd(0,TAU),s=rnd(4,11);sparks.push({x:o.x,y:oy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5.5),life:1,decay:rnd(0.015,0.03),col:pick(BCOL)});}
      rings.push({x:o.x,y:oy,r:o.r*0.6,vr:rnd(7,9),life:1,decay:0.03,col:"#ffffff"});
    }
    // ① にじいろ / ② ラッキー色 の特別演出
    if(isRainbow)rainbowBurst(o.x,oy);
    else if(isLucky)luckyStar(o.x,oy);
    // ③ パーフェクト: このボーナスかたまりを1つも逃さず全部つぶしたら祝福ボーナス
    if(o.bonus&&o.cid!=null&&clusters[o.cid]!=null){
      clusters[o.cid]--;
      if(clusters[o.cid]<=0){delete clusters[o.cid];perfectBonus(o.x,oy);}
    }
  }
  function rainbowBurst(x,y){
    // ① にじいろバルーン 撃破: 虹の輪が6色ぶわっと。激レアの爽快ごほうび(白飛びしない上限つき)。
    rbMsgT=1.4;wash=Math.min(1,wash+0.5);flash=Math.min(1,flash+0.4);
    api.boom(0.7);api.shake(10);if(tk-lastHS>14){api.hitStop(4);lastHS=tk;}
    api.tone(880,0.12,"triangle",0.1);api.tone(1320,0.14,"triangle",0.09);api.tone(1760,0.16,"triangle",0.07);
    api.slide(500,1400,0.3,0.18,"triangle");
    for(let k=0;k<BCOL.length;k++)rings.push({x,y,r:20,vr:5+k*1.1,life:1,decay:0.03,col:BCOL[k]});
    for(let k=rint(24,30);k>0;k--){const a=rnd(0,TAU),s=rnd(3,10);sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5.5),life:1,decay:rnd(0.014,0.03),col:pick(BCOL)});}
    vy=Math.max(vy,6); // にじいろで ぐんっ と上昇
  }
  function luckyStar(x,y){
    // ② ラッキー色 命中: きらっと小さめの祝福(白飛びしないよう控えめ)。頭上に星のヒント。
    api.tone(1046,0.12,"triangle",0.1);api.tone(1568,0.14,"triangle",0.07);
    for(let k=0;k<3;k++)glints.push({x:x+rnd(-14,14),y:y-rnd(6,26),r:rnd(5,9),life:1,decay:rnd(0.025,0.04)});
    floats.push({x,y:y-24,txt:"ラッキー",life:1,vy:-1,col:luckyColor,size:24});
  }
  function perfectBonus(x,y){
    // ③ パーフェクト: かたまり全消しの祝福(減点なし・気づくと得する)
    count+=3;api.setScore(count);
    api.tone(1318,0.12,"triangle",0.1);api.tone(1976,0.14,"triangle",0.08);
    api.shake(6);flash=Math.min(1,flash+0.3);
    floats.push({x:api.W/2,y:api.H*0.32,txt:"パーフェクト！＋3",life:1,vy:-0.8,col:"#7be08a",size:34});
    for(let k=rint(16,20);k>0;k--){const a=rnd(0,TAU),s=rnd(3,8);sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,r:rnd(2,5),life:1,decay:rnd(0.015,0.03),col:pick(["#7be08a","#ffd23f","#4cc6e8"])});}
  }
  function secretMoon(){
    // ④ 月(星)ひみつタップ: ウインク＋金コインがこぼれる(噴射はそのまま/減点なし)
    api.tone(1318,0.1,"triangle",0.09);api.tone(1760,0.12,"triangle",0.07);
    count+=1;api.setScore(count);
    for(let k=rint(8,12);k>0;k--){const a=rnd(-TAU/2,0),s=rnd(2,6);sparks.push({x:moonX,y:moonY,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,4.5),life:1,decay:rnd(0.02,0.04),col:pick(["#ffd23f","#fff3c2","#cfe2ff"])});}
    floats.push({x:moonX,y:moonY-moonR*0.4,txt:"＋1",life:1,vy:-1,col:"#ffd23f",size:26});
  }
  reset();
  return{
    resize:layout,
    input(px2,py2,type){
      if(type==="down"){thrusting=true;aimX=px2;boost=Math.max(boost,46); // タップでも短時間噴射(間欠タップでも上昇が頭打ちしないよう長め)
        // ④ 月(星)ひみつタップ: 高空の惑星に触れたら ウインク＋コイン(噴射はそのまま)
        if(moonOn&&moonWink<=0&&Math.hypot(px2-moonX,py2-moonY)<moonR){moonWink=1;secretMoon();}
      }
      else if(type==="move"){if(thrusting)aimX=px2;}
      else if(type==="up"){thrusting=false;}
    },
    frame(dt,now){
      tk+=dt;
      // physics (gravity grows gently with altitude -> steering matters more up high)
      if(boost>0)boost=Math.max(0,boost-dt);
      const thr=thrusting||boost>0;
      if(thr){vy+=(alt<GATES[0].alt?0.8:0.62)*dt;px+=(aimX-px)*0.12*dt;} // 【軸4改善】最初のゲートに届くまでだけ推進力を強め、序盤の到達を早める(上位ゾーンの難度はそのまま)
      const gNow=grav*(1+clamp(alt/100000,0,1)*0.65);   // 高空ほど重力を強めに(7〜8歳向け・操作は同じ)
      vy-=gNow*dt;vy=clamp(vy,-9,12);
      alt+=vy*dt;if(alt<0){alt=0;if(vy<0)vy=0;}
      bestAlt=Math.max(bestAlt,alt);
      checkGate();
      thrustViz=lerp(thrustViz,thr?1:0,0.25);
      jetTilt=lerp(jetTilt,clamp((aimX-px)*0.012,-0.45,0.45),0.2);
      if(flash>0)flash=Math.max(0,flash-0.06*dt);
      if(wash>0)wash=Math.max(0,wash-0.022*dt);
      ensure();
      // sky gradient shifts with altitude (day -> space)
      const hi=clamp(alt/8000,0,1);
      let imgBg=false;
      if(api.drawCover("bg.jpg")){ imgBg=true;
        // 画像背景(昼の空): 高度が上がるほど宇宙のグラデを重ねて暗くする(絵→宇宙へ溶ける)
        if(hi>0.01){let sg2=g.createLinearGradient(0,0,0,api.H);
          sg2.addColorStop(0,"#070b22");sg2.addColorStop(0.5,"#101a44");sg2.addColorStop(1,"#23306a");
          g.save();g.globalAlpha=hi;g.fillStyle=sg2;g.fillRect(0,0,api.W,api.H);g.restore();g.globalAlpha=1;}
      } else {
        let grd=g.createLinearGradient(0,0,0,api.H);
        grd.addColorStop(0,blend("#070b22","#5fa8e6",1-hi));
        grd.addColorStop(0.5,blend("#101a44","#8fc8f2",1-hi));
        grd.addColorStop(1,blend("#23306a","#e6f4ff",1-hi));
        g.fillStyle=grd;g.fillRect(0,0,api.W,api.H);
      }
      // distant glow band (sun/aurora) softly drifting ※画像背景の昼間は絵の太陽があるので描かない(宇宙のオーロラは残す)
      if(!imgBg||hi>0.4){
        const bandY=api.H*(0.62-hi*0.2);
        let bg=g.createRadialGradient(api.W*0.5,bandY,0,api.W*0.5,bandY,Math.max(0,api.W*0.75));
        bg.addColorStop(0,"rgba("+(hi>0.4?"150,120,255":"255,238,200")+","+(0.18+hi*0.1)+")");
        bg.addColorStop(1,"rgba(255,255,255,0)");
        g.fillStyle=bg;g.fillRect(0,0,api.W,api.H);
      }
      // stars at high alt with gentle twinkle
      if(hi>0.15){for(let i=0;i<34;i++){const sx=(i*97.3)%api.W,syy=((i*53+alt*0.2)%api.H);
        const tw=0.4+0.6*Math.abs(Math.sin(tk*0.06+i));g.globalAlpha=hi*tw;
        g.fillStyle=i%5===0?"#cfe2ff":"#ffffff";const sr=i%7===0?2.2:1.3;g.beginPath();g.arc(sx,syy,sr,0,TAU);g.fill();}
        g.globalAlpha=1;}
      // LANDMARK 1: cloud-sea layer below, parallax-recedes as we climb (distance cue)
      const seaProg=clamp(alt/2600,0,1); // 0=just above sea, 1=far below
      if(seaProg<1&&!imgBg){   // ※画像背景のときは絵の雲海を活かして平坦な白帯は描かない
        const seaY=api.H*(0.78+seaProg*0.42)-(alt*0.06); // slow parallax fall
        if(seaY>0&&seaY<api.H+120){
          g.save();
          let sg=g.createLinearGradient(0,seaY-40,0,seaY+90);
          sg.addColorStop(0,"rgba(255,255,255,0)");sg.addColorStop(0.4,blend("#dcebff","#ffffff",0.4)+"");
          sg.addColorStop(1,"rgba(214,228,255,0.92)");
          g.globalAlpha=0.85*(1-seaProg*0.5);g.fillStyle=sg;g.fillRect(0,seaY-40,api.W,api.H-seaY+50);
          // billowing cloud-top humps
          g.fillStyle="rgba(255,255,255,.92)";g.beginPath();g.moveTo(0,seaY+30);
          for(let cx=0;cx<=api.W;cx+=api.W/6){const hump=Math.sin(cx*0.012+tk*0.01)*16;g.quadraticCurveTo(cx-api.W/12,seaY-22+hump,cx,seaY+6+hump);}
          g.lineTo(api.W,api.H);g.lineTo(0,api.H);g.closePath();g.globalAlpha=0.8*(1-seaProg*0.5);g.fill();
          g.restore();
        }
      }
      // LANDMARK 2: planet/moon high up, grows + drifts in to show we've reached space
      moonOn=false;
      if(hi>0.25){
        const plA=clamp((hi-0.25)/0.5,0,1);
        const plX=api.W*0.74,plY=api.H*(0.34-hi*0.06),plR=api.W*(0.16+hi*0.12);
        moonX=plX;moonY=plY;moonR=plR;moonOn=true;   // ④ ひみつタップの当たり判定(描画と一致)
        g.save();g.globalAlpha=plA*0.96;
        // 画像の惑星(輪つき)。スプライト内の球は高さの約70%(中心が画像中心より2%上)なので w=plR*3 で球の直径≒2.1plR・少し下げて球中心=タップ判定中心。無ければ従来の手描き惑星
        if(!api.drawAsset("planet.png",plX,plY+plR*0.06,plR*3,plR*3,{center:true,alpha:plA*0.96})){
        let pg=g.createRadialGradient(plX-plR*0.35,plY-plR*0.35,Math.max(0,plR*0.1),plX,plY,Math.max(0,plR));
        pg.addColorStop(0,"#9ad6ff");pg.addColorStop(0.5,"#5a8fd6");pg.addColorStop(1,"#1c2f63");
        g.fillStyle=pg;g.beginPath();g.arc(plX,plY,Math.max(0,plR),0,TAU);g.fill();
        // surface bands (continents/craters) drifting
        g.globalAlpha=plA*0.4;g.fillStyle="#cfe6c4";
        for(let b=0;b<3;b++){const bx=plX+Math.cos(tk*0.004+b*2)*plR*0.35,by=plY+Math.sin(b*1.7)*plR*0.4;
          g.beginPath();g.ellipse(bx,by,Math.max(0,plR*0.28),Math.max(0,plR*0.16),b,0,TAU);g.fill();}
        // soft ring around planet
        g.globalAlpha=plA*0.5;g.strokeStyle="#bfe0ff";g.lineWidth=plR*0.06;
        g.beginPath();g.ellipse(plX,plY,Math.max(0,plR*1.5),Math.max(0,plR*0.5),-0.5,0,TAU);g.stroke();
        // rim light
        g.globalAlpha=plA*0.6;g.strokeStyle="rgba(190,230,255,.8)";g.lineWidth=2;
        g.beginPath();g.arc(plX,plY,Math.max(0,plR),-2.2,-0.4);g.stroke();
        }
        // ④ ひみつタップされた瞬間だけ ^_^ のウインク顔(発見のごほうび)
        if(moonWink>0){moonWink-=0.02*dt;
          g.globalAlpha=plA*clamp(moonWink*1.4,0,1);g.strokeStyle="rgba(20,35,70,.85)";
          g.lineWidth=Math.max(2,plR*0.05);g.lineCap="round";
          g.beginPath();
          g.arc(plX-plR*0.34,plY-plR*0.05,plR*0.14,1.1*Math.PI,1.9*Math.PI);
          g.arc(plX+plR*0.34,plY-plR*0.05,plR*0.14,1.1*Math.PI,1.9*Math.PI);
          g.stroke();
          g.beginPath();g.arc(plX,plY+plR*0.12,plR*0.28,0.12*Math.PI,0.88*Math.PI);g.stroke();
          if(moonWink<0)moonWink=0;}
        g.restore();g.lineWidth=1;
      }
      // ambient drifting light motes (always-on, never empty)
      g.save();g.globalCompositeOperation="lighter";
      for(const m of motes){m.y-=m.sp*dt;m.x+=Math.sin(tk*0.02+m.ph)*m.drift*dt;
        if(m.y<-6){m.y=api.H+6;m.x=rnd(0,api.W);}
        const tw=0.4+0.6*Math.abs(Math.sin(tk*0.04+m.ph));
        g.globalAlpha=tw*(hi>0.4?0.45:0.6);g.fillStyle=hi>0.4?"#cfe2ff":"#fff6d8";
        g.beginPath();g.arc(m.x,m.y,m.r,0,TAU);g.fill();}
      g.restore();g.globalCompositeOperation="source-over";g.globalAlpha=1;
      // obstacles
      for(const o of obs){
        if(o.vx){o.x+=o.vx*dt;if(o.x<api.W*0.08||o.x>api.W*0.92)o.vx*=-1;}
        if(o.hitCd>0)o.hitCd-=dt;   // ⑥ 大きな入道雲の連続ヒット防止(1回通り抜ける間に一気に壊れないように)
        const y=sy(o);
        const chw=o.hw!=null?o.hw:o.r*0.72,chh=o.hh!=null?o.hh:o.r*0.72; // ⑦⑧ とり/ひこうせんは横長の矩形寄り判定
        const rr=Math.max(o.r,o.hw||0,o.hh||0);
        if(!o.dead&&!(o.hitCd>0)&&Math.abs(o.x-px)<chw&&Math.abs(y-playerY)<chh)pierce(o);
        if(!o.dead&&y>-rr&&y<api.H+rr)drawOb(o,y);}
      obs=obs.filter(o=>{                                // 撃破済み or 画面下に流れた障害物を除去
        const rr=Math.max(o.r,o.hw||0,o.hh||0);
        const keep=!o.dead&&sy(o)<api.H+rr*2;
        if(!keep&&!o.dead&&o.cid!=null&&clusters[o.cid]!=null)delete clusters[o.cid]; // 逃したかたまりはパーフェクト不成立→エントリ解放
        return keep;});
      // meteors (space zone): bounce, drift, only nudge (kid-friendly) on contact
      for(const m of meteors){
        m.x+=m.vx*dt;if(m.x<api.W*0.08||m.x>api.W*0.92)m.vx*=-1;
        const my=sy(m);
        if(!m.dead&&Math.abs(m.x-px)<m.r+20&&Math.abs(my-playerY)<m.r+18){m.dead=true;vy=Math.min(vy,-1.5);px+=(px<m.x?-1:1)*14;api.shake(5);api.boom(0.45);api.noise(0.1,0.13,500,"lowpass");
          // 隕石は「砕け散る」壊れ方: 岩色の破片(shards)+輪+多めの火花で、風船(はじける)・雲(もこもこ)とはっきり違う見た目に
          rings.push({x:m.x,y:my,r:Math.max(0,m.r*0.3),vr:rnd(3.5,5),life:0.8,decay:0.045,col:"#c98a4a"});
          for(let k=rint(10,14);k>0;k--){const a=rnd(0,TAU),s=rnd(2,7);sparks.push({x:m.x,y:my,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,4.5),life:1,decay:rnd(0.02,0.04),col:pick(["#ffb15a","#ff7b3a","#ffd58a"])});}
          for(let k=rint(6,9);k>0;k--){const a=rnd(0,TAU),s=rnd(2,6);shards.push({x:m.x,y:my,vx:Math.cos(a)*s,vy:Math.sin(a)*s,rot:rnd(0,TAU),vr:rnd(-0.25,0.25),sz:rnd(4,8),life:1,decay:rnd(0.02,0.035),col:pick(["#c98a4a","#6b3d1e","#ffe2a8"])});}}
        if(!m.dead&&my>-m.r&&my<api.H+m.r)drawMeteor(m,my);}
      meteors=meteors.filter(m=>!m.dead&&sy(m)<api.H+m.r*3);
      // shock rings
      for(const rg of rings){rg.r+=rg.vr*dt;rg.life-=rg.decay*dt;
        g.globalAlpha=Math.max(0,rg.life)*0.8;g.strokeStyle=rg.col;g.lineWidth=3*rg.life+1;
        g.beginPath();g.arc(rg.x,rg.y,rg.r,0,TAU);g.stroke();}
      g.globalAlpha=1;g.lineWidth=1;rings=rings.filter(rg=>rg.life>0);
      // puffs
      for(const p of puffs){p.x+=p.vx*dt;p.y+=(p.vy+vy)*dt;p.r+=0.4*dt;p.life-=p.decay*dt;
        g.globalAlpha=Math.max(0,p.life)*0.55;
        let pg=g.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);pg.addColorStop(0,"#ffffff");pg.addColorStop(1,"rgba(255,255,255,0)");
        g.fillStyle=pg;g.beginPath();g.arc(p.x,p.y,p.r,0,TAU);g.fill();}
      g.globalAlpha=1;puffs=puffs.filter(p=>p.life>0);
      // shards (たこの紙片/いんせきの岩片): 丸いsparksとは違う回転する小片で、壊れ方の違いを見せる
      for(const sh of shards){sh.vy+=0.12*dt;sh.x+=sh.vx*dt;sh.y+=(sh.vy+vy)*dt;sh.rot+=sh.vr*dt;sh.life-=sh.decay*dt;
        g.save();g.globalAlpha=Math.max(0,sh.life);g.translate(sh.x,sh.y);g.rotate(sh.rot);
        g.fillStyle=sh.col;const s2=Math.max(0,sh.sz*sh.life);
        g.beginPath();g.moveTo(0,-s2);g.lineTo(s2*0.7,0);g.lineTo(0,s2);g.lineTo(-s2*0.7,0);g.closePath();g.fill();
        g.restore();}
      g.globalAlpha=1;shards=shards.filter(sh=>sh.life>0);
      // feathers (⑦とりの羽根): shards(紙片/岩片)ともsparks(丸い火花)とも違う、ひらひら落ちる軽い羽根
      for(const fe of feathers){fe.vy+=0.05*dt;fe.x+=fe.vx*dt+Math.sin(tk*0.1+fe.ph)*0.6;fe.y+=(fe.vy+vy*0.3)*dt;fe.rot+=fe.vr*dt;fe.life-=fe.decay*dt;
        g.save();g.globalAlpha=Math.max(0,fe.life);g.translate(fe.x,fe.y);g.rotate(fe.rot);
        g.fillStyle=fe.col;const fs=Math.max(0,fe.sz*fe.life);
        g.beginPath();g.ellipse(0,0,Math.max(0,fs*0.35),Math.max(0,fs),0,0,TAU);g.fill();
        g.restore();}
      g.globalAlpha=1;feathers=feathers.filter(fe=>fe.life>0);
      // chunks (⑧ひこうせん/UFOの矩形の破片): 丸いsparks・三角のshardsとは違う四角い破片がバラバラに落ちる
      for(const ch of chunks){ch.vy+=0.14*dt;ch.x+=ch.vx*dt;ch.y+=(ch.vy+vy)*dt;ch.rot+=ch.vr*dt;ch.life-=ch.decay*dt;
        g.save();g.globalAlpha=Math.max(0,ch.life);g.translate(ch.x,ch.y);g.rotate(ch.rot);
        g.fillStyle=ch.col;const cw=Math.max(0,ch.w*ch.life),chh3=Math.max(0,ch.h*ch.life);
        g.fillRect(-cw/2,-chh3/2,cw,chh3);
        g.restore();}
      g.globalAlpha=1;chunks=chunks.filter(ch=>ch.life>0);
      // speed lines when ascending fast
      if(vy>4){g.strokeStyle="rgba(255,255,255,"+clamp((vy-4)*0.05,0.1,0.4)+")";g.lineWidth=2;
        for(let i=0;i<7;i++){const lx=rnd(0,api.W),ly=rnd(0,api.H);g.beginPath();g.moveTo(lx,ly);g.lineTo(lx,ly+rnd(20,55));g.stroke();}g.lineWidth=1;}
      // jet
      drawJet();
      // sparks with additive glow
      g.globalCompositeOperation="lighter";
      for(const s of sparks){s.vy+=0.15*dt;s.x+=s.vx*dt;s.y+=(s.vy+vy)*dt;s.life-=s.decay*dt;
        g.globalAlpha=Math.max(0,s.life);g.fillStyle=s.col;g.beginPath();g.arc(s.x,s.y,s.r*s.life+0.5,0,TAU);g.fill();}
      g.globalCompositeOperation="source-over";
      g.globalAlpha=1;sparks=sparks.filter(s=>s.life>0);
      // sparkle glints (4-point stars)
      for(const gl of glints){gl.life-=gl.decay*dt;const a=Math.max(0,gl.life),rr=gl.r*(0.6+a*0.8);
        g.globalAlpha=a;g.strokeStyle="#ffffff";g.lineWidth=1.6;
        g.beginPath();g.moveTo(gl.x-rr,gl.y);g.lineTo(gl.x+rr,gl.y);g.moveTo(gl.x,gl.y-rr);g.lineTo(gl.x,gl.y+rr);g.stroke();}
      g.globalAlpha=1;g.lineWidth=1;glints=glints.filter(gl=>gl.life>0);
      // combo decay + floats
      if(combo>0){comboT-=0.016*dt;if(comboT<=0)combo=0;}
      for(const f of floats){f.y+=f.vy*dt;f.life-=0.016*dt;g.globalAlpha=Math.max(0,f.life);
        g.font="800 "+f.size+"px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
        g.lineWidth=6;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(f.txt,f.x,f.y);g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y);}
      g.globalAlpha=1;g.textAlign="left";floats=floats.filter(f=>f.life>0);
      // hit flash bloom
      if(flash>0.01){g.globalCompositeOperation="lighter";g.globalAlpha=flash*0.35;
        g.fillStyle="#fff2c0";g.fillRect(0,0,api.W,api.H);
        g.globalAlpha=1;g.globalCompositeOperation="source-over";}
      // CLIMAX: full-screen rainbow color wash with radial pulse
      if(wash>0.01){g.save();g.globalCompositeOperation="lighter";
        const hue=(tk*4)%360;
        let wg=g.createRadialGradient(px,playerY,0,px,playerY,api.W*0.95);
        wg.addColorStop(0,"hsla("+hue+",100%,75%,"+(wash*0.5)+")");
        wg.addColorStop(0.5,"hsla("+((hue+120)%360)+",100%,65%,"+(wash*0.28)+")");
        wg.addColorStop(1,"hsla("+((hue+240)%360)+",100%,60%,0)");
        g.fillStyle=wg;g.fillRect(0,0,api.W,api.H);
        g.globalAlpha=wash*0.6;g.strokeStyle="rgba(255,255,255,.9)";g.lineWidth=4;
        g.beginPath();g.arc(px,playerY,(1-wash)*api.W*0.9,0,TAU);g.stroke();
        g.restore();g.globalCompositeOperation="source-over";g.globalAlpha=1;g.lineWidth=1;}
      // ① にじいろ 接近予告: 画面の上に控えていたら その列の上ふちに虹シェブロン(ドキドキ)
      for(const o of obs){ if(o.rainbow&&!o.dead&&sy(o)<0){
        const xx=clamp(o.x,140,api.W-140),pulse=0.5+0.5*Math.sin(tk*0.2),yb2=Math.max(96,api.H*0.13);
        g.save();g.globalAlpha=0.5+0.4*pulse;g.lineWidth=4;g.lineCap="round";g.lineJoin="round";
        for(let k=0;k<3;k++){g.strokeStyle=BCOL[k];const oy2=yb2+k*11;
          g.beginPath();g.moveTo(xx-13,oy2);g.lineTo(xx,oy2+11);g.lineTo(xx+13,oy2);g.stroke();}
        g.restore();g.globalAlpha=1;
      }}
      // ① にじいろバルーン！ 中央バナー(虹色に色替わり=レアの大きな祝福)
      if(rbMsgT>0){rbMsgT-=0.016*dt;
        const pop=1+Math.max(0,rbMsgT-1)*1.3,col=BCOL[Math.floor(tk*0.15)%BCOL.length];
        g.save();g.translate(api.W/2,api.H*0.2);g.scale(pop,pop);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(rbMsgT*1.4,0,1);g.font="900 34px 'Hiragino Maru Gothic ProN',system-ui";
        g.lineWidth=7;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText("にじいろバルーン！",0,0);
        g.fillStyle=col;g.fillText("にじいろバルーン！",0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(rbMsgT<0)rbMsgT=0;}
      // ② きょうのラッキー色 はっけん！ 中央の小ヒント(初回だけ)
      if(luckyMsgT>0){luckyMsgT-=0.016*dt;
        g.save();g.translate(api.W/2,api.H*0.28);g.textAlign="center";g.textBaseline="middle";
        g.globalAlpha=clamp(luckyMsgT*1.3,0,1);g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
        const t2="きょうのラッキー色は "+(CNAME[luckyColor]||"")+"！";
        g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.4)";g.strokeText(t2,0,0);
        g.fillStyle=luckyColor;g.fillText(t2,0,0);
        g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";if(luckyMsgT<0)luckyMsgT=0;}
      // stage clear banner + final celebration
      drawBanner(dt);
      // ===== cute rounded HUD =====
      drawHUD();
    }
  };
  function checkGate(){
    if(nextGate>=GATES.length)return;
    const gt=GATES[nextGate];
    if(alt>=gt.alt){
      nextGate++;stage=nextGate;banner=gt.name;bannerT=1;
      // fanfare
      api.shake(6);api.boom(0.6);
      api.tone(523,0.12,"triangle",0.13);setTimeout(()=>api.tone(659,0.12,"triangle",0.13),90);setTimeout(()=>api.tone(784,0.12,"triangle",0.13),180);setTimeout(()=>api.tone(1047,0.22,"triangle",0.14),270);
      api.slide(400,1300,0.25,0.16,"sawtooth");
      // checkpoint confetti burst
      for(let k=rint(26,34);k>0;k--){const a=rnd(0,TAU),s=rnd(3,10);sparks.push({x:api.W/2,y:api.H*0.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,r:rnd(2,5),life:1,decay:rnd(0.012,0.025),col:Math.random()<0.5?gt.col:pick(BCOL)});}
      if(gt.final){ // FINAL: full-screen celebration fireworks
        clearBurstT=1;wash=1;api.hitStop(4);
        for(let f=0;f<6;f++)clearBurst.push({x:rnd(api.W*0.2,api.W*0.8),y:rnd(api.H*0.18,api.H*0.6),delay:f*9,fired:false,col:pick(BCOL)});
      }
    }
  }
  function drawBanner(dt){
    // FINAL fireworks volley
    if(clearBurstT>0){clearBurstT=Math.max(0,clearBurstT-0.006*dt);
      for(const fw of clearBurst){if(fw.delay>0){fw.delay-=dt;continue;}
        if(!fw.fired){fw.fired=true;api.boom(0.5);api.tone(700+rnd(0,400),0.1,"triangle",0.1);
          for(let k=rint(22,30);k>0;k--){const a=rnd(0,TAU),s=rnd(3,8);sparks.push({x:fw.x,y:fw.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rnd(2,5),life:1,decay:rnd(0.015,0.03),col:Math.random()<0.5?fw.col:pick(BCOL)});}}}
      if(clearBurstT<=0)clearBurst=[];
    }
    if(bannerT<=0)return;
    bannerT=Math.max(0,bannerT-0.006*dt);
    const a=bannerT>0.85?(1-bannerT)/0.15:bannerT<0.2?bannerT/0.2:1; // ease in/out
    const gt=GATES[Math.min(stage-1,GATES.length-1)]||GATES[0];
    g.save();g.globalAlpha=clamp(a,0,1);
    const cy=api.H*0.4,pop=1+(bannerT>0.85?(bannerT-0.85)/0.15*0.3:0);
    g.translate(api.W/2,cy);g.scale(pop,pop);
    g.font="800 30px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";g.textBaseline="middle";
    const bw=((g.measureText(banner)||{}).width||banner.length*16)+56;
    g.shadowColor=gt.col;g.shadowBlur=24;rrect(-bw/2,-34,bw,68,22);g.fillStyle="rgba(20,30,60,.82)";g.fill();g.shadowBlur=0;
    rrect(-bw/2,-34,bw,68,22);g.strokeStyle=gt.col;g.lineWidth=3.5;g.stroke();g.lineWidth=1;
    g.fillStyle="#fff";g.font="800 16px 'Hiragino Maru Gothic ProN',system-ui";g.fillText(gt.final?"クリア！":"ステージ クリア！",0,-12);
    g.fillStyle=gt.col;g.font="800 26px 'Hiragino Maru Gothic ProN',system-ui";g.fillText(banner,0,14);
    g.restore();g.globalAlpha=1;g.textAlign="left";g.textBaseline="alphabetic";g.lineWidth=1;
  }
  function drawMeteor(m,y){
    g.save();g.translate(m.x,y);
    // glowing tail opposite to motion
    g.globalCompositeOperation="lighter";
    const tx=-Math.sign(m.vx||1)*m.r*2.4;
    let tg=g.createLinearGradient(0,0,tx,m.r*1.6);tg.addColorStop(0,"rgba(255,180,90,.7)");tg.addColorStop(1,"rgba(255,120,40,0)");
    g.fillStyle=tg;g.beginPath();g.moveTo(0,-m.r*0.6);g.lineTo(tx,m.r*0.4);g.lineTo(0,m.r*0.6);g.closePath();g.fill();
    g.globalCompositeOperation="source-over";
    // 岩は手描き(生成画像は床・余分な石が残り不採用)
    let rg=g.createRadialGradient(-m.r*0.3,-m.r*0.3,Math.max(0,m.r*0.1),0,0,Math.max(0,m.r));
    rg.addColorStop(0,"#ffe2a8");rg.addColorStop(0.5,"#c98a4a");rg.addColorStop(1,"#6b3d1e");
    g.fillStyle=rg;g.beginPath();g.arc(0,0,Math.max(0,m.r),0,TAU);g.fill();
    g.fillStyle="rgba(80,45,25,.6)";g.beginPath();g.arc(m.r*0.3,m.r*0.2,Math.max(0,m.r*0.22),0,TAU);g.arc(-m.r*0.2,m.r*0.35,Math.max(0,m.r*0.15),0,TAU);g.fill();
    g.restore();
  }
  function drawOb(o,y){
    if(o.type==="cloud"){
      g.save();g.shadowColor="rgba(180,200,230,.45)";g.shadowBlur=12;
      g.fillStyle="rgba(255,255,255,.96)";
      g.beginPath();g.arc(o.x-o.r*0.5,y,o.r*0.6,0,TAU);g.arc(o.x,y-o.r*0.3,o.r*0.7,0,TAU);g.arc(o.x+o.r*0.5,y,o.r*0.6,0,TAU);g.arc(o.x,y+o.r*0.25,o.r*0.6,0,TAU);g.fill();
      g.shadowBlur=0;
      // soft shaded underside
      g.fillStyle="rgba(190,205,230,.4)";g.beginPath();g.arc(o.x,y+o.r*0.25,o.r*0.5,0,TAU);g.fill();
      g.restore();
    }else if(o.type==="bigcloud"){
      // ⑥ 大きな入道雲: 他の的よりずっと大きく、3回当てないと壊れない(大きさ・壊れ方の違い)
      const hp=o.hp==null?3:o.hp,maxHp=o.maxHp||3,hpFrac=clamp(hp/maxHp,0,1);
      g.save();g.shadowColor="rgba(180,200,230,.5)";g.shadowBlur=16;
      g.fillStyle="rgba(255,255,255,"+(0.82+0.12*hpFrac)+")";
      g.beginPath();
      g.arc(o.x-o.r*0.55,y+o.r*0.1,Math.max(0,o.r*0.55),0,TAU);
      g.arc(o.x-o.r*0.15,y-o.r*0.35,Math.max(0,o.r*0.62),0,TAU);
      g.arc(o.x+o.r*0.3,y-o.r*0.15,Math.max(0,o.r*0.58),0,TAU);
      g.arc(o.x+o.r*0.6,y+o.r*0.12,Math.max(0,o.r*0.5),0,TAU);
      g.arc(o.x,y+o.r*0.3,Math.max(0,o.r*0.6),0,TAU);
      g.fill();g.shadowBlur=0;
      g.fillStyle="rgba(190,205,230,"+(0.35+0.15*(1-hpFrac))+")";
      g.beginPath();g.arc(o.x,y+o.r*0.32,Math.max(0,o.r*0.55),0,TAU);g.fill();
      // 残りヒット数を頭上の星で見せる(あと何回か分かる)
      for(let i=0;i<maxHp;i++){
        g.globalAlpha=i<hp?0.9:0.25;g.fillStyle="#ffd23f";
        const hx=o.x-(maxHp-1)*7+i*14,hy2=y-o.r*0.8;
        g.beginPath();for(let k=0;k<5;k++){const a=-Math.PI/2+k*TAU/5;g.lineTo(hx+Math.cos(a)*4.5,hy2+Math.sin(a)*4.5);const a2=a+TAU/10;g.lineTo(hx+Math.cos(a2)*2,hy2+Math.sin(a2)*2);}g.closePath();g.fill();
      }
      g.globalAlpha=1;g.restore();
    }else if(o.type==="kite"){
      // ⑤ たこ(凧): ひし形+しっぽ。丸い風船・もこもこ雲とはっきり違う形
      g.save();g.translate(o.x,y);g.rotate(Math.sin(tk*0.03+o.x)*0.12);
      g.shadowColor=o.color;g.shadowBlur=12;
      let kg=g.createLinearGradient(0,-o.r,0,o.r);
      kg.addColorStop(0,BHI[o.color]||"#fff");kg.addColorStop(1,o.color);
      g.fillStyle=kg;
      g.beginPath();g.moveTo(0,-o.r);g.lineTo(o.r*0.75,0);g.lineTo(0,o.r*0.85);g.lineTo(-o.r*0.75,0);g.closePath();g.fill();
      g.shadowBlur=0;
      g.strokeStyle="rgba(255,255,255,.6)";g.lineWidth=1.5;
      g.beginPath();g.moveTo(0,-o.r);g.lineTo(0,o.r*0.85);g.moveTo(-o.r*0.75,0);g.lineTo(o.r*0.75,0);g.stroke();g.lineWidth=1;
      g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;
      g.beginPath();g.moveTo(0,o.r*0.85);g.quadraticCurveTo(Math.sin(tk*0.08+o.x)*10,o.r*1.2,0,o.r*1.5);g.stroke();g.lineWidth=1;
      g.fillStyle=o.color;
      for(let i=0;i<2;i++){const ty=o.r*(1.15+i*0.35);g.beginPath();g.ellipse(0,ty,Math.max(0,o.r*0.16),Math.max(0,o.r*0.1),Math.PI/4,0,TAU);g.fill();}
      g.restore();
    }else if(o.type==="bird"){
      // ⑦ とり: 横長のW字翼シルエット+羽ばたきアニメ。丸い風船・雲、ひし形の凧とはっきり違う形
      const flap=Math.sin(tk*0.25+(o.ph||0))*0.5+0.5,wspan=o.hw||o.r*1.5,bodyR=Math.max(0,o.r*0.35);
      g.save();g.translate(o.x,y);
      g.strokeStyle=o.color;g.lineWidth=Math.max(2,o.r*0.22);g.lineCap="round";g.lineJoin="round";
      g.shadowColor=o.color;g.shadowBlur=8;
      const wy=-2-flap*6;
      g.beginPath();
      g.moveTo(-wspan,wy+8-flap*4);
      g.quadraticCurveTo(-wspan*0.5,wy-6,0,wy+2);
      g.quadraticCurveTo(wspan*0.5,wy-6,wspan,wy+8-flap*4);
      g.stroke();g.shadowBlur=0;g.lineWidth=1;
      g.fillStyle=o.color;g.beginPath();g.ellipse(0,4,bodyR*1.3,bodyR,0,0,TAU);g.fill();
      g.fillStyle="#ffb84d";g.beginPath();g.moveTo(bodyR*1.1,3);g.lineTo(bodyR*1.9,5);g.lineTo(bodyR*1.1,7);g.closePath();g.fill();
      g.restore();
    }else if(o.type==="blimp"){
      // ⑧ ひこうせん/UFO: 横長・大きい・矩形寄りの当たり判定を持つ『大きい乗り物』(丸系・ひし形とはっきり違う)
      const hw2=o.hw||o.r,hh2=o.hh||o.r*0.5;
      g.save();g.translate(o.x,y);
      g.shadowColor=o.color;g.shadowBlur=14;
      let bg2=g.createLinearGradient(-hw2,0,hw2,0);
      bg2.addColorStop(0,blend(o.color,"#000000",0.3));bg2.addColorStop(0.5,BHI[o.color]||"#fff");bg2.addColorStop(1,blend(o.color,"#000000",0.3));
      g.fillStyle=bg2;rrect(-hw2,-hh2,hw2*2,hh2*2,hh2);g.fill();
      g.shadowBlur=0;
      g.fillStyle="rgba(255,255,255,.55)";
      for(let i=-2;i<=2;i++){g.beginPath();g.arc(i*hw2*0.28,-hh2*0.1,Math.max(0,hh2*0.22),0,TAU);g.fill();}
      g.fillStyle=blend(o.color,"#000000",0.5);
      rrect(-hw2*0.3,hh2*0.7,hw2*0.6,hh2*0.5,4);g.fill();
      g.fillStyle=o.color;g.beginPath();g.moveTo(hw2*0.75,-hh2*0.6);g.lineTo(hw2*1.15,-hh2*1.15);g.lineTo(hw2*0.95,-hh2*0.2);g.closePath();g.fill();
      g.restore();
    }else{
      // ① にじいろバルーンは色が虹に流れ、白い光の輪をまとう(激レアの目印)
      const col=o.rainbow?BCOL[Math.floor(tk*0.14+o.x*0.1)%BCOL.length]:o.color;
      const hicol=o.rainbow?"#ffffff":(BHI[o.color]||"#ffffff");
      // bonus balloons / にじいろ get a twinkling halo so kids aim for it
      if(o.bonus||o.rainbow){g.save();g.globalCompositeOperation="lighter";const tw=0.4+0.4*Math.abs(Math.sin(tk*0.12+o.x));
        g.globalAlpha=tw;g.strokeStyle=o.rainbow?col:"#fff3c2";g.lineWidth=o.rainbow?3:2;
        g.beginPath();g.arc(o.x,y,o.r*(o.rainbow?1.35:1.25),0,TAU);g.stroke();g.restore();g.globalCompositeOperation="source-over";g.globalAlpha=1;g.lineWidth=1;}
      // string
      g.strokeStyle="rgba(255,255,255,.35)";g.lineWidth=1.5;g.beginPath();g.moveTo(o.x,y+o.r);g.quadraticCurveTo(o.x+Math.sin(tk*0.05+o.x)*4,y+o.r*1.25,o.x,y+o.r*1.5);g.stroke();g.lineWidth=1;
      // glowing body with radial shading
      let bg=g.createRadialGradient(o.x-o.r*0.3,y-o.r*0.35,o.r*0.1,o.x,y,o.r*1.05);
      bg.addColorStop(0,hicol);bg.addColorStop(0.55,col);bg.addColorStop(1,blend(col,"#000000",0.7));
      g.save();g.shadowColor=col;g.shadowBlur=o.rainbow?16:10;
      g.fillStyle=bg;g.beginPath();g.ellipse(o.x,y,o.r*0.82,o.r,0,0,TAU);g.fill();
      g.shadowBlur=0;
      // specular highlight
      g.fillStyle="rgba(255,255,255,.75)";g.beginPath();g.ellipse(o.x-o.r*0.28,y-o.r*0.34,o.r*0.16,o.r*0.24,-0.5,0,TAU);g.fill();
      // knot
      g.fillStyle=blend(col,"#000000",0.4);g.beginPath();g.moveTo(o.x-o.r*0.12,y+o.r*0.95);g.lineTo(o.x+o.r*0.12,y+o.r*0.95);g.lineTo(o.x,y+o.r*1.12);g.closePath();g.fill();
      g.restore();
    }
  }
  function drawJet(){
    const x=px,y=playerY;
    g.save();g.translate(x,y);g.rotate(jetTilt);
    const fl=12+thrustViz*38+Math.sin(tk*0.5)*5;
    // squash & stretch from vertical speed
    const stretch=clamp(1+vy*0.012,0.9,1.18),squash=1/Math.sqrt(stretch);
    // exhaust glow under nozzle
    if(thrustViz>0.05){
      g.save();g.globalCompositeOperation="lighter";
      let eg=g.createRadialGradient(0,30,0,0,30,28+thrustViz*20);
      eg.addColorStop(0,"rgba(255,210,120,"+(0.5*thrustViz)+")");eg.addColorStop(1,"rgba(255,120,40,0)");
      g.fillStyle=eg;g.beginPath();g.arc(0,30,28+thrustViz*20,0,TAU);g.fill();
      g.restore();
    }
    g.scale(squash,stretch);
    // flame (layered: outer glow / yellow / orange / white core)
    if(thrustViz>0.05){
      g.save();g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(255,180,60,.55)";g.beginPath();g.moveTo(-11,18);g.quadraticCurveTo(0,30+fl*1.1,11,18);g.closePath();g.fill();
      g.fillStyle="#ffce3a";g.beginPath();g.moveTo(-9,18);g.lineTo(0,18+fl);g.lineTo(9,18);g.closePath();g.fill();
      g.fillStyle="#ff6b2c";g.beginPath();g.moveTo(-5,18);g.lineTo(0,18+fl*0.6);g.lineTo(5,18);g.closePath();g.fill();
      g.fillStyle="rgba(255,255,255,.9)";g.beginPath();g.moveTo(-2.5,18);g.lineTo(0,18+fl*0.35);g.lineTo(2.5,18);g.closePath();g.fill();
      g.restore();
    }
    // ロケット本体は手描き(生成画像は2回とも斜め向き＋影が残り不採用)
    // body (rocket) with metallic gradient
    let bgr=g.createLinearGradient(-12,0,12,0);
    bgr.addColorStop(0,"#aeb9c6");bgr.addColorStop(0.45,"#ffffff");bgr.addColorStop(0.55,"#eef3f8");bgr.addColorStop(1,"#b9c4d0");
    g.fillStyle=bgr;g.beginPath();g.moveTo(0,-26);g.quadraticCurveTo(16,-4,12,18);g.lineTo(-12,18);g.quadraticCurveTo(-16,-4,0,-26);g.closePath();g.fill();
    // fins
    g.fillStyle="#e74c3c";g.beginPath();g.moveTo(-12,10);g.lineTo(-22,22);g.lineTo(-12,18);g.closePath();g.fill();
    g.beginPath();g.moveTo(12,10);g.lineTo(22,22);g.lineTo(12,18);g.closePath();g.fill();
    // window with glow
    let wg=g.createRadialGradient(-2,-8,1,0,-6,8);wg.addColorStop(0,"#bff0ff");wg.addColorStop(1,"#2f8fb0");
    g.fillStyle=wg;g.beginPath();g.arc(0,-6,7,0,TAU);g.fill();
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=1.2;g.beginPath();g.arc(0,-6,7,0,TAU);g.stroke();g.lineWidth=1;
    g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(-2,-8,2.5,0,TAU);g.fill();
    // nose
    g.fillStyle="#e74c3c";g.beginPath();g.moveTo(0,-26);g.quadraticCurveTo(6,-16,5,-12);g.lineTo(-5,-12);g.quadraticCurveTo(-6,-16,0,-26);g.closePath();g.fill();
    g.fillStyle="rgba(255,255,255,.4)";g.beginPath();g.moveTo(0,-25);g.quadraticCurveTo(3,-17,2,-13);g.lineTo(-1,-13);g.closePath();g.fill();
    g.restore();
  }
  function rrect(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function drawHUD(){
    g.save();
    // altitude badge (top-center): rounded panel + glow + little star mascot
    const txt=Math.floor(alt/10)+"m",bob=Math.sin(tk*0.05)*2;
    g.font="800 22px 'Hiragino Maru Gothic ProN',system-ui";
    const tw=(g.measureText(txt)||{}).width||txt.length*13,padL=46,padR=18,bw=tw+padL+padR,bh=40,bx=api.W/2-bw/2,by=14+bob;
    g.shadowColor="rgba(90,150,230,.55)";g.shadowBlur=16;
    rrect(bx,by,bw,bh,20);g.fillStyle="rgba(30,45,90,.62)";g.fill();g.shadowBlur=0;
    rrect(bx,by,bw,bh,20);g.strokeStyle="rgba(255,255,255,.85)";g.lineWidth=2.5;g.stroke();g.lineWidth=1;
    // little glowing star mascot inside badge with a smile
    const sx=bx+26,sy=by+bh/2;
    g.save();g.translate(sx,sy);g.rotate(Math.sin(tk*0.04)*0.18);
    g.shadowColor="#ffd23f";g.shadowBlur=10;g.fillStyle="#ffd23f";
    g.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+i*TAU/5;g.lineTo(Math.cos(a)*12,Math.sin(a)*12);const a2=a+TAU/10;g.lineTo(Math.cos(a2)*5,Math.sin(a2)*5);}g.closePath();g.fill();g.shadowBlur=0;
    g.fillStyle="#5a3a00";g.beginPath();g.arc(-3.5,-1,1.5,0,TAU);g.arc(3.5,-1,1.5,0,TAU);g.fill();
    g.strokeStyle="#5a3a00";g.lineWidth=1.4;g.beginPath();g.arc(0,1,3.2,0.15*Math.PI,0.85*Math.PI);g.stroke();g.lineWidth=1;
    g.restore();
    // altitude number
    g.textAlign="left";g.textBaseline="middle";
    g.fillStyle="#fff7c8";g.shadowColor="rgba(255,210,80,.6)";g.shadowBlur=8;
    g.fillText(txt,bx+padL,by+bh/2+1);g.shadowBlur=0;
    // stage pill (next goal) under the badge
    const totalGates=GATES.length;const sNo=Math.min(stage+1,totalGates);
    const stxt="ステージ "+sNo+" / "+totalGates;
    g.font="800 14px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
    const sw=((g.measureText(stxt)||{}).width||stxt.length*9)+24,sxp=api.W/2-sw/2,syp=by+bh+6;
    rrect(sxp,syp,sw,24,12);g.fillStyle="rgba(30,45,90,.5)";g.fill();
    rrect(sxp,syp,sw,24,12);g.strokeStyle="rgba(255,255,255,.55)";g.lineWidth=1.6;g.stroke();g.lineWidth=1;
    g.fillStyle="#cfe2ff";g.textBaseline="middle";g.fillText(stxt,api.W/2,syp+13);
    g.textAlign="left";
    // hint pill (bottom): rounded translucent panel + outline
    g.font="800 18px 'Hiragino Maru Gothic ProN',system-ui";g.textAlign="center";
    const ht="おしっぱなしで じょうしょう！ ゆびで よける／つきぬける！";
    const hw=((g.measureText(ht)||{}).width||ht.length*10)+40,hh=38,hx=api.W/2-hw/2,hy=api.H-hh-12;
    rrect(hx,hy,hw,hh,15);g.fillStyle="rgba(20,30,60,.5)";g.fill();
    rrect(hx,hy,hw,hh,15);g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;g.stroke();g.lineWidth=1;
    g.fillStyle="rgba(255,255,255,.95)";g.textBaseline="middle";g.fillText(ht,api.W/2,hy+hh/2+1);
    g.restore();
    g.textAlign="left";g.textBaseline="alphabetic";g.globalAlpha=1;
  }
  function blend(a,b,t){const ca=parseInt(a.slice(1),16),cb=parseInt(b.slice(1),16);
    const r=Math.round(lerp((ca>>16)&255,(cb>>16)&255,t)),gg=Math.round(lerp((ca>>8)&255,(cb>>8)&255,t)),bb=Math.round(lerp(ca&255,cb&255,t));
    return "rgb("+r+","+gg+","+bb+")";}
}
Engine.register("jet", buildJet);
