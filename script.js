// Fixed script.js — defensive checks and proper variable ordering
// (Drop this file in place of the previous script.js)

const canvas = document.getElementById('starChart');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;
function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

// Assets (images)
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

// Sounds (non-blocking)
const sounds = {
  hover: new Audio('./assets/hover.mp3'),
  zoom: new Audio('./assets/zoom.mp3'),
  background: new Audio('./assets/background.mp3')
};
try {
  sounds.background.loop = true;
  sounds.background.volume = 0.35;
  sounds.background.play().catch(()=>{});
} catch (e){}

// --- GLOBAL STATE (declared before use) ---
let achievements = {};               // loaded from achievements.json
let planetLayout = [];               // computed layout per planet

// Focus state MUST be declared before functions that reference them:
let focusedPlanet = null;            // index of the planet that is selected
let focusedTier = null;              // index of the tier that is selected
let hoveredHit = null;               // last detected hover hit (object or null)

// Camera
let camera = { x: 0, y: 0, scale: 0.6 };
let targetCamera = { x: 0, y: 0, scale: 0.6 };
const easing = 0.12;

// Visual constants
const centralSize = 200;
const baseCoreRadius = 300;
const orbitStep = 120;
const planetSize = 64;
const tierSize = 34;
const achievementSize = 12;

let starParticles = [];
for (let i = 0; i < 260; i++) {
  starParticles.push({
    x: Math.random() * 2800 - 1400,
    y: Math.random() * 2800 - 1400,
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 0.6 + 0.1,
    alpha: Math.random() * 0.8 + 0.2
  });
}

let time = 0;

// Defensive DOM references — if missing, create minimal fallbacks so code doesn't crash
function ensureDomFallbacks() {
  // hoverInfo
  let h = document.getElementById('hoverInfo');
  if (!h) {
    h = document.createElement('div');
    h.id = 'hoverInfo';
    h.style.position = 'fixed';
    h.style.pointerEvents = 'none';
    h.style.left = '10px';
    h.style.top = '10px';
    h.style.opacity = '0';
    h.className = 'hover-info';
    h.innerHTML = '<div class="hi-title"></div><div class="hi-desc"></div><div class="hi-status"></div>';
    document.body.appendChild(h);
  }
  // popup
  if (!document.getElementById('popup')) {
    const p = document.createElement('div');
    p.id = 'popup';
    p.className = 'popup';
    p.style.display = 'none';
    document.body.appendChild(p);
  }
  // planetOverlay and junctionModal are optional; no creation needed — methods will safely check
}
ensureDomFallbacks();

// Grab DOM elements (some may be fallbacked above)
const hoverInfo = document.getElementById('hoverInfo');
const overlay = document.getElementById('planetOverlay'); // optional
const popup = document.getElementById('popup');
const junctionModal = document.getElementById('junctionModal'); // optional

// --- Load achievements.json and apply saved progress ---
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
      } catch(e) { console.warn('Invalid saved progress', e); }
    }
    computeOrbitLayout();
  })
  .catch(err => {
    console.error('Failed to load achievements.json', err);
    computeOrbitLayout(); // still compute an empty layout so code doesn't crash
  });

// compute static orbit layout (stable)
function computeOrbitLayout() {
  planetLayout = [];
  const planets = achievements.planets || [];
  const count = planets.length || 6;
  for (let i = 0; i < count; i++) {
    const layer = Math.floor(i / 2);
    const orbitRadius = baseCoreRadius + layer * orbitStep;
    const angle = (i / count) * (Math.PI * 2) - Math.PI / 2;
    const px = Math.cos(angle) * orbitRadius;
    const py = Math.sin(angle) * orbitRadius;
    planetLayout.push({ orbitRadius, angle, px, py });
  }
}

// deterministic small noise for scatter
function deterministicNoise(a, b, c = 0) {
  const val = Math.sin(a * 127.1 + b * 311.7 + c * 19.5) * 43758.5453;
  return (val - Math.floor(val)) * 2 - 1;
}

// screen/world conversions
function screenToWorld(sx, sy) {
  return {
    x: (sx - width / 2) / camera.scale - camera.x,
    y: (sy - height / 2) / camera.scale - camera.y
  };
}
function worldToScreen(wx, wy) {
  return {
    x: (wx + camera.x) * camera.scale + width / 2,
    y: (wy + camera.y) * camera.scale + height / 2
  };
}

// --- DRAW LOOP ---
function draw() {
  time += 0.016;
  camera.x += (targetCamera.x - camera.x) * easing;
  camera.y += (targetCamera.y - camera.y) * easing;
  camera.scale += (targetCamera.scale - camera.scale) * easing;

  ctx.clearRect(0, 0, width, height);

  // background
  ctx.fillStyle = '#020308';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(camera.x, camera.y);

  // starfield
  for (let s of starParticles) {
    ctx.globalAlpha = s.alpha * 0.9;
    ctx.fillStyle = 'white';
    ctx.fillRect(s.x, s.y, s.size, s.size);
    s.x -= s.speed * 0.3;
    if (s.x < -2000) s.x = 2000;
  }
  ctx.globalAlpha = 1;

  // central hub
  ctx.save();
  ctx.drawImage(assets.center, -centralSize / 2, -centralSize / 2, centralSize, centralSize);
  ctx.restore();

  // draw orbits
  const planets = achievements.planets || [];
  for (let i = 0; i < planets.length; i++) {
    const L = planetLayout[i];
    if (!L) continue;
    const pulse = 0.08 + 0.06 * Math.sin(time * 1.6 + i);
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${0.03 + pulse})`;
    ctx.lineWidth = Math.max(1, (1.2 + pulse * 2.4) / Math.max(0.2, camera.scale));
    ctx.setLineDash([8 / Math.max(0.2,camera.scale), 10 / Math.max(0.2,camera.scale)]);
    ctx.globalCompositeOperation = 'lighter';
    ctx.arc(0, 0, L.orbitRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'source-over';
  }

  // draw planets, tiers, achievements
  for (let i = 0; i < planets.length; i++) {
    const planet = planets[i];
    const L = planetLayout[i];
    if (!L) continue;
    const px = L.px, py = L.py;

    // planet sprite
    ctx.drawImage(assets.planet, px - planetSize / 2, py - planetSize / 2, planetSize, planetSize);

    // label
    if (camera.scale > 0.9) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = '600 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(planet.planetName || `Planet ${i+1}`, px, py + planetSize / 2 + 14);
    }

    // tiers
    const tiers = planet.tiers || [];
    for (let j = 0; j < tiers.length; j++) {
      const baseAngle = (j / Math.max(1, tiers.length)) * Math.PI * 2;
      const jitterA = deterministicNoise(i, j, 1) * 0.6;
      const tangle = baseAngle + jitterA;
      const dist = 110 + deterministicNoise(i, j, 2) * 20;
      const tx = px + Math.cos(tangle) * dist;
      const ty = py + Math.sin(tangle) * dist;

      // connector
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1.5 / Math.max(0.2, camera.scale);
      ctx.moveTo(px, py);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // tier icon
      ctx.drawImage(assets.planet, tx - tierSize / 2, ty - tierSize / 2, tierSize, tierSize);

      // junction marker
      if (j < tiers.length - 1) {
        const jx = px + Math.cos(baseAngle + 0.5) * (dist + 26);
        const jy = py + Math.sin(baseAngle + 0.5) * (dist + 26);
        ctx.drawImage(assets.junction, jx - 8, jy - 8, 16, 16);
        const halo = 0.06 + 0.05 * Math.sin(time * 2 + i + j);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,255,255,${halo})`;
        ctx.lineWidth = 10 / Math.max(0.2, camera.scale);
        ctx.arc(jx, jy, 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      // achievements only when focused on the tier
      if (focusedPlanet === i && focusedTier === j) {
        const aList = tiers[j].achievements || [];
        for (let k = 0; k < aList.length; k++) {
          const ach = aList[k];
          const aJ = deterministicNoise(i, j, 10 + k);
          const nodeAngle = (k / Math.max(4, aList.length)) * (Math.PI * 2) + aJ * 0.9;
          const nodeDist = 52 + deterministicNoise(i, j, 20 + k) * 22;
          const ax = tx + Math.cos(nodeAngle) * nodeDist;
          const ay = ty + Math.sin(nodeAngle) * nodeDist;

          // connector
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.lineWidth = 1.2 / Math.max(0.2, camera.scale);
          ctx.moveTo(tx, ty);
          ctx.lineTo(ax, ay);
          ctx.stroke();

          // blinking pulse for available nodes
          if (ach.status === 'available') {
            const phase = Math.sin(time * 4 + k);
            const pulseAlpha = 0.45 + 0.45 * phase;
            const pulseSize = achievementSize + 8 * (0.6 + 0.4 * phase);
            ctx.save();
            ctx.globalAlpha = pulseAlpha;
            ctx.drawImage(assets.pulse, ax - pulseSize / 2, ay - pulseSize / 2, pulseSize, pulseSize);
            ctx.restore();
          }

          // node or lock
          if (ach.status === 'locked') {
            ctx.drawImage(assets.lock, ax - achievementSize / 2, ay - achievementSize / 2, achievementSize, achievementSize);
          } else {
            ctx.drawImage(assets.node, ax - achievementSize / 2, ay - achievementSize / 2, achievementSize, achievementSize);
          }

          // hover ring
          if (hoveredHit && hoveredHit.type === 'achievement'
              && hoveredHit.core === i && hoveredHit.tier === j && hoveredHit.ach === k) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 2 / Math.max(0.2, camera.scale);
            ctx.arc(ax, ay, achievementSize + 6, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }
  }

  ctx.restore();
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// --- Hit detection ---
function detectHit(worldX, worldY) {
  const planets = achievements.planets || [];
  for (let i = 0; i < planets.length; i++) {
    const L = planetLayout[i];
    if (!L) continue;
    const px = L.px, py = L.py;
    if (distance(worldX, worldY, px, py) < planetSize * 0.6) return { type: 'planet', index: i, px, py };
    const tiers = planets[i].tiers || [];
    for (let j = 0; j < tiers.length; j++) {
      const baseAngle = (j / Math.max(1, tiers.length)) * Math.PI * 2;
      const jitterA = deterministicNoise(i, j, 1) * 0.6;
      const tangle = baseAngle + jitterA;
      const dist = 110 + deterministicNoise(i, j, 2) * 20;
      const tx = px + Math.cos(tangle) * dist;
      const ty = py + Math.sin(tangle) * dist;
      if (distance(worldX, worldY, tx, ty) < tierSize * 0.7) return { type: 'tier', core: i, tier: j, tx, ty };
      if (j < tiers.length - 1) {
        const jx = px + Math.cos(baseAngle + 0.5) * (dist + 26);
        const jy = py + Math.sin(baseAngle + 0.5) * (dist + 26);
        if (distance(worldX, worldY, jx, jy) < 12) return { type: 'junction', core: i, tier: j, jx, jy };
      }
      // achievements only if tier focused
      if (focusedPlanet === i && focusedTier === j) {
        const aList = tiers[j].achievements || [];
        for (let k = 0; k < aList.length; k++) {
          const aJ = deterministicNoise(i, j, 10 + k);
          const nodeAngle = (k / Math.max(4, aList.length)) * (Math.PI * 2) + aJ * 0.9;
          const nodeDist = 52 + deterministicNoise(i, j, 20 + k) * 22;
          const ax = tx + Math.cos(nodeAngle) * nodeDist;
          const ay = ty + Math.sin(nodeAngle) * nodeDist;
          if (distance(worldX, worldY, ax, ay) < achievementSize * 0.9) {
            return { type: 'achievement', core: i, tier: j, ach: k, ax, ay };
          }
        }
      }
    }
  }
  return null;
}
function distance(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

// --- Interaction handlers (mouse/touch) ---
let isDragging = false;
let dragStartScreen = { x: 0, y: 0 };
let dragStartCamera = { x: 0, y: 0 };
let movedSinceDown = 0;
const CLICK_SLOP = 6; // px

canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  dragStartScreen = { x: e.clientX, y: e.clientY };
  dragStartCamera = { x: targetCamera.x, y: targetCamera.y };
  movedSinceDown = 0;
  canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const dx = (e.clientX - dragStartScreen.x) / camera.scale;
    const dy = (e.clientY - dragStartScreen.y) / camera.scale;
    targetCamera.x = dragStartCamera.x + dx;
    targetCamera.y = dragStartCamera.y + dy;
    movedSinceDown += Math.abs(e.movementX || e.clientX - dragStartScreen.x) + Math.abs(e.movementY || e.clientY - dragStartScreen.y);
    // clear hover while dragging
    setHover(null, e.clientX, e.clientY);
    return;
  }

  // hover detection
  const w = screenToWorld(e.clientX, e.clientY);
  const hit = detectHit(w.x, w.y);
  setHover(hit, e.clientX, e.clientY);
});

canvas.addEventListener('mouseup', (e) => {
  isDragging = false;
  canvas.style.cursor = 'grab';
  const totalMove = Math.hypot(e.clientX - dragStartScreen.x, e.clientY - dragStartScreen.y);
  if (totalMove < CLICK_SLOP) {
    const w = screenToWorld(e.clientX, e.clientY);
    const hit = detectHit(w.x, w.y);
    handleClick(hit, e.clientX, e.clientY);
  }
});

// wheel zoom toward cursor
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const mouseX = e.clientX, mouseY = e.clientY;
  const before = screenToWorld(mouseX, mouseY);
  const delta = -e.deltaY * 0.0016;
  const newScale = Math.max(0.18, Math.min(6, targetCamera.scale + delta));
  targetCamera.scale = newScale;
  const afterCamX = (mouseX - width / 2) / newScale - before.x;
  const afterCamY = (mouseY - height / 2) / newScale - before.y;
  targetCamera.x = afterCamX;
  targetCamera.y = afterCamY;
  try { sounds.zoom.play().catch(()=>{}); } catch(e){}
}, { passive: false });

// touch handlers (simple)
canvas.addEventListener('touchstart', (e)=>{
  if (e.touches.length === 1) {
    isDragging = true;
    dragStartScreen = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dragStartCamera = { x: targetCamera.x, y: targetCamera.y };
  }
});
canvas.addEventListener('touchmove', (e)=>{
  if (e.touches.length === 1 && isDragging) {
    const dx = (e.touches[0].clientX - dragStartScreen.x)/camera.scale;
    const dy = (e.touches[0].clientY - dragStartScreen.y)/camera.scale;
    targetCamera.x = dragStartCamera.x + dx;
    targetCamera.y = dragStartCamera.y + dy;
  }
});
canvas.addEventListener('touchend', ()=> isDragging=false);

// --- UI functions with safety guards ---
function setHover(hit, screenX=0, screenY=0) {
  hoveredHit = hit;
  if (!hoverInfo) return; // nothing to update
  if (!hit) {
    hoverInfo.classList?.remove('show');
    hoverInfo.setAttribute('aria-hidden','true');
    return;
  }
  try {
    hoverInfo.style.left = (screenX + 14) + 'px';
    hoverInfo.style.top = (screenY + 14) + 'px';
  } catch(e){ /* ignore if style not available */ }
  hoverInfo.classList?.add('show');
  hoverInfo.setAttribute('aria-hidden','false');

  // fill fields if exist
  const hiTitle = hoverInfo.querySelector('.hi-title');
  const hiDesc = hoverInfo.querySelector('.hi-desc');
  const hiStatus = hoverInfo.querySelector('.hi-status');

  if (hit.type === 'planet') {
    const p = achievements.planets?.[hit.index];
    if (hiTitle) hiTitle.innerText = p?.planetName || `Planet ${hit.index+1}`;
    const resources = p?.resources?.length ? p.resources.slice(0,6).join(', ') : 'No resource data';
    if (hiDesc) hiDesc.innerText = `Resources: ${resources}`;
    if (hiStatus) hiStatus.innerText = `${p?.tiers?.length ?? 0} locations`;
  } else if (hit.type === 'tier') {
    const t = achievements.planets?.[hit.core]?.tiers?.[hit.tier];
    if (hiTitle) hiTitle.innerText = t?.tierName || `Tier ${hit.tier+1}`;
    if (hiDesc) hiDesc.innerText = `${t?.achievements?.length ?? 0} missions`;
    if (hiStatus) hiStatus.innerText = 'Click to open';
  } else if (hit.type === 'achievement') {
    const a = achievements.planets?.[hit.core]?.tiers?.[hit.tier]?.achievements?.[hit.ach];
    if (hiTitle) hiTitle.innerText = a?.title || 'Achievement';
    if (hiDesc) hiDesc.innerText = a?.description || '';
    if (hiStatus) hiStatus.innerText = `Status: ${a?.status || 'locked'}`;
  } else if (hit.type === 'junction') {
    const t = achievements.planets?.[hit.core]?.tiers?.[hit.tier];
    if (hiTitle) hiTitle.innerText = `${t?.tierName || 'Tier'} - Junction`;
    if (hiDesc) hiDesc.innerText = 'Open junction';
    if (hiStatus) hiStatus.innerText = '';
  }
}

function showAchievementPopup(core, tier, idx) {
  const a = achievements.planets?.[core]?.tiers?.[tier]?.achievements?.[idx];
  if (!a) return;
  if (!popup) {
    alert(`${a.title}\n\n${a.description}\n\nStatus: ${a.status}`);
    return;
  }
  popup.innerHTML = '';
  const inner = document.createElement('div');
  inner.innerHTML = `<h3 style="margin:0 0 8px 0;">${escapeHtml(a.title)}</h3>
    <div style="color:rgba(255,255,255,0.75)">${escapeHtml(a.description || '')}</div>
    <div style="margin-top:12px; text-align:right;">
      ${a.status !== 'completed' ? '<button id="btnComplete">Complete</button>' : ''}
      <button id="btnClose">Close</button>
    </div>`;
  popup.appendChild(inner);
  popup.style.display = 'block';
  const closeBtn = popup.querySelector('#btnClose');
  if (closeBtn) closeBtn.addEventListener('click', () => popup.style.display = 'none');
  const completeBtn = popup.querySelector('#btnComplete');
  if (completeBtn) completeBtn.addEventListener('click', () => {
    completeAchievement(core, tier, idx);
    popup.style.display = 'none';
  });
}

function showPlanetOverlay(planetIndex, highlightTier = null) {
  const ov = document.getElementById('planetOverlay');
  if (!ov) return;
  const title = ov.querySelector('#overlayTitle');
  const body = ov.querySelector('#overlayBody');
  if (!title || !body) return;
  const p = achievements.planets?.[planetIndex];
  if (!p) return;
  title.innerText = p.planetName || `Planet ${planetIndex+1}`;
  body.innerHTML = '';
  p.tiers.forEach((t,j) => {
    const card = document.createElement('div'); card.className = 'location-card';
    const heading = document.createElement('div'); heading.className = 'location-title';
    heading.innerText = t.tierName || `Tier ${j+1}`;
    const nodesWrap = document.createElement('div'); nodesWrap.className = 'location-nodes';
    (t.achievements || []).forEach((a,k) => {
      const pill = document.createElement('div'); pill.className = 'node-pill';
      pill.innerText = a.title || 'Untitled';
      if (a.status === 'available') pill.classList.add('available');
      if (a.status === 'completed') pill.classList.add('completed');
      pill.onclick = ()=> {
        focusedPlanet = planetIndex;
        focusedTier = j;
        ov.style.display = 'none';
        // zoom to tier position
        const pL = planetLayout[planetIndex];
        const baseAngle = (j / Math.max(1, p.tiers.length)) * Math.PI * 2;
        const jitterA = deterministicNoise(planetIndex, j, 1) * 0.6;
        const tangle = baseAngle + jitterA;
        const dist = 110 + deterministicNoise(planetIndex, j, 2) * 20;
        const tx = pL.px + Math.cos(tangle) * dist;
        const ty = pL.py + Math.sin(tangle) * dist;
        targetCamera.x = -tx; targetCamera.y = -ty; targetCamera.scale = 3.6;
        showAchievementPopup(planetIndex, j, k);
      };
      nodesWrap.appendChild(pill);
    });
    card.appendChild(heading); card.appendChild(nodesWrap); body.appendChild(card);
  });
  ov.style.display = 'flex';
}

function openJunction(planetIndex) {
  const modal = document.getElementById('junctionModal');
  const title = document.getElementById('junctionTitle');
  const tasks = document.getElementById('junctionTasks');
  if (!modal || !title || !tasks) {
    // fallback: alert
    const p = achievements.planets?.[planetIndex];
    if (!p) return;
    alert(`Junction for ${p.planetName || 'Planet'} — check top-tier achievements`);
    return;
  }
  const p = achievements.planets?.[planetIndex];
  title.innerText = `${p.planetName} — Junction`;
  tasks.innerHTML = '';
  if (p.junction?.tasks?.length) {
    p.junction.tasks.forEach(t => {
      const d = document.createElement('div'); d.className = 'junction-task';
      d.style.padding = '10px'; d.style.border = '1px solid rgba(255,255,255,0.03)'; d.style.borderRadius = '8px';
      d.style.background = 'rgba(255,255,255,0.01)'; d.innerText = t;
      tasks.appendChild(d);
    });
  } else {
    (p.tiers || []).slice(0,2).forEach(t => {
      t.achievements?.slice(0,4).forEach(a => {
        const d = document.createElement('div'); d.className = 'junction-task';
        d.style.padding = '10px'; d.style.border = '1px solid rgba(255,255,255,0.03)';
        d.style.borderRadius = '8px'; d.style.background = 'rgba(255,255,255,0.01)';
        d.innerHTML = `<strong>${a.title}</strong><div style="color:rgba(255,255,255,0.6)">${a.description || ''}</div>`;
        tasks.appendChild(d);
      });
    });
  }
  modal.style.display = 'flex';
}

// click handling
function handleClick(hit, screenX = 0, screenY = 0) {
  if (!hit) {
    // clicked out: close overlays if present
    const side = document.getElementById('sidePanel'); if (side) side.style.display = 'none';
    const ov = document.getElementById('planetOverlay'); if (ov) ov.style.display = 'none';
    const jm = document.getElementById('junctionModal'); if (jm) jm.style.display = 'none';
    if (popup) popup.style.display = 'none';
    return;
  }

  if (hit.type === 'planet') {
    focusedPlanet = hit.index; focusedTier = null;
    const pL = planetLayout[hit.index];
    targetCamera.x = -pL.px * 0.38;
    targetCamera.y = -pL.py * 0.38;
    targetCamera.scale = Math.max(targetCamera.scale, 1.2);
    showPlanetOverlay(hit.index);
  } else if (hit.type === 'tier') {
    focusedPlanet = hit.core; focusedTier = hit.tier;
    const pL = planetLayout[hit.core];
    const baseAngle = (hit.tier / Math.max(1, achievements.planets[hit.core].tiers.length)) * Math.PI * 2;
    const jitterA = deterministicNoise(hit.core, hit.tier, 1) * 0.6;
    const tangle = baseAngle + jitterA;
    const dist = 110 + deterministicNoise(hit.core, hit.tier, 2) * 20;
    const tx = pL.px + Math.cos(tangle) * dist;
    const ty = pL.py + Math.sin(tangle) * dist;
    targetCamera.x = -tx; targetCamera.y = -ty; targetCamera.scale = 3.6;
    showPlanetOverlay(hit.core, hit.tier);
  } else if (hit.type === 'achievement') {
    showAchievementPopup(hit.core, hit.tier, hit.ach);
  } else if (hit.type === 'junction') {
    openJunction(hit.core);
  }
}

// completion function
window.completeAchievement = (core, tier, ach) => {
  const a = achievements.planets?.[core]?.tiers?.[tier]?.achievements?.[ach];
  if (!a) return;
  a.status = 'completed';
  a.dateCompleted = new Date().toISOString();
  localStorage.setItem('progress', JSON.stringify(achievements));
  const allDone = achievements.planets[core].tiers[tier].achievements.every(x => x.status === 'completed');
  if (allDone && tier < achievements.planets[core].tiers.length - 1) {
    achievements.planets[core].tiers[tier + 1].achievements.forEach(x => { if (x.status === 'locked') x.status = 'available'; });
  }
};

// admin helpers (unchanged semantics)
const adminPanel = document.getElementById('adminPanel');
const editContent = document.getElementById('editContent');
window.showAdminPanel = ()=> { if (adminPanel) adminPanel.style.display = 'block'; };
window.closeAdmin = ()=> { if (adminPanel) adminPanel.style.display = 'none'; if (editContent) editContent.style.display = 'none'; };
window.loginAdmin = ()=> {
  const passEl = document.getElementById('adminPassword'); const pass = passEl ? passEl.value : '';
  if (pass === 'admin') {
    if (!achievements.planets) return;
    let html = '';
    achievements.planets.forEach((p,i) => {
      html += `<h3>${p.planetName}</h3>`;
      p.tiers.forEach((t,j) => {
        html += `<h4>${t.tierName}</h4>`;
        t.achievements.forEach((a,k) => {
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
    if (editContent) { editContent.innerHTML = html; editContent.style.display = 'block'; }
    if (passEl) passEl.style.display = 'none';
  } else alert('Wrong password');
};
window.editTitle = (i,j,k,v) => { if (achievements.planets?.[i]?.tiers?.[j]?.achievements?.[k]) achievements.planets[i].tiers[j].achievements[k].title = v; };
window.editDesc = (i,j,k,v) => { if (achievements.planets?.[i]?.tiers?.[j]?.achievements?.[k]) achievements.planets[i].tiers[j].achievements[k].description = v; };
window.editStatus = (i,j,k,v) => { const a = achievements.planets?.[i]?.tiers?.[j]?.achievements?.[k]; if (a){ a.status = v; a.dateCompleted = v === 'completed' ? new Date().toISOString() : null; } };
window.downloadJson = ()=> { const blob = new Blob([JSON.stringify(achievements,null,2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'achievements.json'; a.click(); };
window.bulkUnlock = ()=> { achievements.planets?.forEach(p => p.tiers.forEach(t => t.achievements.forEach(a => a.status = 'available'))); alert('All unlocked'); };
window.bulkReset = ()=> { achievements.planets?.forEach(p => p.tiers.forEach((t,j)=> t.
