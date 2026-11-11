(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const ui = { stars:$('stars'), starBar:$('starBar'), questBar:$('questBar'), questCount:$('questCount'), progressBar:$('progressBar'), progressText:$('progressText'), checkpoint:$('checkpointText'), zone:$('zoneName'), toast:$('toast'), center:$('centerMessage'), modal:$('modalBackdrop'), finish:$('finishBanner') };
  let W=innerWidth,H=innerHeight,DPR=1,camX=0,camY=0,last=0,started=false,paused=false,complete=false,stars=0,coins=125,checkpointX=90,toastTimer=0,soundOn=true,avatarColor='#ffbf69';
  const held={};
  const player={x:90,y:0,vx:0,vy:0,w:34,h:57,ground:false,facing:1,walk:0};
  const platforms=[
    {x:0,y:500,w:390,type:'start',name:'START ISLAND'}, {x:455,y:455,w:190,type:'grass'}, {x:704,y:407,w:175,type:'grass'},
    {x:938,y:463,w:220,type:'checkpoint',name:'CLOUDSTEP CHECKPOINT'}, {x:1225,y:405,w:175,type:'grass'}, {x:1465,y:354,w:180,type:'grass'},
    {x:1697,y:411,w:220,type:'checkpoint',name:'RAINBOW CHECKPOINT'}, {x:1987,y:355,w:170,type:'grass'}, {x:2223,y:303,w:175,type:'grass'},
    {x:2467,y:359,w:205,type:'checkpoint',name:'STARLIGHT CHECKPOINT'}, {x:2745,y:306,w:175,type:'grass'}, {x:2980,y:252,w:180,type:'grass'},
    {x:3225,y:310,w:215,type:'checkpoint',name:'PALACE CHECKPOINT'}, {x:3500,y:263,w:190,type:'grass'}, {x:3760,y:215,w:205,type:'grass'},
    {x:4050,y:271,w:300,type:'finish',name:'SKY PALACE'}
  ];
  const hazards=[{x:563,y:435,w:32},{x:1070,y:443,w:36},{x:1533,y:334,w:30},{x:2110,y:335,w:31},{x:2550,y:339,w:32},{x:3065,y:232,w:36},{x:3614,y:243,w:35}];
  const pickups=[];
  [255,526,769,1010,1312,1557,1777,2050,2290,2547,2820,3065,3330,3590,3860,4182].forEach((x,i)=>{
    const p=platforms.find(q=>x>q.x&&x<q.x+q.w)||platforms[0];
    pickups.push({x,y:p.y-54-(i%3)*16,got:false,kind:i%2?'coin':'star'});
  });
  const checkpointList=platforms.filter(p=>p.type==='checkpoint');
  const clouds=Array.from({length:24},(_,i)=>({x:i*250+(i*73%140),y:70+(i*113%250),s:.55+(i%4)*.22,phase:i*2.7}));
  const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','a','d','w','s','A','D','W','S'];
  function resize(){W=innerWidth;H=innerHeight;DPR=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(W*DPR);canvas.height=Math.floor(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}
  addEventListener('resize',resize);resize();
  function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
  function path(points,fill){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill()}
  function drawCloud(x,y,s,alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x,y,38*s,15*s,0,0,Math.PI*2);ctx.ellipse(x-22*s,y+3*s,22*s,12*s,0,0,Math.PI*2);ctx.ellipse(x+19*s,y-7*s,25*s,20*s,0,0,Math.PI*2);ctx.ellipse(x+42*s,y+3*s,19*s,11*s,0,0,Math.PI*2);ctx.fill();ctx.restore()}
  function background(t){
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#52b9ed');sky.addColorStop(.58,'#b3e8fa');sky.addColorStop(1,'#e6f8ff');rect(0,0,W,H,sky);
    // soft sun halo
    const sx=W*.77,sy=H*.25,g=ctx.createRadialGradient(sx,sy,8,sx,sy,145);g.addColorStop(0,'#fff8c9a8');g.addColorStop(1,'#fff8c900');ctx.fillStyle=g;ctx.fillRect(sx-145,sy-145,290,290);ctx.fillStyle='#fff2c8';ctx.beginPath();ctx.arc(sx,sy,34,0,Math.PI*2);ctx.fill();
    clouds.forEach(c=>{let x=((c.x-camX*.18+t*.006)%(W+180)+W+180)%(W+180)-70;drawCloud(x,c.y*H/800,c.s,.22+c.s*.1)});
    // distant floating hills/islands
    for(let i=0;i<9;i++){let x=((i*230-camX*.35)%(W+380)+W+380)%(W+380)-190;let y=H*.63+(i%3)*45;path([[x-115,y],[x-85,y-37],[x-30,y-47],[x+10,y-30],[x+82,y-34],[x+125,y],[x+63,y+38],[x+20,y+104],[x-12,y+54],[x-65,y+42]],i%2?'#ffffff74':'#e9faff90');rect(x-43,y+8,78,Math.max(30,H*.28),'#d0effa66');}
    // far palace silhouettes
    let px=W*.78-camX*.12;ctx.globalAlpha=.27;for(let i=0;i<5;i++){let x=px+i*34,y=H*.36+(i%2)*14;rect(x,y,20,H*.28,'#fff');path([[x-5,y],[x+10,y-24],[x+25,y]],'#fff')}ctx.globalAlpha=1;
  }
  function sx(x){return x-camX}function sy(y){return y-camY}
  function drawIsland(p){
    const x=sx(p.x),y=sy(p.y),w=p.w;if(x+w<-100||x>W+100)return;
    // island floating shadow and tapered underside
    ctx.save();ctx.shadowColor='#5689b455';ctx.shadowBlur=15;ctx.shadowOffsetY=12;
    path([[x,y],[x+w,y],[x+w-15,y+18],[x+w*.79,y+31],[x+w*.72,y+58],[x+w*.5,y+77],[x+w*.29,y+55],[x+w*.2,y+34],[x+12,y+24]],p.type==='finish'?'#d9b8ff':'#8c6b5b');ctx.restore();
    path([[x+12,y+18],[x+w*.22,y+29],[x+w*.3,y+51],[x+w*.5,y+70],[x+w*.67,y+50],[x+w*.78,y+28],[x+w-13,y+15],[x+w-22,y+31],[x+25,y+35]],'#ad8870');
    const colors={start:['#66dc9e','#39b780'],grass:['#67e2a2','#39bb7d'],checkpoint:['#76e7b0','#42bf86'],finish:['#f6d776','#e9a94f']};const [top,side]=colors[p.type]||colors.grass;
    rounded(x,y-5,w,20,7,top,'#e7ffe0');rect(x+4,y+9,w-8,6,side);
    // turf tufts
    for(let j=0;j<Math.floor(w/31);j++){let tx=x+17+j*31;path([[tx,y-3],[tx+3,y-10],[tx+6,y-3]],'#b9ffc1');}
    if(p.type==='start'){for(let i=0;i<4;i++){const bx=x+55+i*70;rounded(bx,y-33,38,28,5,['#f5bc57','#f27968','#9673e8','#5ac8dc'][i],'#ffffff88');rect(bx+4,y-29,30,4,'#ffffff55')}}
    if(p.type==='checkpoint'){const flagX=x+w*.55;rect(flagX,y-43,3,41,'#f8f2d5');path([[flagX+2,y-42],[flagX+25,y-35],[flagX+2,y-27]],checkpointX>=p.x?'#ffe174':'#bbcad4');rounded(flagX-6,y-7,14,7,3,'#fff4d6')}
    if(p.type==='finish'){for(let i=0;i<3;i++){let tx=x+50+i*65;rect(tx,y-31,13,26,['#fb8b77','#9e83ee','#52cadd'][i]);rounded(tx-4,y-35,21,8,3,'#fff3cd')};drawCloud(x+w*.52,y-20,.55,.95)}
  }
  function drawHazard(h,t){const x=sx(h.x),y=sy(h.y);if(x<-60||x>W+60)return;ctx.save();ctx.translate(x+h.w/2,y+6);ctx.shadowColor='#ff6b5e';ctx.shadowBlur=12;ctx.fillStyle='#ff6968';ctx.beginPath();for(let i=0;i<8;i++){let a=i*Math.PI/4-Math.PI/2,r=i%2?7:13;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.restore();ctx.fillStyle='#fff2';ctx.fillRect(x,y+9,h.w,3)}
  function drawPickup(o,t){if(o.got)return;let x=sx(o.x),y=sy(o.y)+Math.sin(t/300+o.x)*5;if(x<-30||x>W+30)return;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t/550+o.x)*.14);if(o.kind==='star'){ctx.shadowColor='#ffcf52';ctx.shadowBlur=16;ctx.fillStyle='#ffdf69';ctx.strokeStyle='#fff5b4';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<10;i++){let a=-Math.PI/2+i*Math.PI/5,r=i%2?7:15;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.stroke()}else{ctx.shadowColor='#56edff';ctx.shadowBlur=14;ctx.fillStyle='#64e8f4';ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c8ffff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('B',0,4)}ctx.restore()}
  function drawPlayer(t){const x=sx(player.x),y=sy(player.y),w=player.w,h=player.h;let bob=player.ground?Math.sin(player.walk)*1.5:0;ctx.save();ctx.translate(x+w/2,y+bob);
    // shadow
    ctx.globalAlpha=.22;ctx.fillStyle='#22465c';ctx.beginPath();ctx.ellipse(0,h+3,17,5,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    // legs
    let swing=player.ground?Math.sin(player.walk)*4:0;rounded(-12,h-17,10,17,2,'#5366d9');rounded(2,h-17,10,17,2,'#5366d9');
    if(player.ground){rect(-12+swing,h-4,12,4,'#3547a7');rect(2-swing,h-4,12,4,'#3547a7')}
    // arms, body
    ctx.save();ctx.rotate(player.ground?Math.sin(player.walk)*.06:0);rounded(-20,21,9,24,3,avatarColor);rounded(11,21,9,24,3,avatarColor);ctx.restore();rounded(-13,20,26,23,3,'#6d83f6');rect(-10,22,20,4,'#92a2ff');
    // square head with hair
    rounded(-15,0,30,25,5,avatarColor,'#ffe0a2');rounded(-16,-3,31,9,4,'#51424d');rect(-15,2,7,7,'#51424d');
    ctx.fillStyle='#27334a';ctx.fillRect(-8,10,3,4);ctx.fillRect(6,10,3,4);ctx.strokeStyle='#9e5246';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-2,17);ctx.quadraticCurveTo(1,20,4,17);ctx.stroke();
    // scarf
    rect(-13,23,26,4,'#ff7381');path([[-8,26],[-1,27],[-7,37]],'#ff7381');ctx.restore();
  }
  function render(t){background(t); // faint platform glows
    platforms.forEach(drawIsland);hazards.forEach(h=>drawHazard(h,t));pickups.forEach(o=>drawPickup(o,t));drawPlayer(t);
    // sparkly atmosphere
    for(let i=0;i<18;i++){let x=(i*173+Math.sin(t/1200+i)*28-camX*.05)%(W+20);if(x<0)x+=W;let y=(i*97+Math.sin(t/800+i*2)*16)%(H*.72);ctx.globalAlpha=.28+Math.sin(t/500+i)*.15;ctx.fillStyle='#fff';ctx.fillRect(x,y,2,2)}ctx.globalAlpha=1;
  }
  function collision(){player.ground=false;for(const p of platforms){if(player.x+player.w>p.x&&player.x<p.x+p.w&&player.vy>=0&&player.y+player.h>=p.y&&player.y+player.h<=p.y+player.vy+player.h*.25){player.y=p.y-player.h;player.vy=0;player.ground=true;if(p.type==='finish'&&!complete)win();}}
    for(const h of hazards){if(player.x+player.w>h.x-2&&player.x<h.x+h.w+2&&player.y+player.h>h.y-13&&player.y+player.h<h.y+25){respawn('Ouch! Back to your checkpoint')}}
  }
  function showToast(text='✦|Nice! Star collected'){const [icon,msg]=text.split('|');ui.toast.innerHTML=`<span>${icon}</span><b>${msg}</b>`;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1500)}
  function collect(){for(const o of pickups){if(o.got)continue;const dx=o.x-(player.x+player.w/2),dy=o.y-(player.y+player.h/2);if(dx*dx+dy*dy<37*37){o.got=true;if(o.kind==='star'){stars++;ui.stars.textContent=stars;ui.starBar.style.width=`${Math.min(stars/8*100,100)}%`;ui.questCount.textContent=stars;ui.questBar.style.width=`${Math.min(stars/8*100,100)}%`;showToast()}else{coins+=5;$('coins').textContent=coins;showToast('◉|+5 Blockbucks')}}}}
  function progress(){const n=Math.min(100,Math.max(0,Math.round(player.x/4350*100)));ui.progressText.textContent=`${n}%`;ui.progressBar.style.width=n+'%';if(player.x>1200&&player.x<1980)ui.zone.textContent='Rainbow Ridge';else if(player.x>=1980&&player.x<2740)ui.zone.textContent='Starlight Summit';else if(player.x>=2740&&player.x<3500)ui.zone.textContent='Cloud Palace';else if(player.x>=3500)ui.zone.textContent='Sky Palace';else ui.zone.textContent='Cloudstep Meadow';
    for(const p of checkpointList){if(player.x>p.x+28&&checkpointX<p.x){checkpointX=p.x;ui.checkpoint.textContent=p.name;showToast('⚑|Checkpoint reached!');}}
  }
  function respawn(msg){player.x=checkpointX+24;const p=[...platforms].reverse().find(q=>q.x<=player.x&&q.x+q.w>=player.x)||platforms[0];player.y=p.y-player.h;player.vy=0;player.vx=0;showToast('↻|'+msg)}
  function win(){complete=true;started=true;ui.finish.classList.add('show');}
  function update(dt,t){if(started&&!paused&&!complete){const speed=245;let dir=(held.ArrowRight||held.d||held.D?1:0)-(held.ArrowLeft||held.a||held.A?1:0);player.vx=dir*speed;if(dir)player.facing=dir;player.x=Math.max(0,player.x+player.vx*dt);player.vy+=1250*dt;player.y+=player.vy*dt;collision();collect();if(player.y>H+camY+220)respawn('Whoops! Try that jump again');if(player.ground&&dir)player.walk+=dt*12;progress();}
    const targetX=Math.max(0,player.x-W*.36);camX+=(targetX-camX)*Math.min(1,dt*4);const targetY=player.y-H*.61;camY+=(targetY-camY)*Math.min(1,dt*3.5);render(t);requestAnimationFrame(frame)}
  function frame(t){let dt=Math.min(.035,(t-last)/1000||0);last=t;update(dt,t)}requestAnimationFrame(frame);
  function jump(){if(!started){startGame();return}if(paused||complete)return;if(player.ground){player.vy=-520;player.ground=false}}
  function startGame(){started=true;paused=false;ui.center.classList.add('hidden');if(player.y===0){const p=platforms[0];player.y=p.y-player.h;camY=player.y-H*.61}}
  $('startBtn').addEventListener('click',startGame);
  addEventListener('keydown',e=>{if(keys.includes(e.key)){e.preventDefault();held[e.key]=true;if(e.key===' '||e.key==='ArrowUp'||e.key==='w'||e.key==='W')jump()}if(e.key==='Escape'){togglePause()}});
  addEventListener('keyup',e=>{held[e.key]=false});
  document.querySelectorAll('.mobile-controls button').forEach(btn=>{const key=btn.dataset.key;const down=e=>{e.preventDefault();if(key==='jump')jump();else held[key==='left'?'a':'d']=true};const up=e=>{e.preventDefault();if(key!=='jump')held[key==='left'?'a':'d']=false};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up)});
  function togglePause(){if(!started||complete)return;paused=!paused;let overlay=document.getElementById('pauseOverlay');if(paused){overlay=document.createElement('div');overlay.className='pause-overlay';overlay.id='pauseOverlay';overlay.innerHTML='<div class="message-card"><span class="message-icon">Ⅱ</span><h1>Taking a breather?</h1><p>Your checkpoint is saved. The clouds can wait!</p><button class="primary-btn" id="resumeBtn">KEEP PLAYING <span>→</span></button></div>';document.querySelector('.game-shell').appendChild(overlay);$('resumeBtn').onclick=togglePause}else if(overlay)overlay.remove()}
  $('pauseBtn').addEventListener('click',togglePause);$('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundBtn').textContent=soundOn?'♫':'♪';showToast(soundOn?'♫|Sound on':'♪|Sound off')});
  function openModal(){ui.modal.classList.remove('hidden');ui.modal.innerHTML=`<div class="modal-head"><h2>Make it yours ✨</h2><button class="close-btn" id="closeModal">×</button></div><p class="modal-copy">Choose your block buddy's look. Your style, your adventure.</p><div class="swatches">${['#ffbf69','#ff8396','#66d8d1','#b18afa','#9de27d','#f2e9dc'].map((c,i)=>`<button class="swatch ${c===avatarColor?'active':''}" data-color="${c}" style="background:${c}" aria-label="Avatar color ${i+1}"></button>`).join('')}</div><div class="outfit-row"><span>🧢 &nbsp; Classic cap</span><b>OWNED</b></div><div class="outfit-row"><span>👟 &nbsp; Cloud sneakers</span><b>OWNED</b></div><button class="primary-btn" id="saveAvatar">LOOKS GOOD</button>`;$('closeModal').onclick=()=>ui.modal.classList.add('hidden');$('saveAvatar').onclick=()=>{ui.modal.classList.add('hidden');showToast('✦|Avatar look saved!')};ui.modal.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{avatarColor=b.dataset.color;ui.modal.querySelectorAll('.swatch').forEach(s=>s.classList.toggle('active',s===b));document.querySelector('.player-face').style.background=avatarColor})}
  $('avatarBtn').addEventListener('click',openModal);$('homeBtn').addEventListener('click',()=>{if(started&&!complete)togglePause();else{ui.center.classList.remove('hidden')}});ui.modal.addEventListener('click',e=>{if(e.target===ui.modal)ui.modal.classList.add('hidden')});
  $('replayBtn').addEventListener('click',()=>{stars=0;coins=125;checkpointX=90;complete=false;player.x=90;player.y=platforms[0].y-player.h;player.vy=0;pickups.forEach(p=>p.got=false);ui.stars.textContent='0';ui.starBar.style.width='0';ui.questCount.textContent='0';ui.questBar.style.width='0';$('coins').textContent='125';ui.checkpoint.textContent='START ISLAND';ui.finish.classList.remove('show');started=true;camX=0;progress()});
  player.y=platforms[0].y-player.h;
})();
