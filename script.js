/* Monochrome star chart with pulsing orbits, blinking pulse animation for pulse.png,
   scattered tiers & achievements, planet overlay + junction modal.
   Keeps achievements.json untouched and uses localStorage for progress.
*/

// -- Canvas setup & retina scaling --
const canvas = document.getElementById('starChart');
const ctx = canvas.getContext('2d');
let width = window.innerWidth, height = window.innerHeight;

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// -- Assets (images & audio kept as references) --
const assets = {
  center: new Image(),
  planet: new Image(),
  lock: new Image(),
  pulse: new Image(),
  node: new Image(),
  junction: new Image()
};
assets.center.src = './assets/center.png';
assets.planet.src = './assets/planet.png';
assets.lock.src = './assets/lock.png';
assets.pulse.src = './assets/pulse.png';
assets.node.src = './assets/node.png';
assets.junction.src = './assets/junction.png';

// optional sounds (non-blocking)
const sounds = {
  hover: new Audio('./assets/hover.mp3'),
  zoom: new Audio('./assets/zoom.mp3')
};
try{ sounds.hover.load(); sounds.zoom.load(); }catch(e){}

// -- Data: achievements.json (do NOT edit file externally) --
let achievements = {};
fetch('./achievements.json')
  .then(r => r.json())
  .then(data => {
    achievements = data;
    const saved = localStorage.getItem('progress');
    if (saved) {
      try {
        const progress = JSON.parse(saved);
        progress.planets?.forEach((p, i) => {
          p.tiers?.forEach((t, j) => {
            t.achievements?.forEach((a, k) => {
              if (achievements.planets?.[i]?.tiers?.[j]?.achievements?.[k]) {
                achievements.planets[i].tiers[j].achievements[k].status = a.status;
                achievements.planets[i].tiers[j].achievements[k].dateCompleted = a.dateCompleted || null;
              }
            });
          });
        });
      } catch(e){}
    }
  })
  .catch(err => console.error('Failed to load achievements.json', err));

// -- Camera & interaction state --
let camera = { x: 0, y: 0, scale: 0.6 };
let targetCamera = { x: 0, y: 0, scale: 0.6 };
const easing = 0.12;
let isDragging = false, dragStart = { x: 0, y: 0 }, dragCam = { x: 0, y: 0 };

// focus state
let focusedPlanet = null, focusedTier = null;
let hovered = null;
let time = 0;

// Visual constants (monochrome feel)
const coreRadius = 420;
const baseTierRadius = 110;
const planetSize = 64;
const tierSize = 36;
const achNodeSize = 12;

// Starfield
let stars = [];
for (let i=0;i<240;i++) {
  stars.push({
    x: Math.random()*2400 - 1200,
    y: Math.random()*2400 - 1200,
    size: Math.random()*2 + 0.4,
    speed: Math.random()*0.6 + 0.1,
    a: Math.random()*0.7 + 0.15
  });
}

// DOM references
const hoverInfo = document.getElementById('hoverInfo');
const overlay = document.getElementById('planetOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayBody = document.getElementById('overlayBody');
const overlayClose = document.getElementById('overlayClose');
const overlayZoomBtn = document.getElementById('overlayZoomBtn');
const overlayJunctionBtn = document.getElementById('overlayJunctionBtn');
const junctionModal = document.getElementById('junctionModal');
const junctionClose = document.getElementById('junctionClose');
const junctionTitle = document.getElementById('junctionTitle');
const junctionTasks = document.getElementById('junctionTasks');
const popup = document.getElementById('popup');

overlayClose.addEventListener('click', ()=> overlay.style.display='none');
overlayZoomBtn.addEventListener('click', ()=>{
  if (focusedPlanet != null){
    const angle = planetAngle(focusedPlanet);
    targetCamera.x = -Math.cos(angle) * coreRadius;
    targetCamera.y = -Math.sin(angle) * coreRadius;
    targetCamera.scale = 1.8;
    overlay.style.display='none';
  }
});
overlayJunctionBtn.addEventListener('click', ()=>{
  if (focusedPlanet != null) openJunction(focusedPlanet);
});

junctionClose.addEventListener('click', ()=> junctionModal.style.display='none');

// helper: deterministic jitter generator (stable per indices)
function jitterSeed(a,b,c=0){
  // small deterministic pseudo-random value [-1,1]
  const v = Math.sin(a*127.1 + b*311.7 + c*19.5) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

// compute planet angle (evenly around circle)
function planetAngle(i){
  const n = achievements.planets?.length || 6;
  return i * (2*Math.PI / n) - Math.PI/2;
}

// draw loop
function draw(){
  time += 0.016;
  // camera easing
  camera.x += (targetCamera.x - camera.x) * easing;
  camera.y += (targetCamera.y - camera.y) * easing;
  camera.scale += (targetCamera.scale - camera.scale) * easing;

  // clear
  ctx.clearRect(0,0,width,height);
  ctx.save();
  ctx.translate(width/2, height/2);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(camera.x, camera.y);

  // draw starfield
  stars.forEach(s=>{
    ctx.globalAlpha = s.a * 0.95;
    ctx.fillStyle = 'white';
    ctx.fillRect(s.x, s.y, s.size, s.size);
    s.x -= s.speed;
    if (s.x < -1400) s.x = 1400;
  });
  ctx.globalAlpha = 1;

  // central hub (draw grayscale)
  ctx.save();
  ctx.filter = 'grayscale(100%)';
  ctx.drawImage(assets.center, -64, -64, 128, 128);
  ctx.filter = 'none';
  ctx.restore();

  // planets
  if (achievements.planets){
    const n = achievements.planets.length;
    achievements.planets.forEach((planet, i) => {
      // base planet position
      const angle = planetAngle(i);
      const px = Math.cos(angle) * coreRadius;
      const py = Math.sin(angle) * coreRadius;

      // orbit ring (glowing + pulsing)
      const orbitPulse = 0.18 + 0.12 * Math.sin(time*1.8 + i);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,255,255,${0.06 + orbitPulse*0.14})`;
      ctx.lineWidth = (1.6 + orbitPulse*2.4) / camera.scale;
      ctx.setLineDash([6 / camera.scale, 8 / camera.scale]);
      ctx.globalCompositeOperation = 'lighter';
      ctx.arc(0, 0, coreRadius, 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'source-over';

      // planet sprite (draw grayscale)
      ctx.save();
      ctx.filter = 'grayscale(100%)';
      ctx.drawImage(assets.planet, px - planetSize/2, py - planetSize/2, planetSize, planetSize);
      ctx.filter = 'none';
      ctx.restore();

      // label (only when zoomed)
      if (camera.scale > 0.9){
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = '600 13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(planet.planetName || `Planet ${i+1}`, px, py + planetSize/2 + 14);
      }

      // tiers: scattered with deterministic jitter
      planet.tiers.forEach((tier, j) => {
        // compute scatter: angle around planet with base distribution + jitter
        const baseAng = (j / Math.max(1,planet.tiers.length)) * Math.PI * 2;
        const jitterA = jitterSeed(i, j, 1) * 0.6; // angular jitter
        const tangle = baseAng + jitterA;
        const distJ = baseTierRadius + jitterSeed(i, j, 2)*24; // distance jitter
        const tx = px + Math.cos(tangle) * distJ;
        const ty = py + Math.sin(tangle) * distJ;

        // small connecting line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1.4 / camera.scale;
        ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();

        // tier icon (grayscale)
        ctx.save(); ctx.filter = 'grayscale(100%)';
        ctx.drawImage(assets.planet, tx - tierSize/2, ty - tierSize/2, tierSize, tierSize);
        ctx.filter = 'none'; ctx.restore();

        // highlight ring when focused
        if (focusedPlanet === i && focusedTier === j){
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255,255,255,0.16)';
          ctx.lineWidth = 3 / camera.scale;
          ctx.arc(tx, ty, tierSize + 6, 0, Math.PI*2); ctx.stroke();
        }

        // junction marker between tiers (scatter-aware position)
        if (j < planet.tiers.length - 1){
          const jangle = baseAng + 0.5*(Math.PI*2/planet.tiers.length) + jitterSeed(i,j,3)*0.4;
          const jx = px + Math.cos(jangle) * (distJ + 28);
          const jy = py + Math.sin(jangle) * (distJ + 28);
          ctx.save(); ctx.filter = 'grayscale(100%)';
          ctx.drawImage(assets.junction, jx - 8, jy - 8, 16, 16);
          ctx.filter = 'none'; ctx.restore();

          // soft pulsing halo
          const haloAlpha = 0.08 + 0.06 * Math.sin(time*2 + (i+j));
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255,255,255,${haloAlpha})`;
          ctx.lineWidth = 10 / camera.scale;
          ctx.arc(jx, jy, 18, 0, Math.PI*2);
          ctx.stroke();
        }

        // achievement nodes: when planet/tier focused, scatter nodes more freely around the tier
        if (focusedPlanet === i && focusedTier === j){
          const tAch = tier.achievements || [];
          tAch.forEach((ach, k) => {
            // deterministic scatter per node
            const aJ = jitterSeed(i,j,k+5);
            const angleNode = k * (2*Math.PI / Math.max(4, tAch.length)) + aJ*0.9;
            const nodeDist = 42 + jitterSeed(i,j,k+7)*18;
            const ax = tx + Math.cos(angleNode) * nodeDist;
            const ay = ty + Math.sin(angleNode) * nodeDist;

            // connector
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1.2 / camera.scale;
            ctx.moveTo(tx, ty); ctx.lineTo(ax, ay); ctx.stroke();

            // blinking/pulsing using pulse.png for 'available' nodes
            if (ach.status === 'available'){
              const pulsePhase = Math.sin(time*4 + k);
              const pulseAlpha = 0.45 + 0.45 * pulsePhase; // 0..0.9
              const pulseSize = achNodeSize + 8 * (0.6 + 0.4 * pulsePhase);
              ctx.save();
              ctx.globalAlpha = pulseAlpha;
              ctx.filter = 'grayscale(100%)';
              ctx.drawImage(assets.pulse, ax - pulseSize/2, ay - pulseSize/2, pulseSize, pulseSize);
              ctx.filter = 'none';
              ctx.globalAlpha = 1;
              ctx.restore();
            }

            // draw node or lock
            if (ach.status === 'locked'){
              ctx.save(); ctx.filter = 'grayscale(100%)';
              ctx.drawImage(assets.lock, ax - achNodeSize/2, ay - achNodeSize/2, achNodeSize, achNodeSize);
              ctx.filter='none'; ctx.restore();
            } else {
              ctx.save(); ctx.filter = 'grayscale(100%)';
              ctx.drawImage(assets.node, ax - achNodeSize/2, ay - achNodeSize/2, achNodeSize, achNodeSize);
              ctx.filter='none'; ctx.restore();
            }

            // hover ring
            if (hovered && hovered.type === 'achievement' && hovered.core===i && hovered.tier===j && hovered.ach===k){
              ctx.beginPath();
              ctx.strokeStyle = 'rgba(255,255,255,0.18)';
              ctx.lineWidth = 2 / camera.scale;
              ctx.arc(ax, ay, achNodeSize + 6, 0, Math.PI*2); ctx.stroke();
            }
          });
        }
      });
    });
  }

  ctx.restore();
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// -- Interaction: mouse / touch --

// world coords conversion
function screenToWorld(sx, sy){
  // account for canvas center, camera transforms
  const wx = (sx - width/2)/camera.scale - camera.x;
  const wy = (sy - height/2)/camera.scale - camera.y;
  return { x: wx, y: wy };
}

// mouse events
canvas.addEventListener('mousedown', (e)=>{
  isDragging = true;
  dragStart = { x: e.clientX, y: e.clientY };
  dragCam = { x: targetCamera.x, y: targetCamera.y };
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('mouseup', (e)=>{
  canvas.style.cursor = 'grab';
  isDragging = false;
  // click detection (small movement)
  if (Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) < 6){
    const w = screenToWorld(e.clientX, e.clientY);
    const hit = detectHit(w.x, w.y);
    if (hit) handleClick(hit);
  }
});
canvas.addEventListener('mousemove', (e)=>{
  if (isDragging){
    const dx = (e.clientX - dragStart.x)/camera.scale;
    const dy = (e.clientY - dragStart.y)/camera.scale;
    targetCamera.x = dragCam.x + dx;
    targetCamera.y = dragCam.y + dy;
    return;
  }
  const w = screenToWorld(e.clientX, e.clientY);
  const newHover = detectHit(w.x, w.y);
  setHover(newHover, e.clientX, e.clientY);
});

// wheel zoom
canvas.addEventListener('wheel', (e)=>{
  const delta = -e.deltaY * 0.0012;
  targetCamera.scale = Math.max(0.28, Math.min(6, targetCamera.scale + delta));
  try{ sounds.zoom.play().catch(()=>{}); }catch(e){}
});

// touch
canvas.addEventListener('touchstart', e=>{
  if (e.touches.length === 1){
    isDragging = true;
    dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dragCam = { x: targetCamera.x, y: targetCamera.y };
  }
});
canvas.addEventListener('touchmove', e=>{
  if (e.touches.length === 1 && isDragging){
    const dx = (e.touches[0].clientX - dragStart.x)/camera.scale;
    const dy = (e.touches[0].clientY - dragStart.y)/camera.scale;
    targetCamera.x = dragCam.x + dx;
    targetCamera.y = dragCam.y + dy;
  }
});
canvas.addEventListener('touchend', ()=> isDragging=false);

// detect hits (planet, tier, achievement) using same deterministic layout
function detectHit(mx, my){
  if (!achievements.planets) return null;
  for (let i=0;i<achievements.planets.length;i++){
    const angle = planetAngle(i);
    const px = Math.cos(angle) * coreRadius;
    const py = Math.sin(angle) * coreRadius;
    if (Math.hypot(mx-px, my-py) < planetSize*0.6) return { type:'planet', index:i };
    const planet = achievements.planets[i];
    for (let j=0;j<planet.tiers.length;j++){
      const baseAng = (j / Math.max(1,planet.tiers.length)) * Math.PI * 2;
      const jitterA = jitterSeed(i,j,1) * 0.6;
      const tangle = baseAng + jitterA;
      const distJ = baseTierRadius + jitterSeed(i,j,2)*24;
      const tx = px + Math.cos(tangle) * distJ;
      const ty = py + Math.sin(tangle) * distJ;
      if (Math.hypot(mx-tx, my-ty) < tierSize*0.7) return { type:'tier', core:i, tier:j };
      if (focusedPlanet === i && focusedTier === j){
        const tAch = planet.tiers[j].achievements || [];
        for (let k=0;k<tAch.length;k++){
          const aJ = jitterSeed(i,j,k+5);
          const angleNode = k * (2*Math.PI / Math.max(4,tAch.length)) + aJ*0.9;
          const nodeDist = 42 + jitterSeed(i,j,k+7)*18;
          const ax = tx + Math.cos(angleNode) * nodeDist;
          const ay = ty + Math.sin(angleNode) * nodeDist;
          if (Math.hypot(mx-ax, my-ay) < achNodeSize*0.9) return { type:'achievement', core:i, tier:j, ach:k, ax, ay };
        }
      }
    }
  }
  return null;
}

// hover handling UI
function setHover(hit, screenX=0, screenY=0){
  hovered = hit;
  if (!hit){
    hoverInfo.classList.remove('show');
    hoverInfo.setAttribute('aria-hidden','true');
    return;
  }
  // position hover card
  hoverInfo.style.left = (screenX + 18) + 'px';
  hoverInfo.style.top = (screenY + 18) + 'px';
  hoverInfo.classList.add('show');
  hoverInfo.setAttribute('aria-hidden','false');

  // populate hover info
  if (hit.type === 'planet'){
    const p = achievements.planets[hit.index];
    hoverInfo.querySelector('.hi-title').innerText = p.planetName || `Planet ${hit.index+1}`;
    const resources = p.resources && p.resources.length ? p.resources.slice(0,6).join(', ') : 'No resource data';
    hoverInfo.querySelector('.hi-desc').innerText = `Resources: ${resources}`;
    hoverInfo.querySelector('.hi-status').innerText = `${p.tiers.length} locations`;
    try{ sounds.hover.play().catch(()=>{}); }catch(e){}
  } else if (hit.type === 'tier'){
    const t = achievements.planets[hit.core].tiers[hit.tier];
    hoverInfo.querySelector('.hi-title').innerText = t.tierName || `Tier ${hit.tier+1}`;
    hoverInfo.querySelector('.hi-desc').innerText = `${t.achievements.length} missions`;
    hoverInfo.querySelector('.hi-status').innerText = `Click to view`;
    try{ sounds.hover.play().catch(()=>{}); }catch(e){}
  } else if (hit.type === 'achievement'){
    const a = achievements.planets[hit.core].tiers[hit.tier].achievements[hit.ach];
    hoverInfo.querySelector('.hi-title').innerText = a.title;
    hoverInfo.querySelector('.hi-desc').innerText = a.description || '';
    hoverInfo.querySelector('.hi-status').innerText = `Status: ${a.status || 'locked'}`;
    try{ sounds.hover.play().catch(()=>{}); }catch(e){}
  }
}

// click handling
function handleClick(hit){
  if (!hit) return;
  if (hit.type === 'planet'){
    focusedPlanet = hit.index;
    focusedTier = null;
    showPlanetOverlay(hit.index);
    // small zoom toward planet
    const angle = planetAngle(hit.index);
    targetCamera.x = -Math.cos(angle) * coreRadius * 0.35;
    targetCamera.y = -Math.sin(angle) * coreRadius * 0.35;
    targetCamera.scale = Math.max(targetCamera.scale, 1.1);
    try{ sounds.zoom.play().catch(()=>{}); }catch(e){}
  } else if (hit.type === 'tier'){
    focusedPlanet = hit.core; focusedTier = hit.tier;
    // zoom tighter to the tier position
    const angle = planetAngle(hit.core);
    const px = Math.cos(angle) * coreRadius;
    const py = Math.sin(angle) * coreRadius;
    const baseAng = (hit.tier / Math.max(1,achievements.planets[hit.core].tiers.length)) * Math.PI * 2;
    const jitterA = jitterSeed(hit.core,hit.tier,1) * 0.6;
    const tangle = baseAng + jitterA;
    const distJ = baseTierRadius + jitterSeed(hit.core,hit.tier,2)*24;
    const tx = px + Math.cos(tangle) * distJ;
    const ty = py + Math.sin(tangle) * distJ;
    targetCamera.x = -tx; targetCamera.y = -ty;
    targetCamera.scale = 3.4;
    // populate overlay listing achievements for this tier
    showPlanetOverlay(hit.core, hit.tier);
    try{ sounds.zoom.play().catch(()=>{}); }catch(e){}
  } else if (hit.type === 'achievement'){
    // show mission briefing panel near center
    showAchievementBrief(hit.core, hit.tier, hit.ach);
  }
}

// planet overlay UI population
function showPlanetOverlay(index, highlightTier = null){
  const p = achievements.planets[index];
  if (!p) return;
  focusedPlanet = index;
  overlayTitle.innerText = p.planetName || `Planet ${index+1}`;
  overlayBody.innerHTML = '';

  // locations cards (tiers)
  p.tiers.forEach((t, j) => {
    const card = document.createElement('div'); card.className = 'location-card';
    const title = document.createElement('div'); title.className = 'location-title'; title.innerText = `${t.tierName || 'Tier ' + (j+1)}`;
    const nodesWrap = document.createElement('div'); nodesWrap.className = 'location-nodes';
    t.achievements.forEach((a,k) => {
      const pill = document.createElement('div'); pill.className = 'node-pill';
      pill.innerText = `${a.title}`;
      if (a.status === 'available') pill.classList.add('available');
      if (a.status === 'completed') pill.classList.add('completed');
      pill.onclick = ()=> {
        // focus the tier and zoom so nodes appear
        focusedTier = j;
        overlay.style.display = 'none';
        // zoom to tier
        const angle = planetAngle(index);
        const px = Math.cos(angle) * coreRadius;
        const py = Math.sin(angle) * coreRadius;
        const baseAng = (j / Math.max(1,p.tiers.length)) * Math.PI * 2;
        const jitterA = jitterSeed(index,j,1) * 0.6;
        const tangle = baseAng + jitterA;
        const distJ = baseTierRadius + jitterSeed(index,j,2)*24;
        const tx = px + Math.cos(tangle) * distJ;
        const ty = py + Math.sin(tangle) * distJ;
        targetCamera.x = -tx; targetCamera.y = -ty;
        targetCamera.scale = 3.6;
        // optionally show detail for this achievement
        showAchievementBrief(index, j, k);
      };
      nodesWrap.appendChild(pill);
    });
    card.appendChild(title);
    card.appendChild(nodesWrap);
    overlayBody.appendChild(card);
  });

  // junction hint button / quick list if present
  const junctionDiv = document.createElement('div');
  junctionDiv.style.marginTop = '8px';
  const junctionBtn = document.createElement('button');
  junctionBtn.innerText = 'View Junction Objectives';
  junctionBtn.onclick = () => openJunction(index);
  junctionDiv.appendChild(junctionBtn);
  overlayBody.appendChild(junctionDiv);

  overlay.style.display = 'flex';
}

// show junction modal for planet index
function openJunction(index){
  const p = achievements.planets[index];
  junctionTitle.innerText = `${p.planetName} — Junction`;
  junctionTasks.innerHTML = '';
  // prefer explicit junction data if present
  if (p.junction && p.junction.tasks && p.junction.tasks.length){
    p.junction.tasks.forEach(t => {
      const node = document.createElement('div'); node.className='junction-task';
      node.style.padding='10px'; node.style.border='1px solid rgba(255,255,255,0.03)'; node.style.borderRadius='8px';
      node.style.background='rgba(255,255,255,0.01)';
      node.innerText = t;
      junctionTasks.appendChild(node);
    });
  } else {
    // fallback: show top tier achievements as goals
    const hint = document.createElement('div'); hint.style.color='rgba(255,255,255,0.7)';
    hint.innerText = 'No explicit junction block in JSON — top-tier achievements shown as hints.';
    junctionTasks.appendChild(hint);
    // try to include a few items
    p.tiers.slice(0,2).forEach(t=>{
      t.achievements.slice(0,4).forEach(a=>{
        const node = document.createElement('div'); node.className='junction-task';
        node.style.padding='10px'; node.style.border='1px solid rgba(255,255,255,0.03)'; node.style.borderRadius='8px';
        node.style.background='rgba(255,255,255,0.01)';
        node.innerHTML = `<strong>${a.title}</strong><div style="color:rgba(255,255,255,0.6)">${a.description||''}</div>`;
        junctionTasks.appendChild(node);
      });
    });
  }
  junctionModal.style.display = 'flex';
}

// show achievement briefing panel (small centered popup)
function showAchievementBrief(core, tier, idx){
  const a = achievements.planets[core].tiers[tier].achievements[idx];
  popup.innerHTML = '';
  const inner = document.createElement('div');
  inner.innerHTML = `<h3 style="margin:0 0 8px 0;">${a.title}</h3>
    <div style="color:rgba(255,255,255,0.75)">${a.description || ''}</div>
    <div style="margin-top:12px; text-align:right;">
      ${a.status !== 'completed' ? '<button id="btnComplete">Complete</button>' : ''}
      <button id="btnClose">Close</button>
    </div>`;
  popup.appendChild(inner);
  popup.style.display = 'block';
  popup.querySelector('#btnClose').addEventListener('click', ()=> popup.style.display='none');
  const btnC = popup.querySelector('#btnComplete');
  if (btnC){
    btnC.addEventListener('click', ()=>{
      completeAchievement(core, tier, idx);
      popup.style.display='none';
    });
  }
}

// complete achievement and persist (same semantics)
window.completeAchievement = (core, tier, ach) => {
  const a = achievements.planets[core].tiers[tier].achievements[ach];
  if (!a) return;
  a.status = 'completed';
  a.dateCompleted = new Date().toISOString();
  localStorage.setItem('progress', JSON.stringify(achievements));
  const allDone = achievements.planets[core].tiers[tier].achievements.every(x=> x.status === 'completed');
  if (allDone && tier < achievements.planets[core].tiers.length -1){
    achievements.planets[core].tiers[tier+1].achievements.forEach(x => { if (x.status === 'locked') x.status = 'available'; });
  }
};

// admin (kept minimal)
const adminPanel = document.getElementById('adminPanel');
const editContent = document.getElementById('editContent');
window.showAdminPanel = ()=> adminPanel.style.display='block';
window.closeAdmin = ()=> { adminPanel.style.display='none'; editContent.style.display='none'; };
window.loginAdmin = ()=>{
  if (document.getElementById('adminPassword').value === 'admin'){
    let html='';
    achievements.planets.forEach((p,i)=> {
      html += `<h3>${p.planetName}</h3>`;
      p.tiers.forEach((t,j)=>{
        html += `<h4>${t.tierName}</h4>`;
        t.achievements.forEach((a,k)=> {
          html += `<label style="display:flex; gap:8px; margin-bottom:6px;">
            <input style="flex:1" type="text" value="${escapeHtml(a.title)}" onchange="editTitle(${i},${j},${k},this.value)" />
            <input style="flex:1" type="text" value="${escapeHtml(a.description||'')}" onchange="editDesc(${i},${j},${k},this.value)" />
            <select onchange="editStatus(${i},${j},${k},this.value)">
              <option${a.status==='locked'?' selected':''}>locked</option>
              <option${a.status==='available'?' selected':''}>available</option>
              <option${a.status==='completed'?' selected':''}>completed</option>
            </select>
          </label>`;
        });
      });
    });
    html += `<div style="margin-top:12px;"><button onclick="downloadJson()">Download JSON</button></div>`;
    editContent.innerHTML = html; editContent.style.display='block'; document.getElementById('adminPassword').style.display='none';
  } else alert('Wrong password');
};
function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
window.editTitle=(i,j,k,v)=> achievements.planets[i].tiers[j].achievements[k].title=v;
window.editDesc=(i,j,k,v)=> achievements.planets[i].tiers[j].achievements[k].description=v;
window.editStatus=(i,j,k,v)=> {
  const a = achievements.planets[i].tiers[j].achievements[k];
  a.status = v; a.dateCompleted = v==='completed'? new Date().toISOString() : null;
};
window.downloadJson = ()=>{
  const blob = new Blob([JSON.stringify(achievements,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='achievements.json'; a.click();
};

// simple initialization of camera controls (keyboard)
window.addEventListener('keydown', (e)=>{
  if (e.key === '+' || e.key === '=') targetCamera.scale = Math.min(6, targetCamera.scale + 0.2);
  if (e.key === '-' || e.key === '_') targetCamera.scale = Math.max(0.25, targetCamera.scale - 0.2);
  if (e.key === 'r') { targetCamera.x = 0; targetCamera.y = 0; targetCamera.scale = 0.6; focusedPlanet = focusedTier = null; }
});

// Resize observer to keep canvas dims when starting
window.dispatchEvent(new Event('resize'));
